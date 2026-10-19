// Package this bounded demo as one offline HTML file; no image pixels are changed.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFile(path.join(root, file), "utf8");
const png = async file => `data:image/png;base64,${(await readFile(path.join(root, file))).toString("base64")}`;
const [background, atlas] = await Promise.all([
  png("demo/assets/office-background-v1.png"), png("demo/assets/coworkers-atlas-v2.png"),
]);
let html = await read("demo/index.html");
html = html.replace('class="brand" href="./"', 'class="brand" href="./preview.html"');
let css = await read("demo/styles.css");
const source = await Promise.all(["domain", "scene-frames", "scene", "app"].map(name => read(`demo/src/${name}.mjs`)));
let js = source.map(text => text.replace(/^import[^\n]*\n/gm, "").replace(/^export /gm, "")).join("\n");
js = js.replace('new URL("../assets/coworkers-atlas-v2.png", import.meta.url).href', JSON.stringify(atlas));
html = html.replace('<link rel="stylesheet" href="./styles.css">', `<style>${css}</style>`);
html = html.replace('<script type="module" src="./src/app.mjs"></script>', `<script type="module">${js.replaceAll("</script", "<\\/script")}</script>`);
html = html.replace('src="./assets/office-background-v1.png"', `src="${background}"`);
html = html.replace('href="./assets/office-background-v1.png" target="_blank" rel="noopener"', `href="${background}" download="office-background-v1.png"`);
html = html.replace('href="./assets/coworkers-atlas-v2.png" target="_blank" rel="noopener"', `href="${atlas}" download="coworkers-atlas-v2.png"`);
await writeFile(path.join(root, "demo/preview.html"), html);
console.log(`Built demo/preview.html (${Math.round(Buffer.byteLength(html) / 1024)} KiB), images and logic included.`);
