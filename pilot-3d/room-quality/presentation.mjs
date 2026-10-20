const activityColors={typing:0x87ad7a,thinking:0xbca46b,waiting:0xc9a25f,success:0x79ac78,error:0xbf7868,reviewing:0x86a0b7,preparing:0xa5ad79,sending:0x86a99c,receiving:0x86a99c};
export function layoutLabels(items,width,height){
 const placed=[];for(const item of [...items].sort((a,b)=>Number(b.selected)-Number(a.selected)||a.id.localeCompare(b.id))){let chosen;for(const offset of[0,-item.h-4,item.h+4,-2*(item.h+4),2*(item.h+4)]){const left=Math.max(4,Math.min(width-item.w-4,item.x-item.w/2)),top=Math.max(4,Math.min(height-item.h-4,item.y-item.h+offset)),rect={left,top,right:left+item.w,bottom:top+item.h};if(!placed.some(p=>rect.left<p.right+3&&rect.right>p.left-3&&rect.top<p.bottom+3&&rect.bottom>p.top-3)){chosen=rect;break;}}if(chosen)placed.push({...item,...chosen});}
 return placed;
}
export function createRoomPresentation(model){
 const left=[],back=[],screens=new Map(),indicators=new Map();const sizes=new Map();let cutaway={left:false,back:false};
 model.traverse(node=>{const keys=node.userData.parts??[node.name];if(keys.every(name=>/^(LeftWall|LeftSkirt|WallArt\d)$/.test(name)))left.push(node);if(keys.every(name=>/^(BackWall|BackSkirt|Sill|WindowTop|LastPost|Glass\d|WindowPost\d|WindowRail\d|WindowPortal\d|LayeredOutdoors)$/.test(name)))back.push(node);for(const mat of[node.material].flat().filter(Boolean)){if(mat.userData.roomScreen)screens.set(mat,mat.userData.roomScreen);if(mat.userData.activityIndicator)indicators.set(mat,mat.userData.activityIndicator);}});
 function update(camera,activities){cutaway={left:camera.position.x< -4.7,back:camera.position.z< -3.65};for(const node of left)node.visible=!cutaway.left;for(const node of back)node.visible=!cutaway.back;
  for(const[mat,id]of screens){const a=activities?.[id],pose=a?.returning?a.basePose:a?.action,color=activityColors[pose];mat.emissive.setHex(color??0xffffff);mat.emissiveIntensity=color!==undefined ? .52 : .12;}
  for(const[mat,id]of indicators){const a=activities?.[id],pose=a?.returning?a.basePose:a?.action;mat.color.setHex(activityColors[pose]??0x899680);mat.emissive.copy(mat.color);mat.emissiveIntensity=activityColors[pose]?1.15:.2;}
 }
 function arrange(labels,width,height,selected){const items=[];for(const[id,label]of labels)if(!label.hidden){const key=label.textContent+':'+width;let size=sizes.get(id);if(!size||size.key!==key){size={key,w:label.offsetWidth,h:label.offsetHeight};sizes.set(id,size);}items.push({id,x:parseFloat(label.style.left),y:parseFloat(label.style.top),...size,selected:id===selected});}const placements=layoutLabels(items,width,height),ids=new Set(placements.map(p=>p.id));for(const item of items)if(!ids.has(item.id))labels.get(item.id).hidden=true;for(const p of placements){const label=labels.get(p.id);label.style.left=(p.left+p.w/2)+'px';label.style.top=(p.top+p.h)+'px';}}
 return{update,arrange,diagnostics:()=>({...cutaway})};
}

export function returnStatus(name,state,{paused=false}={}){if(!state?.returning)return null;if(paused)return name+' · 동작 정지 · 자리 복귀 대기';const working=['typing','thinking','preparing','reviewing','waiting','sending','receiving'].includes(state.basePose);return name+' · '+(working?'업무 진행 · ':'')+'자리 복귀 중';}
