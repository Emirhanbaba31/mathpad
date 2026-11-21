// MathPad Engineering Simulation Center — Part 3 Pure Computation Core
// Fields: 'insaat' (9), 'malzeme' (8), 'kimya' (8) = 25 engineering models.
// Pure ES module: NO DOM, NO ui.js / fx.js / phys-ui.js imports. Runs directly in Node tests.

// =====================================================================
// PHYSICAL CONSTANTS & SHARED NUMERICAL SOLVERS
// =====================================================================

export const G0 = 9.80665;                  // Standard gravity (m/s^2)
export const R_GAS = 8.314462618;           // Universal gas constant (J/(mol·K))
export const N_AVO = 6.02214076e23;         // Avogadro constant (1/mol)
export const K_B_EV = 8.617333262e-5;       // Boltzmann constant (eV/K)
export const Q_ELEC = 1.602176634e-19;      // Elementary charge (C)

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function solveLinearSystem(A, b) {
  const n = b.length;
  if (n === 0) return { ok: true, x: [] };
  const M = A.map((row, i) => [...row, b[i]]);
  let maxNorm = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) maxNorm = Math.max(maxNorm, Math.abs(M[i][j]));
  }
  const eps = Math.max(1e-14, maxNorm * 1e-12);

  for (let col = 0; col < n; col++) {
    let piv = col;
    let pivVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > pivVal) { pivVal = v; piv = r; }
    }
    if (pivVal <= eps) return { ok: false, error: 'Sistem tekil veya geometrik olarak yetersiz (mekanizma).' };
    if (piv !== col) {
      const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
    }
    const diag = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / diag;
      if (f === 0) continue;
      M[r][col] = 0;
      for (let c = col + 1; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
    if (!Number.isFinite(x[i])) return { ok: false, error: 'Sayısal kararlılık hatası.' };
  }
  return { ok: true, x };
}

export function jacobiEigenSym(Ain, maxSweeps = 60) {
  const n = Ain.length;
  const A = Ain.map(r => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let maxOff = 0, p = 0, q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(A[i][j]);
        if (v > maxOff) { maxOff = v; p = i; q = j; }
      }
    }
    if (maxOff < 1e-13) break;
    const app = A[p][p], aqq = A[q][q], apq = A[p][q];
    const tau = (aqq - app) / (2 * apq);
    const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = A[q][p] = 0;
    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const arp = A[r][p], arq = A[r][q];
      A[r][p] = A[p][r] = c * arp - s * arq;
      A[r][q] = A[q][r] = s * arp + c * arq;
    }
    for (let r = 0; r < n; r++) {
      const vrp = V[r][p], vrq = V[r][q];
      V[r][p] = c * vrp - s * vrq;
      V[r][q] = s * vrp + c * vrq;
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => A[i][i] - A[j][j]);
  const values = order.map(i => A[i][i]);
  const vectors = order.map(col => V.map(row => row[col]));
  return { values, vectors };
}

export function erf(x) {
  const sgn = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax > 6) return sgn;
  // Abramowitz & Stegun 7.1.26 (max error < 1.5e-7)
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sgn * y;
}

export function erfc(x) {
  if (x < 0) return 2 - erfc(-x);
  if (x > 26) return 0;
  // Complementary form avoids catastrophic cancellation for large x
  const t = 1 / (1 + 0.3275911 * x);
  const poly = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return Math.max(0, poly * Math.exp(-x * x));
}

export function bisect(fn, lo, hi, tol = 1e-10, maxIter = 100) {
  let a = lo, b = hi;
  let fa = fn(a), fb = fn(b);
  if (Math.abs(fa) <= tol) return a;
  if (Math.abs(fb) <= tol) return b;
  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = fn(m);
    if (Math.abs(fm) <= tol || Math.abs(b - a) <= tol * (1 + Math.abs(m))) return m;
    if ((fa > 0) === (fm > 0)) { a = m; fa = fm; } else { b = m; fb = fm; }
  }
  return 0.5 * (a + b);
}

export function solveCubicReal(a, b, c, d) {
  if (Math.abs(a) < 1e-15) {
    if (Math.abs(b) < 1e-15) return Math.abs(c) < 1e-15 ? [] : [-d / c];
    const D = c * c - 4 * b * d;
    if (D < 0) return [];
    const s = Math.sqrt(D);
    return [(-c - s) / (2 * b), (-c + s) / (2 * b)].sort((u, v) => u - v);
  }
  const B = b / a, C = c / a, D = d / a;
  const p = C - B * B / 3;
  const q = (2 * B * B * B) / 27 - (B * C) / 3 + D;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const shift = -B / 3;

  if (disc > 1e-14) {
    const s = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + s);
    const v = Math.cbrt(-q / 2 - s);
    return [u + v + shift];
  }
  if (Math.abs(disc) <= 1e-14) {
    if (Math.abs(q) < 1e-15) return [shift];
    const u = Math.cbrt(-q / 2);
    return [2 * u + shift, -u + shift].sort((x, y) => x - y);
  }
  const r = Math.sqrt(-p / 3);
  const cosPhi = Math.max(-1, Math.min(1, (-q / 2) / (r * r * r)));
  const phi = Math.acos(cosPhi);
  return [
    2 * r * Math.cos(phi / 3) + shift,
    2 * r * Math.cos((phi + 2 * Math.PI) / 3) + shift,
    2 * r * Math.cos((phi + 4 * Math.PI) / 3) + shift,
  ].sort((x, y) => x - y);
}

// =====================================================================
// FIELD: İNŞAAT & YAPI (1–9)
// =====================================================================

// ---------- 1. Kiriş Analizi (Beam Analysis) ----------

export function beamSectionProperties(sec = { type: 'rect', b: 200, h: 400 }) {
  const type = sec.type || 'rect';
  if (type === 'circle') {
    const d = Math.max(10, Number(sec.d) || 300);
    const R = d / 2;
    const A = Math.PI * R * R;
    const I = (Math.PI * d ** 4) / 64;
    const c = R;
    const S = I / c;
    const Qmax = (2 / 3) * R ** 3;
    const bw = d;
    return { type, d, A, I, c, S, Qmax, bw, r: Math.sqrt(I / A), Imin: I, Iy: I };
  }
  if (type === 'ibeam') {
    const bf = Math.max(40, Number(sec.bf) || 200);
    const h = Math.max(60, Number(sec.h) || 360);
    const tf = Math.min(h * 0.4, Math.max(4, Number(sec.tf) || 16));
    const tw = Math.min(bf * 0.8, Math.max(4, Number(sec.tw) || 10));
    const hw = h - 2 * tf;
    const A = 2 * bf * tf + tw * hw;
    const I = (bf * h ** 3 - (bf - tw) * hw ** 3) / 12;
    const Iy = (2 * tf * bf ** 3 + hw * tw ** 3) / 12;
    const c = h / 2;
    const S = I / c;
    const Qmax = bf * tf * (h / 2 - tf / 2) + tw * (hw / 2) * (hw / 4);
    const bw = tw;
    const Imin = Math.min(I, Iy);
    return { type, bf, h, tf, tw, A, I, Iy, Imin, c, S, Qmax, bw, r: Math.sqrt(Imin / A) };
  }
  // Rectangle
  const b = Math.max(10, Number(sec.b) || 200);
  const h = Math.max(10, Number(sec.h) || 400);
  const A = b * h;
  const I = (b * h ** 3) / 12;
  const Iy = (h * b ** 3) / 12;
  const c = h / 2;
  const S = I / c;
  const Qmax = (b * h * h) / 8;
  const bw = b;
  const Imin = Math.min(I, Iy);
  return { type: 'rect', b, h, A, I, Iy, Imin, c, S, Qmax, bw, r: Math.sqrt(Imin / A) };
}

export function solveBeam({
  type = 'simply',
  L = 6,
  E_GPa = 200,
  section = { type: 'ibeam', bf: 180, h: 320, tf: 14, tw: 9 },
  supports = null,
  loads = [],
} = {}) {
  const len = Math.max(0.5, Number(L) || 6);
  const E = Math.max(1, Number(E_GPa) || 200);
  const sec = beamSectionProperties(section);
  // EI in kN·m^2: E[GPa]*1e6 [kN/m^2] * I[mm^4]*1e-12 [m^4] = E * I * 1e-6
  const EI = E * sec.I * 1e-6;

  // Support definitions: [{ x, fixV, fixT, label }]
  let supList;
  if (type === 'cantilever') {
    supList = [{ x: 0, fixV: true, fixT: true, label: 'A (Ankastre)' }];
  } else if (type === 'fixed-fixed') {
    supList = [
      { x: 0, fixV: true, fixT: true, label: 'A (Ankastre)' },
      { x: len, fixV: true, fixT: true, label: 'B (Ankastre)' },
    ];
  } else if (type === 'overhanging') {
    const a = Math.max(0, Math.min(len * 0.45, supports?.[0] ?? 0));
    const b = Math.max(a + len * 0.25, Math.min(len * 0.95, supports?.[1] ?? len * 0.72));
    supList = [
      { x: a, fixV: true, fixT: false, label: 'A (Sabit)' },
      { x: b, fixV: true, fixT: false, label: 'B (Kayıcı)' },
    ];
  } else {
    supList = [
      { x: 0, fixV: true, fixT: false, label: 'A (Sabit)' },
      { x: len, fixV: true, fixT: false, label: 'B (Kayıcı)' },
    ];
  }

  // Normalize loads within [0, len]
  const normLoads = loads.map(ld => {
    if (ld.kind === 'dist') {
      const x1 = Math.max(0, Math.min(len, Number(ld.x1) || 0));
      const x2 = Math.max(0, Math.min(len, Number(ld.x2) ?? len));
      const a = Math.min(x1, x2), b = Math.max(x1, x2);
      const w1 = Number(ld.w1) || 0;
      const w2 = ld.w2 === undefined ? w1 : (Number(ld.w2) || 0);
      return b - a > 1e-9 ? { kind: 'dist', x1: a, x2: b, w1: x1 <= x2 ? w1 : w2, w2: x1 <= x2 ? w2 : w1 } : null;
    }
    if (ld.kind === 'moment') {
      return { kind: 'moment', x: Math.max(0, Math.min(len, Number(ld.x) || 0)), M: Number(ld.M) || 0 };
    }
    return { kind: 'point', x: Math.max(0, Math.min(len, Number(ld.x) || 0)), P: Number(ld.P) || 0 };
  }).filter(Boolean);

  // Build FEM mesh nodes containing all supports, load endpoints, and uniform subdivisions
  const rawNodes = [0, len];
  const nBase = 64;
  for (let i = 1; i < nBase; i++) rawNodes.push((len * i) / nBase);
  for (const s of supList) rawNodes.push(s.x);
  for (const ld of normLoads) {
    if (ld.kind === 'dist') { rawNodes.push(ld.x1, ld.x2); }
    else rawNodes.push(ld.x);
  }
  rawNodes.sort((a, b) => a - b);
  const nodes = [rawNodes[0]];
  for (let i = 1; i < rawNodes.length; i++) {
    if (rawNodes[i] - nodes[nodes.length - 1] > len * 1e-7) nodes.push(rawNodes[i]);
  }
  nodes[nodes.length - 1] = len;

  const findNode = x => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.abs(nodes[i] - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const N = nodes.length;
  const ndof = 2 * N;
  const K = Array.from({ length: ndof }, () => new Array(ndof).fill(0));
  const F = new Array(ndof).fill(0);

  // Assemble Euler-Bernoulli Hermite beam elements
  for (let e = 0; e < N - 1; e++) {
    const xA = nodes[e], xB = nodes[e + 1], h = xB - xA;
    const c = EI / (h * h * h);
    const ke = [
      [12 * c, 6 * h * c, -12 * c, 6 * h * c],
      [6 * h * c, 4 * h * h * c, -6 * h * c, 2 * h * h * c],
      [-12 * c, -6 * h * c, 12 * c, -6 * h * c],
      [6 * h * c, 2 * h * h * c, -6 * h * c, 4 * h * h * c],
    ];
    const map = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) K[map[r]][map[col]] += ke[r][col];
    }

    // Consistent nodal loads for distributed loads covering this element
    const xm = 0.5 * (xA + xB);
    for (const ld of normLoads) {
      if (ld.kind !== 'dist') continue;
      if (xm >= ld.x1 - 1e-12 && xm <= ld.x2 + 1e-12 && ld.x2 > ld.x1) {
        const span = ld.x2 - ld.x1;
        // Upward positive load intensity q(x) = -w(x)
        const qa = -(ld.w1 + (ld.w2 - ld.w1) * ((xA - ld.x1) / span));
        const qb = -(ld.w1 + (ld.w2 - ld.w1) * ((xB - ld.x1) / span));
        F[map[0]] += (h / 20) * (7 * qa + 3 * qb);
        F[map[1]] += (h * h / 60) * (3 * qa + 2 * qb);
        F[map[2]] += (h / 20) * (3 * qa + 7 * qb);
        F[map[3]] += -(h * h / 60) * (2 * qa + 3 * qb);
      }
    }
  }

  // Point loads & concentrated moments
  for (const ld of normLoads) {
    if (ld.kind === 'point') {
      const idx = findNode(ld.x);
      F[2 * idx] -= ld.P; // downward P > 0 => negative upward force
    } else if (ld.kind === 'moment') {
      const idx = findNode(ld.x);
      F[2 * idx + 1] -= ld.M; // clockwise M > 0 => negative CCW nodal moment
    }
  }

  // Constrained DOFs
  const fixed = new Array(ndof).fill(false);
  const supNodes = supList.map(s => {
    const idx = findNode(s.x);
    if (s.fixV) fixed[2 * idx] = true;
    if (s.fixT) fixed[2 * idx + 1] = true;
    return { ...s, node: idx, x: nodes[idx] };
  });

  const freeDofs = [];
  for (let i = 0; i < ndof; i++) if (!fixed[i]) freeDofs.push(i);

  const Kff = freeDofs.map(r => freeDofs.map(c => K[r][c]));
  const Ff = freeDofs.map(r => F[r]);
  const sol = solveLinearSystem(Kff, Ff);
  if (!sol.ok) return { ok: false, error: sol.error };

  const u = new Array(ndof).fill(0);
  freeDofs.forEach((d, k) => { u[d] = sol.x[k]; });

  // Exact nodal reactions R = K*u - F
  const Rvec = new Array(ndof).fill(0);
  for (let i = 0; i < ndof; i++) {
    let s = -F[i];
    for (let j = 0; j < ndof; j++) s += K[i][j] * u[j];
    Rvec[i] = s;
  }

  const reactions = supNodes.map(s => ({
    label: s.label,
    x: s.x,
    Ry: s.fixV ? Rvec[2 * s.node] : 0,       // upward positive (kN)
    Mz: s.fixT ? Rvec[2 * s.node + 1] : 0,   // CCW positive (kN·m)
  }));

  // Exact static evaluation of V(x) and M(x) at any x (handles jumps cleanly)
  const evalVM = (x, side = 0) => {
    // side = -1 => x^-, side = +1 => x^+
    const tol = 1e-9 * len;
    const includePoint = xp => (side < 0 ? xp < x - tol : side > 0 ? xp <= x + tol : xp <= x + tol);
    let V = 0, M = 0;
    for (const r of reactions) {
      if (includePoint(r.x)) {
        V += r.Ry;
        M += r.Ry * (x - r.x) - r.Mz; // CCW wall reaction creates negative sagging moment
      }
    }
    for (const ld of normLoads) {
      if (ld.kind === 'point') {
        if (includePoint(ld.x)) {
          V -= ld.P;
          M -= ld.P * (x - ld.x);
        }
      } else if (ld.kind === 'moment') {
        if (includePoint(ld.x)) {
          M += ld.M; // CW external moment jumps M upward
        }
      } else if (ld.kind === 'dist') {
        const s = Math.min(x, ld.x2) - ld.x1;
        if (s > 0) {
          const span = ld.x2 - ld.x1;
          const ws = ld.w1 + (ld.w2 - ld.w1) * (s / span);
          const Fd = 0.5 * (ld.w1 + ws) * s;
          const Mdist = (x - ld.x1) * Fd - (ld.w1 * s * s / 2 + ((ws - ld.w1) * s * s) / 3);
          V -= Fd;
          M -= Mdist;
        }
      }
    }
    return { V, M };
  };

  // Hermite interpolation for y(x) (in m, upward positive)
  const evalY = x => {
    const xc = Math.max(0, Math.min(len, x));
    let e = 0;
    while (e < N - 2 && nodes[e + 1] < xc) e++;
    const xA = nodes[e], h = nodes[e + 1] - xA;
    const xi = h > 0 ? (xc - xA) / h : 0;
    const xi2 = xi * xi, xi3 = xi2 * xi;
    const N1 = 1 - 3 * xi2 + 2 * xi3;
    const N2 = h * (xi - 2 * xi2 + xi3);
    const N3 = 3 * xi2 - 2 * xi3;
    const N4 = h * (-xi2 + xi3);
    return N1 * u[2 * e] + N2 * u[2 * e + 1] + N3 * u[2 * e + 2] + N4 * u[2 * e + 3];
  };

  // Build crisp diagram arrays including jump locations
  const jumpXs = new Set();
  for (const r of reactions) jumpXs.add(r.x);
  for (const ld of normLoads) if (ld.kind !== 'dist') jumpXs.add(ld.x);

  const sampleMeta = [];
  const nPlot = 160;
  for (let i = 0; i <= nPlot; i++) sampleMeta.push({ x: (len * i) / nPlot, side: i === 0 ? 1 : i === nPlot ? -1 : 0 });
  for (const jx of jumpXs) {
    if (jx > 1e-8) sampleMeta.push({ x: jx, side: -1 });
    if (jx < len - 1e-8) sampleMeta.push({ x: jx, side: 1 });
  }
  sampleMeta.sort((a, b) => (Math.abs(a.x - b.x) > 1e-9 ? a.x - b.x : a.side - b.side));

  const xs = [], V = [], M = [], yMm = [];
  let maxAbsV = 0, maxAbsM = 0, maxPosM = -Infinity, maxNegM = Infinity, maxAbsY = 0;
  let xMaxM = 0, xMaxY = 0;
  for (const pt of sampleMeta) {
    const { V: vVal, M: mVal } = evalVM(pt.x, pt.side);
    const ym = evalY(pt.x) * 1000;
    xs.push(pt.x); V.push(vVal); M.push(mVal); yMm.push(ym);
    if (Math.abs(vVal) > maxAbsV) maxAbsV = Math.abs(vVal);
    if (Math.abs(mVal) > maxAbsM) { maxAbsM = Math.abs(mVal); xMaxM = pt.x; }
    if (mVal > maxPosM) maxPosM = mVal;
    if (mVal < maxNegM) maxNegM = mVal;
    if (Math.abs(ym) > maxAbsY) { maxAbsY = Math.abs(ym); xMaxY = pt.x; }
  }

  // Max bending stress (MPa) and max shear stress (MPa)
  const maxSigmaMPa = (maxAbsM * 1e6) / sec.S;
  const maxTauMPa = (maxAbsV * 1e3 * sec.Qmax) / (sec.I * sec.bw);

  return {
    ok: true,
    L: len,
    E_GPa: E,
    EI,
    section: sec,
    supports: supNodes,
    loads: normLoads,
    reactions,
    xs, V, M, yMm,
    maxAbsV,
    maxAbsM,
    maxPosM: Number.isFinite(maxPosM) ? maxPosM : 0,
    maxNegM: Number.isFinite(maxNegM) ? maxNegM : 0,
    maxAbsYMm: maxAbsY,
    spanOverDefl: maxAbsY > 1e-9 ? (len * 1000) / maxAbsY : Infinity,
    xMaxM,
    xMaxY,
    maxSigmaMPa,
    maxTauMPa,
    evalVM,
    evalY,
  };
}

// ---------- 2. Kafes Sistem (2D Truss — Direct Stiffness Method) ----------

