import * as T from'three';
// A small continuous sleeve/trouser surface, weighted only across its two real joints.
// Keeps fabric connected during deep knee bends and overhead arm poses.
export function clothLimb(parent,name,bones,origin,length,joint,radii,mat){
 const rings=24,sides=16,positions=[],normals=[],uv=[],weights=[],indices=[],skin=[];
 for(let ring=0;ring<=rings;ring++){
  const t=ring/rings,d=t*length,r=T.MathUtils.lerp(radii[0],radii[1],t),blend=T.MathUtils.smoothstep(d,joint-.065,joint+.065);
  for(let i=0;i<=sides;i++){const angle=i/sides*Math.PI*2,x=Math.cos(angle),z=Math.sin(angle);positions.push(origin[0]+x*r,origin[1]-d,origin[2]+z*r);normals.push(x,0,z);uv.push(i/sides,t*2);skin.push(0,1,0,0);weights.push(1-blend,blend,0,0);
   if(ring<rings&&i<sides){const a=ring*(sides+1)+i,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skin,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setIndex(indices);
 const mesh=new T.SkinnedMesh(geometry,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);parent.updateWorldMatrix(true,true);const skeleton=new T.Skeleton(bones);mesh.bind(skeleton);mesh.frustumCulled=false;return mesh;
}
export function bone(parent,name,p){const b=new T.Bone();b.name=name;b.position.fromArray(p);parent.add(b);return b;}
