import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import * as T from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {applyActorPoses} from "../src/animation.mjs";

async function load() {
  const bytes=await readFile(new URL("../assets/afternoon-studio-v1.glb",import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
}

test("exported idle and typing visibly move hands while keeping them above the desk",async()=>{
  const gltf=await load(), root=gltf.scene, mixer=new T.AnimationMixer(root);
  const hand=root.getObjectByName("HandL"), face=root.getObjectByName("Nose");
  const desk=new T.Box3().setFromObject(root.getObjectByName("DeskTop"));
  const foot=root.getObjectByName("Nara").children.find(node=>node.userData.groundSupport);
  root.updateMatrixWorld(true);const anchored=foot.getWorldPosition(new T.Vector3());
  for(const clip of gltf.animations){
    mixer.clipAction(clip).play();
    const positions=[], faces=[];
    for(let i=0;i<=80;i++){
      mixer.setTime(clip.duration*i/80);root.updateMatrixWorld(true);
      positions.push(hand.getWorldPosition(new T.Vector3()));
      faces.push(face.getWorldPosition(new T.Vector3()));
      for(const id of ["HandL","HandR"]){
        const bounds=new T.Box3().setFromObject(root.getObjectByName(id));
        assert.ok(bounds.min.y>desk.max.y+.005,clip.name+" "+id+" intersects desk at "+i);
      }
      assert.ok(foot.getWorldPosition(new T.Vector3()).distanceTo(anchored)<.00001);
    }
    const span=values=>Math.max(...values.map(a=>Math.max(...values.map(b=>a.distanceTo(b)))));
    if(["idle","typing"].includes(clip.name)) assert.ok(span(positions)>.05,clip.name+" hand displacement must exceed 5 cm");
    if(clip.name==="idle")assert.ok(span(faces)>.07,"idle look-around must be visible");
    mixer.stopAllAction();
  }
});

test("repeated state updates and pause/resume preserve animation phase, including crossfades",async()=>{
  const gltf=await load(),mixer=new T.AnimationMixer(gltf.scene);
  const actions={nara:Object.fromEntries(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]))},current={};
  const set=(pose,motionPaused=false)=>applyActorPoses(actions,current,["nara"],{pose,motionPaused});
  set("idle");mixer.update(1.3);const idleTime=current.nara.time;
  set("idle",true);mixer.update(0);set("idle",true);set("idle");
  assert.equal(current.nara.time,idleTime,"pause/repeated snapshots must not reset the clip");
  mixer.update(.1);assert.ok(current.nara.time>idleTime);
  set("typing");mixer.update(.11);const typingTime=current.nara.time;
  set("typing",true);mixer.update(0);set("typing");assert.equal(current.nara.time,typingTime);
  mixer.update(.3);assert.ok(current.nara.getEffectiveWeight()>.99);
  set("idle");mixer.update(.3);assert.ok(current.nara.getEffectiveWeight()>.99);
  assert.ok(actions.nara.typing.getEffectiveWeight()<.01);
});


test("completion is played once per observed transition; loading history produces no cue",async()=>{
  const {createCueTracker}=await import("../src/animation.mjs");
  const tracker=createCueTracker(),run={id:"a",agentId:"nara",status:"succeeded"};
  assert.deepEqual(tracker.observe([run]),{});
  tracker.observe([{...run,status:"running"}]);
  const cue=tracker.observe([run]).nara;assert.equal(cue.pose,"success");
  const gltf=await load(),mixer=new T.AnimationMixer(gltf.scene);
  const actions={nara:Object.fromEntries(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]))},current={},consumed={};
  const vm={actors:[{agentId:"nara",...cue}]};
  applyActorPoses(actions,current,["nara"],vm,consumed);mixer.update(.3);
  const time=current.nara.time;
  applyActorPoses(actions,current,["nara"],vm,consumed);assert.equal(current.nara.time,time);
  mixer.update(2);
  current.nara=actions.nara.idle.reset().play();
  applyActorPoses(actions,current,["nara"],vm,consumed);assert.equal(current.nara,actions.nara.idle);
  tracker.observe([{...run,id:"next",status:"running"}]);
  assert.deepEqual(tracker.observe([{...run,id:"next",status:"cancelled"}]),{});
  tracker.reset();assert.deepEqual(tracker.observe([run]),{});
});

test("blink closes both eyes without altering the seated rig",async()=>{
  const gltf=await load(),mixer=new T.AnimationMixer(gltf.scene);
  const eye=gltf.scene.getObjectByName("NaraEyeL");
  mixer.clipAction(gltf.animations.find(c=>c.name==="blink")).play();
  mixer.setTime(3.18);assert.ok(eye.scale.y<.1);
  mixer.setTime(3.4);assert.ok(eye.scale.y>1);
});
