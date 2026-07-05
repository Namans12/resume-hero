import { useEffect, useRef } from 'react';
import { SKETCHES, type SketchId } from './sketchPaths';

/* A single one-line route anchored to the page (absolute) alongside the right
   edge, from the About section down through every section. It SCROLLS WITH
   the content - you only see the on-screen slice - and draws solid down to
   the frontier of the viewport, leaving the part below unfilled. On its way
   down, the line becomes each section's one-line illustration (traced from
   the user's svg/*.png artworks, 2026-07-05): the pen enters the drawing at
   its entry tail, rides every stroke of it as ONE continuous line, leaves at
   the exit tail and flows on to the next section's drawing - one unified
   architectural illustration. Placement is FREE-SPACE DRIVEN: a per-band
   content skyline (rightmost painted edge, text measured as glyph boxes) is
   the hard left boundary for every artwork AND every connector waypoint -
   nothing may overlap or hide under a component or button; art shrinks or
   slides vertically until it fits, or skips below MIN_W. THE LINE ENDS in
   the hands+book artwork below Contact's location pill - it does NOT return
   to the wave. Pure CSS scroll-driven (animation-timeline: scroll()); JS
   only measures geometry on load/resize. Desktop only.

   LOCKED (do not change without an explicit ask): the start anchor (About
   heading), FRONTIER, and the CSS-driven draw mechanism (pathLength=100 +
   --sp-start/--sp-end). */

// Where the drawing frontier (the end-point dot) sits down the viewport.
// 0.5 = middle, ~0.85 = lower third (near the bottom), 1 = very bottom edge.
const FRONTIER = 0.80;

const WAVE_INSET = 39;  // wave centreline, from the wrap's right edge
const CONTENT_GAP = 28; // hard clearance between content's right edge and any art/line
const LINE_GAP = 20;    // clearance between a motif and the wave centreline
const MIN_W = 130;      // skip the motif when the gap is tighter than this
const MAX_W = 330;
const SKY_STEP = 24;    // content-skyline sampling pitch down the page

const SECTIONS: Exclude<SketchId, 'hands'>[] = [
  'about', 'skills', 'experience', 'projects', 'achievements', 'certifications',
];

/* Connector templates: each hop between artworks is ONE cubic arc. c1/c2 are
   control points normalized to the exit→entry chord - u along the chord, v
   to the chord's LEFT - in chord lengths. Keyed by the station being
   APPROACHED. SIMPLE on purpose (user 2026-07-06): one gentle S-free curve
   per hop — no overshoot flicks, no deep sweeps — so the connectors read as
   a calm continuation of each drawing's own exit tail. */
const MOCK_ARC: Record<string, { c1: [number, number]; c2: [number, number] }> = {
  about:          { c1: [0.333, -0.16], c2: [0.667, -0.16] },
  skills:         { c1: [0.333, -0.16], c2: [0.667, -0.16] },
  experience:     { c1: [0.333, -0.18], c2: [0.667, -0.18] },
  projects:       { c1: [0.333, -0.14], c2: [0.667, -0.14] },
  achievements:   { c1: [0.333, -0.14], c2: [0.667, -0.14] },
  certifications: { c1: [0.333, -0.18], c2: [0.667, -0.18] },
  hands:          { c1: [0.333, -0.16], c2: [0.667, -0.16] },
};
// a proportional bulge would balloon on long hops - cap its ABSOLUTE size
const ARC_BULGE_MAX = 56;

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

/* Render one template cubic from `from` to `to`. The template's control
   points are mapped onto the chord (bulge capped at ARC_BULGE_MAX). The
   curve is then sampled: if every sample already clears the content skyline
   and the column edge, the EXACT cubic is emitted; otherwise the offending
   samples are pushed right and the hop re-routes as a Catmull through them.
   Artwork-body rows are exempt - the line is MEANT to be there. */
