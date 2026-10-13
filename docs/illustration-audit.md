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
and the pen's glow is smaller. Contact remains larger than the other motifs,
but its height is reduced from 410 to 360 px to restore the form's prominence.
The associations remain face/About, gears/Skills, growth/Experience,
rocket/Projects, trophy/Achievements, rosette/Certifications, hands/Contact.

For an even more minimal resume, remove the decoration altogether. Moving it
under text or adding more effects would make this page less coherent. I would
keep this restrained version and judge it by whether the reader still looks
at the headings and content first.

## Why the former traces revisited details

The live drawings were generated from PNG skeletons. The supplied stock EPS
files preserve filled outlines, not the artist's original ordered centerline.
After rasterization, crossings and close strokes become ambiguous junctions,
and some details become disconnected components. The graph router explicitly
backtracks through already drawn ink and returns across connectors to reach
unfinished parts. Merely choosing a straighter turn cannot guarantee a
single traversal of those reconstructed graphs.

The replacement uses deliberately authored cubic strokes inspired by the
reference artwork. The lips and ear loops are completed on their first
encounter; each gear hub is completed before leaving that gear. Rocket,
trophy, award and hands details are connected locally. There are no recovery
walks inserted by a skeleton router. Loops and crossings are part of the
intended drawing; they do not mean an earlier unfinished branch is backfilled.
The source assets and legacy generator remain available for reference.

Production source: `src/components/authoredSketches.ts`. Edit the authored
curves in `scripts/author-scroll-sketches.mjs`, with the gears/chart source in
`art/authored-gear-chart.json`, then regenerate the module.

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
