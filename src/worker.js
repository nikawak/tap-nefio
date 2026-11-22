const actionColumns = { maps: 'maps_url', telegram: 'telegram_url', instagram: 'instagram_url', vk: 'vk_url' };
const contactColumns = Object.values(actionColumns);
const currencies = ['BYN', 'RUB', 'KZT', 'USD', 'EUR'];
const themes = [
  'light', 'dark', 'coffee', 'slate', 'garden', 'indigo', 'lavender', 'peach', 'sand', 'walnut',
  'sage', 'mint', 'pine', 'ocean', 'sky', 'steel', 'graphite', 'berry', 'plum', 'rose',
  'coral', 'honey', 'lemon', 'clay', 'copper',
];
const reserved = new Set(['admin', 'api', 'assets', 'auth', 'callback', 'signin-with-chatgpt', 'signout-with-chatgpt', 'favicon.ico']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nfcPath = /^\/(?:([a-z0-9-]+)\/)?nfc=([A-Za-z0-9_-]{1,128})\/?$/;
const photoPrefix = '/assets/menu-photos/';
const sitePhotoPrefix = '/assets/site-photos/';
const photoKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const photoTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const photoLimit = 6 * 1024 * 1024;
const sitePhotoSlots = ['logo', 'cover'];
const itemOrder = 'items.sort_order IS NULL, items.sort_order, items.created_at, items.name, items.id';
const itemChanged = 'Позицию уже изменили или удалили. Закройте форму и проверьте обновлённое меню.';
const linkTips = {
  alpha: { label: '«нетмонет» · Альфа-Банк', domains: ['alfabank.by'] },
  moneyapp: { label: 'MoneyApp · БСБ Банк', domains: ['bsb.by'] },
  teacode: { label: '«Чай-код» · Беларусбанк', domains: ['belarusbank.by'] },
  'bepaid-link': { label: 'Платёжная ссылка bePaid', domains: ['bepaid.by'] },
};
const checkoutMethod = 'bepaid';
const checkoutTitle = 'Оплата картой через bePaid';
const checkoutOrigin = 'https://checkout.bepaid.by';
const checkoutEndpoint = checkoutOrigin + '/ctp/api/checkouts';
const tipIntentLifetime = 900;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sessionCookie = '__Host-tap-session';
const flowAge = 600;
const sessionAge = 8 * 3600;
const codeAge = 300;
const codeRetry = 60;
const codeAttemptLimit = 5;
const oidcProviders = {
  google: {
    authorization: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
    keys: 'https://www.googleapis.com/oauth2/v3/certs', issuers: ['https://accounts.google.com', 'accounts.google.com'],
    scope: 'openid email profile', clientId: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET',
  },
  telegram: {
    authorization: 'https://oauth.telegram.org/auth', token: 'https://oauth.telegram.org/token',
    keys: 'https://oauth.telegram.org/.well-known/jwks.json', issuers: ['https://oauth.telegram.org'],
    scope: 'openid profile phone', clientId: 'TELEGRAM_CLIENT_ID', secret: 'TELEGRAM_CLIENT_SECRET',
  },
};
const messageSenders = { sms: 'MESSAGGIO_SMS_SENDER', viber: 'MESSAGGIO_VIBER_SENDER' };
const googleProviderErrors = new Set(['invalid_client', 'invalid_grant', 'invalid_request', 'redirect_uri_mismatch',
  'unauthorized_client', 'unsupported_grant_type', 'invalid_scope', 'access_denied', 'server_error', 'temporarily_unavailable']);
const googleTokenFailures = new Set(['keys_network', 'keys_http', 'keys_response', 'unknown_signing_key',
  'invalid_id_token', 'invalid_id_token_header', 'invalid_signature', 'invalid_claims']);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const signingKeys = new Map();
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Minsk', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (date = new Date()) => dayFmt.format(date);
const todayOffset = (days) => new Date(Date.parse(dayKey() + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const newId = () => crypto.randomUUID();
const q = (db, sql, ...values) => values.length ? db.prepare(sql).bind(...values) : db.prepare(sql);
const all = async (db, sql, ...values) => (await q(db, sql, ...values).all()).results;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
function redirect(url, cookies = []) {
  const headers = new Headers({ Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}
const findSite = (db, slug) => q(db, 'SELECT * FROM sites WHERE slug = ?', slug).first();
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const oidcReady = (provider, env, url) => !!(url.protocol === 'https:' && env[provider.clientId]?.trim() && env[provider.secret]?.trim());
const googleReady = (env, url) => oidcReady(oidcProviders.google, env, url);
const messagesReady = (channel, env, url) => !!(url.protocol === 'https:' && validToken(env.PHONE_CODE_SECRET)
  && env.MESSAGGIO_LOGIN?.trim() && Object.hasOwn(messageSenders, channel) && env[messageSenders[channel]]?.trim());
const belarusPhone = (value) => typeof value === 'string' && /^\+375[0-9]{9}$/.test(value) ? value : '';
function googleNetworkReason(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  const message = String(error?.message ?? '');
  if (/blocked|denied|forbidden|not allowed|restricted|egress|outbound/i.test(message)) return 'outbound_restricted';
  if (/content.type|bodyinit|body|serialize/i.test(message)) return 'request_body';
  return 'network';
}
const nowSeconds = () => Math.floor(Date.now() / 1000);
const hasTipKey = (env) => /^[A-Za-z0-9_-]{43}$/.test(env.TIP_ENCRYPTION_KEY || '');

function actorFor(email, name, provider, role = 'manager') {
  return { role, name: name || email.split('@')[0], email, demo: false, provider };
}

function siteAssignment(db, email) {
  return q(db, 'SELECT 1 FROM site_admins WHERE email=? LIMIT 1', email).first();
}

function isOwnerEmail(env, email) {
  return !!email && [env.OWNER_EMAIL, env.OWNER_SECOND_EMAIL].some((value) => normalizeEmail(value) === email);
}

async function accountRole(env, email) {
  if (isOwnerEmail(env, email)) return 'owner';
  return await siteAssignment(env.DB, email) ? 'manager' : null;
}

async function accountForPhone(env, phone) {
  if (!belarusPhone(phone)) return null;
  const owner = normalizeEmail(env.OWNER_EMAIL);
  const assigned = await q(env.DB, `SELECT p.email, p.first_name || ' ' || p.last_name AS name FROM admin_profiles p
    WHERE p.phone=? AND EXISTS (SELECT 1 FROM site_admins a WHERE a.email=p.email)`, phone).first();
  if (assigned && isOwnerEmail(env, assigned.email)) return null;
  if (!assigned && owner && phone === belarusPhone(env.OWNER_PHONE)) return { email: owner, name: 'Владелец' };
  return assigned;
}

async function actor(request, env) {
  if (env.DEMO_MODE) {
    if (request.headers.get('x-demo-role') === 'manager') return { role: 'manager', name: 'Анна', email: 'manager@demo.tap', demo: true };
    return { role: 'owner', name: 'Владелец', email: 'owner@demo.tap', demo: true };
  }
  const token = readCookie(request, sessionCookie);
  if (!validToken(token) || new URL(request.url).protocol !== 'https:') return null;
  const session = await q(env.DB, "SELECT s.email, COALESCE(p.first_name || ' ' || p.last_name, s.name) AS name, s.provider, s.phone " +
    'FROM google_sessions s LEFT JOIN admin_profiles p ON p.email=s.email WHERE s.token_hash=? AND s.expires_at>?',
    await digest(token), nowSeconds()).first();
  if (!session) return null;
  if (session.phone && (await accountForPhone(env, session.phone))?.email !== session.email) return null;
  const role = await accountRole(env, session.email);
  return role ? actorFor(session.email, session.name, session.provider, role) : null;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (part) => part.charCodeAt(0));
}

const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const digest = async (value) => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
const validToken = (value) => /^[A-Za-z0-9_-]{43}$/.test(value ?? '');
const authCookie = (name, value, age) => name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;

function readCookie(request, name) {
  const prefix = name + '=';
  return request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function sameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (origin === url.origin) return;
  if ((!origin || origin === 'null') && request.headers.get('sec-fetch-site') === 'same-origin') return;
  fail(403, 'Откройте панель и повторите действие.');
}

async function revokeSession(request, db) {
  const token = readCookie(request, sessionCookie);
  if (validToken(token)) await q(db, 'DELETE FROM google_sessions WHERE token_hash=?', await digest(token)).run();
}

async function createSession(request, env, profile, provider, phone = '') {
  await revokeSession(request, env.DB);
  const token = randomToken();
  const now = nowSeconds();
  await q(env.DB, 'DELETE FROM google_sessions WHERE expires_at<=?', now).run();
  await q(env.DB, 'INSERT INTO google_sessions (token_hash, email, name, expires_at, provider, phone) VALUES (?, ?, ?, ?, ?, ?)',
    await digest(token), profile.email, profile.name, now + sessionAge, provider, phone).run();
  return authCookie(sessionCookie, token, sessionAge);
}

const flowCookieName = (provider) => '__Host-tap-' + provider + '-flow';

async function signOut(request, url, env) {
  if (request.method !== 'POST') fail(405, 'Действие недоступно.');
  sameOrigin(request, url);
  await revokeSession(request, env.DB);
  const cookies = [sessionCookie, ...Object.keys(oidcProviders).map(flowCookieName)].map((name) => authCookie(name, '', 0));
  if (!request.headers.get('content-type')?.startsWith('application/json')) return redirect('/admin', cookies);
  const response = json({ ok: true });
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}

async function signingKey(provider, kid) {
  let cache = signingKeys.get(provider.keys);
  if (!cache || Date.now() >= cache.expires || !cache.keys.some((key) => key.kid === kid)) {
    const response = await fetch(provider.keys, {
      redirect: 'manual', signal: AbortSignal.timeout(10000),
    }).catch(() => { throw new Error('keys_network'); });
    if (!response.ok) throw new Error('keys_http');
    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload?.keys)) throw new Error('keys_response');
    const ttl = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 60);
    cache = { keys: payload.keys, expires: Date.now() + Math.min(ttl, 86400) * 1000 };
    signingKeys.set(provider.keys, cache);
  }
  return cache.keys.find((key) => key.kid === kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
}

async function verifiedClaims(provider, token, audience, nonce, requireNonce) {
  const parts = typeof token === 'string' && token.length <= 12000 ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('invalid_id_token');
  const [header, payload, signature] = parts;
  const { alg, kid } = JSON.parse(decoder.decode(fromBase64url(header)));
  if (alg !== 'RS256' || typeof kid !== 'string') throw new Error('invalid_id_token_header');
  const jwk = await signingKey(provider, kid);
  if (!jwk) throw new Error('unknown_signing_key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(signature), encoder.encode(header + '.' + payload));
  if (!verified) throw new Error('invalid_signature');
  const claims = JSON.parse(decoder.decode(fromBase64url(payload)));
  const { iss, aud, azp, exp, iat, sub } = claims;
  const now = nowSeconds();
  const validAudience = aud === audience || (Array.isArray(aud) && aud.length === 1 && aud[0] === audience);
  if (!provider.issuers.includes(iss) || !validAudience || (azp && azp !== audience)
      || ((requireNonce || claims.nonce !== undefined) && claims.nonce !== nonce)
      || !Number.isSafeInteger(exp) || exp <= now || !Number.isSafeInteger(iat) || iat > now + 60 || iat < now - flowAge
      || typeof sub !== 'string' || !sub) throw new Error('invalid_claims');
  return claims;
}

function googleProfile(claims) {
  const email = typeof claims.email === 'string' ? normalizeEmail(claims.email) : '';
  const googleManaged = email.endsWith('@gmail.com') || (typeof claims.hd === 'string' && !!claims.hd);
  if (!emailPattern.test(email) || email.length > 254 || claims.email_verified !== true || !googleManaged) return null;
  const name = typeof claims.name === 'string' ? claims.name.trim().slice(0, 150) : '';
  return { email, name };
}

async function oidcAuth(request, url, env, id) {
  if (request.method !== 'GET') fail(405, 'Действие недоступно.');
  const provider = oidcProviders[id];
  const isGoogle = id === 'google';
  const flowCookie = flowCookieName(id);
  const returnPath = '/auth/' + id + '/return';
  const redirectUri = new URL(returnPath, url.origin).href;
  const abort = (reason) => redirect('/admin?' + id + '=' + reason, [authCookie(flowCookie, '', 0)]);
  if (!oidcReady(provider, env, url)) return abort('unavailable');
  const clientId = env[provider.clientId].trim();
  const clientSecret = env[provider.secret].trim();

  if (url.pathname !== returnPath) {
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const auth = new URL(provider.authorization);
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
      scope: provider.scope, state, code_challenge: await digest(verifier), code_challenge_method: 'S256' });
    if (isGoogle) params.set('prompt', 'select_account');
    params.set('nonce', nonce);
    auth.search = params;
    return redirect(auth.href, [authCookie(flowCookie, [state, nonce, verifier].join('.'), flowAge)]);
  }

  const [state, nonce, verifier, extra] = (readCookie(request, flowCookie) || '').split('.');
  if (extra !== undefined || ![state, nonce, verifier].every(validToken) || state !== url.searchParams.get('state')) return abort('expired');
  if (url.searchParams.has('error')) return abort('cancelled');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) return abort('expired');
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId,
    code_verifier: verifier, redirect_uri: redirectUri });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (isGoogle) body.set('client_secret', clientSecret);
  else headers.Authorization = 'Basic ' + btoa(clientId + ':' + clientSecret);
  let response;
  try {
    response = await fetch(provider.token, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000), headers, body: body.toString(),
    });
  } catch (error) {
    console.warn(id + ' OAuth failed: token_network ' + googleNetworkReason(error));
    return abort('failed');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = googleProviderErrors.has(payload?.error) ? payload.error : 'unknown';
    console.warn(id + ' OAuth failed: token_http ' + response.status + ' ' + reason);
    return abort('failed');
  }

  let claims;
  try {
    claims = await verifiedClaims(provider, payload?.id_token, clientId, nonce, isGoogle);
  } catch (error) {
    const reason = googleTokenFailures.has(error?.message) ? error.message : 'id_token_processing';
    console.warn(id + ' OAuth failed: ' + reason);
    return abort('failed');
  }

  let phone = '';
  if (!isGoogle) {
    const number = typeof claims.phone_number === 'string' ? claims.phone_number.trim() : '';
    if (!number || (claims.phone_number_verified !== undefined && claims.phone_number_verified !== true)) return abort('phone');
    // Telegram can return a verified international number without the leading plus.
    phone = belarusPhone(number.startsWith('+') ? number : '+' + number);
    if (!phone) return abort('country');
  }
  const profile = isGoogle ? googleProfile(claims) : await accountForPhone(env, phone);
  if (!profile || !await accountRole(env, profile.email)) return abort(isGoogle && !profile ? 'email' : 'denied');
  return redirect('/admin', [authCookie(flowCookie, '', 0), await createSession(request, env, profile, id, phone)]);
}

