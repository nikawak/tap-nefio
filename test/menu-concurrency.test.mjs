import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readAssets } from '../scripts/assets.mjs';
import { seedDemo } from '../scripts/demo.mjs';
import { createApp } from '../src/worker.js';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sitePath = '/api/sites/moka-coffee';
const itemsPath = sitePath + '/items';

function fixture(t, onUpload) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys=ON');
  for (const { tag } of JSON.parse(read('drizzle/meta/_journal.json')).entries) {
    if (tag === '0005_menu_versions') seedDemo(db);
    for (const sql of read('drizzle/' + tag + '.sql').split('--> statement-breakpoint')) db.exec(sql);
  }
  const prepare = (sql, args = []) => ({
    bind: (...values) => prepare(sql, values),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: db.prepare(sql).run(...args) }),
  });
  const photos = new Map();
  const env = { DEMO_MODE: true, DB: { prepare }, BUCKET: {
    async put(key, bytes) { photos.set(key, bytes); await onUpload?.(); },
    async delete(key) { photos.delete(key); },
  } };
  const app = createApp(readAssets());
  const origin = 'https://tap.example.test';
  function request(path, { method = 'GET', body, version, role = 'owner' } = {}) {
    const headers = { origin, 'x-demo-role': role };
    if (version != null) headers['If-Match'] = '"' + version + '"';
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    return app.fetch(new Request(origin + path, { method, headers, body }), env);
  }
  const menu = async (role) => (await request(sitePath, { role })).json();
  return { db, menu, photos, request };
}

function fields(item, patch = {}) {
  const { name, category, description, price, available } = item;
  return { name, category, description, price, available: Boolean(available), ...patch };
}

test('assigned administrators can switch to an external menu and restore the built-in menu', async (t) => {
  const { menu, request } = fixture(t);
  const link = (menu_url, previous_url = '', path = itemsPath) =>
    request(path + '/link', { role: 'manager', method: 'PUT', body: { menu_url, previous_url } });
  const url = 'https://example.test/actual-menu.pdf';
  assert.equal((await link(url, '', '/api/sites/basilico/items')).status, 404);
  assert.equal((await link('javascript:alert(1)')).status, 400);
  assert.equal((await link(url)).status, 200);
  const guest = await request('/moka-coffee/menu?nfc=moka-demo');
  assert.equal(guest.status, 303);
  assert.equal(guest.headers.get('location'), url);
  assert.equal((await menu('manager')).site.menu_url, url);
  assert.equal((await link('')).status, 412);
  assert.equal((await link('', url)).status, 200);
  assert.equal((await request('/moka-coffee/menu')).status, 200);
});

test('JSON menu imports are all-or-nothing, scoped to the site, and safe to retry', async (t) => {
  const { menu, request } = fixture(t);
  const items = JSON.parse(read('public/menu-template.json')).items;
  items[1].available = false;
  const upload = (body, path = itemsPath) => request(path + '/import', { method: 'POST', body, role: 'manager' });
  const initial = await menu('manager');
  assert.equal((await upload({ items }, '/api/sites/basilico/items')).status, 404);
  assert.equal((await upload({ items, currency: 'USD' })).status, 400);
  const invalid = await upload({ items: [items[0], { ...items[1], price: 'wrong' }] });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /№2/);
  assert.deepEqual((await menu('manager')).items, initial.items);
  const imported = await upload({ currency: 'BYN', items });
  assert.equal(imported.status, 201);
  assert.deepEqual(await imported.json(), { added: 2, skipped: 0 });
  const next = await menu('manager');
  assert.ok(next.menuOrderVersion > initial.menuOrderVersion);
  assert.deepEqual(next.items.slice(0, initial.items.length), initial.items);
  assert.deepEqual(next.items.slice(-2).map(({ name, price, available }) => ({ name, price, available })),
    [{ name: items[0].name, price: 550, available: 1 }, { name: items[1].name, price: 420, available: 0 }]);
  assert.deepEqual(await (await upload({ items })).json(), { added: 0, skipped: 2 });
  assert.equal((await menu('manager')).items.length, initial.items.length + 2);
});

