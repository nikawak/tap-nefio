import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createApp, dayKey } from '../src/worker.js';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const origin = 'https://tap.example.test';
const manager = { name: 'Анна', role: 'manager', email: 'manager@demo.tap' };

function fixture(t, hooks = {}) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  for (const { tag } of JSON.parse(read('drizzle/meta/_journal.json')).entries) db.exec(read('drizzle/' + tag + '.sql'));
  seedDemo(db);
  const prepare = (sql, params = []) => ({
    bind: (...values) => prepare(sql, values),
    all: async () => {
      hooks.onRead?.(sql);
      return { results: db.prepare(sql).all(...params) };
    },
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => {
      if (/INSERT INTO (events|tip_opens)\b/.test(sql)) await hooks.onCounter?.();
      return { meta: db.prepare(sql).run(...params) };
    },
  });
  const app = createApp(readAssets());
  const env = { DB: { prepare }, OWNER_EMAIL: 'owner@example.test' };
  const sessions = new Map();
  for (const email of [env.OWNER_EMAIL, manager.email]) {
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('base64url');
    db.prepare('INSERT INTO google_sessions (token_hash,email,name,expires_at) VALUES (?, ?, ?, ?)')
      .run(hash, email, '', Math.floor(Date.now() / 1000) + 600);
    sessions.set(email, token);
  }
  function request(path, { email, method = 'GET', body, ctx } = {}) {
    const headers = { origin, ...(body && { 'content-type': 'application/json' }) };
    if (email) headers.cookie = '__Host-tap-session=' + sessions.get(email);
    return app.fetch(new Request(origin + path, { headers, method, body: body && JSON.stringify(body) }), env, ctx);
  }
  return { db, request };
}

test('guest pages and redirects survive an analytics write failure', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const { db, request } = fixture(t, { onCounter: () => { throw new Error('counter offline'); } });
  db.prepare("UPDATE sites SET show_maps=1 WHERE slug='moka-coffee'").run();
  const owner = 'owner@example.test';
  const tipsUrl = 'https://pay.netmonet.alfabank.by/fixture';
  const tips = { links: { alpha: { enabled: true, recipient: 'Кофейня', url: tipsUrl } }, checkout: {} };
  assert.equal((await request('/api/sites/moka-coffee/tips', { email: owner, method: 'PUT', body: tips })).status, 200);

  const tasks = [];
  const ctx = { waitUntil: (task) => tasks.push(task) };
  assert.equal((await request('/moka-coffee?nfc=moka-demo', { ctx })).status, 200);
  const menu = await request('/moka-coffee/menu?nfc=moka-demo', { ctx });
  assert.equal(menu.status, 200);
  assert.match(await menu.text(), /Капучино/);
  assert.match((await request('/moka-coffee/go/maps', { ctx })).headers.get('location'), /google\.com\/maps/);
  assert.equal((await request('/moka-coffee/tips', { ctx })).headers.get('location'), tipsUrl);
  await Promise.all(tasks);
  assert.equal(log.mock.calls.filter(({ arguments: [message] }) => message === 'Could not record analytics').length, 4);
});

test('a delayed counter is registered without holding up the menu', { timeout: 2500 }, async (t) => {
  const delayed = Promise.withResolvers();
  const { db, request } = fixture(t, { onCounter: () => delayed.promise });
  db.exec("DELETE FROM events WHERE site_id='moka' AND kind='menu'");
  const tasks = [];
  const result = await request('/moka-coffee/menu?nfc=moka-demo', { ctx: { waitUntil: (task) => tasks.push(task) } });
  assert.equal(result.status, 200);
  const count = () => db.prepare("SELECT COUNT(*) AS count FROM events WHERE site_id='moka' AND kind='menu' AND source='nfc'").get().count;
  assert.equal(tasks.length, 1);
  assert.equal(count(), 0);
  delayed.resolve();
  await tasks[0];
  assert.equal(count(), 1);
});

test('a failed report leaves the owner and assigned administrator able to manage the menu', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { request } = fixture(t, { onRead: (sql) => {
    if (sql.includes('FROM events e')) throw new Error('report offline');
  } });
  const email = manager.email;
  assert.equal((await request('/api/overview', { email })).status, 500);
  assert.equal((await request('/api/sites', { email, method: 'POST', body: { slug: 'another-venue' } })).status, 403);
  assert.equal((await request('/api/sites')).status, 401);
  const listing = await (await request('/api/sites', { email })).json();
  assert.deepEqual(listing.sites.map(({ slug }) => slug), ['moka-coffee']);
  const owner = await (await request('/api/sites', { email: 'owner@example.test' })).json();
  assert.equal(owner.sites.length, 3);
  assert.equal((await request('/api/sites/basilico', { email })).status, 404);
  const item = { name: 'Тестовая позиция', category: 'Кофе', price: 450, available: true };
  assert.equal((await request('/api/sites/moka-coffee/items', { method: 'POST', email, body: item })).status, 201);
  const bundle = await (await request('/api/sites/moka-coffee', { email })).json();
  assert.ok(bundle.items.some((entry) => entry.name === item.name));
});

