import {createSceneSharing} from './scene-sharing.mjs';
import{readMotionSpeed,saveMotionSpeed}from'../../pilot-3d/sample/motion-clock.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {activityCaption} from '../../pilot-3d/activities/presentation.mjs';
import {returnStatus} from '../../pilot-3d/room-quality/presentation.mjs';
import {createHandoffTracker,publicHandoff} from "./team-handoff.mjs";
import {TEAM} from "../../server/domain/team.ts";
import {teamProgress} from "./scene-state.mjs";
import {createDiscussion} from "./discussion.mjs";
import { createWorkTools } from "./work-tools.mjs";
import { renderAnswer } from "./answer-view.mjs";
import { followupDraft } from "./followups.mjs";
import { createCueTracker } from "../../pilot-3d/src/animation.mjs";
import {createProductionView}from"../../pilot-3d/sample/production-view.mjs";
import { ACTIVE } from "../../server/domain/contracts.ts";
import { AGENT_NAMES, RUN_LABELS as labels, teamSceneState, motionPolicy } from "./scene-state.mjs";
import { createPresenceClient } from "./presence.mjs";
import { createWorkspacePanel } from "./workspaces.mjs";
import { workspacePresentation, acceptsWorkspaceSnapshot } from "./workspace-state.mjs";

