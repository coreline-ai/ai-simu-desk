import * as T from 'three';
import {skyColors} from './outdoors.mjs';
// Scene-only presentation: no task text, identity, result body or server state is stored here.
export function createRoomAppearance(model,scene,{fixedLighting=false}={}){
 const skies=[],tints=new Set(),bulbs=[];model.traverse(node=>{if(node.userData.windowPortal){node.material.colorWrite=false;node.material.depthWrite=false;node.material.stencilWrite=true;node.material.stencilRef=1;node.material.stencilFunc=T.AlwaysStencilFunc;node.material.stencilZPass=T.ReplaceStencilOp;node.renderOrder=-10;}if(node.userData.noShadow&&!node.userData.windowPortal&&node.parent?.name==='LayeredOutdoors'){node.material.stencilWrite=true;node.material.stencilWriteMask=0;node.material.stencilRef=1;node.material.stencilFunc=T.EqualStencilFunc;node.renderOrder=-8;}if(node.userData.skyGradient){node.renderOrder=-9;skies.push(node);}if(node.userData.timeRole==='lamp')bulbs.push(node);for(const mat of[node.material].flat().filter(Boolean))if(mat.userData.dayColor!==undefined)tints.add(mat);});
 const reading=new T.PointLight(0xffca8f,.08,3.2,2);reading.position.set(-.85,1.22,-3.02);reading.castShadow=false;if(bulbs.length&&!fixedLighting)scene.add(reading);
 return {setTime(value){const night=value==='evening';for(const sky of skies)skyColors(sky.geometry,night);for(const mat of tints)mat.color.setHex(night?mat.userData.nightColor:mat.userData.dayColor);for(const bulb of bulbs)bulb.material.emissiveIntensity=night?1.8:.2;reading.intensity=night?.70:.08;},dispose(){scene.remove(reading);}};
}
