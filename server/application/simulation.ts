// Finite, deterministic Fake AI progress; no timers or detached workers in a Function.
export function simulationFrame(answer:string,scenario:"normal"|"failure",elapsedMs:number,delayMs:number) {
  const chunks=Math.max(0,Math.floor(elapsedMs/Math.max(1,delayMs))-2);
  const size=Math.min(answer.length,chunks*16,16000);
  if(answer.length>16000)return {status:"failed" as const,output:"",stage:"실행 실패",note:"답변 크기 제한을 초과했습니다."};
  if(scenario==="failure"&&size>=112)return {status:"failed" as const,output:answer.slice(0,96),stage:"실행 실패",note:"테스트용 Fake AI 장애를 재현했습니다. 다시 시도하면 정상 실행됩니다."};
  if(size===answer.length)return {status:"succeeded" as const,output:answer,stage:"답변 완성",note:"Fake AI 응답을 저장했습니다."};
  if(elapsedMs>=30000)return {status:"failed" as const,output:answer.slice(0,size),stage:"실행 실패",note:"실행 제한 시간을 초과했습니다."};
  return {status:"running" as const,output:answer.slice(0,size),stage:chunks>0?"답변을 작성하고 있어요":"요청의 핵심을 정리하고 있어요",note:""};
}
