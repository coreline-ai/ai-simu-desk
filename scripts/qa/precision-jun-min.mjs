import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import * as T from 'three';
import {fixture,until,step} from '../../product/tests/living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';

const V=(...p)=>new T.Vector3(...p),IDS=['jun','min'],SIDES=['L','R'];
const sourceRoot=fileURLToPath(new URL('../../',import.meta.url));
const sourceFiles=['pilot-3d/personal-office/motion.mjs','pilot-3d/personal-office/glasses.mjs','pilot-3d/personal-office/recipes.mjs','pilot-3d/personal-office/sole-contact.mjs','pilot-3d/personal-office/terrain-contact.mjs','pilot-3d/personal-office/carry.mjs','pilot-3d/personal-office/daily.mjs','pilot-3d/activities/grounded-route.mjs','pilot-3d/activities/team-runtime.mjs','pilot-3d/activities/interactions.mjs','pilot-3d/activities/hand-grips.mjs','pilot-3d/activities/desk-actions.mjs','pilot-3d/living-office/human-motion.mjs','pilot-3d/living-office/cup-support.mjs','pilot-3d/ensemble-office/coffee.mjs','pilot-3d/activities/prop-transfer.mjs'];
export async function fingerprints(){return Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(sourceRoot,file))).digest('hex')])));}
function withFixture(fn){const f=fixture({personalMotion:true});try{return fn(f);}finally{f.close();}}
const actor=(f,id)=>f.s.desks[id].actor;
function lengths(a){return Object.fromEntries(SIDES.flatMap(side=>[['upperArm',part(a,'NaraShoulder'+side),part(a,'NaraElbow'+side)],['forearm',part(a,'NaraElbow'+side),part(a,'NaraHand'+side)],['thigh',part(a,'NaraHip'+side),part(a,'NaraKnee'+side)],['shin',part(a,'NaraKnee'+side),part(a,'NaraFoot'+side)]].map(([name,from,to])=>[side+name,from.getWorldPosition(V()).distanceTo(to.getWorldPosition(V()))])));}
function verifyLengths(a,baseline){for(const [name,value]of Object.entries(lengths(a)))assert(Math.abs(value-baseline[name])<1e-6,name+' is fixed length');}
function ready(f){f.s.setAuto(false);f.s.cancelAll();f.vm.actors=f.s.ids.map(agentId=>({agentId,pose:'idle'}));f.runtime.setViewModel(f.vm);until(f,()=>f.s.ids.every(id=>f.s.idle(id)),600);step(f,2);assert.deepEqual(f.s.book.snapshot(),{});}
function work(f,id,pose='typing'){f.vm.actors=f.s.ids.map(agentId=>({agentId,pose:agentId===id?pose:'idle',cue:'precision-'+id+'-'+pose}));f.runtime.setViewModel(f.vm);}

// Independent actual-triangle distance. World scale is included in the result;
// unlike solver diagnostics, this does not reuse its authored contact targets.
function distance(mesh,point){
 const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,matrix=mesh.getMatrixWorld?.()??mesh.matrixWorld;let best=Infinity;
 const a=V(),b=V(),c=V(),q=V(),triangle=new T.Triangle(a,b,c);
 for(let i=0;i<(index?.count??positions.count);i+=3){a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(matrix);c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(matrix);triangle.closestPointToPoint(point,q);best=Math.min(best,q.distanceTo(point));}
 return best;
}
function geometryPart(root,name){
 let match=root.getObjectByName(name);if(match?.geometry)return match;
 root.traverse(node=>{const index=node.userData.parts?.indexOf(name)??-1;if(!match&&node.isInstancedMesh&&index>=0)match={node,index};});
 assert(match,'actual geometry part '+name);const {node,index}=match;
 function matrix(){node.updateWorldMatrix(true,false);const m=new T.Matrix4();node.getMatrixAt(index,m);return node.matrixWorld.clone().multiply(m);}
 return{geometry:node.geometry,sourceNode:node.name,instance:index,getMatrixWorld:matrix,worldToLocal(p){return p.applyMatrix4(matrix().invert());},localToWorld(p){return p.applyMatrix4(matrix());}};
}
function actualVertices(mesh,instance){const transform=mesh.matrixWorld.clone();if(instance!==undefined){const m=new T.Matrix4();mesh.getMatrixAt(instance,m);transform.multiply(m);}const p=mesh.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>V().fromBufferAttribute(p,i).applyMatrix4(transform));}
function fingerSurfaceGap(hand,indices,target){let gap=Infinity;for(const index of indices)for(const p of actualVertices(hand.batch,index))gap=Math.min(gap,distance(target,p));return gap;}
const groundCache=new WeakMap();
function actualGround(root,point){
 let row=groundCache.get(root);
 if(!row){
  const meshes=['RoomFloor','WovenRug','MeetingWovenRug'].map(name=>root.getObjectByName(name));assert(meshes.every(m=>m?.isMesh),'actual floor and final-office rugs');
  // The expanded v9 office replaces the older WorkWoolRug zone. Include it
  // when the inspected asset has it; do not require a mesh absent from v9.
  const workRug=root.getObjectByName('WorkWoolRug');if(workRug){assert(workRug.isMesh,'actual work rug geometry');meshes.push(workRug);}
  row={meshes,ray:new T.Raycaster(),cache:new Map()};groundCache.set(root,row);
 }
 const key=point.x.toFixed(7)+':'+point.z.toFixed(7);
 if(!row.cache.has(key)){row.ray.set(V(point.x,5,point.z),V(0,-1,0));const hit=row.ray.intersectObjects(row.meshes,false)[0];assert(hit,'actual ground below sole');row.cache.set(key,{height:hit.point.y,mesh:hit.object.name});}
 return row.cache.get(key);
}


