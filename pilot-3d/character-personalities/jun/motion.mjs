import {profile} from './profile.mjs';

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const u = clamp(n); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * ease(u));
const pulse = n => n > 0 && n < 1 ? Math.sin(n * Math.PI) ** 2 : 0;
const REST_R = [.09, .825, .34], REST_L = [-.125, .825, .325];
const KEY_R = [.058, .805, .405], KEY_L = [-.105, .807, .385];
const RELAXED = [.22, .25, .33, .40, .46];
const POINT = [.50, .035, .72, .79, .82];

// Small key travel is a fingertip action, not a whole wrist bouncing in unison.
// Adjacent fingers and the opposite hand take turns; ring/little fingers remain
// gently curved. All curls are absolute normalized values for the shared rig.
function keys(t) {
 const a = pulse((t % .50) / .21), b = pulse(((t + .25) % .50) / .21);
 const c = pulse(((t + .125) % .50) / .21), d = pulse(((t + .375) % .50) / .21);
 return {
  rightGrip: [.27, .13 + .43 * a, .15 + .40 * b, .31 + .055 * a, .40],
  leftGrip: [.29, .14 + .42 * c, .15 + .39 * d, .32 + .05 * c, .41],
  right: [KEY_R[0] + .003 * (a - b), KEY_R[1] + .0015 * (1 - a), KEY_R[2]],
  left: [KEY_L[0] + .003 * (c - d), KEY_L[1] + .0015 * (1 - c), KEY_L[2]],
 };
}

// Track wrists with smooth, deliberately slow transitions between anchors. The
// lead provides the extra transition blend between stages/variants.
function track(t, frames) {
 if (t <= frames[0][0]) return [...frames[0][1]];
 for (let i = 1; i < frames.length; i++) {
  if (t <= frames[i][0]) return mix(frames[i - 1][1], frames[i][1], (t - frames[i - 1][0]) / (frames[i][0] - frames[i - 1][0]));
 }
 return [...frames.at(-1)[1]];
}

function typingThenRead(t) {
 const typing = t >= .85 && t < 3.75 || t >= 6.45 && t < 7.75;
 const entering = ease(t / .85), leaving = ease((t - 3.75) / .55);
 const phase = t < .85 ? 'observe' : typing ? 'act' : t < 6.45 ? 'pause' : 'check';
 const pose = {
  cue: typing ? 'jun-alternating-key-burst' : t < 6.45 ? 'jun-read-with-still-hands' : 'jun-review-short-edit',
  label: typing ? '양손 검지와 중지를 번갈아 짧게 입력' : t < 6.45 ? '손을 멈추고 화면의 코드를 읽기' : '수정한 코드를 다시 확인',
  phase, reading: !typing,
  right: track(t, [[0, REST_R], [.85, KEY_R], [3.75, KEY_R], [4.3, [.073, .82, .39]], [5.9, [.073, .82, .39]], [6.45, KEY_R], [7.75, KEY_R], [8.3, REST_R]]),
  left: track(t, [[0, REST_L], [.85, KEY_L], [3.75, KEY_L], [4.3, [-.12, .815, .37]], [5.9, [-.12, .815, .37]], [6.45, KEY_L], [7.75, KEY_L], [8.3, REST_L]]),
  rightGrip: [...RELAXED], leftGrip: [...RELAXED],
  head: [typing ? .055 : -.045 * leaving, typing ? -.025 : .07 * ease((t - 4.0) / 1.0), -.008],
  torso: [typing ? .045 : .012, -.012, 0],
  expression: typing ? 'focus' : 'thinking', propBeat: typing ? .24 : .75,
 };
 if (typing) Object.assign(pose, keys(t - (t < 4 ? .85 : 6.45)));
 // At initial observation, allow wrists to arrive rather than assuming contact.
 if (t < .85) {
  pose.right = mix(REST_R, KEY_R, entering);
  pose.left = mix(REST_L, KEY_L, entering);
 }
 return pose;
}

function debugAndEdit(t) {
 const scanning = t < 1.8, scrolling = t >= 1.8 && t < 3.0;
 const thinking = t >= 3 && t < 5.9, typing = t >= 6.35 && t < 7.55;
 const scroll = scrolling ? pulse(((t - 1.8) % .62) / .30) : 0;
 const pose = {
  cue: scanning ? 'jun-mouse-scan' : scrolling ? 'jun-middle-finger-scroll' : thinking ? 'jun-debug-thought-pause' : typing ? 'jun-minimal-fix' : 'jun-debug-readback',
  label: scanning ? '마우스로 오류 위치 탐색' : scrolling ? '중지로 짧게 스크롤' : thinking ? '입력을 멈추고 오류의 원인을 생각' : typing ? '필요한 부분만 짧게 재입력' : '수정 결과를 천천히 읽기',
  phase: scanning ? 'observe' : scrolling || typing ? 'act' : thinking ? 'pause' : 'check',
  reading: !typing && !scrolling,
  right: track(t, [[0, REST_R], [.6, [.18, .805, .38]], [2.9, [.18, .805, .38]], [3.6, [.14, .895, .33]], [5.75, [.14, .895, .33]], [6.35, KEY_R], [7.55, KEY_R], [8.15, REST_R]]),
  left: track(t, [[0, REST_L], [3, [-.13, .815, .35]], [3.65, [-.14, .84, .31]], [5.75, [-.14, .84, .31]], [6.35, KEY_L], [7.55, KEY_L], [8.15, REST_L]]),
  rightGrip: thinking ? [.37, .47, .49, .58, .64] : [.34, .25, .24 + .25 * scroll, .43, .52],
  leftGrip: thinking ? [.29, .28, .36, .43, .51] : [...RELAXED],
  head: [thinking ? -.045 : -.015, thinking ? -.115 : .085, thinking ? -.045 : .008],
  torso: [thinking ? -.022 : .026, thinking ? -.045 : .035, thinking ? -.012 : 0],
  expression: thinking ? 'thinking' : 'focus', propBeat: thinking ? .52 : typing ? .28 : .08,
 };
 if (scanning) pose.right[2] += .007 * Math.sin(Math.PI * t / 1.8) ** 2;
 if (typing) Object.assign(pose, keys(t - 6.35));
 return pose;
}

