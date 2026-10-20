import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Original, reproducible pilot models. Metres, Y up, floor surface Y = 0.
export const DIMENSIONS = Object.freeze({ room: [7.2, 2.6, 5.6], desk: [1.4, .74, .7], chairSeat: .45, seatedHeadTop: 1.36 });
export const WORKSPACE_ORIGIN = [.35, 0, .95];
export const MODEL_VERSION = 1;
export const JUN_WORKSPACE_ORIGIN = [2.22, 0, 1.02];

export const TEAM_DIMENSIONS = Object.freeze({...DIMENSIONS,room:[9.6,2.6,7.6]});
export const TEAM_WORKSPACES = Object.freeze({nara:[-2.5,0,-.35],sora:[0,0,-.35],jun:[2.5,0,-.35],min:[-1.25,0,2.0],leo:[1.25,0,2.0]});
export function createOfficeModel({ includeJun = false, includeTeam = false, naturalMotion = false } = {}) {
  const [roomWidth,,roomDepth]=(includeTeam?TEAM_DIMENSIONS:DIMENSIONS).room;
  const back=-roomDepth/2, left=-roomWidth/2, windowWidth=roomWidth/3;
  const root = new T.Group(); root.name = "AfternoonStudio";
  root.userData = { units: "metres", up: "+Y", floorY: 0, modelVersion: MODEL_VERSION, source: "Original procedural model: pilot-3d/src/model.mjs" };
  const palette = {
    ivory: 0xe7dfcd, edge: 0xd4c2a4, wall: 0xa7b29a, trim: 0x718470,
    oak: 0xc99c69, oakLight: 0xdec09a, oakDark: 0x9d7652,
    sage: 0x899c80, terra: 0xbb7352, cream: 0xf2e8d7,
    hair: 0x493429, skin: 0xe2b48e, dark: 0x3c483b, leaf: 0x567355,
  };
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, new T.MeshStandardMaterial({ color, roughness: .84 })]));
  const material = (color, roughness = .85) => new T.MeshStandardMaterial({ color, roughness });
  function mesh(parent, name, geometry, mat, position = [0, 0, 0]) {
    const object = new T.Mesh(geometry, typeof mat === "string" ? materials[mat] : mat);
    object.name = name; object.position.fromArray(position); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(parent, name, size, position, mat, radius = .025) {
    return mesh(parent, name, new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(v => v / 3))), mat, position);
  }
  function sphere(parent, name, radius, position, mat, scale = [1, 1, 1]) {
    const object = mesh(parent, name, new T.SphereGeometry(radius, 20, 14), mat, position); object.scale.fromArray(scale); return object;
  }
  function cylinder(parent, name, r1, r2, height, position, mat, sides = 24) {
    return mesh(parent, name, new T.CylinderGeometry(r1, r2, height, sides), mat, position);
  }
  function limb(parent, name, start, end, radius, mat) {
    const a = new T.Vector3(...start), b = new T.Vector3(...end), length = a.distanceTo(b);
    const object = mesh(parent, name, new T.CapsuleGeometry(radius, Math.max(0, length - 2 * radius), 4, 12), mat);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize()); return object;
  }
  const group = (parent, name, position = [0, 0, 0]) => { const g = new T.Group(); g.name = name; g.position.fromArray(position); parent.add(g); return g; };
  const room = group(root, "Room");
  box(room, "Floor", [roomWidth, .18, roomDepth], [0, -.09, 0], "ivory", .09);
  box(room, "LeftWall", [.12, 2.6, roomDepth], [left, 1.3, 0], "wall", .055).castShadow = false;
  box(room, "WindowSillWall", [roomWidth, .68, .12], [0, .34, back], "wall").castShadow = false;
  box(room, "WindowTop", [roomWidth, .16, .12], [0, 2.52, back], "oak").castShadow = false;
  const skyMat = new T.MeshStandardMaterial({ color: 0xe4eee3, emissive: 0xc9d9c4, emissiveIntensity: .26, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const x = -windowWidth + i * windowWidth;
    box(room, `WindowGlass${i}`, [windowWidth-.14, 1.75, .025], [x, 1.56, back-.04], skyMat, .008).castShadow = false;
    box(room, `WindowPost${i}`, [.07, 1.87, .13], [x-windowWidth/2+.04, 1.57, back+.04], "oak").castShadow = false;
    box(room, `WindowCrossbar${i}`, [windowWidth-.12, .045, .1], [x, 1.5, back+.04], "oak").castShadow = false;
    // Flat distant silhouettes make the window read as daylight, without texture downloads.
    for (let j = 0; j < 4; j++) {
      const canopy = sphere(room, `DistantTree${i}_${j}`, .23 + j * .025, [x - .85 + j * .5, .98 + (j % 2) * .13, back+.01], material(0xb8c5a1), [1, 1.3, .06]);
      canopy.castShadow = false; canopy.receiveShadow = false;
    }
  }
  box(room, "WindowBottomTrim", [roomWidth, .08, .2], [0, .7, back+.04], "oakLight");
  box(room, "WindowRightPost", [.09, 1.86, .13], [includeTeam?roomWidth/2-.05:3.55, 1.57, back+.04], "oak").castShadow = false;
  // Restrained tile joints; same floor plane and world scale as the furniture.
  const seamMat = material(0xd6cfbe);
  for (let i = -2; i <= 2; i++) box(room, `FloorJointX${i}`, [.009, .001, roomDepth-.15], [i * 1.2, .0008, 0], seamMat, .0001);
  for (let i = -1; i <= 1; i++) box(room, `FloorJointZ${i}`, [roomWidth-.15, .001, .009], [0, .0008, i * 1.4], seamMat, .0001);

  const shelf = group(root, "Bookshelf", [left+.31, 0, includeTeam?-1.0:-.5]); shelf.rotation.y = Math.PI / 2;
  box(shelf, "ShelfBack", [1.65, 2.05, .06], [0, 1.08, -.14], "oakDark");
  for (const x of [-.84, .84]) box(shelf, `ShelfSide${x}`, [.065, 2.15, .36], [x, 1.075, 0], "oakLight");
  const bookColors = [0x6b7e65, 0xe1ccb0, 0xae785d, 0x7c8a86, 0xd0ac75];
  for (let row = 0; row < 4; row++) {
    const y = .16 + row * .48;
    box(shelf, `ShelfBoard${row}`, [1.7, .055, .4], [0, y, .015], "oakLight");
    for (let col = 0; col < 7; col++) {
      const height = .24 + ((row * 3 + col) % 4) * .035;
      const book = box(shelf, `Book${row}_${col}`, [.095, height, .18], [-.67 + col * .17, y + .03 + height / 2, .04], material(bookColors[(row + col) % 5]), .008);
      if (col === 6) book.rotation.z = -.1;
    }
  }
  box(shelf, "ShelfCap", [1.8, .065, .43], [0, 2.14, .015], "oak");
  const sofa = group(root, "Sofa", includeTeam?[-2.6,0,-3.0]:[-1.5,0,-1.91]);
  for (const x of [-.88, .88]) for (const z of [-.28, .28]) cylinder(sofa, `SofaFoot${x}_${z}`, .028, .024, .16, [x, .08, z], "oakDark", 10);
  box(sofa, "SofaBase", [2.1, .3, .82], [0, .28, 0], "terra", .10);
  box(sofa, "SofaBack", [2.1, .58, .19], [0, .63, -.32], "terra", .08);
  for (const x of [-.99, .99]) box(sofa, `SofaArm${x}`, [.19, .4, .86], [x, .50, 0], "terra", .08);
  for (const x of [-.48, .48]) box(sofa, `SofaSeat${x}`, [.91, .16, .66], [x, .47, .06], material(0xc5805e), .07);
  const cushion = box(sofa, "SofaCushion", [.4, .39, .12], [.52, .74, -.14], "sage", .08); cushion.rotation.z = -.12;
  const rug = cylinder(root, "Rug", .95, .95, .014, includeTeam?[-2.6,.009,-1.9]:[-1.4,.009,-.55], material(0xcdbd9d), 64); rug.scale.z = .8;
  const coffee = group(root, "CoffeeTable", includeTeam?[-2.6,0,-1.9]:[-1.4,0,-.55]);
  cylinder(coffee, "CoffeeTop", .49, .49, .065, [0, .39, 0], "cream", 48);
  for (const x of [-.25, .25]) cylinder(coffee, `CoffeeLeg${x}`, .085, .09, .36, [x, .18, 0], "ivory");
  box(coffee, "CoffeeBook", [.24, .045, .17], [-.12, .445, .03], "sage", .01);

  function chair(parent, name, position) {
    const c = group(parent, name, position);
    box(c, `${name}Seat`, [.48, .085, .47], [0, .4075, 0], "sage", .065);
    box(c, `${name}Back`, [.49, .4, .095], [0, .66, -.22], "sage", .075);
    for (const x of [-.18, .18]) for (const z of [-.17, .17]) {
      const leg = cylinder(c, `${name}Foot${x}_${z}`, .022, .025, .365, [x, .1825, z], "oak", 12);
      leg.userData.groundSupport = true;
    }
    return c;
  }
  const meeting = group(root, "MeetingTable", includeTeam?[2.35,0,-2.65]:[2.23,0,-1.53]);
  cylinder(meeting, "MeetingTop", .66, .66, .05, [0, .715, 0], "oakLight", 48);
  cylinder(meeting, "MeetingBase", .23, .28, .69, [0, .345, 0], "oak", 32);
  const meetingChair = chair(root, "MeetingChair", includeTeam?[2.65,0,-1.65]:[2.5,0,-.51]); meetingChair.rotation.y = Math.PI;
  const art = group(root, "WallArt", [left+.085,1.55,includeTeam?-2.8:-1.87]); art.rotation.y = Math.PI / 2;
  box(art, "ArtFrame", [.64, .77, .045], [0, 0, 0], "oakLight");
  box(art, "ArtPaper", [.57, .70, .01], [0, 0, .028], "cream");
  const artSun = sphere(art, "ArtSun", .17, [0, .12, .04], "terra", [1, 1, .025]); artSun.castShadow = false;
  box(art, "ArtShape", [.31, .29, .009], [-.05, -.15, .041], "sage", .08).castShadow = false;
  function plant(parent, name, position, size) {
    const p = group(parent, name, position);
    cylinder(p, `${name}Pot`, .15 * size, .12 * size, .32 * size, [0, .16 * size, 0], "cream");
    cylinder(p, `${name}Soil`, .138 * size, .138 * size, .015, [0, .32 * size, 0], material(0x68513c));
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399, reach = (.11 + (i % 3) * .06) * size, h = (.6 + (i % 4) * .09) * size;
      const end = [Math.cos(a) * reach, h, Math.sin(a) * reach];
      limb(p, `${name}Stem${i}`, [0, .3 * size, 0], end, .009 * size, "leaf");
      const leaf = sphere(p, `${name}Leaf${i}`, .13 * size, end, "leaf", [.42, 1.7, .16]);
      leaf.rotation.set(.25 * Math.sin(a), a, .5 * Math.cos(a));
    }
  }
  plant(root, "WindowPlant", includeTeam?[roomWidth/2-.53,0,back+.74]:[3.07,0,-2.06], 1.2);
  plant(root, "SofaPlant", includeTeam?[-.6,0,-3.12]:[-.14,0,-2.22], 1);
  plant(meeting, "TablePlant", [.1, .74, .02], .32);

  const workspace = group(root, "Workspace", includeTeam?TEAM_WORKSPACES.nara:WORKSPACE_ORIGIN);
  workspace.userData = { role: "nara-workspace", deskHeight: .74, chairSeatHeight: .45 };
  const desk = group(workspace, "Desk");
  box(desk, "DeskTop", [1.4, .04, .7], [0, .72, .1], "oakLight", .02);
  for (const x of [-.61, .61]) for (const z of [-.17, .37]) {
    const leg = box(desk, `DeskFoot${x}_${z}`, [.055, .7, .055], [x, .35, z], "oak", .012); leg.userData.groundSupport = true;
  }
  box(desk, "DeskApron", [1.22, .075, .04], [0, .68, -.17], "oak");
  chair(workspace, "Chair", [0, 0, -.60]);
  const laptop = group(desk, "Laptop", [-.03, .74, .03]);
  const metal = material(0xa2aaa5, .45);
  box(laptop, "LaptopBase", [.43, .025, .29], [0, .0125, 0], metal, .014);
  box(laptop, "Keyboard", [.34, .004, .14], [0, .027, .005], "dark", .005);
  const screen = group(laptop, "LaptopLid", [0, .025, .135]); screen.rotation.x = -.16;
  box(screen, "LaptopShell", [.43, .28, .018], [0, .14, 0], metal, .014);
  box(screen, "LaptopScreen", [.39, .235, .002], [0, .14, -.011], material(0x617d73, .6), .006);
  box(desk, "Notebook", [.23, .025, .28], [.44, .755, .13], "cream", .009);
  cylinder(desk, "Mug", .047, .042, .09, [-.49, .785, .23], "sage");
  const handle = mesh(desk, "MugHandle", new T.TorusGeometry(.032, .008, 8, 16), "sage", [-.435, .793, .23]); handle.rotation.y = Math.PI / 2;

  const nara = group(workspace, "Nara", [0, 0, -.60]); nara.userData = { selectable: true, agentId: "nara", rig: "hierarchical node animation; no skinning" };
  const torso = group(nara, "NaraTorso", [0, .78, 0]);
  sphere(torso, "Cardigan", 1, [0, 0, 0], "sage", [.207, .235, .135]);
  box(torso, "Shirt", [.14, .30, .035], [0, .025, .125], "cream", .025);
  for (const x of [-.1, .1]) sphere(nara, `TrouserHip${x}`, .12, [x, .50, .04], "cream", [1, .8, 1.3]);
  for (const x of [-.105, .105]) {
    limb(nara, `TrouserThigh${x}`, [x, .51, .03], [x, .48, .34], .074, "cream");
    limb(nara, `TrouserShin${x}`, [x, .48, .34], [x, .11, .40], .060, "cream");
    const shoe = box(nara, `Shoe${x}`, [.135, .105, .24], [x, .0525, .46], "cream", .045); shoe.userData.groundSupport = true;
  }
  cylinder(nara, "Neck", .063, .067, .11, [0, .99, .012], "skin", 16);
  const head = group(nara, "NaraHead", [0, 1.155, .02]);
  sphere(head, "BobBack", .18, [0, .01, -.045], "hair", [1.05, 1.13, .94]);
  sphere(head, "Face", .17, [0, -.005, .036], "skin", [.87, 1.04, .91]);
  const cap = mesh(head, "BobCrown", new T.SphereGeometry(.185, 24, 16, 0, Math.PI * 2, 0, 1.48), "hair", [0, .015, -.015]); cap.scale.z = .96;
  for (const x of [-.155, .155]) sphere(head, `BobSide${x}`, .08, [x, -.055, -.008], "hair", [.55, 1.55, 1.2]);
  const fringe = sphere(head, "BobFringe", .14, [-.034, .11, .09], "hair", [1.05, .47, .65]); fringe.rotation.z = .13;
  for (const x of [-.059, .059]) {
    sphere(head, `NaraEye${x < 0 ? "L" : "R"}`, .013, [x, .014, .181], "hair", [.8, 1.15, .55]);
    sphere(head, `NaraEyeLight${x < 0 ? "L" : "R"}`, .0038, [x - .002, .019, .188], "cream");
    box(head, `Brow${x}`, [.038, .008, .008], [x, .05, .171], "hair", .003);
    sphere(head, `Cheek${x}`, .025, [x * 1.45, -.026, .165], material(0xd99d82), [1, .6, .18]);
  }
  sphere(head, "Nose", .019, [0, -.023, .196], "skin", [.8, 1, .85]);
  const smile = new T.QuadraticBezierCurve3(new T.Vector3(-.025, -.065, .183), new T.Vector3(0, -.084, .193), new T.Vector3(.025, -.065, .183));
  mesh(head, "Smile", new T.TubeGeometry(smile, 12, .0035, 6, false), material(0x8f5e49));
  for (const [side, x] of [["L", -.18], ["R", .18]]) {
    const sign = Math.sign(x);
    limb(nara, `UpperArm${side}`, [x, .91, .01], [x + sign * .035, .78, .23], .067, "sage");
    const forearm = group(nara, `NaraForearm${side}`, [x + sign * .035, .78, .23]);
    limb(forearm, `Sleeve${side}`, [0, 0, 0], [-sign * .035, -.005, .21], .046, "sage");
    limb(forearm, `Wrist${side}`, [-sign * .035, -.005, .20], [-sign * .055, -.005, .30], .032, "skin");
    sphere(forearm, `Hand${side}`, .047, [-sign * .055, -.005, .33], "skin", [.8, .45, 1.1]);
  }
  function quaternionTrack(name, times, eulers) {
    return new T.QuaternionKeyframeTrack(`${name}.quaternion`, times, eulers.flatMap(e => new T.Quaternion().setFromEuler(new T.Euler(...e)).toArray()));
  }
  // Readable at the room camera: a quiet look-around and hand adjustment.
  // Arm X stays negative so hands lift above the keyboard instead of entering it.
  const idle = new T.AnimationClip("idle", 5.6, [
    quaternionTrack("NaraHead", [0, 1.4, 2.8, 4.2, 5.6], [[.025, -.20, -.035], [.065, .04, .025], [.025, .22, .035], [-.025, .02, -.02], [.025, -.20, -.035]]),
    quaternionTrack("NaraForearmL", [0, 1.4, 2.8, 4.2, 5.6], [[-.04, -.04, 0], [-.24, -.10, -.03], [-.09, -.04, 0], [-.04, .02, 0], [-.04, -.04, 0]]),
    quaternionTrack("NaraForearmR", [0, 1.4, 2.8, 4.2, 5.6], [[-.10, .04, 0], [-.04, -.02, 0], [-.04, .04, 0], [-.22, .10, .03], [-.10, .04, 0]]),
    new T.VectorKeyframeTrack("NaraTorso.scale", [0, 2.8, 5.6], [1, 1, 1, 1, 1.025, 1, 1, 1, 1]),
  ]);
  const typing = new T.AnimationClip("typing", .8, [
    quaternionTrack("NaraHead", [0, .4, .8], [[.09, -.035, -.015], [.14, .035, .015], [.09, -.035, -.015]]),
    quaternionTrack("NaraForearmL", [0, .2, .4, .6, .8], [[-.22, -.02, -.02], [-.015, .02, 0], [-.22, -.02, -.02], [-.015, .02, 0], [-.22, -.02, -.02]]),
    quaternionTrack("NaraForearmR", [0, .2, .4, .6, .8], [[-.015, -.02, 0], [-.22, .02, .02], [-.015, -.02, 0], [-.22, .02, .02], [-.015, -.02, 0]]),
    new T.VectorKeyframeTrack("NaraTorso.scale", [0, .4, .8], [1, 1, 1, 1, 1.015, 1, 1, 1, 1]),
  ]);
  const arms = (left, right) => [
    quaternionTrack("NaraForearmL", [0, 1.4, 2.8], left),
    quaternionTrack("NaraForearmR", [0, 1.4, 2.8], right),
  ];
  const thinking = new T.AnimationClip("thinking",2.8,[
    quaternionTrack("NaraHead",[0,1.4,2.8],[[.02,-.15,.12],[-.07,.08,.18],[.02,-.15,.12]]),
    ...arms([[-.32,-.06,-.05],[-.20,-.08,-.02],[-.32,-.06,-.05]],[[-.08,.04,0],[-.14,.08,.02],[-.08,.04,0]]),
  ]);
  const waiting = new T.AnimationClip("waiting",2.8,[
    quaternionTrack("NaraHead",[0,1.4,2.8],[[-.13,.20,-.03],[-.10,.28,.03],[-.13,.20,-.03]]),
    ...arms([[-.28,-.10,-.04],[-.23,-.06,-.02],[-.28,-.10,-.04]],[[-.28,.10,.04],[-.23,.06,.02],[-.28,.10,.04]]),
  ]);
  const success = new T.AnimationClip("success",1.4,[
    quaternionTrack("NaraHead",[0,.35,.7,1.05,1.4],[[-.08,.08,0],[.18,.08,0],[-.08,.08,0],[.12,.08,0],[.02,0,0]]),
    quaternionTrack("NaraForearmR",[0,.35,.7,1.05,1.4],[[-.05,0,0],[-.40,.12,.06],[-.32,.06,0],[-.40,.12,.06],[-.05,0,0]]),
    quaternionTrack("NaraForearmL",[0,1.4],[[-.06,0,0],[-.06,0,0]]),
  ]);
  const error = new T.AnimationClip("error",1.4,[
    quaternionTrack("NaraHead",[0,.35,.7,1.05,1.4],[[.03,0,0],[.06,-.20,.10],[.06,.20,-.10],[.06,-.12,.08],[.03,0,0]]),
    quaternionTrack("NaraForearmL",[0,.7,1.4],[[-.04,0,0],[-.18,-.04,-.02],[-.04,0,0]]),
    quaternionTrack("NaraForearmR",[0,.7,1.4],[[-.04,0,0],[-.18,.04,.02],[-.04,0,0]]),
  ]);
  const blinkTimes = [0,3.10,3.18,3.32,4.8];
  const blink = new T.AnimationClip("blink",4.8,["L","R"].flatMap(side=>[
    new T.VectorKeyframeTrack("NaraEye"+side+".scale",blinkTimes,[1,1,.06,1,1].flatMap(y=>[.8,1.15*y,.55])),
    new T.VectorKeyframeTrack("NaraEyeLight"+side+".scale",blinkTimes,[1,1,.01,1,1].flatMap(y=>[1,y,1])),
  ]));
  let animations = [idle, typing, thinking, waiting, success, error, blink];
  if (includeJun || includeTeam) {
    // Reuse metre-scale furniture and the seated rig, with unique node bindings.
    const junWorkspace = workspace.clone(true);
    junWorkspace.position.fromArray(includeTeam?TEAM_WORKSPACES.jun:JUN_WORKSPACE_ORIGIN);
    junWorkspace.userData = { ...workspace.userData, role: "jun-workspace" };
    const navy = material(0x526b7a), junHair = material(0x302c29);
    junWorkspace.traverse(node => {
      const previous = node.name;
      node.name = node === junWorkspace ? "JunWorkspace" : previous.startsWith("Nara") ? previous.replace(/^Nara/, "Jun") : `Jun${previous}`;
      if (node.userData.selectable) node.userData = { ...node.userData, agentId: "jun" };
      if (/^(Cardigan|UpperArm|Sleeve)/.test(previous)) node.material = navy;
      if (/^(Bob|Eye|Brow)/.test(previous) && !previous.startsWith("EyeLight")) node.material = junHair;
    });
    const junHead = junWorkspace.getObjectByName("JunHead");
    junHead.getObjectByName("JunBobBack").scale.y = .87;
    for (const x of [-.155, .155]) {
      const side = junHead.getObjectByName(`JunBobSide${x}`); side.scale.y = .68; side.position.y = -.015;
    }
    junHead.getObjectByName("JunBobFringe").scale.set(1.1, .33, .67);
    for (const x of [-.059, .059]) mesh(junHead, `JunGlasses${x}`, new T.TorusGeometry(.039, .004, 8, 24), "dark", [x, .014, .199]);
    box(junHead, "JunGlassesBridge", [.039, .007, .007], [0, .018, .199], "dark", .002);
    root.add(junWorkspace);
    root.userData.modelVersion = 2;
    root.userData.workspaces = { nara: WORKSPACE_ORIGIN, jun: JUN_WORKSPACE_ORIGIN };
    animations = ["nara", "jun"].flatMap(id => [idle, typing, thinking, waiting, success, error, blink].map(original => {
      const clip = original.clone(); clip.name = `${id}_${original.name}`;
      if (id === "jun") for (const track of clip.tracks) track.name = track.name.replace(/^Nara/, "Jun");
      return clip;
    }));
  }
  if(includeTeam){
    const clips=[idle,typing,thinking,waiting,success,error,blink];
    if(naturalMotion){
      const restL=[-.08,-.02,0],restR=[-.08,.02,0];
      const make=(name,duration,times,head,left,right)=>new T.AnimationClip(name,duration,[quaternionTrack('NaraHead',times,head),quaternionTrack('NaraForearmL',times,left),quaternionTrack('NaraForearmR',times,right)]);
      clips.push(
        make('preparing',3.6,[0,1.2,2.4,3.6],[[.10,.16,0],[.16,.24,.03],[.08,-.10,0],[.10,.16,0]],[restL,[-.12,-.04,0],restL,restL],[restR,[-.18,.04,.02],[-.10,.06,0],restR]),
        make('reviewing',3,[0,1,2,3],[[.02,-.10,0],[.12,-.08,.025],[-.04,.10,0],[.02,-.10,0]],[restL,restL,[-.15,-.04,0],restL],[restR,[-.14,.05,0],restR,restR]),
        make('sending',.9,[0,.3,.6,.9],[[.02,0,0],[.04,0,0],[.02,0,0],[.02,0,0]],[restL,restL,restL,restL],[restR,[-.38,.12,.06],[-.30,.08,.04],restR]),
        make('receiving',.9,[0,.3,.6,.9],[[.02,0,0],[.16,0,0],[-.04,0,0],[.02,0,0]],[restL,restL,restL,restL],[restR,[-.16,.04,0],restR,restR]),
        make('acknowledge',.9,[0,.3,.6,.9],[[.02,0,0],[.14,0,0],[-.03,0,0],[.02,0,0]],[restL,restL,restL,restL],[restR,restR,restR,restR])
      );
      const times=Array.from({length:13},(_,i)=>i*.2).concat([2.8,3.2]);
      const typingNatural=make('typing',3.2,times,times.map((_,i)=>[.10+(i%2)*.025,(i%2?1:-1)*.025,0]),times.map((_,i)=>i===13?restL:[i%2?-.04:-.20,-.02,0]),times.map((_,i)=>i===13?restR:[i%2?-.20:-.04,.02,0]));
      clips[1]=typingNatural;
    }
    for(const [id,prefix,color,hair] of [['sora','Sora',0xba8c77,0x644339],['min','Min',0x91809e,0x2c292b],['leo','Leo',0xc39a58,0x6c4f31]]){
      const station=workspace.clone(true);station.position.fromArray(TEAM_WORKSPACES[id]);
      station.userData={...workspace.userData,role:id+'-workspace'};
      const outfit=material(color),hairMat=material(hair);
      station.traverse(node=>{const previous=node.name;node.name=node===station?prefix+'Workspace':previous.startsWith('Nara')?previous.replace(/^Nara/,prefix):prefix+previous;
        if(node.userData.selectable)node.userData={...node.userData,agentId:id};
        if(/^(Cardigan|UpperArm|Sleeve)/.test(previous))node.material=outfit;
        if(/^(Bob|Brow)/.test(previous))node.material=hairMat;
      });
      const head=station.getObjectByName(prefix+'Head');
      if(id==='sora'){sphere(head,prefix+'HairBun',.105,[.15,.08,-.11],hairMat,[.85,1,1]);}
      else {head.getObjectByName(prefix+'BobBack').scale.y=.8;for(const x of [-.155,.155]){const side=head.getObjectByName(prefix+'BobSide'+x);side.scale.y=.55;side.position.y=.005;}head.getObjectByName(prefix+'BobFringe').scale.y=.31;}
      if(id==='min'){for(const x of [-.059,.059])mesh(head,prefix+'Glasses'+x,new T.TorusGeometry(.038,.004,8,20),'dark',[x,.014,.199]);box(head,prefix+'Bridge',[.039,.007,.007],[0,.018,.199],'dark',.002);}
      root.add(station);
      animations.push(...clips.map(original=>{const clip=original.clone();clip.name=id+'_'+original.name;for(const track of clip.tracks)track.name=track.name.replace(/^Nara/,prefix);return clip;}));
    }
    if(naturalMotion){
      animations=['nara','jun','sora','min','leo'].flatMap(id=>clips.map(original=>{const clip=original.clone();clip.name=id+'_'+original.name;for(const track of clip.tracks)track.name=track.name.replace(/^Nara/,id[0].toUpperCase()+id.slice(1));return clip;}));
      root.userData.naturalMotion=true;
    }
    root.userData.modelVersion=naturalMotion?4:3;root.userData.workspaces=TEAM_WORKSPACES;root.userData.dimensions=TEAM_DIMENSIONS;
    root.userData.teamOrder=['nara','sora','jun','min','leo'];
  }
  root.updateMatrixWorld(true);
  return { root, animations };
}
