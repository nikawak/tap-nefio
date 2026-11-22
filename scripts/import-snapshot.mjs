import { closeSync, openSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDatabase } from './node-runtime.mjs';

const source = process.argv[2];
if (!source || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/import-snapshot.mjs <snapshot-directory>');
}
const folder = resolve(source);
const { tables } = JSON.parse(readFileSync(join(folder, 'database.json'), 'utf8'));
const tableNames = ['sites', 'items', 'site_admins', 'events', 'site_feedback', 'site_tip_settings', 'tip_opens', 'tip_payments'];
if (tables?.admin_profiles !== undefined) tableNames.push('admin_profiles');
if (!tableNames.every((table) => Array.isArray(tables?.[table]))) throw new Error('The snapshot is missing a table.');

const photoKeys = [
  ...tables.sites.flatMap(({ logo_key, cover_key }) => [logo_key, cover_key]),
  ...tables.items.map(({ photo_key }) => photo_key),
].filter(Boolean);
for (const key of new Set(photoKeys)) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(jpg|png|webp)$/.test(key)) {
    throw new Error('The snapshot contains an invalid photo key.');
  }
  if (!statSync(join(folder, 'menu-photos', key), { throwIfNoEntry: false })?.size) {
    throw new Error('Missing photo: ' + key);
  }
}

const filename = join(folder, 'tap.sqlite');
closeSync(openSync(filename, 'wx', 0o600));
let db;
try {
  db = openDatabase(filename);
  db.exec('BEGIN IMMEDIATE');
  for (const table of tableNames) {
    const allowedColumns = new Set(db.prepare('PRAGMA table_info(' + table + ')').all().map(({ name }) => name));
    for (const row of tables[table]) {
      const columns = Object.keys(row);
      if (!columns.length || columns.some((name) => !allowedColumns.has(name))) {
        throw new Error('The snapshot contains an incompatible row in ' + table + '.');
      }
      const placeholders = columns.map(() => '?').join(', ');
      db.prepare('INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' + placeholders + ')')
        .run(...columns.map((name) => row[name]));
    }
  }
  if (db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') throw new Error('Database integrity check failed.');
  db.exec('COMMIT');
} catch (error) {
  db?.close();
  unlinkSync(filename);
  throw error;
}
db.close();
console.log('Imported ' + tableNames.map((table) => table + ': ' + tables[table].length).join(', '));
