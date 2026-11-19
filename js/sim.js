// MathPad Simulation Center UI (6 interactive EE simulations).
import { esc, icon } from './ui.js';
import { plot, PLOT_COLORS, eng, evaluate } from './tools.js';
import {
  solveMNA,
  stepResponse,
  autoStepWindow,
  seriesRLC,
  transfer,
  filterMetrics,
  opampOut,
  clip,
  gate,
  halfAdder,
  truthTable,
} from './simcore.js';

export const SIMS = [
  { id: 'dc',        icon: 'resistor', title: 'Devre Çözücü' },
  { id: 'transient', icon: 'wave',     title: 'Geçici Durum' },
  { id: 'phasor',    icon: 'phasor',   title: 'AC Fazör' },
  { id: 'filter',    icon: 'chart',    title: 'Filtre & Bode' },
  { id: 'opamp',     icon: 'sigma',    title: 'Op-Amp Lab' },
  { id: 'logic',     icon: 'matrix',   title: 'Mantık Kapıları' },
];

// ---------- shared formatting & UI helpers ----------
function createCleanup() {
  const fns = [];
  return {
    add(fn) { fns.push(fn); },
    run() { while (fns.length) try { fns.pop()(); } catch {} },
  };
}

function isStaticMotion() {
  const m = document.documentElement.dataset.motion;
  return m === 'off' || m === 'reduced';
}

function fmtNum(x, sig = 4) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-14) return '0';
  if (Math.abs(x) >= 1e15 || Math.abs(x) < 1e-12) return x.toExponential(sig - 1);
  return String(+x.toPrecision(sig));
}

function fmtUnit(x, unit = '', sig = 4) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-15) return unit ? `0 ${unit}` : '0';
  const e = eng(x);
  if (e) {
    const m = /^(-?[\d.]+)(.+)$/.exec(e);
    if (m) return `${+(+m[1]).toPrecision(sig)} ${m[2]}${unit}`;
    return `${e}${unit}`;
  }
  if (Math.abs(x) >= 1e15 || Math.abs(x) < 1e-15) {
    return `${x.toExponential(sig - 1)}${unit ? ' ' + unit : ''}`;
  }
  return `${+x.toPrecision(sig)}${unit ? ' ' + unit : ''}`;
}

function fmtInp(x, sig = 3) {
  if (!Number.isFinite(x)) return '';
  if (Math.abs(x) < 1e-15) return '0';
  if (Math.abs(x) < 1e-12 || Math.abs(x) >= 1e15) return x.toExponential(sig - 1);
  const e = eng(x);
  if (e) {
    const m = /^(-?[\d.]+)(.+)$/.exec(e);
    return m ? `${+(+m[1]).toPrecision(sig)}${m[2]}` : e;
  }
  return String(+x.toPrecision(sig));
}

function fmtDeg(deg) {
  if (!Number.isFinite(deg)) return '—';
  const d = Math.abs(deg) < 1e-3 ? 0 : deg;
  return `${+d.toFixed(1)}°`;
}

function fmtPolar(c, unit = '') {
  const mag = Math.hypot(c.re, c.im);
  const deg = mag < 1e-14 ? 0 : (Math.atan2(c.im, c.re) * 180) / Math.PI;
  return `${fmtUnit(mag, unit)} ∠ ${fmtDeg(deg)}`;
}

function fmtRect(c, unit = '') {
  const re = Math.abs(c.re) < 1e-14 ? 0 : c.re;
  const im = Math.abs(c.im) < 1e-14 ? 0 : c.im;
  const sgn = im < 0 ? '−' : '+';
  const aRe = Math.abs(re), aIm = Math.abs(im);
  const bothBase = (!aRe || (aRe >= 1 && aRe < 1000)) && (!aIm || (aIm >= 1 && aIm < 1000));
  if (bothBase) {
    return `${fmtNum(re, 4)} ${sgn} j${fmtNum(aIm, 4)}${unit ? ' ' + unit : ''}`;
  }
  return `${fmtUnit(re, unit)} ${sgn} j${fmtUnit(aIm, unit)}`;
}

function fmtPowerAC(s) {
  const p = Math.abs(s.re) < 1e-14 ? 0 : s.re;
  const q = Math.abs(s.im) < 1e-14 ? 0 : s.im;
  const sgn = q < 0 ? '−' : '+';
  return `${fmtUnit(p, 'W')} ${sgn} j${fmtUnit(Math.abs(q), 'var')}`;
}

function parseNum(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return NaN;
  const norm = raw.includes('(') ? raw : raw.replace(/,/g, '.');
  try {
    const v = evaluate(norm);
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (v && v.isComplex && Math.abs(v.im) < 1e-12) return Number.isFinite(v.re) ? v.re : NaN;
    return NaN;
  } catch {
    return NaN;
  }
}

function pickScale(maxAbs) {
  if (!(maxAbs > 0)) return { mul: 1, pfx: '' };
  const e = Math.floor(Math.log10(maxAbs) / 3) * 3;
  const map = { 9: 'G', 6: 'M', 3: 'k', 0: '', '-3': 'm', '-6': 'µ', '-9': 'n', '-12': 'p' };
  const clamped = Math.max(-12, Math.min(9, e));
  return { mul: 10 ** (-clamped), pfx: map[clamped] ?? '' };
}

function intro(text, examples = []) {
  return `<div class="tool-intro"><p>${text}</p>${
    examples.length
      ? `<div class="ex-row"><span class="mute small">Örnek dene:</span>${examples
          .map((e, i) => `<button type="button" class="chip ex" data-ex="${i}">${esc(e.label)}</button>`)
          .join('')}</div>`
      : ''
  }</div>`;
}

function bindExamples(el, examples, apply) {
  el.querySelector('.ex-row')?.addEventListener('click', e => {
    const b = e.target.closest('[data-ex]');
    if (b) apply(examples[+b.dataset.ex]);
  });
}

function safePlot(cv, series, opts) {
  if (!cv || cv.clientWidth < 40) return;
  plot(cv, series, opts);
}

function attachReadout(cv, readoutEl, format, clean) {
  const onMove = e => {
    const m = cv._map;
    if (!m || !m.series.length) return;
    const x = e.offsetX;
    if (x < m.L || x > m.L + m.pw) { readoutEl.textContent = ''; return; }
    const t = (x - m.L) / m.pw;
    const xv = m.xlog ? m.x0 * (m.x1 / m.x0) ** t : m.x0 + (m.x1 - m.x0) * t;
    const xs = m.series[0].xs;
    if (!xs.length) return;
    // Binary search for nearest x
    let lo = 0, hi = xs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < xv) lo = mid + 1; else hi = mid;
    }
    const idx = lo > 0 && Math.abs(xs[lo - 1] - xv) < Math.abs(xs[lo] - xv) ? lo - 1 : lo;
    readoutEl.textContent = format(xs[idx], m.series, idx);
  };
  const onLeave = () => { readoutEl.textContent = ''; };
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerleave', onLeave);
  clean.add(() => {
    cv.removeEventListener('pointermove', onMove);
    cv.removeEventListener('pointerleave', onLeave);
  });
}

let sliderUid = 0;

/**
 * Reusable slider + editable engineering text input control.
 */
function createSlider(container, { label, unit = '', min, max, value, log = false, positive = log, step, onInput, onCommit }) {
  const uid = `sim-s-${++sliderUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'sim-ctrl';
  wrap.innerHTML = `<div class="sim-ctrl-top">
      <label class="sim-ctrl-lbl" for="${uid}-t">${esc(label)}</label>
      <div class="sim-ctrl-in">
        <input id="${uid}-t" type="text" class="inp mono sim-val-in" autocomplete="off" spellcheck="false" aria-label="${esc(label)} değeri">
        <span class="sim-unit mono">${esc(unit)}</span>
      </div>
    </div>
    <input id="${uid}-r" type="range" class="sim-range" aria-label="${esc(label)} sürgüsü">`;
  container.append(wrap);

  const txt = wrap.querySelector(`#${uid}-t`);
  const rng = wrap.querySelector(`#${uid}-r`);
  let cur = value;

  if (log) {
    rng.min = '0';
    rng.max = '1000';
    rng.step = '1';
  } else {
    rng.min = String(min);
    rng.max = String(max);
    rng.step = String(step ?? ((max - min) / 200));
  }

  const valToPos = v => {
    const c = Math.max(min, Math.min(max, v));
    return log ? Math.round((1000 * Math.log(c / min)) / Math.log(max / min)) : c;
  };
  const posToVal = p => (log ? min * (max / min) ** (p / 1000) : p);

  const set = (v, updateText = true) => {
    cur = v;
    rng.value = String(valToPos(v));
    if (updateText) txt.value = fmtInp(v, log ? 3 : 4);
    txt.classList.remove('bad');
  };

  rng.addEventListener('input', () => {
    const raw = posToVal(+rng.value);
    cur = log ? +raw.toPrecision(3) : +raw.toPrecision(4);
    txt.value = fmtInp(cur, log ? 3 : 4);
    txt.classList.remove('bad');
    onInput(cur);
  });

  rng.addEventListener('change', () => {
    if (onCommit) onCommit(cur);
  });

  txt.addEventListener('input', () => {
    const v = parseNum(txt.value);
    const valid = Number.isFinite(v) && (positive ? v > 0 : true);
    txt.classList.toggle('bad', !valid);
    if (!valid) return;
    cur = v;
    rng.value = String(valToPos(v));
    onInput(cur);
  });

  txt.addEventListener('change', () => {
    const v = parseNum(txt.value);
    if (Number.isFinite(v) && (positive ? v > 0 : true)) {
      cur = v;
      if (onCommit) onCommit(cur);
    }
  });

  set(value, true);
  return {
    el: wrap,
    set,
    get: () => cur,
    setVisible: show => { wrap.hidden = !show; },
  };
}

// =====================================================================
// 1. DEVRE ÇÖZÜCÜ (DC / AC Modified Nodal Analysis)
// =====================================================================
const DC_UNIT = { R: 'Ω', L: 'H', C: 'F', V: 'V', I: 'A' };
const DC_TYPES = [
  ['R', 'R · Direnç'],
  ['L', 'L · Bobin'],
  ['C', 'C · Kondansatör'],
  ['V', 'V · Gerilim kay.'],
  ['I', 'I · Akım kay.'],
];

