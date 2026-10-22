import {part} from '../sample/character-rig.mjs';
import {ease} from '../sample/motion.mjs';

export const LIVING_PROFILES={nara:{lean:.025,side:.018,phase:.2},sora:{lean:.04,side:-.025,phase:1.3},jun:{lean:.03,side:.015,phase:2.1},min:{lean:.02,side:-.018,phase:3.4},leo:{lean:.035,side:.022,phase:4.5}};
export class LivingDetails{
  constructor(s){this.s=s;for(const id of s.ids){const actor=s.models.getObjectByName(s.meta.bindings[id].actor),prefix=actor.userData.prefix,mouths=s.models.getObjectByName(prefix+'ExpressionMouths');for(const n of mouths.children)n.visible=n.name.endsWith('_relaxed');part(actor,'Smile').visible=false;}this.seen=Object.fromEntries(s.ids.map(id=>[id,new Set()]));}
  pose(id,actor,state){
    const r=this.s.getRecord(id),p=LIVING_PROFILES[id];if(!r||state.returning)return;
    const t=r.trip?.elapsed??r.elapsed??0,v=r.livingVariant??this.s.variants.get(id)??0,torso=part(actor,'NaraTorso'),head=part(actor,'NaraHead');
    if(state.action==='sofa_rest'&&!this.s.sofaPair){
      const remaining=r.trip.options.restDuration-t,u=ease(t/.9)*ease(remaining/1.2);this.seen[id].add(v);
      // Pelvis and feet remain fixed. Existing lap/armrest solvers run afterward.
      torso.rotation.x-=p.lean*u*(v===0?1:.4);
      torso.rotation.z+=p.side*u*(v===1?Math.sin(t*.38+p.phase):.3);
      head.rotation.x+=.025*u*Math.sin(t*.5+p.phase);
      if(v===2)head.rotation.y+=.09*u*Math.sin(t*.3+p.phase);
    }
    if(state.action==='window_rest'){
      const u=ease(t/.9)*ease((14-t)/1.1);this.seen[id].add(v);torso.rotation.z+=p.side*.6*u*Math.sin(t*.4+p.phase);
      // Hands stay free; no prop owner or support is displaced.
      if(v===2)for(const side of['L','R']){part(actor,'NaraShoulder'+side).rotation.z+=(side==='L'?1:-1)*.10*u;part(actor,'NaraElbow'+side).rotation.x-=.08*u;}
    }
    if(state.activity==='micro'){this.seen[id].add(v);torso.rotation.y+=.025*Math.sin(t*.55+p.phase)*(state.pose?.restEnvelope??state.restEnvelope??0);}
  }
  diagnostics(){return Object.fromEntries(this.s.ids.map(id=>[id,{variant:this.s.variants.get(id)??0,seen:[...this.seen[id]]}]));}
  dispose(){for(const s of Object.values(this.seen))s.clear();}
}
