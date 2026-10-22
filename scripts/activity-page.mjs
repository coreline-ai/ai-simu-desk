const description='한 모금의 커피, 소파에서의 쉼, 서로 마주 보는 회의. 다섯 동료가 공간을 함께 사용합니다.';
const specs={
  ensemble:[10,'손끝부터 일상까지, 다섯 동료의 하루','노트·스케치·체크·문서와 동료별 표정·걸음. 직접 커피를 내리고 모두 함께 회의합니다. 기존 v9와 비교하세요.'],
  final:[9,'더 넓고 편안해진 다섯 동료의 사무실','크림·오크·세이지로 채운 창가 작업실, 회의실과 라운지. 기존 공간과 비교하고 동작 속도를 바꿔 보세요.'],
  natural:[3,'더 자연스럽게 움직이는 다섯 동료','부드러운 출발과 착석, 인물별 전신 휴식, 인사와 공동 노트 확인. 이전 동작과 직접 비교해 보세요.'],
  roles:[4,'소품을 쓰고 교감하는 다섯 동료','기획 메모, 스케치, 코드 설명, QA 체크, 문서 정리. 기존 v3와 같은 구도에서 비교해 보세요.'],
  expressive:[5,'움직임이 이어지는 다섯 동료','코너 보행과 양보, 역할별 손짓과 번갈아 나누는 대화. 기존 v4와 같은 구도에서 비교하세요.'],
  interaction:[6,'손으로 만나고 함께 검토하는 동료','손가락으로 소품을 잡고, 동료 자리에서 함께 확인하는 하루. 기존 활동 v5와 비교하세요.'],
  grounded:[8,'발을 딛고 편안하게 협업하는 동료','발끝과 뒤꿈치의 지지, 팔과 가구의 접촉 확인, 테이블에 손을 기대는 회의. 기존 v7과 비교하세요.'],
  refined:[7,'손끝과 자세가 편안해진 다섯 동료','정확한 방문 상태, 손가락 다섯 개의 받침, 팔걸이와 무릎에 기대는 대화. 기존 v6와 같은 구도로 비교하세요.']
};
export const activityVariants=['team',...Object.keys(specs)];
export function activityPage(html,variant){
  if(variant==='team')return html;
  if(variant==='ensemble'){for(const id of['baseline','team','natural','roles','expressive','interaction','grounded','refined'])html=html.replace('id="'+id+'"','hidden id="'+id+'"');html=html.replace('새 사무실 · v9','기존 v9 · 사무실').replace('함께 일하는 하루','손끝부터, 함께하는 하루').replace('COFFEE, CONVERSATION, AND A LITTLE BREAK','THE ENSEMBLE / FIVE COLLEAGUES');}
  const spec=specs[variant];if(!spec)throw Error('Unknown activity page');if(variant==='final')html=html.replace('함께 일하는 하루','넓어진 공간, 함께하는 하루').replace('COFFEE, CONVERSATION, AND A LITTLE BREAK','THE MODERN OFFICE / CREAM, OAK & SAGE').replace('비교 전환은 구도·화질·조명·정지를 유지하고 활동은 초기화합니다.','공간 전환은 선택 동료·화질·조명·배속·정지를 유지하고 활동을 초기화합니다. 구도는 공간 크기에 맞춥니다.');
  return html.replace('<body>',`<body data-default-mode="${variant}">`).replaceAll('함께 쉬고, 다시 일하는 다섯 동료',spec[1]).replace(description,spec[2]).replace('Activities 2','Activities '+spec[0]);
}