function randomCode() {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 4294000000);
  return String(value[0] % 1000000).padStart(6, '0');
}

function codeKey(env) {
  return crypto.subtle.importKey('raw', fromBase64url(env.PHONE_CODE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sendPhoneCode(env, channel, phone, code, id) {
  const message = { from: env[messageSenders[channel]].trim(), content: [{ type: 'text', text: 'Тап. Код входа: ' + code }] };
  if (channel === 'viber') message.label = 'transaction';
  const response = await fetch('https://msg.messaggio.com/api/v1/send', {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', 'Messaggio-Login': env.MESSAGGIO_LOGIN.trim() },
    body: JSON.stringify({ recipients: [{ phone: phone.slice(1) }], channels: [channel],
      options: { ttl: codeAge, external_id: id }, [channel]: message }),
  });
  if (!response.ok) throw new Error('Message provider rejected the request.');
  await q(env.DB, 'UPDATE phone_login_codes SET delivered=1 WHERE id=?', id).run();
}

async function startPhoneLogin(props, url, env, ctx) {
  const { channel } = props;
  if (!messagesReady(channel, env, url)) fail(503, 'Этот способ входа пока недоступен.');
  const phone = belarusPhone(props.phone);
  if (!phone) fail(400, 'Введите девять цифр номера после +375.');
  const id = randomToken();
  const profile = await accountForPhone(env, phone);
  if (profile) {
    const now = nowSeconds();
    const db = env.DB;
    const code = randomCode();
    const hash = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', await codeKey(env), encoder.encode(id + ':' + code))));
    await q(db, 'DELETE FROM phone_login_codes WHERE created_at<=?', now - 86400).run();
    const created = await q(db, 'INSERT INTO phone_login_codes (id, email, phone, channel, code_hash, created_at, expires_at) ' +
      'SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM phone_login_codes WHERE phone=? AND created_at>?) ' +
      'AND (SELECT COUNT(*) FROM phone_login_codes WHERE phone=? AND created_at>?) < 8 RETURNING id',
    id, profile.email, phone, channel, hash, now, now + codeAge, phone, now - codeRetry, phone, now - 3600).first();
    if (created) {
      const pending = sendPhoneCode(env, channel, phone, code, id).catch(() => console.warn('Could not send a login code via ' + channel));
      ctx?.waitUntil?.(pending);
    }
  }
  return json({ challenge: id, retryIn: codeRetry }, 202);
}

async function verifyPhoneLogin(request, props, url, env) {
  const { challenge, code } = props;
  const invalidCode = 'Код неверный или уже истёк. Запросите новый код.';
  if (!validToken(challenge) || typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) fail(400, invalidCode);
  const db = env.DB;
  const now = nowSeconds();
  const row = await q(db, 'UPDATE phone_login_codes SET attempts=attempts+1 ' +
    'WHERE id=? AND expires_at>? AND used=0 AND delivered=1 AND attempts<? ' +
    'AND NOT EXISTS (SELECT 1 FROM phone_login_codes newer WHERE newer.phone=phone_login_codes.phone ' +
    'AND newer.created_at>phone_login_codes.created_at) RETURNING email, phone, channel, code_hash',
  challenge, now, codeAttemptLimit).first();
  if (!row || !messagesReady(row.channel, env, url) || !await crypto.subtle.verify('HMAC', await codeKey(env),
    fromBase64url(row.code_hash), encoder.encode(challenge + ':' + code))) fail(400, invalidCode);
  if (!await q(db, 'UPDATE phone_login_codes SET used=1 WHERE id=? AND used=0 AND expires_at>? ' +
    'AND NOT EXISTS (SELECT 1 FROM phone_login_codes newer WHERE newer.phone=phone_login_codes.phone ' +
    'AND newer.created_at>phone_login_codes.created_at) RETURNING id',
    challenge, nowSeconds()).first()) fail(400, invalidCode);
  const profile = await accountForPhone(env, row.phone);
  if (!profile || profile.email !== row.email) fail(400, invalidCode);
  const response = json({ ok: true });
  response.headers.append('Set-Cookie', await createSession(request, env, profile, row.channel, row.phone));
  return response;
}

async function phoneAuth(request, url, env, ctx) {
  if (request.method !== 'POST') fail(405, 'Действие недоступно.');
  sameOrigin(request, url);
  const props = await body(request, 2048);
  if (!props || typeof props !== 'object') fail(400, 'Укажите данные для входа.');
  return url.pathname.endsWith('/start') ? startPhoneLogin(props, url, env, ctx) : verifyPhoneLogin(request, props, url, env);
}

async function readBodyBytes(request, limit, tooLarge) {
  if (Number(request.headers.get('content-length')) > limit) fail(413, tooLarge);
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Укажите данные.');
  let size = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      fail(413, tooLarge);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseBody(raw) {
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch { /* malformed JSON */ }
  fail(400, 'Не удалось прочитать данные.');
}

async function body(request, limit = 16384) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Ожидался формат JSON.');
  const bytes = await readBodyBytes(request, limit, 'Слишком большой запрос.');
  return parseBody(decoder.decode(bytes));
}

function field(data, key, limit, required = false) {
  if (data[key] != null && typeof data[key] !== 'string') fail(400, 'Проверьте заполнение полей.');
  const value = (data[key] ?? '').trim();
  if ((required && !value) || value.length > limit) fail(400, 'Проверьте заполнение полей.');
  return value;
}

function address(data, key, image = false) {
  const value = field(data, key, 2048);
  if (!value) return '';
  if (image && value === '/assets/moka.jpg') return value;
  const labels = { logo_url: 'Логотип', cover_url: 'Обложка', maps_url: 'Карты',
    telegram_url: 'Telegram', instagram_url: 'Instagram', vk_url: 'ВКонтакте' };
  try {
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    const url = new URL(hasProtocol ? value : 'https://' + value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password &&
        (hasProtocol || /^[^/\s]+\.[^/\s]+/.test(value))) return url.href;
  } catch { /* invalid URL */ }
  fail(400, 'Проверьте ссылку в поле «' + labels[key] + '».');
}

function siteLinks(data, site) {
  const visible = data.link_visibility;
  if (visible === undefined) {
    return { ...Object.fromEntries(contactColumns.map((key) => [key, address(data, key)])),
      website_url: null, show_website: null, hidden_links: null, show_maps: null };
  }
  if (!visible || [...contactColumns, 'website_url'].some((key) => typeof visible[key] !== 'boolean')) {
    fail(400, 'Проверьте, какие ссылки включены.');
  }
  const contacts = Object.fromEntries(contactColumns.map((key) => {
    const value = visible[key] ? address(data, key) : site?.[key] ?? '';
    if (visible[key] && !value) fail(400, 'Введите адрес для каждой включённой ссылки.');
    return [key, value];
  }));
  const website = visible.website_url ? httpsLink(field(data, 'website_url', 2048)) : null;
  if (visible.website_url && !website) fail(400, 'Введите полную HTTPS-ссылку на официальный сайт.');
  return { ...contacts, website_url: website?.href ?? null, show_website: Number(visible.website_url),
    hidden_links: JSON.stringify(contactColumns.filter((key) => !visible[key])), show_maps: Number(visible.maps_url) };
}

function guestInfoFields(data) {
  const show_hours = data.show_hours == null ? null : optionalFlag(data, 'show_hours');
  const show_wifi = data.show_wifi == null ? null : optionalFlag(data, 'show_wifi');
  const hours = show_hours === 0 || data.opening_hours === undefined ? null : field(data, 'opening_hours', 240);
  const wifiName = show_wifi === 0 || data.wifi_name === undefined ? null : field(data, 'wifi_name', 80);
  const wifiPassword = show_wifi === 0 ? undefined : data.wifi_password;
  if (wifiPassword !== undefined && (typeof wifiPassword !== 'string' || wifiPassword.length > 128)) {
    fail(400, 'Проверьте гостевой пароль Wi-Fi.');
  }
  if (show_hours && !hours) fail(400, 'Укажите время работы.');
  if (show_wifi && !wifiName && !wifiPassword) fail(400, 'Укажите название гостевой сети или пароль Wi-Fi.');
  return { opening_hours: hours, wifi_name: wifiName, wifi_password: wifiPassword ?? null, show_hours, show_wifi };
}

function siteFields(data, site) {
  const name = field(data, 'name', 80, true);
  const type = field(data, 'type', 50, true);
  const description = field(data, 'description', 260);
  const theme = field(data, 'theme', 20, true);
  const currency = field(data, 'currency', 3, true);
  const status = field(data, 'status', 8, true);
  if (!themes.includes(theme) || !currencies.includes(currency) || !['draft', 'live'].includes(status)) fail(400, 'Проверьте настройки страницы.');
  return {
    name, type, description, theme, logo_url: address(data, 'logo_url', true), cover_url: address(data, 'cover_url', true),
    currency, status, ...siteLinks(data, site), ...guestInfoFields(data),
  };
}

function itemFields(data) {
  const name = field(data, 'name', 100, true);
  const category = field(data, 'category', 55, true);
  const description = field(data, 'description', 300);
  if (!Number.isInteger(data.price) || data.price < 0 || data.price > 99999999 || typeof data.available !== 'boolean') fail(400, 'Укажите корректную цену.');
  return [name, category, description, data.price, Number(data.available)];
}

function photoFormat(bytes) {
  if (bytes.length < 12) return null;
  if ([255, 216, 255].every((byte, index) => bytes[index] === byte)) return 'jpg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'png';
  const tag = (index) => String.fromCharCode(...bytes.subarray(index, index + 4));
  if (tag(0) === 'RIFF' && tag(8) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(tag(12))) return 'webp';
  return null;
}

const isPhotoForm = (request) => request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;');
const photoTooLarge = 'Фото после уменьшения должно быть не больше 6 МБ.';

async function photoForm(request, slots) {
  const raw = await readBodyBytes(request, photoLimit * slots + 32768, photoTooLarge);
  let form;
  try {
    form = await new Response(raw, { headers: { 'Content-Type': request.headers.get('content-type') } }).formData();
  } catch {
    fail(400, 'Не удалось прочитать загрузку.');
  }
  const payload = form.get('payload');
  if (typeof payload !== 'string' || payload.length > 16384) fail(400, 'Проверьте данные формы.');
  return { data: parseBody(payload), form };
}

async function readPhoto(photo) {
  if (photo == null) return null;
  if (!(photo instanceof File) || !photo.size) fail(400, 'Выберите фотографию.');
  if (photo.size > photoLimit) fail(413, photoTooLarge);
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const extension = photoFormat(bytes);
  if (!extension) fail(415, 'Выберите фотографию в формате JPEG, PNG или WebP.');
  return { bytes, extension };
}

async function itemInput(request) {
  if (isPhotoForm(request)) {
    const { data, form } = await photoForm(request, 1);
    const photo = await readPhoto(form.get('photo'));
    if (!photo) fail(400, 'Выберите фотографию и заполните данные позиции.');
    return { fields: itemFields(data), removePhoto: false, photo };
  }
  const data = await body(request);
  if (data.remove_photo != null && typeof data.remove_photo !== 'boolean') fail(400, 'Проверьте настройки фотографии.');
  return { fields: itemFields(data), removePhoto: data.remove_photo === true, photo: null };
}

function photoUrl(prefix, key, preview) {
  return key ? prefix + key + (preview ? '?preview=1' : '') : null;
}

function itemWithPhoto({ photo_key: key, ...item }, preview = false) {
  return { ...item, photo_url: photoUrl(photoPrefix, key, preview) };
}

function siteWithPhotos({ logo_key, cover_key, menu_order_version, hidden_links, ...site }, preview = false) {
  return { ...site, hidden_links: JSON.parse(hidden_links ?? '[]'), logo_photo_url: photoUrl(sitePhotoPrefix, logo_key, preview),
    cover_photo_url: photoUrl(sitePhotoPrefix, cover_key, preview) };
}

async function uploadPhoto(env, photo) {
  if (!photo) return null;
  if (!env.BUCKET) fail(503, 'Хранилище фотографий временно недоступно.');
  const key = newId() + '.' + photo.extension;
  await env.BUCKET.put(key, photo.bytes, { httpMetadata: { contentType: photoTypes[photo.extension] } });
  return key;
}

async function removePhotoIfUnused(env, key, sitePhoto = false) {
  if (!key || !env.BUCKET) return;
  try {
    const statement = sitePhoto ? q(env.DB, 'SELECT 1 FROM sites WHERE logo_key=? OR cover_key=?', key, key) :
      q(env.DB, 'SELECT 1 FROM items WHERE photo_key=?', key);
    if (!await statement.first()) await env.BUCKET.delete(key);
  } catch (error) {
    console.error('Failed to remove unused photo', error);
  }
}

async function saveSite(request, env, site) {
  const db = env.DB;
  const {data, form} = isPhotoForm(request) ? await photoForm(request, 2) : { data: await body(request) };
  const slug = site?.slug ?? field(data, 'slug', 48, true).toLowerCase();
  if (!site) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reserved.has(slug)) fail(400, 'Используйте латиницу, цифры и дефисы в адресе.');
    if (await findSite(db, slug)) fail(409, 'Этот адрес уже используется.');
  }
  const fields = siteFields(data, site);
  const photos = {};
  const keys = {};
  const uploaded = [];
  for (const slot of sitePhotoSlots) {
    const remove = data['remove_' + slot + '_photo'];
    if (remove != null && typeof remove !== 'boolean') fail(400, 'Проверьте настройки изображений.');
    photos[slot] = await readPhoto(form?.get(slot + '_photo'));
    const linkChanged = fields[slot + '_url'] && fields[slot + '_url'] !== site?.[slot + '_url'];
    keys[slot] = remove || linkChanged ? null : site?.[slot + '_key'] ?? null;
  }
  try {
    for (const slot of sitePhotoSlots) {
      if (photos[slot]) {
        keys[slot] = await uploadPhoto(env, photos[slot]);
        uploaded.push(keys[slot]);
      }
    }
    if (site) {
      const result = await q(db, `UPDATE sites SET name=?, type=?, description=?, theme=?, logo_url=?, cover_url=?, currency=?, status=?,
        maps_url=?, telegram_url=?, instagram_url=?, vk_url=?, website_url=COALESCE(?, website_url),
        show_website=COALESCE(?, show_website), hidden_links=COALESCE(?, hidden_links), show_maps=COALESCE(?, show_maps),
        opening_hours=COALESCE(?, opening_hours), wifi_name=COALESCE(?, wifi_name), wifi_password=COALESCE(?, wifi_password),
        show_hours=COALESCE(?, show_hours), show_wifi=COALESCE(?, show_wifi), logo_key=?, cover_key=?
        WHERE id=? AND logo_key IS ? AND cover_key IS ? AND theme=COALESCE(?, theme)`,
        ...Object.values(fields), keys.logo, keys.cover, site.id, site.logo_key, site.cover_key,
        data.previous_theme === undefined ? null : field(data, 'previous_theme', 20)).run();
      if (!result.meta.changes) fail(409, 'Оформление уже изменилось. Обновите страницу и повторите действие.');
    } else {
      await q(db, `INSERT INTO sites (id, slug, name, type, description, theme, logo_url, cover_url, currency, status,
        maps_url, telegram_url, instagram_url, vk_url, website_url, show_website, hidden_links, show_maps,
        opening_hours, wifi_name, wifi_password, show_hours, show_wifi, nfc_key, created_at, logo_key, cover_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, ''), COALESCE(?, 0), COALESCE(?, '[]'), COALESCE(?, 0),
          COALESCE(?, ''), COALESCE(?, ''), COALESCE(?, ''), ?, ?, ?, ?, ?, ?)`,
        newId(), slug, ...Object.values(fields), newId(), new Date().toISOString(), keys.logo, keys.cover).run();
    }
  } catch (error) {
    await Promise.all(uploaded.map((key) => removePhotoIfUnused(env, key, true)));
    if (/UNIQUE constraint failed: sites.slug/.test(error.message)) fail(409, 'Этот адрес уже используется.');
    throw error;
  }
  if (site) {
    await Promise.all(sitePhotoSlots.map((slot) => keys[slot] !== site[slot + '_key'] &&
      removePhotoIfUnused(env, site[slot + '_key'], true)));
  }
  return siteWithPhotos(await findSite(db, slug), true);
}

function expectedVersion(request) {
  const value = request.headers.get('if-match');
  if (value === null) fail(428, 'Обновите страницу панели и повторите действие.');
  const version = Number(/^"([1-9][0-9]*)"$/.exec(value)?.[1]);
  if (!Number.isSafeInteger(version)) fail(400, 'Некорректная версия меню. Обновите страницу.');
  return version;
}

function optionalFlag(data, key) {
  if (data[key] === undefined) return null;
  if (typeof data[key] !== 'boolean') fail(400, 'Проверьте настройку видимости кнопки.');
  return Number(data[key]);
}

function httpsLink(value) {
  try {
    const link = new URL(value);
    if (link.protocol === 'https:' && !link.username && !link.password && link.href.length <= 2048) return link;
  } catch { /* invalid URL */ }
  return null;
}

async function saveMenuLink(request, url, db, site) {
  const data = await body(request);
  const value = field(data, 'menu_url', 2048);
  const destination = httpsLink(value);
  if (value && (!destination || destination.origin === url.origin)) {
    fail(400, 'Введите полную HTTPS-ссылку на внешнее меню.');
  }
  const visible = optionalFlag(data, 'show_menu');
  const previous = optionalFlag(data, 'previous_show_menu');
  if (!await q(db, `UPDATE sites SET menu_url=?, show_menu=COALESCE(?, show_menu)
    WHERE id=? AND menu_url=? AND show_menu=COALESCE(?, show_menu) RETURNING id`,
    destination?.href ?? '', visible, site.id, field(data, 'previous_url', 2048), previous).first()) {
    fail(412, 'Настройки меню уже изменились. Откройте их заново.');
  }
}

async function saveWebsiteButton(request, db, site) {
  const data = await body(request);
  const value = field(data, 'website_url', 2048);
  const destination = httpsLink(value);
  const visible = optionalFlag(data, 'show_website');
  const previous = optionalFlag(data, 'previous_show_website');
  if ((value || visible) && !destination) fail(400, 'Введите полную HTTPS-ссылку на официальный сайт.');
  if (visible === null || previous === null) fail(400, 'Проверьте настройку видимости кнопки.');
  if (!await q(db, `UPDATE sites SET website_url=?, show_website=?
    WHERE id=? AND website_url=? AND show_website=? RETURNING id`,
    destination?.href ?? '', visible, site.id, field(data, 'previous_url', 2048), previous).first()) {
    fail(412, 'Настройки кнопки уже изменились. Повторите действие на обновлённой странице.');
  }
}

async function importMenu(request, db, site) {
  const { currency, items } = await body(request, 512 * 1024);
  if (currency !== undefined && currency !== site.currency) fail(400, 'Валюта в файле должна совпадать с валютой мини-сайта: ' + site.currency + '.');
  if (!Array.isArray(items) || items.length < 1 || items.length > 500) {
    fail(400, 'В файле должен быть список items от 1 до 500 позиций.');
  }
  const fields = items.map((item, index) => {
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item)) fail(400, 'Ожидалась позиция меню.');
      const value = typeof item.price === 'number' ? String(item.price) : item.price;
      if (typeof value !== 'string' || !/^\d{1,6}(?:[.,]\d{1,2})?$/.test(value.trim())) {
        fail(400, 'Укажите цену с точностью до двух знаков.');
      }
      return itemFields({ ...item, price: Math.round(Number(value.replace(',', '.')) * 100),
        available: item.available === undefined ? true : item.available });
    } catch (error) {
      if (error.status !== 400) throw error;
      fail(400, 'Позиция №' + (index + 1) + '. ' + error.message);
    }
  });
  const batch = await digest(site.id + '\0' + JSON.stringify(fields));
  const start = Date.now();
  const rows = fields.map((row, index) => [batch + '-' + index, ...row, new Date(start + index).toISOString()]);
  const added = await all(db, `INSERT INTO items (site_id, id, name, category, description, price, available, created_at)
    SELECT ?, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
      json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'), json_extract(value, '$[6]')
    FROM json_each(?) WHERE 1 ON CONFLICT(id) DO NOTHING RETURNING id`, site.id, JSON.stringify(rows));
  return { added: added.length, skipped: rows.length - added.length };
}