export function solveTruss2D({ nodes = [], members = [] } = {}) {
  const j = nodes.length;
  const m = members.length;
  let r = 0;
  const fixed = new Array(2 * j).fill(false);

  nodes.forEach((nd, i) => {
    const sup = nd.support || 'free';
    if (sup === 'pin') { fixed[2 * i] = true; fixed[2 * i + 1] = true; r += 2; }
    else if (sup === 'roller-x' || sup === 'roller') { fixed[2 * i + 1] = true; r += 1; }
    else if (sup === 'roller-y') { fixed[2 * i] = true; r += 1; }
  });

  const detDegree = m + r - 2 * j;
  const determinacy = detDegree < 0 ? 'mekanizma' : detDegree === 0 ? 'izostatik' : 'hiperstatik';

  if (j < 2 || m < 1) {
    return { ok: false, error: 'En az 2 düğüm ve 1 çubuk gerekli.', determinacy, detDegree, m, r, j };
  }

  const ndof = 2 * j;
  const K = Array.from({ length: ndof }, () => new Array(ndof).fill(0));
  const F = new Array(ndof).fill(0);
  nodes.forEach((nd, i) => {
    F[2 * i] = Number(nd.fx) || 0;
    F[2 * i + 1] = Number(nd.fy) || 0;
  });

  const elemMeta = [];
  for (let e = 0; e < m; e++) {
    const mb = members[e];
    const ni = nodes[mb.i], nj = nodes[mb.j];
    if (!ni || !nj || mb.i === mb.j) return { ok: false, error: `Geçersiz çubuk #${e + 1}.`, determinacy, detDegree, m, r, j };
    const dx = nj.x - ni.x, dy = nj.y - ni.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return { ok: false, error: `Çubuk #${e + 1} uzunluğu sıfır.`, determinacy, detDegree, m, r, j };
    const c = dx / L, s = dy / L;
    const E_GPa = Math.max(1, Number(mb.E_GPa) || 200);
    const A_cm2 = Math.max(0.1, Number(mb.A_cm2) || 10);
    const EA = E_GPa * A_cm2 * 100; // kN
    const k = EA / L; // kN/m
    const cc = c * c * k, ss = s * s * k, cs = c * s * k;
    const ke = [
      [cc, cs, -cc, -cs],
      [cs, ss, -cs, -ss],
      [-cc, -cs, cc, cs],
      [-cs, -ss, cs, ss],
    ];
    const map = [2 * mb.i, 2 * mb.i + 1, 2 * mb.j, 2 * mb.j + 1];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[map[a]][map[b]] += ke[a][b];
    elemMeta.push({ i: mb.i, j: mb.j, L, c, s, E_GPa, A_cm2, EA, k });
  }

  const freeDofs = [];
  for (let i = 0; i < ndof; i++) if (!fixed[i]) freeDofs.push(i);
  const Kff = freeDofs.map(row => freeDofs.map(col => K[row][col]));
  const Ff = freeDofs.map(row => F[row]);

  const sol = solveLinearSystem(Kff, Ff);
  if (!sol.ok) {
    return { ok: false, error: 'Kafes sistem kararsız (mekanizma veya tekil rijitlik matrisi).', determinacy, detDegree, m, r, j };
  }

  const u = new Array(ndof).fill(0);
  freeDofs.forEach((d, idx) => { u[d] = sol.x[idx]; });

  // Support reactions R = K*u - F
  const Rvec = new Array(ndof).fill(0);
  for (let i = 0; i < ndof; i++) {
    let sum = -F[i];
    for (let k = 0; k < ndof; k++) sum += K[i][k] * u[k];
    Rvec[i] = fixed[i] ? sum : 0;
  }

  const nodeResults = nodes.map((nd, i) => ({
    x: nd.x, y: nd.y,
    uxMm: u[2 * i] * 1000,
    uyMm: u[2 * i + 1] * 1000,
    rx: Rvec[2 * i],
    ry: Rvec[2 * i + 1],
  }));

  let maxDispMm = 0, maxTension = 0, maxCompression = 0, strainEnergyJ = 0;
  nodeResults.forEach(nr => { maxDispMm = Math.max(maxDispMm, Math.hypot(nr.uxMm, nr.uyMm)); });

  const memberResults = elemMeta.map((em, idx) => {
    const du = u[2 * em.j] - u[2 * em.i];
    const dv = u[2 * em.j + 1] - u[2 * em.i + 1];
    const delta = du * em.c + dv * em.s; // m
    const force = (em.EA / em.L) * delta; // kN (+ tension, - compression)
    const stressMPa = (10 * force) / em.A_cm2;
    const state = Math.abs(force) < 1e-4 ? 'sıfır' : force > 0 ? 'çekme' : 'basınç';
    if (force > maxTension) maxTension = force;
    if (force < maxCompression) maxCompression = force;
    strainEnergyJ += 0.5 * (force * 1000) * delta;
    return { index: idx, ...em, force, stressMPa, state, elongationMm: delta * 1000 };
  });

  // Equilibrium check
  let sumFx = 0, sumFy = 0, sumM0 = 0;
  nodes.forEach((nd, i) => {
    const fx = (Number(nd.fx) || 0) + Rvec[2 * i];
    const fy = (Number(nd.fy) || 0) + Rvec[2 * i + 1];
    sumFx += fx; sumFy += fy;
    sumM0 += nd.x * fy - nd.y * fx;
  });

  return {
    ok: true,
    determinacy, detDegree, m, r, j,
    nodes: nodeResults,
    members: memberResults,
    maxDispMm,
    maxTension,
    maxCompression,
    strainEnergyJ,
    equilibriumError: Math.max(Math.abs(sumFx), Math.abs(sumFy), Math.abs(sumM0)),
  };
}

// ---------- 3. Çerçeve Analizi (2D Frame — Direct Stiffness Method) ----------

export function solveFrame2D({ nodes = [], members = [] } = {}) {
  const j = nodes.length;
  const m = members.length;
  const ndof = 3 * j;
  const fixed = new Array(ndof).fill(false);

  nodes.forEach((nd, i) => {
    const s = nd.support || 'free';
    if (s === 'fixed') { fixed[3 * i] = fixed[3 * i + 1] = fixed[3 * i + 2] = true; }
    else if (s === 'pin') { fixed[3 * i] = fixed[3 * i + 1] = true; }
    else if (s === 'roller' || s === 'roller-x') { fixed[3 * i + 1] = true; }
  });

  const K = Array.from({ length: ndof }, () => new Array(ndof).fill(0));
  const F = new Array(ndof).fill(0);
  nodes.forEach((nd, i) => {
    F[3 * i] = Number(nd.fx) || 0;
    F[3 * i + 1] = Number(nd.fy) || 0;
    F[3 * i + 2] = Number(nd.mz) || 0; // CCW positive (kN·m)
  });

  const elems = [];
  for (let e = 0; e < m; e++) {
    const mb = members[e];
    const ni = nodes[mb.i], nj = nodes[mb.j];
    const dx = nj.x - ni.x, dy = nj.y - ni.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return { ok: false, error: `Eleman #${e + 1} uzunluğu sıfır.` };
    const c = dx / L, s = dy / L;
    const E_GPa = Math.max(1, Number(mb.E_GPa) || 200);
    const A_cm2 = Math.max(1, Number(mb.A_cm2) || 40);
    const I_cm4 = Math.max(10, Number(mb.I_cm4) || 8000);
    const EA = E_GPa * A_cm2 * 100;       // kN
    const EI = E_GPa * I_cm4 * 1e-2;      // kN·m^2
    const w = Number(mb.w) || 0;          // uniform load in local -y' (kN/m)

    const a1 = EA / L;
    const b1 = (12 * EI) / (L * L * L);
    const b2 = (6 * EI) / (L * L);
    const b3 = (4 * EI) / L;
    const b4 = (2 * EI) / L;

    const kl = [
      [a1, 0, 0, -a1, 0, 0],
      [0, b1, b2, 0, -b1, b2],
      [0, b2, b3, 0, -b2, b4],
      [-a1, 0, 0, a1, 0, 0],
      [0, -b1, -b2, 0, b1, -b2],
      [0, b2, b4, 0, -b2, b3],
    ];

    // Transformation T: d_local = T * d_global
    const T = [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];

    // Kg = T^T * kl * T
    const tmp = Array.from({ length: 6 }, (_, r) =>
      Array.from({ length: 6 }, (__, col) => {
        let sum = 0;
        for (let k = 0; k < 6; k++) sum += kl[r][k] * T[k][col];
        return sum;
      })
    );
    const kg = Array.from({ length: 6 }, (_, r) =>
      Array.from({ length: 6 }, (__, col) => {
        let sum = 0;
        for (let k = 0; k < 6; k++) sum += T[k][r] * tmp[k][col];
        return sum;
      })
    );

    // Consistent local nodal load for uniform w in local -y'
    const feqL = [0, -0.5 * w * L, -(w * L * L) / 12, 0, -0.5 * w * L, (w * L * L) / 12];
    const feqG = Array.from({ length: 6 }, (_, r) => {
      let sum = 0;
      for (let k = 0; k < 6; k++) sum += T[k][r] * feqL[k];
      return sum;
    });

    const map = [3 * mb.i, 3 * mb.i + 1, 3 * mb.i + 2, 3 * mb.j, 3 * mb.j + 1, 3 * mb.j + 2];
    for (let r = 0; r < 6; r++) {
      F[map[r]] += feqG[r];
      for (let col = 0; col < 6; col++) K[map[r]][map[col]] += kg[r][col];
    }

    elems.push({ index: e, i: mb.i, j: mb.j, L, c, s, E_GPa, A_cm2, I_cm4, EA, EI, w, kl, T, feqL, map });
  }

  const freeDofs = [];
  for (let i = 0; i < ndof; i++) if (!fixed[i]) freeDofs.push(i);
  const Kff = freeDofs.map(r => freeDofs.map(c => K[r][c]));
  const Ff = freeDofs.map(r => F[r]);
  const sol = solveLinearSystem(Kff, Ff);
  if (!sol.ok) return { ok: false, error: 'Çerçeve kararsız veya yetersiz mesnetli.' };

  const u = new Array(ndof).fill(0);
  freeDofs.forEach((d, idx) => { u[d] = sol.x[idx]; });

  const Rvec = new Array(ndof).fill(0);
  for (let i = 0; i < ndof; i++) {
    let sum = -F[i];
    for (let k = 0; k < ndof; k++) sum += K[i][k] * u[k];
    Rvec[i] = fixed[i] ? sum : 0;
  }

  const nodeResults = nodes.map((nd, i) => ({
    x: nd.x, y: nd.y,
    uxMm: u[3 * i] * 1000,
    uyMm: u[3 * i + 1] * 1000,
    rzMrad: u[3 * i + 2] * 1000,
    rx: Rvec[3 * i],
    ry: Rvec[3 * i + 1],
    mz: Rvec[3 * i + 2],
  }));

  let maxAbsM = 0, maxAbsV = 0, maxAbsN = 0, maxDispMm = 0;
  nodeResults.forEach(nr => { maxDispMm = Math.max(maxDispMm, Math.hypot(nr.uxMm, nr.uyMm)); });

  const memberResults = elems.map(em => {
    const ug = em.map.map(d => u[d]);
    const ul = Array.from({ length: 6 }, (_, r) => {
      let sum = 0;
      for (let k = 0; k < 6; k++) sum += em.T[r][k] * ug[k];
      return sum;
    });
    const ql = Array.from({ length: 6 }, (_, r) => {
      let sum = -em.feqL[r];
      for (let k = 0; k < 6; k++) sum += em.kl[r][k] * ul[k];
      return sum;
    });

    const nSeg = 20;
    const samples = [];
    const ni = nodes[em.i];
    for (let k = 0; k <= nSeg; k++) {
      const xi = k / nSeg;
      const sx = xi * em.L;
      const Nval = -ql[0]; // tension positive
      const Vval = ql[1] - em.w * sx;
      const Mval = -ql[2] + ql[1] * sx - 0.5 * em.w * sx * sx;
      const xi2 = xi * xi, xi3 = xi2 * xi;
      const uLoc = (1 - xi) * ul[0] + xi * ul[3];
      const vLoc = (1 - 3 * xi2 + 2 * xi3) * ul[1] + em.L * (xi - 2 * xi2 + xi3) * ul[2]
        + (3 * xi2 - 2 * xi3) * ul[4] + em.L * (-xi2 + xi3) * ul[5];
      const gx = ni.x + em.c * sx;
      const gy = ni.y + em.s * sx;
      const dgx = em.c * uLoc - em.s * vLoc;
      const dgy = em.s * uLoc + em.c * vLoc;
      if (Math.abs(Mval) > maxAbsM) maxAbsM = Math.abs(Mval);
      if (Math.abs(Vval) > maxAbsV) maxAbsV = Math.abs(Vval);
      if (Math.abs(Nval) > maxAbsN) maxAbsN = Math.abs(Nval);
      samples.push({ s: sx, x: gx, y: gy, dx: dgx, dy: dgy, N: Nval, V: Vval, M: Mval });
    }
    return {
      index: em.index, i: em.i, j: em.j, L: em.L, c: em.c, s: em.s, w: em.w,
      N1: -ql[0], V1: ql[1], M1: -ql[2],
      N2: ql[3], V2: -ql[4], M2: ql[5],
      samples,
    };
  });

  return {
    ok: true,
    nodes: nodeResults,
    members: memberResults,
    maxAbsM, maxAbsV, maxAbsN, maxDispMm,
  };
}

// ---------- 4. Mohr Dairesi & Gerinim Rozeti ----------

export function solveMohrStress({ sx = 80, sy = -20, txy = 40, thetaDeg = 0, syYield = 250 } = {}) {
  const C = 0.5 * (sx + sy);
  const halfDiff = 0.5 * (sx - sy);
  const R = Math.hypot(halfDiff, txy);
  const s1 = C + R;
  const s2 = C - R;
  const thetaP = 0.5 * Math.atan2(2 * txy, sx - sy) * DEG;
  const thetaS = thetaP - 45;

  const t2 = 2 * thetaDeg * RAD;
  const sxp = C + halfDiff * Math.cos(t2) + txy * Math.sin(t2);
  const syp = C - halfDiff * Math.cos(t2) - txy * Math.sin(t2);
  const txyp = -halfDiff * Math.sin(t2) + txy * Math.cos(t2);

  const tauMax2D = R;
  const tauMax3D = 0.5 * Math.max(Math.abs(s1 - s2), Math.abs(s1), Math.abs(s2));

  const vonMises = Math.sqrt(Math.max(0, s1 * s1 - s1 * s2 + s2 * s2));
  const tresca = Math.max(Math.abs(s1 - s2), Math.abs(s1), Math.abs(s2));
  const syY = Math.max(1, Number(syYield) || 250);

  return {
    sx, sy, txy, thetaDeg, syYield: syY,
    center: C, radius: R,
    s1, s2, thetaP, thetaS,
    sxp, syp, txyp,
    tauMax2D, tauMax3D,
    vonMises, tresca,
    sfVonMises: vonMises > 1e-12 ? syY / vonMises : Infinity,
    sfTresca: tresca > 1e-12 ? syY / tresca : Infinity,
    safeVonMises: vonMises <= syY,
    safeTresca: tresca <= syY,
  };
}

export function solveStrainRosette({
  type = 'rect',
  ea = 400, eb = 250, ec = -100, // microstrain (1e-6)
  E_GPa = 200, nu = 0.3, syYield = 250,
} = {}) {
  let ex, ey, gxy;
  if (type === 'delta') {
    // 0, 60, 120 degrees
    ex = ea;
    ey = (2 * eb + 2 * ec - ea) / 3;
    gxy = (2 / Math.sqrt(3)) * (eb - ec);
  } else {
    // 0, 45, 90 degrees (rectangular)
    ex = ea;
    ey = ec;
    gxy = 2 * eb - ea - ec;
  }

  const C = 0.5 * (ex + ey);
  const R = Math.hypot(0.5 * (ex - ey), 0.5 * gxy);
  const e1 = C + R;
  const e2 = C - R;
  const gMax = 2 * R;
  const thetaP = 0.5 * Math.atan2(gxy, ex - ey) * DEG;

  // Plane stress Hooke's law (E in MPa = E_GPa * 1000, strain in 1e-6)
  const E_MPa = Math.max(1, E_GPa) * 1000;
  const v = Math.max(0, Math.min(0.49, nu));
  const fac = E_MPa / (1 - v * v);
  const sx = fac * (ex + v * ey) * 1e-6;
  const sy = fac * (ey + v * ex) * 1e-6;
  const G_MPa = E_MPa / (2 * (1 + v));
  const txy = G_MPa * gxy * 1e-6;
  const stress = solveMohrStress({ sx, sy, txy, thetaDeg: 0, syYield });

  return { type, ea, eb, ec, ex, ey, gxy, center: C, radius: R, e1, e2, gMax, thetaP, stress };
}

// ---------- 5. Kolon Burkulması (Euler & Johnson) ----------

export const BUCKLING_BCS = {
  'pin-pin':     { label: 'Mafsallı – Mafsallı', K: 1.0 },
  'fixed-free':  { label: 'Ankastre – Serbest',  K: 2.0 },
  'fixed-pin':   { label: 'Ankastre – Mafsallı', K: Math.PI / 4.493409457909064 }, // ≈ 0.6992
  'fixed-fixed': { label: 'Ankastre – Ankastre', K: 0.5 },
};

const FIXED_PIN_U = [4.493409457909064, 7.725251836937707, 10.904121659428899];
const FIXED_FIXED_U = [2 * Math.PI, 8.986818915818128, 4 * Math.PI];

export function bucklingModeShape(bc = 'pin-pin', mode = 1, xi = 0.5) {
  const n = Math.max(1, Math.min(3, Math.round(mode)));
  if (bc === 'fixed-free') {
    const u = ((2 * n - 1) * Math.PI) / 2;
    return 0.5 * (1 - Math.cos(u * xi)); // max = 1 for n>=2, 0.5 at tip for n=1 -> normalize below
  }
  if (bc === 'fixed-pin') {
    const u = FIXED_PIN_U[n - 1];
    const raw = Math.sin(u) * (1 - Math.cos(u * xi)) + Math.cos(u) * (Math.sin(u * xi) - u * xi);
    // Approximate max normalization per mode
    const scale = [1.4303, 1.4718, 1.4840][n - 1] * Math.abs(Math.sin(u) || 1);
    return raw / (scale || 1);
  }
  if (bc === 'fixed-fixed') {
    const u = FIXED_FIXED_U[n - 1];
    if (n % 2 === 1) return 0.5 * (1 - Math.cos(u * xi));
    const raw = (Math.cos(u) - 1) * (Math.cos(u * xi) - 1) + Math.sin(u) * (Math.sin(u * xi) - u * xi);
    return raw / 3.92;
  }
  return Math.sin(n * Math.PI * xi);
}

export function sampleBucklingMode(bc = 'pin-pin', mode = 1, nPts = 81) {
  const xis = [], ys = [];
  let maxA = 0;
  for (let i = 0; i < nPts; i++) {
    const xi = i / (nPts - 1);
    const y = bucklingModeShape(bc, mode, xi);
    xis.push(xi); ys.push(y);
    if (Math.abs(y) > maxA) maxA = Math.abs(y);
  }
  const scale = maxA > 1e-12 ? 1 / maxA : 1;
  return { xis, ys: ys.map(v => v * scale) };
}

export function solveColumnBuckling({
  bc = 'pin-pin',
  L_m = 4.0,
  E_GPa = 200,
  Sy_MPa = 250,
  section = { type: 'rect', b: 80, h: 120 },
  P_kN = 200,
} = {}) {
  const bcInfo = BUCKLING_BCS[bc] || BUCKLING_BCS['pin-pin'];
  const K = bcInfo.K;
  let A, Imin;
  if (section.type === 'tube') {
    const D = Math.max(20, Number(section.D) || 120);
    const t = Math.min(D * 0.45, Math.max(2, Number(section.t) || 8));
    const Di = D - 2 * t;
    A = (Math.PI / 4) * (D * D - Di * Di);
    Imin = (Math.PI / 64) * (D ** 4 - Di ** 4);
  } else {
    const prop = beamSectionProperties(section);
    A = prop.A;
    Imin = prop.Imin;
  }
  const r_mm = Math.sqrt(Imin / A);
  const Le_m = K * L_m;
  const slenderness = (Le_m * 1000) / r_mm;

  const E_MPa = E_GPa * 1000;
  const lambdaC = Math.sqrt((2 * Math.PI * Math.PI * E_MPa) / Sy_MPa);
  const sigmaEuler = (Math.PI * Math.PI * E_MPa) / (slenderness * slenderness);
  const sigmaJohnson = Sy_MPa * (1 - (Sy_MPa * slenderness * slenderness) / (4 * Math.PI * Math.PI * E_MPa));

  const regime = slenderness >= lambdaC ? 'Euler (Narin)' : 'Johnson (Orta/Kısa)';
  const sigmaCr = slenderness >= lambdaC ? sigmaEuler : sigmaJohnson;
  const PcrEuler_kN = (sigmaEuler * A) / 1000;
  const Pcr_kN = (sigmaCr * A) / 1000;
  const Py_kN = (Sy_MPa * A) / 1000;
  const sigmaApplied = (P_kN * 1000) / A;
  const SF = P_kN > 1e-9 ? Pcr_kN / P_kN : Infinity;

  return {
    bc, K, L_m, Le_m, A, Imin, r_mm,
    slenderness, lambdaC,
    sigmaEuler, sigmaJohnson, sigmaCr, sigmaApplied,
    PcrEuler_kN, Pcr_kN, Py_kN,
    regime, SF, safe: P_kN < Pcr_kN,
  };
}

// ---------- 6. Deprem Tepkisi (Newmark-beta SDOF, Spectrum & Shear Building) ----------

