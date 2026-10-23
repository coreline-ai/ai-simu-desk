import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {assertMutableOutput} from './build-output-guard.mjs';
export async function buildPersonalPage(){await assertMutableOutput();const dir='product/dist/demos/activities/personal';await mkdir(dir,{recursive:true});await copyFile('pilot-3d/personal-office/index.html',dir+'/index.html');await writeFile(dir+'/styles.css',(await Promise.all(['pilot-3d/living-office/styles.css','pilot-3d/personal-office/styles.css'].map(p=>readFile(p,'utf8')))).join('\n'));await build({entryPoints:['pilot-3d/personal-office/app.mjs'],outfile:dir+'/app.js',bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'linked'});}
