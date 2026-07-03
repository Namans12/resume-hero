// scripts/centerline/route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from './route.mjs';

const seg = (a, b, n = 5) => {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  return pts;
};
const edge = (a, b, pa, pb) => ({ a, b, pts: seg(pa, pb), len: Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) });

test('covers a Y-graph fully with retraces, entering/exiting at hinted tips', () => {
  // Y: center node 0 at (50,50); tips 1 (50,0), 2 (0,100), 3 (100,100)
  const g = {
    nodes: [{ id: 0, x: 50, y: 50 }, { id: 1, x: 50, y: 0 }, { id: 2, x: 0, y: 100 }, { id: 3, x: 100, y: 100 }],
    edges: [edge(0, 1, [50, 50], [50, 0]), edge(0, 2, [50, 50], [0, 100]), edge(0, 3, [50, 50], [100, 100])],
  };
  const r = route(g, [50, -5], [100, 105]);
  assert.equal(r.stats.unvisited, 0);
  assert.deepEqual(r.entry, [50, 0]);
  assert.deepEqual(r.exit, [100, 100]);
  assert.ok(r.stats.retraceLen > 0); // must double back through the center
  assert.equal(r.stats.connectors, 0);
});

test('two detached segments joined by one straight connector', () => {
  const g = {
    nodes: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 30, y: 0 }, { id: 2, x: 60, y: 5 }, { id: 3, x: 90, y: 5 }],
    edges: [edge(0, 1, [0, 0], [30, 0]), edge(2, 3, [60, 5], [90, 5])],
  };
  const r = route(g, [-5, 0], [95, 5]);
  assert.equal(r.stats.unvisited, 0);
  assert.equal(r.stats.components, 2);
  assert.equal(r.stats.connectors, 1);
  assert.ok(r.stats.connectorLen < 45, `connector ${r.stats.connectorLen}`); // 30,0 → 60,5 is ~30.4
  assert.deepEqual(r.exit, [90, 5]);
  // no NaNs, consecutive dedupe
  for (let i = 1; i < r.points.length; i++) {
    const [x, y] = r.points[i];
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.ok(x !== r.points[i - 1][0] || y !== r.points[i - 1][1]);
  }
});

test('loop edge (a === b) is traversed once', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const g = {
    nodes: [{ id: 0, x: 0, y: 0 }],
    edges: [{ a: 0, b: 0, pts: sq, len: 40 }],
  };
  const r = route(g, [0, 0], [0, 0]);
  assert.equal(r.stats.unvisited, 0);
  assert.ok(r.points.length >= 5);
});
