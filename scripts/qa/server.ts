// Isolated source-backed QA host. Never opens the user's product database.
import {serve} from '@hono/node-server';import{serveStatic}from'@hono/node-server/serve-static';
import{mkdtemp,readFile,rm}from'node:fs/promises';import{join}from'node:path';import{tmpdir}from'node:os';import{randomBytes}from'node:crypto';import{build}from'esbuild';
import{getConfig}from'../../server/config.js';import{openDatabase}from'../../server/db/database.js';import{createRuntime}from'../../server/runtime.js';
const dir=await mkdtemp(join(tmpdir(),'studio-qa-')),port=Number(process.env.STUDIO_QA_PORT??4191);
const config=getConfig({PORT:String(port),APP_ORIGIN:`http://127.0.0.1:${port}`,BETTER_AUTH_SECRET:randomBytes(48).toString('hex'),STUDIO_DATA_DIR:join(dir,'db'),FAKE_AI_DELAY_MS:process.env.STUDIO_QA_FAKE_DELAY_MS??'65'});
await build({entryPoints:['product/src/app.mjs'],outfile:join(dir,'app.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'linked'});
await build({entryPoints:['pilot-3d/activities/team/app.mjs'],outfile:join(dir,'activities/app.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'linked'});
const db=await openDatabase(config.dataDir),app=createRuntime(db,config);
app.get('/assets/app.js',async c=>{c.header('Content-Type','text/javascript');return c.body(await readFile(join(dir,'app.js')));});
app.get('/demos/activities/:variant/app.js',async c=>{c.header('Content-Type','text/javascript');return c.body(await readFile(join(dir,'activities/app.js')));});
app.get('/',async c=>c.html(await readFile('product/index.html','utf8')));
app.get('/start',serveStatic({path:'./product/dist/start.html'}));app.use('*',serveStatic({root:'./product/dist'}));
const server=serve({fetch:app.fetch,hostname:'127.0.0.1',port},()=>console.log(`Isolated QA ready: ${config.origin}`));let closing=false;
const close=async()=>{if(closing)return;closing=true;await new Promise<void>(r=>server.close(()=>r()));await db.close();await rm(dir,{recursive:true,force:true});};
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
