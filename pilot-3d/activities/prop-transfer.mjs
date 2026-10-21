import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from './interactions.mjs';
import {ease} from '../sample/motion.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0);
const dropX=(id,side)=>side==='L'?-.55:id==='leo'?.575:.52;
const LENGTH={pickup:1.2,grasp:.35,present:1.2,receive:1.2,accept:.35,read:2,giveback:1.2,regrasp:.35,return:1.3,release:.8,cancelPlace:1.2,dock:1.2};
const world=node=>({p:node.getWorldPosition(V()),q:node.getWorldQuaternion(new T.Quaternion())});
function setWorld(node,{p,q}){node.parent.updateWorldMatrix(true,false);node.position.copy(node.parent.worldToLocal(p.clone()));node.quaternion.copy(node.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(q);node.updateWorldMatrix(false,true);}
export class PropTransfers{
  constructor(model,actors,material){this.model=model;this.actors=actors;this.geometry=new T.BoxGeometry(.096,.002,.14);this.pages=new Map();this.active=false;this.events=0;this.history=[];this.handError=0;this.supports={};model.updateMatrixWorld(true);
    // Measure the actual visible support, including the tablet/notebook surface
    // on the right. Left drops stay beyond the desk mat and the cup footprint.
    const ray=new T.Raycaster();for(const [id,actor]of Object.entries(actors)){this.supports[id]={};for(const side of ['L','R']){const p=actor.localToWorld(V(dropX(id,side),0,.42));ray.set(V(p.x,2,p.z),V(0,-1,0));const hit=ray.intersectObject(model,true).find(h=>h.point.y>=.70&&h.point.y<=.84);this.supports[id][side]=hit?.point.y??.74;}}
    this.inkGeometry=new T.BoxGeometry(.085,.0004,.002);this.inkMaterial=new T.MeshStandardMaterial({color:0x7e896e,roughness:.95});this.inks=[];
    for(const [id,actor]of Object.entries(actors)){const mesh=new T.Mesh(this.geometry,material);mesh.name='ReviewPage-'+id;mesh.castShadow=true;mesh.receiveShadow=true;const ink=new T.InstancedMesh(this.inkGeometry,this.inkMaterial,3);for(let i=0;i<3;i++)ink.setMatrixAt(i,new T.Matrix4().makeTranslation(-.005,.0015,-.025+i*.023));ink.instanceMatrix.needsUpdate=true;mesh.add(ink);this.inks.push(ink);model.add(mesh);const side=id==='leo'?'R':'L';this.pages.set(id,{id,mesh,desk:id,side,supportTop:this.supports[id][side],owner:'desk:'+id});setWorld(mesh,this.home(id,side));}
  }
  deskPages(id,side){return [...this.pages.values()].filter(p=>p.owner==='desk:'+id&&p.side===side).sort((a,b)=>b.mesh.getWorldPosition(V()).y-a.mesh.getWorldPosition(V()).y);}
  home(id,side=id==='leo'?'R':'L'){const actor=this.actors[id],reverse=this.active&&id===this.visitor,exclude=this.page?.id??id,supportTop=Math.max(this.supports[id][side],...this.deskPages(id,side).filter(p=>p.id!==exclude).map(p=>new T.Box3().setFromObject(p.mesh).max.y));actor.updateWorldMatrix(true,true);return{supportTop,p:actor.localToWorld(V(dropX(id,side),supportTop+.0015,.42)),q:actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(Y,(side==='L'?Math.PI:0)+(reverse?Math.PI:0)))};}
  available(host){return [...this.pages.values()].some(p=>p.owner==='desk:'+host&&p.side===(host==='leo'?'R':'L'));}
  begin(host,visitor,anchors){if(this.active||!this.available(host))return false;this.host=host;this.visitor=visitor;this.ids=[host,visitor];this.sides={[host]:anchors.hostSide,[visitor]:anchors.visitorSide};this.page=this.deskPages(host,anchors.hostSide)[0];this.owner=host;this.cancelled=false;this.complete=false;this.active=true;this.transfers=0;this.events=0;this.history=[];
    const a=part(this.actors[host],'NaraShoulder'+this.sides[host]).getWorldPosition(V()),b=part(this.actors[visitor],'NaraShoulder'+this.sides[visitor]).getWorldPosition(V()),axis=b.clone().sub(a);axis.y=0;axis.normalize();
    this.center={p:a.clone().add(b).multiplyScalar(.5).add(V(0,-.09,.06)),q:new T.Quaternion().setFromAxisAngle(Y,Math.atan2(-axis.z,axis.x))};this.enter('pickup');return true;
  }
  enter(stage){this.stage=stage;this.time=0;this.from=world(this.page.mesh);this.fromHands=Object.fromEntries(this.ids.map(id=>[id,world(part(this.actors[id],'NaraHand'+this.sides[id]))]));this.history.push(stage);}
  attach(id){const next=part(this.actors[id],'NaraHand'+this.sides[id]);next.attach(this.page.mesh);this.page.owner='hand:'+id;this.owner=id;this.events++;}
  place(id){this.model.attach(this.page.mesh);const target=this.home(id,this.sides[id]);setWorld(this.page.mesh,target);this.page.supportTop=target.supportTop;this.page.side=this.sides[id];this.page.owner='desk:'+id;this.page.desk=id;this.events++;}
  cancel(){if(!this.active||this.cancelled)return;this.cancelled=true;if(this.page.owner.startsWith('desk:'))this.enter('release');else if(this.owner===this.host)this.enter('cancelPlace');else this.enter('carry');}
  canLeave(){return !this.active||(this.stage==='carry'&&this.time>=.8);}
  tick(dt,atDesk=false){if(!this.active)return;this.time+=dt;if(this.stage==='carry'){if(atDesk)this.enter('dock');return;}if(this.time<LENGTH[this.stage])return;
    if(this.stage==='pickup')this.enter('grasp');else if(this.stage==='grasp'){this.attach(this.host);this.enter('present');}
    else if(this.stage==='present')this.enter('receive');else if(this.stage==='receive')this.enter('accept');
    else if(this.stage==='accept'){this.attach(this.visitor);this.transfers++;this.enter('read');}
    else if(this.stage==='read')this.enter('giveback');else if(this.stage==='giveback')this.enter('regrasp');
    else if(this.stage==='regrasp'){this.attach(this.host);this.transfers++;this.enter('return');}
    else if(['return','cancelPlace','dock'].includes(this.stage)){this.place(this.owner);this.enter('release');}
    else{this.active=false;this.complete=!this.cancelled;this.stage='idle';}
  }
  pose(){const u=ease(this.time/(LENGTH[this.stage]??.8));if(this.stage==='carry'){const actor=this.actors[this.owner],target={p:actor.localToWorld(V(this.sides[this.owner]==='L'?-.14:.14,part(actor,'NaraPelvis').position.y+.27,.26)),q:actor.getWorldQuaternion(new T.Quaternion())};return{p:this.from.p.clone().lerp(target.p,ease(this.time/.8)),q:this.from.q.clone().slerp(target.q,ease(this.time/.8))};}
    const target=['return','cancelPlace','dock'].includes(this.stage)?this.home(this.owner,this.sides[this.owner]):this.center;
    if(['present','return','cancelPlace','dock'].includes(this.stage))return{p:this.from.p.clone().lerp(target.p,u),q:this.from.q.clone().slerp(target.q,u)};
    return ['pickup','grasp','release'].includes(this.stage)?world(this.page.mesh):this.center;
  }
  controls(id){if(!this.active||!this.ids.includes(id))return null;const side=this.sides[id],isHost=id===this.host,stage=this.stage;let use=false,reach=1,blend=0;
    if(['pickup','grasp'].includes(stage)){use=isHost;reach=stage==='pickup'?ease(this.time/1.2):1;blend=stage==='grasp'?ease(this.time/.35):0;}
    else if(['present','receive','accept'].includes(stage)){use=isHost||stage!=='present';reach=isHost?1:stage==='receive'?ease(this.time/1.2):1;blend=isHost?1:stage==='accept'?ease(this.time/.35):0;}
    else if(stage==='giveback'||stage==='regrasp'){use=true;reach=isHost?(stage==='giveback'?ease(this.time/1.2):1):1;blend=isHost?(stage==='regrasp'?ease(this.time/.35):0):1;}
    else if(this.page.owner==='hand:'+id){use=true;blend=1;}
    else{const retracting=(stage==='read'&&isHost)||(stage==='return'&&!isHost)||(stage==='release'&&id===this.owner)||(['cancelPlace','carry'].includes(stage)&&id!==this.owner);use=retracting&&this.time<.8;reach=1-ease(this.time/.8);}
    if(!use)return null;return{side,reach,blend};
  }
  apply(id,actor){const c=this.controls(id);if(!c)return;const pose=this.pose(),held=this.page.owner==='hand:'+id,role=id===this.host?-1:1,offset=V(role*.055,.027,0).applyQuaternion(pose.q),target=pose.p.clone().add(offset),hand=part(actor,'NaraHand'+c.side),base=world(hand),from=this.fromHands[id];
    const extending=['pickup','receive','accept','giveback','regrasp','grasp'].includes(this.stage)&&(!held||this.stage==='pickup');
    const point=extending?from.p.clone().lerp(target,c.reach):base.p.clone().lerp(held?target:from.p,c.reach),q=pose.q.clone().multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));
    this.handError=Math.max(this.handError,solveArm(actor,point,base.q.clone().slerp(q,c.reach),c.side));if(held)setWorld(this.page.mesh,pose);
  }
  handOverrides(id){const c=this.controls(id);return c?{[c.side]:{blend:c.blend,prop:this.page.mesh,kind:'page'}}:undefined;}
  diagnostics(){return{active:this.active,stage:this.stage??'idle',owner:this.active?this.page.owner:null,time:this.time??0,cancelled:!!this.cancelled,complete:!!this.complete,events:this.events,transfers:this.transfers??0,handError:this.handError,supports:this.supports,history:[...this.history],pages:[...this.pages.values()].map(p=>({id:p.id,owner:p.owner,desk:p.desk,side:p.side,supportTop:p.supportTop,supportGap:p.owner.startsWith('desk:')?p.mesh.getWorldPosition(V()).y-.001-p.supportTop:null}))};}
  dispose(){for(const page of this.pages.values())page.mesh.removeFromParent();for(const ink of this.inks)ink.dispose();this.inkGeometry.dispose();this.inkMaterial.dispose();this.geometry.dispose();this.pages.clear();this.active=false;}
}
