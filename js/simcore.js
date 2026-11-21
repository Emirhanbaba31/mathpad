// Pure simulation math/physics engine for MathPad (no DOM, no imports).
// Relies on global `math` (math.js 12) for complex numbers and linear algebra.

const VALID_TYPES = new Set(['R', 'L', 'C', 'V', 'I']);

const cleanZero = x => (Object.is(x, -0) ? 0 : x);

function toComplex(v) {
  if (v && v.isComplex) return math.complex(cleanZero(v.re), cleanZero(v.im));
  return math.complex(cleanZero(Number(v) || 0), 0);
}

function failMNA(error) {
  return { ok: false, error, nodes: {}, branches: {} };
}

function phasorFrom(value, phaseDeg) {
  const rad = (phaseDeg * Math.PI) / 180;
  if (value && value.isComplex) {
    if (!phaseDeg) return toComplex(value);
    const rot = math.complex(Math.cos(rad), Math.sin(rad));
    return toComplex(math.multiply(value, rot));
  }
  return math.complex(cleanZero(value * Math.cos(rad)), cleanZero(value * Math.sin(rad)));
}

/**
 * Modified Nodal Analysis (DC and AC steady-state phasor).
 * Current convention: current flows from node `a` to node `b` through the element.
 * For sources, `a` is the + terminal and `b` is the - terminal.
 */
