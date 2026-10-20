import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';import {createHash}from'node:crypto';import * as T from'three';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{createNara,applyPose,LEG}from'../../pilot-3d/sample/character-rig.mjs';import{cyclePose,MotionClock,COLLIDERS,BODY_RADIUS}from'../../pilot-3d/sample/motion.mjs';
const v4=await readFile('product/assets/studio-team-v4.glb'),v4Manifest=JSON.parse(await readFile('product/assets/manifest-v4.json'));
const bytes=await readFile('product/assets/nara-workspace-sample.glb'),jl=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+jl).toString());
test('sample embeds valid PNG buffer views with proper color/data texture assignments; v4 is unchanged',()=>{
 assert.equal(createHash('sha256').update(v4).digest('hex'),v4Manifest.sha256);assert.equal(document.asset.version,'2.0');assert.equal(document.images.length,5);
 for(const image of document.images){const view=document.bufferViews[image.bufferView];assert.equal(bytes.subarray(28+jl+view.byteOffset,28+jl+view.byteOffset+8).toString('hex'),'89504e470d0a1a0a');}
 assert.ok(document.materials.some(m=>m.pbrMetallicRoughness.baseColorTexture));assert.ok(document.materials.some(m=>m.pbrMetallicRoughness.metallicRoughnessTexture));
 assert.ok(bytes.length<5*1024*1024);
});
test('actual GLB reload preserves rig, clips, anchors and texture bindings (PNG pixels checked in browser)',async()=>{
 // Node lacks image decoding: only image decoding is stubbed, not the GLTF parser or node/clip/material pipeline.
 const manager=new T.LoadingManager();manager.addHandler(/.*/, {load(url,onLoad){const texture=new T.Texture();queueMicrotask(()=>onLoad(texture));return texture;}});
 globalThis.self??=globalThis;const loader=new GLTFLoader(manager);loader.register(parser=>{parser.textureLoader={load(url,onLoad){const texture=new T.Texture();queueMicrotask(()=>onLoad(texture));return texture;}};return {name:'NodeImageDecoderStub'};});const model=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 for(const n of ['NaraActorRoot','NaraRigRoot','NaraHead','NaraSeatAnchor','NaraFootL','NaraFootR','NaraHipL','NaraKneeR','NaraShoulderR'])assert.ok(model.scene.getObjectByName(n),n);
 assert.equal(model.scene.getObjectByName('ContinuousSleeveL').skeleton.bones.length,2);assert.ok(model.scene.getObjectByName('ContinuousTrousersR').isSkinnedMesh);assert.equal(model.animations.length,8);for(const clip of model.animations){assert.ok(clip.duration>0);assert.ok(clip.tracks.every(t=>!t.name.startsWith('NaraActorRoot.')));}
 const sourceActor=createNara(new T.Group()),mixer=new T.AnimationMixer(model.scene);
 const clipStart={typing:0,stand_up:1,standing:3,turn:3,walk:4,stretch:8,rest:12,sit_down:19};
 for(const clip of model.animations){mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(clip.duration/2);const pose=cyclePose(clipStart[clip.name.replace('nara_','')]+clip.duration/2);applyPose(sourceActor,pose);for(const name of ['NaraPelvis','NaraShoulderL','NaraKneeR','NaraFootL']){const a=model.scene.getObjectByName(name),b=sourceActor.getObjectByName(name);assert.ok(a.position.distanceTo(b.position)<.002,clip.name+' '+name);assert.ok(a.quaternion.angleTo(b.quaternion)<.015,clip.name+' '+name);}}
 mixer.stopAllAction();
 assert.ok(model.scene.getObjectByName('SweaterBody').material.map);assert.equal(model.scene.getObjectByName('SweaterBody').material.map.colorSpace,T.SRGBColorSpace);assert.equal(model.scene.getObjectByName('SweaterBody').material.roughnessMap.colorSpace,T.NoColorSpace);assert.equal(model.scene.getObjectByName('NaraQualitySample').userData.units,'metres');
});
test('full cycle keeps exact leg lengths, foot clearance and walk-body clearance at 30/60Hz',()=>{
 const actor=createNara(new T.Group()),point=n=>actor.getObjectByName(n).getWorldPosition(new T.Vector3());
 for(const hz of [30,60])for(let i=0;i<=22*hz;i++){
  const p=cyclePose(i/hz);applyPose(actor,p);
  for(const side of ['L','R']){const hip=point('NaraHip'+side),knee=point('NaraKnee'+side),ankle=point('NaraFoot'+side);assert.ok(Math.abs(hip.distanceTo(knee)-LEG.upper)<1e-6);assert.ok(Math.abs(knee.distanceTo(ankle)-LEG.lower)<1e-6);assert.ok(ankle.y>=.0849);assert.ok(new T.Box3().setFromObject(actor.getObjectByName('NaraFoot'+side)).min.y>=-.01,'shoe penetrates floor >1cm');}
  if(p.action==='walk'){for(const c of COLLIDERS){const dx=Math.max(c.min[0]-p.x,0,p.x-c.max[0]),dz=Math.max(c.min[1]-p.z,0,p.z-c.max[1]);assert.ok(Math.hypot(dx,dz)>=BODY_RADIUS-.001,`collision ${c.id}`);}}
 }
 assert.deepEqual(cyclePose(22).x,0);assert.equal(cyclePose(22).stand,0);
});
test('planted walk feet stay world-fixed within 2cm; swing is not counted as planted',()=>{
 let previous=null;for(let t=4;t<7;t+=1/120){const p=cyclePose(t);if(previous)for(let i=0;i<2;i++)if(p.feet[i].planted&&previous.feet[i].planted)assert.ok(new T.Vector3(...p.feet[i].position).distanceTo(new T.Vector3(...previous.feet[i].position))<.02);previous=p;}
});
test('pause freezes world and pose clock; new work cannot start typing away from seat',()=>{
 const clock=new MotionClock();clock.play('tour');for(let i=0;i<100;i++)clock.tick(.06);clock.paused=true;const before=clock.pose();clock.tick(1);assert.deepEqual(clock.pose(),before);clock.paused=false;const oldX=clock.pose().x;clock.requestWork();assert.equal(clock.pose().x,oldX);assert.notEqual(clock.pose().action,'typing');for(let i=0;i<400;i++)clock.tick(.06);assert.equal(clock.pose().x,0);assert.equal(clock.pose().stand,0);
});

