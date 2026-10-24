/** A desk-supported two-card planning map, not a second full notebook. */
export function createProps({actor, model, THREE, deskY = .74}) {
  const surfaceY = Number.isFinite(deskY) ? deskY : .74;
  const root = new THREE.Group();
  root.name = 'Personality_nara_PlanningCards';
  root.userData = {personality: 'nara', deskSupported: true, deskY: surfaceY, actor: actor?.name ?? null};
  const geometries = new Set(), materials = new Set();
  const box = (x, y, z) => { const g = new THREE.BoxGeometry(x, y, z); geometries.add(g); return g; };
  const material = (color, roughness = .88) => {
    const m = new THREE.MeshStandardMaterial({color, roughness, metalness: 0});
    materials.add(m); return m;
  };
  const ivory = material(0xf8f1dd), sage = material(0x8caa96), ink = material(0x607c73), gold = material(0xc69a5e);
  const cardGeometry = box(.075, .002, .08), textGeometry = box(.044, .0005, .002);
  const cards = [];
  const mesh = (geometry, mat, name, position) => {
    const node = new THREE.Mesh(geometry, mat);
    node.name = `Personality_nara_${name}`; node.position.set(...position);
    node.receiveShadow = true; root.add(node); return node;
  };
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -.14 : .015;
    const card = mesh(cardGeometry, ivory, `IdeaCard_${i}`, [x, surfaceY + .0015, .4]);
    card.userData = {deskSupported: true, reachableFrom: 'left', movableByPersonality: false};
    cards.push(card);
    mesh(box(.075, .0006, .012), sage, `CardHeader_${i}`, [x, surfaceY + .0028, .373]);
    for (let row = 0; row < 3; row++) mesh(textGeometry, ink, `CardLine_${i}_${row}`, [x - .002, surfaceY + .00275, .39 + row * .013]);
  }
  mesh(box(.079, .0007, .003), gold, 'Connection', [-.0625, surfaceY + .00085, .4]);
  const marker = mesh(box(.008, .0009, .007), gold, 'PriorityMarker', [-.147, surfaceY + .00295, .431]);
  // Opacity/emissive changes do not move the cards or counterfeit hand contacts.
  gold.emissive.setHex(0x8a622c); gold.emissiveIntensity = .015;
  let disposed = false;
  const update = (pose = {}) => {
    if (disposed) return;
    const beat = Number.isFinite(pose.propBeat) ? Math.min(1, Math.max(0, pose.propBeat)) : 0;
    gold.emissiveIntensity = .015 + .06 * beat;
    marker.scale.x = .8 + .2 * beat;
    root.userData.propBeat = beat;
    root.userData.cue = typeof pose.cue === 'string' ? pose.cue : '';
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    root.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
  };
  return {root, update, dispose};
}
