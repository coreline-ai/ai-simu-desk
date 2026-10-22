export const SCENARIOS={
 focus:{label:'집중과 짧은 회의',steps:[['역할별 업무','roles'],['3인 진행 확인','three'],['자리에서 휴식','rest'],['업무 복귀','roles']]},
 review:{label:'함께 검토하는 하루',steps:[['역할별 초안','roles'],['4인 검토 회의','four'],['5인 보드 검토','board'],['결과 정리','roles']]},
 break:{label:'커피와 재충전',steps:[['어깨와 손목 풀기','rest'],['다섯 동료 커피 순환','coffee'],['소파 대화와 창가 휴식','lounge'],['업무 복귀','roles']]}
};
export class ScenarioDirector{
 constructor(s){this.s=s;this.current=null;this.last=null;}
 start(name){if(typeof name!=='string'||!Object.hasOwn(SCENARIOS,name)||this.current||!this.s.ids.every(id=>this.s.idle(id)))return false;this.s.setAuto(false);this.s.resume.clear();this.current={name,index:0,stage:'ready',since:this.s.time,interrupted:false,retries:0,started:false};return true;}
 launch(kind){const s=this.s;switch(kind){case'roles':return s.ids.map(id=>s.startRole(id)).every(Boolean);case'rest':return s.ids.map(id=>s.startRest(id)).every(Boolean);case'three':return s.startGroupMeeting(s.ids.slice(0,3));case'four':return s.startGroupMeeting(s.ids.slice(1));case'board':return s.startReview();case'coffee':return s.ids.map(id=>s.startCoffee(id)).every(Boolean);case'lounge':return [s.startSofaPair(['nara','jun']),s.startWindow('sora'),s.startRest('min'),s.startRest('leo')].every(Boolean);default:return false;}}
 tick(){const c=this.current;if(!c)return;const s=this.s,profile=SCENARIOS[c.name];
  if(s.ids.some(id=>s.rawIncoming(id).pose!=='idle')){c.interrupted=true;c.stage='업무 우선 · 생활 정리';return;}
  if(!s.ids.every(id=>s.idle(id)))return;
  if(c.interrupted){c.interrupted=false;c.started=false;c.retries++;if(c.retries>2){this.cancel('업무 반복으로 시나리오 종료');return;}}
  if(c.started){c.index++;c.started=false;c.retries=0;}
  if(c.index>=profile.steps.length){this.last={name:c.name,status:'complete',steps:c.index};this.current=null;return;}
  const[label,kind]=profile.steps[c.index];c.stage=label;c.since=s.time;c.started=this.launch(kind);if(!c.started)this.cancel('시나리오 시작 조건 변경');
 }
 watchdog(){const c=this.current;if(c&&this.s.time-c.since>720){this.cancel('활동 대기 시간 초과');this.s.cancelAll();}}
 cancel(reason='사용자 중단'){if(this.current)this.last={name:this.current.name,status:'cancelled',reason,steps:this.current.index};this.current=null;}
 diagnostics(){const c=this.current;return{current:c?{...c,total:SCENARIOS[c.name].steps.length,label:SCENARIOS[c.name].label}:null,last:this.last};}
}
