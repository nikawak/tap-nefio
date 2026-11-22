import { readFile, writeFile } from 'node:fs/promises';

const [source, output] = process.argv.slice(2);
const htmlLimit = 5 * 1024 * 1024;
const asArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const hasType = (node, name) => asArray(node['@type']).some((type) =>
  type === name || type === 'https://schema.org/' + name || type === 'http://schema.org/' + name);
const trim = (value) => typeof value === 'string' ? value.trim() : '';

async function readSource(input) {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return readFile(input, 'utf8');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Укажите публичный HTTPS-адрес меню.');
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Страница вернула HTTP ' + response.status + '.');
  if (!response.body) throw new Error('Страница вернула пустой ответ.');
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = '';
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > htmlLimit) throw new Error('Страница больше 5 МБ. Сохраните меню в локальный HTML или JSON-LD.');
    result += decoder.decode(chunk, { stream: true });
  }
  return result + decoder.decode();
}

function readDocuments(text) {
  if (/^\s*[{\[]/.test(text)) return [JSON.parse(text)];
  const documents = [];
  for (const match of text.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)) {
    const script = match[0];
    const end = script.indexOf('>');
    if (!/\stype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json(?:\s|$))/i.test(script.slice(0, end))) continue;
    try { documents.push(JSON.parse(script.slice(end + 1, script.lastIndexOf('<')))); }
    catch { console.error('Пропущен блок с некорректным JSON-LD.'); }
  }
  return documents;
}

function menuFromDocuments(documents) {
  const nodes = [];
  function collect(node) {
    if (!node || typeof node !== 'object') return;
    if (!Array.isArray(node)) nodes.push(node);
    for (const [key, value] of Object.entries(node)) if (key !== '@context') collect(value);
  }
  collect(documents);
  const byId = new Map(nodes.filter((node) => node['@id'] && Object.keys(node).length > 1)
    .map((node) => [node['@id'], node]));
  const dereference = (node) => byId.get(node?.['@id']) ?? node;
  const items = [];
  const currencies = new Set();
  const visited = new Set();
  let skipped = 0;

  function visit(raw, category = 'Меню') {
    const node = dereference(raw);
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    if (hasType(node, 'MenuSection')) category = trim(node.name) || category;
    if (hasType(node, 'MenuItem')) {
      const name = trim(node.name);
      const description = trim(node.description);
      const prices = new Map();
      for (const rawOffer of asArray(node.offers)) {
        const offer = dereference(rawOffer);
        const price = String(offer?.price ?? '').trim().replace(',', '.');
        if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(price)) continue;
        const currency = trim(offer.priceCurrency).toUpperCase();
        prices.set(Number(price) + ':' + currency, { price, currency });
      }
      if (!name || name.length > 100 || category.length > 55 || description.length > 300 || prices.size !== 1) {
        skipped += 1;
        return;
      }
      const { price, currency } = prices.values().next().value;
      if (currency) currencies.add(currency);
      items.push({ name, category, ...(description ? { description } : {}), price });
      return;
    }
    for (const child of [...asArray(node.hasMenuSection), ...asArray(node.hasMenuItem)]) visit(child, category);
  }

  for (const type of ['Menu', 'MenuSection', 'MenuItem']) {
    for (const node of nodes) if (hasType(node, type)) visit(node);
  }
  if (!items.length) throw new Error('Не удалось найти позиции с ценами в JSON-LD Schema.org MenuItem.');
  if (items.length > 500) throw new Error('Найдено больше 500 позиций. Разделите исходное меню на несколько файлов.');
  if (currencies.size > 1) throw new Error('В исходном меню несколько валют. Подготовьте файл с одной валютой.');
  if (skipped) console.error('Пропущено позиций без однозначной цены или с неподходящими полями: ' + skipped + '.');
  const [currency] = currencies;
  return { ...(currency ? { currency } : {}), items };
}

try {
  if (!source || !output) throw new Error('Запуск: node scripts/parse-menu.mjs <HTTPS-адрес или HTML/JSON-LD> <menu.json>');
  const text = await readSource(source);
  if (Buffer.byteLength(text) > htmlLimit) throw new Error('Исходный файл больше 5 МБ.');
  const menu = menuFromDocuments(readDocuments(text));
  const result = JSON.stringify(menu, null, 2);
  if (Buffer.byteLength(result) > 512 * 1024) throw new Error('Файл импорта больше 512 КБ. Разделите исходное меню.');
  await writeFile(output, result + '\n', { flag: 'wx' });
  console.log('Сохранено позиций: ' + menu.items.length + '. Файл: ' + output);
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Файл ' + output + ' уже существует. Укажите другое имя.' : error.message);
  process.exitCode = 1;
}
