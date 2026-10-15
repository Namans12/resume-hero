Implement a polished, scroll-driven SVG illustration tracing animation in my existing website.

I will provide PNGs and/or SVGs. Use those illustrations to create one continuous flowing line that travels through the page, traces each illustration in the correct order, and connects naturally to the next illustration.

INPUTS

Website/project: [repository, directory, or URL]
Illustration files: [attach or list files]

Illustration-to-section mapping:
- [Face] → [About]
- [Gears] → [Skills]
- [Growth chart] → [Experience]
- [Rocket] → [Projects]
- [Trophy] → [Achievements]
- [Award/rosette] → [Certifications]
- [Hands/book] → [Contact]

Visual references: [optional]
Preferred color/style: [optional; otherwise match the website]

GOAL

As I scroll down:
1. A small glowing tip moves along a continuous SVG path.
2. The line becomes visible exactly up to that tip.
3. When the path reaches an illustration, it traces the illustration’s details in a deliberate, natural sequence.
4. It completes that illustration before flowing into the next one.
5. Scrolling backward reverses the same animation smoothly.

Preserve the character, proportions, anatomy, and detail of my supplied artwork. The result should feel like an artist drawing a connected composition.

1. INSPECT THE PROJECT AND ASSETS

Inspect the existing layout, animation system, responsive breakpoints, scrolling behavior, and relevant project instructions before implementing.

Classify every asset:
- Native SVG centerline paths.
- SVGs containing multiple strokes/subpaths.
- SVGs containing filled outlines.
- SVGs that merely embed raster images.
- Raster PNG line drawings.
- Artwork that cannot reasonably become a clean continuous trace.

A file being named “SVG,” or containing one <path>, does not prove it contains one ordered stroke. Inspect its geometry and move commands.

Prefer editing native vector geometry and website code for this task.

2. DETERMINE WHETHER EACH ILLUSTRATION IS ELIGIBLE

Good candidates have clear linework, readable details, manageable crossings, and suitable entry/exit points.

For PNGs or filled-outline SVGs:
- Extract the actual line centerlines.
- Use suitable resolution, thresholding, thinning, and cleanup.
- Preserve meaningful small loops and close parallel contours.
- Remove only genuine raster noise and tiny artifacts.
- Fit smooth curves while retaining important corners and details.

Trace the drawing’s centerline. Avoid accidentally tracing both outside boundaries of a thick printed stroke.

Audit the resulting topology:
- Connected components.
- Endpoints.
- Junctions and crossings.
- Closed loops.
- Nearby strokes that merged during rasterization.
- Whether a continuous traversal without retracing is possible.

A connected graph supports an exact traversal of every edge once only when it has zero or two odd-degree vertices. Arbitrary artwork may require small adjustments.

If necessary, propose minimal local repairs:
- Separate merged parallel strokes.
- Add a subtle, short connection between genuinely disconnected components.
- Adjust a junction.
- Restore a narrow parallel lane where the source image lost stroke separation.

Keep these changes visually faithful to the original.

If the requested result would require obvious bridges, large repeated walks, missing details, or substantial distortion, explain the specific limitation and show an alternative before replacing the illustration.

Never promise that every arbitrary image can become a faithful one-stroke drawing.

3. PLAN THE STROKE ORDER DELIBERATELY

This is the most important requirement.

The pen must complete each local feature when it reaches that feature.

Examples:
- Complete the lips before moving on to unrelated facial features.
- Finish both ear loops before leaving the ear.
- Complete a gear and its hub before proceeding to another gear.
- Trace chart bars and arrow details in a coherent sequence.
- Complete the upper hand before moving into the book and lower hand.

Avoid routes that travel down the drawing, discover unfinished branches, and return upward later to fill them.

Build and validate the complete route before animating it. Where appropriate, use bridge-aware, loop-aware Euler traversal with semantic or region priorities.

Do not rely on a greedy nearest-edge router followed by long Dijkstra recovery walks through previously drawn ink.

Distinguish intentional adjacent contours from accidental repeated traversal. Closely spaced lines are part of many original illustrations.

For each illustration:
- Define its entry and exit.
- Define the direction of travel at both ends.
- Produce one ordered continuous stroke.
- Preserve the source’s important details.
- Document any unavoidable local compromise.

4. CREATE NATURAL CONNECTIONS BETWEEN ILLUSTRATIONS

Connect each illustration’s exit to the next illustration’s entry.

Continue the outgoing curve naturally and match the incoming stroke direction. Maintain tangent continuity at joins.

Use a restrained variety of flowing gestures:
- Broad S-curves.
- Gentle bows.
- Open waves.
- Elongated flourishes where appropriate.
- Subtle changes in direction and amplitude.

Give the composition rhythm. Avoid repeating the same oval between every illustration or adding arbitrary sharp turns and tangled loops.

