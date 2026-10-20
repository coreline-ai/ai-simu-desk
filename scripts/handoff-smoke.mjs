// Exercises the running local product using existing synthetic QA accounts only.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createHandoffTracker,publicHandoff} from '../product/src/team-handoff.mjs';
const origin='http://127.0.0.1:4180',accounts=JSON.parse(await readFile('.data/qa-credentials.json','utf8'));
async function call(path,cookie,body){const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),'idempotency-key':randomUUID()},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok)throw new Error(`Local handoff QA ${path}: HTTP ${response.status}`);return response;}
async function login(account){const r=await call('/api/auth/sign-in/email',null,{email:account.email,password:account.password});return r.headers.get('set-cookie').split(';')[0];}
const owner=await login(accounts.primary),viewer=await login(accounts.secondary);assert.notEqual(owner,viewer);
const space=await(await call('/api/workspaces',owner,{name:'업무 인계 로컬 QA'})).json(),base=`/api/workspaces/${space.id}`;
const invite=await(await call(base+'/invites',owner,{role:'viewer',version:space.revision})).json();await call('/api/workspaces/join',viewer,{code:invite.code});
const start=async(extra={})=>(await call(base+'/runs',owner,{prompt:'5명이 2주 안에 무료 도구로 첫 화면 개선 계획을 만들어 줘.',agentId:'nara',team:true,scenario:'normal',approvalRequired:false,...extra})).json();
const snapshot=async(cookie)=>(await call(base+'/snapshot',cookie)).json();
async function follow(id,{cancel=false}={}){const tracker=createHandoffTracker(),events=[];let lastLength=0;
 for(let i=0;i<250;i++){
  const a=(await snapshot(owner)).runs.find(r=>r.id===id),b=(await snapshot(viewer)).runs.find(r=>r.id===id);
  assert.ok(a&&b);assert.deepEqual(a.answerMeta.team,b.answerMeta.team);assert.ok(a.output.startsWith(b.output)||b.output.startsWith(a.output));assert.ok(a.output.length>=lastLength);lastLength=a.output.length;
  const event=tracker.observe(space.id,a);if(event)events.push([event.from,event.to]);
  if(cancel&&event){await call(`/api/runs/${id}/cancel`,owner,{});cancel=false;}
  if(['succeeded','failed','cancelled'].includes(a.status)){assert.equal(tracker.observe(space.id,a),null);return {status:a.status,events,publicCard:!!publicHandoff(a),outputLength:a.output.length};}
  await new Promise(resolve=>setTimeout(resolve,180));
 }throw new Error('Local handoff run did not terminate');
}
const pending=await start({approvalRequired:true}),pendingView=(await snapshot(viewer)).runs.find(r=>r.id===pending.id);assert.equal(pendingView.output,'');assert.equal(publicHandoff(pendingView),null);
await call(`/api/runs/${pending.id}/approval`,owner,{version:pending.version,approved:true});
const normal=await follow(pending.id);assert.equal(normal.status,'succeeded');assert.deepEqual(normal.events,[['nara','sora'],['sora','jun'],['jun','min'],['min','leo']]);
const stopped=await start(),cancelled=await follow(stopped.id,{cancel:true});assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.publicCard,false);
const failedRun=await start({scenario:'failure'}),failed=await follow(failedRun.id);assert.equal(failed.status,'failed');assert.equal(failed.publicCard,false);
const retry=await(await call(`/api/runs/${failedRun.id}/retry`,owner,{})).json(),retried=await follow(retry.id);assert.equal(retried.status,'succeeded');assert.notEqual(retry.id,failedRun.id);
const report={independentAuthenticatedSessions:true,sharedMetadataAndOutputPrefixesMatch:true,approvalHidesOutput:true,normal,cancelled,failed,retried};
await mkdir('product/evidence/team-handoff',{recursive:true});await writeFile('product/evidence/team-handoff/http-qa.json',JSON.stringify(report,null,2)+'\n');await writeFile('.data/team-handoff-space.txt',space.id);console.log('Local two-session handoff QA passed: four handoffs, approval, cancel, failure/retry; no credentials in report.');
