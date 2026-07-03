# Single-Path Diagram Tracing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The scroll line becomes one fully traced journey: the pen dot travels a single continuous path containing the complete centerline of every stroke of all seven artworks, and each artwork's original ink is revealed exactly under the dot (mask stroke riding the trace), replacing the horizontal wipe reveals.

**Architecture:** An offline centerline pipeline in the generator (rasterize ink → Zhang–Suen thinning → skeleton graph → greedy full-coverage route with invisible retraces + shortest connectors → cubic Bézier fit) emits full one-stroke traces into `sketchPaths.ts` in the existing `SKETCHES` format. At runtime, `ScrollPath.tsx` welds those traces into the one global path as it already does with the partial rides, deletes the wipe system, and reveals each artwork's accent ink through a `<mask>` whose content is a wide white stroke of that artwork's trace, dash-animated on keyframes derived from the same stops array as the dot — so ink appears exactly under the pen.

**Tech Stack:** Node 22 (built-in `node:test` runner, plain ESM `.mjs`), React 19 + TypeScript in `src/components/ScrollPath.tsx`, CSS scroll-driven animations (`animation-timeline: scroll()`), Vite 8.

**Spec:** `docs/superpowers/specs/2026-07-03-single-path-diagram-tracing-design.md`

## Global Constraints

