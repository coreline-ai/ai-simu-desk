import test from'node:test';import assert from'node:assert/strict';import{createFakeAnswer,FAKE_ENGINE_VERSION}from'../domain/fake-answer.js';
import{openDatabase}from'../db/database.js';import{createStudio}from'../db/studio-store.js';import{user,runs}from'../db/schema.js';import{eq}from'drizzle-orm';import{randomUUID}from'node:crypto';
test('excluded tasks cannot reappear through items, five-role handoff summaries or inherited revisions',()=>{
 const job={runId:'decision',agentId:'nara' as const,scenario:'normal' as const,prompt:'로그인 제외. 개발 계획을 작성해줘'};
 const solo=createFakeAnswer(job),team=createFakeAnswer({...job,team:true});
 assert.equal(solo.decision?.status,'needs_input');assert.deepEqual(solo.items,[]);assert.equal(team.decision?.status,'needs_input');assert(!team.body.includes('이메일 로그인'));assert(team.items.every(s=>!s.includes('이메일 로그인')));assert.equal(team.team?.stages.length,5);
 for(const mode of ['revise','handoff'] as const){const result=createFakeAnswer({...job,agentId:'jun',prompt:mode==='revise'?'표로 정리해줘':'로그인 개발 계획을 작성해줘',context:{runId:'source',version:1,agentId:'nara',prompt:job.prompt,body:'이메일 로그인과 게스트 진입을 구현합니다.',output:'이메일 로그인과 게스트 진입을 구현합니다.',mode}});assert.equal(result.decision?.status,'needs_input');assert.deepEqual(result.items,[]);assert(!result.body.includes('이메일 로그인'));}
 assert.equal(solo.version,FAKE_ENGINE_VERSION);
});
test('stored rules-3.1 answers without decision metadata survive rules-3.2 restart and retry unchanged',async()=>{
 const d=await openDatabase();let now=1000;try{
  await d.db.insert(user).values({id:'historical',name:'Old user',email:'old-answer@qa.test'});const s=createStudio(d,{answer:job=>createFakeAnswer(job).text,delayMs:65,now:()=>now}),space=await s.personalWorkspace('historical','Old user');
  for(const scenario of ['normal','failure'] as const){const run=await s.startRun('historical',space.id,{prompt:'과거 계획',agentId:'jun',scenario,approvalRequired:false},randomUUID()),frozen={...createFakeAnswer({runId:run.id,prompt:'과거 계획',agentId:'jun',scenario}),version:'rules-3.1',text:'Historically stored answer stays unchanged. '.repeat(6),body:'Historically stored answer stays unchanged. '.repeat(6),decision:undefined};await d.db.update(runs).set({generatedAnswer:frozen}).where(eq(runs.id,run.id));const next=createStudio(d,{answer:()=> 'NEW ENGINE MUST NOT REPLACE STORED CONTENT',delayMs:65,now:()=>now});await next.snapshot('historical',space.id);now+=100000;const done=(await next.snapshot('historical',space.id)).runs.find(r=>r.id===run.id)!;assert.equal(done.answerMeta?.version,'rules-3.1');assert.equal(done.answerMeta?.decision,undefined);
   if(scenario==='normal')assert.equal(done.output,frozen.text);else{assert.equal(done.status,'failed');const retry=await next.retry('historical',run.id,randomUUID());await next.snapshot('historical',space.id);now+=100000;const retried=(await next.snapshot('historical',space.id)).runs.find(r=>r.id===retry.id)!;assert.equal(retried.output,frozen.text);assert.equal(retried.answerMeta?.version,'rules-3.1');}
  }
 }finally{await d.close();}
});
test('conflicts do not publish action items while ordinary free, time and people conditions remain valid',()=>{
 for(const team of [false,true]){const invalid=createFakeAnswer({runId:'conflict',agentId:'jun',scenario:'normal',prompt:'무료로 예산 10만원 개발 계획',team});assert.equal(invalid.decision?.status,'needs_input');assert.deepEqual(invalid.items,[]);}
 const valid=createFakeAnswer({runId:'valid',agentId:'jun',scenario:'normal',prompt:'2주 1명 무료 개발 계획',team:true});assert.equal(valid.decision?.status,'ready');assert.equal(valid.team?.stages.length,5);assert(valid.items.length===5);assert.equal(valid.analysis.people,1);assert.equal(valid.analysis.days,14);
});
