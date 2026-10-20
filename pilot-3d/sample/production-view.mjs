import{createQualityView}from'./quality-view.mjs';import{createStudioView}from'../src/scene.mjs';
// Asset+renderer switch as a unit. Preserve user presentation state across automatic v4 recovery.
export function createProductionView(host,callbacks={},options={}){
 let active,version=5,disposed=false,fallback=false,vm={actors:[],motionPaused:false},focus=false,quality='auto',lighting='day',resolveReady;
 const ready=new Promise(resolve=>resolveReady=resolve);
 const metrics=data=>{if(!disposed)callbacks.onMetrics?.({...data,modelVersion:version});};
 function replay(){active?.setViewModel(vm);active?.resetCamera(focus);active?.setQuality(quality);active?.setLighting?.(lighting);}
 function recover(error){if(disposed||fallback)return;fallback=true;active?.dispose();version=4;try{active=createStudioView(host,{onStatus(kind,err){if(!disposed)callbacks.onStatus?.(kind,err??error,4);},onSelect:id=>callbacks.onSelect?.(id),onMetrics:metrics},{...options,modelUrl:'/assets/studio-team-v4.glb'});replay();active.ready.then(ok=>resolveReady(ok));}catch(err){callbacks.onStatus?.('error',err,4);resolveReady(false);}}
 try{active=createQualityView(host,{onStatus(kind,error){if(disposed)return;if(kind==='error'){recover(error);return;}callbacks.onStatus?.(kind,error,5);},onSelect:id=>callbacks.onSelect?.(id),onMetrics:metrics},options);active.ready.then(ok=>{if(disposed)return;if(ok)resolveReady(true);else recover(new Error('V5 load failed'));});}catch(error){recover(error);}
 return {ready,setViewModel(next){vm=next;active?.setViewModel(next);},resetCamera(next=false){focus=next;active?.resetCamera(next);},setQuality(next){quality=next;active?.setQuality(next);},setLighting(next){lighting=next;active?.setLighting?.(next);},startDemo(){return version===5?active?.startDemo():false;},resetActivity(){active?.resetActivity?.();},diagnostics(){return {...active?.diagnostics(),modelVersion:version};},measure(duration){return active?.measure(duration);},loseContext(){active?.loseContext();},restoreContext(){active?.restoreContext?.();},dispose(){disposed=true;const result=active?.dispose();resolveReady(false);return result;}};
}
