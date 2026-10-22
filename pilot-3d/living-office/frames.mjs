import {Vector3,Quaternion,DynamicDrawUsage} from 'three';
function encode(array){const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function decode(s,count){if(typeof s!=='string'||s.length!==Math.ceil(count*4/3)*4)throw Error('장면 데이터 길이 불일치');const raw=atob(s),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);if(bytes.length!==count*4)throw Error('장면 데이터 길이 불일치');const a=new Float32Array(bytes.buffer);if(!a.every(Number.isFinite))throw Error('장면에 유효하지 않은 좌표가 있습니다');return a;}
function fingerprint(nodes){let h=2166136261;for(const text of nodes.map((n,i)=>i+':'+n.name+':'+n.type+':'+(n.isInstancedMesh?n.count:0)))for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function address(n,root){const parts=[];let at=n;while(at){const peers=at.parent?.children.filter(c=>c.name===at.name&&c.type===at.type)??[at];parts.unshift(at.name+':'+at.type+':'+peers.indexOf(at));if(at===root)break;at=at.parent;}return parts.join('/');}
export class SceneFrames{
 constructor(model){this.model=model;this.nodes=[];model.traverse(n=>this.nodes.push(n));const keys=new Map(this.nodes.map(n=>[n,address(n,model)]));this.nodes.sort((a,b)=>keys.get(a).localeCompare(keys.get(b),'en'));this.index=new Map(this.nodes.map((n,i)=>[n,i]));this.schema=fingerprint(this.nodes);this.externalParents=this.nodes.map(n=>this.index.has(n.parent)?null:n.parent);this.targets=null;this.elapsed=0;this.summary=null;this.initial=this.capture({});}
 capture(summary){const data=new Float32Array(this.nodes.length*12),instances=[],geometries=[];
  this.nodes.forEach((n,i)=>{data.set([this.index.get(n.parent)??-1,...n.position,...n.quaternion,...n.scale,n.visible?1:0],i*12);if(n.userData.ensemblePaper)geometries.push({node:i,count:n.geometry.attributes.position.count,data:encode(n.geometry.attributes.position.array)});if(n.isInstancedMesh&&(n.instanceMatrix.usage===DynamicDrawUsage||n.parent?.userData.ensemblePaper))instances.push({node:i,count:n.count,data:encode(n.instanceMatrix.array.subarray(0,n.count*16))});});
  return{schema:this.schema,nodes:this.nodes.length,data:encode(data),instances,geometries,summary};
 }
 receive(packet){if(packet?.schema!==this.schema||packet.nodes!==this.nodes.length)throw Error('공동 장면의 에셋 버전이 다릅니다. 화면을 새로 열어 주세요.');const data=decode(packet.data,this.nodes.length*12),parents=[],targets=[];
  for(let i=0;i<this.nodes.length;i++){const offset=i*12,p=data[offset];if(!Number.isInteger(p)||p< -1||p>=this.nodes.length||p===i)throw Error('장면 부모 인덱스 오류');parents.push(p);if(Math.abs(Math.hypot(...data.subarray(offset+4,offset+8))-1)>.01||![0,1].includes(data[offset+11]))throw Error('장면 회전/표시 오류');}
  const checked=new Set();for(let i=0;i<parents.length;i++){let n=i;const path=new Set();while(n!==-1&&!checked.has(n)){if(path.has(n))throw Error('장면 부모 순환');path.add(n);n=parents[n];}for(const p of path)checked.add(p);}
  const geometries=(packet.geometries??[]).map(r=>{const node=this.nodes[r.node];if(!node?.userData.ensemblePaper||node.geometry.attributes.position.count!==r.count)throw Error('종이 형상 명세 불일치');return{node,data:decode(r.data,r.count*3)};});
  const instances=(packet.instances??[]).map(r=>{const node=this.nodes[r.node];if(!node?.isInstancedMesh||node.count!==r.count)throw Error('손 형상 명세 불일치');return{node,data:decode(r.data,r.count*16)};});
  // Detach first to avoid transient cycles when ownership switches in one frame.
  this.nodes.forEach((n,i)=>{const parent=parents[i]<0?this.externalParents[i]:this.nodes[parents[i]];if(n.parent!==parent)n.removeFromParent();});
  this.nodes.forEach((n,i)=>{const offset=i*12,parent=parents[i]<0?this.externalParents[i]:this.nodes[parents[i]],reparent=n.parent!==parent;if(reparent&&parent)parent.add(n);const p=new Vector3().fromArray(data,offset+1),q=new Quaternion().fromArray(data,offset+4).normalize(),s=new Vector3().fromArray(data,offset+8);targets.push({node:n,p,q,s,fromP:reparent?p.clone():n.position.clone(),fromQ:reparent?q.clone():n.quaternion.clone(),fromS:reparent?s.clone():n.scale.clone()});n.visible=!!data[offset+11];});
  for(const{node,data}of geometries){node.geometry.attributes.position.array.set(data);node.geometry.attributes.position.needsUpdate=true;node.geometry.computeVertexNormals();node.geometry.computeBoundingBox();}
  for(const{node,data}of instances){node.instanceMatrix.array.set(data);node.instanceMatrix.needsUpdate=true;}
  this.targets=targets;this.elapsed=0;this.summary=packet.summary;
 }
 apply(dt){if(!this.targets)return;this.elapsed+=dt;const u=Math.min(1,this.elapsed/.22);for(const r of this.targets){r.node.position.lerpVectors(r.fromP,r.p,u);r.node.quaternion.slerpQuaternions(r.fromQ,r.q,u);r.node.scale.lerpVectors(r.fromS,r.s,u);}this.model.updateMatrixWorld(true);}
 restore(){this.receive(this.initial);this.apply(1);this.clear();}
 clear(){this.targets=null;this.summary=null;}
}
