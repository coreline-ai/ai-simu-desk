import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from './interactions.mjs';
import {ease} from '../sample/motion.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0),DOWN=V(0,-1,0),PALM=.0275;
const PROFILES={nara:{lap:.17,lift:.09},sora:{lap:.21,lift:.075},jun:{lap:.19,lift:.085},min:{lap:.15,lift:.07},leo:{lap:.20,lift:.08}};
const world=node=>({point:node.getWorldPosition(V()),quaternion:node.getWorldQuaternion(new T.Quaternion())});
const snapshot=(actor,side)=>({...world(part(actor,'NaraHand'+side)),elbow:part(actor,'NaraElbow'+side).getWorldPosition(V())});

// Upper-body presentation. Surfaces are measured on the loaded sofa and actual
// posed trouser mesh; no new reservation, furniture, prop, or work state.
export class SofaSupport {
  constructor(model,scheduler){this.model=model;this.scheduler=scheduler;this.rows=new Map();this.previous=new Map();this.ray=new T.Raycaster();this.armrests=[-1,1].map(sign=>{
    const sofa=model.getObjectByName('LinenSofa'),point=sofa.localToWorld(model.getObjectByName('AfternoonStudio')?.userData.finalOffice?V(...model.getObjectByName('AfternoonStudio').userData.finalOffice.sofa.armrests[sign<0?0:1]):V(sign*.98,2,.23));this.ray.set(point,DOWN);const hit=this.ray.intersectObject(sofa,true)[0];if(!hit)throw Error('소파 팔걸이 지지면 누락');return{point:hit.point.clone(),object:hit.object.name};
  });}
  lap(actor,side,id){
    actor.updateWorldMatrix(true,true);const mesh=part(actor,'ContinuousTrousers'+side),hip=part(actor,'NaraPelvis').position.y,point=actor.localToWorld(V(side==='L'?-.10:.10,hip+.30,PROFILES[id].lap));
    mesh.computeBoundingSphere();this.ray.set(point,DOWN);const hit=this.ray.intersectObject(mesh,false)[0];if(!hit)throw Error('소파 무릎 지지면 누락: '+id+'/'+side);return{point:hit.point.clone(),object:mesh.name};
  }
  apply(id,actor,state,dt){
    const s=this.scheduler,pair=s.sofaPair,active=state.activity==='sofaPair'&&!pair?.ending;let row=this.rows.get(id);
    if(!active&&!row)return;
    if(s.desks[id].busy||s.cups[id].owner==='hand'||s.transfer?.controls(id)){this.rows.delete(id);return;}
    if(active&&!row){const slot=s.records.get(id)?.slot??0,outer=slot===0?'L':'R',inner=outer==='L'?'R':'L';row={outer,inner,time:0,exit:null,from:this.previous.get(id)??Object.fromEntries(['L','R'].map(side=>[side,snapshot(actor,side)])),supports:{[outer]:this.armrests[slot],[inner]:this.lap(actor,inner,id)},last:{},diagnostic:{}};this.rows.set(id,row);}
    row.time+=dt;
    if(!active&&row.exit===null){row.exit=0;row.from=Object.fromEntries(['L','R'].map(side=>[side,row.last[side]??snapshot(actor,side)]));}
    if(row.exit!==null)row.exit+=dt;
    const entering=ease(row.time/.8),leaving=row.exit===null?0:ease(row.exit/1.2),gesture=active&&state.speaking?state.gesture??0:0;
    const normal=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));
    for(const side of ['L','R']){
      const hand=part(actor,'NaraHand'+side),base=snapshot(actor,side),surface=row.supports[side],rest=surface.point.clone().addScaledVector(UP,PALM),lift=side===row.inner?gesture*PROFILES[id].lift:0;
      let target=rest.clone().addScaledVector(UP,lift),q=normal.clone();
      if(row.exit===null){target=row.from[side].point.clone().lerp(target,entering);q=row.from[side].quaternion.clone().slerp(q,entering);}
      else{target=row.from[side].point.clone().lerp(base.point,leaving).addScaledVector(UP,Math.sin(Math.PI*leaving)*.035);q=row.from[side].quaternion.clone().slerp(base.quaternion,leaving);}
      const shoulder=part(actor,'NaraShoulder'+side).getWorldPosition(V()),axis=target.clone().sub(shoulder).normalize(),previous=row.last[side]??row.from[side],fromPole=previous.elbow.clone().sub(shoulder),toPole=row.exit===null?V(side==='L'?-1:1,.15,.25).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())):base.elbow.clone().sub(shoulder);
      fromPole.addScaledVector(axis,-fromPole.dot(axis)).normalize();toPole.addScaledVector(axis,-toPole.dot(axis)).normalize();
      const angle=Math.atan2(axis.dot(fromPole.clone().cross(toPole)),fromPole.dot(toPole)),pole=fromPole.applyAxisAngle(axis,T.MathUtils.clamp(angle,-dt*3.5,dt*3.5));
      const error=solveArm(actor,target,q,side,pole);row.last[side]=snapshot(actor,side);const planted=row.exit===null&&entering>.999&&lift<.0001;
      row.diagnostic[side]={kind:side===row.outer?'armrest':'lap',object:surface.object,planted,lift,error,palmGap:planted?hand.getWorldPosition(V()).y-.026-surface.point.y:null,surface:surface.point.toArray(),hand:hand.getWorldPosition(V()).toArray()};
    }
    if(row.exit!==null&&row.exit>=1.2)this.rows.delete(id);
  }
  remember(id,actor){this.previous.set(id,Object.fromEntries(['L','R'].map(side=>[side,snapshot(actor,side)])));}
  diagnostics(){return Object.fromEntries([...this.rows].map(([id,row])=>[id,{gestureHand:row.inner,phase:row.exit===null?'supported':'releasing',hands:row.diagnostic}]));}
  dispose(){this.rows.clear();this.previous.clear();}
}
