import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createLivingOffice,validateLivingOffice} from '../pilot-3d/living-office/model.mjs';
import {finalContacts} from './build-final-office.mjs';
import {contactAO} from '../pilot-3d/room-quality/contact-ao.mjs';
import {roomTextures,textureBudget} from './build-room-quality.mjs';
import {embedTextures} from './sample-textures.mjs';
import {releaseStudioAsset} from '../pilot-3d/sample/asset-loader.mjs';
export async function buildLivingOffice(){const {root,animations}=createLivingOffice();try{
  validateLivingOffice({scene:root});const contacts=finalContacts();
  const binary=roomTextures(embedTextures(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,trs:true,animations,onlyVisible:false}))),{width:13.2,depth:10.2,aoSample:(x,z)=>contactAO(x,z,contacts)});
  if(binary.length>15*1024*1024)throw Error('Living asset budget exceeded');
  const manifest={...root.userData,file:'studio-room-v9.glb',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),clips:animations.length,textureBudget:textureBudget(binary)};
  await mkdir('product/assets',{recursive:true});await writeFile('product/assets/studio-room-v9.glb',binary);await writeFile('product/assets/manifest-room-v9.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({file:manifest.file,bytes:binary.length,clips:animations.length}));return manifest;
}finally{releaseStudioAsset(root);}}
if(process.argv[1]?.endsWith('build-living-office.mjs'))await buildLivingOffice();