function postureRoutes(){return withFixture(f=>{
 const result={};
 for(const id of IDS){const a=actor(f,id),baseline=lengths(a),row={stages:[],actions:[],maxPelvisStep:0,maxTorsoTurn:0,maxFootTargetError:0,minSoleY:Infinity,plantedSamples:0,maxPlantedGroundGap:-Infinity,minPlantedGroundGap:Infinity},stages=new Set(),actions=new Set();let previous=null;
  for(const destination of ['sofa','window']){
   assert(destination==='sofa'?f.s.startSofa(id):f.s.startWindow(id));
   until(f,()=>f.s.idle(id),400,()=>{
    const record=f.s.getRecord(id),state=f.s.state(id),prepared=f.s.personalMotion.prepare(id,state),pelvis=part(a,'NaraPelvis').getWorldPosition(V()),torso=part(a,'NaraTorso').getWorldQuaternion(new T.Quaternion());stages.add(record?.trip?.stage??'idle');actions.add(state.action);verifyLengths(a,baseline);
    if(previous){row.maxPelvisStep=Math.max(row.maxPelvisStep,pelvis.distanceTo(previous.p));row.maxTorsoTurn=Math.max(row.maxTorsoTurn,torso.angleTo(previous.q));}previous={p:pelvis,q:torso};
    SIDES.forEach((side,i)=>{
     if(prepared.pose?.feet?.[i]){const actual=part(a,'NaraFoot'+side).getWorldPosition(V()),wanted=a.parent.localToWorld(V(...prepared.pose.feet[i].position));row.maxFootTargetError=Math.max(row.maxFootTargetError,actual.distanceTo(wanted));}
     const points=actualVertices(part(a,'Sole'+side)),bottom=Math.min(...points.map(p=>p.y));row.minSoleY=Math.min(row.minSoleY,bottom);
     if(prepared.pose?.feet?.[i]?.planted){let gap=Infinity;for(const p of points)gap=Math.min(gap,p.y-actualGround(f.root,p).height);row.plantedSamples++;row.maxPlantedGroundGap=Math.max(row.maxPlantedGroundGap,gap);row.minPlantedGroundGap=Math.min(row.minPlantedGroundGap,gap);assert(gap>-.0001&&gap<.003,id+' actual planted sole/ground gap '+gap+' at '+record?.trip?.stage);}
    });
   });
   assert.deepEqual(f.s.book.snapshot(),{});previous=null;
  }
  for(const stage of ['stand','out','align','sit','rest','rise','home','deskSit'])assert(stages.has(stage),id+' '+stage);
  assert(row.maxPelvisStep<.06,id+' pelvis continuity');assert(row.maxTorsoTurn<.24,id+' torso continuity');assert(row.maxFootTargetError<1e-6);assert(row.minSoleY>-.0001,id+' actual sole below floor');
  assert(f.s.startSofa(id));until(f,()=>f.s.getRecord(id)?.trip?.stage==='sit',300);step(f,.5);work(f,id);until(f,()=>!f.s.getRecord(id),300);assert.equal(f.s.cups[id].owner,'desk');ready(f);
  row.stages=[...stages];row.actions=[...actions];row.groundMeshes=groundCache.get(f.root)?.meshes.map(m=>m.name)??[];result[id]=row;
 }
 assert.deepEqual(f.s.violations,[]);return result;
});}

