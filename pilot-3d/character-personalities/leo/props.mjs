// A small three-category sorting strip. This is not another document stack or
// tray: the existing paper remains owned, attached and returned by DeskAction.
export function createProps({actor, model, THREE: T, deskY = .74}) {
 const root = new T.Group();
 root.name = 'Personality_leo_SortingStrip';
 const geometries = new Set(), materials = new Set();
 let disposed = false;
 const material = color => { const m = new T.MeshStandardMaterial({color, roughness: .88}); materials.add(m); return m; };
 const base = material(0xd9d0b7), colors = [material(0xa7b3a1), material(0xc9b28d), material(0xb4b8c6)];
 const ink = material(0x53625c), markerMat = material(0x6d8b77);
 const surface = Number.isFinite(deskY) ? deskY : .74;
 function box(name, size, position, mat) {
  const g = new T.BoxGeometry(...size); geometries.add(g);
  const mesh = new T.Mesh(g, mat); mesh.name = 'Personality_leo_' + name;
  mesh.position.set(...position); mesh.receiveShadow = true; root.add(mesh); return mesh;
 }
 const center = [-.11, surface + .002, .42];
 box('CategoryBacking', [.13, .003, .062], center, base);
 for (let i = 0; i < 3; i++) {
  const x = center[0] + (i - 1) * .04;
  box('CategoryTab' + i, [.034, .0012, .042], [x, surface + .0041, center[2] - .002], colors[i]);
  // One, two and three short emboss-like rules remain legible without textures.
  for (let j = 0; j <= i; j++) box('CategoryRule' + i + '_' + j, [.018, .0006, .0015], [x, surface + .005, center[2] - .011 + j * .008], ink);
 }
 const marker = box('SelectedCategory', [.011, .0012, .005], [center[0] - .04, surface + .0041, center[2] + .025], markerMat);
 void actor; void model;
 return {
  root,
  update(pose = {}) {
   if (disposed) return;
   const u = Number.isFinite(pose.propBeat) ? Math.max(0, Math.min(1, pose.propBeat)) : 0;
   marker.position.x = center[0] - .04 + .08 * u;
  },
  dispose() {
   if (disposed) return;
   disposed = true; root.removeFromParent();
   for (const g of geometries) g.dispose();
   for (const m of materials) m.dispose();
   root.clear();
  },
 };
}
