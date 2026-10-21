import{ExpressiveRoute}from'./expressive-route.mjs';import{ease}from'../sample/motion.mjs';
const Y=-.084,HEEL=-.0735,TOE=.1635;
// A planted heel/toe is fixed; the ankle rolls around that support rather than
// sliding it. These dimensions match the authored sole, not a moved floor target.
export class GroundedRoute extends ExpressiveRoute{
 state(){const p=super.state(),block=this.parts.find(b=>this.time<b.start+b.duration)??this.parts.at(-1);p.pelvisX=0;p.pelvisZ=0;
  if(!block||block.kind!=='walk'){if(block){const u=Math.max(0,Math.min(1,(this.time-block.start)/block.duration));p.turnLead=Math.sin(Math.PI*u)*Math.sign(Math.atan2(Math.sin(block.endYaw-block.yaw),Math.cos(block.endYaw-block.yaw)))*.045;}return p;}
  const t=Math.min(block.duration,Math.max(0,this.time-block.start)),fade=p.gaitFade??0;
  p.pelvisX=.008*Math.sin(t/this.period*Math.PI*2)*fade;p.pelvisZ=.005*Math.sin(Math.PI*Math.min(1,t/.4))*(1-ease((t-block.duration+.4)/.4));p.weightShift=p.pelvisX;
  p.feet=p.feet.map((foot,i)=>{const phase=(t/this.period+i*.5)%1,stance=phase<.6;
   let pitch=phase<.18?-.15*(1-ease(phase/.18)):phase<.4?0:phase<.6?.20*ease((phase-.4)/.2):.20+(-.15-.20)*ease((phase-.6)/.4);pitch*=fade;
   const pivot=pitch<0?HEEL:TOE,rotY=Y*Math.cos(pitch)-pivot*Math.sin(pitch),rotZ=Y*Math.sin(pitch)+pivot*Math.cos(pitch),offset=pivot-rotZ,yaw=p.yaw+(foot.yaw??0),position=[foot.position[0]+Math.sin(yaw)*offset,foot.position[1]+Y-rotY,foot.position[2]+Math.cos(yaw)*offset],support=phase<.18?'heel':phase<.4?'flat':phase<.6?'toe':'swing';
   return{...foot,position,pitch,support,planted:stance&&foot.planted,supportPoint:[foot.position[0]+Math.sin(yaw)*(support==='heel'?HEEL:support==='toe'?TOE:0),foot.position[1]+Y,foot.position[2]+Math.cos(yaw)*(support==='heel'?HEEL:support==='toe'?TOE:0)]};
  });
  p.hip=Math.min(p.hip,...p.feet.map((foot,i)=>{const dx=foot.position[0]-p.x,dz=foot.position[2]-p.z,x=Math.cos(p.yaw)*dx-Math.sin(p.yaw)*dz-(i===0?-.1:.1)-p.pelvisX,z=Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dz-p.pelvisZ;return foot.position[1]+Math.sqrt(Math.max(0,.773**2-x*x-z*z));}));return p;
 }
}
