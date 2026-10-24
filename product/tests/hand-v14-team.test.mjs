import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {fixture,step,until} from './living-fixture.mjs';
import {SceneFrames} from '../../pilot-3d/living-office/frames.mjs';
import {presentationPose,fk} from '../../pilot-3d/hand-v14/kinematics.mjs';
const ids=['nara','sora','jun','min','leo'],options={personalMotion:true,personalities:true,anatomicalActors:ids};
const worldError=(h,r)=>{const i=h.defs.findIndex(d=>d.name===r.finger),p=h.pads[i].pad.getWorldPosition(new T.Vector3()).sub(new T.Vector3(0,.004,0));return p.distanceTo(new T.Vector3(...r.target));};

test('all five initialize mirrored v14 hands including penless Jun/page Leo, paused pose and resource release',()=>{
 const f=fixture(options),roots=[];try{
  f.runtime.setViewModel({...f.vm,motionPaused:true});step(f,1);assert.equal(f.s.time,0);
  assert.deepEqual(f.runtime.diagnostics().teamActivities.handReview.actors,ids);
  for(const id of ids)for(const side of ['L','R']){const h=f.s.handGrips.rows.get(id)[side];roots.push(h.root);assert.equal(h.diagnostics().surfaceVersion,4);assert.equal(h.skin.bones.length,16);assert(h.angles.flat().every(Number.isFinite));assert.equal(!!h.tripod,['nara','sora','min'].includes(id));assert.equal(h.keys.length,30);h.skin.setDetail('close');h.skin.mesh.computeBoundingBox();assert(h.skin.mesh.boundingBox.getSize(new T.Vector3()).length()<.3);}
 }finally{f.close();}for(const root of roots)assert.equal(root.parent,null);
});

test('fifteen v14 work variants preserve personality cues, precise three-pad pen contact, Jun key cadence and legacy page ownership',()=>{
 const f=fixture(options),signatures=[],report=[];try{
  for(let variant=0;variant<3;variant++){
   for(const id of ids)assert(f.s.startRole(id,{variant}));
   const rows=Object.fromEntries(ids.map(id=>[id,{cues:new Set(),phases:new Set(),pad:0,key:0,presses:0,samples:0,point:false}]));
   until(f,()=>ids.every(id=>!f.s.desks[id].busy),22,()=>{for(const id of ids){const d=f.s.desks[id],r=rows[id],hands=f.s.handGrips.rows.get(id);if(d.stage!=='use'||d.time<1.1)continue;
    r.samples++;r.cues.add(d.personalityPose.cue);r.phases.add(d.personalityPose.phase);assert(d.handError<.001,id+' wrist');assert(d.tipError<.001,id+' pen tip');
    for(const side of ['L','R']){const h=hands[side];assert(h.angles.flat().every(Number.isFinite));for(const p of h.pressRows){r.presses++;r.key=Math.max(r.key,worldError(h,p));assert(worldError(h,p)<.004,id+'/'+side+' rendered key');}}
    if(['nara','sora','min'].includes(id)){
     const h=hands.R;assert(!h.fallback);assert.deepEqual(h.contactRows.map(p=>p.finger),['thumb','index','middle']);
     for(const c of h.contactRows){const i=h.defs.findIndex(d=>d.name===c.finger);const error=h.pads[i].pad.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...c.target));r.pad=Math.max(r.pad,error);assert(error<.003,id+' rendered tripod');}
    }else if(id==='leo'){assert(hands.R.fallback);assert.equal(hands.R.mode,'legacy-owned-contact');assert(hands.R.error<.003);assert.equal(d.owner,'hand');assert.equal(d.anatomicalHand,undefined);}
    if(id==='jun'&&hands.R.mode==='mouse-contact'){assert(hands.R.contactRows.length>=2);for(const c of hands.R.contactRows){const h=hands.R,i=h.defs.findIndex(d=>d.name===c.finger);assert(h.pads[i].pad.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...c.target))<.003,'Jun mouse surface');}}
    if(id==='jun'&&variant===2&&d.time>1.5&&d.time<6.4){const h=hands.R,reach=i=>fk(h.defs[i],h.angles[i],h.settings[i]?.spread).points[3].distanceTo(new T.Vector3(...h.defs[i].base));assert(reach(1)-reach(3)>.015,'Jun index remains extended');r.point=true;}
   }});
   for(const id of ids){const r=rows[id],d=f.s.desks[id];assert(r.samples>200);assert(r.phases.size>=2);assert.equal(d.owner,'desk');assert.equal(d.events%2,0);signatures.push([...r.cues].join('|'));if(id==='jun'){if(variant<2)assert(r.presses>8,'Jun keeps typing bursts');else assert(r.point);}report.push({id,variant,samples:r.samples,keySamples:r.presses,maxKey:r.key,maxPad:r.pad});}
  }
  assert.equal(new Set(signatures).size,15);assert.deepEqual(f.s.violations,[]);console.log('team contact summary',JSON.stringify(report));
 }finally{f.close();}
});

