export function followupDraft(run, kind) {
  if(!run || run.status!=="succeeded" || !run.output) return null;
  const mode=kind==="handoff"?"handoff":"revise";
  return {
    sourceRunId:run.id,mode,sourceAgent:run.agentId,sourcePrompt:run.prompt,sourceVersion:run.version,
    agentId:mode==="handoff"?(run.agentId==="nara"?"jun":"nara"):run.agentId,
    prompt:mode==="handoff"?(run.agentId==="nara"?"선택한 기획을 바탕으로 구현 계획과 완료 테스트를 작성해줘.":"선택한 개발 결과를 사용자 관점에서 검토하고 기획 계획과 수용 기준을 작성해줘."):kind==="table"?"이전 결과를 표로 정리해줘.":"이전 결과를 3줄로 요약해줘.",
    approvalRequired:mode==="handoff",
  };
}
