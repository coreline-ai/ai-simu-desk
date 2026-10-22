import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fixture,until,step} from './living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
import {HUMAN_PROFILES} from '../../pilot-3d/living-office/human-motion.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {createEnsembleOffice} from '../../pilot-3d/ensemble-office/model.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
const V=()=>new T.Vector3();
const flex=(a,side)=>{const shoulder=part(a,'NaraShoulder'+side).getWorldPosition(V()),elbow=part(a,'NaraElbow'+side).getWorldPosition(V()),hand=part(a,'NaraHand'+side).getWorldPosition(V());return Math.PI-shoulder.sub(elbow).angleTo(hand.sub(elbow));};
function correlation(rows){const mean=i=>rows.reduce((sum,r)=>sum+r[i],0)/rows.length,a=mean(0),b=mean(1);let ab=0,aa=0,bb=0;for(const[x,y]of rows){ab+=(x-a)*(y-b);aa+=(x-a)**2;bb+=(y-b)**2;}return ab/Math.sqrt(aa*bb);}

test('five actual arrivals use individual cadence, relaxed elbows and arm swing opposite the planted legs',()=>{
 const f=fixture(),s=f.s,rows=Object.fromEntries(s.ids.map(id=>[id,[]]));
 try{assert(s.startHuddle());until(f,()=>s.ids.every(id=>rows[id].length>=45),220,()=>{
  for(const id of s.ids){const state=s.state(id),p=state.pose;if(state.action!=='walk'||p.gaitFade<.98||rows[id].length>=90)continue;
   const a=s.models.getObjectByName(s.meta.bindings[id].actor),shoulder=part(a,'NaraShoulderL').getWorldPosition(V()),elbow=part(a,'NaraElbowL').getWorldPosition(V()),hand=part(a,'NaraHandL').getWorldPosition(V());
   if(s.bodyContacts.furniture.some(item=>item.box.distanceToPoint(shoulder)<.6))continue;
   const forward=foot=>Math.sin(p.yaw)*(foot.position[0]-p.x)+Math.cos(p.yaw)*(foot.position[2]-p.z),handZ=a.worldToLocal(hand.clone()).z-a.worldToLocal(shoulder.clone()).z;
   assert(Math.abs(shoulder.distanceTo(elbow)-.235)<1e-6);assert(Math.abs(elbow.distanceTo(hand)-Math.hypot(.251,.005))<1e-6);
   rows[id].push([forward(p.feet[0])-forward(p.feet[1]),handZ,flex(a,'L'),part(a,'NaraHandL').rotation.y]);
  }
 });
 for(const id of s.ids){const list=rows[id];assert(list.length>=45,id);assert(correlation(list)<-.55,id+' arm and leg should oppose');const angles=list.map(x=>x[2]),range=Math.max(...angles)-Math.min(...angles);assert(Math.max(...angles)<.65,id+' no folded free elbow');assert(range>.015,id+' elbow is not pinned to the same IK reach');assert(list.some(x=>Math.abs(x[3])>.5),id+' palm faces thigh');assert.equal(s.huddles.current.records.get(id).trip.options.routeMotion.period,HUMAN_PROFILES[id].period);}
 assert.equal(new Set(s.ids.map(id=>HUMAN_PROFILES[id].period)).size,5);assert.equal(new Set(s.ids.map(id=>HUMAN_PROFILES[id].swing)).size,5);assert.deepEqual(s.violations,[]);
 }finally{f.close();}
});

test('relaxed five-finger meshes keep original phalanx lengths and clear profiles when activity owns a hand',()=>{
 const f=fixture();try{assert(f.s.startHuddle());until(f,()=>f.s.huddles.current?.phase==='talk',220);const signatures=[];
 for(const id of f.s.ids){const hands=f.s.handGrips.rows.get(id);signatures.push(hands.L.fingers.map(x=>x.pad.position.toArray()));for(const side of['L','R']){const hand=hands[side];assert(hand.relaxation);for(const finger of hand.fingers){assert.equal(finger.lengths.length,2);for(let n=0;n<2;n++)assert(Math.abs(finger.links[n].scale.y*.033-finger.lengths[n])<1e-9);assert(finger.pad.position.y>finger.end.y||finger===hand.fingers[0]);}}}
 assert.equal(new Set(signatures.map(x=>JSON.stringify(x))).size,5);
 f.runtime.setHumanMotion(false);for(const row of f.s.handGrips.rows.values())for(const side of['L','R'])assert.equal(row[side].relaxation,null);
 }finally{f.close();}
});

