import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {profile} from '../../pilot-3d/character-personalities/leo/profile.mjs';
import {sample} from '../../pilot-3d/character-personalities/leo/motion.mjs';
import {createProps} from '../../pilot-3d/character-personalities/leo/props.mjs';

const within = (n, a, b, label) => assert(Number.isFinite(n) && n >= a - 1e-12 && n <= b + 1e-12, `${label}: ${n} not in ${a}..${b}`);
function validate(pose) {
 assert(['observe', 'act', 'pause', 'check'].includes(pose.phase));
 assert(['focus', 'thinking', 'positive', 'relaxed'].includes(pose.expression));
 assert.equal(typeof pose.cue, 'string'); assert.equal(typeof pose.label, 'string');
 const walk = v => { if (typeof v === 'number') assert(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
 walk(pose);
 for (const hand of ['rightGrip', 'leftGrip']) if (pose[hand]) {
  assert.equal(pose[hand].length, 5); pose[hand].forEach(v => within(v, 0, 1, hand));
 }
 for (const [key, ranges] of Object.entries({right: [[.20, .38], [.82, .92], [.30, .44]], left: [[-.18, .06], [.79, .95], [.22, .40]]})) if (pose[key]) {
  assert.equal(pose[key].length, 3); pose[key].forEach((v, i) => within(v, ...ranges[i], key + i));
 }
 for (const [key, limits] of [['head', [.12, .22, .08]], ['torso', [.07, .10, .04]]]) if (pose[key]) {
  assert.equal(pose[key].length, 3); pose[key].forEach((v, i) => within(v, -limits[i], limits[i], key + i));
 }
 if (pose.propBeat !== undefined) within(pose.propBeat, 0, 1, 'propBeat');
}

test('Leo has frozen distinct signatures, the final stagger and a long deliberate work cycle', () => {
 assert(Object.isFrozen(profile)); assert(Object.isFrozen(profile.signatures));
 assert.equal(profile.id, 'leo'); assert.equal(profile.startOffset, 3.2);
 within(profile.workDuration, 7, 12, 'duration');
 assert.equal(profile.signatures.length, 3); assert.equal(new Set(profile.signatures).size, 3);
 for (const text of [profile.label, profile.habit, profile.completion, ...profile.signatures]) assert(/[가-힣]/.test(text) && text.length > 10);
});

test('Leo samples are deterministic and bounded at all stage boundaries, loop edges and hostile inputs', () => {
 const boundaries = [0, 1.0, 1.1, 1.35, 1.8, 2.2, 2.3, 3.2, 3.5, 4.2, 4.8, 5.5, 6.4, 6.7, 7.3, 8, 8.3, 8.8, 9.95, profile.workDuration];
 const times = [-10, NaN, Infinity, -Infinity, 1e12, Number.MAX_VALUE, ...boundaries.flatMap(t => [t - 1e-6, t, t + 1e-6])];
 for (let i = 0; i < 2250; i++) times.push(i * .02);
 for (const variant of [-1, 0, 1, 2, 3, NaN, Infinity]) for (const time of times) {
  const input = Object.freeze({time, variant}); const a = sample(input); validate(a); assert.deepEqual(a, sample(input));
 }
});

test('alignment taps twice, then deliberately holds for a long inspection', () => {
 const rest = sample({time: 1.1, variant: 0});
 const first = sample({time: 1.475, variant: 0}), second = sample({time: 2.575, variant: 0});
 assert(first.right[1] < rest.right[1] - .015); assert(second.right[1] < rest.right[1] - .015);
 assert(sample({time: 2.05, variant: 0}).right[1] > first.right[1] + .015, 'separate taps, not constant wrist tremor');
 const a = sample({time: 4.2, variant: 0}), b = sample({time: 6.5, variant: 0});
 assert.equal(a.phase, 'pause'); assert.equal(b.phase, 'pause');
 assert.deepEqual(a.right, b.right); assert.deepEqual(a.left, b.left); assert.deepEqual(a.rightGrip, b.rightGrip);
});

test('three variants have distinct phase order, longer reading and a left-side category comparison', () => {
 const traces = [];
 for (let variant = 0; variant < 3; variant++) {
  const poses = Array.from({length: 112}, (_, i) => sample({time: i / 10, variant}));
  for (const phase of ['observe', 'act', 'pause', 'check']) assert(poses.some(p => p.phase === phase), variant + ': ' + phase);
  traces.push(poses.map(p => p.cue).join('|'));
 }
 assert.equal(new Set(traces).size, 3);
 const reading = sample({time: 5, variant: 1}); assert.equal(reading.phase, 'pause'); assert(reading.reading);
 assert(reading.right[1] > .89, 'raised paper held for reading');
 const line0 = sample({time: 2.0, variant: 1}), line2 = sample({time: 6.0, variant: 1});
 assert(line2.head[0] > line0.head[0] + .02, 'gaze advances through lines rather than constant head bob');
 const tab1 = sample({time: 2.7, variant: 2}), tab2 = sample({time: 4.7, variant: 2});
 assert(tab1.left[0] < tab2.left[0] - .03); assert(tab2.head[1] < -.14);
 assert(tab2.leftGrip[1] < .10 && tab2.leftGrip[4] > .70, 'index alone indicates the category');
 assert(tab2.right[0] < sample({time: 7.8, variant: 2}).right[0] - .01);
});

test('Leo wrists move continuously through each boundary and return smoothly across work loops', () => {
 for (let variant = 0; variant < 3; variant++) {
  let previous = sample({time: 0, variant});
  for (let i = 1; i <= 2240; i++) {
   const pose = sample({time: i * .005, variant});
   for (const hand of ['right', 'left']) assert(Math.hypot(...pose[hand].map((v, j) => v - previous[hand][j])) < .004, `${variant}: ${hand} at ${i * .005}`);
   previous = pose;
  }
 }
});

test('idle fingers count gently, completion releases tension, and owned-paper transition stages do not override wrists', () => {
 for (const stage of ['idle', 'reach', 'grasp', 'replace', 'release', 'retract', 'complete']) for (const time of [0, 1, 3, 100000]) validate(sample({stage, time}));
 const habit = sample({stage: 'idle', time: 1.525});
 assert(habit.leftGrip[0] > sample({stage: 'idle', time: 4}).leftGrip[0] + .15);
 assert.equal(habit.leftGrip[4], sample({stage: 'idle', time: 4}).leftGrip[4]);
 const start = sample({stage: 'idle', action: 'success', time: 0}), done = sample({stage: 'idle', action: 'success', time: 2});
 assert.equal(done.expression, 'positive'); assert(done.rightGrip[0] < start.rightGrip[0]);
 for (const stage of ['reach', 'grasp', 'replace', 'release', 'retract']) {
  const pose = sample({stage, time: 1}); assert.equal(pose.right, undefined); assert.equal(pose.left, undefined); assert.equal(pose.rightGrip, undefined);
 }
});

test('classification strip is desk-supported and immutable to exterior scene; only owned resources dispose once', () => {
 const actor = new T.Group(), model = new T.Group(); model.add(actor);
 const external = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()); model.add(external);
 let externalDisposals = 0; external.geometry.addEventListener('dispose', () => externalDisposals++); external.material.addEventListener('dispose', () => externalDisposals++);
 const prop = createProps({actor, model, THREE: T});
 assert(prop.root.isGroup); assert.equal(prop.root.parent, null); assert.equal(model.children.length, 2);
 const geometries = new Set(), materials = new Set();
 prop.root.traverse(n => {
  assert(n.name.startsWith('Personality_leo_'));
  if (n.isMesh) { geometries.add(n.geometry); materials.add(n.material); assert.equal(n.geometry.type, 'BoxGeometry'); assert(n.geometry.attributes.position.array.every(Number.isFinite)); }
 });
 const marker = prop.root.getObjectByName('Personality_leo_SelectedCategory');
 const baseX = marker.position.x; prop.update({propBeat: 1}); assert(marker.position.x > baseX + .07);
 prop.update({propBeat: NaN}); assert.equal(marker.position.x, baseX);
 prop.update({propBeat: 1000}); prop.update({propBeat: -1}); prop.update();
 const bounds = new T.Box3().setFromObject(prop.root);
 assert(Math.abs(bounds.min.y - .7405) < 1e-9); assert(bounds.max.y < .746);
 assert(bounds.getSize(new T.Vector3()).x < .14); assert(bounds.getSize(new T.Vector3()).z < .07);
 let ownDisposals = 0; for (const item of [...geometries, ...materials]) item.addEventListener('dispose', () => ownDisposals++);
 model.add(prop.root); prop.dispose(); prop.dispose(); prop.update({propBeat: 1});
 assert.equal(ownDisposals, geometries.size + materials.size); assert.equal(externalDisposals, 0);
 assert.equal(prop.root.parent, null); assert.equal(prop.root.children.length, 0); assert.equal(model.children.length, 2);
 external.geometry.dispose(); external.material.dispose();
});

test('classification strip respects the measured surface height with no floating card assumption', () => {
 for (const deskY of [.705, .8123, .93]) {
  const prop = createProps({actor: new T.Group(), model: new T.Group(), THREE: T, deskY});
  try {
   prop.update({propBeat: .75}); const bounds = new T.Box3().setFromObject(prop.root);
   assert(Math.abs(bounds.min.y - deskY - .0005) < 1e-9); assert(bounds.max.y < deskY + .006);
  } finally { prop.dispose(); }
 }
});
