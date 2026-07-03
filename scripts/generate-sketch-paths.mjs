#!/usr/bin/env node
/*
  Generates src/components/sketchPaths.ts — the one-line section motifs
  that ScrollPath weaves into its single drawn line (About face, Skills gears,
  Experience briefcase, Projects rocket, Achievements trophy, Certifications
  medal).

  Each motif is ONE continuous SVG path (the pen never lifts) that ENTERS near
  the top and EXITS near the bottom, so the page line can flow in, draw the
  object, and flow on. `entry`/`exit` are exported for the connectors.

  Every motif is now a MEASURED ride over one of the user's licensed Vecteezy
  artworks in art/ (isPointInFill centerline probes) — face, gears, growth
  chart, rocket, trophy, award rosette, plus the hands+book terminal.

      node scripts/generate-sketch-paths.mjs            # writes sketchPaths.ts
      node scripts/generate-sketch-paths.mjs --gallery  # + sketch-gallery.html
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const fmt = v => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};
const rad = deg => (deg * Math.PI) / 180;
const onCircle = (c, r, aDeg) => ({ x: c.x + r * Math.cos(rad(aDeg)), y: c.y + r * Math.sin(rad(aDeg)) });

/* A pen that never lifts. All commands are absolute; an optional rigid frame
   (rotation + translation) can be pushed for authoring tilted shapes. */
class Pen {
  constructor(x, y) {
    this.tf = p => p;
    const p0 = this.tf({ x, y });
    this.d = `M ${fmt(p0.x)} ${fmt(p0.y)}`;
  }
  frame(cx, cy, deg) {
    const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
    this.tf = p => ({ x: cx + p.x * c - p.y * s, y: cy + p.x * s + p.y * c });
    return this;
  }
  world() { this.tf = p => p; return this; }
  map(x, y) { return this.tf({ x, y }); }
  L(x, y) { const p = this.tf({ x, y }); this.d += ` L ${fmt(p.x)} ${fmt(p.y)}`; return this; }
  Q(cx, cy, x, y) {
    const c = this.tf({ x: cx, y: cy }), p = this.tf({ x, y });
    this.d += ` Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(p.x)} ${fmt(p.y)}`;
    return this;
  }
  C(c1x, c1y, c2x, c2y, x, y) {
    const a = this.tf({ x: c1x, y: c1y }), b = this.tf({ x: c2x, y: c2y }), p = this.tf({ x, y });
    this.d += ` C ${fmt(a.x)} ${fmt(a.y)} ${fmt(b.x)} ${fmt(b.y)} ${fmt(p.x)} ${fmt(p.y)}`;
    return this;
  }
  /* Circular arc around centre c from angle a0 to a1 (degrees, y-down; the pen
     must already sit at angle a0). Split into <=120° chunks; flags stay bare
     integers — "0.0 1.0" would silently break Chrome's path parser. */
  arc(c, r, a0, a1) {
    const sweep = a1 > a0 ? 1 : 0;
    let a = a0;
    while (Math.abs(a1 - a) > 0.01) {
      const step = Math.sign(a1 - a) * Math.min(120, Math.abs(a1 - a));
      a += step;
      const p = this.tf(onCircle(c, r, a));
      this.d += ` A ${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${fmt(p.x)} ${fmt(p.y)}`;
    }
    return this;
  }
  /* Catmull-Rom through the given waypoints (starting from the current pen
     position implicitly): smooth flowing "hand-drawn" segments. */
  through(pts, from, k = 1) {
    const P = [from, from, ...pts, pts[pts.length - 1]];
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      this.C(
        p1.x + ((p2.x - p0.x) / 6) * k, p1.y + ((p2.y - p0.y) / 6) * k,
        p2.x - ((p3.x - p1.x) / 6) * k, p2.y - ((p3.y - p1.y) / 6) * k,
        p2.x, p2.y,
      );
    }
    return this;
  }
}

/* One full trip around a gear's silhouette: trapezoidal teeth with rounded
   crests. Enters/leaves at the root circle, angle a0 - rootHalf. */
const gearLoop = (pen, c, n, rRoot, rTip, a0) => {
  const step = 360 / n;
  const rootHalf = step * 0.285, tipHalf = step * 0.15;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * step;
    const t1 = onCircle(c, rTip, a - tipHalf), t2 = onCircle(c, rTip, a + tipHalf);
    const r2 = onCircle(c, rRoot, a + rootHalf);
    pen.L(t1.x, t1.y);
    pen.arc(c, rTip, a - tipHalf, a + tipHalf);
    pen.L(r2.x, r2.y);
    pen.arc(c, rRoot, a + rootHalf, a + step - rootHalf);
  }
  return pen;
};

