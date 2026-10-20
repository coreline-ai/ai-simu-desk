import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const bytes = await readFile(new URL("../assets/afternoon-studio-v1.glb", import.meta.url));
const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
model.scene.updateMatrixWorld(true);

test("the actual GLB roundtrip contains metre-scale geometry and both named animations", () => {
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.byteLength);
  for (const name of ["Floor", "DeskTop", "ChairSeat", "Nara", "NaraHead", "NaraForearmL", "NaraForearmR", "Laptop"]) assert.ok(model.scene.getObjectByName(name), name);
  assert.deepEqual(model.animations.map(a => a.name), ["idle", "typing", "thinking", "waiting", "success", "error", "blink"]);
  const size = new T.Box3().setFromObject(model.scene.getObjectByName("DeskTop"));
  assert.ok(Math.abs(size.max.y - .74) < .0001);
  const chair = new T.Box3().setFromObject(model.scene.getObjectByName("ChairSeat"));
  assert.ok(Math.abs(chair.max.y - .45) < .0001);
  const nara = new T.Box3().setFromObject(model.scene.getObjectByName("Nara"));
  assert.ok(nara.max.y > 1.3 && nara.max.y < 1.4);
  assert.ok(bytes.byteLength < 8 * 1024 * 1024);
});

test("every tagged foot is on the floor and within the floor boundary after GLB import", () => {
  const floor = new T.Box3().setFromObject(model.scene.getObjectByName("Floor"));
  let supports = 0;
  model.scene.traverse(object => {
    if (!object.userData.groundSupport) return;
    supports++;
    const b = new T.Box3().setFromObject(object);
    assert.ok(Math.abs(b.min.y) < .0001, `${object.name}: ${b.min.y}`);
    assert.ok(b.min.x > floor.min.x && b.max.x < floor.max.x && b.min.z > floor.min.z && b.max.z < floor.max.z, object.name);
  });
  assert.equal(supports, 14); // Two chairs x four feet, desk x four, two shoes.
});

test("animation loops close, move typing hands, and never move grounded shoes or furniture", () => {
  const shoe = model.scene.getObjectByName("Nara").children.find(node => node.userData.groundSupport);
  const initialFoot = shoe.getWorldPosition(new T.Vector3());
  for (const clip of model.animations) {
    for (const track of clip.tracks) {
      const stride = track.getValueSize();
      if(!["success","error"].includes(clip.name)) assert.deepEqual([...track.values.slice(0, stride)], [...track.values.slice(-stride)], track.name);
      assert.ok(/Nara(Head|Torso|Forearm[LR]|Eye(?:Light)?[LR])\./.test(track.name));
    }
    const mixer = new T.AnimationMixer(model.scene);
    mixer.clipAction(clip).play();
    const hand = model.scene.getObjectByName("HandL");
    mixer.setTime(0); model.scene.updateMatrixWorld(true); const start = hand.getWorldPosition(new T.Vector3());
    mixer.setTime(.2); model.scene.updateMatrixWorld(true);
    if (clip.name === "typing") assert.ok(hand.getWorldPosition(new T.Vector3()).distanceTo(start) > .005);
    assert.ok(shoe.getWorldPosition(new T.Vector3()).distanceTo(initialFoot) < .0001);
    mixer.stopAllAction(); mixer.uncacheRoot(model.scene);
  }
});
