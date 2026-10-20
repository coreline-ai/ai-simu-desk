import * as T from 'three';
export const SURFACES=Object.freeze({oak:{size:512,normal:.35},stone:{size:512,normal:.22},fabric:{size:256,normal:.28},linen:{size:256,normal:.22},plaster:{size:256,normal:.16}});
const tau=Math.PI*2;
export function surfaceSample(kind,u,v){
 let h,base,rough;
 if(kind==='oak'){const grain=Math.sin(v*tau*22+Math.sin(u*tau*2)*.7+Math.sin(u*tau*5)*.12),fine=Math.sin(v*tau*76+Math.sin(u*tau*3)*.3);h=.5+grain*.23+fine*.08;base=[196+grain*7+fine*2,160+grain*8+fine*2,112+grain*6];rough=.71+grain*.035+fine*.015;}
 else if(kind==='stone'){const x=u*16,y=v*16,cx=Math.floor(x),cy=Math.floor(y),hash=Math.sin((cx%16+16)%16*12.9898+(cy%16+16)%16*78.233)*43758.5453,jitter=(hash-Math.floor(hash))-.5,dx=x-cx-.5-jitter*.35,dy=y-cy-.5+jitter*.22,r=.10+Math.abs(jitter)*.15,d=Math.hypot(dx,dy),chip=Math.max(0,Math.min(1,(r-d)*45));h=.5-chip*.08+Math.sin(u*tau*48)*Math.sin(v*tau*48)*.008;const tint=jitter>0?[186,174,153]:[196,201,184];base=[227,223,211].map((n,i)=>n*(1-chip)+tint[i]*chip);rough=.86-chip*.07;}
 else if(kind==='plaster'){h=.5+Math.sin(u*tau*19)*Math.sin(v*tau*23)*.06+Math.sin(u*tau*5+v*tau*7)*.025;base=[248,247,243].map(n=>n+(h-.5)*10);rough=.93+(h-.5)*.08;}
 else {const period=kind==='linen'?32:64,weave=Math.sin(u*tau*period)*Math.cos(v*tau*period);h=.5+weave*.13+Math.sin(u*tau*8+v*tau*4)*.025;base=[247,246,240].map(n=>n+weave*3);rough=.91+weave*.035;}
 return {height:h,color:base,roughness:rough};
}
export function surfacePixels(kind,map){
 const size=SURFACES[kind].size,bytes=new Uint8Array(size*size*4),epsilon=1/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size,s=surfaceSample(kind,u,v);let c;
  if(map==='normal'){const dx=surfaceSample(kind,u+epsilon,v).height-surfaceSample(kind,u-epsilon,v).height,dy=surfaceSample(kind,u,v+epsilon).height-surfaceSample(kind,u,v-epsilon).height,n=new T.Vector3(-dx*2,-dy*2,1).normalize();c=[(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255];}
  else c=map==='orm'?[255,s.roughness*255,0]:s.color;
  bytes.set([...c.map(n=>Math.round(Math.max(0,Math.min(255,n)))),255],(y*size+x)*4);
 }return {size,bytes};
}
function actorOwned(node){for(let n=node;n;n=n.parent)if(n.userData.translationOwner)return true;return false;}
export function applyRoomSurfaces(root){
 const mats=new Map(),geometries=new Map();
 root.traverse(node=>{if(!node.isMesh||actorOwned(node))return;const original=node.material,kind=original.userData.textureKind??(/SagePlaster/.test(original.name)?'plaster':/ChairSlat/.test(original.name)?'oak':null);if(!SURFACES[kind])return;
  if(!mats.has(original)){const next=original.clone();next.name=original.name+'_RoomSurface';next.roughness=1;next.userData={...original.userData,roomSurface:kind};if(kind==='oak')next.color.set(0xffffff);mats.set(original,next);}node.material=mats.get(original);
  const key=node.geometry.uuid+':'+kind;if(!geometries.has(key)){const geometry=node.geometry.clone(),pos=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
   if(kind==='oak'&&geometry.type==='RoundedBoxGeometry'){geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new T.Vector3()),vertical=size.y>Math.max(size.x,size.z);for(let i=0;i<uv.count;i++){const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i));uv.setXY(i,(vertical?pos.getY(i):nx>.5?pos.getZ(i):pos.getX(i))*.9,(vertical?(nx>.5?pos.getZ(i):pos.getX(i)):ny>.5?pos.getZ(i):pos.getY(i))*.9);}}else if(kind==='oak'&&geometry.type==='CapsuleGeometry'){for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,v,u);}}
   else if(['fabric','linen','plaster'].includes(kind))for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(kind==='plaster'?2:4),uv.getY(i)*(kind==='plaster'?2:4));
   geometries.set(key,geometry);
  }node.geometry=geometries.get(key);
 });
 return {materialVariants:mats.size,textureKinds:Object.keys(SURFACES),rgbaEstimate:Object.values(SURFACES).reduce((n,s)=>n+s.size*s.size*4*4/3*3,0)};
}