test('a cup arm and both support hands retain contact authority while a free walking arm is released',()=>{
 const f=fixture();try{for(const id of f.s.ids){assert(f.s.startCup(id));}until(f,()=>f.s.ids.every(id=>f.s.cupSupport.controls(id)),10);for(const id of f.s.ids){assert(!f.s.humanMotion.free(id,'L'));assert(!f.s.humanMotion.free(id,'R'));}
 f.s.cancelAll();until(f,()=>f.s.ids.every(id=>f.s.idle(id)),20);for(const id of f.s.ids){assert(f.s.humanMotion.free(id,'L'));assert(f.s.humanMotion.free(id,'R'));assert.equal(f.s.cups[id].owner,'desk');}
 }finally{f.close();}
});

test('individual standing gestures differ and preserve fixed joints and owned marker precedence',()=>{
 const f=fixture();try{assert(f.s.startHuddle());until(f,()=>f.s.huddles.current?.phase==='talk',220);const signatures=[];
 for(const id of f.s.ids){const actor=f.root.getObjectByName(f.s.meta.bindings[id].actor);f.runtime.update(1/30);assert(f.s.humanMotion.gesture(id,actor,{time:1.2}));actor.updateMatrixWorld(true);signatures.push(part(actor,'NaraShoulderR').quaternion.toArray());const control=f.s.handControl.bind(f.s);f.s.handControl=(who,side)=>who===id&&side==='R'||control(who,side);assert.equal(f.s.humanMotion.gesture(id,actor,{time:1.2}),false);f.s.handControl=control;}
 assert.equal(new Set(signatures.map(x=>JSON.stringify(x))).size,5);
 }finally{f.close();}
});

test('pause, reset, original v11 comparison and old v10 runtimes preserve lifecycle boundaries',()=>{
 const f=fixture();try{assert(f.s.startHuddle());step(f,4);f.runtime.setViewModel({...f.vm,motionPaused:true});const time=f.s.time,matrices=[];f.root.traverse(n=>matrices.push(...n.position,...n.quaternion));f.runtime.update(1);const after=[];f.root.traverse(n=>after.push(...n.position,...n.quaternion));assert.deepEqual(after,matrices);assert.equal(f.s.time,time);
 f.runtime.setViewModel(f.vm);assert.equal(f.runtime.setHumanMotion(false),false);assert(!f.runtime.diagnostics().teamActivities.living.humanMotion.enabled);f.reset();assert(f.runtime.diagnostics().teamActivities.living.humanMotion.enabled);
 const {root}=createEnsembleOffice(),old=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true});try{assert.equal(old.scheduler.humanMotion,null);assert.equal(old.diagnostics().teamActivities.version,10);}finally{old.dispose();releaseStudioAsset(root);}
 }finally{f.close();}
});

test('all five have different initial rest habits and support-safe seated/standing transitions',()=>{
 const f=fixture();try{for(const id of f.s.ids)assert(f.s.startRest(id));assert.equal(new Set([...f.s.records.values()].map(r=>r.style)).size,5);assert(f.s.records.get('min').seated);assert(!f.s.records.get('sora').seated);step(f,3);for(const id of f.s.ids){const actor=f.root.getObjectByName(f.s.meta.bindings[id].actor);for(const side of['L','R'])assert(Number.isFinite(flex(actor,side)));}f.s.cancelAll();until(f,()=>f.s.ids.every(id=>f.s.idle(id)),30);}finally{f.close();}
});

test('walking with a cup keeps only the occupied arm bent and preserves handle contact',()=>{
 const f=fixture();try{assert(f.s.startGroupMeeting());until(f,()=>f.s.ids.some(id=>f.s.state(id).action==='walk'&&f.s.state(id).pose.gaitTime>1.5),45);const id=f.s.ids.find(id=>f.s.state(id).action==='walk'&&f.s.state(id).pose.gaitTime>1.5),cup=f.s.cups[id];assert.equal(cup.owner,'hand');assert(!f.s.humanMotion.free(id,'L'));assert(f.s.humanMotion.free(id,'R'));assert(cup.reachError<1e-3);assert(f.s.handGrips.rows.get(id).L.error<.003);assert.equal(f.s.handGrips.rows.get(id).L.relaxation,null);}finally{f.close();}
});
