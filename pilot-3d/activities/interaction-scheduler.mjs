import {GroundedRoute} from './grounded-route.mjs';
import * as T from 'three';
import {ExpressiveScheduler} from './expressive-scheduler.mjs';
import {DeskVisitTrip} from './desk-visit.mjs';
import {prepareVisits} from './visit-anchors.mjs';
import {ResponsiveExchange} from './responsive-exchange.mjs';
import {poseFor} from '../sample/poses.mjs';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from './interactions.mjs';
import {VisitCorridors} from './traffic.mjs';
import {PropTransfers} from './prop-transfer.mjs';
import {describeVisit} from './visit-presentation.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export class InteractionScheduler extends ExpressiveScheduler{
  constructor(ids,destinations,cups,drops,desks,options){super(ids,destinations,cups,drops,desks,options);this.refined=!!options.refined;this.grounded=!!options.grounded;this.book=new VisitCorridors();this.interactionActors=new Set(options.interactionActors??ids);this.visits=prepareVisits(options.model,options.metadata,destinations);this.visit=null;this.waitingVisit=null;this.visitWaitCooldown=new Map();this.visitHistory=[];this.deferred=new Map();this.episodes=new Map();this.episodeHistory=[];this.lastRoles=new Map(ids.map(id=>[id,0]));this.nextVisit=60;this.nextPair=new Map();this.visitCounts=Object.fromEntries(ids.map(id=>[id,0]));this.models=options.model;this.meta=options.metadata;const actors=Object.fromEntries(ids.map(id=>[id,options.model.getObjectByName(options.metadata.bindings[id].actor)]));this.transfer=new PropTransfers(options.model,actors,desks.leo.prop.material);}
  visitBusy(id){return this.visit&&(id===this.visit.visitor||id===this.visit.host&&(!this.visit.ending||!!this.transfer.controls(id)));}
  presentationBusy(id){return !!this.visitBusy(id)||super.presentationBusy(id);}
  idle(id){return !(this.selectingOld&&this.waitingVisit?.id===id)&&!this.deferred?.has(id)&&!this.visitBusy(id)&&super.idle(id);}
  startRole(id,...args){return !this.visitBusy(id)&&super.startRole(id,...args);}
  startRestFlow(id=this.vm.selectedAgent??'nara'){if(!super.startRest(id))return false;const r=this.records.get(id);r.style='shoulder_release';r.seated=false;r.flowWindow=true;return true;}
  startRest(id=this.vm.selectedAgent??'nara'){const started=super.startRest(id);if(started&&this.interactionActors.has(id)){const r=this.records.get(id);r.flowWindow=!r.seated&&(this.restCounts[id]+this.ids.indexOf(id)+this.seed)%2===0;}return started;}
  startVisitDemo(){if(this.visit||this.records.size||Object.values(this.desks).some(d=>d.busy)||this.interactionActors.size<5||!this.ids.every(id=>this.idle(id)))return false;this.setAuto(false);this.tourReason=null;this.tour=[['nara','jun'],['sora','min'],['leo','nara']];return true;}
  startDemo(){const started=super.startDemo();this.walkDemoAt=null;this.introAt=this.time+12;this.nextAuto=this.time+13;return started;}
  link(id,kind,origin){this.episodes.set(id,{kind,origin,expires:this.time+180});}
  legacyReady(id){return ['sofa','cup','meeting'].every(kind=>this.counts[id][kind]>0)&&this.pairCounts[id]>0&&this.windowCounts[id]>0&&this.restCounts[id]>0&&this.desks[id].variantsSeen.size===3;}
  chooseOld(){this.selectingOld=true;try{return super.chooseAuto();}finally{this.selectingOld=false;}}
  setAuto(value){if(!value)this.waitingVisit=null;return super.setAuto(value);}
  chooseAuto(){
    if(this.introAt)return false;
    for(const [id,row]of this.episodes)if(this.time>row.expires)this.episodes.delete(id);
    const free=this.ids.filter(id=>this.interactionActors.has(id)&&this.idle(id)&&(this.cooldowns.get(id)??0)<=this.time);
    // A new visit must not take the available partner away from a colleague
    // who has yet to complete one of the existing destinations.
    if(this.waitingVisit&&(!free.includes(this.waitingVisit.id)||this.time>=this.waitingVisit.until)){if(this.time>=this.waitingVisit.until)this.visitWaitCooldown.set(this.waitingVisit.id,this.time+30);this.waitingVisit=null;}
    if(free.some(id=>['sofa','cup','meeting'].some(kind=>this.counts[id][kind]===0)))return super.chooseAuto();
    if(!this.waitingVisit&&this.ids.every(id=>this.pairCounts[id]>0)){const id=free.find(id=>this.visitCounts[id]===0&&this.legacyReady(id)&&this.time>=(this.visitWaitCooldown.get(id)??0));if(id)this.waitingVisit={id,until:this.time+240};}
    if(!this.visit&&this.time>=this.nextVisit&&this.ids.every(id=>this.pairCounts[id]>0)){
      // Keep one unserved desk opportunity across the preceding visit and its
      // cooldown; another long activity must not consume it before a peer frees.
      const eligible=free.filter(id=>this.legacyReady(id)),allLegacy=this.ids.every(id=>this.legacyReady(id));
      for(const visitor of [...eligible].sort((a,b)=>Number(b===this.waitingVisit?.id)-Number(a===this.waitingVisit?.id)||this.visitCounts[a]-this.visitCounts[b]||this.jitter(a)-this.jitter(b)))for(const host of eligible.filter(id=>id!==visitor).sort((a,b)=>Number(this.nextPair.get(visitor)===a)-Number(this.nextPair.get(visitor)===b)||this.visitCounts[a]-this.visitCounts[b])){
        if(!allLegacy&&this.visitCounts[visitor]>0&&this.visitCounts[host]>0)continue;
        const transfer=this.transfer.available(host)&&(this.autoRound+this.seed)%3!==0;if(this.startVisit(visitor,host,{transfer})){if([visitor,host].includes(this.waitingVisit?.id))this.waitingVisit=null;this.nextVisit=this.time+100;this.nextPair.set(visitor,host);this.episodes.delete(visitor);this.episodeHistory.push({id:visitor,peer:host,kind:'role_to_visit',transfer,time:this.time});if(this.episodeHistory.length>40)this.episodeHistory.shift();return true;}
      }
    }
    for(const id of free){if(id===this.waitingVisit?.id)continue;const row=this.episodes.get(id);if(row?.kind==='role'&&this.startRole(id)){this.episodes.delete(id);this.episodeHistory.push({id,kind:'review_to_sort',time:this.time});if(this.episodeHistory.length>40)this.episodeHistory.shift();return true;}}
    return this.chooseOld();
  }
  startVisit(visitor='nara',host='jun',{transfer=false}={}){
    if(this.visit||visitor===host||![visitor,host].every(id=>this.interactionActors.has(id))||!this.idle(visitor))return false;
    if(!this.idle(host)){this.deferred.set(visitor,{host,started:this.time,until:this.time+1.5});this.lastRequest={visitor,host,status:'deferred',reason:'동료 업무/활동 중'};return false;}
    const anchors=this.visits.anchors.get(visitor+':'+host);if(!anchors||(transfer&&!this.transfer.available(host)))return false;
    const trip=new DeskVisitTrip(visitor,anchors,this.book);if(this.grounded)trip.options.routeFactory=GroundedRoute;trip.setViewModel(this.vm);trip.startSofa();
    const invitation=new ResponsiveExchange([visitor,host],'invite-'+(++this.serial),{variant:0});invitation.stages=[['greet',1.1],['respond',1]];
    trip.canReturn=()=>this.transfer.canLeave();this.visit={ids:[visitor,host],visitor,host,trip,wantsTransfer:transfer,phase:'inviting',invitation,time:0,exchange:new ResponsiveExchange([visitor,host],'visit-'+this.serial,{variant:this.serial%6}),ending:false};this.lastRequest={visitor,host,status:'inviting'};return true;
  }
  endVisit(reason='함께 검토 종료'){if(!this.visit)return;this.visit.ending=true;this.visit.reason=reason;this.visit.invitation.cancel(reason);this.visit.exchange.cancel(reason);this.transfer.cancel();this.visit.trip.requestReturn(reason);}
  setViewModel(vm){super.setViewModel(vm);if(this.waitingVisit&&(this.rawIncoming(this.waitingVisit.id).pose!=='idle'||(vm.actors&&!vm.actors.some(a=>a.agentId===this.waitingVisit.id))))this.waitingVisit=null;if(this.tour&&this.ids.some(id=>this.rawIncoming(id).pose!=='idle'||(vm.actors&&!vm.actors.some(a=>a.agentId===id)))){this.tour=null;this.tourReason='실제 업무/상대 종료로 시연 대기 해제';}for(const id of this.episodes?.keys()??[])if(this.rawIncoming(id).pose!=='idle'||(vm.actors&&!vm.actors.some(a=>a.agentId===id)))this.episodes.delete(id);for(const id of this.deferred?.keys()??[])if(this.rawIncoming(id).pose!=='idle'||(vm.actors&&!vm.actors.some(a=>a.agentId===id)))this.deferred.delete(id);if(this.visit&&this.visit.ids.some(id=>this.rawIncoming(id).pose!=='idle'||(vm.actors&&!vm.actors.some(a=>a.agentId===id))))this.endVisit('업무 도착/상대 종료');}
  cancelAll(){this.waitingVisit=null;this.introAt=null;this.tour=null;this.episodes?.clear();this.deferred?.clear();this.endVisit('활동 정리');super.cancelAll();}
  tick(dt){super.tick(dt);if(this.paused||this.disposed)return;
    for(const id of this.ids){const d=this.desks[id];if(d.done>(this.lastRoles.get(id)??0)){this.lastRoles.set(id,d.done);if(this.rawIncoming(id).pose==='idle')this.link(id,'visit','role');}}
    for(const [id,r]of this.records)if(r.kind==='micro'&&r.flowWindow&&!r.flowAttempted&&r.exitAt===undefined&&r.elapsed>=8.7){r.flowAttempted=true;const owner=id+'-window';if(this.windowAnchors&&!this.book.owners.has('window-0')&&![...this.records.values()].some(x=>x.kind==='window')){this.book.register(owner,this.windowAnchors.get(id));if(this.book.request(owner,['walkway'])){this.finishRecord(id);if(this.startWindow(id)){this.book.acquire(owner,['window-0']);const trip=this.records.get(id).trip;trip.base.owner=owner;trip.stage='stand';trip.elapsed=2;this.episodeHistory.push({id,kind:'standing_rest_to_window',time:this.time});if(this.episodeHistory.length>40)this.episodeHistory.shift();}else this.book.release(owner);}else this.book.release(owner);}}
    if(this.introAt&&this.time>=this.introAt){this.introAt=null;if(this.interactionActors.size>=2)this.startVisit('nara','jun',{transfer:this.transfer.available('jun')});this.nextAuto=this.time+8;}
    if(this.tour?.length&&!this.visit){const [visitor,host]=this.tour[0];if(this.startVisit(visitor,host,{transfer:this.transfer.available(host)}))this.tour.shift();}if(this.tour&&!this.tour.length&&!this.visit)this.tour=null;
    for(const [id,row]of this.deferred)if(this.time>=row.until)this.deferred.delete(id);if(!this.visit)return;const v=this.visit;v.time+=Math.max(0,Math.min(.06,dt));v.trip.setViewModel(this.vm);
    if(v.phase==='inviting'&&!v.ending){v.invitation.tick(Math.max(0,Math.min(.06,dt)),true);if(!v.invitation.done)return;if(v.invitation.status!=='complete')this.endVisit('초대 응답 없음');else{v.phase='arriving';this.lastRequest={visitor:v.visitor,host:v.host,status:'accepted'};}}
    v.trip.tick(dt);
    if(v.trip.stage==='rest'&&!v.ending){if(!v.transferStarted){v.phase='discussion';v.exchange.tick(Math.max(0,Math.min(.06,dt)),true);if(v.exchange.done){if(v.wantsTransfer&&v.exchange.status==='complete'){v.transferStarted=this.transfer.begin(v.host,v.visitor,v.trip.anchors);v.phase='transfer';if(!v.transferStarted)this.endVisit('문서 이용 불가');}else this.endVisit('검토 확인 완료');}}}
    this.transfer.tick(Math.max(0,Math.min(.06,dt)),v.trip.stage==='idle');if(v.transferStarted&&!this.transfer.active&&!v.ending)this.endVisit('문서 검토 완료');
    if(v.time>150&&!v.ending)this.endVisit('도착 대기 종료');
    if(v.trip.stage==='idle'&&!this.transfer.active){if(v.exchange.status==='complete'){for(const id of v.ids)this.visitCounts[id]++;this.link(v.visitor,'role','review');}this.visitHistory.push({ids:v.ids,...v.exchange.diagnostics(),reason:v.reason,transfer:!!v.transferStarted,transferComplete:v.transferStarted&&this.transfer.complete,transferStages:v.transferStarted?[...this.transfer.history]:[]});if(this.visitHistory.length>40)this.visitHistory.shift();for(const id of v.ids)this.cooldowns.set(id,this.time+25);v.trip.dispose();this.visit=null;}
  }
  state(id){const defer=this.deferred?.get(id);if(defer)return{action:'visit_defer',time:this.time-defer.started,pose:poseFor(id,'idle',this.time),activity:'visit'};const v=this.visit;if(!v?.ids.includes(id)||(id===v.host&&v.ending&&!this.visitBusy(id)))return super.state(id);
    if(v.phase==='inviting'&&!v.ending){const cue=v.invitation.cueFor(id);return{...cue,action:'visit_invite',pose:poseFor(id,'idle',this.time),time:v.invitation.presented.get(id)??0,activity:'visit',visitPhase:v.invitation.phase};}
    const base=id===v.visitor?v.trip.state(id):{action:'idle',time:this.time,pose:poseFor(id,'idle',this.time)};
    if(this.transfer.active&&this.transfer.ids.includes(id))return{...base,action:'desk_transfer',time:this.transfer.time,activity:'visit',gazePoint:this.transfer.page.mesh.getWorldPosition(V()).toArray()};
    if(v.phase==='discussion'&&!v.ending){const cue=v.exchange.cueFor(id);return{...base,action:'desk_visit',time:v.exchange.presented.get(id)??0,activity:'visit',visitPhase:v.exchange.phase,gesture:cue.gesture,speaking:cue.speaking,lookAt:['reflect','note','explain'].includes(v.exchange.phase)?undefined:v.ids.find(other=>other!==id),gazePoint:['reflect','note','explain'].includes(v.exchange.phase)?this.models.getObjectByName(this.meta.bindings[v.host].actor).parent.localToWorld(V(.05,1.05,.02)).toArray():undefined};}
    return{...base,activity:'visit',returning:v.ending};
  }
  present(id,state,dt){super.present(id,state,dt);if(this.visit?.phase==='inviting'&&!this.visit.ending&&state.action==='visit_invite')this.visit.invitation.present(id,state.visitPhase,dt);if(this.visit?.phase==='discussion'&&!this.visit.ending&&state.action==='desk_visit')this.visit.exchange.present(id,state.visitPhase,dt);}
  applyVisit(id,actor,state){if(state.action==='visit_defer'){part(actor,'NaraHead').rotation.x+=Math.sin(Math.min(1,state.time/1.5)*Math.PI)*.07;return;}if(!['desk_visit','visit_invite'].includes(state.action))return;const u=state.gesture??0;if(state.speaking){actor.updateWorldMatrix(true,true);const hand=part(actor,'NaraHandR'),from=hand.getWorldPosition(V()),q=actor.getWorldQuaternion(new T.Quaternion()),target=actor.localToWorld(V(.17,part(actor,'NaraPelvis').position.y+.30,.27));solveArm(actor,from.lerp(target,u*.8),q,'R');}part(actor,'NaraHead').rotation.x+=Math.sin(state.time*3.3)*.025*u;}
  diagnostics(){const d=super.diagnostics();d.teamActivities.version=this.grounded?8:this.refined?7:6;if(this.grounded){d.teamActivities.bodyContacts=this.bodyContacts?.diagnostics();d.teamActivities.meetingSupport=this.meetingSupport?.diagnostics();}d.teamActivities.episodes={pending:[...this.episodes],history:[...this.episodeHistory],tour:this.tour??null};d.teamActivities.hands=this.handGrips?.diagnostics();if(this.refined)d.teamActivities.sofaSupport=this.sofaSupport?.diagnostics();d.teamActivities.transfer=this.transfer.diagnostics();d.teamActivities.visitRequest=this.lastRequest??null;d.teamActivities.deferred=[...this.deferred.keys()];d.teamActivities.visits={waiting:this.waitingVisit?{...this.waitingVisit}:null,availability:this.visits.availability,counts:{...this.visitCounts},history:[...this.visitHistory],current:this.visit?{ids:this.visit.ids,phase:this.visit.phase,stage:this.visit.trip.stage,ending:this.visit.ending,exchange:this.visit.exchange.diagnostics()}:null};for(const id of this.visit?.ids??[]){if(!this.visitBusy(id))continue;const actor=d.teamActivities.actors[id];actor.kind='visit';actor.stage=this.visit.trip.stage;actor.returning=this.visit.ending;if(this.refined){actor.visitPresentation=describeVisit({role:id===this.visit.visitor?'visitor':'host',phase:this.visit.phase,tripStage:this.visit.trip.stage,ending:this.visit.ending,paperStage:this.transfer.active?this.transfer.stage:null,paperControlled:!!this.transfer.controls(id)});actor.stage=actor.visitPresentation.stage;actor.returning=actor.visitPresentation.returning;}}return d;}
  dispose(){this.waitingVisit=null;this.visitWaitCooldown.clear();this.visit?.trip.dispose();this.visit=null;this.visitHistory=[];this.deferred.clear();this.episodes.clear();this.episodeHistory=[];this.tour=null;this.transfer.dispose();super.dispose();}
}
