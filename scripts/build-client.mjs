import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
export async function buildClient(remote=false) {
  await import('./build-team.mjs');
  await rm('product/dist',{recursive:true,force:true});await mkdir('product/dist/assets',{recursive:true});
  await build({entryPoints:['product/src/app.mjs'],outfile:'product/dist/assets/app.js',bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'linked'});
  const html=await readFile('product/index.html','utf8');
  await writeFile('product/dist/index.html',remote?html.replaceAll('LOCAL FAKE AI','FAKE AI').replaceAll('LOCAL EDITION','SHARED EDITION').replaceAll('이 기기의 서버','연결된 서버'):html);
  for(const [from,to] of [['product/styles.css','styles.css'],['product/assets/studio-team-v2.glb','studio-team-v2.glb'],['demo/assets/office-background-v1.png','office-background-v1.png']])await copyFile(from,`product/dist/assets/${to}`);
}
