const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
let photoPreviewUrl;
modal.addEventListener('click', (event) => {
  if (event.target === modal || event.target.closest('[data-action="close-dialog"]')) modal.close();
});
modal.addEventListener('close', () => {
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = null;
});
const state = { data: null, user: null, days: 7, siteFilter: '', showAccount: false, mobileNav: false, details: null, pending: 0 };
const page = JSON.parse(document.querySelector('#page-data').textContent);
const icons = {
  nfc: '<path d="M4 11a13 13 0 0 1 16 0M7 14a8 8 0 0 1 10 0m-7 3a3.3 3.3 0 0 1 4 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  bars: '<rect x="3.5" y="11" width="3.8" height="8.5" rx="1"/><rect x="10.1" y="7" width="3.8" height="12.5" rx="1"/><rect x="16.7" y="3.5" width="3.8" height="16" rx="1"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  book: '<path d="M12 6v15M3.5 4.5h5A3.5 3.5 0 0 1 12 8v13a4.5 4.5 0 0 0-3.5-2h-5zm17 0h-5A3.5 3.5 0 0 0 12 8v13a4.5 4.5 0 0 1 3.5-2h5z"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  right: '<path d="m10 7 5 5-5 5"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17"/>',
  trend: '<path d="m3 17 6-6 4 4 7-8m-5 0h5v5"/>',
  external: '<path d="M13 4h7v7m0-7-8 8m5 1v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M9 4.6 10 2h4l1 2.6 2 .9 2.8-.5 2 3.5-1.8 2.2v2.6l1.8 2.2-2 3.5-2.8-.5-2 .9L14 22h-4l-1-2.6-2-.9-2.8.5-2-3.5L4 13.3v-2.6L2.2 8.5l2-3.5 2.8.5z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-14a3 3 0 0 1 0 6m4 8v-2a4 4 0 0 0-3-3.9"/>',
  pencil: '<path d="m15 5 4 4M4 20l4-.8L20 7l-3-3L4.8 16z"/>',
  trash: '<path d="M4 6h16M9 6V4h6v2m3 0-1 14H7L6 6m4 4v6m4-6v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  coffee: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zm11 1h2a2 2 0 1 1 0 4h-2M3 21h16M8 3v3m4-3v3"/>',
  leaf: '<path d="M20 4c-7 0-13 3-13 9a5 5 0 0 0 5 5c6 0 9-6 8-14ZM4 21c2-5 5-7 9-10"/>',
  spark: '<path d="M12 2c.9 6 3.9 9 10 10-6.1 1-9.1 4-10 10-.9-6-3.9-9-10-10 6.1-1 9.1-4 10-10Z"/>',
  social: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 11 7.6-4m-7.6 6 7.6 4"/>',
  telegram: '<path d="m3 11 17-7-3 16-6-5-3 3v-5zM8 13l7-5"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  map: '<path d="M19 10c0 5-7 10.5-7 10.5S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  link: '<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5m2.5 5.5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  shield: '<path d="M12 22s7.5-3.6 7.5-10V5L12 2 4.5 5v7C4.5 18.4 12 22 12 22Z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M11 5H5v14h6m-1-7h10m-4-4 4 4-4 4"/>',
};
const svg = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const html = (value = '') => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const nf = new Intl.NumberFormat('ru-RU');
const money = (value, currency) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(value / 100);
const dateLabel = (value, options) => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')).replace('.', '');
const actionInfo = {
  menu: ['Открытия меню', 'book', 'iris'], maps: ['Переходы к отзывам', 'star', 'peach'],
  instagram: ['Instagram', 'instagram', 'pink'], telegram: ['Telegram', 'telegram', 'sky'], vk: ['ВКонтакте', 'social', 'mint'],
};
const tipLinks = {
  alpha: '«нетмонет» · Альфа-Банк',
  moneyapp: 'MoneyApp · БСБ Банк',
  teacode: '«Чай-код» · Беларусбанк',
  'bepaid-link': 'Платёжная ссылка bePaid',
};
const tipLabels = { ...tipLinks, bepaid: 'Оплата картой через bePaid' };
const tipIcon = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 20.5 4.6 13C.5 8.6 6.4 2.4 10.8 6.9l1.2 1.2 1.2-1.2C17.6 2.4 23.5 8.6 19.4 13Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const themes = { coffee: 'Кофе', indigo: 'Индиго', garden: 'Базилик', lavender: 'Лаванда' };
const nextDay = (value, offset) => new Date(Date.parse(value + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
const nfcUrl = (site) => location.origin + '/' + site.slug + '?nfc=' + encodeURIComponent(site.nfc_key);
const signIn = '/signin-with-chatgpt?return_to=%2Fadmin';
const signOut = '/signout-with-chatgpt?return_to=%2F';
const googleMessages = {
  unavailable: 'Вход через Google ожидает подключения.',
  expired: 'Срок запроса истёк. Начните вход через Google заново.',
  cancelled: 'Вход через Google отменён.',
  failed: 'Не удалось войти через Google. Попробуйте ещё раз.',
  email: 'Для входа через Google используйте Gmail или Google Workspace.',
  denied: 'Для этого адреса пока нет доступа. Обратитесь к владельцу мини-сайта.',
};
const logo = (href = '/admin') => `<a class="brand" href="${href}" aria-label="Тап. Главная"><span class="brand-icon">${svg('nfc', 24)}</span><span>тап<span class="brand-dot">.</span></span></a>`;

async function api(path, options = {}) {
  const multipart = options.body instanceof FormData;
  const result = await fetch(path, {
    method: options.method || 'GET', credentials: 'same-origin',
    headers: { ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}),
      ...(state.demoRole ? { 'x-demo-role': state.demoRole } : {}) },
    body: multipart ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || 'Не удалось загрузить данные.');
  return data;
}

function route() {
  const [, , root, slug, tab] = location.pathname.split('/');
  if (root === 'analytics') return { name: 'analytics', title: 'Аналитика' };
  if (root === 'sites' && slug) return { name: 'detail', title: state.details?.site?.name || 'Мини-сайт', slug, tab: tab || 'menu' };
  if (root === 'sites') return { name: 'sites', title: 'Мини-сайты' };
  return { name: 'overview', title: 'Обзор' };
}

const navigation = [
  ['overview', 'Обзор', 'home', '/admin'],
  ['sites', 'Мини-сайты', 'globe', '/admin/sites'],
  ['analytics', 'Аналитика', 'bars', '/admin/analytics'],
];

function structure(current, content) {
  const user = state.user;
  return `<div class="workspace">
    <aside class="sidebar ${state.mobileNav ? 'opened' : ''}" aria-label="Навигация">
      <div class="sidebar-brand">${logo()}</div>
      <div class="nav-group"><p class="nav-label">Рабочее пространство</p>
        ${navigation.map(([key, label, icon, href]) => {
          const active = current.name === key || (key === 'sites' && current.name === 'detail');
          return `<a class="nav-link ${active ? 'active' : ''}" href="${href}" data-nav ${active ? 'aria-current="page"' : ''}>${svg(icon, 19)} <span>${label}</span></a>`;
        }).join('')}
      </div>
      <div class="sidebar-bottom">
        ${user.demo ? `<div class="demo-note"><span class="demo-dot"></span><div><strong>Демо-режим</strong><small>Пример рабочего пространства</small></div></div>` : ''}
      </div>
    </aside>
    ${state.mobileNav ? '<button class="nav-backdrop" data-action="mobile-nav" aria-label="Закрыть навигацию"></button>' : ''}
    <div class="main-frame">
      <header class="topbar">
        <div class="crumbs"><button class="icon-button mobile-toggle" type="button" data-action="mobile-nav" aria-label="Открыть навигацию">${svg('menu')}</button>
          <span class="crumb-root">Рабочее пространство</span><span class="crumb-separator">/</span>
          ${current.name === 'detail' ? `<a data-nav href="/admin/sites">Мини-сайты</a><span class="crumb-separator">/</span>` : ''}
          <strong>${html(current.title)}</strong>
        </div>
        <div class="account-wrap">
          <button class="account" data-action="account" aria-expanded="${state.showAccount}"><span class="avatar">${html(user.name.slice(0, 1).toUpperCase())}</span>
            <span class="account-name"><strong>${html(user.name)}</strong><small>${user.role === 'owner' ? 'Владелец' : 'Администратор'}</small></span>${svg('chevron', 15)}
          </button>
          ${state.showAccount ? `<div class="account-menu">
            <p>${html(user.email)}</p>
            ${user.demo ? `<button data-action="switch-role">${svg('users', 18)} ${user.role === 'owner' ? 'Войти как администратор' : 'Войти как владелец'}</button>` :
              user.provider === 'google' ? `<form method="post" action="/auth/signout" target="_top"><button type="submit">${svg('logout', 18)} Выйти</button></form>` :
              `<a href="${signOut}" target="_top">${svg('logout', 18)} Выйти</a>`}</div>` : ''}
        </div>
      </header>
      <main class="main-content">${content}</main>
    </div>
  </div>`;
}

function periodControl() {
  return `<label class="select-ui period-select">${svg('calendar', 18)}<select id="period" aria-label="Период">${[7, 14, 30].map((days) =>
    `<option value="${days}" ${state.days === days ? 'selected' : ''}>Последние ${days} дней</option>`).join('')}</select>${svg('chevron', 15)}</label>`;
}

function button(label, icon, action, style = 'primary') {
  return `<button class="button ${style}" type="button" data-action="${action}">${icon ? svg(icon, 18) : ''}${label}</button>`;
}

const linkButton = (label, icon, href, attrs = '') => `<a class="button secondary" href="${html(href)}" ${attrs}>${svg(icon, 17)}${label}</a>`;
const createButton = () => state.user.role === 'owner' ? button('Создать сайт', 'plus', 'new-site') : '';

function welcome() {
  return `<section class="welcome">
    <div class="welcome-copy"><div class="welcome-tag">${svg('nfc', 16)} NFC-СТРАНИЦЫ</div>
      <h2>Одно касание.<br class="welcome-mobile-break"> Больше возможностей.</h2>
      <p>Дайте гостям быстрый доступ к меню, отзывам<br class="wide-break"> и соцсетям вашего заведения.</p>
    </div>
    <div class="welcome-art" aria-hidden="true">
      <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="orbit orbit-three"></span>
      <span class="art-spark art-spark-one">✦</span><span class="art-spark art-spark-two">✦</span><span class="art-spark art-spark-three">✧</span>
      <div class="art-tile art-tile-rear"><span></span><span></span></div>
      <div class="art-tile art-tile-front">${svg('nfc', 63)}<i></i></div>
    </div>
  </section>`;
}

function change(current, previous) {
  if (!previous) return current ? '<span class="metric-new">Новые данные</span>' : '<span class="metric-new">Нет изменений</span>';
  const percent = Math.round((current - previous) / previous * 1000) / 10;
  const label = (percent > 0 ? '+' : '') + nf.format(percent) + '%';
  return `<span class="metric-change ${percent < 0 ? 'down' : ''}">${svg('trend', 13)} ${label}</span><span>к прошлому периоду</span>`;
}

function metrics(data) {
  const { current, comparison } = data;
  return `<section class="metrics" aria-label="Ключевые показатели">
  ${[
    ['Всего посещений', 'eye', 'iris', current.nfc + current.direct, comparison.nfc + comparison.direct],
    ['Переходы с NFC', 'nfc', 'sky', current.nfc, comparison.nfc],
    ['Открытия меню', 'book', 'mint', current.menu, comparison.menu],
    ['Переходы к отзывам', 'star', 'peach', current.maps, comparison.maps],
  ].map(([label, icon, tone, value, prev]) =>
    `<article class="panel metric"><div class="metric-head"><span class="icon-tile ${tone}">${svg(icon, 20)}</span><span>${label}</span></div>
      <strong class="metric-number">${nf.format(value)}</strong><div class="metric-foot">${change(value, prev)}</div></article>`).join('')}
  </section>`;
}

function pointPath(points) {
  return points.map(([x, y], index) => {
    if (!index) return 'M ' + x + ' ' + y;
    const [px, py] = points[index - 1];
    const middle = (px + x) / 2;
    return `C ${middle} ${py}, ${middle} ${y}, ${x} ${y}`;
  }).join(' ');
}

function chart(data) {
  const width = 640;
  const height = 172;
  const left = 40;
  const right = 620;
  const bottom = 154;
  const top = 15;
  const maximum = Math.max(10, ...data.series.flatMap(({ nfc, direct }) => [nfc, direct]));
  const raw = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= raw) * magnitude;
  const limit = step * 4;
  const y = (value) => bottom - (bottom - top) * value / limit;
  const points = (key) => data.series.map((item, index) => [left + (right - left) * index / (data.series.length - 1), y(item[key])]);
  const nfc = pointPath(points('nfc'));
  const direct = pointPath(points('direct'));
  return `<article class="panel chart-panel"><div class="chart-heading">
    <div><h2>Динамика посещений</h2><p>Переходы по дням</p></div>
    <div class="legend" aria-label="Источники"><span><i></i>С NFC</span><span><i></i>Другие</span></div>
    </div>
    <div class="chart-canvas"><svg width="100%" viewBox="0 0 ${width} ${height}" role="img" aria-label="График NFC и других посещений по дням">
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="#8156ff" stop-opacity=".18"/><stop offset="100%" stop-color="#8156ff" stop-opacity=".015"/></linearGradient></defs>
      ${[4, 3, 2, 1, 0].map((tick) => `<g><line x1="${left}" y1="${y(step * tick)}" x2="${right}" y2="${y(step * tick)}" stroke="#ececf2" stroke-dasharray="4 5"/><text x="0" y="${y(step * tick) + 4}" class="axis">${nf.format(step * tick)}</text></g>`).join('')}
      <path d="${nfc} L ${right} ${bottom} L ${left} ${bottom} Z" fill="url(#area)"/>
      <path d="${direct}" fill="none" stroke="#b6a9ed" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="5 6" vector-effect="non-scaling-stroke"/>
      <path d="${nfc}" fill="none" stroke="#7954e9" stroke-width="2.7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${points('nfc').map(([x, py], index) => {
        const point = data.series[index];
        const label = `${dateLabel(point.day, { day: 'numeric', month: 'long' })}: NFC — ${point.nfc}, другие — ${point.direct}`;
        const active = data.series.length <= 7 && point.nfc > 0;
        return `<g><circle cx="${x}" cy="${py}" r="${active ? 4 : 0}" fill="#fff" stroke="#7954e9" stroke-width="2" vector-effect="non-scaling-stroke"/><rect class="chart-hit" x="${x - 8}" y="0" width="16" height="${bottom}" fill="transparent" aria-label="${html(label)}"><title>${html(label)}</title></rect></g>`;
      }).join('')}
    </svg><div class="x-labels">${data.series.filter((_, index, array) => index === array.length - 1 || (index % Math.ceil(array.length / 7) === 0 && index < array.length - 2) || array.length === 7).map(({ day }) =>
      `<span>${html(dateLabel(day, { day: 'numeric', month: 'short' }))}</span>`).join('')}</div></div>
    </article>`;
}

