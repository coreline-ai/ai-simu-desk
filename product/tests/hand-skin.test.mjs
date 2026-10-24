import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fixture,step,until} from './living-fixture.mjs';
import {SceneFrames} from '../../pilot-3d/living-office/frames.mjs';

test('smooth hand is a connected welded skin with finite normalized weights and bounded detail',()=>{
 const f=fixture({personalMotion:true,personalities:true});
 try{for(const id of f.s.ids)for(const side of ['L','R']){
  const h=f.s.handGrips.rows.get(id)[side],skin=h.surface;
  assert.equal(h.diagnostics().surfaceVersion,3);assert(skin.mesh.isSkinnedMesh);assert.equal(skin.bones.length,16);assert(!h.batch.visible);
  for(const level of ['room','close']){
   skin.setDetail(level);const g=skin.mesh.geometry,p=g.attributes.position,w=g.attributes.skinWeight;
   assert(g.index.count/3<16000);assert(p.count>200);assert([...p.array,...g.attributes.normal.array].every(Number.isFinite));
   for(let i=0;i<w.count;i++)assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
   const parent=Array.from({length:p.count},(_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);
   for(let i=0;i<g.index.count;i+=3){const a=find(g.index.getX(i));parent[find(g.index.getX(i+1))]=a;parent[find(g.index.getX(i+2))]=a;}
   assert.equal(new Set(parent.map((_,i)=>find(i))).size,1,'palm and fingers are one connected surface');
  }
 }}finally{f.close();}
});

test('new skin initializes while paused and never changes phalanx lengths or actual cup targets',()=>{
 const f=fixture({personalMotion:true,personalities:true});
 try{const lengths=f.s.handGrips.rows.get('nara').L.fingers.map(x=>[...x.lengths]);
  f.runtime.setViewModel({...f.vm,motionPaused:true});step(f,1);assert.equal(f.s.time,0);
  for(const row of f.s.handGrips.rows.values())for(const side of ['L','R']){
   const s=row[side].surface;s.mesh.computeBoundingBox();const size=s.mesh.boundingBox.getSize(new T.Vector3());assert(size.toArray().every(n=>n>0&&n<.3));
  }
  f.runtime.setViewModel(f.vm);assert(f.s.startCup('nara'));until(f,()=>f.s.cups.nara.state==='sip',20);step(f,1);
  const h=f.s.handGrips.rows.get('nara').L;assert(h.error<.003);assert.deepEqual(h.fingers.map(x=>x.lengths),lengths);
  h.surface.mesh.computeBoundingBox();assert(h.surface.mesh.boundingBox.getSize(new T.Vector3()).length()<.3);
 }finally{f.close();}
});

test('new hand bone schema is deterministic, shared frames reproduce it and old hand packets are rejected',()=>{
 const a=fixture({personalMotion:true,personalities:true}),b=fixture({personalMotion:true,personalities:true}),old=fixture({personalMotion:true});
 try{const one=new SceneFrames(a.root),two=new SceneFrames(b.root),legacy=new SceneFrames(old.root);assert.equal(one.schema,two.schema);assert.notEqual(one.schema,legacy.schema);
  a.s.startCup('nara');step(a,3);two.receive(one.capture({time:a.s.time}));two.apply(1);
  const ma=a.s.handGrips.rows.get('nara').L.surface.bones[3],mb=b.s.handGrips.rows.get('nara').L.surface.bones[3];assert(ma.position.distanceTo(mb.position)<1e-6);
  assert.throws(()=>two.receive(legacy.capture({})),/버전/);
 }finally{a.close();b.close();old.close();}
});
