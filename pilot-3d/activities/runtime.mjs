import {createOfficeRuntime} from '../sample/runtime.mjs';
import {part} from '../sample/character-rig.mjs';
import {prepareSofa} from './model.mjs';
import {sofaAnchors} from './anchors.mjs';
import {SofaScheduler} from './scheduler.mjs';
export function createSofaRuntime(model, metadata){
 const {seatBox}=prepareSofa(model),anchors=sofaAnchors(model,metadata,seatBox),scheduler=new SofaScheduler(metadata.actorIds,anchors);
 return createOfficeRuntime(model,metadata,{scheduler,afterPose(id,actor,state){if(id!=='nara'||state.pose?.seatBlend===undefined)return;const u=state.pose.seatBlend;
  part(actor,'NaraTorso').rotation.x=-.07*u+(state.action==='sofa_rest'?Math.sin(state.time*1.4)*.008:0);part(actor,'NaraTorso').position.z=.045*u;
  for(const side of ['L','R']){part(actor,'NaraShoulder'+side).rotation.x=-.30*u;part(actor,'NaraShoulder'+side).rotation.z=(side==='L'?1:-1)*.06*u;part(actor,'NaraElbow'+side).rotation.x=-.65*u;}
  const head=part(actor,'NaraHead');head.rotation.y=Math.sin(state.time*.45)*.07*u;head.rotation.x=-.025*u;actor.updateMatrixWorld(true);
 }});
}
