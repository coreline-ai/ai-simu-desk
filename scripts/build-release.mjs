import{mkdir,mkdtemp,cp,readdir,readFile,writeFile,symlink,rename,lstat,rm,readlink}from'node:fs/promises';
import{resolve,join,relative}from'node:path';import{randomUUID,createHash}from'node:crypto';
const exists=path=>lstat(path).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
export async function withBuildLock(root,operation){
 const data=join(root,'.data');await mkdir(data,{recursive:true});const lock=join(data,'product-build.lock'),token=JSON.stringify({pid:process.pid,token:randomUUID()});
 try{await writeFile(lock,token,{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')throw new Error('Another build/publish owns the lock; inspect .data/product-build.lock after that process exits');throw e;}
 try{return await operation();}finally{if(await readFile(lock,'utf8').catch(()=>'')===token)await rm(lock);}
}
export async function createBuildWorkspace(root){
 const stage=await mkdtemp(join(root,'.data/build-stage-'));await mkdir(join(stage,'product'));await mkdir(join(stage,'server'));
 try{
  for(const name of ['scripts','node_modules','demo','pilot-3d','docs','dev-plan','prompts','package.json','tsconfig.json'])await symlink(join(root,name),join(stage,name));
  for(const name of ['src','public','index.html','styles.css'])await symlink(join(root,'product',name),join(stage,'product',name));
  await cp(join(root,'product/assets'),join(stage,'product/assets'),{recursive:true});
  for(const e of await readdir(join(root,'server'))){if(e!=='dist')await symlink(join(root,'server',e),join(stage,'server',e));}
  return stage;
 }catch(e){await rm(stage,{recursive:true,force:true});throw e;}
}
export async function hashTree(root){
 const hashes={};async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name),name=relative(root,path);if(e.isSymbolicLink())throw new Error('Public release must not contain symbolic links: '+name);if(e.isDirectory())await visit(path);else hashes[name]=createHash('sha256').update(await readFile(path)).digest('hex');}}await visit(root);return Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)));
}
export const REQUIRED_RELEASE_FILES=['index.html','start.html','library/index.html','assets/app.js','assets/styles.css','assets/studio-team-v4.glb','assets/studio-team-v5.glb','assets/studio-room-v6.glb','demos/demo/index.html','demos/pilot-3d/index.html','demos/studio-v5/index.html','demos/visual-upgrade/index.html','demos/room-quality/index.html','demos/activities/index.html',...['team','natural','roles','expressive','interaction','refined'].map(v=>'demos/activities/'+v+'/index.html')];
export async function validateRelease(path){
 for(const file of REQUIRED_RELEASE_FILES)if(!(await exists(join(path,'client',file)))?.isFile())throw new Error('Missing release file: '+file);
 if(!(await exists(join(path,'server/main.js')))?.isFile())throw new Error('Missing server entry');
 const clientHashes=await hashTree(join(path,'client')),serverHashes=await hashTree(join(path,'server'));
 for(const file of Object.keys(clientHashes))if(/(^|\/)(\.env[^/]*|\.data|node_modules)(\/|$)/.test(file))throw new Error('Private file in public root');
 for(const file of Object.keys(clientHashes).filter(n=>n.endsWith('.glb'))){const bytes=await readFile(join(path,'client',file));if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB: '+file);}
 return{clientHashes,serverHashes};
}
async function point(data,name,target){const temp=join(data,name+'-next-'+randomUUID());await symlink(target,temp);try{await rename(temp,join(data,name));}catch(e){await rm(temp,{force:true});throw e;}}
// Both public paths follow one atomic pointer. Initial conversion is done with the local server stopped.
export async function initializeReleasePaths(root){
 const data=join(root,'.data'),releases=join(data,'build-releases'),current=join(data,'build-current');await mkdir(releases,{recursive:true});
 if(await exists(current)){
  for(const area of ['product','server']){const stat=await exists(join(root,area,'dist'));if(!stat?.isSymbolicLink()||await readlink(join(root,area,'dist'))!==`../.data/build-current/${area==='product'?'client':'server'}`)throw new Error('Managed build path mismatch; preserve current paths and inspect before publishing');}
  return;
 }
 const legacy=await mkdtemp(join(releases,'legacy-')),moved=[];
 try{
  for(const [area,dest]of[['product','client'],['server','server']]){const path=join(root,area,'dist');const stat=await exists(path);if(stat?.isSymbolicLink())throw new Error('Unmanaged dist symbolic link');if(stat){await rename(path,join(legacy,dest));moved.push([area,dest]);}else await mkdir(join(legacy,dest));}
  await point(data,'build-current',relative(data,legacy));
  for(const [area,dest]of[['product','client'],['server','server']])await symlink(`../.data/build-current/${dest}`,join(root,area,'dist'));
 }catch(e){
  for(const area of ['product','server'])if((await exists(join(root,area,'dist')))?.isSymbolicLink())await rm(join(root,area,'dist'));
  await rm(current,{force:true});for(const[area,dest]of moved)await rename(join(legacy,dest),join(root,area,'dist'));await rm(legacy,{recursive:true,force:true});throw e;
 }
}
export async function publishRelease(root,path,{beforeSwitch=async()=>{}}={}){
 const data=join(root,'.data'),releases=join(data,'build-releases'),absolute=resolve(path);
 if(relative(releases,absolute).startsWith('..')||relative(releases,absolute).includes('/')||absolute===releases)throw new Error('Release must be a direct child of build-releases');
 if(!(await exists(absolute))?.isDirectory()||(await exists(absolute))?.isSymbolicLink())throw new Error('Release directory required');
 const expected=JSON.parse(await readFile(join(absolute,'manifest.json'),'utf8')),actual=await validateRelease(absolute);
 if(JSON.stringify(expected.clientHashes)!==JSON.stringify(actual.clientHashes)||JSON.stringify(expected.serverHashes)!==JSON.stringify(actual.serverHashes))throw new Error('Release hashes do not match');
 await initializeReleasePaths(root);const old=await readlink(join(data,'build-current')),next=relative(data,absolute);if(old===next)return;
 await beforeSwitch();await point(data,'build-previous',old);await point(data,'build-current',next);
}
export async function rollbackRelease(root){const data=join(root,'.data'),previous=await readlink(join(data,'build-previous')),path=resolve(data,previous);if(relative(join(data,'build-releases'),path).startsWith('..')||relative(join(data,'build-releases'),path).includes('/'))throw new Error('Invalid previous release path');if(!(await exists(join(path,'client/index.html'))))throw new Error('Previous release unavailable');const current=await readlink(join(data,'build-current'));await point(data,'build-current',previous);await point(data,'build-previous',current);return path;}

export async function sourceFingerprint(root){
 const result={};async function visit(dir){for(const e of await readdir(join(root,dir),{withFileTypes:true})){if(['assets','dist','tests','evidence'].includes(e.name))continue;const path=join(dir,e.name);if(e.isDirectory())await visit(path);else if(/\.(mjs|ts|html|css|md)$/.test(path))result[path]=createHash('sha256').update(await readFile(join(root,path))).digest('hex');}}
 for(const dir of['scripts','server','product/src','product/public','pilot-3d','demo','docs','dev-plan','prompts'])await visit(dir);
 for(const file of['product/index.html','product/styles.css','package.json','package-lock.json'])result[file]=createHash('sha256').update(await readFile(join(root,file))).digest('hex');
 return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}

// Version entry assets so a new document cannot reuse a previous release's cached bundle.
export async function versionEntryAssets(client){
 const cache=new Map();async function version(file){if(!cache.has(file))cache.set(file,createHash('sha256').update(await readFile(file)).digest('hex').slice(0,16));return cache.get(file);}
 async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=join(dir,e.name);if(e.isDirectory()){await visit(file);continue;}if(!e.name.endsWith('.html'))continue;let html=await readFile(file,'utf8');const matches=[...html.matchAll(/(<(?:script|link)\b[^>]*?\b(?:src|href)=["'])([^"']+\.(?:js|css))(?:\?v=[0-9a-f]{16})?(["'])/gi)];for(const m of matches){if(/^(?:[a-z]+:|\/\/)/i.test(m[2]))continue;const target=m[2].startsWith('/')?resolve(client,'.'+m[2]):resolve(dir,m[2]);if(relative(resolve(client),target).startsWith('..'))throw new Error('Entry asset escapes public root');html=html.replace(m[0],m[1]+m[2]+'?v='+await version(target)+m[3]);}await writeFile(file,html);}}
 await visit(client);
}