async function moveItem(request, db, siteId) {
  const version = expectedVersion(request);
  const data = await body(request);
  const id = field(data, 'id', 100, true);
  const target = field(data, 'target', 100, true);
  const result = await q(db, `WITH positions AS MATERIALIZED (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ${itemOrder}) AS position FROM items
    WHERE site_id=? AND (SELECT menu_order_version FROM sites WHERE id=?)=?
  ), move AS (
    SELECT source.position AS start, destination.position AS finish
    FROM positions source JOIN positions destination ON destination.id=? WHERE source.id=?
  ), ranks AS MATERIALIZED (
    SELECT positions.id, CASE
      WHEN position=start THEN finish
      WHEN position>start AND position<=finish THEN position-1
      WHEN position>=finish AND position<start THEN position+1
      ELSE position END AS new_position
    FROM positions CROSS JOIN move
  )
  UPDATE items SET sort_order=ranks.new_position FROM ranks
  WHERE items.site_id=? AND items.id=ranks.id`, siteId, siteId, version, target, id, siteId).run();
  if (!result.meta.changes) fail(412, 'Список или порядок позиций изменился. Повторите перенос в обновлённом меню.');
}

async function editItem(request, env, site, id) {
  const db = env.DB;
  const version = expectedVersion(request);
  const { fields, photo, removePhoto } = await itemInput(request);
  if (!photo && !removePhoto) {
    const result = await q(db, `UPDATE items SET name=?, category=?, description=?, price=?, available=?, edit_version=edit_version+1
      WHERE site_id=? AND id=? AND edit_version=?`, ...fields, site.id, id, version).run();
    if (!result.meta.changes) fail(412, itemChanged);
    return;
  }
  const current = await q(db, 'SELECT photo_key FROM items WHERE site_id=? AND id=? AND edit_version=?', site.id, id, version).first();
  if (!current) fail(412, itemChanged);
  const key = await uploadPhoto(env, photo);
  try {
    const result = await q(db, `UPDATE items SET name=?, category=?, description=?, price=?, available=?, photo_key=?, edit_version=edit_version+1
      WHERE site_id=? AND id=? AND edit_version=?`, ...fields, key, site.id, id, version).run();
    if (!result.meta.changes) fail(412, itemChanged);
  } catch (error) {
    await removePhotoIfUnused(env, key);
    throw error;
  }
  await removePhotoIfUnused(env, current.photo_key);
}

