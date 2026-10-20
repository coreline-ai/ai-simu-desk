import {createQualityView} from './quality-view.mjs';
import {createStudioView} from '../src/scene.mjs';
// Recover the renderer and its matching asset together; replay only presentation state.
export function createProductionView(host,callbacks={},options={}){
 const requested=options.modelVersion??(options.modelUrl?.includes('studio-team-v5')?5:6);
 const targets=requested===6?[
  ...(options.activityRuntime?[{version:6,activity:true,runtimeFactory:options.runtimeFactory,url:options.modelUrl??'/assets/studio-room-v6.glb'},...(options.fallbackRuntimeFactory?[{version:6,activity:true,recoveredActivity:true,runtimeFactory:options.fallbackRuntimeFactory,url:options.modelUrl??'/assets/studio-room-v6.glb'}]:[])]:[]),
  {version:6,url:options.modelUrl??'/assets/studio-room-v6.glb'},
  {version:5,url:options.fallbackModelUrl??'/assets/studio-team-v5.glb'},
  {version:4,url:'/assets/studio-team-v4.glb'},
 ]:[{version:5,url:options.modelUrl??'/assets/studio-team-v5.glb'},{version:4,url:'/assets/studio-team-v4.glb'}];
 let active,index=0,epoch=0,disposed=false,vm={actors:[],motionPaused:false},focus=false,quality='auto',lighting='day',resolveReady;
 const ready=new Promise(resolve=>resolveReady=resolve);
 function replay(){active?.setViewModel(vm);active?.resetCamera(focus);active?.setQuality(quality);active?.setLighting?.(lighting);}
 function mount(cause){const ticket=++epoch,target=targets[index];active?.dispose();callbacks.onStatus?.('loading',cause,target.version);
  const recover=error=>{if(disposed||ticket!==epoch)return;if(index+1<targets.length){index++;mount(error);}else{callbacks.onStatus?.('error',error,target.version);resolveReady(false);}};
  try{const factory=target.version===4?createStudioView:createQualityView;active=factory(host,{onStatus(kind,error){if(disposed||ticket!==epoch)return;if(kind==='error'){recover(error);return;}callbacks.onStatus?.(kind,error??cause,target.version,!!target.activity,!!target.recoveredActivity);},onSelect:id=>callbacks.onSelect?.(id),onMetrics:data=>{if(!disposed&&ticket===epoch)callbacks.onMetrics?.({...data,modelVersion:target.version});}},{...options,modelUrl:target.url,runtimeFactory:target.activity?target.runtimeFactory:undefined,roomQuality:target.version===6});replay();active.ready.then(ok=>{if(disposed||ticket!==epoch)return;if(ok)resolveReady(true);else recover(new Error('Studio asset load failed'));});}catch(error){recover(error);}
 }
 mount();
 return {ready,cameraState(){return active?.cameraState?.();},restoreCamera(state){active?.restoreCamera?.(state);},setViewModel(next){vm=next;active?.setViewModel(next);},resetCamera(next=false){focus=next;active?.resetCamera(next);},setQuality(next){quality=next;active?.setQuality(next);},setLighting(next){lighting=next;active?.setLighting?.(next);},startDemo(){return targets[index].version>=5?active?.startDemo():false;},resetActivity(){active?.resetActivity?.();},diagnostics(){return {...active?.diagnostics(),modelVersion:targets[index].version};},measure(duration){return active?.measure(duration);},loseContext(){active?.loseContext();},restoreContext(){active?.restoreContext?.();},dispose(){disposed=true;++epoch;const result=active?.dispose();resolveReady(false);return result;}};
}
