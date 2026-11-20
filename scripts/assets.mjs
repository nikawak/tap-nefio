import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const types = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8',
  'moka.jpg': 'image/jpeg',
};

export function readAssets() {
  const assets = Object.fromEntries(Object.entries(types).map(([name, type]) => {
    const file = readFileSync(new URL('../public/' + name, import.meta.url));
    return [name, name.endsWith('.jpg') ? { type, base64: file.toString('base64') } : { type, text: file.toString('utf8') }];
  }));
  for (const name of ['app.js', 'styles.css']) {
    const version = createHash('sha256').update(assets[name].text).digest('hex').slice(0, 12);
    const path = '/assets/' + name;
    assets['index.html'].text = assets['index.html'].text.replace(path, path + '?v=' + version);
  }
  return assets;
}
