/* Zhang–Suen thinning: iteratively peel boundary pixels until only a 1px
   8-connected skeleton remains. */

export function thin({ data, w, h, ox, oy }) {
  const skel = Uint8Array.from(data);
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? skel[y * w + x] : 0);
  const kill = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      kill.length = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y),
          p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1),
          p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        let A = 0;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) A++;
        if (A !== 1) continue;
        if (pass === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
        else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
        kill.push(y * w + x);
      }
      if (kill.length) { changed = true; for (const k of kill) skel[k] = 0; }
    }
  }
  return { data: skel, w, h, ox, oy };
}
