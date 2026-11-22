import { execFileSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, renameSync, rmdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';

const data = import.meta.dirname;
const home = dirname(data);
const app = join(data, 'app');
const releases = join(data, 'releases');
const pm2 = '/usr/lib/ispnodejs/bin/pm2';
const site = 'nefio.site';
const pm2Env = { ...process.env, PM2_HOME: join(home, '.pm2'), PATH: `${dirname(process.execPath)}:${process.env.PATH}` };
const limit = 24 * 1024 * 1024;
const revisionPattern = /^[a-f0-9]{40}$/;

function runPm2(command) {
  return execFileSync(pm2, [command, site], { encoding: 'utf8', env: pm2Env, timeout: 20000 });
}

function pid() {
  const matches = runPm2('pid').trim().split(/\r?\n/).filter((line) => /^[1-9]\d*$/.test(line.trim()));
  if (matches.length !== 1) throw new Error('Expected one running Tap process.');
  return matches[0].trim();
}

async function waitForApp() {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:10043/api/session', { signal: AbortSignal.timeout(1000) });
      const session = await response.json();
      if (response.ok && session.selfHosted && session.googleAvailable) return;
    } catch {
      // The server may still be starting.
    }
    await delay(500);
  }
  throw new Error('Tap did not pass its health check.');
}

async function stageRelease(revision, stage) {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > limit) throw new Error('Compressed release is too large.');
    chunks.push(chunk);
  }
  const packageData = JSON.parse(gunzipSync(Buffer.concat(chunks), { maxOutputLength: limit }));
  if (packageData.revision !== revision || !Array.isArray(packageData.files)) throw new Error('Invalid release archive.');

  const paths = new Set();
  for (const [path, content] of packageData.files) {
    const valid = path === 'package.json' || /^(src|public|drizzle|scripts)\/[a-zA-Z0-9_./-]+$/.test(path);
    if (!valid || path.split('/').some((part) => !part || part === '.' || part === '..') || paths.has(path)) {
      throw new Error('Invalid or repeated release path.');
    }
    paths.add(path);
    const target = join(stage, path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, Buffer.from(content, 'base64'), { flag: 'wx', mode: 0o600 });
  }
  for (const path of ['package.json', 'scripts/server.mjs', 'src/worker.js']) {
    if (!paths.has(path)) throw new Error(`Release is missing ${path}.`);
  }
}

function backupDatabase(stage) {
  const database = new DatabaseSync(join(data, 'tap.sqlite'), { readOnly: true });
  const snapshot = join(stage, 'snapshot.sqlite');
  try {
    database.exec('PRAGMA busy_timeout = 5000');
    database.prepare('VACUUM INTO ?').run(snapshot);
    renameSync(snapshot, join(data, 'before-release.sqlite'));
  } finally {
    database.close();
  }
}

function pointApp(target, stage) {
  const link = join(stage, 'next-app');
  symlinkSync(target, link, 'dir');
  renameSync(link, app);
}

async function publish(revision) {
  mkdirSync(releases, { recursive: true, mode: 0o700 });
  const lock = join(data, 'deploy.lock');
  mkdirSync(lock, { mode: 0o700 });
  let stage;
  try {
    stage = mkdtempSync(join(releases, '.incoming-'));
    const source = join(stage, 'source');
    await stageRelease(revision, source);
    const original = lstatSync(app);
    const legacy = join(releases, 'before-github');
    const previous = original.isSymbolicLink() ? resolve(data, readlinkSync(app)) : legacy;
    if (original.isSymbolicLink() && dirname(previous) !== releases) throw new Error('Unexpected current release path.');
    const target = join(releases, revision);
    if (previous === target) return await waitForApp();

    const previousPid = pid();
    await waitForApp();
    backupDatabase(stage);
    if (!existsSync(target)) renameSync(source, target);
    if (original.isDirectory() && !existsSync(legacy)) renameSync(app, legacy);
    try {
      pointApp(target, stage);
    } catch (error) {
      if (original.isDirectory() && !existsSync(app)) renameSync(legacy, app);
      throw error;
    }
    try {
      runPm2('restart');
      if (pid() === previousPid) throw new Error('The previous Tap process is still running.');
      await waitForApp();
    } catch (error) {
      pointApp(previous, stage);
      runPm2('restart');
      await waitForApp();
      throw error;
    }
    console.log(`Published ${revision} on ${site}.`);
  } finally {
    if (stage) rmSync(stage, { recursive: true, force: true });
    rmdirSync(lock);
  }
}

const command = process.env.SSH_ORIGINAL_COMMAND ?? '';
if (command === 'check') {
  pid();
  await waitForApp();
  console.log('The Tap publisher can reach the managed app.');
} else {
  const [verb, revision, ...extra] = command.split(' ');
  if (verb !== 'publish' || !revisionPattern.test(revision ?? '') || extra.length) throw new Error('Unsupported deployment command.');
  await publish(revision);
}
