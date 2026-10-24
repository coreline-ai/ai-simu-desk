// A small desk-supported code-reading card, not a second screen or notebook.
// The root is deliberately unattached: the lead anchors it once at Jun's desk.
export function createProps({actor, model, THREE: T, deskY = .74}) {
 const root = new T.Group();
 root.name = 'Personality_jun_CodeReadingCard';
 const geometries = new Set(), materials = new Set();
 const material = color => {
  const m = new T.MeshStandardMaterial({color, roughness: .86});
  materials.add(m); return m;
 };
 const paper = material(0xe6dfc8), ink = material(0x4b6565);
 const syntax = material(0xb58b56), gutter = material(0x91a8a0);
 const active = material(0x739989);
 let disposed = false;
 function box(name, size, position, mat) {
  const g = new T.BoxGeometry(...size); geometries.add(g);
  const mesh = new T.Mesh(g, mat); mesh.name = 'Personality_jun_' + name;
  mesh.position.set(...position); mesh.receiveShadow = true;
  root.add(mesh); return mesh;
 }
 const surface = Number.isFinite(deskY) ? deskY : .74;
 const center = [-.155, surface + .0025, .525];
 box('SmallCodeCard', [.146, .004, .104], center, paper);
 box('CodeCardGutter', [.002, .001, .081], [center[0] - .050, surface + .0053, center[2]], gutter);
 const rows = [
  {z: -.032, x: -.022, length: .035, mat: syntax},
  {z: -.012, x: -.013, length: .050, mat: ink},
  {z: .008, x: -.005, length: .041, mat: ink},
  {z: .028, x: -.022, length: .023, mat: syntax},
 ];
 rows.forEach((row, i) => {
  box('CodeLine' + i, [row.length, .0012, .003], [center[0] + row.x, surface + .0055, center[2] + row.z], row.mat);
  if (i === 1 || i === 2) box('CodeValue' + i, [.012, .0012, .003], [center[0] + row.x + row.length * .5 + .009, surface + .0055, center[2] + row.z], syntax);
 });
 const marker = box('SelectedLineMarker', [.007, .0014, .010], [center[0] - .060, surface + .0055, center[2] - .032], active);
 // Actor/model are accepted for the common API but deliberately not attached,
 // traversed or mutated. Held props and actor life-cycle belong to the lead.
 void actor; void model;
 return {
  root,
  update(pose = {}) {
   if (disposed) return;
   const beat = Number.isFinite(pose.propBeat) ? Math.max(0, Math.min(1, pose.propBeat)) : 0;
   marker.position.z = center[2] - .032 + .060 * beat;
  },
  dispose() {
   if (disposed) return;
   disposed = true;
   root.removeFromParent();
   for (const g of geometries) g.dispose();
   for (const m of materials) m.dispose();
   root.clear();
  },
 };
}
