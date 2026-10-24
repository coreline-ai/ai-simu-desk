import {Skeleton,DataTexture,RGBAFormat,FloatType} from 'three';

// One matrix per four-pixel row: the stock Three skinning shader uses the
// texture width, not a square layout. No custom shader or matrix precision loss.
class PaletteSkeleton extends Skeleton {
 update(){
  // Match Three's visible-mesh update policy: hidden fallback hands do not
  // acquire extra per-frame bone work just because they share GPU storage.
  for(const {mesh,skeleton}of this.slots){let node=mesh;while(node?.visible)node=node.parent;if(!node)skeleton.update();}
  if(this.boneTexture)this.boneTexture.needsUpdate=true;
 }
 computeBoneTexture(){
  if(!this.boneTexture){this.boneTexture=new DataTexture(this.boneMatrices,4,this.bones.length,RGBAFormat,FloatType);this.boneTexture.name='LegacyHandBoneAtlas';this.boneTexture.needsUpdate=true;}
  return this;
 }
}

export function createBoneTextureAtlas(bindings){
 if(bindings.length<2)return null;
 const meshes=new Set(),skeletons=new Set(),geometries=new Set();let count=0;
 // Validate everything before changing an owned mesh, buffer or skeleton.
 const slots=bindings.map(({mesh,geometries:levels})=>{
  const skeleton=mesh?.skeleton;
  if(!mesh?.isSkinnedMesh||meshes.has(mesh)||skeletons.has(skeleton)||!skeleton?.bones.length||skeleton.boneTexture||skeleton.boneMatrices.length!==skeleton.bones.length*16)throw Error('Bone atlas needs unique, unrendered skeletons');
  const owned=[...new Set(levels)];if(!owned.includes(mesh.geometry))throw Error('Bone atlas must include the active geometry');
  for(const geometry of owned){const indices=geometry.getAttribute('skinIndex');if(geometries.has(geometry)||!(indices?.array instanceof Uint16Array))throw Error('Bone atlas needs private Uint16 skin indices');for(const i of indices.array)if(i>=skeleton.bones.length)throw Error('Bone atlas needs local skin indices');geometries.add(geometry);}
  const slot={mesh,skeleton,geometries:owned,offset:count};count+=skeleton.bones.length;meshes.add(mesh);skeletons.add(skeleton);return slot;
 });
 if(count>2048)throw Error('Bone atlas exceeds the conservative WebGL2 texture-height limit');
 const shared=new PaletteSkeleton(slots.flatMap(s=>s.skeleton.bones),slots.flatMap(s=>s.skeleton.boneInverses));shared.slots=slots;
 for(const slot of slots){
  const {mesh,skeleton,offset}=slot,view=shared.boneMatrices.subarray(offset*16,(offset+skeleton.bones.length)*16);view.set(skeleton.boneMatrices);skeleton.boneMatrices=view;
  // Use the same buffer attribute so geometry.dispose still releases its GPU
  // buffer. Both room/close geometries are private clones, never template data.
  for(const g of slot.geometries){const a=g.getAttribute('skinIndex');for(let i=0;i<a.array.length;i++)a.array[i]+=offset;a.needsUpdate=true;}
  mesh.skeleton=shared; // Global indices remain valid for CPU raycasts/bounds too.
 }
 let disposed=false;
 return{ skeleton:shared,entries:slots.length,bones:count,payloadBytes:shared.boneMatrices.byteLength,
  dispose(){
   if(disposed)return;disposed=true;
   for(const {mesh,skeleton,geometries,offset}of slots){mesh.skeleton=skeleton;skeleton.boneMatrices=skeleton.boneMatrices.slice();for(const g of geometries){const a=g.getAttribute('skinIndex');for(let i=0;i<a.array.length;i++)a.array[i]-=offset;a.needsUpdate=true;}}
   shared.dispose();shared.bones.length=0;shared.boneInverses.length=0;shared.boneMatrices=new Float32Array();slots.length=0;
  }
 };
}
