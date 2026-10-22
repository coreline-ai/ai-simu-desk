import * as T from "three";
import { part } from "../sample/character-rig.mjs";
import { sphere, mesh } from "../sample/geometry.mjs";
export function addWardrobe(actor) {
  const pre = actor.userData.prefix, folds = [];
  for (const side of ["L", "R"]) {
    const shoulder = part(actor, "NaraShoulder" + side), elbow = part(actor, "NaraElbow" + side), knee = part(actor, "NaraKnee" + side), foot = part(actor, "NaraFoot" + side), cuff = part(actor, "Cuff" + side).material, pants = part(actor, "HipCover" + side).material;
    const seam = mesh(shoulder, pre + "SleeveSeam" + side, new T.TorusGeometry(0.074, 15e-4, 4, 20), cuff, [0, -0.1, 0]);
    seam.rotation.x = Math.PI / 2;
    seam.userData.ensembleDetail = "high";
    const a = sphere(elbow, pre + "ElbowSoftFold" + side, [0.052, 0.018, 0.05], [0, -0.01, 0], cuff), b = sphere(knee, pre + "KneeSoftFold" + side, [0.056, 0.017, 0.055], [0, -5e-3, 1e-3], pants);
    a.userData.ensembleMotion = "fold";
    b.userData.ensembleMotion = "fold";
    a.userData.ensembleDetail = b.userData.ensembleDetail = "high";
    folds.push(a.name, b.name);
    const geometry = new T.BufferGeometry().setFromPoints([[-0.035, 0.012, 0.102], [0, 0.014, 0.11], [0, 0.014, 0.11], [0.035, 0.012, 0.102], [-0.041, 6e-3, -0.025], [0.041, 6e-3, -0.025]].map((p) => new T.Vector3(...p))), stitch = new T.LineSegments(geometry, new T.LineBasicMaterial({ color: 13748150 }));
    stitch.name = pre + "ShoeStitch" + side;
    stitch.userData.ensembleDetail = "high";
    foot.add(stitch);
  }
  return { folds, shoes: ["L", "R"].map((side) => pre + "ShoeStitch" + side), source: "original local joint-following garment detail" };
}
