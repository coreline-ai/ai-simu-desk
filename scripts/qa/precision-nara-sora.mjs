import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const destination=path.join(root,'product/evidence/motion-precision/nara-sora');fs.mkdirSync(destination,{recursive:true});
if(process.argv.includes('--foot-repro')){
 const [{fixture,until},T,{part}]=await Promise.all([import('../../product/tests/living-fixture.mjs'),import('three'),import('../../pilot-3d/sample/character-rig.mjs')]);
 const f=fixture({personalMotion:true}),rows=[];
 const minimum=sole=>{const p=sole.geometry.attributes.position;let value=Infinity;for(let i=0;i<p.count;i++)value=Math.min(value,new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(sole.matrixWorld).y);return value;};
 try{for(let variant=0;variant<3;variant++){
  f.s.startRest('sora');const style=f.s.records.get('sora').style;let max=0,peak;
  for(let frame=0;frame<300*30&&f.s.records.has('sora');frame++){
   f.runtime.update(1/30);const actor=f.s.desks.sora.actor,state=f.s.state('sora');actor.updateWorldMatrix(true,true);
   for(const [i,side]of ['L','R'].entries())if(state.pose?.feet?.[i]?.planted){const foot=part(actor,'NaraFoot'+side),sole=part(actor,'Sole'+side),actual=minimum(sole);if(actual>max){
    max=actual;const rotation=foot.rotation.clone();foot.rotation.set(rotation.x,rotation.y,rotation.z,'YXZ');foot.updateWorldMatrix(false,true);const virtualYawPitch=minimum(sole);foot.rotation.copy(rotation);foot.updateWorldMatrix(false,true);
    peak={time:f.s.time,action:state.action,stage:f.s.getRecord('sora')?.trip?.stage,phase:state.pose.ensemblePhase,side,actualSoleMin:actual,virtualYawThenLocalPitchSoleMin:virtualYawPitch,foot:state.pose.feet[i],rotation:rotation.toArray()};
   }}
  }
  rows.push({variant,style,maxPlantedHeight:max,peak,complete:!f.s.records.has('sora')});f.s.cancelAll();until(f,()=>!f.s.records.size&&f.s.ids.every(id=>!f.s.desks[id].busy&&f.s.cups[id].state==='idle'),700);
 }}finally{f.close();}
 const result={method:'Only an in-memory foot rotation is temporarily changed at a captured peak; product source untouched.',measuredAt:new Date().toISOString(),rows};
 fs.writeFileSync(path.join(destination,'foot-rotation-probe.json'),JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exit(0);
}
function sourceFiles(directory){return fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(path.join(directory,entry.name)):entry.name.endsWith('.mjs')?[path.join(directory,entry.name)]:[]);}
const files=['product/tests/precision-nara-sora.test.mjs','product/tests/living-fixture.mjs','scripts/qa/precision-nara-sora.mjs',...['pilot-3d/activities','pilot-3d/personal-office','pilot-3d/living-office','pilot-3d/ensemble-office','pilot-3d/sample'].flatMap(sourceFiles)].sort();
const fingerprint=()=>Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const before=fingerprint(),started=new Date().toISOString();
const child=spawn(process.execPath,['--test','product/tests/precision-nara-sora.test.mjs'],{cwd:root,env:{...process.env,MOTION_PRECISION_EVIDENCE:path.join(destination,'measurements.json')}}),log=fs.createWriteStream(path.join(destination,'tests.tap'));
child.stdout.on('data',data=>{process.stdout.write(data);log.write(data);});
child.stderr.on('data',data=>{process.stderr.write(data);log.write(data);});
const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
await new Promise(resolve=>log.end(resolve));
const after=fingerprint();const summary={started,finished:new Date().toISOString(),exitCode:status,sourceUnchanged:JSON.stringify(before)===JSON.stringify(after),before,after,method:'in-memory models, deterministic 30 Hz simulation; final posed geometry measurements; no DB, 4180, build or Git mutation',physicalSkinGuarantee:false};
fs.writeFileSync(path.join(destination,'summary.json'),JSON.stringify(summary,null,2)+'\n');
process.exitCode=status??1;
