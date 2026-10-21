import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from './interactions.mjs';
const V=()=>new T.Vector3();
export function segmentDistance(a,b,c,d){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),den=aa*cc-bb*bb;
 let s=0,t=0;
 if(aa<=1e-12)t=cc>1e-12?T.MathUtils.clamp(ee/cc,0,1):0;
 else if(cc<=1e-12)s=T.MathUtils.clamp(-dd/aa,0,1);
 else{s=den>1e-12?T.MathUtils.clamp((bb*ee-cc*dd)/den,0,1):0;t=(bb*s+ee)/cc;if(t<0){t=0;s=T.MathUtils.clamp(-dd/aa,0,1);}else if(t>1){t=1;s=T.MathUtils.clamp((bb-dd)/aa,0,1);}}
 return a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t));
}
// Exact distance from a segment to an AABB, using its piecewise quadratic intervals.
export function segmentBoxDistance(a,b,box){
 const delta=b.clone().sub(a),cuts=[0,1];for(const axis of ['x','y','z'])if(Math.abs(delta[axis])>1e-12)for(const edge of [box.min[axis],box.max[axis]]){const t=(edge-a[axis])/delta[axis];if(t>0&&t<1)cuts.push(t);}cuts.sort((a,b)=>a-b);
 let best=Infinity;const at=t=>{const p=a.clone().addScaledVector(delta,t);return p.distanceToSquared(box.clampPoint(p,V()));};
 for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2;let q=0,r=0;for(const axis of ['x','y','z']){const x=a[axis]+delta[axis]*mid,edge=x<box.min[axis]?box.min[axis]:x>box.max[axis]?box.max[axis]:null;if(edge!==null){q+=delta[axis]**2;r+=delta[axis]*(a[axis]-edge);}}best=Math.min(best,at(lo),at(hi),at(q?T.MathUtils.clamp(-r/q,lo,hi):mid));}return Math.sqrt(best);
}
export class BodyContacts{
 constructor(model,actors,scheduler){
  this.actors=actors;this.scheduler=scheduler;this.time=0;this.next=0;this.samples=0;this.rows=[];this.peak=0;this.furniture=[];this.elbows=new Map();this.hands=new Map();model.updateMatrixWorld(true);
  model.traverse(node=>{if(node.isMesh&&/OakDeskTop$|^MeetingTop$|^SofaBack$|^SofaBase$/.test(node.name))this.furniture.push({name:node.name,box:new T.Box3().setFromObject(node)});if(node.isInstancedMesh&&node.name.startsWith('LinenSofa_Instances_17')){node.geometry.computeBoundingBox();for(let i=0;i<node.count;i++){const matrix=new T.Matrix4();node.getMatrixAt(i,matrix);matrix.premultiply(node.matrixWorld);this.furniture.push({name:'sofa-armrest-'+i,box:node.geometry.boundingBox.clone().applyMatrix4(matrix)});}}});
 }
 clearDeskArms(id,actor,dt=.025){
  const prefix=actor.userData.prefix??'Nara',desk=this.furniture.find(row=>row.name===prefix+'OakDeskTop');if(!desk)return;
  for(const side of ['L','R']){
   const shoulder=part(actor,'NaraShoulder'+side).getWorldPosition(V()),elbow=part(actor,'NaraElbow'+side).getWorldPosition(V()),hand=part(actor,'NaraHand'+side),key=id+'/'+side,q=hand.getWorldQuaternion(new T.Quaternion());let point=hand.getWorldPosition(V());
   const s=this.scheduler,controlled=side==='R'&&s.desks[id].busy||side==='L'&&!['idle','tableRest'].includes(s.cups[id].state)||s.transfer?.controls(id)?.side===side||s.sofaSupport?.rows.get(id)?.diagnostic[side]||s.meetingSupport?.rows.get(id)?.hands[side],previous=this.hands.get(key);
   if(!controlled){if(point.x>desk.box.min.x-.04&&point.x<desk.box.max.x+.04&&point.z>desk.box.min.z-.04&&point.z<desk.box.max.z+.04)point.y=Math.max(point.y,desk.box.max.y+.055);if(previous){const frame=actor.getWorldQuaternion(new T.Quaternion()),local=actor.worldToLocal(point.clone()),delta=local.clone().sub(previous.point),distance=delta.length();if(distance>dt)local.copy(previous.point).addScaledVector(delta,dt/distance);point=actor.localToWorld(local);const localQ=frame.clone().invert().multiply(q),angle=previous.q.angleTo(localQ);if(angle>0)localQ.copy(previous.q).slerp(frame.clone().invert().multiply(q),Math.min(1,dt*6/angle));q.copy(frame).multiply(localQ);}}
   // Free hands may ease within reach; never project an owned prop/surface target.
   if(!controlled){const delta=point.clone().sub(shoulder),length=delta.length(),reach=part(actor,'NaraElbow'+side).position.length()+hand.position.length()-.003;point=shoulder.clone().addScaledVector(delta,T.MathUtils.clamp(length,.03,reach)/(length||1));}
   const axis=point.clone().sub(shoulder).normalize();
   const blocked=segmentBoxDistance(elbow,point,desk.box)<.032||segmentBoxDistance(shoulder,elbow,desk.box)<.045,to=(blocked?new T.Vector3(side==='L'?-1:1,.5,-.5).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())):elbow.clone().sub(shoulder));to.addScaledVector(axis,-to.dot(axis)).normalize();
   if(to.lengthSq()<1e-8){to.set(Math.abs(axis.y)<.9?0:1,Math.abs(axis.y)<.9?1:0,0);to.addScaledVector(axis,-to.dot(axis)).normalize();}const from=this.elbows.has(key)?actor.localToWorld(this.elbows.get(key).clone()).sub(shoulder):to.clone();from.addScaledVector(axis,-from.dot(axis)).normalize();if(from.lengthSq()<1e-8)from.copy(to);
   const angle=Math.atan2(axis.dot(from.clone().cross(to)),from.dot(to)),pole=from.applyAxisAngle(axis,T.MathUtils.clamp(angle,-3.5*dt,3.5*dt));solveArm(actor,point,q,side,pole);this.elbows.set(key,actor.worldToLocal(part(actor,'NaraElbow'+side).getWorldPosition(V())));this.hands.set(key,{point:actor.worldToLocal(hand.getWorldPosition(V())),q:actor.getWorldQuaternion(new T.Quaternion()).invert().multiply(hand.getWorldQuaternion(new T.Quaternion()))});
  }
 }
 update(dt){this.time+=dt;if(this.time+1e-9<this.next)return;this.next=this.time+.05;this.samples++;const bodies=[],arms=[],rows=[];
  for(const[id,actor]of Object.entries(this.actors)){
   actor.updateWorldMatrix(true,true);const torso=part(actor,'NaraTorso'),center=torso.getWorldPosition(V()),axis=V().set(0,1,0).applyQuaternion(torso.getWorldQuaternion(new T.Quaternion()));bodies.push({id,name:'torso',a:center.clone().addScaledVector(axis,-.10),b:center.clone().addScaledVector(axis,.10),radius:.12});
   for(const side of ['L','R']){const shoulder=part(actor,'NaraShoulder'+side).getWorldPosition(V()),elbow=part(actor,'NaraElbow'+side).getWorldPosition(V()),hand=part(actor,'NaraHand'+side).getWorldPosition(V());arms.push({id,name:'upper'+side,a:shoulder,b:elbow,radius:.045},{id,name:'forearm'+side,a:elbow,b:elbow.clone().lerp(hand,.82),radius:.032},{id,name:'wrist'+side,a:elbow.clone().lerp(hand,.82),b:hand,radius:.016});}
  }
  const add=(a,target,gap)=>{if(!Number.isFinite(gap))throw Error('Invalid body contact measurement');if(gap<0)rows.push({actor:a.id,part:a.name,target,gap,depth:-gap,classification:gap<-.025?'deep-proxy-overlap':'near-proxy-overlap'});};
  for(const arm of arms){for(const body of bodies)if(arm.id!==body.id||/forearm|wrist/.test(arm.name))add(arm,body.id+':torso',segmentDistance(arm.a,arm.b,body.a,body.b)-arm.radius-body.radius);for(const item of this.furniture)add(arm,item.name,segmentBoxDistance(arm.a,arm.b,item.box)-arm.radius);}
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)add(bodies[i],bodies[j].id+':torso',segmentDistance(bodies[i].a,bodies[i].b,bodies[j].a,bodies[j].b)-bodies[i].radius-bodies[j].radius);
  for(const body of bodies)for(const item of this.furniture)add(body,item.name,segmentBoxDistance(body.a,body.b,item.box)-body.radius);
  this.rows=rows;this.peak=Math.max(this.peak,...rows.map(r=>r.depth));
 }
 diagnostics(){return{scope:'conservative-arm-capsules-torso-capsules-and-solid-furniture-AABBs',sampleInterval:.05,samples:this.samples,rows:this.rows.map(r=>({...r})),peakProxyDepth:this.peak,checkedFurniture:this.furniture.map(f=>f.name),physicalSkinGuarantee:false};}
 dispose(){this.rows=[];this.actors={};this.furniture=[];this.elbows.clear();this.hands.clear();}
}
