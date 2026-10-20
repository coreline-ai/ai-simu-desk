import * as T from 'three';
import {optimizeRigid}from'./optimize.mjs';
import {createNara,applyPose} from './character-rig.mjs';
import {addWorkspace} from './workspace.mjs';
import {cyclePose,COLLIDERS,BODY_RADIUS} from './motion.mjs';
import {group,material,box} from './geometry.mjs';
export function createSample({detailed=false,optimized=false}={}){
 const root=group(null,'NaraQualitySample');root.userData={schemaVersion:1,assetId:'nara-workspace-sample-v1',scope:'one-character-prototype',units:'metres',up:'+Y',floorY:0,actorId:'nara',root:'NaraActorRoot',rig:'NaraRigRoot',anchors:['NaraHead','NaraSeatAnchor','NaraFootL','NaraFootR'],clipPolicy:'in-place; ActorRoot owned by runtime; analytic foot-lock correction from same source',colliders:COLLIDERS,bodyRadius:BODY_RADIUS,route:[[0,-.48],[-1.35,-.48]],dimensions:{desk:[1.4,.74,.7],chairSeat:.45}};
 const actor=createNara(root);
 if(!detailed){const grey=material('Greybox',0xb7b9ac);box(root,'GreyDesk',[1.4,.74,.7],[0,.37,.1],grey);box(root,'GreyFloor',[4,.08,3.5],[-.5,-.04,-.2],grey);}
 if(detailed)addWorkspace(root);
 const animations=[];
 const ranges={typing:[0,1],stand_up:[1,3],standing:[3,3.5],turn:[3,4],walk:[4,7],stretch:[8,12],rest:[12,14],sit_down:[19,21]};
 const nodes=[];actor.traverse(o=>{if((o.isGroup||o.isBone)&&o!==actor)nodes.push(o);});
 for(const [name,[start,end]]of Object.entries(ranges)){
  const frames=Math.ceil((end-start)*24),times=[],values=new Map(nodes.map(o=>[o.name,{p:[],q:[]}]));
  for(let i=0;i<=frames;i++){const t=start+(end-start)*i/frames;applyPose(actor,cyclePose(t));times.push(t-start);for(const o of nodes){const v=values.get(o.name);v.p.push(...o.position);v.q.push(...o.quaternion);}}
  const tracks=[];for(const o of nodes){const v=values.get(o.name);tracks.push(new T.VectorKeyframeTrack(o.name+'.position',times,v.p),new T.QuaternionKeyframeTrack(o.name+'.quaternion',times,v.q));}
  animations.push(new T.AnimationClip('nara_'+name,end-start,tracks));
 }
 applyPose(actor,cyclePose(0));root.userData.clips=animations.map(a=>a.name);if(optimized)optimizeRigid(root);return {root,actor,animations};
}
