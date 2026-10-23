import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';

// Authored animation profiles, not clinical gait norms. Feet/routes remain authoritative.
export const HUMAN_PROFILES=Object.freeze({
 nara:{task:{boardX:.085,boardY:1.16,boardSpan:.016,boardBeat:1.5,read:.35,reaction:.34},dialogue:{prepare:.24,release:.35,power:1.25,glance:.035,greeting:.55},cup:{reach:1.55,lift:1.05,sip:3.6,place:1.3,release:.42,up:.27,down:.77},work:{period:2.8,observe:.52,act:1.18,pause:.42},label:'차분한 보행 · 짧은 손짓',speed:.56,period:.92,swing:.27,elbow:.24,splay:.085,twist:.035,phase:.2,breath:1.15,curl:.38,gesture:.52,habit:'small-nod',posture:{rise:.24,sit:.13,weight:.009,settle:.024,listen:.035,nod:.060,nods:1,delay:.35,tilt:.012,lift:.075,power:1.2}},
 sora:{task:{boardX:.115,boardY:1.18,boardSpan:.038,boardBeat:1.1,read:.48,reaction:.48},dialogue:{prepare:.16,release:.30,power:.9,glance:-.07,greeting:.90},cup:{reach:1.3,lift:.95,sip:3.9,place:1.2,release:.38,up:.20,down:.82},work:{period:2.4,observe:.30,act:1.20,pause:.28},label:'경쾌한 보행 · 열린 손짓',speed:.60,period:.84,swing:.35,elbow:.28,splay:.12,twist:.050,phase:1.7,breath:1.30,curl:.24,gesture:.78,habit:'open-palms',posture:{rise:.19,sit:.10,weight:.012,settle:.035,listen:.020,nod:.045,nods:1,delay:.20,tilt:-.045,lift:.105,power:.85}},
 jun:{task:{boardX:.09,boardY:1.145,boardSpan:.012,boardBeat:1.9,read:.60,reaction:.22},dialogue:{prepare:.40,release:.40,power:1.6,glance:.02,greeting:.34},cup:{reach:1.45,lift:.85,sip:2.7,place:1.15,release:.35,up:.24,down:.65},work:{period:3.1,observe:.62,act:1.32,pause:.38},label:'느긋한 보행 · 절제된 반응',speed:.53,period:1.00,swing:.21,elbow:.22,splay:.070,twist:.025,phase:3.1,breath:.95,curl:.45,gesture:.38,habit:'brief-glance',posture:{rise:.16,sit:.08,weight:.008,settle:-.012,listen:-.018,nod:.025,nods:1,delay:.65,tilt:.010,lift:.045,power:1.7}},
 min:{task:{boardX:.105,boardY:1.165,boardSpan:.023,boardBeat:1.25,read:.30,reaction:.29},dialogue:{prepare:.28,release:.32,power:1.35,glance:-.025,greeting:.50},cup:{reach:1.5,lift:1,sip:3.3,place:1.5,release:.45,up:.25,down:.72},work:{period:2.7,observe:.48,act:.90,pause:.56},label:'곧은 보행 · 확인하는 끄덕임',speed:.57,period:.88,swing:.25,elbow:.26,splay:.095,twist:.030,phase:4.6,breath:1.05,curl:.32,gesture:.46,habit:'double-nod',posture:{rise:.22,sit:.12,weight:.007,settle:.018,listen:.045,nod:.045,nods:2,delay:.40,tilt:.006,lift:.060,power:1.4}},
 leo:{task:{boardX:.10,boardY:1.155,boardSpan:.027,boardBeat:1.65,read:.70,reaction:.40},dialogue:{prepare:.33,release:.45,power:1,glance:.06,greeting:.72},cup:{reach:1.6,lift:1.15,sip:4.1,place:1.45,release:.65,up:.28,down:.78},work:{period:3.4,observe:.64,act:1.30,pause:.62},label:'여유로운 보행 · 넓은 설명',speed:.54,period:.98,swing:.32,elbow:.25,splay:.110,twist:.045,phase:6.2,breath:.88,curl:.29,gesture:.68,habit:'gentle-tilt',posture:{rise:.18,sit:.09,weight:.010,settle:-.020,listen:.008,nod:.035,nods:1,delay:.50,tilt:.035,lift:.090,power:1.0}}
});
export const HUMAN_RESTS=Object.freeze({nara:['one_arm','back_open','wrist_release'],sora:['side_stretch','back_open','shoulder_release'],jun:['shoulder_release','wrist_release','one_arm'],min:['wrist_release','side_stretch','shoulder_release'],leo:['back_open','shoulder_drop','side_stretch']});
const SIDES=['L','R'];
export class HumanMotion{
 constructor(s,enabled=true){this.s=s;this.enabled=enabled;this.previous=new Map();this.active=new Set();this.rows=new Map();}
 free(id,side){const s=this.s;
  return !s.handControl?.(id,side)&&!(side==='R'&&s.desks[id]?.busy)&&!(side==='L'&&!['idle','tableRest'].includes(s.cups[id]?.state))&&s.transfer?.controls(id)?.side!==side&&!s.sofaSupport?.rows.get(id)?.diagnostic[side]&&!s.meetingSupport?.rows.get(id)?.hands[side];
 }
 setEnabled(value){this.enabled=!!value;this.previous.clear();this.active.clear();for(const id of this.s.ids)this.s.handGrips?.setRelaxation(id,null);return this.enabled;}
 ownsFreeArm(id,side){return this.enabled&&this.active.has(id)&&this.free(id,side);}
 pose(id,actor,state,dt){
  const p=HUMAN_PROFILES[id],s=this.s,standing=(state.pose?.stand??0)>.96&&state.pose?.seatBlend===undefined;
  const locomotion=standing&&['walk','turn','standing','window_rest','coffee_wait','waiting','idle'].includes(state.action);
  this.active.delete(id);s.handGrips?.setRelaxation(id,null);
  if(!this.enabled||!p||dt<=0)return;
  const torso=part(actor,'NaraTorso'),head=part(actor,'NaraHead'),t=s.time+p.phase;
  // Sparse, independent attention beats rather than five continuous metronomes.
  const period=8.5+p.phase*.38,phase=t%period,attention=phase<2?Math.sin(Math.PI*phase/2)**2:0;
  const constrained=SIDES.some(side=>!this.free(id,side));
  if(!constrained&&!state.lookAt&&!state.note&&!state.returning){
   head.rotation.z+=attention*(id==='leo'?.045:id==='sora'?-.035:.018);
   head.rotation.x+=attention*(id==='min'?Math.sin(phase*7)*.035:id==='nara'?Math.sin(phase*3)*.025:0);
   if(['idle','window_rest','coffee_wait'].includes(state.action))head.rotation.y+=attention*(id==='jun'?-.14:id==='sora'?.13:.065);
  }
  if(!constrained&&!state.note&&['idle','window_rest','coffee_wait','sofa_rest','meeting_listen'].includes(state.action))torso.rotation.x+=Math.sin(t*p.breath)*.006;
  if(!locomotion){this.previous.delete(id);this.rows.set(id,{style:p.label,mode:'contact/activity',free:Object.fromEntries(SIDES.map(side=>[side,this.free(id,side)]))});return;}
  this.active.add(id);
  let stride=0;const gait=state.pose?.gaitFade??0;
  if(state.action==='walk'&&state.pose?.feet?.length===2){
   const pose=state.pose,forward=foot=>Math.sin(pose.yaw)*(foot.position[0]-pose.x)+Math.cos(pose.yaw)*(foot.position[2]-pose.z);
   // An arm travels opposite its actual leg, including curved paths and arrival retiming.
   stride=T.MathUtils.clamp((forward(pose.feet[0])-forward(pose.feet[1]))/(p.speed*p.period*.60),-1,1)*gait;
  }
  if(!constrained){torso.rotation.y+=stride*p.twist;torso.rotation.z+=Math.sin(t*p.breath)*.004*(1-gait);}
  actor.updateMatrixWorld(true);
  const previous=this.previous.get(id)??new Map(),alpha=1-Math.exp(-dt*13),free={};
  for(const[ i,side]of SIDES.entries()){
   free[side]=this.free(id,side);if(!free[side]){for(const prefix of['NaraShoulder','NaraElbow','NaraHand'])previous.delete(prefix+side);continue;}
   const sign=i===0?-1:1,shoulder=part(actor,'NaraShoulder'+side),elbow=part(actor,'NaraElbow'+side),hand=part(actor,'NaraHand'+side);
   const from=new Map([shoulder,elbow,hand].map(node=>[node,node.quaternion.clone()]));
   const wave=sign*stride,asymmetry=side==='R'?.96:1;
   shoulder.rotation.set(-wave*p.swing*asymmetry-.012,0,sign*(p.splay+.012*Math.abs(stride)));
   elbow.rotation.set(-(p.elbow+.09*Math.max(0,wave)+.012*Math.sin(t*p.breath)) ,0,0);
   // A small elbow bend leaves pickup IK margin without stretching a limb.
   // Relaxed palms face the thighs; the wrist lags the shoulder without moving a prop.
   hand.rotation.set(.035*Math.sin((state.pose?.gaitTime??0)*Math.PI*2-.45)*gait, -sign*(.94+.06*Math.sin(t*.6)),sign*(.035+.012*attention));
   for(const prefix of['NaraShoulder','NaraElbow','NaraHand']){
    const name=prefix+side,node=part(actor,name),before=previous.get(name)??from.get(node);
    node.quaternion.slerpQuaternions(before,node.quaternion.clone(),alpha);previous.set(name,node.quaternion.clone());
   }
  }
  this.previous.set(id,previous);
  s.handGrips?.setRelaxation(id,{curl:p.curl,free});
  this.rows.set(id,{style:p.label,mode:state.action,stride,free,habit:p.habit});
 }
 gesture(id,actor,state){
  if(!this.enabled||!this.free(id,'R'))return false;
  const p=HUMAN_PROFILES[id],u=ease(state.time/.55)*ease((3.5-state.time)/.65),beat=.78+.22*Math.sin(state.time*(id==='min'?3.1:2.0)+p.phase);
  part(actor,'NaraShoulderR').rotation.x-=p.gesture*u*beat;
  part(actor,'NaraElbowR').rotation.x-=(.35+p.gesture*.42)*u;
  part(actor,'NaraShoulderR').rotation.z-=p.gesture*.18*u;
  part(actor,'NaraHandR').rotation.y+=.38*u;part(actor,'NaraHandR').rotation.z+=Math.sin(state.time*1.5+p.phase)*.09*u;
  if(id==='sora'&&this.free(id,'L')){part(actor,'NaraShoulderL').rotation.x-=.30*u;part(actor,'NaraElbowL').rotation.x-=.35*u;part(actor,'NaraHandL').rotation.y-=.25*u;}
  if(id==='min')part(actor,'NaraHead').rotation.x+=.025*Math.sin(state.time*5)*u;
  return true;
 }
 diagnostics(){return{enabled:this.enabled,profiles:Object.fromEntries(this.s.ids.map(id=>[id,{...HUMAN_PROFILES[id],...this.rows.get(id)}]))};}
 dispose(){this.previous.clear();this.active.clear();this.rows.clear();}
}
