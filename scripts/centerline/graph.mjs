/* Skeleton bitmap → node/edge graph with pixel chains, plus cleanup passes.
   All output coords are world coords: pixel (x, y) → (ox + x + 0.5, oy + y + 0.5). */

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

const chainLen = pts => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

export function buildGraph({ data, w, h, ox = 0, oy = 0 }) {
  const idx = (x, y) => y * w + x;
  const on = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && data[idx(x, y)] ? 1 : 0);
  const deg = (x, y) => { let n = 0; for (const [dx, dy] of DIRS) n += on(x + dx, y + dy); return n; };
  const world = (x, y) => [ox + x + 0.5, oy + y + 0.5];

  // 1. cluster adjacent non-degree-2 pixels into nodes
  const nodeId = new Int32Array(w * h).fill(-1);
  const nodes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || deg(x, y) === 2 || nodeId[idx(x, y)] !== -1) continue;
    const id = nodes.length;
    const stack = [[x, y]];
    nodeId[idx(x, y)] = id;
    let sx = 0, sy = 0, n = 0;
    const pix = [];
    while (stack.length) {
      const [px, py] = stack.pop();
      pix.push([px, py]); sx += px; sy += py; n++;
      for (const [dx, dy] of DIRS) {
        const nx = px + dx, ny = py + dy;
        if (on(nx, ny) && deg(nx, ny) !== 2 && nodeId[idx(nx, ny)] === -1) {
          nodeId[idx(nx, ny)] = id;
          stack.push([nx, ny]);
        }
      }
    }
    const [wx, wy] = world(sx / n, sy / n);
    nodes.push({ id, x: wx, y: wy, pix });
  }

  // 1b. absorb "bridge" pixels: a degree-2 pixel whose neighbors are two
  // (already-clustered) pixels of the SAME node forms a tiny corner digon,
  // a Zhang-Suen thinning artifact rather than a real chain segment. Fold
  // it into that node so it doesn't get walked as a spurious self-loop edge.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || deg(x, y) !== 2 || nodeId[idx(x, y)] !== -1) continue;
    let owner = -1, count = 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!on(nx, ny)) continue;
      const nid = nodeId[idx(nx, ny)];
      if (nid === -1) { owner = -2; break; } // has a non-node neighbor — real chain pixel
      if (owner === -1) owner = nid;
      else if (owner !== nid) { owner = -2; break; } // bridges two different nodes — real chain
      count++;
    }
    if (owner >= 0 && count === 2) {
      nodeId[idx(x, y)] = owner;
      const node = nodes[owner];
      node.pix.push([x, y]);
      const n = node.pix.length;
      const sx = node.pix.reduce((a, [px]) => a + px, 0);
      const sy = node.pix.reduce((a, [, py]) => a + py, 0);
      [node.x, node.y] = world(sx / n, sy / n);
    }
  }

  // 2. walk chains from node pixels through degree-2 pixels
  const chainUsed = new Uint8Array(w * h);
  const edges = [];
  const nodeEdgeKeys = new Set(); // dedupe direct node↔node adjacencies
  const walk = (fromNode, npx, npy, fx, fy) => {
    const pts = [world(npx, npy)];
    let px = fx, py = fy, prevx = npx, prevy = npy;
    for (;;) {
      pts.push(world(px, py));
      const nid = nodeId[idx(px, py)];
      if (nid !== -1) {
        // snap chain ends onto node centroids
        pts[0] = [nodes[fromNode].x, nodes[fromNode].y];
        pts[pts.length - 1] = [nodes[nid].x, nodes[nid].y];
        return { a: fromNode, b: nid, pts, len: chainLen(pts) };
      }
      chainUsed[idx(px, py)] = 1;
      let nx = -1, ny = -1;
      for (const [dx, dy] of DIRS) {
        const qx = px + dx, qy = py + dy;
        if (!on(qx, qy) || (qx === prevx && qy === prevy)) continue;
        if (nodeId[idx(qx, qy)] !== -1) { nx = qx; ny = qy; break; }
        if (!chainUsed[idx(qx, qy)] && nx === -1) { nx = qx; ny = qy; }
      }
      if (nx === -1) { // dead end (thinning artifact) — treat as a tip
        const tid = nodes.length;
        nodes.push({ id: tid, x: pts.at(-1)[0], y: pts.at(-1)[1], pix: [[px, py]] });
        pts[0] = [nodes[fromNode].x, nodes[fromNode].y];
        return { a: fromNode, b: tid, pts, len: chainLen(pts) };
      }
      prevx = px; prevy = py; px = nx; py = ny;
    }
  };

  for (const node of nodes.slice()) {
    for (const [npx, npy] of node.pix) {
      for (const [dx, dy] of DIRS) {
        const qx = npx + dx, qy = npy + dy;
        if (!on(qx, qy)) continue;
        const qNode = nodeId[idx(qx, qy)];
        if (qNode === node.id) continue; // same cluster
        if (qNode !== -1) { // direct node↔node contact
          const key = `${Math.min(node.id, qNode)}:${Math.max(node.id, qNode)}:${qx}:${qy}`;
          if (node.id < qNode && !nodeEdgeKeys.has(key)) {
            nodeEdgeKeys.add(key);
            const pts = [[nodes[node.id].x, nodes[node.id].y], [nodes[qNode].x, nodes[qNode].y]];
            edges.push({ a: node.id, b: qNode, pts, len: chainLen(pts) });
          }
          continue;
        }
        if (chainUsed[idx(qx, qy)]) continue;
        edges.push(walk(node.id, npx, npy, qx, qy));
      }
    }
  }

  // 3. pure cycles (no junction/tip anywhere on the loop)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || deg(x, y) !== 2 || chainUsed[idx(x, y)] || nodeId[idx(x, y)] !== -1) continue;
    const id = nodes.length;
    const [wx, wy] = world(x, y);
    nodes.push({ id, x: wx, y: wy, pix: [[x, y]] });
    nodeId[idx(x, y)] = id;
    let first = null;
    for (const [dx, dy] of DIRS) if (on(x + dx, y + dy)) { first = [x + dx, y + dy]; break; }
    if (first) edges.push(walk(id, x, y, first[0], first[1]));
  }

  const g = { nodes: nodes.map(({ id, x, y }) => ({ id, x, y })), edges };
  // 4. Zhang-Suen corner turns can leave a pixel blob with only 2 chains
  // exiting it (a "fat corner", not a true branch/tip). Such a blob has
  // graph-degree 2 once edges exist; splice it away so degree-2 pixel
  // clusters collapse into their surrounding chain instead of surfacing
  // as spurious nodes (this is what makes a plain rectangular ring reduce
  // to a single cyclic edge instead of one node per corner).
  spliceDegree2(g);
  return g;
}

