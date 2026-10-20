import * as T from 'three';
// Adapt a loaded copy only. The original v6 GLB, textures and AO remain byte-identical.
export function prepareSofa(model) {
  const sofa=model.getObjectByName('LinenSofa');if(!sofa)throw Error('소파 기준점 누락');
  if(!sofa.userData.activityPrepared)for(const node of sofa.children){const names=node.userData.parts??[node.name];if(names.every(name=>name.startsWith('SofaLeg')))continue;node.position.y-=.075;}
  sofa.userData.activityPrepared=true;
  const cushion=model.getObjectByName('OchreLooseCushion');if(cushion){cushion.position.x=.63;cushion.position.z=-.16;}
  sofa.updateWorldMatrix(true,true);
  let seatBox;
  sofa.traverse(node=>{if(!node.isMesh)return;const index=node.userData.parts?.indexOf('SofaSeat-0.48')??-1;if(node.name!=='SofaSeat-0.48'&&index<0)return;node.geometry.computeBoundingBox();const matrix=node.matrixWorld.clone();if(node.isInstancedMesh){const instance=new T.Matrix4();node.getMatrixAt(index,instance);matrix.multiply(instance);}seatBox=node.geometry.boundingBox.clone().applyMatrix4(matrix);});
  if(!seatBox)throw Error('사용 가능한 소파 좌면 누락');
  return {seatBox};
}
