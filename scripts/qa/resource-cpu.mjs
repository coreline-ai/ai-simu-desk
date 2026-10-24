// Controlled CPU-only comparison against a read-only Git reference; not OS total CPU.
import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import {relative,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {writeFile} from 'node:fs/promises';
import {fixture as candidate} from '../../product/tests/living-fixture.mjs';
const ref=process.argv[2]??'b963d17',root=process.cwd();if(!/^[0-9a-f]{7,40}$/.test(ref))throw Error('Expected a commit hash');
await build({stdin:{contents:"export {fixture} from './product/tests/living-fixture.mjs';",resolveDir:root},outfile:'.data/resource-20261024/reference-fixture.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node22',plugins:[{name:'read-only-baseline',setup(b){b.onLoad({filter:/\.(mjs|ts)$/},args=>{const name=relative(root,args.path);if(!name.startsWith('pilot-3d/')&&name!=='product/tests/living-fixture.mjs')return;return{contents:execFileSync('git',['show',ref+':'+name],{encoding:'utf8',maxBuffer:8e6}),loader:'js'};});}}]});
const {fixture:baseline}=await import(pathToFileURL(resolve('.data/resource-20261024/reference-fixture.mjs')).href);const ids=['nara','sora','jun','min','leo'],rows=[];
for(let round=0;round<3;round++)for(const workload of ['idle','roles1'])for(const mode of round%2?['candidate','baseline']:['baseline','candidate']){
 const f=(mode==='baseline'?baseline:candidate)({personalMotion:true,personalities:true,anatomicalActors:ids});
 try{for(let n=0;n<120;n++)f.runtime.update(1/60);if(workload==='roles1')for(const id of ids)f.s.startRole(id,{variant:1});const cpu=process.cpuUsage(),at=performance.now();for(let n=0;n<360;n++)f.runtime.update(1/60);const ms=performance.now()-at,c=process.cpuUsage(cpu);rows.push({round,workload,mode,steps:360,wallMs:ms,cpuMs:(c.user+c.system)/1000});console.log(rows.at(-1));}finally{f.close();}
}
await writeFile('.data/resource-20261024/cpu-controlled.json',JSON.stringify({scope:'Node22 CPU-only generated-model fixed-step workload, three alternating runs, excludes model construction, no WebGL/DOM/network; not OS application CPU percentage',baseline:ref,rows},null,2));