function listening(){return withFixture(f=>{
 const homes=Object.fromEntries(IDS.map(id=>[id,f.s.cups[id].mug.getWorldPosition(V())])),baseline=Object.fromEntries(IDS.map(id=>[id,lengths(actor(f,id))])),result=Object.fromEntries(IDS.map(id=>[id,{listeningFrames:0,quietFrames:0,nodPeak:0,palmSamples:0,minPalmGap:Infinity,maxPalmGap:-Infinity}]));
 assert(f.s.startMeeting(IDS));until(f,()=>f.s.session?.phase==='discussion',400);
 until(f,()=>!f.s.session,500,()=>{for(const id of IDS){const a=actor(f,id),row=result[id],personal=f.s.personalMotion.rows.get(id),cup=f.s.cups[id];verifyLengths(a,baseline[id]);assert.equal(cup.state,'idle');assert.equal(cup.owner,'desk');assert(cup.mug.getWorldPosition(V()).distanceTo(homes[id])<1e-6);
  if(personal?.phase==='listen'){row.listeningFrames++;row.nodPeak=Math.max(row.nodPeak,personal.pitch);if(Math.abs(personal.pitch)<1e-9)row.quietFrames++;}
  const support=f.s.meetingSupport.rows.get(id);for(const [side,h]of Object.entries(support?.hands??{}))if(h.planted){const mesh=f.root.getObjectByName(h.object),palm=part(a,'NaraHand'+side).getObjectByName('ContinuousHand'+side).children[0],lowest=actualVertices(palm).sort((p,q)=>p.y-q.y)[0],gap=distance(mesh,lowest);row.palmSamples++;row.minPalmGap=Math.min(row.minPalmGap,gap);row.maxPalmGap=Math.max(row.maxPalmGap,gap);assert(gap<.0035,id+' actual palm supported by table');}
 }});
 for(const id of IDS){assert(result[id].listeningFrames>20);assert(result[id].quietFrames>result[id].listeningFrames*.3);assert(result[id].nodPeak>.015);assert(result[id].palmSamples>20);}
 assert.deepEqual(f.s.book.snapshot(),{});return result;
});}

function roles(){return withFixture(f=>{
 const result={};for(const id of IDS){const a=actor(f,id),baseline=lengths(a);result[id]=[];for(let variant=0;variant<3;variant++){
  const d=f.s.desks[id],r={variant,phases:[],samples:0,maxTipError:0,maxGripError:0,holdSamples:0,maxHeldStep:0,minTipSurfaceDistance:Infinity,maxTipSurfaceDistance:0},phases=new Set();let previous=null;
  assert(f.s.startRole(id,{variant}));until(f,()=>!d.busy,30,()=>{verifyLengths(a,baseline);if(d.stage!=='use'||d.time<1)return;const phase=d.recipe().phase;phases.add(phase);const p=d.hand.getWorldPosition(V());r.samples++;r.maxTipError=Math.max(r.maxTipError,d.tipError);r.maxGripError=Math.max(r.maxGripError,f.s.handGrips.rows.get(id).R.error);if(previous?.phase===phase&&phase!=='act'){r.holdSamples++;r.maxHeldStep=Math.max(r.maxHeldStep,p.distanceTo(previous.p));}previous={p,phase};if(id==='min'){const tip=d.prop.localToWorld(V(0,-d.half,0)),gap=distance(d.surface,tip);r.minTipSurfaceDistance=Math.min(r.minTipSurfaceDistance,gap);r.maxTipSurfaceDistance=Math.max(r.maxTipSurfaceDistance,gap);}});
  for(const phase of ['act','pause','check'])assert(phases.has(phase),id+' role phase '+phase);assert(r.samples>30);assert(r.maxTipError<1e-5);assert(r.maxGripError<1e-5);assert(r.holdSamples>10);assert(r.maxHeldStep<.005,id+' held work trajectory');assert.equal(d.owner,'desk');r.phases=[...phases];result[id].push(r);
 }
 // Interrupt each ownership phase, rather than rechecking the recipe formulas.
 for(const stage of ['reach','grasp','use','replace','release','retract']){const d=f.s.desks[id];assert(f.s.startRole(id));until(f,()=>d.stage===stage,20);work(f,id);until(f,()=>!d.busy,20);assert.equal(d.owner,'desk');f.vm.actors=f.s.ids.map(agentId=>({agentId,pose:'idle'}));f.runtime.setViewModel(f.vm);step(f,.1);}
 }assert.deepEqual(f.s.violations,[]);return result;
});}