async function tipCryptography(env) {
  if (!hasTipKey(env)) fail(503, 'Шифрование платежей временно недоступно.');
  return crypto.subtle.importKey('raw', fromBase64url(env.TIP_ENCRYPTION_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function protectTipValue(env, purpose, value) {
  const key = await tipCryptography(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, key, encoder.encode(value));
  return base64url(iv) + '.' + base64url(new Uint8Array(encrypted));
}

async function readTipValue(env, purpose, value) {
  const parts = value?.split('.');
  if (parts?.length !== 2) throw new Error('Malformed payment value');
  const key = await tipCryptography(env);
  const [iv, cipher] = parts.map(fromBase64url);
  const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, key, cipher);
  return decoder.decode(decoded);
}

function trustedPaymentUrl(raw, domains) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password
        && domains.some((domain) => url.hostname === domain || url.hostname.endsWith('.' + domain))) return url;
  } catch { /* invalid destination */ }
  return null;
}

const tipSettings = (db, siteId) => q(db, 'SELECT * FROM site_tip_settings WHERE site_id=?', siteId).first();
const normalizedLinks = (stored) => JSON.parse(stored?.links || '{}');

function getTipForm(stored, env) {
  return {
    links: normalizedLinks(stored),
    checkout: {
      enabled: !!stored?.checkout_enabled, test: stored ? !!stored.checkout_test : true,
      recipient: stored?.checkout_recipient || '', shop_id: stored?.shop_id || '',
      public_key: stored?.public_key || '', saved_key: !!stored?.shop_key,
      ready: hasTipKey(env),
    },
  };
}

