import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyIcons } from '../scripts/verify-icons.mjs';
const root = resolve(import.meta.dirname, '..');
const text = path => readFile(join(root, path), 'utf8');
test('brand: all generated raster hashes and dimensions match the canonical SVG', async () => {
  assert.equal(Object.keys((await verifyIcons()).files).length, 8);
});
test('brand: a changed SVG blocks builds until derived images are regenerated', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'repodelta-brand-'));
  try {
    await mkdir(join(temp,'scripts')); await cp(join(root,'scripts/icon-assets.json'),join(temp,'scripts/icon-assets.json'));
    await cp(join(root,'public'),join(temp,'public'),{recursive:true});
    await writeFile(join(temp,'public/icons/logo.svg'), (await text('public/icons/logo.svg'))+' ');
    await assert.rejects(verifyIcons(temp), /source SVG changed/);
  } finally { await rm(temp,{recursive:true,force:true}); }
});
test('brand: a changed raster blocks builds even when the source SVG is unchanged', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'repodelta-brand-'));
  try {
    await mkdir(join(temp,'scripts')); await cp(join(root,'scripts/icon-assets.json'),join(temp,'scripts/icon-assets.json'));
    await cp(join(root,'public'),join(temp,'public'),{recursive:true});
    await writeFile(join(temp,'public/icons/16.png'), 'not an icon');
    await assert.rejects(verifyIcons(temp), /16.png/);
  } finally { await rm(temp,{recursive:true,force:true}); }
});
test('brand: native manifest icons stay PNG and only logo.svg is web-accessible to GitHub', async () => {
  const m = JSON.parse(await text('public/manifest.json'));
  assert.deepEqual(m.web_accessible_resources,[{resources:['icons/logo.svg'],matches:['https://github.com/*']}]);
  assert.deepEqual(m.permissions,['storage']);
  assert.deepEqual(m.host_permissions,['https://github.com/*','https://api.github.com/*']);
  for (const v of Object.values(m.icons)) assert.match(v,/\.png$/);
});
test('brand: shared rendering uses a packaged image URL with an empty decorative alt', async () => {
  const s = await text('src/shared/ui.js');
  assert.match(s,/R\.logo =/); assert.match(s,/chrome\.runtime\.getURL\('icons\/logo.svg'\)/);
  assert.match(s,/alt: ''/);
  assert.doesNotMatch(s,/fetch\(/);
});
for (const file of ['src/content/panel.js','src/options/index.js','src/popup/index.js']) {
  test(`brand: ${file} uses the shared logo, not a font-based delta`, async () => {
    const s = await text(file); assert.match(s,/R\.logo\(/); assert.doesNotMatch(s,/\['Δ'\]/);
  });
}
test('brand: header badge preserves its image when the state label changes', async () => {
  const s = await text('src/content/index.js');
  assert.match(s,/R\.logo\('rd-badge-logo', 16\)/);
  assert.match(s,/querySelector\('\.rd-badge-label'\)\.textContent/);
  assert.doesNotMatch(s,/button\.textContent\s*=/);
});
for (const file of ['public/privacy-policy.html','public/help.html']) {
  test(`brand: ${file} has a real logo and a versioned PNG favicon`, async () => {
    const s=await text(file);
    assert.match(s, /class="document-brand"/);assert.match(s,/src="icons\/logo\.svg\?v=1.0.4"/);
    assert.match(s,/href="icons\/32.png\?v=1.0.4"/);
  });
}
test('brand: options and popup documents both declare the new favicon', async () => {
  for(const file of ['public/options.html','public/popup.html']) assert.match(await text(file),/icons\/32.png\?v=1.0.4/);
});
test('brand: the uploaded vector geometry is retained exactly, apart from scaling metadata', async () => {
  const original=await text('docs/brand/uploaded-logo.svg');
  const actual=await text('public/icons/logo.svg');
  assert.equal(actual.replace(' viewBox="0 0 412 412"','').trim(),original.trim());
  assert.doesNotMatch(actual,/<script|<image|<foreignObject|onload=|onerror=/i);
});
