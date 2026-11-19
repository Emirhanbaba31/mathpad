// Infinite vector whiteboard: strokes, shapes, text, images. Pan/zoom, palm rejection, undo/redo, export.
export const COLORS = ['#f4f4f5', '#9ca3af', '#ff6b6b', '#5ab0ff', '#5be49b', '#ffd166'];
const PRINT = { '#f4f4f5': '#111111', '#9ca3af': '#555555', '#ff6b6b': '#dc2626', '#5ab0ff': '#1d4ed8', '#5be49b': '#15803d', '#ffd166': '#b7791f' };
import { recognize } from './shapes.js';
import { SYMBOLS } from './symbols.js';
const FONT = '"Space Grotesk", system-ui, sans-serif';
const path2d = new Map(); const P2 = d => { let p = path2d.get(d); if (!p) path2d.set(d, p = new Path2D(d)); return p; };
// symbol boxes rotate around their centre; returns the 4 corners in board space
function symCorners(el) { const S = SYMBOLS[el.name] || SYMBOLS.node, w = S.w * el.s, h = S.h * el.s, cx = el.x + w / 2, cy = el.y + h / 2, a = (el.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]); }
const paper = () => document.documentElement.dataset.theme === 'paper';

const imgCache = new Map();
function getImg(src, onload) {
  let im = imgCache.get(src);
  if (!im) { im = new Image(); im.src = src; imgCache.set(src, im); }
  if (!im.complete && onload) im.addEventListener('load', onload, { once: true });
  return im;
}

