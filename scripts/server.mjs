import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../src/worker.js';
import { readAssets } from './assets.mjs';
import { databaseBinding, nodeServer, openDatabase, photoBucket } from './node-runtime.mjs';

const { TAP_PUBLIC_ORIGIN, TAP_DATA_DIR, OWNER_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TIP_ENCRYPTION_KEY } = process.env;
if (!TAP_PUBLIC_ORIGIN?.trim() || !TAP_DATA_DIR?.trim()) {
  throw new Error('Set TAP_PUBLIC_ORIGIN and TAP_DATA_DIR.');
}
const googleConfigured = GOOGLE_CLIENT_ID?.trim() || GOOGLE_CLIENT_SECRET?.trim();
if (googleConfigured && ![OWNER_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET].every((value) => value?.trim())) {
  throw new Error('Google sign-in requires OWNER_EMAIL, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
}
const publicUrl = new URL(TAP_PUBLIC_ORIGIN);
if (publicUrl.protocol !== 'https:' || publicUrl.href !== publicUrl.origin + '/') {
  throw new Error('TAP_PUBLIC_ORIGIN must be an HTTPS origin without a path.');
}

const folder = resolve(TAP_DATA_DIR);
const photos = resolve(folder, 'menu-photos');
mkdirSync(photos, { recursive: true, mode: 0o700 });
const db = openDatabase(resolve(folder, 'tap.sqlite'));
db.exec('PRAGMA journal_mode=WAL;');
const env = {
  DB: databaseBinding(db), BUCKET: photoBucket(photos), SELF_HOSTED: true,
  OWNER_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TIP_ENCRYPTION_KEY,
};
const app = createApp(readAssets());
const port = Number(process.env.PORT || 4173);
nodeServer(() => app, env, () => publicUrl.origin)
  .listen(port, '127.0.0.1', () => console.log('Tap: http://127.0.0.1:' + port));