function actions(data, full = false) {
  const relevant = full ? Object.entries(actionInfo) : Object.entries(actionInfo).filter(([key]) => key === 'menu' || key === 'maps' || data.current[key] > 0).slice(0, 4);
  const maximum = Math.max(1, ...relevant.map(([key]) => data.current[key]));
  return `<article class="panel actions-panel"><h2>Действия гостей</h2><p>Клики по элементам страницы</p><div class="action-stats">
    ${relevant.map(([key, [label, icon, tone]]) => `<div class="action-stat"><span class="icon-tile ${tone}">${svg(icon, 17)}</span>
    <div class="action-stat-body"><div><span>${label}</span><strong>${nf.format(data.current[key])}</strong></div>
    <div class="progress ${tone}"><i style="width:${data.current[key] / maximum * 100}%"></i></div></div></div>`).join('')}
  </div></article>`;
}

function tipsAnalytics({ counts, paid }) {
  const countFor = (method, source) => counts.find((row) => row.method === method && row.source === source)?.count || 0;
  return `<section class="site-section"><div class="section-heading"><div><h2>Чаевые</h2>
    <p>Переходы по способам и оплаты, подтверждённые bePaid</p></div></div>
    <div class="tip-metrics"><article class="panel metric"><div class="metric-head"><span class="icon-tile peach">${tipIcon}</span>Подтверждённые оплаты</div>
    <strong class="metric-number">${nf.format(paid.count)}</strong></article>
    <article class="panel metric"><div class="metric-head"><span class="icon-tile mint">${tipIcon}</span>Сумма подтверждённых чаевых</div>
    <strong class="metric-number">${money(paid.amount, 'BYN')}</strong></article></div>
    <div class="panel table-wrap"><table><thead><tr><th>Способ</th><th>С NFC</th><th>Другие переходы</th></tr></thead>
    <tbody>${Object.entries(tipLabels).map(([method, label]) => `<tr><td>${html(label)}</td><td>${nf.format(countFor(method, 'nfc'))}</td><td>${nf.format(countFor(method, 'direct'))}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

function siteIcon(site, large = false) {
  const icon = { coffee: 'coffee', garden: 'leaf', lavender: 'spark', indigo: 'globe' }[site.theme] || 'globe';
  return site.logo_url ? `<img class="site-icon ${site.theme} ${large ? 'large' : ''}" src="${html(site.logo_url)}" alt="">` : `<span class="site-icon ${site.theme} ${large ? 'large' : ''}">${svg(icon, large ? 40 : 23)}</span>`;
}

function statusBadge(status) {
  return `<span class="status ${status}"><i></i>${status === 'live' ? 'Опубликован' : 'Черновик'}</span>`;
}

function siteCards(sites) {
  return sites.length ? `<div class="site-grid">${sites.map((site) => `<article class="panel site-card">
    <a class="site-card-main" href="/admin/sites/${site.slug}" data-nav>${siteIcon(site)}<span class="site-card-name"><strong>${html(site.name)}</strong><small>${html(site.type)}</small></span></a>
    ${statusBadge(site.status)}
    <div class="site-card-bottom"><span>/${site.slug}</span><a href="/admin/sites/${site.slug}" data-nav aria-label="Управлять сайтом ${html(site.name)}">${svg('right', 17)}</a></div>
  </article>`).join('')}</div>` : `<div class="panel empty"><span class="icon-tile iris">${svg('globe')}</span><h3>Пока нет мини-сайтов</h3><p>${state.user.role === 'owner' ? 'Создайте первую страницу для заведения.' : 'Владелец может назначить вам доступ к странице.'}</p>${createButton()}</div>`;
}

function overviewContent(data) {
  return `<div class="page-heading"><div><h1>Обзор</h1><p>Статистика и управление вашими мини-сайтами.</p></div>
    <div class="heading-actions">${periodControl()}${createButton()}</div></div>
    ${welcome()}${metrics(data)}
    <div class="chart-layout">${chart(data)}${actions(data)}</div>
    <section class="site-section"><div class="section-heading"><div><h2>Мини-сайты</h2><p>Страницы ваших заведений</p></div>
      <a class="text-link" data-nav href="/admin/sites">Все сайты</a></div>
      ${siteCards(data.sites.slice(0, 3))}
    </section>`;
}

function analyticsContent(data) {
  return `<div class="page-heading"><div><h1>Аналитика</h1><p>Посещения и действия гостей за выбранный период.</p></div><div class="heading-actions">
  <label class="select-ui">${svg('globe', 18)}<select id="siteFilter" aria-label="Сайт"><option value="">Все сайты</option>${data.sites.map((site) =>
    `<option value="${site.slug}" ${site.slug === state.siteFilter ? 'selected' : ''}>${html(site.name)}</option>`).join('')}</select>${svg('chevron', 15)}</label>
  ${periodControl()}</div></div>${metrics(data)}<div class="chart-layout">${chart(data)}${actions(data, true)}</div>
  <section class="site-section"><div class="section-heading"><div><h2>По мини-сайтам</h2><p>Посещения и переходы с меток</p></div></div>
  ${data.sites.length ? `<div class="panel table-wrap"><table><thead><tr><th>Мини-сайт</th><th>Статус</th><th>Все посещения</th><th>С NFC</th></tr></thead><tbody>
  ${data.sites.map((site) => `<tr><td><a class="table-site" data-nav href="/admin/sites/${site.slug}">${siteIcon(site)}<strong>${html(site.name)}</strong></a></td>
  <td>${statusBadge(site.status)}</td><td>${nf.format(site.visits)}</td><td>${nf.format(site.nfc)}</td></tr>`).join('')}
  </tbody></table></div>` : siteCards([])}</section>${tipsAnalytics(data.tips)}`;
}

function sitesContent(data) {
  return `<div class="page-heading"><div><h1>Мини-сайты</h1><p>Управляйте страницами, NFC-ссылками и меню заведений.</p></div><div class="heading-actions">${createButton()}</div></div>
  ${data.sites.length ? `<div class="site-toolbar"><label class="search-input">${svg('search', 18)}<input id="siteSearch" type="search" placeholder="Поиск по названию или адресу" autocomplete="off" aria-label="Поиск мини-сайтов"></label><span>${nf.format(data.sites.length)} в списке</span></div>` : ''}
  <div id="searchResults">${siteCards(data.sites)}</div>`;
}

function siteForm(site = {}) {
  const isNew = !site.slug;
  const value = (key, fallback = '') => html(site[key] ?? fallback);
  return `<form id="siteForm" class="form-stack"><div class="form-grid">
  <label>Название<input name="name" maxlength="80" required placeholder="Moka Coffee" value="${value('name')}"></label>
  <label>Тип заведения<input name="type" maxlength="50" required placeholder="Кофейня" value="${value('type')}"></label>
  </div>
  ${isNew ? '<label>Адрес страницы<div class="input-prefix"><span>/</span><input name="slug" maxlength="48" pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="moka-coffee" autocomplete="off"></div><small>Латинские буквы, цифры и дефисы. Адрес закрепляется за страницей.</small></label>' : ''}
  <label>Описание<textarea name="description" rows="3" maxlength="260" placeholder="Коротко о заведении">${value('description')}</textarea></label>
  <div class="form-grid"><label>Тема<select name="theme">${Object.entries(themes).map(([key, name]) => `<option value="${key}" ${site.theme === key ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
  <label>Валюта<select name="currency">${['BYN', 'RUB', 'KZT', 'USD', 'EUR'].map((key) => `<option ${site.currency === key ? 'selected' : ''}>${key}</option>`).join('')}</select></label></div>
  <label>Статус<select name="status"><option value="draft">Черновик</option><option value="live" ${site.status === 'live' ? 'selected' : ''}>Опубликован</option></select></label>
  <details ${isNew ? '' : 'open'}><summary>Изображения и ссылки</summary><div class="form-stack">
  <div class="form-grid"><label>Ссылка на логотип<input name="logo_url" placeholder="https://…" value="${value('logo_url')}"></label>
  <label>Ссылка на обложку<input name="cover_url" placeholder="https://…" value="${value('cover_url')}"></label></div>
  <label>Ссылка на отзывы на картах<input type="url" name="maps_url" placeholder="https://…" value="${value('maps_url')}"></label>
  <div class="form-grid"><label>Telegram<input type="url" name="telegram_url" placeholder="https://…" value="${value('telegram_url')}"></label>
  <label>Instagram<input type="url" name="instagram_url" placeholder="https://…" value="${value('instagram_url')}"></label></div>
  <label>ВКонтакте<input type="url" name="vk_url" placeholder="https://…" value="${value('vk_url')}"></label></div></details>
  <p class="form-error" role="alert"></p><div class="form-footer">${isNew ? button('Отмена', '', 'close-dialog', 'secondary') : ''}
  <button class="button primary" type="submit">${isNew ? 'Создать сайт' : 'Сохранить изменения'}</button></div></form>`;
}

function itemsContent(site, items) {
  return `<div class="section-heading detail-heading"><div><h2>Позиции меню</h2><p>Добавляйте товары и услуги, меняйте цены и наличие.</p></div>
    ${button('Добавить позицию', 'plus', 'new-item')}</div>
    ${items.length ? `<div class="panel table-wrap"><table><thead><tr><th>Название</th><th>Категория</th><th>Цена</th><th>Наличие</th><th><span class="sr-only">Действия</span></th></tr></thead>
      <tbody>${items.map((item) => `<tr><td><div class="table-item">${item.photo_url ? `<img src="${html(item.photo_url)}" alt="" width="42" height="42" loading="lazy" decoding="async">` : ''}
      <div><strong>${html(item.name)}</strong>${item.description ? `<small class="table-note">${html(item.description)}</small>` : ''}</div></div></td>
      <td>${html(item.category)}</td><td>${money(item.price, site.currency)}</td><td><span class="status ${item.available ? 'live' : 'draft'}"><i></i>${item.available ? 'В меню' : 'Скрыта'}</span></td>
      <td><div class="row-actions"><button class="icon-button" data-action="edit-item" data-id="${item.id}" aria-label="Редактировать ${html(item.name)}">${svg('pencil', 18)}</button>
      <button class="icon-button danger" data-action="delete-item" data-id="${item.id}" aria-label="Удалить ${html(item.name)}">${svg('trash', 18)}</button></div></td></tr>`).join('')}</tbody></table></div>` :
      '<div class="panel empty"><h3>Меню пока пустое</h3><p>Добавьте позицию, чтобы она появилась на странице заведения.</p></div>'}`;
}

function accessContent(admins) {
  return `<div class="panel form-panel"><h2>Администраторы сайта</h2><p>Укажите email, с которым администратор будет входить. Он сможет редактировать меню и видеть статистику этой страницы.</p>
   <form id="adminForm" class="inline-form"><input name="email" type="email" required maxlength="254" placeholder="name@example.com" aria-label="Email администратора"><button class="button primary" type="submit">Добавить</button><p class="form-error" role="alert"></p></form>
   ${admins.length ? `<ul class="access-list">${admins.map(({ email }) => `<li><span>${svg('users', 18)}${html(email)}</span><button class="icon-button danger" data-action="delete-admin" data-email="${html(email)}" aria-label="Отозвать доступ">${svg('trash', 18)}</button></li>`).join('')}</ul>` : '<p class="muted">Администраторы пока не назначены.</p>'}</div>`;
}

function tipsForm(settings) {
  const checkout = settings.checkout;
  return `<section class="panel form-panel"><h2>Чаевые</h2><p>Включите способы, которые хотите показать гостям, и укажите получателя для каждого.</p>
  <form id="tipsForm" class="form-stack tip-settings">
  ${Object.entries(tipLinks).map(([id, label]) => {
    const item = settings.links[id] || {};
    return `<details class="tip-option-settings" ${item.enabled ? 'open' : ''}><summary>${html(label)} ${item.enabled ? '<span class="status live">Включено</span>' : ''}</summary>
    <div class="form-stack"><label class="check-label"><input name="${id}-enabled" type="checkbox" ${item.enabled ? 'checked' : ''}>Показывать гостям</label>
    <label>Получатель<input name="${id}-recipient" maxlength="90" placeholder="Например, команда кофейни" value="${html(item.recipient)}"></label>
    <label>Платёжная ссылка<input name="${id}-url" type="url" maxlength="2048" placeholder="https://…" value="${html(item.url)}"></label></div></details>`;
  }).join('')}
  <details class="tip-option-settings" ${checkout.enabled ? 'open' : ''}><summary>${tipLabels.bepaid} ${checkout.enabled ? '<span class="status live">Включено</span>' : ''}</summary>
    <div class="form-stack"><p class="muted">Гость вводит сумму в BYN. Оплату принимает bePaid. Для подключения нужны данные магазина, которому разрешён приём чаевых.</p>
    ${checkout.ready ? '' : '<p class="form-error">Ожидается настройка шифрования на сервере.</p>'}
    <label class="check-label"><input name="checkout-enabled" type="checkbox" ${checkout.enabled ? 'checked' : ''} ${checkout.ready ? '' : 'disabled'}>Показывать гостям</label>
    <label class="check-label"><input name="checkout-test" type="checkbox" ${checkout.test ? 'checked' : ''}>Тестовые платежи</label>
    <label>Получатель<input name="checkout-recipient" maxlength="90" value="${html(checkout.recipient)}"></label>
    <div class="form-grid"><label>ID магазина<input name="checkout-shop" inputmode="numeric" maxlength="16" value="${html(checkout.shop_id)}"></label>
    <label>Секретный ключ<input name="checkout-secret" type="password" maxlength="200" autocomplete="new-password"
      placeholder="${checkout.saved_key ? 'Ключ сохранён' : ''}"></label></div>
    <label>Публичный RSA-ключ<textarea name="checkout-public-key" maxlength="4096" rows="4" spellcheck="false">${html(checkout.public_key)}</textarea></label>
    </div></details>
    <p class="form-error" role="alert"></p><div class="form-footer"><button class="button primary" type="submit">Сохранить способы</button></div>
  </form></section>`;
}

function detailContent(current, bundle, analytics) {
  const { site, items, admins, tips } = bundle;
  const base = '/admin/sites/' + site.slug;
  const owner = state.user.role === 'owner';
  const tabs = [['menu', 'Меню', 'book', base], ['analytics', 'Статистика', 'bars', base + '/analytics'],
    ...(owner ? [['settings', 'Настройки', 'settings', base + '/settings'], ['access', 'Доступ', 'users', base + '/access'], ['tips', 'Чаевые', 'star', base + '/tips']] : [])];
  const active = tabs.some(([key]) => key === current.tab) ? current.tab : 'menu';
  const previewPath = '/' + site.slug + '?preview=1';
  return `<div class="page-heading detail-title"><div class="detail-title-main">${siteIcon(site)}<div><h1>${html(site.name)}</h1><p>${html(site.type)} · /${site.slug}</p></div></div>
    <div class="heading-actions">${statusBadge(site.status)}${linkButton('Предпросмотр', 'external', previewPath, 'target="_blank" rel="noopener"')}</div></div>
    <div class="panel nfc-banner"><span class="icon-tile iris">${svg('nfc', 23)}</span><div><strong>Ссылка для NFC-метки</strong><small>${html(nfcUrl(site))}</small>
    ${site.status === 'draft' ? `<small class="nfc-draft-hint">Гости смогут открыть ссылку после публикации. ${owner ? `<a href="${base}/settings" data-nav>Настройки публикации</a>` : ''}</small>` : ''}</div>
    ${button('Скопировать', 'copy-nfc', 'secondary')}</div>
    <nav class="tabs" aria-label="Разделы сайта">${tabs.map(([key, label, icon, href]) => `<a data-nav href="${href}" class="${active === key ? 'selected' : ''}" ${active === key ? 'aria-current="page"' : ''}>${svg(icon, 18)}${label}</a>`).join('')}</nav>
    ${active === 'menu' ? itemsContent(site, items) : ''}
    ${active === 'settings' ? `<section class="panel form-panel"><h2>Настройки страницы</h2><p>Оформление, контакты и публикация.</p>${siteForm(site)}</section>` : ''}
    ${active === 'access' ? accessContent(admins) : ''}
    ${active === 'tips' ? tipsForm(tips) : ''}
    ${active === 'analytics' ? `<div class="section-heading detail-heading"><div><h2>Статистика страницы</h2><p>Активность по этому заведению</p></div>${periodControl()}</div>
      ${metrics(analytics)}<div class="chart-layout">${chart(analytics)}${actions(analytics, true)}</div>${tipsAnalytics(analytics.tips)}` : ''}`;
}

function landing(model) {
  const site = model.site;
  const base = '/' + site.slug;
  const isMenu = model.view === 'menu';
  const social = [['telegram', 'Telegram'], ['instagram', 'Instagram'], ['vk', 'ВКонтакте']].filter(([key]) => site[key + '_url']);
  const label = site.type === 'Студия красоты' ? 'Смотреть услуги' : 'Открыть меню';
  const groups = new Map();
  for (const item of model.items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  document.body.classList.add('landing-body', 'landing-' + site.theme);
  app.innerHTML = `<main class="landing">
    ${model.draftPreview ? '<p class="public-draft-banner">Предпросмотр черновика</p>' : ''}
    <section class="public-hero ${site.cover_url ? 'with-cover' : ''}">${site.cover_url ? `<img class="public-cover" src="${html(site.cover_url)}" alt="" fetchpriority="high">` : '<div class="public-pattern" aria-hidden="true"></div>'}
      <div class="public-hero-inner">${siteIcon(site, true)}<p class="public-type">${html(site.type)}</p><h1>${html(site.name)}</h1>${site.description ? `<p class="public-description">${html(site.description)}</p>` : ''}</div>
    </section>
    <div class="public-content">
      ${isMenu ? `<div class="public-menu-heading"><h2>${site.type === 'Студия красоты' ? 'Услуги' : 'Меню'}</h2><a href="${base + html(model.query)}">Главная страница</a></div>
      ${groups.size ? [...groups].map(([category, items]) => `<section class="public-category"><h3>${html(category)}</h3><ul>${items.map((item) =>
        `<li><button class="public-item" type="button" data-menu-item="${html(item.id)}" aria-haspopup="dialog">
          ${item.photo_url ? `<img class="public-item-thumb" src="${html(item.photo_url)}" alt="" width="58" height="58" loading="lazy" decoding="async">` : ''}
          <span class="public-item-copy"><strong>${html(item.name)}</strong>${item.description ? `<span class="public-item-summary">${html(item.description)}</span>` : ''}</span>
          <span class="public-item-price">${money(item.price, site.currency)}</span>
        </button></li>`).join('')}</ul></section>`).join('') : '<p>Позиции появятся здесь позже.</p>'}`
       : `<div class="public-actions">
        <a class="public-button main-action" href="${base + '/menu' + html(model.query)}"><span>${svg('book', 22)}${label}</span>${svg('right', 20)}</a>
        ${site.maps_url ? `<a class="public-button" href="${base + '/go/maps' + html(model.query)}"><span>${svg('map', 22)}Оставить отзыв на картах</span>${svg('external', 18)}</a>` : ''}
        ${model.tips?.length ? `<a class="public-button" target="_top" href="${base + '/tips' + html(model.query)}"><span>${tipIcon}Оставить чаевые</span></a>` : ''}
        </div>
        ${social.length ? `<div class="public-socials">${social.map(([key, name]) => `<a href="${base + '/go/' + key + html(model.query)}">${svg(actionInfo[key][1], 18)}${name}</a>`).join('')}</div>` : ''}`}
    </div>
    <footer class="public-footer">${svg('nfc', 18)} Сделано в Тап.</footer>
  </main>`;
  if (isMenu) {
    app.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu-item]');
      if (!button) return;
      const item = model.items.find((entry) => entry.id === button.dataset.menuItem);
      if (item) publicItemDialog(item, site.currency);
    });
  }
}

function tipsLanding(model) {
  const { site, view } = model;
  const home = '/' + site.slug + (model.query || '');
  const locationFor = (section) => '/' + site.slug + '/tips' + section + (model.query || '');
  const recipient = (method) => `<span class="tip-recipient">Получатель · ${html(method.recipient)}</span>`;
  let title = 'Оставить чаевые';
  let content;
  if (view === 'tip-options') {
    content = `<div class="tip-choices">${model.methods.map((method) => `<a class="public-button tip-choice" href="${html(locationFor('/' + method.id))}" target="_top">
      <span><strong>${html(method.label)}</strong>${recipient(method)}</span>${method.test ? '<small>Тест</small>' : ''}</a>`).join('')}</div>`;
  } else if (view === 'tip-amount') {
    content = `<p class="tip-provider">bePaid · ${recipient(model.chosen)}</p>
    ${model.chosen.test ? '<p class="tip-note">Тестовый режим оплаты</p>' : ''}
    <form id="tipAmountForm" class="tip-amount-form" method="post" target="_top" action="${html(locationFor('/bepaid'))}">
      <input type="hidden" name="intent" value="${html(model.intent)}">
      <div class="tip-presets" aria-label="Быстрый выбор суммы">${[2, 5, 10, 15].map((amount) => `<button type="button" data-amount="${amount}">${amount} BYN</button>`).join('')}</div>
      <label>Сумма в BYN<input name="amount" inputmode="decimal" required maxlength="6" pattern="[0-9]{1,3}([.,][0-9]{1,2})?" placeholder="5,00"></label>
      <p class="tip-note">От 1 до 300 BYN. Оплата откроется на странице bePaid.</p>
      <button class="public-button main-action" type="submit" ${model.intent ? '' : 'disabled'}>К оплате</button>
      ${model.intent ? '' : '<p class="tip-note">Предпросмотр формы</p>'}
    </form>`;
  } else if (view === 'tip-result') {
    const receipt = model.receipt;
    title = receipt.paid ? (receipt.test ? 'Тестовый платёж подтверждён' : 'Спасибо за чаевые!') :
      receipt.cancelled ? 'Оплата не завершена' : 'Проверяем оплату';
    content = `<p class="tip-receipt">${money(receipt.amount, 'BYN')} · ${html(receipt.recipient)}</p>
      ${receipt.paid ? '' : receipt.cancelled
        ? `<a class="public-button" href="${html(locationFor(''))}">Вернуться к способам оплаты</a>`
        : `<p class="tip-note">Статус появится после подтверждения bePaid.</p><a class="public-button" href="${html(location.pathname)}">Обновить статус</a>`}`;
  } else if (view === 'tip-preview') {
    title = 'Предпросмотр чаевых';
    content = `<p class="tip-provider">${html(model.chosen.label)}</p><p>${recipient(model.chosen)}</p>`;
  } else {
    title = 'Оплата не открылась';
    content = `<p class="tip-note">${html(model.error)}</p><a class="public-button" href="${html(locationFor('/bepaid'))}">Открыть новую форму</a>`;
  }
  document.body.classList.add('landing-body', 'landing-' + site.theme);
  app.innerHTML = `<main class="tip-page"><section class="tip-page-card">${siteIcon(site)}
    <p class="tip-venue">${html(site.name)}</p><h1>${title}</h1>${content}
    <a class="tip-home" href="${html(home)}">На страницу заведения</a></section></main>`;
  const form = document.querySelector('#tipAmountForm');
  if (form) {
    form.addEventListener('click', (event) => {
      const choice = event.target.closest('[data-amount]');
      if (choice) form.elements.amount.value = choice.dataset.amount;
    });
  }
}

function publicItemDialog(item, currency) {
  showModal(item.name, `${item.photo_url ? `<img class="public-item-photo" src="${html(item.photo_url)}" alt="${html(item.name)}">` : ''}
    <div class="public-item-detail">
      <div class="public-item-meta"><span>${html(item.category)}</span><strong>${money(item.price, currency)}</strong></div>
      ${item.description ? `<p>${html(item.description)}</p>` : ''}
    </div>`, 'public-item-dialog');
}

function notice(title, description, action = '') {
  app.innerHTML = `<main class="notice"><div class="notice-box panel">${logo()}<h1>${html(title)}</h1><p>${html(description)}</p>${action}</div></main>`;
}

function loginOptions(googleAvailable) {
  const code = new URLSearchParams(location.search).get('google');
  const error = code && Object.hasOwn(googleMessages, code) ? googleMessages[code] : '';
  const googleIcon = '<img src="https://developers.google.com/static/identity/images/g-logo.png" width="18" height="18" alt="">';
  return `<div class="login-options">
    ${error ? `<p class="login-status" role="alert">${html(error)}</p>` : ''}
    ${googleAvailable
      ? `<a class="button secondary google-button" href="/auth/google" target="_top">${googleIcon}Войти через Google</a>`
      : `<button class="button secondary google-button" type="button" disabled aria-describedby="googleSetup">${googleIcon}Войти через Google</button><small id="googleSetup">Ожидает подключения</small>`}
    <a class="button primary" href="${signIn}" target="_top">Войти через ChatGPT</a>
  </div>`;
}

let toastTimer;
function toast(message) {
  const element = document.querySelector('#toast');
  element.innerHTML = svg('check', 18) + html(message);
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3200);
}

function showModal(title, content, className = '') {
  modal.className = className;
  modal.innerHTML = `<div class="modal-view"><div class="modal-header"><h2 id="modalTitle">${html(title)}</h2>
    <button class="icon-button" data-action="close-dialog" aria-label="Закрыть">${svg('close')}</button></div>${content}</div>`;
  modal.setAttribute('aria-labelledby', 'modalTitle');
  if (!modal.open) modal.showModal();
}

function itemDialog(item = {}) {
  showModal(item.id ? 'Редактировать позицию' : 'Добавить позицию', `<form id="itemForm" class="form-stack" data-id="${item.id || ''}">
  <label>Название<input name="name" required maxlength="100" value="${html(item.name)}" placeholder="Капучино"></label>
  <div class="form-grid"><label>Категория<input name="category" required maxlength="55" value="${html(item.category)}" placeholder="Кофе"></label>
  <label>Цена, ${html(state.details.site.currency)}<input name="price" required inputmode="decimal" type="number" min="0" max="999999.99" step="0.01" value="${item.price == null ? '' : item.price / 100}" placeholder="0,00"></label></div>
  <label>Описание<textarea name="description" rows="3" maxlength="300">${html(item.description)}</textarea></label>
  <div class="photo-edit">
    <img class="photo-edit-preview" data-saved-photo="${html(item.photo_url)}" alt="Предпросмотр фото"
      ${item.photo_url ? `src="${html(item.photo_url)}"` : 'hidden'}>
    <div class="photo-edit-input"><label>${item.photo_url ? 'Заменить фото' : 'Добавить фото'}
      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" aria-describedby="photoHint">
      <small id="photoHint">JPEG, PNG или WebP до 20 МБ.</small>
    </label>
    ${item.photo_url ? '<label class="check-label"><input name="remove_photo" type="checkbox">Удалить фото</label>' : ''}</div>
  </div>
  <label class="check-label"><input name="available" type="checkbox" ${item.available !== 0 ? 'checked' : ''}>Показывать в публичном меню</label>
  <p class="form-error" role="alert"></p><div class="form-footer">${button('Отмена', '', 'close-dialog', 'secondary')}<button class="button primary">Сохранить</button></div></form>`);
}

function updatePhotoPreview(input) {
  const form = input.form;
  const photoInput = form.elements.photo;
  const remove = form.elements.remove_photo;
  if (input === photoInput && photoInput.files.length && remove) remove.checked = false;
  if (input === remove && remove.checked) photoInput.value = '';
  const image = form.querySelector('.photo-edit-preview');
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = photoInput.files.length ? URL.createObjectURL(photoInput.files[0]) : null;
  const source = photoPreviewUrl || (remove?.checked ? '' : image.dataset.savedPhoto);
  image.hidden = !source;
  if (source) image.src = source;
  else image.removeAttribute('src');
}

async function scaledPhoto(file) {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Выберите фото размером до 20 МБ.');
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Выберите фотографию в формате JPEG, PNG или WebP.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Не удалось открыть фотографию. Выберите другой файл.');
  }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .84));
  if (!blob) throw new Error('Не удалось подготовить фотографию.');
  return blob;
}

function confirmDialog(title, text, attribute, value, label) {
  showModal(title, `<form id="removeForm" class="form-stack" ${attribute}="${html(value)}"><p>${html(text)}</p><p class="form-error" role="alert"></p>
  <div class="form-footer">${button('Отмена', '', 'close-dialog', 'secondary')}<button class="button danger-button" type="submit">${label}</button></div></form>`);
}

async function load() {
  const revision = ++state.pending;
  const current = route();
  const params = new URLSearchParams({ days: state.days });
  if (current.name === 'analytics' && state.siteFilter) params.set('site', state.siteFilter);
  if (current.name === 'detail' && current.tab === 'analytics') params.set('site', current.slug);
  try {
    const [data, detail] = await Promise.all([
      api('/api/overview?' + params),
      current.name === 'detail' ? api('/api/sites/' + current.slug) : null,
    ]);
    if (revision !== state.pending) return;
    state.details = detail;
    state.data = data;
    state.user = data.user;
    render();
  } catch (error) {
    if (revision !== state.pending) return;
    state.details = null;
    app.innerHTML = structure(current, `<section class="panel empty"><h2>Не удалось открыть раздел</h2><p>${html(error.message)}</p><a class="button secondary" href="/admin" data-nav>К обзору</a></section>`);
  }
}

function render() {
  const current = route();
  const data = state.data;
  if (!data) return;
  const content = current.name === 'overview' ? overviewContent(data) : current.name === 'analytics' ? analyticsContent(data)
    : current.name === 'sites' ? sitesContent(data) : state.details?.site.slug === current.slug ? detailContent(current, state.details, data) : '<div class="initial">Загрузка…</div>';
  app.innerHTML = structure(current, content);
}

function navigate(href) {
  history.pushState({}, '', href);
  state.mobileNav = false;
  state.showAccount = false;
  window.scrollTo(0, 0);
  load();
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const success = document.execCommand('copy');
    input.remove();
    if (!success) throw new Error('Не удалось скопировать ссылку.');
  }
}

async function onClick(event) {
  const nav = event.target.closest('a[data-nav]');
  if (nav && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    navigate(nav.getAttribute('href'));
    return;
  }
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    if (state.showAccount && !event.target.closest('.account-wrap')) {
      state.showAccount = false;
      render();
    }
    return;
  }
  const action = trigger.dataset.action;
  if (action === 'account') {
    state.showAccount = !state.showAccount;
    render();
  }
  if (action === 'mobile-nav') {
    state.mobileNav = !state.mobileNav;
    render();
  }
  if (action === 'switch-role') {
    state.demoRole = state.user.role === 'owner' ? 'manager' : 'owner';
    try { sessionStorage.setItem('tap-demo-role', state.demoRole); } catch { /* storage disabled */ }
    state.siteFilter = '';
    navigate('/admin');
  }
  if (action === 'new-site') showModal('Создать мини-сайт', siteForm());
  if (action === 'new-item') itemDialog();
  if (action === 'edit-item') {
    const item = state.details.items.find((entry) => entry.id === trigger.dataset.id);
    if (item) itemDialog(item);
  }
  if (action === 'delete-item') {
    const item = state.details.items.find((entry) => entry.id === trigger.dataset.id);
    if (item) confirmDialog('Удалить позицию?', '«' + item.name + '» исчезнет из меню.', 'data-item', item.id, 'Удалить');
  }
  if (action === 'delete-admin') confirmDialog('Отозвать доступ?', trigger.dataset.email + ' потеряет доступ к этому мини-сайту.', 'data-email', trigger.dataset.email, 'Отозвать');
  if (action === 'copy-nfc') {
    try { await copy(nfcUrl(state.details.site)); toast('NFC-ссылка скопирована'); }
    catch (error) { toast(error.message); }
  }
}

async function onSubmit(event) {
  const form = event.target;
  if (!['siteForm', 'itemForm', 'adminForm', 'removeForm', 'tipsForm'].includes(form.id)) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  const error = form.querySelector('.form-error');
  const data = Object.fromEntries(new FormData(form));
  const slug = state.details?.site.slug;
  const base = '/api/sites/' + slug;
  submit.disabled = true;
  error.textContent = '';
  try {
    if (form.id === 'siteForm') {
      const isNew = modal.contains(form);
      const result = await api(isNew ? '/api/sites' : base, { method: isNew ? 'POST' : 'PUT', body: data });
      if (isNew) {
        modal.close();
        toast('Мини-сайт создан');
        navigate('/admin/sites/' + result.site.slug);
        return;
      }
      toast('Настройки сохранены');
    }
    if (form.id === 'itemForm') {
      const id = form.dataset.id;
      const price = Math.round(Number(data.price) * 100);
      const { photo, ...fields } = data;
      const payload = { ...fields, price, available: form.elements.available.checked,
        remove_photo: form.elements.remove_photo?.checked === true };
      let body = payload;
      if (photo?.name) {
        body = new FormData();
        body.set('payload', JSON.stringify(payload));
        body.set('photo', await scaledPhoto(photo), 'menu-photo');
      }
      await api(base + '/items' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
      modal.close();
      toast('Позиция сохранена');
    }
    if (form.id === 'adminForm') {
      await api(base + '/admins', { method: 'POST', body: data });
      toast('Доступ выдан');
    }
    if (form.id === 'tipsForm') {
      const links = Object.fromEntries(Object.keys(tipLinks).map((id) => [id, {
        enabled: data[id + '-enabled'] === 'on', recipient: data[id + '-recipient'], url: data[id + '-url'],
      }]));
      const checkout = { enabled: data['checkout-enabled'] === 'on', test: data['checkout-test'] === 'on',
        recipient: data['checkout-recipient'], shop_id: data['checkout-shop'], secret: data['checkout-secret'], public_key: data['checkout-public-key'] };
      await api(base + '/tips', { method: 'PUT', body: { links, checkout } });
      toast('Настройки чаевых сохранены');
    }
    if (form.id === 'removeForm') {
      const id = form.dataset.item;
      const target = id ? '/items/' + id : '/admins/' + encodeURIComponent(form.dataset.email);
      await api(base + target, { method: 'DELETE' });
      modal.close();
      toast(id ? 'Позиция удалена' : 'Доступ отозван');
    }
    await load();
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    submit.disabled = false;
  }
}

async function start() {
  if (page.view === 'missing') {
    notice('Страница недоступна', 'Проверьте адрес или уточните ссылку у заведения.');
    return;
  }
  if (page.view?.startsWith('tip-')) { tipsLanding(page); return; }
  if (page.site) { landing(page); return; }
  try { state.demoRole = sessionStorage.getItem('tap-demo-role'); } catch { /* storage disabled */ }
  try {
    const { user, ownerConfigured, googleAvailable } = await api('/api/session');
    if (!user) {
      notice('Панель управления', 'Войдите, чтобы управлять NFC-страницами и смотреть статистику.', loginOptions(googleAvailable));
      return;
    }
    if (!ownerConfigured) {
      notice('Панель ожидает настройки', 'Для запуска рабочего пространства нужно указать email владельца.');
      return;
    }
    state.user = user;
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('change', (event) => {
      const input = event.target;
      if (input.id === 'period') { state.days = Number(input.value); load(); }
      if (input.id === 'siteFilter') { state.siteFilter = input.value; load(); }
      if (input.form?.id === 'itemForm' && ['photo', 'remove_photo'].includes(input.name)) updatePhotoPreview(input);
    });
    document.addEventListener('input', (event) => {
      if (event.target.id !== 'siteSearch') return;
      const value = event.target.value.trim().toLowerCase();
      const sites = state.data.sites.filter((site) => (site.name + ' ' + site.slug + ' ' + site.type).toLowerCase().includes(value));
      document.querySelector('#searchResults').innerHTML = sites.length ? siteCards(sites) : '<div class="panel empty"><h3>Ничего не найдено</h3><p>Попробуйте другой запрос.</p></div>';
    });
    window.addEventListener('popstate', () => { state.showAccount = false; state.mobileNav = false; load(); });
    await load();
  } catch (error) {
    notice('Не удалось открыть панель', error.message);
  }
}

start();
