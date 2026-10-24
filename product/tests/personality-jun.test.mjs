import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {profile} from '../../pilot-3d/character-personalities/jun/profile.mjs';
import {sample} from '../../pilot-3d/character-personalities/jun/motion.mjs';
import {createProps} from '../../pilot-3d/character-personalities/jun/props.mjs';

const within = (n, a, b, label) => assert(Number.isFinite(n) && n >= a - 1e-12 && n <= b + 1e-12, `${label}: ${n} not in ${a}..${b}`);
function validate(pose) {
 assert(['observe', 'act', 'pause', 'check'].includes(pose.phase));
 assert(['focus', 'thinking', 'positive', 'relaxed'].includes(pose.expression));
 assert.equal(typeof pose.cue, 'string'); assert.equal(typeof pose.label, 'string');
 const walk = value => { if (typeof value === 'number') assert(Number.isFinite(value)); else if (value && typeof value === 'object') Object.values(value).forEach(walk); };
 walk(pose);
 for (const key of ['rightGrip', 'leftGrip']) if (pose[key]) { assert.equal(pose[key].length, 5); pose[key].forEach(v => within(v, 0, 1, key)); }
 for (const [key, ranges] of Object.entries({right: [[-.14, .20], [.79, 1.02], [.26, .44]], left: [[-.18, .06], [.79, .95], [.22, .40]]})) if (pose[key]) {
  assert.equal(pose[key].length, 3); pose[key].forEach((v, i) => within(v, ...ranges[i], key + i));
 }
 for (const [key, limits] of [['head', [.12, .22, .08]], ['torso', [.07, .10, .04]]]) if (pose[key]) pose[key].forEach((v, i) => within(v, -limits[i], limits[i], key + i));
 if (pose.propBeat !== undefined) within(pose.propBeat, 0, 1, 'propBeat');
}

test('Jun profile has three descriptive signatures and the frozen stagger/duration contract', () => {
 assert(Object.isFrozen(profile)); assert(Object.isFrozen(profile.signatures));
 assert.equal(profile.id, 'jun'); assert.equal(profile.startOffset, 1.6);
 within(profile.workDuration, 7, 12, 'duration');
 assert.equal(profile.signatures.length, 3); assert.equal(new Set(profile.signatures).size, 3);
 for (const text of [profile.label, profile.habit, profile.completion, ...profile.signatures]) assert(/[가-힣]/.test(text) && text.length > 10);
});

test('all Jun variants are finite, deterministic and within hand/posture bounds including hostile times', () => {
 const boundaries = [0, .85, 1.2, 1.8, 3, 3.25, 3.75, 4.15, 4.65, 5.9, 6.35, 6.45, 7.55, 7.75, 8.3, profile.workDuration];
 const times = [-100, Number.NaN, Infinity, -Infinity, 1e12, Number.MAX_VALUE, ...boundaries.flatMap(n => [n - 1e-6, n, n + 1e-6])];
 for (let i = 0; i <= 2080; i++) times.push(i * .025);
 for (const variant of [-1, 0, 1, 2, 3, Infinity, NaN]) for (const time of times) {
  const input = Object.freeze({time, variant}); const pose = sample(input);
  validate(pose); assert.deepEqual(pose, sample(input));
 }
});

test('three variants are different sequences with long held reading/thought and a peer-facing explanation', () => {
 const cues = [];
 for (let variant = 0; variant < 3; variant++) {
  const poses = Array.from({length: 104}, (_, i) => sample({time: i / 10, variant}));
  cues.push(poses.map(p => p.cue).join('|'));
  for (const phase of ['observe', 'act', 'pause', 'check']) assert(poses.some(p => p.phase === phase), variant + ': ' + phase);
 }
 assert.equal(new Set(cues).size, 3);
 const a = sample({time: 4.5, variant: 0}), b = sample({time: 5.8, variant: 0});
 assert.equal(a.phase, 'pause'); assert.equal(b.phase, 'pause');
 assert.deepEqual(a.right, b.right); assert.deepEqual(a.left, b.left); assert.deepEqual(a.rightGrip, b.rightGrip);
 assert.equal(sample({time: 4.4, variant: 1}).expression, 'thinking');
 const explain = sample({time: 5.3, variant: 2});
 assert.equal(explain.expression, 'positive'); assert(explain.head[1] < -.15); assert(explain.left[1] > .88);
 assert(explain.rightGrip[1] < .05); assert(explain.rightGrip.slice(2).every(v => v > .70));
});