const makeArc = (
  boundLocal: (top: number, bot: number) => number,
  artRow: (top: number, bot: number) => boolean,
  cwLocal: number,
) =>
  (from: Pt, to: Pt, tpl?: { c1: [number, number]; c2: [number, number] }): string => {
    const T = tpl ?? { c1: [0.333, -0.14] as [number, number], c2: [0.667, -0.14] as [number, number] };
    const dx = to.x - from.x, dy = to.y - from.y;
    const L = Math.hypot(dx, dy) || 1;
    const t = { x: dx / L, y: dy / L };
    const n = { x: -t.y, y: t.x };
    const vAbs = Math.max(Math.abs(T.c1[1]), Math.abs(T.c2[1])) * L;
    const kv = vAbs > ARC_BULGE_MAX ? ARC_BULGE_MAX / vAbs : 1;
    const cp = (u: number, v: number): Pt => ({
      x: from.x + t.x * u * L + n.x * v * kv * L,
      y: from.y + t.y * u * L + n.y * v * kv * L,
    });
    const c1 = cp(T.c1[0], T.c1[1]);
    const c2 = cp(T.c2[0], T.c2[1]);
    const bez = (s: number): Pt => {
      const m = 1 - s;
      return {
        x: m * m * m * from.x + 3 * m * m * s * c1.x + 3 * m * s * s * c2.x + s * s * s * to.x,
        y: m * m * m * from.y + 3 * m * m * s * c1.y + 3 * m * s * s * c2.y + s * s * s * to.y,
      };
    };
    const steps = Math.max(4, Math.round(L / 28));
    const samples: Pt[] = [];
    let dirty = false;
    for (let i = 1; i < steps; i++) {
      const p = bez(i / steps);
      let x = p.x;
      if (!artRow(p.y - 12, p.y + 12)) {
        const bnd = boundLocal(p.y - 12, p.y + 12);
        if (bnd > 0) x = Math.max(x, bnd + 16);
      }
      x = Math.min(x, cwLocal - 8);
      if (Math.abs(x - p.x) > 0.5) dirty = true;
      samples.push({ x, y: p.y });
    }
    if (!dirty) {
      return ` C ${n1(c1.x)} ${n1(c1.y)} ${n1(c2.x)} ${n1(c2.y)} ${n1(to.x)} ${n1(to.y)}`;
    }
    return flowThrough([from, ...samples, to]);
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
  /** the placed box (canvas units) - the artwork's visible extent */
  box: { x: number; y: number; w: number; h: number };
}

/* The full route: in at the top on the wave, through each illustration, and
   (when the terminal hands+book is placed) ENDING inside it - otherwise out
   at the bottom on the wave. One single continuous path. */
const buildPath = (
  h: number, waveX: number, stations: Station[], endsOnLast: boolean,
  boundLocal: (top: number, bot: number) => number,
  artRow: (top: number, bot: number) => boolean, cwLocal: number,
) => {
  let d = `M ${n1(waveX)} 0`;
  let cur: Pt = { x: waveX, y: 0 };
  const arc = makeArc(boundLocal, artRow, cwLocal);
  for (const st of stations) {
    // one template arc straight from the previous exit into this drawing's
    // entry - edge to edge.
    d += arc(cur, st.entry, MOCK_ARC[st.id]);
    // WELD the motif into the same subpath: its d starts with an M to the
    // pen's current position, and a mid-path M (a new subpath) makes Blink
    // lay the dash out on a different parameterization than offset-distance
    // uses - the ink visibly runs ~2-3% of the path AHEAD of the dot. An L
    // to the same point is a zero-length no-op that keeps one subpath.
    d += ` ${st.d.replace(/^M\b/, 'L')}`;
    cur = st.exit;
  }
  if (!endsOnLast) d += arc(cur, { x: waveX, y: h });
  return d;
};

