import {createBoneTextureAtlas} from '../sample/bone-texture-atlas.mjs';
import {paperBendAt} from '../ensemble-office/props.mjs';
import {HandSurface} from '../ensemble-office/hand-surface.mjs';
import {HandRevision} from '../hand-v14/adapter.mjs';
import {HandSkin} from '../character-personalities/hand-skin.mjs';
import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0);
function amount(stage,time,cup=false){
  if(['grasp','tableGrasp'].includes(stage))return ease(time/(cup?.25:.3));
  if(['use','replace','lift','sip','lower','place','carry','tablePlace'].includes(stage))return 1;
  if(stage==='release')return 1-ease(time/(cup?.35:.3));
  return 0;
}
// Two phalanges per controlled finger. Only their joints move; their lengths stay
// fixed. The existing wrist solver and prop owner remain the contact authority.
class HandGrip{
  constructor(hand,side,{refined=false,enhanced=false,smoothHands=false}={}){
    this.refined=refined;this.enhanced=enhanced;this.smoothHands=smoothHands&&enhanced;this.contactRows=[];
    this.hand=hand;this.side=side;this.original=hand.children.map(node=>({node,visible:node.visible}));
    const material=hand.children.find(n=>n.material)?.material;
    this.root=new T.Group();this.root.name='ContinuousHand'+side;hand.add(this.root);
    this.geometries=[];this.fingers=[];this.blend=0;this.error=0;this.maxReach=0;
    const palmGeometry=new T.SphereGeometry(1,12,8);palmGeometry.scale(.040,.045,.026);this.geometries.push(palmGeometry);
    const palm=new T.Mesh(palmGeometry,material);palm.castShadow=true;this.root.add(palm);
    const sign=side==='L'?-1:1;
    const linkGeometry=new T.CapsuleGeometry(.0075,.018,3,8);this.geometries.push(linkGeometry);this.batch=new T.InstancedMesh(linkGeometry,material,10);this.batch.name='GripPhalanges';this.batch.castShadow=true;this.batch.frustumCulled=false;this.batch.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(this.batch);
    for(let i=0;i<5;i++){
      const thumb=i===0,base=thumb?V(sign*.031,.004,.005):V(-.027+(i-1)*.018,-.022,.007);
      const end=thumb?V(sign*.057,-.029,.024):V(base.x,-.086+(i===1||i===4?.009:0),.011);
      const lengths=thumb?[.035,.032]:[.039,.034],links=[];
      for(const length of lengths){const link=new T.Object3D();link.scale.set(thumb?1.2:1,length/.033,thumb?1.2:1);links.push(link);}
      const pad=new T.Object3D();pad.name='GripPad'+i;this.root.add(pad);
      this.fingers.push({base,end,lengths,links,pad});
    }
    this.surface=enhanced?(this.smoothHands?new HandSkin(this.root,material,side,this.fingers):new HandSurface(this.root,material,side)):null;
    palm.visible=this.batch.visible=!this.smoothHands;
    // A paused/reduced-motion runtime may never tick before its first render.
    // Populate every instance now; default unit-sphere matrices hide the actors.
    this.apply(0,0,null);
  }
  shaftContact(prop,point,index,local){
    // Slide the support along the real shaft, never shorten a far-away target
    // in empty space or stretch a phalanx to make the diagnostic pass.
    const finger=this.fingers[index],radius=finger.lengths[0]+finger.lengths[1]-.0015,box=prop.geometry.boundingBox;
    const attempt=point=>{const origin=local(V(point.x,0,point.z)),axis=local(V(point.x,1,point.z)).sub(origin),offset=origin.clone().sub(finger.base),a=axis.lengthSq(),b=2*axis.dot(offset),distance=offset.lengthSq(),outer=b*b-4*a*(distance-radius*radius);
      if(outer<0||a<1e-12)return null;
      const root=Math.sqrt(outer),lo=Math.max(box.min.y+.012,(-b-root)/(2*a)),hi=Math.min(box.max.y-.012,(-b+root)/(2*a));if(lo>hi)return null;
      const inner=b*b-4*a*(distance-.010*.010),intervals=inner>0?[[lo,Math.min(hi,(-b-Math.sqrt(inner))/(2*a))],[Math.max(lo,(-b+Math.sqrt(inner))/(2*a)),hi]]:[[lo,hi]];
      const choices=intervals.filter(([low,high])=>low<=high).map(([low,high])=>T.MathUtils.clamp(point.y,low,high)).sort((x,y)=>Math.abs(x-point.y)-Math.abs(y-point.y));
      return choices.length?local(V(point.x,choices[0],point.z)):null;
    };
    const direct=attempt(point);if(direct)return direct;
    const angle=Math.atan2(point.z,point.x),r=Math.hypot(point.x,point.z);
    for(let step=1;step<=8;step++)for(const sign of [-1,1]){const next=angle+step*sign*Math.PI/8,contact=attempt(V(Math.cos(next)*r,point.y,Math.sin(next)*r));if(contact)return contact;}
    return local(point);
  }
  contacts(prop,kind){
    if(!prop)return [V(.022,-.035,.015),V(-.020,-.090,.010),V(.004,-.038,.018),V(.019,-.04,.012),V(.031,-.039,.01)];
    prop.updateWorldMatrix(true,true);this.hand.updateWorldMatrix(true,false);
    const transform=this.refined?this.hand.matrixWorld.clone().invert().multiply(prop.matrixWorld):null;
    const local=p=>transform?p.applyMatrix4(transform):this.hand.worldToLocal(prop.localToWorld(p));
    if(kind==='button')return this.fingers.map((f,i)=>i===1?local(V(0,.0065,0)):f.end.clone());
    if(kind==='cup'&&prop.userData.handGrip)return prop.userData.handGrip.contacts.map(p=>local(V(...p)));
    if(kind==='cup-support'&&prop.userData.supportGrip)return prop.userData.supportGrip.contacts.map(p=>local(V(...p)));
    if(kind==='cup')return [local(V(.051,.019,.019)),local(V(.044,-.019,.026)),local(V(.044,.004,.034)),local(V(.044,.025,.012)),local(V(.044,.020,-.020))];
    prop.geometry.computeBoundingBox();const b=prop.geometry.boundingBox;
    if(kind==='page'){
      const h=prop.worldToLocal(this.hand.getWorldPosition(V())),x=T.MathUtils.clamp(h.x,b.min.x+.006,b.max.x-.006),z=T.MathUtils.clamp(h.z,b.min.z+.006,b.max.z-.006);
      const fingerX=d=>T.MathUtils.clamp(x+d,b.min.x+.001,b.max.x-.001);
      const surface=(x,top)=>{const data=prop.userData.pageBend;return local(V(x,(data?(top?data.top:data.bottom):top?b.max.y:b.min.y)+(top?.001:-.001)+paperBendAt(data,x,z),z));};
      return [surface(x,true),...[-.014,.012,.020,.025].map(d=>surface(fingerX(d),false))];
    }
    const h=prop.worldToLocal(this.hand.getWorldPosition(V())),level=T.MathUtils.clamp(h.y,b.min.y+.012,b.max.y-.012),r=Math.max(Math.abs(b.min.x),Math.abs(b.max.x))+.001;
    const points=[V(r,level,0),V(-r,level+.006,0),V(0,level-.010,r),V(r,level-.022,0),V(r,level-.030,0)];
    return points.map((point,index)=>this.refined&&this.blend>.001?this.shaftContact(prop,point,index,local):local(point));
  }
  advanceBlend(dt,desired){this.blend+=T.MathUtils.clamp(desired-this.blend,-dt*5,dt*5);}
  hideOriginal(){for(const {node}of this.original)node.visible=false;}
  apply(dt,desired,prop,kind,points){
    this.advanceBlend(dt,desired);
    this.hideOriginal();this.root.visible=true;
    const targets=points?this.fingers.map((f,i)=>points[i]?this.hand.worldToLocal(V(...points[i])):kind==='glasses'?(i===0?V(.042,-.020,.026):V(f.end.x,-.040+(i===4?.006:0),.035)):f.end.clone()):this.contacts(prop,kind);this.error=0;this.maxReach=0;this.contactRows=[];
    this.fingers.forEach((f,i)=>{
      const authored=this.smoothHands&&this.presentation&&this.blend<.001,relaxed=f.end.clone();if(this.relaxation&&!authored){const curl=this.relaxation.curl;if(i===0){relaxed.x*=1-.18*curl;relaxed.z+=.014*curl;}else{relaxed.x+=(i-2.5)*(this.relaxation.spread??0);relaxed.y+=.014+.018*curl+(i===4?.005:0);relaxed.z+=.012+.020*curl;}}
      if(authored){const curl=T.MathUtils.clamp(this.presentation[i]??0,0,1);if(i===0){relaxed.x*=1-.25*curl;relaxed.y+=curl*.015;relaxed.z+=curl*.020;}else{const straight=f.base.clone().addScaledVector(f.end.clone().sub(f.base).normalize(),(f.lengths[0]+f.lengths[1])*.97),bent=f.end.clone().add(V(0,.035,.040));relaxed.copy(straight).lerp(bent,curl);}}
      const fingerBlend=this.smoothHands?ease(T.MathUtils.clamp((this.blend-[.02,0,.035,.07,.1][i])/(1-[.02,0,.035,.07,.1][i]),0,1)):this.blend;
      const target=relaxed.lerp(targets[i],fingerBlend),axis=target.clone().sub(f.base),raw=axis.length(),[a,b]=f.lengths,d=T.MathUtils.clamp(raw,.009,a+b-.0001);axis.normalize();
      const end=f.base.clone().addScaledVector(axis,d),pole=V(0,0,1),bend=pole.addScaledVector(axis,-pole.dot(axis)).normalize(),along=(a*a-b*b+d*d)/(2*d),mid=f.base.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
      for(const [j,p,q]of [[0,f.base,mid],[1,mid,end]]){const link=f.links[j];link.position.copy(p).add(q).multiplyScalar(.5);link.quaternion.setFromUnitVectors(Y,q.clone().sub(p).normalize());link.updateMatrix();this.batch.setMatrixAt(i*2+j,link.matrix);}
      f.pad.position.copy(end);this.maxReach=Math.max(this.maxReach,raw);
      if(prop&&this.blend>.995&&(!points||points[i])){const error=end.distanceTo(targets[i]);if(this.refined||i<3)this.error=Math.max(this.error,error);if(this.refined)this.contactRows.push({finger:['thumb','index','middle','ring','little'][i],role:kind==='glasses'?'rim-contact':i<3?'grip':'support',error,reachable:raw<=a+b-.0001&&raw>=.009,target:targets[i].toArray(),actual:end.toArray()});}
    });
    this.surface?.update(this.fingers);this.batch.instanceMatrix.needsUpdate=true;this.hand.updateWorldMatrix(false,true);
  }
  dispose(){this.surface?.dispose();for(const {node,visible}of this.original)node.visible=visible;this.root.removeFromParent();this.batch.dispose();for(const g of this.geometries)g.dispose();}
  diagnostics(){return{surfaceVersion:this.smoothHands?3:this.enhanced?2:1,skin:this.surface?.diagnostics?.(),blend:this.blend,padError:this.error,maxReach:this.maxReach,fingers:this.fingers.length,...(this.refined?{contactScope:'five-finger-target-points',contacts:this.contactRows}: {})};}
}
export class HandGrips{
  constructor(actors,desks,cups,ids,options={}){this.desks=desks;this.cups=cups;this.rows=new Map(ids.map(id=>[id,Object.fromEntries(['R','L'].map(side=>{const legacy=new HandGrip(part(actors[id],'NaraHand'+side),side,{...options,enhanced:!!actors[id].userData.ensembleAsset});return [side,options.anatomicalActors?.includes(id)?new HandRevision(legacy,{actor:actors[id],id,side,desk:desks[id],cup:cups[id],scheduler:options.scheduler,model:options.model}):legacy];}))]));
    if(options.sharedLegacyHandTexture){const surfaces=[...this.rows.values()].flatMap(row=>Object.values(row).map(hand=>(hand.legacy??hand).surface)).filter(s=>s?.mesh?.isSkinnedMesh);this.textureAtlas=createBoneTextureAtlas(surfaces.map(s=>({mesh:s.mesh,geometries:[...s.levels.values()].map(l=>l.geometry)})));}
  }
  setRelaxation(id,profile){const row=this.rows.get(id);if(row)for(const side of['L','R'])row[side].relaxation=profile?.free?.[side]?{curl:profile.curl,spread:profile.spread??0}:null;}
  setPresentation(id,poses){const row=this.rows.get(id);if(row)for(const side of['L','R'])row[side].presentation=poses?.[side]??null;}
  setDetail(level){if(level===this.detailLevel)return;this.detailLevel=level;for(const row of this.rows.values())for(const side of['L','R']){if(row[side].setDetail)row[side].setDetail(level);else row[side].surface?.setDetail?.(level);}}
  apply(id,dt,override){const row=this.rows.get(id);if(!row)return;const d=this.desks[id],c=this.cups[id];row.R.apply(dt,override?.R?.blend??(d.personal&&id==='jun'?0:amount(d.stage,d.time)),override?.R?.prop??d.prop,override?.R?.kind??(id==='leo'?'page':'pen'),override?.R?.points);row.L.apply(dt,override?.L?.blend??(c.personal&&c.state==='release'?1-ease(c.time/c.duration()):amount(c.state,c.time,true)),override?.L?.prop??c.mug,override?.L?.kind??'cup',override?.L?.points);}
  diagnostics(){return Object.fromEntries([...this.rows].map(([id,row])=>[id,Object.fromEntries(Object.entries(row).map(([side,hand])=>[side,hand.diagnostics()]))]));}
  dispose(){this.textureAtlas?.dispose();for(const row of this.rows.values())for(const hand of Object.values(row))hand.dispose();this.rows.clear();}
}
