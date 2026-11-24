const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const photoSelections = new Map();
modal.addEventListener('click', (event) => {
  if (event.target === modal || event.target.closest('[data-action="close-dialog"]')) modal.close();
});
modal.addEventListener('close', () => {
  clearPhotoPreviews(modal);
  modal.querySelector('#passwordSettingsForm')?.reset();
});
const state = { data: null, user: null, days: 7, siteFilter: '', showAccount: false, mobileNav: false,
  details: null, loadError: '', statsFailed: false, passwordAvailable: false, feedbackQuery: { status: '', rating: '', sort: 'recent', page: 1 } };
let activeLoad;
const page = JSON.parse(document.querySelector('#page-data').textContent);
const icons = {
  nfc: '<path d="M4 11a13 13 0 0 1 16 0M7 14a8 8 0 0 1 10 0m-7 3a3.3 3.3 0 0 1 4 0"/><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  bars: '<rect x="3.5" y="11" width="3.8" height="8.5" rx="1"/><rect x="10.1" y="7" width="3.8" height="12.5" rx="1"/><rect x="16.7" y="3.5" width="3.8" height="16" rx="1"/>',
  book: '<path d="M12 6v15M3.5 4.5h5A3.5 3.5 0 0 1 12 8v13a4.5 4.5 0 0 0-3.5-2h-5zm17 0h-5A3.5 3.5 0 0 0 12 8v13a4.5 4.5 0 0 1 3.5-2h5z"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  grip: '<path stroke-width="3" stroke-linecap="round" d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17"/>',
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
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.5-3.3 1.6 1.6 0 0 1 1.2-2.7H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><path d="M7.5 10h.01M10 6.8h.01M14 6.8h.01M17 10h.01" stroke-width="2.5"/>',
  vk: '<path fill="currentColor" stroke="none" d="M6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z"/>',
  telegram: '<path d="m3 11 17-7-3 16-6-5-3 3v-5zM8 13l7-5"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  map: '<path d="M19 10c0 5-7 10.5-7 10.5S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  link: '<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5m2.5 5.5a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  shield: '<path d="M12 22s7.5-3.6 7.5-10V5L12 2 4.5 5v7C4.5 18.4 12 22 12 22Z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M11 5H5v14h6m-1-7h10m-4-4 4 4-4 4"/>',
};
const svg = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const html = (value = '') => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const nf = new Intl.NumberFormat('ru-RU');
const money = (value, currency) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(value / 100);
const dateLabel = (value, options) => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')).replace('.', '');
const actionInfo = {
  menu: ['Открытия меню', 'book'], maps: ['Переходы к отзывам', 'star'],
  instagram: ['Instagram', 'instagram'], telegram: ['Telegram', 'telegram'], vk: ['ВКонтакте', 'vk'],
};
const reviewLabels = { yandex: 'Яндекс', google: 'Google' };
const guestBlockLabels = {
  hours: 'Время работы', wifi: 'Гостевой Wi-Fi', menu: 'Меню', feedback: 'Оценить заведение',
  website: 'Официальный сайт', tips: 'Чаевые',
  telegram: 'Telegram', instagram: 'Instagram', vk: 'ВКонтакте',
};
const tipLinks = {
  alpha: '«нетмонет» · Альфа-Банк',
  moneyapp: 'MoneyApp · БСБ Банк',
  teacode: '«Чай-код» · Беларусбанк',
  'bepaid-link': 'Платёжная ссылка bePaid',
};
const tipLabels = { ...tipLinks, bepaid: 'Оплата картой через bePaid' };
const tipIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 20.5 4.6 13C.5 8.6 6.4 2.4 10.8 6.9l1.2 1.2 1.2-1.2C17.6 2.4 23.5 8.6 19.4 13Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const themes = {
  light: 'Светлая', dark: 'Тёмная', coffee: 'Кофе', slate: 'Сланец', garden: 'Базилик',
  indigo: 'Индиго', lavender: 'Лаванда', peach: 'Персик', sand: 'Песок', walnut: 'Орех',
  sage: 'Шалфей', mint: 'Мята', pine: 'Хвоя', ocean: 'Океан', sky: 'Небо', steel: 'Сталь',
  graphite: 'Графит', berry: 'Ягода', plum: 'Слива', rose: 'Пыльная роза', coral: 'Коралл',
  honey: 'Мёд', lemon: 'Лимон', clay: 'Терракота', copper: 'Медь',
};
const featuredThemes = ['light', 'dark', 'coffee', 'slate', 'garden'];
const nextDay = (value, offset) => new Date(Date.parse(value + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
const nfcUrl = (site) => location.origin + '/' + site.slug + '?nfc=' + encodeURIComponent(site.nfc_key);
const googleMessages = {
  unavailable: 'Вход через Google ожидает подключения.',
  expired: 'Срок запроса истёк. Начните вход через Google заново.',
  cancelled: 'Вход через Google отменён.',
  failed: 'Не удалось войти через Google. Попробуйте ещё раз.',
  email: 'Для входа через Google используйте Gmail или Google Workspace.',
  denied: 'Для этого адреса нет доступа. Попросите владельца добавить ваш email во вкладке «Доступ» нужного мини-сайта.',
};
const telegramMessages = {
  unavailable: 'Вход через Telegram ожидает подключения.',
  expired: 'Срок запроса истёк. Начните вход через Telegram заново.',
  cancelled: 'Вход через Telegram отменён.',
  failed: 'Не удалось войти через Telegram. Попробуйте ещё раз.',
  phone: 'Подтвердите передачу номера в окне входа Telegram.',
  country: 'В Telegram должен быть указан белорусский номер с кодом +375.',
  denied: 'Номер из Telegram не назначен. Попросите владельца добавить его во вкладке «Доступ».',
};
const logo = (href = '/admin') => `<a class="brand" href="${href}" aria-label="Тап. Главная"><span class="brand-icon">${svg('nfc', 24)}</span><span>тап<span class="brand-dot">.</span></span></a>`;

async function api(path, options = {}) {
  const multipart = options.body instanceof FormData;
  const result = await fetch(path, {
    method: options.method || 'GET', credentials: 'same-origin', signal: options.signal,
    headers: { ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}),
      ...(options.version != null ? { 'If-Match': '"' + options.version + '"' } : {}),
      ...(state.demoRole ? { 'x-demo-role': state.demoRole } : {}) },
    body: multipart ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await result.json();
  if (!result.ok) throw Object.assign(new Error(data.error || 'Не удалось загрузить данные.'), { status: result.status });
  return data;
}

function route() {
  const [, , root, slug, tab] = location.pathname.split('/');
  if (root === 'analytics') return { name: 'analytics', title: 'Аналитика' };
  if (root === 'feedback') return { name: 'feedback', title: 'Отзывы' };
  if (root === 'sites' && slug) return { name: 'detail', title: state.details?.site?.name || 'Мини-сайт', slug, tab: tab || 'menu' };
  if (root === 'sites') return { name: 'sites', title: 'Мини-сайты' };
  return { name: 'overview', title: 'Обзор' };
}

const navigation = [
  ['overview', 'Обзор', 'home', '/admin'],
  ['sites', 'Мини-сайты', 'globe', '/admin/sites'],
  ['analytics', 'Аналитика', 'bars', '/admin/analytics'],
  ['feedback', 'Отзывы', 'star', '/admin/feedback'],
];

function structure(current, content) {
  const user = state.user;
  return `<div class="workspace">
    <aside id="panelNavigation" class="sidebar ${state.mobileNav ? 'opened' : ''}" aria-label="Навигация">
      <div class="sidebar-brand">${logo()}</div>
      <nav class="nav-group" aria-label="Разделы панели">
        ${navigation.map(([key, label, icon, href]) => {
          const active = current.name === key || (key === 'sites' && current.name === 'detail');
          return `<a class="nav-link ${active ? 'active' : ''}" href="${href}" data-nav ${active ? 'aria-current="page"' : ''}>${svg(icon)} <span>${label}</span></a>`;
        }).join('')}
      </nav>
      <div class="sidebar-bottom">
        <a class="nav-link" href="/about">${svg('globe')} <span>О проекте</span></a>
        ${user.demo ? '<p class="demo-note">Демо-режим</p>' : ''}
      </div>
    </aside>
    ${state.mobileNav ? '<button class="nav-backdrop" data-action="mobile-nav" aria-label="Закрыть навигацию"></button>' : ''}
    <div class="main-frame">
      <header class="topbar">
        <div class="crumbs"><button class="icon-button mobile-toggle" type="button" data-action="mobile-nav" aria-label="Навигация" aria-controls="panelNavigation" aria-expanded="${state.mobileNav}">${svg('menu')}</button>
          <span class="crumb-root">Рабочее пространство</span><span class="crumb-separator">/</span>
          ${current.name === 'detail' ? `<a data-nav href="/admin/sites">Мини-сайты</a><span class="crumb-separator">/</span>` : ''}
          <strong>${html(current.title)}</strong>
        </div>
        <div class="account-wrap">
          <button class="account" data-action="account" aria-label="Профиль: ${html(user.name)}" aria-expanded="${state.showAccount}"><span class="avatar" aria-hidden="true">${html(user.name.slice(0, 1).toUpperCase())}</span>
            <span class="account-name"><strong>${html(user.name)}</strong><small>${user.role === 'owner' ? 'Владелец' : 'Администратор'}</small></span>${svg('chevron', 15)}
          </button>
          ${state.showAccount ? `<div class="account-menu">
            <p>${html(user.email)}</p>
            ${user.demo ? `<button data-action="switch-role">${svg('users', 18)} ${user.role === 'owner' ? 'Войти как администратор' : 'Войти как владелец'}</button>` :
              `${state.passwordAvailable && user.role === 'owner'
                ? `<button type="button" data-action="owner-password">${svg('settings', 18)} Логин и пароль</button>` : ''}
              <button type="button" data-action="signout">${svg('logout', 18)} Выйти</button>`}</div>` : ''}
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
const createButton = () => state.user.role === 'owner' ? button('Создать мини-сайт', 'plus', 'new-site') : '';

function nfcIntroduction() {
  return `<section class="nfc-intro">
    <span class="nfc-mark">${svg('nfc', 24)}</span>
    <div><h2>Страницы заведений с NFC</h2><p>Гости открывают меню, отзывы и соцсети, поднося телефон к метке</p></div>
  </section>`;
}

function change(current, previous) {
  if (!previous) return current ? '<span class="metric-new">Новые данные</span>' : '<span class="metric-new">Нет изменений</span>';
  const percent = Math.round((current - previous) / previous * 1000) / 10;
  const label = (percent > 0 ? '+' : '') + nf.format(percent) + '%';
  return `<span class="metric-change ${percent < 0 ? 'down' : ''}">${label}</span><span>к прошлому периоду</span>`;
}

function metrics(data) {
  const { current, comparison } = data;
  return `<section class="metrics" aria-label="Ключевые показатели">
  ${[
    ['Всего посещений', current.nfc + current.direct, comparison.nfc + comparison.direct],
    ['Переходы с NFC', current.nfc, comparison.nfc],
    ['Открытия меню', current.menu, comparison.menu],
    ['Переходы к отзывам', current.maps, comparison.maps],
  ].map(([label, value, prev]) =>
    `<article class="panel metric"><div class="metric-head">${label}</div>
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
  const height = 192;
  const ticks = [4, 3, 2, 1, 0];
  const maximum = Math.max(10, ...data.series.flatMap(({ nfc, direct }) => [nfc, direct]));
  const raw = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= raw) * magnitude;
  const limit = step * 4;
  const fraction = (index) => index / Math.max(1, data.series.length - 1);
  const y = (value) => height - height * value / limit;
  const points = (key) => data.series.map((item, index) => [width * fraction(index), y(item[key])]);
  const nfc = pointPath(points('nfc'));
  const direct = pointPath(points('direct'));
  const dateTicks = data.series.length <= 7 ? data.series.map((_, index) => index) :
    Array.from({ length: 7 }, (_, index) => Math.round(index * (data.series.length - 1) / 6));
  return `<article class="panel chart-panel"><div class="chart-heading">
    <h2>Посещения по дням</h2>
    <div class="legend" aria-label="Источники"><span><i></i>С NFC</span><span><i></i>Другие</span></div>
    </div>
    <div class="chart-canvas">
      <div class="y-labels" aria-hidden="true">${ticks.map((tick) => `<span>${nf.format(step * tick)}</span>`).join('')}</div>
      <div class="chart-plot"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="График NFC и других посещений по дням">
        ${ticks.map((tick) => `<line class="chart-gridline" x1="0" y1="${y(step * tick)}" x2="${width}" y2="${y(step * tick)}" vector-effect="non-scaling-stroke"/>`).join('')}
        <path class="chart-area" d="${nfc} L ${width} ${height} L 0 ${height} Z"/>
        <path class="chart-series chart-direct" d="${direct}" vector-effect="non-scaling-stroke"/>
        <path class="chart-series chart-nfc" d="${nfc}" vector-effect="non-scaling-stroke"/>
        ${data.series.map((point, index) => {
          const label = `${dateLabel(point.day, { day: 'numeric', month: 'long' })}: NFC — ${nf.format(point.nfc)}, другие — ${nf.format(point.direct)}`;
          const hitWidth = width / Math.max(1, data.series.length - 1);
          const x = width * fraction(index);
          const start = Math.max(0, x - hitWidth / 2);
          const end = Math.min(width, x + hitWidth / 2);
          return `<rect class="chart-hit" x="${start}" y="0" width="${end - start}" height="${height}" aria-label="${html(label)}"><title>${html(label)}</title></rect>`;
        }).join('')}
      </svg><div class="x-labels">${dateTicks.map((index, position) =>
        `<span style="--day:${fraction(index) * 100}%" class="${position === Math.floor(dateTicks.length / 2) ? 'major-date' : ''}">${html(dateLabel(data.series[index].day, { day: 'numeric', month: 'short' }))}</span>`).join('')}</div></div>
    </div>
    </article>`;
}

function actions(data, full = false) {
  const relevant = full ? Object.entries(actionInfo) : Object.entries(actionInfo).filter(([key]) => key === 'menu' || key === 'maps' || data.current[key] > 0).slice(0, 4);
  const maximum = Math.max(1, ...relevant.map(([key]) => data.current[key]));
  return `<article class="panel actions-panel"><h2>Действия гостей</h2><div class="action-stats">
    ${relevant.map(([key, [label, icon]]) => `<div class="action-stat">${svg(icon)}
    <div class="action-stat-body"><div><span>${label}</span><strong>${nf.format(data.current[key])}</strong></div>
    <div class="progress"><i style="width:${data.current[key] / maximum * 100}%"></i></div></div></div>`).join('')}
  </div></article>`;
}

function tipsAnalytics({ counts, paid }) {
  const countFor = (method, source) => counts.find((row) => row.method === method && row.source === source)?.count || 0;
  return `<section class="site-section"><div class="section-heading"><div><h2>Чаевые</h2>
    <p>Переходы по способам и оплаты, подтверждённые bePaid</p></div></div>
    <div class="tip-metrics"><article class="panel metric"><div class="metric-head">Подтверждённые оплаты</div>
    <strong class="metric-number">${nf.format(paid.count)}</strong></article>
    <article class="panel metric"><div class="metric-head">Сумма подтверждённых чаевых</div>
    <strong class="metric-number">${money(paid.amount, 'BYN')}</strong></article></div>
    <div class="panel table-wrap"><table><thead><tr><th>Способ</th><th class="numeric">С NFC</th><th class="numeric">Другие переходы</th></tr></thead>
    <tbody>${Object.entries(tipLabels).map(([method, label]) => `<tr><td>${html(label)}</td><td class="numeric">${nf.format(countFor(method, 'nfc'))}</td><td class="numeric">${nf.format(countFor(method, 'direct'))}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

function siteIcon(site, large = false) {
  const icon = { coffee: 'coffee', garden: 'leaf' }[site.theme] || 'globe';
  const logoPhoto = site.logo_photo_url || site.logo_url;
  return logoPhoto ? `<img class="site-icon" src="${html(logoPhoto)}" alt="">` : `<span class="site-icon">${svg(icon, large ? 28 : 18)}</span>`;
}

function statusBadge(status) {
  return `<span class="status ${status}"><i></i>${status === 'live' ? 'Опубликован' : 'Черновик'}</span>`;
}

function siteCards(sites) {
  return sites.length ? `<div class="site-grid">${sites.map((site) => `<a class="panel site-card" href="/admin/sites/${site.slug}" data-nav>
    <span class="site-card-main">${siteIcon(site)}<span class="site-card-name"><strong>${html(site.name)}</strong><small>${html(site.type)}</small></span></span>
    ${statusBadge(site.status)}
    <span class="site-card-bottom">/${site.slug}</span>
  </a>`).join('')}</div>` : `<div class="panel empty"><h3>Пока нет мини-сайтов</h3><p>${state.user.role === 'owner' ? 'Создайте первую страницу для заведения.' : 'Владелец может назначить вам доступ к странице.'}</p>${createButton()}</div>`;
}

function overviewContent(data) {
  return `<div class="page-heading"><div><h1>Обзор</h1><p>Статистика и управление вашими мини-сайтами.</p></div>
    <div class="heading-actions">${periodControl()}${createButton()}</div></div>
    ${nfcIntroduction()}${metrics(data)}
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
  ${data.sites.length ? `<div class="panel table-wrap"><table><thead><tr><th>Мини-сайт</th><th>Статус</th><th class="numeric">Все посещения</th><th class="numeric">С NFC</th></tr></thead><tbody>
  ${data.sites.map((site) => `<tr><td><a class="table-site" data-nav href="/admin/sites/${site.slug}">${siteIcon(site)}<strong>${html(site.name)}</strong></a></td>
  <td>${statusBadge(site.status)}</td><td class="numeric">${nf.format(site.visits)}</td><td class="numeric">${nf.format(site.nfc)}</td></tr>`).join('')}
  </tbody></table></div>` : siteCards([])}</section>${tipsAnalytics(data.tips)}`;
}

function sitesContent(data) {
  const description = state.user.role === 'owner'
    ? 'Управляйте страницами, NFC-ссылками и меню заведений.'
    : 'Создание и удаление мини-сайтов, выдачу и отзыв доступа согласовывайте с владельцем платформы.';
  return `<div class="page-heading"><div><h1>Мини-сайты</h1><p>${description}</p></div><div class="heading-actions">${createButton()}</div></div>
  ${data.sites.length ? `<div class="site-toolbar"><label class="search-input">${svg('search', 18)}<input id="siteSearch" type="search" placeholder="Поиск по названию или адресу" autocomplete="off" aria-label="Поиск мини-сайтов"></label><span>${nf.format(data.sites.length)} в списке</span></div>` : ''}
  <div id="searchResults">${siteCards(data.sites)}</div>`;
}

function themeSwatch(key) {
  return `<span class="theme-sample landing-body landing-${key}" aria-hidden="true">
    <span class="theme-sample-hero"></span><span class="theme-sample-button"></span>
  </span><span class="theme-title">${themes[key]}</span>`;
}

function themeChoices(selected) {
  const keys = featuredThemes.includes(selected) ? featuredThemes : [...featuredThemes.slice(0, -1), selected];
  return keys.map((key) => `<label class="theme-choice">
    <input type="radio" class="sr-only" name="theme" value="${key}" ${selected === key ? 'checked' : ''}>
    <span class="theme-tile">${themeSwatch(key)}</span>
  </label>`).join('');
}

function themePicker(theme) {
  const selected = Object.hasOwn(themes, theme) ? theme : 'coffee';
  return `<fieldset class="theme-picker"><legend>Цветовая тема</legend>
    <div class="theme-grid" data-theme-choices>${themeChoices(selected)}</div>
    <button class="button secondary theme-more" type="button" data-action="theme-catalogue" aria-haspopup="dialog">Показать ещё</button>
  </fieldset>`;
}

function openThemeCatalogue(opener) {
  const picker = opener.closest('.theme-picker');
  const selected = picker.querySelector('input[name="theme"]:checked')?.value ?? 'coffee';
  const form = picker.closest('form');
  const venue = form.elements.name?.value.trim() || state.details?.site.name || 'Ваше заведение';
  const type = form.elements.type?.value.trim() || state.details?.site.type || '';
  const dialog = document.createElement('dialog');
  dialog.className = 'theme-catalogue';
  dialog.setAttribute('aria-labelledby', 'themeCatalogueTitle');
  let preview;

  function render() {
    dialog.innerHTML = `<div class="modal-view">
      <div class="modal-header"><h2 id="themeCatalogueTitle">${preview ? 'Предпросмотр · ' + themes[preview] : 'Все темы'}</h2>
        <button type="button" class="icon-button" data-theme-close aria-label="Закрыть">${svg('close')}</button></div>
      ${preview ? `<div class="theme-preview landing-body landing-${preview}">
        <div class="public-hero"><div class="public-hero-inner">
          <span class="site-icon">${svg('globe')}</span><div class="public-identity">${type ? `<p class="public-type">${html(type)}</p>` : ''}
          <h3>${html(venue)}</h3></div>
        </div></div>
        <div class="theme-preview-actions" aria-hidden="true"><span class="public-button main-action">Открыть меню</span>
          <span class="public-button">Оценить заведение</span></div>
      </div>
      <div class="theme-preview-footer">
        <button type="button" class="button secondary" data-theme-back>Назад</button>
        <button type="button" class="button primary" data-theme-apply>Применить</button>
      </div>` : `<div class="theme-grid">${Object.keys(themes).map((key) => `<button
        type="button" class="theme-tile${key === selected ? ' is-current' : ''}" data-theme-preview="${key}"${key === selected ? ' aria-current="true"' : ''}>${themeSwatch(key)}</button>`).join('')}</div>`}
    </div>`;
  }

  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
    const choice = event.target.closest('[data-theme-preview]');
    if (choice) {
      preview = choice.dataset.themePreview;
      render();
      dialog.querySelector('[data-theme-back]').focus();
    } else if (event.target.closest('[data-theme-back]')) {
      const previous = preview;
      preview = null;
      render();
      dialog.querySelector('[data-theme-preview="' + previous + '"]').focus();
    } else if (event.target.closest('[data-theme-apply]')) {
      picker.querySelector('[data-theme-choices]').innerHTML = themeChoices(preview);
      dialog.close();
    } else if (event.target.closest('[data-theme-close]') || event.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    opener.focus();
  }, { once: true });
  document.body.append(dialog);
  render();
  dialog.showModal();
}

const siteLinks = {
  website_url: ['Официальный сайт', 'https://example.com'],
  vk_url: ['ВКонтакте', 'vk.com/…'],
  telegram_url: ['Telegram', 't.me/…'],
  instagram_url: ['Instagram', 'instagram.com/…'],
};

function siteOption(name, label, enabled, fields) {
  return `<div class="site-link-option" data-site-option>
    <label class="check-label"><input type="checkbox" name="${name}" data-site-toggle ${enabled ? 'checked' : ''}>${label}</label>
    <div class="site-option-fields" data-site-fields ${enabled ? '' : 'hidden'}>${fields}</div>
  </div>`;
}

function siteLinkOption(site, key, label, placeholder) {
  const enabled = key === 'website_url' ? !!site.show_website :
    !!site[key] && !site.hidden_links?.includes(key);
  return siteOption('enable_' + key, label, enabled, `<label>
      <span class="sr-only">Ссылка · ${label}</span>
      <input name="${key}" ${key === 'website_url' ? 'type="url"' : 'inputmode="url"'}
        maxlength="2048" placeholder="${placeholder}" value="${html(site[key])}" data-site-required ${enabled ? 'required' : 'disabled'}>
    </label>`);
}

function updateSiteOptionFields(toggle) {
  const wrap = toggle.closest('[data-site-option]').querySelector('[data-site-fields]');
  wrap.hidden = !toggle.checked;
  for (const input of wrap.querySelectorAll('input, textarea')) {
    input.disabled = !toggle.checked;
    input.required = toggle.checked && input.hasAttribute('data-site-required');
  }
}

function siteForm(site = {}) {
  const isNew = !site.slug;
  const value = (key, fallback = '') => html(site[key] ?? fallback);
  const hoursEnabled = !!(site.show_hours ?? site.opening_hours);
  const wifiEnabled = !!(site.show_wifi ?? (site.wifi_name || site.wifi_password));
  return `<form id="siteForm" class="form-stack site-editor">
  <fieldset class="form-stack site-contact-fields"><legend>О заведении</legend><div class="form-grid">
  <label>Название<input name="name" maxlength="80" required placeholder="Moka Coffee" value="${value('name')}"></label>
  <label>Тип заведения<input name="type" maxlength="50" required placeholder="Кофейня" value="${value('type')}"></label>
  </div>
  ${isNew ? '<label>Адрес страницы<div class="input-prefix"><span>/</span><input name="slug" maxlength="48" pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="moka-coffee" autocomplete="off"></div><small>Латинские буквы, цифры и дефисы. Адрес закрепляется за страницей.</small></label>' : ''}
  <label>Описание<textarea name="description" rows="3" maxlength="260" placeholder="Коротко о заведении">${value('description')}</textarea></label>
  <div class="form-grid"><label>Валюта<select name="currency">${['BYN', 'RUB', 'KZT', 'USD', 'EUR'].map((key) => `<option ${site.currency === key ? 'selected' : ''}>${key}</option>`).join('')}</select></label>
  <label>Статус<select name="status"><option value="draft">Черновик</option><option value="live" ${site.status === 'live' ? 'selected' : ''}>Опубликован</option></select></label></div>
  </fieldset>
  <fieldset class="form-stack site-contact-fields"><legend>Оформление</legend>
  ${isNew ? '' : `<input type="hidden" name="previous_theme" value="${value('theme')}">`}
  ${themePicker(site.theme)}
  <div class="site-photo-grid">
    ${photoEditor('logo_photo', 'Логотип', site.logo_photo_url, 'logo_url', site.logo_url)}
    ${photoEditor('cover_photo', 'Обложка', site.cover_photo_url, 'cover_url', site.cover_url)}
  </div>
  </fieldset>
  <fieldset class="form-stack site-contact-fields"><legend>Ссылки для гостей</legend>
    ${Object.entries(siteLinks).map(([key, [label, placeholder]]) => siteLinkOption(site, key, label, placeholder)).join('')}
  </fieldset>
  <fieldset class="form-stack site-contact-fields"><legend>Для гостей</legend>
    ${siteOption('show_hours', 'Время работы', hoursEnabled, `<label>График работы
      <textarea name="opening_hours" maxlength="240" rows="3" placeholder="Пн–Пт 08:00–21:00" data-site-required ${hoursEnabled ? 'required' : 'disabled'}>${value('opening_hours')}</textarea>
    </label>`)}
    ${siteOption('show_wifi', 'Гостевой Wi-Fi', wifiEnabled, `<div class="form-grid">
      <label>Название сети<input name="wifi_name" maxlength="80" value="${value('wifi_name')}" ${wifiEnabled ? '' : 'disabled'}></label>
      <label>Гостевой пароль<input name="wifi_password" maxlength="128" autocomplete="off" value="${value('wifi_password')}" ${wifiEnabled ? '' : 'disabled'}></label>
    </div>`)}
  </fieldset>
  <p class="form-error" role="alert"></p><div class="form-footer">${isNew ? button('Отмена', '', 'close-dialog', 'secondary') : ''}
  <button class="button primary" type="submit">${isNew ? 'Создать сайт' : 'Сохранить изменения'}</button></div></form>`;
}

function guestLayoutForm(site) {
  const order = site.guest_order;
  return `<section class="panel form-panel"><h2>Для гостей</h2>
    <form id="guestLayoutForm" class="form-stack" data-version="${site.guest_version}">
      <fieldset class="form-stack site-contact-fields"><legend>Порядок элементов</legend>
        <p class="muted">Порядок применяется к включённым элементам на гостевой странице.</p>
        <ol class="guest-order">${order.map((key, index) => `<li data-guest-block="${key}"><span>${guestBlockLabels[key]}</span>
          <div class="heading-actions">
            <button type="button" class="button secondary" data-guest-move="-1" aria-label="${guestBlockLabels[key]}: выше" ${index === 0 ? 'disabled' : ''}>Выше</button>
            <button type="button" class="button secondary" data-guest-move="1" aria-label="${guestBlockLabels[key]}: ниже" ${index === order.length - 1 ? 'disabled' : ''}>Ниже</button>
          </div></li>`).join('')}</ol>
      </fieldset>
      <p class="form-error" role="alert"></p>
      <div class="form-footer"><button type="submit" class="button primary">Сохранить</button></div>
    </form></section>`;
}

function reviewSettings(site) {
  const enabled = !!site.show_reviews;
  return `<details class="panel form-panel feedback-settings"><summary>Настройки отзывов</summary>
    <form id="reviewSettingsForm" class="form-stack" data-version="${site.guest_version}">
      ${siteOption('show_reviews', 'Показывать кнопку «Оценить заведение»', enabled, `<div class="form-stack">
        <p class="muted">Кнопка появится после добавления хотя бы одной ссылки.</p>
        <div class="form-grid">${Object.entries(reviewLabels).map(([key, label]) => `<label>${label}
          <input name="${key}_review_url" type="url" maxlength="2048" placeholder="https://…" value="${html(site[key + '_review_url'])}" ${enabled ? '' : 'disabled'}>
        </label>`).join('')}</div>
      </div>`)}
      <p class="form-error" role="alert"></p>
      <div class="form-footer"><button type="submit" class="button primary">Сохранить</button></div>
    </form></details>`;
}

function moveGuestBlock(trigger) {
  const row = trigger.closest('[data-guest-block]');
  const up = trigger.dataset.guestMove === '-1';
  const neighbor = up ? row.previousElementSibling : row.nextElementSibling;
  if (!neighbor) return;
  if (up) neighbor.before(row);
  else neighbor.after(row);
  const rows = [...row.parentElement.children];
  rows.forEach((item, index) => {
    item.querySelector('[data-guest-move="-1"]').disabled = index === 0;
    item.querySelector('[data-guest-move="1"]').disabled = index === rows.length - 1;
  });
  (trigger.disabled ? row.querySelector('button:not(:disabled)') : trigger).focus();
}

function itemsContent(site, items) {
  return `<div class="section-heading detail-heading"><div><h2>Позиции меню</h2><p>${items.length > 1 ? 'Перетащите позицию за ручку или используйте «Выше» и «Ниже».' : 'Добавляйте позиции, меняйте цены и наличие.'}</p></div>
    <div class="heading-actions">${button('Настройки меню', 'settings', 'menu-link', 'secondary')}
    ${button('Импорт из файла', '', 'menu-import', 'secondary')}${button('Добавить позицию', 'plus', 'new-item')}</div></div>
    ${!site.show_menu ? '<p class="muted">Кнопка меню скрыта на главной странице.</p>' :
      site.menu_url ? '<p class="muted">Кнопка меню открывает внешнюю ссылку.</p>' : ''}
    ${items.length ? `<div class="panel table-wrap"><table id="menuItemList"><thead><tr><th><span class="sr-only">Порядок</span></th><th>Название</th><th>Категория</th><th class="numeric">Цена</th><th>Наличие</th><th><span class="sr-only">Действия</span></th></tr></thead>
      <tbody>${items.map((item, index) => `<tr data-menu-row="${html(item.id)}"><td class="item-order-cell">
      ${items.length > 1 ? `<span class="item-order-handle" data-item-drag title="Перетащить" aria-hidden="true">${svg('grip', 20)}</span>
      <div class="item-order-buttons">
        <button type="button" data-action="move-item" data-id="${html(item.id)}" data-direction="-1" aria-label="${html(item.name)}: переместить выше" ${index === 0 ? 'disabled' : ''}>Выше</button>
        <button type="button" data-action="move-item" data-id="${html(item.id)}" data-direction="1" aria-label="${html(item.name)}: переместить ниже" ${index === items.length - 1 ? 'disabled' : ''}>Ниже</button>
      </div>` : ''}</td>
      <td><div class="table-item">${item.photo_url ? `<img src="${html(item.photo_url)}" alt="" width="42" height="42" loading="lazy" decoding="async">` : ''}
      <div><strong>${html(item.name)}</strong>${item.description ? `<small class="table-note">${html(item.description)}</small>` : ''}</div></div></td>
      <td>${html(item.category)}</td><td class="numeric">${money(item.price, site.currency)}</td><td><span class="status ${item.available ? 'live' : 'draft'}"><i></i>${item.available ? 'В меню' : 'Скрыта'}</span></td>
      <td><div class="row-actions"><button class="icon-button" data-action="edit-item" data-id="${item.id}" aria-label="Редактировать ${html(item.name)}">${svg('pencil', 18)}</button>
      <button class="icon-button danger" data-action="delete-item" data-id="${item.id}" aria-label="Удалить ${html(item.name)}">${svg('trash', 18)}</button></div></td></tr>`).join('')}</tbody></table></div>` :
      '<div class="panel empty"><h3>Меню пока пустое</h3><p>Добавьте позицию, чтобы она появилась на странице заведения.</p></div>'}`;
}

function phoneField(number = '', autocomplete = '') {
  return `<label>Номер телефона<span class="phone-control"><span aria-hidden="true">+375</span>
    <input name="phone_digits" type="tel" inputmode="numeric" pattern="[0-9]{9}" maxlength="9" required
      ${autocomplete ? 'autocomplete="tel-national"' : ''} aria-label="Девять цифр номера после +375" value="${html(number.slice(4))}">
  </span></label>`;
}

function adminDialog(admin = {}) {
  const editing = !!admin.email;
  showModal(editing ? 'Данные администратора' : 'Добавить администратора',
    `<form id="adminForm" class="form-stack" data-email="${html(admin.email || '')}">
      <div class="form-grid">
        <label>Имя<input name="first_name" maxlength="80" required value="${html(admin.first_name || '')}"></label>
        <label>Фамилия<input name="last_name" maxlength="80" required value="${html(admin.last_name || '')}"></label>
      </div>
      <label>Электронная почта<input name="email" type="email" maxlength="254" required ${editing ? 'readonly' : ''}
        value="${html(admin.email || '')}"></label>
      ${phoneField(admin.phone || '')}
      <label>Ник в Telegram<input name="telegram_username" maxlength="33" placeholder="@username" value="${html(admin.telegram_username ? '@' + admin.telegram_username : '')}"></label>
      <p class="form-error" role="alert"></p>
      <button class="button primary" type="submit">${editing ? 'Сохранить' : 'Выдать доступ'}</button>
      ${editing && state.passwordAvailable ? '<button class="button secondary" type="button" data-action="admin-password">Настроить вход с паролем</button>' : ''}
    </form>`);
}

async function passwordSettingsDialog(path, email, ownAccount) {
  const { configured, login } = await api(path);
  showModal('Логин и пароль', `<form id="passwordSettingsForm" class="form-stack" method="post">
    <label>Почта для входа<input type="email" name="email" autocomplete="username" value="${html(email)}" readonly></label>
    <label>Логин (необязательно)<input name="login" type="text" maxlength="32" value="${html(login)}"
      pattern="[A-Za-z0-9][A-Za-z0-9._\\-]{2,31}" autocapitalize="none" spellcheck="false">
      <small>3–32 символа. Латинские буквы, цифры, точка, дефис и подчёркивание.</small></label>
    <label>${configured ? 'Новый пароль' : 'Пароль'}<input name="password" type="password" autocomplete="new-password"
      minlength="15" maxlength="256" required><small>От 15 до 128 символов.</small></label>
    ${ownAccount ? '' : '<small class="muted">Пароль действует во всех назначенных администратору мини-сайтах.</small>'}
    <p class="form-error" role="alert"></p>
    <button class="button primary" type="submit">Сохранить</button>
    ${configured ? '<button class="button secondary" type="button" data-remove-password>Отключить вход с паролем</button>' : ''}
  </form>`);
  const form = modal.querySelector('#passwordSettingsForm');
  form.elements.login.focus();
  async function save(method, body) {
    const error = form.querySelector('.form-error');
    const buttons = [...form.querySelectorAll('button')];
    error.textContent = '';
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await api(path, { method, body });
      modal.close();
      if (ownAccount && state.user.provider === 'password') {
        location.replace('/admin');
        return;
      }
      toast(method === 'DELETE' ? 'Вход с паролем отключён' : 'Данные для входа сохранены');
    } catch (failure) {
      error.textContent = failure.message;
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save('PUT', { login: form.elements.login.value, password: form.elements.password.value });
  });
  form.querySelector('[data-remove-password]')?.addEventListener('click', () => save('DELETE'));
}

function accessContent(admins) {
  return `<div class="panel form-panel"><h2>Администраторы сайта</h2><p>Администратор может редактировать меню и видеть статистику этого мини-сайта.</p>
    ${admins.length ? `<ul class="access-list">${admins.map((admin) => {
      const { email, first_name, last_name, phone, telegram_username } = admin;
      const name = [first_name, last_name].filter(Boolean).join(' ');
      const details = [name && email, phone, telegram_username && '@' + telegram_username].filter(Boolean).join(' · ');
      return `<li><div class="admin-identity">${svg('users', 18)}<div><strong>${html(name || email)}</strong>${details ? `<small>${html(details)}</small>` : ''}</div></div>
        <div class="row-actions"><button class="icon-button" data-action="edit-admin" data-email="${html(email)}" aria-label="Изменить данные администратора">${svg('pencil', 18)}</button>
        <button class="icon-button danger" data-action="delete-admin" data-email="${html(email)}" aria-label="Отозвать доступ">${svg('trash', 18)}</button></div></li>`;
    }).join('')}</ul>` : '<p class="muted">Администраторы пока не назначены.</p>'}
    <button class="button primary" type="button" data-action="new-admin">Добавить администратора</button>
  </div>`;
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

function reportUnavailable(showSites = false) {
  return `<section class="panel empty"><h2>Статистика временно недоступна</h2>
    ${button('Повторить', '', 'retry-load', 'secondary')}
    ${showSites ? '<a class="button primary" href="/admin/sites" data-nav>К мини-сайтам</a>' : ''}</section>`;
}

function feedbackContent(inbox, sites) {
  const { status, rating, sort, site = '' } = state.feedbackQuery;
  const options = (values, selected) => values.map(([value, label]) =>
    `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  const format = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Minsk' });
  return `<section class="feedback-inbox">
    <div class="${sites ? 'page-heading' : 'section-heading detail-heading'}"><div>${sites ? '<h1>Отзывы</h1>' : '<h2>Отзывы гостей</h2>'}<p>Приватные отзывы с оценками от 1 до 3.</p></div>
      ${button('Обновить', '', 'retry-load', 'secondary')}</div>
    <form id="feedbackFilters" class="panel feedback-filters form-stack">
      ${sites ? `<label>Мини-сайт<select name="site">${options([['', 'Все мини-сайты'], ...sites.map(({ slug, name }) => [slug, html(name)])], site)}</select></label>` : ''}
      <label>Статус<select name="status">${options([['', 'Все'], ['unread', 'Непрочитанные'], ['read', 'Прочитанные']], status)}</select></label>
      <label>Оценка<select name="rating">${options([['', 'Любая'], ['1', '1 звезда'], ['2', '2 звезды'], ['3', '3 звезды']], rating)}</select></label>
      <label>Сортировка<select name="sort">${options([['recent', 'Сначала новые'], ['oldest', 'Сначала старые'], ['lowest', 'Сначала низкие оценки'], ['highest', 'Сначала высокие оценки']], sort)}</select></label>
      <button class="button secondary" type="submit">Применить</button>
    </form>
    ${inbox.reviews.length ? inbox.reviews.map((review) => `<article class="panel feedback-card">
      <header><strong class="feedback-score" aria-label="Оценка ${review.rating} из 5">${svg('star')}${review.rating} / 5</strong>
        ${review.read_at ? '' : '<span class="status">Новый</span>'}</header>
      <p class="feedback-comment">${html(review.comment)}</p>
      <div class="feedback-meta"><span>${html(review.guest_name || 'Анонимно')}</span><span>${html(format.format(new Date(review.created_at)))} · Минск</span>
        <span>${html(review.site_name)}${review.guest_place ? ' · ' + html(review.guest_place) : ''}</span><span>${review.source === 'nfc' ? 'Переход с NFC' : 'Открытие по ссылке'}</span></div>
      ${review.read_at ? '' : `<button class="button secondary" type="button" data-action="feedback-read" data-id="${html(review.id)}" data-slug="${html(review.site_slug)}">Отметить прочитанным</button>`}
    </article>`).join('') : '<div class="panel empty"><p>По этому фильтру отзывов пока нет.</p></div>'}
    ${inbox.page > 1 || inbox.hasMore ? `<div class="heading-actions feedback-pages">
      ${inbox.page > 1 ? button('Назад', '', 'feedback-previous', 'secondary') : ''}
      ${inbox.hasMore ? button('Дальше', '', 'feedback-next', 'secondary') : ''}
    </div>` : ''}
  </section>`;
}

function detailContent(current, bundle, analytics) {
  const { site, items, admins, tips, unreadFeedback, inbox } = bundle;
  const base = '/admin/sites/' + site.slug;
  const owner = state.user.role === 'owner';
  const tabs = [['menu', 'Меню', 'book', base], ['feedback', 'Отзывы', 'star', base + '/feedback'], ['analytics', 'Статистика', 'bars', base + '/analytics'],
    ['guest', 'Для гостей', 'globe', base + '/guest'],
    ...(owner ? [['settings', 'Настройки', 'settings', base + '/settings'], ['access', 'Доступ', 'users', base + '/access'], ['tips', 'Чаевые', 'star', base + '/tips']]
      : [['theme', 'Оформление', 'palette', base + '/theme']])];
  const active = tabs.some(([key]) => key === current.tab) ? current.tab : 'menu';
  const previewPath = '/' + site.slug + '?preview=1';
  return `<div class="page-heading detail-title"><div class="detail-title-main">${siteIcon(site)}<div><h1>${html(site.name)}</h1><p>${html(site.type)} · /${site.slug}</p></div></div>
    <div class="heading-actions">${statusBadge(site.status)}${linkButton('Предпросмотр', 'external', previewPath, 'target="_blank" rel="noopener"')}</div></div>
    <div class="panel nfc-banner"><span class="nfc-mark">${svg('nfc', 24)}</span><div><strong>Ссылка для NFC-метки</strong><small>${html(nfcUrl(site))}</small>
    ${site.status === 'draft' ? `<small class="nfc-draft-hint">Гости смогут открыть ссылку после публикации. ${owner ? `<a href="${base}/settings" data-nav>Настройки публикации</a>` : ''}</small>` : ''}</div>
    ${button('Скопировать', 'copy', 'copy-nfc', 'secondary')}</div>
    <nav class="tabs" aria-label="Разделы сайта">${tabs.map(([key, label, icon, href]) => `<a data-nav href="${href}" class="${active === key ? 'selected' : ''}" ${active === key ? 'aria-current="page"' : ''}>${svg(icon, 18)}${label}${key === 'feedback' && unreadFeedback ? `<span class="feedback-badge" aria-label="Непрочитанных отзывов: ${nf.format(unreadFeedback)}">${nf.format(unreadFeedback)}</span>` : ''}</a>`).join('')}</nav>
    ${active === 'menu' ? itemsContent(site, items) : ''}
    ${active === 'feedback' && inbox ? reviewSettings(site) + feedbackContent(inbox) : ''}
    ${active === 'guest' ? guestLayoutForm(site) : ''}
    ${active === 'settings' ? `<section class="panel form-panel"><h2>Настройки страницы</h2>${siteForm(site)}</section>` : ''}
    ${active === 'theme' ? `<section class="panel form-panel"><h2>Оформление страницы</h2><form id="themeForm" class="form-stack">
      <input type="hidden" name="previous_theme" value="${html(site.theme)}">${themePicker(site.theme)}
      <p class="form-error" role="alert"></p><div class="form-footer"><button type="submit" class="button primary">Сохранить тему</button></div>
    </form></section>` : ''}
    ${active === 'access' ? accessContent(admins) : ''}
    ${active === 'tips' ? tipsForm(tips) : ''}
    ${active === 'analytics' ? `<div class="section-heading detail-heading"><div><h2>Статистика страницы</h2><p>Активность по этому заведению</p></div>${periodControl()}</div>
      ${analytics ? `${metrics(analytics)}<div class="chart-layout">${chart(analytics)}${actions(analytics, true)}</div>${tipsAnalytics(analytics.tips)}`
        : state.statsFailed ? reportUnavailable() : '<div class="initial" role="status">Загрузка статистики…</div>'}` : ''}`;
}

function guestActions({ site, reviewProviders, tips }, base, query) {
  const label = site.type === 'Студия красоты' ? 'Смотреть услуги' : 'Открыть меню';
  const blocks = {
    hours: site.show_hours !== 0 && site.opening_hours && `<dl class="guest-info"><dt>${svg('calendar')} Время работы</dt><dd>${html(site.opening_hours)}</dd></dl>`,
    wifi: site.show_wifi !== 0 && (site.wifi_name || site.wifi_password) && `<details class="guest-wifi">
      <summary class="public-button"><span>${svg('nfc')}Wi-Fi</span>${svg('chevron')}</summary>
      <div class="guest-wifi-info"><dl class="guest-info">
        ${site.wifi_name ? `<div><dt>Сеть</dt><dd>${html(site.wifi_name)}</dd></div>` : ''}
        ${site.wifi_password ? `<div><dt>Пароль</dt><dd><code>${html(site.wifi_password)}</code></dd></div>` : ''}
      </dl>
      ${site.wifi_password ? '<button type="button" class="public-button" data-copy-wifi>Скопировать пароль</button>' : ''}
      <p>Откройте настройки Wi-Fi на телефоне и выберите гостевую сеть.</p></div></details>`,
    menu: site.show_menu && `<a class="public-button main-action" href="${base}/menu${query}" ${site.menu_url ? 'target="_top"' : ''}><span>${svg('book')}${label}</span></a>`,
    feedback: reviewProviders?.length && `<button type="button" class="public-button" data-open-feedback aria-haspopup="dialog"><span>${svg('star')}Оценить заведение</span></button>`,
    website: site.show_website && site.website_url && `<a class="public-button" href="${html(site.website_url)}" target="_blank" rel="noopener noreferrer"><span>${svg('globe')}Официальный сайт</span></a>`,
    tips: tips?.length && `<a class="public-button" target="_top" href="${base}/tips${query}"><span>${tipIcon}Оставить чаевые</span></a>`,
  };
  for (const key of ['telegram', 'instagram', 'vk']) {
    const name = guestBlockLabels[key];
    blocks[key] = site[key + '_url'] && `<a class="public-social" href="${base}/go/${key}${query}" aria-label="${name}" title="${name}">${svg(actionInfo[key][1], 24)}</a>`;
  }
  const actions = (site.guest_order ?? Object.keys(blocks)).map((key) => blocks[key]).filter(Boolean).join('');
  return actions ? `<div class="public-actions">${actions}</div>` : '';
}

function landing(model) {
  const site = model.site;
  const base = '/' + site.slug;
  const isMenu = model.view === 'menu';
  const cover = !isMenu && (site.cover_photo_url || site.cover_url);
  const query = html(model.query);
  const groups = new Map();
  for (const item of model.items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  document.body.classList.add('landing-body', 'landing-' + site.theme);
  app.innerHTML = `<main class="landing${isMenu ? ' landing-menu' : ''}">
    ${model.draftPreview ? '<p class="public-draft-banner">Предпросмотр черновика</p>' : ''}
    <section class="public-hero${cover ? ' with-cover' : ''}">${cover ? `<img class="public-cover" src="${html(cover)}" alt="" fetchpriority="high">` : ''}
      <div class="public-hero-inner">${siteIcon(site, !isMenu)}<div class="public-identity"><p class="public-type">${html(site.type)}</p><h1>${html(site.name)}</h1>${site.description ? `<p class="public-description">${html(site.description)}</p>` : ''}</div></div>
    </section>
    <div class="public-content">
      ${isMenu ? `<div class="public-menu-heading"><h2>${site.type === 'Студия красоты' ? 'Услуги' : 'Меню'}</h2><a href="${base + query}">Главная страница</a></div>
      ${groups.size ? [...groups].map(([category, items]) => `<section class="public-category"><h3>${html(category)}</h3><ul>${items.map((item) =>
        `<li><button class="public-item" type="button" data-menu-item="${html(item.id)}" aria-haspopup="dialog">
          <span class="public-item-copy"><strong>${html(item.name)}</strong>${item.description ? `<span class="public-item-summary">${html(item.description)}</span>` : ''}</span>
          <span class="public-item-price">${money(item.price, site.currency)}</span>
        </button></li>`).join('')}</ul></section>`).join('') : '<p>Позиции появятся здесь позже.</p>'}` : guestActions(model, base, query)}
    </div>
    <footer class="public-footer">${svg('nfc', 18)} Сделано в Тап.</footer>
  </main>`;
  app.querySelector('[data-open-feedback]')?.addEventListener('click', () => feedbackDialog(model));
  app.querySelector('[data-copy-wifi]')?.addEventListener('click', async () => {
    try { await copy(site.wifi_password); toast('Пароль скопирован'); }
    catch (error) { toast(error.message, 'close'); }
  });
  if (isMenu) {
    app.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu-item]');
      if (!button) return;
      const item = model.items.find((entry) => entry.id === button.dataset.menuItem);
      if (item) publicItemDialog(item, site.currency);
    });
  }
}

function feedbackDialog({ site, query, reviewProviders }) {
  const preview = new URLSearchParams(query).has('preview');
  showModal('Оцените заведение', `<form id="guestFeedbackForm" class="form-stack" method="post">
    <fieldset class="feedback-stars"><legend class="sr-only">Оценка от 1 до 5</legend>
      ${[1, 2, 3, 4, 5].map((rating) => `<label><input class="sr-only" name="rating" type="radio" value="${rating}" aria-label="${rating} из 5"><span>${svg('star', 26)}</span></label>`).join('')}
    </fieldset>
    <p class="feedback-thanks" hidden>Спасибо за оценку</p>
    <div class="feedback-extra form-stack" hidden>
      <label>Что вам не понравилось?<textarea name="comment" rows="5" maxlength="2000" placeholder="Расскажите, что можно улучшить"></textarea></label>
      <div class="form-grid">
        <label>Имя (по желанию)<input name="guest_name" maxlength="80" autocomplete="given-name"></label>
        <label>Место или филиал (по желанию)<input name="guest_place" maxlength="100"></label>
      </div>
      <small>${preview ? 'Предпросмотр формы' : 'Отзыв и указанные данные увидит администратор заведения.'}</small>
      <button class="public-button main-action" type="submit" ${preview ? 'disabled' : ''}>Отправить заведению</button>
    </div>
    <div class="public-actions feedback-links" hidden>
      ${reviewProviders.map((key) => `<a class="public-button" href="/${site.slug}/go/${key}${html(query)}" target="_blank" rel="noopener noreferrer"><span>${svg('map')}${reviewLabels[key]}</span></a>`).join('')}
    </div>
    <p class="form-error" role="alert"></p>
  </form>`, 'feedback-dialog');
  const form = modal.querySelector('#guestFeedbackForm');
  const extra = form.querySelector('.feedback-extra');
  const thanks = form.querySelector('.feedback-thanks');
  const links = form.querySelector('.feedback-links');
  const error = form.querySelector('.form-error');
  const submit = form.querySelector('button[type="submit"]');
  let id;
  form.addEventListener('change', (event) => {
    if (event.target.name !== 'rating') return;
    const rating = Number(event.target.value);
    const stars = form.querySelectorAll('.feedback-stars label');
    stars.forEach((star, index) => star.classList.toggle('is-filled', index < rating));
    extra.hidden = rating > 3;
    form.elements.comment.required = !extra.hidden;
    thanks.hidden = rating <= 3;
    links.hidden = false;
    error.textContent = '';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (preview || extra.hidden || submit.disabled) return;
    submit.disabled = true;
    error.textContent = '';
    try {
      id ??= crypto.randomUUID();
      const data = Object.fromEntries(new FormData(form));
      await api('/api/feedback/' + site.slug + (query ?? ''), { method: 'POST', body: { ...data, id, rating: Number(data.rating) } });
      form.querySelector('.feedback-stars').hidden = true;
      extra.hidden = true;
      thanks.textContent = 'Отзыв отправлен заведению';
      thanks.hidden = false;
    } catch (failure) {
      error.textContent = failure.message;
    } finally {
      submit.disabled = false;
    }
  });
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
    title = receipt.paid ? (receipt.test ? 'Тестовый платёж подтверждён' : 'Спасибо за чаевые') :
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

function loginOptions({ googleAvailable, telegramAvailable, smsAvailable, viberAvailable, passwordAvailable }, error) {
  const googleIcon = '<img src="https://developers.google.com/static/identity/images/g-logo.png" width="18" height="18" alt="">';
  return `<div class="login-options">
    ${error ? `<p class="login-status" role="alert">${html(error)}</p>` : ''}
    ${googleAvailable
      ? `<a class="button secondary google-button" href="/auth/google" target="_top">${googleIcon}Войти через Google</a>`
      : `<button class="button secondary google-button" type="button" disabled aria-describedby="googleSetup">${googleIcon}Войти через Google</button><small id="googleSetup">Ожидает подключения</small>`}
    ${telegramAvailable ? '<a class="button secondary" href="/auth/telegram" target="_top">Войти через Telegram</a>' : ''}
    ${passwordAvailable ? `<button class="button secondary" type="button" id="passwordLoginToggle" aria-expanded="false"
      aria-controls="passwordLoginForm">Войти с паролем</button>
    <form id="passwordLoginForm" class="form-stack" method="post" hidden>
      <label>Логин или почта<input name="identifier" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required></label>
      <label>Пароль<input name="password" type="password" autocomplete="current-password" maxlength="256" required></label>
      <button class="button primary" type="submit">Войти</button>
      <p class="form-error" role="alert"></p>
    </form>` : ''}
    ${smsAvailable || viberAvailable ? `<form id="phoneStartForm" class="form-stack">
      ${phoneField('', true)}
      ${smsAvailable ? '<button class="button primary" name="channel" value="sms" type="submit">Получить SMS</button>' : ''}
      ${viberAvailable ? '<button class="button secondary" name="channel" value="viber" type="submit">Получить код в Viber</button>' : ''}
      <p class="form-error" role="alert"></p>
    </form><form id="phoneVerifyForm" class="form-stack" hidden>
      <p class="phone-status" role="status"></p>
      <label>Код из сообщения<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      <button class="button primary" type="submit">Войти</button>
      <button class="button secondary" type="button" data-phone-back>Назад</button>
      <p class="form-error" role="alert"></p>
    </form>` : ''}
  </div>`;
}

function bindPasswordLogin() {
  const form = document.querySelector('#passwordLoginForm');
  if (!form) return;
  const toggle = document.querySelector('#passwordLoginToggle');
  const submit = form.querySelector('button[type="submit"]');
  const error = form.querySelector('.form-error');
  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (form.hidden) {
      form.elements.password.value = '';
      error.textContent = '';
    } else form.elements.identifier.focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    toggle.disabled = true;
    try {
      await api('/auth/password', { method: 'POST', body: {
        identifier: form.elements.identifier.value, password: form.elements.password.value,
      } });
      location.replace('/admin');
    } catch (failure) {
      error.textContent = failure.message;
      form.elements.password.select();
    } finally {
      submit.disabled = false;
      toggle.disabled = false;
    }
  });
}

function bindPhoneLogin(settings) {
  const start = document.querySelector('#phoneStartForm');
  if (!start) return;
  const verify = document.querySelector('#phoneVerifyForm');
  let challenge;
  async function submit(event, action) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('.form-error');
    const buttons = [...form.querySelectorAll('button')];
    error.textContent = '';
    buttons.forEach((button) => { button.disabled = true; });
    try { await action(); }
    catch (failure) { error.textContent = failure.message; }
    finally { buttons.forEach((button) => { button.disabled = false; }); }
  }
  start.addEventListener('submit', (event) => submit(event, async () => {
    const channel = event.submitter?.value || (settings.smsAvailable ? 'sms' : 'viber');
    const phone = '+375' + start.elements.phone_digits.value;
    ({ challenge } = await api('/auth/phone/start', { method: 'POST', body: { channel, phone } }));
    verify.querySelector('.phone-status').textContent = 'Если номер назначен, код придёт ' +
      (channel === 'sms' ? 'по SMS.' : 'в Viber.');
    verify.querySelector('.form-error').textContent = '';
    start.hidden = true;
    verify.hidden = false;
    verify.elements.code.focus();
  }));
  verify.addEventListener('submit', (event) => submit(event, async () => {
    await api('/auth/phone/verify', { method: 'POST', body: { challenge, code: verify.elements.code.value } });
    location.replace('/admin');
  }));
  verify.querySelector('[data-phone-back]').addEventListener('click', () => {
    verify.reset();
    verify.hidden = true;
    start.hidden = false;
    start.elements.phone_digits.focus();
  });
}
let toastTimer;
function toast(message, icon = 'check') {
  const element = document.querySelector('#toast');
  element.innerHTML = svg(icon, 18) + html(message);
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3200);
}

function showModal(title, content, className = '') {
  clearPhotoPreviews(modal);
  modal.className = className;
  modal.innerHTML = `<div class="modal-view"><div class="modal-header"><h2 id="modalTitle">${html(title)}</h2>
    <button class="icon-button" data-action="close-dialog" aria-label="Закрыть">${svg('close')}</button></div>${content}</div>`;
  modal.setAttribute('aria-labelledby', 'modalTitle');
  if (!modal.open) modal.showModal();
}

function photoEditor(name, label, uploaded, linkName, link = '') {
  const source = uploaded || link;
  return `<div class="photo-edit" data-photo-editor data-uploaded="${html(uploaded)}">
    <img class="photo-edit-preview" alt="" ${source ? `src="${html(source)}"` : 'hidden'}>
    <div class="photo-edit-input">
      <label>${html(label)}
        <input type="file" name="${name}" data-photo-file aria-describedby="${name}-hint"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif">
        <small id="${name}-hint">Выберите или перетащите фото до 20 МБ.</small>
      </label>
      <small data-photo-message aria-live="polite"></small>
      <button type="button" class="text-link photo-clear" data-clear-photo hidden>Сбросить выбранный файл</button>
      ${uploaded ? `<label class="check-label"><input name="remove_${name}" type="checkbox" data-remove-photo>Убрать загруженное фото</label>` : ''}
      ${linkName ? `<label>Или ссылка на изображение<input name="${linkName}" data-photo-link inputmode="url" maxlength="2048" placeholder="https://…" value="${html(link)}"></label>` : ''}
    </div>
  </div>`;
}

function itemDialog(item = {}) {
  showModal(item.id ? 'Редактировать позицию' : 'Добавить позицию', `<form id="itemForm" class="form-stack" data-id="${html(item.id)}" data-version="${html(item.edit_version)}">
  <label>Название<input name="name" required maxlength="100" value="${html(item.name)}" placeholder="Капучино"></label>
  <div class="form-grid"><label>Категория<input name="category" required maxlength="55" value="${html(item.category)}" placeholder="Кофе"></label>
  <label>Цена, ${html(state.details.site.currency)}<input name="price" required inputmode="decimal" type="number" min="0" max="999999.99" step="0.01" value="${item.price == null ? '' : item.price / 100}" placeholder="0,00"></label></div>
  <label>Описание<textarea name="description" rows="3" maxlength="300">${html(item.description)}</textarea></label>
  ${photoEditor('photo', item.photo_url ? 'Заменить фото' : 'Фото позиции', item.photo_url)}
  <label class="check-label"><input name="available" type="checkbox" ${item.available !== 0 ? 'checked' : ''}>Показывать в публичном меню</label>
  <p class="form-error" role="alert"></p><div class="form-footer">${button('Отмена', '', 'close-dialog', 'secondary')}<button class="button primary">Сохранить</button></div></form>`);
}

function menuLinkDialog(site) {
  showModal('Настройки меню', `<form id="menuLinkForm" class="form-stack">
    <input type="hidden" name="previous_url" value="${html(site.menu_url)}">
    <input type="hidden" name="previous_show_menu" value="${site.show_menu ? '1' : '0'}">
    <label class="check-label"><input name="show_menu" type="checkbox" ${site.show_menu ? 'checked' : ''}>Показывать кнопку меню</label>
    <label>Ссылка на внешнее меню
      <input name="menu_url" type="url" maxlength="2048" value="${html(site.menu_url)}" placeholder="https://example.com/menu">
      <small>Оставьте поле пустым, чтобы кнопка открывала меню «Тап.».</small>
    </label>
    <p class="form-error" role="alert"></p><div class="form-footer"><button class="button primary" type="submit">Сохранить</button></div>
  </form>`);
}

function menuImportDialog(site) {
  showModal('Импорт позиций меню', `<form id="menuImportForm" class="form-stack">
    <p>Позиции из файла добавятся к текущему меню. Указывайте цены в ${html(site.currency)}.</p>
    ${site.menu_url ? '<p>Чтобы гостевая кнопка открывала добавленные позиции, очистите внешнюю ссылку в настройках меню.</p>' : ''}
    <a class="text-link" href="/assets/menu-template.json" download>Скачать шаблон JSON</a>
    <label>Файл меню<input name="file" type="file" accept=".json,application/json" required><small>До 500 позиций и 512 КБ.</small></label>
    <p class="form-error" role="alert"></p><div class="form-footer"><button class="button primary" type="submit">Импортировать</button></div>
  </form>`);
}

function clearPhotoPreviews(container) {
  for (const [editor, selection] of photoSelections) {
    if (!container.contains(editor)) continue;
    URL.revokeObjectURL(selection.url);
    photoSelections.delete(editor);
  }
}

function photoError(file) {
  if (!file.size || file.size > 20 * 1024 * 1024) return 'Выберите фото размером до 20 МБ.';
  if (file.type && !/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type)) return 'Выберите файл JPEG, PNG, WebP, AVIF или HEIC.';
  return '';
}

