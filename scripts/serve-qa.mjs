/* Local fixture page only. Production extension contains no test hooks. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'||url.pathname.startsWith('/qa/repo/')?'/qa/index.html':url.pathname));if(!path.startsWith(root+sep))throw Error();const s=await stat(path);if(!s.isFile())throw Error();res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}}).listen(5198,'127.0.0.1',()=>console.log('Local QA fixture: http://127.0.0.1:5198/qa/index.html'));
