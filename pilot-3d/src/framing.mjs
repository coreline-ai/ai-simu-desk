import {Vector3} from 'three';
export function fitOrthographic(camera,bounds,aspect,padding=1.08){
 camera.updateMatrixWorld(true);
 let x=0,y=0;
 for(const a of [bounds.min.x,bounds.max.x])for(const b of [bounds.min.y,bounds.max.y])for(const c of [bounds.min.z,bounds.max.z]){
  const point=new Vector3(a,b,c).applyMatrix4(camera.matrixWorldInverse);x=Math.max(x,Math.abs(point.x));y=Math.max(y,Math.abs(point.y));
 }
 const half=Math.max(y,x/Math.max(.1,aspect))*padding;
 camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
}
