import {profile} from './profile.mjs';

const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const ease=n=>{const a=clamp(n);return a*a*(3-2*a);};
const mix=(a,b,u)=>a+(b-a)*ease(u);
const vector=(a,b,u)=>a.map((n,i)=>mix(n,b[i],u));
const bezier=(points,t)=>{
 const u=clamp(t),v=1-u;
 return points[0].map((n,i)=>v*v*v*n+3*v*v*u*points[1][i]+3*v*u*u*points[2][i]+u*u*u*points[3][i]);
};
const pen=(x,z,lift=0)=>({x,z,lift});
const penMix=(a,b,u)=>({x:mix(a.x,b.x,u),z:mix(a.z,b.z,u),lift:mix(a.lift,b.lift,u)});
const path=(points,t,lift=0)=>{const [x,z]=bezier(points,t);return pen(x,z,lift);};
const relaxed=[.13,.20,.23,.27,.32];
const support=[.26,.13,.24,.32,.40];
const open=[.14,.06,.09,.14,.20];
const PALETTE=[-.10,.815,.365];
const REST=[-.105,.805,.34];
const EXPLAIN=[-.035,.91,.275];
const initial=pen(.008,-.020,.003);
// The wide contour lives on the near half of the tablet. Pulling the torso
// back while holding its far-right corner used to exceed Sora's real arm.
const sketchEnd=pen(.045,.039,.002);
const viewPoint=pen(.045,.039,.048);

function pose(cue,label,phase,extras={}){
 return{cue:`sora-${cue}`,label,phase,reading:phase!=='act',pen:initial,left:REST,
  leftGrip:support,head:[.026,.035,-.015],torso:[.015,0,0],expression:'focus',propBeat:0,...extras};
}

// Broad curves follow a drawn contour, not the old common repeating writing wave.
function composition(t){
 if(t<2.9){
  const p=path([[.008,-.020],[.078,-.040],[-.018,.063],[.045,.039]],ease(t/2.9),.002);
  return pose('composition-sweep','장면을 가르는 큰 S 곡선 스케치','act',{
   pen:p,head:[.045,.065,-.024],torso:[.030,.025,-.016],left:PALETTE,propBeat:.10,
  });
 }
 if(t<5.2)return pose('composition-distance','펜을 띄우고 전체 구도 확인','observe',{
  pen:penMix(sketchEnd,viewPoint,(t-2.9)/.55),head:[-.055,.11,-.065],
  torso:[0,.012,-.008],left:REST,leftGrip:relaxed,expression:'thinking',propBeat:.10,
 });
 if(t<6.0)return pose('composition-reposition','시선을 따라 강조할 선으로 이동','pause',{
  pen:penMix(viewPoint,pen(.008,.036,.003),(t-5.2)/.8),head:[.025,-.015,-.025],torso:[.012,.02,0],
 });
 if(t<7.65)return pose('composition-accent','구도를 받치는 아래쪽 곡선 정리','act',{
  pen:path([[.008,.036],[.026,.066],[.052,.018],[.055,.035]],ease((t-6)/1.65),.002),
  head:[.044,.055,-.025],torso:[.025,.033,-.016],left:PALETTE,
 });
 return pose('composition-check','고개를 기울여 여백과 비율 확인','check',{
  pen:penMix(pen(.055,.035,.002),pen(.050,.035,.045),(t-7.65)/.6),
  head:[-.04,.10,.06],torso:[0,.015,.005],left:REST,leftGrip:relaxed,expression:'thinking',
 });
}

function colour(t){
 if(t<2.25)return pose('colour-reference','왼쪽 견본의 배색을 비교','observe',{
  pen:pen(.015,.010,.045),left:vector(REST,PALETTE,t/.6),leftGrip:[.22,.08,.24,.32,.40],
  head:[.065,-.19,-.035],torso:[.015,-.065,-.02],expression:'thinking',propBeat:.36,
 });
 if(t<3.2)return pose('colour-return','견본에서 태블릿의 수정 위치로 시선 이동','pause',{
  pen:penMix(pen(.015,.010,.045),pen(.039,.025,.002),(t-2.25)/.95),
  left:PALETTE,head:vector([.065,-.19,-.035],[.042,.07,-.012],(t-2.25)/.95),
  torso:[.026,.02,0],propBeat:.36,
 });
 if(t<5.55)return pose('colour-correction','색면 경계에 짧은 곡선 수정','act',{
  pen:path([[.039,.025],[.062,.001],[.078,.039],[.061,.052]],ease((t-3.2)/2.35),.002),
  head:[.055,.075,-.025],torso:[.030,.040,-.010],left:PALETTE,propBeat:.36,
 });
 if(t<8.7)return pose('colour-compare','태블릿과 두 번째 견본을 천천히 대조','observe',{
  pen:penMix(pen(.061,.052,.002),pen(.061,.052,.045),(t-5.55)/.6),
  left:vector(PALETTE,[-.065,.825,.365],(t-5.55)/.7),
  head:vector([.03,.07,-.018],[.055,-.17,.025],(t-6.2)/.8),torso:[.006,-.045,.015],
  expression:'thinking',propBeat:.68,
 });
 if(t<9.35)return pose('colour-commit','선택한 배색의 마무리 위치로 이동','pause',{
  pen:penMix(pen(.061,.052,.045),pen(.061,.052,.002),(t-8.7)/.65),
  head:[.036,.065,-.02],left:REST,torso:[.025,.02,0],propBeat:.68,
 });
 return pose('colour-final','선택한 배색으로 마지막 작은 강조선','act',{
  pen:path([[.061,.052],[.048,.057],[.046,.066],[.037,.070]],ease((t-9.35)/1.45),.002),
  head:[.048,.055,-.023],left:REST,torso:[.026,.035,-.005],propBeat:.68,
 });
}

