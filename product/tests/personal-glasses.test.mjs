import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fixture,until,step} from './living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {validateOfficeAsset} from '../../pilot-3d/sample/asset-contract.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
import {SceneFrames} from '../../pilot-3d/living-office/frames.mjs';
const V=(...a)=>new T.Vector3(...a);
function surfaceDistance(mesh,point){
 let matrices=[mesh.matrixWorld.clone()];
 // The optimized Face is one instance of a shared sphere. Its instance matrix
 // contains the actual skin position and nonuniform scale; mesh.matrixWorld
 // alone measures a unit sphere. Include the face, ears and nose instances.
 if(mesh.isInstancedMesh){assert(mesh.userData.parts?.includes('Jun_Face'),'actual Jun face skin instances');matrices=Array.from({length:mesh.count},(_,instance)=>{const local=new T.Matrix4();mesh.getMatrixAt(instance,local);return mesh.matrixWorld.clone().multiply(local);});}
 const g=mesh.geometry,a=g.attributes.position,index=g.index;let distance=Infinity;
 const x=V(),y=V(),z=V(),closest=V(),triangle=new T.Triangle(x,y,z);
 for(const matrix of matrices)for(let i=0;i<(index?.count??a.count);i+=3){x.fromBufferAttribute(a,index?index.getX(i):i).applyMatrix4(matrix);y.fromBufferAttribute(a,index?index.getX(i+1):i+1).applyMatrix4(matrix);z.fromBufferAttribute(a,index?index.getX(i+2):i+2).applyMatrix4(matrix);triangle.closestPointToPoint(point,closest);distance=Math.min(distance,point.distanceTo(closest));}
 return distance;
}
function run(f,check=()=>{}){assert(f.s.personalMotion.glasses.start());until(f,()=>!f.s.personalMotion.glasses.active,10,check);assert.deepEqual(f.s.book.snapshot(),{});assert.equal(f.s.cups.jun.owner,'desk');}
test('Jun glasses touch the actual rim, leave the face clear and preserve limb lengths and feet through a continuous cycle',()=>{
 const f=fixture({personalMotion:true});try{
  const g=f.s.personalMotion.glasses,a=g.actor,hand=part(a,'NaraHandR'),elbow=part(a,'NaraElbowR'),head=part(a,'NaraHead'),feet=['L','R'].map(side=>part(a,'NaraFoot'+side).getWorldPosition(V())),lengths=[elbow.position.length(),hand.position.length()];let previous=hand.getWorldPosition(V()),maxStep=0,contacts=0;
  run(f,()=>{const now=hand.getWorldPosition(V());maxStep=Math.max(maxStep,previous.distanceTo(now));previous=now;assert.deepEqual([elbow.position.length(),hand.position.length()],lengths);for(const [i,side]of ['L','R'].entries())assert(part(a,'NaraFoot'+side).getWorldPosition(V()).distanceTo(feet[i])<1e-9);
   if(g.stage==='adjust'&&g.time>.10){const row=g.diagnostics();assert(row.handError<1e-6);assert(row.padError<1e-6);const pad=hand.getObjectByName('GripPad1').getWorldPosition(V());assert(surfaceDistance(g.rim,pad)>.006);assert(surfaceDistance(g.rim,pad)<.011);assert(surfaceDistance(g.rim,V(...row.contact))<.003);contacts++;
    // Face/ears/nose share an exported skin mesh. Check that actual geometry,
    // not a missing pre-optimization Face node or an invented contact proxy.
    const face=head.children.find(n=>n.userData.parts?.includes('Jun_Face'))??part(a,'Face');
    assert(head.worldToLocal(now.clone()).z>.17,'palm remains in front of face');
    assert(surfaceDistance(face,now)>.027,'palm skin clearance');
    for(let i=0;i<5;i++)assert(surfaceDistance(face,hand.getObjectByName('GripPad'+i).getWorldPosition(V()))>.0075,'all fingertips clear the face');
   }});assert(contacts>8);assert(maxStep<.035,'no transition jump at 30Hz');assert.equal(g.done,1);assert.equal(f.s.handGrips.diagnostics().jun.R.blend,0);
 }finally{f.close();}
});
test('every glasses phase yields immediately to actual work, cups, walking and participant removal; manual cancel retracts',()=>{
 const f=fixture({personalMotion:true});try{for(const stage of ['prepare','approach','adjust','depart','recover'])for(const kind of ['work','cup','walk','absent','cancel']){
  const g=f.s.personalMotion.glasses;assert(g.start());until(f,()=>g.stage===stage,6);step(f,.06);
  if(kind==='work'||kind==='absent'){f.vm.actors=f.s.ids.filter(id=>kind!=='absent'||id!=='jun').map(agentId=>({agentId,pose:agentId==='jun'?'typing':'idle'}));f.runtime.setViewModel(f.vm);step(f,.1);assert(!g.active);}
  else if(kind==='cup'){assert(f.s.startCup('jun'));step(f,.1);assert(!g.active);}
  else if(kind==='walk'){assert(f.s.startWindow('jun'));step(f,.1);assert(!g.active);}
  else{assert(g.cancel());until(f,()=>!g.active,5);}
  f.s.setAuto(false);f.s.cancelAll();f.vm.actors=f.s.ids.map(agentId=>({agentId,pose:'idle'}));f.runtime.setViewModel(f.vm);until(f,()=>f.s.ids.every(id=>f.s.idle(id)),200);step(f,2);assert.deepEqual(f.s.book.snapshot(),{});assert.equal(f.s.cups.jun.owner,'desk');
 }}finally{f.close();}
});
test('glasses are optional, sparse, frozen when paused and serialize with the unchanged five-person scene schema',()=>{
 const source=fixture({personalMotion:true}),target=fixture();try{const g=source.s.personalMotion.glasses,a=new SceneFrames(source.root),b=new SceneFrames(target.root);assert.equal(a.schema,b.schema);assert(!target.s.personalMotion);assert(!g.controls('min','R'));assert(!g.controls('jun','L'));
  assert(g.start());until(source,()=>g.stage==='adjust',5);const before=JSON.stringify(g.diagnostics());source.vm.motionPaused=true;source.runtime.setViewModel(source.vm);step(source,2);assert.equal(JSON.stringify(g.diagnostics()),before);source.vm.motionPaused=false;source.runtime.setViewModel(source.vm);step(source,.2);assert(g.time>0);
  const packet=a.capture({time:source.s.time});b.receive(packet);b.apply(1);for(let i=0;i<a.nodes.length;i++){assert(a.nodes[i].quaternion.angleTo(b.nodes[i].quaternion)<.001);assert(a.nodes[i].position.distanceTo(b.nodes[i].position)<1e-6);}b.restore();a.restore();until(source,()=>!g.active,5);const completed=g.done;source.s.setAuto(true);source.s.nextAuto=Infinity;source.s.base.nextMicro=Infinity;g.next=source.s.time+10;step(source,9);assert.equal(g.done,completed);source.s.setAuto(false);
 }finally{source.close();target.close();}
});
test('exported v9 GLB supports the same actual-rim gesture without adding nodes or clips',async()=>{
 globalThis.self??=globalThis;const loader=new GLTFLoader();loader.register(parser=>{parser.textureLoader={load(_url,done){const t=new T.Texture();queueMicrotask(()=>done(t));return t;}};return{name:'NodeDecoder'};});const bytes=await readFile('product/assets/studio-room-v9.glb'),gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');let runtime;try{const meta=validateOfficeAsset(gltf);runtime=createTeamRuntime(gltf.scene,meta,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true,personalMotion:true});runtime.setViewModel({actors:meta.actorIds.map(agentId=>({agentId,pose:'idle'}))});runtime.update(0);const f={runtime,s:runtime.scheduler};assert(f.s.personalMotion.glasses.available);const frames=new SceneFrames(gltf.scene),nodes=frames.nodes.length;run(f);assert.equal(new SceneFrames(gltf.scene).nodes.length,nodes);assert.equal(gltf.animations.length,105);}finally{runtime?.dispose();releaseStudioAsset(gltf.scene);}
});
test('an impending ambient stretch waits for the short glasses cycle while business work still preempts it',()=>{
 const f=fixture({personalMotion:true});try{step(f,9.4);const g=f.s.personalMotion.glasses;assert.equal(f.s.base.actors.jun.nextMicro,10);run(f);assert.equal(g.done,1);assert.equal(g.interruptions,0);assert(f.s.base.actors.jun.nextMicro>f.s.base.time);}finally{f.close();}
});
