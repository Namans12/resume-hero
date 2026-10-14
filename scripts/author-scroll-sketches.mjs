/** Ordered centerlines from authored motifs and the original reference art.
 * Every feature is visited at its junction. These are not raster skeletons.
 * Re-run after editing: node scripts/author-scroll-sketches.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

// Use source-sized coordinates when authoring, then normalize the actual ink
// bounds. M/C only makes placement and concatenation unambiguous.
function normalize(d) {
  const coords = [...d.matchAll(/-?\d*\.?\d+/g)].map(m => Number(m[0]));
  const xs = coords.filter((_, i) => i % 2 === 0);
  const ys = coords.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...xs), maxY = Math.max(...ys);
  const scale = 284 / (maxY - minY);
  let n = 0;
  const path = d.replace(/-?\d*\.?\d+/g, value => {
    const origin = n++ % 2 === 0 ? minX : minY;
    return String(Math.round(((Number(value) - origin) * scale + 8) * 100) / 100);
  }).replace(/\s+/g, ' ').trim();
  const values = [...path.matchAll(/-?\d*\.?\d+/g)].map(m => Number(m[0]));
  return { vb: [Math.ceil((maxX - minX) * scale + 16), 300], d: path,
    entry: values.slice(0, 2), exit: values.slice(-2), maskW: 2 };
}

// Regular scallops, a centered five-point star, and balanced ribbon tails.
function award() {
  const f = n => Math.round(n * 100) / 100;
  const pair = p => `${f(p[0])} ${f(p[1])}`;
  let d = 'M 120 0 C 113 18 103 35 120 40';
  const radius = a => 76 + 9 * Math.cos(8 * (a + Math.PI / 2));
  const point = a => [120 + radius(a) * Math.cos(a), 125 + radius(a) * Math.sin(a)];
  const derivative = a => {
    const r = radius(a), dr = -72 * Math.sin(8 * (a + Math.PI / 2));
    return [dr * Math.cos(a) - r * Math.sin(a), dr * Math.sin(a) + r * Math.cos(a)];
  };
  const step = Math.PI * 2 / 64;
  for (let i = 0; i < 64; i++) {
    const a = -Math.PI / 2 + step * i, b = a + step;
    const p = point(a), q = point(b), u = derivative(a), v = derivative(b);
    d += ` C ${pair([p[0] + u[0] * step / 3, p[1] + u[1] * step / 3])}`
      + ` ${pair([q[0] - v[0] * step / 3, q[1] - v[1] * step / 3])} ${pair(q)}`;
  }
  d += ' C 116 51 105 63 120 68 C 151.48 68 177 93.52 177 125'
    + ' C 177 156.48 151.48 182 120 182 C 88.52 182 63 156.48 63 125'
    + ' C 63 93.52 88.52 68 120 68 C 126 72 126 76 120 80';
  let previous = [120, 80];
  for (let i = 1; i <= 10; i++) {
    const angle = -Math.PI / 2 + Math.PI * i / 5, r = i % 2 === 0 ? 45 : 21;
    const next = [120 + r * Math.cos(angle), 125 + r * Math.sin(angle)];
    d += ` C ${pair(previous.map((p, j) => p + (next[j] - p) / 3))}`
      + ` ${pair(previous.map((p, j) => p + (next[j] - p) * 2 / 3))} ${pair(next)}`;
    previous = next;
  }
  d += ' C 148 72 174 88 182 114 C 194 154 166 186 121 189'
    + ' C 105 195 82 198 69 199 C 59 230 49 261 39 291'
    + ' C 51 289 63 285 74 281 C 78 297 83 316 88 334'
    + ' C 99 304 109 271 120 242 C 131 271 142 305 153 334'
    + ' C 158 316 162 297 167 281 C 179 285 190 289 202 291'
    + ' C 192 263 181 235 172 213 C 168 203 162 197 155 195'
    + ' C 154 226 159 291 153 334';
  return d;
}

const source = {
  // Nose → left eyebrow → jaw → BOTH lip lobes → right eyebrow → BOTH
  // ear loops → neck. Each loop is completed on the first encounter.
  about: `M 376 423
    C 403 438 418 471 402 489 C 391 503 375 505 366 493
    C 357 476 333 484 317 495 C 296 511 324 518 344 512
    C 324 531 291 538 258 518 C 219 494 233 452 235 416
    C 244 324 240 224 220 180 C 199 133 157 115 113 117
    C 61 115 31 139 25 171 C 18 197 27 208 42 206
    C 89 204 138 213 166 231 C 202 260 148 269 103 267
    C 73 267 36 264 33 254 C 27 239 47 237 54 254
    C 77 274 125 277 146 258 C 130 286 89 284 54 254
    C 65 311 76 373 105 439 C 150 537 207 623 279 719
    C 307 757 321 805 358 824 C 400 848 461 842 503 823
    C 552 802 574 758 570 701 C 568 648 543 618 500 606
    C 449 588 389 552 352 578 C 338 588 332 595 320 591
    C 292 584 277 599 279 624 C 281 650 291 656 310 650
    C 379 633 445 613 500 606 C 473 650 426 688 381 697
    C 345 704 304 696 292 679 C 283 665 288 656 305 650
    C 375 643 442 610 500 606 C 548 612 573 571 595 529
    C 631 462 657 376 660 299 C 663 227 653 161 626 127
    C 613 111 600 105 590 104
    C 539 91 478 97 420 119 C 367 138 321 186 282 207
    C 259 220 259 197 277 174 C 321 121 395 80 450 74
    C 505 65 549 80 590 104 C 622 108 626 92 617 72
    C 604 46 617 25 638 31 C 675 37 701 85 717 123
    C 732 158 744 184 765 172 C 798 158 818 101 850 64
    C 883 25 913 27 935 41 C 949 52 955 73 954 104
    C 943 65 922 56 898 73 C 868 91 845 138 846 174
    C 846 211 866 236 895 224 C 929 209 952 147 954 104
    C 928 80 902 111 883 145 C 868 174 876 208 895 204
    C 914 199 929 159 922 140 C 919 129 908 148 909 168
    C 933 151 944 120 954 104
    C 973 164 963 242 928 286 C 900 322 870 341 837 333
    C 815 331 811 313 818 298 C 825 282 836 299 837 333
    C 839 385 831 448 813 494 C 778 585 700 674 625 747
    C 572 795 540 810 551 845 C 575 912 611 982 657 980
    C 698 976 717 887 733 842 C 753 779 781 735 816 748
    C 860 765 845 808 818 848 C 774 915 712 967 644 1027
    C 551 1108 492 1164 487 1255 C 476 1376 549 1497 568 1605
    C 600 1783 506 1904 416 2007`,

  // Window, fins and flame are connected deliberately at distinct points.
  // No detached window rings or separate flame components to backfill.
  projects: `M 190 0 C 186 35 174 81 154 104
    C 145 72 129 45 110 25 C 91 45 75 73 66 104
    C 89 112 132 112 154 104 C 163 139 164 183 160 218
    C 137 229 98 225 78 214 C 97 201 135 204 160 218
    C 177 227 190 245 195 282 C 181 270 169 261 154 258
    C 145 259 139 258 132 256 C 123 259 116 267 110 277
    C 101 267 91 260 84 257 C 74 228 68 200 72 172
    C 74 162 82 160 88 160 C 88 147.85 97.85 138 110 138
    C 122.15 138 132 147.85 132 160 C 132 172.15 122.15 182 110 182
    C 97.85 182 88 172.15 88 160 C 92 158 95 155 96 160
    C 96 152.27 102.27 146 110 146 C 117.73 146 124 152.27 124 160
    C 124 167.73 117.73 174 110 174 C 102.27 174 96 167.73 96 160
    C 86 164 82 182 77 197 C 60 219 48 245 45 282
    C 59 270 70 262 84 257 C 95 251 113 251 132 256
    C 136 270 131 293 126 311 C 121 327 115 337 110 344
    C 104 334 97 319 95 305 C 92 287 97 274 104 271
    C 102 292 109 314 110 344 C 122 329 145 309 137 287
    C 130 300 124 321 110 344 C 114 357 128 369 122 381
    C 118 390 112 396 110 410`,

  // Rim → left handle (including its small loop) → bowl → right handle
  // → stem → pedestal. The plaque is drawn locally within the pedestal outline.
  achievements: `M 110 0 C 104 20 78 25 66 48
    C 66 35 156 35 156 48 C 156 61 66 61 66 48
    C 62 58 62 66 64 73 C 56 68 58 52 50 47
    C 29 34 15 53 19 78 C 23 105 46 123 73 129
    C 83 132 83 143 75 146 C 65 149 60 138 68 134
    C 74 130 81 139 77 142 C 82 160 97 173 110 177
    C 139 165 150 114 156 62 C 164 66 163 51 172 47
    C 193 35 207 54 203 78 C 199 105 176 124 149 129
    C 139 132 139 143 147 146 C 157 149 162 138 154 134
    C 148 130 141 139 145 142 C 171 128 186 107 185 82
    C 184 65 174 59 170 70 C 166 83 159 90 156 62
    C 151 102 143 153 110 177 C 98 181 89 190 96 195
    C 102 200 122 200 128 195 C 136 187 119 181 110 184
    C 126 194 126 214 116 230 C 130 242 141 249 153 253
    C 163 265 78 273 73 253 C 89 245 104 231 101 216
    C 98 199 106 194 110 184 C 108 204 113 231 110 243
    C 127 250 142 256 153 253 C 160 256 166 261 170 263
    C 175 274 177 286 178 295 C 145 299 76 299 45 295
    C 46 286 48 274 51 263 C 91 265 138 265 170 263
    C 169 268 166 271 163 273 C 135 273 86 273 60 273
    C 58 278 57 283 57 287 C 89 289 139 289 164 287
    C 164 282 164 278 163 273 C 171 283 176 293 179 301
    C 186 310 190 317 193 324 C 154 328 76 328 32 324
    C 34 316 36 309 38 304 C 71 307 137 307 179 301
    C 183 313 194 327 192 333 C 182 343 143 338 132 345
    C 120 351 114 355 112 365`,

  // Outer rosette → inner circle → star → ribbon, without coming back
  // from the ribbons to fill the medallion later.
  certifications: award(),


};

const sketches = Object.fromEntries(Object.entries(source).map(([id, d]) => [id, normalize(d)]));
const additional = JSON.parse(readFileSync(join(root, 'art/authored-gear-chart.json'), 'utf8'));
Object.assign(sketches, additional);
// Restore the supplied hands/book contours with a preplanned, ordered route.
// At merged raster junctions, narrow parallel lanes keep each stroke unique.
sketches.hands = JSON.parse(readFileSync(join(root, 'art/original-hands-continuous.json'), 'utf8'));
const ids = ['about', 'skills', 'experience', 'projects', 'achievements', 'certifications', 'hands'];
const header = `/** Ordered one-stroke artwork. Generated from the deliberately authored\n * curves in scripts/author-scroll-sketches.mjs; do not raster-trace these.\n * Each small loop is completed before proceeding to the next feature. */\nexport type SketchId = ${ids.map(id => `'${id}'`).join(' | ')};\nexport interface SketchDef {\n  vb: readonly [number, number];\n  d: string;\n  entry: readonly [number, number];\n  exit: readonly [number, number];\n  maskW: number;\n}\n\nexport const SKETCHES: Record<SketchId, SketchDef> = `;
writeFileSync(join(root, 'src/components/authoredSketches.ts'), header + JSON.stringify(sketches, null, 2) + ';\n');
writeFileSync(join(root, 'artifacts/authored-sketches.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 400" width="1680" height="400"><rect width="1680" height="400" fill="#0b0b0f"/>${ids.map((id,i)=>{ const scale=Math.min(1,200/sketches[id].vb[0]); return `<g transform="translate(${i*240+20},35)"><text x="0" y="-12" fill="#ddd" font-family="sans-serif" font-size="14">${id}</text><g transform="translate(${(200-sketches[id].vb[0]*scale)/2},${(300-300*scale)/2}) scale(${scale})"><path d="${sketches[id].d}" fill="none" stroke="#a6b5f7" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></g></g>`; }).join('')}</svg>`);
console.log('Authored seven one-pass sketches and preview.');
