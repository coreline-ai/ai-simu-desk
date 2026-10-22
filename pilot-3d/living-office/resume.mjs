const work=pose=>pose&&pose!=='idle';
// Intent survives cleanup, not props or reservations. Resuming always goes
// through the normal start methods and reacquires every destination safely.
export class ActivityResume{
  constructor(s){this.s=s;this.pending=new Map();this.history=[];this.attempts=new Map();}
  capture(vm){
    for(const id of this.s.ids){
      const incoming=vm.actors?.find(a=>a.agentId===id);if(!incoming||!work(incoming.pose)||work(this.s.rawIncoming(id).pose)||this.pending.has(id))continue;
      const r=this.s.records.get(id),coffee=this.s.coffee.rows.get(id);let kind,remaining=0;
      if(r&&!r.trip?.returning&&!r.interrupted&&!this.s.sofaPair?.ids.includes(id)){
        if(r.kind==='sofa'){kind='sofa';remaining=(r.trip.options.restDuration??20)-(r.trip.stage==='rest'?r.trip.elapsed:0);}
        if(r.kind==='window'){kind='window';remaining=14-(r.trip.stage==='rest'?r.trip.elapsed:0);}
        if(r.kind==='micro'){kind='rest';remaining=8-r.elapsed;}
      }else if(coffee&&!coffee.ending&&!coffee.brewed){kind='coffee';remaining=1;}
      const attempts=this.attempts.get(id)??0;
      if(kind&&(kind==='coffee'||remaining>=2)&&attempts<2){this.pending.set(id,{kind,remaining:Math.max(2,remaining),created:this.s.time,expires:this.s.time+600,readyAt:null,attempts:attempts+1});}
    }
  }
  tick(){
    for(const[id,r]of this.pending){
      if(!this.s.vm.actors?.some(a=>a.agentId===id)||this.s.time>=r.expires){this.pending.delete(id);continue;}
      if(work(this.s.rawIncoming(id).pose)||!this.s.idle(id)){r.readyAt=null;continue;}
      r.readyAt??=this.s.time+2;if(this.s.time<r.readyAt)continue;
      const started={sofa:()=>this.s.startSofa(id),window:()=>this.s.startWindow(id),rest:()=>this.s.startRest(id),coffee:()=>this.s.startCoffee(id)}[r.kind]();
      if(!started)continue;
      const active=this.s.records.get(id);if(active?.kind==='sofa')active.trip.options.restDuration=r.remaining;
      if(active?.kind==='window')active.resumeRemaining=r.remaining;
      if(active?.kind==='micro')active.exitAt=Math.max(3,r.remaining);
      this.attempts.set(id,r.attempts);this.history.push({id,kind:r.kind,remaining:r.remaining,at:this.s.time});if(this.history.length>30)this.history.shift();this.pending.delete(id);
    }
    // A bounded continuation chain resets after a genuinely quiet interval.
    for(const[id]of this.attempts)if(!this.pending.has(id)&&!this.s.presentationBusy(id)&&this.s.rawIncoming(id).pose==='idle'&&this.s.time-(this.history.findLast(r=>r.id===id)?.at??0)>120)this.attempts.delete(id);
  }
  clear(){this.pending.clear();this.attempts.clear();}
  diagnostics(){return{pending:[...this.pending].map(([id,r])=>({id,...r})),history:[...this.history]};}
}
