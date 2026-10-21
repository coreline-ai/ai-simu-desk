// Read-only review reproduction, not a passing regression gate. Run from repository root.
import {createRoomV6} from '../../../pilot-3d/room-quality/model.mjs';
import {createTeamRuntime} from '../../../pilot-3d/activities/team-runtime.mjs';
import {releaseStudioAsset} from '../../../pilot-3d/sample/asset-loader.mjs';
import {ActivitySoak} from '../../../pilot-3d/activities/team-soak.mjs';
function setup(){const {root}=createRoomV6(),r=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true}),s=r.scheduler,vm={actors:s.ids.map(agentId=>({agentId,pose:'idle'}))};r.setViewModel(vm);r.update(0);return {root,r,s,vm,close(){r.dispose();releaseStudioAsset(root);}};}
const out={};
for(const pose of ['success','sending','receiving']){
 const f=setup();try{f.s.startVisit();for(let i=0;i<10000&&f.s.visit?.trip.stage!=='out';i++)f.r.update(.025);const stage=f.s.visit?.trip.stage;
 f.r.setViewModel({...f.vm,actors:f.vm.actors.map(a=>a.agentId==='nara'?{...a,pose,cue:'motion-review-'+pose}:a)});f.r.update(.025);const pending=f.s.pendingCues.size;f.r.setViewModel(f.vm);let seen=false;
 for(let i=0;i<1000;i++){f.r.update(.025);if(f.s.state('nara').action===pose)seen=true;}
 out[pose]={visitStageAtCue:stage,pendingAfterCue:pending,cueEverShown:seen,visitAfterReturn:f.s.visit,finalAction:f.s.state('nara').action};}finally{f.close();}
}
const f=setup();try{
 const t=f.r.diagnostics().teamActivities;
 t.visits.history=[{status:'cancelled',ids:['nara','jun'],transfer:false}];t.hands={};t.traffic.active=['nara-sofa','jun-window'];
 for(const a of Object.values(t.actors)){Object.assign(a.counts,{role:1,sofaPair:1,window:1,sofa:1,cup:1,meeting:1,rest:1});a.role.variantsSeen=[0,1,2];}
 const d={teamActivities:t,activities:Object.fromEntries(f.s.ids.map(id=>[id,{action:'typing'}])),paused:false,resetTimes:0,animationTime:0,textures:48,geometries:216};
 const soak=new ActivitySoak('continuous',0,{roles:true,expressive:true,interaction:true});soak.observe(d,0,1);d.animationTime=600;soak.observe(d,600000,1);const report=soak.report(600000);
 out.soakGate={passed:report.passed,visits:report.visits,visitStatus:t.visits.history[0].status,handRows:Object.keys(t.hands).length,transferCompleted:t.transfer.complete,errors:report.errors};
}finally{f.close();}
console.log(JSON.stringify(out,null,2));
