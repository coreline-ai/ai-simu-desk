// A presentation event from already-public output. Never predicts or advances a job.
export function teamStages(run) {
  const stages=run?.team&&run.answerMeta?.team?.stages;
  return Array.isArray(stages)&&stages.length===5&&stages.every((s,i)=>['nara','sora','jun','min','leo'].includes(s.agentId)&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start&&(i===0||s.start===stages[i-1].end))?stages:[];
}
export function publicHandoff(run) {
  if(!['running','succeeded'].includes(run?.status))return null;
  const stages=teamStages(run),length=run.output?.length??0;
  const index=stages.slice(0,-1).findLastIndex(s=>length>=s.end);
  if(index<0)return null;
  const from=stages[index],to=stages[index+1];
  const section=run.output.slice(from.start,from.end);
  const summary=(section.split('\n').find(line=>line.startsWith('• '))??section.split('\n')[0]??'').replace(/^• /,'');
  return {runId:run.id,from:from.agentId,to:to.agentId,title:from.title,boundary:from.end,index,summary:summary.length>140?summary.slice(0,139)+'…':summary};
}
export function createHandoffTracker() {
  let previous=null;
  return {
    observe(spaceId,run,{animate=true,continuous=true}={}) {
      if(!run){previous=null;return null;}
      const next={spaceId,id:run.id,version:run.version??0,length:run.output?.length??0,status:run.status};
      const same=previous?.spaceId===spaceId&&previous?.id===run.id;
      if(same&&(next.version<previous.version||next.length<previous.length))return null;
      const old=previous;previous=next;
      if(!same||!continuous||!animate||old.status!=='running'||run.status!=='running')return null;
      const event=publicHandoff(run);
      return event&&old.length<event.boundary?{...event,key:`${spaceId}:${run.id}:${event.boundary}`} : null;
    },
    reset(){previous=null;},
  };
}
