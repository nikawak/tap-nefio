import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';
import { databaseBinding } from '../scripts/node-runtime.mjs';
import { createApp } from '../src/worker.js';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const origin = 'https://tap.example.test';
const owner = 'owner@gmail.com';
const manager = 'manager@gmail.com';
const stranger = 'stranger@gmail.com';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture-key', alg: 'RS256' };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sessionCookie = '__Host-tap-session';
const adminPhone = '+375291234567';
const signInCookie = (response) => response.headers.getSetCookie().find((line) => line.startsWith(sessionCookie + '='))?.split(';')[0];
const profile = { email: manager, first_name: 'Анна', last_name: 'Орлова', phone: adminPhone, telegram_username: '@anna_test' };

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  for (const { tag } of JSON.parse(read('drizzle/meta/_journal.json')).entries) db.exec(read('drizzle/' + tag + '.sql'));
  seedDemo(db);
  const app = createApp(readAssets());
  const env = {
    DB: databaseBinding(db), OWNER_EMAIL: owner, GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret',
    TELEGRAM_CLIENT_ID: '12345', TELEGRAM_CLIENT_SECRET: 'telegram-secret', PHONE_CODE_SECRET: 'B'.repeat(43),
    MESSAGGIO_LOGIN: 'fixture-login', MESSAGGIO_SMS_SENDER: 'sms-sender', MESSAGGIO_VIBER_SENDER: 'viber-sender',
  };
  const deliveries = [];
  const jobs = [];
  function request(path, { chatgptEmail, cookie, method = 'GET', body, requestOrigin = origin, fetchSite } = {}) {
    const headers = { origin: requestOrigin };
    if (fetchSite) headers['sec-fetch-site'] = fetchSite;
    if (cookie) headers.cookie = cookie;
    if (body) headers['content-type'] = 'application/json';
    if (chatgptEmail) {
      headers['oai-authenticated-user-id'] = 'test-chatgpt-id';
      headers['oai-authenticated-user-email'] = chatgptEmail;
    }
    return app.fetch(new Request(origin + path, { headers, method, body: body && JSON.stringify(body) }), env,
      { waitUntil: (job) => jobs.push(job) });
  }

  let claims;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if (url === 'https://msg.messaggio.com/api/v1/send') {
      assert.equal(options.headers['Messaggio-Login'], env.MESSAGGIO_LOGIN);
      deliveries.push(JSON.parse(options.body));
      return Response.json({ accepted: true });
    }
    if (['https://www.googleapis.com/oauth2/v3/certs', 'https://oauth.telegram.org/.well-known/jwks.json'].includes(url)) {
      return Response.json({ keys: [jwk] });
    }
    assert.ok(['https://oauth2.googleapis.com/token', 'https://oauth.telegram.org/token'].includes(url));
    if (url === 'https://oauth.telegram.org/token') assert.match(options.headers.Authorization, /^Basic /);
    const input = encode({ alg: 'RS256', kid: jwk.kid }) + '.' + encode(claims);
    return Response.json({ id_token: input + '.' + sign('sha256', Buffer.from(input), privateKey).toString('base64url') });
  });

  async function oauthLogin(provider, extra, wrongState = false) {
    const start = await request('/auth/' + provider);
    const auth = new URL(start.headers.get('location'));
    const flowCookie = start.headers.getSetCookie()[0].split(';')[0];
    const iat = Math.floor(Date.now() / 1000);
    claims = { iss: provider === 'google' ? 'https://accounts.google.com' : 'https://oauth.telegram.org',
      aud: provider === 'google' ? env.GOOGLE_CLIENT_ID : env.TELEGRAM_CLIENT_ID, sub: 'signed-user',
      nonce: auth.searchParams.get('nonce'), iat, exp: iat + 900, ...extra };
    return request('/auth/' + provider + '/return?code=fixture&state=' + (wrongState ? 'wrong' : auth.searchParams.get('state')),
      { cookie: flowCookie });
  }
  const googleLogin = (email) => oauthLogin('google', { email, email_verified: true });
  return { db, request, googleLogin, oauthLogin, env, deliveries, jobs };
}

