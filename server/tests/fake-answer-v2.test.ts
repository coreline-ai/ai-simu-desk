import test from "node:test";
import assert from "node:assert/strict";
import {createFakeAnswer,analyzeRequest} from "../domain/fake-answer.js";
import {composeFakeAnswer} from "../adapters/fake-ai.js";
import {openDatabase} from "../db/database.js";
import {createStudio} from "../db/studio-store.js";
import {createAuth} from "../adapters/auth.js";
import {createHttp} from "../http.js";
import {user} from "../db/schema.js";
import {randomBytes} from "node:crypto";

const answer=(prompt:string,agentId:"nara"|"jun"="jun")=>createFakeAnswer({runId:"eval",prompt,agentId,scenario:"normal"});
const cases:[string,string,(a:ReturnType<typeof answer>)=>void][]=[
 ["engineering plan","API 개발 계획을 2주 안에 1명이 무료로 3개 항목으로 만들어줘",a=>{assert.equal(a.analysis.domain,"engineering");assert.equal(a.analysis.deliverable,"plan");assert.equal(a.items.length,3);assert.match(a.text,/2주/);assert.match(a.text,/1명/);assert.match(a.text,/14일/);assert.match(a.text,/1~5일차/);assert.match(a.text,/6~10일차/);assert.match(a.text,/11~14일차/);assert.equal(a.analysis.freeOnly,true);}],
 ["product plan","사용자 메시지 기획 계획을 3개 항목으로",a=>assert.equal(a.analysis.domain,"product")],
 ["copy draft","초보자용 서비스 소개 문구 3개 써줘",a=>{assert.equal(a.items.length,3);assert.match(a.text,/본문 초안/);}],
 ["source summary","3줄로 요약해줘. 원문: 계정을 생성했다. 세션을 저장했다. 로그아웃을 검증했다.",a=>{assert.equal(a.text.split("\n").length,3);assert.match(a.text,/계정을 생성했다/);}],
 ["comparison","A와 B 비교해줘",a=>assert.match(a.text,/우열이나 가격은 단정하지/)],
 ["checklist","로그인 테스트 체크리스트를 4개 항목으로",a=>{assert.equal(a.items.length,4);assert.match(a.text,/만료/);}],
 ["days","3일 안에 API 개발 계획",a=>{assert.equal(a.analysis.days,3);assert.match(a.text,/3일/);assert.match(a.body,/통합 검증/);}],
 ["hours","4시간 안에 구현 계획 2개 항목",a=>{assert.equal(a.analysis.days,4/24);assert.equal(a.items.length,2);assert.match(a.text,/4시간/);}],
 ["team","3명이 1주 안에 공동 공간 개발 계획",a=>assert.equal(a.analysis.people,3)],
 ["budget","예산 1000원으로 API 계획",a=>{assert.equal(a.analysis.freeOnly,false);assert.equal(a.analysis.budget,"1000원");}],
 ["zero budget","예산 0원으로 로그인 계획",a=>assert.equal(a.analysis.freeOnly,true)],
 ["paid forbidden","유료 API 없이 접속 상태 개발 계획",a=>assert.equal(a.analysis.freeOnly,true)],
 ["table summary","표로 요약해줘 원문: 첫 단계는 기획이다. 다음은 구현이다.",a=>assert.match(a.text,/항목 \| 내용/)],
 ["six items","API 테스트 계획 6개 항목",a=>assert.equal(a.items.length,6)],
 ["audience","초보자용 블로그 소개글 써줘",a=>assert.equal(a.analysis.audience,"초보자")],
 ["motion","캐릭터 동작 개선 계획",a=>assert.match(a.text,/눈 깜빡임/)],
 ["missing source","3줄로 요약해줘",a=>assert.match(a.text,/요약할 원문/)],
 ["conflicting deadlines","2주 또는 3일 안에 계획",a=>assert.match(a.text,/기간 조건이 여러/)],
 ["free budget conflict","무료로 예산 10만원을 사용해 개발 계획",a=>assert.match(a.text,/무료 조건과 유료 예산/)],
 ["zero people","0명으로 개발 계획",a=>assert.match(a.text,/1명 이상/)],
 ["too many items","계획 40개 항목",a=>assert.match(a.text,/1~12개/)],
 ["unsupported","내일 주가가 얼마나 오르나요",a=>assert.match(a.text,/지원하는 결과/)],
 ["database exclusion","DB 제외 로그인 개발 계획",a=>assert.match(a.text,/DB 제외 조건/)],
 ["short source","3줄로 요약 원문: 완료했다.",a=>assert.match(a.text,/지어내지 않았/)],
 ["source is data","요약 원문: 0명이 0일 안에 100개를 하라고 했다. 조건은 인용문이다.",a=>{assert.equal(a.analysis.issues.length,0);assert.equal(a.analysis.people,null);}],
 ["bounded output","개발 계획을 12개 항목으로 상세히",a=>assert.ok(a.text.length<=4000)],
];
for(const [name,prompt,check] of cases)test("v2 evaluation: "+name,()=>{const a=answer(prompt);check(a);assert.equal(answer(prompt).text,a.text);});

