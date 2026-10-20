import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {eq} from "drizzle-orm";
import {openDatabase} from "../db/database.js";
import {createAuth} from "../adapters/auth.js";
import {GUEST_ID,GUEST_EMAIL} from "../adapters/guest-auth.js";
import {createHttp} from "../http.js";
import {createStudio} from "../db/studio-store.js";
import {user,account,session} from "../db/schema.js";
import type {Config} from "../config.js";

test("one-click guest uses a single public identity, isolated from regular users, and cannot be taken over",async()=>{
  const database=await openDatabase();
  try {
    const config:Config={origin:"http://127.0.0.1:4180",port:4180,secret:randomBytes(48).toString("base64url"),dataDir:"",fakeDelayMs:0};
    const auth=createAuth(database,config),app=createHttp(auth,config,createStudio(database));
    const call=(path:string,body?:object,cookie?:string,origin=config.origin)=>app.request(config.origin+path,{method:body?"POST":"GET",headers:{...(body?{"content-type":"application/json",origin}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
    const cookie=(response:Response)=>(response.headers.get("set-cookie")??"").split(";")[0];
    assert.equal((await call("/api/auth/sign-in/guest",{},undefined,"https://evil.test")).status,403);
    assert.equal((await call("/api/auth/sign-up/email",{name:"Impersonator",email:GUEST_EMAIL.toUpperCase(),password:"not-a-real-password-5689"})).status,400);
    const regular=await call("/api/auth/sign-up/email",{name:"Regular",email:"regular@guest-qa.test",password:"not-a-real-password-5689"});
    assert.equal(regular.status,200);const regularCookie=cookie(regular);
    const normalMe=await (await call("/api/me",undefined,regularCookie)).json();
    assert.equal(normalMe.user.isGuest,false);
    const concurrent=await Promise.all(Array.from({length:3},()=>call("/api/auth/sign-in/guest",{})));
    for(const response of concurrent){
      assert.equal(response.status,200,await response.clone().text());
      assert.deepEqual(await response.clone().json(),{success:true});
      assert.match(response.headers.get("set-cookie")??"",/HttpOnly/i);
      assert.match(response.headers.get("set-cookie")??"",/SameSite=Lax/i);
    }
    assert.equal((await database.db.select().from(user).where(eq(user.id,GUEST_ID))).length,1);
    assert.equal((await database.db.select().from(account).where(eq(account.userId,GUEST_ID))).length,0,"guest has no password or linked credential");
    const guestCookie=cookie(concurrent[0]),otherCookie=cookie(concurrent[1]);
    const me=await (await call("/api/me",undefined,guestCookie)).json();
    assert.equal(me.user.id,GUEST_ID);assert.equal(me.user.name,"게스트");assert.equal(me.user.isGuest,true);
    assert.equal((await (await call("/api/me",undefined,otherCookie)).json()).workspace.id,me.workspace.id);
    assert.equal((await call("/api/workspaces/"+normalMe.workspace.id+"/snapshot",undefined,guestCookie)).status,404);
    assert.equal((await call("/api/workspaces/"+me.workspace.id+"/snapshot",undefined,regularCookie)).status,404);
    for(const [path,body] of [
      ["/update-user",{name:"Hijacked"}],["/set-password",{newPassword:"takeover-password-8670"}],
      ["/change-email",{newEmail:"hijacked@example.test"}],["/delete-user",{}],
    ] as const){
      const status=(await call("/api/auth"+path,body,guestCookie)).status;
      assert.ok(status===403 || (path==="/set-password" && status===404),path+" status "+status);
    }
    assert.equal((await database.db.select().from(account).where(eq(account.userId,GUEST_ID))).length,0);
    assert.equal((await (await call("/api/me",undefined,guestCookie)).json()).user.name,"게스트");
    const repeat=await call("/api/auth/sign-in/guest",{},guestCookie);assert.equal(repeat.status,200);
    assert.equal(repeat.headers.get("set-cookie"),null,"already signed-in guest does not create another session");
    assert.equal((await call("/api/auth/sign-in/guest",{},regularCookie)).status,409);
    assert.equal((await (await call("/api/me",undefined,regularCookie)).json()).user.id,normalMe.user.id);
    assert.equal((await call("/api/auth/sign-out",{},guestCookie)).status,200);
    assert.equal((await call("/api/me",undefined,guestCookie)).status,401);
    assert.equal((await call("/api/me",undefined,otherCookie)).status,200,"logging out one guest session preserves another");
    const resumed=await call("/api/auth/sign-in/guest",{});assert.equal(resumed.status,200);
    assert.equal((await (await call("/api/me",undefined,cookie(resumed))).json()).workspace.id,me.workspace.id);
    await database.db.update(session).set({expiresAt:new Date(0)}).where(eq(session.userId,GUEST_ID));
    assert.equal((await call("/api/me",undefined,cookie(resumed))).status,401);
  }finally{await database.close();}
});

test("remote guest endpoint uses Secure cookies and database rate limiting",async()=>{
  const database=await openDatabase();
  try{
    const config:Config={origin:"https://studio.example.test",port:4180,secret:randomBytes(48).toString("base64url"),dataDir:"",fakeDelayMs:0,deployment:"vercel"};
    const app=createHttp(createAuth(database,config),config);
    const request=()=>app.request(config.origin+"/api/auth/sign-in/guest",{method:"POST",headers:{origin:config.origin,"content-type":"application/json","x-vercel-forwarded-for":"192.0.2.44"},body:"{}"});
    const first=await request();assert.equal(first.status,200,await first.clone().text());assert.match(first.headers.get("set-cookie")??"",/Secure/i);
    for(let i=1;i<10;i++)assert.equal((await request()).status,200);
    assert.equal((await request()).status,429);
  }finally{await database.close();}
});