- LOCKED (from ScrollPath.tsx header, do not change): the start anchor (About heading), `FRONTIER = 0.80`, and the CSS-driven draw mechanism (`pathLength=100` + `--sp-start`/`--sp-end`).
- The welded global path must remain ONE subpath: every station trace is welded with its leading `M` replaced by `L` (mid-path `M` breaks Blink's dash-vs-offset sync).
- Path number formatting everywhere: round to 0.1 via the existing `fmt`/`n1` idiom; NEVER run arc flags through a number formatter.
- Trace `d` strings may contain only absolute `M`/`C`/`L` (that is all `transformPath`/`transformPathAffine` support, minus unused `Q`/`A`).
- Traces must respect each artwork's crop rects — the pen must never trace ink that the crop clips invisible.
- Generator hard-fails (throw → exit 1) if any artwork's trace leaves skeleton edges unvisited, produces more than one subpath, or exceeds fit tolerance.
- Artwork ink reveal must never appear ahead of the dot; each diagram must be fully inked when the dot exits it.
- Desktop only (`min-width: 1024px`), unchanged.
- Vecteezy artworks stay pixel-faithful — the `*_ART` fill paths and their crop clipPaths are untouched.
- Test command for pipeline modules: `node --test 'scripts/centerline/*.test.mjs'` (the bare-directory form `node --test scripts/centerline/` fails under this project's `"type": "module"` — Node's CJS loader intercepts the directory arg before the test runner's glob does; discovered during Task 3 review, 2026-07-03).
- Commit after every task (frequent commits); commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
scripts/centerline/
  path.mjs        SVG path-data parser + flattener → polylines
  path.test.mjs
  raster.mjs      nonzero scanline rasterizer + crop masking; chamfer DT
  raster.test.mjs
  thin.mjs        Zhang–Suen thinning
  thin.test.mjs
  graph.mjs       skeleton → node/edge graph, spur prune, dust drop, smoothing
  graph.test.mjs
  route.mjs       full-coverage one-stroke route (retraces + connectors)
  route.test.mjs
  fit.mjs         corner split + Schneider cubic fit → d string
  fit.test.mjs
  index.mjs       traceArtwork() orchestrator + quality gates
  index.test.mjs
scripts/generate-sketch-paths.mjs   rewritten: pipeline calls replace hand motifs
src/components/sketchPaths.ts       regenerated (SKETCHES = full traces + maskW)
src/components/ScrollPath.tsx       wipes → pen-synced masks, sync, pacing
```

Coordinate spaces, used consistently below:
- **art coords** — the source SVG's coordinate space (what `*_ART.d` is in).
- **local coords** — a motif's `vb` box: `local = (art − offset) · scale` (about: offset `[595,960]`, scale `1/6`; experience/projects/achievements/certifications: their `offset`, scale `1/5`; skills: `local = [(artY−1468)/5, (2842−artX)/5]`; hands: identity — stays in art coords).
- **canvas coords** — ScrollPath's SVG viewBox (`transformPath(def.d, s, dx, dy)` maps local → canvas).

---

### Task 1: Path flattener (`scripts/centerline/path.mjs`)

**Files:**
- Create: `scripts/centerline/path.mjs`
- Test: `scripts/centerline/path.test.mjs`

**Interfaces:**
- Produces: `flattenPath(d: string, tol = 0.5): Array<Array<[number, number]>>` — one polyline per subpath, absolute coords, curves flattened; subpaths are treated as closed by consumers. Throws on `A`/`a` commands and malformed numbers.

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/path.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenPath } from './path.mjs';

test('flattens M/L/H/V/Z into one closed polyline', () => {
  const polys = flattenPath('M 10 10 L 30 10 V 30 H 10 Z');
  assert.equal(polys.length, 1);
  const p = polys[0];
  assert.deepEqual(p[0], [10, 10]);
  assert.deepEqual(p[1], [30, 10]);
  assert.deepEqual(p[2], [30, 30]);
  assert.deepEqual(p[3], [10, 30]);
  assert.deepEqual(p[p.length - 1], [10, 10]); // Z closes back
});

test('relative commands and implicit repeats', () => {
  const polys = flattenPath('m 5 5 l 10 0 10 0 m 0 10 l 0 5');
  assert.equal(polys.length, 2);
  assert.deepEqual(polys[0], [[5, 5], [15, 5], [25, 5]]);
  assert.deepEqual(polys[1], [[25, 15], [25, 20]]);
});

test('cubic and smooth-cubic land on exact endpoints', () => {
  const polys = flattenPath('M 0 0 C 0 10 10 10 10 0 s 10 -10 10 0');
  const p = polys[0];
  assert.deepEqual(p[0], [0, 0]);
  // curve endpoints appear exactly
  assert.ok(p.some(([x, y]) => x === 10 && y === 0));
  const [ex, ey] = p[p.length - 1];
  assert.ok(Math.abs(ex - 20) < 1e-9 && Math.abs(ey - 0) < 1e-9);
  assert.ok(p.length > 10); // actually flattened, not just endpoints
});

test('quadratic q/t supported', () => {
  const p = flattenPath('M 0 0 q 5 10 10 0 t 10 0')[0];
  const [ex, ey] = p[p.length - 1];
  assert.ok(Math.abs(ex - 20) < 1e-9 && Math.abs(ey) < 1e-9);
});

test('rejects arcs', () => {
  assert.throws(() => flattenPath('M 0 0 A 5 5 0 0 1 10 0'), /arc/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/path.test.mjs`
Expected: FAIL — `Cannot find module ... path.mjs`

- [ ] **Step 3: Write the implementation**

```js
// scripts/centerline/path.mjs
/* SVG path-data → flat polylines (absolute coords). Supports
   M m L l H h V v C c S s Q q T t Z z. Arcs are rejected — none of the
   artworks contain them, and arc flags are hazardous to reformat. */

export function flattenPath(d, tol = 0.5) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g) ?? [];
  let i = 0;
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  const num = () => {
    const v = parseFloat(tokens[i++]);
    if (Number.isNaN(v)) throw new Error(`bad number at token ${i - 1}: ${tokens[i - 1]}`);
    return v;
  };

  const polys = [];
  let poly = null;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let pcx = null, pcy = null; // prev cubic ctrl2 (for S/s)
  let pqx = null, pqy = null; // prev quad ctrl (for T/t)

  const moveTo = (x, y) => { cx = x; cy = y; sx = x; sy = y; poly = [[x, y]]; polys.push(poly); };
  const lineTo = (x, y) => { poly.push([x, y]); cx = x; cy = y; };
  const cubicTo = (x1, y1, x2, y2, x, y) => {
    const n = Math.min(64, Math.max(6, Math.ceil(
      (Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / (3 * tol),
    )));
    for (let k = 1; k <= n; k++) {
      const t = k / n, r = 1 - t;
      poly.push([
        r * r * r * cx + 3 * r * r * t * x1 + 3 * r * t * t * x2 + t * t * t * x,
        r * r * r * cy + 3 * r * r * t * y1 + 3 * r * t * t * y2 + t * t * t * y,
      ]);
    }
    cx = x; cy = y;
  };
  const quadTo = (x1, y1, x, y) => {
    const ax = cx, ay = cy; // capture before cubicTo mutates cx/cy
    cubicTo(ax + (2 / 3) * (x1 - ax), ay + (2 / 3) * (y1 - ay),
      x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x, y);
  };

  while (i < tokens.length) {
    const c = tokens[i++];
    let x1, y1, x2, y2, x, y;
    switch (c) {
      case 'M': x = num(); y = num(); moveTo(x, y);
        while (isNum()) { x = num(); y = num(); lineTo(x, y); } break;
      case 'm': x = cx + num(); y = cy + num(); moveTo(x, y);
        while (isNum()) { x = cx + num(); y = cy + num(); lineTo(x, y); } break;
      case 'L': do { x = num(); y = num(); lineTo(x, y); } while (isNum()); break;
      case 'l': do { x = cx + num(); y = cy + num(); lineTo(x, y); } while (isNum()); break;
      case 'H': do { lineTo(num(), cy); } while (isNum()); break;
      case 'h': do { lineTo(cx + num(), cy); } while (isNum()); break;
      case 'V': do { lineTo(cx, num()); } while (isNum()); break;
      case 'v': do { lineTo(cx, cy + num()); } while (isNum()); break;
      case 'C': do { x1 = num(); y1 = num(); x2 = num(); y2 = num(); x = num(); y = num();
        cubicTo(x1, y1, x2, y2, x, y); pcx = x2; pcy = y2; } while (isNum()); break;
      case 'c': do { x1 = cx + num(); y1 = cy + num(); x2 = cx + num(); y2 = cy + num();
        x = cx + num(); y = cy + num();
        cubicTo(x1, y1, x2, y2, x, y); pcx = x2; pcy = y2; } while (isNum()); break;
      case 'S': case 's': do {
        x1 = pcx !== null ? 2 * cx - pcx : cx; y1 = pcy !== null ? 2 * cy - pcy : cy;
        if (c === 'S') { x2 = num(); y2 = num(); x = num(); y = num(); }
        else { x2 = cx + num(); y2 = cy + num(); x = cx + num(); y = cy + num(); }
        cubicTo(x1, y1, x2, y2, x, y); pcx = x2; pcy = y2;
      } while (isNum()); break;
      case 'Q': do { x1 = num(); y1 = num(); x = num(); y = num();
        quadTo(x1, y1, x, y); pqx = x1; pqy = y1; } while (isNum()); break;
      case 'q': do { x1 = cx + num(); y1 = cy + num(); x = cx + num(); y = cy + num();
        quadTo(x1, y1, x, y); pqx = x1; pqy = y1; } while (isNum()); break;
      case 'T': case 't': do {
        x1 = pqx !== null ? 2 * cx - pqx : cx; y1 = pqy !== null ? 2 * cy - pqy : cy;
        if (c === 'T') { x = num(); y = num(); } else { x = cx + num(); y = cy + num(); }
        quadTo(x1, y1, x, y); pqx = x1; pqy = y1;
      } while (isNum()); break;
      case 'Z': case 'z': lineTo(sx, sy); break;
      case 'A': case 'a': throw new Error('arc commands unsupported (none expected in artworks)');
      default: throw new Error(`unsupported path command: ${c}`);
    }
    // smooth-reflection state only survives across C/S (cubic) or Q/T (quad)
    if (!'CcSs'.includes(c)) { pcx = pcy = null; }
    if (!'QqTt'.includes(c)) { pqx = pqy = null; }
  }
  return polys;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/centerline/path.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/path.mjs scripts/centerline/path.test.mjs
git commit -m "feat(centerline): SVG path flattener

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Rasterizer + distance transform (`scripts/centerline/raster.mjs`)

**Files:**
- Create: `scripts/centerline/raster.mjs`
- Test: `scripts/centerline/raster.test.mjs`

**Interfaces:**
- Consumes: polylines from `flattenPath`.
- Produces:
  - `rasterize(polys, { crops = null, pad = 3 } = {}): { data: Uint8Array, w: number, h: number, ox: number, oy: number }` — 1 = ink. Nonzero winding, every subpath treated as closed. `crops` = array of `[x, y, w, h]` in the SAME coords as the polylines; pixels whose center lies outside the crop union are cleared. Pixel `(c, r)` covers point `(ox + c + 0.5, oy + r + 0.5)`.
  - `chamfer(bmp): Float64Array` — 3-4 chamfer distance to background, in units of 3 per pixel (i.e. `dt[i] / 3` ≈ distance in px). 0 on background.

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/raster.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { rasterize, chamfer } from './raster.mjs';
import { flattenPath } from './path.mjs';

const count = bmp => bmp.data.reduce((a, v) => a + v, 0);

const px = (bmp, x, y) => {
  const c = Math.floor(x - bmp.ox), r = Math.floor(y - bmp.oy);
  return bmp.data[r * bmp.w + c];
};

test('fills a rectangle', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 20 V 10 H 0 Z'));
  assert.equal(px(bmp, 10.5, 5.5), 1);
  assert.equal(px(bmp, -2.5, 5.5), 0);
  assert.ok(count(bmp) >= 18 * 8 && count(bmp) <= 22 * 12);
});

test('nonzero winding: same-direction inner loop stays filled, opposite makes a hole', () => {
  // outer CW + inner CCW (reversed) → donut
  const donut = rasterize(flattenPath('M 0 0 H 30 V 30 H 0 Z M 10 10 V 20 H 20 V 10 Z'));
  assert.equal(px(donut, 15, 15), 0);
  assert.equal(px(donut, 5, 15), 1);
  // outer CW + inner CW → solid (nonzero keeps it)
  const solid = rasterize(flattenPath('M 0 0 H 30 V 30 H 0 Z M 10 10 H 20 V 20 H 10 Z'));
  assert.equal(px(solid, 15, 15), 1);
});

test('crops clear ink outside the union', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 40 V 10 H 0 Z'), { crops: [[0, 0, 20, 10]] });
  assert.equal(px(bmp, 10, 5), 1);
  assert.equal(px(bmp, 30, 5), 0);
});

test('chamfer grows toward the middle of a band', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 40 V 11 H 0 Z'));
  const dt = chamfer(bmp);
  const mid = dt[(Math.floor(5.5 - bmp.oy)) * bmp.w + Math.floor(20 - bmp.ox)];
  const edge = dt[(Math.floor(0.5 - bmp.oy)) * bmp.w + Math.floor(20 - bmp.ox)];
  assert.ok(mid / 3 >= 4 && mid / 3 <= 7, `mid ${mid / 3}`);
  assert.ok(edge / 3 <= 2, `edge ${edge / 3}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/raster.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```js
// scripts/centerline/raster.mjs
/* Nonzero-winding scanline rasterizer for the artworks' ink fills, plus a
   3-4 chamfer distance transform used for ink-width stats. */

export function rasterize(polys, { crops = null, pad = 3 } = {}) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) throw new Error('empty path');
  const ox = Math.floor(minX) - pad, oy = Math.floor(minY) - pad;
  const w = Math.ceil(maxX) - ox + pad, h = Math.ceil(maxY) - oy + pad;
  if (w * h > 40e6) throw new Error(`raster too large: ${w}x${h}`);
  const data = new Uint8Array(w * h);

  // flat segment list (implicit closure per subpath), horizontal segs skipped
  const segs = [];
  for (const p of polys) {
    for (let k = 0; k < p.length; k++) {
      const a = p[k], b = p[(k + 1) % p.length];
      if (a[1] !== b[1]) segs.push(a[0], a[1], b[0], b[1]);
    }
  }

  const xs = [];
  for (let r = 0; r < h; r++) {
    const yc = oy + r + 0.5;
    xs.length = 0;
    for (let s = 0; s < segs.length; s += 4) {
      const ax = segs[s], ay = segs[s + 1], bx = segs[s + 2], by = segs[s + 3];
      let dir;
      if (ay <= yc && by > yc) dir = 1;
      else if (by <= yc && ay > yc) dir = -1;
      else continue;
      xs.push([ax + ((yc - ay) * (bx - ax)) / (by - ay), dir]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0, spanStart = 0;
    for (const [x, dir] of xs) {
      const prev = wind;
      wind += dir;
      if (prev === 0 && wind !== 0) spanStart = x;
      else if (prev !== 0 && wind === 0) {
        const c0 = Math.max(0, Math.ceil(spanStart - ox - 0.5));
        const c1 = Math.min(w - 1, Math.floor(x - ox - 0.5));
        for (let c = c0; c <= c1; c++) data[r * w + c] = 1;
      }
    }
  }

  if (crops) {
    for (let r = 0; r < h; r++) {
      const yc = oy + r + 0.5;
      for (let c = 0; c < w; c++) {
        if (!data[r * w + c]) continue;
        const xc = ox + c + 0.5;
        let inside = false;
        for (const [rx, ry, rw, rh] of crops) {
          if (xc >= rx && xc <= rx + rw && yc >= ry && yc <= ry + rh) { inside = true; break; }
        }
        if (!inside) data[r * w + c] = 0;
      }
    }
  }
  return { data, w, h, ox, oy };
}

export function chamfer({ data, w, h }) {
  const INF = 1e9;
  const dt = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) dt[i] = data[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dt[i]) continue;
    let v = dt[i];
    if (x > 0) v = Math.min(v, dt[i - 1] + 3);
    if (y > 0) {
      v = Math.min(v, dt[i - w] + 3);
      if (x > 0) v = Math.min(v, dt[i - w - 1] + 4);
      if (x < w - 1) v = Math.min(v, dt[i - w + 1] + 4);
    }
    dt[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!dt[i]) continue;
    let v = dt[i];
    if (x < w - 1) v = Math.min(v, dt[i + 1] + 3);
    if (y < h - 1) {
      v = Math.min(v, dt[i + w] + 3);
      if (x < w - 1) v = Math.min(v, dt[i + w + 1] + 4);
      if (x > 0) v = Math.min(v, dt[i + w - 1] + 4);
    }
    dt[i] = v;
  }
  // border cells may still be INF if ink touches the edge; pad in rasterize
  // prevents that, but clamp defensively
  for (let i = 0; i < w * h; i++) if (dt[i] >= INF) dt[i] = 3;
  return dt;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/centerline/raster.test.mjs`
Expected: PASS (4 tests). If the winding test fails, check subpath point order in the test — the assertions describe intent (hole vs solid); flip which `d` maps to which assertion only if BOTH behaviors are present.

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/raster.mjs scripts/centerline/raster.test.mjs
git commit -m "feat(centerline): nonzero scanline rasterizer + chamfer DT

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Zhang–Suen thinning (`scripts/centerline/thin.mjs`)

**Files:**
- Create: `scripts/centerline/thin.mjs`
- Test: `scripts/centerline/thin.test.mjs`

**Interfaces:**
- Consumes: `{ data, w, h }` bitmap from `rasterize`.
- Produces: `thin(bmp): { data: Uint8Array, w, h, ox, oy }` — 1px-wide 8-connected skeleton, same frame/offsets as input.

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/thin.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { thin } from './thin.mjs';
import { rasterize } from './raster.mjs';
import { flattenPath } from './path.mjs';

const stats = ({ data, w, h }) => {
  let n = 0, maxRow = 0;
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) if (data[y * w + x]) { n++; row++; }
    if (row > maxRow) maxRow = row;
  }
  return { n, maxRow };
};

