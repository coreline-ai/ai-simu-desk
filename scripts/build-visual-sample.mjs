import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {modelCost}from'../pilot-3d/sample/optimize.mjs';
import {createSample} from '../pilot-3d/sample/model.mjs';
import {embedTextures} from './sample-textures.mjs';
import {releaseModel} from '../pilot-3d/src/scene.mjs';
globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}).catch(error=>this.onerror?.(error));}};
export async function buildVisualSample({detailed=false}={}){
 const {root,animations}=createSample({detailed,optimized:true});
 try{const binary=embedTextures(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,trs:true,animations})));
 const {meshes,triangles}=modelCost(root);
 const manifest={...root.userData,file:'nara-workspace-sample.glb',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),meshes,triangles,textures:{count:5,resolution:256,estimatedRGBAWithMipmapsBytes:Math.ceil(5*256*256*4*4/3)},source:'pilot-3d/sample; scripts/sample-textures.mjs',provenance:'Original local geometry, deterministic procedural PNGs and node animation; no external models/textures',rigDescription:'articulated joints with partial two-bone sleeve/trouser skinning; silhouette visually checked',clips:animations.map(c=>({name:c.name,duration:c.duration})),limitations:['One Nara prototype; five-person product remains v4','No speech, finger articulation or cloth simulation','Desktop/viewport QA does not certify physical mobile GPU performance']};
 await mkdir('product/assets',{recursive:true});await writeFile('product/assets/nara-workspace-sample.glb',binary);await writeFile('product/assets/nara-sample-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(`Nara sample ${Math.round(binary.length/1024)} KiB; ${meshes} meshes; ${triangles} triangles`);return manifest;
 }finally{root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});releaseModel(root);}
}
if(process.argv[1]?.endsWith('build-visual-sample.mjs'))await buildVisualSample({detailed:process.argv.includes('--detailed')});
