/** A small QA reference strip on the left, not a second checklist or notebook. */
export function createProps({actor,model,THREE:T,deskY=.74}){
 void actor;void model;
 const surface=Number.isFinite(deskY)?deskY:.74;
 const root=new T.Group();root.name='Personality_min_ReferenceStrip';
 const geometries=new Set(),materials=new Set();
 const geometry=(w,h,d)=>{const g=new T.BoxGeometry(w,h,d);geometries.add(g);return g;};
 const material=color=>{const m=new T.MeshStandardMaterial({color,roughness:.88});materials.add(m);return m;};
 const add=(name,g,m,x,y,z)=>{
  const mesh=new T.Mesh(g,m);mesh.name=`Personality_min_${name}`;mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
 };
 const baseY=surface+.0005+.002;
 add('Base',geometry(.098,.004,.054),material(0xe8e9dc),-.110,baseY,.362);
 const chipGeometry=geometry(.019,.0012,.029);
 for(const [i,color]of [0x93a68d,0xd6b47c,0xa9b1a4].entries())
  add(`ReferenceChip_${i}`,chipGeometry,material(color),-.139+i*.029,baseY+.0026,.362);
 // A supported narrow cursor slides along the strip; no floating badges/pulse.
 const cursor=add('Cursor',geometry(.003,.0012,.040),material(0x576953),-.151,baseY+.0026,.362);
 let disposed=false;
 function update(pose={}){
  if(disposed)return;
  const beat=Number.isFinite(pose.propBeat)?Math.max(0,Math.min(1,pose.propBeat)):0;
  cursor.position.x=-.151+.082*beat;
 }
 function dispose(){
  if(disposed)return;disposed=true;root.removeFromParent();
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
 }
 return{root,update,dispose};
}
