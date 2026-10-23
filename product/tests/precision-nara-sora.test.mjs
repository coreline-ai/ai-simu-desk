import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {fixture, until, step} from './living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';

const IDS=['nara','sora'], V=(...a)=>new T.Vector3(...a), evidence=[];
const options={personalMotion:true};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const triangles=new WeakMap();
const grounds=new WeakMap();
const groundMeshes=new Set();
function geometryTriangles(geometry){
 if(triangles.has(geometry))return triangles.get(geometry);
 const position=geometry.attributes.position,index=geometry.index,rows=[];
 for(let i=0;i<(index?.count??position.count);i+=3){const triangle=new T.Triangle();for(const [key,offset]of [['a',0],['b',1],['c',2]])triangle[key].fromBufferAttribute(position,index?index.getX(i+offset):i+offset);rows.push(triangle);}
 triangles.set(geometry,rows);return rows;
}

// Static actual floor/rug triangles are indexed in X/Z cells. A vertical
// triangle intersection is an independent geometry oracle, not a duplicate of
// the production route's metadata/foot-height formula.
function groundSurface(root){
 if(grounds.has(root))return grounds.get(root);
 root.updateWorldMatrix(true,true);
 const meshes=['RoomFloor','WovenRug','MeetingWovenRug','WorkWoolRug'].map(name=>root.getObjectByName(name)).filter(mesh=>mesh?.isMesh);
 assert(meshes.some(mesh=>mesh.name==='RoomFloor'),'actual RoomFloor exists');
 for(const mesh of meshes)groundMeshes.add(mesh.name);
 const cells=new Map(),size=.3;
 for(const mesh of meshes)for(const tri of geometryTriangles(mesh.geometry)){
  const [a,b,c]=[tri.a,tri.b,tri.c].map(p=>p.clone().applyMatrix4(mesh.matrixWorld)),den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
  if(Math.abs(den)<1e-12)continue;
  const row={mesh:mesh.name,a:a.toArray(),b:b.toArray(),c:c.toArray(),den,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
  for(let x=Math.floor(row.minX/size);x<=Math.floor(row.maxX/size);x++)for(let z=Math.floor(row.minZ/size);z<=Math.floor(row.maxZ/size);z++){const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(row);}
 }
 function at(x,z){
  let height=-Infinity,mesh;
  for(const row of cells.get(Math.floor(x/size)+':'+Math.floor(z/size))??[]){
   if(x<row.minX-1e-10||x>row.maxX+1e-10||z<row.minZ-1e-10||z>row.maxZ+1e-10)continue;
   const {a,b,c,den}=row,u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
   if(u< -1e-10||v< -1e-10||u+v>1+1e-10)continue;
   const y=u*a[1]+v*b[1]+(1-u-v)*c[1];if(y>height){height=y;mesh=row.mesh;}
  }
  assert(Number.isFinite(height),'actual floor/rug under sole '+x+','+z);return {height,mesh};
 }
 // Check this accelerated oracle against Three's actual ray intersections,
 // including points on each rug, before using it for full sole-vertex scans.
 const ray=new T.Raycaster(V(),V(0,-1,0),0,10);
 for(const mesh of meshes){const box=new T.Box3().setFromObject(mesh);for(const u of [.25,.5,.75])for(const v of [.25,.5,.75]){
  const x=T.MathUtils.lerp(box.min.x,box.max.x,u),z=T.MathUtils.lerp(box.min.z,box.max.z,v);ray.set(V(x,5,z),V(0,-1,0));const hit=ray.intersectObjects(meshes,false)[0];if(hit)assert(Math.abs(at(x,z).height-hit.point.y)<1e-6,'independent triangle oracle agrees with actual raycast');
 }}
 const result={at,meshes:meshes.map(mesh=>mesh.name)};grounds.set(root,result);return result;
}

// Measurements below read the final posed geometry, rather than comparing a
// solver's advertised error to a second invocation of that same solver.
function surfaceDistance(point,root){
 let distance=Infinity;
 root.traverse(mesh=>{
  if(!mesh.geometry||mesh.isInstancedMesh||mesh.isSkinnedMesh)return;
  mesh.updateWorldMatrix(true,false);
  const local=point.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
  for(const triangle of geometryTriangles(mesh.geometry)){
   const closest=triangle.closestPointToPoint(local,V());
   // Lathe pole triangles can be degenerate. They are not a rendered surface.
   if(closest.toArray().every(Number.isFinite))distance=Math.min(distance,point.distanceTo(closest.applyMatrix4(mesh.matrixWorld)));
  }
 });
 assert(Number.isFinite(distance),'measurable rendered prop surface');return distance;
}
function meter(f,id,scenario){
 const actor=f.s.desks[id].actor,base={};
 const ground=groundSurface(f.root);
 const row={id,scenario,frames:0,actions:new Set(),tripStages:new Set(),personalPhases:new Set(),routePhases:new Set(),maxLimbDrift:0,minSoleY:Infinity,maxPlantedSoleHeight:0,minSignedGroundGap:Infinity,maxPlantedGroundGap:-Infinity,plantedSamples:0,groundSurfaces:new Set(),maxFingerJointGap:0,maxFingerLengthDrift:0,contacts:{},maxSupportError:0};
 for(const side of ['L','R']){
  base[side]={upper:part(actor,'NaraElbow'+side).position.length(),lower:part(actor,'NaraHand'+side).position.length()};
 }
 evidence.push(row);
 function sample(){
  row.frames++;actor.updateWorldMatrix(true,true);const state=f.s.state(id),trip=f.s.getRecord(id)?.trip,personal=f.s.personalMotion.rows.get(id);
  row.actions.add(state.action);if(trip)row.tripStages.add(trip.stage);if(personal)row.personalPhases.add(personal.phase);if(state.pose?.ensemblePhase)row.routePhases.add(state.pose.ensemblePhase);
  for(const [sideIndex,side]of ['L','R'].entries()){
   const shoulder=part(actor,'NaraShoulder'+side).getWorldPosition(V()),elbow=part(actor,'NaraElbow'+side).getWorldPosition(V()),hand=part(actor,'NaraHand'+side).getWorldPosition(V()),hip=part(actor,'NaraHip'+side).getWorldPosition(V()),knee=part(actor,'NaraKnee'+side).getWorldPosition(V()),foot=part(actor,'NaraFoot'+side).getWorldPosition(V());
   for(const [actual,expected] of [[shoulder.distanceTo(elbow),base[side].upper],[elbow.distanceTo(hand),base[side].lower],[hip.distanceTo(knee),.37],[knee.distanceTo(foot),.405]]){const error=Math.abs(actual-expected);row.maxLimbDrift=Math.max(row.maxLimbDrift,error);assert(error<2e-6,id+' fixed arm/leg length '+error);}
   if(state.pose?.feet?.[sideIndex])assert(foot.distanceTo(actor.parent.localToWorld(V(...state.pose.feet[sideIndex].position)))<2e-6,id+' final foot retains route target');
   const sole=part(actor,'Sole'+side),positions=sole.geometry.attributes.position;let minSoleY=Infinity,minGap=Infinity;
   // Every final sole vertex is checked. A sole can span a rug edge: testing
   // only its world-lowest points misses valid support or other penetration.
   for(let i=0;i<positions.count;i++){
    const point=V().fromBufferAttribute(positions,i).applyMatrix4(sole.matrixWorld),surface=ground.at(point.x,point.z),gap=point.y-surface.height;
    row.minSoleY=Math.min(row.minSoleY,point.y);minSoleY=Math.min(minSoleY,point.y);minGap=Math.min(minGap,gap);row.minSignedGroundGap=Math.min(row.minSignedGroundGap,gap);row.groundSurfaces.add(surface.mesh);
    assert(gap>-.0001,id+' actual sole penetrates '+surface.mesh+': '+gap+' in '+state.action+'/'+trip?.stage);
   }
   if(state.pose?.feet?.[sideIndex]?.planted){row.plantedSamples++;row.maxPlantedSoleHeight=Math.max(row.maxPlantedSoleHeight,minSoleY);row.maxPlantedGroundGap=Math.max(row.maxPlantedGroundGap,minGap);assert(minGap<.003,id+' planted sole must meet actual floor/rug, not float: '+minGap+' in '+state.action+'/'+trip?.stage);}
   const grip=f.s.handGrips.rows.get(id)[side];
   for(const [fingerIndex,finger] of grip.fingers.entries()){
    let end=finger.base.clone();
    for(let segment=0;segment<2;segment++){
     const matrix=new T.Matrix4();grip.batch.getMatrixAt(fingerIndex*2+segment,matrix);
     const from=V(0,-.033/2,0).applyMatrix4(matrix),to=V(0,.033/2,0).applyMatrix4(matrix);
     row.maxFingerJointGap=Math.max(row.maxFingerJointGap,end.distanceTo(from));
     row.maxFingerLengthDrift=Math.max(row.maxFingerLengthDrift,Math.abs(from.distanceTo(to)-finger.lengths[segment]));
     assert(end.distanceTo(from)<1e-7,id+' rendered finger joint remains connected');
     assert(Math.abs(from.distanceTo(to)-finger.lengths[segment])<1e-7,id+' rendered phalanx never stretches');end=to;
    }
    assert(end.distanceTo(finger.pad.position)<1e-7,id+' rendered fingertip reaches actual pad');
   }
  }
  for(const collection of [f.s.sofaSupport.diagnostics(),f.s.meetingSupport.diagnostics()])for(const hand of Object.values(collection[id]?.hands??{})){row.maxSupportError=Math.max(row.maxSupportError,hand.error);assert(hand.error<1e-5,id+' furniture support remains reachable');if(hand.planted)assert(Math.abs(hand.palmGap)<.003,id+' supported palm gap');}
  assert.deepEqual(f.s.violations,[]);
 }
 function contacts(side,prop,kind,limit=.003){
  const grip=f.s.handGrips.rows.get(id)[side];if(grip.blend<.995)return;
  const r=row.contacts[kind]??={samples:0,maxSurfaceDistance:0};
  for(const finger of grip.fingers){const distance=surfaceDistance(finger.pad.getWorldPosition(V()),prop);r.samples++;r.maxSurfaceDistance=Math.max(r.maxSurfaceDistance,distance);assert(distance<limit,id+'/'+side+'/'+kind+' fingertip must meet visible prop surface: '+distance);}
 }
 return{row,sample,contacts};
}
function work(f,id,pose='typing'){f.vm.actors.find(a=>a.agentId===id).pose=pose;f.runtime.setViewModel(f.vm);}
function neutral(f,id){work(f,id,'idle');}
function clean(f){f.s.cancelAll();until(f,()=>!f.s.records.size&&!f.s.visit&&!f.s.session&&!f.s.sofaPair&&!f.s.coffee.rows.size&&!f.s.transfer.active&&f.s.ids.every(id=>!f.s.desks[id].busy&&f.s.cups[id].state==='idle'&&!f.s.cupSupport.controls(id)),700);assert.deepEqual(f.s.book.snapshot(),{});assert.deepEqual(f.s.violations,[]);for(const id of IDS){assert.equal(f.s.cups[id].owner,'desk');assert.equal(f.s.desks[id].owner,'desk');}assert(f.s.transfer.diagnostics().pages.every(p=>p.owner.startsWith('desk:')));}

for(const id of IDS)test(id+' precision: sofa and window transitions, walking, turns and all three rest variants',()=>{
 const f=fixture(options);try{
  for(const activity of ['sofa','window'])for(let variant=0;variant<3;variant++){
   f.s.variants.set(id,variant);const m=meter(f,id,activity+'-variant-'+variant);assert(activity==='sofa'?f.s.startSofa(id):f.s.startWindow(id));
   until(f,()=>f.s.idle(id),300,m.sample);
   for(const stage of ['stand','out','align','rest','home','deskTurn','deskSit'])assert(m.row.tripStages.has(stage),id+'/'+activity+' covers '+stage);
   if(activity==='sofa')for(const stage of ['sit','rise'])assert(m.row.tripStages.has(stage),id+' covers sofa '+stage);
   assert(m.row.actions.has('walk'),id+' walked');assert(m.row.actions.has('turn'),id+' turned');clean(f);
  }
 }finally{f.close();}
});

for(const id of IDS)test(id+' precision: three personal rest styles and every sofa transition interruption return safely',()=>{
 const f=fixture(options);try{
  const styles=new Set();for(let variant=0;variant<3;variant++){
   const m=meter(f,id,'personal-rest-'+variant);assert(f.s.startRest(id));styles.add(f.s.records.get(id).style);until(f,()=>!f.s.records.has(id),300,m.sample);clean(f);
  }assert.equal(styles.size,3,id+' all three personal rest styles');
  for(const stage of ['stand','sit','rest','rise','deskSit']){
   const m=meter(f,id,'sofa-work-interrupt-'+stage);assert(f.s.startSofa(id));until(f,()=>f.s.records.get(id)?.trip.stage===stage,300,m.sample);step(f,.15);work(f,id);until(f,()=>!f.s.records.has(id),350,m.sample);neutral(f,id);clean(f);
  }
 }finally{f.close();}
});

for(const id of IDS)test(id+' precision: three role prop recipes contact visible pen and recover every stage',()=>{
 const f=fixture(options);try{
  for(let variant=0;variant<3;variant++){
   const d=f.s.desks[id],m=meter(f,id,'role-variant-'+variant),phases=new Set(),stages=new Set();assert(d.start({variant}));
   until(f,()=>!d.busy,25,()=>{m.sample();stages.add(d.stage);if(d.stage==='use'){phases.add(d.recipe().phase);if(d.time>.9&&m.row.frames%8===0)m.contacts('R',d.prop,'pen');}});
   assert.deepEqual([...phases].sort(),['act','check','observe','pause']);assert(m.row.contacts.pen?.samples>=5);assert.equal(d.owner,'desk');
   for(const stage of ['reach','grasp','use','replace','release','retract'])assert(stages.has(stage));
  }
  for(const stage of ['reach','grasp','use','replace','release','retract']){
   const d=f.s.desks[id],m=meter(f,id,'role-work-interrupt-'+stage);assert(d.start({variant:1}));until(f,()=>d.stage===stage,25,m.sample);work(f,id,'error');until(f,()=>!d.busy,25,m.sample);assert.equal(d.owner,'desk');neutral(f,id);
  }
  clean(f);
 }finally{f.close();}
});

for(const id of IDS)test(id+' precision: cup has five real handle pads and safely yields during all drink stages',()=>{
 const f=fixture(options);try{
  const c=f.s.cups[id],m=meter(f,id,'drink'),stages=new Set();assert(f.s.startCup(id));
  until(f,()=>!f.s.records.has(id),35,()=>{m.sample();stages.add(c.state);if(c.owner==='hand'&&m.row.frames%8===0)m.contacts('L',c.mug,'cup-handle');});
  assert(m.row.contacts['cup-handle']?.samples>=5);
  for(const stage of ['reach','grasp','lift','sip','lower','place','release']){
   const interrupted=meter(f,id,'cup-work-interrupt-'+stage);assert(stages.has(stage));until(f,()=>f.s.idle(id),20);assert(f.s.startCup(id));until(f,()=>c.state===stage,30,interrupted.sample);work(f,id);until(f,()=>!f.s.records.has(id)&&!f.s.cupSupport.controls(id),40,interrupted.sample);assert.equal(c.owner,'desk');neutral(f,id);
  }clean(f);
 }finally{f.close();}
});

for(const id of IDS)test(id+' precision: purposeful coffee outbound, turn, machine, return and every interruption',()=>{
 const f=fixture(options);try{
  const c=f.s.cups[id],m=meter(f,id,'coffee'),phases=new Set(),walks=new Set();assert(f.s.startCoffee(id));
  until(f,()=>!f.s.coffee.rows.has(id),400,()=>{m.sample();const r=f.s.coffee.rows.get(id);if(!r)return;phases.add(r.phase);if(f.s.state(id).action==='walk')walks.add(r.phase);if(c.owner==='hand'&&c.state==='carry'){
   const up=V(0,1,0).applyQuaternion(c.mug.getWorldQuaternion(new T.Quaternion()));assert(up.y>.999,id+' purposeful carry stays upright');if(m.row.frames%12===0)m.contacts('L',c.mug,'carried-cup');
  }});
  for(const phase of ['pickup','out','brew','retrieve','home'])assert(phases.has(phase));assert(walks.has('out')&&walks.has('home'));assert(m.row.contacts['carried-cup']?.samples>=5);clean(f);
  for(const phase of ['pickup','out','brew','retrieve','home']){
   const interrupted=meter(f,id,'coffee-work-interrupt-'+phase);assert(f.s.startCoffee(id));until(f,()=>f.s.coffee.rows.get(id)?.phase===phase,400,interrupted.sample);step(f,.1);work(f,id);until(f,()=>!f.s.coffee.rows.has(id),400,interrupted.sample);assert.equal(c.owner,'desk');assert.equal(c.state,'idle');assert.equal(f.s.coffee.history.at(-1).status,'cancelled');neutral(f,id);clean(f);
  }
 }finally{f.close();}
});

test('Nara and Sora precision: both seat orders keep meetings empty handed, speak/listen and release support',()=>{
 const f=fixture(options);try{
  for(const ids of [IDS,[...IDS].reverse()])for(const kind of ['meeting','sofaPair']){
   const meters=ids.map(id=>meter(f,id,kind+'-'+ids.join('-'))),mugs=new Map(ids.map(id=>[id,f.s.cups[id].mug.getWorldPosition(V())]));
   assert(kind==='meeting'?f.s.startMeeting(ids):f.s.startSofaPair(ids));
   until(f,()=>kind==='meeting'?!f.s.session:!f.s.sofaPair,500,()=>{for(const m of meters){m.sample();const c=f.s.cups[m.row.id];assert.equal(c.owner,'desk');assert(c.mug.getWorldPosition(V()).distanceTo(mugs.get(m.row.id))<1e-7);}});
   for(const m of meters){assert(m.row.actions.has(kind==='meeting'?'meeting_talk':'sofa_talk'),m.row.id+' speaks');assert(m.row.actions.has(kind==='meeting'?'meeting_listen':'sofa_listen'),m.row.id+' listens');}clean(f);
  }
  for(const id of IDS){assert(f.s.startMeeting(IDS));until(f,()=>f.s.session?.phase==='discussion',400);work(f,id);until(f,()=>!f.s.session,400);neutral(f,id);clean(f);}
  assert.equal(f.s.sofaSupport.rows.size,0);assert.equal(f.s.meetingSupport.rows.size,0);
 }finally{f.close();}
});

test('Nara and Sora precision: both document directions keep visible page contact, single owner and all-stage work return',()=>{
 const f=fixture(options);try{
  for(const [visitor,host] of [IDS,[...IDS].reverse()]){
   const meters=IDS.map(id=>meter(f,id,'document-'+visitor+'-to-'+host)),stages=new Set();assert(f.s.startVisit(visitor,host,{transfer:true}));
   until(f,()=>!f.s.visit,400,()=>{for(const m of meters)m.sample();const x=f.s.transfer;if(!x.active)return;stages.add(x.stage);assert.equal(x.page.mesh.parent,x.page.owner.startsWith('hand:')?part(f.s.desks[x.page.owner.slice(5)].actor,'NaraHand'+x.sides[x.page.owner.slice(5)]):f.root,'page parent agrees with its single owner');for(const m of meters){const ctrl=x.controls(m.row.id);if(ctrl?.blend>.995&&m.row.frames%8===0)m.contacts(ctrl.side,x.page.mesh,'page',.003);}});
   for(const stage of ['pickup','grasp','present','receive','accept','read','giveback','regrasp','return','release'])assert(stages.has(stage));assert.equal(f.s.transfer.transfers,2);assert(f.s.visitHistory.at(-1).transferComplete);for(const m of meters)assert(m.row.contacts.page?.samples>=5,m.row.id+' actually gripped a rendered page');clean(f);
  }
  for(const [index,stage]of ['pickup','grasp','present','receive','accept','read','giveback','regrasp','return','release'].entries()){
   const id=IDS[index%2],host=IDS.find(x=>f.s.transfer.available(x))??f.s.ids.find(x=>f.s.transfer.available(x)),visitor=IDS.find(x=>x!==host)??'sora';
   const m=meter(f,id,'document-work-interrupt-'+stage);assert(f.s.startVisit(visitor,host,{transfer:true}));until(f,()=>f.s.transfer.active&&f.s.transfer.stage===stage,400,m.sample);work(f,id);until(f,()=>!f.s.visit,400,m.sample);neutral(f,id);clean(f);
  }
  assert(f.s.transfer.diagnostics().pages.every(p=>Math.abs(p.supportGap-.0005)<1e-5));
 }finally{f.close();}
});

after(async()=>{
 if(!process.env.MOTION_PRECISION_EVIDENCE)return;
 await tick();const target=path.resolve(process.env.MOTION_PRECISION_EVIDENCE);fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,JSON.stringify({scope:'Nara and Sora; in-memory final scene geometry; no database or browser',groundScope:'all final sole vertices against actual existing floor/rug triangles; accelerated intersection oracle checked against raycast',groundMeshes:[...groundMeshes],measuredAt:new Date().toISOString(),physicalSkinGuarantee:false,measurements:evidence.map(r=>({...r,actions:[...r.actions],tripStages:[...r.tripStages],personalPhases:[...r.personalPhases],routePhases:[...r.routePhases],groundSurfaces:[...r.groundSurfaces]}))},null,2)+'\n');
});
