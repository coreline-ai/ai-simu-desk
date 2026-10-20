import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Reservations} from '../../pilot-3d/activities/reservations.mjs';
import {Route} from '../../pilot-3d/activities/routes.mjs';
import {sofaAnchors,pointClear} from '../../pilot-3d/activities/anchors.mjs';
import {createRoomV6} from '../../pilot-3d/room-quality/model.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
import {applyPose,part,LEG} from '../../pilot-3d/sample/character-rig.mjs';

test('activity claims are atomic, fair to released callers and fully disposable',()=>{
 const r=new Reservations();assert(r.acquire('a',['sofa-left']));assert(!r.acquire('b',['walkway','sofa-left']));assert.deepEqual(r.snapshot(),{'sofa-left':'a'});r.release('a');assert(r.acquire('b',['walkway','sofa-left']));r.release('b');assert.deepEqual(r.snapshot(),{});r.acquire('a',['walkway']);r.clear();assert.deepEqual(r.snapshot(),{});
});
test('Nara destination route clears v6 furniture and reversed route stays continuous',()=>{
 const {root}=createRoomV6();try{const meta=root.userData,a=sofaAnchors(root,meta),actor=root.getObjectByName(meta.bindings.nara.actor),route=new Route(a.route);let previous=route.state(),seen=new Set();
 for(let t=0;t<route.duration+.025;t+=.025){route.time=Math.min(t,route.duration);const p=route.state(),world=[p.x+a.stationOrigin[0],0,p.z+a.stationOrigin[2]];assert(pointClear(world,a.colliders),JSON.stringify(world));assert(Math.hypot(p.x-previous.x,p.z-previous.z)<.02);applyPose(actor,p);for(const side of ['L','R']){const hip=part(actor,'NaraHip'+side).getWorldPosition(new T.Vector3()),foot=part(actor,'NaraFoot'+side).getWorldPosition(new T.Vector3());assert(hip.distanceTo(foot)<=LEG.upper+LEG.lower+.0002);}seen.add(p.action);previous=p;}
 assert(seen.has('walk')&&seen.has('turn'));route.time=route.duration*.57;const start=route.state(),back=new Route(route.reversePoints(),start.yaw);assert.equal(back.state().x,start.x);assert.equal(back.state().z,start.z);back.time=back.duration;assert(Math.hypot(back.state().x-a.route[0][0],back.state().z-a.route[0][2])<1e-8);
 }finally{releaseStudioAsset(root);}
});
test('route large dt cannot skip a corner or produce non-finite poses',()=>{
 const route=new Route([[0,0,0],[1,0,0],[1,0,1]]);route.tick(30);assert.equal(route.time,.06);for(let i=0;i<400;i++){route.tick(.06);const p=route.state();assert(Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite));}assert(route.done);
});
import {prepareSofa} from '../../pilot-3d/activities/model.mjs';
import {SofaScheduler} from '../../pilot-3d/activities/scheduler.mjs';
import {createSofaRuntime} from '../../pilot-3d/activities/runtime.mjs';
const ids=['nara','sora','jun','min','leo'];
const vm=pose=>({actors:ids.map(agentId=>({agentId,pose:agentId==='nara'?pose:'idle'})),motionPaused:false});
function sampleScheduler(){const {root}=createRoomV6();const seat=prepareSofa(root);return{root,s:new SofaScheduler(ids,sofaAnchors(root,root.userData,seat.seatBox))};}
function until(s,stage){for(let i=0;i<7000&&s.stage!==stage;i++)s.tick(.025);assert.equal(s.stage,stage);}
test('prepared sofa retains legs, frees left seat and has stable real surface bindings',()=>{
 const {root}=createRoomV6();try{const a=prepareSofa(root),b=prepareSofa(root);assert(Math.abs(a.seatBox.max.y-.48)<.001);assert.equal(a.seatBox.max.y,b.seatBox.max.y);assert.equal(root.getObjectByName('OchreLooseCushion').position.x,.63);const first=sofaAnchors(root,root.userData,a.seatBox),second=sofaAnchors(root,root.userData,a.seatBox);assert.deepEqual(first,second);assert.equal(root.getObjectByName('NaraStationAnchor').children.filter(n=>n.name==='SofaSeat').length,1);}finally{releaseStudioAsset(root);}
});
test('Nara completes a supported sofa round trip without discontinuities or over-reach',()=>{
 const {root,s}=sampleScheduler();try{s.setViewModel(vm('idle'));assert(s.startSofa());assert(!s.startSofa());let previous=null,stages=new Set();const actor=root.getObjectByName(root.userData.bindings.nara.actor);
 for(let i=0;i<2400;i++){s.tick(.025);stages.add(s.stage);const state=s.state('nara');if(state.pose){applyPose(actor,state.pose);const p=actor.getWorldPosition(new T.Vector3());if(previous)assert(p.distanceTo(previous)<.065,`${s.stage} ${p.distanceTo(previous)}`);previous=p;if(s.stage==='rest'){assert(Math.abs(p.z+2.78)<1e-5);for(const foot of root.userData.bindings.nara.feet){const f=root.getObjectByName(foot).getWorldPosition(new T.Vector3());assert(Math.abs(f.y-(.085+s.anchors.rug.top))<1e-5);}}}else previous=null;if(s.completed)break;}
 assert.equal(s.completed,1);assert.deepEqual(s.book.snapshot(),{});assert.equal(s.base.owner,null);for(const stage of ['stand','out','align','back','sit','rest','rise','forward','home','deskTurn','deskSit'])assert(stages.has(stage));
 }finally{s.dispose();releaseStudioAsset(root);}
});
test('work interrupts every sofa segment, returns through safe path and preserves actual work pose',()=>{
 for(const stage of ['queued','stand','out','align','back','sit','rest','rise','forward','home','deskTurn','deskSit']){const {root,s}=sampleScheduler();try{s.setViewModel(vm('idle'));s.startSofa();if(stage!=='queued')until(s,stage);s.setViewModel(vm('typing'));until(s,'idle');s.tick(.025);assert.equal(s.state('nara').action,'typing',stage);assert.deepEqual(s.book.snapshot(),{});assert.notEqual(s.base.owner,'nara-sofa');}finally{s.dispose();releaseStudioAsset(root);}}
});
test('blocked seat times out atomically, paused motion preserves claims, disposal releases all',()=>{
 const {root,s}=sampleScheduler();try{s.setViewModel(vm('idle'));s.book.acquire('visitor',['sofa-left']);s.startSofa();until(s,'idle');assert(s.reason.includes('이용 불가'));assert.deepEqual(s.book.snapshot(),{'sofa-left':'visitor'});s.book.release('visitor');s.startSofa();until(s,'rest');s.setViewModel({...vm('idle'),motionPaused:true});const before=s.diagnostics();for(let i=0;i<100;i++)s.tick(.06);assert.deepEqual(s.diagnostics(),before);s.setViewModel({...vm('typing'),motionPaused:true});assert(s.returning);assert.equal(s.stage,'rest');s.setViewModel(vm('typing'));until(s,'idle');s.dispose();assert.deepEqual(s.book.snapshot(),{});}finally{releaseStudioAsset(root);}
});
test('runtime reload and long repeated sofa use stay finite without accumulating anchors',()=>{
 const {root}=createRoomV6();try{for(let run=0;run<2;run++){const runtime=createSofaRuntime(root,root.userData);runtime.setViewModel(vm('idle'));runtime.startDemo();for(let i=0;i<2000;i++)runtime.update(.025);assert.equal(runtime.diagnostics().sofa.completed,1);assert.equal(root.getObjectByName('NaraStationAnchor').children.filter(n=>n.name==='SofaSeat').length,1);runtime.dispose();}}finally{releaseStudioAsset(root);}
});
test('twenty sofa round trips reclaim all resources and stay deterministic across pauses',()=>{
 const {root,s}=sampleScheduler();try{s.setViewModel(vm('idle'));for(let trip=1;trip<=20;trip++){assert(s.startSofa());until(s,'rest');const frozen=s.pose();s.setViewModel({...vm('idle'),motionPaused:true});for(let i=0;i<10;i++)s.tick(.06);assert.deepEqual(s.pose(),frozen);s.setViewModel(vm('idle'));until(s,'idle');assert.equal(s.completed,trip);assert.deepEqual(s.book.snapshot(),{});}assert.equal(s.interruptions,0);}finally{s.dispose();releaseStudioAsset(root);}
});
test('sofa seat supports the hip and both soles contact the floor in rendered geometry',()=>{
 const {root}=createRoomV6();try{const runtime=createSofaRuntime(root,root.userData);runtime.setViewModel(vm('idle'));runtime.startDemo();for(let i=0;i<2000&&runtime.scheduler.stage!=='rest';i++)runtime.update(.025);assert.equal(runtime.scheduler.stage,'rest');root.updateMatrixWorld(true);const hip=new T.Box3().setFromObject(root.getObjectByName('Nara_TrousersHip'));assert(Math.abs(hip.min.y-.48)<.002);for(const side of ['L','R']){const sole=new T.Box3().setFromObject(root.getObjectByName('Nara_Sole'+side));const rugTop=runtime.scheduler.anchors.rug.top;assert(sole.min.y-rugTop>=-.001&&sole.min.y-rugTop<.004);}runtime.dispose();}finally{releaseStudioAsset(root);}
});
test('work arriving mid-stride settles feet continuously before reversing',()=>{
 const {root,s}=sampleScheduler();try{s.setViewModel(vm('idle'));s.startSofa();until(s,'out');while(s.route.time<1.55)s.tick(.025);let before=s.state('nara').pose.feet.map(f=>f.position);s.setViewModel(vm('typing'));let sawSettle=false;const actor=root.getObjectByName(root.userData.bindings.nara.actor);
 for(let i=0;i<300;i++){s.tick(.025);const pose=s.state('nara').pose;assert(pose);applyPose(actor,pose);if(s.stage==='settle')sawSettle=true;for(let foot=0;foot<2;foot++){assert(new T.Vector3(...pose.feet[foot].position).distanceTo(new T.Vector3(...before[foot]))<.09); }before=pose.feet.map(f=>f.position);if(sawSettle&&s.stage==='home'&&s.route.time>.5)break;}
 assert(sawSettle);until(s,'idle');s.tick(.025);assert.equal(s.state('nara').action,'typing');assert.deepEqual(s.book.snapshot(),{});
 }finally{s.dispose();releaseStudioAsset(root);}
});
