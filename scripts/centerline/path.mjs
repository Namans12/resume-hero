/* SVG path-data → flat polylines (absolute coords). Supports
   M m L l H h V v C c S s Q q T t Z z. Arcs are rejected — none of the
   artworks contain them, and arc flags are hazardous to reformat. */

export function flattenPath(d, tol = 0.5) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g) ?? [];
  let i = 0;
  const isNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  const num = () => {
    const v = parseFloat(tokens[i++]);
    if (Number.isNaN(v)) throw new Error(`bad number at token ${i - 1}: ${tokens[i - 1]}`);
    return v;
  };

  const polys = [];
  let poly = null;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  let pcx = null, pcy = null; // prev cubic ctrl2 (for S/s)
  let pqx = null, pqy = null; // prev quad ctrl (for T/t)

  const moveTo = (x, y) => { cx = x; cy = y; sx = x; sy = y; poly = [[x, y]]; polys.push(poly); };
  const lineTo = (x, y) => { poly.push([x, y]); cx = x; cy = y; };
  const cubicTo = (x1, y1, x2, y2, x, y) => {
    const n = Math.min(64, Math.max(6, Math.ceil(
      (Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / (3 * tol),
    )));
    for (let k = 1; k <= n; k++) {
      const t = k / n, r = 1 - t;
      poly.push([
        r * r * r * cx + 3 * r * r * t * x1 + 3 * r * t * t * x2 + t * t * t * x,
        r * r * r * cy + 3 * r * r * t * y1 + 3 * r * t * t * y2 + t * t * t * y,
      ]);
    }
    cx = x; cy = y;
  };
  const quadTo = (x1, y1, x, y) => {
    const ax = cx, ay = cy; // capture before cubicTo mutates cx/cy
    cubicTo(ax + (2 / 3) * (x1 - ax), ay + (2 / 3) * (y1 - ay),
      x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x, y);
  };

  while (i < tokens.length) {
    const c = tokens[i++];
    let x1, y1, x2, y2, x, y;
    switch (c) {
      case 'M': x = num(); y = num(); moveTo(x, y);
        while (isNum()) { x = num(); y = num(); lineTo(x, y); } break;
      case 'm': x = cx + num(); y = cy + num(); moveTo(x, y);
        while (isNum()) { x = cx + num(); y = cy + num(); lineTo(x, y); } break;
      case 'L': do { x = num(); y = num(); lineTo(x, y); } while (isNum()); break;
      case 'l': do { x = cx + num(); y = cy + num(); lineTo(x, y); } while (isNum()); break;
      case 'H': do { lineTo(num(), cy); } while (isNum()); break;
      case 'h': do { lineTo(cx + num(), cy); } while (isNum()); break;
      case 'V': do { lineTo(cx, num()); } while (isNum()); break;
      case 'v': do { lineTo(cx, cy + num()); } while (isNum()); break;
      case 'C': do { x1 = num(); y1 = num(); x2 = num(); y2 = num(); x = num(); y = num();
        cubicTo(x1, y1, x2, y2, x, y); pcx = x2; pcy = y2; } while (isNum()); break;
      case 'c': do { x1 = cx + num(); y1 = cy + num(); x2 = cx + num(); y2 = cy + num();
        x = cx + num(); y = cy + num();
        cubicTo(x1, y1, x2, y2, x, y); pcx = x2; pcy = y2; } while (isNum()); break;
      case 'S': case 's': do {
        x1 = pcx !== null ? 2 * cx - pcx : cx; y1 = pcy !== null ? 2 * cy - pcy : cy;
        if (c === 'S') { x2 = num(); y2 = num(); x = num(); y = num(); }
        else { x2 = cx + num(); y2 = cy + num(); x = cx + num(); y = cy + num(); }
        cubicTo(x1, y1, x2, y2, x, y); pcx = x2; pcy = y2;
      } while (isNum()); break;
      case 'Q': do { x1 = num(); y1 = num(); x = num(); y = num();
        quadTo(x1, y1, x, y); pqx = x1; pqy = y1; } while (isNum()); break;
      case 'q': do { x1 = cx + num(); y1 = cy + num(); x = cx + num(); y = cy + num();
        quadTo(x1, y1, x, y); pqx = x1; pqy = y1; } while (isNum()); break;
      case 'T': case 't': do {
        x1 = pqx !== null ? 2 * cx - pqx : cx; y1 = pqy !== null ? 2 * cy - pqy : cy;
        if (c === 'T') { x = num(); y = num(); } else { x = cx + num(); y = cy + num(); }
        quadTo(x1, y1, x, y); pqx = x1; pqy = y1;
      } while (isNum()); break;
      case 'Z': case 'z': lineTo(sx, sy); break;
      case 'A': case 'a': throw new Error('arc commands unsupported (none expected in artworks)');
      default: throw new Error(`unsupported path command: ${c}`);
    }
    // smooth-reflection state only survives across C/S (cubic) or Q/T (quad)
    if (!'CcSs'.includes(c)) { pcx = pcy = null; }
    if (!'QqTt'.includes(c)) { pqx = pqy = null; }
  }
  return polys;
}