const components = ({ data, w, h }) => {
  const seen = new Uint8Array(w * h);
  let comps = 0;
  for (let i = 0; i < w * h; i++) {
    if (!data[i] || seen[i]) continue;
    comps++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (data[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
  }
  return comps;
};

test('a thick horizontal band thins to a ~1px line of ~full length', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 60 V 9 H 0 Z'));
  const sk = thin(bmp);
  const { n } = stats(sk);
  assert.ok(n >= 45 && n <= 75, `skeleton px ${n}`);
  // every column in the middle carries at most 2 skeleton px
  for (let x = 10; x < 50; x++) {
    let col = 0;
    for (let y = 0; y < sk.h; y++) col += sk.data[y * sk.w + Math.floor(x - sk.ox)];
    assert.ok(col >= 1 && col <= 2, `col ${x}: ${col}`);
  }
});

test('thinning preserves connectivity of a cross', () => {
  const bmp = rasterize(flattenPath('M 0 20 H 50 V 28 H 0 Z M 21 0 H 29 V 48 H 21 Z'));
  assert.equal(components(bmp), 1);
  const sk = thin(bmp);
  assert.equal(components(sk), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/thin.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```js
// scripts/centerline/thin.mjs
/* Zhang–Suen thinning: iteratively peel boundary pixels until only a 1px
   8-connected skeleton remains. */

export function thin({ data, w, h, ox, oy }) {
  const skel = Uint8Array.from(data);
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? skel[y * w + x] : 0);
  const kill = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      kill.length = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y),
          p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1),
          p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        let A = 0;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) A++;
        if (A !== 1) continue;
        if (pass === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
        else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
        kill.push(y * w + x);
      }
      if (kill.length) { changed = true; for (const k of kill) skel[k] = 0; }
    }
  }
  return { data: skel, w, h, ox, oy };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/centerline/thin.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/thin.mjs scripts/centerline/thin.test.mjs
git commit -m "feat(centerline): Zhang-Suen thinning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Skeleton graph (`scripts/centerline/graph.mjs`)

**Files:**
- Create: `scripts/centerline/graph.mjs`
- Test: `scripts/centerline/graph.test.mjs`

**Interfaces:**
- Consumes: skeleton bitmap from `thin` (with `ox`, `oy`).
- Produces:
  - `buildGraph(skel): Graph` where `Graph = { nodes: Array<{id, x, y}>, edges: Array<{a, b, pts: Array<[number,number]>, len: number}> }`. Node coords and chain pts are in the bitmap's WORLD coords (`+ox+0.5, +oy+0.5` applied). Chains run node→node inclusive of both node endpoints. Pure cycles get one synthetic node.
  - `pruneSpurs(g, minLen): Graph` — removes tip edges shorter than `minLen` whose junction end has degree ≥ 3, then splices through degree-2 nodes; repeats until stable.
  - `dropDust(g, minTotalLen): Graph` — removes whole connected components whose summed edge length < `minTotalLen`.
  - `smoothChains(g, passes = 2): Graph` — in-place `[0.25, 0.5, 0.25]` smoothing of interior chain points.

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/graph.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, pruneSpurs, dropDust, smoothChains } from './graph.mjs';
import { thin } from './thin.mjs';
import { rasterize } from './raster.mjs';
import { flattenPath } from './path.mjs';

const degree = g => {
  const d = new Map();
  for (const e of g.edges) {
    d.set(e.a, (d.get(e.a) ?? 0) + 1);
    d.set(e.b, (d.get(e.b) ?? 0) + (e.a === e.b ? 1 : 1));
  }
  return d;
};

test('a plus-sign becomes 1 junction + 4 tips + 4 edges', () => {
  const g = buildGraph(thin(rasterize(flattenPath(
    'M 0 30 H 70 V 38 H 0 Z M 31 0 H 39 V 68 H 31 Z'))));
  assert.equal(g.edges.length, 4, `edges ${g.edges.length}`);
  const deg = degree(g);
  const degs = [...deg.values()].sort((a, b) => a - b);
  assert.deepEqual(degs, [1, 1, 1, 1, 4]);
  // chains carry world coords near the artwork, not raster-local
  const [x, y] = g.edges[0].pts[0];
  assert.ok(x > -10 && x < 80 && y > -10 && y < 80);
});

test('a closed ring becomes a single loop edge', () => {
  // ring: outer circle-ish square minus inner square (donut band)
  const g = buildGraph(thin(rasterize(flattenPath(
    'M 0 0 H 60 V 60 H 0 Z M 12 12 V 48 H 48 V 12 Z'))));
  assert.equal(g.edges.length, 1);
  assert.equal(g.edges[0].a, g.edges[0].b);
  assert.ok(g.edges[0].len > 120, `loop len ${g.edges[0].len}`);
});

test('pruneSpurs removes short tips and splices through', () => {
  // long bar with a tiny 4px nub sticking up from the middle
  const g0 = buildGraph(thin(rasterize(flattenPath(
    'M 0 20 H 80 V 27 H 0 Z M 38 12 H 43 V 20 H 38 Z'))));
  const g = pruneSpurs(g0, 8);
  assert.equal(g.edges.length, 1, `edges ${g.edges.map(e => e.len.toFixed(1))}`);
  assert.ok(g.edges[0].len > 60);
});

test('dropDust removes tiny components, smoothChains keeps endpoints', () => {
  const g0 = buildGraph(thin(rasterize(flattenPath(
    'M 0 0 H 80 V 7 H 0 Z M 10 30 H 14 V 33 H 10 Z'))));
  const g = dropDust(g0, 8);
  const total = g.edges.reduce((a, e) => a + e.len, 0);
  assert.ok(g.edges.every(e => e.len > 6));
  assert.ok(total > 60);
  const before = g.edges[0].pts.map(p => [...p]);
  smoothChains(g, 2);
  assert.deepEqual(g.edges[0].pts[0], before[0]);
  assert.deepEqual(g.edges[0].pts.at(-1), before.at(-1));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/graph.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```js
// scripts/centerline/graph.mjs
/* Skeleton bitmap → node/edge graph with pixel chains, plus cleanup passes.
   All output coords are world coords: pixel (x, y) → (ox + x + 0.5, oy + y + 0.5). */

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

const chainLen = pts => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

export function buildGraph({ data, w, h, ox = 0, oy = 0 }) {
  const idx = (x, y) => y * w + x;
  const on = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && data[idx(x, y)] ? 1 : 0);
  const deg = (x, y) => { let n = 0; for (const [dx, dy] of DIRS) n += on(x + dx, y + dy); return n; };
  const world = (x, y) => [ox + x + 0.5, oy + y + 0.5];

  // 1. cluster adjacent non-degree-2 pixels into nodes
  const nodeId = new Int32Array(w * h).fill(-1);
  const nodes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || deg(x, y) === 2 || nodeId[idx(x, y)] !== -1) continue;
    const id = nodes.length;
    const stack = [[x, y]];
    nodeId[idx(x, y)] = id;
    let sx = 0, sy = 0, n = 0;
    const pix = [];
    while (stack.length) {
      const [px, py] = stack.pop();
      pix.push([px, py]); sx += px; sy += py; n++;
      for (const [dx, dy] of DIRS) {
        const nx = px + dx, ny = py + dy;
        if (on(nx, ny) && deg(nx, ny) !== 2 && nodeId[idx(nx, ny)] === -1) {
          nodeId[idx(nx, ny)] = id;
          stack.push([nx, ny]);
        }
      }
    }
    const [wx, wy] = world(sx / n, sy / n);
    nodes.push({ id, x: wx, y: wy, pix });
  }

  // 2. walk chains from node pixels through degree-2 pixels
  const chainUsed = new Uint8Array(w * h);
  const edges = [];
  const nodeEdgeKeys = new Set(); // dedupe direct node↔node adjacencies
  const walk = (fromNode, npx, npy, fx, fy) => {
    const pts = [world(npx, npy)];
    let px = fx, py = fy, prevx = npx, prevy = npy;
    for (;;) {
      pts.push(world(px, py));
      const nid = nodeId[idx(px, py)];
      if (nid !== -1) {
        // snap chain ends onto node centroids
        pts[0] = [nodes[fromNode].x, nodes[fromNode].y];
        pts[pts.length - 1] = [nodes[nid].x, nodes[nid].y];
        return { a: fromNode, b: nid, pts, len: chainLen(pts) };
      }
      chainUsed[idx(px, py)] = 1;
      let nx = -1, ny = -1;
      for (const [dx, dy] of DIRS) {
        const qx = px + dx, qy = py + dy;
        if (!on(qx, qy) || (qx === prevx && qy === prevy)) continue;
        if (nodeId[idx(qx, qy)] !== -1) { nx = qx; ny = qy; break; }
        if (!chainUsed[idx(qx, qy)] && nx === -1) { nx = qx; ny = qy; }
      }
      if (nx === -1) { // dead end (thinning artifact) — treat as a tip
        const tid = nodes.length;
        nodes.push({ id: tid, x: pts.at(-1)[0], y: pts.at(-1)[1], pix: [[px, py]] });
        pts[0] = [nodes[fromNode].x, nodes[fromNode].y];
        return { a: fromNode, b: tid, pts, len: chainLen(pts) };
      }
      prevx = px; prevy = py; px = nx; py = ny;
    }
  };

  for (const node of nodes.slice()) {
    for (const [npx, npy] of node.pix) {
      for (const [dx, dy] of DIRS) {
        const qx = npx + dx, qy = npy + dy;
        if (!on(qx, qy)) continue;
        const qNode = nodeId[idx(qx, qy)];
        if (qNode === node.id) continue; // same cluster
        if (qNode !== -1) { // direct node↔node contact
          const key = `${Math.min(node.id, qNode)}:${Math.max(node.id, qNode)}:${qx}:${qy}`;
          if (node.id < qNode && !nodeEdgeKeys.has(key)) {
            nodeEdgeKeys.add(key);
            const pts = [[nodes[node.id].x, nodes[node.id].y], [nodes[qNode].x, nodes[qNode].y]];
            edges.push({ a: node.id, b: qNode, pts, len: chainLen(pts) });
          }
          continue;
        }
        if (chainUsed[idx(qx, qy)]) continue;
        edges.push(walk(node.id, npx, npy, qx, qy));
      }
    }
  }

  // 3. pure cycles (no junction/tip anywhere on the loop)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || deg(x, y) !== 2 || chainUsed[idx(x, y)] || nodeId[idx(x, y)] !== -1) continue;
    const id = nodes.length;
    const [wx, wy] = world(x, y);
    nodes.push({ id, x: wx, y: wy, pix: [[x, y]] });
    nodeId[idx(x, y)] = id;
    let first = null;
    for (const [dx, dy] of DIRS) if (on(x + dx, y + dy)) { first = [x + dx, y + dy]; break; }
    if (first) edges.push(walk(id, x, y, first[0], first[1]));
  }

  return { nodes: nodes.map(({ id, x, y }) => ({ id, x, y })), edges };
}

