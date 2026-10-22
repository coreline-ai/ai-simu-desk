import {solveArm} from './interactions.mjs';
import {ease} from '../sample/motion.mjs';
import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {PROFILES} from '../sample/characters.mjs';

// Upper-body presentation only. Routes, feet, seats and the cup retain ownership.
export class NaturalMotion {
  constructor(scheduler,ids){this.scheduler=scheduler;this.ids=new Set(ids);this.previous=new Map();}
  apply(id,actor,state,dt){
    if(!this.ids.has(id))return;
    const time=this.scheduler.time,profile=PROFILES[id],record=this.scheduler.getRecord?.(id)??this.scheduler.records.get(id),trip=record?.trip;
    const head=part(actor,'NaraHead'),torso=part(actor,'NaraTorso');
    if(trip?.stage==='stand'){
      const u=Math.min(1,trip.elapsed/2);torso.rotation.x+=Math.sin(Math.PI*u)*.17;
      torso.position.z+=Math.sin(Math.PI*u)*.025;
      const route=trip.anchors.route,next=route[1]??route[0];
      head.rotation.y=T.MathUtils.clamp(Math.atan2(next[0]-route[0][0],next[2]-route[0][2]),-.32,.32)*Math.sin(Math.PI*u);
    }
    if(state.pose?.seatBlend!==undefined){const u=state.pose.seatBlend;torso.rotation.x+=Math.sin(Math.PI*u)*.18;torso.position.z+=Math.sin(Math.PI*u)*.025;}
    if(record?.kind==='micro'&&state.pose?.restEnvelope!==undefined){const u=state.pose.restEnvelope,style=state.pose.restStyle,left=part(actor,'NaraShoulderL'),right=part(actor,'NaraShoulderR');
      if(style==='one_arm'){right.rotation.z=2.55*u;part(actor,'NaraElbowR').rotation.x=-.3*u;torso.rotation.z=-.045*u;}
      if(style==='back_open'){left.rotation.x=right.rotation.x=.40*u;left.rotation.z=-.24*u;right.rotation.z=.24*u;torso.rotation.x=-.07*u;}
      if(style==='side_stretch'){left.rotation.z=-2.2*u;right.rotation.z=2.2*u;torso.rotation.z=Math.sin((record.elapsed-2)*.65)*.09*u;}
      if(style==='shoulder_release'){left.rotation.z=(-.18+Math.sin(time*1.5)*.14)*u;right.rotation.z=(.18+Math.sin(time*1.5+.5)*.14)*u;left.rotation.x=right.rotation.x=-.2*u;}
    }
    if(state.action==='meeting_talk'){const u=state.gesture??1;part(actor,'NaraShoulderR').rotation.x=-.35-.45*u;part(actor,'NaraShoulderR').rotation.z=.12*u;part(actor,'NaraElbowR').rotation.x=-.55-.3*u;}
    if(['meeting_ack','social_respond','social_confirm'].includes(state.action))head.rotation.x+=Math.sin((this.scheduler.session?.talk??0)*5)*.08*(state.gesture??1);
    if(state.note){head.rotation.x=.18;head.rotation.y=0;}
    if(state.action==='walk'){torso.rotation.z+=Math.sin((state.pose?.gaitTime??time)*Math.PI*2)*.012;}
    const nodes=['NaraHead','NaraTorso'];
    // An IK-constrained lap or hand is never passed through an unconstrained blend.
    if(state.action!=='sofa_rest'||state.variant!==2)nodes.push('NaraShoulderL','NaraShoulderR','NaraElbowL','NaraElbowR');
    const prev=this.previous.get(id)??new Map(),alpha=1-Math.exp(-Math.max(0,dt)*11);
    for(const name of nodes){const node=part(actor,name),before=prev.get(name);if(before&&dt>0)node.quaternion.slerpQuaternions(before,node.quaternion.clone(),alpha);prev.set(name,node.quaternion.clone());}
    if(record?.kind==='meeting'&&!this.scheduler.meta?.ensembleOffice&&trip?.stage==='rest'){
      const u=['meeting_talk','social_greet'].includes(state.action)?(state.gesture??0):0,lift=ease(Math.min(1,u*3)),reach=ease((u-.35)/.65),hip=part(actor,'NaraPelvis').position.y;
      actor.updateMatrixWorld(true);const target=actor.localToWorld(new T.Vector3(.18,hip+.13+.27*lift,.14+.31*reach)),q=actor.getWorldQuaternion(new T.Quaternion());solveArm(actor,target,q,'R');
      for(const name of ['NaraShoulderR','NaraElbowR'])prev.set(name,part(actor,name).quaternion.clone());
    }
    this.previous.set(id,prev);
    if(trip?.stage==='queued'){head.rotation.y+=Math.sin(time*.33+profile.phase)*.09;}
    const phase=(time+profile.phase)%(4.3+this.scheduler.ids.indexOf(id)*.27),blink=phase<.15?Math.max(.05,Math.abs(phase-.075)/.075):1;
    for(const sign of[-1,1])for(const name of['EyeWhite','Iris','EyeGlint']){const eye=part(actor,name+sign);if(eye){eye.userData.baseEyeY??=eye.scale.y;eye.scale.y=eye.userData.baseEyeY*blink;}}
    // Continuous breathing is small enough to preserve the authored seat support.
    if(['idle','waiting','sofa_rest','meeting_listen','meeting_wait'].includes(state.action))torso.rotation.x+=Math.sin(time*1.4+profile.phase)*.006;
  }
}
