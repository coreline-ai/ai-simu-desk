import{mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{GLTFExporter}from'three/addons/exporters/GLTFExporter.js';
import{createFinalOffice}from'../pilot-3d/final-office/model.mjs';
import{FINAL_STATIONS,finalLayout}from'../pilot-3d/final-office/layout.mjs';
import{contactAO}from'../pilot-3d/room-quality/contact-ao.mjs';
import{roomTextures,textureBudget}from'./build-room-quality.mjs';
import{embedTextures}from'./sample-textures.mjs';
import{releaseStudioAsset}from'../pilot-3d/sample/asset-loader.mjs';
// Movable actors and chairs deliberately do not enter this bake.
export function finalContacts(){const contacts=[];for(const[x,,z]of Object.values(FINAL_STATIONS))for(const dx of[-.61,.61])for(const dz of[-.17,.37])contacts.push([x+dx,z+dz,.10,.27]);const d=finalLayout();for(const x of[-1.12,1.12])for(const z of[-.27,.27])contacts.push([d.sofa.position[0]+x,d.sofa.position[2]+z,.13,.32]);for(const x of[-.8,.8])for(const z of[-.35,.35])contacts.push([d.meeting.center[0]+x,d.meeting.center[2]+z,.12,.3]);contacts.push([3.55,3.4,.42,.2],[.85,2.65,.3,.15]);return contacts;}
export async function buildFinalOffice(){const{root,animations}=createFinalOffice();try{const contacts=finalContacts(),binary=roomTextures(embedTextures(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,trs:true,animations}))),{width:13.2,depth:10.2,aoSample:(x,z)=>contactAO(x,z,contacts)});if(binary.length>15*1024*1024)throw Error('Final office exceeds 15MiB');const manifest={...root.userData,file:'studio-room-v7.glb',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),clips:animations.length,textureBudget:textureBudget(binary)};await mkdir('product/assets',{recursive:true});await writeFile('product/assets/studio-room-v7.glb',binary);await writeFile('product/assets/manifest-room-v7.json',JSON.stringify(manifest,null,2)+'\n');console.log('Final office v7',Math.round(binary.length/1024)+' KiB',root.userData.cost);return manifest;}finally{releaseStudioAsset(root);}}
if(process.argv[1]?.endsWith('build-final-office.mjs'))await buildFinalOffice();
