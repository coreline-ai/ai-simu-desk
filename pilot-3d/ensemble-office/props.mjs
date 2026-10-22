import * as T from "three";
import { box, mesh, material } from "../sample/geometry.mjs";
export function enhanceCups(root, ids) {
  const rows = {};
  for (const id of ids) {
    const pre = id[0].toUpperCase() + id.slice(1), cup = root.getObjectByName(pre + "CeramicMug"), body = root.getObjectByName(pre + "MugBody"), liquid = root.getObjectByName(pre + "Coffee");
    const points = [[0, -0.0375], [0.035, -0.0375], [0.042, 0.0355], [0.0415, 0.0375], [0.037, 0.0375], [0.031, -0.03], [0, -0.03]].map((p) => new T.Vector2(...p));
    body.geometry = new T.LatheGeometry(points, 32);
    body.geometry.normalizeNormals();
    body.userData.ensembleProp = "hollow-ceramic";
    const handle = root.getObjectByName(pre + "MugHandle");
    handle.rotation.y = 0;
    handle.position.x = .059;
    // Wrist stays outside the ceramic and the handle; fingers contact the real tube.
    cup.userData.handGrip = { offset: [.122, .012, 0], yaw: Math.PI / 2,
      contacts: [[.089,.006,.005],[.076,-.021,.006],[.086,-.006,-.006],[.080,.018,.005],[.079,.019,-.005]] };
    liquid.position.y = 0.028;
    liquid.geometry = new T.CylinderGeometry(0.0345, 0.0345, 15e-4, 32);
    const ring = mesh(cup, pre + "CupRim", new T.TorusGeometry(0.03925, 15e-4, 6, 32), body.material, [0, 0.036, 0]);
    ring.rotation.x = Math.PI / 2;
    ring.userData.ensembleDetail = "close";
    const coaster = mesh(cup.parent, pre + "LinenCoaster", new T.CylinderGeometry(0.056, 0.056, 15e-4, 32), material(pre + "Coaster", 12630689, 0.99), [-0.3, 0.74075, -0.2]);
    coaster.userData.ensembleProp = "coaster";
    cup.position.set(-0.3, 0.7795, -0.2);
    rows[id] = { cup: cup.name, body: body.name, liquid: liquid.name, coaster: coaster.name, deskTop: 0.74, coasterTop: 0.7415, baseGap: 5e-4 };
  }
  return rows;
}
export function paperBendAt(data, x, z) {
  if (!data) return 0;
  const distance = Math.hypot(x - data.x, z - data.z), u = Math.min(1, Math.max(0, (distance - data.pin) / data.span));
  return data.amount * u * u * (3 - 2 * u);
}
// The gripping zone stays flat. Only the unsupported paper edge flexes; the
// contact solver samples this same physical surface rather than its AABB top.
export class PaperSurfaces {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.rows = [];
    for (const p of scheduler.transfer.pages.values()) this.add(p.mesh, () => p.owner.startsWith("hand:") ? p.owner.slice(5) : null);
    const leo = scheduler.desks.leo;
    if (leo?.prop) this.add(leo.prop, () => leo.owner === "hand" ? "leo" : null);
  }
  add(node, owner) {
    const original = node.geometry;
    original.computeBoundingBox();
    const b = original.boundingBox, size = b.getSize(new T.Vector3()), center = b.getCenter(new T.Vector3()), g = new T.BoxGeometry(size.x, size.y, size.z, 8, 1, 10);
    g.translate(...center.toArray());
    node.geometry = g;
    node.userData.ensemblePaper = 1;
    this.rows.push({ node, owner, original, base: Float32Array.from(g.attributes.position.array), box: b.clone(), inks: node.children.filter((n) => n.isInstancedMesh).map((n) => ({ node: n, matrices: Array.from({ length: n.count }, (_, i) => {
      const m = new T.Matrix4();
      n.getMatrixAt(i, m);
      return m;
    }) })) });
  }
  apply(id, actor) {
    for (const r of this.rows) {
      const owner = r.owner();
      if (owner !== id && r.lastOwner !== id) continue;
      const h = owner ? actor.getObjectByName(actor.userData.prefix + "Hand" + (this.scheduler.transfer.active && this.scheduler.transfer.page?.mesh === r.node ? this.scheduler.transfer.sides[id] : "R")) : null;
      r.node.updateWorldMatrix(true, false);
      const p = h ? r.node.worldToLocal(h.getWorldPosition(new T.Vector3())) : new T.Vector3(), amount = owner ? 15e-4 * Math.sin(this.scheduler.time * 0.9) : 0, data = { x: p.x, z: p.z, pin: 0.04, span: 0.065, amount, top: r.box.max.y, bottom: r.box.min.y };
      r.node.userData.pageBend = data;
      const pos = r.node.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, r.base[i * 3 + 1] + paperBendAt(data, r.base[i * 3], r.base[i * 3 + 2]));
      pos.needsUpdate = true;
      r.node.geometry.computeVertexNormals();
      r.node.geometry.computeBoundingBox();
      for (const ink of r.inks) {
        for (let i = 0; i < ink.node.count; i++) {
          const m = ink.matrices[i].clone(), v = new T.Vector3().setFromMatrixPosition(m);
          m.elements[13] += paperBendAt(data, v.x, v.z);
          ink.node.setMatrixAt(i, m);
        }
        ink.node.instanceMatrix.needsUpdate = true;
      }
      r.lastOwner = owner;
    }
  }
  diagnostics() {
    return this.rows.map((r) => ({ name: r.node.name, owner: r.owner(), bend: r.node.userData.pageBend?.amount ?? 0, thickness: r.box.max.y - r.box.min.y }));
  }
  dispose() {
    for (const r of this.rows) {
      r.node.geometry.dispose();
      r.node.geometry = r.original;
      delete r.node.userData.pageBend;
      delete r.node.userData.ensemblePaper;
      for (const ink of r.inks) {
        ink.matrices.forEach((m, i) => ink.node.setMatrixAt(i, m));
        ink.node.instanceMatrix.needsUpdate = true;
      }
    }
    this.rows = [];
  }
}
