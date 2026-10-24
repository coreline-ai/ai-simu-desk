import {profile} from './profile.mjs';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{const u=clamp(x);return u*u*(3-2*u);};
const mix=(a,b,t)=>a+(b-a)*ease(t);
const vector=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));
const pen=(x,z,lift=0)=>({x,z,lift});
const penMix=(a,b,t)=>({x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),lift:mix(a.lift,b.lift,t)});
const REST=[-.105,.805,.335],REFERENCE=[-.11,.810,.365];
const relaxed=[.18,.24,.29,.34,.39],point=[.24,.045,.38,.46,.52];
const paper=[.060,.075,0],screen=[-.045,.115,.008];
const initial=pen(.002,.003,.009);

function pose(cue,label,phase,extra={}){
 return{cue:`min-${cue}`,label,phase,reading:phase!=='act',pen:initial,left:REST,
  leftGrip:point,head:paper,torso:[.018,.012,0],expression:'focus',propBeat:0,...extra};
}

// Each stroke sits in the narrow real checklist area. The lead's paper raycast
// remains authoritative; hovering means a lifted pen, never a fake contact.
function checkMark(t,z){
 const u=clamp(t);
 if(u<.42)return penMix(pen(.001,z,.0008),pen(.005,z+.006,.0008),u/.42);
 return penMix(pen(.005,z+.006,.0008),pen(.014,z-.002,.0008),(u-.42)/.58);
}

function compare(t){
 if(t<1.35)return pose('compare-first','펜 끝으로 첫 번째 항목을 확인','observe',{
  left:vector(REST,REFERENCE,t/.65),head:paper,propBeat:.12,
 });
 if(t<2.25)return pose('compare-next','다음 항목으로 조심스럽게 이동','observe',{
  pen:penMix(initial,pen(.003,.027,.010),(t-1.35)/.9),left:REFERENCE,head:paper,propBeat:.34,
 });
 if(t<4.65)return pose('compare-screen','펜을 멈추고 화면의 결과와 대조','pause',{
  pen:pen(.003,.027,.010),left:REFERENCE,
  head:vector(paper,screen,(t-2.25)/.6),torso:[-.016,.028,0],expression:'thinking',propBeat:.34,
 });
 if(t<5.65)return pose('compare-return','확인한 항목으로 시선을 되돌리기','observe',{
  pen:penMix(pen(.003,.027,.010),pen(.001,.050,.0008),(t-4.65)),left:REFERENCE,
  head:vector(screen,paper,(t-4.65)/.65),torso:[.022,.012,0],propBeat:.58,
 });
 if(t<6.4)return pose('compare-mark','대조가 끝난 항목에 작은 표시','act',{
  pen:penMix(pen(.001,.050,.0008),pen(.014,.050,.0008),(t-5.65)/.75),left:REFERENCE,
  head:[.065,.075,0],torso:[.026,.014,0],propBeat:.58,
 });
 if(t<8.95)return pose('compare-crosscheck','표시를 마친 뒤 화면을 다시 확인','pause',{
  pen:penMix(pen(.014,.050,.0008),pen(.014,.050,.027),(t-6.4)/.5),left:REFERENCE,
  head:vector(paper,screen,(t-6.4)/.65),torso:[-.012,.024,0],expression:'thinking',propBeat:.58,
 });
 return pose('compare-confirm','종이와 결과가 일치하는지 최종 확인','check',{
  pen:pen(.014,.050,.027),left:vector(REFERENCE,REST,(t-8.95)/.65),leftGrip:relaxed,
  head:vector(screen,paper,(t-8.95)/.7),torso:[.006,.012,0],expression:'positive',propBeat:.77,
 });
}

function discrepancy(t){
 if(t<1.6)return pose('recheck-scan','두 번째 항목의 세부 값을 다시 읽기','observe',{
  pen:penMix(pen(.002,.003,.010),pen(.003,.027,.009),t/1.6),left:REFERENCE,propBeat:.34,
 });
 if(t<4.8)return pose('recheck-stop','불일치를 발견하고 펜을 멈춘 채 재검토','pause',{
  pen:penMix(pen(.003,.027,.009),pen(.003,.027,.033),(t-1.6)/.55),left:REFERENCE,
  head:vector(paper,[-.035,.15,-.035],(t-1.6)/.7),torso:[-.020,.035,-.012],expression:'thinking',propBeat:.34,
 });
 if(t<6.05)return pose('recheck-reference','기준 카드와 원래 항목을 교차 확인','check',{
  pen:pen(.003,.027,.033),left:REFERENCE,leftGrip:point,
  head:vector([-.035,.15,-.035],[.070,-.17,-.015],(t-4.8)/.7),torso:[.026,-.045,-.008],expression:'thinking',propBeat:.06,
 });
 if(t<6.75)return pose('recheck-lower','확인한 수정 위치에 펜을 내리기','observe',{
  pen:penMix(pen(.003,.027,.033),pen(.001,.029,.0008),(t-6.05)/.7),left:REFERENCE,
  head:vector([.070,-.17,-.015],paper,(t-6.05)/.65),torso:[.025,.012,0],propBeat:.34,
 });
 if(t<7.45)return pose('recheck-correction','틀린 위치에 짧고 정확한 수정선','act',{
  pen:penMix(pen(.001,.029,.0008),pen(.013,.029,.0008),(t-6.75)/.7),left:REFERENCE,
  head:[.067,.075,-.010],torso:[.030,.015,0],propBeat:.34,
 });
 return pose('recheck-result','수정 후 다시 읽고 성급히 확정하지 않기','check',{
  pen:penMix(pen(.013,.029,.0008),pen(.013,.029,.030),(t-7.45)/.55),left:REFERENCE,
  head:vector(paper,screen,(t-8.2)/.85),torso:[-.012,.025,0],expression:'thinking',propBeat:.57,
 });
}

