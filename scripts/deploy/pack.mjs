import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const output = process.argv[2];
if (!output) throw new Error('Specify the release archive path.');

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const paths = execFileSync('git', ['ls-files', '-z', '--', 'package.json', 'src', 'public', 'drizzle', 'scripts'], { encoding: 'utf8' })
  .split('\0')
  .filter((path) => path && !path.startsWith('scripts/deploy/'));
const files = paths.map((path) => {
  if (!lstatSync(path).isFile()) throw new Error(`Expected a regular file: ${path}`);
  return [path, readFileSync(path).toString('base64')];
});

writeFileSync(output, gzipSync(JSON.stringify({ revision, files })));
