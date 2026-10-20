import*as T from'three';import{AmbientScheduler}from'./ambient-motion.mjs';import{applyCharacterPose}from'./poses.mjs';import{part}from'./character-rig.mjs';import{ease}from'./motion.mjs';
const JOINTS=['NaraHead','NaraTorso','NaraShoulderL','NaraShoulderR','NaraElbowL','NaraElbowR','NaraHandL','NaraHandR'];
export function createOfficeRuntime(model,metadata,options={}){
 const scheduler=options.scheduler??new AmbientScheduler(metadata.actorIds),actors=Object.fromEntries(metadata.actorIds.map(id=>[id,model.getObjectByName(metadata.bindings[id].actor)])),transition=new Map();
 return {scheduler,setViewModel(vm){scheduler.setViewModel(vm);},startDemo(){scheduler.startDemo();},update(dt){if(scheduler.paused)return;scheduler.tick(dt);
  for(const[id,actor]of Object.entries(actors)){const state=scheduler.state(id),previous=transition.get(id);let current=previous;
   if(!current||current.action!==state.action){current={action:state.action,time:0,from:new Map(JOINTS.map(name=>{const node=part(actor,name);return[name,{p:node.position.clone(),q:node.quaternion.clone()}];}))};transition.set(id,current);}current.time+=dt;
   const targetActor=actors[state.lookAt],targetHead=targetActor?part(targetActor,'NaraHead').getWorldPosition(new T.Vector3()).toArray():null;
   applyCharacterPose(actor,state.action,state.time,{pose:state.pose,lookAt:targetHead});
   if(!state.pose&&current.time<.25){const u=ease(current.time/.25);for(const[name,from]of current.from){const node=part(actor,name);node.position.lerpVectors(from.p,node.position,u);node.quaternion.slerpQuaternions(from.q,node.quaternion,u);}}
   options.afterPose?.(id,actor,state);
   const chair=model.getObjectByName(actor.userData.prefix+'SampleChair');if(chair)chair.position.z=-.60-(state.pose?.chair??0)*.75;actor.updateMatrixWorld(true);
  }
 },diagnostics(){return scheduler.diagnostics();},dispose(){scheduler.dispose();transition.clear();}};
}
