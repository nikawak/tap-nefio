import { todayOffset } from '../src/worker.js';

const sites = [
  ['moka', 'moka-coffee', 'Moka Coffee', 'Кофейня', 'Спешелти-кофе, теплая выпечка и место для своих.', 'coffee', '/assets/moka.jpg', 'live', 'https://www.google.com/maps/search/Moka+Coffee/', 'https://t.me/telegram', 'https://www.instagram.com/', '', 'moka-demo', '2026-01-03'],
  ['basil', 'basilico', 'Basilico', 'Ресторан', 'Итальянская кухня, которую хочется разделить.', 'garden', '', 'live', 'https://www.google.com/maps/search/Basilico/', '', 'https://www.instagram.com/', '', 'basilico-demo', '2026-01-02'],
  ['forma', 'forma-studio', 'Forma Studio', 'Студия красоты', 'Забота о себе в спокойном ритме.', 'lavender', '', 'draft', '', '', '', '', 'forma-demo', '2026-01-01'],
];

const items = [
  ['moka', 'Капучино', 'Кофе', 'Двойной эспрессо и взбитое молоко · 200 мл', 850],
  ['moka', 'Флэт уайт', 'Кофе', 'Насыщенный кофе с тонким слоем молочной пены · 180 мл', 950],
  ['moka', 'Фильтр-кофе', 'Кофе', 'Зерно дня · 250 мл', 700],
  ['moka', 'Матча латте', 'Напитки', 'Японская матча с молоком · 250 мл', 1100],
  ['moka', 'Круассан', 'Выпечка', 'Сливочное масло и хрустящие слои', 650],
  ['moka', 'Банановый хлеб', 'Выпечка', 'С грецким орехом и корицей', 750],
  ['basil', 'Маргарита', 'Пицца', 'Томаты, моцарелла, свежий базилик', 2300],
  ['basil', 'Буррата', 'Закуски', 'С томатами и оливковым маслом', 2700],
  ['basil', 'Тирамису', 'Десерты', 'Маскарпоне, эспрессо, савоярди', 1250],
  ['forma', 'Стрижка и укладка', 'Услуги', 'Подбор формы, уход и укладка', 6800],
];

export function seedDemo(db) {
  if (db.prepare('SELECT COUNT(*) AS count FROM sites').get().count) return;
  const addSite = db.prepare('INSERT INTO sites (id,slug,name,type,description,theme,cover_url,status,maps_url,telegram_url,instagram_url,vk_url,nfc_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const addItem = db.prepare('INSERT INTO items (id,site_id,name,category,description,price,created_at) VALUES (?,?,?,?,?,?,?)');
  const event = db.prepare('INSERT INTO events (site_id,day,kind,source,count) VALUES (?,?,?,?,?)');
  db.exec('BEGIN');
  try {
    for (const site of sites) addSite.run(...site);
    for (const [index, item] of items.entries()) {
      addItem.run('demo-item-' + index, ...item, new Date(1767268800000 + index * 1000).toISOString());
    }
    db.prepare('INSERT INTO site_admins (site_id,email) VALUES (?,?)').run('moka', 'manager@demo.tap');
    const nfc = [116, 159, 133, 193, 161, 247, 239];
    const direct = [47, 69, 63, 82, 72, 122, 139];
    const menus = [65, 83, 75, 111, 96, 155, 161];
    const maps = [17, 25, 20, 33, 30, 45, 48];
    for (let offset = -29; offset <= 0; offset++) {
      const i = (offset + 34) % 7;
      const scale = offset >= -6 ? 1 : offset >= -13 ? 0.84 : 0.57 + ((offset + 32) % 4) * 0.045;
      const day = todayOffset(offset);
      for (const [id, share] of [['moka', 0.65], ['basil', 0.35]]) {
        for (const [kind, source, value] of [
          ['visit', 'nfc', nfc[i]], ['visit', 'direct', direct[i]], ['menu', 'direct', menus[i]],
          ['maps', 'direct', maps[i]], ['instagram', 'direct', 11 + i * 2],
          ...(id === 'moka' ? [['telegram', 'direct', 7 + i * 2]] : []),
        ]) event.run(id, day, kind, source, Math.round(value * scale * share));
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
