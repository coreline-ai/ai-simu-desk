import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createEnsembleOffice} from '../../pilot-3d/ensemble-office/model.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
import {activityCleanup} from '../../pilot-3d/activities/team-soak.mjs';
const ids=['nara','sora','jun','min','leo'];
for(const id of ids)for(const stage of ['use-early','use','use-late','replace'])test(`${id}: ${stage} interruption retains support until the actual pencil owner releases, with no palm/table overlap`,()=>{
 const {root}=createEnsembleOffice(),r=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true}),s=r.scheduler,vm={actors:ids.map(agentId=>({agentId,pose:'idle'}))},[cx,,cz]=root.userData.finalOffice.meeting.center,skin=s.handGrips.rows.get(id).R.root.children[0],vertices=skin.geometry.attributes.position;
 let cancelled=false,observedRecovery=false,heldAfterExitWindow=false,samples=0,maxPenetration=0;
 try{r.setViewModel(vm);r.update(0);assert(s.startGroupMeeting([id,...ids.filter(x=>x!==id)]));
  for(let n=0;n<10000&&s.group.current;n++){
   r.update(.05);const rec=s.group.record(id);
   if(!cancelled&&rec?.note.stage===(stage.startsWith('use')?'use':stage)&&rec.note.time>({'use-early':.05,'use':.25,'use-late':.55,'replace':.25}[stage])){cancelled=true;if(stage.startsWith('use'))r.setViewModel({actors:vm.actors.map(a=>a.agentId===id?{...a,pose:'typing'}:a)});else s.cancelAll();}
   if(!cancelled||!rec)continue;samples++;
   if(rec.note.busy&&s.group.current.ending){heldAfterExitWindow ||= rec.note.stage==='retract'&&s.meetingSupport.rows.has(id);}
   observedRecovery ||= rec.note.stage==='idle'&&s.meetingSupport.rows.has(id);
   for(let k=0;k<vertices.count;k++){const p=new T.Vector3().fromBufferAttribute(vertices,k).applyMatrix4(skin.matrixWorld);if(((p.x-cx)/1.7)**2+((p.z-cz)/.75)**2<=1&&p.y>.695)maxPenetration=Math.max(maxPenetration,.74-p.y);}
   assert(maxPenetration<.001,JSON.stringify({id,stage,phase:rec.note.stage,trip:rec.trip.stage,maxPenetration}));
   assert(rec.note.handError<.001&&rec.note.tipError<.001);for(const hand of Object.values(s.handGrips.rows.get(id)))assert(hand.error<.003,id+" finger contact "+hand.error);
  }
  assert(cancelled&&samples>20&&heldAfterExitWindow&&observedRecovery);assert.equal(s.group.current,null);r.setViewModel(vm);s.cancelAll();for(let n=0;n<3000&&!activityCleanup(r.diagnostics()).passed;n++)r.update(.05);assert(activityCleanup(r.diagnostics()).passed);assert.deepEqual(s.violations,[]);
 }finally{r.dispose();releaseStudioAsset(root);}
});