async function verificationKey(value) {
  const base64 = value.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, '');
  const bytes = fromBase64url(base64);
  return crypto.subtle.importKey('spki', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

async function saveTipSettings(env, siteId, data) {
  if (!data.links || typeof data.links !== 'object' || !data.checkout || typeof data.checkout !== 'object') {
    fail(400, 'Заполните настройки чаевых.');
  }
  const links = {};
  for (const [method, { label, domains }] of Object.entries(linkTips)) {
    const option = data.links[method] || {};
    const enabled = option.enabled === true;
    const recipient = field(option, 'recipient', 90);
    const input = field(option, 'url', 2048);
    const url = input && trustedPaymentUrl(input, domains);
    if (input && !url) fail(400, 'Для варианта «' + label + '» укажите HTTPS-ссылку на домене банка или провайдера.');
    if (enabled && (!recipient || !url)) fail(400, 'Укажите получателя и ссылку для варианта «' + label + '».');
    if (recipient || url || enabled) links[method] = { enabled, recipient, url: url ? url.href : '' };
  }
  const config = data.checkout;
  const current = await tipSettings(env.DB, siteId);
  const shopId = field(config, 'shop_id', 16);
  const recipient = field(config, 'recipient', 90);
  const secret = field(config, 'secret', 200);
  const pubKey = field(config, 'public_key', 4096);
  const enabled = config.enabled === true;
  const test = config.test !== false || env.DEMO_MODE;
  let cipher = shopId && current?.shop_id === shopId ? current.shop_key : '';
  if (shopId && !/^[1-9]\d*$/.test(shopId)) fail(400, 'Укажите числовой ID магазина bePaid.');
  if (secret) {
    if (!shopId || !/^[\x21-\x7e]+$/.test(secret)) fail(400, 'Проверьте ID магазина и секретный ключ bePaid.');
    cipher = await protectTipValue(env, siteId + ':shop:' + shopId, secret);
  }
  if (pubKey) {
    try { await verificationKey(pubKey); }
    catch { fail(400, 'Укажите корректный публичный RSA-ключ магазина bePaid.'); }
  }
  if (enabled && (!recipient || !shopId || !cipher || !pubKey || !hasTipKey(env))) {
    fail(400, 'Для bePaid укажите получателя, ID магазина, секретный ключ и публичный RSA-ключ.');
  }
  await q(env.DB, `INSERT INTO site_tip_settings
    (site_id, links, checkout_enabled, checkout_test, checkout_recipient, shop_id, shop_key, public_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (site_id) DO UPDATE SET links=excluded.links,
    checkout_enabled=excluded.checkout_enabled, checkout_test=excluded.checkout_test, checkout_recipient=excluded.checkout_recipient,
    shop_id=excluded.shop_id, shop_key=excluded.shop_key, public_key=excluded.public_key`,
    siteId, JSON.stringify(links), Number(enabled), Number(!!test), recipient, shopId, cipher || '', pubKey).run();
}

function activeTips(settings, env) {
  const links = normalizedLinks(settings);
  const methods = Object.entries(linkTips).flatMap(([id, { label, domains }]) => {
    const link = links[id];
    return link?.enabled && trustedPaymentUrl(link.url, domains) ? [{ id, label, recipient: link.recipient }] : [];
  });
  if (settings?.checkout_enabled && settings.shop_key && hasTipKey(env)) {
    methods.push({ id: checkoutMethod, label: checkoutTitle, recipient: settings.checkout_recipient, test: !!settings.checkout_test });
  }
  return methods;
}

async function recordTipOpen(db, siteId, method, source) {
  await q(db, `INSERT INTO tip_opens (site_id, method, source, day) VALUES (?, ?, ?, ?)
    ON CONFLICT (site_id, method, day, source) DO UPDATE SET count=tip_opens.count+1`, siteId, method, source, dayKey()).run();
}

async function tipSummary(db, filter, args, selectedId, start, end) {
  const scope = (filter || ' WHERE 1=1') + (selectedId ? ' AND s.id=?' : '');
  const values = [...args, ...(selectedId ? [selectedId] : []), start, end];
  const [counts, paid] = await Promise.all([
    all(db, `SELECT t.method, t.source, SUM(t.count) AS count FROM tip_opens t JOIN sites s ON t.site_id=s.id${scope}
      AND t.day BETWEEN ? AND ? GROUP BY t.method,t.source`, ...values),
    q(db, `SELECT COUNT(*) AS count, COALESCE(SUM(t.amount),0) AS amount FROM tip_payments t
      JOIN sites s ON t.site_id=s.id${scope} AND t.test=0 AND t.paid_day BETWEEN ? AND ?`, ...values).first(),
  ]);
  return { counts, paid };
}

async function servePhoto(request, url, env, prefix) {
  const key = url.pathname.slice(prefix.length);
  const format = key.match(photoKeyPattern)?.[1];
  const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!format || !env.BUCKET) return notFound();
  const statement = prefix === sitePhotoPrefix
    ? q(env.DB, 'SELECT id AS site_id, status, 1 AS available FROM sites WHERE logo_key=? OR cover_key=?', key, key)
    : q(env.DB, `SELECT s.id AS site_id, s.status, i.available FROM items i
      JOIN sites s ON s.id=i.site_id WHERE i.photo_key=?`, key);
  const item = await statement.first();
  if (!item) return notFound();
  const preview = url.searchParams.get('preview') === '1';
  if (preview) {
    const user = await actor(request, env);
    if (!user || (user.role !== 'owner' &&
        !await q(env.DB, 'SELECT 1 FROM site_admins WHERE site_id=? AND email=?', item.site_id, user.email).first())) return notFound();
  } else if (item.status !== 'live' || !item.available) {
    return notFound();
  }
  const head = request.method === 'HEAD';
  const object = await (head ? env.BUCKET.head(key) : env.BUCKET.get(key));
  if (!object) return notFound();
  const etag = '"' + key + '"';
  const headers = { 'Content-Type': photoTypes[format], 'Content-Length': String(object.size),
    'Cache-Control': preview ? 'no-store' : 'no-cache', 'X-Content-Type-Options': 'nosniff', ETag: etag };
  if (!preview && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(head ? null : object.body, { headers });
}

async function allowedSite(db, user, slug) {
  const site = await findSite(db, slug);
  if (!site || (user.role !== 'owner' && !await q(db, 'SELECT 1 FROM site_admins WHERE site_id = ? AND email = ?', site.id, user.email).first())) {
    fail(404, 'Сайт не найден или недоступен.');
  }
  return site;
}

function siteScope(user) {
  return user.role === 'owner' ? { filter: '', args: [] } : {
    filter: ' WHERE EXISTS (SELECT 1 FROM site_admins a WHERE a.site_id = s.id AND a.email = ?)',
    args: [user.email],
  };
}

async function listSites(db, user) {
  const { filter, args } = siteScope(user);
  const sites = await all(db, `SELECT s.slug, s.name, s.type, s.theme, s.status, s.logo_url, s.logo_key
    FROM sites s${filter} ORDER BY s.created_at DESC, s.name`, ...args);
  return { user, sites: sites.map((site) => siteWithPhotos(site, site.status === 'draft')) };
}

async function overview(db, user, url) {
  const { filter, args } = siteScope(user);
  const days = ['7', '14', '30'].includes(url.searchParams.get('days')) ? Number(url.searchParams.get('days')) : 7;
  const start = todayOffset(1 - days);
  const previous = todayOffset(1 - 2 * days);
  const filterSlug = url.searchParams.get('site') || '';
  const sites = await all(db, `SELECT s.*, (SELECT COUNT(*) FROM items i WHERE i.site_id = s.id) AS items_count
    FROM sites s${filter} ORDER BY s.created_at DESC, s.name`, ...args);
  if (filterSlug && !sites.some((site) => site.slug === filterSlug)) fail(404, 'Сайт не найден или недоступен.');
  const rows = await all(db, `SELECT e.site_id, e.day, e.kind, e.source, e.count FROM events e
    JOIN sites s ON s.id = e.site_id${filter || ' WHERE 1 = 1'} AND e.day BETWEEN ? AND ?`, ...args, previous, dayKey());
  const series = Array.from({ length: days }, (_, i) => ({ day: todayOffset(i + 1 - days), nfc: 0, direct: 0 }));
  const byDay = new Map(series.map((point) => [point.day, point]));
  const empty = () => ({ nfc: 0, direct: 0, menu: 0, maps: 0, telegram: 0, instagram: 0, vk: 0 });
  const current = empty();
  const comparison = empty();
  const summaries = new Map(sites.map((site) => [site.id, { visits: 0, nfc: 0 }]));
  const selectedId = sites.find((site) => site.slug === filterSlug)?.id;
  for (const row of rows) {
    const key = row.kind === 'visit' ? row.source : row.kind;
    if (row.kind === 'visit' && row.day >= start) {
      const summary = summaries.get(row.site_id);
      summary.visits += row.count;
      if (row.source === 'nfc') summary.nfc += row.count;
    }
    if (selectedId && selectedId !== row.site_id) continue;
    const point = byDay.get(row.day);
    if (point && row.kind === 'visit') point[row.source] += row.count;
    const total = point ? current : comparison;
    total[key] += row.count;
  }
  const tips = await tipSummary(db, filter, args, selectedId, start, dayKey());
  return { user, days, current, comparison, series, tips,
    sites: sites.map((site) => ({ ...siteWithPhotos(site, site.status === 'draft'), ...summaries.get(site.id) })) };
}

async function recordFeedback(request, url, db, slug) {
  if (request.headers.get('origin') !== url.origin) fail(403, 'Откройте форму на странице заведения.');
  const site = await findSite(db, slug);
  if (site?.status !== 'live') fail(404, 'Страница заведения недоступна.');
  const data = await body(request, 8192);
  if (typeof data.id !== 'string' || !uuidPattern.test(data.id) || ![1, 2, 3].includes(data.rating)) {
    fail(400, 'Укажите оценку и заполните отзыв.');
  }
  const comment = field(data, 'comment', 2000, true);
  const name = field(data, 'guest_name', 80);
  const place = field(data, 'guest_place', 100);
  const source = url.searchParams.get('nfc') === site.nfc_key ? 'nfc' : 'direct';
  await q(db, `INSERT INTO site_feedback (site_id, id, rating, comment, guest_name, guest_place, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(site_id, id) DO NOTHING`,
    site.id, data.id, data.rating, comment, name, place, source, new Date().toISOString()).run();
  return json({ ok: true }, 201);
}

async function feedbackInbox(db, id, params) {
  const rating = params.get('rating');
  const status = params.get('status');
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage < 100000 ? requestedPage : 1;
  const sorts = {
    recent: 'created_at DESC, id DESC',
    oldest: 'created_at ASC, id ASC',
    lowest: 'rating ASC, created_at DESC, id DESC',
    highest: 'rating DESC, created_at DESC, id DESC',
  };
  const sort = params.get('sort');
  const clauses = ['site_id=?'];
  const args = [id];
  if (['1', '2', '3'].includes(rating)) { clauses.push('rating=?'); args.push(Number(rating)); }
  if (status === 'unread' || status === 'read') clauses.push(status === 'unread' ? 'read_at IS NULL' : 'read_at IS NOT NULL');
  const rows = await all(db, `SELECT id, rating, comment, guest_name, guest_place, source, created_at, read_at FROM site_feedback
    WHERE ${clauses.join(' AND ')} ORDER BY ${Object.hasOwn(sorts, sort) ? sorts[sort] : sorts.recent} LIMIT 25 OFFSET ?`,
    ...args, (page - 1) * 24);
  return json({ reviews: rows.slice(0, 24), page, hasMore: rows.length > 24 });
}

async function saveAdministrator(request, env, site, emailToEdit) {
  const props = await body(request);
  if (!props || typeof props !== 'object') fail(400, 'Укажите данные администратора.');
  const email = normalizeEmail(emailToEdit ?? props.email);
  if (email.length > 254 || !emailPattern.test(email) || isOwnerEmail(env, email)) {
    fail(400, 'Укажите email администратора.');
  }
  const firstName = typeof props.first_name === 'string' ? props.first_name.trim() : '';
  const lastName = typeof props.last_name === 'string' ? props.last_name.trim() : '';
  if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80) fail(400, 'Укажите имя и фамилию администратора.');
  const phone = belarusPhone(props.phone);
  if (!phone) fail(400, 'Введите девять цифр номера после +375.');
  if (phone === belarusPhone(env.OWNER_PHONE)) fail(409, 'Этот номер назначен владельцу.');
  const nickname = typeof props.telegram_username === 'string' ? props.telegram_username.trim().replace(/^@/, '') : '';
  if (nickname && !/^[a-zA-Z0-9_]{3,32}$/.test(nickname)) fail(400, 'Проверьте ник в Telegram.');
  const db = env.DB;
  const profile = 'INSERT INTO admin_profiles (email, first_name, last_name, phone, telegram_username) ';
  const update = ' ON CONFLICT (email) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, ' +
    'phone=excluded.phone, telegram_username=excluded.telegram_username';
  try {
    if (emailToEdit !== undefined) {
      const saved = await q(db, profile + 'SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM site_admins WHERE site_id=? AND email=?)' +
        update + ' RETURNING email', email, firstName, lastName, phone, nickname, site.id, email).first();
      if (!saved) fail(404, 'Администратор не назначен этому сайту.');
    } else {
      await db.batch([
        q(db, profile + 'VALUES (?, ?, ?, ?, ?)' + update, email, firstName, lastName, phone, nickname),
        q(db, 'INSERT INTO site_admins (site_id, email) VALUES (?, ?) ON CONFLICT DO NOTHING', site.id, email),
      ]);
    }
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed: admin_profiles.phone')) fail(409, 'Этот номер уже назначен другому администратору.');
    throw error;
  }
}

