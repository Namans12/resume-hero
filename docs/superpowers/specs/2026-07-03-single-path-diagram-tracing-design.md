# Single-Path Diagram Tracing — Design

**Date:** 2026-07-03
**Status:** Approved approach (A) — automated skeleton extraction + pen-synced ink reveal

## Goal

The scroll line becomes ONE fully traced journey. The pen dot travels a single
continuous path that includes the **complete centerline of every stroke of all
seven artworks** — the dot literally draws each illustration as you scroll,
then flows down the wave to the next, ending inside the hands+book artwork
below Contact's location pill. The separate horizontal wipe-reveals are
deleted; the artwork's original variable-width ink appears progressively
**exactly under the dot**, in drawing order.

## What the user chose (2026-07-03)

1. **Trace depth: every stroke.** When the pen leaves a diagram, the drawing
   is fully complete. Nothing is skipped.
2. **Gap bridging: shortest subtle connector.** The artworks are one-line
   *style* but stored as filled ink outlines with a handful of genuinely
   detached ink components each. The pen hops between detached pieces via the
   shortest small stroke at the closest points. Within connected ink, forced
   retraces (Euler-path edge doubling at odd junctions) are fine — retracing
   over already-drawn ink is invisible.
3. **Final look: original ink revealed by the pen.** The pixel-faithful
   filled artwork is revealed by a mask stroke riding the trace path — NOT
   replaced by a uniform 4px line drawing.

## Architecture

Two parts: an offline generator pipeline (all the hard geometry, zero runtime
cost) and a runtime rendering change in ScrollPath.

### Part 1 — Generator: centerline extraction (scripts/generate-sketch-paths.mjs)

For each of the 7 artworks (`art/*.svg`), the generator additionally produces
a **full one-stroke centerline trace**:

1. **Rasterize** the artwork's ink path (fill, nonzero) to a bitmap at a
   working resolution high enough that the thinnest ink is ≥3px (pure-JS
   scanline fill of the path's polygons — no native canvas dependency; the
   generator already parses these paths).
2. **Skeletonize** with Zhang–Suen thinning → 1px-wide skeleton.
3. **Vectorize** the skeleton into a graph: nodes at junctions (≥3 neighbors)
   and tips (1 neighbor); edges are pixel-chain polylines between nodes.
   Prune spur edges shorter than ~1.5× local ink half-width (thinning
   artifacts), and smooth each polyline (Chaikin or moving-average) so
   variable-width ink doesn't produce wiggle.
4. **Route one stroke over everything:**
   - Per connected component: Eulerize (duplicate cheapest edges to fix odd
     junctions — duplicated traversal = invisible retrace), then walk an
     Euler path. Choose start/end tips to suit the component's entry/exit.
   - Between components: connect greedily at the globally closest point pair
     (shortest subtle connector), ordered so the overall trace still flows
     top-of-artwork → bottom-of-artwork.
   - The whole-artwork route starts at a chosen **entry** near the top and
     ends at a chosen **exit** near the bottom, replacing today's
     hand-measured ride entry/exits. Entry/exit are picked per artwork to
     be near the wave side, preserving today's approach direction (the hands
     artwork keeps its cuff entry + trailing-stroke exit semantics and its
     `pre` tangent-approach point).
5. **Fit curves + simplify:** convert the routed polyline to cubic Béziers
   (least-squares fit, tolerance tuned so the trace stays within ~1.5 source
   units of the skeleton), emit as a single-subpath absolute `M/C/L` string.