const $ = id => document.getElementById(id);
const sceneCues = createCueTracker(),handoffs=createHandoffTracker();
let handoffReaction=null,handoffTimer=0,handoffContinuous=true,lastAnnouncement="",handoffLog=[];
const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
for(const person of TEAM){
 const option=document.createElement('option');option.value=person.id;option.textContent=person.name+' · '+person.role;$('agent').append(option);
 const focus=document.createElement('button');focus.type='button';focus.id=person.id+'-focus';focus.textContent=person.name+' 가까이';focus.setAttribute('aria-pressed','false');$('actor-focus-controls').append(focus);
 const card=document.createElement('button');card.type='button';card.className='team-member';card.dataset.agentId=person.id;card.style.setProperty('--actor-color',person.color);
 const name=document.createElement('strong'),role=document.createElement('small'),status=document.createElement('span');name.textContent=person.name;role.textContent=person.role;status.id=person.id+'-live';status.textContent='새 업무 대기';card.append(name,role,status);card.addEventListener('click',()=>selectColleague(person.id));$('team-members').append(card);
}
let archiveEpoch=0;
let authBusy = false, followupSource=null, archivedRun=null;
let signup = false, identity = null, snapshot = null, selectedId = null, busy = false;
let presenceStarted=false;
let workspaceId = null, spaces = [], followLive = true, spaceLoading = false;
let epoch = 0, requests = new AbortController(), poll = 0, cursor = 0, historyKey = "", pending = null, retryRequest = null;
let scene = null, sceneEpoch = 0, cameraFrame = "team", motionPaused = matchMedia("(prefers-reduced-motion: reduce)").matches, motionOverridden = false;
class RequestError extends Error { constructor(status, data) { super(data.error ?? "서버 요청을 처리하지 못했습니다."); this.status = status; this.code = data.code; } }
async function api(path, body, key) {
  const parent=requests.signal, controller=new AbortController(), abort=()=>controller.abort();
  parent.addEventListener("abort",abort,{once:true});
  const timeout=setTimeout(()=>controller.abort(new DOMException("서버 응답 시간이 초과됐습니다.","TimeoutError")),10_000);
  try {
    const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", signal:controller.signal, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(key ? { "idempotency-key": key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json(); if (!response.ok) throw new RequestError(response.status, data); return data;
  } finally {clearTimeout(timeout);parent.removeEventListener("abort",abort);}
}
function connection(text = "") { $("connection").textContent = text; $("connection").hidden = !text; }
const workspacePanel = createWorkspacePanel({ request: api, isGuest:()=>!!identity?.user.isGuest, onSelect: switchWorkspace, onBusy(value) { busy=value; render(); }, onError: handle, refreshSnapshot: () => loadSnapshot() });
const discussion=createDiscussion({request:api,onOpen:openArchived,onError:handle});
const workTools=createWorkTools({request:api,onError:handle,onOpen:openArchived,onTemplate(item){if(busy||followupSource||snapshot?.role==='viewer')return;$("task").value=item.prompt;$("agent").value=item.agentId;render();},onConditions(text){if(!text||busy||snapshot?.role==='viewer')return;const next=[$("task").value.trim(),text].filter(Boolean).join('\n\n');if(next.length>2000){$("task-error").textContent='공통 조건을 넣으면 2000자를 넘어요. 업무를 줄여 주세요.';$("task-error").hidden=false;return;}$("task").value=next;render();}});
const presence = createPresenceClient({request:api,onChange:data=>workspacePanel.renderPresence(data),beacon(path,body){
  const json=JSON.stringify(body);
  if(!navigator.sendBeacon(path,new Blob([json],{type:"application/json"}))) void fetch(path,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:json,keepalive:true}).catch(()=>{});
}});
const sceneSharing=createSceneSharing({request:api,getView:()=>scene,onChange:state=>{
  $('scene-sharing').hidden=!state;
  if(state){$('scene-share-control').disabled=state.controlPending||!state.canControl||(!state.controller&&state.active)||!scene?.diagnostics().sceneSchema;$('scene-share-control').textContent=state.controller?'송신 종료 · 공동 관찰':'이 화면에서 새 생활 주기 송신';$('scene-share-status').textContent=state.error|| (state.controller?'이 화면의 5인 동작을 공동 공간에 송신 중':state.active?(state.name+' 화면의 동작을 함께 보고 있어요'+(state.sourcePaused?' · 송신 화면 일시정지':'')):'송신 대기 · 마지막 장면을 표시합니다');$('stage').dataset.sceneSharing=JSON.stringify(state);}
  applySharedControls();
},onController:()=>{scene?.setMotionSpeed($('scene-speed').value);renderSceneState();},beacon(path,body){navigator.sendBeacon(path,new Blob([JSON.stringify(body)],{type:'application/json'}));}});
function applySharedControls(){const follower=sceneSharing.shared&&!sceneSharing.controller,version=Number($('stage').dataset.modelVersion??9);for(const id of['scene-speed','ambient-demo','scene-cup','scene-coffee','scene-group','scene-cancel','scene-scenario','scene-scenario-start','scene-huddle','scene-review'])$(id).disabled=follower||(id.startsWith('scene-scenario')||['scene-huddle','scene-review'].includes(id)?version!==9:version<8);}
$('scene-share-control').addEventListener('click',()=>void(sceneSharing.controller?sceneSharing.release():sceneSharing.claim()));
function invalidateWorkspace() {
  sceneSharing.stop();
  scene?.resetActivity?.();$('room-activity').hidden=true;$('room-activity').textContent='';
  clearTimeout(handoffTimer);handoffs.reset();handoffReaction=null;handoffLog=[];$("stage").dataset.handoffLog="[]";lastAnnouncement="";$("handoff-live").textContent="";sceneCues.reset(); followupSource=null; archivedRun=null; workTools.reset(); discussion.reset();
  presence.stop();presenceStarted=false;
  epoch++;archiveEpoch++; requests.abort(); requests = new AbortController(); clearTimeout(poll); poll=0;
  snapshot=null; selectedId=null; cursor=0; pending=null; retryRequest=null; historyKey=""; busy=false; followLive=true;
  $("workspace-content").hidden=true; renderAnswer($("answer"),"첫 업무를 맡기면 답변이 여기에 쌓여요.");
  $("history-list").replaceChildren(); $("team-task").checked=false; $("task").value=""; $("task-error").hidden=true;
  $("answer").dataset.runId=""; $("answer-prompt").textContent=""; $("answer-prompt").hidden=true; $("run-requester").textContent=""; $("history-count").textContent="0개"; $("shared-live").textContent=""; $("run-title").textContent="업무를 불러오고 있어요"; $("run-detail").textContent="";
  renderSceneState();
}
function resetSession() {
  invalidateWorkspace(); workspaceId=null; spaces=[]; spaceLoading=false; workspacePanel.reset();
  sceneEpoch++; scene?.dispose(); scene=null; identity=null; $("workspace-loading").hidden=true;
}
function showLogin(message = "") {
  $("guest-session-note").hidden=true; $("guest-error").hidden=true;
  resetSession(); $("studio-view").hidden = true; $("login-view").hidden = false; $("signout").hidden = true; $("signed-user").hidden = true;
  $("auth-error").textContent = message; $("auth-error").hidden = !message; setAuthBusy(false);
}
async function handle(error, ticket=epoch) {
  if (ticket!==epoch || error.name === "AbortError") return;
  if (error.status === 401) { showLogin("로그인 시간이 만료됐어요. 다시 로그인해 주세요."); return; }
  if (error.status===404 && identity && workspaceId!==identity.workspace.id) {
    await switchWorkspace(identity.workspace.id,"공동 공간 접근 권한이 바뀌어 개인 공간으로 돌아왔어요.");
    try { spaces=await workspacePanel.loadList(); } catch {}
    return;
  }
  $("task-error").textContent = error instanceof RequestError ? error.message : "서버 연결을 확인하고 다시 시도해 주세요.";
  $("task-error").hidden=false;
  if ([403,409].includes(error.status) && snapshot) { try { await loadSnapshot(ticket); } catch (nextError) {if([401,404].includes(nextError.status)) await handle(nextError,ticket);} }
}
function selectionSnapshot(){return archivedRun&&!snapshot.runs.some(r=>r.id===archivedRun.id)?{...snapshot,runs:[...snapshot.runs,archivedRun]}:snapshot;}
function current() { return snapshot && identity ? workspacePresentation(selectionSnapshot(),identity.user.id,selectedId,followLive).run : null; }
async function openArchived(id){if(!workspaceId)return;const stamp=epoch,selection=++archiveEpoch;try{const run=await api(`/api/workspaces/${workspaceId}/runs/${id}`);if(stamp!==epoch||selection!==archiveEpoch)return;archivedRun=run;selectedId=id;followLive=false;render();$('answer-title').scrollIntoView({block:'start'});}catch(e){if(stamp===epoch&&selection===archiveEpoch)await handle(e,stamp);}}
function renderSceneState() {
  const active = snapshot?.runs.find(r => ACTIVE.includes(r.status));
  const teamRun=active?.team?active:snapshot?.runs.find(r=>r.team);
  const policy=motionPolicy(motionPaused,reducedMotion.matches,document.hidden),animated=policy.animate;
  const event=handoffs.observe(workspaceId,teamRun,{animate:animated,continuous:handoffContinuous});
  if(event){
    handoffLog.push({from:event.from,to:event.to,key:event.key});handoffLog=handoffLog.slice(-8);$("stage").dataset.handoffLog=JSON.stringify(handoffLog);
    handoffReaction=event;clearTimeout(handoffTimer);
    handoffTimer=setTimeout(()=>{handoffReaction=null;renderSceneState();},1000);
    if(lastAnnouncement!==event.key){$('handoff-live').textContent=AGENT_NAMES[event.from]+'에서 '+AGENT_NAMES[event.to]+'에게 '+event.title+' 내용을 전달했어요.';lastAnnouncement=event.key;}
  }
  if(!animated||!active||active.id!==handoffReaction?.runId){handoffReaction=null;clearTimeout(handoffTimer);}
  if(!animated)sceneCues.reset();
  const cues=animated?sceneCues.observe(snapshot?.runs):{};
  const vm = teamSceneState(snapshot?.runs, TEAM.some(p=>p.id===cameraFrame)?cameraFrame:$("agent").value, policy.paused, animated?cues:{});
  const reaction=handoffReaction;
  const sceneVM={...vm,actors:vm.actors.map(actor=>reaction&&[reaction.from,reaction.to].includes(actor.agentId)?{...actor,basePose:actor.pose,pose:actor.agentId===reaction.from?'sending':'receiving',cue:reaction.key+':'+actor.agentId,lookAt:actor.agentId===reaction.from?reaction.to:reaction.from}:actor)};
  const selected = vm.actors.find(actor => actor.agentId === vm.selectedAgent);
  scene?.setViewModel(sceneVM);
  for (const actor of vm.actors) { $("stage").dataset[`${actor.agentId}Pose`] = actor.pose; $(`${actor.agentId}-live`).textContent=`${AGENT_NAMES[actor.agentId]} · ${actor.label}`; }
  $("stage").dataset.pose = selected.pose; $("stage").dataset.owner = active?.team?"team":active?.agentId ?? "";
  const progress=teamProgress(teamRun);
  const cardData=publicHandoff(teamRun);
  $('handoff-card').hidden=!cardData;
  if(cardData){$('handoff-route').textContent=AGENT_NAMES[cardData.from]+' → '+AGENT_NAMES[cardData.to];$('handoff-summary').textContent=cardData.summary;$('handoff-status').textContent=reaction?'내용을 전달하고 있어요':teamRun.status==='succeeded'?'마지막 인계 · 협업 완료':'최근 인계 · 다음 업무 진행 중';$('handoff-card').dataset.reacting=String(!!reaction);$('handoff-card').dataset.boundary=String(cardData.boundary);}
  $('stage').dataset.handoff=reaction?reaction.from+'→'+reaction.to:'';
  const stage=Object.entries(progress).find(([,p])=>p.state==='active');
  $('team-stage-caption').textContent=active?.team?(stage?AGENT_NAMES[stage[0]]+' · '+stage[1].label+' / 나머지 동료는 자료 준비·검토 중':active.status==='awaiting_approval'?'협업 실행 승인을 기다리고 있어요.':'다섯 동료가 공통 조건을 살펴보고 있어요.'):teamRun?.status==='succeeded'?'5개 역할의 협업 결과가 저장됐어요. 새 협업을 시작하거나 개별 업무를 맡길 수 있어요.':'동료별 이름표와 카드를 누르면 가까이 볼 수 있어요.';
  for(const card of $('team-members').children){card.dataset.state=progress[card.dataset.agentId]?.state??'idle';card.dataset.handoff=reaction?.from===card.dataset.agentId?'sending':reaction?.to===card.dataset.agentId?'receiving':'';card.setAttribute('aria-pressed',String(card.dataset.agentId===vm.selectedAgent));}
  for(const actor of vm.actors){if((active?.team||!active)&&progress[actor.agentId])$(`${actor.agentId}-live`).textContent=progress[actor.agentId].label;}
  $("scene-caption").textContent = `${AGENT_NAMES[selected.agentId]} · ${selected.label}`;
  $("motion").textContent = reducedMotion.matches ? "동작 줄이기 적용 중" : policy.paused ? "움직임 재생" : "움직임 멈추기"; $("motion").disabled=reducedMotion.matches;$("motion").setAttribute("aria-pressed", String(policy.paused));
}
function render() {
  workspacePanel.setBusy(busy||spaceLoading);
  if (!snapshot || !identity) return;
  const presentation=workspacePresentation(selectionSnapshot(),identity.user.id,selectedId,followLive);
  const run = presentation.run, active = Boolean(presentation.active), agentName = AGENT_NAMES[$("agent").value];
  if (followLive) selectedId=run?.id ?? null;
  workspacePanel.render(snapshot); workTools.render(snapshot); workTools.renderRun(run); discussion.render(snapshot,run);
  $("apply-template").disabled=busy||active||!!followupSource;$("apply-project").disabled=busy||active||!presentation.canStart;
  $("workspace-heading").textContent = snapshot.workspace.name;
  $("task-form").hidden=!presentation.canStart; $("read-only-note").hidden=presentation.canStart;
  $('read-only-note').textContent=snapshot.workspace.readOnlyReason??'보기 전용 권한으로 업무와 결과를 함께 확인할 수 있어요.';
  $("task-title").textContent=presentation.canStart ? `${$("team-task").checked?"다섯 동료와":agentName+(["준","민"].includes(agentName)?"과":"와")} 함께하기 ✧` : "업무 함께 보기 ✧";
  const live=presentation.active;
  $("shared-live").textContent=live ? `${live.team?"5명 협업":AGENT_NAMES[live.agentId]} · ${labels[live.status]} · 요청 ${live.requestedByName}` : snapshot.workspace.kind==="shared" ? "공동 공간의 업무·승인·답변을 참여자와 함께 확인해요." : identity.user.isGuest ? "이 게스트 공간의 업무와 답변은 다른 게스트와 분리돼요." : "이곳의 업무는 나만 확인할 수 있어요.";
  $("live-run").hidden=!live || run?.id===live.id;
  $("run-requester").hidden=!run; $("run-requester").textContent=run ? `요청한 사람 · ${run.requestedByName}` : "";
  $("start").textContent = busy ? "요청 확인 중…" : active ? "진행 중인 업무가 있어요" : $("team-task").checked?"다섯 동료에게 협업 맡기기 ↗":`${agentName}에게 업무 맡기기 ↗`;
  $("start-team-demo").disabled=busy||active||!presentation.canStart;$("team-task").disabled=busy||active||!!followupSource;
  for (const id of ["start", "task", "scenario", "require-approval"]) $(id).disabled = busy || active || !presentation.canStart;
  $("agent").disabled = busy || $("team-task").checked || followupSource?.mode==="handoff";
  $("followup-context").hidden=!followupSource;
  $("followup-description").textContent=followupSource?((followupSource.mode==="handoff"?"인계":"수정")+" 원본 · "+AGENT_NAMES[followupSource.sourceAgent]+" · v"+followupSource.sourceVersion+"\n"+followupSource.sourcePrompt+(followupSource.mode==="handoff"?"\n인계 업무는 승인 후 실행됩니다.":"")):"";
  if(followupSource?.mode==="handoff"){$("require-approval").checked=true;$("require-approval").disabled=true;}
  $("followup-tools").hidden=run?.status!=="succeeded"||!presentation.canStart;
  for(const id of ["revise-lines","revise-table","handoff-result"])$(id).disabled=busy||active;
  $("handoff-result").textContent=(run?.agentId==="nara"?"준":"나라")+"에게 인계 검토하기 ↗";
  $("answer-source").hidden=!run?.source;
  $("answer-source-label").textContent=run?.source?AGENT_NAMES[run.source.agentId]+" · v"+run.source.version+" · "+(run.source.mode==="handoff"?"인계":"수정")+"\n"+run.source.prompt+(run.source.truncated?"\n긴 원본의 앞 4,000자를 기준으로 작업했습니다.":""):"";
  $("answer-source-preview").textContent=run?.source?.preview??"";
  $("character-count").textContent = `${$("task").value.length} / 2000`;
  $("run-status").textContent = run ? `${run.team?"5명 협업":AGENT_NAMES[run.agentId]} · ${labels[run.status]}` : "READY WHEN YOU ARE";
  $("run-title").textContent = run ? labels[run.status] : "새 업무를 기다리고 있어요";
  const parsed=run?.answerMeta?.analysis;
  const conditions=parsed?[parsed.deadline?parsed.deadline:null,parsed.people?parsed.people+"명":null,parsed.freeOnly?"무료 조건":parsed.budget,parsed.count?parsed.count+"개 항목":null,parsed.lines?parsed.lines+"줄":null].filter(Boolean):[];
  $("recognized-conditions").hidden=!conditions.length;
  $("recognized-conditions").textContent="반영한 조건 · "+conditions.join(" / ");
  $("run-detail").textContent = run ? run.note || run.stage : "요청한 업무의 진행 상황을 여기에 보여드릴게요.";
  $("progress-fill").style.width = !run ? "0%" : ["succeeded", "failed", "cancelled"].includes(run.status) ? "100%" : run.status === "awaiting_approval" ? "8%" : run.output ? "75%" : "30%";
  $("approve").hidden = $("decline").hidden = run?.status !== "awaiting_approval" || !presentation.canApprove;
  $("cancel").hidden = !run || !presentation.canControl || !(["queued", "running", "cancel_requested"].includes(run.status) || (run.status==="awaiting_approval" && !presentation.canApprove));
  $("retry").hidden = !run || !presentation.canControl || !["failed", "cancelled"].includes(run.status) || active;
  for (const id of ["approve", "decline", "cancel", "retry"]) $(id).disabled = busy || (id === "cancel" && run?.status === "cancel_requested");
  $("answer-status").textContent = run ? labels[run.status] : "저장된 답변";
  $("answer-prompt").textContent = run ? `요청 · ${run.prompt}` : ""; $("answer-prompt").hidden = !run;
  renderAnswer($("answer"),run?.output || (run?.status === "awaiting_approval" ? "승인하면 Fake AI가 답변 작성을 시작해요." : run && ACTIVE.includes(run.status) ? "답변을 준비하고 있어요…" : "첫 업무를 맡기면 답변이 여기에 쌓여요."));
  $("answer").dataset.runId = run?.id ?? "";
  $("history-count").textContent = `${snapshot.runs.length}개`;
  $("history-empty").hidden = snapshot.runs.length > 0;
  const nextHistoryKey = `${selectedId}|${snapshot.runs.map(r => `${r.id}:${r.status}`).join("|")}`;
  if (historyKey !== nextHistoryKey) {
    historyKey = nextHistoryKey;
    $("history-list").replaceChildren(...snapshot.runs.map(r => {
      const li = document.createElement("li"), button = document.createElement("button"), title = document.createElement("strong"), meta = document.createElement("small");
      button.type = "button"; button.dataset.runId = r.id; button.setAttribute("aria-pressed", String(r.id === run?.id));
      title.textContent = r.prompt.slice(0, 90) + (r.prompt.length > 90 ? "…" : "");
      meta.textContent = `${r.team?"5명 협업":AGENT_NAMES[r.agentId]} · ${labels[r.status]}${presentation.shared ? ` · ${r.requestedByName}` : ""} · ${new Date(r.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
      button.append(title, meta); button.addEventListener("click", () => { archiveEpoch++;followLive=false; selectedId = r.id; render(); }); li.append(button); return li;
    }));
  }
  renderSceneState();
}
function applySnapshot(next,ticket,id) {
  if(!acceptsWorkspaceSnapshot({epoch:ticket,workspaceId:id},{epoch,workspaceId,cursor},next.cursor))return;
  const wasActive=snapshot?.runs.some(r=>ACTIVE.includes(r.status));
  snapshot=next;cursor=next.cursor;spaceLoading=false;
  if(!selectedId||!next.runs.some(r=>r.id===selectedId)&&archivedRun?.id!==selectedId){selectedId=next.runs[0]?.id??null;followLive=true;}
  $("workspace-content").hidden=false;$("workspace-loading").hidden=true;
  connection();render();handoffContinuous=true;if(!scene)mountScene();sceneSharing.start(id,next.workspace.kind==="shared");
  if(!wasActive&&next.runs.some(r=>ACTIVE.includes(r.status)))schedulePoll(ticket);
}
async function loadSnapshot(ticket=epoch) {
  if(!identity||!workspaceId)return;
  const id=workspaceId,next=await api(`/api/workspaces/${id}/snapshot`);
  applySnapshot(next,ticket,id);
}
async function switchWorkspace(id, notice="") {
  if(!identity) return;
  invalidateWorkspace(); workspaceId=id; spaceLoading=true; workspacePanel.beginSwitch(id); workspacePanel.setNotice(notice);
  $("workspace-loading").hidden=false; $("workspace-loading").textContent="작업 공간을 불러오고 있어요…";
  connection(); const ticket=epoch;
  try { await loadSnapshot(ticket); if(ticket===epoch) {
    history.replaceState(null,"",`/?workspace=${encodeURIComponent(id)}${location.hash}`);
    presence.start(id,snapshot.workspace.kind==="shared");presenceStarted=true;await presence.refresh();
  } }
  catch(error) {
    if(ticket!==epoch || error.name==="AbortError") return;
    if(error.status===401 || error.status===404) {await handle(error,ticket);return;}
    connection("공간을 불러오지 못했어요. 연결되면 자동으로 다시 확인합니다.");
    $("workspace-loading").textContent="서버 연결을 기다리고 있어요…";
  } finally { if(ticket===epoch && identity) {spaceLoading=false;workspacePanel.setBusy(busy);schedulePoll(ticket);} }
}
function schedulePoll(ticket = epoch) {
  clearTimeout(poll); if(!identity || !workspaceId || ticket!==epoch) return;
  const id=workspaceId;
  poll=setTimeout(async()=>{
    if(ticket!==epoch) return;
    try {
      if(identity.client?.sync) {
        if(snapshot?.workspace.kind==="shared"&&!presenceStarted){presence.start(id,true);presenceStarted=true;}
        const selected=current()?.id,discussionStamp=discussion.syncToken();
        const result=snapshot?.workspace.kind==="shared"?await presence.sync(cursor,{selectedRunId:selected}):await api(`/api/workspaces/${id}/sync`,{after:cursor,selectedRunId:selected});
        if(ticket!==epoch)return;
        if(result?.snapshot)applySnapshot(result.snapshot,ticket,id);
        else if(!snapshot)await loadSnapshot(ticket);
        discussion.sync(result,selected,discussionStamp);
      } else {
        const page=await api(`/api/workspaces/${id}/events?after=${cursor}`);
        if(ticket!==epoch)return;
        if(!snapshot||page.events.length)await loadSnapshot(ticket);
        if(ticket!==epoch)return;
        if(snapshot?.workspace.kind==="shared"){
          if(!presenceStarted){presence.start(id,true);presenceStarted=true;}
          await presence.refresh();
        }
      }
      if(ticket!==epoch)return;
      if(!spaces.length) spaces=await workspacePanel.loadList();
      if(ticket!==epoch) return;
      connection();
    } catch(error) {
      if(ticket!==epoch || error.name==="AbortError") return;
      if([401,404].includes(error.status)) {await handle(error,ticket);return;}
      presence.disconnected();
      connection("서버 연결을 기다리고 있어요. 연결되면 저장된 업무 상태를 다시 확인합니다.");
    } finally {if(ticket===epoch && identity) schedulePoll(ticket);}
  },document.hidden?(identity.client?.hiddenPollMs??2000):(snapshot?.runs.some(r=>ACTIVE.includes(r.status))?identity.client?.activePollMs??identity.client?.pollMs??500:identity.client?.pollMs??500));
}
function mountScene() {
  sceneSharing.stop();const ticket = ++sceneEpoch; scene?.dispose(); scene = null; $("fallback").hidden = true; $("scene-state").textContent = "3D 준비 중";
  try {
    scene = createProductionView($("canvas-host"), {
      onStatus(kind,error,version,activityRuntime,recovered) { if (ticket !== sceneEpoch) return;for(const id of['scene-coffee','scene-group','scene-cancel','scene-sound'])$(id).disabled=kind!=='ready'||![8,9].includes(version);$('ambient-demo').disabled=kind!=='ready'||version===4;if(kind==='ready')document.querySelector('.stage-tag').textContent='STUDIO V'+version+' · '+(version>=6?($('scene-lighting').value==='evening'?'EVENING':'DAYLIGHT'):'RECOVERED'); $("scene-state").textContent = kind === "ready" ? (version>=6?(activityRuntime?(recovered?"실제 3D · 5명 생활 동작 복구":(version>=7?"실제 3D · 새 사무실과 5명 협업":"실제 3D · 5명 접지와 교감")):"실제 3D · 공간 품질 v6"):"실제 3D · v"+version+" 복구") : "2D 대체 화면"; $("fallback").hidden = kind === "ready"; },
      onSelect: selectColleague,
      onMetrics(stats){if(ticket!==sceneEpoch)return;for(const id of['scene-coffee','scene-group','scene-cancel','scene-sound'])$(id).disabled=![8,9].includes(stats.modelVersion);$('scene-sound').textContent=stats.audio?.enabled?'효과음 끄기':'효과음 켜기';$('scene-sound').setAttribute('aria-pressed',String(!!stats.audio?.enabled));$('office-dimensions').textContent=stats.modelVersion>=7?'13.2 × 10.2m · 창가 자리 5개 · 이전 v6보다 바닥 면적 약 85% 확장':stats.modelVersion===6?'기존 공간 v6 · 9.6 × 7.6m · 5개 독립 자리':'기존 스튜디오 v'+stats.modelVersion+' · 5개 독립 자리';$('scene-speed').value=String(stats.motionSpeed??1);$('scene-speed').disabled=stats.modelVersion===4;$('scene-speed-status').textContent='x'+(stats.motionSpeed??1)+(stats.paused?' · 정지':'');$('stage').dataset.motionSpeed=String(stats.motionSpeed??1);$('stage').dataset.animationTime=String(stats.animationTime);$('stage').dataset.actions=JSON.stringify(stats.actors);$('stage').dataset.drawCalls=String(stats.drawCalls);$('stage').dataset.modelVersion=String(stats.modelVersion);$('stage').dataset.scenePositions=JSON.stringify(stats.scenePositions??{});$('stage').dataset.sceneProps=JSON.stringify(stats.sceneProps??{});$('stage').dataset.activities=JSON.stringify(stats.activities??{});$('stage').dataset.teamActivities=JSON.stringify(stats.teamActivities??null);const returnText=activityCaption(stats,AGENT_NAMES)||Object.entries(stats.activities??{}).map(([id,state])=>returnStatus(AGENT_NAMES[id]??id,state,{paused:stats.paused})).filter(Boolean).join(' / ');if($('room-activity').textContent!==returnText)$('room-activity').textContent=returnText;$('room-activity').hidden=!returnText;$('scene-lighting').disabled=stats.modelVersion===4;$('ambient-demo').disabled=stats.modelVersion===4;$('scene-camera').setAttribute('aria-pressed',String(!!stats.autoCamera));$('scene-camera').textContent=stats.autoCamera?'자동 카메라 끄기':'자동 카메라 켜기';applySharedControls();},
    }, { actors: TEAM.map(p=>p.id), actorLabels:Object.fromEntries(TEAM.map(p=>[p.id,p.name+" · "+p.role])), modelVersion:9,activityRuntime:true,pairedFallbackRuntimeFactory:(model,meta)=>createTeamRuntime(model,meta,{natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true}),runtimeFactory:(model,meta)=>createTeamRuntime(model,meta,{natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true}),fallbackRuntimeFactories:[(model,meta)=>createTeamRuntime(model,meta,{natural:true,enriched:true,expressive:true,interaction:true,refined:true}),(model,meta)=>createTeamRuntime(model,meta,{natural:true,enriched:true,expressive:true,interaction:true}),(model,meta)=>createTeamRuntime(model,meta,{natural:true,enriched:true,expressive:true}),(model,meta)=>createTeamRuntime(model,meta,{natural:true,enriched:true}),(model,meta)=>createTeamRuntime(model,meta,{natural:true})],fallbackRuntimeFactory:createTeamRuntime,modelUrl: "/assets/studio-room-v9.glb" });
    if(snapshot)sceneSharing.start(workspaceId,snapshot.workspace.kind==='shared');scene.setMotionSpeed($('scene-speed').value);scene.resetCamera(cameraFrame);scene.setQuality($('scene-quality').value);scene.setLighting($('scene-lighting').value);renderSceneState();
  } catch { $("fallback").hidden = false; $("scene-state").textContent = "2D 대체 화면"; }
}
async function enter(me) {
  resetSession(); identity = me; $("guest-session-note").hidden=!me.user.isGuest;
  $("login-view").hidden = true; $("studio-view").hidden = false; $("signout").hidden = false; $("signed-user").hidden = false; $("signed-user").textContent = `${me.user.name}님`;
  $("auth-error").hidden = true; $("password").value = ""; $("task-error").hidden = true;
  try { spaces=await workspacePanel.loadList(); } catch(error) { if(error.status===401){showLogin();return;} spaces=[]; }
  const desired=new URL(location.href).searchParams.get("workspace");
  const target=spaces.some(space=>space.id===desired) ? desired : me.workspace.id;
  await switchWorkspace(target,desired && desired!==target ? "접근할 수 없는 공간 대신 개인 공간을 열었어요." : "");
  if(location.hash==="#office")setOfficeFocus(true);
  else if(location.hash==="#scene-title")$("scene-title").scrollIntoView({block:"start"});
}
function setAuthBusy(value) {
  authBusy=value;
  for(const id of ["auth-submit","guest-login","login-tab","signup-tab"]) $(id).disabled=value;
  $("guest-login").textContent=value ? "로그인 확인 중…" : "게스트로 바로 시작하기 ↗";
}
$("guest-login").addEventListener("click", async () => {
  if(authBusy)return;
  setAuthBusy(true); $("guest-error").hidden=true; $("auth-error").hidden=true;
  try {
    await api("/api/auth/sign-in/guest", {});
    await enter(await api("/api/me"));
  } catch(error) {
    $("guest-error").textContent=error.code==="GUEST_FULL" ? error.message : error.status===429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : "게스트 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.";
    $("guest-error").hidden=false;
  } finally {setAuthBusy(false);}
});
function setAuthMode(value) {
  signup = value; $("login-tab").setAttribute("aria-pressed", String(!value)); $("signup-tab").setAttribute("aria-pressed", String(value));
  $("name-field").hidden = !value; $("name").required = value;
  $("password").autocomplete = value ? "new-password" : "current-password";
  $("login-title").textContent = value ? "나만의 공간을 만들어요." : "다시 만나 반가워요.";
  $("auth-submit").textContent = value ? "계정 만들고 시작하기 ↗" : "로그인하기 ↗"; $("auth-error").hidden = true;
}
$("login-tab").addEventListener("click", () => setAuthMode(false)); $("signup-tab").addEventListener("click", () => setAuthMode(true));
$("auth-form").addEventListener("submit", async e => {
  e.preventDefault(); if(authBusy)return; setAuthBusy(true); $("auth-error").hidden = true; $("guest-error").hidden=true;
  try {
    const body = { email: $("email").value.trim(), password: $("password").value, ...(signup ? { name: $("name").value.trim() } : {}) };
    await api(`/api/auth/${signup ? "sign-up" : "sign-in"}/email`, body); await enter(await api("/api/me"));
  } catch (error) { $("auth-error").textContent = error.status === 429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : signup ? "이름·이메일·비밀번호를 확인해 주세요. 이미 사용 중인 이메일일 수 있어요." : "이메일과 비밀번호를 확인해 주세요."; $("auth-error").hidden = false; }
  finally { setAuthBusy(false); }
});
$("signout").addEventListener("click", async () => { $("signout").disabled = true; try { await api("/api/auth/sign-out", {}); history.replaceState(null,"","/"); showLogin(); } catch (e) { handle(e); } finally { $("signout").disabled = false; } });
$("task").addEventListener("input", () => { $("character-count").textContent = `${$("task").value.length} / 2000`; });
$("agent").addEventListener("change", () => { setCameraFrame($("agent").value); render(); });
$("task-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!identity || busy) return;
  const body = { prompt: $("task").value.trim(), agentId: $("agent").value, approvalRequired: $("require-approval").checked, ...($("team-task").checked?{team:true}:{}), scenario: $("scenario").value, ...(followupSource?{sourceRunId:followupSource.sourceRunId,mode:followupSource.mode}:{}) };
  if (body.prompt.length < 2) { $("task-error").textContent = "업무를 두 글자 이상 입력해 주세요."; $("task-error").hidden = false; $("task").focus(); return; }
  const signature = JSON.stringify(body); if (!pending || pending.signature !== signature) pending = { signature, key: crypto.randomUUID() };
  const ticket = epoch,selection=++archiveEpoch; busy = true; $("task-error").hidden = true; render();
  try { const run = await api(`/api/workspaces/${workspaceId}/runs`, body, pending.key); if (ticket !== epoch) return;if(selection===archiveEpoch){selectedId = run.id; followLive=true;} pending = null; followupSource=null; await loadSnapshot(ticket); }
  catch (error) { if (ticket === epoch) { await handle(error,ticket); if(ticket===epoch) {try { await loadSnapshot(ticket); } catch {}} } }
  finally { if (ticket === epoch) { busy = false; render(); } }
});
async function command(action) {
  const run = current(); if (!run || busy) return; const ticket = epoch,selection=++archiveEpoch; busy = true; $("task-error").hidden = true; render();
  // Reuse the key when the acknowledgement is lost, just as for a new task.
  if (action === "retry" && retryRequest?.runId !== run.id) retryRequest = { runId: run.id, key: crypto.randomUUID() };
  try {
    const response = await api(`/api/runs/${run.id}/${["approve", "decline"].includes(action) ? "approval" : action}`, ["approve", "decline"].includes(action) ? { version: run.version, approved: action === "approve" } : {}, action === "retry" ? retryRequest.key : undefined);
    if (ticket !== epoch) return;if(selection===archiveEpoch){selectedId = response.id; followLive=true;} retryRequest = null; await loadSnapshot(ticket);
  } catch (error) { if (ticket === epoch) { await handle(error,ticket); if(ticket===epoch) {try { await loadSnapshot(ticket); } catch {}} } }
  finally { if (ticket === epoch) { busy = false; render(); } }
}
for(const [id,kind] of [["revise-lines","lines"],["revise-table","table"],["handoff-result","handoff"]])$(id).addEventListener("click",()=>{
  const run=current();
  if(busy||!snapshot||!identity||!workspacePresentation(snapshot,identity.user.id,selectedId,followLive).canStart)return;
  $("team-task").checked=false;
  followupSource=followupDraft(run,kind);if(!followupSource)return;
  $("agent").value=followupSource.agentId;$("task").value=followupSource.prompt;
  $("require-approval").checked=followupSource.approvalRequired;
  setCameraFrame(followupSource.agentId);render();$("task").focus();
});
$("clear-source").addEventListener("click",()=>{followupSource=null;$("require-approval").checked=false;render();});
$("live-run").addEventListener("click",()=>{archiveEpoch++;followLive=true;render();});
for (const [id, action] of [["approve", "approve"], ["decline", "decline"], ["cancel", "cancel"], ["retry", "retry"]]) $(id).addEventListener("click", () => command(action));
function setCameraFrame(frame) {
  cameraFrame = frame; scene?.resetCamera(frame);
  for (const [id, value] of [["whole-space", "team"], ...TEAM.map(p=>[p.id+"-focus",p.id])]) $(id).setAttribute("aria-pressed", String(frame === value));
  renderSceneState();
}
function selectColleague(id) {
  if (!AGENT_NAMES[id] || busy) return;
  if(!$("team-task").checked&&!followupSource)$("agent").value = id; setCameraFrame(id); render();
}
$("whole-space").addEventListener("click", () => setCameraFrame("team"));
for (const {id} of TEAM) $(`${id}-focus`).addEventListener("click", () => selectColleague(id));
$("motion").addEventListener("click", () => {if(reducedMotion.matches)return; motionOverridden = true; motionPaused = !motionPaused; handoffContinuous=false;renderSceneState(); });
reducedMotion.addEventListener("change", e => { if (!motionOverridden)motionPaused=e.matches;handoffContinuous=false;renderSceneState(); });
$('team-task').addEventListener('change',()=>{if($('team-task').checked){followupSource=null;$('agent').value='nara';}render();});
function setOfficeFocus(focused){document.body.classList.toggle('office-focus-mode',focused);$('expand-office').textContent=focused?'업무 화면으로 돌아가기':'사무실만 보기';$('expand-office').setAttribute('aria-pressed',String(focused));}
$('expand-office').addEventListener('click',()=>{const focused=!document.body.classList.contains('office-focus-mode');setOfficeFocus(focused);history.replaceState(null,'',location.pathname+location.search+(focused?'#office':'#scene-title'));$('scene-title').scrollIntoView({block:'start'});});
$('start-team-demo').addEventListener('click',()=>{if(busy||!snapshot||snapshot.role==='viewer'||snapshot.runs.some(r=>ACTIVE.includes(r.status)))return;followupSource=null;$('team-task').checked=true;$('agent').value='nara';$('task').value='5명이 2주 안에 무료 도구로 첫 화면 개선 프로젝트를 진행해 줘. 기획, 디자인, 개발, QA, 최종 정리의 계획과 완료 기준을 만들어 줘.';$('require-approval').checked=false;$('scenario').value='normal';followLive=true;setCameraFrame('team');render();$('task-form').requestSubmit();});
$('scene-speed').value=String(readMotionSpeed());
$('scene-speed').addEventListener('change',e=>{const speed=saveMotionSpeed(undefined,e.target.value);scene?.setMotionSpeed(speed);$('scene-speed-status').textContent='x'+speed;});
$('scene-quality').addEventListener('change',e=>scene?.setQuality(e.target.value));
$('scene-lighting').addEventListener('change',e=>{scene?.setLighting(e.target.value);document.querySelector('.stage-tag').textContent=e.target.value==='evening'?'STUDIO V'+($('stage').dataset.modelVersion??6)+' · EVENING':'STUDIO V'+($('stage').dataset.modelVersion??6)+' · DAYLIGHT';});
$('scene-cup').addEventListener('click',()=>{$('scene-activity-notice').textContent=scene?.startCup(TEAM.some(p=>p.id===cameraFrame)?cameraFrame:$('agent').value)?'컵을 들고 잠시 쉬었다가 제자리에 놓습니다.':'현재 활동을 마친 뒤 시작할 수 있어요.';});$('scene-coffee').addEventListener('click',()=>{$('scene-activity-notice').textContent=scene?.startCoffee(TEAM.some(p=>p.id===cameraFrame)?cameraFrame:$('agent').value)?'커피를 준비하고 자리로 돌아옵니다.':'현재 활동을 마친 뒤 시작할 수 있어요.';});$('scene-group').addEventListener('click',()=>{$('scene-activity-notice').textContent=scene?.startGroupMeeting()?'다섯 동료가 회의 자리로 모입니다.':'다섯 동료의 현재 업무·활동을 마친 뒤 시작할 수 있어요.';});$('scene-cancel').addEventListener('click',()=>{scene?.cancelActivities();$('scene-activity-notice').textContent='소품을 정리하고 업무 자리로 돌아갑니다.';});$('scene-sound').addEventListener('click',async()=>{const next=$('scene-sound').getAttribute('aria-pressed')!=='true';await scene?.setSound(next);});
$('ambient-demo').addEventListener('click',()=>{if(!sceneSharing.shared||sceneSharing.controller)scene?.startDemo();});
$('scene-scenario-start').addEventListener('click',()=>{$('scene-activity-notice').textContent=scene?.startScenario($('scene-scenario').value)?'선택한 생활 시나리오를 시작합니다.':'현재 업무·생활 동작을 정리한 뒤 시작해 주세요.';});
$('scene-huddle').addEventListener('click',()=>{$('scene-activity-notice').textContent=scene?.startHuddle()?'다섯 동료가 서서 이야기를 나눕니다.':'현재 활동을 마친 뒤 시작할 수 있어요.';});
$('scene-review').addEventListener('click',()=>{$('scene-activity-notice').textContent=scene?.startReview()?'다섯 동료가 보드를 함께 검토합니다.':'현재 활동을 마친 뒤 시작할 수 있어요.';});
$('scene-camera').addEventListener('click',()=>scene?.setAutoCamera(!scene?.diagnostics().autoCamera));
$("recover-scene").addEventListener("click", mountScene);
document.addEventListener("visibilitychange", () => { handoffContinuous=false;handoffReaction=null;clearTimeout(handoffTimer);sceneCues.reset();renderSceneState();if (identity && !document.hidden) { const ticket = epoch; void loadSnapshot(ticket).then(() => schedulePoll(ticket)).catch(error=>handle(error,ticket)); } });
window.addEventListener("pagehide", () => { sceneSharing.stop();presence.stop();clearTimeout(poll); requests.abort(); ++sceneEpoch; scene?.dispose(); scene = null; });
window.addEventListener("pageshow", e => { if (e.persisted) { requests = new AbortController(); void api("/api/me").then(enter).catch(() => showLogin()); } });
setAuthBusy(true);
api("/api/me").then(enter).catch(() => showLogin());
