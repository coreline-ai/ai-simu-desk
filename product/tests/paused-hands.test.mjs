import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTeamRuntime} from '../../pilot-3d/activities/team-runtime.mjs';
import {validateOfficeAsset} from '../../pilot-3d/sample/asset-contract.mjs';
import {releaseStudioAsset} from '../../pilot-3d/sample/asset-loader.mjs';

const options = {auto:false,natural:true,enriched:true,expressive:true,interaction:true,refined:true,grounded:true};

async function loadOffice() {
  globalThis.self ??= globalThis;
  const loader = new GLTFLoader();
  loader.register(parser => {
    parser.textureLoader = {load(_url, done) {
      const texture = new T.Texture();
      queueMicrotask(() => done(texture));
      return texture;
    }};
    return {name:'PausedHandTestDecoder'};
  });
  const bytes = await readFile('product/assets/studio-room-v9.glb');
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
}

function assertHandGeometry(runtime) {
  const matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
  const hands = runtime.scheduler.handGrips.rows;
  assert.equal(hands.size, 5);
  for (const [id, row] of hands) for (const side of ['L', 'R']) {
    const hand = row[side];
    assert(hand.surface, id + side + ' has enhanced skin');
    for (const mesh of [hand.surface.joints, hand.surface.nails]) {
      assert.equal(mesh.count, 5);
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        matrix.decompose(position, rotation, scale);
        assert(scale.toArray().every(value => value > 0 && value < .02),
          `${id}/${side}/${mesh.name}/${i} must be fingertip-sized, not a unit sphere: ${scale.toArray()}`);
        assert(position.length() < .15, id + side + ' skin stays inside the hand');
      }
    }
    hand.root.updateWorldMatrix(true, true);
    const size = new T.Box3().setFromObject(hand.root).getSize(new T.Vector3());
    assert(size.toArray().every(value => value > 0 && value < .3), id + side + ' visible geometry stays hand-sized');
    assert(hand.original.every(({node}) => !node.visible), id + side + ' original fingers are not duplicated');
  }
}

for (const personalMotion of [false, true]) {
  test(`v${personalMotion ? 12 : 11} hands are valid on a reduced-motion first frame without advancing time`, async () => {
    const gltf = await loadOffice(), meta = validateOfficeAsset(gltf);
    let runtime;
    try {
      runtime = createTeamRuntime(gltf.scene, meta, {...options, personalMotion});
      assertHandGeometry(runtime); // No animation frame has run yet.
      runtime.setViewModel({actors:meta.actorIds.map(agentId => ({agentId,pose:'idle'})),motionPaused:true});
      runtime.update(0);
      for (let i = 0; i < 60; i++) runtime.update(1 / 60);
      assert.equal(runtime.scheduler.time, 0, 'reduced motion must not advance the scheduler');
      assertHandGeometry(runtime);
    } finally {
      runtime?.dispose();
      releaseStudioAsset(gltf.scene);
    }
  });
}

test('recreating paused hands restores originals and initializes each new surface before rendering', async () => {
  const gltf = await loadOffice(), meta = validateOfficeAsset(gltf);
  let runtime;
  try {
    for (let round = 0; round < 3; round++) {
      runtime = createTeamRuntime(gltf.scene, meta, {...options,personalMotion:true});
      runtime.setViewModel({actors:meta.actorIds.map(agentId => ({agentId,pose:'idle'})),motionPaused:true});
      runtime.update(0);
      assertHandGeometry(runtime);
      const hands = [...runtime.scheduler.handGrips.rows.values()].flatMap(row => [row.L, row.R]);
      runtime.dispose();
      runtime = null;
      for (const hand of hands) {
        assert.equal(hand.root.parent, null);
        assert(hand.original.every(({node,visible}) => node.visible === visible));
      }
    }
  } finally {
    runtime?.dispose();
    releaseStudioAsset(gltf.scene);
  }
});
