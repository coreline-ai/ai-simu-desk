import {createStudioView} from '../../../pilot-3d/src/scene.mjs';
const ids=['nara','sora','jun','min','leo'];let view;
async function load(){view?.dispose();view=createStudioView(document.querySelector('#room'),{onStatus(s){document.querySelector('#status').textContent=s;},onMetrics(s){document.querySelector('#metrics').textContent=JSON.stringify(s);}}, {actors:ids,modelUrl:'/assets/qa/studio-team-'+document.querySelector('#model').value+'.glb'});await view.ready;pose('typing');}
function pose(value){view.setViewModel({actors:ids.map((agentId,i)=>({agentId,pose:value,cue:'qa:'+value+':'+i,lookAt:ids[(i+1)%5]})),motionPaused:false});}
document.querySelector('#load').onclick=load;document.querySelector('#measure').onclick=()=>view.measure();
for(const b of document.querySelectorAll('[data-pose]'))b.onclick=()=>pose(b.dataset.pose);
load();