const degreesOf = g => {
  const d = new Map(g.nodes.map(n => [n.id, 0]));
  for (const e of g.edges) {
    d.set(e.a, d.get(e.a) + 1);
    d.set(e.b, d.get(e.b) + 1); // loops count twice, correctly
  }
  return d;
};

// Merge every node with graph-degree exactly 2 (and not a self-loop) into
// its two incident edges, producing one continuous edge through it. Used
// both to normalize buildGraph's raw output and inside pruneSpurs after
// spur removal changes degrees.
function spliceDegree2(g) {
  let changed = true;
  while (changed) {
    changed = false;
    const deg2 = degreesOf(g);
    for (const node of g.nodes) {
      if (deg2.get(node.id) !== 2) continue;
      const inc = g.edges.filter(e => e.a === node.id || e.b === node.id);
      if (inc.length !== 2 || inc[0] === inc[1]) continue; // loop at node — leave
      const [e1, e2] = inc;
      const p1 = e1.a === node.id ? [...e1.pts].reverse() : e1.pts; // ends at node
      const p2 = e2.a === node.id ? e2.pts : [...e2.pts].reverse(); // starts at node
      const merged = {
        a: e1.a === node.id ? e1.b : e1.a,
        b: e2.a === node.id ? e2.b : e2.a,
        pts: [...p1, ...p2.slice(1)],
        len: e1.len + e2.len,
      };
      g.edges = g.edges.filter(e => e !== e1 && e !== e2);
      g.edges.push(merged);
      changed = true;
      break; // degrees changed — restart scan
    }
  }
  // drop now-isolated nodes
  const used = new Set(g.edges.flatMap(e => [e.a, e.b]));
  g.nodes = g.nodes.filter(n => used.has(n.id));
  return g;
}

export function pruneSpurs(g, minLen) {
  let changed = true;
  while (changed) {
    changed = false;
    const deg = degreesOf(g);
    // remove short tip edges hanging off junctions
    const keep = [];
    for (const e of g.edges) {
      const tipA = deg.get(e.a) === 1, tipB = deg.get(e.b) === 1;
      const spur = e.len < minLen && e.a !== e.b &&
        ((tipA && deg.get(e.b) >= 3) || (tipB && deg.get(e.a) >= 3));
      if (spur) changed = true; else keep.push(e);
    }
    g.edges = keep;
    // splice through degree-2 nodes (not loop endpoints)
    spliceDegree2(g);
  }
  // drop now-isolated nodes
  const used = new Set(g.edges.flatMap(e => [e.a, e.b]));
  g.nodes = g.nodes.filter(n => used.has(n.id));
  return g;
}

export function dropDust(g, minTotalLen) {
  // union-find over nodes
  const parent = new Map(g.nodes.map(n => [n.id, n.id]));
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const e of g.edges) parent.set(find(e.a), find(e.b));
  const compLen = new Map();
  for (const e of g.edges) {
    const r = find(e.a);
    compLen.set(r, (compLen.get(r) ?? 0) + e.len);
  }
  g.edges = g.edges.filter(e => compLen.get(find(e.a)) >= minTotalLen);
  const used = new Set(g.edges.flatMap(e => [e.a, e.b]));
  g.nodes = g.nodes.filter(n => used.has(n.id));
  return g;
}

export function smoothChains(g, passes = 2) {
  for (const e of g.edges) {
    for (let p = 0; p < passes; p++) {
      const pts = e.pts;
      for (let i = 1; i < pts.length - 1; i++) {
        pts[i] = [
          0.25 * pts[i - 1][0] + 0.5 * pts[i][0] + 0.25 * pts[i + 1][0],
          0.25 * pts[i - 1][1] + 0.5 * pts[i][1] + 0.25 * pts[i + 1][1],
        ];
      }
    }
    e.len = chainLen(e.pts);
  }
  return g;
}
