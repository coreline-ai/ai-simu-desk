import { setTimeout as wait } from "node:timers/promises";
import type { AgentPort, AgentJob, AgentEvent } from "../domain/contracts.js";
import { AgentFailure } from "../domain/contracts.js";
export function composeFakeAnswer(job: AgentJob): string {
  const text = job.prompt.replace(/\s+/g, " ").trim();
  const context = text.slice(0, 160) + (text.length > 160 ? "…" : "");
  const keywords = [...new Set(text.match(/[\p{L}\p{N}]{2,}/gu) ?? [])].filter(w => !["해주세요", "정리해", "정리해줘", "해줘", "그리고"].includes(w)).slice(0, 6).join(" · ");
  const intent = /일정|계획|로드맵|마일스톤/.test(text) ? "plan" : /개발|구현|API|코드|버그|DB|테스트/i.test(text) ? "engineering" : /화면|서비스|기획|메시지|디자인/.test(text) ? "product" : /요약|정리/.test(text) ? "summary" : /글|소개|문구|블로그/.test(text) ? "writing" : "general";
  const outlines: Record<string, string[]> = {
    plan: ["1. 목표와 완료 기준을 한 문장으로 정합니다.", "2. 준비 → 초안 → 검토 → 완료 순서로 작업을 나눕니다.", "3. 각 작업에 담당자·예상 기간·확인할 산출물을 적습니다.", "확인할 것: 선행 작업, 일정 여유, 완료를 판단할 기준."],
    engineering: ["1. 입력·상태 전이·결과의 경계를 먼저 정의합니다.", "2. 업무 규칙과 저장·화면 표현을 분리해 작은 단위로 구현합니다.", "3. 정상 흐름 다음에 오류·취소·중복 요청을 검증합니다.", "완료 기준: 재현 가능한 테스트와 실행 방법을 함께 남깁니다."],
    product: ["1. 첫 화면에는 대상 사용자와 얻을 가치를 짧게 보여줍니다.", "2. 핵심 행동은 하나로 정하고, 요청 → 진행 → 결과를 이어줍니다.", "3. 진행 상태와 다음 행동을 텍스트로 명확히 안내합니다.", "검토할 것: 핵심 문구, 첫 행동, 결과의 유용성, 모바일 가독성."],
    summary: ["1. 입력에 등장하는 주제와 핵심 단어를 먼저 추립니다.", "2. 사실·결정·할 일을 구분해 짧은 문장으로 묶습니다.", "3. 불명확한 내용은 확인할 항목으로 남깁니다.", "추가 자료가 있으면 원문·대상 독자·원하는 길이를 함께 정해 보세요."],
    writing: ["1. 독자와 글의 목적을 먼저 정합니다.", "2. 공감할 상황 → 핵심 제안 → 구체적 다음 행동 순서로 씁니다.", "3. 짧은 문장으로 초안을 만들고 반복 표현을 줄입니다.", "검토할 것: 어조, 구체적인 예시, 읽고 난 뒤의 행동."],
    general: ["1. 요청에서 가장 먼저 해결할 문제를 하나 고릅니다.", "2. 작은 초안을 만들고 필요한 정보와 가정을 나눠 적습니다.", "3. 검토 기준을 정한 뒤 다음 행동을 구체화합니다.", "확인할 것: 목표, 원하는 산출물, 제약 조건과 우선순위."],
  };
  const name = job.agentId === "nara" ? "나라" : "준";
  const role = job.agentId === "nara" ? "기획과 리서치 관점" : "개발과 설계 관점";
  return `${name}의 제안\n\n요청: ${context}\n핵심 단어: ${keywords || "목표 확인"}\n\n${role}에서 다음과 같이 접근해 볼 수 있어요.\n\n${outlines[intent].join("\n\n")}\n\n첫 번째 행동\n${job.agentId === "nara" ? "가장 중요한 사용자 요구와 검토할 질문을 3개 적어 보세요." : "가장 작은 구현 단위 하나와 통과해야 할 테스트를 정해 보세요."}\n\n이 답변은 입력의 키워드와 작업 유형을 이용한 로컬 Fake AI 시뮬레이션입니다. 실제 언어 모델의 추론·검색 결과가 아닙니다.`;
}
export class FakeAgent implements AgentPort {
  readonly provider = "fake" as const;
  constructor(private delayMs = 65) {}
  async *execute(job: AgentJob, signal: AbortSignal): AsyncIterable<AgentEvent> {
    const pause = () => wait(this.delayMs, undefined, { signal });
    signal.throwIfAborted();
    yield { kind: "progress", stage: "요청의 핵심을 정리하고 있어요" }; await pause();
    yield { kind: "progress", stage: job.agentId === "nara" ? "기획 관점의 초안을 구성하고 있어요" : "개발 관점의 구조를 잡고 있어요" }; await pause();
    const output = composeFakeAnswer(job);
    yield { kind: "progress", stage: "답변을 작성하고 있어요" };
    for (let offset = 0; offset < output.length; offset += 16) {
      await pause(); signal.throwIfAborted();
      if (job.scenario === "failure" && offset >= 96) throw new AgentFailure("SIMULATED_FAILURE");
      yield { kind: "delta", text: output.slice(offset, offset + 16) };
    }
    signal.throwIfAborted(); yield { kind: "completed", externalRef: `fake:${job.runId}` };
  }
}
