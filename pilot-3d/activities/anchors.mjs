import * as T from 'three';
export const CLEARANCE = .225;
export function sofaAnchors(model, metadata, seatBox) {
  model.updateMatrixWorld(true);
  const actor = model.getObjectByName(metadata.bindings.nara.actor);
  const sofa = model.getObjectByName('LinenSofa');
  if (!actor || !sofa) throw Error('소파 또는 나라 기준점 누락');
  const station = actor.parent;
  const sofaWorld = sofa.getWorldPosition(new T.Vector3());
  const world = (x, z) => station.worldToLocal(new T.Vector3(x, 0, z)).toArray();
  const seatX = seatBox ? (seatBox.min.x+seatBox.max.x)/2 : sofaWorld.x - .48;
  const start = world(-2.5, -.83);
  const route = [start, world(-3.55, -.83), world(-3.55, -2.18), world(seatX, -2.18)];
  const stand = world(seatX, -2.33), seated = world(seatX, -2.78);
  // Named anchors survive the export optimizer; no guessed mesh vertex binding.
  for (const [name, position] of Object.entries({SofaApproach:route.at(-1), SofaStand:stand, SofaSeat:seated})) {
    let node=station.getObjectByName(name);if(!node){node=new T.Object3D();node.name=name;station.add(node);}node.position.fromArray(position);
  }
  const rug=new T.Box3().setFromObject(model.getObjectByName('WovenRug'));
  return {rug:{x:(rug.min.x+rug.max.x)/2,z:(rug.min.z+rug.max.z)/2,rx:(rug.max.x-rug.min.x)/2,rz:(rug.max.z-rug.min.z)/2,top:rug.max.y},route, stand, seated, hip:(seatBox?.max.y??.48)+.105, feet:[[-.10,.085,0],[.10,.085,0]], seat:'sofa-left',
    colliders: metadata.colliders, stationOrigin:station.getWorldPosition(new T.Vector3()).toArray(), clearance:CLEARANCE};
}
export function pointClear(point, colliders, radius=CLEARANCE) {
  return !colliders.some(({min,max,center,radius:circle,radii}) => {
    if(center&&radii){const x=Math.abs(point[0]-center[0]),z=Math.abs(point[2]-center[1]),[a,b]=radii;if((x/a)**2+(z/b)**2<=1)return true;let lo=0,hi=Math.max(a*x,b*z,1);for(let n=0;n<40;n++){const t=(lo+hi)/2,v=(a*x/(t+a*a))**2+(b*z/(t+b*b))**2;if(v>1)lo=t;else hi=t;}const qx=a*a*x/(hi+a*a),qz=b*b*z/(hi+b*b);return Math.hypot(x-qx,z-qz)<radius-1e-6;}
    if(center)return Math.hypot(point[0]-center[0],point[2]-center[1])<circle+radius-1e-6;
    const x=Math.max(min[0],Math.min(max[0],point[0])), z=Math.max(min[1],Math.min(max[1],point[2]));
    return Math.hypot(point[0]-x,point[2]-z) < radius-1e-6;
  });
}
