import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,until,step} from './living-fixture.mjs';
import {drinkRecipe} from '../../pilot-3d/personal-office/recipes.mjs';
const ids=['nara','sora','jun','min','leo'];
test('personal drink and support use the same normalized phase and settle before return',()=>{
 for(const id of ids){const phases=new Set();for(let u=0;u<=1;u+=.005){const d=drinkRecipe(id,u);phases.add(d.phase);assert(d.amount>=0&&d.amount<=1);assert(d.support>=0&&d.support<=1);if(d.support>.99)assert(d.amount>.7);}assert(phases.has('prepare')&&phases.has('sip')&&phases.has('lower'));assert.equal(drinkRecipe(id,0).support,0);assert.equal(drinkRecipe(id,1).support,0);}
});
test('five cup recipes preserve two hand contact, timings and ownership; cancel each stage',()=>{
 const f=fixture({personalMotion:true});try{
 const durations=new Set();for(const id of ids){const c=f.s.cups[id];durations.add(c.duration('sip'));assert(f.s.startCup(id));until(f,()=>!f.s.records.has(id),30,()=>{assert(c.reachError<1e-5);for(const row of f.s.cupSupport.diagnostics().active)assert(row.error<1e-5);});assert.equal(c.owner,'desk');assert(f.s.cupSupport.counts[id]>0);
 for(const stage of ['reach','grasp','lift','sip','lower','place','release']){until(f,()=>f.s.idle(id),15);assert(f.s.startCup(id));until(f,()=>c.state===stage,30);f.vm.actors.find(a=>a.agentId===id).pose='error';f.runtime.setViewModel(f.vm);until(f,()=>!f.s.records.has(id)&&!f.s.cupSupport.controls(id),30);assert.equal(c.owner,'desk');f.vm.actors.find(a=>a.agentId===id).pose='idle';f.runtime.setViewModel(f.vm);}
 }assert.equal(durations.size,5);
 }finally{f.close();}
});
test('personal carry and table drinking keep machine duration and fair queue policy',()=>{
 const f=fixture({personalMotion:true});try{for(const id of ids)assert(f.s.startCoffee(id));until(f,()=>!f.s.coffee.rows.size,1000);for(const id of ids){assert.equal(f.s.coffee.counts[id],1);assert.equal(f.s.cups[id].owner,'desk');}assert.deepEqual(f.s.book.snapshot(),{});assert.equal(f.s.coffee.presses,5);
 assert(f.s.startMeeting(['nara','jun']));until(f,()=>f.s.session?.phase==='discussion',400);step(f,8);f.s.cancelAll();until(f,()=>!f.s.records.size&&!f.s.session,400);for(const id of ids)assert.equal(f.s.cups[id].owner,'desk');
 }finally{f.close();}
});