const measure = document.createElement('canvas').getContext('2d');
export function bbox(el) {
  switch (el.type) {
    case 'stroke': {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < el.pts.length; i += 3) {
        const x = el.pts[i], y = el.pts[i + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const h = el.w; return [x0 - h, y0 - h, x1 + h, y1 + h];
    }
    case 'img': return [el.x, el.y, el.x + el.w, el.y + el.h];
    case 'poly': {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < el.pts.length; i += 2) { const x = el.pts[i], y = el.pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return [x0, y0, x1, y1];
    }
    case 'sym': { const c = symCorners(el), xs = c.map(q => q[0]), ys = c.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
    case 'text': {
      measure.font = `${el.size}px ${FONT}`;
      const lines = el.text.split('\n');
      return [el.x, el.y, el.x + Math.max(...lines.map(l => measure.measureText(l).width)), el.y + lines.length * el.size * 1.25];
    }
    default: return [Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.max(el.x1, el.x2), Math.max(el.y1, el.y2)];
  }
}
const union = els => els.map(bbox).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
// precise: outline only (eraser); otherwise filled shapes count (selection)
function hit(el, x, y, r, precise) {
  const t = r + (el.w || 0) / 2;
  switch (el.type) {
    case 'stroke': {
      const p = el.pts;
      if (p.length === 3) return Math.hypot(x - p[0], y - p[1]) < t;
      for (let i = 3; i < p.length; i += 3) if (segDist(x, y, p[i - 3], p[i - 2], p[i], p[i + 1]) < t) return true;
      return false;
    }
    case 'line': case 'arrow': return segDist(x, y, el.x1, el.y1, el.x2, el.y2) < t;
    case 'poly': {
      const q = el.pts, n = q.length / 2;
      for (let i = 1; i < n + (el.closed ? 1 : 0); i++) { const a = (i - 1) % n, b = i % n; if (segDist(x, y, q[a * 2], q[a * 2 + 1], q[b * 2], q[b * 2 + 1]) < t) return true; }
      if (!precise && el.closed) { const [a, b, c, d] = bbox(el); return x > a && x < c && y > b && y < d; }
      return false;
    }
    case 'rect': {
      const [a, b, c, d] = bbox(el);
      const inside = x > a - t && x < c + t && y > b - t && y < d + t;
      return precise ? inside && !(x > a + t && x < c - t && y > b + t && y < d - t) : inside;
    }
    case 'ellipse': {
      const cx = (el.x1 + el.x2) / 2, cy = (el.y1 + el.y2) / 2, rx = Math.abs(el.x2 - el.x1) / 2 || 1, ry = Math.abs(el.y2 - el.y1) / 2 || 1;
      const n = Math.hypot((x - cx) / rx, (y - cy) / ry);
      return precise ? Math.abs(n - 1) * Math.min(rx, ry) < t : n < 1 + t / Math.min(rx, ry);
    }
    default: { const [a, b, c, d] = bbox(el); return x > a - r && x < c + r && y > b - r && y < d + r; }
  }
}

function move(el, dx, dy) {
  const e = { ...el };
  if (e.type === 'stroke') e.pts = e.pts.map((v, i) => i % 3 === 0 ? v + dx : i % 3 === 1 ? v + dy : v);
  else if (e.type === 'poly') e.pts = e.pts.map((v, i) => i % 2 ? v + dy : v + dx);
  else if ('x1' in e) { e.x1 += dx; e.x2 += dx; e.y1 += dy; e.y2 += dy; }
  else { e.x += dx; e.y += dy; }
  return e;
}
function scale(el, ox, oy, s) {
  const e = { ...el }, X = v => ox + (v - ox) * s, Y = v => oy + (v - oy) * s;
  if (e.type === 'stroke') { e.pts = e.pts.map((v, i) => i % 3 === 0 ? X(v) : i % 3 === 1 ? Y(v) : v); e.w = el.w * s; }
  else if ('x1' in e) { e.x1 = X(e.x1); e.x2 = X(e.x2); e.y1 = Y(e.y1); e.y2 = Y(e.y2); }
  else if (e.type === 'poly') { e.pts = e.pts.map((v, i) => i % 2 ? Y(v) : X(v)); e.w = el.w * s; }
  else { e.x = X(e.x); e.y = Y(e.y); if (e.type === 'img') { e.w *= s; e.h *= s; } else if (e.type === 'sym') e.s *= s; else e.size *= s; }
  return e;
}

export function drawEl(c, el, map, onload) {
  const col = (map && map[el.color]) || el.color;
  c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = 'round'; c.lineWidth = el.w;
  switch (el.type) {
    case 'stroke': {
      const p = el.pts, n = p.length / 3;
      if (el.hl) {
        c.globalAlpha = .35; c.beginPath(); c.moveTo(p[0], p[1]);
        for (let i = 3; i < p.length; i += 3) c.lineTo(p[i], p[i + 1]);
        c.stroke(); c.globalAlpha = 1; return;
      }
      if (n === 1) { c.beginPath(); c.arc(p[0], p[1], el.w * p[2] / 2, 0, 7); c.fill(); return; }
      let mx = p[0], my = p[1];
      for (let i = 1; i < n; i++) { // quadratic through midpoints, width per point (pressure)
        const x = p[i * 3], y = p[i * 3 + 1];
        const nx = i < n - 1 ? (x + p[i * 3 + 3]) / 2 : x, ny = i < n - 1 ? (y + p[i * 3 + 4]) / 2 : y;
        c.lineWidth = el.w * p[i * 3 + 2];
        c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(x, y, nx, ny); c.stroke();
        mx = nx; my = ny;
      }
      return;
    }
    case 'line': case 'arrow':
      c.beginPath(); c.moveTo(el.x1, el.y1); c.lineTo(el.x2, el.y2); c.stroke();
      if (el.type === 'arrow') {
        const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1), L = 10 + el.w * 3;
        c.beginPath();
        c.moveTo(el.x2 - L * Math.cos(a - .45), el.y2 - L * Math.sin(a - .45)); c.lineTo(el.x2, el.y2);
        c.lineTo(el.x2 - L * Math.cos(a + .45), el.y2 - L * Math.sin(a + .45)); c.stroke();
      }
      return;
    case 'rect': { const [a, b, x, y] = bbox(el); c.strokeRect(a, b, x - a, y - b); return; }
    case 'poly': {
      const q = el.pts; c.beginPath(); c.moveTo(q[0], q[1]);
      for (let i = 2; i < q.length; i += 2) c.lineTo(q[i], q[i + 1]);
      if (el.closed) c.closePath(); c.stroke(); return;
    }
    case 'sym': {
      const S = SYMBOLS[el.name] || SYMBOLS.node, w = S.w * el.s, h = S.h * el.s;
      c.save(); c.translate(el.x + w / 2, el.y + h / 2); c.rotate((el.rot || 0) * Math.PI / 180); c.scale(el.s, el.s); c.translate(-S.w / 2, -S.h / 2);
      c.lineWidth = el.w / el.s;
      for (const d of S.stroke || []) c.stroke(P2(d));
      for (const d of S.fill || []) c.fill(P2(d));
      c.restore(); return;
    }
    case 'ellipse':
      c.beginPath(); c.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, 7); c.stroke(); return;
    case 'text':
      c.font = `${el.size}px ${FONT}`; c.textBaseline = 'top';
      el.text.split('\n').forEach((l, i) => c.fillText(l, el.x, el.y + i * el.size * 1.25)); return;
    case 'img': {
      const im = getImg(el.src, onload);
      if (im.complete && im.naturalWidth) c.drawImage(im, el.x, el.y, el.w, el.h);
      else { c.lineWidth = 1; c.strokeStyle = '#333'; c.strokeRect(el.x, el.y, el.w, el.h); }
    }
  }
}

