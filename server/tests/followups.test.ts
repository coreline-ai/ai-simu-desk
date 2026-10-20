import test from "node:test";
import assert from "node:assert/strict";
import {eq} from "drizzle-orm";
import {openDatabase} from "../db/database.js";
import {createStudio} from "../db/studio-store.js";
import {user,runs,tasks} from "../db/schema.js";
import {createFakeAnswer} from "../domain/fake-answer.js";
import {composeFakeAnswer,FakeAgent} from "../adapters/fake-ai.js";
import {createRunner} from "../application/runner.js";
import {setTimeout as wait} from "node:timers/promises";

test("source revisions are explicit, remain in one authorized workspace, and handoff requires approval",async()=>{
  const d=await openDatabase();let now=1000;
  try{
    await d.db.insert(user).values(["owner","viewer","outsider"].map(id=>({id,name:id,email:id+"@follow.test"})));
    const make=()=>createStudio(d,{answer:composeFakeAnswer,delayMs:65,now:()=>now});const s=make();
    const space=await s.createWorkspace("owner","후속 작업","followup-space-key");
    const invite=await s.issueInvite("owner",space.id,"viewer",space.revision);await s.joinWorkspace("viewer",invite.code);
    const other=await s.personalWorkspace("owner","Owner");
    const input={prompt:"1명이 2주 동안 무료로 로그인 기획 계획을 3개 항목으로",agentId:"nara",approvalRequired:false,scenario:"normal"};
    const source=await s.startRun("owner",space.id,input,"source-task-key");
    await assert.rejects(()=>s.startRun("owner",space.id,{...input,sourceRunId:source.id,mode:"revise"},"not-ready-key"),{status:409}); // Active work is rejected first.
    await s.snapshot("owner",space.id);now+=100000;const completed=(await s.snapshot("owner",space.id)).runs[0];assert.equal(completed.status,"succeeded");
    await assert.rejects(()=>s.startRun("viewer",space.id,{...input,sourceRunId:source.id,mode:"revise"},"viewer-follow-key"),{status:403});
    await assert.rejects(()=>s.startRun("outsider",space.id,{...input,sourceRunId:source.id,mode:"revise"},"outside-follow-key"),{status:404});
    await assert.rejects(()=>s.startRun("owner",other.id,{...input,sourceRunId:source.id,mode:"revise"},"cross-follow-key"),{status:404});
    await assert.rejects(()=>s.startRun("owner",space.id,{...input,sourceRunId:source.id,mode:"handoff"},"same-agent-key"),{status:400});
    const revised=await s.startRun("owner",space.id,{...input,prompt:"이전 결과를 3줄로 요약해줘.",sourceRunId:source.id,mode:"revise"},"revise-task-key");
    const retrySame=await s.startRun("owner",space.id,{...input,prompt:"이전 결과를 3줄로 요약해줘.",sourceRunId:source.id,mode:"revise"},"revise-task-key");assert.equal(retrySame.id,revised.id);
    await s.snapshot("owner",space.id);
    // The original changes after capture; an ongoing revision must retain its input.
    await d.db.update(runs).set({output:"원본이 나중에 바뀜",version:999}).where(eq(runs.id,source.id));
    now+=100000;let snap=await make().snapshot("owner",space.id);const result=snap.runs.find(r=>r.id===revised.id)!;
    assert.equal(result.output.split("\n").length,3);assert.ok(!result.output.includes("나중에 바뀜"));
    assert.equal(result.source?.version,completed.version);assert.match(result.output,/계정|세션/);
    assert.equal(result.answerMeta?.analysis.days,14);
    const originalTask=(await d.db.select().from(tasks).where(eq(tasks.id,source.taskId)))[0];
    const stored=(await d.db.select().from(tasks).where(eq(tasks.id,revised.taskId)))[0];
    assert.equal(stored.sourceContext?.prompt,originalTask.prompt);
    // Restore only this test's deliberately modified source for handoff.
    await d.db.update(runs).set({output:completed.output,version:completed.version}).where(eq(runs.id,source.id));
    const handoff=await s.startRun("owner",space.id,{...input,agentId:"jun",prompt:"구현 계획과 완료 테스트를 작성해줘",sourceRunId:source.id,mode:"handoff"},"handoff-task-key");
    assert.equal(handoff.status,"awaiting_approval");
    now+=100000;assert.equal((await s.snapshot("owner",space.id)).runs.find(r=>r.id===handoff.id)?.output,"");
    await s.approve("owner",handoff.id,handoff.version,true);await s.snapshot("owner",space.id);now+=100000;
    const handoffResult=(await s.snapshot("owner",space.id)).runs.find(r=>r.id===handoff.id)!;
    assert.match(handoffResult.output,/인계받은 요구사항/);assert.match(handoffResult.output,/구현 작업과 테스트/);assert.match(handoffResult.output,/14일/);
    assert.equal(handoffResult.source?.agentId,"nara");
    assert.equal(handoffResult.answerMeta?.analysis.freeOnly,true);
    const bad=await s.startRun("owner",space.id,{...input,scenario:"failure",sourceRunId:source.id,mode:"revise",prompt:"표로 정리해줘"},"failure-follow-key");
    await s.snapshot("owner",space.id);now+=100000;await s.snapshot("owner",space.id);
    await assert.rejects(()=>s.startRun("owner",space.id,{...input,sourceRunId:bad.id,mode:"revise"},"failed-source-key"),{status:400});
    const retried=await createStudio(d,{answer:()=>"changed engine",delayMs:65,now:()=>now}).retry("owner",bad.id,"retry-follow-key");await s.snapshot("owner",space.id);now+=100000;
    const retriedResult=(await make().snapshot("owner",space.id)).runs.find(r=>r.id===retried.id)!;
    assert.equal(retriedResult.source?.runId,source.id);assert.equal(retriedResult.status,"succeeded");assert.match(retriedResult.output,/항목 \| 내용/);
    const revision=(await s.snapshot("owner",space.id)).workspace.revision;
    await s.updateMember("owner",space.id,"viewer",null,revision);
    await assert.rejects(()=>s.startRun("viewer",space.id,{...input,sourceRunId:source.id,mode:"revise"},"revoked-follow-key"),{status:404});
  }finally{await d.close();}
});

