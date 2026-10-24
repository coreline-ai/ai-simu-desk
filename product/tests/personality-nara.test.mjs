import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {profile} from '../../pilot-3d/character-personalities/nara/profile.mjs';
import {sample} from '../../pilot-3d/character-personalities/nara/motion.mjs';
import {createProps} from '../../pilot-3d/character-personalities/nara/props.mjs';
import {fixture, until} from './living-fixture.mjs';
import {part} from '../../pilot-3d/sample/character-rig.mjs';

const bounded = (value, lo, hi) => assert(Number.isFinite(value) && value >= lo - 1e-12 && value <= hi + 1e-12, `${value} must be within ${lo}..${hi}`);
const valuesFinite = value => {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(valuesFinite);
};

test('나라 프로필은 세 가지 기획 동작과 독자적인 휴식/완료 반응을 갖는다', () => {
  assert(Object.isFrozen(profile)); assert(Object.isFrozen(profile.signatures));
  assert.equal(profile.id, 'nara'); assert.equal(profile.startOffset, 0);
  bounded(profile.workDuration, 7, 12);
  assert.equal(new Set(profile.signatures).size, 3);
  assert.match(profile.label, /기획/); assert.match(profile.habit, /보드/); assert.match(profile.completion, /끄덕/);
});

test('모든 단계, 경계 및 긴 시간에서도 출력은 유한하고 공용 리그 범위를 보존한다', () => {
  const times = [-1, 0, .25, .8, 1.4, 2.25, 2.6, 2.95, 4.4, 4.75, 5.1, 5.75, 6.55, 6.8, 7.75, 8.05, 9.6, 50, 1e12, Infinity, NaN];
  for (let t = 0; t <= 10; t += .013) times.push(t);
  for (const variant of [-1, 0, 1, 2, 3, NaN]) for (const time of times) {
    for (const stage of ['use', 'idle', 'reach', 'replace', 'retract']) {
      const pose = sample({time, variant, stage}); valuesFinite(pose);
      assert(['observe', 'act', 'pause', 'check'].includes(pose.phase));
      assert(['focus', 'thinking', 'positive', 'relaxed'].includes(pose.expression));
      for (const [i, max] of [.12, .22, .08].entries()) bounded(pose.head[i], -max, max);
      for (const [i, max] of [.07, .10, .04].entries()) bounded(pose.torso[i], -max, max);
      bounded(pose.left[0], -.18, .06); bounded(pose.left[1], .79, .95); bounded(pose.left[2], .22, .40);
      assert.equal(pose.leftGrip.length, 5); pose.leftGrip.forEach(n => bounded(n, 0, 1));
      bounded(pose.propBeat, 0, 1);
      if (pose.pen) { bounded(pose.pen.x, -.025, .10); bounded(pose.pen.z, -.045, .09); bounded(pose.pen.lift, 0, .06); }
      assert.equal(pose.right, undefined, 'pen ownership remains authoritative for the right wrist');
    }
  }
});

test('세 줄 메모 / 긴 보드 사고 / 두 카드 연결은 실제 궤적과 자세가 다르다', () => {
  const memo = sample({time: 1.5, variant: 0});
  const board = sample({time: 4.5, variant: 1});
  const compareA = sample({time: 1.5, variant: 2});
  const compareB = sample({time: 4.5, variant: 2});
  assert.equal(new Set([memo.cue, board.cue, compareA.cue]).size, 3);
  assert.equal(memo.phase, 'act'); assert.equal(board.phase, 'pause'); assert.equal(compareA.phase, 'observe');
  assert(memo.head[0] - board.head[0] > .1); assert(memo.torso[0] - board.torso[0] > .08);
  assert(board.pen.lift > .05); assert(memo.pen.lift < .002);
  assert(compareB.left[0] - compareA.left[0] > .14);
  assert(compareB.head[1] - compareA.head[1] > .25);
  const lines = [1.5, 3.7, 5.8].map(time => sample({time, variant: 0}).pen.z);
  assert.equal(new Set(lines).size, 3);
  const holds = [3, 4, 5, 6].map(time => sample({time, variant: 1}));
  assert(holds.every(p => p.phase === 'pause' && p.pen.lift > .05));
  assert.equal(sample({time: 6.5, variant: 2}).phase, 'act');
  assert.equal(sample({time: 9, variant: 2}).phase, 'check');
});

test('휴식 습관과 완료 반응은 타이머나 난수 없이 결정적으로 재현된다', () => {
  const idle = sample({time: 6, stage: 'idle'}), complete = sample({time: .8, stage: 'idle', action: 'success'});
  assert.notEqual(idle.cue, complete.cue); assert.equal(idle.phase, 'pause'); assert.equal(complete.expression, 'positive');
  assert.equal(idle.pen, undefined); assert.equal(complete.pen, undefined);
  assert(complete.head[0] > .05);
  for (const time of [0, 3, 9, 1e6, NaN, Infinity]) for (const variant of [0, 1, 2]) {
    assert.deepEqual(sample({time, variant}), sample({time, variant}));
    valuesFinite(sample({time, stage: 'idle', action: 'success'}));
  }
  assert.deepEqual(sample({time: 1e9, variant: 1}), sample({time: profile.workDuration, variant: 1}));
});

