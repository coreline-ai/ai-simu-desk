import{build}from'esbuild';import{mkdir,rename,rm,writeFile,readFile,readlink,lstat}from'node:fs/promises';import{resolve,join}from'node:path';import{spawn}from'node:child_process';import{randomUUID}from'node:crypto';
import{createBuildWorkspace,withBuildLock,validateRelease,publishRelease,rollbackRelease,hashTree,sourceFingerprint,versionEntryAssets}from'./build-release.mjs';
const root=process.cwd(),args=process.argv.slice(2),fault=process.env.STUDIO_BUILD_FAULT;
if(args[0]==='--stage'){
 const{buildClient}=await import('./build-client.mjs');await buildClient();if(fault==='after-client')throw new Error('Injected build failure after client');await mkdir('server/dist',{recursive:true});await build({entryPoints:['server/main.ts'],outfile:'server/dist/main.js',bundle:true,packages:'external',platform:'node',format:'esm',target:['node22'],legalComments:'linked'});if(fault==='after-server')throw new Error('Injected build failure after server');
}else{
 if(![undefined,'--prepare','--publish','--rollback'].includes(args[0])||args.length>(args[0]==='--publish'?2:1))throw new Error('Usage: build-product.mjs [--prepare | --publish release-id | --rollback]');
 const stoppedForConversion=async()=>{
  if((await lstat(join(root,'.data/build-current')).catch(()=>null)))return;
  const lock=await readFile(resolve(process.env.STUDIO_DATA_DIR??'.data/studio')+'.lock','utf8').catch(()=>null);if(lock){let pid;try{pid=JSON.parse(lock).pid;}catch{throw new Error('Database lock needs inspection before initial build path conversion');}try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')return;throw e;}throw new Error('Stop the local server before the first managed build publication; --prepare can build while it runs');}
 };
 await withBuildLock(root,async()=>{
  if(args[0]==='--rollback'){console.log('Rolled back to',await rollbackRelease(root));return;}
  if(args[0]==='--publish'){
   if(!/^[0-9]{13}-[0-9a-f-]{36}$/.test(args[1]??''))throw new Error('Invalid release ID');await stoppedForConversion();await publishRelease(root,join(root,'.data/build-releases',args[1]));console.log('Published release',args[1]);return;
  }
  const stage=await createBuildWorkspace(root),id=Date.now()+'-'+randomUUID(),release=join(root,'.data/build-releases',id);let prepared=false;
  try{
   const sourceAssets=await hashTree(join(root,'product/assets')),sourceHashes=await sourceFingerprint(root);
   await new Promise((resolveRun,reject)=>{const child=spawn(process.execPath,[join(root,'scripts/build-product.mjs'),'--stage'],{cwd:stage,stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolveRun():reject(new Error('Staged build failed with exit '+code)));});
   if(JSON.stringify(sourceHashes)!==JSON.stringify(await sourceFingerprint(root)))throw new Error('Source changed during build');
   if(JSON.stringify(sourceAssets)!==JSON.stringify(await hashTree(join(root,'product/assets'))))throw new Error('Source assets changed during staged build');
   await mkdir(release,{recursive:true});await rename(join(stage,'product/dist'),join(release,'client'));await rename(join(stage,'server/dist'),join(release,'server'));await versionEntryAssets(join(release,'client'));const hashes=await validateRelease(release);
   await writeFile(join(release,'manifest.json'),JSON.stringify({id,createdAt:new Date().toISOString(),sourceAssets,sourceHashes,...hashes},null,2));prepared=true;
   if(args[0]==='--prepare')console.log('Prepared release',id);else{await stoppedForConversion();await publishRelease(root,release,{beforeSwitch:async()=>{if(fault==='before-switch')throw new Error('Injected publication failure');}});console.log('Published release',id);}
  }finally{await rm(stage,{recursive:true,force:true});if(!prepared)await rm(release,{recursive:true,force:true});}
 });
}
