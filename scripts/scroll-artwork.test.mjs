import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { flattenPath } from './centerline/path.mjs';

const source = readFileSync(new URL('../src/components/authoredSketches.ts', import.meta.url), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.ESNext });
const { SKETCHES } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

// A topology check rather than a snapshot of the generated string: sample
// the visible route and measure long walks through ink drawn much earlier.
// Crossings and nearby lip contours are allowed; a recovery walk is not.
function overlap(d) {
  const points = flattenPath(d, 0.1)[0];
  const seen = new Map();
  let distance = 0, repeated = 0, run = 0, longest = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.ceil(length / 0.25);
    for (let j = 1; j <= count; j++) {
      const x = a[0] + (b[0] - a[0]) * j / count;
      const y = a[1] + (b[1] - a[1]) * j / count;
      const key = `${Math.round(x / 0.7)},${Math.round(y / 0.7)}`;
      distance += length / count;
      if (seen.has(key) && distance - seen.get(key) > 10) {
        repeated += length / count;
        run += length / count;
        longest = Math.max(longest, run);
      } else run = 0;
      if (!seen.has(key)) seen.set(key, distance);
    }
  }
  return { ratio: repeated / distance, longest };
}

test('overlap check detects a recovery walk over an already drawn line', () => {
  const result = overlap('M 0 0 C 33 0 66 0 100 0 C 66 0 33 0 0 0');
  assert.ok(result.longest > 80);
  assert.ok(result.ratio > 0.4);
});

for (const [id, art] of Object.entries(SKETCHES)) {
  test(`${id}: continuous finite stroke, exact anchors, no long recovery walk`, () => {
    const commands = art.d.match(/[A-Za-z]/g);
    assert.equal(commands.filter(command => command === 'M').length, 1);
    assert.ok(commands.every(command => command === 'M' || command === 'C'));
    const polys = flattenPath(art.d, 0.1);
    assert.equal(polys.length, 1);
    const points = polys[0];
    assert.deepEqual(points[0], art.entry);
    assert.deepEqual(points.at(-1), art.exit);
    for (const [x, y] of points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= 0 && x <= art.vb[0] && y >= 0 && y <= art.vb[1]);
    }
    const result = overlap(art.d);
    assert.ok(result.ratio < 0.06, `${id}: ${(result.ratio * 100).toFixed(1)}% overlapping travel`);
    assert.ok(result.longest < 15, `${id}: ${result.longest.toFixed(1)} unit recovery walk`);
  });
}
