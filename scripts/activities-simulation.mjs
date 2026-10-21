// Fast deterministic simulation. This is never a substitute for a wall-clock soak.
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRoomV6} from '../pilot-3d/room-quality/model.mjs';
import {createTeamRuntime} from '../pilot-3d/activities/team-runtime.mjs';
import {ActivitySoak,activityCleanup,mixedWork,roleMixedWork,interactionMixedWork} from '../pilot-3d/activities/team-soak.mjs';
import {releaseStudioAsset} from '../pilot-3d/sample/asset-loader.mjs';
const mode=process.argv[2]==='continuous'?'continuous':'mixed',duration=mode==='continuous'?600:1800;
const interaction=process.argv.includes('--interaction'),expressive=interaction||process.argv.includes('--expressive'),natural=expressive||process.argv.includes('--natural'),evidence=interaction?'interaction-activities':expressive?'expressive-activities':natural?'natural-activities':'team-activities';
const {root}=createRoomV6(),runtime=createTeamRuntime(root,root.userData,{natural,enriched:expressive,expressive,interaction}),ids=root.userData.actorIds,recorder=new ActivitySoak(mode,0,{natural,roles:expressive,expressive,interaction});
try{
 runtime.setViewModel({actors:ids.map(agentId=>({agentId,pose:'idle'}))});runtime.startDemo();let signature='';
 for(let i=0;i<duration/.05;i++){
  const actors=mode==='mixed'?(interaction?interactionMixedWork:expressive?roleMixedWork:mixedWork)(i*.05,ids):ids.map(agentId=>({agentId,pose:'idle'})),next=JSON.stringify(actors);if(next!==signature){runtime.setViewModel({actors});signature=next;}runtime.update(.05);
  if(i%20===0){const d=runtime.diagnostics();recorder.observe({...d,activities:d.actors,animationTime:d.time,textures:0,geometries:0,resetTimes:0,paused:false},i*50,1);}
 }
 const report=recorder.report(duration*1000);let cleanup;if(expressive){runtime.scheduler.setAuto(false);runtime.setViewModel({actors:ids.map(agentId=>({agentId,pose:'idle'}))});runtime.scheduler.cancelAll();for(let i=0;i<4000;i++)runtime.update(.05);cleanup=runtime.diagnostics().teamActivities;assert.deepEqual(cleanup.claims,{});assert.equal(cleanup.meeting,null);assert.equal(cleanup.sofaPair,null);if(interaction){assert.equal(cleanup.visits.current,null);assert(!cleanup.transfer.active);assert(cleanup.transfer.pages.every(p=>p.owner==='desk:'+p.desk));}assert(Object.values(cleanup.actors).every(a=>a.kind==='desk'&&a.role.owner==='desk'&&a.cup.owner==='desk'));}const summary=Object.fromEntries(Object.entries(report.actors).map(([id,a])=>[id,{sofa:a.sofa,cup:a.cup,meeting:a.meeting,talk:a.actions.some(s=>s==='meeting_talk'||s==='meeting_listen'),sip:a.cupStates.includes('sip'),typing:a.actions.includes('typing'),success:a.actions.includes('success'),variants:a.variants,styles:a.styles}]));
 if(interaction)assert(activityCleanup(cleanup).passed,'Complete prop/reservation cleanup required');
 const output=process.env.STUDIO_EVIDENCE_DIR??'product/evidence/'+evidence;
 await mkdir(output,{recursive:true});await writeFile(output+'/simulated-coverage-'+mode+'.json',JSON.stringify({kind:'fast-simulation-not-wall-clock',report,cleanup},null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,errors:report.errors,actors:summary}));assert(report.passed,'Fast simulation coverage gate failed');
}finally{runtime.dispose();releaseStudioAsset(root);}
