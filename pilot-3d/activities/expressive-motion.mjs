import * as T from 'three';
import {part} from '../sample/character-rig.mjs';
import {solveArm} from './interactions.mjs';
export function expressiveMotion(scheduler,id,actor,state){if(!scheduler.expressiveActors.has(id))return;const rec=scheduler.records.get(id),torso=part(actor,'NaraTorso');
 if(state.action==='personal_rest'){const u=state.restEnvelope??0,style=rec.style,t=rec.elapsed,hip=part(actor,'NaraPelvis').position.y;actor.updateMatrixWorld(true);const q=actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));for(const side of ['L','R']){const hand=part(actor,'NaraHand'+side),from=hand.getWorldPosition(new T.Vector3()),point=actor.localToWorld(new T.Vector3(side==='L'?-.20:.20,hip+(style==='wrist_release'?.36:.29),.15));solveArm(actor,from.lerp(point,u),q,side);hand.rotation.z+=(side==='L'?1:-1)*Math.sin(t*2.4)*.22*u;}torso.rotation.x+=Math.sin(t*1.2)*.012*u;}
 if(state.activity==='window'&&rec?.trip?.stage==='rest'){const t=rec.trip.elapsed;torso.rotation.z=Math.sin(t*.55+Math.max(0,scheduler.ids.indexOf(id)))*.012;torso.rotation.x+=Math.sin(t*1.1)*.009;}
}
