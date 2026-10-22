// Actual mesh vertices are checked independently of IK diagnostics.
import assert from 'node:assert/strict';
import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import {createEnsembleOffice} from '../../pilot-3d/ensemble-office/model.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
const rotations=process.argv.includes("--single")?[0]:[0,1,2,3,4];
const rows=[], V=()=>new T.Vector3(), options={auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true};
for(const rotation of rotations){
 const {root}=createEnsembleOffice(),r=createTeamRuntime(root,root.userData,options),s=r.scheduler,group=root.userData.finalOffice.meeting,ids=s.ids,order=ids.slice(rotation).concat(ids.slice(0,rotation)),samples={};r.setViewModel({actors:ids.map(agentId=>({agentId,pose:'idle'}))});r.update(0);
 try{assert(s.startGroupMeeting(order));for(let n=0;n<20000&&s.group.current;n++){
  try{r.update(1/60);}catch(e){console.log(JSON.stringify({at:n,rows:[...s.meetingSupport.rows].map(([id,row])=>({id,age:row.age,exit:row.exit,from:row.from,surfaces:row.surfaces})),group:s.group.diagnostics()}));throw e;}if(n%2)continue;
  for(const id of ids){const rec=s.group.record(id);if(rec?.trip.stage!=="rest")continue;for(const side of ["L","R"]){const hand=s.handGrips.rows.get(id)[side];for(const skin of [hand.root.children[0],hand.surface.thenar]){const pos=skin.geometry.attributes.position;for(let i=0;i<pos.count;i++){const p=V().fromBufferAttribute(pos,i).applyMatrix4(skin.matrixWorld),[cx,,cz]=group.center;if(((p.x-cx)/1.7)**2+((p.z-cz)/.75)**2<=1&&p.y>.695)assert(p.y>=.739,JSON.stringify({id,side,skin:skin.name,phase:s.group.current.phase,cup:s.cups[id].state,note:rec.note.stage,p:p.toArray(),penetration:.74-p.y}));}}}}
  for(const note of s.group.notes){if(!note.busy)continue;const id=note.id,key=id+':'+note.stage,row=samples[key]??={id,stage:note.stage,slot:order.indexOf(id),samples:0,tablePenetration:0};row.samples++;
   const palm=s.handGrips.rows.get(id).R.root.children[0],pos=palm.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){const p=V().fromBufferAttribute(pos,i).applyMatrix4(palm.matrixWorld),[cx,,cz]=group.center;if(((p.x-cx)/1.7)**2+((p.z-cz)/.75)**2<=1&&p.y>.695)row.tablePenetration=Math.max(row.tablePenetration,.74-p.y);}
   assert(note.handError<.001,id+' wrist');assert(note.tipError<.001,id+' pencil tip');
   for(const h of Object.values(s.handGrips.rows.get(id)))assert(h.error<.003,id+' fingers '+h.error);
  }
 }
 assert.equal(s.group.current,null);assert.equal(s.group.history.at(-1).status,'complete');rows.push({rotation,order,samples:Object.values(samples)});console.log(JSON.stringify({rotation,maxPenetration:Math.max(...Object.values(samples).map(x=>x.tablePenetration)),worst:Object.values(samples).sort((a,b)=>b.tablePenetration-a.tablePenetration).slice(0,3)}));
 }finally{r.dispose();releaseStudioAsset(root);}
}
await writeFile('product/evidence/ensemble-activities/'+(rotations.length===1?'palm-seated-supports':'palm-volume')+'.json',JSON.stringify({kind:'actual-rendered-palm-mesh-table-volume-25-actor-seat-pairs',rows,passed:rows.every(r=>r.samples.every(s=>s.tablePenetration<.001))},null,2));assert(rows.every(r=>r.samples.every(s=>s.tablePenetration<.001)),'actual palm/table overlap');