function explain(t){
 if(t<1.75)return pose('explain-find','설명할 핵심 실루엣을 눈으로 확인','observe',{
  pen:pen(.030,.005,.035),head:[.052,.08,-.025],torso:[.015,.035,-.005],
 });
 if(t<3.15)return pose('explain-trace','펜 끝으로 핵심 곡선을 천천히 짚기','act',{
  pen:path([[.030,.005],[.062,-.025],[.075,.025],[.048,.053]],ease((t-1.75)/1.4),.006),
  head:[.045,.09,-.015],torso:[.026,.045,-.012],
 });
 if(t<6.05)return pose('explain-peer','동료를 바라보며 열린 손으로 의도 설명','pause',{
  pen:penMix(pen(.048,.053,.006),pen(.052,.049,.055),(t-3.15)/.65),
  left:vector(REST,EXPLAIN,(t-3.15)/.85),leftGrip:open,
  head:vector([.035,.08,-.015],[-.014,-.215,.015],(t-3.15)/.75),
  torso:[-.006,-.085,-.018],expression:'positive',propBeat:.91,
 });
 if(t<7.5)return pose('explain-point','다시 태블릿의 핵심 위치를 펜으로 가리키기','act',{
  pen:penMix(pen(.052,.049,.055),pen(.072,.045,.012),(t-6.05)/.75),
  left:vector(EXPLAIN,[-.070,.84,.33],(t-6.05)/.8),leftGrip:relaxed,
  head:vector([-.014,-.215,.015],[.045,.075,-.02],(t-6.05)/.65),
  torso:[.02,.02,0],expression:'positive',propBeat:.91,
 });
 return pose('explain-listen','펜을 멈추고 동료의 반응을 듣기','check',{
  pen:pen(.072,.045,.035),left:vector([-.070,.84,.33],REST,(t-7.5)/.7),leftGrip:relaxed,
  head:[-.025,-.18,.032],torso:[-.018,-.06,0],expression:'relaxed',propBeat:.91,
 });
}

/** Pure intentions; the shared solver remains authoritative for contact/reach. */
export function sample({time=0,variant=0,stage='use',action='idle'}={}){
 const elapsed=Number.isFinite(time)?Math.max(0,time):0;
 if(action==='success'||stage==='success'||stage==='complete'||stage==='completion'){
  const u=ease(elapsed/1.25),nod=Math.sin(Math.PI*clamp(elapsed/1.5));
  return pose('complete','마지막 강조선을 확인하고 작게 미소','check',{
   pen:pen(.072,.045,.05),left:vector(REST,[-.065,.855,.30],u),leftGrip:relaxed,
   head:[-.015+.065*nod,-.10,.025],torso:[-.025,-.045,-.01],expression:'positive',propBeat:1,
  });
 }
 if(stage==='idle'){
  const p=(elapsed%8.4)/8.4;
  const look=ease(p/.28)*(1-ease((p-.65)/.25));
  return pose('idle-composition','펜을 띄우고 고개를 기울여 구도 다시 보기','pause',{
   pen:pen(.045,.035,.04),left:REST,leftGrip:relaxed,
   head:[mix(.015,-.045,look),mix(.025,.11,look),mix(-.012,-.07,look)],
   torso:[-.012,.025,-.012],expression:'thinking',
  });
 }
 if(stage!=='use')return pose('settle','태블릿을 향해 조용히 준비','observe',{
  pen:pen(.008,-.020,.025),left:REST,leftGrip:relaxed,expression:'relaxed',
 });
 const t=elapsed%profile.workDuration;
 const v=Number.isFinite(variant)?((Math.trunc(variant)%3)+3)%3:0;
 return [composition,colour,explain][v](t);
}