const DC_PRESETS = [
  {
    label: 'Gerilim bölücü',
    mode: 'dc',
    f: '1k',
    rows: [
      { type: 'V', name: 'V1', a: '1', b: '0', value: '12', phase: '0' },
      { type: 'R', name: 'R1', a: '1', b: '2', value: '1k', phase: '0' },
      { type: 'R', name: 'R2', a: '2', b: '0', value: '2k', phase: '0' },
    ],
  },
  {
    label: 'Wheatstone köprüsü',
    mode: 'dc',
    f: '50',
    rows: [
      { type: 'V', name: 'V1', a: 'in', b: '0', value: '10', phase: '0' },
      { type: 'R', name: 'R1', a: 'in', b: 'a', value: '1k', phase: '0' },
      { type: 'R', name: 'R2', a: 'a', b: '0', value: '1k', phase: '0' },
      { type: 'R', name: 'R3', a: 'in', b: 'b', value: '2k', phase: '0' },
      { type: 'R', name: 'R4', a: 'b', b: '0', value: '2k', phase: '0' },
      { type: 'R', name: 'Rg', a: 'a', b: 'b', value: '1k', phase: '0' },
    ],
  },
  {
    label: 'RC alçak geçiren (AC)',
    mode: 'ac',
    f: '1591.55',
    rows: [
      { type: 'V', name: 'V1', a: 'in', b: '0', value: '10', phase: '0' },
      { type: 'R', name: 'R1', a: 'in', b: 'out', value: '1k', phase: '0' },
      { type: 'C', name: 'C1', a: 'out', b: '0', value: '100n', phase: '0' },
    ],
  },
  {
    label: 'Seri RLC rezonans (AC)',
    mode: 'ac',
    f: '5032.92',
    rows: [
      { type: 'V', name: 'V1', a: '1', b: '0', value: '10', phase: '0' },
      { type: 'R', name: 'R1', a: '1', b: '2', value: '100', phase: '0' },
      { type: 'L', name: 'L1', a: '2', b: '3', value: '10m', phase: '0' },
      { type: 'C', name: 'C1', a: '3', b: '0', value: '100n', phase: '0' },
    ],
  },
  {
    label: 'İki kaynaklı devre',
    mode: 'dc',
    f: '50',
    rows: [
      { type: 'V', name: 'V1', a: '1', b: '0', value: '12', phase: '0' },
      { type: 'R', name: 'R1', a: '1', b: '2', value: '1k', phase: '0' },
      { type: 'R', name: 'R2', a: '2', b: '0', value: '2k', phase: '0' },
      { type: 'R', name: 'R3', a: '2', b: '3', value: '1k', phase: '0' },
      { type: 'I', name: 'I1', a: '0', b: '3', value: '5m', phase: '0' },
    ],
  },
];

function mountDC(el) {
  const clean = createCleanup();
  let mode = 'dc';
  let freqStr = '1k';
  let rows = DC_PRESETS[0].rows.map(r => ({ ...r }));

  el.innerHTML = `<div class="sim-wrap">
    ${intro('Devre elemanlarını tabloya gir; düğüm gerilimleri, dal akımları ve güçler <b>yazarken</b> çözülür. <b>0</b> düğümü topraktır.', DC_PRESETS)}
    <div class="sim-toolbar">
      <div class="sim-toolbar-group">
        <div class="seg" role="tablist" data-mode>
          <button type="button" data-m="dc" class="on">DC Analiz</button>
          <button type="button" data-m="ac">AC Fazör</button>
        </div>
        <label class="sim-freq-box" data-fbox hidden>
          <span>Frekans f (Hz)</span>
          <input type="text" class="inp mono sim-freq-in" data-f value="1k" autocomplete="off" spellcheck="false" aria-label="AC frekans (Hz)">
        </label>
      </div>
      <button type="button" class="btn small" data-add>${icon('plus')} Eleman ekle</button>
    </div>
    <div class="sim-table-wrap">
      <table class="sim-tbl" aria-label="Devre eleman listesi">
        <thead>
          <tr>
            <th>Tip</th>
            <th>Ad</th>
            <th>Düğüm +</th>
            <th>Düğüm −</th>
            <th>Değer</th>
            <th data-ac-col hidden>Faz (°)</th>
            <th aria-label="Sil"></th>
          </tr>
        </thead>
        <tbody data-tbody></tbody>
      </table>
    </div>
    <p class="sim-hint">Akım yönü: düğüm + → düğüm − · Kaynaklarda <b>düğüm +</b> pozitif uçtur · DC'de bobin kısa devre, kondansatör açık devredir · AC değerler efektif (RMS).</p>
    <div class="sim-col" data-out aria-live="polite"></div>
  </div>`;

  const tbody = el.querySelector('[data-tbody]');
  const out = el.querySelector('[data-out]');
  const fbox = el.querySelector('[data-fbox]');
  const finp = el.querySelector('[data-f]');

  const nextName = type => {
    const used = new Set(rows.map(r => r.name.trim()));
    let k = 1;
    while (used.has(`${type}${k}`)) k++;
    return `${type}${k}`;
  };

  function renderTable() {
    const isAC = mode === 'ac';
    el.querySelectorAll('[data-ac-col]').forEach(x => { x.hidden = !isAC; });
    fbox.hidden = !isAC;
    finp.value = freqStr;
    tbody.innerHTML = rows.map((r, i) => {
      const isSrc = r.type === 'V' || r.type === 'I';
      return `<tr data-row="${i}">
        <td><select class="inp sim-tbl-sel" data-k="type" aria-label="Eleman tipi">${DC_TYPES.map(([k, l]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><input class="inp mono sim-tbl-in" data-k="name" value="${esc(r.name)}" autocomplete="off" spellcheck="false" aria-label="Eleman adı"></td>
        <td><input class="inp mono sim-tbl-node" data-k="a" value="${esc(r.a)}" autocomplete="off" spellcheck="false" aria-label="${esc(r.name)} düğüm +"></td>
        <td><input class="inp mono sim-tbl-node" data-k="b" value="${esc(r.b)}" autocomplete="off" spellcheck="false" aria-label="${esc(r.name)} düğüm −"></td>
        <td><input class="inp mono sim-tbl-val" data-k="value" value="${esc(r.value)}" placeholder="${DC_UNIT[r.type]}" autocomplete="off" spellcheck="false" aria-label="${esc(r.name)} değeri (${DC_UNIT[r.type]})"></td>
        <td data-ac-col ${isAC ? '' : 'hidden'}>${isSrc
          ? `<input class="inp mono sim-tbl-phase" data-k="phase" value="${esc(r.phase ?? '0')}" placeholder="0" autocomplete="off" spellcheck="false" aria-label="${esc(r.name)} faz açısı">`
          : `<span class="mute small mono">—</span>`}</td>
        <td><button type="button" class="sim-tbl-del" data-del="${i}" aria-label="${esc(r.name)} sil" title="Sil">${icon('x')}</button></td>
      </tr>`;
    }).join('');
  }

  function solveAndRender() {
    const isAC = mode === 'ac';
    const f = isAC ? parseNum(freqStr) : 0;
    const parsed = rows.map((r, idx) => ({
      type: r.type,
      name: r.name.trim() || `${r.type}${idx + 1}`,
      a: r.a,
      b: r.b,
      value: parseNum(r.value),
      phase: r.type === 'V' || r.type === 'I' ? (String(r.phase ?? '').trim() === '' ? 0 : parseNum(r.phase)) : 0,
    }));

    const res = solveMNA(parsed, { mode, f });
    if (!res.ok) {
      out.innerHTML = `<div class="sim-err">${esc(res.error)}</div>`;
      return;
    }

    const nodeNames = Object.keys(res.nodes).sort((a, b) => {
      if (a === '0') return 1;
      if (b === '0') return -1;
      return a.localeCompare(b, 'tr', { numeric: true });
    });

    const nodesHtml = `<div class="sim-panel">
      <div class="sim-head"><h4 class="sim-title">Düğüm Gerilimleri</h4><span class="mute small mono">${isAC ? `f = ${esc(fmtUnit(f, 'Hz'))}` : 'DC kararlı durum'}</span></div>
      <div class="sim-nodes">${nodeNames.map(n => {
        const v = res.nodes[n];
        const isGnd = n === '0';
        return `<div class="sim-node-card ${isGnd ? 'sim-node-gnd' : ''}">
          <span class="sim-kpi-lbl">${isGnd ? 'V(0) · Toprak' : `V(${esc(n)})`}</span>
          <b class="sim-kpi-val mono">${esc(isAC ? fmtPolar(v, 'V') : fmtUnit(v, 'V'))}</b>
          ${isAC && !isGnd ? `<span class="sim-kpi-sub mono">${esc(fmtRect(v, 'V'))}</span>` : ''}
        </div>`;
      }).join('')}</div>
    </div>`;

    const branchRows = rows.map((r, idx) => {
      const effName = r.name.trim() || `${r.type}${idx + 1}`;
      const b = res.branches[effName];
      if (!b) return '';
      const realP = isAC ? b.p.re : b.p;
      const pCls = realP < -1e-12 ? 'sim-pwr-src' : 'sim-pwr-load';
      const vTxt = isAC ? fmtPolar(b.v, 'V') : fmtUnit(b.v, 'V');
      const iTxt = isAC ? fmtPolar(b.i, 'A') : fmtUnit(b.i, 'A');
      const pTxt = isAC ? fmtPowerAC(b.p) : fmtUnit(b.p, 'W');
      const sMag = isAC ? `<div class="sim-kpi-sub mono">|S| = ${esc(fmtUnit(Math.hypot(b.p.re, b.p.im), 'VA'))}</div>` : '';
      return `<tr>
        <td class="mono"><b>${esc(effName)}</b> <span class="mute small">(${esc(r.a)}→${esc(r.b)})</span></td>
        <td class="sim-tbl-num">${esc(vTxt)}</td>
        <td class="sim-tbl-num">${esc(iTxt)}</td>
        <td class="sim-tbl-num ${pCls}">${esc(pTxt)}${sMag}</td>
      </tr>`;
    }).join('');

    const branchesHtml = `<div class="sim-panel">
      <div class="sim-head"><h4 class="sim-title">Dal Sonuçları</h4><span class="mute small">${isAC ? 'S = P + jQ · negatif P kaynak gücüdür' : 'Negatif P kaynak tarafından sağlanan güçtür'}</span></div>
      <div class="sim-table-wrap">
        <table class="sim-tbl">
          <thead>
            <tr>
              <th>Eleman</th>
              <th>Gerilim (V)</th>
              <th>Akım (I)</th>
              <th>${isAC ? 'Karmaşık Güç (S)' : 'Güç (P)'}</th>
            </tr>
          </thead>
          <tbody>${branchRows}</tbody>
        </table>
      </div>
    </div>`;

    out.innerHTML = nodesHtml + branchesHtml;
  }

  el.querySelector('[data-mode]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === mode) return;
    mode = b.dataset.m;
    el.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x === b));
    renderTable();
    solveAndRender();
  });

  finp.addEventListener('input', () => {
    freqStr = finp.value;
    solveAndRender();
  });

  el.querySelector('[data-add]').addEventListener('click', () => {
    const last = rows.at(-1);
    rows.push({
      type: 'R',
      name: nextName('R'),
      a: last ? last.b : '1',
      b: '0',
      value: '1k',
      phase: '0',
    });
    renderTable();
    solveAndRender();
  });

  tbody.addEventListener('input', e => {
    const tr = e.target.closest('tr[data-row]');
    if (!tr) return;
    const idx = +tr.dataset.row;
    const key = e.target.dataset.k;
    if (!key) return;
    rows[idx][key] = e.target.value;
    solveAndRender();
  });

  tbody.addEventListener('change', e => {
    const tr = e.target.closest('tr[data-row]');
    if (!tr || e.target.dataset.k !== 'type') return;
    const idx = +tr.dataset.row;
    const nextType = e.target.value;
    rows[idx].type = nextType;
    if (/^[RLCVI]\d+$/.test(rows[idx].name.trim())) {
      rows[idx].name = nextName(nextType);
    }
    renderTable();
    solveAndRender();
  });

  tbody.addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    rows.splice(+del.dataset.del, 1);
    renderTable();
    solveAndRender();
  });

  bindExamples(el, DC_PRESETS, preset => {
    mode = preset.mode;
    freqStr = preset.f;
    rows = preset.rows.map(r => ({ ...r }));
    el.querySelectorAll('[data-mode] button').forEach(x => x.classList.toggle('on', x.dataset.m === mode));
    renderTable();
    solveAndRender();
  });

  renderTable();
  solveAndRender();
  return clean.run;
}

