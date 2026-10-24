import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {profile} from '../../pilot-3d/character-personalities/min/profile.mjs';
import {sample} from '../../pilot-3d/character-personalities/min/motion.mjs';
import {createProps} from '../../pilot-3d/character-personalities/min/props.mjs';
import {createLivingOffice} from '../../pilot-3d/living-office/model.mjs';
import {DeskAction} from '../../pilot-3d/activities/desk-actions.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';

function within(value,min,max){assert(Number.isFinite(value));assert(value>=min-1e-9&&value<=max+1e-9,`${value} outside ${min}..${max}`);}
function bounded(pose){
 assert(pose.cue.startsWith('min-'));assert.equal(typeof pose.label,'string');
 assert(['observe','act','pause','check'].includes(pose.phase));
 assert(['focus','thinking','positive','relaxed'].includes(pose.expression));
 within(pose.pen.x,-.015,.035);within(pose.pen.z,0,.10);within(pose.pen.lift,0,.04);
 within(pose.left[0],-.18,.06);within(pose.left[1],.79,.95);within(pose.left[2],.22,.40);
 pose.head.forEach((n,i)=>within(n,-[.12,.22,.08][i],[.12,.22,.08][i]));
 pose.torso.forEach((n,i)=>within(n,-[.07,.10,.04][i],[.07,.10,.04][i]));
 assert.equal(pose.leftGrip.length,5);pose.leftGrip.forEach(n=>within(n,0,1));within(pose.propBeat,0,1);
}

test('Min has three QA signatures, staggered start, reference habit and two-nod completion',()=>{
 assert(Object.isFrozen(profile));assert(Object.isFrozen(profile.signatures));assert.equal(profile.id,'min');
 assert.equal(profile.startOffset,2.4);within(profile.workDuration,7,12);assert.equal(new Set(profile.signatures).size,3);
 assert(profile.habit.includes('번갈아'));assert(profile.completion.includes('두 번'));
});

test('Min is deterministic, finite and bounded at transitions, invalid inputs and long times',()=>{
 const edges=[0,1.35,1.6,2.25,3.7,4.2,4.65,4.8,5.05,5.5,5.65,6.05,6.4,6.75,6.9,7.45,7.65,8.95,9.25,11.2];
 const times=[-5,NaN,Infinity,1e10,...edges.flatMap(t=>[t-1e-7,t,t+1e-7]),...Array.from({length:1121},(_,i)=>i*.01)];
 for(const variant of [-1,0,1,2,3,NaN])for(const time of times){
  const args={time,variant},result=sample(args);bounded(result);assert.deepEqual(result,sample(args));
 }
});

test('Min distinguishes cross-reference, discrepancy hold, and two short check marks',()=>{
 const rows=[0,1,2].map(variant=>Array.from({length:112},(_,i)=>sample({time:i*.1,variant})));
 assert.equal(new Set(rows.map(r=>JSON.stringify(r))).size,3);
 for(const r of rows)assert(new Set(r.map(p=>p.cue)).size>=5);
 // No shared perpetual writing: most of the work is an intentional observation.
 for(const r of rows)assert(r.filter(p=>p.reading).length>r.length*.75);
 assert.deepEqual(sample({time:3.1,variant:0}).pen,sample({time:4.1,variant:0}).pen);
 assert.deepEqual(sample({time:2.8,variant:1}).pen,sample({time:4.4,variant:1}).pen);
 assert(rows[1].some(p=>p.head[1]<-.16&&p.cue==='min-recheck-reference'));
 const acts=rows[2].filter(p=>p.phase==='act');assert.equal(new Set(acts.map(p=>p.cue)).size,2);
 assert(acts.every(p=>p.pen.x<=.014&&p.pen.z<=.081));
 assert(rows[2].some(p=>p.expression==='positive'&&p.cue==='min-confirm-double-nod'));
 // Left index stays long while the other fingers curl, rather than a closed fist.
 assert(sample({time:2,variant:1}).leftGrip[1]<.06);
});

