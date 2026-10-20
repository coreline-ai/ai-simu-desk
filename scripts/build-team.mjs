import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createOfficeModel, DIMENSIONS, WORKSPACE_ORIGIN, JUN_WORKSPACE_ORIGIN } from "../pilot-3d/src/model.mjs";
import { releaseModel } from "../pilot-3d/src/scene.mjs";

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
};
const { root, animations } = createOfficeModel({ includeJun: true });
try {
  const binary = Buffer.from(await new GLTFExporter().parseAsync(root, { binary: true, trs: true, animations }));
  let meshes = 0, triangles = 0;
  root.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; } });
  await mkdir("product/assets", { recursive: true });
  await writeFile("product/assets/studio-team-v2.glb", binary);
  await writeFile("product/assets/manifest.json", JSON.stringify({
    version: 2, file: "studio-team-v2.glb", format: "glTF 2.0 binary", bytes: binary.length, sha256: createHash("sha256").update(binary).digest("hex"),
    source: "../../pilot-3d/src/model.mjs", provenance: "Original procedural geometry and node animation authored in this project. No third-party model or texture.",
    libraryLicense: "Three.js MIT; see ../../pilot-3d/assets/THREE-LICENSE.txt", units: "metres", up: "+Y", floorY: 0,
    dimensions: DIMENSIONS, workspaces: { nara: WORKSPACE_ORIGIN, jun: JUN_WORKSPACE_ORIGIN },
    animations: animations.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })), meshes, triangles,
    limitations: ["Stylized seated characters with hierarchical node animation", "No skinning, walking or speech animation", "Fake AI is a separate rule-based server adapter"],
  }, null, 2) + "\n");
  console.log(`Team GLB built: ${Math.round(binary.length / 1024)} KiB, ${meshes} meshes, ${triangles} triangles`);
} finally { releaseModel(root); }

// Keep the two-person artifact for regression; the product now loads v3.
const teamFive= createOfficeModel({includeTeam:true});
try {
 const {TEAM_DIMENSIONS,TEAM_WORKSPACES}=await import('../pilot-3d/src/model.mjs');
 const binary=Buffer.from(await new GLTFExporter().parseAsync(teamFive.root,{binary:true,trs:true,animations:teamFive.animations}));
 let meshes=0,triangles=0;teamFive.root.traverse(node=>{if(node.isMesh){meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});
 await writeFile('product/assets/studio-team-v3.glb',binary);
 await writeFile('product/assets/manifest-v3.json',JSON.stringify({version:3,file:'studio-team-v3.glb',bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),source:'../../pilot-3d/src/model.mjs',provenance:'Original procedural geometry; no external model or texture',units:'metres',floorY:0,dimensions:TEAM_DIMENSIONS,workspaces:TEAM_WORKSPACES,animations:teamFive.animations.map(c=>({name:c.name,duration:c.duration})),meshes,triangles,limitations:['Seated hierarchical node animation; no walking or skinning','Rule-based Fake AI; no external AI calls']},null,2)+'\n');
 console.log(`Five-person GLB: ${Math.round(binary.length/1024)} KiB, ${meshes} meshes, ${triangles} triangles`);
}finally{releaseModel(teamFive.root);}
