import * as T from "three";
import { group, box, mesh, rod, material } from "../sample/geometry.mjs";
const pre = (id) => id[0].toUpperCase() + id.slice(1);
function lines(parent, name, paths, color) {
  const g = group(parent, name);
  for (let i = 0; i < paths.length; i++) {
    const n = new T.Line(new T.BufferGeometry().setFromPoints(paths[i].map((p) => new T.Vector3(...p))), new T.LineBasicMaterial({ color }));
    n.name = name + i;
    n.userData.ensembleMotion = name + i;
    n.visible = false;
    g.add(n);
  }
  return g;
}
export function addRoleDetails(root, roles, ids) {
  if (ids.includes("sora")) {
    const screen = root.getObjectByName("SoraTabletScreen");
    const strokes = lines(screen, "SoraSketchStrokes", Array.from({ length: 6 }, (_, i) => Array.from({ length: 18 }, (_2, j) => [-0.085 + j * 9e-3, 19e-4, -0.059 + i * 0.023 + Math.sin(j * 0.45 + i) * 8e-3])), 6454134);
    roles.sora = { contactY: 0.766, ink: strokes.name, pencil: "SoraStylus", penHomeY: 0.772 };
  }
  if (ids.includes("jun")) {
    const desk = root.getObjectByName("JunSampleDesk"), mouse = group(desk, "JunPrecisionMouse", [0.27, 0.76, -0.14]);
    const m = material("EnsembleMouse", 14278354, 0.48, 0.16);
    const body = mesh(mouse, "JunMouseShell", new T.SphereGeometry(1, 16, 12), m);
    body.scale.set(0.035, 0.02, 0.052);
    body.userData.ensembleMotion = "mouse-shell";
    rod(mouse, "JunMouseSeam", [0, 0.018, -0.035], [0, 0.02, 0.01], 8e-4, material("MouseSeam", 9081731));
    mesh(mouse, "JunScrollWheel", new T.CylinderGeometry(7e-3, 7e-3, 6e-3, 12), material("MouseWheel", 7569773), [0, 0.02, 9e-3]).rotation.z = Math.PI / 2;
    roles.jun = { mouse: mouse.name };
  }
  if (ids.includes("min")) {
    const board = root.getObjectByName("MinChecklist");
    box(board, "MinClipboardBacking", [0.246, 5e-3, 0.238], [0, -6e-3, 0], material("ClipboardSage", 10266251), 8e-3);
    box(board, "MinClipboardClip", [0.07, 6e-3, 0.023], [0, 6e-3, -0.1], material("ClipBrushedMetal", 12238769, 0.35, 0.65), 3e-3);
    const checks = [];
    for (let i = 0; i < 4; i++) {
      const check = root.getObjectByName("MinCheck" + i), g = lines(check, "MinChecked" + i, [[[-4e-3, 17e-4, 0], [-1e-3, 17e-4, 3e-3], [5e-3, 17e-4, -4e-3]]], 4545861);
      checks.push(g.name);
    }
    roles.min = { contactY: 0.762, checks, penHomeY: 0.768 };
  }
  if (ids.includes("leo")) {
    const desk = root.getObjectByName("LeoSampleDesk");
    for (const suffix of ["DocumentTray0", "DocumentTray1", "DocumentTray2", "DocumentPage0", "DocumentPage1", "DocumentPage2", "DocumentPage3"]) root.getObjectByName("Leo" + suffix)?.removeFromParent();
    const tray = group(desk, "LeoPaperDock", [0.41, 0.743, -0.09]), m = material("LeoOakTray", 13021837, 0.76);
    box(tray, "LeoPaperDockBase", [0.26, 0.01, 0.28], [0, 5e-3, 0], m, 4e-3);
    for (const x of [-0.129, 0.129]) box(tray, "LeoPaperDockSide" + x, [6e-3, 0.019, 0.28], [x, 0.013, 0], m, 2e-3);
    box(tray, "LeoPaperDockBack", [0.26, 0.019, 6e-3], [0, 0.013, 0.139], m, 2e-3);
    const label = box(root.getObjectByName("LeoArchiveFolder"), "LeoFolderTab", [0.065, 0.025, 6e-3], [0.05, 0.093, 0.016], material("FolderTab", 15788244), 3e-3);
    roles.leo = { page: "LeoDocumentPage4", dock: tray.name, pageHomeY: 0.755, supportTop: 0.753, folderTab: label.name };
  }
  if (roles.nara) roles.nara.penHomeY = 0.78;
  return roles;
}
