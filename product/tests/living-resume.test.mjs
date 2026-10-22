import test from 'node:test';import assert from 'node:assert/strict';
import{fixture,until,step}from'./living-fixture.mjs';
for(const id of['nara','sora','jun','min','leo'])test(id+' safely resumes interrupted sofa/window/rest/coffee after real work',()=>{
 const f=fixture();try{for(const kind of['sofa','window','rest','coffee']){
   f.s.resume.clear();const method={sofa:'startSofa',window:'startWindow',rest:'startRest',coffee:'startCoffee'}[kind];assert(f.s[method](id));
   if(kind==='coffee')until(f,()=>f.s.coffee.rows.get(id)?.phase==='out');else if(kind==='rest')step(f,3);else{until(f,()=>f.s.records.get(id)?.trip.stage==='rest');step(f,3);}
   const busy={...f.vm,actors:f.vm.actors.map(a=>({...a,pose:a.agentId===id?'typing':'idle'}))};f.runtime.setViewModel(busy);assert.equal(f.s.resume.pending.get(id)?.kind,kind);
   step(f,8);assert.equal(f.s.resume.history.filter(r=>r.kind===kind).length,0);f.runtime.setViewModel(f.vm);
   until(f,()=>f.s.resume.history.some(r=>r.kind===kind));assert(!f.s.resume.pending.has(id));assert(f.s.cups[id].diagnostics().cupCount===1);
   f.s.cancelAll();until(f,()=>!f.s.presentationBusy(id));assert.equal(f.s.cups[id].owner,'desk');assert.equal(Object.keys(f.s.book.snapshot()).length,0);
 }assert.equal(f.s.violations.length,0);}finally{f.close();}
});
test('explicit cancellation and participant removal discard resume intent',()=>{const f=fixture();try{assert(f.s.startRest('nara'));step(f,3);f.runtime.setViewModel({...f.vm,actors:f.vm.actors.map(a=>({...a,pose:a.agentId==='nara'?'typing':'idle'}))});assert(f.s.resume.pending.has('nara'));f.s.cancelAll();assert.equal(f.s.resume.pending.size,0);f.runtime.setViewModel(f.vm);until(f,()=>!f.s.presentationBusy('nara'));assert(f.s.startRest('nara'));step(f,3);f.runtime.setViewModel({...f.vm,actors:f.vm.actors.map(a=>({...a,pose:a.agentId==='nara'?'typing':'idle'}))});f.runtime.setViewModel({actors:f.vm.actors.filter(a=>a.agentId!=='nara')});step(f,1);assert.equal(f.s.resume.pending.size,0);}finally{f.close();}});
