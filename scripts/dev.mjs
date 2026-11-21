import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/worker.js';
import { readAssets } from './assets.mjs';
import { seedDemo } from './demo.mjs';

const folder = new URL('../.data/', import.meta.url);
const photosFolder = new URL('menu-photos/', folder);
const memoryOnly = process.env.TAP_TEST_MEMORY === '1';
mkdirSync(folder, { recursive: true });
if (!memoryOnly) mkdirSync(photosFolder, { recursive: true });
const db = new DatabaseSync(memoryOnly ? ':memory:' : new URL('demo.sqlite', folder));
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (tag TEXT PRIMARY KEY)');
const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
const hasMigration = db.prepare('SELECT 1 FROM local_migrations WHERE tag=?');
const recordMigration = db.prepare('INSERT INTO local_migrations (tag) VALUES (?)');
for (const { tag } of journal.entries) {
  if (hasMigration.get(tag)) continue;
  db.exec('BEGIN');
  try {
    const legacyDemo = tag === '0000_initial' &&
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sites'").get();
    if (!legacyDemo) db.exec(readFileSync(new URL('../drizzle/' + tag + '.sql', import.meta.url), 'utf8'));
    recordMigration.run(tag);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
seedDemo(db);

const memoryPhotos = memoryOnly ? new Map() : null;
const photoPath = (key) => new URL(key, photosFolder);
const bucket = {
  async put(key, bytes) {
    if (memoryPhotos) memoryPhotos.set(key, bytes);
    else await writeFile(photoPath(key), bytes);
  },
  async get(key) {
    const body = memoryPhotos ? memoryPhotos.get(key) : await readFile(photoPath(key)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    return body ? { body, size: body.byteLength } : null;
  },
  async head(key) { return this.get(key); },
  async delete(key) {
    if (memoryPhotos) memoryPhotos.delete(key);
    else await unlink(photoPath(key)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  },
};

function statement(sql, params = []) {
  return {
    bind: (...bound) => statement(sql, bound),
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => ({ meta: db.prepare(sql).run(...params) }),
  };
}

const port = Number(process.env.PORT || 4173);
const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = 'http://' + incoming.headers.host;
    const request = new Request(origin + incoming.url, {
      method: incoming.method,
      headers: incoming.headers,
      ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
    });
    const response = await createApp(readAssets()).fetch(request, {
      DB: { prepare: statement }, BUCKET: bucket, DEMO_MODE: true, TIP_ENCRYPTION_KEY: process.env.TIP_ENCRYPTION_KEY,
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && incoming.method !== 'HEAD') Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
