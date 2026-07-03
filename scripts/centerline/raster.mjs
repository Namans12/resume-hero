/* Nonzero-winding scanline rasterizer for the artworks' ink fills, plus a
   3-4 chamfer distance transform used for ink-width stats. */

export function rasterize(polys, { crops = null, pad = 3 } = {}) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) throw new Error('empty path');
  const ox = Math.floor(minX) - pad, oy = Math.floor(minY) - pad;
  const w = Math.ceil(maxX) - ox + pad, h = Math.ceil(maxY) - oy + pad;
  if (w * h > 40e6) throw new Error(`raster too large: ${w}x${h}`);
  const data = new Uint8Array(w * h);

  // flat segment list (implicit closure per subpath), horizontal segs skipped
  const segs = [];
  for (const p of polys) {
    for (let k = 0; k < p.length; k++) {
      const a = p[k], b = p[(k + 1) % p.length];
      if (a[1] !== b[1]) segs.push(a[0], a[1], b[0], b[1]);
    }
  }

  const xs = [];
  for (let r = 0; r < h; r++) {
    const yc = oy + r + 0.5;
    xs.length = 0;
    for (let s = 0; s < segs.length; s += 4) {
      const ax = segs[s], ay = segs[s + 1], bx = segs[s + 2], by = segs[s + 3];
      let dir;
      if (ay <= yc && by > yc) dir = 1;
      else if (by <= yc && ay > yc) dir = -1;
      else continue;
      xs.push([ax + ((yc - ay) * (bx - ax)) / (by - ay), dir]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0, spanStart = 0;
    for (const [x, dir] of xs) {
      const prev = wind;
      wind += dir;
      if (prev === 0 && wind !== 0) spanStart = x;
      else if (prev !== 0 && wind === 0) {
        const c0 = Math.max(0, Math.ceil(spanStart - ox - 0.5));
        const c1 = Math.min(w - 1, Math.floor(x - ox - 0.5));
        for (let c = c0; c <= c1; c++) data[r * w + c] = 1;
      }
    }
  }

  if (crops) {
    for (let r = 0; r < h; r++) {
      const yc = oy + r + 0.5;
      for (let c = 0; c < w; c++) {
        if (!data[r * w + c]) continue;
        const xc = ox + c + 0.5;
        let inside = false;
        for (const [rx, ry, rw, rh] of crops) {
          if (xc >= rx && xc <= rx + rw && yc >= ry && yc <= ry + rh) { inside = true; break; }
        }
        if (!inside) data[r * w + c] = 0;
      }
    }
  }
  return { data, w, h, ox, oy };
}

export function chamfer({ data, w, h }) {
  const INF = 1e9;
  const dt = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) dt[i] = data[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dt[i]) continue;
    let v = dt[i];
    if (x > 0) v = Math.min(v, dt[i - 1] + 3);
    if (y > 0) {
      v = Math.min(v, dt[i - w] + 3);
      if (x > 0) v = Math.min(v, dt[i - w - 1] + 4);
      if (x < w - 1) v = Math.min(v, dt[i - w + 1] + 4);
    }
    dt[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!dt[i]) continue;
    let v = dt[i];
    if (x < w - 1) v = Math.min(v, dt[i + 1] + 3);
    if (y < h - 1) {
      v = Math.min(v, dt[i + w] + 3);
      if (x < w - 1) v = Math.min(v, dt[i + w + 1] + 4);
      if (x > 0) v = Math.min(v, dt[i + w - 1] + 4);
    }
    dt[i] = v;
  }
  // border cells may still be INF if ink touches the edge; pad in rasterize
  // prevents that, but clamp defensively
  for (let i = 0; i < w * h; i++) if (dt[i] >= INF) dt[i] = 3;
  return dt;
}
