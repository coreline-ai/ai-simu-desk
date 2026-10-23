import * as T from 'three';
import {readRecipe} from './recipes.mjs';
import {solveArm} from '../activities/interactions.mjs';
import {HUMAN_PROFILES} from '../living-office/human-motion.mjs';
import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';
import {TerrainContact} from './terrain-contact.mjs';
import {soleProfile} from './sole-contact.mjs';
import {PersonalDaily} from './daily.mjs';
import {GlassesAdjustment} from './glasses.mjs';

const TRANSITIONS={stand:2,sit:2.6,rise:2.6,deskSit:2};
const bump=u=>Math.sin(Math.PI*T.MathUtils.clamp(u,0,1))**2;
const transitionPulse=(stage,u)=>['stand','rise'].includes(stage)?ease(u/.24)*(1-ease((u-.3)/.7)):bump(u);
const LISTEN=new Set(['meeting_listen','meeting_wait','sofa_listen','sofa_agree']);
// Optional v12 presentation. Root, feet, seat and held props retain their solvers.
export class PersonalMotion {
 constructor(s,ids=s.ids,model){this.s=s;this.ids=new Set(ids.filter(id=>s.ids.includes(id)));this.rows=new Map();this.previous=new Map();this.soles=new Map([...this.ids].map(id=>[id,soleProfile(s.desks[id].actor)]));this.terrain=new TerrainContact(model,Object.fromEntries([...this.ids].map(id=>[id,s.desks[id].actor])));this.glasses=new GlassesAdjustment(s);this.daily=new PersonalDaily(s);}
 has(id){return this.ids.has(id);}
 groundContact(id,pose){return this.has(id)?this.terrain.correct(id,pose):pose;}
 routeMotion(id,fallback){return this.has(id)?{...fallback,...(this.s.humanMotion?.enabled?{speed:HUMAN_PROFILES[id].speed,period:HUMAN_PROFILES[id].period}:{}),soleProfile:this.soles.get(id)}:fallback;}
 prepare(id,state){
  if(!this.has(id)||!state.pose)return state;
  const trip=this.s.getRecord(id)?.trip,duration=TRANSITIONS[trip?.stage];
  const flatFeet=state.pose.feet?.map(foot=>({...foot,pitch:foot.pitch??0,rotationOrder:'YXZ'}));
  if(!duration)return flatFeet?{...state,pose:{...state.pose,feet:flatFeet}}:state;
  const p=HUMAN_PROFILES[id].posture,u=T.MathUtils.clamp(trip.elapsed/duration,0,1),weight=p.weight*transitionPulse(trip.stage,u),pose={...state.pose,pelvisZ:(state.pose.pelvisZ??0)+weight,feet:flatFeet};
  // Seat transitions lift/tuck flat feet. The generic -0.1 airborne pitch would
  // push the heel through the floor at the first/last frame of this short tuck.
  // Weight transfer lowers the pelvis slightly; endpoints and all foot targets stay fixed.
  pose.hip-=weight*.35;
  for(const [i,foot] of (pose.feet??[]).entries()){
   const dx=foot.position[0]-pose.x,dz=foot.position[2]-pose.z,x=Math.cos(pose.yaw)*dx-Math.sin(pose.yaw)*dz-(i===0?-.1:.1)-(pose.pelvisX??0),z=Math.sin(pose.yaw)*dx+Math.cos(pose.yaw)*dz-pose.pelvisZ;
   pose.hip=Math.min(pose.hip,foot.position[1]+Math.sqrt(Math.max(0,.773**2-x*x-z*z)));
  }
  return{...state,pose};
 }
 pose(id,actor,state,dt){
  if(!this.has(id))return;
  if(id==='jun')this.glasses.tick(state,dt);
  const s=this.s,rec=s.getRecord(id),trip=rec?.trip,p=HUMAN_PROFILES[id].posture,torso=part(actor,'NaraTorso'),head=part(actor,'NaraHead'),stage=trip?.stage,duration=TRANSITIONS[stage];
  const seated=trip?.stage==='rest'&&state.pose?.seatBlend>.999&&['sofa','meeting','group'].includes(rec.kind);
  const blocked=s.desks[id].busy||!!s.transfer?.controls(id)||state.note;
  const active=!blocked&&(!!duration||seated),previous=this.previous.get(id)??{torso:torso.quaternion.clone(),roll:head.rotation.z,release:0};
  const key=[stage,state.action,state.socialPhase??state.pairPhase??state.groupPhase??'',state.groupRound??'',state.coffeePhase??'',state.visitPhase??'',state.lookAt??''].join(':');previous.time=previous.key===key?(previous.time??0)+dt:0;previous.key=key;
  let pitch=0,phase=stage??'work',progress=0;
  if(active){
   const blend=state.pose?.seatBlend,meeting=['meeting','group'].includes(rec.kind),base=blend!==undefined?(meeting?(s.meta.ensembleOffice?.group?.torsoLean??.035):-.07-(state.variant??0)*.02)*blend:.035*(1-(state.pose?.stand??0)),baseZ=blend!==undefined?(meeting?(s.meta.ensembleOffice?.group?.torsoForward??.10):.045)*blend:.10*(1-(state.pose?.stand??0));
   if(duration){
    progress=T.MathUtils.clamp(trip.elapsed/duration,0,1);const rising=['stand','rise'].includes(stage),pulse=transitionPulse(stage,progress);
    torso.rotation.x=base+(rising?p.rise:p.sit)*pulse;torso.position.z=baseZ+p.weight*pulse;
    phase=progress<.25?'prepare':progress>.82?'settle':rising?'weight-rise':'weight-sit';
   }else{
    const settle=ease(trip.elapsed/.35)*(1-ease((trip.elapsed-.8)/.55)),listen=LISTEN.has(state.action)&&!state.returning&&!['lift','sip','lower'].includes(s.cups[id].state);
    const enter=ease(trip.elapsed/.8);torso.rotation.x=base+p.settle*settle+(listen?p.listen*enter:0);torso.position.z=baseZ+(listen?Math.max(0,p.listen)*.18*enter:0);
    if(listen){
     // One small response, or Min's two beats, followed by a still interval.
     const t=previous.time%7.5;
     for(let n=0;state.lookAt&&n<p.nods;n++){const u=(t-p.delay-n*.62)/.60;if(u>0&&u<1)pitch+=p.nod*bump(u);}
     head.rotation.x=0;head.rotation.z=p.tilt*enter;phase='listen';
    }else phase=state.speaking||state.action==='meeting_talk'?'speak':state.note?'note':'seat-settle';
   }
   previous.release=.35;
  }else previous.release=Math.max(0,previous.release-dt);
  if((active||previous.release>0)&&dt>0){const alpha=1-Math.exp(-dt*12);torso.quaternion.slerpQuaternions(previous.torso,torso.quaternion.clone(),alpha);head.rotation.z=previous.roll+(head.rotation.z-previous.roll)*alpha;}
  previous.torso.copy(torso.quaternion);previous.roll=head.rotation.z;this.previous.set(id,previous);
  let attentionPitch=0,attentionYaw=0,reaction=null;
  if(['success','error','sending','receiving','acknowledge'].includes(state.action)&&!rec&&!blocked&&s.cups[id].state==='idle'){
   const task=HUMAN_PROFILES[id].task,u=bump(Math.min(1,state.time/1.5)),strength=task.reaction*u;
   actor.updateWorldMatrix(true,true);
   const palm=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));
   for(const side of ['L','R'])if(s.humanMotion.free(id,side)){
    const lift=state.action==='success'&&side==='R'?strength*.045:0;
    solveArm(actor,actor.localToWorld(new T.Vector3(side==='L'?-.17:.17,.83+lift,.30)),palm,side);
   }
   head.rotation.set(0,0,0);attentionPitch=(state.action==='error'?-.045:p.nod)*u;attentionYaw=state.action==='error'?Math.sin(state.time*3)*strength*.09:0;reaction=state.action;
  }
  if(s.transfer?.active&&s.transfer.stage==='read'&&s.transfer.visitor===id)attentionPitch+=readRecipe(id,s.transfer.time).pitch;
  const style=HUMAN_PROFILES[id].dialogue,t=previous.time;
  if(!blocked&&!state.returning&&s.cups[id].state!=='sip'){
   if(state.activity==='window'){
    const beat=bump((t-1.2)/2.8);attentionYaw=style.glance*beat;attentionPitch=p.tilt*beat;
   }else if(state.activity==='coffee'&&['brew','retrieve'].includes(state.coffeePhase)){
    attentionPitch=p.nod*bump((t-.3)/1.2);attentionYaw=style.glance*bump(t/2);
   }else if(state.activity==='visit'&&!s.transfer?.active&&!state.speaking&&state.lookAt){
    attentionPitch=p.nod*bump((t-style.prepare)/.7);attentionYaw=style.glance*.4*bump(t/1.8);
   }else if(state.greeting){attentionPitch=p.nod*state.greeting;}
  }
  if(!['walk','turn','standing','window_rest','coffee_wait','waiting','idle'].includes(state.action))s.handGrips?.setRelaxation(id,{curl:HUMAN_PROFILES[id].curl,spread:.0015+HUMAN_PROFILES[id].gesture*.0015,free:Object.fromEntries(['L','R'].map(side=>[side,s.humanMotion.free(id,side)]))});
  this.rows.set(id,{attentionPitch,attentionYaw,reaction,phase,stage:stage??'work',progress,active,pitch,torsoPitch:torso.rotation.x,headRoll:head.rotation.z,weight:state.pose?.pelvisZ??0});
 }
 attention(id){const row=this.rows.get(id);if(!this.has(id)||!row)return null;return{pitch:(row.phase==='listen'?row.pitch:0)+(row.attentionPitch??0),yaw:row.attentionYaw??0};}
 greeting(id){return HUMAN_PROFILES[id].dialogue.greeting;}
 talkLift(id,gesture){const p=HUMAN_PROFILES[id].posture;return p.lift*Math.pow(T.MathUtils.clamp(gesture,0,1),p.power);}
 diagnostics(){return{enabled:true,actors:[...this.ids],order:['base','gait','activity intent','gaze','support','prop','fingers','clearance'],states:Object.fromEntries(this.rows),glasses:this.glasses.diagnostics(),daily:this.daily.diagnostics()};}
 dispose(){this.daily.dispose();this.glasses.dispose();this.terrain.dispose();this.soles.clear();this.ids.clear();this.rows.clear();this.previous.clear();}
}
