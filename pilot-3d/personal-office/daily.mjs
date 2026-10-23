const WORK=new Set(['preparing','typing','reviewing']);
const AFTER=new Set(['sofa','window','rest','cup','coffee','meeting','sofaPair']);
// One-shot context intents supplement the existing fair selector. They never
// schedule while working and do not change manual commands, scenarios or leases.
export class PersonalDaily {
 constructor(s){this.s=s;this.pending=new Map();this.worked=new Set();this.previous=new Map();this.nextObserve=0;this.history=[];this.serial=0;}
 setViewModel(vm){for(const id of this.s.ids){if(!this.s.personalMotion?.has(id))continue;const a=vm.actors?.find(a=>a.agentId===id);if(vm.actors&&!a){this.pending.delete(id);this.worked.delete(id);continue;}if(WORK.has(a?.pose)){this.worked.add(id);this.pending.delete(id);}else if(a?.pose==='idle'&&this.worked.delete(id)&&this.s.auto)this.offer(id,'after-work');}}
 offer(id,context){this.pending.set(id,{context,at:this.s.time,serial:++this.serial});}
 totals(id){const s=this.s,c=s.counts[id];return{sofa:c.sofa,window:s.windowCounts[id],rest:s.restCounts[id],cup:c.cup,coffee:s.coffee.counts[id],meeting:c.meeting,sofaPair:s.pairCounts[id]};}
 tick(){const s=this.s;if(s.time<this.nextObserve)return;this.nextObserve=s.time+.25;for(const id of s.ids){if(!s.personalMotion?.has(id))continue;const now=this.totals(id),old=this.previous.get(id);if(old&&s.auto&&!s.scenario?.current)for(const kind of AFTER)if(now[kind]>old[kind])this.offer(id,kind==='meeting'||kind==='sofaPair'?'after-social':'after-break');this.previous.set(id,now);const pending=this.pending.get(id);if(pending&&s.time-pending.at>180)this.pending.delete(id);}}
 choose(){const s=this.s;if(!s.auto||s.scenario?.current||s.huddles?.current||s.tour||s.group?.current||s.groupIntentAt!==null||s.threeWalkAt!==null||s.sofaPair||s.session)return false;
 const candidates=[...this.pending].filter(([id])=>s.idle(id)&&(s.cooldowns.get(id)??0)<=s.time).sort((a,b)=>a[1].serial-b[1].serial||s.ids.indexOf(a[0])-s.ids.indexOf(b[0]));
 for(const [id,intent]of candidates){let kind,started=false;if(intent.context==='after-work'){const kinds=['rest','window','sofa'],start=(s.seed+s.ids.indexOf(id))%kinds.length;for(let i=0;i<kinds.length;i++){kind=kinds[(start+i)%kinds.length];started=kind==='rest'?s.startRest(id):kind==='window'?s.startWindow(id):s.startSofa(id);if(started)break;}}else if(s.time>=(s.roleReady.get(id)??0)){kind='role';started=s.startRole(id);}
 if(started){this.pending.delete(id);this.history.push({id,context:intent.context,kind,time:s.time});if(this.history.length>40)this.history.shift();return true;}}
 return false;
 }
 clear(){this.pending.clear();this.worked.clear();}
 diagnostics(){return{pending:Object.fromEntries(this.pending),history:[...this.history],policy:'one contextual action, then existing fair coverage selector; work/scenario/manual reservations retain priority'};}
 dispose(){this.clear();this.previous.clear();this.history=[];}
}
