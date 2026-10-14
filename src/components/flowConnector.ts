export type Point = { x: number; y: number };
type Bounds = { left: number; right: number };
type ArtworkBox = Bounds & { top: number; bottom: number; tailTop?: number; lowerRight?: number };
type Station = { point: Point; tangent: Point };
type Node = Station & { handle?: number };

const unit = (v: Point): Point => {
  const length = Math.hypot(v.x, v.y);
  return length > 1e-8 ? { x: v.x / length, y: v.y / length } : { x: 0, y: 1 };
};
const format = (n: number) => String(Math.round(n * 1000) / 1000);
const pair = (p: Point) => `${format(p.x)} ${format(p.y)}`;

/** A continuous ribbon inside the available margin. Handles are shortened
 * along their own direction, never clamped sideways, so endpoint tangents
 * survive narrow layouts. Interior joins share the same tangent direction. */
export function flowConnector(from: Station, to: Station, bounds: Bounds, variant: number, target?: ArtworkBox): string {
  const width = bounds.right - bounds.left;
  const height = to.point.y - from.point.y;
  const middle = (bounds.left + bounds.right) / 2;
  const handle = (p: Point, v: Point, distance: number, sign: number) => {
    const t = unit(v);
    const dx = t.x * sign;
    const available = dx > 1e-8 ? (bounds.right - p.x) / dx
      : dx < -1e-8 ? (bounds.left - p.x) / dx : Infinity;
    const length = Math.max(0, Math.min(distance, available * 0.98));
    return { x: p.x + t.x * length * sign, y: p.y + t.y * length * sign };
  };
  let d = `M ${pair(from.point)}`;
  let current: Node = from;
  const join = (next: Node) => {
    const chord = Math.hypot(next.point.x - current.point.x, next.point.y - current.point.y);
    const reach = Math.min(chord * 0.38, height * 0.17, 140);
    d += ` C ${pair(handle(current.point, current.tangent, current.handle ?? reach, 1))}`
      + ` ${pair(handle(next.point, next.tangent, next.handle ?? reach, -1))} ${pair(next.point)}`;
    current = next;
  };

  // Some original one-line drawings begin at a lower tail. Approach that
  // tail outside the drawing, rather than cutting through untraced details.
  const lowerEntry = target && to.point.y - target.top > 80;
  if (lowerEntry) {
    const lane = Math.min(bounds.right, target.right + 8);
    const shoulder = Math.max(from.point.y + 20, target.top - 30);
    join({ point: { x: lane, y: shoulder }, tangent: { x: 0, y: 1 } });
    if (target.lowerRight !== undefined && target.lowerRight <= to.point.x + 1) {
      // The graph widens at its arrowhead but narrows to the last bar below.
      // A soft hook through that clear lower space avoids a box-shaped border.
      const turn = Math.max(shoulder + 20, (target.tailTop ?? target.top) + 10);
      join({ point: { x: lane, y: turn }, tangent: { x: 0, y: 1 } });
      current.handle = Math.max(20, target.bottom + 18 - turn);
      join({ ...to, handle: Math.max(18, target.bottom + 16 - to.point.y) });
      return d;
    }
    const bottom = Math.max(target.bottom + 26, to.point.y + 26);
    join({ point: { x: lane, y: bottom }, tangent: { x: 0, y: 1 } });
    join({ point: { x: to.point.x, y: bottom + 16 }, tangent: { x: -1, y: 0 }, handle: 18 });
    join(to);
    return d;
  }
  if (height < 220 || width < 100) {
    join(to);
    return d;
  }

  // Distinct open gestures: neck drift, broad S, rising arch, exhaust wave,
  // a quiet bow, and the handoff sweep. Every join shares its tangent.
  const profiles = [
    [[0.14, 0.30], [0.86, 0.69]],
    [[0.90, 0.32], [0.12, 0.67]],
    [[0.92, 0.52]],
    [[0.10, 0.24], [0.88, 0.57], [0.36, 0.82]],
    [[0.05, 0.53]],
    [[0.90, 0.29], [0.14, 0.71]],
  ];
  for (const [x, y] of profiles[((variant % 6) + 6) % 6]) {
    join({ point: { x: middle + (x - 0.5) * width, y: from.point.y + y * height }, tangent: { x: 0, y: 1 } });
  }
  join(to);
  return d;
}
