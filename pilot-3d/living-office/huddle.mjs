import * as T from 'three';
import {StandingTrip} from '../ensemble-office/standing-trip.mjs';
import {findFinalRoute} from '../final-office/destinations.mjs';
import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';
import {ReviewSequence} from './review.mjs';
class HuddleTrip extends StandingTrip{
  enter(stage){
    // Every approach is authored around all five potential standing bodies.
    // A separate wide spot lock would block a neighboring safe approach.
    if(stage==='rest'){this.stage=stage;this.elapsed=0;this.book.releaseKeys(this.owner,['walkway']);this.base.owner=null;}
    else super.enter(stage);
  }
}
export function huddleAnchors(meta,id,slot){
  const origin=meta.workspaces[id],slots=meta.livingOffice.standSlots,point=slots[slot],local=p=>p.map((v,k)=>v-origin[k]),start=[origin[0],0,origin[2]-.48],exit=[origin[0]+(id==='leo'?1.05:-1.05),0,origin[2]-.48];
  const colliders=[...meta.finalOffice.colliders,...slots.flatMap((p,i)=>i===slot?[]:[{id:'huddle-body-'+i,center:[p[0],p[2]],radius:.28}]),...meta.actorIds.filter(x=>x!==id).map(other=>{const p=meta.workspaces[other];return{id:other+'-seated',min:[p[0]-.25,p[2]-.8],max:[p[0]+.25,p[2]-.4]};})];
  const facing=Math.atan2(-point[0],.65-point[2]);
  return{route:[start,...findFinalRoute(exit,point,colliders)].map(local),stand:local(point),seated:local(point),facing,stationOrigin:origin,colliders,clearance:.225,kind:'huddle',seat:'huddle-'+slot};
}
export class Huddles{
  constructor(s,model,meta){this.s=s;this.model=model;this.meta=meta;this.current=null;this.history=[];for(const name of meta.livingOffice.topics)model.getObjectByName(name).visible=false;this.anchors=new Map(s.ids.flatMap(id=>Array.from({length:5},(_,i)=>[id+':'+i,huddleAnchors(meta,id,i)])));}
  start(ids=this.s.ids,{review=false}={}){
    if(this.current||ids.length<2||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!this.s.ids.includes(id))||!this.s.ids.every(id=>this.s.idle(id)))return false;
    if(review)for(const name of this.meta.livingOffice.topics)this.model.getObjectByName(name).visible=false;
    const owner='huddle-'+(++this.s.serial),slots=ids.length===2?[1,3]:ids.length===3?[1,2,3]:ids.length===4?[0,1,3,4]:[0,1,2,3,4],keys=slots.map(i=>'huddle-'+i);
    if(!this.s.book.acquire(owner,keys))return false;
    const g={ids:[...ids],records:new Map(),phase:'arriving',review,ending:false,round:0,age:0,presented:new Map(),spoke:new Set(),reason:''};this.current=g;
    ids.forEach((id,i)=>{const slot=slots[i],trip=new HuddleTrip([id],this.anchors.get(id+':'+slot),{actorId:id,owner:id+'-huddle',book:this.s.book,sharedTransit:true,waitLimit:300,routeMotion:{speed:.56,period:.8}});trip.setViewModel(this.s.vm);this.s.configure(trip,id);this.s.book.transfer(owner,trip.owner,['huddle-'+slot]);trip.startSofa();g.records.set(id,{id,slot,kind:'huddle',trip});});return true;
  }
  end(reason='서서 대화 완료'){const g=this.current;if(!g||g.ending)return;g.ending=true;g.reason=reason;g.sequence?.cancel();if(!g.sequence||g.sequence.done)for(const r of g.records.values())r.trip.requestReturn(reason);}
  tick(dt){
    const g=this.current;if(!g)return;g.age+=dt;
    const holding=!!g.sequence&&!g.sequence.done;
    for(const[id,r]of [...g.records]){if(!holding)r.trip.setViewModel(this.s.vm);if(g.ending&&!holding)r.trip.requestReturn(g.reason);if(!holding)r.trip.tick(dt);if(r.trip.stage==='idle'){r.trip.dispose();this.s.book.release(r.trip.owner);g.records.delete(id);this.s.cooldowns.set(id,this.s.time+20);}}
    if(g.sequence&&!g.sequence.done)g.sequence.tick(dt);
    if(g.sequence?.done){const seq=g.sequence;this.lastPointer={id:seq.id,handError:seq.pointer.handError,tipError:seq.pointer.tipError};seq.dispose();g.sequence=null;if(!g.ending){g.spoke.add(g.ids[g.round]);this.model.getObjectByName(this.meta.livingOffice.topics[g.round]).visible=true;g.round++;if(g.round>=g.ids.length)this.end();else this.reviewTurn(g);}}
    if(!g.records.size){this.history.push({ids:[...g.ids],review:g.review,status:g.spoke.size===g.ids.length&&!g.reason.includes('중단')?'complete':'cancelled',spoke:[...g.spoke],seconds:g.age});if(this.history.length>20)this.history.shift();this.current=null;return;}
    if(g.ending)return;
    if(g.phase==='arriving'){if(g.ids.every(id=>g.records.get(id)?.trip.stage==='rest')){g.phase=g.review?'review':'talk';g.presented=new Map(g.ids.map(id=>[id,0]));if(g.review)this.reviewTurn(g);}else if(g.age>300)this.end('도착 대기 중단');return;}
    if(g.review)return;
    if(g.ids.every(id=>(g.presented.get(id)??0)>=3.5)){g.spoke.add(g.ids[g.round]);g.round++;if(g.round>=g.ids.length)this.end();else g.presented=new Map(g.ids.map(id=>[id,0]));}
  }
  reviewTurn(g){const id=g.ids[g.round],r=g.records.get(id);g.sequence=new ReviewSequence(this.s,this.model,id,r.slot);}
  state(id){const g=this.current,r=g?.records.get(id);if(!r)return null;if(g.sequence?.id===id&&!g.sequence.done)return g.sequence.state();const base=r.trip.state(id);if(r.trip.stage!=='rest')return{...base,activity:'huddle'};const speaker=g.ids[g.round],time=g.presented.get(id)??0;return{...base,action:'coffee_wait',activity:g.review?'review':'huddle',huddlePhase:g.phase,huddleRound:g.round,speaking:g.phase==='talk'&&!g.ending&&speaker===id,lookAt:['talk','review'].includes(g.phase)?speaker===id?g.ids[(g.round+1)%g.ids.length]:speaker:undefined,time,gesture:Math.sin(Math.PI*Math.min(1,time/3.5)),returning:g.ending};}
  present(id,state,dt){const g=this.current;if(g&&!g.ending&&g.phase==='talk'&&state.huddlePhase===g.phase&&state.huddleRound===g.round)g.presented.set(id,(g.presented.get(id)??0)+dt);}
  apply(id,actor){if(this.current?.sequence?.id===id)this.current.sequence.apply();const state=this.state(id);if(!state?.speaking)return;const u=ease(state.time/.5)*ease((3.5-state.time)/.6);part(actor,'NaraShoulderR').rotation.x-=.65*u;part(actor,'NaraShoulderR').rotation.z-=.16*u;part(actor,'NaraElbowR').rotation.x-=.8*u;part(actor,'NaraHandR').rotation.z+=Math.sin(state.time*2)*.12*u;}
  diagnostics(){const g=this.current;return{current:g?{ids:[...g.ids],phase:g.phase,round:g.round,review:g.review,ending:g.ending,spoke:[...g.spoke],sequence:g.sequence?{id:g.sequence.id,stage:g.sequence.stage,pointer:g.sequence.pointer.stage,owner:g.sequence.pointer.owner,handError:g.sequence.pointer.handError,tipError:g.sequence.pointer.tipError}:null,actors:[...g.records.values()].map(r=>({id:r.id,slot:r.slot,stage:r.trip.stage}))}:null,lastPointer:this.lastPointer,history:[...this.history]};}
  dispose(){this.current?.sequence?.dispose();for(const r of this.current?.records.values()??[]){r.trip.dispose();this.s.book.release(r.trip.owner);}this.current=null;}
}
