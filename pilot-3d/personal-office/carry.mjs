// Authored carrying styles. Positions are in metres in the actor frame. The
// shared handle/pad contract and upright mug orientation remain authoritative.
export const CARRY_PROFILES=Object.freeze({
 nara:Object.freeze({x:-.22,height:.29,z:.40,settle:.012,turn:.008}),
 sora:Object.freeze({x:-.24,height:.30,z:.42,settle:.016,turn:.012}),
 jun:Object.freeze({x:-.215,height:.28,z:.38,settle:.009,turn:.006}),
 min:Object.freeze({x:-.225,height:.31,z:.39,settle:.010,turn:.007}),
 leo:Object.freeze({x:-.235,height:.295,z:.415,settle:.014,turn:.010})
});
export function carryRecipe(id,state={}){const p=CARRY_PROFILES[id]??CARRY_PROFILES.nara,fade=Math.max(0,Math.min(1,state.pose?.gaitFade??0)),turn=Math.max(-1,Math.min(1,state.pose?.turnLead??0));return{x:p.x-turn*p.turn,height:p.height,z:p.z-p.settle*(1-fade),phase:state.action==='walk'?'walking':state.action==='turn'?'turning':'settled',stability:1-fade};}
