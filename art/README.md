# Current scroll artwork

The live resume uses ordered centerlines from `src/components/authoredSketches.ts`.
Five approved motifs are authored to complete local details without recovery
walks. Experience and Contact preserve the supplied original contours, with
preplanned stroke order and narrow parallel repairs at merged raster junctions.
Edit `scripts/author-scroll-sketches.mjs`, `art/authored-gear-chart.json` and
`art/original-hands-continuous.json`, then run `node scripts/author-scroll-sketches.mjs`.
See `docs/illustration-audit.md` for the design and tracing rationale.

The licensed source artworks below and the legacy `sketchPaths.ts` generator
are preserved as reference material; they are no longer the live tracing paths.

# Licensed one-line vector artworks

These are the user's licensed Vecteezy drawings, used pixel-faithfully by the
scroll line (`src/components/ScrollPath.tsx`): each artwork's black line-art
path is exported into the generated `sketchPaths.ts` by
`scripts/generate-sketch-paths.mjs` and revealed by a mask stroke that rides
the pen's own trace through that artwork - a generated centerline (the
pipeline in `scripts/centerline/`), not a hand-measured ride - so the ink
finishes each stroke exactly as the dot passes it, while the line itself
threads through the composition.

- `about-face.svg` — abstract female face (Vecteezy 33517281). Beside the
  About section; the line threads down its right side and rides the neck
  curve out.
- `experience-growth.svg` — growth bar chart (Vecteezy 6825544). Upright
  beside the Experience section, cropped so its full-width baseline becomes
  grounding stubs; the line enters at the trend arrow's head, rides its shaft
  to the tallest bar, down that bar's edge and out along the ground.
- `skills-gears.svg` — interconnected gears (Vecteezy 71804754). Rotated 90°
  CCW beside the Skills section; the line rides its flowing connector line
  top→bottom.
- `projects-rocket.svg` — rocket take-off (Vecteezy 74114002). Upright beside
  the Projects section; the line enters over the nose, rides the hull's right
  edge, rounds the flame and exits down the exhaust trail's S-wave.
- `achievements-trophy.svg` — trophy cup on a pedestal (Vecteezy 70176239).
  Upright beside the Achievements section, cropped to the pedestal's
  neighbourhood (the source's wavy ground line spans the full canvas); the
  line hooks the right handle, rides the cup's right silhouette down the
  pedestal and exits along the ground line.
- `certifications-award.svg` — best-quality award rosette (Vecteezy
  55596510). Upright beside the Certifications section, cropped so its
  full-width baseline becomes short grounding stubs; the line rides the
  scalloped right edge and exits down the right ribbon tail.
- `hands-book.svg` — hand giving a book (Vecteezy 8969133). Flipped
  horizontally + tilted between Certifications and Contact, the book-holding
  hand below Contact's Work/location pill. THE LINE ENDS on this artwork's
  trailing stroke — it does not continue to the footer.

To swap or add artwork: drop the SVG here (auto-traced bitmap SVGs work, but
each file layers differently — face/hands: first fill-less `<path>` after the
white `<g>`; gears: the LONGEST fill-less path; rocket/trophy: every path
inside the fill-less `<g stroke-width="0">`, merged; award/growth: the
longest bare fill-less `<path>`), wire it in the generator, and re-run
`node scripts/generate-sketch-paths.mjs`.

Vecteezy free-tier assets need artist attribution on the site; Pro doesn't.