test('personal presentation remains per-digit and per-character; shared review affects only the selected actor',()=>{
 const a=presentationPose([.2,.03,.8,.8,.8]);assert(a[1][0]<a[3][0]);
 const f=fixture(options);try{assert(f.runtime.setHandReview('key-press','min'));step(f,1);assert.equal(f.s.handGrips.rows.get('min').R.mode,'key-press');assert.notEqual(f.s.handGrips.rows.get('sora').R.mode,'key-press');assert(!f.runtime.setHandReview('tripod-write','leo'));f.vm.actors.find(a=>a.agentId==='min').pose='typing';f.runtime.setViewModel(f.vm);step(f,.1);assert.equal(f.s.handReviewPose,null);}finally{f.close();}
});

test('five cups, glasses, transfer and interruption retain existing contact authority and return props',()=>{
 const f=fixture(options);try{
  const seen=new Set();for(const id of ids)assert(f.s.startCup(id));
  until(f,()=>ids.every(id=>f.s.idle(id)),30,()=>{for(const id of ids){const c=f.s.cups[id],h=f.s.handGrips.rows.get(id).L;if(c.state==='sip'&&c.time>.5){seen.add(id);assert(h.fallback);assert.equal(h.mode,'legacy-owned-contact');assert(c.reachError<.001);assert(h.error<.003);}}});assert.equal(seen.size,5);for(const id of ids)assert.equal(f.s.cups[id].owner,'desk');
  assert(f.s.personalMotion.glasses.start());let touch=false;until(f,()=>!f.s.personalMotion.glasses.active,18,()=>{if(f.s.personalMotion.glasses.stage==='adjust'){touch=true;assert(f.s.handGrips.rows.get('jun').R.fallback);}});assert(touch);
  assert(f.s.startVisit('leo','nara',{transfer:true}));until(f,()=>f.s.idle('leo')&&f.s.idle('nara'),120);assert.deepEqual(f.s.violations,[]);
  for(const id of ids)assert(f.s.startRole(id,{variant:2}));step(f,3);f.vm.actors.forEach(a=>a.pose='typing');f.runtime.setViewModel(f.vm);assert(ids.every(id=>f.s.desks[id].returning));until(f,()=>ids.every(id=>!f.s.desks[id].busy),10);for(const id of ids){assert.equal(f.s.desks[id].owner,'desk');assert.equal(f.s.desks[id].events%2,0);}
 }finally{f.close();}
});

test('full-team schema reproduces v14 bones/nails and rejects old Sora-only frames',()=>{
 const a=fixture(options),b=fixture(options),old=fixture({...options,anatomicalActors:['sora']});try{
  const one=new SceneFrames(a.root),two=new SceneFrames(b.root),legacy=new SceneFrames(old.root);assert.equal(one.schema,two.schema);assert.notEqual(one.schema,legacy.schema);
  for(const id of ids)a.s.startRole(id,{variant:0});step(a,4);two.receive(one.capture({time:a.s.time}));two.apply(1);
  for(const id of ids)for(const side of ['L','R']){const x=a.s.handGrips.rows.get(id)[side],y=b.s.handGrips.rows.get(id)[side];assert(x.skin.bones[4].quaternion.angleTo(y.skin.bones[4].quaternion)<.001);assert.deepEqual([...x.skin.nails.instanceMatrix.array],[...y.skin.nails.instanceMatrix.array]);}assert.throws(()=>two.receive(legacy.capture({})),/버전/);
 }finally{a.close();b.close();old.close();}
});

test('product and personal demo opt into all five without changing personality authors or legacy comparison',async()=>{
 const product=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8'),demo=await readFile(new URL('../../pilot-3d/personal-office/app.mjs',import.meta.url),'utf8');assert.match(product,/anatomicalActors:TEAM\.map\(p=>p.id\)/);assert.match(demo,/anatomicalActors:usePersonal&&handRevision===14\?ids:\[\]/);assert.match(demo,/query.get\('hands'\)==='13'/);
});
