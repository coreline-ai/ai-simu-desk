import * as T from "three";
import { group, box, mesh, rod, material } from "../sample/geometry.mjs";
export function ellipseEntry(data, point, fwd) {
  const [x, , z] = data.center, [rx, rz] = data.radii, dx = point[0] - x, dz = point[2] - z, A = (fwd[0] / rx) ** 2 + (fwd[2] / rz) ** 2, B = 2 * (dx * fwd[0] / rx ** 2 + dz * fwd[2] / rz ** 2), C = (dx / rx) ** 2 + (dz / rz) ** 2 - 1, disc = B * B - 4 * A * C;
  if (disc < 0) throw Error("Table ray misses surface");
  return (-B - Math.sqrt(disc)) / (2 * A);
}
export function addGroupAssets(root) {
  const data = root.userData.finalOffice, meeting = data.meeting, [cx, , cz] = meeting.center;
  meeting.radii = [1.7, 0.75];
  const top = root.getObjectByName("MeetingTop");
  top.scale.set(1.7, 1, 0.75);
  const table = root.getObjectByName("MeetingCorner"), wood = top.material, fabric = root.getObjectByName("SofaSeatMiddle").material, paper = material("GroupNotebookPaper", 16117727, 0.95), ink = material("GroupNoteInk", 7240292, 0.9), notes = [];
  for (const child of [...table.children]) if (child.name.startsWith("MeetingLeg")) child.removeFromParent();
  for (const x of [-1.1, 1.1]) for (const z of [-0.43, 0.43]) rod(table, "EnsembleMeetingLeg" + x + z, [x, 0.7, z], [x, 0, z], 0.035, wood);
  const chairs = [{ dx: 0, front: false }, { dx: 0, front: true }, { dx: -1, front: false }, { dx: -1, front: true }, { dx: 1, front: false }, { dx: 1, front: true }].map(({ dx, front }) => {
    const edge = 0.75 * Math.sqrt(1 - (dx / 1.7) ** 2);
    return { position: [cx + dx, 0, cz + (front ? edge + 0.51 : -edge - 0.51)], facing: front ? Math.PI : 0 };
  });
  meeting.chairs = chairs;
  data.colliders = data.colliders.filter((c) => !c.id.startsWith("meeting-chair-") && c.id !== "meeting");
  data.colliders.push({ id: "meeting", center: [cx, cz], radii: [1.7, 0.75] }, ...chairs.map((c, i) => ({ id: "meeting-chair-" + i, min: [c.position[0] - 0.235, c.position[2] - 0.235], max: [c.position[0] + 0.235, c.position[2] + 0.235] })));
  root.userData.colliders = data.colliders;
  root.getObjectByName("QualityRoom").userData.colliders = data.colliders;
  for (const [i, c] of chairs.entries()) {
    const chair = root.getObjectByName("ActivityMeetingChair" + i);
    chair.clear();
    chair.position.fromArray(c.position);
    chair.rotation.y = c.facing;
    box(chair, "EnsembleSeat", [0.39, 0.095, 0.37], [0, 0.3675, 0], fabric, 0.04);
    box(chair, "EnsembleBack", [0.39, 0.34, 0.06], [0, 0.62, -0.15], fabric, 0.035);
    for (const x of [-0.16, 0.16]) for (const z of [-0.14, 0.14]) rod(chair, "EnsembleChairLeg" + x + z, [x, 0.34, z], [x, 0.02, z], 0.014, wood);
    for (const x of [-0.16, 0.16]) rod(chair, "EnsembleBackStem" + x, [x, 0.33, -0.14], [x, 0.74, -0.16], 0.012, wood);
  }
  const slots = chairs.slice(0, 5).map((c, i) => {
    const f = [Math.sin(c.facing), 0, Math.cos(c.facing)], r = [Math.cos(c.facing), 0, -Math.sin(c.facing)], p = c.position.map((n, k) => n - r[k] * 0.12), entry = ellipseEntry(meeting, p, f), cup = p.map((n, k) => n + f[k] * (entry + 0.055));
    cup[1] = 0.7795;
    const furniture = root.getObjectByName("ActivityFurniture"), drop = group(furniture, "EnsembleGroupCupDrop" + i, cup);
    drop.rotation.y = c.facing;
    drop.userData.surfaceKind = "group-meeting";
    mesh(table, "GroupCoaster" + i, new T.CylinderGeometry(0.05, 0.05, 15e-4, 24), material("GroupCoasterLinen", 13945781, 0.98), [cup[0] - cx, 0.74075, cup[2] - cz]);
    const np = c.position.map((n, k) => n + r[k] * 0.18), ne = ellipseEntry(meeting, np, f), note = group(furniture, "GroupNoteDock" + i, np.map((n, k) => n + f[k] * (ne + 0.12)));
    note.rotation.y = c.facing;
    const book = box(note, "GroupNotePage" + i, [0.16, 0.014, 0.14], [0, 0.747, 0], paper, 3e-3);
    const strokes = group(book, "GroupWritten" + i), points = [];
    for (let j = 0; j < 5; j++) for (const x of [-0.0525, 0.0525]) points.push(new T.Vector3(x, 75e-4, -0.042 + j * 0.018));
    const lines = new T.LineSegments(new T.BufferGeometry().setFromPoints(points), new T.LineBasicMaterial({ color: 7240292 }));
    lines.name = "GroupInk" + i;
    lines.visible = false;
    lines.userData.ensembleMotion = "group-ink-" + i;
    strokes.add(lines);
    const source = root.getObjectByName("NaraPlanningPencil"), pen = new T.Mesh(source.geometry, source.material);
    pen.name = "GroupPencil" + i;
    pen.position.set(0.02, 0.76, -0.012);
    pen.rotation.x = Math.PI / 2;
    pen.castShadow = true;
    pen.userData.ensembleMotion = "group-pen-" + i;
    note.add(pen);
    notes.push({ parent: note.name, page: book.name, pen: pen.name, ink: strokes.name, contactY: 0.7545 });
    return { ...c, cup, drop: drop.name, note: i };
  });
  meeting.slots = slots.slice(0, 2);
  for (let i = 0; i < 2; i++) {
    const drop = root.getObjectByName("ActivityCupDrop" + i);
    drop.position.fromArray(slots[i].cup);
    drop.rotation.y = slots[i].facing;
  }
  return { slots, notes, standOffset: 0.25, torsoForward: 0.16, torsoLean: .18, chairs: 6, participants: 5, source: "original local 5-seat meeting set; sixth chair remains free" };
}
