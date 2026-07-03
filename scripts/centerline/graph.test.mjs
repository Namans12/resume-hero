import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, pruneSpurs, dropDust, smoothChains } from './graph.mjs';
import { thin } from './thin.mjs';
import { rasterize } from './raster.mjs';
import { flattenPath } from './path.mjs';

const degree = g => {
  const d = new Map();
  for (const e of g.edges) {
    d.set(e.a, (d.get(e.a) ?? 0) + 1);
    d.set(e.b, (d.get(e.b) ?? 0) + (e.a === e.b ? 1 : 1));
  }
  return d;
};

test('a plus-sign becomes 1 junction + 4 tips + 4 edges', () => {
  const g = buildGraph(thin(rasterize(flattenPath(
    'M 0 30 H 70 V 38 H 0 Z M 31 0 H 39 V 68 H 31 Z'))));
  assert.equal(g.edges.length, 4, `edges ${g.edges.length}`);
  const deg = degree(g);
  const degs = [...deg.values()].sort((a, b) => a - b);
  assert.deepEqual(degs, [1, 1, 1, 1, 4]);
  // chains carry world coords near the artwork, not raster-local
  const [x, y] = g.edges[0].pts[0];
  assert.ok(x > -10 && x < 80 && y > -10 && y < 80);
});

test('a closed ring becomes a single loop edge', () => {
  // ring: outer circle-ish square minus inner square (donut band)
  const g = buildGraph(thin(rasterize(flattenPath(
    'M 0 0 H 60 V 60 H 0 Z M 12 12 V 48 H 48 V 12 Z'))));
  assert.equal(g.edges.length, 1);
  assert.equal(g.edges[0].a, g.edges[0].b);
  assert.ok(g.edges[0].len > 120, `loop len ${g.edges[0].len}`);
});

test('pruneSpurs removes short tips and splices through', () => {
  // long bar with a tiny 4px nub sticking up from the middle
  const g0 = buildGraph(thin(rasterize(flattenPath(
    'M 0 20 H 80 V 27 H 0 Z M 38 16 H 43 V 20 H 38 Z'))));
  const g = pruneSpurs(g0, 8);
  assert.equal(g.edges.length, 1, `edges ${g.edges.map(e => e.len.toFixed(1))}`);
  assert.ok(g.edges[0].len > 60);
});

test('dropDust removes tiny components, smoothChains keeps endpoints', () => {
  const g0 = buildGraph(thin(rasterize(flattenPath(
    'M 0 0 H 80 V 7 H 0 Z M 10 30 H 14 V 33 H 10 Z'))));
  const g = dropDust(g0, 8);
  const total = g.edges.reduce((a, e) => a + e.len, 0);
  assert.ok(g.edges.every(e => e.len > 6));
  assert.ok(total > 60);
  const before = g.edges[0].pts.map(p => [...p]);
  smoothChains(g, 2);
  assert.deepEqual(g.edges[0].pts[0], before[0]);
  assert.deepEqual(g.edges[0].pts.at(-1), before.at(-1));
});
