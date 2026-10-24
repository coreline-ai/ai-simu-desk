import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {profile} from '../../pilot-3d/character-personalities/sora/profile.mjs';
import {sample} from '../../pilot-3d/character-personalities/sora/motion.mjs';
import {createProps} from '../../pilot-3d/character-personalities/sora/props.mjs';
import {fixture,until} from './living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';

const within=(n,a,b)=>{assert(Number.isFinite(n),`finite ${n}`);assert(n>=a-1e-10&&n<=b+1e-10,`${n} in ${a}..${b}`);};
function bounded(pose){
 assert(pose.cue.startsWith('sora-'));assert.equal(typeof pose.label,'string');
 assert(['observe','act','pause','check'].includes(pose.phase));
 assert(['focus','thinking','positive','relaxed'].includes(pose.expression));
 within(pose.pen.x,-.025,.10);within(pose.pen.z,-.045,.09);within(pose.pen.lift,0,.06);
 within(pose.left[0],-.18,.06);within(pose.left[1],.79,.95);within(pose.left[2],.22,.40);
 pose.head.forEach((n,i)=>within(n,-[.12,.22,.08][i],[.12,.22,.08][i]));
 pose.torso.forEach((n,i)=>within(n,-[.07,.10,.04][i],[.07,.10,.04][i]));
 pose.leftGrip.forEach(n=>within(n,0,1));within(pose.propBeat,0,1);
}

test('Sora profile reserves three different design signatures and staggered start',()=>{
 assert(Object.isFrozen(profile));assert(Object.isFrozen(profile.signatures));assert.equal(profile.id,'sora');
 assert.equal(profile.startOffset,.8);within(profile.workDuration,7,12);
 assert.equal(new Set(profile.signatures).size,3);assert(profile.habit.includes('고개'));assert(profile.completion.includes('미소'));
});

test('Sora targets remain finite and contract bounded at transitions and long times',()=>{
 const edges=[0,1.75,2.25,2.9,3.15,3.2,5.2,5.55,6,6.05,7.5,7.65,8.7,9.35,10.8];
 const times=[-1,NaN,Infinity,1e10,...edges.flatMap(n=>[n-1e-7,n,n+1e-7]),...Array.from({length:1081},(_,i)=>i*.01)];
 for(const variant of [-1,0,1,2,3,NaN])for(const time of times){
  const args={time,variant};const pose=sample(args);bounded(pose);assert.deepEqual(pose,sample(args));
 }
});

test('Sora makes broad contours, colour comparisons and explanations genuinely different',()=>{
 const all=[0,1,2].map(variant=>Array.from({length:54},(_,i)=>sample({time:i*.2,variant})));
 assert.equal(new Set(all.map(x=>JSON.stringify(x))).size,3);
 const cues=all.map(rows=>new Set(rows.map(p=>p.cue)));
 for(const [i,set] of cues.entries())assert(set.size>=4,`variant ${i} has real phases`);
 assert(all[0].some(p=>p.pen.x>.05));assert(all[0].some(p=>p.pen.z>.04));
 assert(all[1].some(p=>p.head[1]<-.15&&p.cue==='sora-colour-reference'));
 assert(all[2].some(p=>p.left[1]>.89&&p.head[1]<-.20&&p.expression==='positive'));
 assert(all[2].some(p=>p.cue==='sora-explain-listen'));
 // Observation is a deliberate held pose, not a faster/slower writing sine.
 assert.deepEqual(sample({time:4.2,variant:0}).pen,sample({time:4.8,variant:0}).pen);
 for(const rows of all)assert(rows.filter(p=>p.reading).length>=15);
});

test('Sora idle, completion, and non-use stages have safe separate intentions',()=>{
 for(const stage of ['idle','complete','completion','success','reach','replace','release','retract']){
  for(const time of [0,.3,1.2,9,1e9])bounded(sample({time,stage}));
 }
 assert.equal(sample({stage:'idle'}).cue,'sora-idle-composition');
 assert.equal(sample({action:'success'}).expression,'positive');
 assert.equal(sample({stage:'replace'}).cue,'sora-settle');
});

