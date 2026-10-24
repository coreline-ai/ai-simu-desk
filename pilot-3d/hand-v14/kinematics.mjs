import * as T from 'three';
const V=(...p)=>new T.Vector3(...p),X=V(1,0,0),Y=V(0,1,0),Z=V(0,0,1),D=V(0,-1,0),rad=n=>n*Math.PI/180;
export const FRAME=Object.freeze({palm:[0,0,-1],dorsal:[0,0,1],forward:[0,-1,0]});
export const POSES=['relaxed','keyboard-hover','key-press','tripod-write','mouse-rest','paper-pinch'];
const degrees={
 relaxed:[[26,25,14],[22,35,20],[25,39,24],[30,44,28],[34,48,30]],
 'keyboard-hover':[[22,22,12],[13,26,15],[14,28,17],[18,30,18],[23,34,22]],
 'key-press':[[22,22,12],[19,35,20],[14,28,17],[18,30,18],[23,34,22]],
 'tripod-write':[[32,32,18],[42,65,35],[46,70,38],[58,80,46],[64,82,48]],
 'mouse-rest':[[22,24,14],[18,34,20],[20,35,22],[29,47,30],[36,52,34]],
 'paper-pinch':[[26,30,16],[25,42,24],[32,48,30],[48,64,40],[53,67,42]],
};
export function definitions(side='R'){
 const s=side==='R'?-1:1;
 return [
  {name:'thumb',base:[s*.029,-.018,-.004],lengths:[.035,.025,.018],radius:.0085,spread:s*.70,opposition:s*.65},
  {name:'index',base:[s*.021,-.044,0],lengths:[.029,.019,.014],radius:.0075,spread:s*.035,opposition:0},
  {name:'middle',base:[s*.006,-.048,0],lengths:[.032,.021,.015],radius:.0079,spread:0,opposition:0},
  {name:'ring',base:[s*-.009,-.045,0],lengths:[.030,.020,.014],radius:.0072,spread:-s*.025,opposition:0},
  {name:'little',base:[s*-.023,-.037,0],lengths:[.023,.016,.012],radius:.0061,spread:-s*.10,opposition:0},
 ];
}
export function pose(name='relaxed'){return (degrees[name]??degrees.relaxed).map(a=>a.map(rad));}
export function fk(def,angles,spread=def.spread,opposition=def.opposition){
 const q0=new T.Quaternion().setFromAxisAngle(Z,spread).multiply(new T.Quaternion().setFromAxisAngle(Y,opposition)).multiply(new T.Quaternion().setFromAxisAngle(X,angles[0]));
 const quats=[q0],points=[V(...def.base)];
 for(let j=0;j<3;j++){if(j)quats.push(quats[j-1].clone().multiply(new T.Quaternion().setFromAxisAngle(X,angles[j])));points.push(points[j].clone().addScaledVector(D.clone().applyQuaternion(quats[j]),def.lengths[j]));}
 return {points,quats};
}
// Bounded angle optimization: no target relocation, phalanx scaling or backward
// finger bend. Limits are authored animation limits, not medical ROM claims.
export function fit(def,target,initial,{iterations=45,minMCP=.12,maxPIP=1.6,maxDIP=.90}={}){
 const v=[...initial,def.spread,def.opposition],lo=[minMCP,.03,.02,def.spread-.45,def.opposition-.6],hi=[1.40,maxPIP,maxDIP,def.spread+.45,def.opposition+.6];
 const cost=()=>fk(def,v,v[3],v[4]).points[3].distanceToSquared(target);
 let error=cost();
 for(let n=0;n<iterations;n++){
  const step=.22*Math.pow(.93,n)+.003;
  for(let k=0;k<(def.name==='thumb'?5:4);k++){const old=v[k];let best=old;for(const sign of [-1,1]){v[k]=T.MathUtils.clamp(old+step*sign,lo[k],hi[k]);const next=cost();if(next<error){error=next;best=v[k];}}v[k]=best;}
 }
 return {angles:v.slice(0,3),spread:v[3],opposition:v[4],error:Math.sqrt(error)};
}
export function samplePose(name,time=0){
 const a=pose(name);
 if(name==='key-press')for(let i=1;i<5;i++){const t=(time*.95+(i-1)*.27)%1,p=Math.sin(Math.PI*T.MathUtils.clamp(t/.24,0,1))**2; a[i]=pose('keyboard-hover')[i].map((v,j)=>v+p*[.13,.18,.10][j]);}
 return a;
}

// Preserve the five authored curls from each personality on the new joint
// chain. Calibrated tool/keyboard contacts take precedence over presentation.
export function presentationPose(curls=[]){
 return pose('relaxed').map((rest,i)=>{const c=T.MathUtils.clamp(curls[i]??.3,0,1);return (i===0?[[12,52],[12,65],[7,40]]:[[8,70],[15,90],[8,55]]).map(([a,b])=>rad(T.MathUtils.lerp(a,b,c)));});
}
