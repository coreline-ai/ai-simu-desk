import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {getConfig} from '../config.js';
import {openDatabase} from '../db/database.js';
import {createRuntime} from '../runtime.js';
test('local PostgreSQL selection is independent of hosting and common runtime is request-driven',async()=>{
 const config=getConfig({BETTER_AUTH_SECRET:randomBytes(40).toString('hex'),DATABASE_URL:'postgresql://qa@localhost/studio_qa',DATABASE_SSL:'disable',FAKE_AI_DELAY_MS:'0'});
 assert.equal(config.deployment,'local');assert.ok(config.databaseUrl);assert.equal(config.databaseSsl,false);
 const d=await openDatabase();try{
 const app=createRuntime(d,config);
 assert.equal((await (await app.request(config.origin+'/api/worker-health')).json()).execution,'request-driven');
 const signed=await app.request(config.origin+'/api/auth/sign-in/guest',{method:'POST',headers:{origin:config.origin,'content-type':'application/json'},body:'{}'});
 assert.equal(signed.status,200);const cookie=signed.headers.get('set-cookie')!.split(';')[0];
 const me=await (await app.request(config.origin+'/api/me',{headers:{cookie}})).json();
 const request=await app.request(config.origin+`/api/workspaces/${me.workspace.id}/runs`,{method:'POST',headers:{cookie,origin:config.origin,'content-type':'application/json','idempotency-key':randomBytes(12).toString('hex')},body:JSON.stringify({prompt:'로그인 개발 계획',agentId:'jun',approvalRequired:false,scenario:'normal'})});
 assert.equal(request.status,201);
 const snap=await (await app.request(config.origin+`/api/workspaces/${me.workspace.id}/snapshot`,{headers:{cookie}})).json();
 assert.equal(snap.runs[0].status,'running');
 }finally{await d.close();}
});
