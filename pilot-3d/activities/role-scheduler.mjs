import {TeamActivityScheduler} from './team-scheduler.mjs';
import {poseFor} from '../sample/poses.mjs';
import {SofaExchange} from './social-interactions.mjs';
import {prepareWindow,WindowTrip} from './window-trip.mjs';
export class RoleActivityScheduler extends TeamActivityScheduler{
 constructor(ids,destinations,cups,drops,desks,options){super(ids,destinations,cups,drops,options);this.desks=desks;this.roleReady=new Map(ids.map((id,i)=>[id,12+i*2]));this.workReady=new Map();this.enrichedActors=new Set(options.enrichedActors??ids);this.sofaPair=null;this.pairHistory=[];this.pairCounts=Object.fromEntries(ids.map(id=>[id,0]));this.pairAttempts=Object.fromEntries(ids.map(id=>[id,0]));this.windowCounts=Object.fromEntries(ids.map(id=>[id,0]));try{this.windowAnchors=prepareWindow(destinations,ids);}catch(e){this.windowIssue=e.message;this.windowAnchors=null;}}
 rawIncoming(id){return super.incoming(id);}
 incoming(id){const source=super.incoming(id);return this.desks?.[id]?.busy&&source.pose==='idle'?{...source,pose:'waiting'}:source;}
 idle(id){return (!this.vm.actors||this.vm.actors.some(a=>a.agentId===id))&&!this.desks?.[id]?.busy&&!this.sofaPair?.ids.includes(id)&&super.idle(id);}
 setViewModel(vm){super.setViewModel(vm);if(!this.desks)return;if(this.sofaPair&&this.sofaPair.ids.some(id=>this.rawIncoming(id).pose!=='idle'||(vm.actors&&!vm.actors.some(a=>a.agentId===id))))this.endSofaPair('상대 업무/활동 종료');for(const id of this.ids){const d=this.desks[id],row=this.rawIncoming(id);if(d.busy&&((!d.work&&row.pose!=='idle')||(d.work&&!['preparing','typing','reviewing'].includes(row.pose))||(vm.actors&&!vm.actors.some(a=>a.agentId===id)))){d.cancel();this.workReady.set(id,this.time+12);}}}
 startRole(id=this.vm.selectedAgent??'nara',{work=false}={}){if(!this.enrichedActors.has(id)||(work&&!['preparing','typing','reviewing'].includes(this.rawIncoming(id).pose))||this.desks[id].busy||this.records.has(id)||this.session?.ids.includes(id)||this.sofaPair?.ids.includes(id)||this.cups[id].state!=='idle'||(!work&&!this.idle(id)))return false;return this.desks[id].start({work});}
 startSofaPair(ids=['nara','jun']){if(this.sofaPair||ids.length!==2||new Set(ids).size!==2||ids.some(id=>!this.enrichedActors.has(id)||!this.idle(id)))return false;const group='sofa-pair';if(!this.book.acquire(group,['sofa-0','sofa-1']))return false;for(const id of ids)this.pairAttempts[id]++;this.sofaPair={ids:[...ids],time:0,phase:'arriving',ending:false,exchange:new SofaExchange(ids,'sofa-'+(++this.serial))};ids.forEach((id,slot)=>{const trip=this.newTrip(id,'sofa',slot,Infinity);this.book.transfer(group,trip.owner,['sofa-'+slot]);trip.startSofa();this.records.set(id,{id,kind:'sofa',slot,trip,phase:'trip',order:++this.serial});});return true;}
 endSofaPair(reason='소파 대화 종료'){const pair=this.sofaPair;if(!pair)return;pair.ending=true;pair.exchange.cancel(reason);for(const id of pair.ids){const r=this.records.get(id);if(r?.kind==='sofa')r.trip.requestReturn(reason);}}
 present(id,state,dt){super.present(id,state,dt);const pair=this.sofaPair;if(pair?.phase==='discussion'&&!pair.ending&&state.action===pair.exchange.cueFor(id).action)pair.exchange.present(id,state.pairPhase,dt);}
 startWindow(id=this.vm.selectedAgent??'nara'){if(!this.windowAnchors||!this.enrichedActors.has(id)||!this.idle(id)||this.book.owners.has('window-0')||[...this.records.values()].some(r=>r.kind==='window'))return false;const trip=new WindowTrip([id],this.windowAnchors.get(id),{actorId:id,owner:id+'-window',book:this.book,sharedTransit:true,waitLimit:180,routeMotion:{speed:.60,period:.8,natural:true}});trip.setViewModel(this.vm);trip.startSofa();this.records.set(id,{id,kind:'window',trip,phase:'trip',order:++this.serial});return true;}
 finishRecord(id){const r=this.records.get(id);if(r?.kind==='window'){if(r.used)this.windowCounts[id]++;r.used=false;}super.finishRecord(id);}
 startDemo(){this.auto=true;for(const id of this.ids)this.startRole(id);this.demoAt=this.time+14;this.nextAuto=this.time+15;return true;}
 cancelAll(){for(const d of Object.values(this.desks))d.cancel();this.demoAt=null;this.endSofaPair('활동 정리');super.cancelAll();}
 tick(raw){
  if(this.paused||this.disposed)return;
  const dt=Math.max(0,Math.min(.06,raw));
  for(const id of this.ids){const d=this.desks[id],busy=d.busy;d.tick(dt);if(busy&&!d.busy)this.roleReady.set(id,this.time+28+this.ids.indexOf(id)*3);}
  for(const id of this.ids){const pose=this.rawIncoming(id).pose;if(['preparing','typing','reviewing'].includes(pose)&&this.time>=(this.workReady.get(id)??0)&&this.startRole(id,{work:true}))this.workReady.set(id,this.time+18);}
  // Reuse trips, response clocks, reservations and cleanup. One selector shares
  // completed counts/cooldowns across old and new actions; two auto loops would
  // consume each other's waiting partners.
  const autonomous=this.auto;this.auto=false;
  try{super.tick(dt);}finally{this.auto=autonomous;}
  for(const r of this.records.values())if(r.kind==='window'&&r.trip.stage==='rest')r.used=true;
  const pair=this.sofaPair;
  if(pair){pair.time+=dt;
   if(pair.ids.every(id=>!this.records.has(id))){this.pairHistory.push({...pair.exchange.diagnostics(),ids:[...pair.ids]});if(this.pairHistory.length>32)this.pairHistory.shift();if(pair.exchange.status==='complete')for(const id of pair.ids)this.pairCounts[id]++;this.sofaPair=null;}
   else if(!pair.ending){if(pair.ids.every(id=>this.records.get(id)?.trip?.stage==='rest')){pair.phase='discussion';pair.exchange.tick(dt,true);if(pair.exchange.done)this.endSofaPair();}else if(pair.time>180)this.endSofaPair('도착 대기 종료');}
  }
  if(this.auto&&this.time>=this.nextAuto){this.autoRound++;this.nextAuto=this.time+[7,9,8,11][this.autoRound%4];this.chooseAuto();}
  if(this.demoAt&&this.time>=this.demoAt&&Object.values(this.desks).every(d=>!d.busy)){this.demoAt=null;this.startSofaPair(['nara','jun']);this.startCup('leo');this.startRest('sora');this.nextAuto=this.time+12;}
 }
 chooseAuto(){
  const free=this.ids.filter(id=>this.idle(id)&&(this.cooldowns.get(id)??0)<=this.time),types=['role','sofa','cup','meeting','sofaPair','window','rest'];
  const pairEligible=this.ids.filter(id=>this.enrichedActors.has(id)),needsPair=pairEligible.length>=2&&pairEligible.some(id=>this.pairCounts[id]===0);
  if(needsPair){const pair=free.filter(id=>this.enrichedActors.has(id)).sort((a,b)=>this.pairCounts[a]-this.pairCounts[b]||this.pairAttempts[a]-this.pairAttempts[b]||this.jitter(a)-this.jitter(b));if(pair.length>=2&&this.startSofaPair(pair.slice(0,2)))return true;}
  const count=(id,kind)=>kind==='role'?this.desks[id].done:kind==='sofaPair'?this.pairCounts[id]:kind==='window'?this.windowCounts[id]:kind==='rest'?this.restCounts[id]:this.counts[id][kind];
  const choices=free.flatMap(id=>types.map((kind,index)=>({id,kind,count:this.activityScore?.(id,kind,count(id,kind))??count(id,kind),rank:(index+this.ids.indexOf(id)+this.autoRound)%types.length}))).sort((a,b)=>a.count-b.count||a.rank-b.rank||this.jitter(a.id)-this.jitter(b.id));
  for(const {id,kind}of choices){let started=false;
   if(kind==='role'&&this.time>=(this.roleReady.get(id)??0))started=this.startRole(id);
   if(kind==='sofa'&&!needsPair&&[...this.records.values()].filter(r=>r.kind==='sofa').length<2)started=this.startSofa(id);
   if(kind==='cup')started=this.startCup(id);
   if(kind==='rest')started=this.startRest(id);
   if(kind==='window')started=this.startWindow(id);
   if(kind==='meeting'||kind==='sofaPair'){const peers=free.filter(other=>other!==id&&(kind!=='sofaPair'||this.enrichedActors.has(other))).sort((a,b)=>count(a,kind)-count(b,kind)||this.jitter(a)-this.jitter(b)),other=peers[0];if(!other&&((kind==='meeting'&&!this.session)||(kind==='sofaPair'&&!this.sofaPair&&this.enrichedActors.has(id)&&pairEligible.length>=2&&!this.book.owners.has('sofa-0')&&!this.book.owners.has('sofa-1'))))return false;if(other){if(kind==='sofaPair')started=this.startSofaPair([id,other]);else started=this.meetings>0&&[id,other].every(key=>this.naturalActors.has(key))?this.startSocial([id,other]):this.startMeeting([id,other]);}}
   if(started)return true;
  }return false;
 }
 state(id){const d=this.desks?.[id];if(d?.busy){const pose=poseFor(id,'idle',this.time);return{action:'role_'+id,time:this.time,pose,activity:'role',roleStage:d.stage,returning:d.returning,basePose:this.rawIncoming(id).pose};}const s=super.state(id);if(this.sofaPair?.phase==='discussion'&&!this.sofaPair.ending&&this.sofaPair.ids.includes(id))return{...s,...this.sofaPair.exchange.cueFor(id),activity:'sofaPair'};return s;}
 diagnostics(){const d=super.diagnostics();d.teamActivities.version=4;d.teamActivities.roleActors=[...this.enrichedActors];d.teamActivities.sofaPair=this.sofaPair?{ids:[...this.sofaPair.ids],...this.sofaPair.exchange.diagnostics(),responsePhase:this.sofaPair.exchange.phase,phase:this.sofaPair.phase,ending:this.sofaPair.ending}:null;d.teamActivities.pairHistory=[...this.pairHistory];d.teamActivities.window={available:!!this.windowAnchors,issue:this.windowIssue??null,position:[...(this.meta?.finalOffice?.window.point??[.4,0,-3.1])]};for(const id of this.ids){const row=d.teamActivities.actors[id],desk=this.desks[id];row.role=desk.diagnostics();row.counts.role=desk.done;row.counts.sofaPair=this.pairCounts[id];row.counts.pairAttempts=this.pairAttempts[id];row.counts.window=this.windowCounts[id];if(desk.busy){row.kind='role';row.stage=desk.stage;row.returning=desk.returning;}}return d;}
 dispose(){this.sofaPair=null;this.pairHistory=[];for(const d of Object.values(this.desks))d.dispose();super.dispose();}
}
