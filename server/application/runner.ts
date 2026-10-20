import { setTimeout as wait } from "node:timers/promises";
import type { AgentPort } from "../domain/contracts.js";
import type { StudioPort as Studio } from "../domain/studio-port.js";
import { AgentFailure } from "../domain/contracts.js";

export function createRunner(studio: Studio, agent: AgentPort, options: { timeoutMs?: number; pollMs?: number } = {}) {
  let stopping = false, started = false, failed = false, loopPromise: Promise<void> | null = null;
  let active: { id: string; controller: AbortController } | null = null;
  async function loop() {
    while (!stopping) {
      const job = await studio.claim();
      if (!job) { await wait(options.pollMs ?? 120); continue; }
      const controller = new AbortController(); active = { id: job.runId, controller };
      const timeout = setTimeout(() => controller.abort("timeout"), options.timeoutMs ?? 30000);
      let completed = false;
      try {
        for await (const item of agent.execute(job, controller.signal)) {
          controller.signal.throwIfAborted();
          if (await studio.getStatus(job.runId) === "cancel_requested") { controller.abort("cancel"); controller.signal.throwIfAborted(); }
          if (item.kind === "completed") { await studio.finish(job.runId, "succeeded", "로컬 Fake AI 응답을 저장했습니다.", item.externalRef); completed = true; break; }
          const applied = item.kind === "delta" ? await studio.progress(job.runId, item.text) : await studio.progress(job.runId, null, item.stage, item.phase);
          if (!applied) { controller.abort("cancel"); controller.signal.throwIfAborted(); }
        }
        if (!completed) await studio.finish(job.runId, "failed", "완료 신호 없이 응답이 끝났습니다.");
      } catch (error) {
        if (controller.signal.aborted && controller.signal.reason === "cancel") await studio.finish(job.runId, "cancelled", "로컬 Fake AI의 실행과 답변 수신을 중단했습니다.");
        else await studio.finish(job.runId, "failed", controller.signal.reason === "shutdown" ? "서버가 종료되어 실행을 중단했습니다. 다시 시도할 수 있습니다." : controller.signal.reason === "timeout" ? "실행 제한 시간을 초과했습니다." : error instanceof AgentFailure && error.code === "SIMULATED_FAILURE" ? "테스트용 Fake AI 장애를 재현했습니다. 다시 시도하면 정상 실행됩니다." : error instanceof AgentFailure && error.code === "OUTPUT_LIMIT" ? "답변 크기 제한을 초과했습니다." : "로컬 시뮬레이터 실행에 실패했습니다.");
      } finally { clearTimeout(timeout); active = null; }
    }
  }
  return {
    async start() { if (started) return; started = true; await studio.recoverInterrupted(); loopPromise = loop().catch(() => { failed = true; stopping = true; }); },
    cancel(id: string) { if (active?.id === id) active.controller.abort("cancel"); },
    status: () => ({ running: started && !stopping, failed, active: Boolean(active) }),
    async stop() { stopping = true; active?.controller.abort("shutdown"); await loopPromise; },
  };
}
