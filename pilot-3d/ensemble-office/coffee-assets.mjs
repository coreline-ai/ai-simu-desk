import * as T from "three";
import { group, mesh, rod, box, material } from "../sample/geometry.mjs";
export function addCoffeeAssets(root) {
  const room = root.getObjectByName("QualityRoom"), metal = material("CoffeeStationSatin", 12501940, 0.36, 0.62), dark = material("CoffeeStationInset", 4739657, 0.66), button = root.getObjectByName("CoffeeMachineDial");
  button.name = "EnsembleCoffeeButton";
  button.userData.ensembleMotion = "coffee-button";
  button.material = material("CoffeeButtonLight", 12044963, 0.5, 0.35);
  button.material.emissive.set(7704400);
  button.material.emissiveIntensity = 0.18;
  rod(room, "CoffeeSpoutArm", [6.02, 1.1, -0.53], [5.86, 1.1, -0.18], 0.012, metal);
  rod(room, "CoffeeSpout", [5.86, 1.1, -0.18], [5.86, 1.045, -0.18], 0.011, metal);
  box(room, "CoffeeDripTray", [0.19, 6e-3, 0.2], [5.91, 0.858, -0.18], dark, 8e-3);
  const drop = group(room, "EnsembleCoffeeCupDrop", [5.86, 0.899, -0.18]);
  drop.rotation.y = Math.PI / 2;
  drop.userData.surfaceKind = "coffee";
  const flow = mesh(room, "EnsembleCoffeeFlow", new T.CylinderGeometry(16e-4, 2e-3, 1, 8), material("CoffeeStream", 7689013, 0.4), [5.86, 0.98, -0.18]);
  flow.scale.y = 0.12;
  flow.visible = false;
  flow.castShadow = false;
  flow.userData.ensembleMotion = "coffee-flow";
  return { point: [5.48, 0, -0.4], facing: Math.PI / 2, drop: drop.name, button: button.name, flow: flow.name, coasterTop: 0.861, baseGap: 5e-4, restLimit: 12, source: "local original coffee station geometry" };
}
