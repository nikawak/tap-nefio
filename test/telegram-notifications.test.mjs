import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';
import { databaseBinding, openDatabase } from '../scripts/node-runtime.mjs';
import { deliverTelegramNotifications, telegramWebhookPath } from '../src/telegram-notifications.js';
import { createApp, todayOffset } from '../src/worker.js';

const origin = 'https://tap.example.test';
const config = '/api/sites/moka-coffee/notifications';
const bookingPath = '/api/bookings/moka-coffee';
const staffPath = '/api/sites/moka-coffee/bookings';
const now = () => Math.floor(Date.now() / 1000);

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  seedDemo(db);
  db.prepare(`UPDATE sites SET show_booking=1, show_reviews=1, google_review_url='https://maps.example.test/'
    WHERE id='moka'`).run();
  const env = {
    DB: databaseBinding(db), OWNER_EMAIL: 'owner@example.test', TAP_PUBLIC_ORIGIN: origin,
    TELEGRAM_BOT_TOKEN: '123456:fixture-not-a-real-bot-token', TELEGRAM_BOT_USERNAME: 'NefioFixtureBot',
    TELEGRAM_WEBHOOK_SECRET: 'fixture-secret-used-only-in-tests',
  };
  const sessions = new Map();
  for (const [role, email] of [['owner', env.OWNER_EMAIL], ['manager', 'manager@demo.tap']]) {
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('base64url');
    db.prepare('INSERT INTO google_sessions (token_hash, email, name, expires_at) VALUES (?, ?, ?, ?)')
      .run(hash, email, '', now() + 600);
    sessions.set(role, '__Host-tap-session=' + token);
  }
  const app = createApp(readAssets());
  const request = (path, { method = 'GET', role, data, headers } = {}) => app.fetch(new Request(origin + path, {
    method, body: data && JSON.stringify(data), headers: {
      Origin: origin, 'Content-Type': 'application/json', ...(role && { Cookie: sessions.get(role) }), ...headers,
    },
  }), env);
  const update = (id, status) => request(staffPath + '/' + id, { method: 'PUT', role: 'manager', data: { status } });
  const telegram = (chat, text, secret = env.TELEGRAM_WEBHOOK_SECRET, type = 'private') => request(telegramWebhookPath, {
    method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret },
    data: { message: { chat: { id: chat, type }, text } },
  });
  return { db, env, request, update, telegram };
}

function mockTelegram(t, { existingWebhook = '', send } = {}) {
  const messages = [];
  const settings = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.origin, 'https://api.telegram.org');
    const body = JSON.parse(init.body);
    if (endpoint.pathname.endsWith('/sendMessage')) {
      messages.push(body);
      const failure = send?.(body);
      if (failure) return Response.json(failure, { status: failure.error_code });
    }
    if (endpoint.pathname.endsWith('/setWebhook')) settings.push(body);
    const result = endpoint.pathname.endsWith('/getMe') ? { username: 'NefioFixtureBot' } :
      endpoint.pathname.endsWith('/getWebhookInfo') ? { url: existingWebhook } : true;
    return Response.json({ ok: true, result });
  });
  return { messages, settings };
}

const sampleBooking = () => ({
  id: crypto.randomUUID(), visit_date: todayOffset(1), visit_time: '18:30', party_size: 2,
  guest_name: 'Конфиденциальное имя', phone: '+375290000001', comment: 'Личный комментарий',
  telegram_code: randomBytes(24).toString('base64url'),
});

