import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {buildClient} from './build-client.mjs';
await buildClient(true);await mkdir('server/dist',{recursive:true});
const result=await build({entryPoints:['api/index.ts'],outfile:'server/dist/vercel-check.mjs',bundle:true,packages:'external',platform:'node',format:'esm',target:['node22'],metafile:true});
if(Object.keys(result.metafile.inputs).some(path=>/database\.ts|pglite|server\/tests|\.env|\.data\//i.test(path)))throw new Error('Private/local-only input in Vercel function');
await writeFile('server/dist/vercel-inputs.json',JSON.stringify(Object.keys(result.metafile.inputs),null,2));
console.log('Vercel static client and serverless entrypoint checked. No PGlite or private data in the entrypoint.');
