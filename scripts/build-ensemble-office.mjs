import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createEnsembleOffice, validateEnsembleOffice } from "../pilot-3d/ensemble-office/model.mjs";
import { finalContacts } from "./build-final-office.mjs";
import { contactAO } from "../pilot-3d/room-quality/contact-ao.mjs";
import { roomTextures, textureBudget } from "./build-room-quality.mjs";
import { embedTextures } from "./sample-textures.mjs";
import { releaseStudioAsset } from "../pilot-3d/sample/asset-loader.mjs";
export async function buildEnsembleOffice({ prototype = false } = {}) {
  const { root, animations } = createEnsembleOffice(prototype ? { enhancedActors: ["nara"] } : {});
  try {
    validateEnsembleOffice({ scene: root }, { prototype });
    const contacts = finalContacts().filter((p) => ![-4.25, -2.65].some((x) => Math.abs(p[0] - x) < 1e-6) || ![2.25, 2.95].some((z) => Math.abs(p[1] - z) < 1e-6));
    for (const x of [-1.1, 1.1]) for (const z of [-0.43, 0.43]) contacts.push([-3.45 + x, 2.6 + z, 0.12, 0.3]);
    const binary = roomTextures(embedTextures(Buffer.from(await new GLTFExporter().parseAsync(root, { binary: true, trs: true, animations, onlyVisible: false }))), { width: 13.2, depth: 10.2, aoSample: (x, z) => contactAO(x, z, contacts) });
    if (binary.length > 15 * 1024 * 1024) throw Error("Ensemble GLB exceeds asset budget");
    const file = prototype ? "nara-prototype.glb" : "studio-room-v8.glb", dir = prototype ? "product/evidence/ensemble-activities" : "product/assets";
    const manifest = { ...root.userData, file, prototype, bytes: binary.length, sha256: createHash("sha256").update(binary).digest("hex"), clips: animations.length, textureBudget: textureBudget(binary) };
    await mkdir(dir, { recursive: true });
    await writeFile(dir + "/" + file, binary);
    await writeFile(dir + "/" + (prototype ? "nara-prototype.json" : "manifest-room-v8.json"), JSON.stringify(manifest, null, 2) + "\n");
    console.log(JSON.stringify({ file, prototype, bytes: binary.length, clips: animations.length, cost: root.userData.cost }));
    return manifest;
  } finally {
    releaseStudioAsset(root);
  }
}
if (process.argv[1]?.endsWith("build-ensemble-office.mjs")) await buildEnsembleOffice({ prototype: process.argv.includes("--prototype") });
