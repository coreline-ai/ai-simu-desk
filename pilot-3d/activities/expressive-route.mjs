import {Route} from './routes.mjs';
import {ease} from '../sample/motion.mjs';
import {pointClear} from './anchors.mjs';
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[2]-a[2]);
const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const heading=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
export function simplifyPath(points){const out=[];for(const p of points){if(out.length&&distance(out.at(-1),p)<1e-5)continue;while(out.length>1&&Math.abs(delta(heading(out.at(-2),out.at(-1)),heading(out.at(-1),p)))<.015)out.pop();out.push([...p]);}return out;}

// Curves are admitted only inside the measured clearance. Narrow corners keep
// the existing alternating-foot turn. No change to the v4 Route implementation.
export class ExpressiveRoute extends Route{
 constructor(points,yaw=0,motion={}){
  const sampled=!!points.sampled,simple=simplifyPath(points);super(simple,yaw,{...motion,natural:true});this.parts=[];this.points=simple;this.curves=0;this.motion=motion;let run=[simple[0]],at=0,current=yaw;
  const finish=()=>{if(run.length<2)return;const initial=heading(run[0],run[1]),turn=Math.abs(delta(current,initial));if(turn>.015){this.parts.push({kind:'turn',start:at,duration:.7,from:run[0],to:run[0],yaw:current,endYaw:initial});at+=.7;}
   const lengths=[0];for(let i=1;i<run.length;i++)lengths.push(lengths.at(-1)+distance(run[i-1],run[i]));const length=lengths.at(-1),ramp=Math.min(.28,length/this.speed*.2),duration=length/this.speed+ramp;
   this.parts.push({kind:'walk',start:at,duration,length,ramp,path:run,lengths});at+=duration;current=heading(run.at(-2),run.at(-1));};
  for(let i=1;i<simple.length-1;i++){const a=simple[i-1],b=simple[i],c=simple[i+1],r=Math.min(.24,distance(a,b)*.28,distance(b,c)*.28),turn=Math.abs(delta(heading(a,b),heading(b,c)));
   if(sampled&&turn<.16){run.push(b);continue;}
   const entry=mix(b,a,r/distance(a,b)),exit=mix(b,c,r/distance(b,c)),curve=[];for(let j=0;j<=32;j++){const u=j/32;curve.push(mix(mix(entry,b,u),mix(b,exit,u),u));}
   const clear=turn<2.2&&r>=.10&&curve.every(p=>pointClear([p[0]+(motion.origin?.[0]??0),0,p[2]+(motion.origin?.[2]??0)],motion.colliders??[],.34));
   if(clear){run.push(...curve);this.curves++;}else{run.push(b);finish();run=[b];}
  }
  if(simple.length>1)run.push(simple.at(-1));finish();this.duration=at;this.endYaw=current;
 }
 at(part,t){const d=this.distanceAt(part,t),j=part.lengths.findIndex(n=>n>=d),i=j<0?part.path.length-1:Math.max(1,j),a=part.path[i-1],b=part.path[i],u=(d-part.lengths[i-1])/(part.lengths[i]-part.lengths[i-1]||1);return{p:mix(a,b,u),yaw:heading(a,b)};}
 state(){const part=this.parts.find(p=>this.time<p.start+p.duration)??this.parts.at(-1);if(!part||part.kind==='turn'){const p=super.state();if(part){const u=Math.min(1,Math.max(0,(this.time-part.start)/part.duration));p.feet.forEach((f,i)=>{const phase=i===0?Math.min(1,u*2):Math.max(0,u*2-1);f.yaw=delta(p.yaw,part.yaw+delta(part.yaw,part.endYaw)*ease(phase));f.pitch=0;});}return p;}const t=Math.min(part.duration,Math.max(0,this.time-part.start)),center=this.at(part,t),fade=ease(t/.25)*(1-ease((t-part.duration+.25)/.25));
  const foot=(i,time)=>{const c=this.at(part,time),s=i===0?-.10:.10;return{position:[c.p[0]+Math.cos(c.yaw)*s,.085,c.p[2]-Math.sin(c.yaw)*s],yaw:c.yaw};};
  const feet=[0,1].map(i=>{const phase=(t/this.period+i*.5)%1,strike=t-phase*this.period,a=foot(i,strike),b=foot(i,strike+this.period);let p=a.position,yaw=a.yaw,pitch=0,planted=phase<.6;
   if(!planted){const u=(phase-.6)/.4;p=mix(a.position,b.position,ease(u));p[1]+=.065*Math.sin(Math.PI*u);yaw+=delta(yaw,b.yaw)*ease(u);pitch=.14*Math.sin(2*Math.PI*u);}
   if(t<.25){p=mix(foot(i,0).position,p,ease(t/.25));planted=false;}if(t>part.duration-.25){const u=ease((t-part.duration+.25)/.25);p=mix(p,foot(i,part.duration).position,u);yaw+=delta(yaw,this.at(part,part.duration).yaw)*u;pitch*=1-u;planted=false;}
   return{position:p,planted,yaw:delta(center.yaw,yaw),pitch};});
  const hip=Math.min(.80+.04*(1-fade),...feet.map((f,i)=>{const dx=f.position[0]-center.p[0],dz=f.position[2]-center.p[2],x=Math.cos(center.yaw)*dx-Math.sin(center.yaw)*dz-(i===0?-.1:.1),z=Math.sin(center.yaw)*dx+Math.cos(center.yaw)*dz;return f.position[1]+Math.sqrt(Math.max(0,.773**2-x*x-z*z));}));
  return{x:center.p[0],z:center.p[2],yaw:center.yaw,hip,stand:1,arms:0,chair:1,action:'walk',time:t,gaitTime:t/this.period,gaitFade:fade,feet,contact:feet.map(f=>f.planted)};
 }
 reversePoints(){const part=this.parts.find(p=>this.time<p.start+p.duration)??this.parts.at(-1),p=this.state(),prefix=[];for(const block of this.parts){if(block===part){if(block.path){const t=this.time-block.start,d=this.distanceAt(block,t);prefix.push(...block.path.filter((_,i)=>block.lengths[i]<d));}break;}if(block.path)prefix.push(...block.path);}const points=simplifyPath([[p.x,0,p.z],...prefix.toReversed()]);points.sampled=true;return points;}
}
