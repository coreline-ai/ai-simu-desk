import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from '../activities/interactions.mjs';
import {ease} from '../sample/motion.mjs';

const V=(...a)=>new T.Vector3(...a),STAGES={prepare:.24,approach:.9,adjust:.65,depart:.45,recover:.85};
// One existing rim and one index pad. No new scene nodes, props or ownership events.
export class GlassesAdjustment {
 constructor(s){
  this.s=s;this.actor=s.desks.jun?.actor;this.head=this.actor&&part(this.actor,'NaraHead');this.rim=this.actor&&part(this.actor,'RectGlasses1');
  this.stage='idle';this.time=0;this.done=0;this.interruptions=0;this.next=45;this.reason=null;this.available=false;
  if(!this.rim?.isMesh)return;
  this.actor.updateWorldMatrix(true,true);
  // Resolve the real exported rim surface, rather than reporting an authored point in empty space.
  const ray=new T.Raycaster();
  for(const x of [.096,.094,.092,.09]){
   const origin=this.head.localToWorld(V(x,.022,.6)),direction=this.head.getWorldQuaternion(new T.Quaternion());
   ray.set(origin,V(0,0,-1).applyQuaternion(direction));const hit=ray.intersectObject(this.rim,false)[0];
   if(hit){this.surface=this.head.worldToLocal(hit.point.clone());this.available=true;break;}
  }
 }
 get active(){return this.stage!=='idle';}
 eligible(state=this.s.state('jun')){
  return this.available&&this.s.personalMotion?.has('jun')&&!this.s.disposed&&!this.s.remote&&this.s.idle('jun')&&this.s.rawIncoming('jun').pose==='idle'&&state.action==='idle'&&!state.greeting&&!state.note&&!state.lookAt;
 }
 start(){if(this.active||!this.eligible())return false;this.enter('prepare');this.reason=null;this.from=this.handPose();const idle=this.s.base.actors.jun;idle.nextMicro=Math.max(idle.nextMicro,this.s.base.time+Object.values(STAGES).reduce((a,b)=>a+b,0)+.5);return true;}
 handPose(){const hand=part(this.actor,'NaraHandR');return{p:hand.getWorldPosition(V()),q:hand.getWorldQuaternion(new T.Quaternion())};}
 enter(stage){this.stage=stage;this.time=0;}
 finish(reason){if(!this.active)return;this.reason=reason;if(reason==='complete')this.done++;else this.interruptions++;this.stage='idle';this.time=0;this.next=this.s.time+105;this.sample=null;}
 cancel(){if(!this.active)return false;if(this.stage==='prepare'){this.finish('cancel');return true;}if(['depart','recover'].includes(this.stage))return true;const direct=this.stage==='approach'&&this.time<STAGES.approach*.5;this.from=this.last??this.handPose();this.enter(direct?'recover':'depart');this.reason='cancel';return true;}
 tick(state,dt){
  if(this.s.paused||dt<=0)return;
  if(this.active&&!this.eligible(state)){this.finish('higher-priority activity');return;}
  if(!this.active){if(this.s.auto&&this.s.time>=this.next)this.start();return;}
  this.time+=dt;
  if(this.time+1e-9<STAGES[this.stage])return;
  if(this.stage==='recover'){this.finish(this.reason==='cancel'?'cancel':'complete');return;}
  const next={prepare:'approach',approach:'adjust',adjust:'depart',depart:'recover'}[this.stage];
  this.from=this.last??this.handPose();this.enter(next);
 }
 apply(){
  this.sample=null;if(!this.active)return;
  const a=this.actor,head=this.head,hand=part(a,'NaraHandR'),base=this.handPose(),u=T.MathUtils.clamp(this.time/STAGES[this.stage],0,1);
  a.updateWorldMatrix(true,true);
  const surface=this.surface.clone();if(this.stage==='adjust')surface.y+=.0025*Math.sin(Math.PI*u)**2;
  const hq=head.getWorldQuaternion(new T.Quaternion()),normal=V(0,0,1).applyQuaternion(hq),contact=head.localToWorld(surface.clone()),pad=contact.clone().addScaledVector(normal,.008),q=hq.clone().multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),2.85));
  const finger=V(-.027,-.077,.011),target=pad.clone().sub(finger.clone().applyQuaternion(q));
  // A waypoint in front/outside the cheek keeps the palm away from the face on approach and departure.
  const outside=head.localToWorld(V(.20,-.14,.28));let wrist,rotation,blend=0;
  if(this.stage==='prepare'){wrist=this.from.p.clone();rotation=this.from.q.clone();}
  else if(this.stage==='approach'){
   const v=ease(u);wrist=this.from.p.clone().lerp(target,v);wrist.addScaledVector(normal,Math.sin(Math.PI*v)*.065);rotation=this.from.q.clone().slerp(q,v);blend=ease((u-.55)/.45);
  }else if(this.stage==='adjust'){wrist=target;rotation=q;blend=1;}
  else if(this.stage==='depart'){wrist=this.from.p.clone().lerp(outside,ease(u));rotation=this.from.q.clone();blend=1-ease(u);}
  else{wrist=this.from.p.clone().lerp(base.p,ease(u));rotation=this.from.q.clone().slerp(base.q,ease(u));}
  const error=solveArm(a,wrist,rotation,'R',V(1,.25,.45).applyQuaternion(a.getWorldQuaternion(new T.Quaternion())));
  // Only the index has a surface target; all other fingers remain relaxed.
  this.override={R:{blend,prop:this.rim,kind:'glasses',points:[null,pad.toArray(),null,null,null]}};
  this.sample={stage:this.stage,u,handError:error,contact:contact.toArray(),pad:pad.toArray(),surface:surface.toArray(),wrist:wrist.toArray(),indexBlend:blend};
 }
 measure(){if(!this.sample)return;const hand=part(this.actor,'NaraHandR'),pad=hand.getObjectByName('GripPad1');this.sample.padError=pad?.getWorldPosition(V()).distanceTo(V(...this.sample.pad))??null;this.sample.actualWrist=hand.getWorldPosition(V()).toArray();this.last=this.handPose();}
 handOverrides(){return this.active?this.override:null;}
 controls(id,side){return id==='jun'&&side==='R'&&this.active;}
 diagnostics(){return{available:this.available,stage:this.stage,time:this.time,done:this.done,interruptions:this.interruptions,reason:this.reason,next:this.next,contactScope:'existing-right-rim-surface-and-index-pad; no glasses ownership change',...this.sample};}
 dispose(){this.finish('dispose');this.actor=null;this.head=null;this.rim=null;this.override=null;}
}
