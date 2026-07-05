/* One-stroke full-coverage routing over the skeleton graph.
   Inside a component: greedy edge traversal; when stuck, retrace over
   already-drawn edges (Dijkstra, weight = chain length) to the nearest node
   with unvisited edges — retraces are invisible (the ink is already drawn).
   Between components: a straight shortest connector (user choice 2026-07-03).
   Ends by retracing/connecting to the node nearest exitHint. */

export function route(g, entryHint, exitHint) {
  const { nodes, edges } = g;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map(nodes.map(n => [n.id, []]));
  edges.forEach((e, ei) => {
    adj.get(e.a).push(ei);
    if (e.b !== e.a) adj.get(e.b).push(ei);
  });
  const other = (e, from) => (e.a === from ? e.b : e.a);
  const dist = (n, p) => Math.hypot(n.x - p[0], n.y - p[1]);
  const degree = id => adj.get(id).length;

  // components (over node ids)
  const compOf = new Map();
  let nComps = 0;
  for (const n of nodes) {
    if (compOf.has(n.id)) continue;
    const c = nComps++;
    const stack = [n.id];
    compOf.set(n.id, c);
    while (stack.length) {
      const id = stack.pop();
      for (const ei of adj.get(id)) {
        const o = other(edges[ei], id);
        if (!compOf.has(o)) { compOf.set(o, c); stack.push(o); }
      }
    }
  }

  const pickNode = (hint, ids) => {
    let best = null, bestD = Infinity, bestTip = null, bestTipD = Infinity;
    for (const id of ids) {
      const d = dist(byId.get(id), hint);
      if (d < bestD) { bestD = d; best = id; }
      if (degree(id) === 1 && d < bestTipD) { bestTipD = d; bestTip = id; }
    }
    return bestTip !== null && bestTipD <= Math.max(40, bestD + 40) ? bestTip : best;
  };

  // orphan nodes (spur pruning leaves them edge-less) are invisible to the
  // walk — never route to them and never count their "components"
  const allIds = nodes.filter(n => adj.get(n.id).length > 0).map(n => n.id);
  const entryNode = pickNode(entryHint, allIds);
  const exitNode = pickNode(exitHint, allIds);
  const entryComp = compOf.get(entryNode);
  const exitComp = compOf.get(exitNode);

  // dijkstra over ALL edges (drawn or not) within the graph
  const shortest = (from, targets) => {
    const T = targets instanceof Set ? targets : new Set(targets);
    const distTo = new Map([[from, 0]]);
    const prev = new Map(); // id -> [prevId, ei]
    const Q = [[0, from]];
    while (Q.length) {
      Q.sort((a, b) => a[0] - b[0]);
      const [d, id] = Q.shift();
      if (d > (distTo.get(id) ?? Infinity)) continue;
      if (T.has(id)) {
        const path = [];
        let cur = id;
        while (cur !== from) { const [p, ei] = prev.get(cur); path.unshift([ei, p]); cur = p; }
        return { node: id, path }; // path: [edgeIdx, fromNode][]
      }
      for (const ei of adj.get(id)) {
        const e = edges[ei], o = other(e, id);
        const nd = d + e.len;
        if (nd < (distTo.get(o) ?? Infinity)) { distTo.set(o, nd); prev.set(o, [id, ei]); Q.push([nd, o]); }
      }
    }
    return null;
  };

  const points = [];
  const compsWithEdges = new Set(edges.map(e => compOf.get(e.a)));
  const stats = { components: compsWithEdges.size, connectors: 0, connectorLen: 0, retraceLen: 0, edgeLen: 0, unvisited: 0 };
  const push = p => {
    const last = points[points.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push([p[0], p[1]]);
  };
  const pushChain = (e, fromId) => {
    const pts = e.a === fromId ? e.pts : [...e.pts].reverse();
    for (const p of pts) push(p);
  };

  const visited = new Set();
  const compUnvisited = comp => allIds.some(id => compOf.get(id) === comp &&
    adj.get(id).some(ei => !visited.has(ei)));

  /* Straightest-continuation edge choice (user 2026-07-05): the artworks are
     single-stroke drawings, so at a crossing the artist's line goes STRAIGHT
     THROUGH - turning onto the crossing branch dead-ends the walk and forces
     retraces. Score each candidate by how well its outgoing direction
     continues the pen's arrival direction and take the best. */
  const dirOver = pts => { // unit direction over the first ~4px of a point run
    const [x0, y0] = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - x0, dy = pts[i][1] - y0;
      const L = Math.hypot(dx, dy);
      if (L >= 4 || i === pts.length - 1) return L ? [dx / L, dy / L] : null;
    }
    return null;
  };
  /* Pre-paired pass-throughs: at every junction, pair up incident edges by
     MOST-OPPOSITE outgoing directions (lowest dot first, only genuine
     continuations). Arriving on one edge of a pair, the pen leaves on the
     other - it rides the artist's stroke straight through the crossing
     instead of turning onto the crossing branch, which is what used to
     dead-end the walk and force long retraces. */
  const edgeDirAt = (ei, nodeId) => {
    const e = edges[ei];
    const pts = e.a === nodeId ? e.pts : [...e.pts].reverse();
    return dirOver(pts);
  };
  const pairAt = new Map(); // nodeId -> Map(arrivedEi -> leaveEi)
  for (const n of nodes) {
    const inc = adj.get(n.id).filter(ei => edges[ei].a !== edges[ei].b);
    if (inc.length < 3) continue;
    const dirs = inc.map(ei => edgeDirAt(ei, n.id));
    const cands = [];
    for (let i = 0; i < inc.length; i++) for (let j = i + 1; j < inc.length; j++) {
      if (!dirs[i] || !dirs[j]) continue;
      cands.push([dirs[i][0] * dirs[j][0] + dirs[i][1] * dirs[j][1], i, j]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    const used = new Set();
    const m = new Map();
    for (const [dot, i, j] of cands) {
      if (used.has(i) || used.has(j)) continue;
      if (dot > -0.25) break; // < ~104° between arms: a corner, not a pass-through
      used.add(i); used.add(j);
      m.set(inc[i], inc[j]);
      m.set(inc[j], inc[i]);
    }
    if (m.size) pairAt.set(n.id, m);
  }

  // straightest remaining branch: most opposite to the arrival edge's
  // back-direction at this node
  const pickBy = (cur, arriveEi, cand) => {
    if (cand.length === 1 || arriveEi === null) return cand[0];
    const back = edgeDirAt(arriveEi, cur);
    if (!back) return cand[0];
    let best = cand[0], bestDot = 2;
    for (const ei of cand) {
      const od = edgeDirAt(ei, cur);
      const dot = od ? back[0] * od[0] + back[1] * od[1] : 1;
      if (dot < bestDot) { bestDot = dot; best = ei; }
    }
    return best;
  };

  /* Cover one component, Hierholzer-style (user 2026-07-06: a side loop must
     be drawn the FIRST time the pen passes its junction, not left behind and
     back-filled later). A greedy walk (paired continuation first, straightest
     otherwise) runs until it dead-ends; any edges it left behind are walked
     as sub-loops and SPLICED into the sequence at the first pass of their
     junction. A sub-walk that dead-ends away from its junction glides back
     over already-drawn ink (invisible) so the main stroke continues
     seamlessly. */
  const cover = (comp, startId, arriveEi = null) => {
    push([byId.get(startId).x, byId.get(startId).y]);
    const walk = (cur, aEi, out) => {
      for (;;) {
        const cand = adj.get(cur).filter(ei2 => !visited.has(ei2));
        if (!cand.length) return cur;
        const paired = aEi !== null ? pairAt.get(cur)?.get(aEi) : undefined;
        const ei = paired !== undefined && !visited.has(paired) ? paired : pickBy(cur, aEi, cand);
        visited.add(ei);
        out.push({ ei, from: cur });
        cur = other(edges[ei], cur);
        aEi = ei;
      }
    };
    const recs = [];
    walk(startId, arriveEi, recs);
    const hasUnv = id => adj.get(id).some(ei2 => !visited.has(ei2));
    let guard = edges.length * 4;
    while (compUnvisited(comp) && guard-- > 0) {
      // earliest point on the sequence whose node still has unvisited edges
      let idx = -1, node = -1, aEiAt = arriveEi;
      if (hasUnv(startId)) { idx = 0; node = startId; }
      else {
        for (let i = 0; i < recs.length; i++) {
          const arr = other(edges[recs[i].ei], recs[i].from);
          if (hasUnv(arr)) { idx = i + 1; node = arr; aEiAt = recs[i].ei; break; }
        }
      }
      if (idx < 0) break; // detached within the comp — cannot happen when connected
      const sub = [];
      const subEnd = walk(node, aEiAt, sub);
      if (subEnd !== node && idx < recs.length) {
        // bridge back to the junction over drawn ink so the spliced-in loop
        // hands the pen back where the main stroke continues
        const r = shortest(subEnd, new Set([node]));
        if (r) for (const [ei2, fromId] of r.path) sub.push({ ei: ei2, from: fromId, retrace: true });
      }
      recs.splice(idx, 0, ...sub);
    }
    for (const rec of recs) {
      stats[rec.retrace ? 'retraceLen' : 'edgeLen'] += edges[rec.ei].len;
      pushChain(edges[rec.ei], rec.from);
    }
    return recs.length ? other(edges[recs[recs.length - 1].ei], recs[recs.length - 1].from) : startId;
  };

  // component order: entry comp first, then nearest-first (the pen finishes
  // by riding drawn ink back to the exit component's exit node, so the exit
  // comp needs no special ordering — forcing it last used to strand nested
  // parts on 400px+ hops between themselves)
  const order = [entryComp];
  const middles = new Set();
  for (const c of compsWithEdges) if (c !== entryComp) middles.add(c);

  let cur = cover(entryComp, entryNode);
  /* Closest CHAIN-POINT pair between the pen's current component and a
     target component (user 2026-07-06: no long straight jumps — the pen
     glides over already-drawn ink to the point where the two parts nearly
     touch, and the visible connector is that short hop). Nodes alone won't
     do: a smooth ring is one self-loop with a single node, so its true
     closest approach is mid-chain. */
  const STRIDE = 3;
  const chainPts = comp => {
    const out = [];
    edges.forEach((e, ei) => {
      if (compOf.get(e.a) !== comp) return;
      for (let i = 0; i < e.pts.length; i += STRIDE) out.push({ pt: e.pts[i], ei, i });
    });
    return out;
  };
  const covered = new Set([entryComp]);
  // closest approach from ANY covered component (the pen rides drawn
  // connectors back to whichever part sits nearest the target)
  const nearestPair = targetComp => {
    const B = chainPts(targetComp);
    let best = null;
    for (const comp of covered) {
      for (const a of chainPts(comp)) for (const b of B) {
        const d = Math.hypot(a.pt[0] - b.pt[0], a.pt[1] - b.pt[1]);
        if (!best || d < best.d) best = { u: a, v: b, d };
      }
    }
    return best;
  };
  // nearer end node of the point's chain, by index
  const endOf = p => (p.i < edges[p.ei].pts.length / 2 ? edges[p.ei].a : edges[p.ei].b);
  const pushPartial = (p, toPoint) => {
    // chain slice between the point and its nearer end node, oriented
    // toward the point (toPoint) or away from it (!toPoint)
    const e = edges[p.ei];
    const half = endOf(p) === e.a ? e.pts.slice(0, p.i + 1) : e.pts.slice(p.i);
    const startsAtNode = endOf(p) === e.a;
    const seq = startsAtNode === toPoint ? half : [...half].reverse();
    let L = 0;
    for (let i = 1; i < seq.length; i++) L += Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1]);
    stats.retraceLen += L;
    for (const q of seq) push(q);
  };
  const glideToPoint = p => {
    // over drawn ink: node-to-node Dijkstra, then a partial chain ride out
    // to the hop point — all invisible (the ink is already there)
    const end = endOf(p);
    if (cur !== end) {
      const r = shortest(cur, new Set([end]));
      if (r) for (const [ei2, fromId] of r.path) {
        stats.retraceLen += edges[ei2].len;
        pushChain(edges[ei2], fromId);
      }
    }
    pushPartial(p, true);
  };
  const enterFromPoint = p => {
    // land mid-chain, ride the chain to its nearer node (real ink of the new
    // part, drawn a beat early — the walk re-covers it invisibly), walk on
    pushPartial(p, false);
    return endOf(p);
  };
  const portals = []; // traversed connector hops, for the invisible ride back
  const connect = (pair, targetComp) => {
    // the hop may launch from a component other than the pen's — ride the
    // drawn connectors back to it first (all over existing ink)
    const fromComp = compOf.get(edges[pair.u.ei].a);
    if (compOf.get(cur) !== fromComp) returnToComp(fromComp);
    stats.connectors++;
    stats.connectorLen += pair.d;
    portals.push({ fromComp, toComp: targetComp, u: pair.u, v: pair.v });
    glideToPoint(pair.u);
    push([pair.v.pt[0], pair.v.pt[1]]);
    cur = enterFromPoint(pair.v);
  };
  /* After the last component is covered the pen may sit far from the exit
     component (rocket: it ends inside the window rings and used to jump
     STRAIGHT to the flame tail — the stray line the user flagged
     2026-07-06). Ride the already-drawn connectors BACK instead: glide to
     the hop point, re-cross the same short hop, glide on — all over
     existing ink, nothing new appears. */
  const returnToComp = target => {
    let guard = portals.length + 1;
    while (compOf.get(cur) !== target && guard-- > 0) {
      let k = -1;
      for (let i = portals.length - 1; i >= 0; i--) {
        if (portals[i].toComp === compOf.get(cur)) { k = i; break; }
      }
      if (k < 0) return;
      const p = portals[k];
      glideToPoint(p.v);
      stats.retraceLen += p.u ? Math.hypot(p.u.pt[0] - p.v.pt[0], p.u.pt[1] - p.v.pt[1]) : 0;
      push([p.u.pt[0], p.u.pt[1]]);
      cur = enterFromPoint(p.u);
    }
  };

  while (middles.size) {
    let bestComp = null, bestPair = null;
    for (const c of middles) {
      const p = nearestPair(c);
      if (p && (!bestPair || p.d < bestPair.d)) { bestPair = p; bestComp = c; }
    }
    if (bestComp === null) break; // (careful: comp id 0 is falsy)
    middles.delete(bestComp);
    order.push(bestComp);
    connect(bestPair, bestComp);
    cur = cover(bestComp, cur);
    covered.add(bestComp);
  }
  // finish ON the exit node — riding drawn connectors back across components
  // first if the pen ended away from the exit's component
  if (compOf.get(cur) !== exitComp) returnToComp(exitComp);
  if (cur !== exitNode) {
    const r = compOf.get(cur) === exitComp ? shortest(cur, new Set([exitNode])) : null;
    if (r) {
      for (const [ei2, fromId] of r.path) { stats.retraceLen += edges[ei2].len; pushChain(edges[ei2], fromId); }
    } else {
      const n = byId.get(exitNode);
      const from = points[points.length - 1];
      stats.connectors++;
      stats.connectorLen += Math.hypot(n.x - from[0], n.y - from[1]);
      push([n.x, n.y]);
    }
  }

  stats.unvisited = edges.length - visited.size;
  return {
    points,
    entry: points[0],
    exit: points[points.length - 1],
    stats,
  };
}