// =====================================================================
// 2. GEÇİCİ DURUM (RC / RL / RLC Step Response)
// =====================================================================
const TRANSIENT_PRESETS = [
  { label: 'RC şarj (τ = 1 ms)',        kind: 'RC',  R: 1e3, L: 10e-3, C: 1e-6, V: 5 },
  { label: 'RL bobin akımı',            kind: 'RL',  R: 100, L: 10e-3, C: 1e-6, V: 10 },
  { label: 'RLC az sönümlü (ζ = 0.2)',  kind: 'RLC', R: 40,  L: 10e-3, C: 1e-6, V: 10 },
  { label: 'RLC kritik sönümlü (ζ = 1)', kind: 'RLC', R: 200, L: 10e-3, C: 1e-6, V: 10 },
  { label: 'RLC aşırı sönümlü (ζ = 2.5)', kind: 'RLC', R: 500, L: 10e-3, C: 1e-6, V: 10 },
];

function mountTransient(el) {
  const clean = createCleanup();
  const state = { kind: 'RLC', R: 40, L: 10e-3, C: 1e-6, V: 10 };
  let rafId = 0;

  const stopSweep = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
  clean.add(stopSweep);

  el.innerHTML = `<div class="sim-wrap">
    ${intro('Seri <b>RC</b>, <b>RL</b> ve <b>RLC</b> devrelerinin basamak (adım) cevabını sürgülerle canlı incele; zaman penceresi otomatik ayarlanır.', TRANSIENT_PRESETS)}
    <div class="sim-toolbar">
      <div class="seg sim-seg-wrap" role="tablist" data-kind>
        <button type="button" data-k="RC">Seri RC</button>
        <button type="button" data-k="RL">Seri RL</button>
        <button type="button" data-k="RLC" class="on">Seri RLC</button>
      </div>
    </div>
    <div class="sim-grid">
      <div class="sim-panel" data-ctrls></div>
      <div class="sim-col">
        <div class="sim-kpis" data-kpis></div>
        <div class="sim-plot-card">
          <div class="sim-head">
            <h4 class="sim-title" data-vtitle>Kondansatör Gerilimi vC(t)</h4>
            <div class="sim-legend"><span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PLOT_COLORS[0]}"></i><span data-vleg>vC(t)</span></span></div>
          </div>
          <div class="sim-plot-box" data-box1><canvas class="sim-plot-cv" data-cv1></canvas><div class="sim-readout mono" data-rd1></div></div>
          <div class="sim-axis-lbl mono" data-tunit1></div>
        </div>
        <div class="sim-plot-card">
          <div class="sim-head">
            <h4 class="sim-title">Devre Akımı i(t)</h4>
            <div class="sim-legend"><span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PLOT_COLORS[1]}"></i>i(t)</span></div>
          </div>
          <div class="sim-plot-box"><canvas class="sim-plot-cv" data-cv2></canvas><div class="sim-readout mono" data-rd2></div></div>
          <div class="sim-axis-lbl mono" data-tunit2></div>
        </div>
      </div>
    </div>
  </div>`;

  const ctrls = el.querySelector('[data-ctrls]');
  const kpis = el.querySelector('[data-kpis]');
  const cv1 = el.querySelector('[data-cv1]');
  const cv2 = el.querySelector('[data-cv2]');
  const rd1 = el.querySelector('[data-rd1]');
  const rd2 = el.querySelector('[data-rd2]');
  const vtitle = el.querySelector('[data-vtitle]');
  const vleg = el.querySelector('[data-vleg]');
  const tunit1 = el.querySelector('[data-tunit1]');
  const tunit2 = el.querySelector('[data-tunit2]');

  let lastData = null;

  function compute() {
    const tEnd = autoStepWindow(state);
    let n = 450;
    if (state.kind === 'RLC') {
      const wn = 1 / Math.sqrt(state.L * state.C);
      const zeta = (state.R / 2) * Math.sqrt(state.C / state.L);
      if (zeta < 1) {
        const cycles = (tEnd * wn * Math.sqrt(1 - zeta * zeta)) / (2 * Math.PI);
        n = Math.min(1600, Math.max(450, Math.ceil(cycles * 28)));
      }
    }
    const res = stepResponse(state, tEnd, n);
    const tSc = pickScale(tEnd);
    const maxI = Math.max(...res.i.map(Math.abs), 1e-12);
    const iSc = pickScale(maxI);
    const ts = res.t.map(x => x * tSc.mul);
    const isScaled = res.i.map(x => x * iSc.mul);
    const vMin = Math.min(...res.v), vMax = Math.max(...res.v);
    const iMin = Math.min(...isScaled), iMax = Math.max(...isScaled);
    return { res, tEnd, tSc, iSc, ts, isScaled, vMin, vMax, iMin, iMax };
  }

  function renderKPIs(res) {
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const cards = [
      { lbl: 'Zaman sabiti τ', val: fmtUnit(res.tau, 's'), sub: state.kind === 'RLC' && res.zeta < 1 ? 'zarf 1/α' : '' },
      { lbl: 'Yerleşme (%2)', val: fmtUnit(res.ts, 's'), sub: '' },
    ];
    if (state.kind === 'RLC') {
      cards.push(
        { lbl: 'Doğal frekans ωn', val: fmtUnit(res.wn, 'rad/s'), sub: `fn = ${fmtUnit(res.wn / (2 * Math.PI), 'Hz')}` },
        { lbl: 'Sönüm oranı ζ', val: fmtNum(res.zeta, 4), sub: '' },
        { lbl: 'Sönüm türü', val: cap(res.type), sub: '', acc: true }
      );
    } else {
      cards.push({ lbl: 'Tepe akım V/R', val: fmtUnit(state.V / state.R, 'A'), sub: '' });
    }
    kpis.innerHTML = cards.map(c => `<div class="sim-kpi ${c.acc ? 'sim-kpi-accent' : ''}">
      <span class="sim-kpi-lbl">${esc(c.lbl)}</span>
      <b class="sim-kpi-val mono">${esc(c.val)}</b>
      ${c.sub ? `<span class="sim-kpi-sub mono">${esc(c.sub)}</span>` : ''}
    </div>`).join('');
  }

  function drawFrame(data, frac = 1) {
    const { res, tEnd, tSc, iSc, ts, isScaled } = data;
    const isRL = state.kind === 'RL';
    vtitle.textContent = isRL ? 'Bobin Gerilimi vL(t)' : 'Kondansatör Gerilimi vC(t)';
    vleg.textContent = isRL ? 'vL(t)' : 'vC(t)';
    const tLabel = `Zaman t (${tSc.pfx}s)`;
    tunit1.textContent = tLabel;
    tunit2.textContent = tLabel;

    const k = Math.max(2, Math.round(ts.length * frac));
    const xs = ts.slice(0, k);
    const x1 = tEnd * tSc.mul;
    const vSeries = [
      { name: isRL ? 'vL' : 'vC', color: PLOT_COLORS[0], xs, ys: res.v.slice(0, k) },
    ];
    const iSeries = [
      { name: 'i', color: PLOT_COLORS[1], xs, ys: isScaled.slice(0, k) },
    ];
    // Lock y-bounds during sweep reveal so the axes never jump mid-animation
    if (frac < 1) {
      vSeries.push({ name: '', color: 'rgba(0,0,0,0)', xs: [0, x1], ys: [data.vMin, data.vMax] });
      iSeries.push({ name: '', color: 'rgba(0,0,0,0)', xs: [0, x1], ys: [data.iMin, data.iMax] });
    }

    safePlot(cv1, vSeries, { x0: 0, x1, ylabel: 'V', height: 205 });
    safePlot(cv2, iSeries, { x0: 0, x1, ylabel: `${iSc.pfx}A`, height: 185 });
  }

  function update(animate = false) {
    stopSweep();
    lastData = compute();
    renderKPIs(lastData.res);
    if (!animate || isStaticMotion()) {
      drawFrame(lastData, 1);
      return;
    }
    const start = performance.now();
    const dur = 260;
    const step = now => {
      const u = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - u) ** 3;
      drawFrame(lastData, eased);
      if (u < 1) rafId = requestAnimationFrame(step);
      else rafId = 0;
    };
    rafId = requestAnimationFrame(step);
  }

  const sR = createSlider(ctrls, {
    label: 'Direnç R', unit: 'Ω', min: 1, max: 1e6, value: state.R, log: true,
    onInput: v => { state.R = v; update(false); },
    onCommit: () => update(true),
  });
  const sL = createSlider(ctrls, {
    label: 'Endüktans L', unit: 'H', min: 10e-6, max: 10, value: state.L, log: true,
    onInput: v => { state.L = v; update(false); },
    onCommit: () => update(true),
  });
  const sC = createSlider(ctrls, {
    label: 'Kapasitans C', unit: 'F', min: 1e-9, max: 10e-3, value: state.C, log: true,
    onInput: v => { state.C = v; update(false); },
    onCommit: () => update(true),
  });
  const sV = createSlider(ctrls, {
    label: 'Kaynak Gerilimi V', unit: 'V', min: 1, max: 50, value: state.V, step: 0.5,
    onInput: v => { state.V = v; update(false); },
    onCommit: () => update(true),
  });

  function syncVisibility() {
    sL.setVisible(state.kind !== 'RC');
    sC.setVisible(state.kind !== 'RL');
    el.querySelectorAll('[data-kind] button').forEach(b => b.classList.toggle('on', b.dataset.k === state.kind));
  }

  el.querySelector('[data-kind]').addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (!b || b.dataset.k === state.kind) return;
    state.kind = b.dataset.k;
    syncVisibility();
    update(true);
  });

  bindExamples(el, TRANSIENT_PRESETS, p => {
    Object.assign(state, { kind: p.kind, R: p.R, L: p.L, C: p.C, V: p.V });
    sR.set(state.R);
    sL.set(state.L);
    sC.set(state.C);
    sV.set(state.V);
    syncVisibility();
    update(true);
  });

  attachReadout(cv1, rd1, (x, s, idx) => {
    const pfx = lastData?.tSc.pfx ?? '';
    return `t = ${fmtNum(x, 4)} ${pfx}s · ${state.kind === 'RL' ? 'vL' : 'vC'} = ${fmtNum(s[0].ys[idx], 4)} V`;
  }, clean);

  attachReadout(cv2, rd2, (x, s, idx) => {
    const tPfx = lastData?.tSc.pfx ?? '';
    const iPfx = lastData?.iSc.pfx ?? '';
    return `t = ${fmtNum(x, 4)} ${tPfx}s · i = ${fmtNum(s[0].ys[idx], 4)} ${iPfx}A`;
  }, clean);

  const ro = new ResizeObserver(() => {
    if (lastData) drawFrame(lastData, 1);
  });
  ro.observe(el.querySelector('[data-box1]'));
  clean.add(() => ro.disconnect());

  syncVisibility();
  update(true);
  return clean.run;
}

