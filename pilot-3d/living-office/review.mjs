import * as T from 'three';
import {EnsembleRoute} from '../ensemble-office/motion.mjs';
import {findFinalRoute} from '../final-office/destinations.mjs';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from '../activities/interactions.mjs';
import {ease} from '../sample/motion.mjs';
const V=(...v)=>new T.Vector3(...v),Y=V(0,1,0),dur={reach:.8,grasp:.3,use:3,replace:.9,release:.3,retract:.7};
const world=n=>({p:n.getWorldPosition(V()),q:n.getWorldQuaternion(new T.Quaternion())});
function setWorld(n,p,q){n.parent.updateWorldMatrix(true,false);n.position.copy(n.parent.worldToLocal(p.clone()));n.quaternion.copy(n.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(q);n.updateWorldMatrix(false,true);}
export class BoardPointer{
 constructor(model,actor){this.actor=actor;this.hand=part(actor,'NaraHandR');this.pen=model.getObjectByName('LivingReviewMarker');this.parent=this.pen.parent;this.home={p:this.pen.position.clone(),q:this.pen.quaternion.clone()};this.stage='idle';this.owner='tray';this.time=0;this.handError=0;this.tipError=0;this.done=false;}
 enter(stage){this.stage=stage;this.time=0;this.fromHand=world(this.hand);this.fromPen=world(this.pen);}
 start(){this.done=false;this.cancelled=false;this.enter('reach');this.pendingStart=true;}
 cancel(){this.cancelled=true;if(['reach','grasp'].includes(this.stage))this.enter('retract');else if(this.stage==='use')this.enter('replace');}
 tick(dt){if(this.stage==='idle')return;this.time+=dt;if(this.time<dur[this.stage])return;const st=this.stage;if(st==='reach')this.enter('grasp');else if(st==='grasp'){this.hand.attach(this.pen);this.owner='hand';this.enter('use');}else if(st==='use')this.enter('replace');else if(st==='replace'){this.restore();this.enter('release');}else if(st==='release')this.enter('retract');else{this.stage='idle';this.done=true;}}
 restore(){this.parent.attach(this.pen);this.pen.position.copy(this.home.p);this.pen.quaternion.copy(this.home.q);this.owner='tray';}
 apply(){if(this.stage==='idle')return;if(this.pendingStart){this.fromHand=world(this.hand);this.fromPen=world(this.pen);this.pendingStart=false;}const base=world(this.hand),home={p:this.parent.localToWorld(this.home.p.clone()),q:this.parent.getWorldQuaternion(new T.Quaternion()).multiply(this.home.q)},u=ease(this.time/dur[this.stage]);let p,q,pen;
  if(['reach','grasp'].includes(this.stage)){const at=home.p.clone().addScaledVector(Y.clone().applyQuaternion(home.q),-.015);p=this.fromHand.p.clone().lerp(at,this.stage==='grasp'?1:u);q=this.fromHand.q.clone().slerp(home.q,this.stage==='grasp'?1:u);}
  else if(this.stage==='use'){const tip=V(.10+Math.sin(this.time*2)*.014,1.16,.625),axis=V(.08,.35,-.93).normalize(),targetQ=new T.Quaternion().setFromUnitVectors(Y,axis),v=ease(this.time/.7);p=this.fromHand.p.clone().lerp(tip.clone().addScaledVector(axis,.065),v);q=this.fromHand.q.clone().slerp(targetQ,v);pen={p:this.fromPen.p.clone().lerp(tip.clone().addScaledVector(axis,.08),v),q:this.fromPen.q.clone().slerp(targetQ,v)};this.tip=tip;}
  else if(this.stage==='replace'){pen={p:this.fromPen.p.clone().lerp(home.p,u),q:this.fromPen.q.clone().slerp(home.q,u)};p=pen.p.clone().addScaledVector(Y.clone().applyQuaternion(pen.q),-.015);q=pen.q.clone();}
  else if(this.stage==='release'){p=this.fromHand.p.clone();q=this.fromHand.q.clone();}
  else{p=this.fromHand.p.clone().lerp(base.p,u);q=this.fromHand.q.clone().slerp(base.q,u);}
  this.handError=Math.max(this.handError,solveArm(this.actor,p,q,'R'));if(this.owner==='hand'&&pen)setWorld(this.pen,pen.p,pen.q);if(this.stage==='use'&&this.time>.7)this.tipError=Math.max(this.tipError,this.pen.localToWorld(V(0,-.08,0)).distanceTo(this.tip));
 }
 override(){const blend=this.stage==='grasp'?ease(this.time/.3):['use','replace'].includes(this.stage)?1:this.stage==='release'?1-ease(this.time/.3):0;return this.stage!=='idle'?{R:{blend,prop:this.pen,kind:'pen'}}:null;}
 dispose(){this.restore();this.stage='idle';}
}
export class ReviewSequence{
 constructor(s,model,id,slot){this.s=s;this.id=id;this.slot=slot;this.actor=model.getObjectByName(s.meta.bindings[id].actor);this.origin=s.meta.workspaces[id];this.home=s.meta.livingOffice.standSlots[slot];this.startYaw=Math.atan2(-this.home[0],.65-this.home[2]);const colliders=s.huddles.anchors.get(id+':'+slot).colliders;this.colliders=colliders;const points=[this.home,...findFinalRoute(this.home,[0,0,-.3],colliders),[0,0,.12]];this.points=points.map(p=>p.map((v,k)=>v-this.origin[k]));this.route=new EnsembleRoute(this.points,this.startYaw,{speed:.48,period:.82,origin:this.origin,colliders});this.pointer=new BoardPointer(model,this.actor);this.stage='approach';this.cancelled=false;this.done=false;this.time=0;this.pose=this.route.state();}
 back(){this.pointer.dispose();this.route=new EnsembleRoute(this.stage==='approach'?this.route.reversePoints():this.points.toReversed(),this.pose.yaw??0,{speed:.48,period:.82,origin:this.origin,colliders:this.colliders});this.stage='back';this.time=0;}
 cancel(){if(this.cancelled)return;this.cancelled=true;if(this.stage==='approach')this.back();else if(this.stage==='point')this.pointer.cancel();}
 tick(dt){if(this.done)return;this.time+=dt;if(['approach','back'].includes(this.stage)){this.route.tick(dt);this.pose=this.route.state();if(this.route.done){if(this.stage==='approach'){this.stage='point';this.pointer.start();}else{this.stage='align';this.time=0;this.fromYaw=this.pose.yaw;}}}else if(this.stage==='point'){this.pointer.tick(dt);if(this.pointer.done)this.back();}else if(this.stage==='align'){const u=ease(this.time/.8),yaw=this.fromYaw+Math.atan2(Math.sin(this.startYaw-this.fromYaw),Math.cos(this.startYaw-this.fromYaw))*u;this.pose={...this.pose,yaw,action:'turn',feet:[-.1,.1].map(x=>({position:[this.pose.x+Math.cos(yaw)*x,.085,this.pose.z-Math.sin(yaw)*x],planted:u===1}))};if(this.time>=.8)this.done=true;}}
 state(){return{action:this.stage==='point'?'coffee_wait':this.pose.action,time:this.time,pose:{...this.pose,hip:.84,chair:1,stand:1},activity:'review',reviewStage:this.stage,returning:this.cancelled,gazePoint:this.stage==='point'?[.1,1.16,.625]:undefined};}
 apply(){if(this.stage==='point')this.pointer.apply();}
 dispose(){this.pointer.dispose();this.done=true;}
}
