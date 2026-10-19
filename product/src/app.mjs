import { createStudioView } from "../../pilot-3d/src/scene.mjs";
import { ACTIVE } from "../../server/domain/contracts.ts";
import { AGENT_NAMES, RUN_LABELS as labels, teamSceneState } from "./scene-state.mjs";

const $ = id => document.getElementById(id);
let signup = false, identity = null, snapshot = null, selectedId = null, busy = false;
let epoch = 0, requests = new AbortController(), poll = 0, cursor = 0, historyKey = "", pending = null, retryRequest = null;
let scene = null, sceneEpoch = 0, cameraFrame = "team", motionPaused = matchMedia("(prefers-reduced-motion: reduce)").matches, motionOverridden = false;
class RequestError extends Error { constructor(status, data) { super(data.error ?? "서버 요청을 처리하지 못했습니다."); this.status = status; this.code = data.code; } }
async function api(path, body, key) {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", signal: requests.signal, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(key ? { "idempotency-key": key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json(); if (!response.ok) throw new RequestError(response.status, data); return data;
}
function connection(text = "") { $("connection").textContent = text; $("connection").hidden = !text; }
function resetSession() {
  epoch++; requests.abort(); requests = new AbortController(); clearTimeout(poll); poll = 0;
  sceneEpoch++; scene?.dispose(); scene = null; snapshot = null; selectedId = null; identity = null; cursor = 0; pending = null; retryRequest = null; historyKey = ""; busy = false;
  $("answer").textContent = "첫 업무를 맡기면 답변이 여기에 쌓여요."; $("history-list").replaceChildren(); $("task").value = "";
}
function showLogin(message = "") {
  resetSession(); $("studio-view").hidden = true; $("login-view").hidden = false; $("signout").hidden = true; $("signed-user").hidden = true;
  $("auth-error").textContent = message; $("auth-error").hidden = !message; $("auth-submit").disabled = false;
}
function handle(error) {
  if (error.name === "AbortError") return;
  if (error.status === 401) { showLogin("로그인 시간이 만료됐어요. 다시 로그인해 주세요."); return; }
  $("task-error").textContent = error instanceof RequestError ? error.message : "서버 연결을 확인하고 다시 시도해 주세요.";
  $("task-error").hidden = false;
}
function current() { return snapshot?.runs.find(r => r.id === selectedId) ?? snapshot?.runs[0] ?? null; }
function renderSceneState() {
  const active = snapshot?.runs.find(r => ACTIVE.includes(r.status));
  const vm = teamSceneState(snapshot?.runs, $("agent").value, motionPaused);
  const selected = vm.actors.find(actor => actor.agentId === vm.selectedAgent);
  scene?.setViewModel(vm);
  for (const actor of vm.actors) $("stage").dataset[`${actor.agentId}Pose`] = actor.pose;
  $("stage").dataset.pose = selected.pose; $("stage").dataset.owner = active?.agentId ?? "";
  $("scene-caption").textContent = `${AGENT_NAMES[selected.agentId]} · ${selected.label}`;
  $("motion").textContent = motionPaused ? "움직임 재생" : "움직임 멈추기"; $("motion").setAttribute("aria-pressed", String(motionPaused));
}
function render() {
  if (!snapshot || !identity) return;
  const run = current(), active = snapshot.runs.some(r => ACTIVE.includes(r.status)), agentName = $("agent").value === "nara" ? "나라" : "준";
  $("workspace-heading").textContent = snapshot.workspace.name;
  $("task-title").textContent = `${agentName}${agentName === "준" ? "과" : "와"} 함께하기 ✧`;
  $("start").textContent = busy ? "요청 확인 중…" : active ? "진행 중인 업무가 있어요" : `${agentName}에게 업무 맡기기 ↗`;
  for (const id of ["start", "task", "scenario", "require-approval"]) $(id).disabled = busy || active;
  $("agent").disabled = busy;
  $("character-count").textContent = `${$("task").value.length} / 2000`;
  $("run-status").textContent = run ? `${run.agentId === "nara" ? "나라" : "준"} · ${labels[run.status]}` : "READY WHEN YOU ARE";
  $("run-title").textContent = run ? labels[run.status] : "새 업무를 기다리고 있어요";
  $("run-detail").textContent = run ? run.note || run.stage : "요청한 업무의 진행 상황을 여기에 보여드릴게요.";
  $("progress-fill").style.width = !run ? "0%" : ["succeeded", "failed", "cancelled"].includes(run.status) ? "100%" : run.status === "awaiting_approval" ? "8%" : run.output ? "75%" : "30%";
  $("approve").hidden = $("decline").hidden = run?.status !== "awaiting_approval";
  $("cancel").hidden = !run || !["queued", "running", "cancel_requested"].includes(run.status);
  $("retry").hidden = !run || !["failed", "cancelled"].includes(run.status) || active;
  for (const id of ["approve", "decline", "cancel", "retry"]) $(id).disabled = busy || (id === "cancel" && run?.status === "cancel_requested");
  $("answer-status").textContent = run ? labels[run.status] : "저장된 답변";
  $("answer-prompt").textContent = run ? `요청 · ${run.prompt}` : ""; $("answer-prompt").hidden = !run;
  $("answer").textContent = run?.output || (run?.status === "awaiting_approval" ? "승인하면 Fake AI가 답변 작성을 시작해요." : run && ACTIVE.includes(run.status) ? "답변을 준비하고 있어요…" : "첫 업무를 맡기면 답변이 여기에 쌓여요.");
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
      meta.textContent = `${r.agentId === "nara" ? "나라" : "준"} · ${labels[r.status]} · ${new Date(r.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
      button.append(title, meta); button.addEventListener("click", () => { selectedId = r.id; render(); }); li.append(button); return li;
    }));
  }
  renderSceneState();
}
async function loadSnapshot(ticket = epoch) {
  if (!identity) return;
  const next = await api(`/api/workspaces/${identity.workspace.id}/snapshot`);
  if (ticket !== epoch) return;
  snapshot = next; cursor = next.cursor;
  if (!selectedId || !next.runs.some(r => r.id === selectedId)) selectedId = next.runs[0]?.id ?? null;
  connection(); render();
}
function schedulePoll(ticket = epoch) {
  clearTimeout(poll); if (!identity || ticket !== epoch) return;
  poll = setTimeout(async () => {
    try {
      const page = await api(`/api/workspaces/${identity.workspace.id}/events?after=${cursor}`);
      if (ticket !== epoch) return;
      if (page.events.length) await loadSnapshot(ticket);
      connection();
    } catch (error) {
      if (ticket !== epoch || error.name === "AbortError") return;
      if (error.status === 401) { showLogin("다시 로그인하면 저장된 업무를 이어서 볼 수 있어요."); return; }
      connection("서버 연결을 기다리고 있어요. 연결되면 저장된 업무 상태를 다시 확인합니다.");
    } finally { if (ticket === epoch && identity) schedulePoll(ticket); }
  }, document.hidden ? 2000 : 500);
}
function mountScene() {
  const ticket = ++sceneEpoch; scene?.dispose(); scene = null; $("fallback").hidden = true; $("scene-state").textContent = "3D 준비 중";
  try {
    scene = createStudioView($("canvas-host"), {
      onStatus(kind) { if (ticket !== sceneEpoch) return; $("scene-state").textContent = kind === "ready" ? "실제 3D" : "2D 대체 화면"; $("fallback").hidden = kind === "ready"; },
      onSelect: selectColleague,
    }, { actors: ["nara", "jun"], modelUrl: "/assets/studio-team-v2.glb" });
    scene.resetCamera(cameraFrame); renderSceneState();
  } catch { $("fallback").hidden = false; $("scene-state").textContent = "2D 대체 화면"; }
}
async function enter(me) {
  resetSession(); identity = me;
  $("login-view").hidden = true; $("studio-view").hidden = false; $("signout").hidden = false; $("signed-user").hidden = false; $("signed-user").textContent = `${me.user.name}님`;
  $("auth-error").hidden = true; $("password").value = ""; $("task-error").hidden = true;
  mountScene(); await loadSnapshot(); schedulePoll();
}
function setAuthMode(value) {
  signup = value; $("login-tab").setAttribute("aria-pressed", String(!value)); $("signup-tab").setAttribute("aria-pressed", String(value));
  $("name-field").hidden = !value; $("name").required = value;
  $("password").autocomplete = value ? "new-password" : "current-password";
  $("login-title").textContent = value ? "나만의 공간을 만들어요." : "다시 만나 반가워요.";
  $("auth-submit").textContent = value ? "계정 만들고 시작하기 ↗" : "로그인하기 ↗"; $("auth-error").hidden = true;
}
$("login-tab").addEventListener("click", () => setAuthMode(false)); $("signup-tab").addEventListener("click", () => setAuthMode(true));
$("auth-form").addEventListener("submit", async e => {
  e.preventDefault(); $("auth-submit").disabled = true; $("auth-error").hidden = true;
  try {
    const body = { email: $("email").value.trim(), password: $("password").value, ...(signup ? { name: $("name").value.trim() } : {}) };
    await api(`/api/auth/${signup ? "sign-up" : "sign-in"}/email`, body); await enter(await api("/api/me"));
  } catch (error) { $("auth-error").textContent = error.status === 429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : signup ? "이름·이메일·비밀번호를 확인해 주세요. 이미 사용 중인 이메일일 수 있어요." : "이메일과 비밀번호를 확인해 주세요."; $("auth-error").hidden = false; }
  finally { $("auth-submit").disabled = false; }
});
$("signout").addEventListener("click", async () => { $("signout").disabled = true; try { await api("/api/auth/sign-out", {}); showLogin(); } catch (e) { handle(e); } finally { $("signout").disabled = false; } });
$("task").addEventListener("input", () => { $("character-count").textContent = `${$("task").value.length} / 2000`; });
$("agent").addEventListener("change", () => { setCameraFrame($("agent").value); render(); });
$("task-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!identity || busy) return;
  const body = { prompt: $("task").value.trim(), agentId: $("agent").value, approvalRequired: $("require-approval").checked, scenario: $("scenario").value };
  if (body.prompt.length < 2) { $("task-error").textContent = "업무를 두 글자 이상 입력해 주세요."; $("task-error").hidden = false; $("task").focus(); return; }
  const signature = JSON.stringify(body); if (!pending || pending.signature !== signature) pending = { signature, key: crypto.randomUUID() };
  const ticket = epoch; busy = true; $("task-error").hidden = true; render();
  try { const run = await api(`/api/workspaces/${identity.workspace.id}/runs`, body, pending.key); if (ticket !== epoch) return; selectedId = run.id; pending = null; await loadSnapshot(ticket); }
  catch (error) { if (ticket === epoch) { handle(error); try { await loadSnapshot(ticket); } catch {} } }
  finally { if (ticket === epoch) { busy = false; render(); } }
});
async function command(action) {
  const run = current(); if (!run || busy) return; const ticket = epoch; busy = true; $("task-error").hidden = true; render();
  // Reuse the key when the acknowledgement is lost, just as for a new task.
  if (action === "retry" && retryRequest?.runId !== run.id) retryRequest = { runId: run.id, key: crypto.randomUUID() };
  try {
    const response = await api(`/api/runs/${run.id}/${["approve", "decline"].includes(action) ? "approval" : action}`, ["approve", "decline"].includes(action) ? { version: run.version, approved: action === "approve" } : {}, action === "retry" ? retryRequest.key : undefined);
    if (ticket !== epoch) return; selectedId = response.id; retryRequest = null; await loadSnapshot(ticket);
  } catch (error) { if (ticket === epoch) { handle(error); try { await loadSnapshot(ticket); } catch {} } }
  finally { if (ticket === epoch) { busy = false; render(); } }
}
for (const [id, action] of [["approve", "approve"], ["decline", "decline"], ["cancel", "cancel"], ["retry", "retry"]]) $(id).addEventListener("click", () => command(action));
function setCameraFrame(frame) {
  cameraFrame = frame; scene?.resetCamera(frame);
  for (const [id, value] of [["whole-space", "team"], ["nara-focus", "nara"], ["jun-focus", "jun"]]) $(id).setAttribute("aria-pressed", String(frame === value));
}
function selectColleague(id) {
  if (!AGENT_NAMES[id] || busy) return;
  $("agent").value = id; setCameraFrame(id); render();
}
$("whole-space").addEventListener("click", () => setCameraFrame("team"));
for (const id of ["nara", "jun"]) $(`${id}-focus`).addEventListener("click", () => selectColleague(id));
$("motion").addEventListener("click", () => { motionOverridden = true; motionPaused = !motionPaused; renderSceneState(); });
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", e => { if (!motionOverridden) { motionPaused = e.matches; renderSceneState(); } });
$("recover-scene").addEventListener("click", mountScene);
document.addEventListener("visibilitychange", () => { if (identity && !document.hidden) { const ticket = epoch; void loadSnapshot(ticket).then(() => schedulePoll(ticket)).catch(handle); } });
window.addEventListener("pagehide", () => { clearTimeout(poll); requests.abort(); ++sceneEpoch; scene?.dispose(); scene = null; });
window.addEventListener("pageshow", e => { if (e.persisted) { requests = new AbortController(); void api("/api/me").then(enter).catch(() => showLogin()); } });
$("auth-submit").disabled = true;
api("/api/me").then(enter).catch(() => showLogin());
