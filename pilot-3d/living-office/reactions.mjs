import {Vector3} from 'three';
import {ease} from '../sample/motion.mjs';
import {part} from '../sample/character-rig.mjs';
// Cosmetic response only. Never changes a path, a prop owner or an IK target.
export class PeerReactions{
 constructor(s,model){this.s=s;this.actors=Object.fromEntries(s.ids.map(id=>[id,model.getObjectByName(s.meta.bindings[id].actor)]));this.active=new Map();this.ready=new Map();this.history=[];}
 free(id){return !this.s.desks[id].busy&&!this.s.transfer?.controls(id)&&!this.s.handControl(id,'R')&&!this.s.huddles.current&&!this.s.group.current&&this.s.cups[id].state==='idle';}
 tick(){
  for(const[id,r]of this.active)if(this.s.time>=r.end||!this.free(id)||this.s.rawIncoming(id).pose!=='idle')this.active.delete(id);
  const points=this.s.ids.map(id=>[id,this.actors[id].getWorldPosition(new Vector3())]);
  for(const[id,p]of points){if(this.active.has(id)||(this.ready.get(id)??0)>this.s.time||!this.free(id)||this.s.rawIncoming(id).pose!=='idle')continue;const r=this.s.records.get(id),moving=['out','home','queued'].includes(r?.trip?.stage);if(!moving)continue;
   const peer=points.filter(([other,q])=>other!==id&&p.distanceTo(q)>.65&&p.distanceTo(q)<1.8).sort((a,b)=>p.distanceTo(a[1])-p.distanceTo(b[1]))[0]?.[0];if(!peer)continue;
   this.active.set(id,{peer,start:this.s.time,end:this.s.time+1.7});this.ready.set(id,this.s.time+25);this.history.push({id,peer,at:this.s.time});if(this.history.length>40)this.history.shift();
  }
 }
 state(id,state){const r=this.active.get(id);if(!r||state.lookAt||!this.free(id)||!['walk','idle','waiting','turn','standing'].includes(state.action))return state;const t=this.s.time-r.start;return{...state,lookAt:r.peer,greeting:ease(t/.35)*ease((1.7-t)/.45),greetingPeer:r.peer};}
 apply(id,actor,state){if(!state.greeting||!this.free(id))return;const profile=this.s.personalMotion?.has(id)?this.s.humanMotion.rows.get(id):null,amount=state.greeting*(profile?this.s.personalMotion.greeting(id):1);part(actor,'NaraShoulderR').rotation.x-=.20*amount;part(actor,'NaraShoulderR').rotation.z-=.16*amount;part(actor,'NaraElbowR').rotation.x-=.22*amount;part(actor,'NaraHead').rotation.x+=.025*Math.sin((this.s.time-this.active.get(id).start)*4)*state.greeting;}
 diagnostics(){return{active:[...this.active].map(([id,r])=>({id,...r})),history:[...this.history]};}
 clear(){this.active.clear();this.ready.clear();}
}