/* Hand-drawn hub: a circle that overshoots into a lazy inward spiral.
   Covers 360 + 200 degrees, so it ENDS at angle aIn + 200. */
const hubSwirl = (pen, c, r, aIn) => {
  pen.arc(c, r, aIn, aIn + 360);
  pen.arc(c, r - 3, aIn, aIn + 200);
  return pen;
};

/* ── About: one-line face — centerline traced over the user's supplied
   vectorized artwork (art/about-face.svg, viewBox 2378x3840, art bbox
   x595-1784 y960-2880; local coords = (art - [595,960]) / 6 → box 200x320).
   ¾ view facing left: brow → closed eye (double-pass, as in the artwork) →
   ear → jaw → chin → lips → nose → bridge (crossing the brow, as the
   artwork does) → cheek → neck loop → the long neck S to the exit. */
const face = () => {
  /* The line rides ON the About artwork's own strokes. These waypoints are
     MEASURED centerlines of the drawing's right silhouette (isPointInFill
     scanline probes of art/about-face.svg, art coords → local = (art -
     [595,960]) / 6): ear outer arc → lobe → the jaw's sweep to the chin →
     a short glide onto the neck stroke → its full S, out the bottom. */
  const entry = [191.6, 5.5];
  const pen = new Pen(...entry);
  pen.through([
    { x: 192.2, y: 10.2 }, { x: 195.6, y: 19.5 }, { x: 197.0, y: 28.8 },
    { x: 195.9, y: 38.2 }, { x: 193.3, y: 47.5 }, { x: 187.4, y: 56.8 },
    { x: 180.9, y: 61.5 }, { x: 172, y: 64 },      // ear → lobe seam
    { x: 169.4, y: 70.8 }, { x: 169.3, y: 80.2 }, { x: 168.6, y: 89.5 },
    { x: 166.3, y: 98.8 }, { x: 161.5, y: 108.2 }, { x: 154.4, y: 117.5 },
    { x: 146.8, y: 126.8 }, { x: 138.3, y: 136.2 }, { x: 128.4, y: 145.5 },
    { x: 131, y: 170 },                             // glide to the neck stroke
    { x: 138.5, y: 196.8 },
    { x: 126.2, y: 206.2 }, { x: 114.8, y: 215.5 }, { x: 106.6, y: 224.8 },
    { x: 101.7, y: 234.2 }, { x: 99.1, y: 243.5 }, { x: 98.3, y: 252.8 },
    { x: 98.9, y: 262.2 }, { x: 100.6, y: 271.5 }, { x: 103.3, y: 280.8 },
    { x: 106.3, y: 290.2 }, { x: 109.2, y: 299.5 }, { x: 112.1, y: 308.8 },
    { x: 114.8, y: 318.2 },
  ], { x: 190, y: -24 });
  const exit = [114.8, 318.2];
  return { d: pen.d, entry, exit };
};

/* ── Skills: the user's interconnected-gears artwork (art/skills-gears.svg),
   rotated 90° CCW in ScrollPath so its flowing line runs top→bottom. The
   thread below is that line's MEASURED centerline (isPointInFill band
   following, art coords), already rotated into the local box:
   local = ((artY - 1468) / 5, (2842 - artX) / 5), box [181, 369]. ── */
const gears = () => {
  const entry = [55.8, 2.4];
  const pen = new Pen(...entry);
  pen.through([
    { x: 54.0, y: 12.0 }, { x: 53.8, y: 21.6 }, { x: 55.0, y: 31.2 },
    { x: 57.4, y: 40.8 }, { x: 60.2, y: 50.4 }, { x: 63.0, y: 60.0 },
    { x: 65.4, y: 69.6 }, { x: 67.0, y: 79.2 }, { x: 67.4, y: 88.8 },
    { x: 67.0, y: 98.4 }, { x: 66.0, y: 108.0 }, { x: 64.0, y: 117.6 },
    { x: 61.4, y: 127.2 }, { x: 59.6, y: 136.8 }, { x: 59.6, y: 146.4 },
    { x: 62.8, y: 156.0 }, { x: 67.0, y: 160.8 }, { x: 74.2, y: 165.6 },
    { x: 76.0, y: 170.4 }, { x: 79.0, y: 180.0 }, { x: 81.0, y: 189.6 },
    { x: 81.8, y: 199.2 }, { x: 81.4, y: 208.8 }, { x: 81.4, y: 218.4 },
    { x: 80.4, y: 228.0 }, { x: 79.8, y: 237.6 }, { x: 77.8, y: 247.2 },
    { x: 76.6, y: 256.8 }, { x: 75.0, y: 266.4 }, { x: 73.8, y: 276.0 },
    { x: 73.6, y: 285.6 }, { x: 73.8, y: 295.2 }, { x: 74.8, y: 304.8 },
    { x: 80.2, y: 314.4 }, { x: 80.0, y: 333.6 }, { x: 85.0, y: 348.0 },
  ], { x: 57, y: -8 });
  const exit = [85, 348];
  return { d: pen.d, entry, exit };
};

