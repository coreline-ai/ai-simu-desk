import test from 'node:test';import assert from 'node:assert/strict';
import {simulationFrame} from '../application/simulation.js';
import {openDatabase} from '../db/database.js';import {createStudio} from '../db/studio-store.js';import {user} from '../db/schema.js';import {composeFakeAnswer} from '../adapters/fake-ai.js';
test('finite simulation returns exact output, partial failure and bounds without background execution',()=>{
  assert.equal(simulationFrame('A'.repeat(200),'normal',0,65).output,'');
  assert.equal(simulationFrame('A'.repeat(200),'normal',260,65).output.length,32);
  assert.equal(simulationFrame('A'.repeat(200),'failure',1000,65).output.length,96);
  assert.equal(simulationFrame('A'.repeat(200),'normal',86400000,65).status,'succeeded');
  assert.equal(simulationFrame('A'.repeat(200),'normal',30000,1000).status,'succeeded');
  assert.equal(simulationFrame('A'.repeat(2000),'normal',30000,1000).status,'failed');
  assert.equal(simulationFrame('A'.repeat(16001),'normal',1,1).status,'failed');
});
test('request-driven Fake AI survives a new app instance, preserves approval and handles failure/retry/cancel',async()=>{
  const d=await openDatabase();let time=1000;
  try{
    await d.db.insert(user).values({id:'simulation-user',name:'QA',email:'sim@example.test'});
    const make=()=>createStudio(d,{answer:composeFakeAnswer,delayMs:65,now:()=>time});let s=make();const space=await s.personalWorkspace('simulation-user','QA');
    const input={prompt:'서버리스 개발 계획 검토',agentId:'jun',approvalRequired:true,scenario:'normal'};
    const run=await s.startRun('simulation-user',space.id,input,'simulation-approval-key');
    time+=10000;assert.equal((await s.snapshot('simulation-user',space.id)).runs[0].status,'awaiting_approval');
    await s.approve('simulation-user',run.id,run.version,true);await s.events('simulation-user',space.id,0);time+=1200;
    let snap=await s.snapshot('simulation-user',space.id);assert.equal(snap.runs[0].status,'running');assert.ok(snap.runs[0].output.length>0);
    s=make();time+=100000;snap=await s.snapshot('simulation-user',space.id);assert.equal(snap.runs[0].status,'succeeded');assert.equal(snap.runs[0].output,composeFakeAnswer({runId:run.id,prompt:input.prompt,agentId:'jun',scenario:'normal'}));
    const failed=await s.startRun('simulation-user',space.id,{...input,approvalRequired:false,scenario:'failure'},'simulation-failure-key');await s.snapshot('simulation-user',space.id);time+=2000;
    assert.equal((await s.snapshot('simulation-user',space.id)).runs.find(r=>r.id===failed.id)?.status,'failed');
    const retry=await s.retry('simulation-user',failed.id,'simulation-retry-key');await s.snapshot('simulation-user',space.id);await s.cancel('simulation-user',retry.id);
    assert.equal((await s.snapshot('simulation-user',space.id)).runs.find(r=>r.id===retry.id)?.status,'cancelled');
  }finally{await d.close();}
});
