import * as T from 'three';
import {createEnsembleOffice} from '../ensemble-office/model.mjs';
import {group,box,rod,material} from '../sample/geometry.mjs';
import {modelCost} from '../sample/optimize.mjs';

export function createLivingOffice(){
  const model=createEnsembleOffice(),root=model.root;
  for(const id of root.userData.actorIds)root.getObjectByName(root.userData.ensembleOffice.cups[id].cup).userData.supportGrip={offset:[.008,-.066,-.045],contacts:[[.030,-.0445,-.010],[-.020,-.0445,.010],[-.006,-.0445,.018],[.008,-.0445,.020],[.020,-.0445,.012]],policy:'right-palm-under-base; left-hand-ownership'};
  const oak=root.getObjectByName('NaraOakDeskTop').material;
  const frame=material('LivingBoardFrame',0xb5b7a1,.68),paper=material('LivingBoardSurface',0xf2f0e7,.9),ink=material('LivingBoardInk',0x687d6b,.85);
  const board=group(root,'LivingReviewBoard',[0,0,.65]);
  box(board,'LivingBoardPanel',[1.85,1.05,.045],[0,1.55,0],paper,.018);
  for(const x of[-.95,.95]){box(board,'LivingBoardSide'+x,[.035,1.13,.06],[x,1.55,0],frame,.01);rod(board,'LivingBoardLeg'+x,[x,1.2,0],[x,.04,0],.022,oak);box(board,'LivingBoardFoot'+x,[.12,.06,.40],[x,.03,0],frame,.015);}
  for(const y of[.99,2.11])box(board,'LivingBoardRail'+y,[1.94,.035,.06],[0,y,0],frame,.01);
  const strokes=group(board,'LivingBoardStrokes');
  for(let i=0;i<5;i++){const g=group(strokes,'LivingBoardTopic'+i);box(g,'LivingBoardHeading'+i,[.34,.018,.003],[-.62+(i%2)*.83,1.88-Math.floor(i/2)*.25,-.025],ink,.005);for(let j=0;j<2;j++)box(g,'LivingBoardLine'+i+'_'+j,[.48-j*.09,.008,.003],[-.55+(i%2)*.83,1.81-Math.floor(i/2)*.25-j*.055,-.025],ink,.003);g.visible=false;}
  const tray=group(board,'LivingMarkerTray',[.25,1.18,-.08]);box(tray,'LivingMarkerDock',[.25,.025,.10],[0,0,0],frame,.008);
  const marker=new T.Mesh(new T.CylinderGeometry(.009,.009,.16,12),ink);marker.name='LivingReviewMarker';marker.position.set(0,.021,0);marker.rotation.z=Math.PI/2;tray.add(marker);
  const collider={id:'living-board',min:[-1.04,.40],max:[1.04,.90]};
  root.userData.finalOffice.colliders.push(collider);root.userData.colliders=root.userData.finalOffice.colliders;
  root.getObjectByName('QualityRoom').userData.colliders=root.userData.colliders;
  Object.assign(root.userData,{modelVersion:9,environmentVersion:9,qualityStage:9,livingOffice:{version:1,baseModel:8,actors:[...root.userData.actorIds],variants:3,board:board.name,marker:marker.name,topics:strokes.children.map(n=>n.name),standSlots:[-3.2,-1.6,0,1.6,3.2].map(x=>[x,0,-.85]),maxParticipants:5}});
  root.userData.cost=modelCost(root);return model;
}
export function validateLivingOffice(gltf){
  const root=gltf.scene.getObjectByName('AfternoonStudio'),m=root?.userData;
  if(m?.modelVersion!==9||m.livingOffice?.version!==1||m.actorIds.length!==5)throw Error('생활 공간 명세 누락');
  for(const id of m.actorIds)if(!root.getObjectByName(m.ensembleOffice.cups[id].cup)?.userData.supportGrip?.contacts||root.getObjectByName(m.ensembleOffice.cups[id].cup).userData.supportGrip.contacts.length!==5)throw Error('양손 컵 지지점 누락: '+id);
  for(const name of[m.livingOffice.board,m.livingOffice.marker,...m.livingOffice.topics])if(!root.getObjectByName(name))throw Error('생활 에셋 누락: '+name);
  return m;
}
