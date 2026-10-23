import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { writeFile, mkdir } from "node:fs/promises";
import * as T from "three";
import { fixture } from "../../product/tests/living-fixture.mjs";
import { part } from "../../pilot-3d/sample/character-rig.mjs";
import { activityCleanup } from "../../pilot-3d/activities/team-soak.mjs";
const V = (...v) => new T.Vector3(...v), IDS = ["nara", "sora", "jun", "min", "leo"];
const options = { personalMotion: true };
function run(f, predicate, seconds, observe = () => {
}) {
  let samples = 0;
  while (!predicate() && samples < seconds * 30) {
    f.runtime.update(1 / 30);
    observe();
    samples++;
  }
  assert(samples > 0, "non-vacuous cycle");
  assert(predicate(), "settles within " + seconds + "s");
  return samples;
}
function complete(f) {
  const c = activityCleanup(f.runtime.diagnostics());
  assert(c.passed, c.issues.join("; "));
  assert.equal(f.s.huddles.current, null);
  assert.equal(f.s.cupSupport.rows.size, 0);
  assert.deepEqual(f.s.violations, []);
}
function monotonicMotion(f, id, metrics) {
  const a = f.s.desks[id].actor, state = f.s.state(id);
  a.updateWorldMatrix(true, true);
  const p = part(a, "NaraPelvis").getWorldPosition(V());
  if (metrics.lastPelvis) metrics.pelvisStep = Math.max(metrics.pelvisStep, p.distanceTo(V(...metrics.lastPelvis)));
  metrics.lastPelvis = p.toArray();
  for (const side of ["L", "R"]) {
    const knee = part(a, "NaraKnee" + side), hip = part(a, "NaraHip" + side), foot = part(a, "NaraFoot" + side), elbow = part(a, "NaraElbow" + side), hand = part(a, "NaraHand" + side);
    assert(Math.abs(hip.getWorldPosition(V()).distanceTo(knee.getWorldPosition(V())) - 0.37) < 1e-6);
    assert(Math.abs(knee.getWorldPosition(V()).distanceTo(foot.getWorldPosition(V())) - 0.405) < 1e-6);
    metrics.armLengths ??= {};
    for (const [name, node] of [["elbow" + side, elbow], ["hand" + side, hand]]) {
      metrics.armLengths[name] ??= node.position.length();
      assert(Math.abs(node.position.length() - metrics.armLengths[name]) < 1e-9, "fixed " + name);
    }
    for (const node of [hip, knee, foot, elbow, hand]) assert(node.matrixWorld.elements.every(Number.isFinite));

    const i = side === "L" ? 0 : 1;
    if (state.pose?.feet?.[i]) {
      const target = a.parent.localToWorld(V(...state.pose.feet[i].position));
      metrics.footTargetError = Math.max(metrics.footTargetError, foot.getWorldPosition(V()).distanceTo(target));
      assert(metrics.footTargetError < 1e-6);
    }
  }
  soleContact(f,id,metrics);
  assert.deepEqual(f.s.violations, []);
}
const groundCache=new WeakMap(),soleVertices=new WeakMap();
function uniqueSolePoints(geometry){
  let points=soleVertices.get(geometry);if(points)return points;const a=geometry.attributes.position,unique=new Map();
  for(let n=0;n<a.count;n++){const p=V().fromBufferAttribute(a,n);unique.set(p.toArray().map(v=>v.toFixed(9)).join(':'),p);}
  points=[...unique.values()];assert(points.length>20,'real rounded sole geometry');soleVertices.set(geometry,points);return points;
}
function actualGround(root,point){
  let row=groundCache.get(root);if(!row){
    root.updateWorldMatrix(true,true);const meshes=['RoomFloor','WovenRug','MeetingWovenRug','WorkWoolRug'].map(name=>root.getObjectByName(name)).filter(Boolean);assert(meshes.some(n=>n.name==='RoomFloor')&&meshes.every(n=>n.isMesh),'actual floor and available rugs exist');
    const surfaces=meshes.map(mesh=>{const box=new T.Box3().setFromObject(mesh),a=mesh.geometry.attributes.position,index=mesh.geometry.index,flat=[];
      for(let n=0;n<(index?.count??a.count);n+=3){const p=[0,1,2].map(k=>V().fromBufferAttribute(a,index?index.getX(n+k):n+k).applyMatrix4(mesh.matrixWorld));if(!p.every(v=>Math.abs(v.y-box.max.y)<1e-9))continue;
        const [x,y,z]=p,ux=y.x-x.x,uz=y.z-x.z,vx=z.x-x.x,vz=z.z-x.z,den=ux*vz-uz*vx;if(Math.abs(den)>1e-12)flat.push({x:x.x,z:x.z,ux,uz,vx,vz,den});
      }return{mesh,box,flat};});
    row={surfaces,cache:new Map(),ray:new T.Raycaster(V(),V(0,-1,0),0,10)};groundCache.set(root,row);
  }
  const key=point.x.toFixed(7)+':'+point.z.toFixed(7);if(row.cache.has(key))return row.cache.get(key);let result=null;
  for(const{mesh,box,flat}of row.surfaces){if(point.x<box.min.x-1e-8||point.x>box.max.x+1e-8||point.z<box.min.z-1e-8||point.z>box.max.z+1e-8)continue;let height=null;
    // A shortcut is allowed only inside an actual horizontal top-face triangle.
    // Curved rug borders still use the independent Three.js mesh raycaster.
    for(const t of flat){const dx=point.x-t.x,dz=point.z-t.z,u=(dx*t.vz-dz*t.vx)/t.den,v=(t.ux*dz-t.uz*dx)/t.den;if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9){height=box.max.y;break;}}
    if(height===null){row.ray.set(V(point.x,5,point.z),V(0,-1,0));const hit=row.ray.intersectObject(mesh,false)[0];if(hit)height=hit.point.y;}
    if(height!==null&&(!result||height>result.height))result={height,mesh:mesh.name};
  }
  assert(result,'actual ground under sole');row.cache.set(key,result);return result;
}
function soleContact(f,id,metrics){
  const actor=f.s.desks[id].actor,state=f.s.state(id);actor.updateWorldMatrix(true,true);
  const row=(metrics.soles??={})[id]??={samples:0,minHeight:Infinity,maxPlantedGap:-Infinity,minPlantedGap:Infinity,minSignedGap:Infinity,plantedSamples:0,surfaceSamples:0,surfaces:[]};
  for(const[i,side]of ['L','R'].entries()){
    const sole=part(actor,'Sole'+side),points=uniqueSolePoints(sole.geometry).map(p=>p.clone().applyMatrix4(sole.matrixWorld));let bottom=Infinity;for(const p of points)bottom=Math.min(bottom,p.y);
    row.samples++;row.minHeight=Math.min(row.minHeight,bottom);assert(bottom>-.0001,id+' actual sole penetrates floor '+bottom);
    const foot=state.pose?.feet?.[i];if(!foot)continue;
    // Use the whole actual sole, not only its lowest point. A higher toe can
    // touch a rug while the lowest heel legitimately stands above the floor.
    let gap=Infinity;for(const point of points){const surface=actualGround(f.root,point);row.surfaceSamples++;if(!row.surfaces.includes(surface.mesh))row.surfaces.push(surface.mesh);gap=Math.min(gap,point.y-surface.height);}
    row.minSignedGap=Math.min(row.minSignedGap,gap);assert(gap>-.0001,id+' actual sole penetrates terrain '+gap+' at '+(f.s.getRecord(id)?.trip?.stage??state.action));
    if(!foot.planted)continue;row.plantedSamples++;row.maxPlantedGap=Math.max(row.maxPlantedGap,gap);row.minPlantedGap=Math.min(row.minPlantedGap,gap);
    assert(gap<.003,id+' actual whole planted sole lacks terrain contact '+gap+' at '+(f.s.getRecord(id)?.trip?.stage??state.action));
  }
}
function support(f, metrics) {
  for(const id of IDS)soleContact(f,id,metrics);
  for (const [id, row] of Object.entries(f.s.meetingSupport.diagnostics())) for (const h of Object.values(row.hands)) {
    metrics.tableSamples++;
    metrics.tableByActor??={};metrics.tableByActor[id]=(metrics.tableByActor[id]??0)+1;
    metrics.maxTableError = Math.max(metrics.maxTableError, h.error);
    assert(h.error < 1e-3, id + " table arm reach");
    if (h.planted) {
      metrics.plantedSamples++;
      assert(Math.abs(h.palmGap - 15e-4) < 2e-4);
    }
  }
}
// Independent geometry check: final marker centers to actual world triangles.
// This is an unsigned center-to-surface gap, not skin penetration or appearance.
function pointSurfaceGap(mesh,p){
  assert(mesh?.isMesh,'actual prop mesh exists');mesh.updateWorldMatrix(true,false);
  const a=mesh.geometry.attributes.position,index=mesh.geometry.index,triangle=new T.Triangle(),closest=V();let gap=Infinity;
  for(let n=0;n<(index?.count??a.count);n+=3){for(const[k,vertex]of[triangle.a,triangle.b,triangle.c].entries())vertex.fromBufferAttribute(a,index?index.getX(n+k):n+k).applyMatrix4(mesh.matrixWorld);gap=Math.min(gap,triangle.closestPointToPoint(p,closest).distanceTo(p));}
  assert(Number.isFinite(gap));return gap;
}
function padSurfaceGaps(mesh,grip){return grip.fingers.map(finger=>{const gap=pointSurfaceGap(mesh,finger.pad.getWorldPosition(V()));assert(gap<.003,'actual pad-to-prop triangle gap '+gap);return gap;});}
function propsHome(f) {
  for (const id of IDS) {
    assert.equal(f.s.cups[id].owner, "desk");
    assert.equal(f.s.cups[id].state, "idle");
    assert.equal(f.s.desks[id].owner, "desk");
  }
  for (let n = 0; n < 5; n++) assert.equal(f.root.getObjectByName("GroupPencil" + n).parent.name, "GroupNoteDock" + n);
  assert(f.s.transfer.diagnostics().pages.every((p) => p.owner === "desk:" + p.desk && Math.abs(p.supportGap - 5e-4) < 1e-4));
}
const precisionCases = [
  { id: "leo-role-three", title: "Leo completes all three document recipes, fixed limbs and one page owner", run() {
    const f = fixture(options);
    try {
      const d = f.s.desks.leo, result = { variants: [], handSamples: 0, maxHandError: 0, maxPadError: 0 };
      for (let variant = 0; variant < 3; variant++) {
        const done = d.done, events = d.events, phases = /* @__PURE__ */ new Set(), stages = /* @__PURE__ */ new Set();
        let gripSamples=0;const surfacePhases={};
        assert(d.start({ variant }));
        run(f, () => !d.busy, 20, () => {
          stages.add(d.stage);
          if (d.stage === "use") {
            phases.add(d.recipe().phase);
            assert.equal(d.owner, "hand");
            assert.equal(d.prop.parent, d.hand);
            result.handSamples++;
            result.maxHandError = Math.max(result.maxHandError, d.handError);
            assert(d.handError < 1e-5);
            const g = f.s.handGrips.rows.get("leo").R;
            if (g.blend > 0.995) {
              gripSamples++;
              if(!surfacePhases[d.recipe().phase])surfacePhases[d.recipe().phase]=padSurfaceGaps(d.prop,g);
              assert.equal(g.contactRows.length, 5);
              assert(g.contactRows.every((r) => r.reachable));
              result.maxPadError = Math.max(result.maxPadError, g.error);
              assert(g.error < 3e-3);
            }
          }
        });
        assert.equal(d.done, done + 1);
        assert.equal(d.events, events + 2);
        assert.equal(d.owner, "desk");
        assert.equal(d.prop.parent, d.homeParent);
        assert(d.prop.position.distanceTo(d.home.p) < 1e-9);
        assert(d.prop.quaternion.angleTo(d.home.q) < 1e-7);
        for (const p of ["observe", "act", "pause", "check"]) assert(phases.has(p));
        for (const stage of ["grasp", "use", "replace", "release", "retract", "idle"]) assert(stages.has(stage));
        assert(gripSamples>30,"non-vacuous five-finger document contact");
        assert.equal(Object.keys(surfacePhases).length,4);
        result.variants.push({ variant, gripSamples, surfacePhases, phases: [...phases], stages: [...stages] });
      }
      assert.deepEqual([...d.variantsSeen].sort(), [0, 1, 2]);
      assert(result.handSamples > 100);
      complete(f);
      return result;
    } finally {
      f.close();
    }
  } },
  { id: "leo-sofa-window", title: "Leo completes stand, walk, settle, sit, rest and independent window return", run() {
    const f = fixture(options);
    try {
      const metrics = { pelvisStep: 0, footTargetError: 0 }, out = {};
      for (const kind of ["sofa", "window"]) {
        const before = kind === "sofa" ? f.s.counts.leo.sofa : f.s.windowCounts.leo, stages = /* @__PURE__ */ new Set(), actions = /* @__PURE__ */ new Set();
        assert(kind === "sofa" ? f.s.startSofa("leo") : f.s.startWindow("leo"));
        run(f, () => f.s.idle("leo"), 350, () => {
          const r = f.s.records.get("leo");
          if (r?.trip) stages.add(r.trip.stage);
          actions.add(f.s.state("leo").action);
          monotonicMotion(f, "leo", metrics);
        });
        assert.equal(kind === "sofa" ? f.s.counts.leo.sofa : f.s.windowCounts.leo, before + 1);
        for (const stage of kind === "sofa" ? ["stand", "out", "align", "sit", "rest", "rise", "home", "deskSit"] : ["stand", "out", "align", "rest", "home", "deskSit"]) assert(stages.has(stage), kind + ":" + stage);
        assert(actions.has("walk"));
        complete(f);
        out[kind] = { stages: [...stages], actions: [...actions] };
        delete metrics.lastPelvis;
      }
      assert(metrics.pelvisStep < 0.06);
      return { ...out, ...metrics };
    } finally {
      f.close();
    }
  } },
  { id: "leo-three-rests", title: "Leo completes all three personal rest styles, with actual arm movement and return", run() {
    const f = fixture(options);
    try {
      const styles = /* @__PURE__ */ new Set(), result = [];
      for (let i = 0; i < 3; i++) {
        const before = f.s.restCounts.leo;
        assert(f.s.startRest("leo"));
        const r = f.s.records.get("leo"), style = r.style, actor = f.s.desks.leo.actor, starts = ["L", "R"].map((side) => part(actor, "NaraHand" + side).getWorldPosition(V())), m = { pelvisStep: 0, footTargetError: 0 };
        let armMovement = 0, restSamples = 0;
        styles.add(style);
        run(f, () => f.s.idle("leo"), 350, () => {
          if (f.s.records.get("leo")?.kind === "micro") restSamples++;
          for (const [j, side] of ["L", "R"].entries()) armMovement = Math.max(armMovement, part(actor, "NaraHand" + side).getWorldPosition(V()).distanceTo(starts[j]));
          monotonicMotion(f, "leo", m);
        });
        assert.equal(f.s.restCounts.leo, before + 1);
        assert(restSamples > 100 && armMovement > 0.01);
        complete(f);
        propsHome(f);
        delete m.lastPelvis;
        result.push({ style, restSamples, armMovement, ...m });
      }
      assert.deepEqual([...styles].sort(), ["back_open", "shoulder_drop", "side_stretch"]);
      return result;
    } finally {
      f.close();
    }
  } },
  { id: "leo-cup-coffee", title: "Leo completes full drink and purposeful coffee with outbound/return coverage", run() {
    const f = fixture(options);
    try {
      const c = f.s.cups.leo, states = /* @__PURE__ */ new Set(), phases = /* @__PURE__ */ new Set(), directions = /* @__PURE__ */ new Set(), metric = { cupContactSamples: 0, maxHandError: 0, maxPadError: 0, minCupUp: 1, maxCarryStep: 0 }, cupCount = f.s.counts.leo.cup;
      assert(f.s.startCup("leo"));
      run(f, () => !f.s.records.has("leo"), 30, () => {
        states.add(c.state);
        metric.maxHandError = Math.max(metric.maxHandError, c.reachError);
        assert(c.reachError < 1e-5);
        if (c.owner === "hand") {
          assert.equal(c.mug.parent, c.hand);
          const g = f.s.handGrips.rows.get("leo").L;
          if (g.blend > 0.995) {
            metric.cupContactSamples++;
            if(c.state==="sip"&&!metric.sipSurfaceGaps)metric.sipSurfaceGaps=padSurfaceGaps(f.root.getObjectByName("LeoMugHandle"),g);
            assert.equal(g.contactRows.length, 5);
            assert(g.contactRows.every((r) => r.reachable));
            metric.maxPadError = Math.max(metric.maxPadError, g.error);
            assert(g.error < 3e-3);
          }
        }
      });
      assert.equal(f.s.counts.leo.cup, cupCount + 1);
      for (const state of ["reach", "grasp", "lift", "sip", "lower", "place", "release", "idle"]) assert(states.has(state), state);
      assert(f.s.startCoffee("leo"));
      run(f, () => !f.s.coffee.rows.has("leo"), 400, () => {
        const r = f.s.coffee.rows.get("leo");
        if (r) phases.add(r.phase);
        if (c.state === "carry" && r) {
          const now = c.mug.getWorldPosition(V());
          if (metric.lastCarry && f.s.time - metric.lastCarry.time < 0.04) metric.maxCarryStep = Math.max(metric.maxCarryStep, now.distanceTo(V(...metric.lastCarry.position)));
          metric.lastCarry = { time: f.s.time, position: now.toArray() };
          assert(metric.maxCarryStep < 0.09, "consecutive carry frames remain continuous");
          assert(!f.s.humanMotion.free("leo", "L"));
          assert(f.s.humanMotion.free("leo", "R"));
          assert.equal(c.owner, "hand");
          assert.equal(c.mug.parent, c.hand);
          const up = V(0, 1, 0).applyQuaternion(c.mug.getWorldQuaternion(new T.Quaternion())).y;
          metric.minCupUp = Math.min(metric.minCupUp, up);
          assert(up > 0.999);
          if (f.s.state("leo").action === "walk") {directions.add(r.phase);const g=f.s.handGrips.rows.get("leo").L;assert(g.blend>.995);assert.equal(g.contactRows.length,5);assert(g.contactRows.every(row=>row.reachable&&row.error<.003));metric.carryContactSamples??={};metric.carryContactSamples[r.phase]=(metric.carryContactSamples[r.phase]??0)+1;metric.carrySurfaceGaps??={};if(!metric.carrySurfaceGaps[r.phase])metric.carrySurfaceGaps[r.phase]=padSurfaceGaps(f.root.getObjectByName("LeoMugHandle"),g);}
        }
      });
      assert.equal(f.s.coffee.history.at(-1).status, "complete");
      assert.equal(f.s.coffee.counts.leo, 1);
      for (const p of ["pickup", "out", "place", "press", "brew", "retrieve", "home", "putback"]) assert(phases.has(p), p);
      assert(directions.has("out") && directions.has("home"));
      assert(metric.carryContactSamples.out>10&&metric.carryContactSamples.home>10);
      assert(metric.cupContactSamples > 10);assert.equal(metric.sipSurfaceGaps.length,5);
      delete metric.lastCarry;
      complete(f);
      propsHome(f);
      return { states: [...states], phases: [...phases], directions: [...directions], ...metric };
    } finally {
      f.close();
    }
  } },
  { id: "seated-two-five", title: "2\u20135 seated participants include Leo, speak and write completely with all cups home", run() {
    const result = [];
    for (const size of [2, 3, 4, 5]) {
      const f = fixture(options);
      try {
        const ids = ["leo", ...IDS.filter((id) => id !== "leo")].slice(0, size), home = new Map(IDS.map((id) => [id, f.s.cups[id].mug.getWorldPosition(V())])), speakers = /* @__PURE__ */ new Set(), noted = /* @__PURE__ */ new Set(), speakingHands=new Map(), speakingMovement={}, noteSurfaceByActor={}, walked = /* @__PURE__ */ new Set(), m = { tableSamples: 0, plantedSamples: 0, maxTableError: 0 }, before = f.s.meetings;
        assert(f.s.startMeeting(ids));
        assert.equal(size === 2 ? f.s.session.withCups : f.s.group.current.withCups, false);
        const samples = run(f, () => !f.s.session && !f.s.group.current, 800, () => {
          support(f, m);
          for (const id of IDS) {
            const c = f.s.cups[id];
            assert.equal(c.owner, "desk");
            assert.equal(c.state, "idle");
            assert(c.mug.getWorldPosition(V()).distanceTo(home.get(id)) < 1e-7);
          }
          for (const id of ids) {
            const st = f.s.state(id);
            if (st.action === "walk") walked.add(id);
            if (st.action === "meeting_talk" && st.speaking !== false){speakers.add(id);const p=part(f.s.desks[id].actor,'NaraHandR').getWorldPosition(V());if(!speakingHands.has(id))speakingHands.set(id,p);speakingMovement[id]=Math.max(speakingMovement[id]??0,p.distanceTo(speakingHands.get(id)));}
            const note = f.s.group.current?.records.get(id)?.note;
            if (note?.stage === "use" && note.time > 0.7) {
              noted.add(id);
              assert.equal(note.owner, "hand");
              assert.equal(note.pen.parent, note.hand);
              assert(note.handError < 1e-3 && note.tipError < 1e-3);const page=f.root.getObjectByName('GroupNotePage'+f.s.group.current.records.get(id).slot),gap=pointSurfaceGap(page,note.pen.localToWorld(V(0,-note.half,0)));assert(gap<.0011,'actual pencil tip to notebook surface '+gap);noteSurfaceByActor[id]=(noteSurfaceByActor[id]??0)+1;assert(note.ink.children.some(n=>n.visible&&n.geometry.drawRange.count>0),'actual written strokes visible');
            }
          }
        });
        assert.deepEqual([...walked].sort(), [...ids].sort());
        assert.deepEqual([...speakers].sort(), [...ids].sort());
        for(const id of ids)assert(speakingMovement[id]>.005,id+" actual speaking hand movement");
        assert.equal(f.s.meetings, before + 1);
        if (size >= 3) {
          const h = f.s.group.history.at(-1);
          assert.equal(h.status, "complete");
          assert.deepEqual([...h.spoke].sort(), [...ids].sort());
          assert.deepEqual([...h.noted].sort(), [...ids].sort());
          assert.deepEqual([...noted].sort(), [...ids].sort());for(const id of ids)assert(noteSurfaceByActor[id]>20,id+" actual notebook surface samples");
        }
        assert(m.tableSamples > 30 && m.plantedSamples > 10);
        for(const id of ids){assert(m.tableByActor[id]>20,id+" actual table support samples");assert(m.soles[id].plantedSamples>30,id+" actual planted sole samples");}
        complete(f);
        propsHome(f);
        result.push({ size, ids, speakers: [...speakers], noted: [...noted], walked: [...walked],speakingMovement,noteSurfaceByActor, samples, ...m });
      } finally {
        f.close();
      }
    }
    return result;
  } },
  { id: "standing-two-five", title: "2\u20135 standing participants including Leo all arrive and answer before return", run() {
    const result = [];
    for (const size of [2, 3, 4, 5]) {
      const f = fixture(options);
      try {
        const ids = ["leo", "min", "jun", "sora", "nara"].slice(0, size), speakers = new Set(),firstHand=new Map(),speakingMovement={};
        let talkSamples = 0;const soleMetrics={};
        assert(f.s.startHuddle(ids));
        run(f, () => !f.s.huddles.current, 800, () => {
          const g = f.s.huddles.current;
          if (g?.phase === "talk" && !g.ending) {
            assert(g.ids.every((id) => g.records.get(id)?.trip.stage === "rest"));
            talkSamples++;
            for (const id of ids) if (f.s.state(id).speaking){speakers.add(id);const p=part(f.s.desks[id].actor,"NaraHandR").getWorldPosition(V());if(!firstHand.has(id))firstHand.set(id,p);speakingMovement[id]=Math.max(speakingMovement[id]??0,p.distanceTo(firstHand.get(id)));}
          }
          for (const id of IDS){assert.equal(f.s.cups[id].owner,"desk");soleContact(f,id,soleMetrics);}
          assert.deepEqual(f.s.violations, []);
        });
        const h = f.s.huddles.history.at(-1);
        assert.equal(h.status, "complete");
        assert.deepEqual([...h.spoke].sort(), [...ids].sort());
        assert.deepEqual([...speakers].sort(), [...ids].sort());
        assert(talkSamples > 30);for(const id of ids)assert(soleMetrics.soles[id].plantedSamples>30);for(const id of ids)assert(speakingMovement[id]>.005,id+" actual standing talk hand movement");
        complete(f);
        propsHome(f);
        result.push({ size, ids, spoke: h.spoke, talkSamples,speakingMovement,...soleMetrics });
      } finally {
        f.close();
      }
    }
    return result;
  } },
  { id: "leo-document-both-directions", title: "Leo sends and receives actual documents through all ten stages and returns", run() {
    const f = fixture(options);
    try {
      const result = [];
      for (const [visitor, host] of [["leo", "nara"], ["min", "leo"]]) {
        const stages = /* @__PURE__ */ new Set(), owners = /* @__PURE__ */ new Set(), before = f.s.visitHistory.length;
        assert(f.s.startVisit(visitor, host, { transfer: true }));
        run(f, () => !f.s.visit, 500, () => {
          if (f.s.transfer.active) {
            stages.add(f.s.transfer.stage);
            owners.add(f.s.transfer.page.owner);
            assert(f.s.transfer.handError < 1e-5);
          }
          assert.equal(new Set(f.s.transfer.diagnostics().pages.map((p) => p.id)).size, 5);
        });
        const h = f.s.visitHistory.at(-1);
        assert.equal(f.s.visitHistory.length, before + 1);
        assert.equal(h.status, "complete");
        assert.equal(h.transferComplete, true);
        for (const st of ["pickup", "grasp", "present", "receive", "accept", "read", "giveback", "regrasp", "return", "release"]) assert(stages.has(st), visitor + ":" + st);
        assert([...owners].some((x) => x === "hand:" + visitor) && [...owners].some((x) => x === "hand:" + host));
        complete(f);
        propsHome(f);
        result.push({ visitor, host, stages: [...stages], owners: [...owners] });
      }
      return result;
    } finally {
      f.close();
    }
  } },
  { id: "team-work-remove-cancel", title: "Work, participant removal and manual cancellation release all group phases and props", run() {
    const result = [];
    for (const phase of ["arriving", "talk", "note"]) for (const kind of ["work", "remove", "cancel"]) {
      const f = fixture(options);
      try {
        assert(f.s.startMeeting(IDS));
        run(f, () => f.s.group.current?.phase === phase && f.s.group.current.time > 0.15 && (phase !== "note" || f.s.group.current.records.get("nara")?.note.stage === "use"), 600);
        const started = f.s.time;
        if (kind === "cancel") f.s.cancelAll();
        else f.runtime.setViewModel({ ...f.vm, actors: f.vm.actors.filter((a) => kind !== "remove" || a.agentId !== "leo").map((a) => ({ ...a, pose: kind === "work" && a.agentId === "leo" ? "typing" : "idle" })) });
        assert(f.s.group.current.ending);
        run(f, () => !f.s.group.current, 700, () => {
          assert.deepEqual(f.s.violations, []);
          for (const note of f.s.group.notes) if (note.busy) assert(note.handError < 1e-3 && note.tipError < 1e-3);
        });
        assert.equal(f.s.group.history.at(-1).status, "cancelled");
        if (kind === "work") {
          assert.equal(f.s.rawIncoming("leo").pose, "typing");
          f.runtime.setViewModel(f.vm);
          if(!f.s.ids.every(id=>f.s.idle(id)))run(f,()=>f.s.ids.every(id=>f.s.idle(id)),40);
        } else f.runtime.setViewModel(f.vm);
        complete(f);
        propsHome(f);
        result.push({ phase, kind, returnSeconds: f.s.time - started, status: f.s.group.history.at(-1).status });
      } finally {
        f.close();
      }
    }
    return result;
  } },
  { id: "leo-prop-work-boundaries", title: "Leo work interrupts every drink and coffee phase without losing owned props", run() {
    const f=fixture(options), result=[];
    const restore=()=>{f.runtime.setViewModel(f.vm);if(!f.s.ids.every(id=>f.s.idle(id)))run(f,()=>f.s.ids.every(id=>f.s.idle(id)),40);complete(f);propsHome(f);};
    const work=()=>f.runtime.setViewModel({...f.vm,actors:f.vm.actors.map(a=>({...a,pose:a.agentId==='leo'?'typing':'idle'}))});
    try {
      for(const phase of ['reach','grasp','lift','sip','lower','place','release']){
        assert(f.s.startCup('leo'));f.runtime.update(1/30);if(f.s.cups.leo.state!==phase)run(f,()=>f.s.cups.leo.state===phase,30);
        assert.equal(f.s.cups.leo.state,phase);work();assert.equal(f.s.rawIncoming('leo').pose,'typing');run(f,()=>!f.s.records.has('leo'),40);
        assert.equal(f.s.cups.leo.owner,'desk');restore();result.push({kind:'cup',phase,owner:f.s.cups.leo.owner});
      }
      for(const phase of ['pickup','out','place','press','brew','retrieve','home','putback']){
        assert(f.s.startCoffee('leo'));f.runtime.update(1/30);if(f.s.coffee.rows.get('leo')?.phase!==phase)run(f,()=>f.s.coffee.rows.get('leo')?.phase===phase,350);
        assert.equal(f.s.coffee.rows.get('leo').phase,phase);work();assert(f.s.coffee.rows.get('leo').ending);run(f,()=>!f.s.coffee.rows.has('leo'),400);
        assert.equal(f.s.coffee.history.at(-1).status,'cancelled');assert.equal(f.s.cups.leo.owner,'desk');restore();result.push({kind:'coffee',phase,status:f.s.coffee.history.at(-1).status});
      }
      return result;
    } finally {f.close();}
  }},
  { id: "invalid-membership-atomic", title: "Invalid group membership never partially reserves or changes props", run() {
    const f = fixture(options);
    try {
      const rejected = [];
      for (const ids of [["leo", "leo"], ["leo", "unknown"], ["leo"], [...IDS, "unknown"]]) for (const method of ["startMeeting", "startHuddle"]) {
        assert.equal(f.s[method](ids), false);
        assert.deepEqual(f.s.book.snapshot(), {});
        assert.equal(f.s.group.current, null);
        assert.equal(f.s.session, null);
        assert.equal(f.s.huddles.current, null);
        rejected.push({ method, ids });
      }
      complete(f);
      propsHome(f);
      return rejected;
    } finally {
      f.close();
    }
  } }
];
function runPrecisionCase(id) {
  const row = precisionCases.find((row2) => row2.id === id);
  assert(row, "known QA case");
  const start = performance.now();
  return { id, title: row.title, metrics: row.run(), elapsedMs: performance.now() - start };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = [];
  for (const row of precisionCases) {
    try {
      const result = runPrecisionCase(row.id);
      results.push({ ...result, status: "passed" });
      console.log(row.id + " passed");
    } catch (e) {
      results.push({ id: row.id, status: "failed", error: e.stack });
      console.error(row.id + " failed: " + e.message);
    }
  }
  const out = "product/evidence/motion-precision/leo-team/numeric-qa.json";
  await mkdir("product/evidence/motion-precision/leo-team", { recursive: true });
  await writeFile(out, JSON.stringify({ version: 1, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), scope: "v12 procedural runtime; mathematical and ownership QA; no rendered appearance claim", results, passed: results.every((r) => r.status === "passed") }, null, 2) + "\n");
  if (results.some((r) => r.status !== "passed")) process.exitCode = 1;
}
export {
  precisionCases,
  runPrecisionCase
};