/* ── Experience: the user's growth-chart artwork (art/experience-growth.svg)
   — five rising bars, a double-stroked zigzag trend arrow, all on a wavy
   baseline. The thread is a MEASURED all-on-ink route (isPointInFill probes,
   art coords → local = (art - [1190, 1360]) / 5, box [332, 224]): in over
   the arrowhead's tip (top right, by the wave), down the head's right barb,
   along the shaft's LOWER line to where it crosses the tallest bar's right
   edge (2512, 1812), straight down that edge to the baseline corner, then
   out right along the ground. The zigzag's left half, the other bars and
   the baseline stubs are painted by the wipe (the baseline's ink is
   genuinely erased beneath the bars, so it can't be ridden across). ── */
const growthChart = () => {
  const entry = [319.8, 3.6];
  const pen = new Pen(...entry);
  pen.through([
    { x: 318.0, y: 7.0 }, { x: 317.0, y: 12.0 }, { x: 316.6, y: 18.0 },
    { x: 316.4, y: 24.0 }, { x: 315.8, y: 29.0 },
    { x: 313.0, y: 32.0 }, { x: 309.6, y: 30.8 }, // barb → shaft merge
    { x: 304.0, y: 35.8 }, { x: 298.0, y: 43.6 }, { x: 292.0, y: 51.8 },
    { x: 286.0, y: 60.2 }, { x: 280.0, y: 68.6 }, { x: 274.0, y: 77.0 },
    { x: 268.0, y: 85.4 },
    { x: 264.4, y: 90.4 },                        // shaft × tallest bar edge
    { x: 263.8, y: 96.0 }, { x: 263.8, y: 108.0 }, { x: 263.6, y: 123.0 },
    { x: 263.4, y: 138.0 }, { x: 263.4, y: 153.0 }, { x: 263.4, y: 168.0 },
    { x: 263.6, y: 183.0 }, { x: 263.8, y: 198.0 }, { x: 264.2, y: 208.0 },
    { x: 264.8, y: 215.0 },
    { x: 267.0, y: 218.0 },                       // baseline corner, run out
    { x: 274.0, y: 218.6 }, { x: 286.0, y: 218.8 }, { x: 298.0, y: 218.8 },
    { x: 310.0, y: 218.6 }, { x: 322.0, y: 218.4 }, { x: 330.0, y: 218.4 },
  ], { x: 321, y: -4 });
  const exit = [330, 218.4];
  return { d: pen.d, entry, exit };
};

/* ── Projects: the user's rocket take-off artwork (art/projects-rocket.svg),
   upright beside the Projects section. The thread is the drawing's MEASURED
   ridable line (isPointInFill scanline probes, art coords → local =
   (art - [1608, 998]) / 5, box [125, 369]): in over the nose tip, down the
   cone's right edge, across the stage-seam junction, down the near-straight
   hull edge, the nozzle's inward curl, around the flame's outer-right lobe
   to its vertex, then the exhaust trail's long S-wave out the bottom. The
   fins and porthole are painted by the artwork wipe, not ridden. ── */
