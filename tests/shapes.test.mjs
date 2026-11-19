// Shape correction: hand-drawn strokes (with jitter) must snap to the right clean shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recognize, simplify } from '../js/shapes.js';
import { SYMBOLS } from '../js/symbols.js';

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - .5);
// flat [x, y, pressure] stroke through the given points with small hand jitter
function stroke(points, jitter = 1.5, steps = 12) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    for (let k = 0; k < steps; k++) { const t = k / steps; out.push(ax + (bx - ax) * t + rand() * jitter, ay + (by - ay) * t + rand() * jitter, 1); }
  }
  const [lx, ly] = points.at(-1); out.push(lx, ly, 1);
  return out;
}
const circle = (cx, cy, rx, ry, n = 48) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos(i / n * 2 * Math.PI), cy + ry * Math.sin(i / n * 2 * Math.PI)]);

test('a shaky straight stroke becomes a line with the same end points', () => {
  const s = recognize(stroke([[10, 10], [210, 60]]));
  assert.equal(s.type, 'line');
  assert.ok(Math.hypot(s.x1 - 10, s.y1 - 10) < 4 && Math.hypot(s.x2 - 210, s.y2 - 60) < 4);
});

test('a round loop becomes a circle', () => {
  const s = recognize(stroke(circle(100, 100, 60, 58), 1.5, 2));
  assert.equal(s.type, 'ellipse');
  assert.ok(Math.abs((s.x2 - s.x1) - (s.y2 - s.y1)) < 1, 'circle has equal width and height');
  assert.ok(Math.abs((s.x2 - s.x1) / 2 - 59) < 6);
});

test('a flat loop becomes an ellipse', () => {
  const s = recognize(stroke(circle(100, 100, 90, 40), 1.5, 2));
  assert.equal(s.type, 'ellipse');
  assert.ok((s.x2 - s.x1) > 1.8 * (s.y2 - s.y1));
});

test('an axis-aligned box becomes a rectangle', () => {
  const s = recognize(stroke([[20, 20], [220, 22], [218, 140], [22, 138], [20, 22]]));
  assert.equal(s.type, 'rect');
  assert.ok(Math.abs(s.x1 - 20) < 5 && Math.abs(s.y2 - 140) < 5);
});

test('a closed three-corner stroke becomes a triangle polygon', () => {
  const s = recognize(stroke([[100, 10], [190, 160], [10, 160], [100, 12]]));
  assert.equal(s.type, 'poly');
  assert.equal(s.closed, true);
  assert.equal(s.pts.length, 6);
});

test('an open V becomes a two-segment polyline', () => {
  const s = recognize(stroke([[10, 10], [80, 120], [150, 10]]));
  assert.equal(s.type, 'poly');
  assert.equal(s.closed, false);
});

test('tiny marks and scribbles are left alone', () => {
  assert.equal(recognize(stroke([[0, 0], [5, 4]])), null);
  const zig = stroke([[0, 0], [30, 80], [60, 0], [90, 80], [120, 0], [150, 80], [180, 0], [210, 80]]);
  assert.equal(recognize(zig), null);
});

test('simplify keeps the corners of a polyline', () => {
  const pts = [[0, 0], [50, 1], [100, 0], [100, 50], [100, 100]];
  assert.deepEqual(simplify(pts, 3), [[0, 0], [100, 0], [100, 100]]);
});

test('every circuit symbol has a size and drawable path data', () => {
  for (const [name, s] of Object.entries(SYMBOLS)) {
    assert.ok(s.w > 0 && s.h > 0 && s.label, name);
    const paths = [...(s.stroke || []), ...(s.fill || [])];
    assert.ok(paths.length, name);
    for (const d of paths) assert.match(d, /^M[\d\s.,MLHVZACQTSmlhvzacqts-]+$/, `${name}: ${d}`);
  }
});
