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
      // The original chart has closely spaced, deliberately doubled contours.
      // Resolve centerlines finely enough to distinguish those from a recovery
      // over the very same route; the exact retrace fixture still must fail.
      const key = `${Math.round(x / 0.2)},${Math.round(y / 0.2)}`;
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

test('overlap check distinguishes adjacent original contours from a recovery walk', () => {
  const result=overlap('M 0 0 C 33 0 66 0 100 0 C 100 .08 100 .17 100 .25 C 66 .25 33 .25 0 .25');
  assert.ok(result.longest<1);
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

const connectorSource = readFileSync(new URL('../src/components/flowConnector.ts', import.meta.url), 'utf8');
const connectorJs = ts.transpile(connectorSource, { module: ts.ModuleKind.ESNext });
const { flowConnector } = await import('data:text/javascript;base64,' + Buffer.from(connectorJs).toString('base64'));
const vector = (a, b) => [b[0] - a[0], b[1] - a[1]];
const aligned = (a, b) => {
  const length = Math.hypot(...a) * Math.hypot(...b);
  return length > 1e-8 && Math.abs(a[0] * b[1] - a[1] * b[0]) / length < 0.0002
    && a[0] * b[0] + a[1] * b[1] > 0;
};

for (let variant = 0; variant < 6; variant++) {
  test(`connector ${variant}: smooth joins, exact anchors and safe margin at different sizes`, () => {
    for (const width of [130, 214]) for (const height of [180, 500, 1000]) {
      const bounds = { left: 100, right: 100 + width };
      const from = { point: { x: 100 + width * 0.37, y: 30 }, tangent: { x: -0.6, y: 0.8 } };
      const to = { point: { x: 100 + width * 0.58, y: height + 30 }, tangent: { x: -0.2, y: 0.98 } };
      const d = flowConnector(from, to, bounds, variant);
      const values = [...d.matchAll(/-?\d*\.?\d+/g)].map(match => Number(match[0]));
      const points = [];
      for (let i = 0; i < values.length; i += 2) points.push(values.slice(i, i + 2));
      assert.ok(Math.hypot(points[0][0] - from.point.x, points[0][1] - from.point.y) < 0.001);
      assert.ok(Math.hypot(points.at(-1)[0] - to.point.x, points.at(-1)[1] - to.point.y) < 0.001);
      for (const [x, y] of points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(x >= bounds.left - 0.001 && x <= bounds.right + 0.001, `control outside margin: ${x}`);
      }
      assert.ok(aligned(vector(points[0], points[1]), [from.tangent.x, from.tangent.y]), 'outgoing tangent changed');
      assert.ok(aligned(vector(points.at(-2), points.at(-1)), [to.tangent.x, to.tangent.y]), 'incoming tangent changed');
      for (let i = 3; i + 1 < points.length; i += 3) {
        assert.ok(aligned(vector(points[i - 1], points[i]), vector(points[i], points[i + 1])), `kink at cubic ${i / 3}`);
      }
      if (height > 380) {
        const sampled = flattenPath(d, 0.1)[0].map(p => p[0]);
        assert.ok(Math.max(...sampled) - Math.min(...sampled) > width * 0.5, 'connector flattened into a vertical line');
      }
    }
  });
}

const placementSource = readFileSync(new URL('../src/components/artworkPlacement.ts', import.meta.url), 'utf8');
const placementJs = ts.transpile(placementSource, { module: ts.ModuleKind.ESNext });
const { artworkPlacement } = await import('data:text/javascript;base64,' + Buffer.from(placementJs).toString('base64'));

test('larger artwork clears the content and screen edges at desktop widths', () => {
  for (const width of [1024, 1280, 1440, 1920]) for (const [id, art] of Object.entries(SKETCHES)) {
    const placement = artworkPlacement(art, width, 140, id === 'hands' ? 900 : undefined);
    const coordinates = [...art.d.matchAll(/-?\d*\.?\d+/g)].map(m => Number(m[0]));
    for (let i = 0; i < coordinates.length; i += 2) {
      const x = placement.x + coordinates[i] * placement.scale;
      assert.ok(x >= width - placement.gutter + 17.99 && x <= width - 17.99, `${id}: insufficient margin`);
    }
    if (width >= 1280 && id !== 'hands') {
      const inkWidth = (Math.max(...coordinates.filter((_, i) => i % 2 === 0)) - Math.min(...coordinates.filter((_, i) => i % 2 === 0))) * placement.scale;
      if (id === 'experience') {
        // The supplied chart is wide: fill the gutter while retaining its
        // original proportions instead of squeezing it into a tall icon.
        assert.ok(inkWidth > 240 && placement.bottom - placement.top > 160, 'original graph is undersized');
      } else assert.ok(placement.bottom - placement.top > 325, `${id}: still undersized`);
    }
  }
});

test('Contact finishes at the lower cuff and exactly at the changing form border', () => {
  const art = SKETCHES.hands;
  const values = [...art.d.matchAll(/-?\d*\.?\d+/g)].map(m => Number(m[0]));
  assert.equal(art.exit[1], Math.max(...values.filter((_, i) => i % 2 === 1)), 'terminal returned above the cuff');
  for (const width of [1024, 1280, 1440, 1920]) for (const bottom of [850, 1100, 1400]) {
    const placement = artworkPlacement(art, width, 140, bottom);
    assert.ok(Math.abs(placement.y + art.exit[1] * placement.scale - bottom) < 1e-8);
    assert.ok(Math.abs(placement.bottom - bottom) < 1e-8);
    assert.ok(placement.top >= 127.99);
  }
});

test('connecting gestures are distinct open strokes without recovery walks', () => {
  const variants = new Set();
  for (let variant = 0; variant < 6; variant++) for (const width of [130, 214]) {
    const d = flowConnector({ point: { x: 100 + width * 0.4, y: 0 }, tangent: { x: 0, y: 1 } },
      { point: { x: 100 + width * 0.6, y: 700 }, tangent: { x: 0, y: 1 } }, { left: 100, right: 100 + width }, variant);
    assert.ok(overlap(d).longest < 1, 'connector recovers over its old ink');
    const points=flattenPath(d,.1)[0];
    assert.ok(points.every((p,i)=>i===0||p[1]>=points[i-1][1]-.001), 'open flow doubles back vertically');
    if(width===214)variants.add(d);
  }
  assert.equal(variants.size,6);
});

test('a lower illustration entry is approached outside its untraced body', () => {
  const box={left:118,right:312,top:300,bottom:490,tailTop:395,lowerRight:277};
  const from={point:{x:205,y:0},tangent:{x:0,y:1}};
  const to={point:{x:277,y:485},tangent:{x:0,y:-1}};
  const d=flowConnector(from,to,{left:110,right:320},1,box);
  const points=flattenPath(d,.1)[0];
  assert.ok(points.every(([x,y])=>y<=box.top||y>=box.bottom||x>=box.right||(y>=box.tailTop&&x>=box.lowerRight)), 'connector crosses the chart before tracing begins');
  const coords=[...d.matchAll(/-?\d*\.?\d+/g)].map(m=>Number(m[0]));
  const controls=[];for(let i=0;i<coords.length;i+=2)controls.push(coords.slice(i,i+2));
  assert.ok(aligned(vector(controls[0],controls[1]),[0,1]));
  assert.ok(aligned(vector(controls.at(-2),controls.at(-1)),[0,-1]));
});