const rocket = () => {
  const entry = [24.4, 1.2];
  const pen = new Pen(...entry);
  pen.through([
    { x: 30.4, y: 5.4 }, { x: 37.6, y: 11.4 }, { x: 43.6, y: 17.4 },
    { x: 49.0, y: 23.4 }, { x: 53.8, y: 29.4 }, { x: 58.0, y: 35.4 },
    { x: 61.8, y: 41.4 }, { x: 65.4, y: 47.4 },
    { x: 67.0, y: 50.4 },                         // stage-seam junction
    { x: 68.6, y: 53.4 }, { x: 71.0, y: 59.4 }, { x: 73.2, y: 65.4 },
    { x: 75.2, y: 71.4 }, { x: 77.0, y: 77.4 }, { x: 79.4, y: 86.4 },
    { x: 81.0, y: 92.4 }, { x: 83.0, y: 101.4 }, { x: 84.6, y: 110.4 },
    { x: 85.8, y: 119.4 }, { x: 86.6, y: 128.4 }, { x: 87.2, y: 137.4 },
    { x: 87.4, y: 146.4 }, { x: 87.4, y: 155.4 }, { x: 87.6, y: 164.4 },
    { x: 87.6, y: 173.4 }, { x: 87.6, y: 181.4 },
    { x: 86.0, y: 185.4 }, { x: 80.4, y: 188.6 }, // the nozzle's inward curl
    { x: 80.8, y: 191.6 }, { x: 84.0, y: 194.8 }, { x: 86.4, y: 200.0 },
    { x: 88.2, y: 205.2 },
    { x: 89.4, y: 214.4 }, { x: 90.0, y: 226.4 }, // flame, outer-right lobe
    { x: 89.2, y: 238.4 }, { x: 87.8, y: 249.4 }, { x: 85.8, y: 259.4 },
    { x: 83.8, y: 266.4 }, { x: 81.8, y: 272.8 },
    { x: 80.6, y: 275.8 }, { x: 77.6, y: 283.4 }, // the exhaust trail's S
    { x: 75.8, y: 290.4 }, { x: 76.4, y: 296.4 }, { x: 79.8, y: 300.4 },
    { x: 83.8, y: 304.6 }, { x: 87.8, y: 309.0 }, { x: 90.8, y: 313.8 },
    { x: 92.6, y: 318.8 }, { x: 93.0, y: 323.6 }, { x: 92.0, y: 329.0 },
    { x: 90.2, y: 334.0 }, { x: 88.0, y: 338.6 }, { x: 85.6, y: 343.2 },
    { x: 83.6, y: 347.6 }, { x: 81.8, y: 352.4 }, { x: 80.8, y: 357.2 },
    { x: 80.6, y: 361.6 }, { x: 81.6, y: 365.2 }, { x: 82.6, y: 367.6 },
  ], { x: 18.8, y: -3 });
  const exit = [82.6, 367.6];
  return { d: pen.d, entry, exit };
};

/* ── Achievements: the user's trophy-on-a-pedestal artwork
   (art/achievements-trophy.svg), upright beside the Achievements section.
   The thread is the drawing's MEASURED right silhouette (isPointInFill
   probes, art coords → local = (art - [1650, 510]) / 5, box [161, 142]):
   in over the right handle's crest, down its outer arc, curling onto the
   cup wall, the bowl's taper, the stem's waist and flare, down the
   pedestal's right trim to the foot, then out along the wavy ground line
   (crest + dip) toward the wave. The rim, left handle and plaque are
   painted by the wipe; the full-width ground line is CROPPED in ScrollPath
   (ACHIEVEMENTS_ART.crop) so it doesn't streak under the cards. ── */
const trophy = () => {
  const entry = [92, 10.4];
  const pen = new Pen(...entry);
  pen.through([
    { x: 98.0, y: 11.6 }, { x: 101.8, y: 14.2 }, { x: 103.6, y: 17.2 },
    { x: 104.6, y: 20.8 }, { x: 104.8, y: 24.4 }, { x: 104.0, y: 28.4 },
    { x: 102.4, y: 32.4 }, { x: 100.4, y: 36.0 }, { x: 97.6, y: 39.6 },
    { x: 94.0, y: 43.4 }, { x: 89.6, y: 47.0 }, { x: 84.8, y: 50.4 },
    { x: 80.0, y: 53.2 }, { x: 75.6, y: 55.8 },  // handle curls to the wall
    { x: 71.4, y: 58.0 }, { x: 66.6, y: 61.6 }, { x: 64.4, y: 63.8 },
    { x: 61.0, y: 67.0 },
    { x: 59.6, y: 71.0 }, { x: 60.0, y: 74.4 },  // bowl bottom → stem
    { x: 60.8, y: 77.4 }, { x: 59.8, y: 81.0 }, { x: 60.2, y: 84.0 },
    { x: 62.4, y: 86.6 }, { x: 65.4, y: 89.2 }, { x: 68.8, y: 91.8 },
    { x: 72.8, y: 94.8 }, { x: 75.6, y: 96.0 },  // the flare onto the base
    { x: 76.6, y: 98.4 }, { x: 77.8, y: 101.2 }, { x: 78.8, y: 104.8 },
    { x: 79.4, y: 108.4 }, { x: 79.8, y: 112.4 }, { x: 80.6, y: 116.4 },
    { x: 81.6, y: 119.6 }, { x: 82.4, y: 122.8 }, { x: 83.2, y: 126.0 },
    { x: 84.0, y: 129.6 }, { x: 85.6, y: 133.2 },
    { x: 88.0, y: 134.8 }, { x: 92.0, y: 134.2 }, // onto the ground line
    { x: 98.0, y: 132.4 }, { x: 106.0, y: 130.2 }, { x: 114.0, y: 128.6 },
    { x: 121.0, y: 128.2 }, { x: 130.0, y: 129.0 }, { x: 138.0, y: 131.2 },
    { x: 145.0, y: 133.4 }, { x: 151.6, y: 135.2 }, { x: 158.0, y: 136.2 },
  ], { x: 86, y: 7.6 });
  const exit = [158, 136.2];
  return { d: pen.d, entry, exit };
};

