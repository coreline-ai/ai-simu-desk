import {build} from 'esbuild';
import {HAIR_FILL_ASSETS} from './src/assets/hair-fill.mjs';
import {MIN_HAIR_ASSET} from './src/assets/min-hair.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),out=path.join(here,'dist');
process.chdir(root);
try{await stat('product/assets/studio-room-v9.glb');}catch{const {buildLivingOffice}=await import('../scripts/build-living-office.mjs');await buildLivingOffice();}
const hash=data=>createHash('sha256').update(data).digest('hex');
// Never follow an output symlink into an applied production release.
const {lstat}=await import('node:fs/promises');try{if((await lstat(out)).isSymbolicLink())throw Error('practice/dist must not be a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'assets'),{recursive:true});
async function asset(source,name,ext){const data=await readFile(path.join(root,source)),relative=`assets/${name}.${hash(data).slice(0,16)}.${ext}`;await writeFile(path.join(out,relative),data);return{url:'./'+relative,sha256:hash(data),bytes:data.length};}
const model=await asset('product/assets/studio-room-v9.glb','studio-room-v9','glb');
const poster=await asset('docs/images/studio-overview.png','office','png');
const style=await asset('practice/styles.css','style','css');
const bundled=await build({absWorkingDir:root,entryPoints:[path.join(here,'src/app.mjs')],outdir:path.join(out,'assets'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',entryNames:'app.[hash]',assetNames:'[name].[hash]',metafile:true,legalComments:'linked',define:{__OFFICE_MODEL__:JSON.stringify(model.url)}});
const inputs=Object.keys(bundled.metafile.inputs);
const privateInput=inputs.find(p=>p.startsWith('server/')&&!['server/domain/fake-answer.ts','server/domain/team.ts'].includes(p));
if(privateInput)throw Error('Private server dependency in browser bundle: '+privateInput);
const script=Object.keys(bundled.metafile.outputs).find(p=>p.endsWith('.js'));
let html=await readFile(path.join(here,'index.html'),'utf8');
html=html.replace('__SCRIPT__','./'+path.relative(out,path.resolve(root,script)).split(path.sep).join('/')).replace('__STYLE__',style.url).replace('__POSTER__',poster.url);
await writeFile(path.join(out,'index.html'),html);
await writeFile(path.join(out,'.htaccess'),`Options -Indexes\nDirectoryIndex index.html\n<IfModule mod_headers.c>\n Header always set X-Content-Type-Options "nosniff"\n Header always set Referrer-Policy "strict-origin-when-cross-origin"\n Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"\n <FilesMatch "\\.(js|css|glb|png|txt)$">\n Header set Cache-Control "public, max-age=31536000, immutable"\n </FilesMatch>\n <FilesMatch "\\.(html|json)$">\n Header set Cache-Control "no-cache"\n </FilesMatch>\n</IfModule>\n<IfModule mod_deflate.c>\n AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json model/gltf-binary\n</IfModule>\n`);
await writeFile(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\n');
const manifest={schema:1,edition:'practice-static',model,poster,style,visualBaselineCommit:'14e7c9ece22e1e5bf9e96ef64d441b27c9161f13',visual:{model:9,personalities:13,hands:14,quality:'balanced',motionHz:60},practiceAssets:[MIN_HAIR_ASSET,...HAIR_FILL_ASSETS],server:false,externalAI:false};
await writeFile(path.join(out,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const files=await readdir(out,{recursive:true});
for(const name of files){if((await stat(path.join(out,name))).isDirectory())continue;if(!/^(index\.html|\.htaccess|robots\.txt|build-manifest\.json|assets\/[\w.\-]+\.(js|css|glb|png|txt))$/.test(name))throw Error('Unexpected deploy file: '+name);}
console.log(JSON.stringify({directory:out,modelSha256:model.sha256,files:files.filter(p=>p.includes('.')&&!p.startsWith('.DS')),totalBytes:(await Promise.all(files.map(async p=>(await stat(path.join(out,p))).isFile()?(await stat(path.join(out,p))).size:0))).reduce((a,b)=>a+b,0)},null,2));