export function syntheticGroundMotion({ kind = 'elcentro', pgaG = 0.3, duration = 12, dt = 0.01, fHarmonic = 1.5 } = {}) {
  const n = Math.max(20, Math.round(duration / dt) + 1);
  const t = new Array(n);
  const ag = new Array(n);
  const peakTarget = pgaG * G0;

  if (kind === 'harmonic') {
    const w = 2 * Math.PI * fHarmonic;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const ramp = Math.min(1, t[i] / 0.5);
      ag[i] = peakTarget * ramp * Math.sin(w * t[i]);
    }
    return { t, ag, dt, pgaG };
  }

  if (kind === 'pulse') {
    const t0 = 2.0;
    const fp = Math.max(0.4, fHarmonic);
    let maxA = 0;
    for (let i = 0; i < n; i++) {
      t[i] = i * dt;
      const u = Math.PI * fp * (t[i] - t0);
      const val = (1 - 2 * u * u) * Math.exp(-u * u); // Ricker wavelet
      ag[i] = val;
      if (Math.abs(val) > maxA) maxA = Math.abs(val);
    }
    const sc = maxA > 0 ? peakTarget / maxA : 1;
    for (let i = 0; i < n; i++) ag[i] *= sc;
    return { t, ag, dt, pgaG };
  }

  // Deterministic synthetic strong ground motion (broadband modulated spectrum)
  const rng = makeRng(202405);
  const nComp = 28;
  const freqs = [], amps = [], phases = [];
  for (let k = 0; k < nComp; k++) {
    const f = 0.35 + (k / (nComp - 1)) * 6.5;
    // Kanai-Tajimi-like spectral shape peaking near 1.6 Hz
    const fg = 1.8, zg = 0.45, r = f / fg;
    const psd = Math.sqrt((1 + 4 * zg * zg * r * r) / ((1 - r * r) ** 2 + 4 * zg * zg * r * r));
    freqs.push(f);
    amps.push(psd);
    phases.push(rng() * Math.PI * 2);
  }
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const ti = i * dt;
    t[i] = ti;
    // Saragoni-Hart envelope peaking around t = 2.6 s
    const env = Math.pow(ti / 2.6, 1.35) * Math.exp(1.35 * (1 - ti / 2.6));
    let s = 0;
    for (let k = 0; k < nComp; k++) s += amps[k] * Math.sin(2 * Math.PI * freqs[k] * ti + phases[k]);
    ag[i] = env * s;
    mean += ag[i];
  }
  mean /= n;
  let maxA = 0;
  for (let i = 0; i < n; i++) {
    ag[i] -= mean;
    if (Math.abs(ag[i]) > maxA) maxA = Math.abs(ag[i]);
  }
  const sc = maxA > 0 ? peakTarget / maxA : 1;
  for (let i = 0; i < n; i++) ag[i] *= sc;
  return { t, ag, dt, pgaG };
}

export function newmarkSDOF({ Tn = 0.6, zeta = 0.05, ag = [], dt = 0.01 } = {}) {
  const n = ag.length;
  const wn = (2 * Math.PI) / Math.max(0.02, Tn);
  const kM = wn * wn;
  const cM = 2 * Math.max(0, zeta) * wn;

  // Constant average acceleration Newmark-beta (gamma=1/2, beta=1/4)
  const gamma = 0.5, beta = 0.25;
  const a0 = 1 / (beta * dt * dt);
  const a1 = gamma / (beta * dt);
  const a2 = 1 / (beta * dt);
  const a3 = 1 / (2 * beta) - 1;
  const a4 = gamma / beta - 1;
  const a5 = (dt / 2) * (gamma / beta - 2);
  const kHat = kM + a0 + a1 * cM;

  const u = new Array(n).fill(0);
  const v = new Array(n).fill(0);
  const aRel = new Array(n).fill(0);
  const aAbs = new Array(n).fill(0);

  aRel[0] = -ag[0];
  aAbs[0] = 0;

  let maxU = 0, maxV = 0, maxAbsA = 0;
  for (let i = 0; i < n - 1; i++) {
    const pHat = -ag[i + 1]
      + (a0 * u[i] + a2 * v[i] + a3 * aRel[i])
      + cM * (a1 * u[i] + a4 * v[i] + a5 * aRel[i]);
    const un = pHat / kHat;
    const an = a0 * (un - u[i]) - a2 * v[i] - a3 * aRel[i];
    const vn = v[i] + dt * ((1 - gamma) * aRel[i] + gamma * an);
    u[i + 1] = un;
    v[i + 1] = vn;
    aRel[i + 1] = an;
    aAbs[i + 1] = an + ag[i + 1];

    if (Math.abs(un) > maxU) maxU = Math.abs(un);
    if (Math.abs(vn) > maxV) maxV = Math.abs(vn);
    if (Math.abs(aAbs[i + 1]) > maxAbsA) maxAbsA = Math.abs(aAbs[i + 1]);
  }

  const Sd = maxU;
  const Sv = wn * Sd;
  const SaG = (wn * wn * Sd) / G0;
  return { u, v, aRel, aAbs, maxU, maxV, maxAbsA, Sd, Sv, SaG, wn };
}

export function computeResponseSpectrum({ ag, dt = 0.01, zeta = 0.05, periods = null } = {}) {
  const Ts = periods || Array.from({ length: 56 }, (_, i) => {
    if (i < 24) return 0.04 + i * 0.04;
    return 1.0 + (i - 24) * 0.095;
  });
  const Sd = [], Sv = [], SaG = [];
  for (const T of Ts) {
    const r = newmarkSDOF({ Tn: T, zeta, ag, dt });
    Sd.push(r.Sd);
    Sv.push(r.Sv);
    SaG.push(r.SaG);
  }
  return { periods: Ts, Sd, Sv, SaG };
}

export function solveShearBuildingModes({ masses = [100, 100, 100], stiffnesses = [40000, 40000, 40000] } = {}) {
  // masses in ton (1000 kg), stiffnesses in kN/m (1000 N/m) => k/m has units 1/s^2 directly!
  const N = Math.min(masses.length, stiffnesses.length);
  const K = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    const ki = Math.max(1e-6, stiffnesses[i]);
    const kNext = i < N - 1 ? Math.max(1e-6, stiffnesses[i + 1]) : 0;
    K[i][i] = ki + kNext;
    if (i < N - 1) { K[i][i + 1] = -kNext; K[i + 1][i] = -kNext; }
  }
  const invSqrtM = masses.slice(0, N).map(m => 1 / Math.sqrt(Math.max(1e-6, m)));
  const A = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (__, j) => K[i][j] * invSqrtM[i] * invSqrtM[j])
  );
  const { values, vectors } = jacobiEigenSym(A);
  const totalMass = masses.slice(0, N).reduce((a, b) => a + b, 0);

  const modes = values.map((lam, r) => {
    const omega = Math.sqrt(Math.max(0, lam));
    const phiRaw = vectors[r].map((v, i) => v * invSqrtM[i]);
    // Normalize so roof (top floor, index N-1) is positive and max |phi| = 1
    let maxAbs = 0;
    for (const v of phiRaw) if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    const sgn = phiRaw[N - 1] < 0 ? -1 : 1;
    const phi = phiRaw.map(v => (v * sgn) / (maxAbs || 1));

    let num = 0, den = 0;
    for (let i = 0; i < N; i++) {
      num += masses[i] * phi[i];
      den += masses[i] * phi[i] * phi[i];
    }
    const gamma = num / den;
    const effMass = (num * num) / den;
    return {
      mode: r + 1,
      omega,
      freqHz: omega / (2 * Math.PI),
      period: omega > 1e-12 ? (2 * Math.PI) / omega : Infinity,
      phi,
      gamma,
      effMass,
      effMassRatio: effMass / totalMass,
    };
  });

  return { N, totalMass, modes };
}

// ---------- 7. Zemin Mekaniği (Consolidation, Mohr-Coulomb, Bearing, Rankine) ----------

export function terzaghiConsolidation({ cv = 0.5, Hdr = 3.0, dSigma = 100, t_days = 180, doubleDrain = true, nZ = 41, terms = 45 } = {}) {
  // cv in m^2/year, t_days in days -> convert t to years
  const tYr = Math.max(0, t_days) / 365.25;
  const Tv = (cv * tYr) / (Hdr * Hdr);

  const evalU = tv => {
    if (tv <= 0) return 0;
    let sum = 0;
    for (let m = 0; m < terms; m++) {
      const M = (m + 0.5) * Math.PI;
      sum += (2 / (M * M)) * Math.exp(-M * M * tv);
    }
    return Math.max(0, Math.min(1, 1 - sum));
  };

  const U = evalU(Tv);
  const zNorm = [];
  const uExcess = [];
  const depthMax = doubleDrain ? 2 * Hdr : Hdr;

  for (let i = 0; i < nZ; i++) {
    const z = (depthMax * i) / (nZ - 1);
    const zeta = z / Hdr; // 0..2 for double drainage, 0..1 for single drainage
    let u;
    if (Tv <= 1e-9) {
      u = (i === 0 || (doubleDrain && i === nZ - 1)) ? 0 : dSigma;
    } else {
      let s = 0;
      for (let m = 0; m < terms; m++) {
        const M = (m + 0.5) * Math.PI;
        s += (2 / M) * Math.sin(M * zeta) * Math.exp(-M * M * Tv);
      }
      u = Math.max(0, dSigma * s);
    }
    zNorm.push(z);
    uExcess.push(u);
  }

  // Standard U vs log10(Tv) curve
  const curveTv = [], curveU = [];
  for (let i = 0; i <= 80; i++) {
    const tv = Math.pow(10, -3 + (4 * i) / 80); // 0.001 to 10
    curveTv.push(tv);
    curveU.push(evalU(tv) * 100);
  }

  return {
    Tv, U, U_pct: U * 100,
    z: zNorm, uExcess,
    uMax: Math.max(...uExcess),
    curveTv, curveU,
    t50_days: (0.197 * Hdr * Hdr / cv) * 365.25,
    t90_days: (0.848 * Hdr * Hdr / cv) * 365.25,
  };
}

export function mohrCoulombSoil({ c = 20, phiDeg = 30, sigma = 200, porePressure = 40, sigma3Eff = 100 } = {}) {
  const phi = phiDeg * RAD;
  const sigmaEff = Math.max(0, sigma - porePressure);
  const tauF = c + sigmaEff * Math.tan(phi);
  const kpRoot = Math.tan(Math.PI / 4 + phi / 2);
  const Kp = kpRoot * kpRoot;
  const sigma1EffFail = sigma3Eff * Kp + 2 * c * kpRoot;
  const deviatorFail = sigma1EffFail - sigma3Eff;
  const failureAngleDeg = 45 + phiDeg / 2;
  const circleCenter = 0.5 * (sigma1EffFail + sigma3Eff);
  const circleRadius = 0.5 * (sigma1EffFail - sigma3Eff);
  return {
    c, phiDeg, sigma, porePressure, sigmaEff, tauF,
    sigma3Eff, sigma1EffFail, deviatorFail, failureAngleDeg,
    circleCenter, circleRadius,
  };
}

// Kumbhojkar (1993) / Das textbook Terzaghi N_gamma table (deg: N_gamma)
const TERZAGHI_NGAMMA = [
  [0, 0.0], [5, 0.07], [10, 0.37], [15, 1.13], [20, 2.87], [25, 6.77],
  [30, 15.67], [32, 22.02], [34, 31.15], [35, 37.15], [36, 44.43],
  [38, 64.07], [40, 93.69], [42, 139.32], [45, 262.74], [48, 526.44], [50, 873.84],
];

function interpTerzaghiNgamma(phiDeg) {
  const p = Math.max(0, Math.min(50, phiDeg));
  for (let i = 0; i < TERZAGHI_NGAMMA.length - 1; i++) {
    const [p0, n0] = TERZAGHI_NGAMMA[i];
    const [p1, n1] = TERZAGHI_NGAMMA[i + 1];
    if (p >= p0 && p <= p1) {
      const f = (p - p0) / (p1 - p0);
      return n0 + f * (n1 - n0);
    }
  }
  return TERZAGHI_NGAMMA[TERZAGHI_NGAMMA.length - 1][1];
}

export function terzaghiBearingCapacity({ B = 2.0, Df = 1.5, gamma = 18.5, c = 15, phiDeg = 30, shape = 'strip', FS = 3.0 } = {}) {
  const phi = Math.max(0, Math.min(50, phiDeg)) * RAD;
  let Nc, Nq, Ngamma;
  if (phiDeg < 1e-4) {
    Nc = 5.7; Nq = 1.0; Ngamma = 0.0;
  } else {
    const aTheta = Math.exp((0.75 * Math.PI - 0.5 * phi) * Math.tan(phi));
    const cosTerm = Math.cos(Math.PI / 4 + 0.5 * phi);
    Nq = (aTheta * aTheta) / (2 * cosTerm * cosTerm);
    Nc = (Nq - 1) / Math.tan(phi);
    Ngamma = interpTerzaghiNgamma(phiDeg);
  }
  const q = gamma * Df;
  const sc = shape === 'strip' ? 1.0 : 1.3;
  const sg = shape === 'strip' ? 0.5 : shape === 'square' ? 0.4 : 0.3;

  const termC = sc * c * Nc;
  const termQ = q * Nq;
  const termG = sg * gamma * B * Ngamma;
  const qu = termC + termQ + termG;
  const qAll = qu / Math.max(1, FS);
  const area = shape === 'strip' ? B : shape === 'square' ? B * B : Math.PI * (B / 2) ** 2;
  return { Nc, Nq, Ngamma, q, termC, termQ, termG, qu, qAll, Qall_kN: qAll * area, shape };
}

export function rankineEarthPressure({ H = 6.0, gamma = 18.0, gammaSat = 20.0, phiDeg = 30, c = 0, qs = 10, zw = 6.0 } = {}) {
  const phi = phiDeg * RAD;
  const Ka = Math.tan(Math.PI / 4 - phi / 2) ** 2;
  const Kp = Math.tan(Math.PI / 4 + phi / 2) ** 2;
  const K0 = 1 - Math.sin(phi);
  const gammaW = 9.81;
  const gammaEff = Math.max(1, gammaSat - gammaW);
  const zwClamped = Math.max(0, Math.min(H, zw));

  const n = 121;
  const zs = [], paSoil = [], paWater = [], paTotal = [], ppTotal = [];
  let Pa = 0, Pp = 0, Ma = 0, Mp = 0;

  const evalAt = z => {
    const sigV = qs + (z <= zwClamped ? gamma * z : gamma * zwClamped + gammaEff * (z - zwClamped));
    const uw = z > zwClamped ? gammaW * (z - zwClamped) : 0;
    const sha = Math.max(0, Ka * sigV - 2 * c * Math.sqrt(Ka));
    const shp = Kp * sigV + 2 * c * Math.sqrt(Kp);
    return { sigV, uw, sha, shp, pa: sha + uw, pp: shp + uw };
  };

  let prev = null;
  for (let i = 0; i < n; i++) {
    const z = (H * i) / (n - 1);
    const cur = evalAt(z);
    zs.push(z);
    paSoil.push(cur.sha);
    paWater.push(cur.uw);
    paTotal.push(cur.pa);
    ppTotal.push(cur.pp);
    if (prev) {
      const dz = z - prev.z;
      const dPa = 0.5 * (prev.pa + cur.pa) * dz;
      const dPp = 0.5 * (prev.pp + cur.pp) * dz;
      const yArm = H - 0.5 * (prev.z + z);
      Pa += dPa; Ma += dPa * yArm;
      Pp += dPp; Mp += dPp * yArm;
    }
    prev = { z, ...cur };
  }

  // Tension crack depth (for dry/above-water cohesive backfill)
  const zc = c > 0 ? Math.max(0, (2 * c / Math.sqrt(Ka) - qs) / gamma) : 0;

  return {
    Ka, Kp, K0, zc: Math.min(H, zc),
    zs, paSoil, paWater, paTotal, ppTotal,
    Pa, Pp,
    ya: Pa > 1e-9 ? Ma / Pa : H / 3,
    yp: Pp > 1e-9 ? Mp / Pp : H / 3,
    paBase: paTotal[n - 1],
    ppBase: ppTotal[n - 1],
  };
}

// ---------- 8. Açık Kanal & Hidroloji ----------

export function solveOpenChannel({ b = 4.0, z = 0.0, n = 0.015, S0 = 0.002, Q = 12.0, y1 = null } = {}) {
  const area = y => (b + z * y) * y;
  const perim = y => b + 2 * y * Math.sqrt(1 + z * z);
  const topW = y => b + 2 * z * y;
  const rh = y => area(y) / perim(y);
  const vel = y => Q / area(y);
  const froude = y => (Q * Math.sqrt(topW(y))) / Math.sqrt(G0 * area(y) ** 3);
  const energy = y => y + (Q * Q) / (2 * G0 * area(y) ** 2);
  const specForce = y => (Q * Q) / (G0 * area(y)) + (b * y * y) / 2 + (z * y * y * y) / 3;
  const manningQ = y => (1 / n) * area(y) * Math.pow(rh(y), 2 / 3) * Math.sqrt(S0);

  // Bracket and solve normal depth yn
  let hiN = 1.0;
  while (manningQ(hiN) < Q && hiN < 1e4) hiN *= 2;
  const yn = bisect(y => manningQ(y) - Q, 1e-5, hiN, 1e-10);

  // Bracket and solve critical depth yc (Fr(y) = 1)
  let hiC = 1.0;
  while (froude(hiC) > 1 && hiC < 1e4) hiC *= 2;
  const yc = bisect(y => froude(y) - 1, 1e-5, hiC, 1e-10);

  const Vn = vel(yn), FrN = froude(yn), En = energy(yn);
  const Vc = vel(yc), Emin = energy(yc);
  const regime = FrN < 0.99 ? 'Nehir Rejimi (Alt kritik)' : FrN > 1.01 ? 'Sel Rejimi (Üst kritik)' : 'Kritik Akım';

  // Hydraulic jump from upstream depth y1Eff (< yc)
  const y1Eff = y1 !== null && y1 > 0 ? y1 : (yn < yc ? yn : 0.45 * yc);
  const Fr1 = froude(y1Eff);
  let y2 = y1Eff, dE = 0, jumpType = 'Sıçrama Yok (Fr₁ ≤ 1)';
  if (Fr1 > 1.001) {
    const M1 = specForce(y1Eff);
    let hiJ = Math.max(yc * 1.5, y1Eff * 2);
    while (specForce(hiJ) < M1 && hiJ < 1e4) hiJ *= 2;
    y2 = bisect(y => specForce(y) - M1, yc, hiJ, 1e-10);
    dE = Math.max(0, energy(y1Eff) - energy(y2));
    jumpType = Fr1 < 1.7 ? 'Dalgalı Sıçrama' : Fr1 < 2.5 ? 'Zayıf Sıçrama'
      : Fr1 < 4.5 ? 'Salınımlı Sıçrama' : Fr1 < 9 ? 'Kararlı Sıçrama' : 'Kuvvetli Sıçrama';
  }
  const Fr2 = froude(y2);

  // Specific energy curve samples
  const yMax = Math.max(yn, yc, y2) * 2.1;
  const yMin = Math.max(0.05, yc * 0.22);
  const curveY = [], curveE = [];
  for (let i = 0; i <= 100; i++) {
    const yy = yMin + ((yMax - yMin) * i) / 100;
    curveY.push(yy);
    curveE.push(energy(yy));
  }

  return {
    yn, Vn, FrN, En,
    yc, Vc, Emin,
    regime,
    y1: y1Eff, y2, Fr1, Fr2, E1: energy(y1Eff), E2: energy(y2), dE,
    effPct: energy(y1Eff) > 0 ? (energy(y2) / energy(y1Eff)) * 100 : 100,
    jumpType,
    curveY, curveE,
  };
}