/* ── Certifications: the user's best-quality-award artwork
   (art/certifications-award.svg) — a scalloped rosette badge with an inner
   circle + star and two ribbon tails, riding a full-width baseline. The
   thread is the drawing's MEASURED right silhouette (isPointInFill probes,
   art coords → local = (art - [1400, 1360]) / 5, box [188, 224]): in over
   the top-right scallop bump, down the bumpy right edge (big bump apex due
   right), the pinch where the baseline meets the badge, then down the right
   ribbon's outer edge to its tip. The star, inner circle, left ribbon and
   baseline stubs are painted by the wipe; the full-width baseline is
   CROPPED in ScrollPath (CERTIFICATIONS_ART.crop). ── */
const medal = () => {
  const entry = [110, 2.4];
  const pen = new Pen(...entry);
  pen.through([
    { x: 117.2, y: 4.0 }, { x: 121.4, y: 6.4 }, { x: 123.8, y: 8.8 },
    { x: 128.0, y: 13.6 }, { x: 131.8, y: 18.4 }, { x: 134.2, y: 20.8 },
    { x: 137.2, y: 23.2 }, { x: 143.0, y: 25.6 }, { x: 150.2, y: 28.0 },
    { x: 155.2, y: 30.4 }, { x: 158.2, y: 32.8 }, { x: 160.4, y: 35.2 },
    { x: 161.6, y: 37.6 }, { x: 162.6, y: 42.4 }, { x: 162.8, y: 48.0 },
    { x: 163.0, y: 53.6 }, { x: 163.6, y: 58.4 }, { x: 164.8, y: 61.6 },
    { x: 165.6, y: 64.0 }, { x: 166.8, y: 66.4 }, { x: 168.4, y: 68.8 },
    { x: 170.6, y: 71.2 }, { x: 172.4, y: 73.6 }, { x: 174.0, y: 76.0 },
    { x: 175.2, y: 78.4 }, { x: 176.0, y: 80.8 },
    { x: 176.4, y: 84.4 },                        // the due-right bump apex
    { x: 176.2, y: 88.0 }, { x: 175.6, y: 90.4 }, { x: 174.8, y: 92.8 },
    { x: 173.2, y: 95.2 }, { x: 171.6, y: 97.6 }, { x: 170.0, y: 100.0 },
    { x: 168.6, y: 102.4 }, { x: 167.2, y: 104.8 }, { x: 166.0, y: 107.2 },
    { x: 164.8, y: 109.6 }, { x: 164.0, y: 112.0 }, { x: 163.4, y: 114.4 },
    { x: 163.0, y: 119.2 }, { x: 162.8, y: 124.8 }, { x: 162.6, y: 131.2 },
    { x: 162.0, y: 133.6 }, { x: 160.6, y: 136.0 }, { x: 158.6, y: 138.4 },
    { x: 155.4, y: 140.8 }, { x: 151.0, y: 143.2 }, { x: 144.8, y: 145.6 },
    { x: 140.4, y: 148.0 },                       // baseline pinch → ribbon
    { x: 141.2, y: 150.4 }, { x: 142.4, y: 152.8 }, { x: 144.4, y: 157.6 },
    { x: 146.8, y: 162.4 }, { x: 148.8, y: 167.2 }, { x: 151.2, y: 172.0 },
    { x: 153.2, y: 176.8 }, { x: 155.4, y: 181.6 }, { x: 157.6, y: 186.4 },
    { x: 159.6, y: 191.2 }, { x: 160.8, y: 193.6 }, { x: 162.0, y: 196.0 },
    { x: 162.8, y: 198.4 }, { x: 164.0, y: 201.2 },
  ], { x: 100, y: -1 });
  const exit = [164, 201.2];
  return { d: pen.d, entry, exit };
};

/* ── Certifications→Contact: hands sharing a book — the user's ACTUAL
   licensed artwork (art/hands-book.svg), flipped horizontally in ScrollPath
   so the book-holding hand sits below Contact's Work/location pill. The
   THREAD rides the reaching arm in ART coordinates and the page line ENDS
   on the artwork's trailing stroke (explicit ask: it never returns to the
   right side). ── */
