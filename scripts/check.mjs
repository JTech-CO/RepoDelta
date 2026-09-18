import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
export async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path)); else out.push(path);
  }
  return out;
}
let count = 0;
for (const file of [...await walk(join(root, 'src')), ...await walk(join(root, 'public')), ...await walk(join(root, 'scripts'))]) {
  if (/\.m?js$/.test(file)) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status !== 0) { console.error(check.stderr); process.exit(1); }
    count++;
  }
  if (file.endsWith('.json')) JSON.parse(await readFile(file, 'utf8'));
}
const manifest = JSON.parse(await readFile(join(root,'public/manifest.json'),'utf8'));
const pkg = JSON.parse(await readFile(join(root,'package.json'),'utf8'));
if (manifest.version !== pkg.version) throw new Error('Version mismatch');
if (JSON.stringify(manifest.permissions) !== '["storage"]') throw new Error('Unexpected permission');
console.log(`Syntax and JSON checks passed (${count} JavaScript files).`);
