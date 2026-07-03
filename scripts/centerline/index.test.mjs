// scripts/centerline/index.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { traceArtwork } from './index.mjs';

// synthetic "artwork": two detached ink bars, like a diagram + its baseline
const D = 'M 100 100 H 400 V 112 H 100 Z M 100 200 H 400 V 212 H 100 Z';

test('traces a synthetic two-bar artwork end to end', () => {
  const r = traceArtwork({
    name: 'test-bars',
    d: D,
    entryHint: [100, 106],
    exitHint: [400, 206],
    toLocal: ([x, y]) => [(x - 100) / 5, (y - 100) / 5],
    localScale: 1 / 5,
  });
  assert.equal((r.d.match(/M /g) ?? []).length, 1);
  assert.ok(!/NaN/.test(r.d));
  assert.equal(r.stats.components, 2);
  assert.equal(r.stats.connectors, 1);
  // entry near local (0, 1.2), exit near local (60, 21.2)
  assert.ok(Math.hypot(r.entry[0] - 0, r.entry[1] - 1.2) < 3, `entry ${r.entry}`);
  assert.ok(Math.hypot(r.exit[0] - 60, r.exit[1] - 21.2) < 3, `exit ${r.exit}`);
  // ink is 12 units wide → maskW ≈ 12 × 1.35 × (1/5) ≈ 3.24 local units
  assert.ok(r.maskW > 2 && r.maskW < 5, `maskW ${r.maskW}`);
});

test('minDustLen raises the dust threshold for one artwork without a default change', () => {
  // a long bar plus a short one, both above the DEFAULT dust threshold
  const D2 = 'M 100 100 H 400 V 112 H 100 Z M 100 200 H 130 V 212 H 100 Z';
  const base = {
    name: 'test-dust', d: D2, entryHint: [100, 106], exitHint: [115, 206],
    toLocal: p => p, localScale: 1,
  };
  const noOverride = traceArtwork(base);
  assert.equal(noOverride.stats.components, 2);
  assert.equal(noOverride.stats.connectors, 1);

  const withOverride = traceArtwork({ ...base, minDustLen: 25 });
  assert.equal(withOverride.stats.components, 1);
  assert.equal(withOverride.stats.connectors, 0);
});

test('crops keep the trace inside the crop box', () => {
  const r = traceArtwork({
    name: 'test-crop',
    d: D,
    crops: [[100, 100, 150, 200]],
    entryHint: [100, 106],
    exitHint: [250, 206],
    toLocal: ([x, y]) => [(x - 100) / 5, (y - 100) / 5],
    localScale: 1 / 5,
  });
  const nums = r.d.match(/-?\d+\.?\d*/g).map(Number);
  for (let i = 0; i < nums.length; i += 2) {
    assert.ok(nums[i] <= 31, `x=${nums[i]} escaped crop (local max 30)`);
  }
});
