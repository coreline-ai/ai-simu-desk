import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("product/dist/assets", { recursive: true });
await mkdir("server/dist", { recursive: true });
await build({ entryPoints: ["product/src/app.mjs"], outfile: "product/dist/assets/app.js", bundle: true, format: "esm", minify: true, target: ["es2022"], legalComments: "linked" });
await build({ entryPoints: ["server/main.ts"], outfile: "server/dist/main.js", bundle: true, packages: "external", platform: "node", format: "esm", target: ["node22"], legalComments: "linked" });
for (const [from, to] of [["product/index.html", "product/dist/index.html"], ["product/styles.css", "product/dist/assets/styles.css"], ["pilot-3d/assets/afternoon-studio-v1.glb", "product/dist/assets/afternoon-studio-v1.glb"], ["demo/assets/office-background-v1.png", "product/dist/assets/office-background-v1.png"]]) await copyFile(from, to);
console.log("Product client/server built; static root contains only public UI assets.");