// Render elements to a new canvas. width: output px; box: fit inside [w,h] (thumbnail); header: title line on top.
export async function renderTo(els, { width = 1240, box, bg = '#fff', map = PRINT, header } = {}) {
  if (!els.length) return null;
  await Promise.all(els.filter(e => e.type === 'img').map(e => getImg(e.src).decode().catch(() => {})));
  const [x0, y0, x1, y1] = union(els), pad = 40, bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2;
  const head = header ? 90 : 0;
  let s = box ? Math.min(box[0] / bw, box[1] / bh) : width / bw;
  if (!box) s = Math.min(s, 30000 / bh); // browser canvas height limit
  const cv = document.createElement('canvas');
  cv.width = box ? box[0] : width; cv.height = box ? box[1] : Math.ceil(bh * s) + head;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  if (header) {
    c.fillStyle = map ? '#111' : '#f4f4f5'; c.font = `600 30px ${FONT}`; c.fillText(header[0], 40, 50);
    c.fillStyle = map ? '#666' : '#8b8b94'; c.font = `18px ${FONT}`; c.fillText(header[1], 40, 76);
  }
  const ox = box ? (cv.width - bw * s) / 2 : 0, oy = box ? (cv.height - bh * s) / 2 : head;
  c.setTransform(s, 0, 0, s, ox + (pad - x0) * s, oy + (pad - y0) * s);
  for (const el of els) drawEl(c, el, map);
  return cv;
}

