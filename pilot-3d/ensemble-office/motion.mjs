import { GroundedRoute } from "../activities/grounded-route.mjs";
import { ease } from "../sample/motion.mjs";
export const MOTION_PROFILES = { nara: { period: 0.82, arm: 0.018 }, sora: { period: 0.8, arm: 0.025 }, jun: { period: 0.78, arm: 0.016 }, min: { period: 0.84, arm: 0.012 }, leo: { period: 0.86, arm: 0.022 } };
// Retiming drives both the root and planted foot sampling through distanceAt.
export class EnsembleRoute extends GroundedRoute {
  constructor(points, yaw = 0, motion = {}) {
    super(points, yaw, motion);
    let at = 0;
    for (const block of this.parts) {
      block.start = at;
      if (block.kind === "turn") {
        const radians = Math.abs(Math.atan2(Math.sin(block.endYaw - block.yaw), Math.cos(block.endYaw - block.yaw)));
        block.duration = 0.65 + 0.22 * Math.min(1, radians / Math.PI);
      } else {
        block.ramp = Math.min(0.4, block.length / this.speed * 0.22);
        block.duration = block.length / this.speed + block.ramp;
      }
      at += block.duration;
    }
    this.duration = at;
  }
  state() {
    const p = super.state(), block = this.parts.find((b) => this.time < b.start + b.duration) ?? this.parts.at(-1);
    if (!block) return p;
    if (block.kind === "turn") {
      p.ensemblePhase = "pivot";
      p.turnLead = (p.turnLead ?? 0) * 1.35;
      return p;
    }
    const t = Math.min(block.duration, Math.max(0, this.time - block.start)), r = block.ramp;
    p.ensemblePhase = t < r ? "first_step" : t > block.duration - r ? "arrival" : "cruise";
    p.travelLean = 0.012 * (p.gaitFade ?? 0) + (t < r ? 0.035 * Math.sin(Math.PI * t / r) : t > block.duration - r ? -0.025 * Math.sin(Math.PI * (t - block.duration + r) / r) : 0);
    return p;
  }
}
