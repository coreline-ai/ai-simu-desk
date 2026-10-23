import {ease} from '../sample/motion.mjs';
import {HUMAN_PROFILES} from '../living-office/human-motion.mjs';

const clamp=u=>Math.max(0,Math.min(1,u));
export const pulse=u=>Math.sin(Math.PI*clamp(u))**2;
// Each cycle deliberately stops its trajectory. All variants keep the existing
// pen tip / tablet / mouse targets; no second clock changes ownership events.
export function workRecipe(id,variant,time){
 const p=HUMAN_PROFILES[id].work,period=p.period+variant*.19,t=Math.max(0,time),cycle=Math.floor(t/period),u=t%period;
 const start=p.observe+variant*.06,end=start+p.act,finish=end+p.pause;
 const phase=u<start?'observe':u<end?'act':u<finish?'pause':'check';
 const progress=ease((u-start)/p.act),sample=cycle*1.15+progress*1.15;
 return{phase,sample,reading:phase!=='act',progress,period,variant};
}

export const CUP_LENGTHS=Object.freeze({tablePlace:1.1,tableReach:1.2,tableGrasp:.25,reach:1.35,grasp:.25,lift:.9,sip:3,lower:.85,place:1.2,release:.35,retract:.45});
export function cupDuration(id,state,personal=false){return personal?(HUMAN_PROFILES[id].cup[state]??CUP_LENGTHS[state]):CUP_LENGTHS[state];}
export function drinkRecipe(id,progress){
 const p=HUMAN_PROFILES[id].cup,u=clamp(progress),raise=ease((u-.06)/(p.up-.06)),lower=1-ease((u-p.down)/(.98-p.down));
 const amount=raise*lower,support=ease((u-.10)/.20)*(1-ease((u-(p.down-.06))/(1-p.down)));
 return{progress:u,amount,support,phase:u<.06?'prepare':u<p.up?'raise':u<p.down?'sip':u<.98?'lower':'settle'};
}

export function dialogueCue(id,time,length,cue){
 const p=HUMAN_PROFILES[id].dialogue,t=Math.max(0,time),u=ease((t-p.prepare)/.28)*(1-ease((t-length+p.release)/p.release));
 return{...cue,gesture:Math.pow(u,p.power),speaking:!!cue.speaking&&u>.025,responsePhase:t<p.prepare?'prepare':t>length-p.release?'settle':cue.speaking?'speak':'attend'};
}

export function boardRecipe(id,time){
 const p=HUMAN_PROFILES[id].task,cycle=time/p.boardBeat,u=cycle%1,move=ease(u/.5),side=Math.floor(cycle)%2?-1:1;
 return{x:p.boardX+side*p.boardSpan*(2*move-1),y:p.boardY,z:.625,phase:u<.5?'point':'hold'};
}
export function readRecipe(id,time){
 const p=HUMAN_PROFILES[id].task,u=pulse((time-p.read)/1.1);
 return{height:.008*u,turn:(id==='sora'?-.018:id==='jun'?.006:.012)*u,pitch:HUMAN_PROFILES[id].posture.nod*u};
}
