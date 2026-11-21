const actionColumns = { maps: 'maps_url', telegram: 'telegram_url', instagram: 'instagram_url', vk: 'vk_url' };
const currencies = ['BYN', 'RUB', 'KZT', 'USD', 'EUR'];
const themes = ['coffee', 'indigo', 'garden', 'lavender'];
const reserved = new Set(['admin', 'api', 'assets', 'callback', 'signin-with-chatgpt', 'signout-with-chatgpt', 'favicon.ico']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nfcPath = /^\/(?:([a-z0-9-]+)\/)?nfc=([A-Za-z0-9_-]{1,128})\/?$/;
const photoPrefix = '/assets/menu-photos/';
const photoKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const photoTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const photoLimit = 6 * 1024 * 1024;
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
const paymentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const googleFlowCookie = '__Host-tap-google-flow';
const googleSessionCookie = '__Host-tap-session';
const googleReturnPath = '/auth/google/return';
const googleFlowAge = 600;
const googleSessionAge = 8 * 3600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let googleKeys;
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

const googleReady = (env, url) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && url.protocol === 'https:');
const nowSeconds = () => Math.floor(Date.now() / 1000);
const hasTipKey = (env) => /^[A-Za-z0-9_-]{43}$/.test(env.TIP_ENCRYPTION_KEY || '');

function actorFor(env, email, name, provider) {
  return { role: email === normalizeEmail(env.OWNER_EMAIL) ? 'owner' : 'manager',
    name: name || email.split('@')[0], email, demo: false, provider };
}

async function actor(request, env) {
  if (env.DEMO_MODE) {
    if (request.headers.get('x-demo-role') === 'manager') return { role: 'manager', name: 'Анна', email: 'manager@demo.tap', demo: true };
    return { role: 'owner', name: 'Владелец', email: 'owner@demo.tap', demo: true };
  }
  const googleUser = await googleActor(request, env);
  if (googleUser) return googleUser;
  if (!request.headers.get('oai-authenticated-user-id')) return null;
  const email = normalizeEmail(request.headers.get('oai-authenticated-user-email'));
  if (!email) return null;
  const rawName = request.headers.get('oai-authenticated-user-full-name');
  let name = rawName || email.split('@')[0];
  if (rawName && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(rawName); } catch { name = email.split('@')[0]; }
  }
  return actorFor(env, email, name, 'chatgpt');
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

async function googleActor(request, env) {
  const token = readCookie(request, googleSessionCookie);
  if (!validToken(token) || !googleReady(env, new URL(request.url))) return null;
  const session = await q(env.DB, 'SELECT email, name FROM google_sessions WHERE token_hash=? AND expires_at>?',
    await digest(token), nowSeconds()).first();
  return session ? actorFor(env, session.email, session.name, 'google') : null;
}

async function googleSigningKey(kid) {
  if (!googleKeys || Date.now() >= googleKeys.expires || !googleKeys.keys.some((key) => key.kid === kid)) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { redirect: 'error' });
    if (!response.ok) throw new Error('Google signing keys unavailable');
    const { keys } = await response.json();
    const ttl = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 60);
    googleKeys = { keys, expires: Date.now() + Math.min(ttl, 86400) * 1000 };
  }
  return googleKeys.keys.find((key) => key.kid === kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
}

async function verifiedGoogleProfile(token, audience, nonce) {
  const parts = typeof token === 'string' && token.length <= 12000 ? token.split('.') : [];
  if (parts.length !== 3) throw new Error('Invalid ID token');
  const [header, payload, signature] = parts;
  const { alg, kid } = JSON.parse(decoder.decode(fromBase64url(header)));
  if (alg !== 'RS256' || typeof kid !== 'string') throw new Error('Invalid ID token header');
  const jwk = await googleSigningKey(kid);
  if (!jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(signature), encoder.encode(header + '.' + payload));
  if (!verified) throw new Error('Invalid signature');
  const claims = JSON.parse(decoder.decode(fromBase64url(payload)));
  const { iss, aud, azp, exp, iat, sub } = claims;
  const now = nowSeconds();
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(iss) || aud !== audience || (azp && azp !== audience)
      || claims.nonce !== nonce || !Number.isSafeInteger(exp) || exp <= now || !Number.isSafeInteger(iat) || iat > now + 60
      || typeof sub !== 'string' || !sub) throw new Error('Invalid ID token claims');
  const email = typeof claims.email === 'string' ? normalizeEmail(claims.email) : '';
  // Site access is granted by email, so use addresses Google currently controls.
  const googleManaged = email.endsWith('@gmail.com') || (typeof claims.hd === 'string' && !!claims.hd);
  if (!emailPattern.test(email) || email.length > 254 || claims.email_verified !== true || !googleManaged) return null;
  const name = typeof claims.name === 'string' ? claims.name.trim().slice(0, 150) : '';
  return { email, name };
}

