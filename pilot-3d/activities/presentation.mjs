import {visitCaption} from './visit-presentation.mjs';
export const REST_LABELS={wrist_release:'앉아서 손목 풀기',shoulder_drop:'앉아서 어깨 내리기'};
export const CUP_LABELS={idle:'컵 제자리',reach:'컵에 손 뻗기',grasp:'손잡이 잡기',lift:'컵 들기',sip:'한 모금',lower:'컵 내리기',place:'컵 놓기',release:'손 떼기',retract:'손 거두기',carry:'컵 들고 이동',tablePlace:'탁자에 컵 놓기',tableRest:'탁자에 컵 놓음',tableReach:'컵 다시 잡기',tableGrasp:'손잡이 다시 잡기'};
export const MEETING_LABELS={group_note:'회의 노트에 메모',meeting_talk:'설명 중',meeting_listen:'경청 중',meeting_wait:'동료 기다리기',meeting_pause:'잠시 생각하기',meeting_ack:'확인 끄덕임',meeting_note:'함께 노트 보기',social_greet:'인사 건네기',social_respond:'인사에 응답',social_note:'함께 노트 확인',social_confirm:'내용 확인',sofa_talk:'이야기 중',sofa_listen:'경청 중',sofa_agree:'확인 끄덕임',sofa_relax:'함께 쉬는 중'};
const ROLE_STAGES={reach:'손 뻗기',grasp:'잡기',use:'사용 중',replace:'제자리에 놓기',release:'손 놓기',retract:'자세 정리'};
const STAGES={queued:'통로 대기',stand:'일어서기',out:'이동',settle:'발 정리',align:'자리 정렬',back:'착석 준비',sit:'앉기',rest:'휴식',rise:'일어서기',forward:'복귀 준비',home:'자리 복귀',deskTurn:'자리 정렬',deskSit:'책상 착석',pickup:'컵 준비',putback:'컵 정리'};
function labelFor(stats,team,id,a){
 const action=stats.activities?.[id]?.action,pair=team.sofaPair?.phase==='discussion'&&!team.sofaPair.ending&&team.sofaPair.ids.includes(id);
 switch(a.kind){
  case'coffee':return'커피 바 · '+({queued:'순서 대기',pickup:'컵 준비',out:'이동',place:'컵 놓기',press:'머신 버튼',brew:'음료 받기',retrieve:'컵 회수',home:'복귀',putback:'컵 정리'}[a.stage]??'커피 준비');
  case'group':return(team.group?.current?.ids.length?team.group.current.ids.length+'인 회의':'공동 회의')+' · '+(MEETING_LABELS[action]??STAGES[a.stage]??'함께 준비');
  case'visit':return visitCaption(team,id)??(team.transfer?.active?'문서 전달·확인':team.visits?.current?.phase==='inviting'?'방문 초대·응답':team.visits?.current?.phase==='discussion'?'함께 화면 검토':'동료 자리 방문');
  case'role':return(a.role?.label??{nara:'기획 메모',sora:'디자인 스케치',jun:'개발 업무',min:'QA 확인',leo:'문서 정리'}[id]??'역할 업무')+' · '+(ROLE_STAGES[a.stage]??'자세 정리');
  case'window':return'창가 · '+(STAGES[a.stage]??'둘러보기');
  case'micro':return REST_LABELS[a.restStyle]??'전신 휴식';
  case'cup':return CUP_LABELS[a.cup?.state??a.stage]??'컵 사용';
  case'sofa':return pair?'소파 대화 · '+(MEETING_LABELS[action]??'함께 쉬는 중'):'소파 · '+(STAGES[a.stage]??'함께 쉬는 중');
  case'review':return'보드 검토 · '+({approach:'보드로 이동',point:'마커로 설명',back:'대기 자리로 복귀',align:'발 정리',rest:'동료 설명 듣기'}[a.stage]??STAGES[a.stage]??'함께 준비');
  case'huddle':return'서서 대화 · '+(a.stage==='rest'?(stats.activities?.[id]?.speaking?'설명 중':'대화·경청'):STAGES[a.stage]??'함께 준비');
  default:return'회의 · '+(MEETING_LABELS[action]??STAGES[a.stage]??'함께 준비');
 }
}
export function activityCaption(stats,names){const team=stats.teamActivities;if(!team)return '';return Object.entries(team.actors).filter(([,a])=>a.kind!=='desk').map(([id,a])=>`${names[id]??id} · ${labelFor(stats,team,id,a)}${a.returning?' · 복귀 중':''}`).join(' / ')+(stats.paused&&Object.values(team.actors).some(a=>a.kind!=='desk')?' · 동작 정지':'');}
