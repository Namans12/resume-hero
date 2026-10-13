/** Deliberately ordered centerlines, inspired by the user's reference art.
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
  projects: `M 148 0 C 148 29 141 62 132 90
    C 124 60 110 35 92 20 C 70 46 56 75 55 98
    C 79 103 110 99 132 90 C 145 121 152 159 154 193
    C 169 202 183 214 187 235 C 190 247 193 257 193 265
    C 181 254 168 244 153 241 C 152 219 144 208 132 211
    C 115 219 126 245 110 251 C 102 254 97 238 94 224
    C 85 205 76 177 70 152 C 61 147 61 123 79 116
    C 96 109 110 120 111 136 C 112 151 99 163 85 159
    C 72 155 69 139 77 129 C 85 118 101 125 103 136
    C 105 147 93 156 84 149 C 74 141 69 153 70 166
    C 72 183 82 204 86 218 C 79 227 67 239 55 245
    C 51 229 47 211 55 199 C 60 190 65 185 71 183
    C 62 177 46 193 45 210 C 42 231 51 252 55 269
    C 67 258 74 245 87 242 C 97 247 104 248 110 251
    C 120 266 132 282 139 294 C 127 285 108 265 101 251
    C 89 266 118 306 139 321 C 143 293 151 267 140 251
    C 133 244 127 258 130 275 C 132 291 142 305 139 321
    C 135 338 122 348 131 363 C 140 378 148 385 148 400`,

  // Rim → left handle (including its small loop) → bowl → right handle
  // → stem → pedestal. Simplified plaque avoids nested disconnected shapes.
  achievements: `M 120 0 C 120 16 88 22 77 32
    C 49 21 32 40 36 61 C 41 87 67 98 81 106
    C 95 115 96 123 88 126 C 76 129 72 117 82 116
    C 93 114 96 129 104 134
    C 91 120 84 87 81 63 C 78 47 67 44 62 57
    C 59 74 72 84 88 93 C 71 81 58 61 61 44
    C 64 33 74 35 77 44 C 81 62 84 70 92 66
    C 100 61 92 47 100 38 C 114 21 165 24 182 35
    C 194 46 170 51 145 51 C 119 51 101 48 102 42
    C 105 32 173 32 182 35 C 198 39 187 62 194 70
    C 207 82 210 54 216 44 C 226 25 252 37 253 60
    C 255 91 225 107 204 124 C 194 132 198 141 207 139
    C 220 137 216 125 204 130 C 189 135 177 145 155 157
    C 140 163 129 158 110 148 C 97 141 89 135 104 134
    C 116 146 136 152 151 154 C 166 158 164 165 151 168
    C 132 170 126 183 139 195 C 153 207 165 197 162 190
    C 159 182 139 183 139 189 C 140 196 157 199 167 195
    C 180 190 183 181 173 174 C 162 165 155 163 155 157
    C 190 168 189 184 179 198 C 162 223 194 238 209 251
    C 218 260 181 270 151 270 C 120 271 98 262 110 251
    C 127 238 139 228 142 209 C 147 196 159 209 157 221
    C 158 239 175 247 209 251 C 228 262 214 285 166 288
    C 128 291 95 281 94 265 C 94 252 103 252 110 251
    C 89 244 77 251 77 267 C 72 283 68 298 67 313
    C 105 313 172 313 228 313 C 227 295 218 274 219 265
    C 231 273 235 307 237 327 C 223 337 93 338 67 329
    C 56 326 53 318 60 313 C 53 335 46 348 49 356
    C 102 359 187 359 241 356 C 252 365 166 375 94 371
    C 66 370 43 365 35 369 C 28 375 58 379 82 377
    C 147 371 233 371 255 383 C 267 390 245 402 224 414`,

  // Outer rosette → inner circle → star → ribbon, without coming back
  // from the ribbons to fill the medallion later.
  certifications: `M 126 0 C 126 16 106 23 89 22
    C 71 21 65 45 49 51 C 25 57 30 77 25 95
    C 11 110 18 123 28 137 C 37 152 30 176 44 187
    C 62 199 72 191 89 200 C 110 213 124 209 142 203
    C 161 198 179 212 193 198 C 209 184 199 166 210 148
    C 224 130 223 116 211 100 C 198 83 208 60 188 52
    C 167 45 165 24 145 22 C 128 20 116 32 116 48
    C 80 45 52 69 47 106 C 40 147 69 181 111 185
    C 153 190 188 163 189 122 C 190 84 158 51 123 50
    C 115 50 116 69 118 82 C 124 95 126 109 134 123
    C 151 122 158 122 165 125 C 157 133 146 141 137 146
    C 141 164 148 177 144 179 C 136 174 126 165 116 158
    C 101 168 92 178 87 177 C 91 161 95 150 97 143
    C 81 132 65 124 70 122 C 84 121 99 121 106 119
    C 112 104 114 88 118 82 C 119 71 115 51 116 48
    C 147 41 177 67 182 103 C 190 143 165 172 146 181
    C 139 186 132 188 120 190 C 85 194 64 189 46 189
    C 48 207 36 230 29 247 C 45 242 59 235 70 234
    C 79 251 86 265 90 279 C 103 257 113 236 121 217
    C 137 239 147 264 157 280 C 165 264 170 248 177 234
    C 189 237 200 244 213 247 C 204 226 195 205 189 197
    C 188 211 204 231 199 253 C 194 274 179 287 179 300`,

  // Cuff → every finger of the upper hand → book → every finger of the
  // lower hand → lower cuff. Pages are two unique edges, not repeated fills.
  hands: `M 205 0 C 203 12 194 25 190 35
    C 171 28 154 19 139 18 C 132 45 131 85 133 119
    C 134 153 133 184 144 203 C 148 212 152 222 158 221
    C 168 219 156 201 155 191 C 150 175 151 160 158 148
    C 156 139 153 131 146 127 C 156 127 161 141 163 151
    C 166 172 167 189 174 191 C 186 194 182 171 179 160
    C 181 181 191 203 200 204 C 213 204 192 181 188 172
    C 185 164 182 155 182 151 C 189 168 207 188 213 185
    C 223 181 205 165 200 153 C 191 130 195 111 189 91
    C 185 78 172 92 171 77 C 174 61 184 47 188 39
    C 194 47 177 76 170 81 C 177 74 186 82 189 91
    C 194 113 190 140 194 155 C 195 167 204 175 212 188
    C 230 213 219 237 214 251 C 208 264 198 274 195 281
    C 181 277 177 289 181 297 C 186 301 192 302 195 303
    C 181 300 166 304 152 311 C 143 315 136 322 132 338
    C 123 365 113 388 105 414 C 121 400 129 379 145 347
    C 158 330 178 324 195 319 C 166 338 154 347 148 365
    C 137 393 126 421 119 439 C 134 433 147 417 165 409
    C 163 396 161 378 167 377 C 174 375 171 391 178 397
    C 185 402 180 369 184 362 C 190 352 192 374 192 390
    C 200 369 196 342 202 338 C 210 333 209 368 208 383
    C 205 397 196 408 187 420 C 180 430 177 437 178 448
    C 179 461 183 478 181 490 C 172 492 158 489 148 487
    C 149 474 151 456 153 441 C 149 429 156 416 165 409`,
};

const sketches = Object.fromEntries(Object.entries(source).map(([id, d]) => [id, normalize(d)]));
const additional = JSON.parse(readFileSync(join(root, 'art/authored-gear-chart.json'), 'utf8'));
Object.assign(sketches, additional);
const ids = ['about', 'skills', 'experience', 'projects', 'achievements', 'certifications', 'hands'];
const header = `/** Ordered one-stroke artwork. Generated from the deliberately authored\n * curves in scripts/author-scroll-sketches.mjs; do not raster-trace these.\n * Each small loop is completed before proceeding to the next feature. */\nexport type SketchId = ${ids.map(id => `'${id}'`).join(' | ')};\nexport interface SketchDef {\n  vb: readonly [number, number];\n  d: string;\n  entry: readonly [number, number];\n  exit: readonly [number, number];\n  maskW: number;\n}\n\nexport const SKETCHES: Record<SketchId, SketchDef> = `;
writeFileSync(join(root, 'src/components/authoredSketches.ts'), header + JSON.stringify(sketches, null, 2) + ';\n');
writeFileSync(join(root, 'artifacts/authored-sketches.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 400" width="1680" height="400"><rect width="1680" height="400" fill="#0b0b0f"/>${ids.map((id,i)=>`<g transform="translate(${i*240+20},35)"><text x="0" y="-12" fill="#ddd" font-family="sans-serif" font-size="14">${id}</text><path d="${sketches[id].d}" fill="none" stroke="#a6b5f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`).join('')}</svg>`);
console.log('Authored seven one-pass sketches and preview.');