test("revision obeys line/table format, preserves facts and rejects unsupported rewriting",()=>{
  const context={runId:"source",version:2,agentId:"nara" as const,prompt:"1명이 2주 안에 무료로 개발 계획",output:"1~5일차 계정.\n6~10일차 저장.\n11~14일차 검증.",mode:"revise" as const};
  const make=(prompt:string)=>createFakeAnswer({runId:"new",agentId:"nara",scenario:"normal",prompt,context});
  assert.equal(make("3줄로 요약").text.split("\n").length,3);assert.match(make("3줄로 요약").text,/1~5일차/);
  assert.match(make("표로 정리").text,/항목 \| 내용/);
  const next=createFakeAnswer({runId:"chain",agentId:"jun",scenario:"normal",prompt:"구현 계획으로 바꿔줘",context:{...context,prompt:"3줄로 요약해줘",mode:"handoff",conditions:{days:14,deadline:"2주",people:1,budget:null,freeOnly:true,exclusions:[]}}});
  assert.equal(next.analysis.days,14);assert.equal(next.analysis.freeOnly,true);assert.match(next.text,/14일/);
  assert.match(make("전체 의미를 완전히 새롭게 창작해줘").text,/지원하는 수정/);
  assert.match(make("예산 10만원으로 수정").text,/무료 조건/);
});

test("local worker consumes the exact frozen followup result",async()=>{
 const d=await openDatabase(),s=createStudio(d),runner=createRunner(s,new FakeAgent(0),{pollMs:5});
 try{
  await d.db.insert(user).values({id:"local-follow",name:"QA",email:"local@follow.test"});const space=await s.personalWorkspace("local-follow","QA");
  const source=await s.startRun("local-follow",space.id,{prompt:"소개 문구 3개 써줘",agentId:"nara",approvalRequired:false,scenario:"normal"},"local-source-key");
  await s.claim();const sourceJob=(await d.db.select().from(runs).where(eq(runs.id,source.id)))[0];
  await s.progress(source.id,sourceJob.generatedAnswer!.text);await s.finish(source.id,"succeeded");
  const revised=await s.startRun("local-follow",space.id,{prompt:"3줄로 요약해줘",agentId:"nara",approvalRequired:false,scenario:"normal",sourceRunId:source.id,mode:"revise"},"local-revise-key");
  await runner.start();
  for(let i=0;i<300&&await s.getStatus(revised.id)!=="succeeded";i++)await wait(10);
  const result=(await s.snapshot("local-follow",space.id)).runs[0];
  assert.equal(result.status,"succeeded");assert.equal(result.output.split("\n").length,3);assert.ok(result.source);
 }finally{await runner.stop();await d.close();}
});
