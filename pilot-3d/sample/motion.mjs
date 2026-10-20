// One monotonic simulation clock. ActorRoot owns world translation; RigRoot owns pose.
export const DURATION=22;
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export const LABELS={typing:'앉아서 기획',stand_up:'의자 빼고 일어서기',turn:'이동 방향 바라보기',walk:'발을 딛고 걷기',stretch:'양팔 기지개',rest:'잠깐 숨 고르기',sit_down:'자리로 돌아와 앉기',standing:'서서 대기'};
export const COLLIDERS=[{id:'desk',min:[-.7,-.25],max:[.7,.45]},{id:'chair-parked',min:[-.28,-1.67],max:[.28,-1.03]}];
export const BODY_RADIUS=.22;
export function cyclePose(time,mode='tour'){
 const t=mode==='typing'?0:mode==='stretch'?9+Math.min(time,2):mode==='standing'?3:Math.min(Math.max(time,0),DURATION);
 let p={time:t,action:'typing',x:0,z:-.60,yaw:0,hip:.53,stand:0,arms:0,chair:0,feet:null,contact:[true,true]};
 if(t<1)return p;
 if(t<3){const u=ease((t-1.5)/1.5),tuck=ease((t-1)/.7);const feet=[-.10,.10].map(x=>({position:[x,.085+Math.sin(Math.PI*tuck)*.035,mix(-.20,-.48,tuck)],planted:tuck>=1}));return {...p,action:'stand_up',stand:u,hip:mix(.53,.84,u),z:mix(-.6,-.48,u),chair:ease((t-1.5)/1.3),feet,contact:feet.map(f=>f.planted)};}
 p={...p,hip:.84,stand:1,z:-.48,chair:1};
 if(t<4)return {...p,action:'turn',yaw:-Math.PI/2*ease(t-3)};
 if(t<7)return walkPose(p,t-4,3,-1,0,-.48,-Math.PI/2);
 p={...p,x:-1.35};
 if(t<8)return {...p,action:'turn',yaw:-Math.PI/2*(1-ease(t-7))};
 if(t<12)return {...p,action:'stretch',arms:Math.sin(Math.PI*ease((t-8)/4))};
 if(t<14)return {...p,action:'rest'};
 if(t<15)return {...p,action:'turn',yaw:Math.PI/2*ease(t-14)};
 if(t<18)return walkPose(p,t-15,3,1,-1.35,-.48,Math.PI/2);
 p={...p,x:0};
 if(t<19)return {...p,action:'turn',yaw:Math.PI/2*(1-ease(t-18))};
 if(t<21)return {...cyclePose(3-(t-19)),time:t,action:'sit_down'};
 return {...p,action:'typing',hip:.53,stand:0,z:-.6,chair:0};
}
function walkPose(p,t,duration,direction,startX,z,yaw){
 const speed=.45,period=1,stance=.60; // stride length .45m; stance feet remain world-fixed.
 const x=startX+direction*speed*t;
 const feet=[0,1].map(i=>{
  const offset=i*.5,phase=((t+offset)%period)/period;
  const strike=t-(phase*period),side=i===0?-.10:.10;
  const at=s=>[startX+direction*speed*Math.max(0,Math.min(duration,s)),.085,z-side*direction];
  const a=at(strike),b=at(strike+period);
  if(phase<stance)return {position:a,planted:true};
  const u=(phase-stance)/(1-stance),f=ease(u);
  return {position:[mix(a[0],b[0],f),.085+Math.sin(Math.PI*u)*.075,mix(a[2],b[2],f)],planted:false};
 });
 // Settle the final stride over .25s before the stationary turn, avoiding a snap on landing.
 if(t>duration-.25){const u=ease((t-duration+.25)/.25);feet.forEach((f,i)=>{const end=[startX+direction*speed*duration,.085,z-(i===0?-.10:.10)*direction];f.position=f.position.map((v,j)=>mix(v,end[j],u));f.planted=false;});}
 return {...p,action:'walk',gaitTime:t,gaitFade:ease(t/.3)*(1-ease((t-duration+.3)/.3)),hip:.80+.04*Math.max(1-ease(t/.25),ease((t-duration+.25)/.25)),x,yaw,feet,contact:feet.map(f=>f.planted)};
}
export class MotionClock {
 time=0;mode='typing';paused=false;returnPlan=null;returnElapsed=0;
 play(mode){this.mode=mode;this.time=0;this.returnPlan=null;}
 tick(dt){if(this.paused)return;const step=Math.min(.06,Math.max(0,dt));if(this.returnPlan){this.returnElapsed+=step;if(this.returnElapsed>=this.returnPlan.duration){this.returnPlan=null;this.mode='typing';this.time=0;}}else this.time=Math.min(DURATION,this.time+step);}
 requestWork(){const p=this.pose();if(p.stand===0){this.play('typing');return;}this.returnPlan={start:p,walkDuration:Math.abs(p.x)/.45,duration:3.95+Math.abs(p.x)/.45};this.returnElapsed=0;}
 pose(){
  if(!this.returnPlan)return cyclePose(this.time,this.mode);
  const {start,walkDuration}=this.returnPlan,t=this.returnElapsed;
  if(t<.35){const u=ease(t/.35);return {...start,action:'standing',hip:mix(start.hip,.84,u),stand:mix(start.stand,1,u),z:mix(start.z,-.48,u),arms:start.arms*(1-u),feet:start.feet?.map((f,i)=>{const side=i===0?-.10:.10;const target=[start.x+Math.cos(start.yaw)*side,.085,-.48-Math.sin(start.yaw)*side];return {position:f.position.map((v,j)=>mix(v,target[j],u)),planted:false};})??null};}
  const p={...start,action:'turn',hip:.84,stand:1,z:-.48,feet:null,arms:0,chair:1};
  if(t<1.15)return {...p,yaw:mix(start.yaw,Math.PI/2,ease((t-.35)/.8))};
  if(t<1.15+walkDuration)return walkPose(p,t-1.15,walkDuration,1,start.x,start.z,Math.PI/2);
  if(t<1.95+walkDuration)return {...p,x:0,yaw:Math.PI/2*(1-ease((t-1.15-walkDuration)/.8))};
  return cyclePose(19+Math.min(2,t-1.95-walkDuration));
 }
}
