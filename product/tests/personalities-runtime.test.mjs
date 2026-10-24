import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fixture,step,until} from './living-fixture.mjs';
import {SceneFrames} from '../../pilot-3d/living-office/frames.mjs';
import {registry} from '../../pilot-3d/character-personalities/registry.mjs';

const options={personalMotion:true,personalities:true};
test('v13 integrates fifteen authored work paths without moving contact targets or changing ownership',()=>{
 const f=fixture(options),results=[];
 try{
  assert.equal(f.runtime.diagnostics().teamActivities.version,13);
  for(let variant=0;variant<3;variant++){
   for(const id of f.s.ids)assert(f.s.startRole(id,{variant}));
   const rows=Object.fromEntries(f.s.ids.map(id=>[id,{wrist:0,tip:0,pad:0,left:0,cues:new Set(),phases:new Set()}]));
   until(f,()=>f.s.ids.every(id=>!f.s.desks[id].busy),20,()=>{
    for(const id of f.s.ids){const d=f.s.desks[id],r=rows[id],p=f.s.personalities.rows.get(id);
     if(d.stage!=='use'||d.time<1)continue;
     r.wrist=Math.max(r.wrist,d.handError);r.tip=Math.max(r.tip,d.tipError);r.pad=Math.max(r.pad,f.s.handGrips.rows.get(id).R.error);r.left=Math.max(r.left,p.error);
     r.cues.add(p.sample.cue);r.phases.add(p.sample.phase);
     assert.equal(d.owner,id==='jun'?'desk':'hand');
     assert([...p.actor.position.toArray(),...p.actor.quaternion.toArray()].every(Number.isFinite));
    }
   });
   for(const id of f.s.ids){const r=rows[id],d=f.s.desks[id];results.push({id,variant,...r,cues:[...r.cues],phases:[...r.phases]});
    assert(r.wrist<.001,`${id}/${variant} wrist ${r.wrist}`);assert(r.tip<.001,`${id}/${variant} tip ${r.tip}`);
    assert(r.pad<.003,`${id}/${variant} finger pad ${r.pad}`);assert(r.left<.001,`${id}/${variant} left ${r.left}`);
    assert(r.phases.size>=2,`${id}/${variant} has held and active phases`);assert.equal(d.owner,'desk');assert.equal(d.events%2,0);
   }
  }
  assert.equal(new Set(results.map(r=>r.cues.join('|'))).size,15);
  assert.deepEqual(f.s.violations,[]);
 }finally{f.close();}
});

test('authored pointing uses absolute curl instead of accumulating the idle hand bend',()=>{
 const f=fixture(options);try{assert(f.s.startRole('jun',{variant:2}));step(f,4);const fingers=f.s.handGrips.rows.get('jun').R.fingers,reach=i=>fingers[i].pad.position.distanceTo(fingers[i].base);assert(reach(1)>.068,'index really extends');assert(reach(1)-reach(3)>.015,'ring stays curled');}finally{f.close();}
});

test('staggered automatic intro pauses exactly and cancellation/real work remove queued starts',()=>{
 const f=fixture(options);
 try{
  assert(f.s.startDemo());f.runtime.setViewModel({...f.vm,motionPaused:true});step(f,2);assert.equal(f.s.time,0);assert.equal(f.s.personalities.starts.length,0);
  f.runtime.setViewModel(f.vm);step(f,4);const starts=f.s.personalities.starts;assert.deepEqual(starts.map(r=>r.id),f.s.ids);
  for(let i=1;i<starts.length;i++)assert(starts[i].time-starts[i-1].time>.70);
  assert.deepEqual(f.s.ids.map(id=>f.s.desks[id].variant),[0,2,0,1,1]);
  f.s.setAuto(false);f.s.cancelAll();until(f,()=>f.s.ids.every(id=>!f.s.desks[id].busy),10);
  assert(f.s.startDemo());f.vm.actors[1].pose='typing';f.runtime.setViewModel(f.vm);step(f,.2);assert(!f.s.personalities.pending.has('sora'));
  f.s.setAuto(false);assert.equal(f.s.personalities.pending.size,0);
 }finally{f.close();}
});

test('cup/glasses authority is preserved and props stay home when actors walk; disposal is complete',()=>{
 const f=fixture(options),props=[...f.s.personalities.rows.values()].map(r=>r.props.root),homes=props.map(n=>n.getWorldPosition(new T.Vector3()));
 try{
  for(const id of f.s.ids)assert(f.s.startCup(id));
  const seen=new Set();until(f,()=>seen.size===5,20,()=>{for(const id of f.s.ids){const c=f.s.cups[id];if(c.state==='sip'&&c.time>.5){seen.add(id);assert(c.reachError<.001);assert(f.s.handGrips.rows.get(id).L.error<.003);}}});
  until(f,()=>f.s.ids.every(id=>f.s.idle(id)),30);
  assert(f.s.personalMotion.glasses.start());until(f,()=>!f.s.personalMotion.glasses.active,20);
  assert(f.s.startWindow('nara'));step(f,7);props.forEach((p,i)=>assert(p.getWorldPosition(new T.Vector3()).distanceTo(homes[i])<1e-8));
  assert.deepEqual(f.s.violations,[]);
 }finally{f.close();}
 for(const p of props)assert.equal(p.parent,null);
});

test('active personalized work yields to real work/removal and every owned prop returns safely',()=>{
 const f=fixture(options);
 try{
  for(const id of f.s.ids)assert(f.s.startRole(id,{variant:2}));step(f,3);
  f.vm.actors.forEach(a=>a.pose='typing');f.runtime.setViewModel(f.vm);
  for(const id of f.s.ids)assert(f.s.desks[id].returning);
  f.runtime.setViewModel({...f.vm,actors:[]});until(f,()=>f.s.ids.every(id=>!f.s.desks[id].busy),10);
  for(const id of f.s.ids){assert.equal(f.s.desks[id].owner,'desk');assert.equal(f.s.desks[id].events%2,0);}
  assert.deepEqual(f.s.violations,[]);
 }finally{f.close();}
});

test('v13 bones and character accents have a stable shared-frame schema; legacy frames reject explicitly',()=>{
 const a=fixture(options),b=fixture(options),old=fixture({personalMotion:true});
 try{
  const one=new SceneFrames(a.root),two=new SceneFrames(b.root),legacy=new SceneFrames(old.root);
  assert.equal(one.schema,two.schema);assert.notEqual(one.schema,legacy.schema);
  for(const id of a.s.ids)assert(a.s.startRole(id,{variant:2}));step(a,4);
  two.receive(one.capture({time:a.s.time}));two.apply(1);
  for(const id of a.s.ids){const ra=a.s.handGrips.rows.get(id).R.surface.bones[4],rb=b.s.handGrips.rows.get(id).R.surface.bones[4];assert(ra.quaternion.angleTo(rb.quaternion)<.002);}
  assert.throws(()=>two.receive(legacy.capture({})),/버전/);
  assert.equal(Object.keys(registry).length,5);
 }finally{a.close();b.close();old.close();}
});