test('public menu and website buttons default to hidden and can be set independently', async (t) => {
  const { menu, request } = fixture(t);
  const appCode = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const website = 'https://coffee.example.test/';
  const externalMenu = 'https://coffee.example.test/order';
  async function landing() {
    const response = await request('/moka-coffee');
    assert.equal(response.status, 200);
    const model = JSON.parse((await response.text()).match(/id="page-data">([^<]*)<\/script>/)[1]);
    const app = { innerHTML: '', querySelector() { return null; } };
    const elements = { '#app': app, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
    runInNewContext(appCode + '\nlanding(model);', { model, document: {
      querySelector: (selector) => elements[selector], body: { classList: { add() {} } },
    } });
    return { model, markup: app.innerHTML };
  }
  const menuLink = (show_menu, previous_show_menu, previous_url) => request(itemsPath + '/link', {
    role: 'manager', method: 'PUT', body: { menu_url: externalMenu, show_menu, previous_show_menu, previous_url },
  });
  const websiteButton = (show_website, previous_show_website, previous_url, website_url = website, role = 'owner') =>
    request(sitePath + '/website', { role, method: 'PUT', body: { website_url, show_website, previous_show_website, previous_url } });

  const initial = await menu();
  assert.equal(initial.site.show_menu, 0);
  assert.equal(initial.site.show_website, 0);
  assert.doesNotMatch((await landing()).markup, /Открыть меню|Официальный сайт/);
  assert.equal((await request('/moka-coffee/menu')).status, 200);

  assert.equal((await menuLink(true, false, '')).status, 200);
  assert.match((await landing()).markup, /href="\/moka-coffee\/menu"[^>]*target="_top"/);
  assert.equal((await menuLink(false, false, externalMenu)).status, 412);
  assert.equal((await menuLink(false, true, externalMenu)).status, 200);
  assert.doesNotMatch((await landing()).markup, /Открыть меню/);
  assert.equal((await request('/moka-coffee/menu')).headers.get('location'), externalMenu);
  assert.equal((await menu()).items.length, initial.items.length);

  assert.equal((await websiteButton(true, false, '', website, 'manager')).status, 403);
  assert.equal((await websiteButton(true, false, '', '')).status, 400);
  assert.equal((await websiteButton(true, false, '', 'javascript:void(0)')).status, 400);
  assert.equal((await websiteButton(true, false, '')).status, 200);
  const enabled = await landing();
  assert.match(enabled.markup, /href="https:\/\/coffee\.example\.test\/"[^>]*>.*Официальный сайт/);
  assert.doesNotMatch(enabled.markup, /Открыть меню/);
  assert.equal((await websiteButton(false, true, website)).status, 200);
  const hidden = await landing();
  assert.doesNotMatch(hidden.markup, /Официальный сайт/);
  assert.equal(hidden.model.site.website_url, undefined);
  assert.equal((await menu()).site.website_url, website);
});

test('private feedback is scoped to the venue, facilitates retries, and can be marked as read', async (t) => {
  const { menu, request } = fixture(t);
  const feedback = '/api/feedback/moka-coffee?nfc=moka-demo';
  const inbox = sitePath + '/feedback';
  const sample = { id: crypto.randomUUID(), rating: 2, comment: 'Долго ждали заказ', guest_name: 'Саша', guest_place: 'У окна' };
  const send = (body, path = feedback) => request(path, { method: 'POST', body });
  const { site } = await menu('manager');
  const configure = (path, role) => request(path + '/guest', { method: 'PUT', role, version: 1,
    body: { guest_order: site.guest_order, show_reviews: true, google_review_url: 'https://maps.google.com/' } });
  assert.equal((await send(sample)).status, 404);
  assert.equal((await configure(sitePath, 'manager')).status, 200);
  assert.equal((await configure('/api/sites/basilico', 'owner')).status, 200);
  assert.equal((await send({ ...sample, rating: 5 })).status, 400);
  assert.equal((await send({ ...sample, comment: '   ' })).status, 400);
  assert.equal((await send(sample, '/api/feedback/forma-studio')).status, 404);
  assert.equal((await send(sample)).status, 201);
  assert.equal((await send(sample)).status, 201);
  assert.equal((await send({ ...sample, id: crypto.randomUUID(), rating: 1, guest_name: '', guest_place: '' },
    '/api/feedback/moka-coffee')).status, 201);
  assert.equal((await send(sample, '/api/feedback/basilico')).status, 201);
  assert.equal((await menu('manager')).unreadFeedback, 2);
  const get = async (query = '') => (await request(inbox + query, { role: 'manager' })).json();
  const { reviews } = await get('?sort=lowest');
  assert.deepEqual(reviews.map((row) => [row.rating, row.source]), [[1, 'direct'], [2, 'nfc']]);
  const { reviews: [found] } = await get('?rating=2&status=unread');
  assert.equal(found.guest_name, sample.guest_name);
  assert.equal(found.guest_place, sample.guest_place);
  assert.equal(found.comment, sample.comment);
  assert.equal(Number.isFinite(Date.parse(found.created_at)), true);
  assert.equal((await request('/api/sites/basilico/feedback', { role: 'manager' })).status, 404);
  assert.equal((await request(inbox + '/' + sample.id, { method: 'PUT', role: 'manager' })).status, 200);
  assert.equal((await menu('manager')).unreadFeedback, 1);
  assert.equal((await get('?rating=2&status=unread')).reviews.length, 0);
  assert.equal((await get('?status=read')).reviews[0].id, sample.id);
  const global = async (role, query = '') => (await (await request('/api/feedback' + query, { role })).json()).reviews;
  assert.deepEqual((await global('manager', '?sort=lowest')).map(({ site_slug, rating }) => [site_slug, rating]), [['moka-coffee', 1], ['moka-coffee', 2]]);
  assert.equal((await global('manager', '?site=basilico')).length, 0);
  assert.deepEqual((await global('owner', '?site=basilico')).map(({ site_name }) => site_name), ['Basilico']);
  assert.equal((await global('owner')).length, 3);
  assert.equal((await request('/moka-coffee')).status, 200);
  assert.equal((await request('/moka-coffee/go/maps')).status, 404);
});

test('guest blocks can be reordered by assigned administrators, and the rating requires an enabled link', async (t) => {
  const { menu, request } = fixture(t);
  const path = sitePath + '/guest';
  const { site } = await menu('manager');
  const guest_order = [...site.guest_order].reverse();
  const put = (patch, version = 1) => request(path, { method: 'PUT', role: 'manager', version,
    body: { guest_order, show_reviews: true, ...patch } });
  const page = async () => {
    const markup = await (await request('/moka-coffee')).text();
    const model = JSON.parse(markup.match(/id="page-data">([^<]*)<\/script>/)[1]);
    const app = { innerHTML: '', querySelector() { return null; } };
    const elements = { '#app': app, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
    runInNewContext(read('public/app.js').replace(/\bstart\(\);\s*$/, '') + '\nlanding(model);', { model, document: {
      querySelector: (selector) => elements[selector], body: { classList: { add() {} } },
    } });
    return { model, markup: app.innerHTML };
  };
  assert.equal((await request('/api/sites/basilico/guest', { method: 'PUT', role: 'manager', version: 1, body: {} })).status, 404);
  assert.equal((await put({ guest_order: guest_order.slice(1) })).status, 400);
  assert.equal((await put({ yandex_review_url: 'javascript:void(0)' })).status, 400);
  assert.equal((await put({})).status, 200);
  assert.doesNotMatch((await page()).markup, /data-open-feedback/);
  const yandex = 'https://yandex.by/maps/157/minsk/';
  const google = 'https://maps.google.com/';
  assert.equal((await put({ yandex_review_url: yandex })).status, 409);
  assert.equal((await put({ yandex_review_url: yandex }, 2)).status, 200);
  const visible = await page();
  assert.deepEqual(visible.model.site.guest_order, guest_order);
  assert.deepEqual(visible.model.reviewProviders, ['yandex']);
  assert.match(visible.markup, /Telegram[\s\S]*data-open-feedback/);
  assert.equal((await request('/moka-coffee/go/yandex')).headers.get('location'), yandex);
  assert.equal((await request('/moka-coffee/go/google')).status, 404);
  assert.equal((await put({ google_review_url: google }, 3)).status, 200);
  assert.deepEqual((await page()).model.reviewProviders, ['yandex', 'google']);
  assert.equal((await request('/moka-coffee/go/google')).headers.get('location'), google);
  assert.equal((await put({ show_reviews: false }, 4)).status, 200);
  const hidden = await page();
  assert.doesNotMatch(hidden.markup, /data-open-feedback/);
  assert.equal(hidden.model.site.google_review_url, undefined);
  assert.equal((await request('/moka-coffee/go/yandex')).status, 404);
  assert.equal((await menu('manager')).site.google_review_url, google);
  assert.match(hidden.markup, /class="public-social"[^>]*aria-label="Telegram"[^>]*><svg/);

  const saveGuest = (body, version) => request(path, { method: 'PUT', role: 'manager', version, body });
  assert.equal((await saveGuest({ maps_url: yandex }, 5)).status, 200);
  assert.equal((await request('/moka-coffee/go/maps')).headers.get('location'), yandex);
  assert.equal((await saveGuest({ show_reviews: true }, 6)).status, 200);
  const separate = await page();
  assert.deepEqual(separate.model.reviewProviders, ['yandex', 'google']);
  assert.deepEqual(separate.model.site.guest_order, guest_order);
  assert.equal(separate.model.site.maps_url, yandex);
  assert.equal((await saveGuest({ maps_url: '' }, 7)).status, 200);
  assert.equal((await request('/moka-coffee/go/maps')).status, 404);
  assert.deepEqual((await page()).model.reviewProviders, ['yandex', 'google']);
});

test('the production demo migration fills coffe1 without overwriting existing content or other venues', async (t) => {
  const { db, menu, request } = fixture(t);
  const original = (await menu()).site;
  const created = await request('/api/sites', { method: 'POST', body: {
    slug: 'coffe1', name: 'Кофе 01', type: 'Кофейня', theme: 'coffee', currency: 'BYN', status: 'live',
    website_url: 'https://example.test/', link_visibility: { website_url: true, maps_url: false, telegram_url: false, vk_url: false, instagram_url: false },
  } });
  assert.equal(created.status, 201);
  assert.equal((await request('/api/sites/coffe1/items', { method: 'POST', body: {
    name: 'Капучино', category: 'Кофе', price: 600, available: true,
  } })).status, 201);
  const fill = read('drizzle/0014_coffe1_demo.sql');
  db.exec(fill);
  assert.deepEqual((await menu()).site, original);
  const model = JSON.parse((await (await request('/coffe1/menu')).text()).match(/id="page-data">([^<]*)<\/script>/)[1]);
  assert.deepEqual(model.reviewProviders, ['yandex', 'google']);
  assert.equal(model.site.website_url, 'https://example.test/');
  assert.match(model.site.opening_hours, /^Демо:/);
  assert.equal(model.site.wifi_name, 'Tap Coffee Demo');
  assert.equal(model.site.show_menu, 1);
  assert.equal(model.items[0].name, 'Капучино');
  const { reviews } = await (await request('/api/feedback?site=coffe1')).json();
  assert.equal(reviews.length, 3);
  assert.ok(reviews.every(({ comment }) => comment.startsWith('Демо:')));
  assert.equal(reviews.filter(({ read_at }) => read_at !== null).length, 1);
});

test('guest hours and Wi-Fi are optional and can be hidden without losing saved values', async (t) => {
  const { menu, request } = fixture(t);
  const { site } = await menu();
  const fields = { ...site, show_hours: true, show_wifi: true, opening_hours: 'Пн–Пт 08:00–21:00\nСб–Вс 09:00–19:00',
    wifi_name: 'Guest Wi-Fi', wifi_password: ' guest2016 ' };
  assert.equal((await request(sitePath, { method: 'PUT', body: fields, role: 'manager' })).status, 403);
  assert.equal((await request(sitePath, { method: 'PUT', body: fields })).status, 200);
  const page = await request('/moka-coffee');
  const data = JSON.parse((await page.text()).match(/id="page-data">([^<]*)<\/script>/)[1]);
  assert.equal(data.site.opening_hours, fields.opening_hours);
  assert.equal(data.site.wifi_name, fields.wifi_name);
  assert.equal(data.site.wifi_password, fields.wifi_password);
  const { opening_hours, wifi_name, wifi_password, show_hours, show_wifi, ...oldClient } = fields;
  assert.equal((await request(sitePath, { method: 'PUT', body: oldClient })).status, 200);
  assert.equal((await menu()).site.wifi_password, wifi_password);
  assert.equal((await request(sitePath, { method: 'PUT', body: { ...oldClient, show_hours: false, show_wifi: false } })).status, 200);
  const hidden = JSON.parse((await (await request('/moka-coffee')).text()).match(/id="page-data">([^<]*)<\/script>/)[1]).site;
  assert.equal(hidden.opening_hours, undefined);
  assert.equal(hidden.wifi_name, undefined);
  assert.equal(hidden.wifi_password, undefined);
  const retained = (await menu()).site;
  assert.equal(retained.wifi_password, wifi_password);
  assert.equal(retained.opening_hours, opening_hours);
  assert.equal((await request(sitePath, { method: 'PUT', body: { ...fields, show_hours: false } })).status, 200);
  const wifiOnly = JSON.parse((await (await request('/moka-coffee')).text()).match(/id="page-data">([^<]*)<\/script>/)[1]).site;
  assert.equal(wifiOnly.opening_hours, undefined);
  assert.equal(wifiOnly.wifi_password, wifi_password);
});

test('site setup saves guest link visibility together and preserves disabled addresses', async (t) => {
  const { menu, request } = fixture(t);
  const original = (await menu()).site;
  assert.equal(original.show_maps, 0);
  assert.ok(original.maps_url);
  assert.equal((await request('/moka-coffee/go/maps')).status, 404);
  const settings = { ...original, website_url: 'https://coffee.example.test/', link_visibility: {
    website_url: true, maps_url: false, vk_url: false, telegram_url: true, instagram_url: false,
  } };
  const save = (body) => request(sitePath, { method: 'PUT', body });
  assert.equal((await save({ ...settings, website_url: '' })).status, 400);
  assert.equal((await save(settings)).status, 200);
  const data = (await menu()).site;
  assert.equal(data.maps_url, original.maps_url);
  assert.equal(data.website_url, settings.website_url);
  const publicPage = async () => {
    const response = await request('/moka-coffee');
    return JSON.parse((await response.text()).match(/id="page-data">([^<]*)<\/script>/)[1]).site;
  };
  const publicSite = await publicPage();
  assert.equal(publicSite.maps_url, undefined);
  assert.equal(publicSite.website_url, settings.website_url);
  assert.equal(publicSite.telegram_url, original.telegram_url);
  assert.equal((await request('/moka-coffee/go/maps')).status, 404);
  assert.equal((await request('/moka-coffee/go/telegram')).status, 303);
  assert.equal((await save({ ...settings, website_url: undefined, link_visibility: {
    ...settings.link_visibility, maps_url: true, website_url: false,
  } })).status, 200);
  assert.equal((await request('/moka-coffee/go/maps')).status, 303);
  assert.equal((await publicPage()).website_url, undefined);
  assert.equal((await menu()).site.website_url, settings.website_url);
  const { maps_url, ...linksWithoutMaps } = settings.link_visibility;
  assert.equal((await save({ ...settings, link_visibility: linksWithoutMaps })).status, 200);
  assert.equal((await publicPage()).maps_url, original.maps_url);
  const created = await request('/api/sites', { method: 'POST', body: { ...settings, slug: 'test-guest-links', link_visibility: linksWithoutMaps } });
  assert.equal(created.status, 201);
  const { site: createdSite } = await created.json();
  assert.equal(createdSite.website_url, settings.website_url);
  assert.equal(createdSite.maps_url, '');
});

test('a single site form shows optional guest fields only when selected', () => {
  const code = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const elements = { '#app': {}, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
  const { siteForm, guestLayoutForm, reviewSettings, updateSiteOptionFields } = runInNewContext(code + '\n({siteForm, guestLayoutForm, reviewSettings, updateSiteOptionFields});', {
    document: { querySelector: (selector) => elements[selector] },
  });
  for (const markup of [siteForm(), siteForm({ slug: 'venue', telegram_url: 'https://t.me/example' })]) {
    assert.equal((markup.match(/type="submit"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-site-toggle/g) ?? []).length, 6);
    assert.doesNotMatch(markup, /name="(?:enable_)?maps_url"/);
    assert.match(markup, /name="enable_website_url" data-site-toggle/);
    assert.match(markup, /data-site-fields hidden/);
    assert.match(markup, /name="show_hours" data-site-toggle\s*>/);
    assert.match(markup, /name="show_wifi" data-site-toggle\s*>/);
  }
  const site = { guest_order: ['maps'], guest_version: 1, show_maps: 1, maps_url: 'https://maps.example.test/' };
  assert.match(guestLayoutForm(site), /name="maps_url"[^>]*value="https:\/\/maps\.example\.test\/"/);
  assert.doesNotMatch(guestLayoutForm(site), /checkbox|review_url/);
  assert.match(reviewSettings(site), /name="yandex_review_url"/);
  assert.match(reviewSettings(site), /name="google_review_url"/);
  const input = { value: 'https://example.test/', hasAttribute: () => true };
  const wrapper = { querySelectorAll: () => [input] };
  const toggle = { checked: true, closest: () => ({ querySelector: () => wrapper }) };
  updateSiteOptionFields(toggle);
  assert.deepEqual([wrapper.hidden, input.disabled, input.required], [false, false, true]);
  toggle.checked = false;
  updateSiteOptionFields(toggle);
  assert.deepEqual([wrapper.hidden, input.disabled, input.required], [true, true, false]);
  assert.equal(input.value, 'https://example.test/');
});

test('the picker features five of 25 themes and venue administrators can only change their own theme', async (t) => {
  const { menu, request } = fixture(t);
  const code = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const elements = { '#app': {}, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
  const { markup, values } = runInNewContext(code + '\n({ markup: themePicker("coffee"), values: Object.keys(themes) });', {
    document: { querySelector: (selector) => elements[selector] },
  });
  assert.deepEqual(Array.from(markup.matchAll(/name="theme" value="([a-z]+)"/g), (match) => match[1]),
    ['light', 'dark', 'coffee', 'slate', 'garden']);
  assert.equal(values.length, 25);
  assert.match(markup, /Показать ещё/);
  const change = (theme, previous_theme, path = sitePath) => request(path + '/theme', {
    role: 'manager', method: 'PUT', body: { theme, previous_theme },
  });
  assert.equal((await change('peach', 'garden', '/api/sites/basilico')).status, 404);
  const original = (await menu()).site;
  assert.equal((await change('unknown', original.theme)).status, 400);
  let previous = original.theme;
  for (const theme of values) {
    assert.equal((await change(theme, previous)).status, 200);
    const response = await request('/moka-coffee');
    const model = JSON.parse((await response.text()).match(/id="page-data">([^<]*)<\/script>/)[1]);
    assert.equal(model.site.theme, theme);
    previous = theme;
  }
  assert.equal((await change('garden', 'coffee')).status, 409);
  assert.equal((await request(sitePath, { method: 'PUT', body: { ...original, previous_theme: 'coffee' } })).status, 409);
  assert.equal((await menu()).site.theme, 'copper');
});

test('catalogue preview and back preserve the theme until Apply is pressed', () => {
  const code = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const events = {};
  const grid = { innerHTML: 'preserved' };
  const form = { elements: { name: { value: 'Кофейня' } } };
  const picker = { closest: () => form, querySelector: (selector) =>
    selector === '[data-theme-choices]' ? grid : { value: 'coffee' } };
  const opener = { closest: () => picker, focus() {} };
  const dialog = {
    addEventListener(type, handler) { events[type] = handler; },
    setAttribute() {}, showModal() {}, remove() {},
    querySelector: () => ({ focus() {} }),
    close() { this.closed = true; events.close(); },
  };
  const elements = { '#app': {}, '#modal': { addEventListener() {} }, '#page-data': { textContent: '{}' } };
  runInNewContext(code + '\nopenThemeCatalogue(opener);', {
    opener, document: { querySelector: (selector) => elements[selector], createElement: () => dialog, body: { append() {} } },
  });
  const display = (name, value) => events.click({ stopPropagation() {}, target: { closest: (selector) =>
    selector === name ? { dataset: { themePreview: value } } : null } });
  assert.equal((dialog.innerHTML.match(/data-theme-preview=/g) ?? []).length, 25);
  display('[data-theme-preview]', 'rose');
  assert.match(dialog.innerHTML, /Предпросмотр · Пыльная роза/);
  assert.equal(grid.innerHTML, 'preserved');
  display('[data-theme-back]');
  assert.equal((dialog.innerHTML.match(/data-theme-preview=/g) ?? []).length, 25);
  assert.equal(grid.innerHTML, 'preserved');
  display('[data-theme-preview]', 'rose');
  display('[data-theme-apply]');
  assert.match(grid.innerHTML, /name="theme" value="rose" checked/);
  assert.equal(dialog.closed, true);
});

test('the rating dialog reveals only configured public links and keeps private feedback for low scores', () => {
  const code = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const listeners = {};
  const extra = { hidden: true };
  const thanks = { hidden: true };
  const links = { hidden: true };
  const nodes = { '.feedback-extra': extra, '.feedback-thanks': thanks, '.feedback-links': links, '.form-error': {}, 'button[type="submit"]': {} };
  const form = {
    elements: { comment: { required: false } },
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector: (selector) => nodes[selector],
    querySelectorAll: () => Array.from({ length: 5 }, () => ({ classList: { toggle() {} } })),
  };
  const modal = { addEventListener() {}, setAttribute() {}, showModal() {}, querySelector: () => form };
  const elements = { '#app': {}, '#modal': modal, '#page-data': { textContent: '{}' } };
  const open = runInNewContext(code + '\nfeedbackDialog;', {
    document: { querySelector: (selector) => elements[selector] }, URLSearchParams,
  });
  const props = { site: { slug: 'moka-coffee' }, query: '?nfc=moka-demo' };
  open({ ...props, reviewProviders: ['yandex', 'google'] });
  assert.match(modal.innerHTML, /feedback-links" hidden/);
  assert.match(modal.innerHTML, /href="\/moka-coffee\/go\/yandex\?nfc=moka-demo"[^>]*>.*Яндекс/);
  assert.match(modal.innerHTML, /href="\/moka-coffee\/go\/google\?nfc=moka-demo"[^>]*>.*Google/);
  listeners.change({ target: { name: 'rating', value: '2' } });
  assert.equal(extra.hidden, false);
  assert.equal(links.hidden, false);
  assert.equal(form.elements.comment.required, true);
  for (const rating of ['4', '5']) {
    listeners.change({ target: { name: 'rating', value: rating } });
    assert.equal(extra.hidden, true);
    assert.equal(thanks.hidden, false);
    assert.equal(links.hidden, false);
  }
  open({ ...props, reviewProviders: ['google'] });
  assert.doesNotMatch(modal.innerHTML, /Яндекс/);
});

function withPhoto(data) {
  const form = new FormData();
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKbkAAAAASUVORK5CYII=', 'base64');
  form.set('payload', JSON.stringify(data));
  form.set('photo', new Blob([pixel], { type: 'image/png' }), 'item.png');
  return form;
}

test('stale edits and deletes cannot overwrite newer changes to the same item', async (t) => {
  const { menu, request } = fixture(t);
  const { items: [first] } = await menu('owner');
  const { items: [stale, second] } = await menu('manager');
  const path = itemsPath + '/' + first.id;
  const edit = (item, patch, role) => request(itemsPath + '/' + item.id, {
    method: 'PUT', body: fields(item, patch), version: item.edit_version, role,
  });
  assert.equal(first.edit_version, 1);
  assert.equal((await request(path, { method: 'PUT', body: fields(first) })).status, 428);
  assert.equal((await edit(first, { price: 1200 }, 'owner')).status, 200);
  assert.equal((await edit(stale, { description: 'Из второй вкладки' }, 'manager')).status, 412);
  assert.equal((await request(path, { method: 'DELETE', version: stale.edit_version, role: 'manager' })).status, 412);
  assert.equal((await edit(second, { price: 1700 }, 'manager')).status, 200);
  const { items } = await menu('manager');
  const latest = items.find(({ id }) => id === first.id);
  assert.equal(latest.price, 1200);
  assert.equal(latest.description, first.description);
  assert.equal(items.find(({ id }) => id === second.id).price, 1700);
  assert.equal((await request(path, { method: 'DELETE', version: latest.edit_version, role: 'manager' })).status, 200);
  assert.equal((await edit(latest, { price: 1500 }, 'owner')).status, 412);
});

test('menu order version rejects stale moves after another move, an addition or a deletion', async (t) => {
  const { menu, request } = fixture(t);
  const original = await menu('owner');
  const [first, second, third, ...rest] = original.items.map(({ id }) => id);
  const move = (id, target, version, role) => request(itemsPath + '/order', { method: 'PUT', body: { id, target }, version, role });
  const order = (snapshot) => snapshot.items.map(({ id }) => id);
  assert.equal((await move(first, third, original.menuOrderVersion, 'owner')).status, 200);
  assert.equal((await move(second, third, original.menuOrderVersion, 'manager')).status, 412);
  const sorted = await menu('manager');
  assert.deepEqual(order(sorted), [second, third, first, ...rest]);
  assert.equal(sorted.items.find(({ id }) => id === first).edit_version, 1);
  assert.equal((await request(itemsPath, { method: 'POST', body: fields(sorted.items[0]) })).status, 201);
  assert.equal((await move(first, second, sorted.menuOrderVersion, 'manager')).status, 412);
  const added = await menu('manager');
  const item = added.items.find(({ id }) => id === third);
  assert.equal((await request(itemsPath + '/' + third, { method: 'DELETE', version: item.edit_version })).status, 200);
  assert.equal((await move(first, second, added.menuOrderVersion, 'manager')).status, 412);
  const reduced = await menu('manager');
  assert.equal((await move(first, second, reduced.menuOrderVersion, 'manager')).status, 200);
  assert.deepEqual(order(await menu('owner')).slice(0, 2), [first, second]);
});

test('a photo upload that loses an edit race removes only its unused upload', async (t) => {
  const uploaded = Promise.withResolvers();
  const finish = Promise.withResolvers();
  let pauseUpload = false;
  const { menu, photos, request } = fixture(t, async () => {
    if (pauseUpload) { uploaded.resolve(); await finish.promise; }
  });
  const { items: [first] } = await menu();
  const path = itemsPath + '/' + first.id;
  assert.equal((await request(path, { method: 'PUT', body: withPhoto(fields(first)), version: first.edit_version })).status, 200);
  const { items: [withExistingPhoto] } = await menu();
  const [existingKey] = photos.keys();
  pauseUpload = true;
  const editWithPhoto = request(path, { method: 'PUT', body: withPhoto(fields(withExistingPhoto, { price: 500 })),
    version: withExistingPhoto.edit_version, role: 'manager' });
  try {
    await Promise.race([uploaded.promise, editWithPhoto.then(() => assert.fail('Upload did not start'))]);
    assert.equal(photos.size, 2);
    const winner = await request(path, { method: 'PUT', body: fields(withExistingPhoto, { price: 1200 }), version: withExistingPhoto.edit_version });
    assert.equal(winner.status, 200);
  } finally {
    finish.resolve();
    await editWithPhoto;
  }
  assert.equal((await editWithPhoto).status, 412);
  const { items: [latest] } = await menu();
  assert.equal(latest.price, 1200);
  assert.equal(latest.photo_url, withExistingPhoto.photo_url);
  assert.deepEqual([...photos.keys()], [existingKey]);
});

test('the panel sends the version from the open form and refreshes the list without closing the draft', async () => {
  const code = read('public/app.js').replace(/\bstart\(\);\s*$/, '');
  const formError = { textContent: '' };
  const submit = { disabled: false };
  const form = { id: 'itemForm', dataset: { id: 'coffee', version: '1' }, elements: { available: { checked: true } },
    querySelector: (selector) => selector === '.form-error' ? formError : submit, querySelectorAll: () => [],
    values: { name: 'Черновик', category: 'Кофе', price: '10' } };
  class BrowserFormData {
    constructor(target) { this.values = Object.entries(target?.values ?? {}); }
    keys() { return this.values.map(([key]) => key).values(); }
    [Symbol.iterator]() { return this.values.values(); }
  }
  const modal = { addEventListener() {}, close() { assert.fail('Draft was closed'); } };
  const elements = { '#app': {}, '#modal': modal, '#page-data': { textContent: '{}' } };
  const calls = [];
  const user = { role: 'manager', name: 'Администратор' };
  const site = { slug: 'moka-coffee', currency: 'BYN' };
  const { state, onSubmit } = runInNewContext(code + '\n({state, onSubmit});', {
    document: { querySelector: (selector) => elements[selector] }, location: { pathname: '/admin/sites/moka-coffee' },
    URLSearchParams, FormData: BrowserFormData, AbortController,
    fetch: async (path, options) => {
      calls.push([path, options.headers['If-Match']]);
      if (options.method === 'PUT') return Response.json({ error: 'Позицию уже изменили.' }, { status: 412 });
      return Response.json({ user, site, items: [], menuOrderVersion: 3 });
    },
  });
  state.user = user;
  state.details = { site, items: [{ id: 'coffee', edit_version: 2 }] };
  await onSubmit({ target: form, preventDefault() {} });
  assert.deepEqual(calls, [[itemsPath + '/coffee', '"1"'], [sitePath, undefined]]);
  assert.match(formError.textContent, /Позицию уже изменили/);
  assert.equal(form.values.name, 'Черновик');
  assert.equal(submit.disabled, false);
});
