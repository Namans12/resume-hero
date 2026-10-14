# Illustration and tracing audit

The feature earns its place only if it behaves like a deliberate signature:
quiet, coordinated with the headings, and mechanically reliable. It is not
necessary to understand the resume. A louder execution competes with the
experience, projects and contact actions.

## Design verdict

Keep the revised, restrained right-margin thread. The right margin offers
clear space and creates a visual link between sections. Putting detailed line
art behind paragraphs would make the copy harder to scan; putting an icon
inside every heading would add another repeated UI motif next to the existing
section navigation. The margin is the best location in the current layout.

Completed ink is now thinner and less opaque, the future route is very faint,
and the pen's glow is smaller. Motifs are sized from their actual strokes,
at about 340 px tall on desktop. The original wide Experience graph fills the
gutter at its correct aspect ratio. Contact uses the space from its heading to the form border; the
terminal is the lower cuff and is anchored exactly to that border. Narrower
desktop layouts stack the contact content and form to keep both readable.
The associations remain face/About, gears/Skills, growth/Experience,
rocket/Projects, trophy/Achievements, rosette/Certifications, hands/Contact.

For an even more minimal resume, remove the decoration altogether. Moving it
under text or adding more effects would make this page less coherent. I would
keep this restrained version and judge it by whether the reader still looks
at the headings and content first.

## Richer artwork and flowing connections

The illustrations now include additional eyelid/ear contours, double bearing
rings, a rocket panel seam and layered flame, a pedestal plaque and ribbon
folds. Experience and Contact now retain the supplied original contours,
including the chart's double trend line and the hands' anatomy and fanned pages.

`src/components/flowConnector.ts` follows the outgoing and incoming stroke
directions. Varied open sweeps, arches and waves connect the motifs.
The graph's natural starting tail is low in the drawing: its incoming thread
travels outside the artwork before turning into that tail.
Handles shorten along their own direction in narrower margins, preserving
smooth joins while keeping the ink clear of the content. Geometry tests cover
anchors, tangent continuity, and margin bounds at multiple widths and gaps.

## Why the former traces revisited details

The live drawings were generated from PNG skeletons. The supplied stock EPS
files preserve filled outlines, not the artist's original ordered centerline.
After rasterization, crossings and close strokes become ambiguous junctions,
and some details become disconnected components. The graph router explicitly
backtracks through already drawn ink and returns across connectors to reach
unfinished parts. Merely choosing a straighter turn cannot guarantee a
single traversal of those reconstructed graphs.

The five approved motifs use deliberately authored cubic strokes inspired by
the reference artwork. The lips and ear loops are completed on their first
encounter; each gear hub is completed before leaving that gear. Rocket,
trophy and award details are connected locally. There are no recovery
walks inserted by a greedy skeleton router. Loops and crossings are part of the
intended drawing; they do not mean an earlier unfinished branch is backfilled.
The source assets and legacy generator remain available for reference.

Experience and Contact were reconstructed from the original raster centerlines.
Merged strokes create odd-degree junctions, so an exact one-pass traversal of
the untouched skeleton is impossible. A preplanned minimum pairing restores
narrow parallel lanes at these junctions. Each resulting edge is walked once,
using bridge avoidance and region ordering instead of walking back over old
ink. The upper hand is complete before the book begins; book and lower-hand
boundaries remain interwoven as they are in the original. The cuff receives a
short 2.24-unit terminal extension to make its endpoint the lowest point.
Contour fitting removes raster jitter while keeping the original shapes.

Production source: `src/components/authoredSketches.ts`. Edit the authored
curves in `scripts/author-scroll-sketches.mjs`, with the gears/chart source in
`art/authored-gear-chart.json` and restored Contact source in
`art/original-hands-continuous.json`, then regenerate the module.

## Why the pen separated from the ink

The ink was positioned by SVG stroke dashes, while a separate circle used
`getPointAtLength()` on the long path. Those mechanisms can use different
curve-length approximations, producing cumulative visual drift.

The pen and halo now use tiny round-capped dashes on copies of the exact ink
path, with the same normalized path length. The offsets differ by precisely
one dash unit, so the pen sits at the visible ink endpoint even when the
browser's length approximation differs. No circle position is calculated.

## Validation

`node --test scripts/scroll-artwork.test.mjs` checks finite continuous paths,
entry/exit anchors, bounds, and long retraces. Its recovery-walk detector is
also tested against a deliberately reversed stroke. Small crossings and
nearby contours are tolerated. Browser checks cover forward/backward scroll,
pen/ink dash synchronization, layout clearance, themes and responsive widths.

## Final size and alignment audit

The approved rocket, trophy and award silhouettes remain unchanged. The chart
and hands/book preserve their original silhouettes; the book includes distinct
pages, a cover and a complete lower cuff. Enlarged artwork fits inside a wider reserved desktop gutter, and
the band stays beside the content on wider monitors.

Browser measurements at 1024, 1440 and 1920 px show the Contact endpoint and
form border at the same vertical coordinate. Resizing the message field by
60 px also keeps that alignment exact. Form entrance translations are
removed from geometry measurements; otherwise the animation introduced an
18 px error. The drawing completes when the full form comes into view.

All 19 geometry checks, the production build, and lint pass. Checks cover distinct
open connectors, routing outside a lower-entry illustration, original aspect
ratio, larger artwork bounds, and the changing form endpoint in addition to
continuous traces and smooth joins. The recovery detector distinguishes close
parallel contours from exact reversed walks; both cases have regression fixtures.

The final browser audit confirms exact Contact/form alignment at 1024, 1440
and 1920 px, no horizontal overflow, and no artwork on the 390 px mobile layout.
The cursor resumes with the correct pointer coordinates after a viewport resize.
Navigation now aligns tall sections to their start; centering Experience used
to clip its heading and the graph above the viewport.