// =====================================================================
// 3. AC FAZÖR ANİMASYONU (Series RLC Rotating Phasors + Oscilloscope)
// =====================================================================
const PHASOR_PRESETS = [
  { label: 'Rezonans (f = f₀)',   R: 100, L: 10e-3, C: 1e-6, f: 1591.55, Vm: 10 },
  { label: 'Endüktif (f > f₀)',   R: 100, L: 20e-3, C: 1e-6, f: 2000,    Vm: 10 },
  { label: 'Kapasitif (f < f₀)',  R: 100, L: 10e-3, C: 1e-6, f: 800,     Vm: 10 },
  { label: 'Yüksek Q rezonans',   R: 25,  L: 10e-3, C: 1e-6, f: 1591.55, Vm: 10 },
];

const PH_COL = {
  V:  PLOT_COLORS[0], // #f4f4f5
  I:  PLOT_COLORS[1], // #5ab0ff
  VR: PLOT_COLORS[3], // #5be49b
  VL: PLOT_COLORS[4], // #ffd166
  VC: PLOT_COLORS[5], // #c084fc
};

function mountPhasor(el) {
  const clean = createCleanup();
  const state = { R: 100, L: 20e-3, C: 1e-6, f: 2000, Vm: 10 };
  let playing = true;
  let speed = 1;
  let phi = Math.PI / 6;
  let lastTs = 0;
  let rafId = 0;

  el.innerHTML = `<div class="sim-wrap">
    ${intro('Seri RLC devresinde <b>dönen fazörleri</b> (V, I, VR, VL, VC) ve eşzamanlı <b>v(t), i(t)</b> osiloskobunu canlı izle.', PHASOR_PRESETS)}
    <div class="sim-toolbar">
      <div class="sim-toolbar-group">
        <button type="button" class="btn small" data-play></button>
        <div class="seg" data-spd aria-label="Animasyon hızı">
          <button type="button" data-sp="0.25">0.25×</button>
          <button type="button" data-sp="0.5">0.5×</button>
          <button type="button" data-sp="1" class="on">1×</button>
          <button type="button" data-sp="2">2×</button>
        </div>
      </div>
      <div class="sim-toolbar-group">
        <span class="sim-badge" data-regime></span>
        <button type="button" class="btn ghost small" data-snap>f = f₀ yap</button>
      </div>
    </div>
    <div class="sim-grid">
      <div class="sim-panel" data-ctrls></div>
      <div class="sim-col">
        <div class="sim-scope-wrap" data-wrap><canvas class="sim-scope" data-cv aria-label="Dönen fazör diyagramı ve osiloskop"></canvas></div>
        <div class="sim-legend">
          <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PH_COL.V}"></i>V (kaynak)</span>
          <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PH_COL.I}"></i>I (akım, ölçekli)</span>
          <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PH_COL.VR}"></i>VR</span>
          <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PH_COL.VL}"></i>VL</span>
          <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PH_COL.VC}"></i>VC</span>
        </div>
        <div class="sim-kpis" data-kpis></div>
      </div>
    </div>
  </div>`;

  const ctrls = el.querySelector('[data-ctrls]');
  const kpis = el.querySelector('[data-kpis]');
  const cv = el.querySelector('[data-cv]');
  const wrap = el.querySelector('[data-wrap]');
  const playBtn = el.querySelector('[data-play]');
  const regimeEl = el.querySelector('[data-regime]');

  let rlc = seriesRLC(state);

  function syncPlayBtn() {
    const stat = isStaticMotion();
    playBtn.disabled = stat;
    if (stat) {
      playBtn.innerHTML = `${icon('pause')} Sabit kare`;
    } else {
      playBtn.innerHTML = playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    }
  }

  function renderMetrics() {
    const stateLabel = rlc.state === 'rezonansta' ? 'Rezonansta' : rlc.state === 'endüktif' ? 'Endüktif' : 'Kapasitif';
    regimeEl.textContent = stateLabel;
    regimeEl.className = `sim-badge ${rlc.state === 'rezonansta' ? 'sim-badge-acc' : ''}`;
    const pfNote = rlc.state === 'rezonansta' ? 'birim' : rlc.state === 'endüktif' ? 'geri (endüktif)' : 'ileri (kapasitif)';

    kpis.innerHTML = [
      { lbl: 'Empedans Z', val: fmtRect(rlc.Z, 'Ω'), sub: `XL=${fmtUnit(rlc.XL, 'Ω')}, XC=${fmtUnit(rlc.XC, 'Ω')}` },
      { lbl: 'Empedans |Z|', val: fmtUnit(rlc.Zmag, 'Ω'), sub: '' },
      { lbl: 'Faz açısı θ', val: fmtDeg(rlc.thetaDeg), sub: rlc.thetaDeg > 0.05 ? 'I geride' : rlc.thetaDeg < -0.05 ? 'I ileride' : 'aynı fazda' },
      { lbl: 'Akım genliği Im', val: fmtUnit(rlc.Im, 'A'), sub: `VR=${fmtUnit(rlc.VR.abs(), 'V')}` },
      { lbl: 'Güç faktörü cos θ', val: rlc.pf.toFixed(3), sub: pfNote },
      { lbl: 'Rezonans f₀', val: fmtUnit(rlc.f0, 'Hz'), sub: stateLabel, acc: rlc.state === 'rezonansta' },
    ].map(c => `<div class="sim-kpi ${c.acc ? 'sim-kpi-accent' : ''}">
      <span class="sim-kpi-lbl">${esc(c.lbl)}</span>
      <b class="sim-kpi-val mono">${esc(c.val)}</b>
      ${c.sub ? `<span class="sim-kpi-sub mono">${esc(c.sub)}</span>` : ''}
    </div>`).join('');
  }

  function drawArrow(ctx, cx, cy, dx, dy, color, label, lw = 2.2) {
    const len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    const ux = dx / len, uy = dy / len;
    const x2 = cx + dx, y2 = cy + dy;
    const head = Math.min(9, len * 0.35);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.48, y2 - uy * head + ux * head * 0.48);
    ctx.lineTo(x2 - ux * head + uy * head * 0.48, y2 - uy * head - ux * head * 0.48);
    ctx.closePath();
    ctx.fill();

    if (label && len > 10) {
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x2 + ux * 13, y2 + uy * 13);
    }
  }

  function drawCanvas() {
    const W = wrap.clientWidth;
    if (W < 60) return;
    const stacked = W < 540;
    const H = stacked ? 470 : 320;
    const dpr = devicePixelRatio || 1;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = `${H}px`;

    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    // Geometry for phasor region and oscilloscope region
    const phW = stacked ? W : Math.round(W * 0.44);
    const phH = stacked ? 235 : H;
    const scX = stacked ? 16 : phW + 14;
    const scY = stacked ? phH + 24 : 28;
    const scW = Math.max(80, (stacked ? W - 32 : W - phW - 28));
    const scH = stacked ? H - phH - 46 : H - 56;
    const scMidY = scY + scH / 2;
    const cx = Math.round(phW * 0.5);
    const cy = stacked ? Math.round(phH * 0.54) : scMidY;
    const Rpx = stacked
      ? Math.max(44, Math.min(phW, phH) * 0.36)
      : Math.max(44, Math.min(phW * 0.37, scH * 0.42));
    const scAmp = stacked ? scH * 0.4 : Rpx;
    const iRad = Rpx * 0.68;
    const scAmpI = stacked ? scAmp * 0.72 : iRad;

    // Divider line between phasor and scope
    c.strokeStyle = 'rgba(255,255,255,.08)';
    c.lineWidth = 1;
    c.beginPath();
    if (stacked) { c.moveTo(12, phH); c.lineTo(W - 12, phH); }
    else { c.moveTo(phW, 12); c.lineTo(phW, H - 12); }
    c.stroke();

    // Section captions
    c.font = '11px "JetBrains Mono", monospace';
    c.fillStyle = '#8b8b94';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText('FAZÖRLER', 14, 10);
    c.fillText('OSİLOSKOP  v(t), i(t)', scX, stacked ? phH + 8 : 10);

    // Polar rings & Re/Im axes
    c.strokeStyle = 'rgba(255,255,255,.07)';
    for (const frac of [0.5, 1]) {
      c.beginPath();
      c.arc(cx, cy, Rpx * frac, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,.14)';
    c.beginPath();
    c.moveTo(cx - Rpx - 10, cy); c.lineTo(cx + Rpx + 10, cy);
    c.moveTo(cx, cy - Rpx - 10); c.lineTo(cx, cy + Rpx + 10);
    c.stroke();

    // Scale voltages so all voltage phasors fit cleanly; scale current independently
    const maxV = Math.max(rlc.V.abs(), rlc.VR.abs(), rlc.VL.abs(), rlc.VC.abs(), 1e-12);
    const vScale = Rpx / maxV;

    const rot = (z, scale) => {
      const ang = Math.atan2(z.im, z.re) + phi;
      const mag = Math.hypot(z.re, z.im) * scale;
      return { dx: mag * Math.cos(ang), dy: -mag * Math.sin(ang), ang, mag };
    };

    const pV = rot(rlc.V, vScale);
    const pVR = rot(rlc.VR, vScale);
    const pVL = rot(rlc.VL, vScale);
    const pVC = rot(rlc.VC, vScale);
    const iAng = -rlc.thetaRad + phi;
    const pI = { dx: iRad * Math.cos(iAng), dy: -iRad * Math.sin(iAng), ang: iAng };

    // Phase angle arc theta between V and I
    if (Math.abs(rlc.thetaRad) > 0.03) {
      c.save();
      c.strokeStyle = 'rgba(90,176,255,.55)';
      c.lineWidth = 1.5;
      c.beginPath();
      // Canvas angles are negative of math angles
      c.arc(cx, cy, Math.min(28, Rpx * 0.3), -phi, -(phi - rlc.thetaRad), rlc.thetaRad < 0);
      c.stroke();
      c.restore();
    }

    // Oscilloscope grid
    c.strokeStyle = 'rgba(255,255,255,.06)';
    c.lineWidth = 1;
    for (let k = 0; k <= 8; k++) {
      const gx = scX + (scW * k) / 8;
      c.beginPath(); c.moveTo(gx, scY); c.lineTo(gx, scY + scH); c.stroke();
    }
    for (const f of [-1, -0.5, 0.5, 1]) {
      const gy = scMidY + f * scAmp;
      c.beginPath(); c.moveTo(scX, gy); c.lineTo(scX + scW, gy); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,.22)';
    c.beginPath(); c.moveTo(scX, scMidY); c.lineTo(scX + scW, scMidY); c.stroke();

    // Horizontal projection guide lines from V & I tips (when side-by-side)
    const vNowY = scMidY - Math.sin(phi) * scAmp;
    const iNowY = scMidY - Math.sin(phi - rlc.thetaRad) * scAmpI;
    if (!stacked) {
      c.save();
      c.setLineDash([4, 4]);
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(244,244,245,.25)';
      c.beginPath(); c.moveTo(cx + pV.dx, cy + pV.dy); c.lineTo(scX, vNowY); c.stroke();
      c.strokeStyle = 'rgba(90,176,255,.28)';
      c.beginPath(); c.moveTo(cx + pI.dx, cy + pI.dy); c.lineTo(scX, iNowY); c.stroke();
      c.restore();
    }

    // Draw phasor arrows
    drawArrow(c, cx, cy, pVL.dx, pVL.dy, PH_COL.VL, 'VL', 1.8);
    drawArrow(c, cx, cy, pVC.dx, pVC.dy, PH_COL.VC, 'VC', 1.8);
    drawArrow(c, cx, cy, pVR.dx, pVR.dy, PH_COL.VR, 'VR', 2.0);
    drawArrow(c, cx, cy, pI.dx, pI.dy, PH_COL.I, 'I', 2.2);
    drawArrow(c, cx, cy, pV.dx, pV.dy, PH_COL.V, 'V', 2.6);

    // Origin dot
    c.fillStyle = '#f4f4f5';
    c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();

    // Oscilloscope traces over 2 periods (4π): pen at left edge scX, scrolls right
    const spanRad = 4 * Math.PI;
    const steps = Math.max(120, Math.round(scW));
    const trace = (phaseOffset, amp, color, lw) => {
      c.strokeStyle = color;
      c.lineWidth = lw;
      c.beginPath();
      for (let k = 0; k <= steps; k++) {
        const u = (k / steps) * spanRad;
        const x = scX + (k / steps) * scW;
        const y = scMidY - Math.sin(phi + phaseOffset - u) * amp;
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    };
    trace(-rlc.thetaRad, scAmpI, PH_COL.I, 2);
    trace(0, scAmp, PH_COL.V, 2.2);

    // Live edge dots
    c.fillStyle = PH_COL.I;
    c.beginPath(); c.arc(scX, iNowY, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = PH_COL.V;
    c.beginPath(); c.arc(scX, vNowY, 4.5, 0, Math.PI * 2); c.fill();

    // Scope bottom ticks
    c.fillStyle = '#8b8b94';
    c.font = '10.5px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    const labels = ['0', '−T/2', '−T', '−3T/2', '−2T'];
    labels.forEach((lbl, idx) => {
      c.fillText(lbl, scX + (scW * idx) / 4, scY + scH + 5);
    });
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function startLoop() {
    stopLoop();
    if (!playing || isStaticMotion() || document.hidden) return;
    lastTs = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      // Visible slowed-down angular rotation (base ~1.8 rad/s * speed)
      phi = (phi + dt * 1.8 * speed) % (Math.PI * 2);
      drawCanvas();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function onParamChange() {
    rlc = seriesRLC(state);
    renderMetrics();
    drawCanvas();
  }

  const sR = createSlider(ctrls, { label: 'Direnç R', unit: 'Ω', min: 5, max: 1e3, value: state.R, log: true, onInput: v => { state.R = v; onParamChange(); } });
  const sL = createSlider(ctrls, { label: 'Endüktans L', unit: 'H', min: 100e-6, max: 1, value: state.L, log: true, onInput: v => { state.L = v; onParamChange(); } });
  const sC = createSlider(ctrls, { label: 'Kapasitans C', unit: 'F', min: 10e-9, max: 100e-6, value: state.C, log: true, onInput: v => { state.C = v; onParamChange(); } });
  const sF = createSlider(ctrls, { label: 'Frekans f', unit: 'Hz', min: 20, max: 20e3, value: state.f, log: true, onInput: v => { state.f = v; onParamChange(); } });
  const sV = createSlider(ctrls, { label: 'Kaynak Genliği Vm', unit: 'V', min: 1, max: 50, value: state.Vm, step: 0.5, onInput: v => { state.Vm = v; onParamChange(); } });

  playBtn.addEventListener('click', () => {
    if (isStaticMotion()) return;
    playing = !playing;
    syncPlayBtn();
    if (playing) startLoop(); else stopLoop();
  });

  el.querySelector('[data-spd]').addEventListener('click', e => {
    const b = e.target.closest('[data-sp]');
    if (!b) return;
    speed = +b.dataset.sp;
    el.querySelectorAll('[data-spd] button').forEach(x => x.classList.toggle('on', x === b));
  });

  el.querySelector('[data-snap]').addEventListener('click', () => {
    state.f = rlc.f0;
    sF.set(state.f);
    onParamChange();
  });

  bindExamples(el, PHASOR_PRESETS, p => {
    Object.assign(state, { R: p.R, L: p.L, C: p.C, f: p.f, Vm: p.Vm });
    sR.set(state.R); sL.set(state.L); sC.set(state.C); sF.set(state.f); sV.set(state.Vm);
    onParamChange();
  });

  const onVis = () => {
    if (document.hidden) stopLoop();
    else if (playing && !isStaticMotion()) startLoop();
  };
  document.addEventListener('visibilitychange', onVis);
  clean.add(() => document.removeEventListener('visibilitychange', onVis));
  clean.add(stopLoop);

  const ro = new ResizeObserver(() => drawCanvas());
  ro.observe(wrap);
  clean.add(() => ro.disconnect());

  syncPlayBtn();
  renderMetrics();
  drawCanvas();
  startLoop();
  return clean.run;
}

// =====================================================================
// 4. FİLTRE & BODE
// =====================================================================
const FILTER_PRESETS = [
  { label: 'RC alçak geçiren (1 kHz)',   type: 'rc-lp',  R: 1.59e3, L: 10e-3, C: 100e-9 },
  { label: 'RC yüksek geçiren (160 Hz)', type: 'rc-hp',  R: 10e3,   L: 10e-3, C: 100e-9 },
  { label: 'Dar bant geçiren (Q = 10)',  type: 'rlc-bp', R: 31.6,   L: 10e-3, C: 100e-9 },
  { label: '50 Hz bant söndüren',        type: 'rlc-bs', R: 100,    L: 1,     C: 10.13e-6 },
];

function mountFilter(el) {
  const clean = createCleanup();
  const state = { type: 'rc-lp', R: 1.59e3, L: 10e-3, C: 100e-9 };

  el.innerHTML = `<div class="sim-wrap">
    ${intro('RC ve RLC pasif filtrelerin <b>genlik (dB)</b> ve <b>faz (°)</b> Bode diyagramlarını sürgülerle canlı incele.', FILTER_PRESETS)}
    <div class="sim-toolbar">
      <div class="seg sim-seg-wrap" role="tablist" data-ft>
        <button type="button" data-t="rc-lp" class="on">RC Alçak Geçiren</button>
        <button type="button" data-t="rc-hp">RC Yüksek Geçiren</button>
        <button type="button" data-t="rlc-bp">RLC Bant Geçiren</button>
        <button type="button" data-t="rlc-bs">RLC Bant Söndüren</button>
      </div>
    </div>
    <div class="sim-grid">
      <div class="sim-panel" data-ctrls></div>
      <div class="sim-col">
        <div class="sim-kpis" data-kpis></div>
        <div class="sim-plot-card">
          <div class="sim-head">
            <h4 class="sim-title">Bode Genlik |H(j2πf)|</h4>
            <div class="sim-legend">
              <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PLOT_COLORS[0]}"></i>|H| (dB)</span>
              <span class="sim-legend-item"><i class="sim-legend-swatch" style="background:rgba(255,209,102,.55)"></i>−3 dB</span>
            </div>
          </div>
          <div class="sim-plot-box" data-box><canvas class="sim-plot-cv" data-cv1></canvas><div class="sim-readout mono" data-rd1></div></div>
          <div class="sim-axis-lbl mono">Frekans f (Hz, logaritmik)</div>
        </div>
        <div class="sim-plot-card">
          <div class="sim-head">
            <h4 class="sim-title">Bode Faz ∠H(j2πf)</h4>
            <div class="sim-legend"><span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${PLOT_COLORS[1]}"></i>∠H (°)</span></div>
          </div>
          <div class="sim-plot-box"><canvas class="sim-plot-cv" data-cv2></canvas><div class="sim-readout mono" data-rd2></div></div>
          <div class="sim-axis-lbl mono">Frekans f (Hz, logaritmik)</div>
        </div>
      </div>
    </div>
  </div>`;

  const ctrls = el.querySelector('[data-ctrls]');
  const kpis = el.querySelector('[data-kpis]');
  const cv1 = el.querySelector('[data-cv1]');
  const cv2 = el.querySelector('[data-cv2]');
  const rd1 = el.querySelector('[data-rd1]');
  const rd2 = el.querySelector('[data-rd2]');

  function draw() {
    const m = filterMetrics(state.type, state);
    const isRLC = state.type.startsWith('rlc');

    const cards = isRLC
      ? [
          { lbl: 'Merkez frekans f₀', val: fmtUnit(m.f0, 'Hz'), acc: true },
          { lbl: 'Kalite faktörü Q', val: fmtNum(m.Q, 4) },
          { lbl: 'Bant genişliği BW', val: fmtUnit(m.bw, 'Hz'), sub: '−3 dB genişlik' },
          { lbl: '−3 dB sınırları', val: `${fmtUnit(m.f1, 'Hz')}`, sub: `üst: ${fmtUnit(m.f2, 'Hz')}` },
        ]
      : [
          { lbl: 'Kesim frekansı fc', val: fmtUnit(m.fc, 'Hz'), sub: '−3.01 dB noktası', acc: true },
          { lbl: 'Açısal kesim ωc', val: fmtUnit(2 * Math.PI * m.fc, 'rad/s') },
          { lbl: 'Zaman sabiti τ', val: fmtUnit(state.R * state.C, 's') },
          { lbl: 'Eğim', val: state.type === 'rc-lp' ? '−20 dB/dek' : '+20 dB/dek' },
        ];

    kpis.innerHTML = cards.map(c => `<div class="sim-kpi ${c.acc ? 'sim-kpi-accent' : ''}">
      <span class="sim-kpi-lbl">${esc(c.lbl)}</span>
      <b class="sim-kpi-val mono">${esc(c.val)}</b>
      ${c.sub ? `<span class="sim-kpi-sub mono">${esc(c.sub)}</span>` : ''}
    </div>`).join('');

    const N = 500;
    const xs = Array.from({ length: N }, (_, i) => m.fMin * (m.fMax / m.fMin) ** (i / (N - 1)));
    const mag = new Array(N);
    const ph = new Array(N);
    let prevP = null;

    for (let i = 0; i < N; i++) {
      const H = transfer(state.type, state, xs[i]);
      const a = Math.hypot(H.re, H.im);
      mag[i] = Math.max(-72, 20 * Math.log10(Math.max(a, 1e-12)));
      const deg = (Math.atan2(H.im, H.re) * 180) / Math.PI;
      // Break phase line cleanly across the 180° jump of a notch filter
      if (prevP !== null && Math.abs(deg - prevP) > 140) {
        ph[i] = NaN;
      } else {
        ph[i] = deg;
      }
      prevP = deg;
    }

    safePlot(cv1, [
      { name: '|H|', color: PLOT_COLORS[0], xs, ys: mag },
      { name: '-3dB', color: 'rgba(255,209,102,.48)', xs: [m.fMin, m.fMax], ys: [-3, -3] },
    ], { xlog: true, x0: m.fMin, x1: m.fMax, ylabel: 'dB', height: 215 });

    safePlot(cv2, [
      { name: '∠H', color: PLOT_COLORS[1], xs, ys: ph },
    ], { xlog: true, x0: m.fMin, x1: m.fMax, ylabel: 'faz °', height: 180 });
  }

  const sR = createSlider(ctrls, { label: 'Direnç R', unit: 'Ω', min: 10, max: 1e6, value: state.R, log: true, onInput: v => { state.R = v; draw(); } });
  const sL = createSlider(ctrls, { label: 'Endüktans L', unit: 'H', min: 10e-6, max: 10, value: state.L, log: true, onInput: v => { state.L = v; draw(); } });
  const sC = createSlider(ctrls, { label: 'Kapasitans C', unit: 'F', min: 100e-12, max: 100e-6, value: state.C, log: true, onInput: v => { state.C = v; draw(); } });

  function syncType() {
    sL.setVisible(state.type.startsWith('rlc'));
    el.querySelectorAll('[data-ft] button').forEach(b => b.classList.toggle('on', b.dataset.t === state.type));
    draw();
  }

  el.querySelector('[data-ft]').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b || b.dataset.t === state.type) return;
    state.type = b.dataset.t;
    syncType();
  });

  bindExamples(el, FILTER_PRESETS, p => {
    Object.assign(state, { type: p.type, R: p.R, L: p.L, C: p.C });
    sR.set(state.R); sL.set(state.L); sC.set(state.C);
    syncType();
  });

  attachReadout(cv1, rd1, (x, s, idx) => `f = ${fmtUnit(x, 'Hz')} · |H| = ${fmtNum(s[0].ys[idx], 4)} dB`, clean);
  attachReadout(cv2, rd2, (x, s, idx) => `f = ${fmtUnit(x, 'Hz')} · ∠H = ${Number.isFinite(s[0].ys[idx]) ? fmtDeg(s[0].ys[idx]) : '—'}`, clean);

  const ro = new ResizeObserver(() => draw());
  ro.observe(el.querySelector('[data-box]'));
  clean.add(() => ro.disconnect());

  syncType();
  return clean.run;
}

// =====================================================================
// 5. OP-AMP LABORATUVARI
// =====================================================================
const OPAMP_PRESETS = [
  { label: 'Eviren (−10×)',        cfg: 'inverting',    R1: 1e3,  R2: 10e3, Rf: 10e3, Vcc: 12, A1: 1, f: 1e3, off1: 0, A2: 1, off2: 0 },
  { label: 'Kırpılma (doyum)',     cfg: 'inverting',    R1: 1e3,  R2: 10e3, Rf: 10e3, Vcc: 12, A1: 2, f: 1e3, off1: 0, A2: 1, off2: 0 },
  { label: 'Evirmeyen (+5×)',      cfg: 'noninverting', R1: 1e3,  R2: 10e3, Rf: 4e3,  Vcc: 15, A1: 2, f: 1e3, off1: 0, A2: 1, off2: 0 },
  { label: 'Toplayıcı (2 giriş)',  cfg: 'summing',      R1: 10e3, R2: 10e3, Rf: 10e3, Vcc: 12, A1: 3, f: 1e3, off1: 0, A2: 2, off2: 2 },
  { label: 'Fark yükselteci',      cfg: 'diff',         R1: 10e3, R2: 10e3, Rf: 20e3, Vcc: 12, A1: 1, f: 1e3, off1: 1, A2: 3, off2: 1 },
];

const resH = (x, y) => `M${x} ${y}h4l2.5-5 4.5 10 4.5-10 4.5 10 4.5-10 3.5 5h4`;
const resV = (x, y) => `M${x} ${y}v3l-4 2 8 4-8 4 8 4-8 4 4 2v3`;
const gndSvg = (x, y) => `M${x - 7} ${y}h14M${x - 4.5} ${y + 4}h9M${x - 2} ${y + 8}h4`;

function opampSchematic(cfg) {
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const txt = (x, y, t, a = 'middle') => `<text x="${x}" y="${y}" fill="currentColor" stroke="none" font-family="JetBrains Mono,monospace" font-size="9.5" text-anchor="${a}">${t}</text>`;
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.1" fill="currentColor" stroke="none"/>`;
  const tri = (topSign, botSign) => `<path d="M130 38L186 66L130 94Z"/>${txt(139, 57, topSign)}${txt(139, 81, botSign)}`;

  let body = '';
  if (cfg === 'inverting') {
    body = `${tri('−', '+')}
      <path d="M32 54h12 ${resH(44, 54)} M76 54h54 M98 54V22h26 ${resH(124, 22)} M156 22h50v44 M186 66h42 M130 78h-18v22 ${gndSvg(112, 100)}"/>
      ${dot(32, 54)}${dot(98, 54)}${dot(206, 66)}${dot(228, 66)}
      ${txt(26, 57, 'Vin', 'end')}${txt(60, 44, 'Rin')}${txt(140, 13, 'Rf')}${txt(232, 69, 'Vout', 'start')}`;
  } else if (cfg === 'noninverting') {
    body = `${tri('+', '−')}
      <path d="M32 54h98 M130 78H98v24 M98 102H82 ${resH(50, 102)} M50 102H38v6 ${gndSvg(38, 108)} M98 102h26 ${resH(124, 102)} M156 102h50V66 M186 66h42"/>
      ${dot(32, 54)}${dot(98, 102)}${dot(206, 66)}${dot(228, 66)}
      ${txt(26, 57, 'Vin', 'end')}${txt(66, 93, 'R1')}${txt(140, 93, 'Rf')}${txt(232, 69, 'Vout', 'start')}`;
  } else if (cfg === 'follower') {
    body = `${tri('+', '−')}
      <path d="M36 54h94 M130 78h-28v26h104V66 M186 66h42"/>
      ${dot(36, 54)}${dot(206, 66)}${dot(228, 66)}
      ${txt(30, 57, 'Vin', 'end')}${txt(232, 69, 'Vout', 'start')}`;
  } else if (cfg === 'summing') {
    body = `${tri('−', '+')}
      <path d="M28 38h10 ${resH(38, 38)} M70 38h18v16 M28 68h10 ${resH(38, 68)} M70 68h18V54 M88 54h42 M104 54V18h22 ${resH(126, 18)} M158 18h48v48 M186 66h42 M130 78h-18v22 ${gndSvg(112, 100)}"/>
      ${dot(28, 38)}${dot(28, 68)}${dot(88, 54)}${dot(104, 54)}${dot(206, 66)}${dot(228, 66)}
      ${txt(22, 41, 'V1', 'end')}${txt(22, 71, 'V2', 'end')}${txt(54, 29, 'R1')}${txt(54, 59, 'R2')}${txt(142, 10, 'Rf')}${txt(232, 69, 'Vout', 'start')}`;
  } else {
    // diff
    body = `${tri('−', '+')}
      <path d="M28 54h12 ${resH(40, 54)} M72 54h58 M98 54V20h26 ${resH(124, 20)} M156 20h50v46 M28 78h12 ${resH(40, 78)} M72 78h58 ${resV(98, 78)} ${gndSvg(98, 104)} M186 66h42"/>
      ${dot(28, 54)}${dot(28, 78)}${dot(98, 54)}${dot(98, 78)}${dot(206, 66)}${dot(228, 66)}
      ${txt(22, 57, 'V1', 'end')}${txt(22, 81, 'V2', 'end')}${txt(56, 44, 'R1')}${txt(56, 69, 'R3')}${txt(140, 12, 'Rf')}${txt(112, 95, 'R4')}${txt(232, 69, 'Vout', 'start')}`;
  }

  return `<svg class="sim-schem-svg" viewBox="0 0 260 120" aria-hidden="true"><g ${stroke}>${body}</g></svg>`;
}

function mountOpamp(el) {
  const clean = createCleanup();
  const state = { cfg: 'inverting', R1: 1e3, R2: 10e3, Rf: 10e3, Vcc: 12, A1: 1, f: 1e3, off1: 0, A2: 1, off2: 0 };

  el.innerHTML = `<div class="sim-wrap">
    ${intro('Op-amp topolojisini seç; direnç, giriş sinyali ve <b>±Vcc</b> besleme sınırlarıyla çıkış dalgasını ve kırpılmayı canlı gör.', OPAMP_PRESETS)}
    <div class="sim-toolbar">
      <div class="seg sim-seg-wrap" role="tablist" data-cfg>
        <button type="button" data-c="inverting" class="on">Eviren</button>
        <button type="button" data-c="noninverting">Evirmeyen</button>
        <button type="button" data-c="follower">Gerilim İzleyici</button>
        <button type="button" data-c="summing">Toplayıcı</button>
        <button type="button" data-c="diff">Fark Yükselteci</button>
      </div>
    </div>
    <div class="sim-grid-wide">
      <div class="sim-panel">
        <div class="sim-schem-box" data-schem></div>
        <div class="sim-col" data-ctrls></div>
      </div>
      <div class="sim-col">
        <div class="sim-formula-box" data-formula></div>
        <div class="sim-warn" data-clip hidden></div>
        <div class="sim-plot-card">
          <div class="sim-head">
            <h4 class="sim-title">Giriş ve Çıkış Dalga Şekli (2 periyot)</h4>
            <div class="sim-legend" data-leg></div>
          </div>
          <div class="sim-plot-box" data-box><canvas class="sim-plot-cv" data-cv></canvas><div class="sim-readout mono" data-rd></div></div>
          <div class="sim-axis-lbl mono" data-tunit></div>
        </div>
        <div class="sim-kpis" data-kpis></div>
      </div>
    </div>
  </div>`;

  const schemEl = el.querySelector('[data-schem]');
  const ctrls = el.querySelector('[data-ctrls]');
  const formulaEl = el.querySelector('[data-formula]');
  const clipEl = el.querySelector('[data-clip]');
  const legEl = el.querySelector('[data-leg]');
  const cv = el.querySelector('[data-cv]');
  const rd = el.querySelector('[data-rd]');
  const tunit = el.querySelector('[data-tunit]');
  const kpis = el.querySelector('[data-kpis]');

  let lastScale = { mul: 1, pfx: '' };

  function draw() {
    const twoIn = state.cfg === 'summing' || state.cfg === 'diff';
    const params = { Rin: state.R1, R1: state.R1, R2: state.R2, Rf: state.Rf };

    // Gain formula & value
    let eq = '', gainTxt = '';
    if (state.cfg === 'inverting') {
      const g = -state.Rf / state.R1;
      eq = 'Vout = −(Rf / Rin) · Vin';
      gainTxt = `Av = ${fmtNum(g, 4)}`;
    } else if (state.cfg === 'noninverting') {
      const g = 1 + state.Rf / state.R1;
      eq = 'Vout = (1 + Rf / R1) · Vin';
      gainTxt = `Av = +${fmtNum(g, 4)}`;
    } else if (state.cfg === 'follower') {
      eq = 'Vout = Vin';
      gainTxt = 'Av = +1';
    } else if (state.cfg === 'summing') {
      const g1 = -state.Rf / state.R1, g2 = -state.Rf / state.R2;
      eq = 'Vout = −Rf · (V1/R1 + V2/R2)';
      gainTxt = `A1 = ${fmtNum(g1, 3)} · A2 = ${fmtNum(g2, 3)}`;
    } else {
      const g = state.Rf / state.R1;
      eq = 'Vout = (Rf / R1) · (V2 − V1)   (R3=R1, R4=Rf)';
      gainTxt = `Ad = +${fmtNum(g, 4)}`;
    }
    formulaEl.innerHTML = `<span class="sim-formula-eq mono">${esc(eq)}</span><span class="sim-formula-gain mono">${esc(gainTxt)}</span>`;

    // Sample over 2 full periods
    const N = 420;
    const tEnd = 2 / state.f;
    lastScale = pickScale(tEnd);
    const ts = new Array(N);
    const v1s = new Array(N);
    const v2s = new Array(N);
    const vouts = new Array(N);
    let maxIdeal = 0;
    let clipped = false;
    let voutMin = Infinity, voutMax = -Infinity;

    for (let i = 0; i < N; i++) {
      const t = (tEnd * i) / (N - 1);
      const s = Math.sin(2 * Math.PI * state.f * t);
      const v1 = state.A1 * s + state.off1;
      const v2 = twoIn ? state.A2 * s + state.off2 : 0;
      const ideal = opampOut(state.cfg, params, v1, v2);
      const out = clip(ideal, state.Vcc);
      if (Math.abs(ideal) > state.Vcc + 1e-9) clipped = true;
      maxIdeal = Math.max(maxIdeal, Math.abs(ideal));
      voutMin = Math.min(voutMin, out);
      voutMax = Math.max(voutMax, out);
      ts[i] = t * lastScale.mul;
      v1s[i] = v1;
      v2s[i] = v2;
      vouts[i] = out;
    }

    clipEl.hidden = !clipped;
    if (clipped) {
      clipEl.textContent = `Kırpılma uyarısı: Çıkış ±${fmtNum(state.Vcc, 3)} V besleme sınırında doyuma gidiyor (ideal tepe ${fmtNum(maxIdeal, 3)} V).`;
    }

    const x1 = tEnd * lastScale.mul;
    const series = [
      { name: twoIn ? 'V1' : 'Vin', color: PLOT_COLORS[1], xs: ts, ys: v1s },
    ];
    if (twoIn) {
      series.push({ name: 'V2', color: PLOT_COLORS[5], xs: ts, ys: v2s });
    }
    series.push(
      { name: 'Vout', color: PLOT_COLORS[0], xs: ts, ys: vouts },
      { name: '+Vcc', color: 'rgba(255,107,107,.35)', xs: [0, x1], ys: [state.Vcc, state.Vcc] },
      { name: '−Vcc', color: 'rgba(255,107,107,.35)', xs: [0, x1], ys: [-state.Vcc, -state.Vcc] }
    );

    legEl.innerHTML = [
      [PLOT_COLORS[1], twoIn ? 'V1(t)' : 'Vin(t)'],
      ...(twoIn ? [[PLOT_COLORS[5], 'V2(t)']] : []),
      [PLOT_COLORS[0], 'Vout(t)'],
      ['rgba(255,107,107,.55)', `±Vcc (±${fmtNum(state.Vcc, 3)} V)`],
    ].map(([col, lbl]) => `<span class="sim-legend-item"><i class="sim-legend-swatch" style="background:${col}"></i>${esc(lbl)}</span>`).join('');

    tunit.textContent = `Zaman t (${lastScale.pfx}s) · T = ${fmtUnit(1 / state.f, 's')}`;
    safePlot(cv, series, { x0: 0, x1, ylabel: 'V', height: 245 });

    kpis.innerHTML = [
      { lbl: 'Çıkış min / maks', val: `${fmtNum(voutMin, 3)} / ${fmtNum(voutMax, 3)} V` },
      { lbl: 'İdeal tepe |Vout|', val: `${fmtNum(maxIdeal, 3)} V`, acc: clipped },
      { lbl: 'Besleme ±Vcc', val: `±${fmtNum(state.Vcc, 3)} V` },
      { lbl: 'Durum', val: clipped ? 'Kırpılıyor' : 'Doğrusal', acc: clipped },
    ].map(c => `<div class="sim-kpi ${c.acc ? 'sim-kpi-accent' : ''}">
      <span class="sim-kpi-lbl">${esc(c.lbl)}</span>
      <b class="sim-kpi-val mono">${esc(c.val)}</b>
    </div>`).join('');
  }

  const sR1 = createSlider(ctrls, { label: 'Rin / R1', unit: 'Ω', min: 100, max: 1e6, value: state.R1, log: true, onInput: v => { state.R1 = v; draw(); } });
  const sR2 = createSlider(ctrls, { label: 'R2 (2. giriş)', unit: 'Ω', min: 100, max: 1e6, value: state.R2, log: true, onInput: v => { state.R2 = v; draw(); } });
  const sRf = createSlider(ctrls, { label: 'Rf (geri besleme)', unit: 'Ω', min: 100, max: 1e6, value: state.Rf, log: true, onInput: v => { state.Rf = v; draw(); } });
  const followerNote = document.createElement('p');
  followerNote.className = 'sim-hint';
  followerNote.textContent = 'Gerilim izleyicide çıkış doğrudan eviren (−) girişe bağlıdır; direnç gerekmez.';
  ctrls.append(followerNote);

  const div1 = document.createElement('div');
  div1.className = 'sim-divider';
  ctrls.append(div1);

  const sVcc = createSlider(ctrls, { label: 'Besleme ±Vcc', unit: 'V', min: 3, max: 24, value: state.Vcc, positive: true, step: 0.5, onInput: v => { state.Vcc = v; draw(); } });
  const sA1 = createSlider(ctrls, { label: 'Giriş genliği A1', unit: 'V', min: 0, max: 10, value: state.A1, step: 0.1, onInput: v => { state.A1 = v; draw(); } });
  const sOff1 = createSlider(ctrls, { label: 'DC ofset 1', unit: 'V', min: -10, max: 10, value: state.off1, step: 0.1, onInput: v => { state.off1 = v; draw(); } });
  const sF = createSlider(ctrls, { label: 'Frekans f', unit: 'Hz', min: 10, max: 100e3, value: state.f, log: true, onInput: v => { state.f = v; draw(); } });
  const sA2 = createSlider(ctrls, { label: '2. giriş genliği A2', unit: 'V', min: 0, max: 10, value: state.A2, step: 0.1, onInput: v => { state.A2 = v; draw(); } });
  const sOff2 = createSlider(ctrls, { label: '2. giriş DC ofset', unit: 'V', min: -10, max: 10, value: state.off2, step: 0.1, onInput: v => { state.off2 = v; draw(); } });

  function syncCfg() {
    const c = state.cfg;
    const twoIn = c === 'summing' || c === 'diff';
    sR1.setVisible(c !== 'follower');
    sR2.setVisible(c === 'summing');
    sRf.setVisible(c !== 'follower');
    followerNote.hidden = c !== 'follower';
    sA2.setVisible(twoIn);
    sOff2.setVisible(twoIn);
    sR1.el.querySelector('.sim-ctrl-lbl').textContent = c === 'inverting' ? 'Giriş direnci Rin' : c === 'diff' ? 'R1 (= R3)' : 'Direnç R1';
    sRf.el.querySelector('.sim-ctrl-lbl').textContent = c === 'diff' ? 'Rf (= R4)' : 'Geri besleme Rf';
    sA1.el.querySelector('.sim-ctrl-lbl').textContent = twoIn ? '1. giriş genliği A1' : 'Giriş genliği';
    sOff1.el.querySelector('.sim-ctrl-lbl').textContent = twoIn ? '1. giriş DC ofset' : 'Giriş DC ofset';
    schemEl.innerHTML = opampSchematic(c);
    el.querySelectorAll('[data-cfg] button').forEach(b => b.classList.toggle('on', b.dataset.c === c));
    draw();
  }

  el.querySelector('[data-cfg]').addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (!b || b.dataset.c === state.cfg) return;
    state.cfg = b.dataset.c;
    syncCfg();
  });

  bindExamples(el, OPAMP_PRESETS, p => {
    Object.assign(state, { cfg: p.cfg, R1: p.R1, R2: p.R2, Rf: p.Rf, Vcc: p.Vcc, A1: p.A1, f: p.f, off1: p.off1, A2: p.A2, off2: p.off2 });
    sR1.set(state.R1); sR2.set(state.R2); sRf.set(state.Rf); sVcc.set(state.Vcc);
    sA1.set(state.A1); sOff1.set(state.off1); sF.set(state.f); sA2.set(state.A2); sOff2.set(state.off2);
    syncCfg();
  });

  attachReadout(cv, rd, (x, s, idx) => {
    const twoIn = state.cfg === 'summing' || state.cfg === 'diff';
    const outIdx = twoIn ? 2 : 1;
    const v1 = s[0].ys[idx];
    const vo = s[outIdx].ys[idx];
    if (twoIn) {
      return `t = ${fmtNum(x, 3)} ${lastScale.pfx}s · V1 = ${fmtNum(v1, 3)} V · V2 = ${fmtNum(s[1].ys[idx], 3)} V · Vout = ${fmtNum(vo, 3)} V`;
    }
    return `t = ${fmtNum(x, 3)} ${lastScale.pfx}s · Vin = ${fmtNum(v1, 3)} V · Vout = ${fmtNum(vo, 3)} V`;
  }, clean);

  const ro = new ResizeObserver(() => draw());
  ro.observe(el.querySelector('[data-box]'));
  clean.add(() => ro.disconnect());

  syncCfg();
  return clean.run;
}

