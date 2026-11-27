import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const types = {
  'index.html': 'text/html; charset=utf-8',
  'about.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8',
  'menu-template.json': 'application/json; charset=utf-8',
  'service-template.json': 'application/json; charset=utf-8',
  'moka.jpg': 'image/jpeg',
  'coffe1/cover.jpg': 'image/jpeg',
  'coffe1/logo.png': 'image/png',
};

export function readAssets() {
  const assets = Object.fromEntries(Object.entries(types).map(([name, type]) => {
    const file = readFileSync(new URL('../public/' + name, import.meta.url));
    return [name, type.startsWith('image/') ? { type, base64: file.toString('base64') } : { type, text: file.toString('utf8') }];
  }));
  for (const name of ['app.js', 'styles.css']) {
    const version = createHash('sha256').update(assets[name].text).digest('hex').slice(0, 12);
    const path = '/assets/' + name;
    for (const page of ['index.html', 'about.html']) {
      assets[page].text = assets[page].text.replace(path, path + '?v=' + version);
    }
  }
  return assets;
}
