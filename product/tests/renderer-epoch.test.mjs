import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {releaseModel} from '../../pilot-3d/src/scene.mjs';

test('context loss releases GPU listeners while preserving real CPU geometry, instance matrices and morph texture',()=>{
 const scene=new T.Scene(),geometry=new T.BoxGeometry(),texture=new T.DataTexture(new Uint8Array([1,2,3,255]),1,1),material=new T.MeshStandardMaterial({map:texture}),mesh=new T.InstancedMesh(geometry,material,2);
 mesh.morphTexture=new T.DataTexture(new Float32Array([.1,.2,.3,.4]),2,2,T.RedFormat,T.FloatType);
 mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(1,2,3));mesh.position.set(4,5,6);scene.add(mesh);
 const vertices=geometry.attributes.position.array,instances=mesh.instanceMatrix.array,morph=mesh.morphTexture,events=[];
 for(const [name,resource] of Object.entries({geometry,material,texture,mesh}))resource.addEventListener('dispose',()=>events.push(name));
 releaseModel(scene,{contextLost:true});
 assert.deepEqual(events.sort(),['geometry','material','mesh','texture']);assert.equal(geometry.attributes.position.array,vertices);assert.equal(mesh.instanceMatrix.array,instances);assert.equal(mesh.morphTexture,morph);assert.deepEqual(mesh.position.toArray(),[4,5,6]);assert.equal(mesh.parent,scene);assert.equal(material.map,texture);assert.deepEqual([...texture.image.data],[1,2,3,255]);
 releaseModel(scene);assert.equal(mesh.morphTexture,null,'final teardown retains normal InstancedMesh disposal');
});

test('context loss clears the skin GPU texture and Three regenerates it from the preserved bone pose',()=>{
 const bone=new T.Bone();bone.position.set(1,2,3);bone.updateMatrixWorld();const skeleton=new T.Skeleton([bone]);skeleton.update();skeleton.computeBoneTexture();
 const mesh=new T.SkinnedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial());mesh.skeleton=skeleton;const scene=new T.Scene();scene.add(mesh);
 const before=[...skeleton.boneMatrices],old=skeleton.boneTexture;let disposed=0;old.addEventListener('dispose',()=>disposed++);
 releaseModel(scene,{contextLost:true});assert.equal(disposed,1);assert.equal(skeleton.boneTexture,null);assert.deepEqual([...skeleton.boneMatrices],before);
 skeleton.computeBoneTexture();assert(skeleton.boneTexture?.isTexture);assert.notEqual(skeleton.boneTexture,old);assert.deepEqual([...skeleton.boneMatrices],before);assert.equal(mesh.skeleton.bones[0],bone);skeleton.dispose();
});