// =====================================================================
// 6. MANTIK KAPILARI (Logic Gates + Half Adder)
// =====================================================================
const LOGIC_MODES = [
  ['AND', 'AND'],
  ['OR', 'OR'],
  ['NOT', 'NOT'],
  ['NAND', 'NAND'],
  ['NOR', 'NOR'],
  ['XOR', 'XOR'],
  ['XNOR', 'XNOR'],
  ['HALF_ADDER', 'Yarım Toplayıcı'],
];

const LOGIC_EXPR = {
  AND:  'Q = A · B',
  OR:   'Q = A + B',
  NOT:  'Q = A\'',
  NAND: 'Q = (A · B)\'',
  NOR:  'Q = (A + B)\'',
  XOR:  'Q = A ⊕ B',
  XNOR: 'Q = (A ⊕ B)\'',
  HALF_ADDER: 'S = A ⊕ B · C = A · B',
};

const LOGIC_PRESETS = [
  { label: 'AND (1 · 1)',           mode: 'AND',        a: 1, b: 1 },
  { label: 'XOR (1 ⊕ 0)',           mode: 'XOR',        a: 1, b: 0 },
  { label: 'NAND (evrensel)',       mode: 'NAND',       a: 1, b: 1 },
  { label: 'Yarım toplayıcı (1+1)', mode: 'HALF_ADDER', a: 1, b: 1 },
];