export function solveRationalAndUH({
  C = 0.55,
  i_mmhr = 45,
  A_km2 = 12,
  L_m = 4500,
  slope = 0.015,
  tp_hr = 2.0,
  dt_hr = 0.5,
  storms = [12, 28, 10],
  Qb = 2.0,
} = {}) {
  const Qp_rational = (C * i_mmhr * A_km2) / 3.6; // m^3/s
  const tc_min = 0.01947 * Math.pow(Math.max(10, L_m), 0.77) * Math.pow(Math.max(1e-4, slope), -0.385);

  // SCS triangular Unit Hydrograph (for 1 mm effective rainfall)
  const tb = 2.67 * tp_hr;
  const up = (2000 * A_km2) / (3600 * tb); // m^3/s per mm (exact 0.20807 * A / tp)
  const nU = Math.max(4, Math.ceil(tb / dt_hr) + 1);
  const uhT = [], uhQRaw = [];
  for (let k = 0; k < nU; k++) {
    const tk = k * dt_hr;
    uhT.push(tk);
    let q = 0;
    if (tk > 0 && tk <= tp_hr) q = up * (tk / tp_hr);
    else if (tk > tp_hr && tk < tb) q = up * ((tb - tk) / (tb - tp_hr));
    uhQRaw.push(q);
  }
  // Renormalize discrete UH so trapezoidal volume equals 1 mm * A_km2 exactly
  const rawVol = uhQRaw.reduce((a, b) => a + b, 0) * dt_hr * 3600;
  const targetVol1mm = 1000 * A_km2; // m^3
  const norm = rawVol > 0 ? targetVol1mm / rawVol : 1;
  const uhQ = uhQRaw.map(v => v * norm);

  // Discrete convolution Q(t) = Qb + sum_m P_m * U(t - m*dt)
  const nTotal = nU + storms.length + 1;
  const tHr = [], qDirect = [], qTotal = [];
  let qPeak = 0, tPeak = 0, directVolM3 = 0;
  for (let k = 0; k < nTotal; k++) {
    tHr.push(k * dt_hr);
    let qd = 0;
    for (let m = 0; m < storms.length; m++) {
      const idx = k - m;
      if (idx >= 0 && idx < uhQ.length) qd += Math.max(0, storms[m]) * uhQ[idx];
    }
    const qt = Qb + qd;
    qDirect.push(qd);
    qTotal.push(qt);
    directVolM3 += qd * dt_hr * 3600;
    if (qt > qPeak) { qPeak = qt; tPeak = k * dt_hr; }
  }
  const totalRainMm = storms.reduce((a, b) => a + Math.max(0, b), 0);
  const expectedVolM3 = totalRainMm * 1000 * A_km2;

  return {
    Qp_rational, tc_min, up, tb,
    uhT, uhQ,
    tHr, qDirect, qTotal,
    qPeak, tPeak,
    totalRainMm, directVolM3, expectedVolM3,
  };
}

// ---------- 9. Ulaştırma & Trafik (Horizontal Curve & Greenshields) ----------

export function solveHorizontalCurve({
  V_kmh = 90,
  R = 350,
  ePct = 6,
  fs = 0.13,
  tr = 2.5,
  gradePct = 0,
  aDecel = 3.4,
  Ms_avail = 7.0,
} = {}) {
  const Vms = V_kmh / 3.6;
  const e = ePct / 100;
  const G = gradePct / 100;
  const Rmin = (Vms * Vms) / (G0 * Math.max(0.01, e + fs));
  const eReq = Math.max(0, (Vms * Vms) / (G0 * R) - fs);
  const fReq = Math.max(0, (Vms * Vms) / (G0 * R) - e);
  const aLat = (Vms * Vms) / R;
  const aNet = Math.max(0, aLat - G0 * e);

  // Stopping Sight Distance
  const dReact = Vms * tr;
  const effDecel = Math.max(0.5, aDecel + G0 * G);
  const dBrake = (Vms * Vms) / (2 * effDecel);
  const SSD = dReact + dBrake;
  const halfAngle = Math.min(Math.PI / 2, SSD / (2 * R));
  const Mreq = R * (1 - Math.cos(halfAngle));

  return {
    V_kmh, Vms, R, Rmin,
    ePct, eReqPct: eReq * 100, fReq,
    aLat, aNet,
    dReact, dBrake, SSD,
    Mreq, Ms_avail,
    radiusSafe: R >= Rmin,
    sightSafe: Ms_avail >= Mreq,
  };
}

export function solveTrafficGreenshields({ vf = 100, kj = 140, k = 50, kDown = 110 } = {}) {
  const kc = kj / 2;
  const vc = vf / 2;
  const qMax = (vf * kj) / 4;
  const kClamped = Math.max(0, Math.min(kj, k));
  const v = vf * (1 - kClamped / kj);
  const q = kClamped * v;
  const spaceHeadwayM = kClamped > 1e-6 ? 1000 / kClamped : Infinity;
  const timeHeadwayS = q > 1e-6 ? 3600 / q : Infinity;
  const regime = kClamped < kc * 0.95 ? 'Serbest Akım' : kClamped <= kc * 1.05 ? 'Kapasite (Kritik)' : 'Sıkışık Akım';

  const kd = Math.max(0, Math.min(kj, kDown));
  const qd = kd * vf * (1 - kd / kj);
  const shockwaveKmh = Math.abs(kd - kClamped) > 1e-6 ? (qd - q) / (kd - kClamped) : 0;

  return {
    vf, kj, kc, vc, qMax,
    k: kClamped, v, q,
    spaceHeadwayM, timeHeadwayS, regime,
    shockwaveKmh,
  };
}

// =====================================================================
// FIELD: MALZEME (10–17)
// =====================================================================

// ---------- 10. Gerilme-Şekil Değiştirme (Tensile Test) ----------

export const TENSILE_MATERIALS = {
  steel:    { name: 'Yapı Çeliği (S235)', E_GPa: 200, sy: 250, uts: 420, eu: 0.16, ef: 0.28, plateau: 0.018, sfRatio: 0.72, kind: 'steel' },
  aluminum: { name: 'Alüminyum (6061-T6)', E_GPa: 69, sy: 275, uts: 315, eu: 0.08, ef: 0.14, plateau: 0, sfRatio: 0.78, kind: 'ductile' },
  copper:   { name: 'Tavlı Bakır (Cu)', E_GPa: 117, sy: 75, uts: 225, eu: 0.28, ef: 0.44, plateau: 0, sfRatio: 0.70, kind: 'ductile' },
  polymer:  { name: 'Polimer (HDPE)', E_GPa: 1.2, sy: 28, uts: 32, eu: 0.10, ef: 0.60, plateau: 0, sfRatio: 0.85, kind: 'polymer' },
  ceramic:  { name: 'Seramik (Al₂O₃)', E_GPa: 380, sy: 320, uts: 320, eu: 320 / 380000, ef: 320 / 380000, plateau: 0, sfRatio: 1.0, kind: 'brittle' },
};

export function evaluateTensileCurve(materialId = 'steel', custom = {}, nPts = 220) {
  const base = TENSILE_MATERIALS[materialId] || TENSILE_MATERIALS.steel;
  const E_GPa = Math.max(0.2, custom.E_GPa ?? base.E_GPa);
  const E_MPa = E_GPa * 1000;
  const sy = Math.max(5, custom.sy ?? base.sy);
  const uts = Math.max(sy, custom.uts ?? base.uts);
  const ey = sy / E_MPa;
  const isBrittle = base.kind === 'brittle';
  const eu = isBrittle ? ey : Math.max(ey + 0.015, custom.eu ?? base.eu);
  const ef = isBrittle ? ey : Math.max(eu + 0.015, custom.ef ?? base.ef);
  const plateau = base.kind === 'steel' ? Math.min(base.plateau, (eu - ey) * 0.35) : 0;
  const sf = uts * base.sfRatio;

  const stressAt = eps => {
    if (eps <= 0) return 0;
    if (eps > ef) return 0;
    if (eps <= ey) return E_MPa * eps;
    if (isBrittle) return sy;

    if (base.kind === 'polymer') {
      if (eps <= eu) {
        const u = (eps - ey) / (eu - ey);
        return sy + (uts - sy) * (2 * u - u * u);
      }
      const w = (eps - eu) / (ef - eu);
      // Cold drawing drop then mild orientation hardening
      const dip = uts * (1 - 0.18 * Math.sin(Math.min(1, w * 2.5) * Math.PI * 0.5));
      return dip + (sf - dip) * (w * w);
    }

    const epEnd = ey + plateau;
    if (eps <= epEnd) return sy;
    if (eps <= eu) {
      const u = (eps - epEnd) / (eu - epEnd);
      // Smooth strain hardening with zero slope at UTS
      return sy + (uts - sy) * Math.pow(1 - Math.pow(1 - u, 2.2), 0.85);
    }
    // Necking descent from (eu, uts) to (ef, sf)
    const w = (eps - eu) / (ef - eu);
    return uts - (uts - sf) * (w * w * (3 - 2 * w));
  };

  // Sample finely in elastic + plastic regions
  const eps = [], sigma = [], trueEps = [], trueSigma = [];
  const nEl = isBrittle ? nPts : 30;
  const nPl = isBrittle ? 0 : nPts - nEl;
  for (let i = 0; i <= nEl; i++) {
    const e = (ey * i) / nEl;
    const s = stressAt(e);
    eps.push(e); sigma.push(s);
    trueEps.push(Math.log(1 + e));
    trueSigma.push(s * (1 + e));
  }
  for (let i = 1; i <= nPl; i++) {
    const e = ey + ((ef - ey) * i) / nPl;
    const s = stressAt(e);
    eps.push(e); sigma.push(s);
    if (e <= eu) {
      trueEps.push(Math.log(1 + e));
      trueSigma.push(s * (1 + e));
    }
  }

  // Numerical integration for resilience (area up to ey) and toughness (total area)
  let toughness = 0;
  for (let i = 1; i < eps.length; i++) {
    toughness += 0.5 * (sigma[i - 1] + sigma[i]) * (eps[i] - eps[i - 1]);
  }
  const resilience = (sy * sy) / (2 * E_MPa); // exact elastic triangle area (MJ/m^3)

  // 0.2% offset yield intersection: stressAt(e) = E_MPa * (e - 0.002)
  let sy02 = sy, ey02 = ey;
  if (!isBrittle && ef > 0.002 + ey) {
    const fn = e => stressAt(e) - E_MPa * (e - 0.002);
    const lo = 0.002;
    const hi = Math.min(ef, 0.002 + (uts * 1.2) / E_MPa);
    if (fn(lo) > 0 && fn(hi) <= 0) {
      ey02 = bisect(fn, lo, hi, 1e-8);
      sy02 = stressAt(ey02);
    }
  }

  return {
    materialId, name: base.name, kind: base.kind,
    E_GPa, sy, sy02, ey, ey02, uts, eu, ef, sf,
    resilience_MJm3: resilience,
    toughness_MJm3: toughness,
    ductilityPct: ef * 100,
    eps, sigma, trueEps, trueSigma,
    stressAt,
  };
}

// ---------- 11. Kristal Yapılar, Miller İndisleri & XRD ----------

export const CRYSTAL_PRESETS = {
  'Po-SC':  { label: 'Polonyum (SC)',  lattice: 'SC',  a_A: 3.35,  c_A: 3.35,  aw: 208.98 },
  'Fe-BCC': { label: 'Demir α-Fe (BCC)', lattice: 'BCC', a_A: 2.866, c_A: 2.866, aw: 55.845 },
  'Cu-FCC': { label: 'Bakır Cu (FCC)', lattice: 'FCC', a_A: 3.615, c_A: 3.615, aw: 63.546 },
  'Al-FCC': { label: 'Alüminyum Al (FCC)', lattice: 'FCC', a_A: 4.049, c_A: 4.049, aw: 26.982 },
  'Mg-HCP': { label: 'Magnezyum Mg (HCP)', lattice: 'HCP', a_A: 3.209, c_A: 5.211, aw: 24.305 },
  'Ti-HCP': { label: 'Titanyum Ti (HCP)', lattice: 'HCP', a_A: 2.951, c_A: 4.684, aw: 47.867 },
};

export function analyzeCrystal({ lattice = 'FCC', a_A = 3.615, c_A = null, aw = 63.546 } = {}) {
  const a = Math.max(1.5, Number(a_A) || 3.615);
  let nAtoms, CN, R_A, Vc_A3, APF, cEff, atoms = [];

  if (lattice === 'SC') {
    nAtoms = 1; CN = 6; R_A = a / 2; Vc_A3 = a ** 3;
    APF = Math.PI / 6; cEff = a;
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) atoms.push({ x, y, z, role: 'corner' });
  } else if (lattice === 'BCC') {
    nAtoms = 2; CN = 8; R_A = (Math.sqrt(3) / 4) * a; Vc_A3 = a ** 3;
    APF = (Math.sqrt(3) * Math.PI) / 8; cEff = a;
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) atoms.push({ x, y, z, role: 'corner' });
    atoms.push({ x: 0.5, y: 0.5, z: 0.5, role: 'body' });
  } else if (lattice === 'HCP') {
    cEff = c_A && c_A > 0 ? c_A : a * Math.sqrt(8 / 3);
    nAtoms = 6; CN = 12; R_A = a / 2;
    Vc_A3 = (1.5 * Math.sqrt(3)) * a * a * cEff;
    const atomVol = nAtoms * (4 / 3) * Math.PI * R_A ** 3;
    APF = Math.min(0.75, atomVol / Vc_A3);
    // 3D normalized coordinates for hexagonal prism (centered at origin in xy, z in [0, c/a])
    const ca = cEff / a;
    for (const z of [0, ca]) {
      atoms.push({ x: 0, y: 0, z, role: 'face' });
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3;
        atoms.push({ x: Math.cos(ang), y: Math.sin(ang), z, role: 'corner' });
      }
    }
    for (let k = 0; k < 3; k++) {
      const ang = (k * 2 * Math.PI) / 3 + Math.PI / 6;
      const rad = 1 / Math.sqrt(3);
      atoms.push({ x: rad * Math.cos(ang), y: rad * Math.sin(ang), z: 0.5 * ca, role: 'body' });
    }
  } else {
    // FCC
    nAtoms = 4; CN = 12; R_A = (Math.sqrt(2) / 4) * a; Vc_A3 = a ** 3;
    APF = (Math.sqrt(2) * Math.PI) / 6; cEff = a;
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) atoms.push({ x, y, z, role: 'corner' });
    const faces = [
      [0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5],
    ];
    faces.forEach(([x, y, z]) => atoms.push({ x, y, z, role: 'face' }));
  }

  // Theoretical density in g/cm^3 (1 A^3 = 1e-24 cm^3)
  const density_gcm3 = (nAtoms * aw) / (Vc_A3 * 1e-24 * N_AVO);
  return { lattice, a_A: a, c_A: cEff, caRatio: cEff / a, aw, nAtoms, CN, R_A, Vc_A3, APF, density_gcm3, atoms };
}

export function millerSpacing({ lattice = 'FCC', a_A = 3.615, c_A = 5.211, h = 1, k = 1, l = 1 } = {}) {
  if (h === 0 && k === 0 && l === 0) return Infinity;
  if (lattice === 'HCP') {
    const invD2 = (4 / 3) * ((h * h + h * k + k * k) / (a_A * a_A)) + (l * l) / (c_A * c_A);
    return 1 / Math.sqrt(invD2);
  }
  return a_A / Math.sqrt(h * h + k * k + l * l);
}

export function millerPlanePolygon(h = 1, k = 1, l = 1) {
  if (h === 0 && k === 0 && l === 0) return [];
  // Shift plane hx + ky + lz = d so it sits inside [0, 1]^3
  const d = 1 - (h < 0 ? 1 : 0) * Math.abs(h) - (k < 0 ? 1 : 0) * Math.abs(k) - (l < 0 ? 1 : 0) * Math.abs(l)
    + (h < 0 || k < 0 || l < 0 ? 0 : 0);
  // Choose d = max of 1 shifted for negative indices so plane intersects unit cube cleanly
  const ox = h < 0 ? 1 : 0, oy = k < 0 ? 1 : 0, oz = l < 0 ? 1 : 0;
  const rhs = 1 + h * ox + k * oy + l * oz - (ox + oy + oz > 0 ? 1 : 0);
  const planeD = ox + oy + oz === 0 ? 1 : (h * ox + k * oy + l * oz + 1);
  // Simpler & guaranteed inside [0,1]^3: choose d = 0.5*(minVal + maxVal) if standard intercept falls outside,
  // or exact standard intercept when h,k,l >= 0 (d = 1) and shifted origin when negative.
  const dUse = (h >= 0 && k >= 0 && l >= 0)
    ? 1
    : (h * (h < 0 ? 1 : 0) + k * (k < 0 ? 1 : 0) + l * (l < 0 ? 1 : 0) + 1);
  void d; void rhs; void planeD;

  const verts = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  const pts = [];
  const f = p => h * p[0] + k * p[1] + l * p[2] - dUse;
  for (const [i, j] of edges) {
    const a = verts[i], b = verts[j];
    const fa = f(a), fb = f(b);
    if (Math.abs(fa) < 1e-9) pts.push(a);
    if (Math.abs(fb) < 1e-9) pts.push(b);
    if (fa * fb < -1e-12) {
      const t = fa / (fa - fb);
      pts.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
  }
  // Deduplicate
  const uniq = [];
  for (const p of pts) {
    if (!uniq.some(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-5)) uniq.push(p);
  }
  if (uniq.length < 3) return [];

  // Sort cyclically around centroid in plane orthogonal to (h,k,l)
  const cx = uniq.reduce((s, p) => s + p[0], 0) / uniq.length;
  const cy = uniq.reduce((s, p) => s + p[1], 0) / uniq.length;
  const cz = uniq.reduce((s, p) => s + p[2], 0) / uniq.length;
  const nLen = Math.hypot(h, k, l);
  const nx = h / nLen, ny = k / nLen, nz = l / nLen;
  const ref = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = ref[1] * nz - ref[2] * ny, uy = ref[2] * nx - ref[0] * nz, uz = ref[0] * ny - ref[1] * nx;
  const uLen = Math.hypot(ux, uy, uz);
  ux /= uLen; uy /= uLen; uz /= uLen;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;

  uniq.sort((p, q) => {
    const ap = Math.atan2((p[0] - cx) * vx + (p[1] - cy) * vy + (p[2] - cz) * vz, (p[0] - cx) * ux + (p[1] - cy) * uy + (p[2] - cz) * uz);
    const aq = Math.atan2((q[0] - cx) * vx + (q[1] - cy) * vy + (q[2] - cz) * vz, (q[0] - cx) * ux + (q[1] - cy) * uy + (q[2] - cz) * uz);
    return ap - aq;
  });
  return uniq;
}

export function computeXRD({ lattice = 'FCC', a_A = 3.615, c_A = 5.211, lambda_A = 1.5406, maxTwoTheta = 120 } = {}) {
  const groups = new Map();
  const maxIdx = 4;
  for (let h = 0; h <= maxIdx; h++) {
    for (let k = (lattice === 'HCP' ? 0 : 0); k <= maxIdx; k++) {
      for (let l = 0; l <= maxIdx; l++) {
        if (h === 0 && k === 0 && l === 0) continue;
        if (lattice !== 'HCP' && (h < k || k < l)) continue; // unique family in cubic
        if (lattice === 'HCP' && h < k) continue;

        let F2 = 1;
        if (lattice === 'BCC') {
          if ((h + k + l) % 2 !== 0) continue;
          F2 = 4;
        } else if (lattice === 'FCC') {
          const par = (h & 1) + (k & 1) + (l & 1);
          if (par !== 0 && par !== 3) continue;
          F2 = 16;
        } else if (lattice === 'HCP') {
          const ph = 2 * Math.PI * ((2 * h + k) / 3 + l / 2);
          F2 = 2 + 2 * Math.cos(ph);
          if (F2 < 1e-6) continue;
        }

        const d = millerSpacing({ lattice, a_A, c_A, h, k, l });
        const sinTh = lambda_A / (2 * d);
        if (sinTh >= 0.999) continue;
        const th = Math.asin(sinTh);
        const twoTheta = 2 * th * DEG;
        if (twoTheta > maxTwoTheta) continue;

        // Multiplicity
        let mult;
        if (lattice === 'HCP') {
          const nz = (h > 0 ? 1 : 0) + (k > 0 ? 1 : 0);
          mult = (nz === 0 ? 2 : h === k || k === 0 ? 6 : 12) * (l > 0 ? 2 : 1);
        } else {
          const zs = (h === 0 ? 1 : 0) + (k === 0 ? 1 : 0) + (l === 0 ? 1 : 0);
          const signWays = 1 << (3 - zs);
          const permWays = (h === k && k === l) ? 1 : (h === k || k === l) ? 3 : 6;
          mult = signWays * permWays;
        }
        const lp = (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th));
        const inten = F2 * mult * lp;
        const key = twoTheta.toFixed(2);
        const lbl = `(${h}${k}${l})`;
        if (!groups.has(key)) {
          groups.set(key, { h, k, l, label: lbl, d_A: d, twoTheta, intensity: inten });
        } else {
          const g = groups.get(key);
          g.intensity += inten;
          g.label += `/${lbl}`;
        }
      }
    }
  }
  const peaks = [...groups.values()].sort((a, b) => a.twoTheta - b.twoTheta);
  const maxI = Math.max(...peaks.map(p => p.intensity), 1e-12);
  peaks.forEach(p => { p.relIntensity = (p.intensity / maxI) * 100; });
  return peaks;
}

// ---------- 12. Faz Diyagramları (Cu-Ni, Pb-Sn, Fe-Fe3C) ----------

