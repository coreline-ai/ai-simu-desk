// One ID per workspace visit; never reuse a tab ID after a best-effort leave.
export function createPresenceClient({request,beacon,onChange,newId=()=>crypto.randomUUID()}) {
  let visit=null,latest=null;
  function stop() {
    const old=visit;visit=null;latest=null;
    if(old) beacon(`/api/workspaces/${old.workspaceId}/presence/leave`,{clientId:old.clientId});
    onChange(null);
  }
  function start(workspaceId,shared) {stop();if(shared)visit={workspaceId,clientId:newId()};}
  async function refresh() {
    const ticket=visit;if(!ticket)return;
    try {
      const data=await request(`/api/workspaces/${ticket.workspaceId}/presence`,{clientId:ticket.clientId});
      if(visit!==ticket)return;
      latest=data;onChange(data);
    } catch(error) {
      if(visit!==ticket)return;
      latest=null;onChange(null);
      if(error.code==="PRESENCE_CLOSED")visit={workspaceId:ticket.workspaceId,clientId:newId()};
      throw error;
    }
  }
  function disconnected() {latest=null;onChange(null);}
  return {start,stop,refresh,disconnected,get current(){return latest;}};
}
export function presencePresentation(members,data) {
  const states=new Map(data?.members.map(p=>[p.userId,p.online])??[]);
  return {online:data ? members.filter(p=>states.get(p.userId)===true).length : null,
    members:members.map(p=>({...p,status:!data||!states.has(p.userId)?"unknown":states.get(p.userId)?"online":"offline"})),events:data?.events??[]};
}
