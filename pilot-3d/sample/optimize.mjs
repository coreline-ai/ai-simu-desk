import * as T from 'three';
const signature=m=>JSON.stringify([m.type,m.color?.getHex(),m.roughness,m.metalness,m.emissive?.getHex(),m.emissiveIntensity,m.opacity,m.transparent,m.side,m.userData.textureKind]);
export function modelCost(root){let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});return {meshes,triangles};}
// Only direct rigid leaf meshes can be instanced. Parents, skins and motion bindings survive.
export function optimizeRigid(root,{actors=false}={}){
 const before=modelCost(root),materials=new Map(),nodes=[];let parts=0;root.traverse(n=>nodes.push(n));
 for(const node of nodes){let insideActor=false;for(let p=node;p;p=p.parent)if(p.userData.translationOwner==='runtime')insideActor=true;if(insideActor&&!actors)continue;
  const buckets=new Map();for(const child of node.children){if(!child.isMesh||child.isSkinnedMesh||child.isInstancedMesh||child.children.length||Array.isArray(child.material)||/Eye|Iris|Glint/.test(child.name))continue;const mk=signature(child.material);if(!materials.has(mk))materials.set(mk,child.material);child.material=materials.get(mk);const key=child.geometry.uuid+mk;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(child);}
  for(const children of buckets.values()){if(children.length<2)continue;const joined=new T.InstancedMesh(children[0].geometry,children[0].material,children.length);joined.name=node.name+'_Instances_'+parts;joined.castShadow=children.some(o=>o.castShadow);joined.receiveShadow=children.some(o=>o.receiveShadow);joined.userData.parts=children.map(o=>o.name);children.forEach((child,i)=>{child.updateMatrix();joined.setMatrixAt(i,child.matrix);node.remove(child);});joined.instanceMatrix.needsUpdate=true;joined.computeBoundingBox();joined.computeBoundingSphere();node.add(joined);parts+=children.length;}
 }
 root.userData.optimization={before,after:modelCost(root),instancedParts:parts};return root.userData.optimization;
}
