import*as T from'three';import{applyPose,part}from'./character-rig.mjs';import{cyclePose}from'./motion.mjs';import{PROFILES}from'./characters.mjs';
export const STATES=Object.freeze(['idle','typing','thinking','waiting','success','error','blink','preparing','reviewing','sending','receiving','acknowledge','stretch','shoulder_roll','wrist_relax','stand_up','standing','walk','turn','sit_down','rest']);
export const CLIP_LENGTH={idle:4,typing:3.2,thinking:4,waiting:4,success:1.5,error:1.6,blink:4.8,preparing:3,reviewing:3,sending:1.2,receiving:1.2,acknowledge:1,stretch:4,shoulder_roll:4,wrist_relax:3,stand_up:2,standing:3,walk:3,turn:1,sit_down:2,rest:4};
export function poseFor(id,state,time){const profile=PROFILES[id],t=Math.max(0,time),p={...cyclePose(0),time:t,action:state,hip:.53+Math.sin(t*1.7+profile.phase)*profile.breath};
 if(state==='stand_up')return {...cyclePose(1+Math.min(2,t)),time:t};if(state==='sit_down')return {...cyclePose(19+Math.min(2,t)),time:t};if(state==='standing')return {...cyclePose(3),hip:.84+Math.sin(t*1.7+profile.phase)*profile.breath*.5,time:t,action:state};if(state==='walk')return {...cyclePose(4+t%3),action:state};if(state==='turn')return {...cyclePose(3+t%1),time:t,action:state};
 if(state==='stretch')p.arms=Math.sin(Math.PI*Math.min(1,t/4))*profile.stretch;
 if(state==='success')p.arms=Math.sin(Math.PI*Math.min(1,t/1.5))*.65;
 return p;
}
export function applyCharacterPose(actor,state,time,{pose,lookAt}={}){
 const id=actor.userData.agentId??'nara',profile=PROFILES[id],p=pose??poseFor(id,state,time);if(pose&&state==='rest')p.hip+=Math.sin(time*1.5+profile.phase)*profile.breath*.5;applyPose(actor,p);
 const head=part(actor,'NaraHead'),left=part(actor,'NaraShoulderL'),right=part(actor,'NaraShoulderR'),lh=part(actor,'NaraHandL'),rh=part(actor,'NaraHandR');head.rotation.set(0,0,0);part(actor,'NaraTorso').rotation.y=0;lh.rotation.set(0,0,0);rh.rotation.set(0,0,0);
 if(!pose){
  if(state==='typing'){part(actor,'NaraElbowL').rotation.x+=Math.sin(time*6.5+profile.phase)*profile.typing;part(actor,'NaraElbowR').rotation.x+=Math.sin(time*7.1+profile.phase+1)*profile.typing*.8;head.rotation.x=.045;}
  if(state==='idle'){head.rotation.y=Math.sin(time*.55+profile.phase)*.045;}
  if(state==='turn'){head.rotation.y=Math.sin(time*Math.PI)*.20;part(actor,'NaraTorso').rotation.y=Math.sin(time*Math.PI)*.10;}
  if(state==='thinking'){head.rotation.set(-.06,.10,.09);right.rotation.x=-2.25;part(actor,'NaraElbowR').rotation.x=-.55;}
  if(state==='waiting'){head.rotation.x=-.04;left.rotation.x=right.rotation.x=-.55;}
  if(state==='preparing'){head.rotation.set(.12,-.17,0);lh.rotation.z=Math.sin(time*1.4)*.09;}
  if(state==='reviewing'){head.rotation.set(.17,.08,0);right.rotation.x=-.9;}
  if(state==='error'){head.rotation.z=Math.sin(time*6)*.07*Math.sin(Math.PI*Math.min(1,time/1.6));}
  if(state==='sending'||state==='receiving'){const env=Math.sin(Math.PI*Math.min(1,time/1.2));const side=state==='sending'?right:left;side.rotation.z=(state==='sending'?-1:1)*env*.55;side.rotation.x=-1.05-env*.55;head.rotation.x=state==='receiving'?Math.sin(time*7)*.06:0;}
  if(state==='acknowledge')head.rotation.x=Math.sin(time*Math.PI*2)*.12;
  if(state==='shoulder_roll'){left.rotation.z=.14+Math.sin(time*Math.PI)*.13;right.rotation.z=-.14-Math.sin(time*Math.PI+.3)*.13;head.rotation.z=Math.sin(time*1.4)*.025;}
  if(state==='wrist_relax'){lh.rotation.z=Math.sin(time*3)*.45;rh.rotation.z=Math.sin(time*3+.7)*.45;right.rotation.x=left.rotation.x=-1.15;}
  if(state==='rest'){head.rotation.set(-.08,Math.sin(time*.6+profile.phase)*.13,.025);left.rotation.x=-.28;right.rotation.x=-.36;}
 }
 if(state==='rest')head.rotation.set(-.08,Math.sin(time*.6+profile.phase)*.13,.025);
 if(lookAt){actor.updateWorldMatrix(true,true);const q=head.parent.worldToLocal(new T.Vector3(...lookAt)).sub(head.position);head.rotation.y=T.MathUtils.clamp(Math.atan2(q.x,q.z),-.35,.35);}
 const phase=(time+profile.phase)%4.8,blink=phase<.15?Math.max(.05,Math.abs(phase-.075)/.075):1;for(const sign of[-1,1])for(const n of['EyeWhite','Iris','EyeGlint']){const eye=part(actor,n+sign);if(eye){eye.userData.baseEyeY??=eye.scale.y;eye.scale.y=eye.userData.baseEyeY*blink;}}
 actor.updateMatrixWorld(true);return p;
}
export function actorClips(actor){
 const nodes=[];actor.traverse(o=>{if(o!==actor&&(o.isGroup||o.isBone||/EyeWhite|Iris|EyeGlint/.test(o.name)))nodes.push(o);});const clips=[];
 for(const state of STATES){const duration=CLIP_LENGTH[state],frames=Math.ceil(duration*24),times=[],values=new Map(nodes.map(n=>[n.name,{p:[],q:[],s:[]}]));for(let i=0;i<=frames;i++){const time=i/frames*duration;applyCharacterPose(actor,state,time);times.push(time);for(const n of nodes){const v=values.get(n.name);v.p.push(...n.position);v.q.push(...n.quaternion);v.s.push(...n.scale);}}
  const tracks=[];for(const n of nodes){const v=values.get(n.name);tracks.push(new T.VectorKeyframeTrack(n.name+'.position',times,v.p),new T.QuaternionKeyframeTrack(n.name+'.quaternion',times,v.q));if(n.isMesh)tracks.push(new T.VectorKeyframeTrack(n.name+'.scale',times,v.s));}clips.push(new T.AnimationClip(actor.userData.agentId+'_'+state,duration,tracks).optimize());
 }applyCharacterPose(actor,'idle',0);return clips;
}
