import {AmbientScheduler} from '../sample/ambient-motion.mjs';
import {cyclePose,ease} from '../sample/motion.mjs';
import {Route} from './routes.mjs';
import {Reservations} from './reservations.mjs';
const mix=(a,b,u)=>a+(b-a)*u;
const lerp=(a,b,u)=>a.map((v,i)=>mix(v,b[i],u));

export const STAGE_NAMES={queued:'좌석·통로 확인',stand:'의자에서 일어서기',out:'소파로 이동',settle:'안전하게 디디기',align:'소파 앞 정렬',back:'뒤로 디디기',sit:'소파에 앉기',rest:'소파에서 휴식',rise:'소파에서 일어서기',forward:'통로로 나오기',home:'자리로 복귀',deskTurn:'책상 바라보기',deskSit:'업무 자리에 앉기',idle:'책상 대기'};
export class SofaScheduler {
 constructor(ids, anchors,options={}){this.options=options;this.actorId=options.actorId??'nara';this.owner=options.owner??this.actorId+'-sofa';this.base=new AmbientScheduler(ids);this.base.nextRest=Infinity;this.anchors=anchors;this.book=options.book??new Reservations();this.vm={actors:[]};this.stage='idle';this.elapsed=0;this.time=0;this.completed=0;this.interruptions=0;this.reason='';this.returning=false;this.route=null;this.disposed=false;}
 get paused(){return !!this.vm.motionPaused;}
 setViewModel(vm){this.vm=vm;const desired=vm.actors?.find(a=>a.agentId===this.actorId)?.pose??'idle';if(desired!=='idle'&&this.stage!=='idle'){this.returning=true;this.reason='업무 도착';if(this.stage==='queued')this.finish(false);}}
 refreshBase(){this.base.setViewModel({...this.vm,actors:this.base.ids.map(id=>{const item=this.vm.actors?.find(a=>a.agentId===id)??{agentId:id,pose:'idle'};return id===this.actorId&&(this.stage!=='idle'||item.pose==='idle')?{agentId:id,pose:'waiting'}:item;})});}
 startDemo(){return this.startSofa();}
 startSofa(){if(this.disposed||this.stage!=='idle'||this.vm.actors?.some(a=>a.agentId===this.actorId&&a.pose!=='idle'))return false;this.stage='queued';this.elapsed=0;this.returning=false;this.reason='';return true;}
 enter(stage){this.stage=stage;this.elapsed=0;if(stage==='rest'&&this.options.sharedTransit){this.book.releaseKeys(this.owner,['walkway']);this.base.owner=null;}}
 requestReturn(reason='회의 종료'){this.returning=true;this.reason=reason;}
 finish(success){this.book.release(this.owner);if(this.base.owner===this.owner)this.base.owner=null;this.base.nextRest=Infinity;this.route=null;this.stage='idle';this.elapsed=0;if(success){if(this.returning)this.interruptions++;else this.completed++;}this.returning=false;}
 beginHome(points,yaw){this.route=new Route(points,yaw,this.options.routeMotion);this.enter('home');}
 tick(raw){if(this.disposed||this.paused)return;const dt=Math.max(0,Math.min(.06,raw));this.time+=dt;this.refreshBase();this.base.nextRest=Infinity;this.base.tick(dt);this.elapsed+=dt;const a=this.anchors;
  if(this.stage==='idle')return;
  if(this.stage==='queued'){if(!this.base.owner&&(this.options.sharedTransit?this.book.request(this.owner,['walkway',a.seat]):this.book.acquire(this.owner,['walkway',a.seat]))){this.base.owner=this.owner;this.enter('stand');}else if(this.elapsed>=(this.options.waitLimit??6)){this.reason='좌석·통로 이용 불가 · 책상에서 대기';this.finish(false);}return;}
  if(this.stage==='stand'&&this.elapsed>=2){if(this.returning)this.beginHome([a.route[0]],0);else{this.route=new Route(a.route,0,this.options.routeMotion);this.enter('out');}return;}
  if(this.stage==='out'||this.stage==='home'){
   this.route.tick(dt);
   if(this.stage==='out'&&this.returning){this.settleStart=this.route.state();this.homePoints=this.route.reversePoints();this.enter('settle');return;}
   if(this.route.done){if(this.stage==='out'){this.turnFrom=this.route.endYaw;this.enter('align');}else{this.turnFrom=this.route.endYaw;this.enter('deskTurn');}}return;
  }
  if(this.stage==='settle'&&this.elapsed>=.35){this.beginHome(this.homePoints,this.settleStart.yaw);}
  else if(this.stage==='align'&&this.elapsed>=.7){if(this.returning)this.beginHome(a.route.toReversed(),0);else this.enter('back');}
  else if(this.stage==='back'&&this.elapsed>=.8){this.enter(this.returning?'forward':'sit');}
  else if(this.stage==='sit'&&this.elapsed>=2.6)this.enter(this.returning?'rise':'rest');
  else if(this.stage==='rest'&&(this.returning||this.elapsed>=(this.options.restDuration??10))&&(!this.options.canDepart||this.options.canDepart())&&(!this.options.sharedTransit||this.book.request(this.owner,['walkway'],0)))this.enter('rise');
  else if(this.stage==='rise'&&this.elapsed>=2.6)this.enter('forward');
  else if(this.stage==='forward'&&this.elapsed>=.8)this.beginHome(a.route.toReversed(),0);
  else if(this.stage==='deskTurn'&&this.elapsed>=.7)this.enter('deskSit');
  else if(this.stage==='deskSit'&&this.elapsed>=2)this.finish(true);
 }
 rawPose(){const a=this.anchors,t=this.elapsed,standing=(point,yaw=0)=>({x:point[0],z:point[2],yaw,hip:.84,stand:1,arms:0,chair:1,action:'standing',time:t});
  if(this.stage==='stand')return cyclePose(1+Math.min(2,t));
  if(this.stage==='out'||this.stage==='home')return this.route.state();
  if(this.stage==='settle'){const start=this.settleStart,u=ease(t/.35),p={...standing([start.x,0,start.z],start.yaw),hip:mix(start.hip,.84,u)};p.feet=start.feet.map((f,i)=>{const side=i===0?-.1:.1,target=[start.x+Math.cos(start.yaw)*side,.085,start.z-Math.sin(start.yaw)*side];return {position:lerp(f.position,target,u),planted:false};});return p;}
  if(this.stage==='align'||this.stage==='deskTurn'){const p=standing(this.stage==='align'?a.route.at(-1):a.route[0],this.turnFrom*(1-ease(t/.7)));const u=Math.min(1,t/.7);p.feet=[0,1].map(i=>{const phase=i===0?Math.min(1,u*2):Math.max(0,u*2-1),yaw=this.turnFrom*(1-ease(phase)),side=i===0?-.1:.1;return{position:[p.x+Math.cos(yaw)*side,.085+.025*Math.sin(Math.PI*phase),p.z-Math.sin(yaw)*side],planted:phase===0||phase===1};});return p;}
  if(this.stage==='back'||this.stage==='forward'){const back=this.stage==='back',u=ease(t/.8),point=lerp(back?a.route.at(-1):a.stand,back?a.stand:a.route.at(-1),u),p=standing(point);p.action='walk';p.gaitTime=t;p.gaitFade=.2;p.feet=[0,1].map(i=>{const phase=i===0?Math.min(1,t/.4):Math.max(0,(t-.4)/.4),from=back?a.route.at(-1):a.stand,to=back?a.stand:a.route.at(-1),foot=lerp(from,to,ease(phase));return{position:[foot[0]+(i===0?-.1:.1),.085+.025*Math.sin(Math.PI*phase),foot[2]],planted:phase===0||phase===1};});return p;}
  if(['sit','rest','rise'].includes(this.stage)){const u=this.stage==='rest'?1:this.stage==='rise'?1-ease(t/2.6):ease(t/2.6),point=lerp(a.stand,a.seated,u);return {...standing(point),action:this.stage==='sit'?'sofa_sit':this.stage==='rise'?'sofa_rise':'sofa_rest',hip:mix(.84,a.hip,u),stand:1-u,seatBlend:u,feet:[-.1,.1].map(x=>({position:[a.stand[0]+x,.085,a.stand[2]],planted:true})),contact:[true,true]};}
  if(this.stage==='deskSit')return cyclePose(19+Math.min(2,t));
  return cyclePose(0);
 }
 pose(){const p=this.rawPose(),a=this.anchors,r=a.rug;if(p.feet&&r)p.feet=p.feet.map(f=>{const x=f.position[0]+a.stationOrigin[0],z=f.position[2]+a.stationOrigin[2],height=Math.max(0,...(a.surfaces??[r]).map(surface=>((x-surface.x)/surface.rx)**2+((z-surface.z)/surface.rz)**2<=1?surface.top:0));return {...f,position:[f.position[0],f.position[1]+height,f.position[2]]};});return p;}
 state(id){if(id===this.actorId&&this.stage!=='idle'&&this.stage!=='queued'){const pose=this.pose();return{action:pose.action,time:this.elapsed,pose,returning:this.returning,basePose:this.vm.actors?.find(a=>a.agentId===id)?.pose??'idle'};}if(id===this.actorId&&(this.vm.actors?.find(a=>a.agentId===id)?.pose??'idle')==='idle')return{action:'idle',time:this.time};return this.base.state(id);}
 diagnostics(){const d=this.base.diagnostics();return{...d,time:this.time,reservation:this.base.owner,actors:{...d.actors,[this.actorId]:{...d.actors[this.actorId],...this.state(this.actorId),pose:undefined}},sofa:{stage:this.stage,label:STAGE_NAMES[this.stage],returning:this.returning,reason:this.reason,completed:this.completed,interruptions:this.interruptions,claims:this.book.snapshot(),position:this.stage==='idle'||this.stage==='queued'?null:[this.pose().x,this.pose().z]}};}
 dispose(){this.disposed=true;this.finish(false);if(!this.options.book)this.book.clear();this.base.dispose();}
}