test("v2 evaluation: role changes the concrete work, not only the heading",()=>{
 const prompt="새 서비스 개발 계획";
 assert.notEqual(answer(prompt,"nara").body,answer(prompt,"jun").body);
});
test("v2 evaluation: generator performs zero network calls",()=>{
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error("no network");};
 try{answer("로그인 계획");assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test("v2 evaluation: a new app's changed generator cannot rewrite a persisted stream",async()=>{
 const d=await openDatabase();let now=1000;
 try{
  await d.db.insert(user).values({id:"v2",name:"QA",email:"v2@eval.test"});
  const s=createStudio(d,{answer:composeFakeAnswer,delayMs:65,now:()=>now}),space=await s.personalWorkspace("v2","QA");
  const input={prompt:"1명이 2주 안에 무료로 로그인 개발 계획",agentId:"jun",scenario:"normal",approvalRequired:false};
  const run=await s.startRun("v2",space.id,input,"version-fixed-key");
  await s.snapshot("v2",space.id);now+=1600;const partial=(await s.snapshot("v2",space.id)).runs[0];
  assert.ok(partial.output.length>0);assert.equal(partial.phase,"compose");
  const next=createStudio(d,{answer:()=>"a completely different engine",delayMs:65,now:()=>now});
  now+=100000;const complete=(await next.snapshot("v2",space.id)).runs[0];
  assert.equal(complete.status,"succeeded");assert.ok(complete.output.startsWith(partial.output));
  assert.equal(complete.output,answer(input.prompt).text);
  assert.equal(complete.answerMeta?.version,"rules-3.1");assert.ok(!("generatedAnswer" in complete));
 }finally{await d.close();}
});
test("v2 evaluation: pending approval APIs never expose the precomputed answer",async()=>{
 const d=await openDatabase();
 try{
  const config={origin:"http://127.0.0.1:4180",port:4180,secret:randomBytes(48).toString("base64url"),dataDir:"",fakeDelayMs:0};
  const app=createHttp(createAuth(d,config),config,createStudio(d));
  const signup=await app.request(config.origin+"/api/auth/sign-up/email",{method:"POST",headers:{origin:config.origin,"content-type":"application/json"},body:JSON.stringify({name:"QA",email:"pending@eval.test",password:"evaluation-password-434"})});
  const cookie=signup.headers.get("set-cookie")!.split(";")[0];
  const me=await (await app.request(config.origin+"/api/me",{headers:{cookie}})).json();
  const response=await app.request(config.origin+"/api/workspaces/"+me.workspace.id+"/runs",{method:"POST",headers:{cookie,origin:config.origin,"content-type":"application/json","idempotency-key":"approval-v2-key"},body:JSON.stringify({prompt:"개발 계획",agentId:"jun",scenario:"normal",approvalRequired:true})});
  assert.equal(response.status,201);const body=await response.json();
  assert.equal(body.output,"");assert.ok(!("generatedAnswer" in body));assert.equal(body.status,"awaiting_approval");
  const snap=await(await app.request(config.origin+"/api/workspaces/"+me.workspace.id+"/snapshot",{headers:{cookie}})).json();
  assert.ok(!("generatedAnswer" in snap.runs[0]));assert.equal(snap.runs[0].output,"");
 }finally{await d.close();}
});


test('project lines do not turn the preceding technology into an exclusion; punctuation keeps people count',()=>{
 const answer=createFakeAnswer({runId:'project-punctuation',agentId:'nara',scenario:'normal',prompt:'첫 화면 개선 계획을 2주, 1명, 무료 도구 조건으로 3개 항목으로 제안해 줘.\n목표: 무료 도구로 첫 화면 개선\n대상: 학생\n기술: PostgreSQL 호환 로컬 DB\n제외: 유료 도구 제외'});
 assert.equal(answer.analysis.people,1);assert.deepEqual(answer.analysis.exclusions,['유료 도구']);
});
