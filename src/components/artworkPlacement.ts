import type { SketchDef } from './authoredSketches';

/** The desktop CSS reserves the same gutter. Crop empty canvas space before
 * sizing the actual strokes, and anchor Contact's final cuff to the form. */
export function artworkPlacement(art: SketchDef, width: number, headingTop: number, formBottom?: number) {
  const values = (art.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  const xs = values.filter((_, i) => i % 2 === 0);
  const ys = values.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const boxW = Math.max(...xs) - minX, boxH = Math.max(...ys) - minY;
  const gutter = Math.min(320, Math.max(200, width * 0.22));
  const available = gutter - 36;
  const desiredHeight = formBottom === undefined ? 340 : formBottom - headingTop + 12;
  const scale = Math.min(available / boxW, Math.max(340, desiredHeight) / boxH);
  const x = width - gutter + (gutter - boxW * scale) / 2 - minX * scale;
  const y = formBottom === undefined ? headingTop - 12 - minY * scale : formBottom - art.exit[1] * scale;
  return { x, y, scale, gutter, top: y + minY * scale, bottom: y + (minY + boxH) * scale };
}
