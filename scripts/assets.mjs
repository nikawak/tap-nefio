import { readFileSync } from 'node:fs';

const types = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8',
  'moka.jpg': 'image/jpeg',
};

export function readAssets() {
  return Object.fromEntries(Object.entries(types).map(([name, type]) => {
    const file = readFileSync(new URL('../public/' + name, import.meta.url));
    return [name, name.endsWith('.jpg') ? { type, base64: file.toString('base64') } : { type, text: file.toString('utf8') }];
  }));
}
