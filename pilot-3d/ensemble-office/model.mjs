import { addGroupAssets } from "./group-assets.mjs";
import { addCoffeeAssets } from "./coffee-assets.mjs";
import { addRoleDetails } from "./roles.mjs";
import { addExpressions } from "./expressions.mjs";
import { addRoomDetails } from "./room-details.mjs";
import { enhanceCups } from "./props.mjs";
import { addWardrobe } from "./wardrobe.mjs";
import { MOTION_PROFILES } from "./motion.mjs";
import * as T from "three";
import { createFinalOffice } from "../final-office/model.mjs";
import { FINAL_IDS } from "../final-office/layout.mjs";
import { group, box, rod, material } from "../sample/geometry.mjs";
import { optimizeRigid, modelCost } from "../sample/optimize.mjs";
const prefix = (id) => id[0].toUpperCase() + id.slice(1);
function pencil(mesh, color = 11901783) {
  mesh.geometry.computeBoundingBox();
  const half = Math.max(Math.abs(mesh.geometry.boundingBox.min.y), Math.abs(mesh.geometry.boundingBox.max.y));
  const points = [[0, -half], [1e-3, -half + 3e-3], [48e-4, -half + 0.019], [48e-4, half - 0.012], [52e-4, half - 0.01], [52e-4, half - 1e-3], [0, half]].map((p) => new T.Vector2(...p));
  const geometry = new T.LatheGeometry(points, 6), colors = [];
  const body = new T.Color(color), wood = new T.Color(14531979), graphite = new T.Color(4408639), cap = new T.Color(11843244);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const y = geometry.attributes.position.getY(i), c = y < -half + 4e-3 ? graphite : y < -half + 0.02 ? wood : y > half - 0.012 ? cap : body;
    colors.push(c.r, c.g, c.b);
  }
  geometry.normalizeNormals();
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  mesh.geometry = geometry;
  mesh.material = mesh.material.clone();
  mesh.material.color.set(16777215);
  mesh.material.vertexColors = true;
  mesh.material.roughness = 0.62;
  mesh.userData.ensembleProp = "pencil";
}
function notebook(root, id) {
  const pre = prefix(id), book = root.getObjectByName(pre + "PlanningNotebook");
  if (!book) return;
  const paper = material("EnsemblePaper", 16315368, 0.94), ink = new T.LineBasicMaterial({ color: 6910817 }), trim = material("EnsembleBookTrim", 10923926, 0.85);
  box(book, pre + "NotebookBinding", [9e-3, 0.026, 0.3], [-0.118, 4e-3, 0], trim, 3e-3);
  for (let i = 0; i < 3; i++) box(book, pre + "PageEdge" + i, [0.226, 1e-3, 0.292], [0, 0.012 + i * 3e-3, 0], paper, 3e-4);
  const hinge = group(book, pre + "PageHinge", [-0.114, 0.022, 0]);
  hinge.userData.ensembleMotion = "page";
  box(hinge, pre + "TurningPage", [0.228, 18e-4, 0.294], [0.114, 0, 0], paper, 5e-4);
  const strokes = group(hinge, pre + "WrittenStrokes");
  for (let i = 0; i < 6; i++) {
    const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0.026, 1e-3, -0.095 + i * 0.031), new T.Vector3(0.17 - i % 3 * 0.023, 1e-3, -0.095 + i * 0.031)]), ink);
    line.name = pre + "WrittenLine" + i;
    strokes.add(line);
    line.visible = false;
    line.userData.ensembleMotion = "ink";
    line.userData.ensembleInkIndex = i;
  }
  return { contactY: 0.774, notebook: book.name, pageHinge: hinge.name, ink: strokes.name, pencil: pre + "PlanningPencil" };
}
function optimize(root) {
  root.updateMatrixWorld(true);
  const details = group(root, "EnsembleStaticDetails"), parts = [];
  root.traverse((n) => {
    if (n.isMesh && /StoragePedestal|DrawerJoint|KeyboardKey|MonitorFoot|MonitorNeck|MonitorRearInset|Keyboard$/.test(n.name)) parts.push(n);
  });
  for (const n of parts) details.attach(n);
  const furniture = root.getObjectByName("ActivityFurniture");
  for (let i = 0; i < 6; i++) {
    const chair = furniture.getObjectByName("ActivityMeetingChair" + i);
    for (const n of [...chair.children]) {
      n.name = chair.name + "_" + n.name;
      furniture.attach(n);
    }
  }
  optimizeRigid(root, { actors: true, preserveMetadata: true });
}
export function createEnsembleOffice({ optimized = true, enhancedActors = FINAL_IDS } = {}) {
  if (!enhancedActors.length || new Set(enhancedActors).size !== enhancedActors.length || enhancedActors.some((id) => !FINAL_IDS.includes(id))) throw Error("Invalid enhanced actors");
  const model = createFinalOffice({ optimized: false }), root = model.root, roles = {}, bodies = {};
  for (const id of enhancedActors) {
    const actor = root.getObjectByName(root.userData.bindings[id].actor);
    actor.userData.ensembleAsset = 1;
    bodies[id] = addWardrobe(actor);
    bodies[id].expressions = addExpressions(actor);
    if (id === "nara") roles[id] = notebook(root, id);
    if (["nara", "sora", "min"].includes(id)) pencil(root.getObjectByName(prefix(id) + (id === "sora" ? "Stylus" : "PlanningPencil")), id === "sora" ? 6583659 : id === "min" ? 10456992 : 11901783);
  }
  addRoleDetails(root, roles, enhancedActors);
  const cups = enhanceCups(root, enhancedActors), roomDetails = addRoomDetails(root), coffee = addCoffeeAssets(root), groupMeeting = addGroupAssets(root);
  Object.assign(root.userData, { modelVersion: 8, environmentVersion: 8, qualityStage: 8, source: "Original local five-person ensemble assets; v9 baseline preserved", ensembleOffice: { version: 2, enhancedActors: [...enhancedActors], roles, bodies, cups, roomDetails, coffee, group: groupMeeting, motionProfiles: MOTION_PROFILES, catalog: [{ id: "hands", actors: [...enhancedActors], source: "procedural local source", version: 1 }, ...["body-clothing-shoes", "cups-coasters", "paper-surfaces", "five-role-props", "four-expressions", "sofa-window-details", "coffee-machine", "five-person-meeting-notes", "local-synthesized-audio"].map((id) => ({ id, actors: [...enhancedActors], source: "original local procedural geometry", version: 1 }))], maxMovers: 3, meetingParticipants: 5 } });
  if (optimized) optimize(root);
  root.userData.cost = modelCost(root);
  return model;
}
export function validateEnsembleOffice(gltf, { prototype = false } = {}) {
  const root = gltf.scene.getObjectByName("AfternoonStudio"), meta = root?.userData, e = meta?.ensembleOffice;
  if (meta?.modelVersion !== 8 || e?.version !== 2 || !prototype && FINAL_IDS.some((id) => !e.enhancedActors.includes(id))) throw Error("5\uBA85 \uBCF4\uAC15 \uC5D0\uC14B \uACC4\uC57D \uB204\uB77D");
  for (const name of ["NaraPageHinge", "NaraTurningPage", "NaraPlanningPencil", "EnsembleCoffeeButton", "EnsembleCoffeeCupDrop", "EnsembleCoffeeFlow", ...Array.from({ length: 5 }, (_, i) => "EnsembleGroupCupDrop" + i), ...Array.from({ length: 5 }, (_, i) => "GroupPencil" + i)]) if (!root.getObjectByName(name)) throw Error("\uBCF4\uAC15 \uC5D0\uC14B \uB204\uB77D: " + name);
  if (e.maxMovers !== 3 || e.meetingParticipants !== 5 || e.group.slots.length !== 5) throw Error("5\uC778 \uD65C\uB3D9 \uC815\uC6D0 \uACC4\uC57D \uB204\uB77D");
  for (const id of e.enhancedActors) {
    const actor = root.getObjectByName(meta.bindings[id].actor), mouth = root.getObjectByName(actor.userData.prefix + "ExpressionMouths");
    if (mouth?.children.length !== 4 || !e.roles[id] || !e.cups[id]) throw Error("5\uBA85 \uC5ED\uD560/\uD45C\uC815/\uCEF5 \uB204\uB77D: " + id);
  }
  return meta;
}
