import test from 'node:test';
import assert from 'node:assert/strict';
import { thin } from './thin.mjs';
import { rasterize } from './raster.mjs';
import { flattenPath } from './path.mjs';

const stats = ({ data, w, h }) => {
  let n = 0, maxRow = 0;
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) if (data[y * w + x]) { n++; row++; }
    if (row > maxRow) maxRow = row;
  }
  return { n, maxRow };
};

const components = ({ data, w, h }) => {
  const seen = new Uint8Array(w * h);
  let comps = 0;
  for (let i = 0; i < w * h; i++) {
    if (!data[i] || seen[i]) continue;
    comps++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (data[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
  }
  return comps;
};

test('a thick horizontal band thins to a ~1px line of ~full length', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 60 V 9 H 0 Z'));
  const sk = thin(bmp);
  const { n } = stats(sk);
  assert.ok(n >= 45 && n <= 75, `skeleton px ${n}`);
  // every column in the middle carries at most 2 skeleton px
  for (let x = 10; x < 50; x++) {
    let col = 0;
    for (let y = 0; y < sk.h; y++) col += sk.data[y * sk.w + Math.floor(x - sk.ox)];
    assert.ok(col >= 1 && col <= 2, `col ${x}: ${col}`);
  }
});

test('thinning preserves connectivity of a cross', () => {
  const bmp = rasterize(flattenPath('M 0 20 H 50 V 28 H 0 Z M 21 0 H 29 V 48 H 21 Z'));
  assert.equal(components(bmp), 1);
  const sk = thin(bmp);
  assert.equal(components(sk), 1);
});
