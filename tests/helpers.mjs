import '../src/shared/core.js';
import '../src/shared/i18n.js';
import '../src/background/store.js';
import '../src/background/github.js';
import '../src/background/service.js';
export const R = globalThis.RepoDelta;
export const A='a'.repeat(40), B='b'.repeat(40), C='c'.repeat(40), D='d'.repeat(40);
export const ref={owner:'octo',repo:'demo'};
export const meta={id:42,ref,defaultBranch:'main',private:false,archived:false};
export const cp=(overrides={})=>({ref,repoId:42,branch:'main',sha:A,markedAt:'2026-09-16T09:00:00.000Z',revision:crypto.randomUUID(),...overrides});
export function area(){
  let data={};let accessLevel=null;
  return { get accessLevel(){return accessLevel;}, async setAccessLevel(v){accessLevel=v.accessLevel;}, async get(keys){if(keys===null||keys===undefined)return structuredClone(data);if(typeof keys==='string')keys=[keys];const o={};for(const k of keys)if(Object.hasOwn(data,k))o[k]=structuredClone(data[k]);return o;},async set(items){for(const [k,v]of Object.entries(items))data[k]=structuredClone(v);},async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])delete data[k];},async clear(){data={};} };
}
export function storage(){return {local:area(),session:area()};}
export async function setup({baseline=null,head=B,repository=meta,comparison=null,compareError=null,now=Date.now}={}){
  const st=storage(), store=new R.Store(st,now);await store.ready;
  if(baseline)await store.mutateCheckpoints(records=>{records[R.repoKey(ref)]=baseline;});
  const calls=[];
  const diff=comparison||{status:'ahead',aheadBy:2,behindBy:0,totalCommits:2,mergeBase:A,commits:[{sha:C,message:'Change 1',author:'octo',date:'2026-09-16T10:00:00Z'},{sha:B,message:'Change 2',author:'octo',date:'2026-09-16T11:00:00Z'}],files:[{filename:'src/main.js',previousFilename:'',status:'modified',additions:7,deletions:2}],filesMayBeTruncated:false};
  const api={cancel(){},async get(path,kind,force){calls.push({path,kind,force});if(kind==='repo')return{data:structuredClone(repository),at:now(),cached:false};if(kind==='head')return{data:head?[{sha:head}]:[],at:now(),cached:false};if(compareError)throw compareError;return{data:structuredClone(diff),at:now(),cached:false};}};
  return{store,st,api,calls,service:new R.DeltaService(store,api,now)};
}
export const apiRepo = {id:42,name:'demo',owner:{login:'octo'},default_branch:'main',private:false};
export const apiCommit = (sha=B)=>({sha,commit:{message:'Change\n\nDetails',author:{name:'Author',email:'secret@example.com',date:'2026-09-16T10:00:00Z'},committer:{date:'2026-09-16T10:00:00Z'}},author:{login:'octo'}});
export const apiDiff = (overrides={})=>({status:'ahead',ahead_by:2,behind_by:0,total_commits:2,merge_base_commit:{sha:A},commits:[apiCommit(C),apiCommit(B)],files:[{filename:'src/main.js',status:'modified',additions:7,deletions:2,patch:'PRIVATE SOURCE PATCH',raw_url:'https://evil.invalid/'}],...overrides});
