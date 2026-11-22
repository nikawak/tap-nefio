import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';
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

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  for (const { tag } of JSON.parse(read('drizzle/meta/_journal.json')).entries) db.exec(read('drizzle/' + tag + '.sql'));
  seedDemo(db);
  const app = createApp(readAssets());
  const prepare = (sql, args = []) => ({
    bind: (...values) => prepare(sql, values),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: db.prepare(sql).run(...args) }),
  });
  const env = { DB: { prepare }, OWNER_EMAIL: owner, GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret' };
  function request(path, { chatgptEmail, cookie, method = 'GET', body } = {}) {
    const headers = { origin };
    if (cookie) headers.cookie = cookie;
    if (body) headers['content-type'] = 'application/json';
    if (chatgptEmail) {
      headers['oai-authenticated-user-id'] = 'test-chatgpt-id';
      headers['oai-authenticated-user-email'] = chatgptEmail;
    }
    return app.fetch(new Request(origin + path, { headers, method, body: body && JSON.stringify(body) }), env);
  }

  let claims;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.redirect, 'manual');
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const input = encode({ alg: 'RS256', kid: jwk.kid }) + '.' + encode(claims);
    return Response.json({ id_token: input + '.' + sign('sha256', Buffer.from(input), privateKey).toString('base64url') });
  });

  async function googleLogin(email, { chatgptEmail, cookie } = {}) {
    const start = await request('/auth/google');
    const auth = new URL(start.headers.get('location'));
    const flowCookie = start.headers.getSetCookie()[0].split(';')[0];
    const iat = Math.floor(Date.now() / 1000);
    claims = { iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, sub: 'google-fixture',
      nonce: auth.searchParams.get('nonce'), iat, exp: iat + 900, email, email_verified: true };
    return request('/auth/google/return?code=fixture&state=' + auth.searchParams.get('state'), {
      chatgptEmail, cookie: cookie ? flowCookie + '; ' + cookie : flowCookie,
    });
  }
  return { db, request, googleLogin, env };
}

test('only the owner’s ChatGPT identity gets the owner role', async (t) => {
  const { db, request, googleLogin } = fixture(t);
  // Emulate a Google session and assignment saved before enforcing the provider restriction.
  const token = 'A'.repeat(43);
  const hash = createHash('sha256').update(token).digest('base64url');
  db.prepare('INSERT INTO google_sessions VALUES (?, ?, ?, ?)').run(hash, owner, 'Owner', Math.floor(Date.now() / 1000) + 900);
  db.prepare('INSERT INTO site_admins VALUES (?, ?)').run('moka', owner);
  const cookie = sessionCookie + '=' + token;
  assert.equal((await request('/api/sites', { cookie })).status, 401);
  const { user, sites } = await (await request('/api/sites', { cookie, chatgptEmail: owner })).json();
  assert.equal(user.role, 'owner');
  assert.equal(user.provider, 'chatgpt');
  assert.equal(sites.length, 3);
  const denied = await googleLogin(owner, { cookie, chatgptEmail: owner });
  assert.equal(denied.headers.get('location'), '/admin?google=owner');
  assert.ok(denied.headers.getSetCookie().some((line) => line.startsWith(sessionCookie + '=;')));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM google_sessions').get().count, 0);
  assert.equal((await request('/api/sites', { chatgptEmail: stranger })).status, 401);
});

test('Google login requires a current assignment and scopes every operation to it', async (t) => {
  const { db, request, googleLogin } = fixture(t);
  const rejected = await googleLogin(stranger);
  assert.equal(rejected.headers.get('location'), '/admin?google=denied');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM google_sessions').get().count, 0);

  db.prepare('INSERT INTO site_admins VALUES (?, ?)').run('moka', manager);
  const chatgpt = await (await request('/api/sites', { chatgptEmail: manager })).json();
  assert.equal(chatgpt.user.role, 'manager');
  assert.deepEqual(chatgpt.sites.map(({ slug }) => slug), ['moka-coffee']);
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
  assert.equal((await request('/api/sites/moka-coffee/admins/' + encodeURIComponent(manager), { chatgptEmail: owner, method: 'DELETE' })).status, 200);
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

test('the panel shows a rejected Google login even with an existing ChatGPT sign-in', async () => {
  const code = read('public/app.js');
  const app = { innerHTML: '' };
  const elements = { '#app': app, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
  await runInNewContext(code, {
    document: { querySelector: (selector) => elements[selector] },
    location: { pathname: '/admin', search: '?google=owner' },
    URLSearchParams, FormData,
    fetch: async () => Response.json({ user: { role: 'owner', provider: 'chatgpt' }, ownerConfigured: true, googleAvailable: true }),
  });
  assert.match(app.innerHTML, /Для входа владельца используйте ChatGPT/);
  assert.match(app.innerHTML, /Войти через ChatGPT/);
});
