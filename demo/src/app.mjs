import { AGENTS, ACTIVE, STATUS_LABELS, createState, validateTask, reduce, completedRuns, agentPresentation } from "./domain.mjs";
import { createSceneAnimator } from "./scene.mjs";

const $ = id => document.getElementById(id);
let state = createState();
let timer = 0;
let scheduledKey = "";
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = motionPreference.matches;
let motionOverridden = false;
const animator = createSceneAnimator(document, reducedMotion);
const taskInput = $("task-input");
const scenario = $("scenario");
const dialog = $("assets-dialog");

function syncTimer() {
  const run = state.currentRun;
  const key = run && ["queued", "running"].includes(run.status) ? `${run.id}:${run.status}:${run.step}` : "";
  if (scheduledKey === key) return;
  clearTimeout(timer);
  scheduledKey = key;
  if (!key) return;
  const { id: runId, step: expectedStep } = run;
  timer = setTimeout(() => dispatch({ type: "ADVANCE", runId, expectedStep, now: Date.now() }), run.status === "queued" ? 900 : 1400);
}

function dispatch(action) {
  state = reduce(state, action);
  render();
  syncTimer();
}

function renderHistory() {
  const runs = completedRuns(state);
  $("history-count").textContent = String(runs.length);
  $("history-empty").hidden = runs.length > 0;
  const items = runs.map(run => {
    const agent = AGENTS.find(a => a.id === run.agentId);
    const item = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "history-icon";
    icon.textContent = run.status === "succeeded" ? "✓" : run.status === "failed" ? "!" : "–";
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = run.task;
    const meta = document.createElement("small");
    meta.textContent = `${agent.name} · 모의 실행 · ${new Date(run.endedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
    copy.append(title, meta);
    const status = document.createElement("span");
    status.className = "history-state";
    status.dataset.state = run.status;
    status.textContent = STATUS_LABELS[run.status];
    item.append(icon, copy, status);
    return item;
  });
  $("history-list").replaceChildren(...items);
}

function renderRun() {
  const run = state.currentRun;
  const active = run && ACTIVE.has(run.status);
  const owner = run && AGENTS.find(a => a.id === run.agentId);
  const titles = {
    queued: "업무를 확인하고 있어요", running: ["", "필요한 맥락을 살펴보고 있어요", "생각을 하나씩 정리하고 있어요", "결과를 다듬고 있어요"][run?.step] ?? "진행 중이에요",
    awaiting_approval: "확인을 기다리고 있어요", succeeded: "업무 결과가 준비됐어요", failed: "연결에 잠시 문제가 생겼어요", cancelled: "업무를 취소했어요",
  };
  $("start-task").disabled = Boolean(active);
  $("start-label").textContent = active ? "진행 중인 업무가 있어요" : `${AGENTS.find(a => a.id === state.selectedAgentId).name}에게 업무 맡기기`;
  taskInput.disabled = Boolean(active);
  scenario.disabled = Boolean(active);
  $("run-status").dataset.state = run?.status ?? "idle";
  $("run-status").textContent = run ? `${owner.name} · ${STATUS_LABELS[run.status]}` : "READY WHEN YOU ARE";
  $("run-step-count").textContent = `${run?.step ?? 0} / 4`;
  $("run-title").textContent = run ? titles[run.status] : "새 업무를 기다리고 있어요";
  $("run-detail").textContent = !run ? "업무를 맡기면 진행 과정을 여기에 보여드릴게요."
    : run.status === "failed" || run.status === "cancelled" ? run.note
    : run.status === "awaiting_approval" ? "아래에서 승인하면 같은 업무가 이어져요."
    : run.status === "succeeded" ? "아래에서 예시 결과를 확인해 보세요."
    : `${owner.withName} 함께하는 모의 업무가 진행 중이에요.`;
  for (const [index, step] of [...$("work-steps").children].entries()) {
    step.classList.toggle("done", Boolean(run && run.step > index));
    step.classList.toggle("current", Boolean(active && run.step === index + 1));
    if (active && run.step === index + 1) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  }
  $("approval-box").hidden = run?.status !== "awaiting_approval";
  $("cancel-task").hidden = !active || run.status === "awaiting_approval";
  $("retry-task").hidden = !["failed", "cancelled"].includes(run?.status);
  $("result-card").hidden = !run?.result;
  if (run?.result) {
    $("result-title").textContent = run.result.title;
    $("result-summary").textContent = run.result.summary;
    $("result-items").replaceChildren(...run.result.items.map(text => {
      const item = document.createElement("li"); item.textContent = text; return item;
    }));
  }
}

function render() {
  const selected = AGENTS.find(a => a.id === state.selectedAgentId);
  $("task-title").textContent = `${selected.withName} 함께하기`;
  $("selected-role").textContent = selected.role;
  $("selected-avatar").textContent = selected.initial;
  $("selected-avatar").className = `avatar large ${selected.id}`;
  $("agent-intro").textContent = selected.id === "nara" ? "복잡한 생각을 정리하고, 다음에 할 일을 함께 찾아요." : "아이디어를 작은 구조로 나누고, 구현할 방법을 함께 찾아요.";
  for (const button of document.querySelectorAll("[data-select]")) button.setAttribute("aria-pressed", String(button.dataset.select === selected.id));
  for (const agent of AGENTS) {
    const view = agentPresentation(state, agent.id);
    document.querySelector(`[data-sprite][data-agent="${agent.id}"]`).dataset.row = String(view.row);
    document.querySelector(`[data-actor-status="${agent.id}"]`).textContent = view.label;
    for (const dot of document.querySelectorAll(`[data-member-status="${agent.id}"],[data-actor-dot="${agent.id}"]`)) {
      dot.dataset.state = view.status;
      dot.setAttribute("aria-label", view.label);
    }
  }
  $("character-count").textContent = `${taskInput.value.length} / 400`;
  $("toggle-motion").setAttribute("aria-pressed", String(reducedMotion));
  $("motion-label").textContent = reducedMotion ? "움직임 재생" : "움직임 멈추기";
  renderRun();
  renderHistory();
  animator.refresh();
}

function startWork(task = taskInput.value, nextScenario = scenario.value) {
  const error = validateTask(task);
  $("form-error").hidden = !error;
  $("form-error").textContent = error;
  taskInput.setAttribute("aria-invalid", String(Boolean(error)));
  if (error) { taskInput.focus(); return; }
  dispatch({ type: "START", task, scenario: nextScenario, runId: crypto.randomUUID(), requestKey: crypto.randomUUID(), now: Date.now() });
}

$("task-form").addEventListener("submit", event => { event.preventDefault(); startWork(); });
taskInput.addEventListener("input", () => {
  $("character-count").textContent = `${taskInput.value.length} / 400`;
  $("form-error").hidden = true;
  taskInput.setAttribute("aria-invalid", "false");
});
for (const button of document.querySelectorAll("[data-select]")) button.addEventListener("click", () => dispatch({ type: "SELECT", agentId: button.dataset.select }));
$("cancel-task").addEventListener("click", () => dispatch({ type: "CANCEL", runId: state.currentRun.id, now: Date.now() }));
$("approve-task").addEventListener("click", () => dispatch({ type: "APPROVE", runId: state.currentRun.id }));
$("decline-task").addEventListener("click", () => dispatch({ type: "CANCEL", runId: state.currentRun.id, reason: "승인을 거절해 업무를 취소했어요.", now: Date.now() }));
$("retry-task").addEventListener("click", () => {
  const run = state.currentRun;
  if (!run || !["failed", "cancelled"].includes(run.status)) return;
  state = reduce(state, { type: "SELECT", agentId: run.agentId });
  taskInput.value = run.task;
  scenario.value = "normal";
  startWork(run.task, "normal");
});
$("toggle-motion").addEventListener("click", () => {
  motionOverridden = true;
  reducedMotion = !reducedMotion;
  animator.setReduced(reducedMotion);
  render();
});
motionPreference.addEventListener("change", event => {
  if (motionOverridden) return;
  reducedMotion = event.matches; animator.setReduced(reducedMotion); render();
});
$("open-assets").addEventListener("click", () => { dialog.showModal(); animator.refresh(); });
$("close-assets").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
});
for (const button of document.querySelectorAll("[data-pose]")) button.addEventListener("click", () => {
  for (const choice of document.querySelectorAll("[data-pose]")) choice.setAttribute("aria-pressed", String(choice === button));
  const working = button.dataset.pose === "working";
  for (const agent of AGENTS) document.querySelector(`[data-preview="${agent.id}"]`).dataset.row = String(working ? agent.workRow : agent.idleRow);
  animator.refresh();
});
const officeImage = $("office-image");
function backgroundFailed() { officeImage.hidden = true; $("image-fallback").hidden = false; }
officeImage.addEventListener("error", backgroundFailed);
if (officeImage.complete && !officeImage.naturalWidth) backgroundFailed();
window.addEventListener("pagehide", event => {
  clearTimeout(timer); scheduledKey = "";
  if (!event.persisted) animator.dispose();
});
window.addEventListener("pageshow", event => { if (event.persisted) { animator.refresh(); syncTimer(); } });
render();
