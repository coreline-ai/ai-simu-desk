import {ease} from '../sample/motion.mjs';
const STAGES=[['greet',1.2],['respond',1],['note',2.1],['explain',3],['confirm',1.1]];
export class SocialExchange {
 constructor(ids,cue){this.ids=[...ids];this.cue=cue;this.index=0;this.elapsed=0;this.total=0;this.wait=0;this.presented=new Map(ids.map(id=>[id,0]));this.history=[];this.status='active';}
 get phase(){return STAGES[this.index]?.[0]??'done';}
 get done(){return this.status!=='active';}
 present(id,phase,dt){if(!this.done&&phase===this.phase&&this.presented.has(id))this.presented.set(id,this.presented.get(id)+Math.max(0,Math.min(.06,dt)));}
 tick(dt,ready){if(this.done)return;this.total+=dt;if(!ready){this.wait+=dt;if(this.wait>6)this.cancel('상대 준비 대기 종료');return;}this.elapsed+=dt;const length=STAGES[this.index][1];if(this.ids.every(id=>this.presented.get(id)>=length)){this.history.push(this.phase);this.index++;this.elapsed=0;for(const id of this.ids)this.presented.set(id,0);if(this.index===STAGES.length)this.status='complete';}else if(this.elapsed>length+4)this.cancel('상대 응답 대기 종료');}
 cancel(reason){if(this.status==='active'){this.status='cancelled';this.reason=reason;}}
 cueFor(id){const leader=this.ids[0]===id,phase=this.phase,time=this.presented.get(id)??0,length=STAGES[this.index]?.[1]??1,gesture=ease(time/.3)*(1-ease((time-length+.3)/.3));let action='meeting_pause';if(phase==='greet')action=leader?'social_greet':'meeting_listen';if(phase==='respond')action=leader?'meeting_listen':'social_respond';if(phase==='note')action='social_note';if(phase==='explain')action=leader?'meeting_talk':'meeting_listen';if(phase==='confirm')action=leader?'meeting_listen':'social_confirm';return{action,socialPhase:phase,gesture,note:phase==='note',lookAt:phase==='note'?undefined:this.ids.find(other=>other!==id)};}
 diagnostics(){return{cue:this.cue,phase:this.phase,status:this.status,history:[...this.history],presented:Object.fromEntries(this.presented),reason:this.reason};}
}
