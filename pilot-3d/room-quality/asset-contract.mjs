import {validateOfficeAsset} from '../sample/asset-contract.mjs';
export function validateRoomAsset(gltf){
 const meta=validateOfficeAsset(gltf);if(meta.modelVersion!==6||meta.environmentVersion!==6||meta.qualityStage<5)throw Error('실내 품질 버전이 일치하지 않습니다.');
 for(const name of['RoomFloor','WorkWoolRug','LayeredOutdoors','SkyBackdrop','ReadingLamp'])if(!gltf.scene.getObjectByName(name))throw Error('필수 공간 요소 누락: '+name);
 let portals=0;const roles=new Set();gltf.scene.traverse(node=>{if(node.userData.windowPortal)portals++;for(const mat of[node.material].flat().filter(Boolean))if(mat.userData.roomScreen)roles.add(mat.userData.roomScreen);});if(portals!==4||roles.size!==5)throw Error('창 또는 업무 화면 바인딩 누락');return meta;
}