function cupsAndCoffee(){return withFixture(f=>{
 const result={};for(const id of IDS){const a=actor(f,id),baseline=lengths(a),r={sipFrames:0,supportFrames:0,handleSamples:0,maxHandlePadGap:0,maxSupportPadGap:0,carryFrames:0,carryPhases:[],minUprightY:1,maxCarryStep:0},phases=new Set();result[id]=r;
  assert(f.s.startCup(id));until(f,()=>!f.s.records.has(id),40,()=>{verifyLengths(a,baseline);const c=f.s.cups[id],support=f.s.cupSupport.rows.get(id);if(c.state==='sip')r.sipFrames++;if(support?.blend>1-1e-9&&f.s.handGrips.rows.get(id).R.blend>1-1e-9){r.supportFrames++;assert.equal(c.owner,'hand');assert(!f.s.humanMotion.free(id,'L'));assert(!f.s.humanMotion.free(id,'R'));assert(support.error<1e-5);r.maxSupportPadGap=Math.max(r.maxSupportPadGap,f.s.handGrips.rows.get(id).R.error);}const hand=f.s.handGrips.rows.get(id).L;if(hand.blend>.995&&c.owner==='hand'){const handle=f.root.getObjectByName(a.userData.prefix+'MugHandle');for(let i=0;i<5;i++){const gap=distance(handle,hand.fingers[i].pad.getWorldPosition(V()));r.maxHandlePadGap=Math.max(r.maxHandlePadGap,gap);r.handleSamples++;assert(gap<.003,id+' actual mug handle contact');}}});assert(r.supportFrames>10);assert(r.maxSupportPadGap<1e-5);assert.equal(f.s.cups[id].owner,'desk');
  let last=null;assert(f.s.startCoffee(id));until(f,()=>!f.s.coffee.rows.has(id),500,()=>{const c=f.s.cups[id],row=f.s.coffee.rows.get(id);verifyLengths(a,baseline);if(!row||c.state!=='carry')return;phases.add(row.phase);const u=V(0,1,0).applyQuaternion(c.mug.getWorldQuaternion(new T.Quaternion())).y;r.minUprightY=Math.min(r.minUprightY,u);if(f.s.state(id).action==='walk'){r.carryFrames++;const p=c.mug.getWorldPosition(V());if(last&&f.s.time-last.t<.034)r.maxCarryStep=Math.max(r.maxCarryStep,p.distanceTo(last.p));last={p,t:f.s.time};assert(!f.s.humanMotion.free(id,'L'));assert(f.s.humanMotion.free(id,'R'));assert(f.s.handGrips.rows.get(id).L.error<1e-5);}});r.carryPhases=[...phases];assert(phases.has('out')&&phases.has('home'));assert(r.carryFrames>20);assert(r.minUprightY>.999);assert(r.maxCarryStep<.09);assert.equal(f.s.cups[id].owner,'desk');assert.equal(f.s.coffee.history.at(-1).status,'complete');assert.deepEqual(f.s.book.snapshot(),{});
  for(const phase of ['pickup','out','brew','retrieve','home']){assert(f.s.startCoffee(id));until(f,()=>f.s.coffee.rows.get(id)?.phase===phase,400);step(f,.1);work(f,id);until(f,()=>!f.s.coffee.rows.has(id),400);assert.equal(f.s.cups[id].owner,'desk');assert.equal(f.s.cups[id].state,'idle');assert.equal(f.s.coffee.history.at(-1).status,'cancelled');ready(f);}
 }assert.deepEqual(f.s.violations,[]);return result;
});}

