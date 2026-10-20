import * as T from 'three';
import {box,material} from '../sample/geometry.mjs';
import {STATIONS} from '../sample/room.mjs';
export function enhanceWorkstations(root){
 for(const id of Object.keys(STATIONS)){const prefix=id[0].toUpperCase()+id.slice(1),screen=root.getObjectByName(prefix+'Screen');screen.material=screen.material.clone();screen.material.color.set(0xffffff);screen.material.emissive.set(0xffffff);screen.material.emissiveIntensity=.12;screen.material.userData={roomScreen:id};
  const secondary=root.getObjectByName(prefix+(id==='sora'?'TabletScreen':id==='min'?'PhoneDisplay':'MonitorDisplay'));if(secondary){secondary.material=screen.material;}
  const light=material(prefix+'ActivityLight',0x899680,.5);light.emissive.set(0x899680);light.emissiveIntensity=.3;light.userData={activityIndicator:id};box(root.getObjectByName(prefix+'LaptopLid'),prefix+'ActivityStrip',[.075,.007,.003],[.13,.248,.012],light,.001);
 }
}
export function screenPixels(role){
 const width=256,height=160,pixels=new Uint8Array(width*height*4),palette={nara:[141,163,115],sora:[191,143,115],jun:[105,145,165],min:[156,132,165],leo:[175,157,113]},accent=palette[role];
 const rect=(x,y,w,h,c)=>{for(let py=Math.max(0,y);py<Math.min(height,y+h);py++)for(let px=Math.max(0,x);px<Math.min(width,x+w);px++)pixels.set([...c,255],(py*width+px)*4);};
 rect(0,0,width,height,[226,231,217]);rect(0,0,43,height,[80,95,82]);rect(54,12,184,13,[250,248,238]);for(let i=0;i<4;i++)rect(12,17+i*27,19,5,i===0?accent:[126,143,123]);
 if(role==='sora'){for(let i=0;i<4;i++)rect(58+(i%2)*89,38+Math.floor(i/2)*48,77,37,[accent,[153,172,178],[204,188,141],[166,181,145]][i]);}
 else if(role==='jun'){rect(55,35,186,110,[56,75,70]);for(let i=0;i<8;i++){rect(64+(i%3)*8,45+i*11,85+(i%3)*15,3,i%2?accent:[178,192,155]);}}
 else if(role==='min'){for(let i=0;i<5;i++){rect(60,39+i*21,9,9,accent);rect(79,41+i*21,120-(i%2)*23,4,[137,153,135]);}}
 else if(role==='nara'){rect(60,41,74,40,accent);rect(155,44,76,36,[198,184,143]);rect(83,103,117,30,[156,177,143]);rect(132,57,24,3,[133,150,125]);rect(121,80,3,23,[133,150,125]);}
 else {for(let i=0;i<3;i++){rect(59+i*59,39,49,89,[249,246,232]);for(let j=0;j<6;j++)rect(65+i*59,50+j*9,31-(j%2)*8,3,j===0?accent:[176,182,159]);}}
 return {width,height,pixels};
}
