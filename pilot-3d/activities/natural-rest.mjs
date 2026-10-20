import {cyclePose,ease} from '../sample/motion.mjs';
export const REST_PROFILES={
 nara:['one_arm','back_open'],sora:['back_open','side_stretch'],jun:['one_arm','shoulder_release'],min:['side_stretch','back_open'],leo:['shoulder_release','one_arm'],
};
export function restPose(record){
 const t=record.elapsed,exit=record.exitAt??8,sitAt=exit+.7;
 if(t<2)return {...cyclePose(1+t),action:'natural_rise'};
 if(t>=sitAt)return {...cyclePose(19+Math.min(2,t-sitAt)),action:'natural_sit'};
 const p=cyclePose(3);return {...p,yaw:0,action:'natural_rest',feet:[-.1,.1].map(x=>({position:[x,.085,-.48],planted:true})),restEnvelope:ease((t-2)/.9)*(1-ease((t-exit)/.7)),restStyle:record.style};
}
