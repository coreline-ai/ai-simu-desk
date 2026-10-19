import { ACTIVE, STATUS_LABELS, createState, reduce, validateTask } from "../../demo/src/domain.mjs";
import { studioViewModel } from "./view-model.mjs";
import { createStudioView } from "./scene.mjs";

const $ = id => document.getElementById(id);
let state = createState(), view = null, timer = 0, timerKey = "", generation = 0;
let motionPaused = matchMedia("(prefers-reduced-motion: reduce)").matches, motionOverridden = false;
let mounts = 0, lifecycle = [], quality = "auto", closeup = false;
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");

function dispatch(action) { state = reduce(state, action); render(); schedule(); }
function schedule() {
  const run = state.currentRun;
  const key = run && ["queued", "running"].includes(run.status) ? `${run.id}:${run.status}:${run.step}` : "";
  if (key === timerKey) return;
  clearTimeout(timer); timerKey = key;
  if (!key) return;
  const { id: runId, step: expectedStep } = run;
  timer = setTimeout(() => dispatch({ type: "ADVANCE", runId, expectedStep, now: Date.now() }), run.status === "queued" ? 800 : 1300);
}
function render() {
  const run = state.currentRun, active = Boolean(run && ACTIVE.has(run.status));
  const vm = studioViewModel(state, motionPaused);
  view?.setViewModel(vm);
  $("stage").dataset.pose = vm.pose;
  $("actor-label").textContent = vm.label;
  $("start").disabled = active; $("task").disabled = active; $("scenario").disabled = active;
  $("start").textContent = active ? "업무 진행 중…" : "나라에게 업무 맡기기 ↗";
  $("character-count").textContent = `${$("task").value.length} / 400`;
  $("motion").textContent = motionPaused ? "움직임 재생" : "움직임 멈추기";
  $("motion").setAttribute("aria-pressed", String(motionPaused));
  $("run-status").textContent = run ? `나라 · ${STATUS_LABELS[run.status]}` : "READY WHEN YOU ARE";
  $("step-count").textContent = `${run?.step ?? 0} / 4`;
  const titles = { queued: "업무를 확인하고 있어요", running: "아이디어를 정리하고 있어요", awaiting_approval: "확인을 기다리고 있어요", succeeded: "업무 결과가 준비됐어요", failed: "연결에 잠시 문제가 생겼어요", cancelled: "업무를 취소했어요" };
  $("run-title").textContent = run ? titles[run.status] : "새 업무를 기다리고 있어요";
  $("run-detail").textContent = !run ? "업무를 맡기면 나라가 작업을 시작해요."
    : run.status === "awaiting_approval" ? "승인하면 같은 업무가 이어집니다."
    : run.status === "succeeded" ? "아래에서 준비된 예시 결과를 확인해 보세요."
    : ["failed", "cancelled"].includes(run.status) ? run.note : "나라와 함께하는 모의 업무입니다.";
  for (const [i, bar] of [...document.querySelectorAll(".progress i")].entries()) bar.classList.toggle("done", (run?.step ?? 0) > i);
  $("cancel").hidden = !active || run.status === "awaiting_approval";
  $("approve").hidden = $("decline").hidden = run?.status !== "awaiting_approval";
  $("retry").hidden = !["failed", "cancelled"].includes(run?.status);
  $("result").hidden = !run?.result;
  if (run?.result) {
    $("result-title").textContent = run.result.title; $("result-summary").textContent = run.result.summary;
    $("result-items").replaceChildren(...run.result.items.map(text => { const li = document.createElement("li"); li.textContent = text; return li; }));
  }
}
function start(task = $("task").value) {
  const error = validateTask(task); $("form-error").hidden = !error; $("form-error").textContent = error;
  $("task").setAttribute("aria-invalid", String(Boolean(error)));
  if (error) { $("task").focus(); return; }
  dispatch({ type: "START", task, scenario: $("scenario").value, runId: crypto.randomUUID(), requestKey: crypto.randomUUID(), now: Date.now() });
}
function metrics(data) {
  $("load-ms").textContent = data.loadedMs == null ? "—" : `${data.loadedMs} ms`;
  $("fps").textContent = data.measuring ? "측정 중…" : data.measurementInterrupted ? "탭 전환으로 중단" : data.measuredFps ? `${data.measuredFps} fps` : "측정 전";
  $("draw-count").textContent = `${data.drawCalls ?? 0} / ${(data.triangles ?? 0).toLocaleString()}`;
  $("resources").textContent = `${data.geometries ?? 0} / ${data.textures ?? 0}`;
  $("measure").disabled = Boolean(data.measuring) || $("stage").dataset.state !== "ready";
  $("stage").dataset.metrics = JSON.stringify(data);
}
function lifecycleStatus() {
  const last = lifecycle.at(-1);
  $("lifecycle-status").textContent = `장면 ${mounts}회 로드${last ? ` · 이전 장면 해제 후 형상 ${last.remaining.geometries}, 내부 텍스처 카운터 ${last.remaining.textures} · 컨텍스트 ${last.contextLost ? "해제됨" : "해제 요청"}` : " · 자체 GLB를 읽어 표시합니다."}`;
  $("lifecycle-status").dataset.records = JSON.stringify(lifecycle);
}
function mountScene() {
  const ticket = ++generation;
  const previous = view?.dispose(); if (previous) lifecycle.push(previous);
  view = null; mounts++;
  $("stage").dataset.state = "loading";
  $("loading").hidden = false; $("fallback").hidden = true;
  $("reload-scene").disabled = $("recover").disabled = true;
  $("measure").disabled = $("context-test").disabled = true;
  $("render-label").textContent = "3D 준비 중";
  lifecycleStatus();
  function status(kind) {
    if (ticket !== generation) return;
    $("stage").dataset.state = kind;
    $("loading").hidden = true;
    $("reload-scene").disabled = $("recover").disabled = false;
    $("fallback").hidden = kind === "ready";
    $("measure").disabled = $("context-test").disabled = kind !== "ready";
    $("render-label").textContent = kind === "ready" ? "실제 3D · GLB" : "2D 대체 화면";
    if (kind !== "ready") $("fallback-message").textContent = kind === "lost" ? "그래픽 연결이 중단됐어요. 3D를 다시 불러올 수 있고 업무는 계속 진행됩니다." : "3D 화면을 불러오지 못했어요. 업무 패널은 계속 사용할 수 있어요.";
  }
  try {
    view = createStudioView($("canvas-host"), {
      onMetrics: data => { if (ticket === generation) metrics(data); },
      onStatus: status,
      onSelect: () => { $("selection-message").textContent = "나라를 선택했어요. 오른쪽 업무 패널에서 일을 맡겨보세요."; },
    });
    view.setQuality(quality); view.resetCamera(closeup); view.setViewModel(studioViewModel(state, motionPaused));
  } catch { status("error"); }
}
$("task-form").addEventListener("submit", e => { e.preventDefault(); start(); });
$("task").addEventListener("input", () => { $("character-count").textContent = `${$("task").value.length} / 400`; });
$("cancel").addEventListener("click", () => dispatch({ type: "CANCEL", runId: state.currentRun?.id, now: Date.now() }));
$("approve").addEventListener("click", () => dispatch({ type: "APPROVE", runId: state.currentRun?.id, now: Date.now() }));
$("decline").addEventListener("click", () => dispatch({ type: "CANCEL", runId: state.currentRun?.id, reason: "승인을 거절했어요.", now: Date.now() }));
$("retry").addEventListener("click", () => start(state.currentRun?.task ?? $("task").value));
$("motion").addEventListener("click", () => { motionOverridden = true; motionPaused = !motionPaused; render(); });
motionPreference.addEventListener("change", e => { if (!motionOverridden) { motionPaused = e.matches; render(); } });
$("select-nara").addEventListener("click", () => { $("selection-message").textContent = "나라와 함께할 준비가 됐어요."; });
for (const [id, focus] of [["wide-view", false], ["focus-view", true]]) $(id).addEventListener("click", () => {
  closeup = focus; view?.resetCamera(focus);
  $("wide-view").setAttribute("aria-pressed", String(!focus)); $("focus-view").setAttribute("aria-pressed", String(focus));
});
$("quality").addEventListener("change", e => { quality = e.target.value; view?.setQuality(quality); });
$("measure").addEventListener("click", () => view?.measure());
$("reload-scene").addEventListener("click", mountScene); $("recover").addEventListener("click", mountScene);
$("context-test").addEventListener("click", () => view?.loseContext());
window.addEventListener("pagehide", () => { ++generation; clearTimeout(timer); timerKey = ""; view?.dispose(); view = null; });
window.addEventListener("pageshow", e => { if (e.persisted) { mountScene(); schedule(); } });
render(); mountScene();