function glassesGeometry(){return withFixture(f=>{
 const g=f.s.personalMotion.glasses,a=g.actor,hand=f.s.handGrips.rows.get('jun').R,faces=['Jun_Face','Jun_Ear-1','Jun_Ear1','Jun_Nose'].map(name=>geometryPart(g.head,name)),baseline=lengths(a),feet=SIDES.map(side=>part(a,'NaraFoot'+side).getWorldPosition(V())),result={stages:[],adjustSamples:0,minRenderedIndexRimGap:Infinity,maxRenderedIndexRimGap:0,minFacePadGap:Infinity,minPalmFaceGap:Infinity,maxWristStep:0,maxPadTargetError:0};let previous=part(a,'NaraHandR').getWorldPosition(V()),frame=0;const stages=new Set(),parent=g.rim.parent,geometry=g.rim.geometry;
 assert(g.start());until(f,()=>!g.active,10,()=>{frame++;stages.add(g.stage);verifyLengths(a,baseline);const p=part(a,'NaraHandR').getWorldPosition(V());result.maxWristStep=Math.max(result.maxWristStep,p.distanceTo(previous));previous=p;for(const [i,side]of SIDES.entries())assert(part(a,'NaraFoot'+side).getWorldPosition(V()).distanceTo(feet[i])<1e-8);assert.equal(g.rim.parent,parent);assert.equal(g.rim.geometry,geometry);
  if(frame%3===0){result.minPalmFaceGap=Math.min(result.minPalmFaceGap,Math.min(...faces.map(face=>distance(face,p))));for(const finger of hand.fingers)result.minFacePadGap=Math.min(result.minFacePadGap,Math.min(...faces.map(face=>distance(face,finger.pad.getWorldPosition(V())))));}
  if(g.stage==='adjust'&&g.time>.1&&frame%3===0){result.adjustSamples++;const gap=fingerSurfaceGap(hand,[2,3],g.rim);result.minRenderedIndexRimGap=Math.min(result.minRenderedIndexRimGap,gap);result.maxRenderedIndexRimGap=Math.max(result.maxRenderedIndexRimGap,gap);result.maxPadTargetError=Math.max(result.maxPadTargetError,g.diagnostics().padError);assert(gap<.003,'actual rendered index capsules approach existing glasses triangles');assert(distance(g.rim,V(...g.diagnostics().contact))<.003);}
 });
 result.stages=[...stages];assert(result.adjustSamples>=3);assert(result.maxWristStep<.035);assert(result.minFacePadGap>.0075);assert(result.minPalmFaceGap>.027);assert(result.maxPadTargetError<1e-5);assert.equal(g.done,1);return result;
});}

function glassesPriority(){return withFixture(f=>{
 const result=[];const actions={preparing:()=>work(f,'jun','preparing'),typing:()=>work(f,'jun'),reviewing:()=>work(f,'jun','reviewing'),success:()=>work(f,'jun','success'),cup:()=>assert(f.s.startCup('jun')),coffee:()=>assert(f.s.startCoffee('jun')),window:()=>assert(f.s.startWindow('jun')),meeting:()=>assert(f.s.startMeeting(['jun','min'])),visit:()=>assert(f.s.startVisit('jun','min',{transfer:true})),absent:()=>{f.vm.actors=f.vm.actors.filter(a=>a.agentId!=='jun');f.runtime.setViewModel(f.vm);}};
 for(const stage of ['prepare','approach','adjust','depart','recover'])for(const [action,act]of Object.entries(actions)){
  const g=f.s.personalMotion.glasses;assert(g.start(),stage+' '+action+' can start');until(f,()=>g.stage===stage,8);step(f,.04);act();step(f,.07);assert(!g.active,stage+' yields to '+action);assert(!g.controls('jun','R'));assert(!g.handOverrides());result.push({stage,action,yielded:true});ready(f);
 }
 const g=f.s.personalMotion.glasses;assert(g.start());until(f,()=>g.stage==='adjust',6);const before=JSON.stringify(g.diagnostics());f.runtime.setViewModel({...f.vm,motionPaused:true});step(f,2);assert.equal(JSON.stringify(g.diagnostics()),before);f.runtime.setViewModel(f.vm);assert(g.cancel());until(f,()=>!g.active,8);assert.deepEqual(f.s.book.snapshot(),{});assert.equal(f.s.cups.jun.owner,'desk');return{interruptions:result,pause:true,manualRetraction:true};
});}