export function evalIsomorphous(C0 = 40, T = 1280) {
  const c = Math.max(0, Math.min(100, C0));
  const x = c / 100;
  // Calibrated to textbook Cu-Ni diagram (Cu 1085 C, Ni 1455 C; at 50% Ni: T_sol ≈ 1260 C, T_liq ≈ 1315 C)
  const Tliq = xc => 1085 + 370 * xc + 180 * xc * (1 - xc);
  const Tsol = xc => 1085 + 370 * xc - 40 * xc * (1 - xc);
  const tl = Tliq(x), ts = Tsol(x);

  if (T >= tl) {
    return { system: 'Cu-Ni', C0: c, T, region: 'L (Sıvı)', phases: [{ name: 'Sıvı (L)', comp: c, frac: 1 }], tie: null, Tliq: tl, Tsol: ts };
  }
  if (T <= ts) {
    return { system: 'Cu-Ni', C0: c, T, region: 'α (Katı Çözelti)', phases: [{ name: 'Katı (α)', comp: c, frac: 1 }], tie: null, Tliq: tl, Tsol: ts };
  }
  // Invert Tliq(xL) = T and Tsol(xA) = T via bisection on [0, 1]
  const xL = bisect(v => Tliq(v) - T, 0, 1, 1e-9);
  const xA = bisect(v => Tsol(v) - T, 0, 1, 1e-9);
  const CL = xL * 100, CA = xA * 100;
  const WL = Math.max(0, Math.min(1, (CA - c) / Math.max(1e-9, CA - CL)));
  const WA = 1 - WL;
  return {
    system: 'Cu-Ni', C0: c, T, region: 'α + L (İki Fazlı)',
    phases: [{ name: 'Sıvı (L)', comp: CL, frac: WL }, { name: 'Katı (α)', comp: CA, frac: WA }],
    tie: { cLeft: CL, cRight: CA, T },
    Tliq: tl, Tsol: ts,
  };
}

