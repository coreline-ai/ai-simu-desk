import * as T from 'three';
import {validateDestinationRoute} from './destinations.mjs';
// Authored aisles already used by v5. A visitor occupies a side approach, never
// the host's chair or the gap between the host and the screen.
export function prepareVisits(model,meta,destinations){
  const result=new Map(),availability=[];
  const approach=id=>{const [x,,z]=meta.workspaces[id],side=id==='leo'?1:-1,edge=x+side*1.05,start=[x,0,z-.48],port=[edge,0,z-.48];return id==='min'||id==='leo'?[start,port,[side*3.55,0,z-.48],[side*3.55,0,-2.30]]:[start,port,[edge,0,-2.30]];};
  for(const visitor of meta.actorIds)for(const host of meta.actorIds){if(visitor===host)continue;
    const key=visitor+':'+host,from=approach(visitor),to=approach(host),origin=meta.workspaces[visitor],end=to[1],hostOrigin=meta.workspaces[host],local=p=>[p[0]-origin[0],p[1],p[2]-origin[2]];
    const route=[...from,...to.slice(1).toReversed()].filter((p,i,all)=>!i||new T.Vector3(...p).distanceTo(new T.Vector3(...all[i-1]))>.001).map(local),base=destinations.anchors(visitor,'sofa',0);
    const anchors={...base,route,stand:local(end),seated:local(end),facing:Math.atan2(hostOrigin[0]-end[0],hostOrigin[2]+.15-end[2]),seat:'visit-'+host,kind:'visit',clearance:.225,hostSide:host==='leo'?'R':'L',visitorSide:host==='leo'?'L':'R'};
    try{validateDestinationRoute(anchors);result.set(key,anchors);availability.push({visitor,host,available:true,position:end});}catch(e){availability.push({visitor,host,available:false,reason:e.message});}
  }
  return{anchors:result,availability};
}
