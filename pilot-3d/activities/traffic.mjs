import {Reservations} from './reservations.mjs';
// Conservative whole-journey look-ahead over shared spatial cells. An actor
// waits at its desk/seat, never holding a narrow aisle while waiting for another.
export class CorridorReservations extends Reservations{
 constructor(){super();this.paths=new Map();this.clock=0;this.since=new Map();this.peak=0;this.maxWait=0;this.grants=0;this.simultaneous=0;}
 register(owner,anchors){const origin=anchors.stationOrigin,points=[...anchors.route,anchors.stand,anchors.seated].map(p=>[p[0]+origin[0],p[2]+origin[2]]),cells=new Set(),grid=.4,radius=.5+grid*Math.SQRT2/2;
  for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05));for(let j=0;j<=steps;j++){const x=a[0]+(b[0]-a[0])*j/steps,z=a[1]+(b[1]-a[1])*j/steps;for(let gx=Math.floor((x-radius)/grid);gx<=Math.ceil((x+radius)/grid);gx++)for(let gz=Math.floor((z-radius)/grid);gz<=Math.ceil((z+radius)/grid);gz++)if(Math.hypot(gx*grid-x,gz*grid-z)<=radius)cells.add('corridor:'+gx+':'+gz);}}
  this.paths.set(owner,[...cells]);
 }
 resources(actor,keys){if(!keys.includes('walkway'))return keys;const held=[0,1].find(i=>this.owners.get('walkway-'+i)===actor),slot=held??[0,1].find(i=>!this.owners.has('walkway-'+i));if(slot===undefined)return null;return[...keys.filter(k=>k!=='walkway'),'walkway-'+slot,...(this.paths.get(actor)??[])];}
 request(actor,keys,priority=1){if(!keys.includes('walkway'))return super.request(actor,keys,priority);if(!this.paths.has(actor))return false;
  if(!this.since.has(actor))this.since.set(actor,this.clock);
  if(!this.waiting.some(q=>q.actor===actor))this.waiting.push({actor,resources:[...keys],priority});
  const eligible=this.waiting.map(q=>({...q,expanded:this.resources(q.actor,q.resources),rank:q.priority-Math.floor((this.clock-(this.since.get(q.actor)??this.clock))/20)})).filter(q=>q.expanded&&q.expanded.every(k=>!this.owners.has(k)||this.owners.get(k)===q.actor)).sort((a,b)=>a.rank-b.rank||(this.since.get(a.actor)??0)-(this.since.get(b.actor)??0));
  if(eligible[0]?.actor!==actor)return false;const expanded=eligible[0].expanded;if(!this.acquire(actor,expanded))return false;this.waiting=this.waiting.filter(q=>q.actor!==actor);this.maxWait=Math.max(this.maxWait,this.clock-this.since.get(actor));this.since.delete(actor);this.grants++;const active=[0,1].filter(i=>this.owners.has('walkway-'+i)).length;this.peak=Math.max(this.peak,active);if(active===2)this.simultaneous++;return true;
 }
 releaseKeys(actor,keys){super.releaseKeys(actor,keys);if(keys.includes('walkway'))super.releaseKeys(actor,[...this.owners.keys()].filter(k=>k.startsWith('corridor:')||k.startsWith('walkway-')));}
 release(actor){super.release(actor);this.since.delete(actor);this.paths.delete(actor);}
 snapshot(){return Object.fromEntries([...this.owners].filter(([key])=>!key.startsWith('corridor:')));}
 diagnostics(){return{policy:'atomic-corridors',capacity:2,radius:.5,grid:.4,active:[0,1].map(i=>this.owners.get('walkway-'+i)).filter(Boolean),peak:this.peak,simultaneousGrants:this.simultaneous,grants:this.grants,maxWait:this.maxWait,waiting:this.waiting.map(q=>({owner:q.actor,seconds:this.clock-(this.since.get(q.actor)??this.clock)}))};}
 clear(){super.clear();this.paths.clear();this.since.clear();}
}
// Visitors remain physical obstacles while the walking slot is free. Keep the
// side approach blocked until the same owner has acquired its return journey.
export class VisitCorridors extends CorridorReservations{
 constructor(){super();this.spots=new Map();}
 holdSpot(owner,point){const radius=.5+.4*Math.SQRT2/2,cells=new Set();for(let x=Math.floor((point[0]-radius)/.4);x<=Math.ceil((point[0]+radius)/.4);x++)for(let z=Math.floor((point[2]-radius)/.4);z<=Math.ceil((point[2]+radius)/.4);z++)if(Math.hypot(x*.4-point[0],z*.4-point[2])<=radius)cells.add('corridor:'+x+':'+z);this.spots.set(owner,cells);}
 resources(owner,keys){const expanded=super.resources(owner,keys);return expanded&&[...this.spots].every(([other,cells])=>other===owner||!expanded.some(k=>cells.has(k)))?expanded:null;}
 release(owner){super.release(owner);this.spots.delete(owner);}
 diagnostics(){return{...super.diagnostics(),stationary:[...this.spots.keys()]};}
 clear(){super.clear();this.spots.clear();}
}