function confirm(t){
 if(t<3.7)return pose('confirm-review','확정 전에 마지막 항목을 길게 검토','observe',{
  pen:pen(.002,.050,.023),left:REFERENCE,
  head:vector(screen,paper,(t-2.15)/1.2),torso:[.010,.020,0],expression:'thinking',propBeat:.57,
 });
 if(t<4.2)return pose('confirm-lower','첫 체크 위치에 펜 끝을 내리기','observe',{
  pen:penMix(pen(.002,.050,.023),pen(.001,.050,.0008),(t-3.7)/.5),left:REFERENCE,propBeat:.57,
 });
 if(t<5.05)return pose('confirm-first-check','첫 번째 짧은 체크','act',{
  pen:checkMark((t-4.2)/.85,.050),left:REFERENCE,head:[.067,.075,0],torso:[.027,.012,0],propBeat:.72,
 });
 if(t<6.05)return pose('confirm-next','펜을 띄워 다음 체크 위치로 이동','pause',{
  pen:t<5.5?penMix(pen(.014,.048,.0008),pen(.014,.048,.019),(t-5.05)/.45):penMix(pen(.014,.048,.019),pen(.001,.075,.0008),(t-5.5)/.55),
  left:REFERENCE,propBeat:.78,
 });
 if(t<6.9)return pose('confirm-second-check','두 번째 짧은 체크로 확정','act',{
  pen:checkMark((t-6.05)/.85,.075),left:REFERENCE,head:[.067,.075,0],torso:[.027,.012,0],propBeat:.92,
 });
 const nodTime=t-7.65;
 const nod=nodTime>=0&&nodTime<1.6?.055*Math.sin(Math.PI*clamp((nodTime% .8)/.8)):0;
 return pose('confirm-double-nod','펜을 멈추고 두 번 작게 끄덕여 확정','check',{
  pen:penMix(pen(.014,.073,.0008),pen(.014,.073,.031),(t-6.9)/.55),
  left:vector(REFERENCE,REST,(t-7.5)/.8),leftGrip:relaxed,
  head:[-.012+nod,.035,0],torso:[-.012,.008,0],expression:'positive',propBeat:1,
 });
}

/** Pure small-scale QA intentions, never changing root/feet/prop ownership. */
export function sample({time=0,variant=0,stage='use',action='idle'}={}){
 const elapsed=Number.isFinite(time)?Math.max(0,time):0;
 if(action==='success'||['complete','completion','success'].includes(stage)){
  const nod=elapsed<1.6?.060*Math.sin(Math.PI*clamp((elapsed%.8)/.8)):0;
  return pose('complete','확인을 마치고 두 번 작게 끄덕이기','check',{
   pen:pen(.014,.073,.031),left:vector(REFERENCE,REST,elapsed/.8),leftGrip:relaxed,
   head:[-.012+nod,.035,0],torso:[-.012,.008,0],expression:'positive',propBeat:1,
  });
 }
 if(stage==='idle'){
  const t=elapsed%9.6;
  const look=ease((t-1.4)/.8)*(1-ease((t-5.1)/.8));
  return pose('idle-reference','검지를 편 채 기준 카드와 화면을 번갈아 확인','pause',{
   pen:pen(.003,.027,.025),left:REFERENCE,leftGrip:point,
   head:vector([.055,-.13,-.01],screen,look),torso:[.004,-.015,0],expression:'thinking',propBeat:.06,
  });
 }
 if(stage!=='use')return pose('settle','체크리스트 앞에서 차분하게 준비','observe',{
  pen:pen(.002,.003,.018),left:REST,leftGrip:relaxed,expression:'relaxed',
 });
 const v=Number.isFinite(variant)?((Math.trunc(variant)%3)+3)%3:0;
 return [compare,discrepancy,confirm][v](elapsed%profile.workDuration);
}
