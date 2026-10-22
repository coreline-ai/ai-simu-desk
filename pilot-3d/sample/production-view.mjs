import{motionSpeed}from'./motion-clock.mjs';
import {createQualityView} from './quality-view.mjs';
import {createStudioView} from '../src/scene.mjs';
// Recover the renderer and its matching asset together; replay only presentation state.
export function createProductionView(host,callbacks={},options={}){
 const requested=options.modelVersion??(options.modelUrl?.includes('studio-room-v9')?9:options.modelUrl?.includes('studio-room-v8')?8:options.modelUrl?.includes('studio-room-v7')?7:options.modelUrl?.includes('studio-team-v5')?5:6);
 const oldActivities=[...(options.fallbackRuntimeFactories??[]),...(options.fallbackRuntimeFactory?[options.fallbackRuntimeFactory]:[])];
 const paired=options.pairedFallbackRuntimeFactory??options.runtimeFactory;
 const targets=[8,9].includes(requested)?[
 {version:8,activity:true,runtimeFactory:options.runtimeFactory,url:requested===9?'/assets/studio-room-v8.glb':options.modelUrl??'/assets/studio-room-v8.glb'},
 {version:7,activity:true,recoveredActivity:true,runtimeFactory:paired,url:'/assets/studio-room-v7.glb'},
 {version:6,activity:true,recoveredActivity:true,runtimeFactory:paired,url:'/assets/studio-room-v6.glb'},
 ...oldActivities.map(runtimeFactory=>({version:6,activity:true,recoveredActivity:true,runtimeFactory,url:'/assets/studio-room-v6.glb'})),
 {version:6,url:'/assets/studio-room-v6.glb'},{version:5,url:'/assets/studio-team-v5.glb'},{version:4,url:'/assets/studio-team-v4.glb'}
 ]:requested===7?[
 ...(options.activityRuntime&&typeof options.runtimeFactory==='function'?[{version:7,activity:true,runtimeFactory:options.runtimeFactory,url:options.modelUrl??'/assets/studio-room-v7.glb'},
 {version:6,activity:true,recoveredActivity:true,runtimeFactory:options.runtimeFactory,url:'/assets/studio-room-v6.glb'}]:[]),
 ...oldActivities.map(runtimeFactory=>({version:6,activity:true,recoveredActivity:true,runtimeFactory,url:'/assets/studio-room-v6.glb'})),
 {version:6,url:'/assets/studio-room-v6.glb'},{version:5,url:options.fallbackModelUrl??'/assets/studio-team-v5.glb'},{version:4,url:'/assets/studio-team-v4.glb'}
 ]:requested===6?[
  ...(options.activityRuntime?[{version:6,activity:true,runtimeFactory:options.runtimeFactory,url:options.modelUrl??'/assets/studio-room-v6.glb'},...[...(options.fallbackRuntimeFactories??[]),...(options.fallbackRuntimeFactory?[options.fallbackRuntimeFactory]:[])].map(runtimeFactory=>({version:6,activity:true,recoveredActivity:true,runtimeFactory,url:options.modelUrl??'/assets/studio-room-v6.glb'}))]:[]),
  {version:6,url:options.modelUrl??'/assets/studio-room-v6.glb'},
  {version:5,url:options.fallbackModelUrl??'/assets/studio-team-v5.glb'},
  {version:4,url:'/assets/studio-team-v4.glb'},
 ]:[{version:5,url:options.modelUrl??'/assets/studio-team-v5.glb'},{version:4,url:'/assets/studio-team-v4.glb'}];
 if(requested===9)targets.unshift({version:9,activity:true,runtimeFactory:options.runtimeFactory,url:options.modelUrl??'/assets/studio-room-v9.glb'});
 let active,index=0,epoch=0,disposed=false,vm={actors:[],motionPaused:false},focus=false,quality='auto',lighting='day',speed=1,resolveReady;
 const ready=new Promise(resolve=>resolveReady=resolve);
 function replay(){active?.setMotionSpeed?.(speed);active?.setViewModel(vm);active?.resetCamera(focus);active?.setQuality(quality);active?.setLighting?.(lighting);}
 function mount(cause){const ticket=++epoch,target=targets[index];active?.dispose();callbacks.onStatus?.('loading',cause,target.version);
  const recover=error=>{if(disposed||ticket!==epoch)return;if(index+1<targets.length){index++;mount(error);}else{callbacks.onStatus?.('error',error,target.version);resolveReady(false);}};
  try{const factory=target.version===4?createStudioView:createQualityView;active=factory(host,{onStatus(kind,error){if(disposed||ticket!==epoch)return;if(kind==='error'){recover(error);return;}callbacks.onStatus?.(kind,error??cause,target.version,!!target.activity,!!target.recoveredActivity);},onSelect:id=>callbacks.onSelect?.(id),onMetrics:data=>{if(!disposed&&ticket===epoch)callbacks.onMetrics?.({...data,modelVersion:target.version});}},{...options,modelVersion:target.version,modelUrl:target.url,runtimeFactory:target.activity?target.runtimeFactory:undefined,roomQuality:target.version>=6});replay();active.ready.then(ok=>{if(disposed||ticket!==epoch)return;if(ok)resolveReady(true);else recover(new Error('Studio asset load failed'));});}catch(error){recover(error);}
 }
 mount();
 return {ready,cameraState(){return active?.cameraState?.();},restoreCamera(state){const sameModernSpace=[7,8,9].includes(state?.modelVersion)&&[7,8,9].includes(targets[index].version);active?.restoreCamera?.(sameModernSpace?{...state,modelVersion:targets[index].version}:state);},setMotionSpeed(value){speed=motionSpeed(value);return active?.setMotionSpeed?.(speed)??1;},setViewModel(next){vm=next;active?.setViewModel(next);},resetCamera(next=false){focus=next;active?.resetCamera(next);},setQuality(next){quality=next;active?.setQuality(next);},setLighting(next){lighting=next;active?.setLighting?.(next);},captureScene(){return active?.captureScene?.();},followScene(packet){return active?.followScene?.(packet)??false;},setSceneRemote(value){return active?.setSceneRemote?.(value)??false;},setAutoCamera(value){return active?.setAutoCamera?.(value)??false;},startScenario(name){return active?.startScenario?.(name)??false;},startHuddle(ids){return active?.startHuddle?.(ids)??false;},startReview(ids){return active?.startReview?.(ids)??false;},async setSound(value){return active?.setSound?.(value)??false;},startCup(id){return active?.startCup?.(id)??false;},startCoffee(id){return active?.startCoffee?.(id)??false;},startGroupMeeting(){return active?.startGroupMeeting?.()??false;},cancelActivities(){active?.cancelActivities?.();},startDemo(){return targets[index].version>=5?active?.startDemo():false;},resetActivity(){active?.resetActivity?.();},diagnostics(){return {...active?.diagnostics(),modelVersion:targets[index].version,motionSpeed:active?.diagnostics?.().motionSpeed??1};},measure(duration){return active?.measure(duration);},loseContext(){active?.loseContext();},restoreContext(){active?.restoreContext?.();},dispose(){disposed=true;++epoch;const result=active?.dispose();resolveReady(false);return result;}};
}
