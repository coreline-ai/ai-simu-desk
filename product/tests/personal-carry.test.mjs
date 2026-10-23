import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {fixture,until,step} from './living-fixture.mjs';
const V=()=>new Vector3();
for(const size of [2,5])test(`ordinary ${size}-person meeting leaves all mugs at desks throughout travel, discussion and return`,()=>{
 const f=fixture({personalMotion:true});try{const ids=f.s.ids.slice(0,size),home=new Map(ids.map(id=>[id,f.s.cups[id].mug.getWorldPosition(V())])),events=ids.map(id=>f.s.cups[id].events),walked=new Set();assert(f.s.startMeeting(ids));assert.equal(size===2?f.s.session.withCups:f.s.group.current.withCups,false);
 until(f,()=>size===2?f.s.session?.phase==='discussion':f.s.group.current?.phase==='talk',500,()=>{for(const id of ids){const c=f.s.cups[id];assert.equal(c.state,'idle');assert.equal(c.owner,'desk');assert(c.mug.getWorldPosition(V()).distanceTo(home.get(id))<1e-6);if(f.s.state(id).action==='walk'){walked.add(id);assert(f.s.humanMotion.free(id,'L'));assert(f.s.humanMotion.free(id,'R'));}}});assert.equal(walked.size,size);step(f,1);f.s.cancelAll();until(f,()=>!f.s.session&&!f.s.group.current,500);assert.deepEqual(ids.map(id=>f.s.cups[id].events),events);assert.deepEqual(f.s.book.snapshot(),{});
 }finally{f.close();}
});
test('purposeful coffee carry: all five keep upright mugs ahead of wrists, real finger contacts and one free arm on both routes',()=>{
 const f=fixture({personalMotion:true});try{for(const id of f.s.ids)assert(f.s.startCoffee(id));const seen=new Set(),previous=new Map();until(f,()=>!f.s.coffee.rows.size,1000,()=>{for(const id of f.s.ids){const c=f.s.cups[id],r=f.s.coffee.rows.get(id),a=c.actor;if(!r||c.state!=='carry')continue;assert.equal(c.owner,'hand');assert(!f.s.humanMotion.free(id,'L'));assert(f.s.humanMotion.free(id,'R'));assert(c.reachError<1e-6);const grip=f.s.handGrips.rows.get(id).L;assert(grip.error<1e-5,id+' five pads contact actual handle');assert(grip.contactRows.every(row=>row.reachable));if(f.s.state(id).action==='walk'){
 const p=a.worldToLocal(c.mug.getWorldPosition(V())),w=a.worldToLocal(c.hand.getWorldPosition(V()));assert(p.z>w.z+.10);assert(p.y>w.y&&p.y<w.y+.012);assert(Math.abs(p.x-w.x)<1e-5);assert(V().set(0,1,0).applyQuaternion(c.mug.getWorldQuaternion(c.mug.quaternion.clone())).y>.999);seen.add(id+':'+r.phase);
 const key=id+':'+r.phase,old=previous.get(key),now=c.mug.getWorldPosition(V());if(old&&f.s.time-old.time<.034)assert(now.distanceTo(old.p)<.09,'no cup teleport between consecutive gait frames');previous.set(key,{p:now,time:f.s.time});
 }}});for(const id of f.s.ids){assert(seen.has(id+':out'),id+' outbound');assert(seen.has(id+':home'),id+' return');assert.equal(f.s.cups[id].owner,'desk');}assert.deepEqual(f.s.book.snapshot(),{});
 }finally{f.close();}
});
test('v11 comparison keeps its previous cup pickup policy',()=>{const f=fixture();try{assert(f.s.startMeeting(f.s.ids));assert(f.s.group.current.withCups);for(const id of f.s.ids)assert.equal(f.s.cups[id].state,'reach');}finally{f.close();}});
test('purposeful carrying yields to work at pickup, outbound, machine, retrieval and return without losing mugs',()=>{
 for(const [index,phase]of ['pickup','out','brew','retrieve','home'].entries()){
  const f=fixture({personalMotion:true});try{const id=f.s.ids[index];assert(f.s.startCoffee(id));until(f,()=>f.s.coffee.rows.get(id)?.phase===phase,300);step(f,.1);f.vm.actors.find(a=>a.agentId===id).pose='typing';f.runtime.setViewModel(f.vm);until(f,()=>!f.s.coffee.rows.has(id),400);assert.equal(f.s.cups[id].owner,'desk');assert.equal(f.s.cups[id].state,'idle');assert.deepEqual(f.s.book.snapshot(),{});assert.equal(f.s.coffee.history.at(-1).status,'cancelled');}finally{f.close();}
 }
});
