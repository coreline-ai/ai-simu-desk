import * as T from 'three';
import {group,mesh,box,sphere,rod,tube,material} from '../sample/geometry.mjs';
import {studioMaterial} from '../sample/materials.mjs';
import {attachContactAO} from './contact-ao.mjs';
export function addZones(root){
 const room=root.getObjectByName('QualityRoom'),zones=group(room,'RoomV6Zones');
 const workShape=new T.Shape();const outline=[[-3.55,-1.52],[3.40,-1.52],[3.40,.75],[2.12,.75],[2.12,2.78],[-3.55,2.78]];outline.forEach(([x,z],i)=>i?workShape.lineTo(x,-z):workShape.moveTo(x,-z));workShape.closePath();
 const work=mesh(zones,'WorkWoolRug',new T.ShapeGeometry(workShape),studioMaterial('fabric','WorkWool',0xb4bea9),[0,.006,0]);work.rotation.x=-Math.PI/2;attachContactAO(work);
 const meeting=mesh(zones,'MeetingWovenRug',new T.CylinderGeometry(.91,.91,.005,48),studioMaterial('fabric','MeetingWool',0xb6a68d),[3.5,.004,2.45]);attachContactAO(meeting);
 const sofaRug=root.getObjectByName('WovenRug');sofaRug.position.z=-2.29;sofaRug.scale.z=.55;
 const sofa=root.getObjectByName('LinenSofa'),linen=studioMaterial('fabric','CushionOchre',0xc1a36e),ivory=studioMaterial('fabric','CushionIvory',0xe4d9bd);
 const pillow=box(sofa,'OchreLooseCushion',[.34,.34,.14],[-.62,.75,-.10],linen,.06);pillow.rotation.z=.17;pillow.rotation.x=-.10;
 const throwFold=box(sofa,'FoldedThrow',[.39,.035,.38],[.72,.58,.13],ivory,.014);throwFold.rotation.y=.13;for(let i=0;i<3;i++)rod(throwFold,'ThrowStripe'+i,[-.17,.020,-.11+i*.08],[.17,.020,-.11+i*.08],.003,linen);
 const warmMetal=studioMaterial('metal','LampChampagne',0x9c8c68),shade=material('LampShadeLinen',0xe5dcc8,.93);shade.side=T.DoubleSide;
 const lamp=group(zones,'ReadingLamp',[-.85,0,-3.02]);mesh(lamp,'LampFoot',new T.CylinderGeometry(.16,.18,.035,24),warmMetal,[0,.02,0]);rod(lamp,'LampStem',[0,.03,0],[0,1.42,0],.014,warmMetal);mesh(lamp,'LampShade',new T.CylinderGeometry(.14,.23,.23,24,1,true),shade,[0,1.42,0]);const bulb=sphere(lamp,'LampDiffuser',[.11,.025,.11],[0,1.32,0],material('LampDiffuserMat',0xffe3b3,.7));bulb.material.emissive.set(0xffc276);bulb.material.emissiveIntensity=.2;bulb.userData.timeRole='lamp';
 const wallFrame=studioMaterial('wood','ArtFrameOak',0xffffff),paper=material('ArtPaper',0xece4d3),ink=material('ArtSage',0x829477),ochre=material('ArtOchre',0xc6aa77);
 for(let i=0;i<2;i++){const art=group(zones,'WallArt'+i,[-4.71,1.65,.65+i*1.18]);art.rotation.y=Math.PI/2;box(art,'ArtFrame',[.76,.94,.035],[0,0,0],wallFrame,.012);box(art,'ArtMat',[.69,.87,.004],[0,0,.022],paper,.002);mesh(art,'ArtSun',new T.CircleGeometry(.15,32),ochre,[.11,.16,.027]);const arch=new T.Shape();arch.moveTo(-.22,-.32);arch.lineTo(-.22,-.06);arch.absarc(0,-.06,.22,Math.PI,0,true);arch.lineTo(.22,-.32);arch.closePath();if(i===1){arch.curves=[];arch.moveTo(-.28,-.30);arch.lineTo(-.28,-.1);arch.quadraticCurveTo(-.13,.12,.02,-.07);arch.quadraticCurveTo(.13,-.22,.28,.04);arch.lineTo(.28,-.30);arch.closePath();}mesh(art,'ArtArch',new T.ShapeGeometry(arch),ink,[0,-.05,.028]);}
 const shelf=root.getObjectByName('TallBookshelf'),clay=material('ShelfCeramic',0xb68167);for(let i=0;i<2;i++){shelf.getObjectByName('Book3'+i)?.removeFromParent();shelf.getObjectByName('Spine3'+i)?.removeFromParent();}for(let i=0;i<3;i++)box(shelf,'StackedBook'+i,[.24,.035,.16],[-.58,1.66+i*.04,.07],i%2?ink:ivory,.004);mesh(shelf,'ShelfVase',new T.SphereGeometry(.07,16,10),clay,[-.32,1.72,.07]);
 const trim=material('ChairStitch',0x86937b);for(const id of['Nara','Jun','Min']){const chair=root.getObjectByName(id+'SampleChair');tube(chair,id+'BackSeam',[[-.155,.54,-.102],[-.16,.75,-.118],[.16,.75,-.118],[.155,.54,-.102]],.0017,trim);}
 root.userData.zones={work:'WorkWoolRug',rest:'LinenSofa',meeting:'MeetingCorner'};root.userData.colliders.push({id:'reading-lamp',min:[-1.08,-3.25],max:[-.62,-2.79]});return zones;
}
