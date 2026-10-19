import test from "node:test";
import assert from "node:assert/strict";
import {createPresenceClient,presencePresentation} from "../src/presence.mjs";

test("workspace visits send a best-effort leave and reject late responses across A→B→A",async()=>{
  const waiting=[],changed=[],leaves=[];let id=0;
  const p=createPresenceClient({request:(path,body)=>new Promise((resolve,reject)=>waiting.push({path,body,resolve,reject})),beacon:(path,body)=>leaves.push({path,body}),onChange:value=>changed.push(value),newId:()=>String(++id)});
  p.start("a",true);const first=p.refresh();p.start("b",true);const second=p.refresh();p.start("a",true);const third=p.refresh();
  waiting[2].resolve({version:3});await third;waiting[0].resolve({version:1});await first;waiting[1].resolve({version:2});await second;
  assert.equal(p.current.version,3);assert.deepEqual(leaves.map(x=>x.body.clientId),["1","2"]);assert.equal(changed.filter(Boolean).length,1);
  p.stop();p.stop();assert.equal(leaves.length,3);assert.equal(p.current,null);
  p.start("personal",false);await p.refresh();assert.equal(waiting.length,3);
});
test("failed connections clear confirmed presence, closed visits rotate once, stale failures cannot clear a new visit",async()=>{
  const waiting=[],changed=[];let id=0;
  const p=createPresenceClient({request:(path,body)=>new Promise((resolve,reject)=>waiting.push({body,resolve,reject})),beacon:()=>{},onChange:value=>changed.push(value),newId:()=>String(++id)});
  p.start("room",true);let op=p.refresh();waiting[0].resolve({version:1});await op;p.disconnected();assert.equal(p.current,null);
  op=p.refresh();waiting[1].reject({code:"PRESENCE_CLOSED"});await assert.rejects(op);op=p.refresh();assert.equal(waiting[2].body.clientId,"2");waiting[2].resolve({version:2});await op;
  const stale=p.refresh();p.start("new",true);op=p.refresh();waiting[4].resolve({version:3});await op;waiting[3].reject(new Error("old"));await stale;assert.equal(p.current.version,3);
});
test("presence presentation distinguishes offline from unknown and counts members only",()=>{
  const members=[{userId:"a",name:"A"},{userId:"b",name:"B"}];
  assert.equal(presencePresentation(members,null).online,null);assert.ok(presencePresentation(members,null).members.every(p=>p.status==="unknown"));
  const view=presencePresentation(members,{members:[{userId:"a",online:true},{userId:"b",online:false},{userId:"foreign",online:true}],events:[]});
  assert.equal(view.online,1);assert.deepEqual(view.members.map(p=>p.status),["online","offline"]);
  assert.equal(presencePresentation([...members,{userId:"new"}],{members:[],events:[]}).members[2].status,"unknown");
});
