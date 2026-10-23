import assert from 'node:assert/strict';
import {createLivingOffice} from '../../pilot-3d/living-office/model.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';
export function fixture(options={}){const {root,animations}=createLivingOffice();let runtime=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true,...options});let s=runtime.scheduler;const vm={actors:s.ids.map(agentId=>({agentId,pose:'idle'}))};runtime.setViewModel(vm);runtime.update(0);return{root,animations,runtime,s,vm,reset(){runtime.dispose();runtime=createTeamRuntime(root,root.userData,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true,...options});s=runtime.scheduler;runtime.setViewModel(vm);runtime.update(0);this.runtime=runtime;this.s=s;},close(){runtime.dispose();releaseStudioAsset(root);}};}
export function until(f,predicate,seconds=240,check=()=>{}){for(let n=0;n<seconds*30&&!predicate();n++){f.runtime.update(1/30);check();}assert(predicate(),'activity settles within '+seconds+'s');}
export function step(f,seconds){for(let n=0;n<seconds*30;n++)f.runtime.update(1/30);}
