import * as T from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {definitions,fk,pose} from './kinematics.mjs';
const V=(...p)=>new T.Vector3(...p),smooth=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function segment(p,a,b){const delta=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1);return{t,p:a.clone().addScaledVector(delta,t)};}
const cache=new Map();
function geometry(side,res){
 const key=side+res;if(cache.has(key))return cache.get(key).clone();
 const defs=definitions(side),rest=defs.map((d,i)=>fk(d,pose('keyboard-hover')[i])),half=V(.075,.100,.075),center=V(0,-.038,-.012);
 const field=p=>{
  let d=(Math.hypot(p.x/.031,(p.y+.012)/.041,p.z/.014)-1)*.014;
  const wrist=segment(p,V(0,.010,0),V(0,.030,0));d=smooth(d,p.distanceTo(wrist.p)-.018,.006);
  const thumb=defs[0];d=smooth(d,(Math.hypot((p.x-thumb.base[0]*.62)/.018,(p.y+.009)/.025,(p.z+.006)/.014)-1)*.014,.004);
  for(let i=0;i<5;i++)for(let j=0;j<3;j++){const a=rest[i].points[j],b=rest[i].points[j+1],s=segment(p,a,b),r=defs[i].radius*T.MathUtils.lerp(1-j*.13,.87-j*.13,s.t);d=smooth(d,p.distanceTo(s.p)-r,.0025);}
  return d;
 };
 const material=new T.MeshBasicMaterial(),cubes=new MarchingCubes(res,material,false,false,14000);cubes.isolation=0;
 for(let z=0;z<res;z++)for(let y=0;y<res;y++)for(let x=0;x<res;x++)cubes.field[x+y*res+z*res*res]=-field(V((2*x/res-1)*half.x+center.x,(2*y/res-1)*half.y+center.y,(2*z/res-1)*half.z+center.z));
 cubes.update();const p=cubes.positionArray.slice(0,cubes.count*3);cubes.geometry.dispose();material.dispose();for(let i=0;i<p.length;i+=3){p[i]=p[i]*half.x+center.x;p[i+1]=p[i+1]*half.y+center.y;p[i+2]=p[i+2]*half.z+center.z;}
 const raw=new T.BufferGeometry();raw.setAttribute('position',new T.BufferAttribute(p,3));const g=mergeVertices(raw,1e-6);raw.dispose();g.computeVertexNormals();
 const indices=[],weights=[],point=V();
 for(let n=0;n<g.attributes.position.count;n++){
  point.fromBufferAttribute(g.attributes.position,n);let best=Infinity,fi=0,seg=0,t=0;
  for(let i=0;i<5;i++)for(let j=0;j<3;j++){const s=segment(point,rest[i].points[j],rest[i].points[j+1]),distance=point.distanceToSquared(s.p);if(distance<best){best=distance;fi=i;seg=j;t=s.t;}}
  const d=defs[fi],distanceFromBase=d.lengths.slice(0,seg).reduce((a,b)=>a+b,0)+d.lengths[seg]*t;
  const palm=seg===0?1-T.MathUtils.smoothstep(distanceFromBase,0,.018):0;
  const distal=seg<2?T.MathUtils.smoothstep(t,.68,1):0;
  indices.push(0,1+fi*3+seg,1+fi*3+Math.min(2,seg+1),0);weights.push(palm,(1-palm)*(1-distal),(1-palm)*distal,0);
 }
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.computeBoundingSphere();cache.set(key,g.clone());return g;
}
export class AnatomicalSkin{
 constructor(parent,material,side){
  this.root=new T.Group();this.root.name='AnatomicalHand_'+side;parent.add(this.root);this.defs=definitions(side);this.bones=[new T.Bone()];this.bones[0].name='Palm14_'+side;
  this.levels=new Map([['room',geometry(side,32)],['close',geometry(side,48)]]);this.mesh=new T.SkinnedMesh(this.levels.get('room'),material);this.mesh.name='AnatomicalSkin14_'+side;this.mesh.add(this.bones[0]);this.root.add(this.mesh);this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
  for(let i=0;i<5;i++){let parent=this.bones[0];for(let j=0;j<3;j++){const b=new T.Bone();b.name=side+'_'+this.defs[i].name+'_'+(i===0?['CMC','MCP','IP'][j]:['MCP','PIP','DIP'][j]);b.position.fromArray(j?[0,-this.defs[i].lengths[j-1],0]:this.defs[i].base);parent.add(b);parent=b;this.bones.push(b);}}
  this.apply(pose('keyboard-hover'));this.root.updateWorldMatrix(true,true);this.skeleton=new T.Skeleton(this.bones);this.mesh.bind(this.skeleton);
  this.nailMaterial=material.clone();this.nailMaterial.color.lerp(new T.Color(0xf3dbc9),.2);this.nailMaterial.roughness=.65;this.nailGeometry=new T.SphereGeometry(1,10,6);this.nails=new T.InstancedMesh(this.nailGeometry,this.nailMaterial,5);this.nails.name='Nails14_'+side;this.nails.instanceMatrix.setUsage(T.DynamicDrawUsage);this.nails.frustumCulled=false;this.root.add(this.nails);this.setDetail('room');
 }
 apply(angles,settings=[]){
  this.positions=this.defs.map((d,i)=>{
   const a=angles[i],s=settings[i]??{},f=fk(d,a,s.spread??d.spread,s.opposition??d.opposition);
   const root=this.bones[1+i*3];root.quaternion.copy(f.quats[0]);for(let j=1;j<3;j++)this.bones[1+i*3+j].quaternion.setFromAxisAngle(V(1,0,0),a[j]);
   if(this.nails){const n=new T.Object3D();n.position.copy(f.points[3]).lerp(f.points[2],.40).add(V(0,0,.0045).applyQuaternion(f.quats[2]));n.quaternion.copy(f.quats[2]);n.scale.set(i===0?.0045:.0038,.0052,.0012);n.updateMatrix();this.nails.setMatrixAt(i,n.matrix);}
   return f.points;
  });
  if(this.nails)this.nails.instanceMatrix.needsUpdate=true;this.root.updateWorldMatrix(false,true);this.skeleton?.update();
 }
 setDetail(level){this.detail=level==='close'?'close':'room';this.mesh.geometry=this.levels.get(this.detail);if(this.nails)this.nails.visible=this.detail==='close';}
 diagnostics(){return{version:4,kind:'anatomical-hierarchical-skin',bones:16,triangles:this.mesh.geometry.index.count/3,detail:this.detail};}
 dispose(){this.root.removeFromParent();this.skeleton.dispose();for(const g of this.levels.values())g.dispose();this.nails.dispose();this.nailGeometry.dispose();this.nailMaterial.dispose();}
}
