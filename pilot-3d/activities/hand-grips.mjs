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
  constructor(hand,side){
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
  }
  contacts(prop,kind){
    if(!prop)return [V(.022,-.035,.015),V(-.020,-.090,.010),V(.004,-.038,.018),V(.019,-.04,.012),V(.031,-.039,.01)];
    prop.updateWorldMatrix(true,true);this.hand.updateWorldMatrix(true,false);
    const local=p=>this.hand.worldToLocal(prop.localToWorld(p));
    if(kind==='cup')return [local(V(.051,.019,.019)),local(V(.044,-.019,.026)),local(V(.044,.004,.034)),local(V(.044,.025,.012)),local(V(.044,.020,-.020))];
    prop.geometry.computeBoundingBox();const b=prop.geometry.boundingBox;
    if(kind==='page'){
      const h=prop.worldToLocal(this.hand.getWorldPosition(V())),x=T.MathUtils.clamp(h.x,b.min.x+.006,b.max.x-.006),z=T.MathUtils.clamp(h.z,b.min.z+.006,b.max.z-.006);
      const fingerX=d=>T.MathUtils.clamp(x+d,b.min.x+.001,b.max.x-.001);
      return [local(V(x,b.max.y+.001,z)),local(V(fingerX(-.014),b.min.y-.001,z)),local(V(fingerX(.012),b.min.y-.001,z)),local(V(fingerX(.020),b.min.y-.001,z)),local(V(fingerX(.025),b.min.y-.001,z))];
    }
    const h=prop.worldToLocal(this.hand.getWorldPosition(V())),level=T.MathUtils.clamp(h.y,b.min.y+.012,b.max.y-.012),r=Math.max(Math.abs(b.min.x),Math.abs(b.max.x))+.001;
    return [local(V(r,level,0)),local(V(-r,level+.006,0)),local(V(0,level-.010,r)),local(V(r,level-.022,0)),local(V(r,level-.030,0))];
  }
  apply(dt,desired,prop,kind){
    this.blend+=T.MathUtils.clamp(desired-this.blend,-dt*5,dt*5);
    for(const {node}of this.original)node.visible=false;this.root.visible=true;
    const targets=this.contacts(prop,kind);this.error=0;this.maxReach=0;
    this.fingers.forEach((f,i)=>{
      const target=f.end.clone().lerp(targets[i],this.blend),axis=target.clone().sub(f.base),raw=axis.length(),[a,b]=f.lengths,d=T.MathUtils.clamp(raw,.009,a+b-.0001);axis.normalize();
      const end=f.base.clone().addScaledVector(axis,d),pole=V(0,0,1),bend=pole.addScaledVector(axis,-pole.dot(axis)).normalize(),along=(a*a-b*b+d*d)/(2*d),mid=f.base.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
      for(const [j,p,q]of [[0,f.base,mid],[1,mid,end]]){const link=f.links[j];link.position.copy(p).add(q).multiplyScalar(.5);link.quaternion.setFromUnitVectors(Y,q.clone().sub(p).normalize());link.updateMatrix();this.batch.setMatrixAt(i*2+j,link.matrix);}
      f.pad.position.copy(end);this.maxReach=Math.max(this.maxReach,raw);
      if(prop&&i<3&&this.blend>.995)this.error=Math.max(this.error,end.distanceTo(targets[i]));
    });
    this.batch.instanceMatrix.needsUpdate=true;this.hand.updateWorldMatrix(false,true);
  }
  dispose(){for(const {node,visible}of this.original)node.visible=visible;this.root.removeFromParent();this.batch.dispose();for(const g of this.geometries)g.dispose();}
  diagnostics(){return{blend:this.blend,padError:this.error,maxReach:this.maxReach,fingers:this.fingers.length};}
}
export class HandGrips{
  constructor(actors,desks,cups,ids){this.desks=desks;this.cups=cups;this.rows=new Map(ids.map(id=>[id,{R:new HandGrip(part(actors[id],'NaraHandR'),'R'),L:new HandGrip(part(actors[id],'NaraHandL'),'L')}]));}
  apply(id,dt,override){const row=this.rows.get(id);if(!row)return;const d=this.desks[id],c=this.cups[id];row.R.apply(dt,override?.R?.blend??amount(d.stage,d.time),override?.R?.prop??d.prop,override?.R?.kind??(id==='leo'?'page':'pen'));row.L.apply(dt,override?.L?.blend??amount(c.state,c.time,true),override?.L?.prop??c.mug,override?.L?.kind??'cup');}
  diagnostics(){return Object.fromEntries([...this.rows].map(([id,row])=>[id,Object.fromEntries(Object.entries(row).map(([side,hand])=>[side,hand.diagnostics()]))]));}
  dispose(){for(const row of this.rows.values())for(const hand of Object.values(row))hand.dispose();this.rows.clear();}
}
