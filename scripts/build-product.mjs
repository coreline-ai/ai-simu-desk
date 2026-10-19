import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {buildClient} from './build-client.mjs';
await buildClient();await mkdir('server/dist',{recursive:true});
await build({entryPoints:['server/main.ts'],outfile:'server/dist/main.js',bundle:true,packages:'external',platform:'node',format:'esm',target:['node22'],legalComments:'linked'});
console.log('Product client/server built; static root contains only public UI assets.');
