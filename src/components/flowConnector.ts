export type Point = { x: number; y: number };
type Bounds = { left: number; right: number };
type ArtworkBox = Bounds & { top: number; bottom: number; tailTop?: number; lowerRight?: number };
type Station = { point: Point; tangent: Point };
type Node = Station & { handle?: number };
/** Optional decoration for a single hop: a chain of oval loops, or a heart
 * knot. Connectors without one are emitted exactly as before. */
export type Flourish = {
  kind: 'ovals' | 'heart';
  /** Rightmost settled content pixel between two host y's (0 if none). Lets
   * a flourish leave the reserved gutter for genuinely empty space beside
   * the content, rather than staying squeezed against the right edge. */
  freeLeft?: (top: number, bottom: number) => number;
};
// Clearance kept from any content when a flourish leaves the gutter.
const CLEAR = 40;
// How far left of the gutter's right edge a flourish may ever reach.
const REACH = 620;

const unit = (v: Point): Point => {
  const length = Math.hypot(v.x, v.y);
  return length > 1e-8 ? { x: v.x / length, y: v.y / length } : { x: 0, y: 1 };
};
const format = (n: number) => String(Math.round(n * 1000) / 1000);
const pair = (p: Point) => `${format(p.x)} ${format(p.y)}`;

/** A rotated ellipse: position and derivative at parameter t. */
const ellipse = (c: Point, a: number, b: number, phi: number) => {
  const cos = Math.cos(phi), sin = Math.sin(phi);
  return {
    at: (t: number): Point => ({
      x: c.x + a * Math.cos(t) * cos - b * Math.sin(t) * sin,
      y: c.y + a * Math.cos(t) * sin + b * Math.sin(t) * cos,
    }),
    dt: (t: number): Point => ({
      x: -a * Math.sin(t) * cos - b * Math.cos(t) * sin,
      y: -a * Math.sin(t) * sin + b * Math.cos(t) * cos,
    }),
  };
};

/** A continuous ribbon inside the available margin. Handles are shortened
 * along their own direction, never clamped sideways, so endpoint tangents
 * survive narrow layouts. Interior joins share the same tangent direction. */