test('all five existing stations have the same unobstructed lateral exit in the greybox',()=>{
 const stations=[[-2.5,-.35],[0,-.35],[2.5,-.35],[-1.25,2],[1.25,2]];
 for(const [x,z] of stations)for(let t=4;t<7;t+=.02){const p=cyclePose(t);const world=[x+p.x,z+p.z];assert.ok(world[0]-BODY_RADIUS>-4.8&&world[0]+BODY_RADIUS<4.8&&world[1]-BODY_RADIUS>-3.8&&world[1]+BODY_RADIUS<3.8);for(const [ox,oz] of stations)for(const c of COLLIDERS){const dx=Math.max(ox+c.min[0]-world[0],0,world[0]-ox-c.max[0]),dz=Math.max(oz+c.min[1]-world[1],0,world[1]-oz-c.max[1]);assert.ok(Math.hypot(dx,dz)>=BODY_RADIUS-.001);}}
});
test('interrupted return preserves position and reaches a seated pose with no unreachable leg targets',()=>{
 const actor=createNara(new T.Group());
 for(const at of [1.2,2.2,3.5,4.01,4.05,4.2,5.3,6.9,8.5,10,14.3,15.01,16.7,17.99,19.3,20.5]){
  const clock=new MotionClock();clock.mode='tour';clock.time=at;const before=clock.pose();clock.requestWork();const after=clock.pose();assert.ok(Math.abs(after.x-before.x)<1e-8);assert.ok(Math.abs(after.z-before.z)<1e-8);
  let previous=clock.pose();for(let i=0;i<700;i++){clock.tick(1/60);const p=clock.pose();assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.025,'root teleported on return');applyPose(actor,p);previous=p;}
  assert.equal(clock.pose().action,'typing');assert.equal(clock.pose().x,0);assert.equal(clock.pose().z,-.6);
 }
});
test('detailed workspace keeps the seat/desk dimensions and typing hands above the solid desktop',async()=>{
 const {createSample}=await import('../../pilot-3d/sample/model.mjs');const {root,actor}=createSample({detailed:true});applyPose(actor,cyclePose(0));root.updateMatrixWorld(true);
 const desk=new T.Box3().setFromObject(root.getObjectByName('OakDeskTop')),seat=new T.Box3().setFromObject(root.getObjectByName('ChairCushion'));
 assert.ok(Math.abs(desk.max.y-.74)<.001);assert.ok(Math.abs(desk.getSize(new T.Vector3()).x-1.4)<.001);assert.ok(Math.abs(seat.max.y-.45)<.001);
 for(const side of ['L','R']){const hand=new T.Box3().setFromObject(root.getObjectByName('NaraHand'+side));let min=Infinity;actor.getObjectByName('NaraHand'+side).traverse(o=>{if(o.isMesh){const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++)min=Math.min(min,new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld).y);}});assert.ok(min>.740,`hand penetrates desktop: ${min}`);assert.ok(hand.min.z<0&&hand.max.z>-.10);}
});
test('pose changes stay continuous across stand/walk/turn/sit boundaries',()=>{
 const actor=createNara(new T.Group());let previous=null;
 for(let t=0;t<22;t+=1/120){const p=cyclePose(t);applyPose(actor,p);const joints=['NaraHead','NaraHandL','NaraHandR','NaraFootL','NaraFootR'].map(n=>actor.getObjectByName(n).getWorldPosition(new T.Vector3()));if(previous)for(let i=0;i<joints.length;i++)assert.ok(joints[i].distanceTo(previous[i])<.055,`joint snap at ${t.toFixed(3)} (${i})`);previous=joints;}
});

test('cloth deformation survives export and stays finite at all principal poses',async()=>{
 const {createSample}=await import('../../pilot-3d/sample/model.mjs');const {actor}=createSample({detailed:false});
 for(const t of [0,2,3,5.5,10,16.5,20]){applyPose(actor,cyclePose(t));for(const name of ['ContinuousSleeveL','ContinuousSleeveR','ContinuousTrousersL','ContinuousTrousersR']){const mesh=actor.getObjectByName(name);mesh.skeleton.update();const count=mesh.geometry.attributes.position.count;for(let i=0;i<count;i++){const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.y>=-.01&&p.y<2.6);}}}
});
