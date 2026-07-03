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

  const allIds = nodes.map(n => n.id);
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
  const stats = { components: nComps, connectors: 0, connectorLen: 0, retraceLen: 0, edgeLen: 0, unvisited: 0 };
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
  const nodesWithUnvisited = comp => new Set(allIds.filter(id => compOf.get(id) === comp &&
    adj.get(id).some(ei => !visited.has(ei))));

  const cover = (comp, startId) => {
    let cur = startId;
    push([byId.get(cur).x, byId.get(cur).y]);
    while (compUnvisited(comp)) {
      const ei = adj.get(cur).find(ei2 => !visited.has(ei2));
      if (ei !== undefined) {
        visited.add(ei);
        stats.edgeLen += edges[ei].len;
        pushChain(edges[ei], cur);
        cur = other(edges[ei], cur);
      } else {
        const targets = nodesWithUnvisited(comp);
        targets.delete(cur);
        const r = shortest(cur, targets);
        if (!r) break; // shouldn't happen within a component
        for (const [ei2, fromId] of r.path) {
          stats.retraceLen += edges[ei2].len;
          pushChain(edges[ei2], fromId);
        }
        cur = r.node;
      }
    }
    return cur;
  };

  // component order: entry comp first, exit comp last, middles greedy-nearest
  const order = [entryComp];
  const middles = new Set();
  for (let c = 0; c < nComps; c++) if (c !== entryComp && c !== exitComp) middles.add(c);

  let cur = cover(entryComp, entryNode);
  const nearestNodeOfComp = (comp, fromPt) => {
    let best = null, bestD = Infinity;
    for (const id of allIds) {
      if (compOf.get(id) !== comp) continue;
      const d = dist(byId.get(id), fromPt);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  };
  const connectTo = nodeId => {
    const n = byId.get(nodeId);
    const from = points[points.length - 1];
    stats.connectors++;
    stats.connectorLen += Math.hypot(n.x - from[0], n.y - from[1]);
    push([n.x, n.y]);
  };

  while (middles.size) {
    const from = points[points.length - 1];
    let bestComp = null, bestNode = null, bestD = Infinity;
    for (const c of middles) {
      const nid = nearestNodeOfComp(c, from);
      const d = dist(byId.get(nid), from);
      if (d < bestD) { bestD = d; bestComp = c; bestNode = nid; }
    }
    middles.delete(bestComp);
    order.push(bestComp);
    connectTo(bestNode);
    cur = cover(bestComp, bestNode);
  }
  // cover the exit component last, if it wasn't the entry component
  if (!order.includes(exitComp)) {
    const nid = nearestNodeOfComp(exitComp, points[points.length - 1]);
    connectTo(nid);
    order.push(exitComp);
    cur = cover(exitComp, nid);
  }

  // finish ON the exit node
  if (cur !== exitNode) {
    if (compOf.get(cur) === exitComp) {
      const r = shortest(cur, new Set([exitNode]));
      if (r) for (const [ei2, fromId] of r.path) { stats.retraceLen += edges[ei2].len; pushChain(edges[ei2], fromId); }
      else connectTo(exitNode);
    } else {
      connectTo(exitNode);
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