test('Sora creates a single small supported colour card, with owned cleanup only',()=>{
 const actor=new T.Group(),model=new T.Group(),external=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());
 actor.add(external);let foreignDisposes=0;external.geometry.addEventListener('dispose',()=>foreignDisposes++);
 const prop=createProps({actor,model,THREE:T});assert(prop.root.isGroup);assert.equal(prop.root.parent,null);
 const gs=new Set(),ms=new Set();prop.root.traverse(n=>{assert(n.name.startsWith('Personality_sora_'));if(n.geometry)gs.add(n.geometry);if(n.material)ms.add(n.material);});
 let geometries=0,materials=0;gs.forEach(g=>g.addEventListener('dispose',()=>geometries++));ms.forEach(m=>m.addEventListener('dispose',()=>materials++));
 const bounds=new T.Box3().setFromObject(prop.root),size=bounds.getSize(new T.Vector3());
 within(size.x,.10,.13);within(size.z,.06,.08);within(bounds.min.y,.74049,.74051);within(bounds.max.y,.749,.750);
 const marker=prop.root.getObjectByName('Personality_sora_SelectionMarker');
 prop.update({propBeat:1});within(marker.position.x,-.063,-.061);prop.update({propBeat:NaN});assert(Number.isFinite(marker.position.x));
 const card=prop.root.getObjectByName('Personality_sora_PaletteCard');within(card.position.y,.74349,.74351);
 model.add(prop.root);prop.dispose();prop.dispose();prop.update({propBeat:1});
 assert.equal(prop.root.parent,null);assert.equal(geometries,gs.size);assert.equal(materials,ms.size);assert.equal(foreignDisposes,0);assert.equal(external.parent,actor);
 external.geometry.dispose();external.material.dispose();
});

test('Sora colour card follows the measured top at different desk heights',()=>{
 for(const deskY of [.69,.74,.81]){
  const prop=createProps({actor:new T.Group(),model:new T.Group(),THREE:T,deskY});
  const card=prop.root.getObjectByName('Personality_sora_PaletteCard');
  const bounds=new T.Box3().setFromObject(card);
  assert(Math.abs(bounds.min.y-(deskY+.0005))<1e-8);
  for(const propBeat of [0,.5,1]){
   prop.update({propBeat});
   const all=new T.Box3().setFromObject(prop.root);
   assert(all.min.y>=deskY+.00049);assert(all.max.y<deskY+.010);
  }
  prop.dispose();
 }
});

test('Sora completes all real runtime variants within actual arm reach and prop contact',()=>{
 const f=fixture({personalMotion:true,personalities:true});
 try{
  for(let variant=0;variant<3;variant++){
   assert(f.s.startRole('sora',{variant}));
   const cues=new Set();let maxWrist=0,maxTip=0,maxPad=0,maxLeft=0,minReachMargin=1;
   until(f,()=>!f.s.desks.sora.busy,20,()=>{
    const d=f.s.desks.sora,r=f.s.personalities.rows.get('sora');
    if(d.stage!=='use'||d.time<1)return;
    assert.equal(d.owner,'hand');cues.add(r.sample.cue);
    maxWrist=Math.max(maxWrist,d.handError);maxTip=Math.max(maxTip,d.tipError);
    maxPad=Math.max(maxPad,f.s.handGrips.rows.get('sora').R.error);maxLeft=Math.max(maxLeft,r.error);
    const actor=r.actor,shoulder=part(actor,'NaraShoulderR');
    const desired=actor.localToWorld(d.target().local.clone());
    const upper=part(actor,'NaraElbowR').position.length(),lower=part(actor,'NaraHandR').position.length();
    minReachMargin=Math.min(minReachMargin,upper+lower-shoulder.getWorldPosition(new T.Vector3()).distanceTo(desired));
   });
   assert(cues.size>=4);assert(maxWrist<.001);assert(maxTip<.001);assert(maxPad<.003);assert(maxLeft<.001);
   assert(minReachMargin>.001,`variant ${variant}: real reach margin ${minReachMargin}`);
   assert.equal(f.s.desks.sora.owner,'desk');assert.equal(f.s.desks.sora.events%2,0);
  }
  assert.deepEqual(f.s.violations,[]);
 }finally{f.close();}
});