const handsThread = () => {
  /* MEASURED waypoints (isPointInFill column probes of art/hands-book.svg):
     the arm's top silhouette from the cuff, a soft knuckle over the reaching
     hand, real page-line anchors across the open book, and the trailing
     stroke (y≈1533) where the page line ENDS. */
  const entry = [1110, 930];
  const pen = new Pen(...entry);
  pen.through([
    { x: 1142, y: 925 }, { x: 1210, y: 925 }, { x: 1278, y: 946 },
    { x: 1346, y: 967 }, { x: 1448, y: 1009 }, { x: 1550, y: 1051 },
    { x: 1652, y: 1105 }, { x: 1720, y: 1144 }, { x: 1788, y: 1216 },
    { x: 1850, y: 1280 }, { x: 1930, y: 1370 },  // leap over the knuckles
    { x: 1990, y: 1430 }, { x: 2034, y: 1400 },
    { x: 2078, y: 1367 }, { x: 2166, y: 1373 },  // the measured page line
    { x: 2254, y: 1379 }, { x: 2342, y: 1386 }, { x: 2430, y: 1394 },
    { x: 2470, y: 1440 },                        // down to the holding hand
    { x: 2500, y: 1489 }, { x: 2544, y: 1504 }, { x: 2588, y: 1521 },
    { x: 2632, y: 1534 }, { x: 2700, y: 1533 }, { x: 2800, y: 1533 },
  ], { x: 1060, y: 905 });
  const exit = [2800, 1533];
  return { d: pen.d, entry, exit };
};

const SKETCHES = {
  about: { vb: [198, 320], ...face() },
  skills: { vb: [181, 369], ...gears() },
  experience: { vb: [332, 224], ...growthChart() },
  projects: { vb: [125, 369], ...rocket() },
  achievements: { vb: [161, 142], ...trophy() },
  certifications: { vb: [188, 224], ...medal() },
};

/* ── the real artworks: black line-art paths from the user's licensed
   drawings, exported verbatim for the pixel-faithful wipe reveals ── */
const blackPathOf = file => {
  try {
    const svg = readFileSync(join(ROOT, file), 'utf8');
    // the artwork path is the first fill-less <path> after the white group
    return svg.split('</g>')[1]?.match(/<path d="([^"]+)"/)?.[1] ?? '';
  } catch {
    return '';
  }
};
const aboutArtD = blackPathOf('art/about-face.svg');
const handsArtD = blackPathOf('art/hands-book.svg');
/* the gears file layers differently (the post-</g> path is an inverted
   background block) — its line-work is simply the LONGEST fill-less path */
const gearsArtD = (() => {
  try {
    const svg = readFileSync(join(ROOT, 'art/skills-gears.svg'), 'utf8');
    const all = [...svg.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]);
    all.sort((a, b) => b.length - a.length);
    return all[0] ?? '';
  } catch {
    return '';
  }
})();
/* the rocket + trophy files stack color-quantized AA layers; their line-work
   is the fill-less <g stroke-width="0"> group, merged into one compound path */
const blackGroupOf = file => {
  try {
    const svg = readFileSync(join(ROOT, file), 'utf8');
    const g = svg.match(/<g stroke-width="0">([\s\S]*?)<\/g>/)?.[1] ?? '';
    return [...g.matchAll(/\bd="([^"]+)"/g)].map(m => m[1]).join(' ');
  } catch {
    return '';
  }
};
const rocketArtD = blackGroupOf('art/projects-rocket.svg');
const trophyArtD = blackGroupOf('art/achievements-trophy.svg');
/* the award + growth files have NO black group — their line-work is a bare
   top-level fill-less <path> (the longest one; color paths are AA fringes) */
const bareLineworkOf = file => {
  try {
    const svg = readFileSync(join(ROOT, file), 'utf8');
    let best = '';
    for (const m of svg.matchAll(/<path([^>]*?)\/>/g)) {
      if (/fill=/.test(m[1])) continue;
      const d = m[1].match(/\bd="([^"]+)"/)?.[1] ?? '';
      if (d.length > best.length) best = d;
    }
    return best;
  } catch {
    return '';
  }
};
const awardArtD = bareLineworkOf('art/certifications-award.svg');
const growthArtD = bareLineworkOf('art/experience-growth.svg');
const handsThreadDef = handsThread();