test('tips totals follow venue assignments and setup is owner-only', async (t) => {
  const { db, request } = fixture(t);
  const day = dayKey();
  const record = db.prepare("INSERT INTO tip_opens (site_id, method, day, source, count) VALUES (?, 'alpha', ?, 'nfc', ?)");
  record.run('moka', day, 2);
  record.run('basil', day, 5);
  assert.equal((await request('/api/tips')).status, 401);
  const managerReport = await (await request('/api/tips?site=moka-coffee', { email: manager.email })).json();
  assert.equal(managerReport.tips.counts[0].count, 2);
  assert.equal(managerReport.settings, null);
  assert.equal((await request('/api/tips?site=basilico', { email: manager.email })).status, 404);
  const ownerReport = await (await request('/api/tips', { email: 'owner@example.test' })).json();
  assert.equal(ownerReport.tips.counts[0].count, 7);
  const ownerSiteReport = await (await request('/api/tips?site=basilico', { email: 'owner@example.test' })).json();
  assert.equal(ownerSiteReport.tips.counts[0].count, 5);
  assert.ok(ownerSiteReport.settings.checkout);
});

test('reports in the main navigation stay separate from the assigned mini-site editor', async () => {
  const code = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const app = { innerHTML: '' };
  const modal = { addEventListener() {} };
  const location = { pathname: '/admin' };
  const requested = [];
  let delayedReport;
  const site = { slug: 'moka-coffee', name: 'Moka Coffee', theme: 'coffee', type: 'Кофейня', status: 'live', currency: 'BYN' };
  const bundle = { user: manager, site, items: [{ id: 'abc', name: 'Капучино', category: 'Кофе', price: 850, available: 1 }] };
  const document = { querySelector: (selector) => ({ '#app': app, '#modal': modal, '#page-data': { textContent: '{}' } }[selector]) };
  const browser = {
    document, location, URLSearchParams, FormData, AbortController,
    history: { replaceState: (_state, _title, path) => { location.pathname = path; } },
    fetch: async (path) => {
      requested.push(path);
      if (path === '/api/sites') return Response.json({ user: manager, sites: [site] });
      if (path === '/api/sites/moka-coffee') return Response.json(bundle);
      if (path.startsWith('/api/bookings?')) return Response.json({ bookings: [{
        id: 'request', site_slug: site.slug, site_name: site.name, guest_name: 'Гость', phone: '+375290000001',
        visit_date: '2030-01-01', visit_time: '18:00', party_size: 2, status: 'pending', created_at: '2026-11-27T10:00:00Z',
      }], page: 1 });
      if (path.startsWith('/api/tips?')) return Response.json({ tips: { counts: [], paid: { count: 0, amount: 0 } }, settings: null });
      return delayedReport?.promise ?? Response.json({ error: 'report unavailable' }, { status: 500 });
    },
  };
  const { load, state } = runInNewContext(code + '\n({load,state});', browser);
  state.user = manager;
  await load();
  assert.match(app.innerHTML, /Статистика временно недоступна/);
  assert.match(app.innerHTML, /К мини-сайтам/);
  location.pathname = '/admin/sites';
  await load();
  assert.match(app.innerHTML, /Moka Coffee/);
  assert.match(app.innerHTML, /Новые страницы создаёт владелец платформы/);
  assert.doesNotMatch(app.innerHTML, /data-action="new-site"/);
  location.pathname = '/admin/sites/moka-coffee/access';
  await load();
  assert.equal(location.pathname, '/admin/sites/moka-coffee');
  assert.match(app.innerHTML, /Капучино/);
  assert.match(app.innerHTML, /href="\/admin\/sites\/moka-coffee\/services"/);
  assert.doesNotMatch(app.innerHTML, /href="\/admin\/sites\/moka-coffee\/access"/);
  assert.doesNotMatch(app.innerHTML, /href="\/admin\/sites\/moka-coffee\/(feedback|bookings|tips|analytics)"/);
  assert.deepEqual(requested, ['/api/overview?days=7', '/api/sites', '/api/sites/moka-coffee']);
  location.pathname = '/admin/bookings';
  await load();
  assert.match(app.innerHTML, /<h1>Бронирование<\/h1>/);
  assert.match(app.innerHTML, /Гость/);
  assert.doesNotMatch(app.innerHTML, /bookingSettingsForm|<nav class="tabs"/);
  location.pathname = '/admin/tips';
  await load();
  assert.match(app.innerHTML, /Подтверждённые оплаты/);
  assert.doesNotMatch(app.innerHTML, /tipsForm/);
  location.pathname = '/admin/analytics';
  location.search = '?site=moka-coffee';
  await load();
  assert.equal(requested.at(-1), '/api/overview?days=7&site=moka-coffee');
  assert.match(app.innerHTML, /Статистика временно недоступна/);
  assert.doesNotMatch(app.innerHTML, /<nav class="tabs"/);
  assert.match(app.innerHTML, /data-action="retry-load"/);

  delayedReport = Promise.withResolvers();
  const slowReport = load();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.innerHTML, /Загрузка…/);
  location.pathname = '/admin/sites/moka-coffee';
  await load();
  delayedReport.resolve(Response.json({ error: 'report unavailable' }, { status: 500 }));
  await slowReport;
  assert.match(app.innerHTML, /Капучино/);
  assert.doesNotMatch(app.innerHTML, /Статистика временно недоступна/);
});
