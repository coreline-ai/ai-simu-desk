import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,until,step} from './living-fixture.mjs';
test('coffee brew and retrieve each start a fresh personal attention beat without changing machine durations',()=>{
 const f=fixture({personalMotion:true});try{assert(f.s.startCoffee('nara'));until(f,()=>f.s.coffee.rows.get('nara')?.phase==='brew',300);step(f,.7);assert(f.s.personalMotion.rows.get('nara').attentionPitch>0);until(f,()=>f.s.coffee.rows.get('nara')?.phase==='retrieve',30);step(f,.7);assert(f.s.personalMotion.rows.get('nara').attentionPitch>0);f.s.cancelAll();until(f,()=>!f.s.coffee.rows.size,300);assert.equal(f.s.cups.nara.owner,'desk');assert.deepEqual(f.s.book.snapshot(),{});}finally{f.close();}
});

test('v11 board comparison retains its original fixed gaze target while v12 follows its personal marker',()=>{
 for(const personalMotion of [false,true]){const f=fixture({personalMotion});try{assert(f.s.startReview(['nara','jun']));until(f,()=>f.s.huddles.current?.sequence?.pointer.stage==='use',400);step(f,.9);const q=f.s.huddles.current.sequence;assert.deepEqual(q.state().gazePoint,personalMotion?q.pointer.target().toArray():[.1,1.16,.625]);}finally{f.close();}}
});
