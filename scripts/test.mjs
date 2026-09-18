import { readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const files=(await readdir(join(root,'tests'))).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>join(root,'tests',f));
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'});
process.exit(result.status??1);
