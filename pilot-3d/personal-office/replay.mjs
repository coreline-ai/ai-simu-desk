const copy=selection=>Object.freeze({...selection,...(selection.ids?{ids:Object.freeze([...selection.ids])}:{}),...(selection.variants?{variants:Object.freeze({...selection.variants})}:{})});
const roleOptions=(selection,id)=>{const variant=selection.variants?.[id]??selection.variant;return variant===undefined?{}:{variant};};

// A rehearsal repeats the last successful command, including its participants
// and resolved role variants. Live DOM values never change a saved rehearsal.
export class ActivityReplay {
 constructor(selection){this.selection=copy(selection);}
 start(s,selection=this.selection){
  if(!s||!selection)return false;
  const {kind,actor,ids,peer,scenario}=selection;let ok=false;
  if(kind==='glasses')ok=s.personalMotion?.glasses.start()??false;
  else if(kind==='roles')ok=ids.map(id=>s.startRole(id,roleOptions(selection,id))).every(Boolean);
  else if(kind==='role')ok=s.startRole(actor,roleOptions(selection,actor));
  else if(kind==='daily')ok=s.startDemo();
  else if(kind==='scenario')ok=s.startScenario(scenario);
  else if(kind==='cup')ok=s.startCup(actor);
  else if(kind==='coffee')ok=s.startCoffee(actor);
  else if(kind==='visit')ok=s.startVisit(actor,peer,{transfer:true});
  else if(kind==='team'||kind==='meeting')ok=s.startMeeting([...ids]);
  else if(kind==='solo')ok=s.startSofa(actor);
  else if(kind==='pair')ok=s.startSofaPair([...ids]);
  else if(kind==='window'){const previous=s.variants.get(actor);s.variants.set(actor,2);ok=s.startWindow(actor);if(!ok)s.variants.set(actor,previous);}
  else if(kind==='review')ok=s.startReview([...ids]);
  if(ok){
   const roles=kind==='roles'?ids:kind==='role'?[actor]:[],variants={...selection.variants};
   for(const id of roles)if(Number.isInteger(s.desks?.[id]?.variant))variants[id]=s.desks[id].variant;
   this.selection=copy({...selection,...(roles.length?{variants}:{})});
  }
  return !!ok;
 }
}