/* ── emit the TypeScript module ── */
const ts = `/*
  GENERATED by scripts/generate-sketch-paths.mjs — do not edit by hand.
  Five one-line section motifs, woven into ScrollPath's single line: each
  \`d\` is a SINGLE continuous stroke that enters at \`entry\` (top) and
  leaves at \`exit\` (bottom), so the page line can flow through it.
*/

export type SketchId =
  | 'about' | 'skills' | 'experience' | 'projects' | 'achievements'
  | 'certifications';

export interface SketchDef {
  /** viewBox width/height — the motif's local coordinate box */
  vb: readonly [number, number];
  d: string;
  /** where the page line flows in (top) / out (bottom), in vb coords */
  entry: readonly [number, number];
  exit: readonly [number, number];
}

export const SKETCHES: Record<SketchId, SketchDef> = {
${Object.entries(SKETCHES)
  .map(([id, s]) =>
    `  ${id}: {\n    vb: [${s.vb[0]}, ${s.vb[1]}],\n    d: '${s.d}',\n    entry: [${s.entry.map(fmt).join(', ')}],\n    exit: [${s.exit.map(fmt).join(', ')}],\n  },`)
  .join('\n')}
};

/* The About artwork itself (art/about-face.svg, black line-art path,
   viewBox 2378x3840, art bbox x 595-1784, y 960-2880). Rendered as a filled
   layer and wiped in along the drawing frontier; the SKETCHES.about thread
   is the strand of the page line that carries the pen past it. */
export const ABOUT_ART = {
  d: '${aboutArtD}',
  /* transform target: local box [198, 320] = (art - [595, 960]) / 6 */
  offset: [595, 960],
  scale: 1 / 6,
} as const;

/* The Certifications→Contact artwork (art/hands-book.svg, black line-art
   path, viewBox 3840x2560, art bbox x 1030-2810, y 907-1652). ScrollPath
   flips it horizontally and tilts it so the book-holding hand sits below
   Contact's Work/location pill; the page line rides \`thread\` (authored in
   art coordinates along the reaching arm) and ENDS on the trailing stroke.
   \`anchorBook\` = the book-hand point pinned below the pill; \`anchorEntry\`
   = the cuff where the line flows in. */
export const HANDS_ART = {
  d: '${handsArtD}',
  bbox: [1030, 907, 1780, 745],
  thread: '${handsThreadDef.d}',
  threadEntry: [${handsThreadDef.entry.join(', ')}],
  threadExit: [${handsThreadDef.exit.join(', ')}],
  anchorBook: [2320, 1480],
  anchorEntry: [1110, 930],
} as const;

/* The Skills artwork (art/skills-gears.svg, line-work path, art bbox
   x 998-2842, y 1468-2372). Rendered rotated 90° CCW so its flowing line
   runs top→bottom; \`rot\` maps art coords into the motif's local box
   [181, 369]: local = matrix(0 -0.2 0.2 0 -293.6 568.4) · art. The pen's
   ride lives in SKETCHES.skills (already measured + rotated). */
export const SKILLS_ART = {
  d: '${gearsArtD}',
  rot: [0, -0.2, 0.2, 0, -293.6, 568.4],
} as const;

/* The Projects artwork (art/projects-rocket.svg, line-work = the fill-less
   black group: hull+flame+trail plus the porthole rings, merged; art bbox
   x 1613-2227, y 1003-2837). Upright — no rotation; local box [125, 369] =
   (art - [1608, 998]) / 5. The pen's ride lives in SKETCHES.projects. */
export const PROJECTS_ART = {
  d: '${rocketArtD}',
  offset: [1608, 998],
  scale: 1 / 5,
} as const;

/* The Achievements artwork (art/achievements-trophy.svg, line-work = the
   fill-less black group, merged; art bbox x 968-2872, y 537-1194 — a trophy
   on a pedestal riding a FULL-WIDTH wavy ground line). Upright, local box
   [161, 142] = (art - [1650, 510]) / 5. \`crop\` (art-space rects, a union)
   trims the ground line to a short run each side of the pedestal so it
   doesn't streak across the page — the left rect stops above the ground,
   the right rect keeps the exit stretch the pen rides out on. */
export const ACHIEVEMENTS_ART = {
  d: '${trophyArtD}',
  offset: [1650, 510],
  scale: 1 / 5,
  crop: [[1650, 510, 115, 630], [1765, 510, 690, 710]],
} as const;

/* The Certifications artwork (art/certifications-award.svg, line-work = the
   longest bare fill-less path; a scalloped award badge with star, ribbons
   and a FULL-WIDTH baseline at y≈2095). Upright, local box [188, 224] =
   (art - [1400, 1360]) / 5. \`crop\` (one art-space rect) trims the baseline
   to short grounding stubs either side of the badge. */
export const CERTIFICATIONS_ART = {
  d: '${awardArtD}',
  offset: [1400, 1360],
  scale: 1 / 5,
  crop: [[1400, 1360, 940, 1120]],
} as const;

/* The Experience artwork (art/experience-growth.svg, line-work = the longest
   bare fill-less path; five rising bars + a double-stroked zigzag trend
   arrow on a wavy baseline y≈2455-2465). Upright, local box [332, 224] =
   (art - [1190, 1360]) / 5. \`crop\` (one art-space rect) trims the
   full-width baseline to grounding stubs. */
export const EXPERIENCE_ART = {
  d: '${growthArtD}',
  offset: [1190, 1360],
  scale: 1 / 5,
  crop: [[1190, 1360, 1660, 1120]],
} as const;
`;
writeFileSync(join(ROOT, 'src/components/sketchPaths.ts'), ts);
console.log('wrote src/components/sketchPaths.ts');

