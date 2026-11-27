import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const types = {
  'index.html': 'text/html; charset=utf-8',
  'about.html': 'text/html; charset=utf-8',
  'about.css': 'text/css; charset=utf-8',
  'about-nfc.jpg': 'image/jpeg',
  'calculator.html': 'text/html; charset=utf-8',
  'calculator.css': 'text/css; charset=utf-8',
  'calculator.js': 'text/javascript; charset=utf-8',
  'order-pricing.js': 'text/javascript; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'icons.svg': 'image/svg+xml',
  'styles.css': 'text/css; charset=utf-8',
  'menu-template.json': 'application/json; charset=utf-8',
  'service-template.json': 'application/json; charset=utf-8',
  'moka.jpg': 'image/jpeg',
  'coffe1/cover.jpg': 'image/jpeg',
  'coffe1/logo.png': 'image/png',
  'barbershop/cover.jpg': 'image/jpeg',
};

export function readAssets() {
  const assets = Object.fromEntries(Object.entries(types).map(([name, type]) => {
    const file = readFileSync(new URL('../public/' + name, import.meta.url));
    return [name, type.startsWith('image/') ? { type, base64: file.toString('base64') } : { type, text: file.toString('utf8') }];
  }));
  const iconsVersion = createHash('sha256').update(assets['icons.svg'].base64, 'base64').digest('hex').slice(0, 12);
  for (const page of ['app.js', 'about.html', 'calculator.html']) {
    assets[page].text = assets[page].text.replaceAll('/assets/icons.svg#', `/assets/icons.svg?v=${iconsVersion}#`);
  }
  const version = (name) => createHash('sha256').update(assets[name].text).digest('hex').slice(0, 12);
  assets['calculator.js'].text = assets['calculator.js'].text.replace('./order-pricing.js', './order-pricing.js?v=' + version('order-pricing.js'));
  for (const name of ['app.js', 'styles.css', 'about.css', 'calculator.css', 'calculator.js']) {
    const path = '/assets/' + name;
    const versionedPath = path + '?v=' + version(name);
    for (const page of ['index.html', 'about.html', 'calculator.html']) {
      assets[page].text = assets[page].text.replace(path, versionedPath);
    }
  }
  return assets;
}
