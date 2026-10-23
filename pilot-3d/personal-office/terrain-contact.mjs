import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
const cell=.5,key=(x,z)=>Math.floor(x/cell)+':'+Math.floor(z/cell);
// Static upward-facing triangles; the rounded rug boundary stays the real mesh
// boundary rather than a rectangular/elliptical approximation.
export class TerrainContact{
 constructor(model,actors){
  model.updateWorldMatrix(true,true);this.cells=new Map();this.actors=new Map();
  model.traverse(m=>{if(!m.isMesh||!/(?:^RoomFloor$|WovenRug$|WoolRug$)/.test(m.name))return;const pos=m.geometry.attributes.position,index=m.geometry.index,count=index?.count??pos.count;for(let i=0;i<count;i+=3){const p=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j).applyMatrix4(m.matrixWorld));const [a,b,c]=p,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(den>=-1e-10)continue;const row={a,b,c,den};for(let x=Math.floor(Math.min(...p.map(v=>v.x))/cell);x<=Math.floor(Math.max(...p.map(v=>v.x))/cell);x++)for(let z=Math.floor(Math.min(...p.map(v=>v.z))/cell);z<=Math.floor(Math.max(...p.map(v=>v.z))/cell);z++){const k=x+':'+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(row);}}});
  if(!this.cells.size)throw Error('실제 바닥 접촉 형상 누락');
  for(const [id,actor]of Object.entries(actors)){const station=actor.parent,points=['L','R'].map(side=>{const foot=part(actor,'NaraFoot'+side),sole=part(actor,'Sole'+side),matrix=foot.matrixWorld.clone().invert().multiply(sole.matrixWorld),pos=sole.geometry.attributes.position,unique=new Map();for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);unique.set(p.toArray().map(n=>n.toFixed(7)).join(':'),p);}return [...unique.values()];});this.actors.set(id,{last:[null,null],matrix:station.matrixWorld.clone(),inverse:station.matrixWorld.clone().invert(),points});}
 }
 height(x,z){let height=-Infinity;for(const {a,b,c,den}of this.cells.get(key(x,z))??[]){const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)height=Math.max(height,u*a.y+v*b.y+(1-u-v)*c.y);}return height;}
 correct(id,p){const actor=this.actors.get(id);if(!actor||!p.feet)return p;const yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.yaw??0);const feet=p.feet.map((f,i)=>{const q=yaw.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(f.pitch??0,f.yaw??0,0,'YXZ'))),position=new T.Vector3(...f.position),signature=[p.yaw??0,f.pitch??0,f.yaw??0,f.planted,...f.position].join(':');let gap=actor.last[i]?.signature===signature?actor.last[i].gap:Infinity;if(!Number.isFinite(gap))for(const point of actor.points[i]){const v=point.clone().applyQuaternion(q).add(position).applyMatrix4(actor.matrix),h=this.height(v.x,v.z);if(Number.isFinite(h))gap=Math.min(gap,v.y-h);}if(!Number.isFinite(gap))return f;actor.last[i]={signature,gap};const shift=f.planted?.001-gap:Math.max(0,.001-gap);if(Math.abs(shift)<1e-8)return f;const delta=new T.Vector3(0,shift,0).applyMatrix3(new T.Matrix3().setFromMatrix4(actor.inverse));
   return{...f,rotationOrder:'YXZ',position:position.add(delta).toArray(),...(f.supportPoint?{supportPoint:[f.supportPoint[0],f.supportPoint[1]+delta.y,f.supportPoint[2]]}: {})};});
  const pose={...p,feet};for(const[i,f]of feet.entries()){const dx=f.position[0]-p.x,dz=f.position[2]-p.z,x=Math.cos(p.yaw)*dx-Math.sin(p.yaw)*dz-(i===0?-.1:.1)-(p.pelvisX??0),z=Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dz-(p.pelvisZ??0);pose.hip=Math.min(pose.hip,f.position[1]+Math.sqrt(Math.max(0,.773**2-x*x-z*z)));}return pose;
 }
 dispose(){this.cells.clear();this.actors.clear();}
}
