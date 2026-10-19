import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function releaseModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const mat of [node.material].flat().filter(Boolean)) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const item of geometries) item.dispose();
  for (const item of textures) item.dispose();
  for (const item of materials) item.dispose();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

export function createStudioView(host, callbacks = {}, options = {}) {
  const actorIds = options.actors ?? ["nara"];
  const started = performance.now();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0xf8f6ee, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.domElement.setAttribute("aria-label", `${actorIds.includes("jun") ? "나라·준과" : "나라와"} 가구를 같은 카메라와 빛으로 그리는 3D 사무실. 드래그로 회전하고 스크롤로 확대할 수 있습니다.`);
  renderer.domElement.setAttribute("role", "img");
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-5, 5, 4, -4, .1, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableDamping = false;
  controls.minPolarAngle = .5; controls.maxPolarAngle = 1.32;
  controls.minZoom = .8; controls.maxZoom = 2.5;
  const hemi = new T.HemisphereLight(0xfff7e7, 0x9fa68d, 2.0); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffedcf, 3.2);
  sun.position.set(3.4, 7, -1.6); sun.target.position.set(-.5, 0, .7); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -5.4, right: 5.4, top: 5.4, bottom: -5.4, near: .5, far: 18 });
  sun.shadow.normalBias = .022; sun.shadow.bias = -.00015;
  sun.shadow.radius = 4; sun.shadow.intensity = .78;
  scene.add(sun, sun.target);
  scene.add(new T.AmbientLight(0xe6eee1, .28));
  const backdrop = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0xf4efe3, roughness: 1 }));
  backdrop.name = "StudioGround"; backdrop.rotation.x = -Math.PI / 2; backdrop.position.y = -.185; backdrop.receiveShadow = true; scene.add(backdrop);
  let model = null, mixer = null, actions = {}, currentActions = {};
  let disposed = false, ready = false, lost = false, paused = false, quality = "auto", framing = "room";
  let lastTime = 0, lastStats = 0, sample = null, lastMetrics = {};
  let currentVM = { pose: "idle", motionPaused: false };
  const events = new AbortController();
  const getStats = () => ({ ...lastMetrics, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pose: currentVM.pose, actors: Object.fromEntries(actorIds.map(id => [id, currentActions[id]?.getClip().name ?? null])), paused, measuring: Boolean(sample), pixelRatio: renderer.getPixelRatio(), canvas: [renderer.domElement.width, renderer.domElement.height] });
  function emitStats() { lastMetrics = getStats(); callbacks.onMetrics?.(lastMetrics); }
  function draw() { if (!disposed && ready && !lost) { renderer.render(scene, camera); } }
  function tick(now) {
    if (disposed || lost || !ready || document.hidden) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .06) : 0; lastTime = now;
    if (!paused) mixer.update(dt);
    draw();
    if (sample) {
      sample.frames++;
      if (now - sample.start >= 3000) {
        lastMetrics = { ...lastMetrics, measuredFps: +(sample.frames * 1000 / (now - sample.start)).toFixed(1), measurementMs: Math.round(now - sample.start) };
        sample = null; emitStats(); syncLoop();
      }
    }
    if (now - lastStats > 1000) { lastStats = now; emitStats(); }
  }
  function syncLoop() {
    renderer.setAnimationLoop(null); lastTime = 0;
    if (!disposed && ready && !lost && !document.hidden && (!paused || sample)) renderer.setAnimationLoop(tick);
    draw();
  }
  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    const low = quality === "low" || (quality === "auto" && width < 600);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1 : 1.5));
    renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
    const resolution = low ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== resolution) {
      sun.shadow.mapSize.set(resolution, resolution); sun.shadow.map?.dispose(); sun.shadow.map = null;
    }
    const aspect = width / Math.max(height, 1), half = ["nara", "jun"].includes(framing) ? Math.max(1.32, 1.4 / aspect) : framing === "team" ? Math.max(1.75, 2.1 / aspect) : Math.max(3.65, 4.8 / aspect);
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
    draw(); emitStats();
  }
  function resetCamera(focus = false) {
    framing = focus === true ? "nara" : focus === false ? "room" : ["room", "team", ...actorIds].includes(focus) ? focus : "room"; camera.zoom = 1;
    if (["nara", "jun"].includes(framing)) {
      const origin = model?.userData.workspaces?.[framing] ?? (framing === "jun" ? [2.22, 0, 1.02] : [.35, 0, .95]);
      controls.target.set(origin[0], .77, origin[2] - .32);
      camera.position.copy(controls.target).add(new T.Vector3(3.05, 2.03, 4.57));
    }
    else if (framing === "team") { controls.target.set(1.28, .76, .72); camera.position.copy(controls.target).add(new T.Vector3(4.1, 2.9, 6.0)); }
    else { camera.position.set(8, 6.8, 10); controls.target.set(0, .7, 0); }
    controls.update(); resize();
  }
  function applyViewModel(vm) {
    currentVM = vm; paused = vm.motionPaused;
    if (ready) {
      if (paused) mixer.stopAllAction();
      for (const id of actorIds) {
        const pose = vm.actors?.find(actor => actor.agentId === id)?.pose ?? (id === "nara" ? vm.pose : "idle") ?? "idle";
        const next = actions[id]?.[pose] ?? actions[id]?.idle, previous = currentActions[id];
        if (!next) continue;
        if (paused || !previous) next.reset().play();
        else if (previous !== next) { previous.fadeOut(.22); next.reset().fadeIn(.22).play(); }
        currentActions[id] = next;
      }
      if (paused) mixer.update(0);
      renderer.domElement.dataset.clips = JSON.stringify(Object.fromEntries(actorIds.map(id => [id, currentActions[id]?.getClip().name])));
    }
    syncLoop(); emitStats();
  }
  controls.addEventListener("change", draw);
  const observer = new ResizeObserver(resize); observer.observe(host);
  document.addEventListener("visibilitychange", () => { if (sample && document.hidden) { sample = null; lastMetrics.measurementInterrupted = true; } syncLoop(); emitStats(); }, { signal: events.signal });
  let pointerStart = null;
  renderer.domElement.addEventListener("pointerdown", e => { pointerStart = [e.clientX, e.clientY]; }, { signal: events.signal });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!ready || !pointerStart || Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect(), point = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(point, camera);
    for (const hit of ray.intersectObject(model, true)) {
      let node = hit.object;
      while (node && node !== model) { if (node.userData.selectable) { callbacks.onSelect?.(node.userData.agentId); return; } node = node.parent; }
    }
  }, { signal: events.signal });
  renderer.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; renderer.setAnimationLoop(null); callbacks.onStatus?.("lost"); }, { signal: events.signal });
  renderer.domElement.addEventListener("webglcontextrestored", () => { if (disposed) return; lost = false; callbacks.onStatus?.("ready"); resize(); syncLoop(); }, { signal: events.signal });
  resetCamera();
  const loading = new GLTFLoader().loadAsync(options.modelUrl ?? new URL("../assets/afternoon-studio-v1.glb", import.meta.url).href).then(gltf => {
    // The bundled module lives in dist/, so ../assets resolves next to index.html.
    if (disposed) { releaseModel(gltf.scene); return false; }
    model = gltf.scene; scene.add(model);
    model.traverse(node => { if (node.isMesh) { node.castShadow = !/Wall|Window|DistantTree/.test(node.name); node.receiveShadow = true; } });
    mixer = new T.AnimationMixer(model);
    actions = Object.fromEntries(actorIds.map(id => [id, Object.fromEntries(["idle", "typing"].map(pose => {
      const clip = gltf.animations.find(c => c.name === `${id}_${pose}` || (id === "nara" && c.name === pose));
      if (!clip) throw new Error("필수 3D 동작을 읽지 못했어요.");
      return [pose, mixer.clipAction(clip)];
    }))]));
    ready = true;
    lastMetrics.clips = gltf.animations.map(c => c.name);
    applyViewModel(currentVM);
    lastMetrics.loadedMs = Math.round(performance.now() - started);
    callbacks.onStatus?.("ready"); emitStats(); return true;
  }).catch(error => { if (!disposed) { callbacks.onStatus?.("error", error); } return false; });
  return {
    ready: loading, setViewModel: applyViewModel, resetCamera,
    setQuality(value) { quality = value; resize(); },
    measure() { if (!ready || lost || disposed || document.hidden) return false; sample = { start: performance.now(), frames: 0 }; lastMetrics.measurementInterrupted = false; syncLoop(); emitStats(); return true; },
    loseContext() { if (!disposed && ready) renderer.forceContextLoss(); },
    diagnostics: getStats,
    dispose() {
      if (disposed) return null;
      disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); events.abort(); controls.dispose();
      mixer?.stopAllAction(); if (model) mixer?.uncacheRoot(model);
      const released = releaseModel(scene); sun.shadow.dispose();
      renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      return { released, remaining: { ...renderer.info.memory }, contextLost: renderer.getContext().isContextLost() };
    },
  };
}
