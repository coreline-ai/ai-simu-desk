import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import{eq}from'drizzle-orm';
import{openDatabase}from'../db/database.js';import{createStudio}from'../db/studio-store.js';import{recoverGuestOwner}from'../db/guest-space-recovery.js';
import{user,session,workspaces,members,approvals}from'../db/schema.js';
import{createRuntime}from'../runtime.js';import{getConfig}from'../config.js';
test('new guests join regular-owned spaces; legacy guest owner expiry becomes preserved read-only and cancels waiting work once',async()=>{
 const d=await openDatabase();try{
  const guest='simu-desk-guest-'+randomUUID();await d.db.insert(user).values([{id:guest,name:'Guest',email:'g@ownership.test'},{id:'regular',name:'Regular',email:'r@ownership.test'},{id:'viewer',name:'Viewer',email:'v@ownership.test'}]);
  const s=createStudio(d);await assert.rejects(()=>s.createWorkspace(guest,'new space',randomUUID()),{code:'GUEST_OWNER_FORBIDDEN'});
  const normal=await s.createWorkspace('regular','regular shared',randomUUID()),invite=await s.issueInvite('regular',normal.id,'member',normal.revision);await s.joinWorkspace(guest,invite.code);
  assert.equal((await s.snapshot(guest,normal.id)).role,'member');
  const id=randomUUID();await d.db.insert(workspaces).values({id,ownerId:guest,kind:'shared',name:'legacy'});await d.db.insert(members).values([{workspaceId:id,userId:guest,role:'owner'},{workspaceId:id,userId:'regular',role:'member'},{workspaceId:id,userId:'viewer',role:'viewer'}]);
  await d.db.insert(session).values({id:'guest-live',userId:guest,token:randomUUID(),expiresAt:new Date(Date.now()+60_000)});
  const run=await s.startRun(guest,id,{prompt:'preserve request',agentId:'nara',scenario:'normal',approvalRequired:true},randomUUID());
  assert.equal((await s.snapshot('regular',id)).runs[0].status,'awaiting_approval','tab absence alone must not close the space');
  await d.db.update(session).set({expiresAt:new Date(0)}).where(eq(session.id,'guest-live'));
  const closed=await s.snapshot('regular',id);assert.equal(closed.role,'viewer');assert(closed.workspace.readOnlyReason);assert.equal(closed.runs[0].status,'cancelled');
  assert.equal((await d.db.select().from(approvals).where(eq(approvals.runId,run.id)))[0].status,'declined');
  assert.equal((await s.snapshot('regular',id)).cursor,closed.cursor,'cleanup is idempotent');
  await assert.rejects(()=>s.startRun('regular',id,{prompt:'new request',agentId:'jun',scenario:'normal',approvalRequired:false},randomUUID()),{status:403});
  await assert.rejects(()=>s.saveProject('regular',id,{version:0,goal:'change',audience:'',technology:'',exclusions:''}),{status:403});
  await assert.rejects(()=>recoverGuestOwner(d,id,'viewer',1));await assert.rejects(()=>recoverGuestOwner(d,id,'regular',999),{status:409});
  await recoverGuestOwner(d,id,'regular',closed.workspace.revision);assert.equal((await s.snapshot('regular',id)).role,'owner');assert.equal((await s.snapshot(guest,id)).role,'viewer');
  assert.equal((await s.snapshot('regular',id)).runs[0].id,run.id,'records preserved');
  assert.equal((await s.startRun('regular',id,{prompt:'next work',agentId:'jun',scenario:'normal',approvalRequired:false},randomUUID())).status,'queued');
 }finally{await d.close();}
});
test('five independent authenticated guests collaborate in a regular-owned space; sixth guest is rejected',async()=>{
 const d=await openDatabase();try{
  const config=getConfig({BETTER_AUTH_SECRET:randomUUID()+randomUUID()}),app=createRuntime(d,config);
  const call=(path:string,cookie?:string,body?:object,key?:string)=>app.request(config.origin+path,{method:body?'POST':'GET',headers:{origin:config.origin,'content-type':'application/json',...(cookie?{cookie}:{}),...(key?{'idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const owner=await call('/api/auth/sign-up/email',undefined,{name:'Owner',email:'owner@five.test',password:'test-password-123456'});assert.equal(owner.status,200);const ownerCookie=owner.headers.get('set-cookie')!.split(';')[0];
  const space=await(await call('/api/workspaces',ownerCookie,{name:'Five guests'},randomUUID())).json();
  const guests=await Promise.all(Array.from({length:5},()=>call('/api/auth/sign-in/guest',undefined,{})));assert(guests.every(r=>r.status===200));assert.equal((await call('/api/auth/sign-in/guest',undefined,{})).status,429);
  const cookies=guests.map(r=>r.headers.get('set-cookie')!.split(';')[0]);
  for(const cookie of cookies){const snap=await(await call(`/api/workspaces/${space.id}/snapshot`,ownerCookie)).json();const invite=await(await call(`/api/workspaces/${space.id}/invites`,ownerCookie,{role:'member',version:snap.workspace.revision})).json();assert.equal((await call('/api/workspaces/join',cookie,{code:invite.code})).status,200);}
  const started=await call(`/api/workspaces/${space.id}/runs`,cookies[0],{prompt:'5명이 함께 검토할 계획',agentId:'nara',scenario:'normal',approvalRequired:true,team:true},randomUUID());assert.equal(started.status,201);const run=await started.json();
  for(const cookie of cookies){const snap=await(await call(`/api/workspaces/${space.id}/snapshot`,cookie)).json();assert.equal(snap.runs[0].id,run.id);assert.equal(snap.role,'member');assert.equal(snap.members.length,6);assert.equal((await call(`/api/runs/${run.id}/approval`,cookie,{version:run.version,approved:true})).status,403);}
  assert.equal((await call(`/api/runs/${run.id}/approval`,ownerCookie,{version:run.version,approved:true})).status,200);
 }finally{await d.close();}
});
test('expired legacy guest work cannot be claimed or revived by the preserved worker path',async()=>{
 const d=await openDatabase();try{
  const guest='simu-desk-guest-'+randomUUID();await d.db.insert(user).values({id:guest,name:'Old guest',email:'old-worker@qa.test'});await d.db.insert(session).values({id:'old-session',userId:guest,token:randomUUID(),expiresAt:new Date(Date.now()+60000)});
  const id=randomUUID();await d.db.insert(workspaces).values({id,ownerId:guest,kind:'shared',name:'old worker space'});await d.db.insert(members).values({workspaceId:id,userId:guest,role:'owner'});const s=createStudio(d),run=await s.startRun(guest,id,{prompt:'old queued work',agentId:'jun',scenario:'normal',approvalRequired:false},randomUUID());
  await d.db.delete(session).where(eq(session.id,'old-session'));assert.equal(await s.claim(),null);assert.equal(await s.getStatus(run.id),'cancelled');assert.equal(await s.progress(run.id,'late output'),false);assert.equal((await s.finish(run.id,'succeeded'))?.status,'cancelled');
 }finally{await d.close();}
});
test('even an empty expired guest space emits one durable sync event so member UI learns it is read-only',async()=>{
 const d=await openDatabase();try{const guest='simu-desk-guest-'+randomUUID();await d.db.insert(user).values([{id:guest,name:'Old',email:'empty-old@qa.test'},{id:'reader',name:'Reader',email:'empty-reader@qa.test'}]);const id=randomUUID();await d.db.insert(workspaces).values({id,ownerId:guest,kind:'shared',name:'empty legacy'});await d.db.insert(members).values([{workspaceId:id,userId:guest,role:'owner'},{workspaceId:id,userId:'reader',role:'member'}]);const s=createStudio(d),first=await s.events('reader',id,0);assert(first.events.some(e=>e.kind==='guest_space_expired'));assert.equal((await s.snapshot('reader',id)).role,'viewer');assert.equal((await s.events('reader',id,first.cursor)).events.length,0);}finally{await d.close();}
});
