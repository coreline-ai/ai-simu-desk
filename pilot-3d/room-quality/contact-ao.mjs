import * as T from 'three';
import {STATIONS} from '../sample/room.mjs';
// Only immutable furniture contacts. Actors and movable chairs never enter this bake.
export function staticContacts(){
 const contacts=[];
 for(const p of Object.values(STATIONS))for(const x of[-.61,.61])for(const z of[-.17,.37])contacts.push([p[0]+x,p[2]+z,.10,.27]);
 for(const x of[-.88,.88])for(const z of[-.28,.28])contacts.push([-2.6+x,-3.02+z,.13,.32]);
 for(const z of[-1.8,-.3])contacts.push([-4.48,z,.16,.30]);
 for(let i=0;i<4;i++){const a=i*Math.PI/2+.7;contacts.push([3.5+Math.cos(a)*.42,2.45+Math.sin(a)*.42,.10,.25]);}
 return contacts;
}
export function contactAO(x,z,contacts=staticContacts()){
 let occlusion=0;for(const[cx,cz,r,strength]of contacts)occlusion+=Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r))*strength;
 return Math.max(.48,1-occlusion);
}
export function attachContactAO(surface){
 surface.geometry=surface.geometry.clone();const pos=surface.geometry.attributes.position,uv=surface.geometry.attributes.uv.clone();surface.updateWorldMatrix(true,false);
 for(let i=0;i<uv.count;i++){const p=surface.localToWorld(new T.Vector3().fromBufferAttribute(pos,i));uv.setXY(i,Math.max(0,Math.min(1,(p.x+4.8)/9.6)),Math.max(0,Math.min(1,(p.z+3.8)/7.6)));}
 surface.geometry.setAttribute('uv1',uv);surface.material=surface.material.clone();surface.material.userData={...surface.material.userData,floorAO:true};surface.userData.staticAO=true;return surface;
}
export function addFloorAO(root){return attachContactAO(root.getObjectByName('RoomFloor'));}
