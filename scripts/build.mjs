import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { readAssets } from './assets.mjs';

const fromRoot = (path) => new URL('../' + path, import.meta.url);
const worker = readFileSync(fromRoot('src/worker.js'), 'utf8');
mkdirSync(fromRoot('dist/server/'), { recursive: true });
mkdirSync(fromRoot('dist/.openai/'), { recursive: true });
writeFileSync(fromRoot('dist/server/index.js'), worker + '\nexport default createApp(' + JSON.stringify(readAssets()) + ');\n');
copyFileSync(fromRoot('src/telegram-notifications.js'), fromRoot('dist/server/telegram-notifications.js'));
copyFileSync(fromRoot('.openai/hosting.json'), fromRoot('dist/.openai/hosting.json'));
console.log('Готово: dist/server/index.js');
