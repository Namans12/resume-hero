/* traceArtwork(): artwork ink → one-stroke centerline trace in local coords.
   rasterize → thin → graph (prune/dust/smooth) → route → corner-split → fit. */
import { flattenPath } from './path.mjs';
import { rasterize, chamfer } from './raster.mjs';
import { thin } from './thin.mjs';
import { buildGraph, pruneSpurs, dropDust, smoothChains } from './graph.mjs';
import { route } from './route.mjs';
import { splitAtCorners, fitCurve, toPathD } from './fit.mjs';

const fmt = v => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

// fitCurve (Schneider least-squares) can produce control points that overshoot
// far outside a short/sharp piece's own point cloud when the piece is a couple
// of points long right after a near-right-angle turn (e.g. the straight
// connector between two disconnected components meeting a chain end) — the
// alpha solve blows up because the source tangent is nearly perpendicular to
// the chord. Detect that and fall back to a straight-chord cubic (same
// construction fitCurve itself uses for a bare 2-point piece), which by
// construction can never leave the piece's bounding box.
const straightChord = pts => {
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  const dx = (x1 - x0) / 3, dy = (y1 - y0) / 3;
  return [[x0, y0], [x0 + dx, y0 + dy], [x1 - dx, y1 - dy], [x1, y1]];
};

const fitPieceSafe = (pts, tol) => {
  const bez = fitCurve(pts, tol);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const slackX = Math.max(maxX - minX, 1) * 0.5, slackY = Math.max(maxY - minY, 1) * 0.5;
  const escapes = b => b.some(([x, y]) =>
    x < minX - slackX || x > maxX + slackX || y < minY - slackY || y > maxY + slackY);
  return bez.map(b => (escapes(b) ? straightChord([b[0], b[3]]) : b));
};

export function traceArtwork(spec) {
  const { name, d, bmp: bmpIn = null, crops = null, entryHint, exitHint, toLocal, localScale, fitTol = 0.35, minDustLen } = spec;
  // raster sources (the 2026-07-05 one-line PNGs) hand in a prebuilt ink
  // bitmap; vector sources still go path → raster here
  const bmp = bmpIn ?? rasterize(flattenPath(d, 0.5), { crops });
  const dt = chamfer(bmp);
  const skel = thin(bmp);

  // ink width stats over skeleton pixels (dt units: 3 per pixel of distance)
  let maxHalf = 0, sumHalf = 0, nSk = 0;
  for (let i = 0; i < skel.data.length; i++) {
    if (!skel.data[i]) continue;
    const half = dt[i] / 3;
    if (half > maxHalf) maxHalf = half;
    sumHalf += half; nSk++;
  }
  if (!nSk) throw new Error(`[${name}] empty skeleton`);
  const meanHalf = sumHalf / nSk;

  let g = buildGraph(skel);
  g = pruneSpurs(g, Math.max(3, meanHalf * 1.6));
  // Some auto-traced artworks contain small closed ink loops (an ellipse
  // fringe, a shading fleck) that are genuinely disconnected from the main
  // silhouette even with no crop applied — real ink, not noise, but too far
  // from anything else to bridge with a subtle connector. minDustLen lets a
  // caller raise the bar above the default ink-width-derived threshold to
  // drop those specific components for one artwork, without affecting the
  // formula everywhere else.
  g = dropDust(g, Math.max(minDustLen ?? 7, meanHalf * 2));
  smoothChains(g, 2);
  if (!g.edges.length) throw new Error(`[${name}] graph empty after cleanup`);

  const r = route(g, entryHint, exitHint);
  if (r.stats.unvisited > 0) throw new Error(`[${name}] ${r.stats.unvisited} skeleton edges unreached`);

  const localPts = r.points.map(toLocal);
  const pieces = splitAtCorners(localPts, 75).map(p => fitPieceSafe(p, fitTol));
  const outD = toPathD(pieces, fmt);
  if ((outD.match(/M /g) ?? []).length !== 1) throw new Error(`[${name}] trace is not a single subpath`);
  if (/NaN/.test(outD)) throw new Error(`[${name}] NaN in trace`);

  let routeLen = 0;
  for (let i = 1; i < localPts.length; i++) {
    routeLen += Math.hypot(localPts[i][0] - localPts[i - 1][0], localPts[i][1] - localPts[i - 1][1]);
  }
  return {
    d: outD,
    entry: r.points[0] ? toLocal(r.points[0]) : [0, 0],
    exit: toLocal(r.points[r.points.length - 1]),
    maskW: Math.max(2, maxHalf * 2 * 1.35 * localScale),
    stats: {
      components: r.stats.components,
      connectors: r.stats.connectors,
      connectorLen: r.stats.connectorLen,
      retraceLen: r.stats.retraceLen,
      edgeLen: r.stats.edgeLen,
      routeLen,
      beziers: pieces.reduce((a, p) => a + p.length, 0),
    },
  };
}
