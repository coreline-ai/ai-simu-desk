import {SofaScheduler} from './scheduler.mjs';
import {ExpressiveRoute} from './expressive-route.mjs';
import {ease} from '../sample/motion.mjs';
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
export class DeskVisitTrip extends SofaScheduler{
  constructor(id,anchors,book){super([id],anchors,{actorId:id,owner:id+'-visit',book,sharedTransit:true,routeFactory:ExpressiveRoute,routeMotion:{speed:.56,period:.8,natural:true,colliders:anchors.colliders,origin:anchors.stationOrigin},waitLimit:150,restDuration:Infinity});book.register(this.owner,anchors);}
  enter(stage){if(stage==='rest'){const a=this.anchors;this.book.holdSpot(this.owner,[a.stand[0]+a.stationOrigin[0],0,a.stand[2]+a.stationOrigin[2]]);}super.enter(stage);}
  tick(raw){if(this.disposed||this.paused)return;const dt=Math.max(0,Math.min(.06,raw));
    if(this.stage==='queued'&&this.returning){this.finish(false);return;}
    if(this.stage==='align'){this.time+=dt;this.elapsed+=dt;if(this.elapsed>=.7)this.enter('rest');return;}
    if(this.stage==='rest'){this.time+=dt;this.elapsed+=dt;if(this.returning&&(!this.canReturn||this.canReturn())&&this.book.request(this.owner,['walkway'],0)){this.book.spots.delete(this.owner);this.beginHome(this.anchors.route.toReversed(),this.anchors.facing);}return;}
    super.tick(dt);
  }
  rawPose(){if(!['align','rest'].includes(this.stage))return super.rawPose();const a=this.anchors,t=this.elapsed,u=this.stage==='rest'?1:ease(t/.7),yaw=angle(this.turnFrom,a.facing,u),p=a.stand;
    return{x:p[0],z:p[2],yaw,hip:.84,stand:1,arms:0,chair:1,action:'standing',time:t,feet:[-.1,.1].map((x,i)=>{const phase=this.stage==='rest'?1:i===0?Math.min(1,t/.35):Math.max(0,Math.min(1,(t-.35)/.35)),fyaw=angle(this.turnFrom,a.facing,ease(phase));return{position:[p[0]+Math.cos(fyaw)*x,.085+Math.sin(Math.PI*phase)*.025,p[2]-Math.sin(fyaw)*x],planted:phase===0||phase===1};})};
  }
}
