import { ATLAS_LAYOUT, COWORKER_ATLAS_URL } from "./scene-frames.mjs";

// Rendering only: frame crops share a measured ground anchor. No run changes here.
export function createSceneAnimator(root, initiallyReduced = false) {
  const sprites = [...root.querySelectorAll("[data-sprite]")].map(host => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ATLAS_LAYOUT.logicalSize;
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    return { host, canvas, context: canvas.getContext("2d"), lastKey: "" };
  });
  const events = new AbortController();
  const atlas = new Image();
  let ready = false;
  let reduced = initiallyReduced;
  let frameRequest = 0;
  let disposed = false;
  function paint(now = 0) {
    for (const sprite of sprites) {
      const row = Number(sprite.host.dataset.row ?? 0);
      const frame = reduced ? 0 : Math.floor(now / (row % 2 ? 160 : 320)) % 4;
      sprite.host.dataset.frame = String(frame);
      const key = `${row}:${frame}`;
      if (!ready || !sprite.context || sprite.lastKey === key) continue;
      const measured = ATLAS_LAYOUT.frames[row]?.[frame];
      if (!measured) continue;
      const [sx, sy, width, height] = measured.source;
      const dx = ATLAS_LAYOUT.groundAnchor[0] - measured.groundAnchor[0];
      const dy = ATLAS_LAYOUT.groundAnchor[1] - measured.groundAnchor[1];
      const context = sprite.context;
      context.clearRect(0, 0, ATLAS_LAYOUT.logicalSize, ATLAS_LAYOUT.logicalSize);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(atlas, sx, sy, width, height, dx, dy, width, height);
      sprite.host.dataset.rendered = key;
      sprite.lastKey = key;
    }
  }
  function tick(now) {
    frameRequest = 0;
    if (disposed || reduced || document.hidden) return;
    paint(now);
    frameRequest = requestAnimationFrame(tick);
  }
  function refresh() {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    paint(reduced ? 0 : performance.now());
    if (!disposed && !reduced && !document.hidden) frameRequest = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", refresh, { signal: events.signal });
  atlas.onload = () => {
    if (disposed) return;
    ready = true;
    refresh();
  };
  atlas.onerror = () => {
    if (disposed) return;
    for (const { host } of sprites) {
      host.classList.add("sprite-missing");
      host.textContent = "에셋 로딩 실패";
    }
  };
  atlas.src = COWORKER_ATLAS_URL;
  refresh();
  return {
    refresh,
    setReduced(value) { reduced = Boolean(value); refresh(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameRequest);
      events.abort();
      atlas.onload = atlas.onerror = null;
    },
  };
}
