// Shape correction: turns a hand-drawn stroke into a clean line, circle, ellipse, rectangle or polygon.
// pts is the board's flat stroke array [x, y, pressure, x, y, pressure, ...]. Returns a shape (without colour/width) or null.

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
// Douglas–Peucker: keeps the corners of a polyline
export function simplify(P, eps) {
  if (P.length < 3) return P.slice();
  let idx = 0, max = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i], P[0], P.at(-1)); if (d > max) { max = d; idx = i; } }
  if (max <= eps) return [P[0], P.at(-1)];
  return [...simplify(P.slice(0, idx + 1), eps).slice(0, -1), ...simplify(P.slice(idx), eps)];
}

export function recognize(flat) {
  const P = [];
  for (let i = 0; i < flat.length; i += 3) P.push([flat[i], flat[i + 1]]);
  if (P.length < 4) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, len = 0;
  P.forEach((p, i) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); if (i) len += dist(P[i - 1], p); });
  const w = x1 - x0, h = y1 - y0, diag = Math.hypot(w, h);
  if (diag < 14) return null;
  const start = P[0], end = P.at(-1), gap = dist(start, end);

  // straight line: the path is barely longer than its chord and never strays from it
  if (gap > .85 * len && Math.max(...P.map(p => segDist(p, start, end))) < .06 * gap + 3)
    return { type: 'line', x1: start[0], y1: start[1], x2: end[0], y2: end[1] };

  const closed = gap < Math.max(20, .2 * len);
  const eps = .07 * diag;
  if (!closed) {
    const v = simplify(P, eps);
    return v.length === 3 ? { type: 'poly', closed: false, pts: v.flat() } : null; // an angle / "V"
  }

  // closed shapes: corners decide between polygon and ellipse
  let v = simplify([...P, start], eps);
  if (v.length > 2 && dist(v[0], v.at(-1)) < eps) v = v.slice(0, -1);
  // drop corners that are almost straight (angle close to 180°)
  v = v.filter((p, i) => { const a = v[(i - 1 + v.length) % v.length], b = v[(i + 1) % v.length]; const u = [a[0] - p[0], a[1] - p[1]], t = [b[0] - p[0], b[1] - p[1]]; const cos = (u[0] * t[0] + u[1] * t[1]) / (Math.hypot(...u) * Math.hypot(...t) || 1); return cos > -.94; });

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = w / 2 || 1, ry = h / 2 || 1;
  const ellErr = P.reduce((s, p) => s + Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1), 0) / P.length;

  if (v.length === 4) {
    const axis = v.every((p, i) => { const q = v[(i + 1) % 4], ang = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI) % 90; return ang < 16 || ang > 74; });
    if (axis) return { type: 'rect', x1: x0, y1: y0, x2: x1, y2: y1 };
    return { type: 'poly', closed: true, pts: v.flat() };
  }
  if (v.length === 3) return { type: 'poly', closed: true, pts: v.flat() };
  if (ellErr < .12) {
    if (Math.abs(rx - ry) / Math.max(rx, ry) < .18) { const r = (rx + ry) / 2; return { type: 'ellipse', x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r }; }
    return { type: 'ellipse', x1: x0, y1: y0, x2: x1, y2: y1 };
  }
  if (v.length >= 5 && v.length <= 6) return { type: 'poly', closed: true, pts: v.flat() };
  return null;
}
export const SHAPE_NAMES = { line: 'çizgi', ellipse: 'daire/elips', rect: 'dikdörtgen', poly: 'çokgen' };