function gateSvg(mode, a, b, out) {
  const wc = hi => `sim-gate-wire ${hi ? 'sim-gate-wire-hi' : ''}`;
  if (mode === 'HALF_ADDER') {
    const { sum, carry } = out;
    return `<svg class="sim-gate-svg" viewBox="0 0 260 150" aria-hidden="true">
      <!-- Input A bus -->
      <path class="${wc(a)}" d="M14 34H82 M46 34V104H92"/>
      <circle cx="46" cy="34" r="2.8" fill="${a ? 'var(--acc)' : 'var(--dim)'}"/>
      <!-- Input B bus -->
      <path class="${wc(b)}" d="M14 58H82 M62 58V124H92"/>
      <circle cx="62" cy="58" r="2.8" fill="${b ? 'var(--acc)' : 'var(--dim)'}"/>
      <!-- XOR gate (Sum) -->
      <path class="sim-gate-body" d="M77 22Q91 46 77 70 M86 22Q100 46 86 70H116Q140 70 152 46Q140 22 116 22Z"/>
      <!-- AND gate (Carry) -->
      <path class="sim-gate-body" d="M92 92H122A22 22 0 0 1 122 136H92Z"/>
      <!-- Output wires -->
      <path class="${wc(sum)}" d="M152 46H234"/>
      <path class="${wc(carry)}" d="M144 114H234"/>
      <text class="sim-gate-txt" x="6" y="38">A</text>
      <text class="sim-gate-txt" x="6" y="62">B</text>
      <text class="sim-gate-txt" x="115" y="50" text-anchor="middle">XOR</text>
      <text class="sim-gate-txt" x="114" y="118" text-anchor="middle">AND</text>
      <text class="sim-gate-txt" x="242" y="50">S</text>
      <text class="sim-gate-txt" x="242" y="118">C</text>
    </svg>`;
  }

  const inv = mode === 'NOT' || mode === 'NAND' || mode === 'NOR' || mode === 'XNOR';
  let body = '';
  let wires = '';
  let outStart = 170;

  if (mode === 'NOT') {
    wires = `<path class="${wc(a)}" d="M22 60H86"/>
      <text class="sim-gate-txt" x="10" y="64">A</text>`;
    body = `<path class="sim-gate-body" d="M86 30L156 60L86 90Z"/>`;
    outStart = 156;
  } else if (mode === 'AND' || mode === 'NAND') {
    wires = `<path class="${wc(a)}" d="M22 42H80"/>
      <path class="${wc(b)}" d="M22 78H80"/>
      <text class="sim-gate-txt" x="10" y="46">A</text>
      <text class="sim-gate-txt" x="10" y="82">B</text>`;
    body = `<path class="sim-gate-body" d="M80 26H126A34 34 0 0 1 126 94H80Z"/>`;
    outStart = 160;
  } else {
    // OR, NOR, XOR, XNOR
    const xorArc = mode === 'XOR' || mode === 'XNOR'
      ? '<path class="sim-gate-body" d="M68 26Q88 60 68 94"/>'
      : '';
    const inEnd = mode === 'XOR' || mode === 'XNOR' ? 75 : 85;
    wires = `<path class="${wc(a)}" d="M22 42H${inEnd}"/>
      <path class="${wc(b)}" d="M22 78H${inEnd}"/>
      <text class="sim-gate-txt" x="10" y="46">A</text>
      <text class="sim-gate-txt" x="10" y="82">B</text>`;
    body = `${xorArc}<path class="sim-gate-body" d="M78 26Q98 60 78 94H116Q148 94 166 60Q148 26 116 26Z"/>`;
    outStart = 166;
  }

  const bubble = inv ? `<circle class="sim-gate-body" cx="${outStart + 6}" cy="60" r="6"/>` : '';
  const wireStart = inv ? outStart + 12 : outStart;
  const outWire = `<path class="${wc(out)}" d="M${wireStart} 60H234"/><text class="sim-gate-txt" x="242" y="64">Q</text>`;

  return `<svg class="sim-gate-svg" viewBox="0 0 260 120" aria-hidden="true">${wires}${body}${bubble}${outWire}</svg>`;
}

