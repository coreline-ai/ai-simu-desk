const TRIP_LABELS={queued:'통로에서 순서 기다리기',stand:'내 자리에서 일어서기',out:'동료 자리로 이동',align:'동료 자리 옆에서 발 정리',rest:'동료 자리에서 함께 검토',home:'내 자리로 복귀',deskTurn:'내 자리에서 방향 정리',deskSit:'내 책상에 앉기'};
const PAPER_LABELS={pickup:['문서 받기 기다리기','문서에 손 뻗기'],grasp:['문서 받기 기다리기','문서 잡기'],present:['건네는 문서 확인','문서 제시'],receive:['문서 받을 손 뻗기','문서 건네기'],accept:['문서 받기','문서에서 손 떼기'],read:['받은 문서 확인','동료의 문서 확인 기다리기'],giveback:['문서 돌려주기','돌려받을 손 뻗기'],regrasp:['반환할 문서에서 손 떼기','문서 돌려받기'],return:['문서 반환 확인','문서 제자리에 놓기'],release:['손 거두기','손 거두기'],carry:['문서 들고 내 자리로 복귀','문서에서 손 거두기'],dock:['내 책상에 문서 놓기','문서에서 손 거두기'],cancelPlace:['문서 안전하게 정리','문서 안전하게 정리']};

// Presentation only: never changes routes, arm ownership, or server work.
export function describeVisit({role,phase,tripStage,ending,paperStage,paperControlled=false}) {
  const visitor=role==='visitor';
  let label;
  if(paperControlled&&PAPER_LABELS[paperStage])label=PAPER_LABELS[paperStage][visitor?0:1];
  else if(phase==='inviting'&&!ending)label=visitor?'방문 초대 · 응답 기다리기':'내 자리에서 방문 초대에 응답';
  else if(!visitor)label=ending?'내 자리에서 손 정리':phase==='arriving'?'내 자리에서 동료 기다리기':phase==='transfer'?'내 자리에서 문서 검토 기다리기':'내 자리에서 함께 화면 검토';
  else label=TRIP_LABELS[tripStage]??'방문 자세 정리';
  return {role,label,moving:visitor&&['stand','out','align','home','deskTurn','deskSit'].includes(tripStage),returning:visitor&&!!ending,stage:visitor?tripStage:'hosting'};
}

export function visitCaption(team,id){return team?.actors?.[id]?.visitPresentation?.label??null;}
