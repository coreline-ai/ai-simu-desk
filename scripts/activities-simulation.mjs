// Fast deterministic simulation. This is never a substitute for a wall-clock soak.
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRoomV6} from '../pilot-3d/room-quality/model.mjs';
import {createTeamRuntime} from '../pilot-3d/activities/team-runtime.mjs';
import {ActivitySoak,mixedWork} from '../pilot-3d/activities/team-soak.mjs';
import {releaseStudioAsset} from '../pilot-3d/sample/asset-loader.mjs';
const mode=process.argv[2]==='continuous'?'continuous':'mixed',duration=mode==='continuous'?600:1800;
const natural=process.argv.includes('--natural'),evidence=natural?'natural-activities':'team-activities';
const {root}=createRoomV6(),runtime=createTeamRuntime(root,root.userData,{natural}),ids=root.userData.actorIds,recorder=new ActivitySoak(mode,0,{natural});
try{
 runtime.setViewModel({actors:ids.map(agentId=>({agentId,pose:'idle'}))});runtime.startDemo();let signature='';
 for(let i=0;i<duration/.05;i++){
  const actors=mode==='mixed'?mixedWork(i*.05,ids):ids.map(agentId=>({agentId,pose:'idle'})),next=JSON.stringify(actors);if(next!==signature){runtime.setViewModel({actors});signature=next;}runtime.update(.05);
  if(i%20===0){const d=runtime.diagnostics();recorder.observe({...d,activities:d.actors,animationTime:d.time,textures:0,geometries:0,resetTimes:0,paused:false},i*50,1);}
 }
 const report=recorder.report(duration*1000),summary=Object.fromEntries(Object.entries(report.actors).map(([id,a])=>[id,{sofa:a.sofa,cup:a.cup,meeting:a.meeting,talk:a.actions.some(s=>s==='meeting_talk'||s==='meeting_listen'),sip:a.cupStates.includes('sip'),typing:a.actions.includes('typing'),success:a.actions.includes('success')}]));
 await mkdir('product/evidence/'+evidence,{recursive:true});await writeFile('product/evidence/'+evidence+'/simulated-coverage-'+mode+'.json',JSON.stringify({kind:'fast-simulation-not-wall-clock',report},null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,errors:report.errors,actors:summary}));assert(report.passed,'Fast simulation coverage gate failed');
}finally{runtime.dispose();releaseStudioAsset(root);}
