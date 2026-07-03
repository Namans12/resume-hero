import { useEffect, useRef } from 'react';
import { ABOUT_ART, ACHIEVEMENTS_ART, CERTIFICATIONS_ART, EXPERIENCE_ART, HANDS_ART, PROJECTS_ART, SKILLS_ART, SKETCHES, type SketchId } from './sketchPaths';

/* A single one-line route anchored to the page (absolute) alongside the right
   edge, from the About section down through every section. It SCROLLS WITH
   the content - you only see the on-screen slice - and draws solid down to
   the frontier of the viewport, leaving the part below unfilled. On its way
   down, the line blooms into a one-line illustration beside each section
   (Lemonade-giveback style) and threads past the user's real artworks (the
   About face, the Skills gears, the Projects rocket and the Certifications→
   Contact hands+book), each revealed by a wipe riding the same frontier. THE LINE ENDS in the hands+book: it flows into the reaching
   hand's cuff and finishes on the artwork's trailing stroke below Contact's
   Work/location pill - it does NOT return to the right side (explicit user
   instruction, 2026-07-02, replacing the earlier footer-based end anchor).
   Pure CSS scroll-driven (animation-timeline: scroll()); JS only measures
   geometry on load/resize. Desktop only.

   LOCKED (do not change without an explicit ask): the start anchor (About
   heading), FRONTIER, and the CSS-driven draw mechanism (pathLength=100 +
   --sp-start/--sp-end). */

// Where the drawing frontier (the end-point dot) sits down the viewport.
// 0.5 = middle, ~0.85 = lower third (near the bottom), 1 = very bottom edge.
const FRONTIER = 0.80;

const WAVE_INSET = 39;  // wave centreline, from the wrap's right edge (= old 78px strip's centre)
const AMP = 26;         // wave amplitude, as in the pre-motif design
const HEAD_GAP = 36;    // clearance right of a heading's text
const LINE_GAP = 20;    // clearance between a motif and the wave centreline
const MIN_W = 150;      // skip the motif when the gap is tighter than this
const MAX_W = 330;

const SECTIONS: SketchId[] = [
  'about', 'skills', 'experience', 'projects', 'achievements', 'certifications',
];

const n1 = (v: number) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

/* Uniformly scale + translate an absolute-command path (M/L/C/Q/A only).
   Arc radii scale; the rotation and the large-arc/sweep FLAGS pass through
   untouched - running flags through a number formatter emits "0.0 1.0",
   which Chrome's path parser silently rejects. */
const transformPath = (d: string, s: number, dx: number, dy: number) => {
  const t = d.split(/\s+/);
  const out: string[] = [];
  const px = (v: string) => n1(parseFloat(v) * s + dx);
  const py = (v: string) => n1(parseFloat(v) * s + dy);
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === 'M' || c === 'L') {
      out.push(c, px(t[i + 1]), py(t[i + 2]));
      i += 3;
    } else if (c === 'Q') {
      out.push(c, px(t[i + 1]), py(t[i + 2]), px(t[i + 3]), py(t[i + 4]));
      i += 5;
    } else if (c === 'C') {
      out.push(c, px(t[i + 1]), py(t[i + 2]), px(t[i + 3]), py(t[i + 4]), px(t[i + 5]), py(t[i + 6]));
      i += 7;
    } else if (c === 'A') {
      out.push(c, n1(parseFloat(t[i + 1]) * s), n1(parseFloat(t[i + 2]) * s), t[i + 3], t[i + 4], t[i + 5], px(t[i + 6]), py(t[i + 7]));
      i += 8;
    } else {
      i++;
    }
  }
  return out.join(' ');
};

type Pt = { x: number; y: number };

/* Full affine (supports the hands artwork's horizontal flip + tilt):
   x' = a·x + c·y + e ; y' = b·x + d·y + f  — same order as SVG matrix(). */
type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };
const apply = (m: Affine, x: number, y: number): Pt => ({
  x: m.a * x + m.c * y + m.e,
  y: m.b * x + m.d * y + m.f,
});

