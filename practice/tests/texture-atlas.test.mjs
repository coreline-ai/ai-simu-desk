import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBoneTextureAtlas} from '../../pilot-3d/sample/bone-texture-atlas.mjs';
import {fixture} from '../../product/tests/living-fixture.mjs';
const ids=['nara','sora','jun','min','leo'],options={personalMotion:true,personalities:true,anatomicalActors:ids};
function surfaces(f){return [...f.s.handGrips.rows.values()].flatMap(row=>Object.values(row).map(h=>h.legacy.surface));}
function bind(s){return{mesh:s.mesh,geometries:[...s.levels.values()].map(l=>l.geometry)};}
function positions(root){root.updateMatrixWorld(true);const result=[];root.traverse(n=>{if(!n.isSkinnedMesh)return;for(const i of [0,Math.floor(n.geometry.attributes.position.count/2),n.geometry.attributes.position.count-1])result.push([n.name,i,n.getVertexPosition(i,new T.Vector3()).applyMatrix4(n.matrixWorld).toArray()]);});return result;}

test('opt-in packs ten exact16-bone palettes without padding, moving bones or changing CPU skinning/bounds and both detail levels',()=>{
 const a=fixture(options),b=fixture({...options,sharedLegacyHandTexture:true});try{
  const atlas=b.s.handGrips.textureAtlas;assert(!a.s.handGrips.textureAtlas);assert.equal(atlas.entries,10);assert.equal(atlas.bones,160);assert.equal(atlas.payloadBytes,10*8*8*4*4);assert.equal(atlas.skeleton.boneTexture,null,'no preload to hide cold growth');
  const original=surfaces(a),packed=surfaces(b);assert.equal(new Set(packed.map(s=>s.mesh.skeleton)).size,1);
  for(const level of ['room','close']){a.runtime.setDetail(level);b.runtime.setDetail(level);assert.deepEqual(positions(a.root),positions(b.root));for(let i=0;i<10;i++){assert.deepEqual(packed[i].mesh.bindMatrix.elements,original[i].mesh.bindMatrix.elements);assert.deepEqual(packed[i].mesh.bindMatrixInverse.elements,original[i].mesh.bindMatrixInverse.elements);packed[i].mesh.computeBoundingBox();original[i].mesh.computeBoundingBox();assert.deepEqual(packed[i].mesh.boundingBox,original[i].mesh.boundingBox);}}
  for(const f of [a,b])for(const id of ids)assert(f.s.startCup(id));for(let n=0;n<360;n++){a.runtime.update(1/60);b.runtime.update(1/60);if(n%60===0)assert.deepEqual(positions(a.root),positions(b.root));}
  atlas.skeleton.update();atlas.skeleton.computeBoneTexture();assert.equal(atlas.skeleton.boneTexture.image.width,4);assert.equal(atlas.skeleton.boneTexture.image.height,160);
  for(const s of packed){assert.equal(s.skeleton.boneMatrices.buffer,atlas.skeleton.boneMatrices.buffer);assert(s.skeleton.boneTexture===null);}
  const ray=new T.Raycaster(new T.Vector3(0,2,-3.6),new T.Vector3(0,-1,0));assert.doesNotThrow(()=>ray.intersectObject(b.root,true));
 }finally{a.close();b.close();}
});

test('atlas supports context release/recreate without replacing the data buffer or accumulating textures, then detaches safely once',()=>{
 const f=fixture({...options,sharedLegacyHandTexture:true});try{const skins=surfaces(f),atlas=f.s.handGrips.textureAtlas,shared=atlas.skeleton,data=shared.boneMatrices;let released=0;
  for(let epoch=0;epoch<3;epoch++){shared.computeBoneTexture();const texture=shared.boneTexture;assert.equal(texture.image.data,data);texture.addEventListener('dispose',()=>released++);shared.dispose();shared.dispose();assert.equal(released,epoch+1);assert.equal(shared.boneMatrices,data);}
  shared.computeBoneTexture();shared.boneTexture.addEventListener('dispose',()=>released++);atlas.dispose();atlas.dispose();assert.equal(released,4);assert.equal(shared.boneTexture,null);assert.equal(shared.bones.length,0);
  for(const s of skins){assert.equal(s.mesh.skeleton,s.skeleton);assert.equal(s.skeleton.boneTexture,null);for(const{geometry:g}of s.levels.values())for(const i of g.attributes.skinIndex.array)assert(i<16);assert.doesNotThrow(()=>s.mesh.getVertexPosition(0,new T.Vector3()));}
 }finally{f.close();}
});

