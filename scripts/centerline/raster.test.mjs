import test from 'node:test';
import assert from 'node:assert/strict';
import { rasterize, chamfer } from './raster.mjs';
import { flattenPath } from './path.mjs';

const count = bmp => bmp.data.reduce((a, v) => a + v, 0);

const px = (bmp, x, y) => {
  const c = Math.floor(x - bmp.ox), r = Math.floor(y - bmp.oy);
  return bmp.data[r * bmp.w + c];
};

test('fills a rectangle', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 20 V 10 H 0 Z'));
  assert.equal(px(bmp, 10.5, 5.5), 1);
  assert.equal(px(bmp, -2.5, 5.5), 0);
  assert.ok(count(bmp) >= 18 * 8 && count(bmp) <= 22 * 12);
});

test('nonzero winding: same-direction inner loop stays filled, opposite makes a hole', () => {
  // outer CW + inner CCW (reversed) → donut
  const donut = rasterize(flattenPath('M 0 0 H 30 V 30 H 0 Z M 10 10 V 20 H 20 V 10 Z'));
  assert.equal(px(donut, 15, 15), 0);
  assert.equal(px(donut, 5, 15), 1);
  // outer CW + inner CW → solid (nonzero keeps it)
  const solid = rasterize(flattenPath('M 0 0 H 30 V 30 H 0 Z M 10 10 H 20 V 20 H 10 Z'));
  assert.equal(px(solid, 15, 15), 1);
});

test('crops clear ink outside the union', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 40 V 10 H 0 Z'), { crops: [[0, 0, 20, 10]] });
  assert.equal(px(bmp, 10, 5), 1);
  assert.equal(px(bmp, 30, 5), 0);
});

test('chamfer grows toward the middle of a band', () => {
  const bmp = rasterize(flattenPath('M 0 0 H 40 V 11 H 0 Z'));
  const dt = chamfer(bmp);
  const mid = dt[(Math.floor(5.5 - bmp.oy)) * bmp.w + Math.floor(20 - bmp.ox)];
  const edge = dt[(Math.floor(0.5 - bmp.oy)) * bmp.w + Math.floor(20 - bmp.ox)];
  assert.ok(mid / 3 >= 4 && mid / 3 <= 7, `mid ${mid / 3}`);
  assert.ok(edge / 3 <= 2, `edge ${edge / 3}`);
});
