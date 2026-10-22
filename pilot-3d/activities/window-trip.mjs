import {SofaScheduler} from './scheduler.mjs';
import {Route} from './routes.mjs';
import {ease} from '../sample/motion.mjs';
import {validateDestinationRoute} from './destinations.mjs';
import {pointClear} from './anchors.mjs';
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
export function prepareWindow(destinations,ids){if(destinations.windowAnchors)return destinations.windowAnchors();const anchors=new Map();for(const id of ids){const base=destinations.anchors(id,'sofa',0),o=base.stationOrigin,local=(x,z)=>[x-o[0],0,z-o[2]],point=local(.4,-3.1);const a={...base,route:[...base.route.slice(0,-1),local(.4,-2.30),point],stand:point,seated:point,kind:'window',seat:'window-0'};validateDestinationRoute(a);if(!pointClear([.4,0,-3.1],a.colliders,.34))throw Error('창가 정지/회전 여유 부족');anchors.set(id,a);}return anchors;}
// A standing visit shares the proven route/interrupt/desk-return stages, no seated cycle.
export class WindowTrip extends SofaScheduler{
 tick(raw){if(this.paused||this.disposed)return;const dt=Math.max(0,Math.min(.06,raw));if(this.stage==='align'){this.time+=dt;this.elapsed+=dt;if(this.elapsed>=.7){if(this.returning)this.beginHome(this.anchors.route.toReversed(),Math.PI);else this.enter('rest');}return;}if(this.stage==='rest'){this.time+=dt;this.elapsed+=dt;if((this.returning||this.elapsed>=14)&&this.book.request(this.owner,['walkway'],0))this.beginHome(this.anchors.route.toReversed(),Math.PI);return;}super.tick(dt);}
 rawPose(){if(!['align','rest'].includes(this.stage))return super.rawPose();const p=this.anchors.route.at(-1),u=this.stage==='align'?Math.min(1,this.elapsed/.7):1,yaw=angle(this.turnFrom,Math.PI,ease(u));return{x:p[0],z:p[2],yaw,hip:.84+Math.sin(this.time*1.1)*.002,stand:1,arms:0,chair:1,action:this.stage==='rest'?'window_rest':'turn',time:this.elapsed,feet:[-.1,.1].map((side,i)=>{const phase=this.stage==='align'?(i===0?Math.min(1,u*2):Math.max(0,u*2-1)):1,fyaw=angle(this.turnFrom,Math.PI,ease(phase));return{position:[p[0]+Math.cos(fyaw)*side,.085+Math.sin(Math.PI*phase)*.025,p[2]-Math.sin(fyaw)*side],planted:phase===0||phase===1};})};}
}
