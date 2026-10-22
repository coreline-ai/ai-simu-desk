import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,until,step} from './living-fixture.mjs';
import {validateLivingOffice} from '../../pilot-3d/living-office/model.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
test('living v9 preserves five rigs, all clips and immutable v8 baseline',async()=>{
 const f=fixture();try{validateLivingOffice({scene:f.root});assert.equal(f.animations.length,105);assert.equal(f.root.userData.livingOffice.variants,3);assert.equal(f.s.ids.length,5);assert.equal(f.root.getObjectByName('LivingBoardStrokes').children.length,5);const manifest=JSON.parse(await readFile('product/assets/manifest-room-v8.json'));assert.equal(createHash('sha256').update(await readFile('product/assets/studio-room-v8.glb')).digest('hex'),manifest.sha256);}finally{f.close();}
});
for(const id of['nara','sora','jun','min','leo'])test(id+' three living variants keep body support and fixed limb lengths',()=>{
 const f=fixture();try{const actor=f.root.getObjectByName(f.root.userData.bindings[id].actor),lengths=['NaraElbowL','NaraElbowR','NaraHandL','NaraHandR'].map(n=>part(actor,n).position.length());
 for(let v=0;v<3;v++){f.s.variants.set(id,v);assert(f.s.startSofa(id));until(f,()=>f.s.records.get(id)?.trip.stage==='rest');step(f,2);const pose=f.s.state(id).pose;assert(pose.feet.every(p=>p.planted));assert.equal(f.runtime.diagnostics().teamActivities.version,11);assert(f.runtime.diagnostics().teamActivities.living.details[id].seen.includes(v));f.s.cancelAll();until(f,()=>!f.s.records.size);}
 assert.deepEqual(['NaraElbowL','NaraElbowR','NaraHandL','NaraHandR'].map(n=>part(actor,n).position.length()),lengths);assert.equal(f.s.violations.length,0);
 }finally{f.close();}
});
