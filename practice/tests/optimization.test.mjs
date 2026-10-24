import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {fixture} from '../../product/tests/living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
import {applyCharacterPose} from '../../pilot-3d/sample/poses.mjs';
import {solveArm} from '../../pilot-3d/activities/interactions.mjs';
import {nearestKeyToLocalX} from '../../pilot-3d/hand-v14/adapter.mjs';

// Frozen eager reference: same authored solver; its initial whole-actor walk is
// intentionally retained so the optimized scope is tested independently.
function eagerArm(actor,target,worldQuaternion,side='L',bendPole){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),DOWN=V(0,-1,0),shoulder=part(actor,'NaraShoulder'+side),elbow=part(actor,'NaraElbow'+side),hand=part(actor,'NaraHand'+side);
 actor.updateWorldMatrix(true,true);const start=shoulder.getWorldPosition(V()),delta=target.clone().sub(start),distance=delta.length(),upper=elbow.position.length(),lower=hand.position.length();
 if(distance>upper+lower-.001||distance<.025)throw Error(`컵 손 도달 범위 오류: ${distance.toFixed(3)}`);
 const axis=delta.clone().normalize(),pole=bendPole?.clone()??V(side==='L'?-1:1,.15,.25).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())),bend=pole.addScaledVector(axis,-pole.dot(axis)).normalize(),along=(upper*upper-lower*lower+distance*distance)/(2*distance),mid=start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
 const upperQ=new T.Quaternion().setFromUnitVectors(DOWN,mid.clone().sub(start).normalize());shoulder.quaternion.copy(shoulder.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(upperQ);shoulder.updateWorldMatrix(false,true);
 const lowerQ=new T.Quaternion().setFromUnitVectors(hand.position.clone().normalize(),target.clone().sub(mid).normalize());elbow.quaternion.copy(elbow.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(lowerQ);elbow.updateWorldMatrix(false,true);
 hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(worldQuaternion);hand.updateWorldMatrix(false,true);
 return hand.getWorldPosition(V()).distanceTo(target);
}
function visibleHash(root){root.updateMatrixWorld(true);const rows=[];root.traverseVisible(n=>{if(n.isMesh||n.isBone)rows.push([n.name,n.matrixWorld.elements,n.isInstancedMesh?[...n.instanceMatrix.array]:null,n.isSkinnedMesh?n.skeleton.bones.map(b=>b.matrixWorld.elements):null]);});return createHash('sha256').update(JSON.stringify(rows)).digest('hex');}

test('scoped IK preserves exact final visible transforms, skeletons and error for both arms of all five actors',()=>{
 const ids=['nara','sora','jun','min','leo'],options={personalMotion:true,personalities:true,anatomicalActors:ids},fast=fixture(options),old=fixture(options);let samples=0;
 try{for(const id of ids)for(const side of ['L','R'])for(let i=0;i<8;i++){
  const a=fast.root.getObjectByName(fast.root.userData.bindings[id].actor),b=old.root.getObjectByName(old.root.userData.bindings[id].actor);
  for(const actor of [a,b]){applyCharacterPose(actor,'typing',i*.13);actor.rotation.y=i*.07;actor.updateWorldMatrix(true,true);}
  const start=part(a,'NaraShoulder'+side).getWorldPosition(new T.Vector3()),target=start.clone().add(new T.Vector3((side==='L'?-1:1)*(.04+i*.002),-.22,.12+i*.007)),q=a.getWorldQuaternion(new T.Quaternion()),pole=i%2?new T.Vector3(side==='L'?-1:1,.15,.25):undefined;
  assert.equal(solveArm(a,target,q,side,pole),eagerArm(b,target,q,side,pole));assert.equal(visibleHash(fast.root),visibleHash(old.root));samples++;
 }
 assert.equal(samples,80);
 for(const actor of [fast.root.getObjectByName(fast.root.userData.bindings.nara.actor)]){const start=part(actor,'NaraShoulderL').getWorldPosition(new T.Vector3());assert.throws(()=>solveArm(actor,start.clone().add(new T.Vector3(5,0,0)),new T.Quaternion()),/도달 범위/);}
 }finally{fast.close();old.close();}
});

test('IK avoids visiting the unrelated head, legs and opposite arm, without skipping the solved hand',()=>{
 const f=fixture({personalMotion:true,personalities:true,anatomicalActors:['nara','sora','jun','min','leo']});try{const actor=f.root.getObjectByName(f.root.userData.bindings.sora.actor),head=part(actor,'NaraHead'),other=part(actor,'NaraShoulderR'),hand=part(actor,'NaraHandL');let unrelated=0,solved=0;for(const n of [head,other]){const original=n.updateWorldMatrix.bind(n);n.updateWorldMatrix=(...args)=>{unrelated++;return original(...args);};}const original=hand.updateWorldMatrix.bind(hand);hand.updateWorldMatrix=(...args)=>{solved++;return original(...args);};const start=part(actor,'NaraShoulderL').getWorldPosition(new T.Vector3());solveArm(actor,start.add(new T.Vector3(-.04,-.22,.16)),new T.Quaternion(),'L');assert.equal(unrelated,0);assert.ok(solved>0);}finally{f.close();}
});

test('keyboard search matches eager per-candidate worldToLocal across moving/rotating/scaled parents, ties and empty lists',()=>{
 const parent=new T.Group(),actor=new T.Group();parent.add(actor);const keys=Array.from({length:48},(_,i)=>({id:i,point:new T.Vector3((i%12)*.04,.74,Math.floor(i/12)*.04)}));let walks=0;const update=actor.updateWorldMatrix.bind(actor);actor.updateWorldMatrix=(...a)=>{walks++;return update(...a);};
 for(let i=0;i<20;i++){parent.position.set(i*.1,.03,-.2);parent.rotation.y=i*.11;parent.scale.set(1+i*.01,1,.9);actor.rotation.z=i*.003;for(const x of [-.12,.08]){const eager=keys.reduce((best,k)=>Math.abs(actor.worldToLocal(k.point.clone()).x-x)<Math.abs(actor.worldToLocal(best.point.clone()).x-x)?k:best,keys[0]);walks=0;assert.equal(nearestKeyToLocalX(actor,keys,x),eager);assert.equal(walks,1);}}
 assert.equal(nearestKeyToLocalX(actor,[],0),undefined);assert.equal(nearestKeyToLocalX(actor,[keys[0],{point:keys[0].point.clone()}],0),keys[0]);
});

test('practice status is event-driven and failed 3D releases the player ownership reference',async()=>{
 const {readFile}=await import('node:fs/promises'),app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(app,/onMetrics\(/);assert.match(app,/if\(ready\)\$\('scene-status'\)\.textContent=stopped\?/);assert.match(app,/ready=false;player\?\.dispose\(\);player=undefined/);
});