/* Affine version of transformPath for M/L/C/Q paths (no arcs - arc sweep
   flags invert under reflection, so threads that get flipped avoid them). */
const transformPathAffine = (d: string, m: Affine) => {
  const t = d.split(/\s+/);
  const out: string[] = [];
  let i = 0;
  const push = (x: string, y: string) => {
    const p = apply(m, parseFloat(x), parseFloat(y));
    out.push(n1(p.x), n1(p.y));
  };
  while (i < t.length) {
    const c = t[i];
    if (c === 'M' || c === 'L') {
      out.push(c); push(t[i + 1], t[i + 2]); i += 3;
    } else if (c === 'Q') {
      out.push(c); push(t[i + 1], t[i + 2]); push(t[i + 3], t[i + 4]); i += 5;
    } else if (c === 'C') {
      out.push(c); push(t[i + 1], t[i + 2]); push(t[i + 3], t[i + 4]); push(t[i + 5], t[i + 6]); i += 7;
    } else {
      i++;
    }
  }
  return out.join(' ');
};

/* Catmull-Rom cubics through the waypoints - the flowing hand-drawn wander
   the line takes between illustrations. */
const flowThrough = (pts: Pt[]) => {
  let d = '';
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    d += ` C ${n1(p1.x + (p2.x - p0.x) / 6)} ${n1(p1.y + (p2.y - p0.y) / 6)}`
      + ` ${n1(p2.x - (p3.x - p1.x) / 6)} ${n1(p2.y - (p3.y - p1.y) / 6)}`
      + ` ${n1(p2.x)} ${n1(p2.y)}`;
  }
  return d;
};

/* Wave waypoints from `from` down to `to`, meandering around the wave
   centreline like the pre-motif design (a bend roughly every 340px). */
const wander = (from: Pt, to: Pt, waveX: number, phase: number) => {
  const pts: Pt[] = [from];
  const dy = to.y - from.y;
  const seg = Math.max(1, Math.round(dy / 340));
  for (let i = 1; i < seg; i++) {
    pts.push({ x: waveX + ((i + phase) % 2 ? AMP : -AMP), y: from.y + (dy * i) / seg });
  }
  pts.push(to);
  return pts;
};

interface Station {
  id: string;
  d: string;
  entry: Pt;
  exit: Pt;
  /** placement of the motif's local box on the line's canvas */
  s: number;
  dx: number;
  dy: number;
  /** mask-stroke width (canvas units) for this station's ink reveal */
  maskW: number;
  /** optional tangent-aligned approach point: the connector flows through it
      straight into the entry (used by the hands artwork, whose cuff wants
      the line to arrive along the arm's own outward direction) */
  pre?: Pt;
}

/* The full route: in at the top on the wave, through each illustration, and
   (when the terminal hands+book is placed) ENDING inside it - otherwise out
   at the bottom on the wave. One single continuous path. */
const buildPath = (h: number, waveX: number, stations: Station[], endsOnLast: boolean) => {
  let d = `M ${n1(waveX)} 0`;
  let cur: Pt = { x: waveX, y: 0 };
  let phase = 0;
  const spans: Array<{ id: string; from: number; to: number }> = [];
  for (const st of stations) {
    // wander down the wave, then swing in above the drawing's entry point —
    // or, when the station asks for it, sweep straight through its tangent
    // approach point so the line lands along the drawing's own direction
    const pre: Pt = st.pre ?? { x: st.entry.x, y: Math.max(st.entry.y - 56, cur.y + 6) };
    const waveTo = (st.pre ? pre.y - 180 : st.entry.y - 170);
    const pts = waveTo > cur.y + 40
      ? [...wander(cur, { x: waveX, y: waveTo }, waveX, phase), pre, st.entry]
      : [cur, pre, st.entry];
    d += flowThrough(pts);
    const from = d.length;
    // WELD the motif into the same subpath: its d starts with an M to the
    // pen's current position, and a mid-path M (a new subpath) makes Blink
    // lay the dash out on a different parameterization than offset-distance
    // uses - the ink visibly runs ~2-3% of the path AHEAD of the dot. An L
    // to the same point is a zero-length no-op that keeps one subpath.
    d += ` ${st.d.replace(/^M\b/, 'L')}`;
    spans.push({ id: st.id, from, to: d.length });
    cur = st.exit;
    phase++;
  }
  if (!endsOnLast) d += flowThrough(wander(cur, { x: waveX, y: h }, waveX, phase));
  return { d, spans };
};