async function api(request, url, env) {
  const db = env.DB;
  const feedback = url.pathname.match(/^\/api\/feedback\/([a-z0-9-]+)$/);
  if (feedback && request.method === 'POST') return recordFeedback(request, url, db, feedback[1]);
  const user = await actor(request, env);
  if (url.pathname === '/api/session' && request.method === 'GET') return json({
    user, ownerConfigured: !!env.OWNER_EMAIL || !!env.DEMO_MODE, googleAvailable: googleReady(env, url),
    telegramAvailable: oidcReady(oidcProviders.telegram, env, url),
    smsAvailable: messagesReady('sms', env, url), viberAvailable: messagesReady('viber', env, url),
    selfHosted: !!env.SELF_HOSTED,
  });
  if (!user) fail(401, 'Войдите в панель управления.');
  const method = request.method;
  if (!['GET', 'HEAD'].includes(method)) {
    if (request.headers.get('origin') !== url.origin) fail(403, 'Откройте панель и повторите действие.');
  }
  if (url.pathname === '/api/overview' && method === 'GET') return json(await overview(db, user, url));
  if (url.pathname === '/api/sites' && method === 'GET') return json(await listSites(db, user));
  if (url.pathname === '/api/sites' && method === 'POST') {
    if (user.role !== 'owner') fail(403, 'Создавать сайты может владелец.');
    return json({ site: await saveSite(request, env) }, 201);
  }
  const route = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)(?:\/(items|admins|tips|website|feedback|theme)(?:\/([^/]+))?)?$/);
  if (!route) fail(404, 'Раздел не найден.');
  const [, slug, section, key] = route;
  const site = await allowedSite(db, user, slug);
  if (!section && method === 'GET') {
    // Read the position list and its order version from the same snapshot.
    const rows = await all(db, `SELECT items.*, sites.menu_order_version FROM sites
      LEFT JOIN items ON items.site_id=sites.id WHERE sites.id=? ORDER BY ${itemOrder}`, site.id);
    if (!rows.length) fail(404, 'Сайт не найден или недоступен.');
    const items = rows.filter((row) => row.id !== null).map(({ menu_order_version, ...item }) => itemWithPhoto(item, true));
    const admins = user.role === 'owner' ? await all(db, 'SELECT a.email, p.first_name, p.last_name, p.phone, p.telegram_username ' +
      'FROM site_admins a LEFT JOIN admin_profiles p ON p.email=a.email WHERE a.site_id=? ORDER BY p.first_name, p.last_name, a.email', site.id) : [];
    const tips = user.role === 'owner' ? getTipForm(await tipSettings(db, site.id), env) : null;
    const unreadFeedback = (await q(db, 'SELECT COUNT(*) AS count FROM site_feedback WHERE site_id=? AND read_at IS NULL', site.id).first()).count;
    return json({ user, site: siteWithPhotos(site, true), items, menuOrderVersion: rows[0].menu_order_version, admins, tips, unreadFeedback });
  }
  if (section === 'feedback' && !key && method === 'GET') return feedbackInbox(db, site.id, url.searchParams);
  if (section === 'feedback' && key && method === 'PUT') {
    if (!uuidPattern.test(key) || !await q(db, `UPDATE site_feedback SET read_at=COALESCE(read_at, ?)
      WHERE site_id=? AND id=? RETURNING id`, new Date().toISOString(), site.id, key).first()) fail(404, 'Отзыв не найден.');
    return json({ ok: true });
  }
  if (section === 'tips' && !key && method === 'PUT') {
    if (user.role !== 'owner') fail(403, 'Настройки чаевых доступны владельцу.');
    await saveTipSettings(env, site.id, await body(request));
    return json({ ok: true });
  }
  if (section === 'website' && !key && method === 'PUT') {
    if (user.role !== 'owner') fail(403, 'Настройки сайта доступны владельцу.');
    await saveWebsiteButton(request, db, site);
    return json({ ok: true });
  }
  if (section === 'theme' && !key && method === 'PUT') {
    const data = await body(request);
    const theme = field(data, 'theme', 20, true);
    const previousTheme = field(data, 'previous_theme', 20, true);
    if (!themes.includes(theme)) fail(400, 'Выберите тему из списка.');
    if (!await q(db, 'UPDATE sites SET theme=? WHERE id=? AND theme=? RETURNING id', theme, site.id, previousTheme).first()) {
      fail(409, 'Тема уже изменилась. Обновите страницу и повторите действие.');
    }
    return json({ ok: true });
  }
  if (!section && method === 'PUT') {
    if (user.role !== 'owner') fail(403, 'Настройки сайта доступны владельцу.');
    return json({ site: await saveSite(request, env, site) });
  }
  if (section === 'items') {
    if (key === 'link' && method === 'PUT') {
      await saveMenuLink(request, url, db, site);
      return json({ ok: true });
    }
    if (key === 'import' && method === 'POST') return json(await importMenu(request, db, site), 201);
    if (key === 'order' && method === 'PUT') {
      await moveItem(request, db, site.id);
      return json({ ok: true });
    }
    if (!key && method === 'POST') {
      const { fields, photo } = await itemInput(request);
      const photoKey = await uploadPhoto(env, photo);
      try {
        await q(db, `INSERT INTO items (id, site_id, name, category, description, price, available, created_at, photo_key)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, newId(), site.id, ...fields, new Date().toISOString(), photoKey).run();
      } catch (error) {
        await removePhotoIfUnused(env, photoKey);
        throw error;
      }
      return json({ ok: true }, 201);
    }
    if (key && method === 'PUT') {
      await editItem(request, env, site, key);
      return json({ ok: true });
    }
    if (key && method === 'DELETE') {
      const version = expectedVersion(request);
      const item = await q(db, 'DELETE FROM items WHERE site_id=? AND id=? AND edit_version=? RETURNING photo_key', site.id, key, version).first();
      if (!item) fail(412, itemChanged);
      await removePhotoIfUnused(env, item.photo_key);
      return json({ ok: true });
    }
  }
  if (section === 'admins') {
    if (user.role !== 'owner') fail(403, 'Управлять доступом может владелец.');
    if (!key && method === 'POST') {
      await saveAdministrator(request, env, site);
      return json({ ok: true }, 201);
    }
    if (key && ['PUT', 'DELETE'].includes(method)) {
      let email;
      try { email = normalizeEmail(decodeURIComponent(key)); } catch { fail(400, 'Некорректный адрес.'); }
      if (method === 'PUT') await saveAdministrator(request, env, site, email);
      else await q(db, 'DELETE FROM site_admins WHERE site_id=? AND email=?', site.id, email).run();
      return json({ ok: true });
    }
  }
  fail(405, 'Действие недоступно.');
}

async function count(db, site, kind, source) {
  await q(db, `INSERT INTO events (site_id, kind, source, day) VALUES (?, ?, ?, ?)
    ON CONFLICT (site_id, day, kind, source) DO UPDATE SET count = events.count + 1`, site.id, kind, source, dayKey()).run();
}

function trackAnalytics(ctx, write) {
  const pending = write.catch((error) => console.error('Could not record analytics', error));
  // Wait for the guarded write in local handlers that have no Worker execution context.
  if (!ctx?.waitUntil) return pending;
  try {
    ctx.waitUntil(pending);
  } catch (error) {
    console.error('Could not schedule analytics', error);
  }
}

function shell(assets, data = null, status = 200, state = {}) {
  const title = data?.site?.name || (status === 404 ? 'Страница не найдена' : 'Тап. — NFC-страницы');
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const safeTitle = title.replace(/[&<>"']/g, (character) => escapes[character]);
  const payload = JSON.stringify(data || state).replace(/</g, '\\u003c');
  const html = assets['index.html'].text.replace('<!--app-data-->', () => payload).replace('<!--page-title-->', () => safeTitle);
  return new Response(html, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self' https://checkout.bepaid.by; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
  } });
}

const tipVersion = (settings) => digest(JSON.stringify([settings.shop_id, settings.checkout_recipient,
  settings.checkout_test, settings.shop_key, settings.public_key]));

function parseTipAmount(value) {
  const match = String(value || '').trim().match(/^(\d{1,3})(?:[.,](\d{1,2}))?$/);
  const amount = match ? 100 * Number(match[1]) + Number((match[2] || '').padEnd(2, '0')) : 0;
  if (amount < 100 || amount > 30000) fail(400, 'Укажите сумму от 1 до 300 BYN.');
  return amount;
}

async function startCheckout(request, url, env, site, settings, source, ctx) {
  const origin = request.headers.get('origin');
  const samePage = origin === 'null' && request.headers.get('sec-fetch-site') === 'same-origin';
  if (origin !== url.origin && !samePage) fail(403, 'Откройте форму на странице заведения.');
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) fail(415, 'Откройте форму оплаты заново.');
  const form = new URLSearchParams(decoder.decode(await readBodyBytes(request, 4096, 'Слишком большой запрос.')));
  const amount = parseTipAmount(form.get('amount'));
  let intent;
  try {
    intent = JSON.parse(await readTipValue(env, site.id + ':intent:' + url.origin, form.get('intent')));
  } catch {
    fail(400, 'Откройте форму оплаты заново.');
  }
  if (!intent || !uuidPattern.test(intent.id || '') || !Number.isSafeInteger(intent.expires) || intent.expires < nowSeconds()
      || intent.version !== await tipVersion(settings)) fail(409, 'Обновите форму и проверьте получателя.');

  const db = env.DB;
  const id = intent.id;
  const test = !!settings.checkout_test || !!env.DEMO_MODE;
  const privateKey = await readTipValue(env, site.id + ':shop:' + settings.shop_id, settings.shop_key);
  const result = await q(db, `INSERT INTO tip_payments
    (id,site_id,source,amount,test,shop_id,recipient,public_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT (id) DO NOTHING`, id, site.id, source, amount, Number(test), settings.shop_id,
    settings.checkout_recipient, settings.public_key, new Date().toISOString()).run();
  if (!result.meta.changes) {
    const previous = await q(db, 'SELECT amount, checkout_url, paid_day FROM tip_payments WHERE site_id=? AND id=?', site.id, id).first();
    if (previous?.paid_day) return redirect('/' + site.slug + '/tips/result/' + id);
    if (previous?.checkout_url && previous.amount === amount) return redirect(previous.checkout_url);
    fail(409, 'Оплата по этой форме уже запрошена. Откройте новую форму для другого платежа.');
  }
  const resultUrl = new URL('/' + site.slug + '/tips/result/' + id, url.origin).href;
  const options = {
    checkout: {
      test, transaction_type: 'payment', attempts: 1,
      order: { amount, currency: 'BYN', description: ('Чаевые · ' + site.name).slice(0, 100),
        tracking_id: id, expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
      settings: { language: 'ru', success_url: resultUrl, return_url: resultUrl, decline_url: resultUrl + '?cancelled=1',
        fail_url: resultUrl + '?cancelled=1', cancel_url: resultUrl + '?cancelled=1',
        notification_url: new URL('/webhooks/bepaid/' + id, url.origin).href, save_card_toggle: { display: false } },
      payment_method: { types: ['credit_card'] },
    },
  };
  let destination;
  let upstreamStatus;
  try {
    const response = await fetch(checkoutEndpoint, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Basic ' + btoa(settings.shop_id + ':' + privateKey), Accept: 'application/json',
        'Content-Type': 'application/json', 'X-API-Version': '2', RequestID: id }, body: JSON.stringify(options) });
    upstreamStatus = response.status;
    if (response.ok) {
      const { checkout } = await response.json();
      const url = trustedPaymentUrl(checkout?.redirect_url, ['bepaid.by']);
      if (url?.origin === checkoutOrigin && url.pathname === '/v2/checkout' && typeof checkout.token === 'string'
          && checkout.token && url.searchParams.get('token') === checkout.token) destination = url.href;
    }
  } catch { /* A new form can be issued after a provider or network error. */ }
  if (!destination) {
    console.error('bePaid checkout failed', upstreamStatus ?? 'request_error');
    fail(502, 'bePaid пока не открыл страницу оплаты. Попробуйте ещё раз.');
  }
  await q(db, 'UPDATE tip_payments SET checkout_url=? WHERE id=?', destination, id).run();
  if (!test) await trackAnalytics(ctx, recordTipOpen(db, site.id, checkoutMethod, source));
  return redirect(destination);
}

async function bePaidNotification(request, env, id) {
  if (!uuidPattern.test(id)) fail(404, 'Платёж не найден.');
  const signature = request.headers.get('content-signature');
  if (!signature || signature.length > 1400) fail(401, 'Подпись обязательна.');
  const payment = await q(env.DB, 'SELECT id, amount, test, shop_id, public_key FROM tip_payments WHERE id=?', id).first();
  if (!payment) fail(404, 'Платёж не найден.');
  const raw = await readBodyBytes(request, 12 * 1024, 'Слишком большой запрос.');
  let valid = false;
  try {
    const key = await verificationKey(payment.public_key);
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(signature), raw);
  } catch { /* malformed signature */ }
  if (!valid) fail(401, 'Подпись не прошла проверку.');
  const notice = parseBody(decoder.decode(raw));
  let transaction = notice.transaction;
  if (!transaction && notice.transaction_type === 'payment' && notice.gateway_response?.payment) {
    if (String(notice.shop_id) !== payment.shop_id || notice.order?.amount !== payment.amount || notice.order?.currency !== 'BYN') {
      fail(400, 'Данные платежа не совпадают.');
    }
    transaction = { ...notice.gateway_response.payment, type: 'payment', tracking_id: notice.order?.tracking_id, test: notice.test };
  }
  if (transaction?.type !== 'payment' || transaction.status !== 'successful') return json({ ok: true });
  if (transaction.tracking_id !== id || transaction.amount !== payment.amount || transaction.currency !== 'BYN'
      || transaction.test !== !!payment.test || typeof transaction.uid !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(transaction.uid)) {
    fail(400, 'Данные платежа не совпадают.');
  }
  await q(env.DB, `UPDATE tip_payments SET paid_day=?, provider_uid=? WHERE id=? AND paid_day IS NULL
    AND NOT EXISTS (SELECT 1 FROM tip_payments WHERE provider_uid=?)`, dayKey(), transaction.uid, id, transaction.uid).run();
  return json({ ok: true });
}

async function tipsPage(request, url, env, assets, site, parts, preview, source, query, ctx) {
  const [, section, paymentId] = parts;
  const { name, slug, theme, logo_url, logo_photo_url, type } = siteWithPhotos(site, preview);
  const publicSite = { name, slug, theme, logo_url, logo_photo_url, type };
  const data = { site: publicSite, query, draftPreview: site.status === 'draft' && preview };
  const missing = () => shell(assets, null, 404, { view: 'missing' });
  if (section === 'result') {
    if (request.method === 'POST' || !uuidPattern.test(paymentId || '')) return missing();
    const payment = await q(env.DB, 'SELECT amount, recipient, test, paid_day FROM tip_payments WHERE site_id=? AND id=?', site.id, paymentId).first();
    if (!payment) return missing();
    return shell(assets, { ...data, view: 'tip-result', receipt: {
      amount: payment.amount, recipient: payment.recipient, test: !!payment.test, paid: !!payment.paid_day,
      cancelled: url.searchParams.get('cancelled') === '1',
    } });
  }
  const settings = await tipSettings(env.DB, site.id);
  const methods = activeTips(settings, env);
  if (!methods.length) return missing();
  const method = section || (methods.length === 1 ? methods[0].id : '');
  if (!method && request.method !== 'POST') return shell(assets, { ...data, view: 'tip-options', methods });
  const chosen = methods.find((option) => option.id === method);
  if (!chosen) return missing();
  if (method !== checkoutMethod) {
    if (request.method === 'POST') return missing();
    if (preview) return shell(assets, { ...data, view: 'tip-preview', chosen });
    if (request.method === 'GET') await trackAnalytics(ctx, recordTipOpen(env.DB, site.id, method, source));
    return redirect(normalizedLinks(settings)[method].url);
  }
  if (request.method === 'POST') {
    if (preview || !section) return missing();
    try { return await startCheckout(request, url, env, site, settings, source, ctx); }
    catch (error) {
      if (!error.status) console.error('Could not initialize bePaid checkout');
      return shell(assets, { ...data, view: 'tip-error', error: error.status ? error.message : 'Не удалось открыть оплату.' }, error.status || 502);
    }
  }
  const intent = preview ? '' : await protectTipValue(env, site.id + ':intent:' + url.origin,
    JSON.stringify({ id: newId(), expires: nowSeconds() + tipIntentLifetime, version: await tipVersion(settings) }));
  return shell(assets, { ...data, view: 'tip-amount', chosen, intent });
}

async function publicPage(request, url, env, assets, ctx) {
  const alias = url.pathname.match(nfcPath);
  const isAlias = !!alias || url.pathname === '/';
  const tipRoute = url.pathname.match(/^\/([a-z0-9-]+)\/tips(?:\/(result|[a-z-]+)(?:\/([0-9a-f-]+))?)?\/?$/);
  const route = isAlias || tipRoute ? null : url.pathname.match(/^\/([a-z0-9-]+)(?:\/(menu|go\/([a-z]+)))?\/?$/);
  const slug = alias?.[1] || route?.[1] || tipRoute?.[1];
  const [, , section, action] = route || [];
  const token = alias?.[2] || url.searchParams.get('nfc');
  const missing = () => shell(assets, null, 404, { view: 'missing' });
  if (slug && reserved.has(slug)) return missing();
  if (isAlias ? !token || !/^[A-Za-z0-9_-]{1,128}$/.test(token) : !route && !tipRoute) return missing();
  const db = env.DB;
  const site = slug ? await findSite(db, slug) : await q(db, 'SELECT * FROM sites WHERE nfc_key=?', token).first();
  if (!site || (isAlias && site.nfc_key !== token)) return missing();
  const source = token === site.nfc_key ? 'nfc' : 'direct';
  const preview = url.searchParams.get('preview') === '1' || (site.status === 'draft' && source === 'nfc');
  const user = preview ? await actor(request, env) : null;
  const previewAllowed = user && (user.role === 'owner' || await q(db, 'SELECT 1 FROM site_admins WHERE site_id=? AND email=?', site.id, user.email).first());
  if (site.status !== 'live' && !previewAllowed && tipRoute?.[2] !== 'result') return missing();
  const next = new URLSearchParams();
  if (source === 'nfc') next.set('nfc', site.nfc_key);
  if (previewAllowed) next.set('preview', '1');
  const query = next.size ? '?' + next : '';
  if (isAlias) return redirect('/' + site.slug + query);
  if (tipRoute) {
    if (tipRoute[2] !== 'result' && tipRoute[3]) return missing();
    return tipsPage(request, url, env, assets, site, tipRoute.slice(1), !!previewAllowed, source, query, ctx);
  }
  if (section?.startsWith('go/')) {
    const column = Object.hasOwn(actionColumns, action) ? actionColumns[action] : null;
    const enabled = column && (action !== 'maps' || site.show_maps);
    const destination = enabled && !JSON.parse(site.hidden_links ?? '[]').includes(column) ? site[column] : '';
    if (!destination) return shell(assets, null, 404, { view: 'missing' });
    if (!previewAllowed && request.method === 'GET') await trackAnalytics(ctx, count(db, site, action, source));
    return redirect(destination);
  }
  const wantsMenu = section === 'menu';
  if (wantsMenu && site.menu_url && new URL(site.menu_url).origin !== url.origin) {
    if (!previewAllowed && request.method === 'GET') await trackAnalytics(ctx, count(db, site, 'menu', source));
    return redirect(site.menu_url);
  }
  const { nfc_key, website_url, hidden_links, ...publicSite } = siteWithPhotos(site, !!previewAllowed);
  for (const key of hidden_links) delete publicSite[key];
  if (!site.show_maps) delete publicSite.maps_url;
  if (site.show_hours === 0) delete publicSite.opening_hours;
  if (site.show_wifi === 0) {
    delete publicSite.wifi_name;
    delete publicSite.wifi_password;
  }
  if (site.show_website) publicSite.website_url = website_url;
  const items = wantsMenu
    ? await all(db, 'SELECT id, name, category, description, price, photo_key FROM items WHERE site_id=? AND available=1 ORDER BY ' + itemOrder, site.id)
    : [];
  const tips = wantsMenu ? [] : activeTips(await tipSettings(db, site.id), env);
  const response = shell(assets, { view: wantsMenu ? 'menu' : 'public', site: publicSite,
    items: items.map((item) => itemWithPhoto(item, !!previewAllowed)), tips, query, draftPreview: site.status === 'draft' });
  if (!previewAllowed && request.method === 'GET') await trackAnalytics(ctx, count(db, site, wantsMenu ? 'menu' : 'visit', source));
  return response;
}

export function createApp(assets) {
  return {
    async fetch(request, env, ctx) {
      try {
        const url = new URL(request.url);
        const path = url.pathname;
        if (path.startsWith('/api/')) return await api(request, url, env);
        if (path === '/auth/signout') return await signOut(request, url, env);
        const oidc = path.match(/^\/auth\/(google|telegram)(?:\/return)?$/);
        if (oidc) return await oidcAuth(request, url, env, oidc[1]);
        if (['/auth/phone/start', '/auth/phone/verify'].includes(path)) return await phoneAuth(request, url, env, ctx);
        if (request.method === 'POST' && path.startsWith('/webhooks/bepaid/')) {
          return await bePaidNotification(request, env, path.slice('/webhooks/bepaid/'.length));
        }
        if (request.method === 'POST' && /^\/[a-z0-9-]+\/tips\/bepaid\/?$/.test(path)) {
          return await publicPage(request, url, env, assets, ctx);
        }
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Действие недоступно.' }, 405);
        if (path.startsWith(photoPrefix)) return await servePhoto(request, url, env, photoPrefix);
        if (path.startsWith(sitePhotoPrefix)) return await servePhoto(request, url, env, sitePhotoPrefix);
        if (path.startsWith('/assets/')) {
          const file = path.slice('/assets/'.length);
          const asset = Object.hasOwn(assets, file) && assets[file];
          if (!asset || file === 'index.html') return new Response(null, { status: 404 });
          const data = asset.text ?? Uint8Array.from(atob(asset.base64), (byte) => byte.charCodeAt(0));
          return new Response(request.method === 'HEAD' ? null : data, { headers: {
            'Content-Type': asset.type, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff',
          } });
        }
        if (path === '/favicon.ico') return new Response(null, { status: 204 });
        if ((path === '/' && !url.searchParams.has('nfc')) || path === '/admin' || path.startsWith('/admin/')) return shell(assets);
        return await publicPage(request, url, env, assets, ctx);
      } catch (error) {
        if (!error.status) console.error(error);
        return json({ error: error.status ? error.message : 'Внутренняя ошибка. Обновите страницу и попробуйте ещё раз.' }, error.status || 500);
      }
    },
  };
}

export { dayKey, todayOffset };