test('staff and guests connect separately, and retries keep one booking and one notification of each kind', async (t) => {
  const { db, env, request, update, telegram } = fixture(t);
  const { messages, settings } = mockTelegram(t);
  assert.equal((await request(config)).status, 401);
  assert.equal((await request(config, { method: 'POST', role: 'manager' })).status, 403);
  const ownerAction = (method, data) => request(config, { method, role: 'owner', data });
  assert.deepEqual(await (await ownerAction('GET')).json(), { ready: true, staffConnected: false, guestEnabled: false });

  const staff = new URL((await (await ownerAction('POST')).json()).telegram).searchParams.get('start');
  assert.deepEqual(settings[0], { url: origin + telegramWebhookPath, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'] });
  assert.equal((await telegram(101, '/start ' + staff, 'invalid')).status, 403);
  assert.deepEqual(await (await telegram(101, '/start ' + staff, env.TELEGRAM_WEBHOOK_SECRET, 'group')).json(), { ok: true });
  assert.match((await (await telegram(101, '/start ' + staff)).json()).text, /Чат подключён/);
  assert.match((await (await telegram(303, '/start ' + staff)).json()).text, /уже использована/);
  assert.equal((await ownerAction('PUT', { guest_enabled: true })).status, 200);
  assert.deepEqual(await (await ownerAction('GET')).json(), { ready: true, staffConnected: true, guestEnabled: true });

  const data = sampleBooking();
  const submit = (body) => request(bookingPath, { method: 'POST', data: body });
  const created = await submit(data);
  assert.equal(created.status, 201);
  const { telegram: link } = await created.json();
  assert.equal((await (await submit(data)).json()).telegram, link);
  assert.deepEqual(await (await submit({ ...data, telegram_code: sampleBooking().telegram_code })).json(), { ok: true });
  assert.equal((await update(data.id, 'confirmed')).status, 200);
  const guest = new URL(link).searchParams.get('start');
  assert.match((await (await telegram(202, '/start ' + guest)).json()).text, /Уведомления по заявке подключены/);
  assert.match((await (await telegram(303, '/start ' + guest)).json()).text, /уже использована/);
  const { id } = data;
  const reminder = db.prepare("SELECT due_at, expires_at FROM telegram_notifications WHERE subject_id=? AND kind='guest_reminder'").get(id);
  const visit = db.prepare('SELECT visit_at FROM site_bookings WHERE id=?').get(id).visit_at;
  assert.equal(visit, Date.parse(data.visit_date + 'T15:30:00Z') / 1000);
  assert.equal(reminder.due_at, visit - 7200);
  assert.equal(reminder.expires_at, visit - 900);

  const review = { id: crypto.randomUUID(), rating: 2, comment: 'Приватный текст', guest_name: 'Алина' };
  const feedback = () => request('/api/feedback/moka-coffee', { method: 'POST', data: review });
  assert.equal((await feedback()).status, 201);
  assert.equal((await feedback()).status, 201);
  await Promise.all([deliverTelegramNotifications(env), deliverTelegramNotifications(env)]);
  const staffMessages = messages.filter(({ chat_id }) => chat_id === '101');
  assert.equal(staffMessages.length, 2);
  assert.ok(staffMessages.some(({ text }) => text.includes('/admin/bookings?site=moka-coffee&id=' + data.id)));
  assert.ok(staffMessages.some(({ text }) => text.includes('/admin/feedback?site=moka-coffee&id=' + review.id)));
  const exact = await request('/api/bookings?site=moka-coffee&status=pending&id=' + data.id, { role: 'manager' });
  assert.deepEqual((await exact.json()).bookings.map((booking) => booking.id), [data.id]);
  const hidden = await request('/api/feedback?site=basilico&id=' + review.id, { role: 'manager' });
  assert.deepEqual((await hidden.json()).reviews, []);
  const sent = JSON.stringify(messages);
  assert.doesNotMatch(sent, /Конфиденциальное имя|375290000001|Приватный текст|Личный комментарий/);
  assert.match(messages.find(({ chat_id }) => chat_id === '202').text, /Бронь столика подтверждена.*\n.*18:30/);
  assert.equal((await update(id, 'cancelled')).status, 200);
  db.prepare("UPDATE telegram_notifications SET due_at=0 WHERE subject_id=? AND kind='guest_reminder'").run(id);
  await deliverTelegramNotifications(env);
  assert.equal(messages.filter(({ text }) => text.includes('отменена')).length, 1);
  assert.equal(messages.filter(({ text }) => text.includes('Напоминание')).length, 0);
});

test('delivery retries throttled events, sends due reminders and respects guest opt-out', async (t) => {
  const { db, env, request, update, telegram } = fixture(t);
  let throttle = true;
  const { messages } = mockTelegram(t, { send(body) {
    if (!body.text.startsWith('Новая заявка') || !throttle) return;
    throttle = false;
    return { ok: false, error_code: 429, parameters: { retry_after: 120 } };
  } });
  db.prepare("INSERT INTO site_notifications (site_id, guest_enabled, staff_chat_id) VALUES ('moka', 1, '101')").run();
  const data = sampleBooking();
  await request(bookingPath, { method: 'POST', data });
  await telegram(202, '/start guest_' + data.telegram_code);
  await update(data.id, 'confirmed');
  await deliverTelegramNotifications(env);
  const pending = db.prepare("SELECT done, due_at FROM telegram_notifications WHERE subject_id=? AND kind='staff_booking'").get(data.id);
  assert.equal(pending.done, 0);
  assert.ok(pending.due_at >= now() + 118);
  db.prepare("UPDATE telegram_notifications SET due_at=0 WHERE subject_id=? AND kind IN ('guest_reminder','staff_booking')").run(data.id);
  await deliverTelegramNotifications(env);
  assert.equal(messages.filter(({ text }) => text.includes('Напоминание')).length, 1);
  assert.equal(messages.filter(({ text }) => text.includes('Новая заявка')).length, 2);
  await telegram(202, '/stop');
  await update(data.id, 'cancelled');
  await deliverTelegramNotifications(env);
  assert.equal(messages.filter(({ text }) => text.includes('отменена')).length, 0);
});

test('setup leaves a bot already attached to another application alone', async (t) => {
  const { request } = fixture(t);
  const { settings } = mockTelegram(t, { existingWebhook: 'https://external.example.test/hook' });
  assert.equal((await request(config, { method: 'POST', role: 'owner' })).status, 409);
  assert.deepEqual(settings, []);
});
