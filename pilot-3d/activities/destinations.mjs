import * as T from 'three';
import {prepareSofa} from './model.mjs';
import {SofaScheduler} from './scheduler.mjs';
import {ease} from '../sample/motion.mjs';
import {pointClear} from './anchors.mjs';
const W=(x,z)=>[x,0,z],angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
export const MEETING_SLOTS=[{position:W(2.50,2.95),cup:[2.96,.7425,2.74]},{position:W(4.45,3.03),cup:[4.05,.7425,2.72]}];
export function prepareDestinations(model,meta){
 const {seatBox}=prepareSofa(model);const sofa=model.getObjectByName('LinenSofa');
 // Both seats are usable; ornaments live on the outer arms instead of either lap.
 for(const [name,x] of [['LooseCushion',.98],['OchreLooseCushion',-.98]]){const n=model.getObjectByName(name);if(n){n.position.x=x;n.position.y=.76;n.scale.multiplyScalar(n.userData.activityScaled?1:.72);n.userData.activityScaled=true;}}
 const throwNode=model.getObjectByName('FoldedThrow');if(throwNode){throwNode.position.x=.98;throwNode.position.y=.66;throwNode.scale.x=.55;}
 const rugNode=model.getObjectByName('WovenRug'),rug=new T.Box3().setFromObject(rugNode);const surface={x:(rug.min.x+rug.max.x)/2,z:(rug.min.z+rug.max.z)/2,rx:(rug.max.x-rug.min.x)/2,rz:(rug.max.z-rug.min.z)/2,top:rug.max.y};
 const meetingRug=new T.Box3().setFromObject(model.getObjectByName('MeetingWovenRug')),meetingSurface={x:(meetingRug.min.x+meetingRug.max.x)/2,z:(meetingRug.min.z+meetingRug.max.z)/2,rx:(meetingRug.max.x-meetingRug.min.x)/2,rz:(meetingRug.max.z-meetingRug.min.z)/2,top:meetingRug.max.y};
 const extraColliders=[];for(const name of ['PlantSpecies0','PlantSpecies1','PlantSpecies2']){const box=new T.Box3().setFromObject(model.getObjectByName(name));extraColliders.push({id:name,min:[box.min.x,box.min.z],max:[box.max.x,box.max.z]});}
 const book={sofa:[{x:-3.08,z:-2.78},{x:-2.12,z:-2.78}],meeting:MEETING_SLOTS,surface,hip:seatBox.max.y+.105};
 // Author both destination approaches; no route crosses another person's desk chair.
 book.anchors=(id,kind,slot=0)=>{
  const station=model.getObjectByName(meta.bindings[id].actor).parent,origin=station.getWorldPosition(new T.Vector3()).toArray(),local=p=>[p[0]-origin[0],p[1]??0,p[2]-origin[2]];
  const [x,,z]=origin,start=W(x,z-.48),left=x-1.05,right=x+1.05;
  let common=id==='leo'?[start,W(right,z-.48),W(3.55,z-.48),W(3.55,-2.30)]:id==='min'?[start,W(left,z-.48),W(-3.55,z-.48),W(-3.55,-2.30)]:[start,W(left,z-.48),W(left,-2.30)];
  let end,stand,seated,facing=0,hip=book.hip,footOffset=0;
  if(kind==='sofa'){
   const seat=book.sofa[slot];end=W(seat.x,-2.30);common.push(W(seat.x,-2.30));stand=W(seat.x,-2.33);seated=W(seat.x,seat.z);
  }else{
   // Return down the right outer aisle, then use independent west/east approaches.
   common.push(W(3.55,-2.30),W(3.55,1.43));
   seated=MEETING_SLOTS[slot].position;facing=Math.atan2(3.5-seated[0],2.45-seated[2]);stand=W(seated[0]+Math.sin(facing)*.20,seated[2]+Math.cos(facing)*.20);end=stand;
   if(slot===0)common.push(W(2.40,1.43),W(2.40,2.65),end);else common.push(W(4.50,1.43),W(4.50,2.60),end);
   hip=.505;footOffset=0;
  }
  const route=common.filter((p,i)=>!i||Math.hypot(p[0]-common[i-1][0],p[2]-common[i-1][2])>.001).map(local);
  return {route,stand:local(stand),seated:local(seated),hip,rug:surface,surfaces:[surface,meetingSurface],stationOrigin:origin,seat:kind+'-'+slot,kind,slot,facing,footOffset,colliders:[...meta.colliders.map(c=>c.id==='meeting'?{id:c.id,center:[3.5,2.45],radius:.68}:c),...extraColliders,...meta.actorIds.filter(other=>other!==id).map(other=>{const p=meta.workspaces[other];return{id:other+'-seated-chair',min:[p[0]-.25,p[2]-.80],max:[p[0]+.25,p[2]-.40]};})],clearance:.225};
 };
 return book;
}
export function validateDestinationRoute(anchors){
 const points=anchors.route;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],distance=Math.hypot(b[0]-a[0],b[2]-a[2]),steps=Math.ceil(distance/.01);for(let j=0;j<=steps;j++){const u=j/steps,p=[a[0]+(b[0]-a[0])*u+anchors.stationOrigin[0],0,a[2]+(b[2]-a[2])*u+anchors.stationOrigin[2]];if(!pointClear(p,anchors.colliders,anchors.clearance))throw Error('목적지 경로 충돌: '+JSON.stringify(p));}}
 return true;
}
export class DestinationTrip extends SofaScheduler {
 rawPose(){const a=this.anchors,p=super.rawPose(),t=this.elapsed;
  if(['align','deskTurn'].includes(this.stage)&&this.stage==='align'){p.yaw=angle(this.turnFrom,a.facing,ease(t/.7));p.feet=[-.1,.1].map((side,i)=>{const u=i===0?Math.min(1,t/.35):Math.max(0,(t-.35)/.35),yaw=angle(this.turnFrom,a.facing,ease(u));return{position:[p.x+Math.cos(yaw)*side,.085+Math.sin(Math.PI*u)*.025,p.z-Math.sin(yaw)*side],planted:u===0||u===1};});}
  if(['back','forward','sit','rest','rise'].includes(this.stage)){
   p.yaw=a.facing;const isStep=this.stage==='back'||this.stage==='forward',u=isStep?(this.stage==='back'?ease(t/.8):1-ease(t/.8)):1;
   const endFoot=[a.stand[0]+Math.sin(a.facing)*a.footOffset,0,a.stand[2]+Math.cos(a.facing)*a.footOffset];
   p.feet=[-.1,.1].map(side=>({position:[a.stand[0]+(endFoot[0]-a.stand[0])*u+Math.cos(a.facing)*side,.085,a.stand[2]+(endFoot[2]-a.stand[2])*u-Math.sin(a.facing)*side],planted:!isStep}));

  }
  return p;
 }
}
