import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';

// Authored animation profiles, not clinical gait norms. Feet/routes remain authoritative.
export const HUMAN_PROFILES=Object.freeze({
 nara:{label:'차분한 보행 · 짧은 손짓',speed:.56,period:.92,swing:.27,elbow:.24,splay:.085,twist:.035,phase:.2,breath:1.15,curl:.38,gesture:.52,habit:'small-nod'},
 sora:{label:'경쾌한 보행 · 열린 손짓',speed:.60,period:.84,swing:.35,elbow:.28,splay:.12,twist:.050,phase:1.7,breath:1.30,curl:.24,gesture:.78,habit:'open-palms'},
 jun:{label:'느긋한 보행 · 절제된 반응',speed:.53,period:1.00,swing:.21,elbow:.22,splay:.070,twist:.025,phase:3.1,breath:.95,curl:.45,gesture:.38,habit:'brief-glance'},
 min:{label:'곧은 보행 · 확인하는 끄덕임',speed:.57,period:.88,swing:.25,elbow:.26,splay:.095,twist:.030,phase:4.6,breath:1.05,curl:.32,gesture:.46,habit:'double-nod'},
 leo:{label:'여유로운 보행 · 넓은 설명',speed:.54,period:.98,swing:.32,elbow:.25,splay:.110,twist:.045,phase:6.2,breath:.88,curl:.29,gesture:.68,habit:'gentle-tilt'}
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
