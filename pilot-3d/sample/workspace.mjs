import * as T from'three';
import{studioMaterial}from'./materials.mjs';
import{group,material,mesh,box,sphere,rod,tube}from'./geometry.mjs';
export function addWorkspace(root,{room=true}={}){
 const oak=studioMaterial('wood','Natural_Oak',0xffffff);oak.userData.textureKind='oak';
 const stone=studioMaterial('stone','Warm_Terrazzo',0xffffff);stone.userData.textureKind='stone';
 const fabric=studioMaterial('fabric','Chair_Boucle',0xb2bda0);fabric.userData.textureKind='fabric';
 const wall=material('Sage_Plaster',0xa8b39a,.97),trim=material('Sage_Trim',0x78896d),cream=material('Warm_Enamel',0xf5eadd,.7),metal=material('Brushed_Brass',0xa8834b,.36,.72),dark=material('Graphite',0x454c43,.56),paper=material('Paper',0xf5ebd7),terra=material('Clay',0xba7455,.94);
 if(room){const floor=box(root,'TerrazzoFloor',[3.85,.12,3.45],[-.55,-.06,-.30],stone,.065);
 // Planar UVs at a fixed world scale: grain repeats follow the long grain, not per-face stretching.
 const uv=floor.geometry.attributes.uv,pos=floor.geometry.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)*1.2,pos.getZ(i)*1.2);uv.needsUpdate=true;
 box(root,'BackWall',[3.85,.68,.11],[-.55,.34,-1.97],wall);
 box(root,'Skirting',[3.78,.075,.035],[-.55,.045,-1.902],trim,.006);
 box(root,'WindowSill',[3.85,.065,.21],[-.55,.71,-1.91],oak,.018);
 const sky=material('Soft_Daylight',0xe4eddb,1);sky.emissive=new T.Color(0xa8b995);sky.emissiveIntensity=.23;
 for(let i=0;i<3;i++){
  const x=-1.78+i*1.23;const glass=box(root,'WindowPane'+i,[1.13,1.43,.025],[x,1.46,-2.0],sky,.003);glass.castShadow=false;
  box(root,'WindowMullion'+i,[.047,1.51,.10],[x-.59,1.46,-1.93],oak,.007);
  box(root,'WindowTransom'+i,[1.16,.032,.08],[x,1.31,-1.93],oak,.004);
  for(let j=0;j<4;j++){const tree=sphere(root,'DistantCanopy'+i+j,[.24,.29+(j%2)*.08,.015],[x-.40+j*.27,.90+(j%2)*.09,-1.978],material('DistantLeaves'+i+j,[0xb3bfa0,0xc5ccad,0x9fac8e][j%3],1));tree.castShadow=false;}
 }
 box(root,'WindowRightFrame',[.05,1.51,.10],[1.32,1.46,-1.93],oak,.007);box(root,'WindowLintel',[3.85,.07,.12],[-.55,2.22,-1.93],oak,.012);
 }
 // Desk is the exact previous 1.40 × .74 × .70m envelope.
 const desk=group(root,'SampleDesk');box(desk,'OakDeskTop',[1.4,.045,.7],[0,.7175,.10],oak,.018);
 for(const x of[-.61,.61])for(const z of[-.17,.37]){const leg=box(desk,'TaperedLeg'+x+z,[.048,.685,.048],[x,.3425,z],oak,.009);leg.rotation.z=-x*.025;box(desk,'BrassFoot'+x+z,[.050,.022,.050],[x,.011,z],metal,.005);}
 for(const x of[-.59,.59])box(desk,'DeskApron'+x,[.026,.085,.49],[x,.666,.1],oak,.005);
 box(desk,'DeskDrawer',[.43,.06,.39],[.40,.674,.11],oak,.008);rod(desk,'DrawerPull',[.32,.669,.32],[.47,.669,.32],.006,metal);
 const mat=material('Wool_DeskMat',0x8f9f87,.97);mat.userData.textureKind='linen';box(desk,'DeskMat',[.66,.006,.41],[-.1,.744,.04],mat,.023);
 const laptop=group(desk,'SampleLaptop',[-.03,.75,.035]);box(laptop,'AluminiumBase',[.43,.018,.29],[0,.009,0],material('Laptop_Aluminium',0xb5b9ac,.4,.58),.009);
 for(let row=0;row<4;row++)for(let col=0;col<11;col++)box(laptop,'Key'+row+'_'+col,[.025,.003,.018],[-.15+col*.03,.021,-.005+row*.023],dark,.003);
 box(laptop,'Trackpad',[.13,.002,.048],[0,.021,-.089],cream,.004);
 const lid=group(laptop,'LaptopLid',[0,.018,.137]);lid.rotation.x=-.16;box(lid,'LidFrame',[.43,.275,.018],[0,.137,0],material('Laptop_Lid',0xb4b9a7,.44,.5),.009);
 const screenMat=material('Screen',0xd7e4cf,.55);screenMat.emissive=new T.Color(0xb8c7ac);screenMat.emissiveIntensity=.12;box(lid,'Screen',[.385,.226,.003],[0,.144,-.011],screenMat,.004);
 for(let i=0;i<5;i++)box(lid,'DocumentLine'+i,[.22-(i%2)*.06,.006,.002],[-.036,.205-i*.026,-.014],material('Screen_Ink',0x8d9d87),.001);
 box(lid,'CameraDot',[.007,.007,.002],[0,.264,-.011],dark,.002);
 const notebook=group(desk,'PlanningNotebook',[.45,.751,.08]);notebook.rotation.y=-.10;box(notebook,'BookCover',[.25,.025,.32],[0,0,0],terra,.008);box(notebook,'NotebookPages',[.232,.012,.30],[0,.015,0],paper,.004);
 for(let j=0;j<8;j++)rod(notebook,'NoteLine'+j,[-.072,.022,-.10+j*.027],[.082,.022,-.10+j*.027],.0012,material('Notebook_Ink',0xc7be9f));
 for(let j=0;j<8;j++)sphere(notebook,'NotebookRing'+j,[.006,.010,.006],[-.12,.015,-.11+j*.032],metal);
 rod(desk,'PlanningPencil',[.61,.773,.27],[.60,.773,.03],.005,material('PencilOchre',0xb19a56));
 const mug=group(desk,'CeramicMug',[-.49,.785,.23]);mesh(mug,'MugBody',new T.CylinderGeometry(.042,.035,.075,32),cream);mesh(mug,'Coffee',new T.CylinderGeometry(.035,.035,.002,32),material('Coffee',0x503b26),[0,.032,0]);const handle=mesh(mug,'MugHandle',new T.TorusGeometry(.027,.007,10,24),cream,[.044,0,0]);handle.rotation.y=Math.PI/2;
 // One arm-free chair; park it behind the clearance lane while the actor stands.
 const chair=group(root,'SampleChair',[0,0,-.6]);box(chair,'ChairCushion',[.39,.095,.37],[0,.4025,0],fabric,.046);box(chair,'ChairUnderframe',[.34,.035,.32],[0,.344,0],oak,.012);
 const back=box(chair,'ChairBack',[.39,.38,.072],[0,.665,-.145],fabric,.048);back.rotation.x=-.08;
 for(const x of[-.16,.16])rod(chair,'ChairBackSupport'+x,[x,.36,-.12],[x,.76,-.17],.014,oak);
 for(const x of[-.15,.15])for(const z of[-.12,.12]){rod(chair,'ChairLeg'+x+z,[x,.35,z],[x*1.15,.025,z*1.4],.016,oak);sphere(chair,'FeltPad'+x+z,[.020,.008,.020],[x*1.15,.008,z*1.4],dark);}
 tube(chair,'CushionSeam',[[-.15,.431,-.135],[-.178,.431,0],[-.15,.431,.135],[.15,.431,.135],[.178,.431,0],[.15,.431,-.135]],.0025,trim);
 // Low shelf stays outside the tested lateral walk corridor (z -.48).
 if(room){const shelf=group(root,'WindowSideShelf',[-1.72,0,-1.57]);box(shelf,'ShelfBody',[.55,.63,.43],[0,.36,0],oak,.015);
 box(shelf,'ShelfOpen',[.46,.38,.035],[0,.40,.231],dark,.006);
 for(let i=0;i<6;i++){const book=box(shelf,'Book'+i,[.045,.20+(i%3)*.025,.13],[-.17+i*.060,.32,.24],material('BookColor'+i,[0xc0ac89,0x849278,0xb68368][i%3]),.005);if(i===5)book.rotation.z=-.15;rod(book,'SpineMark'+i,[-.013,.04,.068],[.013,.04,.068],.0018,paper);}
 box(shelf,'ShelfTop',[.61,.035,.47],[0,.695,0],oak,.01);
 const pot=group(root,'WindowPlant',[-1.72,.727,-1.57]);mesh(pot,'ClayPot',new T.CylinderGeometry(.10,.075,.17,32),terra,[0,.085,0]);mesh(pot,'PotSoil',new T.CylinderGeometry(.089,.089,.01,24),material('Soil',0x4a4233),[0,.173,0]);
 for(let i=0;i<11;i++){
  const angle=i*2.399,height=.20+(i%4)*.07,end=[Math.cos(angle)*.12,height+.16,Math.sin(angle)*.12];tube(pot,'LeafStem'+i,[[0,.16,0],[end[0]*.4,height*.8,end[2]*.4],end],.0035,trim);
  const leaf=sphere(pot,'Leaf'+i,[.047,.095,.009],end,material('LeafTone'+i,[0x687e53,0x8f9d68,0x536f4e][i%3],.8));leaf.rotation.set(Math.sin(angle)*.5,angle,Math.cos(angle)*.55);
 }
 // Ceramic wall peg and framed sketch; all outside standing/arm bounds.
 const sketch=group(root,'IdeaFrame',[.91,1.46,-1.89]);box(sketch,'Frame',[.34,.40,.025],[0,0,0],oak,.005);box(sketch,'SketchPaper',[.29,.35,.004],[0,0,.015],paper,.002);
 for(let j=0;j<4;j++)rod(sketch,'SketchLine'+j,[-.08,-.10+j*.07,.019],[.07,-.10+j*.07,.019],.002,trim);
 }
 root.userData.environment='window-workstation-quality-sample';root.userData.materialKinds=['wood','fabric','metal','plastic','glass-like opaque daylight','stone','leaf'];
 return {chair,desk};
}
