import * as T from 'three';

const PROFILES=Object.freeze({nara:{prefix:'Nara',face:1},sora:{prefix:'Sora',face:.96},leo:{prefix:'Leo',face:.98}});
export const HAIR_FILL_ASSETS=Object.freeze(Object.keys(PROFILES).map(actor=>Object.freeze({id:actor+'-continuous-hair-roots',version:1,actor,source:'original local procedural geometry',meshes:1,textures:0})));
const AROUND=32,RINGS=12;
// One continuous disk: the only open edge is the intentionally shaped hairline.
// Front stays above brows; temples descend beside ears; back joins existing hair.
export function hairlineAngle(phi){const front=Math.sin(phi);return front>=0?1.94-.90*front**.55:1.94+.44*(-front)**.7;}
export function createHairFillGeometry(actor){
 const profile=PROFILES[actor];if(!profile)throw Error('Unsupported hair-fill actor: '+actor);
 const positions=[0,.189,.023],indices=[],rx=.146*profile.face+.009,ry=.181,rz=.146;
 for(let ring=1;ring<=RINGS;ring++)for(let col=0;col<AROUND;col++){
  const phi=col/AROUND*Math.PI*2,theta=hairlineAngle(phi)*ring/RINGS;
  positions.push(rx*Math.sin(theta)*Math.cos(phi),.008+ry*Math.cos(theta),.023+rz*Math.sin(theta)*Math.sin(phi));
 }
 for(let col=0;col<AROUND;col++)indices.push(0,1+(col+1)%AROUND,1+col);
 for(let ring=0;ring<RINGS-1;ring++)for(let col=0;col<AROUND;col++){
  const a=1+ring*AROUND+col,b=1+ring*AROUND+(col+1)%AROUND,c=a+AROUND,d=b+AROUND;
  indices.push(a,b,c,b,d,c);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export function installHairFill(model){
 // Validate the complete set before touching the scene: no partial installations.
 const slots=HAIR_FILL_ASSETS.map(meta=>{
  const prefix=PROFILES[meta.actor].prefix,head=model.getObjectByName(prefix+'Head'),name='Practice'+prefix+'HairFill';
  if(!head)throw Error(prefix+'Head missing');if(head.getObjectByName(name))throw Error(prefix+' hair fill already installed');
  const hair=head.children.find(n=>n.name===prefix+'_HairBack'||n.userData.parts?.includes(prefix+'_HairBack'));
  if(!hair?.isMesh||Array.isArray(hair.material))throw Error(prefix+' hair material missing');
  return{meta,head,name,material:hair.material};
 });
 const created=[];
 try{for(const slot of slots){const mesh=new T.Mesh(createHairFillGeometry(slot.meta.actor),slot.material);mesh.name=slot.name;mesh.userData={...slot.meta};mesh.castShadow=true;mesh.receiveShadow=true;created.push({...slot,mesh});}}
 catch(error){for(const {mesh}of created)mesh.geometry.dispose();throw error;}
 for(const {head,mesh}of created)head.add(mesh);
 let disposed=false;
 return{diagnostics:()=>created.map(({meta,head,mesh})=>({...meta,parent:mesh.parent?.name??null,triangles:mesh.geometry.index.count/3,material:mesh.material.name,head:head.name})),dispose(){
  if(disposed)return;disposed=true;for(const {mesh}of created){mesh.removeFromParent();mesh.geometry.dispose();}
  // Materials belong to the canonical hair, not this overlay: never dispose them.
 }};
}
