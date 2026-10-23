import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {QUALITY} from '../sample/lighting.mjs';
export function roomLighting(scene,{renderer,resources}={}){
 const hemi=new T.HemisphereLight(0xe6f0ed,0x8b7762,1.65),ambient=new T.AmbientLight(0xfff1df,.12);
 const sun=new T.DirectionalLight(0xffe2b9,3.0),fill=new T.DirectionalLight(0xd8e7f5,.42);
 sun.position.set(-3,8,-5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:25});sun.shadow.normalBias=.009;sun.shadow.bias=-.00012;sun.shadow.radius=3;
 fill.position.set(4,3,5);scene.add(hemi,ambient,sun,fill);
 let environment,period='day';
 function release(){sun.shadow.dispose();sun.shadow.map=null;sun.shadow.mapPass=null;environment?.dispose();environment=null;scene.environment=null;}
 function restore(){
  if(!renderer||environment)return;
  const generator=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  try{environment=generator.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=period==='evening'?.20:.28;}
  finally{resources?.capture(room);room.dispose();generator.dispose();}
 }
 try{restore();}catch(error){release();for(const light of[hemi,ambient,sun,fill])scene.remove(light);throw error;}
 return {sun,release,restore,setBounds(bounds){const span=Math.hypot(bounds[1][0]-bounds[0][0],bounds[1][2]-bounds[0][2])*.62;Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,far:35});sun.shadow.camera.updateProjectionMatrix();},setTime(value){period=value;const night=value==='evening';hemi.color.set(night?0x99afcb:0xe6f0ed);hemi.intensity=night?.85:1.65;sun.color.set(night?0xffbc82:0xffe2b9);sun.intensity=night?1.4:3;fill.intensity=night?.65:.42;ambient.intensity=night?.24:.12;if(environment)scene.environmentIntensity=night?.20:.28;},setQuality(value){const size=QUALITY[value]?.shadow??1024;if(sun.shadow.mapSize.x!==size){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(size,size);}},dispose(){release();for(const light of[hemi,ambient,sun,fill])scene.remove(light);}};
}
