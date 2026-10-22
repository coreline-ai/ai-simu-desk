import * as T from 'three';
import assert from 'node:assert/strict';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,until} from '../../product/tests/living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';
const out='product/evidence/human-motion',f=fixture(),rows=Object.fromEntries(f.s.ids.map(id=>[id,[]]));
const V=()=>new T.Vector3();
const flex=(actor,side)=>{const a=part(actor,'NaraShoulder'+side).getWorldPosition(V()),b=part(actor,'NaraElbow'+side).getWorldPosition(V()),c=part(actor,'NaraHand'+side).getWorldPosition(V());return(Math.PI-a.sub(b).angleTo(c.sub(b)))*180/Math.PI;};
try{
 assert(f.s.startHuddle());
 until(f,()=>f.s.ids.every(id=>rows[id].length>=50),220,()=>{
  for(const id of f.s.ids){const state=f.s.state(id),p=state.pose;if(state.action!=='walk'||p.gaitFade<.98||rows[id].length>=90)continue;
   const actor=f.root.getObjectByName(f.s.meta.bindings[id].actor),shoulder=part(actor,'NaraShoulderL').getWorldPosition(V());
   if(f.s.bodyContacts.furniture.some(item=>item.box.distanceToPoint(shoulder)<.6))continue;
   rows[id].push({elbow:flex(actor,'L'),wrist:part(actor,'NaraHandL').rotation.y,shoulder:part(actor,'NaraShoulderL').rotation.x,phase:p.gaitTime});
  }
 });
 const profiles=f.runtime.diagnostics().teamActivities.living.humanMotion.profiles;
 const report=Object.fromEntries(f.s.ids.map(id=>{const angles=rows[id].map(r=>r.elbow),record=f.s.huddles.current.records.get(id);return[id,{samples:rows[id].length,elbowMin:Math.min(...angles),elbowMax:Math.max(...angles),cadencePeriod:record.trip.options.routeMotion.period,speed:record.trip.options.routeMotion.speed,style:profiles[id].style,handMeshVersion:f.s.handGrips.rows.get(id).L.surface?2:1}];}));
 const baseline=JSON.parse(await readFile(out+'/baseline-arms.json'));
 assert.equal(createHash('sha256').update(await readFile('product/assets/studio-room-v9.glb')).digest('hex'),baseline.assetHash);
 assert.deepEqual(f.s.violations,[]);for(const row of Object.values(report)){assert(row.elbowMax<35);assert(row.elbowMax-row.elbowMin>1);}
 await mkdir(out,{recursive:true});await writeFile(out+'/after-arms.json',JSON.stringify({passed:true,assetUnchanged:true,measurement:'actual five-person huddle arrivals; free left arms away from furniture',report,rows},null,2));
 console.log(JSON.stringify({passed:true,report}));
}finally{f.close();}
