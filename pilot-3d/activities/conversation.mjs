import {ease} from '../sample/motion.mjs';
// Deliberate pauses separate short turns. No audio or invented meeting transcript.
const TURNS=[{end:1,kind:'pause'},{end:4.3,kind:'talk',speaker:0},{end:5,kind:'ack',speaker:1},{end:8,kind:'talk',speaker:1},{end:9.4,kind:'note'},{end:12.5,kind:'talk',speaker:0},{end:14.4,kind:'ack',speaker:1},{end:18,kind:'talk',speaker:1}];
export function conversationCue(time,ids,id){let start=0;for(const turn of TURNS){if(time<turn.end){const local=time-start,length=turn.end-start,envelope=ease(local/.35)*(1-ease((local-length+.35)/.35));return{action:turn.kind==='talk'?(ids[turn.speaker]===id?'meeting_talk':'meeting_listen'):turn.kind==='ack'?(ids[turn.speaker]===id?'meeting_ack':'meeting_pause'):'meeting_'+turn.kind,gesture:envelope,lookAt:turn.kind==='note'?undefined:ids.find(other=>other!==id),note:turn.kind==='note'};}start=turn.end;}return{action:'meeting_pause',gesture:0};}
export function updateMeetingCups(session,cups,drops){
 const [a,b]=session.ids,t=session.talk;session.cupCues??=new Set();
 const once=(key,ready,fn)=>{if(!session.cupCues.has(key)&&ready()&&fn()!==false)session.cupCues.add(key);};
 if(t>=1.6)once('sip-1',()=>cups[b].state==='carry',()=>cups[b].sipHeld());
 if(t>=8.5)once('place-1',()=>cups[b].state==='carry',()=>cups[b].setDownAt(drops[1]));
 if(t>=10)once('retrieve-0',()=>cups[a].state==='tableRest',()=>cups[a].returnToHand());
 if(t>=13.6)once('sip-0',()=>cups[a].state==='carry',()=>cups[a].sipHeld());
}
