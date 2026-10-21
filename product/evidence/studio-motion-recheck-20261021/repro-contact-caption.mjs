// Run from the repository root. Review observations, not a new acceptance gate.
import {writeFile} from 'node:fs/promises';
import * as T from 'three';
import {createRoomV6} from '../../../pilot-3d/room-quality/model.mjs';
import {createTeamRuntime} from '../../../pilot-3d/activities/team-runtime.mjs';
import {releaseStudioAsset} from '../../../pilot-3d/sample/asset-loader.mjs';

const {root}=createRoomV6();
const runtime=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true});
const scheduler=runtime.scheduler;
runtime.setViewModel({actors:scheduler.ids.map(agentId=>({agentId,pose:'idle'}))});
runtime.update(0);
const rows=[];
try {
  for(const id of scheduler.ids)for(const mode of ['role-0','role-1','role-2','cup']) {
    const peaks=[0,0,0,0,0];
    const hand=scheduler.handGrips.rows.get(id)[mode==='cup'?'L':'R'];
    let samples=0;
    if(mode==='cup')scheduler.startCup(id);
    else scheduler.startRole(id,{variant:Number(mode.at(-1))});
    for(let frame=0;frame<480;frame++) {
      runtime.update(.025);
      const desk=scheduler.desks[id],cup=scheduler.cups[id];
      if(hand.blend<.995||(mode==='cup'?cup.owner!=='hand':desk.owner!=='hand'))continue;
      const targets=hand.contacts(mode==='cup'?cup.mug:desk.prop,mode==='cup'?'cup':id==='leo'?'page':'pen');
      hand.fingers.forEach((finger,index)=>{peaks[index]=Math.max(peaks[index],finger.pad.position.distanceTo(targets[index]));});
      samples++;
    }
    rows.push({id,mode,samples,peakFingerTargetDistanceMm:peaks.map(value=>value*1000)});
  }
  const host=root.getObjectByName(root.userData.bindings.jun.actor);
  const from=host.getWorldPosition(new T.Vector3());
  scheduler.startVisit('nara','jun');
  for(let frame=0;frame<2000&&scheduler.visit?.trip.stage!=='out';frame++)runtime.update(.025);
  for(let frame=0;frame<30;frame++)runtime.update(.025);
  const diagnostics=runtime.diagnostics();
  const caption={tripStage:scheduler.visit?.trip.stage,hostMovementMm:host.getWorldPosition(new T.Vector3()).distanceTo(from)*1000,hostAction:scheduler.state('jun').action,hostDiagnostic:diagnostics.teamActivities.actors.jun};
  const report={kind:'deterministic-source-review-not-browser-or-wall-clock',at:new Date().toISOString(),rows,caption,scope:'Finger target-point distances in hand-local metres for all five fingers while holding a prop; does not measure skin penetration or friction.'};
  await writeFile(new URL('./contact-and-caption.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify({scenarios:rows.length,samples:rows.reduce((sum,row)=>sum+row.samples,0),maxByFingerMm:peaksAcrossRows(rows),hostMovementMm:caption.hostMovementMm,hostStage:caption.hostDiagnostic.stage},null,2));
} finally {
  runtime.dispose();
  releaseStudioAsset(root);
}
function peaksAcrossRows(rows){return [0,1,2,3,4].map(index=>Math.max(...rows.map(row=>row.peakFingerTargetDistanceMm[index])));}
