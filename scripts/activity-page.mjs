const description='한 모금의 커피, 소파에서의 쉼, 서로 마주 보는 회의. 다섯 동료가 공간을 함께 사용합니다.';
const specs={
  natural:[3,'더 자연스럽게 움직이는 다섯 동료','부드러운 출발과 착석, 인물별 전신 휴식, 인사와 공동 노트 확인. 이전 동작과 직접 비교해 보세요.'],
  roles:[4,'소품을 쓰고 교감하는 다섯 동료','기획 메모, 스케치, 코드 설명, QA 체크, 문서 정리. 기존 v3와 같은 구도에서 비교해 보세요.'],
  expressive:[5,'움직임이 이어지는 다섯 동료','코너 보행과 양보, 역할별 손짓과 번갈아 나누는 대화. 기존 v4와 같은 구도에서 비교하세요.'],
  interaction:[6,'손으로 만나고 함께 검토하는 동료','손가락으로 소품을 잡고, 동료 자리에서 함께 확인하는 하루. 기존 활동 v5와 비교하세요.'],
  refined:[7,'손끝과 자세가 편안해진 다섯 동료','정확한 방문 상태, 손가락 다섯 개의 받침, 팔걸이와 무릎에 기대는 대화. 기존 v6와 같은 구도로 비교하세요.']
};
export const activityVariants=['team',...Object.keys(specs)];
export function activityPage(html,variant){
  if(variant==='team')return html;
  const spec=specs[variant];if(!spec)throw Error('Unknown activity page');
  return html.replace('<body>',`<body data-default-mode="${variant}">`).replaceAll('함께 쉬고, 다시 일하는 다섯 동료',spec[1]).replace(description,spec[2]).replace('Activities 2','Activities '+spec[0]);
}
