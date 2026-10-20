import * as T from 'three';
import {group,mesh,box,rod,material} from '../sample/geometry.mjs';
export function skyColors(geometry,night=false){
 const positions=geometry.attributes.position,colors=geometry.attributes.color?.array??new Float32Array(positions.count*3),top=new T.Color(night?0x50627e:0xaecad5),bottom=new T.Color(night?0xbc9b87:0xf2e4cb);
 for(let i=0;i<positions.count;i++){const t=T.MathUtils.clamp((positions.getY(i)+.86)/1.72,0,1),c=bottom.clone().lerp(top,t);c.toArray(colors,i*3);}if(geometry.attributes.color)geometry.attributes.color.needsUpdate=true;else geometry.setAttribute('color',new T.BufferAttribute(colors,3));return geometry;
}
export function addOutdoors(root){
 const room=root.getObjectByName('QualityRoom');for(const node of [...room.children])if(/^(SkyPane|OutsideTree)/.test(node.name))node.removeFromParent();
 const outside=group(room,'LayeredOutdoors');outside.userData.cameraBackdrop=true;const grass=new T.MeshBasicMaterial({color:0xbcc5a4});grass.userData={dayColor:0xbcc5a4,nightColor:0x77816d};box(outside,'CourtyardGround',[14,.04,2.4],[0,.70,-4.95],grass,.005);
 const sky=mesh(outside,'SkyBackdrop',skyColors(new T.PlaneGeometry(14,1.72,1,8)),new T.MeshBasicMaterial({vertexColors:true}),[0,1.60,-4.98]);sky.userData.skyGradient=true;
 for(let layer=0;layer<2;layer++){const shape=new T.Shape();shape.moveTo(-4.72,.74);shape.lineTo(-4.72,1.08+layer*.1);for(let i=0;i<8;i++)shape.quadraticCurveTo(Math.min(4.60,-4.5+i*1.35),1.43+Math.sin(i*2.3+layer)*.18,Math.min(4.70,-3.8+i*1.22),1.10+Math.sin(i*1.3+layer)*.15);shape.lineTo(4.72,.74);shape.closePath();const m=new T.MeshBasicMaterial({color:layer?0xa5bba8:0xb8c8b6});m.userData.dayColor=layer?0xa5bba8:0xb8c8b6;m.userData.nightColor=layer?0x6b7f7c:0x879493;mesh(outside,'DistantHill'+layer,new T.ShapeGeometry(shape),m,[0,0,-4.87+layer*.12]);}
 const geometry=new T.SphereGeometry(1,16,10),leafColors=[0x829d80,0x9cad8b,0xb3bd94],leaves=leafColors.map((color,i)=>{const m=material('OutsideLeaf'+i,color,1);m.userData.dayColor=color;m.userData.nightColor=[0x576d60,0x6c7d69,0x839071][i];return m;}),bark=material('OutsideBark',0x93856c);
 for(const[i,x]of[-3.85,-1.35,1.45,3.83].entries()){const y=1.20+(i%3)*.12,z=-4.46+(i%2)*.08;rod(outside,'TreeTrunk'+i,[x,.74,z],[x,y,z],.014,bark);for(let k=0;k<3;k++){const crown=mesh(outside,'TreeCrown'+i+'_'+k,geometry,leaves[(i+k)%3],[x+(k-1)*.16,y+Math.sin(k+i)*.07,z+(k%2)*.06]);crown.scale.set(.27,.31+(i%2)*.05,.17);}}
 for(let i=0;i<8;i++){const shrub=mesh(outside,'NearShrub'+i,geometry,leaves[i%3],[-4.23+i*1.19,.88+(i%3)*.025,-4.05]);shrub.scale.set(.23,.16,.13);}
 outside.traverse(o=>{if(o.isMesh){o.userData.noShadow=true;o.castShadow=false;o.receiveShadow=false;}});
 for(let i=0;i<4;i++){const portal=mesh(room,'WindowPortal'+i,new T.PlaneGeometry(2.26,1.70),new T.MeshBasicMaterial(),[-3.57+i*2.38,1.56,-3.765]);portal.userData={noShadow:true,windowPortal:true};const glass=root.getObjectByName('Glass'+i);glass.material.opacity=.13;glass.material.roughness=.12;glass.material.envMapIntensity=.7;glass.userData.noShadow=true;}
 root.userData.exteriorLayers=['sky-hills','mid-trees','near-shrubs'];return outside;
}