test('필기 줄 변경과 접촉/해제 경계에서 펜 목표가 순간 이동하지 않는다', () => {
  for (const variant of [0, 1, 2]) for (const time of [.55, .8, 2.25, 2.6, 2.95, 4.4, 4.75, 5.1, 5.35, 5.75, 6.55, 6.8, 7.75, 7.8, 8.05, 9.6]) {
    const before = sample({time: time - 1e-6, variant}).pen;
    const after = sample({time: time + 1e-6, variant}).pen;
    for (const key of ['x', 'z', 'lift']) assert(Math.abs(before[key] - after[key]) < 1e-4, `${variant} ${time} ${key} has a discontinuity`);
  }
});

test('기획 소품은 실제 메시이며 데스크 지지·왼손 근접을 유지하고 자신의 리소스만 한 번 해제한다', () => {
  const actor = new THREE.Group(), model = new THREE.Group(), alien = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  model.add(alien);
  const deskY = .752;
  const props = createProps({actor, model, THREE, deskY});
  assert(props.root.isGroup); assert.equal(props.root.parent, null); assert.equal(model.children.length, 1);
  const nodes = []; props.root.traverse(node => { if (node.isMesh) nodes.push(node); });
  assert(nodes.length >= 10); assert(nodes.every(node => node.name.startsWith('Personality_nara_')));
  assert.equal(new Set(nodes.map(node => node.name)).size, nodes.length);
  const cards = nodes.filter(node => node.name.includes('IdeaCard_'));
  assert.equal(cards.length, 2);
  for (const card of cards) {
    bounded(card.position.x, -.18, .06); assert.equal(card.position.y, deskY + .0015); assert.equal(card.userData.reachableFrom, 'left');
    card.geometry.computeBoundingBox();
    assert(Math.abs(card.position.y + card.geometry.boundingBox.min.y - (deskY + .0005)) < 1e-9, 'card bottom sits on the supplied real desk surface');
  }
  const before = cards.map(card => card.position.toArray());
  props.update(sample({time: 7, variant: 2}));
  assert.deepEqual(cards.map(card => card.position.toArray()), before);
  assert.equal(props.root.userData.cue, 'nara-connect-two-ideas');
  props.update({propBeat: Infinity}); assert.equal(props.root.userData.propBeat, 0);
  props.update({propBeat: 99}); assert.equal(props.root.userData.propBeat, 1);
  const ownGeometries = new Set(nodes.map(node => node.geometry)), ownMaterials = new Set(nodes.map(node => node.material));
  const counts = new Map();
  for (const resource of [...ownGeometries, ...ownMaterials, alien.geometry, alien.material]) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  model.add(props.root); props.dispose(); props.dispose(); props.update({propBeat: .5});
  assert.equal(props.root.parent, null); assert.equal(props.root.children.length, 0);
  for (const resource of [...ownGeometries, ...ownMaterials]) assert.equal(counts.get(resource), 1);
  assert.equal(counts.get(alien.geometry), undefined); assert.equal(counts.get(alien.material), undefined);
  assert.equal(alien.parent, model);
  alien.geometry.dispose(); alien.material.dispose();
});

test('실제 공용 리그에서 나라 3변형을 끝까지 실행해 팔 도달 여유와 펜/손가락 접촉을 검증한다', () => {
  const f = fixture({personalMotion: true, personalities: true});
  try {
    for (const variant of [0, 1, 2]) {
      assert(f.s.startRole('nara', {variant}));
      let frames = 0, minReachMargin = 1, maxWrist = 0, maxTip = 0, maxPad = 0, maxLeft = 0;
      const phases = new Set();
      until(f, () => !f.s.desks.nara.busy, 20, () => {
        const desk = f.s.desks.nara, row = f.s.personalities.rows.get('nara');
        if (desk.stage !== 'use' || desk.time < 1) return;
        frames++; phases.add(row.sample.phase);
        assert.equal(desk.owner, 'hand');
        maxWrist = Math.max(maxWrist, desk.handError); maxTip = Math.max(maxTip, desk.tipError);
        maxPad = Math.max(maxPad, f.s.handGrips.rows.get('nara').R.error); maxLeft = Math.max(maxLeft, row.error);
        const actor = row.actor, shoulder = part(actor, 'NaraShoulderR');
        const desired = actor.localToWorld(desk.target().local.clone());
        const reach = part(actor, 'NaraElbowR').position.length() + part(actor, 'NaraHandR').position.length();
        minReachMargin = Math.min(minReachMargin, reach - shoulder.getWorldPosition(new THREE.Vector3()).distanceTo(desired));
      });
      assert(frames > 200); assert(phases.size >= 2);
      assert(minReachMargin > .01, `variant ${variant}: true arm reach margin ${minReachMargin}`);
      assert(maxWrist < .001, `variant ${variant}: wrist error ${maxWrist}`);
      assert(maxTip < .001, `variant ${variant}: actual pen tip error ${maxTip}`);
      assert(maxPad < .003, `variant ${variant}: actual finger pad error ${maxPad}`);
      assert(maxLeft < .001, `variant ${variant}: free left wrist error ${maxLeft}`);
      assert.equal(f.s.desks.nara.owner, 'desk'); assert.equal(f.s.desks.nara.events % 2, 0);
    }
    assert.equal(f.s.desks.nara.done, 3);
    assert.deepEqual([...f.s.desks.nara.variantsSeen].sort(), [0, 1, 2]);
    assert.deepEqual(f.s.violations, []);
  } finally { f.close(); }
});
