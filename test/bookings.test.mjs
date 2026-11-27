import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';
import { databaseBinding, openDatabase } from '../scripts/node-runtime.mjs';
import { createApp, todayOffset } from '../src/worker.js';

test('only enabled published venues accept bookings, and assigned staff can process them', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  seedDemo(db);
  const env = { DB: databaseBinding(db), DEMO_MODE: true };
  const app = createApp(readAssets());
  const origin = 'https://tap.example.test';
  const site = '/api/sites/moka-coffee';
  const inbox = site + '/bookings';
  const publicEndpoint = '/api/bookings/moka-coffee';
  const data = {
    id: crypto.randomUUID(), visit_date: todayOffset(1), visit_time: '20:00',
    party_size: 3, guest_name: 'Алина', phone: '+375 (29) 000-00-01', comment: 'Стол у окна',
  };
  const fetch = (path, { method = 'GET', body, role = 'manager', originHeader = origin } = {}) =>
    app.fetch(new Request(origin + path, { method, headers: {
      Origin: originHeader, 'Content-Type': 'application/json', 'x-demo-role': role,
    }, body: body && JSON.stringify(body) }), env);
  const configure = (enabled, previous, path = inbox) => fetch(path, {
    method: 'PUT', body: { show_booking: enabled, previous_show_booking: previous },
  });
  const submit = (body = data, options = {}) => fetch(publicEndpoint, { method: 'POST', body, ...options });
  const model = async () => JSON.parse((await (await fetch('/moka-coffee')).text()).match(/id="page-data">([^<]*)<\/script>/)[1]);

  assert.equal((await model()).site.show_booking, 0);
  assert.equal((await submit()).status, 404);
  assert.equal((await configure(true, false, '/api/sites/basilico/bookings')).status, 404);
  assert.equal((await configure(true, false)).status, 200);
  assert.equal((await model()).site.show_booking, 1);
  assert.equal((await configure(false, false)).status, 409);
  assert.equal((await submit(data, { originHeader: 'https://other.example.test' })).status, 403);
  assert.equal((await fetch(publicEndpoint + '?preview=1', { method: 'POST', body: data })).status, 403);
  assert.equal((await submit({ ...data, visit_date: todayOffset(-1) })).status, 400);
  assert.equal((await submit({ ...data, visit_date: '2031-02-29' })).status, 400);
  assert.equal((await submit({ ...data, visit_time: '24:00' })).status, 400);
  assert.equal((await submit({ ...data, party_size: 0 })).status, 400);
  assert.equal((await submit({ ...data, phone: 'без номера' })).status, 400);
  assert.equal((await submit()).status, 201);
  assert.equal((await submit()).status, 200);
  assert.ok(!JSON.stringify(await model()).includes(data.guest_name));
  assert.equal((await fetch('/api/sites/basilico/bookings')).status, 404);
  assert.deepEqual((await (await fetch(inbox + '?status=pending')).json()).bookings.map(({ id, phone }) => [id, phone]),
    [[data.id, '+375290000001']]);

  const update = (status, path = inbox, role = 'manager') => fetch(path + '/' + data.id, { method: 'PUT', body: { status }, role });
  assert.equal((await update('confirmed', '/api/sites/basilico/bookings', 'owner')).status, 404);
  assert.equal((await update(['confirmed'])).status, 400);
  assert.equal((await update('cancelled')).status, 409);
  assert.equal((await update('confirmed')).status, 200);
  assert.equal((await update('confirmed')).status, 200);
  assert.equal((await update('declined')).status, 409);
  assert.deepEqual((await (await fetch(inbox + '?status=pending')).json()).bookings, []);

  assert.equal((await configure(false, true)).status, 200);
  assert.equal((await model()).site.show_booking, 0);
  assert.equal((await submit({ ...data, id: crypto.randomUUID() })).status, 404);
  assert.equal((await update('cancelled')).status, 200);
  assert.equal((await (await fetch(inbox, { role: 'owner' })).json()).bookings[0].status, 'cancelled');

  assert.equal((await configure(true, false)).status, 200);
  db.prepare("UPDATE sites SET status='draft' WHERE slug='moka-coffee'").run();
  assert.equal((await submit({ ...data, id: crypto.randomUUID() })).status, 404);
});
