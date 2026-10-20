import {setTimeout as wait} from 'node:timers/promises';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {readFile} from 'node:fs/promises';import {eq} from 'drizzle-orm';
import {openPostgres} from '../db/postgres.js';import {createStudio} from '../db/studio-store.js';import {createSharedPresence} from '../db/shared-presence.js';import {createRemote} from '../remote.js';import {user,session} from '../db/schema.js';
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.startsWith('/studio_qa'))throw new Error('Use a disposable studio_qa* PostgreSQL database');
const ca=process.env.TEST_DATABASE_CA_FILE?await readFile(process.env.TEST_DATABASE_CA_FILE,'utf8'):undefined;
const options={ssl:{rejectUnauthorized:true as const,...(ca?{ca}:{})},migrate:true};
test('PostgreSQL shared presence survives instance recreation and aggregates tabs, expiry, logout and revocation',async()=>{
  const a=await openPostgres(url,options),b=await openPostgres(url,options);let clock=Date.now();
  try{
    const ids=[randomUUID(),randomUUID()];await a.db.insert(user).values(ids.map(id=>({id,name:id,email:`${id}@shared.test`})));
    const actors=ids.map(userId=>({userId,sessionId:randomUUID(),expiresAt:new Date(clock+86400000)}));
    await a.db.insert(session).values(actors.map(p=>({id:p.sessionId,userId:p.userId,token:randomUUID(),expiresAt:p.expiresAt})));
    const s=createStudio(a),space=await s.createWorkspace(ids[0],'공유 접속 DB 검증',randomUUID());const invite=await s.issueInvite(ids[0],space.id,'viewer',space.revision);await s.joinWorkspace(ids[1],invite.code);
    const before=await s.snapshot(ids[0],space.id),tabs=[randomUUID(),randomUUID(),randomUUID()];
    const pa=createSharedPresence(a,()=>clock),pb=createSharedPresence(b,()=>clock);
    await pa.touch(actors[0],space.id,tabs[0]);let view=await pb.touch(actors[1],space.id,tabs[2]);assert.equal(view.members.filter(p=>p.online).length,2);const version=view.version;
    assert.equal((await pb.touch(actors[0],space.id,tabs[1])).version,version);
    await pa.leave(actors[0],space.id,tabs[0]);assert.equal((await pb.touch(actors[1],space.id,tabs[2])).version,version);
    const fresh=createSharedPresence(b,()=>clock);assert.equal((await fresh.touch(actors[1],space.id,tabs[2])).members.filter(p=>p.online).length,2);
    await pb.leave(actors[0],space.id,tabs[1]);view=await pa.touch(actors[1],space.id,tabs[2]);assert.equal(view.members.find(p=>p.userId===ids[0])?.online,false);
    await assert.rejects(()=>pb.touch(actors[0],space.id,tabs[0]),{code:'PRESENCE_CLOSED'});
    clock+=75000;view=await pb.touch(actors[1],space.id,tabs[2]);assert.deepEqual(view.events.slice(-2).map(e=>e.kind),['left','joined']);assert.equal(view.events.at(-2)?.reason,'timeout');
    await a.db.delete(session).where(eq(session.id,actors[1].sessionId));await pa.leaveSession(actors[1].sessionId);
    view=await pa.touch(actors[0],space.id,randomUUID());assert.equal(view.events.some(e=>e.userId===ids[1]&&e.reason==='logout'&&e.kind==='left'),true);
    await assert.rejects(()=>pb.touch(actors[1],space.id,randomUUID()),{status:401});
    const after=await s.snapshot(ids[0],space.id);assert.equal(after.workspace.revision,before.workspace.revision);assert.equal(after.cursor,before.cursor);
    const renewed={...actors[1],sessionId:randomUUID()};await a.db.insert(session).values({id:renewed.sessionId,userId:renewed.userId,token:randomUUID(),expiresAt:renewed.expiresAt});await pb.touch(renewed,space.id,randomUUID());
    await s.updateMember(ids[0],space.id,ids[1],null,after.workspace.revision);view=await pa.touch(actors[0],space.id,randomUUID());assert.equal(view.members.length,1);assert.equal(view.events.at(-1)?.reason,'revoked');
    await assert.rejects(()=>pb.touch(renewed,space.id,randomUUID()),{status:404});
    for(let i=0;i<15;i++){clock+=75001;const tab=randomUUID();await pa.touch(actors[0],space.id,tab);await pa.leave(actors[0],space.id,tab);}
    view=await pb.touch(actors[0],space.id,randomUUID());assert.equal(view.events.length,20);assert.ok(!JSON.stringify(view).includes(actors[0].sessionId));
  }finally{await a.close();await b.close();}
});
test('two independent serverless HTTP instances share Secure sessions, sync state and a complete Fake AI answer',async()=>{
  const migration=await openPostgres(url,options);await migration.close();
  const config={origin:'https://studio.example.test',port:4180,secret:randomBytes(48).toString('base64url'),dataDir:'',fakeDelayMs:1,deployment:'vercel' as const,databaseUrl:url,databaseCa:ca};
  const a=await createRemote(config),b=await createRemote(config);
  try{
    const call=(app:typeof a.app,path:string,cookie?:string,body?:unknown,key?:string)=>app.request(config.origin+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),origin:config.origin,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const register=async(app:typeof a.app)=>{const r=await call(app,'/api/auth/sign-up/email',undefined,{name:'원격 QA',email:`${randomUUID()}@http.test`,password:'Remote-synthetic-password-4627'});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie')??'',/Secure/);return r.headers.get('set-cookie')!.split(';')[0];};
    const owner=await register(a.app),peer=await register(b.app);assert.equal((await call(b.app,'/api/me',owner)).status,200);
    const me=await(await call(a.app,'/api/me',owner)).json();assert.equal(me.client.pollMs,2500);assert.equal(me.client.hiddenPollMs,30000);
    const space=await(await call(a.app,'/api/workspaces',owner,{name:'서버리스 HTTP 검증'},randomUUID())).json();
    const base=`/api/workspaces/${space.id}`;
    const invite=await(await call(a.app,base+'/invites',owner,{role:'viewer',version:space.revision})).json();assert.equal((await call(b.app,'/api/workspaces/join',peer,{code:invite.code})).status,200);
    const oa=randomUUID(),pb=randomUUID();await call(a.app,base+'/sync',owner,{after:0,clientId:oa});let result=await(await call(b.app,base+'/sync',peer,{after:0,clientId:pb})).json();assert.equal(result.presence.members.filter((p:{online:boolean})=>p.online).length,2);
    assert.equal((await call(b.app,base+'/runs',peer,{prompt:'서버리스 개발 계획',agentId:'jun',approvalRequired:false,scenario:'normal'},randomUUID())).status,403);
    const started=await call(a.app,base+'/runs',owner,{prompt:'서버리스 개발 계획',agentId:'jun',approvalRequired:false,scenario:'normal'},randomUUID());assert.equal(started.status,201);
    await call(a.app,base+'/sync',owner,{after:0,clientId:oa});
    for(let i=0;i<100;i++){await wait(30);result=await(await call(b.app,base+'/sync',peer,{after:0,clientId:pb})).json();if(result.snapshot.runs[0].status==='succeeded')break;}
    assert.equal(result.snapshot.runs[0].status,'succeeded');const same=await(await call(a.app,base+'/snapshot',owner)).json();assert.deepEqual(same.runs,result.snapshot.runs);
    const source=same.runs[0];
    const handoff=await(await call(a.app,base+'/runs',owner,{prompt:'사용자 관점 기획 계획으로 바꿔줘',agentId:'nara',approvalRequired:false,scenario:'normal',sourceRunId:source.id,mode:'handoff'},randomUUID())).json();
    assert.equal(handoff.status,'awaiting_approval');assert.ok(!('generatedAnswer' in handoff));
    assert.equal((await call(b.app,'/api/runs/'+handoff.id+'/approval',owner,{version:handoff.version,approved:true})).status,200);
    let followed:any;
    for(let i=0;i<100;i++){await wait(30);followed=await(await call((i%2?a:b).app,base+'/snapshot',owner)).json();if(followed.runs.find((r:any)=>r.id===handoff.id)?.status==='succeeded')break;}
    const handoffResult=followed.runs.find((r:any)=>r.id===handoff.id);
    assert.equal(handoffResult.status,'succeeded');assert.equal(handoffResult.source.runId,source.id);assert.match(handoffResult.output,/인계받은 요구사항/);
    const team=await call(a.app,base+'/runs',owner,{prompt:'5명이 2주 안에 무료로 로그인 개발 계획을 작성해 줘.',agentId:'nara',team:true,approvalRequired:false,scenario:'normal'},randomUUID());assert.equal(team.status,201);
    const teamRun=await team.json();assert.ok(!('generatedAnswer' in teamRun));
    let teamView:any;
    for(let i=0;i<100;i++){await wait(30);teamView=await(await call((i%2?a:b).app,base+'/snapshot',owner)).json();if(teamView.runs[0].status==='succeeded')break;}
    assert.equal(teamView.runs[0].status,'succeeded');assert.equal(teamView.runs[0].team,true);assert.equal(teamView.runs[0].answerMeta.team.members.length,5);assert.match(teamView.runs[0].output,/민 · QA/);assert.match(teamView.runs[0].output,/레오 · 정리/);
    const guest=await call(a.app,'/api/auth/sign-in/guest',undefined,{});
    assert.equal(guest.status,200);assert.match(guest.headers.get('set-cookie')??'',/Secure/);
    const guestCookie=guest.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await call(b.app,'/api/me',guestCookie)).status,200);
    assert.equal((await call(b.app,base+'/snapshot',guestCookie)).status,404);
    assert.equal((await call(a.app,base+'/sync',owner,{after:-1,clientId:oa})).status,400);
    await call(b.app,'/api/auth/sign-out',peer,{});result=await(await call(a.app,base+'/sync',owner,{after:0,clientId:oa})).json();assert.equal(result.presence.members.filter((p:{online:boolean})=>p.online).length,1);
    await call(a.app,'/api/auth/sign-out',guestCookie,{});
  }finally{await a.close();await b.close();}
});
