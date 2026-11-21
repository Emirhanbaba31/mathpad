// MathPad Engineering Simulation Center — Part 3 UI Module
// Fields: 'insaat' (9), 'malzeme' (8), 'kimya' (8) = 25 interactive simulations.
// Contract: export const SIMS = [{ id, field, title, icon, mount(host, ctx) -> cleanupFn }];

import { esc, icon } from './ui.js';
import { motion, syncSegments } from './fx.js';
import { tex, richTex, accentColor, createClean, setupCanvas, createAnimLoop } from './phys-ui.js';
import { plot, PLOT_COLORS } from './tools.js';
import {
  G0, R_GAS,
  beamSectionProperties, solveBeam,
  solveTruss2D,
  solveFrame2D,
  solveMohrStress, solveStrainRosette,
  BUCKLING_BCS, solveColumnBuckling, sampleBucklingMode,
  syntheticGroundMotion, newmarkSDOF, computeResponseSpectrum, solveShearBuildingModes,
  terzaghiConsolidation, mohrCoulombSoil, terzaghiBearingCapacity, rankineEarthPressure,
  solveOpenChannel, solveRationalAndUH,
  solveHorizontalCurve, solveTrafficGreenshields,
  TENSILE_MATERIALS, evaluateTensileCurve,
  CRYSTAL_PRESETS, analyzeCrystal, millerSpacing, millerPlanePolygon, computeXRD,
  evalIsomorphous, evalEutecticPbSn, evalFeFe3C,
  DIFFUSION_PRESETS, arrheniusD, fickErfcProfile, fickCaseDepth, createRandomWalkState, stepRandomWalk,
  solveSNBasquin, solveMeanStressCriteria, solveParisCrackGrowth,
  TTT_A1, TTT_MS, TTT_MF, tttCurves, simulateCoolingPath,
  COMPOSITE_PRESETS, solveComposite,
  SEMICONDUCTORS, solveSemiconductor,
  solveIsothermalReactors, solveNonIsothermalCSTR,
  solveSeriesParallelKinetics, solveArrhenius, solveMichaelisMenten,
  EQ_REACTIONS, solveChemicalEquilibrium, solveTitrationCurve,
  solveMcCabeThiele, ANTOINE_MIXTURES, solveRaoultDiagrams,
  solveFilmDiffusion, solveGasAbsorption, solveLLETernary,
  solveProcessFlowsheet,
  dragCoeffSphere, solveSettlingVelocity, solveErgunAndFluidization,
  EOS_GASES, solveEOS, eosIsotherm,
} from './simlab-civil-core.js';

// =====================================================================
// SHARED UI, FORMATTING & CANVAS HELPERS
// =====================================================================

const COL_FG = '#f4f4f5';
const COL_MUTE = '#8b8b94';
const COL_DIM = '#55555d';
const COL_GRID = 'rgba(255,255,255,.08)';
const COL_AXIS = 'rgba(255,255,255,.28)';
const COL_OK = '#5be49b';
const COL_WARN = '#ffd166';
const COL_BAD = '#ff6b6b';
const COL_BLUE = '#5ab0ff';
const COL_PURP = '#c084fc';
const RAD = Math.PI / 180;

const autoPlayAllowed = () => motion() === 'full';
const isReduced = () => motion() === 'reduced';
const isMotionOff = () => motion() === 'off';

function fmtNum(x, digits = 3) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  if (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3) return x.toExponential(Math.max(1, digits - 1));
  return String(+x.toPrecision(digits));
}

function fmtFix(x, d = 2) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-12) return '0';
  return Number(x.toFixed(d)).toString();
}

function fmtSci(x, d = 2) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-30) return '0';
  if (Math.abs(x) >= 1e-2 && Math.abs(x) < 1e4) return fmtNum(x, d + 1);
  return x.toExponential(d);
}

function introHtml(text, presets = []) {
  return `<div class="slc-intro">
    <p>${text}</p>
    ${presets.length ? `<div class="slc-presets" role="group" aria-label="Hazır senaryolar">
      <span class="slc-preset-lbl">Senaryo:</span>
      ${presets.map((p, i) => `<button type="button" class="slc-chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function bindPresets(host, presets, apply) {
  host.querySelector('.slc-presets')?.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    host.querySelectorAll('.slc-presets [data-preset]').forEach(x => x.classList.toggle('slc-on', x === b));
    apply(presets[+b.dataset.preset]);
    syncSegments(host, false);
  });
}

let slcUid = 0;
function addSlider(parent, { label, unit = '', min, max, value, step, log = false, fmt, onInput }) {
  const uid = `slc-s-${++slcUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'slc-ctrl';
  wrap.innerHTML = `<div class="slc-ctrl-top">
      <label class="slc-ctrl-lbl" for="${uid}">${esc(label)}</label>
      <span class="slc-ctrl-val mono" data-v></span>
    </div>
    <input id="${uid}" type="range" class="slc-range" aria-label="${esc(label)}">`;
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
  lbl.className = 'slc-check-row';
  lbl.innerHTML = `<span>${esc(label)}</span><input type="checkbox" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;
  parent.append(lbl);
  const inp = lbl.querySelector('input');
  inp.addEventListener('change', () => onChange(inp.checked));
  return { el: lbl, set: v => { inp.checked = !!v; }, get: () => inp.checked, setVisible: s => { lbl.hidden = !s; } };
}

function addSelect(parent, label, options, value, onChange) {
  const uid = `slc-sel-${++slcUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'slc-ctrl';
  wrap.innerHTML = `<label class="slc-ctrl-lbl" for="${uid}">${esc(label)}</label>
    <select id="${uid}" class="inp slc-sel" aria-label="${esc(label)}">
      ${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>`;
  parent.append(wrap);
  const sel = wrap.querySelector('select');
  sel.addEventListener('change', () => onChange(sel.value));
  return { el: wrap, set: v => { sel.value = v; }, get: () => sel.value, setVisible: s => { wrap.hidden = !s; } };
}

function renderKpis(el, items) {
  el.innerHTML = items.map(it => {
    const toneCls = it.tone ? `slc-kpi-${it.tone}` : '';
    return `<div class="slc-kpi ${toneCls}">
      <span class="slc-kpi-lbl">${esc(it.lbl)}</span>
      <b class="slc-kpi-val mono">${esc(it.val)}</b>
      ${it.sub ? `<span class="slc-kpi-sub mono">${esc(it.sub)}</span>` : ''}
    </div>`;
  }).join('');
}

function theoryAndTasksHtml({ equations = [], paragraphs = [], tasks = [] }) {
  const tasksHtml = tasks.length ? `<div class="slc-tasks" role="region" aria-label="Deney görevleri">
    <div class="slc-tasks-head"><h4 class="slc-title">Deney Görevleri</h4><span class="slc-hint" data-task-prog>0 / ${tasks.length}</span></div>
    ${tasks.map((t, i) => `<label class="slc-task"><input type="checkbox" data-task="${i}"><span>${richTex(t)}</span></label>`).join('')}
  </div>` : '';

  const theoryHtml = `<details class="slc-theory">
    <summary><span>Nasıl çalışır? — Kuram ve Denklemler</span><span class="slc-theory-tag">Kuram</span></summary>
    <div class="slc-theory-body">
      ${equations.length ? `<div class="slc-eq-box">${equations.map(eq => `<div>${tex(eq, true)}</div>`).join('')}</div>` : ''}
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
      b.closest('.slc-task')?.classList.toggle('slc-done', ok);
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
    onMove?.(pt(e), activeId === e.pointerId, e);
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
  const head = Math.min(9, len * 0.38);
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45);
  c.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45);
  c.closePath(); c.fill();
  if (label && len > 10) {
    c.font = '600 10.5px "JetBrains Mono", monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, x1 + ux * -10, y1 + uy * -10);
  }
  c.restore();
}

function drawSupport(c, x, y, kind, size = 13) {
  c.save();
  c.strokeStyle = COL_FG; c.fillStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.6;
  if (kind === 'fixed' || kind === 'fixed-left' || kind === 'fixed-right') {
    const dir = kind === 'fixed-right' ? 1 : -1;
    c.beginPath(); c.moveTo(x, y - size * 1.4); c.lineTo(x, y + size * 1.4); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.1;
    for (let dy = -size * 1.2; dy <= size * 1.2; dy += 6) {
      c.beginPath(); c.moveTo(x, y + dy); c.lineTo(x + dir * 8, y + dy + 5); c.stroke();
    }
  } else if (kind === 'fixed-bottom') {
    c.beginPath(); c.moveTo(x - size * 1.2, y); c.lineTo(x + size * 1.2, y); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.1;
    for (let dx = -size; dx <= size; dx += 6) {
      c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx - 5, y + 8); c.stroke();
    }
  } else if (kind === 'pin') {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - size * 0.85, y + size); c.lineTo(x + size * 0.85, y + size); c.closePath();
    c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - size, y + size); c.lineTo(x + size, y + size); c.stroke();
  } else if (kind === 'roller' || kind === 'roller-x') {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - size * 0.75, y + size * 0.85); c.lineTo(x + size * 0.75, y + size * 0.85); c.closePath();
    c.fill(); c.stroke();
    for (const ox of [-size * 0.42, size * 0.42]) {
      c.beginPath(); c.arc(x + ox, y + size * 1.1, 2.7, 0, Math.PI * 2); c.stroke();
    }
    c.beginPath(); c.moveTo(x - size, y + size * 1.35); c.lineTo(x + size, y + size * 1.35); c.stroke();
  } else if (kind === 'roller-y') {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - size * 0.85, y - size * 0.7); c.lineTo(x - size * 0.85, y + size * 0.7); c.closePath();
    c.fill(); c.stroke();
    for (const oy of [-size * 0.35, size * 0.35]) {
      c.beginPath(); c.arc(x - size * 1.1, y + oy, 2.5, 0, Math.PI * 2); c.stroke();
    }
  }
  c.restore();
}

function drawDiagramPanel(c, W, H, xs, ys, L, { color, title, unit, fillAlpha = 0.22 }) {
  const padL = 50, padR = 16, padT = 22, padB = 20;
  const pw = W - padL - padR, ph = H - padT - padB;
  const maxAbs = Math.max(...ys.map(Math.abs), 1e-6);
  const y0 = padT + ph * 0.5;
  const toX = x => padL + (x / L) * pw;
  const toY = v => y0 - (v / (maxAbs * 1.18)) * (ph * 0.46);

  c.clearRect(0, 0, W, H);
  // Zero axis & bounds
  c.strokeStyle = COL_AXIS; c.lineWidth = 1;
  c.beginPath(); c.moveTo(padL, y0); c.lineTo(padL + pw, y0); c.stroke();
  c.strokeStyle = COL_GRID;
  for (const frac of [-0.85, 0.85]) {
    const yy = y0 - frac * ph * 0.46;
    c.beginPath(); c.moveTo(padL, yy); c.lineTo(padL + pw, yy); c.stroke();
  }

  // Shaded polygon
  c.save();
  c.fillStyle = color; c.globalAlpha = fillAlpha;
  c.beginPath();
  c.moveTo(toX(xs[0]), y0);
  for (let i = 0; i < xs.length; i++) c.lineTo(toX(xs[i]), toY(ys[i]));
  c.lineTo(toX(xs[xs.length - 1]), y0);
  c.closePath(); c.fill();
  c.restore();

  // Curve stroke
  c.strokeStyle = color; c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const px = toX(xs[i]), py = toY(ys[i]);
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke();

  // Labels
  c.fillStyle = COL_MUTE; c.font = '600 10.5px "JetBrains Mono", monospace';
  c.textAlign = 'left'; c.fillText(`${title} (${unit})`, padL, 13);
  c.textAlign = 'right';
  c.fillText(`+${fmtFix(maxAbs, 1)}`, padL - 5, padT + 10);
  c.fillText('0', padL - 5, y0 + 3);
  c.fillText(`−${fmtFix(maxAbs, 1)}`, padL - 5, H - padB);
}

// =====================================================================
// 1. KİRİŞ ANALİZİ (field: insaat)
// =====================================================================

const BEAM_PRESETS = [
  {
    label: 'Basit Kiriş + Orta Yük',
    type: 'simply', L: 6, E_GPa: 200, secType: 'ibeam', bf: 180, h: 320, tf: 14, tw: 9, b: 200, d: 300,
    loads: [{ kind: 'point', x: 3, P: 40 }, { kind: 'dist', x1: 0, x2: 6, w1: 12, w2: 12 }],
  },
  {
    label: 'Konsol + Üçgen Yük',
    type: 'cantilever', L: 4.5, E_GPa: 200, secType: 'rect', b: 220, h: 380, bf: 180, tf: 14, tw: 9, d: 300,
    loads: [{ kind: 'dist', x1: 0, x2: 4.5, w1: 24, w2: 0 }, { kind: 'point', x: 4.5, P: 15 }],
  },
  {
    label: 'Çıkmalı Kiriş + Moment',
    type: 'overhanging', L: 8, E_GPa: 200, secType: 'ibeam', bf: 200, h: 360, tf: 16, tw: 10, b: 220, d: 320,
    loads: [{ kind: 'dist', x1: 0, x2: 8, w1: 15, w2: 15 }, { kind: 'point', x: 8, P: 25 }, { kind: 'moment', x: 3, M: 30 }],
  },
  {
    label: 'Çift Ankastre (Hiperstatik)',
    type: 'fixed-fixed', L: 7, E_GPa: 30, secType: 'rect', b: 300, h: 500, bf: 180, tf: 14, tw: 9, d: 350,
    loads: [{ kind: 'dist', x1: 0, x2: 7, w1: 18, w2: 18 }, { kind: 'point', x: 3.5, P: 35 }],
  },
];

function mountBeamAnalysis(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    type: 'simply', L: 6, E_GPa: 200,
    secType: 'ibeam', b: 200, h: 320, bf: 180, tf: 14, tw: 9, d: 300,
    tool: 'point', loadVal: 30, loadVal2: 15,
    loads: [{ kind: 'point', x: 3, P: 40 }, { kind: 'dist', x1: 0, x2: 6, w1: 12, w2: 12 }],
    sol: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Kirişin üzerine dokunarak</b> tekil yük, yayılı/üçgen yük veya tekil moment ekle. Mesnet tepkileri, kesme (V), eğilme momenti (M), sehim eğrisi ve kesit gerilmeleri sonlu elemanlar yöntemiyle anında hesaplanır.', BEAM_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-btype aria-label="Kiriş mesnet tipi">
        <button type="button" data-t="simply" class="on">Basit Kiriş</button>
        <button type="button" data-t="cantilever">Konsol</button>
        <button type="button" data-t="overhanging">Çıkmalı</button>
        <button type="button" data-t="fixed-fixed">Çift Ankastre</button>
      </div>
      <div class="slc-toolbar-g">
        <span class="slc-badge slc-badge-acc" data-stress-badge></span>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel">
        <h4 class="slc-title">Kiriş & Kesit</h4>
        <div data-ctrls></div>
        <div class="slc-divider"></div>
        <h4 class="slc-title">Dokunarak Yük Ekle</h4>
        <div class="seg slc-seg-wrap" role="tablist" data-ltool aria-label="Eklenecek yük tipi">
          <button type="button" data-lt="point" class="on">Tekil P</button>
          <button type="button" data-lt="uniform">Düzgün w</button>
          <button type="button" data-lt="linear">Üçgen w₁→w₂</button>
          <button type="button" data-lt="moment">Moment M</button>
        </div>
        <div data-lctrls></div>
        <div class="slc-btn-row">
          <button type="button" class="btn small" data-add-center>${icon('plus')} Ortaya ekle</button>
          <button type="button" class="btn small ghost" data-clear-loads>${icon('trash')} Yükleri temizle</button>
        </div>
        <div class="slc-load-list" data-load-list aria-label="Etkiyen yükler listesi"></div>
      </div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head">
            <h4 class="slc-title">Yükleme Şeması & Kesit (Yük eklemek için kirişe dokun)</h4>
            <span class="slc-hint mono" data-reac-line></span>
          </div>
          <div class="slc-cv-box"><canvas class="slc-cv slc-cv-tap" data-cv-beam aria-label="Etkileşimli kiriş şeması"></canvas></div>
        </div>
        <div class="slc-plot-card">
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-v aria-label="Kesme kuvveti diyagramı"></canvas></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-m aria-label="Eğilme momenti diyagramı"></canvas></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-y aria-label="Sehim eğrisi"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'EI \\frac{d^4 y}{dx^4} = -w(x), \\qquad V(x) = \\frac{dM}{dx}, \\qquad \\frac{dV}{dx} = -w(x)',
        '\\sigma_{\\max} = \\frac{|M_{\\max}|\\,c}{I} = \\frac{|M_{\\max}|}{S}, \\qquad \\tau_{\\max} = \\frac{|V_{\\max}|\\,Q_{\\max}}{I\\,b_w}',
      ],
      paragraphs: [
        'Euler–Bernoulli kiriş kuramı, kesit düzlemlerinin eğilme sonrasında da tarafsız eksene dik kaldığını varsayar. Çift ankastre gibi hiperstatik sistemlerde üçüncü derece Hermite sonlu eleman formülasyonu düğüm sehimlerini ve dönmelerini kesin çözer.',
        'I-profil kesitlerde malzeme tarafsız eksenden uzak başlıklarda toplandığı için aynı alana sahip dikdörtgen kesite göre çok daha yüksek atalet momenti $I$ ve çok daha küçük eğilme gerilmesi $\\sigma_{\\max}$ elde edilir.',
      ],
      tasks: [
        'Basit kirişte tüm yükleri temizleyip yalnızca $x = L/2$ konumuna $P = 40\\text{ kN}$ tekil yük ekle ve $M_{\\max} = PL/4$ olduğunu doğrula.',
        'Aynı düzgün yayılı yük altında **Basit Kiriş** ile **Çift Ankastre** kirişin maksimum sehim oranının $5 : 1$ olduğunu gözlemle.',
        'Kesiti **Dikdörtgen** ve **I-Profil** arasında değiştirerek maksimum eğilme gerilmesi $\\sigma_{\\max}$ ve sehim değişimini karşılaştır.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const lctrls = host.querySelector('[data-lctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const loadList = host.querySelector('[data-load-list]');
  const reacLine = host.querySelector('[data-reac-line]');
  const stressBadge = host.querySelector('[data-stress-badge]');

  const sL = addSlider(ctrls, { label: 'Açıklık L', unit: 'm', min: 2, max: 14, step: 0.5, value: st.L, onInput: v => {
    const scale = v / st.L;
    st.loads.forEach(ld => {
      if (ld.kind === 'dist') { ld.x1 = +(ld.x1 * scale).toFixed(2); ld.x2 = +(ld.x2 * scale).toFixed(2); }
      else ld.x = +(ld.x * scale).toFixed(2);
    });
    st.L = v; update();
  } });
  const sE = addSlider(ctrls, { label: 'Elastisite Modülü E', unit: 'GPa', min: 10, max: 220, step: 5, value: st.E_GPa, onInput: v => { st.E_GPa = v; update(); } });
  const selSec = addSelect(ctrls, 'Kesit Biçimi', [
    ['ibeam', 'I-Profil (Çelik)'], ['rect', 'Dikdörtgen (b × h)'], ['circle', 'Dairesel (d)'],
  ], st.secType, v => { st.secType = v; syncSecVis(); update(); });
  const sH = addSlider(ctrls, { label: 'Kesit Yüksekliği h', unit: 'mm', min: 120, max: 700, step: 10, value: st.h, onInput: v => { st.h = v; update(); } });
  const sB = addSlider(ctrls, { label: 'Genişlik b / b_f', unit: 'mm', min: 80, max: 400, step: 10, value: st.bf, onInput: v => { st.b = v; st.bf = v; update(); } });
  const sD = addSlider(ctrls, { label: 'Çap d', unit: 'mm', min: 120, max: 600, step: 10, value: st.d, onInput: v => { st.d = v; update(); } });

  const sLv1 = addSlider(lctrls, { label: 'Yük Şiddeti (P / w₁ / M)', unit: 'kN', min: 5, max: 80, step: 1, value: st.loadVal, onInput: v => { st.loadVal = v; } });
  const sLv2 = addSlider(lctrls, { label: 'Bitiş Şiddeti w₂', unit: 'kN/m', min: 0, max: 60, step: 1, value: st.loadVal2, onInput: v => { st.loadVal2 = v; } });

  function syncSecVis() {
    sH.setVisible(st.secType !== 'circle');
    sB.setVisible(st.secType !== 'circle');
    sD.setVisible(st.secType === 'circle');
    sLv2.setVisible(st.tool === 'linear');
  }

  function currentSection() {
    if (st.secType === 'circle') return { type: 'circle', d: st.d };
    if (st.secType === 'ibeam') return { type: 'ibeam', bf: st.bf, h: st.h, tf: st.tf, tw: st.tw };
    return { type: 'rect', b: st.b, h: st.h };
  }

  const cvBeam = setupCanvas(host.querySelector('[data-cv-beam]'), w => Math.min(220, Math.max(170, w * 0.34)), (c, W, H) => {
    const sol = st.sol;
    if (!sol?.ok) return;
    c.clearRect(0, 0, W, H);
    const padL = 44, padR = 112; // right area reserved for cross-section sketch
    const beamW = Math.max(120, W - padL - padR);
    const beamY = H * 0.58;
    const toX = x => padL + (x / sol.L) * beamW;
    const acc = accentColor();

    // Beam bar
    c.fillStyle = 'rgba(255,255,255,.15)';
    c.strokeStyle = COL_FG; c.lineWidth = 2;
    c.fillRect(padL, beamY - 5, beamW, 10);
    c.strokeRect(padL, beamY - 5, beamW, 10);

    // Supports
    sol.supports.forEach(s => {
      const sx = toX(s.x);
      if (s.fixT) drawSupport(c, sx, beamY, s.x > sol.L * 0.5 ? 'fixed-right' : 'fixed-left', 16);
      else drawSupport(c, sx, beamY + 5, s.x > sol.L * 0.3 ? 'roller' : 'pin', 12);
    });

    // Reaction arrows
    sol.reactions.forEach(r => {
      const rx = toX(r.x);
      if (Math.abs(r.Ry) > 0.05) {
        const up = r.Ry >= 0;
        drawArrow(c, rx, up ? beamY + 46 : beamY + 12, rx, up ? beamY + 14 : beamY + 44, COL_OK, 2);
        c.fillStyle = COL_OK; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${fmtFix(r.Ry, 1)} kN`, rx, beamY + 58);
      }
    });

    // Loads
    for (const ld of sol.loads) {
      if (ld.kind === 'point') {
        const lx = toX(ld.x);
        drawArrow(c, lx, beamY - 52, lx, beamY - 7, COL_BAD, 2.2);
        c.fillStyle = COL_BAD; c.font = '600 10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${fmtFix(ld.P, 0)} kN`, lx, beamY - 58);
      } else if (ld.kind === 'moment') {
        const lx = toX(ld.x);
        c.save();
        c.strokeStyle = COL_WARN; c.lineWidth = 2.2;
        c.beginPath(); c.arc(lx, beamY, 17, -Math.PI * 0.75, Math.PI * 0.55); c.stroke();
        c.fillStyle = COL_WARN; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${fmtFix(ld.M, 0)} kN·m`, lx, beamY - 24);
        c.restore();
      } else if (ld.kind === 'dist') {
        const x1 = toX(ld.x1), x2 = toX(ld.x2);
        const wMax = Math.max(Math.abs(ld.w1), Math.abs(ld.w2), 1);
        const h1 = (Math.abs(ld.w1) / wMax) * 34 + 6;
        const h2 = (Math.abs(ld.w2) / wMax) * 34 + 6;
        c.save();
        c.fillStyle = 'rgba(90,176,255,.16)'; c.strokeStyle = COL_BLUE; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x1, beamY - 6); c.lineTo(x1, beamY - 6 - h1); c.lineTo(x2, beamY - 6 - h2); c.lineTo(x2, beamY - 6); c.closePath();
        c.fill(); c.stroke();
        const nArr = Math.max(3, Math.round((x2 - x1) / 28));
        for (let k = 0; k <= nArr; k++) {
          const f = k / nArr;
          const ax = x1 + f * (x2 - x1);
          const ah = h1 + f * (h2 - h1);
          drawArrow(c, ax, beamY - 6 - ah, ax, beamY - 7, COL_BLUE, 1.3);
        }
        c.fillStyle = COL_BLUE; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
        const lbl = Math.abs(ld.w1 - ld.w2) < 0.1 ? `${fmtFix(ld.w1, 0)} kN/m` : `${fmtFix(ld.w1, 0)}→${fmtFix(ld.w2, 0)} kN/m`;
        c.fillText(lbl, 0.5 * (x1 + x2), beamY - 12 - Math.max(h1, h2));
        c.restore();
      }
    }

    // Length axis ticks
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    for (let k = 0; k <= 4; k++) {
      const xv = (sol.L * k) / 4;
      c.fillText(`${fmtFix(xv, 1)}m`, toX(xv), H - 8);
    }

    // Cross-section inset on the right
    const cx = W - 56, cy = H * 0.48;
    const sec = sol.section;
    c.save();
    c.strokeStyle = acc; c.fillStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.8;
    if (sec.type === 'circle') {
      c.beginPath(); c.arc(cx, cy, 26, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (sec.type === 'ibeam') {
      const sh = 56, sb = Math.min(48, (sec.bf / sec.h) * sh);
      const tf = Math.max(6, (sec.tf / sec.h) * sh), tw = Math.max(5, (sec.tw / sec.h) * sh);
      c.beginPath();
      c.rect(cx - sb / 2, cy - sh / 2, sb, tf);
      c.rect(cx - tw / 2, cy - sh / 2 + tf, tw, sh - 2 * tf);
      c.rect(cx - sb / 2, cy + sh / 2 - tf, sb, tf);
      c.fill(); c.stroke();
    } else {
      const sh = 54, sb = Math.min(48, Math.max(16, (sec.b / sec.h) * sh));
      c.fillRect(cx - sb / 2, cy - sh / 2, sb, sh);
      c.strokeRect(cx - sb / 2, cy - sh / 2, sb, sh);
    }
    // Neutral axis dashed line
    c.strokeStyle = COL_WARN; c.setLineDash([3, 3]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx - 34, cy); c.lineTo(cx + 34, cy); c.stroke();
    c.setLineDash([]);
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText(`I=${fmtNum(sec.I * 1e-4, 3)} cm⁴`, cx, H - 8);
    c.restore();
  }, clean);

  const cvV = setupCanvas(host.querySelector('[data-cv-v]'), () => 130, (c, W, H) => {
    if (st.sol?.ok) drawDiagramPanel(c, W, H, st.sol.xs, st.sol.V, st.sol.L, { color: COL_BLUE, title: 'Kesme Kuvveti V(x)', unit: 'kN' });
  }, clean);
  const cvM = setupCanvas(host.querySelector('[data-cv-m]'), () => 138, (c, W, H) => {
    if (st.sol?.ok) drawDiagramPanel(c, W, H, st.sol.xs, st.sol.M, st.sol.L, { color: accentColor(), title: 'Eğilme Momenti M(x)', unit: 'kN·m' });
  }, clean);
  const cvY = setupCanvas(host.querySelector('[data-cv-y]'), () => 130, (c, W, H) => {
    if (st.sol?.ok) drawDiagramPanel(c, W, H, st.sol.xs, st.sol.yMm, st.sol.L, { color: COL_OK, title: 'Sehim Eğrisi y(x)', unit: 'mm', fillAlpha: 0.14 });
  }, clean);

  function addLoadAt(xNorm) {
    const x = +(Math.max(0.05, Math.min(st.L - 0.05, xNorm * st.L))).toFixed(2);
    if (st.tool === 'point') st.loads.push({ kind: 'point', x, P: st.loadVal });
    else if (st.tool === 'moment') st.loads.push({ kind: 'moment', x, M: st.loadVal });
    else if (st.tool === 'uniform') {
      const a = +Math.max(0, x - st.L * 0.25).toFixed(2);
      const b = +Math.min(st.L, x + st.L * 0.25).toFixed(2);
      st.loads.push({ kind: 'dist', x1: a, x2: Math.max(a + 0.5, b), w1: st.loadVal, w2: st.loadVal });
    } else {
      st.loads.push({ kind: 'dist', x1: 0, x2: st.L, w1: st.loadVal, w2: st.loadVal2 });
    }
    update();
  }

  host.querySelector('[data-cv-beam]').addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const padL = 44, padR = 112;
    const bw = Math.max(120, r.width - padL - padR);
    const relX = (e.clientX - r.left - padL) / bw;
    if (relX >= -0.02 && relX <= 1.02) addLoadAt(Math.max(0, Math.min(1, relX)));
  });

  function renderLoadList() {
    if (!st.loads.length) {
      loadList.innerHTML = '<span class="slc-hint">Yük yok — kiriş üzerine dokunarak ekle.</span>';
      return;
    }
    loadList.innerHTML = st.loads.map((ld, i) => {
      const txt = ld.kind === 'point' ? `Tekil P = ${fmtFix(ld.P, 1)} kN @ x=${fmtFix(ld.x, 2)} m`
        : ld.kind === 'moment' ? `Moment M = ${fmtFix(ld.M, 1)} kN·m @ x=${fmtFix(ld.x, 2)} m`
          : `Yayılı ${fmtFix(ld.w1, 1)}→${fmtFix(ld.w2, 1)} kN/m [${fmtFix(ld.x1, 1)}–${fmtFix(ld.x2, 1)} m]`;
      return `<div class="slc-load-item"><span>${esc(txt)}</span><button type="button" class="slc-del-btn" data-del="${i}" aria-label="Yükü sil">${icon('x')}</button></div>`;
    }).join('');
  }

  function update() {
    st.sol = solveBeam({ type: st.type, L: st.L, E_GPa: st.E_GPa, section: currentSection(), loads: st.loads });
    renderLoadList();
    if (!st.sol.ok) return;
    const s = st.sol;
    reacLine.textContent = s.reactions.map(r => `${r.label.split(' ')[0]}: Ry=${fmtFix(r.Ry, 1)} kN${Math.abs(r.Mz) > 0.05 ? `, M=${fmtFix(r.Mz, 1)} kN·m` : ''}`).join('  ·  ');
    const okDefl = s.spanOverDefl >= 250;
    stressBadge.textContent = `σ_maks = ${fmtFix(s.maxSigmaMPa, 1)} MPa · L/δ = ${s.spanOverDefl > 9999 ? '>9999' : fmtFix(s.spanOverDefl, 0)}`;
    stressBadge.className = `slc-badge ${s.maxSigmaMPa > 235 || !okDefl ? 'slc-badge-warn' : 'slc-badge-ok'}`;

    renderKpis(kpis, [
      { lbl: 'Maks. Kesme |V|', val: `${fmtFix(s.maxAbsV, 2)} kN`, sub: `τ_maks = ${fmtFix(s.maxTauMPa, 2)} MPa` },
      { lbl: 'Maks. Moment |M|', val: `${fmtFix(s.maxAbsM, 2)} kN·m`, sub: `x = ${fmtFix(s.xMaxM, 2)} m`, tone: 'acc' },
      { lbl: 'Maks. Sehim |δ|', val: `${fmtFix(s.maxAbsYMm, 2)} mm`, sub: `L/δ = ${s.spanOverDefl > 9999 ? '∞' : Math.round(s.spanOverDefl)}`, tone: okDefl ? 'ok' : 'warn' },
      { lbl: 'Eğilme Gerilmesi σ', val: `${fmtFix(s.maxSigmaMPa, 1)} MPa`, sub: `S = ${fmtNum(s.section.S * 1e-3, 3)} cm³` },
    ]);
    cvBeam.render(); cvV.render(); cvM.render(); cvY.render();
  }

  host.querySelector('[data-btype]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.type) return;
    st.type = b.dataset.t;
    host.querySelectorAll('[data-btype] button').forEach(x => x.classList.toggle('on', x === b));
    update(); syncSegments(host, false);
  });
  host.querySelector('[data-ltool]').addEventListener('click', e => {
    const b = e.target.closest('[data-lt]'); if (!b) return;
    st.tool = b.dataset.lt;
    host.querySelectorAll('[data-ltool] button').forEach(x => x.classList.toggle('on', x === b));
    syncSecVis(); syncSegments(host, false);
  });
  host.querySelector('[data-add-center]').addEventListener('click', () => addLoadAt(0.5));
  host.querySelector('[data-clear-loads]').addEventListener('click', () => { st.loads = []; update(); });
  loadList.addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d) { st.loads.splice(+d.dataset.del, 1); update(); }
  });

  bindPresets(host, BEAM_PRESETS, p => {
    Object.assign(st, { type: p.type, L: p.L, E_GPa: p.E_GPa, secType: p.secType, b: p.b, h: p.h, bf: p.bf, tf: p.tf, tw: p.tw, d: p.d });
    st.loads = p.loads.map(ld => ({ ...ld }));
    sL.set(st.L); sE.set(st.E_GPa); selSec.set(st.secType); sH.set(st.h); sB.set(st.bf); sD.set(st.d);
    host.querySelectorAll('[data-btype] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.type));
    syncSecVis(); update();
  });

  bindTasks(host);
  syncSecVis();
  update();
  return clean.run;
}

// =====================================================================
// 2. KAFES SİSTEM (2D TRUSS) (field: insaat)
// =====================================================================

const TRUSS_PRESETS = [
  {
    label: 'Pratt Köprü (4 açıklık)',
    nodes: [
      { x: 0, y: 0, support: 'pin', fx: 0, fy: 0 },
      { x: 3, y: 0, support: 'free', fx: 0, fy: -60 },
      { x: 6, y: 0, support: 'free', fx: 0, fy: -80 },
      { x: 9, y: 0, support: 'free', fx: 0, fy: -60 },
      { x: 12, y: 0, support: 'roller-x', fx: 0, fy: 0 },
      { x: 3, y: 3, support: 'free', fx: 0, fy: 0 },
      { x: 6, y: 3, support: 'free', fx: 0, fy: 0 },
      { x: 9, y: 3, support: 'free', fx: 0, fy: 0 },
    ],
    members: [
      [0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7],
      [0, 5], [1, 5], [2, 6], [3, 7], [4, 7], [5, 2], [7, 2],
    ],
  },
  {
    label: 'Warren Kafes',
    nodes: [
      { x: 0, y: 0, support: 'pin', fx: 0, fy: 0 },
      { x: 4, y: 0, support: 'free', fx: 0, fy: -75 },
      { x: 8, y: 0, support: 'free', fx: 0, fy: -75 },
      { x: 12, y: 0, support: 'roller-x', fx: 0, fy: 0 },
      { x: 2, y: 3.2, support: 'free', fx: 0, fy: 0 },
      { x: 6, y: 3.2, support: 'free', fx: 20, fy: 0 },
      { x: 10, y: 3.2, support: 'free', fx: 0, fy: 0 },
    ],
    members: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [0, 4], [4, 1], [1, 5], [5, 2], [2, 6], [6, 3]],
  },
  {
    label: 'Konsol Kafes (Vinç)',
    nodes: [
      { x: 0, y: 0, support: 'pin', fx: 0, fy: 0 },
      { x: 0, y: 3, support: 'pin', fx: 0, fy: 0 },
      { x: 3, y: 0, support: 'free', fx: 0, fy: 0 },
      { x: 3, y: 2.5, support: 'free', fx: 0, fy: 0 },
      { x: 6, y: 0, support: 'free', fx: 0, fy: -60 },
      { x: 6, y: 2, support: 'free', fx: 0, fy: 0 },
      { x: 9, y: 1, support: 'free', fx: 0, fy: -90 },
    ],
    members: [[0, 2], [2, 4], [1, 3], [3, 5], [2, 3], [4, 5], [1, 2], [3, 4], [4, 6], [5, 6]],
  },
  {
    label: 'Hiperstatik X-Çapraz',
    nodes: [
      { x: 0, y: 0, support: 'pin', fx: 0, fy: 0 },
      { x: 4, y: 0, support: 'roller-x', fx: 0, fy: 0 },
      { x: 0, y: 3, support: 'free', fx: 50, fy: -40 },
      { x: 4, y: 3, support: 'free', fx: 0, fy: -40 },
    ],
    members: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [1, 2]],
  },
];

function mountTruss2D(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    nodes: TRUSS_PRESETS[0].nodes.map(n => ({ ...n })),
    members: TRUSS_PRESETS[0].members.map(([i, j]) => ({ i, j })),
    E_GPa: 200, A_cm2: 12,
    scaleDef: 120, showDeformed: true,
    tool: 'select', // select | node | member | support | load | del
    selectedNode: 2, pendingNode: null,
    loadFy: -80, loadFx: 0,
    sol: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('2B kafes sistemini doğrudan ızgarada düzenle: düğüm ve çubuk ekle, mesnetleri değiştir veya yük uygula. Doğrudan rijitlik matrisi yöntemiyle çubuk kuvvetleri (<b>+Ç çekme</b>, <b>−B basınç</b>), sehimler ve statik belirlilik canlı çözülür.', TRUSS_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-ttool aria-label="Kafes düzenleme aracı">
        <button type="button" data-tt="select" class="on">Seç</button>
        <button type="button" data-tt="node">+ Düğüm</button>
        <button type="button" data-tt="member">+ Çubuk</button>
        <button type="button" data-tt="support">Mesnet</button>
        <button type="button" data-tt="del">Sil</button>
      </div>
      <span class="slc-badge" data-det-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel">
        <h4 class="slc-title">Kesit & Seçili Düğüm Yükü</h4>
        <div data-ctrls></div>
        <div class="slc-alert" data-node-info></div>
      </div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head">
            <h4 class="slc-title">Kafes Geometri & Deforme Şekil</h4>
            <div class="slc-legend">
              <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_BLUE}"></i>Çekme (+Ç)</span>
              <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_BAD}"></i>Basınç (−B)</span>
              <span class="slc-legend-item"><i class="slc-legend-swatch slc-legend-dash" style="border-color:${COL_OK}"></i>Deforme</span>
            </div>
          </div>
          <div class="slc-cv-box"><canvas class="slc-cv slc-cv-tap" data-cv aria-label="2B kafes sistem tuvali"></canvas></div>
        </div>
        <div class="slc-table-wrap">
          <table class="slc-tbl" aria-label="Kafes çubuk kuvvetleri tablosu">
            <thead><tr><th>Çubuk</th><th>Düğümler</th><th>L (m)</th><th>Kuvvet N (kN)</th><th>Gerilme (MPa)</th><th>Durum</th></tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathbf{K}\\,\\mathbf{u} = \\mathbf{F}, \\qquad \\mathbf{k}_e = \\frac{EA}{L}\\begin{bmatrix} c^2 & cs & -c^2 & -cs \\\\ cs & s^2 & -cs & -s^2 \\\\ -c^2 & -cs & c^2 & cs \\\\ -cs & -s^2 & cs & s^2 \\end{bmatrix}',
        'N_e = \\frac{EA}{L}\\big[(u_j - u_i)\\cos\\theta + (v_j - v_i)\\sin\\theta\\big], \\qquad m + r \\;\\lesseqgtr\\; 2j',
      ],
      paragraphs: [
        'Kafes çubukları yalnızca eksenel kuvvet taşır. Pozitif $N_e > 0$ **çekme (+Ç)**, negatif $N_e < 0$ **basınç (−B)** anlamına gelir; sıfır kuvvetli çubuklar kararlılık veya alternatif yük durumları için bulunur.',
        'Statik belirlilik ölçütü $m + r = 2j$ izostatik, $m + r > 2j$ hiperstatik, $m + r < 2j$ ise geometrik olarak yetersiz (mekanizma) duruma işaret eder.',
      ],
      tasks: [
        '**Pratt Köprü** senaryosunda alt başlık çubuklarının çekmede (+Ç), üst başlık çubuklarının basınçta (−B) çalıştığını tablodan doğrula.',
        'Orta alt düğümü seçip düşey yükü $-80\\text{ kN}$ değerinden $-160\\text{ kN}$ değerine çıkar; doğrusal elastik sistemde tüm çubuk kuvvetleri ve sehimlerin nasıl ölçeklendiğini gör.',
        '**Hiperstatik X-Çapraz** senaryosunda `Sil` aracıyla çaprazlardan birini silip sistemin 1. derece hiperstatikten izostatiğe ($m+r=2j$) geçişini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const tbody = host.querySelector('[data-tbody]');
  const detBadge = host.querySelector('[data-det-badge]');
  const nodeInfo = host.querySelector('[data-node-info]');

  const sFy = addSlider(ctrls, { label: 'Seçili Düğüm Fy', unit: 'kN', min: -200, max: 100, step: 5, value: st.loadFy, onInput: v => {
    st.loadFy = v;
    if (st.nodes[st.selectedNode]) { st.nodes[st.selectedNode].fy = v; update(); }
  } });
  const sFx = addSlider(ctrls, { label: 'Seçili Düğüm Fx', unit: 'kN', min: -150, max: 150, step: 5, value: st.loadFx, onInput: v => {
    st.loadFx = v;
    if (st.nodes[st.selectedNode]) { st.nodes[st.selectedNode].fx = v; update(); }
  } });
  const sA = addSlider(ctrls, { label: 'Çubuk Kesit Alanı A', unit: 'cm²', min: 2, max: 60, step: 1, value: st.A_cm2, onInput: v => { st.A_cm2 = v; update(); } });
  const sE = addSlider(ctrls, { label: 'Elastisite Modülü E', unit: 'GPa', min: 50, max: 220, step: 10, value: st.E_GPa, onInput: v => { st.E_GPa = v; update(); } });
  const sScale = addSlider(ctrls, { label: 'Sehim Büyütme', unit: '×', min: 10, max: 500, step: 10, value: st.scaleDef, onInput: v => { st.scaleDef = v; cv.render(); } });
  addToggle(ctrls, 'Deforme şekli göster', st.showDeformed, v => { st.showDeformed = v; cv.render(); });

  let mapInfo = { minX: -1, maxX: 13, minY: -1, maxY: 4, scale: 30, ox: 40, oy: 200 };

  function computeMap(W, H) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    st.nodes.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    if (!Number.isFinite(minX)) { minX = 0; maxX = 10; minY = 0; maxY = 4; }
    const spanX = Math.max(4, maxX - minX + 2.4);
    const spanY = Math.max(3, maxY - minY + 2.4);
    const padX = 44, padY = 42;
    const scale = Math.min((W - 2 * padX) / spanX, (H - 2 * padY) / spanY);
    const cx = 0.5 * (minX + maxX), cy = 0.5 * (minY + maxY);
    mapInfo = { scale, cx, cy, W, H };
  }

  const toScr = (x, y) => ({
    x: mapInfo.W * 0.5 + (x - mapInfo.cx) * mapInfo.scale,
    y: mapInfo.H * 0.55 - (y - mapInfo.cy) * mapInfo.scale,
  });
  const toWorld = (sx, sy) => ({
    x: Math.round((mapInfo.cx + (sx - mapInfo.W * 0.5) / mapInfo.scale) * 2) / 2,
    y: Math.round((mapInfo.cy - (sy - mapInfo.H * 0.55) / mapInfo.scale) * 2) / 2,
  });

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(340, Math.max(240, w * 0.54)), (c, W, H) => {
    computeMap(W, H);
    c.clearRect(0, 0, W, H);
    const sol = st.sol;

    // Subtle 1m coordinate grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let gx = -2; gx <= 16; gx++) {
      const p = toScr(gx, 0);
      if (p.x > 8 && p.x < W - 8) { c.beginPath(); c.moveTo(p.x, 8); c.lineTo(p.x, H - 8); c.stroke(); }
    }
    for (let gy = -2; gy <= 8; gy++) {
      const p = toScr(0, gy);
      if (p.y > 8 && p.y < H - 8) { c.beginPath(); c.moveTo(8, p.y); c.lineTo(W - 8, p.y); c.stroke(); }
    }

    // Deformed truss overlay
    if (sol?.ok && st.showDeformed) {
      c.save();
      c.strokeStyle = COL_OK; c.lineWidth = 1.6; c.setLineDash([5, 4]);
      st.members.forEach(mb => {
        const ni = sol.nodes[mb.i], nj = sol.nodes[mb.j];
        const pi = toScr(ni.x + (ni.uxMm / 1000) * st.scaleDef, ni.y + (ni.uyMm / 1000) * st.scaleDef);
        const pj = toScr(nj.x + (nj.uxMm / 1000) * st.scaleDef, nj.y + (nj.uyMm / 1000) * st.scaleDef);
        c.beginPath(); c.moveTo(pi.x, pi.y); c.lineTo(pj.x, pj.y); c.stroke();
      });
      c.restore();
    }

    // Members colored & labeled by force
    const maxF = sol?.ok ? Math.max(...sol.members.map(m => Math.abs(m.force)), 1) : 1;
    st.members.forEach((mb, idx) => {
      const a = toScr(st.nodes[mb.i].x, st.nodes[mb.i].y);
      const b = toScr(st.nodes[mb.j].x, st.nodes[mb.j].y);
      const mr = sol?.ok ? sol.members[idx] : null;
      let col = COL_FG, lw = 2.2;
      if (mr) {
        const frac = Math.abs(mr.force) / maxF;
        lw = 1.6 + frac * 4.2;
        col = mr.state === 'çekme' ? COL_BLUE : mr.state === 'basınç' ? COL_BAD : COL_DIM;
      }
      c.save();
      c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
      if (mr?.state === 'sıfır') c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.setLineDash([]);
      if (mr && Math.hypot(b.x - a.x, b.y - a.y) > 38) {
        const mx = 0.5 * (a.x + b.x), my = 0.5 * (a.y + b.y);
        const tag = mr.state === 'sıfır' ? '0' : `${mr.force > 0 ? '+' : '−'}${Math.abs(mr.force).toFixed(0)}`;
        c.fillStyle = 'rgba(0,0,0,.78)';
        c.fillRect(mx - 17, my - 8, 34, 15);
        c.fillStyle = col; c.font = '600 9.5px "JetBrains Mono", monospace';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(tag, mx, my);
      }
      c.restore();
    });

    // Supports, loads, reactions & nodes
    st.nodes.forEach((nd, i) => {
      const p = toScr(nd.x, nd.y);
      if (nd.support && nd.support !== 'free') drawSupport(c, p.x, p.y, nd.support, 11);
      if (Math.abs(nd.fy) > 0.1) {
        const dir = nd.fy < 0 ? 1 : -1;
        drawArrow(c, p.x, p.y - dir * 36, p.x, p.y - dir * 8, COL_WARN, 2.2, `${fmtFix(Math.abs(nd.fy), 0)}kN`);
      }
      if (Math.abs(nd.fx) > 0.1) {
        const dir = nd.fx > 0 ? 1 : -1;
        drawArrow(c, p.x - dir * 36, p.y, p.x - dir * 8, p.y, COL_WARN, 2.2, `${fmtFix(Math.abs(nd.fx), 0)}kN`);
      }
      if (sol?.ok) {
        const nr = sol.nodes[i];
        if (Math.abs(nr.ry) > 0.1) {
          drawArrow(c, p.x, p.y + 40, p.x, p.y + 15, COL_OK, 1.8);
        }
      }
      c.save();
      const isSel = i === st.selectedNode || i === st.pendingNode;
      c.fillStyle = isSel ? accentColor() : '#0b0b10';
      c.strokeStyle = isSel ? '#fff' : COL_FG;
      c.lineWidth = isSel ? 2.4 : 1.8;
      c.beginPath(); c.arc(p.x, p.y, isSel ? 7.5 : 5.8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = isSel ? '#000' : COL_FG;
      c.font = '700 9px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(i + 1), p.x, p.y + 0.5);
      c.restore();
    });
  }, clean);

  host.querySelector('[data-cv]').addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    let hitNode = -1, minD = 22;
    st.nodes.forEach((n, i) => {
      const p = toScr(n.x, n.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < minD) { minD = d; hitNode = i; }
    });

    if (st.tool === 'node') {
      if (hitNode === -1 && st.nodes.length < 18) {
        const w = toWorld(sx, sy);
        st.nodes.push({ x: w.x, y: w.y, support: 'free', fx: 0, fy: 0 });
        st.selectedNode = st.nodes.length - 1;
        update();
      }
      return;
    }
    if (st.tool === 'member') {
      if (hitNode >= 0) {
        if (st.pendingNode === null) { st.pendingNode = hitNode; cv.render(); }
        else if (st.pendingNode !== hitNode) {
          const exists = st.members.some(m => (m.i === st.pendingNode && m.j === hitNode) || (m.j === st.pendingNode && m.i === hitNode));
          if (!exists) st.members.push({ i: st.pendingNode, j: hitNode });
          st.pendingNode = null;
          update();
        }
      }
      return;
    }
    if (st.tool === 'support') {
      if (hitNode >= 0) {
        const order = ['free', 'pin', 'roller-x', 'roller-y'];
        const cur = order.indexOf(st.nodes[hitNode].support || 'free');
        st.nodes[hitNode].support = order[(cur + 1) % order.length];
        st.selectedNode = hitNode;
        update();
      }
      return;
    }
    if (st.tool === 'del') {
      if (hitNode >= 0 && st.nodes.length > 2) {
        st.nodes.splice(hitNode, 1);
        st.members = st.members.filter(m => m.i !== hitNode && m.j !== hitNode)
          .map(m => ({ i: m.i > hitNode ? m.i - 1 : m.i, j: m.j > hitNode ? m.j - 1 : m.j }));
        st.selectedNode = Math.max(0, Math.min(st.selectedNode, st.nodes.length - 1));
        update();
      } else {
        // Check nearest member segment
        let hitMb = -1, bestMd = 14;
        st.members.forEach((mb, idx) => {
          const a = toScr(st.nodes[mb.i].x, st.nodes[mb.i].y);
          const b = toScr(st.nodes[mb.j].x, st.nodes[mb.j].y);
          const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((sx - a.x) * (b.x - a.x) + (sy - a.y) * (b.y - a.y)) / l2));
          const d = Math.hypot(sx - (a.x + t * (b.x - a.x)), sy - (a.y + t * (b.y - a.y)));
          if (d < bestMd) { bestMd = d; hitMb = idx; }
        });
        if (hitMb >= 0) { st.members.splice(hitMb, 1); update(); }
      }
      return;
    }
    if (hitNode >= 0) {
      st.selectedNode = hitNode;
      syncSelectedNode();
      cv.render();
    }
  });

  function syncSelectedNode() {
    const nd = st.nodes[st.selectedNode];
    if (!nd) return;
    sFy.set(nd.fy || 0); sFx.set(nd.fx || 0);
    const supNames = { free: 'Serbest', pin: 'Sabit Mafsal', 'roller-x': 'Kayıcı (Y tutulu)', 'roller-y': 'Kayıcı (X tutulu)' };
    nodeInfo.textContent = `Düğüm #${st.selectedNode + 1} (${nd.x} m, ${nd.y} m) · ${supNames[nd.support || 'free']}`;
  }

  function update() {
    const membersWithProps = st.members.map(m => ({ ...m, E_GPa: st.E_GPa, A_cm2: st.A_cm2 }));
    st.sol = solveTruss2D({ nodes: st.nodes, members: membersWithProps });
    syncSelectedNode();
    const s = st.sol;
    const detTxt = s.detDegree === 0 ? `İzostatik (m+r=${s.m + s.r} = 2j)`
      : s.detDegree > 0 ? `${s.detDegree}. Derece Hiperstatik (m+r=${s.m + s.r} > ${2 * s.j})`
        : `Mekanizma! (m+r=${s.m + s.r} < ${2 * s.j})`;
    detBadge.textContent = detTxt;
    detBadge.className = `slc-badge ${s.ok ? (s.detDegree === 0 ? 'slc-badge-ok' : 'slc-badge-acc') : 'slc-badge-bad'}`;

    if (!s.ok) {
      renderKpis(kpis, [{ lbl: 'Durum', val: 'Çözülemedi', sub: s.error, tone: 'bad' }]);
      tbody.innerHTML = `<tr><td colspan="6" class="mute">${esc(s.error)}</td></tr>`;
      cv.render();
      return;
    }

    renderKpis(kpis, [
      { lbl: 'Maks. Çekme (+Ç)', val: `+${fmtFix(s.maxTension, 1)} kN`, tone: 'acc' },
      { lbl: 'Maks. Basınç (−B)', val: `${fmtFix(s.maxCompression, 1)} kN`, tone: 'bad' },
      { lbl: 'Maks. Sehim', val: `${fmtFix(s.maxDispMm, 2)} mm`, sub: `U = ${fmtFix(s.strainEnergyJ, 1)} J` },
      { lbl: 'Denge Hatası', val: `${s.equilibriumError.toExponential(1)}`, sub: 'ΣF = 0 doğrulandı', tone: 'ok' },
    ]);

    tbody.innerHTML = s.members.map((mb, i) => {
      const cls = mb.state === 'çekme' ? 'slc-tension' : mb.state === 'basınç' ? 'slc-compress' : 'slc-zero';
      const tag = mb.state === 'çekme' ? '+Ç Çekme' : mb.state === 'basınç' ? '−B Basınç' : '0 Sıfır';
      return `<tr>
        <td class="mono">Ç${i + 1}</td>
        <td class="mono">${mb.i + 1}–${mb.j + 1}</td>
        <td class="mono">${fmtFix(mb.L, 2)}</td>
        <td class="mono ${cls}">${mb.force >= 0 ? '+' : '−'}${fmtFix(Math.abs(mb.force), 2)}</td>
        <td class="mono ${cls}">${fmtFix(mb.stressMPa, 1)}</td>
        <td class="${cls}">${tag}</td>
      </tr>`;
    }).join('');
    cv.render();
  }

  host.querySelector('[data-ttool]').addEventListener('click', e => {
    const b = e.target.closest('[data-tt]'); if (!b) return;
    st.tool = b.dataset.tt; st.pendingNode = null;
    host.querySelectorAll('[data-ttool] button').forEach(x => x.classList.toggle('on', x === b));
    syncSegments(host, false); cv.render();
  });

  bindPresets(host, TRUSS_PRESETS, p => {
    st.nodes = p.nodes.map(n => ({ ...n }));
    st.members = p.members.map(([i, j]) => ({ i, j }));
    st.selectedNode = Math.min(2, st.nodes.length - 1);
    st.pendingNode = null;
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 3. ÇERÇEVE ANALİZİ (2D FRAME) (field: insaat)
// =====================================================================

const FRAME_PRESETS = [
  { label: 'Portal (Ankastre)', kind: 'portal', L: 6, H: 4, P_lat: 35, w_beam: 18, sup: 'fixed', ratioI: 1.5 },
  { label: 'Portal (Mafsallı)', kind: 'portal', L: 6, H: 4, P_lat: 35, w_beam: 18, sup: 'pin', ratioI: 1.5 },
  { label: 'İki Katlı Çerçeve', kind: 'twostorey', L: 6, H: 3.5, P_lat: 30, w_beam: 15, sup: 'fixed', ratioI: 1.2 },
  { label: 'Beşik Çatı Çerçeve', kind: 'gable', L: 8, H: 4, P_lat: 20, w_beam: 14, sup: 'pin', ratioI: 1.4 },
];

function mountFrame2D(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    kind: 'portal', L: 6, H: 4, P_lat: 35, w_beam: 18, sup: 'fixed', ratioI: 1.5,
    diagram: 'M', defScale: 45, sol: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('2B rijit düğümlü çerçeveleri eğilmeli çubuk elemanlarıyla (6 serbestlik derecesi/eleman) çöz. Yatay deprem/rüzgâr yükü ve düşey yayılı yük altında <b>moment diyagramı (M)</b>, kesme (V), normal kuvvet (N) ve deforme şekli canlı incele.', FRAME_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-diag aria-label="Diyagram seçimi">
        <button type="button" data-d="M" class="on">Moment M</button>
        <button type="button" data-d="V">Kesme V</button>
        <button type="button" data-d="N">Eksenel N</button>
        <button type="button" data-d="D">Yalnız Deforme</button>
      </div>
      <div class="seg" role="tablist" data-sup aria-label="Mesnet tipi">
        <button type="button" data-s="fixed" class="on">Ankastre</button>
        <button type="button" data-s="pin">Mafsallı</button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head">
            <h4 class="slc-title">Çerçeve Diyagramı & Deforme Şekil</h4>
            <div class="slc-legend">
              <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${accentColor()}"></i>Diyagram</span>
              <span class="slc-legend-item"><i class="slc-legend-swatch slc-legend-dash" style="border-color:${COL_OK}"></i>Deforme</span>
            </div>
          </div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv aria-label="2B çerçeve diyagram tuvali"></canvas></div>
        </div>
        <div class="slc-table-wrap">
          <table class="slc-tbl" aria-label="Çerçeve eleman uç kuvvetleri">
            <thead><tr><th>Eleman</th><th>L (m)</th><th>N (kN)</th><th>V₁ / V₂ (kN)</th><th>M₁ (kN·m)</th><th>M₂ (kN·m)</th></tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathbf{K}_g = \\mathbf{T}^T \\mathbf{k}_l \\mathbf{T}, \\qquad \\mathbf{q}_l = \\mathbf{k}_l(\\mathbf{T}\\mathbf{u}_e) - \\mathbf{f}_{\\text{eq},l}',
        'M(s) = -q_{l,3} + q_{l,2} s - \\frac{1}{2} w s^2',
      ],
      paragraphs: [
        'Çerçeve elemanlarında düğümler moment aktardığı için her düğümde $(u, v, \\theta)$ olmak üzere 3 serbestlik derecesi vardır. Kiriş atalet momentinin kolona oranı $I_b/I_c$ arttıkça köşe momentleri ve yanal rijitlik belirgin biçimde artar.',
        'Ankastre mesnetli portal çerçevede taban momentleri oluşur ve yanal ötelenme (göreli kat ötelemesi) mafsallı çerçeveye göre yaklaşık 4 kat azalır.',
      ],
      tasks: [
        'Portal çerçevede mesneti **Ankastre** ile **Mafsallı** arasında değiştirerek tepe yatay ötelenmesi ve kolon taban momentini karşılaştır.',
        'Kiriş/kolon rijitlik oranını $I_b/I_c = 0.5$ değerinden $4.0$ değerine çıkararak kiriş açıklık ve köşe momentlerinin nasıl yeniden dağıldığını gözle.',
        '**İki Katlı Çerçeve** senaryosunda alt kat kolon momentlerinin üst kata göre neden daha büyük olduğunu incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const tbody = host.querySelector('[data-tbody]');

  const sL = addSlider(ctrls, { label: 'Açıklık L', unit: 'm', min: 3, max: 12, step: 0.5, value: st.L, onInput: v => { st.L = v; update(); } });
  const sH = addSlider(ctrls, { label: 'Kat Yüksekliği H', unit: 'm', min: 2.5, max: 6, step: 0.25, value: st.H, onInput: v => { st.H = v; update(); } });
  const sPlat = addSlider(ctrls, { label: 'Yatay Yük P', unit: 'kN', min: 0, max: 100, step: 5, value: st.P_lat, onInput: v => { st.P_lat = v; update(); } });
  const sW = addSlider(ctrls, { label: 'Kiriş Yayılı Yükü w', unit: 'kN/m', min: 0, max: 50, step: 2, value: st.w_beam, onInput: v => { st.w_beam = v; update(); } });
  const sRat = addSlider(ctrls, { label: 'Rijitlik Oranı I_kiriş / I_kolon', min: 0.4, max: 4.0, step: 0.1, value: st.ratioI, onInput: v => { st.ratioI = v; update(); } });
  const sDef = addSlider(ctrls, { label: 'Deformasyon Ölçeği', unit: '×', min: 5, max: 150, step: 5, value: st.defScale, onInput: v => { st.defScale = v; cv.render(); } });

  function buildFrameModel() {
    const Ic = 8000, Ib = Ic * st.ratioI, Ac = 50, Ab = 50;
    if (st.kind === 'twostorey') {
      const H1 = st.H, H2 = st.H * 2;
      return {
        nodes: [
          { x: 0, y: 0, support: st.sup },
          { x: 0, y: H1, support: 'free', fx: st.P_lat * 0.6 },
          { x: 0, y: H2, support: 'free', fx: st.P_lat },
          { x: st.L, y: H2, support: 'free' },
          { x: st.L, y: H1, support: 'free' },
          { x: st.L, y: 0, support: st.sup },
        ],
        members: [
          { i: 0, j: 1, A_cm2: Ac, I_cm4: Ic, w: 0 },
          { i: 1, j: 2, A_cm2: Ac, I_cm4: Ic, w: 0 },
          { i: 5, j: 4, A_cm2: Ac, I_cm4: Ic, w: 0 },
          { i: 4, j: 3, A_cm2: Ac, I_cm4: Ic, w: 0 },
          { i: 1, j: 4, A_cm2: Ab, I_cm4: Ib, w: st.w_beam },
          { i: 2, j: 3, A_cm2: Ab, I_cm4: Ib, w: st.w_beam * 0.8 },
        ],
      };
    }
    if (st.kind === 'gable') {
      const rise = st.L * 0.22;
      return {
        nodes: [
          { x: 0, y: 0, support: st.sup },
          { x: 0, y: st.H, support: 'free', fx: st.P_lat },
          { x: st.L * 0.5, y: st.H + rise, support: 'free' },
          { x: st.L, y: st.H, support: 'free' },
          { x: st.L, y: 0, support: st.sup },
        ],
        members: [
          { i: 0, j: 1, A_cm2: Ac, I_cm4: Ic, w: 0 },
          { i: 1, j: 2, A_cm2: Ab, I_cm4: Ib, w: st.w_beam },
          { i: 2, j: 3, A_cm2: Ab, I_cm4: Ib, w: st.w_beam },
          { i: 4, j: 3, A_cm2: Ac, I_cm4: Ic, w: 0 },
        ],
      };
    }
    return {
      nodes: [
        { x: 0, y: 0, support: st.sup },
        { x: 0, y: st.H, support: 'free', fx: st.P_lat },
        { x: st.L, y: st.H, support: 'free' },
        { x: st.L, y: 0, support: st.sup },
      ],
      members: [
        { i: 0, j: 1, A_cm2: Ac, I_cm4: Ic, w: 0 },
        { i: 1, j: 2, A_cm2: Ab, I_cm4: Ib, w: st.w_beam },
        { i: 3, j: 2, A_cm2: Ac, I_cm4: Ic, w: 0 },
      ],
    };
  }

  let curModel = null;
  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(350, Math.max(250, w * 0.56)), (c, W, H) => {
    const sol = st.sol;
    if (!sol?.ok || !curModel) return;
    c.clearRect(0, 0, W, H);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    curModel.nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
    const spanX = Math.max(4, maxX - minX + 3.2), spanY = Math.max(3, maxY - minY + 2.6);
    const sc = Math.min((W - 70) / spanX, (H - 64) / spanY);
    const cx = 0.5 * (minX + maxX), cy = 0.5 * (minY + maxY);
    const toScr = (x, y) => ({ x: W * 0.5 + (x - cx) * sc, y: H * 0.56 - (y - cy) * sc });
    const acc = accentColor();

    // Base frame lines
    c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 2.4;
    sol.members.forEach(mb => {
      const a = toScr(curModel.nodes[mb.i].x, curModel.nodes[mb.i].y);
      const b = toScr(curModel.nodes[mb.j].x, curModel.nodes[mb.j].y);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    });

    // Diagram overlay (M, V, or N) perpendicular to member
    if (st.diagram !== 'D') {
      const key = st.diagram;
      const maxVal = Math.max(key === 'M' ? sol.maxAbsM : key === 'V' ? sol.maxAbsV : sol.maxAbsN, 1e-6);
      const diagCol = key === 'M' ? acc : key === 'V' ? COL_BLUE : COL_PURP;
      const maxPx = Math.min(48, sc * 0.9);
      sol.members.forEach(mb => {
        const nx = -mb.s, ny = mb.c; // local +y' normal in world coords
        c.save();
        c.fillStyle = diagCol; c.globalAlpha = 0.2;
        c.beginPath();
        const p0 = toScr(mb.samples[0].x, mb.samples[0].y);
        c.moveTo(p0.x, p0.y);
        mb.samples.forEach(sp => {
          const val = sp[key];
          const off = (val / maxVal) * (maxPx / sc);
          // Plot sagging M on tension side (-y')
          const dir = key === 'M' ? -1 : 1;
          const pt = toScr(sp.x + dir * nx * off, sp.y + dir * ny * off);
          c.lineTo(pt.x, pt.y);
        });
        const pEnd = toScr(mb.samples[mb.samples.length - 1].x, mb.samples[mb.samples.length - 1].y);
        c.lineTo(pEnd.x, pEnd.y);
        c.closePath(); c.fill();
        c.globalAlpha = 1; c.strokeStyle = diagCol; c.lineWidth = 2;
        c.beginPath();
        mb.samples.forEach((sp, k) => {
          const off = (sp[key] / maxVal) * (maxPx / sc);
          const dir = key === 'M' ? -1 : 1;
          const pt = toScr(sp.x + dir * nx * off, sp.y + dir * ny * off);
          k === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y);
        });
        c.stroke();
        // Peak value label per member
        let best = mb.samples[0];
        mb.samples.forEach(sp => { if (Math.abs(sp[key]) > Math.abs(best[key])) best = sp; });
        if (Math.abs(best[key]) > maxVal * 0.08) {
          const off = (best[key] / maxVal) * (maxPx / sc);
          const dir = key === 'M' ? -1 : 1;
          const pt = toScr(best.x + dir * nx * off * 1.18, best.y + dir * ny * off * 1.18);
          c.fillStyle = diagCol; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText(`${fmtFix(best[key], 1)}`, pt.x, pt.y);
        }
        c.restore();
      });
    }

    // Deformed centerline (exact cubic Hermite)
    c.save();
    c.strokeStyle = COL_OK; c.lineWidth = 2; c.setLineDash([5, 3]);
    sol.members.forEach(mb => {
      c.beginPath();
      mb.samples.forEach((sp, k) => {
        const pt = toScr(sp.x + sp.dx * st.defScale, sp.y + sp.dy * st.defScale);
        k === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y);
      });
      c.stroke();
    });
    c.restore();

    // Supports & horizontal load arrows
    curModel.nodes.forEach((nd, idx) => {
      const p = toScr(nd.x, nd.y);
      if (nd.support === 'fixed') drawSupport(c, p.x, p.y, 'fixed-bottom', 13);
      else if (nd.support === 'pin') drawSupport(c, p.x, p.y, 'pin', 12);
      if (nd.fx) drawArrow(c, p.x - 42, p.y, p.x - 6, p.y, COL_WARN, 2.2, `${fmtFix(nd.fx, 0)}kN`);
      c.fillStyle = COL_FG; c.beginPath(); c.arc(p.x, p.y, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
      c.fillText(`D${idx + 1}`, p.x + 8, p.y - 6);
    });
  }, clean);

  function update() {
    curModel = buildFrameModel();
    st.sol = solveFrame2D(curModel);
    if (!st.sol.ok) return;
    const s = st.sol;
    const topNode = st.kind === 'twostorey' ? s.nodes[2] : s.nodes[1];
    renderKpis(kpis, [
      { lbl: 'Maks. Moment |M|', val: `${fmtFix(s.maxAbsM, 1)} kN·m`, tone: 'acc' },
      { lbl: 'Maks. Kesme |V|', val: `${fmtFix(s.maxAbsV, 1)} kN` },
      { lbl: 'Tepe Yanal Öteleme', val: `${fmtFix(Math.abs(topNode.uxMm), 2)} mm`, sub: `Δ/H = 1/${Math.round((st.H * 1000) / Math.max(0.01, Math.abs(topNode.uxMm)))}`, tone: 'ok' },
      { lbl: 'Taban Momenti M_A', val: `${fmtFix(s.nodes[0].mz, 1)} kN·m`, sub: `Ry = ${fmtFix(s.nodes[0].ry, 1)} kN` },
    ]);
    tbody.innerHTML = s.members.map((mb, idx) => `<tr>
      <td class="mono">E${idx + 1} (${mb.i + 1}→${mb.j + 1})</td>
      <td class="mono">${fmtFix(mb.L, 2)}</td>
      <td class="mono">${fmtFix(mb.N1, 1)}</td>
      <td class="mono">${fmtFix(mb.V1, 1)} / ${fmtFix(mb.V2, 1)}</td>
      <td class="mono">${fmtFix(mb.M1, 1)}</td>
      <td class="mono">${fmtFix(mb.M2, 1)}</td>
    </tr>`).join('');
    cv.render();
  }

  host.querySelector('[data-diag]').addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    st.diagram = b.dataset.d;
    host.querySelectorAll('[data-diag] button').forEach(x => x.classList.toggle('on', x === b));
    syncSegments(host, false); cv.render();
  });
  host.querySelector('[data-sup]').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    st.sup = b.dataset.s;
    host.querySelectorAll('[data-sup] button').forEach(x => x.classList.toggle('on', x === b));
    syncSegments(host, false); update();
  });
  bindPresets(host, FRAME_PRESETS, p => {
    Object.assign(st, p);
    sL.set(st.L); sH.set(st.H); sPlat.set(st.P_lat); sW.set(st.w_beam); sRat.set(st.ratioI);
    host.querySelectorAll('[data-sup] button').forEach(x => x.classList.toggle('on', x.dataset.s === st.sup));
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 4. MOHR DAİRESİ & GERİNİM ROZETİ (field: insaat)
// =====================================================================

const MOHR_PRESETS = [
  { label: 'Genel Düzlem Gerilme', mode: 'stress', sx: 100, sy: -30, txy: 60, theta: 20, syYield: 250 },
  { label: 'Saf Kayma (Burulma)',  mode: 'stress', sx: 0, sy: 0, txy: 110, theta: 45, syYield: 250 },
  { label: 'Tek Eksenli Çekme',    mode: 'stress', sx: 180, sy: 0, txy: 0, theta: 45, syYield: 250 },
  { label: '45° Gerinim Rozeti',   mode: 'rosette', rtype: 'rect', ea: 420, eb: 280, ec: -120, E_GPa: 200, nu: 0.3, syYield: 250 },
];

function mountMohrCircle(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'stress', sx: 100, sy: -30, txy: 60, theta: 20, syYield: 250,
    rtype: 'rect', ea: 420, eb: 280, ec: -120, E_GPa: 200, nu: 0.3,
    res: null, ros: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Düzlem gerilme durumunu veya 45°/60° gerinim rozeti okumalarını gir; <b>Mohr dairesi üzerinde sürükleyerek</b> eleman açısını θ döndür, asal gerilmeleri ve von Mises / Tresca akma sınırını canlı gör.', MOHR_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-mmode aria-label="Mohr modu">
        <button type="button" data-m="stress" class="on">Düzlem Gerilme</button>
        <button type="button" data-m="rosette">Gerinim Rozeti</button>
      </div>
      <span class="slc-badge" data-yield-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Mohr Dairesi (Açı için sürükle)</h4><span class="slc-hint mono" data-ang-lbl></span></div>
            <div class="slc-cv-box"><canvas class="slc-cv slc-cv-drag" data-cv-mohr aria-label="Etkileşimli Mohr dairesi"></canvas></div>
          </div>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Döndürülmüş Eleman & Akma Zarfı</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-elem aria-label="Döndürülmüş gerilme elemanı ve von Mises / Tresca zarfı"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\sigma_{1,2} = \\frac{\\sigma_x + \\sigma_y}{2} \\pm \\sqrt{\\left(\\frac{\\sigma_x - \\sigma_y}{2}\\right)^2 + \\tau_{xy}^2}, \\qquad \\tan 2\\theta_p = \\frac{2\\tau_{xy}}{\\sigma_x - \\sigma_y}',
        '\\sigma_{\\text{vM}} = \\sqrt{\\sigma_1^2 - \\sigma_1\\sigma_2 + \\sigma_2^2} \\le \\sigma_y, \\qquad \\sigma_{\\text{Tresca}} = \\max(|\\sigma_1-\\sigma_2|,|\\sigma_1|,|\\sigma_2|) \\le \\sigma_y',
      ],
      paragraphs: [
        'Fiziksel elemandaki $\\theta$ dönmesi Mohr dairesinde $2\\theta$ açısına karşılık gelir. Asal düzlemlerde kayma gerilmesi sıfırlanır ($\\tau_{x\'y\'} = 0$); bunlardan $45^\\circ$ döndürülmüş düzlemde ise düzlem içi maksimum kayma $\\tau_{\\max} = R$ oluşur.',
        'Tresca altıgeni daima von Mises elipsinin içinde kalır; dolayısıyla Tresca ölçütü daha tutucudur ve saf kaymada iki ölçüt arasındaki fark en büyüktür ($\\sigma_y/2$ vs $\\sigma_y/\\sqrt{3}$).',
      ],
      tasks: [
        '**Saf Kayma** senaryosunu seçip elemanı $\\theta = 45^\\circ$ döndürerek saf kaymanın $+\\tau$ ve $-\\tau$ asal çekme/basıncına eşdeğer olduğunu gör.',
        'Genel düzlem gerilmede $\\theta$ açısını asal açı $\\theta_p$ değerine getir ve $\\tau_{x\'y\'} = 0$ olduğunu doğrula.',
        'Akma gerilmesini $\\sigma_y$ düşürerek $(\\sigma_1, \\sigma_2)$ noktasının önce Tresca altıgenini, ardından von Mises elipsini aşmasını gözlemle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const yieldBadge = host.querySelector('[data-yield-badge]');
  const angLbl = host.querySelector('[data-ang-lbl]');

  const sSx = addSlider(ctrls, { label: 'Normal Gerilme σ_x', unit: 'MPa', min: -250, max: 250, step: 5, value: st.sx, onInput: v => { st.sx = v; update(); } });
  const sSy = addSlider(ctrls, { label: 'Normal Gerilme σ_y', unit: 'MPa', min: -250, max: 250, step: 5, value: st.sy, onInput: v => { st.sy = v; update(); } });
  const sTxy = addSlider(ctrls, { label: 'Kayma Gerilmesi τ_xy', unit: 'MPa', min: -200, max: 200, step: 5, value: st.txy, onInput: v => { st.txy = v; update(); } });
  const sTh = addSlider(ctrls, { label: 'Döndürme Açısı θ', unit: '°', min: -90, max: 90, step: 1, value: st.theta, onInput: v => { st.theta = v; update(); } });

  const selRtype = addSelect(ctrls, 'Rozet Geometrisi', [['rect', 'Dikdörtgen (0° / 45° / 90°)'], ['delta', 'Delta (0° / 60° / 120°)']], st.rtype, v => { st.rtype = v; update(); });
  const sEa = addSlider(ctrls, { label: 'Gerinim ε_a', unit: 'με', min: -1000, max: 1000, step: 10, value: st.ea, onInput: v => { st.ea = v; update(); } });
  const sEb = addSlider(ctrls, { label: 'Gerinim ε_b', unit: 'με', min: -1000, max: 1000, step: 10, value: st.eb, onInput: v => { st.eb = v; update(); } });
  const sEc = addSlider(ctrls, { label: 'Gerinim ε_c', unit: 'με', min: -1000, max: 1000, step: 10, value: st.ec, onInput: v => { st.ec = v; update(); } });
  const sE = addSlider(ctrls, { label: 'Elastisite Modülü E', unit: 'GPa', min: 50, max: 220, step: 5, value: st.E_GPa, onInput: v => { st.E_GPa = v; update(); } });
  const sNu = addSlider(ctrls, { label: 'Poisson Oranı ν', min: 0.15, max: 0.45, step: 0.01, value: st.nu, onInput: v => { st.nu = v; update(); } });

  const sYield = addSlider(ctrls, { label: 'Akma Dayanımı σ_akma', unit: 'MPa', min: 80, max: 500, step: 10, value: st.syYield, onInput: v => { st.syYield = v; update(); } });

  let circleGeom = { cx: 160, cy: 140, sc: 1, center: 0, radius: 100 };

  const cvMohr = setupCanvas(host.querySelector('[data-cv-mohr]'), w => Math.min(310, Math.max(240, w * 0.82)), (c, W, H) => {
    const m = st.res;
    if (!m) return;
    c.clearRect(0, 0, W, H);
    const maxCoord = Math.max(Math.abs(m.s1), Math.abs(m.s2), m.radius * 1.2, 40) * 1.25;
    const sc = Math.min((W - 60) / (2 * maxCoord), (H - 54) / (2 * maxCoord));
    const ox = W * 0.5, oy = H * 0.5;
    const toX = s => ox + s * sc;
    const toY = t => oy + t * sc; // positive clockwise shear downward (standard Mohr)
    const acc = accentColor();
    circleGeom = { cx: toX(m.center), cy: oy, sc, center: m.center, radius: m.radius };

    // Axes
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(14, oy); c.lineTo(W - 14, oy); c.moveTo(ox, 14); c.lineTo(ox, H - 14); c.stroke();
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
    c.textAlign = 'right'; c.fillText('σ (MPa)', W - 14, oy - 6);
    c.textAlign = 'left'; c.fillText('+τ (↓)', ox + 6, H - 14);

    // Mohr Circle
    const rPx = Math.max(2, m.radius * sc);
    c.strokeStyle = COL_FG; c.lineWidth = 2.2;
    c.beginPath(); c.arc(toX(m.center), oy, rPx, 0, Math.PI * 2); c.stroke();

    // Original diameter (sx, txy) to (sy, -txy)
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([4, 4]); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(toX(m.sx), toY(m.txy)); c.lineTo(toX(m.sy), toY(-m.txy)); c.stroke();
    c.setLineDash([]);

    // Rotated diameter (sxp, txyp) to (syp, -txyp)
    const px = toX(m.sxp), py = toY(m.txyp);
    const qx = toX(m.syp), qy = toY(-m.txyp);
    c.strokeStyle = acc; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.stroke();

    // Principal points
    for (const [val, lbl, col] of [[m.s1, 'σ₁', COL_OK], [m.s2, 'σ₂', COL_BLUE]]) {
      const x = toX(val);
      c.fillStyle = col; c.beginPath(); c.arc(x, oy, 4.5, 0, Math.PI * 2); c.fill();
      c.font = '600 10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`${lbl}=${fmtFix(val, 0)}`, x, oy - 10);
    }

    // Draggable handle at (sxp, txyp)
    c.fillStyle = acc; c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath(); c.arc(px, py, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = COL_FG; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillText(`X'(${fmtFix(m.sxp, 0)}, ${fmtFix(m.txyp, 0)})`, Math.min(W - 92, Math.max(10, px + 8)), py - 8);
  }, clean);

  bindDragCanvas(host.querySelector('[data-cv-mohr]'), {
    onDown: p => { updateAngleFromPt(p); return true; },
    onMove: (p, drag) => { if (drag) updateAngleFromPt(p); },
  }, clean);

  function updateAngleFromPt(p) {
    if (!st.res || st.res.radius < 1e-3) return;
    const dx = p.x - circleGeom.cx, dy = p.y - circleGeom.cy;
    const angNew = Math.atan2(dy, dx);
    const ang0 = Math.atan2(st.res.txy, 0.5 * (st.res.sx - st.res.sy));
    let d2Th = (ang0 - angNew) / RAD; // CCW rotation on Mohr
    while (d2Th > 180) d2Th -= 360;
    while (d2Th < -180) d2Th += 360;
    st.theta = Math.max(-90, Math.min(90, Math.round(d2Th * 0.5)));
    sTh.set(st.theta);
    update();
  }

  const cvElem = setupCanvas(host.querySelector('[data-cv-elem]'), w => Math.min(310, Math.max(240, w * 0.82)), (c, W, H) => {
    const m = st.res;
    if (!m) return;
    c.clearRect(0, 0, W, H);
    const acc = accentColor();

    // Top half: rotated square stress element
    const ex = W * 0.5, ey = H * 0.27;
    const box = 22;
    c.save();
    c.translate(ex, ey);
    c.rotate(-m.thetaDeg * RAD);
    c.fillStyle = 'rgba(255,255,255,.07)'; c.strokeStyle = COL_FG; c.lineWidth = 1.8;
    c.fillRect(-box, -box, box * 2, box * 2);
    c.strokeRect(-box, -box, box * 2, box * 2);
    const sNorm = Math.max(Math.abs(m.s1), Math.abs(m.s2), 40);
    const lenX = 12 + (Math.abs(m.sxp) / sNorm) * 24;
    const lenY = 12 + (Math.abs(m.syp) / sNorm) * 24;
    // x' face arrows
    if (m.sxp >= 0) {
      drawArrow(c, box + 2, 0, box + lenX, 0, COL_OK, 2);
      drawArrow(c, -box - 2, 0, -box - lenX, 0, COL_OK, 2);
    } else {
      drawArrow(c, box + lenX, 0, box + 2, 0, COL_BAD, 2);
      drawArrow(c, -box - lenX, 0, -box - 2, 0, COL_BAD, 2);
    }
    // y' face arrows
    if (m.syp >= 0) {
      drawArrow(c, 0, -box - 2, 0, -box - lenY, COL_BLUE, 2);
      drawArrow(c, 0, box + 2, 0, box + lenY, COL_BLUE, 2);
    } else {
      drawArrow(c, 0, -box - lenY, 0, -box - 2, COL_BAD, 2);
      drawArrow(c, 0, box + lenY, 0, box + 2, COL_BAD, 2);
    }
    // Shear arrows if nonzero
    if (Math.abs(m.txyp) > 1) {
      const sgn = m.txyp > 0 ? 1 : -1;
      drawArrow(c, box + 5, sgn * 12, box + 5, -sgn * 12, COL_WARN, 1.7);
      drawArrow(c, -box - 5, -sgn * 12, -box - 5, sgn * 12, COL_WARN, 1.7);
    }
    c.restore();

    // Bottom half: von Mises ellipse + Tresca hexagon in (sigma1, sigma2) plane
    const vx = W * 0.5, vy = H * 0.74;
    const sy = m.syYield;
    const lim = Math.max(sy * 1.35, Math.abs(m.s1) * 1.15, Math.abs(m.s2) * 1.15);
    const vsc = Math.min((W * 0.42) / lim, (H * 0.22) / lim);
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(vx - W * 0.44, vy); c.lineTo(vx + W * 0.44, vy); c.moveTo(vx, vy - H * 0.22); c.lineTo(vx, vy + H * 0.22); c.stroke();

    // von Mises ellipse: s1^2 - s1*s2 + s2^2 = sy^2
    c.strokeStyle = COL_OK; c.lineWidth = 1.6;
    c.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r = sy / Math.sqrt(1 - Math.sin(a) * Math.cos(a));
      const x = vx + r * Math.cos(a) * vsc, y = vy - r * Math.sin(a) * vsc;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath(); c.stroke();

    // Tresca hexagon
    const hex = [[sy, 0], [sy, sy], [0, sy], [-sy, 0], [-sy, -sy], [0, -sy]];
    c.strokeStyle = COL_WARN; c.setLineDash([4, 3]); c.lineWidth = 1.4;
    c.beginPath();
    hex.forEach(([s1, s2], i) => {
      const x = vx + s1 * vsc, y = vy - s2 * vsc;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    });
    c.closePath(); c.stroke(); c.setLineDash([]);

    // Current operating point (s1, s2)
    const ptX = vx + m.s1 * vsc, ptY = vy - m.s2 * vsc;
    c.fillStyle = m.safeVonMises ? acc : COL_BAD;
    c.strokeStyle = '#fff'; c.lineWidth = 1.8;
    c.beginPath(); c.arc(ptX, ptY, 5.2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillText('Yeşil: von Mises · Kesikli: Tresca', 10, H - 8);
  }, clean);

  function syncModeVis() {
    const isS = st.mode === 'stress';
    sSx.setVisible(isS); sSy.setVisible(isS); sTxy.setVisible(isS);
    selRtype.setVisible(!isS); sEa.setVisible(!isS); sEb.setVisible(!isS); sEc.setVisible(!isS);
    sE.setVisible(!isS); sNu.setVisible(!isS);
    host.querySelectorAll('[data-mmode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
  }

  function update() {
    if (st.mode === 'rosette') {
      st.ros = solveStrainRosette({ type: st.rtype, ea: st.ea, eb: st.eb, ec: st.ec, E_GPa: st.E_GPa, nu: st.nu, syYield: st.syYield });
      st.res = solveMohrStress({ sx: st.ros.stress.sx, sy: st.ros.stress.sy, txy: st.ros.stress.txy, thetaDeg: st.theta, syYield: st.syYield });
    } else {
      st.ros = null;
      st.res = solveMohrStress({ sx: st.sx, sy: st.sy, txy: st.txy, thetaDeg: st.theta, syYield: st.syYield });
    }
    const m = st.res;
    angLbl.textContent = `θ = ${fmtFix(m.thetaDeg, 1)}° · θ_p = ${fmtFix(m.thetaP, 1)}°`;
    const bothSafe = m.safeVonMises && m.safeTresca;
    yieldBadge.textContent = bothSafe ? `Güvenli (SF_vM=${fmtFix(m.sfVonMises, 2)})`
      : m.safeVonMises ? 'Tresca Aşıldı / vM Güvenli' : 'AKMA SINIRI AŞILDI!';
    yieldBadge.className = `slc-badge ${bothSafe ? 'slc-badge-ok' : m.safeVonMises ? 'slc-badge-warn' : 'slc-badge-bad'}`;

    const cards = [
      { lbl: 'Asal Gerilmeler σ₁ / σ₂', val: `${fmtFix(m.s1, 1)} / ${fmtFix(m.s2, 1)} MPa`, sub: `θ_p = ${fmtFix(m.thetaP, 1)}°`, tone: 'acc' },
      { lbl: 'Maks. Kayma τ_maks', val: `${fmtFix(m.tauMax2D, 1)} MPa`, sub: `3B τ_maks = ${fmtFix(m.tauMax3D, 1)} MPa` },
      { lbl: 'von Mises / Tresca', val: `${fmtFix(m.vonMises, 1)} / ${fmtFix(m.tresca, 1)} MPa`, sub: `SF: ${fmtFix(m.sfVonMises, 2)} / ${fmtFix(m.sfTresca, 2)}`, tone: bothSafe ? 'ok' : 'bad' },
    ];
    if (st.ros) {
      cards.push({ lbl: 'Asal Gerinim ε₁ / ε₂', val: `${fmtFix(st.ros.e1, 0)} / ${fmtFix(st.ros.e2, 0)} με`, sub: `γ_xy = ${fmtFix(st.ros.gxy, 0)} με` });
    } else {
      cards.push({ lbl: `Döndürülmüş (${fmtFix(m.thetaDeg, 0)}°)`, val: `σx'=${fmtFix(m.sxp, 1)}`, sub: `σy'=${fmtFix(m.syp, 1)} · τ'=${fmtFix(m.txyp, 1)} MPa` });
    }
    renderKpis(kpis, cards);
    cvMohr.render(); cvElem.render();
  }

  host.querySelector('[data-mmode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncModeVis(); update(); syncSegments(host, false);
  });
  bindPresets(host, MOHR_PRESETS, p => {
    Object.assign(st, p);
    sSx.set(st.sx); sSy.set(st.sy); sTxy.set(st.txy); sTh.set(st.theta); sYield.set(st.syYield);
    if (p.rtype) { selRtype.set(st.rtype); sEa.set(st.ea); sEb.set(st.eb); sEc.set(st.ec); sE.set(st.E_GPa); sNu.set(st.nu); }
    syncModeVis(); update();
  });

  bindTasks(host);
  syncModeVis();
  update();
  return clean.run;
}

// =====================================================================
// 5. KOLON BURKULMASI (EULER & JOHNSON) (field: insaat)
// =====================================================================

const BUCKLING_PRESETS = [
  { label: 'Narin Çelik Kolon (Euler)', bc: 'pin-pin', L_m: 6.0, E_GPa: 200, Sy_MPa: 250, b: 80, h: 100, P_kN: 220, mode: 1 },
  { label: 'Orta Narin (Johnson)',      bc: 'pin-pin', L_m: 2.2, E_GPa: 200, Sy_MPa: 250, b: 100, h: 120, P_kN: 1500, mode: 1 },
  { label: 'Bayrak Direği (K = 2)',     bc: 'fixed-free', L_m: 4.0, E_GPa: 200, Sy_MPa: 250, b: 90, h: 90, P_kN: 120, mode: 1 },
  { label: 'Çift Ankastre (K = 0.5)',   bc: 'fixed-fixed', L_m: 6.0, E_GPa: 200, Sy_MPa: 355, b: 80, h: 100, P_kN: 700, mode: 2 },
];

function mountColumnBuckling(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    bc: 'pin-pin', L_m: 6.0, E_GPa: 200, Sy_MPa: 250, b: 80, h: 100, P_kN: 220, mode: 1,
    playing: autoPlayAllowed(), phase: 0, sol: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Farklı mesnet koşulları için etkin burkulma boyu K·L, Euler kritik yükü ve kısa/orta kolonlarda <b>Johnson parabolünü</b> incele; burkulma mod şekillerini (n = 1, 2, 3) canlı izle.', BUCKLING_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-bc aria-label="Kolon mesnet koşulları">
        <button type="button" data-k="pin-pin" class="on">Mafsal–Mafsal (K=1)</button>
        <button type="button" data-k="fixed-free">Ank.–Serbest (K=2)</button>
        <button type="button" data-k="fixed-pin">Ank.–Mafsal (K=0.7)</button>
        <button type="button" data-k="fixed-fixed">Çift Ank. (K=0.5)</button>
      </div>
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Burkulma Mod Şekli</h4><span class="slc-badge" data-safe-badge></span></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-col aria-label="Animasyonlu kolon burkulma modu"></canvas></div>
          </div>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Kritik Gerilme σ_cr — Narinlik λ</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-curve aria-label="Euler ve Johnson burkulma eğrisi"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'P_{\\text{cr,Euler}} = \\frac{\\pi^2 E I_{\\min}}{(K L)^2}, \\qquad \\lambda = \\frac{K L}{r}, \\qquad r = \\sqrt{\\frac{I_{\\min}}{A}}',
        '\\lambda_c = \\sqrt{\\frac{2\\pi^2 E}{\\sigma_y}}, \\qquad \\sigma_{\\text{Johnson}} = \\sigma_y\\!\\left(1 - \\frac{\\sigma_y\\lambda^2}{4\\pi^2 E}\\right) \\quad (\\lambda < \\lambda_c)',
      ],
      paragraphs: [
        'Narin kolonlarda ($\\lambda \\ge \\lambda_c$) elastik burkulma akmadan önce gerçekleşir ve Euler hiperbolü geçerlidir. Kısa ve orta narin kolonlarda malzeme elastik ötesi davranışa geçtiği için Johnson parabolü $\\lambda = \\lambda_c$ noktasında $\\sigma_y/2$ değerinden Euler eğrisine teğet olarak bağlanır.',
        'Etkin boy katsayısı $K$, kritik yükü $1/K^2$ oranında etkiler: çift ankastre bir kolon aynı uzunluktaki mafsallı kolondan 4 kat, konsol kolondan ise 16 kat daha fazla elastik burkulma yükü taşır.',
      ],
      tasks: [
        'Mafsal–Mafsal ($K=1$) ile Çift Ankastre ($K=0.5$) arasında geçiş yapıp $P_{\\text{cr,Euler}}$ değerinin tam 4 kat arttığını doğrula.',
        'Kolon boyunu $L$ kısaltarak çalışma noktasını geçiş narinliği $\\lambda_c$ soluna (Johnson bölgesine) taşı ve $\\sigma_{\\text{cr}}$ değişimini gözle.',
        'Mod sayısını $n = 1, 2, 3$ değiştirerek yüksek modların büküm (düğüm) noktalarının nerede oluştuğunu incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const safeBadge = host.querySelector('[data-safe-badge]');
  const btnPlay = host.querySelector('[data-play]');

  const sL = addSlider(ctrls, { label: 'Kolon Boyu L', unit: 'm', min: 1.0, max: 10.0, step: 0.2, value: st.L_m, onInput: v => { st.L_m = v; update(); } });
  const sB = addSlider(ctrls, { label: 'Kesit Genişliği b', unit: 'mm', min: 30, max: 200, step: 5, value: st.b, onInput: v => { st.b = v; update(); } });
  const sH = addSlider(ctrls, { label: 'Kesit Yüksekliği h', unit: 'mm', min: 30, max: 240, step: 5, value: st.h, onInput: v => { st.h = v; update(); } });
  const sE = addSlider(ctrls, { label: 'Elastisite Modülü E', unit: 'GPa', min: 60, max: 220, step: 5, value: st.E_GPa, onInput: v => { st.E_GPa = v; update(); } });
  const sSy = addSlider(ctrls, { label: 'Akma Dayanımı σ_y', unit: 'MPa', min: 150, max: 500, step: 10, value: st.Sy_MPa, onInput: v => { st.Sy_MPa = v; update(); } });
  const sP = addSlider(ctrls, { label: 'Eksenel Yük P', unit: 'kN', min: 20, max: 2500, step: 10, value: st.P_kN, onInput: v => { st.P_kN = v; update(); } });
  const sMode = addSlider(ctrls, { label: 'Burkulma Modu n', min: 1, max: 3, step: 1, value: st.mode, onInput: v => { st.mode = Math.round(v); update(); } });

  const cvCol = setupCanvas(host.querySelector('[data-cv-col]'), () => 280, (c, W, H) => {
    const sol = st.sol;
    if (!sol) return;
    c.clearRect(0, 0, W, H);
    const cx = W * 0.5, topY = 44, botY = H - 34, spanY = botY - topY;
    const acc = accentColor();

    // Undeformed reference centerline
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.setLineDash([4, 4]); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx, topY); c.lineTo(cx, botY); c.stroke();
    c.setLineDash([]);

    // Buckled shape
    const modeData = sampleBucklingMode(st.bc, st.mode, 81);
    const baseAmp = sol.safe ? 18 : 38;
    const osc = isMotionOff() ? 1 : (isReduced() ? 0.85 : Math.sin(st.phase));
    const amp = baseAmp * osc;

    c.strokeStyle = sol.safe ? acc : COL_BAD; c.lineWidth = 4.5; c.lineCap = 'round';
    c.beginPath();
    modeData.xis.forEach((xi, i) => {
      const py = botY - xi * spanY;
      const px = cx + modeData.ys[i] * amp;
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    });
    c.stroke();

    // End conditions visual
    const botFixed = st.bc !== 'pin-pin';
    drawSupport(c, cx, botY, botFixed ? 'fixed-bottom' : 'pin', 13);
    const tipX = cx + modeData.ys[modeData.ys.length - 1] * amp;
    if (st.bc === 'fixed-fixed') drawSupport(c, cx, topY, 'fixed-bottom', 11);
    else if (st.bc === 'pin-pin' || st.bc === 'fixed-pin') {
      c.fillStyle = '#0b0b10'; c.strokeStyle = COL_FG; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, topY, 5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // Axial load arrow P at top
    drawArrow(c, tipX, 10, tipX, topY - 4, COL_WARN, 2.4);
    c.fillStyle = COL_WARN; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillText(`P = ${fmtFix(st.P_kN, 0)} kN`, tipX + 8, 22);
    c.fillStyle = COL_MUTE; c.textAlign = 'right';
    c.fillText(`Mod n=${st.mode} · K=${fmtFix(sol.K, 2)}`, W - 10, H - 10);
  }, clean);

  const cvCurve = setupCanvas(host.querySelector('[data-cv-curve]'), () => 280, (c, W, H) => {
    const sol = st.sol;
    if (!sol) return;
    c.clearRect(0, 0, W, H);
    const padL = 48, padR = 14, padT = 18, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;
    const maxLam = Math.max(220, sol.slenderness * 1.25, sol.lambdaC * 1.8);
    const maxSig = st.Sy_MPa * 1.25;
    const toX = lam => padL + (lam / maxLam) * pw;
    const toY = sig => padT + (1 - Math.min(maxSig, sig) / maxSig) * ph;
    const acc = accentColor();
    const E_MPa = st.E_GPa * 1000;

    // Grid & axes
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = padT + (ph * i) / 4;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke();
    }
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    // Yield line
    c.strokeStyle = 'rgba(255,209,102,.45)'; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(padL, toY(st.Sy_MPa)); c.lineTo(padL + pw, toY(st.Sy_MPa)); c.stroke();
    c.setLineDash([]);

    // Johnson parabola (0 .. lambdaC)
    c.strokeStyle = COL_OK; c.lineWidth = 2.4;
    c.beginPath();
    for (let i = 0; i <= 50; i++) {
      const lam = (sol.lambdaC * i) / 50;
      const sj = st.Sy_MPa * (1 - (st.Sy_MPa * lam * lam) / (4 * Math.PI * Math.PI * E_MPa));
      const x = toX(lam), y = toY(sj);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();

    // Euler hyperbola (lambdaC .. maxLam, plus dashed upper tail)
    c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
    c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const lam = sol.lambdaC + ((maxLam - sol.lambdaC) * i) / 60;
      const se = (Math.PI * Math.PI * E_MPa) / (lam * lam);
      const x = toX(lam), y = toY(se);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();

    // Transition marker lambda_c
    const xC = toX(sol.lambdaC), yC = toY(st.Sy_MPa * 0.5);
    c.strokeStyle = COL_DIM; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(xC, yC); c.lineTo(xC, padT + ph); c.stroke();
    c.setLineDash([]);
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText(`λc=${fmtFix(sol.lambdaC, 0)}`, xC, padT + ph + 14);

    // Operating point (slenderness, sigmaApplied) & critical point
    const ox = toX(sol.slenderness), oyCrit = toY(sol.sigmaCr), oyApp = toY(sol.sigmaApplied);
    c.fillStyle = acc; c.beginPath(); c.arc(ox, oyCrit, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = sol.safe ? COL_OK : COL_BAD; c.strokeStyle = '#fff'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(ox, oyApp, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();

    c.fillStyle = COL_MUTE; c.textAlign = 'right';
    c.fillText(`${fmtFix(st.Sy_MPa, 0)}`, padL - 5, toY(st.Sy_MPa) + 3);
    c.fillText('0', padL - 5, padT + ph + 3);
    c.textAlign = 'left'; c.fillText('σ_cr (MPa)', padL + 4, 13);
    c.textAlign = 'right'; c.fillText('Narinlik λ = KL/r', W - 10, H - 5);
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.phase += dt * 3.0;
    cvCol.render();
    return true;
  }, clean);

  function update() {
    st.sol = solveColumnBuckling({
      bc: st.bc, L_m: st.L_m, E_GPa: st.E_GPa, Sy_MPa: st.Sy_MPa,
      section: { type: 'rect', b: st.b, h: st.h }, P_kN: st.P_kN,
    });
    const s = st.sol;
    safeBadge.textContent = s.safe ? `Güvenli (SF=${fmtFix(s.SF, 2)})` : 'BURKULMA RİSKİ!';
    safeBadge.className = `slc-badge ${s.safe ? 'slc-badge-ok' : 'slc-badge-bad'}`;
    renderKpis(kpis, [
      { lbl: 'Kritik Yük P_cr', val: `${fmtFix(s.Pcr_kN, 1)} kN`, sub: s.regime, tone: 'acc' },
      { lbl: 'Narinlik λ = KL/r', val: fmtFix(s.slenderness, 1), sub: `λ_c = ${fmtFix(s.lambdaC, 1)} · r = ${fmtFix(s.r_mm, 1)} mm` },
      { lbl: 'Kritik Gerilme σ_cr', val: `${fmtFix(s.sigmaCr, 1)} MPa`, sub: `Uygulanan: ${fmtFix(s.sigmaApplied, 1)} MPa` },
      { lbl: 'Güvenlik Katsayısı', val: fmtFix(s.SF, 2), sub: `P_y = ${fmtFix(s.Py_kN, 0)} kN`, tone: s.safe ? 'ok' : 'bad' },
    ]);
    cvCol.render(); cvCurve.render();
  }

  host.querySelector('[data-bc]').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    st.bc = b.dataset.k;
    host.querySelectorAll('[data-bc] button').forEach(x => x.classList.toggle('on', x === b));
    syncSegments(host, false); update();
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing;
    syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.phase = 0; cvCol.render(); });

  bindPresets(host, BUCKLING_PRESETS, p => {
    Object.assign(st, p);
    sL.set(st.L_m); sB.set(st.b); sH.set(st.h); sE.set(st.E_GPa); sSy.set(st.Sy_MPa); sP.set(st.P_kN); sMode.set(st.mode);
    host.querySelectorAll('[data-bc] button').forEach(x => x.classList.toggle('on', x.dataset.k === st.bc));
    update();
  });

  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 6. DEPREM TEPKİSİ (NEWMARK-BETA & KAYMA BİNASI) (field: insaat)
// =====================================================================

const SEISMIC_PRESETS = [
  { label: 'Sentetik Deprem (T=0.6s)', mode: 'sdof', eqKind: 'elcentro', Tn: 0.6, zeta: 0.05, pgaG: 0.35, fHarm: 1.6 },
  { label: 'Harmonik Rezonans',        mode: 'sdof', eqKind: 'harmonic', Tn: 0.625, zeta: 0.04, pgaG: 0.15, fHarm: 1.6 },
  { label: 'Sismik İzolasyon (T=2.5s)', mode: 'sdof', eqKind: 'elcentro', Tn: 2.5, zeta: 0.15, pgaG: 0.35, fHarm: 1.6 },
  { label: '4 Katlı Yumuşak Kat',      mode: 'mdof', nFloors: 4, softFloor: true, modeIdx: 0 },
];

function mountSeismicResponse(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'sdof', eqKind: 'elcentro', Tn: 0.6, zeta: 0.05, pgaG: 0.35, fHarm: 1.6,
    nFloors: 4, softFloor: false, modeIdx: 0,
    playing: autoPlayAllowed(), simTime: 0,
    gm: null, resp: null, spec: null, mdof: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Tek serbestlik dereceli (1-DOF) yapının yer ivmesi altındaki zaman tanım alanı tepkisini <b>Newmark-β</b> yöntemiyle çöz, elastik tepki spektrumunu canlı oluştur veya çok katlı kayma binasının doğal modlarını incele.', SEISMIC_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-smode aria-label="Deprem analiz modu">
        <button type="button" data-m="sdof" class="on">1-DOF & Tepki Spektrumu</button>
        <button type="button" data-m="mdof">Çok Katlı Bina Modları</button>
      </div>
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Başa sar</button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title" data-left-title>Canlı Yapı Salınımı</h4><span class="slc-hint mono" data-time-lbl></span></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-bldg aria-label="Bina deprem salınım animasyonu"></canvas></div>
          </div>
          <div class="slc-plot-card" data-box-spec>
            <div class="slc-head"><h4 class="slc-title" data-right-title>Elastik Tepki Spektrumu Sa(T)</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-spec aria-label="Deprem tepki spektrumu"></canvas><div class="slc-readout" data-rd-spec></div></div>
          </div>
        </div>
        <div class="slc-plot-card" data-box-hist>
          <div class="slc-head"><h4 class="slc-title">Zaman Tanım Alanı: Göreli Yer Değiştirme u(t) (cm)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-hist aria-label="Yer değiştirme zaman grafiği"></canvas><div class="slc-readout" data-rd-hist></div></div>
        </div>
        <div class="slc-table-wrap" data-mdof-tbl hidden>
          <table class="slc-tbl" aria-label="Çok katlı bina modal analiz sonuçları">
            <thead><tr><th>Mod</th><th>Periyot T (s)</th><th>Frekans f (Hz)</th><th>Katılım Γ</th><th>Etkin Kütle (%)</th></tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\ddot{u} + 2\\zeta\\omega_n \\dot{u} + \\omega_n^2 u = -\\ddot{u}_g(t), \\qquad S_a(T_n) = \\omega_n^2 S_d(T_n)',
        '\\mathbf{K}\\boldsymbol{\\phi}_r = \\omega_r^2 \\mathbf{M}\\boldsymbol{\\phi}_r, \\qquad M_r^* = \\frac{(\\boldsymbol{\\phi}_r^T \\mathbf{M}\\mathbf{1})^2}{\\boldsymbol{\\phi}_r^T \\mathbf{M}\\boldsymbol{\\phi}_r}',
      ],
      paragraphs: [
        'Ortalama ivmeli Newmark-$\\beta$ ($\\gamma = 1/2, \\beta = 1/4$) şeması koşulsuz kararlıdır ve her periyot $T_n$ için pik göreli yer değiştirmeyi $S_d = \\max|u(t)|$ hesaplayarak spektral ivme eğrisini $S_a(T)$ üretir.',
        'Sismik taban izolasyonu yapının periyodunu $T_n \\approx 2.5\\text{ s}$ düzeyine uzatır; böylece spektral ivme (taban kesme kuvveti) dramatik biçimde düşer.',
      ],
      tasks: [
        '**Harmonik Rezonans** senaryosunda sönüm oranını $\\zeta = 0.02$ ile $0.15$ arasında değiştirerek rezonans genliğinin $1/(2\\zeta)$ ile ters orantılı olduğunu doğrula.',
        '**Sentetik Deprem** kaydında periyodu $T_n = 0.6\\text{ s}$ değerinden $2.5\\text{ s}$ değerine (sismik izolasyon) kaydırıp $S_a$ düşüşünü ve $S_d$ artışını gözlemle.',
        '**Çok Katlı Bina Modları** sekmesinde **Yumuşak zemin kat** seçeneğini açarak 1. mod şeklinin alt katta nasıl yoğunlaştığını ve tüm modların etkin kütle toplamının %100 olduğunu gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const timeLbl = host.querySelector('[data-time-lbl]');
  const btnPlay = host.querySelector('[data-play]');
  const cvSpec = host.querySelector('[data-cv-spec]');
  const cvHist = host.querySelector('[data-cv-hist]');
  const boxHist = host.querySelector('[data-box-hist]');
  const mdofTbl = host.querySelector('[data-mdof-tbl]');
  const tbody = host.querySelector('[data-tbody]');

  const selEq = addSelect(ctrls, 'Yer Hareketi Kaydı', [
    ['elcentro', 'Sentetik Geniş Bantlı Deprem'],
    ['pulse', 'Yakın Fay Darbe (Ricker)'],
    ['harmonic', 'Harmonik Sinüs Zemin'],
  ], st.eqKind, v => { st.eqKind = v; syncModeVis(); recomputeRecord(); });
  const sTn = addSlider(ctrls, { label: 'Doğal Periyot T_n', unit: 's', min: 0.1, max: 3.5, step: 0.05, value: st.Tn, onInput: v => { st.Tn = v; recomputeSDOF(); } });
  const sZeta = addSlider(ctrls, { label: 'Sönüm Oranı ζ', min: 0.01, max: 0.30, step: 0.01, value: st.zeta, onInput: v => { st.zeta = v; recomputeRecord(); } });
  const sPga = addSlider(ctrls, { label: 'Pik Yer İvmesi PGA', unit: 'g', min: 0.05, max: 0.80, step: 0.05, value: st.pgaG, onInput: v => { st.pgaG = v; recomputeRecord(); } });
  const sFharm = addSlider(ctrls, { label: 'Zemin Frekansı f_g', unit: 'Hz', min: 0.4, max: 4.0, step: 0.1, value: st.fHarm, onInput: v => { st.fHarm = v; recomputeRecord(); } });

  const sFloors = addSlider(ctrls, { label: 'Kat Sayısı N', min: 2, max: 5, step: 1, value: st.nFloors, onInput: v => {
    st.nFloors = Math.round(v);
    st.modeIdx = Math.min(st.modeIdx, st.nFloors - 1);
    sModeIdx.setRange(1, st.nFloors);
    sModeIdx.set(st.modeIdx + 1);
    recomputeMDOF();
  } });
  const sModeIdx = addSlider(ctrls, { label: 'Görüntülenen Mod', min: 1, max: st.nFloors, step: 1, value: 1, onInput: v => { st.modeIdx = Math.min(st.nFloors - 1, Math.round(v) - 1); cvBldg.render(); } });
  const tSoft = addToggle(ctrls, 'Yumuşak zemin kat (k₁ = 0.35·k)', st.softFloor, v => { st.softFloor = v; recomputeMDOF(); });

  const cvBldg = setupCanvas(host.querySelector('[data-cv-bldg]'), () => 255, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const baseY = H - 28, cx = W * 0.5;

    // Ground slab
    c.strokeStyle = COL_AXIS; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, baseY); c.lineTo(W - 20, baseY); c.stroke();

    if (st.mode === 'sdof' && st.resp && st.gm) {
      const idx = Math.min(st.gm.t.length - 1, Math.floor(st.simTime / st.gm.dt));
      const uVal = st.resp.u[idx] || 0;
      const maxU = Math.max(st.resp.maxU, 0.01);
      const dxPx = (uVal / maxU) * Math.min(54, W * 0.2);
      const colH = H - 86, colW = 54;
      const topY = baseY - colH;

      // Two flexible columns (cubic S-curve)
      c.strokeStyle = COL_FG; c.lineWidth = 3;
      for (const side of [-colW / 2, colW / 2]) {
        c.beginPath();
        c.moveTo(cx + side, baseY);
        c.bezierCurveTo(cx + side, baseY - colH * 0.45, cx + side + dxPx, topY + colH * 0.45, cx + side + dxPx, topY);
        c.stroke();
      }
      // Roof mass slab
      c.fillStyle = acc; c.strokeStyle = '#fff'; c.lineWidth = 1.6;
      c.fillRect(cx - colW * 0.72 + dxPx, topY - 12, colW * 1.44, 16);
      c.strokeRect(cx - colW * 0.72 + dxPx, topY - 12, colW * 1.44, 16);
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`u = ${fmtFix(uVal * 100, 2)} cm`, cx + dxPx, topY - 20);
      timeLbl.textContent = `t = ${fmtFix(st.gm.t[idx], 2)} s`;
    } else if (st.mode === 'mdof' && st.mdof) {
      const m = st.mdof.modes[st.modeIdx] || st.mdof.modes[0];
      const N = st.mdof.N;
      const osc = isMotionOff() ? 1 : Math.sin(st.simTime * Math.min(10, m.omega * 0.7));
      const storyH = (H - 64) / N;
      const colW = 64, maxDx = Math.min(48, W * 0.18);

      let prevX = cx, prevY = baseY;
      for (let i = 0; i < N; i++) {
        const y = baseY - (i + 1) * storyH;
        const x = cx + m.phi[i] * osc * maxDx;
        c.strokeStyle = (i === 0 && st.softFloor) ? COL_BAD : COL_FG;
        c.lineWidth = (i === 0 && st.softFloor) ? 2 : 3;
        for (const side of [-colW / 2, colW / 2]) {
          c.beginPath();
          c.moveTo(prevX + side, prevY);
          c.bezierCurveTo(prevX + side, prevY - storyH * 0.4, x + side, y + storyH * 0.4, x + side, y);
          c.stroke();
        }
        c.fillStyle = acc;
        c.fillRect(x - colW * 0.65, y - 5, colW * 1.3, 10);
        c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'left';
        c.fillText(`K${i + 1}: ${fmtFix(m.phi[i], 2)}`, x + colW * 0.72, y + 3);
        prevX = x; prevY = y;
      }
      timeLbl.textContent = `Mod ${m.mode} · T=${fmtFix(m.period, 2)} s`;
    }
  }, clean);

  function drawPlots() {
    if (st.mode === 'sdof' && st.spec && st.resp && st.gm) {
      safePlot(cvSpec, [
        { name: 'Sa(T)', color: accentColor(), xs: st.spec.periods, ys: st.spec.SaG },
        { name: 'Yapı', color: COL_BAD, xs: [st.Tn, st.Tn], ys: [0, st.resp.SaG] },
      ], { x0: 0, x1: 4.0, ylabel: 'Sa (g)', height: 240 });
      safePlot(cvHist, [
        { name: 'u(t)', color: COL_BLUE, xs: st.gm.t, ys: st.resp.u.map(v => v * 100) },
      ], { x0: 0, x1: st.gm.t[st.gm.t.length - 1], ylabel: 'u (cm)', height: 175 });
    } else if (st.mode === 'mdof' && st.mdof) {
      const xs = st.mdof.modes.map(m => m.mode);
      const ys = st.mdof.modes.map(m => m.effMassRatio * 100);
      safePlot(cvSpec, [
        { name: 'Etkin Kütle %', color: COL_OK, xs, ys },
      ], { x0: 0.5, x1: st.mdof.N + 0.5, ylabel: 'Kütle (%)', height: 240 });
    }
  }

  function recomputeSDOF() {
    if (!st.gm) return;
    st.resp = newmarkSDOF({ Tn: st.Tn, zeta: st.zeta, ag: st.gm.ag, dt: st.gm.dt });
    renderKpis(kpis, [
      { lbl: 'Spektral İvme Sa', val: `${fmtFix(st.resp.SaG, 3)} g`, sub: `PGA = ${fmtFix(st.pgaG, 2)} g`, tone: 'acc' },
      { lbl: 'Maks. Yer Değiştirme Sd', val: `${fmtFix(st.resp.maxU * 100, 2)} cm`, sub: `Sv = ${fmtFix(st.resp.Sv * 100, 1)} cm/s` },
      { lbl: 'Maks. Mutlak İvme', val: `${fmtFix(st.resp.maxAbsA / G0, 3)} g`, sub: `Büyütme: ${fmtFix(st.resp.SaG / st.pgaG, 2)}×` },
      { lbl: 'Doğal Frekans fn', val: `${fmtFix(1 / st.Tn, 2)} Hz`, sub: `ωn = ${fmtFix(st.resp.wn, 2)} rad/s` },
    ]);
    drawPlots(); cvBldg.render();
  }

  function recomputeRecord() {
    st.gm = syntheticGroundMotion({ kind: st.eqKind, pgaG: st.pgaG, duration: 10, dt: 0.01, fHarmonic: st.fHarm });
    st.spec = computeResponseSpectrum({ ag: st.gm.ag, dt: st.gm.dt, zeta: st.zeta });
    recomputeSDOF();
  }

  function recomputeMDOF() {
    const masses = Array.from({ length: st.nFloors }, () => 120);
    const stiffnesses = Array.from({ length: st.nFloors }, (_, i) => (i === 0 && st.softFloor ? 16000 : 45000));
    st.mdof = solveShearBuildingModes({ masses, stiffnesses });
    const m = st.mdof.modes[st.modeIdx] || st.mdof.modes[0];
    renderKpis(kpis, [
      { lbl: '1. Hakim Periyot T₁', val: `${fmtFix(st.mdof.modes[0].period, 3)} s`, sub: `f₁ = ${fmtFix(st.mdof.modes[0].freqHz, 2)} Hz`, tone: 'acc' },
      { lbl: `Seçili Mod (Mod ${m.mode})`, val: `T = ${fmtFix(m.period, 3)} s`, sub: `Γ = ${fmtFix(m.gamma, 2)}` },
      { lbl: 'Mod Etkin Kütlesi', val: `%${fmtFix(m.effMassRatio * 100, 1)}`, sub: `${fmtFix(m.effMass, 0)} / ${st.mdof.totalMass} ton`, tone: 'ok' },
      { lbl: 'Toplam Kütle Katılımı', val: '%100.0', sub: `${st.nFloors} serbestlik derecesi` },
    ]);
    tbody.innerHTML = st.mdof.modes.map(md => `<tr>
      <td class="mono">Mod ${md.mode}</td>
      <td class="mono">${fmtFix(md.period, 3)}</td>
      <td class="mono">${fmtFix(md.freqHz, 2)}</td>
      <td class="mono">${fmtFix(md.gamma, 3)}</td>
      <td class="mono">%${fmtFix(md.effMassRatio * 100, 1)}</td>
    </tr>`).join('');
    drawPlots(); cvBldg.render();
  }

  function syncModeVis() {
    const isS = st.mode === 'sdof';
    selEq.setVisible(isS); sTn.setVisible(isS); sZeta.setVisible(isS); sPga.setVisible(isS);
    sFharm.setVisible(isS && st.eqKind !== 'elcentro');
    sFloors.setVisible(!isS); sModeIdx.setVisible(!isS); tSoft.setVisible(!isS);
    boxHist.hidden = !isS;
    mdofTbl.hidden = isS;
    host.querySelector('[data-right-title]').textContent = isS ? 'Elastik Tepki Spektrumu Sa(T)' : 'Modlara Göre Etkin Kütle (%)';
    host.querySelectorAll('[data-smode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.simTime += dt;
    if (st.mode === 'sdof' && st.gm && st.simTime > st.gm.t[st.gm.t.length - 1]) st.simTime = 0;
    cvBldg.render();
    return true;
  }, clean);

  host.querySelector('[data-smode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; st.simTime = 0;
    syncModeVis();
    if (st.mode === 'sdof') recomputeRecord(); else recomputeMDOF();
    syncSegments(host, false);
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.simTime = 0; cvBldg.render(); });

  bindPresets(host, SEISMIC_PRESETS, p => {
    Object.assign(st, p); st.simTime = 0;
    selEq.set(st.eqKind); sTn.set(st.Tn); sZeta.set(st.zeta); sPga.set(st.pgaG); sFharm.set(st.fHarm);
    sFloors.set(st.nFloors); sModeIdx.set(st.modeIdx + 1); tSoft.set(st.softFloor);
    syncModeVis();
    if (st.mode === 'sdof') recomputeRecord(); else recomputeMDOF();
  });

  attachReadout(cvSpec, host.querySelector('[data-rd-spec]'), (x, ser, i) => st.mode === 'sdof' ? `T=${fmtFix(x, 2)} s · Sa=${fmtFix(ser[0].ys[i], 3)} g` : `Mod ${Math.round(x)} · %${fmtFix(ser[0].ys[i], 1)}`, clean);
  attachReadout(cvHist, host.querySelector('[data-rd-hist]'), (x, ser, i) => `t=${fmtFix(x, 2)} s · u=${fmtFix(ser[0].ys[i], 2)} cm`, clean);
  observeResize(host.querySelector('[data-box-spec]'), drawPlots, clean);

  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  syncModeVis();
  recomputeRecord();
  return clean.run;
}

// =====================================================================
// 7. ZEMİN MEKANİĞİ (field: insaat)
// =====================================================================

const SOIL_PRESETS = [
  { label: 'Kil Konsolidasyonu (U≈%50)', tab: 'consol', cv: 0.6, Hdr: 3.0, dSigma: 120, t_days: 1080, doubleDrain: true },
  { label: 'Üç Eksenli Kum (φ=35°)',     tab: 'mc', c: 0, phiDeg: 35, sigma: 220, poreP: 40, sigma3: 100 },
  { label: 'Kare Temel Taşıma Gücü',     tab: 'bearing', B: 2.5, Df: 1.5, gamma: 19, c: 20, phiDeg: 30, shape: 'square', FS: 3 },
  { label: 'Yeraltı Sulu İstinat Duvarı', tab: 'rankine', H: 6.0, gamma: 18, phiDeg: 30, c: 0, qs: 15, zw: 3.0 },
];

function mountSoilMechanics(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'consol',
    cv: 0.6, Hdr: 3.0, dSigma: 120, t_days: 1080, doubleDrain: true,
    c: 15, phiDeg: 30, sigma: 200, poreP: 40, sigma3: 100,
    B: 2.5, Df: 1.5, gamma: 18.5, shape: 'strip', FS: 3.0,
    H: 6.0, qs: 15, zw: 4.0,
    playing: false,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Geoteknik mühendisliğinin 4 temel modelini etkileşimli incele: <b>Terzaghi 1B konsolidasyon</b> (izokronlar ve U–Tv), <b>Mohr–Coulomb</b> kayma dayanımı, <b>Terzaghi taşıma gücü</b> ve <b>Rankine yanal toprak basıncı</b>.', SOIL_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-stab aria-label="Zemin mekaniği konusu">
        <button type="button" data-t="consol" class="on">Konsolidasyon</button>
        <button type="button" data-t="mc">Mohr–Coulomb</button>
        <button type="button" data-t="bearing">Taşıma Gücü</button>
        <button type="button" data-t="rankine">Rankine Duvar</button>
      </div>
      <button type="button" class="btn small" data-play hidden aria-pressed="false"></button>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title" data-cv-title>Aşırı Boşluk Suyu Basıncı İzokronu u(z, t)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-main aria-label="Zemin mekaniği diyagramı"></canvas></div>
        </div>
        <div class="slc-plot-card" data-box-sub>
          <div class="slc-head"><h4 class="slc-title">Konsolidasyon Derecesi U (%) — Zaman Faktörü T_v</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-sub aria-label="U-Tv eğrisi"></canvas><div class="slc-readout" data-rd-sub></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{\\partial u}{\\partial t} = c_v \\frac{\\partial^2 u}{\\partial z^2}, \\qquad T_v = \\frac{c_v t}{H_{dr}^2}, \\qquad U(T_v) = 1 - \\sum_{m=0}^{\\infty}\\frac{2}{M_m^2}e^{-M_m^2 T_v}',
        '\\tau_f = c + (\\sigma - u_w)\\tan\\phi, \\qquad q_u = s_c c N_c + \\gamma D_f N_q + s_\\gamma \\gamma B N_\\gamma',
        'K_a = \\tan^2\\!\\left(45^\\circ - \\frac{\\phi}{2}\\right), \\qquad K_p = \\tan^2\\!\\left(45^\\circ + \\frac{\\phi}{2}\\right) = \\frac{1}{K_a}',
      ],
      paragraphs: [
        'Terzaghi 1B konsolidasyonunda $T_v = 0.197$ anında oturmanın %50\'si, $T_v = 0.848$ anında ise %90\'ı tamamlanır; drenaj yolu $H_{dr}$ yarıya indiğinde (çift yönlü drenaj) konsolidasyon süresi 4 kat kısalır.',
        'Rankine istinat duvarında yeraltı su seviyesi $z_w$ yükseldikçe efektif yanal toprak basıncı azalmasına karşın hidrostatik su basıncı $\\gamma_w(z-z_w)$ eklendiğinden toplam itki $P_a$ ciddi biçimde artar.',
      ],
      tasks: [
        '**Konsolidasyon** sekmesinde zamanı $t_{50}$ gün değerine getirip $T_v \\approx 0.197$ ve $U \\approx \\%50$ olduğunu gözlemle.',
        '**Taşıma Gücü** sekmesinde $\\phi = 0^\\circ$ (drenajsız kil) yapıp $N_c = 5.7, N_q = 1, N_\\gamma = 0$ sınırını doğrula.',
        '**Rankine Duvar** sekmesinde yeraltı su derinliğini $z_w = 6\\text{ m}$ (kuru) değerinden $z_w = 1\\text{ m}$ değerine çekip toplam yanal itki $P_a$ artışını ölç.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cvTitle = host.querySelector('[data-cv-title]');
  const boxSub = host.querySelector('[data-box-sub]');
  const cvSub = host.querySelector('[data-cv-sub]');
  const btnPlay = host.querySelector('[data-play]');

  // Controls per tab
  const sCv = addSlider(ctrls, { label: 'Konsolidasyon Katsayısı c_v', unit: 'm²/yıl', min: 0.1, max: 5.0, step: 0.1, value: st.cv, onInput: v => { st.cv = v; update(); } });
  const sHdr = addSlider(ctrls, { label: 'Drenaj Yolu H_dr', unit: 'm', min: 1.0, max: 8.0, step: 0.25, value: st.Hdr, onInput: v => { st.Hdr = v; update(); } });
  const sDsig = addSlider(ctrls, { label: 'Ek Yük Δσ₀', unit: 'kPa', min: 20, max: 300, step: 10, value: st.dSigma, onInput: v => { st.dSigma = v; update(); } });
  const sTdays = addSlider(ctrls, { label: 'Geçen Süre t', unit: 'gün', min: 1, max: 5000, step: 10, value: st.t_days, onInput: v => { st.t_days = v; update(); } });
  const tDbl = addToggle(ctrls, 'Çift yönlü drenaj (üst + alt)', st.doubleDrain, v => { st.doubleDrain = v; update(); });

  const sC = addSlider(ctrls, { label: 'Kohezyon c', unit: 'kPa', min: 0, max: 80, step: 2, value: st.c, onInput: v => { st.c = v; update(); } });
  const sPhi = addSlider(ctrls, { label: 'İçsel Sürtünme Açısı φ', unit: '°', min: 0, max: 45, step: 1, value: st.phiDeg, onInput: v => { st.phiDeg = v; update(); } });
  const sSig = addSlider(ctrls, { label: 'Toplam Normal Gerilme σ', unit: 'kPa', min: 40, max: 400, step: 10, value: st.sigma, onInput: v => { st.sigma = v; update(); } });
  const sUw = addSlider(ctrls, { label: 'Boşluk Suyu Basıncı u_w', unit: 'kPa', min: 0, max: 180, step: 5, value: st.poreP, onInput: v => { st.poreP = v; update(); } });
  const sSig3 = addSlider(ctrls, { label: 'Çevre Basıncı σ\'₃', unit: 'kPa', min: 20, max: 250, step: 10, value: st.sigma3, onInput: v => { st.sigma3 = v; update(); } });

  const sB = addSlider(ctrls, { label: 'Temel Genişliği B', unit: 'm', min: 0.8, max: 6.0, step: 0.2, value: st.B, onInput: v => { st.B = v; update(); } });
  const sDf = addSlider(ctrls, { label: 'Temel Derinliği D_f', unit: 'm', min: 0.5, max: 4.0, step: 0.25, value: st.Df, onInput: v => { st.Df = v; update(); } });
  const sGam = addSlider(ctrls, { label: 'Birim Hacim Ağırlık γ', unit: 'kN/m³', min: 14, max: 22, step: 0.5, value: st.gamma, onInput: v => { st.gamma = v; update(); } });
  const selShape = addSelect(ctrls, 'Temel Biçimi', [['strip', 'Sürekli (Şerit)'], ['square', 'Kare (B × B)'], ['circular', 'Dairesel (Çap B)']], st.shape, v => { st.shape = v; update(); });
  const sFS = addSlider(ctrls, { label: 'Güvenlik Katsayısı FS', min: 1.5, max: 4.5, step: 0.25, value: st.FS, onInput: v => { st.FS = v; update(); } });

  const sH = addSlider(ctrls, { label: 'Duvar Yüksekliği H', unit: 'm', min: 2.0, max: 10.0, step: 0.5, value: st.H, onInput: v => { st.H = v; sZw.setRange(0, v); update(); } });
  const sQs = addSlider(ctrls, { label: 'Sürşarj Yükü q_s', unit: 'kPa', min: 0, max: 60, step: 2, value: st.qs, onInput: v => { st.qs = v; update(); } });
  const sZw = addSlider(ctrls, { label: 'Yeraltı Su Derinliği z_w', unit: 'm', min: 0, max: 6.0, step: 0.25, value: st.zw, onInput: v => { st.zw = v; update(); } });

  let computed = null;
  const cvMain = setupCanvas(host.querySelector('[data-cv-main]'), w => Math.min(310, Math.max(240, w * 0.56)), (c, W, H) => {
    if (!computed) return;
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const padL = 52, padR = 24, padT = 22, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;

    if (st.tab === 'consol') {
      const r = computed;
      const zMax = r.z[r.z.length - 1];
      const toX = u => padL + (u / Math.max(1, st.dSigma)) * pw;
      const toY = z => padT + (z / zMax) * ph;

      // Clay layer shading
      c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(padL, padT, pw, ph);
      c.strokeStyle = COL_AXIS; c.lineWidth = 1.2; c.strokeRect(padL, padT, pw, ph);

      // Reference isochrones at Tv = 0.05, 0.2, 0.5, 1.0
      for (const tvRef of [0.05, 0.2, 0.5, 1.0]) {
        const ref = terzaghiConsolidation({ cv: st.cv, Hdr: st.Hdr, dSigma: st.dSigma, t_days: (tvRef * st.Hdr * st.Hdr / st.cv) * 365.25, doubleDrain: st.doubleDrain });
        c.strokeStyle = 'rgba(255,255,255,.16)'; c.setLineDash([3, 3]); c.lineWidth = 1.2;
        c.beginPath();
        ref.z.forEach((zv, i) => { i === 0 ? c.moveTo(toX(ref.uExcess[i]), toY(zv)) : c.lineTo(toX(ref.uExcess[i]), toY(zv)); });
        c.stroke();
      }
      c.setLineDash([]);

      // Active isochrone shaded
      c.fillStyle = acc; c.globalAlpha = 0.22;
      c.beginPath(); c.moveTo(padL, padT);
      r.z.forEach((zv, i) => c.lineTo(toX(r.uExcess[i]), toY(zv)));
      c.lineTo(padL, padT + ph); c.closePath(); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = acc; c.lineWidth = 2.6;
      c.beginPath();
      r.z.forEach((zv, i) => { i === 0 ? c.moveTo(toX(r.uExcess[i]), toY(zv)) : c.lineTo(toX(r.uExcess[i]), toY(zv)); });
      c.stroke();

      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
      c.textAlign = 'left'; c.fillText(`u (kPa) · Δσ₀=${st.dSigma}`, padL, 14);
      c.textAlign = 'right'; c.fillText(`z=0`, padL - 6, padT + 4);
      c.fillText(`${fmtFix(zMax, 1)}m`, padL - 6, padT + ph + 4);
      c.fillText(`Tv=${fmtFix(r.Tv, 3)} · U=%${fmtFix(r.U_pct, 1)}`, W - padR, H - 8);
    } else if (st.tab === 'mc') {
      const r = computed;
      const maxS = Math.max(r.sigma1EffFail * 1.2, r.sigmaEff * 1.3, 250);
      const maxT = Math.max(r.tauF * 1.4, r.circleRadius * 1.5, 100);
      const sc = Math.min(pw / maxS, ph / maxT);
      const toX = s => padL + s * sc;
      const toY = t => padT + ph - t * sc;

      c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

      // Failure envelope tau = c + sigma' tan(phi)
      c.strokeStyle = COL_BAD; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(toX(0), toY(r.c)); c.lineTo(toX(maxS), toY(r.c + maxS * Math.tan(r.phiDeg * RAD))); c.stroke();

      // Triaxial Mohr circle at failure
      c.strokeStyle = acc; c.lineWidth = 2.2;
      c.beginPath(); c.arc(toX(r.circleCenter), toY(0), r.circleRadius * sc, Math.PI, 0); c.stroke();

      // Effective normal stress point
      c.fillStyle = COL_OK; c.beginPath(); c.arc(toX(r.sigmaEff), toY(r.tauF), 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
      c.textAlign = 'left'; c.fillText(`τ_f = ${fmtFix(r.tauF, 1)} kPa @ σ'=${fmtFix(r.sigmaEff, 0)}`, padL + 6, 15);
      c.textAlign = 'right'; c.fillText("Efektif Normal Gerilme σ' (kPa)", W - padR, H - 8);
    } else if (st.tab === 'bearing') {
      const r = computed;
      // Footing & Terzaghi failure wedge schematic + bar breakdown of 3 terms
      const groundY = H * 0.34, cx = W * 0.36;
      const bPx = Math.min(90, Math.max(46, st.B * 22)), dfPx = Math.min(50, st.Df * 16);
      c.fillStyle = 'rgba(255,209,102,.08)'; c.fillRect(14, groundY, W * 0.62, H - groundY - 12);
      c.strokeStyle = COL_AXIS; c.beginPath(); c.moveTo(14, groundY); c.lineTo(W * 0.64, groundY); c.stroke();

      // Prandtl/Terzaghi active wedge & log-spiral lobes
      const baseY = groundY + dfPx;
      c.strokeStyle = acc; c.lineWidth = 1.6; c.setLineDash([4, 3]);
      c.beginPath();
      c.moveTo(cx - bPx / 2, baseY); c.lineTo(cx, baseY + bPx * 0.52); c.lineTo(cx + bPx / 2, baseY);
      c.stroke();
      c.beginPath(); c.arc(cx - bPx / 2, baseY, bPx * 0.72, 0.3 * Math.PI, Math.PI); c.stroke();
      c.beginPath(); c.arc(cx + bPx / 2, baseY, bPx * 0.72, 0, 0.7 * Math.PI); c.stroke();
      c.setLineDash([]);

      // Footing concrete block
      c.fillStyle = 'rgba(255,255,255,.18)'; c.strokeStyle = COL_FG; c.lineWidth = 2;
      c.fillRect(cx - bPx / 2, baseY - 16, bPx, 16);
      c.strokeRect(cx - bPx / 2, baseY - 16, bPx, 16);
      c.fillRect(cx - 10, groundY - 26, 20, dfPx + 10);
      c.strokeRect(cx - 10, groundY - 26, 20, dfPx + 10);
      drawArrow(c, cx, 8, cx, groundY - 28, COL_WARN, 2.4);

      // Right side: contribution bars (c*Nc, q*Nq, 0.5*gamma*B*Ngamma)
      const bx0 = W * 0.69, bwMax = W * 0.27;
      const tot = Math.max(1, r.qu);
      const bars = [
        ['Kohezyon', r.termC, COL_OK],
        ['Sürşarj (q)', r.termQ, COL_BLUE],
        ['Ağırlık (γB)', r.termG, COL_WARN],
      ];
      bars.forEach(([lbl, val, col], idx) => {
        const y = 40 + idx * 62;
        c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'left';
        c.fillText(`${lbl}: ${fmtFix(val, 0)} kPa`, bx0, y);
        c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(bx0, y + 6, bwMax, 14);
        c.fillStyle = col; c.fillRect(bx0, y + 6, (val / tot) * bwMax, 14);
      });
    } else {
      // Rankine retaining wall pressure distribution
      const r = computed;
      const wallX = W * 0.28, topY = 24, botY = H - 28, wh = botY - topY;
      const toY = z => topY + (z / st.H) * wh;
      const maxP = Math.max(r.paBase, 20);
      const pSc = (W * 0.56) / maxP;

      // Water table line
      if (st.zw < st.H) {
        const wy = toY(st.zw);
        c.fillStyle = 'rgba(90,176,255,.1)'; c.fillRect(wallX, wy, W - wallX - 18, botY - wy);
        c.strokeStyle = COL_BLUE; c.setLineDash([5, 4]);
        c.beginPath(); c.moveTo(wallX, wy); c.lineTo(W - 18, wy); c.stroke(); c.setLineDash([]);
      }

      // Retaining wall stem & footing
      c.fillStyle = 'rgba(255,255,255,.16)'; c.strokeStyle = COL_FG; c.lineWidth = 2;
      c.fillRect(wallX - 18, topY, 18, wh); c.strokeRect(wallX - 18, topY, 18, wh);
      c.fillRect(wallX - 38, botY - 10, 56, 10); c.strokeRect(wallX - 38, botY - 10, 56, 10);

      // Active soil + water pressure polygon
      c.fillStyle = acc; c.globalAlpha = 0.22;
      c.beginPath(); c.moveTo(wallX, topY);
      r.zs.forEach((z, i) => c.lineTo(wallX + r.paTotal[i] * pSc, toY(z)));
      c.lineTo(wallX, botY); c.closePath(); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = acc; c.lineWidth = 2.4;
      c.beginPath();
      r.zs.forEach((z, i) => { i === 0 ? c.moveTo(wallX + r.paTotal[i] * pSc, toY(z)) : c.lineTo(wallX + r.paTotal[i] * pSc, toY(z)); });
      c.stroke();

      // Resultant thrust arrow Pa at height ya from base
      const ry = botY - (r.ya / st.H) * wh;
      drawArrow(c, wallX + maxP * pSc * 0.85, ry, wallX + 4, ry, COL_WARN, 2.5);
      c.fillStyle = COL_WARN; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText(`Pa = ${fmtFix(r.Pa, 1)} kN/m (@ y=${fmtFix(r.ya, 2)} m)`, wallX + 10, ry - 10);
      c.fillStyle = COL_MUTE; c.textAlign = 'right';
      c.fillText(`Taban p_a = ${fmtFix(r.paBase, 1)} kPa`, W - 16, botY - 6);
    }
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.tab !== 'consol') return false;
    st.t_days = st.t_days >= 5000 ? 1 : st.t_days + dt * 450;
    sTdays.set(st.t_days);
    update();
    return true;
  }, clean);

  function syncTabVis() {
    const t = st.tab;
    sCv.setVisible(t === 'consol'); sHdr.setVisible(t === 'consol'); sDsig.setVisible(t === 'consol'); sTdays.setVisible(t === 'consol'); tDbl.setVisible(t === 'consol');
    sC.setVisible(t !== 'consol'); sPhi.setVisible(t !== 'consol');
    sSig.setVisible(t === 'mc'); sUw.setVisible(t === 'mc'); sSig3.setVisible(t === 'mc');
    sB.setVisible(t === 'bearing'); sDf.setVisible(t === 'bearing'); selShape.setVisible(t === 'bearing'); sFS.setVisible(t === 'bearing');
    sGam.setVisible(t === 'bearing' || t === 'rankine');
    sH.setVisible(t === 'rankine'); sQs.setVisible(t === 'rankine'); sZw.setVisible(t === 'rankine');
    boxSub.hidden = t !== 'consol';
    btnPlay.hidden = t !== 'consol';
    const titles = {
      consol: 'Aşırı Boşluk Suyu Basıncı İzokronu u(z, t)',
      mc: 'Mohr–Coulomb Göçme Zarfı & Üç Eksenli Daire',
      bearing: 'Terzaghi Temel Göçme Mekanizması & Bileşenler',
      rankine: 'Rankine Aktif Yanal Toprak & Su Basıncı Dağılımı',
    };
    cvTitle.textContent = titles[t];
    host.querySelectorAll('[data-stab] button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  }

  function drawSub() {
    if (st.tab !== 'consol' || !computed) return;
    safePlot(cvSub, [
      { name: 'U(Tv)', color: accentColor(), xs: computed.curveTv, ys: computed.curveU },
      { name: 'Anlık', color: COL_OK, xs: [Math.max(1e-3, computed.Tv), Math.max(1e-3, computed.Tv)], ys: [0, computed.U_pct] },
    ], { xlog: true, x0: 0.001, x1: 10, ylabel: 'U (%)', height: 175 });
  }

  function update() {
    if (st.tab === 'consol') {
      computed = terzaghiConsolidation({ cv: st.cv, Hdr: st.Hdr, dSigma: st.dSigma, t_days: st.t_days, doubleDrain: st.doubleDrain });
      renderKpis(kpis, [
        { lbl: 'Konsolidasyon Derecesi U', val: `%${fmtFix(computed.U_pct, 1)}`, sub: `T_v = ${fmtFix(computed.Tv, 3)}`, tone: 'acc' },
        { lbl: 'Maks. Kalan u_e', val: `${fmtFix(computed.uMax, 1)} kPa`, sub: `Başlangıç Δσ₀ = ${st.dSigma} kPa` },
        { lbl: 't₅₀ (%50 Oturma)', val: `${fmtFix(computed.t50_days, 0)} gün`, sub: `${fmtFix(computed.t50_days / 365.25, 2)} yıl` },
        { lbl: 't₉₀ (%90 Oturma)', val: `${fmtFix(computed.t90_days, 0)} gün`, sub: `${fmtFix(computed.t90_days / 365.25, 2)} yıl`, tone: 'ok' },
      ]);
      drawSub();
    } else if (st.tab === 'mc') {
      computed = mohrCoulombSoil({ c: st.c, phiDeg: st.phiDeg, sigma: st.sigma, porePressure: st.poreP, sigma3Eff: st.sigma3 });
      renderKpis(kpis, [
        { lbl: "Efektif Gerilme σ'", val: `${fmtFix(computed.sigmaEff, 1)} kPa`, sub: `σ − u_w = ${st.sigma} − ${st.poreP}` },
        { lbl: 'Kayma Dayanımı τ_f', val: `${fmtFix(computed.tauF, 1)} kPa`, tone: 'acc' },
        { lbl: "Göçme Asal σ'₁f", val: `${fmtFix(computed.sigma1EffFail, 1)} kPa`, sub: `Δσ_f = ${fmtFix(computed.deviatorFail, 1)} kPa` },
        { lbl: 'Göçme Düzlemi θ_f', val: `${fmtFix(computed.failureAngleDeg, 1)}°`, sub: '45° + φ/2' },
      ]);
    } else if (st.tab === 'bearing') {
      computed = terzaghiBearingCapacity({ B: st.B, Df: st.Df, gamma: st.gamma, c: st.c, phiDeg: st.phiDeg, shape: st.shape, FS: st.FS });
      renderKpis(kpis, [
        { lbl: 'Nihai Taşıma Gücü q_u', val: `${fmtFix(computed.qu, 1)} kPa`, tone: 'acc' },
        { lbl: 'Emniyetli q_all', val: `${fmtFix(computed.qAll, 1)} kPa`, sub: `FS = ${fmtFix(st.FS, 2)}`, tone: 'ok' },
        { lbl: 'Taşıma Faktörleri', val: `Nc=${fmtFix(computed.Nc, 1)}`, sub: `Nq=${fmtFix(computed.Nq, 1)} · Nγ=${fmtFix(computed.Ngamma, 1)}` },
        { lbl: 'İzin Verilen Yük Q', val: `${fmtFix(computed.Qall_kN, 0)} kN${st.shape === 'strip' ? '/m' : ''}` },
      ]);
    } else {
      computed = rankineEarthPressure({ H: st.H, gamma: st.gamma, phiDeg: st.phiDeg, c: st.c, qs: st.qs, zw: st.zw });
      renderKpis(kpis, [
        { lbl: 'Aktif İtki P_a', val: `${fmtFix(computed.Pa, 1)} kN/m`, sub: `Etki y_a = ${fmtFix(computed.ya, 2)} m`, tone: 'acc' },
        { lbl: 'Pasif Direnç P_p', val: `${fmtFix(computed.Pp, 1)} kN/m`, sub: `Etki y_p = ${fmtFix(computed.yp, 2)} m` },
        { lbl: 'Rankine Katsayıları', val: `Ka=${fmtFix(computed.Ka, 3)}`, sub: `Kp=${fmtFix(computed.Kp, 2)} · K₀=${fmtFix(computed.K0, 3)}` },
        { lbl: 'Çekme Çatlağı z_c', val: `${fmtFix(computed.zc, 2)} m`, sub: `Taban p_a = ${fmtFix(computed.paBase, 1)} kPa` },
      ]);
    }
    cvMain.render();
  }

  host.querySelector('[data-stab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; st.playing = false; loop.stop(); syncPlayBtn(btnPlay, false);
    syncTabVis(); update(); syncSegments(host, false);
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, SOIL_PRESETS, p => {
    Object.assign(st, p);
    sCv.set(st.cv); sHdr.set(st.Hdr); sDsig.set(st.dSigma); sTdays.set(st.t_days); tDbl.set(st.doubleDrain);
    sC.set(st.c); sPhi.set(st.phiDeg); sSig.set(st.sigma); sUw.set(st.poreP); sSig3.set(st.sigma3);
    sB.set(st.B); sDf.set(st.Df); sGam.set(st.gamma); selShape.set(st.shape); sFS.set(st.FS);
    sH.set(st.H); sQs.set(st.qs); sZw.setRange(0, st.H); sZw.set(st.zw);
    syncTabVis(); update();
  });

  attachReadout(cvSub, host.querySelector('[data-rd-sub]'), (x, ser, i) => `Tv = ${fmtNum(x, 3)} · U = %${fmtFix(ser[0].ys[i], 1)}`, clean);
  observeResize(boxSub, drawSub, clean);
  syncPlayBtn(btnPlay, false);
  bindTasks(host);
  syncTabVis();
  update();
  return clean.run;
}

// =====================================================================
// 8. AÇIK KANAL & HİDROLOJİ (field: insaat)
// =====================================================================

const CHANNEL_PRESETS = [
  { label: 'Nehir Rejimi + Hidrolik Sıçrama', tab: 'channel', b: 4.0, z: 0, n: 0.015, S0: 0.001, Q: 16, y1: 0.42 },
  { label: 'Dik Eğimli Trapez Kanal',         tab: 'channel', b: 3.0, z: 1.5, n: 0.018, S0: 0.015, Q: 20, y1: 0.55 },
  { label: '3 Saatlik Fırtına Hidrografı',    tab: 'hydro', C: 0.55, i_mmhr: 50, A_km2: 14, tp_hr: 2.0, p1: 15, p2: 32, p3: 12, Qb: 3 },
  { label: 'Kentsel Havza (Yüksek C=0.85)',   tab: 'hydro', C: 0.85, i_mmhr: 75, A_km2: 6, tp_hr: 1.0, p1: 25, p2: 40, p3: 10, Qb: 1 },
];

function mountOpenChannelHydrology(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'channel',
    b: 4.0, z: 0.0, n: 0.015, S0: 0.001, Q: 16, y1: 0.42,
    C: 0.55, i_mmhr: 50, A_km2: 14, tp_hr: 2.0, p1: 15, p2: 32, p3: 12, Qb: 3,
    playing: autoPlayAllowed(), flowPhase: 0,
    ch: null, hy: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Manning denklemi</b>, özgül enerji eğrisi, kritik derinlik ve <b>hidrolik sıçramayı</b> canlı kanal profilinde gözlemle; <b>Hidroloji</b> sekmesinde rasyonel pik debi ve çoklu yağış birim hidrograf konvolüsyonunu hesapla.', CHANNEL_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-htab aria-label="Hidrolik veya hidroloji">
        <button type="button" data-t="channel" class="on">Açık Kanal & Sıçrama</button>
        <button type="button" data-t="hydro">Rasyonel & Birim Hidrograf</button>
      </div>
      <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card" data-box-prof>
          <div class="slc-head"><h4 class="slc-title">Hidrolik Sıçrama Profili (Canlı Akım)</h4><span class="slc-badge slc-badge-acc" data-jump-badge></span></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-prof aria-label="Açık kanal hidrolik sıçrama animasyonu"></canvas></div>
        </div>
        <div class="slc-plot-card" data-box-plot>
          <div class="slc-head"><h4 class="slc-title" data-plot-title>Özgül Enerji Diyagramı E(y)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-plot aria-label="Özgül enerji veya hidrograf grafiği"></canvas><div class="slc-readout" data-rd></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'Q = \\frac{1}{n} A R_h^{2/3} S_0^{1/2}, \\qquad E(y) = y + \\frac{Q^2}{2g A^2}, \\qquad y_2 = \\frac{y_1}{2}\\!\\left(\\sqrt{1 + 8 Fr_1^2} - 1\\right)',
        'Q_p = \\frac{C\\,i\\,A}{3.6}, \\qquad Q(t) = Q_b + \\sum_{m} P_m\\, U(t - m\\Delta t)',
      ],
      paragraphs: [
        'Özgül enerji eğrisi $E(y)$ minimum değerini kritik derinlikte ($Fr = 1$, dikdörtgen kanalda $y_c = (q^2/g)^{1/3}$, $E_{\\min} = 1.5 y_c$) alır. Üst kritik akım ($y_1 < y_c$) yüksek enerjili türbülanslı bir sıçrama ile alt kritik eşlenik derinliğe ($y_2 > y_c$) geçerken $\\Delta E = E_1 - E_2$ enerjisini yutar.',
        'Birim hidrograf süperpozisyonu doğrusal zamanla değişmeyen havza kabulüyle ardışık yağış dilimlerinin toplam yüzeysel akış hacmini korur.',
      ],
      tasks: [
        'Dikdörtgen kanalda ($z = 0$) $y_1$ değerini düşürerek $Fr_1$ arttıkça eşlenik derinlik $y_2$ ve enerji kaybı $\\Delta E$ artışını gözle.',
        'Taban eğimini $S_0 = 0.001$ değerinden $0.015$ değerine çıkararak normal akımın nehir rejiminden ($y_n > y_c$) sel rejimine ($y_n < y_c$) geçişini izle.',
        '**Hidroloji** sekmesinde yağış dilimlerini değiştirip hesaplanan doğrudan akış hacminin toplam yağış hacmine ($A\\sum P_m$) eşit olduğunu doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const jumpBadge = host.querySelector('[data-jump-badge]');
  const boxProf = host.querySelector('[data-box-prof]');
  const cvPlot = host.querySelector('[data-cv-plot]');
  const plotTitle = host.querySelector('[data-plot-title]');
  const btnPlay = host.querySelector('[data-play]');

  // Channel sliders
  const sB = addSlider(ctrls, { label: 'Taban Genişliği b', unit: 'm', min: 1, max: 12, step: 0.5, value: st.b, onInput: v => { st.b = v; update(); } });
  const sZ = addSlider(ctrls, { label: 'Şev Eğimi z (1D:zY)', min: 0, max: 2.5, step: 0.25, value: st.z, onInput: v => { st.z = v; update(); } });
  const sQ = addSlider(ctrls, { label: 'Debi Q', unit: 'm³/s', min: 2, max: 60, step: 1, value: st.Q, onInput: v => { st.Q = v; update(); } });
  const sN = addSlider(ctrls, { label: 'Manning Pürüzlülüğü n', min: 0.010, max: 0.045, step: 0.001, value: st.n, onInput: v => { st.n = v; update(); } });
  const sS0 = addSlider(ctrls, { label: 'Taban Eğimi S₀', min: 0.0002, max: 0.025, log: true, value: st.S0, onInput: v => { st.S0 = v; update(); } });
  const sY1 = addSlider(ctrls, { label: 'Sıçrama Öncesi y₁', unit: 'm', min: 0.15, max: 1.8, step: 0.02, value: st.y1, onInput: v => { st.y1 = v; update(); } });

  // Hydrology sliders
  const sC = addSlider(ctrls, { label: 'Akış Katsayısı C', min: 0.15, max: 0.95, step: 0.05, value: st.C, onInput: v => { st.C = v; update(); } });
  const sI = addSlider(ctrls, { label: 'Yağış Şiddeti i', unit: 'mm/sa', min: 10, max: 120, step: 5, value: st.i_mmhr, onInput: v => { st.i_mmhr = v; update(); } });
  const sA = addSlider(ctrls, { label: 'Havza Alanı A', unit: 'km²', min: 1, max: 50, step: 1, value: st.A_km2, onInput: v => { st.A_km2 = v; update(); } });
  const sTp = addSlider(ctrls, { label: 'Pik Süresi t_p', unit: 'sa', min: 0.5, max: 5.0, step: 0.25, value: st.tp_hr, onInput: v => { st.tp_hr = v; update(); } });
  const sP1 = addSlider(ctrls, { label: '1. Dilim Yağış P₁', unit: 'mm', min: 0, max: 60, step: 2, value: st.p1, onInput: v => { st.p1 = v; update(); } });
  const sP2 = addSlider(ctrls, { label: '2. Dilim Yağış P₂', unit: 'mm', min: 0, max: 60, step: 2, value: st.p2, onInput: v => { st.p2 = v; update(); } });
  const sP3 = addSlider(ctrls, { label: '3. Dilim Yağış P₃', unit: 'mm', min: 0, max: 60, step: 2, value: st.p3, onInput: v => { st.p3 = v; update(); } });

  const cvProf = setupCanvas(host.querySelector('[data-cv-prof]'), () => 185, (c, W, H) => {
    const ch = st.ch;
    if (!ch || st.tab !== 'channel') return;
    c.clearRect(0, 0, W, H);
    const baseY = H - 24;
    const maxY = Math.max(ch.y2, ch.yn, ch.yc, 1.0) * 1.35;
    const scY = (H - 54) / maxY;
    const xJump = W * 0.40, jumpLen = Math.min(90, Math.max(36, (ch.y2 - ch.y1) * scY * 1.4));

    // Water polygon
    c.fillStyle = 'rgba(90,176,255,.22)';
    c.beginPath();
    c.moveTo(16, baseY);
    c.lineTo(16, baseY - ch.y1 * scY);
    c.lineTo(xJump, baseY - ch.y1 * scY);
    // Turbulent jump roller curve
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      const xx = xJump + f * jumpLen;
      const smooth = 3 * f * f - 2 * f * f * f;
      const ripple = ch.Fr1 > 1.05 ? Math.sin(f * 14 - st.flowPhase * 6) * 3.5 * Math.sin(f * Math.PI) : 0;
      const yy = baseY - (ch.y1 + (ch.y2 - ch.y1) * smooth) * scY + ripple;
      c.lineTo(xx, yy);
    }
    c.lineTo(W - 16, baseY - ch.y2 * scY);
    c.lineTo(W - 16, baseY);
    c.closePath(); c.fill();

    // Water surface stroke
    c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(16, baseY - ch.y1 * scY); c.lineTo(xJump, baseY - ch.y1 * scY);
    for (let k = 0; k <= 16; k++) {
      const f = k / 16;
      const smooth = 3 * f * f - 2 * f * f * f;
      const ripple = ch.Fr1 > 1.05 ? Math.sin(f * 14 - st.flowPhase * 6) * 3.5 * Math.sin(f * Math.PI) : 0;
      c.lineTo(xJump + f * jumpLen, baseY - (ch.y1 + (ch.y2 - ch.y1) * smooth) * scY + ripple);
    }
    c.lineTo(W - 16, baseY - ch.y2 * scY);
    c.stroke();

    // Critical depth reference line
    const yCritPx = baseY - ch.yc * scY;
    c.strokeStyle = COL_WARN; c.setLineDash([5, 4]); c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(16, yCritPx); c.lineTo(W - 16, yCritPx); c.stroke();
    c.setLineDash([]);

    // Moving streamline streaks
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const frac = ((st.flowPhase * 0.45 + i / 6) % 1);
      const sx = 20 + frac * (W - 44);
      const localY = sx < xJump ? ch.y1 : sx > xJump + jumpLen ? ch.y2 : 0.5 * (ch.y1 + ch.y2);
      const sy = baseY - localY * scY * (0.35 + (i % 3) * 0.2);
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 14, sy); c.stroke();
    }

    // Channel bed
    c.strokeStyle = COL_FG; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(12, baseY); c.lineTo(W - 12, baseY); c.stroke();

    c.fillStyle = COL_FG; c.font = '600 10.5px "JetBrains Mono", monospace';
    c.textAlign = 'left'; c.fillText(`y₁=${fmtFix(ch.y1, 2)}m (Fr₁=${fmtFix(ch.Fr1, 2)})`, 20, 18);
    c.textAlign = 'right'; c.fillText(`y₂=${fmtFix(ch.y2, 2)}m (Fr₂=${fmtFix(ch.Fr2, 2)})`, W - 20, 18);
    c.fillStyle = COL_WARN; c.fillText(`yc=${fmtFix(ch.yc, 2)}m`, W - 20, yCritPx - 5);
  }, clean);

  function drawPlot() {
    if (st.tab === 'channel' && st.ch) {
      const ch = st.ch;
      const eMax = Math.min(Math.max(ch.E1, ch.En, ch.Emin * 2.4) * 1.25, ch.Emin * 4.5);
      // Plot E(y) as y vs E (classic textbook orientation: x-axis = E, y-axis = y)
      const pairs = ch.curveY.map((y, i) => ({ e: ch.curveE[i], y })).filter(p => p.e <= eMax);
      const sorted = pairs.slice().sort((a, b) => a.y - b.y);
      safePlot(cvPlot, [
        { name: 'E(y)', color: accentColor(), xs: sorted.map(p => p.e), ys: sorted.map(p => p.y) },
        { name: 'y = E', color: COL_DIM, xs: [0, eMax], ys: [0, eMax] },
        { name: 'Sıçrama', color: COL_BAD, xs: [ch.E1, ch.E2], ys: [ch.y1, ch.y2] },
      ], { x0: 0, x1: eMax, ylabel: 'Derinlik y (m)', height: 225 });
    } else if (st.tab === 'hydro' && st.hy) {
      const h = st.hy;
      safePlot(cvPlot, [
        { name: 'Toplam Q(t)', color: accentColor(), xs: h.tHr, ys: h.qTotal },
        { name: 'Doğrudan Akış', color: COL_BLUE, xs: h.tHr, ys: h.qDirect },
      ], { x0: 0, x1: h.tHr[h.tHr.length - 1], ylabel: 'Debi Q (m³/s)', height: 255 });
    }
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.tab !== 'channel') return false;
    st.flowPhase += dt;
    cvProf.render();
    return true;
  }, clean);

  function syncTabVis() {
    const isCh = st.tab === 'channel';
    [sB, sZ, sQ, sN, sS0, sY1].forEach(s => s.setVisible(isCh));
    [sC, sI, sA, sTp, sP1, sP2, sP3].forEach(s => s.setVisible(!isCh));
    boxProf.hidden = !isCh;
    btnPlay.hidden = !isCh;
    plotTitle.textContent = isCh ? 'Özgül Enerji Diyagramı y — E (m)' : 'Birim Hidrograf Konvolüsyonu Q(t) (m³/s)';
    host.querySelectorAll('[data-htab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  }

  function update() {
    if (st.tab === 'channel') {
      st.ch = solveOpenChannel({ b: st.b, z: st.z, n: st.n, S0: st.S0, Q: st.Q, y1: st.y1 });
      const ch = st.ch;
      jumpBadge.textContent = ch.jumpType;
      renderKpis(kpis, [
        { lbl: 'Normal Derinlik y_n', val: `${fmtFix(ch.yn, 3)} m`, sub: `V_n=${fmtFix(ch.Vn, 2)} m/s · Fr=${fmtFix(ch.FrN, 2)}` },
        { lbl: 'Kritik Derinlik y_c', val: `${fmtFix(ch.yc, 3)} m`, sub: `E_min = ${fmtFix(ch.Emin, 3)} m`, tone: 'acc' },
        { lbl: 'Eşlenik Derinlik y₂', val: `${fmtFix(ch.y2, 3)} m`, sub: `Fr₁=${fmtFix(ch.Fr1, 2)} → Fr₂=${fmtFix(ch.Fr2, 2)}` },
        { lbl: 'Enerji Kaybı ΔE', val: `${fmtFix(ch.dE, 3)} m`, sub: `Verim %${fmtFix(ch.effPct, 1)}`, tone: ch.dE > 0.05 ? 'warn' : 'ok' },
      ]);
      cvProf.render();
    } else {
      st.hy = solveRationalAndUH({ C: st.C, i_mmhr: st.i_mmhr, A_km2: st.A_km2, tp_hr: st.tp_hr, storms: [st.p1, st.p2, st.p3], Qb: st.Qb });
      const h = st.hy;
      renderKpis(kpis, [
        { lbl: 'Rasyonel Pik Q_p', val: `${fmtFix(h.Qp_rational, 1)} m³/s`, sub: 'C·i·A / 3.6', tone: 'acc' },
        { lbl: 'Hidrograf Piki Q_maks', val: `${fmtFix(h.qPeak, 1)} m³/s`, sub: `t_pik = ${fmtFix(h.tPeak, 2)} sa`, tone: 'ok' },
        { lbl: 'Birim Pik u_p', val: `${fmtFix(h.up, 2)} m³/s/mm`, sub: `Taban t_b = ${fmtFix(h.tb, 1)} sa` },
        { lbl: 'Doğrudan Akış Hacmi', val: `${fmtFix(h.directVolM3 / 1e6, 3)} Mm³`, sub: `ΣP = ${h.totalRainMm} mm` },
      ]);
    }
    drawPlot();
  }

  host.querySelector('[data-htab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncTabVis(); update(); syncSegments(host, false);
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, CHANNEL_PRESETS, p => {
    Object.assign(st, p);
    sB.set(st.b); sZ.set(st.z); sN.set(st.n); sS0.set(st.S0); sQ.set(st.Q); sY1.set(st.y1);
    sC.set(st.C); sI.set(st.i_mmhr); sA.set(st.A_km2); sTp.set(st.tp_hr); sP1.set(st.p1); sP2.set(st.p2); sP3.set(st.p3);
    syncTabVis(); update();
  });

  attachReadout(cvPlot, host.querySelector('[data-rd]'), (x, ser, i) => st.tab === 'channel' ? `E=${fmtFix(x, 2)} m · y=${fmtFix(ser[0].ys[i], 2)} m` : `t=${fmtFix(x, 1)} sa · Q=${fmtFix(ser[0].ys[i], 1)} m³/s`, clean);
  observeResize(host.querySelector('[data-box-plot]'), drawPlot, clean);
  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  syncTabVis();
  update();
  return clean.run;
}

// =====================================================================
// 9. ULAŞTIRMA & TRAFİK (field: insaat)
// =====================================================================

const TRANS_PRESETS = [
  { label: 'Otoyol Kurbu (110 km/sa)', tab: 'curve', V_kmh: 110, R: 550, ePct: 7, fs: 0.11, gradePct: -3, Ms_avail: 9 },
  { label: 'Keskin Dağ Kurbu (Tehlikeli)', tab: 'curve', V_kmh: 85, R: 180, ePct: 6, fs: 0.14, gradePct: -6, Ms_avail: 4 },
  { label: 'Kapasite Akımı (k = kj/2)', tab: 'traffic', vf: 100, kj: 140, k: 70 },
  { label: 'Sıkışık Darboğaz Trafiği', tab: 'traffic', vf: 100, kj: 140, k: 115 },
];

function mountTransportation(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'curve',
    V_kmh: 100, R: 400, ePct: 6, fs: 0.12, tr: 2.5, gradePct: 0, Ms_avail: 8,
    vf: 100, kj: 140, k: 60,
    playing: autoPlayAllowed(), animPos: 0,
    cur: null, trf: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Yatay kurp tasarımında</b> dever (e), minimum yarıçap ve duruş görüş mesafesini (SSD) denetle; <b>Trafik Akımı</b> sekmesinde Greenshields hız–yoğunluk–akım temel diyagramını canlı araç şeridiyle incele.', TRANS_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-ttab aria-label="Ulaştırma alt modülü">
        <button type="button" data-t="curve" class="on">Yatay Kurp & Görüş</button>
        <button type="button" data-t="traffic">Trafik Akımı (Greenshields)</button>
      </div>
      <div class="slc-toolbar-g">
        <span class="slc-badge" data-stat-badge></span>
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title" data-cv-title>Yatay Kurp Planı & Dever Kesiti</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-vis aria-label="Yatay kurp veya trafik şeridi animasyonu"></canvas></div>
        </div>
        <div class="slc-plot-card" data-box-fund hidden>
          <div class="slc-head"><h4 class="slc-title">Temel Trafik Diyagramı: Akım q(k) & Hız v(k)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-fund aria-label="Greenshields q-k diyagramı"></canvas><div class="slc-readout" data-rd-fund></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'R_{\\min} = \\frac{V^2}{g\\,(e + f_s)}, \\qquad SSD = V t_r + \\frac{V^2}{2(a + g G)}, \\qquad M = R\\!\\left(1 - \\cos\\frac{SSD}{2R}\\right)',
        'v(k) = v_f\\!\\left(1 - \\frac{k}{k_j}\\right), \\qquad q(k) = k\\,v(k), \\qquad q_{\\max} = \\frac{v_f k_j}{4}',
      ],
      paragraphs: [
        'Yatay kurpta araç merkezkaç kuvvetini dever ($e$) ve yanal sürtünme ($f_s$) birlikte karşılar. Ayrıca iç şerit kenarındaki engelin kurp merkezine göre orta ok mesafesi $M$, duruş görüş mesafesi $SSD$ boyunca görüş hattını açık bırakmalıdır.',
        'Greenshields modelinde yol kapasitesi $q_{\\max}$, kritik yoğunluk $k_c = k_j/2$ ve kritik hız $v_c = v_f/2$ noktasında zirve yapar; yoğunluk $k_c$\'yi aştığında akım düşer ve trafik sıkışıklığı başlar.',
      ],
      tasks: [
        'Yatay kurpta iniş eğimini $G = -6\\%$ yapıp duruş görüş mesafesi $SSD$ ve gereken yanal açıklık $M$ artışını gözlemle.',
        '**Trafik Akımı** sekmesinde yoğunluğu $k = k_j/2$ noktasına ayarlayıp akımın $q_{\\max} = v_f k_j / 4$ kapasitesine ulaştığını doğrula.',
        'Yoğunluğu $k > k_j/2$ bölgesine taşıyıp araçların şeritte nasıl yavaşladığını ve akım $q$ değerinin düştüğünü incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const statBadge = host.querySelector('[data-stat-badge]');
  const cvTitle = host.querySelector('[data-cv-title]');
  const boxFund = host.querySelector('[data-box-fund]');
  const cvFund = host.querySelector('[data-cv-fund]');
  const btnPlay = host.querySelector('[data-play]');

  const sV = addSlider(ctrls, { label: 'Proje Hızı V', unit: 'km/sa', min: 40, max: 140, step: 5, value: st.V_kmh, onInput: v => { st.V_kmh = v; update(); } });
  const sR = addSlider(ctrls, { label: 'Kurp Yarıçapı R', unit: 'm', min: 80, max: 1000, step: 10, value: st.R, onInput: v => { st.R = v; update(); } });
  const sE = addSlider(ctrls, { label: 'Dever (Enine Eğim) e', unit: '%', min: 2, max: 10, step: 0.5, value: st.ePct, onInput: v => { st.ePct = v; update(); } });
  const sFs = addSlider(ctrls, { label: 'Yanal Sürtünme f_s', min: 0.08, max: 0.18, step: 0.01, value: st.fs, onInput: v => { st.fs = v; update(); } });
  const sG = addSlider(ctrls, { label: 'Boyuna Eğim G', unit: '%', min: -8, max: 8, step: 1, value: st.gradePct, onInput: v => { st.gradePct = v; update(); } });
  const sMs = addSlider(ctrls, { label: 'Mevcut Yanal Açıklık M_s', unit: 'm', min: 2, max: 20, step: 0.5, value: st.Ms_avail, onInput: v => { st.Ms_avail = v; update(); } });

  const sVf = addSlider(ctrls, { label: 'Serbest Akım Hızı v_f', unit: 'km/sa', min: 40, max: 140, step: 5, value: st.vf, onInput: v => { st.vf = v; update(); } });
  const sKj = addSlider(ctrls, { label: 'Tıkanma Yoğunluğu k_j', unit: 'araç/km', min: 60, max: 200, step: 5, value: st.kj, onInput: v => { st.kj = v; sK.setRange(1, v); update(); } });
  const sK = addSlider(ctrls, { label: 'Anlık Yoğunluk k', unit: 'araç/km', min: 1, max: 140, step: 1, value: st.k, onInput: v => { st.k = v; update(); } });

  const cvVis = setupCanvas(host.querySelector('[data-cv-vis]'), w => st.tab === 'curve' ? Math.min(280, Math.max(220, w * 0.52)) : 150, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.tab === 'curve' && st.cur) {
      const cu = st.cur;
      // Left 65%: plan view of curved road + sight line chord + moving vehicle
      const cx = W * 0.34, cy = H * 1.12;
      const rPx = Math.min(H * 0.92, W * 0.32);
      const a0 = -Math.PI * 0.80, a1 = -Math.PI * 0.20;
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 28;
      c.beginPath(); c.arc(cx, cy, rPx, a0, a1); c.stroke();
      c.strokeStyle = COL_WARN; c.setLineDash([7, 6]); c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx, cy, rPx, a0, a1); c.stroke(); c.setLineDash([]);

      // Sight chord & middle ordinate M
      const halfA = Math.min(0.28, (cu.SSD / (2 * cu.R)));
      const am = -Math.PI * 0.5;
      const p1 = { x: cx + rPx * Math.cos(am - halfA), y: cy + rPx * Math.sin(am - halfA) };
      const p2 = { x: cx + rPx * Math.cos(am + halfA), y: cy + rPx * Math.sin(am + halfA) };
      c.strokeStyle = cu.sightSafe ? COL_OK : COL_BAD; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();

      // Animated car along arc
      const carA = a0 + ((st.animPos * 0.45) % 1) * (a1 - a0);
      const vx = cx + rPx * Math.cos(carA), vy = cy + rPx * Math.sin(carA);
      c.save(); c.translate(vx, vy); c.rotate(carA + Math.PI / 2);
      c.fillStyle = cu.radiusSafe ? acc : COL_BAD;
      c.fillRect(-10, -5, 20, 10);
      c.restore();

      // Right 32%: banked cross-section showing superelevation e%
      const bx = W * 0.82, by = H * 0.62;
      const tilt = Math.atan(st.ePct / 100) * 3.0; // visually exaggerated 3x
      c.save(); c.translate(bx, by); c.rotate(-tilt);
      c.strokeStyle = COL_FG; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-42, 0); c.lineTo(42, 0); c.stroke();
      c.fillStyle = acc; c.fillRect(-16, -16, 32, 13);
      c.fillStyle = '#0b0b10';
      c.beginPath(); c.arc(-10, -2, 4, 0, Math.PI * 2); c.arc(10, -2, 4, 0, Math.PI * 2); c.fill();
      c.restore();
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`Dever e = %${st.ePct}`, bx, H - 14);
      c.textAlign = 'left'; c.fillText(`SSD = ${fmtFix(cu.SSD, 0)} m`, 12, 18);
    } else if (st.tab === 'traffic' && st.trf) {
      const tr = st.trf;
      const laneY = H * 0.52;
      c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(14, laneY - 26, W - 28, 52);
      c.strokeStyle = COL_AXIS; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(14, laneY - 26); c.lineTo(W - 14, laneY - 26); c.moveTo(14, laneY + 26); c.lineTo(W - 14, laneY + 26); c.stroke();
      c.strokeStyle = COL_WARN; c.setLineDash([12, 10]); c.beginPath(); c.moveTo(14, laneY); c.lineTo(W - 14, laneY); c.stroke(); c.setLineDash([]);

      // Draw vehicles proportional to density k (1 km road mapped to W - 28)
      const nCars = Math.max(1, Math.min(28, Math.round((tr.k / tr.kj) * 26)));
      const trackW = W - 44;
      const col = tr.k < tr.kc * 0.95 ? COL_OK : tr.k <= tr.kc * 1.05 ? COL_WARN : COL_BAD;
      for (let i = 0; i < nCars; i++) {
        const u = ((i / nCars) + st.animPos * (tr.v / 120)) % 1;
        const x = 22 + u * trackW;
        const y = i % 2 === 0 ? laneY - 13 : laneY + 13;
        c.fillStyle = col;
        c.fillRect(x - 7, y - 4, 14, 8);
      }
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText(`${tr.regime} · v = ${fmtFix(tr.v, 1)} km/sa · q = ${fmtFix(tr.q, 0)} araç/sa`, 14, 18);
    }
  }, clean);

  function drawFund() {
    if (st.tab !== 'traffic' || !st.trf) return;
    const ks = [], qs = [];
    for (let i = 0; i <= 80; i++) {
      const k = (st.kj * i) / 80;
      ks.push(k);
      qs.push(k * st.vf * (1 - k / st.kj));
    }
    safePlot(cvFund, [
      { name: 'Akım q(k)', color: accentColor(), xs: ks, ys: qs },
      { name: 'Mevcut k', color: COL_WARN, xs: [st.k, st.k], ys: [0, st.trf.q] },
    ], { x0: 0, x1: st.kj, ylabel: 'Akım q (araç/sa)', height: 210 });
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.animPos += dt * (st.tab === 'curve' ? st.V_kmh / 100 : 0.6);
    cvVis.render();
    return true;
  }, clean);

  function syncTabVis() {
    const isC = st.tab === 'curve';
    [sV, sR, sE, sFs, sG, sMs].forEach(s => s.setVisible(isC));
    [sVf, sKj, sK].forEach(s => s.setVisible(!isC));
    boxFund.hidden = isC;
    cvTitle.textContent = isC ? 'Yatay Kurp Planı & Dever Kesiti' : 'Canlı Trafik Şeridi Simülasyonu';
    host.querySelectorAll('[data-ttab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
    cvVis.resize();
  }

  function update() {
    if (st.tab === 'curve') {
      st.cur = solveHorizontalCurve({ V_kmh: st.V_kmh, R: st.R, ePct: st.ePct, fs: st.fs, tr: st.tr, gradePct: st.gradePct, Ms_avail: st.Ms_avail });
      const cu = st.cur;
      const ok = cu.radiusSafe && cu.sightSafe;
      statBadge.textContent = ok ? 'Tasarım Güvenli' : (!cu.radiusSafe ? 'Yarıçap Yetersiz (R < R_min)' : 'Görüş Engelli (M_s < M_req)');
      statBadge.className = `slc-badge ${ok ? 'slc-badge-ok' : 'slc-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Min. Yarıçap R_min', val: `${fmtFix(cu.Rmin, 0)} m`, sub: `Mevcut R = ${st.R} m`, tone: cu.radiusSafe ? 'ok' : 'bad' },
        { lbl: 'Duruş Görüş SSD', val: `${fmtFix(cu.SSD, 1)} m`, sub: `Reaksiyon ${fmtFix(cu.dReact, 0)} + Fren ${fmtFix(cu.dBrake, 0)} m`, tone: 'acc' },
        { lbl: 'Gerekli Açıklık M', val: `${fmtFix(cu.Mreq, 2)} m`, sub: `Mevcut M_s = ${st.Ms_avail} m`, tone: cu.sightSafe ? 'ok' : 'bad' },
        { lbl: 'Gerekli Dever e_req', val: `%${fmtFix(cu.eReqPct, 2)}`, sub: `a_yanal = ${fmtFix(cu.aLat, 2)} m/s²` },
      ]);
    } else {
      st.trf = solveTrafficGreenshields({ vf: st.vf, kj: st.kj, k: st.k });
      const tr = st.trf;
      statBadge.textContent = tr.regime;
      statBadge.className = `slc-badge ${tr.k < tr.kc ? 'slc-badge-ok' : tr.k <= tr.kc * 1.05 ? 'slc-badge-warn' : 'slc-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Akım q', val: `${fmtFix(tr.q, 0)} araç/sa`, sub: `Kapasite q_max = ${fmtFix(tr.qMax, 0)}`, tone: 'acc' },
        { lbl: 'Ortalama Hız v', val: `${fmtFix(tr.v, 1)} km/sa`, sub: `Kritik v_c = ${fmtFix(tr.vc, 1)} km/sa` },
        { lbl: 'Araç Aralığı h_s', val: `${fmtFix(tr.spaceHeadwayM, 1)} m`, sub: `Zaman h_t = ${fmtFix(tr.timeHeadwayS, 2)} s` },
        { lbl: 'Kritik Yoğunluk k_c', val: `${fmtFix(tr.kc, 0)} araç/km`, sub: `k / k_j = %${fmtFix((tr.k / tr.kj) * 100, 0)}` },
      ]);
      drawFund();
    }
    cvVis.render();
  }

  host.querySelector('[data-ttab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncTabVis(); update(); syncSegments(host, false);
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, TRANS_PRESETS, p => {
    Object.assign(st, p);
    sV.set(st.V_kmh); sR.set(st.R); sE.set(st.ePct); sFs.set(st.fs); sG.set(st.gradePct); sMs.set(st.Ms_avail);
    sVf.set(st.vf); sKj.set(st.kj); sK.setRange(1, st.kj); sK.set(st.k);
    syncTabVis(); update();
  });

  attachReadout(cvFund, host.querySelector('[data-rd-fund]'), (x, ser, i) => `k = ${fmtFix(x, 0)} araç/km · q = ${fmtFix(ser[0].ys[i], 0)} araç/sa`, clean);
  observeResize(boxFund, drawFund, clean);
  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  syncTabVis();
  update();
  return clean.run;
}

// =====================================================================
// FIELD: MALZEME (10–17)
// =====================================================================

// =====================================================================
// 10. GERİLME-ŞEKİL DEĞİŞTİRME (TENSILE TEST) (field: malzeme)
// =====================================================================

const TENSILE_PRESETS = [
  { label: 'Yapı Çeliği (S235)',  mat: 'steel' },
  { label: 'Alüminyum (6061-T6)', mat: 'aluminum' },
  { label: 'Tavlı Bakır (Sünek)', mat: 'copper' },
  { label: 'Polimer (HDPE)',      mat: 'polymer' },
  { label: 'Seramik (Gevrek)',    mat: 'ceramic' },
];

function mountStressStrain(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mat: 'steel',
    progress: 0.45, // 0..1.05 (>1 means fractured)
    showTrue: true,
    playing: autoPlayAllowed(),
    curve: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Beş farklı mühendislik malzemesinin çekme deneyini canlı izle: elastik bölge, <b>%0.2 ofset akma noktası</b>, maksimum çekme gerilmesi (UTS), <b>boyun verme</b> ve kopma; rezilyans ve tokluk eğri altı alanlar olarak hesaplanır.', TENSILE_PRESETS)}
    <div class="slc-toolbar">
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Deneyi tekrarla</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-stage-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title">Çekme Numunesi (Canlı Uzama & Boyun Verme)</h4><span class="slc-hint mono" data-cur-lbl></span></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-bar aria-label="Çekme deneyi numune animasyonu"></canvas></div>
        </div>
        <div class="slc-plot-card">
          <div class="slc-head">
            <h4 class="slc-title">Gerilme σ (MPa) — Şekil Değiştirme ε</h4>
            <div class="slc-legend">
              <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${accentColor()}"></i>Mühendislik σ–ε</span>
              <span class="slc-legend-item"><i class="slc-legend-swatch slc-legend-dash" style="border-color:${COL_BLUE}"></i>Gerçek σ_T–ε_T</span>
              <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_OK}"></i>Rezilyans U_r</span>
            </div>
          </div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-curve aria-label="Gerilme şekil değiştirme diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\sigma = \\frac{F}{A_0}, \\qquad \\varepsilon = \\frac{\\Delta L}{L_0}, \\qquad \\sigma_T = \\sigma(1+\\varepsilon), \\qquad \\varepsilon_T = \\ln(1+\\varepsilon)',
        'U_r = \\int_0^{\\varepsilon_y} \\sigma\\,d\\varepsilon = \\frac{\\sigma_y^2}{2E}, \\qquad U_t = \\int_0^{\\varepsilon_f} \\sigma\\,d\\varepsilon',
      ],
      paragraphs: [
        'Elastik bölgede gerilme-şekil değiştirme doğrusaldır (Hooke yasası $\\sigma = E\\varepsilon$). Belirgin akma düzlüğü göstermeyen alüminyum ve bakır gibi metallerde akma dayanımı $\\varepsilon = 0.002$ (%0.2) ofset doğrusunun eğriyi kestiği nokta olarak tanımlanır.',
        'UTS tepe noktasından sonra plastik deformasyon numunenin ortasında yoğunlaşır (**boyun verme**); kesit hızla daraldığı için mühendislik gerilmesi düşerken gerçek gerilme $\\sigma_T$ kopmaya kadar artmaya devam eder.',
      ],
      tasks: [
        '**Yapı Çeliği** ile **Seramik** malzemelerinin tokluk modülü $U_t$ ve elastisite modülü $E$ değerlerini karşılaştır: hangisi daha rijit, hangisi darbe altında daha fazla enerji yutar?',
        '**Alüminyum (6061-T6)** senaryosunda %0.2 ofset doğrusunun eğriyi hangi gerilme değerinde kestiğini grafikte incele.',
        'Deney ilerleme sürgüsünü UTS noktasının ötesine taşıyarak numune ortasındaki boyun vermeyi ve kopma anını gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const stageBadge = host.querySelector('[data-stage-badge]');
  const curLbl = host.querySelector('[data-cur-lbl]');
  const btnPlay = host.querySelector('[data-play]');

  const selMat = addSelect(ctrls, 'Malzeme', Object.entries(TENSILE_MATERIALS).map(([k, v]) => [k, v.name]), st.mat, v => {
    st.mat = v; st.progress = 0; update();
  });
  const sProg = addSlider(ctrls, {
    label: 'Çekme İlerlemesi (ε / ε_f)', min: 0, max: 1.05, step: 0.005, value: st.progress,
    fmt: v => (v > 1 ? 'Koptu' : `%${fmtFix(v * 100, 1)}`),
    onInput: v => { st.progress = v; renderLive(); },
  });
  addToggle(ctrls, 'Gerçek gerilme eğrisini (σ_T) göster', st.showTrue, v => { st.showTrue = v; cvCurve.render(); });

  const cvBar = setupCanvas(host.querySelector('[data-cv-bar]'), () => 132, (c, W, H) => {
    const cvData = st.curve;
    if (!cvData) return;
    c.clearRect(0, 0, W, H);
    const cy = H * 0.52;
    const fractured = st.progress > 1.0;
    const epsCur = Math.min(cvData.ef, st.progress * cvData.ef);
    const visualStretch = cvData.kind === 'brittle' ? epsCur * 28 : Math.min(0.42, epsCur * 0.82);

    const baseLen = Math.min(W * 0.54, 280);
    const curLen = baseLen * (1 + visualStretch);
    const xL = (W - curLen) * 0.5;
    const xR = xL + curLen;
    const r0 = 16;
    const uniformR = r0 / Math.sqrt(1 + Math.min(0.6, epsCur));
    const neckFrac = (!fractured && cvData.kind !== 'brittle' && epsCur > cvData.eu)
      ? Math.min(1, (epsCur - cvData.eu) / Math.max(1e-5, cvData.ef - cvData.eu))
      : (fractured && cvData.kind !== 'brittle' ? 1 : 0);

    const drawHalf = (fromX, toX, side) => {
      const steps = 28;
      c.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const x = fromX + f * (toX - fromX);
        const distMid = Math.abs(x - W * 0.5) / (curLen * 0.5);
        const neckDrop = neckFrac * 0.48 * Math.exp(-Math.pow(distMid / 0.24, 2));
        const r = Math.max(4, uniformR * (1 - neckDrop));
        i === 0 ? c.moveTo(x, cy - r) : c.lineTo(x, cy - r);
      }
      for (let i = steps; i >= 0; i--) {
        const f = i / steps;
        const x = fromX + f * (toX - fromX);
        const distMid = Math.abs(x - W * 0.5) / (curLen * 0.5);
        const neckDrop = neckFrac * 0.48 * Math.exp(-Math.pow(distMid / 0.24, 2));
        const r = Math.max(4, uniformR * (1 - neckDrop));
        c.lineTo(x, cy + r);
      }
      c.closePath();
      const grad = c.createLinearGradient(0, cy - r0, 0, cy + r0);
      grad.addColorStop(0, 'rgba(255,255,255,.35)');
      grad.addColorStop(0.5, fractured ? 'rgba(255,107,107,.55)' : 'rgba(90,176,255,.45)');
      grad.addColorStop(1, 'rgba(255,255,255,.15)');
      c.fillStyle = grad; c.fill();
      c.strokeStyle = fractured ? COL_BAD : COL_FG; c.lineWidth = 1.6; c.stroke();
      void side;
    };

    // Grips at both ends
    c.fillStyle = 'rgba(255,255,255,.14)'; c.strokeStyle = COL_MUTE; c.lineWidth = 1.5;
    c.fillRect(xL - 22, cy - 26, 22, 52); c.strokeRect(xL - 22, cy - 26, 22, 52);
    c.fillRect(xR, cy - 26, 22, 52); c.strokeRect(xR, cy - 26, 22, 52);

    if (fractured) {
      const gap = 12;
      drawHalf(xL, W * 0.5 - gap, -1);
      drawHalf(W * 0.5 + gap, xR, 1);
      c.fillStyle = COL_BAD; c.font = '700 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText('KOPMA!', W * 0.5, 20);
    } else {
      drawHalf(xL, xR, 0);
      drawArrow(c, xL - 24, cy, xL - 44, cy, COL_WARN, 2.2);
      drawArrow(c, xR + 24, cy, xR + 44, cy, COL_WARN, 2.2);
    }

    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText(`Uzama ε = %${fmtFix(epsCur * 100, cvData.kind === 'brittle' ? 3 : 1)}`, W * 0.5, H - 10);
  }, clean);

  const cvCurve = setupCanvas(host.querySelector('[data-cv-curve]'), () => 250, (c, W, H) => {
    const cvData = st.curve;
    if (!cvData) return;
    c.clearRect(0, 0, W, H);
    const padL = 52, padR = 16, padT = 18, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;
    const maxEps = Math.max(cvData.ef * 1.12, 0.0012);
    const maxSig = Math.max(cvData.uts * (st.showTrue && cvData.kind !== 'brittle' ? 1.38 : 1.18), 40);
    const toX = e => padL + (e / maxEps) * pw;
    const toY = s => padT + (1 - s / maxSig) * ph;
    const acc = accentColor();

    // Grid & axes
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = padT + (ph * i) / 4;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke();
    }
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    // Toughness area shading
    c.fillStyle = acc; c.globalAlpha = 0.10;
    c.beginPath(); c.moveTo(toX(0), toY(0));
    cvData.eps.forEach((e, i) => c.lineTo(toX(e), toY(cvData.sigma[i])));
    c.lineTo(toX(cvData.ef), toY(0)); c.closePath(); c.fill();

    // Resilience triangle shading (up to ey)
    c.fillStyle = COL_OK; c.globalAlpha = 0.30;
    c.beginPath(); c.moveTo(toX(0), toY(0)); c.lineTo(toX(cvData.ey), toY(cvData.sy)); c.lineTo(toX(cvData.ey), toY(0)); c.closePath(); c.fill();
    c.globalAlpha = 1;

    // 0.2% offset line (for ductile materials)
    if (cvData.kind !== 'brittle' && 0.002 < maxEps) {
      c.strokeStyle = COL_WARN; c.setLineDash([4, 3]); c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(toX(0.002), toY(0)); c.lineTo(toX(cvData.ey02), toY(cvData.sy02)); c.stroke();
      c.setLineDash([]);
    }

    // True stress curve (up to necking)
    if (st.showTrue && cvData.kind !== 'brittle') {
      c.strokeStyle = COL_BLUE; c.setLineDash([5, 4]); c.lineWidth = 1.8;
      c.beginPath();
      cvData.trueEps.forEach((e, i) => {
        if (e > maxEps) return;
        i === 0 ? c.moveTo(toX(e), toY(cvData.trueSigma[i])) : c.lineTo(toX(e), toY(cvData.trueSigma[i]));
      });
      c.stroke(); c.setLineDash([]);
    }

    // Engineering stress-strain curve
    c.strokeStyle = acc; c.lineWidth = 2.4;
    c.beginPath();
    cvData.eps.forEach((e, i) => { i === 0 ? c.moveTo(toX(e), toY(cvData.sigma[i])) : c.lineTo(toX(e), toY(cvData.sigma[i])); });
    c.stroke();

    // Key point dots (Yield, UTS)
    c.fillStyle = COL_WARN; c.beginPath(); c.arc(toX(cvData.ey02), toY(cvData.sy02), 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = COL_BAD; c.beginPath(); c.arc(toX(cvData.eu), toY(cvData.uts), 4, 0, Math.PI * 2); c.fill();

    // Live cursor on curve
    const epsCur = Math.min(cvData.ef, st.progress * cvData.ef);
    const sigCur = st.progress > 1 ? 0 : cvData.stressAt(epsCur);
    c.fillStyle = '#fff'; c.strokeStyle = acc; c.lineWidth = 2.4;
    c.beginPath(); c.arc(toX(epsCur), toY(sigCur), 5.5, 0, Math.PI * 2); c.fill(); c.stroke();

    // Axis ticks
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    c.textAlign = 'right';
    c.fillText(`${fmtFix(maxSig, 0)}`, padL - 5, padT + 6);
    c.fillText(`${fmtFix(maxSig * 0.5, 0)}`, padL - 5, padT + ph * 0.5 + 3);
    c.fillText('0', padL - 5, padT + ph + 3);
    c.textAlign = 'left'; c.fillText('σ (MPa)', padL + 4, 13);
    c.textAlign = 'right'; c.fillText(`Şekil Değiştirme ε (maks %${fmtFix(maxEps * 100, cvData.kind === 'brittle' ? 2 : 0)})`, W - padR, H - 6);
  }, clean);

  function renderLive() {
    const cvData = st.curve;
    if (!cvData) return;
    const epsCur = Math.min(cvData.ef, st.progress * cvData.ef);
    const sigCur = st.progress > 1 ? 0 : cvData.stressAt(epsCur);
    let stage = 'Elastik Bölge';
    if (st.progress > 1) stage = 'KOPMA (Kırılma)';
    else if (cvData.kind !== 'brittle' && epsCur > cvData.eu) stage = 'Boyun Verme (Necking)';
    else if (epsCur > cvData.ey) stage = 'Plastik Pekleşme';
    stageBadge.textContent = stage;
    stageBadge.className = `slc-badge ${st.progress > 1 ? 'slc-badge-bad' : epsCur > cvData.eu ? 'slc-badge-warn' : 'slc-badge-acc'}`;
    curLbl.textContent = `ε = %${fmtFix(epsCur * 100, cvData.kind === 'brittle' ? 3 : 2)} · σ = ${fmtFix(sigCur, 1)} MPa`;
    cvBar.render(); cvCurve.render();
  }

  function update() {
    st.curve = evaluateTensileCurve(st.mat);
    const c = st.curve;
    renderKpis(kpis, [
      { lbl: 'Elastisite Modülü E', val: `${fmtFix(c.E_GPa, 1)} GPa`, sub: c.kind === 'brittle' ? 'Gevrek doğrusal' : `Akma ε_y = %${fmtFix(c.ey * 100, 2)}` },
      { lbl: 'Akma / UTS', val: `${fmtFix(c.sy02, 0)} / ${fmtFix(c.uts, 0)} MPa`, sub: c.kind === 'brittle' ? 'Akma yok (gevrek)' : '%0.2 ofset akma', tone: 'acc' },
      { lbl: 'Rezilyans U_r', val: `${fmtNum(c.resilience_MJm3, 3)} MJ/m³`, sub: 'Elastik enerji alanı', tone: 'ok' },
      { lbl: 'Tokluk U_t', val: `${fmtNum(c.toughness_MJm3, 3)} MJ/m³`, sub: `Süneklik %EL = %${fmtFix(c.ductilityPct, c.kind === 'brittle' ? 2 : 1)}` },
    ]);
    renderLive();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.progress += dt * 0.22;
    if (st.progress > 1.08) st.progress = 0;
    sProg.set(Math.min(1.05, st.progress));
    renderLive();
    return true;
  }, clean);

  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.progress = 0; sProg.set(0); renderLive(); });
  bindPresets(host, TENSILE_PRESETS, p => { st.mat = p.mat; selMat.set(st.mat); st.progress = 0.45; sProg.set(st.progress); update(); });

  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 11. KRİSTAL YAPILAR, MİLLER İNDİSLERİ & XRD (field: malzeme)
// =====================================================================

const CRYS_UI_PRESETS = Object.entries(CRYSTAL_PRESETS).map(([k, v]) => ({ key: k, ...v }));

function mountCrystalStructures(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    lattice: 'FCC', a_A: 3.615, c_A: 5.211, aw: 63.546,
    h: 1, k: 1, l: 1, u: 1, v: 1, w: 0,
    lambda_A: 1.5406, radiusScale: 0.45,
    yaw: 0.58, pitch: 0.38,
    playing: autoPlayAllowed(),
    info: null, peaks: [],
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('SC, BCC, FCC ve HCP birim hücrelerini <b>sürükleyerek 3B döndür</b>; atomik dolgu faktörü (APF), koordinasyon sayısı, kuramsal yoğunluk, <b>(hkl) Miller düzlemi</b> ve <b>Bragg yasası X-ışını kırınım (XRD)</b> desenini canlı incele.', CRYS_UI_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-lat aria-label="Kristal kafes tipi">
        <button type="button" data-l="SC">SC</button>
        <button type="button" data-l="BCC">BCC</button>
        <button type="button" data-l="FCC" class="on">FCC</button>
        <button type="button" data-l="HCP">HCP</button>
      </div>
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Görünümü sıfırla</button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">3B Birim Hücre & Miller (hkl) / [uvw]</h4><span class="slc-hint">Döndürmek için sürükle</span></div>
            <div class="slc-cv-box"><canvas class="slc-cv slc-cv-drag" data-cv-3d aria-label="Döndürülebilir 3B kristal birim hücre"></canvas></div>
          </div>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">XRD Kırınım Deseni (Bragg Yasası)</h4><span class="slc-hint mono" data-xrd-lbl></span></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-xrd aria-label="Bragg yasası XRD pik grafiği"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{APF} = \\frac{n\\,\\frac{4}{3}\\pi R^3}{V_c}, \\qquad \\rho = \\frac{n\\,A_w}{V_c\\,N_A}',
        '2\\,d_{hkl}\\sin\\theta = \\lambda, \\qquad d_{hkl,\\text{kübik}} = \\frac{a}{\\sqrt{h^2 + k^2 + l^2}}',
      ],
      paragraphs: [
        'Sıkı paketli FCC ve ideal HCP yapılar maksimum atomik dolgu faktörüne ($\\text{APF} = \\pi\\sqrt{2}/6 \\approx 0.7405$) ve 12 koordinasyon sayısına ulaşır. BCC yapısında $\\text{APF} \\approx 0.6802$, basit kübik SC yapısında ise $\\approx 0.5236$\'dır.',
        'Yapı faktörü seçim kuralları hangi düzlemlerin XRD piki vereceğini belirler: BCC\'de yalnızca $h+k+l$ çift olanlar, FCC\'de ise $(h,k,l)$ tümü tek veya tümü çift olanlar (ör. $(111), (200), (220)$) kırınım verir.',
      ],
      tasks: [
        '**Bakır (FCC)** ile **Demir α-Fe (BCC)** senaryolarını karşılaştırarak ilk iki XRD pikinin FCC\'de $(111), (200)$, BCC\'de ise $(110), (200)$ olduğunu doğrula.',
        'Küresel atom dolgu ölçeğini %100 (sert küre teması) konumuna getirip FCC\'de atomların yüzey köşegeni boyunca, BCC\'de ise cisim köşegeni boyunca temas ettiğini gözlemle.',
        'Miller indislerini $(100)$, $(110)$ ve $(111)$ olarak değiştirip düzlemler arası mesafe $d_{hkl}$ değişimini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const xrdLbl = host.querySelector('[data-xrd-lbl]');
  const btnPlay = host.querySelector('[data-play]');

  const sA = addSlider(ctrls, { label: 'Kafes Parametresi a', unit: 'Å', min: 2.2, max: 5.5, step: 0.01, value: st.a_A, onInput: v => { st.a_A = v; update(); } });
  const sC = addSlider(ctrls, { label: 'HCP Yüksekliği c', unit: 'Å', min: 3.5, max: 8.5, step: 0.02, value: st.c_A, onInput: v => { st.c_A = v; update(); } });
  const sAw = addSlider(ctrls, { label: 'Atom Ağırlığı A_w', unit: 'g/mol', min: 10, max: 210, step: 0.5, value: st.aw, onInput: v => { st.aw = v; update(); } });
  const sRad = addSlider(ctrls, { label: 'Atom Küre Ölçeği', min: 0.25, max: 1.0, step: 0.05, value: st.radiusScale, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.radiusScale = v; cv3d.render(); } });
  const selHkl = addSelect(ctrls, 'Miller Düzlemi (hkl)', [
    ['1,1,1', '(111) — Sıkı Paket Düzlem'], ['1,0,0', '(100) — Küp Yüzeyi'], ['1,1,0', '(110) — Köşegen Düzlem'],
    ['2,0,0', '(200)'], ['1,1,2', '(112)'], ['1,0,1', '(101)'],
  ], '1,1,1', v => { const [h, k, l] = v.split(',').map(Number); st.h = h; st.k = k; st.l = l; update(); });
  const selUvw = addSelect(ctrls, 'Kristal Doğrultusu [uvw]', [
    ['1,1,0', '[110] — Yüzey Köşegeni'], ['1,1,1', '[111] — Cisim Köşegeni'], ['1,0,0', '[100] — Kenar'], ['1,0,1', '[101]'],
  ], '1,1,0', v => { const [u, vx, w] = v.split(',').map(Number); st.u = u; st.v = vx; st.w = w; cv3d.render(); });
  const selLam = addSelect(ctrls, 'X-Işını Kaynağı (λ)', [
    ['1.5406', 'Cu Kα (1.5406 Å)'], ['0.7107', 'Mo Kα (0.7107 Å)'], ['1.7890', 'Co Kα (1.7890 Å)'],
  ], '1.5406', v => { st.lambda_A = +v; update(); });

  const project3D = (x, y, z, W, H, sc) => {
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
    const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const persp = 4.6 / (4.6 - z2);
    return { sx: W * 0.5 + x1 * sc * persp, sy: H * 0.52 - y2 * sc * persp, z: z2, persp };
  };

  const cv3d = setupCanvas(host.querySelector('[data-cv-3d]'), () => 280, (c, W, H) => {
    const info = st.info;
    if (!info) return;
    c.clearRect(0, 0, W, H);
    const sc = Math.min(W, H) * (st.lattice === 'HCP' ? 0.25 : 0.42);
    const acc = accentColor();
    const isHcp = st.lattice === 'HCP';
    const shift = p => isHcp ? [p[0], p[2] - 0.5 * info.caRatio, p[1]] : [p[0] - 0.5, p[2] - 0.5, p[1] - 0.5];

    // Draw wireframe edges
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.3;
    if (!isHcp) {
      const verts = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const proj = verts.map(v => project3D(...shift(v), W, H, sc));
      edges.forEach(([i, j]) => {
        c.beginPath(); c.moveTo(proj[i].sx, proj[i].sy); c.lineTo(proj[j].sx, proj[j].sy); c.stroke();
      });

      // Shaded Miller plane (hkl)
      const poly = millerPlanePolygon(st.h, st.k, st.l);
      if (poly.length >= 3) {
        c.save();
        c.fillStyle = acc; c.globalAlpha = 0.26;
        c.beginPath();
        poly.forEach((p, idx) => {
          const pp = project3D(...shift(p), W, H, sc);
          idx === 0 ? c.moveTo(pp.sx, pp.sy) : c.lineTo(pp.sx, pp.sy);
        });
        c.closePath(); c.fill();
        c.globalAlpha = 0.9; c.strokeStyle = acc; c.lineWidth = 1.8; c.stroke();
        c.restore();
      }

      // Direction vector [uvw]
      const p0 = project3D(...shift([0, 0, 0]), W, H, sc);
      const m = Math.max(Math.abs(st.u), Math.abs(st.v), Math.abs(st.w), 1);
      const p1 = project3D(...shift([st.u / m, st.v / m, st.w / m]), W, H, sc);
      drawArrow(c, p0.sx, p0.sy, p1.sx, p1.sy, COL_WARN, 2.4, `[${st.u}${st.v}${st.w}]`);
    } else {
      const ca = info.caRatio;
      const top = [], bot = [];
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        bot.push(project3D(...shift([Math.cos(a), Math.sin(a), 0]), W, H, sc));
        top.push(project3D(...shift([Math.cos(a), Math.sin(a), ca]), W, H, sc));
      }
      for (let k = 0; k < 6; k++) {
        const kn = (k + 1) % 6;
        c.beginPath();
        c.moveTo(bot[k].sx, bot[k].sy); c.lineTo(bot[kn].sx, bot[kn].sy);
        c.moveTo(top[k].sx, top[k].sy); c.lineTo(top[kn].sx, top[kn].sy);
        c.moveTo(bot[k].sx, bot[k].sy); c.lineTo(top[k].sx, top[k].sy);
        c.stroke();
      }
    }

    // Depth-sorted spheres
    const rNorm = info.R_A / info.a_A;
    const drawList = info.atoms.map(at => {
      const pr = project3D(...shift([at.x, at.y, at.z]), W, H, sc);
      return { ...at, ...pr };
    }).sort((a, b) => a.z - b.z);

    for (const at of drawList) {
      const rPx = Math.max(5, rNorm * sc * at.persp * st.radiusScale);
      const col = at.role === 'body' ? COL_WARN : at.role === 'face' ? COL_OK : COL_BLUE;
      const g = c.createRadialGradient(at.sx - rPx * 0.3, at.sy - rPx * 0.3, rPx * 0.1, at.sx, at.sy, rPx);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.4, col);
      g.addColorStop(1, 'rgba(10,12,20,.92)');
      c.fillStyle = g;
      c.beginPath(); c.arc(at.sx, at.sy, rPx, 0, Math.PI * 2); c.fill();
    }
  }, clean);

  let lastDrag = null;
  bindDragCanvas(host.querySelector('[data-cv-3d]'), {
    onDown: p => { lastDrag = p; st.playing = false; loop.stop(); syncPlayBtn(btnPlay, false); return true; },
    onMove: (p, drag) => {
      if (!drag || !lastDrag) return;
      st.yaw += (p.x - lastDrag.x) * 0.012;
      st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch + (p.y - lastDrag.y) * 0.012));
      lastDrag = p;
      cv3d.render();
    },
    onUp: () => { lastDrag = null; },
  }, clean);

  const cvXrd = setupCanvas(host.querySelector('[data-cv-xrd]'), () => 280, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const padL = 42, padR = 14, padT = 24, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;
    const acc = accentColor();
    const toX = tt => padL + ((tt - 15) / 105) * pw;
    const toY = inten => padT + (1 - inten / 115) * ph;

    // Grid & axes
    c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    // Lorentzian broadened XRD trace
    c.strokeStyle = acc; c.lineWidth = 1.8;
    c.beginPath();
    for (let i = 0; i <= 260; i++) {
      const tt = 15 + (105 * i) / 260;
      let val = 1.5;
      for (const pk of st.peaks) {
        const d = tt - pk.twoTheta;
        val += pk.relIntensity / (1 + (d / 0.55) ** 2);
      }
      const x = toX(tt), y = toY(Math.min(112, val));
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();

    // Peak labels for strongest reflections
    c.fillStyle = COL_FG; c.font = '600 9.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
    st.peaks.slice(0, 6).forEach(pk => {
      const x = toX(pk.twoTheta), y = toY(pk.relIntensity);
      if (x > padL + 10 && x < W - padR - 10) {
        c.fillText(pk.label, x, Math.max(14, y - 6));
      }
    });

    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    for (const deg of [20, 40, 60, 80, 100, 120]) {
      const x = toX(deg);
      c.fillText(`${deg}°`, x, padT + ph + 15);
    }
    c.textAlign = 'right'; c.fillText('2θ (derece)', W - padR, H - 3);
    c.textAlign = 'left'; c.fillText('Şiddet', 6, padT + 6);
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.yaw += dt * 0.48;
    cv3d.render();
    return true;
  }, clean);

  function update() {
    sC.setVisible(st.lattice === 'HCP');
    st.info = analyzeCrystal({ lattice: st.lattice, a_A: st.a_A, c_A: st.c_A, aw: st.aw });
    st.peaks = computeXRD({ lattice: st.lattice, a_A: st.a_A, c_A: st.info.c_A, lambda_A: st.lambda_A });
    const dHkl = millerSpacing({ lattice: st.lattice, a_A: st.a_A, c_A: st.info.c_A, h: st.h, k: st.k, l: st.l });
    xrdLbl.textContent = `${st.peaks.length} pik · λ=${st.lambda_A} Å`;
    host.querySelectorAll('[data-lat] button').forEach(b => b.classList.toggle('on', b.dataset.l === st.lattice));

    renderKpis(kpis, [
      { lbl: 'Atomik Dolgu (APF)', val: `%${fmtFix(st.info.APF * 100, 2)}`, sub: `n = ${st.info.nAtoms} atom · CN = ${st.info.CN}`, tone: 'acc' },
      { lbl: 'Kuramsal Yoğunluk ρ', val: `${fmtFix(st.info.density_gcm3, 2)} g/cm³`, sub: `R = ${fmtFix(st.info.R_A, 3)} Å`, tone: 'ok' },
      { lbl: `Düzlem Aralığı d(${st.h}${st.k}${st.l})`, val: `${fmtFix(dHkl, 3)} Å`, sub: `V_c = ${fmtFix(st.info.Vc_A3, 1)} Å³` },
      { lbl: 'İlk XRD Piki (2θ₁)', val: st.peaks[0] ? `${fmtFix(st.peaks[0].twoTheta, 2)}°` : '—', sub: st.peaks[0] ? `${st.peaks[0].label} · d=${fmtFix(st.peaks[0].d_A, 3)} Å` : '' },
    ]);
    cv3d.render(); cvXrd.render();
  }

  host.querySelector('[data-lat]').addEventListener('click', e => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    st.lattice = b.dataset.l;
    if (st.lattice === 'HCP') st.c_A = +(st.a_A * Math.sqrt(8 / 3)).toFixed(3);
    sC.set(st.c_A);
    update(); syncSegments(host, false);
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.yaw = 0.58; st.pitch = 0.38; cv3d.render(); });
  bindPresets(host, CRYS_UI_PRESETS, p => {
    st.lattice = p.lattice; st.a_A = p.a_A; st.c_A = p.c_A; st.aw = p.aw;
    sA.set(st.a_A); sC.set(st.c_A); sAw.set(st.aw);
    update();
  });

  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 12. FAZ DİYAGRAMLARI (Cu-Ni, Pb-Sn, Fe-Fe3C) (field: malzeme)
// =====================================================================

const PHASE_PRESETS = [
  { label: 'Cu–Ni İki Fazlı (50% Ni)', sys: 'iso', C0: 50, T: 1290 },
  { label: 'Pb–Sn Ötektik Altı (40% Sn)', sys: 'eut', C0: 40, T: 150 },
  { label: 'Ötektoid Çelik (%0.76 C)', sys: 'fe', C0: 0.76, T: 650 },
  { label: 'Hipoötektoid Çelik (%0.40 C)', sys: 'fe', C0: 0.40, T: 650 },
];

function mountPhaseDiagrams(host, ctx) {
  const clean = createClean(ctx);
  const st = { sys: 'fe', C0: 0.40, T: 650, res: null };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Diyagram üzerinde dokunup sürükleyerek</b> (C₀, T) çalışma noktasını taşı; bağ çizgisi (tie-line), <b>kaldıraç kuralı</b> faz oranları ve beklenen <b>mikroyapı eskizi</b> anında güncellenir.', PHASE_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-psys aria-label="Faz diyagramı sistemi">
        <button type="button" data-s="iso">İzomorf (Cu–Ni)</button>
        <button type="button" data-s="eut">Ötektik (Pb–Sn)</button>
        <button type="button" data-s="fe" class="on">Demir–Karbon (Fe–Fe₃C)</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-reg-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel">
        <div data-ctrls></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title">Mikroyapı Eskizi</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-micro aria-label="Beklenen mikroyapı çizimi"></canvas></div>
          <div class="slc-hint" data-micro-txt></div>
        </div>
      </div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title">İkili Faz Diyagramı (Noktayı Sürükle)</h4><span class="slc-hint mono" data-pt-lbl></span></div>
          <div class="slc-cv-box"><canvas class="slc-cv slc-cv-drag" data-cv-pd aria-label="Etkileşimli ikili faz diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'W_\\alpha = \\frac{C_\\beta - C_0}{C_\\beta - C_\\alpha}, \\qquad W_\\beta = \\frac{C_0 - C_\\alpha}{C_\\beta - C_\\alpha}, \\qquad W_\\alpha + W_\\beta = 1',
        '\\gamma\\,(0.76\\%\\text{ C}) \\xrightarrow{727^\\circ\\text{C}} \\alpha\\,(0.022\\%\\text{ C}) + \\text{Fe}_3\\text{C}\\,(6.67\\%\\text{ C}) \\quad (\\text{Perlit})',
      ],
      paragraphs: [
        'İki fazlı bölgede sabit sıcaklık yatay bağ çizgisi (tie-line) iki faz sınırını $C_\\alpha$ ve $C_\\beta$ bileşimlerinde keser; kaldıraç kuralı kütlece faz oranlarını ters kol uzunluklarıyla verir.',
        'Fe–$\\text{Fe}_3\\text{C}$ sisteminde iki temel invaryant tepkime vardır: $727^\\circ\\text{C}$ ve $\\%0.76\\text{ C}$ noktasındaki **ötektoid** (perlit) dönüşümü ile $1147^\\circ\\text{C}$ ve $\\%4.30\\text{ C}$ noktasındaki **ötektik** (ledebürit) dönüşümü.',
      ],
      tasks: [
        '**Cu–Ni** sisteminde noktayı $(50\\%\\text{ Ni}, 1290^\\circ\\text{C})$ konumuna sürükleyip $W_L C_L + W_\\alpha C_\\alpha = C_0$ kütle dengesini doğrula.',
        '**Pb–Sn** sisteminde ötektik nokta $(61.9\\%\\text{ Sn}, 183^\\circ\\text{C})$ altına inerek %100 lamelli ötektik mikroyapıyı gör.',
        '**Fe–Fe₃C** diyagramında %0.40 C (hipoötektoid) ve %1.20 C (hiperötektoid) çeliklerin $650^\\circ\\text{C}$\'deki ferrit, sementit ve perlit oranlarını karşılaştır.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const regBadge = host.querySelector('[data-reg-badge]');
  const ptLbl = host.querySelector('[data-pt-lbl]');
  const microTxt = host.querySelector('[data-micro-txt]');

  const sC0 = addSlider(ctrls, { label: 'Alaşım Bileşimi C₀', unit: 'wt%', min: 0, max: 6.67, step: 0.05, value: st.C0, onInput: v => { st.C0 = v; update(); } });
  const sT = addSlider(ctrls, { label: 'Sıcaklık T', unit: '°C', min: 400, max: 1600, step: 5, value: st.T, onInput: v => { st.T = v; update(); } });

  function bounds() {
    if (st.sys === 'iso') return { cMin: 0, cMax: 100, tMin: 1000, tMax: 1520, xLbl: 'wt% Ni' };
    if (st.sys === 'eut') return { cMin: 0, cMax: 100, tMin: 0, tMax: 360, xLbl: 'wt% Sn' };
    return { cMin: 0, cMax: 6.67, tMin: 400, tMax: 1600, xLbl: 'wt% C' };
  }

  let pdBox = { padL: 52, padR: 18, padT: 20, padB: 32, pw: 300, ph: 240 };

  const cvPd = setupCanvas(host.querySelector('[data-cv-pd]'), w => Math.min(360, Math.max(270, w * 0.65)), (c, W, H) => {
    const b = bounds();
    const padL = 52, padR = 18, padT = 20, padB = 32;
    const pw = W - padL - padR, ph = H - padT - padB;
    pdBox = { padL, padR, padT, padB, pw, ph };
    const toX = comp => padL + ((comp - b.cMin) / (b.cMax - b.cMin)) * pw;
    const toY = temp => padT + (1 - (temp - b.tMin) / (b.tMax - b.tMin)) * ph;
    const acc = accentColor();

    c.clearRect(0, 0, W, H);
    // Axes & grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = padT + (ph * i) / 4;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke();
    }
    c.strokeStyle = COL_AXIS; c.lineWidth = 1.3;
    c.strokeRect(padL, padT, pw, ph);

    const drawPoly = (pts, color = COL_FG, lw = 2) => {
      c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
      pts.forEach(([cc, tt], i) => { i === 0 ? c.moveTo(toX(cc), toY(tt)) : c.lineTo(toX(cc), toY(tt)); });
      c.stroke();
    };
    const labelAt = (cc, tt, txt, col = COL_MUTE) => {
      c.fillStyle = col; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(txt, toX(cc), toY(tt));
    };

    if (st.sys === 'iso') {
      const liq = [], sol = [];
      for (let i = 0; i <= 60; i++) {
        const x = i / 60;
        liq.push([x * 100, 1085 + 370 * x + 180 * x * (1 - x)]);
        sol.push([x * 100, 1085 + 370 * x - 40 * x * (1 - x)]);
      }
      drawPoly(liq, COL_BLUE, 2.2);
      drawPoly(sol, COL_OK, 2.2);
      labelAt(28, 1410, 'L (Sıvı)', COL_BLUE);
      labelAt(50, 1288, 'α + L', acc);
      labelAt(72, 1140, 'α (Katı)', COL_OK);
    } else if (st.sys === 'eut') {
      // Liquidus
      const liqL = [], liqR = [];
      for (let i = 0; i <= 30; i++) {
        const x1 = (61.9 * i) / 30;
        liqL.push([x1, 327 - (327 - 183) * Math.pow(x1 / 61.9, 1.05)]);
        const x2 = 61.9 + ((100 - 61.9) * i) / 30;
        liqR.push([x2, 232 - (232 - 183) * Math.pow((100 - x2) / (100 - 61.9), 1.05)]);
      }
      drawPoly(liqL, COL_BLUE, 2.2); drawPoly(liqR, COL_BLUE, 2.2);
      drawPoly([[0, 327], [18.3, 183], [97.8, 183], [100, 232]], COL_OK, 2);
      // Solvus curves
      const sL = [], sR = [];
      for (let i = 0; i <= 20; i++) {
        const T = (183 * i) / 20;
        sL.push([2.0 + (18.3 - 2.0) * Math.pow(T / 183, 2.2), T]);
        sR.push([99.5 - (99.5 - 97.8) * Math.pow(T / 183, 2.2), T]);
      }
      drawPoly(sL, COL_WARN, 1.8); drawPoly(sR, COL_WARN, 1.8);
      labelAt(50, 310, 'L', COL_BLUE); labelAt(8, 150, 'α', COL_OK); labelAt(50, 100, 'α + β', COL_MUTE);
      labelAt(25, 220, 'α+L'); labelAt(82, 200, 'β+L');
      // Eutectic point dot
      c.fillStyle = COL_WARN; c.beginPath(); c.arc(toX(61.9), toY(183), 4, 0, Math.PI * 2); c.fill();
    } else {
      // Fe-Fe3C simplified textbook boundaries
      drawPoly([[0, 1538], [4.30, 1147], [6.67, 1600]], COL_BLUE, 2.2);
      drawPoly([[0, 1538], [2.14, 1147], [6.67, 1147]], COL_OK, 2);
      drawPoly([[0, 912], [0.76, 727], [2.14, 1147]], COL_WARN, 2);
      drawPoly([[0.022, 727], [6.67, 727]], COL_WARN, 2);
      drawPoly([[0, 912], [0.022, 727], [0.008, 400]], COL_OK, 1.8);
      labelAt(3.0, 1460, 'L', COL_BLUE);
      labelAt(0.95, 1020, 'γ (Östenit)', COL_OK);
      labelAt(3.2, 600, 'α + Fe₃C (Perlit + ...)', COL_MUTE);
      labelAt(4.2, 950, 'γ + Fe₃C', COL_MUTE);
      labelAt(1.8, 1280, 'γ+L');
      // Key invariant points (Eutectoid & Eutectic)
      c.fillStyle = COL_WARN;
      c.beginPath(); c.arc(toX(0.76), toY(727), 4.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(toX(4.30), toY(1147), 4.5, 0, Math.PI * 2); c.fill();
    }

    // Lever rule tie-line & active point
    const r = st.res;
    if (r?.tie) {
      const yT = toY(r.tie.T);
      c.strokeStyle = COL_BAD; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(toX(r.tie.cLeft), yT); c.lineTo(toX(r.tie.cRight), yT); c.stroke();
      for (const cx of [r.tie.cLeft, r.tie.cRight]) {
        c.fillStyle = COL_BAD; c.beginPath(); c.arc(toX(cx), yT, 4.2, 0, Math.PI * 2); c.fill();
      }
    }
    const px = toX(st.C0), py = toY(st.T);
    c.fillStyle = acc; c.strokeStyle = '#fff'; c.lineWidth = 2.2;
    c.beginPath(); c.arc(px, py, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();

    // Axis labels
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    c.textAlign = 'right';
    c.fillText(`${b.tMax}°`, padL - 5, padT + 6);
    c.fillText(`${Math.round(0.5 * (b.tMin + b.tMax))}°`, padL - 5, padT + ph * 0.5 + 3);
    c.fillText(`${b.tMin}°`, padL - 5, padT + ph + 3);
    c.textAlign = 'center';
    c.fillText(`${b.cMin}`, padL, H - 10);
    c.fillText(`${fmtFix(0.5 * (b.cMin + b.cMax), 1)}`, padL + pw * 0.5, H - 10);
    c.fillText(`${b.cMax} ${b.xLbl}`, padL + pw - 22, H - 10);
  }, clean);

  function setFromCanvasPt(p) {
    const b = bounds();
    const u = Math.max(0, Math.min(1, (p.x - pdBox.padL) / Math.max(1, pdBox.pw)));
    const v = Math.max(0, Math.min(1, 1 - (p.y - pdBox.padT) / Math.max(1, pdBox.ph)));
    st.C0 = +(b.cMin + u * (b.cMax - b.cMin)).toFixed(st.sys === 'fe' ? 2 : 1);
    st.T = Math.round(b.tMin + v * (b.tMax - b.tMin));
    sC0.set(st.C0); sT.set(st.T);
    update();
  }
  bindDragCanvas(host.querySelector('[data-cv-pd]'), {
    onDown: p => { setFromCanvasPt(p); return true; },
    onMove: (p, drag) => { if (drag) setFromCanvasPt(p); },
  }, clean);

  const cvMicro = setupCanvas(host.querySelector('[data-cv-micro]'), () => 145, (c, W, H) => {
    const r = st.res;
    if (!r) return;
    c.clearRect(0, 0, W, H);
    const reg = r.region;

    if (reg.startsWith('L (')) {
      // Uniform liquid with subtle convective arcs
      c.fillStyle = 'rgba(90,176,255,.16)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(90,176,255,.45)'; c.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        c.beginPath(); c.arc(30 + i * 48, H * (0.35 + (i % 2) * 0.3), 16, 0.2, 2.4); c.stroke();
      }
    } else if (reg.includes('+ L')) {
      // Liquid background + dendritic primary crystals
      c.fillStyle = 'rgba(90,176,255,.15)'; c.fillRect(0, 0, W, H);
      const solidFrac = r.phases.find(p => !p.name.includes('Sıvı'))?.frac ?? 0.5;
      const nGrains = Math.max(2, Math.round(solidFrac * 12));
      for (let i = 0; i < nGrains; i++) {
        const gx = ((i * 73 + 29) % (W - 40)) + 20;
        const gy = ((i * 53 + 23) % (H - 34)) + 17;
        const rad = 11 + solidFrac * 14;
        c.fillStyle = 'rgba(91,228,155,.32)'; c.strokeStyle = COL_OK; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(gx, gy, rad, rad * 0.72, i * 0.9, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (reg.includes('α + β') || reg.includes('α + Fe₃C')) {
      // Lamellar eutectic/pearlite background + proeutectic/proeutectoid grains
      c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,209,102,.32)'; c.lineWidth = 1.3;
      for (let x = -H; x < W + H; x += 7) {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + H * 0.45, H); c.stroke();
      }
      const pro = r.proFrac || 0;
      const nPro = Math.round(pro * 10);
      for (let i = 0; i < nPro; i++) {
        const gx = ((i * 67 + 31) % (W - 36)) + 18;
        const gy = ((i * 47 + 21) % (H - 32)) + 16;
        c.fillStyle = 'rgba(91,228,155,.45)'; c.strokeStyle = COL_OK; c.lineWidth = 1.6;
        c.beginPath(); c.arc(gx, gy, 10 + pro * 13, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else {
      // Single-phase equiaxed polygonal grains
      c.fillStyle = 'rgba(91,228,155,.12)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.4;
      const cols = 5, rows = 3, cw = W / cols, ch = H / rows;
      for (let rIdx = 0; rIdx < rows; rIdx++) {
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          const x = cIdx * cw + ((rIdx % 2) * 14);
          const y = rIdx * ch;
          c.strokeRect(x, y, cw, ch);
        }
      }
    }
  }, clean);

  function syncSystemRange() {
    const b = bounds();
    sC0.setRange(b.cMin, b.cMax);
    sT.setRange(b.tMin, b.tMax);
    st.C0 = Math.max(b.cMin, Math.min(b.cMax, st.C0));
    st.T = Math.max(b.tMin, Math.min(b.tMax, st.T));
    sC0.set(st.C0); sT.set(st.T);
    host.querySelectorAll('[data-psys] button').forEach(btn => btn.classList.toggle('on', btn.dataset.s === st.sys));
  }

  function update() {
    st.res = st.sys === 'iso' ? evalIsomorphous(st.C0, st.T)
      : st.sys === 'eut' ? evalEutecticPbSn(st.C0, st.T)
        : evalFeFe3C(st.C0, st.T);
    const r = st.res;
    const b = bounds();
    regBadge.textContent = r.region;
    ptLbl.textContent = `C₀ = ${fmtFix(st.C0, st.sys === 'fe' ? 2 : 1)} ${b.xLbl} · T = ${st.T} °C`;
    microTxt.textContent = r.micro || r.region;

    const cards = [
      { lbl: 'Aktif Bölge', val: r.region, tone: 'acc' },
      ...r.phases.map(p => ({
        lbl: p.name,
        val: `%${fmtFix(p.frac * 100, 1)}`,
        sub: `Bileşim: ${fmtFix(p.comp, st.sys === 'fe' ? 2 : 1)} ${b.xLbl}`,
        tone: p.frac > 0.5 ? 'ok' : '',
      })),
    ];
    if (r.pearliteFrac !== undefined && r.pearliteFrac > 0) {
      cards.push({ lbl: 'Perlit Oranı', val: `%${fmtFix(r.pearliteFrac * 100, 1)}`, sub: `Ötektoid öncesi: %${fmtFix((r.proFrac || 0) * 100, 1)}` });
    }
    renderKpis(kpis, cards);
    cvPd.render(); cvMicro.render();
  }

  host.querySelector('[data-psys]').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b || b.dataset.s === st.sys) return;
    st.sys = b.dataset.s;
    if (st.sys === 'iso') { st.C0 = 50; st.T = 1290; }
    else if (st.sys === 'eut') { st.C0 = 40; st.T = 150; }
    else { st.C0 = 0.40; st.T = 650; }
    syncSystemRange(); update(); syncSegments(host, false);
  });
  bindPresets(host, PHASE_PRESETS, p => {
    st.sys = p.sys; st.C0 = p.C0; st.T = p.T;
    syncSystemRange(); update();
  });

  bindTasks(host);
  syncSystemRange();
  update();
  return clean.run;
}

// =====================================================================
// 13. DİFÜZYON (FİCK'İN 2. YASASI & RASTGELE YÜRÜYÜŞ) (field: malzeme)
// =====================================================================

const DIFF_UI_PRESETS = Object.entries(DIFFUSION_PRESETS).map(([k, v]) => ({ key: k, ...v }));

function mountDiffusion(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    D0: 2.3e-5, Qd_kJ: 148, T_C: 950, C0: 0.2, Cs: 1.2, t_hr: 4, Ctarget: 0.6,
    rw: createRandomWalkState(180, 'step', 77),
    playing: autoPlayAllowed(),
    lastMsd: 0,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Yarı-sonsuz katıda <b>Fick\'in 2. yasasını (erfc çözümü)</b>, karbürizasyon sertleştirme derinliğini ve <b>Arrhenius</b> sıcaklık bağımlılığını incele; altta 2B <b>atomik rastgele yürüyüş</b> simülasyonuyla makroskopik difüzyonun mikroskopik kökenini izle.', DIFF_UI_PRESETS)}
    <div class="slc-toolbar">
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Yürüyüşü sıfırla</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-d-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card" data-box-prof>
          <div class="slc-head"><h4 class="slc-title">Derişim Profili C(x, t) — Karbürizasyon (erfc)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-prof aria-label="Fick erfc derişim profili"></canvas><div class="slc-readout" data-rd-prof></div></div>
        </div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title">2B Atomik Rastgele Yürüyüş & Anlık Dağılım</h4><span class="slc-hint mono" data-rw-lbl></span></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-rw aria-label="Animasyonlu 2B rastgele yürüyüş difüzyonu"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{\\partial C}{\\partial t} = D \\frac{\\partial^2 C}{\\partial x^2} \\implies \\frac{C(x,t) - C_0}{C_s - C_0} = \\operatorname{erfc}\\!\\left(\\frac{x}{2\\sqrt{Dt}}\\right)',
        'D(T) = D_0 \\exp\\!\\left(-\\frac{Q_d}{R T}\\right), \\qquad \\langle r^2(t) \\rangle = 4 D_{\\text{eff}} t',
      ],
      paragraphs: [
        'Difüzyon katsayısı $D(T)$ sıcaklığa üstel olarak (Arrhenius) bağlıdır: karbürizasyon sıcaklığını $850^\\circ\\text{C}$\'den $1000^\\circ\\text{C}$\'ye çıkarmak aynı karbon derinliğine ulaşmak için gereken süreyi birkaç kat kısaltır.',
        'Atomik ölçekte her bir atom rastgele yönlerde ısıl sıçrama yapar; çok sayıda atomun rastgele yürüyüş ortalaması makroskopik $\\operatorname{erfc}$ profiline ve $\\sqrt{t}$ ile büyüyen nüfuz derinliğine yakınsar.',
      ],
      tasks: [
        'Karbon → $\\gamma$-Fe sisteminde süreyi $t = 2\\text{ sa}$ değerinden $8\\text{ sa}$ değerine (4 kat) çıkarıp sertleştirme derinliği $x_{\\text{hedef}}$ değerinin tam 2 kat ($\\sqrt{4}$) arttığını doğrula.',
        'Sıcaklığı $850^\\circ\\text{C}$ ile $1050^\\circ\\text{C}$ arasında kaydırıp difüzyon katsayısı $D(T)$\'nin katlanarak büyümesini gözlemle.',
        'Rastgele yürüyüş tuvalinde atomların sol bölgeden sağa doğru yayılırken ortalama karesel yer değiştirmenin $\\langle r^2 \\rangle$ zamanla doğrusal büyüdüğünü izle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const dBadge = host.querySelector('[data-d-badge]');
  const rwLbl = host.querySelector('[data-rw-lbl]');
  const cvProf = host.querySelector('[data-cv-prof]');
  const btnPlay = host.querySelector('[data-play]');

  const sT = addSlider(ctrls, { label: 'Sıcaklık T', unit: '°C', min: 350, max: 1150, step: 10, value: st.T_C, onInput: v => { st.T_C = v; update(); } });
  const sTime = addSlider(ctrls, { label: 'Difüzyon Süresi t', unit: 'saat', min: 0.25, max: 24, step: 0.25, value: st.t_hr, onInput: v => { st.t_hr = v; update(); } });
  const sQd = addSlider(ctrls, { label: 'Aktivasyon Enerjisi Q_d', unit: 'kJ/mol', min: 60, max: 220, step: 2, value: st.Qd_kJ, onInput: v => { st.Qd_kJ = v; update(); } });
  const sCs = addSlider(ctrls, { label: 'Yüzey Derişimi C_s', unit: '%', min: 0.1, max: 30, step: 0.1, value: st.Cs, onInput: v => { st.Cs = v; update(); } });
  const sC0 = addSlider(ctrls, { label: 'Başlangıç Derişimi C₀', unit: '%', min: 0, max: 5, step: 0.05, value: st.C0, onInput: v => { st.C0 = v; update(); } });
  const sCt = addSlider(ctrls, { label: 'Hedef Derişim C_hedef', unit: '%', min: 0.05, max: 10, step: 0.05, value: st.Ctarget, onInput: v => { st.Ctarget = v; update(); } });

  const cvRw = setupCanvas(host.querySelector('[data-cv-rw]'), () => 190, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    // Histogram bins at bottom
    const nBins = 20;
    const bins = new Array(nBins).fill(0);
    const ps = st.rw.particles;
    for (const p of ps) {
      const bi = Math.min(nBins - 1, Math.floor(p.x * nBins));
      bins[bi]++;
    }
    const maxB = Math.max(...bins, 12);
    const bw = W / nBins;
    c.fillStyle = 'rgba(90,176,255,.16)';
    for (let i = 0; i < nBins; i++) {
      const bh = (bins[i] / maxB) * (H * 0.55);
      c.fillRect(i * bw + 1, H - bh, bw - 2, bh);
    }
    // Particles
    c.fillStyle = acc;
    for (const p of ps) {
      c.beginPath(); c.arc(p.x * W, p.y * H, 2.6, 0, Math.PI * 2); c.fill();
    }
    // Initial interface marker at x = 0.22
    c.strokeStyle = COL_WARN; c.setLineDash([4, 4]); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0.22 * W, 0); c.lineTo(0.22 * W, H); c.stroke();
    c.setLineDash([]);
    rwLbl.textContent = `Adım: ${st.rw.steps} · ⟨r²⟩ = ${fmtFix(st.lastMsd, 4)}`;
  }, clean);

  let lastProf = null;
  function drawProf() {
    if (!lastProf) return;
    const { D, t_s } = lastProf;
    const xMax = Math.max(0.5, Math.min(15, 2 * Math.sqrt(D * t_s) * 1000 * 3.0));
    const pNow = fickErfcProfile({ C0: st.C0, Cs: st.Cs, D, t_s, xMax_mm: xMax });
    const pHalf = fickErfcProfile({ C0: st.C0, Cs: st.Cs, D, t_s: t_s * 0.25, xMax_mm: xMax });
    const pDouble = fickErfcProfile({ C0: st.C0, Cs: st.Cs, D, t_s: t_s * 4, xMax_mm: xMax });
    safePlot(cvProf, [
      { name: `t = ${fmtFix(st.t_hr, 2)} sa`, color: accentColor(), xs: pNow.xMm, ys: pNow.C },
      { name: 't/4', color: COL_BLUE, xs: pHalf.xMm, ys: pHalf.C },
      { name: '4t', color: COL_OK, xs: pDouble.xMm, ys: pDouble.C },
    ], { x0: 0, x1: xMax, ylabel: 'C (%)', height: 205 });
  }

  function update() {
    const T_K = st.T_C + 273.15;
    const D = arrheniusD(st.D0, st.Qd_kJ, T_K);
    const t_s = st.t_hr * 3600;
    const diffLenMm = 2 * Math.sqrt(D * t_s) * 1000;
    const xCase = fickCaseDepth({ C0: st.C0, Cs: st.Cs, Ctarget: st.Ctarget, D, t_s });
    lastProf = { D, t_s };

    dBadge.textContent = `D(${st.T_C}°C) = ${fmtSci(D, 2)} m²/s`;
    renderKpis(kpis, [
      { lbl: 'Difüzyon Katsayısı D', val: `${fmtSci(D, 2)} m²/s`, sub: `T = ${fmtFix(T_K, 1)} K`, tone: 'acc' },
      { lbl: 'Difüzyon Boyu 2√(Dt)', val: `${fmtFix(diffLenMm, 3)} mm`, sub: `t = ${fmtFix(st.t_hr, 2)} sa` },
      { lbl: `Hedef Derinlik (C=${fmtFix(st.Ctarget, 2)}%)`, val: Number.isFinite(xCase) ? `${fmtFix(xCase, 3)} mm` : '—', tone: 'ok' },
      { lbl: 'Süre Oranı (2× derinlik)', val: `${fmtFix(st.t_hr * 4, 1)} sa`, sub: 'x ∝ √t yasası' },
    ]);
    drawProf();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    // Scale thermal jump size smoothly with temperature
    const stepSz = 0.006 + ((st.T_C - 350) / 800) * 0.016;
    const r = stepRandomWalk(st.rw, stepSz, Math.max(1, Math.round(dt * 40)));
    st.lastMsd = r.msd;
    cvRw.render();
    return true;
  }, clean);

  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => {
    st.rw = createRandomWalkState(180, 'step', 77);
    st.lastMsd = 0;
    cvRw.render();
  });
  bindPresets(host, DIFF_UI_PRESETS, p => {
    st.D0 = p.D0; st.Qd_kJ = p.Qd_kJ; st.T_C = p.T_C; st.C0 = p.C0; st.Cs = p.Cs; st.t_hr = p.t_hr;
    st.Ctarget = +(p.C0 + 0.4 * (p.Cs - p.C0)).toFixed(2);
    sT.set(st.T_C); sTime.set(st.t_hr); sQd.set(st.Qd_kJ); sCs.set(st.Cs); sC0.set(st.C0); sCt.set(st.Ctarget);
    update();
  });

  attachReadout(cvProf, host.querySelector('[data-rd-prof]'), (x, ser, i) => `x = ${fmtFix(x, 3)} mm · C = ${fmtFix(ser[0].ys[i], 3)}%`, clean);
  observeResize(host.querySelector('[data-box-prof]'), drawProf, clean);
  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 14. YORULMA & KIRILMA (S-N, GOODMAN/SODERBERG, PARIS) (field: malzeme)
// =====================================================================

const FATIGUE_PRESETS = [
  { label: 'Çelik Mil (Sonsuz Ömür)', tab: 'sn', Sut: 620, Sy: 460, Se: 280, sigmaA: 130, sigmaM: 160, hasEnd: true },
  { label: 'Yüksek Ortalama Gerilme', tab: 'sn', Sut: 620, Sy: 460, Se: 280, sigmaA: 190, sigmaM: 240, hasEnd: true },
  { label: 'Alüminyum (Sınır Yok)',   tab: 'sn', Sut: 340, Sy: 275, Se: 110, sigmaA: 120, sigmaM: 70, hasEnd: false },
  { label: 'Çelik Levha Çatlak Büyümesi', tab: 'paris', a0_mm: 1.0, Y: 1.12, sigmaMax: 180, sigmaMin: 0, KIc: 60, m_paris: 3.0 },
];

function mountFatigueFracture(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'sn',
    Sut: 620, Sy: 460, Se: 280, sigmaA: 130, sigmaM: 160, hasEnd: true,
    a0_mm: 1.0, Y: 1.12, sigmaMax: 180, sigmaMin: 0, KIc: 60, C_paris: 1.5e-11, m_paris: 3.0,
    sn: null, ms: null, paris: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>S–N yorulma eğrisini</b> ve <b>Goodman / Soderberg / Gerber</b> ortalama gerilme güvenlik diyagramlarını incele; <b>Kırılma Mekaniği</b> sekmesinde gerilme şiddeti faktörü K_I ve <b>Paris yasası</b> ile kalan çatlak ömrünü hesapla.', FATIGUE_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-ftab aria-label="Yorulma veya kırılma modu">
        <button type="button" data-t="sn" class="on">S–N & Goodman / Soderberg</button>
        <button type="button" data-t="paris">Paris Yasası & Kırılma (K_Ic)</button>
      </div>
      <span class="slc-badge" data-fbadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2" data-sn-grid>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Goodman / Soderberg / Gerber Diyagramı</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-haigh aria-label="Goodman Soderberg ortalama gerilme diyagramı"></canvas></div>
          </div>
          <div class="slc-plot-card" data-box-sn>
            <div class="slc-head"><h4 class="slc-title">Wöhler S–N Eğrisi (log N)</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-sn aria-label="S-N yorulma eğrisi"></canvas><div class="slc-readout" data-rd-sn></div></div>
          </div>
        </div>
        <div class="slc-plot-card" data-box-paris hidden>
          <div class="slc-head"><h4 class="slc-title">Paris Yasası Çatlak Büyümesi a(N) → a_c</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-paris aria-label="Paris yasası çatlak uzunluğu çevrim grafiği"></canvas><div class="slc-readout" data-rd-paris></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{Goodman: } \\frac{\\sigma_a}{S_e} + \\frac{\\sigma_m}{S_{ut}} = \\frac{1}{n_G}, \\qquad \\text{Soderberg: } \\frac{\\sigma_a}{S_e} + \\frac{\\sigma_m}{S_y} = \\frac{1}{n_S}',
        'K_I = Y\\sigma\\sqrt{\\pi a} \\le K_{Ic}, \\qquad \\frac{da}{dN} = C\\,(\\Delta K)^m',
      ],
      paragraphs: [
        'Çekme yönündeki ortalama gerilme ($\\sigma_m > 0$) izin verilen alternatif gerilme genliğini düşürür. Soderberg doğrusu akma sınırına ($S_y$) bağlandığı için en tutucu, Goodman doğrusu çekme dayanımına ($S_{ut}$) bağlandığı için yaygın tasarım ölçütüdür.',
        'Paris yasasında çatlak büyüme hızı $da/dN$, $\\Delta K^m$ ile üstel arttığı için çatlak kritik uzunluğa $a_c$ yaklaştıkça büyüme ivmelenir; ilk çatlak boyu $a_0$ ömrün büyük bölümünü belirler.',
      ],
      tasks: [
        'Goodman güvenlik katsayısı $n_G > 1$ iken Soderberg $n_S < 1$ olan bir $(\\sigma_m, \\sigma_a)$ noktası bularak iki doğrunun arasındaki bölgeyi incele.',
        '**Paris Yasası** sekmesinde başlangıç çatlak boyunu $a_0 = 1\\text{ mm}$ değerinden $2\\text{ mm}$ değerine çıkarıp kalan ömür $N_f$\'nin yarıdan da fazla düştüğünü gör.',
        'Kırılma tokluğu $K_{Ic}$ değerini düşürerek $K_{I,\\max} \\ge K_{Ic}$ anında ani gevrek kırılma uyarısının oluştuğunu gözlemle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const fbadge = host.querySelector('[data-fbadge]');
  const snGrid = host.querySelector('[data-sn-grid]');
  const boxParis = host.querySelector('[data-box-paris]');
  const cvSn = host.querySelector('[data-cv-sn]');
  const cvParis = host.querySelector('[data-cv-paris]');

  // S-N controls
  const sSut = addSlider(ctrls, { label: 'Çekme Dayanımı S_ut', unit: 'MPa', min: 250, max: 1200, step: 10, value: st.Sut, onInput: v => { st.Sut = v; update(); } });
  const sSy = addSlider(ctrls, { label: 'Akma Dayanımı S_y', unit: 'MPa', min: 150, max: 900, step: 10, value: st.Sy, onInput: v => { st.Sy = v; update(); } });
  const sSe = addSlider(ctrls, { label: 'Yorulma Sınırı S_e', unit: 'MPa', min: 80, max: 500, step: 10, value: st.Se, onInput: v => { st.Se = v; update(); } });
  const sSa = addSlider(ctrls, { label: 'Alternatif Gerilme σ_a', unit: 'MPa', min: 10, max: 450, step: 5, value: st.sigmaA, onInput: v => { st.sigmaA = v; update(); } });
  const sSm = addSlider(ctrls, { label: 'Ortalama Gerilme σ_m', unit: 'MPa', min: 0, max: 550, step: 5, value: st.sigmaM, onInput: v => { st.sigmaM = v; update(); } });
  const tEnd = addToggle(ctrls, 'Yorulma dayanım sınırı (çelik)', st.hasEnd, v => { st.hasEnd = v; update(); });

  // Paris controls
  const sA0 = addSlider(ctrls, { label: 'İlk Çatlak Boyu a₀', unit: 'mm', min: 0.2, max: 12, step: 0.2, value: st.a0_mm, onInput: v => { st.a0_mm = v; update(); } });
  const sSmax = addSlider(ctrls, { label: 'Maks. Çevrimsel σ_max', unit: 'MPa', min: 40, max: 450, step: 5, value: st.sigmaMax, onInput: v => { st.sigmaMax = v; update(); } });
  const sKIc = addSlider(ctrls, { label: 'Kırılma Tokluğu K_Ic', unit: 'MPa√m', min: 15, max: 130, step: 2, value: st.KIc, onInput: v => { st.KIc = v; update(); } });
  const sY = addSlider(ctrls, { label: 'Geometri Faktörü Y', min: 1.0, max: 2.0, step: 0.02, value: st.Y, onInput: v => { st.Y = v; update(); } });
  const sM = addSlider(ctrls, { label: 'Paris Üssü m', min: 2.0, max: 4.0, step: 0.1, value: st.m_paris, onInput: v => { st.m_paris = v; update(); } });

  const cvHaigh = setupCanvas(host.querySelector('[data-cv-haigh]'), () => 245, (c, W, H) => {
    if (!st.ms) return;
    c.clearRect(0, 0, W, H);
    const padL = 46, padR = 14, padT = 18, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;
    const maxX = Math.max(st.Sut, st.sigmaM) * 1.12;
    const maxY = Math.max(st.Sy, st.Se, st.sigmaA) * 1.15;
    const toX = x => padL + (x / maxX) * pw;
    const toY = y => padT + (1 - y / maxY) * ph;
    const acc = accentColor();

    c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    // Gerber parabola
    c.strokeStyle = COL_BLUE; c.lineWidth = 1.8;
    c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const sm = (st.Sut * i) / 40;
      const sa = st.Se * (1 - (sm / st.Sut) ** 2);
      i === 0 ? c.moveTo(toX(sm), toY(sa)) : c.lineTo(toX(sm), toY(sa));
    }
    c.stroke();

    // Goodman line (Se -> Sut)
    c.strokeStyle = COL_OK; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(toX(0), toY(st.Se)); c.lineTo(toX(st.Sut), toY(0)); c.stroke();

    // Soderberg line (Se -> Sy)
    c.strokeStyle = COL_WARN; c.setLineDash([5, 4]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(toX(0), toY(st.Se)); c.lineTo(toX(st.Sy), toY(0)); c.stroke();

    // Langer yield line (Sy -> Sy)
    c.strokeStyle = 'rgba(255,107,107,.5)'; c.setLineDash([3, 3]); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(toX(0), toY(st.Sy)); c.lineTo(toX(st.Sy), toY(0)); c.stroke();
    c.setLineDash([]);

    // Operating point
    const ox = toX(st.sigmaM), oy = toY(st.sigmaA);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(toX(0), toY(0)); c.lineTo(ox, oy); c.stroke();
    c.fillStyle = st.ms.safeGoodman ? acc : COL_BAD; c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath(); c.arc(ox, oy, 5.8, 0, Math.PI * 2); c.fill(); c.stroke();

    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    c.textAlign = 'left'; c.fillText('Yeşil: Goodman · Sarı: Soderberg · Mavi: Gerber', padL + 4, 13);
    c.textAlign = 'right'; c.fillText('σ_m (MPa)', W - padR, H - 6);
  }, clean);

  function drawPlots() {
    if (st.tab === 'sn' && st.sn) {
      const ns = st.sn.logNs.map(l => Math.pow(10, l));
      safePlot(cvSn, [
        { name: 'S-N Eğrisi', color: accentColor(), xs: ns, ys: st.sn.sCurve },
        { name: 'Eşdeğer σ_ar', color: COL_BAD, xs: [1e3, 1e8], ys: [st.ms.sigmaAr, st.ms.sigmaAr] },
      ], { xlog: true, x0: 1e3, x1: 1e8, ylabel: 'σ (MPa)', height: 225 });
    } else if (st.tab === 'paris' && st.paris && !st.paris.fracturedImmediately) {
      safePlot(cvParis, [
        { name: 'Çatlak a(N)', color: accentColor(), xs: st.paris.cycles, ys: st.paris.aCurveMm },
        { name: 'Kritik a_c', color: COL_BAD, xs: [0, st.paris.Nf_exact], ys: [st.paris.ac_mm, st.paris.ac_mm] },
      ], { x0: 0, x1: st.paris.Nf_exact, ylabel: 'a (mm)', height: 245 });
    }
  }

  function syncTabVis() {
    const isSn = st.tab === 'sn';
    [sSut, sSy, sSe, sSa, sSm, tEnd].forEach(s => s.setVisible(isSn));
    [sA0, sSmax, sKIc, sY, sM].forEach(s => s.setVisible(!isSn));
    snGrid.hidden = !isSn;
    boxParis.hidden = isSn;
    host.querySelectorAll('[data-ftab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  }

  function update() {
    if (st.tab === 'sn') {
      st.ms = solveMeanStressCriteria({ sigmaA: st.sigmaA, sigmaM: st.sigmaM, Se: st.Se, Sut: st.Sut, Sy: st.Sy });
      st.sn = solveSNBasquin({ Sut: st.Sut, Se: st.Se, hasEnduranceLimit: st.hasEnd, sigmaA: st.ms.sigmaAr });
      fbadge.textContent = st.ms.safeGoodman ? `Goodman Güvenli (n=${fmtFix(st.ms.nGoodman, 2)})` : 'SONLU ÖMÜR / YORULMA RİSKİ';
      fbadge.className = `slc-badge ${st.ms.safeSoderberg ? 'slc-badge-ok' : st.ms.safeGoodman ? 'slc-badge-warn' : 'slc-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Goodman / Soderberg n', val: `${fmtFix(st.ms.nGoodman, 2)} / ${fmtFix(st.ms.nSoderberg, 2)}`, sub: `Gerber: ${fmtFix(st.ms.nGerber, 2)}`, tone: st.ms.safeGoodman ? 'ok' : 'bad' },
        { lbl: 'Eşdeğer Tam Ters σ_ar', val: `${fmtFix(st.ms.sigmaAr, 1)} MPa`, sub: `S_e = ${st.Se} MPa`, tone: 'acc' },
        { lbl: 'Tahmini Ömür N', val: st.sn.lifeN === Infinity ? '∞ (Sonsuz)' : `${fmtSci(st.sn.lifeN, 2)} çevrim`, sub: `Basquin b = ${fmtFix(st.sn.b, 3)}` },
        { lbl: 'Statik Akma Güvenliği', val: fmtFix(st.ms.nYield, 2), sub: `σ_max = ${st.sigmaA + st.sigmaM} MPa` },
      ]);
      cvHaigh.render();
    } else {
      st.paris = solveParisCrackGrowth({ a0_mm: st.a0_mm, Y: st.Y, sigmaMax: st.sigmaMax, sigmaMin: st.sigmaMin, KIc: st.KIc, C_paris: st.C_paris, m_paris: st.m_paris });
      const p = st.paris;
      fbadge.textContent = p.fracturedImmediately ? 'ANİ KIRILMA! (K_I ≥ K_Ic)' : `K_I / K_Ic = %${fmtFix((p.K0 / p.KIc) * 100, 1)}`;
      fbadge.className = `slc-badge ${p.fracturedImmediately ? 'slc-badge-bad' : p.K0 / p.KIc > 0.7 ? 'slc-badge-warn' : 'slc-badge-ok'}`;
      renderKpis(kpis, [
        { lbl: 'Başlangıç K_I', val: `${fmtFix(p.K0, 2)} MPa√m`, sub: `K_Ic = ${p.KIc} MPa√m`, tone: p.fracturedImmediately ? 'bad' : 'acc' },
        { lbl: 'Kritik Çatlak a_c', val: `${fmtFix(p.ac_mm, 2)} mm`, sub: `İlk çatlak a₀ = ${p.a0_mm} mm` },
        { lbl: 'Kalan Yorulma Ömrü N_f', val: p.fracturedImmediately ? '0' : `${fmtSci(p.Nf_exact, 2)} çevrim`, tone: p.fracturedImmediately ? 'bad' : 'ok' },
        { lbl: 'Kırılma Emniyeti', val: fmtFix(p.KIc / Math.max(1e-6, p.K0), 2), sub: `Y = ${st.Y} · m = ${st.m_paris}` },
      ]);
    }
    drawPlots();
  }

  host.querySelector('[data-ftab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncTabVis(); update(); syncSegments(host, false);
  });
  bindPresets(host, FATIGUE_PRESETS, p => {
    Object.assign(st, p);
    sSut.set(st.Sut); sSy.set(st.Sy); sSe.set(st.Se); sSa.set(st.sigmaA); sSm.set(st.sigmaM); tEnd.set(st.hasEnd);
    sA0.set(st.a0_mm); sSmax.set(st.sigmaMax); sKIc.set(st.KIc); sY.set(st.Y); sM.set(st.m_paris);
    syncTabVis(); update();
  });

  attachReadout(cvSn, host.querySelector('[data-rd-sn]'), (x, ser, i) => `N = ${fmtSci(x, 2)} · S = ${fmtFix(ser[0].ys[i], 1)} MPa`, clean);
  attachReadout(cvParis, host.querySelector('[data-rd-paris]'), (x, ser, i) => `N = ${fmtSci(x, 2)} · a = ${fmtFix(ser[0].ys[i], 2)} mm`, clean);
  observeResize(host.querySelector('[data-box-sn]'), drawPlots, clean);
  observeResize(boxParis, drawPlots, clean);
  bindTasks(host);
  syncTabVis();
  update();
  return clean.run;
}

// =====================================================================
// 15. ISIL İŞLEM — TTT DİYAGRAMI (field: malzeme)
// =====================================================================

const TTT_PRESETS = [
  { label: 'Su Verme (Martensit)',      pts: [{ t: 0.05, T: 780 }, { t: 0.25, T: 420 }, { t: 0.6, T: 25 }] },
  { label: 'İzotermal Tavlama (Perlit)', pts: [{ t: 0.05, T: 780 }, { t: 0.8, T: 650 }, { t: 2500, T: 650 }, { t: 8000, T: 25 }] },
  { label: 'Östemperleme (Beynit)',     pts: [{ t: 0.05, T: 780 }, { t: 0.35, T: 350 }, { t: 1800, T: 350 }, { t: 5000, T: 25 }] },
  { label: 'Kısmi Perlit + Martensit',  pts: [{ t: 0.05, T: 780 }, { t: 0.4, T: 580 }, { t: 3.0, T: 580 }, { t: 6.0, T: 25 }] },
];

function mountHeatTreatmentTTT(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    pts: TTT_PRESETS[2].pts.map(p => ({ ...p })),
    dragIdx: -1,
    playing: false, animU: 1,
    res: null,
  };
  const curves = tttCurves(85);

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Ötektoid çeliğin (%0.76 C) <b>TTT diyagramı üzerinde noktaları sürükleyerek veya yeni nokta tıklayarak</b> kendi soğutma eğrini çiz; Scheil eklemelilik + Koistinen–Marburger modeliyle elde edilen <b>mikroyapı oranlarını ve Rockwell C sertliğini</b> canlı gör.', TTT_PRESETS)}
    <div class="slc-toolbar">
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="false"></button>
        <button type="button" class="btn small ghost" data-clear-pt>${icon('rotate')} 2 noktalı soğuma</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-ttt-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel">
        <h4 class="slc-title">Sonuç Faz Dağılımı</h4>
        <div data-bars class="slc-col"></div>
        <div class="slc-hint">İpucu: Diyagramdaki mavi/beyaz düğümleri sürükleyerek soğutma yolunu değiştir; boş bir yere dokunarak yeni durak noktası ekle (maks. 6 nokta).</div>
      </div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title">Ötektoid Çelik TTT Diyagramı (T vs log t)</h4><span class="slc-hint mono">A₁=727°C · Ms=215°C</span></div>
          <div class="slc-cv-box"><canvas class="slc-cv slc-cv-drag" data-cv-ttt aria-label="Etkileşimli TTT ısıl işlem diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\sum_i \\frac{\\Delta t_i}{\\tau_s(T_i)} \\ge 1 \\;\\;(\\text{Scheil}), \\qquad f_M = 1 - \\exp\\!\\big(-\\alpha(M_s - T)\\big)',
      ],
      paragraphs: [
        'Ötektoid çelik $A_1 = 727^\\circ\\text{C}$ üzerinde östenitlenir. Soğutma eğrisi $540^\\circ\\text{C}$ civarındaki **perlit burnuna** ($\\tau_s \\approx 0.8\\text{ s}$) çarpmadan $M_s = 215^\\circ\\text{C}$ altına inerse difüzyonsuz dönüşümle çok sert **martensit** (~64 HRC) oluşur.',
        'Östemperleme (austempering) işleminde çelik burundan kaçırılarak $300\\text{–}400^\\circ\\text{C}$ banyoda tutulur; sonuç tokluğu yüksek ve gevrekliği düşük **beynit** (~46 HRC) mikroyapısıdır.',
      ],
      tasks: [
        '**Su Verme** senaryosundaki orta düğümü sağa doğru sürükleyerek buruna ($t \\approx 1\\text{ s}, 540^\\circ\\text{C}$) değdiğinde sertliğin ve martensit oranının nasıl düştüğünü gözle.',
        '**Östemperleme** senaryosunda izotermal tutma sıcaklığını $350^\\circ\\text{C}$\'den $650^\\circ\\text{C}$\'ye taşıyarak beynitten kaba perlite geçişi ve HRC farkını karşılaştır.',
        'Yalnızca ~%50 Perlit + ~%50 Martensit üretecek bir soğutma yolu tasarla.',
      ],
    })}
  </div>`;

  const barsEl = host.querySelector('[data-bars]');
  const kpis = host.querySelector('[data-kpis]');
  const badge = host.querySelector('[data-ttt-badge]');
  const btnPlay = host.querySelector('[data-play]');

  let box = { padL: 50, padR: 16, padT: 20, padB: 32, pw: 300, ph: 240 };
  const logMin = -1.3, logMax = 5.0; // 0.05 s to 10^5 s
  const tMin = 0, tMax = 840;
  const toX = t => box.padL + ((Math.log10(Math.max(0.05, t)) - logMin) / (logMax - logMin)) * box.pw;
  const toY = T => box.padT + (1 - (T - tMin) / (tMax - tMin)) * box.ph;
  const fromPt = (sx, sy) => ({
    t: Math.pow(10, Math.max(logMin, Math.min(logMax, logMin + ((sx - box.padL) / box.pw) * (logMax - logMin)))),
    T: Math.max(20, Math.min(820, Math.round(tMin + (1 - (sy - box.padT) / box.ph) * (tMax - tMin)))),
  });

  const cv = setupCanvas(host.querySelector('[data-cv-ttt]'), w => Math.min(370, Math.max(280, w * 0.68)), (c, W, H) => {
    box = { padL: 50, padR: 16, padT: 20, padB: 32, pw: W - 66, ph: H - 52 };
    const acc = accentColor();
    c.clearRect(0, 0, W, H);

    // Log-time vertical grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let e = -1; e <= 5; e++) {
      const x = toX(Math.pow(10, e));
      c.beginPath(); c.moveTo(x, box.padT); c.lineTo(x, box.padT + box.ph); c.stroke();
      c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(e < 0 ? '0.1s' : e === 0 ? '1s' : `10^${e}s`, x, box.padT + box.ph + 15);
    }
    c.strokeStyle = COL_AXIS; c.strokeRect(box.padL, box.padT, box.pw, box.ph);

    // A1, Ms, Mf horizontal lines
    const hLine = (T, lbl, col) => {
      const y = toY(T);
      c.strokeStyle = col; c.setLineDash([5, 4]); c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(box.padL, y); c.lineTo(box.padL + box.pw, y); c.stroke();
      c.setLineDash([]);
      c.fillStyle = col; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText(lbl, box.padL + 6, y - 4);
    };
    hLine(TTT_A1, 'A₁ = 727°C (Östenit γ)', COL_WARN);
    hLine(TTT_MS, 'Ms = 215°C (Martensit Başlangıç)', COL_BAD);
    hLine(TTT_MF, 'Mf = 100°C', 'rgba(255,107,107,.55)');

    // Shaded transformation zone between start & finish C-curves
    c.fillStyle = 'rgba(91,228,155,.12)';
    c.beginPath();
    curves.Ts.forEach((T, i) => { i === 0 ? c.moveTo(toX(curves.ts[i]), toY(T)) : c.lineTo(toX(curves.ts[i]), toY(T)); });
    for (let i = curves.Ts.length - 1; i >= 0; i--) c.lineTo(toX(curves.tf[i]), toY(curves.Ts[i]));
    c.closePath(); c.fill();

    // Start (Ps/Bs) & Finish (Pf/Bf) curves
    const drawC = (arr, col) => {
      c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath();
      curves.Ts.forEach((T, i) => { i === 0 ? c.moveTo(toX(arr[i]), toY(T)) : c.lineTo(toX(arr[i]), toY(T)); });
      c.stroke();
    };
    drawC(curves.ts, COL_OK);
    drawC(curves.tf, COL_BLUE);

    // Region annotations
    c.fillStyle = COL_MUTE; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('Perlit', toX(180), toY(625));
    c.fillText('Beynit', toX(350), toY(370));
    c.fillText('Martensit', toX(10), toY(70));

    // User cooling path
    const sorted = st.pts.slice().sort((a, b) => a.t - b.t);
    c.strokeStyle = acc; c.lineWidth = 2.8;
    c.beginPath();
    sorted.forEach((p, i) => { i === 0 ? c.moveTo(toX(p.t), toY(p.T)) : c.lineTo(toX(p.t), toY(p.T)); });
    c.stroke();

    // Waypoint handles
    const dragRef = st.dragIdx >= 0 ? st.pts[st.dragIdx] : null;
    sorted.forEach(p => {
      const px = toX(p.t), py = toY(p.T);
      c.fillStyle = p === dragRef ? COL_WARN : '#fff';
      c.strokeStyle = acc; c.lineWidth = 2.2;
      c.beginPath(); c.arc(px, py, 6.2, 0, Math.PI * 2); c.fill(); c.stroke();
    });

    // Animated cooling dot along path
    if (st.animU < 1 && sorted.length >= 2) {
      const segF = st.animU * (sorted.length - 1);
      const si = Math.min(sorted.length - 2, Math.floor(segF));
      const f = segF - si;
      const p0 = sorted[si], p1 = sorted[si + 1];
      const lx = toX(p0.t) + f * (toX(p1.t) - toX(p0.t));
      const ly = toY(p0.T) + f * (toY(p1.T) - toY(p0.T));
      c.fillStyle = COL_WARN; c.beginPath(); c.arc(lx, ly, 7.5, 0, Math.PI * 2); c.fill();
    }

    // Y ticks
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'right';
    for (const T of [0, 200, 400, 600, 800]) c.fillText(`${T}°`, box.padL - 6, toY(T) + 3);
  }, clean);

  bindDragCanvas(host.querySelector('[data-cv-ttt]'), {
    onDown: p => {
      let hit = -1, best = 20;
      st.pts.forEach((pt, idx) => {
        const d = Math.hypot(toX(pt.t) - p.x, toY(pt.T) - p.y);
        if (d < best) { best = d; hit = idx; }
      });
      if (hit >= 0) { st.dragIdx = hit; return true; }
      if (st.pts.length < 6 && p.x >= box.padL && p.x <= box.padL + box.pw) {
        st.pts.push(fromPt(p.x, p.y));
        st.pts.sort((a, b) => a.t - b.t);
        st.dragIdx = st.pts.findIndex(pt => Math.hypot(toX(pt.t) - p.x, toY(pt.T) - p.y) < 12);
        update();
        return true;
      }
      return false;
    },
    onMove: (p, drag) => {
      if (!drag || st.dragIdx < 0) return;
      const np = fromPt(p.x, p.y);
      st.pts[st.dragIdx] = np;
      update();
    },
    onUp: () => {
      st.dragIdx = -1;
      st.pts.sort((a, b) => a.t - b.t);
      update();
    },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.animU += dt * 0.35;
    if (st.animU >= 1) { st.animU = 1; st.playing = false; syncPlayBtn(btnPlay, false); cv.render(); return false; }
    cv.render();
    return true;
  }, clean);

  function update() {
    st.res = simulateCoolingPath(st.pts);
    const r = st.res;
    badge.textContent = `${fmtFix(r.hrc, 1)} HRC`;
    renderKpis(kpis, [
      { lbl: 'Tahmini Sertlik', val: `${fmtFix(r.hrc, 1)} HRC`, tone: 'acc' },
      { lbl: 'Martensit', val: `%${fmtFix(r.martensite, 1)}`, tone: r.martensite > 50 ? 'bad' : '' },
      { lbl: 'Beynit', val: `%${fmtFix(r.bainite, 1)}`, tone: r.bainite > 50 ? 'warn' : '' },
      { lbl: 'Perlit (Kaba+İnce)', val: `%${fmtFix(r.coarsePearlite + r.finePearlite, 1)}`, tone: 'ok' },
    ]);
    const rows = [
      ['Martensit (~64 HRC)', r.martensite, COL_BAD],
      ['Beynit (~46 HRC)', r.bainite, COL_WARN],
      ['İnce Perlit (~32 HRC)', r.finePearlite, COL_BLUE],
      ['Kaba Perlit (~18 HRC)', r.coarsePearlite, COL_OK],
      ['Kalıntı Östenit', r.retainedAustenite, COL_MUTE],
    ];
    barsEl.innerHTML = rows.map(([lbl, pct, col]) => `<div class="slc-ctrl">
      <div class="slc-ctrl-top"><span class="slc-ctrl-lbl">${esc(lbl)}</span><span class="slc-ctrl-val mono">%${fmtFix(pct, 1)}</span></div>
      <div style="height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden"><div style="height:100%;width:${Math.min(100, pct).toFixed(1)}%;background:${col};border-radius:99px"></div></div>
    </div>`).join('');
    cv.render();
  }

  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing;
    if (st.playing && st.animU >= 0.99) st.animU = 0;
    syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-clear-pt]').addEventListener('click', () => {
    st.pts = [{ t: 0.05, T: 780 }, { t: 10, T: 25 }];
    update();
  });
  bindPresets(host, TTT_PRESETS, p => {
    st.pts = p.pts.map(pt => ({ ...pt }));
    st.animU = 1;
    update();
  });

  syncPlayBtn(btnPlay, false);
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 16. KOMPOZİT MALZEMELER (VOIGT / REUSS / OFF-AXIS) (field: malzeme)
// =====================================================================

const COMP_UI_PRESETS = Object.entries(COMPOSITE_PRESETS).map(([k, v]) => ({ key: k, ...v }));

function mountComposites(host, ctx) {
  const clean = createClean(ctx);
  const st = { ...COMPOSITE_PRESETS.carbon, thetaDeg: 0, res: null };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Sürekli elyaf takviyeli kompozitlerde <b>karışım kuralı (Voigt üst sınır, Reuss alt sınır)</b>, Halpin–Tsai enine modülü ve elyaf yönelim açısı θ\'ya göre anizotropik elastisite modülünü E(θ) canlı incele.', COMP_UI_PRESETS)}
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card" data-box-vf>
            <div class="slc-head">
              <h4 class="slc-title">Elastisite Modülü — Elyaf Oranı V_f</h4>
              <div class="slc-legend">
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${accentColor()}"></i>Voigt E₁</span>
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_OK}"></i>Halpin–Tsai</span>
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_BAD}"></i>Reuss E₂</span>
              </div>
            </div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-vf aria-label="Voigt ve Reuss modül grafiği"></canvas><div class="slc-readout" data-rd-vf></div></div>
          </div>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Açısal Anizotropi E(θ) & Elyaf Kesiti</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-polar aria-label="Kompozit açısal modül kutupsal diyagramı"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'E_1 = V_f E_f + (1 - V_f) E_m \\;\\;(\\text{Voigt}), \\qquad E_2 = \\left(\\frac{V_f}{E_f} + \\frac{1 - V_f}{E_m}\\right)^{-1} \\;\\;(\\text{Reuss})',
        '\\frac{1}{E(\\theta)} = \\frac{\\cos^4\\theta}{E_1} + \\left(\\frac{1}{G_{12}} - \\frac{2\\nu_{12}}{E_1}\\right)\\sin^2\\theta\\cos^2\\theta + \\frac{\\sin^4\\theta}{E_2}',
      ],
      paragraphs: [
        'Elyaf ekseni boyunca yüklemede (eş-gerinim / Voigt) yüksek modüllü elyaflar yükün büyük çoğunluğunu taşır. Enine yüklemede (eş-gerilme / Reuss) ise yumuşak matris seri yay gibi davrandığından modül çok daha düşük kalır.',
        'Tek yönlü bir katman elyaf doğrultusundan yalnızca $20^\\circ\\text{–}30^\\circ$ saparak yüklendiğinde bile elastisite modülü $E(\\theta)$ hızla düşer; bu nedenle yapısal laminatlar $[0/\\pm 45/90]_s$ katman dizilimiyle tasarlanır.',
      ],
      tasks: [
        '**Karbon / Epoksi** senaryosunda ($V_f = 0.60$) elyafların toplam eksenel yükün %98\'inden fazlasını taşıdığını KPI kartından doğrula.',
        'Yükleme açısını $\\theta = 0^\\circ$ değerinden $30^\\circ$ değerine çıkarıp $E(\\theta)$\'nın ne kadar hızlı düştüğünü kutupsal grafikte gözlemle.',
        'Elyaf hacim oranını $V_f = 0$ ile $1$ arasında kaydırıp $E_2 \\le E_{2,\\text{HT}} \\le E_1$ sınır eşitsizliğini doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cvVf = host.querySelector('[data-cv-vf]');

  const sVf = addSlider(ctrls, { label: 'Elyaf Hacim Oranı V_f', min: 0.05, max: 0.85, step: 0.01, value: st.Vf, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.Vf = v; update(); } });
  const sEf = addSlider(ctrls, { label: 'Elyaf Modülü E_f', unit: 'GPa', min: 30, max: 450, step: 5, value: st.Ef, onInput: v => { st.Ef = v; update(); } });
  const sEm = addSlider(ctrls, { label: 'Matris Modülü E_m', unit: 'GPa', min: 1.0, max: 90, step: 0.5, value: st.Em, onInput: v => { st.Em = v; update(); } });
  const sTh = addSlider(ctrls, { label: 'Yükleme Açısı θ', unit: '°', min: 0, max: 90, step: 1, value: st.thetaDeg, onInput: v => { st.thetaDeg = v; update(); } });

  const cvPolar = setupCanvas(host.querySelector('[data-cv-polar]'), () => 240, (c, W, H) => {
    const r = st.res;
    if (!r) return;
    c.clearRect(0, 0, W, H);
    const cx = W * 0.42, cy = H * 0.52;
    const maxR = Math.min(W * 0.34, H * 0.40);
    const acc = accentColor();

    // Polar rings
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (const f of [0.33, 0.66, 1.0]) {
      c.beginPath(); c.arc(cx, cy, maxR * f, 0, Math.PI * 2); c.stroke();
    }
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(cx - maxR - 8, cy); c.lineTo(cx + maxR + 8, cy); c.moveTo(cx, cy - maxR - 8); c.lineTo(cx, cy + maxR + 8); c.stroke();

    // Polar E(theta) butterfly lobe
    c.fillStyle = acc; c.globalAlpha = 0.2;
    c.beginPath();
    for (let deg = 0; deg <= 360; deg += 3) {
      const val = r.evalAngle(deg);
      const rr = (val / r.E1) * maxR;
      const x = cx + rr * Math.cos(deg * RAD), y = cy - rr * Math.sin(deg * RAD);
      deg === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath(); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = acc; c.lineWidth = 2.2; c.stroke();

    // Active loading angle vector
    const curR = (r.Etheta / r.E1) * maxR;
    const ax = cx + curR * Math.cos(st.thetaDeg * RAD), ay = cy - curR * Math.sin(st.thetaDeg * RAD);
    drawArrow(c, cx, cy, ax, ay, COL_WARN, 2.4);

    // Mini cross-section fibre pack on right
    const bx = W - 64, by = H * 0.22, bs = 52;
    c.fillStyle = 'rgba(255,255,255,.06)'; c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
    c.fillRect(bx, by, bs, bs); c.strokeRect(bx, by, bs, bs);
    const fRad = Math.min(5.2, Math.sqrt(st.Vf / Math.PI) * 11.5);
    c.fillStyle = COL_BLUE;
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        c.beginPath(); c.arc(bx + 7 + gx * 12.6, by + 7 + gy * 12.6, fRad, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText(`Vf=%${Math.round(st.Vf * 100)}`, bx + bs / 2, by + bs + 14);
    c.fillText(`E(${st.thetaDeg}°)=${fmtFix(r.Etheta, 1)} GPa`, cx, H - 8);
  }, clean);

  function drawPlot() {
    const vfs = [], e1s = [], e2s = [], ehts = [];
    for (let i = 0; i <= 60; i++) {
      const vf = i / 60;
      const r = solveComposite({ ...st, Vf: vf });
      vfs.push(vf * 100); e1s.push(r.E1); e2s.push(r.E2); ehts.push(r.E2_HT);
    }
    safePlot(cvVf, [
      { name: 'Voigt E₁', color: accentColor(), xs: vfs, ys: e1s },
      { name: 'Halpin-Tsai', color: COL_OK, xs: vfs, ys: ehts },
      { name: 'Reuss E₂', color: COL_BAD, xs: vfs, ys: e2s },
    ], { x0: 0, x1: 100, ylabel: 'Modül E (GPa)', height: 220 });
  }

  function update() {
    st.res = solveComposite(st);
    const r = st.res;
    renderKpis(kpis, [
      { lbl: 'Boyuna Modül E₁ (Voigt)', val: `${fmtFix(r.E1, 1)} GPa`, sub: `Elyaf yük payı %${fmtFix(r.fiberLoadSharePct, 1)}`, tone: 'acc' },
      { lbl: 'Enine E₂ (Reuss / HT)', val: `${fmtFix(r.E2, 2)} / ${fmtFix(r.E2_HT, 2)} GPa`, sub: `G₁₂ = ${fmtFix(r.G12, 2)} GPa` },
      { lbl: `Açısal Modül E(${st.thetaDeg}°)`, val: `${fmtFix(r.Etheta, 1)} GPa`, sub: `E₁/E₂ = ${fmtFix(r.E1 / r.E2, 1)}×`, tone: 'ok' },
      { lbl: 'Özgül Modül E₁/ρ', val: `${fmtFix(r.specificModulus, 1)}`, sub: `ρ_c = ${fmtFix(r.rhoC, 2)} g/cm³` },
    ]);
    drawPlot(); cvPolar.render();
  }

  bindPresets(host, COMP_UI_PRESETS, p => {
    Object.assign(st, p);
    sVf.set(st.Vf); sEf.set(st.Ef); sEm.set(st.Em);
    update();
  });

  attachReadout(cvVf, host.querySelector('[data-rd-vf]'), (x, ser, i) => `Vf=%${fmtFix(x, 0)} · E₁=${fmtFix(ser[0].ys[i], 1)} · E₂=${fmtFix(ser[2].ys[i], 2)} GPa`, clean);
  observeResize(host.querySelector('[data-box-vf]'), drawPlot, clean);
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 17. YARI İLETKEN MALZEME (field: malzeme)
// =====================================================================

const SEMI_PRESETS = [
  { label: 'n-tipi Si (300 K)',    material: 'Si',   T_K: 300, logNd: 16, logNa: 0 },
  { label: 'p-tipi Si (300 K)',    material: 'Si',   T_K: 300, logNd: 0,  logNa: 16 },
  { label: 'Yüksek Sıcaklık Si',   material: 'Si',   T_K: 650, logNd: 15, logNa: 0 },
  { label: 'Dar Bantlı Ge (300 K)', material: 'Ge',  T_K: 300, logNd: 14, logNa: 0 },
  { label: 'Geniş Bant 4H-SiC',    material: 'SiC',  T_K: 500, logNd: 16, logNa: 0 },
];

function mountSemiconductorMaterials(host, ctx) {
  const clean = createClean(ctx);
  const st = { material: 'Si', T_K: 300, logNd: 16, logNa: 0, res: null };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Silisyum, Germanyum, GaAs ve SiC yarı iletkenlerinde sıcaklık T ve katkılama (N_d, N_a) değişimine göre <b>öz taşıyıcı derişimini n_i(T)</b>, <b>Fermi seviyesini E_F</b>, Fermi–Dirac dağılımını ve iletkenliği canlı incele.', SEMI_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-smat aria-label="Yarı iletken malzeme">
        ${Object.keys(SEMICONDUCTORS).map(k => `<button type="button" data-m="${k}" class="${k === st.material ? 'on' : ''}">${k}</button>`).join('')}
      </div>
      <span class="slc-badge slc-badge-acc" data-reg-badge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Enerji Bant Diyagramı & Fermi–Dirac f(E)</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-band aria-label="Yarı iletken enerji bant diyagramı"></canvas></div>
          </div>
          <div class="slc-plot-card" data-box-arr>
            <div class="slc-head"><h4 class="slc-title">log₁₀(n, p, n_i) vs 1000/T</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-arr aria-label="Taşıyıcı derişimi sıcaklık grafiği"></canvas><div class="slc-readout" data-rd-arr></div></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'n_i(T) = \\sqrt{N_c N_v}\\,\\exp\\!\\left(-\\frac{E_g(T)}{2 k_B T}\\right), \\qquad n\\,p = n_i^2, \\qquad n - p = N_d - N_a',
        'E_F = E_i + k_B T\\ln\\!\\left(\\frac{n}{n_i}\\right), \\qquad \\sigma = q\\,(n\\mu_n + p\\mu_p)',
      ],
      paragraphs: [
        'Oda sıcaklığında ($300\\text{ K}$) katkılı silisyumda çoğunluk taşıyıcısı katkılama konsantrasyonuna eşittir ($n \\approx N_d$) ve Fermi seviyesi $E_F$ iletim bandına ($E_c$) yaklaşır. Sıcaklık yeterince yükseldiğinde ısıl olarak üretilen $n_i(T)$, $N_d$\'yi aşar ve malzeme tekrar **öz (intrensek)** davranışa dönerek $E_F \\to E_i$ ortasına kayar.',
        'Geniş bant aralıklı 4H-SiC ($E_g \\approx 3.26\\text{ eV}$) yüksek sıcaklıklarda bile son derece düşük $n_i$ koruduğundan güç elektroniğinde tercih edilir.',
      ],
      tasks: [
        'n-tipi Si ($N_d = 10^{15}\\text{ cm}^{-3}$) senaryosunda sıcaklığı $300\\text{ K}$\'den $700\\text{ K}$\'ye çıkarıp $E_F$\'nin bant ortasına $E_i$ kaydığını ve rejimin **Öz (İntrensek)** olduğunu gözlemle.',
        'Verici ve alıcı katkılamayı eşitle ($N_d = N_a = 10^{16}$): telafi edilmiş yarı iletkende $n = p = n_i$ ve $E_F = E_i$ olduğunu doğrula.',
        'Aynı $500\\text{ K}$ sıcaklıkta **Ge**, **Si** ve **SiC** arasında geçiş yapıp $n_i(T)$ değerlerinin mertebe farklarını karşılaştır.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const regBadge = host.querySelector('[data-reg-badge]');
  const cvArr = host.querySelector('[data-cv-arr]');

  const sT = addSlider(ctrls, { label: 'Sıcaklık T', unit: 'K', min: 150, max: 900, step: 10, value: st.T_K, onInput: v => { st.T_K = v; update(); } });
  const sNd = addSlider(ctrls, { label: 'Verici Katkılama N_d', min: 0, max: 19, step: 0.25, value: st.logNd, fmt: v => v < 10 ? 'Yok (0)' : `10^${fmtFix(v, 2)} cm⁻³`, onInput: v => { st.logNd = v; update(); } });
  const sNa = addSlider(ctrls, { label: 'Alıcı Katkılama N_a', min: 0, max: 19, step: 0.25, value: st.logNa, fmt: v => v < 10 ? 'Yok (0)' : `10^${fmtFix(v, 2)} cm⁻³`, onInput: v => { st.logNa = v; update(); } });

  const cvBand = setupCanvas(host.querySelector('[data-cv-band]'), () => 250, (c, W, H) => {
    const r = st.res;
    if (!r) return;
    c.clearRect(0, 0, W, H);
    const padT = 26, padB = 26, bh = H - padT - padB;
    const eMin = -0.35 * r.Eg, eMax = 1.35 * r.Eg;
    const toY = E => padT + (1 - (E - eMin) / (eMax - eMin)) * bh;
    const acc = accentColor();
    const xL = 22, xMid = W * 0.54, xR = W - 18;

    // Conduction band & valence band shaded zones
    const yEc = toY(r.Eg), yEv = toY(0), yEi = toY(r.Ei), yEf = toY(r.Ef);
    c.fillStyle = 'rgba(90,176,255,.18)'; c.fillRect(xL, padT, xMid - xL - 10, Math.max(0, yEc - padT));
    c.fillStyle = 'rgba(91,228,155,.18)'; c.fillRect(xL, yEv, xMid - xL - 10, Math.max(0, padT + bh - yEv));

    // Ec, Ev, Ei, Ef lines
    c.strokeStyle = COL_BLUE; c.lineWidth = 2.2; c.beginPath(); c.moveTo(xL, yEc); c.lineTo(xMid - 10, yEc); c.stroke();
    c.strokeStyle = COL_OK; c.lineWidth = 2.2; c.beginPath(); c.moveTo(xL, yEv); c.lineTo(xMid - 10, yEv); c.stroke();
    c.strokeStyle = COL_DIM; c.setLineDash([4, 4]); c.lineWidth = 1.3; c.beginPath(); c.moveTo(xL, yEi); c.lineTo(xMid - 10, yEi); c.stroke();
    c.strokeStyle = acc; c.setLineDash([6, 3]); c.lineWidth = 2.2; c.beginPath(); c.moveTo(xL, yEf); c.lineTo(xR, yEf); c.stroke();
    c.setLineDash([]);

    c.font = '600 10.5px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillStyle = COL_BLUE; c.fillText(`Ec (${fmtFix(r.Eg, 2)} eV)`, xL + 4, yEc - 6);
    c.fillStyle = COL_OK; c.fillText('Ev (0 eV)', xL + 4, yEv + 14);
    c.fillStyle = acc; c.fillText(`Ef=${fmtFix(r.Ef, 2)} eV`, xL + 4, yEf - 5);

    // Right panel: Fermi-Dirac occupancy f(E) in [0, 1]
    const fW = xR - xMid;
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(xMid, padT); c.lineTo(xMid, padT + bh); c.lineTo(xR, padT + bh); c.stroke();
    c.strokeStyle = COL_WARN; c.lineWidth = 2.2;
    c.beginPath();
    for (let i = 0; i <= 70; i++) {
      const E = eMin + ((eMax - eMin) * i) / 70;
      const f = r.fermiDirac(E);
      const px = xMid + f * fW, py = toY(E);
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    c.stroke();
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('f(E) = 0..1', xMid + fW * 0.5, padT - 8);
  }, clean);

  function drawArr() {
    const Nd = st.logNd >= 10 ? Math.pow(10, st.logNd) : 0;
    const Na = st.logNa >= 10 ? Math.pow(10, st.logNa) : 0;
    const invT = [], lN = [], lP = [], lNi = [];
    for (let i = 0; i <= 75; i++) {
      const T = 900 - (720 * i) / 75; // 900 K down to 180 K (increasing 1000/T)
      const s = solveSemiconductor({ material: st.material, T_K: T, Nd, Na });
      invT.push(1000 / T);
      lN.push(Math.max(4, Math.log10(Math.max(1e4, s.n))));
      lP.push(Math.max(4, Math.log10(Math.max(1e4, s.p))));
      lNi.push(Math.max(4, Math.log10(Math.max(1e4, s.ni))));
    }
    safePlot(cvArr, [
      { name: 'log₁₀(n)', color: COL_BLUE, xs: invT, ys: lN },
      { name: 'log₁₀(p)', color: COL_OK, xs: invT, ys: lP },
      { name: 'log₁₀(ni)', color: COL_WARN, xs: invT, ys: lNi },
    ], { x0: invT[0], x1: invT[invT.length - 1], ylabel: 'log₁₀(cm⁻³)', height: 225 });
  }

  function update() {
    const Nd = st.logNd >= 10 ? Math.pow(10, st.logNd) : 0;
    const Na = st.logNa >= 10 ? Math.pow(10, st.logNa) : 0;
    st.res = solveSemiconductor({ material: st.material, T_K: st.T_K, Nd, Na });
    const r = st.res;
    regBadge.textContent = r.regime;
    host.querySelectorAll('[data-smat] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.material));

    renderKpis(kpis, [
      { lbl: 'Öz Derişim n_i(T)', val: `${fmtSci(r.ni, 2)} cm⁻³`, sub: `E_g = ${fmtFix(r.Eg, 3)} eV`, tone: 'acc' },
      { lbl: 'Elektron n / Boşluk p', val: `${fmtSci(r.n, 2)}`, sub: `p = ${fmtSci(r.p, 2)} cm⁻³` },
      { lbl: 'Fermi Seviyesi E_F', val: `${fmtFix(r.Ef, 3)} eV`, sub: `E_F − E_i = ${fmtFix(r.Ef - r.Ei, 3)} eV`, tone: 'ok' },
      { lbl: 'İletkenlik σ', val: `${fmtSci(r.sigma_Scm, 2)} S/cm`, sub: `ρ = ${fmtSci(r.rho_OhmCm, 2)} Ω·cm` },
    ]);
    cvBand.render(); drawArr();
  }

  host.querySelector('[data-smat]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.material) return;
    st.material = b.dataset.m; update(); syncSegments(host, false);
  });
  bindPresets(host, SEMI_PRESETS, p => {
    Object.assign(st, p);
    sT.set(st.T_K); sNd.set(st.logNd); sNa.set(st.logNa);
    update();
  });

  attachReadout(cvArr, host.querySelector('[data-rd-arr]'), (x, ser, i) => `T=${fmtFix(1000 / x, 0)} K · log n=${fmtFix(ser[0].ys[i], 1)} · log ni=${fmtFix(ser[2].ys[i], 1)}`, clean);
  observeResize(host.querySelector('[data-box-arr]'), drawArr, clean);
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// FIELD: KİMYA MÜHENDİSLİĞİ (18–25)
// =====================================================================

// =====================================================================
// 18. REAKTÖR TASARIMI (BATCH / CSTR / PFR / LEVENSPIEL / NON-ISO CSTR) (field: kimya)
// =====================================================================

const REACTOR_PRESETS = [
  { label: '1. Derece (CSTR vs PFR)',       tab: 'iso', order: '1st',  k: 0.5, kRev: 0.12, CA0: 2.0, tau: 4.0, nCSTR: 3, Xtarget: 0.80 },
  { label: '2. Derece (Yüksek Hacim Farkı)', tab: 'iso', order: '2nd',  k: 0.4, kRev: 0.10, CA0: 2.0, tau: 4.0, nCSTR: 4, Xtarget: 0.80 },
  { label: 'Tersinir A ⇌ B (X_eq = %80)',   tab: 'iso', order: 'rev1', k: 0.8, kRev: 0.20, CA0: 2.0, tau: 4.0, nCSTR: 3, Xtarget: 0.70 },
  { label: 'Çoklu Kararlı Hal (3 Kesişim)', tab: 'noniso', tau: 60, Ea_kJ: 75, negDH_kJ: 90, T0: 320, Tc: 315, UA_kW: 0.50 },
];

function mountReactorDesign(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'iso', order: '1st', k: 0.5, kRev: 0.12, CA0: 2.0, v0: 1.0, tau: 4.0, nCSTR: 3, Xtarget: 0.80,
    tauNI: 60, k0: 3.4e8, Ea_kJ: 75, negDH_kJ: 90, Cp_kJ: 0.22, T0: 320, Tc: 315, UA_kW: 0.50,
    iso: null, noniso: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('Kesikli, <b>CSTR</b>, seri bağlı N-CSTR ve <b>PFR</b> reaktörlerinin dönüşüm–bekleme süresi eğrileri ile <b>Levenspiel hacim diyagramını</b> karşılaştır; izotermal olmayan ekzotermik CSTR\'de <b>çoklu kararlı halleri</b> (ateşleme/sönme) keşfet.', REACTOR_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-rtab aria-label="Reaktör modu">
        <button type="button" data-t="iso" class="on">İzotermal (CSTR / PFR / Levenspiel)</button>
        <button type="button" data-t="noniso">İzotermal Olmayan CSTR (Çoklu Hal)</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-rbadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2" data-iso-grid>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">Levenspiel Diyagramı: F_A0 / (−r_A) vs X</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-lev aria-label="Levenspiel hacim diyagramı"></canvas></div>
          </div>
          <div class="slc-plot-card" data-box-xt>
            <div class="slc-head">
              <h4 class="slc-title">Dönüşüm X — Bekleme Süresi τ</h4>
              <div class="slc-legend">
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_OK}"></i>PFR/Kesikli</span>
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_BLUE}"></i>N-CSTR</span>
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_BAD}"></i>1-CSTR</span>
              </div>
            </div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-xt aria-label="Dönüşüm zaman grafiği"></canvas><div class="slc-readout" data-rd-xt></div></div>
          </div>
        </div>
        <div class="slc-plot-card" data-box-ni hidden>
          <div class="slc-head"><h4 class="slc-title">Isı Üretimi G(T) vs Isı Çekimi R(T) — Çoklu Kararlı Haller</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-ni aria-label="İzotermal olmayan CSTR kararlı hal grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'V_{\\text{CSTR}} = \\frac{F_{A0}\\,X}{-r_A(X)}, \\qquad V_{\\text{PFR}} = F_{A0}\\int_0^X \\frac{dX}{-r_A(X)}, \\qquad X_{N\\text{-CSTR},1.} = 1 - \\left(1 + \\frac{k\\tau}{N}\\right)^{-N}',
        'G(T) = (-\\Delta H_{\\text{rxn}}) F_{A0}\\,\\frac{\\tau k(T)}{1+\\tau k(T)}, \\qquad R(T) = F_{A0} C_p (T - T_0) + UA(T - T_c)',
      ],
      paragraphs: [
        'Pozitif tepkime mertebeleri için $-r_A(X)$ dönüşüm arttıkça azalır; Levenspiel grafiğinde CSTR hacmi **dikdörtgen alan**, PFR hacmi ise **eğri altı integral alanı** olduğundan $V_{\\text{CSTR}} > V_{\\text{PFR}}$ olur. Seri bağlı $N$ adet CSTR sayısı arttıkça toplam hacim PFR hacmine yakınsar.',
        'Ekzotermik CSTR\'de S-biçimli ısı üretimi $G(T)$ doğrusal ısı çekimi $R(T)$\'yi üç noktada kesebilir: alt (sönük) ve üst (ateşlenmiş) noktalar kararlı ($G\' < R\'$), ortadaki nokta ise kararsızdır ($G\' > R\'$).',
      ],
      tasks: [
        '1. derece tepkimede seri CSTR sayısını $N = 1$ değerinden $N = 8$ değerine çıkarıp $V_{N\\text{-CSTR}}$\'nin $V_{\\text{PFR}}$ hacmine yakınsamasını gözle.',
        'Tepkime mertebesini 1. dereceden 2. dereceye geçirip hedef $X = 0.80$ için $V_{\\text{CSTR}} / V_{\\text{PFR}}$ oranının dramatik artışını karşılaştır.',
        '**İzotermal Olmayan CSTR** sekmesinde soğutma sıcaklığı $T_c$\'yi yavaşça artırarak alt kararlı halin yok olup sistemin üst ateşlenmiş hale sıçradığı (ateşleme noktası) değeri bul.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const rbadge = host.querySelector('[data-rbadge]');
  const isoGrid = host.querySelector('[data-iso-grid]');
  const boxNi = host.querySelector('[data-box-ni]');
  const cvXt = host.querySelector('[data-cv-xt]');

  const selOrd = addSelect(ctrls, 'Tepkime Kinetiği', [
    ['1st', '1. Derece (A → B)'],
    ['2nd', '2. Derece (2A → B)'],
    ['rev1', 'Tersinir 1. Derece (A ⇌ B)'],
  ], st.order, v => { st.order = v; syncVis(); update(); });
  const sK = addSlider(ctrls, { label: 'Hız Sabiti k', unit: '1/dk', min: 0.05, max: 2.0, step: 0.05, value: st.k, onInput: v => { st.k = v; update(); } });
  const sKrev = addSlider(ctrls, { label: 'Geri Hız Sabiti k₋₁', unit: '1/dk', min: 0.02, max: 1.0, step: 0.02, value: st.kRev, onInput: v => { st.kRev = v; update(); } });
  const sTau = addSlider(ctrls, { label: 'Bekleme Süresi τ', unit: 'dk', min: 0.5, max: 15, step: 0.25, value: st.tau, onInput: v => { st.tau = v; update(); } });
  const sNcstr = addSlider(ctrls, { label: 'Seri CSTR Sayısı N', min: 1, max: 10, step: 1, value: st.nCSTR, onInput: v => { st.nCSTR = Math.round(v); update(); } });
  const sXtar = addSlider(ctrls, { label: 'Hedef Dönüşüm X_hedef', min: 0.15, max: 0.92, step: 0.02, value: st.Xtarget, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.Xtarget = v; update(); } });

  const sTc = addSlider(ctrls, { label: 'Soğutucu Sıcaklığı T_c', unit: 'K', min: 280, max: 390, step: 2, value: st.Tc, onInput: v => { st.Tc = v; update(); } });
  const sT0 = addSlider(ctrls, { label: 'Besleme Sıcaklığı T₀', unit: 'K', min: 280, max: 390, step: 2, value: st.T0, onInput: v => { st.T0 = v; update(); } });
  const sUA = addSlider(ctrls, { label: 'Soğutma Katsayısı UA', unit: 'kW/K', min: 0.15, max: 1.20, step: 0.02, value: st.UA_kW, onInput: v => { st.UA_kW = v; update(); } });
  const sDH = addSlider(ctrls, { label: 'Tepkime Isısı (−ΔH)', unit: 'kJ/mol', min: 40, max: 140, step: 2, value: st.negDH_kJ, onInput: v => { st.negDH_kJ = v; update(); } });
  const sTauNI = addSlider(ctrls, { label: 'Bekleme Süresi τ', unit: 's', min: 15, max: 200, step: 5, value: st.tauNI, onInput: v => { st.tauNI = v; update(); } });

  const cvLev = setupCanvas(host.querySelector('[data-cv-lev]'), () => 245, (c, W, H) => {
    const r = st.iso;
    if (!r || st.tab !== 'iso') return;
    c.clearRect(0, 0, W, H);
    const padL = 48, padR = 14, padT = 18, padB = 30;
    const pw = W - padL - padR, ph = H - padT - padB;
    const maxX = Math.max(r.levX[r.levX.length - 1], 0.5);
    const maxY = Math.min(Math.max(r.FA0 / Math.max(1e-6, r.rateAtX(r.Xt)) * 1.3, r.levY[0] * 4), r.levY[r.levY.length - 1] * 1.15);
    const toX = x => padL + (x / maxX) * pw;
    const toY = y => padT + (1 - Math.min(maxY, y) / maxY) * ph;
    const acc = accentColor();

    c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    // CSTR outer rectangle
    const yCstr = r.FA0 / Math.max(1e-9, r.rateAtX(r.Xt));
    c.fillStyle = 'rgba(255,107,107,.14)'; c.strokeStyle = COL_BAD; c.lineWidth = 1.6;
    c.fillRect(toX(0), toY(yCstr), toX(r.Xt) - toX(0), toY(0) - toY(yCstr));
    c.strokeRect(toX(0), toY(yCstr), toX(r.Xt) - toX(0), toY(0) - toY(yCstr));

    // N-CSTR staircase rectangles
    if (st.nCSTR > 1) {
      c.strokeStyle = COL_BLUE; c.fillStyle = 'rgba(90,176,255,.15)'; c.lineWidth = 1.3;
      for (let i = 1; i < r.stageXs.length; i++) {
        const xa = r.stageXs[i - 1], xb = r.stageXs[i];
        const ySt = r.FA0 / Math.max(1e-9, r.rateAtX(xb));
        c.fillRect(toX(xa), toY(ySt), toX(xb) - toX(xa), toY(0) - toY(ySt));
        c.strokeRect(toX(xa), toY(ySt), toX(xb) - toX(xa), toY(0) - toY(ySt));
      }
    }

    // PFR area under curve up to Xt
    c.fillStyle = 'rgba(91,228,155,.28)';
    c.beginPath(); c.moveTo(toX(0), toY(0));
    r.levX.forEach((x, i) => { if (x <= r.Xt + 1e-6) c.lineTo(toX(x), toY(r.levY[i])); });
    c.lineTo(toX(r.Xt), toY(yCstr)); c.lineTo(toX(r.Xt), toY(0)); c.closePath(); c.fill();

    // Levenspiel curve
    c.strokeStyle = acc; c.lineWidth = 2.4;
    c.beginPath();
    r.levX.forEach((x, i) => { i === 0 ? c.moveTo(toX(x), toY(r.levY[i])) : c.lineTo(toX(x), toY(r.levY[i])); });
    c.stroke();

    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    c.textAlign = 'left'; c.fillText('Yeşil: V_PFR · Kırmızı: V_CSTR', padL + 4, 13);
    c.textAlign = 'right'; c.fillText(`X (hedef ${fmtFix(r.Xt, 2)})`, W - padR, H - 6);
  }, clean);

  const cvNi = setupCanvas(host.querySelector('[data-cv-ni]'), () => 280, (c, W, H) => {
    const ni = st.noniso;
    if (!ni || st.tab !== 'noniso') return;
    c.clearRect(0, 0, W, H);
    const padL = 52, padR = 16, padT = 22, padB = 32;
    const pw = W - padL - padR, ph = H - padT - padB;
    const tMin = ni.Ts[0], tMax = ni.Ts[ni.Ts.length - 1];
    const maxQ = Math.max(...ni.Gs, st.negDH_kJ * 1.2, 20) * 1.15;
    const toX = T => padL + ((T - tMin) / (tMax - tMin)) * pw;
    const toY = Q => padT + (1 - Math.max(-10, Math.min(maxQ, Q)) / maxQ) * ph;

    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = padT + (ph * i) / 4;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke();
    }
    c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    // Heat generation S-curve G(T)
    c.strokeStyle = COL_BAD; c.lineWidth = 2.6;
    c.beginPath();
    ni.Ts.forEach((T, i) => { i === 0 ? c.moveTo(toX(T), toY(ni.Gs[i])) : c.lineTo(toX(T), toY(ni.Gs[i])); });
    c.stroke();

    // Heat removal line R(T)
    c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
    c.beginPath();
    let penR = false;
    ni.Ts.forEach((T, i) => {
      if (ni.Rs[i] < 0 || ni.Rs[i] > maxQ) { penR = false; return; }
      const x = toX(T), y = toY(ni.Rs[i]);
      if (!penR) { c.moveTo(x, y); penR = true; } else c.lineTo(x, y);
    });
    c.stroke();

    // Steady-state intersection markers
    ni.steadyStates.forEach((ss, idx) => {
      const sx = toX(ss.T), sy = toY(ss.Q_kW);
      if (sx < padL || sx > padL + pw) return;
      c.fillStyle = ss.stable ? COL_OK : COL_WARN;
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.arc(sx, sy, 6.2, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = ss.stable ? COL_OK : COL_WARN;
      c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`S${idx + 1}: ${fmtFix(ss.T, 0)}K (${ss.stable ? 'Kararlı' : 'Kararsız'})`, sx, Math.max(16, sy - 11));
    });

    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    c.textAlign = 'left'; c.fillText('Kırmızı: Isı Üretimi G(T) · Mavi: Isı Çekimi R(T) [kW]', padL + 4, 14);
    c.textAlign = 'right'; c.fillText('Reaktör Sıcaklığı T (K)', W - padR, H - 6);
    c.textAlign = 'center';
    for (const T of [300, 350, 400, 450, 500, 550]) c.fillText(`${T}K`, toX(T), padT + ph + 15);
  }, clean);

  function drawPlot() {
    if (st.tab === 'iso' && st.iso) {
      const r = st.iso;
      safePlot(cvXt, [
        { name: 'PFR/Kesikli', color: COL_OK, xs: r.taus, ys: r.xPFRCurve.map(v => v * 100) },
        { name: `${st.nCSTR}-CSTR`, color: COL_BLUE, xs: r.taus, ys: r.xNCSTRCurve.map(v => v * 100) },
        { name: '1-CSTR', color: COL_BAD, xs: r.taus, ys: r.xCSTRCurve.map(v => v * 100) },
      ], { x0: 0, x1: r.taus[r.taus.length - 1], ylabel: 'Dönüşüm X (%)', height: 225 });
    }
  }

  function syncVis() {
    const isI = st.tab === 'iso';
    [selOrd, sK, sTau, sNcstr, sXtar].forEach(s => s.setVisible(isI));
    sKrev.setVisible(isI && st.order === 'rev1');
    [sTc, sT0, sUA, sDH, sTauNI].forEach(s => s.setVisible(!isI));
    isoGrid.hidden = !isI;
    boxNi.hidden = isI;
    host.querySelectorAll('[data-rtab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  }

  function update() {
    if (st.tab === 'iso') {
      st.iso = solveIsothermalReactors({ order: st.order, k: st.k, kRev: st.kRev, CA0: st.CA0, v0: st.v0, tau: st.tau, nCSTR: st.nCSTR, Xtarget: st.Xtarget });
      const r = st.iso;
      rbadge.textContent = `V_CSTR / V_PFR = ${fmtFix(r.volRatio, 2)}×`;
      renderKpis(kpis, [
        { lbl: 'PFR / Kesikli X(τ)', val: `%${fmtFix(r.X_PFR * 100, 1)}`, sub: `V_PFR = ${fmtFix(r.V_PFR, 2)} L`, tone: 'ok' },
        { lbl: 'Tek CSTR X(τ)', val: `%${fmtFix(r.X_CSTR * 100, 1)}`, sub: `V_CSTR = ${fmtFix(r.V_CSTR, 2)} L`, tone: 'bad' },
        { lbl: `${st.nCSTR} Seri CSTR X(τ)`, val: `%${fmtFix(r.X_NCSTR * 100, 1)}`, sub: `V_${st.nCSTR}CSTR = ${fmtFix(r.V_NCSTR, 2)} L`, tone: 'acc' },
        { lbl: 'Denge Sınırı X_eq', val: `%${fmtFix(r.Xeq * 100, 1)}`, sub: `Hedef X = %${fmtFix(r.Xt * 100, 0)}` },
      ]);
      cvLev.render(); drawPlot();
    } else {
      st.noniso = solveNonIsothermalCSTR({ tau: st.tauNI, k0: st.k0, Ea_kJ: st.Ea_kJ, negDH_kJ: st.negDH_kJ, Cp_kJ: st.Cp_kJ, T0: st.T0, Tc: st.Tc, UA_kW: st.UA_kW });
      const ni = st.noniso;
      rbadge.textContent = ni.hasMultipleSS ? '3 Kararlı Hal (Bistabil)' : `${ni.steadyStates.length} Tekil Kararlı Hal`;
      rbadge.className = `slc-badge ${ni.hasMultipleSS ? 'slc-badge-warn' : 'slc-badge-ok'}`;
      renderKpis(kpis, ni.steadyStates.map((ss, idx) => ({
        lbl: `Kesişim S${idx + 1} (${ss.label})`,
        val: `${fmtFix(ss.T, 1)} K`,
        sub: `X = %${fmtFix(ss.X * 100, 1)} · Q = ${fmtFix(ss.Q_kW, 1)} kW`,
        tone: ss.stable ? 'ok' : 'warn',
      })));
      cvNi.render();
    }
  }

  host.querySelector('[data-rtab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncVis(); update(); syncSegments(host, false);
  });
  bindPresets(host, REACTOR_PRESETS, p => {
    Object.assign(st, p);
    if (p.tau && p.tab === 'noniso') st.tauNI = p.tau;
    selOrd.set(st.order); sK.set(st.k); sKrev.set(st.kRev); sTau.set(st.tau); sNcstr.set(st.nCSTR); sXtar.set(st.Xtarget);
    sTc.set(st.Tc); sT0.set(st.T0); sUA.set(st.UA_kW); sDH.set(st.negDH_kJ); sTauNI.set(st.tauNI);
    syncVis(); update();
  });

  attachReadout(cvXt, host.querySelector('[data-rd-xt]'), (x, ser, i) => `τ=${fmtFix(x, 2)} · PFR=%${fmtFix(ser[0].ys[i], 1)} · CSTR=%${fmtFix(ser[2].ys[i], 1)}`, clean);
  observeResize(host.querySelector('[data-box-xt]'), drawPlot, clean);
  bindTasks(host);
  syncVis();
  update();
  return clean.run;
}

// =====================================================================
// 19. REAKSİYON KİNETİĞİ (SERİ/PARALEL, ARRHENIUS, MICHAELIS-MENTEN) (field: kimya)
// =====================================================================

const KIN_PRESETS = [
  { label: 'Seri A→B→C (Yüksek B)',  tab: 'sp', mode: 'series', k1: 1.0, k2: 0.2, CA0: 2.0 },
  { label: 'Paralel Seçicilik',      tab: 'sp', mode: 'parallel', k1: 0.75, k2: 0.25, CA0: 2.0 },
  { label: 'Arrhenius (Ea=65 kJ/mol)', tab: 'arr', Ea_kJ: 65, T1_K: 300, T2_K: 350 },
  { label: 'Yarışmalı İnhibisyon',   tab: 'mm', Vmax: 10, Km: 2.0, inh: 'competitive', I: 3.0, Ki: 2.0 },
];

function mountReactionKinetics(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'sp', mode: 'series', k1: 0.8, k2: 0.25, CA0: 2.0, tMax: 12,
    A_arr: 1e10, Ea_kJ: 65, T1_K: 300, T2_K: 350,
    Vmax: 10, Km: 2.0, inh: 'competitive', I: 2.0, Ki: 2.0,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Seri (A→B→C) ve paralel</b> tepkimelerin derişim profillerini, ara ürün maksimum zamanını (t_max) ve yarı ömrü incele; <b>Arrhenius grafiği</b> ile <b>Michaelis–Menten / Lineweaver–Burk</b> enzim kinetiğini keşfet.', KIN_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-ktab aria-label="Kinetik sekmesi">
        <button type="button" data-t="sp" class="on">Seri & Paralel</button>
        <button type="button" data-t="arr">Arrhenius Grafiği</button>
        <button type="button" data-t="mm">Michaelis–Menten & LB</button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card" data-box1>
          <div class="slc-head"><h4 class="slc-title" data-t1>Derişim – Zaman Profilleri C_A, C_B, C_C</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv1 aria-label="Kinetik ana grafik"></canvas><div class="slc-readout" data-rd1></div></div>
        </div>
        <div class="slc-plot-card" data-box2 hidden>
          <div class="slc-head"><h4 class="slc-title" data-t2>Lineweaver–Burk Çift Ters Grafiği (1/v vs 1/[S])</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv2 aria-label="Lineweaver-Burk veya ikincil grafik"></canvas><div class="slc-readout" data-rd2></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'C_B(t) = C_{A0}\\frac{k_1}{k_2 - k_1}\\left(e^{-k_1 t} - e^{-k_2 t}\\right), \\qquad t_{\\max} = \\frac{\\ln(k_2/k_1)}{k_2 - k_1}, \\qquad t_{1/2} = \\frac{\\ln 2}{k}',
        '\\ln k = \\ln A - \\frac{E_a}{R}\\cdot\\frac{1}{T}, \\qquad v = \\frac{V_{\\max}[S]}{K_m + [S]}, \\qquad \\frac{1}{v} = \\frac{K_m}{V_{\\max}}\\frac{1}{[S]} + \\frac{1}{V_{\\max}}',
      ],
      paragraphs: [
        'Seri $A \\xrightarrow{k_1} B \\xrightarrow{k_2} C$ tepkimesinde istenen ürün ara madde $B$ ise tepkime $t_{\\max}$ anında durdurulmalıdır; $k_1 \\gg k_2$ oldukça maksimum verim $C_{B,\\max}$ yükselir.',
        'Michaelis–Menten enzim kinetiğinde yarışmalı (competitive) inhibitör $V_{\\max}$\'ı değiştirmez ancak görünür $K_m$\'i büyütür; yarışmasız (non-competitive) inhibitör ise $K_m$\'i sabit tutarken $V_{\\max}$\'ı düşürür — bu fark Lineweaver–Burk doğrularının kesişim yerinden hemen okunur.',
      ],
      tasks: [
        'Seri tepkimede $k_1 = k_2 = 0.5$ seçip $C_{B,\\max} = C_{A0}/e \\approx 0.368\\,C_{A0}$ ve $t_{\\max} = 1/k_1 = 2$ sınırını doğrula.',
        '**Arrhenius** sekmesinde $E_a = 55\\text{ kJ/mol}$ için $Q_{10}$ (her $10\\text{ K}$\'de hız artışı) değerinin ~2 kat olduğunu gör.',
        '**Michaelis–Menten** sekmesinde inhibitör tipini **Yarışmalı** ve **Yarışmasız** arasında değiştirip Lineweaver–Burk kesişiminin y-ekseninden x-eksenine kayışını incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const box2 = host.querySelector('[data-box2]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');

  const selSp = addSelect(ctrls, 'Mekanizma', [['series', 'Seri: A → B → C'], ['parallel', 'Paralel: A → B ve A → C']], st.mode, v => { st.mode = v; update(); });
  const sK1 = addSlider(ctrls, { label: 'Hız Sabiti k₁', unit: '1/dk', min: 0.05, max: 2.0, step: 0.05, value: st.k1, onInput: v => { st.k1 = v; update(); } });
  const sK2 = addSlider(ctrls, { label: 'Hız Sabiti k₂', unit: '1/dk', min: 0.05, max: 2.0, step: 0.05, value: st.k2, onInput: v => { st.k2 = v; update(); } });
  const sCA0 = addSlider(ctrls, { label: 'Başlangıç C_A0', unit: 'mol/L', min: 0.5, max: 5.0, step: 0.25, value: st.CA0, onInput: v => { st.CA0 = v; update(); } });

  const sEa = addSlider(ctrls, { label: 'Aktivasyon Enerjisi E_a', unit: 'kJ/mol', min: 20, max: 140, step: 2, value: st.Ea_kJ, onInput: v => { st.Ea_kJ = v; update(); } });
  const sT1 = addSlider(ctrls, { label: 'Sıcaklık T₁', unit: 'K', min: 270, max: 450, step: 5, value: st.T1_K, onInput: v => { st.T1_K = v; update(); } });
  const sT2 = addSlider(ctrls, { label: 'Sıcaklık T₂', unit: 'K', min: 280, max: 510, step: 5, value: st.T2_K, onInput: v => { st.T2_K = v; update(); } });

  const sVmax = addSlider(ctrls, { label: 'Maksimum Hız V_max', unit: 'µM/s', min: 2, max: 25, step: 0.5, value: st.Vmax, onInput: v => { st.Vmax = v; update(); } });
  const sKm = addSlider(ctrls, { label: 'Michaelis Sabiti K_m', unit: 'mM', min: 0.5, max: 8.0, step: 0.25, value: st.Km, onInput: v => { st.Km = v; update(); } });
  const selInh = addSelect(ctrls, 'İnhibisyon Türü', [
    ['none', 'İnhibitör Yok'], ['competitive', 'Yarışmalı (Competitive)'],
    ['noncompetitive', 'Yarışmasız (Non-competitive)'], ['uncompetitive', 'Bileşik-Bağlı (Uncompetitive)'],
  ], st.inh, v => { st.inh = v; update(); });
  const sI = addSlider(ctrls, { label: 'İnhibitör [I]', unit: 'mM', min: 0, max: 8, step: 0.25, value: st.I, onInput: v => { st.I = v; update(); } });

  let computed = null;
  function syncVis() {
    const t = st.tab;
    [selSp, sK1, sK2, sCA0].forEach(s => s.setVisible(t === 'sp'));
    [sEa, sT1, sT2].forEach(s => s.setVisible(t === 'arr'));
    [sVmax, sKm, selInh, sI].forEach(s => s.setVisible(t === 'mm'));
    box2.hidden = t === 'sp';
    t1.textContent = t === 'sp' ? 'Derişim – Zaman Profilleri (A: Mavi, B: Yeşil, C: Sarı)'
      : t === 'arr' ? 'Arrhenius Doğrusu: ln(k) vs 1000 / T (Eğim = −Ea/R)'
        : 'Michaelis–Menten Hız Eğrisi: v vs [S]';
    t2.textContent = t === 'arr' ? 'Hız Sabiti k(T) Üstel Artışı' : 'Lineweaver–Burk Grafiği: 1/v vs 1/[S]';
    host.querySelectorAll('[data-ktab] button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  }

  function drawPlots() {
    if (!computed) return;
    if (st.tab === 'sp') {
      const r = computed;
      safePlot(cv1, [
        { name: 'C_A', color: COL_BLUE, xs: r.ts, ys: r.CA },
        { name: 'C_B', color: COL_OK, xs: r.ts, ys: r.CB },
        { name: 'C_C', color: COL_WARN, xs: r.ts, ys: r.CC },
      ], { x0: 0, x1: st.tMax, ylabel: 'C (mol/L)', height: 260 });
    } else if (st.tab === 'arr') {
      const r = computed;
      const revInv = r.invT.slice().reverse(), revLn = r.lnK.slice().reverse();
      safePlot(cv1, [{ name: 'ln k', color: accentColor(), xs: revInv, ys: revLn }], { x0: revInv[0], x1: revInv[revInv.length - 1], ylabel: 'ln k', height: 215 });
      safePlot(cv2, [{ name: 'k(T)', color: COL_WARN, xs: r.Ts, ys: r.ks }], { x0: r.Ts[0], x1: r.Ts[r.Ts.length - 1], ylabel: 'k (1/s)', height: 195 });
    } else {
      const r = computed;
      safePlot(cv1, [
        { name: 'İnhibitörsüz', color: COL_OK, xs: r.Ss, ys: r.vBase },
        { name: 'İnhibitörlü', color: COL_BAD, xs: r.Ss, ys: r.vInh },
      ], { x0: 0, x1: 15, ylabel: 'v (µM/s)', height: 215 });
      safePlot(cv2, [
        { name: 'Baz 1/v', color: COL_OK, xs: r.lbX, ys: r.lbBase },
        { name: 'İnh. 1/v', color: COL_BAD, xs: r.lbX, ys: r.lbInh },
      ], { x0: r.lbX[0], x1: r.lbX[r.lbX.length - 1], ylabel: '1/v', height: 205 });
    }
  }

  function update() {
    if (st.tab === 'sp') {
      computed = solveSeriesParallelKinetics({ mode: st.mode, k1: st.k1, k2: st.k2, CA0: st.CA0, tMax: st.tMax });
      const r = computed;
      renderKpis(kpis, [
        { lbl: 'Yarı Ömür t₁/₂ (A)', val: `${fmtFix(r.halfLifeA, 2)} dk`, tone: 'acc' },
        { lbl: st.mode === 'series' ? 'Maks. Ara Ürün t_max' : 'Seçicilik S_B/C', val: st.mode === 'series' ? `${fmtFix(r.tMaxB, 2)} dk` : fmtFix(r.selectivity, 2) },
        { lbl: 'Maks. C_B', val: `${fmtFix(r.CBmax, 3)} mol/L`, sub: `Verim %${fmtFix((r.CBmax / st.CA0) * 100, 1)}`, tone: 'ok' },
        { lbl: 'Kütle Korunumu', val: `${fmtFix(st.CA0, 2)} mol/L`, sub: 'C_A + C_B + C_C = C_A0' },
      ]);
    } else if (st.tab === 'arr') {
      computed = solveArrhenius({ A: st.A_arr, Ea_kJ: st.Ea_kJ, T1_K: st.T1_K, T2_K: st.T2_K });
      const r = computed;
      renderKpis(kpis, [
        { lbl: `k(${st.T1_K} K)`, val: `${fmtSci(r.k1, 2)} 1/s` },
        { lbl: `k(${st.T2_K} K)`, val: `${fmtSci(r.k2, 2)} 1/s`, tone: 'acc' },
        { lbl: 'Hız Oranı k₂/k₁', val: `${fmtNum(r.ratio, 3)}×`, tone: 'ok' },
        { lbl: 'Q₁₀ (+10 K Çarpanı)', val: `${fmtFix(r.Q10, 2)}×`, sub: `Eğim −Ea/R = ${fmtFix(r.slope, 2)}` },
      ]);
    } else {
      computed = solveMichaelisMenten({ Vmax: st.Vmax, Km: st.Km, inhibition: st.inh, I: st.I, Ki: st.Ki });
      const r = computed;
      renderKpis(kpis, [
        { lbl: 'Görünür V_max', val: `${fmtFix(r.VmaxEff, 2)} µM/s`, sub: `Baz: ${st.Vmax}`, tone: 'acc' },
        { lbl: 'Görünür K_m', val: `${fmtFix(r.KmEff, 2)} mM`, sub: `Baz: ${st.Km}` },
        { lbl: 'LB y-Kesişimi (1/V_max)', val: fmtFix(r.yInterceptInh, 3), sub: `Baz: ${fmtFix(r.yInterceptBase, 3)}` },
        { lbl: 'LB x-Kesişimi (−1/K_m)', val: fmtFix(r.xInterceptInh, 3), sub: `Baz: ${fmtFix(r.xInterceptBase, 3)}` },
      ]);
    }
    drawPlots();
  }

  host.querySelector('[data-ktab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncVis(); update(); syncSegments(host, false);
  });
  bindPresets(host, KIN_PRESETS, p => {
    Object.assign(st, p);
    selSp.set(st.mode); sK1.set(st.k1); sK2.set(st.k2); sCA0.set(st.CA0);
    sEa.set(st.Ea_kJ); sT1.set(st.T1_K); sT2.set(st.T2_K);
    sVmax.set(st.Vmax); sKm.set(st.Km); selInh.set(st.inh); sI.set(st.I);
    syncVis(); update();
  });

  attachReadout(cv1, host.querySelector('[data-rd1]'), (x, ser, i) => `x=${fmtFix(x, 2)} · y=${fmtFix(ser[0].ys[i], 3)}`, clean);
  attachReadout(cv2, host.querySelector('[data-rd2]'), (x, ser, i) => `x=${fmtFix(x, 2)} · y=${fmtFix(ser[0].ys[i], 3)}`, clean);
  observeResize(host.querySelector('[data-box1]'), drawPlots, clean);
  bindTasks(host);
  syncVis();
  update();
  return clean.run;
}

// =====================================================================
// 20. KİMYASAL DENGE (LE CHATELIER) & ASİT-BAZ TİTRASYONU (field: kimya)
// =====================================================================

const EQ_PRESETS = [
  { label: 'Haber–Bosch (NH₃ Sentezi)', tab: 'eq', reactionId: 'haber', T_K: 650, P_bar: 50 },
  { label: 'Endotermik N₂O₄ ⇌ 2NO₂',   tab: 'eq', reactionId: 'n2o4',  T_K: 325, P_bar: 1.0 },
  { label: 'Zayıf Asit (CH₃COOH + NaOH)', tab: 'tit', tmode: 'weak-acid', Ca: 0.1, Cb: 0.1, pKa: 4.76, Vb: 25 },
  { label: 'Kuvvetli Asit (HCl + NaOH)', tab: 'tit', tmode: 'strong-acid', Ca: 0.1, Cb: 0.1, pKa: 4.76, Vb: 50 },
];

function mountChemicalEquilibrium(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'eq',
    reactionId: 'haber', T_K: 650, P_bar: 50, n0: [1.0, 3.0, 0.2],
    tmode: 'weak-acid', Ca: 0.10, Va: 50, Cb: 0.10, pKa: 4.76, Vb: 25, indicator: 'phen',
    eqRes: null, titRes: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Le Chatelier ilkesini</b> Gibbs serbest enerjisinden hesaplanan K_p(T) ile test et (sıcaklık, basınç ve derişim bozucularıyla); <b>Asit–Baz Titrasyonu</b> sekmesinde tam yük dengesiyle pH eğrisi, tampon bölgesi ve indikatör renk değişimini izle.', EQ_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-etab aria-label="Denge veya titrasyon">
        <button type="button" data-t="eq" class="on">Le Chatelier & Gibbs (K_p)</button>
        <button type="button" data-t="tit">Asit–Baz Titrasyonu & pH</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-ebadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel">
        <div data-ctrls></div>
        <div class="slc-btn-row" data-perturb>
          <button type="button" class="btn small" data-pt="heat">+50 K Isıt</button>
          <button type="button" class="btn small" data-pt="press">2× Basınç</button>
          <button type="button" class="btn small" data-pt="addR">+0.5 mol Reaktan</button>
        </div>
        <div class="slc-beaker-bar" data-beaker hidden>
          <span class="slc-beaker-swatch" data-swatch></span>
          <span data-ind-txt></span>
        </div>
      </div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card" data-box-eq>
          <div class="slc-head"><h4 class="slc-title">Başlangıç vs Denge Mol Dağılımı (Le Chatelier Kayması)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-eq aria-label="Kimyasal denge mol çubuk grafiği"></canvas></div>
        </div>
        <div class="slc-plot-card" data-box-tit hidden>
          <div class="slc-head"><h4 class="slc-title">Titrasyon pH Eğrisi & İndikatör Geçiş Aralığı</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-tit aria-label="Asit baz titrasyon pH eğrisi"></canvas><div class="slc-readout" data-rd-tit></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\Delta G^\\circ = \\Delta H^\\circ - T\\Delta S^\\circ, \\qquad K_p(T) = \\exp\\!\\left(-\\frac{\\Delta G^\\circ}{R T}\\right), \\qquad Q_p = \\prod_i p_i^{\\nu_i}',
        '\\text{Tampon: } \\mathrm{pH} \\approx \\mathrm{p}K_a + \\log_{10}\\frac{[\\text{A}^-]}{[\\text{HA}]}',
      ],
      paragraphs: [
        'Ekzotermik tepkimelerde ($\\Delta H^\\circ < 0$, örn. Haber–Bosch) sıcaklık artışı van \'t Hoff bağıntısı gereği $K_p$\'yi küçültür ve denge reaktanlara kayar; toplam gaz mol sayısı azalıyorsa ($\\Delta n < 0$) basınç artışı ürün verimini yükseltir.',
        'Zayıf asit + kuvvetli baz titrasyonunda yarı eşdeğerlik noktasında ($V_b = V_{\\text{eq}}/2$) $\\mathrm{pH} \\approx \\mathrm{p}K_a$ tampon platosu oluşur ve eşdeğerlik noktası eşlenik baz hidrolizi nedeniyle $\\mathrm{pH} > 7$ bazik bölgede kalır.',
      ],
      tasks: [
        '**Haber–Bosch** tepkimesinde `2× Basınç` düğmesine basıp $\\text{NH}_3$ denge molünün arttığını, `+50 K Isıt` ile azaldığını doğrula.',
        'Tepkimeyi $\\text{H}_2 + \\text{I}_2 \\rightleftharpoons 2\\text{HI}$ ($\\Delta n = 0$) seçip basınç değişiminin denge bileşimini etkilemediğini gör.',
        '**Zayıf Asit Titrasyonu** senaryosunda $V_b = 25\\text{ mL}$ (yarı eşdeğerlik) noktasında $\\mathrm{pH} \\approx \\mathrm{p}K_a = 4.76$ olduğunu ve $V_b = 50\\text{ mL}$ eşdeğerlikte fenolftaleinin renk değiştirdiğini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const ebadge = host.querySelector('[data-ebadge]');
  const perturbRow = host.querySelector('[data-perturb]');
  const beaker = host.querySelector('[data-beaker]');
  const swatch = host.querySelector('[data-swatch]');
  const indTxt = host.querySelector('[data-ind-txt]');
  const boxEq = host.querySelector('[data-box-eq]');
  const boxTit = host.querySelector('[data-box-tit]');
  const cvTit = host.querySelector('[data-cv-tit]');

  const selRx = addSelect(ctrls, 'Denge Tepkimesi', Object.entries(EQ_REACTIONS).map(([k, v]) => [k, v.label]), st.reactionId, v => {
    st.reactionId = v;
    const rx = EQ_REACTIONS[v];
    st.T_K = rx.Tdef; st.P_bar = rx.Pdef; st.n0 = rx.n0.slice();
    sT.set(st.T_K); sP.set(st.P_bar); update();
  });
  const sT = addSlider(ctrls, { label: 'Sıcaklık T', unit: 'K', min: 270, max: 1000, step: 10, value: st.T_K, onInput: v => { st.T_K = v; update(); } });
  const sP = addSlider(ctrls, { label: 'Toplam Basınç P', unit: 'bar', min: 0.2, max: 200, log: true, value: st.P_bar, onInput: v => { st.P_bar = v; update(); } });

  const selTmode = addSelect(ctrls, 'Titrasyon Sistemi', [
    ['weak-acid', 'Zayıf Asit + Kuvvetli Baz (NaOH)'],
    ['strong-acid', 'Kuvvetli Asit (HCl) + NaOH'],
    ['weak-base', 'Zayıf Baz (NH₃) + HCl'],
  ], st.tmode, v => { st.tmode = v; syncVis(); update(); });
  const sCa = addSlider(ctrls, { label: 'Analit Derişimi C_a', unit: 'M', min: 0.02, max: 0.5, step: 0.02, value: st.Ca, onInput: v => { st.Ca = v; update(); } });
  const sCb = addSlider(ctrls, { label: 'Titrant Derişimi C_b', unit: 'M', min: 0.02, max: 0.5, step: 0.02, value: st.Cb, onInput: v => { st.Cb = v; update(); } });
  const sPka = addSlider(ctrls, { label: 'pK_a (veya pK_b)', min: 2.0, max: 10.5, step: 0.1, value: st.pKa, onInput: v => { st.pKa = v; update(); } });
  const sVb = addSlider(ctrls, { label: 'Eklenen Titrant V_b', unit: 'mL', min: 0, max: 100, step: 1, value: st.Vb, onInput: v => { st.Vb = v; update(); } });
  const selInd = addSelect(ctrls, 'İndikatör', [
    ['phen', 'Fenolftalein (pH 8.2–10.0)'],
    ['btb', 'Bromtimol Mavisi (pH 6.0–7.6)'],
    ['mo', 'Metil Oranj (pH 3.1–4.4)'],
  ], st.indicator, v => { st.indicator = v; update(); });

  const cvEq = setupCanvas(host.querySelector('[data-cv-eq]'), () => 250, (c, W, H) => {
    const r = st.eqRes;
    if (!r || st.tab !== 'eq') return;
    c.clearRect(0, 0, W, H);
    const padL = 44, padR = 16, padT = 24, padB = 34;
    const pw = W - padL - padR, ph = H - padT - padB;
    const maxN = Math.max(...r.n0, ...r.nEq, 1) * 1.18;
    const nSp = r.species.length;
    const grpW = pw / nSp;
    const acc = accentColor();

    c.strokeStyle = COL_AXIS; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(padL, padT); c.lineTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();

    r.species.forEach((sp, i) => {
      const gx = padL + i * grpW + grpW * 0.5;
      const bw = Math.min(34, grpW * 0.28);
      const h0 = (r.n0[i] / maxN) * ph;
      const hEq = (r.nEq[i] / maxN) * ph;

      // Initial bar
      c.fillStyle = 'rgba(255,255,255,.18)';
      c.fillRect(gx - bw - 3, padT + ph - h0, bw, h0);
      // Equilibrium bar
      const col = r.nu[i] > 0 ? COL_OK : acc;
      c.fillStyle = col;
      c.fillRect(gx + 3, padT + ph - hEq, bw, hEq);

      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(sp, gx, padT + ph + 16);
      c.fillStyle = col; c.font = '10px "JetBrains Mono", monospace';
      c.fillText(`${fmtFix(r.nEq[i], 2)} mol`, gx + bw * 0.5 + 3, padT + ph - hEq - 6);
    });

    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillText('Gri: Başlangıç mol · Renkli: Denge mol', padL + 4, 14);
  }, clean);

  function indicatorColor(pH) {
    if (st.indicator === 'mo') return pH < 3.1 ? ['#ff4d6d', 'Kırmızı (Asidik)'] : pH > 4.4 ? ['#ffd166', 'Sarı'] : ['#fb923c', 'Turuncu (Geçiş)'];
    if (st.indicator === 'btb') return pH < 6.0 ? ['#ffd166', 'Sarı (Asidik)'] : pH > 7.6 ? ['#5ab0ff', 'Mavi (Bazik)'] : ['#5be49b', 'Yeşil (Nötr Geçiş)'];
    return pH < 8.2 ? ['rgba(244,244,245,.25)', 'Renksiz'] : pH > 10.0 ? ['#e879f9', 'Koyu Pembe (Bazik)'] : ['#f472b6', 'Açık Pembe (Geçiş)'];
  }

  function drawTitPlot() {
    if (st.tab !== 'tit' || !st.titRes) return;
    const tr = st.titRes;
    const band = st.indicator === 'mo' ? [3.1, 4.4] : st.indicator === 'btb' ? [6.0, 7.6] : [8.2, 10.0];
    safePlot(cvTit, [
      { name: 'pH(Vb)', color: accentColor(), xs: tr.Vs, ys: tr.pHs },
      { name: 'İnd. Alt', color: 'rgba(232,121,249,.45)', xs: [0, tr.Vmax], ys: [band[0], band[0]] },
      { name: 'İnd. Üst', color: 'rgba(232,121,249,.45)', xs: [0, tr.Vmax], ys: [band[1], band[1]] },
      { name: 'Anlık V_b', color: COL_WARN, xs: [st.Vb, st.Vb], ys: [0, tr.pHCur] },
    ], { x0: 0, x1: tr.Vmax, ylabel: 'pH', height: 245 });
  }

  function syncVis() {
    const isEq = st.tab === 'eq';
    [selRx, sT, sP].forEach(s => s.setVisible(isEq));
    [selTmode, sCa, sCb, sVb, selInd].forEach(s => s.setVisible(!isEq));
    sPka.setVisible(!isEq && st.tmode !== 'strong-acid');
    perturbRow.hidden = !isEq;
    beaker.hidden = isEq;
    boxEq.hidden = !isEq;
    boxTit.hidden = isEq;
    host.querySelectorAll('[data-etab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  }

  function update() {
    if (st.tab === 'eq') {
      st.eqRes = solveChemicalEquilibrium({ reactionId: st.reactionId, T_K: st.T_K, P_bar: st.P_bar, nInit: st.n0 });
      const r = st.eqRes;
      ebadge.textContent = r.shiftDir;
      renderKpis(kpis, [
        { lbl: 'Denge Sabiti K_p', val: fmtSci(r.Kp, 2), sub: `ΔG° = ${fmtFix(r.dG_kJ, 1)} kJ/mol`, tone: 'acc' },
        { lbl: 'Başlangıç Q_p', val: fmtSci(r.QpInit, 2), sub: `ΔH° = ${r.dH_kJ} kJ/mol` },
        { lbl: 'İlerleme Derecesi ξ', val: `${r.xiEq >= 0 ? '+' : ''}${fmtFix(r.xiEq, 3)} mol`, sub: `Δn = ${r.deltaN}`, tone: r.xiEq > 0 ? 'ok' : 'warn' },
        { lbl: `Ürün Mol Kesri (${r.species[r.species.length - 1]})`, val: `%${fmtFix(r.yEq[r.yEq.length - 1] * 100, 1)}`, sub: `P = ${fmtFix(st.P_bar, 1)} bar` },
      ]);
      cvEq.render();
    } else {
      const Veq = (st.Ca * st.Va) / Math.max(1e-6, st.Cb);
      sVb.setRange(0, Math.max(20, Veq * 2));
      st.Vb = Math.min(Veq * 2, st.Vb);
      st.titRes = solveTitrationCurve({ mode: st.tmode, Ca: st.Ca, Va_mL: st.Va, Cb: st.Cb, pKa: st.pKa, VbCurrent: st.Vb });
      const tr = st.titRes;
      const [col, desc] = indicatorColor(tr.pHCur);
      swatch.style.background = col;
      indTxt.textContent = `Beher: pH = ${fmtFix(tr.pHCur, 2)} · ${desc}`;
      ebadge.textContent = `pH = ${fmtFix(tr.pHCur, 2)}`;
      renderKpis(kpis, [
        { lbl: 'Anlık pH', val: fmtFix(tr.pHCur, 2), sub: `V_b = ${fmtFix(st.Vb, 1)} mL`, tone: 'acc' },
        { lbl: 'Eşdeğerlik V_eq', val: `${fmtFix(tr.Veq, 1)} mL`, sub: `pH_eq = ${fmtFix(tr.pHEq, 2)}`, tone: 'ok' },
        { lbl: 'Yarı-Eşdeğerlik pH', val: fmtFix(tr.pHHalf, 2), sub: st.tmode === 'weak-acid' ? `Tampon ≈ pKa (${st.pKa})` : 'Başlangıç: ' + fmtFix(tr.pH0, 2) },
        { lbl: 'Başlangıç pH₀', val: fmtFix(tr.pH0, 2), sub: `C_a=${st.Ca} M, V_a=${st.Va} mL` },
      ]);
      drawTitPlot();
    }
  }

  host.querySelector('[data-etab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncVis(); update(); syncSegments(host, false);
  });
  perturbRow.addEventListener('click', e => {
    const b = e.target.closest('[data-pt]'); if (!b) return;
    const act = b.dataset.pt;
    if (act === 'heat') { st.T_K = Math.min(1000, st.T_K + 50); sT.set(st.T_K); }
    else if (act === 'press') { st.P_bar = Math.min(200, st.P_bar * 2); sP.set(st.P_bar); }
    else if (act === 'addR') { st.n0[0] = Math.min(5, st.n0[0] + 0.5); }
    update();
  });
  bindPresets(host, EQ_PRESETS, p => {
    Object.assign(st, p);
    if (p.reactionId) st.n0 = EQ_REACTIONS[p.reactionId].n0.slice();
    selRx.set(st.reactionId); sT.set(st.T_K); sP.set(st.P_bar);
    selTmode.set(st.tmode); sCa.set(st.Ca); sCb.set(st.Cb); sPka.set(st.pKa); sVb.set(st.Vb);
    syncVis(); update();
  });

  attachReadout(cvTit, host.querySelector('[data-rd-tit]'), (x, ser, i) => `V_b = ${fmtFix(x, 1)} mL · pH = ${fmtFix(ser[0].ys[i], 2)}`, clean);
  observeResize(boxTit, drawTitPlot, clean);
  bindTasks(host);
  syncVis();
  update();
  return clean.run;
}

// =====================================================================
// 21. DAMITMA (McCABE-THIELE & RAOULT T-x-y / P-x-y) (field: kimya)
// =====================================================================

const DIST_PRESETS = [
  { label: 'Doygun Sıvı Besleme (q = 1)', tab: 'mt', alpha: 2.5, zF: 0.50, xD: 0.92, xW: 0.08, q: 1.0, R: 2.0 },
  { label: 'İki Fazlı Besleme (q = 0.5)', tab: 'mt', alpha: 2.2, zF: 0.45, xD: 0.90, xW: 0.10, q: 0.5, R: 2.5 },
  { label: 'Zor Ayırma (α = 1.4)',        tab: 'mt', alpha: 1.4, zF: 0.50, xD: 0.88, xW: 0.12, q: 1.0, R: 5.5 },
  { label: 'Benzen–Toluen (Raoult)',      tab: 'raoult', mix: 'ben-tol', T_C: 95, P_kPa: 101.325 },
];

function mountDistillation(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'mt',
    alpha: 2.5, zF: 0.50, xD: 0.92, xW: 0.08, q: 1.0, R: 2.0,
    mix: 'ben-tol', T_C: 95, P_kPa: 101.325,
    mt: null, rlt: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('İkili karışım kolonunda <b>McCabe–Thiele</b> yöntemiyle q-doğrusu, zenginleştirme/sıyırma çalışma doğruları, minimum reflü (R_min) ve teorik raf basamaklarını canlı çiz; <b>Raoult Yasası</b> sekmesinde T–x–y ve P–x–y buhar–sıvı dengesini incele.', DIST_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-dtab aria-label="Damıtma modu">
        <button type="button" data-t="mt" class="on">McCabe–Thiele Kolon</button>
        <button type="button" data-t="raoult">Raoult T–x–y & P–x–y</button>
      </div>
      <span class="slc-badge" data-dbadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card" data-box-mt>
          <div class="slc-head"><h4 class="slc-title">McCabe–Thiele Diyagramı (y vs x)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-mt aria-label="McCabe-Thiele basamak diyagramı"></canvas></div>
        </div>
        <div class="slc-grid-2" data-box-rlt hidden>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">T–x–y Diyagramı (Sabit P)</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-txy aria-label="Raoult T-x-y diyagramı"></canvas><div class="slc-readout" data-rd-txy></div></div>
          </div>
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title">P–x–y Diyagramı (Sabit T)</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-pxy aria-label="Raoult P-x-y diyagramı"></canvas><div class="slc-readout" data-rd-pxy></div></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'y^* = \\frac{\\alpha x}{1 + (\\alpha - 1)x}, \\qquad y_R = \\frac{R}{R+1}x + \\frac{x_D}{R+1}, \\qquad y_q = \\frac{q}{q-1}x - \\frac{z_F}{q-1}',
        'N_{\\min} = \\frac{\\ln\\!\\left(\\frac{x_D}{1-x_D}\\frac{1-x_W}{x_W}\\right)}{\\ln\\alpha} \\;\\;(\\text{Fenske}), \\qquad P = x_1 P_1^{\\text{sat}}(T) + (1-x_1) P_2^{\\text{sat}}(T)',
      ],
      paragraphs: [
        'Reflü oranı $R$, minimum reflü $R_{\\min}$ değerine yaklaştıkça çalışma doğruları besleme kıstırma (pinch) noktasında denge eğrisine yaklaşır ve teorik raf sayısı sonsuza gider. Ekonomik tasarım tipik olarak $R \\approx (1.2\\text{–}1.5) R_{\\min}$ seçilir.',
        'Besleme kalitesi $q = 1$ doygun sıvıyı (dikey $q$-doğrusu), $q = 0$ doygun buharı (yatay $q$-doğrusu) temsil eder.',
      ],
      tasks: [
        'Reflü oranı $R$\'yi $R_{\\min}$\'e yaklaştırıp basamakların kıstırma noktasında nasıl sıkıştığını, $R \\le R_{\\min}$ olduğunda ayırmanın olanaksızlaştığını gör.',
        'Reflü oranını $R = 10$ (yüksek reflü) yapıp teorik raf sayısının Fenske alt sınırına $N_{\\min}$ yaklaştığını doğrula.',
        '**Raoult** sekmesinde Benzen–Toluen için $101.3\\text{ kPa}$\'da kaynama noktalarının $80.1^\\circ\\text{C}$ ve $110.6^\\circ\\text{C}$ olduğunu incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const dbadge = host.querySelector('[data-dbadge]');
  const boxMt = host.querySelector('[data-box-mt]');
  const boxRlt = host.querySelector('[data-box-rlt]');
  const cvTxy = host.querySelector('[data-cv-txy]');
  const cvPxy = host.querySelector('[data-cv-pxy]');

  const sAlp = addSlider(ctrls, { label: 'Bağıl Uçuculuk α', min: 1.25, max: 5.0, step: 0.05, value: st.alpha, onInput: v => { st.alpha = v; update(); } });
  const sR = addSlider(ctrls, { label: 'Reflü Oranı R', min: 0.4, max: 12.0, step: 0.1, value: st.R, onInput: v => { st.R = v; update(); } });
  const sQ = addSlider(ctrls, { label: 'Besleme Kalitesi q', min: -0.3, max: 1.4, step: 0.05, value: st.q, onInput: v => { st.q = v; update(); } });
  const sZf = addSlider(ctrls, { label: 'Besleme Bileşimi z_F', min: 0.15, max: 0.85, step: 0.02, value: st.zF, onInput: v => { st.zF = v; update(); } });
  const sXd = addSlider(ctrls, { label: 'Tepe Ürünü x_D', min: 0.70, max: 0.98, step: 0.01, value: st.xD, onInput: v => { st.xD = v; update(); } });
  const sXw = addSlider(ctrls, { label: 'Dip Ürünü x_W', min: 0.02, max: 0.30, step: 0.01, value: st.xW, onInput: v => { st.xW = v; update(); } });

  const selMix = addSelect(ctrls, 'İkili Karışım', Object.entries(ANTOINE_MIXTURES).map(([k, v]) => [k, v.label]), st.mix, v => {
    st.mix = v; st.T_C = ANTOINE_MIXTURES[v].Tdef; sTemp.set(st.T_C); update();
  });
  const sTemp = addSlider(ctrls, { label: 'P–x–y Sıcaklığı T', unit: '°C', min: 50, max: 130, step: 1, value: st.T_C, onInput: v => { st.T_C = v; update(); } });
  const sPres = addSlider(ctrls, { label: 'T–x–y Basıncı P', unit: 'kPa', min: 40, max: 220, step: 5, value: st.P_kPa, onInput: v => { st.P_kPa = v; update(); } });

  const cvMt = setupCanvas(host.querySelector('[data-cv-mt]'), w => Math.min(370, Math.max(290, w * 0.72)), (c, W, H) => {
    const mt = st.mt;
    if (!mt || st.tab !== 'mt') return;
    c.clearRect(0, 0, W, H);
    const padL = 46, padR = 18, padT = 18, padB = 34;
    const sz = Math.min(W - padL - padR, H - padT - padB);
    const ox = padL + (W - padL - padR - sz) * 0.5;
    const oy = padT;
    const toX = x => ox + x * sz;
    const toY = y => oy + (1 - y) * sz;
    const acc = accentColor();

    // Grid & diagonal y = x
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const f = i / 5;
      c.beginPath(); c.moveTo(toX(f), oy); c.lineTo(toX(f), oy + sz); c.moveTo(ox, toY(f)); c.lineTo(ox + sz, toY(f)); c.stroke();
    }
    c.strokeStyle = COL_AXIS; c.lineWidth = 1.2; c.strokeRect(ox, oy, sz, sz);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(toX(0), toY(0)); c.lineTo(toX(1), toY(1)); c.stroke();
    c.setLineDash([]);

    // Equilibrium curve y*(x)
    c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = i / 80;
      const y = (st.alpha * x) / (1 + (st.alpha - 1) * x);
      i === 0 ? c.moveTo(toX(x), toY(y)) : c.lineTo(toX(x), toY(y));
    }
    c.stroke();

    // q-line from (zF, zF) to pinch
    c.strokeStyle = COL_WARN; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(toX(st.zF), toY(st.zF)); c.lineTo(toX(mt.pinch.x), toY(mt.pinch.y)); c.stroke();

    if (mt.ok) {
      // Rectifying & Stripping operating lines
      c.strokeStyle = COL_OK; c.lineWidth = 2;
      c.beginPath(); c.moveTo(toX(st.xD), toY(st.xD)); c.lineTo(toX(mt.intersect.x), toY(mt.intersect.y)); c.lineTo(toX(st.xW), toY(st.xW)); c.stroke();

      // Theoretical stage staircase
      c.strokeStyle = acc; c.lineWidth = 1.8;
      c.beginPath();
      mt.steps.forEach((p, i) => { i === 0 ? c.moveTo(toX(p.x), toY(p.y)) : c.lineTo(toX(p.x), toY(p.y)); });
      c.stroke();
    } else {
      c.fillStyle = COL_BAD; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText('R ≤ R_min — Kıstırma Noktası!', ox + sz * 0.5, oy + sz * 0.2);
    }

    // Axis ticks
    c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    for (const v of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      c.fillText(v.toFixed(1), toX(v), oy + sz + 15);
    }
    c.fillText('Sıvı mol kesri x', ox + sz * 0.5, H - 4);
    c.textAlign = 'right';
    for (const v of [0, 0.5, 1.0]) c.fillText(v.toFixed(1), ox - 6, toY(v) + 3);
  }, clean);

  function drawRaoult() {
    if (st.tab !== 'raoult' || !st.rlt) return;
    const r = st.rlt;
    safePlot(cvTxy, [
      { name: 'Kabarcık T(x)', color: COL_BLUE, xs: r.xs, ys: r.Txy_T },
      { name: 'Çiy T(y)', color: COL_BAD, xs: r.Txy_y, ys: r.Txy_T },
    ], { x0: 0, x1: 1, ylabel: 'T (°C)', height: 225 });
    safePlot(cvPxy, [
      { name: 'Kabarcık P(x)', color: COL_BLUE, xs: r.xs, ys: r.Pxy_P },
      { name: 'Çiy P(y)', color: COL_OK, xs: r.Pxy_y, ys: r.Pxy_P },
    ], { x0: 0, x1: 1, ylabel: 'P (kPa)', height: 225 });
  }

  function syncVis() {
    const isM = st.tab === 'mt';
    [sAlp, sR, sQ, sZf, sXd, sXw].forEach(s => s.setVisible(isM));
    [selMix, sTemp, sPres].forEach(s => s.setVisible(!isM));
    boxMt.hidden = !isM;
    boxRlt.hidden = isM;
    host.querySelectorAll('[data-dtab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  }

  function update() {
    if (st.tab === 'mt') {
      st.mt = solveMcCabeThiele({ alpha: st.alpha, zF: st.zF, xD: st.xD, xW: st.xW, q: st.q, R: st.R });
      const m = st.mt;
      dbadge.textContent = m.ok ? `${fmtFix(m.stagesExact, 1)} Teorik Raf` : 'R ≤ R_min (Olanaksız)';
      dbadge.className = `slc-badge ${m.ok ? 'slc-badge-ok' : 'slc-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Teorik Raf Sayısı N', val: m.ok ? `${fmtFix(m.stagesExact, 2)} (${m.stagesInt})` : '∞', sub: m.ok ? `Optimum besleme: ${m.feedStage}. raf` : m.error, tone: m.ok ? 'acc' : 'bad' },
        { lbl: 'Min. Reflü R_min', val: fmtFix(m.Rmin, 2), sub: `R / R_min = ${fmtFix(st.R / Math.max(0.01, m.Rmin), 2)}×` },
        { lbl: 'Fenske Min. Raf N_min', val: fmtFix(m.Nmin, 2), sub: 'Toplam reflü (R → ∞)', tone: 'ok' },
        { lbl: 'Kıstırma (Pinch)', val: `(${fmtFix(m.pinch.x, 2)}, ${fmtFix(m.pinch.y, 2)})`, sub: `q = ${fmtFix(st.q, 2)}` },
      ]);
      cvMt.render();
    } else {
      st.rlt = solveRaoultDiagrams({ mixtureId: st.mix, T_C: st.T_C, P_kPa: st.P_kPa });
      const r = st.rlt;
      dbadge.textContent = `α_ort = ${fmtFix(r.alphaAvg, 2)}`;
      dbadge.className = 'slc-badge slc-badge-acc';
      renderKpis(kpis, [
        { lbl: `${r.mix.c1.name} Kaynama`, val: `${fmtFix(r.Tb1, 1)} °C`, sub: `P₁^sat(${st.T_C}°C) = ${fmtFix(r.P1, 1)} kPa`, tone: 'acc' },
        { lbl: `${r.mix.c2.name} Kaynama`, val: `${fmtFix(r.Tb2, 1)} °C`, sub: `P₂^sat(${st.T_C}°C) = ${fmtFix(r.P2, 1)} kPa` },
        { lbl: 'Bağıl Uçuculuk α', val: fmtFix(r.alphaAvg, 2), sub: 'P₁^sat / P₂^sat', tone: 'ok' },
        { lbl: 'Sistem Basıncı P', val: `${fmtFix(st.P_kPa, 1)} kPa`, sub: `ΔT_kaynama = ${fmtFix(Math.abs(r.Tb2 - r.Tb1), 1)} °C` },
      ]);
      drawRaoult();
    }
  }

  host.querySelector('[data-dtab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncVis(); update(); syncSegments(host, false);
  });
  bindPresets(host, DIST_PRESETS, p => {
    Object.assign(st, p);
    sAlp.set(st.alpha); sR.set(st.R); sQ.set(st.q); sZf.set(st.zF); sXd.set(st.xD); sXw.set(st.xW);
    selMix.set(st.mix); sTemp.set(st.T_C); sPres.set(st.P_kPa);
    syncVis(); update();
  });

  attachReadout(cvTxy, host.querySelector('[data-rd-txy]'), (x, ser, i) => `x=${fmtFix(x, 2)} · T=${fmtFix(ser[0].ys[i], 1)} °C`, clean);
  attachReadout(cvPxy, host.querySelector('[data-rd-pxy]'), (x, ser, i) => `x=${fmtFix(x, 2)} · P=${fmtFix(ser[0].ys[i], 1)} kPa`, clean);
  observeResize(boxRlt, drawRaoult, clean);
  bindTasks(host);
  syncVis();
  update();
  return clean.run;
}

// =====================================================================
// 22. KÜTLE TRANSFERİ (FİLM, ABSORPSİYON, ÜÇGEN LLE) (field: kimya)
// =====================================================================

const MT_PRESETS = [
  { label: 'Yüksek Derişim Stefan Akısı', tab: 'film', xA1: 0.65, xA2: 0.05, delta_mm: 2.0 },
  { label: 'Seyreltik Sınır (Fick ≈ Stefan)', tab: 'film', xA1: 0.04, xA2: 0.005, delta_mm: 2.0 },
  { label: 'Gaz Absorpsiyonu (%90 Giderim)', tab: 'abs', m: 1.2, Gs: 100, Ls: 180, Yin: 0.08, Yout: 0.008 },
  { label: 'Sıvı–Sıvı Ekstraksiyon (S/F=1.2)', tab: 'lle', xBF: 0.32, SoverF: 1.2 },
];

function mountMassTransfer(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'film',
    DAB: 0.25, C: 40.9, delta_mm: 2.0, xA1: 0.65, xA2: 0.05,
    m: 1.2, Gs: 100, Ls: 180, Yin: 0.08, Yout: 0.008,
    xBF: 0.32, SoverF: 1.2,
    res: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Durgun film boyunca difüzyon</b> (Fick eşmolar vs Stefan sürüklenme), <b>gaz absorpsiyon kolonu</b> çalışma doğrusu / Kremser raf hesabı ve <b>üçgen faz diyagramında sıvı–sıvı ekstraksiyonu (LLE)</b> incele.', MT_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-mtab aria-label="Kütle transferi modülü">
        <button type="button" data-t="film" class="on">Film Difüzyonu</button>
        <button type="button" data-t="abs">Gaz Absorpsiyonu</button>
        <button type="button" data-t="lle">Üçgen Diyagram (LLE)</button>
      </div>
      <span class="slc-badge slc-badge-acc" data-mbadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title" data-mtitle>Film İçinde Mol Kesri Profili x_A(z/δ)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-mt aria-label="Kütle transferi diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'N_{A,\\text{eşmolar}} = \\frac{D_{AB} C}{\\delta}(x_{A1} - x_{A2}), \\qquad N_{A,\\text{Stefan}} = \\frac{D_{AB} C}{\\delta}\\ln\\!\\left(\\frac{1 - x_{A2}}{1 - x_{A1}}\\right)',
        'Y = \\frac{L_s}{G_s}(X - X_{\\text{in}}) + Y_{\\text{out}}, \\qquad A = \\frac{L_s}{m G_s}, \\qquad F + S = M = R + E',
      ],
      paragraphs: [
        'Durgun bir B filmi içinden yalnızca A difüzlendiğinde yığın sürüklenmesi (bulk drift) derişim profilini yukarı büker ve Stefan akısı eşmolar Fick akısından büyük çıkar; seyreltik sınırda ($x_A \\ll 1$) iki model çakışır.',
        'Üçgen diyagramda besleme $F$ ile saf çözücü $S$ arasındaki karışım noktası $M$ iki fazlı binodal kubbe içine düştüğünde, $M$\'den geçen bağ çizgisi rafinat ($R$) ve ekstrakt ($E$) bileşimlerini belirler.',
      ],
      tasks: [
        '**Film Difüzyonu** sekmesinde $x_{A1}$ değerini $0.65$\'ten $0.04$\'e düşürerek sürüklenme çarpanının $N_{\\text{Stefan}}/N_{\\text{eşmolar}} \\to 1$ olduğunu doğrula.',
        '**Gaz Absorpsiyonu** sekmesinde sıvı debisini $L_s$ azaltarak $L_s/G_s$ oranı minimum sınıra yaklaştıkça Kremser raf sayısının hızla arttığını gör.',
        '**Üçgen Diyagram (LLE)** sekmesinde $S/F$ çözücü oranını artırarak karışım noktası $M$\'nin sağa kayışını ve çözünen geri kazanımını izle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const mbadge = host.querySelector('[data-mbadge]');
  const mtitle = host.querySelector('[data-mtitle]');

  const sXA1 = addSlider(ctrls, { label: 'Sınır Mol Kesri x_A1', min: 0.02, max: 0.85, step: 0.01, value: st.xA1, onInput: v => { st.xA1 = v; update(); } });
  const sXA2 = addSlider(ctrls, { label: 'Sınır Mol Kesri x_A2', min: 0.0, max: 0.40, step: 0.01, value: st.xA2, onInput: v => { st.xA2 = v; update(); } });
  const sDel = addSlider(ctrls, { label: 'Film Kalınlığı δ', unit: 'mm', min: 0.5, max: 8.0, step: 0.25, value: st.delta_mm, onInput: v => { st.delta_mm = v; update(); } });

  const sM = addSlider(ctrls, { label: 'Denge Eğimi m (Y*=mX)', min: 0.4, max: 3.0, step: 0.05, value: st.m, onInput: v => { st.m = v; update(); } });
  const sLs = addSlider(ctrls, { label: 'Sıvı Debisi L_s', unit: 'mol/s', min: 60, max: 360, step: 5, value: st.Ls, onInput: v => { st.Ls = v; update(); } });
  const sYin = addSlider(ctrls, { label: 'Giriş Gazı Y_in', min: 0.02, max: 0.16, step: 0.005, value: st.Yin, onInput: v => { st.Yin = v; update(); } });
  const sYout = addSlider(ctrls, { label: 'Hedef Çıkış Y_out', min: 0.002, max: 0.05, step: 0.002, value: st.Yout, onInput: v => { st.Yout = v; update(); } });

  const sXbf = addSlider(ctrls, { label: 'Beslemede Çözünen x_B,F', min: 0.08, max: 0.50, step: 0.02, value: st.xBF, onInput: v => { st.xBF = v; update(); } });
  const sSF = addSlider(ctrls, { label: 'Çözücü / Besleme Oranı S/F', min: 0.15, max: 3.5, step: 0.05, value: st.SoverF, onInput: v => { st.SoverF = v; update(); } });

  const cv = setupCanvas(host.querySelector('[data-cv-mt]'), w => Math.min(350, Math.max(270, w * 0.66)), (c, W, H) => {
    const r = st.res;
    if (!r) return;
    c.clearRect(0, 0, W, H);
    const acc = accentColor();

    if (st.tab === 'film') {
      const padL = 48, padR = 18, padT = 22, padB = 32;
      const pw = W - padL - padR, ph = H - padT - padB;
      const maxX = Math.max(st.xA1, st.xA2, 0.1) * 1.12;
      const toX = u => padL + u * pw;
      const toY = x => padT + (1 - x / maxX) * ph;
      c.strokeStyle = COL_AXIS; c.lineWidth = 1.2; c.strokeRect(padL, padT, pw, ph);

      // Equimolar linear profile
      c.strokeStyle = COL_BLUE; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); r.xi.forEach((u, i) => { i === 0 ? c.moveTo(toX(u), toY(r.xEq[i])) : c.lineTo(toX(u), toY(r.xEq[i])); }); c.stroke();
      c.setLineDash([]);
      // Stefan curved profile
      c.strokeStyle = acc; c.lineWidth = 2.6;
      c.beginPath(); r.xi.forEach((u, i) => { i === 0 ? c.moveTo(toX(u), toY(r.xSt[i])) : c.lineTo(toX(u), toY(r.xSt[i])); }); c.stroke();

      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
      c.textAlign = 'left'; c.fillText('Düz: Durgun Film (Stefan) · Kesikli: Eşmolar (Fick)', padL + 4, 14);
      c.textAlign = 'right'; c.fillText('Boyutsuz Film Konumu z / δ', W - padR, H - 8);
    } else if (st.tab === 'abs') {
      const padL = 50, padR = 18, padT = 22, padB = 32;
      const pw = W - padL - padR, ph = H - padT - padB;
      const xMax = Math.max((r.Xout || 0.08), st.Yin / st.m) * 1.15;
      const yMax = st.Yin * 1.15;
      const toX = x => padL + (x / xMax) * pw;
      const toY = y => padT + (1 - y / yMax) * ph;

      c.strokeStyle = COL_AXIS; c.lineWidth = 1.2; c.strokeRect(padL, padT, pw, ph);
      // Equilibrium line Y* = m X
      c.strokeStyle = COL_BLUE; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(toX(0), toY(0)); c.lineTo(toX(yMax / st.m), toY(yMax)); c.stroke();

      if (r.ok) {
        // Operating line
        c.strokeStyle = COL_OK; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(toX(r.Xin), toY(r.Yout)); c.lineTo(toX(r.Xout), toY(r.Yin)); c.stroke();
        // Stage steps
        c.strokeStyle = acc; c.lineWidth = 1.7;
        c.beginPath(); r.steps.forEach((p, i) => { i === 0 ? c.moveTo(toX(p.X), toY(p.Y)) : c.lineTo(toX(p.X), toY(p.Y)); }); c.stroke();
      } else {
        c.fillStyle = COL_BAD; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText('L/G ≤ (L/G)_min — Yetersiz Çözücü!', W * 0.5, H * 0.45);
      }
      c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace';
      c.textAlign = 'left'; c.fillText('Mavi: Denge Y*=mX · Yeşil: Çalışma Doğrusu', padL + 4, 14);
      c.textAlign = 'right'; c.fillText('Sıvı Mol Oranı X', W - padR, H - 8);
    } else {
      // Equilateral ternary triangle (A bottom-left, S bottom-right, B top)
      const side = Math.min(W - 76, (H - 54) / (Math.sqrt(3) * 0.5));
      const hTri = side * Math.sqrt(3) * 0.5;
      const x0 = (W - side) * 0.5, y0 = H - 24;
      const triPt = p => ({ x: x0 + (p.xS + 0.5 * p.xB) * side, y: y0 - p.xB * hTri });

      // Triangle border & light 20% grid
      const pA = triPt({ xA: 1, xB: 0, xS: 0 });
      const pS = triPt({ xA: 0, xB: 0, xS: 1 });
      const pB = triPt({ xA: 0, xB: 1, xS: 0 });
      c.strokeStyle = COL_AXIS; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(pA.x, pA.y); c.lineTo(pS.x, pS.y); c.lineTo(pB.x, pB.y); c.closePath(); c.stroke();

      // Binodal dome
      c.fillStyle = 'rgba(90,176,255,.12)'; c.strokeStyle = COL_BLUE; c.lineWidth = 2;
      c.beginPath();
      r.binodal.forEach((pt, i) => { const s = triPt(pt); i === 0 ? c.moveTo(s.x, s.y) : c.lineTo(s.x, s.y); });
      c.closePath(); c.fill(); c.stroke();

      // Background tie lines
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.1;
      r.tieLines.forEach(tl => {
        const a = triPt(tl.R), b = triPt(tl.E);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      });

      // Mixing line F -> S
      const sF = triPt(r.feed), sM = triPt(r.M);
      c.strokeStyle = COL_WARN; c.setLineDash([4, 3]); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(sF.x, sF.y); c.lineTo(pS.x, pS.y); c.stroke();
      c.setLineDash([]);

      // Active tie line R - M - E
      if (r.inTwoPhase && r.R && r.E) {
        const sR = triPt(r.R), sE = triPt(r.E);
        c.strokeStyle = COL_OK; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(sR.x, sR.y); c.lineTo(sE.x, sE.y); c.stroke();
        for (const [pt, lbl, col] of [[sR, 'R', COL_OK], [sE, 'E', COL_OK]]) {
          c.fillStyle = col; c.beginPath(); c.arc(pt.x, pt.y, 5, 0, Math.PI * 2); c.fill();
          c.fillStyle = COL_FG; c.font = '700 10.5px "JetBrains Mono", monospace'; c.fillText(lbl, pt.x + 8, pt.y - 4);
        }
      }
      // Points F and M
      c.fillStyle = COL_WARN; c.beginPath(); c.arc(sF.x, sF.y, 4.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = acc; c.strokeStyle = '#fff'; c.lineWidth = 1.8;
      c.beginPath(); c.arc(sM.x, sM.y, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();

      c.fillStyle = COL_FG; c.font = '700 11px "JetBrains Mono", monospace';
      c.textAlign = 'right'; c.fillText('A (Taşıyıcı)', pA.x - 6, pA.y + 4);
      c.textAlign = 'left'; c.fillText('S (Çözücü)', pS.x + 6, pS.y + 4);
      c.textAlign = 'center'; c.fillText('B (Çözünen)', pB.x, pB.y - 8);
    }
  }, clean);

  function syncVis() {
    const t = st.tab;
    [sXA1, sXA2, sDel].forEach(s => s.setVisible(t === 'film'));
    [sM, sLs, sYin, sYout].forEach(s => s.setVisible(t === 'abs'));
    [sXbf, sSF].forEach(s => s.setVisible(t === 'lle'));
    mtitle.textContent = t === 'film' ? 'Film İçinde Mol Kesri Profili x_A(z/δ)'
      : t === 'abs' ? 'Gaz Absorpsiyon Kolonu: Y – X Basamak Diyagramı'
        : 'Eşkenar Üçgen Faz Diyagramı (A–B–S Sıvı–Sıvı Ekstraksiyon)';
    host.querySelectorAll('[data-mtab] button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  }

  function update() {
    if (st.tab === 'film') {
      st.res = solveFilmDiffusion({ DAB_cm2s: st.DAB, C_molm3: st.C, delta_mm: st.delta_mm, xA1: st.xA1, xA2: st.xA2 });
      const r = st.res;
      mbadge.textContent = `Sürüklenme: ${fmtFix(r.driftFactor, 2)}×`;
      renderKpis(kpis, [
        { lbl: 'Stefan Akısı (Durgun B)', val: `${fmtFix(r.NA_stagnant, 3)} mol/m²s`, tone: 'acc' },
        { lbl: 'Eşmolar Fick Akısı', val: `${fmtFix(r.NA_equimolar, 3)} mol/m²s` },
        { lbl: 'Yığın Akış Oranı', val: `${fmtFix(r.driftFactor, 3)}×`, sub: 'N_Stefan / N_eşmolar', tone: 'ok' },
        { lbl: 'Film Kalınlığı δ', val: `${fmtFix(st.delta_mm, 2)} mm`, sub: `D_AB = ${st.DAB} cm²/s` },
      ]);
    } else if (st.tab === 'abs') {
      st.res = solveGasAbsorption({ m: st.m, Gs: st.Gs, Ls: st.Ls, Yin: st.Yin, Yout: st.Yout, Xin: 0 });
      const r = st.res;
      mbadge.textContent = r.ok ? `N = ${fmtFix(r.N_kremser, 2)} raf · A = ${fmtFix(r.A, 2)}` : 'L/G Yetersiz!';
      mbadge.className = `slc-badge ${r.ok ? 'slc-badge-ok' : 'slc-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Kremser Teorik Raf N', val: r.ok ? `${fmtFix(r.N_kremser, 2)} (${r.N_int})` : '∞', tone: r.ok ? 'acc' : 'bad' },
        { lbl: 'Absorpsiyon Faktörü A', val: fmtFix(r.A, 2), sub: `L/G = ${fmtFix(r.ratioLG, 2)} (min ${fmtFix(r.minLG, 2)})` },
        { lbl: 'Giderim Verimi', val: r.ok ? `%${fmtFix(r.removalPct, 1)}` : '—', tone: 'ok' },
        { lbl: 'Çıkış Sıvısı X_out', val: r.ok ? fmtFix(r.Xout, 4) : '—', sub: 'mol B / mol çözücü' },
      ]);
    } else {
      st.res = solveLLETernary({ xBF: st.xBF, SoverF: st.SoverF, F: 100 });
      const r = st.res;
      mbadge.textContent = r.inTwoPhase ? `Geri Kazanım: %${fmtFix(r.recoveryPct, 1)}` : 'Tek Fazlı (Ayrışma Yok)';
      mbadge.className = `slc-badge ${r.inTwoPhase ? 'slc-badge-ok' : 'slc-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'Çözünen Geri Kazanımı', val: `%${fmtFix(r.recoveryPct, 1)}`, tone: r.inTwoPhase ? 'acc' : 'warn' },
        { lbl: 'Ekstrakt Akımı E', val: `${fmtFix(r.F_E, 1)} kg`, sub: r.E ? `x_B,E = ${fmtFix(r.E.xB, 3)}` : 'Tek faz' },
        { lbl: 'Rafinat Akımı R', val: `${fmtFix(r.F_R, 1)} kg`, sub: r.R ? `x_B,R = ${fmtFix(r.R.xB, 3)}` : 'Tek faz' },
        { lbl: 'Dağılma Katsayısı K_D', val: r.inTwoPhase ? fmtFix(r.KD, 2) : '—', sub: `Karışım M = ${fmtFix(r.M_mass, 0)} kg` },
      ]);
    }
    cv.render();
  }

  host.querySelector('[data-mtab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t; syncVis(); update(); syncSegments(host, false);
  });
  bindPresets(host, MT_PRESETS, p => {
    Object.assign(st, p);
    sXA1.set(st.xA1); sXA2.set(st.xA2); sDel.set(st.delta_mm);
    sM.set(st.m); sLs.set(st.Ls); sYin.set(st.Yin); sYout.set(st.Yout);
    sXbf.set(st.xBF); sSF.set(st.SoverF);
    syncVis(); update();
  });

  bindTasks(host);
  syncVis();
  update();
  return clean.run;
}

// =====================================================================
// 23. KÜTLE & ENERJİ DENGESİ (AKIŞ ŞEMASI: GERİ DÖNGÜ & BLÖF) (field: kimya)
// =====================================================================

const FLOW_PRESETS = [
  { label: 'Dengeli Sentez Döngüsü', F0: 100, yI0: 0.05, Xsp: 0.35, sepEff: 0.95, fPurge: 0.10, dH_kJ: -45, TR_C: 220 },
  { label: 'Düşük Blöf (İnert Birikimi!)', F0: 100, yI0: 0.06, Xsp: 0.30, sepEff: 0.95, fPurge: 0.02, dH_kJ: -45, TR_C: 220 },
  { label: 'Yüksek Tek Geçiş Dönüşümü', F0: 100, yI0: 0.03, Xsp: 0.70, sepEff: 0.98, fPurge: 0.15, dH_kJ: -60, TR_C: 260 },
  { label: 'Endotermik Proses (+ΔH)', F0: 100, yI0: 0.04, Xsp: 0.40, sepEff: 0.92, fPurge: 0.12, dH_kJ: 55, TR_C: 350 },
];

function mountMassEnergyBalance(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    F0: 100, yI0: 0.05, Xsp: 0.35, sepEff: 0.95, fPurge: 0.10, dH_kJ: -45, TR_C: 220,
    playing: autoPlayAllowed(), flowT: 0, sol: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Karıştırıcı → Reaktör (A→B) → Ayırıcı → Bölücü (Geri Döngü + Blöf)</b> proses akış şemasının kararlı hal kütle ve enerji denklemlerini çöz. Blöf (purge) oranının inert birikimi ve toplam dönüşüm üzerindeki etkisini canlı izle.', FLOW_PRESETS)}
    <div class="slc-toolbar">
      <div class="slc-toolbar-g">
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
      </div>
      <span class="slc-badge slc-badge-ok" data-fbadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-plot-card">
          <div class="slc-head"><h4 class="slc-title">Proses Akış Şeması (Canlı Akım Debileri, mol/s)</h4></div>
          <div class="slc-cv-box"><canvas class="slc-cv" data-cv-pfd aria-label="Kimyasal proses akış şeması"></canvas></div>
        </div>
        <div class="slc-table-wrap">
          <table class="slc-tbl" aria-label="Proses akım tablosu">
            <thead><tr><th>Akım</th><th>Toplam (mol/s)</th><th>A (mol/s)</th><th>B (mol/s)</th><th>İnert I (mol/s)</th><th>y_I (%)</th></tr></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'X_{\\text{toplam}} = \\frac{X_{\\text{sp}}}{1 - (1 - f_p)(1 - X_{\\text{sp}})}, \\qquad S_{1,I} = \\frac{F_{0,I}}{f_p}',
        '\\dot{Q}_{\\text{reaktör}} = \\dot{n}_{S1} C_p (T_R - T_0) + \\dot{\\xi}\\,\\Delta H_{\\text{rxn}}',
      ],
      paragraphs: [
        'Tek geçişli dönüşümü düşük ($X_{\\text{sp}} = 0.35$) tepkimelerde ayrıştırılmamış $A$\'nın geri döngüye verilmesi toplam dönüşümü %80–90 üzerine taşır.',
        'Ancak taze beslemede az miktarda bile inert ($I$) varsa blöf (purge) akımı $f_p > 0$ zorunludur: $f_p \\to 0$ olduğunda döngüdeki inert miktarı $F_{0,I}/f_p \\to \\infty$ olarak birikir ve reaktörü boğar.',
      ],
      tasks: [
        '**Düşük Blöf** senaryosunda ($f_p = 2\\%$) reaktör girişindeki inert yüzdesinin taze beslemedeki %6\'dan %50\'nin üzerine fırladığını akım tablosundan doğrula.',
        'Blöf oranını %10 ile %30 arasında değiştirerek **toplam dönüşüm kaybı** ile **geri döngü debisi (ekipman maliyeti)** arasındaki ödünleşimi incele.',
        'Akım tablosunda $F_0 = P + W$ toplam molar dengenin ve $F_{0,I} = W_I$ inert dengesinin sıfır hatayla sağlandığını kontrol et.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const fbadge = host.querySelector('[data-fbadge]');
  const tbody = host.querySelector('[data-tbody]');
  const btnPlay = host.querySelector('[data-play]');

  const sF0 = addSlider(ctrls, { label: 'Taze Besleme F₀', unit: 'mol/s', min: 20, max: 250, step: 10, value: st.F0, onInput: v => { st.F0 = v; update(); } });
  const sYI = addSlider(ctrls, { label: 'Besleme İnert Oranı y_I0', min: 0, max: 0.20, step: 0.01, value: st.yI0, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.yI0 = v; update(); } });
  const sXsp = addSlider(ctrls, { label: 'Tek Geçiş Dönüşüm X_sp', min: 0.10, max: 0.90, step: 0.02, value: st.Xsp, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.Xsp = v; update(); } });
  const sFp = addSlider(ctrls, { label: 'Blöf (Purge) Oranı f_p', min: 0.02, max: 0.50, step: 0.01, value: st.fPurge, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.fPurge = v; update(); } });
  const sSep = addSlider(ctrls, { label: 'Ayırıcı Ürün Verimi η_B', min: 0.70, max: 1.0, step: 0.01, value: st.sepEff, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.sepEff = v; update(); } });
  const sDH = addSlider(ctrls, { label: 'Tepkime Entalpisi ΔH_rxn', unit: 'kJ/mol', min: -100, max: 100, step: 5, value: st.dH_kJ, onInput: v => { st.dH_kJ = v; update(); } });
  const sTR = addSlider(ctrls, { label: 'Reaktör Sıcaklığı T_R', unit: '°C', min: 80, max: 400, step: 10, value: st.TR_C, onInput: v => { st.TR_C = v; update(); } });

  const cv = setupCanvas(host.querySelector('[data-cv-pfd]'), w => Math.min(255, Math.max(210, w * 0.44)), (c, W, H) => {
    const sol = st.sol;
    if (!sol) return;
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const yMain = H * 0.40, yRec = H * 0.80;

    // Unit positions
    const xMix = W * 0.22, xRxr = W * 0.45, xSep = W * 0.69, xSpl = W * 0.86;
    const S = sol.streams;

    const pipe = (pts, col, flow, lbl, lx, ly) => {
      c.strokeStyle = col; c.lineWidth = Math.min(4.2, 1.5 + Math.sqrt(flow / 40));
      c.beginPath(); pts.forEach(([x, y], i) => { i === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }); c.stroke();
      // Animated moving flow dots along polyline
      if (!isMotionOff() && flow > 0.1) {
        const segLens = []; let tot = 0;
        for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segLens.push(d); tot += d; }
        const nDots = Math.max(2, Math.floor(tot / 46));
        c.fillStyle = '#fff';
        for (let d = 0; d < nDots; d++) {
          let dist = (((d / nDots) + st.flowT * 0.35) % 1) * tot;
          for (let i = 0; i < segLens.length; i++) {
            if (dist <= segLens[i] || i === segLens.length - 1) {
              const f = segLens[i] > 0 ? dist / segLens[i] : 0;
              const px = pts[i][0] + f * (pts[i + 1][0] - pts[i][0]);
              const py = pts[i][1] + f * (pts[i + 1][1] - pts[i][1]);
              c.beginPath(); c.arc(px, py, 2.3, 0, Math.PI * 2); c.fill();
              break;
            }
            dist -= segLens[i];
          }
        }
      }
      if (lbl) {
        c.fillStyle = col; c.font = '600 9.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(`${lbl}: ${fmtFix(flow, 0)}`, lx, ly);
      }
    };

    pipe([[14, yMain], [xMix - 16, yMain]], COL_BLUE, S.fresh.total, 'F₀', xMix * 0.45, yMain - 10);
    pipe([[xMix + 16, yMain], [xRxr - 34, yMain]], acc, S.reactorIn.total, 'S1', 0.5 * (xMix + xRxr) - 6, yMain - 10);
    pipe([[xRxr + 34, yMain], [xSep - 28, yMain]], COL_WARN, S.reactorOut.total, 'S2', 0.5 * (xRxr + xSep), yMain - 10);
    pipe([[xSep, yMain - 24], [xSep, 20]], COL_OK, S.product.total, 'Ürün P', xSep, 13);
    pipe([[xSep + 28, yMain], [xSpl - 12, yMain]], COL_MUTE, S.overhead.total, 'S3', 0.5 * (xSep + xSpl) + 8, yMain - 10);
    pipe([[xSpl + 12, yMain], [W - 14, yMain]], COL_BAD, S.purge.total, 'Blöf W', W - 40, yMain - 10);
    pipe([[xSpl, yMain + 12], [xSpl, yRec], [xMix, yRec], [xMix, yMain + 16]], COL_PURP, S.recycle.total, 'Geri Döngü R', W * 0.54, yRec - 8);

    // Draw equipment boxes
    const drawUnit = (x, y, w, h, title, col = COL_FG) => {
      c.fillStyle = '#0d0d13'; c.strokeStyle = col; c.lineWidth = 1.8;
      c.fillRect(x - w / 2, y - h / 2, w, h); c.strokeRect(x - w / 2, y - h / 2, w, h);
      c.fillStyle = COL_FG; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(title, x, y);
    };
    drawUnit(xMix, yMain, 32, 32, 'M', COL_BLUE);
    drawUnit(xRxr, yMain, 68, 44, 'REAKTÖR', acc);
    drawUnit(xSep, yMain, 56, 48, 'AYIRICI', COL_OK);
    drawUnit(xSpl, yMain, 24, 24, 'S', COL_PURP);
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.flowT += dt;
    cv.render();
    return true;
  }, clean);

  function update() {
    st.sol = solveProcessFlowsheet({ F0: st.F0, yI0: st.yI0, Xsp: st.Xsp, sepEff: st.sepEff, fPurge: st.fPurge, dH_kJ: st.dH_kJ, TR_C: st.TR_C });
    const s = st.sol;
    fbadge.textContent = `Kütle Dengesi Hatası: ${s.molarClosureErr.toExponential(1)}`;
    renderKpis(kpis, [
      { lbl: 'Toplam Dönüşüm X_tot', val: `%${fmtFix(s.Xoverall * 100, 1)}`, sub: `Tek geçiş: %${Math.round(st.Xsp * 100)}`, tone: 'ok' },
      { lbl: 'Geri Döngü Oranı R/F₀', val: `${fmtFix(s.recycleRatio, 2)}×`, sub: `R = ${fmtFix(s.streams.recycle.total, 1)} mol/s`, tone: 'acc' },
      { lbl: 'Döngüde İnert y_I(S1)', val: `%${fmtFix(s.inertInLoopPct, 1)}`, sub: `Beslemede %${Math.round(st.yI0 * 100)}`, tone: s.inertInLoopPct > 35 ? 'bad' : '' },
      { lbl: 'Reaktör Isı Yükü Q̇', val: `${fmtFix(s.Q_total_kW, 0)} kW`, sub: s.Q_total_kW < 0 ? 'Soğutma gerekli' : 'Isıtma gerekli' },
    ]);
    tbody.innerHTML = Object.values(s.streams).map(sr => `<tr>
      <td class="mono"><b>${sr.id}</b> · ${esc(sr.name)}</td>
      <td class="mono">${fmtFix(sr.total, 2)}</td>
      <td class="mono">${fmtFix(sr.A, 2)}</td>
      <td class="mono">${fmtFix(sr.B, 2)}</td>
      <td class="mono">${fmtFix(sr.I, 2)}</td>
      <td class="mono">%${fmtFix(sr.yI * 100, 1)}</td>
    </tr>`).join('');
    cv.render();
  }

  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, FLOW_PRESETS, p => {
    Object.assign(st, p);
    sF0.set(st.F0); sYI.set(st.yI0); sXsp.set(st.Xsp); sFp.set(st.fPurge); sSep.set(st.sepEff); sDH.set(st.dH_kJ); sTR.set(st.TR_C);
    update();
  });

  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 24. AKIŞKAN YATAK (ERGUN) & ÇÖKELME HIZI (field: kimya)
// =====================================================================

const BED_PRESETS = [
  { label: 'Hava–Kum Akışkan Yatak',    tab: 'bed', dp_mm: 0.6, rhoP: 2650, rhoF: 1.2, mu_mPas: 0.0185, eps: 0.42, L_m: 1.0, u0: 0.65 },
  { label: 'Sabit Katalizör Yatağı',    tab: 'bed', dp_mm: 2.0, rhoP: 1800, rhoF: 1.2, mu_mPas: 0.0185, eps: 0.40, L_m: 1.5, u0: 0.35 },
  { label: 'Suda İnce Kil (Stokes)',    tab: 'settle', dp_mm: 0.04, rhoP: 2650, rhoF: 1000, mu_mPas: 1.0 },
  { label: 'Suda Kum Tanesi (Ara Rejim)', tab: 'settle', dp_mm: 0.8, rhoP: 2650, rhoF: 1000, mu_mPas: 1.0 },
];

function mountFluidizedBedSettling(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    tab: 'bed',
    dp_mm: 0.6, rhoP: 2650, rhoF: 1.2, mu_mPas: 0.0185, eps: 0.42, L_m: 1.0, u0: 0.65,
    playing: autoPlayAllowed(), animT: 0,
    bed: null, set: null,
  };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>Dolgulu ve akışkan yatakta Ergun denklemiyle</b> basınç düşüşü ΔP(u₀) ve minimum akışkanlaşma hızı u_mf\'yi hesapla; <b>Çökelme Hızı</b> sekmesinde Stokes, ara (Schiller–Naumann) ve Newton rejimlerinde küresel tanecik limit hızını incele.', BED_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg" role="tablist" data-btab aria-label="Yatak veya çökelme">
        <button type="button" data-t="bed" class="on">Akışkan Yatak (Ergun)</button>
        <button type="button" data-t="settle">Çökelme Hızı (Stokes / Ara)</button>
      </div>
      <div class="slc-toolbar-g">
        <span class="slc-badge slc-badge-acc" data-bbadge></span>
        <button type="button" class="btn small" data-play aria-pressed="${st.playing}"></button>
      </div>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card">
            <div class="slc-head"><h4 class="slc-title" data-vis-title>Canlı Akışkan Yatak Kolonu</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-col aria-label="Akışkan yatak veya çökelme animasyonu"></canvas></div>
          </div>
          <div class="slc-plot-card" data-box-p>
            <div class="slc-head"><h4 class="slc-title" data-p-title>Basınç Düşüşü ΔP — Yüzeysel Hız u₀</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-p aria-label="Ergun veya çökelme hızı grafiği"></canvas><div class="slc-readout" data-rd-p></div></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{\\Delta P}{L} = \\frac{150\\,\\mu(1-\\varepsilon)^2}{\\varepsilon^3 d_p^2}\\,u_0 + \\frac{1.75\\,\\rho_f(1-\\varepsilon)}{\\varepsilon^3 d_p}\\,u_0^2 \\;\\;(\\text{Ergun})',
        '\\Delta P_{mf} = (1-\\varepsilon)(\\rho_p - \\rho_f)g L, \\qquad u_{t,\\text{Stokes}} = \\frac{g\\,d_p^2(\\rho_p - \\rho_f)}{18\\,\\mu}',
      ],
      paragraphs: [
        'Yüzeysel gaz hızı $u_0 < u_{mf}$ iken tanecikler hareketsizdir ve basınç düşüşü Ergun denklemiyle artar. $u_0 = u_{mf}$ hızında basınç düşüşü yatak ağırlığını dengeler ve yatak akışkanlaşır; $u_{mf} \\le u_0 < u_t$ aralığında $\\Delta P$ sabit kalır.',
        'Tekil küresel taneciğin çökelmesinde $Re_p < 0.1$ için Stokes yasası kesindir; $Re_p$ büyüdükçe atalet sürüklemesi arttığından gerçek limit hız $u_t$, Stokes tahmininin belirgin biçimde altında kalır.',
      ],
      tasks: [
        '**Akışkan Yatak** sekmesinde hızı $u_0 = 0.05\\text{ m/s}$ değerinden artırarak $u_{mf}$ geçişinde $\\Delta P$\'nin sabit platoya oturduğunu ve taneciklerin kabarcıklanarak yüzdüğünü izle.',
        'Yüzeysel hızı $u_t$ üzerine çıkararak pnömatik sürüklenme rejimini gözlemle.',
        '**Çökelme Hızı** sekmesinde tanecik çapını $0.03\\text{ mm}$ (Stokes) ile $2.0\\text{ mm}$ (ara/Newton) arasında değiştirip $u_t / u_{\\text{Stokes}}$ oranının 1\'den nasıl uzaklaştığını ölç.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const bbadge = host.querySelector('[data-bbadge]');
  const visTitle = host.querySelector('[data-vis-title]');
  const pTitle = host.querySelector('[data-p-title]');
  const cvP = host.querySelector('[data-cv-p]');
  const btnPlay = host.querySelector('[data-play]');

  const sDp = addSlider(ctrls, { label: 'Tanecik Çapı d_p', unit: 'mm', min: 0.02, max: 4.0, log: true, value: st.dp_mm, onInput: v => { st.dp_mm = v; update(); } });
  const sRhoP = addSlider(ctrls, { label: 'Tanecik Yoğunluğu ρ_p', unit: 'kg/m³', min: 1100, max: 5000, step: 50, value: st.rhoP, onInput: v => { st.rhoP = v; update(); } });
  const selFluid = addSelect(ctrls, 'Akışkan Ortam', [
    ['air', 'Hava (ρ=1.2 kg/m³, μ=0.0185 mPa·s)'],
    ['water', 'Su (ρ=1000 kg/m³, μ=1.0 mPa·s)'],
    ['oil', 'Yağ (ρ=880 kg/m³, μ=25 mPa·s)'],
  ], 'air', v => {
    if (v === 'air') { st.rhoF = 1.2; st.mu_mPas = 0.0185; }
    else if (v === 'water') { st.rhoF = 1000; st.mu_mPas = 1.0; }
    else { st.rhoF = 880; st.mu_mPas = 25; }
    update();
  });
  const sEps = addSlider(ctrls, { label: 'Yatak Boşluk Oranı ε', min: 0.32, max: 0.60, step: 0.01, value: st.eps, onInput: v => { st.eps = v; update(); } });
  const sU0 = addSlider(ctrls, { label: 'Yüzeysel Hız u₀', unit: 'm/s', min: 0.01, max: 8.0, log: true, value: st.u0, onInput: v => { st.u0 = v; update(); } });

  const cvCol = setupCanvas(host.querySelector('[data-cv-col]'), () => 250, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const colW = Math.min(130, W * 0.56), xL = (W - colW) * 0.5;
    const topY = 20, botY = H - 22, ch = botY - topY;

    // Column glass walls
    c.fillStyle = 'rgba(90,176,255,.07)'; c.fillRect(xL, topY, colW, ch);
    c.strokeStyle = COL_FG; c.lineWidth = 2;
    c.strokeRect(xL, topY, colW, ch);

    if (st.tab === 'bed' && st.bed) {
      const b = st.bed;
      const ratio = b.uRatio;
      const expandedFrac = ratio < 1 ? 0.42 : Math.min(0.88, 0.42 + 0.14 * Math.log(1 + ratio));
      const bedH = ch * expandedFrac;
      const nP = 64;
      for (let i = 0; i < nP; i++) {
        const colIdx = i % 8, rowIdx = Math.floor(i / 8);
        let px = xL + 10 + (colIdx / 7) * (colW - 20);
        let py = botY - 8 - (rowIdx / 8) * (bedH - 12);
        if (ratio >= 1 && !isMotionOff()) {
          const ag = Math.min(18, (ratio - 0.9) * 8);
          px += Math.sin(st.animT * 6 + i * 2.1) * ag * 0.6;
          py += Math.cos(st.animT * 7.5 + i * 1.7) * ag * 0.8;
          if (st.u0 >= b.ut) {
            py = botY - ((st.animT * 95 + i * 19) % (ch - 14)) - 7;
          }
        }
        px = Math.max(xL + 6, Math.min(xL + colW - 6, px));
        py = Math.max(topY + 6, Math.min(botY - 6, py));
        c.fillStyle = st.u0 >= b.ut ? COL_BAD : ratio >= 1 ? acc : COL_WARN;
        c.beginPath(); c.arc(px, py, 3.6, 0, Math.PI * 2); c.fill();
      }
      // Upward gas arrows at bottom distributor
      for (let k = 0; k < 3; k++) {
        const ax = xL + colW * (0.25 + k * 0.25);
        drawArrow(c, ax, H - 3, ax, botY + 1, COL_BLUE, 1.8);
      }
    } else if (st.tab === 'settle' && st.set) {
      // Falling sphere in fluid column
      const s = st.set;
      const u = (st.animT * 0.55) % 1;
      const sy = topY + 18 + u * (ch - 36);
      const rPx = Math.max(7, Math.min(18, 6 + Math.log10(st.dp_mm * 50) * 5));
      c.fillStyle = acc; c.strokeStyle = '#fff'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(W * 0.5, sy, rPx, 0, Math.PI * 2); c.fill(); c.stroke();
      drawArrow(c, W * 0.5, sy + rPx + 2, W * 0.5, sy + rPx + 24, COL_BAD, 2);
      drawArrow(c, W * 0.5, sy - rPx - 2, W * 0.5, sy - rPx - 24, COL_OK, 2);
      c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText(`u_t = ${fmtNum(s.ut, 3)} m/s`, xL + colW + 8, sy + 4);
    }
  }, clean);

  function drawPlot() {
    if (st.tab === 'bed' && st.bed) {
      const b = st.bed;
      safePlot(cvP, [
        { name: 'ΔP (kPa)', color: accentColor(), xs: b.uCurve, ys: b.dpCurvePa.map(v => v / 1000) },
        { name: 'u₀', color: COL_WARN, xs: [st.u0, st.u0], ys: [0, b.dP_actual_Pa / 1000] },
      ], { xlog: true, x0: b.uCurve[0], x1: b.uCurve[b.uCurve.length - 1], ylabel: 'ΔP (kPa)', height: 230 });
    } else if (st.tab === 'settle' && st.set) {
      const s = st.set;
      safePlot(cvP, [
        { name: 'v(t)', color: accentColor(), xs: s.ts, ys: s.vs },
        { name: 'u_t', color: COL_OK, xs: [0, s.tEnd], ys: [s.ut, s.ut] },
      ], { x0: 0, x1: s.tEnd, ylabel: 'Hız v (m/s)', height: 230 });
    }
  }

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.animT += dt;
    cvCol.render();
    return true;
  }, clean);

  function syncVis() {
    const isB = st.tab === 'bed';
    sEps.setVisible(isB); sU0.setVisible(isB);
    visTitle.textContent = isB ? 'Canlı Akışkan Yatak Kolonu' : 'Düşen Küresel Tanecik (Kuvvet Dengesi)';
    pTitle.textContent = isB ? 'Basınç Düşüşü ΔP (kPa) — Hız u₀ (log)' : 'Çökelme Hızı Zaman Profili v(t)';
    host.querySelectorAll('[data-btab] button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  }

  function update() {
    if (st.tab === 'bed') {
      st.bed = solveErgunAndFluidization({ dp_mm: st.dp_mm, rhoP: st.rhoP, rhoF: st.rhoF, mu_mPas: st.mu_mPas, eps: st.eps, L_m: st.L_m, u0: st.u0 });
      const b = st.bed;
      bbadge.textContent = b.regime;
      bbadge.className = `slc-badge ${st.u0 < b.umf ? 'slc-badge-warn' : st.u0 < b.ut ? 'slc-badge-ok' : 'slc-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 'Min. Akışkanlaşma u_mf', val: `${fmtNum(b.umf, 3)} m/s`, sub: `Re_mf = ${fmtFix(b.Re_mf, 2)}`, tone: 'acc' },
        { lbl: 'Sürüklenme Hızı u_t', val: `${fmtNum(b.ut, 3)} m/s`, sub: `u_t / u_mf = ${fmtFix(b.ut / b.umf, 1)}×` },
        { lbl: 'Yatak Basınç Düşüşü ΔP', val: `${fmtFix(b.dP_actual_Pa / 1000, 2)} kPa`, sub: `Platoda: ${fmtFix(b.dP_mf_Pa / 1000, 2)} kPa`, tone: 'ok' },
        { lbl: 'Archimedes Sayısı Ar', val: fmtSci(b.Ar, 2), sub: `u₀ / u_mf = ${fmtFix(b.uRatio, 2)}` },
      ]);
    } else {
      st.set = solveSettlingVelocity({ dp_mm: st.dp_mm, rhoP: st.rhoP, rhoF: st.rhoF, mu_mPas: st.mu_mPas });
      const s = st.set;
      bbadge.textContent = s.regime;
      bbadge.className = 'slc-badge slc-badge-acc';
      renderKpis(kpis, [
        { lbl: 'Limit Çökelme Hızı u_t', val: `${fmtNum(s.ut, 3)} m/s`, sub: `C_D = ${fmtNum(s.CD, 3)}`, tone: 'acc' },
        { lbl: 'Stokes Tahmini u_Stokes', val: `${fmtNum(s.uStokes, 3)} m/s`, sub: `Oran u_t/u_S = ${fmtFix(s.ratioToStokes, 3)}` },
        { lbl: 'Tanecik Reynolds Re_p', val: fmtNum(s.ReP, 3), sub: s.regime, tone: 'ok' },
        { lbl: 'Archimedes Sayısı Ar', val: fmtSci(s.Ar, 2), sub: `d_p = ${fmtNum(st.dp_mm, 3)} mm` },
      ]);
    }
    drawPlot(); cvCol.render();
  }

  host.querySelector('[data-btab]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === st.tab) return;
    st.tab = b.dataset.t;
    if (st.tab === 'settle' && st.rhoF < 10) { st.rhoF = 1000; st.mu_mPas = 1.0; selFluid.set('water'); }
    syncVis(); update(); syncSegments(host, false);
  });
  btnPlay.addEventListener('click', () => {
    st.playing = !st.playing; syncPlayBtn(btnPlay, st.playing);
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, BED_PRESETS, p => {
    Object.assign(st, p);
    sDp.set(st.dp_mm); sRhoP.set(st.rhoP); sEps.set(st.eps); sU0.set(st.u0);
    selFluid.set(st.rhoF > 500 ? 'water' : 'air');
    syncVis(); update();
  });

  attachReadout(cvP, host.querySelector('[data-rd-p]'), (x, ser, i) => st.tab === 'bed' ? `u₀=${fmtNum(x, 3)} m/s · ΔP=${fmtFix(ser[0].ys[i], 2)} kPa` : `t=${fmtFix(x, 3)} s · v=${fmtNum(ser[0].ys[i], 3)} m/s`, clean);
  observeResize(host.querySelector('[data-box-p]'), drawPlot, clean);
  syncPlayBtn(btnPlay, st.playing);
  if (st.playing) loop.start();
  bindTasks(host);
  syncVis();
  update();
  return clean.run;
}

// =====================================================================
// 25. GAZ YASALARI — İDEAL / VAN DER WAALS / PENG-ROBINSON (field: kimya)
// =====================================================================

const EOS_PRESETS = [
  { label: 'CO₂ Kritik İzoterm (304 K)', gasId: 'CO2', T_K: 304.1, P_bar: 73.8 },
  { label: 'CO₂ Kritik Altı (280 K)',    gasId: 'CO2', T_K: 280,   P_bar: 42 },
  { label: 'Yüksek Basınçlı CH₄',        gasId: 'CH4', T_K: 240,   P_bar: 100 },
  { label: 'İdeal Sınır (Düşük P)',      gasId: 'N2',  T_K: 300,   P_bar: 2.0 },
];

function mountGasLawsEOS(host, ctx) {
  const clean = createClean(ctx);
  const st = { gasId: 'CO2', T_K: 304.1, P_bar: 73.8, sol: null, iso: null };

  host.innerHTML = `<div class="slc-wrap">
    ${introHtml('<b>İdeal Gaz</b>, <b>van der Waals</b> ve <b>Peng–Robinson</b> hal denklemlerinin P–V_m izotermlerini, kritik noktayı ve <b>sıkıştırılabilirlik faktörü Z(P_r)</b> sapmalarını gerçek gaz sabitleriyle karşılaştır.', EOS_PRESETS)}
    <div class="slc-toolbar">
      <div class="seg slc-seg-wrap" role="tablist" data-gas aria-label="Gaz seçimi">
        ${Object.keys(EOS_GASES).map(k => `<button type="button" data-g="${k}" class="${k === st.gasId ? 'on' : ''}">${k}</button>`).join('')}
      </div>
      <span class="slc-badge slc-badge-acc" data-pbadge></span>
    </div>
    <div class="slc-grid">
      <div class="slc-panel" data-ctrls></div>
      <div class="slc-col">
        <div class="slc-kpis" data-kpis></div>
        <div class="slc-grid-2">
          <div class="slc-plot-card" data-box-pv>
            <div class="slc-head">
              <h4 class="slc-title">P – V_m İzotermi (bar vs L/mol)</h4>
              <div class="slc-legend">
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_MUTE}"></i>İdeal</span>
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${COL_BLUE}"></i>vdW</span>
                <span class="slc-legend-item"><i class="slc-legend-swatch" style="background:${accentColor()}"></i>Peng–Robinson</span>
              </div>
            </div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-pv aria-label="P-V izoterm grafiği"></canvas><div class="slc-readout" data-rd-pv></div></div>
          </div>
          <div class="slc-plot-card" data-box-z>
            <div class="slc-head"><h4 class="slc-title">Sıkıştırılabilirlik Faktörü Z — İndirgenmiş Basınç P_r</h4></div>
            <div class="slc-cv-box"><canvas class="slc-cv" data-cv-z aria-label="Z vs Pr grafiği"></canvas><div class="slc-readout" data-rd-z></div></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'P_{\\text{vdW}} = \\frac{RT}{V_m - b} - \\frac{a}{V_m^2}, \\qquad P_{\\text{PR}} = \\frac{RT}{V_m - b} - \\frac{a\\,\\alpha(T)}{V_m(V_m+b) + b(V_m-b)}',
        'Z = \\frac{P V_m}{R T}, \\qquad T_r = \\frac{T}{T_c}, \\qquad P_r = \\frac{P}{P_c}',
      ],
      paragraphs: [
        'Moleküller arası çekim kuvvetleri ($a$ parametresi) basıncı düşürerek orta basınçlarda $Z < 1$ oluşturur; çok yüksek basınçlarda ise sonlu molekül hacmi ($b$ itme terimi) baskın çıkar ve $Z > 1$ olur.',
        'Kritik noktada ($T_r = 1, P_r = 1$) izoterm yatay büküm noktasına sahiptir: van der Waals $Z_c = 3/8 = 0.375$, Peng–Robinson ise gerçek hidrokarbonlara çok daha yakın $Z_c \\approx 0.307$ verir.',
      ],
      tasks: [
        '**CO₂ Kritik İzoterm** senaryosunda $Z_{\\text{vdW}} \\approx 0.375$ ve $Z_{\\text{PR}} \\approx 0.307$ değerlerini doğrula.',
        'Sıcaklığı kritik sıcaklığın altına ($T = 280\\text{ K}$) indirip P–V eğrisinde **van der Waals ilmeğinin** (sıvı–buhar iki fazlı bölge) oluştuğunu gör.',
        'Basıncı $P = 2\\text{ bar}$ seviyesine düşürüp üç hal denkleminin de $Z \\to 1$ ideal gaz sınırında çakıştığını gözlemle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const pbadge = host.querySelector('[data-pbadge]');
  const cvPv = host.querySelector('[data-cv-pv]');
  const cvZ = host.querySelector('[data-cv-z]');

  const sT = addSlider(ctrls, { label: 'Sıcaklık T', unit: 'K', min: 100, max: 800, step: 1, value: st.T_K, onInput: v => { st.T_K = v; update(); } });
  const sP = addSlider(ctrls, { label: 'Basınç P', unit: 'bar', min: 0.5, max: 350, log: true, value: st.P_bar, onInput: v => { st.P_bar = v; update(); } });

  function drawPlots() {
    if (!st.iso || !st.sol) return;
    const iso = st.iso;
    const pCap = st.sol.Pc_bar * 2.8;
    const clip = arr => arr.map(v => (v > pCap || v < -st.sol.Pc_bar * 0.5 ? NaN : v));
    safePlot(cvPv, [
      { name: 'İdeal', color: COL_MUTE, xs: iso.Vs_Lmol, ys: clip(iso.P_ideal) },
      { name: 'vdW', color: COL_BLUE, xs: iso.Vs_Lmol, ys: clip(iso.P_vdW) },
      { name: 'PR', color: accentColor(), xs: iso.Vs_Lmol, ys: clip(iso.P_PR) },
    ], { xlog: true, x0: iso.Vs_Lmol[0], x1: iso.Vs_Lmol[iso.Vs_Lmol.length - 1], ylabel: 'P (bar)', height: 225 });

    // Z vs Pr curve from Pr = 0.05 to 5
    const prs = [], zVdw = [], zPr = [], zId = [];
    for (let i = 0; i <= 70; i++) {
      const pr = 0.05 + (4.95 * i) / 70;
      const r = solveEOS({ gasId: st.gasId, T_K: st.T_K, P_bar: pr * st.sol.Pc_bar });
      prs.push(pr); zId.push(1); zVdw.push(r.Z_vdW); zPr.push(r.Z_PR);
    }
    safePlot(cvZ, [
      { name: 'İdeal (Z=1)', color: COL_DIM, xs: prs, ys: zId },
      { name: 'vdW', color: COL_BLUE, xs: prs, ys: zVdw },
      { name: 'PR', color: accentColor(), xs: prs, ys: zPr },
    ], { x0: 0, x1: 5, ylabel: 'Z = PV/(RT)', height: 225 });
  }

  function update() {
    st.sol = solveEOS({ gasId: st.gasId, T_K: st.T_K, P_bar: st.P_bar });
    st.iso = eosIsotherm({ gasId: st.gasId, T_K: st.T_K });
    const s = st.sol;
    pbadge.textContent = `${s.phasePR} · T_r=${fmtFix(s.Tr, 2)}, P_r=${fmtFix(s.Pr, 2)}`;
    host.querySelectorAll('[data-gas] button').forEach(b => b.classList.toggle('on', b.dataset.g === st.gasId));

    renderKpis(kpis, [
      { lbl: 'Peng–Robinson Z_PR', val: fmtFix(s.Z_PR, 3), sub: `V_m = ${fmtNum(s.V_PR_Lmol, 3)} L/mol`, tone: 'acc' },
      { lbl: 'van der Waals Z_vdW', val: fmtFix(s.Z_vdW, 3), sub: `V_m = ${fmtNum(s.V_vdW_Lmol, 3)} L/mol` },
      { lbl: 'İdeal Gazdan Sapma', val: `${s.devPR_pct >= 0 ? '+' : ''}${fmtFix(s.devPR_pct, 1)}%`, sub: `V_ideal = ${fmtNum(s.V_ideal_Lmol, 3)} L/mol`, tone: Math.abs(s.devPR_pct) < 5 ? 'ok' : 'warn' },
      { lbl: 'Kritik Nokta (T_c, P_c)', val: `${fmtFix(s.Tc, 1)} K`, sub: `${fmtFix(s.Pc_bar, 1)} bar · ω=${s.params.gas.omega}` },
    ]);
    drawPlots();
  }

  host.querySelector('[data-gas]').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b || b.dataset.g === st.gasId) return;
    st.gasId = b.dataset.g;
    const g = EOS_GASES[st.gasId];
    st.T_K = Math.round(g.Tc); st.P_bar = +g.Pc_bar.toFixed(1);
    sT.set(st.T_K); sP.set(st.P_bar);
    update(); syncSegments(host, false);
  });
  bindPresets(host, EOS_PRESETS, p => {
    Object.assign(st, p);
    sT.set(st.T_K); sP.set(st.P_bar);
    update();
  });

  attachReadout(cvPv, host.querySelector('[data-rd-pv]'), (x, ser, i) => `Vm=${fmtNum(x, 3)} L/mol · P_PR=${fmtFix(ser[2].ys[i], 1)} bar`, clean);
  attachReadout(cvZ, host.querySelector('[data-rd-z]'), (x, ser, i) => `Pr=${fmtFix(x, 2)} · Z_PR=${fmtFix(ser[2].ys[i], 3)} · Z_vdW=${fmtFix(ser[1].ys[i], 3)}`, clean);
  observeResize(host.querySelector('[data-box-pv]'), drawPlots, clean);
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// MODULE EXPORT CONTRACT (consumed by js/simcenter.js)
// =====================================================================

export const SIMS = [
  // Field: insaat (9 simulations)
  { id: 'beam-analysis',          field: 'insaat',  title: 'Kiriş Analizi',          icon: 'line',    mount: mountBeamAnalysis },
  { id: 'truss-2d',               field: 'insaat',  title: 'Kafes Sistem (2D)',      icon: 'grid',    mount: mountTruss2D },
  { id: 'frame-2d',               field: 'insaat',  title: 'Çerçeve Analizi',        icon: 'rect',    mount: mountFrame2D },
  { id: 'mohr-circle',            field: 'insaat',  title: 'Mohr Dairesi',           icon: 'ellipse', mount: mountMohrCircle },
  { id: 'column-buckling',        field: 'insaat',  title: 'Kolon Burkulması',       icon: 'wave',    mount: mountColumnBuckling },
  { id: 'seismic-response',       field: 'insaat',  title: 'Deprem Tepkisi',         icon: 'wave',    mount: mountSeismicResponse },
  { id: 'soil-mechanics',         field: 'insaat',  title: 'Zemin Mekaniği',         icon: 'grid',    mount: mountSoilMechanics },
  { id: 'open-channel-hydrology', field: 'insaat',  title: 'Açık Kanal & Hidroloji', icon: 'wave',    mount: mountOpenChannelHydrology },
  { id: 'transportation',         field: 'insaat',  title: 'Ulaştırma & Trafik',     icon: 'arrow',   mount: mountTransportation },

  // Field: malzeme (8 simulations)
  { id: 'stress-strain',          field: 'malzeme', title: 'Gerilme-Şekil Değ.',     icon: 'chart',   mount: mountStressStrain },
  { id: 'crystal-structures',     field: 'malzeme', title: 'Kristal Yapılar & XRD',  icon: 'atom',    mount: mountCrystalStructures },
  { id: 'phase-diagrams',         field: 'malzeme', title: 'Faz Diyagramları',       icon: 'chart',   mount: mountPhaseDiagrams },
  { id: 'diffusion-fick',         field: 'malzeme', title: 'Difüzyon (Fick)',        icon: 'atom',    mount: mountDiffusion },
  { id: 'fatigue-fracture',       field: 'malzeme', title: 'Yorulma & Kırılma',      icon: 'chart',   mount: mountFatigueFracture },
  { id: 'heat-treatment-ttt',     field: 'malzeme', title: 'Isıl İşlem (TTT)',       icon: 'flame',   mount: mountHeatTreatmentTTT },
  { id: 'composites',             field: 'malzeme', title: 'Kompozit Malzemeler',    icon: 'grid',    mount: mountComposites },
  { id: 'semiconductor-materials', field: 'malzeme', title: 'Yarı İletken Malzeme',  icon: 'sparkle', mount: mountSemiconductorMaterials },

  // Field: kimya (8 simulations)
  { id: 'reactor-design',         field: 'kimya',   title: 'Reaktör Tasarımı',       icon: 'flame',   mount: mountReactorDesign },
  { id: 'reaction-kinetics',      field: 'kimya',   title: 'Reaksiyon Kinetiği',     icon: 'clock',   mount: mountReactionKinetics },
  { id: 'chemical-equilibrium',   field: 'kimya',   title: 'Kimyasal Denge & pH',    icon: 'sigma',   mount: mountChemicalEquilibrium },
  { id: 'distillation',           field: 'kimya',   title: 'Damıtma (McCabe)',       icon: 'chart',   mount: mountDistillation },
  { id: 'mass-transfer',          field: 'kimya',   title: 'Kütle Transferi',        icon: 'wave',    mount: mountMassTransfer },
  { id: 'mass-energy-balance',    field: 'kimya',   title: 'Kütle & Enerji Dengesi', icon: 'matrix',  mount: mountMassEnergyBalance },
  { id: 'fluidized-bed-settling', field: 'kimya',   title: 'Akışkan Yatak, Çökelme', icon: 'grid',    mount: mountFluidizedBedSettling },
  { id: 'gas-laws-eos',           field: 'kimya',   title: 'Gaz Yasaları (EOS)',     icon: 'chart',   mount: mountGasLawsEOS },
];
