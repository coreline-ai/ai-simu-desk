import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,stat,realpath} from 'node:fs/promises';
export function resolvePublicPath(url,root){
 let pathname;try{pathname=decodeURIComponent(new URL(url,'http://localhost').pathname);}catch{return null;}
 if(pathname.includes('\0')||pathname.includes('\\')||pathname.split('/').some(p=>p.startsWith('.')))return null;
 const resolved=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 return resolved.startsWith(root+path.sep)?resolved:null;
}
export async function createStaticServer(root){
 const base=await realpath(root),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.txt':'text/plain; charset=utf-8'};
 return http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const file=resolvePublicPath(req.url,base);try{if(!file||(await realpath(file))!==file||!(await stat(file)).isFile())throw Error('Not found');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':file.includes('/assets/')?'public,max-age=31536000,immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Not found');}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await createStaticServer(path.join(path.dirname(fileURLToPath(import.meta.url)),'dist'));
 server.listen(Number(process.env.PORT??4198),'127.0.0.1',()=>console.log('Practice: http://127.0.0.1:'+server.address().port));
}
