import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATLAS_LAYOUT } from "../src/scene-frames.mjs";
import { createSceneAnimator } from "../src/scene.mjs";

test("measured frames fit the original image and preserve opaque bounds on the shared canvas", () => {
  const png = readFileSync(new URL("../assets/coworkers-atlas-v2.png", import.meta.url));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], ATLAS_LAYOUT.imageSize);
  const evidence = JSON.parse(readFileSync(new URL("../evidence/visual-calibration-v2-frames.json", import.meta.url)));
  assert.equal(ATLAS_LAYOUT.frames.length, 4);
  ATLAS_LAYOUT.frames.forEach((row, ri) => {
    assert.equal(row.length, 4);
    row.forEach((frame, fi) => {
      const [x, y, w, h] = frame.source;
      assert.ok(x >= 0 && y >= 0 && x + w <= 1254 && y + h <= 1254);
      const [left, top, right, bottom] = evidence.coverage[ri * 4 + fi].opaqueBounds;
      const dx = ATLAS_LAYOUT.groundAnchor[0] - frame.groundAnchor[0];
      const dy = ATLAS_LAYOUT.groundAnchor[1] - frame.groundAnchor[1];
      assert.ok(left + dx >= 0 && top + dy >= 0);
      assert.ok(right + dx <= ATLAS_LAYOUT.logicalSize && bottom + dy <= ATLAS_LAYOUT.logicalSize);
      assert.equal(bottom + dy, ATLAS_LAYOUT.groundAnchor[1]);
    });
  });
});

function fixture(t) {
  const draws = [], classes = [], images = [], scheduled = new Map();
  const context = { clearRect() {}, drawImage(...args) { draws.push(args); } };
  const host = { dataset: { row: "0" }, append() {}, classList: { add(value) { classes.push(value); } } };
  const documentStub = new EventTarget();
  documentStub.hidden = false;
  documentStub.createElement = () => ({ setAttribute() {}, getContext: () => context });
  const values = {
    document: documentStub,
    Image: class { constructor() { images.push(this); } },
    requestAnimationFrame: callback => { const id = scheduled.size + 1; scheduled.set(id, callback); return id; },
    cancelAnimationFrame: id => scheduled.delete(id),
  };
  const originals = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { draws, classes, images, host, scheduled, root: { querySelectorAll: () => [host] } };
}

test("loading, a pose change at frame zero, reduced motion, and disposal keep rendering isolated", t => {
  const f = fixture(t);
  const animator = createSceneAnimator(f.root, true);
  assert.equal(f.draws.length, 0);
  f.images[0].onload();
  assert.equal(f.host.dataset.rendered, "0:0");
  assert.equal(f.scheduled.size, 0);
  const first = f.draws[0];
  assert.equal(first[3], first[7]); // Uniform source/destination size, no warp.
  assert.equal(first[4], first[8]);
  animator.refresh();
  assert.equal(f.draws.length, 1); // No redraw for an unchanged pose.
  f.host.dataset.row = "1";
  animator.refresh();
  assert.equal(f.host.dataset.rendered, "1:0");
  assert.equal(f.draws.length, 2);
  animator.setReduced(false);
  assert.equal(f.scheduled.size, 1);
  animator.setReduced(true);
  assert.equal(f.host.dataset.frame, "0");
  assert.equal(f.scheduled.size, 0);
  animator.dispose();
  assert.equal(f.images[0].onload, null);
  assert.equal(f.images[0].onerror, null);
});

test("an atlas error exposes the existing readable fallback", t => {
  const f = fixture(t);
  const animator = createSceneAnimator(f.root, true);
  f.images[0].onerror();
  assert.deepEqual(f.classes, ["sprite-missing"]);
  assert.equal(f.host.textContent, "에셋 로딩 실패");
  assert.equal(f.draws.length, 0);
  animator.dispose();
});
