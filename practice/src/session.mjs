import {createFakeAnswer} from '../../server/domain/fake-answer.ts';
import {TEAM} from '../../server/domain/team.ts';
export {TEAM};
export const MAX_PROMPT=1200;
export function validateRequest(prompt,agentId){
 if(typeof prompt!=='string'||prompt.trim().length<2||prompt.trim().length>MAX_PROMPT)throw Error('요청을 2~1,200자로 입력해 주세요.');
 if(!TEAM.some(p=>p.id===agentId))throw Error('동료를 선택해 주세요.');
 return {prompt:prompt.trim(),agentId};
}
// One generation token owns all callbacks. Reset/cancel invalidate even a timer
// already queued on the browser event loop; no persistence or network is used.
export function createSession(onChange,{schedule=setTimeout,unschedule=clearTimeout}={}){
 let revision=0,timer,state={phase:'idle',result:'',agentId:null};
 const emit=next=>{state=Object.freeze(next);onChange(state);};
 function stop(){revision++;unschedule(timer);timer=undefined;}
 return {
  get state(){return state;},
  start(prompt,agentId){
   if(['analyze','compose','review'].includes(state.phase))throw Error('진행 중인 실습을 마치거나 초기화해 주세요.');
   const input=validateRequest(prompt,agentId),answer=createFakeAnswer({...input,runId:'browser-practice',scenario:'normal'}),token=++revision;
   const advance=(phase,delay,next)=>{emit({phase,result:'',...input});timer=schedule(()=>{if(token===revision)next();},delay);};
   advance('analyze',900,()=>advance('compose',1500,()=>advance('review',900,()=>emit({phase:'done',result:answer.text,...input}))));
  },
  cancel(){stop();emit({phase:'cancelled',result:'',agentId:null});},
  reset(){stop();emit({phase:'idle',result:'',agentId:null});},
  dispose(){stop();}
 };
}
