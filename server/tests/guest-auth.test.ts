import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {eq,like} from 'drizzle-orm';
import {openDatabase} from '../db/database.js';
import {createAuth} from '../adapters/auth.js';
import {GUEST_PREFIX,GUEST_EMAIL,GUEST_TTL_MS} from '../adapters/guest-auth.js';
import {createHttp} from '../http.js';
import {createStudio} from '../db/studio-store.js';
import {user,account,session} from '../db/schema.js';
import type {Config} from '../config.js';

test('five concurrent guest sessions have independent identities; sixth is rejected and logout/expiry return seats',async()=>{
 const d=await openDatabase();try{
 const config:Config={origin:'http://127.0.0.1:4180',port:4180,secret:randomBytes(48).toString('base64url'),dataDir:'',fakeDelayMs:0};
 const app=createHttp(createAuth(d,config),config,createStudio(d));
 const call=(path:string,body?:object,cookie?:string,origin=config.origin)=>app.request(config.origin+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json',origin}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
 const cookie=(r:Response)=>(r.headers.get('set-cookie')??'').split(';')[0];
 assert.equal((await call('/api/auth/sign-in/guest',{},undefined,'https://evil.test')).status,403);
 assert.equal((await call('/api/auth/sign-up/email',{name:'Impersonator',email:GUEST_EMAIL.toUpperCase(),password:'synthetic-password-5689'})).status,400);
 const normal=await call('/api/auth/sign-up/email',{name:'Regular',email:'regular@guest.test',password:'synthetic-password-5689'});assert.equal(normal.status,200);
 const results=await Promise.all(Array.from({length:6},()=>call('/api/auth/sign-in/guest',{})));
 const accepted=results.filter(r=>r.status===200),rejected=results.filter(r=>r.status===429);assert.equal(accepted.length,5);assert.equal(rejected.length,1);assert.equal((await rejected[0].json()).code,'GUEST_FULL');
 const people=await Promise.all(accepted.map(async r=>{
 assert.deepEqual(await r.clone().json(),{success:true});assert.match(r.headers.get('set-cookie')??'',/HttpOnly/i);assert.match(r.headers.get('set-cookie')??'',/SameSite=Lax/i);
 return (await call('/api/me',undefined,cookie(r))).json();}));
 assert.equal(new Set(people.map(m=>m.user.id)).size,5);assert.equal(new Set(people.map(m=>m.workspace.id)).size,5);
 assert.equal(people.every(m=>m.user.isGuest&&m.user.id.startsWith(GUEST_PREFIX)),true);
 assert.equal((await d.db.select().from(account).where(like(account.userId,GUEST_PREFIX+'%'))).length,0);
 assert.equal((await call('/api/workspaces/'+people[1].workspace.id+'/snapshot',undefined,cookie(accepted[0]))).status,404);
 assert.equal((await call('/api/me',undefined,cookie(normal))).status,200,'regular user is not blocked by guest capacity');
 const same=await call('/api/auth/sign-in/guest',{},cookie(accepted[0]));assert.equal(same.status,200);assert.equal(same.headers.get('set-cookie'),null);
 for(const path of ['/update-user','/change-email','/delete-user'])assert.equal((await call('/api/auth'+path,{name:'Hijack',newEmail:'hijack@test.test'},cookie(accepted[0]))).status,403);
 assert.equal((await call('/api/auth/sign-in/guest',{},cookie(normal))).status,409);
 const [stored]=await d.db.select().from(session).where(eq(session.userId,people[0].user.id));assert.ok(Math.abs(stored.expiresAt.getTime()-stored.createdAt.getTime()-GUEST_TTL_MS)<5,'guest expiry must not extend when me is called');
 await call('/api/auth/sign-out',{},cookie(accepted[0]));assert.equal((await call('/api/me',undefined,cookie(accepted[0]))).status,401);
 const fresh=await call('/api/auth/sign-in/guest',{});assert.equal(fresh.status,200);const freshMe=await (await call('/api/me',undefined,cookie(fresh))).json();assert.notEqual(freshMe.workspace.id,people[0].workspace.id);
 assert.equal((await d.db.select().from(user).where(eq(user.id,people[0].user.id))).length,1,'old identity and records remain preserved');
 await d.db.update(session).set({expiresAt:new Date(0)}).where(eq(session.userId,freshMe.user.id));assert.equal((await call('/api/me',undefined,cookie(fresh))).status,401);
 assert.equal((await call('/api/auth/sign-in/guest',{})).status,200);
 }finally{await d.close();}
});

test('remote guest cookies remain Secure and database rate limit applies to repeated existing-session calls',async()=>{
 const d=await openDatabase();try{
 const config:Config={origin:'https://studio.example.test',port:4180,secret:randomBytes(48).toString('base64url'),dataDir:'',fakeDelayMs:0,deployment:'vercel'};
 const app=createHttp(createAuth(d,config),config);
 const request=(cookie?:string)=>app.request(config.origin+'/api/auth/sign-in/guest',{method:'POST',headers:{origin:config.origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.44',...(cookie?{cookie}:{})},body:'{}'});
 const first=await request();assert.equal(first.status,200);assert.match(first.headers.get('set-cookie')??'',/Secure/i);const cookie=first.headers.get('set-cookie')!.split(';')[0];
 for(let i=1;i<10;i++)assert.equal((await request(cookie)).status,200);
 assert.equal((await request(cookie)).status,429);
 }finally{await d.close();}
});