const degreesOf = g => {
  const d = new Map(g.nodes.map(n => [n.id, 0]));
  for (const e of g.edges) {
    d.set(e.a, d.get(e.a) + 1);
    d.set(e.b, d.get(e.b) + 1); // loops count twice, correctly
  }
  return d;
};

export function pruneSpurs(g, minLen) {
  let changed = true;
  while (changed) {
    changed = false;
    const deg = degreesOf(g);
    // remove short tip edges hanging off junctions
    const keep = [];
    for (const e of g.edges) {
      const tipA = deg.get(e.a) === 1, tipB = deg.get(e.b) === 1;
      const spur = e.len < minLen && e.a !== e.b &&
        ((tipA && deg.get(e.b) >= 3) || (tipB && deg.get(e.a) >= 3));
      if (spur) changed = true; else keep.push(e);
    }
    g.edges = keep;
    // splice through degree-2 nodes (not loop endpoints)
    const deg2 = degreesOf(g);
    for (const node of g.nodes) {
      if (deg2.get(node.id) !== 2) continue;
      const inc = g.edges.filter(e => e.a === node.id || e.b === node.id);
      if (inc.length !== 2 || inc[0] === inc[1]) continue; // loop at node — leave
      const [e1, e2] = inc;
      const p1 = e1.a === node.id ? [...e1.pts].reverse() : e1.pts; // ends at node
      const p2 = e2.a === node.id ? e2.pts : [...e2.pts].reverse(); // starts at node
      const merged = {
        a: e1.a === node.id ? e1.b : e1.a,
        b: e2.a === node.id ? e2.b : e2.a,
        pts: [...p1, ...p2.slice(1)],
        len: e1.len + e2.len,
      };
      g.edges = g.edges.filter(e => e !== e1 && e !== e2);
      g.edges.push(merged);
      changed = true;
      break; // degrees changed — restart scan
    }
  }
  // drop now-isolated nodes
  const used = new Set(g.edges.flatMap(e => [e.a, e.b]));
  g.nodes = g.nodes.filter(n => used.has(n.id));
  return g;
}

export function dropDust(g, minTotalLen) {
  // union-find over nodes
  const parent = new Map(g.nodes.map(n => [n.id, n.id]));
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const e of g.edges) parent.set(find(e.a), find(e.b));
  const compLen = new Map();
  for (const e of g.edges) {
    const r = find(e.a);
    compLen.set(r, (compLen.get(r) ?? 0) + e.len);
  }
  g.edges = g.edges.filter(e => compLen.get(find(e.a)) >= minTotalLen);
  const used = new Set(g.edges.flatMap(e => [e.a, e.b]));
  g.nodes = g.nodes.filter(n => used.has(n.id));
  return g;
}

