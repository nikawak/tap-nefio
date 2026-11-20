import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/worker.js';
import { readAssets } from './assets.mjs';
import { seedDemo } from './demo.mjs';

const folder = new URL('../.data/', import.meta.url);
mkdirSync(folder, { recursive: true });
const db = new DatabaseSync(process.env.TAP_TEST_MEMORY === '1' ? ':memory:' : new URL('demo.sqlite', folder));
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sites'").get()) {
  db.exec('BEGIN');
  try {
    db.exec(readFileSync(new URL('../drizzle/0000_initial.sql', import.meta.url), 'utf8'));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
seedDemo(db);

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
    const response = await createApp(readAssets()).fetch(request, { DB: { prepare: statement }, DEMO_MODE: true });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && incoming.method !== 'HEAD') Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
