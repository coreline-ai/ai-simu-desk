/** A small desk-supported colour reference, never a second tablet/notebook. */
export function createProps({actor,model,THREE:T,deskY=.74}){
 void actor; void model;
 const surface=Number.isFinite(deskY)?deskY:.74;
 // Ground the card on the measured desk top; only a 0.5 mm contact bias.
 const cardY=surface+.0005+.003;
 const root=new T.Group();root.name='Personality_sora_ColourReference';
 const geometries=new Set(),materials=new Set();
 const geometry=(w,h,d)=>{const g=new T.BoxGeometry(w,h,d);geometries.add(g);return g;};
 const material=colour=>{const m=new T.MeshStandardMaterial({color:colour,roughness:.9});materials.add(m);return m;};
 const add=(name,g,m,x,y,z)=>{
  const mesh=new T.Mesh(g,m);mesh.name=`Personality_sora_${name}`;mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
 };
 add('PaletteCard',geometry(.115,.006,.068),material(0xf4eee0),-.10,cardY,.36);
 const chipGeometry=geometry(.019,.0018,.035);
 const colours=[0xd98875,0xd9ba6f,0x879f91,0x8798ae];
 const chips=colours.map((c,i)=>add(`Swatch_${i}`,chipGeometry,material(c),-.140+i*.026,cardY+.004,.36));
 // A thin frame is a quiet static reference marker; no floating or pulsing card.
 const marker=new T.Group();marker.name='Personality_sora_SelectionMarker';root.add(marker);
 const frameMaterial=material(0x6d766a);
 for(const [i,x,z,w,d] of [[0,-.011,0,.0015,.039],[1,.011,0,.0015,.039],[2,0,-.0195,.023,.0015],[3,0,.0195,.023,.0015]]){
  const rail=new T.Mesh(geometry(w,.0015,d),frameMaterial);rail.name=`Personality_sora_MarkerRail_${i}`;
  rail.position.set(x,0,z);marker.add(rail);
 }
 marker.position.set(chips[0].position.x,cardY+.0054,.36);
 let disposed=false;
 function update(pose={}){
  if(disposed)return;
  const beat=Number.isFinite(pose.propBeat)?Math.max(0,Math.min(1,pose.propBeat)):0;
  // Slides on the card surface. Every colour chip remains fixed and supported.
  marker.position.x=-.140+.078*beat;
 }
 function dispose(){
  if(disposed)return;disposed=true;root.removeFromParent();
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
 }
 return{root,update,dispose};
}