export function smoothChains(g, passes = 2) {
  for (const e of g.edges) {
    for (let p = 0; p < passes; p++) {
      const pts = e.pts;
      for (let i = 1; i < pts.length - 1; i++) {
        pts[i] = [
          0.25 * pts[i - 1][0] + 0.5 * pts[i][0] + 0.25 * pts[i + 1][0],
          0.25 * pts[i - 1][1] + 0.5 * pts[i][1] + 0.25 * pts[i + 1][1],
        ];
      }
    }
    e.len = chainLen(e.pts);
  }
  return g;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/centerline/graph.test.mjs`
Expected: PASS (4 tests). The plus-sign test is the touchiest (thinning can leave the junction as a small cluster) — if it fails on edge COUNT, print `g.edges.map(e => [e.a, e.b, e.len])` and check for a tiny junction-adjacent edge; that indicates the node clustering missed adjacent node pixels, not a test problem.

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/graph.mjs scripts/centerline/graph.test.mjs
git commit -m "feat(centerline): skeleton graph + prune/dust/smooth passes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: One-stroke router (`scripts/centerline/route.mjs`)

**Files:**
- Create: `scripts/centerline/route.mjs`
- Test: `scripts/centerline/route.test.mjs`

**Interfaces:**
- Consumes: `Graph` from graph.mjs (world coords).
- Produces: `route(g, entryHint: [x,y], exitHint: [x,y]): { points: Array<[number,number]>, entry: [x,y], exit: [x,y], stats: { components, connectors, connectorLen, retraceLen, edgeLen, unvisited } }`
  - `points` is ONE polyline covering EVERY edge at least once. Coverage inside a component uses greedy traversal; when stuck, it retraces along already-drawn edges (shortest weighted path) to the nearest node with unvisited edges. Between components it inserts a straight 2-point connector to the nearest node of the next component. After all edges are covered, it retraces (same component) or connects (different component) to the exit node.
  - Entry node = node nearest `entryHint`, preferring degree-1 tips within 40 units. Exit node likewise for `exitHint`.
  - `stats.unvisited` MUST be 0.

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from './route.mjs';

const seg = (a, b, n = 5) => {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  return pts;
};
const edge = (a, b, pa, pb) => ({ a, b, pts: seg(pa, pb), len: Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) });

test('covers a Y-graph fully with retraces, entering/exiting at hinted tips', () => {
  // Y: center node 0 at (50,50); tips 1 (50,0), 2 (0,100), 3 (100,100)
  const g = {
    nodes: [{ id: 0, x: 50, y: 50 }, { id: 1, x: 50, y: 0 }, { id: 2, x: 0, y: 100 }, { id: 3, x: 100, y: 100 }],
    edges: [edge(0, 1, [50, 50], [50, 0]), edge(0, 2, [50, 50], [0, 100]), edge(0, 3, [50, 50], [100, 100])],
  };
  const r = route(g, [50, -5], [100, 105]);
  assert.equal(r.stats.unvisited, 0);
  assert.deepEqual(r.entry, [50, 0]);
  assert.deepEqual(r.exit, [100, 100]);
  assert.ok(r.stats.retraceLen > 0); // must double back through the center
  assert.equal(r.stats.connectors, 0);
});

test('two detached segments joined by one straight connector', () => {
  const g = {
    nodes: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 30, y: 0 }, { id: 2, x: 60, y: 5 }, { id: 3, x: 90, y: 5 }],
    edges: [edge(0, 1, [0, 0], [30, 0]), edge(2, 3, [60, 5], [90, 5])],
  };
  const r = route(g, [-5, 0], [95, 5]);
  assert.equal(r.stats.unvisited, 0);
  assert.equal(r.stats.components, 2);
  assert.equal(r.stats.connectors, 1);
  assert.ok(r.stats.connectorLen < 45, `connector ${r.stats.connectorLen}`); // 30,0 → 60,5 is ~30.4
  assert.deepEqual(r.exit, [90, 5]);
  // no NaNs, consecutive dedupe
  for (let i = 1; i < r.points.length; i++) {
    const [x, y] = r.points[i];
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.ok(x !== r.points[i - 1][0] || y !== r.points[i - 1][1]);
  }
});

test('loop edge (a === b) is traversed once', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const g = {
    nodes: [{ id: 0, x: 0, y: 0 }],
    edges: [{ a: 0, b: 0, pts: sq, len: 40 }],
  };
  const r = route(g, [0, 0], [0, 0]);
  assert.equal(r.stats.unvisited, 0);
  assert.ok(r.points.length >= 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/route.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```js
// scripts/centerline/route.mjs
/* One-stroke full-coverage routing over the skeleton graph.
   Inside a component: greedy edge traversal; when stuck, retrace over
   already-drawn edges (Dijkstra, weight = chain length) to the nearest node
   with unvisited edges — retraces are invisible (the ink is already drawn).
   Between components: a straight shortest connector (user choice 2026-07-03).
   Ends by retracing/connecting to the node nearest exitHint. */

export function route(g, entryHint, exitHint) {
  const { nodes, edges } = g;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map(nodes.map(n => [n.id, []]));
  edges.forEach((e, ei) => {
    adj.get(e.a).push(ei);
    if (e.b !== e.a) adj.get(e.b).push(ei);
  });
  const other = (e, from) => (e.a === from ? e.b : e.a);
  const dist = (n, p) => Math.hypot(n.x - p[0], n.y - p[1]);
  const degree = id => adj.get(id).length;

  // components (over node ids)
  const compOf = new Map();
  let nComps = 0;
  for (const n of nodes) {
    if (compOf.has(n.id)) continue;
    const c = nComps++;
    const stack = [n.id];
    compOf.set(n.id, c);
    while (stack.length) {
      const id = stack.pop();
      for (const ei of adj.get(id)) {
        const o = other(edges[ei], id);
        if (!compOf.has(o)) { compOf.set(o, c); stack.push(o); }
      }
    }
  }

  const pickNode = (hint, ids) => {
    let best = null, bestD = Infinity, bestTip = null, bestTipD = Infinity;
    for (const id of ids) {
      const d = dist(byId.get(id), hint);
      if (d < bestD) { bestD = d; best = id; }
      if (degree(id) === 1 && d < bestTipD) { bestTipD = d; bestTip = id; }
    }
    return bestTip !== null && bestTipD <= Math.max(40, bestD + 40) ? bestTip : best;
  };

  const allIds = nodes.map(n => n.id);
  const entryNode = pickNode(entryHint, allIds);
  const exitNode = pickNode(exitHint, allIds);
  const entryComp = compOf.get(entryNode);
  const exitComp = compOf.get(exitNode);

  // dijkstra over ALL edges (drawn or not) within the graph
  const shortest = (from, targets) => {
    const T = targets instanceof Set ? targets : new Set(targets);
    const distTo = new Map([[from, 0]]);
    const prev = new Map(); // id -> [prevId, ei]
    const Q = [[0, from]];
    while (Q.length) {
      Q.sort((a, b) => a[0] - b[0]);
      const [d, id] = Q.shift();
      if (d > (distTo.get(id) ?? Infinity)) continue;
      if (T.has(id)) {
        const path = [];
        let cur = id;
        while (cur !== from) { const [p, ei] = prev.get(cur); path.unshift([ei, p]); cur = p; }
        return { node: id, path }; // path: [edgeIdx, fromNode][]
      }
      for (const ei of adj.get(id)) {
        const e = edges[ei], o = other(e, id);
        const nd = d + e.len;
        if (nd < (distTo.get(o) ?? Infinity)) { distTo.set(o, nd); prev.set(o, [id, ei]); Q.push([nd, o]); }
      }
    }
    return null;
  };

  const points = [];
  const stats = { components: nComps, connectors: 0, connectorLen: 0, retraceLen: 0, edgeLen: 0, unvisited: 0 };
  const push = p => {
    const last = points[points.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push([p[0], p[1]]);
  };
  const pushChain = (e, fromId) => {
    const pts = e.a === fromId ? e.pts : [...e.pts].reverse();
    for (const p of pts) push(p);
  };

  const visited = new Set();
  const compUnvisited = comp => allIds.some(id => compOf.get(id) === comp &&
    adj.get(id).some(ei => !visited.has(ei)));
  const nodesWithUnvisited = comp => new Set(allIds.filter(id => compOf.get(id) === comp &&
    adj.get(id).some(ei => !visited.has(ei))));

  const cover = (comp, startId) => {
    let cur = startId;
    push([byId.get(cur).x, byId.get(cur).y]);
    while (compUnvisited(comp)) {
      const ei = adj.get(cur).find(ei2 => !visited.has(ei2));
      if (ei !== undefined) {
        visited.add(ei);
        stats.edgeLen += edges[ei].len;
        pushChain(edges[ei], cur);
        cur = other(edges[ei], cur);
      } else {
        const targets = nodesWithUnvisited(comp);
        targets.delete(cur);
        const r = shortest(cur, targets);
        if (!r) break; // shouldn't happen within a component
        for (const [ei2, fromId] of r.path) {
          stats.retraceLen += edges[ei2].len;
          pushChain(edges[ei2], fromId);
        }
        cur = r.node;
      }
    }
    return cur;
  };

  // component order: entry comp first, exit comp last, middles greedy-nearest
  const order = [entryComp];
  const middles = new Set();
  for (let c = 0; c < nComps; c++) if (c !== entryComp && c !== exitComp) middles.add(c);

  let cur = cover(entryComp, entryNode);
  const nearestNodeOfComp = (comp, fromPt) => {
    let best = null, bestD = Infinity;
    for (const id of allIds) {
      if (compOf.get(id) !== comp) continue;
      const d = dist(byId.get(id), fromPt);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  };
  const connectTo = nodeId => {
    const n = byId.get(nodeId);
    const from = points[points.length - 1];
    stats.connectors++;
    stats.connectorLen += Math.hypot(n.x - from[0], n.y - from[1]);
    push([n.x, n.y]);
  };

  while (middles.size) {
    const from = points[points.length - 1];
    let bestComp = null, bestNode = null, bestD = Infinity;
    for (const c of middles) {
      const nid = nearestNodeOfComp(c, from);
      const d = dist(byId.get(nid), from);
      if (d < bestD) { bestD = d; bestComp = c; bestNode = nid; }
    }
    middles.delete(bestComp);
    order.push(bestComp);
    connectTo(bestNode);
    cur = cover(bestComp, bestNode);
  }
  // cover the exit component last, if it wasn't the entry component
  if (!order.includes(exitComp)) {
    const nid = nearestNodeOfComp(exitComp, points[points.length - 1]);
    connectTo(nid);
    order.push(exitComp);
    cur = cover(exitComp, nid);
  }

  // finish ON the exit node
  if (cur !== exitNode) {
    if (compOf.get(cur) === exitComp) {
      const r = shortest(cur, new Set([exitNode]));
      if (r) for (const [ei2, fromId] of r.path) { stats.retraceLen += edges[ei2].len; pushChain(edges[ei2], fromId); }
      else connectTo(exitNode);
    } else {
      connectTo(exitNode);
    }
  }

  stats.unvisited = edges.length - visited.size;
  return {
    points,
    entry: points[0],
    exit: points[points.length - 1],
    stats,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/centerline/route.test.mjs`
Expected: PASS (3 tests). The exit-comp bookkeeping around `order.includes(exitComp)` is the most fragile spot — the Y-graph test (single component) and detached-segments test (exit comp ≠ entry comp) cover both branches; if either fails, simplify the condition to: `if (!order.includes(exitComp)) { connect + cover }` with no surrounding `if`.

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/route.mjs scripts/centerline/route.test.mjs
git commit -m "feat(centerline): one-stroke coverage router

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Curve fitting (`scripts/centerline/fit.mjs`)

**Files:**
- Create: `scripts/centerline/fit.mjs`
- Test: `scripts/centerline/fit.test.mjs`

**Interfaces:**
- Consumes: route polyline (any coords).
- Produces:
  - `splitAtCorners(points, angleDeg = 75): Array<Array<[number,number]>>` — splits where the direction turns more than `angleDeg` (measured over a small window so raster jitter doesn't trigger it).
  - `fitCurve(points, maxError): Array<[p0, c1, c2, p1]>` — Schneider piecewise-cubic fit; each element is 4 `[x, y]` pairs. Guaranteed max deviation ≤ `maxError` (splits recursively).
  - `toPathD(pieces: Array<Array<bezier>>, fmt): string` — single-subpath `M … C …` string; consecutive pieces joined with an `L` if endpoints differ after rounding (they shouldn't, but never a mid-path `M`).

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/fit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCurve, splitAtCorners, toPathD } from './fit.mjs';

const fmt = v => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

const bezAt = (b, t) => {
  const r = 1 - t;
  return [
    r * r * r * b[0][0] + 3 * r * r * t * b[1][0] + 3 * r * t * t * b[2][0] + t * t * t * b[3][0],
    r * r * r * b[0][1] + 3 * r * r * t * b[1][1] + 3 * r * t * t * b[2][1] + t * t * t * b[3][1],
  ];
};

test('fits a half-circle within tolerance, few segments', () => {
  const pts = [];
  for (let a = 0; a <= 64; a++) pts.push([50 * Math.cos(Math.PI * a / 64), 50 * Math.sin(Math.PI * a / 64)]);
  const bez = fitCurve(pts, 0.5);
  assert.ok(bez.length <= 6, `segments ${bez.length}`);
  // every fitted point stays near radius 50
  for (const b of bez) for (let t = 0; t <= 1; t += 0.1) {
    const [x, y] = bezAt(b, t);
    assert.ok(Math.abs(Math.hypot(x, y) - 50) < 1.2);
  }
  // endpoints exact
  assert.deepEqual(bez[0][0], [50, 0]);
  const last = bez[bez.length - 1][3];
  assert.ok(Math.abs(last[0] + 50) < 1e-6 && Math.abs(last[1]) < 1e-6);
});

test('splitAtCorners cuts an L-shape at the corner, ignores jitter', () => {
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push([i * 5, (i % 2) * 0.3]); // jittery horizontal
  for (let i = 1; i <= 20; i++) pts.push([100, i * 5]);           // vertical
  const pieces = splitAtCorners(pts, 75);
  assert.equal(pieces.length, 2);
  assert.ok(Math.abs(pieces[0].at(-1)[0] - 100) < 6);
  assert.deepEqual(pieces[1][0], pieces[0].at(-1)); // pieces share the corner point
});

test('toPathD emits a single subpath', () => {
  const pts = [[0, 0], [10, 0], [20, 0], [20, 10], [20, 20]];
  const pieces = splitAtCorners(pts, 75).map(p => fitCurve(p, 0.5));
  const d = toPathD(pieces, fmt);
  assert.match(d, /^M /);
  assert.equal((d.match(/M /g) ?? []).length, 1);
  assert.ok(!/NaN/.test(d));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/fit.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation** (Schneider's algorithm, adapted from Graphics Gems)

```js
// scripts/centerline/fit.mjs
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/centerline/fit.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/fit.mjs scripts/centerline/fit.test.mjs
git commit -m "feat(centerline): corner split + Schneider cubic fit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Orchestrator + quality gates (`scripts/centerline/index.mjs`)

**Files:**
- Create: `scripts/centerline/index.mjs`
- Test: `scripts/centerline/index.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `traceArtwork(spec): TraceResult`

```
spec = {
  name: string,                      // for error messages / stats
  d: string,                         // artwork ink path (art coords)
  crops?: Array<[x, y, w, h]>,       // art coords; trace only inside
  entryHint: [x, y], exitHint: [x, y],  // art coords
  toLocal: (p: [x, y]) => [x, y],    // art → local coords
  localScale: number,                // |art units| → |local units| factor
  fitTol?: number,                   // local units, default 0.35
}
TraceResult = {
  d: string,                         // ONE subpath, M/C/L, LOCAL coords
  entry: [x, y], exit: [x, y],       // local coords, exact route endpoints
  maskW: number,                     // local units: max ink width × 1.35
  stats: { components, connectors, connectorLen, retraceLen, edgeLen, routeLen, beziers }
}
```
- Gates (throws with `name` in the message): route leaves `unvisited > 0` edges; output `d` has more than one `M`; output `d` contains `NaN`; graph came out empty.

- [ ] **Step 1: Write the failing test**

```js
// scripts/centerline/index.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { traceArtwork } from './index.mjs';

// synthetic "artwork": two detached ink bars, like a diagram + its baseline
const D = 'M 100 100 H 400 V 112 H 100 Z M 100 200 H 400 V 212 H 100 Z';

test('traces a synthetic two-bar artwork end to end', () => {
  const r = traceArtwork({
    name: 'test-bars',
    d: D,
    entryHint: [100, 106],
    exitHint: [400, 206],
    toLocal: ([x, y]) => [(x - 100) / 5, (y - 100) / 5],
    localScale: 1 / 5,
  });
  assert.equal((r.d.match(/M /g) ?? []).length, 1);
  assert.ok(!/NaN/.test(r.d));
  assert.equal(r.stats.components, 2);
  assert.equal(r.stats.connectors, 1);
  // entry near local (0, 1.2), exit near local (60, 21.2)
  assert.ok(Math.hypot(r.entry[0] - 0, r.entry[1] - 1.2) < 3, `entry ${r.entry}`);
  assert.ok(Math.hypot(r.exit[0] - 60, r.exit[1] - 21.2) < 3, `exit ${r.exit}`);
  // ink is 12 units wide → maskW ≈ 12 × 1.35 × (1/5) ≈ 3.24 local units
  assert.ok(r.maskW > 2 && r.maskW < 5, `maskW ${r.maskW}`);
});

test('crops keep the trace inside the crop box', () => {
  const r = traceArtwork({
    name: 'test-crop',
    d: D,
    crops: [[100, 100, 150, 200]],
    entryHint: [100, 106],
    exitHint: [250, 206],
    toLocal: ([x, y]) => [(x - 100) / 5, (y - 100) / 5],
    localScale: 1 / 5,
  });
  const nums = r.d.match(/-?\d+\.?\d*/g).map(Number);
  for (let i = 0; i < nums.length; i += 2) {
    assert.ok(nums[i] <= 31, `x=${nums[i]} escaped crop (local max 30)`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/centerline/index.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```js
// scripts/centerline/index.mjs
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

export function traceArtwork(spec) {
  const { name, d, crops = null, entryHint, exitHint, toLocal, localScale, fitTol = 0.35 } = spec;
  const polys = flattenPath(d, 0.5);
  const bmp = rasterize(polys, { crops });
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
  g = dropDust(g, Math.max(7, meanHalf * 2));
  smoothChains(g, 2);
  if (!g.edges.length) throw new Error(`[${name}] graph empty after cleanup`);

  const r = route(g, entryHint, exitHint);
  if (r.stats.unvisited > 0) throw new Error(`[${name}] ${r.stats.unvisited} skeleton edges unreached`);

  const localPts = r.points.map(toLocal);
  const pieces = splitAtCorners(localPts, 75).map(p => fitCurve(p, fitTol));
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test 'scripts/centerline/*.test.mjs'` (all module tests together)
Expected: PASS, all files. If `maskW` lands outside 2–5 in the first test, print `maxHalf` — a value near 6 (half of 12) is correct; adjust nothing else.

- [ ] **Step 5: Commit**

```bash
git add scripts/centerline/index.mjs scripts/centerline/index.test.mjs
git commit -m "feat(centerline): traceArtwork orchestrator with quality gates

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Generator integration (`scripts/generate-sketch-paths.mjs`)

**Files:**
- Modify: `scripts/generate-sketch-paths.mjs` (major rewrite of the motif half; artwork extraction + emit half mostly kept)
- Regenerates: `src/components/sketchPaths.ts`

**Interfaces:**
- Consumes: `traceArtwork` from `scripts/centerline/index.mjs`.
- Produces (in the emitted `sketchPaths.ts`):
  - `SketchDef` gains `maskW: number` (local units). `SKETCHES[id].d` is now the FULL trace.
  - `HANDS_ART.thread` is now the full hands trace (art coords); `threadEntry`/`threadExit` are the trace's endpoints; `HANDS_ART` gains `maskW: number` (art units). `anchorBook`/`anchorEntry`/`bbox` unchanged.
  - All other `*_ART` exports unchanged (`d`, `offset`, `scale`, `rot`, `crop`).

Key content of the rewrite — delete `Pen`, `gearLoop`, `hubSwirl`, `onCircle`, and the seven hand-authored motif functions (`face`, `gears`, `growthChart`, `rocket`, `trophy`, `medal`, `handsThread`); keep `fmt`, all the artwork-extraction helpers (`blackPathOf`, `gearsArtD` IIFE, `blackGroupOf`, `bareLineworkOf`) and the emit/gallery halves (adjusted below).

- [ ] **Step 1: Add the artwork spec table and pipeline calls** (replaces the motif functions; artwork `d` variables must be extracted BEFORE this block — move the extraction code up)

```js
import { traceArtwork } from './centerline/index.mjs';

/* Crop rects (art coords) mirror the runtime crop clipPaths in
   ScrollPath.tsx / the *_ART.crop exports — the pen must not trace ink the
   crop hides. Entry/exit hints are the old rides' entries/exits mapped back
   to art coords, preserving each drawing's flow direction. */
const ART_SPECS = {
  about: {
    d: () => aboutArtD,
    entryHint: [1745, 993], exitHint: [1284, 2869],
    toLocal: ([x, y]) => [(x - 595) / 6, (y - 960) / 6],
    localScale: 1 / 6,
  },
  skills: {
    d: () => gearsArtD,
    entryHint: [2830, 1747], exitHint: [1102, 1893],
    // rotated 90° CCW: local = [(artY - 1468) / 5, (2842 - artX) / 5]
    toLocal: ([x, y]) => [(y - 1468) / 5, (2842 - x) / 5],
    localScale: 1 / 5,
  },
  experience: {
    d: () => growthArtD,
    crops: [[1190, 1360, 1660, 1120]],
    entryHint: [2789, 1378], exitHint: [2840, 2452],
    toLocal: ([x, y]) => [(x - 1190) / 5, (y - 1360) / 5],
    localScale: 1 / 5,
  },
  projects: {
    d: () => rocketArtD,
    entryHint: [1730, 1004], exitHint: [2021, 2836],
    toLocal: ([x, y]) => [(x - 1608) / 5, (y - 998) / 5],
    localScale: 1 / 5,
  },
  achievements: {
    d: () => trophyArtD,
    crops: [[1650, 510, 115, 630], [1765, 510, 690, 710]],
    entryHint: [2110, 562], exitHint: [2440, 1191],
    toLocal: ([x, y]) => [(x - 1650) / 5, (y - 510) / 5],
    localScale: 1 / 5,
  },
  certifications: {
    d: () => awardArtD,
    crops: [[1400, 1360, 940, 1120]],
    entryHint: [1950, 1372], exitHint: [2220, 2366],
    toLocal: ([x, y]) => [(x - 1400) / 5, (y - 1360) / 5],
    localScale: 1 / 5,
  },
  hands: {
    d: () => handsArtD,
    entryHint: [1110, 930], exitHint: [2800, 1533],
    toLocal: p => p,       // hands trace stays in art coords
    localScale: 1,
  },
};

const VBS = {
  about: [198, 320], skills: [181, 369], experience: [332, 224],
  projects: [125, 369], achievements: [161, 142], certifications: [188, 224],
};

const traced = {};
for (const [id, spec] of Object.entries(ART_SPECS)) {
  traced[id] = traceArtwork({ name: id, ...spec, d: spec.d() });
  const s = traced[id].stats;
  console.log(
    `${id.padEnd(14)} comps=${s.components} connectors=${s.connectors}` +
    ` connLen=${s.connectorLen.toFixed(0)} retrace=${s.retraceLen.toFixed(0)}` +
    ` ink=${s.edgeLen.toFixed(0)} route=${s.routeLen.toFixed(0)} beziers=${s.beziers}`,
  );
}

const SKETCHES = Object.fromEntries(
  Object.keys(VBS).map(id => [id, {
    vb: VBS[id],
    d: traced[id].d,
    entry: traced[id].entry,
    exit: traced[id].exit,
    maskW: traced[id].maskW,
  }]),
);
```

- [ ] **Step 2: Update the emit half**

In the emitted TypeScript template:
- `SketchDef` interface gains a line: `  /** mask-stroke width (local units) that covers the ink's widest stroke */\n  maskW: number;`
- The `SKETCHES` emit adds `maskW`: change the per-entry template to

```js
`  ${id}: {\n    vb: [${s.vb[0]}, ${s.vb[1]}],\n    d: '${s.d}',\n    entry: [${s.entry.map(fmt).join(', ')}],\n    exit: [${s.exit.map(fmt).join(', ')}],\n    maskW: ${fmt(s.maskW)},\n  },`
```

- `HANDS_ART`: replace `thread: '${handsThreadDef.d}'` with `thread: '${traced.hands.d}'`, `threadEntry: [${traced.hands.entry.map(fmt).join(', ')}]`, `threadExit: [${traced.hands.exit.map(fmt).join(', ')}]`, and add `maskW: ${fmt(traced.hands.maskW)},` after `threadExit`. Delete `const handsThreadDef = handsThread();`.
- Update the emitted header comment: "each `d` is a SINGLE continuous stroke tracing EVERY stroke of the artwork (generated centerline route)".

- [ ] **Step 3: Update the gallery** (`--gallery`) so every card overlays the trace on its artwork's ink. Replace the `cards` construction with:

```js
  const UNDERLAYS = {
    about: { d: aboutArtD, tf: `scale(${(1 / 6).toFixed(6)}) translate(-595 -960)` },
    skills: { d: gearsArtD, tf: 'matrix(0 -0.2 0.2 0 -293.6 568.4)' },
    experience: { d: growthArtD, tf: `scale(0.2) translate(-1190 -1360)` },
    projects: { d: rocketArtD, tf: `scale(0.2) translate(-1608 -998)` },
    achievements: { d: trophyArtD, tf: `scale(0.2) translate(-1650 -510)` },
    certifications: { d: awardArtD, tf: `scale(0.2) translate(-1400 -1360)` },
  };
  const cards = Object.entries(SKETCHES)
    .map(([id, s]) => `
    <figure>
      <svg viewBox="0 0 ${s.vb[0]} ${s.vb[1]}" style="width:${s.vb[0] * 1.6}px">
        <g transform="${UNDERLAYS[id].tf}"><path d="${UNDERLAYS[id].d}" style="fill:#b9bfd4;stroke:none" fill-rule="nonzero"/></g>
        <path class="track" d="${s.d}" />
        <path class="ink" pathLength="100" d="${s.d}" />
        <circle cx="${s.entry[0]}" cy="${s.entry[1]}" r="4" fill="#16a34a" stroke="none"/>
        <circle cx="${s.exit[0]}" cy="${s.exit[1]}" r="4" fill="#dc2626" stroke="none"/>
      </svg>
      <figcaption>${id}</figcaption>
    </figure>`)
    .join('\n') +
    `
    <figure>
      <svg viewBox="1000 860 1840 830" style="width:640px">
        <path d="${handsArtD}" style="fill:#b9bfd4;stroke:none" fill-rule="nonzero"/>
        <path class="ink" pathLength="100" d="${traced.hands.d}" style="stroke-width:12" />
        <circle cx="${traced.hands.entry[0]}" cy="${traced.hands.entry[1]}" r="18" fill="#16a34a" stroke="none"/>
        <circle cx="${traced.hands.exit[0]}" cy="${traced.hands.exit[1]}" r="18" fill="#dc2626" stroke="none"/>
      </svg>
      <figcaption>hands-book trace (art coords, pre-flip)</figcaption>
    </figure>`;
```

Also delete the now-unused `faceUnderlay` block. Note: skills gallery underlay uses the same `rot` matrix as the runtime (`SKILLS_ART.rot`), so trace and ink must visually coincide.

- [ ] **Step 4: Run the generator + gallery, eyeball every card**

Run: `node scripts/generate-sketch-paths.mjs --gallery`
Expected: stats line per artwork, all gates pass, `wrote src/components/sketchPaths.ts`, `wrote sketch-gallery.html`. Then open the gallery (e.g. `open sketch-gallery.html`) and scrub the slider 0→100 for each card, checking: the ink line (accent) rides ON the grey ink everywhere; loops close; connectors are short; entry (green) sits top-ish, exit (red) bottom-ish, matching the old flow directions. Iterate on `fitTol` / prune thresholds / hints ONLY if something is visibly wrong.

- [ ] **Step 5: Typecheck the regenerated module**

Run: `npm run build`
Expected: `tsc -b` passes (ScrollPath doesn't use `maskW` yet — additive field, no breakage). If the emitted file has a giant `d` string, that's expected.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-sketch-paths.mjs src/components/sketchPaths.ts
git commit -m "feat(generator): full centerline traces replace partial rides

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Runtime — masks replace wipes (`src/components/ScrollPath.tsx`)

**Files:**
- Modify: `src/components/ScrollPath.tsx`

**Interfaces:**
- Consumes: `SKETCHES[id].maskW`, `HANDS_ART.maskW`, full-trace `d`s (transparent — same `SketchDef` shape).
- Produces (for Task 10): `Station` gains `id: string` and `maskW: number` (canvas units); `buildPath` returns `{ d: string; spans: Array<{ id: string; from: number; to: number }> }` where `from`/`to` are char indices into `d` bracketing the station's welded trace (both at command boundaries, so `d.slice(0, from)` and `d.slice(0, to)` are valid path strings).

Changes, region by region:

- [ ] **Step 1: Station + buildPath**

Add to `interface Station`: `id: string;` and `maskW: number;`.
Replace `buildPath` with:

```ts
const buildPath = (h: number, waveX: number, stations: Station[], endsOnLast: boolean) => {
  let d = `M ${n1(waveX)} 0`;
  let cur: Pt = { x: waveX, y: 0 };
  let phase = 0;
  const spans: Array<{ id: string; from: number; to: number }> = [];
  for (const st of stations) {
    const pre: Pt = st.pre ?? { x: st.entry.x, y: Math.max(st.entry.y - 56, cur.y + 6) };
    const waveTo = (st.pre ? pre.y - 180 : st.entry.y - 170);
    const pts = waveTo > cur.y + 40
      ? [...wander(cur, { x: waveX, y: waveTo }, waveX, phase), pre, st.entry]
      : [cur, pre, st.entry];
    d += flowThrough(pts);
    const from = d.length;
    // WELD the trace into the same subpath (mid-path M breaks Blink's
    // dash-vs-offset sync); L to the same point is a zero-length no-op.
    d += ` ${st.d.replace(/^M\b/, 'L')}`;
    spans.push({ id: st.id, from, to: d.length });
    cur = st.exit;
    phase++;
  }
  if (!endsOnLast) d += flowThrough(wander(cur, { x: waveX, y: h }, waveX, phase));
  return { d, spans };
};
```

- [ ] **Step 2: Refs.** Delete the 7 `art*ClipRef` refs. Add:

```ts
const maskPathRefs = useRef<Record<string, SVGPathElement | null>>({});
```

Keep the 7 `art*Ref` group refs.

- [ ] **Step 3: `place()` and the station loop.** `place()` gains the id and maskW: add parameter `id: SketchId`, and in the returned object add `id,` and `maskW: def.maskW * s,`. Call sites: `place(SKETCHES[id], …)` → `place(id, SKETCHES[id], …)` (adjust signature order: `(id, def, centerDocY, gapLeftDoc, opts?)`). The hands station push gains `id: 'hands', maskW: HANDS_ART.maskW * k,`.

- [ ] **Step 4: Weld-entry for hands.** In the hands block, the line `const [ex, ey] = HANDS_ART.anchorEntry;` stays (transform solve), but the weld entry point must use the TRACE's start: after `handsM = buildM(k);` replace `const entry = apply(handsM, ex, ey);` with `const entry = apply(handsM, HANDS_ART.threadEntry[0], HANDS_ART.threadEntry[1]);`.

- [ ] **Step 5: measure() — path build + reveal wiring.** Replace `const d = buildPath(lineEnd, waveX, stations, !!handsM);` with:

```ts
const { d, spans } = buildPath(lineEnd, waveX, stations, !!handsM);
```

(`sig` keeps working — it hashes `d`.)

Replace the ENTIRE `staticStyle.textContent = '@keyframes spArtWipe …'` assignment and ALL seven per-artwork wipe blocks (the `artG/artRect` … `art7G/art7Rect` blocks AND the hands `art2G/art2Rect` block) with:

```ts
// Pen-synced ink reveals: each artwork's accent ink sits under a mask whose
// content is a wide white stroke of that artwork's own trace (the same
// geometry welded into the global line). Fallback keyframes are LINEAR in
// the frontier's travel (entryY → lowest point); the idle remap below
// replaces them with stop-exact ones derived from the global path.
const artGroups: Record<string, SVGGElement | null> = {
  about: artRef.current, skills: art3Ref.current, experience: art7Ref.current,
  projects: art4Ref.current, achievements: art5Ref.current,
  certifications: art6Ref.current, hands: art2Ref.current,
};
let revealKf = '';
const placed = new Map(stations.map(st => [st.id, st]));
for (const id of Object.keys(artGroups)) {
  const g = artGroups[id];
  const mp = maskPathRefs.current[id];
  const st = placed.get(id);
  if (!g || !mp) continue;
  if (!st) { g.style.display = 'none'; continue; }
  g.style.display = '';
  mp.setAttribute('d', st.d);
  mp.style.strokeWidth = `${Math.max(6, st.maskW)}`;
  const lowest = id === 'hands' && handsArtSpan
    ? handsArtSpan.bottom
    : st.dy + SKETCHES[id as SketchId].vb[1] * st.s;
  const pIn = Math.max(0, Math.min(100, (st.entry.y / lineEnd) * 100));
  const pOut = Math.max(pIn + 0.1, Math.min(100, (lowest / lineEnd) * 100));
  revealKf += `@keyframes spReveal_${id} { 0% { stroke-dashoffset: 100; } ` +
    `${pIn.toFixed(2)}% { stroke-dashoffset: 100; } ` +
    `${pOut.toFixed(2)}% { stroke-dashoffset: 0; } ` +
    `100% { stroke-dashoffset: 0; } }\n`;
  mp.style.animation = `spReveal_${id} linear both`;
  mp.style.setProperty('animation-timeline', 'scroll(root block)');
  mp.style.setProperty('animation-range-start', 'var(--sp-start)');
  mp.style.setProperty('animation-range-end', 'var(--sp-end)');
}
staticStyle.textContent = revealKf;
```

Then re-add the artwork TRANSFORM wiring (which the deleted blocks used to do alongside their wipes) just before the loop above — transforms only, no clip rects:

```ts
if (aboutStation) artRef.current?.setAttribute('transform',
  `translate(${n1(aboutStation.dx)} ${n1(aboutStation.dy)}) scale(${(aboutStation.s * ABOUT_ART.scale).toFixed(6)}) ` +
  `translate(${-ABOUT_ART.offset[0]} ${-ABOUT_ART.offset[1]})`);
if (skillsStation) {
  const tf = `translate(${n1(skillsStation.dx)} ${n1(skillsStation.dy)}) scale(${skillsStation.s.toFixed(5)}) ` +
    `matrix(${SKILLS_ART.rot.join(' ')})`;
  art3Ref.current?.querySelectorAll('[data-skills-t]').forEach(el => el.setAttribute('transform', tf));
}
if (experienceStation) art7Ref.current?.setAttribute('transform',
  `translate(${n1(experienceStation.dx)} ${n1(experienceStation.dy)}) scale(${(experienceStation.s * EXPERIENCE_ART.scale).toFixed(6)}) ` +
  `translate(${-EXPERIENCE_ART.offset[0]} ${-EXPERIENCE_ART.offset[1]})`);
if (projectsStation) art4Ref.current?.setAttribute('transform',
  `translate(${n1(projectsStation.dx)} ${n1(projectsStation.dy)}) scale(${(projectsStation.s * PROJECTS_ART.scale).toFixed(6)}) ` +
  `translate(${-PROJECTS_ART.offset[0]} ${-PROJECTS_ART.offset[1]})`);
if (achievementsStation) art5Ref.current?.setAttribute('transform',
  `translate(${n1(achievementsStation.dx)} ${n1(achievementsStation.dy)}) scale(${(achievementsStation.s * ACHIEVEMENTS_ART.scale).toFixed(6)}) ` +
  `translate(${-ACHIEVEMENTS_ART.offset[0]} ${-ACHIEVEMENTS_ART.offset[1]})`);
if (certificationsStation) art6Ref.current?.setAttribute('transform',
  `translate(${n1(certificationsStation.dx)} ${n1(certificationsStation.dy)}) scale(${(certificationsStation.s * CERTIFICATIONS_ART.scale).toFixed(6)}) ` +
  `translate(${-CERTIFICATIONS_ART.offset[0]} ${-CERTIFICATIONS_ART.offset[1]})`);
if (handsM) {
  const m = handsM;
  const matrixStr = `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => v.toFixed(5)).join(' ')})`;
  art2Ref.current?.querySelectorAll('[data-hands-t]').forEach(el => el.setAttribute('transform', matrixStr));
}
```

IMPORTANT bookkeeping notes for this step:
- The rotated-skills crop rect setter (`art3Rect.setAttribute('y', …)`) is wipe plumbing — delete with the rest.
- Delete the now-unused `--fw*` custom properties entirely.
- Where the old per-block code did `artG.style.display = 'none'` when a station was missing, the new loop handles it.
- `handsArtSpan` and its corner math stay (still used for `endLocalY` and the hands `lowest`).
- The `about` station in `stations` also needs `aboutStation = st` etc. — that plumbing is unchanged.

- [ ] **Step 6: JSX.** For each of the 7 artwork groups: keep the ghost path (and crop clipPaths where present) exactly as-is; replace the wipe `clipPath`+`rect` around the accent copy with a mask. Pattern (about shown; same shape for all, with crops nested exactly where they are today):

```tsx
<g ref={artRef} style={{ display: 'none' }}>
  <path d={ABOUT_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
  <g mask="url(#sp-about-reveal)">
    <path d={ABOUT_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
  </g>
  <mask id="sp-about-reveal" maskUnits="userSpaceOnUse">
    <path
      ref={el => { maskPathRefs.current.about = el; }}
      pathLength={100}
      fill="none"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={100}
      strokeDashoffset={100}
    />
  </mask>
</g>
```

Per-artwork specifics:
- `skills`: ghost + accent keep their `data-skills-t` inner groups; the mask path itself takes NO transform (its `d` is already canvas coords). Mask id `sp-skills-reveal`.
- `experience`/`achievements`/`certifications`: the crop clipPath group stays OUTSIDE, wrapping ghost + masked accent exactly as the crop wraps ghost + wiped accent today. Mask ids `sp-experience-reveal` etc.
- `projects`: like about. `hands`: ghost + accent keep `data-hands-t` groups; mask path bare, id `sp-hands-reveal`.
- Delete every `sp-*-art-wipe` clipPath and its rect.
- The about artwork group currently gets its transform via `artG.setAttribute('transform', …)` in measure() — unchanged by JSX (Step 5 provides it).

- [ ] **Step 7: Build + visual check**

Run: `npm run build`
Expected: clean. Then `npm run dev`, open the preview at ≥1024px width, and scroll: every artwork should now paint in stroke-by-stroke in drawing order, roughly following the pen (linear fallback timing — Task 10 makes it exact). The dot traces THROUGH each full diagram. No horizontal-wipe reveals anywhere.

- [ ] **Step 8: Commit**

```bash
git add src/components/ScrollPath.tsx
git commit -m "feat(scroll-path): pen-traced diagrams with mask-stroke ink reveals

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Exact pen↔ink sync + pacing retune (`src/components/ScrollPath.tsx`)

**Files:**
- Modify: `src/components/ScrollPath.tsx`

**Interfaces:**
- Consumes: `spans` from Task 9's `buildPath`, the existing `remapStops` idle machinery.

- [ ] **Step 1: Raise the pen-speed cap.** In `remapStops`, change `const maxStep = 2.4 / steps;` to `const maxStep = 4.5 / steps;` (initial value; tuned by eye in Step 4 — the traces pack far more length per frontier-pixel than the old rides did).

- [ ] **Step 2: Emit stop-exact reveal keyframes in the idle remap.** In the `idleId = idle(() => { … })` callback, after `const stops = remapStops(draw, lineEnd);` and the existing `drawKf`/`dotKf` loop, add:

```ts
// Per-artwork reveal keyframes on the SAME stops: the trace segment IS a
// slice of the global path, so its local progress is exact arithmetic on
// the global length — the ink finishes each stroke as the dot passes it.
const L = draw.getTotalLength();
const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
let revealWoven = '';
const names: Record<string, string> = {};
for (const span of spans) {
  tmp.setAttribute('d', d.slice(0, span.from));
  const lenStart = tmp.getTotalLength();
  tmp.setAttribute('d', d.slice(0, span.to));
  const lenEnd = tmp.getTotalLength();
  if (lenEnd - lenStart < 1) continue;
  let kf = '';
  for (let k = 0; k <= last; k++) {
    const pct = ((k / last) * 100).toFixed(2);
    const local = Math.min(1, Math.max(0, (stops[k] * L - lenStart) / (lenEnd - lenStart)));
    kf += `${pct}% { stroke-dashoffset: ${(100 * (1 - local)).toFixed(3)}; } `;
  }
  const name = `spRevealWoven_${span.id}`;
  revealWoven += `@keyframes ${name} { ${kf}}\n`;
  names[span.id] = name;
}
```

(`spans` and `d` are in scope — they're consts of this `measure()` invocation, and the `seq` guard already protects against stale writes.)

Then extend the stylesheet write and animation switch:

```ts
styleEl.textContent =
  `@keyframes spDrawWoven { ${drawKf}}\n@keyframes spDotWoven { ${dotKf}}\n${revealWoven}`;
draw.style.animationName = 'spDrawWoven';
dot.style.animationName = 'spDotWoven';
for (const [id, name] of Object.entries(names)) {
  const mp = maskPathRefs.current[id];
  if (mp) mp.style.animationName = name;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Preview verification + pacing tune** (the memory's preview-tab recipe)

Start the dev server (preview tools), viewport ≥1024px, and step-scroll the page checking at each step:
1. Ink never appears ahead of the dot (watch each diagram as the dot enters).
2. Each diagram is fully inked the moment the dot exits it — no chunks popping in late or early.
3. The dot visibly traverses the diagram strokes (not teleporting) — if it noticeably lags the frontier deep into the next section, raise `maxStep`'s numerator (4.5 → 5.5…); if strokes flash in too fast to read, lower it. Re-check 1–2 after each change.
4. The line ends ON the hands+book trailing stroke exactly at max scroll.
5. No console errors; scrolling stays smooth (no long-frame jank from the bigger path — if janky, lower the generator's flatten/fit density: `fitTol` 0.35 → 0.5 and regenerate).
6. Dark mode + a narrower (but ≥1024px) window still lay out sanely; below 1024px the feature is absent.

- [ ] **Step 5: Full test + lint sweep**

Run: `node --test 'scripts/centerline/*.test.mjs' && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ScrollPath.tsx
git commit -m "feat(scroll-path): stop-exact ink/dot sync + pacing retune

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Update `art/README.md`** — the "revealed by a wipe" paragraph now reads: revealed by a mask stroke that rides the pen's own trace; each artwork's trace is generated (centerline pipeline in `scripts/centerline/`), not hand-measured. Commit:

```bash
git add art/README.md
git commit -m "docs: reveal mechanism is now the pen-synced trace mask

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
