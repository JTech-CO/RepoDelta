/* Small ZIP writer using Node built-ins. UTF-8 names, deflate, standard CRC-32. */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';
const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const table = Array.from({length:256}, (_,n) => { let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; return c>>>0; });
const crc32 = data => { let c=0xffffffff; for(const b of data)c=table[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; };
async function walk(dir) { const paths=[]; for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())paths.push(...await walk(p));else paths.push(p);}return paths.sort(); }
const directory=join(root,'dist'), parts=[], entries=[]; let offset=0;
for(const path of await walk(directory)) {
  const name=Buffer.from(relative(directory,path).replaceAll('\\','/')); const raw=await readFile(path), data=deflateRawSync(raw,{level:9});
  const crc=crc32(raw), h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(0x5821,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(name.length,26);
  parts.push(h,name,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(0x5821,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);entries.push(c,name);offset+=h.length+name.length+data.length;
}
const center=Buffer.concat(entries), end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length/2,8);end.writeUInt16LE(entries.length/2,10);end.writeUInt32LE(center.length,12);end.writeUInt32LE(offset,16);
await mkdir(join(root,'releases'),{recursive:true});
const filename=`RepoDelta-v${pkg.version}-chrome.zip`;await writeFile(join(root,'releases',filename),Buffer.concat([...parts,center,end]));
console.log(`Packaged releases/${filename} (manifest.json is at the ZIP root).`);
