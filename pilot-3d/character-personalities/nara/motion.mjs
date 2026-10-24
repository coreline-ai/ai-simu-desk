import {profile} from './profile.mjs';

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const smooth = n => { const u = clamp(n); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a + (b - a) * smooth(u);
const timeOf = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const variantOf = value => Number.isFinite(value) ? ((Math.floor(value) % 3) + 3) % 3 : 0;
const restingLeft = [-.115, .803, .38];
const relaxedGrip = [.18, .14, .19, .24, .28];
const supportGrip = [.23, .13, .16, .20, .26];

function pose(cue, label, phase, fields = {}) {
  return {
    cue, label, phase, reading: false,
    left: [...restingLeft], leftGrip: [...supportGrip],
    head: [.025, .045, -.012], torso: [.025, .014, -.005],
    expression: 'focus', propBeat: 0,
    ...fields,
  };
}

function threeLines(t) {
  // Three deliberate horizontal strokes, with the tip lifted during line changes.
  // Every stroke remains over the existing right-side planning notebook.
  const windows = [[.8, 2.25, -.025], [2.95, 4.4, .004], [5.1, 6.55, .033]];
  const line = t < 2.95 ? 0 : t < 5.1 ? 1 : 2;
  const [start, end, z] = windows[line];
  const writing = t >= start && t <= end;
  const u = clamp((t - start) / (end - start));
  const done = t >= 6.55;
  let pen;
  if (t < windows[0][0]) pen = {x: -.014, z, lift: .027 * (1 - smooth((t - .55) / .25))};
  else if (writing) pen = {x: mix(-.014, .069, u), z, lift: .0008 * Math.pow(Math.sin(u * Math.PI * 6), 2)};
  else if (done) pen = {x: .069, z: windows[2][2], lift: .025 * smooth((t - 6.55) / .45)};
  else {
    const next = windows[line + 1], move = clamp((t - end) / (next[0] - end));
    pen = {x: mix(.069, -.014, move), z: mix(z, next[2], move), lift: .027 * Math.pow(Math.sin(Math.PI * move), 2)};
  }
  return pose('nara-three-line-plan', writing ? `우선순위 ${line + 1}번째 줄을 짧게 기록` : done ? '세 줄의 우선순위를 다시 확인' : '다음 줄을 쓰기 전에 생각 정리', done ? 'check' : writing ? 'act' : 'pause', {
    reading: done,
    pen,
    head: done ? [.01, -.065, .012] : [.06, .075, -.016],
    torso: done ? [.008, -.025, 0] : [.045, .025, -.012],
    expression: done ? 'thinking' : 'focus',
    propBeat: done ? 1 : (line + u) / 3,
  });
}

function boardReflection(t) {
  const lookUp = smooth((t - 1.4) / 1.2);
  const returnToNote = smooth((t - 6.8) / 1.0);
  const thinking = lookUp * (1 - returnToNote);
  const record = t >= 8.05;
  return pose('nara-board-reflection', record ? '보드에서 정리한 결론 한 줄 기록' : thinking > .7 ? '펜을 띄우고 보드의 큰 흐름을 생각' : '메모와 보드의 맥락을 연결', record ? 'act' : thinking > .7 ? 'pause' : 'observe', {
    reading: !record,
    pen: {
      x: record ? mix(.002, .055, (t - 8.05) / 1.25) : mix(.025, .002, returnToNote),
      z: mix(.012, .033, returnToNote),
      lift: record ? .001 : mix(.025 + .03 * thinking, .001, smooth((t - 7.8) / .25)),
    },
    // A long, visibly upright pause contrasts with the forward memo posture.
    head: [mix(.045, -.105, thinking), mix(.07, -.215, thinking), mix(-.012, .035, thinking)],
    torso: [mix(.03, -.052, thinking), mix(.02, -.075, thinking), .005],
    left: [mix(-.115, -.085, thinking), mix(.803, .89, thinking), mix(.38, .275, thinking)],
    leftGrip: thinking > .6 ? [.24, .34, .4, .45, .5] : [...supportGrip],
    expression: record ? 'focus' : 'thinking',
    propBeat: record ? 1 : thinking * .55,
  });
}

function connectIdeas(t) {
  // The left hand refers to two small new idea cards on its reachable side.
  // It never claims to hold or touch the existing far-right notebook.
  const rightCard = smooth((t - 2.6) / 1.0);
  const settle = smooth((t - 5.0) / .65);
  const connector = clamp((t - 5.75) / 2.0);
  const linked = t >= 7.75;
  const leftX = mix(-.14, .015, rightCard);
  const gesture = Math.sin(Math.PI * clamp((t - .45) / 4.7));
  return pose('nara-connect-two-ideas', t < 2.6 ? '첫 기획 카드를 보고 핵심 확인' : t < 5.75 ? '두 번째 카드와 공통 맥락 비교' : linked ? '연결한 우선순위의 흐름 확인' : '노트에 두 생각의 연결선 정리', t < 5.75 ? 'observe' : linked ? 'check' : 'act', {
    reading: t < 5.75 || linked,
    pen: {
      x: mix(-.014, .06, connector), z: mix(-.018, .033, connector),
      lift: t < 5.75 ? mix(.035, .001, (t - 5.35) / .4) : linked ? mix(.001, .021, (t - 7.75) / .4) : .001,
    },
    left: [mix(leftX, -.105, settle), .804 + .045 * gesture * (1 - settle), mix(.395, .38, settle)],
    leftGrip: [.19, .06, .28, .34, .42],
    head: [t < 5.75 ? .045 : .07, mix(-.18, .12, rightCard), t < 5.75 ? .028 * (1 - 2 * rightCard) : -.012],
    // Face the cards while comparing, then square the chest to the notebook
    // before touching down. The wider diagonal corner exceeded actual reach.
    torso: [.025, mix(mix(-.075, .068, rightCard), .018, settle), -.008],
    expression: linked ? 'positive' : 'thinking',
    propBeat: linked ? 1 : connector,
  });
}

export function sample({time = 0, variant = 0, stage = 'use', action = 'idle'} = {}) {
  const elapsed = timeOf(time);
  if (action === 'success') {
    const nod = Math.sin(Math.PI * clamp((elapsed - .25) / 1.05));
    const settle = smooth(elapsed / 1.8);
    return pose('nara-plan-complete', '기획 메모를 확인하고 조용히 끄덕임', 'check', {
      head: [.065 * nod, -.045, .01 * (1 - settle)],
      torso: [.016 * (1 - settle), -.018, 0],
      leftGrip: [...relaxedGrip], expression: 'positive', propBeat: 1,
    });
  }
  if (stage === 'idle') {
    const t = elapsed % 15;
    const glance = smooth((t - 3.5) / 1.5) * (1 - smooth((t - 8.5) / 1.6));
    return pose('nara-quiet-reflection', '손을 편히 두고 보드를 바라보며 생각 정리', 'pause', {
      reading: true,
      head: [-.065 * glance, -.17 * glance, .023 * glance],
      torso: [-.025 * glance, -.04 * glance, 0],
      leftGrip: [...relaxedGrip], expression: 'relaxed',
    });
  }
  if (stage !== 'use') {
    return pose('nara-prepare-note', '메모를 준비하거나 펜을 제자리에 돌려놓기', 'observe', {
      head: [.025, .045, -.008], torso: [.015, .01, 0],
      expression: 'focus',
    });
  }
  // Clamp rather than loop: a completed desk stage must not unexpectedly restart.
  const t = Math.min(elapsed, profile.workDuration);
  return [threeLines, boardReflection, connectIdeas][variantOf(variant)](t);
}
