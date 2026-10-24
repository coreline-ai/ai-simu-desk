import {profile} from './profile.mjs';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const u = clamp(n); return u * u * (3 - 2 * u); };
const pulse = n => n > 0 && n < 1 ? Math.sin(Math.PI * n) ** 2 : 0;
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * ease(u));
const R = [.285, .855, .335], L = [-.105, .825, .335];
const RELAX = [.24, .29, .35, .42, .49];
const PINCH = [.45, .38, .40, .51, .58];
const OPEN = [.23, .14, .20, .28, .38];

function track(t, frames) {
 if (t <= frames[0][0]) return [...frames[0][1]];
 for (let i = 1; i < frames.length; i++) {
  if (t <= frames[i][0]) return mix(frames[i - 1][1], frames[i][1], (t - frames[i - 1][0]) / (frames[i][0] - frames[i - 1][0]));
 }
 return [...frames.at(-1)[1]];
}

// The right wrist still carries the one real DocumentPage4. These two exact,
// separated taps move that wrist; they never clone, re-parent or stretch paper.
function align(t) {
 const first = pulse((t - 1.1) / .75), second = pulse((t - 2.2) / .75);
 const tap = first + second;
 const watching = t >= 3.2 && t < 6.7, final = t >= 8.0;
 return {
  cue: t < 1.1 ? 'leo-measure-document-edge' : t < 3.2 ? 'leo-two-deliberate-edge-taps' : watching ? 'leo-long-alignment-check' : final ? 'leo-arranged-paper-settle' : 'leo-release-edge-tension',
  label: t < 1.1 ? '문서 가장자리의 흐트러짐 살피기' : t < 3.2 ? '가장자리를 두 번 가볍게 맞추기' : watching ? '정돈한 문서의 여백을 길게 확인' : final ? '정리한 문서를 차분히 유지' : '손에 힘을 풀고 문서 전체 확인',
  phase: t < 1.1 ? 'observe' : t < 3.2 ? 'act' : watching ? 'pause' : 'check',
  reading: watching || final,
  right: [R[0] - .012 * tap, R[1] - .018 * tap, R[2] + .006 * tap],
  left: track(t, [[0, L], [1.05, [-.075, .832, .35]], [3.2, [-.075, .832, .35]], [3.85, L], [8.0, L], [9, L]]),
  // The left hand gestures beside the stack, not false contact with the distant
  // right-side page. Actual grasp poses remain authoritative in shared code.
  rightGrip: [...PINCH], leftGrip: mix(RELAX, OPEN, ease(t / 1.05) * (1 - ease((t - 3.2) / .65))),
  head: [.035 + .027 * tap, .035 * ease((t - 3.2) / .8), .012 * (first - second)],
  torso: [.028 + .012 * tap, -.012, 0],
  expression: final ? 'positive' : 'focus', propBeat: 0,
 };
}

function read(t) {
 const arrival = ease(t / 1.35), returnToRest = ease((t - 8.8) / 1.15);
 const held = arrival * (1 - returnToRest);
 const line = ease((t - 2.3) / .5) + ease((t - 4.8) / .5) + ease((t - 7.3) / .5);
 const scan = Math.sin(Math.PI * (t - 2.8) / 2.5) * .019;
 const reading = t >= 1.35 && t < 8.8;
 return {
  cue: t < 1.35 ? 'leo-raise-one-page-to-read' : reading ? 'leo-follow-three-long-lines' : 'leo-lower-page-after-reading',
  label: t < 1.35 ? '한 장의 문서를 읽기 좋은 높이로 들기' : reading ? '긴 문장을 끝까지 읽고 다음 줄로 시선 이동' : '읽기를 마친 문서를 천천히 내리기',
  phase: t < 1.35 ? 'observe' : t < 2.3 ? 'act' : reading ? 'pause' : 'check',
  reading,
  right: [R[0] - .012 * held, R[1] + .043 * held, R[2] - .016 * held + .002 * line * held],
  left: mix(L, [-.085, .85, .32], held),
  rightGrip: [...PINCH], leftGrip: mix(RELAX, [.29, .24, .31, .39, .47], held),
  head: [-.035 * held + .014 * line * held, (scan - .018) * held, -.012 * held],
  torso: [-.018 * held, -.025 * held, 0],
  expression: reading ? 'thinking' : 'focus', propBeat: .5,
 };
}