function mountLogic(el) {
  const clean = createCleanup();
  const state = { mode: 'AND', a: 1, b: 1 };

  el.innerHTML = `<div class="sim-wrap">
    ${intro('Giriş anahtarlarına veya doğruluk tablosundaki satırlara tıkla; <b>ANSI kapı şeması</b> ve çıkış lambası anında güncellenir.', LOGIC_PRESETS)}
    <div class="sim-toolbar">
      <div class="seg sim-seg-wrap" role="tablist" data-modes>
        ${LOGIC_MODES.map(([k, l]) => `<button type="button" data-m="${k}" class="${k === state.mode ? 'on' : ''}">${esc(l)}</button>`).join('')}
      </div>
      <span class="sim-badge mono" data-expr></span>
    </div>
    <div class="sim-logic-stage">
      <div class="sim-switches">
        <button type="button" class="sim-switch" role="switch" data-sw="a" aria-checked="true">
          <span class="mono">A = <b data-va>1</b></span>
          <span class="sim-switch-pill"><span class="sim-switch-knob"></span></span>
        </button>
        <button type="button" class="sim-switch" role="switch" data-sw="b" aria-checked="true">
          <span class="mono">B = <b data-vb>1</b></span>
          <span class="sim-switch-pill"><span class="sim-switch-knob"></span></span>
        </button>
      </div>
      <div class="sim-gate-wrap" data-svg></div>
      <div class="sim-lamps" data-lamps></div>
    </div>
    <div class="sim-panel">
      <div class="sim-head">
        <h4 class="sim-title">Doğruluk Tablosu</h4>
        <span class="mute small" data-tt-note>Satıra tıklayarak girişleri değiştir</span>
      </div>
      <div class="sim-table-wrap">
        <table class="sim-tbl" data-tt></table>
      </div>
    </div>
  </div>`;

  const swA = el.querySelector('[data-sw="a"]');
  const swB = el.querySelector('[data-sw="b"]');
  const svgBox = el.querySelector('[data-svg]');
  const lampsEl = el.querySelector('[data-lamps]');
  const exprEl = el.querySelector('[data-expr]');
  const ttEl = el.querySelector('[data-tt]');

  function render() {
    const m = state.mode;
    const isNot = m === 'NOT';
    const isHA = m === 'HALF_ADDER';

    el.querySelectorAll('[data-modes] button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    exprEl.textContent = LOGIC_EXPR[m];

    swA.classList.toggle('sim-switch-on', !!state.a);
    swA.setAttribute('aria-checked', String(!!state.a));
    swA.querySelector('[data-va]').textContent = String(state.a);

    swB.hidden = isNot;
    swB.classList.toggle('sim-switch-on', !!state.b);
    swB.setAttribute('aria-checked', String(!!state.b));
    swB.querySelector('[data-vb]').textContent = String(state.b);

    if (isHA) {
      const ha = halfAdder(state.a, state.b);
      svgBox.innerHTML = gateSvg(m, state.a, state.b, ha);
      lampsEl.innerHTML = `<div class="sim-lamp-box">
          <div class="sim-lamp ${ha.sum ? 'sim-lamp-on' : ''}" aria-label="Toplam ${ha.sum}">${ha.sum}</div>
          <span class="small mono">Toplam (S)</span>
        </div>
        <div class="sim-lamp-box">
          <div class="sim-lamp ${ha.carry ? 'sim-lamp-on' : ''}" aria-label="Elde ${ha.carry}">${ha.carry}</div>
          <span class="small mono">Elde (C)</span>
        </div>
        <span class="sim-lamp-sum mute small mono">${state.a} + ${state.b} = ${ha.carry}${ha.sum}₂ (${state.a + state.b}₁₀)</span>`;
    } else {
      const q = gate(m, state.a, state.b);
      svgBox.innerHTML = gateSvg(m, state.a, state.b, q);
      lampsEl.innerHTML = `<div class="sim-lamp-box">
        <div class="sim-lamp ${q ? 'sim-lamp-on' : ''}" aria-label="Çıkış ${q}">${q}</div>
        <span class="small mono">Çıkış Q = ${q}</span>
      </div>`;
    }

    const rows = truthTable(m);
    if (isNot) {
      ttEl.innerHTML = `<thead><tr><th class="sim-tt-center">A</th><th class="sim-tt-center">Q (A')</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="sim-tt-row ${r.a === state.a ? 'sim-tt-active' : ''}" tabindex="0" data-a="${r.a}">
          <td class="sim-tt-center mono">${r.a}</td><td class="sim-tt-center mono">${r.out}</td>
        </tr>`).join('')}</tbody>`;
    } else if (isHA) {
      ttEl.innerHTML = `<thead><tr><th class="sim-tt-center">A</th><th class="sim-tt-center">B</th><th class="sim-tt-center">Toplam (S)</th><th class="sim-tt-center">Elde (C)</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="sim-tt-row ${r.a === state.a && r.b === state.b ? 'sim-tt-active' : ''}" tabindex="0" data-a="${r.a}" data-b="${r.b}">
          <td class="sim-tt-center mono">${r.a}</td><td class="sim-tt-center mono">${r.b}</td><td class="sim-tt-center mono">${r.sum}</td><td class="sim-tt-center mono">${r.carry}</td>
        </tr>`).join('')}</tbody>`;
    } else {
      ttEl.innerHTML = `<thead><tr><th class="sim-tt-center">A</th><th class="sim-tt-center">B</th><th class="sim-tt-center">Q (${esc(m)})</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="sim-tt-row ${r.a === state.a && r.b === state.b ? 'sim-tt-active' : ''}" tabindex="0" data-a="${r.a}" data-b="${r.b}">
          <td class="sim-tt-center mono">${r.a}</td><td class="sim-tt-center mono">${r.b}</td><td class="sim-tt-center mono">${r.out}</td>
        </tr>`).join('')}</tbody>`;
    }
  }

  el.querySelector('[data-modes]').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b || b.dataset.m === state.mode) return;
    state.mode = b.dataset.m;
    render();
  });

  swA.addEventListener('click', () => { state.a ^= 1; render(); });
  swB.addEventListener('click', () => { state.b ^= 1; render(); });

  const applyRow = tr => {
    state.a = +tr.dataset.a;
    if (tr.dataset.b !== undefined) state.b = +tr.dataset.b;
    render();
  };
  ttEl.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-a]');
    if (tr) applyRow(tr);
  });
  ttEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr[data-a]');
    if (!tr) return;
    e.preventDefault();
    applyRow(tr);
  });

  bindExamples(el, LOGIC_PRESETS, p => {
    state.mode = p.mode;
    state.a = p.a;
    state.b = p.b;
    render();
  });

  render();
  return clean.run;
}

// =====================================================================
// PUBLIC ROUTER ENTRYPOINT
// =====================================================================
const MOUNTERS = {
  dc: mountDC,
  transient: mountTransient,
  phasor: mountPhasor,
  filter: mountFilter,
  opamp: mountOpamp,
  logic: mountLogic,
};

export function mountSim(el, id) {
  const fn = MOUNTERS[id] || MOUNTERS.dc;
  return fn(el);
}
