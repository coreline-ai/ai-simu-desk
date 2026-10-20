import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFakeAnswer,type TeamAnswer} from '../domain/fake-answer.js';
import {TEAM} from '../domain/team.js';
import {openDatabase} from '../db/database.js';
import {createStudio} from '../db/studio-store.js';
import {user} from '../db/schema.js';
import {parseInput} from '../domain/contracts.js';
const input={prompt:'5명이 2주 안에 무료로 로그인 개발 계획을 만들어 줘.',agentId:'nara' as const,scenario:'normal' as const,approvalRequired:true,team:true};
test('five roles produce separate outputs with ordered handoffs and frozen segment boundaries',()=>{
 const answer=createFakeAnswer({...input,runId:'team-eval'});
 assert.deepEqual(answer.team?.members,TEAM.map(p=>p.id));assert.ok(answer.text.length<=4000);assert.equal(answer.team?.total,answer.text.length);assert.equal(answer.analysis.people,5);
 for(const [i,person] of TEAM.entries()){
  const stage:TeamAnswer['stages'][number]=answer.team!.stages[i];const section=answer.text.slice(stage.start,stage.end);assert.ok(section.includes(person.name+' · '+person.role));
  if(i){assert.equal(stage.from,TEAM[i-1].id);assert.ok(section.includes('받은 내용 · '+TEAM[i-1].name));}
 }
 assert.match(answer.text,/화면 구성/);assert.match(answer.text,/검증 범위/);assert.match(answer.text,/결과 수집/);
 const outputs=TEAM.map(person=>createFakeAnswer({...input,team:false,agentId:person.id,runId:'single'}).body);assert.equal(new Set(outputs).size,5);
 assert.throws(()=>parseInput({...input,team:'yes'}));assert.throws(()=>parseInput({...input,sourceRunId:randomUUID(),mode:'revise'}));
});
test('team run persists, respects approval and access; retry keeps its five-role frozen answer',async()=>{
 const d=await openDatabase();try{
 await d.db.insert(user).values([{id:'owner',name:'Owner',email:'owner@five.test'},{id:'viewer',name:'Viewer',email:'viewer@five.test'}]);
 let clock=1000;const simulation={answer:(job:Parameters<typeof createFakeAnswer>[0])=>createFakeAnswer(job).text,delayMs:5,now:()=>clock};
 const s=createStudio(d,simulation),w=await s.createWorkspace('owner','Five people',randomUUID());const invite=await s.issueInvite('owner',w.id,'viewer',w.revision);await s.joinWorkspace('viewer',invite.code);
 await assert.rejects(()=>s.startRun('viewer',w.id,input,randomUUID()),{status:403});
 const started=await s.startRun('owner',w.id,input,'five-person-request');assert.equal((await s.startRun('owner',w.id,input,'five-person-request')).id,started.id);
 let snap=await s.snapshot('viewer',w.id);assert.equal(snap.runs[0].team,true);assert.equal(snap.runs[0].output,'');assert.equal(snap.runs[0].answerMeta?.team?.stages.length,5);assert.equal('generatedAnswer' in snap.runs[0],false);
 await s.approve('owner',started.id,started.version,true);await s.snapshot('owner',w.id);clock+=40000;
 snap=await s.snapshot('owner',w.id);assert.equal(snap.runs[0].status,'succeeded');assert.match(snap.runs[0].output,/레오 · 정리/);
 const restored=await createStudio(d,simulation).snapshot('owner',w.id);assert.deepEqual(restored.runs[0],snap.runs[0]);
 const cancelled=await s.startRun('owner',w.id,{...input,approvalRequired:false},randomUUID());await s.cancel('owner',cancelled.id);
 const retry=await s.retry('owner',cancelled.id,randomUUID());snap=await s.snapshot('owner',w.id);assert.equal(snap.runs.find(r=>r.id===retry.id)?.team,true);assert.deepEqual(snap.runs.find(r=>r.id===retry.id)?.answerMeta?.team,snap.runs.find(r=>r.id===cancelled.id)?.answerMeta?.team);
 await s.cancel('owner',retry.id);await s.snapshot('owner',w.id);
 for(const person of TEAM){const solo=await s.startRun('owner',w.id,{...input,team:false,approvalRequired:false,agentId:person.id},randomUUID());await s.cancel('owner',solo.id);}
 }finally{await d.close();}
});