async function googleAuth(request, url, env) {
  const path = url.pathname;
  if (path === '/auth/signout' && request.method === 'POST') {
    if (request.headers.get('origin') !== url.origin) fail(403, 'Откройте панель и повторите действие.');
    const token = readCookie(request, googleSessionCookie);
    if (validToken(token)) await q(env.DB, 'DELETE FROM google_sessions WHERE token_hash=?', await digest(token)).run();
    const target = request.headers.get('oai-authenticated-user-id') ? '/signout-with-chatgpt?return_to=%2F' : '/admin';
    return redirect(target, [authCookie(googleSessionCookie, '', 0)]);
  }
  if (request.method !== 'GET' || !['/auth/google', googleReturnPath].includes(path)) fail(404, 'Раздел не найден.');
  if (!googleReady(env, url)) return redirect('/admin?google=unavailable');
  const redirectUri = new URL(googleReturnPath, url.origin).href;
  if (path === '/auth/google') {
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
      scope: 'openid email profile', state, nonce, code_challenge: await digest(verifier), code_challenge_method: 'S256', prompt: 'select_account' });
    return redirect(auth.href, [authCookie(googleFlowCookie, [state, nonce, verifier].join('.'), googleFlowAge)]);
  }
  const clearFlow = authCookie(googleFlowCookie, '', 0);
  const abort = (reason) => redirect('/admin?google=' + reason, [clearFlow]);
  const [state, nonce, verifier, extra] = (readCookie(request, googleFlowCookie) || '').split('.');
  if (extra !== undefined || ![state, nonce, verifier].every(validToken) || state !== url.searchParams.get('state')) return abort('expired');
  if (url.searchParams.has('error')) return abort('cancelled');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) return abort('expired');
  let profile;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error',
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET, code_verifier: verifier, redirect_uri: redirectUri }) });
    if (!response.ok) return abort('failed');
    const { id_token: token } = await response.json();
    profile = await verifiedGoogleProfile(token, env.GOOGLE_CLIENT_ID, nonce);
  } catch {
    return abort('failed');
  }
  if (!profile) return abort('email');
  const { email, name } = profile;
  const db = env.DB;
  if (email !== normalizeEmail(env.OWNER_EMAIL) && !await q(db, 'SELECT 1 FROM site_admins WHERE email=? LIMIT 1', email).first()) {
    return abort('denied');
  }
  const token = randomToken();
  await q(db, 'DELETE FROM google_sessions WHERE expires_at<=?', nowSeconds()).run();
  await q(db, 'INSERT INTO google_sessions (token_hash, email, name, expires_at) VALUES (?, ?, ?, ?)',
    await digest(token), email, name, nowSeconds() + googleSessionAge).run();
  return redirect('/admin', [clearFlow, authCookie(googleSessionCookie, token, googleSessionAge)]);
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

async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Ожидался формат JSON.');
  const bytes = await readBodyBytes(request, 16384, 'Слишком большой запрос.');
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
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* invalid URL */ }
  fail(400, 'Укажите полную ссылку, начинающуюся с https://.');
}

