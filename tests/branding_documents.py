"""Offline Chromium checks of actual public/dist documents and icon bytes.
No deployed GitHub Pages, live GitHub or Web Store assertions.
"""
import json, os
from pathlib import Path
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'qa-results'; SHOTS=ROOT/'docs/screenshots'
checks=[]; failures=[]
def ok(value,name):
    if not value: raise AssertionError(name)
    checks.append(name)
def serve(route):
    path=(ROOT/unquote(urlsplit(route.request.url).path).lstrip('/')).resolve()
    if not any(path.is_relative_to(ROOT/d) for d in ('public','dist')) or not path.is_file():
        failures.append(route.request.url);route.fulfill(status=404,body='Not found');return
    mime={'.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}.get(path.suffix,'application/octet-stream')
    route.fulfill(status=200,content_type=mime,body=path.read_bytes(),headers={'Access-Control-Allow-Origin':'*'})
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':960})
    context.route('http://127.0.0.1:5198/**',serve)
    page=context.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    for directory in ('public','dist'):
        for filename in ('privacy-policy.html','help.html'):
            for theme,width in (('light',1280),('dark',390)):
                page.emulate_media(color_scheme=theme);page.set_viewport_size({'width':width,'height':960})
                html=(ROOT/directory/filename).read_text().replace('<head>',f'<head><base href="http://127.0.0.1:5198/{directory}/">',1)
                page.set_content(html,wait_until='networkidle')
                img=page.locator('.document-brand img');img.evaluate('(e)=>e.decode()')
                label=f'{directory}/{filename} {theme} {width}px'
                ok(img.evaluate('e=>e.complete && e.naturalWidth===412 && e.naturalHeight===412'),label+' logo loads')
                ok(img.evaluate('e=>e.getBoundingClientRect().width===36 && e.getBoundingClientRect().height===36'),label+' logo dimensions')
                ok(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label+' no horizontal overflow')
                icon=page.locator('link[rel=icon]').get_attribute('href')
                ok(icon=='icons/32.png?v=1.0.4',label+' versioned favicon')
                ok(page.evaluate('async href=>{const img=new Image();img.src=new URL(href,document.baseURI);await img.decode();return img.naturalWidth===32}',icon),label+' favicon PNG decodes')
                if directory=='public': page.screenshot(path=str(SHOTS/f"{filename.removesuffix('.html')}-{theme}.png"))
    page.set_content('<html><body></body></html>')
    for size in (16,32,48,128):
        for suffix in ('png','ico'):
            url=f'http://127.0.0.1:5198/dist/icons/{size}.{suffix}'
            ok(page.evaluate('async([url,s])=>{const e=new Image();e.src=url;await e.decode();return e.naturalWidth===s && e.naturalHeight===s}',[url,size]),f'{size}.{suffix} native decoder dimensions')
    ok(not failures,'All local document assets resolved');ok(not errors,'No page errors')
    report={'mode':'Offline document and asset renderer, actual public/dist bytes','browser':browser.version,'passed':len(checks),'checks':checks,'pageErrors':errors,'missingAssets':failures}
    (OUT/'branding-documents.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':len(checks),'pageErrors':errors,'missingAssets':failures}));context.close();browser.close()
