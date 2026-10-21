import{assertMutableOutput}from'./build-output-guard.mjs';
// Local-only QA fixture, intentionally outside the public product build.
import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await assertMutableOutput();
await mkdir('product/dist/assets/qa',{recursive:true});
await build({entryPoints:['product/tests/fixtures/motion-qa.mjs'],outfile:'product/dist/assets/qa/motion-qa.js',bundle:true,format:'esm',target:'es2022'});
await copyFile('product/tests/fixtures/motion-qa.html','product/dist/assets/qa/index.html');
await copyFile('product/assets/studio-team-v3.glb','product/dist/assets/qa/studio-team-v3.glb');
try{await copyFile('product/assets/studio-team-v4.glb','product/dist/assets/qa/studio-team-v4.glb');}catch(e){if(e.code!=='ENOENT')throw e;}

await copyFile('product/tests/fixtures/motion-qa.css','product/dist/assets/qa/motion-qa.css');