function classify(t) {
 const compare = ease((t - 1.0) / .8) * (1 - ease((t - 5.5) / .9));
 const placing = ease((t - 6.4) / 1.2) * (1 - ease((t - 8.3) / 1.0));
 const secondTab = ease((t - 3.5) / .7);
 const lookingLeft = t >= 1.8 && t < 5.5;
 return {
  cue: t < 1.0 ? 'leo-check-document-heading' : t < 1.8 ? 'leo-approach-classification-tabs' : lookingLeft ? 'leo-compare-two-classification-tabs' : t < 6.4 ? 'leo-confirm-correct-category' : t < 8.3 ? 'leo-position-paper-over-chosen-area' : 'leo-final-category-check',
  label: t < 1.0 ? '문서의 제목과 분류 기준 읽기' : t < 1.8 ? '왼쪽 분류 탭으로 시선 옮기기' : lookingLeft ? '두 분류 탭을 대조해 알맞은 항목 찾기' : t < 6.4 ? '분류를 결정하고 문서로 시선 복귀' : t < 8.3 ? '선택한 영역으로 문서 위치 맞추기' : '분류한 결과를 마지막으로 살피기',
  phase: t < 1.0 ? 'observe' : lookingLeft ? 'pause' : t < 8.3 ? 'act' : 'check',
  reading: t < 1 || lookingLeft || t >= 8.3,
  right: [R[0] + .016 * placing, R[1] - .021 * placing, R[2] + .015 * placing],
  left: track(t, [[0, L], [1, L], [1.8, [-.145, .803, .345]], [3.5, [-.145, .803, .345]], [4.2, [-.108, .803, .345]], [5.5, [-.108, .803, .345]], [6.4, L], [10.2, L]]),
  rightGrip: [...PINCH], leftGrip: mix(RELAX, [.42, .09, .64, .69, .75], compare),
  head: [.018, -.155 * compare, -.016 * compare],
  torso: [.022 * compare, -.055 * compare, 0],
  expression: t >= 8.3 ? 'positive' : lookingLeft ? 'thinking' : 'focus',
  propBeat: .5 + .5 * secondTab,
 };
}

function idle(t) {
 const u = t % 10.4;
 const count = pulse((u - 1.1) / .85) + pulse((u - 2.3) / .85);
 const loosen = pulse((u - 4.8) / 3);
 return {
  cue: 'leo-count-then-release-fingers', label: '왼손 엄지와 검지를 가볍게 모아 정리 순서 떠올리기',
  phase: 'pause', reading: false, right: [...R], left: [...L],
  rightGrip: [...RELAX], leftGrip: [.24 + .19 * count, .29 + .19 * count, .35, .42, .49],
  head: [.012, -.045 * loosen, .008 * loosen], torso: [-.02 * loosen, 0, 0],
  expression: 'relaxed', propBeat: 0,
 };
}

function complete(t) {
 const release = ease(t / .85), satisfied = pulse((t - .85) / 1.4);
 return {
  cue: 'leo-final-inspection-and-unclench', label: '정돈된 결과를 살피고 양손의 긴장을 천천히 풀기',
  phase: 'check', reading: true,
  right: [...R], left: mix([-.085, .835, .34], L, release),
  rightGrip: mix(PINCH, RELAX, release), leftGrip: mix(PINCH, RELAX, release),
  head: [.026 * satisfied, .035, 0], torso: [-.025 * release, 0, 0],
  expression: 'positive', propBeat: 1,
 };
}

export function sample({time = 0, variant = 0, stage = 'use', action = 'idle'} = {}) {
 const elapsed = Number.isFinite(time) ? Math.max(0, time) : 0;
 if (action === 'success' || stage === 'complete' || stage === 'completion') return complete(elapsed);
 if (stage === 'idle') return idle(elapsed);
 if (stage !== 'use') return {
  cue: 'leo-safe-owned-paper-transition', label: '실제 문서의 반납과 손 회수를 안전하게 기다리기',
  phase: 'observe', reading: false, head: [0, 0, 0], torso: [0, 0, 0], expression: 'relaxed', propBeat: 0,
 };
 const t = elapsed % profile.workDuration;
 const v = Number.isFinite(variant) ? ((Math.floor(variant) % 3) + 3) % 3 : 0;
 return [align, read, classify][v](t);
}