// The same independent checks are callable from node:test and a compact evidence run.
function documentTransfer(){return withFixture(f=>{const results=[];for(const [visitor,host]of [['jun','min'],['min','jun']]){const baseline=Object.fromEntries(IDS.map(id=>[id,lengths(actor(f,id))])),row={visitor,host,stages:[],maxStep:0,maxHandError:0,maxPadError:0},stages=new Set();let previous=null;assert(f.s.startVisit(visitor,host,{transfer:true}));until(f,()=>!f.s.visit,500,()=>{const t=f.s.transfer;if(!t.active){previous=null;return;}stages.add(t.stage);const p=t.page.mesh.getWorldPosition(V());if(previous)row.maxStep=Math.max(row.maxStep,p.distanceTo(previous));previous=p;row.maxHandError=Math.max(row.maxHandError,t.handError);assert(t.page.mesh.parent);for(const id of IDS){verifyLengths(actor(f,id),baseline[id]);for(const h of Object.values(f.s.handGrips.rows.get(id)))row.maxPadError=Math.max(row.maxPadError,h.error);}});assert(f.s.visitHistory.at(-1).transferComplete);assert.equal(f.s.transfer.transfers,2);assert(row.maxStep<.055);assert(row.maxHandError<1e-5);assert(row.maxPadError<1e-5);assert(f.s.transfer.diagnostics().pages.every(p=>p.owner.startsWith('desk:')));assert.deepEqual(f.s.book.snapshot(),{});row.stages=[...stages];results.push(row);}return results;});}

function minWritingSurface(){return withFixture(f=>{
 const d=f.s.desks.min,surfaces=[d.surface,...[0,1,2,3].map(i=>f.root.getObjectByName('MinCheck'+i))],row={actor:'min',variant:0,actFrames:0,gapOver3mmFrames:0,minActualGap:Infinity,maxActualGap:0,example:null};
 assert(f.s.startRole('min',{variant:0}));
 until(f,()=>!d.busy,30,()=>{
  if(d.stage!=='use'||d.time<1||d.recipe().phase!=='act')return;
  const tip=d.prop.localToWorld(V(0,-d.half,0)),gap=Math.min(...surfaces.map(mesh=>distance(mesh,tip)));
  row.actFrames++;row.minActualGap=Math.min(row.minActualGap,gap);row.maxActualGap=Math.max(row.maxActualGap,gap);
  if(gap>.003){row.gapOver3mmFrames++;row.example??={tip:tip.toArray(),gap,time:d.time,recipe:d.recipe()};}
 });
 assert(row.actFrames>10);assert(row.maxActualGap<.0015,'Min actual writing surface gap '+row.maxActualGap+'; '+JSON.stringify(row));return row;
});}

export const precisionCases=[
 ['jun-min-routes-posture',postureRoutes],
 ['jun-min-listen-table',listening],
 ['jun-min-role-variants',roles],
 ['min-actual-writing-surface',minWritingSurface],
 ['jun-min-cups-coffee',cupsAndCoffee],
 ['jun-min-document-transfer',documentTransfer],
 ['jun-glasses-actual-geometry',glassesGeometry],
 ['jun-glasses-all-stage-priority',glassesPriority],
];

export async function runPrecision(){const startedAt=new Date().toISOString(),before=await fingerprints(),cases=[];for(const [name,run]of precisionCases){const start=performance.now();try{cases.push({name,status:'passed',result:run(),elapsedMs:Math.round(performance.now()-start)});if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(name+' passed');}catch(error){cases.push({name,status:'failed',error:error.stack,elapsedMs:Math.round(performance.now()-start)});if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(name+' failed: '+error.message);}}const after=await fingerprints();return{startedAt,finishedAt:new Date().toISOString(),scope:'in-memory v12 Jun/Min; no DB/server/browser',sourceHashes:after,sourceUnchanged:JSON.stringify(before)===JSON.stringify(after),passed:cases.every(c=>c.status==='passed'),cases,limits:['Triangle distances are unsigned sampled geometry distances, not a proof of collision-free skin polygons.','No browser image, texture decode, mobile thermal or visual naturalness claim.','The generated in-memory living model is used; exported GLB browser QA is a separate gate.']};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const report=await runPrecision(),dir=path.join(sourceRoot,'product/evidence/motion-precision/jun-min');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'in-memory.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,sourceUnchanged:report.sourceUnchanged,cases:report.cases.map(c=>({name:c.name,status:c.status,error:c.error?.split('\n')[0],elapsedMs:c.elapsedMs}))},null,2));if(!report.passed)process.exitCode=1;}