test('atlas validates complete ownership and local indices before mutating; fresh runtimes and mixed/non-opt-in versions stay isolated',()=>{
 const a=fixture(options),b=fixture({...options,sharedLegacyHandTexture:true});try{const list=surfaces(a).map(bind),first=list[0].mesh,indices=first.geometry.attributes.skinIndex.array.slice();
  assert.throws(()=>createBoneTextureAtlas([list[0],list[0]]),/unique/);assert.deepEqual(first.geometry.attributes.skinIndex.array,indices);assert.equal(first.skeleton,surfaces(a)[0].skeleton);
  list[1].geometries[0].attributes.skinIndex.array[0]=16;assert.throws(()=>createBoneTextureAtlas(list),/local/);assert.deepEqual(first.geometry.attributes.skinIndex.array,indices);
  assert.notEqual(surfaces(a)[0].mesh.skeleton,b.s.handGrips.textureAtlas.skeleton);const old=b.s.handGrips.textureAtlas.skeleton;b.reset();assert.notEqual(old,b.s.handGrips.textureAtlas.skeleton);assert.equal(old.bones.length,0);
 }finally{a.close();b.close();}
});

test('pooled runtime preserves native diagnostics/contact/return and CPU-skinned positions through complete roles, cups, glasses and transfer',()=>{
 for(const action of ['roles','cups','glasses','visit']){const a=fixture(options),b=fixture({...options,sharedLegacyHandTexture:true});try{
  function match(){assert.deepEqual(a.runtime.diagnostics(),b.runtime.diagnostics());assert.deepEqual(positions(a.root),positions(b.root));}
   for(const f of [a,b]){if(action==='roles')for(const id of ids)assert(f.s.startRole(id,{variant:1}));if(action==='cups')for(const id of ids)assert(f.s.startCup(id));if(action==='glasses')assert(f.s.personalMotion.glasses.start());if(action==='visit')assert(f.s.startVisit('leo','nara',{transfer:true}));}
   let finished=false;for(let n=0;n<9000;n++){a.runtime.update(1/30);b.runtime.update(1/30);if(n%120===0)match();if(ids.every(id=>a.s.idle(id))&&!a.s.personalMotion.glasses.active){finished=true;match();break;}}
   assert(finished,action+' completes');assert.deepEqual(a.s.book.snapshot(),{});assert.deepEqual(b.s.book.snapshot(),{});
 }finally{a.close();b.close();}}
});


test('shared renderer palette only refreshes visible legacy owners after final world updates, never hidden fallback bones',()=>{
 const f=fixture({...options,sharedLegacyHandTexture:true});try{const atlas=f.s.handGrips.textureAtlas,skins=surfaces(f),calls=new Map();for(const s of skins){const original=s.skeleton.update.bind(s.skeleton);s.skeleton.update=()=>{calls.set(s,(calls.get(s)??0)+1);original();};}
  atlas.skeleton.update();assert.equal(calls.size,0);
  assert(f.s.startCup('min'));for(let n=0;n<300;n++)f.runtime.update(1/60);calls.clear();f.root.updateMatrixWorld(true);atlas.skeleton.update();assert(calls.size>0&&calls.size<10);assert([...calls.values()].every(n=>n===1));
  const active=skins.filter(s=>calls.has(s));for(const s of active){const expected=new T.Skeleton(s.skeleton.bones,s.skeleton.boneInverses);expected.update();assert.deepEqual(s.skeleton.boneMatrices,expected.boneMatrices);expected.dispose();}
 }finally{f.close();}
});
