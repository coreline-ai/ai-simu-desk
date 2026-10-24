import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createMinHair,installMinHair,MIN_HAIR_ASSET} from '../src/assets/min-hair.mjs';
function fixture(){
 const model=new T.Group(),head=new T.Group();head.name='MinHead';model.add(head);
 for(const name of ['Min_HairBack','Min_Curl0','Min_EyeWhite1','Min_RoundGlasses1','Min_Brow1']){const n=new T.Object3D();n.name=name;head.add(n);}
 const batch=new T.Object3D();batch.name='MinHead_Instances_252';batch.userData.parts=['Min_Curl1','Min_Curl2'];head.add(batch);
 const face=new T.Object3D();face.name='MinHead_skin';face.userData.parts=['Min_Face','Min_Ear1','Min_Nose'];head.add(face);
 for(const id of ['Nara','Sora','Jun','Leo']){const n=new T.Object3D();n.name=id+'Head';model.add(n);}
 return{model,head};
}
test('original Min-only static mesh asset has two draws, no textures and bounded finite geometry',()=>{
 const asset=createMinHair();assert.equal(asset.children.length,2);assert.equal(asset.userData.id,MIN_HAIR_ASSET.id);let triangles=0;
 for(const m of asset.children){assert.ok(m.isMesh);assert.equal(m.material.map,null);assert.ok(m.castShadow&&m.receiveShadow);triangles+=m.geometry.index.count/3;for(const v of m.geometry.attributes.position.array)assert.ok(Number.isFinite(v));const b=m.geometry.boundingBox;assert.ok(b.min.x>-.21&&b.max.x<.21);assert.ok(b.min.y>-.18&&b.max.y<.23);assert.ok(b.min.z>-.20&&b.max.z<.18);}
 assert.ok(triangles<8000);for(const m of asset.children){m.geometry.dispose();m.material.dispose();}
});
test('only Min legacy hair hidden; head binding, face, glasses and four peers untouched; cleanup restores visibility',()=>{
 const {model,head}=fixture(),nodes=[];model.traverse(n=>nodes.push([n,n.parent,n.visible,n.matrix.toArray()]));head.getObjectByName('Min_Curl0').visible=false;
 const h=installMinHair(model);assert.equal(h.asset.parent,head);assert.equal(h.diagnostics().hidden.length,3);assert.throws(()=>installMinHair(model),/already/);
 for(const name of ['Min_EyeWhite1','Min_RoundGlasses1','Min_Brow1','MinHead_skin','NaraHead','SoraHead','JunHead','LeoHead'])assert.equal(model.getObjectByName(name).visible,true);
 head.rotation.set(.1,.2,-.04);model.updateMatrixWorld(true);const world=h.asset.getWorldQuaternion(new T.Quaternion());assert.ok(1-Math.abs(world.dot(head.getWorldQuaternion(new T.Quaternion())))<1e-10);
 head.rotation.set(0,0,0);model.updateMatrixWorld(true);let disposed=0;for(const m of h.asset.children){m.geometry.addEventListener('dispose',()=>disposed++);m.material.addEventListener('dispose',()=>disposed++);}h.dispose();h.dispose();assert.equal(disposed,4);assert.equal(head.getObjectByName('PracticeMinHair'),undefined);assert.equal(head.getObjectByName('Min_Curl0').visible,false);
 for(const [n,p,visible,matrix]of nodes){assert.equal(n.parent,p);assert.deepEqual(n.matrix.toArray(),matrix);if(n.name!=='Min_Curl0')assert.equal(n.visible,visible);}
 const again=installMinHair(model);again.dispose();
});
test('missing head/hair and mixed skin-hair instances fail atomically',()=>{
 assert.throws(()=>installMinHair(new T.Group()),/MinHead/);
 const {model,head}=fixture();head.getObjectByName('MinHead_skin').userData.parts.push('Min_Curl9');const before=head.children.map(n=>n.visible);assert.throws(()=>installMinHair(model),/Mixed/);assert.deepEqual(head.children.map(n=>n.visible),before);assert.equal(head.getObjectByName('PracticeMinHair'),undefined);
 const empty=new T.Group();empty.name='MinHead';assert.throws(()=>installMinHair(empty),/Original/);
});

test('current five-character model: Min-only hair replacement, all original bindings and non-hair geometry unchanged',async()=>{
 const {createLivingOffice}=await import('../../pilot-3d/living-office/model.mjs');
 const {releaseStudioAsset}=await import('../../pilot-3d/sample/asset-loader.mjs');
 const {root}=createLivingOffice();const original=[];root.traverse(n=>original.push({node:n,parent:n.parent,position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray(),visible:n.visible,geometry:n.geometry,material:n.material}));
 const hair=installMinHair(root),hidden=new Set(hair.diagnostics().hidden);
 try{assert.equal(hidden.size,2);for(const r of original){const n=r.node;assert.equal(n.parent,r.parent);assert.deepEqual(n.position.toArray(),r.position);assert.deepEqual(n.quaternion.toArray(),r.quaternion);assert.deepEqual(n.scale.toArray(),r.scale);assert.equal(n.geometry,r.geometry);assert.equal(n.material,r.material);assert.equal(n.visible,hidden.has(n.name)?false:r.visible);}}
 finally{hair.dispose();releaseStudioAsset(root);}
});
