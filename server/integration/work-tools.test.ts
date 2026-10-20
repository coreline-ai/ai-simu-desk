import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {like} from 'drizzle-orm';
import {openPostgres} from '../db/postgres.js';
import {createRemote} from '../remote.js';
import {createStudio} from '../db/studio-store.js';
import {user,session} from '../db/schema.js';
import {GUEST_PREFIX} from '../adapters/guest-auth.js';
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.startsWith('/studio_qa')||!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))throw Error('Use local disposable studio_qa PostgreSQL only');
const ca=process.env.TEST_DATABASE_CA_FILE?await readFile(process.env.TEST_DATABASE_CA_FILE,'utf8'):undefined;
const ssl={rejectUnauthorized:true as const,...(ca?{ca}:{})};
test('real PostgreSQL across two instances: settings race, comments/inbox and atomic five guest capacity',async()=>{
 const a=await openPostgres(url,{ssl,migrate:true}),b=await openPostgres(url,{ssl});
 const config={origin:'https://studio.example.test',port:4180,secret:randomBytes(48).toString('base64url'),dataDir:'',fakeDelayMs:0,deployment:'vercel' as const,databaseUrl:url,databaseCa:ca};
 const ha=await createRemote(config),hb=await createRemote(config);
 try{
 const ids=[randomUUID(),randomUUID()];await a.db.insert(user).values(ids.map(id=>({id,name:'Tools QA',email:id+'@tools.test'})));
 const sa=createStudio(a),sb=createStudio(b),w=await sa.createWorkspace(ids[0],'Tools PG',randomUUID());
 const settings={version:0,goal:'로컬 무료 개발',audience:'팀원',technology:'PostgreSQL',exclusions:'외부 DB'};
 const changes=await Promise.allSettled([sa.saveProject(ids[0],w.id,settings),sb.saveProject(ids[0],w.id,settings)]);assert.equal(changes.filter(r=>r.status==='fulfilled').length,1);assert.equal((await sb.project(ids[0],w.id)).version,1);
 let snap=await sa.snapshot(ids[0],w.id);const invite=await sa.issueInvite(ids[0],w.id,'member',snap.workspace.revision);await sb.joinWorkspace(ids[1],invite.code);
 const run=await sa.startRun(ids[0],w.id,{prompt:'공동 개발 계획',agentId:'jun',approvalRequired:true,scenario:'normal'},randomUUID());
 await sb.addComment(ids[1],w.id,run.id,{body:'무료 환경 검증'},'pg-comments-key');assert.equal((await sa.comments(ids[0],w.id,run.id)).items[0].body,'무료 환경 검증');assert.equal((await sa.inbox(ids[0],w.id)).unread,2);
 assert.equal((await sb.findRuns(ids[1],w.id,{q:'개발'})).items[0].output,'');
 // Only disposable QA guest sessions are cleared before the cap stress test.
 await a.db.delete(session).where(like(session.userId,GUEST_PREFIX+'%'));
 const testIp='2001:db8:'+randomBytes(12).toString('hex').match(/.{4}/g)!.join(':');
 const request=(app:typeof ha.app,path:string,cookie?:string)=>app.request(config.origin+path,{method:'POST',headers:{origin:config.origin,'content-type':'application/json','x-vercel-forwarded-for':testIp,...(cookie?{cookie}:{})},body:'{}'});
 const attempts=await Promise.all(Array.from({length:6},(_,i)=>request((i%2?ha:hb).app,'/api/auth/sign-in/guest')));
 const successes=attempts.filter(r=>r.status===200);assert.equal(successes.length,5);assert.equal(attempts.filter(r=>r.status===429).length,1);assert.equal((await attempts.find(r=>r.status===429)!.json()).code,'GUEST_FULL');
 const cookie=successes[0].headers.get('set-cookie')!.split(';')[0];assert.equal((await hb.app.request(config.origin+'/api/me',{headers:{cookie}})).status,200);
 await request(hb.app,'/api/auth/sign-out',cookie);assert.equal((await request(ha.app,'/api/auth/sign-in/guest')).status,200);
 }finally{await a.db.delete(session).where(like(session.userId,GUEST_PREFIX+'%'));await ha.close();await hb.close();await a.close();await b.close();}
});
