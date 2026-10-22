export function cameraEvent(s){
 if(s?.huddles?.current)return s.huddles.current.review?{key:'review',point:[0,1,.1],offset:[-4,3.8,-6],zoom:1.8}:{key:'huddle',point:[0,.8,-.2],zoom:1.55};
 if(s?.group?.current||s?.session)return{key:'meeting',point:[-3.45,.75,2.6],zoom:1.65};
 const coffee=s?.coffee?.rows.values().next().value;if(coffee)return{key:'actor-'+coffee.id,actor:coffee.id};
 const r=[...(s?.records.values()??[])].find(r=>r.trip&&r.trip.stage!=='queued');return r?{key:'actor-'+r.id,actor:r.id}:{key:'room'};
}
export function frameCameraEvent(summary){
 const actors=summary?.actors??[];
 if(actors.some(a=>a.kind==='review'))return{key:'review',point:[0,1,.1],offset:[-4,3.8,-6],zoom:1.8};
 if(actors.some(a=>a.kind==='huddle'))return{key:'huddle',point:[0,.8,-.2],zoom:1.55};
 if(actors.some(a=>['group','meeting'].includes(a.kind)))return{key:'meeting',point:[-3.45,.75,2.6],zoom:1.65};
 const actor=actors.find(a=>['coffee','window','sofa','visit'].includes(a.kind));return actor?{key:'actor-'+actor.id,actor:actor.id}:{key:'room'};
}
