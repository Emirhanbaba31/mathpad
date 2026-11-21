// MathPad Engineering Simulation Center — Part 1 UI Module
// Field 'eee' (10 new simulations) & Field 'kontrol' (9 simulations).
// Contract: export const SIMS = [{ id, field, title, icon, mount(host, ctx) -> cleanupFn }];

import { esc, icon } from './ui.js';
import { motion, syncSegments } from './fx.js';
import { tex, richTex, accentColor, createClean, setupCanvas, createAnimLoop } from './phys-ui.js';
import { plot, PLOT_COLORS, eng } from './tools.js';
import {
  C, cAbs, cArg, cAdd, cSub, cMul, cDiv, cPolar,
  thermalVoltage, solveDiodeCircuit, simulateRectifier, solveZenerRegulator,
  solveBJT, solveMOSFET, solveCMOSInverter,
  solveDCDC, simulateSPWM,
  solveThreePhase,
  solveTransformer, solveInductionMotor, solveDCMotor,
  solveTransmissionLine,
  electricFieldAt, traceFieldLines, magneticFieldWires, wireForcePerLength,
  biotSavartLoop, loopAxialFieldExact, borisStep, cyclotronMetrics,
  computeAntennaPattern,
  simulateAnalogMod, simulateDigitalMod,
  stepFlipFlop, stepCounter4, stepShiftReg4, simplifyKMap,
  simulatePID, zieglerNicholsTune,
  computeRootLocus, closedLoopAtGain, tfStepResponse,
  analyzeBodeNyquist, evalTransferC,
  cartPendulumLinearModel, ackermannGain, solveLQR4, cartPendulumStep,
  fourierSeries, analyzeWindowedFFT,
  simulateSampling,
  continuousConvolution, discreteSignal, discreteConvolution,
  designFIR, designButterworthIIR, digitalFreqResponse, applyIIR, makeRng,
  laplacePoleResponse, zPoleResponse, sToZMap,
} from './simlab-eee-core.js';

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
const GROUP_COLORS = ['#5ab0ff', '#5be49b', '#ffd166', '#ff6b6b', '#c084fc', '#38bdf8', '#fb923c', '#f472b6'];

const autoPlayAllowed = () => motion() === 'full';
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

function fmtDeg(deg) {
  if (!Number.isFinite(deg)) return '—';
  const d = Math.abs(deg) < 1e-3 ? 0 : deg;
  return `${+d.toFixed(1)}°`;
}

function fmtPolar(z, unit = '') {
  const m = cAbs(z);
  const deg = m < 1e-12 ? 0 : (cArg(z) * 180) / Math.PI;
  return `${fmtUnit(m, unit)} ∠ ${fmtDeg(deg)}`;
}

function fmtRect(z, unit = '') {
  const re = Math.abs(z.re) < 1e-12 ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-12 ? 0 : z.im;
  const sgn = im < 0 ? '−' : '+';
  return `${fmtNum(re, 3)} ${sgn} j${fmtNum(Math.abs(im), 3)}${unit ? ' ' + unit : ''}`;
}

function introHtml(text, presets = []) {
  return `<div class="sle-intro">
    <p>${text.replace(/\$([^$\n]+?)\$/g, (_, t) => tex(t))}</p>
    ${presets.length ? `<div class="sle-presets" role="group" aria-label="Hazır senaryolar">
      <span class="sle-preset-lbl">Senaryo:</span>
      ${presets.map((p, i) => `<button type="button" class="sle-chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function bindPresets(host, presets, apply) {
  host.querySelector('.sle-presets')?.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    host.querySelectorAll('.sle-presets [data-preset]').forEach(x => x.classList.toggle('sle-on', x === b));
    apply(presets[+b.dataset.preset]);
    syncSegments(host, false);
  });
}

let sleUid = 0;
function addSlider(parent, { label, unit = '', min, max, value, step, log = false, fmt, onInput }) {
  const uid = `sle-s-${++sleUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'sle-ctrl';
  wrap.innerHTML = `<div class="sle-ctrl-top">
      <label class="sle-ctrl-lbl" for="${uid}">${esc(label)}</label>
      <span class="sle-ctrl-val mono" data-v></span>
    </div>
    <input id="${uid}" type="range" class="sle-range" aria-label="${esc(label)}">`;
  parent.append(wrap);
  const rng = wrap.querySelector('input');
  const valEl = wrap.querySelector('[data-v]');
  let cur = value;

  if (log) {
    rng.min = '0'; rng.max = '1000'; rng.step = '1';
  } else {
    rng.min = String(min);
    rng.max = String(max);
    rng.step = String(step ?? (max - min) / 200);
  }

  let lo = min, hi = max;
  const toPos = v => {
    const cl = Math.max(lo, Math.min(hi, v));
    return log ? Math.round((1000 * Math.log(cl / lo)) / Math.log(hi / lo)) : cl;
  };
  const fromPos = p => (log ? lo * Math.pow(hi / lo, p / 1000) : p);
  const format = v => (fmt ? fmt(v) : (unit ? fmtUnit(v, unit, 3) : fmtNum(v, 3)));

  const set = v => {
    cur = Math.max(lo, Math.min(hi, v));
    rng.value = String(toPos(cur));
    valEl.textContent = format(cur);
  };

  const setRange = (newMin, newMax) => {
    lo = newMin; hi = newMax;
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
  return { el: wrap, set, setRange, get: () => cur, setVisible: show => { wrap.hidden = !show; } };
}

function addToggle(parent, label, checked, onChange) {
  const lbl = document.createElement('label');
  lbl.className = 'sle-check-row';
  lbl.innerHTML = `<span>${esc(label)}</span><input type="checkbox" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;
  parent.append(lbl);
  const inp = lbl.querySelector('input');
  inp.addEventListener('change', () => onChange(inp.checked));
  return { el: lbl, set: v => { inp.checked = !!v; }, get: () => inp.checked, setVisible: s => { lbl.hidden = !s; } };
}

function renderKpis(el, items) {
  el.innerHTML = items.map(it => {
    const toneCls = it.tone ? `sle-kpi-${it.tone}` : '';
    return `<div class="sle-kpi ${toneCls}">
      <span class="sle-kpi-lbl">${esc(it.lbl)}</span>
      <b class="sle-kpi-val mono">${esc(it.val)}</b>
      ${it.sub ? `<span class="sle-kpi-sub mono">${esc(it.sub)}</span>` : ''}
    </div>`;
  }).join('');
}

function theoryAndTasksHtml({ equations = [], paragraphs = [], tasks = [] }) {
  const tasksHtml = tasks.length ? `<div class="sle-tasks" role="region" aria-label="Deney görevleri">
    <div class="sle-tasks-head"><h4 class="sle-title">Deney Görevleri</h4><span class="sle-hint" data-task-prog>0 / ${tasks.length}</span></div>
    ${tasks.map((t, i) => `<label class="sle-task"><input type="checkbox" data-task="${i}"><span>${richTex(t)}</span></label>`).join('')}
  </div>` : '';

  const theoryHtml = `<details class="sle-theory">
    <summary><span>Nasıl çalışır? — Kuram ve Denklemler</span><span class="sle-theory-tag">Kuram</span></summary>
    <div class="sle-theory-body">
      ${equations.length ? `<div class="sle-eq-box">${equations.map(eq => `<div>${tex(eq, true)}</div>`).join('')}</div>` : ''}
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
      b.closest('.sle-task')?.classList.toggle('sle-done', ok);
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
    if (activeId === e.pointerId) {
      onMove?.(p, true, e);
    } else {
      onMove?.(p, false, e);
    }
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
    c.fillText(label, x2 + ux * 12, y2 + uy * 12);
  }
  c.restore();
}

function drawCross(c, x, y, r, color, lw = 2.2) {
  c.save();
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - r, y - r); c.lineTo(x + r, y + r);
  c.moveTo(x + r, y - r); c.lineTo(x - r, y + r);
  c.stroke();
  c.restore();
}

function drawRing(c, x, y, r, color, lw = 2.2) {
  c.save();
  c.strokeStyle = color; c.lineWidth = lw; c.fillStyle = '#09090d';
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

function syncPlayBtn(btn, playing) {
  btn.innerHTML = playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
  btn.setAttribute('aria-pressed', String(playing));
}

// =====================================================================
// 1. DİYOT & DOĞRULTUCU (Shockley I-V, Half/Full Bridge + Filter, Zener)
// =====================================================================

const DIODE_PRESETS = [
  { label: 'Si Diyot (25 °C)', mode: 'iv', Vs: 5, R: 470, Is: 1e-12, n: 1.5, tempC: 25, Rs: 2 },
  { label: 'Schottky (düşük Vf)', mode: 'iv', Vs: 5, R: 470, Is: 1e-6, n: 1.1, tempC: 25, Rs: 1 },
  { label: 'Tam Dalga Köprü', mode: 'rect', rectType: 'bridge', Vm: 15, f: 50, RL: 680, C: 220e-6, Vf: 0.7 },
  { label: 'Yarım Dalga Filtre', mode: 'rect', rectType: 'half', Vm: 15, f: 50, RL: 680, C: 220e-6, Vf: 0.7 },
  { label: 'Zener 5.1 V Regülatör', mode: 'zener', Vin: 12, RsZ: 180, Vz: 5.1, rz: 8, RLz: 470 },
];

function mountDiodeRectifier(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'iv',
    // Shockley I-V
    Vs: 5, R: 470, Is: 1e-12, n: 1.5, tempC: 25, Rs: 2,
    // Rectifier
    rectType: 'bridge', Vm: 15, f: 50, RL: 680, C: 220e-6, Vf: 0.7,
    // Zener
    Vin: 12, RsZ: 180, Vz: 5.1, rz: 8, RLz: 470,
  };

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Diyodun <b>Shockley I–V</b> eğrisini, kapasitör filtreli <b>yarım / tam dalga köprü</b> doğrultucuyu ve <b>Zener gerilim regülatörünü</b> canlı incele.', DIODE_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Diyot modları">
        <button type="button" data-m="iv" class="on">Shockley I–V</button>
        <button type="button" data-m="rect">Doğrultucu & Filtre</button>
        <button type="button" data-m="zener">Zener Regülatör</button>
      </div>
      <div class="seg" data-rtype hidden role="tablist" aria-label="Doğrultucu tipi">
        <button type="button" data-rt="half">Yarım Dalga</button>
        <button type="button" data-rt="bridge" class="on">Tam Dalga Köprü</button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Diyot I–V & Yük Doğrusu</h4><div class="sle-legend" data-leg1></div></div>
          <div class="sle-cv-box" data-box1>
            <canvas class="sle-cv" data-cv-iv aria-label="Shockley I-V diyot eğrisi"></canvas>
            <canvas class="sle-cv" data-cv1 hidden aria-label="Doğrultucu ve Zener grafiği"></canvas>
            <div class="sle-readout" data-rd1></div>
          </div>
          <div class="sle-axis-lbl" data-ax1></div>
        </div>
        <div class="sle-plot-card" data-card2 hidden>
          <div class="sle-head"><h4 class="sle-title" data-t2>Diyot İletim Akımı iD(t)</h4><div class="sle-legend" data-leg2></div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="İkinci diyot grafiği"></canvas><div class="sle-readout" data-rd2></div></div>
          <div class="sle-axis-lbl" data-ax2></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'I_D = I_S \\left(e^{\\frac{V_D - I_D R_s}{n V_T}} - 1\\right), \\quad V_T = \\frac{k_B T}{q} \\approx 25.7\\text{ mV}\\ (25^\\circ\\text{C})',
        'V_{r,\\text{pp}} \\approx \\frac{V_{\\text{pk}}}{m f R_L C}\\quad (m=1\\text{ yarım},\\ m=2\\text{ tam dalga})',
        'V_{\\text{out}} = V_Z + I_Z r_z, \\quad I_Z = \\frac{V_{\\text{in}} - V_{\\text{out}}}{R_s} - \\frac{V_{\\text{out}}}{R_L}',
      ],
      paragraphs: [
        '**Shockley denklemi** sıcaklığa ($V_T = k_B T / q$) ve idealite katsayısına ($n$) bağlı üstel iletimi verir; seri $R$ direnciyle çizilen **yük doğrusu** kesişimi çalışma noktasını $(V_Q, I_Q)$ belirler.',
        '**Filtre kondansatörü** tepe değerde şarj olup yük direnci üzerinden üstel boşalır; tam dalga köprü aynı $C$ ile dalgalanmayı yarıya indirir ama iki diyot düşümü ($2V_f$) vardır.',
        '**Zener diyot** ters kırılma bölgesinde $V_{\\text{th}} > V_Z$ olduğu sürece çıkış gerilimini sabit tutar; yük direnci $R_{L,\\min}$ altına inerse regülasyon bozulur.',
      ],
      tasks: [
        'Shockley modunda sıcaklığı $25^\\circ\\text{C}$’den $100^\\circ\\text{C}$’ye çıkarıp $V_Q$ geriliminin nasıl düştüğünü gözle.',
        'Tam dalga doğrultucuda $V_{r,\\text{pp}} < 0.5\\text{ V}$ olacak minimum $C$ değerini bul; sonra yarım dalgaya geçip dalgalanma artışını karşılaştır.',
        'Zener regülatörde $R_L$ direncini azaltarak regülasyonun bozulduğu $R_{L,\\min}$ sınırını yakala.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const alertEl = host.querySelector('[data-alert]');
  const cvIv = host.querySelector('[data-cv-iv]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const card2 = host.querySelector('[data-card2]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');
  const leg1 = host.querySelector('[data-leg1]');
  const leg2 = host.querySelector('[data-leg2]');
  const ax1 = host.querySelector('[data-ax1]');
  const ax2 = host.querySelector('[data-ax2]');
  const rtypeSeg = host.querySelector('[data-rtype]');

  // Create sliders for all 3 modes and toggle visibility
  const sVs = addSlider(ctrls, { label: 'Kaynak Gerilimi Vs', unit: 'V', min: 0.2, max: 15, value: st.Vs, step: 0.1, onInput: v => { st.Vs = v; update(); } });
  const sR = addSlider(ctrls, { label: 'Seri Direnç R', unit: 'Ω', min: 50, max: 10e3, value: st.R, log: true, onInput: v => { st.R = v; update(); } });
  const sTemp = addSlider(ctrls, { label: 'Sıcaklık T', unit: '°C', min: -20, max: 125, value: st.tempC, step: 1, fmt: v => `${Math.round(v)} °C`, onInput: v => { st.tempC = v; update(); } });
  const sN = addSlider(ctrls, { label: 'İdealite n', min: 1.0, max: 2.2, value: st.n, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.n = v; update(); } });
  const sIs = addSlider(ctrls, { label: 'Doyum Akımı Is', unit: 'A', min: 1e-14, max: 1e-5, value: st.Is, log: true, onInput: v => { st.Is = v; update(); } });

  const sVm = addSlider(ctrls, { label: 'AC Tepe Gerilim Vm', unit: 'V', min: 3, max: 35, value: st.Vm, step: 0.5, onInput: v => { st.Vm = v; update(); } });
  const sFreq = addSlider(ctrls, { label: 'Şebeke Frekansı f', unit: 'Hz', min: 20, max: 400, value: st.f, step: 5, onInput: v => { st.f = v; update(); } });
  const sRL = addSlider(ctrls, { label: 'Yük Direnci RL', unit: 'Ω', min: 100, max: 10e3, value: st.RL, log: true, onInput: v => { st.RL = v; update(); } });
  const sC = addSlider(ctrls, { label: 'Filtre Kondansatörü C', unit: 'F', min: 1e-6, max: 2200e-6, value: st.C, log: true, onInput: v => { st.C = v; update(); } });
  const sVf = addSlider(ctrls, { label: 'Diyot Eşik Gerilimi Vf', unit: 'V', min: 0, max: 1.2, value: st.Vf, step: 0.05, fmt: v => `${v.toFixed(2)} V`, onInput: v => { st.Vf = v; update(); } });

  const sVin = addSlider(ctrls, { label: 'Giriş Gerilimi Vin', unit: 'V', min: 2, max: 25, value: st.Vin, step: 0.2, onInput: v => { st.Vin = v; update(); } });
  const sRsZ = addSlider(ctrls, { label: 'Seri Direnç Rs', unit: 'Ω', min: 47, max: 1000, value: st.RsZ, log: true, onInput: v => { st.RsZ = v; update(); } });
  const sVz = addSlider(ctrls, { label: 'Zener Gerilimi Vz', unit: 'V', min: 2.7, max: 15, value: st.Vz, step: 0.1, fmt: v => `${v.toFixed(1)} V`, onInput: v => { st.Vz = v; update(); } });
  const sRz = addSlider(ctrls, { label: 'Dinamik Direnç rz', unit: 'Ω', min: 0, max: 40, value: st.rz, step: 1, fmt: v => `${v.toFixed(0)} Ω`, onInput: v => { st.rz = v; update(); } });
  const sRLz = addSlider(ctrls, { label: 'Yük Direnci RL', unit: 'Ω', min: 50, max: 5000, value: st.RLz, log: true, onInput: v => { st.RLz = v; update(); } });

  const ivCtrls = [sVs, sR, sTemp, sN, sIs];
  const rectCtrls = [sVm, sFreq, sRL, sC, sVf];
  const zenerCtrls = [sVin, sRsZ, sVz, sRz, sRLz];

  let ivData = null;
  const ivCanvas = setupCanvas(cvIv, w => Math.min(310, Math.max(220, w * 0.56)), (c, W, H) => {
    if (st.mode !== 'iv' || !ivData) return;
    c.clearRect(0, 0, W, H);
    const L = 54, R = 16, T = 16, B = 32, pw = W - L - R, ph = H - T - B;
    const xMin = -0.3, xMax = Math.max(1.2, Math.min(st.Vs * 1.05, 6));
    const iMax = Math.max((st.Vs / st.R) * 1.25, ivData.Iq * 1.6, 1e-3);
    const mx = v => L + ((v - xMin) / (xMax - xMin)) * pw;
    const my = i => T + ph - (i / iMax) * ph;

    // Grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    c.font = '11px "JetBrains Mono", monospace';
    for (let k = 0; k <= 5; k++) {
      const gx = L + (pw * k) / 5;
      c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.stroke();
      const xv = xMin + ((xMax - xMin) * k) / 5;
      c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(xv.toFixed(2), gx, H - 11);
    }
    for (let k = 0; k <= 4; k++) {
      const gy = T + (ph * k) / 4;
      c.beginPath(); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
      const iv = iMax * (1 - k / 4);
      c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(fmtUnit(iv, 'A', 2), L - 6, gy + 4);
    }
    // Zero V axis
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(mx(0), T); c.lineTo(mx(0), T + ph); c.stroke();

    c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
    // Shockley curve
    c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
    c.beginPath();
    ivData.vCurve.forEach((v, idx) => {
      const x = mx(v), y = my(ivData.iCurve[idx]);
      if (idx === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();

    // DC Load line: I = (Vs - V)/R
    c.strokeStyle = COL_WARN; c.lineWidth = 1.8; c.setLineDash([6, 4]);
    c.beginPath();
    c.moveTo(mx(0), my(st.Vs / st.R));
    c.lineTo(mx(st.Vs), my(0));
    c.stroke();
    c.setLineDash([]);

    // Q-point
    const qx = mx(ivData.Vq), qy = my(ivData.Iq);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(qx, qy); c.lineTo(qx, T + ph); c.moveTo(qx, qy); c.lineTo(L, qy); c.stroke();
    c.setLineDash([]);
    const acc = accentColor();
    c.fillStyle = acc;
    c.beginPath(); c.arc(qx, qy, 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.stroke();
    c.fillStyle = COL_FG; c.textAlign = 'left';
    c.fillText(`Q (${ivData.Vq.toFixed(3)} V, ${fmtUnit(ivData.Iq, 'A', 3)})`, Math.min(qx + 10, W - 150), Math.max(qy - 10, T + 14));
    c.restore();
  }, clean);

  function syncModeUI() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    host.querySelectorAll('[data-rtype] button').forEach(b => b.classList.toggle('on', b.dataset.rt === st.rectType));
    rtypeSeg.hidden = st.mode !== 'rect';
    ivCtrls.forEach(s => s.setVisible(st.mode === 'iv'));
    rectCtrls.forEach(s => s.setVisible(st.mode === 'rect'));
    zenerCtrls.forEach(s => s.setVisible(st.mode === 'zener'));
    cvIv.hidden = st.mode !== 'iv';
    cv1.hidden = st.mode === 'iv';
    card2.hidden = st.mode === 'iv';
    syncSegments(host, false);
  }

  function update() {
    alertEl.innerHTML = '';
    if (st.mode === 'iv') {
      ivData = solveDiodeCircuit(st);
      t1.textContent = 'Shockley I–V Karakteristiği & DC Yük Doğrusu';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>I_D(V_D)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_WARN}"></i>Yük doğrusu</span>`;
      ax1.textContent = 'Diyot Gerilimi V_D (V)';
      renderKpis(kpis, [
        { lbl: 'Çalışma V_Q', val: fmtUnit(ivData.Vq, 'V'), tone: 'acc' },
        { lbl: 'Çalışma I_Q', val: fmtUnit(ivData.Iq, 'A') },
        { lbl: 'Termal V_T', val: fmtUnit(ivData.Vt, 'V'), sub: `T = ${st.tempC} °C` },
        { lbl: 'Dinamik r_d', val: fmtUnit(ivData.rd, 'Ω') },
        { lbl: 'Diyot Gücü P_Q', val: fmtUnit(ivData.Pq, 'W') },
      ]);
      ivCanvas.resize();
    } else if (st.mode === 'rect') {
      const r = simulateRectifier({ type: st.rectType, Vm: st.Vm, f: st.f, R: st.RL, C: st.C, Vf: st.Vf });
      const tMs = r.t.map(x => x * 1000);
      const iMa = r.iDiode.map(x => x * 1000);
      t1.textContent = `${st.rectType === 'bridge' ? 'Tam Dalga Köprü' : 'Yarım Dalga'} Çıkış Gerilimi v_out(t)`;
      t2.textContent = 'Diyot İletim Akım Darbeleri i_D(t)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,255,255,.35)"></i>Giriş v_in</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Filtreli v_out</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>i_D(t) (mA)</span>`;
      ax1.textContent = 'Zaman t (ms)'; ax2.textContent = 'Zaman t (ms)';
      safePlot(cv1, [
        { name: 'v_in', color: 'rgba(255,255,255,.28)', xs: tMs, ys: r.vIn },
        { name: 'v_out', color: COL_OK, xs: tMs, ys: r.vOut },
      ], { x0: 0, x1: tMs[tMs.length - 1], ylabel: 'V', height: 220 });
      safePlot(cv2, [
        { name: 'i_D', color: COL_WARN, xs: tMs, ys: iMa },
      ], { x0: 0, x1: tMs[tMs.length - 1], ylabel: 'mA', height: 155 });
      renderKpis(kpis, [
        { lbl: 'Ortalama V_DC', val: fmtUnit(r.vDC, 'V'), sub: `Yaklaşık ${r.vDCApprox.toFixed(2)} V`, tone: 'acc' },
        { lbl: 'Dalgalanma V_r,pp', val: fmtUnit(r.vRipplePP, 'V'), sub: `Formül ${fmtUnit(r.vRippleApprox, 'V')}` },
        { lbl: 'Dalgalanma Oranı r', val: `${(r.rippleFactor * 100).toFixed(1)}%` },
        { lbl: 'Tepe Akım I_D,pk', val: fmtUnit(r.iPeak, 'A'), sub: `İletim ≈ ${r.conductionDeg.toFixed(0)}°` },
        { lbl: 'Ters Tepe PIV', val: fmtUnit(r.piv, 'V') },
      ]);
    } else {
      const z = solveZenerRegulator({ Vin: st.Vin, Rs: st.RsZ, Vz: st.Vz, rz: st.rz, RL: st.RLz });
      t1.textContent = 'Zener Gerilim Transfer Eğrisi V_out(V_in)';
      t2.textContent = 'Zener Akımı I_Z(V_in)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>V_out (V)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>V_Z hedef</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>I_Z (mA)</span>`;
      ax1.textContent = 'Giriş Gerilimi V_in (V)'; ax2.textContent = 'Giriş Gerilimi V_in (V)';
      const x1 = z.vinSweep[z.vinSweep.length - 1];
      safePlot(cv1, [
        { name: 'Vout', color: COL_OK, xs: z.vinSweep, ys: z.voutSweep },
        { name: 'Vz', color: 'rgba(255,209,102,.45)', xs: [0, x1], ys: [st.Vz, st.Vz] },
      ], { x0: 0, x1, ylabel: 'V', height: 210 });
      safePlot(cv2, [
        { name: 'Iz', color: COL_BLUE, xs: z.vinSweep, ys: z.izSweep.map(v => v * 1000) },
      ], { x0: 0, x1, ylabel: 'mA', height: 150 });
      alertEl.innerHTML = z.overPower
        ? `<div class="sle-alert sle-alert-bad">⚠ Zener güç sınırı (0.5 W) aşıldı: P_Z = ${fmtUnit(z.Pz, 'W')}. R_s direncini artırın!</div>`
        : z.regulating
          ? `<div class="sle-alert sle-alert-ok">✓ Zener regülasyonda (V_in ≥ ${z.VinMin.toFixed(2)} V ve R_L ≥ ${fmtUnit(z.RLmin, 'Ω')}).</div>`
          : `<div class="sle-alert sle-alert-warn">⚠ Regülasyon dışı (I_Z = 0): Zener kesimde; V_in artırın veya R_L > ${fmtUnit(z.RLmin, 'Ω')} yapın.</div>`;
      renderKpis(kpis, [
        { lbl: 'Çıkış V_out', val: fmtUnit(z.Vout, 'V'), tone: z.regulating ? 'ok' : 'warn' },
        { lbl: 'Zener Akımı I_Z', val: fmtUnit(z.Iz, 'A'), sub: `Yük I_L = ${fmtUnit(z.IL, 'A')}` },
        { lbl: 'Zener Gücü P_Z', val: fmtUnit(z.Pz, 'W'), tone: z.overPower ? 'bad' : '' },
        { lbl: 'Min. Yük R_L,min', val: fmtUnit(z.RLmin, 'Ω') },
        { lbl: 'Hat Regülasyonu', val: `${(z.lineReg * 1000).toFixed(1)} mV/V`, sub: `R_out = ${fmtUnit(z.Rout, 'Ω')}` },
      ]);
    }
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    syncModeUI();
    update();
  });
  rtypeSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-rt]');
    if (!b || b.dataset.rt === st.rectType) return;
    st.rectType = b.dataset.rt;
    syncModeUI();
    update();
  });

  bindPresets(host, DIODE_PRESETS, p => {
    Object.assign(st, p);
    sVs.set(st.Vs); sR.set(st.R); sTemp.set(st.tempC); sN.set(st.n); sIs.set(st.Is);
    sVm.set(st.Vm); sFreq.set(st.f); sRL.set(st.RL); sC.set(st.C); sVf.set(st.Vf);
    sVin.set(st.Vin); sRsZ.set(st.RsZ); sVz.set(st.Vz); sRz.set(st.rz); sRLz.set(st.RLz);
    syncModeUI();
    update();
  });

  attachReadout(cv1, host.querySelector('[data-rd1]'), (x, s, i) => `x=${fmtNum(x, 3)} · y=${fmtNum(s[s.length - 1].ys[i], 3)}`, clean);
  observeResize(host.querySelector('[data-box1]'), () => { if (st.mode !== 'iv') update(); }, clean);
  bindTasks(host);
  syncModeUI();
  update();
  return clean.run;
}

// =====================================================================
// 2. TRANSİSTÖR EĞRİLERİ (BJT CE, MOSFET Id-Vds, CMOS Inverter VTC)
// =====================================================================

const TRANS_PRESETS = [
  { label: 'BJT A Sınıfı (Aktif)', mode: 'bjt', Vcc: 12, Rc: 1000, Ib: 55e-6, beta: 100, Va: 100, vinPeak: 12e-3 },
  { label: 'BJT Doyum Kırpılması', mode: 'bjt', Vcc: 12, Rc: 1000, Ib: 115e-6, beta: 100, Va: 100, vinPeak: 25e-3 },
  { label: 'NMOS (λ = 0.04)', mode: 'mos', Vdd: 10, Rd: 1000, Vgs: 3.5, kn: 2e-3, Vth: 1.5, lambda: 0.04 },
  { label: 'Simetrik CMOS', mode: 'cmos', VddC: 3.3, Vtn: 0.6, Vtp: 0.6, ratio: 1.0, lamC: 0.02 },
  { label: 'Asimetrik CMOS (kp=3kn)', mode: 'cmos', VddC: 3.3, Vtn: 0.6, Vtp: 0.6, ratio: 3.0, lamC: 0.02 },
];

function mountTransistorCurves(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'bjt',
    Vcc: 12, Rc: 1000, Ib: 55e-6, beta: 100, Va: 100, vinPeak: 12e-3,
    Vdd: 10, Rd: 1000, Vgs: 3.5, kn: 2e-3, Vth: 1.5, lambda: 0.04,
    VddC: 3.3, Vtn: 0.6, Vtp: 0.6, ratio: 1.0, lamC: 0.02,
  };

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>BJT</b> ortak emetör çıkış eğrileri ve Q-noktası, <b>MOSFET</b> triyot/doyum karakteristiği ile <b>CMOS evirici</b> gerilim transfer eğrisini (VTC) canlı incele.', TRANS_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Transistör modları">
        <button type="button" data-m="bjt" class="on">BJT Ortak Emetör</button>
        <button type="button" data-m="mos">MOSFET Id–Vds</button>
        <button type="button" data-m="cmos">CMOS Evirici (VTC)</button>
      </div>
      <span class="sle-badge" data-reg></span>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Çıkış Karakteristiği & Yük Doğrusu</h4><div class="sle-legend" data-leg1></div></div>
          <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="Transistör karakteristik eğrisi"></canvas></div>
          <div class="sle-axis-lbl" data-ax1></div>
        </div>
        <div class="sle-plot-card" data-card2>
          <div class="sle-head"><h4 class="sle-title" data-t2>Küçük İşaret Çıkışı v_ce(t)</h4><div class="sle-legend" data-leg2></div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="İkinci transistör grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'I_C \\approx \\beta I_B \\left(1 + \\frac{V_{CE}}{V_A}\\right), \\quad A_v = -g_m (R_C \\parallel r_o), \\quad g_m = \\frac{I_{CQ}}{V_T}',
        'I_D = \\begin{cases} k_n\\left[(V_{GS}-V_{th})V_{DS} - \\frac{1}{2}V_{DS}^2\\right](1+\\lambda V_{DS}) & V_{DS} < V_{GS}-V_{th}\\ (\\text{Triyot}) \\\\ \\frac{1}{2}k_n(V_{GS}-V_{th})^2(1+\\lambda V_{DS}) & V_{DS} \\ge V_{GS}-V_{th}\\ (\\text{Doyum}) \\end{cases}',
        'V_M = \\frac{V_{tn} + \\sqrt{k_p/k_n}(V_{DD} - |V_{tp}|)}{1 + \\sqrt{k_p/k_n}}, \\quad NM_L = V_{IL} - V_{OL}, \\quad NM_H = V_{OH} - V_{IH}',
      ],
      paragraphs: [
        '**BJT yükselteçte** doğrusal ve kırpılmasız salınım için Q-noktası yük doğrusunun ortasında ($V_{CEQ} \\approx V_{CC}/2$) konumlandırılır.',
        '**MOSFET** eğrisinde kesikli parabol ($V_{DS} = V_{GS} - V_{th}$) triyot ve doyum bölgelerini ayırır; kanal boyu modülasyonu $\\lambda > 0$ doyumda sonlu çıkış direnci $r_o \\approx 1/(\\lambda I_D)$ oluşturur.',
        '**CMOS eviricide** $k_p = k_n$ ve $V_{tn} = |V_{tp}|$ olduğunda eşik $V_M = V_{DD}/2$ simetrik olur; yalnızca geçiş anında kısa devre akımı $I_{DD}$ akar.',
      ],
      tasks: [
        'BJT modunda $I_B$’yi değiştirerek $V_{CEQ} \\approx 6\\text{ V}$ (orta nokta) yap ve kırpılmasız maksimum salınımı gözle.',
        'MOSFET modunda $\\lambda = 0$ ile $\\lambda = 0.08$ arasında doyum eğrilerinin eğimini ve $r_o$ değerini karşılaştır.',
        'CMOS modunda $k_p/k_n$ oranını $0.25$ ve $4$ yaparak $V_M$’nin ve gürültü marjlarının nasıl kaydığını gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const regBadge = host.querySelector('[data-reg]');
  const alertEl = host.querySelector('[data-alert]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const card2 = host.querySelector('[data-card2]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');
  const leg1 = host.querySelector('[data-leg1]');
  const leg2 = host.querySelector('[data-leg2]');
  const ax1 = host.querySelector('[data-ax1]');

  const sVcc = addSlider(ctrls, { label: 'Besleme V_CC', unit: 'V', min: 5, max: 24, value: st.Vcc, step: 0.5, onInput: v => { st.Vcc = v; update(); } });
  const sRc = addSlider(ctrls, { label: 'Kolektör R_C', unit: 'Ω', min: 220, max: 4700, value: st.Rc, log: true, onInput: v => { st.Rc = v; update(); } });
  const sIb = addSlider(ctrls, { label: 'Baz Akımı I_B', unit: 'A', min: 5e-6, max: 200e-6, value: st.Ib, step: 1e-6, onInput: v => { st.Ib = v; update(); } });
  const sBeta = addSlider(ctrls, { label: 'Akım Kazancı β', min: 30, max: 300, value: st.beta, step: 5, fmt: v => `${Math.round(v)}`, onInput: v => { st.beta = v; update(); } });
  const sVa = addSlider(ctrls, { label: 'Early Gerilimi V_A', unit: 'V', min: 20, max: 300, value: st.Va, step: 10, onInput: v => { st.Va = v; update(); } });
  const sVin = addSlider(ctrls, { label: 'AC Giriş v_in', unit: 'V', min: 1e-3, max: 40e-3, value: st.vinPeak, step: 1e-3, onInput: v => { st.vinPeak = v; update(); } });

  const sVdd = addSlider(ctrls, { label: 'Besleme V_DD', unit: 'V', min: 3, max: 18, value: st.Vdd, step: 0.5, onInput: v => { st.Vdd = v; update(); } });
  const sRd = addSlider(ctrls, { label: 'Dren Direnci R_D', unit: 'Ω', min: 200, max: 5000, value: st.Rd, log: true, onInput: v => { st.Rd = v; update(); } });
  const sVgs = addSlider(ctrls, { label: 'Kapı Gerilimi V_GS', unit: 'V', min: 0.5, max: 6, value: st.Vgs, step: 0.1, fmt: v => `${v.toFixed(1)} V`, onInput: v => { st.Vgs = v; update(); } });
  const sVth = addSlider(ctrls, { label: 'Eşik V_th', unit: 'V', min: 0.4, max: 3.0, value: st.Vth, step: 0.1, fmt: v => `${v.toFixed(1)} V`, onInput: v => { st.Vth = v; update(); } });
  const sKn = addSlider(ctrls, { label: 'İletkenlik k_n', min: 0.5e-3, max: 6e-3, value: st.kn, step: 0.2e-3, fmt: v => `${(v * 1e3).toFixed(1)} mA/V²`, onInput: v => { st.kn = v; update(); } });
  const sLam = addSlider(ctrls, { label: 'Kanal Mod. λ', min: 0, max: 0.1, value: st.lambda, step: 0.005, fmt: v => `${v.toFixed(3)} V⁻¹`, onInput: v => { st.lambda = v; update(); } });

  const sVddC = addSlider(ctrls, { label: 'Besleme V_DD', unit: 'V', min: 1.8, max: 5.0, value: st.VddC, step: 0.1, fmt: v => `${v.toFixed(1)} V`, onInput: v => { st.VddC = v; update(); } });
  const sVtn = addSlider(ctrls, { label: 'NMOS Eşik V_tn', unit: 'V', min: 0.3, max: 0.85, value: st.Vtn, step: 0.05, fmt: v => `${v.toFixed(2)} V`, onInput: v => { st.Vtn = v; update(); } });
  const sVtp = addSlider(ctrls, { label: 'PMOS |V_tp|', unit: 'V', min: 0.3, max: 0.85, value: st.Vtp, step: 0.05, fmt: v => `${v.toFixed(2)} V`, onInput: v => { st.Vtp = v; update(); } });
  const sRatio = addSlider(ctrls, { label: 'Oran k_p / k_n', min: 0.2, max: 5.0, value: st.ratio, log: true, fmt: v => `${v.toFixed(2)}×`, onInput: v => { st.ratio = v; update(); } });

  const bjtC = [sVcc, sRc, sIb, sBeta, sVa, sVin];
  const mosC = [sVdd, sRd, sVgs, sVth, sKn, sLam];
  const cmosC = [sVddC, sVtn, sVtp, sRatio];

  let curData = null;

  const mainCv = setupCanvas(cv1, w => Math.min(320, Math.max(230, w * 0.58)), (c, W, H) => {
    if (!curData) return;
    c.clearRect(0, 0, W, H);
    const L = 54, R = 16, T = 16, B = 32, pw = W - L - R, ph = H - T - B;
    c.font = '11px "JetBrains Mono", monospace';
    const acc = accentColor();

    if (st.mode === 'bjt' || st.mode === 'mos') {
      const isB = st.mode === 'bjt';
      const xMax = isB ? st.Vcc : st.Vdd;
      const iMax = Math.max(curData.IcMax || curData.IdMax, ...curData.curves.flatMap(g => g.ys)) * 1.08;
      const mx = v => L + (v / xMax) * pw;
      const my = i => T + ph - (i / Math.max(1e-6, iMax)) * ph;

      c.strokeStyle = COL_GRID; c.lineWidth = 1;
      for (let k = 0; k <= 5; k++) {
        const gx = L + (pw * k) / 5;
        c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(((xMax * k) / 5).toFixed(1), gx, H - 11);
      }
      for (let k = 0; k <= 4; k++) {
        const gy = T + (ph * k) / 4;
        c.beginPath(); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(fmtUnit(iMax * (1 - k / 4), 'A', 2), L - 6, gy + 4);
      }

      c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
      const xAxis = isB ? curData.vceAxis : curData.vdsAxis;
      curData.curves.forEach((cvItem, idx) => {
        c.strokeStyle = `rgba(90,176,255,${0.32 + 0.14 * idx})`;
        c.lineWidth = 1.6;
        c.beginPath();
        xAxis.forEach((x, j) => {
          const px = mx(x), py = my(cvItem.ys[j]);
          if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
        });
        c.stroke();
      });

      // Pinch-off parabola for MOSFET
      if (!isB) {
        c.strokeStyle = COL_PURP; c.lineWidth = 1.6; c.setLineDash([4, 4]);
        c.beginPath();
        xAxis.forEach((x, j) => {
          const px = mx(x), py = my(curData.pinchOff[j]);
          if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
        });
        c.stroke(); c.setLineDash([]);
      }

      // DC Load line
      const i0 = isB ? st.Vcc / st.Rc : st.Vdd / st.Rd;
      c.strokeStyle = COL_WARN; c.lineWidth = 2; c.setLineDash([7, 4]);
      c.beginPath(); c.moveTo(mx(0), my(i0)); c.lineTo(mx(xMax), my(0)); c.stroke();
      c.setLineDash([]);

      // Q-point
      const qv = isB ? curData.Vceq : curData.Vdsq;
      const qi = isB ? curData.Icq : curData.Idq;
      const qx = mx(qv), qy = my(qi);
      c.fillStyle = acc;
      c.beginPath(); c.arc(qx, qy, 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.stroke();
      c.fillStyle = COL_FG; c.textAlign = 'left';
      c.fillText(`Q (${qv.toFixed(2)} V, ${fmtUnit(qi, 'A', 3)})`, Math.min(qx + 10, W - 155), Math.max(qy - 10, T + 14));
      c.restore();
    } else {
      // CMOS VTC
      const Vdd = st.VddC;
      const mx = v => L + (v / Vdd) * pw;
      const my = v => T + ph - (v / Vdd) * ph;
      c.strokeStyle = COL_GRID; c.lineWidth = 1;
      for (let k = 0; k <= 5; k++) {
        const g = (Vdd * k) / 5;
        const gx = mx(g), gy = my(g);
        c.beginPath(); c.moveTo(gx, T); c.lineTo(gx, T + ph); c.moveTo(L, gy); c.lineTo(L + pw, gy); c.stroke();
        c.fillStyle = COL_MUTE;
        c.textAlign = 'center'; c.fillText(g.toFixed(2), gx, H - 11);
        c.textAlign = 'right'; c.fillText(g.toFixed(2), L - 6, gy + 4);
      }
      // Noise margin bands
      c.fillStyle = 'rgba(91,228,155,.07)';
      c.fillRect(L, T, mx(curData.VIL) - L, ph);
      c.fillRect(mx(curData.VIH), T, L + pw - mx(curData.VIH), ph);

      // Vout = Vin diagonal
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(mx(0), my(0)); c.lineTo(mx(Vdd), my(Vdd)); c.stroke();
      c.setLineDash([]);

      // VTC curve
      c.strokeStyle = COL_OK; c.lineWidth = 2.6;
      c.beginPath();
      curData.vin.forEach((v, i) => {
        const px = mx(v), py = my(curData.vout[i]);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();

      // VM dot
      const vmx = mx(curData.VM), vmy = my(curData.VM);
      c.fillStyle = acc;
      c.beginPath(); c.arc(vmx, vmy, 5.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = COL_FG; c.textAlign = 'left';
      c.fillText(`V_M = ${curData.VM.toFixed(2)} V`, Math.min(vmx + 9, W - 110), vmy - 8);
    }
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    bjtC.forEach(s => s.setVisible(st.mode === 'bjt'));
    mosC.forEach(s => s.setVisible(st.mode === 'mos'));
    cmosC.forEach(s => s.setVisible(st.mode === 'cmos'));
    card2.hidden = st.mode === 'mos';
    syncSegments(host, false);
  }

  function update() {
    alertEl.innerHTML = '';
    if (st.mode === 'bjt') {
      const d = solveBJT(st);
      curData = d;
      t1.textContent = 'BJT Çıkış Karakteristiği (I_C – V_CE) & Yük Doğrusu';
      t2.textContent = 'Ortak Emetör Küçük İşaret Çıkışı v_CE(t)';
      ax1.textContent = 'V_CE (V)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>I_B eğrileri</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_WARN}"></i>Yük doğrusu</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>v_CE(t) (V)</span>`;
      regBadge.textContent = `Bölge: ${d.region}`;
      regBadge.className = `sle-badge ${d.region === 'Aktif' ? 'sle-badge-ok' : 'sle-badge-warn'}`;
      if (d.clipped) alertEl.innerHTML = '<div class="sle-alert sle-alert-warn">⚠ Çıkış dalgasında kırpılma var! Q-noktasını ortaya almak için I_B ayarlayın veya v_in’i düşürün.</div>';
      renderKpis(kpis, [
        { lbl: 'V_CEQ / I_CQ', val: `${d.Vceq.toFixed(2)} V`, sub: fmtUnit(d.Icq, 'A'), tone: 'acc' },
        { lbl: 'Gerilim Kazancı A_v', val: fmtFix(d.Av, 1), sub: 'eviren (180°)' },
        { lbl: 'Geçiş İletk. g_m', val: fmtUnit(d.gm, 'S') },
        { lbl: 'Giriş r_π', val: fmtUnit(d.rpi, 'Ω') },
        { lbl: 'Çıkış r_o', val: fmtUnit(d.ro, 'Ω'), sub: `P_Q = ${fmtUnit(d.Pq, 'W')}` },
      ]);
      mainCv.render();
      safePlot(cv2, [{ name: 'v_CE', color: COL_OK, xs: d.acT, ys: d.acVout }], { x0: 0, x1: 2, ylabel: 'V', height: 155 });
    } else if (st.mode === 'mos') {
      const d = solveMOSFET(st);
      curData = d;
      t1.textContent = 'MOSFET Çıkış Karakteristiği (I_D – V_DS) & Pinch-Off';
      ax1.textContent = 'V_DS (V)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>V_GS eğrileri</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_PURP}"></i>Triyot/Doyum sınırı</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_WARN}"></i>Yük doğrusu</span>`;
      regBadge.textContent = `Bölge: ${d.region}`;
      regBadge.className = `sle-badge ${d.region === 'Doyum' ? 'sle-badge-ok' : 'sle-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'V_DSQ / I_DQ', val: `${d.Vdsq.toFixed(2)} V`, sub: fmtUnit(d.Idq, 'A'), tone: 'acc' },
        { lbl: 'Aşırı Sürme V_ov', val: `${Math.max(0, d.Vov).toFixed(2)} V` },
        { lbl: 'g_m', val: fmtUnit(d.gm, 'S') },
        { lbl: 'Çıkış r_o', val: fmtUnit(d.ro, 'Ω') },
        { lbl: 'Kazanç A_v', val: fmtFix(d.Av, 2) },
      ]);
      mainCv.render();
    } else {
      const d = solveCMOSInverter({ Vdd: st.VddC, Vtn: st.Vtn, Vtp: st.Vtp, kn: 1e-3, kp: 1e-3 * st.ratio, lambda: st.lamC });
      curData = d;
      t1.textContent = 'CMOS Evirici Gerilim Transfer Karakteristiği (VTC)';
      t2.textContent = 'Geçiş Kısa Devre Akımı I_DD(V_in)';
      ax1.textContent = 'Giriş Gerilimi V_in (V)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>V_out(V_in)</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>I_DD (mA)</span>`;
      regBadge.textContent = `V_M = ${d.VM.toFixed(2)} V`;
      regBadge.className = 'sle-badge sle-badge-acc';
      renderKpis(kpis, [
        { lbl: 'Eşik V_M', val: `${d.VM.toFixed(2)} V`, sub: `VDD/2 = ${(st.VddC / 2).toFixed(2)} V`, tone: 'acc' },
        { lbl: 'Gürültü Marjı NM_L', val: `${d.NML.toFixed(2)} V`, sub: `V_IL = ${d.VIL.toFixed(2)} V` },
        { lbl: 'Gürültü Marjı NM_H', val: `${d.NMH.toFixed(2)} V`, sub: `V_IH = ${d.VIH.toFixed(2)} V` },
        { lbl: 'Tepe I_DD', val: fmtUnit(d.Ipeak, 'A'), sub: 'V_in ≈ V_M anında' },
      ]);
      mainCv.render();
      safePlot(cv2, [{ name: 'Idd', color: COL_WARN, xs: d.vin, ys: d.idd.map(v => v * 1e3) }], { x0: 0, x1: st.VddC, ylabel: 'mA', height: 150 });
    }
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    syncMode();
    update();
  });
  bindPresets(host, TRANS_PRESETS, p => {
    Object.assign(st, p);
    sVcc.set(st.Vcc); sRc.set(st.Rc); sIb.set(st.Ib); sBeta.set(st.beta); sVa.set(st.Va); sVin.set(st.vinPeak);
    sVdd.set(st.Vdd); sRd.set(st.Rd); sVgs.set(st.Vgs); sVth.set(st.Vth); sKn.set(st.kn); sLam.set(st.lambda);
    sVddC.set(st.VddC); sVtn.set(st.Vtn); sVtp.set(st.Vtp); sRatio.set(st.ratio);
    syncMode();
    update();
  });

  observeResize(host.querySelector('[data-box1]'), () => update(), clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 3. GÜÇ ELEKTRONİĞİ (Buck, Boost, Buck-Boost + 1-Faz SPWM Evirici)
// =====================================================================

const POWER_PRESETS = [
  { label: 'Buck 24→12 V (CCM)', mode: 'buck', Vin: 24, D: 0.5, fs: 50e3, L: 120e-6, C: 47e-6, R: 10, Rpar: 0.15 },
  { label: 'Buck DCM (Hafif Yük)', mode: 'buck', Vin: 24, D: 0.4, fs: 50e3, L: 35e-6, C: 47e-6, R: 180, Rpar: 0.15 },
  { label: 'Boost 12→24 V', mode: 'boost', Vin: 12, D: 0.5, fs: 50e3, L: 150e-6, C: 100e-6, R: 20, Rpar: 0.15 },
  { label: 'Buck-Boost Eviren', mode: 'buck-boost', Vin: 12, D: 0.6, fs: 50e3, L: 150e-6, C: 100e-6, R: 20, Rpar: 0.15 },
  { label: 'SPWM Evirici (ma=0.85)', mode: 'spwm', Vdc: 325, ma: 0.85, mf: 15, Rload: 20, Lload: 25e-3, unipolar: true },
];

function mountPowerElectronics(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'buck',
    Vin: 24, D: 0.5, fs: 50e3, L: 120e-6, C: 47e-6, R: 10, Rpar: 0.15,
    Vdc: 325, ma: 0.85, mf: 15, Rload: 20, Lload: 25e-3, unipolar: true,
  };
  let playing = autoPlayAllowed();
  let phase = 0;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>Buck</b>, <b>Boost</b>, <b>Buck-Boost</b> DC–DC dönüştürücülerde PWM görev oranı, bobin akımı, <b>CCM/DCM</b> sınırı ve verimi; ayrıca <b>tek fazlı SPWM evirici</b> harmoniklerini canlı incele.', POWER_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Güç dönüştürücü topolojisi">
        <button type="button" data-m="buck" class="on">Buck</button>
        <button type="button" data-m="boost">Boost</button>
        <button type="button" data-m="buck-boost">Buck-Boost</button>
        <button type="button" data-m="spwm">1-Faz SPWM</button>
      </div>
      <div class="sle-toolbar-g">
        <span class="sle-badge" data-regime>CCM</span>
        <button type="button" class="btn small" data-play></button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Bobin Akımı i_L(t) & PWM</h4><div class="sle-legend" data-leg1></div></div>
          <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="Güç elektroniği dalga formu 1"></canvas></div>
          <div class="sle-axis-lbl" data-ax1></div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t2>Çıkış Gerilimi v_o(t)</h4><div class="sle-legend" data-leg2></div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Güç elektroniği dalga formu 2"></canvas></div>
          <div class="sle-axis-lbl" data-ax2></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{CCM: } V_o^{\\text{Buck}} = D V_{\\text{in}}, \\quad V_o^{\\text{Boost}} = \\frac{V_{\\text{in}}}{1-D}, \\quad V_o^{\\text{BB}} = -\\frac{D}{1-D}V_{\\text{in}}',
        'K = \\frac{2 L f_s}{R} \\ge K_{\\text{krit}}(D)\\ (\\text{CCM}), \\qquad K_{\\text{krit}}^{\\text{Buck}} = 1-D,\\quad K_{\\text{krit}}^{\\text{Boost}} = D(1-D)^2',
        '\\text{SPWM: } V_{1,\\text{tepe}} = m_a V_{dc}\\ (m_a \\le 1), \\quad \\text{THD} = \\frac{\\sqrt{\\sum_{n=2}^\\infty V_n^2}}{V_1}',
      ],
      paragraphs: [
        '**Sürekli iletim (CCM)** modunda bobin akımı hiç sıfıra düşmez ve gerilim dönüşüm oranı yalnızca görev döngüsü $D$’ye bağlıdır. Yük direnci $R$ büyürse veya $L f_s$ küçülürse $K < K_{\\text{krit}}$ olur ve **kesintili iletim (DCM)** başlar.',
        'Parazitik seri direnç $R_{\\text{par}}$ özellikle Boost ve Buck-Boost’ta yüksek $D$ değerlerinde ($D > 0.8$) verimi hızla düşürür ve maksimum kazancı sınırlar.',
        '**SPWM eviricide** sinüs referansı üçgen taşıyıcıyla karşılaştırılır; unipolar SPWM ilk ana harmonik grubunu $2 m_f f_1$ civarına iterek yük akımının THD’sini ciddi biçimde düşürür.',
      ],
      tasks: [
        'Buck modunda yük direncini $R$ artırarak CCM’den DCM’ye geçtiğin kritik sınırı ($K = 1-D$) yakala.',
        'Boost modunda görev oranını $D = 0.85$ üzerine çıkarıp $R_{\\text{par}}$ nedeniyle verimin ve gerçek çıkış geriliminin nasıl düştüğünü gözle.',
        'SPWM modunda unipolar/bipolar geçişini yapıp harmonik spektrumdaki ana taşıyıcı bandının $m_f$’den $2 m_f$’ye kaydığını gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const regEl = host.querySelector('[data-regime]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');
  const leg1 = host.querySelector('[data-leg1]');
  const leg2 = host.querySelector('[data-leg2]');
  const ax1 = host.querySelector('[data-ax1]');
  const ax2 = host.querySelector('[data-ax2]');

  const sVin = addSlider(ctrls, { label: 'Giriş V_in', unit: 'V', min: 5, max: 48, value: st.Vin, step: 1, onInput: v => { st.Vin = v; recompute(); } });
  const sD = addSlider(ctrls, { label: 'Görev Oranı D', min: 0.08, max: 0.9, value: st.D, step: 0.01, fmt: v => `${(v * 100).toFixed(0)}%`, onInput: v => { st.D = v; recompute(); } });
  const sFs = addSlider(ctrls, { label: 'Anahtarlama f_s', unit: 'Hz', min: 10e3, max: 200e3, value: st.fs, log: true, onInput: v => { st.fs = v; recompute(); } });
  const sL = addSlider(ctrls, { label: 'Endüktans L', unit: 'H', min: 10e-6, max: 1e-3, value: st.L, log: true, onInput: v => { st.L = v; recompute(); } });
  const sC = addSlider(ctrls, { label: 'Kapasitans C', unit: 'F', min: 4.7e-6, max: 470e-6, value: st.C, log: true, onInput: v => { st.C = v; recompute(); } });
  const sR = addSlider(ctrls, { label: 'Yük Direnci R', unit: 'Ω', min: 2, max: 500, value: st.R, log: true, onInput: v => { st.R = v; recompute(); } });
  const sRpar = addSlider(ctrls, { label: 'Kayıp Direnci R_par', unit: 'Ω', min: 0, max: 1.5, value: st.Rpar, step: 0.05, fmt: v => `${v.toFixed(2)} Ω`, onInput: v => { st.Rpar = v; recompute(); } });

  const sVdc = addSlider(ctrls, { label: 'DC Bara V_dc', unit: 'V', min: 48, max: 600, value: st.Vdc, step: 5, onInput: v => { st.Vdc = v; recompute(); } });
  const sMa = addSlider(ctrls, { label: 'Modülasyon İndeksi m_a', min: 0.15, max: 1.25, value: st.ma, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.ma = v; recompute(); } });
  const sMf = addSlider(ctrls, { label: 'Frekans Oranı m_f', min: 5, max: 29, value: st.mf, step: 2, fmt: v => `${Math.round(v)}`, onInput: v => { st.mf = Math.round(v); recompute(); } });
  const sRl = addSlider(ctrls, { label: 'Yük R', unit: 'Ω', min: 5, max: 80, value: st.Rload, step: 1, onInput: v => { st.Rload = v; recompute(); } });
  const sLl = addSlider(ctrls, { label: 'Yük L', unit: 'H', min: 5e-3, max: 100e-3, value: st.Lload, log: true, onInput: v => { st.Lload = v; recompute(); } });
  const tUni = addToggle(ctrls, 'Unipolar SPWM (3 seviye)', st.unipolar, v => { st.unipolar = v; recompute(); });

  const dcdcCtrls = [sVin, sD, sFs, sL, sC, sR, sRpar];
  const spwmCtrls = [sVdc, sMa, sMf, sRl, sLl, tUni];

  let dcData = null, spwmData = null;

  const drawDC1 = setupCanvas(cv1, w => Math.min(230, Math.max(185, w * 0.44)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const L = 52, R = 14, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
    c.font = '10.5px "JetBrains Mono", monospace';
    if (st.mode !== 'spwm' && dcData) {
      const iMax = Math.max(dcData.iLmax * 1.18, 0.2);
      const tEnd = dcData.t[dcData.t.length - 1];
      const mx = tv => L + (tv / tEnd) * pw;
      const my = iv => T + ph - (iv / iMax) * ph;
      // Grid
      c.strokeStyle = COL_GRID;
      for (let k = 0; k <= 4; k++) {
        const y = T + (ph * k) / 4;
        c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(fmtUnit(iMax * (1 - k / 4), 'A', 2), L - 6, y + 4);
      }
      // Shaded ON intervals (PWM)
      c.fillStyle = 'rgba(90,176,255,.09)';
      for (let cyc = 0; cyc < 2; cyc++) {
        const xA = mx(cyc * dcData.Ts), xB = mx((cyc + st.D) * dcData.Ts);
        c.fillRect(xA, T, xB - xA, ph);
      }
      // Average line
      c.strokeStyle = 'rgba(255,209,102,.45)'; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(L, my(dcData.iLavg)); c.lineTo(L + pw, my(dcData.iLavg)); c.stroke();
      c.setLineDash([]);
      // iL(t)
      c.strokeStyle = COL_BLUE; c.lineWidth = 2.4;
      c.beginPath();
      dcData.t.forEach((tv, i) => {
        const x = mx(tv), y = my(dcData.iL[i]);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      });
      c.stroke();
      // Animated switching cursor
      const idx = Math.floor(phase * (dcData.t.length - 1));
      const cx = mx(dcData.t[idx]), cy = my(dcData.iL[idx]);
      c.fillStyle = accentColor();
      c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = COL_MUTE; c.textAlign = 'center';
      c.fillText('0', L, H - 8);
      c.fillText('T_s', L + pw / 2, H - 8);
      c.fillText('2 T_s', L + pw, H - 8);
    } else if (st.mode === 'spwm' && spwmData) {
      // Plot switched PWM output + scaled load current
      const N = spwmData.t.length;
      const vMax = st.Vdc * 1.15;
      const iPeak = Math.max(spwmData.I1peak * 1.35, 0.5);
      const mx = k => L + (k / (N - 1)) * pw;
      const myV = v => T + ph / 2 - (v / vMax) * (ph * 0.45);
      const myI = iv => T + ph / 2 - (iv / iPeak) * (ph * 0.42);
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, T + ph / 2); c.lineTo(L + pw, T + ph / 2); c.stroke();
      // PWM trace
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2;
      c.beginPath();
      for (let k = 0; k < N; k++) {
        const x = mx(k), y = myV(spwmData.vOut[k]);
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      // Filtered RL load current
      c.strokeStyle = COL_OK; c.lineWidth = 2.4;
      c.beginPath();
      for (let k = 0; k < N; k++) {
        const x = mx(k), y = myI(spwmData.iOut[k]);
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      // Animated cursor
      const idx = Math.floor(phase * (N - 1));
      c.fillStyle = accentColor();
      c.beginPath(); c.arc(mx(idx), myI(spwmData.iOut[idx]), 4.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = COL_MUTE; c.textAlign = 'right';
      c.fillText(`+${st.Vdc}V`, L - 5, myV(st.Vdc) + 4);
      c.fillText(`−${st.Vdc}V`, L - 5, myV(-st.Vdc) + 4);
    }
  }, clean);

  const drawDC2 = setupCanvas(cv2, w => Math.min(200, Math.max(165, w * 0.38)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const L = 52, R = 14, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
    c.font = '10.5px "JetBrains Mono", monospace';
    if (st.mode !== 'spwm' && dcData) {
      const ys = dcData.vOut;
      const yMid = dcData.Vo;
      const span = Math.max(dcData.dVo * 1.8, Math.abs(yMid) * 0.08, 0.2);
      const yMin = yMid - span, yMax = yMid + span;
      const tEnd = dcData.t[dcData.t.length - 1];
      const mx = tv => L + (tv / tEnd) * pw;
      const my = v => T + ph - ((v - yMin) / (yMax - yMin)) * ph;
      c.strokeStyle = COL_GRID;
      for (let k = 0; k <= 4; k++) {
        const y = T + (ph * k) / 4;
        c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke();
        c.fillStyle = COL_MUTE; c.textAlign = 'right';
        c.fillText((yMax - ((yMax - yMin) * k) / 4).toFixed(2), L - 6, y + 4);
      }
      c.strokeStyle = COL_OK; c.lineWidth = 2.3;
      c.beginPath();
      dcData.t.forEach((tv, i) => {
        const x = mx(tv), y = my(ys[i]);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      });
      c.stroke();
      const idx = Math.floor(phase * (dcData.t.length - 1));
      c.fillStyle = accentColor();
      c.beginPath(); c.arc(mx(dcData.t[idx]), my(ys[idx]), 4.5, 0, Math.PI * 2); c.fill();
    } else if (st.mode === 'spwm' && spwmData) {
      // Harmonic spectrum bar chart
      const hs = spwmData.harmonics;
      const hMax = Math.max(...hs.map(h => h.mag), 1);
      const barW = Math.max(2, (pw / hs.length) - 2);
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, T + ph); c.lineTo(L + pw, T + ph); c.stroke();
      hs.forEach((h, i) => {
        const x = L + (i / hs.length) * pw;
        const bh = (h.mag / hMax) * ph;
        c.fillStyle = h.order === 1 ? COL_OK : h.mag > hMax * 0.15 ? COL_WARN : COL_BLUE;
        c.fillRect(x, T + ph - bh, barW, bh);
        if (h.order === 1 || h.order % 5 === 0) {
          c.fillStyle = COL_MUTE; c.textAlign = 'center';
          c.fillText(`${h.order}`, x + barW / 2, H - 8);
        }
      });
      c.fillStyle = COL_MUTE; c.textAlign = 'right';
      c.fillText(`${hMax.toFixed(0)}V`, L - 6, T + 8);
      c.fillText('0', L - 6, T + ph + 3);
    }
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    phase = (phase + dt * 0.35) % 1;
    drawDC1.render();
    drawDC2.render();
    return playing;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    const isSpwm = st.mode === 'spwm';
    dcdcCtrls.forEach(s => s.setVisible(!isSpwm));
    spwmCtrls.forEach(s => s.setVisible(isSpwm));
    syncSegments(host, false);
  }

  function recompute() {
    if (st.mode !== 'spwm') {
      dcData = solveDCDC({ topology: st.mode, Vin: st.Vin, D: st.D, fs: st.fs, L: st.L, C: st.C, R: st.R, Rpar: st.Rpar });
      t1.textContent = 'Bobin Akımı i_L(t) ve Anahtar İletim Bölgesi';
      t2.textContent = 'Çıkış Gerilimi v_o(t) (Dalgalanma Yakınlaştırmalı)';
      ax1.textContent = `Periyot T_s = ${fmtUnit(dcData.Ts, 's')}`; ax2.textContent = 'Zaman (2 anahtarlama periyodu)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>i_L(t)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_WARN}"></i>Ortalama I_L</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>v_o(t) (V)</span>`;
      regEl.textContent = dcData.ccm ? 'CCM (Sürekli)' : 'DCM (Kesintili)';
      regEl.className = `sle-badge ${dcData.ccm ? 'sle-badge-ok' : 'sle-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'Çıkış V_o', val: `${dcData.Vo.toFixed(2)} V`, sub: `İdeal ${(dcData.gainIdeal * st.Vin).toFixed(2)} V`, tone: 'acc' },
        { lbl: 'Verim η', val: `${(dcData.eta * 100).toFixed(1)}%`, sub: `P_o = ${fmtUnit(dcData.Po, 'W')}`, tone: dcData.eta > 0.85 ? 'ok' : 'warn' },
        { lbl: 'Bobin Δi_L', val: fmtUnit(dcData.diL, 'A'), sub: `I_L,ort = ${fmtUnit(dcData.iLavg, 'A')}` },
        { lbl: 'Dalgalanma Δv_o', val: fmtUnit(dcData.dVo, 'V') },
        { lbl: 'K / K_krit', val: `${dcData.K.toFixed(3)} / ${dcData.Kcrit.toFixed(3)}`, sub: dcData.mode },
      ]);
    } else {
      spwmData = simulateSPWM({ Vdc: st.Vdc, ma: st.ma, mf: st.mf, R: st.Rload, L: st.Lload, unipolar: st.unipolar });
      t1.textContent = 'SPWM Çıkış Gerilimi v_ab(t) & RL Yük Akımı i_o(t)';
      t2.textContent = 'Gerilim Harmonik Spektrumu (n = 1 … 45)';
      ax1.textContent = '1 temel periyot (20 ms · 50 Hz)'; ax2.textContent = 'Harmonik derecesi n';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,255,255,.45)"></i>v_ab (PWM)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>i_o(t) yük akımı</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Temel (n=1)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Yan bantlar</span>`;
      regEl.textContent = st.ma > 1 ? 'Aşırı Modülasyon' : st.unipolar ? 'Unipolar SPWM' : 'Bipolar SPWM';
      regEl.className = `sle-badge ${st.ma > 1 ? 'sle-badge-warn' : 'sle-badge-acc'}`;
      renderKpis(kpis, [
        { lbl: 'Temel V_1,rms', val: `${spwmData.V1rms.toFixed(1)} V`, sub: `Tepe ${spwmData.V1peak.toFixed(1)} V`, tone: 'acc' },
        { lbl: 'Akım I_1,tepe', val: fmtUnit(spwmData.I1peak, 'A') },
        { lbl: 'Gerilim THD_V', val: `${spwmData.thdV.toFixed(1)}%` },
        { lbl: 'Akım THD_I', val: `${spwmData.thdI.toFixed(1)}%`, tone: spwmData.thdI < 8 ? 'ok' : 'warn' },
      ]);
    }
    drawDC1.render();
    drawDC2.render();
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    syncMode(); recompute();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing;
    syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, POWER_PRESETS, p => {
    Object.assign(st, p);
    sVin.set(st.Vin); sD.set(st.D); sFs.set(st.fs); sL.set(st.L); sC.set(st.C); sR.set(st.R); sRpar.set(st.Rpar);
    sVdc.set(st.Vdc); sMa.set(st.ma); sMf.set(st.mf); sRl.set(st.Rload); sLl.set(st.Lload); tUni.set(st.unipolar);
    syncMode(); recompute();
  });

  bindTasks(host);
  syncMode();
  recompute();
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 4. ÜÇ FAZ & GÜÇ (Y / Δ, Balanced / Unbalanced, PFC Capacitor Sizing)
// =====================================================================

const THREEPH_PRESETS = [
  { label: 'Dengeli Y (cosφ=0.8)', connection: 'Y', balanced: true, VLL: 400, f: 50, RA: 16, XA: 12, RB: 16, XB: 12, RC: 16, XC: 12, targetPF: 0.95 },
  { label: 'Dengeli Δ Motor', connection: 'D', balanced: true, VLL: 400, f: 50, RA: 24, XA: 18, RB: 24, XB: 18, RC: 24, XC: 18, targetPF: 0.96 },
  { label: 'Dengesiz Y (Nötr Akımı)', connection: 'Y', balanced: false, VLL: 400, f: 50, RA: 10, XA: 6, RB: 22, XB: 15, RC: 35, XC: -10, targetPF: 0.95 },
  { label: 'Kompanzasyon (0.7→0.98)', connection: 'Y', balanced: true, VLL: 400, f: 50, RA: 14, XA: 14.3, RB: 14, XB: 14.3, RC: 14, XC: 14.3, targetPF: 0.98 },
];

function mountThreePhase(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    connection: 'Y', balanced: true, VLL: 400, f: 50,
    RA: 16, XA: 12, RB: 16, XB: 12, RC: 16, XC: 12, targetPF: 0.95,
  };
  let playing = autoPlayAllowed();
  let phi = 0.25;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Dengeli ve dengesiz <b>Yıldız (Y)</b> / <b>Üçgen (Δ)</b> üç fazlı sistemlerde fazör diyagramını, hat–faz ilişkilerini, aktif/reaktif gücü ve <b>kompanzasyon kondansatörü</b> boyutlandırmasını incele.', THREEPH_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-conn aria-label="Bağlantı tipi">
        <button type="button" data-c="Y" class="on">Yıldız (4 Tel)</button>
        <button type="button" data-c="Y3">Yıldız (Yüzen Nötr)</button>
        <button type="button" data-c="D">Üçgen (Δ)</button>
      </div>
      <button type="button" class="btn small" data-play></button>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-grid-2">
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Üç Faz Fazör Diyagramı</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv1 aria-label="Üç faz fazör diyagramı"></canvas></div>
            <div class="sle-legend">
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_FG}"></i>Faz Gerilimleri</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>Hat Akımları I_A,B,C</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BAD}"></i>Nötr I_N</span>
            </div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Güç Üçgeni & Kompanzasyon</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Güç üçgeni ve kompanzasyon"></canvas></div>
            <div class="sle-legend">
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Önce (S₁)</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Sonra (S₂)</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_PURP}"></i>Q_c (Kapasitif)</span>
            </div>
          </div>
        </div>
        <div class="sle-table-wrap"><table class="sle-tbl mono" aria-label="Faz ve hat değerleri">
          <thead><tr><th>Büyüklük</th><th>Faz A</th><th>Faz B</th><th>Faz C</th></tr></thead>
          <tbody data-tbody></tbody>
        </table></div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{Dengeli Y: } V_L = \\sqrt{3}\\,V_f,\\ I_L = I_f \\qquad \\text{Dengeli } \\Delta\\text{: } V_L = V_f,\\ I_L = \\sqrt{3}\\,I_f',
        'P = \\sqrt{3}\\,V_L I_L \\cos\\varphi, \\quad Q = \\sqrt{3}\\,V_L I_L \\sin\\varphi, \\quad S = \\sqrt{P^2+Q^2}',
        'Q_c = P(\\tan\\varphi_1 - \\tan\\varphi_2), \\quad C_\\Delta = \\frac{Q_c}{3\\omega V_{LL}^2}, \\quad C_Y = 3 C_\\Delta',
      ],
      paragraphs: [
        'Dengeli 4 telli yıldız bağlantıda üç faz akımı $120^\\circ$ arayla ve eşit genlikte olduğundan toplamları $I_N = I_A + I_B + I_C = 0$ olur; yük dengesizleştiğinde nötr telinden akım akar.',
        '**Güç faktörü düzeltmede (PFC)** kondansatör grubu üçgen bağlandığında her kondansatör $V_{LL}$ gerilimi gördüğü için yıldız bağlantıya göre $3$ kat daha küçük kapasite ($C_\\Delta = C_Y/3$) yeterlidir.',
      ],
      tasks: [
        'Aynı empedans ($16+j12\\,\\Omega$) için Y bağlantısından Δ bağlantısına geçip toplam aktif güç $P$’nin tam $3$ katına çıktığını doğrula.',
        'Dengeli kilidi kapatıp $R_A$ değerini değiştir; nötr akımı $|I_N|$’in (4 tel) ve nötr kayma gerilimi $|V_{nN}|$’in (yüzen nötr) nasıl arttığını izle.',
        'Hedef $\\cos\\varphi$’yi $0.98$ yapıp $C_Y = 3 C_\\Delta$ ilişkisini ve hat akımındaki azalma yüzdesini not et.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const tbody = host.querySelector('[data-tbody]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sVll = addSlider(ctrls, { label: 'Hat Gerilimi V_LL', unit: 'V', min: 110, max: 690, value: st.VLL, step: 10, onInput: v => { st.VLL = v; update(); } });
  const tBal = addToggle(ctrls, 'Dengeli yük (Z_A = Z_B = Z_C)', st.balanced, v => {
    st.balanced = v;
    if (v) { st.RB = st.RC = st.RA; st.XB = st.XC = st.XA; sRB.set(st.RB); sXB.set(st.XB); sRC.set(st.RC); sXC.set(st.XC); }
    syncUnb(); update();
  });
  const sRA = addSlider(ctrls, { label: 'Direnç R_A', unit: 'Ω', min: 2, max: 60, value: st.RA, step: 1, onInput: v => { st.RA = v; if (st.balanced) { st.RB = st.RC = v; } update(); } });
  const sXA = addSlider(ctrls, { label: 'Reaktans X_A', unit: 'Ω', min: -30, max: 40, value: st.XA, step: 0.5, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} Ω`, onInput: v => { st.XA = v; if (st.balanced) { st.XB = st.XC = v; } update(); } });
  const sRB = addSlider(ctrls, { label: 'Direnç R_B', unit: 'Ω', min: 2, max: 60, value: st.RB, step: 1, onInput: v => { st.RB = v; update(); } });
  const sXB = addSlider(ctrls, { label: 'Reaktans X_B', unit: 'Ω', min: -30, max: 40, value: st.XB, step: 0.5, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} Ω`, onInput: v => { st.XB = v; update(); } });
  const sRC = addSlider(ctrls, { label: 'Direnç R_C', unit: 'Ω', min: 2, max: 60, value: st.RC, step: 1, onInput: v => { st.RC = v; update(); } });
  const sXC = addSlider(ctrls, { label: 'Reaktans X_C', unit: 'Ω', min: -30, max: 40, value: st.XC, step: 0.5, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} Ω`, onInput: v => { st.XC = v; update(); } });
  const sPF = addSlider(ctrls, { label: 'Hedef cos φ (PFC)', min: 0.75, max: 1.0, value: st.targetPF, step: 0.01, fmt: v => v.toFixed(2), onInput: v => { st.targetPF = v; update(); } });

  const syncUnb = () => { [sRB, sXB, sRC, sXC].forEach(s => s.setVisible(!st.balanced)); };

  let res = null;

  const phCv = setupCanvas(cv1, w => Math.min(270, Math.max(215, w * 0.85)), (c, W, H) => {
    if (!res) return;
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.37;
    c.strokeStyle = COL_GRID;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.arc(cx, cy, R * 0.5, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(cx - R - 10, cy); c.lineTo(cx + R + 10, cy); c.moveTo(cx, cy - R - 10); c.lineTo(cx, cy + R + 10); c.stroke();

    const vScale = R / Math.max(res.Vp, 1);
    const iMax = Math.max(cAbs(res.IA), cAbs(res.IB), cAbs(res.IC), cAbs(res.IN), 1e-6);
    const iScale = (R * 0.76) / iMax;
    const drawPh = (z, sc, col, lw, lbl) => {
      const ang = cArg(z) + phi;
      const m = cAbs(z) * sc;
      drawArrow(c, cx, cy, cx + m * Math.cos(ang), cy - m * Math.sin(ang), col, lw, lbl);
    };
    drawPh(res.Van, vScale, 'rgba(244,244,245,.85)', 2.1, 'Va');
    drawPh(res.Vbn, vScale, 'rgba(244,244,245,.65)', 1.8, 'Vb');
    drawPh(res.Vcn, vScale, 'rgba(244,244,245,.65)', 1.8, 'Vc');
    drawPh(res.IA, iScale, COL_BLUE, 2.2, 'IA');
    drawPh(res.IB, iScale, COL_OK, 2.0, 'IB');
    drawPh(res.IC, iScale, COL_WARN, 2.0, 'IC');
    if (cAbs(res.IN) > 0.05) drawPh(res.IN, iScale, COL_BAD, 2.4, 'IN');
  }, clean);

  const pwrCv = setupCanvas(cv2, w => Math.min(270, Math.max(215, w * 0.85)), (c, W, H) => {
    if (!res) return;
    c.clearRect(0, 0, W, H);
    const L = 36, R = 28, T = 26, B = 32, pw = W - L - R, ph = H - T - B;
    const maxP = Math.max(res.P, 1);
    const maxQ = Math.max(Math.abs(res.Q), Math.abs(res.Qnew), maxP * 0.6, 1);
    const sc = Math.min(pw / maxP, (ph * 0.82) / maxQ);
    const ox = L, oy = res.Q >= 0 ? T + ph - 8 : T + 18;
    const px = ox + res.P * sc;
    const q1y = oy - res.Q * sc;
    const q2y = oy - res.Qnew * sc;

    c.font = '11px "JetBrains Mono", monospace';
    // Base P
    drawArrow(c, ox, oy, px, oy, COL_FG, 2.2, '');
    c.fillStyle = COL_FG; c.textAlign = 'center'; c.fillText(`P = ${fmtUnit(res.P, 'W')}`, (ox + px) / 2, oy + 16);
    // Original Q1 & S1
    c.strokeStyle = COL_WARN; c.lineWidth = 2; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(ox, oy); c.lineTo(px, q1y); c.lineTo(px, oy); c.stroke();
    c.setLineDash([]);
    // New S2 after PFC
    drawArrow(c, ox, oy, px, q2y, COL_OK, 2.4, '');
    // Capacitive Qc vector downward
    if (res.Qc > 1) {
      drawArrow(c, px + 6, q1y, px + 6, q2y, COL_PURP, 2.3, '');
      c.fillStyle = COL_PURP; c.textAlign = 'left';
      c.fillText(`Qc`, Math.min(px + 10, W - 26), (q1y + q2y) / 2 + 4);
    }
    c.fillStyle = COL_WARN; c.textAlign = 'left';
    c.fillText(`S₁=${fmtUnit(res.S, 'VA', 2)}`, ox + 6, T + 2);
    c.fillStyle = COL_OK;
    c.fillText(`S₂=${fmtUnit(res.Snew, 'VA', 2)}`, ox + 6, T + 18);
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    phi = (phi + dt * 1.4) % (Math.PI * 2);
    phCv.render();
    return playing;
  }, clean);

  function update() {
    res = solveThreePhase({
      connection: st.connection, VLL: st.VLL, f: st.f,
      ZA: C(st.RA, st.XA), ZB: C(st.RB, st.XB), ZC: C(st.RC, st.XC), targetPF: st.targetPF,
    });
    renderKpis(kpis, [
      { lbl: 'Aktif Güç P', val: fmtUnit(res.P, 'W'), sub: `Görünür S = ${fmtUnit(res.S, 'VA')}`, tone: 'acc' },
      { lbl: 'Reaktif Güç Q', val: fmtUnit(res.Q, 'var'), sub: `cos φ = ${res.pf.toFixed(3)}` },
      { lbl: st.connection === 'Y3' ? 'Nötr Kayma V_nN' : 'Nötr Akımı |I_N|', val: st.connection === 'Y3' ? fmtUnit(cAbs(res.VNn), 'V') : fmtUnit(cAbs(res.IN), 'A') },
      { lbl: 'Gerekli Q_c (PFC)', val: fmtUnit(res.Qc, 'var'), sub: `Akım −${res.currentReductionPct.toFixed(1)}%`, tone: res.Qc > 1 ? 'ok' : '' },
      { lbl: 'Kondansatör C_Δ / C_Y', val: fmtUnit(res.Cdelta, 'F'), sub: `Y: ${fmtUnit(res.Cstar, 'F')}` },
    ]);
    tbody.innerHTML = `
      <tr><td>Faz Gerilimi</td><td>${esc(fmtPolar(res.Van, 'V'))}</td><td>${esc(fmtPolar(res.Vbn, 'V'))}</td><td>${esc(fmtPolar(res.Vcn, 'V'))}</td></tr>
      <tr><td>Hat Akımı I_L</td><td>${esc(fmtPolar(res.IA, 'A'))}</td><td>${esc(fmtPolar(res.IB, 'A'))}</td><td>${esc(fmtPolar(res.IC, 'A'))}</td></tr>
      <tr><td>Faz Akımı I_f</td><td>${esc(fmtPolar(res.IphA, 'A'))}</td><td>${esc(fmtPolar(res.IphB, 'A'))}</td><td>${esc(fmtPolar(res.IphC, 'A'))}</td></tr>
      <tr><td>Aktif Güç P_f</td><td>${esc(fmtUnit(res.SA.re, 'W'))}</td><td>${esc(fmtUnit(res.SB.re, 'W'))}</td><td>${esc(fmtUnit(res.SC.re, 'W'))}</td></tr>`;
    phCv.render();
    pwrCv.render();
  }

  host.querySelector('[data-conn]').addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (!b || b.dataset.c === st.connection) return;
    st.connection = b.dataset.c;
    host.querySelectorAll('[data-conn] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, THREEPH_PRESETS, p => {
    Object.assign(st, p);
    host.querySelectorAll('[data-conn] button').forEach(x => x.classList.toggle('on', x.dataset.c === st.connection));
    sVll.set(st.VLL); tBal.set(st.balanced);
    sRA.set(st.RA); sXA.set(st.XA); sRB.set(st.RB); sXB.set(st.XB); sRC.set(st.RC); sXC.set(st.XC); sPF.set(st.targetPF);
    syncUnb(); update();
  });

  bindTasks(host);
  syncUnb();
  update();
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 5. TRANSFORMATÖR & MOTOR (Transformer, Induction Motor, DC Motor)
// =====================================================================

const MOTOR_PRESETS = [
  { label: 'Dağıtım Trafosu (Endüktif)', mode: 'trafo', a: 10, loadFrac: 0.85, pf: 0.85, pfType: 'lag', R1: 0.8, X1: 1.6 },
  { label: 'Trafo (Kapasitif Yük)', mode: 'trafo', a: 10, loadFrac: 0.9, pf: 0.8, pfType: 'lead', R1: 0.8, X1: 3.5 },
  { label: '4 Kutuplu Asenkron', mode: 'ind', poles: 4, f: 50, R2: 0.4, X2: 1.2, slip: 0.04 },
  { label: 'Yüksek Rotor Direnci', mode: 'ind', poles: 4, f: 50, R2: 1.4, X2: 1.2, slip: 0.14 },
  { label: 'Serbest Uyarmalı DC', mode: 'dc', dcMode: 'shunt', Va: 220, Ra: 0.8, K: 1.2, TL: 28 },
];

function mountTransformerMotor(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'ind',
    a: 10, loadFrac: 0.85, pf: 0.85, pfType: 'lag', R1: 0.8, X1: 1.6,
    poles: 4, f: 50, R2: 0.4, X2: 1.2, slip: 0.04,
    dcMode: 'shunt', Va: 220, Ra: 0.8, K: 1.2, TL: 28,
  };
  let playing = autoPlayAllowed();
  let rotorAng = 0, fieldAng = 0;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>Gerçek transformatör</b> eşdeğer devresi ile verim/regülasyon, <b>asenkron motor</b> Thevenin tork–kayma eğrisi ve <b>DC motor</b> hız–tork karakteristiğini canlı incele.', MOTOR_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Makine seçimi">
        <button type="button" data-m="trafo">Transformatör</button>
        <button type="button" data-m="ind" class="on">Asenkron Motor</button>
        <button type="button" data-m="dc">DC Motor</button>
      </div>
      <div class="sle-toolbar-g">
        <div class="seg" data-pft hidden role="tablist" aria-label="Yük karakteri">
          <button type="button" data-p="lag" class="on">Endüktif</button>
          <button type="button" data-p="unity">Omik</button>
          <button type="button" data-p="lead">Kapasitif</button>
        </div>
        <div class="seg" data-dcm hidden role="tablist" aria-label="DC motor tipi">
          <button type="button" data-d="shunt" class="on">Şönt / Serbest</button>
          <button type="button" data-d="series">Seri</button>
        </div>
        <button type="button" class="btn small" data-play></button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Tork–Hız Karakteristiği</h4><div class="sle-legend" data-leg1></div></div>
          <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="Makine karakteristik eğrisi"></canvas></div>
          <div class="sle-axis-lbl" data-ax1></div>
        </div>
        <div class="sle-plot-card" data-rotor-card>
          <div class="sle-head"><h4 class="sle-title" data-t2>Canlı Rotor & Döner Alan</h4><span class="sle-hint" data-rinfo></span></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Dönen motor animasyonu"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{Trafo: } \\eta = \\frac{P_{\\text{çıkış}}}{P_{\\text{çıkış}} + P_{\\text{demir}} + P_{\\text{bakır}}}, \\quad VR\\% = \\frac{|V_{2,\\text{boş}}| - |V_2|}{|V_2|}\\times 100',
        '\\text{Asenkron: } T(s) = \\frac{3 V_{\\text{th}}^2 (R_2\'/s)}{\\omega_s\\left[(R_{\\text{th}} + R_2\'/s)^2 + (X_{\\text{th}} + X_2\')^2\\right]}, \\quad s_{\\max} = \\frac{R_2\'}{\\sqrt{R_{\\text{th}}^2 + (X_{\\text{th}}+X_2\')^2}}',
        '\\text{DC Şönt: } \\omega(T) = \\frac{V_a}{K} - \\frac{R_a}{K^2}T, \\quad E_a = K\\omega = V_a - I_a R_a',
      ],
      paragraphs: [
        '**Transformatörde** maksimum verim bakır kayıpları demir kayıplarına ($P_{\\text{bakır}} = P_{\\text{demir}}$) eşit olduğunda elde edilir; kapasitif yükte gerilim regülasyonu negatif olabilir.',
        '**Asenkron motorda** rotor direnci $R_2\'$ artırılırsa maksimum (devrilme) torku $T_{\\max}$ değişmez ama oluştuğu kayma $s_{\\max}$ büyür ve kalkış torku artar.',
        '**DC motorda** şönt/serbest uyarmada hız–tork doğrusal düşer; seri uyarmada akı akımla orantılı olduğundan düşük hızda çok yüksek kalkış torku elde edilir.',
      ],
      tasks: [
        'Asenkron motorda $R_2\'$ direncini $0.4\\,\\Omega$’dan $1.6\\,\\Omega$’a çıkar: $T_{\\max}$ sabit kalırken $s_{\\max}$ ve $T_{\\text{kalkış}}$ değerinin nasıl değiştiğini doğrula.',
        'Transformatörde yükü endüktiften kapasitife çevirip regülasyonun (VR%) negatife geçişini gözle.',
        'DC motorda armatür gerilimini $V_a$ yarıya indirip hız–tork doğrusunun paralel kaydığını gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const pftSeg = host.querySelector('[data-pft]');
  const dcmSeg = host.querySelector('[data-dcm]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const rCard = host.querySelector('[data-rotor-card]');
  const rInfo = host.querySelector('[data-rinfo]');
  const t1 = host.querySelector('[data-t1]');
  const leg1 = host.querySelector('[data-leg1]');
  const ax1 = host.querySelector('[data-ax1]');

  const sA = addSlider(ctrls, { label: 'Dönüştürme Oranı a', min: 1, max: 25, value: st.a, step: 0.5, fmt: v => `${v.toFixed(1)} : 1`, onInput: v => { st.a = v; update(); } });
  const sLoad = addSlider(ctrls, { label: 'Yük Oranı', min: 0.1, max: 1.25, value: st.loadFrac, step: 0.05, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.loadFrac = v; update(); } });
  const sPf = addSlider(ctrls, { label: 'Yük cos φ', min: 0.5, max: 1.0, value: st.pf, step: 0.02, fmt: v => v.toFixed(2), onInput: v => { st.pf = v; update(); } });
  const sR1 = addSlider(ctrls, { label: 'Primer R_1', unit: 'Ω', min: 0.1, max: 4.0, value: st.R1, step: 0.1, onInput: v => { st.R1 = v; update(); } });
  const sX1 = addSlider(ctrls, { label: 'Kaçak X_1', unit: 'Ω', min: 0.2, max: 6.0, value: st.X1, step: 0.1, onInput: v => { st.X1 = v; update(); } });

  const sPoles = addSlider(ctrls, { label: 'Kutup Sayısı p', min: 2, max: 8, value: st.poles, step: 2, fmt: v => `${Math.round(v)} kutup`, onInput: v => { st.poles = Math.round(v); update(); } });
  const sFreq = addSlider(ctrls, { label: 'Besleme Frekansı f', unit: 'Hz', min: 20, max: 100, value: st.f, step: 1, onInput: v => { st.f = v; update(); } });
  const sR2 = addSlider(ctrls, { label: "Rotor Direnci R_2'", unit: 'Ω', min: 0.1, max: 2.5, value: st.R2, step: 0.05, fmt: v => `${v.toFixed(2)} Ω`, onInput: v => { st.R2 = v; update(); } });
  const sX2 = addSlider(ctrls, { label: "Rotor Reaktansı X_2'", unit: 'Ω', min: 0.4, max: 3.0, value: st.X2, step: 0.05, fmt: v => `${v.toFixed(2)} Ω`, onInput: v => { st.X2 = v; update(); } });
  const sSlip = addSlider(ctrls, { label: 'Çalışma Kayması s', min: 0.005, max: 1.0, value: st.slip, step: 0.005, fmt: v => `${(v * 100).toFixed(1)}%`, onInput: v => { st.slip = v; update(); } });

  const sVa = addSlider(ctrls, { label: 'Armatür V_a', unit: 'V', min: 40, max: 300, value: st.Va, step: 5, onInput: v => { st.Va = v; update(); } });
  const sRa = addSlider(ctrls, { label: 'Armatür R_a', unit: 'Ω', min: 0.2, max: 4.0, value: st.Ra, step: 0.1, fmt: v => `${v.toFixed(1)} Ω`, onInput: v => { st.Ra = v; update(); } });
  const sK = addSlider(ctrls, { label: 'Akı Sabiti K = kφ', min: 0.4, max: 2.5, value: st.K, step: 0.05, fmt: v => `${v.toFixed(2)} V·s`, onInput: v => { st.K = v; update(); } });
  const sTL = addSlider(ctrls, { label: 'Yük Torku T_L', unit: 'N·m', min: 2, max: 120, value: st.TL, step: 1, onInput: v => { st.TL = v; update(); } });

  const trafoC = [sA, sLoad, sPf, sR1, sX1];
  const indC = [sPoles, sFreq, sR2, sX2, sSlip];
  const dcC = [sVa, sRa, sK, sTL];

  let curData = null;

  const rotorCv = setupCanvas(cv2, () => 180, (c, W, H) => {
    if (st.mode === 'trafo' || !curData) return;
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38;
    const acc = accentColor();
    // Stator ring
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, R + 12, 0, Math.PI * 2); c.stroke();
    // Rotating stator magnetic field vector (induction motor)
    if (st.mode === 'ind') {
      drawArrow(c, cx, cy, cx + (R + 8) * Math.cos(fieldAng), cy + (R + 8) * Math.sin(fieldAng), COL_WARN, 2, 'B_s');
    }
    // Rotor body + spokes
    c.strokeStyle = acc; c.lineWidth = 2; c.fillStyle = 'rgba(255,255,255,.04)';
    c.beginPath(); c.arc(cx, cy, R * 0.72, 0, Math.PI * 2); c.fill(); c.stroke();
    for (let k = 0; k < 6; k++) {
      const a = rotorAng + (k * Math.PI) / 3;
      c.strokeStyle = k === 0 ? COL_OK : 'rgba(255,255,255,.45)';
      c.lineWidth = k === 0 ? 3 : 1.5;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * 0.7 * Math.cos(a), cy + R * 0.7 * Math.sin(a)); c.stroke();
    }
    c.fillStyle = COL_FG; c.beginPath(); c.arc(cx, cy, 4.5, 0, Math.PI * 2); c.fill();
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    if (st.mode === 'ind' && curData) {
      const wVis = 2.6;
      fieldAng = (fieldAng + dt * wVis) % (Math.PI * 2);
      rotorAng = (rotorAng + dt * wVis * (1 - st.slip)) % (Math.PI * 2);
      rotorCv.render();
    } else if (st.mode === 'dc' && curData) {
      const wVis = Math.min(8, Math.max(0, curData.wOp * 0.03));
      rotorAng = (rotorAng + dt * wVis) % (Math.PI * 2);
      rotorCv.render();
    }
    return playing;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    trafoC.forEach(s => s.setVisible(st.mode === 'trafo'));
    indC.forEach(s => s.setVisible(st.mode === 'ind'));
    dcC.forEach(s => s.setVisible(st.mode === 'dc'));
    pftSeg.hidden = st.mode !== 'trafo';
    dcmSeg.hidden = st.mode !== 'dc';
    rCard.hidden = st.mode === 'trafo';
    playBtn.hidden = st.mode === 'trafo';
    syncSegments(host, false);
  }

  function update() {
    if (st.mode === 'trafo') {
      const d = solveTransformer({ a: st.a, loadFrac: st.loadFrac, pf: st.pf, pfType: st.pfType, R1: st.R1, X1: st.X1, R2: st.R1 / (st.a * st.a), X2: st.X1 / (st.a * st.a) });
      curData = d;
      t1.textContent = 'Transformatör Verim η(%) ve Gerilim Regülasyonu VR(%)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Verim η (%)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Regülasyon VR (%)</span>`;
      ax1.textContent = 'Yük Oranı (%)';
      safePlot(cv1, [
        { name: 'eta', color: COL_OK, xs: d.sweepFrac, ys: d.sweepEta },
        { name: 'VR', color: COL_WARN, xs: d.sweepFrac, ys: d.sweepVR },
      ], { x0: 0, x1: 130, ylabel: '%', height: 225 });
      renderKpis(kpis, [
        { lbl: 'Verim η', val: `${d.eta.toFixed(2)}%`, sub: `Maks. @ %${(d.fracMaxEta * 100).toFixed(0)}`, tone: 'ok' },
        { lbl: 'Regülasyon VR', val: `${d.VR.toFixed(2)}%`, tone: d.VR < 0 ? 'acc' : '' },
        { lbl: 'Sekonder V_2 / I_2', val: `${d.V2.toFixed(1)} V`, sub: `${d.I2mag.toFixed(1)} A` },
        { lbl: 'Bakır / Demir Kaybı', val: fmtUnit(d.Pcu, 'W'), sub: `Demir: ${fmtUnit(d.Pcore, 'W')}` },
      ]);
    } else if (st.mode === 'ind') {
      const d = solveInductionMotor({ poles: st.poles, f: st.f, R2: st.R2, X2: st.X2, slip: st.slip });
      curData = d;
      t1.textContent = 'Asenkron Motor Tork–Hız Karakteristiği (Thevenin)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>Tork T(n) (N·m)</span>`;
      ax1.textContent = `Rotor Hızı n (rpm) · Senkron n_s = ${d.ns.toFixed(0)} rpm`;
      const filtIdx = d.speeds.map((sp, i) => ({ sp, t: d.torques[i] })).filter(o => o.sp >= 0 && o.sp <= d.ns * 1.15);
      safePlot(cv1, [
        { name: 'T', color: COL_BLUE, xs: filtIdx.map(o => o.sp), ys: filtIdx.map(o => o.t) },
        { name: 'op', color: COL_OK, xs: [d.nOp, d.nOp], ys: [0, d.Top] },
      ], { x0: 0, x1: d.ns * 1.12, ylabel: 'N·m', height: 225 });
      rInfo.textContent = `Döner alan ${d.ns.toFixed(0)} rpm · Rotor ${d.nOp.toFixed(0)} rpm (s = ${(st.slip * 100).toFixed(1)}%)`;
      renderKpis(kpis, [
        { lbl: 'Çalışma Torku T', val: `${d.Top.toFixed(1)} N·m`, sub: `n = ${d.nOp.toFixed(0)} rpm`, tone: 'acc' },
        { lbl: 'Devrilme T_max', val: `${d.Tmax.toFixed(1)} N·m`, sub: `s_max = ${(d.smax * 100).toFixed(1)}%` },
        { lbl: 'Kalkış T_start', val: `${d.Tstart.toFixed(1)} N·m` },
        { lbl: 'Mekanik Güç P_m', val: fmtUnit(d.Pmech, 'W'), sub: `η = ${d.eta.toFixed(1)}%` },
        { lbl: 'Stator Akımı I_1', val: `${d.I1mag.toFixed(1)} A`, sub: `cos φ = ${d.pf.toFixed(2)}` },
      ]);
      rotorCv.render();
    } else {
      const d = solveDCMotor({ mode: st.dcMode, Va: st.Va, Ra: st.Ra, K: st.K, TL: st.TL });
      curData = d;
      t1.textContent = `DC Motor (${st.dcMode === 'shunt' ? 'Şönt' : 'Seri'}) Hız–Tork Eğrisi`;
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Hız n (rpm)</span>`;
      ax1.textContent = 'Tork T (N·m)';
      const x1 = d.torques[d.torques.length - 1];
      safePlot(cv1, [
        { name: 'n', color: COL_OK, xs: d.torques, ys: d.speedsRpm },
        { name: 'op', color: COL_WARN, xs: [Math.min(st.TL, x1), Math.min(st.TL, x1)], ys: [0, d.nOp] },
      ], { x0: 0, x1, ylabel: 'rpm', height: 225 });
      rInfo.textContent = `Mil hızı: ${d.nOp.toFixed(0)} rpm · Zıt EMK E_a = ${d.EaOp.toFixed(1)} V`;
      renderKpis(kpis, [
        { lbl: 'Hız n', val: `${d.nOp.toFixed(0)} rpm`, sub: `ω = ${d.wOp.toFixed(1)} rad/s`, tone: 'acc' },
        { lbl: 'Armatür I_a', val: `${d.IaOp.toFixed(1)} A`, sub: `E_a = ${d.EaOp.toFixed(1)} V` },
        { lbl: 'Mekanik Güç P_m', val: fmtUnit(d.PmOp, 'W'), sub: `η = ${d.etaOp.toFixed(1)}%`, tone: 'ok' },
        { lbl: 'Durma Torku', val: `${d.Tstall.toFixed(0)} N·m` },
      ]);
      rotorCv.render();
    }
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
  });
  pftSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    st.pfType = b.dataset.p; pftSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); update();
  });
  dcmSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    st.dcMode = b.dataset.d; dcmSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); update();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, MOTOR_PRESETS, p => {
    Object.assign(st, p);
    sA.set(st.a); sLoad.set(st.loadFrac); sPf.set(st.pf); sR1.set(st.R1); sX1.set(st.X1);
    sPoles.set(st.poles); sFreq.set(st.f); sR2.set(st.R2); sX2.set(st.X2); sSlip.set(st.slip);
    sVa.set(st.Va); sRa.set(st.Ra); sK.set(st.K); sTL.set(st.TL);
    pftSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.p === st.pfType));
    dcmSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.d === st.dcMode));
    syncMode(); update();
  });
  observeResize(host.querySelector('[data-box1]'), () => update(), clean);
  bindTasks(host);
  syncMode();
  update();
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 6. İLETİM HATTI & SMITH ÇİZELGESİ
// =====================================================================

const TL_PRESETS = [
  { label: 'Uyumlu Hat (50 Ω)', Z0: 50, RL: 50, XL: 0, lengthLam: 0.35, alphaLam: 0, match: 'none' },
  { label: 'Kısa Devre (VSWR=∞)', Z0: 50, RL: 0, XL: 0, lengthLam: 0.5, alphaLam: 0, match: 'none' },
  { label: 'Kompleks + Saplama Uyumu', Z0: 50, RL: 75, XL: 50, lengthLam: 0.3, alphaLam: 0, match: 'stub' },
  { label: 'λ/4 Dönüştürücü (100 Ω)', Z0: 50, RL: 100, XL: 0, lengthLam: 0.25, alphaLam: 0, match: 'qwave' },
  { label: 'Kayıplı Hat (α=0.35)', Z0: 50, RL: 150, XL: -60, lengthLam: 0.65, alphaLam: 0.35, match: 'none' },
];

function mountTransmissionLine(host, ctx) {
  const clean = createClean(ctx);
  const st = { Z0: 50, RL: 75, XL: 50, lengthLam: 0.3, alphaLam: 0, match: 'stub' };
  let playing = autoPlayAllowed();
  let phase = 0;
  let data = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Kayıpsız/kayıplı iletim hattında <b>duran dalga</b> animasyonunu izle; <b>Smith çizelgesindeki</b> yük noktasını sürükleyerek $\\Gamma$, VSWR, $Z_{\\text{in}}$, $\\lambda/4$ ve tek saplama (stub) uyumunu anlık gör.', TL_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-match aria-label="Empedans uydurma">
        <button type="button" data-mt="none">Uydurma Yok</button>
        <button type="button" data-mt="qwave">λ/4 Dönüştürücü</button>
        <button type="button" data-mt="stub" class="on">Tek Saplama (Stub)</button>
      </div>
      <button type="button" class="btn small" data-play></button>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-grid-2">
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Smith Çizelgesi (Yükü Sürükle)</h4><span class="sle-hint" data-smhint>z_L sürüklenebilir</span></div>
            <div class="sle-cv-box"><canvas class="sle-cv sle-cv-drag" data-cv1 aria-label="Etkileşimli Smith çizelgesi"></canvas></div>
            <div class="sle-legend">
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>z_L (yük)</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>z_in (giriş)</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>g = 1 çemberi</span>
            </div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Duran Dalga & Zarf |V(z)|</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Duran dalga animasyonu"></canvas></div>
            <div class="sle-legend">
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_FG}"></i>v(z, t)</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Zarf |V(z)|</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_BLUE}"></i>|I(z)|</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\Gamma_L = \\frac{Z_L - Z_0}{Z_L + Z_0}, \\qquad \\text{VSWR} = \\frac{1+|\\Gamma_L|}{1-|\\Gamma_L|}, \\qquad RL = -20\\log_{10}|\\Gamma_L|\\text{ dB}',
        'Z_{\\text{in}}(\\ell) = Z_0 \\frac{Z_L + Z_0 \\tanh(\\gamma \\ell)}{Z_0 + Z_L \\tanh(\\gamma \\ell)}, \\qquad \\Gamma(d) = \\Gamma_L e^{-2\\alpha d} e^{-j 4\\pi d/\\lambda}',
        'Z_q = \\sqrt{Z_0 R_{\\text{in}}}, \\qquad y(d) = 1 + j b_s \\implies y_{\\text{stub}} = -j b_s',
      ],
      paragraphs: [
        '**Smith çizelgesi**, karmaşık yansıma katsayısı $\\Gamma$ birim diski üzerine sabit direnç ($r$) ve sabit reaktans ($x$) çemberlerini yerleştirir; merkez ($\\Gamma = 0$) tam uyumlu hattı ($Z_L = Z_0$) temsil eder.',
        'Kayıpsız hatta yükten kaynağa $d$ kadar gitmek saat yönünde $4\\pi d/\\lambda$ dönmek demektir; $0.5\\lambda$ tam bir tur atar. Kayıplı hatta ($\\alpha > 0$) yörünge merkeze doğru spiral çizer.',
        '**Tek saplama (single-stub)** uyumunda önce $g = 1$ çemberine kadar $d$ mesafesi gidilir, ardından açık veya kısa devre paralel saplama ile $j b_s$ bileşeni sıfırlanır.',
      ],
      tasks: [
        'Smith çizelgesindeki sarı yük noktasını merkeze ($\\Gamma = 0$) sürükleyip VSWR’nin $1.00$ ve duran dalga zarfının düz olduğunu doğrula.',
        'Yükü $100 + j0\\,\\Omega$ ve hat uzunluğunu $0.25\\lambda$ yap; giriş empedansının $Z_0^2 / Z_L = 25\\,\\Omega$ olduğunu gör.',
        'Kompleks bir yükte ($75 + j50\\,\\Omega$) Tek Saplama modunu açıp $d$ ve $\\ell_{\\text{açık}}$ / $\\ell_{\\text{kısa}}$ değerlerini oku.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sZ0 = addSlider(ctrls, { label: 'Karakteristik Z_0', unit: 'Ω', min: 25, max: 150, value: st.Z0, step: 5, onInput: v => { st.Z0 = v; recompute(); } });
  const sRL = addSlider(ctrls, { label: 'Yük Direnci R_L', unit: 'Ω', min: 0, max: 250, value: st.RL, step: 1, onInput: v => { st.RL = v; recompute(); } });
  const sXL = addSlider(ctrls, { label: 'Yük Reaktansı X_L', unit: 'Ω', min: -200, max: 200, value: st.XL, step: 1, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)} Ω`, onInput: v => { st.XL = v; recompute(); } });
  const sLen = addSlider(ctrls, { label: 'Hat Uzunluğu ℓ / λ', min: 0.05, max: 1.0, value: st.lengthLam, step: 0.01, fmt: v => `${v.toFixed(2)} λ`, onInput: v => { st.lengthLam = v; recompute(); } });
  const sAlpha = addSlider(ctrls, { label: 'Zayıflama α (Np/λ)', min: 0, max: 0.8, value: st.alphaLam, step: 0.02, fmt: v => `${v.toFixed(2)} Np/λ`, onInput: v => { st.alphaLam = v; recompute(); } });

  let smithGeom = { cx: 140, cy: 140, R: 110 };

  const smithCv = setupCanvas(cv1, w => Math.min(310, Math.max(240, w * 0.92)), (c, W, H) => {
    if (!data) return;
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.43;
    smithGeom = { cx, cy, R };
    const px = g => cx + g.re * R;
    const py = g => cy - g.im * R;

    c.save();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();

    // Constant r circles: center (r/(1+r), 0), radius 1/(1+r)
    c.strokeStyle = 'rgba(255,255,255,.11)'; c.lineWidth = 1;
    for (const r of [0, 0.2, 0.5, 1, 2, 5]) {
      c.beginPath();
      c.arc(cx + (r / (1 + r)) * R, cy, (1 / (1 + r)) * R, 0, Math.PI * 2);
      c.stroke();
    }
    // Constant x arcs: center (1, 1/x), radius 1/|x|
    for (const x of [0.2, 0.5, 1, 2, 5, -0.2, -0.5, -1, -2, -5]) {
      c.beginPath();
      c.arc(cx + R, cy - (1 / x) * R, Math.abs(1 / x) * R, 0, Math.PI * 2);
      c.stroke();
    }
    // Real axis
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.stroke();

    // Unit conductance g = 1 circle (mirror of r=1 across origin) when stub matching active
    if (st.match === 'stub') {
      c.strokeStyle = 'rgba(90,176,255,.45)'; c.lineWidth = 1.6; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(cx - 0.5 * R, cy, 0.5 * R, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
    }

    // VSWR circle
    c.strokeStyle = 'rgba(255,209,102,.32)'; c.lineWidth = 1.3; c.setLineDash([4, 4]);
    c.beginPath(); c.arc(cx, cy, data.gammaMag * R, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    // Trajectory along transmission line
    c.strokeStyle = accentColor(); c.lineWidth = 2.4;
    c.beginPath();
    data.smithPath.forEach((g, i) => {
      const x = px(g), y = py(g);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();

    // Stub matching point marker on g=1 circle (in gamma-admittance view: -gamma)
    if (st.match === 'stub' && data.stubSolutions.length) {
      const sol = data.stubSolutions[0];
      const gStub = cDiv(cSub(C(1), sol.yd), cAdd(C(1), sol.yd)); // admittance reflection = -gamma
      const sx = cx - gStub.re * R, sy = cy + gStub.im * R;
      c.fillStyle = COL_BLUE;
      c.beginPath(); c.arc(sx, sy, 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // Outer boundary rim
    c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();

    // Center matched cross
    drawCross(c, cx, cy, 4, 'rgba(255,255,255,.45)', 1.2);
    // Input point
    c.fillStyle = COL_OK;
    c.beginPath(); c.arc(px(data.gammaIn), py(data.gammaIn), 5.5, 0, Math.PI * 2); c.fill();
    // Load point (draggable handle)
    c.fillStyle = COL_WARN;
    c.beginPath(); c.arc(px(data.gammaL), py(data.gammaL), 7.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.stroke();
  }, clean);

  const waveCv = setupCanvas(cv2, w => Math.min(310, Math.max(240, w * 0.92)), (c, W, H) => {
    if (!data) return;
    c.clearRect(0, 0, W, H);
    const L = 40, R = 14, T = 18, B = 30, pw = W - L - R, ph = H - T - B;
    const midY = T + ph / 2;
    const vScale = (ph * 0.44) / Math.max(2.1, ...data.envV);
    const N = data.dAxis.length;
    const mx = i => L + (i / (N - 1)) * pw;

    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(L, midY); c.lineTo(L + pw, midY); c.stroke();

    // Envelopes +|V| and -|V|
    c.strokeStyle = COL_OK; c.lineWidth = 1.8;
    c.beginPath(); data.envV.forEach((v, i) => { const x = mx(i), y = midY - v * vScale; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    c.beginPath(); data.envV.forEach((v, i) => { const x = mx(i), y = midY + v * vScale; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();

    // Current envelope |I|
    c.strokeStyle = 'rgba(90,176,255,.55)'; c.lineWidth = 1.4; c.setLineDash([4, 3]);
    c.beginPath(); data.envI.forEach((v, i) => { const x = mx(i), y = midY - v * vScale; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    c.setLineDash([]);

    // Instantaneous standing wave v(z, t)
    c.strokeStyle = COL_FG; c.lineWidth = 2.4;
    c.beginPath();
    data.instV.forEach((v, i) => {
      const x = mx(i), y = midY - v * vScale;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();

    c.font = '10.5px "JetBrains Mono", monospace'; c.fillStyle = COL_MUTE;
    c.textAlign = 'left'; c.fillText(`Kaynak (−${st.lengthLam.toFixed(2)}λ)`, L, H - 10);
    c.textAlign = 'right'; c.fillText('Yük (z=0)', L + pw, H - 10);
  }, clean);

  // Drag load point on Smith chart
  const applySmithDrag = p => {
    let gre = (p.x - smithGeom.cx) / smithGeom.R;
    let gim = -(p.y - smithGeom.cy) / smithGeom.R;
    const r = Math.hypot(gre, gim);
    if (r > 0.985) { gre *= 0.985 / r; gim *= 0.985 / r; }
    const g = C(gre, gim);
    const z = cDiv(cAdd(C(1), g), cSub(C(1), g));
    st.RL = Math.max(0, Math.min(250, Math.round(z.re * st.Z0)));
    st.XL = Math.max(-200, Math.min(200, Math.round(z.im * st.Z0)));
    sRL.set(st.RL); sXL.set(st.XL);
    recompute();
  };
  bindDragCanvas(cv1, {
    onDown: p => {
      if (Math.hypot(p.x - smithGeom.cx, p.y - smithGeom.cy) > smithGeom.R + 18) return false;
      applySmithDrag(p);
    },
    onMove: (p, dragging) => { if (dragging) applySmithDrag(p); },
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    phase = (phase + dt * 3.4) % (Math.PI * 2);
    data = solveTransmissionLine({ ...st, phase });
    waveCv.render();
    return playing;
  }, clean);

  function recompute() {
    data = solveTransmissionLine({ ...st, phase });
    const matchKpi = st.match === 'qwave'
      ? { lbl: 'λ/4 Empedansı Z_q', val: `${fmtNum(data.quarterWave.ZqMax, 3)} Ω`, sub: `d_Vmax = ${data.quarterWave.dVmax.toFixed(3)} λ`, tone: 'acc' }
      : st.match === 'stub' && data.stubSolutions.length
        ? { lbl: 'Saplama d / ℓ_açık', val: `${data.stubSolutions[0].d.toFixed(3)} λ`, sub: `Açık: ${data.stubSolutions[0].lOpen.toFixed(3)}λ · Kısa: ${data.stubSolutions[0].lShort.toFixed(3)}λ`, tone: 'acc' }
        : { lbl: 'Geri Dönüş Kaybı', val: Number.isFinite(data.returnLoss) ? `${data.returnLoss.toFixed(1)} dB` : '∞ dB', sub: 'RL = −20 log|Γ|' };

    renderKpis(kpis, [
      { lbl: 'Yansıma Γ_L', val: `${data.gammaMag.toFixed(3)} ∠ ${fmtDeg(data.gammaDeg)}`, tone: data.gammaMag < 0.05 ? 'ok' : '' },
      { lbl: 'VSWR', val: Number.isFinite(data.vswr) ? data.vswr.toFixed(2) : '∞', tone: data.vswr < 1.5 ? 'ok' : data.vswr > 3 ? 'warn' : '' },
      { lbl: 'Giriş Z_in', val: fmtRect(data.ZIn, 'Ω') },
      matchKpi,
    ]);
    smithCv.render();
    waveCv.render();
  }

  host.querySelector('[data-match]').addEventListener('click', e => {
    const b = e.target.closest('[data-mt]'); if (!b) return;
    st.match = b.dataset.mt;
    host.querySelectorAll('[data-match] button').forEach(x => x.classList.toggle('on', x === b));
    recompute();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, TL_PRESETS, p => {
    Object.assign(st, p);
    sZ0.set(st.Z0); sRL.set(st.RL); sXL.set(st.XL); sLen.set(st.lengthLam); sAlpha.set(st.alphaLam);
    host.querySelectorAll('[data-match] button').forEach(x => x.classList.toggle('on', x.dataset.mt === st.match));
    recompute();
  });

  bindTasks(host);
  recompute();
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 7. ELEKTROMANYETİK ALAN (Point Charges, Biot-Savart, Lorentz/Cyclotron)
// =====================================================================

const EM_PRESETS = [
  { label: 'Elektrik Dipolü', mode: 'electro', charges: [{ x: -0.75, y: 0, q: 3 }, { x: 0.75, y: 0, q: -3 }] },
  { label: 'Kuadrupol', mode: 'electro', charges: [{ x: -0.65, y: 0.65, q: 2.5 }, { x: 0.65, y: -0.65, q: 2.5 }, { x: 0.65, y: 0.65, q: -2.5 }, { x: -0.65, y: -0.65, q: -2.5 }] },
  { label: 'Paralel Teller (Çekme)', mode: 'mag', magKind: 'wires', I1: 12, I2: 12, wireD: 1.0 },
  { label: 'Akım Halkası (Biot-Savart)', mode: 'mag', magKind: 'loop', loopI: 15, loopR: 0.6 },
  { label: 'Saf Siklotron (E=0)', mode: 'lorentz', qP: 1, mP: 1, v0: 2.0, Bz: 1.5, Ex: 0, Ey: 0 },
  { label: 'E×B Sürüklenme', mode: 'lorentz', qP: 1, mP: 1, v0: 1.2, Bz: 1.6, Ex: 0, Ey: 1.2 },
];

function mountEMFields(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'electro',
    charges: [{ x: -0.75, y: 0, q: 3 }, { x: 0.75, y: 0, q: -3 }],
    selIdx: 0,
    showEquip: true,
    magKind: 'wires', I1: 12, I2: 12, wireD: 1.0, loopI: 15, loopR: 0.6,
    qP: 1, mP: 1, v0: 2.0, Bz: 1.5, Ex: 0, Ey: 0,
  };
  let probe = null;
  let playing = autoPlayAllowed();
  let particle = { x: 0, y: -0.8, vx: 2.0, vy: 0 };
  let trail = [];
  const resetParticle = () => {
    const cyc = cyclotronMetrics({ q: st.qP, m: st.mP, v0: st.v0, Ex: st.Ex, Ey: st.Ey, Bz: st.Bz });
    const y0 = Number.isFinite(cyc.rc) ? -Math.min(1.4, cyc.rc) : 0;
    particle = { x: st.Ex || st.Ey ? -1.8 : 0, y: st.Ex || st.Ey ? 0 : y0, vx: st.v0, vy: 0 };
    trail = [[particle.x, particle.y]];
  };
  resetParticle();

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Nokta yükleri <b>sürükleyerek</b> elektrik alan çizgilerini ve eşpotansiyelleri gör; <b>Biot-Savart</b> ile tel/halka manyetik alanını ve <b>Lorentz siklotron</b> yörüngesini canlı izle.', EM_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="EM modları">
        <button type="button" data-m="electro" class="on">Elektrostatik</button>
        <button type="button" data-m="mag">Manyetik (Biot-Savart)</button>
        <button type="button" data-m="lorentz">Lorentz & Siklotron</button>
      </div>
      <div class="sle-toolbar-g">
        <div class="seg" data-mkind hidden role="tablist" aria-label="Akım geometrisi">
          <button type="button" data-mk="wires" class="on">Paralel Teller</button>
          <button type="button" data-mk="loop">Akım Halkası</button>
        </div>
        <button type="button" class="btn small" data-play hidden></button>
        <button type="button" class="btn small ghost" data-reset hidden>${icon('rotate')} Sıfırla</button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls>
        <div class="sle-toolbar-g" data-ch-btns>
          <button type="button" class="btn small" data-addp>+ Yük Ekle</button>
          <button type="button" class="btn small" data-addn>− Yük Ekle</button>
          <button type="button" class="btn small ghost" data-delq>Seçiliyi Sil</button>
        </div>
      </div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Elektrik Alan Çizgileri & Eşpotansiyeller (Yükleri Sürükle)</h4><span class="sle-hint" data-probe></span></div>
          <div class="sle-cv-box"><canvas class="sle-cv sle-cv-drag" data-cv1 aria-label="Elektromanyetik alan sahnesi"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\vec{E}(\\vec{r}) = \\sum_i \\frac{k_e q_i}{r_i^3}(\\vec{r}-\\vec{r}_i), \\qquad V(\\vec{r}) = \\sum_i \\frac{k_e q_i}{r_i}',
        '\\vec{B}(\\vec{r}) = \\frac{\\mu_0 I}{4\\pi} \\oint \\frac{d\\vec{\\ell} \\times \\vec{r}\'}{|\\vec{r}\'|^3}, \\qquad B_z^{\\text{halka}}(z) = \\frac{\\mu_0 I R^2}{2(R^2+z^2)^{3/2}}',
        '\\vec{F} = q(\\vec{E} + \\vec{v}\\times\\vec{B}), \\qquad r_c = \\frac{m v_\\perp}{|q B|}, \\qquad \\vec{v}_d = \\frac{\\vec{E}\\times\\vec{B}}{B^2}',
      ],
      paragraphs: [
        '**Elektrostatikte** alan çizgileri pozitif yüklerden çıkıp negatif yüklere girer ve **eşpotansiyel eğrileri** her noktada alan çizgilerine diktir.',
        '**Paralel tellerde** aynı yönlü akımlar birbirini çeker, zıt yönlü akımlar iter ($F/L = \\mu_0 I_1 I_2 / (2\\pi d)$). Akım halkasında sayısal Biot-Savart integrali eksen üzerinde analitik formülle örtüşür.',
        '**Lorentz kuvveti** enerjiyi koruyan **Boris integratörü** ile çözülür; saf manyetik alanda kinetik enerji sabit kalır ve dairesel siklotron hareketi oluşur; dik $\\vec{E}$ eklendiğinde $\\vec{E}\\times\\vec{B}$ sürüklenmesi gözlenir.',
      ],
      tasks: [
        'Elektrik dipolünde bir yükü diğerine yaklaştırıp alan çizgilerinin ve eşpotansiyellerin yoğunlaşmasını izle.',
        'Paralel tellerde $I_2$’nin işaretini ters çevirip kuvvetin çekmeden itmeye geçtiğini doğrula.',
        'Lorentz modunda $E_y = v_0 B_z$ (hız seçici koşulu) ayarla ve parçacığın sapmadan düz gittiğini gör!',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const chBtns = host.querySelector('[data-ch-btns]');
  const kpis = host.querySelector('[data-kpis]');
  const mkindSeg = host.querySelector('[data-mkind]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const probeEl = host.querySelector('[data-probe]');
  const t1 = host.querySelector('[data-t1]');
  const cv1 = host.querySelector('[data-cv1]');

  const sSelQ = addSlider(ctrls, { label: 'Seçili Yük q', min: -5, max: 5, value: 3, step: 0.5, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} µC`, onInput: v => { if (st.charges[st.selIdx]) { st.charges[st.selIdx].q = v; update(); } } });
  const tEquip = addToggle(ctrls, 'Eşpotansiyel eğrilerini göster', st.showEquip, v => { st.showEquip = v; emCv.render(); });

  const sI1 = addSlider(ctrls, { label: 'Tel 1 Akımı I_1', unit: 'A', min: -25, max: 25, value: st.I1, step: 1, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v)} A`, onInput: v => { st.I1 = v; update(); } });
  const sI2 = addSlider(ctrls, { label: 'Tel 2 Akımı I_2', unit: 'A', min: -25, max: 25, value: st.I2, step: 1, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v)} A`, onInput: v => { st.I2 = v; update(); } });
  const sWd = addSlider(ctrls, { label: 'Tel Aralığı d', unit: 'm', min: 0.3, max: 2.0, value: st.wireD, step: 0.05, fmt: v => `${v.toFixed(2)} m`, onInput: v => { st.wireD = v; update(); } });
  const sLI = addSlider(ctrls, { label: 'Halka Akımı I', unit: 'A', min: 1, max: 30, value: st.loopI, step: 1, onInput: v => { st.loopI = v; update(); } });
  const sLR = addSlider(ctrls, { label: 'Halka Yarıçapı R', unit: 'm', min: 0.25, max: 1.2, value: st.loopR, step: 0.05, fmt: v => `${v.toFixed(2)} m`, onInput: v => { st.loopR = v; update(); } });

  const sQP = addSlider(ctrls, { label: 'Parçacık Yükü q', min: -3, max: 3, value: st.qP, step: 0.5, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`, onInput: v => { st.qP = v || 0.5; resetParticle(); update(); } });
  const sV0 = addSlider(ctrls, { label: 'İlk Hız v_0', unit: 'm/s', min: 0.2, max: 4.0, value: st.v0, step: 0.1, fmt: v => `${v.toFixed(1)} m/s`, onInput: v => { st.v0 = v; resetParticle(); update(); } });
  const sBz = addSlider(ctrls, { label: 'Manyetik Alan B_z', unit: 'T', min: -3, max: 3, value: st.Bz, step: 0.1, fmt: v => `${v.toFixed(1)} T`, onInput: v => { st.Bz = v; resetParticle(); update(); } });
  const sEy = addSlider(ctrls, { label: 'Elektrik Alan E_y', unit: 'V/m', min: -3, max: 3, value: st.Ey, step: 0.1, fmt: v => `${v.toFixed(1)} V/m`, onInput: v => { st.Ey = v; resetParticle(); update(); } });

  let linesCache = [];
  const WORLD = 2.2;
  let geom = { W: 400, H: 340, sc: 80, cx: 200, cy: 170 };
  const w2p = (x, y) => [geom.cx + x * geom.sc, geom.cy - y * geom.sc];
  const p2w = (x, y) => [(x - geom.cx) / geom.sc, -(y - geom.cy) / geom.sc];

  const emCv = setupCanvas(cv1, w => Math.min(390, Math.max(270, w * 0.72)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    geom = { W, H, sc: Math.min(W, H) / (2 * WORLD), cx: W / 2, cy: H / 2 };
    const acc = accentColor();
    c.font = '11px "JetBrains Mono", monospace';

    if (st.mode === 'electro') {
      // Equipotential contours (marching squares on 36x36 grid)
      if (st.showEquip && st.charges.length) {
        const G = 36;
        const vals = Array.from({ length: G + 1 }, (_, j) =>
          Array.from({ length: G + 1 }, (_, i) => {
            const x = -WORLD + (2 * WORLD * i) / G;
            const y = -WORLD + (2 * WORLD * j) / G;
            return electricFieldAt(x, y, st.charges, 0.12).V;
          })
        );
        const levels = [-6e4, -3e4, -1.5e4, -6e3, 0, 6e3, 1.5e4, 3e4, 6e4];
        c.lineWidth = 1;
        for (const lv of levels) {
          c.strokeStyle = lv === 0 ? 'rgba(255,255,255,.28)' : lv > 0 ? 'rgba(255,107,107,.24)' : 'rgba(90,176,255,.24)';
          c.beginPath();
          for (let j = 0; j < G; j++) {
            for (let i = 0; i < G; i++) {
              const v00 = vals[j][i] - lv, v10 = vals[j][i + 1] - lv, v11 = vals[j + 1][i + 1] - lv, v01 = vals[j + 1][i] - lv;
              const edges = [];
              const x0 = -WORLD + (2 * WORLD * i) / G, x1 = -WORLD + (2 * WORLD * (i + 1)) / G;
              const y0 = -WORLD + (2 * WORLD * j) / G, y1 = -WORLD + (2 * WORLD * (j + 1)) / G;
              if ((v00 > 0) !== (v10 > 0)) edges.push(w2p(x0 + (x1 - x0) * (v00 / (v00 - v10)), y0));
              if ((v10 > 0) !== (v11 > 0)) edges.push(w2p(x1, y0 + (y1 - y0) * (v10 / (v10 - v11))));
              if ((v11 > 0) !== (v01 > 0)) edges.push(w2p(x0 + (x1 - x0) * (v01 / (v01 - v11)), y1));
              if ((v01 > 0) !== (v00 > 0)) edges.push(w2p(x0, y0 + (y1 - y0) * (v00 / (v00 - v01))));
              if (edges.length >= 2) { c.moveTo(edges[0][0], edges[0][1]); c.lineTo(edges[1][0], edges[1][1]); }
            }
          }
          c.stroke();
        }
      }
      // Field streamlines
      c.strokeStyle = 'rgba(244,244,245,.55)'; c.lineWidth = 1.3;
      for (const ln of linesCache) {
        c.beginPath();
        ln.pts.forEach(([x, y], k) => {
          const [px, py] = w2p(x, y);
          if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
        });
        c.stroke();
        // Mid-point direction chevron
        if (ln.pts.length > 16) {
          const mid = Math.floor(ln.pts.length * 0.35);
          const [xA, yA] = w2p(...ln.pts[mid]);
          const [xB, yB] = w2p(...ln.pts[mid + (ln.dir > 0 ? 1 : -1)]);
          drawArrow(c, xA, yA, xA + (xB - xA) * 2.2, yA + (yB - yA) * 2.2, 'rgba(244,244,245,.75)', 1.2);
        }
      }
      // Charges
      st.charges.forEach((ch, idx) => {
        const [px, py] = w2p(ch.x, ch.y);
        const col = ch.q >= 0 ? COL_BAD : COL_BLUE;
        c.fillStyle = col;
        c.beginPath(); c.arc(px, py, 14, 0, Math.PI * 2); c.fill();
        c.strokeStyle = idx === st.selIdx ? '#fff' : 'rgba(0,0,0,.6)';
        c.lineWidth = idx === st.selIdx ? 2.6 : 1.5;
        c.stroke();
        c.fillStyle = '#000'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 13px "JetBrains Mono", monospace';
        c.fillText(ch.q >= 0 ? '+' : '−', px, py);
        c.fillStyle = COL_FG; c.font = '10.5px "JetBrains Mono", monospace';
        c.fillText(`${ch.q >= 0 ? '+' : ''}${ch.q.toFixed(1)}µC`, px, py + 23);
      });
    } else if (st.mode === 'mag') {
      const N = 15;
      if (st.magKind === 'wires') {
        const wires = [{ x: -st.wireD / 2, y: 0, I: st.I1 }, { x: st.wireD / 2, y: 0, I: st.I2 }];
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const x = -WORLD * 0.92 + (1.84 * WORLD * i) / (N - 1);
            const y = -WORLD * 0.88 + (1.76 * WORLD * j) / (N - 1);
            if (wires.some(w => Math.hypot(x - w.x, y - w.y) < 0.22)) continue;
            const b = magneticFieldWires(x, y, wires, 0.05);
            if (b.Bmag < 1e-9) continue;
            const len = Math.min(18, 6 + 3.2 * Math.log10(1 + b.Bmag * 2e6));
            const [px, py] = w2p(x, y);
            const ux = b.Bx / b.Bmag, uy = -b.By / b.Bmag;
            drawArrow(c, px - ux * len * 0.5, py - uy * len * 0.5, px + ux * len * 0.5, py + uy * len * 0.5, 'rgba(90,176,255,.78)', 1.4);
          }
        }
        const fL = wireForcePerLength(st.I1, st.I2, st.wireD);
        wires.forEach((w, idx) => {
          const [px, py] = w2p(w.x, w.y);
          c.fillStyle = '#0d0d13'; c.strokeStyle = w.I >= 0 ? COL_OK : COL_WARN; c.lineWidth = 2.4;
          c.beginPath(); c.arc(px, py, 14, 0, Math.PI * 2); c.fill(); c.stroke();
          if (w.I >= 0) { c.fillStyle = COL_OK; c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill(); }
          else drawCross(c, px, py, 6, COL_WARN, 2.2);
          c.fillStyle = COL_FG; c.textAlign = 'center';
          c.fillText(`I${idx + 1}=${w.I}A`, px, py + 24);
          if (Math.abs(fL) > 1e-9) {
            const dir = (idx === 0 ? 1 : -1) * Math.sign(fL);
            drawArrow(c, px + dir * 18, py, px + dir * 48, py, COL_BAD, 2.2, 'F');
          }
        });
      } else {
        // Circular current loop in x-z meridian plane
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const x = -WORLD * 0.9 + (1.8 * WORLD * i) / (N - 1);
            const z = -WORLD * 0.85 + (1.7 * WORLD * j) / (N - 1);
            if (Math.hypot(Math.abs(x) - st.loopR, z) < 0.18) continue;
            const b = biotSavartLoop(x, z, { R: st.loopR, I: st.loopI, segments: 48 });
            if (b.Bmag < 1e-9) continue;
            const len = Math.min(18, 6 + 3.2 * Math.log10(1 + b.Bmag * 2e6));
            const [px, py] = w2p(x, z);
            const ux = b.Bx / b.Bmag, uy = -b.Bz / b.Bmag;
            drawArrow(c, px - ux * len * 0.5, py - uy * len * 0.5, px + ux * len * 0.5, py + uy * len * 0.5, 'rgba(91,228,155,.8)', 1.4);
          }
        }
        // Loop cross-section markers at (±R, 0)
        const [lx, ly] = w2p(-st.loopR, 0);
        const [rx, ry] = w2p(st.loopR, 0);
        c.strokeStyle = 'rgba(255,209,102,.45)'; c.setLineDash([4, 4]);
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(rx, ry); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#0d0d13'; c.strokeStyle = COL_WARN; c.lineWidth = 2.4;
        c.beginPath(); c.arc(lx, ly, 11, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = COL_WARN; c.beginPath(); c.arc(lx, ly, 3.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0d0d13';
        c.beginPath(); c.arc(rx, ry, 11, 0, Math.PI * 2); c.fill(); c.stroke();
        drawCross(c, rx, ry, 5, COL_WARN, 2);
      }
    } else {
      // Lorentz & Cyclotron stage
      // Background Bz grid (dots = out of page, crosses = into page)
      if (Math.abs(st.Bz) > 0.05) {
        for (let gx = 32; gx < W - 20; gx += 46) {
          for (let gy = 30; gy < H - 20; gy += 46) {
            if (st.Bz > 0) {
              c.fillStyle = 'rgba(90,176,255,.32)'; c.beginPath(); c.arc(gx, gy, 2.5, 0, Math.PI * 2); c.fill();
            } else {
              drawCross(c, gx, gy, 3.5, 'rgba(90,176,255,.32)', 1.2);
            }
          }
        }
      }
      // E-field reference arrow on left
      if (Math.abs(st.Ey) > 0.05) {
        drawArrow(c, 26, H / 2 + Math.sign(st.Ey) * 32, 26, H / 2 - Math.sign(st.Ey) * 32, COL_WARN, 2, 'E');
      }
      // Trail
      if (trail.length > 1) {
        c.strokeStyle = acc; c.lineWidth = 2.2;
        c.beginPath();
        trail.forEach(([x, y], k) => {
          const [px, py] = w2p(x, y);
          if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
        });
        c.stroke();
      }
      // Particle + velocity & Lorentz force vectors
      const [px, py] = w2p(particle.x, particle.y);
      const fx = st.qP * (st.Ex + particle.vy * st.Bz);
      const fy = st.qP * (st.Ey - particle.vx * st.Bz);
      drawArrow(c, px, py, px + particle.vx * 18, py - particle.vy * 18, COL_OK, 2, 'v');
      drawArrow(c, px, py, px + fx * 10, py - fy * 10, COL_BAD, 2, 'F');
      c.fillStyle = st.qP >= 0 ? COL_BAD : COL_BLUE;
      c.beginPath(); c.arc(px, py, 8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();
    }
  }, clean);

  // Drag charges + probe in electrostatics mode
  let dragIdx = -1;
  bindDragCanvas(cv1, {
    onDown: p => {
      if (st.mode !== 'electro') return false;
      const [wx, wy] = p2w(p.x, p.y);
      let bi = -1, bd = 0.35;
      st.charges.forEach((ch, i) => {
        const d = Math.hypot(ch.x - wx, ch.y - wy);
        if (d < bd) { bd = d; bi = i; }
      });
      if (bi >= 0) {
        dragIdx = bi; st.selIdx = bi; sSelQ.set(st.charges[bi].q);
        return true;
      }
      return false;
    },
    onMove: (p, dragging) => {
      if (st.mode !== 'electro') return;
      const [wx, wy] = p2w(p.x, p.y);
      if (dragging && dragIdx >= 0) {
        st.charges[dragIdx].x = Math.max(-1.95, Math.min(1.95, wx));
        st.charges[dragIdx].y = Math.max(-1.95, Math.min(1.95, wy));
        update();
      } else {
        const e = electricFieldAt(wx, wy, st.charges, 0.05);
        probe = e;
        probeEl.textContent = `|E| = ${fmtUnit(e.Emag, 'V/m', 2)} · V = ${fmtUnit(e.V, 'V', 2)}`;
      }
    },
    onUp: () => { dragIdx = -1; },
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    if (st.mode !== 'lorentz') return false;
    const sub = 6;
    const h = dt / sub;
    for (let k = 0; k < sub; k++) {
      particle = borisStep(particle, { q: st.qP, m: st.mP, Ex: st.Ex, Ey: st.Ey, Bz: st.Bz }, h);
    }
    trail.push([particle.x, particle.y]);
    if (trail.length > 360) trail.shift();
    if (Math.abs(particle.x) > WORLD * 1.4 || Math.abs(particle.y) > WORLD * 1.4) resetParticle();
    emCv.render();
    return playing;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    const isE = st.mode === 'electro', isM = st.mode === 'mag', isL = st.mode === 'lorentz';
    chBtns.hidden = !isE;
    sSelQ.setVisible(isE); tEquip.setVisible(isE);
    mkindSeg.hidden = !isM;
    [sI1, sI2, sWd].forEach(s => s.setVisible(isM && st.magKind === 'wires'));
    [sLI, sLR].forEach(s => s.setVisible(isM && st.magKind === 'loop'));
    [sQP, sV0, sBz, sEy].forEach(s => s.setVisible(isL));
    playBtn.hidden = !isL; resetBtn.hidden = !isL;
    syncSegments(host, false);
    if (isL && playing) loop.start(); else loop.stop();
  }

  function update() {
    if (st.mode === 'electro') {
      t1.textContent = 'Elektrik Alan Çizgileri & Eşpotansiyeller (Yükleri Sürükle)';
      linesCache = traceFieldLines(st.charges, { seedsPerCharge: 12, bounds: WORLD });
      const qNet = st.charges.reduce((s, c) => s + c.q, 0);
      const e0 = electricFieldAt(0, 0, st.charges, 0.05);
      renderKpis(kpis, [
        { lbl: 'Yük Sayısı', val: `${st.charges.length}`, sub: `Toplam q = ${qNet.toFixed(1)} µC`, tone: 'acc' },
        { lbl: 'Orijin |E(0,0)|', val: fmtUnit(e0.Emag, 'V/m') },
        { lbl: 'Orijin V(0,0)', val: fmtUnit(e0.V, 'V') },
      ]);
    } else if (st.mode === 'mag') {
      probeEl.textContent = '';
      if (st.magKind === 'wires') {
        t1.textContent = 'İki Paralel Telin Manyetik Alanı & Kuvveti';
        const fL = wireForcePerLength(st.I1, st.I2, st.wireD);
        const bMid = magneticFieldWires(0, 0, [{ x: -st.wireD / 2, y: 0, I: st.I1 }, { x: st.wireD / 2, y: 0, I: st.I2 }], 0.01);
        renderKpis(kpis, [
          { lbl: 'Birim Boy Kuvvet F/L', val: fmtUnit(Math.abs(fL), 'N/m'), sub: fL > 0 ? 'Çekme (aynı yön)' : fL < 0 ? 'İtme (zıt yön)' : 'Sıfır', tone: 'acc' },
          { lbl: 'Orta Nokta |B|', val: fmtUnit(bMid.Bmag, 'T') },
          { lbl: 'Aralık d', val: `${st.wireD.toFixed(2)} m` },
        ]);
      } else {
        t1.textContent = 'Akım Halkası Manyetik Alanı (Biot-Savart, x–z Kesiti)';
        const b0 = loopAxialFieldExact(0, { R: st.loopR, I: st.loopI });
        const bNum = biotSavartLoop(0, 0, { R: st.loopR, I: st.loopI, segments: 64 }).Bz;
        const bR = loopAxialFieldExact(st.loopR, { R: st.loopR, I: st.loopI });
        renderKpis(kpis, [
          { lbl: 'Merkez B_z(0)', val: fmtUnit(b0, 'T'), sub: `Sayısal: ${fmtUnit(bNum, 'T')}`, tone: 'acc' },
          { lbl: 'Eksende B_z(R)', val: fmtUnit(bR, 'T'), sub: 'z = R noktası' },
          { lbl: 'Manyetik Moment m', val: fmtUnit(st.loopI * Math.PI * st.loopR * st.loopR, 'A·m²') },
        ]);
      }
    } else {
      t1.textContent = 'Çapraz E ve B Alanlarında Yüklü Parçacık (Boris İntegratörü)';
      probeEl.textContent = st.Bz >= 0 ? 'B_z ⊙ (sayfadan dışa)' : 'B_z ⊗ (sayfaya içe)';
      const cyc = cyclotronMetrics({ q: st.qP, m: st.mP, v0: st.v0, Ex: st.Ex, Ey: st.Ey, Bz: st.Bz });
      renderKpis(kpis, [
        { lbl: 'Siklotron Yarıçapı r_c', val: Number.isFinite(cyc.rc) ? `${cyc.rc.toFixed(2)} m` : '∞', tone: 'acc' },
        { lbl: 'Siklotron ω_c', val: `${cyc.wc.toFixed(2)} rad/s`, sub: `T_c = ${Number.isFinite(cyc.Tc) ? cyc.Tc.toFixed(2) + ' s' : '∞'}` },
        { lbl: 'E×B Sürüklenme v_d', val: `${cyc.vDrift.toFixed(2)} m/s`, sub: `v_dx = ${cyc.vdx.toFixed(2)}` },
      ]);
    }
    emCv.render();
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
  });
  mkindSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-mk]'); if (!b) return;
    st.magKind = b.dataset.mk; mkindSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); syncMode(); update();
  });
  host.querySelector('[data-addp]').addEventListener('click', () => {
    if (st.charges.length >= 6) return;
    st.charges.push({ x: (Math.random() - 0.5) * 2.2, y: (Math.random() - 0.5) * 1.8, q: 2.5 });
    st.selIdx = st.charges.length - 1; sSelQ.set(2.5); update();
  });
  host.querySelector('[data-addn]').addEventListener('click', () => {
    if (st.charges.length >= 6) return;
    st.charges.push({ x: (Math.random() - 0.5) * 2.2, y: (Math.random() - 0.5) * 1.8, q: -2.5 });
    st.selIdx = st.charges.length - 1; sSelQ.set(-2.5); update();
  });
  host.querySelector('[data-delq]').addEventListener('click', () => {
    if (st.charges.length <= 1) return;
    st.charges.splice(st.selIdx, 1); st.selIdx = Math.max(0, st.selIdx - 1);
    sSelQ.set(st.charges[st.selIdx].q); update();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  resetBtn.addEventListener('click', () => { resetParticle(); emCv.render(); });

  bindPresets(host, EM_PRESETS, p => {
    Object.assign(st, p);
    if (p.charges) { st.charges = p.charges.map(c => ({ ...c })); st.selIdx = 0; sSelQ.set(st.charges[0].q); }
    sI1.set(st.I1); sI2.set(st.I2); sWd.set(st.wireD); sLI.set(st.loopI); sLR.set(st.loopR);
    sQP.set(st.qP); sV0.set(st.v0); sBz.set(st.Bz); sEy.set(st.Ey);
    mkindSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.mk === st.magKind));
    resetParticle(); syncMode(); update();
  });

  bindTasks(host);
  syncMode();
  update();
  syncPlayBtn(playBtn, playing);
  return clean.run;
}

// =====================================================================
// 8. ANTEN IŞIMA DİYAGRAMI (Dipole + Uniform Linear Array Polar Plot)
// =====================================================================

const ANT_PRESETS = [
  { label: 'Yarım Dalga Dipol', element: 'dipole', L_lam: 0.5, N: 1, d_lam: 0.5, steerDeg: 90 },
  { label: '4 Eleman Geniş Yan', element: 'isotropic', L_lam: 0.5, N: 4, d_lam: 0.5, steerDeg: 90 },
  { label: '8 Eleman Yönlü (60°)', element: 'dipole', L_lam: 0.5, N: 8, d_lam: 0.5, steerDeg: 60 },
  { label: 'Uçtan Işımalı (End-Fire)', element: 'isotropic', L_lam: 0.5, N: 6, d_lam: 0.25, steerDeg: 0 },
  { label: 'Izgara Lobu (d=1.2λ)', element: 'isotropic', L_lam: 0.5, N: 6, d_lam: 1.2, steerDeg: 90 },
];

function mountAntennaPattern(host, ctx) {
  const clean = createClean(ctx);
  const st = { element: 'dipole', L_lam: 0.5, N: 4, d_lam: 0.5, steerDeg: 90, dbScale: false };
  let playing = false;
  let sweepDir = 1;
  let pat = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>Dipol anten</b> ve <b>düzgün doğrusal dizinin (ULA)</b> kutupsal ışıma diyagramını faz kaydırma ile yönlendir; <b>HPBW</b>, yönlülük ve <b>ızgara loblarını (grating lobes)</b> gözle.', ANT_PRESETS)}
    <div class="sle-toolbar">
      <div class="sle-toolbar-g">
        <div class="seg" role="tablist" data-elem aria-label="Eleman tipi">
          <button type="button" data-el="isotropic">İzotropik</button>
          <button type="button" data-el="dipole" class="on">Tel Dipol</button>
        </div>
        <div class="seg" role="tablist" data-scale aria-label="Ölçek">
          <button type="button" data-sc="lin" class="on">Doğrusal</button>
          <button type="button" data-sc="db">Desibel (dB)</button>
        </div>
      </div>
      <button type="button" class="btn small" data-play></button>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Kutupsal Işıma Diyagramı |EF(θ) · AF(θ)|</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Toplam Işıma</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:${COL_BLUE}"></i>Eleman (EF)</span>
          </div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv1 aria-label="Anten kutupsal ışıma diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'AF(\\theta) = \\left|\\frac{\\sin(N\\psi/2)}{N\\sin(\\psi/2)}\\right|, \\quad \\psi = k d \\cos\\theta + \\beta, \\quad \\beta = -k d \\cos\\theta_0',
        'EF_{\\text{dipol}}(\\theta) = \\left|\\frac{\\cos(\\pi (L/\\lambda)\\cos\\theta) - \\cos(\\pi L/\\lambda)}{\\sin\\theta}\\right|, \\quad D_0 = \\frac{2}{\\int_0^\\pi F^2(\\theta)\\sin\\theta\\,d\\theta}',
        '\\text{Izgara lobu yok} \\iff \\frac{d}{\\lambda} < \\frac{1}{1 + |\\cos\\theta_0|}',
      ],
      paragraphs: [
        '**Dizi çarpanı** $N$ elemanlı doğrusal dizinin girişim desenini belirler; eleman sayısı arttıkça ana lob daralır ($\\text{HPBW}$ küçülür) ve yönlülük $D_0$ artar.',
        'Elemanlar arası ardışık faz kayması $\\beta = -2\\pi (d/\\lambda)\\cos\\theta_0$ uygulanarak hüzme mekanik döndürme olmadan elektronik olarak $\\theta_0$ açısına yönlendirilir (phased array).',
        'Aralık $d/\\lambda$ kritik sınırı aşarsa ana lobla aynı güçte istenmeyen **ızgara lobları (grating lobes)** oluşur.',
      ],
      tasks: [
        'Yarım dalga dipol ($N=1, L=0.5\\lambda$) seçip yönlülüğün $2.15\\text{ dBi}$ ve HPBW’nin $\\approx 78^\\circ$ olduğunu doğrula.',
        '8 elemanlı dizide ($d=0.5\\lambda$) yönlendirme açısını $90^\\circ$’den $30^\\circ$’ye indirip hüzme genişliğinin nasıl değiştiğini gözle.',
        'Aralığı $d = 1.1\\lambda$ yapıp ızgara lobu uyarısını ve ikinci büyük lobların çıkış açılarını incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const alertEl = host.querySelector('[data-alert]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');

  const sN = addSlider(ctrls, { label: 'Eleman Sayısı N', min: 1, max: 16, value: st.N, step: 1, fmt: v => `${Math.round(v)}`, onInput: v => { st.N = Math.round(v); update(); } });
  const sD = addSlider(ctrls, { label: 'Eleman Aralığı d / λ', min: 0.15, max: 1.6, value: st.d_lam, step: 0.05, fmt: v => `${v.toFixed(2)} λ`, onInput: v => { st.d_lam = v; update(); } });
  const sSteer = addSlider(ctrls, { label: 'Yönlendirme Açısı θ₀', min: 0, max: 180, value: st.steerDeg, step: 1, fmt: v => `${Math.round(v)}°`, onInput: v => { st.steerDeg = v; update(); } });
  const sL = addSlider(ctrls, { label: 'Dipol Uzunluğu L / λ', min: 0.05, max: 1.5, value: st.L_lam, step: 0.05, fmt: v => `${v.toFixed(2)} λ`, onInput: v => { st.L_lam = v; update(); } });

  const polarCv = setupCanvas(cv1, w => Math.min(360, Math.max(260, w * 0.72)), (c, W, H) => {
    if (!pat) return;
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.41;
    const acc = accentColor();
    c.font = '10.5px "JetBrains Mono", monospace';

    // Concentric polar rings
    for (let k = 1; k <= 4; k++) {
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.arc(cx, cy, (R * k) / 4, 0, Math.PI * 2); c.stroke();
      c.fillStyle = COL_MUTE; c.textAlign = 'left';
      const lbl = st.dbScale ? `${-40 + k * 10} dB` : `${(k * 0.25).toFixed(2)}`;
      c.fillText(lbl, cx + 4, cy - (R * k) / 4 + 11);
    }
    // Spokes every 30° (theta = 0 at top = array axis!)
    for (let deg = 0; deg < 360; deg += 30) {
      const a = (deg * Math.PI) / 180;
      c.strokeStyle = deg % 90 === 0 ? COL_AXIS : COL_GRID;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a)); c.stroke();
      if (deg <= 180) {
        c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(`${deg}°`, cx + (R + 16) * Math.sin(a), cy - (R + 16) * Math.cos(a));
      }
    }

    const rOf = (linVal, dbVal) => st.dbScale ? ((Math.max(-40, dbVal) + 40) / 40) * R : linVal * R;

    // Element factor dashed (if dipole and N > 1)
    if (st.element === 'dipole' && st.N > 1) {
      c.strokeStyle = 'rgba(90,176,255,.45)'; c.lineWidth = 1.4; c.setLineDash([4, 4]);
      c.beginPath();
      for (const sgn of [1, -1]) {
        pat.thetas.forEach((th, i) => {
          const rad = rOf(pat.ef[i], 20 * Math.log10(Math.max(1e-4, pat.ef[i])));
          const x = cx + sgn * rad * Math.sin(th), y = cy - rad * Math.cos(th);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
      }
      c.stroke(); c.setLineDash([]);
    }

    // Total pattern filled + stroked (symmetric left/right around array axis)
    c.fillStyle = 'rgba(91,228,155,.16)';
    c.strokeStyle = COL_OK; c.lineWidth = 2.3;
    c.beginPath();
    pat.thetas.forEach((th, i) => {
      const rad = rOf(pat.total[i], pat.totalDb[i]);
      const x = cx + rad * Math.sin(th), y = cy - rad * Math.cos(th);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    for (let i = pat.thetas.length - 1; i >= 0; i--) {
      const th = pat.thetas[i];
      const rad = rOf(pat.total[i], pat.totalDb[i]);
      c.lineTo(cx - rad * Math.sin(th), cy - rad * Math.cos(th));
    }
    c.closePath(); c.fill(); c.stroke();

    // Steering direction arrow
    if (st.N > 1) {
      const sRad = (st.steerDeg * Math.PI) / 180;
      drawArrow(c, cx, cy, cx + R * 1.04 * Math.sin(sRad), cy - R * 1.04 * Math.cos(sRad), acc, 1.8, 'θ₀');
    }
    // Grating lobe markers
    for (const gd of pat.gratingLobesDeg) {
      const gr = (gd * Math.PI) / 180;
      c.fillStyle = COL_BAD;
      c.beginPath(); c.arc(cx + R * 0.96 * Math.sin(gr), cy - R * 0.96 * Math.cos(gr), 4.5, 0, Math.PI * 2); c.fill();
    }
    // Array element dots along vertical axis
    const span = Math.min(R * 0.45, st.N * 6);
    for (let k = 0; k < st.N; k++) {
      const y = st.N === 1 ? cy : cy - span / 2 + (span * k) / (st.N - 1);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, y, 2.5, 0, Math.PI * 2); c.fill();
    }
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    st.steerDeg += sweepDir * dt * 28;
    if (st.steerDeg >= 165) { st.steerDeg = 165; sweepDir = -1; }
    if (st.steerDeg <= 15) { st.steerDeg = 15; sweepDir = 1; }
    sSteer.set(st.steerDeg);
    update();
    return playing;
  }, clean);

  function update() {
    const betaDeg = -360 * st.d_lam * Math.cos((st.steerDeg * Math.PI) / 180);
    pat = computeAntennaPattern({ element: st.element, L_lam: st.L_lam, N: st.N, d_lam: st.d_lam, betaDeg });
    sL.setVisible(st.element === 'dipole');
    alertEl.innerHTML = pat.hasGratingLobe
      ? `<div class="sle-alert sle-alert-warn">⚠ Izgara lobu (grating lobe) oluştu! Açılar: ${pat.gratingLobesDeg.map(a => `${a.toFixed(1)}°`).join(', ')}. Engellemek için d/λ değerini düşürün.</div>`
      : '';
    renderKpis(kpis, [
      { lbl: 'Yönlülük D₀', val: `${pat.D0dBi.toFixed(2)} dBi`, sub: `Doğrusal ${pat.D0.toFixed(2)}×`, tone: 'acc' },
      { lbl: 'HPBW (−3 dB)', val: `${pat.hpbwDeg.toFixed(1)}°`, sub: `FNBW ≈ ${pat.fnbwDeg.toFixed(1)}°` },
      { lbl: 'Yan Lob (SLL)', val: Number.isFinite(pat.sllDb) ? `${pat.sllDb.toFixed(1)} dB` : 'Yok' },
      { lbl: 'Faz Kayması β', val: `${betaDeg.toFixed(0)}°`, sub: `Ana lob @ ${pat.peakDeg.toFixed(1)}°` },
    ]);
    polarCv.render();
  }

  host.querySelector('[data-elem]').addEventListener('click', e => {
    const b = e.target.closest('[data-el]'); if (!b) return;
    st.element = b.dataset.el; host.querySelectorAll('[data-elem] button').forEach(x => x.classList.toggle('on', x === b)); update();
  });
  host.querySelector('[data-scale]').addEventListener('click', e => {
    const b = e.target.closest('[data-sc]'); if (!b) return;
    st.dbScale = b.dataset.sc === 'db'; host.querySelectorAll('[data-scale] button').forEach(x => x.classList.toggle('on', x === b)); polarCv.render();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, ANT_PRESETS, p => {
    Object.assign(st, p);
    sN.set(st.N); sD.set(st.d_lam); sSteer.set(st.steerDeg); sL.set(st.L_lam);
    host.querySelectorAll('[data-elem] button').forEach(x => x.classList.toggle('on', x.dataset.el === st.element));
    update();
  });

  bindTasks(host);
  syncPlayBtn(playBtn, playing);
  update();
  return clean.run;
}

// =====================================================================
// 9. HABERLEŞME & BER (AM / FM / PM + ASK/FSK/BPSK/QPSK & AWGN BER)
// =====================================================================

const COMM_PRESETS = [
  { label: 'AM Normal (μ=0.6)', mode: 'AM', fc: 24, fm: 2, index: 0.6 },
  { label: 'AM Aşırı (μ=1.4)', mode: 'AM', fc: 24, fm: 2, index: 1.4 },
  { label: 'Dar Bant FM (β=0.5)', mode: 'FM', fc: 26, fm: 2, index: 0.5 },
  { label: 'Geniş Bant FM (β=4.5)', mode: 'FM', fc: 26, fm: 2, index: 4.5 },
  { label: 'BPSK (6 dB)', mode: 'DIG', scheme: 'BPSK', ebN0dB: 6, numSym: 500 },
  { label: 'QPSK (7 dB)', mode: 'DIG', scheme: 'QPSK', ebN0dB: 7, numSym: 500 },
  { label: 'BFSK (8 dB)', mode: 'DIG', scheme: 'BFSK', ebN0dB: 8, numSym: 500 },
];

function mountCommunications(host, ctx) {
  const clean = createClean(ctx);
  const st = { mode: 'AM', fc: 24, fm: 2, index: 0.6, scheme: 'QPSK', ebN0dB: 6, numSym: 500, seed: 2026 };
  let digData = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>AM / FM / PM</b> modülasyon ve demodülasyonunun zaman ve frekans spektrumunu; ayrıca <b>ASK / FSK / BPSK / QPSK</b> takımyıldızı ile AWGN kanalda <b>teorik ve Monte Carlo BER</b> eğrilerini karşılaştır.', COMM_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Modülasyon modu">
        <button type="button" data-m="AM" class="on">AM</button>
        <button type="button" data-m="FM">FM</button>
        <button type="button" data-m="PM">PM</button>
        <button type="button" data-m="DIG">Sayısal & BER</button>
      </div>
      <div class="sle-toolbar-g" data-digbar hidden>
        <div class="seg" role="tablist" data-scheme aria-label="Sayısal şema">
          <button type="button" data-sc="ASK">2-ASK</button>
          <button type="button" data-sc="BFSK">BFSK</button>
          <button type="button" data-sc="BPSK">BPSK</button>
          <button type="button" data-sc="QPSK" class="on">QPSK</button>
        </div>
        <button type="button" class="btn small ghost" data-reseed>${icon('rotate')} Yeni Gürültü</button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Modüleli Dalga & Demodülasyon</h4><div class="sle-legend" data-leg1></div></div>
          <div class="sle-cv-box" data-box1>
            <canvas class="sle-cv" data-cv1 aria-label="Analog modülasyon dalga formu"></canvas>
            <canvas class="sle-cv" data-cv-const hidden aria-label="Sayısal takımyıldızı diyagramı"></canvas>
          </div>
          <div class="sle-axis-lbl" data-ax1></div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t2>Genlik Spektrumu |S(f)|</h4><div class="sle-legend" data-leg2></div></div>
          <div class="sle-cv-box">
            <canvas class="sle-cv" data-cv2 aria-label="Analog modülasyon spektrumu"></canvas>
            <canvas class="sle-cv" data-cv-ber hidden aria-label="BER performans eğrisi"></canvas>
          </div>
          <div class="sle-axis-lbl" data-ax2></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        's_{\\text{AM}}(t) = A_c[1 + \\mu m(t)]\\cos(2\\pi f_c t), \\qquad \\eta_{\\text{AM}} = \\frac{\\mu^2}{2 + \\mu^2}',
        's_{\\text{FM}}(t) = A_c\\cos\\left(2\\pi f_c t + \\beta\\sin(2\\pi f_m t)\\right), \\qquad B_C = 2(\\Delta f + f_m) = 2(\\beta+1)f_m',
        'P_{b,\\text{BPSK}} = P_{b,\\text{QPSK}} = Q\\!\\left(\\sqrt{\\frac{2E_b}{N_0}}\\right), \\qquad P_{b,\\text{BFSK}} = P_{b,\\text{ASK}} = Q\\!\\left(\\sqrt{\\frac{E_b}{N_0}}\\right)',
      ],
      paragraphs: [
        '**AM**’de modülasyon indeksi $\\mu > 1$ olursa zarf sıfırı geçip faz terslenir (**aşırı modülasyon**) ve zarf dedektörü mesajı bozar.',
        '**FM/PM** sabit zarflıdır; $\\beta$ arttıkça taşıyıcı gücü Bessel yan bantlarına dağılır ve bant genişliği **Carson kuralına** göre büyür.',
        '**Sayısal haberleşmede** BPSK ve Gray-kodlu QPSK aynı bit hata olasılığına (BER) sahiptir ancak QPSK sembol başına $2$ bit taşıdığından bant genişliği verimliliği iki katıdır; uyumlu BFSK/2-ASK ise aynı BER için $3\\text{ dB}$ daha fazla $E_b/N_0$ ister.',
      ],
      tasks: [
        'AM modunda $\\mu$’yü $0.8$’den $1.4$’e çıkarıp zarf demodülasyonundaki bozulmayı gözle.',
        'FM modunda $\\beta$’yı $0.4$’ten $5$’e artırıp spektrumdaki Bessel yan bant sayısının Carson bant genişliğiyle büyümesini incele.',
        'Sayısal modda $E_b/N_0 = 6\\text{ dB}$’de BPSK ile BFSK’nın BER değerlerini karşılaştır ($3\\text{ dB}$ fark).',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const alertEl = host.querySelector('[data-alert]');
  const digBar = host.querySelector('[data-digbar]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const cvConst = host.querySelector('[data-cv-const]');
  const cvBer = host.querySelector('[data-cv-ber]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');
  const leg1 = host.querySelector('[data-leg1]');
  const leg2 = host.querySelector('[data-leg2]');
  const ax1 = host.querySelector('[data-ax1]');
  const ax2 = host.querySelector('[data-ax2]');

  const sFc = addSlider(ctrls, { label: 'Taşıyıcı f_c', unit: 'Hz', min: 10, max: 60, value: st.fc, step: 2, onInput: v => { st.fc = v; update(); } });
  const sFm = addSlider(ctrls, { label: 'Mesaj f_m', unit: 'Hz', min: 1, max: 8, value: st.fm, step: 1, onInput: v => { st.fm = v; update(); } });
  const sIdx = addSlider(ctrls, { label: 'Modülasyon İndeksi', min: 0.1, max: 6.0, value: st.index, step: 0.1, fmt: v => v.toFixed(1), onInput: v => { st.index = v; update(); } });

  const sSnr = addSlider(ctrls, { label: 'Eb / N0', unit: 'dB', min: 0, max: 12, value: st.ebN0dB, step: 0.5, fmt: v => `${v.toFixed(1)} dB`, onInput: v => { st.ebN0dB = v; update(); } });
  const sNum = addSlider(ctrls, { label: 'Sembol Sayısı (MC)', min: 100, max: 2000, value: st.numSym, step: 100, fmt: v => `${Math.round(v)}`, onInput: v => { st.numSym = Math.round(v); update(); } });

  const constCv = setupCanvas(cvConst, w => Math.min(275, Math.max(220, w * 0.55)), (c, W, H) => {
    if (st.mode !== 'DIG' || !digData) return;
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, sc = Math.min(W, H) * 0.25;
    const px = I => cx + I * sc;
    const py = Q => cy - Q * sc;
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(16, cy); c.lineTo(W - 16, cy); c.moveTo(cx, 14); c.lineTo(cx, H - 14); c.stroke();

    // Decision boundary dashed line
    c.strokeStyle = 'rgba(255,209,102,.45)'; c.setLineDash([5, 4]); c.lineWidth = 1.4;
    c.beginPath();
    if (st.scheme === 'BPSK') { c.moveTo(px(0), 14); c.lineTo(px(0), H - 14); }
    else if (st.scheme === 'ASK') { c.moveTo(px(Math.SQRT1_2), 14); c.lineTo(px(Math.SQRT1_2), H - 14); }
    else if (st.scheme === 'BFSK') { c.moveTo(px(-1.5), py(-1.5)); c.lineTo(px(2), py(2)); }
    else { c.moveTo(px(0), 14); c.lineTo(px(0), H - 14); c.moveTo(16, py(0)); c.lineTo(W - 16, py(0)); }
    c.stroke(); c.setLineDash([]);

    // Noisy points (dots for correct, crosses for error)
    const showMax = Math.min(digData.points.length, 600);
    for (let i = 0; i < showMax; i++) {
      const pt = digData.points[i];
      const x = px(pt.I), y = py(pt.Q);
      if (pt.err) {
        drawCross(c, x, y, 3.2, COL_BAD, 1.4);
      } else {
        c.fillStyle = 'rgba(90,176,255,.55)';
        c.beginPath(); c.arc(x, y, 2.3, 0, Math.PI * 2); c.fill();
      }
    }
    // Ideal constellation diamonds
    c.font = '600 11px "JetBrains Mono", monospace';
    for (const id of digData.ideal) {
      const x = px(id.I), y = py(id.Q);
      c.fillStyle = COL_OK;
      c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath(); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = COL_FG; c.textAlign = 'center'; c.fillText(id.label, x, y - 11);
    }
    c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText('I (Eşfaz)', W - 18, cy - 6);
    c.textAlign = 'left'; c.fillText('Q (Dikey)', cx + 6, 22);
  }, clean);

  const berCv = setupCanvas(cvBer, w => Math.min(220, Math.max(175, w * 0.42)), (c, W, H) => {
    if (st.mode !== 'DIG' || !digData) return;
    c.clearRect(0, 0, W, H);
    const L = 56, R = 16, T = 14, B = 28, pw = W - L - R, ph = H - T - B;
    const minExp = -5, maxExp = 0; // 10^-5 to 1
    const mx = dB => L + (dB / 12) * pw;
    const my = ber => {
      const lg = Math.max(minExp, Math.min(maxExp, Math.log10(Math.max(1e-6, ber))));
      return T + ((maxExp - lg) / (maxExp - minExp)) * ph;
    };
    c.font = '10.5px "JetBrains Mono", monospace';
    c.strokeStyle = COL_GRID;
    for (let e = maxExp; e >= minExp; e--) {
      const y = my(Math.pow(10, e));
      c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke();
      c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(`1e${e}`, L - 6, y + 4);
    }
    for (let db = 0; db <= 12; db += 2) {
      const x = mx(db);
      c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke();
      c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${db}`, x, H - 8);
    }
    // Theoretical curve
    c.strokeStyle = COL_OK; c.lineWidth = 2.3;
    c.beginPath();
    digData.snrCurve.forEach((db, i) => {
      const x = mx(db), y = my(digData.berCurve[i]);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();
    // Operating theory dot + Monte Carlo point
    c.fillStyle = COL_OK;
    c.beginPath(); c.arc(mx(st.ebN0dB), my(digData.berTheory), 4.5, 0, Math.PI * 2); c.fill();
    if (digData.berSim > 0) {
      drawCross(c, mx(st.ebN0dB), my(digData.berSim), 6, COL_WARN, 2.4);
    }
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    const isDig = st.mode === 'DIG';
    digBar.hidden = !isDig;
    cv1.hidden = isDig; cv2.hidden = isDig;
    cvConst.hidden = !isDig; cvBer.hidden = !isDig;
    [sFc, sFm, sIdx].forEach(s => s.setVisible(!isDig));
    [sSnr, sNum].forEach(s => s.setVisible(isDig));
    if (!isDig) sIdx.setRange(0.1, st.mode === 'AM' ? 2.0 : 6.0);
    syncSegments(host, false);
  }

  function update() {
    alertEl.innerHTML = '';
    if (st.mode !== 'DIG') {
      const d = simulateAnalogMod({ mode: st.mode, fc: st.fc, fm: st.fm, index: st.index });
      t1.textContent = `${st.mode} Modüleli Sinyal s(t) ve Demodüle Edilen m̂(t)`;
      t2.textContent = 'Tek Yanlı Genlik Spektrumu |S(f)| (FFT)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(90,176,255,.55)"></i>Modüleli s(t)</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Demodüle m̂(t)</span>
        ${st.mode === 'AM' ? `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Zarf</span>` : ''}`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${accentColor()}"></i>|S(f)|</span>`;
      ax1.textContent = 'Zaman t (s)'; ax2.textContent = 'Frekans f (Hz)';
      const s1 = [
        { name: 's(t)', color: 'rgba(90,176,255,.55)', xs: d.t, ys: d.mod },
        { name: 'demod', color: COL_OK, xs: d.t, ys: d.demod },
      ];
      if (st.mode === 'AM') s1.push({ name: 'env', color: COL_WARN, xs: d.t, ys: d.env });
      safePlot(cv1, s1, { x0: 0, x1: 1, ylabel: 'Genlik', height: 220 });
      const fMax = Math.min(120, Math.max(st.fc + d.carsonBW + 8, 50));
      const cut = d.freqs.findIndex(f => f > fMax);
      const end = cut > 10 ? cut : d.freqs.length;
      safePlot(cv2, [{ name: '|S|', color: accentColor(), xs: d.freqs.slice(0, end), ys: d.mag.slice(0, end) }], { x0: 0, x1: d.freqs[end - 1], ylabel: '|S|', height: 170 });
      if (d.overmodulated) {
        alertEl.innerHTML = '<div class="sle-alert sle-alert-warn">⚠ Aşırı modülasyon (μ > 1): Zarf sıfırdan geçtiği için zarf dedektörü mesajı bozuyor!</div>';
      }
      renderKpis(kpis, [
        { lbl: 'İndeks', val: st.index.toFixed(2), sub: st.mode === 'AM' ? 'μ' : st.mode === 'FM' ? 'β = Δf/f_m' : 'k_p (rad)', tone: 'acc' },
        { lbl: 'Bant Genişliği', val: `${d.carsonBW.toFixed(1)} Hz`, sub: st.mode === 'AM' ? '2 f_m' : 'Carson 2(Δf+f_m)' },
        { lbl: st.mode === 'AM' ? 'AM Verimi η' : 'Frekans Sapması Δf', val: st.mode === 'AM' ? `${d.amEfficiency.toFixed(1)}%` : `${d.deltaF.toFixed(1)} Hz` },
        { lbl: 'Toplam Güç', val: `${d.Ptotal.toFixed(3)} W`, sub: `Taşıyıcı ${d.Pc.toFixed(2)} W` },
      ]);
    } else {
      digData = simulateDigitalMod({ scheme: st.scheme, ebN0dB: st.ebN0dB, numSymbols: st.numSym, seed: st.seed });
      t1.textContent = `${st.scheme} Takımyıldızı (AWGN · ${st.ebN0dB.toFixed(1)} dB)`;
      t2.textContent = 'Bit Hata Oranı (BER) — Teori (çizgi) vs Monte Carlo (×)';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>İdeal sembol</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>Doğru</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BAD}"></i>Hatalı (×)</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Teorik BER</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Monte Carlo (×)</span>`;
      ax1.textContent = 'I / Q Sembol Uzayı'; ax2.textContent = 'Eb / N0 (dB)';
      renderKpis(kpis, [
        { lbl: 'Teorik BER', val: digData.berTheory.toExponential(2), tone: 'acc' },
        { lbl: 'Monte Carlo BER', val: digData.berSim > 0 ? digData.berSim.toExponential(2) : '0 (hata yok)' },
        { lbl: 'Hatalı / Toplam Bit', val: `${digData.bitErrors} / ${digData.totalBits}`, tone: digData.bitErrors === 0 ? 'ok' : '' },
        { lbl: 'Bit / Sembol', val: st.scheme === 'QPSK' ? '2 bit' : '1 bit' },
      ]);
      constCv.resize();
      berCv.resize();
    }
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
  });
  host.querySelector('[data-scheme]').addEventListener('click', e => {
    const b = e.target.closest('[data-sc]'); if (!b) return;
    st.scheme = b.dataset.sc; host.querySelectorAll('[data-scheme] button').forEach(x => x.classList.toggle('on', x === b)); update();
  });
  host.querySelector('[data-reseed]').addEventListener('click', () => { st.seed = (st.seed * 1664525 + 1013904223) >>> 0; update(); });

  bindPresets(host, COMM_PRESETS, p => {
    Object.assign(st, p);
    sFc.set(st.fc); sFm.set(st.fm); sIdx.set(st.index); sSnr.set(st.ebN0dB); sNum.set(st.numSym);
    host.querySelectorAll('[data-scheme] button').forEach(x => x.classList.toggle('on', x.dataset.sc === st.scheme));
    syncMode(); update();
  });
  observeResize(host.querySelector('[data-box1]'), () => { if (st.mode !== 'DIG') update(); }, clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 10. DİJİTAL DEVRELER (Flip-Flops, 4-bit Counter, Shift Reg, K-Map)
// =====================================================================

const DIG_PRESETS = [
  { label: 'JK Toggle (J=K=1)', mode: 'ff', ffType: 'JK', J: 1, K: 1 },
  { label: '4-Bit Yukarı Sayıcı', mode: 'seq', seqKind: 'counter', up: true },
  { label: 'Johnson Kaydırma', mode: 'seq', seqKind: 'shift', shiftMode: 'johnson' },
  { label: 'K-Map: 3-Değ. Çoğunluk', mode: 'kmap', kVars: 3, kCells: [0, 0, 0, 1, 0, 1, 1, 1] },
  { label: 'K-Map: 4-Değ. Sarmalı', mode: 'kmap', kVars: 4, kCells: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0] },
  { label: 'K-Map: Fark Etmez (X)', mode: 'kmap', kVars: 4, kCells: [1, 1, 0, 0, 1, 'X', 0, 0, 0, 0, 1, 1, 0, 0, 'X', 1] },
];

function mountDigitalCircuits(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'ff',
    ffType: 'JK', D: 1, J: 1, K: 1, T: 1, Q: 0,
    ffHist: [{ clk: 0, in1: 1, in2: 1, q: 0 }],
    seqKind: 'counter', up: true, enable: true, count: 0,
    shiftMode: 'johnson', din: 1, bits: [0, 0, 0, 0],
    seqHist: [{ q: [0, 0, 0, 0], din: 1 }],
    kVars: 4,
    kCells: [1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 'X', 1, 1],
  };
  let autoClk = false;
  let clkAccum = 0;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>D / JK / T flip-flop</b>, <b>4-bit sayıcı</b> ve <b>kaydırmalı yazmacı</b> saat darbeleriyle adım adım sür ve <b>zamanlama diyagramını</b> izle; <b>Karnaugh haritasında</b> hücrelere tıklayıp en sade Boole ifadesini bul.', DIG_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Dijital mod">
        <button type="button" data-m="ff" class="on">Flip-Flop (D/JK/T)</button>
        <button type="button" data-m="seq">4-Bit Sayıcı & Yazmaç</button>
        <button type="button" data-m="kmap">Karnaugh Haritası</button>
      </div>
      <div class="sle-toolbar-g" data-clkbar>
        <button type="button" class="btn small primary" data-step>${icon('play')} Saat Darbesi ↑</button>
        <button type="button" class="btn small" data-auto></button>
        <button type="button" class="btn small ghost" data-clr>${icon('rotate')} Sıfırla</button>
      </div>
    </div>
    <div data-body></div>
    ${theoryAndTasksHtml({
      equations: [
        'Q_{n+1}^{D} = D, \\qquad Q_{n+1}^{JK} = J\\overline{Q}_n + \\overline{K}Q_n, \\qquad Q_{n+1}^{T} = T \\oplus Q_n',
        '\\text{4-Bit Sayıcı: } f_{Q_k} = \\frac{f_{\\text{CLK}}}{2^{k+1}}, \\qquad \\text{Johnson (4-bit): } 2N = 8\\text{ durum}',
      ],
      paragraphs: [
        '**Kenar tetiklemeli flip-floplar** yalnızca yükselen saat kenarında (↑) girişlerini örnekler ve bir sonraki darbeye kadar durumu saklar.',
        '**4-bit ikili sayıcıda** her bit bir öncekinin yarı frekansında değişir; **Johnson yazmacında** $\\overline{Q_3}$ çıkışı girişe geri beslenerek $8$ kararlı durumlu Gray-benzeri bir döngü oluşur.',
        '**Karnaugh haritası** komşu hücrelerin yalnızca tek bir bitte değiştiği **Gray kodu** düzenini kullanır; $2^k$ büyüklüğündeki (kenarlardan sarmalı dahil) dikdörtgen gruplar **Quine–McCluskey** algoritmasıyla minimum Çarpımlar Toplamı (SOP) biçimine indirgenir.',
      ],
      tasks: [
        'JK flip-flopta $(J,K) = (0,0), (1,0), (0,1), (1,1)$ kombinasyonlarına saat darbesi verip tut/kur/sıfırla/tersle davranışlarını gözle.',
        '4-bit sayıcıda $Q_0, Q_1, Q_2, Q_3$ zamanlama dalgalarının frekans bölme oranlarını ($f/2, f/4, f/8, f/16$) say.',
        '4 değişkenli K-Map’te dört köşe hücresini ($m_0, m_2, m_8, m_{10}$) 1 yapıp tek sarmalı grup $\\bar{B}\\bar{D}$ sonucunu doğrula.',
      ],
    })}
  </div>`;

  const body = host.querySelector('[data-body]');
  const clkBar = host.querySelector('[data-clkbar]');
  const autoBtn = host.querySelector('[data-auto]');

  const doClockStep = () => {
    if (st.mode === 'ff') {
      st.Q = stepFlipFlop(st.ffType, st.Q, { D: st.D, J: st.J, K: st.K, T: st.T });
      const in1 = st.ffType === 'D' ? st.D : st.ffType === 'T' ? st.T : st.J;
      const in2 = st.ffType === 'JK' ? st.K : 0;
      st.ffHist.push({ clk: st.ffHist.length, in1, in2, q: st.Q });
      if (st.ffHist.length > 16) st.ffHist.shift();
    } else if (st.mode === 'seq') {
      if (st.seqKind === 'counter') {
        st.count = stepCounter4(st.count, { up: st.up, enable: st.enable });
        const q = [st.count & 1, (st.count >> 1) & 1, (st.count >> 2) & 1, (st.count >> 3) & 1];
        st.seqHist.push({ q, din: 0 });
      } else {
        st.bits = stepShiftReg4(st.bits, { mode: st.shiftMode, din: st.din });
        st.seqHist.push({ q: st.bits.slice(), din: st.din });
      }
      if (st.seqHist.length > 16) st.seqHist.shift();
    }
    renderBody();
  };

  const loop = createAnimLoop((_, dt) => {
    clkAccum += dt;
    if (clkAccum >= 0.7) {
      clkAccum = 0;
      doClockStep();
    }
    return autoClk;
  }, clean);

  function drawTimingCanvas(cv, channels) {
    const W = Math.max(260, cv.parentElement?.clientWidth || 340);
    const rowH = 38;
    const H = channels.length * rowH + 18;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const L = 46, R = 12, pw = W - L - R;
    const N = Math.max(2, channels[0].vals.length);
    const stepW = pw / Math.max(8, N);
    c.font = '600 11px "JetBrains Mono", monospace';

    // Vertical clock edge guides
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
    for (let k = 0; k <= N; k++) {
      const x = L + k * stepW;
      c.beginPath(); c.moveTo(x, 6); c.lineTo(x, H - 8); c.stroke();
    }

    channels.forEach((ch, r) => {
      const yBase = 10 + r * rowH;
      const yHi = yBase + 6, yLo = yBase + rowH - 8;
      c.fillStyle = ch.color; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText(ch.label, L - 8, (yHi + yLo) / 2);

      c.strokeStyle = ch.color; c.lineWidth = 2;
      c.beginPath();
      if (ch.isClock) {
        for (let k = 0; k < N; k++) {
          const x0 = L + k * stepW, xm = x0 + stepW * 0.5, x1 = x0 + stepW;
          if (k === 0) c.moveTo(x0, yLo);
          c.lineTo(x0, yHi); c.lineTo(xm, yHi); c.lineTo(xm, yLo); c.lineTo(x1, yLo);
        }
      } else {
        ch.vals.forEach((v, k) => {
          const x0 = L + k * stepW, x1 = x0 + stepW;
          const y = v ? yHi : yLo;
          if (k === 0) c.moveTo(x0, y);
          else c.lineTo(x0, y);
          c.lineTo(x1, y);
        });
      }
      c.stroke();
    });
  }

  function renderBody() {
    clkBar.hidden = st.mode === 'kmap';
    if (st.mode === 'kmap' && autoClk) { autoClk = false; loop.stop(); syncPlayBtn(autoBtn, false); }

    if (st.mode === 'ff') {
      body.innerHTML = `<div class="sle-col">
        <div class="sle-panel">
          <div class="sle-toolbar">
            <div class="seg" role="tablist" data-fft aria-label="Flip-Flop türü">
              <button type="button" data-ft="D" class="${st.ffType === 'D' ? 'on' : ''}">D Flip-Flop</button>
              <button type="button" data-ft="JK" class="${st.ffType === 'JK' ? 'on' : ''}">JK Flip-Flop</button>
              <button type="button" data-ft="T" class="${st.ffType === 'T' ? 'on' : ''}">T Flip-Flop</button>
            </div>
            <div class="sle-toolbar-g">
              ${st.ffType === 'D' ? `<button type="button" class="sle-bit-btn ${st.D ? 'sle-on' : ''}" data-tog="D">D = ${st.D}</button>` : ''}
              ${st.ffType === 'T' ? `<button type="button" class="sle-bit-btn ${st.T ? 'sle-on' : ''}" data-tog="T">T = ${st.T}</button>` : ''}
              ${st.ffType === 'JK' ? `<button type="button" class="sle-bit-btn ${st.J ? 'sle-on' : ''}" data-tog="J">J = ${st.J}</button>
                <button type="button" class="sle-bit-btn ${st.K ? 'sle-on' : ''}" data-tog="K">K = ${st.K}</button>` : ''}
            </div>
          </div>
          <div class="sle-leds">
            <div class="sle-led-box"><div class="sle-led ${st.Q ? 'sle-led-on' : ''}">${st.Q}</div><span class="sle-kpi-lbl">Q</span></div>
            <div class="sle-led-box"><div class="sle-led ${st.Q ? '' : 'sle-led-on'}">${st.Q ^ 1}</div><span class="sle-kpi-lbl">Q̄</span></div>
          </div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Zamanlama Diyagramı (Yükselen Kenar ↑)</h4></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-tcv aria-label="Flip-flop zamanlama diyagramı"></canvas></div>
        </div>
      </div>`;
      body.querySelector('[data-fft]')?.addEventListener('click', e => {
        const b = e.target.closest('[data-ft]'); if (!b) return;
        st.ffType = b.dataset.ft; st.ffHist = [{ clk: 0, in1: st.D, in2: st.K, q: st.Q }]; renderBody();
      });
      body.querySelectorAll('[data-tog]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.tog; st[k] = st[k] ^ 1; renderBody();
      }));
      const chs = [{ label: 'CLK', isClock: true, vals: st.ffHist.map(() => 1), color: COL_MUTE }];
      if (st.ffType === 'D') chs.push({ label: 'D', vals: st.ffHist.map(h => h.in1), color: COL_BLUE });
      else if (st.ffType === 'T') chs.push({ label: 'T', vals: st.ffHist.map(h => h.in1), color: COL_BLUE });
      else {
        chs.push({ label: 'J', vals: st.ffHist.map(h => h.in1), color: COL_BLUE });
        chs.push({ label: 'K', vals: st.ffHist.map(h => h.in2), color: COL_WARN });
      }
      chs.push({ label: 'Q', vals: st.ffHist.map(h => h.q), color: COL_OK });
      drawTimingCanvas(body.querySelector('[data-tcv]'), chs);
    } else if (st.mode === 'seq') {
      const qBits = st.seqKind === 'counter'
        ? [st.count & 1, (st.count >> 1) & 1, (st.count >> 2) & 1, (st.count >> 3) & 1]
        : st.bits;
      const decVal = qBits[0] + 2 * qBits[1] + 4 * qBits[2] + 8 * qBits[3];
      body.innerHTML = `<div class="sle-col">
        <div class="sle-panel">
          <div class="sle-toolbar">
            <div class="seg" role="tablist" data-sqk aria-label="Ardışıl devre türü">
              <button type="button" data-sk="counter" class="${st.seqKind === 'counter' ? 'on' : ''}">4-Bit Sayıcı</button>
              <button type="button" data-sk="shift" class="${st.seqKind === 'shift' ? 'on' : ''}">4-Bit Kaydırmalı Yazmaç</button>
            </div>
            <div class="sle-toolbar-g">
              ${st.seqKind === 'counter'
                ? `<button type="button" class="sle-bit-btn ${st.up ? 'sle-on' : ''}" data-up>${st.up ? 'Yukarı (+1)' : 'Aşağı (−1)'}</button>`
                : `<div class="seg" data-shm><button type="button" data-sm="SIPO" class="${st.shiftMode === 'SIPO' ? 'on' : ''}">SIPO</button>
                    <button type="button" data-sm="ring" class="${st.shiftMode === 'ring' ? 'on' : ''}">Halka</button>
                    <button type="button" data-sm="johnson" class="${st.shiftMode === 'johnson' ? 'on' : ''}">Johnson</button></div>
                   ${st.shiftMode === 'SIPO' ? `<button type="button" class="sle-bit-btn ${st.din ? 'sle-on' : ''}" data-din>D_in = ${st.din}</button>` : ''}`}
            </div>
          </div>
          <div class="sle-leds">
            ${[3, 2, 1, 0].map(i => `<div class="sle-led-box"><div class="sle-led ${qBits[i] ? 'sle-led-on' : ''}">${qBits[i]}</div><span class="sle-kpi-lbl">Q${i}</span></div>`).join('')}
            <div class="sle-kpi sle-kpi-acc"><span class="sle-kpi-lbl">Ondalık / Hex</span><b class="sle-kpi-val">${decVal} · 0x${decVal.toString(16).toUpperCase()}</b></div>
          </div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">4-Kanal Zamanlama Diyagramı</h4></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-tcv aria-label="4-bit zamanlama diyagramı"></canvas></div>
        </div>
      </div>`;
      body.querySelector('[data-sqk]')?.addEventListener('click', e => {
        const b = e.target.closest('[data-sk]'); if (!b) return;
        st.seqKind = b.dataset.sk; st.seqHist = [{ q: [0, 0, 0, 0], din: st.din }]; st.count = 0; st.bits = [0, 0, 0, 0]; renderBody();
      });
      body.querySelector('[data-up]')?.addEventListener('click', () => { st.up = !st.up; renderBody(); });
      body.querySelector('[data-din]')?.addEventListener('click', () => { st.din ^= 1; renderBody(); });
      body.querySelector('[data-shm]')?.addEventListener('click', e => {
        const b = e.target.closest('[data-sm]'); if (!b) return;
        st.shiftMode = b.dataset.sm;
        st.bits = st.shiftMode === 'ring' ? [1, 0, 0, 0] : [0, 0, 0, 0];
        st.seqHist = [{ q: st.bits.slice(), din: st.din }]; renderBody();
      });
      const chs = [
        { label: 'CLK', isClock: true, vals: st.seqHist.map(() => 1), color: COL_MUTE },
        { label: 'Q0', vals: st.seqHist.map(h => h.q[0]), color: COL_OK },
        { label: 'Q1', vals: st.seqHist.map(h => h.q[1]), color: COL_BLUE },
        { label: 'Q2', vals: st.seqHist.map(h => h.q[2]), color: COL_WARN },
        { label: 'Q3', vals: st.seqHist.map(h => h.q[3]), color: COL_PURP },
      ];
      drawTimingCanvas(body.querySelector('[data-tcv]'), chs);
    } else {
      // Karnaugh Map Simplifier (2, 3, 4 variables)
      const n = st.kVars;
      const N = 1 << n;
      while (st.kCells.length < N) st.kCells.push(0);
      const cells = st.kCells.slice(0, N);
      const km = simplifyKMap(n, cells);

      const gray2 = [0, 1];
      const gray4 = [0, 1, 3, 2];
      const rowBits = n === 4 ? gray4 : gray2;
      const colBits = n === 2 ? gray2 : gray4;
      const rowLbl = n === 4 ? 'AB \\ CD' : n === 3 ? 'A \\ BC' : 'A \\ B';
      const fmtBits = (v, len) => v.toString(2).padStart(len, '0');
      const rLen = n === 4 ? 2 : 1;
      const cLen = n === 2 ? 1 : 2;

      body.innerHTML = `<div class="sle-col">
        <div class="sle-panel">
          <div class="sle-toolbar">
            <div class="seg" role="tablist" data-kv aria-label="Değişken sayısı">
              ${[2, 3, 4].map(v => `<button type="button" data-n="${v}" class="${n === v ? 'on' : ''}">${v} Değişken</button>`).join('')}
            </div>
            <div class="sle-toolbar-g">
              <button type="button" class="btn small ghost" data-kzero>Tümünü 0 Yap</button>
              <button type="button" class="btn small ghost" data-krand>Rastgele</button>
            </div>
          </div>
          <p class="sle-hint">Hücreye dokunarak <b>0 → 1 → X (fark etmez)</b> döngüsünü değiştir. Noktalar hücrenin ait olduğu sadeleştirme gruplarını gösterir.</p>
          <div class="sle-table-wrap">
            <table class="sle-kmap-tbl" aria-label="Karnaugh haritası">
              <thead><tr><th>${rowLbl}</th>${colBits.map(cb => `<th scope="col">${fmtBits(cb, cLen)}</th>`).join('')}</tr></thead>
              <tbody>
                ${rowBits.map(rb => `<tr><th scope="row">${fmtBits(rb, rLen)}</th>${colBits.map(cb => {
                  const m = (rb << cLen) | cb;
                  const val = cells[m];
                  const cls = val === 1 ? 'sle-k1' : val === 'X' ? 'sle-kx' : '';
                  const gDots = km.groups.map((g, gi) => g.cells.includes(m) ? `<i class="sle-kmap-dot" style="background:${GROUP_COLORS[gi % GROUP_COLORS.length]}"></i>` : '').join('');
                  return `<td><button type="button" class="sle-kmap-cell ${cls}" data-cell="${m}" aria-label="Minterm ${m}, değer ${val}"><span class="sle-kmap-idx">${m}</span>${val}<span class="sle-kmap-dots">${gDots}</span></button></td>`;
                }).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="sle-eq-box" aria-live="polite">${tex(`F(${km.vars.join(',')}) = ${km.tex}`, true)}</div>
          <div class="sle-group-tags">
            ${km.groups.map((g, gi) => `<span class="sle-group-tag" style="border-color:${GROUP_COLORS[gi % GROUP_COLORS.length]}"><i class="sle-kmap-dot" style="background:${GROUP_COLORS[gi % GROUP_COLORS.length]}"></i>${esc(g.term)} <span class="mute">m(${g.cells.join(',')})</span></span>`).join('') || '<span class="sle-hint">Hiç 1 hücresi seçili değil.</span>'}
          </div>
          <div class="sle-kpis">
            <div class="sle-kpi sle-kpi-acc"><span class="sle-kpi-lbl">Minimum İfade</span><b class="sle-kpi-val">${esc(km.expression)}</b></div>
            <div class="sle-kpi"><span class="sle-kpi-lbl">Grup Sayısı</span><b class="sle-kpi-val">${km.groups.length}</b><span class="sle-kpi-sub">${km.literalCount} literal</span></div>
            <div class="sle-kpi"><span class="sle-kpi-lbl">Mintermler Σm</span><b class="sle-kpi-val">${km.minterms.join(', ') || '—'}</b></div>
          </div>
        </div>
      </div>`;

      body.querySelector('[data-kv]')?.addEventListener('click', e => {
        const b = e.target.closest('[data-n]'); if (!b) return;
        st.kVars = +b.dataset.n;
        st.kCells = Array.from({ length: 1 << st.kVars }, (_, i) => st.kCells[i] ?? 0);
        renderBody();
      });
      body.querySelectorAll('[data-cell]').forEach(b => b.addEventListener('click', () => {
        const idx = +b.dataset.cell;
        const cur = st.kCells[idx];
        st.kCells[idx] = cur === 0 ? 1 : cur === 1 ? 'X' : 0;
        renderBody();
      }));
      body.querySelector('[data-kzero]')?.addEventListener('click', () => { st.kCells = new Array(1 << st.kVars).fill(0); renderBody(); });
      body.querySelector('[data-krand]')?.addEventListener('click', () => {
        st.kCells = Array.from({ length: 1 << st.kVars }, () => { const r = Math.random(); return r < 0.48 ? 1 : r < 0.88 ? 0 : 'X'; });
        renderBody();
      });
    }
    syncSegments(host, true);
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x === b));
    renderBody();
  });
  host.querySelector('[data-step]').addEventListener('click', doClockStep);
  autoBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    autoClk = !autoClk; syncPlayBtn(autoBtn, autoClk);
    if (autoClk) { clkAccum = 0; loop.start(); } else loop.stop();
  });
  host.querySelector('[data-clr]').addEventListener('click', () => {
    st.Q = 0; st.ffHist = [{ clk: 0, in1: st.D, in2: st.K, q: 0 }];
    st.count = 0; st.bits = st.shiftMode === 'ring' ? [1, 0, 0, 0] : [0, 0, 0, 0];
    st.seqHist = [{ q: st.bits.slice(), din: st.din }];
    renderBody();
  });
  bindPresets(host, DIG_PRESETS, p => {
    Object.assign(st, p);
    if (p.kCells) st.kCells = p.kCells.slice();
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x.dataset.m === st.mode));
    st.count = 0; st.bits = [0, 0, 0, 0]; st.seqHist = [{ q: [0, 0, 0, 0], din: st.din }];
    renderBody();
  });

  observeResize(body, () => { if (st.mode !== 'kmap') renderBody(); }, clean);
  bindTasks(host);
  syncPlayBtn(autoBtn, autoClk);
  renderBody();
  return clean.run;
}

// =====================================================================
// 11. PID KONTROL (4 Plants, Z-N Tuning, Disturbance, Saturation + Anti-Windup)
// =====================================================================

const PID_PRESETS = [
  { label: 'Sadece P (Kalıcı Hata)', plant: 'first', Kp: 2.5, Ki: 0, Kd: 0, tau: 1.2, wn: 2, zeta: 0.4, L: 0.5, disturbance: 0, saturate: false, uMax: 5, antiWindup: true },
  { label: 'Dengeli PID (2. Derece)', plant: 'second', Kp: 4.0, Ki: 3.5, Kd: 1.2, tau: 1, wn: 2.0, zeta: 0.35, L: 0.5, disturbance: -0.4, saturate: false, uMax: 5, antiWindup: true },
  { label: 'FOPDT Ölü Zaman', plant: 'fopdt', Kp: 2.2, Ki: 1.8, Kd: 0.4, tau: 1.5, wn: 2, zeta: 0.4, L: 0.6, disturbance: -0.3, saturate: false, uMax: 5, antiWindup: true },
  { label: 'Doygunluk & Windup', plant: 'second', Kp: 5.0, Ki: 7.0, Kd: 0.6, tau: 1, wn: 2.0, zeta: 0.35, L: 0.5, disturbance: 0, saturate: true, uMax: 1.6, antiWindup: false },
  { label: 'DC Motor Hız Kontrolü', plant: 'dcmotor', Kp: 8.0, Ki: 16.0, Kd: 0.4, tau: 1, wn: 2, zeta: 0.4, L: 0.5, disturbance: -0.8, saturate: true, uMax: 12, antiWindup: true },
];

function mountPIDControl(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    plant: 'second', Kp: 4.0, Ki: 3.5, Kd: 1.2,
    tau: 1.2, wn: 2.0, zeta: 0.35, L: 0.6,
    disturbance: -0.4, saturate: false, uMax: 3.0, antiWindup: true,
  };

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Dört farklı tesis modeli için <b>P / I / D</b> kazançlarını canlı ayarla; <b>Ziegler–Nichols</b> ile otomatik ayarla, yük bozucusu ile <b>aktüatör doygunluğu + anti-windup</b> etkisini karşılaştır.', PID_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-plant aria-label="Tesis modeli">
        <button type="button" data-pl="first">1. Derece</button>
        <button type="button" data-pl="second" class="on">2. Derece</button>
        <button type="button" data-pl="fopdt">Ölü Zaman (FOPDT)</button>
        <button type="button" data-pl="dcmotor">DC Motor</button>
      </div>
      <button type="button" class="btn small primary" data-zn>${icon('sparkle')} Ziegler–Nichols Ayarla</button>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div data-zn-info></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Kapalı Döngü Basamak Cevabı y(t)</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Çıkış y(t)</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,255,255,.35)"></i>Referans r(t) = 1</span>
          </div></div>
          <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="PID basamak cevabı"></canvas><div class="sle-readout" data-rd1></div></div>
          <div class="sle-axis-lbl">Zaman t (s) · Bozucu t ≈ 6.6 s anında uygulanır</div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Kontrol İşareti u(t)</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>Uygulanan u(t)</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Doyum Sınırı ±u_max</span>
          </div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Kontrol işareti u(t)"></canvas><div class="sle-readout" data-rd2></div></div>
          <div class="sle-axis-lbl">Zaman t (s)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'u(t) = K_p e(t) + K_i \\int_0^t e(\\tau)\\,d\\tau + K_d \\frac{de}{dt}, \\qquad e(t) = r(t) - y(t)',
        '\\dot{x}_i = K_i e + \\frac{1}{T_t}\\left(u_{\\text{sat}} - u_{\\text{ham}}\\right) \\quad (\\text{Geri-hesaplamalı Anti-Windup})',
        '\\text{Z–N (FOPDT): } K_p = \\frac{1.2\\tau}{K L}, \\quad T_i = 2L, \\quad T_d = 0.5L',
      ],
      paragraphs: [
        '**Oransal ($K_p$)** yükselme hızını artırır ancak tek başına kalıcı durum hatası bırakır; **İntegral ($K_i$)** kalıcı hatayı ve sabit yük bozucularını sıfırlar; **Türev ($K_d$)** sönümleme ekleyerek aşımı azaltır.',
        'Aktüatör sınırda ($\\pm u_{\\max}$) doyuma girdiğinde integral terimi kontrolsüz büyür (**integrator windup**) ve büyük aşıma yol açar; **anti-windup** geri-hesaplama terimi integratörü sınırda tutarak hızlı toparlanma sağlar.',
      ],
      tasks: [
        '1. derece tesiste $K_i = 0, K_p = 3$ yapıp kalıcı değerin tam $K_p/(1+K_p) = 0.75$ olduğunu gör, sonra $K_i > 0$ ekleyip hatayı sıfırla.',
        'Doygunluk & Windup senaryosunu aç, ardından **Anti-Windup** kutucuğunu açıp kapatarak aşım ($M_p\\%$) farkını karşılaştır.',
        'FOPDT modunda ölü zamanı $L = 1.0\\text{ s}$ yap ve **Ziegler–Nichols Ayarla** düğmesinin önerdiği kazançların cevabını incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const znInfo = host.querySelector('[data-zn-info]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sKp = addSlider(ctrls, { label: 'Oransal K_p', min: 0, max: 20, value: st.Kp, step: 0.1, fmt: v => v.toFixed(2), onInput: v => { st.Kp = v; update(); } });
  const sKi = addSlider(ctrls, { label: 'İntegral K_i', min: 0, max: 25, value: st.Ki, step: 0.1, fmt: v => v.toFixed(2), onInput: v => { st.Ki = v; update(); } });
  const sKd = addSlider(ctrls, { label: 'Türev K_d', min: 0, max: 6, value: st.Kd, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.Kd = v; update(); } });
  const div = document.createElement('div'); div.className = 'sle-divider'; ctrls.append(div);
  const sTau = addSlider(ctrls, { label: 'Zaman Sabiti τ', unit: 's', min: 0.2, max: 4.0, value: st.tau, step: 0.1, fmt: v => `${v.toFixed(1)} s`, onInput: v => { st.tau = v; update(); } });
  const sWn = addSlider(ctrls, { label: 'Doğal Frekans ω_n', unit: 'rad/s', min: 0.6, max: 6.0, value: st.wn, step: 0.1, fmt: v => `${v.toFixed(1)} rad/s`, onInput: v => { st.wn = v; update(); } });
  const sZeta = addSlider(ctrls, { label: 'Sönüm Oranı ζ', min: 0.05, max: 1.5, value: st.zeta, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.zeta = v; update(); } });
  const sL = addSlider(ctrls, { label: 'Ölü Zaman L', unit: 's', min: 0.1, max: 1.8, value: st.L, step: 0.05, fmt: v => `${v.toFixed(2)} s`, onInput: v => { st.L = v; update(); } });
  const div2 = document.createElement('div'); div2.className = 'sle-divider'; ctrls.append(div2);
  const sDist = addSlider(ctrls, { label: 'Yük Bozucu d', min: -1.5, max: 1.5, value: st.disturbance, step: 0.1, fmt: v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`, onInput: v => { st.disturbance = v; update(); } });
  const tSat = addToggle(ctrls, 'Aktüatör doygunluğu (±u_max)', st.saturate, v => { st.saturate = v; sUMax.setVisible(v); tAw.setVisible(v); update(); });
  const sUMax = addSlider(ctrls, { label: 'Doyum Sınırı u_max', min: 1.0, max: 15.0, value: st.uMax, step: 0.2, fmt: v => `±${v.toFixed(1)}`, onInput: v => { st.uMax = v; update(); } });
  const tAw = addToggle(ctrls, 'Anti-Windup (Geri Hesaplama)', st.antiWindup, v => { st.antiWindup = v; update(); });

  function syncPlantCtrls() {
    host.querySelectorAll('[data-plant] button').forEach(b => b.classList.toggle('on', b.dataset.pl === st.plant));
    sTau.setVisible(st.plant === 'first' || st.plant === 'fopdt');
    sL.setVisible(st.plant === 'fopdt');
    sWn.setVisible(st.plant === 'second');
    sZeta.setVisible(st.plant === 'second');
    sUMax.setVisible(st.saturate);
    tAw.setVisible(st.saturate);
    syncSegments(host, false);
  }

  function update() {
    const res = simulatePID({ ...st, tEnd: 12, dt: 0.01 });
    safePlot(cv1, [
      { name: 'r(t)', color: 'rgba(255,255,255,.32)', xs: res.t, ys: res.r },
      { name: 'y(t)', color: COL_OK, xs: res.t, ys: res.y },
    ], { x0: 0, x1: 12, ylabel: 'y(t)', height: 225 });
    const uSeries = [{ name: 'u(t)', color: COL_BLUE, xs: res.t, ys: res.u }];
    if (st.saturate) {
      uSeries.push({ name: '+umax', color: 'rgba(255,209,102,.5)', xs: [0, 12], ys: [st.uMax, st.uMax] });
      uSeries.push({ name: '-umax', color: 'rgba(255,209,102,.5)', xs: [0, 12], ys: [-st.uMax, -st.uMax] });
    }
    safePlot(cv2, uSeries, { x0: 0, x1: 12, ylabel: 'u(t)', height: 155 });

    renderKpis(kpis, [
      { lbl: 'Aşım M_p', val: `${res.overshootPct.toFixed(1)}%`, tone: res.overshootPct < 15 ? 'ok' : res.overshootPct > 35 ? 'bad' : 'warn' },
      { lbl: 'Yükselme t_r', val: res.riseTime !== null ? `${res.riseTime.toFixed(2)} s` : '—' },
      { lbl: 'Yerleşme t_s (%2)', val: res.settlingTime !== null ? `${res.settlingTime.toFixed(2)} s` : '> 12 s' },
      { lbl: 'Kalıcı Hata e_ss', val: fmtFix(res.steadyError, 4), tone: Math.abs(res.steadyError) < 0.02 ? 'ok' : 'warn' },
      { lbl: 'IAE', val: res.iae.toFixed(2), sub: `t_tepe = ${res.tPeak.toFixed(2)} s` },
    ]);
  }

  host.querySelector('[data-plant]').addEventListener('click', e => {
    const b = e.target.closest('[data-pl]'); if (!b || b.dataset.pl === st.plant) return;
    st.plant = b.dataset.pl; znInfo.innerHTML = ''; syncPlantCtrls(); update();
  });
  host.querySelector('[data-zn]').addEventListener('click', () => {
    const zn = zieglerNicholsTune(st);
    st.Kp = Math.min(20, zn.Kp); st.Ki = Math.min(25, zn.Ki); st.Kd = Math.min(6, zn.Kd);
    sKp.set(st.Kp); sKi.set(st.Ki); sKd.set(st.Kd);
    znInfo.innerHTML = `<div class="sle-alert sle-alert-ok">✦ ${esc(zn.method)}: K_p = ${st.Kp.toFixed(2)}, K_i = ${st.Ki.toFixed(2)}, K_d = ${st.Kd.toFixed(2)}</div>`;
    update();
  });
  bindPresets(host, PID_PRESETS, p => {
    Object.assign(st, p); znInfo.innerHTML = '';
    sKp.set(st.Kp); sKi.set(st.Ki); sKd.set(st.Kd); sTau.set(st.tau); sWn.set(st.wn); sZeta.set(st.zeta); sL.set(st.L);
    sDist.set(st.disturbance); tSat.set(st.saturate); sUMax.set(st.uMax); tAw.set(st.antiWindup);
    syncPlantCtrls(); update();
  });
  attachReadout(cv1, host.querySelector('[data-rd1]'), (x, s, i) => `t = ${x.toFixed(2)} s · y = ${s[1].ys[i].toFixed(3)}`, clean);
  attachReadout(cv2, host.querySelector('[data-rd2]'), (x, s, i) => `t = ${x.toFixed(2)} s · u = ${s[0].ys[i].toFixed(3)}`, clean);
  observeResize(host.querySelector('[data-box1]'), update, clean);
  bindTasks(host);
  syncPlantCtrls();
  update();
  return clean.run;
}

// =====================================================================
// 12. KÖK YER EĞRİSİ (Draggable Open-Loop Poles/Zeros + Gain K + Step)
// =====================================================================

const RL_PRESETS = [
  { label: '2 Kutuplu (Tip 1)', poles: [C(0, 0), C(-2, 0)], zeros: [], K: 2.0, kMax: 20 },
  { label: '3 Kutuplu (K_krit = 6)', poles: [C(0, 0), C(-1, 0), C(-2, 0)], zeros: [], K: 2.5, kMax: 16 },
  { label: 'Lead Sıfır Eklemeli', poles: [C(0, 0), C(-1, 0), C(-3, 0)], zeros: [C(-1.5, 0)], K: 6.0, kMax: 30 },
  { label: 'Kompleks Kutuplar', poles: [C(-1, 2), C(-1, -2), C(-3, 0)], zeros: [], K: 4.0, kMax: 30 },
];

function mountRootLocus(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    poles: [C(0, 0), C(-1, 0), C(-2, 0)],
    zeros: [],
    K: 2.5,
    kMax: 16,
  };
  let rlData = null, clData = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('s-düzlemindeki açık döngü <b>kutuplarını (×)</b> ve <b>sıfırlarını (○)</b> doğrudan sürükle; kök yer eğrisini, asimptotları ve kazanç $K$ değiştikçe <b>kapalı döngü basamak cevabını</b> anında izle.', RL_PRESETS)}
    <div class="sle-toolbar">
      <div class="sle-toolbar-g">
        <button type="button" class="btn small" data-addp>+ Gerçel Kutup</button>
        <button type="button" class="btn small" data-addcp>+ Eşlenik Kutup</button>
        <button type="button" class="btn small" data-addz>+ Sıfır</button>
        <button type="button" class="btn small ghost" data-rm>Son Elemanı Sil</button>
      </div>
      <span class="sle-badge" data-stab>Kararlı</span>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls>
        <p class="sle-hint">İpucu: Kutupları (×) veya sıfırları (○) grafik üzerinde sürükleyebilir, eğri üzerindeki bir noktaya dokunarak kazanç K’yı doğrudan o noktaya taşıyabilirsin.</p>
      </div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-grid-2">
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">s-Düzlemi Kök Yer Eğrisi</h4><div class="sle-legend">
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BAD}"></i>Açık Kutup ×</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>Sıfır ○</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Kapalı Kutup ■</span>
            </div></div>
            <div class="sle-cv-box"><canvas class="sle-cv sle-cv-drag" data-cv1 aria-label="Etkileşimli kök yer eğrisi s-düzlemi"></canvas></div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Kapalı Döngü Basamak Cevabı T(s)</h4></div>
            <div class="sle-cv-box" data-box2><canvas class="sle-cv" data-cv2 aria-label="Kapalı döngü basamak cevabı"></canvas></div>
            <div class="sle-axis-lbl">Zaman t (s)</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '1 + K G(s) = 0 \\iff D(s) + K N(s) = 0, \\qquad |G(s)| = \\frac{1}{K}, \\quad \\angle G(s) = (2k+1)180^\\circ',
        '\\sigma_a = \\frac{\\sum p_j - \\sum z_i}{n - m}, \\qquad \\theta_a = \\frac{(2k+1)\\pi}{n - m}',
      ],
      paragraphs: [
        '**Kök yer eğrisi**, kazanç $K$ $0$’dan $\\infty$’a giderken kapalı döngü kutuplarının s-düzleminde izlediği yoldur; her dal bir açık döngü kutbundan ($\\times$) başlayıp bir sıfıra ($\\circ$) veya asimptot boyunca sonsuza gider.',
        'Herhangi bir kapalı döngü kutbu sağ yarı düzleme ($\\text{Re}(s) > 0$) geçtiğinde sistem kararsız olur; $j\\omega$ eksenini kestiği kazanç **kritik kazanç $K_{\\text{krit}}$** değeridir.',
      ],
      tasks: [
        '3 kutuplu senaryoda ($0, -1, -2$) kazancı artırarak dalların $j\\omega$ eksenini tam $K_{\\text{krit}} = 6$’da kestiğini doğrula.',
        'Bir **sıfır (+ Sıfır)** ekleyip $s = -1.5$ civarına sürükle: dalların sola çekilerek sistemin her $K$ için kararlı hale geldiğini gör.',
        'Kapalı kutupları $\\zeta \\approx 0.7$ sönüm oranına getiren $K$ değerini bulup basamak cevabındaki düşük aşımı gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const stabEl = host.querySelector('[data-stab]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sK = addSlider(ctrls, { label: 'Kazanç K', min: 0.05, max: st.kMax, value: st.K, log: true, fmt: v => fmtNum(v, 3), onInput: v => { st.K = v; updateGainOnly(); } });
  const sKMax = addSlider(ctrls, { label: 'Üst Sınır K_max', min: 10, max: 120, value: st.kMax, step: 5, fmt: v => `${Math.round(v)}`, onInput: v => { st.kMax = Math.round(v); sK.setRange(0.05, st.kMax); recomputeLocus(); } });

  const BOUNDS = { xMin: -6, xMax: 2.5, yMin: -4.2, yMax: 4.2 };
  let gMap = { L: 32, T: 14, pw: 260, ph: 240 };
  const s2p = (re, im) => [
    gMap.L + ((re - BOUNDS.xMin) / (BOUNDS.xMax - BOUNDS.xMin)) * gMap.pw,
    gMap.T + ((BOUNDS.yMax - im) / (BOUNDS.yMax - BOUNDS.yMin)) * gMap.ph,
  ];
  const p2s = (x, y) => [
    BOUNDS.xMin + ((x - gMap.L) / gMap.pw) * (BOUNDS.xMax - BOUNDS.xMin),
    BOUNDS.yMax - ((y - gMap.T) / gMap.ph) * (BOUNDS.yMax - BOUNDS.yMin),
  ];

  const locusCv = setupCanvas(cv1, w => Math.min(330, Math.max(250, w * 0.85)), (c, W, H) => {
    if (!rlData || !clData) return;
    c.clearRect(0, 0, W, H);
    const L = 34, R = 14, T = 14, B = 26;
    gMap = { L, T, pw: W - L - R, ph: H - T - B };
    const [ox, oy] = s2p(0, 0);

    // RHP subtle red tint
    c.fillStyle = 'rgba(255,107,107,.06)';
    c.fillRect(ox, T, L + gMap.pw - ox, gMap.ph);

    // Grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    c.font = '10px "JetBrains Mono", monospace';
    for (let x = -5; x <= 2; x++) {
      const [px] = s2p(x, 0);
      c.beginPath(); c.moveTo(px, T); c.lineTo(px, T + gMap.ph); c.stroke();
      c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${x}`, px, H - 8);
    }
    for (let y = -4; y <= 4; y += 2) {
      const [, py] = s2p(0, y);
      c.beginPath(); c.moveTo(L, py); c.lineTo(L + gMap.pw, py); c.stroke();
      if (y !== 0) { c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(`${y}j`, L - 5, py + 3); }
    }
    // Axes
    c.strokeStyle = COL_AXIS; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(L, oy); c.lineTo(L + gMap.pw, oy); c.moveTo(ox, T); c.lineTo(ox, T + gMap.ph); c.stroke();

    c.save(); c.beginPath(); c.rect(L, T, gMap.pw, gMap.ph); c.clip();
    // Asymptotes
    if (rlData.centroid !== null && rlData.asymptoteAngles.length) {
      const [cx, cy] = s2p(rlData.centroid, 0);
      c.strokeStyle = 'rgba(255,255,255,.16)'; c.setLineDash([4, 4]); c.lineWidth = 1.2;
      for (const ang of rlData.asymptoteAngles) {
        const [ex, ey] = s2p(rlData.centroid + 12 * Math.cos(ang), 12 * Math.sin(ang));
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke();
      }
      c.setLineDash([]);
    }
    // Locus branches
    rlData.branches.forEach((br, bi) => {
      c.strokeStyle = GROUP_COLORS[bi % GROUP_COLORS.length];
      c.lineWidth = 2.1;
      c.beginPath();
      br.forEach((pt, idx) => {
        const [px, py] = s2p(pt.re, pt.im);
        if (idx === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();
    });
    // Open-loop poles & zeros
    for (const p of st.poles) { const [px, py] = s2p(p.re, p.im); drawCross(c, px, py, 6.5, COL_BAD, 2.4); }
    for (const z of st.zeros) { const [px, py] = s2p(z.re, z.im); drawRing(c, px, py, 6.5, COL_BLUE, 2.4); }
    // Closed-loop poles at current K
    for (const cp of clData.clPoles) {
      const [px, py] = s2p(cp.re, cp.im);
      c.fillStyle = clData.stable ? COL_OK : COL_WARN;
      c.fillRect(px - 5, py - 5, 10, 10);
      c.strokeStyle = '#000'; c.lineWidth = 1.2; c.strokeRect(px - 5, py - 5, 10, 10);
    }
    c.restore();
  }, clean);

  // Drag poles/zeros OR click branch to drag K
  let dragTarget = null;
  bindDragCanvas(cv1, {
    onDown: p => {
      // Hit test poles and zeros first
      for (let i = 0; i < st.poles.length; i++) {
        const [px, py] = s2p(st.poles[i].re, st.poles[i].im);
        if (Math.hypot(p.x - px, p.y - py) < 16) {
          // Find conjugate partner if complex
          let partner = -1;
          if (Math.abs(st.poles[i].im) > 1e-4) {
            partner = st.poles.findIndex((q, j) => j !== i && Math.abs(q.re - st.poles[i].re) < 0.05 && Math.abs(q.im + st.poles[i].im) < 0.05);
          }
          dragTarget = { kind: 'pole', idx: i, partner };
          return true;
        }
      }
      for (let i = 0; i < st.zeros.length; i++) {
        const [px, py] = s2p(st.zeros[i].re, st.zeros[i].im);
        if (Math.hypot(p.x - px, p.y - py) < 16) {
          dragTarget = { kind: 'zero', idx: i, partner: -1 };
          return true;
        }
      }
      // Otherwise snap gain K to nearest branch point!
      dragTarget = { kind: 'gain' };
      snapGainTo(p);
      return true;
    },
    onMove: (p, dragging) => {
      if (!dragging || !dragTarget) return;
      if (dragTarget.kind === 'gain') { snapGainTo(p); return; }
      let [re, im] = p2s(p.x, p.y);
      re = Math.max(-5.8, Math.min(2.2, +re.toFixed(2)));
      im = Math.max(-3.9, Math.min(3.9, +im.toFixed(2)));
      const arr = dragTarget.kind === 'pole' ? st.poles : st.zeros;
      if (dragTarget.partner >= 0) {
        const aIm = Math.max(0.2, Math.abs(im));
        arr[dragTarget.idx] = C(re, im >= 0 ? aIm : -aIm);
        arr[dragTarget.partner] = C(re, im >= 0 ? -aIm : aIm);
      } else {
        arr[dragTarget.idx] = C(re, 0); // real pole/zero stays real
      }
      recomputeLocus();
    },
    onUp: () => { dragTarget = null; },
  }, clean);

  function snapGainTo(p) {
    if (!rlData) return;
    let bestK = st.K, bestD = Infinity;
    for (const br of rlData.branches) {
      for (const pt of br) {
        const [px, py] = s2p(pt.re, pt.im);
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bestD && pt.K >= 0.05) { bestD = d; bestK = pt.K; }
      }
    }
    if (bestD < 48) {
      st.K = Math.min(st.kMax, Math.max(0.05, bestK));
      sK.set(st.K);
      updateGainOnly();
    }
  }

  function updateGainOnly() {
    clData = closedLoopAtGain(st.poles, st.zeros, st.K);
    stabEl.textContent = clData.stable ? '✓ Kararlı' : clData.marginal ? 'Sınırda Kararlı' : '✗ Kararsız';
    stabEl.className = `sle-badge ${clData.stable ? 'sle-badge-ok' : clData.marginal ? 'sle-badge-warn' : 'sle-badge-bad'}`;
    renderKpis(kpis, [
      { lbl: 'Kazanç K', val: fmtNum(st.K, 3), sub: rlData?.kCrit ? `K_krit ≈ ${rlData.kCrit.toFixed(2)}` : 'Her K kararlı', tone: 'acc' },
      { lbl: 'Baskın Kutup', val: fmtRect(clData.dominant), tone: clData.stable ? 'ok' : 'bad' },
      { lbl: 'Sönüm Oranı ζ', val: fmtFix(clData.zeta, 3), sub: `ω_n = ${clData.wn.toFixed(2)} rad/s` },
      { lbl: 'Asimptot Merkezi', val: rlData?.centroid !== null ? fmtFix(rlData.centroid, 2) : '—' },
    ]);
    locusCv.render();
    const sr = tfStepResponse(clData.clNum, clData.clDen, { tEnd: 10, dt: 0.015 });
    safePlot(cv2, [
      { name: 'ref', color: 'rgba(255,255,255,.26)', xs: [0, 10], ys: [1, 1] },
      { name: 'y', color: clData.stable ? COL_OK : COL_BAD, xs: sr.t, ys: sr.y },
    ], { x0: 0, x1: 10, ylabel: 'y(t)', height: 245 });
  }

  function recomputeLocus() {
    rlData = computeRootLocus(st.poles, st.zeros, { kMax: st.kMax, nSamples: 140 });
    updateGainOnly();
  }

  host.querySelector('[data-addp]').addEventListener('click', () => {
    if (st.poles.length >= 5) return;
    st.poles.push(C(-3.5, 0)); recomputeLocus();
  });
  host.querySelector('[data-addcp]').addEventListener('click', () => {
    if (st.poles.length >= 4) return;
    st.poles.push(C(-1.5, 1.8), C(-1.5, -1.8)); recomputeLocus();
  });
  host.querySelector('[data-addz]').addEventListener('click', () => {
    if (st.zeros.length >= st.poles.length - 1) return;
    st.zeros.push(C(-2.2, 0)); recomputeLocus();
  });
  host.querySelector('[data-rm]').addEventListener('click', () => {
    if (st.zeros.length > 0) st.zeros.pop();
    else if (st.poles.length > 1) {
      const p = st.poles.pop();
      if (Math.abs(p.im) > 1e-4) {
        const idx = st.poles.findIndex(q => Math.abs(q.re - p.re) < 0.1 && Math.abs(q.im + p.im) < 0.1);
        if (idx >= 0) st.poles.splice(idx, 1);
      }
    }
    recomputeLocus();
  });

  bindPresets(host, RL_PRESETS, p => {
    st.poles = p.poles.map(z => C(z.re, z.im));
    st.zeros = p.zeros.map(z => C(z.re, z.im));
    st.K = p.K; st.kMax = p.kMax;
    sKMax.set(st.kMax); sK.setRange(0.05, st.kMax); sK.set(st.K);
    recomputeLocus();
  });
  observeResize(host.querySelector('[data-box2]'), updateGainOnly, clean);
  bindTasks(host);
  recomputeLocus();
  return clean.run;
}

// =====================================================================
// 13. BODE & NYQUIST (GM / PM, Encirclement Count N, Z = P + N)
// =====================================================================

const BN_PRESETS = [
  { label: '3. Derece Kararlı', p1: -1, p2: -2, p3: -3, hasZ: false, z1: -2, K: 20, hasInt: false },
  { label: 'Yüksek Kazanç (Kararsız)', p1: -1, p2: -2, p3: -3, hasZ: false, z1: -2, K: 90, hasInt: false },
  { label: 'İntegratörlü (1/s)', p1: -1, p2: -2.5, p3: -5, hasZ: false, z1: -2, K: 10, hasInt: true },
  { label: 'Açık Döngü RHP (P = 1)', p1: 1.0, p2: -3, p3: -6, hasZ: false, z1: -2, K: 40, hasInt: false },
  { label: 'Faz İlerletici (Sıfırlı)', p1: -0.5, p2: -2, p3: -4, hasZ: true, z1: -1.2, K: 18, hasInt: false },
];

function mountBodeNyquist(host, ctx) {
  const clean = createClean(ctx);
  const st = { p1: -1, p2: -2, p3: -3, hasZ: false, z1: -2, K: 20, hasInt: false };
  let playing = false;
  let wCursorIdx = 120;
  let bn = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Kutup/sıfır ve kazançtan <b>Bode genlik/faz</b> diyagramlarını, <b>Kazanç ve Faz Marjlarını (GM/PM)</b> ve <b>Nyquist çevreleme kararlılık kriterini ($Z = P + N$)</b> canlı incele.', BN_PRESETS)}
    <div class="sle-toolbar">
      <span class="sle-badge" data-verdict>✓ Kararlı</span>
      <button type="button" class="btn small" data-play></button>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-grid-2">
          <div class="sle-col">
            <div class="sle-plot-card">
              <div class="sle-head"><h4 class="sle-title">Bode Genlik |G(jω)| (dB)</h4></div>
              <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="Bode genlik grafiği"></canvas></div>
            </div>
            <div class="sle-plot-card">
              <div class="sle-head"><h4 class="sle-title">Bode Faz ∠G(jω) (°)</h4></div>
              <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Bode faz grafiği"></canvas></div>
              <div class="sle-axis-lbl">Frekans ω (rad/s, logaritmik)</div>
            </div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Nyquist Diyagramı G(jω)</h4><span class="sle-hint" data-wread></span></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv3 aria-label="Nyquist diyagramı"></canvas></div>
            <div class="sle-legend">
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>ω &gt; 0</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch sle-legend-dash" style="border-color:rgba(91,228,155,.45)"></i>ω &lt; 0</span>
              <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BAD}"></i>Kritik (−1, 0)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'GM = -20\\log_{10}|G(j\\omega_{pc})|\\text{ dB}, \\qquad PM = 180^\\circ + \\angle G(j\\omega_{gc})',
        '\\text{Nyquist Kararlılık Kriteri: } Z = P + N_{\\text{CW}} = 0 \\iff \\text{Kapalı Döngü Kararlı}',
      ],
      paragraphs: [
        '**Kazanç marjı (GM)** fazın $-180^\\circ$ olduğu $\\omega_{pc}$’de kazancın daha ne kadar artırılabileceğini; **faz marjı (PM)** genliğin $0\\text{ dB}$ olduğu $\\omega_{gc}$’de fazın $-180^\\circ$’ye uzaklığını ölçer.',
        '**Nyquist kriteri** açık döngü kararsız ($P > 0$) sistemleri bile kapsar: $(-1, 0)$ kritik noktasının saat yönünün tersine $P$ kez sarılması ($N_{\\text{CW}} = -P$) kapalı döngüyü kararlı kılar ($Z = 0$).',
      ],
      tasks: [
        '3. derece kararlı senaryoda $K$’yı $20$’den $60$’a çıkar: $K = 60$’ta $GM = 0\\text{ dB}$ ve eğrinin tam $(-1, 0)$’dan geçtiğini gör.',
        '**Açık Döngü RHP ($P=1$)** senaryosunu aç; $K$’yı düşürerek $(-1,0)$ etrafındaki ters yönlü sarımın kaybolup sistemin kararsızlaştığı sınırı bul.',
        'Bir sıfır ekleyip faz marjının (PM) nasıl arttığını izle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const verdictEl = host.querySelector('[data-verdict]');
  const playBtn = host.querySelector('[data-play]');
  const wRead = host.querySelector('[data-wread]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const cv3 = host.querySelector('[data-cv3]');

  const sK = addSlider(ctrls, { label: 'Açık Döngü Kazancı K', min: 0.5, max: 160, value: st.K, log: true, fmt: v => fmtNum(v, 3), onInput: v => { st.K = v; update(); } });
  const sP1 = addSlider(ctrls, { label: 'Kutup p₁ (RHP için >0)', min: -6, max: 2.5, value: st.p1, step: 0.1, fmt: v => fmtFix(v, 1), onInput: v => { st.p1 = v; update(); } });
  const sP2 = addSlider(ctrls, { label: 'Kutup p₂', min: -8, max: -0.2, value: st.p2, step: 0.1, fmt: v => fmtFix(v, 1), onInput: v => { st.p2 = v; update(); } });
  const sP3 = addSlider(ctrls, { label: 'Kutup p₃', min: -10, max: -0.5, value: st.p3, step: 0.2, fmt: v => fmtFix(v, 1), onInput: v => { st.p3 = v; update(); } });
  const tInt = addToggle(ctrls, 'Orijinde integratör (1/s) ekle', st.hasInt, v => { st.hasInt = v; update(); });
  const tZ = addToggle(ctrls, 'Açık döngü sıfırı (s − z₁) ekle', st.hasZ, v => { st.hasZ = v; sZ1.setVisible(v); update(); });
  const sZ1 = addSlider(ctrls, { label: 'Sıfır z₁', min: -8, max: -0.2, value: st.z1, step: 0.1, fmt: v => fmtFix(v, 1), onInput: v => { st.z1 = v; update(); } });

  const nyqCv = setupCanvas(cv3, w => Math.min(350, Math.max(255, w * 0.92)), (c, W, H) => {
    if (!bn) return;
    c.clearRect(0, 0, W, H);
    // Auto-scale cleanly around (-1, 0) and main contour body
    const mags = bn.nyqRe.map((r, i) => Math.hypot(r, bn.nyqIm[i])).filter(v => Number.isFinite(v) && v < 8);
    const maxR = Math.max(1.8, Math.min(4.5, ...mags, 1.8));
    const cx = W * 0.56, cy = H * 0.5;
    const sc = (Math.min(W, H) * 0.42) / maxR;
    const px = r => cx + r * sc;
    const py = im => cy - im * sc;

    // Axes & unit circle
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(10, cy); c.lineTo(W - 10, cy); c.moveTo(cx, 10); c.lineTo(cx, H - 10); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.setLineDash([3, 3]);
    c.beginPath(); c.arc(cx, cy, sc, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    // Nyquist positive-w contour
    c.save(); c.beginPath(); c.rect(6, 6, W - 12, H - 12); c.clip();
    c.strokeStyle = COL_OK; c.lineWidth = 2.2;
    c.beginPath();
    let pen = false;
    bn.nyqRe.forEach((r, i) => {
      const im = bn.nyqIm[i];
      if (!Number.isFinite(r) || Math.hypot(r, im) > maxR * 3) { pen = false; return; }
      const x = px(r), y = py(im);
      if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y);
    });
    c.stroke();

    // Negative-w mirror dashed
    c.strokeStyle = 'rgba(91,228,155,.35)'; c.lineWidth = 1.4; c.setLineDash([4, 4]);
    c.beginPath(); pen = false;
    bn.nyqRe.forEach((r, i) => {
      const im = -bn.nyqIm[i];
      if (!Number.isFinite(r) || Math.hypot(r, im) > maxR * 3) { pen = false; return; }
      const x = px(r), y = py(im);
      if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y);
    });
    c.stroke(); c.setLineDash([]);

    // Animated frequency cursor
    const ci = Math.min(bn.ws.length - 1, Math.max(0, wCursorIdx));
    const cr = bn.nyqRe[ci], cim = bn.nyqIm[ci];
    if (Number.isFinite(cr) && Math.hypot(cr, cim) < maxR * 2) {
      c.fillStyle = accentColor();
      c.beginPath(); c.arc(px(cr), py(cim), 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // Critical point (-1, 0)
    drawCross(c, px(-1), py(0), 6.5, COL_BAD, 2.4);
    c.font = '600 10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_BAD; c.textAlign = 'right';
    c.fillText('(−1, 0)', px(-1) - 8, py(0) - 8);
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    if (!bn) return false;
    wCursorIdx = (wCursorIdx + Math.max(1, Math.round(dt * 70))) % bn.ws.length;
    const wNow = bn.ws[wCursorIdx];
    const poles = [C(st.p1, 0), C(st.p2, 0), C(st.p3, 0)];
    if (st.hasInt) poles.unshift(C(0, 0));
    const zeros = st.hasZ ? [C(st.z1, 0)] : [];
    const gNow = evalTransferC(poles, zeros, st.K, C(0, wNow));
    wRead.textContent = `ω = ${wNow.toFixed(2)} · |G| = ${(20 * Math.log10(Math.max(1e-6, cAbs(gNow)))).toFixed(1)} dB`;
    nyqCv.render();
    return playing;
  }, clean);

  function update() {
    const poles = [C(st.p1, 0), C(st.p2, 0), C(st.p3, 0)];
    if (st.hasInt) poles.unshift(C(0, 0));
    const zeros = st.hasZ ? [C(st.z1, 0)] : [];
    bn = analyzeBodeNyquist({ poles, zeros, K: st.K, wMin: 0.05, wMax: 100, nPoints: 280 });
    verdictEl.textContent = bn.stable ? '✓ Kapalı Döngü Kararlı (Z = 0)' : `✗ ${bn.verdict} (Z = ${bn.Z})`;
    verdictEl.className = `sle-badge ${bn.stable ? 'sle-badge-ok' : 'sle-badge-bad'}`;

    safePlot(cv1, [
      { name: '0dB', color: 'rgba(255,209,102,.45)', xs: [0.05, 100], ys: [0, 0] },
      { name: '|G|', color: COL_FG, xs: bn.ws, ys: bn.magDb },
    ], { xlog: true, x0: 0.05, x1: 100, ylabel: 'dB', height: 165 });
    safePlot(cv2, [
      { name: '-180', color: 'rgba(255,107,107,.45)', xs: [0.05, 100], ys: [-180, -180] },
      { name: '∠G', color: COL_BLUE, xs: bn.ws, ys: bn.phaseDeg },
    ], { xlog: true, x0: 0.05, x1: 100, ylabel: '°', height: 155 });

    renderKpis(kpis, [
      { lbl: 'Kazanç Marjı GM', val: Number.isFinite(bn.gmDb) ? `${bn.gmDb.toFixed(1)} dB` : '∞ dB', sub: bn.wpc ? `ω_pc = ${bn.wpc.toFixed(2)}` : 'Faz −180° geçmez', tone: bn.gmDb > 0 ? 'ok' : 'bad' },
      { lbl: 'Faz Marjı PM', val: Number.isFinite(bn.pmDeg) ? `${bn.pmDeg.toFixed(1)}°` : '∞', sub: bn.wgc ? `ω_gc = ${bn.wgc.toFixed(2)}` : '|G| < 1', tone: bn.pmDeg > 0 ? 'ok' : 'bad' },
      { lbl: 'Nyquist (P, N, Z)', val: `P=${bn.P}, N=${bn.N_cw} → Z=${bn.Z}`, sub: 'Z = P + N_CW', tone: bn.Z === 0 ? 'ok' : 'bad' },
      { lbl: 'Karar', val: bn.verdict, tone: bn.stable ? 'ok' : 'bad' },
    ]);
    wRead.textContent = `ω = ${bn.ws[Math.min(wCursorIdx, bn.ws.length - 1)].toFixed(2)} rad/s`;
    nyqCv.render();
  }

  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, BN_PRESETS, p => {
    Object.assign(st, p);
    sK.set(st.K); sP1.set(st.p1); sP2.set(st.p2); sP3.set(st.p3); tInt.set(st.hasInt); tZ.set(st.hasZ); sZ1.set(st.z1);
    sZ1.setVisible(st.hasZ); update();
  });
  observeResize(host.querySelector('[data-box1]'), update, clean);
  bindTasks(host);
  sZ1.setVisible(st.hasZ);
  syncPlayBtn(playBtn, playing);
  update();
  return clean.run;
}

// =====================================================================
// 14. DURUM UZAYI (Ters Sarkaç — LQR & Kutup Atama, İtme Bozucusu)
// =====================================================================

const SS_PRESETS = [
  { label: 'LQR Dengeli', ctrlMode: 'lqr', M: 1.0, m: 0.25, l: 0.55, Qx: 10, Qth: 120, Rval: 0.5, poleSpd: 3.0 },
  { label: 'LQR Agresif (Düşük R)', ctrlMode: 'lqr', M: 1.0, m: 0.25, l: 0.55, Qx: 40, Qth: 300, Rval: 0.08, poleSpd: 3.0 },
  { label: 'Kutup Atama (Hızlı)', ctrlMode: 'place', M: 1.0, m: 0.25, l: 0.55, Qx: 10, Qth: 120, Rval: 0.5, poleSpd: 4.5 },
  { label: 'Kutup Atama (Yavaş)', ctrlMode: 'place', M: 1.0, m: 0.25, l: 0.55, Qx: 10, Qth: 120, Rval: 0.5, poleSpd: 1.8 },
  { label: 'Açık Döngü (Düşüş)', ctrlMode: 'open', M: 1.0, m: 0.25, l: 0.55, Qx: 10, Qth: 120, Rval: 0.5, poleSpd: 3.0 },
];

function mountStateSpace(host, ctx) {
  const clean = createClean(ctx);
  const st = { ctrlMode: 'lqr', M: 1.0, m: 0.25, l: 0.55, Qx: 10, Qth: 120, Rval: 0.5, poleSpd: 3.0 };
  let xState = [0, 0, 0.16, 0]; // [x, xdot, theta, thetadot]
  let uForce = 0;
  let pushTimer = 0, pushForce = 0;
  let playing = autoPlayAllowed();
  let histT = [0], histTh = [9.2], histX = [0], simT = 0;
  let lin = null, Kvec = [0, 0, 0, 0], clEigs = [];

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Araba üzerindeki <b>ters sarkacı</b> doğrusal olmayan RK4 fiziğiyle <b>LQR</b> veya <b>Kutup Atama (Ackermann)</b> durum geri beslemesiyle dengele; <b>itme bozucusu</b> uygula ve kontrol edilebilirliği denetle.', SS_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-cmode aria-label="Durum geri besleme yöntemi">
        <button type="button" data-cm="lqr" class="on">LQR Optimal</button>
        <button type="button" data-cm="place">Kutup Atama</button>
        <button type="button" data-cm="open">Açık Döngü</button>
      </div>
      <div class="sle-toolbar-g">
        <button type="button" class="btn small" data-push-l>← İt (−)</button>
        <button type="button" class="btn small" data-push-r>İt (+) →</button>
        <button type="button" class="btn small" data-play></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Sıfırla</button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Ters Sarkaç Sahnesi (İtmek için sarkaca tıkla)</h4><span class="sle-badge sle-badge-ok" data-ctrl-badge>Kontrol Edilebilir</span></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv1 aria-label="Araba üzerinde ters sarkaç animasyonu"></canvas></div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Durum Değişkenleri θ(t) (°) & x(t) (m)</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Açı θ (°)</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>Konum x (×10 m)</span>
          </div></div>
          <div class="sle-cv-box" data-box2><canvas class="sle-cv" data-cv2 aria-label="Durum zaman grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\dot{\\mathbf{x}} = A\\mathbf{x} + B u, \\qquad u = -K\\mathbf{x}, \\qquad \\mathcal{C} = \\begin{bmatrix} B & AB & A^2B & A^3B \\end{bmatrix}',
        '\\text{LQR: } J = \\int_0^\\infty (\\mathbf{x}^T Q \\mathbf{x} + R u^2)\\,dt \\implies K = R^{-1} B^T P, \\quad A^T P + P A - P B R^{-1} B^T P + Q = 0',
        '\\text{Ackermann: } K = \\begin{bmatrix} 0 & 0 & 0 & 1 \\end{bmatrix} \\mathcal{C}^{-1} \\phi(A)',
      ],
      paragraphs: [
        'Dik konum ($\\theta = 0$) doğal olarak **kararsız** bir denge noktasıdır (bir pozitif reel özdeğer). Kontrol edilebilirlik matrisi $\\mathcal{C}$ tam rank ($\\text{rank}(\\mathcal{C}) = 4$) olduğu için durum geri beslemesi $u = -K\\mathbf{x}$ tüm kapalı döngü kutuplarını sol yarı düzleme taşıyabilir.',
        '**LQR** (Cebirsel Riccati Denklemi) durum hatası ($Q$) ile aktüatör enerjisi ($R$) arasındaki en iyi dengeyi otomatik bulur; **Ackermann** ise kutupları doğrudan seçilen hızla yerleştirir.',
      ],
      tasks: [
        'LQR modunda **İt (+) →** düğmesine basıp arabanın sarkacı yakalamak için önce aynı yöne hızlandığını (non-minimum phase davranışı) gözle.',
        'LQR ağırlığı $R$’yi küçültüp ($0.05$) tepe kuvvet $u$ artışına karşılık açının ne kadar hızlı toplandığını karşılaştır.',
        'Açık döngüye geçip sıfırla; kontrolsüz sarkacın yerçekimiyle düşüşünü izle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const ctrlBadge = host.querySelector('[data-ctrl-badge]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sQx = addSlider(ctrls, { label: 'LQR Ağırlığı Q_x', min: 1, max: 100, value: st.Qx, log: true, fmt: v => fmtNum(v, 2), onInput: v => { st.Qx = v; designController(); } });
  const sQth = addSlider(ctrls, { label: 'LQR Ağırlığı Q_θ', min: 10, max: 500, value: st.Qth, log: true, fmt: v => fmtNum(v, 3), onInput: v => { st.Qth = v; designController(); } });
  const sR = addSlider(ctrls, { label: 'Kontrol Maliyeti R', min: 0.02, max: 5.0, value: st.Rval, log: true, fmt: v => fmtNum(v, 2), onInput: v => { st.Rval = v; designController(); } });
  const sSpd = addSlider(ctrls, { label: 'Kutup Hızı α (Ackermann)', min: 1.2, max: 6.0, value: st.poleSpd, step: 0.2, fmt: v => `−${v.toFixed(1)}`, onInput: v => { st.poleSpd = v; designController(); } });
  const div = document.createElement('div'); div.className = 'sle-divider'; ctrls.append(div);
  const sM = addSlider(ctrls, { label: 'Araba Kütlesi M', unit: 'kg', min: 0.4, max: 3.0, value: st.M, step: 0.1, fmt: v => `${v.toFixed(1)} kg`, onInput: v => { st.M = v; designController(); } });
  const sm = addSlider(ctrls, { label: 'Sarkaç Kütlesi m', unit: 'kg', min: 0.1, max: 1.0, value: st.m, step: 0.05, fmt: v => `${v.toFixed(2)} kg`, onInput: v => { st.m = v; designController(); } });
  const sl = addSlider(ctrls, { label: 'Çubuk Uzunluğu l', unit: 'm', min: 0.3, max: 1.0, value: st.l, step: 0.05, fmt: v => `${v.toFixed(2)} m`, onInput: v => { st.l = v; designController(); } });

  function designController() {
    lin = cartPendulumLinearModel({ M: st.M, m: st.m, l: st.l, b: 0.1 });
    ctrlBadge.textContent = lin.controllable ? `rank(C) = ${lin.rankC}/4 · Kontrol Edilebilir` : 'Kontrol Edilemez';
    if (st.ctrlMode === 'lqr') {
      const lqr = solveLQR4(lin.A, lin.B, [st.Qx, 1, st.Qth, 10], st.Rval);
      Kvec = lqr ? lqr.K : [0, 0, 0, 0];
      clEigs = lqr ? lqr.clEigs : [];
    } else if (st.ctrlMode === 'place') {
      const a = st.poleSpd;
      const des = [C(-a, 0), C(-a * 1.15, 0), C(-a * 0.9, a * 0.6), C(-a * 0.9, -a * 0.6)];
      Kvec = ackermannGain(lin.A, lin.B, des) || [0, 0, 0, 0];
      clEigs = des;
    } else {
      Kvec = [0, 0, 0, 0];
      clEigs = [];
    }
    updateKpis();
  }

  function updateKpis() {
    const thDeg = (xState[2] * 180) / Math.PI;
    const eigTxt = clEigs.length ? clEigs.map(e => Math.abs(e.im) > 0.05 ? `${e.re.toFixed(1)}±j${Math.abs(e.im).toFixed(1)}` : e.re.toFixed(1)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ') : 'Açık döngü';
    renderKpis(kpis, [
      { lbl: 'Açı θ', val: `${thDeg.toFixed(1)}°`, sub: `x = ${xState[0].toFixed(2)} m`, tone: Math.abs(thDeg) < 8 ? 'ok' : Math.abs(thDeg) < 35 ? 'warn' : 'bad' },
      { lbl: 'Kontrol Kuvveti u', val: `${uForce.toFixed(1)} N`, tone: 'acc' },
      { lbl: 'Kazanç K', val: `[${Kvec.map(v => v.toFixed(1)).join(', ')}]`, sub: `Özdeğerler: ${eigTxt}` },
      { lbl: 'det(C)', val: fmtNum(lin?.detC || 0, 2), sub: `rank = ${lin?.rankC || 0}/4` },
    ]);
  }

  const cartCv = setupCanvas(cv1, w => Math.min(250, Math.max(200, w * 0.48)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const trackY = H * 0.72;
    const sc = Math.min(W * 0.16, H * 0.65); // px per meter
    const cx = W / 2 + Math.max(-2.2, Math.min(2.2, xState[0])) * sc;

    // Track rail + tick marks
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, trackY); c.lineTo(W - 20, trackY); c.stroke();
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    for (let m = -2; m <= 2; m++) {
      const tx = W / 2 + m * sc;
      c.beginPath(); c.moveTo(tx, trackY - 6); c.lineTo(tx, trackY + 6); c.stroke();
    }

    // Cart body
    const cw = 64, ch = 28;
    c.fillStyle = 'rgba(255,255,255,.08)'; c.strokeStyle = COL_FG; c.lineWidth = 2;
    c.fillRect(cx - cw / 2, trackY - ch - 6, cw, ch);
    c.strokeRect(cx - cw / 2, trackY - ch - 6, cw, ch);
    // Wheels
    c.fillStyle = '#000'; c.strokeStyle = COL_MUTE;
    for (const wx of [cx - 18, cx + 18]) {
      c.beginPath(); c.arc(wx, trackY - 5, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // Force arrow u
    if (Math.abs(uForce) > 0.3) {
      const fLen = Math.max(-65, Math.min(65, uForce * 3.5));
      drawArrow(c, cx + Math.sign(fLen) * (cw / 2 + 4), trackY - ch / 2 - 6, cx + Math.sign(fLen) * (cw / 2 + 4) + fLen, trackY - ch / 2 - 6, COL_BLUE, 2.4, 'u');
    }

    // Pendulum rod & bob
    const pivY = trackY - ch - 6;
    const rodLen = st.l * sc * 1.45;
    const bx = cx + rodLen * Math.sin(xState[2]);
    const by = pivY - rodLen * Math.cos(xState[2]);
    c.strokeStyle = accentColor(); c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, pivY); c.lineTo(bx, by); c.stroke();
    // Pivot & bob
    c.fillStyle = COL_FG; c.beginPath(); c.arc(cx, pivY, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = Math.abs(xState[2]) < 0.3 ? COL_OK : COL_BAD;
    c.beginPath(); c.arc(bx, by, 10, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();

    // Disturbance impulse visual
    if (pushTimer > 0) {
      drawArrow(c, bx - Math.sign(pushForce) * 44, by, bx - Math.sign(pushForce) * 14, by, COL_WARN, 2.6, 'İtme');
    }
  }, clean);

  function drawTrace() {
    const t0 = histT[0], t1 = Math.max(t0 + 4, histT[histT.length - 1]);
    safePlot(cv2, [
      { name: 'θ(°)', color: COL_WARN, xs: histT, ys: histTh },
      { name: '10x', color: COL_BLUE, xs: histT, ys: histX.map(v => v * 10) },
    ], { x0: t0, x1: t1, ylabel: '° / 10m', height: 150 });
  }

  let frameCount = 0;
  const loop = createAnimLoop((_, dt) => {
    const sub = 6;
    const h = Math.min(0.03, dt) / sub;
    for (let k = 0; k < sub; k++) {
      // Wrap theta around [-pi, pi]
      let th = ((xState[2] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      xState[2] = th;
      if (st.ctrlMode !== 'open' && Math.abs(th) < 1.15) {
        uForce = -(Kvec[0] * xState[0] + Kvec[1] * xState[1] + Kvec[2] * th + Kvec[3] * xState[3]);
        uForce = Math.max(-45, Math.min(45, uForce));
      } else {
        uForce = 0;
      }
      const dF = pushTimer > 0 ? pushForce : 0;
      pushTimer = Math.max(0, pushTimer - h);
      xState = cartPendulumStep(xState, uForce, { M: st.M, m: st.m, l: st.l, b: 0.1, distForce: dF }, h);
      // Soft track bumper at ±2.3 m
      if (Math.abs(xState[0]) > 2.3) { xState[0] = Math.sign(xState[0]) * 2.3; xState[1] *= -0.3; }
      simT += h;
    }
    frameCount++;
    if (frameCount % 3 === 0) {
      histT.push(simT);
      histTh.push((xState[2] * 180) / Math.PI);
      histX.push(xState[0]);
      if (histT.length > 180) { histT.shift(); histTh.shift(); histX.shift(); }
      drawTrace();
      updateKpis();
    }
    cartCv.render();
    return playing;
  }, clean);

  function resetSim(initDeg = 10) {
    xState = [0, 0, (initDeg * Math.PI) / 180, 0];
    uForce = 0; pushTimer = 0; simT = 0;
    histT = [0]; histTh = [initDeg]; histX = [0];
    cartCv.render(); drawTrace(); updateKpis();
  }

  function syncMode() {
    host.querySelectorAll('[data-cmode] button').forEach(b => b.classList.toggle('on', b.dataset.cm === st.ctrlMode));
    [sQx, sQth, sR].forEach(s => s.setVisible(st.ctrlMode === 'lqr'));
    sSpd.setVisible(st.ctrlMode === 'place');
    syncSegments(host, false);
  }

  host.querySelector('[data-cmode]').addEventListener('click', e => {
    const b = e.target.closest('[data-cm]'); if (!b || b.dataset.cm === st.ctrlMode) return;
    st.ctrlMode = b.dataset.cm; syncMode(); designController();
  });
  host.querySelector('[data-push-l]').addEventListener('click', () => { pushForce = -2.8; pushTimer = 0.12; if (!playing && !isMotionOff()) { playing = true; syncPlayBtn(playBtn, true); loop.start(); } });
  host.querySelector('[data-push-r]').addEventListener('click', () => { pushForce = 2.8; pushTimer = 0.12; if (!playing && !isMotionOff()) { playing = true; syncPlayBtn(playBtn, true); loop.start(); } });
  cv1.addEventListener('pointerdown', e => {
    const r = cv1.getBoundingClientRect();
    pushForce = e.clientX - r.left < r.width / 2 ? 2.6 : -2.6;
    pushTimer = 0.12;
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => resetSim(10));
  bindPresets(host, SS_PRESETS, p => {
    Object.assign(st, p);
    sQx.set(st.Qx); sQth.set(st.Qth); sR.set(st.Rval); sSpd.set(st.poleSpd);
    sM.set(st.M); sm.set(st.m); sl.set(st.l);
    syncMode(); designController(); resetSim(12);
  });

  observeResize(host.querySelector('[data-box2]'), drawTrace, clean);
  bindTasks(host);
  syncMode();
  designController();
  resetSim(10);
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 15. SİNYALLER & FOURIER (Fourier Series + Gibbs, FFT + Windowing Leakage)
// =====================================================================

const FOURIER_PRESETS = [
  { label: 'Kare Dalga (Gibbs N=15)', mode: 'series', wave: 'square', harmonics: 15 },
  { label: 'Üçgen Dalga (Hızlı Yakınsama)', mode: 'series', wave: 'triangle', harmonics: 7 },
  { label: 'Testere Dalga', mode: 'series', wave: 'sawtooth', harmonics: 12 },
  { label: 'Tam Periyot (Sızıntısız FFT)', mode: 'fft', cycles: 10.0, windowType: 'rect', amp2: 0 },
  { label: 'Kesirli Periyot (Dikdörtgen)', mode: 'fft', cycles: 10.5, windowType: 'rect', amp2: 0 },
  { label: 'Kesirli Periyot (Hann)', mode: 'fft', cycles: 10.5, windowType: 'hann', amp2: 0 },
];

function mountSignalsFourier(host, ctx) {
  const clean = createClean(ctx);
  const st = {
    mode: 'series', wave: 'square', harmonics: 11,
    custom: [1.0, 0, 0.33, 0, 0.2, 0, 0.14, 0],
    cycles: 10.5, amp2: 0, windowType: 'rect', dbSpec: true,
  };

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Harmoniklerden dalga kurarak <b>Fourier serisini ve Gibbs olayını</b> gözle; <b>FFT spektrumu</b> üzerinde dikdörtgen, Hann ve Hamming pencerelerinin <b>spektral sızıntı (leakage)</b> etkisini karşılaştır.', FOURIER_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Fourier modu">
        <button type="button" data-m="series" class="on">Fourier Serisi & Gibbs</button>
        <button type="button" data-m="fft">FFT & Pencereleme</button>
      </div>
      <div class="seg sle-seg-wrap" data-wseg role="tablist" aria-label="Dalga türü">
        <button type="button" data-w="square" class="on">Kare</button>
        <button type="button" data-w="triangle">Üçgen</button>
        <button type="button" data-w="sawtooth">Testere</button>
        <button type="button" data-w="halfrect">Yarım Sinüs</button>
        <button type="button" data-w="custom">Özel</button>
      </div>
      <div class="seg sle-seg-wrap" data-winseg hidden role="tablist" aria-label="Pencere seçimi">
        <button type="button" data-wi="rect" class="on">Dikdörtgen</button>
        <button type="button" data-wi="hann">Hann</button>
        <button type="button" data-wi="hamming">Hamming</button>
        <button type="button" data-wi="blackman">Blackman</button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Zaman Domeni: Hedef vs N-Terimli Fourier Toplamı</h4><div class="sle-legend" data-leg1></div></div>
          <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="Fourier zaman grafiği"></canvas></div>
          <div class="sle-axis-lbl" data-ax1></div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t2>Harmonik Genlik Spektrumu</h4><div class="sle-legend" data-leg2></div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Fourier spektrum grafiği"></canvas></div>
          <div class="sle-axis-lbl" data-ax2></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'S_N(t) = a_0 + \\sum_{n=1}^{N} \\left(a_n \\cos(2\\pi n f_0 t) + b_n \\sin(2\\pi n f_0 t)\\right), \\qquad \\frac{1}{T}\\int_0^T x^2\\,dt = a_0^2 + \\frac{1}{2}\\sum_{n=1}^\\infty (a_n^2+b_n^2)',
        'X[k] = \\sum_{n=0}^{N-1} w[n] x[n] e^{-j 2\\pi k n / N}, \\qquad w_{\\text{Hann}}[n] = \\frac{1}{2}\\left(1 - \\cos\\frac{2\\pi n}{N-1}\\right)',
      ],
      paragraphs: [
        '**Gibbs olayı**: Kare dalga gibi süreksiz sıçrama içeren sinyallerde harmonik sayısı $N \\to \\infty$ yapılsa bile sıçrama kenarlarında sıçrama yüksekliğinin yakl. **%8.95**’i kadar aşım kalır.',
        '**Spektral sızıntı (leakage)**: Gözlem penceresine tam sayı periyot sığmadığında (ör. $10.5$ periyot) dikdörtgen pencerenin $\\text{sinc}$ yan lobları enerjiyi komşu binlere saçar; **Hann/Hamming/Blackman** pencereleri kenarları yumuşatarak yan lobları $-31$ ila $-58\\text{ dB}$ bastırır.',
      ],
      tasks: [
        'Kare dalgada harmonik sayısını $N = 5$’ten $N = 50$’ye çıkarıp Gibbs aşımının %8.95 civarında sabit kaldığını doğrula.',
        'FFT modunda periyot sayısını $10.0$ (sızıntısız) ve $10.5$ (sızıntılı) yap; Dikdörtgen pencere yerine Hann/Hamming seçerek spektral sızıntı düşüşünü gör.',
        'Özel dalga modunda 1., 3. ve 5. harmonikleri kendin ayarlayıp sentezlediğin dalgayı gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const wSeg = host.querySelector('[data-wseg]');
  const winSeg = host.querySelector('[data-winseg]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');
  const leg1 = host.querySelector('[data-leg1]');
  const leg2 = host.querySelector('[data-leg2]');
  const ax1 = host.querySelector('[data-ax1]');
  const ax2 = host.querySelector('[data-ax2]');

  const sHarm = addSlider(ctrls, { label: 'Harmonik Sayısı N', min: 1, max: 50, value: st.harmonics, step: 1, fmt: v => `N = ${Math.round(v)}`, onInput: v => { st.harmonics = Math.round(v); update(); } });
  const customSliders = st.custom.map((val, idx) =>
    addSlider(ctrls, { label: `${idx + 1}. Harmonik c_${idx + 1}`, min: 0, max: 1.2, value: val, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.custom[idx] = v; update(); } })
  );

  const sCyc = addSlider(ctrls, { label: 'Penceredeki Periyot Sayısı', min: 4, max: 28, value: st.cycles, step: 0.1, fmt: v => `${v.toFixed(1)} periyot`, onInput: v => { st.cycles = v; update(); } });
  const sAmp2 = addSlider(ctrls, { label: '2. Ton Genliği (22 Hz)', min: 0, max: 0.8, value: st.amp2, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.amp2 = v; update(); } });
  const tDb = addToggle(ctrls, 'Spektrumu dB ölçekte göster', st.dbSpec, v => { st.dbSpec = v; update(); });

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    const isSer = st.mode === 'series';
    wSeg.hidden = !isSer;
    winSeg.hidden = isSer;
    sHarm.setVisible(isSer && st.wave !== 'custom');
    customSliders.forEach(s => s.setVisible(isSer && st.wave === 'custom'));
    [sCyc, sAmp2, tDb].forEach(s => s.setVisible(!isSer));
    syncSegments(host, false);
  }

  function update() {
    if (st.mode === 'series') {
      const N = st.wave === 'custom' ? 8 : st.harmonics;
      const d = fourierSeries({ wave: st.wave, harmonics: N, customCoeffs: st.custom });
      t1.textContent = 'Fourier Serisi Sentezi S_N(t)';
      t2.textContent = 'Harmonik Genlikleri |c_n|';
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,255,255,.32)"></i>Hedef Dalga</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Fourier S_N(t)</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>|c_n|</span>`;
      ax1.textContent = 'Normalize Zaman t / T (2 periyot)'; ax2.textContent = 'Harmonik İndisi n';
      safePlot(cv1, [
        { name: 'hedef', color: 'rgba(255,255,255,.3)', xs: d.t, ys: d.exact },
        { name: 'SN', color: COL_OK, xs: d.t, ys: d.approx },
      ], { x0: 0, x1: 2, ylabel: 'Genlik', height: 225 });
      // Plot spectrum as stem-like pulses
      const sx = [], sy = [];
      const showN = Math.min(d.specN.length - 1, 30);
      for (let n = 0; n <= showN; n++) { sx.push(n, n, n); sy.push(0, d.specMag[n], 0); }
      safePlot(cv2, [{ name: '|cn|', color: COL_BLUE, xs: sx, ys: sy }], { x0: 0, x1: Math.max(8, showN), ylabel: '|c_n|', height: 155 });
      renderKpis(kpis, [
        { lbl: 'RMS Yaklaşım Hatası', val: d.rmsError.toFixed(4), tone: d.rmsError < 0.08 ? 'ok' : '' },
        { lbl: 'Gibbs Aşımı (Sıçrama %)', val: st.wave === 'square' ? `%${d.gibbsOvershootPct.toFixed(2)}` : 'Süreksizlik yok', sub: st.wave === 'square' ? 'Limit ≈ %8.95' : '', tone: st.wave === 'square' ? 'acc' : '' },
        { lbl: 'Parseval Gücü', val: d.parsevalPower.toFixed(4), sub: `Tam güç: ${d.exactPower.toFixed(4)}` },
        { lbl: 'Harmonik Sayısı', val: `${N}` },
      ]);
    } else {
      const d = analyzeWindowedFFT({ cycles: st.cycles, amp2: st.amp2, windowType: st.windowType, N: 256, fs: 256 });
      const winSideLobe = { rect: '−13.3 dB', hann: '−31.5 dB', hamming: '−42.7 dB', blackman: '−58.0 dB' }[st.windowType];
      t1.textContent = 'Pencerelenmiş Zaman Sinyali w[n]·x[n]';
      t2.textContent = `256-Nokta FFT Genlik Spektrumu (${st.dbSpec ? 'dB' : 'Doğrusal'})`;
      leg1.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,209,102,.45)"></i>Pencere w[n]</span>
        <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>w[n]·x[n]</span>`;
      leg2.innerHTML = `<span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>|X[k]|</span>`;
      ax1.textContent = 'Zaman t (s)'; ax2.textContent = 'Frekans f (Hz)';
      safePlot(cv1, [
        { name: 'w', color: 'rgba(255,209,102,.48)', xs: d.t, ys: d.w },
        { name: 'wx', color: COL_BLUE, xs: d.t, ys: d.windowed },
      ], { x0: 0, x1: 1, ylabel: 'Genlik', height: 190 });
      const cut = 56;
      safePlot(cv2, [
        { name: 'FFT', color: COL_OK, xs: d.freqs.slice(0, cut), ys: (st.dbSpec ? d.magDb : d.magLin).slice(0, cut) },
      ], { x0: 0, x1: d.freqs[cut - 1], ylabel: st.dbSpec ? 'dB' : '|X|', height: 195 });
      renderKpis(kpis, [
        { lbl: 'Tepe Frekans', val: `${d.peakFreq.toFixed(1)} Hz`, sub: `Gerçek ${d.f1.toFixed(1)} Hz`, tone: 'acc' },
        { lbl: 'Spektral Sızıntı', val: `%${d.leakagePct.toFixed(2)}`, tone: d.leakagePct < 1 ? 'ok' : d.leakagePct > 10 ? 'bad' : 'warn' },
        { lbl: 'Yan Lob Bastırma', val: winSideLobe },
        { lbl: 'Uyumlu Kazanç CG', val: d.cg.toFixed(3) },
      ]);
    }
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
  });
  wSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    st.wave = b.dataset.w; wSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); syncMode(); update();
  });
  winSeg.addEventListener('click', e => {
    const b = e.target.closest('[data-wi]'); if (!b) return;
    st.windowType = b.dataset.wi; winSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); update();
  });
  bindPresets(host, FOURIER_PRESETS, p => {
    Object.assign(st, p);
    sHarm.set(st.harmonics); sCyc.set(st.cycles); sAmp2.set(st.amp2);
    wSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.w === st.wave));
    winSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.wi === st.windowType));
    syncMode(); update();
  });

  observeResize(host.querySelector('[data-box1]'), update, clean);
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// 16. ÖRNEKLEME & ALIASING (Nyquist, ZOH / Sinc Recon, Quantization SQNR)
// =====================================================================

const SAMP_PRESETS = [
  { label: 'Nyquist Üstü (fs=8f₀)', f0: 3, fs: 24, bits: 6, showZoh: false, showSinc: true, showQuant: false },
  { label: 'Nyquist Sınırı (fs=2.2f₀)', f0: 5, fs: 11, bits: 6, showZoh: false, showSinc: true, showQuant: false },
  { label: 'Aliasing! (fs=1.4f₀)', f0: 7, fs: 10, bits: 6, showZoh: false, showSinc: true, showQuant: false },
  { label: '3-Bit Nicemleme Gürültüsü', f0: 2, fs: 24, bits: 3, showZoh: true, showSinc: false, showQuant: true },
];

function mountSamplingAliasing(host, ctx) {
  const clean = createClean(ctx);
  const st = { f0: 7, fs: 10, bits: 4, showZoh: false, showSinc: true, showQuant: false };
  let data = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('Sürekli bir sinüs sinyalini seçilen $f_s$ hızıyla örnekle; <b>aliasing (katlanma)</b> olayını zaman ve frekans domeninde, <b>ZOH / Sinc geri çatımını</b> ve <b>nicemleme SQNR</b> yasasını canlı gözle.', SAMP_PRESETS)}
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div data-alert></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Zaman Domeni: Örnekleme & Geri Çatım</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,255,255,.35)"></i>Orijinal x(t)</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>Örnekler x[n]</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Sinc / Alias</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>ZOH</span>
          </div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv1 aria-label="Örnekleme zaman grafiği"></canvas></div>
        </div>
        <div class="sle-grid-2">
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Frekans Domeni & Katlanma</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Spektral kopyalar ve Nyquist bölgesi"></canvas></div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">SQNR vs Bit Sayısı (6.02B + 1.76 dB)</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv3 aria-label="SQNR bit grafiği"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'f_s > 2 f_0 \\quad (\\text{Nyquist–Shannon}), \\qquad f_{\\text{alias}} = \\left|f_0 - \\operatorname{round}(f_0/f_s)\\,f_s\\right|',
        'x_{\\text{sinc}}(t) = \\sum_{n=-\\infty}^{\\infty} x[n]\\,\\operatorname{sinc}(f_s t - n), \\qquad \\text{SQNR}_{\\text{dB}} \\approx 6.02\\,B + 1.76',
      ],
      paragraphs: [
        'Örnekleme frekansı $f_s$, sinyal frekansının iki katının ($2f_0$) altına düştüğünde $k f_s \\pm f_0$ spektral kopyaları temel Nyquist bandı $[-f_s/2, +f_s/2]$ içine **katlanır (aliasing)** ve sinyal yanlış, daha düşük bir frekans gibi görünür.',
        '**Sıfırıncı derece tutucu (ZOH)** basamaklı bir yaklaşım üretirken ideal **Sinc interpolasyonu** Nyquist koşulu sağlandığında sinyali hatasız geri çatar.',
        'Her ek **1 bit** çözünürlük nicemleme adımını yarıya indirir ve sinyal/nicemleme-gürültüsü oranını (SQNR) **6.02 dB** artırır.',
      ],
      tasks: [
        '$f_0 = 7\\text{ Hz}, f_s = 10\\text{ Hz}$ iken görünen katlanmış frekansın $3\\text{ Hz}$ ve fazının ters olduğunu doğrula; $f_s$’yi $15\\text{ Hz}$ üzerine çıkarıp aliasing’i yok et.',
        'Bit sayısını $3$’ten $10$’a artırarak her $+1$ bitte SQNR’nin $\\approx 6.02\\text{ dB}$ yükseldiğini gözle.',
        'ZOH ile Sinc geri çatımını aynı anda açıp düşük $f_s$’de ZOH merdiven bozulmasını karşılaştır.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const alertEl = host.querySelector('[data-alert]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const cv3 = host.querySelector('[data-cv3]');

  const sF0 = addSlider(ctrls, { label: 'Sinyal Frekansı f₀', unit: 'Hz', min: 1, max: 14, value: st.f0, step: 0.5, fmt: v => `${v.toFixed(1)} Hz`, onInput: v => { st.f0 = v; update(); } });
  const sFs = addSlider(ctrls, { label: 'Örnekleme Hızı f_s', unit: 'Hz', min: 4, max: 36, value: st.fs, step: 0.5, fmt: v => `${v.toFixed(1)} Hz`, onInput: v => { st.fs = v; update(); } });
  const sBits = addSlider(ctrls, { label: 'Nicemleme Çözünürlüğü B', min: 2, max: 12, value: st.bits, step: 1, fmt: v => `${Math.round(v)} bit (${1 << Math.round(v)} seviye)`, onInput: v => { st.bits = Math.round(v); update(); } });
  const tSinc = addToggle(ctrls, 'Sinc geri çatımını göster', st.showSinc, v => { st.showSinc = v; timeCv.render(); });
  const tZoh = addToggle(ctrls, 'ZOH (basamak tutucu) göster', st.showZoh, v => { st.showZoh = v; timeCv.render(); });
  const tQuant = addToggle(ctrls, 'Nicemleme seviyelerini göster', st.showQuant, v => { st.showQuant = v; timeCv.render(); });

  const timeCv = setupCanvas(cv1, w => Math.min(240, Math.max(195, w * 0.45)), (c, W, H) => {
    if (!data) return;
    c.clearRect(0, 0, W, H);
    const L = 42, R = 14, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
    const mx = t => L + t * pw;
    const my = y => T + ph / 2 - y * (ph * 0.42);
    // Quantization horizontal grid if active
    if (st.showQuant && st.bits <= 5) {
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
      for (let k = 0; k < data.levels; k++) {
        const yv = -1 + (k + 0.5) * data.step;
        c.beginPath(); c.moveTo(L, my(yv)); c.lineTo(L + pw, my(yv)); c.stroke();
      }
    }
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.stroke();

    // Original continuous sine
    c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 1.6;
    c.beginPath();
    data.tCont.forEach((t, i) => { const x = mx(t), y = my(data.xCont[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();

    // ZOH staircase
    if (st.showZoh) {
      c.strokeStyle = COL_BLUE; c.lineWidth = 1.8;
      c.beginPath();
      data.tCont.forEach((t, i) => { const x = mx(t), y = my(data.xZoh[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
    // Sinc / Aliased reconstruction
    if (st.showSinc) {
      c.strokeStyle = data.aliased ? COL_BAD : COL_OK; c.lineWidth = 2.2;
      c.beginPath();
      data.tCont.forEach((t, i) => { const x = mx(t), y = my(data.xSinc[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
    // Sample stems
    const vals = st.showQuant ? data.xQuant : data.xSamp;
    for (let i = 0; i < data.tSamp.length; i++) {
      const x = mx(data.tSamp[i]), y = my(vals[i]);
      c.strokeStyle = COL_WARN; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, my(0)); c.lineTo(x, y); c.stroke();
      c.fillStyle = COL_WARN; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    }
  }, clean);

  const freqCv = setupCanvas(cv2, () => 185, (c, W, H) => {
    if (!data) return;
    c.clearRect(0, 0, W, H);
    const L = 18, R = 18, T = 18, B = 28, pw = W - L - R, ph = H - T - B;
    const fMax = Math.max(20, st.fs * 1.4, st.f0 * 1.4);
    const mx = f => L + ((f + fMax) / (2 * fMax)) * pw;
    const baseY = T + ph;

    // Nyquist baseband zone [-fs/2, +fs/2]
    const nx1 = mx(-data.fNyq), nx2 = mx(data.fNyq);
    c.fillStyle = data.aliased ? 'rgba(255,107,107,.12)' : 'rgba(91,228,155,.1)';
    c.fillRect(nx1, T, nx2 - nx1, ph);
    c.strokeStyle = data.aliased ? 'rgba(255,107,107,.5)' : 'rgba(91,228,155,.45)';
    c.setLineDash([4, 3]);
    c.beginPath(); c.moveTo(nx1, T); c.lineTo(nx1, baseY); c.moveTo(nx2, T); c.lineTo(nx2, baseY); c.stroke();
    c.setLineDash([]);

    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(L, baseY); c.lineTo(L + pw, baseY); c.stroke();

    // Spectral copies
    for (const cp of data.copies) {
      if (Math.abs(cp.f) > fMax) continue;
      const x = mx(cp.f);
      const inNyq = Math.abs(cp.f) <= data.fNyq + 1e-6;
      const col = cp.base ? COL_FG : inNyq ? COL_BAD : 'rgba(90,176,255,.5)';
      drawArrow(c, x, baseY, x, T + (cp.base ? 14 : 26), col, cp.base || inNyq ? 2.2 : 1.4);
    }
    c.font = '10px "JetBrains Mono", monospace'; c.fillStyle = COL_MUTE; c.textAlign = 'center';
    c.fillText(`−fs/2`, nx1, H - 8); c.fillText('0', mx(0), H - 8); c.fillText(`+fs/2`, nx2, H - 8);
  }, clean);

  const sqnrCv = setupCanvas(cv3, () => 185, (c, W, H) => {
    if (!data) return;
    c.clearRect(0, 0, W, H);
    const L = 42, R = 14, T = 16, B = 28, pw = W - L - R, ph = H - T - B;
    const mx = b => L + ((b - 2) / 10) * pw;
    const my = db => T + ph - ((db - 10) / 70) * ph;
    c.font = '10px "JetBrains Mono", monospace';
    c.strokeStyle = COL_GRID;
    for (const db of [20, 40, 60, 80]) {
      const y = my(db);
      c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke();
      c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(`${db}dB`, L - 5, y + 3);
    }
    c.strokeStyle = COL_OK; c.lineWidth = 2.2;
    c.beginPath();
    data.bitAxis.forEach((b, i) => { const x = mx(b), y = my(data.sqnrCurve[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
    // Current bit point
    const cx = mx(st.bits), cy = my(data.sqnrMeasured);
    c.fillStyle = accentColor();
    c.beginPath(); c.arc(cx, cy, 5.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = COL_FG; c.textAlign = 'center';
    c.fillText(`${st.bits}b`, cx, H - 8);
    c.fillText('2b', mx(2), H - 8); c.fillText('12b', mx(12), H - 8);
  }, clean);

  function update() {
    data = simulateSampling({ f0: st.f0, fs: st.fs, bits: st.bits });
    alertEl.innerHTML = data.aliased
      ? `<div class="sle-alert sle-alert-bad">⚠ ALIASING! f_s = ${st.fs.toFixed(1)} Hz &lt; 2f₀ = ${(2 * st.f0).toFixed(1)} Hz. Sinyal ${data.fAlias.toFixed(1)} Hz${data.phaseInverted ? ' (ters fazlı)' : ''} olarak katlanıyor.</div>`
      : `<div class="sle-alert sle-alert-ok">✓ Nyquist koşulu sağlandı (f_s = ${(st.fs / st.f0).toFixed(2)} × f₀). Sinc geri çatımı hatasızdır.</div>`;
    renderKpis(kpis, [
      { lbl: 'Nyquist Sınırı f_s/2', val: `${data.fNyq.toFixed(1)} Hz`, sub: `Gerekli ≥ ${(2 * st.f0).toFixed(1)} Hz` },
      { lbl: 'Görünen Frekans', val: `${data.fAlias.toFixed(2)} Hz`, tone: data.aliased ? 'bad' : 'ok', sub: data.aliased ? 'Katlanmış!' : 'Asıl frekans' },
      { lbl: 'Ölçülen SQNR', val: `${data.sqnrMeasured.toFixed(1)} dB`, sub: `Teorik ${data.sqnrTheory.toFixed(1)} dB`, tone: 'acc' },
      { lbl: 'Nicemleme Adımı Δ', val: data.step.toFixed(4), sub: `${data.levels} seviye` },
    ]);
    timeCv.render(); freqCv.render(); sqnrCv.render();
  }

  bindPresets(host, SAMP_PRESETS, p => {
    Object.assign(st, p);
    sF0.set(st.f0); sFs.set(st.fs); sBits.set(st.bits);
    tZoh.set(st.showZoh); tSinc.set(st.showSinc); tQuant.set(st.showQuant);
    update();
  });
  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// 17. KONVOLÜSYON (Animated Flip-and-Slide Continuous & Discrete)
// =====================================================================

const CONV_PRESETS = [
  { label: 'Dikdörtgen * Dikdörtgen', mode: 'cont', xC: 'rect', hC: 'rect', shiftT: 2.0 },
  { label: 'Dikdörtgen * Üstel (RC)', mode: 'cont', xC: 'rect', hC: 'exp', shiftT: 2.0 },
  { label: 'Üstel * Üstel (t·e⁻ᵗ)', mode: 'cont', xC: 'exp', hC: 'exp', shiftT: 1.5 },
  { label: 'Ayrık Kutu * Kutu', mode: 'disc', xD: 'rect', hD: 'rect', shiftN: 3 },
  { label: 'Ayrık Dürtü (x * δ)', mode: 'disc', xD: 'ramp', hD: 'delay', shiftN: 3 },
];

function mountConvolution(host, ctx) {
  const clean = createClean(ctx);
  const st = { mode: 'cont', xC: 'rect', hC: 'exp', shiftT: 1.8, xD: 'rect', hD: 'rect', shiftN: 3 };
  let playing = autoPlayAllowed();
  let accum = 0;
  let cData = null, dData = null;

  const CONT_OPTS = [['rect', 'Dikdörtgen [0,2]'], ['narrow', 'Dar Darbe [0,1]'], ['tri', 'Üçgen [0,2]'], ['exp', 'Üstel e⁻ᵗ u(t)'], ['sine', 'Sinüs Yarım Dalga'], ['step', 'Basamak [0,4]']];
  const DISC_OPTS = [['rect', 'Kutu [1,1,1,1]'], ['ramp', 'Rampa [0.25..1]'], ['exp', 'Üstel 0.65ⁿ'], ['delta', 'Dürtü δ[n]'], ['delay', 'Gecikmeli δ[n−2]'], ['bipolar', 'Çift Kutuplu [1,1,−1,−1]']];

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>Sürekli</b> ve <b>ayrık</b> konvolüsyonun <b>çevir–kaydır–çarp–topla (flip-and-slide)</b> mekanizmasını canlı animasyonla izle; üstte örtüşme alanı, altta çıkış $y$ eşzamanlı çizilir.', CONV_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg" role="tablist" data-mode aria-label="Konvolüsyon türü">
        <button type="button" data-m="cont" class="on">Sürekli (x * h)(t)</button>
        <button type="button" data-m="disc">Ayrık (x * h)[n]</button>
      </div>
      <div class="sle-toolbar-g">
        <button type="button" class="btn small" data-play></button>
        <button type="button" class="btn small ghost" data-reset>${icon('rotate')} Başa Al</button>
      </div>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls>
        <label><span>Sinyal x</span><select class="inp sle-sel" data-selx aria-label="Sinyal x seçimi"></select></label>
        <label><span>Dürtü Yanıtı h</span><select class="inp sle-sel" data-selh aria-label="Dürtü yanıtı h seçimi"></select></label>
      </div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t1>Çevrilmiş ve Kaydırılmış Çarpım: x(τ) · h(t − τ)</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_BLUE}"></i>x (sabit)</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_WARN}"></i>h (çevrilmiş)</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Örtüşme Çarpımı</span>
          </div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv1 aria-label="Çevir ve kaydır görseli"></canvas></div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title" data-t2>Konvolüsyon Çıkışı y(t) = (x * h)(t)</h4></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Konvolüsyon çıkışı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '(x * h)(t) = \\int_{-\\infty}^{\\infty} x(\\tau)\\,h(t - \\tau)\\,d\\tau, \\qquad (x * h)[n] = \\sum_{k=-\\infty}^{\\infty} x[k]\\,h[n - k]',
        'x * h = h * x \\quad (\\text{Değişme}), \\qquad x * \\delta(t - t_0) = x(t - t_0)',
      ],
      paragraphs: [
        'Bir LTI sistemin herhangi bir $x$ girişine cevabı, $x$ ile sistemin dürtü yanıtı $h$’nin **konvolüsyonudur**.',
        'Her $t$ (veya $n$) kaydırmasında $h$ ters çevrilir, $t$ kadar sağa kaydırılır ve $x$ ile noktasal çarpılarak yeşil taralı alan (veya ayrık toplam) hesaplanır.',
      ],
      tasks: [
        'İki dikdörtgeni konvolüsyona sokup çıkışın tam $t = 2$’de $2.0$ tepe değerine ulaşan bir üçgen olduğunu doğrula.',
        '$x$ ve $h$ seçimlerini yer değiştirip ($x*h = h*x$) çıkış grafiğinin değişmediğini gör.',
        'Ayrık modda $h$ olarak gecikmeli dürtü $\\delta[n-2]$ seçip çıkışın $x[n-2]$ olduğunu gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const selX = host.querySelector('[data-selx]');
  const selH = host.querySelector('[data-selh]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sShiftT = addSlider(ctrls, { label: 'Kaydırma t', min: -1.5, max: 5.8, value: st.shiftT, step: 0.05, fmt: v => `t = ${v.toFixed(2)}`, onInput: v => { st.shiftT = v; update(); } });
  const sShiftN = addSlider(ctrls, { label: 'Kaydırma n', min: -2, max: 9, value: st.shiftN, step: 1, fmt: v => `n = ${Math.round(v)}`, onInput: v => { st.shiftN = Math.round(v); update(); } });

  function fillSelects() {
    const opts = st.mode === 'cont' ? CONT_OPTS : DISC_OPTS;
    const vx = st.mode === 'cont' ? st.xC : st.xD;
    const vh = st.mode === 'cont' ? st.hC : st.hD;
    selX.innerHTML = opts.map(([k, l]) => `<option value="${k}" ${k === vx ? 'selected' : ''}>${l}</option>`).join('');
    selH.innerHTML = opts.map(([k, l]) => `<option value="${k}" ${k === vh ? 'selected' : ''}>${l}</option>`).join('');
  }

  const topCv = setupCanvas(cv1, w => Math.min(220, Math.max(180, w * 0.42)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const L = 40, R = 14, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
    c.font = '10.5px "JetBrains Mono", monospace';
    if (st.mode === 'cont' && cData) {
      const xMin = -3, xMax = 6.5, yMin = -0.35, yMax = 1.35;
      const mx = v => L + ((v - xMin) / (xMax - xMin)) * pw;
      const my = y => T + ((yMax - y) / (yMax - yMin)) * ph;
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.moveTo(mx(0), T); c.lineTo(mx(0), T + ph); c.stroke();

      // Shaded overlap product
      c.fillStyle = 'rgba(91,228,155,.32)';
      c.beginPath(); c.moveTo(mx(cData.tau[0]), my(0));
      cData.tau.forEach((tv, i) => { if (tv >= xMin && tv <= xMax) c.lineTo(mx(tv), my(cData.prod[i])); });
      c.lineTo(mx(xMax), my(0)); c.closePath(); c.fill();

      // x(tau)
      c.strokeStyle = COL_BLUE; c.lineWidth = 2.2;
      c.beginPath();
      cData.tau.forEach((tv, i) => { const x = mx(tv), y = my(cData.xTau[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();

      // h(t - tau)
      c.strokeStyle = COL_WARN; c.lineWidth = 2.2;
      c.beginPath();
      cData.tau.forEach((tv, i) => { const x = mx(tv), y = my(cData.hFlip[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();

      for (let t = -2; t <= 6; t++) { c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${t}`, mx(t), H - 8); }
    } else if (st.mode === 'disc' && dData) {
      const kMin = dData.ks[0] - 0.5, kMax = dData.ks[dData.ks.length - 1] + 0.5;
      const mx = k => L + ((k - kMin) / (kMax - kMin)) * pw;
      const my = y => T + ((1.4 - y) / 2.6) * ph;
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.stroke();
      dData.ks.forEach((k, i) => {
        const x = mx(k);
        // x[k]
        if (Math.abs(dData.xk[i]) > 1e-6) {
          c.strokeStyle = COL_BLUE; c.lineWidth = 2.2;
          c.beginPath(); c.moveTo(x - 3, my(0)); c.lineTo(x - 3, my(dData.xk[i])); c.stroke();
          c.fillStyle = COL_BLUE; c.beginPath(); c.arc(x - 3, my(dData.xk[i]), 4, 0, Math.PI * 2); c.fill();
        }
        // h[n-k]
        if (Math.abs(dData.hFlip[i]) > 1e-6) {
          c.strokeStyle = COL_WARN; c.lineWidth = 2.2;
          c.beginPath(); c.moveTo(x + 3, my(0)); c.lineTo(x + 3, my(dData.hFlip[i])); c.stroke();
          c.fillStyle = COL_WARN; c.beginPath(); c.arc(x + 3, my(dData.hFlip[i]), 4, 0, Math.PI * 2); c.fill();
        }
        // Highlight product bar
        if (Math.abs(dData.prod[i]) > 1e-6) {
          c.fillStyle = 'rgba(91,228,155,.35)';
          const y0 = my(0), yp = my(dData.prod[i]);
          c.fillRect(x - 7, Math.min(y0, yp), 14, Math.abs(yp - y0));
        }
        c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${k}`, x, H - 8);
      });
    }
  }, clean);

  const botCv = setupCanvas(cv2, w => Math.min(200, Math.max(165, w * 0.38)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const L = 40, R = 14, T = 14, B = 26, pw = W - L - R, ph = H - T - B;
    c.font = '10.5px "JetBrains Mono", monospace';
    if (st.mode === 'cont' && cData) {
      const xMin = -2, xMax = 6;
      const yMax = Math.max(0.5, ...cData.yAxis.map(Math.abs)) * 1.18;
      const yMin = Math.min(0, ...cData.yAxis) - yMax * 0.1;
      const mx = t => L + ((t - xMin) / (xMax - xMin)) * pw;
      const my = y => T + ((yMax - y) / (yMax - yMin)) * ph;
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.stroke();

      // Ghost full curve
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; c.setLineDash([4, 4]);
      c.beginPath();
      cData.tAxis.forEach((tv, i) => { const x = mx(tv), y = my(cData.yAxis[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke(); c.setLineDash([]);

      // Active traced curve up to shiftT
      c.strokeStyle = COL_OK; c.lineWidth = 2.6;
      c.beginPath(); let started = false;
      cData.tAxis.forEach((tv, i) => {
        if (tv > st.shiftT) return;
        const x = mx(tv), y = my(cData.yAxis[i]);
        if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
      });
      c.stroke();

      // Glowing current point
      c.fillStyle = accentColor();
      c.beginPath(); c.arc(mx(st.shiftT), my(cData.yNow), 5.5, 0, Math.PI * 2); c.fill();
      for (let t = -2; t <= 6; t++) { c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${t}`, mx(t), H - 8); }
    } else if (st.mode === 'disc' && dData) {
      const N = dData.y.length;
      const yMax = Math.max(0.5, ...dData.y.map(Math.abs)) * 1.25;
      const yMin = Math.min(0, ...dData.y) - yMax * 0.15;
      const mx = n => L + ((n + 1) / (N + 2)) * pw;
      const my = y => T + ((yMax - y) / (yMax - yMin)) * ph;
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.stroke();
      dData.y.forEach((v, n) => {
        const x = mx(n), active = n <= st.shiftN, cur = n === st.shiftN;
        c.strokeStyle = cur ? accentColor() : active ? COL_OK : 'rgba(255,255,255,.22)';
        c.lineWidth = cur ? 3 : 2;
        c.beginPath(); c.moveTo(x, my(0)); c.lineTo(x, my(v)); c.stroke();
        c.fillStyle = c.strokeStyle;
        c.beginPath(); c.arc(x, my(v), cur ? 5.5 : 4, 0, Math.PI * 2); c.fill();
        c.fillStyle = COL_MUTE; c.textAlign = 'center'; c.fillText(`${n}`, x, H - 8);
      });
    }
  }, clean);

  const loop = createAnimLoop((_, dt) => {
    if (st.mode === 'cont') {
      st.shiftT += dt * 1.1;
      if (st.shiftT > 5.8) st.shiftT = -1.5;
      sShiftT.set(st.shiftT);
      update();
    } else {
      accum += dt;
      if (accum >= 0.55) {
        accum = 0;
        st.shiftN++;
        if (st.shiftN > 8) st.shiftN = -1;
        sShiftN.set(st.shiftN);
        update();
      }
    }
    return playing;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    sShiftT.setVisible(st.mode === 'cont');
    sShiftN.setVisible(st.mode === 'disc');
    fillSelects();
    syncSegments(host, false);
  }

  function update() {
    if (st.mode === 'cont') {
      cData = continuousConvolution(st.xC, st.hC, { shiftT: st.shiftT });
      const peak = Math.max(...cData.yAxis);
      renderKpis(kpis, [
        { lbl: 'Kaydırma t', val: st.shiftT.toFixed(2), tone: 'acc' },
        { lbl: 'Anlık Çıkış y(t)', val: cData.yNow.toFixed(3), tone: 'ok' },
        { lbl: 'Tepe Değer', val: peak.toFixed(3) },
      ]);
    } else {
      dData = discreteConvolution(discreteSignal(st.xD), discreteSignal(st.hD), st.shiftN);
      renderKpis(kpis, [
        { lbl: 'İndis n', val: `${st.shiftN}`, tone: 'acc' },
        { lbl: 'Anlık y[n]', val: dData.yNow.toFixed(3), tone: 'ok' },
        { lbl: 'Çıkış Uzunluğu', val: `${dData.y.length} örnek`, sub: `L_x + L_h − 1` },
      ]);
    }
    topCv.render(); botCv.render();
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
  });
  selX.addEventListener('change', () => { if (st.mode === 'cont') st.xC = selX.value; else st.xD = selX.value; update(); });
  selH.addEventListener('change', () => { if (st.mode === 'cont') st.hC = selH.value; else st.hD = selH.value; update(); });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => {
    st.shiftT = -1.5; st.shiftN = -1; sShiftT.set(st.shiftT); sShiftN.set(st.shiftN); update();
  });
  bindPresets(host, CONV_PRESETS, p => {
    Object.assign(st, p);
    sShiftT.set(st.shiftT); sShiftN.set(st.shiftN);
    syncMode(); update();
  });

  bindTasks(host);
  syncMode();
  update();
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 18. DİJİTAL FİLTRE (FIR Window Method + IIR Butterworth Bilinear + Live)
// =====================================================================

const DFILT_PRESETS = [
  { label: 'FIR LP (Hamming, 21)', kind: 'FIR', band: 'lowpass', fc: 0.16, fc2: 0.34, taps: 21, win: 'hamming', order: 2, noise: 0.35 },
  { label: 'FIR Bant Geçiren', kind: 'FIR', band: 'bandpass', fc: 0.12, fc2: 0.3, taps: 31, win: 'blackman', order: 2, noise: 0.3 },
  { label: 'IIR Butterworth 2. Der. LP', kind: 'IIR', band: 'lowpass', fc: 0.16, fc2: 0.34, taps: 21, win: 'hamming', order: 2, noise: 0.35 },
  { label: 'IIR Butterworth 4. Der. HP', kind: 'IIR', band: 'highpass', fc: 0.25, fc2: 0.38, taps: 21, win: 'hamming', order: 4, noise: 0.3 },
  { label: 'IIR Bant Geçiren', kind: 'IIR', band: 'bandpass', fc: 0.15, fc2: 0.32, taps: 21, win: 'hamming', order: 4, noise: 0.3 },
];

function mountDigitalFilter(host, ctx) {
  const clean = createClean(ctx);
  const st = { kind: 'IIR', band: 'lowpass', fc: 0.16, fc2: 0.34, taps: 21, win: 'hamming', order: 2, noise: 0.35 };
  let playing = autoPlayAllowed();
  let phaseOffset = 0;
  let filt = null, freqResp = null;

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>FIR (pencere yöntemi)</b> ve <b>IIR (Butterworth bilineer dönüşüm)</b> dijital filtreleri tasarla; frekans yanıtını, <b>z-düzlemi kutup–sıfır</b> haritasını ve gürültülü sinyalin canlı süzülmesini izle.', DFILT_PRESETS)}
    <div class="sle-toolbar">
      <div class="sle-toolbar-g">
        <div class="seg" role="tablist" data-kind aria-label="Filtre mimarisi">
          <button type="button" data-k="FIR">FIR (Pencere)</button>
          <button type="button" data-k="IIR" class="on">IIR (Butterworth)</button>
        </div>
        <div class="seg" role="tablist" data-band aria-label="Geçirme bandı">
          <button type="button" data-b="lowpass" class="on">Alçak Geçiren</button>
          <button type="button" data-b="highpass">Yüksek Geçiren</button>
          <button type="button" data-b="bandpass">Bant Geçiren</button>
        </div>
      </div>
      <button type="button" class="btn small" data-play></button>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls></div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-grid-2">
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">Frekans Yanıtı |H(e^{jω})| (dB)</h4></div>
            <div class="sle-cv-box" data-box1><canvas class="sle-cv" data-cv1 aria-label="Dijital filtre genlik yanıtı"></canvas></div>
            <div class="sle-axis-lbl">Normalize Frekans f / f_s (0 … 0.5)</div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title">z-Düzlemi Kutup (×) & Sıfır (○)</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="z-düzlemi kutup sıfır grafiği"></canvas></div>
          </div>
        </div>
        <div class="sle-plot-card">
          <div class="sle-head"><h4 class="sle-title">Canlı Gürültülü Sinyal Süzme</h4><div class="sle-legend">
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:rgba(255,255,255,.3)"></i>Gürültülü Giriş x[n]</span>
            <span class="sle-legend-item"><i class="sle-legend-swatch" style="background:${COL_OK}"></i>Süzülmüş Çıkış y[n]</span>
          </div></div>
          <div class="sle-cv-box"><canvas class="sle-cv" data-cv3 aria-label="Canlı filtrelenmiş sinyal"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{FIR: } h[n] = w[n]\\,\\frac{\\sin(2\\pi f_c (n - M))}{\\pi (n - M)}, \\qquad y[n] = \\sum_{k=0}^{N-1} b_k x[n-k]',
        '\\text{Bilineer: } s = \\frac{1 - z^{-1}}{1 + z^{-1}}, \\qquad \\Omega_c = \\tan(\\pi f_c), \\qquad |p_k| < 1 \\iff \\text{Kararlı}',
      ],
      paragraphs: [
        '**FIR filtreler** tüm kutupları orijinde ($z=0$) olduğu için daima BIBO kararlıdır ve simetrik katsayılarla doğrusal faz verir; ancak keskin geçiş için daha yüksek katsayı sayısı ($N$) gerekir.',
        '**IIR Butterworth** bilineer dönüşümle ön-bükülerek ($\\Omega_c = \\tan(\\pi f_c)$) kesim frekansında tam $-3.01\\text{ dB}$ sağlar ve çok daha düşük derecede keskin geçiş sunar.',
      ],
      tasks: [
        'IIR Butterworth 2. derece ile 4. dereceyi karşılaştır: durdurma bandı eğiminin nasıl dikleştiğini ve kutupların birim çembere nasıl yaklaştığını gözle.',
        'FIR modunda pencereyi Dikdörtgen’den Blackman’a çevirip durdurma bandı bastırmasının nasıl derinleştiğini incele.',
        'Alçak geçiren filtrenin kesim frekansını $f_c = 0.14$ yapıp yüksek frekanslı girişimin (0.38 f_s) süzülüşünü canlı sinyalde gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');
  const cv3 = host.querySelector('[data-cv3]');

  const sFc = addSlider(ctrls, { label: 'Kesim Frekansı f_c / f_s', min: 0.04, max: 0.45, value: st.fc, step: 0.01, fmt: v => `${v.toFixed(2)} f_s`, onInput: v => { st.fc = v; updateDesign(); } });
  const sFc2 = addSlider(ctrls, { label: 'Üst Kesim f_c2 / f_s', min: 0.1, max: 0.47, value: st.fc2, step: 0.01, fmt: v => `${v.toFixed(2)} f_s`, onInput: v => { st.fc2 = Math.max(st.fc + 0.04, v); updateDesign(); } });
  const sOrd = addSlider(ctrls, { label: 'Butterworth Derecesi', min: 1, max: 4, value: st.order, step: 1, fmt: v => `${Math.round(v)}. derece`, onInput: v => { st.order = Math.round(v); updateDesign(); } });
  const sTaps = addSlider(ctrls, { label: 'FIR Katsayı Sayısı (Tap)', min: 7, max: 51, value: st.taps, step: 2, fmt: v => `${Math.round(v)} tap`, onInput: v => { st.taps = Math.round(v); updateDesign(); } });
  const winWrap = document.createElement('label');
  winWrap.innerHTML = `<span>FIR Penceresi</span><select class="inp sle-sel" aria-label="FIR pencere seçimi">
    <option value="rect">Dikdörtgen</option><option value="hann">Hann</option><option value="hamming" selected>Hamming</option><option value="blackman">Blackman</option>
  </select>`;
  ctrls.append(winWrap);
  const winSel = winWrap.querySelector('select');
  winSel.addEventListener('change', () => { st.win = winSel.value; updateDesign(); });
  const sNoise = addSlider(ctrls, { label: 'Gürültü Seviyesi σ', min: 0, max: 0.9, value: st.noise, step: 0.05, fmt: v => v.toFixed(2), onInput: v => { st.noise = v; renderLiveSignal(); } });

  const pzCv = setupCanvas(cv2, () => 210, (c, W, H) => {
    if (!filt) return;
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.37;
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(14, cy); c.lineTo(W - 14, cy); c.moveTo(cx, 12); c.lineTo(cx, H - 12); c.stroke();
    // Unit circle
    c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    for (const z of filt.zeros) {
      if (cAbs(z) > 2.2) continue;
      drawRing(c, cx + z.re * R, cy - z.im * R, 5, COL_BLUE, 2);
    }
    for (const p of filt.poles) {
      drawCross(c, cx + p.re * R, cy - p.im * R, 5.5, COL_BAD, 2.2);
    }
    c.font = '10px "JetBrains Mono", monospace'; c.fillStyle = COL_MUTE;
    c.textAlign = 'left'; c.fillText('|z|=1', cx + R + 4, cy - 4);
  }, clean);

  // Pre-generated noise buffer so live scroll is smooth and zero-allocation
  const rng = makeRng(4242);
  const noiseBuf = Array.from({ length: 512 }, () => rng.randn());

  function renderLiveSignal() {
    if (!filt) return;
    const N = 160;
    const ns = new Array(N);
    const raw = new Array(N);
    const cleanSig = new Array(N);
    const shift = Math.floor(phaseOffset);
    // Desired signal matches band (low: 0.05, high: 0.38, band: 0.22)
    const fWant = st.band === 'lowpass' ? 0.045 : st.band === 'highpass' ? 0.37 : 0.22;
    const fInt = st.band === 'lowpass' ? 0.38 : st.band === 'highpass' ? 0.045 : 0.04;
    for (let n = 0; n < N; n++) {
      const k = n + shift;
      ns[n] = n;
      const want = Math.sin(2 * Math.PI * fWant * k);
      const interf = 0.65 * Math.sin(2 * Math.PI * fInt * k);
      const nz = st.noise * noiseBuf[(k % noiseBuf.length + noiseBuf.length) % noiseBuf.length];
      cleanSig[n] = want;
      raw[n] = want + interf + nz;
    }
    const y = applyIIR(filt.b, filt.a, raw);
    safePlot(cv3, [
      { name: 'raw', color: 'rgba(255,255,255,.28)', xs: ns, ys: raw },
      { name: 'y', color: COL_OK, xs: ns, ys: y },
    ], { x0: 0, x1: N - 1, ylabel: 'Genlik', height: 170 });
  }

  const loop = createAnimLoop((_, dt) => {
    phaseOffset = (phaseOffset + dt * 28) % 512;
    renderLiveSignal();
    return playing;
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-kind] button').forEach(b => b.classList.toggle('on', b.dataset.k === st.kind));
    host.querySelectorAll('[data-band] button').forEach(b => b.classList.toggle('on', b.dataset.b === st.band));
    sFc2.setVisible(st.band === 'bandpass');
    sOrd.setVisible(st.kind === 'IIR');
    sTaps.setVisible(st.kind === 'FIR');
    winWrap.hidden = st.kind !== 'FIR';
    syncSegments(host, false);
  }

  function updateDesign() {
    filt = st.kind === 'FIR'
      ? designFIR({ band: st.band, fc: st.fc, fc2: st.fc2, taps: st.taps, windowType: st.win })
      : designButterworthIIR({ band: st.band, order: st.order, fc: st.fc, fc2: st.fc2 });
    freqResp = digitalFreqResponse(filt.b, filt.a, 200);
    const maxP = filt.poles.length ? Math.max(...filt.poles.map(cAbs)) : 0;

    safePlot(cv1, [
      { name: '-3dB', color: 'rgba(255,209,102,.45)', xs: [0, 0.5], ys: [-3, -3] },
      { name: '|H|', color: COL_BLUE, xs: freqResp.freqs, ys: freqResp.magDb.map(v => Math.max(-60, v)) },
    ], { x0: 0, x1: 0.5, ylabel: 'dB', height: 195 });

    renderKpis(kpis, [
      { lbl: 'Mimari & Derece', val: `${filt.kind} · N=${filt.order}`, tone: 'acc' },
      { lbl: 'Kararlılık', val: filt.stable ? '✓ Kararlı' : '✗ Kararsız', sub: `maks |p| = ${maxP.toFixed(3)}`, tone: filt.stable ? 'ok' : 'bad' },
      { lbl: 'Kesim f_c / f_s', val: st.band === 'bandpass' ? `${st.fc.toFixed(2)}–${st.fc2.toFixed(2)}` : `${st.fc.toFixed(2)}` },
      { lbl: 'Katsayı Sayısı', val: `b:${filt.b.length}, a:${filt.a.length}` },
    ]);
    pzCv.render();
    renderLiveSignal();
  }

  host.querySelector('[data-kind]').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b || b.dataset.k === st.kind) return;
    st.kind = b.dataset.k; syncMode(); updateDesign();
  });
  host.querySelector('[data-band]').addEventListener('click', e => {
    const b = e.target.closest('[data-b]'); if (!b || b.dataset.b === st.band) return;
    st.band = b.dataset.b; syncMode(); updateDesign();
  });
  playBtn.addEventListener('click', () => {
    if (isMotionOff()) return;
    playing = !playing; syncPlayBtn(playBtn, playing);
    if (playing) loop.start(); else loop.stop();
  });
  bindPresets(host, DFILT_PRESETS, p => {
    Object.assign(st, p);
    sFc.set(st.fc); sFc2.set(st.fc2); sOrd.set(st.order); sTaps.set(st.taps); winSel.value = st.win; sNoise.set(st.noise);
    syncMode(); updateDesign();
  });
  observeResize(host.querySelector('[data-box1]'), updateDesign, clean);
  bindTasks(host);
  syncMode();
  updateDesign();
  syncPlayBtn(playBtn, playing);
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 19. LAPLACE & z DÖNÜŞÜMÜ (Draggable s-plane / z-plane Poles & Mapping)
// =====================================================================

const LZ_PRESETS = [
  { label: 'Az Sönümlü Kararlı (s)', mode: 's', sigma: -0.6, omega: 4.0, conjugate: true, hasZero: false },
  { label: 'Sınırda Salınım (σ = 0)', mode: 's', sigma: 0.0, omega: 3.5, conjugate: true, hasZero: false },
  { label: 'Kararsız Büyüyen (σ > 0)', mode: 's', sigma: 0.35, omega: 3.0, conjugate: true, hasZero: false },
  { label: 'Birim Çember İçi (z)', mode: 'z', zRe: 0.72, zIm: 0.48, conjugate: true, hasZero: false },
  { label: 'Alternatif Sönüm (z < 0)', mode: 'z', zRe: -0.78, zIm: 0, conjugate: false, hasZero: false },
  { label: 's → z Eşleme (e^{sT})', mode: 'map', sigma: -0.8, omega: 4.5, Ts: 0.25 },
];

function mountLaplaceZ(host, ctx) {
  const clean = createClean(ctx);
  const st = { mode: 's', sigma: -0.6, omega: 4.0, zRe: 0.72, zIm: 0.48, conjugate: true, hasZero: false, zeroRe: -1.5, Ts: 0.25 };

  host.innerHTML = `<div class="sle-wrap">
    ${introHtml('<b>s-düzlemi</b> veya <b>z-düzlemindeki</b> kutbu (×) parmağınla/fareyle <b>sürükle</b> ve karşılık gelen <b>dürtü yanıtının</b> ($h(t)$ veya $h[n]$) kararlılık sınırından geçerken nasıl değiştiğini anında gör.', LZ_PRESETS)}
    <div class="sle-toolbar">
      <div class="seg sle-seg-wrap" role="tablist" data-mode aria-label="Dönüşüm düzlemi">
        <button type="button" data-m="s" class="on">Laplace (s-düzlemi)</button>
        <button type="button" data-m="z">z-Dönüşümü (z-düzlemi)</button>
        <button type="button" data-m="map">s ↔ z Eşleme (e^{sT})</button>
      </div>
      <span class="sle-badge" data-stab>Kararlı</span>
    </div>
    <div class="sle-grid">
      <div class="sle-panel" data-ctrls>
        <p class="sle-hint">Kutup işaretçisini (<b>×</b>) düzlemde doğrudan sürükleyebilirsin. Sol yarı düzlem (σ < 0) veya birim çember içi (|z| < 1) kararlıdır.</p>
      </div>
      <div class="sle-col">
        <div class="sle-kpis" data-kpis></div>
        <div class="sle-grid-2">
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title" data-t1>s-Düzlemi (Kutbu Sürükle)</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv sle-cv-drag" data-cv1 aria-label="Etkileşimli kutup düzlemi"></canvas></div>
          </div>
          <div class="sle-plot-card">
            <div class="sle-head"><h4 class="sle-title" data-t2>Dürtü Yanıtı h(t)</h4></div>
            <div class="sle-cv-box"><canvas class="sle-cv" data-cv2 aria-label="Dürtü yanıtı veya z-düzlemi eşlemesi"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathcal{L}^{-1}\\!\\left\\{\\frac{\\omega_d}{(s-\\sigma)^2 + \\omega_d^2}\\right\\} = e^{\\sigma t}\\sin(\\omega_d t)\\,u(t), \\qquad \\text{Kararlılık: } \\sigma < 0',
        '\\mathcal{Z}^{-1}\\!\\left\\{\\frac{z^2 - z r\\cos\\theta}{z^2 - 2r\\cos\\theta\\,z + r^2}\\right\\} = r^n \\cos(n\\theta)\\,u[n], \\qquad \\text{Kararlılık: } |z| = r < 1',
        'z = e^{s T_s} = e^{\\sigma T_s}\\,e^{j \\omega T_s} \\implies |z| = e^{\\sigma T_s}, \\quad \\angle z = \\omega T_s',
      ],
      paragraphs: [
        '**Laplace dönüşümünde** kutbun gerçel kısmı $\\sigma$ üstel sönüm/büyüme hızını ($e^{\\sigma t}$), sanal kısmı $\\omega_d$ ise salınım frekansını belirler; $j\\omega$ ekseni kararlılık sınırıdır.',
        '**z-dönüşümünde** kararlılık sınırı **birim çemberdir ($|z| = 1$)**; negatif gerçel eksendeki kutup ($\\theta = \\pi$) her örnekte işaret değiştiren $(-1)^n r^n$ salınımı üretir.',
        '**$z = e^{s T_s}$ eşlemesi** s-düzleminin sol yarısını birim çemberin içine, $j\\omega$ eksenini birim çemberin üzerine sarar; $|\\omega T_s| > \\pi$ olduğunda açılar üst üste biner (**aliasing**).',
      ],
      tasks: [
        's-düzleminde kutbu soldan sağa sürükleyerek $\\sigma = 0$ sınırından geçerken sönümlü salınımın nasıl büyüyen salınıma dönüştüğünü gör.',
        'z-düzleminde tek gerçel kutbu ($\\text{Eşlenik Çift}$ kapalı) $+0.8$’den $-0.8$’e sürükleyip tekdüze sönüm ile işaret değiştiren salınımı karşılaştır.',
        's ↔ z Eşleme modunda $T_s$’yi artırarak $\\omega T_s > \\pi$ katlanma sınırına ulaş.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const stabEl = host.querySelector('[data-stab]');
  const t1 = host.querySelector('[data-t1]');
  const t2 = host.querySelector('[data-t2]');
  const cv1 = host.querySelector('[data-cv1]');
  const cv2 = host.querySelector('[data-cv2]');

  const sSig = addSlider(ctrls, { label: 'Gerçel Kısım σ', min: -3.0, max: 1.5, value: st.sigma, step: 0.05, fmt: v => fmtFix(v, 2), onInput: v => { st.sigma = v; update(); } });
  const sOmg = addSlider(ctrls, { label: 'Sanal Kısım ω', min: 0, max: 10.0, value: st.omega, step: 0.1, fmt: v => `${v.toFixed(1)} rad/s`, onInput: v => { st.omega = v; update(); } });
  const sZre = addSlider(ctrls, { label: 'Re(p) (z-düzlemi)', min: -1.35, max: 1.35, value: st.zRe, step: 0.02, fmt: v => fmtFix(v, 2), onInput: v => { st.zRe = v; update(); } });
  const sZim = addSlider(ctrls, { label: 'Im(p) (z-düzlemi)', min: 0, max: 1.35, value: st.zIm, step: 0.02, fmt: v => fmtFix(v, 2), onInput: v => { st.zIm = v; update(); } });
  const sTs = addSlider(ctrls, { label: 'Örnekleme Periyodu T_s', unit: 's', min: 0.05, max: 1.0, value: st.Ts, step: 0.02, fmt: v => `${v.toFixed(2)} s`, onInput: v => { st.Ts = v; update(); } });
  const tConj = addToggle(ctrls, 'Karmaşık eşlenik çift (p, p*)', st.conjugate, v => { st.conjugate = v; syncMode(); update(); });
  const tZero = addToggle(ctrls, 'Gerçel sıfır ekle', st.hasZero, v => { st.hasZero = v; update(); });

  let leftGeom = { cx: 140, cy: 140, scX: 50, scY: 20 };
  let respData = null;

  const leftCv = setupCanvas(cv1, w => Math.min(310, Math.max(245, w * 0.9)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    c.font = '10.5px "JetBrains Mono", monospace';
    if (st.mode === 's' || st.mode === 'map') {
      const cx = W * 0.65, cy = H / 2;
      const scX = (W * 0.54) / 3.2, scY = (H * 0.42) / 10;
      leftGeom = { cx, cy, scX, scY };
      // Stable LHP tint & unstable RHP tint
      c.fillStyle = 'rgba(91,228,155,.05)'; c.fillRect(0, 0, cx, H);
      c.fillStyle = 'rgba(255,107,107,.06)'; c.fillRect(cx, 0, W - cx, H);
      // Axes
      c.strokeStyle = COL_AXIS; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(10, cy); c.lineTo(W - 10, cy); c.moveTo(cx, 10); c.lineTo(cx, H - 10); c.stroke();
      // Nyquist strip in map mode: ±pi/Ts
      if (st.mode === 'map') {
        const wNyq = Math.PI / st.Ts;
        if (wNyq <= 10.5) {
          c.strokeStyle = 'rgba(255,209,102,.45)'; c.setLineDash([4, 3]);
          c.beginPath();
          c.moveTo(10, cy - wNyq * scY); c.lineTo(W - 10, cy - wNyq * scY);
          c.moveTo(10, cy + wNyq * scY); c.lineTo(W - 10, cy + wNyq * scY);
          c.stroke(); c.setLineDash([]);
        }
      }
      // Poles
      const px = cx + st.sigma * scX;
      const py = cy - (st.conjugate || st.mode === 'map' ? st.omega : 0) * scY;
      drawCross(c, px, py, 7.5, acc, 2.6);
      if ((st.conjugate || st.mode === 'map') && st.omega > 0.05) {
        drawCross(c, px, cy + st.omega * scY, 7, acc, 2.2);
      }
      if (st.mode === 's' && st.hasZero) drawRing(c, cx + st.zeroRe * scX, cy, 6, COL_BLUE, 2.2);
      c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText('σ = Re(s)', W - 12, cy - 6);
      c.textAlign = 'left'; c.fillText('jω', cx + 6, 18);
    } else {
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32;
      leftGeom = { cx, cy, scX: R, scY: R };
      // Stable interior fill
      c.fillStyle = 'rgba(91,228,155,.07)';
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.38)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = COL_AXIS; c.lineWidth = 1;
      c.beginPath(); c.moveTo(10, cy); c.lineTo(W - 10, cy); c.moveTo(cx, 10); c.lineTo(cx, H - 10); c.stroke();

      const px = cx + st.zRe * R;
      const py = cy - (st.conjugate ? st.zIm : 0) * R;
      drawCross(c, px, py, 7.5, acc, 2.6);
      if (st.conjugate && st.zIm > 0.02) drawCross(c, px, cy + st.zIm * R, 7, acc, 2.2);
      if (st.hasZero) drawRing(c, cx - 0.5 * R, cy, 6, COL_BLUE, 2.2);
      c.fillStyle = COL_MUTE; c.textAlign = 'left'; c.fillText('|z|=1', cx + R + 4, cy - 5);
    }
  }, clean);

  const rightCv = setupCanvas(cv2, w => Math.min(310, Math.max(245, w * 0.9)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    c.font = '10.5px "JetBrains Mono", monospace';
    if (st.mode === 's' && respData) {
      const L = 40, R = 14, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
      const maxA = Math.min(25, Math.max(1.2, ...respData.h.map(Math.abs))) * 1.15;
      const mx = t => L + (t / 6) * pw;
      const my = y => T + ph / 2 - Math.max(-1.1, Math.min(1.1, y / maxA)) * (ph * 0.45);
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.stroke();
      // Envelope e^{sigma t}
      if (st.conjugate && st.omega > 0.1) {
        c.strokeStyle = 'rgba(255,209,102,.35)'; c.setLineDash([4, 3]); c.lineWidth = 1.3;
        c.beginPath();
        respData.t.forEach((t, i) => { const e = Math.exp(Math.min(5, st.sigma * t)); i ? c.lineTo(mx(t), my(e)) : c.moveTo(mx(t), my(e)); });
        c.stroke(); c.setLineDash([]);
      }
      c.strokeStyle = respData.stability === 'Kararlı' ? COL_OK : respData.stability === 'Kararsız' ? COL_BAD : COL_WARN;
      c.lineWidth = 2.3;
      c.beginPath();
      respData.t.forEach((t, i) => { const x = mx(t), y = my(respData.h[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
      c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText('t = 6 s', L + pw, H - 8);
    } else if (st.mode === 'z' && respData) {
      const L = 40, R = 14, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
      const N = respData.h.length;
      const maxA = Math.min(25, Math.max(1.2, ...respData.h.map(Math.abs))) * 1.15;
      const mx = n => L + (n / (N - 1)) * pw;
      const my = y => T + ph / 2 - Math.max(-1.1, Math.min(1.1, y / maxA)) * (ph * 0.45);
      c.strokeStyle = COL_AXIS;
      c.beginPath(); c.moveTo(L, my(0)); c.lineTo(L + pw, my(0)); c.stroke();
      const col = respData.stability === 'Kararlı' ? COL_OK : respData.stability === 'Kararsız' ? COL_BAD : COL_WARN;
      respData.h.forEach((v, n) => {
        const x = mx(n), y = my(v);
        c.strokeStyle = col; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(x, my(0)); c.lineTo(x, y); c.stroke();
        c.fillStyle = col; c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill();
      });
      c.fillStyle = COL_MUTE; c.textAlign = 'right'; c.fillText(`n = ${N - 1}`, L + pw, H - 8);
    } else if (st.mode === 'map') {
      // z-plane image of z = e^{s Ts}
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
      c.fillStyle = 'rgba(91,228,155,.07)';
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.38)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = COL_AXIS; c.lineWidth = 1;
      c.beginPath(); c.moveTo(10, cy); c.lineTo(W - 10, cy); c.moveTo(cx, 10); c.lineTo(cx, H - 10); c.stroke();
      // Constant-sigma circle r = e^{sigma*Ts}
      const m = sToZMap(st.sigma, st.omega, st.Ts);
      const rVis = Math.min(1.42, m.r);
      c.strokeStyle = 'rgba(90,176,255,.45)'; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(cx, cy, rVis * R, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      // Mapped conjugate points
      const px = cx + rVis * Math.cos(m.theta) * R;
      const py = cy - rVis * Math.sin(m.theta) * R;
      drawCross(c, px, py, 7.5, m.r < 1 ? COL_OK : COL_BAD, 2.6);
      drawCross(c, px, cy + rVis * Math.sin(m.theta) * R, 6.5, m.r < 1 ? COL_OK : COL_BAD, 2);
      c.fillStyle = COL_MUTE; c.textAlign = 'left'; c.fillText(`|z| = ${m.r.toFixed(3)}`, 12, 18);
    }
  }, clean);

  const applyDrag = p => {
    if (st.mode === 's' || st.mode === 'map') {
      st.sigma = Math.max(-3, Math.min(1.5, +((p.x - leftGeom.cx) / leftGeom.scX).toFixed(2)));
      st.omega = Math.max(0, Math.min(10, +(Math.abs(leftGeom.cy - p.y) / leftGeom.scY).toFixed(2)));
      sSig.set(st.sigma); sOmg.set(st.omega);
    } else {
      st.zRe = Math.max(-1.35, Math.min(1.35, +((p.x - leftGeom.cx) / leftGeom.scX).toFixed(2)));
      st.zIm = st.conjugate ? Math.max(0, Math.min(1.35, +(Math.abs(leftGeom.cy - p.y) / leftGeom.scY).toFixed(2))) : 0;
      sZre.set(st.zRe); sZim.set(st.zIm);
    }
    update();
  };
  bindDragCanvas(cv1, {
    onDown: p => { applyDrag(p); return true; },
    onMove: (p, dragging) => { if (dragging) applyDrag(p); },
  }, clean);

  function syncMode() {
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    const isS = st.mode === 's', isZ = st.mode === 'z', isMap = st.mode === 'map';
    sSig.setVisible(isS || isMap);
    sOmg.setVisible((isS && st.conjugate) || isMap);
    sZre.setVisible(isZ);
    sZim.setVisible(isZ && st.conjugate);
    sTs.setVisible(isMap);
    tConj.setVisible(!isMap);
    tZero.setVisible(!isMap);
    syncSegments(host, false);
  }

  function update() {
    if (st.mode === 's') {
      t1.textContent = 's-Düzlemi (Kutbu Sürükle)';
      t2.textContent = 'Sürekli Dürtü Yanıtı h(t)';
      respData = laplacePoleResponse({ sigma: st.sigma, omega: st.omega, conjugate: st.conjugate, hasZero: st.hasZero, zeroRe: st.zeroRe });
      stabEl.textContent = respData.stability;
      stabEl.className = `sle-badge ${respData.stability === 'Kararlı' ? 'sle-badge-ok' : respData.stability === 'Kararsız' ? 'sle-badge-bad' : 'sle-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'Kutup Konumu', val: st.conjugate ? `${st.sigma.toFixed(2)} ± j${st.omega.toFixed(2)}` : `${st.sigma.toFixed(2)}`, tone: 'acc' },
        { lbl: 'Sönüm ζ / ω_n', val: `${respData.zeta.toFixed(2)} / ${respData.wn.toFixed(2)}` },
        { lbl: 'ROC (Nedensel)', val: respData.roc },
        { lbl: 'Zaman Sabiti τ', val: Number.isFinite(respData.tau) ? `${respData.tau.toFixed(2)} s` : '∞' },
      ]);
    } else if (st.mode === 'z') {
      t1.textContent = 'z-Düzlemi (Kutbu Sürükle)';
      t2.textContent = 'Ayrık Dürtü Yanıtı h[n]';
      respData = zPoleResponse({ re: st.zRe, im: st.zIm, conjugate: st.conjugate, hasZero: st.hasZero });
      stabEl.textContent = respData.stability;
      stabEl.className = `sle-badge ${respData.stability === 'Kararlı' ? 'sle-badge-ok' : respData.stability === 'Kararsız' ? 'sle-badge-bad' : 'sle-badge-warn'}`;
      renderKpis(kpis, [
        { lbl: 'Yarıçap |p|', val: respData.r.toFixed(3), tone: respData.r < 1 ? 'ok' : 'bad' },
        { lbl: 'Açı θ', val: `${respData.thetaDeg.toFixed(1)}°`, sub: `${(respData.theta / Math.PI).toFixed(2)}π rad` },
        { lbl: 'ROC (Nedensel)', val: respData.roc, tone: 'acc' },
        { lbl: 'Kararlılık', val: respData.stability },
      ]);
    } else {
      t1.textContent = 's-Düzlemi (s = σ + jω Sürükle)';
      t2.textContent = 'z-Düzlemi Görüntüsü (z = e^{s T_s})';
      const m = sToZMap(st.sigma, st.omega, st.Ts);
      stabEl.textContent = m.aliased ? '⚠ Katlanma (|ωT| > π)' : m.r < 1 ? '✓ Kararlı (|z| < 1)' : '✗ Kararsız (|z| ≥ 1)';
      stabEl.className = `sle-badge ${m.aliased ? 'sle-badge-warn' : m.r < 1 ? 'sle-badge-ok' : 'sle-badge-bad'}`;
      renderKpis(kpis, [
        { lbl: 's Kutbu', val: `${st.sigma.toFixed(2)} ± j${st.omega.toFixed(1)}`, tone: 'acc' },
        { lbl: 'z Yarıçapı e^{σT}', val: m.r.toFixed(3), tone: m.r < 1 ? 'ok' : 'bad' },
        { lbl: 'z Açısı ωT', val: `${m.thetaDeg.toFixed(1)}°`, sub: `${(m.theta / Math.PI).toFixed(2)}π rad` },
        { lbl: 'Katlanma Durumu', val: m.aliased ? 'Aliasing var!' : 'Temel şeritte' },
      ]);
    }
    leftCv.render(); rightCv.render();
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m; syncMode(); update();
  });
  bindPresets(host, LZ_PRESETS, p => {
    Object.assign(st, p);
    sSig.set(st.sigma); sOmg.set(st.omega); sZre.set(st.zRe); sZim.set(st.zIm); sTs.set(st.Ts);
    tConj.set(st.conjugate); tZero.set(st.hasZero);
    syncMode(); update();
  });
  bindTasks(host);
  syncMode();
  update();
  return clean.run;
}

// =====================================================================
// MODULE EXPORT CONTRACT (consumed by js/simcenter.js)
// =====================================================================

export const SIMS = [
  // Field: eee (10 new simulations)
  { id: 'diode-rectifier',    field: 'eee',     title: 'Diyot & Doğrultucu',   icon: 'wave',    mount: mountDiodeRectifier },
  { id: 'transistor-curves',  field: 'eee',     title: 'Transistör Eğrileri',  icon: 'chart',   mount: mountTransistorCurves },
  { id: 'power-electronics',  field: 'eee',     title: 'Güç Elektroniği',      icon: 'wave',    mount: mountPowerElectronics },
  { id: 'three-phase-power',  field: 'eee',     title: 'Üç Faz & Güç',         icon: 'phasor',  mount: mountThreePhase },
  { id: 'transformer-motor',  field: 'eee',     title: 'Transformatör & Motor', icon: 'rotate', mount: mountTransformerMotor },
  { id: 'transmission-line',  field: 'eee',     title: 'İletim Hattı & Smith', icon: 'wave',    mount: mountTransmissionLine },
  { id: 'em-fields',          field: 'eee',     title: 'Elektromanyetik Alan', icon: 'atom',    mount: mountEMFields },
  { id: 'antenna-pattern',    field: 'eee',     title: 'Anten Işıma Diyagramı', icon: 'sparkle', mount: mountAntennaPattern },
  { id: 'communications',     field: 'eee',     title: 'Haberleşme & BER',     icon: 'wave',    mount: mountCommunications },
  { id: 'digital-circuits',   field: 'eee',     title: 'Dijital Devreler',     icon: 'grid',    mount: mountDigitalCircuits },

  // Field: kontrol (9 simulations)
  { id: 'pid-control',        field: 'kontrol', title: 'PID Kontrol',          icon: 'chart',   mount: mountPIDControl },
  { id: 'root-locus',         field: 'kontrol', title: 'Kök Yer Eğrisi',       icon: 'phasor',  mount: mountRootLocus },
  { id: 'bode-nyquist',       field: 'kontrol', title: 'Bode & Nyquist',       icon: 'chart',   mount: mountBodeNyquist },
  { id: 'state-space',        field: 'kontrol', title: 'Durum Uzayı (Sarkaç)', icon: 'rotate',  mount: mountStateSpace },
  { id: 'signals-fourier',    field: 'kontrol', title: 'Sinyaller & Fourier',  icon: 'wave',    mount: mountSignalsFourier },
  { id: 'sampling-aliasing',  field: 'kontrol', title: 'Örnekleme & Aliasing', icon: 'wave',    mount: mountSamplingAliasing },
  { id: 'convolution',        field: 'kontrol', title: 'Konvolüsyon',          icon: 'sigma',   mount: mountConvolution },
  { id: 'digital-filter',     field: 'kontrol', title: 'Dijital Filtre',       icon: 'chart',   mount: mountDigitalFilter },
  { id: 'laplace-z',          field: 'kontrol', title: 'Laplace & z Dönüşümü', icon: 'phasor',  mount: mountLaplaceZ },
];
