import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const bytes = await readFile(new URL("../assets/studio-team-v2.glb", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../assets/manifest.json", import.meta.url)));
const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
model.scene.updateMatrixWorld(true);

test("team GLB has two distinct selectable colleagues, same-scale stations and a matching manifest", () => {
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256);
  assert.equal(bytes.length, manifest.bytes);
  assert.ok(bytes.length < 8 * 1024 * 1024);
  const names = new Set(); model.scene.traverse(node => { assert.ok(!names.has(node.name), node.name); names.add(node.name); });
  for (const [id, prefix] of [["nara", ""], ["jun", "Jun"]]) {
    const actor = model.scene.getObjectByName(id === "nara" ? "Nara" : "Jun");
    assert.equal(actor.userData.agentId, id); assert.equal(actor.userData.selectable, true);
    assert.ok(Math.abs(new T.Box3().setFromObject(model.scene.getObjectByName(`${prefix}DeskTop`)).max.y - .74) < .0001);
    assert.ok(Math.abs(new T.Box3().setFromObject(model.scene.getObjectByName(`${prefix}ChairSeat`)).max.y - .45) < .0001);
    const height = new T.Box3().setFromObject(actor).max.y; assert.ok(height > 1.3 && height < 1.4);
  }
  const a = new T.Box3().setFromObject(model.scene.getObjectByName("Workspace"));
  const b = new T.Box3().setFromObject(model.scene.getObjectByName("JunWorkspace"));
  assert.ok(!a.intersectsBox(b), "workstations must not overlap");
  assert.ok(b.min.x - a.max.x > .3, "keep space between desks");
});

test("all team support points stay on the floor and inside room bounds", () => {
  const floor = new T.Box3().setFromObject(model.scene.getObjectByName("Floor"));
  let count = 0;
  model.scene.traverse(node => {
    if (!node.userData.groundSupport) return; count++;
    const bounds = new T.Box3().setFromObject(node);
    assert.ok(Math.abs(bounds.min.y) < .0001, node.name);
    assert.ok(bounds.min.x > floor.min.x && bounds.max.x < floor.max.x && bounds.min.z > floor.min.z && bounds.max.z < floor.max.z, node.name);
  });
  assert.equal(count, 24);
});

test("independent imported clips move only their owner's hands and leave feet and furniture fixed", () => {
  assert.deepEqual(model.animations.map(c => c.name), ["nara_idle", "nara_typing", "jun_idle", "jun_typing"]);
  const get = name => model.scene.getObjectByName(name).getWorldPosition(new T.Vector3());
  for (const owner of ["nara", "jun"]) {
    const mixer = new T.AnimationMixer(model.scene);
    const stable = ["DeskTop", "JunDeskTop", "ChairSeat", "JunChairSeat"].map(name => model.scene.getObjectByName(name));
    model.scene.traverse(node => { if (node.userData.groundSupport) stable.push(node); });
    const before = stable.map(node => node.getWorldPosition(new T.Vector3()));
    for (const clip of model.animations) {
      for (const track of clip.tracks) {
        assert.ok(track.name.startsWith(clip.name.startsWith("nara_") ? "Nara" : "Jun"));
        const stride = track.getValueSize(); assert.deepEqual([...track.values.slice(0,stride)], [...track.values.slice(-stride)]);
      }
    }
    mixer.clipAction(model.animations.find(c => c.name === `${owner}_typing`)).play();
    mixer.clipAction(model.animations.find(c => c.name === `${owner === "nara" ? "jun" : "nara"}_idle`)).play();
    mixer.setTime(0); model.scene.updateMatrixWorld(true);
    const hands = [get("HandL"), get("JunHandL")];
    mixer.setTime(.2); model.scene.updateMatrixWorld(true);
    assert.ok(get(owner === "nara" ? "HandL" : "JunHandL").distanceTo(hands[owner === "nara" ? 0 : 1]) > .005);
    assert.ok(get(owner === "nara" ? "JunHandL" : "HandL").distanceTo(hands[owner === "nara" ? 1 : 0]) < .0001);
    stable.forEach((node,i) => assert.ok(node.getWorldPosition(new T.Vector3()).distanceTo(before[i]) < .0001, node.name));
    mixer.stopAllAction(); mixer.uncacheRoot(model.scene);
  }
});
