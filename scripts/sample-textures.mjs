import {deflateSync} from 'node:zlib';
function crc32(bytes){let n=0xffffffff;for(const v of bytes){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
const chunk=(type,data)=>{const body=Buffer.concat([Buffer.from(type),data]),h=Buffer.alloc(4),c=Buffer.alloc(4);h.writeUInt32BE(data.length);c.writeUInt32BE(crc32(body));return Buffer.concat([h,body,c]);};
export function texturePNG(kind,size=256){
 const raw=Buffer.alloc((size*4+1)*size);let seed=1024;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++){for(let x=0;x<size;x++){let c;
  if(kind==='oak'){const grain=Math.sin(x*.22+Math.sin(y*.025)*2)+.45*Math.sin(x*.86+Math.sin(y*.05));const n=random()*4;c=[192+grain*9+n,147+grain*8+n,98+grain*6+n];}
  else if(kind==='stone'){const cx=Math.floor(x/8),cy=Math.floor(y/8),hash=((cx*73856093)^(cy*19349663))>>>0;const dx=x%8-(hash%5+1),dy=y%8-((hash>>>4)%5+1),r=1+(hash>>>8)%3;const chip=dx*dx+dy*dy<r*r;c=chip?[[171,165,147],[198,165,140],[175,186,162]][hash%3]:[232+random()*5,225+random()*5,209+random()*5];}
  else if(kind==='roughness'){const v=210+random()*40;c=[v,v,v];}
  else {const weave=(x%3===0?-9:0)+(y%3===0?-7:0)+random()*8;c=[242+weave,242+weave,242+weave];}
  const i=y*(size*4+1)+1+x*4;raw[i]=c[0];raw[i+1]=c[1];raw[i+2]=c[2];raw[i+3]=255;
 }}
 const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
// Add reproducible PNGs as bufferViews, so the distributable is one genuine self-contained GLB.
export function embedTextures(binary){
 const jl=binary.readUInt32LE(12),json=JSON.parse(binary.subarray(20,20+jl).toString()),bl=binary.readUInt32LE(20+jl);let bin=Buffer.from(binary.subarray(28+jl,28+jl+bl));
 json.images=[];json.textures=[];json.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
 const indices={};for(const kind of ['oak','stone','fabric','linen','roughness']){const png=texturePNG(kind);json.bufferViews.push({buffer:0,byteOffset:bin.length,byteLength:png.length});json.images.push({bufferView:json.bufferViews.length-1,mimeType:'image/png',name:kind});indices[kind]=json.textures.length;json.textures.push({source:json.images.length-1,sampler:0,name:kind});bin=Buffer.concat([bin,png,Buffer.alloc((4-png.length%4)%4)]);}
 for(const mat of json.materials){const kind=mat.extras?.textureKind;if(!kind)continue;mat.pbrMetallicRoughness.baseColorTexture={index:indices[kind]};mat.pbrMetallicRoughness.metallicRoughnessTexture={index:indices.roughness};}
 json.buffers[0].byteLength=bin.length;const text=Buffer.from(JSON.stringify(json));const jb=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jb.length+bin.length,8);header.writeUInt32LE(jb.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,jb,bh,bin]);
}

export function rgbaPNG(width,height,bytes){const rows=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)Buffer.from(bytes.buffer,bytes.byteOffset+y*width*4,width*4).copy(rows,y*(width*4+1)+1);const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
