import {enhanceWorkstations} from './workstations.mjs';
import {addOutdoors} from './outdoors.mjs';
import {addZones} from './zones.mjs';
import {applyRoomSurfaces} from './surfaces.mjs';
import {createOfficeV5} from '../sample/office-model.mjs';
import {optimizeRigid,modelCost} from '../sample/optimize.mjs';
import {addFloorAO} from './contact-ao.mjs';
export function createRoomV6({stage=6}={}){
 const model=createOfficeV5({optimized:false});
 addFloorAO(model.root);
 if(stage>=3)addZones(model.root);
 if(stage>=4)addOutdoors(model.root);
 if(stage>=5)enhanceWorkstations(model.root);
 if(stage>=2)model.root.userData.surfaceBudget=applyRoomSurfaces(model.root);
 Object.assign(model.root.userData,{modelVersion:6,environmentVersion:6,qualityStage:stage,source:'Original local room-quality source; shared v5 characters and 105 clips'});
 optimizeRigid(model.root,{actors:true,preserveMetadata:true});model.root.userData.cost=modelCost(model.root);return model;
}
