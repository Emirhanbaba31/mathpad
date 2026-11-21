// MathPad Engineering Simulation Center — Part 2 UI Module
// Fields: 'makine' (8), 'termo' (8), 'havacilik' (5) = 21 interactive simulations.
// Contract: export const SIMS = [{ id, field, title, icon, mount(host, ctx) -> cleanupFn }];

import { esc, icon } from './ui.js';
import { motion, syncSegments } from './fx.js';
import { tex, richTex, accentColor, createClean, setupCanvas, createAnimLoop } from './phys-ui.js';
import { plot, PLOT_COLORS, eng } from './tools.js';
import {
  G0, R_UNIV, SIGMA_SB, WIEN_B, MU_EARTH, R_EARTH, makeRng,
  classifyGrashof, fourBarCrankRange, solveFourBar, solveSliderCrank, sampleLinkageCycle,
  sdofParams, sdofFRF, sdofFreeResponse, sdofStep, sdofFRFCurve,
  twoDofModal, twoDofFRF, denHartogTMD, twoDofStep,
  collide2DBodies, bodiesMomentumEnergy, ROLLING_SHAPES, rollingIncline,
  solveGearTrain, computeCamProfile,
  solveShaftTorsion, solveHelicalSpring,
  armForwardKinematics, armInverseKinematics, armJacobian,
  pendulumPeriods, pendulumStep, physicalPendulum, gyroscopePrecession,
  solveThermoCycle,
  GAS_SPECIES, maxwellBoltzmann, idealGasProcess,
  heat1DStep, heat1DInit, solveLaplace2D, solveCompositeWall,
  solveFin, solveHeatExchanger,
  colebrookFriction, solvePipeFlow, solvePumpSystem, solveVenturi,
  evalPotentialFlow, cylinderWithCirculation,
  solveSubmergedGate, solveBuoyancyStability,
  blackbodySummary, viewFactorParallelPlates, radiationPlateExchange,
  orbitalElements, orbitStep, hohmannTransfer,
  isaAtmosphere, solveMultistageRocket, simulateVerticalLaunch,
  parseNaca4, generateNaca4, evaluateAirfoil, airfoilPolarSweep,
  projectileVacuum, simulateProjectile, findOptimalProjectileAngle,
  solveFlightPerformance,
  marchingSquares, blackbodyColorHex, thermalColorRGB,
} from './simlab-mech-core.js';

// =====================================================================
// SHARED UI, FORMATTING & CANVAS HELPERS
// =====================================================================

const COL_FG = '#f4f4f5';
const COL_MUTE = '#8b8b94';
const COL_GRID = 'rgba(255,255,255,.08)';
const COL_AXIS = 'rgba(255,255,255,.26)';
const COL_OK = '#5be49b';
const COL_WARN = '#ffd166';
const COL_BAD = '#ff6b6b';
const COL_BLUE = '#5ab0ff';
const COL_PURP = '#c084fc';
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const autoPlayAllowed = () => motion() === 'full';
const isReduced = () => motion() === 'reduced';
const isMotionOff = () => motion() === 'off';

function fmtNum(x, digits = 3) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  if (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-4) return x.toExponential(Math.max(1, digits - 1));
  return String(+x.toPrecision(digits));
}

function fmtFix(x, d = 2) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  return Number(x.toFixed(d)).toString();
}

function fmtUnit(x, unit = '', sig = 3) {
  if (x === Infinity) return unit ? `∞ ${unit}` : '∞';
  if (x === -Infinity) return unit ? `−∞ ${unit}` : '−∞';
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-15) return unit ? `0 ${unit}` : '0';
  const e = eng(x);
  if (e) {
    const m = /^(-?[\d.]+)(.+)$/.exec(e);
    if (m) return `${+(+m[1]).toPrecision(sig)} ${m[2]}${unit}`;
    return `${e}${unit}`;
  }
  return `${fmtNum(x, sig)}${unit ? ' ' + unit : ''}`;
}

function introHtml(text, presets = []) {
  return `<div class="slm-intro">
    <p>${text.replace(/\$([^$\n]+?)\$/g, (_, t) => tex(t))}</p>
    ${presets.length ? `<div class="slm-presets" role="group" aria-label="Hazır senaryolar">
      <span class="slm-preset-lbl">Senaryo:</span>
      ${presets.map((p, i) => `<button type="button" class="slm-chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function bindPresets(host, presets, apply) {
  host.querySelector('.slm-presets')?.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    host.querySelectorAll('.slm-presets [data-preset]').forEach(x => x.classList.toggle('slm-on', x === b));
    apply(presets[+b.dataset.preset]);
    syncSegments(host, false);
  });
}

let slmUid = 0;
function addSlider(parent, { label, unit = '', min, max, value, step, log = false, fmt, onInput }) {
  const uid = `slm-s-${++slmUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'slm-ctrl';
  wrap.innerHTML = `<div class="slm-ctrl-top">
      <label class="slm-ctrl-lbl" for="${uid}">${esc(label)}</label>
      <span class="slm-ctrl-val mono" data-v></span>
    </div>
    <input id="${uid}" type="range" class="slm-range" aria-label="${esc(label)}">`;
  parent.append(wrap);
  const rng = wrap.querySelector('input');
  const valEl = wrap.querySelector('[data-v]');
  let cur = value, lo = min, hi = max;

  if (log) {
    rng.min = '0'; rng.max = '1000'; rng.step = '1';
  } else {
    rng.min = String(lo); rng.max = String(hi);
    rng.step = String(step ?? (hi - lo) / 200);
  }

  const toPos = v => {
    const cl = Math.max(lo, Math.min(hi, v));
    return log ? Math.round((1000 * Math.log(cl / lo)) / Math.log(hi / lo)) : cl;
  };
  const fromPos = p => (log ? lo * Math.pow(hi / lo, p / 1000) : p);
  const format = v => (fmt ? fmt(v) : (unit ? `${fmtNum(v, 3)} ${unit}` : fmtNum(v, 3)));

  const set = v => {
    cur = Math.max(lo, Math.min(hi, v));
    rng.value = String(toPos(cur));
    valEl.textContent = format(cur);
  };
  const setRange = (nLo, nHi) => {
    lo = nLo; hi = nHi;
    if (!log) { rng.min = String(lo); rng.max = String(hi); }
    set(cur);
  };

  rng.addEventListener('input', () => {
    const raw = fromPos(+rng.value);
    cur = log ? +raw.toPrecision(3) : +raw.toFixed(6);
    valEl.textContent = format(cur);
    onInput(cur);
  });

  set(value);
  return { el: wrap, set, setRange, get: () => cur, setVisible: s => { wrap.hidden = !s; } };
}

function addToggle(parent, label, checked, onChange) {
  const lbl = document.createElement('label');
  lbl.className = 'slm-check-row';
  lbl.innerHTML = `<span>${esc(label)}</span><input type="checkbox" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;
  parent.append(lbl);
  const inp = lbl.querySelector('input');
  inp.addEventListener('change', () => onChange(inp.checked));
  return { el: lbl, set: v => { inp.checked = !!v; }, get: () => inp.checked, setVisible: s => { lbl.hidden = !s; } };
}

function addSelect(parent, label, options, value, onChange) {
  const uid = `slm-sel-${++slmUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'slm-ctrl';
  wrap.innerHTML = `<label class="slm-ctrl-lbl" for="${uid}">${esc(label)}</label>
    <select id="${uid}" class="inp slm-sel" aria-label="${esc(label)}">
      ${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>`;
  parent.append(wrap);
  const sel = wrap.querySelector('select');
  sel.addEventListener('change', () => onChange(sel.value));
  return { el: wrap, set: v => { sel.value = v; }, get: () => sel.value, setVisible: s => { wrap.hidden = !s; } };
}

function renderKpis(el, items) {
  el.innerHTML = items.map(it => {
    const toneCls = it.tone ? `slm-kpi-${it.tone}` : '';
    return `<div class="slm-kpi ${toneCls}">
      <span class="slm-kpi-lbl">${esc(it.lbl)}</span>
      <b class="slm-kpi-val mono">${esc(it.val)}</b>
      ${it.sub ? `<span class="slm-kpi-sub mono">${esc(it.sub)}</span>` : ''}
    </div>`;
  }).join('');
}

function theoryAndTasksHtml({ equations = [], paragraphs = [], tasks = [] }) {
  const tasksHtml = tasks.length ? `<div class="slm-tasks" role="region" aria-label="Deney görevleri">
    <div class="slm-tasks-head"><h4 class="slm-title">Deney Görevleri</h4><span class="slm-hint" data-task-prog>0 / ${tasks.length}</span></div>
    ${tasks.map((t, i) => `<label class="slm-task"><input type="checkbox" data-task="${i}"><span>${richTex(t)}</span></label>`).join('')}
  </div>` : '';

  const theoryHtml = `<details class="slm-theory">
    <summary><span>Nasıl çalışır? — Kuram ve Denklemler</span><span class="slm-theory-tag">Kuram</span></summary>
    <div class="slm-theory-body">
      ${equations.length ? `<div class="slm-eq-box">${equations.map(eq => `<div>${tex(eq, true)}</div>`).join('')}</div>` : ''}
      ${paragraphs.map(p => `<p>${richTex(p)}</p>`).join('')}
    </div>
  </details>`;

  return tasksHtml + theoryHtml;
}

function bindTasks(host) {
  const boxes = [...host.querySelectorAll('[data-task]')];
  const prog = host.querySelector('[data-task-prog]');
  if (!boxes.length) return;
  const sync = () => {
    let done = 0;
    boxes.forEach(b => {
      const ok = b.checked;
      if (ok) done++;
      b.closest('.slm-task')?.classList.toggle('slm-done', ok);
    });
    if (prog) prog.textContent = `${done} / ${boxes.length} tamamlandı`;
  };
  boxes.forEach(b => b.addEventListener('change', sync));
  sync();
}

function safePlot(cv, series, opts) {
  if (!cv) return;
  cv.style.width = '';
  if (cv.clientWidth < 40) return;
  plot(cv, series, opts);
}

function attachReadout(cv, rd, formatFn, clean) {
  if (!cv || !rd) return;
  const onMove = e => {
    const m = cv._map;
    if (!m || !m.series?.length) return;
    const x = e.offsetX;
    if (x < m.L || x > m.L + m.pw) { rd.textContent = ''; return; }
    const u = (x - m.L) / m.pw;
    const xv = m.xlog ? m.x0 * Math.pow(m.x1 / m.x0, u) : m.x0 + (m.x1 - m.x0) * u;
    const xs = m.series[0].xs;
    if (!xs.length) return;
    let lo = 0, hi = xs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < xv) lo = mid + 1; else hi = mid;
    }
    const idx = lo > 0 && Math.abs(xs[lo - 1] - xv) < Math.abs(xs[lo] - xv) ? lo - 1 : lo;
    rd.textContent = formatFn(xs[idx], m.series, idx);
  };
  const onLeave = () => { rd.textContent = ''; };
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerleave', onLeave);
  clean.add(() => {
    cv.removeEventListener('pointermove', onMove);
    cv.removeEventListener('pointerleave', onLeave);
  });
}

function observeResize(el, fn, clean) {
  if (typeof ResizeObserver === 'undefined' || !el) return;
  const ro = new ResizeObserver(() => fn());
  ro.observe(el);
  clean.add(() => ro.disconnect());
}

function bindDragCanvas(cv, { onDown, onMove, onUp }, clean) {
  let activeId = null;
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, W: r.width, H: r.height };
  };
  const down = e => {
    if (activeId !== null) return;
    const p = pt(e);
    if (onDown && onDown(p, e) === false) return;
    activeId = e.pointerId;
    cv.setPointerCapture?.(e.pointerId);
  };
  const move = e => {
    const p = pt(e);
    onMove?.(p, activeId === e.pointerId, e);
  };
  const up = e => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    cv.releasePointerCapture?.(e.pointerId);
    onUp?.(pt(e), e);
  };
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  clean.add(() => {
    cv.removeEventListener('pointerdown', down);
    cv.removeEventListener('pointermove', move);
    cv.removeEventListener('pointerup', up);
    cv.removeEventListener('pointercancel', up);
  });
}

function syncPlayBtn(btn, playing) {
  btn.innerHTML = playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
  btn.setAttribute('aria-pressed', String(playing));
}

function drawArrow(c, x1, y1, x2, y2, color, lw = 2, label = '') {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1.5) return;
  const ux = dx / len, uy = dy / len;
  const head = Math.min(9, len * 0.35);
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45);
  c.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45);
  c.closePath(); c.fill();
  if (label && len > 12) {
    c.font = '600 11px "JetBrains Mono", monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, x2 + ux * 13, y2 + uy * 13);
  }
  c.restore();
}

function drawSpring(c, x1, y1, x2, y2, coils = 8, amp = 8, color = COL_FG) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 8) return;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const lead = Math.min(12, len * 0.14);
  const body = len - 2 * lead;
  c.save();
  c.strokeStyle = color; c.lineWidth = 1.8; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x1 + ux * lead, y1 + uy * lead);
  const segs = coils * 2;
  for (let i = 1; i < segs; i++) {
    const f = i / segs;
    const side = i % 2 === 1 ? amp : -amp;
    c.lineTo(x1 + ux * (lead + f * body) + nx * side, y1 + uy * (lead + f * body) + ny * side);
  }
  c.lineTo(x2 - ux * lead, y2 - uy * lead);
  c.lineTo(x2, y2);
  c.stroke();
  c.restore();
}

function drawDamper(c, x1, y1, x2, y2, color = COL_BLUE) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 16) return;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const mid = len * 0.48;
  const cyl = Math.min(26, len * 0.34);
  const w = 7;
  c.save();
  c.strokeStyle = color; c.lineWidth = 1.8; c.lineCap = 'round';
  // Left rod to cylinder housing
  const cx0 = x1 + ux * (mid - cyl * 0.5), cy0 = y1 + uy * (mid - cyl * 0.5);
  const cx1 = x1 + ux * (mid + cyl * 0.5), cy1 = y1 + uy * (mid + cyl * 0.5);
  c.beginPath();
  c.moveTo(x1, y1); c.lineTo(cx0, cy0);
  c.moveTo(cx0 + nx * w, cy0 + ny * w); c.lineTo(cx0 - nx * w, cy0 - ny * w);
  c.moveTo(cx0 + nx * w, cy0 + ny * w); c.lineTo(cx1 + nx * w, cy1 + ny * w);
  c.moveTo(cx0 - nx * w, cy0 - ny * w); c.lineTo(cx1 - nx * w, cy1 - ny * w);
  // Piston inside
  const px = x1 + ux * mid, py = y1 + uy * mid;
  c.moveTo(px + nx * (w - 2.5), py + ny * (w - 2.5));
  c.lineTo(px - nx * (w - 2.5), py - ny * (w - 2.5));
  c.moveTo(px, py); c.lineTo(x2, y2);
  c.stroke();
  c.restore();
}

function drawGroundHatch(c, x1, y1, x2, y2, dir = 1) {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy * dir, ny = ux * dir;
  c.lineWidth = 1;
  for (let d = 4; d < len; d += 8) {
    const bx = x1 + ux * d, by = y1 + uy * d;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + nx * 7 - ux * 4, by + ny * 7 - uy * 4); c.stroke();
  }
  c.restore();
}

function drawPin(c, x, y, r = 5, fill = '#0b0b10', stroke = COL_FG) {
  c.save();
  c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 2;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

function drawGearWheel(c, cx, cy, pitchR, teeth, angle, color, internal = false) {
  const m = (2 * pitchR) / Math.max(6, teeth);
  const add = m * 0.85, ded = m * 1.05;
  const rOut = internal ? pitchR + ded + 8 : pitchR + add;
  const rIn = internal ? pitchR - add : Math.max(4, pitchR - ded);

  c.save();
  c.translate(cx, cy);
  c.rotate(angle);

  if (internal) {
    // Outer ring band
    c.fillStyle = 'rgba(255,255,255,.04)';
    c.strokeStyle = color; c.lineWidth = 1.8;
    c.beginPath();
    c.arc(0, 0, rOut, 0, Math.PI * 2);
    c.stroke();
  }

  c.beginPath();
  const step = (2 * Math.PI) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.18;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.62;
    const a4 = a0 + step * 0.78;
    const rA = internal ? pitchR + ded : rIn;
    const rB = internal ? rIn : rOut;
    if (i === 0) c.moveTo(rA * Math.cos(a0), rA * Math.sin(a0));
    else c.lineTo(rA * Math.cos(a0), rA * Math.sin(a0));
    c.lineTo(rA * Math.cos(a1), rA * Math.sin(a1));
    c.lineTo(rB * Math.cos(a2), rB * Math.sin(a2));
    c.lineTo(rB * Math.cos(a3), rB * Math.sin(a3));
    c.lineTo(rA * Math.cos(a4), rA * Math.sin(a4));
  }
  c.closePath();
  if (!internal) {
    c.fillStyle = 'rgba(255,255,255,.05)';
    c.fill();
  }
  c.strokeStyle = color; c.lineWidth = 1.6; c.stroke();

  // Pitch circle dashed
  c.setLineDash([4, 4]);
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, pitchR, 0, Math.PI * 2); c.stroke();
  c.setLineDash([]);

  // Spokes / reference mark so rotation is clearly visible
  if (!internal) {
    c.strokeStyle = color; c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(pitchR * 0.72, 0);
    c.stroke();
    c.fillStyle = color;
    c.beginPath(); c.arc(pitchR * 0.55, 0, 3, 0, Math.PI * 2); c.fill();
    drawPin(c, 0, 0, Math.min(7, pitchR * 0.22), '#0b0b10', color);
  }
  c.restore();
}

// =====================================================================
// 1. DÖRT ÇUBUK MEKANİZMASI (Four-Bar & Slider-Crank)
// =====================================================================

const FOURBAR_PRESETS = [
  { label: 'Krank-Sarkaç (Grashof)', mode: 'fourbar', L1: 4.0, L2: 1.4, L3: 3.6, L4: 3.0, omega2: 2.5, couplerP: 0.55, couplerGamma: 0.45 },
  { label: 'Çift Krank (Drag-Link)', mode: 'fourbar', L1: 1.8, L2: 3.2, L3: 3.6, L4: 3.0, omega2: 2.2, couplerP: 0.5, couplerGamma: 0.35 },
  { label: 'Grashof Dışı (Üçlü Sarkaç)', mode: 'fourbar', L1: 4.0, L2: 2.4, L3: 2.6, L4: 2.1, omega2: 2.0, couplerP: 0.5, couplerGamma: 0.5 },
  { label: 'Krank-Biyel (Piston)', mode: 'slider', r: 1.2, l: 3.4, offset: 0.25, omega2: 3.0, couplerP: 0.5 },
];

function mountFourBar(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'fourbar', L1: 4.0, L2: 1.4, L3: 3.6, L4: 3.0,
    r: 1.2, l: 3.4, offset: 0.25,
    theta2: 0.7, omega2: 2.5, couplerP: 0.55, couplerGamma: 0.45,
    assembly: 1, showTrace: true, playing: autoPlayAllowed(), oscDir: 1,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Dört çubuk</b> ve <b>krank-biyel</b> mekanizmalarını canlı döndür, <b>mafsalları tuvalde sürükleyerek</b> uzuv boylarını değiştir, Grashof sınıfını, bağlama eğrisini ve iletim açısını incele.', FOURBAR_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-mode role="tablist" aria-label="Mekanizma tipi">
          <button type="button" data-m="fourbar" class="on">Dört Çubuk</button>
          <button type="button" data-m="slider">Krank-Biyel</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-grashof></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Mekanizma & Bağlama Eğrisi (Mafsalları Sürükle)</h4><span class="slm-hint">O₄, A, B veya P noktasını sürükle</span></div>
          <div class="slm-cv-box"><canvas class="slm-cv slm-cv-drag" data-cv aria-label="Dört çubuk mekanizma animasyonu"></canvas><div class="slm-cv-tag" data-tag></div></div>
        </div>
        <div class="slm-grid-2">
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title" data-tvel>Açısal Hızlar</h4><div class="slm-legend" data-lvel></div></div>
            <div class="slm-cv-box" data-bvel><canvas class="slm-cv" data-cvel aria-label="Açısal hız grafiği"></canvas><div class="slm-readout" data-rvel></div></div>
            <div class="slm-axis-lbl">Krank açısı θ₂ (°)</div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title" data-tacc>Açısal İvmeler</h4><div class="slm-legend" data-lacc></div></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cacc aria-label="Açısal ivme grafiği"></canvas><div class="slm-readout" data-racc></div></div>
            <div class="slm-axis-lbl">Krank açısı θ₂ (°)</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'S + L \\le P + Q \\quad (\\text{Grashof koşulu: en az bir uzuv tam } 360^\\circ \\text{ döner})',
        '\\cos\\mu = \\frac{L_3^2 + L_4^2 - d^2}{2 L_3 L_4}, \\qquad \\omega_3 = \\frac{L_2\\omega_2\\sin(\\theta_4-\\theta_2)}{L_3\\sin(\\theta_3-\\theta_4)}, \\quad \\omega_4 = \\frac{L_2\\omega_2\\sin(\\theta_3-\\theta_2)}{L_4\\sin(\\theta_3-\\theta_4)}',
      ],
      paragraphs: [
        '**Grashof ölçütü** dört uzvun en kısası ($S$) ile en uzununun ($L$) toplamını diğer ikisinin ($P+Q$) toplamıyla kıyaslar. $S+L < P+Q$ ise en kısa uzuv gövdeye komşuysa **krank-sarkaç**, gövdeyse **çift krank** oluşur.',
        '**İletim açısı $\\mu$**, biyel ($L_3$) ile çıkış uzvu ($L_4$) arasındaki açıdır. Kuvvet aktarımının verimli olması ve sıkışmaması için tasarım pratiğinde $40^\\circ \\le \\mu \\le 140^\\circ$ aralığı hedeflenir.',
      ],
      tasks: [
        'Krank uzunluğunu ($L_2$) büyüterek mekanizmayı Grashof krank-sarkaçtan **Grashof dışı** rejime geçirin ve sarkaç salınımını gözlemleyin.',
        'İz noktası $P$’yi tuvalde sürükleyerek D-şekilli doğrusal kesitli bir bağlama eğrisi elde edin.',
        'İletim açısı $\\mu_{\\min}$ değerinin $40^\\circ$ altına düştüğü bir uzuv oranı bulun ve ivme tepe değerindeki artışı grafikte inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const alertEl = host.querySelector('[data-alert]');
  const grBadge = host.querySelector('[data-grashof]');
  const playBtn = host.querySelector('[data-play]');
  const tagEl = host.querySelector('[data-tag]');
  const cv = host.querySelector('[data-cv]');
  const cvel = host.querySelector('[data-cvel]');
  const cacc = host.querySelector('[data-cacc]');
  const rvel = host.querySelector('[data-rvel]');
  const racc = host.querySelector('[data-racc]');

  const sL1 = addSlider(ctrls, { label: 'Gövde L₁', unit: 'm', min: 1.0, max: 6.0, value: st.L1, step: 0.05, onInput: v => { st.L1 = v; onParam(); } });
  const sL2 = addSlider(ctrls, { label: 'Krank L₂', unit: 'm', min: 0.5, max: 4.5, value: st.L2, step: 0.05, onInput: v => { if (st.mode === 'fourbar') st.L2 = v; else st.r = Math.min(2.5, v); onParam(); } });
  const sL3 = addSlider(ctrls, { label: 'Biyel L₃', unit: 'm', min: 1.0, max: 6.0, value: st.L3, step: 0.05, onInput: v => { if (st.mode === 'fourbar') st.L3 = v; else st.l = v; onParam(); } });
  const sL4 = addSlider(ctrls, { label: 'Sarkaç L₄', unit: 'm', min: 1.0, max: 6.0, value: st.L4, step: 0.05, onInput: v => { st.L4 = v; onParam(); } });
  const sOff = addSlider(ctrls, { label: 'Eksen Kaçıklığı e', unit: 'm', min: -1.2, max: 1.2, value: st.offset, step: 0.05, onInput: v => { st.offset = v; onParam(); } });
  const sW2 = addSlider(ctrls, { label: 'Krank Hızı ω₂', unit: 'rad/s', min: 0.5, max: 8.0, value: st.omega2, step: 0.1, onInput: v => { st.omega2 = v; onParam(); } });
  const sTh2 = addSlider(ctrls, { label: 'Krank Açısı θ₂', unit: '°', min: 0, max: 360, value: st.theta2 * DEG, step: 1, fmt: v => `${v.toFixed(0)}°`, onInput: v => { st.theta2 = v * RAD; drawAll(false); } });
  const tCross = addToggle(ctrls, 'Çapraz Montaj Modu', false, v => { st.assembly = v ? -1 : 1; onParam(); });
  const tTrace = addToggle(ctrls, 'Bağlama Eğrisini Göster', true, v => { st.showTrace = v; mainCv.render(); });

  let cycle = null;
  let worldView = { cx: 160, cy: 150, scale: 45 };
  let dragTarget = null;

  const toScreen = p => ({ x: worldView.cx + p.x * worldView.scale, y: worldView.cy - p.y * worldView.scale });
  const toWorld = p => ({ x: (p.x - worldView.cx) / worldView.scale, y: (worldView.cy - p.y) / worldView.scale });

  function getSol() {
    if (st.mode === 'fourbar') {
      return solveFourBar({ L1: st.L1, L2: st.L2, L3: st.L3, L4: st.L4, theta2: st.theta2, omega2: st.omega2, couplerP: st.couplerP, couplerGamma: st.couplerGamma, assembly: st.assembly });
    }
    return solveSliderCrank({ r: st.r, l: st.l, offset: st.offset, theta2: st.theta2, omega2: st.omega2, couplerP: st.couplerP });
  }

  function recomputeCycle() {
    if (st.mode === 'fourbar') {
      const gr = classifyGrashof(st.L1, st.L2, st.L3, st.L4);
      grBadge.textContent = gr.type;
      grBadge.className = `slm-badge ${!gr.valid ? 'slm-badge-bad' : gr.grashof ? 'slm-badge-ok' : 'slm-badge-warn'}`;
      const rng = fourBarCrankRange(st.L1, st.L2, st.L3, st.L4);
      if (!rng.full && rng.valid) st.theta2 = Math.max(rng.min, Math.min(rng.max, st.theta2));
      cycle = sampleLinkageCycle({ mode: 'fourbar', L1: st.L1, L2: st.L2, L3: st.L3, L4: st.L4, omega2: st.omega2, couplerP: st.couplerP, couplerGamma: st.couplerGamma, assembly: st.assembly }, 180);
    } else {
      const ok = st.l > st.r + Math.abs(st.offset) + 0.05;
      grBadge.textContent = ok ? 'Krank-Biyel (Tam Tur)' : 'Biyel Çok Kısa (l > r + |e|)';
      grBadge.className = `slm-badge ${ok ? 'slm-badge-ok' : 'slm-badge-bad'}`;
      cycle = sampleLinkageCycle({ mode: 'slider', r: st.r, l: st.l, offset: st.offset, omega2: st.omega2, couplerP: st.couplerP }, 180);
    }
  }

  function drawPlots() {
    if (!cycle || cycle.thetas.length < 2) return;
    const x0 = cycle.thetas[0], x1 = cycle.thetas[cycle.thetas.length - 1];
    const isFB = st.mode === 'fourbar';
    host.querySelector('[data-tvel]').textContent = isFB ? 'Açısal Hızlar ω₃, ω₄' : 'Biyel ω₃ & Piston Hızı vB';
    host.querySelector('[data-tacc]').textContent = isFB ? 'Açısal İvmeler α₃, α₄' : 'Biyel α₃ & Piston İvmesi aB';
    host.querySelector('[data-lvel]').innerHTML = `<span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BLUE}"></i>ω₃</span>
      <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>${isFB ? 'ω₄' : 'vB'}</span>`;
    host.querySelector('[data-lacc]').innerHTML = `<span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_WARN}"></i>α₃</span>
      <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BAD}"></i>${isFB ? 'α₄' : 'aB'}</span>`;

    safePlot(cvel, [
      { name: 'ω3', color: COL_BLUE, xs: cycle.thetas, ys: cycle.w3 },
      { name: isFB ? 'ω4' : 'vB', color: COL_OK, xs: cycle.thetas, ys: cycle.w4 },
    ], { x0, x1, ylabel: isFB ? 'rad/s' : 'rad/s · m/s', height: 180 });
    safePlot(cacc, [
      { name: 'α3', color: COL_WARN, xs: cycle.thetas, ys: cycle.a3 },
      { name: isFB ? 'α4' : 'aB', color: COL_BAD, xs: cycle.thetas, ys: cycle.a4 },
    ], { x0, x1, ylabel: isFB ? 'rad/s²' : 'rad/s² · m/s²', height: 180 });
  }

  function updateKPIs(sol) {
    const isFB = st.mode === 'fourbar';
    const muGood = cycle && cycle.muMin >= 40 && cycle.muMax <= 140;
    alertEl.innerHTML = !sol.ok
      ? `<div class="slm-alert slm-alert-bad">Mevcut uzuv uzunluklarıyla kapalı mekanizma kurulamıyor; uzuv boylarını ayarlayın.</div>`
      : (!muGood && cycle && cycle.mus.length
        ? `<div class="slm-alert slm-alert-warn">İletim açısı sınırı aşıldı (μ: ${fmtFix(cycle.muMin, 1)}° – ${fmtFix(cycle.muMax, 1)}°). İdeal aralık 40°–140°'dir.</div>`
        : '');

    renderKpis(kpis, [
      { lbl: 'İletim Açısı μ', val: sol.ok ? `${fmtFix(sol.muDeg, 1)}°` : '—', sub: cycle ? `min ${fmtFix(cycle.muMin, 0)}° · maks ${fmtFix(cycle.muMax, 0)}°` : '', tone: sol.ok && sol.muDeg >= 40 && sol.muDeg <= 140 ? 'ok' : 'warn' },
      { lbl: 'Biyel Hızı ω₃', val: sol.ok ? `${fmtFix(sol.omega3, 2)} rad/s` : '—', sub: sol.ok ? `α₃ = ${fmtFix(sol.alpha3, 2)} rad/s²` : '' },
      { lbl: isFB ? 'Sarkaç Hızı ω₄' : 'Piston Hızı vB', val: sol.ok ? (isFB ? `${fmtFix(sol.omega4, 2)} rad/s` : `${fmtFix(sol.vB, 2)} m/s`) : '—', sub: sol.ok ? (isFB ? `α₄ = ${fmtFix(sol.alpha4, 2)} rad/s²` : `aB = ${fmtFix(sol.aB, 2)} m/s²`) : '', tone: 'acc' },
      { lbl: isFB ? 'Biyel Açısı θ₃' : 'Piston Konumu xB', val: sol.ok ? (isFB ? `${fmtFix(sol.theta3 * DEG, 1)}°` : `${fmtFix(sol.xB, 2)} m`) : '—', sub: `θ₂ = ${fmtFix(((st.theta2 * DEG) % 360 + 360) % 360, 0)}°` },
    ]);
    tagEl.textContent = isFB
      ? `L₁=${st.L1.toFixed(2)}  L₂=${st.L2.toFixed(2)}  L₃=${st.L3.toFixed(2)}  L₄=${st.L4.toFixed(2)}`
      : `r=${st.r.toFixed(2)}  l=${st.l.toFixed(2)}  e=${st.offset.toFixed(2)}`;
  }

  const mainCv = setupCanvas(cv, w => Math.min(350, Math.max(240, w * 0.56)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const span = st.mode === 'fourbar' ? Math.max(st.L1 + st.L2 + st.L4 * 0.4, 7.5) : Math.max((st.r + st.l) * 1.45, 6);
    const scale = Math.min(W / (span * 1.25), H / (span * 0.92));
    worldView = {
      cx: st.mode === 'fourbar' ? W * 0.5 - st.L1 * 0.5 * scale : W * 0.28,
      cy: H * 0.56,
      scale,
    };

    // Subtle coordinate grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    const step = scale;
    for (let x = worldView.cx % step; x < W; x += step) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = worldView.cy % step; y < H; y += step) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    const acc = accentColor();
    const sol = getSol();

    // Coupler curve trace
    if (st.showTrace && cycle && cycle.curve.length > 2) {
      c.save();
      c.strokeStyle = acc; c.globalAlpha = 0.6; c.lineWidth = 1.6;
      c.beginPath();
      cycle.curve.forEach((pt, idx) => {
        const s = toScreen(pt);
        if (idx === 0) c.moveTo(s.x, s.y); else c.lineTo(s.x, s.y);
      });
      c.stroke();
      c.restore();
    }

    const pO2 = toScreen({ x: 0, y: 0 });
    const pA = toScreen(sol.A);

    if (st.mode === 'fourbar') {
      const pO4 = toScreen(sol.O4);
      // Ground line
      c.save();
      c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(pO2.x, pO2.y); c.lineTo(pO4.x, pO4.y); c.stroke();
      c.setLineDash([]);
      c.restore();
      drawGroundHatch(c, pO2.x - 14, pO2.y + 10, pO2.x + 14, pO2.y + 10, 1);
      drawGroundHatch(c, pO4.x - 14, pO4.y + 10, pO4.x + 14, pO4.y + 10, 1);

      // Crank circle guide
      c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1;
      c.beginPath(); c.arc(pO2.x, pO2.y, st.L2 * scale, 0, Math.PI * 2); c.stroke();

      // Crank L2
      c.strokeStyle = COL_BLUE; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pO2.x, pO2.y); c.lineTo(pA.x, pA.y); c.stroke();

      if (sol.ok) {
        const pB = toScreen(sol.B), pP = toScreen(sol.P);
        // Coupler triangle A-B-P
        c.fillStyle = 'rgba(255,255,255,.05)';
        c.beginPath(); c.moveTo(pA.x, pA.y); c.lineTo(pB.x, pB.y); c.lineTo(pP.x, pP.y); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.2; c.stroke();

        // Coupler L3 & Rocker L4
        c.strokeStyle = COL_FG; c.lineWidth = 4;
        c.beginPath(); c.moveTo(pA.x, pA.y); c.lineTo(pB.x, pB.y); c.stroke();
        c.strokeStyle = COL_OK; c.lineWidth = 4;
        c.beginPath(); c.moveTo(pO4.x, pO4.y); c.lineTo(pB.x, pB.y); c.stroke();

        // Transmission angle arc at B
        const aBA = Math.atan2(pA.y - pB.y, pA.x - pB.x);
        const aBO = Math.atan2(pO4.y - pB.y, pO4.x - pB.x);
        c.strokeStyle = COL_WARN; c.lineWidth = 1.6;
        c.beginPath(); c.arc(pB.x, pB.y, 18, aBA, aBO, ((aBO - aBA + Math.PI * 3) % (Math.PI * 2)) > Math.PI); c.stroke();

        drawPin(c, pB.x, pB.y, 6, '#0b0b10', COL_OK);
        drawPin(c, pP.x, pP.y, 5.5, acc, '#fff');
        c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace';
        c.fillText('B', pB.x + 9, pB.y - 8);
        c.fillStyle = acc; c.fillText('P', pP.x + 8, pP.y - 8);
      }
      drawPin(c, pO2.x, pO2.y, 6, '#0b0b10', COL_FG);
      drawPin(c, pO4.x, pO4.y, 6, '#0b0b10', COL_WARN);
      drawPin(c, pA.x, pA.y, 6, '#0b0b10', COL_BLUE);
      c.fillStyle = COL_MUTE; c.font = '600 11px "JetBrains Mono", monospace';
      c.fillText('O₂', pO2.x - 16, pO2.y - 10);
      c.fillText('O₄', pO4.x + 8, pO4.y - 10);
      c.fillText('A', pA.x + 8, pA.y - 8);
    } else {
      // Slider-crank track
      const yTrack = toScreen({ x: 0, y: st.offset }).y;
      drawGroundHatch(c, pO2.x - 20, yTrack + 18, W - 20, yTrack + 18, 1);
      c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1;
      c.beginPath(); c.arc(pO2.x, pO2.y, st.r * scale, 0, Math.PI * 2); c.stroke();

      c.strokeStyle = COL_BLUE; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pO2.x, pO2.y); c.lineTo(pA.x, pA.y); c.stroke();
      if (sol.ok) {
        const pB = toScreen(sol.B);
        c.strokeStyle = COL_FG; c.lineWidth = 4;
        c.beginPath(); c.moveTo(pA.x, pA.y); c.lineTo(pB.x, pB.y); c.stroke();
        // Piston block
        c.fillStyle = 'rgba(91,228,155,.18)'; c.strokeStyle = COL_OK; c.lineWidth = 2;
        c.fillRect(pB.x - 20, pB.y - 14, 40, 28);
        c.strokeRect(pB.x - 20, pB.y - 14, 40, 28);
        drawPin(c, pB.x, pB.y, 5, '#0b0b10', COL_OK);
        drawArrow(c, pB.x, pB.y - 22, pB.x + sol.vB * 9, pB.y - 22, COL_OK, 2, 'vB');
      }
      drawPin(c, pO2.x, pO2.y, 6, '#0b0b10', COL_FG);
      drawPin(c, pA.x, pA.y, 6, '#0b0b10', COL_BLUE);
    }
  }, clean);

  // Draggable handles: O4, A, B, P
  bindDragCanvas(cv, {
    onDown(p) {
      const sol = getSol();
      const cand = [];
      if (st.mode === 'fourbar') {
        cand.push({ id: 'O4', pt: toScreen(sol.O4) }, { id: 'A', pt: toScreen(sol.A) });
        if (sol.ok) cand.push({ id: 'B', pt: toScreen(sol.B) }, { id: 'P', pt: toScreen(sol.P) });
      } else {
        cand.push({ id: 'A', pt: toScreen(sol.A) });
      }
      let best = null, bestD = 26;
      for (const c of cand) {
        const d = Math.hypot(p.x - c.pt.x, p.y - c.pt.y);
        if (d < bestD) { bestD = d; best = c.id; }
      }
      dragTarget = best;
      return !!best;
    },
    onMove(p, dragging) {
      if (!dragging || !dragTarget) return;
      const w = toWorld(p);
      if (dragTarget === 'O4') {
        st.L1 = Math.max(1.0, Math.min(6.0, +w.x.toFixed(2)));
        sL1.set(st.L1);
      } else if (dragTarget === 'A') {
        const rad = Math.max(0.5, Math.min(4.5, Math.hypot(w.x, w.y)));
        st.theta2 = Math.atan2(w.y, w.x);
        if (st.mode === 'fourbar') { st.L2 = +rad.toFixed(2); sL2.set(st.L2); }
        else { st.r = Math.min(2.5, +rad.toFixed(2)); sL2.set(st.r); }
        sTh2.set(((st.theta2 * DEG) % 360 + 360) % 360);
      } else if (dragTarget === 'B') {
        const sol = getSol();
        st.L3 = Math.max(1.0, Math.min(6.0, +Math.hypot(w.x - sol.A.x, w.y - sol.A.y).toFixed(2)));
        st.L4 = Math.max(1.0, Math.min(6.0, +Math.hypot(w.x - sol.O4.x, w.y - sol.O4.y).toFixed(2)));
        sL3.set(st.L3); sL4.set(st.L4);
      } else if (dragTarget === 'P') {
        const sol = getSol();
        if (sol.ok) {
          const dx = w.x - sol.A.x, dy = w.y - sol.A.y;
          st.couplerP = Math.max(0.1, Math.min(1.6, Math.hypot(dx, dy) / st.L3));
          st.couplerGamma = Math.atan2(dy, dx) - sol.theta3;
        }
      }
      onParam();
    },
    onUp() { dragTarget = null; },
  }, clean);

  function drawAll(withPlots = true) {
    const sol = getSol();
    updateKPIs(sol);
    mainCv.render();
    if (withPlots) drawPlots();
  }

  function onParam() {
    recomputeCycle();
    drawAll(true);
  }

  function syncMode() {
    const isFB = st.mode === 'fourbar';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sL1.setVisible(isFB);
    sL4.setVisible(isFB);
    tCross.setVisible(isFB);
    sOff.setVisible(!isFB);
    sL2.el.querySelector('.slm-ctrl-lbl').textContent = isFB ? 'Krank L₂' : 'Krank Yarıçapı r';
    sL3.el.querySelector('.slm-ctrl-lbl').textContent = isFB ? 'Biyel L₃' : 'Biyel Uzunluğu l';
    sL2.setRange(0.5, isFB ? 4.5 : 2.4);
    if (isFB) { sL2.set(st.L2); sL3.set(st.L3); } else { sL2.set(st.r); sL3.set(st.l); }
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    if (st.mode === 'fourbar') {
      const rng = fourBarCrankRange(st.L1, st.L2, st.L3, st.L4);
      if (rng.full) {
        st.theta2 = (st.theta2 + st.omega2 * dt) % (2 * Math.PI);
      } else if (rng.valid) {
        st.theta2 += st.oscDir * st.omega2 * dt;
        if (st.theta2 >= rng.max) { st.theta2 = rng.max; st.oscDir = -1; }
        if (st.theta2 <= rng.min) { st.theta2 = rng.min; st.oscDir = 1; }
      }
    } else {
      st.theta2 = (st.theta2 + st.omega2 * dt) % (2 * Math.PI);
    }
    sTh2.set(((st.theta2 * DEG) % 360 + 360) % 360);
    drawAll(false);
    return true;
  }, clean);

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => {
    st.theta2 = 0.7; st.oscDir = 1; sTh2.set(st.theta2 * DEG); drawAll(false);
  });
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    syncMode();
    onParam();
    syncSegments(host, false);
  });
  bindPresets(host, FOURBAR_PRESETS, p => {
    Object.assign(st, p);
    sL1.set(st.L1); sL4.set(st.L4); sOff.set(st.offset); sW2.set(st.omega2);
    syncMode();
    onParam();
  });

  attachReadout(cvel, rvel, (x, ser, i) => `θ₂=${fmtFix(x, 0)}° · ${ser[0].name}=${fmtFix(ser[0].ys[i], 2)} · ${ser[1].name}=${fmtFix(ser[1].ys[i], 2)}`, clean);
  attachReadout(cacc, racc, (x, ser, i) => `θ₂=${fmtFix(x, 0)}° · ${ser[0].name}=${fmtFix(ser[0].ys[i], 2)} · ${ser[1].name}=${fmtFix(ser[1].ys[i], 2)}`, clean);
  observeResize(host.querySelector('[data-bvel]'), drawPlots, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  onParam();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 2. TİTREŞİM (1-DOF Spring-Mass-Damper, FRF, Transmissibility, Base)
// =====================================================================

const SDOF_PRESETS = [
  { label: 'Az Sönümlü Serbest', mode: 'free', m: 2, k: 80, c: 2.0, x0: 0.25, v0: 0, F0: 15, Y0: 0.08, omega: 6.32 },
  { label: 'Kritik Sönümlü (ζ=1)', mode: 'free', m: 2, k: 80, c: 25.3, x0: 0.25, v0: 0, F0: 15, Y0: 0.08, omega: 6.32 },
  { label: 'Rezonans (r = 1)', mode: 'forced', m: 2, k: 80, c: 2.5, x0: 0, v0: 0, F0: 12, Y0: 0.08, omega: 6.32 },
  { label: 'Yalıtım Bölgesi (r = 2.2)', mode: 'base', m: 2, k: 80, c: 3.0, x0: 0, v0: 0, F0: 12, Y0: 0.12, omega: 13.9 },
];

function mountVibrationSDOF(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'forced', m: 2, k: 80, c: 2.5, x0: 0.15, v0: 0,
    F0: 12, Y0: 0.1, omega: 6.32, playing: autoPlayAllowed(),
    simT: 0, x: 0.15, v: 0, trace: [],
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Yay-kütle-sönümleyici</b> sistemin serbest, zorlamalı ve taban uyarmalı titreşimini canlı izle; frekans yanıtını ($M, \\phi$) ve <b>iletilebilirlik</b> ($TR$) eğrisini incele.', SDOF_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="Titreşim modu">
          <button type="button" data-m="free">Serbest</button>
          <button type="button" data-m="forced" class="on">Zorlamalı</button>
          <button type="button" data-m="base">Taban Uyarmalı</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
      <span class="slm-badge" data-regime></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Canlı Yay-Kütle-Sönümleyici & x(t) İzi</h4><span class="slm-hint mono" data-tnow></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Yay kütle sönümleyici animasyonu"></canvas></div>
        </div>
        <div class="slm-grid-2">
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Frekans Yanıtı & İletilebilirlik</h4><div class="slm-legend">
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BLUE}"></i>Büyütme M(r)</span>
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>TR(r)</span>
            </div></div>
            <div class="slm-cv-box" data-bfrf><canvas class="slm-cv" data-cfrf aria-label="Frekans yanıtı genlik ve iletilebilirlik"></canvas><div class="slm-readout" data-rfrf></div></div>
            <div class="slm-axis-lbl">Frekans oranı r = ω / ωₙ (r = √2 geçiş)</div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Faz Gecikmesi φ(r)</h4><div class="slm-legend">
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_WARN}"></i>φ (°)</span>
            </div></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cph aria-label="Faz grafiği"></canvas><div class="slm-readout" data-rph></div></div>
            <div class="slm-axis-lbl">Frekans oranı r = ω / ωₙ</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'm\\ddot{x} + c\\dot{x} + kx = F_0\\cos(\\omega t), \\quad \\omega_n = \\sqrt{\\frac{k}{m}}, \\quad \\zeta = \\frac{c}{2\\sqrt{km}}',
        'M(r) = \\frac{1}{\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}}, \\quad TR(r) = \\sqrt{\\frac{1 + (2\\zeta r)^2}{(1-r^2)^2 + (2\\zeta r)^2}}, \\quad r = \\frac{\\omega}{\\omega_n}',
      ],
      paragraphs: [
        '**Rezonans ($r \\approx 1$)** durumunda faz gecikmesi tam $-90^\\circ$ olur ve genlik $1/(2\\zeta)$ mertebesinde büyür.',
        '**Titreşim yalıtımı** yalnızca $r > \\sqrt{2} \\approx 1.414$ bölgesinde sağlanır ($TR < 1$); bu bölgede sönüm oranını aşırı artırmak yüksek frekanslı iletilebilirliği bir miktar yükseltir.',
      ],
      tasks: [
        '**Serbest** modda sönümü artırarak $\\zeta = 1$ (kritik sönüm) değerini bulun ve salınımın tamamen kaybolduğunu doğrulayın.',
        '**Zorlamalı** modda $\\omega = \\omega_n$ rezonansına ayarlayıp faz açısının $-90^\\circ$ olduğunu gözlemleyin.',
        '**Taban Uyarmalı** modda $r > \\sqrt{2}$ bölgesine çıkın ($TR < 1$) ve kütlenin tabandan daha az sallandığını gözlemleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const regBadge = host.querySelector('[data-regime]');
  const playBtn = host.querySelector('[data-play]');
  const tnow = host.querySelector('[data-tnow]');
  const cv = host.querySelector('[data-cv]');
  const cfrf = host.querySelector('[data-cfrf]');
  const cph = host.querySelector('[data-cph]');

  const sM = addSlider(ctrls, { label: 'Kütle m', unit: 'kg', min: 0.5, max: 10, value: st.m, step: 0.1, onInput: v => { st.m = v; onParam(); } });
  const sK = addSlider(ctrls, { label: 'Yay Sabiti k', unit: 'N/m', min: 10, max: 400, value: st.k, step: 2, onInput: v => { st.k = v; onParam(); } });
  const sC = addSlider(ctrls, { label: 'Sönüm c', unit: 'N·s/m', min: 0, max: 60, value: st.c, step: 0.2, onInput: v => { st.c = v; onParam(); } });
  const sX0 = addSlider(ctrls, { label: 'Başlangıç x₀', unit: 'm', min: -0.35, max: 0.35, value: st.x0, step: 0.01, onInput: v => { st.x0 = v; resetSim(); } });
  const sF0 = addSlider(ctrls, { label: 'Kuvvet Genliği F₀', unit: 'N', min: 2, max: 50, value: st.F0, step: 1, onInput: v => { st.F0 = v; onParam(); } });
  const sY0 = addSlider(ctrls, { label: 'Taban Genliği Y₀', unit: 'm', min: 0.02, max: 0.25, value: st.Y0, step: 0.01, onInput: v => { st.Y0 = v; onParam(); } });
  const sW = addSlider(ctrls, { label: 'Uyarma Frekansı ω', unit: 'rad/s', min: 0.5, max: 25, value: st.omega, step: 0.1, onInput: v => { st.omega = v; onParam(); } });

  function resetSim() {
    st.simT = 0;
    st.x = st.mode === 'free' ? st.x0 : 0;
    st.v = st.mode === 'free' ? st.v0 : 0;
    st.trace = [];
    // Pre-populate trace when motion is off so static view is informative
    if (isMotionOff()) {
      const p = sdofParams(st);
      if (st.mode === 'free') {
        const fr = sdofFreeResponse({ m: st.m, k: st.k, c: st.c, x0: st.x0, v0: st.v0, tMax: 5, n: 180 });
        st.trace = fr.ts.map((t, i) => ({ t, x: fr.xs[i], y: 0 }));
      } else {
        let s = [0, 0];
        for (let i = 0; i <= 240; i++) {
          const t = i * 0.025;
          st.trace.push({ t, x: s[0], y: st.mode === 'base' ? st.Y0 * Math.cos(st.omega * t) : 0 });
          s = sdofStep(st, s, t, 0.025);
        }
        st.x = s[0]; st.v = s[1]; st.simT = 6;
      }
      void p;
    }
    mainCv.render();
  }

  function updateKPIsAndPlots() {
    const p = sdofParams(st);
    const r = st.omega / p.wn;
    const frf = sdofFRF(r, p.zeta);
    regBadge.textContent = `${p.regime} (ζ = ${fmtFix(p.zeta, 2)})`;
    regBadge.className = `slm-badge ${p.zeta < 0.2 ? 'slm-badge-warn' : p.zeta < 1 ? 'slm-badge-ok' : 'slm-badge-acc'}`;

    renderKpis(kpis, [
      { lbl: 'Doğal Frekans ωₙ', val: `${fmtFix(p.wn, 2)} rad/s`, sub: `fₙ = ${fmtFix(p.fn, 2)} Hz`, tone: 'acc' },
      { lbl: 'Sönüm Oranı ζ', val: fmtFix(p.zeta, 3), sub: `c_kr = ${fmtFix(p.cCrit, 1)} N·s/m` },
      { lbl: 'Frekans Oranı r', val: fmtFix(r, 2), sub: r > Math.SQRT2 ? 'Yalıtım (r > √2)' : Math.abs(r - 1) < 0.12 ? 'Rezonans!' : 'Alt kritik', tone: Math.abs(r - 1) < 0.12 && st.mode !== 'free' ? 'bad' : r > Math.SQRT2 ? 'ok' : '' },
      { lbl: st.mode === 'base' ? 'İletilebilirlik TR' : 'Büyütme M(r)', val: fmtFix(st.mode === 'base' ? frf.tr : frf.mag, 2), sub: `Faz φ = ${fmtFix(frf.phaseDeg, 1)}°` },
    ]);

    const c = sdofFRFCurve(Math.max(0.02, p.zeta), 3.2, 240);
    const markerH = Math.min(12, Math.max(4, ...c.mags.filter(v => v < 15)));
    safePlot(cfrf, [
      { name: 'M(r)', color: COL_BLUE, xs: c.rs, ys: c.mags.map(v => Math.min(v, 10)) },
      { name: 'TR(r)', color: COL_OK, xs: c.rs, ys: c.trs.map(v => Math.min(v, 10)) },
      { name: 'r', color: accentColor(), xs: [r, r], ys: [0, Math.min(10, Math.max(frf.mag, frf.tr, 1.5))] },
      { name: '√2', color: 'rgba(255,255,255,.25)', xs: [Math.SQRT2, Math.SQRT2], ys: [0, Math.min(markerH, 10)] },
    ], { x0: 0, x1: 3.2, ylabel: 'Oran', height: 185 });

    safePlot(cph, [
      { name: 'φ', color: COL_WARN, xs: c.rs, ys: c.phases },
      { name: 'r', color: accentColor(), xs: [r, r], ys: [-180, 0] },
    ], { x0: 0, x1: 3.2, ylabel: 'Faz (°)', height: 185 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(250, Math.max(195, w * 0.38)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const mechW = Math.min(210, W * 0.44);
    const baseY = H * 0.5;
    const baseDisp = st.mode === 'base' ? st.Y0 * Math.cos(st.omega * st.simT) : 0;
    const scalePx = 110;
    const wallX = 24 + Math.max(-18, Math.min(18, baseDisp * scalePx));
    const massX = Math.max(wallX + 54, Math.min(mechW - 36, 120 + Math.max(-55, Math.min(55, st.x * scalePx))));

    // Wall / moving base
    drawGroundHatch(c, wallX, baseY - 46, wallX, baseY + 46, -1);
    if (st.mode === 'base') {
      c.fillStyle = COL_WARN; c.font = '600 10px "JetBrains Mono", monospace';
      c.fillText('y(t)', wallX - 18, baseY - 52);
    }

    // Spring (top) & Damper (bottom)
    drawSpring(c, wallX, baseY - 16, massX - 24, baseY - 16, 7, 7, COL_FG);
    drawDamper(c, wallX, baseY + 18, massX - 24, baseY + 18, COL_BLUE);

    // Mass block
    c.fillStyle = 'rgba(255,255,255,.09)';
    c.strokeStyle = acc; c.lineWidth = 2;
    c.fillRect(massX - 24, baseY - 30, 48, 60);
    c.strokeRect(massX - 24, baseY - 30, 48, 60);
    c.fillStyle = COL_FG; c.font = '600 13px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('m', massX, baseY + 4);
    c.textAlign = 'left';

    // Equilibrium dashed line
    c.save();
    c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(120, baseY - 52); c.lineTo(120, baseY + 52); c.stroke();
    c.restore();

    // External force arrow in forced mode
    if (st.mode === 'forced') {
      const fNow = st.F0 * Math.cos(st.omega * st.simT);
      drawArrow(c, massX + 24, baseY, massX + 24 + (fNow / Math.max(1, st.F0)) * 34, baseY, COL_WARN, 2, 'F');
    }

    // Live strip chart on right
    const sx = mechW + 18, sw = W - sx - 12, sy = 16, sh = H - 32;
    if (sw > 60) {
      c.strokeStyle = 'rgba(255,255,255,.1)'; c.strokeRect(sx, sy, sw, sh);
      c.strokeStyle = 'rgba(255,255,255,.16)';
      c.beginPath(); c.moveTo(sx, sy + sh / 2); c.lineTo(sx + sw, sy + sh / 2); c.stroke();

      if (st.trace.length > 1) {
        const maxAbs = Math.max(0.15, ...st.trace.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
        const tEnd = st.trace[st.trace.length - 1].t;
        const win = 6.0;
        const tStart = Math.max(0, tEnd - win);

        if (st.mode === 'base') {
          c.strokeStyle = COL_WARN; c.lineWidth = 1.3; c.setLineDash([4, 3]); c.beginPath();
          st.trace.forEach((p, i) => {
            const px = sx + ((p.t - tStart) / win) * sw;
            const py = sy + sh / 2 - (p.y / (maxAbs * 1.15)) * (sh * 0.45);
            if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
          });
          c.stroke(); c.setLineDash([]);
        }

        c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
        st.trace.forEach((p, i) => {
          const px = sx + ((p.t - tStart) / win) * sw;
          const py = sy + sh / 2 - (p.x / (maxAbs * 1.15)) * (sh * 0.45);
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        });
        c.stroke();
      }
      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace';
      c.fillText(`x(t) = ${fmtFix(st.x, 3)} m`, sx + 8, sy + 14);
    }
    tnow.textContent = `t = ${st.simT.toFixed(2)} s`;
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const sub = 6, h = dt / sub;
    let s = [st.x, st.v];
    for (let i = 0; i < sub; i++) {
      s = sdofStep(st, s, st.simT, h);
      st.simT += h;
    }
    st.x = Math.max(-2.5, Math.min(2.5, s[0]));
    st.v = Math.max(-40, Math.min(40, s[1]));
    const yNow = st.mode === 'base' ? st.Y0 * Math.cos(st.omega * st.simT) : 0;
    st.trace.push({ t: st.simT, x: st.x, y: yNow });
    while (st.trace.length > 420 && st.simT - st.trace[0].t > 6.5) st.trace.shift();
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sX0.setVisible(st.mode === 'free');
    sF0.setVisible(st.mode === 'forced');
    sY0.setVisible(st.mode === 'base');
    sW.setVisible(st.mode !== 'free');
  }

  function onParam() {
    updateKPIsAndPlots();
    if (isMotionOff()) resetSim();
    else mainCv.render();
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', resetSim);
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); resetSim(); updateKPIsAndPlots(); syncSegments(host, false);
  });
  bindPresets(host, SDOF_PRESETS, p => {
    Object.assign(st, p);
    sM.set(st.m); sK.set(st.k); sC.set(st.c); sX0.set(st.x0); sF0.set(st.F0); sY0.set(st.Y0); sW.set(st.omega);
    syncMode(); resetSim(); updateKPIsAndPlots();
  });

  attachReadout(cfrf, host.querySelector('[data-rfrf]'), (x, ser, i) => `r=${fmtFix(x, 2)} · M=${fmtFix(ser[0].ys[i], 2)} · TR=${fmtFix(ser[1].ys[i], 2)}`, clean);
  attachReadout(cph, host.querySelector('[data-rph]'), (x, ser, i) => `r=${fmtFix(x, 2)} · φ=${fmtFix(ser[0].ys[i], 1)}°`, clean);
  observeResize(host.querySelector('[data-bfrf]'), updateKPIsAndPlots, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  resetSim();
  updateKPIsAndPlots();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 3. İKİ SERBESTLİK DERECELİ SİSTEM & TİTREŞİM YUTUCU (2-DOF & TMD)
// =====================================================================

const TWODOF_PRESETS = [
  { label: 'Simetrik Modlar (1:1)', mode: 'modal', m1: 2, m2: 2, k1: 80, k2: 80, k3: 80, c1: 0, c2: 0, omega: 6.32, F0: 15, modalView: 'mode1' },
  { label: 'Frahm Yutucu (Anti-Rezonans)', mode: 'tmd', m1: 10, m2: 1.0, k1: 1000, k2: 100, k3: 0, c1: 1.5, c2: 0.1, omega: 10.0, F0: 30, modalView: 'forced' },
  { label: 'Den Hartog Optimal TMD', mode: 'tmd', m1: 10, m2: 1.0, k1: 1000, k2: 82.6, k3: 0, c1: 1.5, c2: 3.36, omega: 10.0, F0: 30, modalView: 'forced' },
  { label: 'Zayıf Kuplaj (Vuru / Beat)', mode: 'free', m1: 2, m2: 2, k1: 100, k2: 12, k3: 100, c1: 0, c2: 0, omega: 7.0, F0: 15, modalView: 'free' },
];

function mountTwoDof(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'tmd', m1: 10, m2: 1.0, k1: 1000, k2: 100, k3: 0, c1: 1.5, c2: 0.2,
    omega: 10.0, F0: 30, modalView: 'mode1',
    playing: autoPlayAllowed(), simT: 0, y: [0, 0, 0, 0],
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('İki kütleli sistemin <b>doğal frekanslarını ($\\omega_1, \\omega_2$)</b> ve <b>mod şekillerini</b> canlı izle; <b>ayarlı kütle titreşim yutucusu (TMD)</b> ile rezonansı söndür.', TWODOF_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="2-DOF modları">
          <button type="button" data-m="modal">Mod Şekilleri</button>
          <button type="button" data-m="tmd" class="on">Titreşim Yutucu (TMD)</button>
          <button type="button" data-m="free">Serbest / Vuru</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
      <div class="slm-toolbar-g">
        <div class="seg" data-mview hidden role="tablist" aria-label="Mod seçimi">
          <button type="button" data-mv="mode1" class="on">Mod 1 (Aynı Faz)</button>
          <button type="button" data-mv="mode2">Mod 2 (Zıt Faz)</button>
        </div>
        <button type="button" class="btn small" data-opt-tmd>Den Hartog Optimum TMD</button>
      </div>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">İki Kütleli Sistem Animasyonu</h4><span class="slm-hint mono" data-minfo></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="İki serbestlik dereceli kütle yay sistemi"></canvas></div>
        </div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Ana Kütle Frekans Yanıtı |X₁(ω)| — Yutuculu vs Yutucusuz</h4>
            <div class="slm-legend">
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>|X₁| (TMD ile)</span>
              <span class="slm-legend-item"><i class="slm-legend-swatch slm-legend-dash" style="border-color:${COL_BAD}"></i>|X₁| (Yutucusuz)</span>
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BLUE}"></i>|X₂| (Yutucu)</span>
            </div>
          </div>
          <div class="slm-cv-box" data-bfrf><canvas class="slm-cv" data-cfrf aria-label="2-DOF frekans yanıtı grafiği"></canvas><div class="slm-readout" data-rfrf></div></div>
          <div class="slm-axis-lbl">Uyarma frekansı ω (rad/s)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathbf{M}\\ddot{\\mathbf{x}} + \\mathbf{C}\\dot{\\mathbf{x}} + \\mathbf{K}\\mathbf{x} = \\mathbf{F}(t), \\qquad \\det(\\mathbf{K} - \\omega^2\\mathbf{M}) = 0',
        '\\text{Den Hartog Optimal TMD: } \\frac{\\omega_a}{\\omega_1} = \\frac{1}{1+\\mu}, \\quad \\zeta_{\\text{opt}} = \\sqrt{\\frac{3\\mu}{8(1+\\mu)}}, \\quad \\mu = \\frac{m_2}{m_1}',
      ],
      paragraphs: [
        'İki serbestlik dereceli sistemin iki özfrekansı ($\\omega_1 < \\omega_2$) vardır: **1. modda** kütleler aynı fazda, **2. modda** zıt fazda salınır.',
        '**Ayarlı kütle yutucusu (TMD)**, $\\omega_a = \\sqrt{k_2/m_2}$ frekansında ana kütlede bir **anti-rezonans çukuru** ($|X_1| \\to 0$) oluşturur; Den Hartog sönüm optimizasyonu ise iki yan tepeyi eşitleyerek geniş bantlı bastırma sağlar.',
      ],
      tasks: [
        '**Simetrik Modlar** senaryosunda Mod 1 ve Mod 2’yi karşılaştırıp $\\omega_2 / \\omega_1 = \\sqrt{3}$ oranını doğrulayın.',
        '**Frahm Yutucu** senaryosunda $\\omega = 10\\text{ rad/s}$ iken $m_1$’in neredeyse tamamen durduğunu gözlemleyin.',
        '**Den Hartog Optimum TMD** düğmesine basıp iki rezonans tepesinin eşitlendiğini FRF grafiğinde inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const mview = host.querySelector('[data-mview]');
  const optBtn = host.querySelector('[data-opt-tmd]');
  const minfo = host.querySelector('[data-minfo]');
  const cv = host.querySelector('[data-cv]');
  const cfrf = host.querySelector('[data-cfrf]');

  const sM1 = addSlider(ctrls, { label: 'Ana Kütle m₁', unit: 'kg', min: 1, max: 20, value: st.m1, step: 0.5, onInput: v => { st.m1 = v; onParam(); } });
  const sK1 = addSlider(ctrls, { label: 'Ana Yay k₁', unit: 'N/m', min: 20, max: 2000, value: st.k1, step: 10, onInput: v => { st.k1 = v; onParam(); } });
  const sM2 = addSlider(ctrls, { label: 'Kütle m₂ (TMD)', unit: 'kg', min: 0.2, max: 10, value: st.m2, step: 0.1, onInput: v => { st.m2 = v; onParam(); } });
  const sK2 = addSlider(ctrls, { label: 'Yay k₂ (TMD)', unit: 'N/m', min: 5, max: 500, value: st.k2, step: 1, onInput: v => { st.k2 = v; onParam(); } });
  const sK3 = addSlider(ctrls, { label: 'Sağ Yay k₃', unit: 'N/m', min: 0, max: 300, value: st.k3, step: 5, onInput: v => { st.k3 = v; onParam(); } });
  const sC2 = addSlider(ctrls, { label: 'TMD Sönümü c₂', unit: 'N·s/m', min: 0, max: 20, value: st.c2, step: 0.1, onInput: v => { st.c2 = v; onParam(); } });
  const sW = addSlider(ctrls, { label: 'Uyarma ω', unit: 'rad/s', min: 1, max: 25, value: st.omega, step: 0.1, onInput: v => { st.omega = v; onParam(); } });

  function resetSim() {
    st.simT = 0;
    st.y = st.mode === 'free' ? [0.22, 0, 0, 0] : [0, 0, 0, 0];
    mainCv.render();
  }

  function updateKPIsAndPlot() {
    const mod = twoDofModal(st);
    const cur = twoDofFRF(st, st.omega);
    const redPct = cur.magNoAbs > 1e-9 ? (1 - cur.mag1 / cur.magNoAbs) * 100 : 0;

    renderKpis(kpis, [
      { lbl: '1. Doğal Frekans ω₁', val: `${fmtFix(mod.w1, 2)} rad/s`, sub: `Mod 1: [${fmtFix(mod.mode1[0], 2)}, ${fmtFix(mod.mode1[1], 2)}]` },
      { lbl: '2. Doğal Frekans ω₂', val: `${fmtFix(mod.w2, 2)} rad/s`, sub: `Mod 2: [${fmtFix(mod.mode2[0], 2)}, ${fmtFix(mod.mode2[1], 2)}]` },
      { lbl: 'Anti-Rezonans ωₐ', val: `${fmtFix(mod.wAbsorber, 2)} rad/s`, sub: `Kütle oranı μ = ${fmtFix(mod.mu, 2)}`, tone: 'acc' },
      { lbl: '|X₁(ω)| Genliği', val: `${fmtFix(cur.mag1 * 1000, 1)} mm`, sub: redPct > 0 ? `%${fmtFix(redPct, 0)} azalma` : 'Büyütme bölgesi', tone: redPct > 35 ? 'ok' : redPct < -10 ? 'bad' : '' },
    ]);

    const wMax = Math.max(mod.w2 * 1.65, st.omega * 1.25, 16);
    const ws = [], x1 = [], x1No = [], x2 = [];
    const cap = (st.F0 / Math.max(1, st.k1)) * 12;
    for (let i = 0; i <= 220; i++) {
      const w = 0.2 + ((wMax - 0.2) * i) / 220;
      const f = twoDofFRF(st, w);
      ws.push(w);
      x1.push(Math.min(f.mag1, cap) * 1000);
      x1No.push(Math.min(f.magNoAbs, cap) * 1000);
      x2.push(Math.min(f.mag2, cap) * 1000);
    }
    safePlot(cfrf, [
      { name: '|X₁| TMD', color: COL_OK, xs: ws, ys: x1 },
      { name: '|X₁| Yok', color: COL_BAD, xs: ws, ys: x1No },
      { name: '|X₂|', color: COL_BLUE, xs: ws, ys: x2 },
      { name: 'ω', color: accentColor(), xs: [st.omega, st.omega], ys: [0, cap * 900] },
    ], { x0: 0.2, x1: wMax, ylabel: 'mm', height: 195 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(220, Math.max(175, w * 0.34)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const mod = twoDofModal(st);
    const acc = accentColor();
    let d1 = 0, d2 = 0;
    if (st.mode === 'modal') {
      const isM1 = st.modalView === 'mode1';
      const w = isM1 ? mod.w1 : mod.w2;
      const ph = Math.cos(w * st.simT);
      const shp = isM1 ? mod.mode1 : mod.mode2;
      d1 = shp[0] * ph * 34;
      d2 = shp[1] * ph * 34;
      minfo.textContent = `${isM1 ? 'Mod 1' : 'Mod 2'} · ω = ${fmtFix(w, 2)} rad/s`;
    } else if (st.mode === 'tmd') {
      // Steady-state harmonic display for instant visual clarity + responsive slider feedback
      const frf = twoDofFRF(st, st.omega);
      const ref = Math.max(frf.mag1, frf.mag2, st.F0 / st.k1, 1e-4);
      const sc = 36 / ref;
      d1 = Math.max(-42, Math.min(42, frf.mag1 * Math.cos(st.omega * st.simT + frf.phase1 * RAD) * sc));
      d2 = Math.max(-42, Math.min(42, frf.mag2 * Math.cos(st.omega * st.simT + frf.phase2 * RAD) * sc));
      minfo.textContent = `ω = ${fmtFix(st.omega, 2)} rad/s · |X₁| = ${fmtFix(frf.mag1 * 1000, 1)} mm`;
    } else {
      d1 = Math.max(-44, Math.min(44, st.y[0] * 170));
      d2 = Math.max(-44, Math.min(44, st.y[2] * 170));
      minfo.textContent = `t = ${st.simT.toFixed(2)} s (Serbest / Vuru)`;
    }

    const cy = H * 0.54;
    const xWallL = 26;
    const xWallR = W - 26;
    const eq1 = W * 0.36;
    const eq2 = W * 0.68;
    const x1 = eq1 + d1;
    const x2 = eq2 + d2;
    const w1 = 54, w2 = st.mode === 'tmd' ? 40 : 54;

    drawGroundHatch(c, xWallL, cy - 42, xWallL, cy + 42, -1);
    if (st.k3 > 0) drawGroundHatch(c, xWallR, cy - 42, xWallR, cy + 42, 1);

    // Springs & dampers
    drawSpring(c, xWallL, cy - (st.c1 > 0 ? 12 : 0), x1 - w1 / 2, cy - (st.c1 > 0 ? 12 : 0), 7, 7, COL_FG);
    if (st.c1 > 0) drawDamper(c, xWallL, cy + 16, x1 - w1 / 2, cy + 16, COL_BLUE);

    drawSpring(c, x1 + w1 / 2, cy - (st.c2 > 0 ? 12 : 0), x2 - w2 / 2, cy - (st.c2 > 0 ? 12 : 0), 7, 7, COL_OK);
    if (st.c2 > 0) drawDamper(c, x1 + w1 / 2, cy + 16, x2 - w2 / 2, cy + 16, COL_BLUE);

    if (st.k3 > 0) drawSpring(c, x2 + w2 / 2, cy, xWallR, cy, 7, 7, COL_FG);

    // Equilibrium guides
    c.save(); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255,255,255,.16)';
    c.beginPath(); c.moveTo(eq1, cy - 52); c.lineTo(eq1, cy + 52); c.moveTo(eq2, cy - 52); c.lineTo(eq2, cy + 52); c.stroke();
    c.restore();

    // Mass 1
    c.fillStyle = 'rgba(255,255,255,.08)'; c.strokeStyle = acc; c.lineWidth = 2;
    c.fillRect(x1 - w1 / 2, cy - 28, w1, 56); c.strokeRect(x1 - w1 / 2, cy - 28, w1, 56);
    c.fillStyle = COL_FG; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('m₁', x1, cy + 4);

    // Mass 2
    c.fillStyle = 'rgba(90,176,255,.12)'; c.strokeStyle = COL_BLUE; c.lineWidth = 2;
    c.fillRect(x2 - w2 / 2, cy - 24, w2, 48); c.strokeRect(x2 - w2 / 2, cy - 24, w2, 48);
    c.fillStyle = COL_FG; c.fillText('m₂', x2, cy + 4);
    c.textAlign = 'left';

    if (st.mode === 'tmd') {
      const fNow = Math.cos(st.omega * st.simT);
      drawArrow(c, x1, cy - 42, x1 + fNow * 28, cy - 42, COL_WARN, 2, 'F(t)');
    }
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    if (st.mode === 'free') {
      const sub = 6, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        st.y = twoDofStep({ ...st, F0: 0 }, st.y, st.simT, h);
        st.simT += h;
      }
    } else {
      st.simT += dt;
    }
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    mview.hidden = st.mode !== 'modal';
    optBtn.hidden = st.mode !== 'tmd';
    sW.setVisible(st.mode === 'tmd');
    sC2.setVisible(st.mode === 'tmd');
  }

  function onParam() { updateKPIsAndPlot(); mainCv.render(); }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', resetSim);
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); resetSim(); updateKPIsAndPlot(); syncSegments(host, false);
  });
  mview.addEventListener('click', e => {
    const b = e.target.closest('[data-mv]'); if (!b) return;
    st.modalView = b.dataset.mv;
    mview.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    mainCv.render(); syncSegments(host, false);
  });
  optBtn.addEventListener('click', () => {
    const dh = denHartogTMD(st.m1, st.k1, st.m2 / st.m1);
    st.k2 = +dh.k2.toFixed(1); st.c2 = +dh.c2.toFixed(2); st.k3 = 0;
    sK2.set(st.k2); sC2.set(st.c2); sK3.set(0);
    onParam();
  });
  bindPresets(host, TWODOF_PRESETS, p => {
    Object.assign(st, p);
    sM1.set(st.m1); sK1.set(st.k1); sM2.set(st.m2); sK2.set(st.k2); sK3.set(st.k3); sC2.set(st.c2); sW.set(st.omega);
    mview.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.mv === st.modalView));
    syncMode(); resetSim(); updateKPIsAndPlot();
  });

  attachReadout(cfrf, host.querySelector('[data-rfrf]'), (x, ser, i) => `ω=${fmtFix(x, 2)} · |X₁|=${fmtFix(ser[0].ys[i], 1)}mm · Yok=${fmtFix(ser[1].ys[i], 1)}mm`, clean);
  observeResize(host.querySelector('[data-bfrf]'), updateKPIsAndPlot, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  resetSim();
  updateKPIsAndPlot();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 4. RİJİT CİSİM ÇARPIŞMASI & EĞİK DÜZLEMDE YUVARLANMA YARIŞI
// =====================================================================

const RIGID_PRESETS = [
  { label: 'Tam Esnek (e = 1)', mode: 'collision', m1: 2, m2: 2, v1: 5.5, v2: -2.0, offset: 0, e: 1.0 },
  { label: 'Eğik Çarpışma (e = 0.8)', mode: 'collision', m1: 3, m2: 1.5, v1: 6.0, v2: 0, offset: 0.42, e: 0.8 },
  { label: 'Tam Esnek Olmayan (e = 0)', mode: 'collision', m1: 3, m2: 2, v1: 6.0, v2: -1.5, offset: 0, e: 0.0 },
  { label: 'Yuvarlanma Yarışı (25°)', mode: 'incline', thetaDeg: 25, L: 12, muS: 0.6 },
  { label: 'Düşük Sürtünme (Kayma)', mode: 'incline', thetaDeg: 35, L: 12, muS: 0.14 },
];

function mountRigidCollision(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'collision',
    m1: 3, m2: 1.5, v1: 6.0, v2: 0, offset: 0.42, e: 0.8,
    thetaDeg: 25, L: 12, muS: 0.6,
    playing: autoPlayAllowed(), simT: 0, collided: false,
    b1: null, b2: null, initStats: null,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('2D rijit disk çarpışmalarında <b>çarpışma katsayısı ($e$)</b>, <b>momentum</b> ve <b>enerji korunumunu</b> ölç; eğik düzlemde küre, disk ve halka <b>yuvarlanma yarışını</b> canlı izle.', RIGID_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-mode role="tablist" aria-label="Rijit cisim modları">
          <button type="button" data-m="collision" class="on">2D Çarpışma</button>
          <button type="button" data-m="incline">Yuvarlanma Yarışı</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Tekrar Başlat</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-status></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>2D Rijit Cisim Çarpışması</h4><span class="slm-hint" data-cvhint>Top 1'in hız okunu sürükleyerek nişan al</span></div>
          <div class="slm-cv-box"><canvas class="slm-cv slm-cv-drag" data-cv aria-label="Rijit cisim çarpışma ve yuvarlanma animasyonu"></canvas></div>
        </div>
        <div class="slm-table-wrap" data-tblwrap hidden>
          <table class="slm-tbl" aria-label="Yuvarlanma yarışı karşılaştırma tablosu">
            <thead><tr><th>Cisim</th><th>Atalet I</th><th>İvme a</th><th>Süre t</th><th>Son Hız v</th><th>Kayma?</th></tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\vec{p} = m_1\\vec{v}_1 + m_2\\vec{v}_2 = \\text{sabit}, \\qquad e = -\\frac{(\\vec{v}_2\' - \\vec{v}_1\')\\cdot\\hat{n}}{(\\vec{v}_2 - \\vec{v}_1)\\cdot\\hat{n}}',
        'a = \\frac{g\\sin\\theta}{1 + c_I} \\quad (I = c_I m R^2), \\qquad \\mu_{s,\\min} = \\frac{c_I}{1 + c_I}\\tan\\theta',
      ],
      paragraphs: [
        'Dış kuvvet yoksa çizgisel momentum $\\vec{p}$ her $e \\in [0, 1]$ için **tam korunur**; kinetik enerji ise yalnızca $e = 1$ (tam esnek) çarpışmada korunur.',
        'Eğik düzlemde kaymadan yuvarlanmada kütle ve yarıçap iptal olur: ivme yalnızca **şekil katsayısı $c_I$**’ye bağlıdır ($c_I$: küre $2/5$, disk $1/2$, boş küre $2/3$, halka $1$).',
      ],
      tasks: [
        '$e = 1$ ve $e = 0$ arasında geçiş yaparak toplam momentumun değişmediğini ama enerji kaybının $e = 0$’da tepe yaptığını doğrulayın.',
        '**Yuvarlanma Yarışı**nda dolu küre, disk ve halkanın bitiş sürelerini kıyaslayın; kütle değişse de sıralamanın neden değişmediğini açıklayın.',
        'Sürtünme katsayısını $\\mu_s = 0.14$’e düşürüp hangi cisimlerin **kaymaya** başladığını tabloda inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const statusEl = host.querySelector('[data-status]');
  const playBtn = host.querySelector('[data-play]');
  const tblWrap = host.querySelector('[data-tblwrap]');
  const tbody = host.querySelector('[data-tbody]');
  const cv = host.querySelector('[data-cv]');

  const sM1 = addSlider(ctrls, { label: 'Kütle m₁', unit: 'kg', min: 0.5, max: 8, value: st.m1, step: 0.5, onInput: v => { st.m1 = v; resetSim(); } });
  const sM2 = addSlider(ctrls, { label: 'Kütle m₂', unit: 'kg', min: 0.5, max: 8, value: st.m2, step: 0.5, onInput: v => { st.m2 = v; resetSim(); } });
  const sV1 = addSlider(ctrls, { label: 'Başlangıç Hızı v₁', unit: 'm/s', min: 1, max: 10, value: st.v1, step: 0.2, onInput: v => { st.v1 = v; resetSim(); } });
  const sV2 = addSlider(ctrls, { label: 'Başlangıç Hızı v₂', unit: 'm/s', min: -6, max: 4, value: st.v2, step: 0.2, onInput: v => { st.v2 = v; resetSim(); } });
  const sOff = addSlider(ctrls, { label: 'Eğik Çarpma Kaçıklığı', unit: 'R', min: -1.4, max: 1.4, value: st.offset, step: 0.05, onInput: v => { st.offset = v; resetSim(); } });
  const sE = addSlider(ctrls, { label: 'Çarpışma Katsayısı e', min: 0, max: 1, value: st.e, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.e = v; resetSim(); } });

  const sTh = addSlider(ctrls, { label: 'Eğim Açısı θ', unit: '°', min: 8, max: 50, value: st.thetaDeg, step: 1, fmt: v => `${v.toFixed(0)}°`, onInput: v => { st.thetaDeg = v; resetSim(); } });
  const sLen = addSlider(ctrls, { label: 'Yol Uzunluğu L', unit: 'm', min: 5, max: 25, value: st.L, step: 1, onInput: v => { st.L = v; resetSim(); } });
  const sMu = addSlider(ctrls, { label: 'Statik Sürtünme μₛ', min: 0.05, max: 0.9, value: st.muS, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.muS = v; resetSim(); } });

  function resetSim() {
    st.simT = 0;
    st.collided = false;
    const r1 = 0.35 + 0.05 * Math.cbrt(st.m1);
    const r2 = 0.35 + 0.05 * Math.cbrt(st.m2);
    st.b1 = { x: -2.4, y: st.offset * (r1 + r2) * 0.5, vx: st.v1, vy: 0, m: st.m1, r: r1 };
    st.b2 = { x: 1.4, y: 0, vx: st.v2, vy: 0, m: st.m2, r: r2 };
    st.initStats = bodiesMomentumEnergy([st.b1, st.b2]);
    updateReadouts();
    mainCv.render();
  }

  function updateReadouts() {
    if (st.mode === 'collision') {
      const cur = bodiesMomentumEnergy([st.b1, st.b2]);
      const dE = st.initStats.ke > 1e-9 ? ((cur.ke - st.initStats.ke) / st.initStats.ke) * 100 : 0;
      const dP = Math.abs(cur.pMag - st.initStats.pMag);
      statusEl.textContent = st.collided ? 'Çarpışma gerçekleşti' : 'Çarpışma bekleniyor';
      statusEl.className = `slm-badge ${st.collided ? 'slm-badge-ok' : 'slm-badge-acc'}`;
      renderKpis(kpis, [
        { lbl: 'Toplam Momentum |p|', val: `${fmtFix(cur.pMag, 2)} kg·m/s`, sub: `Δ|p| = ${fmtFix(dP, 4)} (Korunur)`, tone: 'ok' },
        { lbl: 'Kinetik Enerji Ek', val: `${fmtFix(cur.ke, 2)} J`, sub: `İlk: ${fmtFix(st.initStats.ke, 2)} J (${fmtFix(dE, 1)}%)`, tone: Math.abs(dE) < 0.5 ? 'ok' : 'warn' },
        { lbl: 'Top 1 Hızı |v₁|', val: `${fmtFix(Math.hypot(st.b1.vx, st.b1.vy), 2)} m/s`, sub: `(${fmtFix(st.b1.vx, 1)}, ${fmtFix(st.b1.vy, 1)})` },
        { lbl: 'Top 2 Hızı |v₂|', val: `${fmtFix(Math.hypot(st.b2.vx, st.b2.vy), 2)} m/s`, sub: `(${fmtFix(st.b2.vx, 1)}, ${fmtFix(st.b2.vy, 1)})` },
      ]);
    } else {
      const rows = ROLLING_SHAPES.map(sh => ({ ...sh, res: rollingIncline(sh.cI, { thetaDeg: st.thetaDeg, L: st.L, muS: st.muS }) }));
      const sph = rows[1].res, rng = rows[4].res;
      statusEl.textContent = rows.some(r => r.res.slipping) ? 'Kayma mevcut!' : 'Kaymadan yuvarlanma';
      statusEl.className = `slm-badge ${rows.some(r => r.res.slipping) ? 'slm-badge-warn' : 'slm-badge-ok'}`;
      renderKpis(kpis, [
        { lbl: 'Dolu Küre Süresi', val: `${fmtFix(sph.tEnd, 2)} s`, sub: `a = ${fmtFix(sph.a, 2)} m/s²`, tone: 'ok' },
        { lbl: 'İnce Halka Süresi', val: `${fmtFix(rng.tEnd, 2)} s`, sub: `a = ${fmtFix(rng.a, 2)} m/s²` },
        { lbl: 'Küre / Halka Farkı', val: `%${fmtFix(((rng.tEnd - sph.tEnd) / sph.tEnd) * 100, 1)}`, sub: 'Küre daima önde', tone: 'acc' },
        { lbl: 'Halka için μ_min', val: fmtFix(rng.muReq, 2), sub: `Mevcut μₛ = ${fmtFix(st.muS, 2)}` },
      ]);
      tbody.innerHTML = rows.map(r => `<tr>
        <td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${r.color};margin-right:6px"></span>${esc(r.label)}</td>
        <td class="mono">${esc(r.formula)}</td>
        <td class="mono">${fmtFix(r.res.a, 2)} m/s²</td>
        <td class="mono">${fmtFix(r.res.tEnd, 2)} s</td>
        <td class="mono">${fmtFix(r.res.vEnd, 2)} m/s</td>
        <td><span class="slm-badge ${r.res.slipping ? 'slm-badge-warn' : 'slm-badge-ok'}">${r.res.slipping ? 'Kayıyor' : 'Yuvarlanıyor'}</span></td>
      </tr>`).join('');
    }
  }

  let worldScale = 45, cx0 = 200, cy0 = 140;
  const mainCv = setupCanvas(cv, w => Math.min(310, Math.max(220, w * 0.5)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!st.b1) return; // setupCanvas draws once before resetSim() has built the bodies
    if (st.mode === 'collision') {
      worldScale = Math.min(W / 10, H / 5.4);
      cx0 = W * 0.5; cy0 = H * 0.5;
      // Arena grid
      c.strokeStyle = COL_GRID; c.lineWidth = 1;
      for (let x = cx0 % worldScale; x < W; x += worldScale) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = cy0 % worldScale; y < H; y += worldScale) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

      const drawBall = (b, col, lbl) => {
        const sx = cx0 + b.x * worldScale, sy = cy0 - b.y * worldScale, sr = b.r * worldScale;
        c.fillStyle = `${col}28`; c.strokeStyle = col; c.lineWidth = 2.2;
        c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = COL_FG; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${lbl} (${b.m}kg)`, sx, sy + 4);
        c.textAlign = 'left';
        drawArrow(c, sx, sy, sx + b.vx * worldScale * 0.25, sy - b.vy * worldScale * 0.25, col, 2.2);
      };
      drawBall(st.b1, COL_BLUE, '1');
      drawBall(st.b2, COL_OK, '2');
    } else {
      // Rolling race down 5 parallel lanes along incline
      const th = st.thetaDeg * RAD;
      const padL = 34, padR = 34;
      const runPx = Math.min(W - padL - padR, (H - 64) / Math.max(0.2, Math.tan(th)));
      const dropPx = runPx * Math.tan(th);
      const x0 = (W - runPx) * 0.5;
      const y0 = (H - dropPx) * 0.5 - 12;
      const x1 = x0 + runPx, y1 = y0 + dropPx;
      const lenPx = Math.hypot(runPx, dropPx);
      const ux = (x1 - x0) / lenPx, uy = (y1 - y0) / lenPx;
      const nx = uy, ny = -ux; // upward normal

      // Incline wedge
      c.fillStyle = 'rgba(255,255,255,.04)'; c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x0, y1); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace';
      c.fillText(`θ = ${st.thetaDeg}° · L = ${st.L} m`, x0 + 10, y1 - 8);

      const Rpx = 12;
      ROLLING_SHAPES.forEach((sh, idx) => {
        const res = rollingIncline(sh.cI, { thetaDeg: st.thetaDeg, L: st.L, muS: st.muS });
        const tClamped = Math.min(st.simT, res.tEnd);
        const sPos = Math.min(st.L, 0.5 * res.a * tClamped * tClamped);
        const frac = sPos / st.L;
        const laneOff = (idx - 2) * 0; // stack vertically with slight offset or label badges!
        const cx = x0 + ux * frac * lenPx + nx * (Rpx + 2 + idx * 24 - 10);
        const cy = y0 + uy * frac * lenPx + ny * (Rpx + 2 + idx * 24 - 10);
        void laneOff;
        // Faint track guide per racer
        c.strokeStyle = `${sh.color}30`; c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x0 + nx * (2 + idx * 24 - 10), y0 + ny * (2 + idx * 24 - 10));
        c.lineTo(x1 + nx * (2 + idx * 24 - 10), y1 + ny * (2 + idx * 24 - 10));
        c.stroke();

        const rot = 0.5 * res.alpha * tClamped * tClamped;
        c.save();
        c.translate(cx, cy);
        c.strokeStyle = sh.color; c.fillStyle = `${sh.color}2a`; c.lineWidth = 2;
        if (sh.cI === 0) {
          c.rotate(th);
          c.fillRect(-Rpx, -Rpx * 0.75, Rpx * 2, Rpx * 1.5);
          c.strokeRect(-Rpx, -Rpx * 0.75, Rpx * 2, Rpx * 1.5);
        } else {
          c.rotate(rot);
          c.beginPath(); c.arc(0, 0, Rpx, 0, Math.PI * 2);
          if (sh.id !== 'ring') c.fill();
          c.stroke();
          if (sh.id === 'hollow') { c.beginPath(); c.arc(0, 0, Rpx * 0.65, 0, Math.PI * 2); c.stroke(); }
          c.beginPath(); c.moveTo(-Rpx, 0); c.lineTo(Rpx, 0); c.moveTo(0, -Rpx); c.lineTo(0, Rpx); c.stroke();
        }
        c.restore();
      });

      // Legend at top-right
      ROLLING_SHAPES.forEach((sh, idx) => {
        c.fillStyle = sh.color; c.font = '600 10.5px "JetBrains Mono", monospace';
        c.fillText(`● ${sh.label}`, W - 146, 18 + idx * 15);
      });
    }
  }, clean);

  // Drag ball 1 aim vector in collision mode
  bindDragCanvas(cv, {
    onDown(p) {
      if (st.mode !== 'collision') return false;
      const sx = cx0 + st.b1.x * worldScale, sy = cy0 - st.b1.y * worldScale;
      return Math.hypot(p.x - sx, p.y - sy) < 60;
    },
    onMove(p, dragging) {
      if (!dragging || st.mode !== 'collision') return;
      const wy = (cy0 - p.y) / worldScale;
      st.offset = Math.max(-1.4, Math.min(1.4, +(wy / Math.max(0.4, st.b1.r + st.b2.r) * 2).toFixed(2)));
      sOff.set(st.offset);
      resetSim();
    },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    if (st.mode === 'collision') {
      const sub = 6, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        st.b1.x += st.b1.vx * h; st.b1.y += st.b1.vy * h;
        st.b2.x += st.b2.vx * h; st.b2.y += st.b2.vy * h;
        const col = collide2DBodies(st.b1, st.b2, st.e);
        if (col.collided) { st.b1 = col.b1; st.b2 = col.b2; st.collided = true; updateReadouts(); }
      }
      st.simT += dt;
      if (Math.abs(st.b1.x) > 5.5 && Math.abs(st.b2.x) > 5.5) resetSim();
    } else {
      st.simT += dt;
      const slowest = rollingIncline(1, { thetaDeg: st.thetaDeg, L: st.L, muS: st.muS }).tEnd;
      if (st.simT > slowest + 1.4) st.simT = 0;
    }
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isCol = st.mode === 'collision';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    [sM1, sM2, sV1, sV2, sOff, sE].forEach(s => s.setVisible(isCol));
    [sTh, sLen, sMu].forEach(s => s.setVisible(!isCol));
    tblWrap.hidden = isCol;
    host.querySelector('[data-cvtitle]').textContent = isCol ? '2D Rijit Cisim Çarpışması' : 'Eğik Düzlemde Yuvarlanma Yarışı';
    host.querySelector('[data-cvhint]').textContent = isCol ? 'Top 1’i dikey sürükleyerek çarpma kaçıklığını ayarla' : 'Aynı anda serbest bırakılan 5 cisim';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', resetSim);
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); resetSim(); syncSegments(host, false);
  });
  bindPresets(host, RIGID_PRESETS, p => {
    Object.assign(st, p);
    sM1.set(st.m1); sM2.set(st.m2); sV1.set(st.v1); sV2.set(st.v2); sOff.set(st.offset); sE.set(st.e);
    sTh.set(st.thetaDeg); sLen.set(st.L); sMu.set(st.muS);
    syncMode(); resetSim();
  });

  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  resetSim();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 5. DİŞLİ TAKIMI & KAM PROFİLİ (Gear Trains & Cam SVAJ)
// =====================================================================

const GEARCAM_PRESETS = [
  { label: 'Basit Redüktör (3:1)', mode: 'gear', gtype: 'simple', N1: 18, N2: 54, useIdler: false, rpmIn: 180, torqueIn: 10 },
  { label: 'Bileşik Dişli (12:1)', mode: 'gear', gtype: 'compound', N1: 16, N2: 48, N3: 15, N4: 60, rpmIn: 600, torqueIn: 10 },
  { label: 'Planet Dişli (Halka Sabit)', mode: 'gear', gtype: 'planetary', Ns: 20, Np: 14, fixed: 'ring', rpmIn: 240, torqueIn: 10 },
  { label: 'Sikloit Kam (Şoksuz)', mode: 'cam', law: 'cycloidal', lift: 24, baseR: 42, riseDeg: 120, dwellHiDeg: 60, returnDeg: 120, camOmega: 4 },
  { label: 'Harmonik Kam (SHM)', mode: 'cam', law: 'harmonic', lift: 24, baseR: 42, riseDeg: 120, dwellHiDeg: 60, returnDeg: 120, camOmega: 4 },
];

function mountGearCam(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'gear', gtype: 'planetary',
    N1: 18, N2: 45, N3: 16, N4: 48, useIdler: false, Nid: 24,
    Ns: 20, Np: 14, fixed: 'ring', rpmIn: 180, torqueIn: 12,
    law: 'cycloidal', lift: 24, baseR: 42, riseDeg: 120, dwellHiDeg: 60, returnDeg: 120, camOmega: 4,
    playing: autoPlayAllowed(), angle: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Basit, bileşik ve planet dişli</b> takımlarının devir/tork oranlarını canlı animasyonla hesapla; <b>kam profillerinin</b> yer değiştirme, hız ve ivme (SVAJ) diyagramlarını karşılaştır.', GEARCAM_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-mode role="tablist" aria-label="Dişli veya Kam">
          <button type="button" data-m="gear" class="on">Dişli Takımı</button>
          <button type="button" data-m="cam">Kam & SVAJ</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
      </div>
      <div class="seg slm-seg-wrap" data-gtype role="tablist" aria-label="Dişli türü">
        <button type="button" data-gt="simple">Basit</button>
        <button type="button" data-gt="compound">Bileşik</button>
        <button type="button" data-gt="planetary" class="on">Planet</button>
      </div>
      <div class="seg slm-seg-wrap" data-law hidden role="tablist" aria-label="Kam hareket yasası">
        <button type="button" data-lw="uniform">Düzgün Hızlı</button>
        <button type="button" data-lw="harmonic">Harmonik</button>
        <button type="button" data-lw="cycloidal" class="on">Sikloit</button>
        <button type="button" data-lw="poly345">3-4-5 Polinom</button>
      </div>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>Dişli Takımı Animasyonu</h4><span class="slm-hint mono" data-info></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Dişli ve kam mekanizma animasyonu"></canvas></div>
        </div>
        <div class="slm-grid-2" data-camplots hidden>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Yer Değiştirme s(θ) & Hız v(θ)</h4></div>
            <div class="slm-cv-box" data-bsv><canvas class="slm-cv" data-csv aria-label="Kam yer değiştirme ve hız grafiği"></canvas><div class="slm-readout" data-rsv></div></div>
            <div class="slm-axis-lbl">Kam açısı θ (°)</div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">İvme a(θ) & Basınç Açısı φ(θ)</h4></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-ca aria-label="Kam ivme grafiği"></canvas><div class="slm-readout" data-ra></div></div>
            <div class="slm-axis-lbl">Kam açısı θ (°)</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'i_{\\text{bileşik}} = \\frac{N_2}{N_1}\\cdot\\frac{N_4}{N_3}, \\qquad \\frac{\\omega_s - \\omega_c}{\\omega_r - \\omega_c} = -\\frac{N_r}{N_s} \\quad (N_r = N_s + 2N_p)',
        '\\text{Sikloit: } s(u) = h\\left(u - \\frac{\\sin(2\\pi u)}{2\\pi}\\right), \\quad \\tan\\phi = \\frac{ds/d\\theta}{R_b + R_r + s}',
      ],
      paragraphs: [
        '**Planet dişlide** (Willis denklemi) halka sabitlenirse $i = 1 + N_r/N_s$ ile yüksek redüksiyon ve aynı yönlü çıkış elde edilir; taşıyıcı sabitlenirse dönüş yönü tersine döner.',
        '**Düzgün hızlı kamda** kalkış ve duruş uçlarında sonsuz ivme (darbe) oluşur; **harmonikte** ivme sonludur ama sıçrama (sonsuz sarsım/jerk) yapar; **sikloit** ve **3-4-5 polinomda** uç ivmeler sıfır olduğundan yüksek hızlı mekanizmalarda titreşim en aza iner.',
      ],
      tasks: [
        'Basit dişlide **ara dişliyi (idler)** açıp kapatarak iletim oranının büyüklüğünün değişmediğini ama yönün terslendiğini gözlemleyin.',
        'Planet dişlide sabit elemanı **Halka → Güneş → Taşıyıcı** olarak değiştirip oran ve yön farklarını kıyaslayın.',
        'Kam modunda **Harmonik** ile **Sikloit** ivme diyagramlarını karşılaştırın ve $R_b$’yi küçülttüğünüzde basınç açısının $30^\\circ$’yi geçtiğini gözlemleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const alertEl = host.querySelector('[data-alert]');
  const playBtn = host.querySelector('[data-play]');
  const gtypeSeg = host.querySelector('[data-gtype]');
  const lawSeg = host.querySelector('[data-law]');
  const camPlots = host.querySelector('[data-camplots]');
  const infoEl = host.querySelector('[data-info]');
  const cv = host.querySelector('[data-cv]');
  const csv = host.querySelector('[data-csv]');
  const ca = host.querySelector('[data-ca]');

  // Gear controls
  const sN1 = addSlider(ctrls, { label: 'Giriş Dişli N₁', min: 10, max: 50, value: st.N1, step: 1, fmt: v => `${v} diş`, onInput: v => { st.N1 = v; onParam(); } });
  const sN2 = addSlider(ctrls, { label: 'Çıkış / 2. Dişli N₂', min: 12, max: 72, value: st.N2, step: 1, fmt: v => `${v} diş`, onInput: v => { st.N2 = v; onParam(); } });
  const sN3 = addSlider(ctrls, { label: 'Ara Mil Dişli N₃', min: 10, max: 45, value: st.N3, step: 1, fmt: v => `${v} diş`, onInput: v => { st.N3 = v; onParam(); } });
  const sN4 = addSlider(ctrls, { label: 'Son Dişli N₄', min: 14, max: 72, value: st.N4, step: 1, fmt: v => `${v} diş`, onInput: v => { st.N4 = v; onParam(); } });
  const tIdler = addToggle(ctrls, 'Ara Dişli (Idler) Ekle', st.useIdler, v => { st.useIdler = v; onParam(); });
  const sNs = addSlider(ctrls, { label: 'Güneş Dişli Nₛ', min: 12, max: 36, value: st.Ns, step: 2, fmt: v => `${v} diş`, onInput: v => { st.Ns = v; onParam(); } });
  const sNp = addSlider(ctrls, { label: 'Gezegen Dişli Nₚ', min: 10, max: 26, value: st.Np, step: 1, fmt: v => `${v} diş`, onInput: v => { st.Np = v; onParam(); } });
  const selFixed = addSelect(ctrls, 'Sabit Eleman', [['ring', 'Halka (Ring) Sabit'], ['sun', 'Güneş (Sun) Sabit'], ['carrier', 'Taşıyıcı (Carrier) Sabit']], st.fixed, v => { st.fixed = v; onParam(); });
  const sRpm = addSlider(ctrls, { label: 'Giriş Devri', unit: 'RPM', min: 30, max: 600, value: st.rpmIn, step: 10, onInput: v => { st.rpmIn = v; onParam(); } });
  const sTrq = addSlider(ctrls, { label: 'Giriş Torku', unit: 'N·m', min: 2, max: 80, value: st.torqueIn, step: 1, onInput: v => { st.torqueIn = v; onParam(); } });

  // Cam controls
  const sLift = addSlider(ctrls, { label: 'Kurs (Lift) h', unit: 'mm', min: 8, max: 45, value: st.lift, step: 1, onInput: v => { st.lift = v; onParam(); } });
  const sRb = addSlider(ctrls, { label: 'Temel Daire R_b', unit: 'mm', min: 20, max: 70, value: st.baseR, step: 1, onInput: v => { st.baseR = v; onParam(); } });
  const sRise = addSlider(ctrls, { label: 'Yükselme Açısı β₁', unit: '°', min: 45, max: 160, value: st.riseDeg, step: 5, fmt: v => `${v}°`, onInput: v => { st.riseDeg = v; onParam(); } });
  const sRet = addSlider(ctrls, { label: 'İniş Açısı β₂', unit: '°', min: 45, max: 160, value: st.returnDeg, step: 5, fmt: v => `${v}°`, onInput: v => { st.returnDeg = v; onParam(); } });
  const sCamW = addSlider(ctrls, { label: 'Kam Hızı ω', unit: 'rad/s', min: 1, max: 15, value: st.camOmega, step: 0.5, onInput: v => { st.camOmega = v; onParam(); } });

  let camProf = null;

  function updateAll() {
    if (st.mode === 'gear') {
      const g = solveGearTrain({
        type: st.gtype, N1: st.N1, N2: st.N2, N3: st.N3, N4: st.N4,
        useIdler: st.useIdler, Nid: st.Nid, Ns: st.Ns, Np: st.Np, fixed: st.fixed,
        rpmIn: st.rpmIn, torqueIn: st.torqueIn,
      });
      alertEl.innerHTML = '';
      infoEl.textContent = st.gtype === 'planetary' ? `Nᵣ = Nₛ + 2Nₚ = ${g.Nr} diş` : g.direction;
      renderKpis(kpis, [
        { lbl: 'İletim Oranı i', val: `${fmtFix(g.ratio, 2)} : 1`, sub: g.direction, tone: 'acc' },
        { lbl: 'Çıkış Devri', val: `${fmtFix(g.rpmOut, 1)} RPM`, sub: `Giriş: ${st.rpmIn} RPM` },
        { lbl: 'Çıkış Torku (η=%96)', val: `${fmtFix(g.torqueOut, 1)} N·m`, sub: `Giriş: ${st.torqueIn} N·m`, tone: 'ok' },
        { lbl: 'İletilen Güç', val: fmtUnit(g.powerOut, 'W', 3), sub: `ω_çıkış = ${fmtFix(g.wOut, 2)} rad/s` },
      ]);
    } else {
      const dwellHi = Math.max(10, Math.min(st.dwellHiDeg, 350 - st.riseDeg - st.returnDeg));
      camProf = computeCamProfile({
        law: st.law, lift: st.lift, baseR: st.baseR, rollerR: 8,
        riseDeg: st.riseDeg, dwellHiDeg: dwellHi, returnDeg: st.returnDeg, omega: st.camOmega, n: 360,
      });
      alertEl.innerHTML = st.law === 'uniform'
        ? `<div class="slm-alert slm-alert-bad">Düzgün hızlı kamda kalkış/duruş noktalarında sonsuz ivme (darbe şoku) oluşur — yüksek hızda kullanılmaz!</div>`
        : camProf.maxPhi > 30
          ? `<div class="slm-alert slm-alert-warn">Maksimum basınç açısı ${fmtFix(camProf.maxPhi, 1)}° > 30°! Temel daireyi (R_b) büyütün veya yükselme açısını artırın.</div>`
          : '';
      infoEl.textContent = `Maks. φ = ${fmtFix(camProf.maxPhi, 1)}°`;
      renderKpis(kpis, [
        { lbl: 'Maks. Hız |v|', val: `${fmtFix(camProf.maxV, 1)} mm/s`, sub: `ω = ${st.camOmega} rad/s` },
        { lbl: 'Maks. İvme |a|', val: st.law === 'uniform' ? '∞ (Darbe)' : `${fmtFix(camProf.maxA, 0)} mm/s²`, sub: st.law === 'cycloidal' || st.law === 'poly345' ? 'Uçlarda a = 0' : 'Uçlarda sıçrama', tone: st.law === 'uniform' ? 'bad' : 'ok' },
        { lbl: 'Maks. Basınç Açısı φ', val: `${fmtFix(camProf.maxPhi, 1)}°`, sub: camProf.maxPhi <= 30 ? 'Güvenli (≤30°)' : 'Sıkışma riski!', tone: camProf.maxPhi <= 30 ? 'ok' : 'warn' },
        { lbl: 'Kurs / Temel Daire', val: `${st.lift} / ${st.baseR} mm`, sub: `Duruş: ${360 - st.riseDeg - st.returnDeg}°` },
      ]);
      drawCamPlots();
    }
    mainCv.render();
  }

  function drawCamPlots() {
    if (!camProf || st.mode !== 'cam') return;
    safePlot(csv, [
      { name: 's (mm)', color: COL_OK, xs: camProf.degs, ys: camProf.s },
      { name: 'v/10', color: COL_BLUE, xs: camProf.degs, ys: camProf.v.map(v => v * 0.1) },
    ], { x0: 0, x1: 360, ylabel: 's · v/10', height: 175 });
    safePlot(ca, [
      { name: 'a', color: COL_WARN, xs: camProf.degs, ys: camProf.a },
    ], { x0: 0, x1: 360, ylabel: 'mm/s²', height: 175 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(310, Math.max(225, w * 0.5)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'gear') {
      const g = solveGearTrain({ type: st.gtype, N1: st.N1, N2: st.N2, N3: st.N3, N4: st.N4, useIdler: st.useIdler, Nid: st.Nid, Ns: st.Ns, Np: st.Np, fixed: st.fixed, rpmIn: st.rpmIn });
      const cy = H * 0.5;
      if (st.gtype === 'simple') {
        const totN = st.N1 + st.N2 + (st.useIdler ? st.Nid : 0);
        const modPx = Math.min((W - 70) / (totN * 1.15), (H - 50) / (Math.max(st.N1, st.N2, st.Nid) * 1.25));
        const r1 = 0.5 * st.N1 * modPx, r2 = 0.5 * st.N2 * modPx, rid = 0.5 * st.Nid * modPx;
        const span = r1 + r2 + (st.useIdler ? 2 * rid : 0);
        const x1 = W * 0.5 - span * 0.5 + r1;
        const a1 = st.angle;
        drawGearWheel(c, x1, cy, r1, st.N1, a1, COL_BLUE);
        if (st.useIdler) {
          const xid = x1 + r1 + rid;
          const aid = -(a1 * st.N1) / st.Nid + Math.PI / st.Nid;
          drawGearWheel(c, xid, cy, rid, st.Nid, aid, COL_WARN);
          const x2 = xid + rid + r2;
          const a2 = (a1 * st.N1) / st.N2;
          drawGearWheel(c, x2, cy, r2, st.N2, a2, COL_OK);
        } else {
          const x2 = x1 + r1 + r2;
          const a2 = -(a1 * st.N1) / st.N2 + Math.PI / st.N2;
          drawGearWheel(c, x2, cy, r2, st.N2, a2, COL_OK);
        }
      } else if (st.gtype === 'compound') {
        const modPx = Math.min((W - 80) / ((st.N1 + st.N2 + st.N3 + st.N4) * 0.72), (H - 54) / (Math.max(st.N2, st.N4) * 1.3));
        const r1 = 0.5 * st.N1 * modPx, r2 = 0.5 * st.N2 * modPx, r3 = 0.5 * st.N3 * modPx, r4 = 0.5 * st.N4 * modPx;
        const xMid = W * 0.5;
        const x1 = xMid - (r1 + r2), x4 = xMid + (r3 + r4);
        const a1 = st.angle;
        const aMid = -(a1 * st.N1) / st.N2 + Math.PI / st.N2;
        const a4 = -(aMid * st.N3) / st.N4 + Math.PI / st.N4;
        drawGearWheel(c, x1, cy, r1, st.N1, a1, COL_BLUE);
        drawGearWheel(c, xMid, cy, r2, st.N2, aMid, COL_WARN);
        drawGearWheel(c, xMid, cy, r3, st.N3, aMid, acc);
        drawGearWheel(c, x4, cy, r4, st.N4, a4, COL_OK);
      } else {
        // Planetary set
        const Nr = g.Nr;
        const modPx = Math.min(W, H) / ((Nr + 10) * 1.15);
        const rs = 0.5 * st.Ns * modPx, rp = 0.5 * st.Np * modPx, rr = 0.5 * Nr * modPx;
        const cx = W * 0.5;
        const scaleT = st.angle / Math.max(0.01, g.wIn);
        const as = g.ws * scaleT, ac = g.wc * scaleT, ar = g.wr * scaleT, ap = g.wpAbs * scaleT;

        drawGearWheel(c, cx, cy, rr, Nr, ar, st.fixed === 'ring' ? COL_MUTE : COL_OK, true);
        drawGearWheel(c, cx, cy, rs, st.Ns, as, st.fixed === 'sun' ? COL_MUTE : COL_BLUE);
        // 3 planets + carrier arms
        const rc = rs + rp;
        c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const ang = ac + (k * 2 * Math.PI) / 3;
          const px = cx + rc * Math.cos(ang), py = cy + rc * Math.sin(ang);
          c.beginPath(); c.moveTo(cx, cy); c.lineTo(px, py); c.stroke();
          drawGearWheel(c, px, py, rp, st.Np, ap + (k * 2 * Math.PI) / 3, COL_WARN);
        }
      }
    } else if (camProf) {
      // Rotating cam profile + roller follower
      const cx = W * 0.44, cy = H * 0.56;
      const maxR = st.baseR + st.lift + 14;
      const sc = Math.min(W * 0.36, H * 0.42) / maxR;
      const camAng = ((st.angle * DEG) % 360 + 360) % 360;
      const idxNow = Math.round(camAng) % 360;
      const sNow = camProf.s[idxNow];

      // Draw cam body rotated by -camAng (so follower stays at top 90°)
      c.save();
      c.translate(cx, cy);
      c.beginPath();
      for (let i = 0; i <= 360; i += 2) {
        const r = (st.baseR + camProf.s[i]) * sc;
        const a = (i - camAng) * RAD - Math.PI / 2;
        const px = r * Math.cos(a), py = r * Math.sin(a);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fill();
      c.strokeStyle = acc; c.lineWidth = 2.2; c.stroke();
      // Base circle dashed
      c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, st.baseR * sc, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      drawPin(c, 0, 0, 5, '#0b0b10', COL_FG);
      c.restore();

      // Roller follower & vertical stem at top
      const rollR = 8 * sc;
      const fy = cy - (st.baseR + sNow) * sc - rollR;
      c.strokeStyle = COL_OK; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, fy); c.lineTo(cx, fy - 42); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
      c.strokeRect(cx - 10, cy - (st.baseR + st.lift) * sc - rollR - 36, 20, 18);
      drawPin(c, cx, fy, rollR, 'rgba(91,228,155,.22)', COL_OK);

      c.fillStyle = COL_FG; c.font = '12px "JetBrains Mono", monospace';
      c.fillText(`θ = ${camAng.toFixed(0)}°`, W - 125, 24);
      c.fillText(`s = ${sNow.toFixed(1)} mm`, W - 125, 42);
      c.fillText(`φ = ${camProf.phi[idxNow].toFixed(1)}°`, W - 125, 60);
    }
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const speed = st.mode === 'gear' ? Math.min(6, (st.rpmIn * 2 * Math.PI) / 60 * 0.25) : st.camOmega * 0.45;
    st.angle = (st.angle + speed * dt) % (Math.PI * 200);
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isG = st.mode === 'gear';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    gtypeSeg.hidden = !isG;
    lawSeg.hidden = isG;
    camPlots.hidden = isG;
    host.querySelector('[data-cvtitle]').textContent = isG ? 'Dişli Takımı Animasyonu' : 'Dönen Kam & Makaralı İzleyici';

    const isS = isG && st.gtype === 'simple', isC = isG && st.gtype === 'compound', isP = isG && st.gtype === 'planetary';
    sN1.setVisible(isS || isC); sN2.setVisible(isS || isC);
    sN3.setVisible(isC); sN4.setVisible(isC);
    tIdler.setVisible(isS);
    sNs.setVisible(isP); sNp.setVisible(isP); selFixed.setVisible(isP);
    sRpm.setVisible(isG); sTrq.setVisible(isG);
    [sLift, sRb, sRise, sRet, sCamW].forEach(s => s.setVisible(!isG));
  }

  function onParam() { updateAll(); }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); updateAll(); syncSegments(host, false);
  });
  gtypeSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-gt]'); if (!b) return;
    st.gtype = b.dataset.gt;
    gtypeSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    syncMode(); updateAll(); syncSegments(host, false);
  });
  lawSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-lw]'); if (!b) return;
    st.law = b.dataset.lw;
    lawSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    updateAll(); syncSegments(host, false);
  });
  bindPresets(host, GEARCAM_PRESETS, p => {
    Object.assign(st, p);
    sN1.set(st.N1); sN2.set(st.N2); sN3.set(st.N3); sN4.set(st.N4); tIdler.set(st.useIdler);
    sNs.set(st.Ns); sNp.set(st.Np); selFixed.set(st.fixed); sRpm.set(st.rpmIn); sTrq.set(st.torqueIn);
    sLift.set(st.lift); sRb.set(st.baseR); sRise.set(st.riseDeg); sRet.set(st.returnDeg); sCamW.set(st.camOmega);
    gtypeSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.gt === st.gtype));
    lawSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.lw === st.law));
    syncMode(); updateAll();
  });

  attachReadout(csv, host.querySelector('[data-rsv]'), (x, ser, i) => `θ=${fmtFix(x, 0)}° · s=${fmtFix(ser[0].ys[i], 1)}mm · v=${fmtFix(ser[1].ys[i] * 10, 1)}mm/s`, clean);
  attachReadout(ca, host.querySelector('[data-ra]'), (x, ser, i) => `θ=${fmtFix(x, 0)}° · a=${fmtFix(ser[0].ys[i], 0)}mm/s²`, clean);
  observeResize(host.querySelector('[data-bsv]'), drawCamPlots, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  updateAll();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 6. MİL BURULMASI & HELİSEL YAY TASARIMI (Shaft Torsion & Spring)
// =====================================================================

const SHAFT_MATS = {
  steel: { name: 'Çelik (AISI 1045)', G: 80e9, SyShear: 260e6 },
  al:    { name: 'Alüminyum (6061-T6)', G: 26e9, SyShear: 145e6 },
  ti:    { name: 'Titanyum (Ti-6Al-4V)', G: 44e9, SyShear: 480e6 },
};

const SHAFTSPRING_PRESETS = [
  { label: 'Dolu Çelik Mil', mode: 'shaft', mat: 'steel', Dmm: 40, dmm: 0, L: 1.2, T: 800 },
  { label: 'İçi Boş Hafif Mil', mode: 'shaft', mat: 'steel', Dmm: 48, dmm: 34, L: 1.2, T: 800 },
  { label: 'Süspansiyon Yayı (C=6)', mode: 'spring', wdMm: 6, DmMm: 36, Na: 9, F: 900, GsGpa: 79.3 },
  { label: 'Hassas Yay (C=10)', mode: 'spring', wdMm: 2.5, DmMm: 25, Na: 12, F: 80, GsGpa: 79.3 },
];

function mountShaftSpring(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'shaft', mat: 'steel', Dmm: 40, dmm: 0, L: 1.2, T: 800,
    wdMm: 5, DmMm: 35, Na: 10, F: 600, GsGpa: 79.3,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('Dolu veya içi boş dairesel millerde <b>burulma kayma gerilmesi ($\\tau$)</b> ve <b>dönme açısını ($\\phi$)</b> hesapla; helisel yaylarda <b>rijitlik ($k$)</b> ve <b>Wahl çarpanı ($K_W$)</b> ile gerilme analizi yap.', SHAFTSPRING_PRESETS)}
    <div class="slm-toolbar">
      <div class="seg" data-mode role="tablist" aria-label="Mil veya Yay">
        <button type="button" data-m="shaft" class="on">Mil Burulması</button>
        <button type="button" data-m="spring">Helisel Yay (Wahl)</button>
      </div>
      <span class="slm-badge slm-badge-ok" data-sf></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>Burulmuş Mil & Kesit Kayma Gerilmesi τ(r)</h4></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Mil burulması ve helisel yay görseli"></canvas></div>
        </div>
        <div class="slm-plot-card" data-wcard hidden>
          <div class="slm-head"><h4 class="slm-title">Wahl Çarpanı K_W(C) — Yay İndeksi Etkisi</h4></div>
          <div class="slm-cv-box" data-bw><canvas class="slm-cv" data-cw aria-label="Wahl çarpanı grafiği"></canvas><div class="slm-readout" data-rw></div></div>
          <div class="slm-axis-lbl">Yay indeksi C = D / d</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'J = \\frac{\\pi}{32}(D^4 - d^4), \\qquad \\tau_{\\max} = \\frac{T(D/2)}{J}, \\qquad \\phi = \\frac{T L}{J G}',
        'k = \\frac{G d^4}{8 D^3 N_a}, \\qquad K_W = \\frac{4C - 1}{4C - 4} + \\frac{0.615}{C}, \\qquad \\tau_{\\max} = K_W\\frac{8 F D}{\\pi d^3}',
      ],
      paragraphs: [
        'Mil kesitinde kayma gerilmesi merkezde sıfır, dış yüzeyde maksimumdur ($\\tau(r) \\propto r$). Bu nedenle iç çekirdeği boşaltılan **içi boş mil**, çok az polar atalet momenti ($J$) kaybederek ciddi ağırlık tasarrufu sağlar.',
        'Helisel yayda iç lifler hem doğrudan kesmeye hem de eğrilik kaynaklı gerilme yığılmasına maruz kalır. **Wahl çarpanı $K_W$** bunu hesaba katar; üretim ve gerilme dengesi için $4 \\le C \\le 12$ önerilir.',
      ],
      tasks: [
        'Dolu milde iç çap $d$’yi $D/2$ yapın ve $J$’nin yalnızca $\\%6.25$ azalırken kesit alanının $\\%25$ hafiflediğini gözlemleyin.',
        'Helisel yayda tel çapını ($d$) 2 katına çıkarıp yay rijitliğinin $2^4 = 16$ kat arttığını doğrulayın.',
        'Yay indeksini $C < 4$ değerine düşürüp Wahl çarpanı $K_W$’nin keskin artışını grafikte inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const sfBadge = host.querySelector('[data-sf]');
  const alertEl = host.querySelector('[data-alert]');
  const wcard = host.querySelector('[data-wcard]');
  const cv = host.querySelector('[data-cv]');
  const cw = host.querySelector('[data-cw]');

  // Shaft controls
  const selMat = addSelect(ctrls, 'Mil Malzemesi', Object.entries(SHAFT_MATS).map(([k, v]) => [k, `${v.name} (G=${v.G / 1e9} GPa)`]), st.mat, v => { st.mat = v; update(); });
  const sD = addSlider(ctrls, { label: 'Dış Çap D', unit: 'mm', min: 15, max: 100, value: st.Dmm, step: 1, onInput: v => { st.Dmm = v; if (st.dmm >= v - 4) { st.dmm = Math.max(0, v - 6); sd.set(st.dmm); } update(); } });
  const sd = addSlider(ctrls, { label: 'İç Çap d (0 = Dolu)', unit: 'mm', min: 0, max: 85, value: st.dmm, step: 1, onInput: v => { st.dmm = Math.min(v, st.Dmm - 4); update(); } });
  const sL = addSlider(ctrls, { label: 'Mil Uzunluğu L', unit: 'm', min: 0.2, max: 3.5, value: st.L, step: 0.05, onInput: v => { st.L = v; update(); } });
  const sT = addSlider(ctrls, { label: 'Burulma Torku T', unit: 'N·m', min: 50, max: 5000, value: st.T, step: 25, onInput: v => { st.T = v; update(); } });

  // Spring controls
  const sWd = addSlider(ctrls, { label: 'Tel Çapı d', unit: 'mm', min: 1.5, max: 14, value: st.wdMm, step: 0.25, onInput: v => { st.wdMm = v; update(); } });
  const sDm = addSlider(ctrls, { label: 'Ortalama Sarım Çapı D', unit: 'mm', min: 12, max: 100, value: st.DmMm, step: 1, onInput: v => { st.DmMm = v; update(); } });
  const sNa = addSlider(ctrls, { label: 'Aktif Sarım Sayısı Nₐ', min: 3, max: 20, value: st.Na, step: 0.5, fmt: v => `${v}`, onInput: v => { st.Na = v; update(); } });
  const sF = addSlider(ctrls, { label: 'Eksenel Kuvvet F', unit: 'N', min: 20, max: 2500, value: st.F, step: 10, onInput: v => { st.F = v; update(); } });
  const sGs = addSlider(ctrls, { label: 'Kayma Modülü G', unit: 'GPa', min: 25, max: 85, value: st.GsGpa, step: 0.5, onInput: v => { st.GsGpa = v; update(); } });

  let lastRes = null;

  function drawWahlPlot() {
    if (st.mode !== 'spring' || !lastRes) return;
    const cs = [], kws = [], kss = [];
    for (let i = 0; i <= 120; i++) {
      const C = 2.2 + (13.8 * i) / 120;
      cs.push(C);
      kws.push((4 * C - 1) / (4 * C - 4) + 0.615 / C);
      kss.push(1 + 0.5 / C);
    }
    const cClamped = Math.max(2.2, Math.min(16, lastRes.C));
    safePlot(cw, [
      { name: 'Wahl K_W', color: accentColor(), xs: cs, ys: kws },
      { name: 'Doğrudan K_s', color: COL_BLUE, xs: cs, ys: kss },
      { name: 'C', color: COL_WARN, xs: [cClamped, cClamped], ys: [1, Math.min(2.2, lastRes.Kw + 0.15)] },
    ], { x0: 2.2, x1: 16, ylabel: 'Çarpan', height: 170 });
  }

  function update() {
    if (st.mode === 'shaft') {
      const mat = SHAFT_MATS[st.mat];
      const dEff = Math.min(st.dmm, st.Dmm - 4);
      const r = solveShaftTorsion({ D: st.Dmm / 1000, d: dEff / 1000, L: st.L, G: mat.G, T: st.T, SyShear: mat.SyShear });
      lastRes = r;
      sfBadge.textContent = `Emniyet n = ${fmtFix(r.safetyFactor, 2)}`;
      sfBadge.className = `slm-badge ${r.safetyFactor >= 1.5 ? 'slm-badge-ok' : r.safetyFactor >= 1 ? 'slm-badge-warn' : 'slm-badge-bad'}`;
      alertEl.innerHTML = r.safetyFactor < 1
        ? `<div class="slm-alert slm-alert-bad">Akma sınırı aşıldı! τ_max (${fmtFix(r.tauMax / 1e6, 1)} MPa) > S_sy (${mat.SyShear / 1e6} MPa).</div>`
        : '';
      renderKpis(kpis, [
        { lbl: 'Maks. Kayma Gerilmesi τ', val: `${fmtFix(r.tauMax / 1e6, 1)} MPa`, sub: `Akma S_sy = ${mat.SyShear / 1e6} MPa`, tone: r.safetyFactor < 1 ? 'bad' : 'acc' },
        { lbl: 'Burulma Açısı φ', val: `${fmtFix(r.phiDeg, 2)}°`, sub: `${fmtFix(r.phiRad, 4)} rad · ${fmtFix(r.twistPerM, 2)} °/m` },
        { lbl: 'Polar Atalet J', val: `${fmtFix(r.J * 1e12, 0)} mm⁴`, sub: `Alan = ${fmtFix(r.area * 1e6, 0)} mm²` },
        { lbl: 'Burulma Rijitliği', val: `${fmtFix(r.stiffness / 1000, 2)} kN·m/rad`, sub: `U = ${fmtFix(r.strainEnergy, 1)} J` },
      ]);
    } else {
      const r = solveHelicalSpring({ d: st.wdMm / 1000, D: st.DmMm / 1000, Na: st.Na, G: st.GsGpa * 1e9, F: st.F, SyShear: 650e6 });
      lastRes = r;
      sfBadge.textContent = `C = ${fmtFix(r.C, 2)} · K_W = ${fmtFix(r.Kw, 3)}`;
      sfBadge.className = `slm-badge ${r.C >= 4 && r.C <= 12 && r.safetyFactor >= 1.2 ? 'slm-badge-ok' : 'slm-badge-warn'}`;
      alertEl.innerHTML = r.C < 4
        ? `<div class="slm-alert slm-alert-warn">Yay indeksi C = ${fmtFix(r.C, 2)} < 4: üretim zor ve Wahl eğrilik gerilmesi çok yüksek!</div>`
        : r.safetyFactor < 1
          ? `<div class="slm-alert slm-alert-bad">Yay gerilmesi ${fmtFix(r.tauWahl / 1e6, 0)} MPa akma sınırını (650 MPa) aştı!</div>`
          : '';
      renderKpis(kpis, [
        { lbl: 'Yay Rijitliği k', val: `${fmtFix(r.k / 1000, 2)} N/mm`, sub: `${fmtUnit(r.k, 'N/m', 3)}`, tone: 'acc' },
        { lbl: 'Çökme δ = F/k', val: `${fmtFix(r.deflection * 1000, 2)} mm`, sub: `Enerji U = ${fmtFix(r.energy, 2)} J` },
        { lbl: 'Wahl Gerilmesi τ_W', val: `${fmtFix(r.tauWahl / 1e6, 1)} MPa`, sub: `K_W = ${fmtFix(r.Kw, 3)} · n = ${fmtFix(r.safetyFactor, 2)}`, tone: r.safetyFactor < 1 ? 'bad' : 'ok' },
        { lbl: 'Kapalı Boy L_s', val: `${fmtFix(r.solidLength * 1000, 1)} mm`, sub: `C = D/d = ${fmtFix(r.C, 2)}` },
      ]);
      drawWahlPlot();
    }
    mainCv.render();
  }

  const mainCv = setupCanvas(cv, w => Math.min(265, Math.max(200, w * 0.42)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'shaft' && lastRes) {
      // Left: twisted shaft with helical line; Right: cross section + tau(r)
      const splitX = W * 0.6;
      const cy = H * 0.52;
      const x0 = 36, x1 = splitX - 28;
      const radPx = Math.min(48, Math.max(16, st.Dmm * 0.55));
      const inRadPx = radPx * (Math.min(st.dmm, st.Dmm - 4) / st.Dmm);

      // Fixed wall on left
      drawGroundHatch(c, x0, cy - radPx - 14, x0, cy + radPx + 14, -1);

      // Shaft cylinder body
      c.fillStyle = 'rgba(255,255,255,.06)'; c.strokeStyle = COL_FG; c.lineWidth = 1.8;
      c.fillRect(x0, cy - radPx, x1 - x0, radPx * 2);
      c.strokeRect(x0, cy - radPx, x1 - x0, radPx * 2);
      if (inRadPx > 2) {
        c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.3)';
        c.beginPath();
        c.moveTo(x0, cy - inRadPx); c.lineTo(x1, cy - inRadPx);
        c.moveTo(x0, cy + inRadPx); c.lineTo(x1, cy + inRadPx);
        c.stroke(); c.setLineDash([]);
      }

      // Helical twist generators (exaggerated visually for clarity)
      const visPhi = Math.min(1.3, lastRes.phiRad * 8);
      for (let g = -1; g <= 1; g++) {
        c.strokeStyle = g === 0 ? acc : 'rgba(90,176,255,.45)';
        c.lineWidth = g === 0 ? 2.2 : 1.2;
        c.beginPath();
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          const ang = g * 0.8 + visPhi * u;
          const px = x0 + u * (x1 - x0);
          const py = cy - radPx * Math.sin(ang);
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
      }
      // Torque curved arrow on right end
      c.strokeStyle = COL_WARN; c.lineWidth = 2;
      c.beginPath(); c.arc(x1 + 10, cy, radPx * 0.72, -1.1, 1.1); c.stroke();
      c.fillStyle = COL_WARN; c.font = '600 11px "JetBrains Mono", monospace';
      c.fillText(`T=${st.T} N·m`, x1 - 24, cy - radPx - 12);

      // Right: Cross-section & radial stress profile
      const ccx = splitX + (W - splitX) * 0.5;
      const rSec = Math.min((W - splitX) * 0.34, H * 0.34);
      const rInSec = rSec * (Math.min(st.dmm, st.Dmm - 4) / st.Dmm);
      const grad = c.createRadialGradient(ccx, cy, rInSec, ccx, cy, rSec);
      grad.addColorStop(0, 'rgba(90,176,255,.14)');
      grad.addColorStop(1, lastRes.safetyFactor < 1 ? 'rgba(255,107,107,.55)' : 'rgba(91,228,155,.42)');
      c.fillStyle = grad;
      c.beginPath(); c.arc(ccx, cy, rSec, 0, Math.PI * 2);
      if (rInSec > 1) { c.moveTo(ccx + rInSec, cy); c.arc(ccx, cy, rInSec, 0, Math.PI * 2, true); }
      c.fill();
      c.strokeStyle = COL_FG; c.lineWidth = 1.8;
      c.beginPath(); c.arc(ccx, cy, rSec, 0, Math.PI * 2); c.stroke();
      if (rInSec > 1) { c.beginPath(); c.arc(ccx, cy, rInSec, 0, Math.PI * 2); c.stroke(); }

      // Linear radial tau(r) arrows along top radius
      for (let k = 1; k <= 4; k++) {
        const rr = rInSec + ((rSec - rInSec) * k) / 4;
        const len = (rr / rSec) * 28;
        drawArrow(c, ccx, cy - rr, ccx + len, cy - rr, acc, 1.5);
      }
      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`τ(r) = ${fmtFix(lastRes.tauMax / 1e6, 0)} MPa`, ccx, H - 12);
      c.textAlign = 'left';
    } else if (lastRes) {
      // Helical compression spring visual
      const cx = W * 0.5;
      const topY = 24;
      const freeH = H - 56;
      const compFrac = Math.min(0.58, (lastRes.deflection * 1000) / Math.max(40, st.Na * st.wdMm * 2.2));
      const curH = freeH * (1 - compFrac);
      const botY = topY + freeH;
      const headY = botY - curH;
      const coilR = Math.min(72, Math.max(24, st.DmMm * 1.1));
      const wireW = Math.min(10, Math.max(2.5, st.wdMm * 0.72));

      drawGroundHatch(c, cx - coilR - 26, botY, cx + coilR + 26, botY, 1);
      // Coils
      const nTurns = Math.min(14, Math.max(3, Math.round(st.Na)));
      const pitch = curH / nTurns;
      c.lineCap = 'round';
      for (let i = 0; i < nTurns; i++) {
        const yA = headY + i * pitch;
        const yB = yA + pitch * 0.5;
        const yC = yA + pitch;
        // Back half
        c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = wireW;
        c.beginPath(); c.moveTo(cx - coilR, yA); c.lineTo(cx + coilR, yB); c.stroke();
        // Front half
        c.strokeStyle = lastRes.safetyFactor < 1 ? COL_BAD : acc; c.lineWidth = wireW;
        c.beginPath(); c.moveTo(cx + coilR, yB); c.lineTo(cx - coilR, yC); c.stroke();
      }
      // Top load plate + force arrow
      c.strokeStyle = COL_FG; c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx - coilR - 14, headY); c.lineTo(cx + coilR + 14, headY); c.stroke();
      drawArrow(c, cx, Math.max(6, headY - 36), cx, headY - 4, COL_WARN, 2.6, `F=${st.F}N`);

      // Deflection dimension on right
      const dimX = cx + coilR + 30;
      if (compFrac > 0.01 && dimX < W - 40) {
        c.strokeStyle = COL_OK; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(dimX, topY); c.lineTo(dimX, headY); c.stroke();
        c.fillStyle = COL_OK; c.font = '11px "JetBrains Mono", monospace';
        c.fillText(`δ=${fmtFix(lastRes.deflection * 1000, 1)}mm`, dimX + 6, (topY + headY) * 0.5 + 4);
      }
    }
  }, clean);

  function syncMode() {
    const isSh = st.mode === 'shaft';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    [selMat, sD, sd, sL, sT].forEach(s => s.setVisible(isSh));
    [sWd, sDm, sNa, sF, sGs].forEach(s => s.setVisible(!isSh));
    wcard.hidden = isSh;
    host.querySelector('[data-cvtitle]').textContent = isSh ? 'Burulmuş Mil & Kesit Kayma Gerilmesi τ(r)' : 'Yük Altındaki Helisel Yay';
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, SHAFTSPRING_PRESETS, p => {
    Object.assign(st, p);
    selMat.set(st.mat); sD.set(st.Dmm); sd.set(st.dmm); sL.set(st.L); sT.set(st.T);
    sWd.set(st.wdMm); sDm.set(st.DmMm); sNa.set(st.Na); sF.set(st.F); sGs.set(st.GsGpa);
    syncMode(); update();
  });

  attachReadout(cw, host.querySelector('[data-rw]'), (x, ser, i) => `C=${fmtFix(x, 2)} · K_W=${fmtFix(ser[0].ys[i], 3)} · K_s=${fmtFix(ser[1].ys[i], 3)}`, clean);
  observeResize(host.querySelector('[data-bw]'), drawWahlPlot, clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 7. ROBOT KOL (2-DOF Planar Arm: FK, IK, Workspace, Jacobian)
// =====================================================================

const ROBOT_PRESETS = [
  { label: 'İdeal İzotropik (θ₂=90°)', mode: 'ik', L1: 1.2, L2: 1.0, tx: 1.0, ty: 1.2, elbowUp: false },
  { label: 'Dış Tekillik (θ₂=0°)', mode: 'ik', L1: 1.2, L2: 1.0, tx: 2.19, ty: 0.1, elbowUp: false },
  { label: 'İç Tekillik (Katlı)', mode: 'ik', L1: 1.2, L2: 1.0, tx: 0.22, ty: 0.05, elbowUp: false },
  { label: 'Otomatik Daire İzleme', mode: 'traj', L1: 1.2, L2: 1.0, tx: 1.2, ty: 0.7, elbowUp: false },
];

function mountRobotArm(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'ik', L1: 1.2, L2: 1.0, tx: 1.0, ty: 1.15,
    th1: 0.45, th2: 1.15, elbowUp: false, showAlt: true,
    trajT: 0, playing: autoPlayAllowed(),
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('2 eksenli düzlemsel robot kolun <b>uç işlevcisini tuvalde sürükleyerek</b> ters kinematiği (IK), çalışma uzayını ve <b>Jacobian manipülasyon elipsi / tekilliklerini</b> canlı keşfet.', ROBOT_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="Robot kol modu">
          <button type="button" data-m="ik" class="on">Ters Kinematik (Sürükle)</button>
          <button type="button" data-m="fk">İleri Kinematik</button>
          <button type="button" data-m="traj">Yörünge İzle</button>
        </div>
        <button type="button" class="btn small primary" data-play hidden></button>
      </div>
      <span class="slm-badge" data-sing></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Çalışma Uzayı & Jacobian Manipülasyon Elipsi</h4><span class="slm-hint">Uç noktayı (hedefi) sürükle</span></div>
          <div class="slm-cv-box"><canvas class="slm-cv slm-cv-drag" data-cv aria-label="2 serbestlik dereceli robot kol etkileşimli tuval"></canvas><div class="slm-cv-tag" data-jmat></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'x = L_1\\cos\\theta_1 + L_2\\cos(\\theta_1+\\theta_2), \\qquad y = L_1\\sin\\theta_1 + L_2\\sin(\\theta_1+\\theta_2)',
        '\\cos\\theta_2 = \\frac{x^2 + y^2 - L_1^2 - L_2^2}{2 L_1 L_2}, \\qquad \\det(\\mathbf{J}) = L_1 L_2 \\sin\\theta_2',
      ],
      paragraphs: [
        'Çalışma uzayı, $|L_1 - L_2| \\le r \\le L_1 + L_2$ halka bölgesidir. İçindeki her nokta için **dirsek aşağı** ($\\theta_2 > 0$) ve **dirsek yukarı** ($\\theta_2 < 0$) olmak üzere iki ters kinematik çözümü vardır.',
        '**Jacobian matrisi** $\\dot{\\mathbf{x}} = \\mathbf{J}\\dot{\\boldsymbol{\\theta}}$ eklem hızlarını uç hızına bağlar. $\\theta_2 = 0^\\circ$ veya $\\pm 180^\\circ$ iken $\\det(\\mathbf{J}) = 0$ olur (**kinematik tekillik**): manipülasyon elipsi bir doğruya çöker ve kol radyal doğrultuda hareket kabiliyetini yitirir.',
      ],
      tasks: [
        'Uç noktayı çalışma uzayının dış sınırına sürükleyip manipülasyon elipsinin bir doğruya çöktüğünü ($\\det J \\to 0$) gözlemleyin.',
        'Aynı hedef konumda **Dirsek Yukarı** anahtarını çevirip alternatif çözüm dalını (kesikli hayalet kol) kıyaslayın.',
        'Yoshikawa manipülasyon ölçütünün $w = L_1 L_2 |\\sin\\theta_2|$ tam $\\theta_2 = \\pm 90^\\circ$ açısında maksimum olduğunu doğrulayın.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const singBadge = host.querySelector('[data-sing]');
  const alertEl = host.querySelector('[data-alert]');
  const playBtn = host.querySelector('[data-play]');
  const jmatTag = host.querySelector('[data-jmat]');
  const cv = host.querySelector('[data-cv]');

  const sL1 = addSlider(ctrls, { label: 'Uzuv 1 (L₁)', unit: 'm', min: 0.4, max: 1.8, value: st.L1, step: 0.05, onInput: v => { st.L1 = v; update(); } });
  const sL2 = addSlider(ctrls, { label: 'Uzuv 2 (L₂)', unit: 'm', min: 0.4, max: 1.8, value: st.L2, step: 0.05, onInput: v => { st.L2 = v; update(); } });
  const sTh1 = addSlider(ctrls, { label: 'Omuz Açısı θ₁', unit: '°', min: -180, max: 180, value: st.th1 * DEG, step: 1, fmt: v => `${v.toFixed(0)}°`, onInput: v => { st.th1 = v * RAD; update(); } });
  const sTh2 = addSlider(ctrls, { label: 'Dirsek Açısı θ₂', unit: '°', min: -175, max: 175, value: st.th2 * DEG, step: 1, fmt: v => `${v.toFixed(0)}°`, onInput: v => { st.th2 = v * RAD; update(); } });
  const tUp = addToggle(ctrls, 'Dirsek Yukarı Çözümü (θ₂ < 0)', st.elbowUp, v => { st.elbowUp = v; update(); });
  const tAlt = addToggle(ctrls, 'Alternatif Çözümü (Hayalet) Göster', st.showAlt, v => { st.showAlt = v; mainCv.render(); });

  let view = { cx: 200, cy: 180, sc: 80 };
  const toScr = p => ({ x: view.cx + p.x * view.sc, y: view.cy - p.y * view.sc });
  const toWld = p => ({ x: (p.x - view.cx) / view.sc, y: (view.cy - p.y) / view.sc });

  function currentKin() {
    if (st.mode === 'fk') {
      const fk = armForwardKinematics(st.L1, st.L2, st.th1, st.th2);
      st.tx = fk.ee.x; st.ty = fk.ee.y;
      return { reachable: true, th1: st.th1, th2: st.th2, fk, fkAlt: null };
    }
    const ik = armInverseKinematics(st.L1, st.L2, st.tx, st.ty, st.elbowUp);
    st.th1 = ik.th1; st.th2 = ik.th2;
    return ik;
  }

  function update() {
    const kin = currentKin();
    const jac = armJacobian(st.L1, st.L2, kin.th1, kin.th2);
    if (st.mode !== 'fk') {
      sTh1.set(kin.th1 * DEG); sTh2.set(kin.th2 * DEG);
    }
    singBadge.textContent = jac.singular ? '⚠ Kinematik Tekillik (det J ≈ 0)' : !kin.reachable ? 'Çalışma Uzayı Dışında' : 'Normal Çalışma';
    singBadge.className = `slm-badge ${jac.singular || !kin.reachable ? 'slm-badge-bad' : 'slm-badge-ok'}`;
    alertEl.innerHTML = jac.singular
      ? `<div class="slm-alert slm-alert-bad">Tekillik yakını (θ₂ = ${fmtFix(kin.th2 * DEG, 1)}°): Jacobian tekil, koşul sayısı κ = ${fmtNum(jac.cond, 3)} çok yüksek!</div>`
      : !kin.reachable
        ? `<div class="slm-alert slm-alert-warn">Hedef (${fmtFix(st.tx, 2)}, ${fmtFix(st.ty, 2)}) çalışma uzayı dışında — en yakın ulaşılabilir sınır noktasına kenetlendi.</div>`
        : '';

    renderKpis(kpis, [
      { lbl: 'Uç Konum (x, y)', val: `(${fmtFix(kin.fk.ee.x, 2)}, ${fmtFix(kin.fk.ee.y, 2)}) m`, sub: `r = ${fmtFix(Math.hypot(kin.fk.ee.x, kin.fk.ee.y), 2)} m`, tone: 'acc' },
      { lbl: 'Eklem Açıları θ₁, θ₂', val: `${fmtFix(kin.th1 * DEG, 1)}° / ${fmtFix(kin.th2 * DEG, 1)}°`, sub: kin.th2 >= 0 ? 'Dirsek aşağı' : 'Dirsek yukarı' },
      { lbl: 'Manipülasyon |det J|', val: fmtFix(jac.manipulability, 3), sub: `Maks: ${fmtFix(st.L1 * st.L2, 2)}`, tone: jac.singular ? 'bad' : 'ok' },
      { lbl: 'Koşul Sayısı κ = σ₁/σ₂', val: Number.isFinite(jac.cond) ? fmtFix(jac.cond, 2) : '∞', sub: `σ₁=${fmtFix(jac.sigma1, 2)} · σ₂=${fmtFix(jac.sigma2, 2)}` },
    ]);
    jmatTag.textContent = `J = [[${fmtFix(jac.J[0][0], 2)}, ${fmtFix(jac.J[0][1], 2)}], [${fmtFix(jac.J[1][0], 2)}, ${fmtFix(jac.J[1][1], 2)}]]`;
    mainCv.render();
  }

  const mainCv = setupCanvas(cv, w => Math.min(390, Math.max(270, w * 0.65)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const rMax = st.L1 + st.L2;
    const rMin = Math.abs(st.L1 - st.L2);
    view = { cx: W * 0.5, cy: H * 0.52, sc: Math.min(W, H) / (rMax * 2.45) };
    const acc = accentColor();

    // Workspace annulus
    c.save();
    c.fillStyle = 'rgba(255,255,255,.035)';
    c.beginPath(); c.arc(view.cx, view.cy, rMax * view.sc, 0, Math.PI * 2);
    if (rMin > 0.01) { c.moveTo(view.cx + rMin * view.sc, view.cy); c.arc(view.cx, view.cy, rMin * view.sc, 0, Math.PI * 2, true); }
    c.fill();
    c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(view.cx, view.cy, rMax * view.sc, 0, Math.PI * 2); c.stroke();
    if (rMin > 0.01) { c.beginPath(); c.arc(view.cx, view.cy, rMin * view.sc, 0, Math.PI * 2); c.stroke(); }
    c.setLineDash([]);
    // Axes
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, view.cy); c.lineTo(W, view.cy); c.moveTo(view.cx, 0); c.lineTo(view.cx, H); c.stroke();
    c.restore();

    // Trajectory reference path in traj mode
    if (st.mode === 'traj') {
      const cxT = 0.55 * rMax, cyT = 0.15 * rMax, rrT = 0.25 * rMax;
      c.save(); c.setLineDash([3, 3]); c.strokeStyle = `${acc}66`; c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i <= 80; i++) {
        const a = (2 * Math.PI * i) / 80;
        const p = toScr({ x: cxT + rrT * Math.cos(a), y: cyT + rrT * Math.sin(a) });
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.stroke(); c.restore();
    }

    const kin = currentKin();
    const jac = armJacobian(st.L1, st.L2, kin.th1, kin.th2);
    const p0 = toScr({ x: 0, y: 0 });
    const p1 = toScr(kin.fk.elbow);
    const p2 = toScr(kin.fk.ee);

    // Alternate IK branch ghost
    if (st.showAlt && kin.fkAlt) {
      const pa = toScr(kin.fkAlt.elbow);
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,255,255,.24)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(pa.x, pa.y); c.lineTo(p2.x, p2.y); c.stroke();
      c.restore();
    }

    // Manipulability ellipse at end-effector
    c.save();
    c.translate(p2.x, p2.y);
    c.rotate(-jac.ellipseAngle); // canvas y inverted
    const eSc = view.sc * 0.28;
    c.fillStyle = jac.singular ? 'rgba(255,107,107,.22)' : 'rgba(91,228,155,.15)';
    c.strokeStyle = jac.singular ? COL_BAD : COL_OK;
    c.lineWidth = 1.8;
    c.beginPath();
    c.ellipse(0, 0, Math.max(2, jac.sigma1 * eSc), Math.max(2, jac.sigma2 * eSc), 0, 0, Math.PI * 2);
    c.fill(); c.stroke();
    c.restore();

    // Links
    c.strokeStyle = COL_BLUE; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    c.strokeStyle = COL_FG; c.lineWidth = 5;
    c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();

    drawPin(c, p0.x, p0.y, 7, '#0b0b10', COL_FG);
    drawPin(c, p1.x, p1.y, 6, '#0b0b10', COL_BLUE);
    drawPin(c, p2.x, p2.y, 7, jac.singular ? COL_BAD : acc, '#fff');

    if (!kin.reachable) {
      const pt = toScr({ x: st.tx, y: st.ty });
      c.strokeStyle = COL_WARN; c.lineWidth = 1.5;
      c.beginPath(); c.arc(pt.x, pt.y, 6, 0, Math.PI * 2); c.stroke();
    }
  }, clean);

  bindDragCanvas(cv, {
    onDown(p) {
      if (st.mode === 'fk') { st.mode = 'ik'; syncMode(); syncSegments(host, false); }
      if (st.mode === 'traj') { st.mode = 'ik'; st.playing = false; loop.stop(); syncMode(); syncSegments(host, false); }
      const w = toWld(p);
      st.tx = w.x; st.ty = w.y; update();
      return true;
    },
    onMove(p, dragging) {
      if (!dragging) return;
      const w = toWld(p);
      st.tx = w.x; st.ty = w.y; update();
    },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.mode !== 'traj') return false;
    st.trajT += dt * 1.1;
    const rMax = st.L1 + st.L2;
    st.tx = 0.55 * rMax + 0.25 * rMax * Math.cos(st.trajT);
    st.ty = 0.15 * rMax + 0.25 * rMax * Math.sin(st.trajT);
    update();
    return true;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sTh1.setVisible(st.mode === 'fk'); sTh2.setVisible(st.mode === 'fk');
    tUp.setVisible(st.mode !== 'fk'); tAlt.setVisible(st.mode !== 'fk');
    playBtn.hidden = st.mode !== 'traj';
    syncPlayBtn(playBtn, st.playing);
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    if (st.mode === 'traj' && autoPlayAllowed()) { st.playing = true; loop.start(); }
    else if (st.mode !== 'traj') { loop.stop(); }
    syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, ROBOT_PRESETS, p => {
    Object.assign(st, p);
    sL1.set(st.L1); sL2.set(st.L2); tUp.set(st.elbowUp);
    if (st.mode === 'traj' && autoPlayAllowed()) { st.playing = true; loop.start(); } else loop.stop();
    syncMode(); update();
  });

  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 8. SARKAÇ & JİROSKOP (Simple Large-Angle, Physical Pendulum, Gyroscope)
// =====================================================================

const PEND_PRESETS = [
  { label: 'Küçük Açı (15°)', mode: 'simple', L: 1.5, theta0Deg: 15, g: 9.81 },
  { label: 'Büyük Açı (135°)', mode: 'simple', L: 1.5, theta0Deg: 135, g: 9.81 },
  { label: 'Fiziksel Sarkaç (Çubuk)', mode: 'physical', shape: 'rod', m: 2, L: 1.5, R: 0.45, theta0Deg: 60 },
  { label: 'Jiroskop Presesyonu', mode: 'gyro', m: 1.2, R: 0.12, rPivot: 0.16, rpm: 2400, tiltDeg: 35, gShape: 'disk' },
];

function mountPendulumGyro(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'simple', L: 1.5, theta0Deg: 120, g: 9.81,
    shape: 'rod', m: 2.0, R: 0.45,
    rPivot: 0.16, rpm: 2400, tiltDeg: 35, gShape: 'disk',
    playing: autoPlayAllowed(), simT: 0,
    yNL: [120 * RAD, 0], spinAng: 0, precAng: 0, trace: [],
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Büyük açılı doğrusal olmayan sarkaç</b> ile küçük açı yaklaşımını yan yana kıyasla; <b>fiziksel sarkaçta</b> eşdeğer boyu ($L_{\\text{eş}}$) ve <b>jiroskopta</b> kararlı presesyon hızını ($\\Omega_p$) canlı izle.', PEND_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="Sarkaç ve jiroskop modları">
          <button type="button" data-m="simple" class="on">Basit Sarkaç</button>
          <button type="button" data-m="physical">Fiziksel Sarkaç</button>
          <button type="button" data-m="gyro">Jiroskop</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-tag></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>Büyük Açı (Dolu) vs Küçük Açı (Hayalet)</h4><span class="slm-hint mono" data-tnow></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Sarkaç ve jiroskop animasyonu"></canvas></div>
        </div>
        <div class="slm-plot-card" data-pcard>
          <div class="slm-head"><h4 class="slm-title">Açısal Konum θ(t) — Doğrusal Olmayan vs Küçük Açı</h4>
            <div class="slm-legend">
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>Tam çözüm (sin θ)</span>
              <span class="slm-legend-item"><i class="slm-legend-swatch slm-legend-dash" style="border-color:${COL_WARN}"></i>Küçük açı (θ)</span>
            </div>
          </div>
          <div class="slm-cv-box" data-bp><canvas class="slm-cv" data-cp aria-label="Sarkaç zaman grafiği"></canvas><div class="slm-readout" data-rp></div></div>
          <div class="slm-axis-lbl">Zaman t (s)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\ddot{\\theta} + \\frac{g}{L_{\\text{eş}}}\\sin\\theta = 0, \\qquad T_{\\text{tam}} = 4\\sqrt{\\frac{L_{\\text{eş}}}{g}}\\,K\\!\\left(\\sin\\frac{\\theta_0}{2}\\right), \\quad L_{\\text{eş}} = \\frac{I_O}{md}',
        '\\Omega_p = \\frac{\\tau}{L_s\\sin\\theta} = \\frac{m g r}{I_s \\omega_s} \\quad (\\text{Hızlı jiroskop: } L_s^2 \\gg 4 I_\\perp m g r \\cos\\theta)',
      ],
      paragraphs: [
        '$\\theta_0 = 15^\\circ$ için küçük açı yaklaşımı ($T_0 = 2\\pi\\sqrt{L/g}$) yalnızca $\\%0.4$ hata verirken, $\\theta_0 = 120^\\circ$ açısında gerçek periyot $\\%37$ daha uzundur ve iki sarkaç hızla fazdan çıkar.',
        '**Jiroskop presesyon hızı $\\Omega_p$**, eğim açısı $\\theta$’dan bağımsızdır ve rotor dönüş hızı $\\omega_s$ arttıkça **yavaşlar** (daha kararlı hale gelir).',
      ],
      tasks: [
        'Basit sarkaçta açıyı $15^\\circ$’den $135^\\circ$’ye çıkararak gerçek periyodun küçük açı tahmininden ne kadar saptığını ölçün.',
        'Fiziksel sarkaçta **İnce Çubuk** için $L_{\\text{eş}} = \\frac{2}{3}L$ ve **Dolu Disk** için $L_{\\text{eş}} = \\frac{3}{2}R$ değerlerini doğrulayın.',
        'Jiroskopta rotor devrini 2 katına çıkarıp presesyon hızı $\\Omega_p$’nin yarıya düştüğünü gözlemleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const tagEl = host.querySelector('[data-tag]');
  const playBtn = host.querySelector('[data-play]');
  const tnow = host.querySelector('[data-tnow]');
  const pcard = host.querySelector('[data-pcard]');
  const cv = host.querySelector('[data-cv]');
  const cp = host.querySelector('[data-cp]');

  const sL = addSlider(ctrls, { label: 'Uzunluk L', unit: 'm', min: 0.4, max: 3.0, value: st.L, step: 0.05, onInput: v => { st.L = v; resetSim(); } });
  const sTh0 = addSlider(ctrls, { label: 'Başlangıç Açısı θ₀', unit: '°', min: 5, max: 165, value: st.theta0Deg, step: 1, fmt: v => `${v}°`, onInput: v => { st.theta0Deg = v; resetSim(); } });
  const sG = addSlider(ctrls, { label: 'Yerçekimi g', unit: 'm/s²', min: 1.6, max: 20, value: st.g, step: 0.1, onInput: v => { st.g = v; resetSim(); } });
  const selShape = addSelect(ctrls, 'Cisim Geometrisi', [['rod', 'İnce Çubuk (uçtan)'], ['disk', 'Dolu Disk (kenardan)'], ['ring', 'İnce Halka (kenardan)']], st.shape, v => { st.shape = v; resetSim(); });
  const sR = addSlider(ctrls, { label: 'Yarıçap R', unit: 'm', min: 0.05, max: 0.8, value: st.R, step: 0.01, onInput: v => { st.R = v; resetSim(); } });
  const sM = addSlider(ctrls, { label: 'Kütle m', unit: 'kg', min: 0.3, max: 5.0, value: st.m, step: 0.1, onInput: v => { st.m = v; updateKPIs(); } });
  const sRp = addSlider(ctrls, { label: 'Pivot Kolu r', unit: 'm', min: 0.05, max: 0.35, value: st.rPivot, step: 0.01, onInput: v => { st.rPivot = v; updateKPIs(); } });
  const sRpm = addSlider(ctrls, { label: 'Rotor Devri ωₛ', unit: 'RPM', min: 300, max: 6000, value: st.rpm, step: 100, onInput: v => { st.rpm = v; updateKPIs(); } });
  const sTilt = addSlider(ctrls, { label: 'Eğim Açısı θ', unit: '°', min: 10, max: 80, value: st.tiltDeg, step: 1, fmt: v => `${v}°`, onInput: v => { st.tiltDeg = v; updateKPIs(); mainCv.render(); } });

  function getLeq() {
    if (st.mode === 'simple') return st.L;
    return physicalPendulum({ shape: st.shape, m: st.m, L: st.L, R: st.R, g: st.g }).Leq;
  }

  function updateKPIs() {
    if (st.mode === 'gyro') {
      const gy = gyroscopePrecession({ m: st.m, R: Math.min(0.25, st.R), r: st.rPivot, rpm: st.rpm, tiltDeg: st.tiltDeg, shape: st.gShape, g: st.g });
      tagEl.textContent = gy.isFastTop ? 'Hızlı Jiroskop (Kararlı)' : 'Yavaş Dönüş (Nutasyon Yüksek)';
      tagEl.className = `slm-badge ${gy.isFastTop ? 'slm-badge-ok' : 'slm-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'Presesyon Hızı Ωₚ', val: `${fmtFix(gy.omegaP, 2)} rad/s`, sub: `${fmtFix(gy.rpmP, 1)} RPM · T = ${fmtFix(gy.periodP, 2)} s`, tone: 'acc' },
        { lbl: 'Açısal Momentum Lₛ', val: `${fmtFix(gy.Ls, 3)} N·m·s`, sub: `Iₛ = ${fmtUnit(gy.Is, 'kg·m²', 3)}` },
        { lbl: 'Ağırlık Torku τ', val: `${fmtFix(gy.torque, 3)} N·m`, sub: `Eğim θ = ${st.tiltDeg}°` },
        { lbl: 'Kararlılık Oranı', val: fmtFix(gy.fastTopRatio, 1), sub: 'Lₛ² / (4 I⊥ mgr cos θ) > 4' },
      ]);
    } else {
      const Leq = getLeq();
      const per = pendulumPeriods(Leq, st.theta0Deg * RAD, st.g);
      tagEl.textContent = st.mode === 'simple' ? `Hata: %${fmtFix(per.relErrPct, 1)}` : `L_eş = ${fmtFix(Leq, 2)} m`;
      tagEl.className = `slm-badge ${per.relErrPct < 2 ? 'slm-badge-ok' : 'slm-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'Gerçek Periyot T', val: `${fmtFix(per.Texact, 3)} s`, sub: `T/T₀ = ${fmtFix(per.ratio, 3)}`, tone: 'acc' },
        { lbl: 'Küçük Açı T₀', val: `${fmtFix(per.T0, 3)} s`, sub: `Sapma: %${fmtFix(per.relErrPct, 2)}`, tone: per.relErrPct > 5 ? 'warn' : 'ok' },
        { lbl: 'Eşdeğer Boy L_eş', val: `${fmtFix(Leq, 3)} m`, sub: `ω₀ = ${fmtFix(per.w0, 2)} rad/s` },
        { lbl: 'Anlık Açı θ', val: `${fmtFix(st.yNL[0] * DEG, 1)}°`, sub: `ω = ${fmtFix(st.yNL[1], 2)} rad/s` },
      ]);
    }
  }

  function drawPlot() {
    if (st.mode === 'gyro') return;
    const Leq = getLeq();
    const per = pendulumPeriods(Leq, st.theta0Deg * RAD, st.g);
    const tMax = Math.max(6, per.Texact * 2.5);
    const ts = [], ynl = [], ylin = [];
    let y = [st.theta0Deg * RAD, 0];
    const N = 260, dt = tMax / N;
    for (let i = 0; i <= N; i++) {
      const t = i * dt;
      ts.push(t);
      ynl.push(y[0] * DEG);
      ylin.push(st.theta0Deg * Math.cos(per.w0 * t));
      y = pendulumStep({ Leq, g: st.g }, y, dt);
    }
    safePlot(cp, [
      { name: 'Tam θ(t)', color: COL_OK, xs: ts, ys: ynl },
      { name: 'Küçük açı', color: COL_WARN, xs: ts, ys: ylin },
    ], { x0: 0, x1: tMax, ylabel: 'θ (°)', height: 175 });
  }

  function resetSim() {
    st.simT = 0;
    st.yNL = [st.theta0Deg * RAD, 0];
    st.precAng = 0;
    updateKPIs();
    drawPlot();
    mainCv.render();
  }

  const mainCv = setupCanvas(cv, w => Math.min(300, Math.max(220, w * 0.48)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'gyro') {
      const gy = gyroscopePrecession({ m: st.m, R: Math.min(0.25, st.R), r: st.rPivot, rpm: st.rpm, tiltDeg: st.tiltDeg, shape: st.gShape, g: st.g });
      const ox = W * 0.5, oy = H * 0.64;
      const tilt = st.tiltDeg * RAD;
      const armLen = Math.min(W, H) * 0.34;
      // 3D perspective projection
      const proj = (x, y, z) => ({ x: ox + x - y * 0.32, y: oy - z + y * 0.24 });

      // Precession base pedestal
      drawGroundHatch(c, ox - 30, oy + 26, ox + 30, oy + 26, 1);
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(ox, oy + 26); c.lineTo(ox, oy); c.stroke();

      // Precession circle trace in 3D
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = `${acc}66`; c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = (2 * Math.PI * i) / 60;
        const p = proj(armLen * Math.sin(tilt) * Math.cos(a), armLen * Math.sin(tilt) * Math.sin(a), armLen * Math.cos(tilt));
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.stroke(); c.restore();

      // Rotor axle tip
      const ax = armLen * Math.sin(tilt) * Math.cos(st.precAng);
      const ay = armLen * Math.sin(tilt) * Math.sin(st.precAng);
      const az = armLen * Math.cos(tilt);
      const pTip = proj(ax, ay, az);
      const pRotor = proj(ax * 0.72, ay * 0.72, az * 0.72);
      const pBase = proj(0, 0, 0);

      // Axle
      c.strokeStyle = COL_FG; c.lineWidth = 3.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pBase.x, pBase.y); c.lineTo(pTip.x, pTip.y); c.stroke();

      // Spinning flywheel ellipse oriented perpendicular to axle
      const rotR = Math.min(48, Math.max(22, Math.min(0.25, st.R) * 260));
      const ang2D = Math.atan2(pTip.y - pBase.y, pTip.x - pBase.x);
      c.save();
      c.translate(pRotor.x, pRotor.y);
      c.rotate(ang2D + Math.PI / 2);
      c.fillStyle = `${COL_BLUE}28`; c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
      c.beginPath(); c.ellipse(0, 0, rotR, rotR * 0.34, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      // Spinning spoke dots
      for (let k = 0; k < 4; k++) {
        const sa = st.spinAng + (k * Math.PI) / 2;
        const sx = rotR * 0.75 * Math.cos(sa), sy = rotR * 0.25 * Math.sin(sa);
        c.fillStyle = k === 0 ? acc : COL_FG;
        c.beginPath(); c.arc(sx, sy, 2.8, 0, Math.PI * 2); c.fill();
      }
      c.restore();

      // Vectors: L along axle, gravity downward, precession Omega_p vertical
      drawArrow(c, pTip.x, pTip.y, pTip.x + (pTip.x - pBase.x) * 0.3, pTip.y + (pTip.y - pBase.y) * 0.3, acc, 2, 'Lₛ');
      drawArrow(c, pRotor.x, pRotor.y, pRotor.x, pRotor.y + 38, COL_BAD, 1.8, 'mg');
      drawArrow(c, ox, oy - 24, ox, oy - 74, COL_OK, 2, 'Ωₚ');
      drawPin(c, ox, oy, 5, '#0b0b10', COL_FG);
      tnow.textContent = `Ωₚ = ${fmtFix(gy.omegaP, 2)} rad/s`;
    } else {
      const Leq = getLeq();
      const per = pendulumPeriods(Leq, st.theta0Deg * RAD, st.g);
      const px = W * 0.5, py = 36;
      const rodLen = Math.min(H - 64, W * 0.42);
      const thNL = st.yNL[0];
      const thLin = st.theta0Deg * RAD * Math.cos(per.w0 * st.simT);

      drawGroundHatch(c, px - 36, py, px + 36, py, -1);
      // Vertical ref
      c.save(); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255,255,255,.15)';
      c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + rodLen + 14); c.stroke(); c.restore();

      // Ghost small-angle pendulum
      const gx = px + rodLen * Math.sin(thLin), gy = py + rodLen * Math.cos(thLin);
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = COL_WARN; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, py); c.lineTo(gx, gy); c.stroke();
      c.setLineDash([]); c.strokeStyle = COL_WARN; c.fillStyle = 'rgba(255,209,102,.18)';
      c.beginPath(); c.arc(gx, gy, 10, 0, Math.PI * 2); c.fill(); c.stroke();
      c.restore();

      // Solid nonlinear pendulum (simple or physical rigid body)
      const bx = px + rodLen * Math.sin(thNL), by = py + rodLen * Math.cos(thNL);
      if (st.mode === 'simple') {
        c.strokeStyle = COL_OK; c.lineWidth = 3;
        c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke();
        c.fillStyle = 'rgba(91,228,155,.28)'; c.strokeStyle = COL_OK; c.lineWidth = 2.2;
        c.beginPath(); c.arc(bx, by, 13, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        c.save();
        c.translate(px, py); c.rotate(-thNL);
        if (st.shape === 'rod') {
          c.fillStyle = 'rgba(91,228,155,.18)'; c.strokeStyle = COL_OK; c.lineWidth = 2;
          c.fillRect(-6, 0, 12, rodLen); c.strokeRect(-6, 0, 12, rodLen);
          // Mark center of mass (L/2) and center of percussion (2L/3)
          drawPin(c, 0, rodLen * 0.5, 4, COL_WARN, '#000');
          drawPin(c, 0, rodLen * (2 / 3), 4, acc, '#fff');
        } else {
          const rPx = rodLen * 0.45;
          c.strokeStyle = COL_OK; c.lineWidth = st.shape === 'ring' ? 5 : 2;
          c.fillStyle = 'rgba(91,228,155,.15)';
          c.beginPath(); c.arc(0, rPx, rPx, 0, Math.PI * 2);
          if (st.shape === 'disk') c.fill();
          c.stroke();
          drawPin(c, 0, rPx, 4, COL_WARN, '#000');
        }
        c.restore();
      }
      drawPin(c, px, py, 5, '#0b0b10', COL_FG);
      tnow.textContent = `t = ${st.simT.toFixed(2)} s · Δθ = ${fmtFix((thNL - thLin) * DEG, 1)}°`;
    }
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    if (st.mode === 'gyro') {
      const gy = gyroscopePrecession({ m: st.m, R: Math.min(0.25, st.R), r: st.rPivot, rpm: st.rpm, tiltDeg: st.tiltDeg, shape: st.gShape, g: st.g });
      st.precAng = (st.precAng + Math.min(8, gy.omegaP) * dt) % (Math.PI * 200);
      st.spinAng = (st.spinAng + 14 * dt) % (Math.PI * 200);
    } else {
      const Leq = getLeq();
      const sub = 6, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        st.yNL = pendulumStep({ Leq, g: st.g }, st.yNL, h);
        st.simT += h;
      }
      updateKPIs();
    }
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isS = st.mode === 'simple', isP = st.mode === 'physical', isG = st.mode === 'gyro';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sL.setVisible(isS || (isP && st.shape === 'rod'));
    sTh0.setVisible(!isG);
    sG.setVisible(true);
    selShape.setVisible(isP);
    sR.setVisible((isP && st.shape !== 'rod') || isG);
    sM.setVisible(!isS);
    sRp.setVisible(isG); sRpm.setVisible(isG); sTilt.setVisible(isG);
    pcard.hidden = isG;
    host.querySelector('[data-cvtitle]').textContent = isS
      ? 'Büyük Açı (Yeşil) vs Küçük Açı (Sarı Hayalet)'
      : isP ? 'Fiziksel Sarkaç (Ağırlık Merkezi & Darbe Merkezi)' : '3D Jiroskop Presesyonu';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', resetSim);
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    if (st.mode === 'gyro' && st.R > 0.25) { st.R = 0.12; sR.set(0.12); }
    syncMode(); resetSim(); syncSegments(host, false);
  });
  selShape.el.querySelector('select').addEventListener('change', () => syncMode());
  bindPresets(host, PEND_PRESETS, p => {
    Object.assign(st, p);
    sL.set(st.L); sTh0.set(st.theta0Deg); sG.set(st.g); selShape.set(st.shape);
    sR.set(st.R); sM.set(st.m); sRp.set(st.rPivot); sRpm.set(st.rpm); sTilt.set(st.tiltDeg);
    syncMode(); resetSim();
  });

  attachReadout(cp, host.querySelector('[data-rp]'), (x, ser, i) => `t=${fmtFix(x, 2)}s · Tam=${fmtFix(ser[0].ys[i], 1)}° · Küçük=${fmtFix(ser[1].ys[i], 1)}°`, clean);
  observeResize(host.querySelector('[data-bp]'), drawPlot, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  resetSim();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 9. TERMODİNAMİK ÇEVRİMLER (Otto, Diesel, Brayton, Carnot, Rankine, VCR)
// =====================================================================

const THERMO_PRESETS = [
  { label: 'Benzinli Otto (r=9.5)', type: 'otto', r: 9.5, T1: 300, T3: 2200, gamma: 1.4 },
  { label: 'Dizel (r=18, rc=2.2)', type: 'diesel', r: 18, rc: 2.2, T1: 300, gamma: 1.4 },
  { label: 'Gaz Türbini Brayton', type: 'brayton', rp: 12, T1: 300, T3: 1450, gamma: 1.4 },
  { label: 'Buhar Santrali Rankine', type: 'rankine', Pboil: 8000, Pcond: 10, T3_C: 500 },
  { label: 'Soğutma (R-134a)', type: 'vcr', Tevap: -10, Tcond: 40 },
];

function mountThermoCycles(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    type: 'otto', r: 9.5, rc: 2.2, rp: 12, rIso: 2.5,
    T1: 300, T3: 2200, TL: 300, TH: 900, gamma: 1.4,
    Pboil: 5000, Pcond: 10, T3_C: 450,
    Tevap: -10, Tcond: 40,
    playing: autoPlayAllowed(), phase: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Otto, Diesel, Brayton, Carnot, Rankine (su buharı)</b> ve <b>buhar sıkıştırmalı soğutma (R-134a)</b> çevrimlerinin canlı <b>P–v</b> ve <b>T–s</b> diyagramlarını, durum tablosunu ve verim/COP değerlerini incele.', THERMO_PRESETS)}
    <div class="slm-toolbar">
      <div class="seg slm-seg-wrap" data-ctype role="tablist" aria-label="Termodinamik çevrim seçimi">
        <button type="button" data-c="otto" class="on">Otto</button>
        <button type="button" data-c="diesel">Diesel</button>
        <button type="button" data-c="brayton">Brayton</button>
        <button type="button" data-c="carnot">Carnot</button>
        <button type="button" data-c="rankine">Rankine</button>
        <button type="button" data-c="vcr">Soğutma (VCR)</button>
      </div>
      <button type="button" class="btn small primary" data-play></button>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-grid-2">
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">P – v Diyagramı</h4><span class="slm-hint mono" data-pvtag>kPa vs m³/kg</span></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cvpv aria-label="P-v termodinamik diyagramı"></canvas></div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">T – s Diyagramı</h4><span class="slm-hint mono">K vs kJ/(kg·K)</span></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cvts aria-label="T-s termodinamik diyagramı"></canvas></div>
          </div>
        </div>
        <div class="slm-table-wrap">
          <table class="slm-tbl" aria-label="Termodinamik durum noktaları tablosu">
            <thead><tr><th>Durum</th><th>T (K / °C)</th><th>P (kPa)</th><th>v (m³/kg)</th><th>s (kJ/kg·K)</th><th>h / Kuruluk</th></tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\eta_{\\text{Otto}} = 1 - r^{1-\\gamma}, \\qquad \\eta_{\\text{Brayton}} = 1 - r_p^{-(\\gamma-1)/\\gamma}, \\qquad \\eta_{\\text{Carnot}} = 1 - \\frac{T_L}{T_H}',
        '\\eta_{\\text{Rankine}} = \\frac{(h_3 - h_4) - v_1(P_{\\text{kaz}} - P_{\\text{yoğ}})}{h_3 - h_2}, \\qquad \\text{COP}_R = \\frac{h_1 - h_4}{h_2 - h_1} < \\frac{T_L}{T_H - T_L}',
      ],
      paragraphs: [
        'Kapalı bir güç çevriminde **P–v eğrisinin iç alanı** net işi ($w_{\\text{net}} = \\oint P\\,dv$), **T–s eğrisinin iç alanı** ise net ısı girişini ($q_{\\text{net}} = \\oint T\\,ds = w_{\\text{net}}$) verir.',
        '**Rankine** çevriminde su buharı doyma kubbesi içinde yoğuşur; türbin çıkışında kuruluk derecesi $x_4$’ün $\\ge 0.88$ tutulması kanat erozyonunu önler. **Buhar sıkıştırmalı soğutmada** (R-134a) 3→4 kısılma vanası izentalpiktir ($h_4=h_3$) ve tersinmez olduğundan entropi artar.',
      ],
      tasks: [
        'Otto çevriminde sıkıştırma oranını $r=7$’den $r=12$’ye çıkarıp verim artışını ve maksimum sıcaklık/basınç değişimini kıyaslayın.',
        'Rankine çevriminde kazan sıcaklığını $T_3$ yükselterek türbin çıkış kuruluğu $x_4$’ün nasıl iyileştiğini T–s kubbesinde izleyin.',
        'Soğutma (VCR) çevriminde buharlaştırıcı sıcaklığı $T_{\\text{evap}}$ düştükçe $\\text{COP}_R$ değerinin neden hızla azaldığını inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const tbody = host.querySelector('[data-tbody]');
  const playBtn = host.querySelector('[data-play]');
  const cvPV = host.querySelector('[data-cvpv]');
  const cvTS = host.querySelector('[data-cvts]');

  const sR = addSlider(ctrls, { label: 'Sıkıştırma Oranı r', min: 4, max: 22, value: st.r, step: 0.5, onInput: v => { st.r = v; update(); } });
  const sRc = addSlider(ctrls, { label: 'Kesme Oranı r_c', min: 1.2, max: 4.0, value: st.rc, step: 0.1, onInput: v => { st.rc = v; update(); } });
  const sRp = addSlider(ctrls, { label: 'Basınç Oranı r_p', min: 2, max: 28, value: st.rp, step: 0.5, onInput: v => { st.rp = v; update(); } });
  const sT1 = addSlider(ctrls, { label: 'Giriş Sıcaklığı T₁', unit: 'K', min: 250, max: 400, value: st.T1, step: 5, onInput: v => { st.T1 = v; update(); } });
  const sT3 = addSlider(ctrls, { label: 'Maks. Sıcaklık T₃', unit: 'K', min: 900, max: 2600, value: st.T3, step: 25, onInput: v => { st.T3 = v; update(); } });
  const sGam = addSlider(ctrls, { label: 'Adyabatik Üs γ', min: 1.25, max: 1.67, value: st.gamma, step: 0.01, fmt: v => v.toFixed(2), onInput: v => { st.gamma = v; update(); } });
  const sTL = addSlider(ctrls, { label: 'Soğuk Rezervuar T_L', unit: 'K', min: 220, max: 500, value: st.TL, step: 10, onInput: v => { st.TL = v; update(); } });
  const sTH = addSlider(ctrls, { label: 'Sıcak Rezervuar T_H', unit: 'K', min: 550, max: 1600, value: st.TH, step: 25, onInput: v => { st.TH = v; update(); } });
  const sPb = addSlider(ctrls, { label: 'Kazan Basıncı P_kaz', unit: 'kPa', min: 500, max: 16000, value: st.Pboil, step: 250, onInput: v => { st.Pboil = v; update(); } });
  const sPc = addSlider(ctrls, { label: 'Yoğuşturucu P_yoğ', unit: 'kPa', min: 5, max: 200, value: st.Pcond, step: 5, onInput: v => { st.Pcond = v; update(); } });
  const sT3c = addSlider(ctrls, { label: 'Türbin Giriş T₃', unit: '°C', min: 260, max: 620, value: st.T3_C, step: 10, onInput: v => { st.T3_C = v; update(); } });
  const sTev = addSlider(ctrls, { label: 'Buharlaştırıcı T_evap', unit: '°C', min: -30, max: 10, value: st.Tevap, step: 1, onInput: v => { st.Tevap = v; update(); } });
  const sTco = addSlider(ctrls, { label: 'Yoğuşturucu T_yoğ', unit: '°C', min: 25, max: 70, value: st.Tcond, step: 1, onInput: v => { st.Tcond = v; update(); } });

  let cyc = null;

  function drawThermoDiagram(c, W, H, pts, dome, states, { logX = false, logY = false, xLbl = '', yLbl = '', col = COL_BLUE }) {
    c.clearRect(0, 0, W, H);
    const L = 46, R = 14, T = 14, B = 28, pw = W - L - R, ph = H - T - B;
    const all = dome ? [...pts, ...dome] : pts;
    const xs = all.map(p => (logX ? Math.log10(Math.max(1e-5, p[0])) : p[0]));
    const ys = all.map(p => (logY ? Math.log10(Math.max(1e-3, p[1])) : p[1]));
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x1 - x0 < 1e-6) { x0 -= 1; x1 += 1; }
    if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
    const pxPad = (x1 - x0) * 0.1, pyPad = (y1 - y0) * 0.12;
    x0 -= pxPad; x1 += pxPad; y0 -= pyPad; y1 += pyPad;

    const fx = v => L + (((logX ? Math.log10(Math.max(1e-5, v)) : v) - x0) / (x1 - x0)) * pw;
    const fy = v => T + ((y1 - (logY ? Math.log10(Math.max(1e-3, v)) : v)) / (y1 - y0)) * ph;

    // Grid & axes
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gx = L + (pw * i) / 4, gy = T + (ph * i) / 4;
      c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
    }
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(L, T); c.lineTo(L, T + ph); c.lineTo(L + pw, T + ph); c.stroke();

    // Saturation dome (Rankine / VCR)
    if (dome) {
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.4;
      c.beginPath();
      dome.forEach((p, i) => { const x = fx(p[0]), y = fy(p[1]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
      c.stroke(); c.restore();
    }

    // Cycle fill & contour
    c.save();
    c.beginPath();
    pts.forEach((p, i) => { const x = fx(p[0]), y = fy(p[1]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.closePath();
    c.fillStyle = `${col}1c`; c.fill();
    c.strokeStyle = col; c.lineWidth = 2.2; c.stroke();
    c.restore();

    // Animated tracer dot
    if (pts.length > 1) {
      const idx = Math.floor(st.phase * (pts.length - 1));
      const p = pts[idx];
      drawPin(c, fx(p[0]), fy(p[1]), 4.5, accentColor(), '#fff');
    }

    // State numbered dots 1..4
    states.forEach(s => {
      const px = fx(s.x), py = fy(s.y);
      drawPin(c, px, py, 4, '#0b0b10', COL_FG);
      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace';
      c.fillText(String(s.id), px + 6, py - 5);
    });

    // Axis captions
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
    c.textAlign = 'right';
    c.fillText(fmtNum(logY ? 10 ** y1 : y1, 3), L - 4, T + 9);
    c.fillText(fmtNum(logY ? 10 ** y0 : y0, 3), L - 4, T + ph);
    c.textAlign = 'center';
    c.fillText(xLbl, L + pw * 0.5, H - 6);
    c.save(); c.translate(12, T + ph * 0.5); c.rotate(-Math.PI / 2); c.fillText(yLbl, 0, 0); c.restore();
    c.textAlign = 'left';
  }

  const pvCv = setupCanvas(cvPV, w => Math.min(255, Math.max(200, w * 0.72)), (c, W, H) => {
    if (!cyc) return;
    const isLog = st.type === 'rankine' || st.type === 'vcr';
    drawThermoDiagram(c, W, H, cyc.pv, cyc.domePV, cyc.states.map(s => ({ id: s.id, x: s.v, y: s.P })), {
      logX: isLog, logY: isLog, xLbl: isLog ? 'log v (m³/kg)' : 'v (m³/kg)', yLbl: isLog ? 'log P (kPa)' : 'P (kPa)', col: COL_BLUE,
    });
  }, clean);

  const tsCv = setupCanvas(cvTS, w => Math.min(255, Math.max(200, w * 0.72)), (c, W, H) => {
    if (!cyc) return;
    drawThermoDiagram(c, W, H, cyc.ts, cyc.domeTS, cyc.states.map(s => ({ id: s.id, x: s.s, y: s.T })), {
      logX: false, logY: false, xLbl: 's (kJ/kg·K)', yLbl: 'T (K)', col: COL_WARN,
    });
  }, clean);

  function update() {
    cyc = solveThermoCycle(st);
    if (cyc.isRefrig) {
      renderKpis(kpis, [
        { lbl: 'Soğutma COP_R', val: fmtFix(cyc.copR, 2), sub: `Carnot: ${fmtFix(cyc.copCarnot, 2)}`, tone: 'acc' },
        { lbl: 'Isı Pompası COP_HP', val: fmtFix(cyc.copHP, 2), sub: 'COP_R + 1', tone: 'ok' },
        { lbl: 'Soğutma Etkisi q_L', val: `${fmtFix(cyc.qL, 1)} kJ/kg`, sub: `Kompresör w = ${fmtFix(cyc.wIn, 1)} kJ/kg` },
        { lbl: 'Kısılma Kuruluğu x₄', val: fmtFix(cyc.x4, 3), sub: `%${fmtFix(cyc.x4 * 100, 1)} buhar` },
      ]);
    } else {
      renderKpis(kpis, [
        { lbl: 'Isıl Verim η', val: `%${fmtFix(cyc.eff * 100, 1)}`, sub: `Carnot sınırı: %${fmtFix(cyc.carnotEff * 100, 1)}`, tone: 'acc' },
        { lbl: 'Net İş w_net', val: `${fmtFix(cyc.wNet, 1)} kJ/kg`, sub: `q_gir = ${fmtFix(cyc.qIn, 1)} kJ/kg`, tone: 'ok' },
        { lbl: 'Atılan Isı q_çık', val: `${fmtFix(cyc.qOut, 1)} kJ/kg`, sub: cyc.mep ? `MEP = ${fmtFix(cyc.mep, 0)} kPa` : cyc.bwr !== undefined ? `BWR = %${fmtFix(cyc.bwr * 100, 1)}` : '' },
        { lbl: st.type === 'rankine' ? 'Türbin Kuruluğu x₄' : 'Sıcaklık Oranı T_max/T_min', val: st.type === 'rankine' ? fmtFix(cyc.x4, 3) : fmtFix(Math.max(...cyc.states.map(s => s.T)) / Math.min(...cyc.states.map(s => s.T)), 2), sub: st.type === 'rankine' ? (cyc.x4 >= 0.88 ? 'Güvenli' : 'Nemli türbin!') : '' },
      ]);
    }
    tbody.innerHTML = cyc.states.map(s => `<tr>
      <td class="mono"><b>${s.id}</b></td>
      <td class="mono">${fmtFix(s.T, 1)} K <span class="mute">(${fmtFix(s.T - 273.15, 1)} °C)</span></td>
      <td class="mono">${fmtFix(s.P, 1)}</td>
      <td class="mono">${fmtNum(s.v, 3)}</td>
      <td class="mono">${fmtFix(s.s, 3)}</td>
      <td class="mono">${s.h !== undefined ? `${fmtFix(s.h, 1)} kJ/kg` : '—'}${s.x !== undefined && s.x !== null ? ` · x=${fmtFix(s.x, 2)}` : ''}</td>
    </tr>`).join('');
    pvCv.render();
    tsCv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.phase = (st.phase + dt * 0.22) % 1;
    pvCv.render(); tsCv.render();
    return true;
  }, clean);

  function syncMode() {
    const t = st.type;
    host.querySelectorAll('[data-ctype] button').forEach(b => b.classList.toggle('on', b.dataset.c === t));
    sR.setVisible(t === 'otto' || t === 'diesel');
    sRc.setVisible(t === 'diesel');
    sRp.setVisible(t === 'brayton');
    sT1.setVisible(t === 'otto' || t === 'diesel' || t === 'brayton');
    sT3.setVisible(t === 'otto' || t === 'brayton');
    sGam.setVisible(t === 'otto' || t === 'diesel' || t === 'brayton' || t === 'carnot');
    sTL.setVisible(t === 'carnot'); sTH.setVisible(t === 'carnot');
    sPb.setVisible(t === 'rankine'); sPc.setVisible(t === 'rankine'); sT3c.setVisible(t === 'rankine');
    sTev.setVisible(t === 'vcr'); sTco.setVisible(t === 'vcr');
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-ctype]').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b || b.dataset.c === st.type) return;
    st.type = b.dataset.c; syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, THERMO_PRESETS, p => {
    Object.assign(st, p);
    sR.set(st.r); sRc.set(st.rc); sRp.set(st.rp); sT1.set(st.T1); sT3.set(st.T3); sGam.set(st.gamma);
    sTL.set(st.TL); sTH.set(st.TH); sPb.set(st.Pboil); sPc.set(st.Pcond); sT3c.set(st.T3_C);
    sTev.set(st.Tevap); sTco.set(st.Tcond);
    syncMode(); update();
  });

  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 10. İDEAL GAZ & KİNETİK TEORİ (Piston Molecules, Processes, Maxwell-Boltzmann)
// =====================================================================

const GAS_PRESETS = [
  { label: 'İzotermal Genleşme', process: 'isothermal', gas: 'n2', nMol: 1.0, T1: 300, V1: 0.025, V2: 0.055, T2Isochoric: 500 },
  { label: 'Adyabatik Sıkıştırma', process: 'adiabatic', gas: 'n2', nMol: 1.0, T1: 300, V1: 0.055, V2: 0.018, T2Isochoric: 500 },
  { label: 'İzobarik Isıtma', process: 'isobaric', gas: 'co2', nMol: 1.0, T1: 280, V1: 0.025, V2: 0.055, T2Isochoric: 500 },
  { label: 'Helyum Yüksek Hız (600 K)', process: 'isochoric', gas: 'he', nMol: 1.0, T1: 300, V1: 0.03, V2: 0.03, T2Isochoric: 650 },
];

function mountIdealGas(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    process: 'adiabatic', gas: 'n2', nMol: 1.0, T1: 300, V1: 0.05, V2: 0.02, T2Isochoric: 550,
    playing: autoPlayAllowed(),
  };

  // Initialize 44 2D gas molecules in normalized box [0,1] x [0,1]
  const rng = makeRng(2026);
  const mols = Array.from({ length: 44 }, () => {
    const a = rng() * Math.PI * 2;
    const spd = 0.5 + rng() * 1.1;
    return { x: 0.1 + rng() * 0.8, y: 0.1 + rng() * 0.8, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd };
  });

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('Hareketli piston içindeki gaz moleküllerini canlı izle; <b>izotermal, adyabatik, izobarik ve izokorik</b> süreçlerde iş ($W$), ısı ($Q$) ve <b>Maxwell–Boltzmann hız dağılımını</b> karşılaştır.', GAS_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-proc role="tablist" aria-label="Termodinamik süreç">
          <button type="button" data-p="isothermal">İzotermal</button>
          <button type="button" data-p="adiabatic" class="on">Adyabatik</button>
          <button type="button" data-p="isobaric">İzobarik</button>
          <button type="button" data-p="isochoric">İzokorik</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
      </div>
      <span class="slm-badge slm-badge-acc" data-gasb></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-grid-2">
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Silindir-Piston & Molekül Hareketi</h4><span class="slm-hint mono" data-pinfo></span></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cvpist aria-label="Piston içindeki gaz molekülleri animasyonu"></canvas></div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">P – V Süreç Eğrisi (Taralı Alan = W)</h4></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cvpv aria-label="İdeal gaz P-V süreci"></canvas></div>
          </div>
        </div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Maxwell–Boltzmann Hız Dağılımı f(v)</h4>
            <div class="slm-legend">
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>Son Durum T₂</span>
              <span class="slm-legend-item"><i class="slm-legend-swatch slm-legend-dash" style="border-color:${COL_MUTE}"></i>İlk Durum T₁</span>
            </div>
          </div>
          <div class="slm-cv-box" data-bmb><canvas class="slm-cv" data-cmb aria-label="Maxwell-Boltzmann hız dağılımı grafiği"></canvas><div class="slm-readout" data-rmb></div></div>
          <div class="slm-axis-lbl">Molekül hızı v (m/s)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'PV = nRT, \\qquad \\Delta U = Q - W = n C_v \\Delta T, \\qquad P V^\\gamma = \\text{sabit (adyabatik)}',
        'f(v) = 4\\pi\\left(\\frac{M}{2\\pi R T}\\right)^{3/2} v^2 \\exp\\!\\left(-\\frac{Mv^2}{2RT}\\right), \\quad v_{\\text{rms}} = \\sqrt{\\frac{3RT}{M}}',
      ],
      paragraphs: [
        'İzotermal süreçte sıcaklık sabit olduğundan $\\Delta U = 0$ ve $Q = W = nRT\\ln(V_2/V_1)$ olur. **Adyabatik sıkıştırmada** ($Q=0$) yapılan iş doğrudan iç enerjiyi ve sıcaklığı yükseltir.',
        'Hafif gazlarda (Helyum) ve yüksek sıcaklıklarda **Maxwell–Boltzmann** dağılımı sağa kayar ve genişler; karakteristik hızlar daima $v_p < \\bar{v} < v_{\\text{rms}}$ sırasındadır.',
      ],
      tasks: [
        '**Adyabatik** ve **İzotermal** sıkıştırmayı aynı $V_1 \\to V_2$ oranında karşılaştırıp adyabatik eğrinin daha dik olduğunu ve sıcaklığın yükseldiğini doğrulayın.',
        'Gaz türünü **CO₂ → He** yapıp molar kütle küçüldükçe $v_{\\text{rms}}$ hızının $\\sqrt{M_{\\text{CO}_2}/M_{\\text{He}}} \\approx 3.3\\times$ arttığını gözlemleyin.',
        '**İzokorik** süreçte $W = 0$ ve $Q = \\Delta U$ eşitliğini KPI değerlerinden kontrol edin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const gasB = host.querySelector('[data-gasb]');
  const pinfo = host.querySelector('[data-pinfo]');
  const playBtn = host.querySelector('[data-play]');
  const cvPist = host.querySelector('[data-cvpist]');
  const cvPV = host.querySelector('[data-cvpv]');
  const cMB = host.querySelector('[data-cmb]');

  const selGas = addSelect(ctrls, 'Gaz Türü', Object.entries(GAS_SPECIES).map(([k, v]) => [k, `${v.name} (γ=${v.gamma.toFixed(2)})`]), st.gas, v => { st.gas = v; update(); });
  const sN = addSlider(ctrls, { label: 'Mol Sayısı n', unit: 'mol', min: 0.2, max: 3.0, value: st.nMol, step: 0.1, onInput: v => { st.nMol = v; update(); } });
  const sT1 = addSlider(ctrls, { label: 'Başlangıç Sıcaklığı T₁', unit: 'K', min: 150, max: 600, value: st.T1, step: 10, onInput: v => { st.T1 = v; update(); } });
  const sV1 = addSlider(ctrls, { label: 'Başlangıç Hacmi V₁', unit: 'L', min: 10, max: 80, value: st.V1 * 1000, step: 1, onInput: v => { st.V1 = v / 1000; update(); } });
  const sV2 = addSlider(ctrls, { label: 'Son Hacim V₂ (Piston)', unit: 'L', min: 10, max: 80, value: st.V2 * 1000, step: 1, onInput: v => { st.V2 = v / 1000; update(); } });
  const sT2 = addSlider(ctrls, { label: 'Son Sıcaklık T₂', unit: 'K', min: 150, max: 1000, value: st.T2Isochoric, step: 10, onInput: v => { st.T2Isochoric = v; update(); } });

  let proc = null, mb2 = null;

  const pistCv = setupCanvas(cvPist, w => Math.min(230, Math.max(180, w * 0.65)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!proc) return;
    const pad = 18;
    const cylX = pad, cylY = pad, cylW = W - 2 * pad, cylH = H - 2 * pad;
    const volFrac = Math.max(0.18, Math.min(0.92, (proc.V2 - 0.005) / 0.08));
    const wallX = cylX + cylW * volFrac;

    // Cylinder interior glow proportional to temperature
    const tNorm = Math.max(0, Math.min(1, (proc.T2 - 150) / 700));
    const [r, g, b] = thermalColorRGB(tNorm);
    c.fillStyle = `rgba(${r},${g},${b},0.14)`;
    c.fillRect(cylX, cylY, wallX - cylX, cylH);

    // Molecules colored by kinetic speed
    for (const m of mols) {
      const px = cylX + 6 + m.x * Math.max(8, wallX - cylX - 12);
      const py = cylY + 6 + m.y * (cylH - 12);
      const spd = Math.hypot(m.vx, m.vy);
      c.fillStyle = spd > 1.25 ? COL_WARN : spd > 0.85 ? COL_FG : COL_BLUE;
      c.beginPath(); c.arc(px, py, 3.2, 0, Math.PI * 2); c.fill();
    }

    // Cylinder walls & sliding piston
    c.strokeStyle = COL_FG; c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(cylX + cylW, cylY); c.lineTo(cylX, cylY); c.lineTo(cylX, cylY + cylH); c.lineTo(cylX + cylW, cylY + cylH);
    c.stroke();

    c.fillStyle = 'rgba(255,255,255,.16)'; c.strokeStyle = accentColor(); c.lineWidth = 2.2;
    c.fillRect(wallX, cylY + 2, 14, cylH - 4);
    c.strokeRect(wallX, cylY + 2, 14, cylH - 4);
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(wallX + 14, cylY + cylH / 2); c.lineTo(cylX + cylW + 6, cylY + cylH / 2); c.stroke();
    pinfo.textContent = `T₂=${fmtFix(proc.T2, 0)}K · P₂=${fmtFix(proc.P2 / 1000, 1)}kPa`;
  }, clean);

  const pvCv = setupCanvas(cvPV, w => Math.min(230, Math.max(180, w * 0.65)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!proc) return;
    const L = 46, R = 14, T = 14, B = 28, pw = W - L - R, ph = H - T - B;
    const vMin = 0.005, vMax = 0.088;
    const pMax = Math.max(proc.P1, proc.P2, 220e3) * 1.15;
    const fx = v => L + ((v - vMin) / (vMax - vMin)) * pw;
    const fy = p => T + (1 - p / pMax) * ph;

    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gx = L + (pw * i) / 4, gy = T + (ph * i) / 4;
      c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
    }
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(L, T); c.lineTo(L, T + ph); c.lineTo(L + pw, T + ph); c.stroke();

    // Shaded work area under P(V)
    if (st.process !== 'isochoric') {
      c.fillStyle = proc.W >= 0 ? 'rgba(91,228,155,.16)' : 'rgba(255,107,107,.16)';
      c.beginPath();
      c.moveTo(fx(proc.vs[0]), fy(0));
      proc.vs.forEach((v, i) => c.lineTo(fx(v), fy(proc.ps[i])));
      c.lineTo(fx(proc.vs[proc.vs.length - 1]), fy(0));
      c.closePath(); c.fill();
    }

    c.strokeStyle = accentColor(); c.lineWidth = 2.4;
    c.beginPath();
    proc.vs.forEach((v, i) => { const x = fx(v), y = fy(proc.ps[i]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.stroke();

    drawPin(c, fx(proc.V1), fy(proc.P1), 4.5, '#0b0b10', COL_FG);
    drawPin(c, fx(proc.V2), fy(proc.P2), 5, COL_OK, '#fff');
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
    c.fillText('1', fx(proc.V1) + 6, fy(proc.P1) - 5);
    c.fillStyle = COL_OK; c.fillText('2', fx(proc.V2) + 6, fy(proc.P2) - 5);
    c.fillStyle = COL_MUTE; c.textAlign = 'center';
    c.fillText('V (L)', L + pw * 0.5, H - 6);
    c.textAlign = 'right';
    c.fillText(`${fmtFix(pMax / 1000, 0)}k`, L - 4, T + 10);
    c.fillText('0', L - 4, T + ph);
    c.textAlign = 'left';
  }, clean);

  function drawMBPlot() {
    if (!proc) return;
    const sp = GAS_SPECIES[st.gas];
    const vMax = Math.max(Math.sqrt((3 * R_UNIV * Math.max(proc.T1, proc.T2)) / sp.M) * 2.4, 1400);
    const mb1 = maxwellBoltzmann(proc.T1, sp.M, vMax, 180);
    mb2 = maxwellBoltzmann(proc.T2, sp.M, vMax, 180);
    const yPeak = Math.max(...mb1.pdf, ...mb2.pdf) * 1.05;
    safePlot(cMB, [
      { name: 'f(v) @ T₂', color: COL_OK, xs: mb2.vs, ys: mb2.pdf.map(y => y * 1000) },
      { name: 'f(v) @ T₁', color: 'rgba(255,255,255,.35)', xs: mb1.vs, ys: mb1.pdf.map(y => y * 1000) },
      { name: 'v_rms', color: COL_WARN, xs: [mb2.vRms, mb2.vRms], ys: [0, yPeak * 950] },
    ], { x0: 0, x1: vMax, ylabel: '×10⁻³ s/m', height: 175 });
  }

  function update() {
    const sp = GAS_SPECIES[st.gas];
    proc = idealGasProcess({ process: st.process, nMol: st.nMol, T1: st.T1, V1: st.V1, V2: st.V2, T2Isochoric: st.T2Isochoric, gamma: sp.gamma });
    const mb = maxwellBoltzmann(proc.T2, sp.M, 2000, 10);
    gasB.textContent = `${sp.name.split(' ')[0]} · γ = ${sp.gamma.toFixed(2)}`;

    renderKpis(kpis, [
      { lbl: 'Yapılan İş W', val: fmtUnit(proc.W, 'J', 3), sub: proc.W >= 0 ? 'Genleşme (+W)' : 'Sıkıştırma (−W)', tone: 'acc' },
      { lbl: 'Isı Transferi Q', val: fmtUnit(proc.Q, 'J', 3), sub: `ΔU = ${fmtUnit(proc.dU, 'J', 3)}` },
      { lbl: 'Son Durum (P₂, T₂)', val: `${fmtFix(proc.P2 / 1000, 1)} kPa`, sub: `T₂ = ${fmtFix(proc.T2, 1)} K · ΔS = ${fmtFix(proc.dS, 2)} J/K`, tone: 'ok' },
      { lbl: 'Kinetik Hız v_rms', val: `${fmtFix(mb.vRms, 0)} m/s`, sub: `v_p=${fmtFix(mb.vp, 0)} · v̄=${fmtFix(mb.vMean, 0)} m/s` },
    ]);
    pistCv.render(); pvCv.render(); drawMBPlot();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || !proc) return false;
    const sp = GAS_SPECIES[st.gas];
    const speedScale = Math.sqrt(proc.T2 / 300) * Math.sqrt(0.028 / sp.M) * 0.65;
    for (const m of mols) {
      m.x += m.vx * speedScale * dt;
      m.y += m.vy * speedScale * dt;
      if (m.x < 0) { m.x = -m.x; m.vx = Math.abs(m.vx); }
      if (m.x > 1) { m.x = 2 - m.x; m.vx = -Math.abs(m.vx); }
      if (m.y < 0) { m.y = -m.y; m.vy = Math.abs(m.vy); }
      if (m.y > 1) { m.y = 2 - m.y; m.vy = -Math.abs(m.vy); }
    }
    pistCv.render();
    return true;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-proc] button').forEach(b => b.classList.toggle('on', b.dataset.p === st.process));
    sV2.setVisible(st.process !== 'isochoric');
    sT2.setVisible(st.process === 'isochoric');
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-proc]').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b || b.dataset.p === st.process) return;
    st.process = b.dataset.p; syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, GAS_PRESETS, p => {
    Object.assign(st, p);
    selGas.set(st.gas); sN.set(st.nMol); sT1.set(st.T1); sV1.set(st.V1 * 1000); sV2.set(st.V2 * 1000); sT2.set(st.T2Isochoric);
    syncMode(); update();
  });

  attachReadout(cMB, host.querySelector('[data-rmb]'), (x, ser, i) => `v=${fmtFix(x, 0)} m/s · f(v)=${fmtFix(ser[0].ys[i], 3)}×10⁻³`, clean);
  observeResize(host.querySelector('[data-bmb]'), drawMBPlot, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 11. ISI İLETİMİ (1D Transient FTCS, 2D Steady Laplace, Composite Wall)
// =====================================================================

const HEAT_PRESETS = [
  { label: '1D Kararlı Adım (Fo=0.25)', mode: '1d', profile: 'uniform', TL: 120, TR: 20, alphaMm: 20, dt: 0.31 },
  { label: '1D Kararsız FTCS (Fo=0.58!)', mode: '1d', profile: 'pulse', TL: 20, TR: 20, alphaMm: 35, dt: 0.42 },
  { label: '2D Sıcak Üst Kenar (Laplace)', mode: '2d', Ttop: 120, Tbottom: 20, Tleft: 20, Tright: 20 },
  { label: '2D Çapraz Gradyan', mode: '2d', Ttop: 100, Tbottom: 10, Tleft: 80, Tright: 20 },
  { label: 'Yalıtımlı Bina Duvarı', mode: 'wall', Tin: 22, Tout: -8, hi: 10, ho: 25, L1: 0.2, k1: 0.72, L2: 0.08, k2: 0.035, L3: 0.03, k3: 1.4 },
];

function mountHeatConduction(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: '2d',
    // 1D transient (L = 0.2 m, N = 41 -> dx = 0.005 m)
    N1: 41, L1d: 0.2, profile: 'uniform', TL: 120, TR: 20, T0: 20, alphaMm: 20, dt: 0.31,
    playing: autoPlayAllowed(), simT: 0, T1d: null, Fo: 0.25, stable: true,
    // 2D steady Laplace
    Ttop: 120, Tbottom: 20, Tleft: 30, Tright: 30, nIso: 9, showFlux: true,
    // Composite wall
    Tin: 22, Tout: -8, hi: 10, ho: 25,
    L1: 0.20, k1: 0.72, L2: 0.08, k2: 0.035, L3: 0.03, k3: 1.4,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>1D geçici ısı iletimi</b> (açık sonlu fark ve Fourier kararlılık denetimi), <b>2D kararlı Laplace levhası</b> (sıcaklık haritası ve eşsıcaklık eğrileri) ile <b>kompozit duvar ısıl direnç ağını</b> canlı incele.', HEAT_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="Isı iletimi modları">
          <button type="button" data-m="1d">1D Geçici (FTCS)</button>
          <button type="button" data-m="2d" class="on">2D Levha (Laplace)</button>
          <button type="button" data-m="wall">Kompozit Duvar</button>
        </div>
        <button type="button" class="btn small primary" data-play hidden></button>
        <button type="button" class="btn small" data-reset hidden>${icon('rotate')} Sıfırla</button>
      </div>
      <span class="slm-badge slm-badge-ok" data-stab></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>2D Kararlı Sıcaklık Alanı & Eşsıcaklık Eğrileri</h4><span class="slm-hint mono" data-hover></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Isı iletimi görselleştirmesi"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{\\partial T}{\\partial t} = \\alpha\\frac{\\partial^2 T}{\\partial x^2}, \\quad T_i^{n+1} = T_i^n + \\text{Fo}\\,(T_{i-1}^n - 2T_i^n + T_{i+1}^n), \\quad \\text{Fo} = \\frac{\\alpha\\Delta t}{\\Delta x^2} \\le \\frac{1}{2}',
        '\\nabla^2 T = \\frac{\\partial^2 T}{\\partial x^2} + \\frac{\\partial^2 T}{\\partial y^2} = 0, \\qquad q\'\' = \\frac{T_{\\infty,i} - T_{\\infty,o}}{\\frac{1}{h_i} + \\sum\\frac{L_j}{k_j} + \\frac{1}{h_o}}',
      ],
      paragraphs: [
        'Açık sonlu fark (FTCS) yönteminde **Fourier sayısı $\\text{Fo} = \\alpha\\Delta t/\\Delta x^2 > 0.5$** olursa von Neumann kararlılık koşulu bozulur ve sayısal salınımlar büyüyerek çözümü patlatır.',
        '2D kararlı Laplace denkleminde her iç düğüm komşularının ortalamasına eşittir; **ısı akısı vektörleri $\\vec{q} = -k\\nabla T$** daima eşsıcaklık (izoterm) çizgilerine diktir.',
      ],
      tasks: [
        '**1D Geçici** modda zaman adımı $\\Delta t$’yi artırarak $\\text{Fo} > 0.5$ yapın ve sayısal kararsızlık testere dalgasını gözlemleyin.',
        '**2D Levha**da üst kenarı $100^\\circ\\text{C}$, diğer üç kenarı $0^\\circ\\text{C}$ yapıp merkez sıcaklığının tam $25^\\circ\\text{C}$ olduğunu doğrulayın.',
        '**Kompozit Duvar**da yalıtım katmanının ($k_2 = 0.035$) toplam dirençteki payını ve en dik sıcaklık düşümünün bu katmanda gerçekleştiğini inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const stabEl = host.querySelector('[data-stab]');
  const alertEl = host.querySelector('[data-alert]');
  const hoverEl = host.querySelector('[data-hover]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cv = host.querySelector('[data-cv]');

  // 1D controls
  const selProf = addSelect(ctrls, 'Başlangıç Profili', [['uniform', 'Tekdüze T₀ = 20 °C'], ['sine', 'Sinüs Modu'], ['pulse', 'Merkez Sıcak Darbe']], st.profile, v => { st.profile = v; reset1D(); });
  const sTL = addSlider(ctrls, { label: 'Sol Sınır T_L', unit: '°C', min: 0, max: 200, value: st.TL, step: 5, onInput: v => { st.TL = v; update1DMeta(); } });
  const sTR = addSlider(ctrls, { label: 'Sağ Sınır T_R', unit: '°C', min: 0, max: 200, value: st.TR, step: 5, onInput: v => { st.TR = v; update1DMeta(); } });
  const sAlp = addSlider(ctrls, { label: 'Isıl Yayılım α', unit: 'mm²/s', min: 2, max: 80, value: st.alphaMm, step: 1, onInput: v => { st.alphaMm = v; update1DMeta(); } });
  const sDt = addSlider(ctrls, { label: 'Zaman Adımı Δt', unit: 's', min: 0.05, max: 0.8, value: st.dt, step: 0.01, fmt: v => `${v.toFixed(2)} s`, onInput: v => { st.dt = v; update1DMeta(); } });

  // 2D controls
  const sTop = addSlider(ctrls, { label: 'Üst Kenar T_üst', unit: '°C', min: 0, max: 200, value: st.Ttop, step: 5, onInput: v => { st.Ttop = v; solve2D(); } });
  const sBot = addSlider(ctrls, { label: 'Alt Kenar T_alt', unit: '°C', min: 0, max: 200, value: st.Tbottom, step: 5, onInput: v => { st.Tbottom = v; solve2D(); } });
  const sLft = addSlider(ctrls, { label: 'Sol Kenar T_sol', unit: '°C', min: 0, max: 200, value: st.Tleft, step: 5, onInput: v => { st.Tleft = v; solve2D(); } });
  const sRgt = addSlider(ctrls, { label: 'Sağ Kenar T_sağ', unit: '°C', min: 0, max: 200, value: st.Tright, step: 5, onInput: v => { st.Tright = v; solve2D(); } });
  const tFlux = addToggle(ctrls, 'Isı Akısı Vektörleri (−k∇T)', st.showFlux, v => { st.showFlux = v; mainCv.render(); });

  // Wall controls
  const sTin = addSlider(ctrls, { label: 'İç Ortam T_iç', unit: '°C', min: 5, max: 40, value: st.Tin, step: 1, onInput: v => { st.Tin = v; solveWall(); } });
  const sTout = addSlider(ctrls, { label: 'Dış Ortam T_dış', unit: '°C', min: -30, max: 35, value: st.Tout, step: 1, onInput: v => { st.Tout = v; solveWall(); } });
  const sL1 = addSlider(ctrls, { label: 'Katman 1 (Tuğla) L₁', unit: 'cm', min: 5, max: 40, value: st.L1 * 100, step: 1, onInput: v => { st.L1 = v / 100; solveWall(); } });
  const sK1 = addSlider(ctrls, { label: 'Katman 1 İletkenlik k₁', unit: 'W/mK', min: 0.1, max: 2.5, value: st.k1, step: 0.05, onInput: v => { st.k1 = v; solveWall(); } });
  const sL2 = addSlider(ctrls, { label: 'Katman 2 (Yalıtım) L₂', unit: 'cm', min: 1, max: 25, value: st.L2 * 100, step: 1, onInput: v => { st.L2 = v / 100; solveWall(); } });
  const sK2 = addSlider(ctrls, { label: 'Katman 2 İletkenlik k₂', unit: 'W/mK', min: 0.02, max: 0.5, value: st.k2, step: 0.005, onInput: v => { st.k2 = v; solveWall(); } });

  let lap = null, wall = null;
  let plateBox = { x: 20, y: 20, sz: 220 };

  function update1DMeta() {
    const dx = st.L1d / (st.N1 - 1);
    const alpha = st.alphaMm * 1e-6;
    st.Fo = (alpha * st.dt) / (dx * dx);
    st.stable = st.Fo <= 0.5 + 1e-9;
    if (st.mode !== '1d') return;
    stabEl.textContent = st.stable ? `Fo = ${fmtFix(st.Fo, 3)} ≤ 0.5 (Kararlı)` : `Fo = ${fmtFix(st.Fo, 3)} > 0.5 (KARARSIZ!)`;
    stabEl.className = `slm-badge ${st.stable ? 'slm-badge-ok' : 'slm-badge-bad'}`;
    alertEl.innerHTML = st.stable ? ''
      : `<div class="slm-alert slm-alert-bad">Sayısal kararlılık koşulu (Fo ≤ 0.5) aşıldı! Açık FTCS şemasında salınımlar büyüyecektir; Δt’yi düşürün.</div>`;
    const Tmid = st.T1d ? st.T1d[(st.N1 - 1) >> 1] : st.T0;
    const Tss = 0.5 * (st.TL + st.TR);
    renderKpis(kpis, [
      { lbl: 'Fourier Sayısı Fo', val: fmtFix(st.Fo, 3), sub: st.stable ? 'Kararlı (≤ 0.5)' : 'Kararsız (> 0.5)', tone: st.stable ? 'ok' : 'bad' },
      { lbl: 'Geçen Süre t', val: `${fmtFix(st.simT, 1)} s`, sub: `Δx = ${(dx * 1000).toFixed(1)} mm` },
      { lbl: 'Orta Nokta T(L/2)', val: `${fmtFix(Tmid, 1)} °C`, sub: `Kararlı hedef: ${fmtFix(Tss, 1)} °C`, tone: 'acc' },
      { lbl: 'Sınırlar (T_L / T_R)', val: `${st.TL}° / ${st.TR}°C`, sub: `α = ${st.alphaMm} mm²/s` },
    ]);
  }

  function reset1D() {
    st.simT = 0;
    st.T1d = heat1DInit({ N: st.N1, TL: st.TL, TR: st.TR, T0: st.T0, profile: st.profile });
    update1DMeta();
    mainCv.render();
  }

  function solve2D() {
    lap = solveLaplace2D({ N: 27, Ttop: st.Ttop, Tbottom: st.Tbottom, Tleft: st.Tleft, Tright: st.Tright });
    if (st.mode !== '2d') return;
    stabEl.textContent = `SOR yakınsadı (${lap.iters} iterasyon)`;
    stabEl.className = 'slm-badge slm-badge-ok';
    alertEl.innerHTML = '';
    const tMin = Math.min(st.Ttop, st.Tbottom, st.Tleft, st.Tright);
    const tMax = Math.max(st.Ttop, st.Tbottom, st.Tleft, st.Tright);
    renderKpis(kpis, [
      { lbl: 'Merkez Sıcaklığı', val: `${fmtFix(lap.Tcenter, 2)} °C`, sub: `Kenar ort: ${fmtFix(0.25 * (st.Ttop + st.Tbottom + st.Tleft + st.Tright), 2)} °C`, tone: 'acc' },
      { lbl: 'Sıcaklık Aralığı', val: `${tMin}° – ${tMax}°C`, sub: `ΔT = ${tMax - tMin} °C` },
      { lbl: 'Izgara Boyutu', val: `${lap.N} × ${lap.N}`, sub: `${lap.N * lap.N} düğüm` },
      { lbl: 'Maks. Artık', val: lap.maxDiff.toExponential(1), sub: 'Laplace ∇²T = 0', tone: 'ok' },
    ]);
    mainCv.render();
  }

  function solveWall() {
    const layers = [
      { name: 'Tuğla', L: st.L1, k: st.k1 },
      { name: 'Yalıtım', L: st.L2, k: st.k2 },
      { name: 'Sıva', L: st.L3, k: st.k3 },
    ];
    wall = solveCompositeWall({ Tin: st.Tin, Tout: st.Tout, hi: st.hi, ho: st.ho, A: 1, layers });
    wall.layers = layers;
    if (st.mode !== 'wall') return;
    stabEl.textContent = `U = ${fmtFix(wall.U, 2)} W/(m²·K)`;
    stabEl.className = `slm-badge ${wall.U < 0.5 ? 'slm-badge-ok' : 'slm-badge-warn'}`;
    alertEl.innerHTML = '';
    const insShare = (wall.Rlayers[1] / wall.Rtot) * 100;
    renderKpis(kpis, [
      { lbl: 'Isı Akısı q″', val: `${fmtFix(wall.qFlux, 2)} W/m²`, sub: `ΔT = ${st.Tin - st.Tout} °C`, tone: 'acc' },
      { lbl: 'Toplam Direnç R″', val: `${fmtFix(wall.Rtot, 3)} m²K/W`, sub: `U = ${fmtFix(wall.U, 2)} W/(m²·K)`, tone: 'ok' },
      { lbl: 'Yalıtım Direnç Payı', val: `%${fmtFix(insShare, 1)}`, sub: `R₂ = ${fmtFix(wall.Rlayers[1], 2)} m²K/W` },
      { lbl: 'İç / Dış Yüzey T', val: `${fmtFix(wall.temps[1], 1)}° / ${fmtFix(wall.temps[4], 1)}°C`, sub: `Ara: ${fmtFix(wall.temps[2], 1)}°, ${fmtFix(wall.temps[3], 1)}°C` },
    ]);
    mainCv.render();
  }

  const mainCv = setupCanvas(cv, w => Math.min(360, Math.max(255, w * 0.62)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();

    if (st.mode === '1d' && st.T1d) {
      // Top thermal bar + bottom T(x, t) curve
      const L = 46, R = 16, barY = 18, barH = 26, pw = W - L - R;
      const tMin = Math.min(st.TL, st.TR, 0), tMax = Math.max(st.TL, st.TR, 160);
      const n = st.T1d.length;
      for (let i = 0; i < n - 1; i++) {
        const u = (0.5 * (st.T1d[i] + st.T1d[i + 1]) - tMin) / Math.max(1, tMax - tMin);
        const [r, g, b] = thermalColorRGB(u);
        c.fillStyle = `rgb(${r},${g},${b})`;
        c.fillRect(L + (i / (n - 1)) * pw, barY, pw / (n - 1) + 1, barH);
      }
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.strokeRect(L, barY, pw, barH);

      // T(x) plot below
      const pT = barY + barH + 18, pH = H - pT - 26;
      const fx = i => L + (i / (n - 1)) * pw;
      const fy = T => pT + (1 - Math.max(-0.2, Math.min(1.2, (T - tMin) / Math.max(1, tMax - tMin)))) * pH;
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, pT); c.lineTo(L, pT + pH); c.lineTo(L + pw, pT + pH); c.stroke();

      // Steady-state dashed reference
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(fx(0), fy(st.TL)); c.lineTo(fx(n - 1), fy(st.TR)); c.stroke(); c.restore();

      // Live T(x,t)
      c.strokeStyle = st.stable ? acc : COL_BAD; c.lineWidth = 2.4;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const px = fx(i), py = fy(st.T1d[i]);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();

      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace';
      c.textAlign = 'right';
      c.fillText(`${tMax}°C`, L - 5, pT + 10);
      c.fillText(`${tMin}°C`, L - 5, pT + pH);
      c.textAlign = 'center';
      c.fillText(`x (0 → ${st.L1d * 100} cm)`, L + pw * 0.5, H - 6);
      c.textAlign = 'left';
    } else if (st.mode === '2d' && lap) {
      const sz = Math.min(W - 90, H - 48);
      const x0 = (W - sz) * 0.5 - 12, y0 = (H - sz) * 0.5;
      plateBox = { x: x0, y: y0, sz };
      const N = lap.N;
      const tMin = Math.min(st.Ttop, st.Tbottom, st.Tleft, st.Tright);
      const tMax = Math.max(st.Ttop, st.Tbottom, st.Tleft, st.Tright);
      const span = Math.max(1e-6, tMax - tMin);
      const cell = sz / (N - 1);

      // Render smooth cell fill
      for (let r = 0; r < N - 1; r++) {
        for (let col = 0; col < N - 1; col++) {
          const avg = 0.25 * (lap.grid[r][col] + lap.grid[r][col + 1] + lap.grid[r + 1][col] + lap.grid[r + 1][col + 1]);
          const [rr, gg, bb] = thermalColorRGB((avg - tMin) / span);
          c.fillStyle = `rgb(${rr},${gg},${bb})`;
          c.fillRect(x0 + col * cell, y0 + r * cell, cell + 0.8, cell + 0.8);
        }
      }

      // Marching-squares isotherms
      c.strokeStyle = 'rgba(255,255,255,.72)'; c.lineWidth = 1.1;
      for (let k = 1; k < st.nIso; k++) {
        const lvl = tMin + (span * k) / st.nIso;
        const segs = marchingSquares(lap.grid, lvl);
        c.beginPath();
        for (const [ax, ay, bx, by] of segs) {
          c.moveTo(x0 + ax * cell, y0 + ay * cell);
          c.lineTo(x0 + bx * cell, y0 + by * cell);
        }
        c.stroke();
      }

      // Heat flux vectors (-grad T)
      if (st.showFlux && span > 1) {
        const stride = 4;
        for (let r = 2; r < N - 2; r += stride) {
          for (let col = 2; col < N - 2; col += stride) {
            const qx = -(lap.grid[r][col + 1] - lap.grid[r][col - 1]);
            const qy = -(lap.grid[r + 1][col] - lap.grid[r - 1][col]);
            const mag = Math.hypot(qx, qy);
            if (mag < 0.01 * span) continue;
            const len = Math.min(14, (mag / (0.22 * span)) * 12);
            const px = x0 + col * cell, py = y0 + r * cell;
            drawArrow(c, px, py, px + (qx / mag) * len, py + (qy / mag) * len, 'rgba(0,0,0,.78)', 1.4);
          }
        }
      }

      c.strokeStyle = COL_FG; c.lineWidth = 1.6; c.strokeRect(x0, y0, sz, sz);
      // Edge temperature labels
      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`${st.Ttop}°C`, x0 + sz / 2, y0 - 7);
      c.fillText(`${st.Tbottom}°C`, x0 + sz / 2, y0 + sz + 15);
      c.textAlign = 'right'; c.fillText(`${st.Tleft}°`, x0 - 6, y0 + sz / 2 + 4);
      c.textAlign = 'left'; c.fillText(`${st.Tright}°`, x0 + sz + 6, y0 + sz / 2 + 4);

      // Colorbar on far right
      const cbX = x0 + sz + 40;
      if (cbX + 18 < W) {
        for (let y = 0; y < sz; y += 2) {
          const [rr, gg, bb] = thermalColorRGB(1 - y / sz);
          c.fillStyle = `rgb(${rr},${gg},${bb})`;
          c.fillRect(cbX, y0 + y, 12, 2.5);
        }
        c.strokeStyle = 'rgba(255,255,255,.3)'; c.strokeRect(cbX, y0, 12, sz);
      }
    } else if (st.mode === 'wall' && wall) {
      // Top: wall cross-section + piecewise linear T(x); Bottom: thermal resistor network
      const padL = 54, padR = 54, topY = 22, wallH = H * 0.56;
      const totL = wall.layers.reduce((a, b) => a + b.L, 0);
      const wallW = W - padL - padR;
      const colors = ['rgba(240,118,48,.18)', 'rgba(90,176,255,.22)', 'rgba(255,255,255,.10)'];

      let xCur = padL;
      const xs = [padL - 30, padL];
      wall.layers.forEach((l, i) => {
        const w = Math.max(24, (l.L / totL) * wallW);
        c.fillStyle = colors[i]; c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.3;
        c.fillRect(xCur, topY, w, wallH); c.strokeRect(xCur, topY, w, wallH);
        c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(l.name, xCur + w / 2, topY + 15);
        c.fillText(`k=${l.k}`, xCur + w / 2, topY + wallH - 8);
        xCur += w;
        xs.push(xCur);
      });
      xs.push(xCur + 30);

      // Temperature curve overlay
      const tMin = Math.min(...wall.temps) - 3, tMax = Math.max(...wall.temps) + 3;
      const fy = T => topY + 24 + (1 - (T - tMin) / Math.max(1, tMax - tMin)) * (wallH - 44);
      c.strokeStyle = acc; c.lineWidth = 2.6;
      c.beginPath();
      wall.temps.forEach((T, i) => {
        const px = xs[i], py = fy(T);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();
      wall.temps.forEach((T, i) => {
        drawPin(c, xs[i], fy(T), 4, '#0b0b10', acc);
        c.fillStyle = COL_FG; c.font = '600 10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${fmtFix(T, 1)}°`, xs[i], fy(T) - 9);
      });

      // Equivalent electrical resistance network below
      const ry = topY + wallH + 42;
      const rVals = [wall.RconvI, ...wall.Rlayers, wall.RconvO];
      const rLbls = ['R_iç', 'R₁', 'R₂', 'R₃', 'R_dış'];
      const segW = (W - 44) / rVals.length;
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.6;
      rVals.forEach((rv, i) => {
        const sx = 22 + i * segW, ex = sx + segW;
        drawSpring(c, sx, ry, ex, ry, 4, 5, i === 2 ? COL_BLUE : COL_FG);
        c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${rLbls[i]}=${fmtFix(rv, 2)}`, (sx + ex) / 2, ry + 18);
      });
      c.textAlign = 'left';
    }
  }, clean);

  // Pointer hover temperature readout for 2D Laplace plate
  const onMove = e => {
    if (st.mode !== '2d' || !lap) { hoverEl.textContent = ''; return; }
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const u = (x - plateBox.x) / plateBox.sz, v = (y - plateBox.y) / plateBox.sz;
    if (u < 0 || u > 1 || v < 0 || v > 1) { hoverEl.textContent = ''; return; }
    const col = Math.min(lap.N - 1, Math.max(0, Math.round(u * (lap.N - 1))));
    const row = Math.min(lap.N - 1, Math.max(0, Math.round(v * (lap.N - 1))));
    hoverEl.textContent = `(${(u * 100).toFixed(0)}%, ${(100 - v * 100).toFixed(0)}%) → T = ${fmtFix(lap.grid[row][col], 1)} °C`;
  };
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerleave', () => { hoverEl.textContent = ''; });
  clean.add(() => cv.removeEventListener('pointermove', onMove));

  const loop = createAnimLoop(() => {
    if (!st.playing || st.mode !== '1d' || !st.T1d) return false;
    const dx = st.L1d / (st.N1 - 1);
    const alpha = st.alphaMm * 1e-6;
    const res = heat1DStep(st.T1d, { alpha, dx, dt: st.dt, TL: st.TL, TR: st.TR });
    st.T1d = res.T;
    st.simT += st.dt;
    update1DMeta();
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const is1 = st.mode === '1d', is2 = st.mode === '2d', isW = st.mode === 'wall';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    playBtn.hidden = !is1; resetBtn.hidden = !is1;
    [selProf, sTL, sTR, sAlp, sDt].forEach(x => x.setVisible(is1));
    [sTop, sBot, sLft, sRgt, tFlux].forEach(x => x.setVisible(is2));
    [sTin, sTout, sL1, sK1, sL2, sK2].forEach(x => x.setVisible(isW));
    host.querySelector('[data-cvtitle]').textContent = is1
      ? '1D Çubuk Geçici Sıcaklık Profili T(x, t)'
      : is2 ? '2D Kararlı Laplace Levhası & Eşsıcaklık Eğrileri'
      : 'Kompozit Duvar Sıcaklık Profili & Isıl Direnç Ağı';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing && st.mode === '1d') loop.start(); else loop.stop();
  });
  resetBtn.addEventListener('click', reset1D);
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; hoverEl.textContent = '';
    syncMode();
    if (st.mode === '1d') { reset1D(); if (st.playing) loop.start(); }
    else { loop.stop(); if (st.mode === '2d') solve2D(); else solveWall(); }
    syncSegments(host, false);
  });
  bindPresets(host, HEAT_PRESETS, p => {
    Object.assign(st, p);
    selProf.set(st.profile); sTL.set(st.TL); sTR.set(st.TR); sAlp.set(st.alphaMm); sDt.set(st.dt);
    sTop.set(st.Ttop); sBot.set(st.Tbottom); sLft.set(st.Tleft); sRgt.set(st.Tright);
    sTin.set(st.Tin); sTout.set(st.Tout); sL1.set(st.L1 * 100); sK1.set(st.k1); sL2.set(st.L2 * 100); sK2.set(st.k2);
    syncMode();
    if (st.mode === '1d') { reset1D(); if (st.playing) loop.start(); }
    else { loop.stop(); if (st.mode === '2d') solve2D(); else solveWall(); }
  });

  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  solve2D();
  return clean.run;
}

// =====================================================================
// 12. KANATÇIK & ISI DEĞİŞTİRİCİ (Fins & Heat Exchanger LMTD / ε-NTU)
// =====================================================================

const FINHX_PRESETS = [
  { label: 'Alüminyum Soğutucu Kanatçık', mode: 'fin', tip: 'adiabatic', Lmm: 60, tmm: 4, k: 205, h: 45, Tb: 110, Tinf: 25 },
  { label: 'Paslanmaz Çelik (Düşük k)', mode: 'fin', tip: 'convective', Lmm: 80, tmm: 3, k: 16, h: 55, Tb: 120, Tinf: 25 },
  { label: 'Ters Akış (Sıcaklık Çaprazı)', mode: 'hx', flow: 'counter', Ch: 3500, Cc: 2800, Thi: 150, Tci: 20, UA: 4500 },
  { label: 'Paralel Akış Eşanjör', mode: 'hx', flow: 'parallel', Ch: 3500, Cc: 2800, Thi: 150, Tci: 20, UA: 4500 },
];

function mountFinHeatExchanger(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'hx',
    tip: 'adiabatic', Lmm: 60, tmm: 4, wmm: 50, k: 205, h: 45, Tb: 110, Tinf: 25,
    flow: 'counter', Ch: 3500, Cc: 2800, Thi: 150, Tci: 20, UA: 4000,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Kanatçık sıcaklık profili</b> ile verim/etkinlik ($\\eta_f, \\varepsilon_f$) analizini yap; <b>paralel ve ters akışlı ısı değiştiricilerde</b> eksenel sıcaklık dağılımını <b>LMTD</b> ve <b>$\\varepsilon$–NTU</b> yöntemleriyle kıyasla.', FINHX_PRESETS)}
    <div class="slm-toolbar">
      <div class="seg" data-mode role="tablist" aria-label="Kanatçık veya Eşanjör">
        <button type="button" data-m="fin">Kanatçık Analizi</button>
        <button type="button" data-m="hx" class="on">Isı Değiştirici (LMTD / ε-NTU)</button>
      </div>
      <div class="seg" data-flow role="tablist" aria-label="Akış yönü">
        <button type="button" data-fl="counter" class="on">Ters Akış</button>
        <button type="button" data-fl="parallel">Paralel Akış</button>
      </div>
      <div class="seg" data-tip hidden role="tablist" aria-label="Kanatçık uç koşulu">
        <button type="button" data-tp="adiabatic" class="on">Yalıtılmış Uç</button>
        <button type="button" data-tp="convective">Konveksiyonlu</button>
        <button type="button" data-tp="infinite">Sonsuz Uzun</button>
      </div>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-t1>Eksenel Sıcaklık Profilleri T_h(x) ve T_c(x)</h4>
            <div class="slm-legend" data-leg></div>
          </div>
          <div class="slm-cv-box" data-bp><canvas class="slm-cv" data-cp aria-label="Kanatçık ve ısı değiştirici sıcaklık profili"></canvas><div class="slm-readout" data-rp></div></div>
          <div class="slm-axis-lbl" data-ax>Boyutsuz konum x / L</div>
        </div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-t2>Akış Şeması / Termal Dağılım</h4></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Kanatçık ve ısı değiştirici şeması"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'm = \\sqrt{\\frac{h P}{k A_c}}, \\qquad \\eta_f = \\frac{\\tanh(mL)}{mL}, \\qquad \\varepsilon_f = \\frac{q_f}{h A_c (T_b - T_\\infty)}',
        'Q = U A \\,\\Delta T_{\\text{lm}} = \\varepsilon\\,C_{\\min}(T_{h,i} - T_{c,i}), \\qquad \\Delta T_{\\text{lm}} = \\frac{\\Delta T_1 - \\Delta T_2}{\\ln(\\Delta T_1 / \\Delta T_2)}',
      ],
      paragraphs: [
        'Kanatçık kullanımı yalnızca **etkinlik $\\varepsilon_f > 2$** olduğunda mühendislik açısından anlamlıdır; bu yüzden yüksek $k$ (Alüminyum/Bakır) ve ince kanatçık tercih edilir.',
        '**Ters akışlı eşanjörde** soğuk akışkanın çıkış sıcaklığı $T_{c,o}$, sıcak akışkanın çıkış sıcaklığı $T_{h,o}$’ı geçebilir (**sıcaklık çaprazlaması**); paralel akışta bu termodinamik olarak imkansızdır.',
      ],
      tasks: [
        'Aynı $UA = 4500\\text{ W/K}$ değerinde **Ters Akış** ve **Paralel Akış** arasında geçiş yapıp $T_{c,o} > T_{h,o}$ çaprazlamasını gözlemleyin.',
        'Kanatçıkta iletkenliği $k = 205$ (Al) → $16$ (Paslanmaz) yapıp verim $\\eta_f$ ve uç sıcaklığındaki dramatik düşüşü inceleyin.',
        'Eşanjörde $C_h = C_c$ dengeli ters akışta sıcaklık eğrilerinin paralel doğrulara dönüştüğünü ve $\\varepsilon = \\text{NTU}/(1+\\text{NTU})$ olduğunu doğrulayın.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const flowSeg = host.querySelector('[data-flow]');
  const tipSeg = host.querySelector('[data-tip]');
  const cp = host.querySelector('[data-cp]');
  const cv = host.querySelector('[data-cv]');

  // Fin controls
  const sL = addSlider(ctrls, { label: 'Kanatçık Boyu L', unit: 'mm', min: 15, max: 160, value: st.Lmm, step: 5, onInput: v => { st.Lmm = v; update(); } });
  const sT = addSlider(ctrls, { label: 'Kalınlık t', unit: 'mm', min: 1, max: 12, value: st.tmm, step: 0.5, onInput: v => { st.tmm = v; update(); } });
  const sK = addSlider(ctrls, { label: 'İletkenlik k', unit: 'W/mK', min: 10, max: 400, value: st.k, step: 5, onInput: v => { st.k = v; update(); } });
  const sH = addSlider(ctrls, { label: 'Taşınım h', unit: 'W/m²K', min: 5, max: 250, value: st.h, step: 5, onInput: v => { st.h = v; update(); } });
  const sTb = addSlider(ctrls, { label: 'Taban Sıcaklığı T_b', unit: '°C', min: 40, max: 220, value: st.Tb, step: 5, onInput: v => { st.Tb = v; update(); } });

  // HX controls
  const sCh = addSlider(ctrls, { label: 'Sıcak Kapasite C_h', unit: 'W/K', min: 500, max: 8000, value: st.Ch, step: 100, onInput: v => { st.Ch = v; update(); } });
  const sCc = addSlider(ctrls, { label: 'Soğuk Kapasite C_c', unit: 'W/K', min: 500, max: 8000, value: st.Cc, step: 100, onInput: v => { st.Cc = v; update(); } });
  const sThi = addSlider(ctrls, { label: 'Sıcak Giriş T_{h,i}', unit: '°C', min: 60, max: 240, value: st.Thi, step: 5, onInput: v => { st.Thi = v; update(); } });
  const sTci = addSlider(ctrls, { label: 'Soğuk Giriş T_{c,i}', unit: '°C', min: 0, max: 55, value: st.Tci, step: 2, onInput: v => { st.Tci = v; update(); } });
  const sUA = addSlider(ctrls, { label: 'Toplam İletim UA', unit: 'W/K', min: 300, max: 12000, value: st.UA, step: 100, onInput: v => { st.UA = v; update(); } });

  let lastFin = null, lastHX = null;

  function drawPlot() {
    if (st.mode === 'fin' && lastFin) {
      host.querySelector('[data-leg]').innerHTML = `<span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_WARN}"></i>T(x)</span>`;
      safePlot(cp, [
        { name: 'T(x)', color: COL_WARN, xs: lastFin.xs.map(x => x * 1000), ys: lastFin.Ts },
        { name: 'T∞', color: 'rgba(255,255,255,.28)', xs: [0, st.Lmm], ys: [st.Tinf, st.Tinf] },
      ], { x0: 0, x1: st.Lmm, ylabel: 'T (°C)', height: 185 });
    } else if (st.mode === 'hx' && lastHX) {
      host.querySelector('[data-leg]').innerHTML = `<span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BAD}"></i>Sıcak T_h(x)</span>
        <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BLUE}"></i>Soğuk T_c(x)</span>`;
      safePlot(cp, [
        { name: 'Th', color: COL_BAD, xs: lastHX.xs, ys: lastHX.Th },
        { name: 'Tc', color: COL_BLUE, xs: lastHX.xs, ys: lastHX.Tc },
      ], { x0: 0, x1: 1, ylabel: 'T (°C)', height: 185 });
    }
  }

  const schCv = setupCanvas(cv, w => Math.min(160, Math.max(125, w * 0.28)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (st.mode === 'fin' && lastFin) {
      // Base wall + colored thermal fin
      const x0 = 52, finW = W - 84, finH = Math.min(44, Math.max(14, st.tmm * 4.5));
      const cy = H * 0.5;
      drawGroundHatch(c, x0, cy - 42, x0, cy + 42, -1);
      const n = lastFin.Ts.length;
      for (let i = 0; i < n - 1; i++) {
        const u = (lastFin.Ts[i] - st.Tinf) / Math.max(1, st.Tb - st.Tinf);
        const [r, g, b] = thermalColorRGB(u);
        c.fillStyle = `rgb(${r},${g},${b})`;
        c.fillRect(x0 + (i / (n - 1)) * finW, cy - finH / 2, finW / (n - 1) + 1, finH);
      }
      c.strokeStyle = COL_FG; c.lineWidth = 1.5; c.strokeRect(x0, cy - finH / 2, finW, finH);
      c.fillStyle = COL_FG; c.font = '11px "JetBrains Mono", monospace';
      c.fillText(`${st.Tb}°C`, 8, cy + 4);
      c.fillText(`${fmtFix(lastFin.tipTemp, 1)}°C`, x0 + finW - 34, cy - finH / 2 - 8);
    } else if (lastHX) {
      // Concentric pipe heat exchanger schematic
      const x0 = 56, x1 = W - 56, yMid = H * 0.5, rIn = 18, rOut = 42;
      // Hot inner gradient
      const gHot = c.createLinearGradient(x0, 0, x1, 0);
      gHot.addColorStop(0, 'rgba(255,107,107,.55)'); gHot.addColorStop(1, 'rgba(255,209,102,.32)');
      c.fillStyle = gHot; c.fillRect(x0, yMid - rIn, x1 - x0, rIn * 2);
      // Cold outer annulus gradient
      const gCold = c.createLinearGradient(x0, 0, x1, 0);
      if (st.flow === 'parallel') { gCold.addColorStop(0, 'rgba(90,176,255,.45)'); gCold.addColorStop(1, 'rgba(168,120,255,.35)'); }
      else { gCold.addColorStop(0, 'rgba(168,120,255,.4)'); gCold.addColorStop(1, 'rgba(90,176,255,.45)'); }
      c.fillStyle = gCold;
      c.fillRect(x0, yMid - rOut, x1 - x0, rOut - rIn);
      c.fillRect(x0, yMid + rIn, x1 - x0, rOut - rIn);
      c.strokeStyle = COL_FG; c.lineWidth = 1.5;
      c.strokeRect(x0, yMid - rOut, x1 - x0, rOut * 2);
      c.strokeRect(x0, yMid - rIn, x1 - x0, rIn * 2);

      // Flow direction arrows
      drawArrow(c, x0 + 24, yMid, x1 - 24, yMid, COL_BAD, 2.2);
      if (st.flow === 'parallel') {
        drawArrow(c, x0 + 24, yMid - 30, x1 - 24, yMid - 30, COL_BLUE, 2);
      } else {
        drawArrow(c, x1 - 24, yMid - 30, x0 + 24, yMid - 30, COL_BLUE, 2);
      }
      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace';
      c.fillText(`${st.Thi}°`, 10, yMid + 4);
      c.fillText(`${fmtFix(lastHX.Tho, 1)}°`, x1 + 8, yMid + 4);
      c.fillStyle = COL_BLUE;
      if (st.flow === 'parallel') {
        c.fillText(`${st.Tci}°`, 10, yMid - 26);
        c.fillText(`${fmtFix(lastHX.Tco, 1)}°`, x1 + 8, yMid - 26);
      } else {
        c.fillText(`${fmtFix(lastHX.Tco, 1)}°`, 10, yMid - 26);
        c.fillText(`${st.Tci}°`, x1 + 8, yMid - 26);
      }
    }
  }, clean);

  function update() {
    if (st.mode === 'fin') {
      lastFin = solveFin({ L: st.Lmm / 1000, t: st.tmm / 1000, w: st.wmm / 1000, k: st.k, h: st.h, Tb: st.Tb, Tinf: st.Tinf, tip: st.tip });
      renderKpis(kpis, [
        { lbl: 'Kanatçık Verimi η_f', val: `%${fmtFix(lastFin.eta * 100, 1)}`, sub: `mL = ${fmtFix(lastFin.mL, 2)}`, tone: 'acc' },
        { lbl: 'Isı Transferi q_f', val: `${fmtFix(lastFin.qFin, 2)} W`, sub: `Uç T(L) = ${fmtFix(lastFin.tipTemp, 1)} °C`, tone: 'ok' },
        { lbl: 'Etkinlik ε_f', val: fmtFix(lastFin.effectiveness, 1), sub: lastFin.effectiveness > 2 ? 'Verimli (ε > 2)' : 'Yetersiz (ε ≤ 2)', tone: lastFin.effectiveness > 2 ? 'ok' : 'warn' },
        { lbl: 'Parametre m', val: `${fmtFix(lastFin.m, 1)} m⁻¹`, sub: `h=${st.h} · k=${st.k}` },
      ]);
    } else {
      lastHX = solveHeatExchanger({ flow: st.flow, Ch: st.Ch, Cc: st.Cc, Thi: st.Thi, Tci: st.Tci, UA: st.UA });
      const cross = lastHX.Tco > lastHX.Tho;
      renderKpis(kpis, [
        { lbl: 'Etkinlik ε (ε-NTU)', val: `%${fmtFix(lastHX.eps * 100, 1)}`, sub: `NTU = ${fmtFix(lastHX.NTU, 2)} · Cᵣ = ${fmtFix(lastHX.Cr, 2)}`, tone: 'acc' },
        { lbl: 'Isı Yükü Q', val: `${fmtFix(lastHX.Q / 1000, 2)} kW`, sub: `LMTD = ${fmtFix(lastHX.lmtd, 1)} °C`, tone: 'ok' },
        { lbl: 'Sıcak Çıkış T_{h,o}', val: `${fmtFix(lastHX.Tho, 1)} °C`, sub: `Giriş: ${st.Thi} °C` },
        { lbl: 'Soğuk Çıkış T_{c,o}', val: `${fmtFix(lastHX.Tco, 1)} °C`, sub: cross ? '✦ Sıcaklık çaprazı!' : `Giriş: ${st.Tci} °C`, tone: cross ? 'ok' : '' },
      ]);
    }
    drawPlot();
    schCv.render();
  }

  function syncMode() {
    const isF = st.mode === 'fin';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    flowSeg.hidden = isF; tipSeg.hidden = !isF;
    [sL, sT, sK, sH, sTb].forEach(s => s.setVisible(isF));
    [sCh, sCc, sThi, sTci, sUA].forEach(s => s.setVisible(!isF));
    host.querySelector('[data-t1]').textContent = isF ? 'Kanatçık Sıcaklık Profili T(x)' : 'Eksenel Sıcaklık Profilleri T_h(x) & T_c(x)';
    host.querySelector('[data-ax]').textContent = isF ? 'Tabandan uzaklık x (mm)' : 'Boyutsuz eşanjör konumu x / L';
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update(); syncSegments(host, false);
  });
  flowSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-fl]'); if (!b) return;
    st.flow = b.dataset.fl;
    flowSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    update(); syncSegments(host, false);
  });
  tipSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-tp]'); if (!b) return;
    st.tip = b.dataset.tp;
    tipSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    update(); syncSegments(host, false);
  });
  bindPresets(host, FINHX_PRESETS, p => {
    Object.assign(st, p);
    sL.set(st.Lmm); sT.set(st.tmm); sK.set(st.k); sH.set(st.h); sTb.set(st.Tb);
    sCh.set(st.Ch); sCc.set(st.Cc); sThi.set(st.Thi); sTci.set(st.Tci); sUA.set(st.UA);
    flowSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.fl === st.flow));
    tipSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.tp === st.tip));
    syncMode(); update();
  });

  attachReadout(cp, host.querySelector('[data-rp]'), (x, ser, i) =>
    st.mode === 'fin' ? `x=${fmtFix(x, 1)}mm · T=${fmtFix(ser[0].ys[i], 1)}°C` : `x/L=${fmtFix(x, 2)} · Th=${fmtFix(ser[0].ys[i], 1)}° · Tc=${fmtFix(ser[1].ys[i], 1)}°`, clean);
  observeResize(host.querySelector('[data-bp]'), drawPlot, clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 13. BORU AKIŞI, MOODY, POMPA-SİSTEM & VENTURİ
// =====================================================================

const PIPE_PRESETS = [
  { label: 'Laminer Yağ Akışı', mode: 'moody', Dmm: 40, L: 50, V: 0.9, muMpas: 25, epsMm: 0.045, sumK: 2.0 },
  { label: 'Türbülanslı Çelik Boru', mode: 'moody', Dmm: 100, L: 150, V: 2.4, muMpas: 1.0, epsMm: 0.045, sumK: 3.5 },
  { label: 'Pompa–Sistem Çalışma Noktası', mode: 'pump', H0: 48, aPump: 850, dZ: 14, Dmm: 120, L: 200, epsMm: 0.15, sumK: 4 },
  { label: 'Venturi Debimetre', mode: 'venturi', D1mm: 120, D2mm: 60, Qls: 25, Cd: 0.98 },
];

function mountPipeFlow(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'moody',
    Dmm: 100, L: 150, V: 2.4, rho: 998, muMpas: 1.0, epsMm: 0.045, sumK: 3.5,
    H0: 48, aPump: 850, dZ: 14, etaP: 0.78,
    D1mm: 120, D2mm: 60, Qls: 25, Cd: 0.98,
    playing: autoPlayAllowed(), animT: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Reynolds sayısı</b>, laminer/türbülanslı hız profilleri, <b>Colebrook–White & Moody diyagramı</b>, <b>pompa–sistem eğrisi</b> kesişimi ve <b>Bernoulli / Venturi</b> akışını etkileşimli incele.', PIPE_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="Boru akışı modları">
          <button type="button" data-m="moody" class="on">Boru & Moody</button>
          <button type="button" data-m="pump">Pompa vs Sistem</button>
          <button type="button" data-m="venturi">Bernoulli / Venturi</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
      </div>
      <span class="slm-badge" data-reg></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-t1>Boru Hız Profili u(r)</h4><span class="slm-hint mono" data-pinfo></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Boru akışı hız profili veya Venturi animasyonu"></canvas></div>
        </div>
        <div class="slm-plot-card" data-mcard>
          <div class="slm-head"><h4 class="slm-title" data-t2>Moody Diyagramı (Colebrook–White)</h4></div>
          <div class="slm-cv-box" data-bm>
            <canvas class="slm-cv" data-cm aria-label="Moody diyagramı"></canvas>
            <canvas class="slm-cv" data-cpump hidden aria-label="Pompa ve sistem eğrisi grafiği"></canvas>
            <div class="slm-readout" data-rm></div>
          </div>
          <div class="slm-axis-lbl" data-ax2>Reynolds sayısı Re (log ölçek)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{Re} = \\frac{\\rho V D}{\\mu}, \\qquad \\frac{1}{\\sqrt{f}} = -2\\log_{10}\\!\\left(\\frac{\\varepsilon/D}{3.7} + \\frac{2.51}{\\text{Re}\\sqrt{f}}\\right)',
        'h_L = \\left(f\\frac{L}{D} + \\sum K_L\\right)\\frac{V^2}{2g}, \\qquad P_1 + \\tfrac{1}{2}\\rho V_1^2 = P_2 + \\tfrac{1}{2}\\rho V_2^2',
      ],
      paragraphs: [
        '$\\text{Re} < 2300$ iken akış **laminerdir** ($f = 64/\\text{Re}$, pürüzlülükten bağımsız parabolik profil $u_{\\max} = 2V$). $\\text{Re} > 4000$’de **türbülanslı** profil merkeze doğru düzleşir ve sürtünme katsayısı $f$ hem $\\text{Re}$ hem de bağıl pürüzlülüğe ($\\varepsilon/D$) bağlıdır.',
        '**Pompa çalışma noktası**, azalan pompa karakteristik eğrisi $H_p(Q)$ ile yükselen sistem kayıp eğrisinin $H_{\\text{sis}}(Q) = \\Delta z + K Q^2$ kesişimidir.',
      ],
      tasks: [
        'Viskoziteyi artırıp $\\text{Re} < 2300$ laminer akışa geçin; Moody noktasının $64/\\text{Re}$ doğrusuna oturduğunu ve hız profilinin parabolleştiğini izleyin.',
        '**Pompa vs Sistem** modunda statik kot farkı $\\Delta z$’yi artırarak çalışma debisinin ($Q^*$) düştüğünü gözlemleyin.',
        '**Venturi** modunda boğaz çapı $D_2$’yi $D_1/2$ yapıp hızın 4 katına çıktığını ($V_2 = 4V_1$) ve manometre farkını kontrol edin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const regEl = host.querySelector('[data-reg]');
  const pinfo = host.querySelector('[data-pinfo]');
  const playBtn = host.querySelector('[data-play]');
  const mcard = host.querySelector('[data-mcard]');
  const cv = host.querySelector('[data-cv]');
  const cm = host.querySelector('[data-cm]');
  const cpump = host.querySelector('[data-cpump]');

  // Pipe controls
  const sD = addSlider(ctrls, { label: 'Boru Çapı D', unit: 'mm', min: 15, max: 300, value: st.Dmm, step: 5, onInput: v => { st.Dmm = v; update(); } });
  const sL = addSlider(ctrls, { label: 'Boru Boyu L', unit: 'm', min: 10, max: 500, value: st.L, step: 10, onInput: v => { st.L = v; update(); } });
  const sV = addSlider(ctrls, { label: 'Ortalama Hız V', unit: 'm/s', min: 0.1, max: 6.0, value: st.V, step: 0.1, onInput: v => { st.V = v; update(); } });
  const sMu = addSlider(ctrls, { label: 'Viskozite μ', unit: 'mPa·s', min: 0.5, max: 50, value: st.muMpas, step: 0.5, log: true, onInput: v => { st.muMpas = v; update(); } });
  const sEps = addSlider(ctrls, { label: 'Pürüzlülük ε', unit: 'mm', min: 0.001, max: 2.0, value: st.epsMm, log: true, onInput: v => { st.epsMm = v; update(); } });
  const sKL = addSlider(ctrls, { label: 'Yerel Kayıp ΣK_L', min: 0, max: 20, value: st.sumK, step: 0.5, onInput: v => { st.sumK = v; update(); } });

  // Pump controls
  const sH0 = addSlider(ctrls, { label: 'Kapalı Vana Basma H₀', unit: 'm', min: 15, max: 90, value: st.H0, step: 1, onInput: v => { st.H0 = v; update(); } });
  const sAp = addSlider(ctrls, { label: 'Pompa Eğimi a', unit: 's²/m⁵', min: 200, max: 3000, value: st.aPump, step: 50, onInput: v => { st.aPump = v; update(); } });
  const sDz = addSlider(ctrls, { label: 'Statik Kot Δz', unit: 'm', min: 0, max: 45, value: st.dZ, step: 1, onInput: v => { st.dZ = v; update(); } });

  // Venturi controls
  const sD1 = addSlider(ctrls, { label: 'Boru Çapı D₁', unit: 'mm', min: 60, max: 220, value: st.D1mm, step: 5, onInput: v => { st.D1mm = v; if (st.D2mm >= v - 10) { st.D2mm = v - 15; sD2.set(st.D2mm); } update(); } });
  const sD2 = addSlider(ctrls, { label: 'Boğaz Çapı D₂', unit: 'mm', min: 20, max: 160, value: st.D2mm, step: 2, onInput: v => { st.D2mm = Math.min(v, st.D1mm - 10); update(); } });
  const sQ = addSlider(ctrls, { label: 'Debi Q', unit: 'L/s', min: 2, max: 80, value: st.Qls, step: 1, onInput: v => { st.Qls = v; update(); } });

  let pf = null, ps = null, ven = null;

  // Precompute Moody diagram curves once
  const MOODY_RR = [0, 0.0002, 0.001, 0.004, 0.01, 0.03];
  const moodyCv = setupCanvas(cm, w => Math.min(255, Math.max(200, w * 0.44)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'moody' && pf) {
      const L = 46, R = 48, T = 14, B = 28, pw = W - L - R, ph = H - T - B;
      const lx0 = Math.log10(600), lx1 = Math.log10(1e8);
      const ly0 = Math.log10(0.008), ly1 = Math.log10(0.1);
      const fx = re => L + ((Math.log10(Math.max(600, Math.min(1e8, re))) - lx0) / (lx1 - lx0)) * pw;
      const fy = f => T + ((ly1 - Math.log10(Math.max(0.008, Math.min(0.1, f)))) / (ly1 - ly0)) * ph;

      // Grid
      c.strokeStyle = COL_GRID; c.lineWidth = 1; c.font = '10px "JetBrains Mono", monospace';
      for (let e = 3; e <= 8; e++) {
        const x = fx(10 ** e);
        c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`10^${e}`, x, H - 8);
      }
      for (const f of [0.01, 0.015, 0.02, 0.03, 0.04, 0.06, 0.08, 0.1]) {
        const y = fy(f);
        c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(f.toFixed(3), L - 4, y + 3);
      }
      c.textAlign = 'left';

      // Transition band 2300-4000
      c.fillStyle = 'rgba(255,209,102,.08)';
      c.fillRect(fx(2300), T, fx(4000) - fx(2300), ph);

      // Laminar line f = 64/Re
      c.strokeStyle = COL_BLUE; c.lineWidth = 2;
      c.beginPath(); c.moveTo(fx(640), fy(0.1)); c.lineTo(fx(2300), fy(64 / 2300)); c.stroke();

      // Turbulent Colebrook curves
      MOODY_RR.forEach((rr, idx) => {
        c.strokeStyle = idx === 0 ? 'rgba(91,228,155,.75)' : 'rgba(255,255,255,.35)';
        c.lineWidth = idx === 0 ? 1.8 : 1.1;
        c.beginPath();
        for (let i = 0; i <= 50; i++) {
          const re = 10 ** (Math.log10(4000) + ((8 - Math.log10(4000)) * i) / 50);
          const f = colebrookFriction(re, rr);
          const x = fx(re), y = fy(f);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        const fEnd = colebrookFriction(1e8, rr);
        c.fillStyle = COL_MUTE; c.fillText(rr === 0 ? 'düz' : String(rr), L + pw + 4, fy(fEnd) + 3);
      });

      // Operating point
      const ox = fx(pf.Re), oy = fy(pf.f);
      c.strokeStyle = `${acc}66`; c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(ox, T + ph); c.lineTo(ox, oy); c.lineTo(L, oy); c.stroke(); c.setLineDash([]);
      drawPin(c, ox, oy, 6, acc, '#fff');
    }
  }, clean);

  function drawPumpPlot() {
    if (st.mode !== 'pump' || !ps) return;
    safePlot(cpump, [
      { name: 'Pompa H_p', color: COL_BLUE, xs: ps.qs.map(q => q * 1000), ys: ps.hp },
      { name: 'Sistem H_s', color: COL_WARN, xs: ps.qs.map(q => q * 1000), ys: ps.hs },
      { name: 'Çalışma', color: accentColor(), xs: [ps.Qop * 1000, ps.Qop * 1000], ys: [0, ps.Hop] },
    ], { x0: 0, x1: ps.qMax * 1000, ylabel: 'Basma H (m)', height: 215 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(200, Math.max(155, w * 0.34)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'moody' && pf) {
      // Pipe walls + velocity profile + animated particles
      const yT = 26, yB = H - 26, rPx = (yB - yT) / 2, cy = (yT + yB) / 2;
      c.fillStyle = 'rgba(90,176,255,.08)'; c.fillRect(16, yT, W - 32, yB - yT);
      drawGroundHatch(c, 16, yT, W - 16, yT, -1);
      drawGroundHatch(c, 16, yB, W - 16, yB, 1);

      // Velocity profile envelope at x = W * 0.28
      const px0 = W * 0.25, vSc = Math.min(90, W * 0.22);
      c.strokeStyle = acc; c.lineWidth = 2.2;
      c.beginPath();
      pf.profile.forEach((pt, i) => {
        const x = px0 + (pt.uOverV / 2) * vSc;
        const y = cy + pt.rNorm * rPx;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      });
      c.stroke();
      for (let k = -4; k <= 4; k++) {
        const rn = k / 5;
        const pIdx = Math.round((rn + 1) * 30);
        const uRat = pf.profile[pIdx]?.uOverV ?? 1;
        drawArrow(c, px0, cy + rn * rPx, px0 + (uRat / 2) * vSc, cy + rn * rPx, 'rgba(255,255,255,.45)', 1.2);
      }

      // Animated fluid tracers moving at local u(r)
      for (let i = 0; i < 24; i++) {
        const rn = ((i % 9) - 4) / 4.8;
        const pIdx = Math.round((rn + 1) * 30);
        const uRat = pf.profile[pIdx]?.uOverV ?? 1;
        const span = W - 44;
        const x = 22 + (((i * 53 + st.animT * 60 * uRat * Math.min(2.5, Math.max(0.4, st.V))) % span) + span) % span;
        c.fillStyle = pf.Re < 2300 ? COL_BLUE : COL_OK;
        c.beginPath(); c.arc(x, cy + rn * (rPx - 5), 2.5, 0, Math.PI * 2); c.fill();
      }
      pinfo.textContent = `u_max / V = ${fmtFix(pf.vMaxRatio, 2)}`;
    } else if (st.mode === 'venturi' && ven) {
      // Converging-diverging Venturi tube + U-tube piezometer columns
      const cy = H * 0.56;
      const r1 = Math.min(40, Math.max(22, st.D1mm * 0.26));
      const r2 = Math.max(10, r1 * ven.beta);
      const xA = 26, xB = W * 0.34, xC = W * 0.5, xD = W * 0.68, xE = W - 26;

      c.fillStyle = 'rgba(90,176,255,.12)'; c.strokeStyle = COL_FG; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(xA, cy - r1); c.lineTo(xB, cy - r1); c.lineTo(xC, cy - r2); c.lineTo(xD, cy - r1); c.lineTo(xE, cy - r1);
      c.lineTo(xE, cy + r1); c.lineTo(xD, cy + r1); c.lineTo(xC, cy + r2); c.lineTo(xB, cy + r1); c.lineTo(xA, cy + r1);
      c.closePath(); c.fill(); c.stroke();

      // Animated streamlines & particles speeding up through throat
      for (let k = -2; k <= 2; k++) {
        const f = k / 3;
        c.strokeStyle = 'rgba(90,176,255,.35)'; c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(xA, cy + f * r1); c.lineTo(xB, cy + f * r1); c.lineTo(xC, cy + f * r2); c.lineTo(xD, cy + f * r1); c.lineTo(xE, cy + f * r1);
        c.stroke();
      }
      // Piezometer columns at inlet (high P) and throat (low P)
      const hDrop = Math.min(34, Math.max(4, ven.dHWater * 4));
      const drawPiezo = (x, rLocal, colH, lbl) => {
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.3;
        c.strokeRect(x - 5, 10, 10, cy - rLocal - 10);
        c.fillStyle = acc;
        c.fillRect(x - 4, cy - rLocal - colH, 8, colH);
        c.fillStyle = COL_FG; c.font = '10.5px "JetBrains Mono", monospace';
        c.fillText(lbl, x + 9, 22);
      };
      const maxCol = Math.max(12, cy - r1 - 14);
      drawPiezo(xA + (xB - xA) * 0.5, r1, maxCol * 0.9, `V₁=${fmtFix(ven.V1, 1)}`);
      drawPiezo(xC, r2, Math.max(6, maxCol * 0.9 - hDrop), `V₂=${fmtFix(ven.V2, 1)}`);
      pinfo.textContent = `ΔP = ${fmtFix(ven.dP / 1000, 2)} kPa`;
    } else if (st.mode === 'pump' && ps) {
      // Compact schematic: reservoir -> pump -> elevated tank
      const yLow = H * 0.72, yHi = H * 0.28;
      c.strokeStyle = COL_BLUE; c.lineWidth = 3;
      c.beginPath(); c.moveTo(40, yLow); c.lineTo(W * 0.35, yLow); c.lineTo(W * 0.55, yHi); c.lineTo(W - 44, yHi); c.stroke();
      drawPin(c, W * 0.25, yLow, 16, '#0b0b10', acc);
      c.fillStyle = acc; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText('P', W * 0.25, yLow + 4);
      c.fillStyle = COL_FG; c.fillText(`Δz = ${st.dZ} m`, W * 0.65, H * 0.54);
      c.fillStyle = COL_OK; c.fillText(`Q* = ${fmtFix(ps.Qop * 1000, 1)} L/s · H* = ${fmtFix(ps.Hop, 1)} m`, W * 0.5, 22);
      c.textAlign = 'left';
      pinfo.textContent = `η_p = ${Math.round(st.etaP * 100)}%`;
    }
  }, clean);

  function update() {
    if (st.mode === 'moody') {
      pf = solvePipeFlow({ D: st.Dmm / 1000, L: st.L, V: st.V, rho: st.rho, mu: st.muMpas * 1e-3, roughness: st.epsMm / 1000, sumK: st.sumK });
      regEl.textContent = `${pf.regime} (Re = ${fmtNum(pf.Re, 3)})`;
      regEl.className = `slm-badge ${pf.Re < 2300 ? 'slm-badge-ok' : pf.Re <= 4000 ? 'slm-badge-warn' : 'slm-badge-acc'}`;
      renderKpis(kpis, [
        { lbl: 'Reynolds Sayısı Re', val: fmtNum(pf.Re, 3), sub: `${pf.regime} · ε/D = ${pf.relRough.toExponential(1)}`, tone: 'acc' },
        { lbl: 'Sürtünme Katsayısı f', val: fmtFix(pf.f, 4), sub: pf.Re < 2300 ? '64 / Re (tam)' : 'Colebrook–White' },
        { lbl: 'Toplam Yük Kaybı h_L', val: `${fmtFix(pf.hTotal, 2)} m`, sub: `Ana ${fmtFix(pf.hf, 2)} + Yerel ${fmtFix(pf.hm, 2)} m`, tone: 'warn' },
        { lbl: 'Basınç Düşümü ΔP', val: `${fmtFix(pf.dP / 1000, 2)} kPa`, sub: `Pompa gücü: ${fmtUnit(pf.pPower, 'W', 3)}` },
      ]);
      moodyCv.render();
    } else if (st.mode === 'pump') {
      ps = solvePumpSystem({ H0: st.H0, aPump: st.aPump, dZ: st.dZ, D: st.Dmm / 1000, L: st.L, roughness: st.epsMm / 1000, sumK: st.sumK, etaP: st.etaP });
      regEl.textContent = ps.feasible ? `Çalışma Noktası: ${fmtFix(ps.Qop * 1000, 1)} L/s` : 'Basma Yüksekliği Yetersiz (H₀ ≤ Δz)';
      regEl.className = `slm-badge ${ps.feasible ? 'slm-badge-ok' : 'slm-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Çalışma Debisi Q*', val: `${fmtFix(ps.Qop * 1000, 2)} L/s`, sub: `Hız V = ${fmtFix(ps.Vop, 2)} m/s`, tone: 'acc' },
        { lbl: 'Çalışma Basması H*', val: `${fmtFix(ps.Hop, 2)} m`, sub: `Statik Δz = ${st.dZ} m`, tone: 'ok' },
        { lbl: 'Hidrolik Güç P_h', val: `${fmtFix(ps.pHyd / 1000, 2)} kW`, sub: 'ρ g Q* H*' },
        { lbl: 'Mil Gücü (η=%78)', val: `${fmtFix(ps.pShaft / 1000, 2)} kW`, sub: 'Elektrik motor yükü' },
      ]);
      drawPumpPlot();
    } else {
      ven = solveVenturi({ D1: st.D1mm / 1000, D2: st.D2mm / 1000, Q: st.Qls / 1000, Cd: st.Cd });
      regEl.textContent = `Çap Oranı β = D₂/D₁ = ${fmtFix(ven.beta, 2)}`;
      regEl.className = 'slm-badge slm-badge-acc';
      renderKpis(kpis, [
        { lbl: 'Giriş / Boğaz Hızı', val: `${fmtFix(ven.V1, 2)} → ${fmtFix(ven.V2, 2)} m/s`, sub: `Hız oranı: ${fmtFix(ven.V2 / ven.V1, 2)}×`, tone: 'acc' },
        { lbl: 'Basınç Farkı ΔP', val: `${fmtFix(ven.dP / 1000, 2)} kPa`, sub: `C_d = ${st.Cd}` },
        { lbl: 'Su Sütunu Farkı Δh', val: `${fmtFix(ven.dHWater, 2)} m`, sub: 'Piezometre farkı', tone: 'ok' },
        { lbl: 'Cıva Manometresi Δh_Hg', val: `${fmtFix(ven.dHMano * 1000, 1)} mmHg`, sub: 'ρ_Hg = 13600 kg/m³' },
      ]);
    }
    mainCv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.animT += dt;
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isM = st.mode === 'moody', isP = st.mode === 'pump', isV = st.mode === 'venturi';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sD.setVisible(isM || isP); sL.setVisible(isM || isP); sEps.setVisible(isM || isP); sKL.setVisible(isM || isP);
    sV.setVisible(isM); sMu.setVisible(isM);
    [sH0, sAp, sDz].forEach(s => s.setVisible(isP));
    [sD1, sD2, sQ].forEach(s => s.setVisible(isV));
    mcard.hidden = isV;
    cm.hidden = !isM;
    cpump.hidden = !isP;
    host.querySelector('[data-t1]').textContent = isM ? 'Boru Hız Profili u(r) & Akış' : isP ? 'Pompa – Boru Hattı Şeması' : 'Venturi Tüpü & Piezometre Sütunları';
    host.querySelector('[data-t2]').textContent = isM ? 'Moody Diyagramı (Colebrook–White)' : 'Pompa Eğrisi vs Sistem Eğrisi';
    host.querySelector('[data-ax2]').textContent = isM ? 'Reynolds sayısı Re (log ölçek)' : 'Debi Q (L/s)';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, PIPE_PRESETS, p => {
    Object.assign(st, p);
    sD.set(st.Dmm); sL.set(st.L); sV.set(st.V); sMu.set(st.muMpas); sEps.set(st.epsMm); sKL.set(st.sumK);
    sH0.set(st.H0); sAp.set(st.aPump); sDz.set(st.dZ); sD1.set(st.D1mm); sD2.set(st.D2mm); sQ.set(st.Qls);
    syncMode(); update();
  });

  attachReadout(cpump, host.querySelector('[data-rm]'), (x, ser, i) => `Q=${fmtFix(x, 1)} L/s · H_p=${fmtFix(ser[0].ys[i], 1)}m · H_s=${fmtFix(ser[1].ys[i], 1)}m`, clean);
  observeResize(host.querySelector('[data-bm]'), drawPumpPlot, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 14. POTANSİYEL AKIŞ & KUTTA-JOUKOWSKI (Streamlines, Cp, Cylinder Lift)
// =====================================================================

const POT_PRESETS = [
  { label: 'Sirkülasyonsuz Silindir', mode: 'cylinder', U: 10, R: 1.0, gamma: 0, alphaDeg: 0 },
  { label: 'Kutta–Joukowski Kaldırma', mode: 'cylinder', U: 10, R: 1.0, gamma: 50, alphaDeg: 0 },
  { label: 'Ayrılmış Durma (|Γ| > 4πUR)', mode: 'cylinder', U: 10, R: 1.0, gamma: 145, alphaDeg: 0 },
  { label: 'Rankine Ovali (Kaynak + Kuyu)', mode: 'rankine', U: 10, srcM: 32, halfA: 1.0 },
  { label: 'Kaynak + Girdap Süperpozisyonu', mode: 'custom', U: 8, srcM: 22, gamma: 28, halfA: 1.1 },
];

function mountPotentialFlow(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'cylinder', U: 10, R: 1.0, gamma: 50, rho: 1.225,
    srcM: 32, halfA: 1.0, alphaDeg: 0, showCp: true,
    customEls: [
      { type: 'source', m: 24, x: -1.1, y: 0 },
      { type: 'vortex', gamma: 28, x: 1.0, y: 0.3 },
    ],
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Düzgün akış, kaynak, kuyu, dipol ve girdap</b> temel akışlarını süperpoze et; <b>akım çizgilerini ($\\psi$)</b>, basınç katsayısı ($C_p$) alanını ve <b>Kutta–Joukowski kaldırma kuvvetini</b> canlı incele.', POT_PRESETS)}
    <div class="slm-toolbar">
      <div class="seg slm-seg-wrap" data-mode role="tablist" aria-label="Potansiyel akış modları">
        <button type="button" data-m="cylinder" class="on">Silindir + Sirkülasyon</button>
        <button type="button" data-m="rankine">Rankine Ovali</button>
        <button type="button" data-m="custom">Serbest Süperpozisyon</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-stag></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Akım Çizgileri ψ & Basınç Katsayısı C_p Alanı</h4><span class="slm-hint" data-dhint></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv slm-cv-drag" data-cv aria-label="2D potansiyel akış akım çizgileri"></canvas></div>
        </div>
        <div class="slm-plot-card" data-cpcard>
          <div class="slm-head"><h4 class="slm-title">Silindir Yüzeyi Basınç Katsayısı C_p(θ)</h4></div>
          <div class="slm-cv-box" data-bcp><canvas class="slm-cv" data-ccp aria-label="Silindir yüzey basınç katsayısı"></canvas><div class="slm-readout" data-rcp></div></div>
          <div class="slm-axis-lbl">Yüzey açısı θ (°) — 90° üst, 270° alt</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\psi = U_\\infty y\\left(1 - \\frac{R^2}{r^2}\\right) + \\frac{\\Gamma}{2\\pi}\\ln r, \\qquad C_p = 1 - \\left(\\frac{V}{U_\\infty}\\right)^2',
        'L\' = \\rho U_\\infty \\Gamma, \\qquad C_L = \\frac{\\Gamma}{U_\\infty R}, \\qquad \\sin\\theta_s = -\\frac{\\Gamma}{4\\pi U_\\infty R}',
      ],
      paragraphs: [
        '**Kutta–Joukowski teoremi** uyarınca sirkülasyon $\\Gamma > 0$ (saat yönü) silindirin üstünde hızı artırıp basıncı ($C_p$) düşürür, altında hızı azaltıp basıncı yükseltir; sonuçta yukarı yönlü $L\' = \\rho U_\\infty \\Gamma$ kaldırma kuvveti doğar.',
        '$|\\Gamma| = 4\\pi U_\\infty R$ sınırında iki durma noktası alt tepe noktasında birleşir; $|\\Gamma| > 4\\pi U_\\infty R$ için durma noktası yüzeyden ayrılıp akışkanın içine iner.',
      ],
      tasks: [
        '$\\Gamma = 0$ iken silindir yüzeyinde $C_p(0^\\circ) = +1$ ve $C_p(90^\\circ) = -3$ değerlerini (d’Alembert paradoksu, $L\' = 0$) doğrulayın.',
        'Sirkülasyonu $\\Gamma = 4\\pi U_\\infty R \\approx 125.7\\text{ m}^2/\\text{s}$ üstüne çıkarıp durma noktasının silindirden ayrılışını gözlemleyin.',
        '**Serbest Süperpozisyon** modunda kaynak ve girdap merkezlerini tuvalde sürükleyerek akım çizgilerindeki değişimi inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const stagEl = host.querySelector('[data-stag]');
  const dhint = host.querySelector('[data-dhint]');
  const cpcard = host.querySelector('[data-cpcard]');
  const cv = host.querySelector('[data-cv]');
  const ccp = host.querySelector('[data-ccp]');

  const sU = addSlider(ctrls, { label: 'Serbest Akış Hızı U∞', unit: 'm/s', min: 2, max: 25, value: st.U, step: 0.5, onInput: v => { st.U = v; update(); } });
  const sR = addSlider(ctrls, { label: 'Silindir Yarıçapı R', unit: 'm', min: 0.5, max: 1.6, value: st.R, step: 0.05, onInput: v => { st.R = v; update(); } });
  const sGam = addSlider(ctrls, { label: 'Sirkülasyon Γ', unit: 'm²/s', min: -160, max: 160, value: st.gamma, step: 2, onInput: v => { st.gamma = v; update(); } });
  const sSrc = addSlider(ctrls, { label: 'Kaynak Şiddeti m', unit: 'm²/s', min: 4, max: 60, value: st.srcM, step: 1, onInput: v => { st.srcM = v; if (st.customEls[0]) st.customEls[0].m = v; update(); } });
  const sHalf = addSlider(ctrls, { label: 'Kaynak–Kuyu Yarı Mesafe a', unit: 'm', min: 0.3, max: 1.8, value: st.halfA, step: 0.05, onInput: v => { st.halfA = v; update(); } });
  const tCp = addToggle(ctrls, 'C_p Basınç Renk Haritasını Göster', st.showCp, v => { st.showCp = v; mainCv.render(); });

  let cyl = null, dragIdx = -1;
  let box = { xMin: -3.4, xMax: 3.4, yMin: -2.2, yMax: 2.2, W: 400, H: 260 };

  function currentElements() {
    if (st.mode === 'cylinder') return cyl.elements;
    if (st.mode === 'rankine') {
      return [
        { type: 'uniform', U: st.U, alpha: 0 },
        { type: 'source', m: st.srcM, x: -st.halfA, y: 0 },
        { type: 'source', m: -st.srcM, x: st.halfA, y: 0 },
      ];
    }
    return [
      { type: 'uniform', U: st.U, alpha: st.alphaDeg * RAD },
      ...st.customEls.map((el, i) => i === 1 ? { ...el, gamma: st.gamma } : { ...el, m: st.srcM }),
    ];
  }

  function drawCpPlot() {
    if (st.mode !== 'cylinder' || !cyl) return;
    safePlot(ccp, [
      { name: 'C_p(θ)', color: COL_BLUE, xs: cyl.degs, ys: cyl.cps },
      { name: '0', color: 'rgba(255,255,255,.22)', xs: [0, 360], ys: [0, 0] },
    ], { x0: 0, x1: 360, ylabel: 'C_p', height: 170 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(340, Math.max(240, w * 0.58)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const aspect = W / H;
    const ySpan = 2.4;
    box = { xMin: -ySpan * aspect, xMax: ySpan * aspect, yMin: -ySpan, yMax: ySpan, W, H };
    const toScr = (wx, wy) => ({
      x: ((wx - box.xMin) / (box.xMax - box.xMin)) * W,
      y: ((box.yMax - wy) / (box.yMax - box.yMin)) * H,
    });

    if (st.mode === 'cylinder' && !cyl) return; // first draw happens before the cylinder state exists
    const els = currentElements();
    const nx = 64, ny = 42;
    const dx = (box.xMax - box.xMin) / (nx - 1);
    const dy = (box.yMax - box.yMin) / (ny - 1);
    const psiGrid = Array.from({ length: ny }, () => new Float64Array(nx));
    const cellW = W / (nx - 1), cellH = H / (ny - 1);

    for (let r = 0; r < ny; r++) {
      const wy = box.yMax - r * dy;
      for (let col = 0; col < nx; col++) {
        const wx = box.xMin + col * dx;
        const ev = evalPotentialFlow(wx, wy, els, st.U);
        psiGrid[r][col] = ev.psi;
        if (st.showCp) {
          if (st.mode === 'cylinder' && Math.hypot(wx, wy) < st.R * 0.96) continue;
          const u = Math.max(0, Math.min(1, (ev.Cp + 4) / 5)); // Cp in [-4, +1]
          const [rr, gg, bb] = thermalColorRGB(u);
          c.fillStyle = `rgba(${rr},${gg},${bb},0.34)`;
          c.fillRect(col * cellW, r * cellH, cellW + 0.8, cellH + 0.8);
        }
      }
    }

    // Streamlines via marching squares on psiGrid
    const psiSpan = st.U * ySpan * 1.1;
    const nLines = 22;
    c.strokeStyle = 'rgba(244,244,245,.72)'; c.lineWidth = 1.15;
    for (let k = -nLines / 2; k <= nLines / 2; k++) {
      const lvl = (k / (nLines / 2)) * psiSpan;
      const segs = marchingSquares(psiGrid, lvl);
      c.beginPath();
      for (const [ax, ay, bx, by] of segs) {
        c.moveTo(ax * cellW, ay * cellH);
        c.lineTo(bx * cellW, by * cellH);
      }
      c.stroke();
    }

    const acc = accentColor();
    if (st.mode === 'cylinder' && cyl) {
      const o = toScr(0, 0);
      const rPx = (st.R / (box.xMax - box.xMin)) * W;
      c.fillStyle = '#09090d'; c.strokeStyle = COL_FG; c.lineWidth = 2.2;
      c.beginPath(); c.arc(o.x, o.y, rPx, 0, Math.PI * 2); c.fill(); c.stroke();
      // Stagnation points
      for (const sp of cyl.stagPts) {
        const p = toScr(sp.x, sp.y);
        drawPin(c, p.x, p.y, 5, COL_WARN, '#000');
      }
      // Kutta-Joukowski Lift vector
      if (Math.abs(cyl.liftPerSpan) > 1) {
        const lLen = Math.max(-75, Math.min(75, (cyl.liftPerSpan / (st.rho * st.U * 140)) * 75));
        drawArrow(c, o.x, o.y, o.x, o.y - lLen, COL_OK, 2.8, 'L\'');
      }
    } else if (st.mode === 'rankine') {
      const p1 = toScr(-st.halfA, 0), p2 = toScr(st.halfA, 0);
      drawPin(c, p1.x, p1.y, 6, COL_OK, '#fff');
      drawPin(c, p2.x, p2.y, 6, COL_BAD, '#fff');
      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace';
      c.fillText('+m', p1.x - 10, p1.y - 10); c.fillText('−m', p2.x - 10, p2.y - 10);
    } else {
      st.customEls.forEach((el, idx) => {
        const p = toScr(el.x, el.y);
        const col = el.type === 'source' ? COL_OK : acc;
        drawPin(c, p.x, p.y, 7, col, '#fff');
        c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace';
        c.fillText(idx === 0 ? 'Kaynak' : 'Girdap', p.x + 10, p.y - 6);
      });
    }
  }, clean);

  bindDragCanvas(cv, {
    onDown(p) {
      if (st.mode !== 'custom') return false;
      const toScr = (wx, wy) => ({ x: ((wx - box.xMin) / (box.xMax - box.xMin)) * box.W, y: ((box.yMax - wy) / (box.yMax - box.yMin)) * box.H });
      dragIdx = st.customEls.findIndex(el => {
        const s = toScr(el.x, el.y);
        return Math.hypot(p.x - s.x, p.y - s.y) < 28;
      });
      return dragIdx >= 0;
    },
    onMove(p, dragging) {
      if (!dragging || dragIdx < 0) return;
      st.customEls[dragIdx].x = box.xMin + (p.x / box.W) * (box.xMax - box.xMin);
      st.customEls[dragIdx].y = box.yMax - (p.y / box.H) * (box.yMax - box.yMin);
      mainCv.render();
    },
    onUp() { dragIdx = -1; },
  }, clean);

  function update() {
    cyl = cylinderWithCirculation({ U: st.U, R: st.R, gamma: st.gamma, rho: st.rho });
    if (st.mode === 'cylinder') {
      const detached = cyl.stagPts.some(p => !p.onSurface);
      stagEl.textContent = detached ? 'Durma noktası yüzeyden ayrıldı!' : `${cyl.stagPts.length} yüzey durma noktası`;
      stagEl.className = `slm-badge ${detached ? 'slm-badge-warn' : 'slm-badge-ok'}`;
      renderKpis(kpis, [
        { lbl: 'Kaldırma L′ = ρUΓ', val: `${fmtFix(cyl.liftPerSpan, 1)} N/m`, sub: `C_L = ${fmtFix(cyl.CL, 2)}`, tone: 'acc' },
        { lbl: 'Kritik Sirkülasyon 4πUR', val: `${fmtFix(cyl.gammaCrit, 1)} m²/s`, sub: `|Γ|/Γ_kr = ${fmtFix(Math.abs(st.gamma) / cyl.gammaCrit, 2)}` },
        { lbl: 'Min. Basınç C_{p,min}', val: fmtFix(Math.min(...cyl.cps), 2), sub: 'Üst yüzeyde tepe hız', tone: 'ok' },
        { lbl: 'Dipol Şiddeti κ', val: `${fmtFix(cyl.kappa, 1)} m³/s`, sub: '2π U∞ R²' },
      ]);
      drawCpPlot();
    } else if (st.mode === 'rankine') {
      const xStag = Math.sqrt(st.halfA * st.halfA + (st.srcM * st.halfA) / (Math.PI * st.U));
      stagEl.textContent = `Rankine Ovali (yarı boy = ${fmtFix(xStag, 2)} m)`;
      stagEl.className = 'slm-badge slm-badge-acc';
      renderKpis(kpis, [
        { lbl: 'Oval Yarı Uzunluk x_s', val: `${fmtFix(xStag, 2)} m`, sub: `Kaynaklar ±${st.halfA} m`, tone: 'acc' },
        { lbl: 'Kaynak / Kuyu ±m', val: `±${st.srcM} m²/s`, sub: 'Net akı = 0 (kapalı cisim)' },
        { lbl: 'Serbest Hız U∞', val: `${st.U} m/s`, sub: 'İki simetrik durma noktası' },
        { lbl: 'Net Kaldırma L′', val: '0 N/m', sub: 'Sirkülasyon yok (Γ=0)' },
      ]);
    } else {
      stagEl.textContent = 'Elemanları tuvalde sürükle';
      stagEl.className = 'slm-badge slm-badge-ok';
      renderKpis(kpis, [
        { lbl: 'Kaynak Şiddeti m', val: `${st.srcM} m²/s`, sub: 'Sürüklenebilir (+m)' },
        { lbl: 'Girdap Γ', val: `${st.gamma} m²/s`, sub: `L′ ≈ ${fmtFix(st.rho * st.U * st.gamma, 1)} N/m`, tone: 'acc' },
        { lbl: 'Düzgün Akış U∞', val: `${st.U} m/s`, sub: 'Süperpozisyon geçerli (doğrusal)' },
        { lbl: 'Laplace ∇²ψ = 0', val: 'Sıkıştırılamaz', sub: 'Dönüşsüz (irrotasyonel)' },
      ]);
    }
    mainCv.render();
  }

  function syncMode() {
    const isC = st.mode === 'cylinder', isR = st.mode === 'rankine', isCu = st.mode === 'custom';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sR.setVisible(isC); sGam.setVisible(isC || isCu);
    sSrc.setVisible(isR || isCu); sHalf.setVisible(isR);
    cpcard.hidden = !isC;
    dhint.textContent = isCu ? 'Kaynak ve Girdap noktalarını sürükle' : 'Sarı noktalar: durma noktaları (V = 0)';
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, POT_PRESETS, p => {
    Object.assign(st, p);
    sU.set(st.U); sR.set(st.R); sGam.set(st.gamma); sSrc.set(st.srcM); sHalf.set(st.halfA);
    syncMode(); update();
  });

  attachReadout(ccp, host.querySelector('[data-rcp]'), (x, ser, i) => `θ=${fmtFix(x, 0)}° · C_p=${fmtFix(ser[0].ys[i], 2)}`, clean);
  observeResize(host.querySelector('[data-bcp]'), drawCpPlot, clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 15. AKIŞKAN STATİĞİ & KALDIRMA (Submerged Gate & Buoyancy Stability)
// =====================================================================

const HYDRO_PRESETS = [
  { label: 'Dikey Baraj Kapağı', mode: 'gate', b: 3.0, L: 4.0, thetaDeg: 90, hTop: 0, rho: 998 },
  { label: 'Eğik Batık Kapak (55°)', mode: 'gate', b: 2.5, L: 3.5, thetaDeg: 55, hTop: 1.5, rho: 998 },
  { label: 'Geniş Kararlı Duba (GM>0)', mode: 'buoy', B: 6.5, H: 2.6, relDensity: 0.55, kgRatio: 0.48, heelDeg: 14 },
  { label: 'Dar Kararsız Blok (Alabora!)', mode: 'buoy', B: 2.2, H: 4.0, relDensity: 0.55, kgRatio: 0.62, heelDeg: 10 },
];

function mountHydrostatics(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'buoy',
    b: 2.5, L: 3.5, thetaDeg: 55, hTop: 1.5, rho: 998,
    B: 6.5, H: 2.6, hullL: 12, relDensity: 0.55, kgRatio: 0.48, heelDeg: 14,
    playing: autoPlayAllowed(), rockT: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('Batık düzlem kapak üzerindeki <b>hidrostatik basınç prizması</b> ile basınç merkezini ($CP$) hesapla; yüzen bir gövdede <b>metasantr yüksekliği ($GM$)</b> ve doğrulma kararlılığını canlı incele.', HYDRO_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-mode role="tablist" aria-label="Akışkan statiği modları">
          <button type="button" data-m="gate">Batık Kapak</button>
          <button type="button" data-m="buoy" class="on">Kaldırma & Metasantr (GM)</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
      </div>
      <span class="slm-badge" data-stat></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>Yüzen Gövde — K, B, G ve Metasantr M Noktaları</h4></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Hidrostatik kapak veya yüzen gövde metasantr diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'F_R = \\rho g h_c A, \\qquad y_P = y_c + \\frac{I_{xc}}{y_c A} = y_c + \\frac{L^2}{12 y_c}',
        'T = \\frac{\\rho_c}{\\rho_s}H, \\qquad BM = \\frac{I_w}{\\forall} = \\frac{B^2}{12 T}, \\qquad GM = KB + BM - KG',
      ],
      paragraphs: [
        'Basınç derinlikle doğrusal arttığından ($P = \\rho g h$), bileşke kuvvetin etki noktası olan **basınç merkezi ($CP$)** daima ağırlık merkezi $C$’nin **altındadır** ($h_{\\text{üst}} = 0$ dikey kapakta $h_P = \\frac{2}{3}L$).',
        'Yüzen bir gövde yan yattığında kaldırma merkezi $B \\to B\'$ kayar. **Metasantr ($M$)** ağırlık merkezi $G$’nin üstündeyse ($GM > 0$) doğrulma momenti $M_R = W\\cdot GZ$ tekneyi dikeltir; $GM < 0$ ise gövde alabora olur.',
      ],
      tasks: [
        '**Batık Kapak**ta üst derinliği $h_{\\text{üst}} = 0$, açıyı $90^\\circ$ yapıp $h_P = \\frac{2}{3}L$ sonucunu doğrulayın; sonra $h_{\\text{üst}}$’ü büyüttükçe $CP$’nin merkeze yaklaştığını izleyin.',
        '**Metasantr** modunda ağırlık merkezi oranını ($KG/H$) yukarı taşıyarak gövdenin kararlıdan **kararsıza ($GM < 0$)** geçtiği sınırı bulun.',
        'Gövde genişliği $B$’yi biraz artırıp $BM \\propto B^2$ sayesinde kararlılığın nasıl hızla güçlendiğini gözlemleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const statEl = host.querySelector('[data-stat]');
  const alertEl = host.querySelector('[data-alert]');
  const playBtn = host.querySelector('[data-play]');
  const cv = host.querySelector('[data-cv]');

  // Gate controls
  const sB = addSlider(ctrls, { label: 'Kapak Genişliği b', unit: 'm', min: 0.5, max: 6, value: st.b, step: 0.25, onInput: v => { st.b = v; update(); } });
  const sLg = addSlider(ctrls, { label: 'Kapak Boyu L', unit: 'm', min: 1, max: 6, value: st.L, step: 0.25, onInput: v => { st.L = v; update(); } });
  const sTh = addSlider(ctrls, { label: 'Kapak Açısı θ', unit: '°', min: 25, max: 90, value: st.thetaDeg, step: 1, fmt: v => `${v}°`, onInput: v => { st.thetaDeg = v; update(); } });
  const sHtop = addSlider(ctrls, { label: 'Üst Kenar Derinliği h_üst', unit: 'm', min: 0, max: 5, value: st.hTop, step: 0.1, onInput: v => { st.hTop = v; update(); } });

  // Buoyancy controls
  const sBeam = addSlider(ctrls, { label: 'Gövde Genişliği B', unit: 'm', min: 1.5, max: 10, value: st.B, step: 0.2, onInput: v => { st.B = v; update(); } });
  const sH = addSlider(ctrls, { label: 'Gövde Yüksekliği H', unit: 'm', min: 1.5, max: 6, value: st.H, step: 0.2, onInput: v => { st.H = v; update(); } });
  const sRel = addSlider(ctrls, { label: 'Bağıl Yoğunluk ρ_c/ρ_s', min: 0.15, max: 0.9, value: st.relDensity, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.relDensity = v; update(); } });
  const sKG = addSlider(ctrls, { label: 'Ağırlık Merkezi KG / H', min: 0.2, max: 0.95, value: st.kgRatio, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.kgRatio = v; update(); } });
  const sHeel = addSlider(ctrls, { label: 'Yatma Açısı φ', unit: '°', min: -25, max: 25, value: st.heelDeg, step: 1, fmt: v => `${v}°`, onInput: v => { st.heelDeg = v; update(); } });

  let gRes = null, bRes = null;

  const mainCv = setupCanvas(cv, w => Math.min(340, Math.max(245, w * 0.56)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();

    if (st.mode === 'gate' && gRes) {
      const surfY = 42;
      const totDepth = st.hTop + st.L * Math.sin(st.thetaDeg * RAD) + 0.8;
      const sc = (H - surfY - 28) / Math.max(3, totDepth);
      const th = st.thetaDeg * RAD;
      // Gate slopes '/' down-left from (gx0, gy0) to (gx1, gy1); water sits cleanly on the LEFT
      const gx0 = W * 0.62, gy0 = surfY + st.hTop * sc;
      const gx1 = gx0 - st.L * Math.cos(th) * sc, gy1 = gy0 + st.L * Math.sin(th) * sc;
      const ux = -Math.cos(th), uy = Math.sin(th); // unit vector along gate downward
      const nx = -uy, ny = ux; // unit normal pointing up-left into the water!

      // Water region on the left of dam wall
      c.fillStyle = 'rgba(90,176,255,.11)';
      c.beginPath();
      c.moveTo(0, surfY); c.lineTo(gx0, surfY); c.lineTo(gx0, gy0); c.lineTo(gx1, gy1); c.lineTo(gx1, H); c.lineTo(0, H);
      c.closePath(); c.fill();
      c.strokeStyle = COL_BLUE; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, surfY); c.lineTo(gx0, surfY); c.stroke();

      const pMaxPx = Math.min(115, W * 0.28);
      const pScale = pMaxPx / Math.max(1, gRes.pBot);
      const p0 = gRes.pTop * pScale, p1 = gRes.pBot * pScale;

      // Trapezoidal pressure prism on the water side
      c.fillStyle = 'rgba(90,176,255,.24)'; c.strokeStyle = COL_BLUE; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(gx0, gy0);
      c.lineTo(gx0 + nx * p0, gy0 + ny * p0);
      c.lineTo(gx1 + nx * p1, gy1 + ny * p1);
      c.lineTo(gx1, gy1);
      c.closePath(); c.fill(); c.stroke();

      // Gate thick line
      c.strokeStyle = COL_FG; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(gx0, gy0); c.lineTo(gx1, gy1); c.stroke();

      // Centroid C & Center of Pressure CP
      const cx = gx0 + ux * (st.L * 0.5) * sc, cy = gy0 + uy * (st.L * 0.5) * sc;
      const dCP = (st.L * 0.5 + gRes.eP) * sc;
      const px = gx0 + ux * dCP, py = gy0 + uy * dCP;

      drawPin(c, cx, cy, 5, COL_WARN, '#000');
      drawPin(c, px, py, 6, acc, '#fff');
      drawArrow(c, px + nx * 64, py + ny * 64, px + nx * 6, py + ny * 6, acc, 2.6, 'F_R');

      c.fillStyle = COL_WARN; c.font = '600 11px "JetBrains Mono", monospace';
      c.fillText(`C (h_c=${fmtFix(gRes.hc, 2)}m)`, cx + 10, cy - 2);
      c.fillStyle = acc;
      c.fillText(`CP (h_P=${fmtFix(gRes.hP, 2)}m)`, px + 10, py + 12);
    } else if (bRes) {
      // Floating rectangular hull tilted by effective heel angle
      const wlY = H * 0.52;
      const rock = st.playing && bRes.stable ? Math.sin(st.rockT * 2.1) * 5 : 0;
      const heelDeg = st.heelDeg + rock;
      const phi = heelDeg * RAD;

      // Water region & waves
      c.fillStyle = 'rgba(90,176,255,.12)';
      c.fillRect(0, wlY, W, H - wlY);
      c.strokeStyle = COL_BLUE; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, wlY); c.lineTo(W, wlY); c.stroke();

      const sc = Math.min(W * 0.42 / Math.max(st.B, 3), H * 0.42 / Math.max(st.H, 2.5));
      const bw = st.B * sc, bh = st.H * sc, draftPx = bRes.draft * sc;
      const ox = W * 0.5;
      // Rotate hull about centerline at waterline (0, draftPx from keel)
      c.save();
      c.translate(ox, wlY);
      c.rotate(phi);

      const keelY = draftPx;
      const deckY = draftPx - bh;
      c.fillStyle = 'rgba(255,255,255,.08)'; c.strokeStyle = bRes.stable ? COL_FG : COL_BAD; c.lineWidth = 2.4;
      c.fillRect(-bw / 2, deckY, bw, bh);
      c.strokeRect(-bw / 2, deckY, bw, bh);

      // Centerline dashed
      c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, deckY - 40); c.lineTo(0, keelY + 12); c.stroke(); c.setLineDash([]);

      // Points K (keel), B0 (upright buoyancy), G (gravity), M (metacenter)
      const yK = keelY;
      const yB = keelY - bRes.KB * sc;
      const yG = keelY - bRes.KG * sc;
      const yM = keelY - (bRes.KB + bRes.BM) * sc;
      const bShiftX = bRes.BM * Math.sin(phi) * sc;

      drawPin(c, 0, yK, 4, COL_MUTE, '#fff');
      drawPin(c, bShiftX, yB, 5.5, COL_BLUE, '#fff');
      drawPin(c, 0, yG, 6, COL_WARN, '#000');
      drawPin(c, 0, yM, 6, bRes.stable ? COL_OK : COL_BAD, '#fff');

      c.font = '600 11px "JetBrains Mono", monospace';
      c.fillStyle = COL_WARN; c.fillText('G', 9, yG + 4);
      c.fillStyle = COL_BLUE; c.fillText('B′', bShiftX + 8, yB + 4);
      c.fillStyle = bRes.stable ? COL_OK : COL_BAD; c.fillText('M', 9, yM + 4);
      c.restore();

      // World-vertical gravity & buoyancy couple arrows
      const gx = ox + Math.sin(phi) * (bRes.KG - bRes.draft) * sc;
      const gy = wlY - Math.cos(phi) * (bRes.KG - bRes.draft) * sc;
      const bLocalX = bRes.BM * Math.sin(phi) * sc;
      const bLocalY = bRes.draft * sc - bRes.KB * sc;
      const bx = ox + bLocalX * Math.cos(phi) - bLocalY * Math.sin(phi);
      const by = wlY + bLocalX * Math.sin(phi) + bLocalY * Math.cos(phi);
      drawArrow(c, gx, gy, gx, gy + 44, COL_WARN, 2.2, 'W');
      drawArrow(c, bx, by, bx, by - 44, COL_BLUE, 2.2, 'F_B');
    }
  }, clean);

  function update() {
    if (st.mode === 'gate') {
      gRes = solveSubmergedGate({ b: st.b, L: st.L, thetaDeg: st.thetaDeg, hTop: st.hTop, rho: st.rho });
      statEl.textContent = `F_R = ${fmtFix(gRes.FR / 1000, 1)} kN`;
      statEl.className = 'slm-badge slm-badge-acc';
      alertEl.innerHTML = '';
      renderKpis(kpis, [
        { lbl: 'Bileşke Kuvvet F_R', val: `${fmtFix(gRes.FR / 1000, 2)} kN`, sub: `Alan A = ${fmtFix(gRes.A, 2)} m²`, tone: 'acc' },
        { lbl: 'Basınç Merkezi h_P', val: `${fmtFix(gRes.hP, 3)} m`, sub: `h_c = ${fmtFix(gRes.hc, 3)} m (e = +${fmtFix(gRes.eP * 100, 1)} cm)`, tone: 'ok' },
        { lbl: 'Üst / Alt Basınç', val: `${fmtFix(gRes.pTop / 1000, 1)} / ${fmtFix(gRes.pBot / 1000, 1)} kPa`, sub: 'P = ρ g h' },
        { lbl: 'Üst Menteşe Momenti', val: `${fmtFix(gRes.momentTop / 1000, 1)} kN·m`, sub: `Alt menteşe: ${fmtFix(gRes.momentBot / 1000, 1)} kN·m` },
      ]);
    } else {
      bRes = solveBuoyancyStability({ B: st.B, H: st.H, L: st.hullL, relDensity: st.relDensity, kgRatio: st.kgRatio, heelDeg: st.heelDeg });
      statEl.textContent = bRes.status;
      statEl.className = `slm-badge ${bRes.stable ? 'slm-badge-ok' : 'slm-badge-bad'}`;
      alertEl.innerHTML = !bRes.stable
        ? `<div class="slm-alert slm-alert-bad">Metasantr M ağırlık merkezi G’nin altında (GM = ${fmtFix(bRes.GM, 2)} m < 0)! Gövde kararsız ve alabora olma eğilimindedir.</div>`
        : '';
      renderKpis(kpis, [
        { lbl: 'Metasantr Yüksekliği GM', val: `${fmtFix(bRes.GM, 3)} m`, sub: 'KB + BM − KG', tone: bRes.stable ? 'ok' : 'bad' },
        { lbl: 'Su Çekimi (Draft) T', val: `${fmtFix(bRes.draft, 2)} m`, sub: `KB = ${fmtFix(bRes.KB, 2)} m · Fribord ${fmtFix(bRes.freeboard, 2)} m` },
        { lbl: 'Metasantr Yarıçapı BM', val: `${fmtFix(bRes.BM, 2)} m`, sub: `KG = ${fmtFix(bRes.KG, 2)} m` },
        { lbl: 'Doğrulma Kolu GZ', val: `${fmtFix(bRes.GZ, 3)} m`, sub: `Moment: ${fmtFix(bRes.rightingMoment / 1000, 1)} kN·m`, tone: 'acc' },
      ]);
    }
    mainCv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.mode !== 'buoy') return false;
    st.rockT += dt;
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isG = st.mode === 'gate';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    [sB, sLg, sTh, sHtop].forEach(s => s.setVisible(isG));
    [sBeam, sH, sRel, sKG, sHeel].forEach(s => s.setVisible(!isG));
    playBtn.hidden = isG;
    host.querySelector('[data-cvtitle]').textContent = isG ? 'Batık Kapak Hidrostatik Basınç Prizması' : 'Yüzen Gövde — K, B′, G ve Metasantr M';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing && st.mode === 'buoy') loop.start(); else loop.stop();
  });
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
    if (st.mode === 'buoy' && st.playing) loop.start(); else loop.stop();
    syncSegments(host, false);
  });
  bindPresets(host, HYDRO_PRESETS, p => {
    Object.assign(st, p);
    sB.set(st.b); sLg.set(st.L); sTh.set(st.thetaDeg); sHtop.set(st.hTop);
    sBeam.set(st.B); sH.set(st.H); sRel.set(st.relDensity); sKG.set(st.kgRatio); sHeel.set(st.heelDeg);
    syncMode(); update();
  });

  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 16. ISI IŞINIMI (Planck, Wien, Stefan-Boltzmann, Parallel Plates View Factor)
// =====================================================================

const RAD_PRESETS = [
  { label: 'Oda Sıcaklığı (300 K)', mode: 'planck', T: 300, eps: 0.95 },
  { label: 'Akkor Flaman (2800 K)', mode: 'planck', T: 2800, eps: 0.9 },
  { label: 'Güneş Yüzeyi (5778 K)', mode: 'planck', T: 5778, eps: 1.0 },
  { label: 'Mavi Dev Yıldız (10000 K)', mode: 'planck', T: 10000, eps: 1.0 },
  { label: 'Paralel Levhalar (W=H=L)', mode: 'view', W: 1.0, H: 1.0, L: 1.0, T1: 900, T2: 300, eps1: 0.85, eps2: 0.85 },
];

function mountThermalRadiation(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'planck', T: 5778, eps: 1.0, logY: false,
    W: 1.2, H: 1.2, L: 0.6, T1: 900, T2: 300, eps1: 0.85, eps2: 0.85,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Planck kara cisim spektrumu</b>, <b>Wien kayma yasası</b> ve <b>Stefan–Boltzmann</b> ışınım gücünü incele; hizalanmış paralel levhalar arasında <b>görüş faktörü ($F_{12}$)</b> ve net ışınım geçişini hesapla.', RAD_PRESETS)}
    <div class="slm-toolbar">
      <div class="seg" data-mode role="tablist" aria-label="Işınım modları">
        <button type="button" data-m="planck" class="on">Kara Cisim (Planck & Wien)</button>
        <button type="button" data-m="view">Görüş Faktörü (Paralel Levha)</button>
      </div>
      <div class="slm-swatch-bar" data-swatch>
        <span class="slm-swatch-dot" data-dot></span>
        <span class="mono" data-swtxt></span>
      </div>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-t1>Planck Spektral Işınım Gücü E_{bλ}(λ, T)</h4><span class="slm-hint mono" data-wien></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Planck spektrumu veya paralel levha görüş faktörü"></canvas></div>
          <div class="slm-axis-lbl" data-ax>Dalga boyu λ (µm, log ölçek) — Görünür bant: 0.38–0.75 µm</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'E_{b\\lambda}(\\lambda, T) = \\frac{C_1}{\\lambda^5\\left(e^{C_2/(\\lambda T)} - 1\\right)}, \\qquad \\lambda_{\\max} T = 2897.8\\;\\mu\\text{m}\\cdot\\text{K}, \\qquad E = \\varepsilon\\sigma T^4',
        'Q_{12} = \\frac{\\sigma(T_1^4 - T_2^4)}{\\frac{1-\\varepsilon_1}{\\varepsilon_1 A_1} + \\frac{1}{A_1 F_{12}} + \\frac{1-\\varepsilon_2}{\\varepsilon_2 A_2}}',
      ],
      paragraphs: [
        'Sıcaklık arttıkça **toplam ışınım $T^4$ ile hızla büyür** ve tepe dalga boyu **Wien yasası** gereği kısa dalga boylarına (kızılötesi → görünür → morötesi) kayar.',
        'İki paralel levha arasındaki **görüş faktörü $F_{12}$**, yalnızca geometriye ($W/L, H/L$) bağlıdır: $L \\to 0$ iken $F_{12} \\to 1$, $L \\gg W, H$ iken $F_{12} \\approx WH / (\\pi L^2)$ olur.',
      ],
      tasks: [
        'Sıcaklığı $2800\\text{ K}$ (akkor lamba) ile $5778\\text{ K}$ (Güneş) arasında kıyaslayıp görünür ışık verim payındaki büyük farkı inceleyin.',
        'Sıcaklığı iki katına çıkarıp ($3000\\text{ K} \\to 6000\\text{ K}$) Stefan–Boltzmann gücünün tam $2^4 = 16$ kat arttığını doğrulayın.',
        '**Görüş Faktörü** modunda $W = H = L = 1\\text{ m}$ kare levhalar için ders kitabı değeri $F_{12} = 0.200$ sonucunu kontrol edin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const swBar = host.querySelector('[data-swatch]');
  const swDot = host.querySelector('[data-dot]');
  const swTxt = host.querySelector('[data-swtxt]');
  const wienEl = host.querySelector('[data-wien]');
  const cv = host.querySelector('[data-cv]');

  const sT = addSlider(ctrls, { label: 'Sıcaklık T', unit: 'K', min: 300, max: 12000, value: st.T, log: true, fmt: v => `${Math.round(v)} K`, onInput: v => { st.T = Math.round(v); update(); } });
  const sEps = addSlider(ctrls, { label: 'Yayıcılık (Emisivite) ε', min: 0.1, max: 1.0, value: st.eps, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.eps = v; update(); } });
  const tLogY = addToggle(ctrls, 'Logaritmik Dikey Eksen', st.logY, v => { st.logY = v; mainCv.render(); });

  const sW = addSlider(ctrls, { label: 'Levha Genişliği W', unit: 'm', min: 0.2, max: 4.0, value: st.W, step: 0.1, onInput: v => { st.W = v; update(); } });
  const sH = addSlider(ctrls, { label: 'Levha Yüksekliği H', unit: 'm', min: 0.2, max: 4.0, value: st.H, step: 0.1, onInput: v => { st.H = v; update(); } });
  const sL = addSlider(ctrls, { label: 'Levhalar Arası Mesafe L', unit: 'm', min: 0.1, max: 4.0, value: st.L, step: 0.05, onInput: v => { st.L = v; update(); } });
  const sT1 = addSlider(ctrls, { label: 'Sıcak Levha T₁', unit: 'K', min: 300, max: 1800, value: st.T1, step: 20, onInput: v => { st.T1 = v; update(); } });
  const sT2 = addSlider(ctrls, { label: 'Soğuk Levha T₂', unit: 'K', min: 200, max: 1200, value: st.T2, step: 20, onInput: v => { st.T2 = v; update(); } });
  const sE1 = addSlider(ctrls, { label: 'Levha Emisiviteleri ε₁=ε₂', min: 0.1, max: 1.0, value: st.eps1, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.eps1 = st.eps2 = v; update(); } });

  let bb = null, radEx = null;

  const mainCv = setupCanvas(cv, w => Math.min(315, Math.max(225, w * 0.52)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();

    if (st.mode === 'planck' && bb) {
      const L = 54, R = 16, T = 18, B = 28, pw = W - L - R, ph = H - T - B;
      const lx0 = Math.log10(0.1), lx1 = Math.log10(30);
      const fx = um => L + ((Math.log10(Math.max(0.1, Math.min(30, um))) - lx0) / (lx1 - lx0)) * pw;

      const eMax = Math.max(1e-6, ...bb.Evals);
      const fy = val => {
        if (st.logY) {
          const lo = Math.log10(eMax * 1e-4), hi = Math.log10(eMax * 1.3);
          const lv = Math.log10(Math.max(eMax * 1e-4, val));
          return T + ((hi - lv) / (hi - lo)) * ph;
        }
        return T + (1 - val / (eMax * 1.08)) * ph;
      };

      // Visible light rainbow band (0.38 - 0.75 um)
      const vx0 = fx(0.38), vx1 = fx(0.75);
      const rg = c.createLinearGradient(vx0, 0, vx1, 0);
      rg.addColorStop(0, 'rgba(139,92,246,.32)');
      rg.addColorStop(0.28, 'rgba(59,130,246,.30)');
      rg.addColorStop(0.55, 'rgba(34,197,94,.28)');
      rg.addColorStop(0.78, 'rgba(250,204,21,.30)');
      rg.addColorStop(1, 'rgba(239,68,68,.32)');
      c.fillStyle = rg;
      c.fillRect(vx0, T, vx1 - vx0, ph);

      // Grid & log ticks
      c.strokeStyle = COL_GRID; c.lineWidth = 1; c.font = '10.5px "JetBrains Mono", monospace';
      for (const um of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30]) {
        const x = fx(um);
        c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${um}`, x, H - 8);
      }
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, T); c.lineTo(L, T + ph); c.lineTo(L + pw, T + ph); c.stroke();

      // Planck curve
      const col = blackbodyColorHex(st.T);
      c.strokeStyle = st.T < 1300 ? COL_WARN : col; c.lineWidth = 2.5;
      c.beginPath();
      bb.lamsUm.forEach((um, i) => {
        const x = fx(um), y = fy(bb.Evals[i]);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      });
      c.stroke();

      // Wien peak line
      if (bb.lambdaMaxUm >= 0.1 && bb.lambdaMaxUm <= 30) {
        const wx = fx(bb.lambdaMaxUm);
        c.save(); c.setLineDash([4, 4]); c.strokeStyle = acc; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(wx, T); c.lineTo(wx, T + ph); c.stroke(); c.restore();
        c.fillStyle = acc; c.textAlign = 'left';
        c.fillText(`λ_max = ${fmtFix(bb.lambdaMaxUm, 2)} µm`, Math.min(wx + 5, W - 120), T + 14);
      }
      c.fillStyle = COL_MUTE; c.textAlign = 'right';
      c.fillText(eMax.toExponential(1), L - 4, T + 10);
      c.fillText('0', L - 4, T + ph);
      c.textAlign = 'left';
    } else if (radEx) {
      // Left: 3D-perspective parallel plates + rays; Right: F12 vs L/W curve
      const splitX = W * 0.5;
      const cx = splitX * 0.5, cy = H * 0.52;
      const sc = Math.min(splitX * 0.24, H * 0.26);
      const pw = Math.min(1.6, st.W / Math.max(st.W, st.H)) * sc;
      const ph = Math.min(1.6, st.H / Math.max(st.W, st.H)) * sc;
      const sep = Math.min(splitX * 0.42, Math.max(22, (st.L / Math.max(st.W, st.H)) * sc * 0.95));

      const drawPlate = (x, col, lbl) => {
        c.fillStyle = `${col}26`; c.strokeStyle = col; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - pw * 0.25, cy - ph * 0.65);
        c.lineTo(x + pw * 0.25, cy - ph * 0.45);
        c.lineTo(x + pw * 0.25, cy + ph * 0.65);
        c.lineTo(x - pw * 0.25, cy + ph * 0.45);
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = col; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(lbl, x, cy + ph * 0.65 + 18);
      };
      const x1 = cx - sep * 0.5, x2 = cx + sep * 0.5;
      // Radiation exchange rays
      c.strokeStyle = 'rgba(255,209,102,.32)'; c.lineWidth = 1.1;
      for (let k = -2; k <= 2; k++) {
        drawArrow(c, x1 + 6, cy + k * ph * 0.2, x2 - 6, cy - k * ph * 0.14, 'rgba(255,209,102,.5)', 1.2);
      }
      drawPlate(x1, COL_BAD, `T₁=${st.T1}K`);
      drawPlate(x2, COL_BLUE, `T₂=${st.T2}K`);

      // Right mini plot: F12 vs L
      const L = splitX + 38, R = 14, T = 18, B = 28, gw = W - L - R, gh = H - T - B;
      if (gw > 60) {
        const fx = l => L + ((l - 0.1) / 3.9) * gw;
        const fy = f => T + (1 - f) * gh;
        c.strokeStyle = COL_AXIS;
        c.beginPath(); c.moveTo(L, T); c.lineTo(L, T + gh); c.lineTo(L + gw, T + gh); c.stroke();
        c.strokeStyle = acc; c.lineWidth = 2.2;
        c.beginPath();
        for (let i = 0; i <= 80; i++) {
          const l = 0.1 + (3.9 * i) / 80;
          const f = viewFactorParallelPlates(st.W, st.H, l);
          if (i === 0) c.moveTo(fx(l), fy(f)); else c.lineTo(fx(l), fy(f));
        }
        c.stroke();
        drawPin(c, fx(st.L), fy(radEx.F12), 5, COL_OK, '#fff');
        c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
        c.textAlign = 'right'; c.fillText('1.0', L - 4, T + 9); c.fillText('0', L - 4, T + gh);
        c.textAlign = 'center'; c.fillText('Mesafe L (m)', L + gw * 0.5, H - 8);
        c.fillStyle = COL_OK; c.fillText(`F₁₂ = ${fmtFix(radEx.F12, 3)}`, fx(st.L), Math.max(T + 14, fy(radEx.F12) - 10));
      }
      c.textAlign = 'left';
    }
  }, clean);

  function update() {
    if (st.mode === 'planck') {
      bb = blackbodySummary(st.T, st.eps);
      const hex = blackbodyColorHex(st.T);
      swDot.style.background = hex;
      swDot.style.boxShadow = `0 0 12px ${hex}`;
      swTxt.textContent = `${st.T} K ışıma rengi`;
      wienEl.textContent = `λ_max = ${fmtFix(bb.lambdaMaxUm, 2)} µm`;
      renderKpis(kpis, [
        { lbl: 'Tepe Dalga Boyu λ_max', val: `${fmtFix(bb.lambdaMaxUm, 2)} µm`, sub: bb.lambdaMaxUm < 0.38 ? 'Morötesi (UV)' : bb.lambdaMaxUm <= 0.75 ? 'Görünür Işık' : 'Kızılötesi (IR)', tone: 'acc' },
        { lbl: 'Toplam Güç E = εσT⁴', val: fmtUnit(bb.EReal, 'W/m²', 3), sub: `Kara cisim: ${fmtUnit(bb.EbTotal, 'W/m²', 3)}`, tone: 'ok' },
        { lbl: 'Görünür Bant Payı', val: `%${fmtFix(bb.fVis * 100, 1)}`, sub: '0.38 – 0.75 µm' },
        { lbl: 'UV / Kızılötesi Payı', val: `%${fmtFix(bb.fUV * 100, 1)} / %${fmtFix(bb.fIR * 100, 1)}`, sub: `ε = ${st.eps.toFixed(2)}` },
      ]);
    } else {
      radEx = radiationPlateExchange({ W: st.W, H: st.H, L: st.L, T1: st.T1, T2: st.T2, eps1: st.eps1, eps2: st.eps2 });
      wienEl.textContent = `X=${fmtFix(st.W / st.L, 2)} · Y=${fmtFix(st.H / st.L, 2)}`;
      renderKpis(kpis, [
        { lbl: 'Görüş Faktörü F₁₂', val: fmtFix(radEx.F12, 4), sub: `F₂₁ = ${fmtFix(radEx.F12, 4)} (eş alan)`, tone: 'acc' },
        { lbl: 'Net Işınım Gücü Q₁₂', val: fmtUnit(radEx.Q12, 'W', 3), sub: `${fmtUnit(radEx.Q12 / radEx.A, 'W/m²', 3)}`, tone: 'ok' },
        { lbl: 'Levha Alanı A', val: `${fmtFix(radEx.A, 2)} m²`, sub: `${st.W} × ${st.H} m` },
        { lbl: 'Toplam Işınım Direnci', val: `${fmtFix(radEx.Rtot, 3)} m⁻²`, sub: `Uzay 1/(AF₁₂) = ${fmtFix(radEx.R12, 2)}` },
      ]);
    }
    mainCv.render();
  }

  function syncMode() {
    const isP = st.mode === 'planck';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    [sT, sEps, tLogY].forEach(s => s.setVisible(isP));
    [sW, sH, sL, sT1, sT2, sE1].forEach(s => s.setVisible(!isP));
    swBar.hidden = !isP;
    host.querySelector('[data-t1]').textContent = isP ? 'Planck Spektral Işınım Gücü E_{bλ}(λ, T)' : 'Paralel Levhalar & Görüş Faktörü F₁₂(L)';
    host.querySelector('[data-ax]').textContent = isP ? 'Dalga boyu λ (µm, log ölçek) — Görünür bant: 0.38–0.75 µm' : 'Sol: paralel levha şeması · Sağ: mesafeye göre görüş faktörü';
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update(); syncSegments(host, false);
  });
  bindPresets(host, RAD_PRESETS, p => {
    Object.assign(st, p);
    sT.set(st.T); sEps.set(st.eps); sW.set(st.W); sH.set(st.H); sL.set(st.L); sT1.set(st.T1); sT2.set(st.T2); sE1.set(st.eps1);
    syncMode(); update();
  });

  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 17. YÖRÜNGE MEKANİĞİ (Two-Body Orbit, Draggable Velocity, Kepler, Hohmann)
// =====================================================================

const ORBIT_PRESETS = [
  { label: 'ISS Dairesel (400 km)', mode: 'orbit', altKm: 400, vRatio: 1.0, gammaDeg: 0, warp: 400 },
  { label: 'Eliptik Yörünge (e ≈ 0.45)', mode: 'orbit', altKm: 600, vRatio: 1.2, gammaDeg: 0, warp: 900 },
  { label: 'Kaçış Hızı (v = v_esc)', mode: 'orbit', altKm: 800, vRatio: 1.414, gammaDeg: 0, warp: 1000 },
  { label: 'LEO → GEO Hohmann Transfer', mode: 'hohmann', h1Km: 400, h2Km: 35786, warp: 2200 },
  { label: 'LEO → MEO Transfer', mode: 'hohmann', h1Km: 400, h2Km: 12000, warp: 1200 },
];

function mountOrbitalMechanics(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'orbit', altKm: 600, vRatio: 1.18, gammaDeg: 0,
    h1Km: 400, h2Km: 20000, warp: 800,
    showKepler: true, playing: autoPlayAllowed(),
    sat: [R_EARTH + 600e3, 0, 0, 8900], trail: [], sweepWedges: [], sweepAcc: 0, simT: 0,
    hPhase: 0, // 0..1 progress along Hohmann transfer
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>İki cisim yörünge mekaniğini</b> canlı simüle et; başlangıç <b>hız vektörünün ucunu tuvalde sürükleyerek</b> dairesel, eliptik ve kaçış (hiperbolik) yörüngelerini oluştur; <b>Hohmann transferi</b> $\\Delta v$ bütçesini hesapla.', ORBIT_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-mode role="tablist" aria-label="Yörünge modları">
          <button type="button" data-m="orbit" class="on">İki Cisim (Vektör Sürükle)</button>
          <button type="button" data-m="hohmann">Hohmann Transferi</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-otype></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>Dünya Etrafında Yörünge (Hız Okunu Sürükle)</h4><span class="slm-hint mono" data-tnow></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv slm-cv-drag" data-cv aria-label="Yörünge mekaniği ve Hohmann transferi animasyonu"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\varepsilon = \\frac{v^2}{2} - \\frac{\\mu}{r} = -\\frac{\\mu}{2a}, \\qquad v_c = \\sqrt{\\frac{\\mu}{r}}, \\qquad v_{\\text{esc}} = \\sqrt{\\frac{2\\mu}{r}} = \\sqrt{2}\\,v_c',
        'T = 2\\pi\\sqrt{\\frac{a^3}{\\mu}}, \\qquad \\Delta v_1 = \\sqrt{\\frac{\\mu}{r_1}}\\left(\\sqrt{\\frac{2r_2}{r_1+r_2}} - 1\\right), \\quad \\Delta v_2 = \\sqrt{\\frac{\\mu}{r_2}}\\left(1 - \\sqrt{\\frac{2r_1}{r_1+r_2}}\\right)',
      ],
      paragraphs: [
        '**Kepler’in 2. Yasası** uyarınca açısal momentum $h = r v \\cos\\gamma$ sabittir; uydu enberide ($r_p$) hızlanır, enötede ($r_a$) yavaşlar ve eşit zaman aralıklarında eşit alan ($dA/dt = h/2$) tarar.',
        '**Hohmann transferi**, eş düzlemli iki dairesel yörünge arasındaki minimum enerjili iki-ateşlemeli eliptik geçiştir; toplam transfer süresi $t_{\\text{tr}} = \\pi\\sqrt{a_t^3/\\mu}$’dür.',
      ],
      tasks: [
        'Hız oranını $v/v_c = 1.00$’dan $\\sqrt{2} \\approx 1.414$’e çıkarıp yörüngenin daireselden eliptiğe ve ardından **kaçış (parabolik/hiperbolik)** yörüngesine geçişini izleyin.',
        'Hız vektörünü tuvalde sürükleyerek enberi yüksekliği $h_p < 0$ (atmosfere düşüş) oluşturun.',
        '**Hohmann Transferi**nde 400 km → 35786 km (GEO) ayarlayıp $\\Delta v_{\\text{top}} \\approx 3.9\\text{ km/s}$ ve $t_{\\text{tr}} \\approx 5.26\\text{ saat}$ değerlerini doğrulayın.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const otypeEl = host.querySelector('[data-otype]');
  const alertEl = host.querySelector('[data-alert]');
  const tnow = host.querySelector('[data-tnow]');
  const playBtn = host.querySelector('[data-play]');
  const cv = host.querySelector('[data-cv]');

  const sAlt = addSlider(ctrls, { label: 'Başlangıç İrtifası h₀', unit: 'km', min: 200, max: 12000, value: st.altKm, step: 100, onInput: v => { st.altKm = v; resetOrbit(); } });
  const sVR = addSlider(ctrls, { label: 'Hız Oranı v₀ / v_c', min: 0.65, max: 1.65, value: st.vRatio, step: 0.01, fmt: v => `${v.toFixed(2)}× v_c`, onInput: v => { st.vRatio = v; resetOrbit(); } });
  const sGam = addSlider(ctrls, { label: 'Uçuş Yolu Açısı γ₀', unit: '°', min: -35, max: 35, value: st.gammaDeg, step: 1, fmt: v => `${v}°`, onInput: v => { st.gammaDeg = v; resetOrbit(); } });
  const tKep = addToggle(ctrls, 'Kepler 2. Yasa Eşit Alan Dilimleri', st.showKepler, v => { st.showKepler = v; mainCv.render(); });

  const sH1 = addSlider(ctrls, { label: 'Başlangıç Yörüngesi h₁', unit: 'km', min: 200, max: 10000, value: st.h1Km, step: 100, onInput: v => { st.h1Km = v; updateHohmann(); } });
  const sH2 = addSlider(ctrls, { label: 'Hedef Yörünge h₂', unit: 'km', min: 1000, max: 36000, value: st.h2Km, step: 200, onInput: v => { st.h2Km = v; updateHohmann(); } });
  const sWarp = addSlider(ctrls, { label: 'Zaman Çarpanı', unit: '×', min: 50, max: 4000, value: st.warp, log: true, fmt: v => `${Math.round(v)}×`, onInput: v => { st.warp = Math.round(v); } });

  let elems = null, hoh = null;
  let oView = { cx: 200, cy: 180, sc: 1e-5, vSc: 0.008 };

  function resetOrbit() {
    const r0 = R_EARTH + st.altKm * 1000;
    const vc = Math.sqrt(MU_EARTH / r0);
    const v0 = st.vRatio * vc;
    const g = st.gammaDeg * RAD;
    st.sat = [r0, 0, v0 * Math.sin(g), v0 * Math.cos(g)];
    st.trail = [[r0, 0]];
    st.sweepWedges = [];
    st.sweepAcc = 0;
    st.simT = 0;
    elems = orbitalElements({ x: st.sat[0], y: st.sat[1], vx: st.sat[2], vy: st.sat[3] });
    updateOrbitKPIs();
    mainCv.render();
  }

  function updateOrbitKPIs() {
    if (!elems) return;
    otypeEl.textContent = elems.impact ? '⚠ Dünya ile Çarpışma!' : `${elems.orbitType} (e = ${fmtFix(elems.e, 3)})`;
    otypeEl.className = `slm-badge ${elems.impact ? 'slm-badge-bad' : elems.e >= 1 ? 'slm-badge-warn' : 'slm-badge-ok'}`;
    alertEl.innerHTML = elems.impact
      ? `<div class="slm-alert slm-alert-bad">Enberi yarıçapı r_p = ${fmtFix(elems.rp / 1000, 0)} km < R_Dünya (6371 km) — yörünge yüzeye çarpıyor!</div>`
      : '';
    renderKpis(kpis, [
      { lbl: 'Yarı Büyük Eksen a', val: Number.isFinite(elems.a) ? `${fmtFix(elems.a / 1000, 0)} km` : '∞', sub: `Eksantriklik e = ${fmtFix(elems.e, 3)}`, tone: 'acc' },
      { lbl: 'Enberi / Enöte İrtifa', val: `${fmtFix((elems.rp - R_EARTH) / 1000, 0)} km`, sub: Number.isFinite(elems.ra) ? `Enöte: ${fmtFix((elems.ra - R_EARTH) / 1000, 0)} km` : 'Açık (Kaçış)', tone: elems.impact ? 'bad' : 'ok' },
      { lbl: 'Yörünge Periyodu T', val: Number.isFinite(elems.period) ? `${fmtFix(elems.period / 60, 1)} dk` : '∞ (Açık)', sub: Number.isFinite(elems.period) ? `${fmtFix(elems.period / 3600, 2)} saat` : '' },
      { lbl: 'Anlık / Kaçış Hızı', val: `${fmtFix(Math.hypot(st.sat[2], st.sat[3]) / 1000, 2)} km/s`, sub: `v_esc = ${fmtFix(elems.vEsc / 1000, 2)} km/s` },
    ]);
  }

  function updateHohmann() {
    hoh = hohmannTransfer({ h1: st.h1Km * 1000, h2: st.h2Km * 1000 });
    st.hPhase = 0;
    otypeEl.textContent = `Hohmann Δv = ${fmtFix(hoh.dvTotal / 1000, 2)} km/s`;
    otypeEl.className = 'slm-badge slm-badge-ok';
    alertEl.innerHTML = '';
    renderKpis(kpis, [
      { lbl: '1. Ateşleme Δv₁', val: `${fmtFix(hoh.dv1, 0)} m/s`, sub: `v_c1=${fmtFix(hoh.vc1 / 1000, 2)} → ${fmtFix(hoh.vt1 / 1000, 2)} km/s`, tone: 'acc' },
      { lbl: '2. Ateşleme Δv₂', val: `${fmtFix(hoh.dv2, 0)} m/s`, sub: `v_t2=${fmtFix(hoh.vt2 / 1000, 2)} → ${fmtFix(hoh.vc2 / 1000, 2)} km/s`, tone: 'ok' },
      { lbl: 'Toplam Δv', val: `${fmtFix(hoh.dvTotal / 1000, 3)} km/s`, sub: `e_tr = ${fmtFix(hoh.eT, 3)}` },
      { lbl: 'Transfer Süresi', val: `${fmtFix(hoh.tTransfer / 3600, 2)} saat`, sub: `${fmtFix(hoh.tTransfer / 60, 0)} dk` },
    ]);
    mainCv.render();
  }

  const mainCv = setupCanvas(cv, w => Math.min(390, Math.max(270, w * 0.64)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const maxR = st.mode === 'orbit' && elems
      ? Math.min(R_EARTH * 7.5, Math.max(R_EARTH * 2.5, Number.isFinite(elems.ra) ? elems.ra * 1.15 : (R_EARTH + st.altKm * 1000) * 3.2))
      : hoh ? Math.max(hoh.r1, hoh.r2) * 1.18 : R_EARTH * 4;
    const sc = Math.min(W, H) * 0.45 / maxR;
    oView = { cx: W * 0.5, cy: H * 0.5, sc, vSc: 0.0065 };
    const toScr = (x, y) => ({ x: oView.cx + x * sc, y: oView.cy - y * sc });

    // Earth
    const rEpx = Math.max(10, R_EARTH * sc);
    const gE = c.createRadialGradient(oView.cx - rEpx * 0.3, oView.cy - rEpx * 0.3, rEpx * 0.1, oView.cx, oView.cy, rEpx);
    gE.addColorStop(0, '#60a5fa'); gE.addColorStop(0.65, '#1d4ed8'); gE.addColorStop(1, '#0c1e4a');
    c.fillStyle = gE; c.beginPath(); c.arc(oView.cx, oView.cy, rEpx, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(147,197,253,.55)'; c.lineWidth = 1.4; c.stroke();

    if (st.mode === 'orbit' && elems) {
      // Analytical conic preview r(nu) = p / (1 + e*cos(nu))
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.3;
      c.beginPath();
      let started = false;
      for (let i = 0; i <= 180; i++) {
        const nu = -Math.PI + (2 * Math.PI * i) / 180;
        const den = 1 + elems.e * Math.cos(nu);
        if (den <= 0.06) { started = false; continue; }
        const r = elems.p / den;
        if (r > maxR * 3) { started = false; continue; }
        const ang = nu + elems.omegaP;
        const p = toScr(r * Math.cos(ang), r * Math.sin(ang));
        if (!started) { c.moveTo(p.x, p.y); started = true; } else c.lineTo(p.x, p.y);
      }
      c.stroke(); c.restore();

      // Kepler 2nd Law equal-time swept wedges
      if (st.showKepler && st.sweepWedges.length) {
        st.sweepWedges.forEach((w, idx) => {
          c.fillStyle = idx % 2 === 0 ? 'rgba(91,228,155,.18)' : 'rgba(90,176,255,.18)';
          c.beginPath(); c.moveTo(oView.cx, oView.cy);
          w.forEach(pt => { const p = toScr(pt[0], pt[1]); c.lineTo(p.x, p.y); });
          c.closePath(); c.fill();
        });
      }

      // Integrated trail
      if (st.trail.length > 1) {
        c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
        st.trail.forEach((pt, i) => { const p = toScr(pt[0], pt[1]); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); });
        c.stroke();
      }

      // Satellite + draggable velocity vector at start/current
      const pSat = toScr(st.sat[0], st.sat[1]);
      const pStart = toScr(R_EARTH + st.altKm * 1000, 0);
      const vc = Math.sqrt(MU_EARTH / (R_EARTH + st.altKm * 1000));
      const v0 = st.vRatio * vc, g = st.gammaDeg * RAD;
      const vx0 = v0 * Math.sin(g), vy0 = v0 * Math.cos(g);
      drawArrow(c, pStart.x, pStart.y, pStart.x + vx0 * oView.vSc, pStart.y - vy0 * oView.vSc, COL_WARN, 2.2, 'v₀');
      drawPin(c, pStart.x + vx0 * oView.vSc, pStart.y - vy0 * oView.vSc, 5, COL_WARN, '#000');
      drawPin(c, pSat.x, pSat.y, 5.5, '#fff', acc);
      tnow.textContent = `t = ${fmtFix(st.simT / 60, 1)} dk`;
    } else if (hoh) {
      // Initial & target circular orbits
      c.strokeStyle = COL_BLUE; c.lineWidth = 1.6;
      c.beginPath(); c.arc(oView.cx, oView.cy, hoh.r1 * sc, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = COL_OK; c.lineWidth = 1.6;
      c.beginPath(); c.arc(oView.cx, oView.cy, hoh.r2 * sc, 0, Math.PI * 2); c.stroke();

      // Dashed Hohmann transfer ellipse (r1 at 0 deg -> r2 at 180 deg)
      const pT = hoh.aT * (1 - hoh.eT * hoh.eT);
      const sgn = hoh.r2 >= hoh.r1 ? 1 : -1;
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = acc; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i <= 90; i++) {
        const nu = (Math.PI * i) / 90;
        const r = pT / (1 + sgn * hoh.eT * Math.cos(nu));
        const p = toScr(r * Math.cos(nu), r * Math.sin(nu));
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.stroke(); c.restore();

      // Burn markers
      const b1 = toScr(hoh.r1, 0), b2 = toScr(-hoh.r2, 0);
      drawPin(c, b1.x, b1.y, 5, COL_WARN, '#000');
      drawPin(c, b2.x, b2.y, 5, COL_OK, '#000');
      c.fillStyle = COL_WARN; c.font = '600 10.5px "JetBrains Mono", monospace';
      c.fillText(`Δv₁`, b1.x + 8, b1.y + 4);
      c.fillStyle = COL_OK; c.fillText(`Δv₂`, b2.x - 28, b2.y + 4);

      // Animated spacecraft along transfer ellipse
      const nuNow = st.hPhase * Math.PI;
      const rNow = pT / (1 + sgn * hoh.eT * Math.cos(nuNow));
      const pCur = toScr(rNow * Math.cos(nuNow), rNow * Math.sin(nuNow));
      drawPin(c, pCur.x, pCur.y, 6, '#fff', acc);
      tnow.textContent = `Transfer: %${Math.round(st.hPhase * 100)} (${fmtFix(st.hPhase * hoh.tTransfer / 3600, 2)} sa)`;
    }
  }, clean);

  // Drag initial velocity vector tip on canvas!
  bindDragCanvas(cv, {
    onDown(p) {
      if (st.mode !== 'orbit') return false;
      const r0 = R_EARTH + st.altKm * 1000;
      const pStart = { x: oView.cx + r0 * oView.sc, y: oView.cy };
      const vc = Math.sqrt(MU_EARTH / r0), v0 = st.vRatio * vc, g = st.gammaDeg * RAD;
      const tipX = pStart.x + v0 * Math.sin(g) * oView.vSc;
      const tipY = pStart.y - v0 * Math.cos(g) * oView.vSc;
      return Math.hypot(p.x - tipX, p.y - tipY) < 36;
    },
    onMove(p, dragging) {
      if (!dragging || st.mode !== 'orbit') return;
      const r0 = R_EARTH + st.altKm * 1000;
      const vc = Math.sqrt(MU_EARTH / r0);
      const pStart = { x: oView.cx + r0 * oView.sc, y: oView.cy };
      const vx = (p.x - pStart.x) / oView.vSc;
      const vy = (pStart.y - p.y) / oView.vSc;
      const vMag = Math.hypot(vx, vy);
      st.vRatio = Math.max(0.65, Math.min(1.65, +(vMag / vc).toFixed(2)));
      st.gammaDeg = Math.max(-35, Math.min(35, Math.round(Math.atan2(vx, Math.max(100, vy)) * DEG)));
      sVR.set(st.vRatio); sGam.set(st.gammaDeg);
      resetOrbit();
    },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    if (st.mode === 'orbit') {
      const simDt = dt * st.warp;
      const sub = 8, h = simDt / sub;
      for (let i = 0; i < sub; i++) {
        st.sat = orbitStep(st.sat, h);
        st.simT += h;
        const rNow = Math.hypot(st.sat[0], st.sat[1]);
        if (rNow < R_EARTH * 0.99 || rNow > R_EARTH * 14) { resetOrbit(); return true; }
      }
      st.trail.push([st.sat[0], st.sat[1]]);
      if (st.trail.length > 360) st.trail.shift();

      // Equal-time Kepler wedges
      const wedgeDur = elems && Number.isFinite(elems.period) ? elems.period / 12 : 600;
      st.sweepAcc += simDt;
      if (!st.sweepWedges.length) st.sweepWedges.push([[st.sat[0], st.sat[1]]]);
      st.sweepWedges[st.sweepWedges.length - 1].push([st.sat[0], st.sat[1]]);
      if (st.sweepAcc >= wedgeDur) {
        st.sweepAcc = 0;
        st.sweepWedges.push([[st.sat[0], st.sat[1]]]);
        if (st.sweepWedges.length > 6) st.sweepWedges.shift();
      }
      updateOrbitKPIs();
    } else if (hoh) {
      st.hPhase = (st.hPhase + (dt * st.warp) / Math.max(1200, hoh.tTransfer)) % 1;
    }
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isO = st.mode === 'orbit';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    [sAlt, sVR, sGam, tKep].forEach(s => s.setVisible(isO));
    [sH1, sH2].forEach(s => s.setVisible(!isO));
    host.querySelector('[data-cvtitle]').textContent = isO ? 'İki Cisim Yörüngesi (Sarı Hız Okunu Sürükle)' : 'Hohmann Transfer Eliptik Geçişi';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => st.mode === 'orbit' ? resetOrbit() : updateHohmann());
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode();
    if (st.mode === 'orbit') resetOrbit(); else updateHohmann();
    syncSegments(host, false);
  });
  bindPresets(host, ORBIT_PRESETS, p => {
    Object.assign(st, p);
    sAlt.set(st.altKm); sVR.set(st.vRatio); sGam.set(st.gammaDeg); sH1.set(st.h1Km); sH2.set(st.h2Km); sWarp.set(st.warp);
    syncMode();
    if (st.mode === 'orbit') resetOrbit(); else updateHohmann();
  });

  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  resetOrbit();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 18. ROKET DENKLEMİ (Tsiolkovsky, Multistage, Vertical Launch & Max-Q)
// =====================================================================

const ROCKET_PRESETS = [
  { label: '2 Kademeli LEO Roketi', mode: 'multi', nStages: 2, mPay: 1200, mp1: 42000, eps1: 0.09, isp1: 295, mp2: 11000, eps2: 0.08, isp2: 348, mp3: 3000, eps3: 0.08, isp3: 360 },
  { label: '3 Kademeli Ay Görevi', mode: 'multi', nStages: 3, mPay: 1500, mp1: 80000, eps1: 0.08, isp1: 290, mp2: 24000, eps2: 0.08, isp2: 345, mp3: 7000, eps3: 0.08, isp3: 440 },
  { label: 'Dikey Fırlatma (TWR=1.7)', mode: 'launch', lm0: 50, lPropPct: 80, lIsp: 290, lTwr: 1.7, lCd: 0.35, lArea: 4.0 },
  { label: 'Yüksek İtki / Yüksek Max-Q', mode: 'launch', lm0: 50, lPropPct: 80, lIsp: 290, lTwr: 3.0, lCd: 0.40, lArea: 5.0 },
];

function mountRocketEquation(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'launch',
    nStages: 2, mPay: 1200,
    mp1: 42000, eps1: 0.09, isp1: 295,
    mp2: 11000, eps2: 0.08, isp2: 348,
    mp3: 3000, eps3: 0.08, isp3: 360,
    // Launch
    lm0: 50, lPropPct: 80, lIsp: 290, lTwr: 1.7, lCd: 0.35, lArea: 4.0,
    playing: autoPlayAllowed(), simIdx: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Tsiolkovsky roket denklemi</b> ile çok kademeli roketlerin $\\Delta v$ avantajını hesapla; ISA atmosferinde <b>yerçekimi kaybı, sürükleme kaybı ve Max-Q</b> ile dikey fırlatmayı simüle et.', ROCKET_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-mode role="tablist" aria-label="Roket modları">
          <button type="button" data-m="multi">Tsiolkovsky & Çok Kademeli</button>
          <button type="button" data-m="launch" class="on">Dikey Fırlatma & Max-Q</button>
        </div>
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Tekrar Fırlat</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-rbadge></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title" data-cvtitle>Dikey Fırlatma Animasyonu & Dinamik Basınç</h4><span class="slm-hint mono" data-linfo></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Roket kademe şeması ve dikey fırlatma animasyonu"></canvas></div>
        </div>
        <div class="slm-grid-2" data-lplots>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">İrtifa h(t) & Hız v(t)</h4></div>
            <div class="slm-cv-box" data-bhv><canvas class="slm-cv" data-chv aria-label="Roket irtifa ve hız grafiği"></canvas><div class="slm-readout" data-rhv></div></div>
            <div class="slm-axis-lbl">Zaman t (s)</div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Dinamik Basınç q(t) — Max-Q</h4></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cq aria-label="Dinamik basınç ve Max-Q grafiği"></canvas><div class="slm-readout" data-rq></div></div>
            <div class="slm-axis-lbl">Zaman t (s)</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\Delta v = \\sum_{i=1}^{N} I_{sp,i}\\, g_0 \\ln\\!\\left(\\frac{m_{0,i}}{m_{f,i}}\\right), \\qquad \\varepsilon_i = \\frac{m_{s,i}}{m_{s,i} + m_{p,i}}',
        '\\dot{v} = \\frac{F_T - \\tfrac{1}{2}\\rho(h) v|v| C_D A}{m(t)} - g(h), \\qquad q(t) = \\frac{1}{2}\\rho(h) v^2',
      ],
      paragraphs: [
        'Boş yakıt tanklarını yolda atmak (**kademelendirme**) ölü kütleyi azaltır; tek kademeyle (SSTO) 9.3 km/s LEO hedefine ulaşmak yapısal sınırlar nedeniyle çok zorken 2–3 kademeyle kolayca aşılır.',
        '**Max-Q** (maksimum dinamik basınç), hızın artmasıyla atmosfer yoğunluğunun $\\rho(h)$ hızla düşmesinin yarıştığı noktada ortaya çıkar ve roket gövdesindeki en yüksek aerodinamik yüktür.',
      ],
      tasks: [
        '**Çok Kademeli** modda kademe sayısını 1 → 2 → 3 yaparak aynı/benzer yapısal oranla toplam $\\Delta v$ artışını SSTO ile kıyaslayın.',
        '**Dikey Fırlatma**da başlangıç $TWR$ oranını 1.3’ten 3.0’a yükseltin: yerçekimi kaybının azaldığını ama **sürükleme kaybı ve Max-Q**’nun fırladığını gözlemleyin.',
        'Toplam ideal $\\Delta v$’nin $v_{\\text{yanma sonu}} + \\Delta v_{\\text{yerçekimi}} + \\Delta v_{\\text{sürükleme}}$ toplamına eşit olduğunu doğrulayın.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const rbadge = host.querySelector('[data-rbadge]');
  const linfo = host.querySelector('[data-linfo]');
  const lplots = host.querySelector('[data-lplots]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cv = host.querySelector('[data-cv]');
  const chv = host.querySelector('[data-chv]');
  const cq = host.querySelector('[data-cq]');

  // Multistage controls
  const selN = addSelect(ctrls, 'Kademe Sayısı', [['1', '1 Kademe (SSTO)'], ['2', '2 Kademe (LEO)'], ['3', '3 Kademe (Derin Uzay)']], String(st.nStages), v => { st.nStages = +v; syncMode(); update(); });
  const sPay = addSlider(ctrls, { label: 'Faydalı Yük (Payload)', unit: 'kg', min: 200, max: 6000, value: st.mPay, step: 100, onInput: v => { st.mPay = v; update(); } });
  const sMp1 = addSlider(ctrls, { label: '1. Kademe Yakıtı', unit: 'ton', min: 10, max: 120, value: st.mp1 / 1000, step: 2, onInput: v => { st.mp1 = v * 1000; update(); } });
  const sIsp1 = addSlider(ctrls, { label: '1. Kademe Isp', unit: 's', min: 220, max: 380, value: st.isp1, step: 5, onInput: v => { st.isp1 = v; update(); } });
  const sEps1 = addSlider(ctrls, { label: 'Yapısal Oran ε (tüm kad.)', min: 0.04, max: 0.2, value: st.eps1, step: 0.01, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.eps1 = st.eps2 = st.eps3 = v; update(); } });
  const sMp2 = addSlider(ctrls, { label: '2. Kademe Yakıtı', unit: 'ton', min: 3, max: 40, value: st.mp2 / 1000, step: 1, onInput: v => { st.mp2 = v * 1000; update(); } });
  const sIsp2 = addSlider(ctrls, { label: '2. Kademe Isp', unit: 's', min: 260, max: 450, value: st.isp2, step: 5, onInput: v => { st.isp2 = v; update(); } });
  const sMp3 = addSlider(ctrls, { label: '3. Kademe Yakıtı', unit: 'ton', min: 1, max: 15, value: st.mp3 / 1000, step: 0.5, onInput: v => { st.mp3 = v * 1000; update(); } });

  // Vertical launch controls
  const sLm0 = addSlider(ctrls, { label: 'Fırlatma Kütlesi m₀', unit: 'ton', min: 10, max: 200, value: st.lm0, step: 5, onInput: v => { st.lm0 = v; update(); } });
  const sLpp = addSlider(ctrls, { label: 'Yakıt Payı', unit: '%', min: 45, max: 88, value: st.lPropPct, step: 1, fmt: v => `%${v}`, onInput: v => { st.lPropPct = v; update(); } });
  const sLIsp = addSlider(ctrls, { label: 'Özgül İtki I_sp', unit: 's', min: 200, max: 440, value: st.lIsp, step: 5, onInput: v => { st.lIsp = v; update(); } });
  const sLTwr = addSlider(ctrls, { label: 'Başlangıç İtki/Ağırlık TWR', min: 1.15, max: 4.0, value: st.lTwr, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.lTwr = v; update(); } });
  const sLCd = addSlider(ctrls, { label: 'Sürükleme Katsayısı C_D', min: 0.0, max: 0.9, value: st.lCd, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.lCd = v; update(); } });

  let ms = null, launch = null;

  function drawLaunchPlots() {
    if (st.mode !== 'launch' || !launch) return;
    const tEnd = launch.ts[launch.ts.length - 1];
    safePlot(chv, [
      { name: 'h (km)', color: COL_BLUE, xs: launch.ts, ys: launch.hs.map(h => h / 1000) },
      { name: 'v/100 (m/s)', color: COL_OK, xs: launch.ts, ys: launch.vs.map(v => v / 100) },
    ], { x0: 0, x1: tEnd, ylabel: 'km · 100m/s', height: 175 });
    safePlot(cq, [
      { name: 'q (kPa)', color: COL_WARN, xs: launch.ts, ys: launch.qs.map(q => q / 1000) },
      { name: 'Max-Q', color: COL_BAD, xs: [launch.maxQTime, launch.maxQTime], ys: [0, (launch.maxQ / 1000) * 1.05] },
    ], { x0: 0, x1: tEnd, ylabel: 'kPa', height: 175 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(270, Math.max(200, w * 0.44)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'multi' && ms) {
      // Horizontal stacked rocket cutaway + Δv bar breakdown
      const yMid = H * 0.42;
      const xStart = 36, availW = W - 96;
      const cols = [COL_BLUE, COL_OK, COL_WARN];
      let x = xStart;
      ms.stages.forEach((sg, i) => {
        const w = Math.max(32, ((sg.mProp + sg.mStruct) / ms.mTotal) * availW);
        const h = 54 - i * 8;
        c.fillStyle = `${cols[i]}26`; c.strokeStyle = cols[i]; c.lineWidth = 2;
        c.fillRect(x, yMid - h / 2, w, h); c.strokeRect(x, yMid - h / 2, w, h);
        c.fillStyle = COL_FG; c.font = '600 10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`K${i + 1}`, x + w / 2, yMid - 2);
        c.fillStyle = cols[i]; c.fillText(`+${fmtFix(sg.dv / 1000, 2)}`, x + w / 2, yMid + 12);
        x += w + 4;
      });
      // Nosecone payload
      c.fillStyle = `${acc}30`; c.strokeStyle = acc; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, yMid - 14); c.lineTo(x + 36, yMid); c.lineTo(x, yMid + 14); c.closePath(); c.fill(); c.stroke();

      // Comparison bar: Multistage vs SSTO vs LEO (9.3 km/s)
      const barY = H - 56, barW = W - 72;
      const maxV = Math.max(12000, ms.totalDv * 1.15);
      const drawBar = (y, val, col, lbl) => {
        c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(36, y, barW, 14);
        c.fillStyle = col; c.fillRect(36, y, Math.min(barW, (val / maxV) * barW), 14);
        c.fillStyle = COL_FG; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'left';
        c.fillText(`${lbl}: ${fmtFix(val / 1000, 2)} km/s`, 40, y + 11);
      };
      drawBar(barY, ms.totalDv, COL_OK, 'Çok Kademeli Δv');
      drawBar(barY + 20, ms.sstoDv, COL_MUTE, 'Eşdeğer Tek Kademe (SSTO)');
      // LEO reference line 9.3 km/s
      const xLeo = 36 + (9300 / maxV) * barW;
      c.strokeStyle = COL_WARN; c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(xLeo, barY - 6); c.lineTo(xLeo, barY + 38); c.stroke(); c.setLineDash([]);
      c.fillStyle = COL_WARN; c.fillText('LEO ~9.3', xLeo - 20, barY - 9);
    } else if (launch) {
      // Animated vertical launch pad & ascent column
      const idx = Math.min(launch.ts.length - 1, Math.floor(st.simIdx));
      const hNow = launch.hs[idx], vNow = launch.vs[idx], qNow = launch.qs[idx], tNow = launch.ts[idx];
      const burning = tNow < launch.tBurn;
      const maxH = Math.max(10000, launch.maxAlt);

      // Sky gradient (blue atmosphere fading into space)
      const skyG = c.createLinearGradient(0, H, 0, 0);
      skyG.addColorStop(0, 'rgba(59,130,246,.22)'); skyG.addColorStop(0.55, 'rgba(30,58,138,.12)'); skyG.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = skyG; c.fillRect(0, 0, W, H);

      const padY = H - 24;
      const rY = padY - (hNow / maxH) * (H - 58);
      const rx = W * 0.36;
      drawGroundHatch(c, 16, padY, W - 16, padY, 1);

      // Altitude marks
      c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
      for (let k = 1; k <= 4; k++) {
        const y = padY - (k / 4) * (H - 58);
        c.strokeStyle = COL_GRID; c.beginPath(); c.moveTo(16, y); c.lineTo(W - 16, y); c.stroke();
        c.fillText(`${fmtFix((maxH * k) / 4000, 0)} km`, 20, y - 3);
      }

      // Max-Q altitude marker line
      const yMQ = padY - (launch.maxQAlt / maxH) * (H - 58);
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = COL_BAD;
      c.beginPath(); c.moveTo(16, yMQ); c.lineTo(W - 16, yMQ); c.stroke(); c.restore();
      c.fillStyle = COL_BAD; c.fillText(`Max-Q @ ${fmtFix(launch.maxQAlt / 1000, 1)} km`, W - 140, yMQ - 4);

      // Rocket body + flame
      if (burning) {
        c.fillStyle = COL_WARN;
        c.beginPath(); c.moveTo(rx - 5, rY + 2); c.lineTo(rx, rY + 22 + (idx % 3) * 4); c.lineTo(rx + 5, rY + 2); c.closePath(); c.fill();
      }
      c.fillStyle = COL_FG; c.strokeStyle = acc; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(rx, rY - 22); c.lineTo(rx + 6, rY - 10); c.lineTo(rx + 6, rY + 2); c.lineTo(rx - 6, rY + 2); c.lineTo(rx - 6, rY - 10); c.closePath(); c.fill(); c.stroke();

      // Telemetry box right side
      c.fillStyle = COL_FG; c.font = '11px "JetBrains Mono", monospace';
      const tx = W * 0.56;
      c.fillText(`t = ${tNow.toFixed(1)} s ${burning ? '(YANMA)' : '(SERBEST)'}`, tx, 26);
      c.fillText(`h = ${fmtFix(hNow / 1000, 2)} km`, tx, 44);
      c.fillText(`v = ${fmtFix(vNow, 0)} m/s`, tx, 62);
      c.fillStyle = COL_WARN;
      c.fillText(`q = ${fmtFix(qNow / 1000, 1)} kPa`, tx, 80);
      linfo.textContent = `Max-Q = ${fmtFix(launch.maxQ / 1000, 1)} kPa @ t=${fmtFix(launch.maxQTime, 1)}s`;
    }
  }, clean);

  function update() {
    if (st.mode === 'multi') {
      const stages = [{ mProp: st.mp1, mStruct: (st.mp1 * st.eps1) / (1 - st.eps1), Isp: st.isp1 }];
      if (st.nStages >= 2) stages.push({ mProp: st.mp2, mStruct: (st.mp2 * st.eps2) / (1 - st.eps2), Isp: st.isp2 });
      if (st.nStages >= 3) stages.push({ mProp: st.mp3, mStruct: (st.mp3 * st.eps3) / (1 - st.eps3), Isp: st.isp3 });
      ms = solveMultistageRocket({ stages, mPayload: st.mPay });
      const leoOk = ms.totalDv >= 9300;
      rbadge.textContent = leoOk ? '✓ LEO Yörünge Kapasitesi (≥ 9.3 km/s)' : 'Yörünge Altı (< 9.3 km/s)';
      rbadge.className = `slm-badge ${leoOk ? 'slm-badge-ok' : 'slm-badge-warn'}`;
      linfo.textContent = `Toplam kütle: ${fmtFix(ms.mTotal / 1000, 1)} ton`;
      renderKpis(kpis, [
        { lbl: 'Toplam Δv', val: `${fmtFix(ms.totalDv / 1000, 2)} km/s`, sub: `SSTO: ${fmtFix(ms.sstoDv / 1000, 2)} km/s`, tone: leoOk ? 'ok' : 'acc' },
        { lbl: 'Kademeleme Kazancı', val: `+${fmtFix((ms.totalDv - ms.sstoDv) / 1000, 2)} km/s`, sub: `${st.nStages} kademe` },
        { lbl: 'Fırlatma Kütlesi m₀', val: `${fmtFix(ms.mTotal / 1000, 1)} ton`, sub: `Yük oranı: %${fmtFix(ms.payloadFrac * 100, 2)}` },
        { lbl: '1. Kademe Δv₁', val: `${fmtFix(ms.stages[0].dv / 1000, 2)} km/s`, sub: `MR₁ = ${fmtFix(ms.stages[0].MR, 2)}` },
      ]);
    } else {
      const m0 = st.lm0 * 1000;
      const mProp = m0 * (st.lPropPct / 100);
      const thrust = st.lTwr * m0 * G0;
      launch = simulateVerticalLaunch({ m0, mProp, Isp: st.lIsp, thrust, Cd: st.lCd, area: st.lArea, dt: 0.25, maxTime: 240 });
      st.simIdx = isMotionOff() ? Math.min(launch.ts.length - 1, Math.round(launch.tBurn / 0.25)) : 0;
      rbadge.textContent = `Max-Q = ${fmtFix(launch.maxQ / 1000, 1)} kPa`;
      rbadge.className = `slm-badge ${launch.maxQ > 55000 ? 'slm-badge-bad' : 'slm-badge-acc'}`;
      renderKpis(kpis, [
        { lbl: 'İdeal Δv (Tsiolkovsky)', val: `${fmtFix(launch.dvIdeal, 0)} m/s`, sub: `Yanma süresi: ${fmtFix(launch.tBurn, 1)} s`, tone: 'acc' },
        { lbl: 'Yanma Sonu Hızı', val: `${fmtFix(launch.vBurnout, 0)} m/s`, sub: `Tepe irtifa: ${fmtFix(launch.maxAlt / 1000, 1)} km`, tone: 'ok' },
        { lbl: 'Yerçekimi / Sürükleme Kaybı', val: `${fmtFix(launch.gravLoss, 0)} / ${fmtFix(launch.dragLoss, 0)} m/s`, sub: `Toplam kayıp: ${fmtFix(launch.gravLoss + launch.dragLoss, 0)} m/s`, tone: 'warn' },
        { lbl: 'Max-Q (Dinamik Basınç)', val: `${fmtFix(launch.maxQ / 1000, 1)} kPa`, sub: `t=${fmtFix(launch.maxQTime, 1)}s @ ${fmtFix(launch.maxQAlt / 1000, 1)} km` },
      ]);
      drawLaunchPlots();
    }
    mainCv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.mode !== 'launch' || !launch) return false;
    st.simIdx += dt * 18;
    if (st.simIdx >= launch.ts.length - 1) st.simIdx = 0;
    mainCv.render();
    return true;
  }, clean);

  function syncMode() {
    const isM = st.mode === 'multi';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    playBtn.hidden = isM; resetBtn.hidden = isM; lplots.hidden = isM;
    [selN, sPay, sMp1, sIsp1, sEps1].forEach(s => s.setVisible(isM));
    sMp2.setVisible(isM && st.nStages >= 2); sIsp2.setVisible(isM && st.nStages >= 2);
    sMp3.setVisible(isM && st.nStages >= 3);
    [sLm0, sLpp, sLIsp, sLTwr, sLCd].forEach(s => s.setVisible(!isM));
    host.querySelector('[data-cvtitle]').textContent = isM ? 'Kademeli Roket Kesiti & SSTO Karşılaştırması' : 'Dikey Fırlatma Animasyonu & Max-Q';
  }

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing && st.mode === 'launch') loop.start(); else loop.stop();
  });
  resetBtn.addEventListener('click', () => { st.simIdx = 0; mainCv.render(); });
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
    if (st.mode === 'launch' && st.playing) loop.start(); else loop.stop();
    syncSegments(host, false);
  });
  bindPresets(host, ROCKET_PRESETS, p => {
    Object.assign(st, p);
    selN.set(String(st.nStages)); sPay.set(st.mPay); sMp1.set(st.mp1 / 1000); sIsp1.set(st.isp1); sEps1.set(st.eps1);
    sMp2.set(st.mp2 / 1000); sIsp2.set(st.isp2); sMp3.set(st.mp3 / 1000);
    sLm0.set(st.lm0); sLpp.set(st.lPropPct); sLIsp.set(st.lIsp); sLTwr.set(st.lTwr); sLCd.set(st.lCd);
    syncMode(); update();
  });

  attachReadout(chv, host.querySelector('[data-rhv]'), (x, ser, i) => `t=${fmtFix(x, 1)}s · h=${fmtFix(ser[0].ys[i], 1)}km · v=${fmtFix(ser[1].ys[i] * 100, 0)}m/s`, clean);
  attachReadout(cq, host.querySelector('[data-rq]'), (x, ser, i) => `t=${fmtFix(x, 1)}s · q=${fmtFix(ser[0].ys[i], 1)}kPa`, clean);
  observeResize(host.querySelector('[data-bhv]'), drawLaunchPlots, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  syncMode();
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 19. KANAT PROFİLİ (NACA 4-Digit, Thin Airfoil, Stall, Drag Polar, ISA)
// =====================================================================

const AIRFOIL_PRESETS = [
  { label: 'NACA 0012 (Simetrik)', M: 0, P: 0, XX: 12, alphaDeg: 5, V: 65, altKm: 1.0, S: 16, AR: 8 },
  { label: 'NACA 2412 (Cessna)', M: 2, P: 4, XX: 12, alphaDeg: 4, V: 65, altKm: 2.0, S: 16, AR: 7.5 },
  { label: 'NACA 4415 (Yüksek Kambur)', M: 4, P: 4, XX: 15, alphaDeg: 6, V: 55, altKm: 1.5, S: 18, AR: 9 },
  { label: 'Stol Durumu (α = 18°)', M: 2, P: 4, XX: 12, alphaDeg: 18, V: 45, altKm: 1.0, S: 16, AR: 7.5 },
];

function mountAirfoilNaca(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    M: 2, P: 4, XX: 12, alphaDeg: 4, V: 65, altKm: 2.0, S: 16, AR: 7.5,
    finiteWing: true, playing: autoPlayAllowed(), animT: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>NACA 4 haneli kanat profili</b> üret; <b>ince kanat teorisi</b>, <b>stol (tutunma kaybı)</b>, <b>sürükleme poları</b>, $L/D$ oranı ve <b>Uluslararası Standart Atmosfer (ISA)</b> altında gerçek kaldırma/sürükleme kuvvetlerini hesapla.', AIRFOIL_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <span class="slm-badge slm-badge-acc mono" data-naca>NACA 2412</span>
        <button type="button" class="btn small primary" data-play></button>
      </div>
      <span class="slm-badge" data-stall></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Rüzgar Tüneli — Profil, Akım Çizgileri & Kuvvetler</h4><span class="slm-hint mono" data-isa></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="NACA 4 haneli kanat profili rüzgar tüneli"></canvas></div>
        </div>
        <div class="slm-grid-2">
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Kaldırma Eğrisi C_L(α)</h4></div>
            <div class="slm-cv-box" data-bcl><canvas class="slm-cv" data-ccl aria-label="CL vs hücum açısı grafiği"></canvas><div class="slm-readout" data-rcl></div></div>
            <div class="slm-axis-lbl">Hücum açısı α (°)</div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Sürükleme Poları (C_L vs C_D)</h4></div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cpd aria-label="Sürükleme poları grafiği"></canvas><div class="slm-readout" data-rpd></div></div>
            <div class="slm-axis-lbl">Sürükleme katsayısı C_D</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'C_{L,\\text{2D}} = 2\\pi(\\alpha - \\alpha_{L=0}), \\qquad a_{\\text{3D}} = \\frac{2\\pi}{1 + \\frac{2}{e\\cdot AR}}, \\qquad C_D = C_{D0} + \\frac{C_L^2}{\\pi e\\, AR}',
        'L = \\tfrac{1}{2}\\rho(h) V^2 S\\, C_L, \\qquad D = \\tfrac{1}{2}\\rho(h) V^2 S\\, C_D',
      ],
      paragraphs: [
        '**NACA MPXX** kodunda $M$ maksimum kamburluğu ($\\%$), $P$ kamburluk konumunu (onda), $XX$ maksimum kalınlığı ($\\%$) verir. Kambur profillerde $\\alpha = 0^\\circ$ iken bile pozitif kaldırma vardır ($\\alpha_{L=0} < 0$).',
        'Hücum açısı $\\alpha_{\\text{stol}}$ değerini aştığında üst yüzeydeki sınır tabaka ayrılır: $C_L$ hızla düşer, $C_D$ sıçrar ve rüzgar tünelinde kanat arkasında ayrılma girdapları oluşur.',
      ],
      tasks: [
        '**NACA 0012** (simetrik) ile **NACA 2412**’yi kıyaslayıp kambur profilin sıfır kaldırma açısının $\\alpha_{L=0} \\approx -2.1^\\circ$ olduğunu doğrulayın.',
        'Hücum açısını $\\alpha$ artırarak $(L/D)_{\\max}$ noktasını ve ardından **stol açısını** bulun.',
        'İrtifayı $0\\text{ km} \\to 10\\text{ km}$’ye çıkarıp ISA hava yoğunluğu $\\rho(h)$ düştükçe aynı hızda kaldırma kuvvetinin nasıl azaldığını gözlemleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const nacaBadge = host.querySelector('[data-naca]');
  const stallBadge = host.querySelector('[data-stall]');
  const isaEl = host.querySelector('[data-isa]');
  const playBtn = host.querySelector('[data-play]');
  const cv = host.querySelector('[data-cv]');
  const ccl = host.querySelector('[data-ccl]');
  const cpd = host.querySelector('[data-cpd]');

  const sM = addSlider(ctrls, { label: 'Kamburluk M (%)', min: 0, max: 8, value: st.M, step: 1, fmt: v => `%${v}`, onInput: v => { st.M = v; if (v > 0 && st.P === 0) { st.P = 4; sP.set(4); } update(); } });
  const sP = addSlider(ctrls, { label: 'Kambur Konumu P', min: 0, max: 7, value: st.P, step: 1, fmt: v => `${v * 10}%`, onInput: v => { st.P = v; update(); } });
  const sXX = addSlider(ctrls, { label: 'Kalınlık XX (%)', min: 6, max: 24, value: st.XX, step: 1, fmt: v => `%${v}`, onInput: v => { st.XX = v; update(); } });
  const sAlp = addSlider(ctrls, { label: 'Hücum Açısı α', unit: '°', min: -8, max: 24, value: st.alphaDeg, step: 0.5, fmt: v => `${v.toFixed(1)}°`, onInput: v => { st.alphaDeg = v; update(); } });
  const sV = addSlider(ctrls, { label: 'Hava Hızı V', unit: 'm/s', min: 20, max: 240, value: st.V, step: 2, onInput: v => { st.V = v; update(); } });
  const sAlt = addSlider(ctrls, { label: 'ISA İrtifa h', unit: 'km', min: 0, max: 18, value: st.altKm, step: 0.5, onInput: v => { st.altKm = v; update(); } });
  const sS = addSlider(ctrls, { label: 'Kanat Alanı S', unit: 'm²', min: 6, max: 60, value: st.S, step: 1, onInput: v => { st.S = v; update(); } });
  const sAR = addSlider(ctrls, { label: 'Açıklık Oranı AR', min: 4, max: 18, value: st.AR, step: 0.5, onInput: v => { st.AR = v; update(); } });
  const t3D = addToggle(ctrls, 'Sonlu Kanat (3D İndüklenmiş Sürükleme)', st.finiteWing, v => { st.finiteWing = v; update(); });

  let geom = null, ev = null, polar = null;

  function drawPlots() {
    if (!polar || !ev) return;
    safePlot(ccl, [
      { name: 'C_L (Stollu)', color: COL_OK, xs: polar.alphas, ys: polar.cls },
      { name: 'İnce Kanat (Doğrusal)', color: 'rgba(255,255,255,.28)', xs: polar.alphas, ys: polar.clLin.map(v => Math.max(-1, Math.min(2.2, v))) },
      { name: 'α', color: accentColor(), xs: [st.alphaDeg, st.alphaDeg], ys: [-0.8, Math.max(1.8, polar.clMax + 0.1)] },
    ], { x0: -8, x1: 24, ylabel: 'C_L', height: 175 });

    const cdMax = Math.max(0.2, ...polar.cds.filter(v => v < 0.8));
    safePlot(cpd, [
      { name: 'Polar', color: COL_BLUE, xs: polar.cds, ys: polar.cls },
      { name: 'Nokta', color: accentColor(), xs: [ev.CD, ev.CD + 0.001], ys: [ev.CL - 0.04, ev.CL + 0.04] },
    ], { x0: 0, x1: Math.min(0.65, cdMax * 1.05), ylabel: 'C_L', height: 175 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(275, Math.max(205, w * 0.45)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!geom || !ev) return;
    const acc = accentColor();
    const cx = W * 0.48, cy = H * 0.52;
    const chord = Math.min(W * 0.48, 230);
    const al = st.alphaDeg * RAD;

    // Flowing wind-tunnel streamlines deflected by circulation
    const circ = ev.CL * 18;
    for (let k = -4; k <= 4; k++) {
      const y0 = cy + k * (H * 0.095);
      c.strokeStyle = 'rgba(90,176,255,.32)'; c.lineWidth = 1.2;
      c.beginPath();
      for (let i = 0; i <= 48; i++) {
        const x = (W * i) / 48;
        const dx = (x - cx) / chord;
        const dy = (y0 - cy) / chord;
        const r2 = dx * dx + dy * dy + 0.18;
        const upwash = -circ * Math.exp(-r2 * 1.6) * (dx < 0 ? 0.55 : 0.95);
        const stallWave = ev.stalled && dx > 0 && Math.abs(dy) < 0.4 ? Math.sin(x * 0.08 - st.animT * 9 + k) * 9 * Math.min(1, dx) : 0;
        const py = y0 + upwash + stallWave;
        if (i === 0) c.moveTo(x, py); else c.lineTo(x, py);
      }
      c.stroke();

      // Animated smoke tracer dot
      const xDot = (((k * 73 + st.animT * Math.min(220, st.V * 2.2)) % W) + W) % W;
      const dx = (xDot - cx) / chord, dy = (y0 - cy) / chord;
      const upw = -circ * Math.exp(-(dx * dx + dy * dy + 0.18) * 1.6) * (dx < 0 ? 0.55 : 0.95);
      c.fillStyle = ev.stalled && dx > 0 && Math.abs(dy) < 0.35 ? COL_BAD : 'rgba(255,255,255,.65)';
      c.beginPath(); c.arc(xDot, y0 + upw, 2.2, 0, Math.PI * 2); c.fill();
    }

    // Airfoil rotated about quarter-chord (0.25 c)
    c.save();
    c.translate(cx, cy);
    c.rotate(al); // positive alpha pitches nose UP on screen (nose at -0.25c -> rotate clockwise = +al raises left nose? Wait: x=-0.25 -> y' = x*sin(a): for a>0, y'<0 which is UP on canvas! Exact!)

    // Filled airfoil section
    c.beginPath();
    geom.upper.forEach((pt, i) => {
      const px = (pt.x - 0.25) * chord, py = -pt.y * chord;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    });
    for (let i = geom.lower.length - 1; i >= 0; i--) {
      const pt = geom.lower[i];
      c.lineTo((pt.x - 0.25) * chord, -pt.y * chord);
    }
    c.closePath();
    c.fillStyle = ev.stalled ? 'rgba(255,107,107,.24)' : 'rgba(255,255,255,.14)';
    c.fill();
    c.strokeStyle = ev.stalled ? COL_BAD : COL_FG; c.lineWidth = 2.2; c.stroke();

    // Camber line dashed
    c.setLineDash([4, 3]); c.strokeStyle = acc; c.lineWidth = 1.2;
    c.beginPath();
    geom.camber.forEach((pt, i) => {
      const px = (pt.x - 0.25) * chord, py = -pt.y * chord;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    });
    c.stroke(); c.setLineDash([]);
    c.restore();

    // Aerodynamic Lift (up) & Drag (right) vectors at quarter chord
    const lPx = Math.max(-75, Math.min(82, ev.CL * 48));
    const dPx = Math.min(70, Math.max(8, ev.CD * 190));
    drawArrow(c, cx, cy, cx, cy - lPx, COL_OK, 2.6, 'L');
    drawArrow(c, cx, cy, cx + dPx, cy, COL_BAD, 2.2, 'D');
  }, clean);

  function update() {
    const code = `${st.M}${st.M === 0 ? 0 : st.P}${String(st.XX).padStart(2, '0')}`;
    const naca = parseNaca4(code);
    nacaBadge.textContent = `NACA ${naca.code}`;
    geom = generateNaca4(naca, 72);
    const p = { ...naca, alphaDeg: st.alphaDeg, V: st.V, altM: st.altKm * 1000, S: st.S, AR: st.AR, finiteWing: st.finiteWing };
    ev = evaluateAirfoil(p);
    polar = airfoilPolarSweep(p);

    stallBadge.textContent = ev.stalled ? `⚠ STOL! (α > ${fmtFix(ev.alphaStallDeg, 1)}°)` : `Tutunmuş Akış (α_stol ≈ ${fmtFix(ev.alphaStallDeg, 1)}°)`;
    stallBadge.className = `slm-badge ${ev.stalled ? 'slm-badge-bad' : 'slm-badge-ok'}`;
    isaEl.textContent = `ISA ${st.altKm}km: ρ=${fmtFix(ev.atm.rho, 3)} kg/m³ · M=${fmtFix(ev.mach, 2)}`;

    renderKpis(kpis, [
      { lbl: 'Kaldırma C_L', val: fmtFix(ev.CL, 3), sub: `α_{L=0} = ${fmtFix(ev.alphaL0Deg, 2)}° · maks ${fmtFix(polar.clMax, 2)}`, tone: ev.stalled ? 'bad' : 'acc' },
      { lbl: 'Sürükleme C_D', val: fmtFix(ev.CD, 4), sub: `C_{D0} = ${fmtFix(ev.Cd0, 4)}` },
      { lbl: 'Aerodinamik Oran L/D', val: fmtFix(ev.LD, 1), sub: `Maks (L/D) = ${fmtFix(polar.ldMax, 1)} @ ${fmtFix(polar.alphaLdMax, 1)}°`, tone: 'ok' },
      { lbl: 'Kaldırma / Sürükleme', val: `${fmtFix(ev.liftN / 1000, 2)} kN`, sub: `D = ${fmtFix(ev.dragN / 1000, 2)} kN · q = ${fmtFix(ev.q / 1000, 2)} kPa` },
    ]);
    mainCv.render();
    drawPlots();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.animT += dt;
    mainCv.render();
    return true;
  }, clean);

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, AIRFOIL_PRESETS, p => {
    Object.assign(st, p);
    sM.set(st.M); sP.set(st.P); sXX.set(st.XX); sAlp.set(st.alphaDeg); sV.set(st.V); sAlt.set(st.altKm); sS.set(st.S); sAR.set(st.AR);
    update();
  });

  attachReadout(ccl, host.querySelector('[data-rcl]'), (x, ser, i) => `α=${fmtFix(x, 1)}° · C_L=${fmtFix(ser[0].ys[i], 3)}`, clean);
  attachReadout(cpd, host.querySelector('[data-rpd]'), (x, ser, i) => `C_D=${fmtFix(x, 4)} · C_L=${fmtFix(ser[0].ys[i], 3)}`, clean);
  observeResize(host.querySelector('[data-bcl]'), drawPlots, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 20. ATIŞ HAREKETİ & SÜRÜKLEME (Projectile with Quadratic Drag & Wind)
// =====================================================================

const PROJ_PRESETS = [
  { label: 'Vakum İdeal (45°)', v0: 50, angleDeg: 45, h0: 0, m: 1.0, Cd: 0, diamCm: 10, vWind: 0 },
  { label: 'Futbol Topu (Sürükleme)', v0: 35, angleDeg: 38, h0: 0, m: 0.43, Cd: 0.47, diamCm: 22, vWind: 0 },
  { label: 'Sert Karşı Rüzgar (−18 m/s)', v0: 45, angleDeg: 32, h0: 0, m: 0.3, Cd: 0.47, diamCm: 14, vWind: -18 },
  { label: 'Uçurumdan Atış (h₀=40 m)', v0: 40, angleDeg: 30, h0: 40, m: 0.5, Cd: 0.47, diamCm: 12, vWind: 8 },
];

function mountProjectileDrag(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    v0: 45, angleDeg: 38, h0: 0, m: 0.35, Cd: 0.47, diamCm: 14, vWind: -8,
    playing: autoPlayAllowed(), simT: 0,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('<b>Karesel hava direnci ($F_d \\propto v^2$)</b> ve <b>yatay rüzgar</b> altında eğik atış yörüngesini vakum parabolüyle kıyasla; maksimum menzili veren <b>optimum atış açısını ($\\theta_{\\text{opt}}$)</b> canlı bul.', PROJ_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <button type="button" class="btn small primary" data-play></button>
        <button type="button" class="btn small" data-reset>${icon('rotate')} Tekrar At</button>
        <button type="button" class="btn small" data-opt>Optimum Açıya Ayarla</button>
      </div>
      <span class="slm-badge slm-badge-acc" data-optb></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Yörünge — Sürükleme + Rüzgar (Dolu) vs Vakum (Kesikli)</h4><span class="slm-hint mono" data-wlbl></span></div>
          <div class="slm-cv-box"><canvas class="slm-cv" data-cv aria-label="Eğik atış yörünge animasyonu"></canvas></div>
        </div>
        <div class="slm-plot-card">
          <div class="slm-head"><h4 class="slm-title">Menzil – Fırlatma Açısı Eğrisi R(θ)</h4>
            <div class="slm-legend">
              <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>Hava dirençli + Rüzgar</span>
              <span class="slm-legend-item"><i class="slm-legend-swatch slm-legend-dash" style="border-color:${COL_MUTE}"></i>Vakum</span>
            </div>
          </div>
          <div class="slm-cv-box" data-br><canvas class="slm-cv" data-cr aria-label="Menzil vs fırlatma açısı grafiği"></canvas><div class="slm-readout" data-rr></div></div>
          <div class="slm-axis-lbl">Fırlatma açısı θ (°)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'm\\ddot{\\vec{r}} = m\\vec{g} - \\tfrac{1}{2}\\rho C_D A\\,|\\vec{v} - \\vec{v}_w|(\\vec{v} - \\vec{v}_w)',
        'R_{\\text{vakum}} = \\frac{v_0\\cos\\theta}{g}\\left(v_0\\sin\\theta + \\sqrt{v_0^2\\sin^2\\theta + 2gh_0}\\right)',
      ],
      paragraphs: [
        'Vakumda ($C_D = 0, h_0 = 0$) maksimum menzil tam $\\theta_{\\text{opt}} = 45^\\circ$’de elde edilir ve yörünge simetrik bir paraboldür.',
        '**Karesel hava direnci** yatay hızı sürekli törpülediğinden yörünge iniş kolunda dikleşir ve $\\theta_{\\text{opt}}$ daima **$45^\\circ$’nin altına** iner; karşı rüzgar optimum açıyı daha da düşürür.',
      ],
      tasks: [
        'Sürükleme katsayısını $C_D = 0$ yapıp $\\theta_{\\text{opt}} = 45.0^\\circ$ olduğunu ve iki eğrinin üst üste bindiğini doğrulayın.',
        '**Futbol Topu** senaryosunda **Optimum Açıya Ayarla** düğmesine basıp hava direnci nedeniyle $\\theta_{\\text{opt}} < 45^\\circ$ olduğunu gözlemleyin.',
        'Rüzgarı $-20\\text{ m/s}$’den $+20\\text{ m/s}$’ye sürükleyerek optimum açının nasıl yer değiştirdiğini $R(\\theta)$ grafiğinde inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const optB = host.querySelector('[data-optb]');
  const wlbl = host.querySelector('[data-wlbl]');
  const playBtn = host.querySelector('[data-play]');
  const cv = host.querySelector('[data-cv]');
  const cr = host.querySelector('[data-cr]');

  const sV0 = addSlider(ctrls, { label: 'İlk Hız v₀', unit: 'm/s', min: 10, max: 100, value: st.v0, step: 1, onInput: v => { st.v0 = v; update(); } });
  const sAng = addSlider(ctrls, { label: 'Fırlatma Açısı θ', unit: '°', min: 5, max: 85, value: st.angleDeg, step: 0.5, fmt: v => `${v.toFixed(1)}°`, onInput: v => { st.angleDeg = v; update(false); } });
  const sH0 = addSlider(ctrls, { label: 'Başlangıç Yüksekliği h₀', unit: 'm', min: 0, max: 80, value: st.h0, step: 2, onInput: v => { st.h0 = v; update(); } });
  const sM = addSlider(ctrls, { label: 'Kütle m', unit: 'kg', min: 0.05, max: 5.0, value: st.m, step: 0.05, onInput: v => { st.m = v; update(); } });
  const sCd = addSlider(ctrls, { label: 'Sürükleme Katsayısı C_D', min: 0, max: 1.2, value: st.Cd, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.Cd = v; update(); } });
  const sDia = addSlider(ctrls, { label: 'Cisim Çapı D', unit: 'cm', min: 3, max: 35, value: st.diamCm, step: 1, onInput: v => { st.diamCm = v; update(); } });
  const sWind = addSlider(ctrls, { label: 'Yatay Rüzgar v_w', unit: 'm/s', min: -25, max: 25, value: st.vWind, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v} m/s`, onInput: v => { st.vWind = v; update(); } });

  let vac = null, sim = null, opt = null, sweep = null;

  function areaM2() { const r = (st.diamCm / 100) * 0.5; return Math.PI * r * r; }

  function computeSweep() {
    const p = { v0: st.v0, h0: st.h0, m: st.m, Cd: st.Cd, area: areaM2(), vWind: st.vWind };
    opt = findOptimalProjectileAngle(p);
    const angs = [], rD = [], rV = [];
    for (let a = 5; a <= 85; a += 2) {
      angs.push(a);
      rD.push(simulateProjectile({ ...p, angleDeg: a, dt: 0.03 }).range);
      rV.push(projectileVacuum({ v0: st.v0, angleDeg: a, h0: st.h0, n: 4 }).range);
    }
    sweep = { angs, rD, rV };
  }

  function drawRangePlot() {
    if (!sweep || !opt) return;
    safePlot(cr, [
      { name: 'Dirençli R(θ)', color: COL_OK, xs: sweep.angs, ys: sweep.rD },
      { name: 'Vakum R(θ)', color: 'rgba(255,255,255,.32)', xs: sweep.angs, ys: sweep.rV },
      { name: 'θ', color: accentColor(), xs: [st.angleDeg, st.angleDeg], ys: [0, Math.max(...sweep.rV) * 0.95] },
    ], { x0: 5, x1: 85, ylabel: 'Menzil (m)', height: 170 });
  }

  const mainCv = setupCanvas(cv, w => Math.min(280, Math.max(210, w * 0.46)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!vac || !sim) return;
    const acc = accentColor();
    const L = 42, R = 18, T = 18, B = 28, pw = W - L - R, ph = H - T - B;
    const maxX = Math.max(10, vac.range, sim.range) * 1.08;
    const maxY = Math.max(5, vac.maxHeight, sim.maxHeight, st.h0) * 1.15;
    const fx = x => L + (x / maxX) * pw;
    const fy = y => T + (1 - y / maxY) * ph;

    // Ground & grid
    drawGroundHatch(c, L, T + ph, L + pw, T + ph, 1);
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const gx = L + (pw * i) / 4, gy = T + (ph * i) / 4;
      c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
    }

    // Wind arrow indicator at top right
    if (Math.abs(st.vWind) >= 1) {
      const wx = W - 64;
      drawArrow(c, wx - Math.sign(st.vWind) * 18, 26, wx + Math.sign(st.vWind) * 18, 26, COL_BLUE, 2);
      c.fillStyle = COL_BLUE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`Rüzgar ${st.vWind > 0 ? '+' : ''}${st.vWind} m/s`, wx, 42);
      c.textAlign = 'left';
    }

    // Vacuum dashed parabola
    c.save(); c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.6;
    c.beginPath();
    vac.xs.forEach((x, i) => { const px = fx(x), py = fy(vac.ys[i]); if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); });
    c.stroke(); c.restore();

    // Drag + wind solid curve
    c.strokeStyle = acc; c.lineWidth = 2.4;
    c.beginPath();
    sim.xs.forEach((x, i) => { const px = fx(x), py = fy(sim.ys[i]); if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); });
    c.stroke();

    // Animated flying ball along both paths
    const tCur = st.simT;
    const findAt = (tr, t) => {
      let idx = 0;
      while (idx < tr.ts.length - 1 && tr.ts[idx + 1] < t) idx++;
      return { x: tr.xs[idx], y: tr.ys[idx] };
    };
    const pD = findAt(sim, Math.min(tCur, sim.tFlight));
    const pV = findAt(vac, Math.min(tCur, vac.tFlight));
    drawPin(c, fx(pV.x), fy(pV.y), 4.5, 'rgba(255,255,255,.3)', COL_FG);
    drawPin(c, fx(pD.x), fy(pD.y), 6, acc, '#fff');

    // Axis ticks
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
    c.textAlign = 'right'; c.fillText(`${fmtFix(maxY, 0)}m`, L - 4, T + 10); c.fillText('0', L - 4, T + ph);
    c.textAlign = 'center'; c.fillText(`${fmtFix(maxX, 0)} m`, L + pw - 16, H - 8);
    c.textAlign = 'left';
  }, clean);

  function update(reSweep = true) {
    const p = { v0: st.v0, angleDeg: st.angleDeg, h0: st.h0, m: st.m, Cd: st.Cd, area: areaM2(), vWind: st.vWind };
    vac = projectileVacuum({ v0: st.v0, angleDeg: st.angleDeg, h0: st.h0 });
    sim = simulateProjectile(p);
    if (reSweep) computeSweep();
    st.simT = isMotionOff() ? sim.tFlight : 0;

    optB.textContent = `θ_opt = ${fmtFix(opt.optAngle, 1)}° (R_max = ${fmtFix(opt.maxRange, 1)} m)`;
    wlbl.textContent = st.vWind === 0 ? 'Rüzgarsız' : st.vWind > 0 ? `Arka rüzgar +${st.vWind} m/s` : `Karşı rüzgar ${st.vWind} m/s`;
    const lossPct = vac.range > 1e-6 ? ((sim.range - vac.range) / vac.range) * 100 : 0;

    renderKpis(kpis, [
      { lbl: 'Menzil R (Dirençli)', val: `${fmtFix(sim.range, 1)} m`, sub: `Vakum: ${fmtFix(vac.range, 1)} m (${fmtFix(lossPct, 1)}%)`, tone: 'acc' },
      { lbl: 'Optimum Açı θ_opt', val: `${fmtFix(opt.optAngle, 1)}°`, sub: `Maks menzil: ${fmtFix(opt.maxRange, 1)} m`, tone: 'ok' },
      { lbl: 'Maks. Yükseklik H', val: `${fmtFix(sim.maxHeight, 1)} m`, sub: `Vakum H: ${fmtFix(vac.maxHeight, 1)} m` },
      { lbl: 'Uçuş Süresi & Çarpma', val: `${fmtFix(sim.tFlight, 2)} s`, sub: `v_son = ${fmtFix(sim.vImpact, 1)} m/s` },
    ]);
    mainCv.render();
    drawRangePlot();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || !sim || !vac) return false;
    st.simT += dt;
    if (st.simT > Math.max(sim.tFlight, vac.tFlight) + 0.8) st.simT = 0;
    mainCv.render();
    return true;
  }, clean);

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.simT = 0; mainCv.render(); });
  host.querySelector('[data-opt]').addEventListener('click', () => {
    if (!opt) return;
    st.angleDeg = +opt.optAngle.toFixed(1); sAng.set(st.angleDeg); update(false);
  });
  bindPresets(host, PROJ_PRESETS, p => {
    Object.assign(st, p);
    sV0.set(st.v0); sAng.set(st.angleDeg); sH0.set(st.h0); sM.set(st.m); sCd.set(st.Cd); sDia.set(st.diamCm); sWind.set(st.vWind);
    update(true);
  });

  attachReadout(cr, host.querySelector('[data-rr]'), (x, ser, i) => `θ=${fmtFix(x, 0)}° · Direnç=${fmtFix(ser[0].ys[i], 1)}m · Vakum=${fmtFix(ser[1].ys[i], 1)}m`, clean);
  observeResize(host.querySelector('[data-br]'), drawRangePlot, clean);
  bindTasks(host);
  syncPlayBtn(playBtn, st.playing);
  update(true);
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 21. UÇUŞ PERFORMANSI (Power Required, Min Drag, Breguet Range & Endurance)
// =====================================================================

const FLIGHT_PRESETS = [
  { label: 'Eğitim Uçağı (Cessna 172)', aircraft: 'prop', mass: 1110, S: 16.2, AR: 7.4, Cd0: 0.031, altKm: 2.0, Vcruise: 56, fuelFrac: 0.16, pKw: 134, thrustKn: 45, cpGkwH: 260, tsfc: 0.065 },
  { label: 'Yüksek Verimli Tur Uçağı', aircraft: 'prop', mass: 1450, S: 15.0, AR: 10.5, Cd0: 0.021, altKm: 3.5, Vcruise: 78, fuelFrac: 0.24, pKw: 210, thrustKn: 45, cpGkwH: 235, tsfc: 0.065 },
  { label: 'Yolcu Jeti (10 km Seyir)', aircraft: 'jet', mass: 68000, S: 125, AR: 9.4, Cd0: 0.019, altKm: 10.5, Vcruise: 235, fuelFrac: 0.28, pKw: 134, thrustKn: 220, cpGkwH: 260, tsfc: 0.058 },
  { label: 'İş Jeti (Yüksek İrtifa)', aircraft: 'jet', mass: 16000, S: 42, AR: 8.8, Cd0: 0.020, altKm: 12.0, Vcruise: 225, fuelFrac: 0.34, pKw: 134, thrustKn: 62, cpGkwH: 260, tsfc: 0.062 },
];

function mountFlightPerformance(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    aircraft: 'prop', mass: 1110, S: 16.2, AR: 7.4, eOswald: 0.8,
    Cd0: 0.031, ClMax: 1.5, altKm: 2.0, Vcruise: 56, fuelFrac: 0.16,
    pKw: 134, etaProp: 0.82, cpGkwH: 260,
    thrustKn: 220, tsfc: 0.058,
  };

  host.innerHTML = `<div class="slm-wrap">
    ${introHtml('Kararlı düz uçuşta <b>gerekli güç ($P_R$)</b>, <b>mevcut güç ($P_A$)</b>, <b>minimum sürükleme hızı ($V_{md}$)</b> ve <b>Breguet menzil / havada kalış süresi</b> performansını ISA atmosferiyle analiz et.', FLIGHT_PRESETS)}
    <div class="slm-toolbar">
      <div class="slm-toolbar-g">
        <div class="seg" data-ac role="tablist" aria-label="Hava aracı tipi">
          <button type="button" data-a="prop" class="on">Pervaneli (Prop)</button>
          <button type="button" data-a="jet">Jet (Turbofan)</button>
        </div>
        <button type="button" class="btn small" data-set-vmd>V_md Hızına Ayarla</button>
        <button type="button" class="btn small" data-set-vmp>V_mp Hızına Ayarla</button>
      </div>
      <span class="slm-badge slm-badge-ok" data-fstat></span>
    </div>
    <div class="slm-grid">
      <div class="slm-panel" data-ctrls></div>
      <div class="slm-col">
        <div class="slm-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="slm-grid-2">
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Gerekli Güç P_R(V) vs Mevcut Güç P_A(V)</h4>
              <div class="slm-legend">
                <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_WARN}"></i>P_R</span>
                <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_OK}"></i>P_A</span>
              </div>
            </div>
            <div class="slm-cv-box" data-bp><canvas class="slm-cv" data-cp aria-label="Gerekli güç ve mevcut güç eğrisi"></canvas><div class="slm-readout" data-rp></div></div>
            <div class="slm-axis-lbl">Uçuş hızı V (m/s)</div>
          </div>
          <div class="slm-plot-card">
            <div class="slm-head"><h4 class="slm-title">Sürükleme Ayrışımı: D_p + D_i = D</h4>
              <div class="slm-legend">
                <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_FG}"></i>Toplam D</span>
                <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BAD}"></i>Parazit</span>
                <span class="slm-legend-item"><i class="slm-legend-swatch" style="background:${COL_BLUE}"></i>İndüklenmiş</span>
              </div>
            </div>
            <div class="slm-cv-box"><canvas class="slm-cv" data-cd aria-label="Parazit ve indüklenmiş sürükleme ayrışımı"></canvas><div class="slm-readout" data-rd></div></div>
            <div class="slm-axis-lbl">Uçuş hızı V (m/s) — Kesişim noktası = V_md</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'D(V) = \\underbrace{\\tfrac{1}{2}\\rho V^2 S C_{D0}}_{D_p} + \\underbrace{\\frac{2 K W^2}{\\rho V^2 S}}_{D_i}, \\quad V_{md} = \\sqrt{\\frac{2W}{\\rho S}\\sqrt{\\frac{K}{C_{D0}}}}, \\quad V_{mp} = 3^{-1/4} V_{md}',
        '\\text{Pervaneli Breguet: } R = \\frac{\\eta_p}{g c_p}\\frac{C_L}{C_D}\\ln\\frac{W_i}{W_f}, \\qquad \\text{Jet Havada Kalış: } E = \\frac{1}{g c_t}\\frac{C_L}{C_D}\\ln\\frac{W_i}{W_f}',
      ],
      paragraphs: [
        '**Minimum sürükleme hızında ($V_{md}$)** parazit sürükleme ile indüklenmiş sürükleme birbirine tam eşittir ($D_p = D_i$) ve $(L/D)_{\\max}$ elde edilir. Bu hız pervanelide maksimum menzili, jette ise maksimum havada kalış süresini verir.',
        '**Minimum güç hızı ($V_{mp} \\approx 0.76\\,V_{md}$)** pervanelide maksimum tırmanma oranını ($RC = (P_A - P_R)/W$) ve maksimum havada kalış süresini verir.',
      ],
      tasks: [
        '**V_md Hızına Ayarla** düğmesine basıp sürükleme grafiğinde parazit ($D_p$) ve indüklenmiş ($D_i$) eğrilerinin tam kesiştiğini doğrulayın.',
        'Pervaneli uçakta seyir hızını $V_{mp}$’ye getirerek havada kalış süresinin maksimuma çıktığını, $V_{md}$’de ise menzilin maksimuma çıktığını karşılaştırın.',
        '**Yolcu Jeti** senaryosunda irtifayı $0\\text{ km} \\to 10.5\\text{ km}$’ye yükselterek ince havada gerçek hava hızının ve jet menzilinin nasıl arttığını inceleyin.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const fstat = host.querySelector('[data-fstat]');
  const alertEl = host.querySelector('[data-alert]');
  const cp = host.querySelector('[data-cp]');
  const cd = host.querySelector('[data-cd]');

  const sMass = addSlider(ctrls, { label: 'Uçak Kütlesi m', unit: 'kg', min: 500, max: 120000, value: st.mass, log: true, fmt: v => `${Math.round(v)} kg`, onInput: v => { st.mass = v; update(); } });
  const sS = addSlider(ctrls, { label: 'Kanat Alanı S', unit: 'm²', min: 8, max: 200, value: st.S, log: true, fmt: v => `${fmtFix(v, 1)} m²`, onInput: v => { st.S = v; update(); } });
  const sAR = addSlider(ctrls, { label: 'Açıklık Oranı AR', min: 5, max: 16, value: st.AR, step: 0.2, onInput: v => { st.AR = v; update(); } });
  const sCd0 = addSlider(ctrls, { label: 'Parazit Sürükleme C_{D0}', min: 0.014, max: 0.05, value: st.Cd0, step: 0.001, fmt: v => v.toFixed(3), onInput: v => { st.Cd0 = v; update(); } });
  const sAlt = addSlider(ctrls, { label: 'Uçuş İrtifası h (ISA)', unit: 'km', min: 0, max: 14, value: st.altKm, step: 0.5, onInput: v => { st.altKm = v; update(); } });
  const sVc = addSlider(ctrls, { label: 'Seyir Hızı V', unit: 'm/s', min: 25, max: 300, value: st.Vcruise, step: 1, onInput: v => { st.Vcruise = v; update(); } });
  const sFuel = addSlider(ctrls, { label: 'Yakıt Payı W_f / W_i', min: 0.05, max: 0.45, value: st.fuelFrac, step: 0.01, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.fuelFrac = v; update(); } });
  const sPkw = addSlider(ctrls, { label: 'Motor Mil Gücü (SL)', unit: 'kW', min: 50, max: 1500, value: st.pKw, step: 10, onInput: v => { st.pKw = v; update(); } });
  const sThr = addSlider(ctrls, { label: 'Toplam Jet İtkisi (SL)', unit: 'kN', min: 15, max: 450, value: st.thrustKn, step: 5, onInput: v => { st.thrustKn = v; update(); } });

  let fp = null;

  function drawPlots() {
    if (!fp) return;
    const x0 = fp.vs[0], x1 = fp.vs[fp.vs.length - 1];
    const pDiv = st.aircraft === 'jet' ? 1e6 : 1e3;
    const pUnit = st.aircraft === 'jet' ? 'MW' : 'kW';
    const dDiv = st.aircraft === 'jet' ? 1e3 : 1;
    const dUnit = st.aircraft === 'jet' ? 'kN' : 'N';

    const pCap = Math.max(fp.pa[fp.pa.length - 1], fp.minPower * 3.5) / pDiv;
    safePlot(cp, [
      { name: `P_R (${pUnit})`, color: COL_WARN, xs: fp.vs, ys: fp.pr.map(v => Math.min(v / pDiv, pCap * 1.4)) },
      { name: `P_A (${pUnit})`, color: COL_OK, xs: fp.vs, ys: fp.pa.map(v => v / pDiv) },
      { name: 'V', color: accentColor(), xs: [st.Vcruise, st.Vcruise], ys: [0, pCap] },
    ], { x0, x1, ylabel: pUnit, height: 185 });

    const dCap = (fp.minDrag * 3.2) / dDiv;
    safePlot(cd, [
      { name: `Toplam (${dUnit})`, color: COL_FG, xs: fp.vs, ys: fp.dtot.map(v => Math.min(v / dDiv, dCap)) },
      { name: 'Parazit', color: COL_BAD, xs: fp.vs, ys: fp.dp.map(v => Math.min(v / dDiv, dCap)) },
      { name: 'İndüklenmiş', color: COL_BLUE, xs: fp.vs, ys: fp.di.map(v => Math.min(v / dDiv, dCap)) },
      { name: 'V_md', color: COL_OK, xs: [fp.vMinDrag, fp.vMinDrag], ys: [0, dCap * 0.7] },
    ], { x0, x1, ylabel: dUnit, height: 185 });
  }

  function update() {
    fp = solveFlightPerformance({
      aircraft: st.aircraft, mass: st.mass, S: st.S, AR: st.AR, eOswald: st.eOswald,
      Cd0: st.Cd0, ClMax: st.ClMax, altM: st.altKm * 1000, Vcruise: st.Vcruise, fuelFrac: st.fuelFrac,
      pShaftSL: st.pKw * 1000, etaProp: st.etaProp, cpGkwH: st.cpGkwH,
      thrustSL: st.thrustKn * 1000, tsfc: st.tsfc,
    });
    const stalled = st.Vcruise < fp.vStall;
    const underPow = fp.paCruise < fp.atCruise.PR;
    fstat.textContent = stalled ? '⚠ Stol Hızının Altında!' : underPow ? 'Güç Yetersiz (P_A < P_R)' : `M = ${fmtFix(st.Vcruise / fp.atm.a, 2)} · L/D = ${fmtFix(fp.atCruise.LD, 1)}`;
    fstat.className = `slm-badge ${stalled || underPow ? 'slm-badge-bad' : 'slm-badge-ok'}`;
    alertEl.innerHTML = stalled
      ? `<div class="slm-alert slm-alert-bad">Seyir hızı V = ${st.Vcruise} m/s < Stol hızı V_stol = ${fmtFix(fp.vStall, 1)} m/s!</div>`
      : underPow
        ? `<div class="slm-alert slm-alert-warn">Bu hızda gerekli güç P_R, mevcut güç P_A’dan yüksek — düz uçuş sürdürülemez (V_max = ${fmtFix(fp.vMax, 1)} m/s).</div>`
        : '';

    renderKpis(kpis, [
      { lbl: 'V_md (Min. Sürükleme)', val: `${fmtFix(fp.vMinDrag, 1)} m/s`, sub: `(L/D)_max = ${fmtFix(fp.ldMax, 1)} · V_mp = ${fmtFix(fp.vMinPower, 1)}`, tone: 'acc' },
      { lbl: 'V_stol / V_max', val: `${fmtFix(fp.vStall, 1)} / ${fmtFix(fp.vMax, 1)} m/s`, sub: `Maks tırmanma: ${fmtFix(fp.maxRC, 1)} m/s` },
      { lbl: 'Breguet Menzil (Seyir)', val: `${fmtFix(fp.rangeCruiseKm, 0)} km`, sub: `Maksimum: ${fmtFix(fp.rangeMaxKm, 0)} km`, tone: 'ok' },
      { lbl: 'Havada Kalış (Breguet)', val: `${fmtFix(fp.enduranceCruiseHr, 2)} saat`, sub: `Maksimum: ${fmtFix(fp.enduranceMaxHr, 2)} saat` },
    ]);
    drawPlots();
  }

  function syncMode() {
    const isP = st.aircraft === 'prop';
    host.querySelectorAll('[data-ac] button').forEach(b => b.classList.toggle('on', b.dataset.a === st.aircraft));
    sPkw.setVisible(isP); sThr.setVisible(!isP);
  }

  host.querySelector('[data-ac]').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.dataset.a === st.aircraft) return;
    st.aircraft = b.dataset.a;
    // Apply sensible defaults when manually flipping aircraft type
    const def = st.aircraft === 'prop' ? FLIGHT_PRESETS[0] : FLIGHT_PRESETS[2];
    Object.assign(st, def);
    sMass.set(st.mass); sS.set(st.S); sAR.set(st.AR); sCd0.set(st.Cd0); sAlt.set(st.altKm);
    sVc.set(st.Vcruise); sFuel.set(st.fuelFrac); sPkw.set(st.pKw); sThr.set(st.thrustKn);
    syncMode(); update(); syncSegments(host, false);
  });
  host.querySelector('[data-set-vmd]').addEventListener('click', () => {
    if (!fp) return;
    st.Vcruise = Math.min(300, Math.max(25, +fp.vMinDrag.toFixed(1))); sVc.set(st.Vcruise); update();
  });
  host.querySelector('[data-set-vmp]').addEventListener('click', () => {
    if (!fp) return;
    st.Vcruise = Math.min(300, Math.max(25, +fp.vMinPower.toFixed(1))); sVc.set(st.Vcruise); update();
  });
  bindPresets(host, FLIGHT_PRESETS, p => {
    Object.assign(st, p);
    sMass.set(st.mass); sS.set(st.S); sAR.set(st.AR); sCd0.set(st.Cd0); sAlt.set(st.altKm);
    sVc.set(st.Vcruise); sFuel.set(st.fuelFrac); sPkw.set(st.pKw); sThr.set(st.thrustKn);
    syncMode(); update();
  });

  attachReadout(cp, host.querySelector('[data-rp]'), (x, ser, i) => `V=${fmtFix(x, 1)} m/s · P_R=${fmtFix(ser[0].ys[i], 1)} · P_A=${fmtFix(ser[1].ys[i], 1)}`, clean);
  attachReadout(cd, host.querySelector('[data-rd]'), (x, ser, i) => `V=${fmtFix(x, 1)} m/s · D=${fmtFix(ser[0].ys[i], 1)} (Dp=${fmtFix(ser[1].ys[i], 1)}, Di=${fmtFix(ser[2].ys[i], 1)})`, clean);
  observeResize(host.querySelector('[data-bp]'), drawPlots, clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// MODULE EXPORT CONTRACT (consumed by js/simcenter.js)
// =====================================================================

export const SIMS = [
  // Field: makine (8 simulations)
  { id: 'four-bar-linkage',     field: 'makine',    title: 'Dört Çubuk Mekanizma',   icon: 'rotate',  mount: mountFourBar },
  { id: 'vibration-sdof',       field: 'makine',    title: 'Titreşim (1-DOF)',       icon: 'wave',    mount: mountVibrationSDOF },
  { id: 'two-dof-modal',        field: 'makine',    title: 'İki Serbestlik Derece',  icon: 'wave',    mount: mountTwoDof },
  { id: 'rigid-collision',      field: 'makine',    title: 'Rijit Cisim & Çarpışma', icon: 'atom',    mount: mountRigidCollision },
  { id: 'gear-cam',             field: 'makine',    title: 'Dişli & Kam Tasarımı',   icon: 'rotate',  mount: mountGearCam },
  { id: 'shaft-spring',         field: 'makine',    title: 'Mil Burulma & Yay',      icon: 'tool',    mount: mountShaftSpring },
  { id: 'robot-arm',            field: 'makine',    title: 'Robot Kol (2-DOF)',      icon: 'phasor',  mount: mountRobotArm },
  { id: 'pendulum-gyro',        field: 'makine',    title: 'Sarkaç & Jiroskop',      icon: 'rotate',  mount: mountPendulumGyro },

  // Field: termo (8 simulations)
  { id: 'thermo-cycles',        field: 'termo',     title: 'Termodinamik Çevrimler', icon: 'flame',   mount: mountThermoCycles },
  { id: 'ideal-gas-kinetic',    field: 'termo',     title: 'İdeal Gaz & Kinetik',    icon: 'atom',    mount: mountIdealGas },
  { id: 'heat-conduction',      field: 'termo',     title: 'Isı İletimi (1D/2D)',    icon: 'flame',   mount: mountHeatConduction },
  { id: 'fin-heat-exchanger',   field: 'termo',     title: 'Kanatçık & Eşanjör',     icon: 'flame',   mount: mountFinHeatExchanger },
  { id: 'pipe-flow',            field: 'termo',     title: 'Boru Akışı & Moody',     icon: 'wave',    mount: mountPipeFlow },
  { id: 'potential-flow',       field: 'termo',     title: 'Potansiyel Akış',        icon: 'wave',    mount: mountPotentialFlow },
  { id: 'hydrostatics-buoyancy', field: 'termo',    title: 'Akışkan Statiği',        icon: 'grid',    mount: mountHydrostatics },
  { id: 'thermal-radiation',    field: 'termo',     title: 'Isı Işınımı & Planck',   icon: 'sparkle', mount: mountThermalRadiation },

  // Field: havacilik (5 simulations)
  { id: 'orbital-mechanics',    field: 'havacilik', title: 'Yörünge Mekaniği',       icon: 'atom',    mount: mountOrbitalMechanics },
  { id: 'rocket-equation',      field: 'havacilik', title: 'Roket Denklemi',         icon: 'flame',   mount: mountRocketEquation },
  { id: 'airfoil-naca',         field: 'havacilik', title: 'Kanat Profili (NACA)',   icon: 'phasor',  mount: mountAirfoilNaca },
  { id: 'projectile-drag',      field: 'havacilik', title: 'Atış Hareketi',          icon: 'arrow',   mount: mountProjectileDrag },
  { id: 'flight-performance',   field: 'havacilik', title: 'Uçuş Performansı',       icon: 'chart',   mount: mountFlightPerformance },
];
