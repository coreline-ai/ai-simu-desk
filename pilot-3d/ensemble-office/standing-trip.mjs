import { SofaScheduler } from "../activities/scheduler.mjs";
import { ease } from "../sample/motion.mjs";
const angle = (a, b, u) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;
export class StandingTrip extends SofaScheduler {
  enter(stage) {
    super.enter(stage);
    if (stage === "rest") {
      const p = this.anchors.stand, o = this.anchors.stationOrigin;
      this.book.holdSpot?.(this.owner, [p[0] + o[0], 0, p[2] + o[2]]);
    }
  }
  beginHome(points, yaw) {
    this.book.spots?.delete(this.owner);
    super.beginHome(points, yaw);
  }
  tick(raw) {
    if (this.paused || this.disposed) return;
    const dt = Math.max(0, Math.min(0.06, raw));
    if (this.stage === "align") {
      this.time += dt;
      this.elapsed += dt;
      if (this.elapsed >= 0.7) {
        if (this.returning) this.beginHome(this.anchors.route.toReversed(), this.anchors.facing);
        else this.enter("rest");
      }
      return;
    }
    if (this.stage === "rest") {
      this.time += dt;
      this.elapsed += dt;
      if (this.returning && (!this.options.canDepart || this.options.canDepart()) && this.book.request(this.owner, ["walkway"], 0)) this.beginHome(this.anchors.route.toReversed(), this.anchors.facing);
      return;
    }
    super.tick(dt);
  }
  rawPose() {
    if (!["align", "rest"].includes(this.stage)) return super.rawPose();
    const p = this.anchors.stand, u = this.stage === "align" ? Math.min(1, this.elapsed / 0.7) : 1, yaw = angle(this.turnFrom, this.anchors.facing, ease(u));
    return { x: p[0], z: p[2], yaw, hip: 0.84, stand: 1, arms: 0, chair: 1, action: this.stage === "rest" ? "coffee_wait" : "turn", time: this.elapsed, feet: [-0.1, 0.1].map((side, i) => {
      const phase = this.stage === "align" ? i === 0 ? Math.min(1, u * 2) : Math.max(0, u * 2 - 1) : 1, fyaw = angle(this.turnFrom, this.anchors.facing, ease(phase));
      return { position: [p[0] + Math.cos(fyaw) * side, 0.085 + Math.sin(Math.PI * phase) * 0.025, p[2] - Math.sin(fyaw) * side], planted: phase === 0 || phase === 1 };
    }) };
  }
}
