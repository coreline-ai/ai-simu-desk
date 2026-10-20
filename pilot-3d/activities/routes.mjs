import {ease} from '../sample/motion.mjs';
const mix=(a,b,u)=>a+(b-a)*u;
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
export const SPEED=.45;
// Each corner settles before a foot-led turn. Position is station-local, metres.
export class Route {
  constructor(points, yaw=0, motion={}) {
    this.speed=motion.speed??SPEED;this.period=motion.period??1;this.natural=!!motion.natural;
    this.points=points.map(p=>[...p]);this.time=0;this.parts=[];let at=0,heading=yaw;
    for(let i=1;i<points.length;i++) {
      const from=points[i-1],to=points[i],length=Math.hypot(to[0]-from[0],to[2]-from[2]);if(length<1e-5)continue;
      const next=Math.atan2(to[0]-from[0],to[2]-from[2]);
      this.parts.push({kind:'turn',start:at,duration:.7,from,to:from,yaw:heading,endYaw:next,index:i-1});at+=.7;
      const ramp=this.natural?Math.min(.28,length/this.speed*.2):0,duration=length/this.speed+ramp;
      this.parts.push({kind:'walk',start:at,duration,length,ramp,from,to,yaw:next,endYaw:next,index:i-1});at+=duration;heading=next;
    }
    this.duration=at;this.endYaw=heading;
  }
  tick(dt) {this.time=Math.min(this.duration,this.time+Math.max(0,Math.min(.06,dt)));}
  get done(){return this.time>=this.duration;}
  state() {
    const part=this.parts.find(p=>this.time<p.start+p.duration)??this.parts.at(-1);
    if(!part)return {x:this.points[0][0],z:this.points[0][2],yaw:0,hip:.84,stand:1,arms:0,chair:1,action:'standing',time:0};
    const t=Math.min(part.duration,Math.max(0,this.time-part.start)),u=t/part.duration;
    const travelled=part.kind==='walk'?this.distanceAt(part,t)/part.length:u;
    const root={x:mix(part.from[0],part.to[0],travelled),z:mix(part.from[2],part.to[2],travelled),yaw:angle(part.yaw,part.endYaw,ease(u)),hip:.84,stand:1,arms:0,chair:1,action:part.kind,time:t};
    const side=(i,center)=>[center[0]+Math.cos(root.yaw)*(i===0?-.10:.10),.085,center[2]-Math.sin(root.yaw)*(i===0?-.10:.10)];
    if(part.kind==='turn') {
      // Alternate a small lift during rotation instead of rotating both planted soles.
      root.feet=[0,1].map(i=>{const phase=i===0?Math.min(1,u*2):Math.max(0,u*2-1),footYaw=angle(part.yaw,part.endYaw,ease(phase)),offset=i===0?-.10:.10,position=[root.x+Math.cos(footYaw)*offset,.085+.025*Math.sin(Math.PI*phase),root.z-Math.sin(footYaw)*offset];return {position,planted:phase===0||phase===1};});
    } else {
      root.hip=.80+.04*Math.max(1-ease(t/.25),ease((t-part.duration+.25)/.25));
      const dir=[Math.sin(root.yaw),0,Math.cos(root.yaw)],at=s=>{const d=this.distanceAt(part,s);return[part.from[0]+dir[0]*d,0,part.from[2]+dir[2]*d];};
      root.feet=[0,1].map(i=>{const phase=(t/this.period+i*.5)%1,strike=t-phase*this.period,a=side(i,at(strike)),b=side(i,at(strike+this.period));let position=a,planted=phase<.6;
        if(!planted){const v=(phase-.6)/.4;position=a.map((n,j)=>mix(n,b[j],ease(v)));position[1]+=.065*Math.sin(Math.PI*v);}
        if(t<.25){const v=ease(t/.25),initial=side(i,part.from);position=initial.map((n,j)=>mix(n,position[j],v));planted=false;}
        if(t>part.duration-.25){const v=ease((t-part.duration+.25)/.25),final=side(i,part.to);position=position.map((n,j)=>mix(n,final[j],v));planted=false;}
        return {position,planted};});root.gaitTime=t/this.period;root.gaitFade=ease(t/.25)*(1-ease((t-part.duration+.25)/.25));
    }
    root.contact=root.feet.map(f=>f.planted);return root;
  }
  distanceAt(part,seconds){const t=Math.max(0,Math.min(part.duration,seconds)),r=part.ramp;if(!r)return this.speed*t;const integral=u=>u*u*u-.5*u*u*u*u;if(t<r)return this.speed*r*integral(t/r);if(t>part.duration-r)return part.length-this.speed*r*integral((part.duration-t)/r);return this.speed*(t-r/2);}
  reversePoints() {
    const part=this.parts.find(p=>this.time<p.start+p.duration)??this.parts.at(-1),p=this.state();
    return [[p.x,0,p.z],...this.points.slice(0,(part?.index??0)+1).toReversed()];
  }
}