/* The one-line drawings pack a LOT of path length into a narrow vertical band,
   so a linear scroll→dash mapping would let the pen draw far below (and finish
   far above) the frontier. Instead, remap: the pen may never draw below the
   frontier line — it pauses at each drawing and completes it exactly as the
   frontier passes the drawing's lowest point. Returns keyframe stops of
   path-length fractions (0..1) for evenly spaced frontier positions. */
/* getPointAtLength is ~1ms per call on this path — sample sparingly (the
   frontier steps are ~45px anyway) and let measure() defer this to idle.

   Two rules shape the pen:
   1. It may not draw below the frontier (the strict prefix rule).
   2. Its speed is CAPPED: when the frontier clears a drawing's lowest dip,
      the strict rule would release the whole loop in one keyframe — chunks
      of ink popping in without the dot travelling them. The cap makes the
      dot sweep every stroke visibly (it may finish a dense drawing a beat
      after the frontier passes it, which reads as the pen catching up). */
const remapStops = (path: SVGPathElement, lineHeight: number, steps = 140) => {
  const L = path.getTotalLength();
  const N = 400;
  const ys = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) ys[i] = path.getPointAtLength((L * i) / N).y;
  // gate each segment by its sampled MAX so unsampled loop-bottoms can't
  // release early (point samples alone miss tight dips by up to ~90px)
  const gate = (i: number) => Math.max(ys[i], ys[i + 1]);
  const stops: number[] = [];
  let i = 0;
  for (let k = 0; k <= steps; k++) {
    const targetY = (lineHeight * k) / steps;
    while (i < N && gate(i) <= targetY) i++;
    stops.push(i / N);
  }
  const maxStep = 2.4 / steps; // ≤2.4x uniform pen speed per keyframe
  for (let k = 1; k <= steps; k++) {
    if (stops[k] > stops[k - 1] + maxStep) stops[k] = stops[k - 1] + maxStep;
  }
  // close out by the final keyframe with a catch-up ramp localized to the
  // page's very end (the trailing tip sits below the deepest frontier)
  for (let k = steps; k >= 0; k--) {
    const budget = 1 - (steps - k) * maxStep;
    if (stops[k] < budget) stops[k] = budget; else break;
  }
  return stops;
};

