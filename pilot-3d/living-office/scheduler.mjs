import {EnsembleScheduler} from '../ensemble-office/scheduler.mjs';
import {ActivityResume} from './resume.mjs';
import {Huddles} from './huddle.mjs';
import {PeerReactions} from './reactions.mjs';
import {ScenarioDirector} from './scenarios.mjs';
import {CupSupport} from './cup-support.mjs';

export class LivingScheduler extends EnsembleScheduler{
  constructor(...args){super(...args);this.variants=new Map(this.ids.map((id,i)=>[id,i%3]));this.resume=new ActivityResume(this);this.group.minParticipants=3;this.huddles=new Huddles(this,args[5].model,args[5].metadata);this.reactions=new PeerReactions(this,args[5].model);this.scenario=new ScenarioDirector(this);this.cupSupport=new CupSupport(this);}
  startScenario(name='review'){return this.scenario.start(name);}
  idle(id){return !this.huddles?.current&&super.idle(id);}
  extraBusy(id){return !!this.huddles?.current?.records.has(id)||super.extraBusy(id);}
  getRecord(id){return this.huddles?.current?.records.get(id)??super.getRecord(id);}
  startMeeting(ids=['nara','jun']){return ids.length>=3?this.startGroupMeeting(ids):super.startMeeting(ids);}
  startHuddle(ids=this.ids,options){return this.huddles.start(ids,options);}
  startReview(ids=this.ids){return this.startHuddle(ids,{review:true});}
  handControl(id,side){return (side==='R'&&(this.cupSupport?.controls(id)||this.huddles?.current?.sequence?.id===id&&this.huddles.current.sequence.stage==='point'))||super.handControl(id,side);}
  handOverrides(id){return{...super.handOverrides(id),...(this.huddles?.current?.sequence?.id===id?this.huddles.current.sequence.pointer.override():null),...this.cupSupport?.override(id)};}
  tagVariant(id){const r=this.records.get(id);if(r){r.livingVariant=this.variants.get(id)??0;this.variants.set(id,(r.livingVariant+1)%3);}return true;}
  startSofa(id=this.vm.selectedAgent??'nara'){return super.startSofa(id)&&this.tagVariant(id);}
  startWindow(id=this.vm.selectedAgent??'nara'){return super.startWindow(id)&&this.tagVariant(id);}
  startRest(id=this.vm.selectedAgent??'nara'){return super.startRest(id)&&this.tagVariant(id);}
  setViewModel(vm){this.resume?.capture(vm);super.setViewModel(vm);if(this.huddles?.current?.ids.some(id=>(vm.actors&&!vm.actors.some(a=>a.agentId===id))||this.rawIncoming(id).pose!=='idle'))this.huddles.end('업무 도착/참가자 종료 중단');}
  setAuto(value){if(!value)this.resume?.clear();return super.setAuto(value);}
  cancelAll(){this.scenario?.cancel();this.resume?.clear();this.reactions?.clear();this.huddles?.end('활동 중단');super.cancelAll();}
  chooseAuto(){if(this.scenario?.current||this.huddles?.current||this.resume?.pending.size)return false;return super.chooseAuto();}
  tick(dt){super.tick(dt);if(this.paused||this.disposed)return;this.huddles?.tick(Math.max(0,Math.min(.06,dt)));for(const r of this.records.values())if(r.kind==='window'&&r.resumeRemaining&&r.trip.stage==='rest'&&r.trip.elapsed>=r.resumeRemaining)r.trip.requestReturn('남은 창가 휴식 완료');this.resume?.tick();this.reactions?.tick();this.scenario?.watchdog();this.scenario?.tick();}
  state(id){const state=this.huddles?.state(id)??super.state(id);return this.reactions?.state(id,state)??state;}
  present(id,state,dt){super.present(id,state,dt);this.huddles?.present(id,state,dt);}
  applyCustom(id,actor,state,dt){super.applyCustom(id,actor);this.huddles?.apply(id,actor);this.reactions?.apply(id,actor,this.state(id));this.cupSupport?.apply(id,actor,dt);}
  diagnostics(){const d=super.diagnostics();d.teamActivities.version=11;d.teamActivities.living={variants:Object.fromEntries(this.variants),resume:this.resume?.diagnostics(),huddles:this.huddles?.diagnostics(),reactions:this.reactions?.diagnostics(),scenario:this.scenario?.diagnostics(),cupSupport:this.cupSupport?.diagnostics()};for(const r of this.huddles?.current?.records.values()??[]){const g=this.huddles.current,seq=g.sequence?.id===r.id?g.sequence:null;Object.assign(d.teamActivities.actors[r.id],{kind:g.review?'review':'huddle',stage:seq?.stage??r.trip.stage,returning:g.ending});}return d;}
  dispose(){this.cupSupport?.dispose();this.scenario?.cancel();this.resume?.clear();this.reactions?.clear();this.huddles?.dispose();super.dispose();}
}
