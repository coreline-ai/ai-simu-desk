// Record on a baseline, then pass that JSON as argument 2 when testing a candidate.
// Timings include snapshots and are not a controlled CPU benchmark.
import {fixture} from '../../product/tests/living-fixture.mjs';
import {createHash} from 'node:crypto';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
const ids=['nara','sora','jun','min','leo'],f=fixture({personalMotion:true,personalities:true,anatomicalActors:ids}),samples=[],timings=[];
function snapshot(label){f.root.updateMatrixWorld(true);const rows=[];f.root.traverseVisible(n=>{if(!n.isMesh&&!n.isLine)return;rows.push([n.name,n.matrixWorld.elements,n.isInstancedMesh?[...n.instanceMatrix.array]:null,n.isSkinnedMesh?n.skeleton.bones.map(b=>b.matrixWorld.elements):null,n.userData.ensemblePaper?[...n.geometry.attributes.position.array]:null]);});const d=f.runtime.diagnostics();samples.push({label,time:f.s.time,visible:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),contacts:createHash('sha256').update(JSON.stringify(d)).digest('hex'),meshes:rows.length});}
function run(label,frames){const t=performance.now();for(let n=0;n<frames;n++){f.runtime.update(1/60);if(n%60===59)snapshot(label+':'+(n+1));}timings.push({label,frames,ms:performance.now()-t});}
try{snapshot('initial');run('idle',180);for(let variant=0;variant<3;variant++){for(const id of ids)f.s.startRole(id,{variant});run('roles-'+variant,1200);}for(const id of ids)f.s.startCup(id);run('cups',1200);f.s.personalMotion.glasses.start();run('glasses',720);f.s.startVisit('leo','nara',{transfer:true});run('transfer',4200);snapshot('end');}finally{f.close();}
const output=process.argv[2]??'.data/resource-equivalence/current.json';await mkdir(dirname(output),{recursive:true});if(process.argv[3]){const baseline=JSON.parse(await readFile(process.argv[3],'utf8'));assert.deepEqual(samples,baseline.samples,'visible scene or contact diagnostics changed');}await writeFile(output,JSON.stringify({scope:'fixed 60Hz generated-model visible transforms, skeletons, dynamic instances, paper vertices and full runtime diagnostics',samples,timings},null,2));console.log(JSON.stringify({output,samples:samples.length,timings}));