const ScrollPath: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const drawRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const artRef = useRef<SVGGElement>(null);
  const art2Ref = useRef<SVGGElement>(null);
  const art3Ref = useRef<SVGGElement>(null);
  const art4Ref = useRef<SVGGElement>(null);
  const art5Ref = useRef<SVGGElement>(null);
  const art6Ref = useRef<SVGGElement>(null);
  const art7Ref = useRef<SVGGElement>(null);
  const maskPathRefs = useRef<Record<string, SVGPathElement | null>>({});
  // char-index spans of each station's welded trace within `d` (canvas-path
  // coords into the global route) — consumed by the Task 10 stop-remapper.
  const spansRef = useRef<Array<{ id: string; from: number; to: number }>>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    const track = trackRef.current;
    const draw = drawRef.current;
    const dot = dotRef.current;
    if (!wrap || !svg || !track || !draw || !dot) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;

    let raf = 0;
    let idleId = 0;
    let lastSig = '';
    let measureSeq = 0;
    const idle: (cb: () => void) => number =
      'requestIdleCallback' in window
        ? cb => window.requestIdleCallback(cb, { timeout: 500 })
        : cb => window.setTimeout(cb, 80);
    const measure = () => {
      const about = document.getElementById('about');
      const footer = document.querySelector('footer');
      if (!about || !footer) { raf = requestAnimationFrame(measure); return; }

      const vh = window.innerHeight;
      // Anchor the line's top to the "About" heading itself (not the section top,
      // which sits above the eyebrow).
      const headingEl = about.querySelector('h2') ?? about;
      const lineTop = headingEl.getBoundingClientRect().top + window.scrollY;
      // Provisional extent for placement clamps: the old footer-based bottom
      // (stable - not affected by this element, unlike scrollHeight which this
      // tall element would inflate in a measure loop). The REAL end of the
      // line is set further down: it finishes inside the hands+book artwork.
      const footerBottom = footer.getBoundingClientRect().bottom + window.scrollY;
      const lineHeight = Math.max(200, footerBottom - vh * (1 - FRONTIER) - lineTop);

      // Use the element's ACTUAL pixel width as the viewBox width so the box maps
      // 1:1 on both axes (preserveAspectRatio="none") and nothing distorts.
      const wrapRect = wrap.getBoundingClientRect();
      const cw = Math.max(1, Math.round(wrapRect.width));
      const waveX = cw - WAVE_INSET;

      // One station per section: the illustration rides BESIDE the section
      // (vertically centred on it) in the right-side space, right-aligned
      // against the wave. Width still fits the gap right of the heading's
      // TEXT (measured via a Range - the h2 is a full-width block), which
      // is the narrowest reliable clearance in every section.
      const gapRight = waveX - LINE_GAP;
      const stations: Station[] = [];
      const place = (
        id: SketchId,
        def: (typeof SKETCHES)[SketchId],
        centerDocY: number,
        gapLeftDoc: number,
        opts?: { maxW?: number; nudgeX?: number },
      ): Station | null => {
        const avail = gapRight - (gapLeftDoc - wrapRect.left);
        if (avail < MIN_W) return null;
        const [bw, bh] = def.vb;
        const s = Math.min(opts?.maxW ?? MAX_W, avail) / bw;
        // nudged boxes may slide left of the wave-hugging default, but never
        // past the heading-text clearance
        const dx = Math.max(
          gapLeftDoc - wrapRect.left,
          gapRight - bw * s - (opts?.nudgeX ?? 0),
        );
        // floored so the first drawing never rises above the line's start
        // (nothing may pre-draw), and kept off the very bottom of the line
        const dy = Math.min(
          Math.max(centerDocY - lineTop - (bh * s) / 2, 16),
          lineHeight - bh * s - 24,
        );
        return {
          id,
          d: transformPath(def.d, s, dx, dy),
          entry: { x: def.entry[0] * s + dx, y: def.entry[1] * s + dy },
          exit: { x: def.exit[0] * s + dx, y: def.exit[1] * s + dy },
          s, dx, dy,
          maskW: def.maskW * s,
        };
      };

      let aboutStation: Station | null = null;
      let skillsStation: Station | null = null;
      let projectsStation: Station | null = null;
      let achievementsStation: Station | null = null;
      let certificationsStation: Station | null = null;
      let experienceStation: Station | null = null;
      for (const id of SECTIONS) {
        const section = document.getElementById(id);
        const heading = section?.querySelector('h2');
        if (!section || !heading) continue;
        const range = document.createRange();
        range.selectNodeContents(heading);
        const headRect = range.getBoundingClientRect();
        const secRect = section.getBoundingClientRect();
        let centerDoc = secRect.top + secRect.height / 2 + window.scrollY;
        if (id === 'about') {
          // the face rides beside the Education card (nudged a touch lower)
          const edu = section.querySelector('.rounded-2xl');
          if (edu) {
            const eRect = edu.getBoundingClientRect();
            centerDoc = eRect.top + eRect.height / 2 + window.scrollY + 70;
          }
        }
        // the rocket runs a touch smaller and left of the wave so more of it
        // shows in the gap beside the project cards (user ask, 2026-07-02);
        // the trophy and award badge match that cap for the same clearance
        const st = place(
          id, SKETCHES[id], centerDoc, headRect.right + HEAD_GAP,
          id === 'projects' ? { maxW: 260, nudgeX: 24 }
            : id === 'achievements' || id === 'certifications' ? { maxW: 260 }
              : undefined,
        );
        if (st) {
          stations.push(st);
          if (id === 'about') aboutStation = st;
          if (id === 'skills') skillsStation = st;
          if (id === 'projects') projectsStation = st;
          if (id === 'achievements') achievementsStation = st;
          if (id === 'certifications') certificationsStation = st;
          if (id === 'experience') experienceStation = st;
        }
      }

      // The hands+book artwork stands VERTICALLY on the right column (user
      // 2026-07-03, replacing the below-the-pill diagonal): the reaching hand
      // descends from the wave at the Certifications→Contact boundary and the
      // book-holding hand faces UP beneath it, the book anchor pinned straight
      // below the entry at the pill row's depth. The transform is still the
      // exact two-anchor solve (flip + rotation emerge from the anchors).
      // THE LINE ENDS on the artwork's trailing stroke - no return.
      let handsM: Affine | null = null;
      let handsArtSpan: { top: number; bottom: number } | null = null;
      let endLocalY = lineHeight;
      {
        const contact = document.getElementById('contact');
        const pill = contact?.querySelector('button[title="Tap to switch location"]');
        if (contact && pill) {
          const cRect = contact.getBoundingClientRect();
          const pRect = pill.getBoundingClientRect();
          // At its current scale the give is wider than the column, so the
          // anchors sit well LEFT of the wave (user 2026-07-03: "shift it left
          // as it's getting cut") - this lands the reaching hand's right edge
          // at the column boundary; the upper arm tucks behind content (zIndex
          // 0, always under). Both x's shift together so the vertical/tilt
          // solve (which only reads E−A) is unchanged - a pure translation.
          const HANDS_X = waveX - 324;
          const A = {
            x: HANDS_X - 36,          // book anchor, 36px left of the cuff (holds the tilt)
            // sits higher than the old pill-row depth (user 2026-07-03: start
            // higher + bigger) - raising the book also frees the vertical room
            // the footer guard needs to let the scale grow toward its natural k
            y: pRect.bottom + window.scrollY + 55 - lineTop,
          };
          const E = { x: HANDS_X, y: cRect.top + window.scrollY - 150 - lineTop };
          const [ax, ay] = HANDS_ART.anchorBook;
          const [ex, ey] = HANDS_ART.anchorEntry;
          const u = { x: -(ex - ax), y: ey - ay };           // flipped art vector A→E
          const D = { x: E.x - A.x, y: E.y - A.y };
          // a hair of clockwise bias so the vertical give leans just slightly
          // (user 2026-07-03: "tilt it just a lil clockwise")
          const th = Math.atan2(D.y, D.x) - Math.atan2(u.y, u.x) + 0.07;
          const cos = Math.cos(th), sin = Math.sin(th);
          const buildM = (kk: number): Affine => ({
            a: -kk * cos, b: -kk * sin, c: -kk * sin, d: kk * cos,
            e: A.x + kk * cos * ax + kk * sin * ay,
            f: A.y + kk * sin * ax - kk * cos * ay,
          });
          const [bx, by, bw, bh] = HANDS_ART.bbox;
          const lowestAt = (mm: Affine) => Math.max(
            apply(mm, HANDS_ART.threadExit[0], HANDS_ART.threadExit[1]).y,
            ...[
              apply(mm, bx, by), apply(mm, bx + bw, by),
              apply(mm, bx, by + bh), apply(mm, bx + bw, by + bh),
            ].map(p => p.y),
          );
          let k = Math.min(0.55, Math.max(0.26, Math.hypot(D.x, D.y) / Math.hypot(u.x, u.y)));
          // the book stays pinned below the pill; if the artwork's lowest point
          // (usually the trailing stroke) would reach the footer, SHRINK it
          // until it clears rather than lifting it back into the pill row
          const footerTop = footer.getBoundingClientRect().top + window.scrollY;
          const room = footerTop - 24 - lineTop - A.y;
          const off1 = (lowestAt(buildM(k)) - A.y) / k;
          if (off1 > 0 && k * off1 > room) k = Math.max(0.26, room / off1);
          handsM = buildM(k);

          const entry = apply(handsM, HANDS_ART.threadEntry[0], HANDS_ART.threadEntry[1]);
          const exit = apply(handsM, HANDS_ART.threadExit[0], HANDS_ART.threadExit[1]);
          // approach along the arm's outward extension (book → cuff, continued)
          const bookP = apply(handsM, ax, ay);
          const dirLen = Math.hypot(entry.x - bookP.x, entry.y - bookP.y) || 1;
          const pre = {
            x: entry.x + ((entry.x - bookP.x) / dirLen) * 90,
            y: entry.y + ((entry.y - bookP.y) / dirLen) * 90,
          };
          stations.push({
            id: 'hands',
            d: transformPathAffine(HANDS_ART.thread, handsM),
            entry, exit, s: k, dx: 0, dy: 0, pre,
            maskW: HANDS_ART.maskW * k,
          });
          // the artwork's page extent decides how far the canvas must reach
          const corners = [
            apply(handsM, bx, by), apply(handsM, bx + bw, by),
            apply(handsM, bx, by + bh), apply(handsM, bx + bw, by + bh),
          ];
          const ys = corners.map(p => p.y);
          handsArtSpan = { top: Math.min(...ys), bottom: Math.max(...ys) };
          endLocalY = Math.max(exit.y, handsArtSpan.bottom) + 28;
        }
      }
      const lineEnd = Math.max(200, endLocalY);

      const { d, spans } = buildPath(lineEnd, waveX, stations, !!handsM);
      spansRef.current = spans;
      // Everything below only costs time when the geometry actually changed —
      // the d string encodes all of it, so it doubles as the change signature.
      const sig = `${cw}|${d}`;
      if (sig === lastSig) return;
      lastSig = sig;
      const seq = ++measureSeq;

      track.setAttribute('d', d);
      draw.setAttribute('d', d);
      dot.style.offsetPath = `path("${d}")`;
      // no time-driven animation on the svg circle (the class's r-pulse
      // would repaint the whole layer at 60fps forever)
      dot.style.animationName = 'spDot';
      svg.setAttribute('viewBox', `0 0 ${cw} ${lineEnd}`);

      let staticStyle = document.getElementById('scroll-path-static') as HTMLStyleElement | null;
      if (!staticStyle) {
        staticStyle = document.createElement('style');
        staticStyle.id = 'scroll-path-static';
        document.head.appendChild(staticStyle);
      }

      // Piecewise-remapped keyframes keep the pen ON the frontier even though
      // the drawings pack length unevenly (see remapStops). Sampling the path
      // is the expensive bit (~1ms per probe), so it runs at idle - until it
      // lands, the stylesheet's linear spDraw/spDot fallbacks drive the draw.
      idleId = idle(() => {
        if (seq !== measureSeq) return; // superseded by a newer measure
        const stops = remapStops(draw, lineEnd);
        const last = stops.length - 1;
        let drawKf = '';
        let dotKf = '';
        for (let k = 0; k <= last; k++) {
          const pct = ((k / last) * 100).toFixed(2);
          drawKf += `${pct}% { stroke-dashoffset: ${(100 * (1 - stops[k])).toFixed(3)}; } `;
          dotKf += `${pct}% { offset-distance: ${(100 * stops[k]).toFixed(3)}%; } `;
        }
        let styleEl = document.getElementById('scroll-path-remap') as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'scroll-path-remap';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent =
          `@keyframes spDrawWoven { ${drawKf}}\n@keyframes spDotWoven { ${dotKf}}`;
        draw.style.animationName = 'spDrawWoven';
        dot.style.animationName = 'spDotWoven';
      });

      // Anchor the element to the page (scrolls with content).
      wrap.style.top = `${Math.round(lineTop)}px`;
      wrap.style.height = `${Math.round(lineEnd)}px`;

      // Draw frontier sits FRONTIER down the viewport: solid above it, unfilled
      // below. 0% drawn when About's top hits that line, 100% when the frontier
      // reaches the line's end inside the hands+book artwork.
      const front = vh * FRONTIER;
      // The trailing tip sits below where the frontier can ever reach (the
      // page stops scrolling first), so completion is clamped to the page's
      // last scroll position: the pen finishes exactly as you hit the bottom.
      const maxScroll = footerBottom - vh;
      wrap.style.setProperty('--sp-start', `${Math.round(Math.max(0, lineTop - front))}px`);
      wrap.style.setProperty('--sp-end', `${Math.round(Math.min(lineTop + lineEnd - front, maxScroll))}px`);

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
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    const t1 = window.setTimeout(measure, 600);  // re-measure after late layout (fonts/images)
    const t2 = window.setTimeout(measure, 2200); // lazy-loaded sections settling
    document.fonts?.ready.then(() => measure()).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      measureSeq++; // invalidate any pending idle remap
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const accent = isDark ? '#8ea2ff' : '#4f46e5';
  const track = isDark ? 'rgba(142,162,255,0.20)' : 'rgba(79,70,229,0.16)';

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="scroll-path hidden lg:block"
      style={{
        position: 'absolute',
        right: 'clamp(0.6rem, 1.6vw, 1.9rem)',
        width: 'min(34vw, 460px)',
        zIndex: 0, // behind the sections - a drawing may pass under wide content, never over it
        pointerEvents: 'none',
      }}
    >
      {/* overflow visible so the dot + its glow never get clipped at the path ends */}
      <svg ref={svgRef} width="100%" height="100%" fill="none" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {/* The About artwork - the user's licensed drawing, pixel-faithful: a
            faint ghost previews it, and the inked copy wipes in along the SAME
            frontier the stroke draws to (positioned in measure()). */}
        <g ref={artRef} style={{ display: 'none' }}>
          {/* ghost slightly dimmed so it can't stack with the line's track
              into something that reads as already-drawn */}
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
        {/* The Skills gears artwork - rotated 90° CCW beside the Skills
            section; ghost + a page-space wipe riding the frontier while the
            pen threads its flowing line (positioned in measure()). */}
        <g ref={art3Ref} style={{ display: 'none' }}>
          <g data-skills-t>
            <path d={SKILLS_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
          </g>
          <g mask="url(#sp-skills-reveal)">
            <g data-skills-t>
              <path d={SKILLS_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
            </g>
          </g>
          <mask id="sp-skills-reveal" maskUnits="userSpaceOnUse">
            <path
              ref={el => { maskPathRefs.current.skills = el; }}
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
        {/* The Projects rocket artwork - the user's licensed take-off drawing
            beside the Projects section; ghost + an art-space wipe (upright,
            uniform transform) riding the frontier while the pen rides its
            measured line (positioned in measure()). */}
        <g ref={art4Ref} style={{ display: 'none' }}>
          <path d={PROJECTS_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
          <g mask="url(#sp-projects-reveal)">
            <path d={PROJECTS_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
          </g>
          <mask id="sp-projects-reveal" maskUnits="userSpaceOnUse">
            <path
              ref={el => { maskPathRefs.current.projects = el; }}
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
        {/* The Achievements trophy artwork - the user's licensed drawing
            beside the Achievements section, cropped (union of two art-space
            rects) so its full-width ground line becomes a short run either
            side of the pedestal; ghost + art-space wipe riding the frontier
            (positioned in measure()). */}
        <g ref={art5Ref} style={{ display: 'none' }}>
          <g clipPath="url(#sp-achievements-art-crop)">
            <path d={ACHIEVEMENTS_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
            <g mask="url(#sp-achievements-reveal)">
              <path d={ACHIEVEMENTS_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
            </g>
          </g>
          <clipPath id="sp-achievements-art-crop" clipPathUnits="userSpaceOnUse">
            {ACHIEVEMENTS_ART.crop.map(([x, y, w, h]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />
            ))}
          </clipPath>
          <mask id="sp-achievements-reveal" maskUnits="userSpaceOnUse">
            <path
              ref={el => { maskPathRefs.current.achievements = el; }}
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
        {/* The Experience growth-chart artwork - the user's licensed drawing
            beside the Experience section, cropped (one art-space rect) so its
            full-width baseline becomes grounding stubs; ghost + art-space
            wipe riding the frontier (positioned in measure()). */}
        <g ref={art7Ref} style={{ display: 'none' }}>
          <g clipPath="url(#sp-experience-art-crop)">
            <path d={EXPERIENCE_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
            <g mask="url(#sp-experience-reveal)">
              <path d={EXPERIENCE_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
            </g>
          </g>
          <clipPath id="sp-experience-art-crop" clipPathUnits="userSpaceOnUse">
            {EXPERIENCE_ART.crop.map(([x, y, w, h]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />
            ))}
          </clipPath>
          <mask id="sp-experience-reveal" maskUnits="userSpaceOnUse">
            <path
              ref={el => { maskPathRefs.current.experience = el; }}
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
        {/* The Certifications award artwork - the user's licensed rosette
            badge beside the Certifications section, cropped (one art-space
            rect) so its full-width baseline becomes short grounding stubs;
            ghost + art-space wipe riding the frontier (positioned in
            measure()). */}
        <g ref={art6Ref} style={{ display: 'none' }}>
          <g clipPath="url(#sp-certifications-art-crop)">
            <path d={CERTIFICATIONS_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
            <g mask="url(#sp-certifications-reveal)">
              <path d={CERTIFICATIONS_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
            </g>
          </g>
          <clipPath id="sp-certifications-art-crop" clipPathUnits="userSpaceOnUse">
            {CERTIFICATIONS_ART.crop.map(([x, y, w, h]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />
            ))}
          </clipPath>
          <mask id="sp-certifications-reveal" maskUnits="userSpaceOnUse">
            <path
              ref={el => { maskPathRefs.current.certifications = el; }}
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
        {/* The hands+book artwork - flipped/tilted below Contact's location
            pill; ghost + a page-space wipe that rides the frontier. The page
            line itself ENDS inside this drawing (positioned in measure()). */}
        <g ref={art2Ref} style={{ display: 'none' }}>
          <g data-hands-t>
            <path d={HANDS_ART.d} fill={track} fillOpacity={0.75} stroke="none" fillRule="nonzero" />
          </g>
          <g mask="url(#sp-hands-reveal)">
            <g data-hands-t>
              <path d={HANDS_ART.d} fill={accent} stroke="none" fillRule="nonzero" />
            </g>
          </g>
          <mask id="sp-hands-reveal" maskUnits="userSpaceOnUse">
            <path
              ref={el => { maskPathRefs.current.hands = el; }}
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
        {/* faint full pre-path - shows the route AND the drawings the line will make */}
        <path ref={trackRef} d="" stroke={track} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        {/* solid drawn portion - revealed down to the frontier as you scroll */}
        <path ref={drawRef} className="scroll-path__draw" d="" pathLength={100} stroke={accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        {/* the pen's dot lives IN the svg so it repaints atomically with the
            ink - ANY dot-like element outside this svg (composited) drifts
            from the main-thread dash during scroll and reads as "the line
            filled without the dot". Glow is a static filter; no time-driven
            pulse (that repaints the whole artwork-laden layer at 60fps). */}
        <circle
          ref={dotRef}
          className="scroll-path__dot"
          r={6}
          cx={0}
          cy={0}
          fill={accent}
          style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
        />
      </svg>
    </div>
  );
};

export default ScrollPath;
