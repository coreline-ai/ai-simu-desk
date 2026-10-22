import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from '../activities/interactions.mjs';
import {ease} from '../sample/motion.mjs';
const V=(...p)=>new T.Vector3(...p),world=n=>({p:n.getWorldPosition(V()),q:n.getWorldQuaternion(new T.Quaternion())});
// The left hand remains the single owner. The free right palm supports the
// underside only while the mug is raised above the desk.
export class CupSupport{
 constructor(s){this.s=s;this.rows=new Map();this.counts=Object.fromEntries(s.ids.map(id=>[id,0]));}
 apply(id,actor,dt){const c=this.s.cups[id],eligible=this.s.records.get(id)?.kind==='cup'&&c.state==='sip'&&c.time>.6&&c.time<2.4&&!this.s.desks[id].busy&&!this.s.transfer.controls(id);let row=this.rows.get(id);const hand=part(actor,'NaraHandR'),base=world(hand);
  if(!eligible&&!row)return;
  if(eligible&&!row){row={start:base,exit:null,seen:false,error:0,blend:0};this.rows.set(id,row);}
  let p,q;
  if(eligible&&row.exit===null){const u=ease((c.time-.6)/.35)*ease((2.4-c.time)/.4),grip=c.mug.userData.supportGrip,target=c.mug.localToWorld(V(...grip.offset)),normal=c.mug.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));p=row.start.p.clone().lerp(target,u);q=row.start.q.clone().slerp(normal,u);row.blend=u;if(u>.995&&!row.seen){row.seen=true;this.counts[id]++;}}
  else{if(row.exit===null){row.exit=0;row.start=row.last??base;}row.exit+=dt;const u=ease(row.exit/.6);p=row.start.p.clone().lerp(base.p,u);q=row.start.q.clone().slerp(base.q,u);row.blend=1-u;}
  row.error=Math.max(row.error,solveArm(actor,p,q,'R'));row.last=world(hand);if(row.exit!==null&&row.exit>=.6)this.rows.delete(id);
 }
 controls(id){return this.rows.has(id);}
 override(id){const r=this.rows.get(id);return r?{R:{blend:r.blend,prop:this.s.cups[id].mug,kind:'cup-support'}}:null;}
 diagnostics(){return{counts:{...this.counts},active:[...this.rows].map(([id,r])=>({id,blend:r.blend,phase:r.exit===null?'support':'release',error:r.error}))};}
 dispose(){this.rows.clear();}
}
