import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {randomUUID,randomBytes} from 'node:crypto';
import {createServer,request} from 'node:https';import {getRequestListener} from '@hono/node-server';import {serveStatic} from '@hono/node-server/serve-static';import {Hono} from 'hono';
import {openPostgres} from '../db/postgres.js';import {createRemote} from '../remote.js';
const url=process.env.TEST_DATABASE_URL,caFile=process.env.TEST_DATABASE_CA_FILE,certFile=process.env.TEST_HTTPS_CERT_FILE,keyFile=process.env.TEST_HTTPS_KEY_FILE;
if(!url||!new URL(url).pathname.startsWith('/studio_qa'))throw new Error('Use a disposable studio_qa* database');
test('real HTTPS network: CA verification, Secure sessions across replicas, shared sync, private routes and distributed login limit',{skip:!caFile||!certFile||!keyFile},async()=>{
  const ca=await readFile(caFile!,'utf8'),cert=await readFile(certFile!,'utf8'),key=await readFile(keyFile!,'utf8');
  const migration=await openPostgres(url,{ssl:{rejectUnauthorized:true,ca},migrate:true});await migration.close();
  const facade=new Hono();let replicas:Awaited<ReturnType<typeof createRemote>>[]=[],turn=0;
  facade.all('/api/*',c=>replicas[turn++%replicas.length].app.fetch(c.req.raw));
  facade.use('/assets/*',serveStatic({root:'./product/dist'}));facade.get('/',serveStatic({path:'./product/dist/index.html'}));
  const server=createServer({key,cert},getRequestListener(facade.fetch));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`https://localhost:${address.port}`;
  const config={origin,port:address.port,secret:randomBytes(48).toString('base64url'),dataDir:'',fakeDelayMs:1,deployment:'vercel' as const,databaseUrl:url,databaseCa:ca};
  const ip=`2001:db8:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}::1`;
  function call(path:string,cookie?:string,body?:unknown,options:{trust?:boolean;origin?:string;key?:string}={}) {
    return new Promise<{status:number;headers:import('node:http').IncomingHttpHeaders;data:any;verified:boolean}>((resolve,reject)=>{
      const r=request(origin+path,{...(options.trust===false?{}:{ca}),method:body===undefined?'GET':'POST',headers:{origin:options.origin??origin,'content-type':'application/json','x-vercel-forwarded-for':ip,connection:'close',...(cookie?{cookie}:{}),...(options.key?{'idempotency-key':options.key}:{})}},response=>{
        let text='';response.setEncoding('utf8');response.on('data',part=>{text+=part;});response.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=text;}resolve({status:response.statusCode!,headers:response.headers,data,verified:(response.socket as import('node:tls').TLSSocket).authorized});});
      });r.on('error',reject);if(body!==undefined)r.write(JSON.stringify(body));r.end();
    });
  }
  try{
    replicas=await Promise.all([createRemote(config),createRemote(config)]);
    await assert.rejects(()=>call('/api/health',undefined,undefined,{trust:false}));
    const health=await call('/api/health');assert.equal(health.status,200);assert.equal(health.verified,true);assert.equal(health.data.database,'postgresql');
    const register=async(name:string)=>{const r=await call('/api/auth/sign-up/email',undefined,{name,email:`${randomUUID()}@tls.test`,password:'TLS-synthetic-password-3721'});assert.equal(r.status,200);const h=r.headers['set-cookie']![0];assert.match(h,/Secure/);assert.match(h,/HttpOnly/);return h.split(';')[0];};
    const owner=await register('TLS Owner'),peer=await register('TLS Peer');assert.equal((await call('/api/me',owner)).status,200);
    const created=await call('/api/workspaces',owner,{name:'HTTPS 공동 공간'},{key:randomUUID()});assert.equal(created.status,201);const space=created.data,base=`/api/workspaces/${space.id}`;
    const invite=await call(base+'/invites',owner,{role:'viewer',version:space.revision});assert.equal((await call('/api/workspaces/join',peer,{code:invite.data.code})).status,200);
    const a=randomUUID(),b=randomUUID();await call(base+'/sync',owner,{after:0,clientId:a});const shared=await call(base+'/sync',peer,{after:0,clientId:b});assert.equal(shared.data.presence.members.filter((p:{online:boolean})=>p.online).length,2);
    assert.equal((await call(base+'/sync',peer,{after:0,clientId:b},{origin:'https://evil.test'})).status,403);
    for(const path of ['/.env.local','/.data/qa-credentials.json','/server/config.ts','/product/evidence/presence/browser-qa.json'])assert.equal((await call(path)).status,404);
    const page=await call('/');assert.equal(page.status,200);assert.match(page.data,/SHARED EDITION/);assert.doesNotMatch(page.data,/LOCAL EDITION/);
    for(let i=0;i<10;i++)assert.equal((await call('/api/auth/sign-in/email',undefined,{email:'nobody@tls.test',password:'Incorrect-password-1111'})).status,401);
    assert.equal((await call('/api/auth/sign-in/email',undefined,{email:'nobody@tls.test',password:'Incorrect-password-1111'})).status,429);
    const report={checkedAt:new Date().toISOString(),testEnvironment:'loopback HTTPS and native PostgreSQL; two independent application instances',certificateVerification:true,untrustedCertificateRejected:true,postgresTls:true,secureHttpOnlyCookie:true,sharedSessionAcrossInstances:true,twoAccountsOnline:true,foreignOriginStatus:403,privateRoutesStatus:404,distributedLoginLimitStatus:429,publicCloudDeployment:false,physicalRemoteDeviceTest:false};
    await mkdir('product/evidence/remote',{recursive:true});await writeFile('product/evidence/remote/https-qa.json',JSON.stringify(report,null,2)+'\n');
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));for(const runtime of replicas)await runtime.close();}
});