test('Jun typing alternates index/middle/opposite hand rather than moving all fingers together', () => {
 const a = sample({time: 1.45, variant: 0}), b = sample({time: 1.70, variant: 0});
 assert(a.rightGrip[1] > a.rightGrip[2]); assert(b.rightGrip[2] > b.rightGrip[1]);
 assert.notEqual(a.leftGrip[1], a.rightGrip[1]);
 within(Math.abs(a.right[1] - b.right[1]), 0, .002, 'key wrist travel');
 assert(Math.abs(a.rightGrip[4] - b.rightGrip[4]) < .001, 'little finger rests during index/middle input');
});

test('use trajectories do not teleport wrists at phase boundaries and wrap to rest safely', () => {
 for (let variant = 0; variant < 3; variant++) {
  let previous = sample({time: 0, variant});
  for (let i = 1; i <= 2080; i++) {
   const pose = sample({time: i * .005, variant});
   for (const hand of ['right', 'left']) assert(Math.hypot(...pose[hand].map((v, j) => v - previous[hand][j])) < .012, `${variant} ${hand} at ${i * .005}`);
   previous = pose;
  }
 }
});

test('rest, success and non-use stages remain safe without touching shared glasses or owned props', () => {
 for (const stage of ['idle', 'reach', 'grasp', 'replace', 'release', 'retract', 'complete']) for (const time of [0, 1, 2, 10000]) validate(sample({stage, time}));
 assert.notDeepEqual(sample({stage: 'idle', time: 1.35}).leftGrip, sample({stage: 'idle', time: 3}).leftGrip);
 const success = sample({stage: 'idle', action: 'success', time: 1.1});
 assert.equal(success.expression, 'positive'); assert(success.head[0] > .04);
 for (const stage of ['reach', 'grasp', 'replace', 'release', 'retract']) {
  const pose = sample({stage, time: 1}); assert.equal(pose.right, undefined); assert.equal(pose.left, undefined); assert.equal(pose.rightGrip, undefined);
 }
});

test('Jun code card is desk-supported, unattached and cleans up only its own resources exactly once', () => {
 const actor = new T.Group(), model = new T.Group(); model.add(actor);
 const unrelated = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()); model.add(unrelated);
 let externalDisposes = 0; unrelated.geometry.addEventListener('dispose', () => externalDisposes++); unrelated.material.addEventListener('dispose', () => externalDisposes++);
 const prop = createProps({actor, model, THREE: T});
 assert(prop.root.isGroup); assert.equal(prop.root.parent, null); assert.equal(model.children.length, 2);
 const geometry = new Set(), materials = new Set();
 prop.root.traverse(n => {
  assert(n.name.startsWith('Personality_jun_'));
  if (n.isMesh) {
   geometry.add(n.geometry); materials.add(n.material); assert.equal(n.geometry.type, 'BoxGeometry');
   assert(n.geometry.attributes.position.array.every(Number.isFinite));
  }
 });
 const marker = prop.root.getObjectByName('Personality_jun_SelectedLineMarker'), baseZ = marker.position.z;
 prop.update({propBeat: 1}); assert(marker.position.z > baseZ); prop.update({propBeat: NaN}); assert.equal(marker.position.z, baseZ);
 prop.update({propBeat: 9000}); prop.update({propBeat: -1}); prop.update();
 prop.root.updateMatrixWorld(true);
 const bounds = new T.Box3().setFromObject(prop.root);
 assert(Math.abs(bounds.min.y - .7405) < 1e-9, 'card base rests on actual desk top plus .5 mm');
 within(bounds.max.y, .745, .747, 'flat card height');
 assert(bounds.getSize(new T.Vector3()).x < .16); assert(bounds.getSize(new T.Vector3()).z < .12);
 let ownDisposes = 0;
 for (const item of [...geometry, ...materials]) item.addEventListener('dispose', () => ownDisposes++);
 model.add(prop.root); prop.dispose(); prop.dispose(); prop.update({propBeat: 1});
 assert.equal(ownDisposes, geometry.size + materials.size); assert.equal(externalDisposes, 0);
 assert.equal(prop.root.parent, null); assert.equal(prop.root.children.length, 0); assert.equal(model.children.length, 2);
 unrelated.geometry.dispose(); unrelated.material.dispose();
});

test('Jun code card follows the supplied measured deskY rather than a hard-coded table estimate', () => {
 for (const deskY of [.705, .8123, .93]) {
  const prop = createProps({actor: new T.Group(), model: new T.Group(), THREE: T, deskY});
  try {
   const bounds = new T.Box3().setFromObject(prop.root);
   assert(Math.abs(bounds.min.y - deskY - .0005) < 1e-9);
   assert(bounds.max.y < deskY + .007);
   prop.update({propBeat: .7});
   const updated = new T.Box3().setFromObject(prop.root);
   assert(Math.abs(updated.min.y - deskY - .0005) < 1e-9);
  } finally { prop.dispose(); }
 }
});
