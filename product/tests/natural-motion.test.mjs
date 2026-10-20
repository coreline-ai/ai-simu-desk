import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyActorPoses,finishActorAction} from '../../pilot-3d/src/animation.mjs';
const data=await readFile(new URL('../assets/studio-team-v4.glb',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../assets/manifest-v4.json',import.meta.url)));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const ids=['nara','sora','jun','min','leo'];
test('v4 has independent preparation/review/send/receive rigs and safe sampled hands, fixed contacts and gaze limits',()=>{
 assert.equal(createHash('sha256').update(data).digest('hex'),manifest.sha256);assert.ok(data.length<5*1024*1024);assert.equal(gltf.animations.length,60);
 const root=gltf.scene,mixer=new T.AnimationMixer(root);root.updateMatrixWorld(true);
 const supports=[];root.traverse(n=>{if(n.userData.groundSupport)supports.push([n,n.getWorldPosition(new T.Vector3())]);});assert.equal(supports.length,54);
 for(const id of ids){const prefix=id[0].toUpperCase()+id.slice(1),head=root.getObjectByName(prefix+'Head'),desk=root.getObjectByName(id==='nara'?'DeskTop':prefix+'DeskTop');
  const others=ids.filter(x=>x!==id).map(x=>root.getObjectByName(x[0].toUpperCase()+x.slice(1)+'Head')),before=others.map(n=>n.quaternion.clone());
  for(const pose of ['preparing','reviewing','sending','receiving','typing']){
   const clip=gltf.animations.find(c=>c.name===id+'_'+pose);assert.ok(clip);mixer.clipAction(clip).play();
   for(let i=0;i<=30;i++){mixer.setTime(clip.duration*i/30);root.updateMatrixWorld(true);
    for(const side of ['L','R']){const hand=root.getObjectByName((id==='nara'?'':prefix)+'Hand'+side);assert.ok(new T.Box3().setFromObject(hand).min.y>new T.Box3().setFromObject(desk).max.y+.005,id+pose);}
    supports.forEach(([n,p])=>assert.ok(n.getWorldPosition(new T.Vector3()).distanceTo(p)<1e-5));others.forEach((n,j)=>assert.ok(n.quaternion.angleTo(before[j])<1e-5));
    if(['sending','receiving'].includes(pose)){const e=new T.Euler().setFromQuaternion(head.quaternion);assert.ok(Math.abs(e.x)<.175);assert.ok(Math.abs(e.y)<.35);}
   }mixer.stopAllAction();
  }
 }mixer.uncacheRoot(root);
});
test('one-off reaction returns to current work; pause preserves clip time, profiles differ and cancellation interrupts',()=>{
 const mixer=new T.AnimationMixer(gltf.scene),actions=Object.fromEntries(ids.map(id=>[id,Object.fromEntries(gltf.animations.filter(c=>c.name.startsWith(id+'_')).map(c=>[c.name.slice(id.length+1),mixer.clipAction(c)]))])),current={},consumed={};
 const vm={naturalMotion:true,actors:ids.map(agentId=>({agentId,pose:'typing'}))};applyActorPoses(actions,current,ids,vm,consumed);
 assert.notEqual(current.nara.getEffectiveTimeScale(),current.sora.getEffectiveTimeScale());mixer.update(.2);const time=current.nara.time;
 applyActorPoses(actions,current,ids,{...vm,motionPaused:true,actors:ids.map(agentId=>({agentId,pose:'waiting'}))},consumed);mixer.update(0);assert.equal(current.nara.time,time);
 const reacting={...vm,actors:[{agentId:'nara',pose:'sending',basePose:'reviewing',cue:'handoff:1'}]};applyActorPoses(actions,current,ids,reacting,consumed);assert.equal(current.nara,actions.nara.sending);
 finishActorAction(actions,current,'nara',reacting);assert.equal(current.nara,actions.nara.reviewing);applyActorPoses(actions,current,ids,reacting,consumed);assert.equal(current.nara,actions.nara.reviewing);
 applyActorPoses(actions,current,ids,{...vm,actors:[{agentId:'nara',pose:'waiting'}]},consumed);assert.equal(current.nara,actions.nara.waiting);mixer.stopAllAction();
});