test('Google preserves existing owner sessions and ChatGPT headers grant no access', async (t) => {
  const { db, request, googleLogin } = fixture(t);
  // Tokens already issued by the standalone version remain valid after the migration.
  const token = 'A'.repeat(43);
  const hash = createHash('sha256').update(token).digest('base64url');
  db.prepare('INSERT INTO google_sessions (token_hash,email,name,expires_at) VALUES (?, ?, ?, ?)').run(hash, owner, 'Owner', Math.floor(Date.now() / 1000) + 900);
  const cookie = sessionCookie + '=' + token;
  assert.equal((await request('/api/sites', { chatgptEmail: owner })).status, 401);
  assert.equal((await request('/api/sites', { cookie })).status, 200);
  const { user, sites } = await (await request('/api/sites', { cookie, chatgptEmail: owner })).json();
  assert.equal(user.role, 'owner');
  assert.equal(user.provider, 'google');
  assert.equal(sites.length, 3);
  const login = await googleLogin(owner);
  assert.equal(login.headers.get('location'), '/admin');
  assert.ok(signInCookie(login));
  assert.equal((await request('/api/sites', { chatgptEmail: stranger })).status, 401);
});

test('Google login requires a current assignment and scopes every operation to it', async (t) => {
  const { db, request, googleLogin } = fixture(t);
  const rejected = await googleLogin(stranger);
  assert.equal(rejected.headers.get('location'), '/admin?google=denied');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM google_sessions').get().count, 0);

  db.prepare('INSERT INTO site_admins VALUES (?, ?)').run('moka', manager);
  assert.equal((await request('/api/sites', { chatgptEmail: manager })).status, 401);
  const accepted = await googleLogin(manager);
  assert.equal(accepted.headers.get('location'), '/admin');
  const cookie = accepted.headers.getSetCookie().find((line) => line.startsWith(sessionCookie + '='))?.split(';')[0];
  assert.ok(cookie);
  const { user, sites } = await (await request('/api/sites', { cookie, chatgptEmail: owner })).json();
  assert.equal(user.role, 'manager');
  assert.equal(user.provider, 'google');
  assert.deepEqual(sites.map(({ slug }) => slug), ['moka-coffee']);
  assert.deepEqual((await (await request('/api/overview', { cookie })).json()).sites.map(({ slug }) => slug), ['moka-coffee']);
  assert.equal((await request('/api/overview?site=basilico', { cookie })).status, 404);
  assert.equal((await request('/api/sites/basilico/items', { cookie, method: 'POST', body: {} })).status, 404);
  assert.equal((await request('/forma-studio', { cookie })).status, 404);
  assert.equal((await request('/api/sites', { cookie, method: 'POST', body: {} })).status, 403);
  assert.equal((await request('/api/sites/moka-coffee/admins', { cookie, method: 'POST', body: {} })).status, 403);
  const item = { name: 'Кофе', category: 'Напитки', price: 500, available: true };
  assert.equal((await request('/api/sites/moka-coffee/items', { cookie, method: 'POST', body: item })).status, 201);
  const ownerCookie = signInCookie(await googleLogin(owner));
  assert.equal((await request('/api/sites/moka-coffee/admins/' + encodeURIComponent(manager), { cookie: ownerCookie, method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/sites', { cookie })).status, 401);
  db.prepare('INSERT INTO site_admins VALUES (?, ?)').run('moka', manager);
  assert.equal((await request('/api/sites', { cookie })).status, 401);
});

test('the standalone server requires a verified Google session for the owner', async (t) => {
  const { request, googleLogin, env } = fixture(t);
  env.SELF_HOSTED = true;
  assert.equal((await request('/api/sites', { chatgptEmail: owner })).status, 401);
  const accepted = await googleLogin(owner);
  assert.equal(accepted.headers.get('location'), '/admin');
  const cookie = accepted.headers.getSetCookie().find((line) => line.startsWith(sessionCookie + '='))?.split(';')[0];
  assert.ok(cookie);
  const { user } = await (await request('/api/sites', { cookie })).json();
  assert.equal(user.role, 'owner');
  assert.equal(user.provider, 'google');
  env.OWNER_EMAIL = stranger;
  assert.equal((await request('/api/sites', { cookie })).status, 401);
});

test('signout clears both login flows and revokes the session', async (t) => {
  const { request, googleLogin } = fixture(t);
  const cookie = signInCookie(await googleLogin(owner));
  const blocked = await request('/auth/signout', { method: 'POST', cookie, body: {}, requestOrigin: 'https://elsewhere.test' });
  assert.equal(blocked.status, 403);
  assert.equal((await request('/api/sites', { cookie })).status, 200);
  const done = await request('/auth/signout', { method: 'POST', cookie, body: {}, requestOrigin: 'null', fetchSite: 'same-origin' });
  assert.equal(done.status, 200);
  assert.deepEqual(await done.json(), { ok: true });
  assert.equal(done.headers.getSetCookie().length, 3);
  assert.ok(done.headers.getSetCookie().every((value) => value.includes('Max-Age=0')));
  assert.equal((await request('/api/sites', { cookie })).status, 401);
  assert.equal((await request('/auth/signout', { method: 'POST' })).headers.get('location'), '/admin');
});

test('the owner can complete existing profiles and assign a phone to a single account', async (t) => {
  const { db, request, googleLogin } = fixture(t);
  const cookie = signInCookie(await googleLogin(owner));
  const site = '/api/sites/moka-coffee';
  db.prepare('INSERT INTO site_admins VALUES (?, ?)').run('moka', manager);
  const old = await (await request(site, { cookie })).json();
  assert.deepEqual(old.admins.find((entry) => entry.email === manager), {
    email: manager, first_name: null, last_name: null, phone: null, telegram_username: null,
  });
  const edit = await request(site + '/admins/' + encodeURIComponent(manager), { cookie, method: 'PUT', body: profile });
  assert.equal(edit.status, 200);
  const saved = await (await request(site, { cookie })).json();
  assert.deepEqual(saved.admins.find((entry) => entry.email === manager), { ...profile, telegram_username: 'anna_test' });
  const target = '/api/sites/basilico/admins';
  const duplicate = await request(target, { cookie, method: 'POST', body: { ...profile, email: stranger } });
  assert.equal(duplicate.status, 409);
  assert.equal((await request(target, { cookie, method: 'POST', body: { ...profile, phone: '+79990000000' } })).status, 400);
  assert.equal((await request(target, { cookie, method: 'POST', body: profile })).status, 201);
  await request(target + '/' + encodeURIComponent(manager), { cookie, method: 'DELETE' });
  assert.equal(db.prepare('SELECT phone FROM admin_profiles WHERE email=?').get(manager).phone, adminPhone);
});

test('SMS and Viber codes are limited to assigned phones, expire and can only be used once', async (t) => {
  const { db, request, googleLogin, deliveries, jobs } = fixture(t);
  const cookie = signInCookie(await googleLogin(owner));
  const admins = '/api/sites/moka-coffee/admins';
  assert.equal((await request(admins, { cookie, method: 'POST', body: profile })).status, 201);
  const start = (channel, phone) => request('/auth/phone/start', { method: 'POST', body: { channel, phone } });
  const verify = (challenge, code) => request('/auth/phone/verify', { method: 'POST', body: { challenge, code } });
  const unknown = await start('sms', '+375291000000');
  assert.equal(unknown.status, 202);
  assert.match((await unknown.json()).challenge, /^[a-zA-Z0-9_-]{43}$/);
  assert.equal(deliveries.length, 0);

  const issued = await (await start('sms', adminPhone)).json();
  await Promise.all(jobs);
  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0].recipients, [{ phone: adminPhone.slice(1) }]);
  const code = deliveries[0].sms.content[0].text.match(/\d{6}$/)[0];
  assert.deepEqual(Object.keys(issued).sort(), ['challenge', 'retryIn']);
  assert.equal(db.prepare('SELECT length(code_hash) AS length FROM phone_login_codes WHERE id=?').get(issued.challenge).length, 43);
  await start('viber', adminPhone);
  assert.equal(deliveries.length, 1);
  const results = await Promise.all([verify(issued.challenge, code), verify(issued.challenge, code)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
  const smsCookie = signInCookie(results.find((result) => result.status === 200));
  assert.equal((await (await request('/api/session', { cookie: smsCookie })).json()).user.provider, 'sms');

  db.prepare('UPDATE phone_login_codes SET created_at=created_at-61').run();
  const second = await (await start('viber', adminPhone)).json();
  await Promise.all(jobs);
  assert.deepEqual(deliveries[1].channels, ['viber']);
  assert.equal(deliveries[1].viber.label, 'transaction');
  const viberCode = deliveries[1].viber.content[0].text.match(/\d{6}$/)[0];
  db.prepare('UPDATE phone_login_codes SET expires_at=0 WHERE id=?').run(second.challenge);
  assert.equal((await verify(second.challenge, viberCode)).status, 400);
  db.prepare('UPDATE phone_login_codes SET created_at=created_at-61').run();
  const third = await (await start('viber', adminPhone)).json();
  await Promise.all(jobs);
  const newViberCode = deliveries[2].viber.content[0].text.match(/\d{6}$/)[0];
  const viberSession = await verify(third.challenge, newViberCode);
  assert.equal(viberSession.status, 200);
  const viberCookie = signInCookie(viberSession);
  assert.equal((await (await request('/api/session', { cookie: viberCookie })).json()).user.provider, 'viber');
  const updated = await request(admins + '/' + encodeURIComponent(manager),
    { cookie, method: 'PUT', body: { ...profile, phone: '+375331000000' } });
  assert.equal(updated.status, 200);
  assert.equal((await request('/api/sites', { cookie: smsCookie })).status, 401);
  assert.equal((await request('/api/sites', { cookie: viberCookie })).status, 401);
});

test('Telegram accepts a signed assigned phone and ignores a matching nickname on a different number', async (t) => {
  const { request, googleLogin, oauthLogin } = fixture(t);
  const cookie = signInCookie(await googleLogin(owner));
  await request('/api/sites/moka-coffee/admins', { cookie, method: 'POST', body: profile });
  const denied = await oauthLogin('telegram', { phone_number: '+375331000000', preferred_username: 'anna_test' });
  assert.equal(denied.headers.get('location'), '/admin?telegram=denied');
  const unauthorized = await oauthLogin('telegram', { phone_number: adminPhone }, true);
  assert.equal(unauthorized.headers.get('location'), '/admin?telegram=expired');
  const approved = await oauthLogin('telegram', { phone_number: adminPhone, preferred_username: 'other' });
  assert.equal(approved.headers.get('location'), '/admin');
  const { user, sites } = await (await request('/api/sites', { cookie: signInCookie(approved) })).json();
  assert.equal(user.provider, 'telegram');
  assert.equal(user.name, 'Анна Орлова');
  assert.deepEqual(sites.map(({ slug }) => slug), ['moka-coffee']);
});

test('the login page offers configured providers with a fixed Belarus phone prefix', async () => {
  const code = read('public/app.js');
  const app = { innerHTML: '' };
  const elements = { '#app': app, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
  await runInNewContext(code, {
    document: { querySelector: (selector) => elements[selector] },
    location: { pathname: '/admin', search: '?google=denied' },
    URLSearchParams, FormData,
    fetch: async () => Response.json({ user: null, ownerConfigured: true,
      googleAvailable: true, telegramAvailable: true, smsAvailable: true, viberAvailable: true }),
  });
  assert.doesNotMatch(app.innerHTML, /ChatGPT/);
  assert.match(app.innerHTML, /Войти через Google/);
  assert.match(app.innerHTML, /Войти через Telegram/);
  assert.match(app.innerHTML, /Получить SMS/);
  assert.match(app.innerHTML, /Получить код в Viber/);
  assert.match(app.innerHTML, /<span aria-hidden="true">\+375<\/span>/);
  assert.match(app.innerHTML, /name="phone_digits".*pattern="\[0-9\]\{9\}" maxlength="9"/);
});
