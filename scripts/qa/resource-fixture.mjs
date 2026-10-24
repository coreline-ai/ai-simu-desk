// Isolated, in-memory visual/performance QA. No product data or API requests.
import {createQualityView} from '../../pilot-3d/sample/quality-view.mjs';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
const ids=['nara','sora','jun','min','leo'],host=document.querySelector('#stage'),actors=ids.map(agentId=>({agentId,pose:'idle'}));
let runtime;const errors=[];
const view=createQualityView(host,{onStatus(kind,error){if(error)errors.push(kind+': '+error.message);}},{modelVersion:9,modelUrl:'/assets/studio-room-v9.glb',roomQuality:true,actorLabels:{nara:'나라',sora:'소라',jun:'준',min:'민',leo:'레오'},runtimeFactory:(model,meta)=>(runtime=createTeamRuntime(model,meta,{auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true,personalMotion:true,personalities:true,anatomicalActors:ids}))});
view.setViewModel({actors,motionPaused:true});view.setQuality('balanced');
const ready=await view.ready;
function pixels(){view.setLighting('day');const c=host.querySelector('canvas'),gl=c.getContext('webgl2'),data=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);let hash=2166136261;for(const byte of data)hash=Math.imul(hash^byte,16777619);return{hash:(hash>>>0).toString(16),width:c.width,height:c.height,error:gl.getError()};}
function sample(name,seconds=4,focus='room'){
 view.setViewModel({actors,motionPaused:true});view.resetActivity();runtime.setViewModel({actors,motionPaused:false});
 const s=runtime.scheduler;
 if(name.startsWith('roles'))for(const id of ids)s.startRole(id,{variant:Number(name.at(-1))});
 if(name==='cups')for(const id of ids)s.startCup(id);
 if(name==='glasses')s.personalMotion.glasses.start();
 if(name==='transfer')s.startVisit('leo','nara',{transfer:true});
 for(let n=0;n<Math.round(seconds*60);n++)runtime.update(1/60);
 view.setViewModel({actors,motionPaused:true});view.resetCamera(focus);
 const result={name,seconds,focus,pixels:pixels(),diagnostics:view.diagnostics(),errors:[...errors]};document.querySelector('#result').textContent=JSON.stringify(result);return result;
}
window.__resourceFixture={ready,view,get runtime(){return runtime;},sample,pixels,run(){view.setViewModel({actors,motionPaused:false});},pause(){view.setViewModel({actors,motionPaused:true});},diagnostics:()=>view.diagnostics(),errors};
document.querySelector('#run').onclick=()=>window.__resourceFixture.run();document.querySelector('#pause').onclick=()=>window.__resourceFixture.pause();
window.addEventListener('pagehide',()=>view.dispose(),{once:true});
