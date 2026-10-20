import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const geometries=new Map();
function cached(key,create){if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);}
export function group(parent,name,p=[0,0,0]){const g=new T.Group();g.name=name;g.position.fromArray(p);parent?.add(g);return g;}
export function material(name,color,roughness=.8,metalness=0){const m=new T.MeshStandardMaterial({color,roughness,metalness});m.name=name;return m;}
export function mesh(parent,name,geometry,mat,p=[0,0,0]){const o=new T.Mesh(geometry,mat);o.name=name;o.position.fromArray(p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(parent,name,size,p,mat,r=.025){return mesh(parent,name,cached('box'+size.join(',')+r,()=>new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(x=>x/3)))),mat,p);}
export function sphere(parent,name,size,p,mat){const o=mesh(parent,name,cached('sphere',()=>new T.SphereGeometry(1,24,16)),mat,p);o.scale.fromArray(size);return o;}
export function rod(parent,name,a,b,r,mat){const start=new T.Vector3(...a),end=new T.Vector3(...b),length=start.distanceTo(end);const o=mesh(parent,name,cached('rod'+r+length.toFixed(6),()=>new T.CapsuleGeometry(r,Math.max(.001,length-2*r),4,12)),mat);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;}
export function tube(parent,name,points,r,mat){return mesh(parent,name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,r,6,false),mat);}
