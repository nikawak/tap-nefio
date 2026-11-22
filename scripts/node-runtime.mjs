import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(path, { legacyDemo = false } = {}) {
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    db.exec('CREATE TABLE IF NOT EXISTS local_migrations (tag TEXT PRIMARY KEY)');
    const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
    const hasMigration = db.prepare('SELECT 1 FROM local_migrations WHERE tag=?');
    const recordMigration = db.prepare('INSERT INTO local_migrations (tag) VALUES (?)');
    for (const { tag } of journal.entries) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!hasMigration.get(tag)) {
          const existingDemo = legacyDemo && tag === '0000_initial' &&
            db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sites'").get();
          if (!existingDemo) db.exec(readFileSync(new URL('../drizzle/' + tag + '.sql', import.meta.url), 'utf8'));
          recordMigration.run(tag);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function databaseBinding(db) {
  const writes = new WeakMap();
  function statement(sql, params = []) {
    const run = () => ({ meta: db.prepare(sql).run(...params) });
    const bound = {
      bind: (...bound) => statement(sql, bound),
      all: async () => ({ results: db.prepare(sql).all(...params) }),
      first: async () => db.prepare(sql).get(...params) ?? null,
      run: async () => run(),
    };
    writes.set(bound, run);
    return bound;
  }
  return {
    prepare: statement,
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement) => writes.get(statement)());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export function photoBucket(folder) {
  const memory = folder ? null : new Map();
  function ignoreMissing(action) {
    try {
      return action();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return null;
    }
  }
  return {
    async put(key, bytes) {
      if (memory) memory.set(key, bytes);
      else writeFileSync(join(folder, key), bytes);
    },
    async get(key) {
      const body = memory ? memory.get(key) : ignoreMissing(() => readFileSync(join(folder, key)));
      return body ? { body, size: body.byteLength } : null;
    },
    async head(key) { return this.get(key); },
    async delete(key) {
      if (memory) memory.delete(key);
      else ignoreMissing(() => unlinkSync(join(folder, key)));
    },
  };
}

export function nodeServer(makeApp, env, originFor) {
  return createServer(async (incoming, outgoing) => {
    try {
      if (!incoming.url?.startsWith('/')) {
        outgoing.writeHead(400).end();
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const noBody = ['GET', 'HEAD'].includes(incoming.method);
      const request = new Request(originFor(incoming) + incoming.url, {
        method: incoming.method,
        headers,
        ...(noBody ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
      });
      const response = await makeApp().fetch(request, env);
      const outbound = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outbound['set-cookie'] = cookies;
      outgoing.writeHead(response.status, outbound);
      if (response.body && incoming.method !== 'HEAD') await pipeline(Readable.fromWeb(response.body), outgoing);
      else outgoing.end();
    } catch (error) {
      if (outgoing.destroyed) return;
      console.error(error);
      if (outgoing.headersSent) outgoing.destroy();
      else outgoing.writeHead(500).end();
    }
  });
}
