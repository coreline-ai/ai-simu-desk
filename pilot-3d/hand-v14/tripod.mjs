import * as T from 'three';
import {segmentDistance} from '../activities/body-contact.mjs';
import {definitions,pose,fit,fk} from './kinematics.mjs';
const V=(...v)=>new T.Vector3(...v),Y=V(0,1,0),cache=new Map();
export const PEN_AXIS=V(.35,.93,-.10).normalize();
const penQ=new T.Quaternion().setFromUnitVectors(Y,PEN_AXIS);
export function tripod(radius=.003){
 const key=radius.toFixed(5);if(cache.has(key))return cache.get(key);
 const defs=definitions('R'),angles=pose('tripod-write'),grip=PEN_AXIS.clone().multiplyScalar(.030);
 const normals=[V(-.866,0,.5).normalize(),V(0,0,-1),V(.866,0,.5).normalize()].map(n=>n.applyQuaternion(penQ));
 const targets=normals.map((n,i)=>grip.clone().addScaledVector(PEN_AXIS,i===2?-.016:0).addScaledVector(n,radius+.004));
 let best;
 for(const roll of [-.3,0,.3])for(const x of [.005,.015,.025,.035])for(const y of [.018,.028,.038])for(const z of [-.060,-.075,-.090,-.105]){
  const q=new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2).multiply(new T.Quaternion().setFromAxisAngle(Y,roll)),p=grip.clone().add(V(x,y,z)),inv=q.clone().invert();
  const solved=targets.map((t,i)=>[angles[i],[.15,1.4,1.0],[.4,.6,.4]].map(seed=>fit(defs[i],t.clone().sub(p).applyQuaternion(inv),seed,{iterations:95,minMCP:i===0?.12:.28,maxPIP:i===0?1.6:1.25,maxDIP:.8})).sort((a,b)=>a.error-b.error)[0]);
  const error=Math.max(...solved.map(s=>s.error)),paths=defs.map((d,i)=>fk(d,i<3?solved[i].angles:angles[i],i<3?solved[i].spread:d.spread,i<3?solved[i].opposition:d.opposition).points);let overlap=0;for(let i=0;i<5;i++)for(let k=i+1;k<5;k++)for(let j=1;j<3;j++)for(let l=1;l<3;l++){const r=defs[i].radius*(.85-j*.1)+defs[k].radius*(.85-l*.1);overlap=Math.max(overlap,r-segmentDistance(paths[i][j],paths[i][j+1],paths[k][l],paths[k][l+1]));}const score=error+Math.max(0,overlap-.002)*10;if(!best||score<best.score)best={p,q,solved,error,targets,normals,radius,overlap,score};
 }
 if(best.error>.003||best.overlap>.0025)throw Error('삼점 그립 캘리브레이션 실패: contact='+best.error+', overlap='+best.overlap);
 cache.set(key,best);return best;
}
export function penHandTarget(actor,tip,radius=.003){const t=tripod(radius);return{p:actor.localToWorld(tip.clone().add(t.p)),q:actor.getWorldQuaternion(new T.Quaternion()).multiply(t.q)};}

export function penFrameTarget(center,q,half,radius=.003){const t=tripod(radius),delta=q.clone().multiply(penQ.clone().invert());return{p:t.p.clone().addScaledVector(PEN_AXIS,-half).applyQuaternion(delta).add(center),q:delta.multiply(t.q)};}