export function flowConnector(from: Station, to: Station, bounds: Bounds, variant: number, target?: ArtworkBox, flourish?: Flourish): string {
  const width = bounds.right - bounds.left;
  const height = to.point.y - from.point.y;
  const middle = (bounds.left + bounds.right) / 2;
  // The horizontal limit handles are shortened against. Identical to `bounds`
  // for every plain connector; a flourish widens it to the free space it has
  // measured, otherwise any handle reaching left of the gutter would be
  // clipped to nothing and leave a kink.
  const edge = { left: bounds.left, right: bounds.right };
  const roomLeft = (top: number, bottom: number) => flourish?.freeLeft
    ? Math.max(flourish.freeLeft(top, bottom) + CLEAR, bounds.right - REACH)
    : bounds.left;
  const handle = (p: Point, v: Point, distance: number, sign: number) => {
    const t = unit(v);
    const dx = t.x * sign;
    const available = dx > 1e-8 ? (edge.right - p.x) / dx
      : dx < -1e-8 ? (edge.left - p.x) / dx : Infinity;
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

  /* Trace part of an ellipse from parameter t0 by `sweep` radians, as cubic
     pieces of at most 90deg each (k = 4/3 tan(step/4) is the standard arc
     fit). Leaves `current` on the ellipse with its true direction of travel,
     so the next join continues tangentially. */
  const arc = (e: ReturnType<typeof ellipse>, t0: number, sweep: number) => {
    const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const step = sweep / pieces;
    const k = (4 / 3) * Math.tan(step / 4);
    for (let i = 0; i < pieces; i++) {
      const a = t0 + step * i, b = a + step;
      const p0 = e.at(a), p3 = e.at(b), d0 = e.dt(a), d3 = e.dt(b);
      d += ` C ${pair({ x: p0.x + d0.x * k, y: p0.y + d0.y * k })}`
        + ` ${pair({ x: p3.x - d3.x * k, y: p3.y - d3.y * k })} ${pair(p3)}`;
    }
    const tan = e.dt(t0 + sweep);
    const s = Math.sign(sweep);
    current = { point: e.at(t0 + sweep), tangent: unit({ x: tan.x * s, y: tan.y * s }) };
  };

  /* One cursive loop: enter the oval at parameter t0 along its direction of
     travel (sense 1 = clockwise on screen), go most of the way round, and
     stop `gap` radians short of the entry - so the outgoing stroke crosses
     the incoming one, the way a hand-written loop does. */
  const loop = (c: Point, a: number, b: number, sense: 1 | -1, t0: number, gap: number) => {
    const e = ellipse(c, a, b, 0);
    const v = e.dt(t0);
    join({ point: e.at(t0), tangent: unit({ x: v.x * sense, y: v.y * sense }) });
    arc(e, t0, sense * (Math.PI * 2 - gap));
  };

  // Some original one-line drawings begin at a lower tail. Approach that
  // tail outside the drawing, rather than cutting through untraced details.
  const lowerEntry = target && to.point.y - target.top > 80;
  if (lowerEntry) {
    const lane = Math.min(bounds.right, target.right + 8);
    const shoulder = Math.max(from.point.y + 20, target.top - 30);
    /* Oval loops through the open stretch above the drawing, then the same
       lane approach as before - so the join into the artwork is unchanged.
       Sized from the space actually available; skipped where it's too
       tight to read as loops rather than a scribble. */
    const span = shoulder - from.point.y;
    if (flourish?.kind === 'ovals' && span >= 280 && width >= 150) {
      /* Four small round loops in a cursive hand, after a sketch: a hook
         under the first, down round the second, back left over to the
         third, then a long drop into a swoop that curls up through the
         fourth and out toward the lane. Directions alternate and every loop
         crosses its own stroke. Laid out in a 537px-tall frame whose loops
         sit 40-230px left of the drawing above, scaled to the room that is
         really free beside the content here - and slid right, under the
         drawing, where that room is tight. */
      const sy = span / 537;
      const lo = roomLeft(from.point.y + span * 0.25, from.point.y + span * 0.86);
      const hi = bounds.right - 6;
      const k = Math.min(1.15, sy * 1.1, Math.max((from.point.x - lo) / 225, Math.min(0.8, (hi - lo) / 195)));
      if (k >= 0.6) {
        const ox = Math.min(Math.max(from.point.x, lo + 230 * k), hi + 40 * k);
        const at = (x: number, y: number) => ({ x: ox + x * k, y: from.point.y + y * sy });
        edge.left = Math.min(bounds.left, ox - 230 * k);
        loop(at(-70, 136), 23 * k, 31 * k, 1, Math.PI / 2, 1.0);
        loop(at(-92, 267), 25 * k, 31 * k, -1, Math.PI, 1.55);
        loop(at(-196, 192), 24 * k, 34 * k, 1, Math.PI / 2, 1.0);
        join({ point: at(-186, 380), tangent: { x: 0, y: 1 } });
        join({ point: at(-140, 446), tangent: { x: 1, y: 0 } });
        loop(at(-108, 380), 26 * k, 28 * k, -1, 0, 1.4);
        edge.left = bounds.left;
      }
    }
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

  /* A heart tied in one stroke, ribbon-style, like a hand-drawn love knot:
     a long tail swoops in from the left and rises into the tip, up the right
     side, round the right lobe, sharply into the centre dimple, round the
     left lobe, down the left side into the tip - crossing the incoming tail
     there - and out as a second tail toward the next drawing's unchanged
     entry.

     The tails leave the tip along the sides' own directions, so the tip is a
     crisp X; the only corner is the dimple. */
  if (flourish?.kind === 'heart' && height >= 560) {
    const hy = from.point.y + height * 0.44;
    const right = bounds.right - 12;
    // Size from the room the measured free space actually leaves at the
    // heart's own height: the left tail needs ~2.2W, the right lobe ~1W.
    let W = 96, H = 0, L = bounds.left;
    for (; W >= 48; W -= 4) {
      H = W * 1.5;
      L = roomLeft(hy - 1.2 * W - 20, hy + 1.15 * H + 20);
      if (right - L >= 3.25 * W) break;
    }
    if (W >= 48) {
      const lo = L + 2.2 * W, hi = right - W;
      const hx = lo + (hi - lo) * 0.5;
      /* A brush-drawn outline rather than a geometric one: as tall as it is
         wide, a fuller right lobe, the tip set a little left of centre, and
         both sides bowing outward as they sweep down into it. Laid out in
         units of W from the heart's top centre. */
      const tip = { x: hx - 0.18 * W, y: hy + 0.74 * W };
      const top = tip.y - 1.88 * W;
      const at = (u: number, v: number) => ({ x: hx + u * W, y: top + v * W });
      const up = unit({ x: 0.78, y: -0.62 });    // right side, leaving the tip
      const down = unit({ x: 0.55, y: 0.84 });   // left side, arriving at it
      edge.left = Math.min(bounds.left, L);

      // A soft bow out from the drawing above, so the long descent into the
      // tail isn't a ruler-straight line pinned to the margin.
      join({ point: { x: Math.max(L + 10, hx - 1.1 * W), y: from.point.y + height * 0.16 }, tangent: { x: 0, y: 1 } });
      // The incoming tail: down the left, a rounded turn well clear of the
      // heart, then a long straight rise into the tip along the right side's
      // own slant.
      join({ point: { x: hx - 2.05 * W, y: tip.y - 0.2 * H }, tangent: { x: 0, y: 1 } });
      join({ point: { x: hx - 1.45 * W, y: tip.y + 0.46 * H }, tangent: unit({ x: 1, y: -0.18 }), handle: W * 0.55 });
      join({ point: tip, tangent: up, handle: W * 0.62 });
      // The outline, counter-clockwise: a long outward sweep up the right
      // side, round the larger right lobe, down into a sharp dimple, round
      // the smaller left lobe, and a fuller curve back down into the tip.
      join({ point: at(0.96, 0.7), tangent: unit({ x: 0.08, y: -1 }), handle: W * 0.36 });
      join({ point: at(0.47, 0), tangent: { x: -1, y: 0 }, handle: W * 0.27 });
      join({ point: at(-0.1, 0.42), tangent: unit({ x: -0.35, y: 1 }), handle: W * 0.2 });
      current = { point: current.point, tangent: unit({ x: -0.45, y: -1 }), handle: W * 0.16 };
      join({ point: at(-0.5, 0.13), tangent: { x: -1, y: 0 }, handle: W * 0.25 });
      join({ point: at(-0.96, 0.72), tangent: { x: 0, y: 1 }, handle: W * 0.38 });
      join({ point: tip, tangent: down, handle: W * 0.5 });
      current = { point: tip, tangent: down, handle: W * 0.62 };
      edge.left = bounds.left;
      // The outgoing tail: carries straight on past the tip, then eases out
      // through the open right-hand space and into the next entry.
      join({
        point: { x: Math.min(right - 2, hx + 1.05 * W), y: tip.y + (to.point.y - tip.y) * 0.5 },
        tangent: { x: 0, y: 1 },
      });
      join(to);
      return d;
    }
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