Keep connectors clear of:
- Text and cards.
- Forms and interactive controls.
- Untraced illustration details.
- Viewport edges.

Some original illustrations start at a lower tail. Approach that tail through clear space around the illustration.

Make connectors responsive to the actual available space.

5. KEEP THE GLOWING TIP ATTACHED TO THE INK

The visible line must end exactly at the glowing tip at every scroll position.

Use one canonical route for the ink, tip, and halo, sharing the same length parameterization.

A proven approach is:
- Give the identical paths pathLength="1".
- Ink: stroke-dasharray="1"; stroke-dashoffset=1-progress.
- Tip/halo: round-capped zero-length dash, stroke-dasharray="0 2";
  stroke-dashoffset=2-progress.

Verify the behavior in the target browser.

Avoid independently positioning a circle with getPointAtLength() while revealing ink through a different dash-length calculation. Complex curves can produce cumulative metric differences and a widening gap.

Account for viewBox scaling, CSS transforms, and vector-effect="non-scaling-stroke". These can change dash behavior. Where needed, place the geometry directly into the SVG’s actual displayed coordinate space.

The tracing tip is decorative and separate from the mouse cursor.

6. MAP SCROLLING TO THE COMPOSITION

Give each illustration a deliberate scroll interval associated with its section.

Prevent a detailed illustration from consuming the drawing time intended for the next section simply because its path is longer.

Calculate progress from measured section positions. Use route lengths consistently when composing the overall reveal.

Support:
- Forward and backward scrolling.
- Fast scrolling and navigation jumps.
- Initial hash links.
- Restored browser scroll positions.
- Resizing and orientation changes.
- Fonts and late-loading content.
- Dynamically changing content, including resizable form fields.

Use light, time-based smoothing so the tip follows scrolling naturally without excessive lag.

For a terminal illustration, align its final stroke with a meaningful page boundary—for example, the bottom border of the Contact form.

7. SIZE AND PLACE THE ARTWORK PROPERLY

Measure the actual ink bounds rather than the full source canvas. Crop irrelevant empty space before sizing.

Preserve the original aspect ratio.

Use a consistent visual scale, while allowing:
- Wide charts to fill the available horizontal space.
- Tall illustrations to use the section’s vertical space.
- A larger closing illustration when appropriate.

Keep illustrations associated clearly with their headings and separated from readable content.

On wide monitors, keep the illustration band beside the content. On narrower screens, adapt or hide decorative artwork when the available space cannot support it cleanly.

Measure stable layout positions. Account for entrance-animation transforms so temporary translations do not create permanent alignment errors.

8. PERFORMANCE AND ACCESSIBILITY

Keep the animation efficient:
- Measure layout and path lengths when needed.
- Cache geometry.
- Update lightweight drawing properties during scrolling.
- Use requestAnimationFrame with time-based smoothing.
- Park animation loops when idle.
- Clean up listeners, observers, timers, and animation frames.
- Resume correctly after visibility or focus changes.

Respect prefers-reduced-motion with a clear static presentation and appropriate scrolling behavior.

Keep decorative SVGs out of the accessibility tree and allow pointer events to reach the website’s controls.

Preserve readable text contrast, keyboard focus, and the website’s normal cursor behavior.

9. SHOW A FAITHFUL PREVIEW

Before making substantial aesthetic changes:
- Show the original artwork beside the proposed trace, or provide an original-image overlay.
- Provide a scrubber or playback preview of the actual drawing order.
- Show the connector directions.
- Include a realistic page-context preview for size and placement.

Use the actual proposed geometry in previews.

Preserve approved illustrations. Make further changes only when they resolve a concrete issue or materially improve the composition.

10. IMPLEMENT AND VERIFY

Integrate the approved tracing into the existing website and complete the implementation.

Verify:
- One continuous ordered route per illustration.
- Correct entry/exit anchors.
- Smooth illustration/connector joins.
- No detached tip or widening ink gap.
- No long recovery walks over old ink.
- No missed small loops or details filled much later.
- No unintended lines crossing text, controls, or other artwork.
- Correct terminal alignment.
- No horizontal overflow or clipped strokes.
- Correct behavior at representative desktop and mobile widths.
- Correct forward/backward scrolling and navigation jumps.
- Reduced-motion behavior.
- No browser console errors.

Run the project’s relevant build, lint, and meaningful geometry checks.

Keep editable source geometry and a reproducible generation process. Document which files should be edited and how generated assets are rebuilt.

FINISH WITH

- A visual preview or screenshot of the implemented result.
- A concise explanation of what changed.
- Which illustrations were preserved or locally repaired.
- Any genuine limitations.
- Validation results.
- The relevant source files.

Work autonomously on routine implementation details. Ask for clarification when an asset is genuinely ineligible or a substantial visual decision needs my input.

The final result should be faithful, smooth, readable, and deliberately ordered: one flowing composition that draws itself as I scroll.