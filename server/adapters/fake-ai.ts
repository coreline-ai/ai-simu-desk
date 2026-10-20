import { setTimeout as wait } from "node:timers/promises";
import type { AgentPort, AgentJob, AgentEvent } from "../domain/contracts.js";
import { AgentFailure } from "../domain/contracts.js";
import {createFakeAnswer,phaseAt} from "../domain/fake-answer.js";
export function composeFakeAnswer(job:AgentJob):string {return job.answer?.text ?? createFakeAnswer(job).text;}
export class FakeAgent implements AgentPort {
  readonly provider = "fake" as const;
  constructor(private delayMs = 65) {}
  async *execute(job: AgentJob, signal: AbortSignal): AsyncIterable<AgentEvent> {
    const pause = () => wait(this.delayMs, undefined, { signal });
    signal.throwIfAborted();
    yield { kind: "progress", stage: "요청의 핵심을 정리하고 있어요", phase:"analyze" }; await wait(Math.max(this.delayMs,400),undefined,{signal});
    yield { kind: "progress", stage: job.agentId === "nara" ? "기획 관점의 초안을 구성하고 있어요" : "개발 관점의 구조를 잡고 있어요", phase:"analyze" }; await wait(Math.max(this.delayMs,400),undefined,{signal});
    const output = composeFakeAnswer(job);
    yield { kind: "progress", stage: "답변을 작성하고 있어요", phase:"compose" };
    for (let offset = 0; offset < output.length; offset += 16) {
      await pause(); signal.throwIfAborted();
      if (job.scenario === "failure" && offset >= 96) throw new AgentFailure("SIMULATED_FAILURE");
      if(offset>0 && phaseAt(offset,output.length)==="review" && phaseAt(offset-16,output.length)!=="review") yield {kind:"progress",stage:"조건과 결과를 검토하고 있어요",phase:"review"};
      yield { kind: "delta", text: output.slice(offset, offset + 16) };
    }
    signal.throwIfAborted(); yield { kind: "completed", externalRef: `fake:${job.runId}` };
  }
}
