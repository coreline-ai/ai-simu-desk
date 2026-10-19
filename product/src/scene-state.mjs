import { ACTIVE, AGENTS } from "../../server/domain/contracts.ts";

export const AGENT_NAMES = Object.freeze({ nara: "나라", jun: "준" });
export const RUN_LABELS = Object.freeze({ awaiting_approval: "실행 승인 대기", queued: "실행 대기", running: "답변 작성 중", cancel_requested: "취소 확인 중", succeeded: "답변 저장 완료", failed: "실행 실패", cancelled: "취소됨" });

// Selection and history are presentation choices. Only a live server run owns motion.
export function teamSceneState(runs = [], selectedAgent = "nara", motionPaused = false) {
  const active = runs.find(run => ACTIVE.includes(run.status));
  return Object.freeze({
    selectedAgent: AGENTS.includes(selectedAgent) ? selectedAgent : "nara", motionPaused: Boolean(motionPaused),
    actors: AGENTS.map(agentId => Object.freeze({ agentId, pose: active?.agentId === agentId && active.status === "running" ? "typing" : "idle", label: active?.agentId === agentId ? RUN_LABELS[active.status] : "새 업무 대기" })),
  });
}
