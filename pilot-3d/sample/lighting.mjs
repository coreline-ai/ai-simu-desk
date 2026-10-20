import *as T from'three';
export const QUALITY=Object.freeze({low:{dpr:1,shadow:512,anisotropy:1},balanced:{dpr:1.5,shadow:1024,anisotropy:4},high:{dpr:2,shadow:2048,anisotropy:8}});
export function qualitySettings(value,width=1000){return QUALITY[value]??QUALITY[width<600?'low':'balanced'];}
export function studioLighting(scene,{large=false}={}){
 const hemi=new T.HemisphereLight(0xfff5df,0x75826c,2.1),ambient=new T.AmbientLight(0xfff1da,.25),sun=new T.DirectionalLight(0xffe3b8,3.1),fill=new T.DirectionalLight(0xd5e8f4,.7);sun.position.set(-3.5,large?10:6,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:large?-8:-4,right:large?8:4,top:large?8:4,bottom:large?-8:-4,near:.1,far:large?25:16});sun.shadow.bias=-.00025;sun.shadow.normalBias=.018;sun.shadow.radius=3;fill.position.set(3,3,-2);scene.add(hemi,ambient,sun,fill);
 return {sun,setTime(value){const night=value==='evening';hemi.color.set(night?0xc8d9e9:0xfff5df);hemi.intensity=night?1.1:2.1;sun.color.set(night?0xf9c091:0xffe3b8);sun.intensity=night?1.35:3.1;fill.intensity=night?.9:.7;ambient.intensity=night?.38:.25;},setQuality(value){const size=QUALITY[value]?.shadow??1024;if(sun.shadow.mapSize.x!==size){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(size,size);}},dispose(){sun.shadow.dispose();for(const l of[hemi,ambient,sun,fill])scene.remove(l);}};
}