export function evalEutecticPbSn(C0 = 40, T = 210) {
  const c = Math.max(0, Math.min(100, C0));
  const TE = 183, CE = 61.9, CaMax = 18.3, CbMin = 97.8, TPb = 327, TSn = 232;
  const Ca0 = 2.0, Cb0 = 99.5;

  const TliqL = x => TPb - (TPb - TE) * Math.pow(x / CE, 1.05);
  const TliqR = x => TSn - (TSn - TE) * Math.pow((100 - x) / (100 - CE), 1.05);
  const TsolL = x => TPb - (TPb - TE) * (x / CaMax);
  const TsolR = x => TSn - (TSn - TE) * ((100 - x) / (100 - CbMin));
  const CaSolv = temp => Ca0 + (CaMax - Ca0) * Math.pow(Math.max(0, temp) / TE, 2.2);
  const CbSolv = temp => Cb0 - (Cb0 - CbMin) * Math.pow(Math.max(0, temp) / TE, 2.2);

  const tLiq = c <= CE ? TliqL(c) : TliqR(c);
  if (T >= tLiq) {
    return { system: 'Pb-Sn', C0: c, T, region: 'L (Sıvı)', phases: [{ name: 'Sıvı (L)', comp: c, frac: 1 }], tie: null, micro: 'Tamamen Sıvı' };
  }

  if (T > TE) {
    if (c <= CaMax && T <= TsolL(c)) {
      return { system: 'Pb-Sn', C0: c, T, region: 'α (Pb-zengin katı)', phases: [{ name: 'α Fazı', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı α Taneleri' };
    }
    if (c >= CbMin && T <= TsolR(c)) {
      return { system: 'Pb-Sn', C0: c, T, region: 'β (Sn-zengin katı)', phases: [{ name: 'β Fazı', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı β Taneleri' };
    }
    if (c < CE) {
      const cA = CaMax * ((TPb - T) / (TPb - TE));
      const cL = bisect(x => TliqL(x) - T, 0, CE, 1e-8);
      const WL = (c - cA) / Math.max(1e-9, cL - cA);
      return {
        system: 'Pb-Sn', C0: c, T, region: 'α + L',
        phases: [{ name: 'α Katısı', comp: cA, frac: 1 - WL }, { name: 'Sıvı (L)', comp: cL, frac: WL }],
        tie: { cLeft: cA, cRight: cL, T },
        micro: 'Sıvı İçinde Birincil α Dendritleri',
      };
    }
    const cL = bisect(x => TliqR(x) - T, CE, 100, 1e-8);
    const cB = 100 - (100 - CbMin) * ((TSn - T) / (TSn - TE));
    const WB = (c - cL) / Math.max(1e-9, cB - cL);
    return {
      system: 'Pb-Sn', C0: c, T, region: 'β + L',
      phases: [{ name: 'Sıvı (L)', comp: cL, frac: 1 - WB }, { name: 'β Katısı', comp: cB, frac: WB }],
      tie: { cLeft: cL, cRight: cB, T },
      micro: 'Sıvı İçinde Birincil β Dendritleri',
    };
  }

  // Below eutectic temperature TE = 183 C
  const cA = CaSolv(T);
  const cB = CbSolv(T);
  if (c <= cA) {
    return { system: 'Pb-Sn', C0: c, T, region: 'α (Katı Çözelti)', phases: [{ name: 'α Fazı', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı α Taneleri' };
  }
  if (c >= cB) {
    return { system: 'Pb-Sn', C0: c, T, region: 'β (Katı Çözelti)', phases: [{ name: 'β Fazı', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı β Taneleri' };
  }
  const WB = (c - cA) / Math.max(1e-9, cB - cA);
  const WA = 1 - WB;
  let proFrac = 0, eutFrac = 1, micro = 'Lamelli Ötektik (α + β)';
  if (c < CE - 0.5 && c > CaMax) {
    proFrac = (CE - c) / (CE - CaMax);
    eutFrac = 1 - proFrac;
    micro = `Ötektik Öncesi α (%${(proFrac * 100).toFixed(0)}) + Ötektik (%${(eutFrac * 100).toFixed(0)})`;
  } else if (c > CE + 0.5 && c < CbMin) {
    proFrac = (c - CE) / (CbMin - CE);
    eutFrac = 1 - proFrac;
    micro = `Ötektik Öncesi β (%${(proFrac * 100).toFixed(0)}) + Ötektik (%${(eutFrac * 100).toFixed(0)})`;
  }
  return {
    system: 'Pb-Sn', C0: c, T, region: 'α + β (Ötektik Altı)',
    phases: [{ name: 'α Fazı', comp: cA, frac: WA }, { name: 'β Fazı', comp: cB, frac: WB }],
    tie: { cLeft: cA, cRight: cB, T },
    proFrac, eutFrac, micro,
  };
}

export function evalFeFe3C(C0 = 0.4, T = 650) {
  const c = Math.max(0, Math.min(6.67, C0));
  const TEutd = 727, CEutd = 0.76, CAlphaMax = 0.022;
  const TEut = 1147, CEut = 4.30, CGammaMax = 2.14, CFe3C = 6.67;

  // Key curves
  const TliqL = x => 1538 - (1538 - TEut) * (x / CEut);
  const TliqR = x => TEut + (1600 - TEut) * ((x - CEut) / (CFe3C - CEut));
  const TsolG = x => 1538 - (1538 - TEut) * (x / CGammaMax);
  const TA3 = x => 912 - (912 - TEutd) * (x / CEutd);
  const TAcm = x => TEutd + (TEut - TEutd) * ((x - CEutd) / (CGammaMax - CEutd));
  const CAlphaSolv = temp => 0.008 + (CAlphaMax - 0.008) * Math.max(0, temp / TEutd);

  const tLiq = c <= CEut ? TliqL(c) : TliqR(c);
  if (T >= tLiq) {
    return { system: 'Fe-Fe3C', C0: c, T, region: 'L (Sıvı)', phases: [{ name: 'Sıvı (L)', comp: c, frac: 1 }], tie: null, micro: 'Sıvı Eriyik' };
  }

  if (T > TEut) {
    if (c < CEut) {
      const cG = CGammaMax * ((1538 - T) / (1538 - TEut));
      if (c <= cG) return { system: 'Fe-Fe3C', C0: c, T, region: 'γ (Östenit)', phases: [{ name: 'Östenit (γ)', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı Östenit (FCC)' };
      const cL = CEut * ((1538 - T) / (1538 - TEut));
      const WL = (c - cG) / Math.max(1e-9, cL - cG);
      return {
        system: 'Fe-Fe3C', C0: c, T, region: 'γ + L',
        phases: [{ name: 'Östenit (γ)', comp: cG, frac: 1 - WL }, { name: 'Sıvı (L)', comp: cL, frac: WL }],
        tie: { cLeft: cG, cRight: cL, T }, micro: 'Sıvı İçinde Östenit Dendritleri',
      };
    }
    const cL = CEut + (CFe3C - CEut) * ((T - TEut) / (1600 - TEut));
    const WFe3C = (c - cL) / Math.max(1e-9, CFe3C - cL);
    return {
      system: 'Fe-Fe3C', C0: c, T, region: 'L + Fe₃C',
      phases: [{ name: 'Sıvı (L)', comp: cL, frac: 1 - WFe3C }, { name: 'Sementit (Fe₃C)', comp: CFe3C, frac: WFe3C }],
      tie: { cLeft: cL, cRight: CFe3C, T }, micro: 'Sıvı + Birincil Sementit',
    };
  }

  if (T > TEutd) {
    const cA = CAlphaMax * ((912 - Math.min(912, T)) / (912 - TEutd));
    const cGLeft = T < 912 ? CEutd * ((912 - T) / (912 - TEutd)) : 0;
    const cGRight = CEutd + (CGammaMax - CEutd) * ((T - TEutd) / (TEut - TEutd));

    if (T < 912 && c <= cA) {
      return { system: 'Fe-Fe3C', C0: c, T, region: 'α (Ferrit)', phases: [{ name: 'Ferrit (α)', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı Ferrit (BCC)' };
    }
    if (T < 912 && c < cGLeft) {
      const WG = (c - cA) / Math.max(1e-9, cGLeft - cA);
      return {
        system: 'Fe-Fe3C', C0: c, T, region: 'α + γ',
        phases: [{ name: 'Ferrit (α)', comp: cA, frac: 1 - WG }, { name: 'Östenit (γ)', comp: cGLeft, frac: WG }],
        tie: { cLeft: cA, cRight: cGLeft, T }, micro: 'Ötektoid Öncesi Ferrit + Östenit',
      };
    }
    if (c <= cGRight && T <= TsolG(Math.min(c, CGammaMax))) {
      return { system: 'Fe-Fe3C', C0: c, T, region: 'γ (Östenit)', phases: [{ name: 'Östenit (γ)', comp: c, frac: 1 }], tie: null, micro: 'Tek Fazlı Östenit (FCC)' };
    }
    const WFe3C = (c - cGRight) / Math.max(1e-9, CFe3C - cGRight);
    return {
      system: 'Fe-Fe3C', C0: c, T, region: 'γ + Fe₃C',
      phases: [{ name: 'Östenit (γ)', comp: cGRight, frac: 1 - WFe3C }, { name: 'Sementit (Fe₃C)', comp: CFe3C, frac: WFe3C }],
      tie: { cLeft: cGRight, cRight: CFe3C, T }, micro: c <= CGammaMax ? 'Östenit + Tane Sınırı Sementit' : 'Östenit + Ledebürit (Dökme Demir)',
    };
  }

  // Below eutectoid temperature 727 C
  const cA = CAlphaSolv(T);
  if (c <= cA) {
    return { system: 'Fe-Fe3C', C0: c, T, region: 'α (Ferrit)', phases: [{ name: 'Ferrit (α)', comp: c, frac: 1 }], tie: null, micro: 'Saf Ferrit (BCC)' };
  }
  const WFe3C = (c - cA) / (CFe3C - cA);
  const WAlpha = 1 - WFe3C;
  let micro, pearliteFrac = 0, proFrac = 0;
  if (c < CEutd - 0.02) {
    pearliteFrac = (c - CAlphaMax) / (CEutd - CAlphaMax);
    proFrac = 1 - pearliteFrac;
    micro = `Ötektoid Altı Çelik: %${(proFrac * 100).toFixed(0)} Ferrit + %${(pearliteFrac * 100).toFixed(0)} Perlit`;
  } else if (Math.abs(c - CEutd) <= 0.02) {
    pearliteFrac = 1;
    micro = 'Ötektoid Çelik: %100 Lamelli Perlit';
  } else if (c <= CGammaMax) {
    pearliteFrac = (CFe3C - c) / (CFe3C - CEutd);
    proFrac = 1 - pearliteFrac;
    micro = `Ötektoid Üstü Çelik: %${(proFrac * 100).toFixed(0)} Sementit + %${(pearliteFrac * 100).toFixed(0)} Perlit`;
  } else {
    micro = 'Beyaz Dökme Demir (Perlit + Ledebürit + Sementit)';
  }
  return {
    system: 'Fe-Fe3C', C0: c, T, region: 'α + Fe₃C',
    phases: [{ name: 'Ferrit (α)', comp: cA, frac: WAlpha }, { name: 'Sementit (Fe₃C)', comp: CFe3C, frac: WFe3C }],
    tie: { cLeft: cA, cRight: CFe3C, T },
    pearliteFrac, proFrac, micro,
    TA3: TA3(Math.min(c, CEutd)), TAcm: TAcm(Math.max(c, CEutd)),
  };
}

// ---------- 13. Difüzyon (Fick'in 2. Yasası, Arrhenius & Rastgele Yürüyüş) ----------

export const DIFFUSION_PRESETS = {
  'C-FCC-Fe': { label: 'Karbon → γ-Fe (Karbürizasyon)', D0: 2.3e-5, Qd_kJ: 148, T_C: 950, C0: 0.2, Cs: 1.2, t_hr: 4 },
  'C-BCC-Fe': { label: 'Karbon → α-Fe (BCC)',          D0: 6.2e-7, Qd_kJ: 80,  T_C: 650, C0: 0.01, Cs: 0.08, t_hr: 1 },
  'Cu-Al':    { label: 'Bakır → Alüminyum',             D0: 6.5e-5, Qd_kJ: 136, T_C: 500, C0: 0.0, Cs: 4.0, t_hr: 10 },
  'Zn-Cu':    { label: 'Çinko → Bakır (Pirinç)',        D0: 2.4e-5, Qd_kJ: 189, T_C: 800, C0: 0.0, Cs: 30.0, t_hr: 8 },
};

export function arrheniusD(D0, Qd_kJ, T_K) {
  return D0 * Math.exp(-(Qd_kJ * 1000) / (R_GAS * Math.max(100, T_K)));
}

export function fickErfcProfile({ C0 = 0.2, Cs = 1.2, D = 1e-11, t_s = 14400, xMax_mm = 3.0, n = 121 } = {}) {
  const denom = 2 * Math.sqrt(Math.max(1e-30, D * Math.max(1e-9, t_s)));
  const xMm = [], C = [];
  for (let i = 0; i < n; i++) {
    const xm = (xMax_mm * i) / (n - 1);
    const xMeters = xm * 1e-3;
    xMm.push(xm);
    C.push(C0 + (Cs - C0) * erfc(xMeters / denom));
  }
  return { xMm, C, diffLengthMm: denom * 1000 };
}

export function fickCaseDepth({ C0 = 0.2, Cs = 1.2, Ctarget = 0.6, D = 1e-11, t_s = 14400 } = {}) {
  const ratio = (Ctarget - C0) / (Cs - C0);
  if (!(ratio > 0 && ratio < 1)) return ratio >= 1 ? 0 : Infinity;
  const z = bisect(u => erfc(u) - ratio, 0, 5, 1e-9);
  return 2 * z * Math.sqrt(D * t_s) * 1000; // mm
}

export function createRandomWalkState(nParticles = 180, mode = 'step', seed = 42) {
  const rng = makeRng(seed);
  const particles = [];
  for (let i = 0; i < nParticles; i++) {
    const x = mode === 'step' ? rng() * 0.22 : 0.5;
    const y = mode === 'step' ? 0.05 + rng() * 0.9 : 0.5;
    particles.push({ x, y, x0: x, y0: y });
  }
  return { particles, steps: 0, rng };
}

export function stepRandomWalk(rw, stepSize = 0.015, subSteps = 1) {
  const ps = rw.particles;
  for (let s = 0; s < subSteps; s++) {
    rw.steps++;
    for (let i = 0; i < ps.length; i++) {
      const ang = rw.rng() * Math.PI * 2;
      let nx = ps[i].x + stepSize * Math.cos(ang);
      let ny = ps[i].y + stepSize * Math.sin(ang);
      if (nx < 0) nx = -nx;
      if (nx > 1) nx = 2 - nx;
      if (ny < 0) ny = -ny;
      if (ny > 1) ny = 2 - ny;
      ps[i].x = Math.max(0, Math.min(1, nx));
      ps[i].y = Math.max(0, Math.min(1, ny));
    }
  }
  let msd = 0;
  for (let i = 0; i < ps.length; i++) {
    const dx = ps[i].x - ps[i].x0, dy = ps[i].y - ps[i].y0;
    msd += dx * dx + dy * dy;
  }
  msd /= Math.max(1, ps.length);
  return { msd, steps: rw.steps };
}

// ---------- 14. Yorulma & Kırılma (S-N, Goodman/Soderberg, Paris Law) ----------

export function solveSNBasquin({ Sut = 600, Se = 280, N_endurance = 1e6, hasEnduranceLimit = true, sigmaA = 320 } = {}) {
  const s3 = 0.9 * Sut;
  const b = Math.log10(Se / s3) / Math.log10(N_endurance / 1e3);
  const a = s3 / Math.pow(1e3, b);

  const strengthAtN = N => {
    if (hasEnduranceLimit && N >= N_endurance) return Se;
    if (N <= 1e3) return s3;
    return a * Math.pow(N, b);
  };

  let lifeN;
  if (sigmaA >= Sut) lifeN = 1;
  else if (hasEnduranceLimit && sigmaA <= Se) lifeN = Infinity;
  else lifeN = Math.pow(sigmaA / a, 1 / b);

  const logNs = [], sCurve = [];
  for (let i = 0; i <= 80; i++) {
    const lN = 3 + (5 * i) / 80; // 10^3 to 10^8
    const N = Math.pow(10, lN);
    logNs.push(lN);
    sCurve.push(strengthAtN(N));
  }
  return { a, b, s3, Se, Sut, lifeN, strengthAtN, logNs, sCurve };
}

export function solveMeanStressCriteria({ sigmaA = 140, sigmaM = 180, Se = 280, Sut = 600, Sy = 450 } = {}) {
  const smPos = Math.max(0, sigmaM);
  const invGoodman = sigmaA / Se + smPos / Sut;
  const invSoderberg = sigmaA / Se + smPos / Sy;
  const nGoodman = invGoodman > 1e-12 ? 1 / invGoodman : Infinity;
  const nSoderberg = invSoderberg > 1e-12 ? 1 / invSoderberg : Infinity;
  const nYield = (sigmaA + Math.abs(sigmaM)) > 1e-12 ? Sy / (sigmaA + Math.abs(sigmaM)) : Infinity;

  // Gerber: (n*sigmaA/Se) + (n*smPos/Sut)^2 = 1
  let nGerber;
  if (smPos < 1e-12) {
    nGerber = sigmaA > 1e-12 ? Se / sigmaA : Infinity;
  } else {
    const A = (smPos / Sut) ** 2;
    const B = sigmaA / Se;
    nGerber = (-B + Math.sqrt(B * B + 4 * A)) / (2 * A);
  }
  const sigmaAr = smPos < Sut ? sigmaA / Math.max(1e-6, 1 - smPos / Sut) : Infinity;

  return {
    nGoodman, nSoderberg, nGerber, nYield, sigmaAr,
    safeGoodman: nGoodman >= 1,
    safeSoderberg: nSoderberg >= 1,
    safeGerber: nGerber >= 1,
    safeYield: nYield >= 1,
  };
}

export function solveParisCrackGrowth({
  a0_mm = 1.0,
  Y = 1.12,
  sigmaMax = 180,
  sigmaMin = 0,
  KIc = 55,
  C_paris = 1.5e-11, // m/cycle / (MPa*sqrt(m))^m
  m_paris = 3.0,
} = {}) {
  const a0 = Math.max(1e-4, a0_mm) * 1e-3; // m
  const dSigma = Math.max(1e-6, sigmaMax - Math.max(0, sigmaMin));
  const K0 = Y * sigmaMax * Math.sqrt(Math.PI * a0);
  const dK0 = Y * dSigma * Math.sqrt(Math.PI * a0);
  const ac = (1 / Math.PI) * Math.pow(KIc / Math.max(1e-6, Y * sigmaMax), 2); // m
  const ac_mm = ac * 1000;

  if (a0 >= ac) {
    return {
      a0_mm, ac_mm, K0, dK0, KIc,
      fracturedImmediately: true,
      Nf_exact: 0,
      cycles: [0], aCurveMm: [a0_mm], kCurve: [K0],
    };
  }

  // Exact analytical Paris integral for constant Y
  const coeff = C_paris * Math.pow(Y * dSigma * Math.sqrt(Math.PI), m_paris);
  let Nf_exact;
  if (Math.abs(m_paris - 2) < 1e-6) {
    Nf_exact = Math.log(ac / a0) / coeff;
  } else {
    const exp = 1 - m_paris / 2;
    Nf_exact = (Math.pow(ac, exp) - Math.pow(a0, exp)) / (coeff * exp);
  }

  // RK4 integration in N (with 120 steps up to 0.999 * Nf_exact)
  const nSteps = 120;
  const dN = (Nf_exact * 0.998) / nSteps;
  const daDN = a => coeff * Math.pow(Math.max(1e-12, a), m_paris / 2);
  const cycles = [0], aCurveMm = [a0 * 1000], kCurve = [K0];
  let a = a0;
  for (let i = 1; i <= nSteps; i++) {
    const k1 = daDN(a);
    const k2 = daDN(a + 0.5 * dN * k1);
    const k3 = daDN(a + 0.5 * dN * k2);
    const k4 = daDN(a + dN * k3);
    a = Math.min(ac, a + (dN / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    cycles.push(i * dN);
    aCurveMm.push(a * 1000);
    kCurve.push(Y * sigmaMax * Math.sqrt(Math.PI * a));
  }
  cycles.push(Nf_exact); aCurveMm.push(ac_mm); kCurve.push(KIc);

  return {
    a0_mm, ac_mm, K0, dK0, KIc,
    fracturedImmediately: false,
    Nf_exact,
    cycles, aCurveMm, kCurve,
  };
}

// ---------- 15. Isıl İşlem — TTT Diyagramı (Eutectoid Steel 0.76% C) ----------

export const TTT_A1 = 727;
export const TTT_MS = 215;
export const TTT_MF = 100;

export function tttStartFinishTime(T) {
  // Returns { ts, tf } in seconds for eutectoid steel (nose around 540 C, ts ~ 0.8 s, tf ~ 5.5 s)
  if (T >= TTT_A1 - 1 || T <= TTT_MS) return { ts: Infinity, tf: Infinity };
  const Tnose = 540;
  let logTs, logTf;
  if (T >= Tnose) {
    const u = (T - Tnose) / (TTT_A1 - T); // blows up as T -> A1
    const base = Math.log10(0.8);
    logTs = base + 1.05 * Math.pow(u, 0.95) + 0.12 * u * u;
    logTf = Math.log10(5.5) + 1.08 * Math.pow(u, 0.95) + 0.12 * u * u;
  } else {
    const v = (Tnose - T) / (Tnose - TTT_MS); // 0 at nose, 1 at Ms
    logTs = Math.log10(0.8) + 2.45 * Math.pow(v, 1.75);
    logTf = Math.log10(5.5) + 2.75 * Math.pow(v, 1.65);
  }
  const ts = Math.pow(10, Math.min(7, logTs));
  const tf = Math.pow(10, Math.min(7.8, Math.max(logTs + 0.4, logTf)));
  return { ts, tf };
}

export function tttCurves(nPts = 80) {
  const Ts = [], ts = [], tf = [];
  for (let i = 0; i < nPts; i++) {
    const T = TTT_MS + 4 + ((TTT_A1 - 12 - (TTT_MS + 4)) * i) / (nPts - 1);
    const { ts: s, tf: f } = tttStartFinishTime(T);
    Ts.push(T); ts.push(s); tf.push(f);
  }
  return { Ts, ts, tf, A1: TTT_A1, Ms: TTT_MS, Mf: TTT_MF };
}

export function simulateCoolingPath(waypoints = []) {
  if (!waypoints || waypoints.length < 2) {
    return { coarsePearlite: 0, finePearlite: 0, bainite: 0, martensite: 0, retainedAustenite: 100, hrc: 15, summary: 'Östenit' };
  }
  const pts = waypoints.slice().sort((a, b) => a.t - b.t);
  let fAust = 1.0;
  let fCoarseP = 0, fFineP = 0, fBainite = 0, fMart = 0;
  let scheil = 0;
  let minT = pts[0].T;

  for (let seg = 0; seg < pts.length - 1; seg++) {
    const p0 = pts[seg], p1 = pts[seg + 1];
    const dtTot = Math.max(0, p1.t - p0.t);
    if (dtTot <= 0) continue;
    const sub = 60;
    const logMode = p0.t > 0 && p1.t / p0.t > 3;

    for (let k = 0; k < sub; k++) {
      const u0 = k / sub, u1 = (k + 1) / sub;
      const t0 = logMode ? p0.t * Math.pow(p1.t / p0.t, u0) : p0.t + dtTot * u0;
      const t1 = logMode ? p0.t * Math.pow(p1.t / p0.t, u1) : p0.t + dtTot * u1;
      const dt = t1 - t0;
      const fracMid = (0.5 * (t0 + t1) - p0.t) / dtTot;
      const T = p0.T + (p1.T - p0.T) * fracMid;
      if (T < minT) minT = T;

      if (fAust <= 1e-6) break;

      if (T < TTT_A1 - 1 && T > TTT_MS) {
        const { ts, tf } = tttStartFinishTime(T);
        if (scheil < 1) {
          scheil += dt / ts;
        }
        if (scheil >= 1) {
          // Avrami-like diffusive transformation rate scaled between ts (1%) and tf (99%)
          const span = Math.max(0.1, tf - ts);
          const rate = 4.605 / span; // ln(100) / span -> 99% completion across (tf - ts)
          const df = fAust * (1 - Math.exp(-rate * dt));
          fAust -= df;
          if (T >= 625) fCoarseP += df;
          else if (T >= 540) fFineP += df;
          else fBainite += df;
        }
      } else if (T <= TTT_MS) {
        // Koistinen-Marburger athermal martensite transformation
        const targetMFrac = 1 - Math.exp(-0.028 * (TTT_MS - T));
        const availAust = fAust + fMart; // remaining untransformed austenite that entered Ms
        const desiredM = availAust * targetMFrac;
        if (desiredM > fMart) {
          const dM = Math.min(fAust, desiredM - fMart);
          fMart += dM;
          fAust -= dM;
        }
      }
    }
  }

  const tot = fCoarseP + fFineP + fBainite + fMart + fAust || 1;
  const coarsePearlite = (fCoarseP / tot) * 100;
  const finePearlite = (fFineP / tot) * 100;
  const bainite = (fBainite / tot) * 100;
  const martensite = (fMart / tot) * 100;
  const retainedAustenite = (fAust / tot) * 100;

  const hrc = (coarsePearlite * 18 + finePearlite * 32 + bainite * 46 + martensite * 64 + retainedAustenite * 15) / 100;

  const parts = [];
  if (martensite >= 1) parts.push(`%${martensite.toFixed(0)} Martensit`);
  if (bainite >= 1) parts.push(`%${bainite.toFixed(0)} Beynit`);
  if (finePearlite >= 1) parts.push(`%${finePearlite.toFixed(0)} İnce Perlit`);
  if (coarsePearlite >= 1) parts.push(`%${coarsePearlite.toFixed(0)} Kaba Perlit`);
  if (retainedAustenite >= 1) parts.push(`%${retainedAustenite.toFixed(0)} Kalıntı Östenit`);

  return {
    coarsePearlite, finePearlite, bainite, martensite, retainedAustenite,
    hrc, summary: parts.join(' + ') || 'Östenit',
  };
}

// ---------- 16. Kompozit Malzemeler (Voigt / Reuss / Halpin-Tsai / Off-axis) ----------

export const COMPOSITE_PRESETS = {
  carbon: { label: 'Karbon / Epoksi', Ef: 230, Em: 3.5, nuf: 0.20, num: 0.35, rhof: 1.78, rhom: 1.20, Vf: 0.60 },
  glass:  { label: 'E-Cam / Epoksi',  Ef: 72,  Em: 3.5, nuf: 0.22, num: 0.35, rhof: 2.55, rhom: 1.20, Vf: 0.55 },
  kevlar: { label: 'Kevlar 49 / Epoksi', Ef: 130, Em: 3.5, nuf: 0.34, num: 0.35, rhof: 1.44, rhom: 1.20, Vf: 0.60 },
  boron:  { label: 'Bor / Alüminyum', Ef: 400, Em: 70,  nuf: 0.20, num: 0.33, rhof: 2.60, rhom: 2.70, Vf: 0.50 },
};

export function solveComposite({
  Ef = 230, Em = 3.5, nuf = 0.20, num = 0.35, rhof = 1.78, rhom = 1.20, Vf = 0.60, thetaDeg = 0,
} = {}) {
  const vf = Math.max(0, Math.min(1, Vf));
  const vm = 1 - vf;
  const E1 = vf * Ef + vm * Em;                                         // Voigt (longitudinal)
  const E2 = 1 / (vf / Ef + vm / Em);                                   // Reuss (transverse)
  const xi = 2.0;
  const eta = (Ef / Em - 1) / (Ef / Em + xi);
  const E2_HT = Em * ((1 + xi * eta * vf) / (1 - eta * vf));            // Halpin-Tsai

  const nu12 = vf * nuf + vm * num;
  const Gf = Ef / (2 * (1 + nuf));
  const Gm = Em / (2 * (1 + num));
  const G12 = 1 / (vf / Gf + vm / Gm);

  const evalAngle = deg => {
    const th = deg * RAD;
    const c = Math.cos(th), s = Math.sin(th);
    const invE = (c ** 4) / E1 + (1 / G12 - (2 * nu12) / E1) * (s * s * c * c) + (s ** 4) / E2;
    return 1 / invE;
  };

  const Etheta = evalAngle(thetaDeg);
  const rhoC = vf * rhof + vm * rhom;
  const specificModulus = E1 / rhoC; // GPa / (g/cm^3)
  const fiberLoadSharePct = E1 > 0 ? ((vf * Ef) / E1) * 100 : 0;

  return {
    Vf: vf, E1, E2, E2_HT, G12, nu12, Etheta,
    rhoC, specificModulus, fiberLoadSharePct,
    evalAngle,
  };
}

// ---------- 17. Yarı İletken Malzeme (Carrier Concentration & Fermi Level) ----------

export const SEMICONDUCTORS = {
  Si:   { name: 'Silisyum (Si)',      Eg0: 1.1695, alpha: 4.73e-4, beta: 636, Nc300: 2.86e19, Nv300: 3.10e19, mun: 1400, mup: 450 },
  Ge:   { name: 'Germanyum (Ge)',     Eg0: 0.7437, alpha: 4.77e-4, beta: 235, Nc300: 1.04e19, Nv300: 6.00e18, mun: 3900, mup: 1900 },
  GaAs: { name: 'Galyum Arsenit (GaAs)', Eg0: 1.519, alpha: 5.41e-4, beta: 204, Nc300: 4.70e17, Nv300: 7.00e18, mun: 8500, mup: 400 },
  SiC:  { name: 'Silisyum Karbür (4H-SiC)', Eg0: 3.285, alpha: 3.3e-4, beta: 100, Nc300: 1.70e19, Nv300: 2.50e19, mun: 900, mup: 120 },
};

export function solveSemiconductor({ material = 'Si', T_K = 300, Nd = 1e16, Na = 0 } = {}) {
  const mat = SEMICONDUCTORS[material] || SEMICONDUCTORS.Si;
  const T = Math.max(80, Math.min(1200, T_K));
  const kT = K_B_EV * T;
  const Eg = Math.max(0.1, mat.Eg0 - (mat.alpha * T * T) / (T + mat.beta));
  const tRatio = T / 300;
  const Nc = mat.Nc300 * Math.pow(tRatio, 1.5);
  const Nv = mat.Nv300 * Math.pow(tRatio, 1.5);
  const ni = Math.sqrt(Nc * Nv) * Math.exp(-Eg / (2 * kT));

  const Nnet = Nd - Na;
  let n, p;
  if (Math.abs(Nnet) < 1e-3 * ni) {
    n = ni; p = ni;
  } else if (Nnet > 0) {
    const half = 0.5 * Nnet;
    n = half + Math.sqrt(half * half + ni * ni);
    p = (ni * ni) / n;
  } else {
    const half = -0.5 * Nnet;
    p = half + Math.sqrt(half * half + ni * ni);
    n = (ni * ni) / p;
  }

  // Energy levels relative to Ev = 0 (eV)
  const Ei = 0.5 * Eg + 0.5 * kT * Math.log(Nv / Nc);
  let Ef;
  if (ni > 1e-300 && n > 1e-300) {
    Ef = Ei + kT * Math.log(n / ni);
  } else {
    // Ultra-wide bandgap at low T: use Boltzmann relation directly to nearest band
    Ef = Nnet >= 0 ? Eg + kT * Math.log(Math.max(1e-300, n) / Nc) : -kT * Math.log(Math.max(1e-300, p) / Nv);
  }
  const EfClamped = Math.max(-0.2, Math.min(Eg + 0.2, Ef));

  // Lattice-scattering mobility scaling (300/T)^1.5
  const mobScale = Math.pow(300 / T, 1.5);
  const mun = mat.mun * mobScale;
  const mup = mat.mup * mobScale;
  const sigma_Scm = Q_ELEC * (n * mun + p * mup);
  const rho_OhmCm = sigma_Scm > 1e-30 ? 1 / sigma_Scm : Infinity;

  const regime = (Math.abs(Nnet) < 0.2 * ni) ? 'Öz (İntrensek)'
    : (Nnet > 0 ? (ni > 0.2 * Nnet ? 'Geçiş (n→Öz)' : 'n-tipi (Ekstrensek)')
      : (ni > 0.2 * Math.abs(Nnet) ? 'Geçiş (p→Öz)' : 'p-tipi (Ekstrensek)'));

  const fermiDirac = E => 1 / (1 + Math.exp(Math.max(-60, Math.min(60, (E - EfClamped) / kT))));

  return {
    material, name: mat.name, T, kT, Eg, Nc, Nv, ni,
    Nd, Na, Nnet, n, p,
    Ei, Ef: EfClamped,
    mun, mup, sigma_Scm, rho_OhmCm, regime,
    fermiDirac,
  };
}

// =====================================================================
// FIELD: KİMYA MÜHENDİSLİĞİ (18–25)
// =====================================================================

// ---------- 18. Reaktör Tasarımı (Isothermal Batch/CSTR/PFR & Non-Isothermal CSTR) ----------

export function solveIsothermalReactors({
  order = '1st', // '1st' | '2nd' | 'rev1'
  k = 0.5,
  kRev = 0.12,
  CA0 = 2.0,
  v0 = 1.0,
  tau = 4.0,
  nCSTR = 3,
  Xtarget = 0.75,
} = {}) {
  const FA0 = CA0 * v0;
  const Xeq = order === 'rev1' ? k / (k + kRev) : 1.0;

  const rateAtX = X => {
    if (order === '2nd') return k * CA0 * CA0 * (1 - X) * (1 - X);
    if (order === 'rev1') return Math.max(0, (k + kRev) * CA0 * (Xeq - X));
    return k * CA0 * (1 - X);
  };

  const convPFR = t => {
    if (t <= 0) return 0;
    if (order === '2nd') {
      const Da = k * CA0 * t;
      return Da / (1 + Da);
    }
    if (order === 'rev1') return Xeq * (1 - Math.exp(-(k + kRev) * t));
    return 1 - Math.exp(-k * t);
  };

  const convCSTR = t => {
    if (t <= 0) return 0;
    if (order === '2nd') {
      const Da = k * CA0 * t;
      return (1 + 2 * Da - Math.sqrt(1 + 4 * Da)) / (2 * Da);
    }
    if (order === 'rev1') {
      const Da = (k + kRev) * t;
      return Xeq * (Da / (1 + Da));
    }
    const Da = k * t;
    return Da / (1 + Da);
  };

  const convNCSTR = (t, N) => {
    if (t <= 0) return 0;
    const ti = t / Math.max(1, N);
    if (order === '1st') return 1 - Math.pow(1 + k * ti, -N);
    if (order === 'rev1') return Xeq * (1 - Math.pow(1 + (k + kRev) * ti, -N));
    let CA = CA0;
    for (let i = 0; i < N; i++) {
      CA = (-1 + Math.sqrt(1 + 4 * k * ti * CA)) / (2 * k * ti);
    }
    return 1 - CA / CA0;
  };

  // Required volumes for target conversion Xt
  const Xt = Math.min(Xtarget, Xeq * 0.96);
  const rXt = Math.max(1e-12, rateAtX(Xt));
  const V_CSTR = (FA0 * Xt) / rXt;
  let V_PFR;
  if (order === '2nd') V_PFR = (v0 / (k * CA0)) * (Xt / (1 - Xt));
  else if (order === 'rev1') V_PFR = (v0 / (k + kRev)) * (-Math.log(1 - Xt / Xeq));
  else V_PFR = (v0 / k) * (-Math.log(1 - Xt));

  // Cascade of N equal-volume CSTRs reaching Xt (solve tauTotal by bisection)
  const tauNTarget = bisect(t => convNCSTR(t, nCSTR) - Xt, 0, Math.max(1e3, (V_CSTR / v0) * 4), 1e-8);
  const V_NCSTR = tauNTarget * v0;
  const stageXs = [0];
  for (let s = 1; s <= nCSTR; s++) stageXs.push(convNCSTR((tauNTarget * s) / nCSTR, s));

  // Curves: X vs tau and Levenspiel FA0/(-rA) vs X
  const taus = [], xPFRCurve = [], xCSTRCurve = [], xNCSTRCurve = [];
  const tauMax = Math.max(tau * 1.8, 1);
  for (let i = 0; i <= 100; i++) {
    const t = (tauMax * i) / 100;
    taus.push(t);
    xPFRCurve.push(convPFR(t));
    xCSTRCurve.push(convCSTR(t));
    xNCSTRCurve.push(convNCSTR(t, nCSTR));
  }

  const levX = [], levY = [];
  const xLevMax = Math.min(Xeq * 0.95, Math.max(Xt + 0.08, Xeq * 0.85));
  for (let i = 0; i <= 100; i++) {
    const x = (xLevMax * i) / 100;
    levX.push(x);
    levY.push(FA0 / Math.max(1e-9, rateAtX(x)));
  }

  return {
    order, FA0, Xeq, Xt,
    X_PFR: convPFR(tau),
    X_Batch: convPFR(tau),
    X_CSTR: convCSTR(tau),
    X_NCSTR: convNCSTR(tau, nCSTR),
    V_PFR, V_CSTR, V_NCSTR,
    volRatio: V_CSTR / Math.max(1e-12, V_PFR),
    stageXs,
    taus, xPFRCurve, xCSTRCurve, xNCSTRCurve,
    levX, levY, rateAtX,
  };
}

export function solveNonIsothermalCSTR({
  tau = 60,            // s
  k0 = 3.4e8,          // 1/s
  Ea_kJ = 75,          // kJ/mol
  negDH_kJ = 90,       // (-Delta H_rxn) kJ/mol (exothermic > 0)
  CA0 = 2.0,           // mol/L
  v0 = 0.5,            // L/s
  Cp_kJ = 0.22,        // kJ/(mol·K) (heat capacity per mol A fed)
  T0 = 320,            // feed temp (K)
  Tc = 315,            // coolant temp (K)
  UA_kW = 0.50,        // kW/K
} = {}) {
  const FA0 = CA0 * v0; // mol/s
  const XofT = T => {
    const kT = k0 * Math.exp(-(Ea_kJ * 1000) / (R_GAS * T));
    const Da = tau * kT;
    return Da / (1 + Da);
  };
  const GofT = T => negDH_kJ * FA0 * XofT(T);                       // kW
  const RofT = T => FA0 * Cp_kJ * (T - T0) + UA_kW * (T - Tc);      // kW

  const Tmin = 270, Tmax = 560;
  const Ts = [], Gs = [], Rs = [], Xs = [];
  const n = 290;
  for (let i = 0; i <= n; i++) {
    const T = Tmin + ((Tmax - Tmin) * i) / n;
    Ts.push(T); Gs.push(GofT(T)); Rs.push(RofT(T)); Xs.push(XofT(T));
  }

  // Find all steady states G(T) - R(T) = 0 across extended thermal range [240, 720] K
  const steadyStates = [];
  const diff = T => GofT(T) - RofT(T);
  const scanMin = 240, scanMax = 720, scanN = 480;
  for (let i = 0; i < scanN; i++) {
    const Ta = scanMin + ((scanMax - scanMin) * i) / scanN;
    const Tb = scanMin + ((scanMax - scanMin) * (i + 1)) / scanN;
    const f0 = diff(Ta), f1 = diff(Tb);
    if (f0 === 0 || f0 * f1 < 0) {
      const Tstar = bisect(diff, Ta, Tb, 1e-8);
      if (steadyStates.length && Math.abs(Tstar - steadyStates[steadyStates.length - 1].T) < 1e-4) continue;
      const dT = 0.05;
      const slope = (diff(Tstar + dT) - diff(Tstar - dT)) / (2 * dT);
      steadyStates.push({
        T: Tstar,
        X: XofT(Tstar),
        Q_kW: GofT(Tstar),
        stable: slope < 0,
        label: slope < 0 ? 'Kararlı' : 'Kararsız',
      });
    }
  }

  return { Ts, Gs, Rs, Xs, steadyStates, hasMultipleSS: steadyStates.length >= 3 };
}

// ---------- 19. Reaksiyon Kinetiği (Series/Parallel, Arrhenius, Michaelis-Menten) ----------

export function solveSeriesParallelKinetics({ mode = 'series', k1 = 0.6, k2 = 0.25, CA0 = 1.0, tMax = 12, n = 160 } = {}) {
  const ts = [], CA = [], CB = [], CC = [];
  let tMaxB = 0, CBmax = 0, halfLifeA = Math.LN2 / Math.max(1e-9, k1);
  let selectivity = k1 / Math.max(1e-9, k2);

  if (mode === 'series') {
    const same = Math.abs(k1 - k2) < 1e-7;
    tMaxB = same ? 1 / k1 : Math.log(k2 / k1) / (k2 - k1);
    CBmax = same ? CA0 / Math.E : CA0 * Math.pow(k1 / k2, k2 / (k2 - k1));
    for (let i = 0; i <= n; i++) {
      const t = (tMax * i) / n;
      const ca = CA0 * Math.exp(-k1 * t);
      const cb = same
        ? CA0 * k1 * t * Math.exp(-k1 * t)
        : CA0 * (k1 / (k2 - k1)) * (Math.exp(-k1 * t) - Math.exp(-k2 * t));
      const cc = Math.max(0, CA0 - ca - cb);
      ts.push(t); CA.push(ca); CB.push(cb); CC.push(cc);
    }
  } else {
    const kTot = k1 + k2;
    halfLifeA = Math.LN2 / Math.max(1e-9, kTot);
    for (let i = 0; i <= n; i++) {
      const t = (tMax * i) / n;
      const ca = CA0 * Math.exp(-kTot * t);
      const cb = CA0 * (k1 / kTot) * (1 - Math.exp(-kTot * t));
      const cc = CA0 * (k2 / kTot) * (1 - Math.exp(-kTot * t));
      ts.push(t); CA.push(ca); CB.push(cb); CC.push(cc);
    }
    CBmax = CA0 * (k1 / (k1 + k2));
    tMaxB = tMax;
  }

  return { mode, ts, CA, CB, CC, tMaxB, CBmax, halfLifeA, selectivity };
}

export function solveArrhenius({ A = 1e10, Ea_kJ = 65, T1_K = 300, T2_K = 350 } = {}) {
  const kAt = T => A * Math.exp(-(Ea_kJ * 1000) / (R_GAS * T));
  const k1 = kAt(T1_K), k2 = kAt(T2_K);
  const Q10 = kAt(T1_K + 10) / k1;
  const invT = [], lnK = [], Ts = [], ks = [];
  for (let i = 0; i <= 80; i++) {
    const T = 260 + (260 * i) / 80; // 260 K to 520 K
    const k = kAt(T);
    Ts.push(T); ks.push(k);
    invT.push(1000 / T);
    lnK.push(Math.log(k));
  }
  return { k1, k2, ratio: k2 / k1, Q10, slope: -(Ea_kJ * 1000) / (R_GAS * 1000), invT, lnK, Ts, ks };
}

export function solveMichaelisMenten({
  Vmax = 10, Km = 2.0, Smax = 15, inhibition = 'none', I = 0, Ki = 2.0,
} = {}) {
  const alpha = 1 + Math.max(0, I) / Math.max(1e-6, Ki);
  let VmaxEff = Vmax, KmEff = Km;
  if (inhibition === 'competitive') { KmEff = alpha * Km; }
  else if (inhibition === 'noncompetitive') { VmaxEff = Vmax / alpha; }
  else if (inhibition === 'uncompetitive') { VmaxEff = Vmax / alpha; KmEff = Km / alpha; }

  const Ss = [], vBase = [], vInh = [];
  for (let i = 0; i <= 100; i++) {
    const S = (Smax * i) / 100;
    Ss.push(S);
    vBase.push((Vmax * S) / (Km + S));
    vInh.push((VmaxEff * S) / (KmEff + S));
  }

  // Lineweaver-Burk 1/v vs 1/S
  const lbX = [], lbBase = [], lbInh = [];
  const xMin = -1.2 / Math.min(Km, KmEff);
  const xMax = 2.5 / Math.min(Km, KmEff);
  for (let i = 0; i <= 80; i++) {
    const invS = xMin + ((xMax - xMin) * i) / 80;
    lbX.push(invS);
    lbBase.push((Km / Vmax) * invS + 1 / Vmax);
    lbInh.push((KmEff / VmaxEff) * invS + 1 / VmaxEff);
  }

  return {
    Vmax, Km, VmaxEff, KmEff, alpha,
    Ss, vBase, vInh,
    lbX, lbBase, lbInh,
    xInterceptBase: -1 / Km, yInterceptBase: 1 / Vmax,
    xInterceptInh: -1 / KmEff, yInterceptInh: 1 / VmaxEff,
  };
}

// ---------- 20. Kimyasal Denge (Le Chatelier / Gibbs) & Asit-Baz Titrasyonu ----------

export const EQ_REACTIONS = {
  haber:    { label: 'Haber–Bosch: N₂ + 3H₂ ⇌ 2NH₃', species: ['N₂', 'H₂', 'NH₃'], nu: [-1, -3, 2], dH_kJ: -92.2, dS_J: -198.7, n0: [1.0, 3.0, 0.2], Tdef: 650, Pdef: 50 },
  n2o4:     { label: 'Azot Oksit: N₂O₄ ⇌ 2NO₂',      species: ['N₂O₄', 'NO₂'],     nu: [-1, 2],     dH_kJ: 57.2,  dS_J: 175.8,  n0: [1.0, 0.2],      Tdef: 320, Pdef: 1.0 },
  hi:       { label: 'Hidrojen İyodür: H₂ + I₂ ⇌ 2HI', species: ['H₂', 'I₂', 'HI'], nu: [-1, -1, 2], dH_kJ: -9.5,  dS_J: 21.8,   n0: [1.0, 1.0, 0.0], Tdef: 700, Pdef: 2.0 },
  methanol: { label: 'Metanol: CO + 2H₂ ⇌ CH₃OH',     species: ['CO', 'H₂', 'CH₃OH'], nu: [-1, -2, 1], dH_kJ: -90.7, dS_J: -220.8, n0: [1.0, 2.0, 0.1], Tdef: 500, Pdef: 40 },
};

export function solveChemicalEquilibrium({ reactionId = 'haber', T_K = 650, P_bar = 50, nInit = null } = {}) {
  const rx = EQ_REACTIONS[reactionId] || EQ_REACTIONS.haber;
  const n0 = (nInit || rx.n0).map(v => Math.max(1e-6, Number(v) || 1e-6));
  const nu = rx.nu;
  const dG_J = rx.dH_kJ * 1000 - T_K * rx.dS_J;
  const lnKp = -dG_J / (R_GAS * T_K);
  const Kp = Math.exp(Math.max(-60, Math.min(60, lnKp)));
  const deltaN = nu.reduce((a, b) => a + b, 0);

  const lnQpAt = xi => {
    let nTot = 0;
    for (let i = 0; i < nu.length; i++) nTot += n0[i] + nu[i] * xi;
    let sum = 0;
    for (let i = 0; i < nu.length; i++) {
      const ni = Math.max(1e-15, n0[i] + nu[i] * xi);
      const pi = (ni / nTot) * P_bar;
      sum += nu[i] * Math.log(pi);
    }
    return sum;
  };

  let xiMin = -Infinity, xiMax = Infinity;
  for (let i = 0; i < nu.length; i++) {
    if (nu[i] > 0) xiMin = Math.max(xiMin, -n0[i] / nu[i]);
    if (nu[i] < 0) xiMax = Math.min(xiMax, -n0[i] / nu[i]);
  }
  const eps = 1e-9 * Math.max(1e-6, xiMax - xiMin);
  const xiEq = bisect(xi => lnQpAt(xi) - lnKp, xiMin + eps, xiMax - eps, 1e-10, 120);

  const nEq = nu.map((v, i) => Math.max(0, n0[i] + v * xiEq));
  const nTotEq = nEq.reduce((a, b) => a + b, 0);
  const yEq = nEq.map(ni => ni / nTotEq);
  const pEq = yEq.map(yi => yi * P_bar);
  const lnQp0 = lnQpAt(0);
  const QpInit = Math.exp(Math.max(-60, Math.min(60, lnQp0)));

  const shiftDir = Math.abs(lnQp0 - lnKp) < 1e-3 ? 'Dengede (Q ≈ K)'
    : lnQp0 < lnKp ? 'İleri (Ürünlere →)' : 'Geri (Reaktanlara ←)';

  return {
    reactionId, label: rx.label, species: rx.species, nu, deltaN,
    dH_kJ: rx.dH_kJ, dS_J: rx.dS_J, dG_kJ: dG_J / 1000,
    Kp, lnKp, QpInit, xiEq, n0, nEq, yEq, pEq, shiftDir,
  };
}

export function pHAtVolume({ mode = 'weak-acid', Ca = 0.1, Va_mL = 50, Cb = 0.1, Vb_mL = 0, pKa = 4.76 } = {}) {
  const Kw = 1e-14;
  const Vtot = Math.max(1e-6, Va_mL + Vb_mL);
  const ca = (Ca * Va_mL) / Vtot;
  const cb = (Cb * Vb_mL) / Vtot;

  if (mode === 'strong-acid') {
    const diff = ca - cb;
    const H = 0.5 * (diff + Math.sqrt(diff * diff + 4 * Kw));
    return -Math.log10(Math.max(1e-16, H));
  }
  if (mode === 'weak-acid') {
    const Ka = Math.pow(10, -pKa);
    // Exact charge balance: [H+] + cb - Kw/[H+] - ca*Ka/([H+] + Ka) = 0 (strictly decreasing in pH)
    return bisect(ph => {
      const H = Math.pow(10, -ph);
      return H + cb - Kw / H - (ca * Ka) / (H + Ka);
    }, -1, 15, 1e-11, 100);
  }
  // Weak base (analyte B with pKb = pKa param -> conjugate acid pKa_conj = 14 - pKb) titrated with strong acid
  const pKaConj = 14 - pKa;
  const Ka = Math.pow(10, -pKaConj);
  // Charge balance: [H+] + [BH+] = [OH-] + [Cl-] where [BH+] = ca * H / (H + Ka), [Cl-] = cb
  return bisect(ph => {
    const H = Math.pow(10, -ph);
    return H + (ca * H) / (H + Ka) - Kw / H - cb;
  }, -1, 15, 1e-11, 100);
}

export function solveTitrationCurve({ mode = 'weak-acid', Ca = 0.1, Va_mL = 50, Cb = 0.1, pKa = 4.76, VbCurrent = 25 } = {}) {
  const Veq = (Ca * Va_mL) / Math.max(1e-6, Cb);
  const Vmax = Veq * 2.0;
  const Vs = [], pHs = [];
  const n = 160;
  for (let i = 0; i <= n; i++) {
    // Cluster extra resolution near equivalence point
    const u = i / n;
    const v = Vmax * u;
    Vs.push(v);
    pHs.push(pHAtVolume({ mode, Ca, Va_mL, Cb, Vb_mL: v, pKa }));
  }
  // Ensure exact Veq point is included cleanly
  const pH0 = pHAtVolume({ mode, Ca, Va_mL, Cb, Vb_mL: 0, pKa });
  const pHHalf = pHAtVolume({ mode, Ca, Va_mL, Cb, Vb_mL: 0.5 * Veq, pKa });
  const pHEq = pHAtVolume({ mode, Ca, Va_mL, Cb, Vb_mL: Veq, pKa });
  const pHCur = pHAtVolume({ mode, Ca, Va_mL, Cb, Vb_mL: VbCurrent, pKa });

  return { mode, Veq, Vmax, Vs, pHs, pH0, pHHalf, pHEq, pHCur, VbCurrent };
}

// ---------- 21. Damıtma (McCabe-Thiele & Raoult T-x-y / P-x-y) ----------

export function solveMcCabeThiele({ alpha = 2.5, zF = 0.5, xD = 0.92, xW = 0.08, q = 1.0, R = 2.0 } = {}) {
  const a = Math.max(1.05, alpha);
  const yEq = x => (a * x) / (1 + (a - 1) * x);
  const xEq = y => y / (a - (a - 1) * y);

  if (!(xW < zF && zF < xD)) {
    return {
      ok: false,
      error: 'Bileşim sıralaması x_W < z_F < x_D olmalıdır!',
      Rmin: 0, Nmin: 0, pinch: { x: zF, y: yEq(zF) },
    };
  }

  // Pinch point: intersection of q-line with equilibrium curve y = yEq(x)
  let xp, yp;
  if (Math.abs(q - 1) < 1e-5) {
    xp = zF;
    yp = yEq(zF);
  } else if (Math.abs(q) < 1e-5) {
    yp = zF;
    xp = xEq(zF);
  } else {
    // q/(q-1) x - zF/(q-1) = a*x / (1 + (a-1)*x)
    const f = x => yEq(x) - ((q * x - zF) / (q - 1));
    // For q > 1, q-line rises steeply from (zF,zF) toward x > zF; for q < 0, rises toward x < zF; for 0<q<1, slopes negative
    const lo = q > 1 ? zF : 0;
    const hi = q > 1 ? 1 : (q < 0 ? zF : zF);
    if (f(lo) * f(hi) <= 0) xp = bisect(f, lo, hi, 1e-10);
    else xp = bisect(f, 0, 1, 1e-10);
    yp = yEq(xp);
  }

  const Rmin = Math.max(0, (xD - yp) / Math.max(1e-9, yp - xp));
  const Nmin = Math.log((xD / (1 - xD)) * ((1 - xW) / xW)) / Math.log(a);

  if (R <= Rmin * 1.001) {
    return {
      ok: false,
      error: `Reflü oranı R = ${R.toFixed(2)}, minimum reflü R_min = ${Rmin.toFixed(2)} değerinden büyük olmalı!`,
      Rmin, Nmin, pinch: { x: xp, y: yp },
    };
  }

  // Rectifying line yR(x) = (R/(R+1)) x + xD/(R+1)
  const yRect = x => (R / (R + 1)) * x + xD / (R + 1);

  // Intersection of rectifying line and q-line: (xI, yI)
  let xI, yI;
  if (Math.abs(q - 1) < 1e-5) {
    xI = zF;
    yI = yRect(zF);
  } else {
    const mR = R / (R + 1), bR = xD / (R + 1);
    const mQ = q / (q - 1), bQ = -zF / (q - 1);
    xI = (bR - bQ) / (mQ - mR);
    yI = yRect(xI);
  }

  // Stripping line passes through (xW, xW) and (xI, yI)
  const mS = (yI - xW) / Math.max(1e-9, xI - xW);
  const yStrip = x => xW + mS * (x - xW);

  // Step off theoretical stages from top (xD, xD) down to xW
  const steps = [{ x: xD, y: xD }];
  let xCur = xD, yCur = xD;
  let stagesExact = 0, feedStage = 1;
  const maxStages = 80;

  for (let s = 1; s <= maxStages; s++) {
    const xNext = xEq(yCur);
    steps.push({ x: xNext, y: yCur });
    if (xNext <= xW + 1e-9) {
      const frac = (xCur - xW) / Math.max(1e-9, xCur - xNext);
      stagesExact = (s - 1) + Math.max(0, Math.min(1, frac));
      steps.push({ x: xNext, y: xNext });
      break;
    }
    const useRect = xNext >= xI;
    if (!useRect && feedStage === 1 && s > 1 && xCur >= xI) feedStage = s;
    const yNext = useRect ? yRect(xNext) : yStrip(xNext);
    steps.push({ x: xNext, y: yNext });
    xCur = xNext;
    yCur = yNext;
    stagesExact = s;
  }

  return {
    ok: true,
    alpha: a, zF, xD, xW, q, R,
    Rmin, Nmin,
    pinch: { x: xp, y: yp },
    intersect: { x: xI, y: yI },
    stagesExact,
    stagesInt: Math.ceil(stagesExact),
    feedStage,
    steps,
    yEq, yRect, yStrip,
  };
}

// Antoine constants: log10(P_kPa) = A - B / (T_C + C)
export const ANTOINE_MIXTURES = {
  'ben-tol': {
    label: 'Benzen – Toluen',
    c1: { name: 'Benzen', A: 6.0305, B: 1211.033, C: 220.79 },
    c2: { name: 'Toluen', A: 6.0795, B: 1344.800, C: 219.48 },
    Tdef: 95, Pdef: 101.325,
  },
  'hex-hep': {
    label: 'n-Hekzan – n-Heptan',
    c1: { name: 'n-Hekzan', A: 6.0027, B: 1171.530, C: 224.366 },
    c2: { name: 'n-Heptan', A: 6.0217, B: 1264.370, C: 216.640 },
    Tdef: 82, Pdef: 101.325,
  },
  'meoh-etoh': {
    label: 'Metanol – Etanol',
    c1: { name: 'Metanol', A: 7.2058, B: 1582.271, C: 239.726 },
    c2: { name: 'Etanol',  A: 7.2422, B: 1595.811, C: 226.184 },
    Tdef: 72, Pdef: 101.325,
  },
};

export function antoinePsat_kPa(comp, T_C) {
  return Math.pow(10, comp.A - comp.B / (T_C + comp.C));
}

export function antoineTboil_C(comp, P_kPa) {
  return comp.B / (comp.A - Math.log10(Math.max(1e-4, P_kPa))) - comp.C;
}

export function solveRaoultDiagrams({ mixtureId = 'ben-tol', T_C = 95, P_kPa = 101.325 } = {}) {
  const mix = ANTOINE_MIXTURES[mixtureId] || ANTOINE_MIXTURES['ben-tol'];
  const P1 = antoinePsat_kPa(mix.c1, T_C);
  const P2 = antoinePsat_kPa(mix.c2, T_C);
  const Tb1 = antoineTboil_C(mix.c1, P_kPa);
  const Tb2 = antoineTboil_C(mix.c2, P_kPa);

  const n = 60;
  const xs = [], Pxy_P = [], Pxy_y = [], Txy_T = [], Txy_y = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    xs.push(x);
    // P-x-y at constant T_C
    const Pbub = x * P1 + (1 - x) * P2;
    Pxy_P.push(Pbub);
    Pxy_y.push((x * P1) / Pbub);

    // T-x-y at constant P_kPa
    const Tbub = bisect(T => x * antoinePsat_kPa(mix.c1, T) + (1 - x) * antoinePsat_kPa(mix.c2, T) - P_kPa,
      Math.min(Tb1, Tb2) - 5, Math.max(Tb1, Tb2) + 5, 1e-8);
    Txy_T.push(Tbub);
    Txy_y.push((x * antoinePsat_kPa(mix.c1, Tbub)) / P_kPa);
  }
  const alphaAvg = P1 / P2;
  return { mixtureId, mix, T_C, P_kPa, P1, P2, Tb1, Tb2, alphaAvg, xs, Pxy_P, Pxy_y, Txy_T, Txy_y };
}

// ---------- 22. Kütle Transferi (Film Diffusion, Gas Absorption, LLE Ternary) ----------

export function solveFilmDiffusion({ DAB_cm2s = 0.25, C_molm3 = 40.9, delta_mm = 2.0, xA1 = 0.6, xA2 = 0.05 } = {}) {
  const DAB = DAB_cm2s * 1e-4; // m^2/s
  const delta = Math.max(0.05, delta_mm) * 1e-3; // m
  const kMass = (DAB * C_molm3) / delta;
  const x1 = Math.max(0, Math.min(0.95, xA1));
  const x2 = Math.max(0, Math.min(0.95, xA2));

  const NA_equimolar = kMass * (x1 - x2);
  const NA_stagnant = kMass * Math.log((1 - x2) / (1 - x1));
  const driftFactor = Math.abs(NA_equimolar) > 1e-12 ? NA_stagnant / NA_equimolar : 1;

  const xi = [], xEq = [], xSt = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    xi.push(u);
    xEq.push(x1 + (x2 - x1) * u);
    xSt.push(1 - (1 - x1) * Math.pow((1 - x2) / (1 - x1), u));
  }
  return { NA_equimolar, NA_stagnant, driftFactor, xi, xEq, xSt };
}

export function solveGasAbsorption({ m = 1.2, Gs = 100, Ls = 180, Yin = 0.08, Yout = 0.008, Xin = 0.0 } = {}) {
  const ratioLG = Ls / Math.max(1e-6, Gs);
  if (Yout >= Yin) {
    return { ok: false, error: 'Hedef çıkış Y_out, giriş Y_in değerinden küçük olmalıdır!', ratioLG, minLG: 0, A: ratioLG / m };
  }
  const Xmax = Yin / Math.max(1e-6, m);
  const minLG = (Yin - Yout) / Math.max(1e-9, Xmax - Xin);

  if (ratioLG <= minLG * 1.001) {
    return {
      ok: false,
      error: `L/G = ${ratioLG.toFixed(2)}, minimum (L/G)_min = ${minLG.toFixed(2)} değerinden büyük olmalı!`,
      ratioLG, minLG, A: ratioLG / m,
    };
  }

  const Xout = Xin + (Gs / Ls) * (Yin - Yout);
  const A = Ls / (m * Gs);
  const removalPct = ((Yin - Yout) / Math.max(1e-9, Yin)) * 100;

  // Exact Kremser equation for linear Y* = m X
  let N_kremser;
  const term = (Yin - m * Xin) / Math.max(1e-12, Yout - m * Xin);
  if (Math.abs(A - 1) < 1e-5) {
    N_kremser = (Yin - Yout) / Math.max(1e-12, Yout - m * Xin);
  } else {
    N_kremser = Math.log(term * (1 - 1 / A) + 1 / A) / Math.log(A);
  }

  // Graphical staircase from bottom (Xout, Yin) or top (Xin, Yout)
  const steps = [{ X: Xin, Y: Yout }];
  let Xc = Xin, Yc = Yout;
  for (let s = 0; s < 60 && Yc < Yin - 1e-9; s++) {
    const Xeq = Yc / m;
    steps.push({ X: Xeq, Y: Yc });
    const Yop = Yout + ratioLG * (Xeq - Xin);
    if (Yop >= Yin) {
      steps.push({ X: Xeq, Y: Yin });
      break;
    }
    steps.push({ X: Xeq, Y: Yop });
    Xc = Xeq; Yc = Yop;
  }
  void Xc;

  return {
    ok: true, m, Gs, Ls, Yin, Yout, Xin, Xout, ratioLG, minLG, A,
    removalPct, N_kremser, N_int: Math.ceil(N_kremser), steps,
  };
}

export function solveLLETernary({ xBF = 0.30, SoverF = 1.0, F = 100, plaitB = 0.44 } = {}) {
  const xB_feed = Math.max(0.02, Math.min(0.65, xBF));
  const xA_feed = 1 - xB_feed;
  const xS_feed = 0;

  const S = Math.max(0.05, SoverF) * F;
  const M_mass = F + S;
  const M = { xA: (F * xA_feed) / M_mass, xB: (F * xB_feed) / M_mass, xS: S / M_mass };

  // Smooth binodal dome xB_bin(xS) over xS in [sL, sR]
  const sL = 0.03, sR = 0.96, sPeak = 0.45;
  const binodalB = xS => {
    if (xS <= sL || xS >= sR) return 0;
    const u = (xS - sL) / (sR - sL);
    return plaitB * 4 * u * (1 - u) * (0.9 + 0.2 * (1 - u));
  };
  // Tie-line endpoints parameterized by h in [0, 1] (h=0 at base, h=1 at plait point)
  const tieEndpoints = h => {
    const hc = Math.max(0, Math.min(1, h));
    const sRaff = sL + (sPeak - sL) * Math.pow(hc, 0.95);
    const sExt = sR - (sR - sPeak) * Math.pow(hc, 1.05);
    // Slight preferential distribution into solvent (extract sits slightly higher in B for h<1)
    const bRaff = binodalB(sRaff) * (0.88 + 0.12 * hc);
    const bExt = Math.min(1 - sExt - 0.01, binodalB(sExt) * (1.06 - 0.06 * hc));
    const R = { xA: Math.max(0, 1 - bRaff - sRaff), xB: bRaff, xS: sRaff };
    const E = { xA: Math.max(0, 1 - bExt - sExt), xB: bExt, xS: sExt };
    return { R, E };
  };

  // Sample binodal curve
  const binodal = [];
  for (let i = 0; i <= 60; i++) {
    const xS = sL + ((sR - sL) * i) / 60;
    const xB = binodalB(xS);
    binodal.push({ xA: Math.max(0, 1 - xB - xS), xB, xS });
  }
  const tieLines = [0.15, 0.35, 0.55, 0.75, 0.90].map(h => tieEndpoints(h));

  // Check if M is inside two-phase region
  const bMaxAtM = binodalB(M.xS);
  const inTwoPhase = M.xS > sL && M.xS < sR && M.xB < bMaxAtM * 0.99;

  if (!inTwoPhase) {
    return {
      inTwoPhase: false, F, S, M_mass,
      feed: { xA: xA_feed, xB: xB_feed, xS: xS_feed },
      M, binodal, tieLines,
      R: null, E: null, F_R: M_mass, F_E: 0, recoveryPct: 0,
    };
  }

  // Solve h so line R(h)-E(h) passes through M: interpolated xB at M.xS equals M.xB
  const yOnTieAtMs = h => {
    const { R, E } = tieEndpoints(h);
    const frac = (M.xS - R.xS) / Math.max(1e-9, E.xS - R.xS);
    return R.xB + frac * (E.xB - R.xB);
  };
  const hSol = bisect(h => yOnTieAtMs(h) - M.xB, 0.001, 0.999, 1e-8);
  const { R, E } = tieEndpoints(hSol);
  const fracE = Math.max(0, Math.min(1, (M.xS - R.xS) / Math.max(1e-9, E.xS - R.xS)));
  const F_E = M_mass * fracE;
  const F_R = M_mass - F_E;
  const recoveryPct = ((F_E * E.xB) / Math.max(1e-9, F * xB_feed)) * 100;
  const KD = E.xB / Math.max(1e-9, R.xB);

  return {
    inTwoPhase: true, F, S, M_mass,
    feed: { xA: xA_feed, xB: xB_feed, xS: xS_feed },
    M, R, E, F_R, F_E, recoveryPct, KD,
    binodal, tieLines,
  };
}

// ---------- 23. Kütle & Enerji Dengesi (Flowsheet with Recycle & Purge) ----------

export function solveProcessFlowsheet({
  F0 = 100,        // mol/s fresh feed
  yI0 = 0.05,      // inert mole fraction in fresh feed
  Xsp = 0.35,      // single-pass conversion of A -> B
  sepEff = 0.95,   // separator recovery of B to product stream
  fPurge = 0.10,   // purge split fraction of separator overhead gas
  dH_kJ = -45,     // reaction enthalpy kJ/mol
  Cp_kJ = 0.045,   // mean molar Cp kJ/(mol·K)
  T0_C = 25,
  TR_C = 220,
} = {}) {
  const yI = Math.max(0, Math.min(0.5, yI0));
  const yA = 1 - yI;
  const xsp = Math.max(0.02, Math.min(0.99, Xsp));
  const etaB = Math.max(0.5, Math.min(1.0, sepEff));
  const fp = Math.max(yI > 0 ? 0.005 : 0.0, Math.min(1.0, fPurge));
  const r = 1 - fp;

  const F0_A = F0 * yA;
  const F0_I = F0 * yI;

  // Exact steady-state molar balances
  const S1_A = F0_A / (1 - r * (1 - xsp));
  const reactedA = xsp * S1_A;
  const S2_A = (1 - xsp) * S1_A;
  const W_A = fp * S2_A;
  const R_A = r * S2_A;

  const S1_I = yI > 0 ? F0_I / fp : 0;
  const S2_I = S1_I;
  const W_I = F0_I;
  const R_I = yI > 0 ? (r / fp) * F0_I : 0;

  const S2_B = reactedA / (1 - r * (1 - etaB));
  const P_B = etaB * S2_B;
  const S3_B = (1 - etaB) * S2_B;
  const W_B = fp * S3_B;
  const R_B = r * S3_B;
  const S1_B = R_B;

  const makeStream = (id, name, A, B, I) => {
    const total = A + B + I;
    return {
      id, name, A, B, I, total,
      yA: total > 0 ? A / total : 0,
      yB: total > 0 ? B / total : 0,
      yI: total > 0 ? I / total : 0,
    };
  };

  const streams = {
    fresh:      makeStream('F0', 'Taze Besleme', F0_A, 0, F0_I),
    reactorIn:  makeStream('S1', 'Reaktör Girişi', S1_A, S1_B, S1_I),
    reactorOut: makeStream('S2', 'Reaktör Çıkışı', S2_A, S2_B, S2_I),
    product:    makeStream('P',  'Ürün Akımı', 0, P_B, 0),
    overhead:   makeStream('S3', 'Ayırıcı Gazı', S2_A, S3_B, S2_I),
    purge:      makeStream('W',  'Blöf (Purge)', W_A, W_B, W_I),
    recycle:    makeStream('R',  'Geri Döngü', R_A, R_B, R_I),
  };

  const Xoverall = reactedA / F0_A;
  const recycleRatio = streams.recycle.total / F0;
  const inertInLoopPct = streams.reactorIn.yI * 100;
  const Q_sensible_kW = streams.reactorIn.total * Cp_kJ * (TR_C - T0_C);
  const Q_rxn_kW = reactedA * dH_kJ;
  const Q_total_kW = Q_sensible_kW + Q_rxn_kW;
  const molarClosureErr = Math.abs(streams.fresh.total - (streams.product.total + streams.purge.total));

  return {
    streams,
    reactedA,
    Xsp: xsp,
    Xoverall,
    recycleRatio,
    inertInLoopPct,
    Q_sensible_kW, Q_rxn_kW, Q_total_kW,
    molarClosureErr,
  };
}

// ---------- 24. Akışkan Yatak (Ergun) & Çökelme Hızı (Stokes/Intermediate/Newton) ----------

export function dragCoeffSphere(Re) {
  if (Re <= 1e-6) return 24 / Math.max(1e-12, Re);
  if (Re <= 1000) return (24 / Re) * (1 + 0.15 * Math.pow(Re, 0.687)); // Schiller-Naumann
  return 0.44; // Newton regime
}

export function solveSettlingVelocity({ dp_mm = 0.5, rhoP = 2650, rhoF = 1000, mu_mPas = 1.0 } = {}) {
  const dp = Math.max(1e-4, dp_mm) * 1e-3; // m
  const mu = Math.max(1e-5, mu_mPas) * 1e-3; // Pa·s
  const dRho = Math.max(1, rhoP - rhoF);

  const uStokes = (G0 * dp * dp * dRho) / (18 * mu);
  const Ar = (dp ** 3 * rhoF * dRho * G0) / (mu * mu);

  // Force balance: 4/3 * dp * dRho * g = CD(Re) * rhoF * u^2
  const rhs = (4 / 3) * dp * dRho * G0;
  const f = lnU => {
    const u = Math.exp(lnU);
    const Re = (rhoF * u * dp) / mu;
    return dragCoeffSphere(Re) * rhoF * u * u - rhs;
  };
  const lnUt = bisect(f, Math.log(1e-9), Math.log(1e3), 1e-10, 100);
  const ut = Math.exp(lnUt);
  const ReP = (rhoF * ut * dp) / mu;
  const CD = dragCoeffSphere(ReP);
  const regime = ReP < 0.1 ? 'Stokes (Laminer)' : ReP <= 1000 ? 'Ara Rejim (Schiller–Naumann)' : 'Newton (Türbülanslı)';

  // Transient settling v(t) via RK4
  const tauEst = Math.max(1e-4, (ut * rhoP) / (dRho * G0));
  const tEnd = Math.min(20, Math.max(0.05, 5.5 * tauEst));
  const n = 100, dt = tEnd / n;
  const dvDt = v => {
    const Re = (rhoF * Math.abs(v) * dp) / mu;
    const drag = v > 1e-12 ? (0.75 * rhoF * dragCoeffSphere(Re) * v * v) / (rhoP * dp) : 0;
    return (dRho / rhoP) * G0 - drag;
  };
  const ts = [0], vs = [0];
  let v = 0;
  for (let i = 1; i <= n; i++) {
    const k1 = dvDt(v);
    const k2 = dvDt(v + 0.5 * dt * k1);
    const k3 = dvDt(v + 0.5 * dt * k2);
    const k4 = dvDt(v + dt * k3);
    v = Math.min(ut, v + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    ts.push(i * dt); vs.push(v);
  }

  return { dp_mm, uStokes, ut, ReP, CD, Ar, regime, ratioToStokes: ut / uStokes, ts, vs, tEnd };
}

export function solveErgunAndFluidization({
  dp_mm = 0.8, rhoP = 2600, rhoF = 1.2, mu_mPas = 0.0185, eps = 0.42, L_m = 1.2, u0 = 0.4,
} = {}) {
  const dp = Math.max(0.01, dp_mm) * 1e-3;
  const mu = Math.max(1e-5, mu_mPas) * 1e-3;
  const dRho = Math.max(1, rhoP - rhoF);

  const Aergun = (150 * mu * (1 - eps) ** 2) / (eps ** 3 * dp * dp);
  const Bergun = (1.75 * rhoF * (1 - eps)) / (eps ** 3 * dp);

  const dPperL_ergun = u => Aergun * u + Bergun * u * u;
  const dPperL_mf = (1 - eps) * dRho * G0;
  const dP_mf_Pa = dPperL_mf * L_m;

  // Solve Bergun * u_mf^2 + Aergun * u_mf - dPperL_mf = 0
  const umf = (-Aergun + Math.sqrt(Aergun * Aergun + 4 * Bergun * dPperL_mf)) / (2 * Bergun);
  const Re_mf = (rhoF * umf * dp) / mu;
  const Ar = (dp ** 3 * rhoF * dRho * G0) / (mu * mu);

  const settling = solveSettlingVelocity({ dp_mm, rhoP, rhoF, mu_mPas });
  const ut = settling.ut;

  const dP_ergun_Pa = dPperL_ergun(u0) * L_m;
  const viscousPart_Pa = Aergun * u0 * L_m;
  const inertialPart_Pa = Bergun * u0 * u0 * L_m;
  const dP_actual_Pa = u0 <= umf ? dP_ergun_Pa : dP_mf_Pa;
  const Re_bed = (rhoF * u0 * dp) / (mu * (1 - eps));

  const regime = u0 < umf * 0.99 ? 'Sabit (Dolgulu) Yatak'
    : u0 < ut ? 'Akışkan Yatak' : 'Pnömatik Taşıma (Sürüklenme)';

  // Log-spaced pressure drop curve vs superficial velocity
  const uMin = Math.max(1e-5, umf * 0.05);
  const uMax = Math.max(ut * 1.3, u0 * 1.4, umf * 5);
  const uCurve = [], dpCurvePa = [];
  for (let i = 0; i <= 90; i++) {
    const u = uMin * Math.pow(uMax / uMin, i / 90);
    uCurve.push(u);
    dpCurvePa.push(u <= umf ? dPperL_ergun(u) * L_m : dP_mf_Pa);
  }

  return {
    Aergun, Bergun, umf, ut, Re_mf, Re_bed, Ar,
    dP_ergun_Pa, dP_mf_Pa, dP_actual_Pa,
    viscousPart_Pa, inertialPart_Pa,
    regime, uRatio: u0 / umf,
    uCurve, dpCurvePa,
  };
}

// ---------- 25. Gaz Yasaları (İdeal, van der Waals, Peng-Robinson EOS) ----------

export const EOS_GASES = {
  CO2: { name: 'Karbondioksit (CO₂)', Tc: 304.13, Pc_bar: 73.77, omega: 0.2239, M: 44.01 },
  CH4: { name: 'Metan (CH₄)',         Tc: 190.56, Pc_bar: 45.99, omega: 0.0114, M: 16.04 },
  N2:  { name: 'Azot (N₂)',           Tc: 126.19, Pc_bar: 33.96, omega: 0.0372, M: 28.01 },
  H2O: { name: 'Su Buharı (H₂O)',     Tc: 647.10, Pc_bar: 220.64, omega: 0.3443, M: 18.02 },
  NH3: { name: 'Amonyak (NH₃)',       Tc: 405.40, Pc_bar: 113.33, omega: 0.2560, M: 17.03 },
};

export function eosParams(gasId = 'CO2', T_K = 310) {
  const g = EOS_GASES[gasId] || EOS_GASES.CO2;
  const Tc = g.Tc;
  const Pc = g.Pc_bar * 1e5; // Pa
  const Tr = T_K / Tc;

  // van der Waals
  const aVdW = (27 * R_GAS * R_GAS * Tc * Tc) / (64 * Pc);
  const bVdW = (R_GAS * Tc) / (8 * Pc);

  // Peng-Robinson
  const kappa = 0.37464 + 1.54226 * g.omega - 0.26992 * g.omega * g.omega;
  const alphaPR = Math.pow(1 + kappa * (1 - Math.sqrt(Math.max(0.05, Tr))), 2);
  const aPR = 0.45723553 * ((R_GAS * R_GAS * Tc * Tc) / Pc) * alphaPR;
  const bPR = 0.07779607 * ((R_GAS * Tc) / Pc);

  return { gas: g, Tc, Pc, Pc_bar: g.Pc_bar, Tr, aVdW, bVdW, aPR, bPR, alphaPR, Vc_vdW_Lmol: 3 * bVdW * 1000 };
}

export function solveEOS({ gasId = 'CO2', T_K = 310, P_bar = 60 } = {}) {
  const p = eosParams(gasId, T_K);
  const P = Math.max(0.01, P_bar) * 1e5; // Pa
  const RT = R_GAS * T_K;
  const Pr = P_bar / p.Pc_bar;

  // Ideal gas
  const V_ideal_Lmol = (RT / P) * 1000;

  // van der Waals cubic: Z^3 - (1+B)Z^2 + A Z - A B = 0
  const Av = (p.aVdW * P) / (RT * RT);
  const Bv = (p.bVdW * P) / RT;
  const rootsV = solveCubicReal(1, -(1 + Bv), Av, -Av * Bv).filter(z => z > Bv * 1.0001);
  const fugVdW = z => (z - 1) - Math.log(Math.max(1e-12, z - Bv)) - Av / z;
  const Z_vdW = rootsV.length > 1 ? (fugVdW(rootsV[0]) < fugVdW(rootsV[rootsV.length - 1]) ? rootsV[0] : rootsV[rootsV.length - 1]) : (rootsV[0] ?? 1);
  const V_vdW_Lmol = ((Z_vdW * RT) / P) * 1000;

  // Peng-Robinson cubic: Z^3 - (1-B)Z^2 + (A - 3B^2 - 2B)Z - (AB - B^2 - B^3) = 0
  const Ap = (p.aPR * P) / (RT * RT);
  const Bp = (p.bPR * P) / RT;
  const rootsP = solveCubicReal(1, -(1 - Bp), Ap - 3 * Bp * Bp - 2 * Bp, -(Ap * Bp - Bp * Bp - Bp * Bp * Bp)).filter(z => z > Bp * 1.0001);
  const sq2 = Math.SQRT2;
  const fugPR = z => (z - 1) - Math.log(Math.max(1e-12, z - Bp))
    - (Ap / (2 * sq2 * Bp)) * Math.log(Math.max(1e-12, (z + (1 + sq2) * Bp) / (z + (1 - sq2) * Bp)));
  const Z_PR = rootsP.length > 1 ? (fugPR(rootsP[0]) < fugPR(rootsP[rootsP.length - 1]) ? rootsP[0] : rootsP[rootsP.length - 1]) : (rootsP[0] ?? 1);
  const V_PR_Lmol = ((Z_PR * RT) / P) * 1000;

  const phasePR = p.Tr >= 1 ? (Pr >= 1 ? 'Süperkritik Akışkan' : 'Süperkritik Gaz')
    : (rootsP.length >= 3 ? (Z_PR === rootsP[0] ? 'Sıvı (Denge)' : 'Buhar (Denge)') : (Z_PR < 0.35 ? 'Sıkıştırılmış Sıvı' : 'Buhar'));

  return {
    gasId, name: p.gas.name, T_K, P_bar, Tr: p.Tr, Pr, Tc: p.Tc, Pc_bar: p.Pc_bar,
    Z_ideal: 1, V_ideal_Lmol,
    Z_vdW, V_vdW_Lmol, rootsVdW: rootsV,
    Z_PR, V_PR_Lmol, rootsPR: rootsP,
    phasePR,
    devPR_pct: (Z_PR - 1) * 100,
    params: p,
  };
}

export function eosIsotherm({ gasId = 'CO2', T_K = 310, nPts = 120 } = {}) {
  const p = eosParams(gasId, T_K);
  const RT = R_GAS * T_K;
  const vMin = Math.max(p.bVdW, p.bPR) * 1.18;
  const vMax = p.bVdW * 18;
  const Vs_Lmol = [], P_ideal = [], P_vdW = [], P_PR = [];
  for (let i = 0; i < nPts; i++) {
    const vm = vMin * Math.pow(vMax / vMin, i / (nPts - 1)); // log-spaced for crisp critical region
    Vs_Lmol.push(vm * 1000);
    P_ideal.push((RT / vm) * 1e-5);
    P_vdW.push((RT / (vm - p.bVdW) - p.aVdW / (vm * vm)) * 1e-5);
    P_PR.push((RT / (vm - p.bPR) - p.aPR / (vm * (vm + p.bPR) + p.bPR * (vm - p.bPR))) * 1e-5);
  }
  return { Vs_Lmol, P_ideal, P_vdW, P_PR, params: p };
}
