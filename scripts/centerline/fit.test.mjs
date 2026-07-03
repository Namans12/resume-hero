// scripts/centerline/fit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCurve, splitAtCorners, toPathD } from './fit.mjs';

const fmt = v => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

const bezAt = (b, t) => {
  const r = 1 - t;
  return [
    r * r * r * b[0][0] + 3 * r * r * t * b[1][0] + 3 * r * t * t * b[2][0] + t * t * t * b[3][0],
    r * r * r * b[0][1] + 3 * r * r * t * b[1][1] + 3 * r * t * t * b[2][1] + t * t * t * b[3][1],
  ];
};

test('fits a half-circle within tolerance, few segments', () => {
  const pts = [];
  for (let a = 0; a <= 64; a++) pts.push([50 * Math.cos(Math.PI * a / 64), 50 * Math.sin(Math.PI * a / 64)]);
  const bez = fitCurve(pts, 0.5);
  assert.ok(bez.length <= 6, `segments ${bez.length}`);
  // every fitted point stays near radius 50
  for (const b of bez) for (let t = 0; t <= 1; t += 0.1) {
    const [x, y] = bezAt(b, t);
    assert.ok(Math.abs(Math.hypot(x, y) - 50) < 1.2);
  }
  // endpoints exact
  assert.deepEqual(bez[0][0], [50, 0]);
  const last = bez[bez.length - 1][3];
  assert.ok(Math.abs(last[0] + 50) < 1e-6 && Math.abs(last[1]) < 1e-6);
});

test('splitAtCorners cuts an L-shape at the corner, ignores jitter', () => {
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push([i * 5, (i % 2) * 0.3]); // jittery horizontal
  for (let i = 1; i <= 20; i++) pts.push([100, i * 5]);           // vertical
  const pieces = splitAtCorners(pts, 75);
  assert.equal(pieces.length, 2);
  assert.ok(Math.abs(pieces[0].at(-1)[0] - 100) < 6);
  assert.deepEqual(pieces[1][0], pieces[0].at(-1)); // pieces share the corner point
});

test('toPathD emits a single subpath', () => {
  const pts = [[0, 0], [10, 0], [20, 0], [20, 10], [20, 20]];
  const pieces = splitAtCorners(pts, 75).map(p => fitCurve(p, 0.5));
  const d = toPathD(pieces, fmt);
  assert.match(d, /^M /);
  assert.equal((d.match(/M /g) ?? []).length, 1);
  assert.ok(!/NaN/.test(d));
});
