import * as T from "three";
// A visual skin layer follows the existing fixed-length finger solver.
export class HandSurface {
  constructor(parent, skin, side) {
    this.root = new T.Group();
    this.root.name = "EnsembleHandSurface";
    parent.add(this.root);
    this.geometry = new T.SphereGeometry(1, 10, 7);
    this.joints = new T.InstancedMesh(this.geometry, skin, 5);
    this.joints.name = "EnsembleKnuckles";
    this.joints.castShadow = true;
    this.joints.frustumCulled = false;
    this.joints.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.root.add(this.joints);
    this.nailMaterial = skin.clone();
    this.nailMaterial.color.lerp(new T.Color(16311510), 0.35);
    this.nailMaterial.roughness = 0.48;
    this.nailGeometry = new T.SphereGeometry(1, 8, 6);
    this.nails = new T.InstancedMesh(this.nailGeometry, this.nailMaterial, 5);
    this.nails.name = "EnsembleNails";
    this.nails.userData.ensembleDetail = "high";
    this.nails.frustumCulled = false;
    this.nails.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.root.add(this.nails);
    this.thenar = new T.Mesh(this.geometry, skin);
    this.thenar.name = "EnsembleThumbPad";
    this.thenar.scale.set(0.018, 0.028, 0.017);
    this.thenar.position.set((side === "L" ? -1 : 1) * 0.026, -2e-3, 0.01);
    this.thenar.castShadow = true;
    this.root.add(this.thenar);
    this.node = new T.Object3D();
    this.offset = new T.Vector3();
  }
  update(fingers) {
    for (let i = 0; i < fingers.length; i++) {
      const f = fingers[i], a = f.links[1];
      this.node.position.copy(a.position).multiplyScalar(2).sub(f.pad.position);
      this.node.quaternion.copy(a.quaternion);
      this.node.scale.set(i === 0 ? 9e-3 : 8e-3, 8e-3, 8e-3);
      this.node.updateMatrix();
      this.joints.setMatrixAt(i, this.node.matrix);
      this.offset.set(0, 0, -75e-4).applyQuaternion(a.quaternion);
      this.node.position.copy(a.position).lerp(f.pad.position, 0.45).add(this.offset);
      this.node.quaternion.copy(a.quaternion);
      this.node.scale.set(i === 0 ? 7e-3 : 6e-3, 9e-3, 18e-4);
      this.node.updateMatrix();
      this.nails.setMatrixAt(i, this.node.matrix);
    }
    this.joints.instanceMatrix.needsUpdate = true;
    this.nails.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.root.removeFromParent();
    this.joints.dispose();
    this.nails.dispose();
    this.geometry.dispose();
    this.nailGeometry.dispose();
    this.nailMaterial.dispose();
  }
}
