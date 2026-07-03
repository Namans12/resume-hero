#!/usr/bin/env node
/*
  Generates src/components/sketchPaths.ts — the one-line section motifs
  that ScrollPath weaves into its single drawn line (About face, Skills gears,
  Experience growth chart, Projects rocket, Achievements trophy,
  Certifications award, plus the Certifications→Contact hands+book).

  Each motif's `d` is a SINGLE continuous stroke that ENTERS near the top and
  EXITS near the bottom, so the page line can flow in, draw the object, and
  flow on. `entry`/`exit` are exported for the connectors.

  Every motif is a FULL centerline trace (offline raster → thin → graph →
  route → fit pipeline in scripts/centerline/) over one of the user's
  licensed Vecteezy artworks in art/ — face, gears, growth chart, rocket,
  trophy, award rosette, plus the hands+book terminal.

      node scripts/generate-sketch-paths.mjs            # writes sketchPaths.ts
      node scripts/generate-sketch-paths.mjs --gallery  # + sketch-gallery.html
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traceArtwork } from './centerline/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const fmt = v => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

/* ── the real artworks: black line-art paths from the user's licensed
   drawings, extracted verbatim for the pixel-faithful wipe reveals AND as
   the source ink the centerline pipeline traces ── */
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

/* ── emit the TypeScript module ── */
const ts = `/*
  GENERATED by scripts/generate-sketch-paths.mjs — do not edit by hand.
  Six one-line section motifs, woven into ScrollPath's single line: each
  \`d\` is a SINGLE continuous stroke tracing EVERY stroke of the artwork
  (generated centerline route) — it enters at \`entry\` (top) and leaves at
  \`exit\` (bottom), so the page line can flow through it.
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
  /** mask-stroke width (local units) that covers the ink's widest stroke */
  maskW: number;
}

export const SKETCHES: Record<SketchId, SketchDef> = {
${Object.entries(SKETCHES)
  .map(([id, s]) =>
    `  ${id}: {\n    vb: [${s.vb[0]}, ${s.vb[1]}],\n    d: '${s.d}',\n    entry: [${s.entry.map(fmt).join(', ')}],\n    exit: [${s.exit.map(fmt).join(', ')}],\n    maskW: ${fmt(s.maskW)},\n  },`)
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
   Contact's Work/location pill; the page line rides \`thread\` (a full
   centerline trace in art coordinates) and ENDS on the artwork's trailing
   stroke. \`anchorBook\` = the book-hand point pinned below the pill;
   \`anchorEntry\` = the cuff where the line flows in. */
export const HANDS_ART = {
  d: '${handsArtD}',
  bbox: [1030, 907, 1780, 745],
  thread: '${traced.hands.d}',
  threadEntry: [${traced.hands.entry.map(fmt).join(', ')}],
  threadExit: [${traced.hands.exit.map(fmt).join(', ')}],
  maskW: ${fmt(traced.hands.maskW)},
  anchorBook: [2320, 1480],
  anchorEntry: [1110, 930],
} as const;

/* The Skills artwork (art/skills-gears.svg, line-work path, art bbox
   x 998-2842, y 1468-2372). Rendered rotated 90° CCW so its flowing line
   runs top→bottom; \`rot\` maps art coords into the motif's local box
   [181, 369]: local = matrix(0 -0.2 0.2 0 -293.6 568.4) · art. The pen's
   ride lives in SKETCHES.skills (already traced + rotated). */
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
