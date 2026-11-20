const actionColumns = { maps: 'maps_url', telegram: 'telegram_url', instagram: 'instagram_url', vk: 'vk_url' };
const currencies = ['BYN', 'RUB', 'KZT', 'USD', 'EUR'];
const themes = ['coffee', 'indigo', 'garden', 'lavender'];
const reserved = new Set(['admin', 'api', 'assets', 'callback', 'signin-with-chatgpt', 'signout-with-chatgpt', 'favicon.ico']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Minsk', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (date = new Date()) => dayFmt.format(date);
const todayOffset = (days) => new Date(Date.parse(dayKey() + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const newId = () => crypto.randomUUID();
const q = (db, sql, ...values) => values.length ? db.prepare(sql).bind(...values) : db.prepare(sql);
const all = async (db, sql, ...values) => (await q(db, sql, ...values).all()).results;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const redirect = (url) => new Response(null, { status: 303, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
const findSite = (db, slug) => q(db, 'SELECT * FROM sites WHERE slug = ?', slug).first();
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

function actor(request, env) {
  if (env.DEMO_MODE) {
    if (request.headers.get('x-demo-role') === 'manager') return { role: 'manager', name: 'Анна', email: 'manager@demo.tap', demo: true };
    return { role: 'owner', name: 'Владелец', email: 'owner@demo.tap', demo: true };
  }
  if (!request.headers.get('oai-authenticated-user-id')) return null;
  const email = normalizeEmail(request.headers.get('oai-authenticated-user-email'));
  if (!email) return null;
  const rawName = request.headers.get('oai-authenticated-user-full-name');
  let name = rawName || email.split('@')[0];
  if (rawName && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(rawName); } catch { name = email.split('@')[0]; }
  }
  return { role: email === normalizeEmail(env.OWNER_EMAIL) ? 'owner' : 'manager', name, email, demo: false };
}

async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Ожидался формат JSON.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Укажите данные.');
  const decoder = new TextDecoder();
  let size = 0;
  let raw = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      fail(413, 'Слишком большой запрос.');
    }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    const data = JSON.parse(raw + decoder.decode());
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch { /* malformed JSON */ }
  fail(400, 'Не удалось прочитать данные.');
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
  return { user, days, current, comparison, series, sites: sites.map((site) => ({ ...site, ...summaries.get(site.id) })) };
}

async function api(request, url, env) {
  const db = env.DB;
  const user = actor(request, env);
  if (url.pathname === '/api/session' && request.method === 'GET') return json({ user, ownerConfigured: !!env.OWNER_EMAIL || !!env.DEMO_MODE });
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
  const route = url.pathname.match(/^\/api\/sites\/([a-z0-9-]+)(?:\/(items|admins)(?:\/([^/]+))?)?$/);
  if (!route) fail(404, 'Раздел не найден.');
  const [, slug, section, key] = route;
  const site = await allowedSite(db, user, slug);
  if (!section && method === 'GET') {
    const items = await all(db, 'SELECT * FROM items WHERE site_id = ? ORDER BY created_at, name', site.id);
    const admins = user.role === 'owner' ? await all(db, 'SELECT email FROM site_admins WHERE site_id = ? ORDER BY email', site.id) : [];
    return json({ site, items, admins });
  }
  if (!section && method === 'PUT') {
    if (user.role !== 'owner') fail(403, 'Настройки сайта доступны владельцу.');
    await q(db, `UPDATE sites SET name=?, type=?, description=?, theme=?, logo_url=?, cover_url=?, currency=?, status=?,
      maps_url=?, telegram_url=?, instagram_url=?, vk_url=? WHERE id=?`, ...siteFields(await body(request)), site.id).run();
    return json({ site: await findSite(db, slug) });
  }
  if (section === 'items') {
    if (!key && method === 'POST') {
      await q(db, 'INSERT INTO items (id, site_id, name, category, description, price, available, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newId(), site.id, ...itemFields(await body(request)), new Date().toISOString()).run();
      return json({ ok: true }, 201);
    }
    if (key && method === 'PUT') {
      const result = await q(db, 'UPDATE items SET name=?, category=?, description=?, price=?, available=? WHERE site_id=? AND id=?',
        ...itemFields(await body(request)), site.id, key).run();
      if (!result.meta.changes) fail(404, 'Позиция не найдена.');
      return json({ ok: true });
    }
    if (key && method === 'DELETE') {
      const result = await q(db, 'DELETE FROM items WHERE site_id=? AND id=?', site.id, key).run();
      if (!result.meta.changes) fail(404, 'Позиция не найдена.');
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
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
  } });
}

async function publicPage(request, url, env, assets) {
  const route = url.pathname.match(/^\/([a-z0-9-]+)(?:\/(menu|go\/([a-z]+)))?\/?$/);
  if (!route || reserved.has(route[1])) return shell(assets, null, 404, { view: 'missing' });
  const [, slug, section, action] = route;
  const db = env.DB;
  const site = await findSite(db, slug);
  if (!site) return shell(assets, null, 404, { view: 'missing' });
  const preview = url.searchParams.get('preview') === '1';
  const user = preview ? actor(request, env) : null;
  const previewAllowed = user && (user.role === 'owner' || await q(db, 'SELECT 1 FROM site_admins WHERE site_id=? AND email=?', site.id, user.email).first());
  if (site.status !== 'live' && !previewAllowed) return shell(assets, null, 404, { view: 'missing' });
  const source = url.searchParams.get('nfc') === site.nfc_key ? 'nfc' : 'direct';
  if (section?.startsWith('go/')) {
    const destination = Object.hasOwn(actionColumns, action) ? site[actionColumns[action]] : '';
    if (!destination) return shell(assets, null, 404, { view: 'missing' });
    if (!previewAllowed && request.method === 'GET') await count(db, site, action, source);
    return redirect(destination);
  }
  const wantsMenu = section === 'menu';
  if (!previewAllowed && request.method === 'GET') await count(db, site, wantsMenu ? 'menu' : 'visit', source);
  const next = new URLSearchParams();
  if (source === 'nfc') next.set('nfc', site.nfc_key);
  if (previewAllowed) next.set('preview', '1');
  const query = next.size ? '?' + next : '';
  const { nfc_key, ...publicSite } = site;
  const items = wantsMenu
    ? await all(db, 'SELECT id, name, category, description, price FROM items WHERE site_id=? AND available=1 ORDER BY created_at, name', site.id)
    : [];
  return shell(assets, { view: wantsMenu ? 'menu' : 'public', site: publicSite, items, query });
}

export function createApp(assets) {
  return {
    async fetch(request, env) {
      try {
        const url = new URL(request.url);
        const path = url.pathname;
        if (path.startsWith('/api/')) return await api(request, url, env);
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Действие недоступно.' }, 405);
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
        if (path === '/' || path === '/admin' || path.startsWith('/admin/')) return shell(assets);
        return await publicPage(request, url, env, assets);
      } catch (error) {
        if (!error.status) console.error(error);
        return json({ error: error.status ? error.message : 'Внутренняя ошибка. Обновите страницу и попробуйте ещё раз.' }, error.status || 500);
      }
    },
  };
}

export { dayKey, todayOffset };
