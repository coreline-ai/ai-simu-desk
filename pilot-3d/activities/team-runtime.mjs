import {MeetingSupport} from './meeting-support.mjs';
import {BodyContacts} from './body-contact.mjs';
import {SofaSupport} from './sofa-support.mjs';
import {NaturalMotion} from './natural-motion.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from 'three';
import {createOfficeRuntime} from '../sample/runtime.mjs';
import {part} from '../sample/character-rig.mjs';
import {prepareDestinations,MEETING_SLOTS} from './destinations.mjs';
import {CupInteraction,solveArm} from './interactions.mjs';
import {TeamActivityScheduler} from './team-scheduler.mjs';
import {DeskAction} from './desk-actions.mjs';
import {RoleActivityScheduler} from './role-scheduler.mjs';
import {ActivityGaze} from './gaze.mjs';
import {ExpressiveScheduler} from './expressive-scheduler.mjs';
import {expressiveMotion} from './expressive-motion.mjs';
import {HandGrips} from './hand-grips.mjs';
import {InteractionScheduler} from './interaction-scheduler.mjs';
export function createTeamRuntime(model,metadata,{auto=true,natural=false,naturalActors=metadata.actorIds,enriched=false,enrichedActors=metadata.actorIds,expressive=false,expressiveActors=metadata.actorIds,interaction=false,interactionActors=metadata.actorIds,refined=false,grounded=false,seed=17}={}){
 const destinations=prepareDestinations(model,metadata);let furniture=model.getObjectByName('ActivityFurniture');
 if(!furniture){furniture=new T.Group();furniture.name='ActivityFurniture';model.add(furniture);MEETING_SLOTS.forEach((slot,i)=>{const chair=new T.Group();chair.name='ActivityMeetingChair'+i;const source=model.getObjectByName('NaraChairCushion'),seat=new T.Mesh(new T.CylinderGeometry(.16,.16,.065,24),source.material);seat.position.y=.3675;seat.castShadow=true;seat.receiveShadow=true;chair.add(seat);const legs=[];for(const x of[-.10,.10])for(const z of[-.10,.10]){const g=new T.CylinderGeometry(.014,.018,.34,8);g.translate(x,.17,z);legs.push(g);}const geometry=mergeGeometries(legs);for(const g of legs)g.dispose();const legMesh=new T.Mesh(geometry,model.getObjectByName('NaraOakDeskTop').material);legMesh.castShadow=true;legMesh.receiveShadow=true;chair.add(legMesh);chair.position.fromArray(slot.position);chair.rotation.y=Math.atan2(3.5-slot.position[0],2.45-slot.position[2]);furniture.add(chair);const drop=new T.Object3D();drop.name='ActivityCupDrop'+i;drop.position.fromArray(slot.cup);drop.rotation.y=chair.rotation.y;furniture.add(drop);});}
 const cups=Object.fromEntries(metadata.actorIds.map(id=>[id,new CupInteraction(model,model.getObjectByName(metadata.bindings[id].actor),id)]));const drops=MEETING_SLOTS.map((_,i)=>furniture.getObjectByName('ActivityCupDrop'+i));
 const desks=enriched?Object.fromEntries(metadata.actorIds.map(id=>[id,new DeskAction(model,model.getObjectByName(metadata.bindings[id].actor),id,{expressive:expressive&&expressiveActors.includes(id)})])):null;
 const scheduler=enriched?new (interaction?InteractionScheduler:expressive?ExpressiveScheduler:RoleActivityScheduler)(metadata.actorIds,destinations,cups,drops,desks,{auto,natural,naturalActors,enrichedActors,expressiveActors,interactionActors,refined,grounded,model,metadata,seed}):new TeamActivityScheduler(metadata.actorIds,destinations,cups,drops,{auto,natural,naturalActors,seed});
 const motion=natural?new NaturalMotion(scheduler,naturalActors):null;
 const gaze=enriched?new ActivityGaze(model,metadata,scheduler):null;
 const actorMap=Object.fromEntries(metadata.actorIds.map(id=>[id,model.getObjectByName(metadata.bindings[id].actor)]));
 const hands=interaction?new HandGrips(actorMap,desks,cups,interactionActors,{refined}):null;
 scheduler.handGrips=hands;
 const sofaSupport=refined&&interaction?new SofaSupport(model,scheduler):null;scheduler.sofaSupport=sofaSupport;
 const contacts=grounded?new BodyContacts(model,actorMap,scheduler):null;scheduler.bodyContacts=contacts;const meetingSupport=grounded?new MeetingSupport(model,scheduler):null;scheduler.meetingSupport=meetingSupport;
 scheduler.violations=[];
 const runtime=createOfficeRuntime(model,metadata,{scheduler,afterUpdate(actors,_scheduler,dt){contacts?.update(dt);const points=Object.entries(actors).map(([id,a])=>[id,a.getWorldPosition(new T.Vector3())]);for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j];if(Math.hypot(a[1].x-b[1].x,a[1].z-b[1].z)<.44){const message='body overlap '+a[0]+'/'+b[0];if(!scheduler.violations.includes(message)&&scheduler.violations.length<20)scheduler.violations.push(message);}}},afterPose(id,actor,state,dt){const rec=scheduler.records.get(id);if(state.pose?.seatBlend!==undefined){const u=state.pose.seatBlend,variant=state.variant??0;part(actor,'NaraTorso').rotation.x=(rec?.kind==='meeting'?.035:-.07-variant*.02)*u;part(actor,'NaraTorso').position.z=(rec?.kind==='meeting'?.10:.045)*u;for(const side of ['L','R']){part(actor,'NaraShoulder'+side).rotation.x=-.30*u;part(actor,'NaraElbow'+side).rotation.x=-.65*u;}}
  if(state.action==='meeting_talk'){part(actor,'NaraShoulderR').rotation.x=-.65-Math.sin(state.time*2.2)*.15;part(actor,'NaraShoulderR').rotation.z=-.18;part(actor,'NaraElbowR').rotation.x=-.8;}
  if(state.action==='meeting_listen')part(actor,'NaraHead').rotation.x=Math.sin(state.time*2)*.045;
  if(state.action==='sofa_rest'){const variant=state.variant??0;part(actor,'NaraTorso').rotation.x+=Math.sin(state.time*1.4)*.008;part(actor,'NaraHead').rotation.y=Math.sin(state.time*.45+variant)*(variant===1?.25:.08);if(variant===2){actor.updateMatrixWorld(true);const hip=part(actor,'NaraPelvis').position.y,q=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));for(const side of ['L','R'])solveArm(actor,actor.localToWorld(new T.Vector3(side==='L'?-.04:.04,hip+.08,.18)),q,side);}}
  if(enriched)part(actor,'NaraTorso').rotation.z=0;
  motion?.apply(id,actor,state,dt);
  if(expressive)expressiveMotion(scheduler,id,actor,state);if(grounded&&state.pose){part(actor,'NaraTorso').rotation.y+=state.pose.turnLead??0;part(actor,'NaraTorso').rotation.z-=(state.pose.weightShift??0)*1.5;}
  if(expressive&&scheduler.expressiveActors.has(id)&&rec?.trip?.stage==='queued'){part(actor,'NaraTorso').rotation.z=Math.sin(scheduler.time*.65)*.012;part(actor,'NaraHead').rotation.y+=Math.sin(scheduler.time*.4)*.07;}
  if(enriched&&state.activity==='sofaPair'){const u=state.gesture??0,hip=part(actor,'NaraPelvis').position.y;part(actor,'NaraTorso').rotation.y=(scheduler.sofaPair.ids[0]===id?.035:-.035)*u;part(actor,'NaraHead').rotation.x+=state.action==='sofa_agree'?Math.sin(state.time*4)*.06*u:0;actor.updateMatrixWorld(true);const q=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));if(!refined)for(const side of ['L','R'])solveArm(actor,actor.localToWorld(new T.Vector3(side==='L'?-.10:.10,hip+.12+(state.action==='sofa_talk'&&side==='R'?.06*u:0),.18)),q,side);}
  scheduler.applyVisit?.(id,actor,state);
  gaze?.apply(id,actor,state,dt);
  sofaSupport?.apply(id,actor,state,dt);meetingSupport?.apply(id,actor,state,dt);
  desks?.[id].apply();if(desks?.[id].busy&&motion)for(const name of ['NaraShoulderR','NaraElbowR'])motion.previous.get(id)?.set(name,part(actor,name).quaternion.clone());actor.updateMatrixWorld(true);cups[id].apply();scheduler.transfer?.apply(id,actor);hands?.apply(id,dt,scheduler.transfer?.handOverrides(id));scheduler.present(id,state,dt);contacts?.clearDeskArms(id,actor,dt);sofaSupport?.remember(id,actor);meetingSupport?.remember(id,actor);
 }});
 const dispose=runtime.dispose;runtime.dispose=()=>{contacts?.dispose();meetingSupport?.dispose();sofaSupport?.dispose();hands?.dispose();gaze?.dispose();dispose();};runtime.gaze=gaze;return runtime;
}
