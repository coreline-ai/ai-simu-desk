import * as T from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const Y=new T.Vector3(0,1,0),V=(...p)=>new T.Vector3(...p);
const templates=new Map();
const smooth=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function segment(p,a,b){const d=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);return{t,point:a.clone().addScaledVector(d,t)};}
function restFinger(f){
 const axis=f.end.clone().sub(f.base),distance=Math.min(axis.length(),f.lengths[0]+f.lengths[1]-.0001),[a,b]=f.lengths;axis.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),bend=V(0,0,1).addScaledVector(axis,-axis.z).normalize();
 return{base:f.base.clone(),mid:f.base.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along))),end:f.base.clone().addScaledVector(axis,distance),lengths:f.lengths};
}

// A welded implicit palm/finger surface, generated once per resolution/side.
// Runtime motion is GPU skinning, never re-meshing or stretching contact targets.
function geometryFor(fingers,side,resolution){
 const key=side+':'+resolution;if(templates.has(key)){const t=templates.get(key);return{geometry:t.geometry.clone(),rests:t.rests};}
 const rests=fingers.map(restFinger),half=V(.087,.096,.065),center=V(0,-.025,.012);
 const field=p=>{
  let d=(Math.hypot(p.x/.037,p.y/.041,p.z/.021)-1)*.021;
  const wrist=segment(p,V(0,.018,0),V(0,.044,0));d=smooth(d,p.distanceTo(wrist.point)-.018,.007);
  for(let i=0;i<rests.length;i++){
   const f=rests[i],radius=[.009,.0077,.0081,.0074,.0066][i];
   for(const[a,b,ra,rb]of[[f.base,f.mid,radius,radius*.86],[f.mid,f.end,radius*.86,radius*.67]]){
    const s=segment(p,a,b);d=smooth(d,p.distanceTo(s.point)-T.MathUtils.lerp(ra,rb,s.t),.003);
   }
  }return d;
 };
 const temporaryMaterial=new T.MeshBasicMaterial(),cubes=new MarchingCubes(resolution,temporaryMaterial,false,false,16000);cubes.isolation=0;
 for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const p=V((x/resolution*2-1)*half.x+center.x,(y/resolution*2-1)*half.y+center.y,(z/resolution*2-1)*half.z+center.z);
  cubes.field[x+y*resolution+z*resolution*resolution]=-field(p);
 }
 cubes.update();const positions=cubes.positionArray.slice(0,cubes.count*3);cubes.geometry.dispose();temporaryMaterial.dispose();
 for(let i=0;i<positions.length;i+=3){positions[i]=positions[i]*half.x+center.x;positions[i+1]=positions[i+1]*half.y+center.y;positions[i+2]=positions[i+2]*half.z+center.z;}
 const raw=new T.BufferGeometry();raw.setAttribute('position',new T.BufferAttribute(positions,3));
 const geometry=mergeVertices(raw,1e-6);raw.dispose();geometry.computeVertexNormals();
 const skin=[],weights=[],p=V();
 for(let n=0;n<geometry.attributes.position.count;n++){
  p.fromBufferAttribute(geometry.attributes.position,n);let best=Infinity,chosen=0,along=0;
  for(let i=0;i<rests.length;i++){
   const f=rests[i];for(const[a,b,offset]of[[f.base,f.mid,0],[f.mid,f.end,f.lengths[0]]]){
    const s=segment(p,a,b),distance=p.distanceToSquared(s.point);
    if(distance<best){best=distance;chosen=i;along=offset+s.t*a.distanceTo(b);}
   }
  }
  const f=rests[chosen],palm=1-T.MathUtils.smoothstep(along,0,.023),distal=T.MathUtils.smoothstep(along,f.lengths[0]-.009,f.lengths[0]+.009),tip=T.MathUtils.smoothstep(along,f.lengths[0]+f.lengths[1]-.019,f.lengths[0]+f.lengths[1]-.003);
  skin.push(0,1+chosen*3,2+chosen*3,3+chosen*3);
  weights.push(palm,(1-palm)*(1-distal),(1-palm)*distal*(1-tip),(1-palm)*distal*tip);
 }
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skin,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={handSkin:true,side,resolution};templates.set(key,{geometry:geometry.clone(),rests});return{geometry,rests};
}

