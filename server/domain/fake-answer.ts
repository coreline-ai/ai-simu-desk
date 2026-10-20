import type {AgentJob} from "./contracts.js";
export const FAKE_ENGINE_VERSION = "rules-2";
export type AnswerPhase = "analyze"|"compose"|"review";
export interface SourceContext { runId:string; version:number; agentId:"nara"|"jun"; prompt:string; output:string; body?:string; conditions?:Pick<AnswerAnalysis,"days"|"deadline"|"people"|"budget"|"freeOnly"|"exclusions">; truncated?:boolean; mode:"revise"|"handoff" }
export interface AnswerAnalysis {
  domain:"engineering"|"product"|"writing"|"general";
  deliverable:"plan"|"summary"|"writing"|"comparison"|"checklist"|"general";
  topic:string; days:number|null; deadline:string|null; people:number|null;
  freeOnly:boolean; budget:string|null; exclusions:string[]; count:number|null;
  lines:number|null; table:boolean; audience:string|null; source:string|null; issues:string[];
}
const normalize=(s:string)=>s.replace(/\r/g,"").trim();
export function analyzeRequest(prompt:string):AnswerAnalysis {
  const text=normalize(prompt), flat=text.split(/(?:원문|자료|내용)\s*[:：]/)[0].replace(/\s+/g," ");
  const engineering=(flat.match(/개발|구현|API|DB|코드|버그|인증|로그인|테스트|협업|서버/gi)??[]).length;
  const product=(flat.match(/기획|사용자|타깃|타겟|메시지|화면|디자인|가치/gi)??[]).length;
  const writing=/블로그|소개글|문구|이메일|공지|카피|본문/.test(flat);
  const deliverable=/요약|줄여|줄이|축약/.test(flat)?"summary":/비교|장단점/.test(flat)?"comparison":/계획|일정|로드맵|마일스톤/.test(flat)?"plan":/체크리스트|점검표/.test(flat)?"checklist":writing?"writing":"general";
  const durations=[...flat.matchAll(/(\d+)\s*(주|일|시간)(?:일|간)?/g)];
  const unique=[...new Set(durations.map(m=>m[1]+m[2]))];
  const duration=durations[0];
  const people=flat.match(/(\d+)\s*(?:명|인)(?:이|으|에|의|만|\s|$)/)?.[1];
  const budget=flat.match(/(?:예산\s*)?(\d[\d,]*)\s*(만원|원)/);
  const freeOnly=!/무료(?:는|가)?\s*(?:아니|안|금지|제외)/.test(flat)&&/무료|유료\s*(?:도구|서비스|API)?\s*(?:없이|제외|금지)|예산\s*0|(?<![\d,])0\s*원/.test(flat);
  const count=flat.match(/(\d+)\s*(?:개|가지)(?:\s*(?:항목|단계|제안|추천))?/)?.[1];
  const lines=flat.match(/(\d+)\s*줄/)?.[1];
  const source=text.match(/(?:원문|자료|내용)\s*[:：]\s*([\s\S]+)/)?.[1]?.trim()??null;
  const exclusions=[...flat.matchAll(/(유료\s*(?:API|도구|서비스)?|[^\s,.;]{1,20}?)\s*(?:제외|금지|없이)/g)].map(m=>m[1]);
  const issues:string[]=[];
  if(unique.length>1)issues.push("기간 조건이 여러 개예요. 최종 마감 기간을 하나로 지정해 주세요.");
  if(duration&&Number(duration[1])<1)issues.push("기간은 1 이상의 숫자로 지정해 주세요.");
  if(people&&(!Number.isSafeInteger(Number(people))||Number(people)<1||Number(people)>100))issues.push("담당 인원은 1명 이상, 100명 이하로 지정해 주세요.");
  if(duration&&(!Number.isSafeInteger(Number(duration[1]))||Number(duration[1])*(duration[2]==="주"?7:duration[2]==="시간"?1/24:1)>365))issues.push("기간은 1년 이내 범위로 지정해 주세요.");
  if(count&&(Number(count)<1||Number(count)>12))issues.push("항목 수는 1~12개를 지원해요.");
  if(lines&&(Number(lines)<1||Number(lines)>12))issues.push("요약 길이는 1~12줄을 지원해요.");
  if(freeOnly&&budget&&Number(budget[1].replaceAll(",",""))>0)issues.push("무료 조건과 유료 예산이 함께 있어요. 어느 조건을 우선할까요?");
  if(freeOnly&&/유료\s*(?:도구|서비스|API)?\s*(?:필수|반드시|사용해야)/.test(flat))issues.push("무료 조건과 유료 사용 필수 조건이 충돌해요.");
  if(deliverable==="summary"&&!source)issues.push("요약할 원문을 ‘원문:’ 뒤에 넣거나 이전 결과를 선택해 주세요.");
  if(/로그인|인증/.test(flat)&&/DB|데이터베이스/i.test(exclusions.join(" ")))issues.push("DB 제외 조건에서는 영속 계정 저장을 전제로 할 수 없어요. 저장 없는 체험인지 확인해 주세요.");
  const topic=flat.split(/(?:원문|자료|내용)\s*[:：]/)[0].slice(0,180);
  return {domain:engineering>0&&engineering>=product?"engineering":product>0?"product":writing?"writing":"general",deliverable,topic,
    days:duration?Number(duration[1])*(duration[2]==="주"?7:duration[2]==="시간"?1/24:1):null,
    deadline:duration?duration[1]+duration[2]:null,people:people?Number(people):null,
    freeOnly,budget:budget?budget[1]+budget[2]:null,exclusions,count:count?Number(count):null,lines:lines?Number(lines):null,
    table:/표로|표\s*(?:형식|형태)|테이블/.test(flat),audience:flat.match(/(초보자|개발자|직장인|학생|소상공인|팀원)(?:용|에게|을|를|이|\s)/)?.[1]??null,
    source,issues};
}
const authSteps=[
  ["계정·세션","이메일 로그인과 게스트 진입, 로그아웃 경로 연결","로그인·만료·로그아웃 후 접근 차단"],
  ["저장·권한","서버 DB에 계정과 업무를 분리 저장하고 공간별 권한 적용","다른 사용자 공간 조회 거절·중복 요청 검사"],
  ["오류·화면","오류 안내와 작은 화면의 입력·버튼 보완","잘못된 입력·연결 실패·모바일 화면 확인"],
  ["통합 검증","처음 접속부터 저장 결과 재조회까지 연결","새로고침·재로그인 후 결과 유지"],
];
const collaborationSteps=[
  ["공동 공간","초대·참여·보기 전용과 업무 참여 권한 정리","초대 만료와 권한 없는 접근 차단"],
  ["진행 공유","나라·준의 업무 상태와 단계·답변 동기화","참여자가 같은 실행과 결과를 확인"],
  ["접속 상태","온라인·오프라인과 입장·퇴장 표시 보완","다중 탭·재접속·로그아웃 경계 확인"],
  ["통합 검증","연결 복구·모바일·권한 변경을 함께 점검","철회 후 접근 거절·결과 중복 생성 없음"],
];
const motionSteps=[
  ["상태 동작","대기·사고·작성·승인 대기를 구분","손·책상 관통 없음, 업무 상태와 동작 일치"],
  ["반응","완료·실패를 한 번 재생하고 대기로 복귀","재조회와 과거 기록 선택 시 중복 반응 없음"],
  ["자연스러움","눈 깜빡임과 동료별 리듬 보완","발·가구 고정, 동료 동작 독립"],
  ["성능 검증","좁은 화면·정지·숨김 탭·장면 복구 점검","같은 환경의 렌더 성능과 자원 수 비교"],
];
function baseSteps(a:AnswerAnalysis,agent:string):string[][] {
  if(/캐릭터|동작|애니메이션/.test(a.topic))return motionSteps;
  if(/협업|공동|접속/.test(a.topic))return collaborationSteps;
  if(/로그인|인증|세션/.test(a.topic))return authSteps;
  return agent==="jun"?
    [["입력·설계","입력·저장·출력의 계약과 최소 변경 범위 작성","정상·오류 입력과 완료 조건 명시"],
     ["최소 구현","핵심 흐름 하나를 화면과 서버에 연결","실제 입력에서 결과까지 실행"],
     ["경계 검사","취소·중복·권한·연결 오류 점검","재현 가능한 테스트 통과"],
     ["통합 검증","실행 방법과 남은 제약 기록","다른 세션에서 결과 재확인"]]:
    [["목표·대상","사용자와 해결할 문제를 한 문장으로 정의","대상·목표·성공 기준 1개씩 명시"],
     ["초안","핵심 메시지와 첫 행동, 결과 화면 구성","사용자가 다음 행동을 이해"],
     ["사용 흐름","시작→진행→결과의 화면과 안내 검토","중단·오류·대기 때 다음 행동 표시"],
     ["검토","작은 화면과 결과의 유용성 점검","목표와 비교하고 보완 항목 기록"]];
}
function stepsFor(a:AnswerAnalysis,agent:string):string[][] {
  const steps=baseSteps(a,agent);
  return agent==="nara"?steps.map(s=>[s[0]+" 요구사항","사용 흐름 초안: "+s[1],"사용자 관점 수용 기준: "+s[2]]):steps;
}
export interface FakeAnswer {version:string; analysis:AnswerAnalysis; text:string; body:string; checks:string[]; items:string[]}
function contentLines(text:string):string[]{
  return sentences(text).filter(s=>!/^요청:|Fake AI|핵심 단어:|조건:|원본:|기간 \||항목 \||[-|\s]+$|^(제목·문구 초안|본문 초안|화면·메시지 초안|인계받은 요구사항|구현 작업과 테스트)$/.test(s));
}
function sentences(text:string):string[] {
  return text.replace(/\r/g,"").split(/\n+|(?<=[.!?。])\s+/).map(s=>s.trim().replace(/^(?:[-*#]\s+|\d+[.)]\s+)/,"").trim()).filter(Boolean);
}
function planContent(a:AnswerAnalysis,agent:string){
  let body="",items:string[]=[];
    let steps=stepsFor(a,agent);
    const n=a.count??(a.days?Math.max(1,Math.min(4,Math.ceil(a.days/7))):4);
    // Additional requested rows split validation into concrete review passes.
    if(n<steps.length){
      const original=steps;
      steps=Array.from({length:n},(_,i)=>{
        const group=original.filter((_,j)=>Math.floor(j*n/original.length)===i);
        return [0,1,2].map(column=>group.map(s=>s[column]).join(" / "));
      });
    }else steps=Array.from({length:n},(_,i)=>steps[i]??["추가 검토 "+(i+1),"입력·권한·취소·중복·화면 중 아직 확인하지 않은 경계 점검","발견 항목과 재현·수정 결과 기록"]);
    const dayUnits=a.days!==null&&Number.isInteger(a.days)&&a.days>=n;
    const total=a.days?(dayUnits?a.days:Math.round(a.days*24)):null;
    if(total!==null&&n>total){body="주어진 기간보다 작업 구간 수가 많아요. 기간 또는 항목 수를 조정해 주세요.";}
    else{
      let used=0;
      items=steps.map((s,i)=>{
        const hours=total===null?null:Math.floor(total/n)+(i<total%n?1:0);
        const start=used;used+=hours??0;
        const period=total===null?"단계 "+(i+1):dayUnits?(start+1)+"~"+used+"일차":start+"~"+used+"시간";
        return period+" | "+s[0]+": "+s[1]+" | "+s[2];
      });
      body="기간 | 실행할 작업 | 완료 기준\n--- | --- | ---\n"+items.join("\n");
      if(total!==null)body+="\n기간 합계: "+a.deadline+" ("+(a.days!<1?total+"시간":a.days+"일, 주말을 포함한 달력 기준")+")";
      if(a.people)body+="\n인원: "+a.people+"명"+(a.people===1?"이 순서대로 수행":" 기준으로 위 작업을 분담")+"합니다.";
      if(a.freeOnly)body+="\n비용 조건: 새 유료 서비스 구매를 전제로 하지 않습니다. 무료 사용량 초과 여부는 별도 확인이 필요합니다.";
    }

  return {body,items};
}
export function createFakeAnswer(job:AgentJob):FakeAnswer {
  const a=analyzeRequest(job.prompt), context=job.context;
  if(context){
    const inherited=context.conditions??analyzeRequest(context.prompt);
    if(a.days===null){a.days=inherited.days;a.deadline=inherited.deadline;}
    if(a.people===null)a.people=inherited.people;
    if(a.budget===null)a.budget=inherited.budget;
    a.freeOnly=a.freeOnly||inherited.freeOnly;
    a.exclusions=[...new Set([...inherited.exclusions,...a.exclusions])];
    if(a.freeOnly&&a.budget&&Number(a.budget.replace(/[^0-9]/g,""))>0&&!a.issues.some(s=>s.includes("유료 예산")))a.issues.push("원본의 무료 조건과 수정 예산이 충돌해요. 우선할 조건을 확인해 주세요.");
  }
  if(context&&a.deliverable==="summary")a.issues=a.issues.filter(s=>!s.startsWith("요약할 원문"));
  const role=job.agentId==="nara"?"나라":"준";
  const conditions=[a.deadline?"기간 "+a.deadline:null,a.people?"담당 "+a.people+"명":null,a.freeOnly?"비용: 무료 도구 범위":a.budget?"예산 "+a.budget:null,a.audience?"대상 "+a.audience:null,a.exclusions.length?"제외: "+a.exclusions.join(", "):null].filter(Boolean).join(" · ");
  let items:string[]=[],body="";
  if(a.issues.length){
    body="확인할 내용\n"+a.issues.slice(0,2).map((s,i)=>(i+1)+". "+s).join("\n");
  }else if(context?.mode==="handoff"){
    const brief=contentLines(context.body??context.output).slice(0,4);
    const planned=planContent({...a,topic:context.prompt+" "+a.topic+" "+(context.body??context.output).slice(0,1000)},job.agentId);
    items=planned.items;
    body="인계받은 요구사항\n"+brief.map(s=>"- "+s.slice(0,200)).join("\n")+"\n\n"+(job.agentId==="jun"?"구현 작업과 테스트":"사용자 관점 검토와 수용 기준")+"\n"+planned.body;
  }else if(context?.mode==="revise"&&!a.lines&&!a.table&&a.deliverable!=="summary"){
    body="지원하는 수정은 줄 수 지정 요약과 표 정리입니다. 예: ‘3줄로 요약해줘’, ‘표로 정리해줘’. 다른 동료의 관점이 필요하면 인계를 선택해 주세요.";
  }else if(a.deliverable==="summary"||context?.mode==="revise"){
    const input=context?.body??context?.output??a.source??"";
    const candidates=contentLines(input);
    const length=a.lines??a.count??(a.table?Math.min(12,candidates.length):3);
    items=candidates.slice(0,length).map(s=>s.slice(0,a.lines?300:500));
    if(items.length<length&&a.lines) {
      body="요약할 독립 문장이 "+items.length+"개뿐이에요. "+length+"줄을 만들기 위해 내용을 지어내지 않았습니다.\n"+items.join("\n");
    }else body=a.table?"항목 | 내용\n--- | ---\n"+items.map((s,i)=>(i+1)+" | "+s.replaceAll("|","/")).join("\n"):items.join("\n");
  }else if(a.deliverable==="plan"||a.deliverable==="checklist"||a.domain==="engineering"){
    ({body,items}=planContent(a,job.agentId));
  }else if(a.deliverable==="writing"||a.domain==="writing"){
    const count=a.count??3;
    items=Array.from({length:count},(_,i)=>[
      "작은 시작, 함께 만드는 변화","지금 필요한 일부터, 차근차근","생각을 나누면 다음 단계가 보입니다",
    ][i%3]+(i>2?" · 제안 "+(i+1):""));
    body="제목·문구 초안\n"+items.map((s,i)=>(i+1)+". "+s).join("\n")+"\n\n본문 초안\n"+(a.audience??"여러분")+"을 위한 "+a.topic.slice(0,70)+"을 소개합니다. 복잡한 시작 대신 지금 필요한 한 가지에 집중해 보세요.\n목표를 정하고 작은 결과를 확인하면서 다음 단계를 이어갈 수 있습니다. 먼저 해결하고 싶은 일을 한 문장으로 적어보세요.\n\n확인할 정보: 실제 제품의 장점·수치·제공 기능은 확인 후 문구에 반영해 주세요.";
  }else if(a.deliverable==="comparison"){
    const choices=a.topic.replace(/비교.*$/,"").split(/\s*(?:와|과| vs | VS |대비|,)\s*/).filter(Boolean).slice(0,2);
    body=choices.length===2?"비교 초안\n항목 | "+choices[0]+" | "+choices[1]+"\n--- | --- | ---\n목적 적합성 | 필요한 기능 목록과 대조 | 같은 기능 목록과 대조\n비용·제약 | 제공 자료 확인 필요 | 제공 자료 확인 필요\n검증 방법 | 동일 입력으로 결과 확인 | 동일 입력으로 결과 확인\n현재 입력에 제품별 사양·근거가 없어 우열이나 가격은 단정하지 않았습니다.":"비교할 대상 두 가지와 가장 중요한 기준을 알려주세요.";
  }else if(a.domain==="product"){
    items=["핵심 메시지: 함께 시작하고, 작은 결과를 완성하세요.","첫 행동: 하고 싶은 일을 입력하고 함께할 동료를 선택하세요.","결과: 진행 상태와 완료 결과를 한 화면에서 확인하세요."].slice(0,a.count??3);
    body="화면·메시지 초안\n"+items.join("\n")+"\n검토 기준: 대상 사용자가 첫 행동과 기대 결과를 이해하는지 확인합니다.";
  }else body="지원하는 결과: 개발·기획 계획, 체크리스트, 문구 초안, 제공 원문 요약, 두 대상 비교 틀입니다.\n원하는 산출물과 대상, 지켜야 할 조건을 알려주세요.";
  const checks=["외부 호출 없음","입력 조건과 가정 분리"];
  const forbidden=a.exclusions.filter(term=>!/^유료|무료|비용/.test(term));
  if(forbidden.some(term=>term.length>1&&body.includes(term))&&!a.issues.length)
    body="제외 조건에 해당하는 작업이 기본 초안에 포함되어 있어 결과를 확정하지 않았습니다. 제외할 범위와 대체 방법을 알려주세요.";
  const heading=role+"의 제안";
  const text=a.lines&&!a.issues.length&&items.length===a.lines&&!a.table?body:
    heading+"\n\n요청: "+a.topic+"\n"+(conditions?"조건: "+conditions+"\n":"")+"\n"+body+"\n\n"+(context?"원본: "+context.runId+" · v"+context.version+" · "+context.mode+"\n":"")+"Fake AI 시뮬레이션 · 규칙 기반 초안이며 실제 언어 모델의 추론·검색 결과가 아닙니다.";
  return {version:FAKE_ENGINE_VERSION,analysis:a,text:text.slice(0,4000),body,checks,items};
}
export function phaseAt(outputLength:number,total:number):AnswerPhase {
  return outputLength===0?"analyze":outputLength>=total*.86?"review":"compose";
}
