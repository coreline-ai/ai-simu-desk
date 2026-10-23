import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fixture,until,step} from './living-fixture.mjs';
import {workRecipe} from '../../pilot-3d/personal-office/recipes.mjs';

const ids=['nara','sora','jun','min','leo'];
test('15 personal work recipes have observe, act, pause, check and truly held trajectories',()=>{
 const signatures=[];
 for(const id of ids)for(let variant=0;variant<3;variant++){
  const seen=new Set();for(let t=0;t<5.4;t+=.02)seen.add(workRecipe(id,variant,t).phase);
  assert.deepEqual([...seen].sort(),['act','check','observe','pause']);
  const a=workRecipe(id,variant,.04),b=workRecipe(id,variant,.12);assert.equal(a.sample,b.sample);
  signatures.push(workRecipe(id,variant,.8).sample);
 }
 assert(new Set(signatures.map(x=>x.toFixed(4))).size>=10);
});
test('all 15 recipes preserve pen/hand contact, ownership, return and all-stage cancellation',()=>{
 const f=fixture({personalMotion:true});try{
 for(const id of ids)for(let variant=0;variant<3;variant++){
  const d=f.s.desks[id];assert(d.start({variant}));const phases=new Set();
  until(f,()=>!d.busy,20,()=>{if(d.stage==='use'){phases.add(d.recipe().phase);assert(d.handError<1e-5);assert(d.tipError<.001);}});
  assert.equal(phases.size,4);assert.equal(d.owner,'desk');assert.equal(d.events%2,0);
  for(const stage of ['reach','grasp','use','replace','release','retract']){
   assert(d.start({variant}));until(f,()=>d.stage===stage,20);d.cancel();until(f,()=>!d.busy,20);assert.equal(d.owner,'desk');
  }
 }
 assert.equal(f.s.violations.length,0);
 }finally{f.close();}
});
test('real work cancels manual recipe, absence cancels real recipe, pause holds the recipe',()=>{
 const f=fixture({personalMotion:true});try{
 assert(f.s.startRole('nara'));step(f,2.5);f.vm.actors[0].pose='typing';f.runtime.setViewModel(f.vm);assert(f.s.desks.nara.returning);until(f,()=>f.s.desks.nara.work&&f.s.desks.nara.busy,40);
 f.runtime.setViewModel({...f.vm,motionPaused:true});const t=f.s.desks.nara.time;step(f,2);assert.equal(f.s.desks.nara.time,t);
 f.runtime.setViewModel({...f.vm,actors:f.vm.actors.filter(a=>a.agentId!=='nara')});until(f,()=>!f.s.desks.nara.busy,20);assert.equal(f.s.desks.nara.owner,'desk');
 }finally{f.close();}
});