function photoLinkPreview(value) {
  if (!value || value === '/assets/moka.jpg') return value;
  try {
    const url = new URL(value.includes('://') ? value : 'https://' + value);
    if (['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password) return url.href;
  } catch { /* Keep the preview empty for an invalid link. */ }
  return '';
}

function updatePhotoPreview(editor) {
  const selection = photoSelections.get(editor);
  const link = editor.querySelector('[data-photo-link]');
  const uploaded = editor.dataset.uploaded;
  const remove = editor.querySelector('[data-remove-photo]');
  const changedLink = link?.value.trim() && link.value.trim() !== link.defaultValue;
  const source = selection?.url || (uploaded && !remove?.checked && !changedLink ? uploaded : photoLinkPreview(link?.value.trim() || ''));
  const image = editor.querySelector('.photo-edit-preview');
  image.hidden = !source;
  if (!source) image.removeAttribute('src');
  else if (image.getAttribute('src') !== source) image.setAttribute('src', source);
  editor.querySelector('[data-clear-photo]').hidden = !selection;
}

function selectPhoto(editor, file) {
  clearPhotoPreviews(editor);
  const message = editor.querySelector('[data-photo-message]');
  const error = file && photoError(file);
  message.textContent = error || file?.name || '';
  message.classList.toggle('input-error', !!error);
  if (file && !error) {
    photoSelections.set(editor, { file, url: URL.createObjectURL(file) });
    const remove = editor.querySelector('[data-remove-photo]');
    if (remove) remove.checked = false;
  } else {
    editor.querySelector('[data-photo-file]').value = '';
  }
  updatePhotoPreview(editor);
}

function photoDrop(event) {
  const editor = event.target.closest('[data-photo-editor]');
  if (!editor || !Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
  if (event.type === 'dragover') {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    editor.classList.add('photo-drag-over');
  } else if (event.type === 'dragleave') {
    if (!editor.contains(event.relatedTarget)) editor.classList.remove('photo-drag-over');
  } else {
    event.preventDefault();
    editor.classList.remove('photo-drag-over');
    const files = event.dataTransfer.files;
    if (files.length === 1) {
      editor.querySelector('[data-photo-file]').value = '';
      selectPhoto(editor, files[0]);
    } else {
      const message = editor.querySelector('[data-photo-message]');
      message.textContent = 'Перетащите одно фото.';
      message.classList.add('input-error');
    }
  }
}

async function scaledPhoto(file) {
  const error = photoError(file);
  if (error) throw new Error(error);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      bitmap = new Image();
      bitmap.src = url;
      await bitmap.decode();
    } catch {
      throw new Error('Браузер не смог открыть фото. Выберите JPEG, PNG или WebP.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const width = bitmap.naturalWidth || bitmap.width;
  const height = bitmap.naturalHeight || bitmap.height;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  try {
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close?.();
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .84));
  if (!blob) throw new Error('Не удалось подготовить фотографию.');
  return blob;
}

async function formWithPhotos(form, data) {
  const payload = new FormData();
  for (const editor of form.querySelectorAll('[data-photo-editor]')) {
    const input = editor.querySelector('[data-photo-file]');
    const file = photoSelections.get(editor)?.file || input.files[0];
    const remove = 'remove_' + input.name;
    delete data[input.name];
    delete data[remove];
    if (form.elements[remove]?.checked) data[remove] = true;
    if (file) payload.set(input.name, await scaledPhoto(file), 'photo');
  }
  if (payload.keys().next().done) return data;
  payload.set('payload', JSON.stringify(data));
  return payload;
}

function confirmDialog(title, text, attribute, value, label, version) {
  showModal(title, `<form id="removeForm" class="form-stack" ${attribute}="${html(value)}" data-version="${html(version)}"><p>${html(text)}</p><p class="form-error" role="alert"></p>
  <div class="form-footer">${button('Отмена', '', 'close-dialog', 'secondary')}<button class="button danger-button" type="submit">${label}</button></div></form>`);
}

async function load() {
  activeLoad?.abort();
  activeLoad = new AbortController();
  const { signal } = activeLoad;
  let current = route();
  if (current.tab === 'access' && state.user.role !== 'owner') {
    history.replaceState({}, '', '/admin/sites/' + current.slug);
    current = route();
  }
  state.data = null;
  state.details = null;
  state.loadError = '';
  state.statsFailed = false;
  render();

  if (['sites', 'detail', 'feedback'].includes(current.name)) {
    const path = current.name === 'detail' ? '/api/sites/' + current.slug : '/api/sites';
    const inboxPath = current.name === 'feedback' ? '/api/feedback' : current.tab === 'feedback' ? path + '/feedback' : '';
    try {
      const [result, inbox] = await Promise.all([api(path, { signal }),
        inboxPath ? api(inboxPath + '?' + new URLSearchParams(state.feedbackQuery), { signal }) : null]);
      if (signal.aborted) return;
      state.user = result.user;
      if (current.name === 'sites') state.data = result;
      else if (current.name === 'feedback') state.data = { ...result, inbox };
      else state.details = { ...result, inbox };
    } catch (error) {
      if (signal.aborted) return;
      state.loadError = error.message;
    }
    render();
    if (current.tab !== 'analytics' || state.loadError) return;
  }

  const params = new URLSearchParams({ days: state.days });
  if (current.name === 'analytics' && state.siteFilter) params.set('site', state.siteFilter);
  if (current.name === 'detail') params.set('site', current.slug);
  try {
    const data = await api('/api/overview?' + params, { signal });
    if (signal.aborted) return;
    state.data = data;
    state.user = data.user;
  } catch {
    if (signal.aborted) return;
    state.statsFailed = true;
  }
  render();
}

function render() {
  const current = route();
  const { data, details, loadError, statsFailed } = state;
  let content = '<div class="initial" role="status">Загрузка…</div>';
  if (loadError) {
    content = `<section class="panel empty"><h2>Не удалось открыть раздел</h2><p>${html(loadError)}</p>
      ${button('Повторить', '', 'retry-load', 'secondary')}
      <a class="button secondary" href="/admin" data-nav>К обзору</a></section>`;
  } else if (current.name === 'detail' && details?.site.slug === current.slug) {
    content = detailContent(current, details, data);
  } else if (statsFailed) {
    content = reportUnavailable(true);
  } else if (data) {
    content = current.name === 'overview' ? overviewContent(data) : current.name === 'analytics' ? analyticsContent(data) :
      current.name === 'feedback' ? feedbackContent(data.inbox, data.sites) : sitesContent(data);
  }
  clearPhotoPreviews(app);
  cancelMenuDrag();
  app.innerHTML = structure(current, content);
}

function navigate(href) {
  if (href !== location.pathname) state.feedbackQuery.page = 1;
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

let menuDrag;
let menuOrderSaving = false;

function startMenuDrag(event) {
  const handle = event.target.closest('[data-item-drag]');
  if (!handle || event.button !== 0 || !event.isPrimary || menuDrag || menuOrderSaving) return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  menuDrag = { handle, row: handle.closest('[data-menu-row]'), pointerId: event.pointerId, startY: event.clientY };
}

function checkMenuDropTarget() {
  const drag = menuDrag;
  const hit = document.elementFromPoint(drag.x, drag.y)?.closest('[data-menu-row]');
  const target = hit?.parentElement === drag.row.parentElement && hit !== drag.row ? hit : null;
  if (target === drag.target) return;
  drag.target?.removeAttribute('data-menu-drop');
  drag.target = target;
  if (target) target.dataset.menuDrop = target.rowIndex < drag.row.rowIndex ? 'before' : 'after';
}

function trackMenuDrag() {
  const drag = menuDrag;
  drag.frame = 0;
  checkMenuDropTarget();
  const scroll = drag.y < 64 ? -14 : drag.y > window.innerHeight - 64 ? 14 : 0;
  if (scroll) {
    window.scrollBy(0, scroll);
    drag.frame = requestAnimationFrame(trackMenuDrag);
  }
}

function updateMenuDrag(event) {
  const drag = menuDrag;
  if (event.pointerId !== drag?.pointerId || (!drag.active && Math.abs(event.clientY - drag.startY) < 6)) return;
  drag.active = true;
  drag.row.classList.add('is-moving');
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (!drag.frame) drag.frame = requestAnimationFrame(trackMenuDrag);
}

function cancelMenuDrag() {
  if (!menuDrag) return;
  const { handle, row, target, pointerId, frame } = menuDrag;
  menuDrag = undefined;
  if (frame) cancelAnimationFrame(frame);
  row.classList.remove('is-moving');
  target?.removeAttribute('data-menu-drop');
  if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
}

function finishMenuDrag(event) {
  const drag = menuDrag;
  if (event.pointerId !== drag?.pointerId) return;
  if (event.type === 'pointerup' && drag.active) {
    drag.x = event.clientX;
    drag.y = event.clientY;
    checkMenuDropTarget();
  }
  const id = drag.row.dataset.menuRow;
  const target = drag.target?.dataset.menuRow;
  cancelMenuDrag();
  if (event.type === 'pointerup' && target) saveMenuOrder(id, target);
}

async function saveMenuOrder(id, target, direction) {
  if (menuOrderSaving) return;
  const { site: { slug }, menuOrderVersion } = state.details;
  const table = document.querySelector('#menuItemList');
  menuOrderSaving = true;
  table?.setAttribute('aria-busy', 'true');
  try {
    await api('/api/sites/' + slug + '/items/order', { method: 'PUT', version: menuOrderVersion, body: { id, target } });
    if (route().slug !== slug) return;
    await load();
    toast('Порядок меню сохранён');
    if (direction) {
      const row = [...document.querySelectorAll('[data-menu-row]')].find((entry) => entry.dataset.menuRow === id);
      const button = row?.querySelector('[data-direction="' + direction + '"]:not(:disabled)') ||
        row?.querySelector('[data-direction]:not(:disabled)');
      button?.focus({ preventScroll: true });
    }
  } catch (error) {
    if (route().slug !== slug) return;
    if (error.status === 412) await load();
    toast(error.message, 'close');
  } finally {
    menuOrderSaving = false;
    table?.removeAttribute('aria-busy');
  }
}

async function onClick(event) {
  const clearPhoto = event.target.closest('[data-clear-photo]');
  if (clearPhoto) {
    selectPhoto(clearPhoto.closest('[data-photo-editor]'), null);
    return;
  }
  const guestMove = event.target.closest('[data-guest-move]');
  if (guestMove) {
    moveGuestBlock(guestMove);
    return;
  }
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
  if (action === 'theme-catalogue') {
    openThemeCatalogue(trigger);
    return;
  }
  if (action === 'retry-load') {
    await load();
    return;
  }
  if (action === 'feedback-next' || action === 'feedback-previous') {
    state.feedbackQuery.page = Math.max(1, state.feedbackQuery.page + (action === 'feedback-next' ? 1 : -1));
    await load();
    return;
  }
  if (action === 'feedback-read') {
    const { slug, id } = trigger.dataset;
    trigger.disabled = true;
    try {
      await api('/api/sites/' + encodeURIComponent(slug) + '/feedback/' + encodeURIComponent(id), { method: 'PUT' });
      const current = route();
      if (current.name === 'feedback' || (current.slug === slug && current.tab === 'feedback')) await load();
    } catch (failure) {
      toast(failure.message, 'close');
    } finally {
      trigger.disabled = false;
    }
    return;
  }
  if (action === 'account') {
    state.showAccount = !state.showAccount;
    render();
  }
  if (action === 'owner-password' || action === 'admin-password') {
    const ownAccount = action === 'owner-password';
    const email = ownAccount ? state.user.email : trigger.form.dataset.email;
    const path = ownAccount ? '/api/password' : '/api/sites/' + state.details.site.slug + '/admins/' + encodeURIComponent(email) + '/password';
    trigger.disabled = true;
    try { await passwordSettingsDialog(path, email, ownAccount); }
    catch (failure) { toast(failure.message); }
    finally { trigger.disabled = false; }
    return;
  }
  if (action === 'signout') {
    trigger.disabled = true;
    try {
      await api('/auth/signout', { method: 'POST', body: {} });
      location.replace('/admin');
    } catch (error) {
      trigger.disabled = false;
      toast(error.message);
    }
  }
  if (action === 'mobile-nav') {
    state.mobileNav = !state.mobileNav;
    render();
  }
  if (action === 'switch-role') {
    const previousRole = state.demoRole;
    state.demoRole = state.user.role === 'owner' ? 'manager' : 'owner';
    try {
      const { user } = await api('/api/session');
      state.user = user;
    } catch (error) {
      state.demoRole = previousRole;
      toast(error.message);
      return;
    }
    try { sessionStorage.setItem('tap-demo-role', state.demoRole); } catch { /* storage disabled */ }
    state.siteFilter = '';
    navigate('/admin');
  }
  if (action === 'new-site') showModal('Создать мини-сайт', siteForm());
  if (action === 'new-item') itemDialog();
  if (action === 'menu-link') menuLinkDialog(state.details.site);
  if (action === 'menu-import') menuImportDialog(state.details.site);
  if (action === 'move-item') {
    const { id, direction } = trigger.dataset;
    const items = state.details.items;
    const index = items.findIndex((entry) => entry.id === id);
    const target = items[index + Number(direction)];
    if (index >= 0 && target) await saveMenuOrder(id, target.id, direction);
  }
  if (action === 'edit-item') {
    const item = state.details.items.find((entry) => entry.id === trigger.dataset.id);
    if (item) itemDialog(item);
  }
  if (action === 'delete-item') {
    const item = state.details.items.find((entry) => entry.id === trigger.dataset.id);
    if (item) confirmDialog('Удалить позицию?', '«' + item.name + '» исчезнет из меню.', 'data-item', item.id, 'Удалить', item.edit_version);
  }
  if (action === 'new-admin') adminDialog();
  if (action === 'edit-admin') {
    const admin = state.details.admins.find(({ email }) => email === trigger.dataset.email);
    if (admin) adminDialog(admin);
  }
  if (action === 'delete-admin') confirmDialog('Отозвать доступ?', trigger.dataset.email + ' потеряет доступ к этому мини-сайту.', 'data-email', trigger.dataset.email, 'Отозвать');
  if (action === 'copy-nfc') {
    try { await copy(nfcUrl(state.details.site)); toast('NFC-ссылка скопирована'); }
    catch (error) { toast(error.message); }
  }
}

async function onSubmit(event) {
  const form = event.target;
  if (form.id === 'feedbackFilters') {
    event.preventDefault();
    state.feedbackQuery = { ...state.feedbackQuery, ...Object.fromEntries(new FormData(form)), page: 1 };
    await load();
    return;
  }
  if (!['siteForm', 'itemForm', 'adminForm', 'removeForm', 'tipsForm', 'menuLinkForm', 'menuImportForm', 'themeForm', 'guestLayoutForm', 'reviewSettingsForm'].includes(form.id)) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  const error = form.querySelector('.form-error');
  const data = Object.fromEntries(new FormData(form));
  const slug = state.details?.site.slug;
  const base = '/api/sites/' + slug;
  submit.disabled = true;
  error.textContent = '';
  try {
    if (form.id === 'guestLayoutForm') {
      data.guest_order = [...form.querySelectorAll('[data-guest-block]')].map((row) => row.dataset.guestBlock);
      await api(base + '/guest', { method: 'PUT', version: form.dataset.version, body: data });
      toast('Гостевая страница обновлена');
    }
    if (form.id === 'reviewSettingsForm') {
      data.show_reviews = form.elements.show_reviews.checked;
      await api(base + '/guest', { method: 'PUT', version: form.dataset.version, body: data });
      toast('Настройки отзывов сохранены');
    }
    if (form.id === 'themeForm') {
      await api(base + '/theme', { method: 'PUT', body: data });
      toast('Тема сохранена');
    }
    if (form.id === 'menuLinkForm') {
      await api(base + '/items/link', { method: 'PUT', body: { ...data,
        show_menu: form.elements.show_menu.checked, previous_show_menu: data.previous_show_menu === '1' } });
      modal.close();
      toast('Настройки меню сохранены');
    }
    if (form.id === 'menuImportForm') {
      if (!data.file?.size || data.file.size > 512 * 1024) throw new Error('Выберите непустой файл JSON до 512 КБ.');
      let menu;
      try { menu = JSON.parse(await data.file.text()); }
      catch { throw new Error('Файл не читается как JSON. Сверьтесь с шаблоном.'); }
      const { added, skipped } = await api(base + '/items/import', { method: 'POST', body: menu });
      modal.close();
      toast('Добавлено позиций: ' + added + (skipped ? '. Уже импортировано: ' + skipped : ''));
    }
    if (form.id === 'siteForm') {
      const isNew = modal.contains(form);
      data.link_visibility = Object.fromEntries(Object.keys(siteLinks).map((key) => [key, form.elements['enable_' + key].checked]));
      data.show_hours = form.elements.show_hours.checked;
      data.show_wifi = form.elements.show_wifi.checked;
      const result = await api(isNew ? '/api/sites' : base, { method: isNew ? 'POST' : 'PUT', body: await formWithPhotos(form, data) });
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
      const body = await formWithPhotos(form, { ...data, price, available: form.elements.available.checked });
      await api(base + '/items' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', version: id ? form.dataset.version : undefined, body });
      modal.close();
      toast('Позиция сохранена');
    }
    if (form.id === 'adminForm') {
      const email = form.dataset.email;
      const { phone_digits, ...profile } = data;
      await api(base + '/admins' + (email ? '/' + encodeURIComponent(email) : ''),
        { method: email ? 'PUT' : 'POST', body: { ...profile, phone: '+375' + phone_digits } });
      modal.close();
      toast(email ? 'Данные сохранены' : 'Доступ выдан');
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
      await api(base + target, { method: 'DELETE', version: id ? form.dataset.version : undefined });
      modal.close();
      toast(id ? 'Позиция удалена' : 'Доступ отозван');
    }
    await load();
  } catch (failure) {
    error.textContent = failure.message;
    if (failure.status === 412 && route().slug === slug) await load();
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
    const settings = await api('/api/session');
    const { user, ownerConfigured } = settings;
    const query = new URLSearchParams(location.search);
    const googleCode = query.get('google');
    const telegramCode = query.get('telegram');
    const googleError = Object.hasOwn(googleMessages, googleCode) ? googleMessages[googleCode] : '';
    const telegramError = Object.hasOwn(telegramMessages, telegramCode) ? telegramMessages[telegramCode] : '';
    if (!user || googleError || telegramError) {
      notice('Панель управления', 'Войдите с данными, указанными владельцем.',
        loginOptions(settings, googleError || telegramError) + '<a class="notice-about" href="/about">О проекте «Тап.»</a>');
      bindPasswordLogin();
      bindPhoneLogin(settings);
      return;
    }
    if (!ownerConfigured) {
      notice('Панель ожидает настройки', 'Для запуска рабочего пространства нужно указать email владельца.');
      return;
    }
    state.user = user;
    state.passwordAvailable = settings.passwordAvailable;
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    for (const type of ['dragover', 'dragleave', 'drop']) document.addEventListener(type, photoDrop);
    document.addEventListener('pointerdown', startMenuDrag);
    document.addEventListener('pointermove', updateMenuDrag);
    document.addEventListener('pointerup', finishMenuDrag);
    document.addEventListener('pointercancel', finishMenuDrag);
    document.addEventListener('lostpointercapture', finishMenuDrag);
    document.addEventListener('change', (event) => {
      const input = event.target;
      if (input.id === 'period') { state.days = Number(input.value); load(); }
      if (input.id === 'siteFilter') { state.siteFilter = input.value; load(); }
      if (input.matches('[data-site-toggle]')) updateSiteOptionFields(input);
      const editor = input.closest('[data-photo-editor]');
      if (!editor) return;
      if (input.matches('[data-photo-file]')) selectPhoto(editor, input.files[0]);
      if (input.matches('[data-remove-photo]') && input.checked) selectPhoto(editor, null);
      if (input.matches('[data-remove-photo], [data-photo-link]')) updatePhotoPreview(editor);
    });
    document.addEventListener('input', (event) => {
      if (event.target.id !== 'siteSearch') return;
      const value = event.target.value.trim().toLowerCase();
      const sites = state.data.sites.filter((site) => (site.name + ' ' + site.slug + ' ' + site.type).toLowerCase().includes(value));
      document.querySelector('#searchResults').innerHTML = sites.length ? siteCards(sites) : '<div class="panel empty"><h3>Ничего не найдено</h3><p>Попробуйте другой запрос.</p></div>';
    });
    window.addEventListener('popstate', () => { state.showAccount = false; state.mobileNav = false; state.feedbackQuery.page = 1; load(); });
    await load();
  } catch (error) {
    notice('Не удалось открыть панель', error.message);
  }
}

start();
