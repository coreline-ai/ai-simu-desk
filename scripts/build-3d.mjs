import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createOfficeModel, DIMENSIONS, WORKSPACE_ORIGIN } from "../pilot-3d/src/model.mjs";

// The exporter uses FileReader for a Blob even when a model has no textures.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
};
await mkdir("pilot-3d/assets", { recursive: true });
await mkdir("pilot-3d/dist", { recursive: true });
const { root, animations } = createOfficeModel();
const binary = await new GLTFExporter().parseAsync(root, { binary: true, trs: true, animations });
await writeFile("pilot-3d/assets/afternoon-studio-v1.glb", Buffer.from(binary));
const geometries = new Set(), materials = new Set(); let meshes = 0, triangles = 0;
root.traverse(node => { if (!node.isMesh) return; meshes++; geometries.add(node.geometry); materials.add(node.material); triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; });
await writeFile("pilot-3d/assets/manifest.json", JSON.stringify({
  version: 1, file: "afternoon-studio-v1.glb", format: "glTF 2.0 binary", bytes: binary.byteLength,
  sha256: createHash("sha256").update(Buffer.from(binary)).digest("hex"),
  source: "../src/model.mjs", provenance: "Original procedural geometry authored in this workspace. No third-party model or texture.",
  thirdPartyCode: "Three.js (MIT), license copied beside the model", units: "metres", up: "+Y", floorY: 0,
  dimensions: DIMENSIONS, workspaceOrigin: WORKSPACE_ORIGIN, animations: animations.map(a => ({ name: a.name, duration: a.duration, tracks: a.tracks.length })),
  meshes, triangles, rig: "Hierarchical transform animation; no skinned skeleton or walking clips",
  limitations: ["Stylized pilot model; not a photoreal reconstruction of the PNG", "Only Nara is modeled", "No real AI/backend/authentication"],
}, null, 2) + "\n");
await copyFile("node_modules/three/LICENSE", "pilot-3d/assets/THREE-LICENSE.txt");
await writeFile("pilot-3d/assets/MODEL-PROVENANCE.txt", "Afternoon Studio v1\nOriginal procedural geometry and animation, authored for this workspace on 2026-10-19.\nSource: pilot-3d/src/model.mjs. No purchased, scraped or downloaded third-party models/textures.\nGenerated geometry is a project deliverable; no additional third-party model license is required.\nThree.js library is MIT licensed; see THREE-LICENSE.txt.\nModel is a stylized pilot with node animation, not a skinned production character.\n");
if (process.argv.includes("--model-only")) {
  console.log(`GLB model built: ${Math.round(binary.byteLength / 1024)} KiB, ${meshes} meshes, ${triangles} triangles`);
} else {
  await build({ entryPoints: ["pilot-3d/src/app.mjs"], outfile: "pilot-3d/dist/app.js", bundle: true, format: "esm", minify: true, legalComments: "linked", target: ["es2022"], sourcemap: false });
  console.log(`3D pilot built: GLB ${Math.round(binary.byteLength / 1024)} KiB, JS ${Math.round((await readFile("pilot-3d/dist/app.js")).byteLength / 1024)} KiB`);
}
for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
