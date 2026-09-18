/* Prevent stale PNGs from silently shipping after the source SVG is changed. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const projectRoot = resolve(import.meta.dirname, '..');
const digest = value => createHash('sha256').update(value).digest('hex');
export async function verifyIcons(root = projectRoot) {
  const lock = JSON.parse(await readFile(join(root, 'scripts/icon-assets.json'), 'utf8'));
  const fail = detail => { throw new Error(`Icon assets out of sync: ${detail}. Run python scripts/generate-icons.py after changing public/icons/logo.svg.`); };
  if (lock.schema !== 1 || lock.source !== 'public/icons/logo.svg') fail('invalid generation manifest');
  if (JSON.stringify(lock.sizes) !== '[16,32,48,128]') fail('incorrect size set');
  if (digest(await readFile(join(root, lock.source))) !== lock.sourceSha256) fail('source SVG changed');
  for (const size of lock.sizes) {
    for (const suffix of ['png', 'ico']) {
      const path = `public/icons/${size}.${suffix}`;
      const bytes = await readFile(join(root, path));
      if (digest(bytes) !== lock.files[path]) fail(path);
      if (suffix === 'png' && (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size)) fail(`PNG dimensions: ${path}`);
    }
  }
  const manifest = JSON.parse(await readFile(join(root, 'public/manifest.json'), 'utf8'));
  for (const field of [manifest.icons, manifest.action.default_icon]) {
    for (const size of lock.sizes) if (field?.[size] !== `icons/${size}.png`) fail('manifest PNG mapping');
  }
  return lock;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyIcons(); console.log('Canonical SVG, 8 raster assets and manifest icon references verified.');
}