export class HandSkin {
 constructor(parent,material,side,fingers){
  this.root=new T.Group();this.root.name='SculptedHand_'+side;parent.add(this.root);
  this.levels=new Map();for(const[level,res]of[['room',32],['close',46]])this.levels.set(level,geometryFor(fingers,side,res));
  const rest=this.levels.get('room'),bones=[new T.Bone()];bones[0].name='HandPalm_'+side;
  this.mesh=new T.SkinnedMesh(rest.geometry,material);this.mesh.name='ContinuousHandSkin_'+side;this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;this.root.add(this.mesh);this.mesh.add(bones[0]);
  for(let i=0;i<5;i++){
   const f=rest.rests[i],a=f.mid.clone().sub(f.base).normalize(),b=f.end.clone().sub(f.mid).normalize();
   for(const[j,point,axis]of[[0,f.base,a],[1,f.mid,b],[2,f.end,b]]){const bone=new T.Bone();bone.name=`Hand_${side}_${i}_${j}`;bone.position.copy(point);bone.quaternion.setFromUnitVectors(Y,axis);bones[0].add(bone);bones.push(bone);}
  }
  this.root.updateWorldMatrix(true,true);this.skeleton=new T.Skeleton(bones);this.mesh.bind(this.skeleton);this.bones=bones;
  this.nailMaterial=material.clone();this.nailMaterial.color.lerp(new T.Color(0xf1d6c5),.16);this.nailMaterial.roughness=.7;
  this.nailGeometry=new T.SphereGeometry(1,10,6);this.nails=new T.InstancedMesh(this.nailGeometry,this.nailMaterial,5);this.nails.name='SculptedNails_'+side;this.nails.instanceMatrix.setUsage(T.DynamicDrawUsage);this.nails.frustumCulled=false;this.root.add(this.nails);
  this.matrix=new T.Matrix4();this.node=new T.Object3D();this.setDetail('room');this.update(fingers);
 }
 update(fingers){
  for(let i=0;i<5;i++){
   const f=fingers[i],a=f.links[0],b=f.links[1],base=a.position.clone().addScaledVector(Y.clone().applyQuaternion(a.quaternion),-f.lengths[0]/2),mid=a.position.clone().addScaledVector(Y.clone().applyQuaternion(a.quaternion),f.lengths[0]/2);
   for(const[j,p,q]of[[0,base,a.quaternion],[1,mid,b.quaternion],[2,f.pad.position,b.quaternion]]){const bone=this.bones[1+i*3+j];bone.position.copy(p);bone.quaternion.copy(q);}
   this.node.position.copy(f.pad.position).lerp(mid,.32).add(V(0,0,-.0064).applyQuaternion(b.quaternion));this.node.quaternion.copy(b.quaternion);this.node.scale.set(i===0?.0052:.0046,.007,.0013);this.node.updateMatrix();this.nails.setMatrixAt(i,this.node.matrix);
  }
  this.nails.instanceMatrix.needsUpdate=true;this.root.updateWorldMatrix(false,true);this.skeleton.update();
 }
 setDetail(level){this.detail=level==='close'?'close':'room';this.mesh.geometry=this.levels.get(this.detail).geometry;this.nails.visible=this.detail==='close';}
 diagnostics(){return{version:3,kind:'welded-skinned-surface',bones:this.bones.length,vertices:this.mesh.geometry.attributes.position.count,triangles:this.mesh.geometry.index.count/3,detail:this.detail};}
 dispose(){this.root.removeFromParent();this.skeleton.dispose();for(const{geometry}of this.levels.values())geometry.dispose();this.nailGeometry.dispose();this.nailMaterial.dispose();this.nails.dispose();}
}
