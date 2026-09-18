/* DEVELOPMENT ONLY. Never packaged. Simulates Chrome APIs and GitHub responses.
   Local/session persistence here is an adapter, not a real MV3 storage test. */
(() => {
 'use strict';
 const R=globalThis.RepoDelta,listeners=[],id='repodelta-qa-runtime',originalParser=R.parseRepoUrl;
 const offline=location.protocol==='about:';let virtualRef={owner:'octo',repo:'demo'};
 const localStore=(()=>{try{localStorage.getItem('rd.qa.probe');return localStorage;}catch{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}})();
 if(!crypto.randomUUID)crypto.randomUUID=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');};
 R.parseRepoUrl=url=>{if(offline&&url===location.href)return globalThis.__RD_QA_MODE==='repo'?{...virtualRef}:null;try{const u=new URL(url);if(u.origin===location.origin&&u.pathname.startsWith('/qa/repo/'))return originalParser('https://github.com/'+u.pathname.slice(9));if(u.origin===location.origin&&u.pathname==='/qa/index.html')return{owner:'octo',repo:'demo'};}catch{}return originalParser(url);};
 const area=name=>({async setAccessLevel(){},async get(keys){const data=JSON.parse(localStore.getItem(`rd.qa.${name}`)||'{}');if(keys==null)return data;if(typeof keys==='string')keys=[keys];return Object.fromEntries(keys.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));},async set(items){const data=JSON.parse(localStore.getItem(`rd.qa.${name}`)||'{}');Object.assign(data,structuredClone(items));localStore.setItem(`rd.qa.${name}`,JSON.stringify(data));},async remove(keys){const data=JSON.parse(localStore.getItem(`rd.qa.${name}`)||'{}');for(const key of Array.isArray(keys)?keys:[keys])delete data[key];localStore.setItem(`rd.qa.${name}`,JSON.stringify(data));},async clear(){localStore.removeItem(`rd.qa.${name}`);}});
 const A='a'.repeat(40),channel=offline?{postMessage(){}}:new BroadcastChannel('rd.qa.messages');
 const state=()=>({head:A,branch:'main',repoId:42,total:3,fileCount:7,relation:'ahead',error:0,compareError:0,...JSON.parse(localStore.getItem('rd.qa.api')||'{}')});
 const samples=[
 {filename:'src/background/service.js',status:'modified',additions:42,deletions:11},
 {filename:'src/shared/checkpoint.js',status:'added',additions:86,deletions:0},
 {filename:'src/content/panel.js',status:'modified',additions:28,deletions:9},
 {filename:'src/shared/types.js',previous_filename:'src/types.js',status:'renamed',additions:3,deletions:1},
 {filename:'tests/checkpoint.test.js',status:'added',additions:64,deletions:0},
 {filename:'docs/README.md',status:'modified',additions:17,deletions:5},
 {filename:'src/legacy-check.js',status:'removed',additions:0,deletions:23}];
 const calls=[];
 async function fetcher(url,init){
  calls.push({url,method:init.method,credentials:init.credentials});const s=state(),u=new URL(url),parts=u.pathname.split('/'),repo=parts[3]||'demo',owner=parts[2]||'octo';
  const error=s.error||(u.pathname.includes('/compare/')?s.compareError:0);if(error)return new Response(JSON.stringify({message:error===429?'API rate limit exceeded':'Fixture error'}),{status:error,headers:error===429?{'retry-after':'60'}:{}});
  let json;
  if(u.pathname.includes('/commits'))json=s.empty?[]:[{sha:s.head,commit:{message:'Checked head',author:{name:'octo',date:'2026-09-16T11:40:00Z'},committer:{date:'2026-09-16T11:40:00Z'}},author:{login:'octo'}}];
  else if(u.pathname.includes('/compare/')){
   const page=Number(u.searchParams.get('page')||1),count=s.total,titles=['Fix checkpoint updates during cross-tab review','Add explicit branch-change safeguards','Document session-only token storage'];
   const commits=Array.from({length:count},(_,i)=>({sha:i===count-1?s.head:(1000+i).toString(16).padStart(40,'0'),commit:{message:titles[i]||`Improve regression coverage ${i+1}`,author:{name:'octo',date:`2026-09-16T${String(8+i%4).padStart(2,'0')}:20:00Z`}},author:{login:'octo'}})).slice((page-1)*100,page*100);
   const files=Array.from({length:Math.min(300,s.fileCount)},(_,i)=>i<samples.length?samples[i]:{filename:`src/modules/feature-${i}.js`,status:'modified',additions:3,deletions:1});
   if(s.xss)files[0]={filename:'<img src=x onerror=alert(1)>.js',status:'added',additions:1,deletions:0};
   json={status:s.relation,ahead_by:count,behind_by:s.relation==='ahead'?0:2,total_commits:count,merge_base_commit:{sha:s.relation==='ahead'?A:'c'.repeat(40)},commits,...(page===1?{files}:{})};
  }else json={id:s.repoId,name:repo,owner:{login:owner},default_branch:s.branch,private:Boolean(s.private)};
  return new Response(JSON.stringify(json),{status:200,headers:{'x-ratelimit-remaining':'59','x-ratelimit-limit':'60','x-ratelimit-reset':String(Math.floor(Date.now()/1000)+3600)}});
 }
 globalThis.chrome={storage:{local:area('local'),session:area('mockSession')},runtime:{id,getURL:path=>new URL('/dist/'+path,offline?'http://127.0.0.1:5198':location.origin).href,openOptionsPage:async()=>{window.open('/qa/options.html','_blank');},onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async message=>{
  await service.store.ready;const ref=R.parseRepoUrl(location.href)||{owner:'octo',repo:'demo'},trusted=globalThis.__RD_QA_MODE==='options'||globalThis.__RD_QA_MODE==='popup'||/\/(options|popup)\.html$/.test(location.pathname),sender={id,url:trusted?`chrome-extension://${id}/options.html`:R.repoUrl(ref),...(trusted?{}:{tab:{id:1},frameId:0})};
  try{const data=await R.dispatch(message,sender,service,id,chrome.runtime.openOptionsPage);const type=message.type==='SET_TOKEN'?'AUTH_INVALIDATED':['SET_SETTINGS','SET_LANGUAGE'].includes(message.type)?'SETTINGS_CHANGED':['MARK','UNTRACK','IMPORT','CLEAR_CHECKPOINTS'].includes(message.type)?'CHECKPOINTS_CHANGED':null;if(type)setTimeout(()=>broadcast({namespace:'RepoDelta',type,ref:message.ref}),0);return{ok:true,data};}catch(error){return{ok:false,error:R.publicError(error)};}
 }},tabs:{query:async()=>[{id:1,url:'https://github.com/octo/demo'}],sendMessage:async()=>({opened:false})}};
 const store=new R.Store(chrome.storage),api=new R.GitHubClient(store,fetcher),service=new R.DeltaService(store,api);
 function receive(message){for(const fn of listeners)fn(message,{id},()=>{});}function broadcast(message){receive(message);channel.postMessage(message);}channel.onmessage=event=>receive(event.data);
 globalThis.QA={async ready(){await store.ready;},get calls(){return calls;},get state(){return state();},store,service,receive,
 async set(value){localStore.setItem('rd.qa.api',JSON.stringify({...state(),...value}));await store.clearCache();await chrome.storage.session.set({'rd.rate':{}});},
 navigate(owner,repo){if(offline)virtualRef={owner,repo};else history.pushState({},'',`/qa/repo/${owner}/${repo}`);document.querySelector('meta[name="octolytics-dimension-repository_nwo"]').content=`${owner}/${repo}`;document.querySelector('.name').textContent=`${owner} / ${repo}`;window.dispatchEvent(new Event('popstate'));},
 dark(value=true){document.documentElement.dataset.colorMode=value?'dark':'light';},
 async seed(sha=A){const ref=R.parseRepoUrl(location.href)||{owner:'octo',repo:'demo'};await store.mutateCheckpoints(records=>{records[R.repoKey(ref)]={ref,repoId:42,branch:'main',sha,markedAt:'2026-09-15T12:10:00Z',revision:crypto.randomUUID()};});}
 };
 const ref=R.parseRepoUrl(location.href);if(ref){const meta=document.querySelector('meta[name="octolytics-dimension-repository_nwo"]');if(meta)meta.content=`${ref.owner}/${ref.repo}`;const name=document.querySelector('.name');if(name)name.textContent=`${ref.owner} / ${ref.repo}`;}
})();
