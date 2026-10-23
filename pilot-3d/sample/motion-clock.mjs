export const MOTION_SPEEDS=Object.freeze([1,1.5,2,3]);
export const INSPECTION_SPEEDS=Object.freeze([.25,.5,...MOTION_SPEEDS]);
export function motionSpeed(value,{inspection=false}={}){const n=Number(value);return (inspection?INSPECTION_SPEEDS:MOTION_SPEEDS).includes(n)?n:1;}
// Presentation only. Never use this clock for network, auth, task or DB time.
export class MotionClock{
 constructor({inspection=false}={}){this.inspection=inspection;this.speed=1;this.time=0;this.remainder=0;this.steps=0;this.droppedWallSeconds=0;}
 setSpeed(value){this.speed=motionSpeed(value,{inspection:this.inspection});return this.speed;}
 advance(raw,enabled,update){if(!enabled){this.remainder=0;return 0;}if(!Number.isFinite(raw)||raw<=0)return 0;const wall=Math.min(.06,raw);this.droppedWallSeconds+=raw-wall;this.remainder+=wall*this.speed;let count=0;const step=1/60;while(this.remainder+1e-10>=step&&count<12){update(step);this.time+=step;this.remainder=Math.max(0,this.remainder-step);this.steps++;count++;}return count;}
 diagnostics(){return{motionSpeed:this.speed,simulationSeconds:this.time,substeps:this.steps,droppedWallSeconds:this.droppedWallSeconds};}
}
export function readMotionSpeed(storage){try{storage??=globalThis.localStorage;return motionSpeed(storage?.getItem('simu-desk-motion-speed'));}catch{return 1;}}
export function saveMotionSpeed(storage,value){const rate=motionSpeed(value);try{storage??=globalThis.localStorage;storage?.setItem('simu-desk-motion-speed',String(rate));}catch{}return rate;}
