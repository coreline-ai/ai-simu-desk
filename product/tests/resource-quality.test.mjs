import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture} from './living-fixture.mjs';
const ids=['nara','sora','jun','min','leo'],options={personalMotion:true,personalities:true,anatomicalActors:ids};
function visibleHash(root){root.updateMatrixWorld(true);const rows=[];root.traverseVisible(n=>{if(!n.isMesh&&!n.isLine)return;rows.push([n.name,n.matrixWorld.elements,n.isInstancedMesh?[...n.instanceMatrix.array]:null,n.isSkinnedMesh?n.skeleton.bones.map(b=>b.matrixWorld.elements):null,n.userData.ensemblePaper?[...n.geometry.attributes.position.array]:null]);});return createHash('sha256').update(JSON.stringify(rows)).digest('hex');}

test('hidden legacy calculations can be omitted without changing visible transforms, skeletons, contact diagnostics or cup-return visibility',()=>{
 const fast=fixture(options),eager=fixture(options);let hiddenSolves=0;
 try{
  // Reference path restores the old redundant legacy solve before the adapter.
  // Reset only blend so the real visible-owner solve advances it exactly once.
  for(const row of eager.s.handGrips.rows.values())for(const h of Object.values(row)){
   const apply=h.apply.bind(h);h.apply=(dt,desired,prop,kind,points)=>{const before=h.legacy.blend;h.legacy.apply(dt,desired,prop,kind,points);h.legacy.blend=before;hiddenSolves++;return apply(dt,desired,prop,kind,points);};
  }
  function match(){assert.equal(visibleHash(fast.root),visibleHash(eager.root));assert.deepEqual(fast.runtime.diagnostics(),eager.runtime.diagnostics());}
  function run(n){for(let i=0;i<n;i++){fast.runtime.update(1/60);eager.runtime.update(1/60);if(i%60===59)match();}}
  match();run(90);
  for(const f of [fast,eager]){for(const id of ids)assert(f.s.startRole(id,{variant:1}));}
  run(1200);
  for(const f of [fast,eager]){for(const id of ids)assert(f.s.startCup(id));}
  run(1200);match();assert(hiddenSolves>20000);
  for(const f of [fast,eager])assert(ids.every(id=>f.s.cups[id].owner==='desk'));
 }finally{fast.close();eager.close();}
});

test('native hands skip hidden legacy IK but still re-hide original meshes and retain blend, full fallback and close detail on both skins',()=>{
 const f=fixture(options);try{
  const h=f.s.handGrips.rows.get('sora').L,legacy=h.legacy,original=legacy.apply.bind(legacy);let solves=0;
  legacy.apply=(...args)=>{solves++;return original(...args);};
  for(const {node}of legacy.original)node.visible=true; // CupInteraction.setGrip(false).
  f.runtime.update(1/60);assert.equal(solves,0);assert(legacy.original.every(r=>!r.node.visible));assert(h.root.visible);assert(!legacy.root.visible);
  f.s.handGrips.setDetail('close');assert.equal(h.skin.detail,'close');assert.equal(h.legacy.surface.detail,'close');
  const skin=h.skin.setDetail.bind(h.skin);let switches=0;h.skin.setDetail=(...args)=>{switches++;return skin(...args);};
  f.s.handGrips.setDetail('close');assert.equal(switches,0);
  assert(f.s.startCup('sora'));for(let i=0;i<300;i++)f.runtime.update(1/60);
  assert(solves>0);assert(h.fallback);assert.equal(h.surface.detail,'close');
 }finally{f.close();}
});

test('presentation-only states retain exact screen/indicator decisions without building full diagnostic trees',()=>{
 const f=fixture(options);try{
  for(const id of ids)f.s.startRole(id,{variant:0});
  for(let n=0;n<180;n++){f.runtime.update(1/60);if(n%30)continue;const lightweight=f.runtime.presentationActors(),full=f.runtime.diagnostics().actors;for(const id of ids)for(const key of ['action','basePose','returning'])assert.deepEqual(lightweight[id][key],full[id][key],id+':'+key);}
 }finally{f.close();}
});
