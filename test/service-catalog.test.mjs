import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';
import { databaseBinding, openDatabase } from '../scripts/node-runtime.mjs';
import { createApp } from '../src/worker.js';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const origin = 'https://tap.example.test';
const serviceMigration = '0016_service_catalog';

function client(db, role = 'manager') {
  const env = { DB: databaseBinding(db), DEMO_MODE: true };
  const app = createApp(readAssets());
  return (path, method = 'GET', body, version) => app.fetch(new Request(origin + path, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', 'x-demo-role': role,
      ...(version === undefined ? {} : { 'If-Match': '"' + version + '"' }) },
    body: body && JSON.stringify(body),
  }), env);
}

const model = async (response) => JSON.parse((await response.text()).match(/id="page-data">([^<]*)<\/script>/)[1]);

test('menu and services have independent rows, settings and order versions', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  seedDemo(db);
  const request = client(db);
  const base = '/api/sites/moka-coffee';
  const readCatalog = async (kind) => (await request(base + (kind === 'services' ? '?catalog=services' : ''))).json();
  const initial = await readCatalog('menu');
  const batch = JSON.parse(read('public/service-template.json'));
  assert.equal(initial.site.show_services, 0);
  assert.deepEqual((await readCatalog('services')).items, []);
  assert.equal((await request('/api/sites/basilico/services/import', 'POST', batch)).status, 404);
  assert.equal((await request(base + '/services/import', 'POST', batch)).status, 201);
  assert.deepEqual(await (await request(base + '/services/import', 'POST', batch)).json(), { added: 0, skipped: 1 });
  assert.equal((await readCatalog('menu')).menuOrderVersion, initial.menuOrderVersion);
  assert.deepEqual(await (await request(base + '/items/import', 'POST', batch)).json(), { added: 1, skipped: 0 });
  assert.equal((await request(base + '/services', 'POST', { name: 'Маникюр', category: 'Ногти', price: 3500, available: true })).status, 201);
  const services = await readCatalog('services');
  const menu = await readCatalog('menu');
  const [first, second] = services.items;
  assert.ok(!menu.items.some((item) => item.id === first.id));
  assert.equal((await request(base + '/items/' + first.id, 'DELETE', undefined, first.edit_version)).status, 412);
  assert.equal((await request(base + '/services/order', 'PUT', { id: first.id, target: menu.items[0].id }, services.menuOrderVersion)).status, 412);
  assert.equal((await request(base + '/services/order', 'PUT', { id: second.id, target: first.id }, services.menuOrderVersion)).status, 200);
  assert.deepEqual((await readCatalog('services')).items.map((item) => item.id), [second.id, first.id]);
  assert.equal((await readCatalog('menu')).menuOrderVersion, menu.menuOrderVersion);

  assert.equal((await request(base + '/services/link', 'PUT', { services_url: '', show_services: true, previous_url: '', previous_show_services: false })).status, 200);
  const home = await model(await request('/moka-coffee'));
  assert.equal(home.site.show_services, 1);
  assert.equal(home.site.show_menu, initial.site.show_menu);
  assert.equal((await model(await request('/moka-coffee/services'))).view, 'services');
  assert.deepEqual((await model(await request('/moka-coffee/services'))).items.map((item) => item.id), [second.id, first.id]);
  assert.ok(!(await model(await request('/moka-coffee/menu'))).items.some((item) => item.id === first.id));
  const external = 'https://catalog.example.test/services';
  assert.equal((await request(base + '/services/link', 'PUT', { services_url: external, previous_url: '', previous_show_services: true })).status, 200);
  assert.equal((await request('/moka-coffee/services')).headers.get('Location'), external);
  assert.equal((await request('/moka-coffee/menu')).status, 200);
});

test('existing salon positions and public menu links are carried into services', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const migrations = JSON.parse(read('drizzle/meta/_journal.json')).entries;
  const index = migrations.findIndex(({ tag }) => tag === serviceMigration);
  assert.ok(index > 0);
  for (const { tag } of migrations.slice(0, index)) db.exec(read('drizzle/' + tag + '.sql'));
  seedDemo(db);
  db.prepare("UPDATE sites SET status='live', show_menu=1, guest_order='[\"menu\",\"wifi\"]' WHERE id='forma'").run();
  db.exec(read('drizzle/' + serviceMigration + '.sql'));
  const request = client(db, 'owner');
  const { site, items } = await (await request('/api/sites/forma-studio?catalog=services')).json();
  assert.equal(site.show_menu, 0);
  assert.equal(site.show_services, 1);
  assert.equal(site.guest_order[0], 'services');
  assert.deepEqual(items.map(({ name }) => name), ['Стрижка и укладка']);
  assert.equal((await request('/forma-studio/menu?nfc=forma-demo')).headers.get('Location'), '/forma-studio/services?nfc=forma-demo');
  assert.equal((await model(await request('/forma-studio/services?nfc=forma-demo'))).query, '?nfc=forma-demo');
  assert.equal((await (await request('/api/sites/forma-studio')).json()).items.length, 0);
});

test('the barbershop demo ships with a published service catalog next to the existing coffee demo', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const request = client(db, 'owner');
  assert.equal((await request('/barbershop')).status, 404);
  db.exec(`INSERT INTO sites (id, slug, name, type, theme, status, nfc_key, created_at)
    VALUES ('coffee-demo', 'coffe1', 'Кофе 01', 'Кофейня', 'coffee', 'live', 'coffee-demo', '2026-01-01')`);
  const migration = read('drizzle/0017_barbershop_demo.sql');
  db.exec(migration);

  const home = await model(await request('/barbershop'));
  assert.equal(home.site.name, 'Контур');
  assert.equal(home.site.show_services, 1);
  assert.equal(home.site.show_hours, 1);
  assert.equal(home.site.show_menu, 0);
  const services = await model(await request('/barbershop/services'));
  assert.equal(services.view, 'services');
  assert.equal(services.items.length, 12);
  assert.deepEqual([...new Set(services.items.map(({ category }) => category))], ['Стрижки', 'Борода', 'Комплексы', 'Уход']);
  assert.equal(services.site.currency, 'BYN');
  assert.equal((await request(new URL(home.site.cover_url).pathname)).headers.get('Content-Type'), 'image/jpeg');
  assert.equal((await model(await request('/coffe1'))).site.name, 'Кофе 01');

  db.prepare('UPDATE items SET price=? WHERE id=?').run(5200, services.items[0].id);
  db.exec(migration);
  const updated = await model(await request('/barbershop/services'));
  assert.equal(updated.items.length, 12);
  assert.equal(updated.items[0].price, 5200);
});
