import {ellipseEntry} from '../ensemble-office/group-assets.mjs';
import * as T from'three';import{part}from'../sample/character-rig.mjs';import{solveArm}from'./interactions.mjs';import{ease}from'../sample/motion.mjs';
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0),DOWN=new T.Vector3(0,-1,0);
const snap=(actor,side)=>({point:part(actor,'NaraHand'+side).getWorldPosition(V()),q:part(actor,'NaraHand'+side).getWorldQuaternion(new T.Quaternion()),elbow:part(actor,'NaraElbow'+side).getWorldPosition(V())});
export class MeetingSupport{
 constructor(model,scheduler){this.table=model.getObjectByName('MeetingTop');this.radii=model.getObjectByName('AfternoonStudio')?.userData.finalOffice?.meeting.radii;this.ensemble=model.getObjectByName('AfternoonStudio')?.userData.ensembleOffice;this.meeting=model.getObjectByName('AfternoonStudio')?.userData.finalOffice?.meeting;this.scheduler=scheduler;this.surfaces=[this.table,...Array.from({length:5},(_,i)=>model.getObjectByName('GroupNotePage'+i)).filter(Boolean)];this.rows=new Map();this.previous=new Map();this.ray=new T.Raycaster();}
 surface(actor,side){if(this.ensemble?.group){const p=actor.getWorldPosition(V()),q=actor.getWorldQuaternion(new T.Quaternion()),f=new T.Vector3(0,0,1).applyQuaternion(q),right=new T.Vector3(1,0,0).applyQuaternion(q);p.addScaledVector(right,side==='L'?.025:.18);const entry=ellipseEntry(this.meeting,p.toArray(),f.toArray());p.addScaledVector(f,entry+.055);this.ray.set(p.setY(2),DOWN);const hit=this.ray.intersectObjects(this.surfaces,false)[0];if(!hit)throw Error('5인 회의 지지면 누락');const point=hit.point.clone();point.supportObject=hit.object.name;return point;}const center=this.table.getWorldPosition(V()),out=actor.getWorldPosition(V()).sub(center).setY(0).normalize(),right=new T.Vector3(1,0,0).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())),reach=this.radii?1/Math.hypot(out.x/this.radii[0],out.z/this.radii[1])-.10:.62,origin=center.clone().addScaledVector(out,reach).addScaledVector(right,side==='L'?-.085:.085);origin.y+=1;this.ray.set(origin,DOWN);const hit=this.ray.intersectObject(this.table,false)[0];if(!hit)throw Error('회의 지지면 누락');return hit.point.clone();}
 apply(id,actor,state,dt){const s=this.scheduler,r=s.getRecord?.(id)??s.records.get(id),active=['meeting','group'].includes(r?.kind)&&r.trip.stage==='rest'&&!(r.kind==='group'?s.group.current?.ending:s.session?.ending);let row=this.rows.get(id);if(!active&&!row)return;
  if(s.desks[id].busy||s.transfer?.controls(id)){this.rows.delete(id);return;}
  if(active&&!row){row={time:0,exit:null,hands:{},last:{},age:{L:0,R:0},from:this.previous.get(id)??Object.fromEntries(['L','R'].map(side=>[side,snap(actor,side)])),surfaces:Object.fromEntries(['L','R'].map(side=>[side,this.surface(actor,side)]))};this.rows.set(id,row);}row.time+=dt;
  if(!active&&row.exit===null){row.exit=0;row.from=Object.fromEntries(['L','R'].map(side=>[side,row.last[side]??snap(actor,side)]));}if(row.exit!==null)row.exit+=dt;
  // A cancelled note still owns the right hand while returning its pencil.
  // Start the support exit only after that owner has released the wrist.
  if(this.ensemble&&row.exit!==null&&s.group?.controls(id,'R'))row.exit=0;
  const leftFree=['idle','tableRest'].includes(s.cups[id].state),talking=['meeting_talk','social_greet','social_present','social_confirm'].includes(state.action),gesture=leftFree&&talking?(state.gesture??0):0,enter=ease(row.time/.8),leave=row.exit===null?0:ease(row.exit/.9),normal=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));row.hands={};
  for(const side of ['L','R']){if(s.handControl?.(id,side)){row.age[side]=0;row.from[side]=snap(actor,side);continue;}if(side==='L'&&!leftFree){row.age[side]=0;row.from[side]=snap(actor,side);continue;}if(row.age[side]===0)row.from[side]=this.previous.get(id)?.[side]??snap(actor,side);row.age[side]+=dt;const entering=ease(row.age[side]/.8);const base=snap(actor,side),surface=row.surfaces[side],lift=side==='R'?(s.personalMotion?.has(id)?s.personalMotion.talkLift(id,gesture):gesture*(.065+s.ids.indexOf(id)*.004)):0;let target=surface.clone().addScaledVector(UP,.0275+lift),q=normal.clone();
   if(this.ensemble?.group){
    // Lift at the safe lap-side position before advancing over the table edge.
    const from=row.from[side];
    if(row.exit===null){const a=Math.min(1,row.age[side]/.8),hover=from.point.clone().setY(Math.max(surface.y+.08,from.point.y));
     if(a<.6){const v=ease(a/.6);target=from.point.clone().lerp(hover,v);q=from.q.clone().slerp(normal,v);}
     else{target=hover.lerp(target,ease((a-.6)/.4));q=normal.clone();}
    }else{const a=Math.min(1,row.exit/.9),hover=base.point.clone().setY(Math.max(surface.y+.08,base.point.y));
     if(a<.5){const v=ease(a/.5);target=from.point.clone().lerp(hover,v);q=from.q.clone().slerp(normal,v);}
     else{const v=ease((a-.5)/.5);target=hover.lerp(base.point,v);q=normal.clone().slerp(base.q,v);}
    }
   }else if(row.exit===null){target=row.from[side].point.clone().lerp(target,entering);q=row.from[side].q.clone().slerp(q,entering);}else{target=row.from[side].point.clone().lerp(base.point,leave).addScaledVector(UP,Math.sin(Math.PI*leave)*.03);q=row.from[side].q.clone().slerp(base.q,leave);}
   const shoulder=part(actor,'NaraShoulder'+side).getWorldPosition(V()),axis=target.clone().sub(shoulder).normalize(),previous=row.last[side]??row.from[side],from=previous.elbow.clone().sub(shoulder),to=new T.Vector3(side==='L'?-1:1,.5,-.3).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion()));from.addScaledVector(axis,-from.dot(axis)).normalize();to.addScaledVector(axis,-to.dot(axis)).normalize();const angle=Math.atan2(axis.dot(from.clone().cross(to)),from.dot(to)),pole=from.applyAxisAngle(axis,T.MathUtils.clamp(angle,-3.5*dt,3.5*dt)),error=solveArm(actor,target,q,side,pole),actual=part(actor,'NaraHand'+side).getWorldPosition(V()),planted=row.exit===null&&entering>.999&&lift<.0001;row.last[side]=snap(actor,side);row.hands[side]={object:surface.supportObject??'MeetingTop',planted,lift,error,palmGap:planted?actual.y-.026-surface.y:null,surface:surface.toArray(),hand:actual.toArray()};
  }
  if(row.exit!==null&&row.exit>=.9)this.rows.delete(id);
 }
 remember(id,actor){this.previous.set(id,Object.fromEntries(['L','R'].map(side=>[side,snap(actor,side)])));}
 diagnostics(){return Object.fromEntries([...this.rows].map(([id,r])=>[id,{phase:r.exit===null?'supported':'releasing',hands:r.hands}]));}
 dispose(){this.rows.clear();this.previous.clear();}
}