function siteFields(data) {
  const name = field(data, 'name', 80, true);
  const type = field(data, 'type', 50, true);
  const description = field(data, 'description', 260);
  const theme = field(data, 'theme', 20, true);
  const currency = field(data, 'currency', 3, true);
  const status = field(data, 'status', 8, true);
  if (!themes.includes(theme) || !currencies.includes(currency) || !['draft', 'live'].includes(status)) fail(400, 'Проверьте настройки страницы.');
  return [name, type, description, theme, address(data, 'logo_url', true), address(data, 'cover_url', true),
    currency, status, ...Object.values(actionColumns).map((key) => address(data, key))];
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

async function itemInput(request) {
  const type = request.headers.get('content-type');
  if (!type?.toLowerCase().startsWith('multipart/form-data;')) {
    const data = await body(request);
    if (data.remove_photo != null && typeof data.remove_photo !== 'boolean') fail(400, 'Проверьте настройки фотографии.');
    return { fields: itemFields(data), removePhoto: data.remove_photo === true, photo: null };
  }
  const tooLarge = 'Фото для загрузки должно быть не больше 6 МБ.';
  const raw = await readBodyBytes(request, photoLimit + 32768, tooLarge);
  let form;
  try {
    form = await new Response(raw, { headers: { 'Content-Type': type } }).formData();
  } catch {
    fail(400, 'Не удалось прочитать фотографию.');
  }
  const payload = form.get('payload');
  const photo = form.get('photo');
  if (typeof payload !== 'string' || payload.length > 16384 || !(photo instanceof File) || !photo.size) {
    fail(400, 'Выберите фотографию и заполните данные позиции.');
  }
  if (photo.size > photoLimit) fail(413, tooLarge);
  const fields = itemFields(parseBody(payload));
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const extension = photoFormat(bytes);
  if (!extension) fail(415, 'Выберите фотографию в формате JPEG, PNG или WebP.');
  return { fields, removePhoto: false, photo: { bytes, extension } };
}

function itemWithPhoto({ photo_key: key, ...item }, preview = false) {
  const photo_url = key ? photoPrefix + key + (preview ? '?preview=1' : '') : null;
  return { ...item, photo_url };
}

async function uploadPhoto(env, photo) {
  if (!photo) return null;
  if (!env.BUCKET) fail(503, 'Хранилище фотографий временно недоступно.');
  const key = newId() + '.' + photo.extension;
  await env.BUCKET.put(key, photo.bytes, { httpMetadata: { contentType: photoTypes[photo.extension] } });
  return key;
}

async function removePhotoIfUnused(env, key) {
  if (!key || !env.BUCKET) return;
  try {
    if (!await q(env.DB, 'SELECT 1 FROM items WHERE photo_key=?', key).first()) await env.BUCKET.delete(key);
  } catch (error) {
    console.error('Failed to remove unused menu photo', error);
  }
}

async function editItem(request, env, site, id) {
  const db = env.DB;
  const { fields, photo, removePhoto } = await itemInput(request);
  if (!photo && !removePhoto) {
    const result = await q(db, 'UPDATE items SET name=?, category=?, description=?, price=?, available=? WHERE site_id=? AND id=?',
      ...fields, site.id, id).run();
    if (!result.meta.changes) fail(404, 'Позиция не найдена.');
    return;
  }
  const current = await q(db, 'SELECT photo_key FROM items WHERE site_id=? AND id=?', site.id, id).first();
  if (!current) fail(404, 'Позиция не найдена.');
  const key = await uploadPhoto(env, photo);
  try {
    const result = await q(db, `UPDATE items SET name=?, category=?, description=?, price=?, available=?, photo_key=?
      WHERE site_id=? AND id=? AND photo_key IS ?`, ...fields, key, site.id, id, current.photo_key).run();
    if (!result.meta.changes) fail(409, 'Позиция изменилась. Откройте её заново.');
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

async function servePhoto(request, url, env) {
  const key = url.pathname.slice(photoPrefix.length);
  const format = key.match(photoKeyPattern)?.[1];
  const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!format || !env.BUCKET) return notFound();
  const item = await q(env.DB, `SELECT s.id AS site_id, s.status, i.available FROM items i
    JOIN sites s ON s.id=i.site_id WHERE i.photo_key=?`, key).first();
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

async function overview(db, user, url) {
  const filter = user.role === 'owner' ? '' : ' WHERE EXISTS (SELECT 1 FROM site_admins a WHERE a.site_id = s.id AND a.email = ?)';
  const args = user.role === 'owner' ? [] : [user.email];
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
  return { user, days, current, comparison, series, tips, sites: sites.map((site) => ({ ...site, ...summaries.get(site.id) })) };
}

async function api(request, url, env) {
  const db = env.DB;
  const user = await actor(request, env);
  if (url.pathname === '/api/session' && request.method === 'GET') return json({
    user, ownerConfigured: !!env.OWNER_EMAIL || !!env.DEMO_MODE, googleAvailable: googleReady(env, url),
  });
  if (!user) fail(401, 'Войдите в панель управления.');
  const method = request.method;
  if (!['GET', 'HEAD'].includes(method)) {
    if (request.headers.get('origin') !== url.origin) fail(403, 'Откройте панель и повторите действие.');
  }
  if (url.pathname === '/api/overview' && method === 'GET') return json(await overview(db, user, url));
  if (url.pathname === '/api/sites' && method === 'POST') {
    if (user.role !== 'owner') fail(403, 'Создавать сайты может владелец.');
    const data = await body(request);
    const slug = field(data, 'slug', 48, true).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reserved.has(slug)) fail(400, 'Используйте латиницу, цифры и дефисы в адресе.');
    if (await findSite(db, slug)) fail(409, 'Этот адрес уже используется.');
    try {
      await q(db, `INSERT INTO sites (id, slug, name, type, description, theme, logo_url, cover_url, currency, status,
        maps_url, telegram_url, instagram_url, vk_url, nfc_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(), slug, ...siteFields(data), newId(), new Date().toISOString()).run();
    } catch (error) {
      if (/UNIQUE constraint failed: sites.slug/.test(error.message)) fail(409, 'Этот адрес уже используется.');
      throw error;
    }
    return json({ site: await findSite(db, slug) }, 201);
  }
  const route = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)(?:\/(items|admins|tips)(?:\/([^/]+))?)?$/);
  if (!route) fail(404, 'Раздел не найден.');
  const [, slug, section, key] = route;
  const site = await allowedSite(db, user, slug);
  if (!section && method === 'GET') {
    const items = await all(db, 'SELECT * FROM items WHERE site_id = ? ORDER BY created_at, name', site.id);
    const admins = user.role === 'owner' ? await all(db, 'SELECT email FROM site_admins WHERE site_id = ? ORDER BY email', site.id) : [];
    const tips = user.role === 'owner' ? getTipForm(await tipSettings(db, site.id), env) : null;
    return json({ site, items: items.map((item) => itemWithPhoto(item, true)), admins, tips });
  }
  if (section === 'tips' && !key && method === 'PUT') {
    if (user.role !== 'owner') fail(403, 'Настройки чаевых доступны владельцу.');
    await saveTipSettings(env, site.id, await body(request));
    return json({ ok: true });
  }
  if (!section && method === 'PUT') {
    if (user.role !== 'owner') fail(403, 'Настройки сайта доступны владельцу.');
    await q(db, `UPDATE sites SET name=?, type=?, description=?, theme=?, logo_url=?, cover_url=?, currency=?, status=?,
      maps_url=?, telegram_url=?, instagram_url=?, vk_url=? WHERE id=?`, ...siteFields(await body(request)), site.id).run();
    return json({ site: await findSite(db, slug) });
  }
  if (section === 'items') {
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
      const item = await q(db, 'DELETE FROM items WHERE site_id=? AND id=? RETURNING photo_key', site.id, key).first();
      if (!item) fail(404, 'Позиция не найдена.');
      await removePhotoIfUnused(env, item.photo_key);
      return json({ ok: true });
    }
  }
  if (section === 'admins') {
    if (user.role !== 'owner') fail(403, 'Управлять доступом может владелец.');
    if (!key && method === 'POST') {
      const email = normalizeEmail((await body(request)).email);
      if (email.length > 254 || !emailPattern.test(email) || email === user.email) fail(400, 'Укажите email администратора.');
      await q(db, 'INSERT INTO site_admins (site_id, email) VALUES (?, ?) ON CONFLICT DO NOTHING', site.id, email).run();
      return json({ ok: true }, 201);
    }
    if (key && method === 'DELETE') {
      let email;
      try { email = decodeURIComponent(key); } catch { fail(400, 'Некорректный адрес.'); }
      await q(db, 'DELETE FROM site_admins WHERE site_id=? AND email=?', site.id, email).run();
      return json({ ok: true });
    }
  }
  fail(405, 'Действие недоступно.');
}

async function count(db, site, kind, source) {
  await q(db, `INSERT INTO events (site_id, kind, source, day) VALUES (?, ?, ?, ?)
    ON CONFLICT (site_id, day, kind, source) DO UPDATE SET count = events.count + 1`, site.id, kind, source, dayKey()).run();
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

async function startCheckout(request, url, env, site, settings, source) {
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
  if (!intent || !paymentIdPattern.test(intent.id || '') || !Number.isSafeInteger(intent.expires) || intent.expires < nowSeconds()
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
  try {
    const response = await fetch(checkoutEndpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Basic ' + btoa(settings.shop_id + ':' + privateKey), Accept: 'application/json',
        'Content-Type': 'application/json', 'X-API-Version': '2', RequestID: id }, body: JSON.stringify(options) });
    if (response.ok) {
      const { checkout } = await response.json();
      const url = trustedPaymentUrl(checkout?.redirect_url, ['bepaid.by']);
      if (url?.origin === checkoutOrigin && url.pathname === '/v2/checkout' && typeof checkout.token === 'string'
          && checkout.token && url.searchParams.get('token') === checkout.token) destination = url.href;
    }
  } catch { /* A new form can be issued after a provider or network error. */ }
  if (!destination) fail(502, 'bePaid пока не открыл страницу оплаты. Попробуйте ещё раз.');
  await q(db, 'UPDATE tip_payments SET checkout_url=? WHERE id=?', destination, id).run();
  if (!test) await recordTipOpen(db, site.id, checkoutMethod, source);
  return redirect(destination);
}

async function bePaidNotification(request, env, id) {
  if (!paymentIdPattern.test(id)) fail(404, 'Платёж не найден.');
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

async function tipsPage(request, url, env, assets, site, parts, preview, source, query) {
  const [, section, paymentId] = parts;
  const publicSite = { name: site.name, slug: site.slug, theme: site.theme, logo_url: site.logo_url, type: site.type };
  const data = { site: publicSite, query, draftPreview: site.status === 'draft' && preview };
  const missing = () => shell(assets, null, 404, { view: 'missing' });
  if (section === 'result') {
    if (request.method === 'POST' || !paymentIdPattern.test(paymentId || '')) return missing();
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
    if (request.method === 'GET') await recordTipOpen(env.DB, site.id, method, source);
    return redirect(normalizedLinks(settings)[method].url);
  }
  if (request.method === 'POST') {
    if (preview || !section) return missing();
    try { return await startCheckout(request, url, env, site, settings, source); }
    catch (error) {
      if (!error.status) console.error('Could not initialize bePaid checkout');
      return shell(assets, { ...data, view: 'tip-error', error: error.status ? error.message : 'Не удалось открыть оплату.' }, error.status || 502);
    }
  }
  const intent = preview ? '' : await protectTipValue(env, site.id + ':intent:' + url.origin,
    JSON.stringify({ id: newId(), expires: nowSeconds() + tipIntentLifetime, version: await tipVersion(settings) }));
  return shell(assets, { ...data, view: 'tip-amount', chosen, intent });
}

async function publicPage(request, url, env, assets) {
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
    return tipsPage(request, url, env, assets, site, tipRoute.slice(1), !!previewAllowed, source, query);
  }
  if (section?.startsWith('go/')) {
    const destination = Object.hasOwn(actionColumns, action) ? site[actionColumns[action]] : '';
    if (!destination) return shell(assets, null, 404, { view: 'missing' });
    if (!previewAllowed && request.method === 'GET') await count(db, site, action, source);
    return redirect(destination);
  }
  const wantsMenu = section === 'menu';
  if (!previewAllowed && request.method === 'GET') await count(db, site, wantsMenu ? 'menu' : 'visit', source);
  const { nfc_key, ...publicSite } = site;
  const items = wantsMenu
    ? await all(db, 'SELECT id, name, category, description, price, photo_key FROM items WHERE site_id=? AND available=1 ORDER BY created_at, name', site.id)
    : [];
  const tips = wantsMenu ? [] : activeTips(await tipSettings(db, site.id), env);
  return shell(assets, { view: wantsMenu ? 'menu' : 'public', site: publicSite,
    items: items.map((item) => itemWithPhoto(item, !!previewAllowed)), tips, query, draftPreview: site.status === 'draft' });
}

export function createApp(assets) {
  return {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        const path = url.pathname;
        if (path.startsWith('/api/')) return await api(request, url, env);
        if (['/auth/google', googleReturnPath, '/auth/signout'].includes(path)) return await googleAuth(request, url, env);
        if (request.method === 'POST' && path.startsWith('/webhooks/bepaid/')) {
          return await bePaidNotification(request, env, path.slice('/webhooks/bepaid/'.length));
        }
        if (request.method === 'POST' && /^\/[a-z0-9-]+\/tips\/bepaid\/?$/.test(path)) {
          return await publicPage(request, url, env, assets);
        }
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Действие недоступно.' }, 405);
        if (path.startsWith(photoPrefix)) return await servePhoto(request, url, env);
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
        return await publicPage(request, url, env, assets);
      } catch (error) {
        if (!error.status) console.error(error);
        return json({ error: error.status ? error.message : 'Внутренняя ошибка. Обновите страницу и попробуйте ещё раз.' }, error.status || 500);
      }
    },
  };
}

export { dayKey, todayOffset };
