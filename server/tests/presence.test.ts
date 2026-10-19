import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { createPresence,PRESENCE_TTL_MS } from "../application/presence.js";
import { AppError } from "../domain/contracts.js";
import type { WorkspaceMember } from "../domain/workspace-port.js";
import { openDatabase } from "../db/database.js";
import { createStudio } from "../db/studio-store.js";
import { createAuth } from "../adapters/auth.js";
import { createHttp } from "../http.js";

function fixture() {
  let time=1_000_000;
  const people: WorkspaceMember[]=[{userId:"a",name:"동료 A",role:"owner"},{userId:"b",name:"동료 B",role:"viewer"}];
  const p=createPresence(async(userId,id)=>{if(id!=="room"||!people.some(x=>x.userId===userId))throw new AppError(404,"없음");return people;},()=>time);
  const identity=(userId:string,sessionId=userId)=>({userId,sessionId,expiresAt:new Date(time+86400000)});
  return {p,people,identity,advance:(ms:number)=>{time+=ms;}};
}
test("presence aggregates tabs and independent sessions; leave is idempotent and cannot revive a closed tab",async()=>{
  const f=fixture(),a=f.identity("a"),other=f.identity("a","other"),b=f.identity("b"),tabs=[randomUUID(),randomUUID(),randomUUID()],observer=randomUUID();
  await f.p.touch(a,"room",tabs[0]);await f.p.touch(a,"room",tabs[1]);await f.p.touch(other,"room",tabs[2]);
  let view=await f.p.touch(b,"room",observer);assert.equal(view.members.filter(p=>p.online).length,2);assert.equal(view.events.filter(e=>e.userId==="a").length,1);
  await f.p.leave(a,"room",tabs[0]);await f.p.leave(a,"room",tabs[0]);await assert.rejects(()=>f.p.touch(a,"room",tabs[0]),{code:"PRESENCE_CLOSED"});
  f.p.leaveSession(a.sessionId);view=await f.p.touch(b,"room",observer);assert.equal(view.members[0].online,true);
  f.p.leaveSession(other.sessionId);view=await f.p.touch(b,"room",observer);assert.equal(view.members[0].online,false);assert.equal(view.events.filter(e=>e.userId==="a"&&e.kind==="left").length,1);
  const late=randomUUID(),fresh=f.identity("a","fresh");await f.p.leave(fresh,"room",late);await assert.rejects(()=>f.p.touch(fresh,"room",late),{code:"PRESENCE_CLOSED"});
});
test("logout rejects an already-authorized in-flight first heartbeat",async()=>{
  let resolve!: (value:WorkspaceMember[])=>void;
  const p=createPresence(()=>new Promise(done=>{resolve=done;}));
  const identity={userId:"a",sessionId:"pending",expiresAt:new Date(Date.now()+86400000)};
  const pending=p.touch(identity,"room",randomUUID());p.leaveSession(identity.sessionId);
  resolve([{userId:"a",name:"A",role:"owner"}]);await assert.rejects(pending,{status:401});
});
test("last heartbeat expires at the exact TTL, supports reconnect, session expiry and a fresh server instance",async()=>{
  const f=fixture(),a=f.identity("a"),b=f.identity("b"),tab=randomUUID(),watch=randomUUID();
  const first=await f.p.touch(a,"room",tab);f.advance(PRESENCE_TTL_MS-1);
  assert.equal((await f.p.touch(b,"room",watch)).members[0].online,true);f.advance(1);
  let view=await f.p.touch(b,"room",watch);assert.equal(view.members[0].online,false);assert.equal(view.events.at(-1)?.reason,"timeout");
  view=await f.p.touch(a,"room",tab);assert.equal(view.members[0].online,true);assert.equal(view.events.at(-1)?.kind,"joined");
  const fresh=fixture();assert.notEqual((await fresh.p.touch(fresh.identity("b"),"room",randomUUID())).instance,first.instance);
  const short={...a,sessionId:"short",expiresAt:new Date(1_000_000+PRESENCE_TTL_MS+100)};
  f.p.leaveSession(a.sessionId);await f.p.touch(short,"room",randomUUID());f.advance(100);
  assert.equal((await f.p.touch(b,"room",watch)).members[0].online,false);
  await assert.rejects(()=>f.p.touch(short,"room",randomUUID()),{status:401});
});
test("presence revocation, workspace isolation, bounded history and tab limits hold without leaking identifiers",async()=>{
  const f=fixture(),a=f.identity("a"),b=f.identity("b"),tab=randomUUID(),watch=randomUUID();
  await f.p.touch(a,"room",tab);await f.p.touch(b,"room",watch);f.people.splice(1,1);
  const view=await f.p.touch(a,"room",tab);assert.equal(view.members.length,1);assert.equal(view.events.at(-1)?.reason,"revoked");
  await assert.rejects(()=>f.p.touch(b,"room",watch),{status:404});await assert.rejects(()=>f.p.touch(a,"other",tab),{status:404});
  await assert.rejects(()=>f.p.touch(a,"room","spoof"),{status:400});
  for(let i=0;i<15;i++)await f.p.touch(a,"room",randomUUID());await assert.rejects(()=>f.p.touch(a,"room",randomUUID()),{status:429});
  f.p.leaveSession(a.sessionId);f.advance(PRESENCE_TTL_MS);
  for(let i=0;i<12;i++){const id=randomUUID();await f.p.touch(a,"room",id);await f.p.leave(a,"room",id);}
  const final=await f.p.touch(a,"room",randomUUID());assert.equal(final.events.length,20);
  assert.ok(!JSON.stringify(final).includes(tab));assert.ok(!JSON.stringify(final).includes('"sessionId"'));
});
test("room and process limits are bounded and idle rooms can be reclaimed",async()=>{
  let time=1_000_000;
  const p=createPresence(async()=>[{userId:"a",name:"A",role:"owner"}],()=>time);
  const identity={userId:"a",sessionId:"a",expiresAt:new Date(time+86400000)};
  for(let i=0;i<256;i++)await p.touch({...identity,sessionId:`session-${i}`},"crowded",randomUUID());
  await assert.rejects(()=>p.touch({...identity,sessionId:"overflow"},"crowded",randomUUID()),{status:429});
  for(let i=0;i<1023;i++)await p.touch(identity,`room-${i}`,randomUUID());
  await assert.rejects(()=>p.touch(identity,"overflow",randomUUID()),{status:429});
  time+=600_001;
  assert.equal((await p.touch(identity,"reclaimed",randomUUID())).members[0].online,true);
});
test("real HTTP presence authenticates every request, protects sessions and members, leaves on logout and preserves durable revisions",async()=>{
  const d=await openDatabase();
  try {
    const config={origin:"http://127.0.0.1:4180",secret:randomBytes(48).toString("base64url"),port:4180,dataDir:"",fakeDelayMs:0};
    const studio=createStudio(d),app=createHttp(createAuth(d,config),config,studio);
    const call=(path:string,cookie?:string,body?:unknown,origin=config.origin,key?:string)=>app.request(config.origin+path,{method:body===undefined?"GET":"POST",headers:{...(cookie?{cookie}:{}),origin,"content-type":"application/json",...(key?{"idempotency-key":key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const register=async(name:string)=>{const r=await call("/api/auth/sign-up/email",undefined,{name,email:`${name}@presence.test`,password:"Synthetic-presence-password-5521"});assert.equal(r.status,200);const cookie=r.headers.get("set-cookie")!.split(";")[0];return{cookie,...await(await call("/api/me",cookie)).json()};};
    const a=await register("owner"),b=await register("viewer"),c=await register("outsider");
    const space=await(await call("/api/workspaces",a.cookie,{name:"접속 상태 검증"},config.origin,"presence-room-key")).json(),base=`/api/workspaces/${space.id}`;
    const invite=await studio.issueInvite(a.user.id,space.id,"viewer",space.revision);await studio.joinWorkspace(b.user.id,invite.code);
    const before=await studio.snapshot(a.user.id,space.id),body={clientId:randomUUID()};
    assert.equal((await call(base+"/presence",undefined,body)).status,401);
    assert.equal((await call(base+"/presence",c.cookie,body)).status,404);
    assert.equal((await call(base+"/presence",a.cookie,body,"http://wrong.test")).status,403);
    assert.equal((await call(base+"/presence",a.cookie,{})).status,400);
    assert.equal((await call(`/api/workspaces/${a.workspace.id}/presence`,a.cookie,body)).status,400);
    const online=await(await call(base+"/presence",a.cookie,body)).json();assert.equal(online.members.filter((p:{online:boolean})=>p.online).length,1);
    // Reusing a tab ID in another user's session cannot remove the owner's connection.
    await call(base+"/presence/leave",b.cookie,body);
    const watch={clientId:randomUUID()};let observed=await(await call(base+"/presence",b.cookie,watch)).json();assert.equal(observed.members.filter((p:{online:boolean})=>p.online).length,2);
    const after=await studio.snapshot(a.user.id,space.id);assert.equal(after.workspace.revision,before.workspace.revision);assert.equal(after.cursor,before.cursor);assert.deepEqual(after.runs,before.runs);
    await call("/api/auth/sign-out",a.cookie,{});observed=await(await call(base+"/presence",b.cookie,watch)).json();assert.equal(observed.members.find((p:{userId:string})=>p.userId===a.user.id).online,false);assert.equal(observed.events.at(-1).reason,"logout");
    assert.equal((await call(base+"/presence",a.cookie,body)).status,401);
    await studio.updateMember(a.user.id,space.id,b.user.id,null,after.workspace.revision);
    assert.equal((await call(base+"/presence",b.cookie,watch)).status,404);assert.equal((await call(base+"/presence/leave",b.cookie,watch)).status,404);
  } finally {await d.close();}
});
