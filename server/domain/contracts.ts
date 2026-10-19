export const RUN_STATUSES = ["awaiting_approval", "queued", "running", "cancel_requested", "succeeded", "failed", "cancelled"] as const;
export type RunStatus = typeof RUN_STATUSES[number];
export const ACTIVE: readonly RunStatus[] = ["awaiting_approval", "queued", "running", "cancel_requested"];
export const TERMINAL: readonly RunStatus[] = ["succeeded", "failed", "cancelled"];
export const AGENTS = ["nara", "jun"] as const;
export type AgentId = typeof AGENTS[number];
export interface TaskInput { prompt: string; agentId: AgentId; approvalRequired: boolean; scenario: "normal" | "failure" }
export interface AgentJob { runId: string; prompt: string; agentId: AgentId; scenario: "normal" | "failure" }
export type AgentEvent = { kind: "progress"; stage: string } | { kind: "delta"; text: string } | { kind: "completed"; externalRef: string };
export interface AgentPort {
  readonly provider: "fake";
  execute(job: AgentJob, signal: AbortSignal): AsyncIterable<AgentEvent>;
}
export class AgentFailure extends Error {
  constructor(public code: "SIMULATED_FAILURE" | "OUTPUT_LIMIT") { super(code); }
}
export class AppError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 413 | 429, message: string, public code = "INVALID_REQUEST") { super(message); }
}
export function parseInput(value: unknown): TaskInput {
  if (!value || typeof value !== "object") throw new AppError(400, "업무 내용을 확인해 주세요.");
  const v = value as Record<string, unknown>;
  if (typeof v.prompt !== "string" || v.prompt.trim().length < 2 || v.prompt.trim().length > 2000) throw new AppError(400, "업무는 2~2000자로 입력해 주세요.");
  if (!AGENTS.includes(v.agentId as AgentId)) throw new AppError(400, "동료를 선택해 주세요.");
  if (typeof v.approvalRequired !== "boolean" || !["normal", "failure"].includes(String(v.scenario))) throw new AppError(400, "실행 설정을 확인해 주세요.");
  return { prompt: v.prompt.trim(), agentId: v.agentId as AgentId, approvalRequired: v.approvalRequired, scenario: v.scenario as TaskInput["scenario"] };
}
export function validRequestKey(key: string | undefined): string {
  if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new AppError(400, "유효한 요청 키가 필요합니다.");
  return key;
}
export function mayTransition(from: RunStatus, to: RunStatus): boolean {
  const edges: Record<RunStatus, readonly RunStatus[]> = {
    awaiting_approval: ["queued", "cancelled"], queued: ["running", "cancelled"],
    running: ["running", "cancel_requested", "succeeded", "failed"],
    cancel_requested: ["cancelled", "succeeded", "failed"], succeeded: [], failed: [], cancelled: [],
  };
  return edges[from].includes(to);
}