/* The one-line drawings pack a LOT of path length into a narrow vertical band,
   so a linear scroll→dash mapping would let the pen draw far below (and finish
   far above) the frontier. Instead, remap: the pen may never draw below the
   frontier line — it pauses at each drawing and completes it exactly as the
   frontier passes the drawing's lowest point. Returns keyframe stops of
   path-length fractions (0..1) for evenly spaced frontier positions.

   Two rules shape the pen:
   1. It may not draw below the frontier (the strict prefix rule).
   2. Its speed is CAPPED: when the frontier clears a drawing's lowest dip,
      the strict rule would release the whole loop in one keyframe — chunks
      of ink popping in without the dot travelling them. The cap makes the
      dot sweep every stroke visibly. */
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
  const maxStep = 4.5 / steps; // ≤4.5x uniform pen speed per keyframe
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
  const dotRef = useRef<SVGPathElement>(null);

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
      // Anchor the line's top to the "About" heading itself (not the section
      // top, which sits above the eyebrow).
      const headingEl = about.querySelector('h2') ?? about;
      const lineTop = headingEl.getBoundingClientRect().top + window.scrollY;
      // Provisional extent for placement clamps: the footer-based bottom
      // (stable - not affected by this element, unlike scrollHeight which this
      // tall element would inflate in a measure loop). The REAL end of the
      // line is set further down: it finishes inside the hands+book artwork.
      const footerBottom = footer.getBoundingClientRect().bottom + window.scrollY;
      const lineHeight = Math.max(200, footerBottom - vh * (1 - FRONTIER) - lineTop);

      // Use the element's ACTUAL pixel width as the viewBox width so the box
      // maps 1:1 on both axes (preserveAspectRatio="none") and nothing distorts.
      const wrapRect = wrap.getBoundingClientRect();
      const cw = Math.max(1, Math.round(wrapRect.width));
      const waveX = cw - WAVE_INSET;

      // ----- Content skyline: the rightmost VISUAL edge of every section's
      // content, sampled every SKY_STEP px down the page (document x, per
      // band). This is the hard boundary art and line stay right of - nothing
      // may overlap or hide under any component or button. Wrapper divs often
      // span the full row while painting nothing, so only elements that
      // actually paint (media, form controls, backgrounds, borders, shadows)
      // and raw text runs (tight glyph boxes via Range) are added - a bare
      // container never blocks the strip.
      const skyN = Math.max(1, Math.ceil((footerBottom - lineTop) / SKY_STEP));
      const sky = new Float32Array(skyN);
      const addRect = (r: DOMRect) => {
        if (r.width < 1 || r.height < 1) return;
        const i0 = Math.max(0, Math.floor((r.top + window.scrollY - lineTop) / SKY_STEP));
        const i1 = Math.min(skyN - 1, Math.floor((r.bottom + window.scrollY - lineTop) / SKY_STEP));
        for (let i = i0; i <= i1; i++) if (r.right > sky[i]) sky[i] = r.right;
      };
      const textRange = document.createRange();
      for (const secId of [...SECTIONS, 'contact']) {
        const sec = document.getElementById(secId);
        if (!sec) continue;
        for (const el of sec.querySelectorAll('*')) {
          if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
            // inner svg nodes: the outer <svg> box already covers them
            if (el.tagName.toLowerCase() === 'svg') addRect(el.getBoundingClientRect());
            continue;
          }
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.display === 'none') continue;
          const paints =
            el.matches('img,video,canvas,button,input,textarea,select,iframe') ||
            cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
            cs.backgroundImage !== 'none' ||
            parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderRightWidth) > 0 ||
            cs.boxShadow !== 'none';
          if (paints) { addRect(el.getBoundingClientRect()); continue; }
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
              textRange.selectNodeContents(node);
              addRect(textRange.getBoundingClientRect());
            }
          }
        }
      }
      // Max skyline over a LINE-LOCAL y band, as a line-local left bound
      // (content right edge + the hard clearance). 0 where the band is empty.
      const skyBoundLocal = (topLocal: number, botLocal: number) => {
        const i0 = Math.max(0, Math.floor(topLocal / SKY_STEP));
        const i1 = Math.min(skyN - 1, Math.floor(botLocal / SKY_STEP));
        let m = 0;
        for (let i = i0; i <= i1; i++) if (sky[i] > m) m = sky[i];
        return m === 0 ? 0 : Math.max(0, m - wrapRect.left + CONTENT_GAP);
      };
      // A placed artwork occupies its bands COMPLETELY (the strip is too
      // narrow to sit two drawings side by side), so later placements must
      // skip those rows. Tracked SEPARATELY from the content skyline: content
      // pushes the line right, artwork rows are where the line belongs.
      const artRows = new Uint8Array(skyN);
      const blockBandsLocal = (topLocal: number, botLocal: number) => {
        const i0 = Math.max(0, Math.floor((topLocal - 12) / SKY_STEP));
        const i1 = Math.min(skyN - 1, Math.floor((botLocal + 12) / SKY_STEP));
        for (let i = i0; i <= i1; i++) artRows[i] = 1;
      };
      const artRowOver = (topLocal: number, botLocal: number) => {
        const i0 = Math.max(0, Math.floor(topLocal / SKY_STEP));
        const i1 = Math.min(skyN - 1, Math.floor(botLocal / SKY_STEP));
        for (let i = i0; i <= i1; i++) if (artRows[i]) return true;
        return false;
      };

      // One station per section: the illustration rides BESIDE the section in
      // whatever free space the skyline leaves, right-aligned against the
      // wave. The fit only ever SHRINKS from the cap: a smaller box spans
      // fewer skyline bands, so the available gap can only grow and the
      // iteration converges monotonically. If the preferred centre is too
      // tight, the band slides up/down in 48px steps and the placement that
      // fits the LARGEST artwork (preferring the centre) wins.
      const gapRight = waveX - LINE_GAP;
      const stations: Station[] = [];
      const place = (
        id: SketchId,
        def: (typeof SKETCHES)[SketchId],
        centerDocY: number,
        opts?: { maxW?: number; nudgeX?: number; spanH?: number; rightEdge?: number },
      ): Station | null => {
        const [bw, bh] = def.vb;
        // rightEdge lets a station spill past the wave lane toward the column
        // edge (the hands terminal: the line has left the wave for good by
        // then, so that strip is free width)
        const rightLim = opts?.rightEdge ?? gapRight;
        const capW = Math.min(opts?.maxW ?? MAX_W, rightLim - CONTENT_GAP);
        // dy for a box of width w at this offset, honouring the line bounds:
        // floored so the first drawing never rises above the line's start
        // (nothing may pre-draw), and kept off the very bottom of the line
        const dyAt = (off: number, w: number) => Math.min(
          Math.max(centerDocY + off - lineTop - (bh * w / bw) / 2, 16),
          lineHeight - bh * (w / bw) - 24,
        );
        // widest box allowed by the skyline over the band a w-wide box spans;
        // rows already holding another artwork are off-limits entirely. The
        // band extends 72px ABOVE the box: the pen needs that runway to swing
        // from the wave into the drawing's entry without cutting the corner
        // of a card that ends just above the artwork.
        const fitAt = (off: number, w: number) => {
          const dy = dyAt(off, w);
          if (artRowOver(dy - 12, dy + (bh * w) / bw + 12)) return 0;
          return Math.min(capW, rightLim - skyBoundLocal(dy - 72, dy + (bh * w) / bw + 12));
        };
        let best: { s: number; dx: number; dy: number; score: number } | null = null;
        // the slide range scales with the section: tall sections (the
        // carousel) have free bands far from their midpoint
        const maxOff = Math.max(288, Math.min(600, (opts?.spanH ?? 0) / 2));
        const offs = [0];
        for (let o = 48; o <= maxOff; o += 48) offs.push(o, -o);
        for (const off of offs) {
          // only-shrink from the cap: a smaller box spans fewer skyline
          // bands, so this converges monotonically...
          let s = capW / bw;
          for (let it = 0; it < 5; it++) {
            const fitW = fitAt(off, s * bw);
            if (fitW >= s * bw - 0.5) break;
            s = Math.max(0, fitW) / bw;
            if (s * bw < MIN_W) break;
          }
          // ...but it can die on a straddle a smaller box slips past (a tall
          // cap-sized box catches a blocker row the floor-sized box clears).
          // Re-probe upward from the floor with a short binary search.
          if (s * bw < MIN_W && fitAt(off, MIN_W) >= MIN_W) {
            let lo = MIN_W, hi = capW;
            for (let it = 0; it < 5; it++) {
              const mid = (lo + hi) / 2;
              if (fitAt(off, mid) >= mid) lo = mid; else hi = mid;
            }
            s = lo / bw;
          }
          // prefer the section's own centre: a slide only wins when it buys
          // meaningfully more size (~8px of width per 64px of drift)
          const score = s * bw - Math.abs(off) * 0.125;
          if (s * bw >= MIN_W && (!best || score > best.score)) {
            const dy = dyAt(off, s * bw);
            const bound = skyBoundLocal(dy - 72, dy + bh * s + 12);
            // nudged boxes may slide left of the wave-hugging default, but
            // never past the skyline clearance
            const dx = Math.max(bound, rightLim - bw * s - (opts?.nudgeX ?? 0));
            best = { s, dx, dy, score };
          }
          if (best && off === 0 && best.s * bw >= capW - 0.5) break;
        }
        if (!best) return null;
        const { s, dx, dy } = best;
        return {
          id,
          d: transformPath(def.d, s, dx, dy),
          entry: { x: def.entry[0] * s + dx, y: def.entry[1] * s + dy },
          exit: { x: def.exit[0] * s + dx, y: def.exit[1] * s + dy },
          s, dx, dy,
          box: { x: dx, y: dy, w: bw * s, h: bh * s },
        };
      };

      for (const id of SECTIONS) {
        const section = document.getElementById(id);
        if (!section) continue;
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
        // per-artwork caps (user 2026-07-06): the rocket runs LARGE beside the
        // project cards; the graph keeps a tighter cap for clear space on its
        // left AND hugs the wave (negative nudge = shifted right); the trophy
        // runs a touch smaller
        const st = place(
          id, SKETCHES[id], centerDoc,
          id === 'projects' ? { maxW: 345, nudgeX: 12, spanH: secRect.height }
            : id === 'experience' ? { maxW: 280, nudgeX: -12, spanH: secRect.height }
              : id === 'achievements' ? { maxW: 220, spanH: secRect.height }
                : id === 'certifications' ? { maxW: 280, spanH: secRect.height }
                  : { spanH: secRect.height },
        );
        if (st) {
          stations.push(st);
          blockBandsLocal(st.box.y, st.box.y + st.box.h);
        }
      }

      // The hands+book terminal: the artwork is already the vertical
      // composition (a hand reaching down passes the book to a hand below),
      // so it places like any other station - below Contact's location pill,
      // in the free strip. THE LINE ENDS on its trailing stroke - no return.
      let handsStation: Station | null = null;
      let endLocalY = lineHeight;
      {
        const contact = document.getElementById('contact');
        if (contact) {
          const cRect = contact.getBoundingClientRect();
          const pill = contact.querySelector('button[title="Tap to switch location"]');
          // the hands+book run LARGE (user 2026-07-06) — the terminal artwork
          // is the line's finale, anchored BESIDE THE FORM'S LOWER HALF (the
          // user marked the spot right of the Message field). On wide screens
          // the strip right of the form is broad and the artwork sits exactly
          // there; on narrow layouts the skyline shrinks it, and place()'s
          // vertical slide search walks it up toward the free rows above the
          // form rather than dropping it entirely.
          const form = contact.querySelector('form');
          const fRect = form?.getBoundingClientRect();
          const centerDoc = fRect
            ? fRect.top + fRect.height * 0.65 + window.scrollY
            : pill
              ? pill.getBoundingClientRect().bottom + window.scrollY + 330
              : cRect.top + cRect.height * 0.85 + window.scrollY;
          // POSITION over size (user 2026-07-06): stay at the form-side
          // anchor (normal slide range — no wandering up to the pocket above
          // the form) and let the box use the wave lane too (rightEdge): the
          // line is done with the wave by here, buying ~47px of width on
          // laptop screens where the strip beside the form runs tight.
          handsStation = place('hands', SKETCHES.hands, centerDoc, {
            maxW: 460, spanH: cRect.height, rightEdge: cw - 12,
          });
          if (handsStation) {
            stations.push(handsStation);
            blockBandsLocal(handsStation.box.y, handsStation.box.y + handsStation.box.h);
            endLocalY = Math.max(handsStation.exit.y, handsStation.box.y + handsStation.box.h) + 28;
          }
        }
      }
      const lineEnd = Math.max(200, endLocalY);

      const d = buildPath(lineEnd, waveX, stations, !!handsStation, skyBoundLocal, artRowOver, cw);
      if (import.meta.env.DEV) {
        // dev-only: exact placement geometry for overlap verification/tuning
        (window as unknown as Record<string, unknown>).__spDebug = {
          lineTop, wrapLeft: wrapRect.left, cw, lineEnd,
          sky: Array.from(sky),
          stations: stations.map(st => ({ id: st.id, s: st.s, box: st.box })),
        };
      }
      // Everything below only costs time when the geometry actually changed —
      // the d string encodes all of it, so it doubles as the change signature.
      const sig = `${cw}|${d}`;
      if (sig === lastSig) return;
      lastSig = sig;
      const seq = ++measureSeq;

      track.setAttribute('d', d);
      draw.setAttribute('d', d);
      // the dot is a tiny dash on the SAME geometry (see index.css) — it
      // shares the ink's dash parameterization, so it can never drift off
      // the drawn front the way offset-path did
      dot.setAttribute('d', d);
      // dash length in pathLength units scales with the REAL path length —
      // pick it so the dash is <1px on screen and the round caps render a
      // clean CIRCLE (a fixed 0.02 was ~6px here: a visible capsule)
      const dotLen = dot.getTotalLength();
      const dashU = Math.min(0.02, (0.6 / Math.max(1, dotLen)) * 100);
      dot.style.strokeDasharray = `${dashU} ${200 - dashU}`;
      dot.style.animationName = 'spDot';
      svg.setAttribute('viewBox', `0 0 ${cw} ${lineEnd}`);

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
          // dot dash-offset 200→100 tracks the ink front exactly (same stops)
          dotKf += `${pct}% { stroke-dashoffset: ${(200 - 100 * stops[k]).toFixed(3)}; } `;
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

      // Draw frontier sits FRONTIER down the viewport: solid above it,
      // unfilled below. 0% drawn when About's top hits that line, 100% when
      // the frontier reaches the line's end inside the hands+book artwork.
      const front = vh * FRONTIER;
      // The trailing tip sits below where the frontier can ever reach (the
      // page stops scrolling first), so completion is clamped to the page's
      // last scroll position: the pen finishes exactly as you hit the bottom.
      const maxScroll = footerBottom - vh;
      wrap.style.setProperty('--sp-start', `${Math.round(Math.max(0, lineTop - front))}px`);
      wrap.style.setProperty('--sp-end', `${Math.round(Math.min(lineTop + lineEnd - front, maxScroll))}px`);
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
        {/* faint full pre-path - shows the route AND the drawings the line will make */}
        <path ref={trackRef} d="" stroke={track} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        {/* solid drawn portion - revealed down to the frontier as you scroll */}
        <path ref={drawRef} className="scroll-path__draw" d="" pathLength={100} stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {/* the pen's dot: a tiny round-cap dash riding a copy of the same
            path (d + keyframes set in measure()). Sharing the ink's dash
            engine keeps it GLUED to the drawn front — the previous
            offset-path circle used a different length parameterization and
            visibly separated from the line on this dense a path. Glow is a
            static filter; no time-driven pulse. */}
        <path
          ref={dotRef}
          className="scroll-path__dot"
          d=""
          pathLength={100}
          fill="none"
          stroke={accent}
          strokeWidth={13}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
        />
      </svg>
    </div>
  );
};

export default ScrollPath;
