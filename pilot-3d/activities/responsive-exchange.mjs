import {dialogueCue} from '../personal-office/recipes.mjs';
import {SocialExchange} from './social-interactions.mjs';
import {ease} from '../sample/motion.mjs';
const PATTERNS=[['greet','respond','reflect','explain','reply','confirm','relax'],['greet','respond','explain','reflect','reply','confirm','relax'],['greet','respond','reply','reflect','explain','confirm','relax']];
const LENGTHS={greet:1.2,respond:1.2,reflect:.9,explain:2.5,reply:2.3,confirm:1.3,relax:1.8,note:1.8};
export class ResponsiveExchange extends SocialExchange{
 constructor(ids,cue,{sofa=false,variant=0,personal=null}={}){const order=[...PATTERNS[variant%3]];if(!sofa)order.splice(order.indexOf('explain'),0,'note');super(ids,cue,order.map(name=>[name,LENGTHS[name]]));this.personal=new Set(ids.filter(id=>personal?.has(id)));this.sofa=sofa;this.variant=variant%3;this.leader=ids[variant%2];this.speakers=new Set();}
 cueFor(id){const t=this.presented.get(id)??0,length=this.stages[this.index]?.[1]??1,phase=this.phase,leader=id===this.leader,speaking=(leader&&['greet','explain'].includes(phase))||(!leader&&['respond','reply'].includes(phase)),gesture=ease((t-.18)/.32)*(1-ease((t-length+.35)/.35));
  let action=this.sofa?(speaking?'sofa_talk':phase==='confirm'?'sofa_agree':phase==='relax'?'sofa_relax':'sofa_listen'):(speaking?'meeting_talk':phase==='confirm'?'meeting_ack':phase==='note'?'social_note':phase==='reflect'?'meeting_pause':'meeting_listen');
  const cue={action,socialPhase:phase,pairPhase:phase,speaking,speaker:speaking?id:null,gesture,note:phase==='note',lookAt:['reflect','relax','note'].includes(phase)?undefined:this.ids.find(other=>other!==id)};return this.personal?.has(id)?dialogueCue(id,t,length,cue):cue;
 }
 present(id,phase,dt){super.present(id,phase,dt);if(this.cueFor(id).speaking&&dt>0)this.speakers.add(id);}
 diagnostics(){return{...super.diagnostics(),variant:this.variant,leader:this.leader,speakers:[...this.speakers]};}
}
