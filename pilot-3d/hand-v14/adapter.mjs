import * as T from 'three';
import {AnatomicalSkin} from './skin.mjs';
import {definitions,pose,fk,fit,samplePose,presentationPose} from './kinematics.mjs';
import {tripod} from './tripod.mjs';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from '../activities/interactions.mjs';
const V=(...p)=>new T.Vector3(...p),Q=()=>new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2);
export function keyAnchors(model,prefix){
 const keys=[];model.updateWorldMatrix(true,true);
 model.traverse(n=>{
  if(n.isInstancedMesh){for(const[index,name]of(n.userData.parts??[]).entries())if(name.startsWith(prefix+'KeyboardKey')){const m=new T.Matrix4();n.getMatrixAt(index,m);m.premultiply(n.matrixWorld);n.geometry.computeBoundingBox();const box=n.geometry.boundingBox.clone(),inverse=m.clone().invert();keys.push({name,point:V(0,box.max.y,0).applyMatrix4(m),project:p=>{const v=p.clone().applyMatrix4(inverse);v.x=T.MathUtils.clamp(v.x,box.min.x+.003,box.max.x-.003);v.y=box.max.y;v.z=T.MathUtils.clamp(v.z,box.min.z+.003,box.max.z-.003);return v.applyMatrix4(m);}});}}
  else if(n.isMesh&&n.name.startsWith(prefix+'KeyboardKey')){n.geometry.computeBoundingBox();keys.push({name:n.name,point:n.localToWorld(V(0,n.geometry.boundingBox.max.y,0))});}
 });return keys;
}
export class HandRevision {
 constructor(legacy,{actor,id,side,desk,cup,scheduler,model}){
  Object.assign(this,{legacy,actor,id,side,desk,cup,scheduler});this.hand=legacy.hand;this.defs=definitions(side);this.skin=new AnatomicalSkin(this.hand,legacy.root.children.find(n=>n.material).material,side);this.root=this.skin.root;
  this.angles=pose('relaxed');this.settings=[];this.mode='relaxed';this.fallback=false;this.error=0;this.contactRows=[];this.pressRows=[];this.keys=keyAnchors(model,actor.userData.prefix);this.mouseRay=new T.Raycaster();
  this.pads=this.defs.map((d,i)=>{const pad=new T.Object3D();pad.name='Pad14_'+side+'_'+d.name;this.root.add(pad);return{base:V(...d.base),lengths:d.lengths,pad};});
  this.pen=['nara','sora','min'].includes(id)&&!!desk.prop;if(this.pen){desk.anatomicalHand=true;desk.handRadius=Math.max(Math.abs(desk.prop.geometry.boundingBox.max.x),Math.abs(desk.prop.geometry.boundingBox.max.z));this.tripod=tripod(desk.handRadius);}this.apply(0,0,null,'pen');
 }
 get blend(){return this.legacy.blend;}
 get fingers(){return this.fallback?this.legacy.fingers:this.pads;}
 get surface(){return this.fallback?this.legacy.surface:this.skin;}
 get batch(){return this.legacy.batch;}
 apply(dt,desired,prop,kind,points){
  this.legacy.relaxation=this.relaxation;this.legacy.presentation=this.presentation;this.legacy.apply(dt,desired,prop,kind,points);
  const s=this.scheduler,d=this.desk,writing=this.pen&&this.side==='R'&&d.busy&&prop===d.prop&&kind==='pen';
  const external=!!points||desired>.001&&!writing||!!s.getRecord?.(this.id)||!!s.handControl?.(this.id,this.side)&&!s.handReviewControls?.(this.id);
  this.fallback=external;this.root.visible=!external;this.legacy.root.visible=external;
  if(external){this.mode='legacy-owned-contact';this.error=this.legacy.error;this.contactRows=this.legacy.contactRows;this.pressRows=[];return;}
  const review=(s.handReviewActor??'sora')===this.id?s.handReviewPose:null;this.pressRows=[];this.contactRows=[];this.error=0;
  const typing=!review&&this.id==='jun'&&d.stage==='use'&&['jun-alternating-key-burst','jun-minimal-fix'].includes(d.personalityPose?.cue);
  const mousing=!review&&this.id==='jun'&&this.side==='R'&&d.stage==='use'&&d.mouse&&['jun-mouse-scan','jun-middle-finger-scroll'].includes(d.personalityPose?.cue);
  const mouseWeight=mousing?T.MathUtils.smoothstep(d.time,0,.7)*(1-T.MathUtils.smoothstep(d.time,2.7,3)):0;
  let mode=writing?'tripod-write':review??(mousing?(mouseWeight>.999?'mouse-contact':'mouse-transition'):typing?'key-press':this.presentation?'personality':'relaxed'),wanted=mode==='personality'||typing?presentationPose(this.presentation):samplePose(mousing?'mouse-rest':mode,s.time),settings=[];this.mouseTargets=[];
  if(writing){
   const mix=['grasp','use','replace'].includes(d.stage)?1:0;
   wanted=pose('tripod-write');for(let i=0;i<3;i++){const t=this.tripod.solved[i];wanted[i]=pose('relaxed')[i].map((a,j)=>T.MathUtils.lerp(a,t.angles[j],mix));settings[i]={spread:T.MathUtils.lerp(this.defs[i].spread,t.spread,mix),opposition:T.MathUtils.lerp(this.defs[i].opposition,t.opposition,mix)};}
  }else if(mousing){
   d.mouse.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(d.mouse),center=box.getCenter(V()),local=this.actor.worldToLocal(center.clone()),style=d.personalityPose.right;
   const target=this.actor.localToWorld(V(local.x+.008,local.y+(box.max.y-center.y)+.032,local.z-.060+(style?.[2]??.38)-.38));const base=this.hand.getWorldPosition(V());target.lerpVectors(base,target,mouseWeight);solveArm(this.actor,target,this.actor.getWorldQuaternion(new T.Quaternion()).multiply(Q()),this.side);
  }else if(mode==='palm-check'){
   const target=this.actor.localToWorld(V(this.side==='R'?.15:-.15,.99,.32)),q=this.actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2)).multiply(new T.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI));solveArm(this.actor,target,q,this.side);
  }else if(['keyboard-hover','key-press','mouse-rest','paper-pinch'].includes(mode)){
   const key=this.keys.reduce((best,k)=>Math.abs(this.actor.worldToLocal(k.point.clone()).x-(this.side==='R'?.08:-.12))<Math.abs(this.actor.worldToLocal(best.point.clone()).x-(this.side==='R'?.08:-.12))?k:best,this.keys[0]);
   if(key){const local=this.actor.worldToLocal(key.point.clone());const target=this.actor.localToWorld(V(this.side==='R'?.08:-.12,local.y+.036,local.z-.070));solveArm(this.actor,target,this.actor.getWorldQuaternion(new T.Quaternion()).multiply(Q()),this.side);}
  }else{
   // The new canonical dorsal normal is +Z. A keyboard frame puts it upwards;
   // palm (-Z) goes towards the desk. Do not invert a legacy curl endpoint.
   if(!(this.id==='jun'&&this.side==='R'&&d.stage==='use')&&!s.humanMotion?.ownsFreeArm(this.id,this.side)){const desiredQ=this.actor.getWorldQuaternion(new T.Quaternion()).multiply(Q());this.hand.quaternion.copy(this.hand.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(desiredQ);this.hand.updateWorldMatrix(false,true);}
  }
  const alpha=dt>0?1-Math.exp(-dt*14):1;this.angles=this.angles.map((a,i)=>a.map((v,j)=>T.MathUtils.lerp(v,wanted[i][j],alpha)));this.settings=settings;
  if(mode==='key-press'&&this.keys.length){
   this.hand.updateWorldMatrix(true,false);
   for(let i=1;i<(typing?3:5);i++){
    const t=(s.time*.95+(i-1)*.27)%1,pulse=typing?T.MathUtils.clamp(((this.presentation?.[i]??0)-(i===1?.13:.15))/(i===1?.43:.40),0,1):Math.sin(Math.PI*T.MathUtils.clamp(t/.24,0,1))**2,def=this.defs[i],hover=fk(def,pose('keyboard-hover')[i]).points[3],world=this.hand.localToWorld(hover.clone());
    const key=this.keys.reduce((best,k)=>k.point.distanceToSquared(world)<best.point.distanceToSquared(world)?k:best,this.keys[0]);
    const surfaceTarget=key.project?.(world)??key.point.clone(),actualTarget=surfaceTarget.clone().add(V(0,.004,0)),local=this.hand.worldToLocal(actualTarget.clone()),target=hover.clone().lerp(local,pulse),fitPose=fit(def,target,this.angles[i],{iterations:65});
    this.angles[i]=fitPose.angles;settings[i]=fitPose;if(pulse>.85)this.pressRows.push({finger:def.name,key:key.name,target:surfaceTarget.toArray(),pulse});
   }
  }
  if(mousing&&mouseWeight>.999){
   const box=new T.Box3().setFromObject(d.mouse),center=box.getCenter(V());this.hand.updateWorldMatrix(true,false);
   for(let i=1;i<5;i++){
    const restTip=this.hand.localToWorld(fk(this.defs[i],pose('mouse-rest')[i]).points[3].clone()),rayOrigin=i<3?center.clone().add(V(i===1?-.009:.008,box.max.y-center.y+.12,.020)):V(restTip.x,box.max.y+.12,restTip.z);this.mouseRay.set(rayOrigin,V(0,-1,0));const hit=this.mouseRay.intersectObject(d.mouse,true)[0];if(!hit)continue;
    const scroll=i===2?T.MathUtils.clamp(((this.presentation?.[i]??.24)-.24)/.25,0,1):0,pad=hit.point.clone().add(V(0,.004+scroll*.001,0)),local=this.hand.worldToLocal(pad.clone());
    const solved=[this.angles[i],pose('mouse-rest')[i]].map(seed=>fit(this.defs[i],local,seed,{iterations:95})).sort((a,b)=>a.error-b.error)[0];this.angles[i]=solved.angles;settings[i]=solved;this.mouseTargets.push({finger:this.defs[i].name,i,target:pad,surface:hit.point,object:hit.object.name});
   }
  }
  this.mode=mode;this.skin.apply(this.angles,settings);
  for(let i=0;i<5;i++)this.pads[i].pad.position.copy(this.skin.positions[i][3]);
  this.hand.updateWorldMatrix(false,true);
  if(writing&&d.stage==='use'&&d.time>1){
   const tip=prop.localToWorld(V(0,-d.half,0)),actorQ=this.actor.getWorldQuaternion(new T.Quaternion());
   for(let i=0;i<3;i++){
    const actual=this.hand.localToWorld(this.skin.positions[i][3].clone()),target=this.tripod.targets[i].clone().applyQuaternion(actorQ).add(tip),error=actual.distanceTo(target);this.error=Math.max(this.error,error);this.contactRows.push({finger:this.defs[i].name,role:'tripod-pad',error,target:target.toArray(),actual:actual.toArray()});
   }
  }
  for(const c of this.mouseTargets){const actual=this.pads[c.i].pad.getWorldPosition(V()),error=actual.distanceTo(c.target);this.error=Math.max(this.error,error);this.contactRows.push({finger:c.finger,role:c.i<3?'mouse-surface':'mouse-support',error,target:c.target.toArray(),actual:actual.toArray(),surface:c.surface.toArray(),object:c.object});}
  for(const r of this.pressRows){const i=this.defs.findIndex(d=>d.name===r.finger),p=this.hand.localToWorld(this.skin.positions[i][3].clone()).sub(V(0,.004,0));r.actual=p.toArray();r.error=p.distanceTo(V(...r.target));}
 }
 diagnostics(){return{surfaceVersion:this.fallback?3:4,skin:this.surface.diagnostics(),mode:this.mode,calibrationError:this.tripod?.error??null,padError:this.error,contacts:this.contactRows,presses:this.pressRows,contactScope:this.fallback?'legacy-owned-contact':'three-joint-authored-hand',poseAngles:this.angles,lengths:this.defs.map(d=>d.lengths),blend:this.legacy.blend};}
 dispose(){this.skin.dispose();this.legacy.dispose();delete this.desk.anatomicalHand;delete this.desk.handRadius;}
}
