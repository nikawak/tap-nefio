import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/worker.js';
import { readAssets } from './assets.mjs';
import { seedDemo } from './demo.mjs';
import { databaseBinding, nodeServer, openDatabase, photoBucket } from './node-runtime.mjs';

const folder = new URL('../.data/', import.meta.url);
const photosFolder = new URL('menu-photos/', folder);
const memoryOnly = process.env.TAP_TEST_MEMORY === '1';
mkdirSync(folder, { recursive: true });
if (!memoryOnly) mkdirSync(photosFolder, { recursive: true });
const db = openDatabase(memoryOnly ? ':memory:' : new URL('demo.sqlite', folder), { legacyDemo: true });
seedDemo(db);

const env = {
  DB: databaseBinding(db), BUCKET: photoBucket(memoryOnly ? null : fileURLToPath(photosFolder)),
  DEMO_MODE: true, TIP_ENCRYPTION_KEY: process.env.TIP_ENCRYPTION_KEY,
};
const port = Number(process.env.PORT || 4173);
nodeServer(() => createApp(readAssets()), env, (request) => 'http://' + request.headers.host)
  .listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