test('Min tiny checklist paths are continuous across every use phase transition',()=>{
 const edges=[[1.35,2.25,4.65,5.65,6.4,8.95],[1.6,4.8,6.05,6.75,7.45],[3.7,4.2,5.05,5.5,6.05,6.9]];
 for(let variant=0;variant<3;variant++)for(const time of edges[variant]){
  const a=sample({variant,time:time-1e-7}).pen,b=sample({variant,time:time+1e-7}).pen;
  assert(Math.hypot(a.x-b.x,a.z-b.z,a.lift-b.lift)<1e-5,`pen jump ${variant}:${time}`);
 }
});

test('Min paths keep the real checklist raycast authoritative for all three variants',()=>{
 const {root}=createLivingOffice();
 const actor=root.getObjectByName(root.userData.bindings.min.actor);
 const desk=new DeskAction(root,actor,'min',{expressive:true,metadata:root.userData});
 desk.personal=true;desk.personality={profile,sample};desk.stage='use';root.updateMatrixWorld(true);
 try{
  for(let variant=0;variant<3;variant++)for(let i=0;i<112;i++){
   desk.time=i*.1;desk.variant=variant;desk.personalityPose=sample({time:desk.time,variant});
   const target=desk.target();
   assert(target.local.toArray().every(Number.isFinite));assert(target.pen.tip.toArray().every(Number.isFinite));
   within(target.pen.tip.x,.350,.365);within(target.pen.tip.z,.420,.502);
   // Height comes from an actual intersected writing mesh plus the explicit lift.
   const lift=desk.personalityPose.pen.lift;
   within(target.pen.tip.y-lift,.75,.78);
  }
 }finally{desk.dispose();releaseStudioAsset(root);}
});

test('Min idle and completion are separate safe intentions, with exactly two completion nods',()=>{
 for(const stage of ['idle','complete','completion','success','reach','replace','release','retract'])
  for(const time of [0,.4,.8,1.2,1.6,9,1e9])bounded(sample({stage,time}));
 assert.equal(sample({stage:'idle'}).cue,'min-idle-reference');
 assert.equal(sample({stage:'replace'}).cue,'min-settle');
 assert.equal(sample({action:'success'}).expression,'positive');
 assert(sample({stage:'success',time:.4}).head[0]>sample({stage:'success',time:0}).head[0]+.05);
 assert(sample({stage:'success',time:1.2}).head[0]>sample({stage:'success',time:.8}).head[0]+.05);
 assert.deepEqual(sample({stage:'success',time:2}).head,sample({stage:'success',time:3}).head);
});

test('Min reference strip is supported at the actual desk top and owns its cleanup',()=>{
 const actor=new T.Group(),model=new T.Group(),foreign=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());
 actor.add(foreign);let foreignDisposes=0;foreign.geometry.addEventListener('dispose',()=>foreignDisposes++);
 for(const deskY of [.69,.74,.81]){
  const props=createProps({actor,model,THREE:T,deskY});assert(props.root.isGroup);assert.equal(props.root.parent,null);
  const geometries=new Set(),materials=new Set();
  props.root.traverse(n=>{assert(n.name.startsWith('Personality_min_'));if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});
  let gCount=0,mCount=0;geometries.forEach(g=>g.addEventListener('dispose',()=>gCount++));materials.forEach(m=>m.addEventListener('dispose',()=>mCount++));
  const base=props.root.getObjectByName('Personality_min_Base'),baseBounds=new T.Box3().setFromObject(base);
  within(baseBounds.min.y,deskY+.00049,deskY+.00051);
  for(const propBeat of [0,.5,1,NaN]){
   props.update({propBeat});const bounds=new T.Box3().setFromObject(props.root),size=bounds.getSize(new T.Vector3());
   within(bounds.min.y,deskY+.00049,deskY+.00051);within(bounds.max.y,deskY+.005,deskY+.006);
   within(size.x,.097,.101);within(size.z,.053,.055);
  }
  model.add(props.root);props.dispose();props.dispose();props.update({propBeat:1});
  assert.equal(props.root.parent,null);assert.equal(gCount,geometries.size);assert.equal(mCount,materials.size);
 }
 assert.equal(foreign.parent,actor);assert.equal(foreignDisposes,0);foreign.geometry.dispose();foreign.material.dispose();
});
