import { findFinalRoute } from "../final-office/destinations.mjs";
export function coffeeAnchors(meta, id) {
  const o = meta.workspaces[id], local = (p) => [p[0] - o[0], p[1], p[2] - o[2]], start = [o[0], 0, o[2] - 0.48], exit = [o[0] + (id === "leo" ? 1.05 : -1.05), 0, o[2] - 0.48], point = meta.ensembleOffice.coffee.point, colliders = meta.finalOffice.colliders.concat(meta.actorIds.filter((other) => other !== id).map((other) => {
    const [x, , z] = meta.workspaces[other];
    return { id: other + "-seated", min: [x - 0.25, z - 0.8], max: [x + 0.25, z - 0.4] };
  }));
  const route = [start, ...findFinalRoute(exit, point, colliders)];
  return { route: route.map(local), stand: local(point), seated: local(point), facing: meta.ensembleOffice.coffee.facing, stationOrigin: o, colliders, clearance: 0.225, kind: "coffee", seat: "coffee-0" };
}
const groupCache = /* @__PURE__ */ new Map();
export function groupAnchors(meta, id, slot) {
  const key = JSON.stringify([meta.finalOffice.colliders, meta.workspaces, id, slot]);
  if (groupCache.has(key)) return structuredClone(groupCache.get(key));
  const o = meta.workspaces[id], data = meta.finalOffice, seat = meta.ensembleOffice.group.slots[slot], f = [Math.sin(seat.facing), 0, Math.cos(seat.facing)], right = [Math.cos(seat.facing), 0, -Math.sin(seat.facing)], sign = (seat.position[0] > data.meeting.center[0] ? 0.48 : -0.48) * Math.sign(right[0]), stand = seat.position.map((v, k) => v + f[k] * 0.25), approach = stand.map((v, k) => v + right[k] * sign), start = [o[0], 0, o[2] - 0.48], exit = [o[0] + (id === "leo" ? 1.05 : -1.05), 0, o[2] - 0.48], local = (p) => [p[0] - o[0], p[1], p[2] - o[2]], all = data.colliders.concat(meta.actorIds.filter((other) => other !== id).map((other) => {
    const [x, , z] = meta.workspaces[other];
    return { id: other + "-seated", min: [x - 0.25, z - 0.8], max: [x + 0.25, z - 0.4] };
  })), colliders = all.filter((c) => c.id !== "meeting-chair-" + slot), route = [start, ...findFinalRoute(exit, approach, all, { grid: 0.1, offset: 0.05 }), stand], a = { route: route.map(local), stand: local(stand), seated: local(seat.position), facing: seat.facing, hip: 0.505, footOffset: 0, stationOrigin: o, colliders, clearance: 0.225, kind: "meeting", slot, seat: "meeting-" + slot, rug: data.sofa.rug, surfaces: [data.sofa.rug, { shape: "rect", x: data.meeting.center[0], z: data.meeting.center[2], rx: 1.85, rz: 1.9, top: 0.02 }] };
  if (groupCache.size > 250) groupCache.clear();
  groupCache.set(key, a);
  return structuredClone(a);
}
