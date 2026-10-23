import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
const V=()=>new T.Vector3();
// A bounded, fixed-step rehearsal range. Restart replays the selected local
// demonstration from its initial state; server/task time is never rewound.
export class InspectionRange {
 constructor(){this.enabled=false;this.from=0;this.to=12;this.elapsed=0;this.rounds=0;this.reason='';}
 configure(from,to){from=Number(from);to=Number(to);if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to>120||to-from<.5)return false;this.from=from;this.to=to;this.elapsed=from;this.rounds=0;this.enabled=true;this.reason='';return true;}
 advance(dt,restart){if(!this.enabled||dt<=0)return;this.elapsed+=dt;if(this.elapsed+1e-8<this.to)return;this.rounds++;this.elapsed=this.from;if(!restart(this.from))this.cancel('시연을 다시 시작할 수 없음');}
 cancel(reason='사용자 중단'){this.enabled=false;this.reason=reason;}
 diagnostics(){return{enabled:this.enabled,from:this.from,to:this.to,elapsed:this.elapsed,rounds:this.rounds,reason:this.reason};}
}
// Markers live outside the model, so shared scene node order and GLB assets stay
// unchanged. These are actual wrist/foot/pad positions, not collision guarantees.
export class ContactMarkers {
 constructor(scene){this.geometry=new T.BufferGeometry();this.positions=new Float32Array(24*3);this.colors=new Float32Array(24*3);this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,3));this.material=new T.PointsMaterial({size:.025,vertexColors:true,depthTest:false,transparent:true,opacity:.95});this.points=new T.Points(this.geometry,this.material);this.points.name='LocalInspectionContacts';this.points.frustumCulled=false;this.points.renderOrder=1000;this.points.visible=false;scene.add(this.points);this.count=0;this.actor='nara';this.enabled=false;}
 update(s){this.count=0;this.points.visible=this.enabled;const c=s?.cups?.[this.actor],a=c?.actor;if(!this.enabled||!a){this.geometry.setDrawRange(0,0);return;}
 const add=(p,color)=>{if(this.count>=24)return;this.positions.set(p.toArray(),this.count*3);this.colors.set(new T.Color(color).toArray(),this.count*3);this.count++;};
 for(const side of ['L','R']){add(part(a,'NaraHand'+side).getWorldPosition(V()),0x41a6e8);add(part(a,'NaraFoot'+side).getWorldPosition(V()),0x4dbb65);const h=s.handGrips?.rows.get(this.actor)?.[side];for(const f of h?.fingers??[])add(f.pad.getWorldPosition(V()),0xf08b43);}
 if(c.owner==='hand'&&s.handGrips?.rows.get(this.actor)?.L.blend>.995)for(const p of c.mug.userData.handGrip?.contacts??[])add(c.mug.localToWorld(new T.Vector3(...p)),0xf4d54b);
 this.geometry.setDrawRange(0,this.count);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;}
 diagnostics(){return{enabled:this.enabled,actor:this.actor,points:this.count,scope:'actual wrists/feet/finger pads; yellow points are actual held-handle surface targets, not full collision detection'};}
 dispose(){this.points.removeFromParent();this.geometry.dispose();this.material.dispose();this.count=0;}
}
