export const AGENTS = Object.freeze([
  Object.freeze({ id: "nara", name: "나라", withName: "나라와", role: "기획 · 리서치", initial: "N", idleRow: 0, workRow: 1 }),
  Object.freeze({ id: "jun", name: "준", withName: "준과", role: "개발 · 설계", initial: "J", idleRow: 2, workRow: 3 }),
]);

export const ACTIVE = new Set(["queued", "running", "awaiting_approval"]);
export const STATUS_LABELS = Object.freeze({
  queued: "요청 확인 중", running: "업무 진행 중", awaiting_approval: "승인 대기",
  succeeded: "결과 준비 완료", failed: "연결 실패", cancelled: "취소됨", idle: "새 업무 대기",
});
const SCENARIOS = new Set(["normal", "approval", "failure"]);

export function createState() {
  return { selectedAgentId: "nara", currentRun: null, history: [], seenRequestKeys: [], seenRunIds: [] };
}

export function validateTask(value) {
  if (typeof value !== "string" || value.trim().length < 2) return "업무를 두 글자 이상 입력해 주세요.";
  if (value.trim().length > 400) return "업무는 400자 이내로 입력해 주세요.";
  return "";
}

export function exampleResult(agentId) {
  return agentId === "nara" ? {
    title: "첫 화면 구성 제안",
    summary: "핵심 메시지를 먼저 전하고, 첫 업무까지 자연스럽게 연결하세요.",
    items: ["핵심 메시지: AI 동료와 함께, 작은 일부터 완성하세요.", "첫 행동: 동료 선택 → 업무 요청 → 결과 확인", "화면 구성: 작은 오피스 + 집중된 업무 패널 + 결과 기록"],
  } : {
    title: "구현 구조 제안",
    summary: "업무 상태와 화면 표현을 독립시키면 기능을 안정적으로 확장할 수 있어요.",
    items: ["상태: 요청·진행·승인·완료를 명시적인 전이로 관리", "표현: 캐릭터는 화면용 상태를 받아 동작만 변경", "검증: 취소 후 늦은 응답과 중복 실행을 먼저 차단"],
  };
}

export function reduce(state, action) {
  if (!action || typeof action !== "object") return state;
  if (action.type === "SELECT") {
    return AGENTS.some(a => a.id === action.agentId)
      ? { ...state, selectedAgentId: action.agentId } : state;
  }
  if (action.type === "START") {
    if (typeof action.requestKey !== "string" || !action.requestKey || typeof action.runId !== "string" || !action.runId) return state;
    if (state.seenRequestKeys.includes(action.requestKey) || state.seenRunIds.includes(action.runId)) return state;
    if (state.currentRun && ACTIVE.has(state.currentRun.status)) return state;
    if (validateTask(action.task) || !SCENARIOS.has(action.scenario)) return state;
    return {
      ...state,
      seenRequestKeys: [...state.seenRequestKeys, action.requestKey],
      seenRunIds: [...state.seenRunIds, action.runId],
      history: state.currentRun ? [state.currentRun, ...state.history].slice(0, 9) : state.history,
      currentRun: {
        id: action.runId, requestKey: action.requestKey, agentId: state.selectedAgentId,
        task: action.task.trim(), scenario: action.scenario, status: "queued", step: 0,
        approved: false, startedAt: action.now, endedAt: null, result: null, note: "",
      },
    };
  }
  const run = state.currentRun;
  if (!run || action.runId !== run.id || !ACTIVE.has(run.status)) return state;
  const update = patch => ({ ...state, currentRun: { ...run, ...patch } });
  if (action.type === "CANCEL") return update({ status: "cancelled", endedAt: action.now, note: action.reason ?? "업무를 취소했어요." });
  if (action.type === "APPROVE") return run.status === "awaiting_approval"
    ? update({ status: "running", approved: true }) : state;
  if (action.type !== "ADVANCE" || action.expectedStep !== run.step || run.status === "awaiting_approval") return state;
  if (run.status === "queued") return update({ status: "running", step: 1 });
  if (run.step < 3) {
    if (run.scenario === "failure" && run.step === 2) return update({ status: "failed", endedAt: action.now, note: "모의 게이트웨이 연결에 실패했어요. 실제 외부 연결은 시도하지 않았어요." });
    return update({ step: run.step + 1 });
  }
  if (run.scenario === "approval" && !run.approved) return update({ status: "awaiting_approval" });
  return update({ status: "succeeded", step: 4, endedAt: action.now, result: exampleResult(run.agentId) });
}

export function completedRuns(state) {
  const current = state.currentRun && !ACTIVE.has(state.currentRun.status) ? [state.currentRun] : [];
  return [...current, ...state.history].slice(0, 10);
}

export function agentPresentation(state, agentId) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (!agent) return null;
  const run = state.currentRun?.agentId === agentId ? state.currentRun : null;
  const status = run?.status ?? "idle";
  return { ...agent, status, label: STATUS_LABELS[status], row: status === "running" ? agent.workRow : agent.idleRow };
}