function showLineAndExplain(t) {
 const pointing = t >= 1.2 && t < 6.45;
 const checkingPeer = t >= 3.25 && t < 4.65;
 const explaining = t >= 4.65 && t < 6.45;
 const turn = ease((t - 3.25) / .7) * (1 - ease((t - 6.45) / .75));
 const pose = {
  cue: t < 1.2 ? 'jun-find-code-row' : checkingPeer ? 'jun-check-peer-attention' : explaining ? 'jun-explain-one-line' : pointing ? 'jun-index-code-point' : 'jun-return-to-code',
  label: t < 1.2 ? '설명할 코드 행 찾기' : checkingPeer ? '행을 가리킨 채 동료의 시선 확인' : explaining ? '왼손을 작게 열어 코드의 흐름 설명' : pointing ? '검지로 코드 한 행 가리키기' : '설명을 마치고 화면으로 시선 복귀',
  phase: t < 1.2 ? 'observe' : checkingPeer ? 'pause' : pointing ? 'act' : 'check',
  reading: !explaining,
  right: track(t, [[0, REST_R], [1.2, [.04, .955, .395]], [6.45, [.04, .955, .395]], [7.4, REST_R]]),
  left: track(t, [[0, REST_L], [4.15, REST_L], [4.95, [-.165, .90, .315]], [5.9, [-.145, .91, .34]], [6.65, REST_L]]),
  rightGrip: mix(RELAXED, POINT, ease(t / 1.2) * (1 - ease((t - 6.45) / .75))),
  leftGrip: mix(RELAXED, [.27, .12, .17, .25, .34], ease((t - 4.15) / .8) * (1 - ease((t - 5.9) / .75))),
  head: [-.025 + .025 * turn, -.19 * turn, -.018 * turn],
  torso: [.02, -.075 * turn, 0],
  expression: explaining ? 'positive' : 'focus', propBeat: .92,
 };
 return pose;
}

function idle(t) {
 const u = t % 9, tap = pulse((u - 1.2) / .32) + pulse((u - 1.72) / .32);
 return {
  cue: 'jun-rest-two-finger-beats', label: '왼손 검지로 두 번 리듬을 짚고 편하게 쉬기',
  phase: 'pause', reading: false,
  right: [...REST_R], left: [...REST_L],
  rightGrip: [...RELAXED], leftGrip: [.22, .26 + .21 * tap, .32, .40, .47],
  head: [0, -.07 * pulse((u - 3) / 3.5), -.012],
  torso: [-.022 * pulse((u - 3) / 3.5), 0, -.008],
  expression: 'relaxed', propBeat: 0,
 };
}

function completion(t) {
 const nod = pulse((t - .70) / .95), settle = ease(t / .60);
 return {
  cue: 'jun-done-read-and-single-nod', label: '손을 떼고 결과를 읽은 뒤 작게 한 번 끄덕이기',
  phase: 'check', reading: true,
  right: mix(KEY_R, REST_R, settle), left: mix(KEY_L, REST_L, settle),
  rightGrip: [...RELAXED], leftGrip: [...RELAXED],
  head: [.07 * nod, -.035, 0], torso: [-.018 * settle, 0, 0],
  expression: 'positive', propBeat: 1,
 };
}

export function sample({time = 0, variant = 0, stage = 'use', action = 'idle'} = {}) {
 const elapsed = Number.isFinite(time) ? Math.max(0, time) : 0;
 if (action === 'success' || stage === 'complete' || stage === 'completion') return completion(elapsed);
 if (stage === 'idle') return idle(elapsed);
 // Shared reach/retract/prop ownership remain authoritative outside desk use.
 if (stage !== 'use') return {
  cue: 'jun-safe-stage-settle', label: '도구와 자세를 안전하게 정리',
  phase: 'observe', reading: false, head: [0, 0, 0], torso: [0, 0, 0],
  expression: 'relaxed', propBeat: 0,
 };
 const t = elapsed % profile.workDuration;
 const v = Number.isFinite(variant) ? ((Math.floor(variant) % 3) + 3) % 3 : 0;
 return [typingThenRead, debugAndEdit, showLineAndExplain][v](t);
}