6. **Emit** into `sketchPaths.ts`: for each artwork a `trace` field
   (one-stroke `d` in the SAME local coordinate space as the artwork's `d`),
   plus `entry`/`exit` (and `pre` info for hands). The `SKETCHES` motif
   entries (the old partial rides) are replaced by these full traces —
   same interface (`vb`, `d`, `entry`, `exit`), so ScrollPath's `place()`
   and station machinery keep working. The `*_ART` fill paths stay for the
   ink rendering.

Quality gates in the generator (printed per artwork): total trace length,
component count, connector count/total connector length, max deviation
between skeleton and fitted curve. Also renders a debug HTML gallery
(existing gallery workflow) overlaying trace over ink for eyeball checks.

### Part 2 — Runtime: ScrollPath.tsx

1. **Path build unchanged in shape:** `buildPath()` still welds
   wave-wander → station trace → wave-wander …, ending inside the hands
   trace. Station `d` is now the full trace. Weld rule stays (mid-path `M`
   breaks Blink dash sync — replace with `L`).
2. **Delete the wipe system:** `spArtWipe*` keyframes, all `art*ClipRef`
   rects, and the horizontal clip plumbing go away.
3. **Pen-synced ink reveal:** each artwork's `<g>` renders
   - the faint ghost fill (unchanged), and
   - the accent ink fill inside a `<mask>` whose content is a white stroke
     of that artwork's **trace path (transformed to canvas coords — the same
     geometry welded into the global line)**, `strokeWidth` generous enough
     to cover the ink's widest stroke (per-artwork constant measured by the
     generator: max ink width × safety factor), round caps/joins,
     `pathLength={100}`, dash-animated 100→0.
4. **Sync:** the idle remap already computes scroll-keyframe stops of global
   path-length fractions. For each artwork, compute the global length at its
   trace's start and end (`getPointAtLength` bookkeeping while building — or
   measure once on the assembled path via the station's known weld order).
   Local mask progress at stop `s` = clamp((s·L − startLen)/(endLen −
   startLen), 0, 1). Emit one extra `@keyframes` per artwork in the same
   generated stylesheet, driven by the same `scroll(root block)` timeline
   and the same `--sp-start/--sp-end` range as the main draw. The mask
   stroke therefore finishes each stroke at the exact moment the dot passes
   it — no drift, because both derive from the same stops array.
   Until the idle remap lands, masks use a linear fallback over the same
   range (same as the draw path's existing fallback behavior).
5. **Pacing retune:** with full traces the in-diagram path length grows a
   lot. `remapStops` keeps its two rules (never draw below the frontier;
   capped pen speed) but the cap is retuned (raised from 2.4× — final value
   tuned by eye in preview) so diagrams complete while their section is on
   screen without ink popping. The end-clamp behavior (`--sp-end` vs max
   scroll) is unchanged.
6. **Unchanged:** FRONTIER, start anchor, CSS scroll-driven mechanism (all
   locked), ghost previews, colors, desktop-only gating, hands placement
   solve (affine two-anchor), z-order.

### Data flow

```
art/*.svg
  └─ generator: rasterize → thin → graph → Euler route → curve fit
       └─ sketchPaths.ts: SKETCHES[id] = full trace (vb/d/entry/exit)
                          *_ART = ink fills (+ maskStrokeWidth)
            └─ ScrollPath measure(): place stations → buildPath (weld traces)
                 ├─ draw path + dot: existing dash/offset scroll animation
                 └─ per-artwork mask stroke: same stops → local keyframes
```

## Error handling

- Generator hard-fails (exit 1, message) if any artwork's trace deviates
  beyond tolerance, has >0 unreached skeleton edges, or the route has more
  than one subpath — bad traces must never reach the app silently.
- Runtime: if a station can't place (narrow viewport gap), its artwork stays
  hidden and the wave flows past — existing behavior, unchanged.
- Mask keyframe emission is part of the same idle remap; a superseded
  measure (seq guard) discards it, as today.

## Testing / verification

- Generator: assertion-style checks inline (single subpath, endpoints match
  declared entry/exit, deviation within tolerance) + the debug gallery for
  visual overlay per artwork.
- Runtime: preview-tab verification recipe (existing memory): scroll the
  page in steps; at each step confirm (a) ink never appears ahead of the
  dot, (b) each diagram is fully inked when the dot exits it, (c) the dot
  ends in the hands+book trailing stroke at max scroll, (d) no console
  errors, (e) scroll stays smooth (no long frames from oversized paths —
  if the welded `d` gets too heavy, reduce curve-fit density in the
  generator, not at runtime).

## Out of scope

- Mobile/tablet (feature stays desktop-only).
- Changing artwork placement, sizes, section anchors, or the hands
  transform solve.
- The old partial-ride motifs — replaced, not kept as a fallback.
