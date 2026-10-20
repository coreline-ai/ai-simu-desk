import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),DOWN=V(0,-1,0),IDENTITY=new T.Quaternion();
function worldPose(node){return {position:node.getWorldPosition(V()),quaternion:node.getWorldQuaternion(new T.Quaternion())};}
function setWorld(node,p,q){node.parent.updateWorldMatrix(true,false);node.position.copy(node.parent.worldToLocal(p.clone()));node.quaternion.copy(node.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(q);node.updateWorldMatrix(false,true);}
export function solveArm(actor,target,worldQuaternion,side='L'){
 const shoulder=part(actor,'NaraShoulder'+side),elbow=part(actor,'NaraElbow'+side),hand=part(actor,'NaraHand'+side);
 actor.updateWorldMatrix(true,true);const start=shoulder.getWorldPosition(V()),delta=target.clone().sub(start),distance=delta.length(),upper=elbow.position.length(),lower=hand.position.length();
 if(distance>upper+lower-.001||distance<.025)throw Error(`컵 손 도달 범위 오류: ${distance.toFixed(3)}`);
 const axis=delta.clone().normalize(),pole=V(side==='L'?-1:1,.15,.25).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())),bend=pole.addScaledVector(axis,-pole.dot(axis)).normalize(),along=(upper*upper-lower*lower+distance*distance)/(2*distance),mid=start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
 const upperQ=new T.Quaternion().setFromUnitVectors(DOWN,mid.clone().sub(start).normalize());shoulder.quaternion.copy(shoulder.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(upperQ);shoulder.updateWorldMatrix(false,true);
 const lowerQ=new T.Quaternion().setFromUnitVectors(hand.position.clone().normalize(),target.clone().sub(mid).normalize());elbow.quaternion.copy(elbow.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(lowerQ);elbow.updateWorldMatrix(false,true);
 hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(worldQuaternion);hand.updateWorldMatrix(false,true);
 return hand.getWorldPosition(V()).distanceTo(target);
}
function gripMesh(hand){
 let grip=hand.getObjectByName('ActivityCupGrip');if(grip)return grip;
 const skin=hand.children.find(n=>n.material)?.material??new T.MeshStandardMaterial({color:0xe7b997,roughness:.86});const pieces=[];
 const palm=new T.SphereGeometry(1,12,8);palm.scale(.041,.043,.026);pieces.push(palm);
 // Curled fingers follow the handle opening. One merged mesh, no runtime mesh churn.
 for(let i=0;i<4;i++){const finger=new T.TorusGeometry(.018,.007,5,10,Math.PI*1.55);finger.rotateY(Math.PI/2);finger.translate(-.008,-.026+i*.014,.016);pieces.push(finger);}
 const thumb=new T.CapsuleGeometry(.010,.028,3,8);thumb.rotateZ(-.55);thumb.translate(-.028,.003,.020);pieces.push(thumb);
 const merged=mergeGeometries(pieces.map(g=>g.toNonIndexed()));for(const g of pieces)g.dispose();grip=new T.Mesh(merged,skin);grip.name='ActivityCupGrip';grip.visible=false;grip.castShadow=true;hand.add(grip);return grip;
}
export class CupInteraction {
 constructor(model,actor,id){this.actor=actor;this.id=id;this.hand=part(actor,'NaraHandL');this.mug=model.getObjectByName(actor.userData.prefix+'CeramicMug');if(!this.mug)throw Error('컵 소품 누락: '+id);
  this.homeParent=this.mug.parent;this.mug.position.set(-.30,.785,-.20);this.home=this.mug.position.clone();this.grip=gripMesh(this.hand);this.open=this.hand.children.filter(n=>n!==this.grip);this.state='idle';this.time=0;this.total=0;this.owner='desk';this.events=0;this.done=0;this.reachError=0;this.returning=false;this.carryOnly=false;this.disposed=false;}
 get busy(){return this.state!=='idle'&&this.state!=='carry';}
 start({carry=false}={}){if(this.disposed||this.state!=='idle'||this.owner!=='desk')return false;this.carryOnly=carry;this.returning=false;this.enter('reach');return true;}
 enter(state){this.state=state;this.time=0;this.from=worldPose(this.mug);this.handFrom=worldPose(this.hand);}
 requestWork(){if(this.state==='idle')return;this.returning=true;if(['reach','grasp'].includes(this.state)&&this.owner==='desk')this.enter('retract');else if(['lift','sip','lower'].includes(this.state))this.enter('place');}
 holdPoint(){const pelvis=part(this.actor,'NaraPelvis');return this.actor.localToWorld(V(-.14,pelvis.position.y+.26,.29));}
 homePose(){this.homeParent.updateWorldMatrix(true,false);return {position:this.homeParent.localToWorld(this.home.clone()),quaternion:this.homeParent.getWorldQuaternion(new T.Quaternion())};}
 releaseToDesk(){this.homeParent.attach(this.mug);this.mug.position.copy(this.home);this.mug.quaternion.identity();this.owner='desk';this.events++;this.setGrip(false);}
 setGrip(value){for(const node of this.open)node.visible=!value;this.grip.visible=value;}
 tick(dt){if(this.disposed)return;dt=Math.max(0,Math.min(.06,dt));this.total+=dt;if(this.state==='idle'||this.state==='carry')return;this.time+=dt;
  if(this.state==='tableRest'){if(this.retrieve)this.enter('tableReach');return;}
  const duration={tablePlace:1.1,tableReach:1.2,tableGrasp:.25,reach:1.35,grasp:.25,lift:.9,sip:3,lower:.85,place:1.2,release:.35,retract:.45}[this.state];
  if(this.time<duration)return;
  if(this.state==='tablePlace'){this.drop.attach(this.mug);this.mug.position.set(0,0,0);this.mug.quaternion.identity();this.owner='meeting';this.events++;this.setGrip(false);this.enter('tableRest');}
  else if(this.state==='tableReach')this.enter('tableGrasp');
  else if(this.state==='tableGrasp'){this.hand.attach(this.mug);this.owner='hand';this.events++;this.setGrip(true);this.carryOnly=true;this.enter('lift');}
  else if(this.state==='reach')this.enter('grasp');
  else if(this.state==='grasp'){this.hand.attach(this.mug);this.owner='hand';this.events++;this.setGrip(true);this.enter('lift');}
  else if(this.state==='lift')this.enter(this.carryOnly?'carry':'sip');
  else if(this.state==='sip')this.enter('lower');
  else if(this.state==='lower'){this.enter(this.heldSip?'carry':'place');this.heldSip=false;}
  else if(this.state==='place'){this.releaseToDesk();this.enter('release');}
  else {this.state='idle';this.time=0;this.done++;this.returning=false;}
 }
 sipHeld(){if(this.state!=='carry'||this.owner!=='hand')return false;this.heldSip=true;this.enter('sip');return true;}
 finishCarry(){if(this.state==='carry')this.enter('place');}
 setDownAt(drop){if(this.state!=='carry')return false;this.drop=drop;this.retrieve=false;this.enter('tablePlace');return true;}
 returnToHand(){this.retrieve=true;if(this.state==='tableRest')this.enter('tableReach');}
 apply(){if(this.state==='idle'||this.state==='tableRest')return;const actor=this.actor;actor.updateWorldMatrix(true,true);const t=this.time,head=part(actor,'NaraHead'),yaw=actor.getWorldQuaternion(new T.Quaternion()),offset=V(.057,0,0),home=this.homePose();let cup=worldPose(this.mug),handTarget,handQ=yaw.clone();
  if(['reach','grasp','tableReach','tableGrasp'].includes(this.state)){const at=this.state.startsWith('table')?worldPose(this.drop):home,target=at.position.clone().add(offset.clone().applyQuaternion(at.quaternion)),u=this.state.endsWith('Grasp')||this.state==='grasp'?1:ease(t/(this.state==='tableReach'?1.2:1.35));handTarget=this.handFrom.position.clone().lerp(target,u);handQ=this.handFrom.quaternion.clone().slerp(at.quaternion,u);}
  else if(['release','retract'].includes(this.state)){const target=this.hand.getWorldPosition(V());handTarget=this.handFrom.position.clone().lerp(target,ease(t/(this.state==='release'?.35:.45)));handQ=this.handFrom.quaternion.clone().slerp(this.hand.getWorldQuaternion(new T.Quaternion()),ease(t/.45));}
  else {
   const hold=this.holdPoint();let target=hold,q=yaw.clone();
   if(this.state==='sip'){const mouth=head.localToWorld(V(-.035,-.105,.195));const u=t<.7?ease(t/.7):t<=2.3?1:1-ease((t-2.3)/.7);target=hold.clone().lerp(mouth,u);q.multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),u*.25));}
   if(this.state==='lift')cup={position:this.from.position.clone().lerp(hold,ease(t/.9)),quaternion:this.from.quaternion.clone().slerp(q,ease(t/.9))};
   else if(this.state==='tablePlace'){const at=worldPose(this.drop);cup={position:this.from.position.clone().lerp(at.position,ease(t/1.1)),quaternion:this.from.quaternion.clone().slerp(at.quaternion,ease(t/1.1))};}
   else if(this.state==='place')cup={position:this.from.position.clone().lerp(home.position,ease(t/1.2)),quaternion:this.from.quaternion.clone().slerp(home.quaternion,ease(t/1.2))};
   else if(this.state==='lower')cup={position:this.from.position.clone().lerp(hold,ease(t/.85)),quaternion:this.from.quaternion.clone().slerp(q,ease(t/.85))};
   else cup={position:target,quaternion:q};
   handTarget=cup.position.clone().add(offset.clone().applyQuaternion(cup.quaternion));handQ=cup.quaternion;
  }
  this.reachError=solveArm(actor,handTarget,handQ);
  if(this.owner==='hand')setWorld(this.mug,cup.position,cup.quaternion);
 }
 diagnostics(){return {state:this.state,time:+this.time.toFixed(3),owner:this.owner,events:this.events,done:this.done,returning:this.returning,handError:this.reachError,cupCount:1};}
 dispose(){if(this.disposed)return;this.disposed=true;if(this.owner!=='desk')this.releaseToDesk();this.setGrip(false);this.state='idle';}
}
