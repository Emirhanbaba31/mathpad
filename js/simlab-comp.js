// MathPad Engineering Simulation Center — Part 4 UI Module
// Fields: 'bilgisayar' (8), 'endustri' (8), 'biyomed' (7), 'fizikmat' (9) = 32 interactive simulations.
// Contract: export const SIMS = [{ id, field, title, icon, mount(host, ctx) -> cleanupFn }];

import { esc, icon } from './ui.js';
import { motion, syncSegments } from './fx.js';
import { tex, richTex, accentColor, createClean, setupCanvas, createAnimLoop } from './phys-ui.js';
import { plot, PLOT_COLORS } from './tools.js';
import {
  makeRng,
  SORT_COMPLEXITY, generateSortArray, sortTrace,
  GRAPH_PRESETS, runGraphAlgo, runAStarGrid,
  bstInsert, bstDelete, bstSearch, bstTraversals, avlBalance, heapPush, heapPop, hashCreate, hashInsert, hashSearch, hashDelete,
  scheduleCPU, simulatePageReplacement, bankersSafety, bankersRequest,
  simulateCache, simulatePipeline, floatToIEEE754, ieee754BitsToFloat, convertNumberBase,
  runAutomaton, nfaToDfa, regexToNfa, TM_PRESETS, createTMState, stepTM, tmTapeString,
  generate2DDataset, createMLP, mlpForward, mlpTrainEpoch, kmeansInit, kmeansStep, linRegClosedForm, linRegGradStep, logRegGradStep,
  rsaKeygen, rsaEncryptNum, rsaDecryptNum, caesarCipher, vigenereCipher, letterFrequencies, createSlidingWindow, stepSlidingWindow, dropInFlight,
  solveMM1, solveMMc, solveMM1K, createQueueSim, advanceQueueSim,
  solveLP2D, simplexSolve,
  solveEOQ, solveROP, simulateInventory,
  solveCPMPERT,
  generateSPCData, analyzeSPC,
  distStats, distPDF, sampleOneDist, cltSampleMeans, monteCarloPiBatch,
  normalizeTransitionMatrix, markovStep, markovPower, markovSteadyState, classifyMarkov,
  solveNorthwestCorner, solveVogel, optimizeMODI,
  ECG_PRESETS, ecgVectorAt, generateECGTrace,
  pkOneCompSingle, pkOneCompMulti, pkTwoComp,
  simulateHodgkinHuxley, fhnNullclines, simulateFHN,
  simulateEpidemic,
  simulateWindkessel, solvePoiseuilleStenosis,
  muscleForceLength, hillForceVelocity, hillCurve, solveElbowBiomechanics,
  createPhantom, computeSinogram, reconstructFBP, simulateUltrasound,
  rippleAmplitude, dopplerMetrics, standingWaveMetrics, beatsTrace,
  solveThinOptics, solveSnell, solvePrismRay, diffractionPattern, wavelengthToRGB,
  doublePendulumStep, doublePendulumEnergy, lorenzStep, logisticLyapunov, logisticBifurcation, classifyLinear2D, integrateLinear2D,
  ROOT_PRESETS, findRootBisection, findRootNewton, findRootSecant, integrateTrapezoid, integrateSimpson, integrateGaussLegendre, ODE_PRESETS, solveODECompare, evalLagrange, chebyshevNodes, buildCubicSpline, evalCubicSpline, polyLeastSquares,
  superpositionWave, tunnelTransmission, hydrogenRadialProb, hydrogenWaveDensity,
  magnetCoilFlux, magnetCoilEmf, simulateFaradayPass, simulateLCEnergy,
  lorentzMetrics, PHOTO_METALS, solvePhotoelectric, solveCompton,
  compileExpr2D, evalVectorField2D, traceStreamline2D, computeLineIntegral2D, sampleSurfaceGrid, surfaceGradient,
  buffonExactProb, buffonDropBatch, createRandomWalkEnsemble, stepRandomWalkEnsemble, galtonBinomialPMF, galtonDropBatch,
} from './simlab-comp-core.js';

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
const PALETTE = ['#5ab0ff', '#5be49b', '#ffd166', '#ff6b6b', '#c084fc', '#38bdf8', '#fb923c', '#f472b6'];

const autoPlayAllowed = () => motion() === 'full';

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

function introHtml(text, presets = []) {
  return `<div class="slp-intro">
    <p>${richTex(text)}</p>
    ${presets.length ? `<div class="slp-presets" role="group" aria-label="Hazır senaryolar">
      <span class="slp-preset-lbl">Senaryo:</span>
      ${presets.map((p, i) => `<button type="button" class="slp-chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function bindPresets(host, presets, apply) {
  host.querySelector('.slp-presets')?.addEventListener('click', e => {
    const b = e.target.closest?.('[data-preset]');
    if (!b) return;
    host.querySelectorAll('.slp-presets [data-preset]').forEach(x => x.classList.toggle('slp-on', x === b));
    apply(presets[+b.dataset.preset]);
    syncSegments(host, false);
  });
}

let slpUid = 0;
function addSlider(parent, { label, unit = '', min, max, value, step, log = false, fmt, onInput }) {
  const uid = `slp-s-${++slpUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'slp-ctrl';
  wrap.innerHTML = `<div class="slp-ctrl-top">
      <label class="slp-ctrl-lbl" for="${uid}">${esc(label)}</label>
      <span class="slp-ctrl-val mono" data-v></span>
    </div>
    <input id="${uid}" type="range" class="slp-range" aria-label="${esc(label)}">`;
  parent.append(wrap);
  const rng = wrap.querySelector('input');
  const valEl = wrap.querySelector('[data-v]');
  let cur = value, lo = min, hi = max;

  if (log) { rng.min = '0'; rng.max = '1000'; rng.step = '1'; }
  else { rng.min = String(lo); rng.max = String(hi); rng.step = String(step ?? (hi - lo) / 200); }

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
  rng.addEventListener('input', () => {
    const raw = fromPos(+rng.value);
    cur = log ? +raw.toPrecision(3) : +raw.toFixed(6);
    valEl.textContent = format(cur);
    onInput(cur);
  });
  set(value);
  return { el: wrap, set, get: () => cur, setVisible: s => { wrap.hidden = !s; } };
}

function addToggle(parent, label, checked, onChange) {
  const lbl = document.createElement('label');
  lbl.className = 'slp-check-row';
  lbl.innerHTML = `<span>${esc(label)}</span><input type="checkbox" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;
  parent.append(lbl);
  const inp = lbl.querySelector('input');
  inp.addEventListener('change', () => onChange(inp.checked));
  return { el: lbl, set: v => { inp.checked = !!v; }, get: () => inp.checked, setVisible: s => { lbl.hidden = !s; } };
}

function addSelect(parent, label, options, value, onChange) {
  const uid = `slp-sel-${++slpUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'slp-ctrl';
  wrap.innerHTML = `<label class="slp-ctrl-lbl" for="${uid}">${esc(label)}</label>
    <select id="${uid}" class="inp slp-sel" aria-label="${esc(label)}">
      ${options.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>`;
  parent.append(wrap);
  const sel = wrap.querySelector('select');
  sel.addEventListener('change', () => onChange(sel.value));
  return { el: wrap, set: v => { sel.value = v; }, get: () => sel.value, setVisible: s => { wrap.hidden = !s; } };
}

function renderKpis(el, items) {
  if (!el) return;
  el.innerHTML = items.map(it => {
    const toneCls = it.tone ? `slp-kpi-${it.tone}` : '';
    return `<div class="slp-kpi ${toneCls}">
      <span class="slp-kpi-lbl">${esc(it.lbl)}</span>
      <b class="slp-kpi-val mono">${esc(it.val)}</b>
      ${it.sub ? `<span class="slp-kpi-sub mono">${esc(it.sub)}</span>` : ''}
    </div>`;
  }).join('');
}

function theoryAndTasksHtml({ equations = [], paragraphs = [], tasks = [] }) {
  const tasksHtml = tasks.length ? `<div class="slp-tasks" role="region" aria-label="Deney görevleri">
    <div class="slp-tasks-head"><h4 class="slp-title">Deney Görevleri</h4><span class="slp-hint" data-task-prog>0 / ${tasks.length}</span></div>
    ${tasks.map((t, i) => `<label class="slp-task"><input type="checkbox" data-task="${i}"><span>${richTex(t)}</span></label>`).join('')}
  </div>` : '';
  const theoryHtml = `<details class="slp-theory">
    <summary><span>Nasıl çalışır? — Kuram ve Denklemler</span><span class="slp-theory-tag">Kuram</span></summary>
    <div class="slp-theory-body">
      ${equations.length ? `<div class="slp-eq-box">${equations.map(eq => `<div>${tex(eq, true)}</div>`).join('')}</div>` : ''}
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
      const ok = !!b.checked;
      if (ok) done++;
      b.closest?.('.slp-task')?.classList.toggle('slp-done', ok);
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

function observeResize(el, onResize, clean) {
  if (!el || typeof ResizeObserver === 'undefined') return;
  const ro = new ResizeObserver(() => onResize());
  ro.observe(el);
  clean.add(() => ro.disconnect());
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
    while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid] < xv) lo = mid + 1; else hi = mid; }
    const idx = lo > 0 && Math.abs(xs[lo - 1] - xv) < Math.abs(xs[lo] - xv) ? lo - 1 : lo;
    rd.textContent = formatFn(xs[idx], m.series, idx);
  };
  const onLeave = () => { rd.textContent = ''; };
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerleave', onLeave);
  clean.add(() => { cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave); });
}

function drawArrow(c, x1, y1, x2, y2, col = COL_FG, lw = 2, head = 8) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  c.save();
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - head * ux - head * 0.45 * uy, y2 - head * uy + head * 0.45 * ux);
  c.lineTo(x2 - head * ux + head * 0.45 * uy, y2 - head * uy - head * 0.45 * ux);
  c.closePath(); c.fill();
  c.restore();
}

function canvasPos(cv, e) {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

// =====================================================================
// FIELD 1: BİLGİSAYAR (8 SIMULATIONS)
// =====================================================================

// 1.1 SIRALAMA ALGORİTMALARI
function mountSorting(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Rastgele Dizi', pattern: 'random', n: 22, race: false, algoA: 'quick', algoB: 'bubble' },
    { label: 'Ters Sıralı (En Kötü)', pattern: 'reversed', n: 20, race: true, algoA: 'insertion', algoB: 'merge' },
    { label: 'Neredeyse Sıralı', pattern: 'nearly', n: 24, race: true, algoA: 'insertion', algoB: 'quick' },
    { label: 'Karşılaştırmasız Yarış', pattern: 'few', n: 24, race: true, algoA: 'counting', algoB: 'radix' },
  ];
  const st = {
    algoA: 'quick', algoB: 'bubble', race: false, pattern: 'random', n: 22, speed: 12, seed: 42,
    arr: [], traceA: null, traceB: null, idxA: 0, idxB: 0, accum: 0, playing: false,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('8 klasik sıralama algoritmasını adım adım karşılaştır; karşılaştırma ve takas sayaçlarını canlı izle veya **Yan Yana Yarış** modunda iki algoritmayı aynı dizide yarıştır.', presets)}
    <div class="slp-toolbar">
      <div class="slp-toolbar-g">
        <div class="seg" role="tablist" data-rmode>
          <button type="button" data-r="0" class="on">Tekli Görünüm</button>
          <button type="button" data-r="1">Yan Yana Yarış</button>
        </div>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play aria-label="Oynat veya duraklat">${icon('play')} Oynat</button>
        <button type="button" class="btn small" data-step aria-label="Bir adım ilerle">Adım →</button>
        <button type="button" class="btn small ghost" data-reset aria-label="Başa sar">Sıfırla</button>
        <button type="button" class="btn small ghost" data-shuf aria-label="Yeni dizi üret">${icon('rotate')} Karıştır</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head">
            <h4 class="slp-title" data-title-a>Algoritma A</h4>
            <span class="slp-badge slp-badge-acc mono" data-note-a>—</span>
          </div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv-a aria-label="Sıralama çubuk grafiği A"></canvas></div>
        </div>
        <div class="slp-plot-card" data-box-b hidden>
          <div class="slp-head">
            <h4 class="slp-title" data-title-b>Algoritma B</h4>
            <span class="slp-badge slp-badge-warn mono" data-note-b>—</span>
          </div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv-b aria-label="Sıralama çubuk grafiği B"></canvas></div>
        </div>
        <div class="slp-panel">
          <h4 class="slp-title">Zaman & Bellek Karmaşıklığı Tablosu</h4>
          <div class="slp-table-wrap">
            <table class="slp-tbl" aria-label="Sıralama algoritmaları karmaşıklık tablosu">
              <thead><tr><th>Algoritma</th><th>En İyi</th><th>Ortalama</th><th>En Kötü</th><th>Ek Bellek</th><th>Kararlı</th></tr></thead>
              <tbody>${SORT_COMPLEXITY.map(m => `<tr data-row="${m.id}">
                <td><b>${esc(m.name)}</b></td><td class="mono">${esc(m.best)}</td><td class="mono">${esc(m.avg)}</td>
                <td class="mono">${esc(m.worst)}</td><td class="mono">${esc(m.space)}</td>
                <td>${m.stable ? '✓ Evet' : '✗ Hayır'}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'T_{\\text{karşılaştırma}}(n) = \\Omega(n \\log n) \\quad (\\text{karar ağacı alt sınırı})',
        'T_{\\text{Merge}}(n) = 2T(n/2) + \\Theta(n) \\implies \\Theta(n \\log n), \\qquad T_{\\text{Counting}} = \\Theta(n + k)',
      ],
      paragraphs: [
        'Karşılaştırma tabanlı tüm sıralama algoritmaları en kötü durumda en az $\\log_2(n!) = \\Omega(n\\log n)$ karşılaştırma yapmak zorundadır. **Merge** ve **Heap** sort bu alt sınırı en kötü durumda da garanti ederken, **Quick** sort ortalama $O(n\\log n)$ ve önbellek dostu yapısıyla uygulamada çok hızlıdır.',
        '**Counting** ve **Radix** sort anahtar değerlerini doğrudan indekslediği için karşılaştırma yapmadan doğrusal $O(n+k)$ zamanda çalışır. **Kararlılık (stability)** eşit değerlerin başlangıç sırasının korunmasıdır.',
      ],
      tasks: [
        'Ters sıralı dizide **Insertion** ile **Merge** algoritmasını yarıştır ve karşılaştırma sayısındaki farkı ölç.',
        'Neredeyse sıralı dizide **Insertion** algoritmasının $O(n)$ davranışa yaklaştığını gözle.',
        'Az tekrarlı dizide **Counting** ve **Radix** algoritmalarının 0 karşılaştırma ile sıraladığını doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const boxB = host.querySelector('[data-box-b]');
  const playBtn = host.querySelector('[data-play]');
  const algoOpts = SORT_COMPLEXITY.map(m => [m.id, m.name]);
  const patOpts = [['random', 'Rastgele'], ['reversed', 'Ters Sıralı'], ['nearly', 'Neredeyse Sıralı'], ['few', 'Az Tekrarlı']];

  const selA = addSelect(ctrls, 'Algoritma A', algoOpts, st.algoA, v => { st.algoA = v; rebuild(); });
  const selB = addSelect(ctrls, 'Algoritma B (Yarış)', algoOpts, st.algoB, v => { st.algoB = v; rebuild(); });
  const selPat = addSelect(ctrls, 'Dizi Deseni', patOpts, st.pattern, v => { st.pattern = v; rebuild(); });
  const sN = addSlider(ctrls, { label: 'Eleman Sayısı n', min: 8, max: 40, step: 1, value: st.n, fmt: v => String(Math.round(v)), onInput: v => { st.n = Math.round(v); rebuild(); } });
  const sSpd = addSlider(ctrls, { label: 'Animasyon Hızı', unit: 'adım/sn', min: 1, max: 60, step: 1, value: st.speed, fmt: v => `${Math.round(v)} adım/sn`, onInput: v => { st.speed = v; } });

  function drawBars(c, W, H, trace, idx) {
    c.clearRect(0, 0, W, H);
    if (!trace || !trace.steps.length) return;
    const step = trace.steps[Math.min(idx, trace.steps.length - 1)];
    const a = step.arr, n = a.length;
    const maxV = Math.max(...a, 1);
    const padX = 14, padT = 18, padB = 22;
    const bw = (W - 2 * padX) / n;
    const acc = accentColor();
    const sortedSet = new Set(step.sortedIdx);
    const cmpSet = new Set(step.compare);
    const swpSet = new Set(step.swap);
    const actSet = new Set(step.active);

    for (let i = 0; i < n; i++) {
      const h = ((H - padT - padB) * a[i]) / maxV;
      const x = padX + i * bw;
      const y = H - padB - h;
      let fill = 'rgba(244,244,245,0.42)';
      if (sortedSet.has(i)) fill = COL_OK;
      if (actSet.has(i)) fill = COL_PURP;
      if (cmpSet.has(i)) fill = COL_WARN;
      if (swpSet.has(i)) fill = COL_BAD;
      if (!cmpSet.size && !swpSet.size && idx === trace.steps.length - 1) fill = acc;
      c.fillStyle = fill;
      c.fillRect(x + 1, y, Math.max(2, bw - 2), h);
      if (n <= 26) {
        c.fillStyle = COL_MUTE;
        c.font = '10px "JetBrains Mono", monospace';
        c.textAlign = 'center';
        c.fillText(String(a[i]), x + bw * 0.5, H - 7);
      }
    }
  }

  const cvA = setupCanvas(host.querySelector('[data-cv-a]'), w => Math.min(240, Math.max(175, w * 0.36)), (c, W, H) => drawBars(c, W, H, st.traceA, st.idxA), clean);
  const cvB = setupCanvas(host.querySelector('[data-cv-b]'), w => Math.min(220, Math.max(165, w * 0.34)), (c, W, H) => drawBars(c, W, H, st.traceB, st.idxB), clean);

  function syncUI() {
    const sA = st.traceA.steps[Math.min(st.idxA, st.traceA.steps.length - 1)];
    const nameA = SORT_COMPLEXITY.find(m => m.id === st.algoA)?.name || st.algoA;
    host.querySelector('[data-title-a]').textContent = `A · ${nameA}`;
    host.querySelector('[data-note-a]').textContent = sA?.note || '—';
    const items = [
      { lbl: `${nameA.split(' ')[0]} · Adım`, val: `${st.idxA} / ${st.traceA.steps.length - 1}`, tone: 'acc' },
      { lbl: 'Karşılaştırma (A)', val: String(sA.comps), sub: `Toplam: ${st.traceA.comps}` },
      { lbl: 'Takas / Yazma (A)', val: `${sA.swaps} / ${sA.writes}` },
    ];
    if (st.race && st.traceB) {
      const sB = st.traceB.steps[Math.min(st.idxB, st.traceB.steps.length - 1)];
      const nameB = SORT_COMPLEXITY.find(m => m.id === st.algoB)?.name || st.algoB;
      host.querySelector('[data-title-b]').textContent = `B · ${nameB}`;
      host.querySelector('[data-note-b]').textContent = sB?.note || '—';
      items.push(
        { lbl: `${nameB.split(' ')[0]} · Adım`, val: `${st.idxB} / ${st.traceB.steps.length - 1}`, tone: 'warn' },
        { lbl: 'Karşılaştırma (B)', val: String(sB.comps), sub: `Takas/Yazma: ${sB.swaps}/${sB.writes}` },
      );
    }
    renderKpis(kpis, items);
    host.querySelectorAll('tr[data-row]').forEach(tr => {
      tr.classList.toggle('slp-td-hi', tr.dataset.row === st.algoA || (st.race && tr.dataset.row === st.algoB));
    });
    cvA.render();
    if (st.race) cvB.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    st.accum += dt * st.speed;
    const adv = Math.floor(st.accum);
    if (adv > 0) {
      st.accum -= adv;
      const doneA = st.idxA >= st.traceA.steps.length - 1;
      const doneB = !st.race || st.idxB >= st.traceB.steps.length - 1;
      if (!doneA) st.idxA = Math.min(st.traceA.steps.length - 1, st.idxA + adv);
      if (st.race && !doneB) st.idxB = Math.min(st.traceB.steps.length - 1, st.idxB + adv);
      syncUI();
      if (st.idxA >= st.traceA.steps.length - 1 && (!st.race || st.idxB >= st.traceB.steps.length - 1)) {
        st.playing = false;
        playBtn.innerHTML = `${icon('play')} Oynat`;
        return false;
      }
    }
    return st.playing;
  }, clean);

  function setPlaying(p) {
    st.playing = p;
    playBtn.innerHTML = p ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (p) {
      if (st.idxA >= st.traceA.steps.length - 1 && (!st.race || st.idxB >= st.traceB.steps.length - 1)) { st.idxA = 0; st.idxB = 0; }
      loop.start();
    } else loop.stop();
  }

  function rebuild() {
    setPlaying(false);
    st.arr = generateSortArray(st.n, st.pattern, st.seed);
    st.traceA = sortTrace(st.algoA, st.arr);
    st.traceB = st.race ? sortTrace(st.algoB, st.arr) : null;
    st.idxA = 0; st.idxB = 0; st.accum = 0;
    selB.setVisible(st.race);
    boxB.hidden = !st.race;
    if (st.race) cvB.resize();
    syncUI();
  }

  host.querySelector('[data-rmode]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-r]');
    if (!b) return;
    st.race = b.dataset.r === '1';
    host.querySelectorAll('[data-rmode] button').forEach(x => x.classList.toggle('on', x === b));
    rebuild();
  });
  playBtn.addEventListener('click', () => setPlaying(!st.playing));
  host.querySelector('[data-step]').addEventListener('click', () => {
    setPlaying(false);
    st.idxA = Math.min(st.traceA.steps.length - 1, st.idxA + 1);
    if (st.race && st.traceB) st.idxB = Math.min(st.traceB.steps.length - 1, st.idxB + 1);
    syncUI();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { setPlaying(false); st.idxA = 0; st.idxB = 0; syncUI(); });
  host.querySelector('[data-shuf]').addEventListener('click', () => { st.seed += 17; rebuild(); });

  bindPresets(host, presets, p => {
    st.pattern = p.pattern; st.n = p.n; st.race = p.race; st.algoA = p.algoA; st.algoB = p.algoB;
    selA.set(st.algoA); selB.set(st.algoB); selPat.set(st.pattern); sN.set(st.n);
    host.querySelectorAll('[data-rmode] button').forEach(x => x.classList.toggle('on', (x.dataset.r === '1') === st.race));
    rebuild();
  });

  bindTasks(host);
  rebuild();
  return clean.run;
}

// 1.2 GRAF ALGORİTMALARI & A* IZGARA
function mountGraph(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Şehir Ağı (Dijkstra/MST)', view: 'graph', graphKey: 'city', algo: 'dijkstra' },
    { label: 'Negatif Kenar (Bellman-Ford)', view: 'graph', graphKey: 'neg', algo: 'bellman-ford' },
    { label: 'Ders Önkoşulları (Topolojik)', view: 'graph', graphKey: 'dag', algo: 'topo' },
    { label: 'A* Labirent Duvarı', view: 'astar', heuristic: 'manhattan' },
  ];

  const st = {
    view: 'graph', algo: 'dijkstra', directed: false, start: 0, edgeWeight: 3,
    nodes: GRAPH_PRESETS.city.nodes.map(n => ({ ...n })),
    edges: GRAPH_PRESETS.city.edges.map(e => ({ ...e })),
    res: null, stepIdx: 0, dragFrom: null, dragPos: null,
    // A* grid
    rows: 10, cols: 14, walls: new Set(['1,5','2,5','3,5','4,5','5,5','6,5','7,5','4,9','5,9','6,9','7,9','8,9']),
    gStart: [2, 2], gGoal: [7, 11], heuristic: 'manhattan', astarRes: null, astarStep: 0,
    playing: false, accum: 0,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Graf üzerinde **boş yere dokunarak düğüm ekle**, bir düğümden diğerine **sürükleyerek ağırlıklı kenar çiz**. BFS, DFS, Dijkstra, Bellman-Ford, Prim/Kruskal MST, Topolojik Sıralama ve engelli ızgarada **A*** aramasını adım adım izle.', presets)}
    <div class="slp-toolbar">
      <div class="slp-toolbar-g">
        <div class="seg" role="tablist" data-view>
          <button type="button" data-v="graph" class="on">Ağırlıklı Graf</button>
          <button type="button" data-v="astar">A* Izgara (Engeller)</button>
        </div>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play aria-label="Oynat veya duraklat">${icon('play')} Oynat</button>
        <button type="button" class="btn small" data-step aria-label="Bir adım ilerle">Adım →</button>
        <button type="button" class="btn small ghost" data-reset aria-label="Başa sar">Başa Sar</button>
        <button type="button" class="btn small ghost" data-clear aria-label="Temizle">Temizle</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head">
            <h4 class="slp-title" data-gtitle>Graf Tuvali</h4>
            <span class="slp-badge slp-badge-acc mono" data-stepnote>—</span>
          </div>
          <div class="slp-cv-box">
            <canvas class="slp-cv slp-cv-tap" data-cv aria-label="Etkileşimli graf ve A* ızgara tuvali"></canvas>
            <div class="slp-cv-tag" data-hint>Boş yere tıkla: düğüm ekle · Düğümden düğüme sürükle: kenar çiz</div>
          </div>
        </div>
        <div class="slp-panel" data-frontbox>
          <h4 class="slp-title">Sınır Kümesi (Kuyruk / Yığın) ve Uzaklık Tablosu</h4>
          <div class="slp-log" data-frontier>—</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'd[v] \\leftarrow \\min\\bigl(d[v],\\; d[u] + w(u,v)\\bigr) \\quad (\\text{Gevşetme / Relaxation})',
        'f(n) = g(n) + h(n), \\qquad h_{\\text{Manhattan}} = |r - r_g| + |c - c_g|',
      ],
      paragraphs: [
        '**Dijkstra** negatif olmayan ağırlıklarda $O((V+E)\\log V)$ sürede en kısa yolu bulur; negatif kenarlarda **Bellman-Ford** $V-1$ tur gevşetme ile doğru sonuca ulaşır ve negatif çevrimleri yakalar.',
        '**Prim** ve **Kruskal** en küçük kapsayan ağacı (MST) kurar. **A*** sezgisel fonksiyon $h(n)$ kabul edilebilir (gerçek maliyeti aşmayan) olduğunda en kısa yolu Dijkstra’dan çok daha az düğüm açarak bulur.',
      ],
      tasks: [
        'Şehir Ağında **Prim** ve **Kruskal** algoritmalarını çalıştırıp her ikisinin de toplam ağırlık 13 bulduğunu doğrula.',
        'Negatif Kenar örneğinde Dijkstra uyarısını gör ve Bellman-Ford ile $S\\to T$ mesafesinin 8 olduğunu izle.',
        'A* Izgara modunda sezgisel olarak **Manhattan** ve **Dijkstra (h=0)** seçimlerini karşılaştırıp ziyaret edilen hücre sayısına bak.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const stepNote = host.querySelector('[data-stepnote]');
  const frontEl = host.querySelector('[data-frontier]');
  const playBtn = host.querySelector('[data-play]');
  const cvEl = host.querySelector('[data-cv]');

  const selAlgo = addSelect(ctrls, 'Graf Algoritması', [
    ['bfs', 'BFS (Genişlik Öncelikli)'], ['dfs', 'DFS (Derinlik Öncelikli)'],
    ['dijkstra', 'Dijkstra (En Kısa Yol)'], ['bellman-ford', 'Bellman-Ford (Negatif Kenar)'],
    ['prim', 'Prim MST'], ['kruskal', 'Kruskal MST'], ['topo', 'Topolojik Sıralama (Kahn)'],
  ], st.algo, v => { st.algo = v; recompute(); });
  const tDir = addToggle(ctrls, 'Yönlü Graf (Directed)', st.directed, v => { st.directed = v; recompute(); });
  const sW = addSlider(ctrls, { label: 'Yeni Kenar Ağırlığı', min: -5, max: 15, step: 1, value: st.edgeWeight, fmt: v => String(Math.round(v)), onInput: v => { st.edgeWeight = Math.round(v); } });
  const selHeur = addSelect(ctrls, 'A* Sezgisel Fonksiyon h(n)', [
    ['manhattan', 'Manhattan (L1)'], ['euclidean', 'Öklid (L2)'], ['dijkstra', 'Dijkstra (h = 0)'],
  ], st.heuristic, v => { st.heuristic = v; recompute(); });

  function drawScene(c, W, H) {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.view === 'astar') {
      const pad = 16;
      const cw = (W - 2 * pad) / st.cols, ch = (H - 2 * pad) / st.rows;
      const step = st.astarRes?.steps?.[Math.min(st.astarStep, (st.astarRes?.steps?.length || 1) - 1)];
      const openS = new Set(step?.open || []);
      const closedS = new Set(step?.closed || []);
      const pathS = new Set((step?.path || []).map(([r, col]) => `${r},${col}`));

      for (let r = 0; r < st.rows; r++) {
        for (let col = 0; col < st.cols; col++) {
          const x = pad + col * cw, y = pad + r * ch, k = `${r},${col}`;
          let fill = 'rgba(255,255,255,0.03)';
          if (st.walls.has(k)) fill = 'rgba(244,244,245,0.28)';
          else if (closedS.has(k)) fill = 'rgba(90,176,255,0.22)';
          else if (openS.has(k)) fill = 'rgba(255,209,102,0.28)';
          if (pathS.has(k)) fill = 'rgba(91,228,155,0.55)';
          if (r === st.gStart[0] && col === st.gStart[1]) fill = COL_BLUE;
          if (r === st.gGoal[0] && col === st.gGoal[1]) fill = COL_OK;
          c.fillStyle = fill;
          c.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          c.strokeStyle = 'rgba(255,255,255,0.08)';
          c.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
          if (r === st.gStart[0] && col === st.gStart[1]) {
            c.fillStyle = '#000'; c.font = 'bold 12px var(--mono)'; c.textAlign = 'center'; c.fillText('S', x + cw / 2, y + ch / 2 + 4);
          } else if (r === st.gGoal[0] && col === st.gGoal[1]) {
            c.fillStyle = '#000'; c.font = 'bold 12px var(--mono)'; c.textAlign = 'center'; c.fillText('G', x + cw / 2, y + ch / 2 + 4);
          }
        }
      }
      if (step?.current) {
        const [cr, cc] = step.current;
        c.strokeStyle = acc; c.lineWidth = 2.5;
        c.strokeRect(pad + cc * cw + 2, pad + cr * ch + 2, cw - 4, ch - 4);
      }
      return;
    }

    // Graph rendering
    const step = st.res?.steps?.[Math.min(st.stepIdx, (st.res?.steps?.length || 1) - 1)];
    const visited = new Set(step?.visited || []);
    const frontier = new Set(step?.frontier || []);
    const treeKey = new Set((step?.treeEdges || []).map(([u, v]) => `${u}-${v}`));
    const act = step?.activeEdge;
    const nodePos = id => {
      const n = st.nodes.find(x => x.id === id);
      return n ? [n.x * W, n.y * H] : [0, 0];
    };

    // Draw edges
    for (const e of st.edges) {
      const [x1, y1] = nodePos(e.u), [x2, y2] = nodePos(e.v);
      const isTree = treeKey.has(`${e.u}-${e.v}`) || (!st.directed && treeKey.has(`${e.v}-${e.u}`));
      const isAct = act && ((act[0] === e.u && act[1] === e.v) || (!st.directed && act[0] === e.v && act[1] === e.u));
      const col = isAct ? COL_WARN : isTree ? COL_OK : 'rgba(255,255,255,0.28)';
      const lw = isAct ? 3.5 : isTree ? 3 : 1.6;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const sx = x1 + ux * 20, sy = y1 + uy * 20, ex = x2 - ux * 20, ey = y2 - uy * 20;
      if (st.directed || st.algo === 'topo') drawArrow(c, sx, sy, ex, ey, col, lw, 9);
      else { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); }
      const mx = (x1 + x2) / 2 - uy * 12, my = (y1 + y2) / 2 + ux * 12;
      c.fillStyle = isTree ? COL_OK : COL_FG;
      c.font = '600 12px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(String(e.w), mx, my + 4);
    }

    if (st.dragFrom !== null && st.dragPos) {
      const [x1, y1] = nodePos(st.dragFrom);
      c.strokeStyle = acc; c.setLineDash([5, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(st.dragPos[0], st.dragPos[1]); c.stroke();
      c.setLineDash([]);
    }

    // Draw nodes
    for (const n of st.nodes) {
      const x = n.x * W, y = n.y * H;
      const isCur = step?.current === n.id;
      const isVis = visited.has(n.id);
      const isFr = frontier.has(n.id);
      c.beginPath(); c.arc(x, y, 19, 0, Math.PI * 2);
      c.fillStyle = isCur ? acc : isVis ? 'rgba(91,228,155,0.25)' : isFr ? 'rgba(255,209,102,0.24)' : '#101016';
      c.fill();
      c.lineWidth = isCur ? 3 : 2;
      c.strokeStyle = isCur ? '#fff' : isVis ? COL_OK : isFr ? COL_WARN : 'rgba(255,255,255,0.55)';
      c.stroke();
      c.fillStyle = isCur ? '#000' : COL_FG;
      c.font = '600 12px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(n.label, x, y + 4);
      if (step?.dist && step.dist[n.id] !== undefined) {
        const dStr = step.dist[n.id] === Infinity ? '∞' : String(step.dist[n.id]);
        c.fillStyle = COL_WARN;
        c.font = '500 10.5px "JetBrains Mono", monospace';
        c.fillText(`d=${dStr}`, x, y - 24);
      }
    }
  }

  const cv = setupCanvas(cvEl, w => Math.min(340, Math.max(240, w * 0.56)), drawScene, clean);

  function syncUI() {
    const isA = st.view === 'astar';
    selAlgo.setVisible(!isA); tDir.setVisible(!isA); sW.setVisible(!isA); selHeur.setVisible(isA);
    host.querySelector('[data-gtitle]').textContent = isA ? 'A* Izgara Araması' : 'Etkileşimli Ağırlıklı Graf';
    host.querySelector('[data-hint]').textContent = isA
      ? 'Hücrelere dokunarak duvar çiz/sil (S: başlangıç, G: hedef)'
      : 'Boş yere tıkla: düğüm ekle · Düğümden düğüme sürükle: kenar çiz';

    if (isA) {
      const r = st.astarRes;
      const totalS = r?.steps?.length || 1;
      const cur = r?.steps?.[Math.min(st.astarStep, totalS - 1)];
      stepNote.textContent = r.found ? `Adım ${st.astarStep + 1}/${totalS}` : 'Yol yok!';
      renderKpis(kpis, [
        { lbl: 'Durum', val: r.found ? 'Yol Bulundu' : 'Ulaşılamaz', tone: r.found ? 'ok' : 'bad' },
        { lbl: 'Yol Maliyeti', val: r.found ? String(r.cost) : '—', tone: 'acc' },
        { lbl: 'Açılan Hücre', val: String(r.visitedCount) },
        { lbl: 'Açık / Kapalı', val: `${cur?.open?.length || 0} / ${cur?.closed?.length || 0}` },
      ]);
      frontEl.textContent = `Sezgisel: ${st.heuristic} · Açık küme: ${cur?.open?.slice(0, 12).join(' | ') || 'boş'}`;
    } else {
      const r = st.res;
      if (!r?.ok) {
        stepNote.textContent = 'Uyarı';
        renderKpis(kpis, [{ lbl: 'Durum', val: 'Hata', sub: r?.error || '', tone: 'bad' }]);
        frontEl.textContent = r?.error || '';
      } else {
        const totalS = r.steps.length;
        const cur = r.steps[Math.min(st.stepIdx, totalS - 1)];
        const lblOf = id => st.nodes.find(n => n.id === id)?.label ?? String(id);
        stepNote.textContent = cur?.note || '—';
        const cards = [
          { lbl: 'Adım', val: `${st.stepIdx + 1} / ${totalS}`, tone: 'acc' },
          { lbl: 'Düğüm / Kenar', val: `${st.nodes.length} / ${st.edges.length}` },
        ];
        if (r.mstWeight !== undefined) cards.push({ lbl: 'MST Toplam Ağırlık', val: String(r.mstWeight), tone: 'ok' });
        if (r.hasNegCycle !== undefined) cards.push({ lbl: 'Negatif Çevrim', val: r.hasNegCycle ? 'VAR!' : 'Yok', tone: r.hasNegCycle ? 'bad' : 'ok' });
        if (r.topoOrder) cards.push({ lbl: 'Topolojik Sıra', val: r.hasCycle ? 'Çevrim Var!' : r.topoOrder.map(lblOf).join(' → '), tone: r.hasCycle ? 'bad' : 'ok' });
        renderKpis(kpis, cards);
        const frStr = (cur?.frontier || []).map(lblOf).join(', ') || 'boş';
        const dStr = cur?.dist ? Object.entries(cur.dist).map(([k, v]) => `${lblOf(+k)}:${v === Infinity ? '∞' : v}`).join('  ') : '';
        frontEl.textContent = `Sınır (Frontier): [ ${frStr} ]` + (dStr ? `\nUzaklıklar: ${dStr}` : '');
      }
    }
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    st.accum += dt * 3.2;
    if (st.accum >= 1) {
      st.accum -= 1;
      const maxI = st.view === 'astar' ? (st.astarRes?.steps?.length || 1) - 1 : (st.res?.steps?.length || 1) - 1;
      if (st.view === 'astar') {
        if (st.astarStep < maxI) st.astarStep++;
        else { st.playing = false; playBtn.innerHTML = `${icon('play')} Oynat`; syncUI(); return false; }
      } else {
        if (st.stepIdx < maxI) st.stepIdx++;
        else { st.playing = false; playBtn.innerHTML = `${icon('play')} Oynat`; syncUI(); return false; }
      }
      syncUI();
    }
    return st.playing;
  }, clean);

  function setPlaying(p) {
    st.playing = p;
    playBtn.innerHTML = p ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (p) loop.start(); else loop.stop();
  }

  function recompute() {
    setPlaying(false);
    if (st.view === 'astar') {
      st.astarRes = runAStarGrid({ rows: st.rows, cols: st.cols, walls: [...st.walls], start: st.gStart, goal: st.gGoal, heuristic: st.heuristic });
      st.astarStep = Math.max(0, st.astarRes.steps.length - 1);
    } else {
      st.res = runGraphAlgo({ algo: st.algo, nodes: st.nodes, edges: st.edges, start: st.start, directed: st.directed });
      st.stepIdx = st.res.ok ? Math.max(0, st.res.steps.length - 1) : 0;
    }
    syncUI();
  }

  // Pointer interaction: graph edit & A* wall painting
  const findNodeAt = (px, py) => {
    const { W, H } = cv.size();
    return st.nodes.find(n => Math.hypot(n.x * W - px, n.y * H - py) <= 22) || null;
  };
  const onDown = e => {
    const [px, py] = canvasPos(cvEl, e);
    const { W, H } = cv.size();
    if (st.view === 'astar') {
      const pad = 16;
      const col = Math.floor((px - pad) / ((W - 2 * pad) / st.cols));
      const row = Math.floor((py - pad) / ((H - 2 * pad) / st.rows));
      if (row >= 0 && row < st.rows && col >= 0 && col < st.cols) {
        const k = `${row},${col}`;
        if ((row === st.gStart[0] && col === st.gStart[1]) || (row === st.gGoal[0] && col === st.gGoal[1])) return;
        if (st.walls.has(k)) st.walls.delete(k); else st.walls.add(k);
        recompute();
      }
      return;
    }
    const hit = findNodeAt(px, py);
    if (hit) {
      st.dragFrom = hit.id;
      st.dragPos = [px, py];
      cvEl.setPointerCapture?.(e.pointerId);
    } else if (st.nodes.length < 14) {
      const id = st.nodes.length ? Math.max(...st.nodes.map(n => n.id)) + 1 : 0;
      const label = String.fromCharCode(65 + (id % 26));
      st.nodes.push({ id, label, x: Math.max(0.08, Math.min(0.92, px / W)), y: Math.max(0.12, Math.min(0.88, py / H)) });
      recompute();
    }
  };
  const onMove = e => {
    if (st.dragFrom === null) return;
    st.dragPos = canvasPos(cvEl, e);
    cv.render();
  };
  const onUp = e => {
    if (st.dragFrom === null) return;
    const [px, py] = canvasPos(cvEl, e);
    const target = findNodeAt(px, py);
    if (target && target.id !== st.dragFrom) {
      const ex = st.edges.find(ed => ed.u === st.dragFrom && ed.v === target.id);
      if (ex) ex.w = st.edgeWeight;
      else st.edges.push({ u: st.dragFrom, v: target.id, w: st.edgeWeight });
      recompute();
    } else if (target && target.id === st.dragFrom) {
      st.start = target.id;
      recompute();
    }
    st.dragFrom = null; st.dragPos = null;
    cv.render();
  };
  cvEl.addEventListener('pointerdown', onDown);
  cvEl.addEventListener('pointermove', onMove);
  cvEl.addEventListener('pointerup', onUp);
  clean.add(() => {
    cvEl.removeEventListener('pointerdown', onDown);
    cvEl.removeEventListener('pointermove', onMove);
    cvEl.removeEventListener('pointerup', onUp);
  });

  host.querySelector('[data-view]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-v]'); if (!b) return;
    st.view = b.dataset.v;
    host.querySelectorAll('[data-view] button').forEach(x => x.classList.toggle('on', x === b));
    recompute();
  });
  playBtn.addEventListener('click', () => {
    if (!st.playing) {
      if (st.view === 'astar' && st.astarStep >= st.astarRes.steps.length - 1) st.astarStep = 0;
      if (st.view === 'graph' && st.res?.ok && st.stepIdx >= st.res.steps.length - 1) st.stepIdx = 0;
    }
    setPlaying(!st.playing);
  });
  host.querySelector('[data-step]').addEventListener('click', () => {
    setPlaying(false);
    if (st.view === 'astar') st.astarStep = Math.min(st.astarRes.steps.length - 1, st.astarStep + 1);
    else if (st.res?.ok) st.stepIdx = Math.min(st.res.steps.length - 1, st.stepIdx + 1);
    syncUI();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => { setPlaying(false); st.stepIdx = 0; st.astarStep = 0; syncUI(); });
  host.querySelector('[data-clear]').addEventListener('click', () => {
    if (st.view === 'astar') st.walls.clear();
    else { st.nodes = [{ id: 0, label: 'A', x: 0.25, y: 0.5 }, { id: 1, label: 'B', x: 0.75, y: 0.5 }]; st.edges = [{ u: 0, v: 1, w: 3 }]; st.start = 0; }
    recompute();
  });

  bindPresets(host, presets, p => {
    st.view = p.view;
    host.querySelectorAll('[data-view] button').forEach(x => x.classList.toggle('on', x.dataset.v === st.view));
    if (p.view === 'graph') {
      const gp = GRAPH_PRESETS[p.graphKey];
      st.nodes = gp.nodes.map(n => ({ ...n }));
      st.edges = gp.edges.map(e => ({ ...e }));
      st.directed = gp.directed; st.algo = p.algo; st.start = 0;
      selAlgo.set(st.algo); tDir.set(st.directed);
    } else {
      st.heuristic = p.heuristic; selHeur.set(st.heuristic);
    }
    recompute();
  });

  bindTasks(host);
  recompute();
  return clean.run;
}

// 1.3 VERİ YAPILARI (Stack, Queue, Linked List, BST/AVL, Heap, Hash Table)
function mountDataStructures(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'AVL Dengeli Sıralı Ekleme', ds: 'bst', avl: true, vals: [10, 20, 30, 40, 50, 25] },
    { label: 'Dengesiz BST (Çubuk)', ds: 'bst', avl: false, vals: [10, 20, 30, 40, 50] },
    { label: 'Min-Heap Öncelik Kuyruğu', ds: 'heap', isMin: true, vals: [35, 12, 48, 7, 22, 15, 3] },
    { label: 'Karma Çakışma (Linear)', ds: 'hash', hmode: 'linear', vals: [12, 23, 34, 45, 5, 16] },
  ];
  const st = {
    ds: 'bst', avl: true, isMin: true, hmode: 'chaining', hsize: 11,
    linear: [14, 27, 35, 42],
    tree: null, treePath: [], lastRot: '',
    heap: [7, 12, 15, 35, 22, 48], heapHi: [],
    hash: hashCreate(11, 'chaining'), hashProbes: [],
    log: ['Hazır: değer girip Ekle / Sil / Ara butonlarını kullan.'],
  };
  for (const v of [30, 15, 45, 10, 22, 55]) st.tree = bstInsert(st.tree, v, { avl: true }).root;
  for (const v of [12, 23, 34, 7, 18, 29]) st.hash = hashInsert(st.hash, v).tbl;

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Temel veri yapılarını canlı etkileşimle incele: **Yığın (Stack)**, **Kuyruk (Queue)**, **Bağlı Liste**, **BST / AVL Ağacı** (otomatik LL/RR/LR/RL rotasyonları), **İkili Yığın (Heap)** ve **Karma Tablosu** (zincirleme vs doğrusal yoklama).', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-ds>
        <button type="button" data-d="stack">Stack</button>
        <button type="button" data-d="queue">Queue</button>
        <button type="button" data-d="ll">Bağlı Liste</button>
        <button type="button" data-d="bst" class="on">BST / AVL</button>
        <button type="button" data-d="heap">Heap</button>
        <button type="button" data-d="hash">Hash Table</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls>
        <div class="slp-ctrl">
          <label class="slp-ctrl-lbl" for="slp-ds-val">Değer (Tam Sayı)</label>
          <div class="slp-btn-row">
            <input id="slp-ds-val" type="number" class="inp slp-in-md" data-val value="25" aria-label="Eklenecek veya aranacak değer">
            <button type="button" class="btn small primary" data-ins>Ekle</button>
            <button type="button" class="btn small" data-del>Sil / Çıkar</button>
            <button type="button" class="btn small ghost" data-find>Ara</button>
          </div>
        </div>
        <div class="slp-btn-row">
          <button type="button" class="btn small ghost" data-rand>Rastgele Ekle</button>
          <button type="button" class="btn small ghost" data-clr>Temizle</button>
        </div>
        <div data-extra></div>
        <div class="slp-log" data-log aria-live="polite"></div>
      </div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-vtitle>Görsel Yapı</h4><span class="slp-badge slp-badge-acc mono" data-vbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Veri yapısı diyagramı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'h_{\\text{AVL}}(n) < 1.44 \\log_2(n+2), \\qquad \\text{BF}(u) = h(u_L) - h(u_R) \\in \\{-1, 0, +1\\}',
        '\\alpha = \\frac{n}{m} \\; (\\text{Yük faktörü}), \\qquad h(k) = k \\bmod m',
      ],
      paragraphs: [
        '**BST** arama, ekleme ve silmede dengeliyken $O(\\log n)$ çalışır; ancak sıralı veri gelirse yüksekliği $O(n)$ olur. **AVL** ağacı her düğümde denge faktörünü $|\\text{BF}| \\le 1$ tutmak için LL, RR, LR veya RL rotasyonları uygular.',
        '**İkili Yığın (Heap)** hem tam ikili ağaç hem de dizi ($\\text{sol}=2i+1, \\text{sağ}=2i+2$) olarak saklanır. **Karma Tablosunda** yük faktörü $\\alpha$ arttıkça doğrusal yoklamada birincil kümelenme (primary clustering) oluşur.',
      ],
      tasks: [
        '**Dengesiz BST** senaryosundan sonra **AVL Dengeli** senaryosunu yükleyip ağaç yüksekliğindeki farkı gör.',
        '**Hash Table** modunda Linear Probing seçerek `12, 23, 34` (tümü mod 11 = 1) anahtarlarını ekleyip çakışma kümesini gözle.',
        '**Heap** modunda kök elemanını art arda çıkararak sıralı çıkış elde edildiğini doğrula.',
      ],
    })}
  </div>`;

  const extra = host.querySelector('[data-extra]');
  const kpis = host.querySelector('[data-kpis]');
  const logEl = host.querySelector('[data-log]');
  const valIn = host.querySelector('[data-val]');
  const tAvl = addToggle(extra, 'AVL Otomatik Dengeleme', st.avl, v => {
    st.avl = v;
    const vals = bstTraversals(st.tree).preorder;
    st.tree = null;
    for (const x of vals) st.tree = bstInsert(st.tree, x, { avl: st.avl }).root;
    pushLog(v ? 'AVL dengeleme açıldı.' : 'Saf BST moduna geçildi.');
    syncUI();
  });
  const tHeapMin = addToggle(extra, 'Min-Heap (kapalıysa Max-Heap)', st.isMin, v => {
    st.isMin = v;
    const vals = st.heap.slice(); st.heap = [];
    for (const x of vals) st.heap = heapPush(st.heap, x, st.isMin).arr;
    syncUI();
  });
  const selHash = addSelect(extra, 'Çakışma Çözümü', [['chaining', 'Zincirleme (Chaining)'], ['linear', 'Doğrusal Yoklama (Linear Probing)']], st.hmode, v => {
    st.hmode = v;
    const keys = st.hash.mode === 'chaining' ? st.hash.buckets.flat() : st.hash.buckets.filter(x => typeof x === 'number');
    st.hash = hashCreate(st.hsize, st.hmode);
    for (const k of keys) st.hash = hashInsert(st.hash, k).tbl;
    syncUI();
  });

  function pushLog(msg) {
    st.log.unshift(msg);
    if (st.log.length > 8) st.log.pop();
  }

  function drawDS(c, W, H) {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();

    if (st.ds === 'stack' || st.ds === 'queue' || st.ds === 'll') {
      const a = st.linear;
      if (!a.length) { c.fillStyle = COL_MUTE; c.font = '13px var(--font)'; c.textAlign = 'center'; c.fillText('Yapı boş — değer ekleyin', W / 2, H / 2); return; }
      const bw = Math.min(68, (W - 60) / Math.max(1, a.length) - 10);
      const startX = Math.max(24, (W - a.length * (bw + 16)) / 2);
      const y = H / 2 - 22;
      for (let i = 0; i < a.length; i++) {
        const x = startX + i * (bw + 16);
        const isEdge = (st.ds === 'stack' && i === a.length - 1) || (st.ds === 'queue' && (i === 0 || i === a.length - 1)) || (st.ds === 'll' && i === 0);
        c.fillStyle = isEdge ? 'rgba(90,176,255,0.22)' : 'rgba(255,255,255,0.06)';
        c.strokeStyle = isEdge ? acc : 'rgba(255,255,255,0.38)';
        c.lineWidth = isEdge ? 2 : 1.4;
        c.fillRect(x, y, bw, 44); c.strokeRect(x, y, bw, 44);
        c.fillStyle = COL_FG; c.font = '600 14px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(String(a[i]), x + bw / 2, y + 27);
        if (st.ds === 'll' && i < a.length - 1) drawArrow(c, x + bw + 2, y + 22, x + bw + 14, y + 22, COL_MUTE, 1.5, 6);
      }
      c.fillStyle = COL_WARN; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      if (st.ds === 'stack') c.fillText('TOP ↑', startX + (a.length - 1) * (bw + 16) + bw / 2, y - 10);
      if (st.ds === 'queue') {
        c.fillText('FRONT ↑', startX + bw / 2, y - 10);
        c.fillText('REAR ↑', startX + (a.length - 1) * (bw + 16) + bw / 2, y + 62);
      }
      if (st.ds === 'll') c.fillText('HEAD ↑', startX + bw / 2, y - 10);
      return;
    }

    if (st.ds === 'bst') {
      if (!st.tree) { c.fillStyle = COL_MUTE; c.font = '13px var(--font)'; c.textAlign = 'center'; c.fillText('Ağaç boş — değer ekleyin', W / 2, H / 2); return; }
      const pathSet = new Set(st.treePath);
      const drawNode = (n, x, y, dx, depth) => {
        if (!n) return;
        const ny = y + Math.min(54, (H - 60) / 4.5);
        if (n.left) {
          c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx, ny); c.stroke();
          drawNode(n.left, x - dx, ny, Math.max(22, dx * 0.52), depth + 1);
        }
        if (n.right) {
          c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, ny); c.stroke();
          drawNode(n.right, x + dx, ny, Math.max(22, dx * 0.52), depth + 1);
        }
        const hi = pathSet.has(n.val);
        c.beginPath(); c.arc(x, y, 17, 0, Math.PI * 2);
        c.fillStyle = hi ? acc : '#111118'; c.fill();
        c.strokeStyle = hi ? '#fff' : 'rgba(255,255,255,0.55)'; c.lineWidth = hi ? 2.4 : 1.6; c.stroke();
        c.fillStyle = hi ? '#000' : COL_FG; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(String(n.val), x, y + 4);
        const bf = avlBalance(n);
        c.fillStyle = Math.abs(bf) > 1 ? COL_BAD : COL_OK;
        c.font = '10px "JetBrains Mono", monospace';
        c.fillText(`bf:${bf}`, x, y - 21);
      };
      drawNode(st.tree, W / 2, 36, Math.min(W * 0.24, 130), 0);
      return;
    }

    if (st.ds === 'heap') {
      const a = st.heap;
      if (!a.length) { c.fillStyle = COL_MUTE; c.font = '13px var(--font)'; c.textAlign = 'center'; c.fillText('Yığın boş', W / 2, H / 2); return; }
      const pos = i => {
        const lvl = Math.floor(Math.log2(i + 1));
        const idxInLvl = i - ((1 << lvl) - 1);
        const slots = 1 << lvl;
        return [((idxInLvl + 0.5) / slots) * (W - 30) + 15, 34 + lvl * 54];
      };
      for (let i = 1; i < a.length; i++) {
        const [x1, y1] = pos((i - 1) >> 1), [x2, y2] = pos(i);
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      for (let i = 0; i < a.length; i++) {
        const [x, y] = pos(i);
        const hi = st.heapHi.includes(i) || i === 0;
        c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2);
        c.fillStyle = i === 0 ? acc : hi ? 'rgba(255,209,102,0.28)' : '#111118'; c.fill();
        c.strokeStyle = hi ? '#fff' : 'rgba(255,255,255,0.5)'; c.lineWidth = 1.6; c.stroke();
        c.fillStyle = i === 0 ? '#000' : COL_FG; c.font = '600 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(String(a[i]), x, y + 4);
      }
      // Array strip at bottom
      const cellW = Math.min(36, (W - 24) / Math.max(1, a.length));
      const sx = (W - a.length * cellW) / 2, ay = H - 38;
      for (let i = 0; i < a.length; i++) {
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.strokeRect(sx + i * cellW, ay, cellW, 24);
        c.fillStyle = COL_FG; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(String(a[i]), sx + (i + 0.5) * cellW, ay + 16);
      }
      return;
    }

    // Hash Table
    const h = st.hash;
    const probeSet = new Set(st.hashProbes);
    const rh = Math.min(26, (H - 22) / h.size);
    for (let i = 0; i < h.size; i++) {
      const y = 12 + i * rh;
      const hi = probeSet.has(i);
      c.fillStyle = hi ? 'rgba(255,209,102,0.25)' : 'rgba(255,255,255,0.05)';
      c.strokeStyle = hi ? COL_WARN : 'rgba(255,255,255,0.22)';
      c.fillRect(18, y, 42, rh - 3); c.strokeRect(18, y, 42, rh - 3);
      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`[${i}]`, 39, y + rh * 0.62);
      if (h.mode === 'chaining') {
        const list = h.buckets[i];
        let x = 74;
        for (const k of list) {
          c.fillStyle = 'rgba(90,176,255,0.22)'; c.strokeStyle = COL_BLUE;
          c.fillRect(x, y, 42, rh - 3); c.strokeRect(x, y, 42, rh - 3);
          c.fillStyle = COL_FG; c.fillText(String(k), x + 21, y + rh * 0.62);
          x += 50;
        }
      } else {
        const slot = h.buckets[i];
        c.fillStyle = slot === 'DEL' ? 'rgba(255,107,107,0.18)' : slot !== null ? 'rgba(91,228,155,0.2)' : 'rgba(0,0,0,0.3)';
        c.strokeStyle = slot === 'DEL' ? COL_BAD : slot !== null ? COL_OK : 'rgba(255,255,255,0.14)';
        c.fillRect(72, y, 88, rh - 3); c.strokeRect(72, y, 88, rh - 3);
        c.fillStyle = slot === 'DEL' ? COL_BAD : COL_FG;
        c.fillText(slot === null ? 'boş' : String(slot), 116, y + rh * 0.62);
      }
    }
  }

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(340, Math.max(250, w * 0.56)), drawDS, clean);

  function syncUI() {
    tAvl.setVisible(st.ds === 'bst');
    tHeapMin.setVisible(st.ds === 'heap');
    selHash.setVisible(st.ds === 'hash');
    logEl.innerHTML = st.log.map(l => `<div>${esc(l)}</div>`).join('');

    if (st.ds === 'bst') {
      const tr = bstTraversals(st.tree);
      host.querySelector('[data-vtitle]').textContent = st.avl ? 'AVL Dengeli Ağaç' : 'İkili Arama Ağacı (BST)';
      host.querySelector('[data-vbadge]').textContent = st.lastRot || (tr.isBalanced ? 'Dengeli' : 'Dengesiz');
      renderKpis(kpis, [
        { lbl: 'Düğüm / Yükseklik', val: `${tr.size} / ${tr.height}`, tone: 'acc' },
        { lbl: 'Denge', val: tr.isBalanced ? '✓ Dengeli' : '✗ Dengesiz', tone: tr.isBalanced ? 'ok' : 'warn' },
        { lbl: 'Inorder (Sıralı)', val: tr.inorder.slice(0, 10).join(', ') || '—' },
      ]);
    } else if (st.ds === 'heap') {
      host.querySelector('[data-vtitle]').textContent = st.isMin ? 'Min-Heap (Ağaç + Dizi)' : 'Max-Heap (Ağaç + Dizi)';
      host.querySelector('[data-vbadge]').textContent = st.heap.length ? `Kök = ${st.heap[0]}` : 'Boş';
      renderKpis(kpis, [
        { lbl: 'Eleman Sayısı', val: String(st.heap.length), tone: 'acc' },
        { lbl: st.isMin ? 'Minimum (Kök)' : 'Maksimum (Kök)', val: st.heap.length ? String(st.heap[0]) : '—', tone: 'ok' },
      ]);
    } else if (st.ds === 'hash') {
      const lf = st.hash.count / st.hash.size;
      host.querySelector('[data-vtitle]').textContent = `Karma Tablosu (m = ${st.hash.size})`;
      host.querySelector('[data-vbadge]').textContent = `α = ${fmtFix(lf, 2)}`;
      renderKpis(kpis, [
        { lbl: 'Yük Faktörü α', val: fmtFix(lf, 2), sub: `${st.hash.count} / ${st.hash.size}`, tone: lf > 0.7 ? 'warn' : 'acc' },
        { lbl: 'Toplam Çakışma', val: String(st.hash.collisions), tone: st.hash.collisions > 0 ? 'warn' : 'ok' },
        { lbl: 'Son Yoklama', val: st.hashProbes.join(' → ') || '—' },
      ]);
    } else {
      const titles = { stack: 'Yığın (LIFO)', queue: 'Kuyruk (FIFO)', ll: 'Tek Yönlü Bağlı Liste' };
      host.querySelector('[data-vtitle]').textContent = titles[st.ds];
      host.querySelector('[data-vbadge]').textContent = `n = ${st.linear.length}`;
      renderKpis(kpis, [
        { lbl: 'Boyut', val: String(st.linear.length), tone: 'acc' },
        { lbl: 'Baş / Son', val: st.linear.length ? `${st.linear[0]} / ${st.linear[st.linear.length - 1]}` : '—' },
      ]);
    }
    cv.render();
  }

  const doInsert = v => {
    if (!Number.isFinite(v)) return;
    if (st.ds === 'stack' || st.ds === 'queue' || st.ds === 'll') {
      if (st.linear.length < 12) st.linear.push(v);
      pushLog(`Eklendi: ${v}`);
    } else if (st.ds === 'bst') {
      const r = bstInsert(st.tree, v, { avl: st.avl });
      st.tree = r.root; st.treePath = r.path.concat(v);
      st.lastRot = r.rotations.length ? `Rotasyon: ${r.rotations.map(x => `${x.type}@${x.pivot}`).join(', ')}` : '';
      pushLog(r.foundDup ? `${v} zaten var.` : `Eklendi: ${v}${st.lastRot ? ' · ' + st.lastRot : ''}`);
    } else if (st.ds === 'heap') {
      const r = heapPush(st.heap, v, st.isMin);
      st.heap = r.arr; st.heapHi = r.steps.at(-1)?.hi || [];
      pushLog(`Yığına eklendi: ${v} (${r.steps.length - 1} takas)`);
    } else {
      const r = hashInsert(st.hash, v);
      st.hash = r.tbl; st.hashProbes = r.probes;
      pushLog(r.full ? 'Tablo dolu!' : `${v} → yuva [${r.idx}]${r.collision ? ' (ÇAKIŞMA!)' : ''}`);
    }
    syncUI();
  };

  host.querySelector('[data-ds]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-d]'); if (!b) return;
    st.ds = b.dataset.d;
    host.querySelectorAll('[data-ds] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  host.querySelector('[data-ins]').addEventListener('click', () => doInsert(Math.trunc(Number(valIn.value))));
  host.querySelector('[data-rand]').addEventListener('click', () => { const v = 1 + Math.floor(Math.random() * 95); valIn.value = String(v); doInsert(v); });
  host.querySelector('[data-del]').addEventListener('click', () => {
    const v = Math.trunc(Number(valIn.value));
    if (st.ds === 'stack') pushLog(st.linear.length ? `Pop: ${st.linear.pop()}` : 'Yığın boş!');
    else if (st.ds === 'queue') pushLog(st.linear.length ? `Dequeue: ${st.linear.shift()}` : 'Kuyruk boş!');
    else if (st.ds === 'll') {
      const idx = st.linear.indexOf(v);
      if (idx >= 0) { st.linear.splice(idx, 1); pushLog(`Silindi: ${v}`); } else pushLog(`${v} bulunamadı.`);
    } else if (st.ds === 'bst') {
      const r = bstDelete(st.tree, v, { avl: st.avl });
      st.tree = r.root; st.treePath = r.path;
      st.lastRot = r.rotations.length ? `Rotasyon: ${r.rotations.map(x => x.type).join(',')}` : '';
      pushLog(r.removed ? `Silindi: ${v}` : `${v} bulunamadı.`);
    } else if (st.ds === 'heap') {
      const r = heapPop(st.heap, st.isMin);
      st.heap = r.arr; st.heapHi = r.steps.at(-1)?.hi || [];
      pushLog(r.popped !== null ? `Kök çıkarıldı: ${r.popped}` : 'Yığın boş!');
    } else {
      const r = hashDelete(st.hash, v);
      st.hash = r.tbl; st.hashProbes = r.probes;
      pushLog(r.removed ? `Silindi: ${v}` : `${v} bulunamadı.`);
    }
    syncUI();
  });
  host.querySelector('[data-find]').addEventListener('click', () => {
    const v = Math.trunc(Number(valIn.value));
    if (st.ds === 'bst') {
      const r = bstSearch(st.tree, v); st.treePath = r.path;
      pushLog(r.found ? `Bulundu: ${v} (yol: ${r.path.join('→')})` : `${v} yok (yol: ${r.path.join('→')})`);
    } else if (st.ds === 'hash') {
      const r = hashSearch(st.hash, v); st.hashProbes = r.probes;
      pushLog(r.found ? `Bulundu: yuva [${r.idx}] (${r.probes.length} yoklama)` : `Bulunamadı (${r.probes.length} yoklama)`);
    } else {
      const arr = st.ds === 'heap' ? st.heap : st.linear;
      const idx = arr.indexOf(v);
      pushLog(idx >= 0 ? `Bulundu: indeks ${idx}` : `${v} yok.`);
    }
    syncUI();
  });
  host.querySelector('[data-clr]').addEventListener('click', () => {
    if (st.ds === 'bst') { st.tree = null; st.treePath = []; st.lastRot = ''; }
    else if (st.ds === 'heap') { st.heap = []; st.heapHi = []; }
    else if (st.ds === 'hash') { st.hash = hashCreate(st.hsize, st.hmode); st.hashProbes = []; }
    else st.linear = [];
    pushLog('Yapı temizlendi.');
    syncUI();
  });

  bindPresets(host, presets, p => {
    st.ds = p.ds;
    host.querySelectorAll('[data-ds] button').forEach(x => x.classList.toggle('on', x.dataset.d === st.ds));
    if (p.ds === 'bst') {
      st.avl = p.avl; tAvl.set(st.avl); st.tree = null; let rots = [];
      for (const v of p.vals) { const r = bstInsert(st.tree, v, { avl: st.avl }); st.tree = r.root; rots.push(...r.rotations); }
      st.lastRot = rots.length ? `Rotasyonlar: ${rots.map(x => x.type).join(', ')}` : '';
    } else if (p.ds === 'heap') {
      st.isMin = p.isMin; tHeapMin.set(st.isMin); st.heap = [];
      for (const v of p.vals) st.heap = heapPush(st.heap, v, st.isMin).arr;
    } else if (p.ds === 'hash') {
      st.hmode = p.hmode; selHash.set(st.hmode); st.hash = hashCreate(st.hsize, st.hmode);
      for (const v of p.vals) st.hash = hashInsert(st.hash, v).tbl;
    }
    syncUI();
  });

  bindTasks(host);
  syncUI();
  return clean.run;
}

// 1.4 İŞLETİM SİSTEMLERİ (CPU Scheduling, Page Replacement, Banker's)
function mountOS(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'SRTF vs FCFS (Klasik)', tab: 'cpu', algo: 'SRTF', quantum: 3 },
    { label: 'Round Robin (q = 2)', tab: 'cpu', algo: 'RR', quantum: 2 },
    { label: 'Belady Anomalisi (FIFO)', tab: 'page', pageAlgo: 'FIFO', frames: 4, ref: '1,2,3,4,1,2,5,1,2,3,4,5' },
    { label: 'Banker Güvenli Durum', tab: 'banker' },
  ];
  const st = {
    tab: 'cpu', algo: 'SRTF', quantum: 3,
    procs: [
      { pid: 'P1', arrival: 0, burst: 8, priority: 2 },
      { pid: 'P2', arrival: 1, burst: 4, priority: 1 },
      { pid: 'P3', arrival: 2, burst: 9, priority: 3 },
      { pid: 'P4', arrival: 3, burst: 5, priority: 2 },
    ],
    pageAlgo: 'FIFO', frames: 3, refStr: '1,2,3,4,1,2,5,1,2,3,4,5',
    banker: {
      available: [3, 3, 2],
      max:        [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
      allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
      reqPid: 1, reqVec: [1, 0, 2],
    },
    lastReqRes: null,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('İşletim sisteminin üç temel çekirdek mekanizmasını incele: **CPU Zamanlama** (Gantt şeması), **Sayfa Değiştirme** (Belady anomalisi ile FIFO/LRU/OPT) ve **Banker Kilitlenme Önleme** algoritması.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="cpu" class="on">CPU Zamanlama</button>
        <button type="button" data-t="page">Sayfa Değiştirme</button>
        <button type="button" data-t="banker">Banker (Deadlock)</button>
      </div>
    </div>
    <div class="slp-kpis" data-kpis></div>
    <div data-body></div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{TAT}_i = \\text{CT}_i - \\text{AT}_i, \\qquad \\text{WT}_i = \\text{TAT}_i - \\text{BT}_i',
        '\\text{Need}[i,j] = \\text{Max}[i,j] - \\text{Allocation}[i,j] \\le \\text{Work}[j]',
      ],
      paragraphs: [
        '**SRTF** (en kısa kalan süre önce) ortalama bekleme süresini kuramsal olarak en aza indirir. **Round Robin** her sürece $q$ zaman dilimi vererek adil tepki süresi sağlar.',
        '**Belady Anomalisi**: FIFO sayfa değiştirmede çerçeve sayısını 3’ten 4’e çıkarmak `1,2,3,4,1,2,5,1,2,3,4,5` dizisinde hata sayısını 9’dan 10’a çıkarır; LRU ve OPT yığın (stack) algoritması olduğu için bu anomaliyi göstermez.',
      ],
      tasks: [
        'CPU sekmesinde **FCFS**, **SJF** ve **SRTF** ortalama bekleme sürelerini karşılaştır.',
        'Sayfa Değiştirme sekmesinde FIFO ile çerçeve sayısını 3 ve 4 arasında değiştirerek **Belady anomalisini** doğrula.',
        'Banker sekmesinde P1 için `[1,0,2]` isteğinin kabul, P0 için `[3,3,0]` isteğinin reddedildiğini gör.',
      ],
    })}
  </div>`;

  const kpis = host.querySelector('[data-kpis]');
  const body = host.querySelector('[data-body]');

  function render() {
    if (st.tab === 'cpu') {
      const res = scheduleCPU(st.procs, { algo: st.algo, quantum: st.quantum });
      renderKpis(kpis, [
        { lbl: 'Ort. Bekleme (WT)', val: fmtFix(res.avgWT, 2), tone: 'acc' },
        { lbl: 'Ort. Dönüş (TAT)', val: fmtFix(res.avgTAT, 2) },
        { lbl: 'Ort. Tepki (RT)', val: fmtFix(res.avgRT, 2) },
        { lbl: 'CPU Kullanımı', val: `%${fmtFix(res.cpuUtil, 1)}`, sub: `Toplam: ${res.makespan}`, tone: 'ok' },
      ]);
      body.innerHTML = `<div class="slp-col">
        <div class="slp-panel">
          <div class="slp-toolbar">
            <div class="slp-toolbar-g">
              <div class="seg" role="tablist" data-calgo>
                ${[['FCFS','FCFS'],['SJF','SJF'],['SRTF','SRTF'],['RR','Round Robin'],['PRIORITY','Öncelik'],['PRIORITY_P','Öncelik (Kes.)']].map(([k,l]) => `<button type="button" data-a="${k}" class="${st.algo===k?'on':''}">${l}</button>`).join('')}
              </div>
              <label class="row small mute" ${st.algo==='RR'?'':'hidden'}>Quantum q: <input type="number" min="1" max="10" value="${st.quantum}" class="inp slp-in-sm" data-q aria-label="Round Robin zaman dilimi"></label>
            </div>
            <button type="button" class="btn small" data-addp>${icon('plus')} Süreç Ekle</button>
          </div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-gantt aria-label="CPU Gantt şeması"></canvas></div>
          <div class="slp-table-wrap">
            <table class="slp-tbl" aria-label="Süreç tablosu ve zamanlama metrikleri">
              <thead><tr><th>Süreç</th><th>Varış (AT)</th><th>Süre (BT)</th><th>Öncelik</th><th>Bitiş (CT)</th><th>Dönüş (TAT)</th><th>Bekleme (WT)</th><th></th></tr></thead>
              <tbody>${st.procs.map((p, i) => {
                const m = res.metrics[i];
                return `<tr data-pi="${i}">
                  <td class="mono"><b>${esc(p.pid)}</b></td>
                  <td><input type="number" min="0" max="50" value="${p.arrival}" class="inp slp-in-sm" data-pk="arrival" aria-label="${esc(p.pid)} varış"></td>
                  <td><input type="number" min="1" max="30" value="${p.burst}" class="inp slp-in-sm" data-pk="burst" aria-label="${esc(p.pid)} çalışma süresi"></td>
                  <td><input type="number" min="1" max="9" value="${p.priority}" class="inp slp-in-sm" data-pk="priority" aria-label="${esc(p.pid)} öncelik"></td>
                  <td class="mono">${m.ct}</td><td class="mono">${m.tat}</td><td class="mono slp-td-hi">${m.wt}</td>
                  <td><button type="button" class="slp-del-btn" data-pdel="${i}" aria-label="${esc(p.pid)} sil">${icon('x')}</button></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>`;

      // Draw Gantt chart
      const gcv = body.querySelector('[data-gantt]');
      if (gcv) {
        const gsetup = setupCanvas(gcv, () => 112, (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const pad = 18, bw = W - 2 * pad, ms = Math.max(1, res.makespan);
          const pColor = pid => pid === 'IDLE' ? 'rgba(255,255,255,0.08)' : PALETTE[(parseInt(pid.slice(1), 10) - 1) % PALETTE.length];
          for (const g of res.gantt) {
            const x1 = pad + (g.start / ms) * bw, x2 = pad + (g.end / ms) * bw;
            c.fillStyle = pColor(g.pid);
            c.fillRect(x1, 24, Math.max(2, x2 - x1 - 1), 46);
            c.strokeStyle = '#000'; c.strokeRect(x1, 24, Math.max(2, x2 - x1 - 1), 46);
            if (x2 - x1 > 18) {
              c.fillStyle = g.pid === 'IDLE' ? COL_MUTE : '#000';
              c.font = 'bold 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
              c.fillText(g.pid, (x1 + x2) / 2, 52);
            }
            c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
            c.fillText(String(g.start), x1, 86);
          }
          c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText(String(res.makespan), pad + bw, 86);
        }, clean);
        gsetup.render();
      }

      body.querySelector('[data-calgo]')?.addEventListener('click', e => {
        const b = e.target.closest?.('[data-a]'); if (!b) return;
        st.algo = b.dataset.a; render(); syncSegments(body, true);
      });
      body.querySelector('[data-q]')?.addEventListener('input', e => { st.quantum = Math.max(1, Math.round(+e.target.value || 1)); render(); });
      body.querySelector('[data-addp]')?.addEventListener('click', () => {
        if (st.procs.length < 8) st.procs.push({ pid: `P${st.procs.length + 1}`, arrival: st.procs.length, burst: 4, priority: 2 });
        render();
      });
      body.querySelectorAll('tr[data-pi] input').forEach(inp => {
        inp.addEventListener('change', e => {
          const i = +e.target.closest('tr').dataset.pi;
          st.procs[i][e.target.dataset.pk] = Math.max(e.target.dataset.pk === 'burst' ? 1 : 0, Math.round(+e.target.value || 0));
          render();
        });
      });
      body.querySelectorAll('[data-pdel]').forEach(btn => {
        btn.addEventListener('click', () => { if (st.procs.length > 1) { st.procs.splice(+btn.dataset.pdel, 1); render(); } });
      });
      syncSegments(body, true);
      return;
    }

    if (st.tab === 'page') {
      const refs = st.refStr.split(/[\s,;]+/).map(x => parseInt(x, 10)).filter(Number.isFinite);
      const res = simulatePageReplacement(refs, st.frames, st.pageAlgo);
      const cmp = [2, 3, 4, 5].map(f => ({
        f,
        fifo: simulatePageReplacement(refs, f, 'FIFO').faults,
        lru: simulatePageReplacement(refs, f, 'LRU').faults,
        opt: simulatePageReplacement(refs, f, 'OPT').faults,
      }));
      const belady = cmp[2].fifo > cmp[1].fifo;
      renderKpis(kpis, [
        { lbl: 'Sayfa Hatası (Fault)', val: String(res.faults), tone: 'bad' },
        { lbl: 'İsabet (Hit)', val: String(res.hits), tone: 'ok' },
        { lbl: 'İsabet Oranı', val: `%${fmtFix(res.hitRate * 100, 1)}`, tone: 'acc' },
        { lbl: 'Belady (3→4 FIFO)', val: belady ? `EVET (${cmp[1].fifo}→${cmp[2].fifo})` : `Yok (${cmp[1].fifo}→${cmp[2].fifo})`, tone: belady ? 'warn' : 'ok' },
      ]);
      body.innerHTML = `<div class="slp-col">
        <div class="slp-panel">
          <div class="slp-toolbar">
            <div class="seg" role="tablist" data-palgo>
              ${[['FIFO','FIFO'],['LRU','LRU'],['OPT','Optimal (OPT)']].map(([k,l]) => `<button type="button" data-pa="${k}" class="${st.pageAlgo===k?'on':''}">${l}</button>`).join('')}
            </div>
            <label class="row small mute">Çerçeve: <input type="number" min="2" max="6" value="${st.frames}" class="inp slp-in-sm" data-fr aria-label="Çerçeve sayısı"></label>
          </div>
          <label class="slp-ctrl"><span class="slp-ctrl-lbl">Sayfa Başvuru Dizisi (virgülle ayır)</span>
            <input type="text" class="inp mono" value="${esc(st.refStr)}" data-refs aria-label="Sayfa başvuru dizisi">
          </label>
          <div class="slp-table-wrap">
            <table class="slp-tbl" aria-label="Sayfa değiştirme adım tablosu">
              <thead><tr><th>Adım</th>${res.steps.map(s => `<th class="mono">${s.page}</th>`).join('')}</tr></thead>
              <tbody>
                ${Array.from({ length: st.frames }, (_, r) => `<tr><td>Ç${r + 1}</td>${res.steps.map(s => `<td class="mono">${s.frames[r] ?? '—'}</td>`).join('')}</tr>`).join('')}
                <tr><td><b>Sonuç</b></td>${res.steps.map(s => `<td class="${s.hit ? 'slp-td-ok' : 'slp-td-bad'}">${s.hit ? 'HIT' : 'MISS'}</td>`).join('')}</tr>
              </tbody>
            </table>
          </div>
          <div class="slp-table-wrap">
            <table class="slp-tbl" aria-label="Çerçeve sayısına göre hata karşılaştırması">
              <thead><tr><th>Çerçeve Sayısı</th><th>FIFO Hata</th><th>LRU Hata</th><th>OPT Hata</th></tr></thead>
              <tbody>${cmp.map(c => `<tr class="${c.f === st.frames ? 'slp-td-hi' : ''}"><td class="mono">${c.f}</td><td class="mono">${c.fifo}</td><td class="mono">${c.lru}</td><td class="mono">${c.opt}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>`;
      body.querySelector('[data-palgo]')?.addEventListener('click', e => {
        const b = e.target.closest?.('[data-pa]'); if (!b) return;
        st.pageAlgo = b.dataset.pa; render();
      });
      body.querySelector('[data-fr]')?.addEventListener('change', e => { st.frames = Math.max(2, Math.min(6, Math.round(+e.target.value || 3))); render(); });
      body.querySelector('[data-refs]')?.addEventListener('change', e => { st.refStr = e.target.value; render(); });
      syncSegments(body, true);
      return;
    }

    // Banker's Algorithm
    const bk = st.banker;
    const saf = bankersSafety(bk);
    renderKpis(kpis, [
      { lbl: 'Sistem Durumu', val: saf.safe ? 'GÜVENLİ' : 'GÜVENLİ DEĞİL', tone: saf.safe ? 'ok' : 'bad' },
      { lbl: 'Güvenli Sıra', val: saf.safe ? saf.sequence.map(i => `P${i}`).join(' → ') : 'Yok!', tone: 'acc' },
      { lbl: 'Mevcut (Available)', val: `[${bk.available.join(', ')}]` },
    ]);
    body.innerHTML = `<div class="slp-col">
      <div class="slp-panel">
        <div class="slp-head"><h4 class="slp-title">Kaynak Matrisleri (A, B, C)</h4><span class="slp-hint">Need = Max − Allocation</span></div>
        <div class="slp-table-wrap">
          <table class="slp-tbl" aria-label="Banker algoritması kaynak matrisleri">
            <thead><tr><th>Süreç</th><th>Allocation (A,B,C)</th><th>Max (A,B,C)</th><th>Need (A,B,C)</th></tr></thead>
            <tbody>${bk.allocation.map((row, i) => `<tr>
              <td class="mono"><b>P${i}</b></td>
              <td class="mono">[ ${row.join(', ')} ]</td>
              <td class="mono">[ ${bk.max[i].join(', ')} ]</td>
              <td class="mono slp-td-hi">[ ${saf.need[i].join(', ')} ]</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="slp-toolbar">
          <div class="slp-toolbar-g">
            <label class="row small mute">Süreç:
              <select class="inp slp-in-sm" data-rpid aria-label="İstek yapan süreç">${bk.allocation.map((_, i) => `<option value="${i}" ${bk.reqPid===i?'selected':''}>P${i}</option>`).join('')}</select>
            </label>
            <label class="row small mute">İstek (A,B,C):
              <input type="text" class="inp slp-in-md" data-rvec value="${bk.reqVec.join(',')}" aria-label="Kaynak istek vektörü">
            </label>
            <button type="button" class="btn small primary" data-testreq>İsteği Test Et</button>
          </div>
          <button type="button" class="btn small ghost" data-avail-dec>Available Azalt (−1 A)</button>
        </div>
        ${st.lastReqRes ? `<div class="slp-alert ${st.lastReqRes.granted ? 'slp-alert-ok' : 'slp-alert-bad'}">${esc(st.lastReqRes.reason)}</div>` : ''}
        <div class="slp-log">${saf.steps.map((s, k) => `<div>Adım ${k + 1}: P${s.pid} · Need [${s.need.join(',')}] ≤ Work [${s.workBefore.join(',')}] ⇒ Yeni Work [${s.workAfter.join(',')}]</div>`).join('') || '<div>Güvenli adım bulunamadı!</div>'}</div>
      </div>
    </div>`;
    body.querySelector('[data-rpid]')?.addEventListener('change', e => { bk.reqPid = +e.target.value; });
    body.querySelector('[data-rvec]')?.addEventListener('change', e => {
      const arr = e.target.value.split(/[\s,]+/).map(Number).filter(Number.isFinite);
      if (arr.length === 3) bk.reqVec = arr;
    });
    body.querySelector('[data-testreq]')?.addEventListener('click', () => {
      st.lastReqRes = bankersRequest({ available: bk.available, max: bk.max, allocation: bk.allocation, pid: bk.reqPid, request: bk.reqVec });
      render();
    });
    body.querySelector('[data-avail-dec]')?.addEventListener('click', () => {
      bk.available[0] = Math.max(0, bk.available[0] - 1); st.lastReqRes = null; render();
    });
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.algo) st.algo = p.algo;
    if (p.quantum) st.quantum = p.quantum;
    if (p.pageAlgo) st.pageAlgo = p.pageAlgo;
    if (p.frames) st.frames = p.frames;
    if (p.ref) st.refStr = p.ref;
    if (p.tab === 'banker') { st.banker.available = [3, 3, 2]; st.lastReqRes = null; }
    render();
  });

  bindTasks(host);
  render();
  return clean.run;
}

// 1.5 BİLGİSAYAR MİMARİSİ (Cache, 5-Stage Pipeline, IEEE 754, Base/2's Comp)
function mountArch(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Önbellek Çakışma (Thrashing)', tab: 'cache', trace: '0x00, 0x100, 0x00, 0x100, 0x00, 0x100, 0x04, 0x104', assoc: 1 },
    { label: 'Load-Use Boru Hattı', tab: 'pipe', pipeKey: 'loaduse', fwd: true },
    { label: 'IEEE 754: −3.5', tab: 'ieee', floatVal: -3.5 },
    { label: 'İkiye Tümleyen: −42 (8-bit)', tab: 'base', rawVal: '-42', fromBase: 10, bits: 8 },
  ];
  const PIPE_PROGS = {
    loaduse: [
      { op: 'ADD', rd: 'R1', rs1: 'R2', rs2: 'R3', text: 'ADD R1, R2, R3' },
      { op: 'SUB', rd: 'R4', rs1: 'R1', rs2: 'R5', text: 'SUB R4, R1, R5' },
      { op: 'LW',  rd: 'R6', rs1: 'R4', rs2: null, text: 'LW  R6, 0(R4)' },
      { op: 'ADD', rd: 'R7', rs1: 'R6', rs2: 'R1', text: 'ADD R7, R6, R1' },
      { op: 'SW',  rd: null, rs1: 'R7', rs2: 'R2', text: 'SW  R7, 4(R2)' },
    ],
    branch: [
      { op: 'ADD', rd: 'R1', rs1: 'R2', rs2: 'R3', text: 'ADD R1, R2, R3' },
      { op: 'BEQ', rd: null, rs1: 'R1', rs2: 'R4', text: 'BEQ R1, R4, L1' },
      { op: 'ADD', rd: 'R5', rs1: 'R2', rs2: 'R2', text: 'ADD R5, R2, R2' },
      { op: 'SUB', rd: 'R6', rs1: 'R5', rs2: 'R1', text: 'SUB R6, R5, R1' },
    ],
    clean: [
      { op: 'ADD', rd: 'R1', rs1: 'R2', rs2: 'R3', text: 'ADD R1, R2, R3' },
      { op: 'SUB', rd: 'R4', rs1: 'R5', rs2: 'R6', text: 'SUB R4, R5, R6' },
      { op: 'ADD', rd: 'R7', rs1: 'R8', rs2: 'R9', text: 'ADD R7, R8, R9' },
      { op: 'SUB', rd: 'R10', rs1: 'R1', rs2: 'R4', text: 'SUB R10, R1, R4' },
    ],
  };

  const st = {
    tab: 'cache',
    traceStr: '0x00, 0x04, 0x08, 0x10, 0x00, 0x100, 0x00, 0x100, 0x14, 0x18',
    cacheBytes: 256, blockBytes: 16, assoc: 1,
    pipeKey: 'loaduse', fwd: true,
    ieeeBits: floatToIEEE754(-3.5).bits,
    rawVal: '-42', fromBase: 10, bits: 8,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Bilgisayar mimarisinin dört temel katmanı: **Önbellek (Cache) Simülatörü**, tehlikeler ve iletmeli **5 Aşamalı Boru Hattı (Pipeline)**, tıklanabilir **IEEE 754 Kayan Nokta Bit İnceleyici** ve **Sayı Tabanı / İkiye Tümleyen** dönüştürücü.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="cache" class="on">Önbellek (Cache)</button>
        <button type="button" data-t="pipe">5 Aşamalı Boru Hattı</button>
        <button type="button" data-t="ieee">IEEE 754 Float</button>
        <button type="button" data-t="base">Taban & 2'ye Tümleyen</button>
      </div>
    </div>
    <div class="slp-kpis" data-kpis></div>
    <div data-body></div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{AMAT} = t_{\\text{hit}} + (1 - h)\\, t_{\\text{miss}}, \\qquad \\text{CPI} = \\frac{\\text{Toplam Çevrim}}{N_{\\text{komut}}}',
        '(-1)^s \\times (1.\\text{mantis})_2 \\times 2^{E - 127} \\quad (\\text{IEEE 754 Tek Duyarlıklı 32-bit})',
      ],
      paragraphs: [
        '**Önbellek (Cache)** adresini Tag + Set Index + Block Offset bitlerine ayırır. Doğrudan eşlemeli (1-yollu) önbellekte aynı indekse düşen iki adres sürekli birbirini atar (**conflict miss**); 2-yollu küme ilişkili (set associative) yapı bunu çözer.',
        '**5 Aşamalı RISC Boru Hattı (IF-ID-EX-MEM-WB)** veri iletme (forwarding) açıkken ALU→ALU bağımlılıklarını 0 beklemeyle çözer; yalnızca **LW → tüketici** (load-use) bağımlılığında 1 çevrim stall gerekir.',
      ],
      tasks: [
        'Önbellek Çakışma senaryosunda ilişkililiği **1-yollu** yerine **2-yollu** yapınca isabet oranının nasıl sıçradığını gör.',
        'Boru Hattı sekmesinde **Veri İletme (Forwarding)** anahtarını kapatıp CPI artışını gözle.',
        'IEEE 754 bit düzenleyicide tüm üs bitlerini `1` yapıp `∞` ve `NaN` özel değerlerini üret.',
      ],
    })}
  </div>`;

  const kpis = host.querySelector('[data-kpis]');
  const body = host.querySelector('[data-body]');

  function render() {
    if (st.tab === 'cache') {
      const trace = st.traceStr.split(/[\s,;]+/).map(s => parseInt(s, s.toLowerCase().startsWith('0x') ? 16 : 10)).filter(Number.isFinite);
      const res = simulateCache({ trace, cacheBytes: st.cacheBytes, blockBytes: st.blockBytes, associativity: st.assoc });
      const amat = 1 + (1 - res.hitRate) * 20;
      renderKpis(kpis, [
        { lbl: 'İsabet Oranı', val: `%${fmtFix(res.hitRate * 100, 1)}`, sub: `${res.hits} Hit / ${res.misses} Miss`, tone: res.hitRate >= 0.5 ? 'ok' : 'warn' },
        { lbl: 'Bit Ayrımı (T/I/O)', val: `${res.tagBits} / ${res.indexBits} / ${res.offsetBits}`, sub: `${res.numSets} küme × ${res.ways} yol`, tone: 'acc' },
        { lbl: 'AMAT (1 + 20·MR)', val: `${fmtFix(amat, 2)} çevrim` },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar">
          <div class="slp-toolbar-g">
            <label class="row small mute">Eşleme:
              <select class="inp slp-sel" style="width:auto" data-assoc aria-label="Önbellek ilişkililiği">
                <option value="1" ${st.assoc===1?'selected':''}>Doğrudan Eşlemeli (1-yollu)</option>
                <option value="2" ${st.assoc===2?'selected':''}>2-Yollu Küme İlişkili</option>
                <option value="4" ${st.assoc===4?'selected':''}>4-Yollu Küme İlişkili</option>
                <option value="0" ${st.assoc===0?'selected':''}>Tam İlişkili (LRU)</option>
              </select>
            </label>
            <label class="row small mute">Blok (B):
              <select class="inp slp-in-sm" data-blk aria-label="Blok boyutu">${[8,16,32,64].map(b=>`<option value="${b}" ${st.blockBytes===b?'selected':''}>${b}</option>`).join('')}</select>
            </label>
            <label class="row small mute">Önbellek (B):
              <select class="inp slp-in-sm" data-csz aria-label="Önbellek boyutu">${[128,256,512].map(b=>`<option value="${b}" ${st.cacheBytes===b?'selected':''}>${b}</option>`).join('')}</select>
            </label>
          </div>
        </div>
        <label class="slp-ctrl"><span class="slp-ctrl-lbl">Adres İzi (Hex veya Ondalık, virgülle)</span>
          <input type="text" class="inp mono" data-tr value="${esc(st.traceStr)}" aria-label="Bellek adres izi">
        </label>
        <div class="slp-table-wrap">
          <table class="slp-tbl" aria-label="Önbellek erişim günlüğü">
            <thead><tr><th>#</th><th>Adres</th><th>Tag</th><th>Küme (Set)</th><th>Ofset</th><th>Yol</th><th>Sonuç</th><th>Atılan Tag</th></tr></thead>
            <tbody>${res.log.map(l => `<tr>
              <td class="mono">${l.step}</td><td class="mono">0x${l.addr.toString(16).toUpperCase().padStart(4,'0')}</td>
              <td class="mono">0x${l.tag.toString(16).toUpperCase()}</td><td class="mono">${l.setIdx}</td><td class="mono">${l.offset}</td>
              <td class="mono">${l.way}</td><td class="${l.hit ? 'slp-td-ok' : 'slp-td-bad'}">${l.hit ? 'HIT' : 'MISS'}</td>
              <td class="mono">${l.evictedTag === null ? '—' : '0x' + l.evictedTag.toString(16).toUpperCase()}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
      body.querySelector('[data-assoc]')?.addEventListener('change', e => { st.assoc = +e.target.value; render(); });
      body.querySelector('[data-blk]')?.addEventListener('change', e => { st.blockBytes = +e.target.value; render(); });
      body.querySelector('[data-csz]')?.addEventListener('change', e => { st.cacheBytes = +e.target.value; render(); });
      body.querySelector('[data-tr]')?.addEventListener('change', e => { st.traceStr = e.target.value; render(); });
      return;
    }

    if (st.tab === 'pipe') {
      const prog = PIPE_PROGS[st.pipeKey] || PIPE_PROGS.loaduse;
      const res = simulatePipeline(prog, { forwarding: st.fwd });
      const ideal = prog.length + 4;
      renderKpis(kpis, [
        { lbl: 'Toplam Çevrim', val: String(res.totalCycles), sub: `İdeal: ${ideal}`, tone: 'acc' },
        { lbl: 'Bekleme (Stall)', val: String(res.stalls), tone: res.stalls > 0 ? 'warn' : 'ok' },
        { lbl: 'CPI', val: fmtFix(res.cpi, 2), sub: `Hızlanma: ${fmtFix((prog.length * 5) / res.totalCycles, 2)}×` },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar">
          <div class="seg" role="tablist" data-pprog>
            <button type="button" data-p="loaduse" class="${st.pipeKey==='loaduse'?'on':''}">RAW + Load-Use</button>
            <button type="button" data-p="branch" class="${st.pipeKey==='branch'?'on':''}">Dallanma (BEQ)</button>
            <button type="button" data-p="clean" class="${st.pipeKey==='clean'?'on':''}">Bağımsız Komutlar</button>
          </div>
          <label class="slp-check-row"><span>Veri İletme (Forwarding)</span><input type="checkbox" data-fwd ${st.fwd?'checked':''} aria-label="Veri iletme açık"></label>
        </div>
        <div class="slp-table-wrap">
          <table class="slp-tbl" aria-label="5 aşamalı boru hattı zamanlama diyagramı">
            <thead><tr><th>Komut</th>${Array.from({ length: res.totalCycles }, (_, c) => `<th class="mono">C${c + 1}</th>`).join('')}</tr></thead>
            <tbody>${res.diagram.map(row => `<tr>
              <td class="mono"><b>${esc(row.text)}</b></td>
              ${Array.from({ length: res.totalCycles }, (_, c) => {
                const s = row.stages[c + 1] || '';
                return `<td class="mono ${s ? `slp-pipe-${s}` : ''}">${s || '·'}</td>`;
              }).join('')}
            </tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="slp-log">${res.hazards.map(h => `<div>${esc(h.type)} · ${esc(prog[h.fromIdx].text)} → ${esc(prog[h.toIdx].text)} (${esc(h.reg)}) · ${h.stalls ? `${h.stalls} stall` : 'İletildi (0 stall)'}</div>`).join('') || '<div>Tehlike yok — ideal akış!</div>'}</div>
      </div>`;
      body.querySelector('[data-pprog]')?.addEventListener('click', e => { const b = e.target.closest?.('[data-p]'); if (b) { st.pipeKey = b.dataset.p; render(); } });
      body.querySelector('[data-fwd]')?.addEventListener('change', e => { st.fwd = e.target.checked; render(); });
      syncSegments(body, true);
      return;
    }

    if (st.tab === 'ieee') {
      const info = ieee754BitsToFloat(st.ieeeBits);
      const kindMap = { normal: 'Normal Sayı', subnormal: 'Alt-normal (Subnormal)', zero: 'Sıfır', infinity: 'Sonsuz (∞)', nan: 'Sayı Değil (NaN)' };
      renderKpis(kpis, [
        { lbl: 'Ondalık Değer', val: Number.isNaN(info.value) ? 'NaN' : Object.is(info.value, -0) ? '−0' : String(info.value), tone: 'acc' },
        { lbl: 'Onaltılık (Hex)', val: info.hex },
        { lbl: 'Üs (E − 127)', val: `${info.expRaw} − 127 = ${info.expUnbiased}` },
        { lbl: 'Sınıf', val: kindMap[info.kind], tone: info.kind === 'normal' ? 'ok' : 'warn' },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar">
          <label class="row small mute">Sayı gir: <input type="text" class="inp slp-in-md" data-fval value="${Number.isNaN(info.value) ? 'NaN' : info.value}" aria-label="Ondalık kayan nokta sayısı"></label>
          <div class="slp-btn-row">
            ${[['1', 1], ['-3.5', -3.5], ['0.1', 0.1], ['−0', -0], ['+∞', Infinity], ['NaN', NaN]].map(([l, v]) => `<button type="button" class="slp-chip" data-fex="${l}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="slp-hint">Bitlere dokunarak ters çevir · <span style="color:#ff6b6b">■ İşaret (1 bit)</span> · <span style="color:#5ab0ff">■ Üs (8 bit)</span> · <span style="color:#5be49b">■ Mantis (23 bit)</span></div>
        <div class="slp-bits-row" role="group" aria-label="IEEE 754 32-bit düzenleyici">
          ${info.bits.split('').map((b, i) => {
            const cls = i === 0 ? 'slp-bit-s' : i < 9 ? 'slp-bit-e' : 'slp-bit-m';
            return `<button type="button" class="slp-bit ${cls} ${b === '1' ? 'slp-b1' : ''}" data-bi="${i}" aria-label="Bit ${31 - i} değeri ${b}">${b}</button>`;
          }).join('')}
        </div>
        <div class="slp-alert mono">Formül: (−1)^${info.sign} × ${fmtFix(info.mantissa, 7)} × 2^(${info.expUnbiased}) = ${Number.isNaN(info.value) ? 'NaN' : info.value}</div>
      </div>`;
      body.querySelector('[data-fval]')?.addEventListener('change', e => {
        const v = Number(e.target.value);
        st.ieeeBits = floatToIEEE754(v).bits; render();
      });
      const exMap = { '1': 1, '-3.5': -3.5, '0.1': 0.1, '−0': -0, '+∞': Infinity, 'NaN': NaN };
      body.querySelectorAll('[data-fex]').forEach(b => b.addEventListener('click', () => { st.ieeeBits = floatToIEEE754(exMap[b.dataset.fex]).bits; render(); }));
      body.querySelectorAll('[data-bi]').forEach(b => b.addEventListener('click', () => {
        const idx = +b.dataset.bi;
        const arr = st.ieeeBits.split('');
        arr[idx] = arr[idx] === '1' ? '0' : '1';
        st.ieeeBits = arr.join('');
        render();
      }));
      return;
    }

    // Number Base & Two's Complement
    const c = convertNumberBase(st.rawVal, st.fromBase, st.bits);
    if (!c.ok) {
      renderKpis(kpis, [{ lbl: 'Hata', val: c.error, tone: 'bad' }]);
    } else {
      renderKpis(kpis, [
        { lbl: 'Ondalık (10)', val: c.dec, tone: 'acc' },
        { lbl: 'İkili (2)', val: c.bin },
        { lbl: 'Onaltılık (16)', val: `0x${c.hex}` },
        { lbl: `${st.bits}-bit İşaretli`, val: String(c.signedVal), sub: `İşaretsiz: ${c.unsignedVal}`, tone: c.overflowSigned ? 'warn' : 'ok' },
      ]);
    }
    body.innerHTML = `<div class="slp-panel">
      <div class="slp-toolbar">
        <div class="slp-toolbar-g">
          <label class="row small mute">Değer: <input type="text" class="inp slp-in-md" data-bval value="${esc(st.rawVal)}" aria-label="Dönüştürülecek sayı"></label>
          <select class="inp slp-sel" style="width:auto" data-bfrom aria-label="Giriş tabanı">
            <option value="10" ${st.fromBase===10?'selected':''}>Ondalık (10)</option>
            <option value="2" ${st.fromBase===2?'selected':''}>İkili (2)</option>
            <option value="8" ${st.fromBase===8?'selected':''}>Sekizlik (8)</option>
            <option value="16" ${st.fromBase===16?'selected':''}>Onaltılık (16)</option>
          </select>
          <div class="seg" data-bitw>
            <button type="button" data-bw="8" class="${st.bits===8?'on':''}">8-bit</button>
            <button type="button" data-bw="16" class="${st.bits===16?'on':''}">16-bit</button>
          </div>
        </div>
      </div>
      ${c.ok ? `<div class="slp-table-wrap"><table class="slp-tbl" aria-label="İkili gösterim karşılaştırması">
        <thead><tr><th>Gösterim</th><th>Bit Dizisi (${st.bits}-bit)</th><th>Açıklama</th></tr></thead>
        <tbody>
          <tr><td><b>İkiye Tümleyen (2's Comp)</b></td><td class="mono slp-td-hi">${c.twosBin}</td><td>Aralık: [${c.minS}, ${c.maxS}] ${c.overflowSigned ? '· TAŞMA!' : ''}</td></tr>
          <tr><td>Bire Tümleyen (1's Comp)</td><td class="mono">${c.onesBin}</td><td>Negatifte tüm bitler ters çevrilir</td></tr>
          <tr><td>İşaret-Büyüklük</td><td class="mono">${c.signMagBin}</td><td>MSB işaret biti, kalanı mutlak değer</td></tr>
          <tr><td>Sekizlik (Octal)</td><td class="mono">${c.oct}</td><td>3'lü bit grupları</td></tr>
        </tbody>
      </table></div>` : `<div class="slp-alert slp-alert-bad">${esc(c.error)}</div>`}
    </div>`;
    body.querySelector('[data-bval]')?.addEventListener('change', e => { st.rawVal = e.target.value; render(); });
    body.querySelector('[data-bfrom]')?.addEventListener('change', e => { st.fromBase = +e.target.value; render(); });
    body.querySelector('[data-bitw]')?.addEventListener('click', e => { const b = e.target.closest?.('[data-bw]'); if (b) { st.bits = +b.dataset.bw; render(); } });
    syncSegments(body, true);
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.trace) st.traceStr = p.trace;
    if (p.assoc !== undefined) st.assoc = p.assoc;
    if (p.pipeKey) st.pipeKey = p.pipeKey;
    if (p.fwd !== undefined) st.fwd = p.fwd;
    if (p.floatVal !== undefined) st.ieeeBits = floatToIEEE754(p.floatVal).bits;
    if (p.rawVal !== undefined) { st.rawVal = p.rawVal; st.fromBase = p.fromBase; st.bits = p.bits; }
    render();
  });

  bindTasks(host);
  render();
  return clean.run;
}

// 1.6 OTOMATLAR & TURİNG MAKİNESİ
function mountAutomata(host, ctx) {
  const clean = createClean(ctx);
  const AUT_PRESETS = {
    even0: {
      label: 'DFA: Çift Sayıda 0',
      input: '10101',
      aut: {
        states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepts: ['q0'],
        transitions: [
          { from: 'q0', sym: '0', to: 'q1' }, { from: 'q0', sym: '1', to: 'q0' },
          { from: 'q1', sym: '0', to: 'q0' }, { from: 'q1', sym: '1', to: 'q1' },
        ],
      },
    },
    nfa2nd: {
      label: 'NFA: Sondan 2. Karakter 1',
      input: '0110',
      aut: {
        states: ['q0', 'q1', 'q2'], alphabet: ['0', '1'], start: 'q0', accepts: ['q2'],
        transitions: [
          { from: 'q0', sym: '0', to: 'q0' }, { from: 'q0', sym: '1', to: 'q0' },
          { from: 'q0', sym: '1', to: 'q1' },
          { from: 'q1', sym: '0', to: 'q2' }, { from: 'q1', sym: '1', to: 'q2' },
        ],
      },
    },
  };
  const presets = [
    { label: 'DFA: Çift Sayıda 0', tab: 'dfa', key: 'even0' },
    { label: 'NFA → DFA Alt Küme İnşası', tab: 'subset', key: 'nfa2nd' },
    { label: 'Regex → Thompson NFA', tab: 'regex', pattern: '(a|b)*abb', testStr: 'ababb' },
    { label: 'Turing: İkili Artırma (+1)', tab: 'tm', tmKey: 'bin-inc', tmIn: '1011' },
  ];

  const st = {
    tab: 'dfa', aut: structuredClone(AUT_PRESETS.nfa2nd.aut), inputStr: '0110', stepIdx: 0,
    regexPat: '(a|b)*abb', regexTest: 'ababb',
    tmKey: 'bin-inc', tmInput: '1011', tmState: createTMState(TM_PRESETS['bin-inc'], '1011'),
    playing: false, accum: 0,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Sonlu durum makinelerini (**DFA / ε-NFA**) animasyonla çalıştır, **NFA→DFA** alt küme dönüşümünü ve **Düzenli İfade → Thompson NFA** inşasını gör, hazır **Turing Makinelerini** şerit üzerinde adım adım izle.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="dfa" class="on">DFA / NFA Çalıştır</button>
        <button type="button" data-t="subset">NFA → DFA</button>
        <button type="button" data-t="regex">Regex → NFA</button>
        <button type="button" data-t="tm">Turing Makinesi</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play aria-label="Oynat veya duraklat">${icon('play')} Oynat</button>
        <button type="button" class="btn small" data-step>Adım →</button>
        <button type="button" class="btn small ghost" data-reset>Sıfırla</button>
      </div>
    </div>
    <div class="slp-kpis" data-kpis></div>
    <div data-body></div>
    <div class="slp-plot-card" data-cvwrap>
      <div class="slp-head"><h4 class="slp-title" data-ctitle>Durum Diyagramı</h4><span class="slp-badge slp-badge-acc mono" data-cbadge>—</span></div>
      <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Otomat durum diyagramı"></canvas></div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'M = (Q, \\Sigma, \\delta, q_0, F), \\qquad |Q_{\\text{DFA}}| \\le 2^{|Q_{\\text{NFA}}|}',
        '\\delta_{\\text{TM}}: Q \\times \\Gamma \\to Q \\times \\Gamma \\times \\{L, R, S\\}',
      ],
      paragraphs: [
        '**Alt Küme İnşası (Subset Construction)** her NFA’yı eşdeğer bir DFA’ya dönüştürür; DFA’nın her durumu NFA’nın eşzamanlı bulunabileceği durumların bir alt kümesidir.',
        '**Thompson İnşası** düzenli ifadeyi (`|`, birleştirme, `*`, `+`, `?`) doğrusal sayıda durum ve $\\varepsilon$-geçişle bir NFA’ya çevirir. **Turing Makinesi** sonsuz şerit üzerindeki okuma/yazma kafasıyla hesaplanabilir tüm fonksiyonları modeller.',
      ],
      tasks: [
        'NFA→DFA sekmesinde `0110` ve `0101` dizilerinin hem NFA hem üretilen DFA’da aynı sonucu verdiğini doğrula.',
        'Regex→NFA sekmesinde `(0|1)*00` yazarak sonu `00` ile biten dizileri test et.',
        'Turing Makinesinde `0ⁿ1ⁿ` makinesini seçip `0011` (kabul) ve `001` (red) girdilerini adım adım izle.',
      ],
    })}
  </div>`;

  const kpis = host.querySelector('[data-kpis]');
  const body = host.querySelector('[data-body]');
  const cvWrap = host.querySelector('[data-cvwrap]');
  const playBtn = host.querySelector('[data-play]');

  function activeAutomaton() {
    if (st.tab === 'subset') return nfaToDfa(st.aut);
    if (st.tab === 'regex') {
      const r = regexToNfa(st.regexPat);
      return r.ok ? r.nfa : null;
    }
    return st.aut;
  }

  function drawAutomaton(c, W, H) {
    c.clearRect(0, 0, W, H);
    const aut = activeAutomaton();
    if (!aut || !aut.states.length) return;
    const acc = accentColor();
    const run = runAutomaton(aut, st.tab === 'regex' ? st.regexTest : st.inputStr);
    const curStep = run.trace[Math.min(st.stepIdx, run.trace.length - 1)];
    const activeSet = new Set(curStep?.states || []);
    const acceptSet = new Set(aut.accepts);

    const n = aut.states.length;
    const pos = new Map();
    if (n <= 8) {
      const cx = W / 2, cy = H / 2, rx = Math.min(W * 0.36, 175), ry = Math.min(H * 0.32, 92);
      aut.states.forEach((s, i) => {
        const a = Math.PI + (2 * Math.PI * i) / n;
        pos.set(s, [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      });
    } else {
      const cols = Math.ceil(Math.sqrt(n * 1.4));
      const rows = Math.ceil(n / cols);
      aut.states.forEach((s, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        pos.set(s, [((col + 0.5) / cols) * (W - 60) + 30, ((row + 0.5) / rows) * (H - 50) + 25]);
      });
    }

    // Group transitions by (from, to)
    const grouped = new Map();
    for (const tr of aut.transitions) {
      const k = `${tr.from}>>${tr.to}`;
      if (!grouped.has(k)) grouped.set(k, { from: tr.from, to: tr.to, syms: [] });
      grouped.get(k).syms.push(tr.sym || 'ε');
    }
    const R = n > 8 ? 14 : 21;
    for (const g of grouped.values()) {
      const p1 = pos.get(g.from), p2 = pos.get(g.to);
      if (!p1 || !p2) continue;
      const lbl = g.syms.join(',');
      if (g.from === g.to) {
        c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(p1[0], p1[1] - R - 10, 12, 0.3, Math.PI * 2 - 0.3); c.stroke();
        c.fillStyle = COL_WARN; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(lbl, p1[0], p1[1] - R - 26);
      } else {
        const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const rev = grouped.has(`${g.to}>>${g.from}`);
        const bend = rev ? 16 : 0;
        const sx = p1[0] + ux * R - uy * (bend * 0.4), sy = p1[1] + uy * R + ux * (bend * 0.4);
        const ex = p2[0] - ux * R - uy * (bend * 0.4), ey = p2[1] - uy * R + ux * (bend * 0.4);
        drawArrow(c, sx, sy, ex, ey, 'rgba(255,255,255,0.4)', 1.5, 7);
        c.fillStyle = COL_WARN; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(lbl, (sx + ex) / 2 - uy * (10 + bend * 0.4), (sy + ey) / 2 + ux * (10 + bend * 0.4));
      }
    }

    // Start arrow
    const sp = pos.get(aut.start);
    if (sp) drawArrow(c, sp[0] - R - 24, sp[1], sp[0] - R - 2, sp[1], COL_BLUE, 2, 7);

    for (const s of aut.states) {
      const [x, y] = pos.get(s);
      const isAct = activeSet.has(s);
      c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2);
      c.fillStyle = isAct ? acc : '#111118'; c.fill();
      c.strokeStyle = isAct ? '#fff' : acceptSet.has(s) ? COL_OK : 'rgba(255,255,255,0.55)';
      c.lineWidth = isAct ? 2.6 : 1.6; c.stroke();
      if (acceptSet.has(s)) {
        c.beginPath(); c.arc(x, y, R - 4, 0, Math.PI * 2); c.stroke();
      }
      c.fillStyle = isAct ? '#000' : COL_FG;
      c.font = `600 ${n > 8 ? 9.5 : 11}px "JetBrains Mono", monospace`; c.textAlign = 'center';
      c.fillText(s.length > 7 ? s.slice(0, 7) : s, x, y + 4);
    }
  }

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(300, Math.max(220, w * 0.46)), drawAutomaton, clean);

  function render() {
    cvWrap.hidden = st.tab === 'tm';
    if (st.tab === 'tm') {
      const tm = TM_PRESETS[st.tmKey];
      const s = st.tmState;
      const statusMap = { running: 'Çalışıyor', accept: '✓ KABUL / DURDU', reject: '✗ RED', timeout: 'Adım Sınırı' };
      renderKpis(kpis, [
        { lbl: 'Durum', val: statusMap[s.status], tone: s.status === 'accept' ? 'ok' : s.status === 'reject' ? 'bad' : 'acc' },
        { lbl: 'Aktif Durum', val: s.state },
        { lbl: 'Adım Sayısı', val: String(s.steps) },
        { lbl: 'Şerit Çıktısı', val: tmTapeString(tm, s) || '∅' },
      ]);
      const minI = Math.min(s.head - 5, ...(s.tape.size ? [...s.tape.keys()] : [0]));
      const maxI = Math.max(s.head + 5, ...(s.tape.size ? [...s.tape.keys()] : [5]));
      const cells = [];
      for (let i = minI; i <= maxI; i++) {
        const ch = s.tape.get(i) ?? tm.blank;
        cells.push(`<div class="slp-cell ${i === s.head ? 'slp-cell-head' : ''}">${esc(ch)}</div>`);
      }
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar">
          <select class="inp slp-sel" style="width:auto" data-tmsel aria-label="Turing makinesi seçimi">
            ${Object.entries(TM_PRESETS).map(([k, v]) => `<option value="${k}" ${k===st.tmKey?'selected':''}>${esc(v.label)}</option>`).join('')}
          </select>
          <label class="row small mute">Girdi: <input type="text" class="inp slp-in-md" data-tmin value="${esc(st.tmInput)}" aria-label="Turing şerit girdisi"></label>
        </div>
        <p class="slp-hint">${esc(tm.desc)} · Son kural: <b class="mono">${esc(s.lastRule || '—')}</b></p>
        <div class="slp-tape" role="region" aria-label="Turing makinesi şeridi">${cells.join('')}</div>
      </div>`;
      body.querySelector('[data-tmsel]')?.addEventListener('change', e => {
        st.tmKey = e.target.value; st.tmInput = TM_PRESETS[st.tmKey].defaultInput;
        st.tmState = createTMState(TM_PRESETS[st.tmKey], st.tmInput); render();
      });
      body.querySelector('[data-tmin]')?.addEventListener('change', e => {
        st.tmInput = e.target.value.trim(); st.tmState = createTMState(TM_PRESETS[st.tmKey], st.tmInput); render();
      });
      return;
    }

    const aut = activeAutomaton();
    const str = st.tab === 'regex' ? st.regexTest : st.inputStr;
    const run = aut ? runAutomaton(aut, str) : null;
    const cur = run?.trace?.[Math.min(st.stepIdx, run.trace.length - 1)];

    if (st.tab === 'dfa') {
      renderKpis(kpis, [
        { lbl: 'Karar', val: run.accepted ? '✓ KABUL' : '✗ RED', tone: run.accepted ? 'ok' : 'bad' },
        { lbl: 'Adım / Karakter', val: `${st.stepIdx} / ${str.length} (${cur?.char || '—'})`, tone: 'acc' },
        { lbl: 'Aktif Durumlar', val: cur?.states.join(', ') || '∅' },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar">
          <label class="row small mute">Girdi Dizisi: <input type="text" class="inp slp-in-md" data-ain value="${esc(st.inputStr)}" aria-label="Otomat girdi dizisi"></label>
          <div class="slp-btn-row">
            <button type="button" class="btn small ghost" data-addst>${icon('plus')} Durum Ekle</button>
            <button type="button" class="btn small ghost" data-load="even0">Çift 0 (DFA)</button>
            <button type="button" class="btn small ghost" data-load="nfa2nd">Sondan 2. = 1 (NFA)</button>
          </div>
        </div>
        <div class="slp-toolbar-g">
          <span class="slp-hint">Kabul durumları (tıkla):</span>
          ${st.aut.states.map(s => `<button type="button" class="slp-chip ${st.aut.accepts.includes(s)?'slp-on':''}" data-acc="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
        <div class="slp-toolbar-g">
          <select class="inp slp-in-sm" data-tf aria-label="Kaynak durum">${st.aut.states.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
          <input type="text" class="inp slp-in-sm" data-tsym value="0" placeholder="0/1/ε" aria-label="Geçiş sembolü">
          <select class="inp slp-in-sm" data-tt aria-label="Hedef durum">${st.aut.states.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
          <button type="button" class="btn small" data-addtr>Geçiş Ekle</button>
        </div>
      </div>`;
      body.querySelector('[data-ain]')?.addEventListener('input', e => { st.inputStr = e.target.value; st.stepIdx = st.inputStr.length; render(); });
      body.querySelector('[data-addst]')?.addEventListener('click', () => {
        if (st.aut.states.length < 8) st.aut.states.push(`q${st.aut.states.length}`);
        render();
      });
      body.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
        const pr = AUT_PRESETS[b.dataset.load];
        st.aut = structuredClone(pr.aut); st.inputStr = pr.input; st.stepIdx = st.inputStr.length; render();
      }));
      body.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => {
        const s = b.dataset.acc;
        const i = st.aut.accepts.indexOf(s);
        if (i >= 0) st.aut.accepts.splice(i, 1); else st.aut.accepts.push(s);
        render();
      }));
      body.querySelector('[data-addtr]')?.addEventListener('click', () => {
        const from = body.querySelector('[data-tf]').value;
        const to = body.querySelector('[data-tt]').value;
        const sym = body.querySelector('[data-tsym]').value.trim();
        const sClean = sym === 'ε' ? '' : sym.slice(0, 1);
        if (sClean && !st.aut.alphabet.includes(sClean)) st.aut.alphabet.push(sClean);
        st.aut.transitions.push({ from, sym: sClean, to });
        render();
      });
    } else if (st.tab === 'subset') {
      const dfa = aut;
      renderKpis(kpis, [
        { lbl: 'NFA Durumları', val: String(st.aut.states.length) },
        { lbl: 'DFA Alt Küme Sayısı', val: String(dfa.states.length), tone: 'acc' },
        { lbl: `Test "${str}"`, val: run.accepted ? '✓ KABUL' : '✗ RED', tone: run.accepted ? 'ok' : 'bad' },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-table-wrap"><table class="slp-tbl" aria-label="Alt küme geçiş tablosu">
          <thead><tr><th>DFA Durumu</th>${dfa.alphabet.map(a => `<th class="mono">δ(·, ${esc(a)})</th>`).join('')}<th>Kabul</th></tr></thead>
          <tbody>${dfa.states.map(ds => `<tr>
            <td class="mono"><b>${esc(ds)}</b></td>
            ${dfa.alphabet.map(a => `<td class="mono">${esc(dfa.transitions.find(t => t.from === ds && t.sym === a)?.to || '∅')}</td>`).join('')}
            <td>${dfa.accepts.includes(ds) ? '✓' : '—'}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    } else {
      const rx = regexToNfa(st.regexPat);
      renderKpis(kpis, [
        { lbl: 'Ayrıştırma', val: rx.ok ? 'Geçerli' : 'Hata', sub: rx.ok ? `Postfix: ${rx.postfix}` : rx.error, tone: rx.ok ? 'ok' : 'bad' },
        { lbl: 'Thompson Durum/Geçiş', val: rx.ok ? `${rx.nfa.states.length} / ${rx.nfa.transitions.length}` : '—', tone: 'acc' },
        { lbl: `Test "${st.regexTest}"`, val: run ? (run.accepted ? '✓ KABUL' : '✗ RED') : '—', tone: run?.accepted ? 'ok' : 'bad' },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar-g">
          <label class="row small mute">Regex: <input type="text" class="inp slp-in-md" data-rx value="${esc(st.regexPat)}" aria-label="Düzenli ifade"></label>
          <label class="row small mute">Test Dizisi: <input type="text" class="inp slp-in-md" data-rxt value="${esc(st.regexTest)}" aria-label="Regex test dizisi"></label>
        </div>
      </div>`;
      body.querySelector('[data-rx]')?.addEventListener('change', e => { st.regexPat = e.target.value; st.stepIdx = st.regexTest.length; render(); });
      body.querySelector('[data-rxt]')?.addEventListener('input', e => { st.regexTest = e.target.value; st.stepIdx = st.regexTest.length; render(); });
    }

    host.querySelector('[data-ctitle]').textContent = st.tab === 'subset' ? 'Üretilen DFA Diyagramı' : st.tab === 'regex' ? 'Thompson ε-NFA Diyagramı' : 'Aktif Otomat Diyagramı';
    host.querySelector('[data-cbadge]').textContent = cur ? `Adım ${st.stepIdx}: {${cur.states.join(',')}}` : '—';
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    st.accum += dt * 2.6;
    if (st.accum >= 1) {
      st.accum -= 1;
      if (st.tab === 'tm') {
        st.tmState = stepTM(TM_PRESETS[st.tmKey], st.tmState);
        render();
        if (st.tmState.status !== 'running') { setPlaying(false); return false; }
      } else {
        const len = (st.tab === 'regex' ? st.regexTest : st.inputStr).length;
        if (st.stepIdx < len) { st.stepIdx++; render(); }
        else { setPlaying(false); return false; }
      }
    }
    return st.playing;
  }, clean);

  function setPlaying(p) {
    st.playing = p;
    playBtn.innerHTML = p ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (p) loop.start(); else loop.stop();
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    setPlaying(false); st.tab = b.dataset.t; st.stepIdx = 0;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  playBtn.addEventListener('click', () => {
    if (!st.playing) {
      if (st.tab === 'tm' && st.tmState.status !== 'running') st.tmState = createTMState(TM_PRESETS[st.tmKey], st.tmInput);
      else if (st.tab !== 'tm') st.stepIdx = 0;
    }
    setPlaying(!st.playing);
  });
  host.querySelector('[data-step]').addEventListener('click', () => {
    setPlaying(false);
    if (st.tab === 'tm') st.tmState = stepTM(TM_PRESETS[st.tmKey], st.tmState);
    else { const len = (st.tab === 'regex' ? st.regexTest : st.inputStr).length; st.stepIdx = Math.min(len, st.stepIdx + 1); }
    render();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => {
    setPlaying(false);
    st.stepIdx = 0;
    st.tmState = createTMState(TM_PRESETS[st.tmKey], st.tmInput);
    render();
  });
  bindPresets(host, presets, p => {
    setPlaying(false); st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.key) { st.aut = structuredClone(AUT_PRESETS[p.key].aut); st.inputStr = AUT_PRESETS[p.key].input; st.stepIdx = st.inputStr.length; }
    if (p.pattern) { st.regexPat = p.pattern; st.regexTest = p.testStr; st.stepIdx = st.regexTest.length; }
    if (p.tmKey) { st.tmKey = p.tmKey; st.tmInput = p.tmIn; st.tmState = createTMState(TM_PRESETS[st.tmKey], st.tmInput); }
    render();
  });

  bindTasks(host);
  st.stepIdx = st.inputStr.length;
  render();
  return clean.run;
}

// 1.7 YAPAY SİNİR AĞI (MLP), K-MEANS & REGRESYON
function mountNeuralML(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'MLP · XOR (Doğrusal Olmayan)', mode: 'mlp', dataset: 'xor', act: 'tanh', lr: 0.35, hidden: 8 },
    { label: 'MLP · İç İçe Çemberler', mode: 'mlp', dataset: 'circles', act: 'tanh', lr: 0.3, hidden: 8 },
    { label: 'MLP · İki Sarmal (Zor)', mode: 'mlp', dataset: 'spirals', act: 'tanh', lr: 0.25, hidden: 10 },
    { label: 'K-Means · 4 Küme', mode: 'kmeans', k: 4 },
    { label: 'Lojistik Regresyon GD', mode: 'logreg', lr: 0.4 },
  ];

  const st = {
    mode: 'mlp', dataset: 'xor', act: 'tanh', lr: 0.35, hidden: 8, seed: 42,
    data: [], net: null, lossHist: [], acc: 0,
    k: 3, centroids: [], assignments: [], inertia: 0, kmIter: 0,
    linPts: [], linW: 0, linB: 0, linClosed: null,
    logW1: 0, logW2: 0, logB: 0,
    playing: false,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Küçük bir **Çok Katmanlı Algılayıcıyı (MLP)** 2B veri setlerinde canlı eğit; karar sınırı ısı haritasını ve kayıp eğrisini izle. Ayrıca **K-Means kümeleme** ve **Doğrusal / Lojistik Regresyon** gradyan inişini adım adım gözle.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-mode>
        <button type="button" data-m="mlp" class="on">MLP Sinir Ağı</button>
        <button type="button" data-m="kmeans">K-Means</button>
        <button type="button" data-m="linreg">Doğrusal Reg.</button>
        <button type="button" data-m="logreg">Lojistik Reg.</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play aria-label="Eğitimi başlat veya duraklat">${icon('play')} Eğit</button>
        <button type="button" class="btn small" data-step>1 Adım</button>
        <button type="button" class="btn small ghost" data-reset>Sıfırla</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-grid-2">
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title" data-ctitle>Karar Sınırı & Veri</h4><span class="slp-badge slp-badge-acc mono" data-cbadge>—</span></div>
            <div class="slp-cv-box"><canvas class="slp-cv slp-cv-tap" data-cv aria-label="Makine öğrenmesi 2B karar sınırı tuvali"></canvas></div>
          </div>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">Kayıp (Loss) Eğrisi</h4></div>
            <div class="slp-cv-box" data-lbox><canvas class="slp-cv" data-loss aria-label="Eğitim kayıp grafiği"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathcal{L}_{\\text{BCE}} = -\\frac{1}{N}\\sum_{i=1}^N \\bigl[y_i \\ln \\hat{y}_i + (1-y_i)\\ln(1-\\hat{y}_i)\\bigr]',
        '\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta \\mathcal{L}(\\theta), \\qquad J_{\\text{KMeans}} = \\sum_{c=1}^K \\sum_{x \\in C_c} \\|x - \\mu_c\\|^2',
      ],
      paragraphs: [
        'Tek katmanlı algılayıcı (lojistik regresyon) yalnızca doğrusal olarak ayrılabilen verileri sınıflandırır; **XOR**, **çember** veya **sarmal** gibi sınırlar için gizli katman ve doğrusal olmayan aktivasyon ($\\tanh$, ReLU) şarttır.',
        '**K-Means** iki adımı yineler: her noktayı en yakın merkeze ata, sonra merkezleri küme ortalamasına taşı. **Doğrusal Regresyon** için gradyan inişi kapalı form en küçük kareler doğrusuna yakınsar.',
      ],
      tasks: [
        'MLP ile **XOR** veri setini eğitip karar sınırının 4 bölgeyi nasıl ayırdığını ve kaybın düşüşünü izle.',
        'Doğrusal Regresyon tuvaline dokunarak yeni noktalar ekle ve gradyan inişinin kesikli kapalı-form doğruya yakınsamasını gör.',
        'K-Means modunda K değerini 2’den 5’e değiştirip küme içi kareler toplamının (inertia) nasıl azaldığını incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const cvEl = host.querySelector('[data-cv]');
  const lossCv = host.querySelector('[data-loss]');

  const selData = addSelect(ctrls, '2B Veri Seti', [['xor', 'XOR (4 Bölge)'], ['circles', 'İç İçe Çemberler'], ['spirals', 'İki Sarmal'], ['gaussians', 'İki Gauss Kümesi']], st.dataset, v => { st.dataset = v; resetModel(); });
  const selAct = addSelect(ctrls, 'Aktivasyon Fonksiyonu', [['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', 'Sigmoid']], st.act, v => { st.act = v; resetModel(); });
  const sHid = addSlider(ctrls, { label: 'Gizli Nöron Sayısı', min: 3, max: 12, step: 1, value: st.hidden, fmt: v => String(Math.round(v)), onInput: v => { st.hidden = Math.round(v); resetModel(); } });
  const sLr = addSlider(ctrls, { label: 'Öğrenme Hızı η', min: 0.02, max: 1.0, step: 0.02, value: st.lr, fmt: v => fmtFix(v, 2), onInput: v => { st.lr = v; } });
  const sK = addSlider(ctrls, { label: 'Küme Sayısı K', min: 2, max: 6, step: 1, value: st.k, fmt: v => String(Math.round(v)), onInput: v => { st.k = Math.round(v); resetModel(); } });

  function drawML(c, W, H) {
    c.clearRect(0, 0, W, H);
    if (st.mode === 'mlp' && !st.net) return; // setupCanvas draws once before the network is created
    const toPx = (x, y) => [((x + 1.2) / 2.4) * W, ((1.2 - y) / 2.4) * H];

    if (st.mode === 'mlp' || st.mode === 'logreg') {
      // Heatmap decision boundary
      const N = 26, cw = W / N, ch = H / N;
      for (let j = 0; j < N; j++) {
        const y = 1.2 - ((j + 0.5) / N) * 2.4;
        for (let i = 0; i < N; i++) {
          const x = -1.2 + ((i + 0.5) / N) * 2.4;
          const p = st.mode === 'mlp'
            ? mlpForward(st.net, [x, y]).prob
            : 1 / (1 + Math.exp(-(st.logW1 * x + st.logW2 * y + st.logB)));
          const r = Math.round(255 * (1 - p) * 0.55 + 90 * p * 0.35);
          const g = Math.round(107 * (1 - p) * 0.4 + 228 * p * 0.45);
          const b = Math.round(107 * (1 - p) * 0.35 + 255 * p * 0.55);
          c.fillStyle = `rgba(${r},${g},${b},0.42)`;
          c.fillRect(i * cw, j * ch, cw + 0.8, ch + 0.8);
        }
      }
      for (const pt of st.data) {
        const [px, py] = toPx(pt.x, pt.y);
        c.beginPath(); c.arc(px, py, 4.2, 0, Math.PI * 2);
        c.fillStyle = pt.label ? COL_BLUE : COL_BAD; c.fill();
        c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
      }
      return;
    }

    if (st.mode === 'kmeans') {
      for (let i = 0; i < st.data.length; i++) {
        const pt = st.data[i];
        const [px, py] = toPx(pt.x, pt.y);
        const col = PALETTE[(st.assignments[i] || 0) % PALETTE.length];
        c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2);
        c.fillStyle = col; c.fill();
      }
      st.centroids.forEach((ct, j) => {
        const [px, py] = toPx(ct.x, ct.y);
        c.strokeStyle = '#fff'; c.fillStyle = PALETTE[j % PALETTE.length]; c.lineWidth = 2.5;
        c.beginPath(); c.arc(px, py, 8, 0, Math.PI * 2); c.fill(); c.stroke();
      });
      return;
    }

    // Linear regression
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    const [ox, oy] = toPx(0, 0);
    c.beginPath(); c.moveTo(0, oy); c.lineTo(W, oy); c.moveTo(ox, 0); c.lineTo(ox, H); c.stroke();
    // Closed-form dashed line
    if (st.linClosed) {
      const [x1, y1] = toPx(-1.2, st.linClosed.w * -1.2 + st.linClosed.b);
      const [x2, y2] = toPx(1.2, st.linClosed.w * 1.2 + st.linClosed.b);
      c.save(); c.strokeStyle = COL_OK; c.setLineDash([5, 4]); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
    }
    // GD current line
    const [gx1, gy1] = toPx(-1.2, st.linW * -1.2 + st.linB);
    const [gx2, gy2] = toPx(1.2, st.linW * 1.2 + st.linB);
    c.strokeStyle = accentColor(); c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(gx1, gy1); c.lineTo(gx2, gy2); c.stroke();
    for (const pt of st.linPts) {
      const [px, py] = toPx(pt.x, pt.y);
      c.beginPath(); c.arc(px, py, 4.5, 0, Math.PI * 2);
      c.fillStyle = COL_WARN; c.fill();
    }
  }

  const cv = setupCanvas(cvEl, w => Math.min(280, Math.max(220, w * 0.85)), drawML, clean);

  function drawLoss() {
    if (st.lossHist.length < 2) return;
    const xs = st.lossHist.map((_, i) => i + 1);
    safePlot(lossCv, [{ name: 'Kayıp', color: PLOT_COLORS[1], xs, ys: st.lossHist }], { x0: 1, x1: Math.max(10, xs.length), ylabel: st.mode === 'kmeans' ? 'Inertia' : 'Kayıp', height: 225 });
  }

  function syncUI() {
    selData.setVisible(st.mode === 'mlp');
    selAct.setVisible(st.mode === 'mlp');
    sHid.setVisible(st.mode === 'mlp');
    sLr.setVisible(st.mode !== 'kmeans');
    sK.setVisible(st.mode === 'kmeans');
    const lastL = st.lossHist.at(-1) ?? 0;

    if (st.mode === 'mlp') {
      host.querySelector('[data-ctitle]').textContent = `MLP [2–${st.hidden}–${st.hidden}–1] Karar Sınırı`;
      host.querySelector('[data-cbadge]').textContent = `Epoch ${st.net.epoch}`;
      renderKpis(kpis, [
        { lbl: 'Doğruluk', val: `%${fmtFix(st.acc * 100, 1)}`, tone: st.acc >= 0.85 ? 'ok' : 'acc' },
        { lbl: 'BCE Kayıp', val: fmtFix(lastL, 4) },
        { lbl: 'Epoch', val: String(st.net.epoch) },
      ]);
    } else if (st.mode === 'kmeans') {
      host.querySelector('[data-ctitle]').textContent = `K-Means (K = ${st.k})`;
      host.querySelector('[data-cbadge]').textContent = `Tur ${st.kmIter}`;
      renderKpis(kpis, [
        { lbl: 'Küme Sayısı K', val: String(st.k), tone: 'acc' },
        { lbl: 'Inertia (WCSS)', val: fmtFix(st.inertia, 3) },
        { lbl: 'İterasyon', val: String(st.kmIter) },
      ]);
    } else if (st.mode === 'linreg') {
      host.querySelector('[data-ctitle]').textContent = 'Doğrusal Regresyon (Tıkla: nokta ekle)';
      host.querySelector('[data-cbadge]').textContent = `y = ${fmtFix(st.linW, 2)}x + ${fmtFix(st.linB, 2)}`;
      renderKpis(kpis, [
        { lbl: 'GD Doğrusu', val: `w=${fmtFix(st.linW, 2)}, b=${fmtFix(st.linB, 2)}`, tone: 'acc' },
        { lbl: 'Kapalı Form (EKK)', val: `w=${fmtFix(st.linClosed.w, 2)}, b=${fmtFix(st.linClosed.b, 2)}`, tone: 'ok' },
        { lbl: 'R² / MSE', val: `${fmtFix(st.linClosed.r2, 3)} / ${fmtFix(lastL, 4)}` },
      ]);
    } else {
      host.querySelector('[data-ctitle]').textContent = 'Lojistik Regresyon Karar Sınırı';
      host.querySelector('[data-cbadge]').textContent = `Adım ${st.lossHist.length}`;
      renderKpis(kpis, [
        { lbl: 'Doğruluk', val: `%${fmtFix(st.acc * 100, 1)}`, tone: 'ok' },
        { lbl: 'BCE Kayıp', val: fmtFix(lastL, 4), tone: 'acc' },
      ]);
    }
    cv.render();
    drawLoss();
  }

  function stepOnce() {
    if (st.mode === 'mlp') {
      for (let i = 0; i < 4; i++) {
        const r = mlpTrainEpoch(st.net, st.data, st.lr);
        st.lossHist.push(r.loss); st.acc = r.acc;
      }
      if (st.lossHist.length > 400) st.lossHist.splice(0, st.lossHist.length - 400);
    } else if (st.mode === 'kmeans') {
      const r = kmeansStep(st.data, st.centroids);
      st.centroids = r.centroids; st.assignments = r.assignments; st.inertia = r.inertia; st.kmIter++;
      st.lossHist.push(r.inertia);
      if (r.converged) setPlaying(false);
    } else if (st.mode === 'linreg') {
      const r = linRegGradStep(st.linPts, { w: st.linW, b: st.linB }, st.lr);
      st.linW = r.w; st.linB = r.b; st.lossHist.push(r.loss);
    } else {
      const r = logRegGradStep(st.data, { w1: st.logW1, w2: st.logW2, b: st.logB }, st.lr);
      st.logW1 = r.w1; st.logW2 = r.w2; st.logB = r.b; st.acc = r.acc; st.lossHist.push(r.loss);
    }
    syncUI();
  }

  const loop = createAnimLoop(() => { stepOnce(); return st.playing; }, clean);
  function setPlaying(p) {
    st.playing = p;
    playBtn.innerHTML = p ? `${icon('pause')} Duraklat` : `${icon('play')} Eğit`;
    if (p) loop.start(); else loop.stop();
  }

  function resetModel() {
    setPlaying(false);
    st.lossHist = [];
    if (st.mode === 'mlp') {
      st.data = generate2DDataset(st.dataset, 100, st.seed);
      st.net = createMLP([2, st.hidden, st.hidden, 1], st.act, st.seed + 3);
      const r = mlpTrainEpoch(st.net, st.data, st.lr);
      st.lossHist = [r.loss]; st.acc = r.acc;
    } else if (st.mode === 'kmeans') {
      st.data = generate2DDataset('xor', 96, st.seed);
      st.centroids = kmeansInit(st.data, st.k, st.seed + 5);
      st.kmIter = 0;
      const r = kmeansStep(st.data, st.centroids);
      st.assignments = r.assignments; st.inertia = r.inertia; st.lossHist = [r.inertia];
    } else if (st.mode === 'linreg') {
      const rng = makeRng(st.seed);
      st.linPts = Array.from({ length: 24 }, (_, i) => {
        const x = -0.95 + (1.9 * i) / 23;
        return { x, y: 0.7 * x + 0.15 + (rng() - 0.5) * 0.35 };
      });
      st.linClosed = linRegClosedForm(st.linPts);
      st.linW = -0.6; st.linB = -0.5;
      st.lossHist = [linRegGradStep(st.linPts, { w: st.linW, b: st.linB }, 0).loss];
    } else {
      st.data = generate2DDataset('gaussians', 90, st.seed);
      st.logW1 = 0; st.logW2 = 0; st.logB = 0;
      const r = logRegGradStep(st.data, { w1: 0, w2: 0, b: 0 }, 0);
      st.acc = r.acc; st.lossHist = [r.loss];
    }
    syncUI();
  }

  cvEl.addEventListener('pointerdown', e => {
    const [px, py] = canvasPos(cvEl, e);
    const { W, H } = cv.size();
    const x = (px / W) * 2.4 - 1.2, y = 1.2 - (py / H) * 2.4;
    if (st.mode === 'linreg') {
      st.linPts.push({ x, y }); st.linClosed = linRegClosedForm(st.linPts); syncUI();
    } else if (st.mode === 'kmeans') {
      st.data.push({ x, y, label: 0 }); syncUI();
    }
  });

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-m]'); if (!b) return;
    st.mode = b.dataset.m;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x === b));
    resetModel();
  });
  playBtn.addEventListener('click', () => setPlaying(!st.playing));
  host.querySelector('[data-step]').addEventListener('click', () => { setPlaying(false); stepOnce(); });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.seed += 7; resetModel(); });
  observeResize(host.querySelector('[data-lbox]'), drawLoss, clean);

  bindPresets(host, presets, p => {
    st.mode = p.mode;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x.dataset.m === st.mode));
    if (p.dataset) { st.dataset = p.dataset; selData.set(st.dataset); }
    if (p.act) { st.act = p.act; selAct.set(st.act); }
    if (p.lr) { st.lr = p.lr; sLr.set(st.lr); }
    if (p.hidden) { st.hidden = p.hidden; sHid.set(st.hidden); }
    if (p.k) { st.k = p.k; sK.set(st.k); }
    resetModel();
    if (autoPlayAllowed() && st.mode === 'mlp') setPlaying(true);
  });

  bindTasks(host);
  resetModel();
  return clean.run;
}

// 1.8 KRİPTOGRAFİ & AĞ (RSA, Sezar/Vigenère, Kayan Pencere)
function mountCryptoNet(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'RSA Klasik (p=61, q=53)', tab: 'rsa', p: 61, q: 53, e: 17, msg: 65 },
    { label: 'Vigenère Şifresi', tab: 'classic', cipher: 'vigenere', key: 'MATHPAD' },
    { label: 'Go-Back-N (Kayıplı Hat)', tab: 'net', protocol: 'gbn', win: 4, loss: 0.2 },
    { label: 'Selective Repeat (Kayıplı)', tab: 'net', protocol: 'sr', win: 4, loss: 0.2 },
  ];
  const st = {
    tab: 'rsa', p: 61, q: 53, e: 17, msg: 65,
    cipher: 'caesar', plain: 'ENGINEERING MATHPAD', shift: 5, vkey: 'MATHPAD', decrypt: false,
    protocol: 'gbn', win: 4, lossProb: 0.15, sim: null, playing: false,
  };
  st.sim = createSlidingWindow({ protocol: st.protocol, windowSize: st.win, totalPackets: 10, lossProb: st.lossProb });

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**RSA** açık anahtar şifrelemesini küçük asallarla adım adım hesapla, **Sezar / Vigenère** frekans analizini incele ve **Go-Back-N vs Selective Repeat** kayan pencere protokollerinde paket kaybını canlı simüle et.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="rsa" class="on">RSA Şifreleme</button>
        <button type="button" data-t="classic">Sezar & Vigenère</button>
        <button type="button" data-t="net">Kayan Pencere (GBN / SR)</button>
      </div>
    </div>
    <div class="slp-kpis" data-kpis></div>
    <div data-body></div>
    ${theoryAndTasksHtml({
      equations: [
        'n = pq, \\quad \\varphi(n) = (p-1)(q-1), \\quad e d \\equiv 1 \\pmod{\\varphi(n)}',
        'c = m^e \\bmod n, \\qquad m = c^d \\bmod n',
      ],
      paragraphs: [
        '**RSA** güvenliği büyük $n = pq$ sayısının asal çarpanlarına ayrılmasının zorluğuna dayanır. Genişletilmiş Öklid algoritmasıyla gizli anahtar $d = e^{-1}\\bmod \\varphi(n)$ hesaplanır.',
        '**Go-Back-N** bir paket kaybolduğunda zaman aşımı sonrası penceredeki tüm paketleri yeniden gönderirken, **Selective Repeat** yalnızca kaybolan paketi tekrar gönderip alıcıda tamponlar.',
      ],
      tasks: [
        'RSA sekmesinde $p=61, q=53, e=17$ için $m=65$ mesajının $c=2790$ olarak şifrelenip geri $65$’e çözüldüğünü doğrula.',
        'Kayan Pencere modunda uçuş halindeki bir pakete tıklayarak (**Paket Düşür**) Go-Back-N ile Selective Repeat arasındaki tekrar gönderim farkını izle.',
      ],
    })}
  </div>`;

  const kpis = host.querySelector('[data-kpis]');
  const body = host.querySelector('[data-body]');
  let netCvApi = null;

  const loop = createAnimLoop((_now, dt) => {
    if (st.tab !== 'net' || !st.playing) return false;
    stepSlidingWindow(st.sim, dt * 1.1);
    updateNetDisplay();
    if (st.sim.done) { st.playing = false; const pb = body.querySelector('[data-nplay]'); if (pb) pb.innerHTML = `${icon('play')} Başlat`; return false; }
    return true;
  }, clean);

  function updateNetDisplay() {
    const s = st.sim;
    const eff = s.sentCount > 0 ? (s.ackedSet.size / s.sentCount) * 100 : 100;
    renderKpis(kpis, [
      { lbl: 'Protokol', val: s.protocol === 'gbn' ? 'Go-Back-N' : 'Selective Repeat', tone: 'acc' },
      { lbl: 'Teslim (ACK)', val: `${s.ackedSet.size} / ${s.totalPackets}`, tone: s.done ? 'ok' : 'acc' },
      { lbl: 'Gönderilen / Tekrar', val: `${s.sentCount} / ${s.retransCount}`, tone: s.retransCount > 0 ? 'warn' : 'ok' },
      { lbl: 'Verimlilik', val: `%${fmtFix(eff, 1)}`, sub: `Kayıp: ${s.lostCount}` },
    ]);
    const lg = body.querySelector('[data-nlog]');
    if (lg) lg.innerHTML = s.log.map(x => `<div>${esc(x)}</div>`).join('') || '<div>Başlat butonuna basın...</div>';
    netCvApi?.render();
  }

  function render() {
    loop.stop(); st.playing = false; netCvApi = null;
    if (st.tab === 'rsa') {
      const k = rsaKeygen(st.p, st.q, st.e);
      if (!k.ok) {
        renderKpis(kpis, [{ lbl: 'Hata', val: k.error, tone: 'bad' }]);
      } else {
        const mClamped = Math.max(0, Math.min(k.n - 1, Math.trunc(st.msg)));
        const c = rsaEncryptNum(mClamped, k.e, k.n);
        const mDec = rsaDecryptNum(c, k.d, k.n);
        renderKpis(kpis, [
          { lbl: 'Modül n = p·q', val: String(k.n), sub: `φ(n) = ${k.phi}`, tone: 'acc' },
          { lbl: 'Açık Anahtar (e, n)', val: `(${k.e}, ${k.n})` },
          { lbl: 'Gizli Anahtar (d, n)', val: `(${k.d}, ${k.n})`, tone: 'warn' },
          { lbl: 'Şifreli c → Çözülen m', val: `${c} → ${mDec}`, tone: mDec === mClamped ? 'ok' : 'bad' },
        ]);
      }
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar-g">
          <label class="row small mute">Asal p: <input type="number" class="inp slp-in-sm" data-rp value="${st.p}" aria-label="Asal sayı p"></label>
          <label class="row small mute">Asal q: <input type="number" class="inp slp-in-sm" data-rq value="${st.q}" aria-label="Asal sayı q"></label>
          <label class="row small mute">Üs e: <input type="number" class="inp slp-in-sm" data-re value="${st.e}" aria-label="Açık anahtar üssü e"></label>
          <label class="row small mute">Mesaj m (&lt; n): <input type="number" class="inp slp-in-md" data-rm value="${st.msg}" aria-label="Şifrelenecek sayısal mesaj"></label>
        </div>
        ${k.ok ? `<div class="slp-alert slp-alert-ok mono">Şifreleme: c = ${Math.min(k.n - 1, st.msg)}^${k.e} mod ${k.n} = ${rsaEncryptNum(Math.min(k.n - 1, st.msg), k.e, k.n)}<br>Çözme: m = ${rsaEncryptNum(Math.min(k.n - 1, st.msg), k.e, k.n)}^${k.d} mod ${k.n} = ${rsaDecryptNum(rsaEncryptNum(Math.min(k.n - 1, st.msg), k.e, k.n), k.d, k.n)}</div>` : `<div class="slp-alert slp-alert-bad">${esc(k.error)}</div>`}
      </div>`;
      body.querySelector('[data-rp]')?.addEventListener('change', e => { st.p = +e.target.value; render(); });
      body.querySelector('[data-rq]')?.addEventListener('change', e => { st.q = +e.target.value; render(); });
      body.querySelector('[data-re]')?.addEventListener('change', e => { st.e = +e.target.value; render(); });
      body.querySelector('[data-rm]')?.addEventListener('change', e => { st.msg = +e.target.value; render(); });
      return;
    }

    if (st.tab === 'classic') {
      const out = st.cipher === 'caesar'
        ? caesarCipher(st.plain, st.shift, st.decrypt)
        : vigenereCipher(st.plain, st.vkey, st.decrypt);
      const fr = letterFrequencies(out);
      renderKpis(kpis, [
        { lbl: 'Algoritma', val: st.cipher === 'caesar' ? `Sezar (kayma ${st.shift})` : `Vigenère (${st.vkey})`, tone: 'acc' },
        { lbl: 'İşlem', val: st.decrypt ? 'Şifre Çöz' : 'Şifrele' },
        { lbl: 'Harf Sayısı', val: String(fr.total) },
      ]);
      body.innerHTML = `<div class="slp-panel">
        <div class="slp-toolbar">
          <div class="seg" data-cc><button type="button" data-c="caesar" class="${st.cipher==='caesar'?'on':''}">Sezar</button><button type="button" data-c="vigenere" class="${st.cipher==='vigenere'?'on':''}">Vigenère</button></div>
          <label class="slp-check-row"><span>Şifre Çöz (Decrypt)</span><input type="checkbox" data-dec ${st.decrypt?'checked':''} aria-label="Şifre çözme modu"></label>
        </div>
        <div class="slp-toolbar-g">
          <label class="slp-ctrl grow"><span class="slp-ctrl-lbl">Giriş Metni (A–Z)</span><input type="text" class="inp mono" data-pt value="${esc(st.plain)}" aria-label="Giriş metni"></label>
          ${st.cipher === 'caesar'
            ? `<label class="slp-ctrl"><span class="slp-ctrl-lbl">Kayma (0–25)</span><input type="number" min="0" max="25" class="inp slp-in-sm" data-sh value="${st.shift}" aria-label="Sezar kayma miktarı"></label>`
            : `<label class="slp-ctrl"><span class="slp-ctrl-lbl">Anahtar Kelime</span><input type="text" class="inp slp-in-md" data-vk value="${esc(st.vkey)}" aria-label="Vigenère anahtarı"></label>`}
        </div>
        <div class="slp-alert slp-alert-ok mono">Çıktı: ${esc(out)}</div>
        <div class="slp-cv-box"><canvas class="slp-cv" data-fcv aria-label="Harf frekans grafiği"></canvas></div>
      </div>`;
      const fcv = setupCanvas(body.querySelector('[data-fcv]'), () => 130, (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const mx = Math.max(1, ...fr.counts), bw = (W - 20) / 26;
        for (let i = 0; i < 26; i++) {
          const h = ((H - 30) * fr.counts[i]) / mx;
          c.fillStyle = fr.counts[i] > 0 ? COL_BLUE : 'rgba(255,255,255,0.08)';
          c.fillRect(10 + i * bw + 1, H - 20 - h, Math.max(2, bw - 2), h);
          c.fillStyle = COL_MUTE; c.font = '9.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText(String.fromCharCode(65 + i), 10 + (i + 0.5) * bw, H - 6);
        }
      }, clean);
      fcv.render();
      body.querySelector('[data-cc]')?.addEventListener('click', e => { const b = e.target.closest?.('[data-c]'); if (b) { st.cipher = b.dataset.c; render(); } });
      body.querySelector('[data-dec]')?.addEventListener('change', e => { st.decrypt = e.target.checked; render(); });
      body.querySelector('[data-pt]')?.addEventListener('input', e => { st.plain = e.target.value; render(); });
      body.querySelector('[data-sh]')?.addEventListener('change', e => { st.shift = +e.target.value || 0; render(); });
      body.querySelector('[data-vk]')?.addEventListener('input', e => { st.vkey = e.target.value; render(); });
      syncSegments(body, true);
      return;
    }

    // Sliding Window Network
    body.innerHTML = `<div class="slp-panel">
      <div class="slp-toolbar">
        <div class="seg" data-nprot>
          <button type="button" data-np="gbn" class="${st.protocol==='gbn'?'on':''}">Go-Back-N</button>
          <button type="button" data-np="sr" class="${st.protocol==='sr'?'on':''}">Selective Repeat</button>
        </div>
        <div class="slp-btn-row">
          <button type="button" class="btn small primary" data-nplay>${icon('play')} Başlat</button>
          <button type="button" class="btn small danger" data-ndrop>Paket Düşür</button>
          <button type="button" class="btn small ghost" data-nrst>Sıfırla</button>
        </div>
      </div>
      <div class="slp-toolbar-g">
        <label class="row small mute">Pencere N: <input type="number" min="2" max="6" value="${st.win}" class="inp slp-in-sm" data-nwin aria-label="Pencere boyutu"></label>
        <label class="row small mute">Kayıp Olasılığı: <input type="number" min="0" max="0.5" step="0.05" value="${st.lossProb}" class="inp slp-in-sm" data-nloss aria-label="Paket kayıp olasılığı"></label>
      </div>
      <div class="slp-cv-box"><canvas class="slp-cv" data-ncv aria-label="Kayan pencere paket akış diyagramı"></canvas></div>
      <div class="slp-log" data-nlog></div>
    </div>`;

    const ncvEl = body.querySelector('[data-ncv]');
    netCvApi = setupCanvas(ncvEl, () => 230, (c, W, H) => {
      c.clearRect(0, 0, W, H);
      const s = st.sim;
      const sx = 24, bw = Math.min(34, (W - 48) / s.totalPackets - 4);
      // Sender row (top) and Receiver row (bottom)
      const sy = 26, ry = H - 52;
      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace';
      c.fillText('GÖNDERİCİ (Pencere sarı çerçeve)', sx, 16);
      c.fillText('ALICI', sx, H - 60);
      // Window box
      const wx = sx + s.base * (bw + 4) - 3;
      const ww = Math.min(s.windowSize, s.totalPackets - s.base) * (bw + 4) + 2;
      if (ww > 4) { c.strokeStyle = COL_WARN; c.lineWidth = 2; c.strokeRect(wx, sy - 3, ww, 30); }
      for (let i = 0; i < s.totalPackets; i++) {
        const x = sx + i * (bw + 4);
        c.fillStyle = s.ackedSet.has(i) ? COL_OK : i < s.nextSeq ? 'rgba(90,176,255,0.45)' : 'rgba(255,255,255,0.08)';
        c.fillRect(x, sy, bw, 24);
        c.fillStyle = s.ackedSet.has(i) ? '#000' : COL_FG; c.textAlign = 'center';
        c.fillText(String(i), x + bw / 2, sy + 16);

        const rcvd = i < s.rcvExpected || s.rcvBuf.has(i);
        c.fillStyle = i < s.rcvExpected ? COL_OK : s.rcvBuf.has(i) ? COL_PURP : 'rgba(255,255,255,0.08)';
        c.fillRect(x, ry, bw, 24);
        c.fillStyle = rcvd ? '#000' : COL_MUTE;
        c.fillText(String(i), x + bw / 2, ry + 16);
      }
      // In-flight packets
      for (const f of s.flights) {
        const x = sx + f.seq * (bw + 4) + bw / 2;
        const y = f.kind === 'DATA' ? sy + 28 + f.progress * (ry - sy - 46) : ry - 18 - f.progress * (ry - sy - 46);
        c.fillStyle = f.lost ? COL_BAD : f.kind === 'DATA' ? COL_BLUE : COL_OK;
        c.fillRect(x - 14, y - 9, 28, 18);
        c.fillStyle = '#000'; c.font = 'bold 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText(f.lost ? '✗' : (f.kind === 'DATA' ? `D${f.seq}` : `A${f.seq}`), x, y + 4);
      }
    }, clean);

    const resetNet = () => {
      loop.stop(); st.playing = false;
      st.sim = createSlidingWindow({ protocol: st.protocol, windowSize: st.win, totalPackets: 10, lossProb: st.lossProb });
      const pb = body.querySelector('[data-nplay]'); if (pb) pb.innerHTML = `${icon('play')} Başlat`;
      updateNetDisplay();
    };
    body.querySelector('[data-nprot]')?.addEventListener('click', e => { const b = e.target.closest?.('[data-np]'); if (b) { st.protocol = b.dataset.np; resetNet(); render(); } });
    body.querySelector('[data-nwin]')?.addEventListener('change', e => { st.win = Math.max(2, Math.min(6, +e.target.value || 4)); resetNet(); });
    body.querySelector('[data-nloss]')?.addEventListener('change', e => { st.lossProb = Math.max(0, Math.min(0.6, +e.target.value || 0)); resetNet(); });
    body.querySelector('[data-nplay]')?.addEventListener('click', e => {
      if (st.sim.done) resetNet();
      st.playing = !st.playing;
      e.currentTarget.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Başlat`;
      if (st.playing) loop.start(); else loop.stop();
    });
    body.querySelector('[data-ndrop]')?.addEventListener('click', () => {
      const target = st.sim.flights.find(f => f.kind === 'DATA' && !f.lost) || st.sim.flights.find(f => !f.lost);
      if (target) { dropInFlight(st.sim, target.id); updateNetDisplay(); }
    });
    body.querySelector('[data-nrst]')?.addEventListener('click', resetNet);
    syncSegments(body, true);
    updateNetDisplay();
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.p) { st.p = p.p; st.q = p.q; st.e = p.e; st.msg = p.msg; }
    if (p.cipher) { st.cipher = p.cipher; st.vkey = p.key; }
    if (p.protocol) { st.protocol = p.protocol; st.win = p.win; st.lossProb = p.loss; st.sim = createSlidingWindow({ protocol: st.protocol, windowSize: st.win, totalPackets: 10, lossProb: st.lossProb }); }
    render();
  });

  bindTasks(host);
  render();
  return clean.run;
}

// =====================================================================
// FIELD 2: ENDÜSTRİ & YÖNEYLEM (8 SIMULATIONS)
// =====================================================================

// 2.1 KUYRUK TEORİSİ (M/M/1, M/M/c, M/M/1/K)
function mountQueueTheory(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'M/M/1 Dengeli (ρ = 0.75)', model: 'mm1', lambda: 3.0, mu: 4.0, c: 1, K: 8 },
    { label: 'M/M/1 Yoğun (ρ = 0.92)', model: 'mm1', lambda: 3.68, mu: 4.0, c: 1, K: 8 },
    { label: 'M/M/3 Çoklu Gişe', model: 'mmc', lambda: 8.5, mu: 4.0, c: 3, K: 8 },
    { label: 'M/M/1/K Sınırlı Kapasite (K=5)', model: 'mm1k', lambda: 4.5, mu: 4.0, c: 1, K: 5 },
  ];
  const st = {
    model: 'mm1', lambda: 3.0, mu: 4.0, c: 2, K: 6, speed: 4, seed: 31,
    sim: null, simStats: null, playing: autoPlayAllowed(),
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**M/M/1**, **M/M/c (Erlang-C)** ve sonlu kapasiteli **M/M/1/K** kuyruk modellerinde analitik formülleri canlı ayrık-olay benzetimiyle karşılaştır ve **Little Yasasını** ($L = \\lambda_{\\text{etk}} W$) doğrula.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-qm>
        <button type="button" data-m="mm1" class="on">M/M/1</button>
        <button type="button" data-m="mmc">M/M/c</button>
        <button type="button" data-m="mm1k">M/M/1/K</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Başlat`}</button>
        <button type="button" class="btn small" data-fast>+500 Birim Hızlı İlerle</button>
        <button type="button" class="btn small ghost" data-reset>Sıfırla</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">Canlı Kuyruk ve Sunucular</h4><span class="slp-badge slp-badge-acc mono" data-qtime>t = 0</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Canlı müşteri kuyruğu ve sunucu simülasyonu"></canvas></div>
        </div>
        <div class="slp-panel">
          <h4 class="slp-title">Analitik Formül vs Benzetim & Little Yasası</h4>
          <div class="slp-table-wrap"><table class="slp-tbl" aria-label="Analitik ve benzetim karşılaştırma tablosu">
            <thead><tr><th>Metrik</th><th>Analitik</th><th>Benzetim (Canlı)</th><th>Birim / Not</th></tr></thead>
            <tbody data-cmp></tbody>
          </table></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\rho = \\frac{\\lambda}{c\\mu}, \\qquad L = \\lambda_{\\text{etk}} W, \\qquad L_q = \\lambda_{\\text{etk}} W_q \\quad (\\text{Little Yasası})',
        '\\text{M/M/1}:\\; L = \\frac{\\rho}{1-\\rho}, \\quad L_q = \\frac{\\rho^2}{1-\\rho}, \\quad W_q = \\frac{\\lambda}{\\mu(\\mu-\\lambda)}',
      ],
      paragraphs: [
        'Poisson geliş ($\\lambda$) ve üstel servis ($\\mu$) varsayımlarında kullanım oranı $\\rho \\to 1$ yaklaştıkça kuyruk uzunluğu $L_q$ doğrusal değil hiperbolik olarak patlar.',
        'Sonlu kapasiteli **M/M/1/K** sisteminde $\\rho \\ge 1$ olsa bile sistem kararlıdır; gelen müşterilerin $P_K$ olasılığı bloke edilerek kaybedilir ve etkin geliş hızı $\\lambda_{\\text{etk}} = \\lambda(1-P_K)$ olur.',
      ],
      tasks: [
        'M/M/1’de $\\lambda=3, \\mu=4$ için +500 birim hızlı ilerletip benzetim $L$ değerinin analitik $L=3.0$’a yakınsadığını gör.',
        'M/M/1’de $\\lambda=3.8$ yapıp $\\rho=0.95$ iken kuyruğun nasıl şiştiğini, ardından 2. sunucuyu (M/M/c, c=2) ekleyince $W_q$’nun dramatik düşüşünü izle.',
        'M/M/1/K modunda $\\lambda > \\mu$ durumunu seçip bloklama olasılığı $P_K$ ve Little Yasasını doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cmpBody = host.querySelector('[data-cmp]');
  const playBtn = host.querySelector('[data-play]');

  const sLam = addSlider(ctrls, { label: 'Geliş Hızı λ', unit: 'müş/sa', min: 0.5, max: 14, step: 0.1, value: st.lambda, fmt: v => `${fmtFix(v, 2)} /sa`, onInput: v => { st.lambda = v; resetSim(); } });
  const sMu = addSlider(ctrls, { label: 'Servis Hızı μ', unit: 'müş/sa', min: 1, max: 10, step: 0.1, value: st.mu, fmt: v => `${fmtFix(v, 2)} /sa`, onInput: v => { st.mu = v; resetSim(); } });
  const sC = addSlider(ctrls, { label: 'Sunucu Sayısı c', min: 1, max: 6, step: 1, value: st.c, fmt: v => String(Math.round(v)), onInput: v => { st.c = Math.round(v); resetSim(); } });
  const sK = addSlider(ctrls, { label: 'Sistem Kapasitesi K', min: 2, max: 15, step: 1, value: st.K, fmt: v => String(Math.round(v)), onInput: v => { st.K = Math.round(v); resetSim(); } });
  addSlider(ctrls, { label: 'Benzetim Hızı', min: 0.5, max: 15, step: 0.5, value: st.speed, fmt: v => `${fmtFix(v, 1)}×`, onInput: v => { st.speed = v; } });

  function analytic() {
    if (st.model === 'mmc') return solveMMc(st.lambda, st.mu, st.c);
    if (st.model === 'mm1k') return solveMM1K(st.lambda, st.mu, st.K);
    return solveMM1(st.lambda, st.mu);
  }

  const cv = setupCanvas(host.querySelector('[data-cv]'), () => 185, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const s = st.sim; if (!s) return;
    const acc = accentColor();
    const srvX = W - 92;
    const srvStep = Math.min(34, (H - 30) / Math.max(1, s.c));
    const srvTop = (H - s.c * srvStep) / 2;

    // Queue lane
    c.strokeStyle = 'rgba(255,255,255,0.14)'; c.strokeRect(18, H / 2 - 24, srvX - 44, 48);
    c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'left';
    c.fillText(`KUYRUK (${s.queue.length}${s.K < Infinity ? ` / maks ${s.K - 1}` : ''})`, 22, H / 2 - 30);

    const maxDraw = Math.min(18, s.queue.length);
    for (let i = 0; i < maxDraw; i++) {
      const cx = srvX - 42 - i * 20;
      if (cx < 26) break;
      c.beginPath(); c.arc(cx, H / 2, 7.5, 0, Math.PI * 2);
      c.fillStyle = COL_WARN; c.fill();
    }
    if (s.queue.length > maxDraw) {
      c.fillStyle = COL_WARN; c.fillText(`+${s.queue.length - maxDraw}`, 24, H / 2 + 4);
    }

    // Servers
    for (let i = 0; i < s.c; i++) {
      const y = srvTop + i * srvStep + srvStep / 2;
      const busy = !!s.serverCust[i];
      c.fillStyle = busy ? 'rgba(91,228,155,0.22)' : 'rgba(255,255,255,0.04)';
      c.strokeStyle = busy ? COL_OK : 'rgba(255,255,255,0.28)';
      c.lineWidth = 1.6;
      c.fillRect(srvX, y - 13, 72, 26); c.strokeRect(srvX, y - 13, 72, 26);
      c.fillStyle = busy ? COL_OK : COL_MUTE;
      c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(busy ? `S${i + 1} · DOLU` : `S${i + 1} · BOŞ`, srvX + 36, y + 4);
    }
    if (s.blocked > 0) {
      c.fillStyle = COL_BAD; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText(`Bloke edilen: ${s.blocked}`, 22, H - 12);
    }
    c.fillStyle = acc; c.textAlign = 'right';
    c.fillText(`Ayrılan: ${s.departed}`, W - 18, H - 12);
  }, clean);

  function syncUI() {
    sC.setVisible(st.model === 'mmc');
    sK.setVisible(st.model === 'mm1k');
    const a = analytic();
    const sm = st.simStats || { L: 0, Lq: 0, W: 0, Wq: 0, lambdaEff: 0, Pblock: 0, departed: 0 };
    host.querySelector('[data-qtime]').textContent = `t = ${fmtFix(st.sim.time, 1)} sa`;

    renderKpis(kpis, [
      { lbl: 'Kullanım Oranı ρ', val: fmtFix(a.rho, 3), sub: a.stable ? 'Kararlı' : 'KARARSIZ (ρ ≥ 1)', tone: a.stable ? (a.rho > 0.85 ? 'warn' : 'ok') : 'bad' },
      { lbl: 'Kuyruk Ort. Lq', val: fmtFix(a.Lq, 3), sub: `Benzetim: ${fmtFix(sm.Lq, 2)}`, tone: 'acc' },
      { lbl: 'Kuyruk Süresi Wq', val: `${fmtFix(a.Wq, 3)} sa`, sub: `Benzetim: ${fmtFix(sm.Wq, 2)}` },
      { lbl: st.model === 'mm1k' ? 'Bloklama P_K' : 'Boş Kalma P0', val: `%${fmtFix((st.model === 'mm1k' ? a.Pblock : a.P0) * 100, 1)}` },
    ]);
    const littleSim = sm.lambdaEff * sm.W;
    cmpBody.innerHTML = [
      ['Sistemdeki Ort. Müşteri (L)', fmtFix(a.L, 3), fmtFix(sm.L, 3), 'müşteri'],
      ['Kuyruktaki Ort. Müşteri (Lq)', fmtFix(a.Lq, 3), fmtFix(sm.Lq, 3), 'müşteri'],
      ['Sistemdeki Ort. Süre (W)', fmtFix(a.W, 3), fmtFix(sm.W, 3), 'saat'],
      ['Kuyrukta Bekleme (Wq)', fmtFix(a.Wq, 3), fmtFix(sm.Wq, 3), 'saat'],
      ['Little Yasası (λ_etk · W)', fmtFix(a.lambdaEff * a.W, 3), fmtFix(littleSim, 3), `≈ L (${fmtFix(sm.L, 3)})`],
    ].map(r => `<tr><td><b>${r[0]}</b></td><td class="mono">${r[1]}</td><td class="mono slp-td-hi">${r[2]}</td><td class="mute small">${r[3]}</td></tr>`).join('');
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    st.simStats = advanceQueueSim(st.sim, dt * st.speed);
    syncUI();
    return st.playing;
  }, clean);

  function resetSim() {
    st.sim = createQueueSim({ model: st.model, lambda: st.lambda, mu: st.mu, c: st.c, K: st.K, seed: st.seed });
    st.simStats = advanceQueueSim(st.sim, 10);
    syncUI();
  }

  host.querySelector('[data-qm]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-m]'); if (!b) return;
    st.model = b.dataset.m;
    host.querySelectorAll('[data-qm] button').forEach(x => x.classList.toggle('on', x === b));
    resetSim();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Başlat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-fast]').addEventListener('click', () => { st.simStats = advanceQueueSim(st.sim, 500); syncUI(); });
  host.querySelector('[data-reset]').addEventListener('click', () => { st.seed += 11; resetSim(); });

  bindPresets(host, presets, p => {
    st.model = p.model; st.lambda = p.lambda; st.mu = p.mu; st.c = p.c; st.K = p.K;
    sLam.set(st.lambda); sMu.set(st.mu); sC.set(st.c); sK.set(st.K);
    host.querySelectorAll('[data-qm] button').forEach(x => x.classList.toggle('on', x.dataset.m === st.model));
    resetSim();
  });

  bindTasks(host);
  resetSim();
  if (st.playing) loop.start();
  return clean.run;
}

// 2.2 DOĞRUSAL PROGRAMLAMA (2B Grafik + Simpleks Tablo Adım Adım)
function mountLinearProg(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Klasik Üretim (Z* = 36)', c1: 3, c2: 5, cons: [{ a: 1, b: 0, rhs: 4, op: '<=', name: 'Tesis 1' }, { a: 0, b: 2, rhs: 12, op: '<=', name: 'Tesis 2' }, { a: 3, b: 2, rhs: 18, op: '<=', name: 'Tesis 3' }] },
    { label: 'Karışım Problemi', c1: 4, c2: 3, cons: [{ a: 2, b: 1, rhs: 10, op: '<=', name: 'İşgücü' }, { a: 1, b: 2, rhs: 10, op: '<=', name: 'Hammadde' }, { a: 1, b: 1, rhs: 6, op: '<=', name: 'Depo' }] },
    { label: 'Kısıt Darboğazı', c1: 6, c2: 2, cons: [{ a: 1, b: 1, rhs: 8, op: '<=', name: 'Bütçe' }, { a: 2, b: 1, rhs: 10, op: '<=', name: 'Makine' }, { a: 0, b: 1, rhs: 6, op: '<=', name: 'Talep' }] },
  ];
  const st = {
    tab: 'graph', c1: 3, c2: 5,
    cons: presets[0].cons.map(x => ({ ...x })),
    isoShift: 1.0, dragIdx: -1, sxStep: 0,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('2 değişkenli Doğrusal Programlama problemini **uygun bölge (feasible region)**, **eş-kâr doğrusu** ve **gölge fiyatlarla (shadow prices)** grafiksel çöz — kısıt doğrularını tuvalde sürükle ya da **Simpleks Tablosunu** pivot adım adım izle.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="graph" class="on">Grafik Çözücü (Sürükle)</button>
        <button type="button" data-t="simplex">Simpleks Tablosu</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card" data-gcard>
          <div class="slp-head"><h4 class="slp-title">Uygun Bölge & Eş-Kâr Doğrusu</h4><span class="slp-badge slp-badge-acc mono" data-gbadge>—</span></div>
          <div class="slp-cv-box">
            <canvas class="slp-cv slp-cv-drag" data-cv aria-label="2B doğrusal programlama uygun bölge tuvali"></canvas>
            <div class="slp-cv-tag">Kısıt tutamaçlarını sürükleyerek sağ tarafı (RHS) değiştir</div>
          </div>
        </div>
        <div class="slp-panel" data-scard hidden>
          <div class="slp-toolbar">
            <h4 class="slp-title" data-sxtitle>Simpleks Tablosu</h4>
            <div class="slp-btn-row">
              <button type="button" class="btn small" data-sxprev>← Önceki</button>
              <button type="button" class="btn small primary" data-sxnext>Pivot Adımı →</button>
            </div>
          </div>
          <div class="slp-table-wrap" data-sxtbl></div>
        </div>
        <div class="slp-panel">
          <h4 class="slp-title">Duyarlılık Analizi — Gölge Fiyatlar (Dual Değerler)</h4>
          <div class="slp-table-wrap"><table class="slp-tbl" aria-label="Kısıt bolluk ve gölge fiyat tablosu">
            <thead><tr><th>Kısıt</th><th>Denklem</th><th>Bolluk (Slack)</th><th>Durum</th><th>Gölge Fiyat (∂Z*/∂b)</th></tr></thead>
            <tbody data-dual></tbody>
          </table></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\max Z = c^T x \\quad \\text{k.a.}\\quad Ax \\le b,\\; x \\ge 0',
        'y_i^* = \\frac{\\partial Z^*}{\\partial b_i} \\quad (\\text{Bağlayıcı olmayan kısıtta } s_i > 0 \\implies y_i^* = 0)',
      ],
      paragraphs: [
        'Doğrusal programlamanın temel teoremine göre sınırlı ve boş olmayan dışbükey uygun bölgenin optimal noktası her zaman bir **köşe noktasında (extreme point)** yer alır.',
        '**Simpleks yöntemi** komşu köşeler arasında amaç fonksiyonunu artırarak yürür. Bir kısıtın **gölge fiyatı** ($y_i^*$), o kaynağa 1 birim eklendiğinde optimal kâr $Z^*$ değerinin kaç birim artacağını gösterir.',
      ],
      tasks: [
        'Klasik Üretim senaryosunda Tesis 3 kısıtını sürükleyip $b_3$’ü 1 birim artırınca $Z^*$’ın tam $+1.0$ (gölge fiyatı kadar) arttığını doğrula.',
        'Simpleks sekmesinde pivot sütununu (en negatif $z$-satırı) ve minimum oran testini adım adım takip et.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cvEl = host.querySelector('[data-cv]');
  const sC1 = addSlider(ctrls, { label: 'Amaç Katsayısı c₁ (x₁)', min: 0.5, max: 10, step: 0.5, value: st.c1, fmt: v => fmtFix(v, 1), onInput: v => { st.c1 = v; syncUI(); } });
  const sC2 = addSlider(ctrls, { label: 'Amaç Katsayısı c₂ (x₂)', min: 0.5, max: 10, step: 0.5, value: st.c2, fmt: v => fmtFix(v, 1), onInput: v => { st.c2 = v; syncUI(); } });
  const sR0 = addSlider(ctrls, { label: 'Kısıt 1 Sağ Taraf b₁', min: 1, max: 16, step: 0.5, value: st.cons[0].rhs, fmt: v => fmtFix(v, 1), onInput: v => { st.cons[0].rhs = v; syncUI(); } });
  const sR1 = addSlider(ctrls, { label: 'Kısıt 2 Sağ Taraf b₂', min: 2, max: 20, step: 0.5, value: st.cons[1].rhs, fmt: v => fmtFix(v, 1), onInput: v => { st.cons[1].rhs = v; syncUI(); } });
  const sR2 = addSlider(ctrls, { label: 'Kısıt 3 Sağ Taraf b₃', min: 4, max: 30, step: 0.5, value: st.cons[2].rhs, fmt: v => fmtFix(v, 1), onInput: v => { st.cons[2].rhs = v; syncUI(); } });
  addSlider(ctrls, { label: 'Eş-Kâr Çizgisi Oranı', min: 0.2, max: 1.2, step: 0.05, value: 1.0, fmt: v => `%${Math.round(v * 100)} Z*`, onInput: v => { st.isoShift = v; cv.render(); } });

  const MAX_XY = 12;
  const toPx = (W, H, x, y) => [44 + (x / MAX_XY) * (W - 64), H - 34 - (y / MAX_XY) * (H - 54)];
  const fromPx = (W, H, px, py) => [((px - 44) / (W - 64)) * MAX_XY, ((H - 34 - py) / (H - 54)) * MAX_XY];

  let lpRes = null, handles = [];
  const cv = setupCanvas(cvEl, w => Math.min(340, Math.max(250, w * 0.62)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    // Grid
    c.strokeStyle = COL_GRID; c.lineWidth = 1;
    c.font = '10.5px "JetBrains Mono", monospace'; c.fillStyle = COL_MUTE;
    for (let v = 0; v <= MAX_XY; v += 2) {
      const [gx, gy] = toPx(W, H, v, v);
      c.beginPath(); c.moveTo(gx, 20); c.lineTo(gx, H - 34); c.stroke();
      c.beginPath(); c.moveTo(44, gy); c.lineTo(W - 20, gy); c.stroke();
      c.textAlign = 'center'; c.fillText(String(v), gx, H - 18);
      c.textAlign = 'right'; c.fillText(String(v), 36, gy + 4);
    }
    c.strokeStyle = COL_AXIS; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(44, H - 34); c.lineTo(W - 20, H - 34); c.moveTo(44, H - 34); c.lineTo(44, 20); c.stroke();

    // Feasible region
    if (lpRes?.feasiblePoly?.length >= 3) {
      c.fillStyle = 'rgba(91,228,155,0.16)';
      c.strokeStyle = COL_OK; c.lineWidth = 2;
      c.beginPath();
      lpRes.feasiblePoly.forEach((p, i) => {
        const [px, py] = toPx(W, H, p.x, p.y);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.closePath(); c.fill(); c.stroke();
    }

    // Constraint lines & draggable mid-handles
    handles = [];
    st.cons.forEach((con, i) => {
      const col = PALETTE[i % PALETTE.length];
      let pA, pB;
      if (Math.abs(con.b) < 1e-6) {
        const x = con.rhs / con.a;
        pA = [x, 0]; pB = [x, MAX_XY];
      } else if (Math.abs(con.a) < 1e-6) {
        const y = con.rhs / con.b;
        pA = [0, y]; pB = [MAX_XY, y];
      } else {
        pA = [0, con.rhs / con.b]; pB = [con.rhs / con.a, 0];
      }
      const [x1, y1] = toPx(W, H, pA[0], pA[1]), [x2, y2] = toPx(W, H, pB[0], pB[1]);
      c.save(); c.beginPath(); c.rect(44, 20, W - 64, H - 54); c.clip();
      c.strokeStyle = col; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.restore();

      const hx = Math.max(0, Math.min(MAX_XY, 0.5 * (pA[0] + pB[0])));
      const hy = Math.max(0, Math.min(MAX_XY, 0.5 * (pA[1] + pB[1])));
      const [hpx, hpy] = toPx(W, H, hx, hy);
      handles.push({ idx: i, px: hpx, py: hpy });
      c.beginPath(); c.arc(hpx, hpy, 7, 0, Math.PI * 2);
      c.fillStyle = col; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke();
    });

    // Iso-profit line
    if (lpRes?.status === 'optimal') {
      const zLine = lpRes.optimalValue * st.isoShift;
      const [ix1, iy1] = toPx(W, H, 0, zLine / st.c2);
      const [ix2, iy2] = toPx(W, H, zLine / st.c1, 0);
      c.save(); c.beginPath(); c.rect(44, 20, W - 64, H - 54); c.clip();
      c.strokeStyle = acc; c.setLineDash([6, 4]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(ix1, iy1); c.lineTo(ix2, iy2); c.stroke();
      c.restore();
    }

    // Vertices & optimal star
    for (const v of lpRes?.vertices || []) {
      const [px, py] = toPx(W, H, v.x, v.y);
      const isOpt = lpRes.optimalPoint && Math.hypot(v.x - lpRes.optimalPoint.x, v.y - lpRes.optimalPoint.y) < 1e-5;
      c.beginPath(); c.arc(px, py, isOpt ? 7 : 4.5, 0, Math.PI * 2);
      c.fillStyle = isOpt ? COL_WARN : COL_FG; c.fill();
      if (isOpt) {
        c.strokeStyle = '#000'; c.lineWidth = 1.8; c.stroke();
        c.fillStyle = COL_WARN; c.font = 'bold 11.5px "JetBrains Mono", monospace'; c.textAlign = 'left';
        c.fillText(`★ (${fmtFix(v.x, 1)}, ${fmtFix(v.y, 1)}) Z=${fmtFix(v.z, 1)}`, px + 10, py - 6);
      }
    }
  }, clean);

  cvEl.addEventListener('pointerdown', e => {
    const [px, py] = canvasPos(cvEl, e);
    const hit = handles.find(h => Math.hypot(h.px - px, h.py - py) <= 16);
    if (hit) { st.dragIdx = hit.idx; cvEl.setPointerCapture?.(e.pointerId); }
  });
  cvEl.addEventListener('pointermove', e => {
    if (st.dragIdx < 0) return;
    const [px, py] = canvasPos(cvEl, e);
    const { W, H } = cv.size();
    const [x, y] = fromPx(W, H, px, py);
    const con = st.cons[st.dragIdx];
    const newRhs = Math.max(1, Math.min(30, +(con.a * Math.max(0, x) + con.b * Math.max(0, y)).toFixed(1)));
    con.rhs = newRhs;
    [sR0, sR1, sR2][st.dragIdx].set(newRhs);
    syncUI();
  });
  const endDrag = () => { st.dragIdx = -1; };
  cvEl.addEventListener('pointerup', endDrag);
  cvEl.addEventListener('pointercancel', endDrag);

  function syncUI() {
    lpRes = solveLP2D({ sense: 'max', c1: st.c1, c2: st.c2, constraints: st.cons });
    const sx = simplexSolve({ c: [st.c1, st.c2], A: st.cons.map(k => [k.a, k.b]), b: st.cons.map(k => k.rhs) });
    st.sxStep = Math.min(st.sxStep, sx.steps.length - 1);

    host.querySelector('[data-gcard]').hidden = st.tab !== 'graph';
    host.querySelector('[data-scard]').hidden = st.tab !== 'simplex';

    renderKpis(kpis, [
      { lbl: 'Optimal Z*', val: lpRes.status === 'optimal' ? fmtFix(lpRes.optimalValue, 2) : lpRes.status, tone: 'acc' },
      { lbl: 'Optimal Nokta (x₁, x₂)', val: lpRes.optimalPoint ? `(${fmtFix(lpRes.optimalPoint.x, 2)}, ${fmtFix(lpRes.optimalPoint.y, 2)})` : '—', tone: 'ok' },
      { lbl: 'Simpleks Adımı', val: `${st.sxStep + 1} / ${sx.steps.length}` },
    ]);
    host.querySelector('[data-gbadge]').textContent = `max ${st.c1}x₁ + ${st.c2}x₂`;

    host.querySelector('[data-dual]').innerHTML = (lpRes.shadowPrices || []).map((sp, i) => {
      const c = st.cons[i];
      return `<tr>
        <td><b>${esc(sp.name)}</b></td>
        <td class="mono">${c.a}x₁ + ${c.b}x₂ ≤ ${fmtFix(c.rhs, 1)}</td>
        <td class="mono">${fmtFix(sp.slack, 2)}</td>
        <td class="${sp.binding ? 'slp-td-warn' : ''}">${sp.binding ? 'Bağlayıcı (Darboğaz)' : 'Bolluk var'}</td>
        <td class="mono slp-td-hi">${fmtFix(sp.shadowPrice, 3)}</td>
      </tr>`;
    }).join('');

    // Simplex table
    const step = sx.steps[st.sxStep];
    if (step) {
      host.querySelector('[data-sxtitle]').textContent = `Simpleks Tablosu · Adım ${st.sxStep + 1}/${sx.steps.length} (${step.status === 'optimal' ? 'OPTİMAL' : `Pivot: ${step.varNames[step.pivotCol]} girer`})`;
      const T = step.tableau;
      host.querySelector('[data-sxtbl]').innerHTML = `<table class="slp-tbl" aria-label="Simpleks tablosu">
        <thead><tr><th>Temel</th>${step.varNames.map((v, j) => `<th class="mono ${j === step.pivotCol ? 'slp-td-warn' : ''}">${esc(v)}</th>`).join('')}<th>RHS</th><th>Oran</th></tr></thead>
        <tbody>${T.map((row, r) => `<tr>
          <td class="mono"><b>${r < step.basis.length ? esc(step.varNames[step.basis[r]]) : 'Z'}</b></td>
          ${row.map((val, j) => {
            const isPiv = r === step.pivotRow && j === step.pivotCol;
            return `<td class="mono ${isPiv ? 'slp-td-ok' : (r === step.pivotRow || j === step.pivotCol) ? 'slp-td-hi' : ''}">${fmtFix(val, 2)}</td>`;
          }).join('')}
          <td class="mono">${r < step.basis.length && step.ratios ? (step.ratios[r] === null ? '—' : fmtFix(step.ratios[r], 2)) : ''}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
    cv.render();
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  host.querySelector('[data-sxprev]').addEventListener('click', () => { st.sxStep = Math.max(0, st.sxStep - 1); syncUI(); });
  host.querySelector('[data-sxnext]').addEventListener('click', () => { st.sxStep++; syncUI(); });
  bindPresets(host, presets, p => {
    st.c1 = p.c1; st.c2 = p.c2; st.cons = p.cons.map(x => ({ ...x })); st.sxStep = 0;
    sC1.set(st.c1); sC2.set(st.c2); sR0.set(st.cons[0].rhs); sR1.set(st.cons[1].rhs); sR2.set(st.cons[2].rhs);
    syncUI();
  });

  bindTasks(host);
  syncUI();
  return clean.run;
}

// 2.3 ENVANTER & EOQ (Toplam Maliyet + Emniyet Stoklu Testere Dişi Benzetimi)
function mountInventoryEOQ(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Standart Depo (%95 Hizmet)', D: 12000, S: 150, H: 4, L: 5, std: 8, sl: 0.95 },
    { label: 'Yüksek Talep Belirsizliği', D: 14600, S: 120, H: 5, L: 7, std: 18, sl: 0.98 },
    { label: 'Düşük Emniyet Stoku (Stoksuz)', D: 12000, S: 150, H: 4, L: 6, std: 15, sl: 0.55 },
  ];
  const st = { D: 12000, S: 150, H: 4, Qmult: 1.0, L: 5, std: 8, sl: 0.95, seed: 17 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Ekonomik Sipariş Miktarı (EOQ)** toplam maliyet eğrisini incele, ardından teslim süresi $L$ ve rastgele günlük talep altında **Yeniden Sipariş Noktası (ROP)** ile **emniyet stokunun** stoksuz kalmayı nasıl önlediğini testere dişi grafiğinde gör.', presets)}
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls>
        <button type="button" class="btn small ghost" data-reroll>${icon('rotate')} Yeni Talep Gerçekleşmesi</button>
      </div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">EOQ Toplam Maliyet Eğrisi TC(Q)</h4><div class="slp-legend"><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[0]}"></i>Toplam</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[1]}"></i>Elde Tutma</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[2]}"></i>Sipariş</span></div></div>
          <div class="slp-cv-box" data-box1><canvas class="slp-cv" data-cv1 aria-label="EOQ maliyet eğrileri"></canvas><div class="slp-readout mono" data-rd1></div></div>
        </div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">Rastgele Talep Altında Testere Dişi Stok Seyri (120 Gün)</h4><div class="slp-legend"><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[3]}"></i>Eldeki Stok</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[4]}"></i>ROP</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[2]}"></i>Emniyet Stoku</span></div></div>
          <div class="slp-cv-box" data-box2><canvas class="slp-cv" data-cv2 aria-label="Testere dişi envanter seviyesi grafiği"></canvas><div class="slp-readout mono" data-rd2></div></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'Q^* = \\sqrt{\\frac{2DS}{H}}, \\qquad TC(Q) = \\frac{D}{Q}S + \\frac{Q}{2}H',
        '\\text{ROP} = \\mu_d L + z_\\alpha \\sigma_d \\sqrt{L}, \\qquad SS = z_\\alpha \\sigma_d \\sqrt{L}',
      ],
      paragraphs: [
        'Optimal $Q^*$ noktasında yıllık sipariş verme maliyeti $(D/Q)S$ ile elde tutma maliyeti $(Q/2)H$ birbirine eşittir; $Q^*$ civarında toplam maliyet eğrisi oldukça düz olduğu için küçük sapmalara dayanıklıdır.',
        'Rastgele talep ortamında teslim süresi $L$ boyunca oluşabilecek talep sıçramalarını karşılamak için **emniyet stoku (SS)** tutulur. Hizmet düzeyi %95’ten %99’a çıktığında $z_\\alpha$ katsayısı hızla büyür.',
      ],
      tasks: [
        'Sipariş çarpanı sürgüsünü $1.0\\times Q^*$ konumuna getirip elde tutma ve sipariş maliyetlerinin eşitlendiğini doğrula.',
        'Hizmet düzeyini %55’e düşürüp testere dişi grafiğinde stoksuz kalınan günleri gözle, sonra %98’e çıkararak karşılama oranını (fill rate) karşılaştır.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cv1 = host.querySelector('[data-cv1]'), cv2 = host.querySelector('[data-cv2]');

  const sD = addSlider(ctrls, { label: 'Yıllık Talep D', unit: 'adet/yıl', min: 2000, max: 30000, step: 500, value: st.D, fmt: v => String(Math.round(v)), onInput: v => { st.D = v; update(); } });
  const sS = addSlider(ctrls, { label: 'Sipariş Maliyeti S', unit: '₺', min: 20, max: 500, step: 10, value: st.S, fmt: v => `${Math.round(v)} ₺`, onInput: v => { st.S = v; update(); } });
  const sH = addSlider(ctrls, { label: 'Elde Tutma H', unit: '₺/adet·yıl', min: 1, max: 20, step: 0.5, value: st.H, fmt: v => `${fmtFix(v, 1)} ₺`, onInput: v => { st.H = v; update(); } });
  const sQm = addSlider(ctrls, { label: 'Seçili Sipariş Miktarı Q', min: 0.4, max: 2.2, step: 0.05, value: st.Qmult, fmt: v => `${fmtFix(v, 2)}×Q*`, onInput: v => { st.Qmult = v; update(); } });
  const sL = addSlider(ctrls, { label: 'Teslim Süresi L', unit: 'gün', min: 1, max: 14, step: 1, value: st.L, fmt: v => `${Math.round(v)} gün`, onInput: v => { st.L = Math.round(v); update(); } });
  const sStd = addSlider(ctrls, { label: 'Günlük Talep Std σ_d', min: 0, max: 25, step: 1, value: st.std, fmt: v => fmtFix(v, 0), onInput: v => { st.std = v; update(); } });
  const sSL = addSlider(ctrls, { label: 'Hizmet Düzeyi (CSL)', min: 0.50, max: 0.99, step: 0.01, value: st.sl, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.sl = v; update(); } });

  let last = null;
  function drawPlots() {
    if (!last) return;
    const { eoq, rop, sim } = last;
    const qMin = Math.max(20, eoq.Qopt * 0.25), qMax = eoq.Qopt * 2.5;
    const qs = [], tc = [], hc = [], oc = [];
    for (let i = 0; i <= 120; i++) {
      const q = qMin + ((qMax - qMin) * i) / 120;
      qs.push(q);
      const h = (q / 2) * st.H, o = (st.D / q) * st.S;
      hc.push(h); oc.push(o); tc.push(h + o);
    }
    safePlot(cv1, [
      { name: 'TC(Q)', color: PLOT_COLORS[0], xs: qs, ys: tc },
      { name: 'Elde Tutma', color: PLOT_COLORS[1], xs: qs, ys: hc },
      { name: 'Sipariş', color: PLOT_COLORS[2], xs: qs, ys: oc },
    ], { x0: qMin, x1: qMax, ylabel: '₺/yıl', height: 190 });

    const days = sim.series.map(x => x.day);
    safePlot(cv2, [
      { name: 'Stok', color: PLOT_COLORS[3], xs: days, ys: sim.series.map(x => x.onHand) },
      { name: 'ROP', color: PLOT_COLORS[4], xs: [0, 120], ys: [rop.rop, rop.rop] },
      { name: 'SS', color: PLOT_COLORS[2], xs: [0, 120], ys: [rop.safetyStock, rop.safetyStock] },
    ], { x0: 0, x1: 120, ylabel: 'adet', height: 195 });
  }

  function update() {
    const baseEoq = solveEOQ({ D: st.D, S: st.S, H: st.H });
    const Q = baseEoq.Qopt * st.Qmult;
    const eoq = solveEOQ({ D: st.D, S: st.S, H: st.H, Q });
    const dailyMean = st.D / 365;
    const rop = solveROP({ dailyMean, dailyStd: st.std, leadTime: st.L, serviceLevel: st.sl });
    const sim = simulateInventory({ days: 120, dailyMean, dailyStd: st.std, leadTime: st.L, Q, rop: rop.rop, seed: st.seed });
    last = { eoq, rop, sim, Q };

    renderKpis(kpis, [
      { lbl: 'Optimal EOQ (Q*)', val: `${Math.round(eoq.Qopt)} adet`, sub: `TC* = ${Math.round(eoq.tcOpt)} ₺/yıl`, tone: 'acc' },
      { lbl: 'Seçili Q Maliyeti', val: `${Math.round(eoq.tcCur)} ₺/yıl`, sub: `Sapma: +${fmtFix(((eoq.tcCur / eoq.tcOpt) - 1) * 100, 1)}%` },
      { lbl: 'ROP / Emniyet Stoku', val: `${Math.round(rop.rop)} / ${Math.round(rop.safetyStock)}`, sub: `z = ${fmtFix(rop.z, 2)}` },
      { lbl: 'Karşılama (Fill Rate)', val: `%${fmtFix(sim.fillRate * 100, 1)}`, sub: `Stoksuz gün: ${sim.stockoutDays}`, tone: sim.stockoutDays === 0 ? 'ok' : 'warn' },
    ]);
    drawPlots();
  }

  host.querySelector('[data-reroll]').addEventListener('click', () => { st.seed += 13; update(); });
  attachReadout(cv1, host.querySelector('[data-rd1]'), (x, s, i) => `Q=${Math.round(x)} · TC=${Math.round(s[0].ys[i])} ₺`, clean);
  attachReadout(cv2, host.querySelector('[data-rd2]'), (x, s, i) => `Gün ${Math.round(x)} · Stok=${Math.round(s[0].ys[i])} adet`, clean);
  observeResize(host.querySelector('[data-box1]'), drawPlots, clean);
  bindPresets(host, presets, p => {
    st.D = p.D; st.S = p.S; st.H = p.H; st.L = p.L; st.std = p.std; st.sl = p.sl; st.Qmult = 1.0;
    sD.set(st.D); sS.set(st.S); sH.set(st.H); sL.set(st.L); sStd.set(st.std); sSL.set(st.sl); sQm.set(1.0);
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 2.4 PROJE YÖNETİMİ (CPM / PERT Ağı, Kritik Yol, Gantt & Olasılık)
function mountCPMPERT(host, ctx) {
  const clean = createClean(ctx);
  const PROJ_PRESETS = [
    {
      label: 'Yazılım Lansmanı',
      deadline: 18,
      acts: [
        { id: 'A', name: 'Analiz', preds: [], a: 2, m: 4, b: 6 },
        { id: 'B', name: 'Arayüz', preds: ['A'], a: 2, m: 3, b: 5 },
        { id: 'C', name: 'Çekirdek', preds: ['A'], a: 4, m: 6, b: 10 },
        { id: 'D', name: 'Veritabanı', preds: ['A'], a: 2, m: 4, b: 6 },
        { id: 'E', name: 'Entegrasyon', preds: ['B', 'C', 'D'], a: 3, m: 4, b: 7 },
        { id: 'F', name: 'Test & Yayın', preds: ['E'], a: 1, m: 2, b: 5 },
      ],
    },
    {
      label: 'Fabrika Kurulumu',
      deadline: 25,
      acts: [
        { id: 'A', name: 'Saha', preds: [], a: 3, m: 5, b: 7 },
        { id: 'B', name: 'Makine Sip.', preds: [], a: 6, m: 8, b: 14 },
        { id: 'C', name: 'Temel', preds: ['A'], a: 4, m: 6, b: 8 },
        { id: 'D', name: 'Montaj', preds: ['B', 'C'], a: 5, m: 7, b: 11 },
        { id: 'E', name: 'Elektrik', preds: ['C'], a: 3, m: 4, b: 6 },
        { id: 'F', name: 'Devreye Alma', preds: ['D', 'E'], a: 2, m: 3, b: 5 },
      ],
    },
  ];
  const st = { acts: PROJ_PRESETS[0].acts.map(x => ({ ...x, preds: x.preds.slice() })), deadline: 18 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('PERT/CPM faaliyet tablosundan **kritik yolu**, bolluk sürelerini (**slack**), **AON ağ diyagramını** ve **Gantt şemasını** canlı hesapla; hedef teslim tarihine kadar bitirme olasılığını $P(T \\le T_{\\text{hedef}})$ incele.', PROJ_PRESETS)}
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls>
        <div class="slp-head"><h4 class="slp-title">Faaliyet Tablosu (a / m / b gün)</h4></div>
        <div class="slp-table-wrap"><table class="slp-tbl" aria-label="PERT faaliyet giriş tablosu">
          <thead><tr><th>ID</th><th>Öncül</th><th>a</th><th>m</th><th>b</th></tr></thead>
          <tbody data-atbl></tbody>
        </table></div>
      </div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">Gantt Şeması & Bolluklar (Kırmızı = Kritik Yol)</h4></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-gantt aria-label="CPM Gantt şeması"></canvas></div>
        </div>
        <div class="slp-panel">
          <h4 class="slp-title">CPM / PERT Hesaplama Tablosu</h4>
          <div class="slp-table-wrap"><table class="slp-tbl" aria-label="CPM hesaplama sonuçları">
            <thead><tr><th>Faaliyet</th><th>t_e</th><th>σ²</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Bolluk</th><th>Kritik</th></tr></thead>
            <tbody data-res></tbody>
          </table></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        't_e = \\frac{a + 4m + b}{6}, \\qquad \\sigma^2 = \\left(\\frac{b - a}{6}\\right)^2',
        'Z = \\frac{T_{\\text{hedef}} - T_E}{\\sqrt{\\sum_{i \\in \\text{CP}} \\sigma_i^2}}, \\qquad P(T \\le T_{\\text{hedef}}) = \\Phi(Z)',
      ],
      paragraphs: [
        '**Kritik Yol (Critical Path)** toplam bolluğu ($\\text{LS} - \\text{ES} = 0$) sıfır olan faaliyetler zinciridir; bu yoldaki herhangi bir gecikme tüm projenin bitişini doğrudan erteler.',
        'Merkezi Limit Teoremi uyarınca kritik yol boyunca beklenen sürelerin toplamı $T_E$ ve varyansların toplamı $\\sigma_{\\text{CP}}^2$ ile proje tamamlama süresi yaklaşık normal dağılır.',
      ],
      tasks: [
        'Hedef teslim tarihini beklenen süre $T_E$’ye eşitleyince bitirme olasılığının tam %50 olduğunu doğrula.',
        'Kritik olmayan bir faaliyetin (ör. Arayüz) $b$ süresini artırarak yeni bir kritik yol oluşumunu gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const atbl = host.querySelector('[data-atbl]');
  const resTbl = host.querySelector('[data-res]');
  const sDead = addSlider(ctrls, { label: 'Hedef Teslim Süresi', unit: 'gün', min: 10, max: 35, step: 0.5, value: st.deadline, fmt: v => `${fmtFix(v, 1)} gün`, onInput: v => { st.deadline = v; syncUI(); } });

  let sol = null;
  const ganttCv = setupCanvas(host.querySelector('[data-gantt]'), () => 220, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!sol?.ok) return;
    const nodes = sol.nodes, dur = Math.max(1, sol.projectDuration, st.deadline);
    const padL = 82, padR = 18, padT = 18, padB = 26;
    const rowH = Math.min(28, (H - padT - padB) / Math.max(1, nodes.length));
    const sx = t => padL + (t / dur) * (W - padL - padR);

    // Deadline dashed vertical line
    const dx = sx(st.deadline);
    c.save(); c.strokeStyle = COL_WARN; c.setLineDash([5, 4]); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(dx, padT); c.lineTo(dx, H - padB); c.stroke(); c.restore();

    nodes.forEach((n, i) => {
      const y = padT + i * rowH;
      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'right';
      c.fillText(`${n.id}·${n.name.slice(0, 7)}`, padL - 8, y + rowH * 0.62);
      // Slack ghost bar
      if (n.totalSlack > 0.05) {
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(sx(n.ef), y + 4, sx(n.lf) - sx(n.ef), rowH - 8);
      }
      // Activity bar
      const x1 = sx(n.es), x2 = sx(n.ef);
      c.fillStyle = n.critical ? COL_BAD : COL_BLUE;
      c.fillRect(x1, y + 3, Math.max(4, x2 - x1), rowH - 6);
    });
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
    for (let k = 0; k <= 5; k++) {
      const tv = (dur * k) / 5;
      c.fillText(`${fmtFix(tv, 1)}g`, sx(tv), H - 8);
    }
  }, clean);

  function renderInputs() {
    atbl.innerHTML = st.acts.map((a, i) => `<tr data-ai="${i}">
      <td class="mono"><b>${esc(a.id)}</b></td>
      <td class="mono small mute">${esc(a.preds.join(',') || '—')}</td>
      <td><input type="number" min="0.5" max="30" step="0.5" value="${a.a}" class="inp slp-in-sm" style="width:52px" data-f="a" aria-label="${esc(a.id)} iyimser"></td>
      <td><input type="number" min="0.5" max="30" step="0.5" value="${a.m}" class="inp slp-in-sm" style="width:52px" data-f="m" aria-label="${esc(a.id)} olası"></td>
      <td><input type="number" min="0.5" max="40" step="0.5" value="${a.b}" class="inp slp-in-sm" style="width:52px" data-f="b" aria-label="${esc(a.id)} kötümser"></td>
    </tr>`).join('');
  }

  function syncUI() {
    sol = solveCPMPERT(st.acts, st.deadline);
    if (!sol.ok) {
      renderKpis(kpis, [{ lbl: 'Hata', val: sol.error, tone: 'bad' }]);
      return;
    }
    renderKpis(kpis, [
      { lbl: 'Kritik Yol (CP)', val: sol.criticalPath.join(' → '), tone: 'bad' },
      { lbl: 'Beklenen Süre T_E', val: `${fmtFix(sol.projectDuration, 2)} gün`, sub: `σ = ${fmtFix(sol.projectStd, 2)} gün`, tone: 'acc' },
      { lbl: `P(T ≤ ${fmtFix(st.deadline, 1)}g)`, val: `%${fmtFix(sol.completionProb * 100, 1)}`, sub: `Z = ${fmtFix(sol.zScore, 2)}`, tone: sol.completionProb >= 0.8 ? 'ok' : 'warn' },
    ]);
    resTbl.innerHTML = sol.nodes.map(n => `<tr class="${n.critical ? 'slp-td-bad' : ''}">
      <td><b>${esc(n.id)}</b> · ${esc(n.name)}</td>
      <td class="mono">${fmtFix(n.te, 2)}</td><td class="mono">${fmtFix(n.variance, 2)}</td>
      <td class="mono">${fmtFix(n.es, 1)}</td><td class="mono">${fmtFix(n.ef, 1)}</td>
      <td class="mono">${fmtFix(n.ls, 1)}</td><td class="mono">${fmtFix(n.lf, 1)}</td>
      <td class="mono">${fmtFix(n.totalSlack, 2)}</td>
      <td>${n.critical ? '★ EVET' : '—'}</td>
    </tr>`).join('');
    ganttCv.render();
  }

  atbl.addEventListener('change', e => {
    const tr = e.target.closest?.('tr[data-ai]'); if (!tr) return;
    const i = +tr.dataset.ai, f = e.target.dataset.f;
    st.acts[i][f] = Math.max(0.5, +e.target.value || 1);
    if (st.acts[i].m < st.acts[i].a) st.acts[i].m = st.acts[i].a;
    if (st.acts[i].b < st.acts[i].m) st.acts[i].b = st.acts[i].m;
    syncUI();
  });

  bindPresets(host, PROJ_PRESETS, p => {
    st.acts = p.acts.map(x => ({ ...x, preds: x.preds.slice() }));
    st.deadline = p.deadline; sDead.set(st.deadline);
    renderInputs(); syncUI();
  });

  bindTasks(host);
  renderInputs();
  syncUI();
  return clean.run;
}

// 2.5 İSTATİSTİKSEL KALİTE KONTROL (SPC — X-bar & R, Cp/Cpk)
function mountSPC(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Kontrol Altında (Cpk > 1.33)', mu: 50, sigma: 0.9, shiftAt: 99, shiftSig: 0, drift: 0, usl: 54, lsl: 46 },
    { label: 'Ani Ortalama Kayması (+2.5σ)', mu: 50, sigma: 1.0, shiftAt: 14, shiftSig: 2.5, drift: 0, usl: 54, lsl: 46 },
    { label: 'Takım Aşınması (Eğilim)', mu: 50, sigma: 0.8, shiftAt: 99, shiftSig: 0, drift: 0.14, usl: 54, lsl: 46 },
    { label: 'Merkezden Kaymış Süreç', mu: 51.8, sigma: 1.0, shiftAt: 99, shiftSig: 0, drift: 0, usl: 54, lsl: 46 },
  ];
  const st = { mu: 50, sigma: 0.9, n: 5, k: 25, shiftAt: 99, shiftSig: 0, drift: 0, usl: 54, lsl: 46, seed: 23 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Üretim sürecinden alınan alt gruplarla **X̄ ve R Kontrol Diyagramlarını** kur; **Cp / Cpk** süreç yeterliliğini, tahmini hata oranını (**PPM**) ve Western Electric kontrol dışı kurallarını canlı izle.', presets)}
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls>
        <button type="button" class="btn small ghost" data-reroll>${icon('rotate')} Yeni Örneklem Çek</button>
      </div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">X̄ (Ortalama) Kontrol Diyagramı</h4><span class="slp-badge slp-badge-acc mono" data-xlim>—</span></div>
          <div class="slp-cv-box" data-box1><canvas class="slp-cv" data-cv1 aria-label="X-bar kontrol diyagramı"></canvas><div class="slp-readout mono" data-rd1></div></div>
        </div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">R (Aralık) Kontrol Diyagramı</h4><span class="slp-badge slp-badge-acc mono" data-rlim>—</span></div>
          <div class="slp-cv-box" data-box2><canvas class="slp-cv" data-cv2 aria-label="R kontrol diyagramı"></canvas><div class="slp-readout mono" data-rd2></div></div>
        </div>
        <div class="slp-panel">
          <h4 class="slp-title">Kontrol Dışı Kural İhlalleri (Western Electric)</h4>
          <div class="slp-log" data-viols>—</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\text{UCL}_{\\bar{X}} = \\bar{\\bar{X}} + A_2 \\bar{R}, \\qquad \\text{LCL}_{\\bar{X}} = \\bar{\\bar{X}} - A_2 \\bar{R}, \\qquad \\hat{\\sigma} = \\frac{\\bar{R}}{d_2}',
        'C_p = \\frac{\\text{USL} - \\text{LSL}}{6\\hat{\\sigma}}, \\qquad C_{pk} = \\min\\left(\\frac{\\text{USL} - \\bar{\\bar{X}}}{3\\hat{\\sigma}},\\; \\frac{\\bar{\\bar{X}} - \\text{LSL}}{3\\hat{\\sigma}}\\right)',
      ],
      paragraphs: [
        '**$C_p$** sürecin yalnızca yayılımına bakarak potansiyel yeterliliği ölçerken, **$C_{pk}$** ortalamanın spesifikasyon sınırlarına olan yakınlığını da hesaba katar ($C_{pk} \\le C_p$). Endüstride $C_{pk} \\ge 1.33$ (4σ) tipik hedeftir.',
        '**Kontrol dışı kurallar**: (1) UCL/LCL dışına taşan nokta, (2) merkez çizgisinin aynı yanında 7 ardışık nokta, (3) 6 ardışık artan/azalan eğilim özel neden (assignable cause) göstergesidir.',
      ],
      tasks: [
        'Merkezden Kaymış Süreç senaryosunda $C_p$ yüksek olduğu halde $C_{pk}$’nın neden düştüğünü gözle.',
        'Ani Ortalama Kayması senaryosunda Kural 1 ve Kural 2 ihlallerinin hangi örneklemde tetiklendiğini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cv1 = host.querySelector('[data-cv1]'), cv2 = host.querySelector('[data-cv2]');
  const sMu = addSlider(ctrls, { label: 'Süreç Ortalaması μ', min: 47, max: 53, step: 0.1, value: st.mu, fmt: v => fmtFix(v, 1), onInput: v => { st.mu = v; update(); } });
  const sSig = addSlider(ctrls, { label: 'Süreç Std Sapması σ', min: 0.4, max: 2.0, step: 0.05, value: st.sigma, fmt: v => fmtFix(v, 2), onInput: v => { st.sigma = v; update(); } });
  const sN = addSlider(ctrls, { label: 'Alt Grup Boyutu n', min: 2, max: 10, step: 1, value: st.n, fmt: v => String(Math.round(v)), onInput: v => { st.n = Math.round(v); update(); } });
  const sSh = addSlider(ctrls, { label: 'Özel Neden Kayması (14. örnekten)', min: 0, max: 4, step: 0.25, value: st.shiftSig, fmt: v => `+${fmtFix(v, 2)}σ`, onInput: v => { st.shiftSig = v; st.shiftAt = v > 0 ? 13 : 99; update(); } });
  const sDr = addSlider(ctrls, { label: 'Aşınma Eğilimi (drift/örnek)', min: 0, max: 0.25, step: 0.02, value: st.drift, fmt: v => fmtFix(v, 2), onInput: v => { st.drift = v; update(); } });

  let last = null;
  function drawPlots() {
    if (!last) return;
    const xs = last.xBars.map((_, i) => i + 1);
    const k = xs.length;
    safePlot(cv1, [
      { name: 'X̄', color: PLOT_COLORS[1], xs, ys: last.xBars },
      { name: 'UCL', color: PLOT_COLORS[2], xs: [1, k], ys: [last.xUCL, last.xUCL] },
      { name: 'CL', color: PLOT_COLORS[3], xs: [1, k], ys: [last.xBarBar, last.xBarBar] },
      { name: 'LCL', color: PLOT_COLORS[2], xs: [1, k], ys: [last.xLCL, last.xLCL] },
    ], { x0: 1, x1: k, ylabel: 'X̄', height: 195 });
    safePlot(cv2, [
      { name: 'R', color: PLOT_COLORS[4], xs, ys: last.ranges },
      { name: 'UCL_R', color: PLOT_COLORS[2], xs: [1, k], ys: [last.rUCL, last.rUCL] },
      { name: 'R̄', color: PLOT_COLORS[3], xs: [1, k], ys: [last.rBar, last.rBar] },
      { name: 'LCL_R', color: PLOT_COLORS[2], xs: [1, k], ys: [last.rLCL, last.rLCL] },
    ], { x0: 1, x1: k, ylabel: 'R', height: 170 });
  }

  function update() {
    const subs = generateSPCData({ mu: st.mu, sigma: st.sigma, n: st.n, k: st.k, shiftAt: st.shiftAt, shiftSigma: st.shiftSig, driftPerSub: st.drift, seed: st.seed });
    last = analyzeSPC({ subgroups: subs, USL: st.usl, LSL: st.lsl });
    host.querySelector('[data-xlim]').textContent = `UCL=${fmtFix(last.xUCL, 2)} · CL=${fmtFix(last.xBarBar, 2)} · LCL=${fmtFix(last.xLCL, 2)}`;
    host.querySelector('[data-rlim]').textContent = `UCL=${fmtFix(last.rUCL, 2)} · R̄=${fmtFix(last.rBar, 2)} · LCL=${fmtFix(last.rLCL, 2)}`;
    renderKpis(kpis, [
      { lbl: 'Cp / Cpk', val: `${fmtFix(last.Cp, 2)} / ${fmtFix(last.Cpk, 2)}`, tone: last.Cpk >= 1.33 ? 'ok' : last.Cpk >= 1 ? 'warn' : 'bad' },
      { lbl: 'Tahmini σ̂ = R̄/d₂', val: fmtFix(last.sigmaHat, 3), sub: `d₂ = ${last.constants.d2}` },
      { lbl: 'Hata Oranı (PPM)', val: last.ppm < 1 ? '< 1' : String(Math.round(last.ppm)), tone: last.ppm < 100 ? 'ok' : 'warn' },
      { lbl: 'Kontrol Dışı Alarm', val: String(last.violations.length), tone: last.violations.length ? 'bad' : 'ok' },
    ]);
    host.querySelector('[data-viols]').innerHTML = last.violations.length
      ? last.violations.map(v => `<div style="color:${COL_BAD}">⚠ ${esc(v.rule)}: ${esc(v.desc)}</div>`).join('')
      : `<div style="color:${COL_OK}">✓ Tüm noktalar istatistiksel kontrol altında.</div>`;
    drawPlots();
  }

  host.querySelector('[data-reroll]').addEventListener('click', () => { st.seed += 19; update(); });
  attachReadout(cv1, host.querySelector('[data-rd1]'), (x, s, i) => `Örnek #${Math.round(x)} · X̄=${fmtFix(s[0].ys[i], 3)}`, clean);
  attachReadout(cv2, host.querySelector('[data-rd2]'), (x, s, i) => `Örnek #${Math.round(x)} · R=${fmtFix(s[0].ys[i], 3)}`, clean);
  observeResize(host.querySelector('[data-box1]'), drawPlots, clean);
  bindPresets(host, presets, p => {
    st.mu = p.mu; st.sigma = p.sigma; st.shiftAt = p.shiftAt; st.shiftSig = p.shiftSig; st.drift = p.drift; st.usl = p.usl; st.lsl = p.lsl;
    sMu.set(st.mu); sSig.set(st.sigma); sSh.set(st.shiftSig); sDr.set(st.drift);
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 2.6 MONTE CARLO & OLASILIK (Dağılımlar, Merkezi Limit Teoremi, Monte Carlo π)
function mountMonteCarlo(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Normal Dağılım (N(0,1))', mode: 'dist', dist: 'normal' },
    { label: 'Poisson (λ = 4)', mode: 'dist', dist: 'poisson' },
    { label: 'Merkezi Limit Teoremi (n=25)', mode: 'clt', parent: 'exponential', cltN: 25 },
    { label: 'Monte Carlo π Tahmini', mode: 'pi' },
  ];
  const st = {
    mode: 'dist', dist: 'normal', p1: 0, p2: 1, samples: [], rng: makeRng(71),
    parent: 'exponential', cltN: 12, cltRes: null,
    piPts: [], piInside: 0, piTotal: 0, piHist: [],
    playing: false,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Normal, Binom, Poisson, Üstel, Düzgün** dağılımlardan canlı örneklem çekerek histogramın teorik PDF/PMF’ye yakınsamasını gör; **Merkezi Limit Teoremini (CLT)** ve birim çeyrek daireyle **Monte Carlo $\\pi$** tahminini deneyle.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-mode>
        <button type="button" data-m="dist" class="on">Dağılım Keşfi</button>
        <button type="button" data-m="clt">Merkezi Limit (CLT)</button>
        <button type="button" data-m="pi">Monte Carlo π</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play>${icon('play')} Örnekle</button>
        <button type="button" class="btn small" data-batch>+500 Örnek</button>
        <button type="button" class="btn small ghost" data-reset>Temizle</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-ctitle>Histogram & Teorik Yoğunluk</h4><span class="slp-badge slp-badge-acc mono" data-cbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Olasılık ve Monte Carlo görselleştirmesi"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\bar{X}_n = \\frac{1}{n}\\sum_{i=1}^n X_i \\;\\xrightarrow{d}\\; \\mathcal{N}\\!\\left(\\mu,\\, \\frac{\\sigma^2}{n}\\right) \\quad (\\text{Merkezi Limit Teoremi})',
        '\\hat{\\pi}_N = 4\\,\\frac{N_{\\text{iç}}}{N}, \\qquad \\text{Standart Hata} = \\mathcal{O}\\!\\left(\\frac{1}{\\sqrt{N}}\\right)',
      ],
      paragraphs: [
        'Büyük Sayılar Yasası uyarınca örneklem sayısı $N$ arttıkça ampirik histogram gerçek olasılık yoğunluk (PDF) veya kütle (PMF) fonksiyonuna yakınsar.',
        '**Merkezi Limit Teoremi**, ana dağılım çarpık (Üstel) veya çift tepeli (Bimodal) olsa dahi $n$ büyüklüğündeki örneklem ortalamalarının $\\sigma/\\sqrt{n}$ standart sapmalı Normal dağılıma yakınsadığını gösterir.',
      ],
      tasks: [
        'Merkezi Limit sekmesinde ana dağılımı **Çift Tepeli (Bimodal)** seçip $n=1$’den $n=25$’e çıkararak çan eğrisinin doğuşunu izle.',
        'Monte Carlo π modunda 500’er örnek ekleyerek tahminin $3.14159$’a yakınsamasını ve $1/\\sqrt{N}$ hata azalmasını gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const selDist = addSelect(ctrls, 'Dağılım Ailesi', [
    ['normal', 'Normal (Gauss)'], ['binomial', 'Binom (n, p)'], ['poisson', 'Poisson (λ)'],
    ['exponential', 'Üstel (λ)'], ['uniform', 'Düzgün [a, b]'],
  ], st.dist, v => { st.dist = v; setDefaultParams(); resetAll(); });
  const sP1 = addSlider(ctrls, { label: 'Parametre 1', min: -3, max: 15, step: 0.2, value: 0, fmt: v => fmtFix(v, 2), onInput: v => { st.p1 = v; resetAll(); } });
  const sP2 = addSlider(ctrls, { label: 'Parametre 2', min: 0.1, max: 5, step: 0.1, value: 1, fmt: v => fmtFix(v, 2), onInput: v => { st.p2 = v; resetAll(); } });
  const selPar = addSelect(ctrls, 'Ana Dağılım (CLT)', [['exponential', 'Üstel (Sağa Çarpık)'], ['uniform', 'Düzgün [0, 10]'], ['bimodal', 'Çift Tepeli (Bimodal)']], st.parent, v => { st.parent = v; resetAll(); });
  const sCltN = addSlider(ctrls, { label: 'Örneklem Boyutu n', min: 1, max: 40, step: 1, value: st.cltN, fmt: v => String(Math.round(v)), onInput: v => { st.cltN = Math.round(v); resetAll(); } });

  function distParams() {
    if (st.dist === 'normal') return { mu: st.p1, sigma: Math.max(0.2, st.p2) };
    if (st.dist === 'binomial') return { n: Math.max(2, Math.round(Math.abs(st.p1) + 4)), p: Math.max(0.05, Math.min(0.95, st.p2 / 5)) };
    if (st.dist === 'poisson') return { lambda: Math.max(0.5, st.p1 + 4) };
    if (st.dist === 'exponential') return { lambda: Math.max(0.2, st.p2) };
    return { a: st.p1, b: st.p1 + Math.max(1, st.p2 * 2) };
  }
  function setDefaultParams() {
    if (st.dist === 'normal') { st.p1 = 0; st.p2 = 1; }
    else if (st.dist === 'binomial') { st.p1 = 10; st.p2 = 2; }
    else if (st.dist === 'poisson') { st.p1 = 0; st.p2 = 1; }
    else if (st.dist === 'exponential') { st.p1 = 0; st.p2 = 1; }
    else { st.p1 = 0; st.p2 = 4; }
    sP1.set(st.p1); sP2.set(st.p2);
  }

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(310, Math.max(230, w * 0.56)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'pi') {
      const sz = Math.min(H - 36, W * 0.46);
      const sx = 24, sy = (H - sz) / 2;
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5;
      c.strokeRect(sx, sy, sz, sz);
      c.beginPath(); c.arc(sx, sy + sz, sz, -Math.PI / 2, 0); c.strokeStyle = COL_OK; c.lineWidth = 2; c.stroke();
      const show = st.piPts.slice(-1200);
      for (const p of show) {
        c.fillStyle = p.hit ? COL_OK : COL_BAD;
        c.fillRect(sx + p.x * sz - 1, sy + (1 - p.y) * sz - 1, 2.4, 2.4);
      }
      // Right: convergence line
      const gx = sx + sz + 36, gw = W - gx - 18, gy = 28, gh = H - 56;
      if (gw > 90 && st.piHist.length >= 2) {
        const yOf = v => gy + ((3.6 - v) / 0.9) * gh;
        c.strokeStyle = COL_WARN; c.setLineDash([4, 4]);
        c.beginPath(); c.moveTo(gx, yOf(Math.PI)); c.lineTo(gx + gw, yOf(Math.PI)); c.stroke(); c.setLineDash([]);
        c.strokeStyle = acc; c.lineWidth = 2; c.beginPath();
        st.piHist.forEach((v, i) => {
          const x = gx + (i / (st.piHist.length - 1)) * gw;
          const y = Math.max(gy, Math.min(gy + gh, yOf(v)));
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
        c.stroke();
        c.fillStyle = COL_WARN; c.font = '11px "JetBrains Mono", monospace';
        c.fillText('π = 3.14159', gx + 4, yOf(Math.PI) - 5);
      }
      return;
    }

    // Histogram + theoretical overlay (for dist and clt)
    const isClt = st.mode === 'clt';
    const data = isClt ? st.cltRes.means : st.samples;
    const p = distParams();
    const info = isClt
      ? { mean: st.cltRes.theoMean, std: st.cltRes.theoStd, discrete: false, xMin: st.cltRes.theoMean - 4 * st.cltRes.theoStd, xMax: st.cltRes.theoMean + 4 * st.cltRes.theoStd }
      : distStats(st.dist, p);

    const padL = 38, padR = 16, padT = 18, padB = 26, pw = W - padL - padR, ph = H - padT - padB;
    const bins = info.discrete ? Math.round(info.xMax - info.xMin + 1) : 28;
    const counts = new Array(bins).fill(0);
    const binW = (info.xMax - info.xMin) / Math.max(1, bins);
    for (const v of data) {
      const idx = info.discrete ? Math.round(v - info.xMin) : Math.floor((v - info.xMin) / binW);
      if (idx >= 0 && idx < bins) counts[idx]++;
    }
    const nTot = Math.max(1, data.length);
    const dens = counts.map(k => info.discrete ? k / nTot : k / (nTot * binW));
    const theo = [];
    for (let i = 0; i <= 120; i++) {
      const x = info.xMin + ((info.xMax - info.xMin) * i) / 120;
      const y = isClt ? distPDF('normal', { mu: info.mean, sigma: info.std }, x) : distPDF(st.dist, p, info.discrete ? Math.round(x) : x);
      theo.push([x, y]);
    }
    const maxY = Math.max(1e-4, ...dens, ...theo.map(q => q[1])) * 1.12;
    const fx = x => padL + ((x - info.xMin) / Math.max(1e-6, info.xMax - info.xMin)) * pw;
    const fy = y => padT + (1 - y / maxY) * ph;

    // Bars
    const barPx = pw / bins;
    c.fillStyle = 'rgba(90,176,255,0.35)'; c.strokeStyle = COL_BLUE; c.lineWidth = 1;
    for (let i = 0; i < bins; i++) {
      const h = (dens[i] / maxY) * ph;
      c.fillRect(padL + i * barPx + 1, padT + ph - h, Math.max(2, barPx - 2), h);
    }
    // Theoretical curve
    c.strokeStyle = COL_WARN; c.lineWidth = 2.2; c.beginPath();
    theo.forEach(([x, y], i) => {
      if (i === 0) c.moveTo(fx(x), fy(y)); else c.lineTo(fx(x), fy(y));
    });
    c.stroke();
    // X axis labels
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
    for (let k = 0; k <= 4; k++) {
      const xv = info.xMin + ((info.xMax - info.xMin) * k) / 4;
      c.fillText(fmtFix(xv, 1), fx(xv), H - 8);
    }
  }, clean);

  function addSamples(count) {
    if (st.mode === 'dist') {
      const p = distParams();
      for (let i = 0; i < count; i++) st.samples.push(sampleOneDist(st.dist, p, st.rng));
      if (st.samples.length > 15000) st.samples.splice(0, st.samples.length - 15000);
    } else if (st.mode === 'clt') {
      const more = cltSampleMeans({ parent: st.parent, n: st.cltN, count, seed: Math.floor(st.rng() * 1e6) });
      st.cltRes.means.push(...more.means);
      const m = st.cltRes.means;
      const em = m.reduce((s, v) => s + v, 0) / m.length;
      const ev = m.reduce((s, v) => s + (v - em) ** 2, 0) / Math.max(1, m.length - 1);
      st.cltRes.empMean = em; st.cltRes.empStd = Math.sqrt(ev);
    } else {
      const b = monteCarloPiBatch(count, st.rng);
      st.piPts.push(...b.pts); if (st.piPts.length > 2500) st.piPts.splice(0, st.piPts.length - 2500);
      st.piInside += b.inside; st.piTotal += b.total;
      st.piHist.push((4 * st.piInside) / st.piTotal);
      if (st.piHist.length > 200) st.piHist.shift();
    }
    syncUI();
  }

  function syncUI() {
    selDist.setVisible(st.mode === 'dist'); sP1.setVisible(st.mode === 'dist'); sP2.setVisible(st.mode === 'dist');
    selPar.setVisible(st.mode === 'clt'); sCltN.setVisible(st.mode === 'clt');
    if (st.mode === 'dist') {
      const p = distParams(), info = distStats(st.dist, p);
      const n = st.samples.length || 1;
      const em = st.samples.reduce((s, v) => s + v, 0) / n;
      const es = Math.sqrt(st.samples.reduce((s, v) => s + (v - em) ** 2, 0) / n);
      host.querySelector('[data-ctitle]').textContent = 'Ampirik Histogram vs Teorik PDF/PMF';
      host.querySelector('[data-cbadge]').textContent = `N = ${st.samples.length}`;
      renderKpis(kpis, [
        { lbl: 'Teorik Ort. / Std', val: `${fmtFix(info.mean, 2)} / ${fmtFix(info.std, 2)}`, tone: 'acc' },
        { lbl: 'Örneklem Ort. / Std', val: `${fmtFix(em, 2)} / ${fmtFix(es, 2)}`, tone: 'ok' },
        { lbl: 'Örnek Sayısı', val: String(st.samples.length) },
      ]);
    } else if (st.mode === 'clt') {
      const r = st.cltRes;
      host.querySelector('[data-ctitle]').textContent = `Örneklem Ortalamaları X̄ (n = ${st.cltN}) vs Normal`;
      host.querySelector('[data-cbadge]').textContent = `${r.means.length} ortalama`;
      renderKpis(kpis, [
        { lbl: 'Teorik μ / (σ/√n)', val: `${fmtFix(r.theoMean, 2)} / ${fmtFix(r.theoStd, 3)}`, tone: 'acc' },
        { lbl: 'Ampirik Ort. / Std', val: `${fmtFix(r.empMean, 2)} / ${fmtFix(r.empStd, 3)}`, tone: 'ok' },
        { lbl: 'n Boyutu', val: String(st.cltN) },
      ]);
    } else {
      const est = st.piTotal ? (4 * st.piInside) / st.piTotal : 0;
      host.querySelector('[data-ctitle]').textContent = 'Çeyrek Daire Atışları & π Yakınsaması';
      host.querySelector('[data-cbadge]').textContent = `N = ${st.piTotal}`;
      renderKpis(kpis, [
        { lbl: 'Tahmin π̂', val: fmtFix(est, 5), sub: `Gerçek π = 3.14159`, tone: 'acc' },
        { lbl: 'Mutlak Hata', val: fmtFix(Math.abs(est - Math.PI), 5), tone: Math.abs(est - Math.PI) < 0.05 ? 'ok' : 'warn' },
        { lbl: 'İçerde / Toplam', val: `${st.piInside} / ${st.piTotal}` },
      ]);
    }
    cv.render();
  }

  const loop = createAnimLoop(() => { addSamples(40); return st.playing; }, clean);
  function resetAll() {
    loop.stop(); st.playing = false; playBtn.innerHTML = `${icon('play')} Örnekle`;
    st.samples = []; st.piPts = []; st.piInside = 0; st.piTotal = 0; st.piHist = [];
    st.cltRes = cltSampleMeans({ parent: st.parent, n: st.cltN, count: 300, seed: 51 });
    if (st.mode === 'dist') addSamples(400);
    else if (st.mode === 'pi') addSamples(400);
    else syncUI();
  }

  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-m]'); if (!b) return;
    st.mode = b.dataset.m;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x === b));
    resetAll();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Örnekle`;
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-batch]').addEventListener('click', () => addSamples(500));
  host.querySelector('[data-reset]').addEventListener('click', resetAll);
  bindPresets(host, presets, p => {
    st.mode = p.mode;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x.dataset.m === st.mode));
    if (p.dist) { st.dist = p.dist; selDist.set(st.dist); setDefaultParams(); }
    if (p.parent) { st.parent = p.parent; selPar.set(st.parent); }
    if (p.cltN) { st.cltN = p.cltN; sCltN.set(st.cltN); }
    resetAll();
  });

  bindTasks(host);
  resetAll();
  return clean.run;
}

// 2.7 MARKOV ZİNCİRLERİ
function mountMarkov(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Hava Durumu (3 Durum)', names: ['Güneşli', 'Bulutlu', 'Yağmurlu'], P: [[0.7, 0.2, 0.1], [0.3, 0.4, 0.3], [0.2, 0.3, 0.5]], pi0: [1, 0, 0] },
    { label: 'Marka Sadakati (2 Durum)', names: ['Marka A', 'Marka B'], P: [[0.8, 0.2], [0.3, 0.7]], pi0: [1, 0] },
    { label: 'Yutan Durum (Absorbing)', names: ['Aktif', 'Riskli', 'Kayıp'], P: [[0.8, 0.15, 0.05], [0.2, 0.5, 0.3], [0, 0, 1]], pi0: [1, 0, 0] },
  ];
  const st = {
    names: presets[0].names.slice(), P: presets[0].P.map(r => r.slice()), pi0: presets[0].pi0.slice(),
    stepN: 0, piCur: presets[0].pi0.slice(), playing: false, accum: 0,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Geçiş olasılık matrisi $P$’yi düzenle; **durum diyagramını**, $n$-adımlı dağılım $\\pi^{(n)} = \\pi^{(0)} P^n$ animasyonunu ve **kararlı durum vektörünü** ($\\pi P = \\pi$) canlı incele.', presets)}
    <div class="slp-toolbar">
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play>${icon('play')} Adımları Oynat</button>
        <button type="button" class="btn small" data-step>n + 1 Adım</button>
        <button type="button" class="btn small ghost" data-reset>n = 0 Sıfırla</button>
        <button type="button" class="btn small ghost" data-norm>Satırları Normalize Et</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel">
        <h4 class="slp-title">Geçiş Matrisi P (satır toplamı = 1)</h4>
        <div class="slp-table-wrap" data-mtbl></div>
        <h4 class="slp-title">Başlangıç Dağılımı π⁽⁰⁾</h4>
        <div class="slp-btn-row" data-pi0row></div>
      </div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">Durum Geçiş Diyagramı & Olasılık Kütlesi</h4><span class="slp-badge slp-badge-acc mono" data-nbadge>n = 0</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Markov zinciri durum diyagramı"></canvas></div>
        </div>
        <div class="slp-panel">
          <h4 class="slp-title">n-Adımlı Geçiş Matrisi Pⁿ</h4>
          <div class="slp-table-wrap" data-pn></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\pi^{(n)} = \\pi^{(0)} P^n, \\qquad \\sum_j P_{ij} = 1',
        '\\pi^* P = \\pi^*, \\qquad \\sum_i \\pi^*_i = 1 \\quad (\\text{Kararlı Durum / Steady State})',
      ],
      paragraphs: [
        '**Düzenli (regular)** bir Markov zincirinde ($P^m > 0$) başlangıç dağılımı $\\pi^{(0)}$ ne olursa olsun $\\pi^{(n)}$ tek bir kararlı durum dağılımı $\\pi^*$’a yakınsar ve $P^n$’in tüm satırları $\\pi^*$ olur.',
        '$P_{ii} = 1$ olan bir durum **yutan durumdur (absorbing state)**; zincir o duruma girdiğinde bir daha çıkamaz.',
      ],
      tasks: [
        'Hava Durumu zincirinde başlangıç durumunu değiştirip 15 adım sonunda aynı kararlı dağılıma yakınsadığını doğrula.',
        'Yutan Durum senaryosunda tüm olasılık kütlesinin zamanla "Kayıp" durumunda toplandığını izle.',
      ],
    })}
  </div>`;

  const mtbl = host.querySelector('[data-mtbl]');
  const pi0row = host.querySelector('[data-pi0row]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const cv = setupCanvas(host.querySelector('[data-cv]'), () => 255, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const n = st.P.length, acc = accentColor();
    const cx = W / 2, cy = H / 2 + 6, rx = Math.min(W * 0.34, 150), ry = Math.min(H * 0.32, 78);
    const pos = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    });
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const p = st.P[i][j]; if (p < 0.005) continue;
        const [x1, y1] = pos[i], [x2, y2] = pos[j];
        if (i === j) {
          c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1 + 2 * p;
          c.beginPath(); c.arc(x1, y1 - 30, 13, 0.3, Math.PI * 2 - 0.3); c.stroke();
          c.fillStyle = COL_WARN; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText(fmtFix(p, 2), x1, y1 - 46);
        } else {
          const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const ox = -uy * 10, oy = ux * 10;
          drawArrow(c, x1 + ux * 26 + ox, y1 + uy * 26 + oy, x2 - ux * 26 + ox, y2 - uy * 26 + oy, 'rgba(90,176,255,0.65)', 1 + 2.4 * p, 8);
          c.fillStyle = COL_BLUE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText(fmtFix(p, 2), (x1 + x2) / 2 + ox * 1.9, (y1 + y2) / 2 + oy * 1.9);
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = pos[i];
      const prob = st.piCur[i] || 0;
      const rad = 20 + prob * 14;
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2);
      c.fillStyle = `rgba(91,228,155,${0.12 + 0.5 * prob})`; c.fill();
      c.strokeStyle = prob > 0.4 ? acc : 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = COL_FG; c.font = '600 11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(st.names[i].slice(0, 8), x, y - 2);
      c.fillStyle = COL_OK; c.fillText(`%${fmtFix(prob * 100, 1)}`, x, y + 12);
    }
  }, clean);

  function renderMatrixEditor() {
    const n = st.P.length;
    mtbl.innerHTML = `<table class="slp-tbl" aria-label="Geçiş matrisi düzenleyici">
      <thead><tr><th>→</th>${st.names.map(s => `<th>${esc(s)}</th>`).join('')}</tr></thead>
      <tbody>${st.P.map((row, i) => `<tr><td><b>${esc(st.names[i])}</b></td>${row.map((v, j) => `<td><input type="number" min="0" max="1" step="0.05" value="${fmtFix(v, 2)}" class="inp slp-in-sm" style="width:62px" data-ij="${i},${j}" aria-label="P(${i + 1},${j + 1})"></td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
    pi0row.innerHTML = st.names.map((nm, i) => `<button type="button" class="slp-chip ${st.pi0[i] > 0.5 ? 'slp-on' : ''}" data-s0="${i}">%100 ${esc(nm)}</button>`).join('');
  }

  function syncUI() {
    const P = normalizeTransitionMatrix(st.P);
    const ss = markovSteadyState(P);
    const cls = classifyMarkov(P);
    const Pn = markovPower(P, Math.max(1, st.stepN));
    host.querySelector('[data-nbadge]').textContent = `Adım n = ${st.stepN}`;
    renderKpis(kpis, [
      { lbl: `Dağılım π⁽${st.stepN}⁾`, val: st.piCur.map(x => fmtFix(x, 2)).join(' · '), tone: 'acc' },
      { lbl: 'Kararlı Durum π*', val: ss.pi.map(x => fmtFix(x, 3)).join(' · '), sub: ss.unique ? 'Tekil kararlı durum' : 'Çoklu sınıf', tone: 'ok' },
      { lbl: 'Sınıf', val: cls.absorbing.length ? `Yutan: ${cls.absorbing.map(i => st.names[i]).join(',')}` : (cls.isRegular ? 'Düzenli (Ergodik)' : 'İndirgenebilir') },
    ]);
    host.querySelector('[data-pn]').innerHTML = `<table class="slp-tbl" aria-label="P üzeri n matrisi">
      <thead><tr><th>P^${Math.max(1, st.stepN)}</th>${st.names.map(s => `<th>${esc(s)}</th>`).join('')}</tr></thead>
      <tbody>${Pn.map((r, i) => `<tr><td><b>${esc(st.names[i])}</b></td>${r.map(v => `<td class="mono">${fmtFix(v, 3)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    st.accum += dt * 2.2;
    if (st.accum >= 1) {
      st.accum -= 1;
      st.stepN++;
      st.piCur = markovStep(st.piCur, normalizeTransitionMatrix(st.P));
      syncUI();
      if (st.stepN >= 30) { st.playing = false; playBtn.innerHTML = `${icon('play')} Adımları Oynat`; return false; }
    }
    return st.playing;
  }, clean);

  mtbl.addEventListener('change', e => {
    const ij = e.target.dataset.ij; if (!ij) return;
    const [i, j] = ij.split(',').map(Number);
    st.P[i][j] = Math.max(0, Math.min(1, +e.target.value || 0));
    syncUI();
  });
  pi0row.addEventListener('click', e => {
    const b = e.target.closest?.('[data-s0]'); if (!b) return;
    const idx = +b.dataset.s0;
    st.pi0 = st.names.map((_, i) => (i === idx ? 1 : 0));
    st.stepN = 0; st.piCur = st.pi0.slice();
    renderMatrixEditor(); syncUI();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Adımları Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-step]').addEventListener('click', () => {
    st.stepN++; st.piCur = markovStep(st.piCur, normalizeTransitionMatrix(st.P)); syncUI();
  });
  host.querySelector('[data-reset]').addEventListener('click', () => {
    loop.stop(); st.playing = false; playBtn.innerHTML = `${icon('play')} Adımları Oynat`;
    st.stepN = 0; st.piCur = st.pi0.slice(); syncUI();
  });
  host.querySelector('[data-norm]').addEventListener('click', () => { st.P = normalizeTransitionMatrix(st.P); renderMatrixEditor(); syncUI(); });
  bindPresets(host, presets, p => {
    st.names = p.names.slice(); st.P = p.P.map(r => r.slice()); st.pi0 = p.pi0.slice();
    st.stepN = 0; st.piCur = st.pi0.slice();
    renderMatrixEditor(); syncUI();
  });

  bindTasks(host);
  renderMatrixEditor();
  syncUI();
  return clean.run;
}

// 2.8 TAŞIMA PROBLEMİ (Kuzeybatı, Vogel VAM, MODI Optimizasyonu)
function mountTransportation(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Klasik 3×4 Fabrika–Depo (Opt = 1020)', costs: [[8, 6, 10, 9], [9, 12, 13, 7], [14, 9, 16, 5]], supply: [35, 50, 40], demand: [45, 20, 30, 30] },
    { label: 'Dengesiz Arz (Kukla Depo)', costs: [[4, 8, 8], [16, 24, 16], [8, 16, 24]], supply: [76, 82, 77], demand: [72, 102, 41] },
    { label: '3×3 Lojistik Ağı', costs: [[2, 3, 11], [1, 0, 6], [5, 8, 15]], supply: [6, 1, 10], demand: [7, 5, 5] },
  ];
  const st = {
    costs: presets[0].costs.map(r => r.slice()),
    supply: presets[0].supply.slice(),
    demand: presets[0].demand.slice(),
    initMethod: 'nw',
    iterIdx: 0,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Kuzeybatı Köşesi (NW)** veya **Vogel Yaklaşımı (VAM)** ile başlangıç çözümü kur, ardından **MODI ($u_i, v_j$ potansiyel) yöntemiyle** kapalı döngüleri (stepping-stone) adım adım izleyerek minimum taşıma maliyetine ulaş.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-im>
        <button type="button" data-m="nw" class="on">Başlangıç: Kuzeybatı</button>
        <button type="button" data-m="vogel">Başlangıç: Vogel (VAM)</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small" data-prev>← Önceki İterasyon</button>
        <button type="button" class="btn small primary" data-next>MODI Adımı →</button>
      </div>
    </div>
    <div class="slp-kpis" data-kpis></div>
    <div class="slp-grid-2">
      <div class="slp-panel">
        <h4 class="slp-title">Birim Maliyetler, Arz ve Talep (Düzenlenebilir)</h4>
        <div class="slp-table-wrap" data-edtbl></div>
      </div>
      <div class="slp-panel">
        <div class="slp-head"><h4 class="slp-title" data-mtitle>MODI Dağıtım Tablosu</h4><span class="slp-badge slp-badge-acc mono" data-mbadge>—</span></div>
        <div class="slp-table-wrap" data-restbl></div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\min \\sum_{i=1}^m \\sum_{j=1}^n c_{ij} x_{ij}, \\qquad u_i + v_j = c_{ij} \\;(\\text{temel hücreler})',
        '\\Delta_{ij} = c_{ij} - (u_i + v_j) \\ge 0 \\;\\forall (i,j) \\iff \\text{Optimal Çözüm}',
      ],
      paragraphs: [
        '**Vogel (VAM)** her satır ve sütunda en ucuz iki maliyet arasındaki ceza farkını kullanarak genellikle Kuzeybatı Köşesinden çok daha düşük maliyetli başlangıç çözümü üretir.',
        '**MODI yöntemi** temel olmayan hücreler için indirgenmiş maliyet $\\Delta_{ij} = c_{ij} - u_i - v_j$ hesaplar; negatif $\\Delta_{ij}$ varsa o hücreden geçen kapalı alternatif (+/−) döngü boyunca $\\theta$ kadar taşıma kaydırılarak maliyet düşürülür.',
      ],
      tasks: [
        'Klasik 3×4 problemde Kuzeybatı ile Vogel başlangıç maliyetlerini karşılaştır ve her ikisinin de MODI sonunda **1020** optimal maliyetine ulaştığını doğrula.',
        'Dengesiz Arz senaryosunda otomatik eklenen 0 maliyetli kukla (dummy) sütununu gözle.',
      ],
    })}
  </div>`;

  const kpis = host.querySelector('[data-kpis]');
  const edtbl = host.querySelector('[data-edtbl]');
  const restbl = host.querySelector('[data-restbl]');

  function renderEditor() {
    const m = st.costs.length, n = st.costs[0].length;
    edtbl.innerHTML = `<table class="slp-tbl" aria-label="Taşıma maliyet tablosu">
      <thead><tr><th>Fabrika</th>${Array.from({ length: n }, (_, j) => `<th>Depo ${j + 1}</th>`).join('')}<th>Arz</th></tr></thead>
      <tbody>
        ${st.costs.map((row, i) => `<tr>
          <td><b>F${i + 1}</b></td>
          ${row.map((c, j) => `<td><input type="number" min="0" max="99" value="${c}" class="inp slp-in-sm" style="width:56px" data-c="${i},${j}" aria-label="F${i+1}-D${j+1} maliyeti"></td>`).join('')}
          <td><input type="number" min="1" max="500" value="${st.supply[i]}" class="inp slp-in-sm" style="width:62px" data-sup="${i}" aria-label="F${i+1} arz"></td>
        </tr>`).join('')}
        <tr><td><b>Talep</b></td>${st.demand.map((d, j) => `<td><input type="number" min="1" max="500" value="${d}" class="inp slp-in-sm" style="width:56px" data-dem="${j}" aria-label="D${j+1} talep"></td>`).join('')}<td class="mono mute">${st.supply.reduce((a,b)=>a+b,0)}/${st.demand.reduce((a,b)=>a+b,0)}</td></tr>
      </tbody>
    </table>`;
  }

  function syncUI() {
    const nw = solveNorthwestCorner(st);
    const vam = solveVogel(st);
    const res = optimizeMODI(st, st.initMethod);
    const iters = res.iterations;
    st.iterIdx = Math.max(0, Math.min(iters.length - 1, st.iterIdx));
    const cur = iters[st.iterIdx] || { allocation: res.allocation, cost: res.optimalCost, u: res.u, v: res.v, loop: null, entering: null };

    renderKpis(kpis, [
      { lbl: 'Kuzeybatı Maliyeti', val: String(Math.round(nw.cost)) },
      { lbl: 'Vogel (VAM) Maliyeti', val: String(Math.round(vam.cost)), tone: 'ok' },
      { lbl: 'MODI Optimal Maliyet', val: String(Math.round(res.optimalCost)), sub: `Tasarruf: ${Math.round(res.savings)}`, tone: 'acc' },
      { lbl: 'İterasyon', val: `${st.iterIdx + 1} / ${iters.length}`, sub: res.dummy ? `Kukla ${res.dummy === 'col' ? 'Depo' : 'Fabrika'} eklendi` : 'Dengeli' },
    ]);

    const loopSet = new Map((cur.loop || []).map(([r, c], k) => [`${r},${c}`, k % 2 === 0 ? '+' : '−']));
    host.querySelector('[data-mtitle]').textContent = cur.entering ? `İterasyon ${st.iterIdx + 1} · Giren (${cur.entering[0]+1},${cur.entering[1]+1}), θ=${cur.theta}` : `Optimal Çözüm (Δ ≥ 0)`;
    host.querySelector('[data-mbadge]').textContent = `Maliyet = ${Math.round(cur.cost)}`;

    const C = res.costs, m = C.length, n = C[0].length;
    restbl.innerHTML = `<table class="slp-tbl" aria-label="MODI dağıtım ve potansiyel tablosu">
      <thead><tr><th>uᵢ \\ vⱼ</th>${Array.from({ length: n }, (_, j) => `<th class="mono">D${j + 1} (v=${fmtFix(cur.v[j], 1)})</th>`).join('')}</tr></thead>
      <tbody>${Array.from({ length: m }, (_, i) => `<tr>
        <td class="mono"><b>F${i + 1} (u=${fmtFix(cur.u[i], 1)})</b></td>
        ${Array.from({ length: n }, (__, j) => {
          const x = cur.allocation[i][j];
          const sgn = loopSet.get(`${i},${j}`);
          const cls = sgn === '+' ? 'slp-td-ok' : sgn === '−' ? 'slp-td-warn' : x > 0 ? 'slp-td-hi' : '';
          return `<td class="mono ${cls}">${x > 0 ? `<b>${fmtFix(x, 1)}</b>` : '·'} <span class="mute small">(c=${C[i][j]})${sgn ? ` [${sgn}]` : ''}</span></td>`;
        }).join('')}
      </tr>`).join('')}</tbody>
    </table>`;
  }

  edtbl.addEventListener('change', e => {
    if (e.target.dataset.c) {
      const [i, j] = e.target.dataset.c.split(',').map(Number);
      st.costs[i][j] = Math.max(0, +e.target.value || 0);
    } else if (e.target.dataset.sup) {
      st.supply[+e.target.dataset.sup] = Math.max(1, +e.target.value || 1);
    } else if (e.target.dataset.dem) {
      st.demand[+e.target.dataset.dem] = Math.max(1, +e.target.value || 1);
    }
    st.iterIdx = 0; syncUI();
  });
  host.querySelector('[data-im]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-m]'); if (!b) return;
    st.initMethod = b.dataset.m; st.iterIdx = 0;
    host.querySelectorAll('[data-im] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  host.querySelector('[data-prev]').addEventListener('click', () => { st.iterIdx = Math.max(0, st.iterIdx - 1); syncUI(); });
  host.querySelector('[data-next]').addEventListener('click', () => { st.iterIdx++; syncUI(); });
  bindPresets(host, presets, p => {
    st.costs = p.costs.map(r => r.slice()); st.supply = p.supply.slice(); st.demand = p.demand.slice(); st.iterIdx = 0;
    renderEditor(); syncUI();
  });

  bindTasks(host);
  renderEditor();
  syncUI();
  return clean.run;
}

// =====================================================================
// FIELD 3: BİYOMEDİKAL (7 SIMULATIONS)
// =====================================================================

// 3.1 EKG & KALP VEKTÖRÜ (Einthoven Üçgeni)
function mountECG(host, ctx) {
  const clean = createClean(ctx);
  const presets = Object.values(ECG_PRESETS);
  const st = { ...ECG_PRESETS.normal, phase: 0, timeSec: 0, playing: autoPlayAllowed() };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Sentetik **P–QRS–T EKG** sinyali üret; kalp hızı, elektriksel eksen ve aritmi senaryolarıyla **Einthoven Üçgeni** içindeki canlı **kalp vektörünün** Derivasyon I, II ve III üzerindeki izdüşümlerini izle.', presets)}
    <div class="slp-toolbar">
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`}</button>
        <button type="button" class="btn small ghost" data-rst>Sıfırla</button>
      </div>
      <span class="slp-badge slp-badge-ok mono" data-einth>V_II = V_I + V_III ✓</span>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-grid-2">
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">Einthoven Üçgeni & Kalp Vektörü</h4><span class="slp-badge slp-badge-acc mono" data-vdeg>60°</span></div>
            <div class="slp-cv-box"><canvas class="slp-cv" data-vec aria-label="Einthoven üçgeni ve canlı kalp vektörü"></canvas></div>
          </div>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">3 Derivasyonlu EKG (I, II, III)</h4><span class="slp-hint">25 mm/s · 10 mm/mV</span></div>
            <div class="slp-cv-box"><canvas class="slp-cv" data-ecg aria-label="3 derivasyonlu EKG monitörü"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'V_{\\text{I}} = V_x, \\quad V_{\\text{II}} = \\tfrac{1}{2}V_x + \\tfrac{\\sqrt{3}}{2}V_y, \\quad V_{\\text{III}} = -\\tfrac{1}{2}V_x + \\tfrac{\\sqrt{3}}{2}V_y \\implies V_{\\text{II}} = V_{\\text{I}} + V_{\\text{III}}',
        '\\text{QT}_c = \\frac{\\text{QT}}{\\sqrt{\\text{RR}}} \\quad (\\text{Bazett Formülü})',
      ],
      paragraphs: [
        '**Einthoven Yasası** Kirchhoff gerilim yasasının biyoelektrik bir sonucudur: ekstremite derivasyonları kapalı bir üçgen oluşturduğundan her anda $V_{\\text{II}} = V_{\\text{I}} + V_{\\text{III}}$ özdeşliği sağlanır.',
        '**Atriyal Fibrilasyonda** P dalgası kaybolur ve R–R aralıkları düzensizleşir; **PVC**’de ventriküler ektopik odak geniş ve ters polariteli QRS üretir; **STEMI**’de ST segmenti izoelektrik hattın üstüne yükselir.',
      ],
      tasks: [
        'Elektriksel ekseni $60^\\circ$’den $-30^\\circ$’ye (sol aks sapması) kaydırarak Derivasyon III’teki R dalgasının negatife dönmesini gözle.',
        '**Atriyal Fibrilasyon** senaryosunda P dalgasının kayboluşunu ve düzensiz R–R aralıklarını incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const sHr = addSlider(ctrls, { label: 'Kalp Hızı (HR)', unit: 'BPM', min: 40, max: 160, step: 1, value: st.hr, fmt: v => `${Math.round(v)} BPM`, onInput: v => { st.hr = v; recompute(); } });
  const sAxis = addSlider(ctrls, { label: 'Elektriksel Eksen', unit: '°', min: -60, max: 140, step: 5, value: st.axisDeg, fmt: v => `${Math.round(v)}°`, onInput: v => { st.axisDeg = v; recompute(); } });
  const sQrs = addSlider(ctrls, { label: 'QRS Genişlik Çarpanı', min: 0.7, max: 2.0, step: 0.05, value: st.qrsWidth, fmt: v => `${Math.round(90 * v)} ms`, onInput: v => { st.qrsWidth = v; recompute(); } });
  const sSt = addSlider(ctrls, { label: 'ST Segment Yükselmesi', unit: 'mV', min: -0.25, max: 0.45, step: 0.02, value: st.stElev, fmt: v => `${fmtFix(v, 2)} mV`, onInput: v => { st.stElev = v; recompute(); } });
  const tAfib = addToggle(ctrls, 'Atriyal Fibrilasyon (P yok, düzensiz)', st.afib, v => { st.afib = v; recompute(); });

  let trace = null, vcgLoop = [];

  const vecCv = setupCanvas(host.querySelector('[data-vec]'), () => 255, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.36;
    // Einthoven equilateral triangle (RA top-left, LA top-right, LL bottom)
    const pRA = [cx - R * 0.92, cy - R * 0.56];
    const pLA = [cx + R * 0.92, cy - R * 0.56];
    const pLL = [cx, cy + R * 1.04];
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(...pRA); c.lineTo(...pLA); c.lineTo(...pLL); c.closePath(); c.stroke();
    c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('RA (−)', pRA[0] - 12, pRA[1] - 6);
    c.fillText('LA (+I)', pLA[0] + 12, pLA[1] - 6);
    c.fillText('LL (+II/+III)', pLL[0], pLL[1] + 14);
    c.fillStyle = COL_BLUE; c.fillText('Lead I', cx, pRA[1] - 7);
    c.fillStyle = COL_OK; c.fillText('Lead II', (pRA[0] + pLL[0]) / 2 - 22, (pRA[1] + pLL[1]) / 2 + 4);
    c.fillStyle = COL_WARN; c.fillText('Lead III', (pLA[0] + pLL[0]) / 2 + 24, (pLA[1] + pLL[1]) / 2 + 4);

    // VCG loop
    const scale = R * 0.62;
    c.strokeStyle = 'rgba(244,244,245,0.28)'; c.lineWidth = 1.2; c.beginPath();
    vcgLoop.forEach((v, i) => {
      const x = cx + v.vx * scale, y = cy + v.vy * scale;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();

    // Current instantaneous vector
    const cur = ecgVectorAt(st.phase, st);
    const tx = cx + cur.vx * scale, ty = cy + cur.vy * scale;
    drawArrow(c, cx, cy, tx, ty, COL_BAD, 2.6, 8);
    host.querySelector('[data-einth]').textContent = `I:${fmtFix(cur.leadI, 2)} + III:${fmtFix(cur.leadIII, 2)} = II:${fmtFix(cur.leadII, 2)} mV`;
  }, clean);

  const ecgCv = setupCanvas(host.querySelector('[data-ecg]'), () => 255, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!trace) return;
    // ECG paper grid
    c.strokeStyle = 'rgba(255,107,107,0.10)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    const leads = [
      { lbl: 'I', ys: trace.leadI, col: COL_BLUE, yc: H * 0.20 },
      { lbl: 'II', ys: trace.leadII, col: COL_OK, yc: H * 0.52 },
      { lbl: 'III', ys: trace.leadIII, col: COL_WARN, yc: H * 0.84 },
    ];
    const n = trace.t.length;
    const sweepIdx = Math.floor(((st.timeSec % 3.5) / 3.5) * n);
    for (const L of leads) {
      c.fillStyle = L.col; c.font = 'bold 11px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText(L.lbl, 8, L.yc - 16);
      c.strokeStyle = L.col; c.lineWidth = 1.8; c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = 26 + ((W - 34) * i) / (n - 1);
        const y = L.yc - L.ys[i] * 26;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      const sx = 26 + ((W - 34) * sweepIdx) / (n - 1);
      c.beginPath(); c.arc(sx, L.yc - L.ys[sweepIdx] * 26, 3.5, 0, Math.PI * 2);
      c.fillStyle = '#fff'; c.fill();
    }
  }, clean);

  function recompute() {
    trace = generateECGTrace(st, 3.5, 200);
    vcgLoop = Array.from({ length: 120 }, (_, i) => ecgVectorAt(i / 120, st));
    host.querySelector('[data-vdeg]').textContent = `Eksen ${Math.round(st.axisDeg)}°`;
    renderKpis(kpis, [
      { lbl: 'Kalp Hızı', val: `${Math.round(st.hr)} BPM`, sub: `RR = ${Math.round(trace.rrMs)} ms`, tone: 'acc' },
      { lbl: 'QRS / PR', val: `${trace.qrsMs} ms / ${Number.isFinite(trace.prMs) ? trace.prMs + ' ms' : 'Yok (AF)'}` },
      { lbl: 'QT / QTc (Bazett)', val: `${trace.qtMs} / ${trace.qtcMs} ms`, tone: trace.qtcMs > 460 ? 'warn' : 'ok' },
    ]);
    vecCv.render(); ecgCv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    st.timeSec += dt;
    const rr = 60 / Math.max(30, st.hr);
    st.phase = (st.phase + dt / rr) % 1;
    vecCv.render(); ecgCv.render();
    return st.playing;
  }, clean);

  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-rst]').addEventListener('click', () => { st.phase = 0; st.timeSec = 0; vecCv.render(); ecgCv.render(); });
  bindPresets(host, presets, p => {
    Object.assign(st, p);
    sHr.set(st.hr); sAxis.set(st.axisDeg); sQrs.set(st.qrsWidth); sSt.set(st.stElev); tAfib.set(st.afib);
    recompute();
  });

  bindTasks(host);
  recompute();
  if (st.playing) loop.start();
  return clean.run;
}

// 3.2 FARMAKOKİNETİK (1-Kompartman IV/Oral, Çoklu Doz, 2-Kompartman)
function mountPK(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Oral Tekrarlı (Terapötik Pencere)', comp: 1, route: 'oral', multi: true, dose: 500, load: 500, tau: 8, Vd: 40, ke: 0.14, ka: 1.2 },
    { label: 'Yükleme Dozu ile Hızlı Kararlı Durum', comp: 1, route: 'oral', multi: true, dose: 400, load: 900, tau: 8, Vd: 40, ke: 0.10, ka: 1.2 },
    { label: 'IV Bolus Tek Doz', comp: 1, route: 'iv', multi: false, dose: 500, load: 500, tau: 8, Vd: 35, ke: 0.18, ka: 1.2 },
    { label: '2-Kompartman (Dağılım + Eliminasyon)', comp: 2, route: 'iv', multi: false, dose: 500, load: 500, tau: 12, Vd: 15, ke: 0.18, ka: 1.2 },
  ];
  const st = { comp: 1, route: 'oral', multi: true, dose: 500, load: 500, tau: 8, nDoses: 8, Vd: 40, ke: 0.14, ka: 1.2, F: 0.85, k12: 0.45, k21: 0.25, mec: 6, mtc: 18 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**1-Kompartman (IV Bolus / Oral Bateman)** ve **2-Kompartman** farmakokinetik modellerinde plazma ilaç derişimini, yarı ömrü ($t_{1/2}$), **tekrarlı dozlama kararlı durumunu** ve **terapötik pencereyi (MEC–MTC)** incele.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-comp>
        <button type="button" data-c="1" class="on">1-Kompartman</button>
        <button type="button" data-c="2">2-Kompartman (α/β)</button>
      </div>
      <div class="seg" role="tablist" data-route>
        <button type="button" data-r="iv">IV Bolus</button>
        <button type="button" data-r="oral" class="on">Oral (Bateman)</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">Plazma İlaç Derişimi C(t) (mg/L)</h4><div class="slp-legend"><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[1]}"></i>Merkezi C₁(t)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[3]}"></i>MEC (Alt)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[2]}"></i>MTC (Toksik)</span></div></div>
          <div class="slp-cv-box" data-box><canvas class="slp-cv" data-cv aria-label="Farmakokinetik derişim-zaman grafiği"></canvas><div class="slp-readout mono" data-rd></div></div>
          <div class="slp-axis-lbl mono">Zaman t (saat)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'C_{\\text{IV}}(t) = \\frac{D}{V_d} e^{-k_e t}, \\qquad C_{\\text{oral}}(t) = \\frac{F D k_a}{V_d(k_a - k_e)}\\bigl(e^{-k_e t} - e^{-k_a t}\\bigr)',
        't_{1/2} = \\frac{\\ln 2}{k_e}, \\qquad CL = k_e V_d, \\qquad C_{ss,\\text{ort}} = \\frac{F D}{CL \\cdot \\tau}',
      ],
      paragraphs: [
        'Tekrarlı dozlama altında plazma derişimi yaklaşık **$4\\text{–}5\\,t_{1/2}$** sürede kararlı duruma (steady state) ulaşır. İlk doz olarak yüksek bir **yükleme dozu ($D_L = D / (1 - e^{-k_e\\tau})$)** verilerek terapötik pencereye ilk dozda ulaşılabilir.',
        '**2-Kompartman** modelinde ilaç önce merkezi kandan periferik dokulara hızla dağılır ($\\alpha$ fazı), ardından daha yavaş bir eğimle elimine edilir ($\\beta$ fazı).',
      ],
      tasks: [
        'Tekrarlı oral dozda doz aralığı $\\tau$’yu $t_{1/2}$’ye yaklaştırıp birikim oranının $R_{ac} \\approx 2$ olduğunu doğrula.',
        'Yükleme Dozu senaryosunda kararlı duruma ilk 1–2 saatte ulaşıldığını ve MTC toksik sınırın aşılmadığını gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cv = host.querySelector('[data-cv]');

  const tMulti = addToggle(ctrls, 'Tekrarlı Dozlama (Çoklu Doz)', st.multi, v => { st.multi = v; update(); });
  const sDose = addSlider(ctrls, { label: 'İdame Dozu D', unit: 'mg', min: 100, max: 1200, step: 25, value: st.dose, fmt: v => `${Math.round(v)} mg`, onInput: v => { st.dose = v; update(); } });
  const sLoad = addSlider(ctrls, { label: 'İlk Yükleme Dozu D_L', unit: 'mg', min: 100, max: 1500, step: 25, value: st.load, fmt: v => `${Math.round(v)} mg`, onInput: v => { st.load = v; update(); } });
  const sTau = addSlider(ctrls, { label: 'Doz Aralığı τ', unit: 'sa', min: 4, max: 24, step: 1, value: st.tau, fmt: v => `${Math.round(v)} sa`, onInput: v => { st.tau = v; update(); } });
  const sVd = addSlider(ctrls, { label: 'Dağılım Hacmi V_d', unit: 'L', min: 10, max: 100, step: 1, value: st.Vd, fmt: v => `${Math.round(v)} L`, onInput: v => { st.Vd = v; update(); } });
  const sKe = addSlider(ctrls, { label: 'Eliminasyon Hızı k_e', unit: '/sa', min: 0.04, max: 0.5, step: 0.01, value: st.ke, fmt: v => `${fmtFix(v, 2)} /sa`, onInput: v => { st.ke = v; update(); } });
  const sKa = addSlider(ctrls, { label: 'Emilim Hızı k_a (Oral)', unit: '/sa', min: 0.2, max: 3.0, step: 0.05, value: st.ka, fmt: v => `${fmtFix(v, 2)} /sa`, onInput: v => { st.ka = v; update(); } });

  let lastPlot = null;
  function drawPlot() {
    if (!lastPlot) return;
    const { t, series, tEnd } = lastPlot;
    safePlot(cv, series, { x0: 0, x1: tEnd, ylabel: 'mg/L', height: 245 });
  }

  function update() {
    sLoad.setVisible(st.multi && st.comp === 1);
    sTau.setVisible(st.multi);
    sKa.setVisible(st.comp === 1 && st.route === 'oral');
    host.querySelector('[data-route]').hidden = st.comp === 2;

    if (st.comp === 2) {
      const r = pkTwoComp({ dose: st.dose, V1: st.Vd, k10: st.ke, k12: st.k12, k21: st.k21, tau: st.tau, nDoses: st.multi ? 6 : 1, tEnd: 36 });
      const tEnd = r.t.at(-1);
      lastPlot = {
        t: r.t, tEnd,
        series: [
          { name: 'C₁ (Merkezi)', color: PLOT_COLORS[1], xs: r.t, ys: r.C1 },
          { name: 'C₂ (Periferik)', color: PLOT_COLORS[5], xs: r.t, ys: r.C2 },
          { name: 'MEC', color: PLOT_COLORS[3], xs: [0, tEnd], ys: [st.mec, st.mec] },
          { name: 'MTC', color: PLOT_COLORS[2], xs: [0, tEnd], ys: [st.mtc, st.mtc] },
        ],
      };
      renderKpis(kpis, [
        { lbl: 't₁/₂,α (Dağılım)', val: `${fmtFix(r.halfAlpha, 2)} sa`, tone: 'acc' },
        { lbl: 't₁/₂,β (Eliminasyon)', val: `${fmtFix(r.halfBeta, 2)} sa`, tone: 'ok' },
        { lbl: 'Klirens CL', val: `${fmtFix(r.CL, 2)} L/sa`, sub: `V₂ = ${fmtFix(r.V2, 1)} L` },
      ]);
    } else if (st.multi) {
      const r = pkOneCompMulti({ route: st.route, dose: st.dose, loadingDose: st.load, tau: st.tau, nDoses: st.nDoses, Vd: st.Vd, ke: st.ke, ka: st.ka, F: st.F, mec: st.mec, mtc: st.mtc });
      const tEnd = r.t.at(-1);
      lastPlot = {
        t: r.t, tEnd,
        series: [
          { name: 'C(t)', color: PLOT_COLORS[1], xs: r.t, ys: r.C },
          { name: 'MEC', color: PLOT_COLORS[3], xs: [0, tEnd], ys: [st.mec, st.mec] },
          { name: 'MTC', color: PLOT_COLORS[2], xs: [0, tEnd], ys: [st.mtc, st.mtc] },
        ],
      };
      renderKpis(kpis, [
        { lbl: 'Yarı Ömür t₁/₂', val: `${fmtFix(r.halfLife, 2)} sa`, sub: `CL = ${fmtFix(r.CL, 2)} L/sa`, tone: 'acc' },
        { lbl: 'Css,maks / Css,min', val: `${fmtFix(r.cssMax, 1)} / ${fmtFix(r.cssMin, 1)} mg/L`, sub: `Ort: ${fmtFix(r.cssAvg, 1)} mg/L` },
        { lbl: 'Birikim Oranı R_ac', val: `${fmtFix(r.rac, 2)}×` },
        { lbl: 'Terapötik Pencere', val: `%${fmtFix(r.timeInWindowPct, 0)}`, tone: r.timeInWindowPct > 65 ? 'ok' : 'warn' },
      ]);
    } else {
      const r = pkOneCompSingle({ route: st.route, dose: st.dose, Vd: st.Vd, ke: st.ke, ka: st.ka, F: st.F, tEnd: 36 });
      lastPlot = {
        t: r.t, tEnd: 36,
        series: [
          { name: 'C(t)', color: PLOT_COLORS[1], xs: r.t, ys: r.C },
          { name: 'MEC', color: PLOT_COLORS[3], xs: [0, 36], ys: [st.mec, st.mec] },
          { name: 'MTC', color: PLOT_COLORS[2], xs: [0, 36], ys: [st.mtc, st.mtc] },
        ],
      };
      renderKpis(kpis, [
        { lbl: 'Yarı Ömür t₁/₂', val: `${fmtFix(r.halfLife, 2)} sa`, tone: 'acc' },
        { lbl: 'C_maks @ T_maks', val: `${fmtFix(r.cmax, 2)} mg/L`, sub: `T_maks = ${fmtFix(r.tmax, 2)} sa`, tone: 'ok' },
        { lbl: 'AUC₀→∞', val: `${fmtFix(r.auc, 1)} mg·sa/L`, sub: `CL = ${fmtFix(r.CL, 2)} L/sa` },
      ]);
    }
    drawPlot();
  }

  host.querySelector('[data-comp]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-c]'); if (!b) return;
    st.comp = +b.dataset.c;
    host.querySelectorAll('[data-comp] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  host.querySelector('[data-route]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-r]'); if (!b) return;
    st.route = b.dataset.r;
    host.querySelectorAll('[data-route] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  attachReadout(cv, host.querySelector('[data-rd]'), (x, s, i) => `t=${fmtFix(x, 1)} sa · C=${fmtFix(s[0].ys[i], 2)} mg/L`, clean);
  observeResize(host.querySelector('[data-box]'), drawPlot, clean);
  bindPresets(host, presets, p => {
    st.comp = p.comp; st.route = p.route; st.multi = p.multi; st.dose = p.dose; st.load = p.load; st.tau = p.tau; st.Vd = p.Vd; st.ke = p.ke; st.ka = p.ka;
    tMulti.set(st.multi); sDose.set(st.dose); sLoad.set(st.load); sTau.set(st.tau); sVd.set(st.Vd); sKe.set(st.ke); sKa.set(st.ka);
    host.querySelectorAll('[data-comp] button').forEach(x => x.classList.toggle('on', +x.dataset.c === st.comp));
    host.querySelectorAll('[data-route] button').forEach(x => x.classList.toggle('on', x.dataset.r === st.route));
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 3.3 SİNİR HÜCRESİ (Hodgkin-Huxley & FitzHugh-Nagumo Faz Düzlemi)
function mountNeuron(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'H-H Sürekli Ateşleme (10 µA/cm²)', tab: 'hh', I: 10, dur: 35, p2Del: 0, p2Amp: 0, gNa: 1, gK: 1 },
    { label: 'Refrakter Periyot Testi (Çift Darbe)', tab: 'hh', I: 15, dur: 2, p2Del: 7, p2Amp: 15, gNa: 1, gK: 1 },
    { label: 'TTX (Na⁺ Kanal Blokajı)', tab: 'hh', I: 15, dur: 35, p2Del: 0, p2Amp: 0, gNa: 0, gK: 1 },
    { label: 'FitzHugh-Nagumo Limit Çevrimi', tab: 'fhn', fhnI: 0.5 },
  ];
  const st = {
    tab: 'hh', I: 10, dur: 35, p2Del: 0, p2Amp: 15, gNa: 1, gK: 1,
    fhnI: 0.5, fhnA: 0.7, fhnB: 0.8, fhnV0: -1.1, fhnW0: -0.5,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Hodgkin–Huxley (1952)** 4-denklemli nöron modelinde aksiyon potansiyeli, $m, h, n$ kapı değişkenleri ve **mutlak/göreli refrakter periyodu** gözle; **FitzHugh–Nagumo** faz düzlemine dokunarak yörüngeler başlat.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="hh" class="on">Hodgkin–Huxley (V, m, h, n)</button>
        <button type="button" data-t="fhn">FitzHugh–Nagumo Faz Düzlemi</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-col" data-hhbox>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">Zar Potansiyeli V(t) (mV)</h4></div>
            <div class="slp-cv-box" data-vb><canvas class="slp-cv" data-vcv aria-label="Hodgkin-Huxley zar potansiyeli"></canvas><div class="slp-readout mono" data-vrd></div></div>
          </div>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">İyon Kanalı Kapı Değişkenleri (m, h, n)</h4><div class="slp-legend"><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[1]}"></i>m (Na⁺ açılma)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[2]}"></i>h (Na⁺ inaktivasyon)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[3]}"></i>n (K⁺ açılma)</span></div></div>
            <div class="slp-cv-box"><canvas class="slp-cv" data-gcv aria-label="Hodgkin-Huxley kapı değişkenleri"></canvas></div>
          </div>
        </div>
        <div class="slp-plot-card" data-fhnbox hidden>
          <div class="slp-head"><h4 class="slp-title">FitzHugh–Nagumo (v, w) Faz Portresi & Sıfır-Eğriler</h4><span class="slp-hint">Tuvale dokun: yeni başlangıç koşulu</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv slp-cv-tap" data-fhncv aria-label="FitzHugh-Nagumo faz düzlemi"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'C_m \\frac{dV}{dt} = I_{\\text{inj}} - \\bar{g}_{\\text{Na}} m^3 h (V - E_{\\text{Na}}) - \\bar{g}_{\\text{K}} n^4 (V - E_{\\text{K}}) - g_L(V - E_L)',
        '\\dot{v} = v - \\frac{v^3}{3} - w + I, \\qquad \\tau\\dot{w} = v + a - bw \\quad (\\text{FitzHugh–Nagumo})',
      ],
      paragraphs: [
        'Eşik akım aşıldığında hızlı $m$ kapısı açılarak $Na^+$ akışıyla depolarizasyon (+35 mV) başlatır; ardından $h$ kapısı kapanır (inaktivasyon) ve yavaş $n$ kapısı açılarak $K^+$ çıkışıyla repolarizasyon ve hiperpolarizasyon gerçekleşir.',
        '$h$ kapısı kapalı kaldığı sürece nöron ikinci bir uyarıya yanıt veremez (**mutlak refrakter periyot**); **TTX** (tetrodotoksin) $Na^+$ kanallarını bloke ederek aksiyon potansiyelini tamamen susturur.',
      ],
      tasks: [
        '**Refrakter Periyot** senaryosunda 2. darbe gecikmesini 5 ms’den 14 ms’ye artırarak 2. aksiyon potansiyelinin ne zaman doğduğunu bul.',
        'FitzHugh–Nagumo faz düzleminde akımı $I=0.1$ (uyarılabilir) ve $I=0.5$ (kendiliğinden salınan limit çevrimi) olarak karşılaştır.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const vcv = host.querySelector('[data-vcv]'), gcv = host.querySelector('[data-gcv]'), fhnEl = host.querySelector('[data-fhncv]');

  const sI = addSlider(ctrls, { label: 'Enjekte Akım I', unit: 'µA/cm²', min: 0, max: 30, step: 0.5, value: st.I, fmt: v => `${fmtFix(v, 1)} µA/cm²`, onInput: v => { st.I = v; update(); } });
  const sDur = addSlider(ctrls, { label: '1. Darbe Süresi', unit: 'ms', min: 1, max: 40, step: 1, value: st.dur, fmt: v => `${Math.round(v)} ms`, onInput: v => { st.dur = v; update(); } });
  const sP2 = addSlider(ctrls, { label: '2. Darbe Gecikmesi (0=kapalı)', unit: 'ms', min: 0, max: 25, step: 1, value: st.p2Del, fmt: v => v > 0 ? `${Math.round(v)} ms` : 'Kapalı', onInput: v => { st.p2Del = v; update(); } });
  const sNa = addSlider(ctrls, { label: 'Na⁺ İletkenliği (TTX=0)', min: 0, max: 1.5, step: 0.1, value: st.gNa, fmt: v => `${Math.round(v * 100)}%`, onInput: v => { st.gNa = v; update(); } });
  const sK = addSlider(ctrls, { label: 'K⁺ İletkenliği (TEA=0)', min: 0, max: 1.5, step: 0.1, value: st.gK, fmt: v => `${Math.round(v * 100)}%`, onInput: v => { st.gK = v; update(); } });
  const sFhnI = addSlider(ctrls, { label: 'FHN Uyarı Akımı I', min: 0, max: 1.2, step: 0.05, value: st.fhnI, fmt: v => fmtFix(v, 2), onInput: v => { st.fhnI = v; update(); } });

  let hhRes = null, fhnRes = null;
  const fhnCv = setupCanvas(fhnEl, () => 310, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!fhnRes) return;
    const toPx = (v, w) => [36 + ((v + 2.5) / 5) * (W - 56), H - 28 - ((w + 1.5) / 3.5) * (H - 48)];
    // Vector field
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1;
    for (let vi = -2.2; vi <= 2.2; vi += 0.45) {
      for (let wi = -1.2; wi <= 1.7; wi += 0.35) {
        const dv = vi - (vi ** 3) / 3 - wi + st.fhnI, dw = (vi + st.fhnA - st.fhnB * wi) / 12.5;
        const m = Math.hypot(dv, dw) || 1;
        const [x, y] = toPx(vi, wi);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (dv / m) * 9, y - (dw / m) * 9); c.stroke();
      }
    }
    const nul = fhnNullclines({ a: st.fhnA, b: st.fhnB, I: st.fhnI });
    c.strokeStyle = COL_WARN; c.lineWidth = 1.8; c.beginPath();
    nul.vs.forEach((v, i) => { const [x, y] = toPx(v, nul.wV[i]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.stroke();
    c.strokeStyle = COL_BLUE; c.lineWidth = 1.8; c.beginPath();
    nul.vs.forEach((v, i) => { const [x, y] = toPx(v, nul.wW[i]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.stroke();
    // Trajectory
    c.strokeStyle = COL_OK; c.lineWidth = 2.4; c.beginPath();
    fhnRes.v.forEach((v, i) => { const [x, y] = toPx(v, fhnRes.w[i]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.stroke();
    const [sx, sy] = toPx(st.fhnV0, st.fhnW0);
    c.beginPath(); c.arc(sx, sy, 5.5, 0, Math.PI * 2); c.fillStyle = COL_BAD; c.fill();
  }, clean);

  fhnEl.addEventListener('pointerdown', e => {
    const [px, py] = canvasPos(fhnEl, e);
    const { W, H } = fhnCv.size();
    st.fhnV0 = ((px - 36) / (W - 56)) * 5 - 2.5;
    st.fhnW0 = ((H - 28 - py) / (H - 48)) * 3.5 - 1.5;
    update();
  });

  function drawHH() {
    if (!hhRes || st.tab !== 'hh') return;
    safePlot(vcv, [{ name: 'V(t)', color: PLOT_COLORS[0], xs: hhRes.t, ys: hhRes.V }], { x0: 0, x1: 50, ylabel: 'mV', height: 195 });
    safePlot(gcv, [
      { name: 'm', color: PLOT_COLORS[1], xs: hhRes.t, ys: hhRes.m },
      { name: 'h', color: PLOT_COLORS[2], xs: hhRes.t, ys: hhRes.h },
      { name: 'n', color: PLOT_COLORS[3], xs: hhRes.t, ys: hhRes.n },
    ], { x0: 0, x1: 50, ylabel: '0–1', height: 170 });
  }

  function update() {
    const isHH = st.tab === 'hh';
    host.querySelector('[data-hhbox]').hidden = !isHH;
    host.querySelector('[data-fhnbox]').hidden = isHH;
    sI.setVisible(isHH); sDur.setVisible(isHH); sP2.setVisible(isHH); sNa.setVisible(isHH); sK.setVisible(isHH); sFhnI.setVisible(!isHH);

    if (isHH) {
      hhRes = simulateHodgkinHuxley({ Iinj: st.I, tPulseStart: 5, tPulseDur: st.dur, pulse2Delay: st.p2Del, pulse2Amp: st.p2Del > 0 ? st.p2Amp : 0, gNaScale: st.gNa, gKScale: st.gK, tEnd: 50 });
      renderKpis(kpis, [
        { lbl: 'Aksiyon Potansiyeli', val: `${hhRes.spikeCount} atım`, tone: hhRes.spikeCount > 0 ? 'ok' : 'warn' },
        { lbl: 'Tepe / Dip Potansiyel', val: `${fmtFix(hhRes.peakV, 1)} / ${fmtFix(hhRes.minV, 1)} mV`, tone: 'acc' },
        { lbl: 'Ateşleme Frekansı', val: hhRes.firingHz > 0 ? `${fmtFix(hhRes.firingHz, 1)} Hz` : 'Tek / Yok' },
      ]);
      drawHH();
    } else {
      fhnRes = simulateFHN({ v0: st.fhnV0, w0: st.fhnW0, a: st.fhnA, b: st.fhnB, I: st.fhnI, tEnd: 100 });
      const amp = Math.max(...fhnRes.v) - Math.min(...fhnRes.v);
      renderKpis(kpis, [
        { lbl: 'Uyarı Akımı I', val: fmtFix(st.fhnI, 2), tone: 'acc' },
        { lbl: 'Başlangıç (v₀, w₀)', val: `(${fmtFix(st.fhnV0, 2)}, ${fmtFix(st.fhnW0, 2)})` },
        { lbl: 'Dinamik Rejim', val: amp > 2.2 && st.fhnI >= 0.32 ? 'Limit Çevrimi (Salınım)' : 'Uyarılabilir / Kararlı', tone: 'ok' },
      ]);
      fhnCv.resize();
    }
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  attachReadout(vcv, host.querySelector('[data-vrd]'), (x, s, i) => `t=${fmtFix(x, 1)} ms · V=${fmtFix(s[0].ys[i], 1)} mV`, clean);
  observeResize(host.querySelector('[data-vb]'), drawHH, clean);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.tab === 'hh') {
      st.I = p.I; st.dur = p.dur; st.p2Del = p.p2Del; st.p2Amp = p.p2Amp || 15; st.gNa = p.gNa; st.gK = p.gK;
      sI.set(st.I); sDur.set(st.dur); sP2.set(st.p2Del); sNa.set(st.gNa); sK.set(st.gK);
    } else {
      st.fhnI = p.fhnI; sFhnI.set(st.fhnI);
    }
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 3.4 SALGIN MODELLERİ (SIR / SEIR, R0, Sürü Bağışıklığı)
function mountEpidemic(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Mevsimsel Grip (R₀ = 2.0)', model: 'SIR', beta: 0.28, gamma: 0.14, sigma: 0.25, vacc: 0, interv: 1.0 },
    { label: 'Kızamık Benzeri (R₀ = 6.0)', model: 'SEIR', beta: 0.60, gamma: 0.10, sigma: 0.12, vacc: 0, interv: 1.0 },
    { label: 'Aşıyla Sürü Bağışıklığı', model: 'SIR', beta: 0.35, gamma: 0.10, sigma: 0.2, vacc: 0.74, interv: 1.0 },
    { label: 'Eğriyi Düzleştirme (Müdahale)', model: 'SEIR', beta: 0.45, gamma: 0.10, sigma: 0.2, vacc: 0.1, interv: 0.45 },
  ];
  const st = { model: 'SIR', beta: 0.35, gamma: 0.10, sigma: 0.20, vacc: 0, intervDay: 25, intervFactor: 1.0 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**SIR** ve kuluçka dönemli **SEIR** kompartman modellerinde temel üreme sayısı $R_0 = \\beta/\\gamma$, aşılama oranı ve **sürü bağışıklığı eşiği** $p_c = 1 - 1/R_0$ etkisini incele.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-em>
        <button type="button" data-m="SIR" class="on">SIR Modeli</button>
        <button type="button" data-m="SEIR">SEIR (Kuluçka E)</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title">Nüfus Oranları S(t), E(t), I(t), R(t)</h4><div class="slp-legend"><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[1]}"></i>S (Duyarlı)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[4]}"></i>E (Kuluçka)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[2]}"></i>I (Enfekte)</span><span class="slp-legend-item"><i class="slp-legend-swatch" style="background:${PLOT_COLORS[3]}"></i>R (Bağışık)</span></div></div>
          <div class="slp-cv-box" data-box><canvas class="slp-cv" data-cv aria-label="SIR/SEIR salgın eğrileri"></canvas><div class="slp-readout mono" data-rd></div></div>
          <div class="slp-axis-lbl mono">Zaman (gün)</div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{dS}{dt} = -\\beta S I, \\quad \\frac{dE}{dt} = \\beta S I - \\sigma E, \\quad \\frac{dI}{dt} = \\sigma E - \\gamma I, \\quad \\frac{dR}{dt} = \\gamma I',
        'R_0 = \\frac{\\beta}{\\gamma}, \\qquad p_c = 1 - \\frac{1}{R_0} \\quad (\\text{Sürü Bağışıklığı Eşiği})',
      ],
      paragraphs: [
        'Etkin üreme sayısı $R_{\\text{etk}}(t) = R_0 S(t) > 1$ olduğu sürece aktif vaka sayısı $I(t)$ artar; $S(t) = 1/R_0$ noktasında salgın tepe yapar ve düşüşe geçer.',
        'Başlangıçta nüfusun $p \\ge 1 - 1/R_0$ kesimi aşılanırsa $R_{\\text{etk}}(0) \\le 1$ olur ve salgın büyümeden söner.',
      ],
      tasks: [
        '$R_0 = 3.5$ için sürü bağışıklığı eşiğini hesapla ($\\approx \\%71.4$) ve aşılama sürgüsünü bu eşiği geçecek şekilde artırıp $I(t)$’nin sönüşünü izle.',
        'Müdahale çarpanını %50’ye çekerek enfekte zirvesinin düşüşünü ve gecikmesini ("eğriyi düzleştirme") gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cv = host.querySelector('[data-cv]');
  const sBeta = addSlider(ctrls, { label: 'Bulaşma Hızı β', unit: '/gün', min: 0.05, max: 0.9, step: 0.01, value: st.beta, fmt: v => fmtFix(v, 2), onInput: v => { st.beta = v; update(); } });
  const sGam = addSlider(ctrls, { label: 'İyileşme Hızı γ', unit: '/gün', min: 0.04, max: 0.35, step: 0.01, value: st.gamma, fmt: v => `${fmtFix(v, 2)} (${fmtFix(1 / v, 1)}g)`, onInput: v => { st.gamma = v; update(); } });
  const sSig = addSlider(ctrls, { label: 'Kuluçka Çıkış σ (SEIR)', unit: '/gün', min: 0.05, max: 0.5, step: 0.01, value: st.sigma, fmt: v => `${fmtFix(v, 2)} (${fmtFix(1 / v, 1)}g)`, onInput: v => { st.sigma = v; update(); } });
  const sVacc = addSlider(ctrls, { label: 'Başlangıç Aşılama p', min: 0, max: 0.92, step: 0.02, value: st.vacc, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.vacc = v; update(); } });
  const sInt = addSlider(ctrls, { label: '25. Gün Müdahale Çarpanı', min: 0.25, max: 1.0, step: 0.05, value: st.intervFactor, fmt: v => `%${Math.round(v * 100)} β`, onInput: v => { st.intervFactor = v; update(); } });

  let res = null;
  function drawPlot() {
    if (!res) return;
    const series = [
      { name: 'S', color: PLOT_COLORS[1], xs: res.t, ys: res.S.map(v => v * 100) },
      { name: 'I', color: PLOT_COLORS[2], xs: res.t, ys: res.I.map(v => v * 100) },
      { name: 'R', color: PLOT_COLORS[3], xs: res.t, ys: res.R.map(v => v * 100) },
    ];
    if (st.model === 'SEIR') series.splice(1, 0, { name: 'E', color: PLOT_COLORS[4], xs: res.t, ys: res.E.map(v => v * 100) });
    safePlot(cv, series, { x0: 0, x1: 160, ylabel: '% Nüfus', height: 245 });
  }

  function update() {
    sSig.setVisible(st.model === 'SEIR');
    res = simulateEpidemic({ model: st.model, beta: st.beta, gamma: st.gamma, sigma: st.sigma, vaccFrac: st.vacc, I0: 0.01, tEnd: 160, intervDay: st.intervDay, intervFactor: st.intervFactor });
    const protectedOk = st.vacc >= res.herdThreshold;
    renderKpis(kpis, [
      { lbl: 'Temel Üreme R₀', val: fmtFix(res.R0, 2), sub: `R_etk(0) = ${fmtFix(res.Reff[0], 2)}`, tone: res.Reff[0] <= 1 ? 'ok' : 'warn' },
      { lbl: 'Sürü Bağışıklığı p_c', val: `%${fmtFix(res.herdThreshold * 100, 1)}`, sub: protectedOk ? '✓ Eşik aşıldı' : 'Eşik altında', tone: protectedOk ? 'ok' : 'acc' },
      { lbl: 'Zirve Enfekte I_maks', val: `%${fmtFix(res.peakI * 100, 1)}`, sub: `${fmtFix(res.peakDay, 0)}. gün`, tone: res.peakI > 0.25 ? 'bad' : 'ok' },
      { lbl: 'Toplam Enfekte Oranı', val: `%${fmtFix(res.finalAttackRate * 100, 1)}` },
    ]);
    drawPlot();
  }

  host.querySelector('[data-em]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-m]'); if (!b) return;
    st.model = b.dataset.m;
    host.querySelectorAll('[data-em] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  attachReadout(cv, host.querySelector('[data-rd]'), (x, s, i) => `Gün ${fmtFix(x, 0)} · I=${fmtFix(s[st.model === 'SEIR' ? 2 : 1].ys[i], 1)}%`, clean);
  observeResize(host.querySelector('[data-box]'), drawPlot, clean);
  bindPresets(host, presets, p => {
    st.model = p.model; st.beta = p.beta; st.gamma = p.gamma; st.sigma = p.sigma; st.vacc = p.vacc; st.intervFactor = p.interv;
    sBeta.set(st.beta); sGam.set(st.gamma); sSig.set(st.sigma); sVacc.set(st.vacc); sInt.set(st.intervFactor);
    host.querySelectorAll('[data-em] button').forEach(x => x.classList.toggle('on', x.dataset.m === st.model));
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 3.5 KARDİYOVASKÜLER AKIŞ (Windkessel & Poiseuille Daralma)
function mountCardio(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Sağlıklı Genç (120/80)', tab: 'wk', elements: 3, R: 1.05, C: 1.6, Zc: 0.06, hr: 72, sv: 72 },
    { label: 'Hipertansiyon (Yüksek R)', tab: 'wk', elements: 3, R: 1.55, C: 1.4, Zc: 0.07, hr: 76, sv: 70 },
    { label: 'Damar Sertliği (Düşük C)', tab: 'wk', elements: 3, R: 1.10, C: 0.55, Zc: 0.11, hr: 72, sv: 70 },
    { label: 'Poiseuille %50 Daralma (Stenoz)', tab: 'pois', sten: 50, rMm: 2.0, dP: 10 },
  ];
  const st = { tab: 'wk', elements: 3, R: 1.05, C: 1.6, Zc: 0.06, hr: 72, sv: 72, rMm: 2.0, dP: 10, visc: 3.5, sten: 40, flowT: 0, playing: autoPlayAllowed() };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**2/3-Elemanlı Windkessel** arteriyel basınç modelinde direnç $R$ ve kompliyans $C$ etkilerini incele; **Poiseuille Akışı & Damar Daralması (Stenoz)** modunda $r^4$ yasasının debiyi nasıl çökerttiğini canlı izle.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="wk" class="on">Windkessel Basınç</button>
        <button type="button" data-t="pois">Poiseuille & Stenoz</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card" data-wkbox>
          <div class="slp-head"><h4 class="slp-title">Aort Basıncı P(t) (mmHg) ve Sistolik Debi</h4></div>
          <div class="slp-cv-box" data-wkb><canvas class="slp-cv" data-wkcv aria-label="Windkessel aort basıncı grafiği"></canvas><div class="slp-readout mono" data-wkrd></div></div>
        </div>
        <div class="slp-plot-card" data-pbox hidden>
          <div class="slp-head"><h4 class="slp-title">Daralmış Damar Akışı & Parabolik Hız Profili</h4></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-pcv aria-label="Poiseuille daralmış damar kan akışı"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'C \\frac{dP_w}{dt} + \\frac{P_w}{R} = Q(t), \\qquad P_a(t) = P_w(t) + Z_c Q(t) \\quad (\\text{3-Elemanlı Windkessel})',
        'Q = \\frac{\\pi \\Delta P r^4}{8 \\mu L} \\implies r \\to \\frac{r}{2} \\text{ olduğunda direnç } 16\\times \\text{ artar!}',
      ],
      paragraphs: [
        'Büyük arterler sistolde esneyerek kan depolar, diyastolde geri kasılıp akışı sürdürür (**Windkessel etkisi**). Damar sertliğinde kompliyans $C$ azalır, sistolik basınç yükselip diyastolik düşer ve **nabız basıncı** genişler.',
        'Hagen–Poiseuille yasasına göre laminer direnç yarıçapın **dördüncü kuvvetiyle** ($1/r^4$) ters orantılıdır; arter çapının %50 daralması akış direncini yerel olarak 16 katına çıkarır.',
      ],
      tasks: [
        'Windkessel’de Damar Sertliği senaryosuna geçip nabız basıncının ($P_{\\text{sis}} - P_{\\text{diy}}$) nasıl arttığını gör.',
        'Poiseuille modunda daralma oranını %0’dan %60’a çıkararak debinin dramatik düşüşünü ve dar bölgedeki duvar kayma gerilmesini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const wkcv = host.querySelector('[data-wkcv]');
  const selEl = addSelect(ctrls, 'Windkessel Modeli', [['3', '3-Elemanlı (R, C, Z_c)'], ['2', '2-Elemanlı (R, C)']], '3', v => { st.elements = +v; update(); });
  const sR = addSlider(ctrls, { label: 'Periferik Direnç R', unit: 'mmHg·s/mL', min: 0.6, max: 2.0, step: 0.05, value: st.R, fmt: v => fmtFix(v, 2), onInput: v => { st.R = v; update(); } });
  const sC = addSlider(ctrls, { label: 'Arteriyel Kompliyans C', unit: 'mL/mmHg', min: 0.4, max: 3.0, step: 0.05, value: st.C, fmt: v => fmtFix(v, 2), onInput: v => { st.C = v; update(); } });
  const sHR = addSlider(ctrls, { label: 'Kalp Hızı', unit: 'BPM', min: 45, max: 140, step: 2, value: st.hr, fmt: v => `${Math.round(v)} BPM`, onInput: v => { st.hr = v; update(); } });
  const sSV = addSlider(ctrls, { label: 'Atım Hacmi (SV)', unit: 'mL', min: 40, max: 110, step: 2, value: st.sv, fmt: v => `${Math.round(v)} mL`, onInput: v => { st.sv = v; update(); } });

  const sRad = addSlider(ctrls, { label: 'Normal Damar Yarıçapı r₀', unit: 'mm', min: 0.8, max: 5.0, step: 0.1, value: st.rMm, fmt: v => `${fmtFix(v, 1)} mm`, onInput: v => { st.rMm = v; update(); } });
  const sSten = addSlider(ctrls, { label: 'Çap Daralması (Stenoz)', unit: '%', min: 0, max: 78, step: 2, value: st.sten, fmt: v => `%${Math.round(v)}`, onInput: v => { st.sten = v; update(); } });
  const sDP = addSlider(ctrls, { label: 'Basınç Farkı ΔP', unit: 'mmHg', min: 2, max: 30, step: 1, value: st.dP, fmt: v => `${Math.round(v)} mmHg`, onInput: v => { st.dP = v; update(); } });

  let wkRes = null, pRes = null;
  const pCv = setupCanvas(host.querySelector('[data-pcv]'), () => 230, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!pRes) return;
    const cy = H / 2, rPx = Math.min(58, H * 0.28);
    const sFrac = st.sten / 100;
    const wallAt = x => {
      const u = (x - W / 2) / (W * 0.17);
      const bulge = sFrac * Math.exp(-u * u);
      return rPx * (1 - bulge);
    };
    // Vessel walls + plaque
    c.fillStyle = 'rgba(255,209,102,0.28)';
    c.beginPath(); c.moveTo(16, cy - rPx);
    for (let x = 16; x <= W - 16; x += 6) c.lineTo(x, cy - wallAt(x));
    c.lineTo(W - 16, cy - rPx); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(16, cy + rPx);
    for (let x = 16; x <= W - 16; x += 6) c.lineTo(x, cy + wallAt(x));
    c.lineTo(W - 16, cy + rPx); c.closePath(); c.fill();

    c.strokeStyle = COL_BAD; c.lineWidth = 2.4;
    c.beginPath(); for (let x = 16; x <= W - 16; x += 6) { const y = cy - wallAt(x); if (x === 16) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    c.beginPath(); for (let x = 16; x <= W - 16; x += 6) { const y = cy + wallAt(x); if (x === 16) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();

    // Animated red blood cells speeding up in stenosis
    for (let k = 0; k < 28; k++) {
      const lane = ((k % 7) - 3) / 3.4;
      const vFac = (1 - lane * lane * 0.85) * Math.max(0.12, pRes.flowRatio);
      const basePos = ((k * 0.137 + st.flowT * 0.45 * vFac) % 1);
      const x = 20 + basePos * (W - 40);
      const y = cy + lane * (wallAt(x) - 5);
      c.beginPath(); c.ellipse(x, y, 5.5, 3.2, 0, 0, Math.PI * 2);
      c.fillStyle = COL_BAD; c.fill();
    }
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (st.tab !== 'pois') return false;
    st.flowT += dt;
    pCv.render();
    return true;
  }, clean);

  function drawWK() {
    if (!wkRes || st.tab !== 'wk') return;
    safePlot(wkcv, [
      { name: 'P_aort (mmHg)', color: PLOT_COLORS[2], xs: wkRes.t, ys: wkRes.P },
      { name: 'Q/4 (mL/s)', color: PLOT_COLORS[1], xs: wkRes.t, ys: wkRes.Q.map(q => q / 4) },
    ], { x0: 0, x1: wkRes.t.at(-1), ylabel: 'mmHg', height: 245 });
  }

  function update() {
    const isWK = st.tab === 'wk';
    host.querySelector('[data-wkbox]').hidden = !isWK;
    host.querySelector('[data-pbox]').hidden = isWK;
    [selEl, sR, sC, sHR, sSV].forEach(x => x.setVisible(isWK));
    [sRad, sSten, sDP].forEach(x => x.setVisible(!isWK));

    if (isWK) {
      loop.stop();
      wkRes = simulateWindkessel({ elements: st.elements, R: st.R, C: st.C, Zc: st.Zc, hr: st.hr, strokeVolMl: st.sv });
      renderKpis(kpis, [
        { lbl: 'Sistolik / Diyastolik', val: `${Math.round(wkRes.Psystolic)} / ${Math.round(wkRes.Pdiastolic)} mmHg`, tone: wkRes.Psystolic > 140 ? 'bad' : 'ok' },
        { lbl: 'Ortalama Basınç (MAP)', val: `${Math.round(wkRes.MAP)} mmHg`, tone: 'acc' },
        { lbl: 'Nabız Basıncı (PP)', val: `${Math.round(wkRes.pulsePressure)} mmHg`, sub: `CO = ${fmtFix(wkRes.cardiacOutputLMin, 2)} L/dk` },
      ]);
      drawWK();
    } else {
      pRes = solvePoiseuilleStenosis({ radiusMm: st.rMm, dP_mmHg: st.dP, viscosityCP: st.visc, stenosisPct: st.sten, stenLenFrac: 0.35 });
      renderKpis(kpis, [
        { lbl: 'Kalan Akış Oranı', val: `%${fmtFix(pRes.flowRatio * 100, 1)}`, sub: `${fmtFix(pRes.Q_mlMin, 1)} mL/dk`, tone: pRes.flowRatio < 0.35 ? 'bad' : 'ok' },
        { lbl: 'Direnç Artışı', val: `${fmtFix(pRes.R_ratio, 2)}×`, tone: 'acc' },
        { lbl: 'Dar Bölge Tepe Hız', val: `${fmtFix(pRes.vStenMax, 2)} m/s`, sub: `Re = ${Math.round(pRes.Re)}` },
        { lbl: 'Duvar Kayma Gerilmesi', val: `${fmtFix(pRes.wallShearPa, 1)} Pa` },
      ]);
      pCv.resize();
      if (autoPlayAllowed()) loop.start();
    }
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  attachReadout(wkcv, host.querySelector('[data-wkrd]'), (x, s, i) => `t=${fmtFix(x, 2)} s · P=${fmtFix(s[0].ys[i], 1)} mmHg`, clean);
  observeResize(host.querySelector('[data-wkb]'), drawWK, clean);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.tab === 'wk') {
      st.elements = p.elements; st.R = p.R; st.C = p.C; st.Zc = p.Zc; st.hr = p.hr; st.sv = p.sv;
      selEl.set(String(st.elements)); sR.set(st.R); sC.set(st.C); sHR.set(st.hr); sSV.set(st.sv);
    } else {
      st.sten = p.sten; st.rMm = p.rMm; st.dP = p.dP;
      sSten.set(st.sten); sRad.set(st.rMm); sDP.set(st.dP);
    }
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 3.6 BİYOMEKANİK & KAS (Kuvvet-Uzunluk, Hill Kuvvet-Hız, Dirsek Torku)
function mountBiomechanics(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Dirsek 90° · 5 kg Dambıl', tab: 'elbow', theta: 90, load: 5, db: 4.5 },
    { label: 'Dirsek 45° · 10 kg Ağır Yük', tab: 'elbow', theta: 45, load: 10, db: 4.5 },
    { label: 'Hill Kas Gücü (Hızlı Kasılma)', tab: 'muscle', F0: 1200, vmax: 4.0, aR: 0.25, lNorm: 1.0 },
  ];
  const st = { tab: 'elbow', theta: 90, load: 5, armKg: 1.8, dbCm: 4.5, F0: 1000, vmax: 3.0, aR: 0.25, lNorm: 1.0 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Dirsek ekleminde** eldeki ağırlığı tutan biseps kası kuvvetini ve eklem tepkisini canlı kol diyagramında (ön kolu sürükleyerek!) incele; **Kas Kuvvet–Uzunluk** ve **Hill Kuvvet–Hız** eğrilerini keşfet.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="elbow" class="on">Dirsek Eklemi & Tork</button>
        <button type="button" data-t="muscle">Kas Kuvvet–Uzunluk & Hill</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card" data-ebox>
          <div class="slp-head"><h4 class="slp-title">Dirsek Kaldıraç Diyagramı (3. Sınıf Kaldıraç)</h4><span class="slp-hint">Eldeki yükü sürükleyip açıyı değiştir</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv slp-cv-drag" data-ecv aria-label="Dirsek biyomekaniği kaldıraç diyagramı"></canvas></div>
        </div>
        <div class="slp-grid-2" data-mbox hidden>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">Kuvvet–Uzunluk (Aktif / Pasif / Toplam)</h4></div>
            <div class="slp-cv-box" data-flb><canvas class="slp-cv" data-flcv aria-label="Kas kuvvet uzunluk eğrisi"></canvas></div>
          </div>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">Hill Kuvvet–Hız & Mekanik Güç</h4></div>
            <div class="slp-cv-box"><canvas class="slp-cv" data-hvcv aria-label="Hill kuvvet hız ve güç eğrisi"></canvas></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '(F + a)(v + b) = (F_0 + a)b, \\qquad P(v) = F(v) \\cdot v \\quad (\\text{Hill Denklemi})',
        'F_{\\text{biseps}} \\cdot d_b \\sin\\alpha = (m_{\\text{yük}} g L + m_{\\text{kol}} g d_{\\text{kütle}}) \\sin\\theta',
      ],
      paragraphs: [
        'İnsan dirseği **3. sınıf kaldıraç** olarak çalışır: biseps tendonu dirsekten yalnızca ~4.5 cm uzağa tutunurken yük ~34 cm uçtadır. Bu küçük mekanik avantaj ($MA \\approx 0.13$) yüksek el hızı sağlarken, 5 kg yük için biseps kasında ~400 N üzerinde gerilme yaratır.',
        '**Hill hiperbolüne** göre kasın izometrik kuvveti $v=0$’da en büyüktür ($F_0$), mekanik güç $P = Fv$ ise yaklaşık $v \\approx 0.3\\,v_{\\max}$ hızında maksimuma ulaşır.',
      ],
      tasks: [
        'Dirsek açısını $90^\\circ$’den $30^\\circ$’ye indirerek biseps kuvvetinin $\\sin\\theta$ ile nasıl azaldığını gözle.',
        'Hill eğrisinde maksimum gücün $v \\approx 0.3\\,v_{\\max}$ civarında oluştuğunu doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const ecvEl = host.querySelector('[data-ecv]'), flcv = host.querySelector('[data-flcv]'), hvcv = host.querySelector('[data-hvcv]');

  const sTh = addSlider(ctrls, { label: 'Ön Kol Açısı θ', unit: '°', min: 15, max: 135, step: 1, value: st.theta, fmt: v => `${Math.round(v)}°`, onInput: v => { st.theta = v; update(); } });
  const sLd = addSlider(ctrls, { label: 'Eldeki Yük kütlesi', unit: 'kg', min: 0, max: 20, step: 0.5, value: st.load, fmt: v => `${fmtFix(v, 1)} kg`, onInput: v => { st.load = v; update(); } });
  const sDb = addSlider(ctrls, { label: 'Biseps Tutunma d_b', unit: 'cm', min: 3.0, max: 7.0, step: 0.2, value: st.dbCm, fmt: v => `${fmtFix(v, 1)} cm`, onInput: v => { st.dbCm = v; update(); } });
  const sF0 = addSlider(ctrls, { label: 'Maks İzometrik F₀', unit: 'N', min: 400, max: 2000, step: 50, value: st.F0, fmt: v => `${Math.round(v)} N`, onInput: v => { st.F0 = v; update(); } });
  const sVm = addSlider(ctrls, { label: 'Maks Kasılma Hızı v_max', unit: 'L₀/s', min: 1.0, max: 6.0, step: 0.2, value: st.vmax, fmt: v => `${fmtFix(v, 1)} L₀/s`, onInput: v => { st.vmax = v; update(); } });
  const sLn = addSlider(ctrls, { label: 'Sarkomer Uzunluğu L/L₀', min: 0.5, max: 1.6, step: 0.02, value: st.lNorm, fmt: v => fmtFix(v, 2), onInput: v => { st.lNorm = v; update(); } });

  let elSol = null, dragging = false;
  const eCv = setupCanvas(ecvEl, () => 260, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!elSol) return;
    const ex = W * 0.34, ey = H * 0.62, sc = Math.min(W, H) * 1.15;
    const rad = (st.theta * Math.PI) / 180;
    const shX = ex, shY = ey - 0.30 * sc;
    const handX = ex + 0.34 * sc * Math.sin(rad), handY = ey + 0.34 * sc * Math.cos(rad);
    const insX = ex + (st.dbCm / 100) * sc * Math.sin(rad), insY = ey + (st.dbCm / 100) * sc * Math.cos(rad);

    // Humerus & forearm bones
    c.strokeStyle = 'rgba(244,244,245,0.65)'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(shX, shY); c.lineTo(ex, ey); c.lineTo(handX, handY); c.stroke();
    // Biceps muscle line
    c.strokeStyle = COL_BAD; c.lineWidth = 4;
    c.beginPath(); c.moveTo(shX + 8, shY + 12); c.lineTo(insX, insY); c.stroke();
    // Elbow joint
    c.beginPath(); c.arc(ex, ey, 7, 0, Math.PI * 2); c.fillStyle = accentColor(); c.fill();
    // Load weight & gravity arrow
    c.beginPath(); c.arc(handX, handY, 11, 0, Math.PI * 2); c.fillStyle = COL_WARN; c.fill();
    drawArrow(c, handX, handY + 11, handX, handY + 48, COL_WARN, 2.2, 7);
    c.fillStyle = COL_WARN; c.font = '11px "JetBrains Mono", monospace';
    c.fillText(`${fmtFix(st.load, 1)} kg`, handX + 14, handY + 34);
    // Biceps force vector
    drawArrow(c, insX, insY, insX + elSol.pullDir[0] * 48, insY - elSol.pullDir[1] * 48, COL_OK, 2.4, 7);
    c.fillStyle = COL_OK; c.fillText(`F_b=${Math.round(elSol.Fbiceps)} N`, insX + 12, insY - 26);
  }, clean);

  ecvEl.addEventListener('pointerdown', e => { dragging = true; ecvEl.setPointerCapture?.(e.pointerId); });
  ecvEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const [px, py] = canvasPos(ecvEl, e);
    const { W, H } = eCv.size();
    const ang = (Math.atan2(px - W * 0.34, py - H * 0.62) * 180) / Math.PI;
    st.theta = Math.max(15, Math.min(135, Math.round(ang)));
    sTh.set(st.theta); update();
  });
  ecvEl.addEventListener('pointerup', () => { dragging = false; });

  function drawMusclePlots() {
    if (st.tab !== 'muscle') return;
    const ls = [], act = [], pas = [], tot = [];
    for (let i = 0; i <= 100; i++) {
      const l = 0.45 + 1.2 * (i / 100);
      const m = muscleForceLength(l);
      ls.push(l); act.push(m.active); pas.push(m.passive); tot.push(m.total);
    }
    safePlot(flcv, [
      { name: 'Toplam', color: PLOT_COLORS[0], xs: ls, ys: tot },
      { name: 'Aktif', color: PLOT_COLORS[1], xs: ls, ys: act },
      { name: 'Pasif', color: PLOT_COLORS[2], xs: ls, ys: pas },
    ], { x0: 0.45, x1: 1.65, ylabel: 'F / F₀', height: 215 });

    const hc = hillCurve({ F0: st.F0, vmax: st.vmax, aRatio: st.aR });
    const pScale = st.F0 / Math.max(1, hc.pMax);
    safePlot(hvcv, [
      { name: 'Kuvvet F(v)', color: PLOT_COLORS[1], xs: hc.vs, ys: hc.Fs },
      { name: 'Güç (ölçekli)', color: PLOT_COLORS[3], xs: hc.vs, ys: hc.Ps.map(p => p * pScale) },
    ], { x0: 0, x1: st.vmax, ylabel: 'N', height: 215 });
  }

  function update() {
    const isEl = st.tab === 'elbow';
    host.querySelector('[data-ebox]').hidden = !isEl;
    host.querySelector('[data-mbox]').hidden = isEl;
    [sTh, sLd, sDb].forEach(x => x.setVisible(isEl));
    [sF0, sVm, sLn].forEach(x => x.setVisible(!isEl));

    if (isEl) {
      elSol = solveElbowBiomechanics({ thetaDeg: st.theta, loadKg: st.load, forearmKg: st.armKg, dBiceps_m: st.dbCm / 100 });
      renderKpis(kpis, [
        { lbl: 'Biseps Kuvveti F_b', val: `${Math.round(elSol.Fbiceps)} N`, sub: `≈ ${fmtFix(elSol.Fbiceps / 9.81, 1)} kgf`, tone: 'acc' },
        { lbl: 'Toplam Eklem Torku', val: `${fmtFix(elSol.totalTorque, 2)} N·m` },
        { lbl: 'Eklem Tepkisi |R|', val: `${Math.round(elSol.Rmag)} N`, tone: 'warn' },
        { lbl: 'Mekanik Avantaj', val: fmtFix(elSol.mechAdv, 3), sub: `Kol = ${fmtFix(elSol.momentArm * 100, 1)} cm` },
      ]);
      eCv.render();
    } else {
      const fl = muscleForceLength(st.lNorm);
      const hc = hillCurve({ F0: st.F0, vmax: st.vmax, aRatio: st.aR });
      renderKpis(kpis, [
        { lbl: `F/F₀ @ L=${fmtFix(st.lNorm, 2)}`, val: fmtFix(fl.total, 2), sub: `Aktif ${fmtFix(fl.active, 2)} + Pasif ${fmtFix(fl.passive, 2)}`, tone: 'acc' },
        { lbl: 'Maks Güç P_maks', val: `${Math.round(hc.pMax)} W-eq`, sub: `v_opt = ${fmtFix(hc.vOpt, 2)} L₀/s`, tone: 'ok' },
      ]);
      drawMusclePlots();
    }
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  observeResize(host.querySelector('[data-flb]'), drawMusclePlots, clean);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.tab === 'elbow') { st.theta = p.theta; st.load = p.load; st.dbCm = p.db; sTh.set(st.theta); sLd.set(st.load); sDb.set(st.dbCm); }
    else { st.F0 = p.F0; st.vmax = p.vmax; st.aR = p.aR; st.lNorm = p.lNorm; sF0.set(st.F0); sVm.set(st.vmax); sLn.set(st.lNorm); }
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 3.7 TIBBİ GÖRÜNTÜLEME (CT Radon Sinogram / FBP & Ultrason Yankı)
function mountMedImaging(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Beyin Fantomu (48 Açı FBP)', tab: 'ct', phantom: 'brain', angles: 48, filtered: true },
    { label: 'Filtresiz Geri Projeksiyon (1/r Bulanık)', tab: 'ct', phantom: 'dots', angles: 48, filtered: false },
    { label: 'Az Projeksiyon (Çizgi Artefaktı)', tab: 'ct', phantom: 'brain', angles: 10, filtered: true },
    { label: 'Ultrason A-Mod (Yağ–Kas–Kemik)', tab: 'us', freq: 3.5, fatMm: 16, muscMm: 28 },
  ];
  const st = { tab: 'ct', phantom: 'brain', angles: 40, filtered: true, freq: 3.5, fatMm: 16, muscMm: 28 };
  const CT_SIZE = 44;

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Bilgisayarlı Tomografi (CT)** fantomunun Radon dönüşümü (**sinogram**) ve **Ram-Lak Filtreli Geri Projeksiyon (FBP)** rekonstrüksiyonunu incele; **Ultrason** modunda doku katmanlarından dönen yankı sürelerini ($t = 2d/c$) hesapla.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="ct" class="on">CT Sinogram & FBP</button>
        <button type="button" data-t="us">Ultrason Yankı (A-Mod)</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-grid-3" data-ctbox>
          <div class="slp-plot-card"><h4 class="slp-title">1. Orijinal Fantom</h4><div class="slp-cv-box"><canvas class="slp-cv" data-cph aria-label="CT fantom kesiti"></canvas></div></div>
          <div class="slp-plot-card"><h4 class="slp-title">2. Sinogram p(θ, s)</h4><div class="slp-cv-box"><canvas class="slp-cv" data-csin aria-label="CT Radon sinogramı"></canvas></div></div>
          <div class="slp-plot-card"><h4 class="slp-title">3. Rekonstrüksiyon</h4><div class="slp-cv-box"><canvas class="slp-cv" data-crec aria-label="CT geri projeksiyon rekonstrüksiyonu"></canvas></div></div>
        </div>
        <div class="slp-col" data-usbox hidden>
          <div class="slp-plot-card">
            <div class="slp-head"><h4 class="slp-title">Ultrason A-Mod Yankı Osiloskobu</h4><span class="slp-hint">Zaman t (µs) = 2d / c</span></div>
            <div class="slp-cv-box" data-usb><canvas class="slp-cv" data-uscv aria-label="Ultrason A-mod yankı grafiği"></canvas></div>
          </div>
          <div class="slp-panel">
            <h4 class="slp-title">Doku Sınırları Akustik Empedans & Yansıma Tablosu</h4>
            <div class="slp-table-wrap"><table class="slp-tbl" aria-label="Ultrason yankı tablosu">
              <thead><tr><th>Sınır</th><th>Derinlik</th><th>Gidiş-Dönüş t</th><th>Z₁ → Z₂ (MRayl)</th><th>Yansıma R</th><th>Yankı Genliği</th></tr></thead>
              <tbody data-ustbl></tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'p(\\theta, s) = \\iint f(x, y)\\,\\delta(x\\cos\\theta + y\\sin\\theta - s)\\,dx\\,dy \\quad (\\text{Radon Dönüşümü})',
        't = \\frac{2d}{c}, \\qquad Z = \\rho c, \\qquad R = \\left(\\frac{Z_2 - Z_1}{Z_2 + Z_1}\\right)^2',
      ],
      paragraphs: [
        'Filtresiz geri projeksiyon her noktayı $1/r$ çekirdeğiyle bulanıklaştırır. Projeksiyonlara geri projeksiyon öncesi **Ram-Lak (rampa) filtresi** ($|\\omega|$) uygulanması keskin kenarları geri kazandırır.',
        'Ultrason görüntülemede akustik empedans farkı büyük olan sınırlarda (ör. kas–kemik) yansıma katsayısı $R$ çok yüksektir ve güçlü yankı oluşturur.',
      ],
      tasks: [
        '**Ram-Lak Filtresi** anahtarını kapatıp açarak rekonstrüksiyon keskinliği ve PSNR farkını karşılaştır.',
        'Projeksiyon açısı sayısını 10’a düşürerek yıldız/çizgi (streak) artefaktlarını gözle.',
        'Ultrason modunda yağ kalınlığını değiştirip ilk yankının $t = 2d/c$ oranında kaymasını doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const uscv = host.querySelector('[data-uscv]');

  const selPh = addSelect(ctrls, 'CT Fantomu', [['brain', 'Beyin Kesiti (Shepp-Logan)'], ['tumor', 'Tümörlü Doku'], ['dots', '3 Nokta Çözünürlük Testi']], st.phantom, v => { st.phantom = v; update(); });
  const sAng = addSlider(ctrls, { label: 'Projeksiyon Açısı Sayısı', min: 8, max: 72, step: 4, value: st.angles, fmt: v => `${Math.round(v)} açı`, onInput: v => { st.angles = Math.round(v); update(); } });
  const tFilt = addToggle(ctrls, 'Ram-Lak (Rampa) Filtreli FBP', st.filtered, v => { st.filtered = v; update(); });
  const sFrq = addSlider(ctrls, { label: 'Ultrason Frekansı', unit: 'MHz', min: 1.0, max: 10.0, step: 0.5, value: st.freq, fmt: v => `${fmtFix(v, 1)} MHz`, onInput: v => { st.freq = v; update(); } });
  const sFat = addSlider(ctrls, { label: 'Yağ Katmanı Kalınlığı', unit: 'mm', min: 5, max: 35, step: 1, value: st.fatMm, fmt: v => `${Math.round(v)} mm`, onInput: v => { st.fatMm = v; update(); } });
  const sMus = addSlider(ctrls, { label: 'Kas Katmanı Kalınlığı', unit: 'mm', min: 10, max: 50, step: 2, value: st.muscMm, fmt: v => `${Math.round(v)} mm`, onInput: v => { st.muscMm = v; update(); } });

  let ctData = null, usData = null;
  function drawGrayGrid(c, W, H, arr, cols, rows, tint = false) {
    c.clearRect(0, 0, W, H);
    if (!arr) return;
    let mx = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > mx) mx = arr[i];
    if (mx < 1e-9) mx = 1;
    const cw = W / cols, ch = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const v = Math.max(0, Math.min(1, arr[r * cols + col] / mx));
        const g = Math.round(v * 255);
        c.fillStyle = tint ? `rgb(${Math.round(g * 0.45)},${Math.round(g * 0.8)},${g})` : `rgb(${g},${g},${g})`;
        c.fillRect(col * cw, r * ch, cw + 0.6, ch + 0.6);
      }
    }
  }
  const cPh = setupCanvas(host.querySelector('[data-cph]'), w => Math.min(200, Math.max(150, w)), (c, W, H) => drawGrayGrid(c, W, H, ctData?.ph, CT_SIZE, CT_SIZE), clean);
  const cSin = setupCanvas(host.querySelector('[data-csin]'), w => Math.min(200, Math.max(150, w)), (c, W, H) => drawGrayGrid(c, W, H, ctData?.sinogram, CT_SIZE, ctData?.numAngles || 1, true), clean);
  const cRec = setupCanvas(host.querySelector('[data-crec]'), w => Math.min(200, Math.max(150, w)), (c, W, H) => drawGrayGrid(c, W, H, ctData?.recon, CT_SIZE, CT_SIZE), clean);

  function drawUS() {
    if (!usData || st.tab !== 'us') return;
    safePlot(uscv, [{ name: 'A-Mod Yankı', color: PLOT_COLORS[3], xs: usData.tSeries, ys: usData.aMode }], { x0: 0, x1: usData.totalTimeUs, ylabel: 'Genlik', height: 220 });
  }

  function update() {
    const isCT = st.tab === 'ct';
    host.querySelector('[data-ctbox]').hidden = !isCT;
    host.querySelector('[data-usbox]').hidden = isCT;
    [selPh, sAng, tFilt].forEach(x => x.setVisible(isCT));
    [sFrq, sFat, sMus].forEach(x => x.setVisible(!isCT));

    if (isCT) {
      const ph = createPhantom(st.phantom, CT_SIZE);
      const sg = computeSinogram(ph, CT_SIZE, st.angles);
      const rec = reconstructFBP(sg.sinogram, sg.numAngles, sg.numDet, CT_SIZE, { filtered: st.filtered, reference: ph });
      ctData = { ph, ...sg, ...rec };
      renderKpis(kpis, [
        { lbl: 'Yöntem', val: st.filtered ? 'Ram-Lak FBP' : 'Filtresiz BP', tone: st.filtered ? 'ok' : 'warn' },
        { lbl: 'Projeksiyon Açısı', val: `${st.angles} açı` },
        { lbl: 'PSNR / RMSE', val: `${fmtFix(rec.psnr, 1)} dB`, sub: `RMSE = ${fmtFix(rec.rmse, 3)}`, tone: 'acc' },
      ]);
      cPh.render(); cSin.render(); cRec.render();
    } else {
      const layers = [
        { name: 'Yağ', thicknessMm: st.fatMm, c_ms: 1450, rho_kgm3: 950, atten_dBcmMHz: 0.6 },
        { name: 'Kas', thicknessMm: st.muscMm, c_ms: 1580, rho_kgm3: 1070, atten_dBcmMHz: 1.2 },
        { name: 'Kemik', thicknessMm: 15, c_ms: 3500, rho_kgm3: 1900, atten_dBcmMHz: 10 },
      ];
      usData = simulateUltrasound(layers, st.freq);
      renderKpis(kpis, [
        { lbl: 'Frekans / Dalga Boyu', val: `${fmtFix(st.freq, 1)} MHz`, sub: `λ ≈ ${fmtFix(1.54 / st.freq, 2)} mm`, tone: 'acc' },
        { lbl: 'Yağ–Kas Yankısı', val: `${fmtFix(usData.echoes[0].timeUs, 1)} µs`, sub: `R = %${fmtFix(usData.echoes[0].reflCoeff * 100, 2)}` },
        { lbl: 'Kas–Kemik Yankısı', val: `${fmtFix(usData.echoes[1].timeUs, 1)} µs`, sub: `R = %${fmtFix(usData.echoes[1].reflCoeff * 100, 1)}`, tone: 'warn' },
      ]);
      host.querySelector('[data-ustbl]').innerHTML = usData.echoes.map(e => `<tr>
        <td><b>${esc(e.boundary)}</b></td><td class="mono">${fmtFix(e.depthMm, 1)} mm</td>
        <td class="mono slp-td-hi">${fmtFix(e.timeUs, 2)} µs</td>
        <td class="mono">${fmtFix(e.Z1, 2)} → ${fmtFix(e.Z2, 2)}</td>
        <td class="mono">%${fmtFix(e.reflCoeff * 100, 2)}</td><td class="mono">${fmtFix(e.amp, 3)}</td>
      </tr>`).join('');
      drawUS();
    }
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  observeResize(host.querySelector('[data-usb]'), drawUS, clean);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.tab === 'ct') { st.phantom = p.phantom; st.angles = p.angles; st.filtered = p.filtered; selPh.set(st.phantom); sAng.set(st.angles); tFilt.set(st.filtered); }
    else { st.freq = p.freq; st.fatMm = p.fatMm; st.muscMm = p.muscMm; sFrq.set(st.freq); sFat.set(st.fatMm); sMus.set(st.muscMm); }
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// =====================================================================
// FIELD 4: FİZİK & MATEMATİK (9 SIMULATIONS)
// =====================================================================

// 4.1 DALGALAR & GİRİŞİM (Dalga Leğeni, Doppler, Duran Dalga, Vuru)
function mountWaves(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: '2B İki Kaynak Girişimi', mode: 'ripple', lam: 1.1, sep: 3.0, dphi: 0 },
    { label: 'Doppler · Süpersonik (Mach 1.4)', mode: 'doppler', mach: 1.4 },
    { label: 'Duran Dalga (3. Harmonik)', mode: 'standing', harm: 3, T: 40 },
    { label: 'Akustik Vuru (10 Hz + 11.5 Hz)', mode: 'beats', f1: 10, f2: 11.5 },
  ];
  const st = { mode: 'ripple', lam: 1.1, sep: 3.0, dphi: 0, mach: 0.65, harm: 3, T: 40, f1: 10, f2: 11.5, t: 0, playing: autoPlayAllowed() };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Dört temel dalga olayını tek laboratuvarda incele: **2B Dalga Leğeni** (iki kaynak girişimi), **Doppler Etkisi & Mach Konisi**, telde **Duran Dalga Harmonikleri** ve **Vuru (Beats)** zarfı.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-mode>
        <button type="button" data-m="ripple" class="on">2B Dalga Leğeni</button>
        <button type="button" data-m="doppler">Doppler & Mach</button>
        <button type="button" data-m="standing">Duran Dalga</button>
        <button type="button" data-m="beats">Vuru (Beats)</button>
      </div>
      <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`}</button>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-wtitle>2B Dalga Leğeni Girişim Deseni</h4><span class="slp-badge slp-badge-acc mono" data-wbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Dalgalar ve girişim simülasyon tuvali"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\Delta r = |r_1 - r_2| = m\\lambda \\;(\\text{yapıcı}), \\qquad f\' = f_0 \\frac{c}{c \\mp v_s}, \\qquad \\sin\\mu = \\frac{1}{M}',
        'f_n = \\frac{n}{2L}\\sqrt{\\frac{T}{\\mu}}, \\qquad f_{\\text{vuru}} = |f_1 - f_2|',
      ],
      paragraphs: [
        'İki eşevreli kaynak yol farkı tam dalga boyu katı olduğunda **yapıcı girişim**, yarım dalga boyu katı olduğunda **yıkıcı girişim (düğüm hiperbolleri)** oluşturur.',
        'Kaynak hızı ses hızını aştığında ($M = v_s/c > 1$) dalga cepheleri üst üste binerek yarı tepe açısı $\\mu = \\arcsin(1/M)$ olan **Mach şok konisini** yaratır.',
      ],
      tasks: [
        'Dalga leğeninde faz farkını $180^\\circ$ yaparak merkez eksenin yapıcıdan yıkıcı (karanlık) düğüm çizgisine döndüğünü gör.',
        'Doppler modunda hız oranını $M = 1.4$’e çıkarıp Mach şok konisini gözle.',
        'Vuru modunda $f_2$’yi $f_1$’e yaklaştırdıkça vuru periyodunun uzadığını doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const sLam = addSlider(ctrls, { label: 'Dalga Boyu λ', min: 0.5, max: 2.2, step: 0.05, value: st.lam, fmt: v => `${fmtFix(v, 2)} m`, onInput: v => { st.lam = v; syncUI(); } });
  const sSep = addSlider(ctrls, { label: 'Kaynaklar Arası d', min: 0.8, max: 5.5, step: 0.1, value: st.sep, fmt: v => `${fmtFix(v, 1)} m`, onInput: v => { st.sep = v; syncUI(); } });
  const sPhi = addSlider(ctrls, { label: 'Faz Farkı Δφ', unit: '°', min: 0, max: 360, step: 15, value: st.dphi, fmt: v => `${Math.round(v)}°`, onInput: v => { st.dphi = v; syncUI(); } });
  const sMach = addSlider(ctrls, { label: 'Kaynak Hızı (Mach v_s/c)', min: 0, max: 1.7, step: 0.05, value: st.mach, fmt: v => `M = ${fmtFix(v, 2)}`, onInput: v => { st.mach = v; syncUI(); } });
  const sHarm = addSlider(ctrls, { label: 'Harmonik Sayısı n', min: 1, max: 8, step: 1, value: st.harm, fmt: v => `n = ${Math.round(v)}`, onInput: v => { st.harm = Math.round(v); syncUI(); } });
  const sTens = addSlider(ctrls, { label: 'Tel Gerilmesi T', unit: 'N', min: 10, max: 120, step: 2, value: st.T, fmt: v => `${Math.round(v)} N`, onInput: v => { st.T = v; syncUI(); } });
  const sF1 = addSlider(ctrls, { label: 'Frekans f₁', unit: 'Hz', min: 4, max: 20, step: 0.5, value: st.f1, fmt: v => `${fmtFix(v, 1)} Hz`, onInput: v => { st.f1 = v; syncUI(); } });
  const sF2 = addSlider(ctrls, { label: 'Frekans f₂', unit: 'Hz', min: 4, max: 20, step: 0.5, value: st.f2, fmt: v => `${fmtFix(v, 1)} Hz`, onInput: v => { st.f2 = v; syncUI(); } });

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(310, Math.max(230, w * 0.54)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'ripple') {
      const gx = 64, gy = 44, cw = W / gx, ch = H / gy;
      const s1 = [-st.sep / 2, 0], s2 = [st.sep / 2, 0];
      const dphiRad = (st.dphi * Math.PI) / 180;
      for (let j = 0; j < gy; j++) {
        const y = ((j + 0.5) / gy - 0.5) * 8;
        for (let i = 0; i < gx; i++) {
          const x = ((i + 0.5) / gx - 0.5) * 11;
          const a = rippleAmplitude({ s1, s2, lambda: st.lam, dphi: dphiRad, phaseT: st.t * 4, x, y }).amp;
          const v = Math.max(-1, Math.min(1, a * 0.55));
          const r = v > 0 ? Math.round(90 * v) : Math.round(-255 * v * 0.55);
          const g = v > 0 ? Math.round(205 * v) : Math.round(-90 * v * 0.35);
          const b = v > 0 ? Math.round(255 * v) : Math.round(-120 * v * 0.45);
          c.fillStyle = `rgb(${r},${g},${b})`;
          c.fillRect(i * cw, j * ch, cw + 0.7, ch + 0.7);
        }
      }
      for (const s of [s1, s2]) {
        const sx = ((s[0] / 11) + 0.5) * W, sy = ((s[1] / 8) + 0.5) * H;
        c.beginPath(); c.arc(sx, sy, 6, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
      }
      return;
    }

    if (st.mode === 'doppler') {
      const cSpeed = 58, vSrc = st.mach * cSpeed;
      const period = 0.42;
      const sx = ((st.t * vSrc) % (W * 0.75)) + W * 0.12;
      const sy = H / 2;
      for (let k = 1; k <= 14; k++) {
        const age = (st.t % period) + k * period;
        const r = age * cSpeed;
        const ox = sx - vSrc * age;
        if (r > W) continue;
        c.beginPath(); c.arc(ox, sy, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(90,176,255,${Math.max(0.08, 0.7 - k * 0.045)})`; c.lineWidth = 1.6; c.stroke();
      }
      if (st.mach > 1) {
        const ang = Math.asin(1 / st.mach);
        c.strokeStyle = COL_WARN; c.lineWidth = 2; c.setLineDash([5, 4]);
        c.beginPath();
        c.moveTo(sx, sy); c.lineTo(sx - 240 * Math.cos(ang), sy - 240 * Math.sin(ang));
        c.moveTo(sx, sy); c.lineTo(sx - 240 * Math.cos(ang), sy + 240 * Math.sin(ang));
        c.stroke(); c.setLineDash([]);
      }
      c.beginPath(); c.arc(sx, sy, 7, 0, Math.PI * 2); c.fillStyle = COL_BAD; c.fill();
      return;
    }

    if (st.mode === 'standing') {
      const pad = 28, Lpx = W - 2 * pad, cy = H / 2, amp = H * 0.34;
      c.strokeStyle = COL_GRID; c.beginPath(); c.moveTo(pad, cy); c.lineTo(W - pad, cy); c.stroke();
      // Envelope
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.setLineDash([4, 4]);
      for (const sgn of [1, -1]) {
        c.beginPath();
        for (let i = 0; i <= 120; i++) {
          const u = i / 120;
          const x = pad + u * Lpx, y = cy + sgn * amp * Math.sin(st.harm * Math.PI * u);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
      c.setLineDash([]);
      // Active vibrating string
      const ct = Math.cos(st.t * 4.5);
      c.strokeStyle = acc; c.lineWidth = 2.8; c.beginPath();
      for (let i = 0; i <= 140; i++) {
        const u = i / 140;
        const x = pad + u * Lpx, y = cy - amp * Math.sin(st.harm * Math.PI * u) * ct;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      // Nodes
      for (let k = 0; k <= st.harm; k++) {
        c.beginPath(); c.arc(pad + (k / st.harm) * Lpx, cy, 4.5, 0, Math.PI * 2);
        c.fillStyle = COL_BAD; c.fill();
      }
      return;
    }

    // Beats
    const tr = beatsTrace({ f1: st.f1, f2: st.f2, tEnd: 2.0, n: 360 });
    const pad = 24, cy = H / 2, scY = H * 0.19;
    c.strokeStyle = COL_WARN; c.setLineDash([4, 4]); c.lineWidth = 1.4;
    for (const sgn of [1, -1]) {
      c.beginPath();
      tr.t.forEach((ti, i) => {
        const x = pad + (ti / 2) * (W - 2 * pad), y = cy - sgn * tr.env[i] * scY;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      });
      c.stroke();
    }
    c.setLineDash([]);
    c.strokeStyle = COL_BLUE; c.lineWidth = 2; c.beginPath();
    tr.t.forEach((ti, i) => {
      const x = pad + (ti / 2) * (W - 2 * pad), y = cy - tr.sum[i] * scY;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();
  }, clean);

  function syncUI() {
    [sLam, sSep, sPhi].forEach(x => x.setVisible(st.mode === 'ripple'));
    sMach.setVisible(st.mode === 'doppler');
    [sHarm, sTens].forEach(x => x.setVisible(st.mode === 'standing'));
    [sF1, sF2].forEach(x => x.setVisible(st.mode === 'beats'));

    if (st.mode === 'ripple') {
      host.querySelector('[data-wtitle]').textContent = '2B Dalga Leğeni (İki Kaynak Girişimi)';
      host.querySelector('[data-wbadge]').textContent = `d/λ = ${fmtFix(st.sep / st.lam, 2)}`;
      renderKpis(kpis, [
        { lbl: 'Dalga Boyu λ', val: `${fmtFix(st.lam, 2)} m`, tone: 'acc' },
        { lbl: 'Maks. Girişim Mertebesi', val: `m_maks = ${Math.floor(st.sep / st.lam)}` },
        { lbl: 'Merkez Eksen', val: st.dphi % 360 === 0 ? 'Yapıcı (Karın)' : st.dphi === 180 ? 'Yıkıcı (Düğüm)' : `Faz ${st.dphi}°` },
      ]);
    } else if (st.mode === 'doppler') {
      const dm = dopplerMetrics({ f0: 440, c: 343, vs: st.mach * 343, vo: 0 });
      host.querySelector('[data-wtitle]').textContent = 'Doppler Etkisi & Süpersonik Şok Konisi';
      host.querySelector('[data-wbadge]').textContent = `M = ${fmtFix(dm.mach, 2)}`;
      renderKpis(kpis, [
        { lbl: 'Yaklaşan Frekans f′', val: dm.fApproach === Infinity ? 'ŞOK DALGASI' : `${Math.round(dm.fApproach)} Hz`, tone: dm.mach >= 1 ? 'bad' : 'acc' },
        { lbl: 'Uzaklaşan Frekans f′', val: `${Math.round(dm.fRecede)} Hz` },
        { lbl: 'Mach Konisi Açısı μ', val: dm.machAngleDeg ? `${fmtFix(dm.machAngleDeg, 1)}°` : 'Sesaltı (M < 1)', tone: dm.machAngleDeg ? 'warn' : 'ok' },
      ]);
    } else if (st.mode === 'standing') {
      const sw = standingWaveMetrics({ n: st.harm, L: 1.2, T: st.T, mu: 0.004 });
      host.querySelector('[data-wtitle]').textContent = `Telde Duran Dalga (n = ${st.harm}. Harmonik)`;
      host.querySelector('[data-wbadge]').textContent = `f_${st.harm} = ${fmtFix(sw.freq, 1)} Hz`;
      renderKpis(kpis, [
        { lbl: 'Harmonik Frekansı', val: `${fmtFix(sw.freq, 1)} Hz`, tone: 'acc' },
        { lbl: 'Dalga Hızı v = √(T/μ)', val: `${fmtFix(sw.v, 1)} m/s` },
        { lbl: 'Dalga Boyu / Düğüm', val: `${fmtFix(sw.lambda, 2)} m · ${st.harm + 1} düğüm`, tone: 'ok' },
      ]);
    } else {
      host.querySelector('[data-wtitle]').textContent = 'İki Yakın Frekansın Süperpozisyonu (Vuru)';
      host.querySelector('[data-wbadge]').textContent = `f_vuru = ${fmtFix(Math.abs(st.f1 - st.f2), 2)} Hz`;
      renderKpis(kpis, [
        { lbl: 'Vuru Frekansı |f₁−f₂|', val: `${fmtFix(Math.abs(st.f1 - st.f2), 2)} Hz`, tone: 'acc' },
        { lbl: 'Taşıyıcı (f₁+f₂)/2', val: `${fmtFix(0.5 * (st.f1 + st.f2), 2)} Hz` },
      ]);
    }
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => { st.t += dt; cv.render(); return st.playing; }, clean);
  host.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-m]'); if (!b) return;
    st.mode = b.dataset.m;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, presets, p => {
    st.mode = p.mode;
    host.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x.dataset.m === st.mode));
    if (p.lam) { st.lam = p.lam; st.sep = p.sep; st.dphi = p.dphi; sLam.set(st.lam); sSep.set(st.sep); sPhi.set(st.dphi); }
    if (p.mach !== undefined) { st.mach = p.mach; sMach.set(st.mach); }
    if (p.harm) { st.harm = p.harm; st.T = p.T; sHarm.set(st.harm); sTens.set(st.T); }
    if (p.f1) { st.f1 = p.f1; st.f2 = p.f2; sF1.set(st.f1); sF2.set(st.f2); }
    syncUI();
  });

  bindTasks(host);
  syncUI();
  if (st.playing) loop.start();
  return clean.run;
}

// 4.2 OPTİK & KIRINIM (Mercek/Ayna Işın İzleme, Snell/TIR & Prizma, Yarık Kırınımı)
function mountOptics(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'İnce Kenarlı Mercek (Gerçek)', tab: 'ray', kind: 'convex-lens', f: 14, do_: 26 },
    { label: 'Büyüteç (d_o < f, Sanal)', tab: 'ray', kind: 'convex-lens', f: 18, do_: 11 },
    { label: 'Tam İç Yansıma (Cam→Hava)', tab: 'snell', n1: 1.5, n2: 1.0, theta: 46, prism: false },
    { label: 'Prizma Gökkuşağı Dispersiyonu', tab: 'snell', prism: true, theta: 48 },
    { label: 'Kırınım Ağı (N = 6 Yarık)', tab: 'diff', dmode: 'grating', N: 6, lam: 530 },
  ];
  const st = {
    tab: 'ray', kind: 'convex-lens', f: 14, do_: 26, ho: 7,
    n1: 1.5, n2: 1.0, theta: 35, prism: false, glass: 'flint',
    dmode: 'double', aUm: 5, dUm: 22, N: 5, lam: 550,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**İnce mercek ve küresel aynalarda** cismi sürükleyerek 3 temel ışını ve görüntü büyütmesini gör; **Snell Yasası / Tam İç Yansıma / Prizma dispersiyonu** ve **tek/çift yarık – kırınım ağı** şiddet desenlerini keşfet.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="ray" class="on">Mercek & Ayna Işınları</button>
        <button type="button" data-t="snell">Snell, TIR & Prizma</button>
        <button type="button" data-t="diff">Yarık & Kırınım Ağı</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-otitle>Optik Işın Diyagramı</h4><span class="slp-badge slp-badge-acc mono" data-obadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv slp-cv-drag" data-cv aria-label="Optik ışın izleme ve kırınım tuvali"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}, \\qquad m = -\\frac{d_i}{d_o}, \\qquad n_1\\sin\\theta_1 = n_2\\sin\\theta_2',
        'I(\\theta) = I_0 \\left(\\frac{\\sin\\beta}{\\beta}\\right)^2 \\left(\\frac{\\sin N\\alpha}{N\\sin\\alpha}\\right)^2, \\quad \\beta = \\frac{\\pi a\\sin\\theta}{\\lambda}, \\quad \\alpha = \\frac{\\pi d\\sin\\theta}{\\lambda}',
      ],
      paragraphs: [
        'İnce kenarlı mercekte cisim odak dışındaysa ($d_o > f$) ters ve **gerçek**, odak içindeyse ($d_o < f$) düz, büyük ve **sanal** (büyüteç) görüntü oluşur.',
        'Işık çok yoğun ortamdan az yoğun ortama geçerken ($n_1 > n_2$) geliş açısı kritik açı $\\theta_c = \\arcsin(n_2/n_1)$ değerini aşarsa **Tam İç Yansıma (TIR)** gerçekleşir (fiber optiğin temeli).',
      ],
      tasks: [
        'Cismi tuvalde tam $2f$ noktasına sürükleyip $d_i = 2f$ ve büyütmenin $m = -1$ olduğunu doğrula.',
        'Snell sekmesinde geliş açısını $42^\\circ$’nin üstüne çıkararak Tam İç Yansımayı ve Fresnel yansımasının %100 oluşunu gör.',
        'Kırınım sekmesinde yarık sayısını $N=2$’den $N=8$’e artırıp ana maksimumların nasıl keskinleştiğini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cvEl = host.querySelector('[data-cv]');

  const selKind = addSelect(ctrls, 'Optik Eleman', [
    ['convex-lens', 'İnce Kenarlı Mercek (+f)'], ['concave-lens', 'Kalın Kenarlı Mercek (−f)'],
    ['concave-mirror', 'Çukur Ayna (+f)'], ['convex-mirror', 'Tümsek Ayna (−f)'],
  ], st.kind, v => { st.kind = v; syncUI(); });
  const sF = addSlider(ctrls, { label: 'Odak Uzaklığı |f|', unit: 'cm', min: 6, max: 25, step: 0.5, value: st.f, fmt: v => `${fmtFix(v, 1)} cm`, onInput: v => { st.f = v; syncUI(); } });
  const sDo = addSlider(ctrls, { label: 'Cisim Uzaklığı d_o', unit: 'cm', min: 4, max: 45, step: 0.5, value: st.do_, fmt: v => `${fmtFix(v, 1)} cm`, onInput: v => { st.do_ = v; syncUI(); } });

  const tPrism = addToggle(ctrls, 'Cam Prizma Dispersiyonu', st.prism, v => { st.prism = v; syncUI(); });
  const sN1 = addSlider(ctrls, { label: 'Ortam 1 İndisi n₁', min: 1.0, max: 2.0, step: 0.05, value: st.n1, fmt: v => fmtFix(v, 2), onInput: v => { st.n1 = v; syncUI(); } });
  const sN2 = addSlider(ctrls, { label: 'Ortam 2 İndisi n₂', min: 1.0, max: 2.0, step: 0.05, value: st.n2, fmt: v => fmtFix(v, 2), onInput: v => { st.n2 = v; syncUI(); } });
  const sTh = addSlider(ctrls, { label: 'Geliş Açısı θ₁', unit: '°', min: 5, max: 80, step: 1, value: st.theta, fmt: v => `${Math.round(v)}°`, onInput: v => { st.theta = v; syncUI(); } });

  const selDiff = addSelect(ctrls, 'Kırınım Düzeni', [['single', 'Tek Yarık'], ['double', 'Çift Yarık (Young)'], ['grating', 'Kırınım Ağı (N Yarık)']], st.dmode, v => { st.dmode = v; syncUI(); });
  const sLam = addSlider(ctrls, { label: 'Dalga Boyu λ', unit: 'nm', min: 400, max: 700, step: 5, value: st.lam, fmt: v => `${Math.round(v)} nm`, onInput: v => { st.lam = v; syncUI(); } });
  const sA = addSlider(ctrls, { label: 'Yarık Genişliği a', unit: 'µm', min: 2, max: 15, step: 0.5, value: st.aUm, fmt: v => `${fmtFix(v, 1)} µm`, onInput: v => { st.aUm = v; syncUI(); } });
  const sD = addSlider(ctrls, { label: 'Yarık Aralığı d', unit: 'µm', min: 8, max: 45, step: 1, value: st.dUm, fmt: v => `${Math.round(v)} µm`, onInput: v => { st.dUm = v; syncUI(); } });
  const sN = addSlider(ctrls, { label: 'Yarık Sayısı N', min: 2, max: 10, step: 1, value: st.N, fmt: v => String(Math.round(v)), onInput: v => { st.N = Math.round(v); syncUI(); } });

  let dragObj = false;
  const cv = setupCanvas(cvEl, w => Math.min(310, Math.max(230, w * 0.55)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const cy = H / 2;

    if (st.tab === 'ray') {
      const cx = W / 2, sc = (W * 0.44) / 48; // px per cm
      const sol = solveThinOptics({ kind: st.kind, fAbs: st.f, do_: st.do_, ho: st.ho });
      const isMir = st.kind.includes('mirror');
      c.strokeStyle = COL_AXIS; c.beginPath(); c.moveTo(10, cy); c.lineTo(W - 10, cy); c.stroke();
      // Lens / mirror body
      c.strokeStyle = COL_BLUE; c.lineWidth = 3;
      c.beginPath(); c.moveTo(cx, 24); c.lineTo(cx, H - 24); c.stroke();
      // Focal points
      for (const sgn of [-1, 1]) {
        const fx = cx + sgn * st.f * sc;
        c.beginPath(); c.arc(fx, cy, 3.5, 0, Math.PI * 2); c.fillStyle = COL_WARN; c.fill();
        c.fillStyle = COL_MUTE; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'center';
        c.fillText('F', fx, cy + 14);
      }
      // Object arrow
      const ox = cx - st.do_ * sc, oy = cy - st.ho * sc;
      drawArrow(c, ox, cy, ox, oy, COL_OK, 3, 8);
      // Image arrow
      if (!sol.atInfinity && Math.abs(sol.di) < 200) {
        const ix = isMir ? cx - sol.di * sc : cx + sol.di * sc;
        const iy = cy - sol.hi * sc;
        c.save(); if (!sol.real) c.setLineDash([4, 3]);
        drawArrow(c, ix, cy, ix, iy, sol.real ? COL_WARN : COL_PURP, 2.8, 8);
        c.restore();
        // Principal rays
        c.strokeStyle = 'rgba(255,209,102,0.75)'; c.lineWidth = 1.4;
        // Ray 1: parallel -> through focus
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(cx, oy); c.lineTo(ix, iy); c.stroke();
        // Ray 2: through center/vertex
        c.strokeStyle = 'rgba(90,176,255,0.75)';
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(cx, cy); c.lineTo(ix, iy); c.stroke();
      }
      return;
    }

    if (st.tab === 'snell') {
      if (st.prism) {
        const cx = W / 2, cyP = H * 0.54, sz = Math.min(W, H) * 0.36;
        const top = [cx, cyP - sz * 0.9], bl = [cx - sz * 0.85, cyP + sz * 0.58], br = [cx + sz * 0.85, cyP + sz * 0.58];
        c.fillStyle = 'rgba(90,176,255,0.12)'; c.strokeStyle = 'rgba(244,244,245,0.5)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(...top); c.lineTo(...br); c.lineTo(...bl); c.closePath(); c.fill(); c.stroke();
        const hitL = [(top[0] + bl[0]) / 2, (top[1] + bl[1]) / 2];
        const incAng = ((st.theta - 30) * Math.PI) / 180;
        drawArrow(c, hitL[0] - 110 * Math.cos(incAng), hitL[1] + 110 * Math.sin(incAng), hitL[0], hitL[1], '#fff', 2.6, 7);
        const lams = [680, 610, 570, 520, 470, 420];
        lams.forEach((nm, idx) => {
          const r = solvePrismRay({ apexDeg: 60, thetaInDeg: st.theta, lambdaNm: nm, glass: st.glass });
          const col = wavelengthToRGB(nm);
          const hitR = [(top[0] + br[0]) / 2, (top[1] + br[1]) / 2 + (idx - 2.5) * 4.5];
          c.strokeStyle = col; c.lineWidth = 2;
          c.beginPath(); c.moveTo(hitL[0], hitL[1]); c.lineTo(hitR[0], hitR[1]);
          if (!r.tir) {
            const outAng = ((r.deviationDeg - 28) * Math.PI) / 180;
            c.lineTo(hitR[0] + 150 * Math.cos(outAng), hitR[1] + 150 * Math.sin(outAng));
          }
          c.stroke();
        });
        return;
      }
      // Snell interface
      const cx = W / 2, midY = H / 2;
      c.fillStyle = 'rgba(90,176,255,0.08)'; c.fillRect(0, midY, W, H - midY);
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, midY); c.lineTo(W, midY); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(cx, 12); c.lineTo(cx, H - 12); c.stroke(); c.setLineDash([]);
      const sn = solveSnell({ n1: st.n1, n2: st.n2, thetaDeg: st.theta });
      const r1 = (st.theta * Math.PI) / 180, len = Math.min(W, H) * 0.42;
      drawArrow(c, cx - len * Math.sin(r1), midY - len * Math.cos(r1), cx, midY, COL_WARN, 2.5, 8);
      // Reflected ray
      drawArrow(c, cx, midY, cx + len * Math.sin(r1), midY - len * Math.cos(r1), sn.tir ? COL_BAD : 'rgba(255,209,102,0.5)', sn.tir ? 2.8 : 1.5, 7);
      if (!sn.tir) {
        const r2 = (sn.thetaRefDeg * Math.PI) / 180;
        drawArrow(c, cx, midY, cx + len * Math.sin(r2), midY + len * Math.cos(r2), COL_OK, 2.5, 8);
      }
      return;
    }

    // Diffraction intensity + simulated screen band
    const dp = diffractionPattern({ mode: st.dmode, aUm: st.aUm, dUm: st.dUm, N: st.N, lambdaNm: st.lam, maxAngleDeg: 8, samples: 361 });
    const col = wavelengthToRGB(st.lam);
    const padL = 24, padR = 24, stripY = 18, stripH = 34, gTop = 68, gH = H - gTop - 26;
    const pw = W - padL - padR;
    // Simulated screen fringe band
    for (let i = 0; i < dp.angles.length; i++) {
      const x = padL + (i / (dp.angles.length - 1)) * pw;
      c.fillStyle = col; c.globalAlpha = Math.pow(dp.intensity[i], 0.55);
      c.fillRect(x, stripY, pw / dp.angles.length + 1, stripH);
    }
    c.globalAlpha = 1;
    // Envelope dashed
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.setLineDash([4, 4]); c.lineWidth = 1.2; c.beginPath();
    dp.envelope.forEach((v, i) => {
      const x = padL + (i / (dp.angles.length - 1)) * pw, y = gTop + (1 - v) * gH;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke(); c.setLineDash([]);
    // Intensity curve
    c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath();
    dp.intensity.forEach((v, i) => {
      const x = padL + (i / (dp.angles.length - 1)) * pw, y = gTop + (1 - v) * gH;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();
    c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
    c.fillText('−8°', padL, H - 8); c.fillText('0°', W / 2, H - 8); c.fillText('+8°', W - padR, H - 8);
  }, clean);

  cvEl.addEventListener('pointerdown', e => { if (st.tab === 'ray') { dragObj = true; cvEl.setPointerCapture?.(e.pointerId); } });
  cvEl.addEventListener('pointermove', e => {
    if (!dragObj || st.tab !== 'ray') return;
    const [px] = canvasPos(cvEl, e);
    const { W } = cv.size();
    const sc = (W * 0.44) / 48;
    st.do_ = Math.max(4, Math.min(45, +((W / 2 - px) / sc).toFixed(1)));
    sDo.set(st.do_); syncUI();
  });
  cvEl.addEventListener('pointerup', () => { dragObj = false; });

  function syncUI() {
    [selKind, sF, sDo].forEach(x => x.setVisible(st.tab === 'ray'));
    [tPrism, sTh].forEach(x => x.setVisible(st.tab === 'snell'));
    [sN1, sN2].forEach(x => x.setVisible(st.tab === 'snell' && !st.prism));
    [selDiff, sLam, sA].forEach(x => x.setVisible(st.tab === 'diff'));
    sD.setVisible(st.tab === 'diff' && st.dmode !== 'single');
    sN.setVisible(st.tab === 'diff' && st.dmode === 'grating');

    if (st.tab === 'ray') {
      const sol = solveThinOptics({ kind: st.kind, fAbs: st.f, do_: st.do_, ho: st.ho });
      host.querySelector('[data-otitle]').textContent = 'İnce Mercek / Ayna Işın İzleme (Cismi Sürükle)';
      host.querySelector('[data-obadge]').textContent = sol.atInfinity ? 'Görüntü ∞' : `${sol.real ? 'Gerçek' : 'Sanal'}, ${sol.inverted ? 'Ters' : 'Düz'}`;
      renderKpis(kpis, [
        { lbl: 'Görüntü Uzaklığı d_i', val: sol.atInfinity ? '∞' : `${fmtFix(sol.di, 2)} cm`, tone: 'acc' },
        { lbl: 'Büyütme m = −d_i/d_o', val: sol.atInfinity ? '∞' : `${fmtFix(sol.m, 2)}×`, tone: sol.real ? 'ok' : 'warn' },
        { lbl: 'Görüntü Türü', val: sol.atInfinity ? 'Sonsuzda' : `${sol.real ? 'Gerçek' : 'Sanal'} · ${sol.inverted ? 'Ters' : 'Düz'}` },
      ]);
    } else if (st.tab === 'snell') {
      if (st.prism) {
        const red = solvePrismRay({ apexDeg: 60, thetaInDeg: st.theta, lambdaNm: 660, glass: st.glass });
        const vio = solvePrismRay({ apexDeg: 60, thetaInDeg: st.theta, lambdaNm: 420, glass: st.glass });
        host.querySelector('[data-otitle]').textContent = 'Flint Cam Prizma Dispersiyonu (Cauchy)';
        host.querySelector('[data-obadge]').textContent = `θ_giriş = ${st.theta}°`;
        renderKpis(kpis, [
          { lbl: 'Kırmızı (660 nm) Sapma', val: red.tir ? 'TIR' : `${fmtFix(red.deviationDeg, 1)}°`, sub: `n = ${fmtFix(red.n, 3)}` },
          { lbl: 'Mor (420 nm) Sapma', val: vio.tir ? 'TIR' : `${fmtFix(vio.deviationDeg, 1)}°`, sub: `n = ${fmtFix(vio.n, 3)}`, tone: 'acc' },
          { lbl: 'Açısal Ayrışma Δδ', val: (!red.tir && !vio.tir) ? `${fmtFix(vio.deviationDeg - red.deviationDeg, 2)}°` : '—', tone: 'ok' },
        ]);
      } else {
        const sn = solveSnell({ n1: st.n1, n2: st.n2, thetaDeg: st.theta });
        host.querySelector('[data-otitle]').textContent = 'Snell Kırılma & Tam İç Yansıma';
        host.querySelector('[data-obadge]').textContent = sn.tir ? 'TAM İÇ YANSIMA (TIR)!' : `θ₂ = ${fmtFix(sn.thetaRefDeg, 1)}°`;
        renderKpis(kpis, [
          { lbl: 'Kırılma Açısı θ₂', val: sn.tir ? 'TIR (Geçiş yok)' : `${fmtFix(sn.thetaRefDeg, 2)}°`, tone: sn.tir ? 'bad' : 'ok' },
          { lbl: 'Kritik Açı θ_c', val: sn.criticalDeg ? `${fmtFix(sn.criticalDeg, 2)}°` : 'Yok (n₁ ≤ n₂)', tone: 'acc' },
          { lbl: 'Fresnel Yansıma R', val: `%${fmtFix(sn.fresnelR * 100, 1)}` },
        ]);
      }
    } else {
      const dp = diffractionPattern({ mode: st.dmode, aUm: st.aUm, dUm: st.dUm, N: st.N, lambdaNm: st.lam });
      host.querySelector('[data-otitle]').textContent = 'Fraunhofer Kırınım & Girişim Deseni';
      host.querySelector('[data-obadge]').textContent = `λ = ${st.lam} nm`;
      renderKpis(kpis, [
        { lbl: '1. Kırınım Minimumu', val: dp.firstMinDeg ? `±${fmtFix(dp.firstMinDeg, 2)}°` : '—', tone: 'acc' },
        { lbl: '1. Girişim Maksimumu', val: dp.firstMaxDeg ? `±${fmtFix(dp.firstMaxDeg, 2)}°` : 'Tek yarık', tone: 'ok' },
      ]);
    }
    cv.render();
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.kind) { st.kind = p.kind; st.f = p.f; st.do_ = p.do_; selKind.set(st.kind); sF.set(st.f); sDo.set(st.do_); }
    if (p.prism !== undefined) { st.prism = p.prism; tPrism.set(st.prism); }
    if (p.n1) { st.n1 = p.n1; st.n2 = p.n2; sN1.set(st.n1); sN2.set(st.n2); }
    if (p.theta) { st.theta = p.theta; sTh.set(st.theta); }
    if (p.dmode) { st.dmode = p.dmode; st.N = p.N; st.lam = p.lam; selDiff.set(st.dmode); sN.set(st.N); sLam.set(st.lam); }
    syncUI();
  });

  bindTasks(host);
  syncUI();
  return clean.run;
}

// 4.3 KAOS & DİNAMİK SİSTEMLER (Çift Sarkaç, Lorenz, Lojistik Çatallanma, 2B Faz Portresi)
function mountChaos(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Çift Sarkaç (İkiz Hassasiyet)', tab: 'pend', th1: 2.1, th2: 2.3, twin: true },
    { label: 'Lorenz Kelebek Çekicisi', tab: 'lorenz', rho: 28 },
    { label: 'Lojistik Harita Çatallanması', tab: 'logistic', r: 3.85 },
    { label: '2B Faz Portresi · Kararlı Sarmal', tab: 'phase', A: [-0.6, -2.0, 2.0, -0.6] },
    { label: '2B Faz Portresi · Eyer (Saddle)', tab: 'phase', A: [1.2, 0.2, 0.2, -1.5] },
  ];
  const st = {
    tab: 'pend', twin: true,
    p1: [2.1, 0, 2.3, 0], p2: [2.101, 0, 2.3, 0], tr1: [], tr2: [],
    lor: [1, 1, 1], lorPts: [], rho: 28, yaw: 0.6,
    logR: 3.57, bif: null,
    A: [-0.6, -2.0, 2.0, -0.6], seeds: [[1.6, 0.4], [-1.5, -0.8], [0.5, -1.7], [-0.8, 1.5]],
    playing: autoPlayAllowed(),
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Deterministik kaosu ve faz uzaylarını canlı incele: **Çift Sarkaç** (0.001 rad farkla ayrılan ikiz sarkaç), **Lorenz Çekicisi**, **Lojistik Harita Çatallanma Diyagramı** ve $2\\times 2$ matrisle **2B Faz Portreleri**.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="pend" class="on">Çift Sarkaç</button>
        <button type="button" data-t="lorenz">Lorenz Çekicisi</button>
        <button type="button" data-t="logistic">Lojistik Çatallanma</button>
        <button type="button" data-t="phase">2B Faz Portresi</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`}</button>
        <button type="button" class="btn small ghost" data-rst>Sıfırla</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-ctitle>Çift Sarkaç (RK4)</h4><span class="slp-badge slp-badge-acc mono" data-cbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv slp-cv-tap" data-cv aria-label="Kaos ve dinamik sistem tuvali"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\dot{x} = \\sigma(y - x), \\quad \\dot{y} = x(\\rho - z) - y, \\quad \\dot{z} = xy - \\beta z \\quad (\\text{Lorenz})',
        'x_{n+1} = r x_n (1 - x_n), \\qquad \\lambda = \\lim_{N\\to\\infty}\\frac{1}{N}\\sum_{k=0}^{N-1} \\ln\\bigl|r(1-2x_k)\\bigr|',
      ],
      paragraphs: [
        '**Başlangıç koşullarına duyarlı bağımlılık (Kelebek Etkisi)**: pozitif Lyapunov üssü ($\\lambda > 0$) olan kaotik sistemlerde $10^{-3}$ radyanlık fark bile birkaç saniye içinde iki yörüngeyi tamamen ayırır.',
        '2B doğrusal sistem $\\dot{\\mathbf{x}} = A\\mathbf{x}$ tamamen iz $\\tau = \\text{tr}(A)$ ve determinant $\\Delta = \\det(A)$ tarafından sınıflandırılır: $\\Delta < 0$ eyer, $\\Delta > 0$ ve $\\tau^2 < 4\\Delta$ sarmal veya merkezdir.',
      ],
      tasks: [
        'Çift Sarkaçta ikiz sarkacın birkaç saniye üst üste gidip ardından tamamen ayrıldığını ve toplam enerjinin sabit kaldığını gör.',
        'Lojistik Haritada $r=3.2$ (periyot-2, $\\lambda < 0$) ile $r=3.9$ (kaos, $\\lambda > 0$) değerlerini karşılaştır.',
        '2B Faz Portresinde tuvale dokunarak yeni başlangıç yörüngeleri bırak ve matris elemanlarını değiştirerek Merkez ($\\tau=0, \\Delta>0$) oluştur.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const cvEl = host.querySelector('[data-cv]');

  const tTwin = addToggle(ctrls, 'İkiz Sarkaç (Δθ₁ = 0.001 rad)', st.twin, v => { st.twin = v; resetCur(); });
  const sRho = addSlider(ctrls, { label: 'Lorenz Rayleigh ρ', min: 10, max: 40, step: 0.5, value: st.rho, fmt: v => fmtFix(v, 1), onInput: v => { st.rho = v; resetCur(); } });
  const sYaw = addSlider(ctrls, { label: '3B Bakış Açısı', unit: '°', min: 0, max: 360, step: 5, value: 35, fmt: v => `${Math.round(v)}°`, onInput: v => { st.yaw = (v * Math.PI) / 180; cv.render(); } });
  const sLogR = addSlider(ctrls, { label: 'Lojistik Parametre r', min: 2.5, max: 4.0, step: 0.01, value: st.logR, fmt: v => fmtFix(v, 2), onInput: v => { st.logR = v; syncUI(); } });
  const sA0 = addSlider(ctrls, { label: 'A₁₁ (a)', min: -3, max: 3, step: 0.1, value: st.A[0], fmt: v => fmtFix(v, 1), onInput: v => { st.A[0] = v; syncUI(); } });
  const sA1 = addSlider(ctrls, { label: 'A₁₂ (b)', min: -3, max: 3, step: 0.1, value: st.A[1], fmt: v => fmtFix(v, 1), onInput: v => { st.A[1] = v; syncUI(); } });
  const sA2 = addSlider(ctrls, { label: 'A₂₁ (c)', min: -3, max: 3, step: 0.1, value: st.A[2], fmt: v => fmtFix(v, 1), onInput: v => { st.A[2] = v; syncUI(); } });
  const sA3 = addSlider(ctrls, { label: 'A₂₂ (d)', min: -3, max: 3, step: 0.1, value: st.A[3], fmt: v => fmtFix(v, 1), onInput: v => { st.A[3] = v; syncUI(); } });

  const cv = setupCanvas(cvEl, w => Math.min(340, Math.max(250, w * 0.58)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (st.tab === 'pend') {
      const cx = W / 2, cy = H * 0.36, L = Math.min(W, H) * 0.25;
      const drawOne = (s, tr, col) => {
        if (tr.length > 2) {
          c.strokeStyle = col; c.globalAlpha = 0.45; c.lineWidth = 1.4; c.beginPath();
          tr.forEach(([x, y], i) => { if (i === 0) c.moveTo(cx + x * L, cy + y * L); else c.lineTo(cx + x * L, cy + y * L); });
          c.stroke(); c.globalAlpha = 1;
        }
        const x1 = cx + L * Math.sin(s[0]), y1 = cy + L * Math.cos(s[0]);
        const x2 = x1 + L * Math.sin(s[2]), y2 = y1 + L * Math.cos(s[2]);
        c.strokeStyle = col; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.fillStyle = col;
        c.beginPath(); c.arc(x1, y1, 6, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(x2, y2, 7, 0, Math.PI * 2); c.fill();
      };
      if (st.twin) drawOne(st.p2, st.tr2, COL_BAD);
      drawOne(st.p1, st.tr1, COL_BLUE);
      return;
    }

    if (st.tab === 'lorenz') {
      const cx = W / 2, cy = H * 0.88, sc = Math.min(W, H) / 56;
      const ca = Math.cos(st.yaw), sa = Math.sin(st.yaw);
      c.strokeStyle = COL_BLUE; c.lineWidth = 1.4; c.beginPath();
      st.lorPts.forEach(([x, y, z], i) => {
        const px = cx + (x * ca - y * sa) * sc;
        const py = cy - z * sc;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();
      const last = st.lorPts.at(-1);
      if (last) {
        c.beginPath(); c.arc(cx + (last[0] * ca - last[1] * sa) * sc, cy - last[2] * sc, 4.5, 0, Math.PI * 2);
        c.fillStyle = COL_WARN; c.fill();
      }
      return;
    }

    if (st.tab === 'logistic') {
      if (!st.bif) st.bif = logisticBifurcation({ rMin: 2.5, rMax: 4.0, rSteps: 220, burn: 180, keep: 48 });
      const padL = 34, padR = 14, padT = 14, padB = 24, pw = W - padL - padR, ph = H - padT - padB;
      c.fillStyle = 'rgba(90,176,255,0.45)';
      for (const col of st.bif) {
        const x = padL + ((col.r - 2.5) / 1.5) * pw;
        for (const v of col.vals) c.fillRect(x, padT + (1 - v) * ph, 1.5, 1.5);
      }
      const rx = padL + ((st.logR - 2.5) / 1.5) * pw;
      c.strokeStyle = COL_WARN; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(rx, padT); c.lineTo(rx, padT + ph); c.stroke();
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
      [2.5, 3.0, 3.5, 4.0].forEach(r => c.fillText(fmtFix(r, 1), padL + ((r - 2.5) / 1.5) * pw, H - 6));
      return;
    }

    // 2D Linear Phase Portrait
    const [a, b, cc, d] = st.A;
    const toPx = (x, y) => [W / 2 + (x / 2.6) * (W / 2 - 20), H / 2 - (y / 2.6) * (H / 2 - 20)];
    c.strokeStyle = COL_AXIS; c.lineWidth = 1;
    c.beginPath(); c.moveTo(16, H / 2); c.lineTo(W - 16, H / 2); c.moveTo(W / 2, 16); c.lineTo(W / 2, H - 16); c.stroke();
    // Vector field
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
    for (let x = -2.2; x <= 2.2; x += 0.44) {
      for (let y = -2.2; y <= 2.2; y += 0.44) {
        const u = a * x + b * y, v = cc * x + d * y, m = Math.hypot(u, v) || 1;
        const [px, py] = toPx(x, y);
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + (u / m) * 10, py - (v / m) * 10); c.stroke();
      }
    }
    // Trajectories
    st.seeds.forEach(([x0, y0], idx) => {
      const pts = integrateLinear2D(a, b, cc, d, x0, y0, 4.5, 160);
      c.strokeStyle = PALETTE[idx % PALETTE.length]; c.lineWidth = 2; c.beginPath();
      pts.forEach(([x, y], i) => { const [px, py] = toPx(x, y); if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); });
      c.stroke();
      const [sx, sy] = toPx(x0, y0);
      c.beginPath(); c.arc(sx, sy, 4, 0, Math.PI * 2); c.fillStyle = PALETTE[idx % PALETTE.length]; c.fill();
    });
  }, clean);

  cvEl.addEventListener('pointerdown', e => {
    if (st.tab !== 'phase') return;
    const [px, py] = canvasPos(cvEl, e);
    const { W, H } = cv.size();
    const x = ((px - W / 2) / (W / 2 - 20)) * 2.6;
    const y = ((H / 2 - py) / (H / 2 - 20)) * 2.6;
    st.seeds.push([x, y]);
    if (st.seeds.length > 10) st.seeds.shift();
    cv.render();
  });

  function syncUI() {
    tTwin.setVisible(st.tab === 'pend');
    [sRho, sYaw].forEach(x => x.setVisible(st.tab === 'lorenz'));
    sLogR.setVisible(st.tab === 'logistic');
    [sA0, sA1, sA2, sA3].forEach(x => x.setVisible(st.tab === 'phase'));

    if (st.tab === 'pend') {
      const E1 = doublePendulumEnergy(st.p1);
      const diff = Math.abs(st.p1[2] - st.p2[2]);
      host.querySelector('[data-ctitle]').textContent = 'Çift Sarkaç (Mavi vs Kırmızı İkiz)';
      host.querySelector('[data-cbadge]').textContent = `|Δθ₂| = ${fmtFix(diff, 3)} rad`;
      renderKpis(kpis, [
        { lbl: 'Mekanik Enerji E = T+V', val: `${fmtFix(E1.E, 3)} J`, tone: 'ok' },
        { lbl: 'İkiz Ayrışma |Δθ₂|', val: `${fmtFix(diff, 3)} rad`, tone: diff > 0.5 ? 'bad' : 'acc' },
      ]);
    } else if (st.tab === 'lorenz') {
      host.querySelector('[data-ctitle]').textContent = `Lorenz Çekicisi (σ=10, ρ=${st.rho}, β=8/3)`;
      host.querySelector('[data-cbadge]').textContent = `${st.lorPts.length} nokta`;
      renderKpis(kpis, [
        { lbl: 'Durum (x, y, z)', val: st.lor.map(v => fmtFix(v, 1)).join(', '), tone: 'acc' },
        { lbl: 'Rejim', val: st.rho > 24.74 ? 'Kaotik Çekici' : 'Kararlı Odak', tone: st.rho > 24.74 ? 'warn' : 'ok' },
      ]);
    } else if (st.tab === 'logistic') {
      const lyap = logisticLyapunov(st.logR, 1200);
      host.querySelector('[data-ctitle]').textContent = 'Lojistik Harita Çatallanma Diyagramı';
      host.querySelector('[data-cbadge]').textContent = `r = ${fmtFix(st.logR, 2)}`;
      renderKpis(kpis, [
        { lbl: 'Lyapunov Üssü λ(r)', val: fmtFix(lyap, 3), sub: lyap > 0 ? 'KAOTİK (λ > 0)' : 'Periyodik / Kararlı', tone: lyap > 0 ? 'bad' : 'ok' },
        { lbl: 'Feigenbaum Eşiği', val: 'r_∞ ≈ 3.5699', tone: 'acc' },
      ]);
    } else {
      const cl = classifyLinear2D(...st.A);
      const eigTxt = cl.eigenvalues.map(e => Math.abs(e.im) < 1e-6 ? fmtFix(e.re, 2) : `${fmtFix(e.re, 2)}±${fmtFix(Math.abs(e.im), 2)}i`)[0] + (Math.abs(cl.eigenvalues[0].im) < 1e-6 ? `, ${fmtFix(cl.eigenvalues[1].re, 2)}` : '');
      host.querySelector('[data-ctitle]').textContent = '2B Doğrusal Faz Portresi (Tıkla: yörünge ekle)';
      host.querySelector('[data-cbadge]').textContent = cl.type;
      renderKpis(kpis, [
        { lbl: 'Sınıf', val: cl.type, tone: 'acc' },
        { lbl: 'Özdeğerler λ₁,₂', val: eigTxt },
        { lbl: 'İz τ / Det Δ', val: `${fmtFix(cl.trace, 2)} / ${fmtFix(cl.det, 2)}` },
      ]);
    }
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (st.tab === 'pend') {
      for (let k = 0; k < 4; k++) {
        st.p1 = doublePendulumStep(st.p1, {}, dt * 0.25);
        st.p2 = doublePendulumStep(st.p2, {}, dt * 0.25);
      }
      st.tr1.push([Math.sin(st.p1[0]) + Math.sin(st.p1[2]), Math.cos(st.p1[0]) + Math.cos(st.p1[2])]);
      st.tr2.push([Math.sin(st.p2[0]) + Math.sin(st.p2[2]), Math.cos(st.p2[0]) + Math.cos(st.p2[2])]);
      if (st.tr1.length > 220) { st.tr1.shift(); st.tr2.shift(); }
      syncUI();
      return st.playing;
    }
    if (st.tab === 'lorenz') {
      for (let k = 0; k < 5; k++) {
        st.lor = lorenzStep(st.lor, { rho: st.rho }, 0.008);
        st.lorPts.push(st.lor.slice());
      }
      if (st.lorPts.length > 1400) st.lorPts.splice(0, st.lorPts.length - 1400);
      syncUI();
      return st.playing;
    }
    return false;
  }, clean);

  function resetCur() {
    st.p1 = [2.1, 0, 2.3, 0]; st.p2 = [2.101, 0, 2.3, 0]; st.tr1 = []; st.tr2 = [];
    st.lor = [1, 1, 1]; st.lorPts = [];
    for (let k = 0; k < 250; k++) { st.lor = lorenzStep(st.lor, { rho: st.rho }, 0.008); st.lorPts.push(st.lor.slice()); }
    syncUI();
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
    if (st.playing && (st.tab === 'pend' || st.tab === 'lorenz')) loop.start();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-rst]').addEventListener('click', resetCur);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.rho) { st.rho = p.rho; sRho.set(st.rho); }
    if (p.r) { st.logR = p.r; sLogR.set(st.logR); }
    if (p.A) { st.A = p.A.slice(); sA0.set(st.A[0]); sA1.set(st.A[1]); sA2.set(st.A[2]); sA3.set(st.A[3]); }
    resetCur();
  });

  bindTasks(host);
  resetCur();
  if (st.playing) loop.start();
  return clean.run;
}

// 4.4 SAYISAL YÖNTEMLER (Kök Bulma, İntegral, ODE, İnterpolasyon/Runge & EKK)
function mountNumerical(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Newton vs İkiye Bölme (√2)', tab: 'root', rkey: 'sqrt2' },
    { label: 'Gauss–Legendre vs Yamuk', tab: 'int', nPan: 6 },
    { label: 'ODE: RK4 vs Euler (h = 0.3)', tab: 'ode', okey: 'decay', h: 0.3 },
    { label: 'Runge Fenomeni (Lagrange vs Spline)', tab: 'interp', nPts: 11, cheb: false },
  ];
  const st = { tab: 'root', rkey: 'cubic', nPan: 6, okey: 'decay', h: 0.25, nPts: 9, cheb: false, lsDeg: 2 };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Mühendislik sayısal analizinin dört sütunu: **Kök Bulma** (İkiye Bölme / Newton / Sekant), **Sayısal İntegral** (Yamuk / Simpson / Gauss–Legendre), **ODE Çözücüler** (Euler / Heun / RK4) ve **İnterpolasyon / Runge Fenomeni & En Küçük Kareler**.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="root" class="on">Kök Bulma</button>
        <button type="button" data-t="int">Sayısal İntegral</button>
        <button type="button" data-t="ode">ODE (Euler/Heun/RK4)</button>
        <button type="button" data-t="interp">İnterpolasyon & EKK</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-ntitle>Yakınsama & Fonksiyon Grafiği</h4></div>
          <div class="slp-cv-box" data-pbox><canvas class="slp-cv" data-cv aria-label="Sayısal yöntemler grafiği"></canvas></div>
        </div>
        <div class="slp-panel" data-tblbox>
          <h4 class="slp-title">İterasyon / Hata Karşılaştırma Tablosu</h4>
          <div class="slp-table-wrap" data-tbl></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'x_{k+1} = x_k - \\frac{f(x_k)}{f\'(x_k)} \\;(\\text{Newton, } O(e_k^2)), \\qquad I_{\\text{Simpson}} = \\frac{h}{3}\\bigl(f_0 + 4f_1 + 2f_2 + \\dots + f_n\\bigr)',
        '\\text{Global Hata:}\\; \\text{Euler } O(h), \\quad \\text{Heun } O(h^2), \\quad \\text{RK4 } O(h^4)',
      ],
      paragraphs: [
        '**Newton–Raphson** basit köklerde karesel yakınsar (her adımda doğru basamak sayısı ikiye katlanır), **İkiye Bölme** ise her adımda aralığı yarılayarak kesin ama yavaş ($O(2^{-n})$) yakınsar.',
        'Eşit aralıklı yüksek dereceli **Lagrange** interpolasyonunda $1/(1+25x^2)$ fonksiyonunun uçlarında dev salınımlar (**Runge fenomeni**) oluşur; **Chebyshev düğümleri** veya **Doğal Kübik Spline** bunu ortadan kaldırır.',
      ],
      tasks: [
        'Kök Bulma sekmesinde Newton’un 5–6 adımda ulaştığı hassasiyete İkiye Bölmenin kaç adımda ulaştığını tablodan karşılaştır.',
        'İnterpolasyon sekmesinde $N=11$ eşit aralıklı noktada Runge taşmasını gör, sonra **Chebyshev Düğümleri** kutusunu işaretle.',
        'ODE sekmesinde adım boyu $h$’yi 0.4’e çıkararak RK4’ün kesin çözüme sadık kalırken Euler’in nasıl saptığını izle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const cv = host.querySelector('[data-cv]');
  const tbl = host.querySelector('[data-tbl]');

  const selRoot = addSelect(ctrls, 'Test Denklemi f(x) = 0', Object.entries(ROOT_PRESETS).map(([k, v]) => [k, v.label]), st.rkey, v => { st.rkey = v; update(); });
  const sPan = addSlider(ctrls, { label: 'Alt Aralık Sayısı N (Çift)', min: 2, max: 24, step: 2, value: st.nPan, fmt: v => String(Math.round(v)), onInput: v => { st.nPan = Math.round(v); update(); } });
  const selOde = addSelect(ctrls, 'Diferansiyel Denklem', Object.entries(ODE_PRESETS).map(([k, v]) => [k, v.label]), st.okey, v => { st.okey = v; update(); });
  const sH = addSlider(ctrls, { label: 'Adım Boyu h', min: 0.05, max: 0.6, step: 0.05, value: st.h, fmt: v => fmtFix(v, 2), onInput: v => { st.h = v; update(); } });
  const sPts = addSlider(ctrls, { label: 'Düğüm Sayısı (Runge)', min: 5, max: 15, step: 2, value: st.nPts, fmt: v => `${Math.round(v)} nokta`, onInput: v => { st.nPts = Math.round(v); update(); } });
  const tCheb = addToggle(ctrls, 'Chebyshev Düğümleri Kullan', st.cheb, v => { st.cheb = v; update(); });
  const sDeg = addSlider(ctrls, { label: 'EKK Polinom Derecesi', min: 1, max: 5, step: 1, value: st.lsDeg, fmt: v => `${Math.round(v)}. derece`, onInput: v => { st.lsDeg = Math.round(v); update(); } });

  function update() {
    selRoot.setVisible(st.tab === 'root');
    sPan.setVisible(st.tab === 'int');
    [selOde, sH].forEach(x => x.setVisible(st.tab === 'ode'));
    [sPts, tCheb, sDeg].forEach(x => x.setVisible(st.tab === 'interp'));

    if (st.tab === 'root') {
      const p = ROOT_PRESETS[st.rkey];
      const rb = findRootBisection(p.f, p.a, p.b, 1e-8);
      const rn = findRootNewton(p.f, p.df, p.x0, 1e-10);
      const rs = findRootSecant(p.f, p.a, p.b, 1e-10);
      host.querySelector('[data-ntitle]').textContent = `Kök Bulma: ${p.label}`;
      renderKpis(kpis, [
        { lbl: 'İkiye Bölme', val: `${rb.iters.length} adım`, sub: `x = ${fmtFix(rb.root, 6)}` },
        { lbl: 'Newton–Raphson', val: `${rn.iters.length} adım`, sub: `x = ${fmtFix(rn.root, 7)}`, tone: 'ok' },
        { lbl: 'Sekant', val: `${rs.iters.length} adım`, sub: `x = ${fmtFix(rs.root, 7)}`, tone: 'acc' },
      ]);
      const xs = Array.from({ length: 120 }, (_, i) => p.a - 0.3 + ((p.b - p.a + 0.6) * i) / 119);
      safePlot(cv, [{ name: 'f(x)', color: PLOT_COLORS[1], xs, ys: xs.map(p.f) }], { x0: xs[0], x1: xs.at(-1), ylabel: 'f(x)', height: 215 });
      const rows = Math.max(rn.iters.length, rs.iters.length, Math.min(10, rb.iters.length));
      tbl.innerHTML = `<table class="slp-tbl" aria-label="Kök bulma yakınsama tablosu">
        <thead><tr><th>Adım</th><th>İkiye Bölme |e|</th><th>Newton x_k</th><th>Newton |e|</th><th>Sekant |e|</th></tr></thead>
        <tbody>${Array.from({ length: rows }, (_, i) => `<tr>
          <td class="mono">${i + 1}</td>
          <td class="mono">${rb.iters[i] ? fmtNum(Math.abs(rb.iters[i].x - p.exact), 2) : '—'}</td>
          <td class="mono">${rn.iters[i] ? fmtFix(rn.iters[i].xNext, 7) : '—'}</td>
          <td class="mono slp-td-ok">${rn.iters[i] ? fmtNum(Math.abs(rn.iters[i].xNext - p.exact), 2) : '—'}</td>
          <td class="mono">${rs.iters[i] ? fmtNum(Math.abs(rs.iters[i].x - p.exact), 2) : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>`;
      return;
    }

    if (st.tab === 'int') {
      // Test integral: int_0^pi sin(x) dx = 2 and int_0^2 e^x dx = e^2 - 1
      const f = x => Math.exp(x) * Math.sin(2 * x) + 1.5;
      const exact = (Math.exp(2) * (Math.sin(4) - 2 * Math.cos(4)) + 2) / 5 + 3.0;
      const tVal = integrateTrapezoid(f, 0, 2, st.nPan);
      const sVal = integrateSimpson(f, 0, 2, st.nPan);
      const g3 = integrateGaussLegendre(f, 0, 2, 3, Math.max(1, st.nPan / 2));
      const g5 = integrateGaussLegendre(f, 0, 2, 5, 1);
      host.querySelector('[data-ntitle]').textContent = 'Sayısal İntegral: ∫₀² (eˣ sin(2x) + 1.5) dx';
      renderKpis(kpis, [
        { lbl: 'Kesin Değer', val: fmtFix(exact, 7), tone: 'acc' },
        { lbl: `Yamuk (N=${st.nPan}) Hata`, val: fmtNum(Math.abs(tVal - exact), 2), tone: 'warn' },
        { lbl: `Simpson 1/3 Hata`, val: fmtNum(Math.abs(sVal - exact), 2), tone: 'ok' },
        { lbl: 'Gauss-5 (1 panel) Hata', val: fmtNum(Math.abs(g5 - exact), 2), tone: 'ok' },
      ]);
      const xs = Array.from({ length: 140 }, (_, i) => (2 * i) / 139);
      safePlot(cv, [{ name: 'f(x)', color: PLOT_COLORS[1], xs, ys: xs.map(f) }], { x0: 0, x1: 2, ylabel: 'f(x)', height: 215 });
      tbl.innerHTML = `<table class="slp-tbl" aria-label="Sayısal integral hata tablosu">
        <thead><tr><th>Yöntem</th><th>Değer</th><th>Mutlak Hata</th><th>Mertebe</th></tr></thead>
        <tbody>
          <tr><td>Yamuk (Trapezoid, N=${st.nPan})</td><td class="mono">${fmtFix(tVal, 7)}</td><td class="mono">${fmtNum(Math.abs(tVal - exact), 3)}</td><td class="mono">O(h²)</td></tr>
          <tr><td>Simpson 1/3 (N=${st.nPan})</td><td class="mono">${fmtFix(sVal, 7)}</td><td class="mono slp-td-ok">${fmtNum(Math.abs(sVal - exact), 3)}</td><td class="mono">O(h⁴)</td></tr>
          <tr><td>Gauss–Legendre 3-nokta</td><td class="mono">${fmtFix(g3, 7)}</td><td class="mono slp-td-ok">${fmtNum(Math.abs(g3 - exact), 3)}</td><td class="mono">O(h⁶)</td></tr>
          <tr><td>Gauss–Legendre 5-nokta</td><td class="mono">${fmtFix(g5, 7)}</td><td class="mono slp-td-hi">${fmtNum(Math.abs(g5 - exact), 3)}</td><td class="mono">Derece 9 kesin</td></tr>
        </tbody>
      </table>`;
      return;
    }

    if (st.tab === 'ode') {
      const r = solveODECompare({ presetId: st.okey, h: st.h });
      host.querySelector('[data-ntitle]').textContent = `ODE Karşılaştırması (${ODE_PRESETS[st.okey].label})`;
      renderKpis(kpis, [
        { lbl: 'Euler Maks Hata', val: fmtNum(r.maxErr.euler, 3), tone: 'bad' },
        { lbl: 'Heun (RK2) Maks Hata', val: fmtNum(r.maxErr.heun, 3), tone: 'warn' },
        { lbl: 'RK4 Maks Hata', val: fmtNum(r.maxErr.rk4, 3), tone: 'ok' },
      ]);
      safePlot(cv, [
        { name: 'Kesin', color: PLOT_COLORS[0], xs: r.t, ys: r.exact },
        { name: 'RK4', color: PLOT_COLORS[3], xs: r.t, ys: r.rk4 },
        { name: 'Heun', color: PLOT_COLORS[4], xs: r.t, ys: r.heun },
        { name: 'Euler', color: PLOT_COLORS[2], xs: r.t, ys: r.euler },
      ], { x0: 0, x1: r.t.at(-1), ylabel: 'y(t)', height: 225 });
      tbl.innerHTML = `<table class="slp-tbl" aria-label="ODE çözücü adım tablosu">
        <thead><tr><th>t</th><th>Kesin</th><th>Euler</th><th>Heun (RK2)</th><th>RK4</th></tr></thead>
        <tbody>${r.t.slice(0, 12).map((ti, i) => `<tr>
          <td class="mono">${fmtFix(ti, 2)}</td><td class="mono">${fmtFix(r.exact[i], 5)}</td>
          <td class="mono">${fmtFix(r.euler[i], 5)}</td><td class="mono">${fmtFix(r.heun[i], 5)}</td>
          <td class="mono slp-td-ok">${fmtFix(r.rk4[i], 5)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
      return;
    }

    // Interpolation (Runge) & Least Squares
    const runge = x => 1 / (1 + 25 * x * x);
    const knots = st.cheb ? chebyshevNodes(st.nPts, -1, 1) : Array.from({ length: st.nPts }, (_, i) => -1 + (2 * i) / (st.nPts - 1));
    const ky = knots.map(runge);
    const sp = buildCubicSpline(knots, ky);
    const ls = polyLeastSquares(knots, ky, st.lsDeg);
    const xs = Array.from({ length: 161 }, (_, i) => -1 + (2 * i) / 160);
    const yExact = xs.map(runge);
    const yLag = xs.map(x => Math.max(-1.5, Math.min(2.5, evalLagrange(knots, ky, x))));
    const ySpl = xs.map(x => evalCubicSpline(sp, x));
    const yLS = xs.map(x => ls.eval(x));
    const errLag = Math.max(...xs.map((x, i) => Math.abs(evalLagrange(knots, ky, x) - yExact[i])));
    const errSpl = Math.max(...xs.map((x, i) => Math.abs(ySpl[i] - yExact[i])));

    host.querySelector('[data-ntitle]').textContent = 'Runge Fonksiyonu 1/(1+25x²): Lagrange, Spline & EKK';
    renderKpis(kpis, [
      { lbl: 'Lagrange Maks Hata', val: fmtNum(errLag, 3), tone: errLag > 0.3 ? 'bad' : 'ok' },
      { lbl: 'Kübik Spline Hata', val: fmtNum(errSpl, 3), tone: 'ok' },
      { lbl: `EKK (${st.lsDeg}. der) R²`, val: fmtFix(ls.r2, 4), sub: `RMSE = ${fmtFix(ls.rmse, 3)}`, tone: 'acc' },
    ]);
    safePlot(cv, [
      { name: 'Gerçek', color: PLOT_COLORS[0], xs, ys: yExact },
      { name: 'Lagrange', color: PLOT_COLORS[2], xs, ys: yLag },
      { name: 'Kübik Spline', color: PLOT_COLORS[3], xs, ys: ySpl },
      { name: 'EKK Fit', color: PLOT_COLORS[4], xs, ys: yLS },
    ], { x0: -1, x1: 1, ylabel: 'y', height: 225 });
    tbl.innerHTML = `<div class="slp-alert">Kırmızı: Lagrange · Yeşil: Doğal Kübik Spline · Sarı: ${st.lsDeg}. derece En Küçük Kareler · Düğümler: <b>${st.cheb ? 'Chebyshev (Runge önlendi)' : 'Eşit aralıklı'}</b>.</div>`;
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  observeResize(host.querySelector('[data-pbox]'), update, clean);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.rkey) { st.rkey = p.rkey; selRoot.set(st.rkey); }
    if (p.nPan) { st.nPan = p.nPan; sPan.set(st.nPan); }
    if (p.okey) { st.okey = p.okey; st.h = p.h; selOde.set(st.okey); sH.set(st.h); }
    if (p.nPts) { st.nPts = p.nPts; st.cheb = p.cheb; sPts.set(st.nPts); tCheb.set(st.cheb); }
    update();
  });

  bindTasks(host);
  update();
  return clean.run;
}

// 4.5 KUANTUM MEKANİĞİ (Kutu / QHO Süperpozisyon, Tünelleme, Hidrojen Orbitalleri)
function mountQuantum(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Kutu Süperpozisyon (n=1 + n=2)', tab: 'well', sys: 'box', n1: 1, n2: 2, mix: 0.5 },
    { label: 'Harmonik Osilatör (n=0 + n=1)', tab: 'well', sys: 'qho', n1: 0, n2: 1, mix: 0.5 },
    { label: 'Bariyer Tünelleme (E < V₀)', tab: 'tunnel', E: 4.0, V0: 6.0, a: 1.0 },
    { label: 'Hidrojen 3d₀ (n=3, l=2, m=0)', tab: 'hydro', hn: 3, hl: 2, hm: 0 },
  ];
  const st = { tab: 'well', sys: 'box', n1: 1, n2: 2, mix: 0.5, t: 0, E: 4.0, V0: 6.0, a: 1.0, hn: 2, hl: 1, hm: 0, playing: autoPlayAllowed() };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**1B Sonsuz Kuyu** ve **Kuantum Harmonik Osilatör** süperpozisyonlarının zaman evrimini ($|\\Psi(x,t)|^2$) canlı izle; **potansiyel bariyerden tünellemeyi** ($T(E)$) ve **Hidrojen atomu** $|\\psi_{nlm}|^2$ kesitlerini keşfet.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="well" class="on">Kuyu & QHO Süperpozisyon</button>
        <button type="button" data-t="tunnel">Kuantum Tünelleme</button>
        <button type="button" data-t="hydro">Hidrojen Orbitalleri</button>
      </div>
      <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`}</button>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-qtitle>Olasılık Yoğunluğu |Ψ(x,t)|²</h4><span class="slp-badge slp-badge-acc mono" data-qbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Kuantum mekaniği görselleştirmesi"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\Psi(x,t) = c_1 \\psi_{n_1}(x) e^{-i E_{n_1} t / \\hbar} + c_2 \\psi_{n_2}(x) e^{-i E_{n_2} t / \\hbar}',
        'T(E < V_0) = \\left[1 + \\frac{V_0^2 \\sinh^2(\\kappa a)}{4E(V_0 - E)}\\right]^{-1}, \\qquad \\kappa = \\sqrt{\\frac{2m(V_0 - E)}{\\hbar^2}}',
      ],
      paragraphs: [
        'Tek bir enerji özdurumu zamandan bağımsız durağan $|\\psi_n|^2$ verirken, iki farklı enerji özdurumunun süperpozisyonu $\\Delta E / \\hbar$ frekansıyla kutu içinde salınan olasılık dalga paketi oluşturur.',
        'Klasik fizikte $E < V_0$ iken parçacık bariyeri aşamaz; kuantum mekaniğinde bariyer içinde üstel sönümlenen ($e^{-\\kappa x}$) dalga fonksiyonu karşı tarafa sıfırdan farklı $T(E)$ olasılığıyla **tüneller**.',
      ],
      tasks: [
        'Kutu modunda karışımı %0 yapınca olasılık yoğunluğunun durağan kaldığını, %50 yapınca $\\langle x(t)\\rangle$’in salındığını izle.',
        'Tünelleme sekmesinde enerjiyi $E > V_0$ yapıp $T(E) = 1$ olan **Ramsauer–Townsend rezonans** zirvelerini gör.',
        'Hidrojen sekmesinde $(n,l,m) = (2,1,0)$ (2p_z) ve $(3,2,0)$ (3d_{z²}) düğüm yüzeylerini incele.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const selSys = addSelect(ctrls, 'Potansiyel Sistemi', [['box', '1B Sonsuz Kuyu (0..L)'], ['qho', 'Kuantum Harmonik Osilatör']], st.sys, v => { st.sys = v; if (v === 'box' && st.n1 < 1) { st.n1 = 1; sN1.set(1); } syncUI(); });
  const sN1 = addSlider(ctrls, { label: 'Durum n₁', min: 0, max: 5, step: 1, value: st.n1, fmt: v => String(Math.round(v)), onInput: v => { st.n1 = Math.round(v); syncUI(); } });
  const sN2 = addSlider(ctrls, { label: 'Durum n₂', min: 1, max: 6, step: 1, value: st.n2, fmt: v => String(Math.round(v)), onInput: v => { st.n2 = Math.round(v); syncUI(); } });
  const sMix = addSlider(ctrls, { label: 'Süperpozisyon Oranı |c₂|²', min: 0, max: 1, step: 0.05, value: st.mix, fmt: v => `%${Math.round(v * 100)}`, onInput: v => { st.mix = v; syncUI(); } });

  const sE = addSlider(ctrls, { label: 'Parçacık Enerjisi E', min: 0.5, max: 16, step: 0.25, value: st.E, fmt: v => `${fmtFix(v, 2)} eV`, onInput: v => { st.E = v; syncUI(); } });
  const sV0 = addSlider(ctrls, { label: 'Bariyer Yüksekliği V₀', min: 2, max: 12, step: 0.5, value: st.V0, fmt: v => `${fmtFix(v, 1)} eV`, onInput: v => { st.V0 = v; syncUI(); } });
  const sA = addSlider(ctrls, { label: 'Bariyer Genişliği a', min: 0.2, max: 2.5, step: 0.05, value: st.a, fmt: v => fmtFix(v, 2), onInput: v => { st.a = v; syncUI(); } });

  const sHN = addSlider(ctrls, { label: 'Baş Kuantum n', min: 1, max: 4, step: 1, value: st.hn, fmt: v => `n = ${Math.round(v)}`, onInput: v => { st.hn = Math.round(v); st.hl = Math.min(st.hl, st.hn - 1); st.hm = Math.min(st.hm, st.hl); sHL.set(st.hl); sHM.set(st.hm); syncUI(); } });
  const sHL = addSlider(ctrls, { label: 'Açısal Momentum l (0=s,1=p,2=d,3=f)', min: 0, max: 3, step: 1, value: st.hl, fmt: v => `${Math.round(v)} (${'spdf'[Math.round(v)]})`, onInput: v => { st.hl = Math.min(st.hn - 1, Math.round(v)); st.hm = Math.min(st.hm, st.hl); sHL.set(st.hl); sHM.set(st.hm); syncUI(); } });
  const sHM = addSlider(ctrls, { label: 'Manyetik Kuantum |m|', min: 0, max: 3, step: 1, value: st.hm, fmt: v => `m = ${Math.round(v)}`, onInput: v => { st.hm = Math.min(st.hl, Math.round(v)); sHM.set(st.hm); syncUI(); } });

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(320, Math.max(240, w * 0.56)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (st.tab === 'well') {
      const n1Eff = st.sys === 'box' ? Math.max(1, st.n1) : st.n1;
      const n2Eff = st.sys === 'box' ? Math.max(1, st.n2) : st.n2;
      const sup = superpositionWave({ system: st.sys, n1: n1Eff, n2: n2Eff, mix: st.mix, t: st.t, L: 1, samples: 180 });
      const pad = 28, pw = W - 2 * pad, baseY = H - 30, scY = H * 0.25;
      c.strokeStyle = COL_AXIS; c.beginPath(); c.moveTo(pad, baseY); c.lineTo(W - pad, baseY); c.stroke();
      const xMin = sup.xs[0], xSpan = sup.xs.at(-1) - xMin;
      const fx = x => pad + ((x - xMin) / xSpan) * pw;
      // Probability fill |Psi|^2
      c.fillStyle = 'rgba(90,176,255,0.28)'; c.strokeStyle = COL_BLUE; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(fx(sup.xs[0]), baseY);
      sup.prob.forEach((pr, i) => c.lineTo(fx(sup.xs[i]), baseY - pr * scY));
      c.lineTo(fx(sup.xs.at(-1)), baseY); c.closePath(); c.fill(); c.stroke();
      // Re(Psi) overlay
      c.strokeStyle = COL_WARN; c.lineWidth = 1.4; c.beginPath();
      sup.re.forEach((rv, i) => { const x = fx(sup.xs[i]), y = baseY - 90 - rv * 36; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
      c.stroke();
      // Expectation value marker <x>
      const ex = fx(sup.expX);
      c.strokeStyle = COL_OK; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(ex, 16); c.lineTo(ex, baseY); c.stroke(); c.setLineDash([]);
      c.fillStyle = COL_OK; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`⟨x⟩=${fmtFix(sup.expX, 2)}`, ex, 14);
      return;
    }

    if (st.tab === 'tunnel') {
      // Top half: barrier + animated wave; bottom half: T(E) vs E curve
      const midY = H * 0.48;
      const bx1 = W * 0.42, bx2 = bx1 + st.a * 48;
      const bh = Math.min(midY - 22, st.V0 * 9);
      c.fillStyle = 'rgba(255,107,107,0.22)'; c.strokeStyle = COL_BAD; c.lineWidth = 1.8;
      c.fillRect(bx1, midY - bh, bx2 - bx1, bh); c.strokeRect(bx1, midY - bh, bx2 - bx1, bh);
      const tun = tunnelTransmission({ E: st.E, V0: st.V0, a: st.a });
      const ey = midY - Math.min(midY - 14, st.E * 9);
      // Wave
      c.strokeStyle = COL_BLUE; c.lineWidth = 2; c.beginPath();
      for (let x = 16; x < W - 16; x += 2) {
        let amp = 0;
        if (x < bx1) amp = 16 * Math.cos(0.14 * x - st.t * 4) + 12 * Math.sqrt(tun.R) * Math.cos(-0.14 * x - st.t * 4);
        else if (x <= bx2) {
          const u = (x - bx1) / Math.max(1, bx2 - bx1);
          amp = 16 * (st.E < st.V0 ? Math.exp(-tun.kappa * st.a * u) : 1) * Math.cos(0.08 * x - st.t * 4);
        } else amp = 16 * Math.sqrt(tun.T) * Math.cos(0.14 * x - st.t * 4);
        if (x === 16) c.moveTo(x, ey - amp); else c.lineTo(x, ey - amp);
      }
      c.stroke();
      // Bottom: T(E) plot
      const gTop = midY + 24, gH = H - gTop - 22, pad = 28, pw = W - 2 * pad;
      c.strokeStyle = COL_AXIS; c.strokeRect(pad, gTop, pw, gH);
      c.strokeStyle = COL_OK; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i <= 140; i++) {
        const eVal = 0.2 + (16 * i) / 140;
        const tv = tunnelTransmission({ E: eVal, V0: st.V0, a: st.a }).T;
        const px = pad + (eVal / 16.2) * pw, py = gTop + (1 - tv) * gH;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      const curX = pad + (st.E / 16.2) * pw, curY = gTop + (1 - tun.T) * gH;
      c.beginPath(); c.arc(curX, curY, 5, 0, Math.PI * 2); c.fillStyle = COL_WARN; c.fill();
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
      c.fillText(`T(E) = %${fmtFix(tun.T * 100, 1)}`, pad + 6, gTop + 14);
      return;
    }

    // Hydrogen orbital density (x, z) slice + radial probability curve on right
    const sz = Math.min(H - 20, W * 0.56);
    const sx = 14, sy = (H - sz) / 2;
    const G = 52, cell = sz / G, Rmax = st.hn * st.hn * 3.2 + 5;
    const vals = new Float32Array(G * G);
    let maxD = 1e-12;
    for (let j = 0; j < G; j++) {
      const z = Rmax * (1 - (2 * (j + 0.5)) / G);
      for (let i = 0; i < G; i++) {
        const x = Rmax * ((2 * (i + 0.5)) / G - 1);
        const d = hydrogenWaveDensity(st.hn, st.hl, st.hm, x, z);
        vals[j * G + i] = d;
        if (d > maxD) maxD = d;
      }
    }
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const v = Math.pow(vals[j * G + i] / maxD, 0.38);
        c.fillStyle = `rgb(${Math.round(40 + 215 * v)},${Math.round(80 * v + 140 * v * v)},${Math.round(160 * v + 95 * v * v)})`;
        c.fillRect(sx + i * cell, sy + j * cell, cell + 0.6, cell + 0.6);
      }
    }
    // Right: radial probability P(r) = r^2 |R_nl(r)|^2
    const gx = sx + sz + 26, gw = W - gx - 16, gy = 26, gh = H - 52;
    if (gw > 70) {
      const rs = [], ps = [];
      let pMx = 1e-9;
      for (let i = 0; i <= 100; i++) {
        const r = (Rmax * 1.15 * i) / 100;
        const pr = hydrogenRadialProb(st.hn, st.hl, r);
        rs.push(r); ps.push(pr); if (pr > pMx) pMx = pr;
      }
      c.strokeStyle = COL_OK; c.lineWidth = 2; c.beginPath();
      rs.forEach((r, i) => {
        const px = gx + (i / 100) * gw, py = gy + (1 - ps[i] / pMx) * gh;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      });
      c.stroke();
      c.fillStyle = COL_MUTE; c.font = '10.5px "JetBrains Mono", monospace';
      c.fillText('4πr²|R_nl(r)|²', gx, gy - 8);
      c.fillText(`r (0..${Math.round(Rmax)} a₀)`, gx, H - 8);
    }
  }, clean);

  function syncUI() {
    [selSys, sN1, sN2, sMix].forEach(x => x.setVisible(st.tab === 'well'));
    [sE, sV0, sA].forEach(x => x.setVisible(st.tab === 'tunnel'));
    [sHN, sHL, sHM].forEach(x => x.setVisible(st.tab === 'hydro'));

    if (st.tab === 'well') {
      const n1 = st.sys === 'box' ? Math.max(1, st.n1) : st.n1;
      const n2 = st.sys === 'box' ? Math.max(1, st.n2) : st.n2;
      const E1 = st.sys === 'box' ? n1 * n1 : n1 + 0.5;
      const E2 = st.sys === 'box' ? n2 * n2 : n2 + 0.5;
      host.querySelector('[data-qtitle]').textContent = st.sys === 'box' ? '1B Sonsuz Kuyu · Süperpozisyon' : 'Kuantum Harmonik Osilatör';
      host.querySelector('[data-qbadge]').textContent = `E₁=${E1}, E₂=${E2}`;
      renderKpis(kpis, [
        { lbl: 'Enerji Düzeyleri', val: `E₁ = ${E1}, E₂ = ${E2}`, tone: 'acc' },
        { lbl: 'Salınım Frekansı ΔE', val: fmtFix(Math.abs(E2 - E1), 2) },
        { lbl: 'Karışım', val: `%${Math.round((1 - st.mix) * 100)} / %${Math.round(st.mix * 100)}` },
      ]);
    } else if (st.tab === 'tunnel') {
      const tun = tunnelTransmission({ E: st.E, V0: st.V0, a: st.a });
      host.querySelector('[data-qtitle]').textContent = 'Dikdörtgen Bariyerden Kuantum Tünelleme';
      host.querySelector('[data-qbadge]').textContent = `T + R = ${fmtFix(tun.T + tun.R, 3)}`;
      renderKpis(kpis, [
        { lbl: 'Geçiş Olasılığı T(E)', val: `%${fmtFix(tun.T * 100, 2)}`, tone: 'ok' },
        { lbl: 'Yansıma Olasılığı R(E)', val: `%${fmtFix(tun.R * 100, 2)}`, tone: 'warn' },
        { lbl: 'Rejim', val: st.E < st.V0 ? 'Tünelleme (E < V₀)' : 'Bariyer Üstü (E ≥ V₀)', tone: 'acc' },
      ]);
    } else {
      const orbName = `${st.hn}${'spdf'[st.hl]} (m=${st.hm})`;
      const eEv = -13.6 / (st.hn * st.hn);
      host.querySelector('[data-qtitle]').textContent = `Hidrojen Atomu |ψ_${st.hn}${st.hl}${st.hm}(x,z)|² Kesiti`;
      host.querySelector('[data-qbadge]').textContent = orbName;
      renderKpis(kpis, [
        { lbl: 'Orbital', val: orbName, tone: 'acc' },
        { lbl: 'Bağlanma Enerjisi E_n', val: `${fmtFix(eEv, 2)} eV`, tone: 'ok' },
        { lbl: 'Radyal / Açısal Düğüm', val: `${st.hn - st.hl - 1} / ${st.hl}` },
      ]);
    }
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (st.tab === 'hydro') return false;
    st.t += dt * 1.4;
    cv.render();
    return st.playing;
  }, clean);

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
    if (st.playing && st.tab !== 'hydro') loop.start();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.sys) { st.sys = p.sys; st.n1 = p.n1; st.n2 = p.n2; st.mix = p.mix; selSys.set(st.sys); sN1.set(st.n1); sN2.set(st.n2); sMix.set(st.mix); }
    if (p.E) { st.E = p.E; st.V0 = p.V0; st.a = p.a; sE.set(st.E); sV0.set(st.V0); sA.set(st.a); }
    if (p.hn) { st.hn = p.hn; st.hl = p.hl; st.hm = p.hm; sHN.set(st.hn); sHL.set(st.hl); sHM.set(st.hm); }
    syncUI();
  });

  bindTasks(host);
  syncUI();
  if (st.playing) loop.start();
  return clean.run;
}

// 4.6 FARADAY İNDÜKSİYONU & LC SALINIMI
function mountEMInduction(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Faraday · Hızlı Mıknatıs Geçişi', tab: 'faraday', N: 150, speed: 0.9, R: 8 },
    { label: 'Faraday · Yavaş Geçiş', tab: 'faraday', N: 150, speed: 0.3, R: 8 },
    { label: 'Kayıpsız LC Enerji Alışverişi', tab: 'lc', L: 10, C: 100, R: 0, V0: 12 },
    { label: 'Sönümlü RLC Salınımı', tab: 'lc', L: 10, C: 100, R: 2.5, V0: 12 },
  ];
  const st = { tab: 'faraday', N: 150, speed: 0.65, R_f: 10, magX: -0.22, dir: 1, L_mH: 10, C_uF: 100, R_lc: 0, V0: 12, tLC: 0, playing: autoPlayAllowed() };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('**Faraday İndüksiyonu** modunda çubuk mıknatısı bobinin içinden geçirip (veya sürükleyip) Lenz yönünü, manyetik akı $\\Phi(t)$ ve indüklenen EMK $\\mathcal{E} = -N\\,d\\Phi/dt$ darbesini gözle; **LC Salınımında** elektrik ($U_E$) ve manyetik ($U_B$) enerji değişimini canlı izle.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="faraday" class="on">Faraday İndüksiyonu</button>
        <button type="button" data-t="lc">LC / RLC Enerji Salınımı</button>
      </div>
      <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`}</button>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-etitle>Bobin & Hareketli Mıknatıs (Mıknatısı Sürükle)</h4><span class="slp-badge slp-badge-acc mono" data-ebadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv slp-cv-drag" data-cv aria-label="Faraday indüksiyon ve LC enerji animasyonu"></canvas></div>
        </div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-ptitle>Akı Φ(t) ve İndüklenen EMK ε(t)</h4></div>
          <div class="slp-cv-box" data-pb><canvas class="slp-cv" data-pcv aria-label="Faraday veya LC zaman grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathcal{E} = -N\\frac{d\\Phi_B}{dt} = -N\\frac{d\\Phi_B}{dx}\\,v \\quad (\\text{Faraday–Lenz Yasası})',
        'U_{\\text{top}} = U_E + U_B = \\frac{1}{2}CV^2 + \\frac{1}{2}LI^2, \\qquad f_0 = \\frac{1}{2\\pi\\sqrt{LC}}',
      ],
      paragraphs: [
        'Mıknatıs bobine yaklaşırken akı artar ve indüklenen EMK bir yönde tepe yapar; bobin merkezinden geçerken $d\\Phi/dx = 0$ olduğu için EMK anlık olarak sıfırlanır ve uzaklaşırken zıt işaretli ikinci bir tepe oluşturur.',
        'Dirençsiz ($R=0$) ideal bir **LC** devresinde enerji kondansatörün elektrik alanı ($U_E$) ile bobinin manyetik alanı ($U_B$) arasında $f_0$ frekansında kayıpsız gidip gelir.',
      ],
      tasks: [
        'Faraday modunda mıknatıs hızını iki katına çıkarınca tepe EMK’nin tam iki katına çıktığını doğrula.',
        'LC modunda direnci $R=0$ tutup toplam enerjinin $U_E + U_B = \\text{sabit}$ kaldığını, $R>0$ yapınca ısıya dönüşerek sönümlendiğini gözle.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const cvEl = host.querySelector('[data-cv]'), pcv = host.querySelector('[data-pcv]');

  const sN = addSlider(ctrls, { label: 'Sarım Sayısı N', min: 20, max: 300, step: 10, value: st.N, fmt: v => `${Math.round(v)} sarım`, onInput: v => { st.N = v; update(); } });
  const sSpd = addSlider(ctrls, { label: 'Mıknatıs Hızı v', unit: 'm/s', min: 0.1, max: 1.5, step: 0.05, value: st.speed, fmt: v => `${fmtFix(v, 2)} m/s`, onInput: v => { st.speed = v; update(); } });
  const sRf = addSlider(ctrls, { label: 'Bobin Direnci R', unit: 'Ω', min: 2, max: 50, step: 1, value: st.R_f, fmt: v => `${Math.round(v)} Ω`, onInput: v => { st.R_f = v; update(); } });

  const sL = addSlider(ctrls, { label: 'Endüktans L', unit: 'mH', min: 1, max: 50, step: 1, value: st.L_mH, fmt: v => `${Math.round(v)} mH`, onInput: v => { st.L_mH = v; update(); } });
  const sC = addSlider(ctrls, { label: 'Kapasitans C', unit: 'µF', min: 10, max: 400, step: 10, value: st.C_uF, fmt: v => `${Math.round(v)} µF`, onInput: v => { st.C_uF = v; update(); } });
  const sRlc = addSlider(ctrls, { label: 'Seri Direnç R', unit: 'Ω', min: 0, max: 10, step: 0.25, value: st.R_lc, fmt: v => `${fmtFix(v, 2)} Ω`, onInput: v => { st.R_lc = v; update(); } });

  let farRes = null, lcRes = null, dragging = false;

  const cv = setupCanvas(cvEl, () => 200, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const cy = H / 2;
    if (st.tab === 'faraday') {
      const cx = W / 2;
      // Coil loops
      c.strokeStyle = COL_WARN; c.lineWidth = 2.4;
      for (let k = -3; k <= 3; k++) {
        c.beginPath(); c.ellipse(cx + k * 9, cy, 7, 42, 0, 0, Math.PI * 2); c.stroke();
      }
      // Magnet
      const mx = cx + (st.magX / 0.25) * (W * 0.38);
      c.fillStyle = COL_BAD; c.fillRect(mx - 34, cy - 14, 34, 28);
      c.fillStyle = COL_BLUE; c.fillRect(mx, cy - 14, 34, 28);
      c.fillStyle = '#fff'; c.font = 'bold 12px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText('N', mx - 17, cy + 4); c.fillText('S', mx + 17, cy + 4);
      // Galvanometer bulb glow proportional to |emf|
      const vCur = st.playing ? st.speed * st.dir : 0;
      const emfNow = magnetCoilEmf(st.magX, vCur, { N: st.N, m: 2.0, coilR: 0.05 });
      const glow = Math.min(1, Math.abs(emfNow) / 0.15);
      c.beginPath(); c.arc(cx, 28, 12, 0, Math.PI * 2);
      c.fillStyle = `rgba(255,209,102,${0.15 + 0.85 * glow})`; c.fill();
      c.strokeStyle = COL_WARN; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = COL_FG; c.font = '11px "JetBrains Mono", monospace';
      c.fillText(`ε = ${fmtFix(emfNow * 1000, 1)} mV`, cx + 68, 32);
      return;
    }

    // LC Energy bar gauge + oscillating schematic
    if (!lcRes) return;
    const idx = Math.floor(((st.tLC % lcRes.t.at(-1)) / lcRes.t.at(-1)) * (lcRes.t.length - 1));
    const ue = lcRes.UE[idx], ub = lcRes.UB[idx], u0 = Math.max(1e-9, lcRes.U0);
    const barW = Math.min(180, W * 0.34), maxH = H - 62;
    const drawGauge = (x, val, lbl, col) => {
      const h = (val / u0) * maxH;
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.strokeRect(x, 26, barW, maxH);
      c.fillStyle = col; c.fillRect(x + 2, 26 + maxH - h, barW - 4, h);
      c.fillStyle = COL_FG; c.font = '600 11.5px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(`${lbl}: ${fmtFix(val * 1000, 2)} mJ`, x + barW / 2, H - 12);
    };
    drawGauge(W * 0.12, ue, 'U_E (Kondansatör)', COL_BLUE);
    drawGauge(W * 0.88 - barW, ub, 'U_B (Bobin)', COL_OK);
  }, clean);

  cvEl.addEventListener('pointerdown', e => { if (st.tab === 'faraday') { dragging = true; cvEl.setPointerCapture?.(e.pointerId); } });
  cvEl.addEventListener('pointermove', e => {
    if (!dragging || st.tab !== 'faraday') return;
    const [px] = canvasPos(cvEl, e);
    const { W } = cv.size();
    st.magX = Math.max(-0.24, Math.min(0.24, ((px - W / 2) / (W * 0.38)) * 0.25));
    cv.render();
  });
  cvEl.addEventListener('pointerup', () => { dragging = false; });

  function drawPlot() {
    if (st.tab === 'faraday' && farRes) {
      safePlot(pcv, [
        { name: 'EMK (mV)', color: PLOT_COLORS[4], xs: farRes.t, ys: farRes.emf.map(v => v * 1000) },
        { name: 'Akı (µWb)', color: PLOT_COLORS[1], xs: farRes.t, ys: farRes.flux.map(v => v * 1e6) },
      ], { x0: 0, x1: farRes.tEnd, ylabel: 'mV / µWb', height: 205 });
    } else if (st.tab === 'lc' && lcRes) {
      const tMs = lcRes.t.map(v => v * 1000);
      safePlot(pcv, [
        { name: 'U_E (mJ)', color: PLOT_COLORS[1], xs: tMs, ys: lcRes.UE.map(u => u * 1000) },
        { name: 'U_B (mJ)', color: PLOT_COLORS[3], xs: tMs, ys: lcRes.UB.map(u => u * 1000) },
        { name: 'U_top (mJ)', color: PLOT_COLORS[0], xs: tMs, ys: lcRes.Utot.map(u => u * 1000) },
      ], { x0: 0, x1: tMs.at(-1), ylabel: 'mJ', height: 205 });
    }
  }

  function update() {
    const isFar = st.tab === 'faraday';
    [sN, sSpd, sRf].forEach(x => x.setVisible(isFar));
    [sL, sC, sRlc].forEach(x => x.setVisible(!isFar));
    if (isFar) {
      farRes = simulateFaradayPass({ N: st.N, R_ohm: st.R_f, speed: st.speed });
      host.querySelector('[data-etitle]').textContent = 'Bobin & Hareketli Mıknatıs (Faraday–Lenz)';
      host.querySelector('[data-ptitle]').textContent = 'Geçiş Boyunca Manyetik Akı Φ(t) & İndüklenen EMK ε(t)';
      host.querySelector('[data-ebadge]').textContent = `N = ${st.N}`;
      renderKpis(kpis, [
        { lbl: 'Tepe EMK |ε_maks|', val: `${fmtFix(farRes.maxEmf * 1000, 1)} mV`, tone: 'acc' },
        { lbl: 'Tepe Akım I_maks', val: `${fmtFix((farRes.maxEmf / st.R_f) * 1000, 2)} mA`, tone: 'ok' },
        { lbl: 'Tepe Akı Φ_maks', val: `${fmtFix(farRes.maxFlux * 1e6, 1)} µWb` },
      ]);
    } else {
      lcRes = simulateLCEnergy({ L: st.L_mH * 1e-3, C: st.C_uF * 1e-6, R: st.R_lc, V0: st.V0, cycles: 3 });
      host.querySelector('[data-etitle]').textContent = 'LC / RLC Elektrik (U_E) ↔ Manyetik (U_B) Enerji Değişimi';
      host.querySelector('[data-ptitle]').textContent = 'Enerji Bileşenleri U_E(t), U_B(t) ve Toplam Enerji (mJ)';
      host.querySelector('[data-ebadge]').textContent = `f₀ = ${fmtFix(lcRes.f0, 1)} Hz`;
      renderKpis(kpis, [
        { lbl: 'Rezonans Frekansı f₀', val: `${fmtFix(lcRes.f0, 1)} Hz`, sub: `T₀ = ${fmtFix(lcRes.T0 * 1000, 2)} ms`, tone: 'acc' },
        { lbl: 'Başlangıç Enerjisi U₀', val: `${fmtFix(lcRes.U0 * 1000, 2)} mJ`, tone: 'ok' },
        { lbl: 'Kalite Faktörü Q', val: lcRes.Q === Infinity ? '∞ (Kayıpsız)' : fmtFix(lcRes.Q, 2) },
      ]);
    }
    cv.render(); drawPlot();
  }

  const loop = createAnimLoop((_now, dt) => {
    if (st.tab === 'faraday' && !dragging) {
      st.magX += st.dir * st.speed * dt * 0.55;
      if (st.magX > 0.24) { st.magX = 0.24; st.dir = -1; }
      if (st.magX < -0.24) { st.magX = -0.24; st.dir = 1; }
    } else if (st.tab === 'lc' && lcRes) {
      st.tLC += dt * lcRes.T0 * 0.45;
    }
    cv.render();
    return st.playing;
  }, clean);

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    update();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  observeResize(host.querySelector('[data-pb]'), drawPlot, clean);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.tab === 'faraday') { st.N = p.N; st.speed = p.speed; st.R_f = p.R; sN.set(st.N); sSpd.set(st.speed); sRf.set(st.R_f); }
    else { st.L_mH = p.L; st.C_uF = p.C; st.R_lc = p.R; st.V0 = p.V0; sL.set(st.L_mH); sC.set(st.C_uF); sRlc.set(st.R_lc); }
    update();
  });

  bindTasks(host);
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// 4.7 GÖRELİLİK & MODERN FİZİK (Işık Saati, Fotoelektrik, Compton Saçılması)
function mountRelativity(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Görelilik · v = 0.80c (γ = 1.67)', tab: 'rel', beta: 0.80 },
    { label: 'Ultra-Göreli · v = 0.96c (γ = 3.57)', tab: 'rel', beta: 0.96 },
    { label: 'Fotoelektrik · Sodyum + UV (300 nm)', tab: 'photo', metal: 'Na', lam: 300 },
    { label: 'Compton · 90° X-Işını Saçılması', tab: 'compton', cLam: 5.0, cAng: 90 },
  ];
  const st = { tab: 'rel', beta: 0.80, L0: 100, metal: 'Na', lam: 320, inten: 1.0, cLam: 5.0, cAng: 90, t: 0, playing: autoPlayAllowed() };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Özel Görelilikte **Işık Saati** animasyonuyla zaman genişlemesi ($\\Delta t = \\gamma \\Delta\\tau$) ve uzunluk büzülmesini ($L = L_0/\\gamma$) gör; **Fotoelektrik Etki** ve **Compton Saçılmasını** canlı hesapla.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="rel" class="on">Özel Görelilik (Işık Saati)</button>
        <button type="button" data-t="photo">Fotoelektrik Etki</button>
        <button type="button" data-t="compton">Compton Saçılması</button>
      </div>
      <button type="button" class="btn small primary" data-play>${st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`}</button>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-rtitle>Durgun vs Hareketli Işık Saati</h4><span class="slp-badge slp-badge-acc mono" data-rbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Modern fizik ve görelilik animasyonu"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\gamma = \\frac{1}{\\sqrt{1 - \\beta^2}}, \\qquad \\Delta t = \\gamma \\Delta \\tau, \\qquad L = \\frac{L_0}{\\gamma}',
        'K_{\\max} = \\frac{hc}{\\lambda} - \\phi \\;(\\text{Fotoelektrik}), \\qquad \\Delta\\lambda = \\frac{h}{m_e c}(1 - \\cos\\theta) \\;(\\text{Compton})',
      ],
      paragraphs: [
        'Işık hızı $c$ tüm eylemsiz gözlemciler için sabittir; bu yüzden $v = \\beta c$ ile giden ışık saatinde foton çapraz daha uzun bir yol alır ve hareketli saat durgun gözlemciye göre $\\gamma$ kat yavaş işler.',
        '**Fotoelektrik etkide** elektron koparılması ışığın şiddetine değil foton enerjisi $hf > \\phi$ koşuluna bağlıdır. **Compton saçılmasında** dalga boyu kayması yalnızca saçılma açısı $\\theta$’ya bağlıdır ($\\theta=90^\\circ$’de tam $2.426\\text{ pm}$).',
      ],
      tasks: [
        'Özel Görelilikte $\\beta = 0.6$ yapıp $\\gamma = 1.25$ ve $L = 80\\text{ m}$ olduğunu doğrula.',
        'Fotoelektrikte Sodyum için dalga boyunu eşik değer $\\lambda_0 \\approx 525\\text{ nm}$ üstüne çıkarıp elektron akımının anında kesildiğini gör.',
        'Compton modunda $\\theta = 180^\\circ$ geri saçılmada $\\Delta\\lambda = 2\\lambda_C \\approx 4.85\\text{ pm}$ olduğunu doğrula.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const sBeta = addSlider(ctrls, { label: 'Hız Oranı β = v/c', min: 0, max: 0.99, step: 0.01, value: st.beta, fmt: v => `${fmtFix(v, 2)} c`, onInput: v => { st.beta = v; syncUI(); } });
  const selMet = addSelect(ctrls, 'Katot Metali (İş Fonksiyonu φ)', Object.entries(PHOTO_METALS).map(([k, v]) => [k, `${v.name} (φ = ${v.phiEv} eV)`]), st.metal, v => { st.metal = v; syncUI(); });
  const sLam = addSlider(ctrls, { label: 'Gelen Işık Dalga Boyu λ', unit: 'nm', min: 150, max: 720, step: 5, value: st.lam, fmt: v => `${Math.round(v)} nm`, onInput: v => { st.lam = v; syncUI(); } });
  const sInt = addSlider(ctrls, { label: 'Işık Şiddeti', min: 0.2, max: 2.0, step: 0.1, value: st.inten, fmt: v => `${fmtFix(v, 1)}×`, onInput: v => { st.inten = v; syncUI(); } });
  const sCLam = addSlider(ctrls, { label: 'Gelen Foton λ₀', unit: 'pm', min: 1.0, max: 25.0, step: 0.5, value: st.cLam, fmt: v => `${fmtFix(v, 1)} pm`, onInput: v => { st.cLam = v; syncUI(); } });
  const sCAng = addSlider(ctrls, { label: 'Saçılma Açısı θ', unit: '°', min: 0, max: 180, step: 5, value: st.cAng, fmt: v => `${Math.round(v)}°`, onInput: v => { st.cAng = v; syncUI(); } });

  const cv = setupCanvas(host.querySelector('[data-cv]'), () => 255, (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (st.tab === 'rel') {
      const m = lorentzMetrics(st.beta, st.L0, 1.0);
      const topY = 44, botY = H - 58, span = botY - topY;
      // Left: stationary light clock
      const lx = W * 0.22;
      c.strokeStyle = COL_FG; c.lineWidth = 3;
      c.beginPath(); c.moveTo(lx - 26, topY); c.lineTo(lx + 26, topY); c.moveTo(lx - 26, botY); c.lineTo(lx + 26, botY); c.stroke();
      const ph0 = (st.t * 1.1) % 2;
      const py0 = ph0 < 1 ? botY - ph0 * span : topY + (ph0 - 1) * span;
      c.strokeStyle = 'rgba(255,209,102,0.35)'; c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(lx, botY); c.lineTo(lx, topY); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(lx, py0, 6, 0, Math.PI * 2); c.fillStyle = COL_WARN; c.fill();
      c.fillStyle = COL_MUTE; c.font = '11px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText('Durgun Saat (τ)', lx, 24);

      // Right: moving light clock (zigzag diagonal photon + contracted mirror width!)
      const rx0 = W * 0.48, rxSpan = W * 0.44;
      const halfM = Math.max(8, 26 / m.gamma); // Lorentz length contraction!
      const phM = ((st.t * 1.1) / m.gamma) % 2;
      const cxM = rx0 + (phM / 2) * rxSpan;
      const pyM = phM < 1 ? botY - phM * span : topY + (phM - 1) * span;
      // Zigzag path
      c.strokeStyle = 'rgba(90,176,255,0.45)'; c.setLineDash([4, 4]); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(rx0, botY); c.lineTo(rx0 + rxSpan / 2, topY); c.lineTo(rx0 + rxSpan, botY); c.stroke(); c.setLineDash([]);
      c.strokeStyle = COL_BLUE; c.lineWidth = 3;
      c.beginPath(); c.moveTo(cxM - halfM, topY); c.lineTo(cxM + halfM, topY); c.moveTo(cxM - halfM, botY); c.lineTo(cxM + halfM, botY); c.stroke();
      c.beginPath(); c.arc(cxM, pyM, 6, 0, Math.PI * 2); c.fillStyle = COL_WARN; c.fill();
      c.fillStyle = COL_BLUE; c.fillText(`Hareketli (v=${fmtFix(st.beta, 2)}c · L=${fmtFix(100 / m.gamma, 0)}%)`, rx0 + rxSpan / 2, 24);
      c.fillStyle = COL_OK; c.fillText(`Zaman: Δt = ${fmtFix(m.gamma, 2)} τ`, W / 2, H - 16);
      return;
    }

    if (st.tab === 'photo') {
      const phi = PHOTO_METALS[st.metal].phiEv;
      const pe = solvePhotoelectric({ lambdaNm: st.lam, phiEv: phi, intensity: st.inten });
      const col = st.lam < 380 ? '#a78bfa' : wavelengthToRGB(st.lam);
      // Cathode (left) & Anode (right)
      c.fillStyle = 'rgba(244,244,245,0.35)'; c.fillRect(42, 36, 14, H - 72);
      c.fillStyle = 'rgba(90,176,255,0.35)'; c.fillRect(W - 56, 36, 14, H - 72);
      // Incoming photons
      const nPh = Math.round(3 + st.inten * 4);
      for (let i = 0; i < nPh; i++) {
        const u = ((st.t * 0.7 + i / nPh) % 1);
        const px = 120 - u * 64, py = 46 + (i / nPh) * (H - 96) - (1 - u) * 24;
        c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fillStyle = col; c.fill();
      }
      // Emitted electrons if hf > phi
      if (pe.emitted) {
        const spd = 0.25 + 0.22 * Math.sqrt(pe.kMaxEv);
        const nEl = Math.round(4 + st.inten * 6);
        for (let i = 0; i < nEl; i++) {
          const u = ((st.t * spd + i / nEl) % 1);
          const ex = 58 + u * (W - 118), ey = 54 + ((i * 37) % (H - 108));
          c.beginPath(); c.arc(ex, ey, 4.5, 0, Math.PI * 2); c.fillStyle = COL_OK; c.fill();
        }
      } else {
        c.fillStyle = COL_BAD; c.font = '600 13px var(--font)'; c.textAlign = 'center';
        c.fillText('Foton enerjisi iş fonksiyonundan küçük (E < φ) — Elektron kopmuyor!', W / 2, H / 2);
      }
      return;
    }

    // Compton scattering diagram
    const cx = W * 0.46, cy = H / 2;
    const cm = solveCompton({ lambdaPm: st.cLam, thetaDeg: st.cAng });
    // Incident photon
    drawArrow(c, 34, cy, cx - 10, cy, COL_BLUE, 2.5, 8);
    c.fillStyle = COL_BLUE; c.font = '11px "JetBrains Mono", monospace';
    c.fillText(`λ₀ = ${fmtFix(st.cLam, 1)} pm`, 42, cy - 12);
    // Target electron
    c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
    // Scattered photon
    const th = (st.cAng * Math.PI) / 180;
    drawArrow(c, cx, cy, cx + 105 * Math.cos(th), cy - 105 * Math.sin(th), COL_WARN, 2.4, 8);
    c.fillStyle = COL_WARN; c.fillText(`λ′=${fmtFix(cm.lambdaOutPm, 2)} pm (θ=${st.cAng}°)`, cx + 60 * Math.cos(th), cy - 60 * Math.sin(th) - 12);
    // Recoil electron
    const ph = (cm.phiDeg * Math.PI) / 180;
    if (st.cAng > 1) {
      drawArrow(c, cx, cy, cx + 92 * Math.cos(ph), cy + 92 * Math.sin(ph), COL_OK, 2.4, 8);
      c.fillStyle = COL_OK; c.fillText(`e⁻ (T=${fmtFix(cm.Te_keV, 1)} keV, φ=${fmtFix(cm.phiDeg, 1)}°)`, cx + 52 * Math.cos(ph), cy + 52 * Math.sin(ph) + 18);
    }
  }, clean);

  function syncUI() {
    sBeta.setVisible(st.tab === 'rel');
    [selMet, sLam, sInt].forEach(x => x.setVisible(st.tab === 'photo'));
    [sCLam, sCAng].forEach(x => x.setVisible(st.tab === 'compton'));

    if (st.tab === 'rel') {
      const m = lorentzMetrics(st.beta, st.L0, 1.0);
      host.querySelector('[data-rtitle]').textContent = 'Durgun ve Hareketli Işık Saati (Zaman Genişlemesi)';
      host.querySelector('[data-rbadge]').textContent = `γ = ${fmtFix(m.gamma, 3)}`;
      renderKpis(kpis, [
        { lbl: 'Lorentz Faktörü γ', val: fmtFix(m.gamma, 4), tone: 'acc' },
        { lbl: 'Zaman Genişlemesi Δt', val: `${fmtFix(m.dt, 3)} τ`, sub: 'Hareketli saat yavaşlar', tone: 'ok' },
        { lbl: 'Uzunluk Büzülmesi L', val: `${fmtFix(m.L, 2)} m`, sub: `L₀ = ${st.L0} m` },
      ]);
    } else if (st.tab === 'photo') {
      const phi = PHOTO_METALS[st.metal].phiEv;
      const pe = solvePhotoelectric({ lambdaNm: st.lam, phiEv: phi, intensity: st.inten });
      host.querySelector('[data-rtitle]').textContent = `Fotoelektrik Tüp (${PHOTO_METALS[st.metal].name})`;
      host.querySelector('[data-rbadge]').textContent = pe.emitted ? 'AKIM VAR' : 'EŞİK ALTI';
      renderKpis(kpis, [
        { lbl: 'Foton Enerjisi hf', val: `${fmtFix(pe.photonEv, 2)} eV`, sub: `φ = ${phi} eV`, tone: pe.emitted ? 'ok' : 'bad' },
        { lbl: 'Kesme Gerilimi V_s', val: `${fmtFix(pe.vStop, 2)} V`, sub: `K_maks = ${fmtFix(pe.kMaxEv, 2)} eV`, tone: 'acc' },
        { lbl: 'Eşik Dalga Boyu λ₀', val: `${Math.round(pe.lambda0Nm)} nm` },
      ]);
    } else {
      const cm = solveCompton({ lambdaPm: st.cLam, thetaDeg: st.cAng });
      host.querySelector('[data-rtitle]').textContent = 'Compton Foton–Elektron Saçılması';
      host.querySelector('[data-rbadge]').textContent = `Δλ = ${fmtFix(cm.deltaLambdaPm, 3)} pm`;
      renderKpis(kpis, [
        { lbl: 'Dalga Boyu Kayması Δλ', val: `${fmtFix(cm.deltaLambdaPm, 3)} pm`, sub: `λ′ = ${fmtFix(cm.lambdaOutPm, 2)} pm`, tone: 'acc' },
        { lbl: 'Foton Enerjisi E → E′', val: `${fmtFix(cm.E_keV, 1)} → ${fmtFix(cm.Eout_keV, 1)} keV` },
        { lbl: 'Geri Tepen Elektron T_e', val: `${fmtFix(cm.Te_keV, 2)} keV`, sub: `φ = ${fmtFix(cm.phiDeg, 1)}°`, tone: 'ok' },
      ]);
    }
    cv.render();
  }

  const loop = createAnimLoop((_now, dt) => { st.t += dt; cv.render(); return st.playing; }, clean);
  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (st.playing) loop.start(); else loop.stop();
  });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.beta !== undefined) { st.beta = p.beta; sBeta.set(st.beta); }
    if (p.metal) { st.metal = p.metal; st.lam = p.lam; selMet.set(st.metal); sLam.set(st.lam); }
    if (p.cLam) { st.cLam = p.cLam; st.cAng = p.cAng; sCLam.set(st.cLam); sCAng.set(st.cAng); }
    syncUI();
  });

  bindTasks(host);
  syncUI();
  if (st.playing) loop.start();
  return clean.run;
}

// 4.8 VEKTÖR ANALİZİ & 3B YÜZEY (Diverjans/Rotasyonel, Çizgi İntegrali, Döndürülebilir z=f(x,y))
function mountVectorCalc(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Girdap Alanı (−y, x)', tab: 'vf', fx: '-y', fy: 'x', mapMode: 'curl' },
    { label: 'Kaynak Alanı (x, y)', tab: 'vf', fx: 'x', fy: 'y', mapMode: 'div' },
    { label: 'Sıkıştırılamaz Eyer (x, −y)', tab: 'vf', fx: 'x', fy: '-y', mapMode: 'div' },
    { label: '3B Eyer Yüzeyi (x² − y²)', tab: 'surf', fz: '0.4*(x^2 - y^2)' },
    { label: '3B Dalga (sin(√(x²+y²)))', tab: 'surf', fz: '1.4*sin(1.8*sqrt(x^2 + y^2))' },
  ];
  const st = {
    tab: 'vf', fxStr: '-y', fyStr: 'x', mapMode: 'curl',
    pathPts: Array.from({ length: 49 }, (_, i) => { const a = (2 * Math.PI * i) / 48; return [1.2 * Math.cos(a), 1.2 * Math.sin(a)]; }),
    drawingPath: false,
    fzStr: '0.4*(x^2 - y^2)', yaw: 0.65, pitch: 0.55, dragRot: false, lastPtr: null,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Formüllerden **2B Vektör Alanı** çiz; **diverjans** veya **rotasyonel (curl)** renk haritasını ve alan çizgilerini gör, tuvalde **kendi eğrini çizerek** $\\int_C \\mathbf{F}\\cdot d\\mathbf{r}$ çizgi integralini hesapla. **3B Yüzey** sekmesinde $z=f(x,y)$ grafiğini sürükleyerek döndür ve gradyan oklarını incele.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="vf" class="on">2B Vektör Alanı & Çizgi İntegrali</button>
        <button type="button" data-t="surf">3B Yüzey z = f(x, y) & Kontur</button>
      </div>
      <button type="button" class="btn small ghost" data-clrpath>Çizilen Yolu Temizle</button>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls>
        <div data-vfin>
          <label class="slp-ctrl"><span class="slp-ctrl-lbl">Fx(x, y)</span><input type="text" class="inp mono" data-fx value="${esc(st.fxStr)}" aria-label="Vektör alanı x bileşeni"></label>
          <label class="slp-ctrl"><span class="slp-ctrl-lbl">Fy(x, y)</span><input type="text" class="inp mono" data-fy value="${esc(st.fyStr)}" aria-label="Vektör alanı y bileşeni"></label>
        </div>
        <div data-surfin hidden>
          <label class="slp-ctrl"><span class="slp-ctrl-lbl">Yüzey z = f(x, y)</span><input type="text" class="inp mono" data-fz value="${esc(st.fzStr)}" aria-label="Yüzey fonksiyonu"></label>
        </div>
        <div data-extra></div>
        <div class="slp-alert slp-alert-bad" data-err hidden></div>
      </div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-vtitle>2B Vektör Alanı (Sürükle: Çizgi İntegrali Yolu Çiz)</h4><span class="slp-badge slp-badge-acc mono" data-vbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv slp-cv-drag" data-cv aria-label="Vektör alanı ve 3B yüzey tuvali"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\nabla \\cdot \\mathbf{F} = \\frac{\\partial F_x}{\\partial x} + \\frac{\\partial F_y}{\\partial y}, \\qquad (\\nabla \\times \\mathbf{F})_z = \\frac{\\partial F_y}{\\partial x} - \\frac{\\partial F_x}{\\partial y}',
        '\\oint_C \\mathbf{F}\\cdot d\\mathbf{r} = \\iint_D (\\nabla \\times \\mathbf{F})_z\\,dA \\quad (\\text{Green Teoremi}), \\qquad \\nabla f = \\left(\\frac{\\partial f}{\\partial x},\\, \\frac{\\partial f}{\\partial y}\\right)',
      ],
      paragraphs: [
        '**Diverjans** bir noktadaki net akı kaynağını (pozitif = kaynak, negatif = yutak), **rotasyonel (curl)** ise yerel dönme şiddetini ölçer. **Green Teoremine** göre kapalı bir eğri boyunca iş (sirkülasyon), iç bölgedeki rotasyonelin alan integraline eşittir.',
        'Bir skaler yüzeyin **gradyanı** $\\nabla f$ her noktada eşyükseklik (kontur) eğrilerine diktir ve en dik çıkış yönünü gösterir.',
      ],
      tasks: [
        'Girdap alanında $(-y, x)$ tuvalde saat yönünün tersine kapalı bir döngü çizip iş integralinin pozitif ($\\approx 2 \\times \\text{Alan}$) olduğunu doğrula.',
        'Kaynak alanında $(x, y)$ kapalı bir döngü çizip dolaşımın (işin) ~0 ama dışa akının (flux) pozitif olduğunu gözle.',
        '3B Yüzey sekmesinde tuvali sürükleyerek eyer yüzeyini döndür ve sağdaki kontur haritasında gradyan oklarının eşyükseklik eğrilerine dikliğini incele.',
      ],
    })}
  </div>`;

  const extra = host.querySelector('[data-extra]');
  const kpis = host.querySelector('[data-kpis]');
  const errEl = host.querySelector('[data-err]');
  const cvEl = host.querySelector('[data-cv]');

  const selMap = addSelect(extra, 'Arka Plan Renk Haritası', [['curl', 'Rotasyonel (∇×F)_z'], ['div', 'Diverjans (∇·F)'], ['mag', 'Şiddet |F|']], st.mapMode, v => { st.mapMode = v; syncUI(); });

  let fxFn = (_x, y) => -y, fyFn = (x) => x, fzFn = (x, y) => 0.4 * (x * x - y * y);
  const RANGE = 2.6;

  const cv = setupCanvas(cvEl, w => Math.min(350, Math.max(255, w * 0.62)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (st.tab === 'vf') {
      const toPx = (x, y) => [((x + RANGE) / (2 * RANGE)) * W, ((RANGE - y) / (2 * RANGE)) * H];
      // Color map of div / curl / mag
      const G = 34, cw = W / G, ch = H / G;
      for (let j = 0; j < G; j++) {
        const y = RANGE - ((j + 0.5) / G) * 2 * RANGE;
        for (let i = 0; i < G; i++) {
          const x = -RANGE + ((i + 0.5) / G) * 2 * RANGE;
          const v = evalVectorField2D(fxFn, fyFn, x, y);
          const sc = st.mapMode === 'curl' ? v.curl : st.mapMode === 'div' ? v.div : v.mag;
          const t = Math.tanh(sc * 0.45);
          c.fillStyle = t >= 0 ? `rgba(91,228,155,${0.32 * t})` : `rgba(255,107,107,${-0.32 * t})`;
          c.fillRect(i * cw, j * ch, cw + 0.7, ch + 0.7);
        }
      }
      // Streamlines
      c.strokeStyle = 'rgba(90,176,255,0.45)'; c.lineWidth = 1.2;
      for (let sx = -2; sx <= 2; sx += 1) {
        for (let sy = -2; sy <= 2; sy += 1) {
          if (Math.abs(sx) < 0.1 && Math.abs(sy) < 0.1) continue;
          const pts = traceStreamline2D(fxFn, fyFn, sx, sy, { step: 0.1, maxSteps: 28, bound: RANGE });
          c.beginPath();
          pts.forEach(([x, y], k) => { const [px, py] = toPx(x, y); if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); });
          c.stroke();
        }
      }
      // Vector arrows
      for (let x = -2.2; x <= 2.2; x += 0.55) {
        for (let y = -2.2; y <= 2.2; y += 0.55) {
          const u = fxFn(x, y), v = fyFn(x, y), m = Math.hypot(u, v);
          if (!Number.isFinite(m) || m < 1e-5) continue;
          const [px, py] = toPx(x, y);
          const len = Math.min(18, 6 + 4.5 * Math.log1p(m));
          drawArrow(c, px, py, px + (u / m) * len, py - (v / m) * len, 'rgba(244,244,245,0.75)', 1.2, 5);
        }
      }
      // Drawn path
      if (st.pathPts.length >= 2) {
        c.strokeStyle = COL_WARN; c.lineWidth = 2.8; c.beginPath();
        st.pathPts.forEach(([x, y], k) => { const [px, py] = toPx(x, y); if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); });
        c.stroke();
      }
      return;
    }

    // Pseudo-3D rotatable surface on left + 2D contour & gradient on right
    const halfW = W * 0.54;
    const grid = sampleSurfaceGrid(fzFn, 2.2, 18);
    const N = grid.xs.length - 1;
    const cyA = Math.cos(st.yaw), syA = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const zSpan = Math.max(0.5, grid.zMax - grid.zMin);
    const proj = (x, y, z) => {
      const xr = x * cyA - y * syA;
      const yr = x * syA + y * cyA;
      const zr = (z - 0.5 * (grid.zMin + grid.zMax)) / (zSpan * 0.48);
      const y2 = yr * cp - zr * sp;
      const sc = Math.min(halfW, H) * 0.16;
      return [halfW * 0.5 + xr * sc, H * 0.54 - (zr * cp + yr * sp) * sc, y2];
    };
    const quads = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const p00 = proj(grid.xs[i], grid.ys[j], grid.Z[j][i]);
        const p10 = proj(grid.xs[i + 1], grid.ys[j], grid.Z[j][i + 1]);
        const p11 = proj(grid.xs[i + 1], grid.ys[j + 1], grid.Z[j + 1][i + 1]);
        const p01 = proj(grid.xs[i], grid.ys[j + 1], grid.Z[j + 1][i]);
        const depth = (p00[2] + p10[2] + p11[2] + p01[2]) / 4;
        const zAvg = (grid.Z[j][i] + grid.Z[j + 1][i + 1]) / 2;
        const t = (zAvg - grid.zMin) / zSpan;
        quads.push({ pts: [p00, p10, p11, p01], depth, t });
      }
    }
    quads.sort((a, b) => b.depth - a.depth);
    for (const q of quads) {
      const r = Math.round(40 + 210 * q.t), g = Math.round(110 + 90 * (1 - Math.abs(q.t - 0.5) * 2)), b = Math.round(235 - 155 * q.t);
      c.fillStyle = `rgba(${r},${g},${b},0.78)`;
      c.strokeStyle = 'rgba(0,0,0,0.38)'; c.lineWidth = 0.7;
      c.beginPath();
      q.pts.forEach((p, k) => { if (k === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); });
      c.closePath(); c.fill(); c.stroke();
    }

    // Right side: 2D contour heatmap + gradient arrows
    const rx = halfW + 10, rw = W - rx - 12, rh = H - 24, ry = 12;
    if (rw > 70) {
      const cw = rw / N, ch = rh / N;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const t = (grid.Z[j][i] - grid.zMin) / zSpan;
          c.fillStyle = `rgba(${Math.round(40 + 210 * t)},${Math.round(100 + 100 * (1 - Math.abs(t - 0.5) * 2))},${Math.round(230 - 150 * t)},0.52)`;
          c.fillRect(rx + i * cw, ry + (N - 1 - j) * ch, cw + 0.6, ch + 0.6);
        }
      }
      for (let i = 2; i < N; i += 3) {
        for (let j = 2; j < N; j += 3) {
          const gr = surfaceGradient(fzFn, grid.xs[i], grid.ys[j]);
          if (gr.mag < 1e-4) continue;
          const px = rx + (i + 0.5) * cw, py = ry + (N - 1 - j + 0.5) * ch;
          drawArrow(c, px, py, px + (gr.gx / gr.mag) * 12, py - (gr.gy / gr.mag) * 12, '#fff', 1.2, 4);
        }
      }
      c.fillStyle = COL_FG; c.font = '10.5px "JetBrains Mono", monospace';
      c.fillText('Kontur + ∇f', rx + 4, ry + 12);
    }
  }, clean);

  cvEl.addEventListener('pointerdown', e => {
    const [px, py] = canvasPos(cvEl, e);
    const { W, H } = cv.size();
    cvEl.setPointerCapture?.(e.pointerId);
    if (st.tab === 'vf') {
      st.drawingPath = true;
      st.pathPts = [[(px / W) * 2 * RANGE - RANGE, RANGE - (py / H) * 2 * RANGE]];
      syncUI();
    } else {
      st.dragRot = true; st.lastPtr = [px, py];
    }
  });
  cvEl.addEventListener('pointermove', e => {
    const [px, py] = canvasPos(cvEl, e);
    const { W, H } = cv.size();
    if (st.tab === 'vf' && st.drawingPath) {
      const pt = [(px / W) * 2 * RANGE - RANGE, RANGE - (py / H) * 2 * RANGE];
      const prev = st.pathPts.at(-1);
      if (!prev || Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) > 0.08) {
        st.pathPts.push(pt);
        syncUI();
      }
    } else if (st.tab === 'surf' && st.dragRot && st.lastPtr) {
      st.yaw += (px - st.lastPtr[0]) * 0.012;
      st.pitch = Math.max(0.15, Math.min(1.4, st.pitch + (py - st.lastPtr[1]) * 0.01));
      st.lastPtr = [px, py];
      cv.render();
    }
  });
  const endPtr = () => { st.drawingPath = false; st.dragRot = false; };
  cvEl.addEventListener('pointerup', endPtr);
  cvEl.addEventListener('pointercancel', endPtr);

  function syncUI() {
    const isVF = st.tab === 'vf';
    host.querySelector('[data-vfin]').hidden = !isVF;
    host.querySelector('[data-surfin]').hidden = isVF;
    host.querySelector('[data-clrpath]').hidden = !isVF;
    selMap.setVisible(isVF);

    if (isVF) {
      const cx = compileExpr2D(st.fxStr), cy = compileExpr2D(st.fyStr);
      if (!cx.ok || !cy.ok) {
        errEl.hidden = false; errEl.textContent = cx.ok ? cy.error : cx.error; return;
      }
      errEl.hidden = true; fxFn = cx.fn; fyFn = cy.fn;
      const center = evalVectorField2D(fxFn, fyFn, 0, 0);
      const li = computeLineIntegral2D(fxFn, fyFn, st.pathPts);
      host.querySelector('[data-vtitle]').textContent = '2B Vektör Alanı (Sürükle: Çizgi İntegrali Yolu Çiz)';
      host.querySelector('[data-vbadge]').textContent = `F = (${st.fxStr}, ${st.fyStr})`;
      renderKpis(kpis, [
        { lbl: 'Çizgi İntegrali ∫F·dr', val: fmtFix(li.work, 3), sub: `Yol boyu: ${fmtFix(li.length, 2)}`, tone: 'acc' },
        { lbl: 'Eğri Akısı ∫F·n ds', val: fmtFix(li.flux, 3), tone: 'ok' },
        { lbl: 'Orijinde div / curl', val: `${fmtFix(center.div, 2)} / ${fmtFix(center.curl, 2)}` },
      ]);
    } else {
      const cz = compileExpr2D(st.fzStr);
      if (!cz.ok) { errEl.hidden = false; errEl.textContent = cz.error; return; }
      errEl.hidden = true; fzFn = cz.fn;
      const g = sampleSurfaceGrid(fzFn, 2.2, 16);
      const gr0 = surfaceGradient(fzFn, 0.5, 0.5);
      host.querySelector('[data-vtitle]').textContent = '3B Döndürülebilir Yüzey (Sürükle: Döndür) & Kontur';
      host.querySelector('[data-vbadge]').textContent = `z = ${st.fzStr}`;
      renderKpis(kpis, [
        { lbl: 'z Aralığı [min, maks]', val: `[${fmtFix(g.zMin, 2)}, ${fmtFix(g.zMax, 2)}]`, tone: 'acc' },
        { lbl: '∇f(0.5, 0.5)', val: `(${fmtFix(gr0.gx, 2)}, ${fmtFix(gr0.gy, 2)})`, sub: `|∇f| = ${fmtFix(gr0.mag, 2)}`, tone: 'ok' },
      ]);
    }
    cv.render();
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    syncUI();
  });
  host.querySelector('[data-fx]').addEventListener('change', e => { st.fxStr = e.target.value; syncUI(); });
  host.querySelector('[data-fy]').addEventListener('change', e => { st.fyStr = e.target.value; syncUI(); });
  host.querySelector('[data-fz]').addEventListener('change', e => { st.fzStr = e.target.value; syncUI(); });
  host.querySelector('[data-clrpath]').addEventListener('click', () => { st.pathPts = []; syncUI(); });
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.tab === 'vf') {
      st.fxStr = p.fx; st.fyStr = p.fy; st.mapMode = p.mapMode;
      host.querySelector('[data-fx]').value = st.fxStr; host.querySelector('[data-fy]').value = st.fyStr;
      selMap.set(st.mapMode);
    } else {
      st.fzStr = p.fz; host.querySelector('[data-fz]').value = st.fzStr;
    }
    syncUI();
  });

  bindTasks(host);
  syncUI();
  return clean.run;
}

// 4.9 OLASILIK GEOMETRİSİ (Buffon İğnesi, Rastgele Yürüyüş & Difüzyon, Galton Tahtası)
function mountProbGeom(host, ctx) {
  const clean = createClean(ctx);
  const presets = [
    { label: 'Buffon İğnesi (L = 0.8 d)', tab: 'buffon', L: 0.8 },
    { label: '2B Difüzyon Topluluğu (⟨r²⟩ = Nℓ²)', tab: 'walk', dim: 2 },
    { label: 'Galton Tahtası · Simetrik (p = 0.5)', tab: 'galton', rows: 12, p: 0.5 },
    { label: 'Galton Tahtası · Çarpık (p = 0.72)', tab: 'galton', rows: 12, p: 0.72 },
  ];
  const st = {
    tab: 'buffon', L: 0.8, rng: makeRng(61),
    needles: [], bCross: 0, bTotal: 0,
    dim: 2, ens: createRandomWalkEnsemble({ dim: 2, count: 220, stepLen: 1, seed: 83 }),
    gRows: 12, gP: 0.5, gBins: new Array(13).fill(0), gTotal: 0,
    playing: false,
  };

  host.innerHTML = `<div class="slp-wrap">
    ${introHtml('Geometrik olasılık ve istatistiksel fiziğin üç efsane deneyi: paralel çizgilere düşen **Buffon İğnesi** ile $\\pi$ tahmini, **Rastgele Yürüyüş & Difüzyon** ($\\langle r^2\\rangle = N\\ell^2$) ve **Galton Tahtası** Binom–Normal yakınsaması.', presets)}
    <div class="slp-toolbar">
      <div class="seg" role="tablist" data-tab>
        <button type="button" data-t="buffon" class="on">Buffon İğnesi</button>
        <button type="button" data-t="walk">Rastgele Yürüyüş</button>
        <button type="button" data-t="galton">Galton Tahtası</button>
      </div>
      <div class="slp-btn-row">
        <button type="button" class="btn small primary" data-play>${icon('play')} Çalıştır</button>
        <button type="button" class="btn small" data-batch>+200 Atış / Adım</button>
        <button type="button" class="btn small ghost" data-rst>Sıfırla</button>
      </div>
    </div>
    <div class="slp-grid">
      <div class="slp-panel" data-ctrls></div>
      <div class="slp-col">
        <div class="slp-kpis" data-kpis></div>
        <div class="slp-plot-card">
          <div class="slp-head"><h4 class="slp-title" data-gtitle>Buffon Paralel Çizgileri & İğneler</h4><span class="slp-badge slp-badge-acc mono" data-gbadge>—</span></div>
          <div class="slp-cv-box"><canvas class="slp-cv" data-cv aria-label="Olasılık geometrisi simülasyon tuvali"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'P(\\text{kesişme}) = \\frac{2L}{\\pi d} \\;(L \\le d) \\implies \\hat{\\pi} = \\frac{2LN}{d\\,C}',
        '\\langle r^2(N) \\rangle = N\\ell^2 = 2 d D t \\;(\\text{Difüzyon}), \\qquad P(X=k) = \\binom{N}{k} p^k (1-p)^{N-k}',
      ],
      paragraphs: [
        '**Buffon İğnesi** (1777) geometrik olasılığın ilk deneyidir: uzunluğu $L \\le d$ olan bir iğne aralarında $d$ mesafe bulunan paralel çizgilere rastgele atıldığında kesme olasılığı $2L/(\\pi d)$ olur.',
        '**Rastgele Yürüyüşte** ortalama konum sıfır kalırken ortalama kare yer değiştirme adım sayısıyla doğrusal ($\\langle r^2\\rangle \\propto t$, tipik uzaklık $\\sqrt{t}$) büyür — bu Einstein–Smoluchowski difüzyon yasasıdır.',
      ],
      tasks: [
        'Buffon deneyinde 1000+ iğne atarak $\\hat{\\pi}$ tahmininin $3.14159$ civarına yerleşmesini gözle.',
        'Rastgele Yürüyüşte ampirik $\\langle r^2\\rangle$ değerinin adım sayısı $N$ ile neredeyse bire bir örtüştüğünü doğrula.',
        'Galton Tahtasında sağa sapma olasılığını $p=0.72$ yapıp çan eğrisinin sağa kaydığını ve teorik Binom noktalarıyla çakıştığını gör.',
      ],
    })}
  </div>`;

  const ctrls = host.querySelector('[data-ctrls]');
  const kpis = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const sL = addSlider(ctrls, { label: 'İğne Boyu / Aralık (L/d)', min: 0.2, max: 1.5, step: 0.05, value: st.L, fmt: v => fmtFix(v, 2), onInput: v => { st.L = v; resetCur(); } });
  const selDim = addSelect(ctrls, 'Yürüyüş Boyutu', [['2', '2B Difüzyon Bulutu'], ['1', '1B Rastgele Yürüyüş']], '2', v => { st.dim = +v; resetCur(); });
  const sGR = addSlider(ctrls, { label: 'Çivi Sırası N', min: 6, max: 16, step: 1, value: st.gRows, fmt: v => `${Math.round(v)} sıra`, onInput: v => { st.gRows = Math.round(v); resetCur(); } });
  const sGP = addSlider(ctrls, { label: 'Sağa Sapma Olasılığı p', min: 0.2, max: 0.8, step: 0.02, value: st.gP, fmt: v => fmtFix(v, 2), onInput: v => { st.gP = v; resetCur(); } });

  const cv = setupCanvas(host.querySelector('[data-cv]'), w => Math.min(315, Math.max(235, w * 0.56)), (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (st.tab === 'buffon') {
      const lanes = 5, dPx = H / lanes;
      c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.4;
      for (let i = 0; i <= lanes; i++) {
        c.beginPath(); c.moveTo(0, i * dPx); c.lineTo(W, i * dPx); c.stroke();
      }
      const lPx = st.L * dPx;
      const show = st.needles.slice(-450);
      show.forEach((nd, idx) => {
        const lane = idx % lanes;
        const cx = 18 + nd.xc * (W - 36);
        const cy = lane * dPx + nd.yc * dPx;
        const dx = 0.5 * lPx * Math.cos(nd.angle), dy = 0.5 * lPx * Math.sin(nd.angle);
        c.strokeStyle = nd.crosses ? COL_OK : 'rgba(90,176,255,0.55)';
        c.lineWidth = nd.crosses ? 1.8 : 1.1;
        c.beginPath(); c.moveTo(cx - dx, cy - dy); c.lineTo(cx + dx, cy + dy); c.stroke();
      });
      return;
    }

    if (st.tab === 'walk') {
      const e = st.ens;
      const sc = Math.min(W, H) / Math.max(18, 4.2 * Math.sqrt(Math.max(4, e.steps)));
      const cx = W / 2, cy = H / 2;
      // Diffusion RMS circle sqrt(<r^2>) = sqrt(N)
      c.strokeStyle = COL_WARN; c.setLineDash([5, 4]); c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx, cy, Math.sqrt(Math.max(1, e.steps)) * sc, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      if (st.dim === 2) {
        c.fillStyle = COL_BLUE;
        for (let i = 0; i < e.count; i++) {
          c.fillRect(cx + e.xs[i] * sc - 1.5, cy - e.ys[i] * sc - 1.5, 3, 3);
        }
      } else {
        // 1D histogram of walker positions
        const bins = 25, counts = new Array(bins).fill(0);
        const span = Math.max(8, 3.5 * Math.sqrt(Math.max(4, e.steps)));
        for (let i = 0; i < e.count; i++) {
          const b = Math.floor(((e.xs[i] + span) / (2 * span)) * bins);
          if (b >= 0 && b < bins) counts[b]++;
        }
        const mx = Math.max(1, ...counts), bw = (W - 36) / bins;
        c.fillStyle = 'rgba(90,176,255,0.55)';
        for (let i = 0; i < bins; i++) {
          const h = (counts[i] / mx) * (H - 48);
          c.fillRect(18 + i * bw + 1, H - 24 - h, bw - 2, h);
        }
      }
      return;
    }

    // Galton board: pegs on top + bin histogram & Binomial PMF dots on bottom
    const N = st.gRows, pegH = H * 0.44, binTop = H * 0.48, binH = H - binTop - 22;
    const dx = Math.min(26, (W - 40) / (N + 2));
    const cx = W / 2;
    c.fillStyle = 'rgba(255,255,255,0.45)';
    for (let r = 0; r < N; r++) {
      const y = 16 + (r / Math.max(1, N - 1)) * (pegH - 18);
      for (let k = 0; k <= r; k++) {
        const x = cx + (k - r / 2) * dx;
        c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
      }
    }
    const pmf = galtonBinomialPMF(N, st.gP);
    const tot = Math.max(1, st.gTotal);
    const maxP = Math.max(...pmf, ...st.gBins.map(v => v / tot), 0.05);
    for (let k = 0; k <= N; k++) {
      const x = cx + (k - N / 2) * dx;
      const hEmp = ((st.gBins[k] / tot) / maxP) * binH;
      c.fillStyle = 'rgba(90,176,255,0.48)';
      c.fillRect(x - dx * 0.38, binTop + binH - hEmp, dx * 0.76, hEmp);
      const yTheo = binTop + binH - (pmf[k] / maxP) * binH;
      c.beginPath(); c.arc(x, yTheo, 3.6, 0, Math.PI * 2);
      c.fillStyle = COL_WARN; c.fill();
    }
  }, clean);

  function doStep(count = 20) {
    if (st.tab === 'buffon') {
      const b = buffonDropBatch({ L: st.L, d: 1.0, count, seed: st.rng });
      st.needles.push(...b.needles);
      if (st.needles.length > 1200) st.needles.splice(0, st.needles.length - 1200);
      st.bCross += b.crossings; st.bTotal += b.total;
    } else if (st.tab === 'walk') {
      const steps = Math.min(20, Math.max(1, Math.round(count / 15)));
      for (let i = 0; i < steps; i++) stepRandomWalkEnsemble(st.ens);
    } else {
      const b = galtonDropBatch({ rows: st.gRows, p: st.gP, count, seed: st.rng });
      for (let k = 0; k <= st.gRows; k++) st.gBins[k] += b.bins[k];
      st.gTotal += b.total;
    }
    syncUI();
  }

  function syncUI() {
    sL.setVisible(st.tab === 'buffon');
    selDim.setVisible(st.tab === 'walk');
    [sGR, sGP].forEach(x => x.setVisible(st.tab === 'galton'));

    if (st.tab === 'buffon') {
      const pExact = buffonExactProb(st.L, 1.0);
      const pEmp = st.bTotal ? st.bCross / st.bTotal : 0;
      const piEst = (st.L <= 1.0 && st.bCross > 0) ? (2 * st.L * st.bTotal) / st.bCross : NaN;
      host.querySelector('[data-gtitle]').textContent = 'Buffon İğnesi (Yeşil = Çizgiyi Kesiyor)';
      host.querySelector('[data-gbadge]').textContent = `N = ${st.bTotal}`;
      renderKpis(kpis, [
        { lbl: 'Tahmini π̂', val: Number.isFinite(piEst) ? fmtFix(piEst, 4) : 'L > d (uzun iğne)', sub: `Gerçek π = 3.1416`, tone: 'acc' },
        { lbl: 'Ampirik / Teorik P', val: `%${fmtFix(pEmp * 100, 1)} / %${fmtFix(pExact * 100, 1)}`, tone: 'ok' },
        { lbl: 'Kesişen / Toplam', val: `${st.bCross} / ${st.bTotal}` },
      ]);
    } else if (st.tab === 'walk') {
      const e = st.ens;
      const msd = e.msdHistory.at(-1) || 0;
      host.querySelector('[data-gtitle]').textContent = `${st.dim}B Rastgele Yürüyüş Topluluğu (${e.count} parçacık)`;
      host.querySelector('[data-gbadge]').textContent = `Adım N = ${e.steps}`;
      renderKpis(kpis, [
        { lbl: 'Ampirik ⟨r²⟩', val: fmtFix(msd, 2), sub: `Teorik Nℓ² = ${e.steps}`, tone: 'acc' },
        { lbl: 'RMS Yarıçap √⟨r²⟩', val: fmtFix(Math.sqrt(msd), 2), sub: `√N = ${fmtFix(Math.sqrt(e.steps), 2)}`, tone: 'ok' },
      ]);
    } else {
      const tot = Math.max(1, st.gTotal);
      const empM = st.gBins.reduce((s, c, k) => s + c * k, 0) / tot;
      host.querySelector('[data-gtitle]').textContent = 'Galton Tahtası (Çubuk = Deney, Sarı = Binom PMF)';
      host.querySelector('[data-gbadge]').textContent = `${st.gTotal} bilye`;
      renderKpis(kpis, [
        { lbl: 'Deney / Teorik Ort.', val: `${fmtFix(empM, 2)} / ${fmtFix(st.gRows * st.gP, 2)}`, tone: 'acc' },
        { lbl: 'Teorik Std √(Np(1−p))', val: fmtFix(Math.sqrt(st.gRows * st.gP * (1 - st.gP)), 2), tone: 'ok' },
      ]);
    }
    cv.render();
  }

  const loop = createAnimLoop(() => { doStep(18); return st.playing; }, clean);
  function resetCur() {
    loop.stop(); st.playing = false; playBtn.innerHTML = `${icon('play')} Çalıştır`;
    st.needles = []; st.bCross = 0; st.bTotal = 0;
    st.ens = createRandomWalkEnsemble({ dim: st.dim, count: 220, stepLen: 1, seed: 83 });
    st.gBins = new Array(st.gRows + 1).fill(0); st.gTotal = 0;
    doStep(250);
  }

  host.querySelector('[data-tab]').addEventListener('click', e => {
    const b = e.target.closest?.('[data-t]'); if (!b) return;
    st.tab = b.dataset.t;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x === b));
    resetCur();
  });
  playBtn.addEventListener('click', () => {
    st.playing = !st.playing;
    playBtn.innerHTML = st.playing ? `${icon('pause')} Duraklat` : `${icon('play')} Çalıştır`;
    if (st.playing) loop.start(); else loop.stop();
  });
  host.querySelector('[data-batch]').addEventListener('click', () => doStep(200));
  host.querySelector('[data-rst]').addEventListener('click', resetCur);
  bindPresets(host, presets, p => {
    st.tab = p.tab;
    host.querySelectorAll('[data-tab] button').forEach(x => x.classList.toggle('on', x.dataset.t === st.tab));
    if (p.L) { st.L = p.L; sL.set(st.L); }
    if (p.dim) { st.dim = p.dim; selDim.set(String(st.dim)); }
    if (p.rows) { st.gRows = p.rows; st.gP = p.p; sGR.set(st.gRows); sGP.set(st.gP); }
    resetCur();
  });

  bindTasks(host);
  resetCur();
  return clean.run;
}

// =====================================================================
// MODULE EXPORT CONTRACT (consumed by js/simcenter.js)
// =====================================================================

export const SIMS = [
  // Field: bilgisayar (8 simulations)
  { id: 'sorting-algos',      field: 'bilgisayar', title: 'Sıralama Algoritmaları', icon: 'chart',    mount: mountSorting },
  { id: 'graph-algos',        field: 'bilgisayar', title: 'Graf Algoritmaları',     icon: 'phasor',   mount: mountGraph },
  { id: 'data-structures',    field: 'bilgisayar', title: 'Veri Yapıları',          icon: 'grid',     mount: mountDataStructures },
  { id: 'os-scheduling',      field: 'bilgisayar', title: 'İşletim Sistemleri',     icon: 'clock',    mount: mountOS },
  { id: 'computer-arch',      field: 'bilgisayar', title: 'Bilgisayar Mimarisi',    icon: 'matrix',   mount: mountArch },
  { id: 'automata-turing',    field: 'bilgisayar', title: 'Otomatlar & Turing',     icon: 'rotate',   mount: mountAutomata },
  { id: 'neural-ml',          field: 'bilgisayar', title: 'Yapay Sinir Ağı & ML',   icon: 'sparkle',  mount: mountNeuralML },
  { id: 'crypto-network',     field: 'bilgisayar', title: 'Kriptografi & Ağ',       icon: 'tool',     mount: mountCryptoNet },

  // Field: endustri (8 simulations)
  { id: 'queue-theory',       field: 'endustri',   title: 'Kuyruk Teorisi',         icon: 'clock',    mount: mountQueueTheory },
  { id: 'linear-programming', field: 'endustri',   title: 'Doğrusal Programlama',   icon: 'grid',     mount: mountLinearProg },
  { id: 'inventory-eoq',      field: 'endustri',   title: 'Envanter & EOQ',         icon: 'chart',    mount: mountInventoryEOQ },
  { id: 'project-cpm-pert',   field: 'endustri',   title: 'Proje Yönetimi (CPM)',   icon: 'phasor',   mount: mountCPMPERT },
  { id: 'spc-quality',        field: 'endustri',   title: 'Kalite Kontrol (SPC)',   icon: 'chart',    mount: mountSPC },
  { id: 'monte-carlo-prob',   field: 'endustri',   title: 'Monte Carlo & Olasılık', icon: 'dots',     mount: mountMonteCarlo },
  { id: 'markov-chains',      field: 'endustri',   title: 'Markov Zincirleri',      icon: 'rotate',   mount: mountMarkov },
  { id: 'transportation-lp',  field: 'endustri',   title: 'Taşıma Problemi',        icon: 'matrix',   mount: mountTransportation },

  // Field: biyomed (7 simulations)
  { id: 'ecg-heart',          field: 'biyomed',    title: 'EKG & Kalp Vektörü',     icon: 'wave',     mount: mountECG },
  { id: 'pharmacokinetics',   field: 'biyomed',    title: 'Farmakokinetik',         icon: 'chart',    mount: mountPK },
  { id: 'neuron-hh-fhn',      field: 'biyomed',    title: 'Sinir Hücresi (H-H)',    icon: 'wave',     mount: mountNeuron },
  { id: 'epidemic-sir',       field: 'biyomed',    title: 'Salgın Modelleri (SIR)', icon: 'chart',    mount: mountEpidemic },
  { id: 'cardiovascular',     field: 'biyomed',    title: 'Kardiyovasküler Akış',   icon: 'wave',     mount: mountCardio },
  { id: 'biomechanics',       field: 'biyomed',    title: 'Biyomekanik & Kas',      icon: 'tool',     mount: mountBiomechanics },
  { id: 'medical-imaging',    field: 'biyomed',    title: 'Tıbbi Görüntüleme (CT)', icon: 'image',    mount: mountMedImaging },

  // Field: fizikmat (9 simulations)
  { id: 'waves-interference', field: 'fizikmat',   title: 'Dalgalar & Girişim',     icon: 'wave',     mount: mountWaves },
  { id: 'optics-lab',         field: 'fizikmat',   title: 'Optik & Kırınım',        icon: 'sparkle',  mount: mountOptics },
  { id: 'chaos-dynamics',     field: 'fizikmat',   title: 'Kaos & Dinamik Sistem',  icon: 'rotate',   mount: mountChaos },
  { id: 'numerical-methods',  field: 'fizikmat',   title: 'Sayısal Yöntemler',      icon: 'calc',     mount: mountNumerical },
  { id: 'quantum-mechanics',  field: 'fizikmat',   title: 'Kuantum Mekaniği',       icon: 'atom',     mount: mountQuantum },
  { id: 'em-induction-lc',    field: 'fizikmat',   title: 'Faraday & LC Salınım',   icon: 'resistor', mount: mountEMInduction },
  { id: 'relativity-modern',  field: 'fizikmat',   title: 'Görelilik & Modern',     icon: 'sparkle',  mount: mountRelativity },
  { id: 'vector-calculus',    field: 'fizikmat',   title: 'Vektör Analizi & Yüzey', icon: 'phasor',   mount: mountVectorCalc },
  { id: 'prob-geometry',      field: 'fizikmat',   title: 'Olasılık Geometrisi',    icon: 'dots',     mount: mountProbGeom },
];
