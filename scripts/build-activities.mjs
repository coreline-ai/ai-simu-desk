import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
export async function buildActivities(){const dir='product/dist/demos/activities';await mkdir(dir,{recursive:true});await writeFile(dir+'/index.html',await readFile('pilot-3d/activities/index.html'));await writeFile(dir+'/styles.css',(await readFile('pilot-3d/sample/styles.css','utf8'))+'\n'+(await readFile('pilot-3d/room-quality/styles.css','utf8'))+'\n'+(await readFile('pilot-3d/activities/styles.css','utf8')));await build({entryPoints:['pilot-3d/activities/app.mjs'],outfile:dir+'/app.js',bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'linked'});}
if(process.argv[1]?.endsWith('build-activities.mjs'))await buildActivities();