export function createBoard(cv, initial, { onChange, onTool, onSelect, onSnap, onTap }) {
  const ctx = cv.getContext('2d');
  const base = document.createElement('canvas'), bctx = base.getContext('2d');
  const B = { els: initial, tool: 'pen', color: COLORS[0], width: 3, sel: null, snap: true };
  const view = { x: 0, y: 0, z: 1 };
  let undoS = [], redoS = [], penSeen = false, draft = null, gesture = null, dirty = true, raf = 0, dpr = 1, spaceDown = false, textBox = null;
  const ptrs = new Map();
  let tap = null; // quick multi-finger tap: 2 fingers = undo, 3 = redo

  const schedule = full => { if (full) dirty = true; raf ||= requestAnimationFrame(frame); };
  const reload = () => schedule(true);
  const changed = () => { schedule(true); onChange(B.els); };
  const snapshot = () => { undoS.push(B.els.slice()); if (undoS.length > 150) undoS.shift(); redoS = []; };
  const select = el => { B.sel = el; onSelect?.(el); schedule(); };

  function resize() {
    dpr = devicePixelRatio || 1;
    const r = cv.parentElement.getBoundingClientRect();
    for (const c of [cv, base]) { c.width = r.width * dpr; c.height = r.height * dpr; }
    schedule(true);
  }
  const ro = new ResizeObserver(resize); ro.observe(cv.parentElement);

  function grid(c) {
    let s = 40 * view.z; while (s < 16) s *= 4;
    c.fillStyle = paper() ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.10)';
    const w = base.width / dpr, h = base.height / dpr, r = Math.max(1, view.z > .6 ? 1.2 : .9);
    for (let x = ((view.x % s) + s) % s; x < w; x += s)
      for (let y = ((view.y % s) + s) % s; y < h; y += s) c.fillRect(x * dpr, y * dpr, r * dpr, r * dpr);
  }
  const worldTf = c => c.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * view.x, dpr * view.y);

  function frame() {
    raf = 0;
    if (!cv.width || !cv.height) return;
    if (dirty) {
      dirty = false;
      bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, base.width, base.height);
      if (paper()) { bctx.fillStyle = '#fbfaf6'; bctx.fillRect(0, 0, base.width, base.height); }
      grid(bctx); worldTf(bctx);
      for (const el of B.els) drawEl(bctx, el, paper() ? PRINT : null, reload);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(base, 0, 0);
    worldTf(ctx);
    if (draft) drawEl(ctx, draft, paper() ? PRINT : null);
    if (B.sel) {
      const [a, b, c, d] = bbox(B.sel), p = 6 / view.z, hs = 12 / view.z;
      ctx.setLineDash([6 / view.z, 4 / view.z]); ctx.lineWidth = 1.2 / view.z; ctx.strokeStyle = paper() ? '#111' : '#fff';
      ctx.strokeRect(a - p, b - p, c - a + 2 * p, d - b + 2 * p); ctx.setLineDash([]);
      ctx.fillStyle = paper() ? '#111' : '#fff'; ctx.fillRect(c + p - hs / 2, d + p - hs / 2, hs, hs);
    }
  }

  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const toWorld = e => { const [x, y] = local(e); return [(x - view.x) / view.z, (y - view.y) / view.z]; };
  const pressure = e => e.pointerType === 'pen' ? .3 + (e.pressure || .5) * 1.4 : 1;
  function zoomAt(sx, sy, f) {
    const z = Math.min(8, Math.max(.08, view.z * f));
    view.x = sx - (sx - view.x) * z / view.z; view.y = sy - (sy - view.y) * z / view.z; view.z = z;
    schedule(true);
  }
  const topHit = (x, y, precise, filter = () => true) => {
    for (let i = B.els.length - 1; i >= 0; i--) if (filter(B.els[i]) && hit(B.els[i], x, y, 8 / view.z, precise)) return B.els[i];
  };
  function eraseAt(x, y) {
    const el = topHit(x, y, true, e => e.type !== 'img'); // photos are removed via select + delete, not by accident
    if (el) { if (!gesture.changed) snapshot(); gesture.changed = true; B.els = B.els.filter(e => e !== el); schedule(true); }
  }
  function replaceSel(el) { B.els = B.els.map(e => e === B.sel ? el : e); B.sel = el; schedule(true); }

  function down(e) {
    if (textBox) return;
    try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    if (e.pointerType === 'pen') penSeen = true;
    ptrs.set(e.pointerId, local(e));
    if (e.pointerType === 'touch') {
      if (ptrs.size === 1) tap = { t: performance.now(), n: 1, at: new Map() };
      if (tap) { tap.n = Math.max(tap.n, ptrs.size); tap.at.set(e.pointerId, local(e)); }
    }
    if (ptrs.size === 2) {
      draft = null;
      const [p, q] = [...ptrs.values()];
      gesture = { type: 'pinch', d: Math.hypot(p[0] - q[0], p[1] - q[1]), m: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], v: { ...view } };
      schedule(); return;
    }
    if (ptrs.size > 2) return;
    const [sx, sy] = local(e), [x, y] = toWorld(e);
    if (e.button === 1 || spaceDown || (e.pointerType === 'touch' && penSeen)) { gesture = { type: 'pan', s: [sx, sy], v: { ...view } }; return; }
    const penErase = e.pointerType === 'pen' && (e.buttons & 34); // stylus side button or eraser end
    if (e.button === 2 && !penErase) return;
    const t = penErase ? 'eraser' : B.tool;
    if (t === 'pen' || t === 'hl') { draft = { type: 'stroke', color: B.color, w: t === 'hl' ? B.width * 6 : B.width, pts: [x, y, pressure(e)], ...(t === 'hl' && { hl: 1 }) }; gesture = { type: 'draw' }; }
    else if (t === 'eraser') { gesture = { type: 'erase' }; eraseAt(x, y); }
    else if (['line', 'arrow', 'rect', 'ellipse'].includes(t)) { draft = { type: t, color: B.color, w: B.width, x1: x, y1: y, x2: x, y2: y }; gesture = { type: 'draw' }; }
    else if (t === 'text') { const el = topHit(x, y, false, e => e.type === 'text'); editText(el, x, y); ptrs.clear(); }
    else if (t === 'select') {
      if (B.sel) {
        const [, , c, d] = bbox(B.sel), p = 6 / view.z;
        if (Math.hypot(x - c - p, y - d - p) < 16 / view.z) { gesture = { type: 'resize', orig: B.sel, bb: bbox(B.sel) }; return; }
      }
      const el = topHit(x, y, false);
      select(el || null);
      gesture = el ? { type: 'move', s: [x, y], orig: el } : { type: 'pan', s: [sx, sy], v: { ...view } };
    }
    schedule();
  }

  function moveEv(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, local(e));
    const s0 = tap?.at.get(e.pointerId), l = ptrs.get(e.pointerId);
    if (s0 && Math.hypot(l[0] - s0[0], l[1] - s0[1]) > 12) tap = null; // fingers moved: a pinch/pan, not a tap
    if (!gesture) return;
    if (gesture.type === 'pinch') {
      if (ptrs.size < 2) return;
      const [p, q] = [...ptrs.values()], g = gesture;
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const z = Math.min(8, Math.max(.08, g.v.z * d / g.d));
      view.z = z; view.x = m[0] - (g.m[0] - g.v.x) * z / g.v.z; view.y = m[1] - (g.m[1] - g.v.y) * z / g.v.z;
      return schedule(true);
    }
    const [sx, sy] = local(e);
    if (gesture.type === 'pan') { view.x = gesture.v.x + sx - gesture.s[0]; view.y = gesture.v.y + sy - gesture.s[1]; return schedule(true); }
    if (gesture.type === 'draw' && draft) {
      if (gesture.snapped) return; // already turned into a shape: wait for the pen to lift
      if (draft.type === 'stroke') {
        const co = e.getCoalescedEvents?.(); // may be empty (synthetic events): fall back to the event itself
        for (const ce of co?.length ? co : [e]) { const [x, y] = toWorld(ce); draft.pts.push(x, y, pressure(ce)); }
        const [lx, ly] = local(e);
        if (!gesture.rest || Math.hypot(lx - gesture.rest[0], ly - gesture.rest[1]) > 4) { gesture.rest = [lx, ly]; armSnap(); }
      }
      else {
        let [x, y] = toWorld(e);
        if (e.shiftKey && (draft.type === 'rect' || draft.type === 'ellipse')) { const s = Math.max(Math.abs(x - draft.x1), Math.abs(y - draft.y1)); x = draft.x1 + Math.sign(x - draft.x1) * s; y = draft.y1 + Math.sign(y - draft.y1) * s; }
        draft.x2 = x; draft.y2 = y;
      }
      return schedule();
    }
    const [x, y] = toWorld(e);
    if (gesture.type === 'erase') return eraseAt(x, y);
    if (gesture.type === 'move') {
      if (!gesture.moved) { snapshot(); gesture.moved = true; }
      return replaceSel(move(gesture.orig, x - gesture.s[0], y - gesture.s[1]));
    }
    if (gesture.type === 'resize') {
      if (!gesture.moved) { snapshot(); gesture.moved = true; }
      const [a, b, c] = gesture.bb, s = Math.max(.05, (x - a) / (c - a || 1));
      return replaceSel(scale(gesture.orig, a, b, s));
    }
  }

  // pen rests still for a moment while drawing → recognise the stroke and swap in a clean shape
  let snapT = 0;
  function armSnap() {
    clearTimeout(snapT);
    if (!B.snap || draft?.hl) return;
    snapT = setTimeout(() => {
      if (gesture?.type !== 'draw' || draft?.type !== 'stroke') return;
      const sh = recognize(draft.pts); if (!sh) return;
      draft = { ...sh, color: draft.color, w: draft.w }; gesture.snapped = true; schedule(); onSnap?.(sh.type);
    }, 550);
  }
  function up(e) {
    clearTimeout(snapT);
    ptrs.delete(e.pointerId);
    if (tap && !ptrs.size) {
      const t = tap; tap = null;
      if (t.n >= 2 && performance.now() - t.t < 350) {
        if (gesture?.type === 'pinch') Object.assign(view, gesture.v); // undo the tiny zoom the tap caused
        gesture = null; draft = null;
        t.n === 2 ? api.undo() : api.redo(); onTap?.(t.n); return;
      }
    }
    if (gesture?.type === 'pinch') { if (!ptrs.size) gesture = null; return; }
    if (draft) {
      const d = draft; draft = null;
      const big = d.type === 'stroke' || d.type === 'poly' || Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 3 / view.z;
      if (big) { snapshot(); B.els = [...B.els, d]; changed(); } else schedule();
    }
    if (gesture?.type === 'erase' && gesture.changed) onChange(B.els);
    if ((gesture?.type === 'move' || gesture?.type === 'resize') && gesture.moved) onChange(B.els);
    gesture = null;
  }

  function editText(el, x, y) {
    const size = el ? el.size : 14 + B.width * 5;
    const ta = document.createElement('textarea');
    ta.className = 'board-text';
    const left = (el ? el.x : x) * view.z + view.x, top = (el ? el.y : y) * view.z + view.y;
    Object.assign(ta.style, { left: left + 'px', top: top + 'px', fontSize: size * view.z + 'px', color: el ? el.color : B.color });
    ta.value = el?.text || '';
    cv.parentElement.append(ta); textBox = ta;
    if (el) { B.els = B.els.filter(e => e !== el); schedule(true); }
    setTimeout(() => ta.focus());
    const done = () => {
      if (textBox !== ta) return;
      textBox = null; ta.remove();
      const text = ta.value.replace(/\s+$/, '');
      if (!text && !el) return;
      snapshot();
      if (el) undoS[undoS.length - 1] = [...B.els, el]; // undo restores the original text
      if (text) B.els = [...B.els, { type: 'text', color: el ? el.color : B.color, size, x: el ? el.x : x, y: el ? el.y : y, text }];
      changed();
    };
    ta.addEventListener('blur', done);
    ta.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) ta.blur(); e.stopPropagation(); });
  }

  function wheel(e) {
    e.preventDefault();
    const [sx, sy] = local(e);
    if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, Math.exp(-e.deltaY * .01));
    else { view.x -= e.deltaX; view.y -= e.deltaY; schedule(true); }
  }
  function dbl(e) {
    if (B.tool !== 'select') return;
    const [x, y] = toWorld(e), el = topHit(x, y, false, e => e.type === 'text');
    if (el) { select(null); editText(el); }
  }

  const api = {
    get els() { return B.els; },
    get tool() { return B.tool; },
    setTool(t) { B.tool = t; if (t !== 'select') select(null); onTool?.(t); },
    setColor(c) { B.color = c; if (B.sel && B.sel.type !== 'img') { snapshot(); replaceSel({ ...B.sel, color: c }); onChange(B.els); } },
    setWidth(w) { B.width = w; },
    undo() { if (!undoS.length) return; redoS.push(B.els); B.els = undoS.pop(); select(null); changed(); },
    redo() { if (!redoS.length) return; undoS.push(B.els); B.els = redoS.pop(); select(null); changed(); },
    deleteSel() { if (!B.sel) return; snapshot(); B.els = B.els.filter(e => e !== B.sel); select(null); changed(); },
    setSnap(on) { B.snap = on; },
    rotateSel() { if (B.sel?.type !== 'sym') return; snapshot(); replaceSel({ ...B.sel, rot: ((B.sel.rot || 0) + 90) % 360 }); onChange(B.els); },
    // circuit symbol placed in the middle of the view, selected so it can be moved/rotated right away
    addSymbol(name) {
      const S = SYMBOLS[name]; if (!S) return;
      const r = cv.getBoundingClientRect(), sc = 1.6;
      const el = { type: 'sym', name, s: sc, rot: 0, color: B.color, w: 2.2, x: (r.width / 2 - view.x) / view.z - S.w * sc / 2, y: (r.height * .4 - view.y) / view.z - S.h * sc / 2 };
      snapshot(); B.els = [...B.els, el]; api.setTool('select'); select(el); changed();
    },
    fit() {
      const r = cv.getBoundingClientRect();
      if (!B.els.length) { Object.assign(view, { x: 0, y: 0, z: 1 }); return schedule(true); }
      const [a, b, c, d] = union(B.els), p = 40;
      const z = Math.min(2, (r.width - p * 2) / (c - a || 1), (r.height - p * 2 - 70) / (d - b || 1));
      Object.assign(view, { z, x: (r.width - (c - a) * z) / 2 - a * z, y: p - b * z });
      schedule(true);
    },
    // Place images (data URLs) stacked vertically in the middle of the current view.
    async addImages(srcs) {
      const r = cv.getBoundingClientRect();
      let y = (r.height * .15 - view.y) / view.z;
      const added = [];
      for (const src of srcs) {
        const im = getImg(src); await im.decode().catch(() => {});
        const w = Math.min(im.naturalWidth || 600, (r.width * .8) / view.z), h = w * (im.naturalHeight || 400) / (im.naturalWidth || 600);
        added.push({ type: 'img', src, x: (r.width / 2 - view.x) / view.z - w / 2, y, w, h });
        y += h + 30;
      }
      snapshot(); B.els = [...B.els, ...added];
      api.setTool('select'); select(added.at(-1)); changed();
    },
    export: opts => renderTo(B.els, opts),
    thumb: () => renderTo(B.els, { box: [360, 230], bg: '#0b0b0e', map: null }),
    destroy() {
      ro.disconnect(); cancelAnimationFrame(raf);
      removeEventListener('keydown', key); removeEventListener('keyup', keyUp); removeEventListener('mp-theme', reload);
      textBox?.blur();
    },
  };

  const keys = { p: 'pen', h: 'hl', e: 'eraser', v: 'select', t: 'text', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse' };
  function key(e) {
    if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? api.redo() : api.undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); api.redo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') api.deleteSel();
    else if (e.key === ' ') { spaceDown = true; e.preventDefault(); }
    else if (!mod && !e.altKey && keys[e.key.toLowerCase()]) api.setTool(keys[e.key.toLowerCase()]);
  }
  const keyUp = e => { if (e.key === ' ') spaceDown = false; };
  addEventListener('keydown', key); addEventListener('keyup', keyUp); addEventListener('mp-theme', reload);
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', moveEv);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', wheel, { passive: false });
  cv.addEventListener('dblclick', dbl);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  resize();
  return api;
}
