import{MotionClock}from'./motion.mjs';import{CLIP_LENGTH,STATES}from'./poses.mjs';
const ONCE=new Set(['success','error','sending','receiving','acknowledge','stretch','shoulder_roll','wrist_relax']);
const MICRO=['stretch','shoulder_roll','wrist_relax'];
export class AmbientScheduler{
 constructor(ids){this.ids=ids;this.time=0;this.paused=false;this.owner=null;this.cursor=0;this.nextRest=18;this.vm={actors:[]};this.actors=Object.fromEntries(ids.map((id,i)=>[id,{id,index:i,signature:null,vm:{pose:'idle'},elapsed:0,nav:null,micro:null,nextMicro:6+i*2,microCount:0,restCount:0,interruptions:0,cycle:0,seen:new Set()}]));}
 setViewModel(vm){this.vm=vm;this.paused=!!vm.motionPaused;}
 startDemo(){this.nextRest=this.time+6;for(const a of Object.values(this.actors))a.nextMicro=this.time+a.index*1.4;}
 tick(dt){if(this.paused)return;dt=Math.max(0,Math.min(.06,dt));this.time+=dt;
  for(const a of Object.values(this.actors)){
   const incoming=this.vm.actors?.find(v=>v.agentId===a.id)??{pose:'idle'};let desired=STATES.includes(incoming.pose)?incoming.pose:'idle',signature=desired+':'+(incoming.cue??'');if(incoming.cue&&a.seen.has(incoming.cue)&&a.signature!==signature){desired=incoming.basePose??'idle';signature=desired+':';}
   if(signature!==a.signature){a.signature=signature;if(incoming.cue){a.seen.add(incoming.cue);if(a.seen.size>128)a.seen.delete(a.seen.values().next().value);}a.vm={...incoming,pose:desired};a.elapsed=0;if(desired!=='idle'){a.micro=null;if(a.nav&&!a.nav.returnPlan){a.nav.requestWork();a.interrupted=true;}}}else a.vm={...a.vm,...incoming,pose:desired};
   if(a.nav){a.nav.tick(dt);if((a.nav.mode==='typing'&&!a.nav.returnPlan)||a.nav.time>=21){if(a.interrupted)a.interruptions++;else a.restCount++;a.nav=null;a.interrupted=false;this.owner=null;this.nextRest=this.time+3;a.nextMicro=this.time+22;if(!ONCE.has(a.vm.pose))a.elapsed=0;}continue;}
   a.elapsed+=dt;if(a.micro){a.micro.time+=dt;if(a.micro.time>=CLIP_LENGTH[a.micro.state]){a.micro=null;a.microCount++;a.nextMicro=this.time+25+a.index*2;}}
   if(this.baseAction(a)==='idle'&&!a.micro&&this.time>=a.nextMicro){a.micro={state:MICRO[(a.index+a.microCount)%3],time:0};}
  }
  if(!this.owner&&this.time>=this.nextRest){for(let n=0;n<this.ids.length;n++){const index=(this.cursor+n)%this.ids.length,a=this.actors[this.ids[index]];if(this.baseAction(a)!=='idle'||a.nav)continue;if(a.micro)break;a.nav=new MotionClock();a.nav.play('tour');a.nav.time=1;a.cycle++;a.interrupted=false;this.owner=a.id;this.cursor=(index+1)%this.ids.length;break;}}
 }
 baseAction(a){return ONCE.has(a.vm.pose)&&a.elapsed>CLIP_LENGTH[a.vm.pose]?(a.vm.basePose??'idle'):a.vm.pose;}
 state(id){const a=this.actors[id];if(a.nav){const pose=a.nav.pose();return {action:pose.action,time:pose.time,pose,cycle:a.cycle,returning:!!a.nav.returnPlan,basePose:a.vm.pose};}if(a.micro)return{action:a.micro.state,time:a.micro.time};const action=ONCE.has(a.vm.pose)&&a.elapsed>CLIP_LENGTH[a.vm.pose]?(a.vm.basePose??'idle'):a.vm.pose;return{action,time:a.elapsed,lookAt:a.vm.lookAt};}
 diagnostics(){return {time:this.time,reservation:this.owner,actors:Object.fromEntries(this.ids.map(id=>[id,{...this.state(id),pose:undefined,restCount:this.actors[id].restCount,microCount:this.actors[id].microCount,interruptions:this.actors[id].interruptions}]))};}
 dispose(){this.owner=null;for(const a of Object.values(this.actors)){a.nav=null;a.micro=null;}}
}