/* ── optional visual gallery for iterating on the shapes ── */
if (process.argv.includes('--gallery')) {
  /* Face card underlay: the black line-artwork path from the user's supplied
     art/about-face.svg, inlined so the mapping is exact geometry:
     local = (art - [595, 960]) / 6. */
  let faceUnderlay = '';
  try {
    const artSvg = readFileSync(join(ROOT, 'art/about-face.svg'), 'utf8');
    const blackD = artSvg.match(/<\/g><path d="([^"]+)"/)?.[1];
    if (blackD) {
      faceUnderlay =
        `<g transform="scale(${(1 / 6).toFixed(6)}) translate(-595 -960)">` +
        `<path d="${blackD}" style="fill:#b9bfd4;stroke:none" fill-rule="nonzero"/></g>`;
    }
  } catch { /* underlay is optional */ }

  const cards = Object.entries(SKETCHES)
    .map(
      ([id, s]) => `
    <figure>
      <svg viewBox="0 0 ${s.vb[0]} ${s.vb[1]}" style="width:${s.vb[0] * 1.6}px">
        ${id === 'about' ? faceUnderlay : ''}
        <path class="track" d="${s.d}" />
        <path class="ink" pathLength="100" d="${s.d}" />
        <circle cx="${s.entry[0]}" cy="${s.entry[1]}" r="4" fill="#16a34a" stroke="none"/>
        <circle cx="${s.exit[0]}" cy="${s.exit[1]}" r="4" fill="#dc2626" stroke="none"/>
      </svg>
      <figcaption>${id}</figcaption>
    </figure>`,
    )
    .join('\n') +
    `
    <figure>
      <svg viewBox="1000 860 1840 830" style="width:640px">
        <path d="${handsArtD}" style="fill:#b9bfd4;stroke:none" fill-rule="nonzero"/>
        <path class="ink" pathLength="100" d="${handsThreadDef.d}"
              style="stroke-width:12" />
        <circle cx="${handsThreadDef.entry[0]}" cy="${handsThreadDef.entry[1]}" r="18" fill="#16a34a" stroke="none"/>
        <circle cx="${handsThreadDef.exit[0]}" cy="${handsThreadDef.exit[1]}" r="18" fill="#dc2626" stroke="none"/>
      </svg>
      <figcaption>hands-book thread (art coords, pre-flip)</figcaption>
    </figure>`;
  const html = `<!doctype html>
<meta charset="utf-8">
<title>sketch gallery</title>
<style>
  body { font: 14px system-ui; background: #fff; margin: 24px; }
  .grid { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-end; }
  figure { margin: 0; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; }
  figcaption { text-align: center; color: #6b7280; margin-top: 8px; }
  svg { overflow: visible; display: block; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .track { stroke: rgba(79,70,229,0.16); stroke-width: 2.5; }
  .ink { stroke: #4f46e5; stroke-width: 2.5; stroke-dasharray: 100;
         stroke-dashoffset: calc(100 - var(--p)); }
  header { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; }
  input { width: 340px; }
</style>
<header>
  <input id="p" type="range" min="0" max="100" value="100">
  <span id="v">100%</span> drawn
</header>
<div class="grid">${cards}</div>
<script>
  const set = v => { document.body.style.setProperty('--p', v);
    document.getElementById('v').textContent = v + '%'; };
  document.getElementById('p').oninput = e => set(e.target.value);
  set(100);
</script>`;
  writeFileSync(join(ROOT, 'sketch-gallery.html'), html);
  console.log('wrote sketch-gallery.html');
}
