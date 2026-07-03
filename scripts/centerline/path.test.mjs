import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenPath } from './path.mjs';

test('flattens M/L/H/V/Z into one closed polyline', () => {
  const polys = flattenPath('M 10 10 L 30 10 V 30 H 10 Z');
  assert.equal(polys.length, 1);
  const p = polys[0];
  assert.deepEqual(p[0], [10, 10]);
  assert.deepEqual(p[1], [30, 10]);
  assert.deepEqual(p[2], [30, 30]);
  assert.deepEqual(p[3], [10, 30]);
  assert.deepEqual(p[p.length - 1], [10, 10]); // Z closes back
});

test('relative commands and implicit repeats', () => {
  const polys = flattenPath('m 5 5 l 10 0 10 0 m 0 10 l 0 5');
  assert.equal(polys.length, 2);
  assert.deepEqual(polys[0], [[5, 5], [15, 5], [25, 5]]);
  assert.deepEqual(polys[1], [[25, 15], [25, 20]]);
});

test('cubic and smooth-cubic land on exact endpoints', () => {
  const polys = flattenPath('M 0 0 C 0 10 10 10 10 0 s 10 -10 10 0');
  const p = polys[0];
  assert.deepEqual(p[0], [0, 0]);
  // curve endpoints appear exactly
  assert.ok(p.some(([x, y]) => x === 10 && y === 0));
  const [ex, ey] = p[p.length - 1];
  assert.ok(Math.abs(ex - 20) < 1e-9 && Math.abs(ey - 0) < 1e-9);
  assert.ok(p.length > 10); // actually flattened, not just endpoints
});

test('quadratic q/t supported', () => {
  const p = flattenPath('M 0 0 q 5 10 10 0 t 10 0')[0];
  const [ex, ey] = p[p.length - 1];
  assert.ok(Math.abs(ex - 20) < 1e-9 && Math.abs(ey) < 1e-9);
});

test('rejects arcs', () => {
  assert.throws(() => flattenPath('M 0 0 A 5 5 0 0 1 10 0'), /arc/i);
});
