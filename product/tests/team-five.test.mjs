import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fitOrthographic} from '../../pilot-3d/src/framing.mjs';
const bytes=await readFile(new URL('../assets/studio-team-v3.glb',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../assets/manifest-v3.json',import.meta.url)));
const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
const stations=['Workspace','SoraWorkspace','JunWorkspace','MinWorkspace','LeoWorkspace'];
const ids=['nara','sora','jun','min','leo'];
model.scene.updateMatrixWorld(true);
test('five-person GLB: separate same-scale stations, floor contacts, room and clear aisles',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.ok(bytes.length<10*1024*1024);
 assert.deepEqual(manifest.dimensions.room,[9.6,2.6,7.6]);assert.deepEqual(model.scene.getObjectByName('AfternoonStudio').userData.workspaces,manifest.workspaces);assert.equal(model.animations.length,35);
 const names=new Set(),actors=[];model.scene.traverse(n=>{assert.ok(!names.has(n.name),n.name);names.add(n.name);if(n.userData.selectable)actors.push(n.userData.agentId);});assert.deepEqual(actors.sort(),[...ids].sort());
 const boxes=stations.map(name=>new T.Box3().setFromObject(model.scene.getObjectByName(name)));
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert.equal(boxes[i].intersectsBox(boxes[j]),false,stations[i]+' / '+stations[j]);
 const floor=new T.Box3().setFromObject(model.scene.getObjectByName('Floor'));let count=0;
 model.scene.traverse(n=>{if(n.userData.groundSupport){count++;const b=new T.Box3().setFromObject(n);assert.ok(Math.abs(b.min.y)<.0001,n.name);assert.ok(b.min.x>floor.min.x&&b.max.x<floor.max.x&&b.min.z>floor.min.z&&b.max.z<floor.max.z,n.name);}});assert.equal(count,54);
 for(const prefix of ['','Sora','Jun','Min','Leo']){assert.ok(Math.abs(new T.Box3().setFromObject(model.scene.getObjectByName(prefix+'DeskTop')).max.y-.74)<.0001);assert.ok(Math.abs(new T.Box3().setFromObject(model.scene.getObjectByName(prefix+'ChairSeat')).max.y-.45)<.0001);}
 for(const box of boxes)for(const name of ['Sofa','Bookshelf','CoffeeTable','MeetingTable','MeetingChair'])assert.equal(box.intersectsBox(new T.Box3().setFromObject(model.scene.getObjectByName(name))),false,name);
});
test('all five rigs animate independently while all furniture stays fixed',()=>{
 for(const id of ids){const prefix=id[0].toUpperCase()+id.slice(1),hand=id==='nara'?'HandL':prefix+'HandL';
  const mixer=new T.AnimationMixer(model.scene),node=model.scene.getObjectByName(hand),others=ids.filter(x=>x!==id).map(x=>model.scene.getObjectByName(x==='nara'?'NaraHead':x[0].toUpperCase()+x.slice(1)+'Head'));
  const before=others.map(n=>n.quaternion.clone());const foot=model.scene.getObjectByName('DeskTop'),stable=foot.getWorldPosition(new T.Vector3());
  mixer.clipAction(model.animations.find(c=>c.name===id+'_typing')).play();mixer.setTime(0);model.scene.updateMatrixWorld(true);const at=node.getWorldPosition(new T.Vector3());mixer.setTime(.2);model.scene.updateMatrixWorld(true);assert.ok(at.distanceTo(node.getWorldPosition(new T.Vector3()))>.005,id);
  others.forEach((n,i)=>assert.ok(n.quaternion.angleTo(before[i])<.0001));assert.ok(foot.getWorldPosition(new T.Vector3()).distanceTo(stable)<.0001);mixer.stopAllAction();mixer.uncacheRoot(model.scene);
 }
});
test('five-person framing keeps all room corners in view for desktop and narrow layouts',()=>{
 for(const aspect of [1280/640,390/440,319/440]){
 const camera=new T.OrthographicCamera(-5,5,4,-4,.1,60);camera.position.set(7,8.15,12);camera.lookAt(0,.65,0);const bounds=new T.Box3(new T.Vector3(-4.8,-.18,-3.8),new T.Vector3(4.8,2.6,3.8));fitOrthographic(camera,bounds,aspect,1.04);
 for(const x of [-4.8,4.8])for(const y of [-.18,2.6])for(const z of [-3.8,3.8]){const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1);}
 }
});
