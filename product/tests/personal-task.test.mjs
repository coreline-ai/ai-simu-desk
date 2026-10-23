import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,until,step} from './living-fixture.mjs';
import {boardRecipe} from '../../pilot-3d/personal-office/recipes.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
const ids=['nara','sora','jun','min','leo'];
test('all five personal board explanations pause on reachable points and return the single marker',()=>{
 const f=fixture({personalMotion:true});try{assert(f.s.startReview());const seen=new Set();until(f,()=>!f.s.huddles.current,1000,()=>{const q=f.s.huddles.current?.sequence;if(q?.pointer.stage==='use'){seen.add(q.id);assert(q.pointer.handError<1e-5);assert(q.pointer.tipError<.001);}});assert.equal(seen.size,5);assert.equal(f.root.getObjectByName('LivingReviewMarker').parent.name,'LivingMarkerTray');assert.deepEqual(f.s.book.snapshot(),{});
 for(const id of ids){const a=boardRecipe(id,.95),b=boardRecipe(id,.99);assert(Number.isFinite(a.x));assert(Math.abs(a.x-b.x)<.02);}
 }finally{f.close();}
});
test('five receiver styles and every document interruption keep one owner, fixed contact and final support',()=>{
 const f=fixture({personalMotion:true});try{
 const run=(visitor,host,stage)=>{assert(f.s.startVisit(visitor,host,{transfer:true}));if(stage){until(f,()=>f.s.transfer.active&&f.s.transfer.stage===stage,400);f.s.endVisit('검수 중단');}until(f,()=>!f.s.visit,400,()=>{assert(f.s.transfer.handError<1e-5);});assert(f.s.transfer.diagnostics().pages.every(p=>p.owner.startsWith('desk:')));assert.deepEqual(f.s.book.snapshot(),{});};
 for(let i=0;i<5;i++){run(ids[i],ids[(i+1)%5]);assert.equal(f.s.transfer.transfers,2);assert(f.s.visitHistory.at(-1).transferComplete);}
 for(const [i,stage]of ['pickup','grasp','present','receive','accept','read','giveback','regrasp','return','release'].entries()){
  const host=ids.find(id=>f.s.transfer.available(id)),visitor=ids.find(id=>id!==host);run(visitor,host,stage);
 }
 }finally{f.close();}
});
test('rapid work result cues stay restrained and do not accumulate queued presentation or change business input',()=>{
 const f=fixture({personalMotion:true});try{
 for(const action of ['success','error','sending','receiving','acknowledge'])for(let n=0;n<3;n++){
  f.vm.actors=ids.map(agentId=>({agentId,pose:action,cue:action+n}));f.runtime.setViewModel(f.vm);step(f,.4);
  for(const id of ids){const actor=f.s.desks[id].actor;assert.equal(f.s.rawIncoming(id).pose,action);assert(f.s.pendingCues.size<=5);assert.equal(f.s.personalMotion.rows.get(id).reaction,action);const hand=part(actor,'NaraHandR');assert(hand.matrixWorld.elements.every(Number.isFinite));assert(Math.abs(hand.position.length()-.26)<.05);}
 }
 f.vm.actors=ids.map(agentId=>({agentId,pose:'idle'}));f.runtime.setViewModel(f.vm);step(f,2);assert.equal(f.s.pendingCues.size,0);
 }finally{f.close();}
});
