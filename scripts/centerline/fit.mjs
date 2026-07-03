/* Piecewise-cubic least-squares fitting (Schneider, Graphics Gems 1990)
   plus corner splitting so junction turns stay crisp. */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const norm = a => Math.hypot(a[0], a[1]);
const normalize = a => { const n = norm(a) || 1; return [a[0] / n, a[1] / n]; };

export function splitAtCorners(points, angleDeg = 75) {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  if (pts.length < 3) return [pts];
  const W = 3; // direction window — spans raster jitter
  const cosLimit = Math.cos((angleDeg * Math.PI) / 180);
  const cuts = [0];
  for (let i = W; i < pts.length - W; i++) {
    const din = normalize(sub(pts[i], pts[Math.max(0, i - W)]));
    const dout = normalize(sub(pts[Math.min(pts.length - 1, i + W)], pts[i]));
    if (dot(din, dout) < cosLimit && i - cuts[cuts.length - 1] >= W) cuts.push(i);
  }
  cuts.push(pts.length - 1);
  const pieces = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const piece = pts.slice(cuts[c], cuts[c + 1] + 1);
    if (piece.length >= 2) pieces.push(piece);
  }
  return pieces;
}

const bezPoint = (b, t) => {
  const r = 1 - t;
  return [
    r * r * r * b[0][0] + 3 * r * r * t * b[1][0] + 3 * r * t * t * b[2][0] + t * t * t * b[3][0],
    r * r * r * b[0][1] + 3 * r * r * t * b[1][1] + 3 * r * t * t * b[2][1] + t * t * t * b[3][1],
  ];
};

export function fitCurve(points, maxError) {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  if (pts.length < 2) return [];
  if (pts.length === 2) {
    const t = mul(sub(pts[1], pts[0]), 1 / 3);
    return [[pts[0], add(pts[0], t), sub(pts[1], t), pts[1]]];
  }
  const leftTangent = normalize(sub(pts[1], pts[0]));
  const rightTangent = normalize(sub(pts[pts.length - 2], pts[pts.length - 1]));
  return fitCubic(pts, leftTangent, rightTangent, maxError);
}

function fitCubic(pts, tHat1, tHat2, err) {
  if (pts.length === 2) {
    const d = norm(sub(pts[1], pts[0])) / 3;
    return [[pts[0], add(pts[0], mul(tHat1, d)), add(pts[1], mul(tHat2, d)), pts[1]]];
  }
  let u = chordLengthParameterize(pts);
  let bez = generateBezier(pts, u, tHat1, tHat2);
  let [maxErr, splitPoint] = computeMaxError(pts, bez, u);
  if (maxErr < err) return [bez];
  if (maxErr < err * err) {
    for (let i = 0; i < 4; i++) {
      u = reparameterize(pts, u, bez);
      bez = generateBezier(pts, u, tHat1, tHat2);
      [maxErr, splitPoint] = computeMaxError(pts, bez, u);
      if (maxErr < err) return [bez];
    }
  }
  // split at max-error point and recurse
  const centerTangent = normalize(sub(pts[splitPoint - 1], pts[splitPoint + 1]));
  const left = fitCubic(pts.slice(0, splitPoint + 1), tHat1, centerTangent, err);
  const right = fitCubic(pts.slice(splitPoint), mul(centerTangent, -1), tHat2, err);
  return [...left, ...right];
}

function chordLengthParameterize(pts) {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + norm(sub(pts[i], pts[i - 1])));
  const total = u[u.length - 1] || 1;
  return u.map(v => v / total);
}

function generateBezier(pts, u, tHat1, tHat2) {
  const n = pts.length;
  const A = u.map(t => {
    const r = 1 - t;
    return [mul(tHat1, 3 * r * r * t), mul(tHat2, 3 * r * t * t)];
  });
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  const first = pts[0], last = pts[n - 1];
  for (let i = 0; i < n; i++) {
    const t = u[i], r = 1 - t;
    c00 += dot(A[i][0], A[i][0]);
    c01 += dot(A[i][0], A[i][1]);
    c11 += dot(A[i][1], A[i][1]);
    const tmp = sub(pts[i], add(
      mul(first, r * r * r + 3 * r * r * t),
      mul(last, 3 * r * t * t + t * t * t),
    ));
    x0 += dot(A[i][0], tmp);
    x1 += dot(A[i][1], tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let alphaL = 0, alphaR = 0;
  if (Math.abs(det) > 1e-12) {
    alphaL = (c11 * x0 - c01 * x1) / det;
    alphaR = (c00 * x1 - c01 * x0) / det;
  }
  const segLen = norm(sub(last, first));
  const eps = 1e-6 * segLen;
  if (alphaL < eps || alphaR < eps) alphaL = alphaR = segLen / 3;
  return [first, add(first, mul(tHat1, alphaL)), add(last, mul(tHat2, alphaR)), last];
}

function computeMaxError(pts, bez, u) {
  let maxDist = 0, splitPoint = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = bezPoint(bez, u[i]);
    const d = dot(sub(p, pts[i]), sub(p, pts[i]));
    if (d > maxDist) { maxDist = d; splitPoint = i; }
  }
  return [Math.sqrt(maxDist), splitPoint];
}

function reparameterize(pts, u, bez) {
  return u.map((t, i) => newtonRaphson(bez, pts[i], t));
}

function newtonRaphson(b, p, t) {
  const d = bezPoint(b, t);
  const qp = sub(d, p);
  const d1 = [
    3 * ((1 - t) * (1 - t) * (b[1][0] - b[0][0]) + 2 * (1 - t) * t * (b[2][0] - b[1][0]) + t * t * (b[3][0] - b[2][0])),
    3 * ((1 - t) * (1 - t) * (b[1][1] - b[0][1]) + 2 * (1 - t) * t * (b[2][1] - b[1][1]) + t * t * (b[3][1] - b[2][1])),
  ];
  const d2 = [
    6 * ((1 - t) * (b[2][0] - 2 * b[1][0] + b[0][0]) + t * (b[3][0] - 2 * b[2][0] + b[1][0])),
    6 * ((1 - t) * (b[2][1] - 2 * b[1][1] + b[0][1]) + t * (b[3][1] - 2 * b[2][1] + b[1][1])),
  ];
  const num = dot(qp, d1);
  const den = dot(d1, d1) + dot(qp, d2);
  if (Math.abs(den) < 1e-12) return t;
  return Math.min(1, Math.max(0, t - num / den));
}

export function toPathD(pieces, fmt) {
  let d = '';
  let cur = null;
  for (const bezs of pieces) {
    for (const b of bezs) {
      if (!d) d = `M ${fmt(b[0][0])} ${fmt(b[0][1])}`;
      else if (!cur || fmt(cur[0]) !== fmt(b[0][0]) || fmt(cur[1]) !== fmt(b[0][1])) {
        d += ` L ${fmt(b[0][0])} ${fmt(b[0][1])}`;
      }
      d += ` C ${fmt(b[1][0])} ${fmt(b[1][1])} ${fmt(b[2][0])} ${fmt(b[2][1])} ${fmt(b[3][0])} ${fmt(b[3][1])}`;
      cur = b[3];
    }
  }
  return d;
}
