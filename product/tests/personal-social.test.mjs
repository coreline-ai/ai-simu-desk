import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,until,step} from './living-fixture.mjs';
import {ResponsiveExchange} from '../../pilot-3d/activities/responsive-exchange.mjs';
const ids=['nara','sora','jun','min','leo'];
test('personal conversation prepares, takes turns and settles without changing acknowledgement lengths',()=>{
 const personal={has:()=>true};for(const a of ids)for(const b of ids.filter(id=>id!==a)){
 const x=new ResponsiveExchange([a,b],'test',{sofa:true,personal});let prepare=false,speak=false;
 for(let t=0;t<40&&!x.done;t+=1/30){const cues=x.ids.map(id=>x.cueFor(id));assert(cues.filter(c=>c.speaking).length<=1);prepare ||= cues.some(c=>c.responsePhase==='prepare');speak ||= cues.some(c=>c.responsePhase==='speak');for(const id of x.ids)x.present(id,x.phase,1/30);x.tick(1/30,true);}
 assert.equal(x.status,'complete');assert(prepare&&speak);assert.equal(x.speakers.size,2);
 }
});
test('all 20 ordered sofa pairs keep armrest/lap support, personal gestures and return',()=>{
 const f=fixture({personalMotion:true});try{for(const a of ids)for(const b of ids.filter(id=>id!==a)){
 assert(f.s.startSofaPair([a,b]));until(f,()=>!f.s.sofaPair,400,()=>{
 for(const row of Object.values(f.s.sofaSupport.diagnostics()))for(const hand of Object.values(row.hands)){assert(hand.error<1e-5);if(hand.planted)assert(Math.abs(hand.palmGap)<.003);}
 });assert.equal(f.s.pairHistory.at(-1).status,'complete');assert.deepEqual(f.s.book.snapshot(),{});
 }assert.deepEqual(f.s.violations,[]);
 }finally{f.close();}
});
test('personal visit invitation completes each role, cancels for work and never greets with an occupied prop hand',()=>{
 const f=fixture({personalMotion:true});try{
 for(let i=0;i<ids.length;i++){const visitor=ids[i],host=ids[(i+1)%ids.length];assert(f.s.startVisit(visitor,host));until(f,()=>!f.s.visit,300);assert.equal(f.s.visitHistory.at(-1).status,'complete');}
 assert(f.s.startSofaPair(['nara','jun']));until(f,()=>f.s.sofaPair?.phase==='discussion',300);f.vm.actors[0].pose='typing';f.runtime.setViewModel(f.vm);until(f,()=>!f.s.sofaPair,300);assert.equal(f.s.pairHistory.at(-1).status,'cancelled');
 for(const id of ids)if(f.s.cups[id].owner==='hand')assert(!f.s.reactions.free(id));assert.deepEqual(f.s.book.snapshot(),{});
 }finally{f.close();}
});

test('personal two-person meetings serialize during pickup, discussion and return without retaining the scheduler',()=>{
 const f=fixture({personalMotion:true});try{assert(f.s.startMeeting(['nara','jun']));assert.doesNotThrow(()=>JSON.stringify(f.runtime.diagnostics()));until(f,()=>f.s.session?.phase==='discussion',400);assert.doesNotThrow(()=>JSON.stringify(f.runtime.diagnostics()));f.s.cancelAll();until(f,()=>!f.s.session,400,()=>assert.doesNotThrow(()=>JSON.stringify(f.runtime.diagnostics())));}finally{f.close();}
});
