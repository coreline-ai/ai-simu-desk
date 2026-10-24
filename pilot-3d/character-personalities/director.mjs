import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from '../activities/interactions.mjs';
import {ease} from '../sample/motion.mjs';

const V=(...p)=>new T.Vector3(...p),finite=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const limited=(values,limits)=>limits.map((limit,i)=>T.MathUtils.clamp(values?.[i]??0,-limit,limit));

// Character authors describe intent. This adapter alone applies it, respecting
// wrist/prop authority, the shared clock, pause, and the ownership priority.
export class PersonalityDirector {
 constructor(model,metadata,scheduler,registry){
  this.model=model;this.s=scheduler;this.rows=new Map();this.pending=new Map();this.starts=[];
  for(const id of metadata.actorIds){
   const entry=registry[id],actor=model.getObjectByName(metadata.bindings[id].actor),top=model.getObjectByName(actor.userData.prefix+'OakDeskTop');
   model.updateWorldMatrix(true,true);const world=actor.getWorldPosition(V()),tableY=new T.Box3().setFromObject(top).max.y;
   const deskY=actor.parent.worldToLocal(V(world.x,tableY,world.z)).y-actor.position.y;
   const props=entry.createProps({actor,model,THREE:T,deskY});
   props.root.name='PersonalityProps_'+id;props.root.position.copy(actor.position);props.root.rotation.y=actor.rotation.y;actor.parent.add(props.root);
   const row={...entry,sampleFn:entry.sample,actor,props,sample:null,weight:0,left:null,error:0};this.rows.set(id,row);scheduler.desks[id].personality=entry;
  }
 }
 variantFor(id){return {nara:0,sora:2,jun:0,min:1,leo:1}[id]??0;}
 scheduleIntro(){this.pending.clear();for(const[id,row]of this.rows)this.pending.set(id,{at:this.s.time+row.profile.startOffset,expires:this.s.time+16});}
 cancelIntro(){this.pending.clear();}
 tick(){
  for(const[id,r]of this.pending){
   const incoming=this.s.rawIncoming(id);if(incoming.pose!=='idle'||this.s.vm.actors&&!this.s.vm.actors.some(a=>a.agentId===id)||this.s.time>r.expires){this.pending.delete(id);continue;}
   if(this.s.time>=r.at&&this.s.idle(id)&&this.s.startRole(id,{variant:this.variantFor(id)})){this.pending.delete(id);this.starts.push({id,time:this.s.time});if(this.starts.length>25)this.starts.shift();}
  }
 }
 pose(id,actor,state,dt){
  const row=this.rows.get(id);if(!row)return;
  const d=this.s.desks[id],allowed=d.busy||['idle','success','error'].includes(state.action);
  const pose=allowed?rowSample(row,{time:d.busy?d.time:state.action==='success'?state.time:this.s.time,stage:d.stage,variant:d.variant,action:state.action}):null;
  row.sample=pose;d.personalityPose=pose;
  const wanted=d.stage==='use'?ease(d.time/.5):d.stage==='replace'?1-ease(d.time/.5):d.stage==='idle'&&allowed ? .35 : 0;
  row.weight=wanted;
  if(!pose)return;
  const angles=limited(pose.torso,[.07,.10,.04]),torso=part(actor,'NaraTorso');torso.rotation.x+=angles[0]*wanted;torso.rotation.y+=angles[1]*wanted;torso.rotation.z+=angles[2]*wanted;
  row.props.update(pose);
 }
 hands(id,actor,state,dt){
  const row=this.rows.get(id),pose=row?.sample;if(!row)return;
  this.s.handGrips?.setPresentation(id,null);if(!pose||!row.weight)return;
  const d=this.s.desks[id],active=d.stage==='use'||d.stage==='replace',head=part(actor,'NaraHead'),angles=limited(pose.head,[.12,.22,.08]);
  head.rotation.x+=angles[0]*row.weight;head.rotation.y+=angles[1]*row.weight;head.rotation.z+=angles[2]*row.weight;
  const free=side=>this.s.humanMotion?.free(id,side)&&!this.s.personalMotion?.glasses.controls(id,side);
  if(active&&finite(pose.left)&&free('L')){
   actor.updateWorldMatrix(true,true);const hand=part(actor,'NaraHandL'),base=hand.getWorldPosition(V()),desired=actor.localToWorld(new T.Vector3(...pose.left));
   const target=base.clone().lerp(desired,row.weight),alpha=dt>0?1-Math.exp(-dt*12):0;
   if(!row.left)row.left=base.clone();row.left.lerp(target,alpha);
   const q=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));
   row.error=solveArm(actor,row.left,q,'L');
  }else{row.left=null;row.error=0;}
  this.s.handGrips?.setPresentation(id,{L:free('L')?pose.leftGrip:null,R:free('R')||active&&id==='jun'&&!this.s.personalMotion?.glasses.active?pose.rightGrip:null});
 }
 expression(id){
  const row=this.rows.get(id),pose=row?.sample;if(!pose||row.weight<.1||!['focus','thinking','positive','relaxed'].includes(pose.expression))return;
  const g=this.model.getObjectByName(row.actor.userData.prefix+'ExpressionMouths');if(g)for(const n of g.children)n.visible=n.name.endsWith('_'+pose.expression);
 }
 diagnostics(){return{version:1,starts:[...this.starts],pending:[...this.pending.keys()],actors:Object.fromEntries([...this.rows].map(([id,r])=>[id,{label:r.profile.label,signatures:r.profile.signatures,cue:r.sample?.cue??'activity',action:r.sample?.label??'',phase:r.sample?.phase,weight:r.weight,leftError:r.error,workDuration:r.profile.workDuration}]))};}
 dispose(){for(const[id,row]of this.rows){row.props.root.removeFromParent();row.props.dispose();delete this.s.desks[id].personality;delete this.s.desks[id].personalityPose;this.s.handGrips?.setPresentation(id,null);}this.rows.clear();this.pending.clear();}
}
function rowSample(row,context){return row.sampleFn(context);}