export function solveMNA(elements, { mode = 'dc', f = 50 } = {}) {
  if (!Array.isArray(elements) || elements.length === 0) {
    return failMNA('En az bir devre elemanı ekleyin.');
  }
  const m = String(mode || 'dc').toLowerCase();
  if (m !== 'dc' && m !== 'ac') {
    return failMNA(`Geçersiz analiz modu: "${mode}".`);
  }
  const isAC = m === 'ac';
  const freq = Number(f);
  if (isAC && (!Number.isFinite(freq) || freq <= 0)) {
    return failMNA('AC analiz için frekans 0\'dan büyük geçerli bir sayı olmalı.');
  }

  // Validate and normalize elements
  const items = [];
  const usedNames = new Set();
  const nodeSet = new Set();

  for (let idx = 0; idx < elements.length; idx++) {
    const raw = elements[idx] || {};
    const type = String(raw.type || '').trim().toUpperCase();
    if (!VALID_TYPES.has(type)) {
      return failMNA(`Geçersiz eleman tipi: "${raw.type}".`);
    }
    const name = String(raw.name ?? '').trim() || `${type}${idx + 1}`;
    if (usedNames.has(name)) {
      return failMNA(`Aynı ada sahip birden fazla eleman var: "${name}".`);
    }
    usedNames.add(name);

    const a = String(raw.a ?? '').trim();
    const b = String(raw.b ?? '').trim();
    if (!a || !b) {
      return failMNA(`"${name}" elemanı için düğüm adları boş bırakılamaz.`);
    }

    const isComplexVal = Boolean(raw.value && raw.value.isComplex);
    const val = isComplexVal ? raw.value : Number(raw.value);
    if (isComplexVal) {
      if (!Number.isFinite(val.re) || !Number.isFinite(val.im)) {
        return failMNA(`"${name}" değeri geçersiz.`);
      }
      if (!isAC || (type !== 'V' && type !== 'I')) {
        return failMNA(`"${name}" için gerçel bir sayı girilmelidir.`);
      }
    } else if (!Number.isFinite(val)) {
      return failMNA(`"${name}" için geçerli bir sayısal değer girin.`);
    }

    if (type === 'R' && !(val > 0)) {
      return failMNA(`"${name}" direnç değeri 0'dan büyük olmalı.`);
    }
    if (type === 'L' && !(val > 0)) {
      return failMNA(`"${name}" endüktans değeri 0'dan büyük olmalı.`);
    }
    if (type === 'C' && !(val > 0)) {
      return failMNA(`"${name}" kapasitans değeri 0'dan büyük olmalı.`);
    }

    const phase = raw.phase === undefined || raw.phase === null || raw.phase === ''
      ? 0
      : Number(raw.phase);
    if (!Number.isFinite(phase)) {
      return failMNA(`"${name}" faz açısı geçersiz.`);
    }

    if (a === b && (type === 'V' || (!isAC && type === 'L'))) {
      return failMNA(`"${name}" elemanının iki ucu aynı düğüme bağlı (kısa devre).`);
    }

    nodeSet.add(a);
    nodeSet.add(b);
    items.push({ type, name, a, b, value: val, phase });
  }

  if (!nodeSet.has('0')) {
    return failMNA('Devrede toprak düğümü ("0") yok. Referans için en az bir uç "0" düğümüne bağlanmalı.');
  }

  // Topology check: every non-ground node must have a conducting path to ground '0'.
  // In DC: R, L, V conduct (C is open, I sets no voltage reference).
  // In AC: R, L, C, V conduct (I sets no voltage reference).
  const adj = new Map();
  for (const n of nodeSet) adj.set(n, []);
  for (const el of items) {
    const conducts = isAC ? el.type !== 'I' : (el.type === 'R' || el.type === 'L' || el.type === 'V');
    if (conducts) {
      adj.get(el.a).push(el.b);
      adj.get(el.b).push(el.a);
    }
  }
  const visited = new Set(['0']);
  const queue = ['0'];
  while (queue.length) {
    const cur = queue.shift();
    for (const nxt of adj.get(cur)) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  const floating = [...nodeSet].filter(n => !visited.has(n));
  if (floating.length) {
    const hint = !isAC && items.some(e => e.type === 'C')
      ? ' (DC analizde kondansatörler açık devre davranır.)'
      : '';
    return failMNA(`Toprağa bağlı olmayan yüzen düğüm: ${floating.join(', ')}.${hint}`);
  }

  // Voltage-branch loop detection (V sources, and L in DC) via Union-Find
  const parent = new Map();
  const find = x => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  for (const n of nodeSet) parent.set(n, n);
  for (const el of items) {
    const isVBranch = el.type === 'V' || (!isAC && el.type === 'L');
    if (!isVBranch) continue;
    const ra = find(el.a), rb = find(el.b);
    if (ra === rb) {
      const extra = !isAC && el.type === 'L' ? ' (DC\'de bobin kısa devredir)' : '';
      return failMNA(`Kapalı gerilim kaynağı döngüsü tespit edildi ("${el.name}")${extra}. Devre tekil ve çözülemez.`);
    }
    parent.set(ra, rb);
  }

  // Indexing
  const nonGround = [...nodeSet].filter(n => n !== '0');
  const nodeIndex = new Map(nonGround.map((n, i) => [n, i]));
  const vBranches = items.filter(el => el.type === 'V' || (!isAC && el.type === 'L'));
  const vBranchIndex = new Map(vBranches.map((el, k) => [el.name, k]));

  const N = nonGround.length;
  const M = vBranches.length;
  const S = N + M;

  if (S === 0) {
    // Only ground-to-ground passive/current elements
    const nodes = { '0': isAC ? math.complex(0, 0) : 0 };
    const branches = {};
    for (const el of items) {
      if (isAC) {
        const i = el.type === 'I' ? phasorFrom(el.value, el.phase) : math.complex(0, 0);
        branches[el.name] = { v: math.complex(0, 0), i, p: math.complex(0, 0) };
      } else {
        const i = el.type === 'I' ? cleanZero(el.value) : 0;
        branches[el.name] = { v: 0, i, p: 0 };
      }
    }
    return { ok: true, error: null, nodes, branches };
  }

  const zero = () => (isAC ? math.complex(0, 0) : 0);
  const add = (a, b) => (isAC ? math.add(a, b) : a + b);
  const sub = (a, b) => (isAC ? math.subtract(a, b) : a - b);
  const mul = (a, b) => (isAC ? math.multiply(a, b) : a * b);

  const A = Array.from({ length: S }, () => Array.from({ length: S }, zero));
  const z = Array.from({ length: S }, zero);

  const stampY = (ia, ib, y) => {
    if (ia >= 0) A[ia][ia] = add(A[ia][ia], y);
    if (ib >= 0) A[ib][ib] = add(A[ib][ib], y);
    if (ia >= 0 && ib >= 0) {
      A[ia][ib] = sub(A[ia][ib], y);
      A[ib][ia] = sub(A[ib][ia], y);
    }
  };

  const w = isAC ? 2 * Math.PI * freq : 0;

  for (const el of items) {
    const ia = el.a === '0' ? -1 : nodeIndex.get(el.a);
    const ib = el.b === '0' ? -1 : nodeIndex.get(el.b);

    if (el.type === 'R') {
      const y = isAC ? math.complex(1 / el.value, 0) : 1 / el.value;
      stampY(ia, ib, y);
    } else if (el.type === 'L') {
      if (isAC) {
        const y = math.complex(0, -1 / (w * el.value));
        stampY(ia, ib, y);
      } else {
        const k = N + vBranchIndex.get(el.name);
        if (ia >= 0) { A[ia][k] += 1; A[k][ia] += 1; }
        if (ib >= 0) { A[ib][k] -= 1; A[k][ib] -= 1; }
        z[k] = 0;
      }
    } else if (el.type === 'C') {
      if (isAC) {
        const y = math.complex(0, w * el.value);
        stampY(ia, ib, y);
      }
      // In DC: capacitor is an open circuit (no stamp)
    } else if (el.type === 'V') {
      const k = N + vBranchIndex.get(el.name);
      const one = isAC ? math.complex(1, 0) : 1;
      if (ia >= 0) { A[ia][k] = add(A[ia][k], one); A[k][ia] = add(A[k][ia], one); }
      if (ib >= 0) { A[ib][k] = sub(A[ib][k], one); A[k][ib] = sub(A[k][ib], one); }
      z[k] = isAC ? phasorFrom(el.value, el.phase) : el.value;
    } else if (el.type === 'I') {
      // Current flows from node a to node b through the source: leaves a, enters b.
      const isrc = isAC ? phasorFrom(el.value, el.phase) : el.value;
      if (ia >= 0) z[ia] = sub(z[ia], isrc);
      if (ib >= 0) z[ib] = add(z[ib], isrc);
    }
  }

  let solRaw;
  try {
    solRaw = math.lusolve(A, z);
  } catch {
    return failMNA('Devre matrisi tekil: bağlantıları, gerilim kaynaklarını veya kısa devreleri kontrol edin.');
  }

  const solArr = (solRaw.valueOf ? solRaw.valueOf() : solRaw).map(r => (Array.isArray(r) ? r[0] : r));
  const x = solArr.map(v => (isAC ? toComplex(v) : cleanZero(Number(v))));

  // Verify finite solution and numerical residual
  const magOf = v => (isAC ? Math.hypot(v.re, v.im) : Math.abs(v));
  for (const v of x) {
    if (!Number.isFinite(magOf(v))) {
      return failMNA('Devre matrisi tekil veya sayısal olarak çözülemiyor.');
    }
  }

  let normRes = 0, normA = 0, normX = 0, normZ = 0;
  for (let i = 0; i < S; i++) {
    normX = Math.max(normX, magOf(x[i]));
    normZ = Math.max(normZ, magOf(z[i]));
    let rowSum = zero();
    let rowA = 0;
    for (let j = 0; j < S; j++) {
      rowSum = add(rowSum, mul(A[i][j], x[j]));
      rowA += magOf(A[i][j]);
    }
    normA = Math.max(normA, rowA);
    normRes = Math.max(normRes, magOf(sub(rowSum, z[i])));
  }
  if (normRes > 1e-5 * (normA * normX + normZ + 1e-12)) {
    return failMNA('Devre matrisi tekil veya çelişkili denklemler içeriyor.');
  }

  // Assemble node voltages
  const nodes = { '0': zero() };
  nonGround.forEach((n, i) => {
    nodes[n] = x[i];
  });

  // Assemble branch voltages, currents, powers
  const branches = {};
  for (const el of items) {
    const va = nodes[el.a];
    const vb = nodes[el.b];
    const v = isAC ? toComplex(math.subtract(va, vb)) : cleanZero(va - vb);
    let i;

    if (el.type === 'R') {
      i = isAC ? toComplex(math.divide(v, el.value)) : cleanZero(v / el.value);
    } else if (el.type === 'L') {
      if (isAC) {
        i = toComplex(math.multiply(v, math.complex(0, -1 / (w * el.value))));
      } else {
        i = x[N + vBranchIndex.get(el.name)];
      }
    } else if (el.type === 'C') {
      if (isAC) {
        i = toComplex(math.multiply(v, math.complex(0, w * el.value)));
      } else {
        i = 0;
      }
    } else if (el.type === 'V') {
      i = x[N + vBranchIndex.get(el.name)];
    } else {
      i = isAC ? phasorFrom(el.value, el.phase) : cleanZero(el.value);
    }

    // Power: DC => P = v * i; AC => complex power S = V * conj(I) = P + jQ (RMS phasors)
    const p = isAC
      ? toComplex(math.multiply(v, math.conj(i)))
      : cleanZero(v * i);

    branches[el.name] = { v, i, p };
  }

  return { ok: true, error: null, nodes, branches };
}

/**
 * Recommended automatic time window for transient step responses.
 */
export function autoStepWindow({ kind = 'RC', R, L, C }) {
  const k = String(kind).toUpperCase();
  if (k === 'RC') return 5 * R * C;
  if (k === 'RL') return 5 * (L / R);
  const alpha = R / (2 * L);
  const wn = 1 / Math.sqrt(L * C);
  const zeta = alpha / wn;
  if (Math.abs(zeta - 1) < 1e-6) return 8 / wn;
  if (zeta < 1) return Math.max(5.5 / alpha, 8 / wn);
  const beta = wn * Math.sqrt(zeta * zeta - 1);
  const slowPole = (wn * wn) / (alpha + beta);
  return 5.5 / slowPole;
}

/**
 * Closed-form step response of series RC, RL, or RLC circuit (zero initial energy).
 * Returns { t, v, i, tau, wn, zeta, type, ts }.
 * `v` is capacitor voltage for RC/RLC and inductor voltage for RL.
 */
export function stepResponse({ kind = 'RC', R, L = 0, C = 0, V = 5 }, tEnd, n = 400) {
  const k = String(kind).toUpperCase();
  if (!['RC', 'RL', 'RLC'].includes(k)) throw new Error(`Geçersiz devre türü: ${kind}`);
  if (!(R > 0)) throw new Error('R değeri 0\'dan büyük olmalı.');
  if ((k === 'RL' || k === 'RLC') && !(L > 0)) throw new Error('L değeri 0\'dan büyük olmalı.');
  if ((k === 'RC' || k === 'RLC') && !(C > 0)) throw new Error('C değeri 0\'dan büyük olmalı.');
  if (!Number.isFinite(V)) throw new Error('V değeri geçersiz.');

  const span = tEnd > 0 && Number.isFinite(tEnd) ? tEnd : autoStepWindow({ kind: k, R, L, C });
  const count = Math.max(2, Math.floor(n));
  const t = new Array(count);
  const v = new Array(count);
  const i = new Array(count);

  if (k === 'RC') {
    const tau = R * C;
    const i0 = V / R;
    for (let idx = 0; idx < count; idx++) {
      const ti = (span * idx) / (count - 1);
      const ex = Math.exp(-ti / tau);
      t[idx] = ti;
      v[idx] = V * (1 - ex);
      i[idx] = i0 * ex;
    }
    return { t, v, i, tau, wn: null, zeta: null, type: 'birinci derece', ts: 4 * tau };
  }

  if (k === 'RL') {
    const tau = L / R;
    const iInf = V / R;
    for (let idx = 0; idx < count; idx++) {
      const ti = (span * idx) / (count - 1);
      const ex = Math.exp(-ti / tau);
      t[idx] = ti;
      v[idx] = V * ex;
      i[idx] = iInf * (1 - ex);
    }
    return { t, v, i, tau, wn: null, zeta: null, type: 'birinci derece', ts: 4 * tau };
  }

  // Series RLC
  const alpha = R / (2 * L);
  const wn = 1 / Math.sqrt(L * C);
  const zeta = alpha / wn;

  if (Math.abs(zeta - 1) < 1e-6) {
    // Critically damped
    const tau = 1 / wn;
    for (let idx = 0; idx < count; idx++) {
      const ti = (span * idx) / (count - 1);
      const ex = Math.exp(-wn * ti);
      t[idx] = ti;
      v[idx] = V * (1 - ex * (1 + wn * ti));
      i[idx] = (V / L) * ti * ex;
    }
    return { t, v, i, tau, wn, zeta: 1, type: 'kritik sönümlü', ts: 5.8339 / wn };
  }

  if (zeta < 1) {
    // Underdamped
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const tau = 1 / alpha;
    const ratio = alpha / wd;
    const iScale = V / (L * wd);
    for (let idx = 0; idx < count; idx++) {
      const ti = (span * idx) / (count - 1);
      const ex = Math.exp(-alpha * ti);
      const wdt = wd * ti;
      t[idx] = ti;
      v[idx] = V * (1 - ex * (Math.cos(wdt) + ratio * Math.sin(wdt)));
      i[idx] = iScale * ex * Math.sin(wdt);
    }
    return { t, v, i, tau, wn, zeta, type: 'az sönümlü', ts: 4 / alpha };
  }

  // Overdamped (zeta > 1): rationalized slow pole prevents cancellation
  const beta = wn * Math.sqrt(zeta * zeta - 1);
  const s1 = -(wn * wn) / (alpha + beta); // slower decay (closer to 0)
  const s2 = -(alpha + beta);             // faster decay
  const diff = s1 - s2;                   // 2 * beta > 0
  const tau = -1 / s1;
  const iScale = V / (2 * L * beta);
  for (let idx = 0; idx < count; idx++) {
    const ti = (span * idx) / (count - 1);
    const e1 = Math.exp(s1 * ti);
    const e2 = Math.exp(s2 * ti);
    t[idx] = ti;
    v[idx] = V * (1 + (s2 * e1 - s1 * e2) / diff);
    i[idx] = iScale * (e1 - e2);
  }
  // 2% settling time via slow-pole asymptote refined by Newton steps
  let ts = Math.max(0, -Math.log((0.02 * diff) / (-s2)) / (-s1));
  for (let iter = 0; iter < 6; iter++) {
    const e1 = Math.exp(s1 * ts), e2 = Math.exp(s2 * ts);
    const err = (-s2 * e1 + s1 * e2) / diff - 0.02;
    const derr = (-s1 * s2 * e1 + s1 * s2 * e2) / diff;
    if (Math.abs(derr) < 1e-18) break;
    ts = Math.max(0, ts - err / derr);
  }
  return { t, v, i, tau, wn, zeta, type: 'aşırı sönümlü', ts };
}

/**
 * Series RLC sinusoidal steady-state phasor calculations (source amplitude Vm at 0 deg).
 */
export function seriesRLC({ R, L, C, f, Vm }) {
  const w = 2 * Math.PI * f;
  const XL = w * L;
  const XC = 1 / (w * C);
  const X = XL - XC;
  const Z = math.complex(R, X);
  const Zmag = Math.hypot(R, X);
  const thetaRad = Math.atan2(X, R);
  const thetaDeg = (thetaRad * 180) / Math.PI;
  const Im = Vm / Zmag;

  const V = math.complex(Vm, 0);
  const I = math.complex(Im * Math.cos(-thetaRad), Im * Math.sin(-thetaRad));
  const VR = toComplex(math.multiply(I, R));
  const VL = toComplex(math.multiply(I, math.complex(0, XL)));
  const VC = toComplex(math.multiply(I, math.complex(0, -XC)));

  const pf = R / Zmag;
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const relDiff = Math.abs(XL - XC) / Math.max(Zmag, 1e-12);
  const state = relDiff < 2e-3 ? 'rezonansta' : XL > XC ? 'endüktif' : 'kapasitif';

  return { w, XL, XC, X, Z, Zmag, thetaRad, thetaDeg, Im, V, I, VR, VL, VC, pf, f0, state };
}

function normalizeFilterType(type) {
  const t = String(type || '').toLowerCase().trim();
  if (t === 'rc-lp' || t === 'lp' || t === 'lowpass' || t === 'alçak') return 'rc-lp';
  if (t === 'rc-hp' || t === 'hp' || t === 'highpass' || t === 'yüksek') return 'rc-hp';
  if (t === 'rlc-bp' || t === 'bp' || t === 'bandpass' || t === 'bant-geciren') return 'rlc-bp';
  if (t === 'rlc-bs' || t === 'bs' || t === 'bandstop' || t === 'notch' || t === 'bant-sonduren') return 'rlc-bs';
  throw new Error(`Geçersiz filtre türü: ${type}`);
}

/**
 * Filter complex transfer function H(j2πf) as math.js Complex.
 */
export function transfer(type, { R, L = 0, C }, f) {
  const k = normalizeFilterType(type);
  const w = 2 * Math.PI * f;
  if (k === 'rc-lp') {
    return toComplex(math.divide(1, math.complex(1, w * R * C)));
  }
  if (k === 'rc-hp') {
    return toComplex(math.divide(math.complex(0, w * R * C), math.complex(1, w * R * C)));
  }
  const realDen = 1 - w * w * L * C;
  const imagDen = w * R * C;
  const den = math.complex(realDen, imagDen);
  if (k === 'rlc-bp') {
    return toComplex(math.divide(math.complex(0, imagDen), den));
  }
  // rlc-bs (notch)
  return toComplex(math.divide(math.complex(realDen, 0), den));
}

/**
 * Key metrics and suggested Bode frequency window for a filter.
 */
export function filterMetrics(type, { R, L = 0, C }) {
  const k = normalizeFilterType(type);
  if (k === 'rc-lp' || k === 'rc-hp') {
    const fc = 1 / (2 * Math.PI * R * C);
    const e = Math.floor(Math.log10(fc));
    return {
      fc,
      f0: null,
      Q: null,
      bw: null,
      f1: null,
      f2: null,
      fMin: 10 ** (e - 2),
      fMax: 10 ** (e + 3),
    };
  }
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const Q = (1 / R) * Math.sqrt(L / C);
  const bw = R / (2 * Math.PI * L);
  const half = R / (2 * L);
  const rad = Math.sqrt(half * half + 1 / (L * C));
  const f1 = (rad - half) / (2 * Math.PI);
  const f2 = (rad + half) / (2 * Math.PI);
  const e = Math.floor(Math.log10(f0));
  const span = Q > 20 ? 1 : 2;
  return {
    fc: null,
    f0,
    Q,
    bw,
    f1,
    f2,
    fMin: 10 ** (e - span),
    fMax: 10 ** (e + span + 1),
  };
}

/**
 * Ideal op-amp output voltage before supply-rail clipping.
 */
export function opampOut(config, params = {}, vin1 = 0, vin2 = 0) {
  const c = String(config || '').toLowerCase().trim();
  const p = params || {};
  if (c === 'inverting' || c === 'eviren') {
    const rin = p.Rin ?? p.R1;
    return -(p.Rf / rin) * vin1;
  }
  if (c === 'noninverting' || c === 'evirmeyen') {
    const r1 = p.R1 ?? p.Rin;
    return (1 + p.Rf / r1) * vin1;
  }
  if (c === 'follower' || c === 'izleyici' || c === 'gerilim izleyici') {
    return vin1;
  }
  if (c === 'summing' || c === 'toplayıcı' || c === 'toplayici') {
    return -p.Rf * (vin1 / p.R1 + vin2 / p.R2);
  }
  if (c === 'diff' || c === 'differential' || c === 'fark' || c === 'fark yükselteci') {
    const r1 = p.R1 ?? p.Rin;
    const rf = p.Rf ?? p.R2;
    const r3 = p.R3 ?? r1;
    const r4 = p.R4 ?? rf;
    return (1 + rf / r1) * (r4 / (r3 + r4)) * vin2 - (rf / r1) * vin1;
  }
  throw new Error(`Geçersiz op-amp devresi: ${config}`);
}

/**
 * Clamp voltage to symmetrical supply rails [-|vcc|, +|vcc|].
 */
export function clip(v, vcc) {
  const lim = Math.abs(vcc);
  if (v > lim) return lim;
  if (v < -lim) return -lim;
  return v;
}

/**
 * Basic logic gate evaluation returning 0 or 1.
 */
export function gate(name, a, b = 0) {
  const A = a ? 1 : 0;
  const B = b ? 1 : 0;
  switch (String(name || '').toUpperCase().trim()) {
    case 'AND':  return A & B;
    case 'OR':   return A | B;
    case 'NOT':  return A ^ 1;
    case 'NAND': return (A & B) ^ 1;
    case 'NOR':  return (A | B) ^ 1;
    case 'XOR':  return A ^ B;
    case 'XNOR': return (A ^ B) ^ 1;
    default: throw new Error(`Geçersiz mantık kapısı: ${name}`);
  }
}

/**
 * Half adder: returns { sum, carry } with 0 or 1 values.
 */
export function halfAdder(a, b) {
  return {
    sum: gate('XOR', a, b),
    carry: gate('AND', a, b),
  };
}

/**
 * Truth table rows for any basic gate or HALF_ADDER.
 */
export function truthTable(name) {
  const k = String(name || '').toUpperCase().trim();
  if (k === 'NOT') {
    return [0, 1].map(a => ({ a, out: gate('NOT', a) }));
  }
  if (k === 'HALF_ADDER' || k === 'HALFADDER' || k === 'HA') {
    return [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => {
      const { sum, carry } = halfAdder(a, b);
      return { a, b, sum, carry };
    });
  }
  return [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => ({
    a,
    b,
    out: gate(k, a, b),
  }));
}
