// Explicit targets keep historical evidence and requested runtime versions separate.
const versions={expressive:5,interaction:6,refined:7,grounded:8};
export function qaProfile(env=process.env){
 const mode=env.STUDIO_QA_ACTIVITY??'interaction',baseline=env.STUDIO_QA_BASELINE??(mode==='grounded'?'refined':'expressive');
 if(!Object.hasOwn(versions,mode)||!Object.hasOwn(versions,baseline)||mode===baseline)throw Error('Invalid QA activity/baseline');
 return{mode,version:versions[mode],baseline,baselineVersion:versions[baseline],route:'/demos/activities/'+mode+'/',out:mode==='interaction'?'product/evidence/stabilization-implementation':'product/evidence/'+mode+'-activities'};
}
