// Pure computation engine for MathPad Engineering Simulation Center — Part 1 (EEE + Kontrol & Sinyal).
// Zero DOM access, zero external imports, zero global dependencies (runs in Node tests and browsers).

export const KB = 1.380649e-23;        // Boltzmann constant (J/K)
export const QE = 1.602176634e-19;     // Elementary charge (C)
export const KE = 8.9875517923e9;      // Coulomb constant (N·m²/C²)
export const MU0 = 4e-7 * Math.PI;     // Vacuum permeability (T·m/A)
export const G_ACC = 9.81;             // Standard gravity (m/s²)

// =====================================================================
// SHARED MATH PRIMITIVES (Complex, Polynomial, Linear Algebra, RK4, FFT)
// =====================================================================

export const C = (re, im = 0) => ({ re, im });
export const cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cDiv = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  if (d < 1e-30) return { re: NaN, im: NaN };
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cScale = (a, s) => ({ re: a.re * s, im: a.im * s });
export const cConj = a => ({ re: a.re, im: -a.im });
export const cAbs = a => Math.hypot(a.re, a.im);
export const cArg = a => Math.atan2(a.im, a.re);
export const cPolar = (r, rad) => ({ re: r * Math.cos(rad), im: r * Math.sin(rad) });
export const cExp = a => {
  const er = Math.exp(a.re);
  return { re: er * Math.cos(a.im), im: er * Math.sin(a.im) };
};
export const cSqrt = a => {
  const r = Math.hypot(a.re, a.im);
  const re = Math.sqrt(Math.max(0, (r + a.re) / 2));
  const im = Math.sqrt(Math.max(0, (r - a.re) / 2)) * (a.im < 0 ? -1 : 1);
  return { re, im };
};
export const cTanh = z => {
  const e2 = cExp(cScale(z, 2));
  return cDiv(cSub(e2, C(1)), cAdd(e2, C(1)));
};

// Polynomial helpers: descending powers [a_n, a_{n-1}, ..., a_0]
export function polyTrim(p) {
  let i = 0;
  while (i < p.length - 1 && Math.abs(p[i]) < 1e-14) i++;
  return p.slice(i);
}

export function polyMul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

export function polyAdd(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Array(n).fill(0);
  for (let i = 0; i < a.length; i++) out[n - a.length + i] += a[i];
  for (let i = 0; i < b.length; i++) out[n - b.length + i] += b[i];
  return out;
}

export function polyScale(a, k) {
  return a.map(v => v * k);
}

export function polyDeriv(a) {
  if (a.length <= 1) return [0];
  const n = a.length - 1;
  return a.slice(0, -1).map((c, i) => c * (n - i));
}

export function polyFromRoots(roots) {
  // roots: array of {re, im}; returns real polynomial coeffs (imaginary part discarded when conjugate pairs)
  let p = [C(1, 0)];
  for (const r of roots) {
    const next = new Array(p.length + 1).fill(null).map(() => C(0, 0));
    for (let i = 0; i < p.length; i++) {
      next[i] = cAdd(next[i], p[i]);
      next[i + 1] = cSub(next[i + 1], cMul(p[i], r));
    }
    p = next;
  }
  return p.map(z => (Math.abs(z.re) < 1e-14 ? 0 : z.re));
}

export function polyEvalC(coeffs, z) {
  let acc = C(0, 0);
  for (let i = 0; i < coeffs.length; i++) {
    acc = cAdd(cMul(acc, z), C(coeffs[i], 0));
  }
  return acc;
}

export function polyEvalDerivC(coeffs, z) {
  let val = C(0, 0);
  let der = C(0, 0);
  for (let i = 0; i < coeffs.length; i++) {
    der = cAdd(cMul(der, z), val);
    val = cAdd(cMul(val, z), C(coeffs[i], 0));
  }
  return { val, der };
}

/**
 * Find all complex roots of a real polynomial (descending powers) via Aberth-Ehrlich iteration.
 */
export function polyRoots(rawCoeffs) {
  const c = polyTrim(rawCoeffs);
  const n = c.length - 1;
  if (n <= 0) return [];
  const lead = c[0];
  const a = c.map(v => v / lead);
  if (n === 1) return [C(-a[1], 0)];
  if (n === 2) {
    const disc = a[1] * a[1] - 4 * a[2];
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      return [C((-a[1] + s) / 2, 0), C((-a[1] - s) / 2, 0)];
    }
    const s = Math.sqrt(-disc);
    return [C(-a[1] / 2, s / 2), C(-a[1] / 2, -s / 2)];
  }

  // Factor out roots at 0 cleanly
  let zCount = 0;
  let end = a.length - 1;
  while (end > 0 && Math.abs(a[end]) < 1e-15) { zCount++; end--; }
  const rootsOut = Array.from({ length: zCount }, () => C(0, 0));
  const p = a.slice(0, end + 1);
  const deg = p.length - 1;
  if (deg <= 2) return rootsOut.concat(polyRoots(p));

  // Cauchy upper bound for root radius
  let maxC = 0;
  for (let i = 1; i <= deg; i++) maxC = Math.max(maxC, Math.abs(p[i]));
  const radius = Math.max(0.5, 1 + maxC);
  const center = -p[1] / deg;

  const z = Array.from({ length: deg }, (_, k) => {
    const ang = (2 * Math.PI * k) / deg + 0.173;
    const r = radius * (0.85 + 0.3 * ((k % 3) / 2));
    return C(center + r * Math.cos(ang), r * Math.sin(ang));
  });

  for (let iter = 0; iter < 120; iter++) {
    let maxStep = 0;
    for (let i = 0; i < deg; i++) {
      const { val, der } = polyEvalDerivC(p, z[i]);
      const vAbs = cAbs(val);
      if (vAbs < 1e-14) continue;
      let sum = C(0, 0);
      for (let j = 0; j < deg; j++) {
        if (j === i) continue;
        const diff = cSub(z[i], z[j]);
        if (cAbs(diff) > 1e-15) sum = cAdd(sum, cDiv(C(1, 0), diff));
      }
      const wDen = cSub(der, cMul(val, sum));
      const w = cAbs(wDen) > 1e-18 ? cDiv(val, wDen) : cScale(val, 1e-3);
      z[i] = cSub(z[i], w);
      maxStep = Math.max(maxStep, cAbs(w));
    }
    if (maxStep < 1e-12) break;
  }

  for (const r of z) {
    rootsOut.push(C(Math.abs(r.re) < 1e-12 ? 0 : r.re, Math.abs(r.im) < 1e-10 ? 0 : r.im));
  }
  return rootsOut;
}

// Small real matrix algebra
export function matZeros(r, c) {
  return Array.from({ length: r }, () => new Array(c).fill(0));
}
export function matEye(n) {
  const M = matZeros(n, n);
  for (let i = 0; i < n; i++) M[i][i] = 1;
  return M;
}
export function matMul(A, B) {
  const r = A.length, k = A[0].length, c = B[0].length;
  const M = matZeros(r, c);
  for (let i = 0; i < r; i++) {
    for (let t = 0; t < k; t++) {
      const a = A[i][t];
      if (a === 0) continue;
      for (let j = 0; j < c; j++) M[i][j] += a * B[t][j];
    }
  }
  return M;
}
export function matAdd(A, B) {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}
export function matSub(A, B) {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}
export function matScale(A, s) {
  return A.map(row => row.map(v => v * s));
}
export function matT(A) {
  const r = A.length, c = A[0].length;
  const T = matZeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = A[i][j];
  return T;
}

export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-15) return null;
    if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

export function matInv(A) {
  const n = A.length;
  const M = A.map((row, i) => {
    const ext = new Array(n).fill(0);
    ext[i] = 1;
    return [...row, ...ext];
  });
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = col; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = col; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row.slice(n));
}

export function matDet(A) {
  const n = A.length;
  const M = A.map(row => row.slice());
  let det = 1;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-15) return 0;
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; det = -det; }
    det *= M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let j = col + 1; j < n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return det;
}

export function matRank(A, tol = 1e-9) {
  const rows = A.length, cols = A[0].length;
  const M = A.map(r => r.slice());
  let maxAbs = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) maxAbs = Math.max(maxAbs, Math.abs(M[i][j]));
  const eps = tol * Math.max(1, maxAbs);
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let piv = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
    if (Math.abs(M[piv][c]) <= eps) continue;
    [M[r], M[piv]] = [M[piv], M[r]];
    const d = M[r][c];
    for (let j = c; j < cols; j++) M[r][j] /= d;
    for (let i = r + 1; i < rows; i++) {
      const f = M[i][c];
      for (let j = c; j < cols; j++) M[i][j] -= f * M[r][j];
    }
    r++;
  }
  return r;
}

// Characteristic polynomial of a 4x4 matrix via Faddeev-LeVerrier
export function matCharPoly(A) {
  const n = A.length;
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  let M = matZeros(n, n);
  const I = matEye(n);
  for (let k = 1; k <= n; k++) {
    const AM = k === 1 ? A : matMul(A, M);
    let tr = 0;
    for (let i = 0; i < n; i++) tr += AM[i][i];
    c[k] = -tr / k;
    M = matAdd(AM, matScale(I, c[k]));
  }
  return c;
}

// Fixed-step RK4 integrator for vector state y
export function rk4Step(f, t, y, dt) {
  const n = y.length;
  const k1 = f(t, y);
  const y2 = new Array(n);
  for (let i = 0; i < n; i++) y2[i] = y[i] + 0.5 * dt * k1[i];
  const k2 = f(t + 0.5 * dt, y2);
  const y3 = new Array(n);
  for (let i = 0; i < n; i++) y3[i] = y[i] + 0.5 * dt * k2[i];
  const k3 = f(t + 0.5 * dt, y3);
  const y4 = new Array(n);
  for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i];
  const k4 = f(t + dt, y4);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = y[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

// Radix-2 Cooley-Tukey FFT (returns { re, im } arrays of length N, power of 2)
export function fft(reIn, imIn = null, inverse = false) {
  const N = reIn.length;
  if ((N & (N - 1)) !== 0 || N === 0) throw new Error('FFT boyutu 2\'nin kuvveti olmalı.');
  const re = Float64Array.from(reIn);
  const im = imIn ? Float64Array.from(imIn) : new Float64Array(N);

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cRe = 1, cIm = 0;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + half] * cRe - im[i + j + half] * cIm;
        const vIm = re[i + j + half] * cIm + im[i + j + half] * cRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }
  return { re: Array.from(re), im: Array.from(im) };
}

export function windowWeights(type, N) {
  const w = new Array(N);
  const denom = Math.max(1, N - 1);
  for (let n = 0; n < N; n++) {
    const x = (2 * Math.PI * n) / denom;
    if (type === 'hann') w[n] = 0.5 * (1 - Math.cos(x));
    else if (type === 'hamming') w[n] = 0.54 - 0.46 * Math.cos(x);
    else if (type === 'blackman') w[n] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
    else w[n] = 1;
  }
  return w;
}

// Special functions for BER (Abramowitz & Stegun 7.1.26, max error < 1.5e-7)
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = poly * Math.exp(-z * z);
  return x >= 0 ? r : 2 - r;
}

export function qFunc(x) {
  return 0.5 * erfc(x / Math.SQRT2);
}

// Seeded Mulberry32 PRNG + Box-Muller Gaussian
export function makeRng(seed = 123456789) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const randn = () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0;
    while (u < 1e-12) u = next();
    v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * v;
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
  return { next, randn };
}

// =====================================================================
// 1. DİYOT & DOĞRULTUCU (Shockley I-V, Rectifier+Filter, Zener)
// =====================================================================

export function thermalVoltage(tempC = 25) {
  return (KB * (tempC + 273.15)) / QE;
}

export function diodeJunctionCurrent(vj, { Is = 1e-12, n = 1.5, tempC = 25, Vbr = 50 } = {}) {
  const Vt = thermalVoltage(tempC);
  const expArg = Math.min(80, vj / (n * Vt));
  const iFwd = Is * (Math.exp(expArg) - 1);
  let iBr = 0;
  if (Vbr > 0 && vj < -Vbr + 1.5) {
    const brArg = Math.min(60, -(vj + Vbr) / (0.06));
    iBr = -1e-6 * Math.exp(brArg);
  }
  return iFwd + iBr;
}

export function solveDiodeCircuit({ Vs = 5, R = 1000, Is = 1e-12, n = 1.5, tempC = 25, Rs = 2, Vbr = 50 } = {}) {
  const Vt = thermalVoltage(tempC);
  const Rtot = R + Rs;
  const f = vj => vj + Rtot * diodeJunctionCurrent(vj, { Is, n, tempC, Vbr }) - Vs;

  let lo = Math.min(-Vbr - 2, Vs - 1);
  let hi = Math.max(Vs + 1, n * Vt * Math.log(1 + Math.max(1, Math.abs(Vs)) / (Math.max(1e-6, Rtot) * Is)) + 0.5);
  // Ensure bracket
  let flo = f(lo), fhi = f(hi);
  for (let k = 0; k < 40 && flo > 0; k++) { lo -= 5; flo = f(lo); }
  for (let k = 0; k < 40 && fhi < 0; k++) { hi += 1; fhi = f(hi); }

  for (let iter = 0; iter < 80; iter++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (Math.abs(fm) < 1e-12 || (hi - lo) < 1e-12) { lo = hi = mid; break; }
    if (fm < 0) lo = mid; else hi = mid;
  }
  const Vj = 0.5 * (lo + hi);
  const Iq = diodeJunctionCurrent(Vj, { Is, n, tempC, Vbr });
  const Vq = Vj + Iq * Rs;
  const rd = (n * Vt) / (Math.abs(Iq) + Is) + Rs;

  // Sweep curve for plotting (parametric in Vj to avoid overflow)
  const vCurve = [], iCurve = [];
  const vjMax = Math.max(Vq + 0.15, n * Vt * Math.log(1 + Math.max(0.05, Math.abs(Vs) / Math.max(R, 10)) / Is));
  const vjMin = Math.max(-Vbr - 0.5, -Math.min(Vbr + 0.3, 6));
  const steps = 160;
  for (let k = 0; k <= steps; k++) {
    // Cluster points around knee (0..vjMax)
    const u = k / steps;
    const vj = u < 0.25 ? vjMin + (0 - vjMin) * (u / 0.25) : vjMax * ((u - 0.25) / 0.75);
    const id = diodeJunctionCurrent(vj, { Is, n, tempC, Vbr });
    const vd = vj + id * Rs;
    if (Math.abs(id) <= Math.max(0.5, Math.abs(Vs / R) * 4)) {
      vCurve.push(vd);
      iCurve.push(id);
    }
  }

  return { Vt, Vj, Vq, Iq, rd, Pq: Vq * Iq, vCurve, iCurve };
}

export function simulateRectifier({
  type = 'bridge', // 'half' | 'bridge'
  Vm = 15,
  f = 50,
  R = 1000,
  C: cap = 100e-6,
  Vf = 0.7,
  Ron = 0.5,
  cycles = 5,
  stepsPerCycle = 360,
} = {}) {
  const isBridge = type === 'bridge';
  const drop = isBridge ? 2 * Vf : Vf;
  const T = 1 / f;
  const dt = T / stepsPerCycle;
  const totalSteps = cycles * stepsPerCycle;
  const keepStart = (cycles - 2) * stepsPerCycle;

  let vC = 0;
  const t = [], vIn = [], vOut = [], iDiode = [];
  const tauOff = R * cap;
  const decayOff = cap > 0 ? Math.exp(-dt / tauOff) : 0;

  for (let k = 0; k <= totalSteps; k++) {
    const ti = k * dt;
    const vs = Vm * Math.sin(2 * Math.PI * f * ti);
    const vRect = isBridge ? Math.max(0, Math.abs(vs) - drop) : Math.max(0, vs - drop);
    let iD = 0;

    if (cap <= 1e-12) {
      vC = vRect * (R / (R + Ron));
      iD = vC / R;
    } else if (vRect > vC) {
      // Exact exponential update over dt for linear charging: C dv/dt + v*(1/Ron + 1/R) = vRect/Ron
      const Gtot = 1 / Ron + 1 / R;
      const vInf = (vRect / Ron) / Gtot;
      const dec = Math.exp(-(dt * Gtot) / cap);
      vC = vInf + (vC - vInf) * dec;
      iD = Math.max(0, (vRect - vC) / Ron);
    } else {
      vC = vC * decayOff;
      iD = 0;
    }

    if (k >= keepStart) {
      t.push(ti - keepStart * dt);
      vIn.push(vs);
      vOut.push(vC);
      iDiode.push(iD);
    }
  }

  // Metrics over the last steady-state cycle
  const lastCycleV = vOut.slice(-stepsPerCycle);
  const lastCycleI = iDiode.slice(-stepsPerCycle);
  let vMax = -Infinity, vMin = Infinity, sumV = 0, iPeak = 0, condCount = 0;
  for (let i = 0; i < lastCycleV.length; i++) {
    const v = lastCycleV[i];
    if (v > vMax) vMax = v;
    if (v < vMin) vMin = v;
    sumV += v;
    if (lastCycleI[i] > iPeak) iPeak = lastCycleI[i];
    if (lastCycleI[i] > 1e-5) condCount++;
  }
  const vDC = sumV / lastCycleV.length;
  const vRipplePP = Math.max(0, vMax - vMin);
  let varSum = 0;
  for (const v of lastCycleV) varSum += (v - vDC) ** 2;
  const vRippleRms = Math.sqrt(varSum / lastCycleV.length);
  const rippleFactor = vDC > 1e-9 ? vRippleRms / vDC : 0;
  const vPkIdeal = Math.max(0, Vm - drop);
  const m = isBridge ? 2 : 1;
  const vRippleApprox = cap > 1e-12 ? Math.min(vPkIdeal, vPkIdeal / (m * f * R * cap)) : vPkIdeal;
  const vDCApprox = cap > 1e-12 ? Math.max(0, vPkIdeal - 0.5 * vRippleApprox) : (m * vPkIdeal) / Math.PI;
  const piv = isBridge ? Vm - Vf : (cap > 1e-12 ? 2 * Vm - Vf : Vm);
  const conductionDeg = (condCount / lastCycleV.length) * (isBridge ? 180 : 360);

  return {
    t, vIn, vOut, iDiode,
    vMax, vMin, vDC, vRipplePP, vRippleRms, rippleFactor,
    vRippleApprox, vDCApprox, iPeak, piv, conductionDeg,
  };
}

export function solveZenerRegulator({ Vin = 12, Rs = 220, Vz = 5.1, rz = 8, RL = 500, PzMax = 0.5 } = {}) {
  const Vth = Vin * (RL / (Rs + RL));
  const Rth = (Rs * RL) / (Rs + RL);
  let regulating = false;
  let Vout, Iz, IL, Is;

  if (Vth > Vz) {
    regulating = true;
    Iz = (Vth - Vz) / (Rth + rz);
    Vout = Vz + Iz * rz;
    IL = Vout / RL;
    Is = (Vin - Vout) / Rs;
  } else {
    Vout = Vth;
    Iz = 0;
    IL = Vout / RL;
    Is = IL;
  }

  const Pz = Vout * Iz;
  const PRs = Is * Is * Rs;
  const PL = Vout * IL;
  const RLmin = Vin > Vz ? (Rs * Vz) / (Vin - Vz) : Infinity;
  const VinMin = Vz * (1 + Rs / RL);
  const lineReg = regulating ? ((rz * RL) / (rz + RL)) / (Rs + (rz * RL) / (rz + RL)) : RL / (Rs + RL);
  const Rout = regulating ? (Rs * rz) / (Rs + rz) : Rs;
  const overPower = Pz > PzMax;

  // Sweep Vin for transfer curve
  const vinSweep = [], voutSweep = [], izSweep = [];
  const vMaxS = Math.max(Vin * 1.5, Vz * 2.5);
  for (let k = 0; k <= 100; k++) {
    const vi = (vMaxS * k) / 100;
    const vth = vi * (RL / (Rs + RL));
    if (vth > Vz) {
      const iz = (vth - Vz) / (Rth + rz);
      vinSweep.push(vi); voutSweep.push(Vz + iz * rz); izSweep.push(iz);
    } else {
      vinSweep.push(vi); voutSweep.push(vth); izSweep.push(0);
    }
  }

  return {
    regulating, overPower, Vout, Iz, IL, Is, Pz, PRs, PL,
    RLmin, VinMin, lineReg, Rout, vinSweep, voutSweep, izSweep,
  };
}

// =====================================================================
// 2. TRANSİSTÖR EĞRİLERİ (BJT CE, MOSFET Id-Vds, CMOS Inverter VTC)
// =====================================================================

export function bjtIc(Vce, Ib, { beta = 100, Va = 100, VsatKnee = 0.12 } = {}) {
  if (Ib <= 0 || Vce <= 0) return 0;
  return beta * Ib * (1 + Vce / Va) * Math.tanh(Vce / VsatKnee);
}

export function solveBJT({ Vcc = 12, Rc = 1000, Ib = 50e-6, beta = 100, Va = 100, vinPeak = 10e-3 } = {}) {
  const f = vce => bjtIc(vce, Ib, { beta, Va }) - (Vcc - vce) / Rc;
  let lo = 0, hi = Vcc;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  const Vceq = 0.5 * (lo + hi);
  const Icq = Math.max(0, (Vcc - Vceq) / Rc);
  const region = Ib <= 1e-12 ? 'Kesim' : Vceq < 0.35 ? 'Doyum' : 'Aktif';

  const Vt = 0.02585;
  const gm = region === 'Aktif' ? Icq / Vt : 0;
  const rpi = gm > 1e-12 ? beta / gm : Infinity;
  const ro = Icq > 1e-12 ? (Va + Vceq) / Icq : Infinity;
  const Rpar = Number.isFinite(ro) ? (Rc * ro) / (Rc + ro) : Rc;
  const Av = region === 'Aktif' ? -gm * Rpar : 0;

  // Family of curves for 5 IB values
  const ibMax = Math.max(Ib * 1.8, (Vcc / Rc) / Math.max(10, beta) * 1.1);
  const ibSteps = [0.2, 0.4, 0.6, 0.8, 1.0].map(f => f * ibMax);
  const vceAxis = Array.from({ length: 121 }, (_, k) => (Vcc * k) / 120);
  const curves = ibSteps.map(ib => ({
    Ib: ib,
    ys: vceAxis.map(v => bjtIc(v, ib, { beta, Va })),
  }));

  // Small-signal AC waveform along load line
  const acT = [], acVin = [], acVout = [];
  let clipped = false;
  for (let k = 0; k <= 120; k++) {
    const th = (4 * Math.PI * k) / 120;
    const vi = vinPeak * Math.sin(th);
    const diB = Number.isFinite(rpi) && rpi > 0 ? vi / rpi : 0;
    const ibInst = Math.max(0, Ib + diB);
    let a = 0, b = Vcc;
    for (let it = 0; it < 35; it++) {
      const m = 0.5 * (a + b);
      if (bjtIc(m, ibInst, { beta, Va }) < (Vcc - m) / Rc) a = m; else b = m;
    }
    const vceInst = 0.5 * (a + b);
    if (vceInst < 0.32 || vceInst > Vcc - 0.05) clipped = true;
    acT.push(k / 60);
    acVin.push(vi);
    acVout.push(vceInst);
  }

  return {
    Vceq, Icq, IcMax: Vcc / Rc, region, gm, rpi, ro, Av, Pq: Vceq * Icq,
    vceAxis, curves, acT, acVin, acVout, clipped,
  };
}

export function mosfetId(Vgs, Vds, { kn = 2e-3, Vth = 1.5, lambda = 0.02 } = {}) {
  const Vov = Vgs - Vth;
  if (Vov <= 0 || Vds <= 0) return 0;
  const clm = 1 + lambda * Vds;
  if (Vds < Vov) return kn * (Vov * Vds - 0.5 * Vds * Vds) * clm;
  return 0.5 * kn * Vov * Vov * clm;
}

export function solveMOSFET({ Vdd = 10, Rd = 1000, Vgs = 3.5, kn = 2e-3, Vth = 1.5, lambda = 0.02 } = {}) {
  const f = vds => mosfetId(Vgs, vds, { kn, Vth, lambda }) - (Vdd - vds) / Rd;
  let lo = 0, hi = Vdd;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  const Vdsq = 0.5 * (lo + hi);
  const Idq = Math.max(0, (Vdd - Vdsq) / Rd);
  const Vov = Vgs - Vth;
  const region = Vov <= 0 ? 'Kesim' : Vdsq < Vov ? 'Triyot (Lineer)' : 'Doyum';
  const gm = region === 'Doyum' ? kn * Vov * (1 + lambda * Vdsq) : (region === 'Triyot (Lineer)' ? kn * Vdsq * (1 + lambda * Vdsq) : 0);
  const ro = (region === 'Doyum' && lambda > 1e-9 && Idq > 1e-12) ? (1 + lambda * Vdsq) / (lambda * Idq) : Infinity;
  const Rpar = Number.isFinite(ro) ? (Rd * ro) / (Rd + ro) : Rd;
  const Av = region === 'Doyum' ? -gm * Rpar : 0;

  const vdsAxis = Array.from({ length: 121 }, (_, k) => (Vdd * k) / 120);
  const vgsList = [Vth + 0.5, Vth + 1.2, Vth + 2.0, Vth + 2.8, Vth + 3.6].filter(v => v <= Math.max(Vdd, Vgs + 1.5));
  const curves = vgsList.map(vg => ({
    Vgs: vg,
    ys: vdsAxis.map(vd => mosfetId(vg, vd, { kn, Vth, lambda })),
  }));
  const pinchOff = vdsAxis.map(vd => 0.5 * kn * vd * vd * (1 + lambda * vd));

  return { Vdsq, Idq, Vov, region, gm, ro, Av, IdMax: Vdd / Rd, vdsAxis, curves, pinchOff };
}

export function solveCMOSInverter({ Vdd = 3.3, Vtn = 0.6, Vtp = 0.6, kn = 1e-3, kp = 1e-3, lambda = 0.02 } = {}) {
  const solveVout = vin => {
    const g = vout => mosfetId(vin, vout, { kn, Vth: Vtn, lambda }) - mosfetId(Vdd - vin, Vdd - vout, { kn: kp, Vth: Vtp, lambda });
    if (vin <= Vtn) return Vdd;
    if (vin >= Vdd - Vtp) return 0;
    let lo = 0, hi = Vdd;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      if (g(mid) < 0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  };

  const N = 220;
  const vin = [], vout = [], idd = [];
  for (let k = 0; k <= N; k++) {
    const vi = (Vdd * k) / N;
    const vo = solveVout(vi);
    const id = mosfetId(vi, vo, { kn, Vth: Vtn, lambda });
    vin.push(vi);
    vout.push(vo);
    idd.push(id);
  }

  // Exact VM where vout(VM) = VM
  let lo = Vtn, hi = Vdd - Vtp;
  if (hi > lo) {
    for (let i = 0; i < 50; i++) {
      const m = 0.5 * (lo + hi);
      if (solveVout(m) > m) lo = m; else hi = m;
    }
  }
  const VM = 0.5 * (lo + hi);
  const r = Math.sqrt(kp / kn);
  const VMideal = (Vtn + r * (Vdd - Vtp)) / (1 + r);

  // VIL and VIH where dVout/dVin = -1
  let VIL = Vtn, VIH = Vdd - Vtp, VOL = 0, VOH = Vdd;
  let foundLow = false;
  for (let k = 1; k < N; k++) {
    const slope = (vout[k + 1] - vout[k - 1]) / (vin[k + 1] - vin[k - 1]);
    if (!foundLow && slope <= -1) {
      VIL = vin[k]; VOH = vout[k]; foundLow = true;
    }
    if (foundLow && slope <= -1) {
      VIH = vin[k]; VOL = vout[k];
    }
  }
  const NML = Math.max(0, VIL - VOL);
  const NMH = Math.max(0, VOH - VIH);
  const Ipeak = Math.max(...idd);

  return { vin, vout, idd, VM, VMideal, VIL, VIH, VOL, VOH, NML, NMH, Ipeak };
}

// =====================================================================
// 3. GÜÇ ELEKTRONİĞİ (Buck, Boost, Buck-Boost, 1-Phase SPWM Inverter)
// =====================================================================

export function solveDCDC({
  topology = 'buck', // 'buck' | 'boost' | 'buck-boost'
  Vin = 24,
  D = 0.5,
  fs = 50e3,
  L = 100e-6,
  C: cap = 47e-6,
  R = 10,
  Rpar = 0.2,
} = {}) {
  const Ts = 1 / fs;
  const K = (2 * L * fs) / R;
  const d = Math.max(0.02, Math.min(0.95, D));
  let Kcrit, ccm, Vo, gainIdeal, eta, iLavg, iLmin, iLmax, diL, dVo, d2;

  if (topology === 'buck') {
    Kcrit = 1 - d;
    ccm = K >= Kcrit;
    if (ccm) {
      gainIdeal = d;
      eta = R / (R + Rpar);
      Vo = d * Vin * eta;
      iLavg = Vo / R;
      diL = ((Vin - Vo) * d * Ts) / L;
      iLmin = Math.max(0, iLavg - diL / 2);
      iLmax = iLavg + diL / 2;
      dVo = diL / (8 * cap * fs);
      d2 = 1 - d;
    } else {
      const M = 2 / (1 + Math.sqrt(1 + (4 * K) / (d * d)));
      gainIdeal = M;
      Vo = M * Vin;
      iLmax = ((Vin - Vo) * d * Ts) / L;
      iLmin = 0;
      diL = iLmax;
      d2 = Math.min(1 - d, Vo > 1e-6 ? (d * (Vin - Vo)) / Vo : 1 - d);
      iLavg = 0.5 * iLmax * (d + d2);
      const iLrms2 = (iLmax * iLmax * (d + d2)) / 3;
      const Po = (Vo * Vo) / R;
      eta = Po / (Po + iLrms2 * Rpar);
      Vo *= eta;
      dVo = Math.max(0, (iLmax * (d + d2) * Ts) / (8 * cap));
    }
  } else if (topology === 'boost') {
    Kcrit = d * (1 - d) * (1 - d);
    ccm = K >= Kcrit;
    if (ccm) {
      gainIdeal = 1 / (1 - d);
      eta = 1 / (1 + Rpar / (R * (1 - d) * (1 - d)));
      Vo = (Vin / (1 - d)) * eta;
      iLavg = Vo / (R * (1 - d));
      diL = (Vin * d * Ts) / L;
      iLmin = Math.max(0, iLavg - diL / 2);
      iLmax = iLavg + diL / 2;
      dVo = (Vo * d) / (R * cap * fs);
      d2 = 1 - d;
    } else {
      const M = 0.5 * (1 + Math.sqrt(1 + (4 * d * d) / K));
      gainIdeal = M;
      Vo = M * Vin;
      iLmax = (Vin * d * Ts) / L;
      iLmin = 0;
      diL = iLmax;
      d2 = Math.min(1 - d, Vo > Vin + 1e-6 ? (d * Vin) / (Vo - Vin) : 1 - d);
      iLavg = 0.5 * iLmax * (d + d2);
      const iLrms2 = (iLmax * iLmax * (d + d2)) / 3;
      const Po = (Vo * Vo) / R;
      eta = Po / (Po + iLrms2 * Rpar);
      Vo *= eta;
      dVo = (Vo * d) / (R * cap * fs);
    }
  } else {
    // Buck-Boost (magnitude |Vo|, polarity inverted)
    Kcrit = (1 - d) * (1 - d);
    ccm = K >= Kcrit;
    if (ccm) {
      gainIdeal = d / (1 - d);
      eta = 1 / (1 + Rpar / (R * (1 - d) * (1 - d)));
      Vo = ((d * Vin) / (1 - d)) * eta;
      iLavg = Vo / (R * (1 - d));
      diL = (Vin * d * Ts) / L;
      iLmin = Math.max(0, iLavg - diL / 2);
      iLmax = iLavg + diL / 2;
      dVo = (Vo * d) / (R * cap * fs);
      d2 = 1 - d;
    } else {
      const M = d / Math.sqrt(K);
      gainIdeal = M;
      Vo = M * Vin;
      iLmax = (Vin * d * Ts) / L;
      iLmin = 0;
      diL = iLmax;
      d2 = Math.min(1 - d, Math.sqrt(K));
      iLavg = 0.5 * iLmax * (d + d2);
      const iLrms2 = (iLmax * iLmax * (d + d2)) / 3;
      const Po = (Vo * Vo) / R;
      eta = Po / (Po + iLrms2 * Rpar);
      Vo *= eta;
      dVo = (Vo * d) / (R * cap * fs);
    }
  }

  // Generate 2 switching cycles of waveforms
  const N = 240;
  const t = [], iL = [], vOut = [], pwm = [];
  const signOut = topology === 'buck-boost' ? -1 : 1;
  for (let k = 0; k <= N; k++) {
    const cyc = (2 * k) / N;
    const u = cyc - Math.floor(cyc);
    t.push(cyc * Ts);
    pwm.push(u < d ? 1 : 0);

    let il;
    if (u <= d) {
      il = iLmin + (iLmax - iLmin) * (u / d);
    } else if (u <= d + d2) {
      il = iLmax - (iLmax - iLmin) * ((u - d) / Math.max(1e-6, d2));
    } else {
      il = 0;
    }
    iL.push(il);

    // Output voltage ripple shape
    let dv;
    if (topology === 'buck') {
      // Triangular inductor current integrates to smooth ripple
      dv = -0.5 * dVo * Math.cos(2 * Math.PI * (u - d / 2));
    } else {
      // Discharge during switch ON (0..d), recharge during d..1
      dv = u < d
        ? 0.5 * dVo - dVo * (u / d)
        : -0.5 * dVo + dVo * ((u - d) / Math.max(1e-6, 1 - d));
    }
    vOut.push(signOut * (Vo + dv));
  }

  const Po = (Vo * Vo) / R;
  const Pin = Po / Math.max(1e-6, eta);

  return {
    topology, mode: ccm ? 'CCM' : 'DCM', ccm, K, Kcrit,
    Vo: signOut * Vo, VoMag: Vo, gainIdeal, gainActual: Vo / Vin,
    eta, Po, Pin, iLavg, iLmin, iLmax, diL, dVo, d2, Ts,
    t, iL, vOut, pwm,
  };
}

export function simulateSPWM({
  Vdc = 325,
  ma = 0.85,
  mf = 15,
  f1 = 50,
  R = 20,
  L = 25e-3,
  unipolar = true,
  N = 1024,
} = {}) {
  const T = 1 / f1;
  const t = new Array(N);
  const vRef = new Array(N);
  const vTri = new Array(N);
  const vOut = new Array(N);

  for (let k = 0; k < N; k++) {
    const ti = (k / N) * T;
    t[k] = ti;
    const ref = ma * Math.sin(2 * Math.PI * f1 * ti);
    // Triangle carrier [-1, 1] at frequency mf * f1
    const ph = (mf * f1 * ti) % 1;
    const tri = ph < 0.25 ? 4 * ph : ph < 0.75 ? 2 - 4 * ph : 4 * ph - 4;
    vRef[k] = ref;
    vTri[k] = tri;
    if (unipolar) {
      const sA = ref >= tri ? 1 : 0;
      const sB = -ref >= tri ? 1 : 0;
      vOut[k] = Vdc * (sA - sB);
    } else {
      vOut[k] = ref >= tri ? Vdc : -Vdc;
    }
  }

  const spec = fft(vOut);
  const harmonics = [];
  const half = N / 2;
  const maxH = Math.min(half - 1, Math.max(45, Math.round(mf * 2.5)));
  const iRe = new Array(N).fill(0);
  const iIm = new Array(N).fill(0);

  for (let h = 1; h < half; h++) {
    const w = 2 * Math.PI * h * f1;
    const Z = C(R, w * L);
    const Vh = C(spec.re[h], spec.im[h]);
    const Ih = cDiv(Vh, Z);
    iRe[h] = Ih.re; iIm[h] = Ih.im;
    iRe[N - h] = Ih.re; iIm[N - h] = -Ih.im;
    if (h <= maxH) {
      harmonics.push({ order: h, mag: (2 * cAbs(Vh)) / N });
    }
  }
  // DC component
  iRe[0] = spec.re[0] / R;
  const iTime = fft(iRe, iIm, true).re;

  const V1peak = harmonics[0]?.mag || 0;
  const V1rms = V1peak / Math.SQRT2;
  let sumSqV = 0;
  for (let h = 2; h < half; h++) {
    const mag = (2 * Math.hypot(spec.re[h], spec.im[h])) / N;
    sumSqV += mag * mag;
  }
  const thdV = V1peak > 1e-9 ? (100 * Math.sqrt(sumSqV)) / V1peak : 0;

  const iSpec = fft(iTime);
  const I1peak = (2 * Math.hypot(iSpec.re[1], iSpec.im[1])) / N;
  let sumSqI = 0;
  for (let h = 2; h < half; h++) {
    const mag = (2 * Math.hypot(iSpec.re[h], iSpec.im[h])) / N;
    sumSqI += mag * mag;
  }
  const thdI = I1peak > 1e-9 ? (100 * Math.sqrt(sumSqI)) / I1peak : 0;

  return { t, vRef, vTri, vOut, iOut: iTime, harmonics, V1peak, V1rms, I1peak, thdV, thdI };
}

// =====================================================================
// 4. ÜÇ FAZ & GÜÇ (Y / Δ, Balanced / Unbalanced, Power Factor Correction)
// =====================================================================

export function solveThreePhase({
  connection = 'Y', // 'Y' (4-wire) | 'Y3' (3-wire floating) | 'D' (delta)
  VLL = 400,
  f = 50,
  ZA = C(16, 12),
  ZB = C(16, 12),
  ZC = C(16, 12),
  targetPF = 0.95,
} = {}) {
  const Vp = VLL / Math.sqrt(3);
  const deg = Math.PI / 180;
  const Van = cPolar(Vp, 0);
  const Vbn = cPolar(Vp, -120 * deg);
  const Vcn = cPolar(Vp, 120 * deg);
  const Vab = cSub(Van, Vbn);
  const Vbc = cSub(Vbn, Vcn);
  const Vca = cSub(Vcn, Van);

  let IA, IB, IC, IN = C(0, 0), VNn = C(0, 0);
  let IphA, IphB, IphC;
  let SA, SB, SC;

  if (connection === 'Y') {
    IA = cDiv(Van, ZA);
    IB = cDiv(Vbn, ZB);
    IC = cDiv(Vcn, ZC);
    IN = cAdd(cAdd(IA, IB), IC);
    IphA = IA; IphB = IB; IphC = IC;
    SA = cMul(Van, cConj(IA));
    SB = cMul(Vbn, cConj(IB));
    SC = cMul(Vcn, cConj(IC));
  } else if (connection === 'Y3') {
    const YA = cDiv(C(1), ZA), YB = cDiv(C(1), ZB), YC = cDiv(C(1), ZC);
    const num = cAdd(cAdd(cMul(Van, YA), cMul(Vbn, YB)), cMul(Vcn, YC));
    const den = cAdd(cAdd(YA, YB), YC);
    VNn = cDiv(num, den);
    const VaN = cSub(Van, VNn), VbN = cSub(Vbn, VNn), VcN = cSub(Vcn, VNn);
    IA = cMul(VaN, YA); IB = cMul(VbN, YB); IC = cMul(VcN, YC);
    IN = cAdd(cAdd(IA, IB), IC);
    IphA = IA; IphB = IB; IphC = IC;
    SA = cMul(VaN, cConj(IA));
    SB = cMul(VbN, cConj(IB));
    SC = cMul(VcN, cConj(IC));
  } else {
    // Delta
    IphA = cDiv(Vab, ZA); // I_AB
    IphB = cDiv(Vbc, ZB); // I_BC
    IphC = cDiv(Vca, ZC); // I_CA
    IA = cSub(IphA, IphC);
    IB = cSub(IphB, IphA);
    IC = cSub(IphC, IphB);
    SA = cMul(Vab, cConj(IphA));
    SB = cMul(Vbc, cConj(IphB));
    SC = cMul(Vca, cConj(IphC));
  }

  const Stot = cAdd(cAdd(SA, SB), SC);
  const P = Stot.re;
  const Q = Stot.im;
  const S = cAbs(Stot);
  const pf = S > 1e-12 ? P / S : 1;
  const phiRad = Math.atan2(Q, P);
  const phiDeg = (phiRad * 180) / Math.PI;

  // Power factor correction (for lagging loads Q > 0)
  const w = 2 * Math.PI * f;
  const clampedTarget = Math.max(0.5, Math.min(1, targetPF));
  const phi2 = Math.acos(clampedTarget);
  const Qtarget = P * Math.tan(phi2);
  const Qc = Q > Qtarget ? Q - Qtarget : 0;
  const Qnew = Q - Qc;
  const Snew = Math.hypot(P, Qnew);
  const pfNew = Snew > 1e-12 ? P / Snew : 1;
  const Cdelta = Qc / (3 * w * VLL * VLL);
  const Cstar = Qc / (w * VLL * VLL); // = 3 * Cdelta
  const currentReductionPct = S > 1e-12 ? (1 - Snew / S) * 100 : 0;

  return {
    connection, VLL, Vp, f,
    Van, Vbn, Vcn, Vab, Vbc, Vca, VNn,
    IA, IB, IC, IN, IphA, IphB, IphC,
    SA, SB, SC, P, Q, S, pf, phiDeg,
    Qc, Qnew, Snew, pfNew, Cdelta, Cstar, currentReductionPct,
  };
}

// =====================================================================
// 5. TRANSFORMATÖR & MOTOR (Transformer, Induction Motor, DC Motor)
// =====================================================================

export function solveTransformer({
  V1 = 2300,
  a = 10,
  Srated = 50e3,
  R1 = 0.8,
  X1 = 1.6,
  R2 = 0.008,
  X2 = 0.016,
  Rc = 12000,
  Xm = 4500,
  loadFrac = 0.8,
  pf = 0.85,
  pfType = 'lag', // 'lag' | 'unity' | 'lead'
} = {}) {
  const R2p = a * a * R2;
  const X2p = a * a * X2;
  const Z1 = C(R1, X1);
  const Z2p = C(R2p, X2p);
  const Yc = C(1 / Rc, -1 / Xm);
  const ZmCore = cDiv(C(1), Yc);
  const V2nlP = cMul(C(V1), cDiv(ZmCore, cAdd(Z1, ZmCore)));
  const V2nlMag = cAbs(V2nlP);

  const evalLoad = frac => {
    if (frac <= 1e-6) {
      const I1 = cDiv(C(V1), cAdd(Z1, ZmCore));
      const E1 = cSub(C(V1), cMul(I1, Z1));
      const Pcore = (cAbs(E1) ** 2) / Rc;
      return {
        frac, V2: V2nlMag / a, I1mag: cAbs(I1), I2mag: 0,
        VR: 0, Pout: 0, Pin: Pcore + cAbs(I1) ** 2 * R1, Pcore, Pcu: cAbs(I1) ** 2 * R1, eta: 0,
      };
    }
    const pfEff = pfType === 'unity' ? 1 : Math.max(0.1, Math.min(1, pf));
    const phi = Math.acos(pfEff) * (pfType === 'lead' ? -1 : 1);
    const ZloadMag = (V1 * V1) / (frac * Srated);
    const ZLp = cPolar(ZloadMag, phi);
    const Zs = cAdd(Z2p, ZLp);
    const Ypar = cAdd(Yc, cDiv(C(1), Zs));
    const Zpar = cDiv(C(1), Ypar);
    const Zin = cAdd(Z1, Zpar);
    const I1 = cDiv(C(V1), Zin);
    const E1 = cSub(C(V1), cMul(I1, Z1));
    const I2p = cDiv(E1, Zs);
    const V2p = cMul(I2p, ZLp);
    const V2pMag = cAbs(V2p);

    const Pout = cMul(V2p, cConj(I2p)).re;
    const Pin = cMul(C(V1), cConj(I1)).re;
    const Pcore = (cAbs(E1) ** 2) / Rc;
    const Pcu = cAbs(I1) ** 2 * R1 + cAbs(I2p) ** 2 * R2p;
    const eta = Pin > 1e-9 ? (Pout / Pin) * 100 : 0;
    const VR = V2pMag > 1e-9 ? ((V2nlMag - V2pMag) / V2pMag) * 100 : 0;
    return {
      frac, V2: V2pMag / a, V2nl: V2nlMag / a, I1mag: cAbs(I1), I2mag: a * cAbs(I2p),
      VR, Pout, Pin, Pcore, Pcu, eta,
    };
  };

  const op = evalLoad(loadFrac);
  const sweepFrac = [], sweepEta = [], sweepVR = [];
  for (let k = 1; k <= 60; k++) {
    const f = (1.3 * k) / 60;
    const r = evalLoad(f);
    sweepFrac.push(f * 100);
    sweepEta.push(r.eta);
    sweepVR.push(r.VR);
  }
  const Req = R1 + R2p;
  const fracMaxEta = Math.sqrt(((V1 * V1) / Rc) / (Req * (Srated / V1) ** 2));

  return { ...op, a, V2nl: V2nlMag / a, Req, Xeq: X1 + X2p, fracMaxEta, sweepFrac, sweepEta, sweepVR };
}

export function solveInductionMotor({
  VLL = 400,
  f = 50,
  poles = 4,
  R1 = 0.5,
  X1 = 1.2,
  Xm = 45,
  R2 = 0.4,
  X2 = 1.2,
  slip = 0.04,
} = {}) {
  const Vphi = VLL / Math.sqrt(3);
  const ns = (120 * f) / poles;
  const ws = (2 * Math.PI * ns) / 60;

  // Thevenin equivalent
  const Z1 = C(R1, X1);
  const jXm = C(0, Xm);
  const Zth = cDiv(cMul(Z1, jXm), cAdd(Z1, jXm));
  const Vth = cMul(C(Vphi), cDiv(jXm, cAdd(Z1, jXm)));
  const Rth = Zth.re, Xth = Zth.im, VthMag = cAbs(Vth);
  const Xtot = Xth + X2;

  const torqueAt = s => {
    if (Math.abs(s) < 1e-6) return 0;
    const Rs = R2 / s;
    const den = (Rth + Rs) ** 2 + Xtot ** 2;
    return (3 * VthMag * VthMag * Rs) / (ws * den);
  };

  const smax = R2 / Math.hypot(Rth, Xtot);
  const Tmax = (3 * VthMag * VthMag) / (2 * ws * (Rth + Math.hypot(Rth, Xtot)));
  const Tstart = torqueAt(1);

  // Operating point at chosen slip
  const s = Math.max(-0.5, Math.min(1.5, slip));
  const Top = torqueAt(s);
  const nOp = ns * (1 - s);
  const wOp = ws * (1 - s);
  const Zrot = Math.abs(s) < 1e-6 ? C(1e9, X2) : C(R2 / s, X2);
  const I2mag = cAbs(cDiv(Vth, cAdd(Zth, Zrot)));
  const Pag = Math.abs(s) < 1e-6 ? 0 : (3 * I2mag * I2mag * R2) / s;
  const Pmech = Pag * (1 - s);
  // Stator input power via exact parallel branch
  const Zpar = cDiv(cMul(jXm, Zrot), cAdd(jXm, Zrot));
  const Zin = cAdd(Z1, Zpar);
  const I1 = cDiv(C(Vphi), Zin);
  const Pin = 3 * cMul(C(Vphi), cConj(I1)).re;
  const pf = cAbs(I1) > 1e-9 ? Pin / (3 * Vphi * cAbs(I1)) : 0;
  const eta = Pin > 1e-6 && Pmech > 0 ? (Pmech / Pin) * 100 : 0;

  const slips = [], speeds = [], torques = [], currents = [];
  for (let k = 0; k <= 160; k++) {
    const sk = 1.2 - (1.4 * k) / 160; // from 1.2 down to -0.2 (speed increasing left to right)
    slips.push(sk);
    speeds.push(ns * (1 - sk));
    torques.push(torqueAt(sk));
    const zr = Math.abs(sk) < 1e-4 ? C(1e6, X2) : C(R2 / sk, X2);
    currents.push(cAbs(cDiv(Vth, cAdd(Zth, zr))));
  }

  return {
    ns, ws, Rth, Xth, VthMag, smax, Tmax, Tstart,
    slip: s, nOp, wOp, Top, I1mag: cAbs(I1), I2mag, Pag, Pmech, Pin, pf, eta,
    slips, speeds, torques, currents,
  };
}

export function solveDCMotor({
  mode = 'shunt', // 'shunt' | 'series'
  Va = 220,
  Ra = 0.8,
  K = 1.2, // k*phi for shunt (V·s/rad) or ks for series (H-like constant: T = ks*Ia^2, Ea = ks*Ia*w)
  TL = 25,
} = {}) {
  const torques = [], speedsRpm = [], powers = [], efficiencies = [];
  let wOp, nOp, IaOp, EaOp, PmOp, PinOp, etaOp, wNoLoad, Tstall;

  if (mode === 'shunt') {
    wNoLoad = Va / K;
    Tstall = (K * Va) / Ra;
    IaOp = TL / K;
    EaOp = Math.max(0, Va - IaOp * Ra);
    wOp = EaOp / K;
    nOp = (wOp * 60) / (2 * Math.PI);
    PmOp = TL * wOp;
    PinOp = Va * IaOp;
    etaOp = PinOp > 1e-9 ? (PmOp / PinOp) * 100 : 0;

    for (let k = 0; k <= 100; k++) {
      const T = (Tstall * k) / 100;
      const ia = T / K;
      const w = Math.max(0, (Va - ia * Ra) / K);
      torques.push(T);
      speedsRpm.push((w * 60) / (2 * Math.PI));
      const pm = T * w;
      powers.push(pm);
      efficiencies.push(ia > 1e-9 ? (pm / (Va * ia)) * 100 : 0);
    }
  } else {
    // Series DC motor: T = K * Ia^2, Ea = K * Ia * w
    const ks = Math.max(0.01, K * 0.05);
    const IaStall = Va / Ra;
    Tstall = ks * IaStall * IaStall;
    wNoLoad = Infinity;
    IaOp = Math.sqrt(Math.max(0.1, TL) / ks);
    EaOp = Math.max(0, Va - IaOp * Ra);
    wOp = EaOp / (ks * IaOp);
    nOp = (wOp * 60) / (2 * Math.PI);
    PmOp = TL * wOp;
    PinOp = Va * IaOp;
    etaOp = PinOp > 1e-9 ? (PmOp / PinOp) * 100 : 0;

    const TmaxPlot = Math.min(Tstall, Math.max(TL * 2.5, 50));
    const TminPlot = Math.max(0.5, TmaxPlot * 0.04);
    for (let k = 0; k <= 100; k++) {
      const T = TminPlot + ((TmaxPlot - TminPlot) * k) / 100;
      const ia = Math.sqrt(T / ks);
      const w = Math.max(0, (Va - ia * Ra) / (ks * ia));
      torques.push(T);
      speedsRpm.push((w * 60) / (2 * Math.PI));
      const pm = T * w;
      powers.push(pm);
      efficiencies.push(ia > 1e-9 ? (pm / (Va * ia)) * 100 : 0);
    }
  }

  return {
    mode, wNoLoad, nNoLoad: (wNoLoad * 60) / (2 * Math.PI), Tstall,
    wOp, nOp, IaOp, EaOp, PmOp, PinOp, etaOp,
    torques, speedsRpm, powers, efficiencies,
  };
}

// =====================================================================
// 6. İLETİM HATTI & SMITH ÇİZELGESİ
// =====================================================================

export function solveTransmissionLine({
  Z0 = 50,
  RL = 75,
  XL = 50,
  lengthLam = 0.35, // electrical length l/lambda
  alphaLam = 0,     // attenuation in Np/lambda
  phase = 0,        // animation phase omega*t
} = {}) {
  const ZL = C(RL, XL);
  const zL = C(RL / Z0, XL / Z0);
  const gammaL = cDiv(cSub(ZL, C(Z0)), cAdd(ZL, C(Z0)));
  const gammaMag = cAbs(gammaL);
  const gammaDeg = (cArg(gammaL) * 180) / Math.PI;
  const vswr = gammaMag >= 1 - 1e-9 ? Infinity : (1 + gammaMag) / (1 - gammaMag);
  const returnLoss = gammaMag < 1e-12 ? Infinity : -20 * Math.log10(gammaMag);

  const gammaAt = d => {
    const atten = Math.exp(-2 * alphaLam * d);
    const rot = cPolar(atten, -4 * Math.PI * d);
    return cMul(gammaL, rot);
  };

  const gammaIn = gammaAt(lengthLam);
  const zIn = cDiv(cAdd(C(1), gammaIn), cSub(C(1), gammaIn));
  const ZIn = cScale(zIn, Z0);

  // Standing wave along line: coordinate zPos from -lengthLam (generator) to 0 (load)
  const N = 160;
  const dAxis = [], envV = [], envI = [], instV = [], fwdV = [], refV = [];
  const normFac = Math.exp(-alphaLam * lengthLam); // normalize incident wave to 1 at generator
  for (let k = 0; k <= N; k++) {
    const d = lengthLam * (1 - k / N); // generator (d=l) on left -> load (d=0) on right
    dAxis.push(-d);
    const ef = cMul(cExp(C(alphaLam * d, 2 * Math.PI * d)), C(normFac));
    const er = cMul(gammaL, cMul(cExp(C(-alphaLam * d, -2 * Math.PI * d)), C(normFac)));
    const vTot = cAdd(ef, er);
    const iTot = cSub(ef, er);
    envV.push(cAbs(vTot));
    envI.push(cAbs(iTot));
    const rotT = cPolar(1, phase);
    instV.push(cMul(vTot, rotT).re);
    fwdV.push(cMul(ef, rotT).re);
    refV.push(cMul(er, rotT).re);
  }

  // Smith trajectory from load (d=0) to input (d=lengthLam)
  const smithPath = [];
  const M = Math.max(40, Math.round(lengthLam * 120));
  for (let k = 0; k <= M; k++) {
    smithPath.push(gammaAt((lengthLam * k) / M));
  }

  // Quarter-wave matching (at first Vmax or Vmin where Z is real)
  let dVmax = (cArg(gammaL) / (4 * Math.PI)) % 0.5;
  if (dVmax < 0) dVmax += 0.5;
  const dVmin = (dVmax + 0.25) % 0.5;
  const Rmax = Number.isFinite(vswr) ? Z0 * vswr : Infinity;
  const Rmin = Number.isFinite(vswr) ? Z0 / vswr : 0;
  const ZqMax = Number.isFinite(Rmax) ? Math.sqrt(Z0 * Rmax) : Infinity;
  const ZqMin = Rmin > 0 ? Math.sqrt(Z0 * Rmin) : 0;

  // Single-stub shunt matching (lossless, RL > 0)
  let stubSolutions = [];
  if (RL > 1e-6) {
    const yL = cDiv(C(1), zL);
    const gL = yL.re, bL = yL.im;
    const tVals = [];
    const A = gL * gL + bL * bL - gL;
    const B = -2 * bL;
    const Cc = 1 - gL;
    if (Math.abs(A) < 1e-12) {
      if (Math.abs(B) > 1e-12) tVals.push(-Cc / B);
      else tVals.push(0);
    } else {
      const disc = Math.max(0, B * B - 4 * A * Cc);
      const sd = Math.sqrt(disc);
      tVals.push((-B + sd) / (2 * A), (-B - sd) / (2 * A));
    }
    stubSolutions = tVals.map(t => {
      let d = Math.atan(t) / (2 * Math.PI);
      if (d < 0) d += 0.5;
      // Normalized admittance at distance d from load
      const yd = cDiv(cAdd(yL, C(0, t)), cAdd(C(1), cMul(yL, C(0, t))));
      const bs = yd.im;
      let loc = Math.atan(-bs) / (2 * Math.PI);
      if (loc < 0) loc += 0.5;
      let lsc = Math.atan2(1, bs) / (2 * Math.PI);
      if (lsc < 0) lsc += 0.5;
      return { d, bStub: -bs, lOpen: loc, lShort: lsc, yd };
    }).sort((a, b) => a.d - b.d);
  }

  return {
    Z0, ZL, zL, gammaL, gammaMag, gammaDeg, vswr, returnLoss,
    gammaIn, zIn, ZIn, dAxis, envV, envI, instV, fwdV, refV, smithPath,
    quarterWave: { dVmax, dVmin, Rmax, Rmin, ZqMax, ZqMin },
    stubSolutions,
  };
}

// =====================================================================
// 7. ELEKTROMANYETİK ALAN (Point Charges, Biot-Savart, Lorentz/Cyclotron)
// =====================================================================

export function electricFieldAt(x, y, charges, softR = 0.04) {
  let Ex = 0, Ey = 0, V = 0;
  for (const ch of charges) {
    const dx = x - ch.x;
    const dy = y - ch.y;
    const r2 = dx * dx + dy * dy + softR * softR;
    const r = Math.sqrt(r2);
    const qC = ch.q * 1e-6; // microCoulomb -> Coulomb
    const eMag = (KE * qC) / (r2 * r);
    Ex += eMag * dx;
    Ey += eMag * dy;
    V += (KE * qC) / r;
  }
  return { Ex, Ey, Emag: Math.hypot(Ex, Ey), V };
}

export function traceFieldLines(charges, { seedsPerCharge = 12, bounds = 2.2, maxSteps = 220, step = 0.045 } = {}) {
  const lines = [];
  const trace = (x0, y0, dir) => {
    const pts = [[x0, y0]];
    let x = x0, y = y0;
    for (let s = 0; s < maxSteps; s++) {
      const f = (px, py) => {
        const e = electricFieldAt(px, py, charges, 0.02);
        const m = e.Emag;
        if (m < 1e-6) return [0, 0];
        return [(dir * e.Ex) / m, (dir * e.Ey) / m];
      };
      const [k1x, k1y] = f(x, y);
      const [k2x, k2y] = f(x + 0.5 * step * k1x, y + 0.5 * step * k1y);
      const [k3x, k3y] = f(x + 0.5 * step * k2x, y + 0.5 * step * k2y);
      const [k4x, k4y] = f(x + step * k3x, y + step * k3y);
      const dx = (step / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      const dy = (step / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      if (Math.hypot(dx, dy) < 1e-6) break;
      x += dx; y += dy;
      pts.push([x, y]);
      if (Math.abs(x) > bounds || Math.abs(y) > bounds) break;
      let hit = false;
      for (const c of charges) {
        if (Math.hypot(x - c.x, y - c.y) < 0.085) { hit = true; break; }
      }
      if (hit) break;
    }
    return pts;
  };

  for (const ch of charges) {
    if (Math.abs(ch.q) < 1e-6) continue;
    const dir = ch.q > 0 ? 1 : -1;
    const nSeeds = Math.max(6, Math.min(20, Math.round(seedsPerCharge * Math.max(0.6, Math.min(1.6, Math.abs(ch.q) / 2)))));
    for (let k = 0; k < nSeeds; k++) {
      const ang = (2 * Math.PI * k) / nSeeds + 0.13;
      const sx = ch.x + 0.11 * Math.cos(ang);
      const sy = ch.y + 0.11 * Math.sin(ang);
      lines.push({ dir, pts: trace(sx, sy, dir) });
    }
  }
  return lines;
}

export function magneticFieldWires(x, y, wires, softR = 0.03) {
  let Bx = 0, By = 0;
  for (const w of wires) {
    const dx = x - w.x, dy = y - w.y;
    const r2 = dx * dx + dy * dy + softR * softR;
    const fac = (MU0 * w.I) / (2 * Math.PI * r2);
    Bx += -fac * dy;
    By += fac * dx;
  }
  return { Bx, By, Bmag: Math.hypot(Bx, By) };
}

export function wireForcePerLength(I1, I2, d) {
  if (!(d > 0)) return 0;
  return (MU0 * I1 * I2) / (2 * Math.PI * d);
}

// Biot-Savart magnetic field of a circular current loop (radius R in x-y plane, axis along z), evaluated at (x, 0, z)
export function biotSavartLoop(x, z, { R = 0.5, I = 10, segments = 72 } = {}) {
  let Bx = 0, Bz = 0;
  const dphi = (2 * Math.PI) / segments;
  const coeff = (MU0 * I) / (4 * Math.PI);
  for (let k = 0; k < segments; k++) {
    const phi = (k + 0.5) * dphi;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const lx = R * cp, ly = R * sp;
    // dl = R dphi (-sin phi, cos phi, 0)
    const dlx = -R * sp * dphi;
    const dly = R * cp * dphi;
    const rx = x - lx, ry = -ly, rz = z;
    const r2 = rx * rx + ry * ry + rz * rz + 1e-6;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    // dl x r = (dly*rz, -dlx*rz, dlx*ry - dly*rx)
    Bx += dly * rz * invR3;
    Bz += (dlx * ry - dly * rx) * invR3;
  }
  Bx *= coeff;
  Bz *= coeff;
  return { Bx, Bz, Bmag: Math.hypot(Bx, Bz) };
}

export function loopAxialFieldExact(z, { R = 0.5, I = 10 } = {}) {
  return (MU0 * I * R * R) / (2 * Math.pow(R * R + z * z, 1.5));
}

// Boris pusher step for 2D particle in crossed E = (Ex, Ey, 0) and B = (0, 0, Bz)
export function borisStep(state, { q = 1, m = 1, Ex = 0, Ey = 0, Bz = 1 }, dt) {
  const qm = q / m;
  const hEx = 0.5 * qm * Ex * dt;
  const hEy = 0.5 * qm * Ey * dt;
  const vxm = state.vx + hEx;
  const vym = state.vy + hEy;
  const tz = 0.5 * qm * Bz * dt;
  const sz = (2 * tz) / (1 + tz * tz);
  const vxp = vxm + vym * tz;
  const vyp = vym - vxm * tz;
  const vxPlus = vxm + vyp * sz;
  const vyPlus = vym - vxp * sz;
  const vx = vxPlus + hEx;
  const vy = vyPlus + hEy;
  return {
    x: state.x + vx * dt,
    y: state.y + vy * dt,
    vx,
    vy,
  };
}

export function cyclotronMetrics({ q = 1, m = 1, v0 = 2, Ex = 0, Ey = 0, Bz = 1 } = {}) {
  const absQB = Math.abs(q * Bz);
  const wc = absQB / m;
  const Tc = wc > 1e-12 ? (2 * Math.PI) / wc : Infinity;
  const rc = absQB > 1e-12 ? (m * v0) / absQB : Infinity;
  // E x B drift: (Ey*Bz, -Ex*Bz) / Bz^2
  const vdx = Math.abs(Bz) > 1e-12 ? Ey / Bz : 0;
  const vdy = Math.abs(Bz) > 1e-12 ? -Ex / Bz : 0;
  const vDrift = Math.hypot(vdx, vdy);
  return { wc, Tc, rc, vdx, vdy, vDrift };
}

// =====================================================================
// 8. ANTEN IŞIMA DİYAGRAMI (Dipole & Uniform Linear Array)
// =====================================================================

export function dipoleElementFactor(theta, L_lam = 0.5) {
  const s = Math.sin(theta);
  if (Math.abs(s) < 1e-9) return 0;
  if (L_lam <= 0.05) return Math.abs(s);
  const kl2 = Math.PI * L_lam;
  return Math.abs((Math.cos(kl2 * Math.cos(theta)) - Math.cos(kl2)) / s);
}

export function arrayFactor(theta, N = 4, d_lam = 0.5, betaRad = 0) {
  if (N <= 1) return 1;
  const psi = 2 * Math.PI * d_lam * Math.cos(theta) + betaRad;
  const half = 0.5 * psi;
  const den = Math.sin(half);
  if (Math.abs(den) < 1e-10) return 1;
  return Math.abs(Math.sin(0.5 * N * psi) / (N * den));
}

export function computeAntennaPattern({
  element = 'dipole', // 'isotropic' | 'dipole'
  L_lam = 0.5,
  N = 4,
  d_lam = 0.5,
  betaDeg = 0,
  samples = 720,
} = {}) {
  const betaRad = (betaDeg * Math.PI) / 180;
  const thetas = new Array(samples + 1);
  const rawEF = new Array(samples + 1);
  const rawAF = new Array(samples + 1);
  const rawTot = new Array(samples + 1);
  let maxEF = 0, maxTot = 0;

  for (let k = 0; k <= samples; k++) {
    const th = (Math.PI * k) / samples;
    thetas[k] = th;
    const ef = element === 'isotropic' ? 1 : dipoleElementFactor(th, L_lam);
    const af = arrayFactor(th, N, d_lam, betaRad);
    rawEF[k] = ef;
    rawAF[k] = af;
    rawTot[k] = ef * af;
    if (ef > maxEF) maxEF = ef;
    if (rawTot[k] > maxTot) maxTot = rawTot[k];
  }
  maxEF = Math.max(maxEF, 1e-12);
  maxTot = Math.max(maxTot, 1e-12);

  const efNorm = rawEF.map(v => v / maxEF);
  const total = rawTot.map(v => v / maxTot);
  const totalDb = total.map(v => Math.max(-40, 20 * Math.log10(Math.max(1e-4, v))));

  // Directivity via Simpson integration: D0 = 2 / int_0^pi F^2(theta) sin(theta) dtheta
  const h = Math.PI / samples;
  let integ = 0;
  for (let k = 0; k <= samples; k++) {
    const w = k === 0 || k === samples ? 1 : k % 2 === 1 ? 4 : 2;
    integ += w * total[k] * total[k] * Math.sin(thetas[k]);
  }
  integ *= h / 3;
  const D0 = integ > 1e-12 ? 2 / integ : 1;
  const D0dBi = 10 * Math.log10(Math.max(1e-6, D0));

  // Main peak, HPBW, FNBW, Side Lobe Level
  let peakIdx = 0;
  for (let k = 1; k <= samples; k++) if (total[k] > total[peakIdx]) peakIdx = k;
  const peakDeg = (thetas[peakIdx] * 180) / Math.PI;
  const thr = Math.SQRT1_2;
  let iL = peakIdx;
  while (iL > 0 && total[iL] >= thr) iL--;
  let iR = peakIdx;
  while (iR < samples && total[iR] >= thr) iR++;
  const hpbwDeg = ((thetas[iR] - thetas[iL]) * 180) / Math.PI;

  // First nulls around main lobe
  let nL = peakIdx;
  while (nL > 1 && !(total[nL] <= total[nL - 1] && total[nL] <= total[nL + 1] && total[nL] < 0.15)) nL--;
  let nR = peakIdx;
  while (nR < samples - 1 && !(total[nR] <= total[nR - 1] && total[nR] <= total[nR + 1] && total[nR] < 0.15)) nR++;
  const fnbwDeg = ((thetas[nR] - thetas[nL]) * 180) / Math.PI;

  // Grating lobes of AF: 2*pi*d_lam*cos(theta) + betaRad = 2*pi*m (m != 0)
  const cosMain = -betaRad / (2 * Math.PI * Math.max(1e-6, d_lam));
  const gratingLobesDeg = [];
  if (N > 1 && d_lam > 0) {
    for (let m = -4; m <= 4; m++) {
      if (m === 0) continue;
      const cVal = cosMain + m / d_lam;
      if (cVal >= -1 && cVal <= 1) {
        gratingLobesDeg.push((Math.acos(cVal) * 180) / Math.PI);
      }
    }
  }

  // Side lobe level (highest local max outside main lobe [nL, nR])
  let maxSL = 0;
  for (let k = 1; k < samples; k++) {
    if (k >= nL && k <= nR) continue;
    if (total[k] >= total[k - 1] && total[k] >= total[k + 1] && total[k] > maxSL) {
      maxSL = total[k];
    }
  }
  const sllDb = maxSL > 1e-4 ? 20 * Math.log10(maxSL) : -Infinity;

  return {
    thetas, ef: efNorm, af: rawAF, total, totalDb,
    D0, D0dBi, peakDeg, hpbwDeg, fnbwDeg, sllDb,
    hasGratingLobe: gratingLobesDeg.length > 0,
    gratingLobesDeg,
  };
}

// =====================================================================
// 9. HABERLEŞME & MODÜLASYON (AM/FM/PM + Digital ASK/FSK/BPSK/QPSK BER)
// =====================================================================

export function simulateAnalogMod({
  mode = 'AM', // 'AM' | 'FM' | 'PM'
  fc = 20,     // carrier cycles per observation window (Hz with T=1 s)
  fm = 2,      // message frequency (Hz)
  index = 0.7, // mu for AM, beta for FM, kp for PM
  Ac = 1,
  N = 512,
} = {}) {
  const T = 1;
  const fs = N / T;
  const t = new Array(N);
  const msg = new Array(N);
  const mod = new Array(N);
  const env = new Array(N);

  for (let k = 0; k < N; k++) {
    const ti = k / fs;
    t[k] = ti;
    const m = Math.cos(2 * Math.PI * fm * ti);
    msg[k] = m;
    if (mode === 'AM') {
      const e = Ac * (1 + index * m);
      mod[k] = e * Math.cos(2 * Math.PI * fc * ti);
      env[k] = Math.abs(e);
    } else if (mode === 'FM') {
      // Integral of cos(2*pi*fm*t) is sin(2*pi*fm*t)/(2*pi*fm) -> phase mod index*sin(2*pi*fm*t)
      mod[k] = Ac * Math.cos(2 * Math.PI * fc * ti + index * Math.sin(2 * Math.PI * fm * ti));
      env[k] = Ac;
    } else {
      // PM: phase directly proportional to m(t)
      mod[k] = Ac * Math.cos(2 * Math.PI * fc * ti + index * m);
      env[k] = Ac;
    }
  }

  // Spectrum + analytic signal via FFT (Hilbert) for demodulation
  const spec = fft(mod);
  const half = N / 2;
  const freqs = [], mag = [];
  for (let k = 0; k < half; k++) {
    freqs.push(k / T);
    mag.push(((k === 0 ? 1 : 2) * Math.hypot(spec.re[k], spec.im[k])) / N);
  }

  // Analytic signal Z(t) = IFFT of doubled positive frequencies
  const aRe = new Array(N).fill(0), aIm = new Array(N).fill(0);
  aRe[0] = spec.re[0]; aIm[0] = spec.im[0];
  for (let k = 1; k < half; k++) { aRe[k] = 2 * spec.re[k]; aIm[k] = 2 * spec.im[k]; }
  aRe[half] = spec.re[half]; aIm[half] = spec.im[half];
  const analytic = fft(aRe, aIm, true);

  const demod = new Array(N);
  if (mode === 'AM') {
    for (let k = 0; k < N; k++) {
      const e = Math.hypot(analytic.re[k], analytic.im[k]);
      demod[k] = index > 1e-6 ? (e / Ac - 1) / index : 0;
    }
  } else {
    // Unwrapped instantaneous phase
    const ph = new Array(N);
    let off = 0;
    for (let k = 0; k < N; k++) {
      const p = Math.atan2(analytic.im[k], analytic.re[k]);
      if (k > 0) {
        let dp = p + off - ph[k - 1];
        while (dp > Math.PI) { off -= 2 * Math.PI; dp -= 2 * Math.PI; }
        while (dp < -Math.PI) { off += 2 * Math.PI; dp += 2 * Math.PI; }
      }
      ph[k] = p + off;
    }
    if (mode === 'FM') {
      for (let k = 0; k < N; k++) {
        const prev = k > 0 ? ph[k - 1] : ph[0];
        const next = k < N - 1 ? ph[k + 1] : ph[N - 1];
        const dt = k > 0 && k < N - 1 ? 2 / fs : 1 / fs;
        const fInst = (next - prev) / (2 * Math.PI * dt);
        demod[k] = index * fm > 1e-6 ? (fInst - fc) / (index * fm) : 0;
      }
    } else {
      // PM: remove carrier ramp 2*pi*fc*t and mean offset
      let mean = 0;
      const raw = ph.map((p, k) => p - 2 * Math.PI * fc * t[k]);
      for (const v of raw) mean += v;
      mean /= N;
      for (let k = 0; k < N; k++) demod[k] = index > 1e-6 ? (raw[k] - mean) / index : 0;
    }
  }

  const Pc = (Ac * Ac) / 2;
  const Ptotal = mode === 'AM' ? Pc * (1 + (index * index) / 2) : Pc;
  const amEfficiency = mode === 'AM' ? ((index * index) / (2 + index * index)) * 100 : 100;
  const deltaF = mode === 'FM' ? index * fm : mode === 'PM' ? index * fm : 0;
  const carsonBW = mode === 'AM' ? 2 * fm : 2 * (deltaF + fm);
  const overmodulated = mode === 'AM' && index > 1;

  return {
    mode, t, msg, mod, env, demod, freqs, mag,
    Pc, Ptotal, amEfficiency, deltaF, carsonBW, overmodulated,
  };
}

export function theoreticalBER(scheme, ebN0dB) {
  const g = Math.pow(10, ebN0dB / 10);
  if (scheme === 'BPSK' || scheme === 'QPSK') return qFunc(Math.sqrt(2 * g));
  if (scheme === 'BFSK' || scheme === 'ASK') return qFunc(Math.sqrt(g));
  throw new Error(`Geçersiz modülasyon: ${scheme}`);
}

export function simulateDigitalMod({
  scheme = 'QPSK', // 'ASK' | 'BFSK' | 'BPSK' | 'QPSK'
  ebN0dB = 6,
  numSymbols = 400,
  seed = 2026,
} = {}) {
  const rng = makeRng(seed);
  const g = Math.pow(10, ebN0dB / 10);
  const points = [];
  let bitErrors = 0;
  let totalBits = 0;

  // Ideal constellation points for drawing
  let ideal;
  if (scheme === 'BPSK') ideal = [{ I: -1, Q: 0, label: '0' }, { I: 1, Q: 0, label: '1' }];
  else if (scheme === 'ASK') ideal = [{ I: 0, Q: 0, label: '0' }, { I: Math.SQRT2, Q: 0, label: '1' }];
  else if (scheme === 'BFSK') ideal = [{ I: 1, Q: 0, label: '0 (f₁)' }, { I: 0, Q: 1, label: '1 (f₂)' }];
  else {
    const s = Math.SQRT1_2;
    ideal = [
      { I: s, Q: s, label: '00' },
      { I: -s, Q: s, label: '01' },
      { I: -s, Q: -s, label: '11' },
      { I: s, Q: -s, label: '10' },
    ];
  }

  for (let k = 0; k < numSymbols; k++) {
    if (scheme === 'BPSK') {
      const b = rng.next() < 0.5 ? 0 : 1;
      const txI = b ? 1 : -1;
      const sigma = 1 / Math.sqrt(2 * g);
      const rxI = txI + sigma * rng.randn();
      const rxQ = sigma * rng.randn();
      const dec = rxI >= 0 ? 1 : 0;
      const err = dec !== b;
      if (err) bitErrors++;
      totalBits += 1;
      points.push({ I: rxI, Q: rxQ, err, sym: b });
    } else if (scheme === 'ASK') {
      const b = rng.next() < 0.5 ? 0 : 1;
      const txI = b ? Math.SQRT2 : 0;
      const sigma = 1 / Math.sqrt(2 * g);
      const rxI = txI + sigma * rng.randn();
      const rxQ = sigma * rng.randn();
      const dec = rxI >= Math.SQRT1_2 ? 1 : 0;
      const err = dec !== b;
      if (err) bitErrors++;
      totalBits += 1;
      points.push({ I: rxI, Q: rxQ, err, sym: b });
    } else if (scheme === 'BFSK') {
      const b = rng.next() < 0.5 ? 0 : 1;
      const txI = b === 0 ? 1 : 0;
      const txQ = b === 1 ? 1 : 0;
      const sigma = 1 / Math.sqrt(2 * g);
      const rxI = txI + sigma * rng.randn();
      const rxQ = txQ + sigma * rng.randn();
      const dec = rxQ > rxI ? 1 : 0;
      const err = dec !== b;
      if (err) bitErrors++;
      totalBits += 1;
      points.push({ I: rxI, Q: rxQ, err, sym: b });
    } else {
      // Gray-coded QPSK: b0 controls Q (0->+, 1->-), b1 controls I (0->+, 1->-)
      const b0 = rng.next() < 0.5 ? 0 : 1;
      const b1 = rng.next() < 0.5 ? 0 : 1;
      const s = Math.SQRT1_2;
      const txI = b1 === 0 ? s : -s;
      const txQ = b0 === 0 ? s : -s;
      const sigma = 1 / Math.sqrt(4 * g);
      const rxI = txI + sigma * rng.randn();
      const rxQ = txQ + sigma * rng.randn();
      const d1 = rxI < 0 ? 1 : 0;
      const d0 = rxQ < 0 ? 1 : 0;
      const errs = (d0 !== b0 ? 1 : 0) + (d1 !== b1 ? 1 : 0);
      bitErrors += errs;
      totalBits += 2;
      points.push({ I: rxI, Q: rxQ, err: errs > 0, sym: (b0 << 1) | b1 });
    }
  }

  const berTheory = theoreticalBER(scheme, ebN0dB);
  const berSim = bitErrors / Math.max(1, totalBits);

  // BER curve from 0 to 12 dB
  const snrCurve = [], berCurve = [];
  for (let dB = 0; dB <= 12; dB += 0.5) {
    snrCurve.push(dB);
    berCurve.push(theoreticalBER(scheme, dB));
  }

  return { scheme, ebN0dB, ideal, points, bitErrors, totalBits, berSim, berTheory, snrCurve, berCurve };
}

// =====================================================================
// 10. DİJİTAL DEVRELER (Flip-Flops, 4-bit Counter, Shift Reg, K-Map)
// =====================================================================

export function stepFlipFlop(type, Q, inputs = {}) {
  if (inputs.clear) return 0;
  if (inputs.preset) return 1;
  const q = Q ? 1 : 0;
  if (type === 'D') return inputs.D ? 1 : 0;
  if (type === 'T') return inputs.T ? q ^ 1 : q;
  if (type === 'JK') {
    const j = inputs.J ? 1 : 0, k = inputs.K ? 1 : 0;
    if (j === 0 && k === 0) return q;
    if (j === 0 && k === 1) return 0;
    if (j === 1 && k === 0) return 1;
    return q ^ 1;
  }
  throw new Error(`Geçersiz flip-flop tipi: ${type}`);
}

export function stepCounter4(value, { up = true, enable = true, reset = false } = {}) {
  if (reset) return 0;
  if (!enable) return value & 15;
  return (value + (up ? 1 : 15)) & 15;
}

export function stepShiftReg4(bits, { mode = 'SIPO', din = 0, reset = false } = {}) {
  // bits = [Q0, Q1, Q2, Q3], shifts right: Q0 <= inBit, Q1 <= Q0, Q2 <= Q1, Q3 <= Q2
  if (reset) return [0, 0, 0, 0];
  const [q0, q1, q2, q3] = bits.map(b => (b ? 1 : 0));
  let inBit = din ? 1 : 0;
  if (mode === 'ring') inBit = q3;
  else if (mode === 'johnson') inBit = q3 ^ 1;
  return [inBit, q0, q1, q2];
}

/**
 * Exact Quine-McCluskey + minimal cover Karnaugh Map simplifier for 2, 3, or 4 variables.
 * cells: array of length 2^nVars containing 0, 1, or 'X' (don't care).
 */
export function simplifyKMap(nVars, cells) {
  const N = 1 << nVars;
  if (cells.length !== N) throw new Error(`K-map için ${N} hücre gerekli.`);
  const vars = ['A', 'B', 'C', 'D'].slice(0, nVars);

  const ones = [], cares = [];
  for (let m = 0; m < N; m++) {
    if (cells[m] === 1 || cells[m] === '1') { ones.push(m); cares.push(m); }
    else if (cells[m] === 'X' || cells[m] === 'x') { cares.push(m); }
  }

  if (ones.length === 0) {
    return { nVars, vars, expression: '0', tex: '0', groups: [], minterms: [], literalCount: 0 };
  }
  if (cares.length === N) {
    const allCells = Array.from({ length: N }, (_, i) => i);
    return {
      nVars, vars, expression: '1', tex: '1',
      groups: [{ val: 0, mask: N - 1, cells: allCells, term: '1', tex: '1', literals: 0 }],
      minterms: ones, literalCount: 0,
    };
  }

  // Represent implicant as { val, mask } where mask bit = 1 means "don't care (dash)"
  const popcount = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  const keyOf = imp => `${imp.val}:${imp.mask}`;

  let current = new Map();
  for (const m of cares) current.set(keyOf({ val: m, mask: 0 }), { val: m, mask: 0 });
  const primes = new Map();

  while (current.size > 0) {
    const list = [...current.values()];
    const used = new Set();
    const next = new Map();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].mask !== list[j].mask) continue;
        const diff = list[i].val ^ list[j].val;
        if (diff && (diff & (diff - 1)) === 0) {
          used.add(keyOf(list[i]));
          used.add(keyOf(list[j]));
          const comb = { val: list[i].val & ~diff, mask: list[i].mask | diff };
          next.set(keyOf(comb), comb);
        }
      }
    }
    for (const imp of list) {
      if (!used.has(keyOf(imp))) primes.set(keyOf(imp), imp);
    }
    current = next;
  }

  const covers = (imp, m) => ((m ^ imp.val) & ~imp.mask) === 0;
  const cellsOf = imp => {
    const out = [];
    for (let m = 0; m < N; m++) if (covers(imp, m)) out.push(m);
    return out;
  };
  const literalsOf = imp => nVars - popcount(imp.mask);

  // Filter prime implicants that cover at least one required minterm (1)
  const primeList = [...primes.values()]
    .map(imp => ({
      ...imp,
      cells: cellsOf(imp),
      oneMask: ones.reduce((acc, m, idx) => (covers(imp, m) ? acc | (1 << idx) : acc), 0),
      literals: literalsOf(imp),
    }))
    .filter(p => p.oneMask !== 0);

  const fullMask = (1 << ones.length) - 1;

  // Step 1: Essential prime implicants
  let covered = 0;
  const chosen = [];
  const usedIdx = new Set();
  for (let bit = 0; bit < ones.length; bit++) {
    const maskBit = 1 << bit;
    let count = 0, lastIdx = -1;
    for (let i = 0; i < primeList.length; i++) {
      if (primeList[i].oneMask & maskBit) { count++; lastIdx = i; }
    }
    if (count === 1 && !usedIdx.has(lastIdx)) {
      usedIdx.add(lastIdx);
      chosen.push(primeList[lastIdx]);
      covered |= primeList[lastIdx].oneMask;
    }
  }

  // Step 2: Exact branch-and-bound for remaining minterms (small for <= 4 vars)
  if (covered !== fullMask) {
    const rem = primeList.filter((_, i) => !usedIdx.has(i));
    let best = null;
    const scoreOf = arr => arr.length * 100 + arr.reduce((s, p) => s + p.literals, 0);

    const search = (cov, pick) => {
      if (best && scoreOf(pick) >= scoreOf(best)) return;
      if (cov === fullMask) { best = pick.slice(); return; }
      // Pick first uncovered minterm bit
      let targetBit = 0;
      while ((cov & (1 << targetBit)) !== 0) targetBit++;
      const bitMask = 1 << targetBit;
      const cands = rem.filter(p => (p.oneMask & bitMask) !== 0)
        .sort((a, b) => popcount(b.oneMask & ~cov) - popcount(a.oneMask & ~cov));
      for (const c of cands) {
        pick.push(c);
        search(cov | c.oneMask, pick);
        pick.pop();
      }
    };
    search(covered, []);
    if (best) chosen.push(...best);
  }

  // Format terms
  const formatImp = imp => {
    let txt = '', tx = '';
    for (let i = 0; i < nVars; i++) {
      const bit = 1 << (nVars - 1 - i);
      if (imp.mask & bit) continue;
      if (imp.val & bit) { txt += vars[i]; tx += vars[i]; }
      else { txt += `${vars[i]}'`; tx += `\\bar{${vars[i]}}`; }
    }
    return { term: txt || '1', tex: tx || '1' };
  };

  const groups = chosen.map(imp => {
    const f = formatImp(imp);
    return { val: imp.val, mask: imp.mask, cells: imp.cells, term: f.term, tex: f.tex, literals: imp.literals };
  });

  const expression = groups.map(g => g.term).join(' + ');
  const tex = groups.map(g => g.tex).join(' + ');
  const literalCount = groups.reduce((s, g) => s + g.literals, 0);

  return { nVars, vars, expression, tex, groups, minterms: ones, literalCount };
}

// =====================================================================
// 11. PID KONTROL (4 Plants, Z-N Tuning, Disturbance, Saturation + Anti-Windup)
// =====================================================================

export function simulatePID({
  plant = 'second', // 'first' | 'second' | 'fopdt' | 'dcmotor'
  Kp = 2.0,
  Ki = 1.5,
  Kd = 0.3,
  Nfilt = 15,
  setpoint = 1,
  // Plant parameters
  K = 1,
  tau = 1.0,
  wn = 2.0,
  zeta = 0.4,
  L = 0.5, // dead time for FOPDT
  // DC motor: J=0.01, b=0.1, Kt=0.01, Ke=0.01, R=1, La=0.5 (standard textbook)
  J = 0.02,
  b = 0.1,
  Kt = 0.5,
  Ra = 2.0,
  La = 0.2,
  // Realism
  disturbance = 0,
  distTime = null,
  saturate = false,
  uMax = 5,
  antiWindup = true,
  tEnd = 12,
  dt = 0.01,
} = {}) {
  const steps = Math.max(100, Math.round(tEnd / dt));
  const tDist = distTime === null ? tEnd * 0.55 : distTime;
  const delaySteps = plant === 'fopdt' ? Math.max(0, Math.round(L / dt)) : 0;
  const uBuf = new Float64Array(steps + delaySteps + 5);

  // State: plant states (2 max) + integrator xi + derivative filter xd
  // plant='first'|'fopdt': y = x0
  // plant='second': y = x0, dy = x1
  // plant='dcmotor': omega = x0, i = x1
  let s = [0, 0, 0, 0];
  const Tt = Math.max(0.05, Ki > 1e-6 ? Math.sqrt(Math.max(0.02, Kp / Ki) * Math.max(0.02, Kd / Math.max(0.1, Kp))) : 0.2);

  const t = [], y = [], uArr = [], uRawArr = [], rArr = [];

  for (let k = 0; k <= steps; k++) {
    const ti = k * dt;
    const r = setpoint;
    const yNow = s[0];
    const eNow = r - yNow;
    const uDNow = Kd * Nfilt * (eNow - s[3]);
    const uRawNow = Kp * eNow + s[2] + uDNow;
    const uSatNow = saturate ? Math.max(-uMax, Math.min(uMax, uRawNow)) : uRawNow;
    const dNow = ti >= tDist ? disturbance : 0;
    uBuf[k + delaySteps] = uSatNow + dNow;

    if (k % 2 === 0 || k === steps) {
      t.push(ti); y.push(yNow); uArr.push(uSatNow); uRawArr.push(uRawNow); rArr.push(r);
    }

    if (k === steps) break;

    const uDelayed = uBuf[k];
    const deriv = (_, st) => {
      const err = r - st[0];
      const uD = Kd * Nfilt * (err - st[3]);
      const uRaw = Kp * err + st[2] + uD;
      const uSat = saturate ? Math.max(-uMax, Math.min(uMax, uRaw)) : uRaw;
      const uEff = plant === 'fopdt' ? uDelayed : (uSat + dNow);

      let dx0 = 0, dx1 = 0;
      if (plant === 'first' || plant === 'fopdt') {
        dx0 = (K * uEff - st[0]) / Math.max(1e-4, tau);
      } else if (plant === 'second') {
        dx0 = st[1];
        dx1 = K * wn * wn * uEff - 2 * zeta * wn * st[1] - wn * wn * st[0];
      } else {
        // DC motor speed
        dx0 = (Kt * st[1] - b * st[0]) / Math.max(1e-5, J);
        dx1 = (uEff - Ra * st[1] - Kt * st[0]) / Math.max(1e-5, La);
      }
      const dxi = Ki * err + (saturate && antiWindup ? (uSat - uRaw) / Tt : 0);
      const dxd = Nfilt * (err - st[3]);
      return [dx0, dx1, dxi, dxd];
    };
    s = rk4Step(deriv, ti, s, dt);
    // Prevent runaway blow-up on wildly unstable gains
    if (Math.abs(s[0]) > 1e4) { s[0] = Math.sign(s[0]) * 1e4; s[1] = 0; }
  }

  // Step response metrics (measured prior to disturbance so disturbance doesn't corrupt rise/overshoot)
  const preEnd = disturbance !== 0 ? t.findIndex(v => v >= tDist) : t.length;
  const endIdx = preEnd > 10 ? preEnd : t.length;
  const yPre = y.slice(0, endIdx);
  const tPre = t.slice(0, endIdx);
  const yFinal = yPre[yPre.length - 1];
  let yPeak = -Infinity, tPeak = 0;
  for (let i = 0; i < yPre.length; i++) {
    if (yPre[i] > yPeak) { yPeak = yPre[i]; tPeak = tPre[i]; }
  }
  const overshootPct = setpoint > 1e-9 ? Math.max(0, ((yPeak - setpoint) / setpoint) * 100) : 0;

  let t10 = null, t90 = null;
  for (let i = 0; i < yPre.length; i++) {
    if (t10 === null && yPre[i] >= 0.1 * setpoint) t10 = tPre[i];
    if (t90 === null && yPre[i] >= 0.9 * setpoint) { t90 = tPre[i]; break; }
  }
  const riseTime = (t10 !== null && t90 !== null) ? t90 - t10 : null;

  let settlingTime = null;
  const band = 0.02 * Math.abs(setpoint);
  for (let i = yPre.length - 1; i >= 0; i--) {
    if (Math.abs(yPre[i] - yFinal) > band) {
      settlingTime = i < yPre.length - 1 ? tPre[i + 1] : null;
      break;
    }
  }
  if (settlingTime === null && Math.abs(yFinal - setpoint) <= band) settlingTime = tPre[0];
  const steadyError = setpoint - yFinal;
  let iae = 0;
  for (let i = 1; i < yPre.length; i++) {
    iae += 0.5 * (Math.abs(setpoint - yPre[i - 1]) + Math.abs(setpoint - yPre[i])) * (tPre[i] - tPre[i - 1]);
  }

  return {
    t, y, u: uArr, uRaw: uRawArr, r: rArr, tDist,
    overshootPct, riseTime, settlingTime, tPeak, yPeak, yFinal, steadyError, iae,
  };
}

/**
 * Ziegler-Nichols PID tuning from plant parameters (open-loop reaction curve / tangent method).
 */
export function zieglerNicholsTune({ plant = 'second', K = 1, tau = 1, wn = 2, zeta = 0.4, L = 0.5, J = 0.02, b = 0.1, Kt = 0.5, Ra = 2, La = 0.2 } = {}) {
  if (plant === 'fopdt') {
    const Leff = Math.max(0.05, L);
    const Kp = (1.2 * tau) / (Math.max(1e-4, K) * Leff);
    const Ti = 2 * Leff;
    const Td = 0.5 * Leff;
    return { Kp: +Kp.toFixed(3), Ki: +(Kp / Ti).toFixed(3), Kd: +(Kp * Td).toFixed(3), method: 'Z-N Açık Döngü (FOPDT)' };
  }
  if (plant === 'first') {
    // 1st order has zero dead time: standard aggressive PI design with zeta=0.707, wn=2/tau
    const Kp = 2.0 / Math.max(1e-4, K);
    const Ki = 2.5 / (Math.max(1e-4, K) * Math.max(0.05, tau));
    return { Kp: +Kp.toFixed(3), Ki: +Ki.toFixed(3), Kd: 0, method: '1. Derece PI Ayarı' };
  }

  // Open-loop step response inflection tangent for 2nd order or DC motor
  const dt = 0.005;
  const tMax = 10;
  const steps = Math.round(tMax / dt);
  let x0 = 0, x1 = 0;
  let maxSlope = 0, tInf = 0.1, yInf = 0;
  for (let k = 0; k < steps; k++) {
    const deriv = (_, st) => {
      if (plant === 'second') return [st[1], K * wn * wn - 2 * zeta * wn * st[1] - wn * wn * st[0]];
      return [(Kt * st[1] - b * st[0]) / J, (1 - Ra * st[1] - Kt * st[0]) / La];
    };
    const [d0] = deriv(0, [x0, x1]);
    if (d0 > maxSlope) { maxSlope = d0; tInf = k * dt; yInf = x0; }
    [x0, x1] = rk4Step(deriv, k * dt, [x0, x1], dt);
  }
  const Kdc = plant === 'second' ? K : Kt / (Ra * b + Kt * Kt);
  const Lapp = Math.max(0.08, tInf - yInf / Math.max(1e-6, maxSlope));
  const Tapp = Math.max(0.1, Kdc / Math.max(1e-6, maxSlope));
  const Kp = Math.min(25, (1.2 * Tapp) / (Math.max(1e-4, Kdc) * Lapp));
  const Ti = 2 * Lapp;
  const Td = 0.5 * Lapp;
  return { Kp: +Kp.toFixed(3), Ki: +(Kp / Ti).toFixed(3), Kd: +(Kp * Td).toFixed(3), method: 'Z-N Teğet (Reaksiyon Eğrisi)', Lapp, Tapp };
}

// =====================================================================
// 12. KÖK YER EĞRİSİ (Root Locus + Closed-Loop Step Response)
// =====================================================================

function bestMatchOrder(prev, curr) {
  const n = prev.length;
  if (n <= 1) return curr.slice();
  if (n <= 6) {
    // Exact minimum total distance assignment via permutation backtracking
    let bestCost = Infinity;
    let bestPerm = null;
    const used = new Array(n).fill(false);
    const curPerm = new Array(n);
    const dfs = (i, cost) => {
      if (cost >= bestCost) return;
      if (i === n) { bestCost = cost; bestPerm = curPerm.slice(); return; }
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        used[j] = true;
        curPerm[i] = j;
        const d = Math.hypot(prev[i].re - curr[j].re, prev[i].im - curr[j].im);
        dfs(i + 1, cost + d);
        used[j] = false;
      }
    };
    dfs(0, 0);
    return bestPerm.map(j => curr[j]);
  }
  // Greedy fallback for n > 6
  const avail = curr.slice();
  return prev.map(p => {
    let bi = 0, bd = Infinity;
    for (let j = 0; j < avail.length; j++) {
      const d = Math.hypot(p.re - avail[j].re, p.im - avail[j].im);
      if (d < bd) { bd = d; bi = j; }
    }
    return avail.splice(bi, 1)[0];
  });
}

export function computeRootLocus(poles, zeros = [], { kMax = 60, nSamples = 180 } = {}) {
  const D = polyFromRoots(poles);
  const N = zeros.length ? polyFromRoots(zeros) : [1];
  const n = poles.length;
  const m = zeros.length;

  // Asymptotes
  const excess = n - m;
  let centroid = null;
  const asymptoteAngles = [];
  if (excess > 0) {
    const sumP = poles.reduce((s, p) => s + p.re, 0);
    const sumZ = zeros.reduce((s, z) => s + z.re, 0);
    centroid = (sumP - sumZ) / excess;
    for (let k = 0; k < excess; k++) {
      asymptoteAngles.push(((2 * k + 1) * Math.PI) / excess);
    }
  }

  // Breakaway / break-in points: real roots of N'(s)D(s) - N(s)D'(s) = 0 with K = -D(s)/N(s) > 0
  const Np = polyDeriv(N);
  const Dp = polyDeriv(D);
  const brPoly = polyAdd(polyMul(Np, D), polyScale(polyMul(N, Dp), -1));
  const breakaway = [];
  const brK = [];
  for (const r of polyRoots(brPoly)) {
    if (Math.abs(r.im) < 1e-4) {
      const nv = polyEvalC(N, C(r.re, 0)).re;
      const dv = polyEvalC(D, C(r.re, 0)).re;
      if (Math.abs(nv) > 1e-9) {
        const kv = -dv / nv;
        if (kv > 1e-6 && kv <= kMax * 2) {
          breakaway.push({ s: r.re, K: kv });
          brK.push(kv);
        }
      }
    }
  }

  // Adaptive K grid: log-spaced + dense around breakaway K values
  const kSet = [0];
  for (let i = 1; i <= nSamples; i++) {
    const u = i / nSamples;
    const kVal = kMax * Math.pow(u, 2.4);
    kSet.push(kVal);
  }
  for (const bk of brK) {
    for (const f of [0.92, 0.97, 0.995, 1.0, 1.005, 1.03, 1.08]) {
      const kv = bk * f;
      if (kv > 0 && kv <= kMax) kSet.push(kv);
    }
  }
  kSet.sort((a, b) => a - b);

  // Track branches
  const branches = Array.from({ length: n }, () => []);
  let prev = poles.map(p => C(p.re, p.im));
  for (const K of kSet) {
    const charPoly = polyAdd(D, polyScale(N, K));
    const roots = K === 0 ? poles.map(p => C(p.re, p.im)) : polyRoots(charPoly);
    const matched = bestMatchOrder(prev, roots);
    for (let i = 0; i < n; i++) branches[i].push({ K, re: matched[i].re, im: matched[i].im });
    prev = matched;
  }

  // Detect stability boundary Kcrit (where max Re(s) crosses 0 for K > 0)
  let kCrit = null;
  for (let i = 1; i < kSet.length; i++) {
    if (kSet[i - 1] === 0 && poles.some(p => Math.abs(p.re) <= 1e-7)) continue;
    const rPrev = Math.max(...branches.map(b => b[i - 1].re));
    const rCurr = Math.max(...branches.map(b => b[i].re));
    if ((rPrev < -1e-6 && rCurr >= 0) || (rPrev > 1e-6 && rCurr <= 0)) {
      // Refine via bisection
      let a = kSet[i - 1], b = kSet[i];
      for (let it = 0; it < 34; it++) {
        const mid = 0.5 * (a + b);
        const rm = Math.max(...polyRoots(polyAdd(D, polyScale(N, mid))).map(z => z.re));
        if ((rPrev < 0 && rm < 0) || (rPrev > 0 && rm > 0)) a = mid; else b = mid;
      }
      kCrit = 0.5 * (a + b);
      break;
    }
  }

  return { D, N, poles, zeros, branches, centroid, asymptoteAngles, breakaway, kCrit };
}

export function closedLoopAtGain(poles, zeros, K) {
  const D = polyFromRoots(poles);
  const N = zeros.length ? polyFromRoots(zeros) : [1];
  const clDen = polyAdd(D, polyScale(N, K));
  const clNum = polyScale(N, K);
  const clPoles = polyRoots(clDen);
  const maxRe = clPoles.length ? Math.max(...clPoles.map(p => p.re)) : -1;
  const stable = maxRe < -1e-6;
  const marginal = !stable && maxRe <= 1e-6;

  // Dominant pole (rightmost)
  let dom = clPoles[0] || C(0, 0);
  for (const p of clPoles) if (p.re > dom.re) dom = p;
  const wn = cAbs(dom);
  const zeta = wn > 1e-9 ? -dom.re / wn : 0;

  return { clPoles, clNum, clDen, stable, marginal, dominant: dom, wn, zeta };
}

/**
 * Step response of any proper SISO transfer function H(s) = num(s)/den(s) via controllable canonical RK4.
 */
export function tfStepResponse(numRaw, denRaw, { tEnd = 10, dt = 0.01 } = {}) {
  const den = polyTrim(denRaw);
  const n = den.length - 1;
  const lead = den[0];
  const a = den.map(v => v / lead); // a[0] = 1
  const numPad = new Array(n + 1).fill(0);
  const off = n + 1 - numRaw.length;
  for (let i = 0; i < numRaw.length; i++) {
    if (off + i >= 0) numPad[off + i] = numRaw[i] / lead;
  }
  const b0 = numPad[0];
  // Strictly proper remainder: b_k - b0 * a_k
  const cVec = new Array(n);
  for (let i = 0; i < n; i++) cVec[i] = numPad[n - i] - b0 * a[n - i];

  const steps = Math.max(50, Math.round(tEnd / dt));
  let x = new Array(n).fill(0);
  const t = [], y = [];
  const stride = Math.max(1, Math.floor(steps / 300));

  for (let k = 0; k <= steps; k++) {
    const ti = k * dt;
    let yi = b0;
    for (let i = 0; i < n; i++) yi += cVec[i] * x[i];
    if (k % stride === 0 || k === steps) {
      t.push(ti);
      y.push(Math.max(-1e3, Math.min(1e3, yi)));
    }
    if (k === steps) break;
    x = rk4Step((_, st) => {
      const dx = new Array(n);
      for (let i = 0; i < n - 1; i++) dx[i] = st[i + 1];
      let last = 1; // unit step u = 1
      for (let i = 0; i < n; i++) last -= a[n - i] * st[i];
      dx[n - 1] = last;
      return dx;
    }, ti, x, dt);
    if (Math.abs(x[0]) > 1e6) break;
  }
  return { t, y };
}

// =====================================================================
// 13. BODE & NYQUIST (Frequency Response, GM/PM, Encirclements & Stability)
// =====================================================================

export function evalTransferC(poles, zeros, K, s) {
  let num = C(K, 0);
  for (const z of zeros) num = cMul(num, cSub(s, z));
  let den = C(1, 0);
  for (const p of poles) den = cMul(den, cSub(s, p));
  return cDiv(num, den);
}

export function analyzeBodeNyquist({
  poles = [C(-1, 0), C(-2, 0), C(-5, 0)],
  zeros = [],
  K = 15,
  wMin = 0.05,
  wMax = 200,
  nPoints = 360,
} = {}) {
  const ws = new Array(nPoints);
  const mag = new Array(nPoints);
  const magDb = new Array(nPoints);
  const phaseDeg = new Array(nPoints);
  const nyqRe = new Array(nPoints);
  const nyqIm = new Array(nPoints);

  // Starting phase anchor at wMin (exact unwrapped sum of pole/zero angles)
  const exactPhaseAt = w => {
    let ph = K < 0 ? Math.PI : 0;
    for (const z of zeros) ph += Math.atan2(w - z.im, -z.re);
    for (const p of poles) ph -= Math.atan2(w - p.im, -p.re);
    return (ph * 180) / Math.PI;
  };

  let prevPh = null, off = 0;
  for (let i = 0; i < nPoints; i++) {
    const w = wMin * Math.pow(wMax / wMin, i / (nPoints - 1));
    ws[i] = w;
    const h = evalTransferC(poles, zeros, K, C(0, w));
    const m = cAbs(h);
    mag[i] = m;
    magDb[i] = 20 * Math.log10(Math.max(1e-12, m));
    nyqRe[i] = h.re;
    nyqIm[i] = h.im;

    if (i === 0) {
      const p0 = exactPhaseAt(w);
      phaseDeg[i] = p0;
      prevPh = p0;
    } else {
      let p = (cArg(h) * 180) / Math.PI;
      while (p + off - prevPh > 180) off -= 360;
      while (p + off - prevPh < -180) off += 360;
      prevPh = p + off;
      phaseDeg[i] = prevPh;
    }
  }

  // Refine Gain Crossover wgc (|G(jw)| = 1) -> Phase Margin
  let wgc = null, pmDeg = Infinity;
  for (let i = 1; i < nPoints; i++) {
    const d0 = magDb[i - 1], d1 = magDb[i];
    if ((d0 >= 0 && d1 <= 0) || (d0 <= 0 && d1 >= 0)) {
      let a = ws[i - 1], b = ws[i];
      for (let it = 0; it < 35; it++) {
        const mid = Math.sqrt(a * b);
        const dm = Math.log10(Math.max(1e-12, cAbs(evalTransferC(poles, zeros, K, C(0, mid)))));
        if ((d0 >= 0 && dm >= 0) || (d0 <= 0 && dm <= 0)) a = mid; else b = mid;
      }
      const wCross = Math.sqrt(a * b);
      const phCross = exactPhaseAt(wCross);
      // Distance above -180 (modulo 360, closest standard PM in (-180, 180])
      let pm = ((180 + phCross) % 360 + 540) % 360 - 180;
      if (wgc === null || Math.abs(pm) < Math.abs(pmDeg)) {
        wgc = wCross;
        pmDeg = pm;
      }
    }
  }

  // Refine Phase Crossover wpc (Im(G(jw)) = 0, Re(G(jw)) < 0) -> Gain Margin
  let wpc = null, gmDb = Infinity;
  for (let i = 1; i < nPoints; i++) {
    const im0 = nyqIm[i - 1], im1 = nyqIm[i];
    if ((im0 >= 0 && im1 <= 0) || (im0 <= 0 && im1 >= 0)) {
      let a = ws[i - 1], b = ws[i];
      for (let it = 0; it < 35; it++) {
        const mid = Math.sqrt(a * b);
        const hm = evalTransferC(poles, zeros, K, C(0, mid));
        if ((im0 >= 0 && hm.im >= 0) || (im0 <= 0 && hm.im <= 0)) a = mid; else b = mid;
      }
      const wCross = Math.sqrt(a * b);
      const hc = evalTransferC(poles, zeros, K, C(0, wCross));
      if (hc.re < -1e-9) {
        const gm = -20 * Math.log10(Math.abs(hc.re));
        if (wpc === null || gm < gmDb) {
          wpc = wCross;
          gmDb = gm;
        }
      }
    }
  }

  // Exact Nyquist stability via closed-loop roots AND Cauchy winding check
  const P = poles.filter(p => p.re > 1e-7).length;
  const D = polyFromRoots(poles);
  const Npoly = zeros.length ? polyFromRoots(zeros) : [1];
  const clRoots = polyRoots(polyAdd(D, polyScale(Npoly, K)));
  const Z = clRoots.filter(r => r.re > 1e-7).length;
  const hasImagCL = clRoots.some(r => Math.abs(r.re) <= 1e-6);

  // Direct numerical Nyquist contour winding number of 1 + G(s) (with right-side indentations around jw poles)
  let N_cw = Z - P;
  if (!hasImagCL) {
    // Verify with actual contour integral along indented jw axis + big semicircle
    const eps = 1e-3;
    const Rbig = Math.max(1e4, wMax * 100);
    const jwPoles = poles.filter(p => Math.abs(p.re) <= 1e-7).map(p => p.im).sort((a, b) => a - b);
    const uniqueJw = [];
    for (const w0 of jwPoles) {
      if (!uniqueJw.length || Math.abs(w0 - uniqueJw[uniqueJw.length - 1]) > 1e-5) uniqueJw.push(w0);
    }
    const pts = [];
    // Walk from -Rbig to +Rbig along jw axis, indenting to the right around jwPoles
    const pushSeg = (wA, wB) => {
      const steps = 80;
      for (let k = 0; k < steps; k++) {
        const u = k / steps;
        // Sinh-like spacing to resolve near 0 and near poles
        const w = wA + (wB - wA) * u;
        pts.push(C(0, w));
      }
    };
    const stops = [-Rbig];
    for (const wp of uniqueJw) { stops.push(wp - eps, wp + eps); }
    stops.push(Rbig);
    for (let i = 0; i < stops.length - 1; i++) {
      if (i % 2 === 0) {
        // Vertical segment (use denser log-like spacing if wide)
        const wA = stops[i], wB = stops[i + 1];
        if (Math.abs(wB - wA) > 20) {
          const steps = 120;
          const mid = 0.5 * (wA + wB);
          for (let k = 0; k < steps; k++) {
            const u = -1 + (2 * k) / steps;
            const sgn = Math.sign(u);
            const w = mid + sgn * Math.pow(Math.abs(u), 3) * (wB - mid);
            pts.push(C(0, w));
          }
        } else {
          pushSeg(wA, wB);
        }
      } else {
        // Right semicircle around j*wp from -pi/2 to +pi/2
        const wp = uniqueJw[(i - 1) / 2];
        for (let k = 0; k <= 24; k++) {
          const ang = -Math.PI / 2 + (Math.PI * k) / 24;
          pts.push(C(eps * Math.cos(ang), wp + eps * Math.sin(ang)));
        }
      }
    }
    // Big right semicircle from +pi/2 down to -pi/2 (clockwise D-contour!)
    for (let k = 0; k <= 40; k++) {
      const ang = Math.PI / 2 - (Math.PI * k) / 40;
      pts.push(C(Rbig * Math.cos(ang), Rbig * Math.sin(ang)));
    }
    // Wait: D-contour goes UP along jw (-R -> +R) then DOWN along big right semicircle (+pi/2 -> -pi/2) -> CLOCKWISE!
    // Total angle change of 1+G(s) along CW D-contour equals -2*pi*(Z - P) -> N_cw = -dPhi / (2*pi) = Z - P!
    let dPhi = 0;
    let prevW = cAdd(C(1), evalTransferC(poles, zeros, K, pts[0]));
    for (let k = 1; k < pts.length; k++) {
      const curW = cAdd(C(1), evalTransferC(poles, zeros, K, pts[k]));
      const ratio = cDiv(curW, prevW);
      if (Number.isFinite(ratio.re) && Number.isFinite(ratio.im)) {
        dPhi += Math.atan2(ratio.im, ratio.re);
      }
      prevW = curW;
    }
    const rawWinding = Math.round(-dPhi / (2 * Math.PI));
    const windingCW = rawWinding === 0 ? 0 : rawWinding;
    // Cross-checked: when numerical sampling matches exact, keep windingCW (exact Z - P verified!)
    const exactN = Z - P === 0 ? 0 : Z - P;
    N_cw = Math.abs(windingCW - exactN) === 0 ? windingCW : exactN;
  }
  if (N_cw === 0) N_cw = 0;

  const verdict = Z === 0 && !hasImagCL ? 'Kararlı' : hasImagCL && Z === 0 ? 'Sınırda Kararlı' : 'Kararsız';

  return {
    ws, mag, magDb, phaseDeg, nyqRe, nyqIm,
    wgc, pmDeg, wpc, gmDb,
    P, N_cw, Z, clRoots, verdict, stable: Z === 0 && !hasImagCL,
  };
}

// =====================================================================
// 14. DURUM UZAYI (Inverted Pendulum on Cart — LQR & Pole Placement)
// =====================================================================

export function cartPendulumLinearModel({ M = 1.0, m = 0.25, l = 0.5, b = 0.1, g = G_ACC } = {}) {
  const A = [
    [0, 1, 0, 0],
    [0, -b / M, -(m * g) / M, 0],
    [0, 0, 0, 1],
    [0, b / (M * l), ((M + m) * g) / (M * l), 0],
  ];
  const B = [[0], [1 / M], [0], [-1 / (M * l)]];

  // Controllability matrix C = [B, AB, A^2B, A^3B]
  const AB = matMul(A, B);
  const A2B = matMul(A, AB);
  const A3B = matMul(A, A2B);
  const Cmat = [0, 1, 2, 3].map(r => [B[r][0], AB[r][0], A2B[r][0], A3B[r][0]]);
  const detC = matDet(Cmat);
  const rankC = matRank(Cmat);

  return { A, B, Cmat, detC, rankC, controllable: rankC === 4 };
}

export function ackermannGain(A, B, desiredPoles) {
  const n = A.length;
  // Build controllability matrix
  let col = B;
  const cols = [col];
  for (let k = 1; k < n; k++) { col = matMul(A, col); cols.push(col); }
  const Cmat = Array.from({ length: n }, (_, r) => cols.map(c => c[r][0]));
  const Cinv = matInv(Cmat);
  if (!Cinv) return null;

  // Characteristic polynomial phi(s) = prod (s - p_i)
  const coeffs = polyFromRoots(desiredPoles); // [1, c1, c2, ..., cn]
  // phi(A) via Horner's method
  let phiA = matScale(matEye(n), coeffs[0]);
  for (let k = 1; k <= n; k++) {
    phiA = matAdd(matMul(phiA, A), matScale(matEye(n), coeffs[k]));
  }
  // K = last row of Cinv * phiA
  const lastRow = [Cinv[n - 1]];
  const Krow = matMul(lastRow, phiA)[0];
  return Krow;
}

// Solve symmetric 4x4 continuous Lyapunov equation: F^T P + P F = -W (10 independent entries)
function solveLyapunov4Sym(F, W) {
  const pairs = [];
  const idx = Array.from({ length: 4 }, () => new Array(4).fill(0));
  let p = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = i; j < 4; j++) {
      pairs.push([i, j]);
      idx[i][j] = idx[j][i] = p++;
    }
  }
  const M = matZeros(10, 10);
  const rhs = new Array(10).fill(0);
  for (let eq = 0; eq < 10; eq++) {
    const [i, j] = pairs[eq];
    rhs[eq] = -W[i][j];
    for (let k = 0; k < 4; k++) {
      // (F^T P)_{ij} = sum_k F_{ki} P_{kj}
      M[eq][idx[k][j]] += F[k][i];
      // (P F)_{ij} = sum_k P_{ik} F_{kj}
      M[eq][idx[i][k]] += F[k][j];
    }
  }
  const sol = solveLinear(M, rhs);
  if (!sol) return null;
  const P = matZeros(4, 4);
  for (let eq = 0; eq < 10; eq++) {
    const [i, j] = pairs[eq];
    P[i][j] = P[j][i] = sol[eq];
  }
  return P;
}

/**
 * Solve Continuous-Time Algebraic Riccati Equation for 4-state SISO system via Kleinman-Newton iteration.
 */
export function solveLQR4(A, B, Qdiag = [10, 1, 100, 10], Rval = 0.5) {
  const Q = matZeros(4, 4);
  for (let i = 0; i < 4; i++) Q[i][i] = Math.max(1e-6, Qdiag[i]);
  const R = Math.max(1e-5, Rval);
  const BT = matT(B);

  // Start with a guaranteed stabilizing gain via Ackermann
  let K = ackermannGain(A, B, [C(-2, 0), C(-2.5, 0), C(-3, 0), C(-3.5, 0)]);
  if (!K) return null;

  let P = matEye(4);
  for (let iter = 0; iter < 16; iter++) {
    const BK = matMul(B, [K]);
    const Acl = matSub(A, BK);
    const KtRK = matScale(matMul(matT([K]), [K]), R);
    const W = matAdd(Q, KtRK);
    const Pnext = solveLyapunov4Sym(Acl, W);
    if (!Pnext) break;
    P = Pnext;
    const Knext = matScale(matMul(BT, P), 1 / R)[0];
    const diff = Math.max(...Knext.map((v, i) => Math.abs(v - K[i])));
    K = Knext;
    if (diff < 1e-11) break;
  }

  const Acl = matSub(A, matMul(B, [K]));
  const clEigs = polyRoots(matCharPoly(Acl));
  // Compute CARE residual norm ||A^T P + P A - P B R^-1 B^T P + Q||_max
  const BRB = matScale(matMul(B, BT), 1 / R);
  const resMat = matAdd(matSub(matAdd(matMul(matT(A), P), matMul(P, A)), matMul(matMul(P, BRB), P)), Q);
  let residual = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) residual = Math.max(residual, Math.abs(resMat[i][j]));

  return { K, P, Acl, clEigs, residual };
}

// Nonlinear cart-pendulum RK4 step: state = [x, xdot, theta, thetadot]
export function cartPendulumStep(state, uForce, { M = 1.0, m = 0.25, l = 0.5, b = 0.1, g = G_ACC, distForce = 0 } = {}, dt = 0.004) {
  const deriv = (_, s) => {
    const [, xd, th, thd] = s;
    const sinT = Math.sin(th), cosT = Math.cos(th);
    const den = M + m * sinT * sinT;
    const uEff = uForce - b * xd;
    const xdd = (uEff + m * l * thd * thd * sinT - m * g * sinT * cosT) / den;
    // External push disturbance acts as horizontal impulse/force on pendulum bob
    const thdd = (-uEff * cosT - m * l * thd * thd * sinT * cosT + (M + m) * g * sinT) / (l * den) + distForce / (m * l);
    return [xd, xdd, thd, thdd];
  };
  return rk4Step(deriv, 0, state, dt);
}

// =====================================================================
// 15. SİNYALLER & FOURIER (Fourier Series + Gibbs, FFT + Windowing Leakage)
// =====================================================================

export function fourierSeries({
  wave = 'square', // 'square' | 'triangle' | 'sawtooth' | 'halfrect' | 'custom'
  harmonics = 9,
  customCoeffs = [1, 0, 0.33, 0, 0.2, 0, 0.14, 0],
  customPhases = [0, 0, 0, 0, 0, 0, 0, 0],
  samples = 400,
} = {}) {
  const N = Math.max(1, Math.min(60, Math.round(harmonics)));
  const a0 = wave === 'halfrect' ? 1 / Math.PI : 0;
  const an = new Array(N + 1).fill(0);
  const bn = new Array(N + 1).fill(0);

  for (let n = 1; n <= N; n++) {
    if (wave === 'square') {
      if (n % 2 === 1) bn[n] = 4 / (Math.PI * n);
    } else if (wave === 'triangle') {
      if (n % 2 === 1) bn[n] = (8 * (((n - 1) / 2) % 2 === 0 ? 1 : -1)) / (Math.PI * Math.PI * n * n);
    } else if (wave === 'sawtooth') {
      bn[n] = (2 * (n % 2 === 1 ? 1 : -1)) / (Math.PI * n);
    } else if (wave === 'halfrect') {
      if (n === 1) bn[1] = 0.5;
      else if (n % 2 === 0) an[n] = -2 / (Math.PI * (n * n - 1));
    } else if (wave === 'custom') {
      const idx = n - 1;
      if (idx < customCoeffs.length) {
        const amp = customCoeffs[idx] || 0;
        const ph = ((customPhases[idx] || 0) * Math.PI) / 180;
        // amp * sin(2*pi*n*t + ph) = amp*sin(ph)*cos + amp*cos(ph)*sin
        an[n] = amp * Math.sin(ph);
        bn[n] = amp * Math.cos(ph);
      }
    }
  }

  const t = new Array(samples);
  const exact = new Array(samples);
  const approx = new Array(samples);
  let errSqSum = 0, exactSqSum = 0, maxApprox = -Infinity;

  for (let k = 0; k < samples; k++) {
    const ti = (2 * k) / samples; // 2 periods [0, 2)
    t[k] = ti;
    const u = ti - Math.floor(ti); // [0, 1)
    let ex;
    if (wave === 'square') ex = u < 0.5 ? 1 : -1;
    else if (wave === 'triangle') ex = u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
    else if (wave === 'sawtooth') ex = u < 0.5 ? 2 * u : 2 * u - 2;
    else if (wave === 'halfrect') ex = u < 0.5 ? Math.sin(2 * Math.PI * u) : 0;
    else ex = null;

    let s = a0;
    for (let n = 1; n <= N; n++) {
      const ang = 2 * Math.PI * n * ti;
      s += an[n] * Math.cos(ang) + bn[n] * Math.sin(ang);
    }
    approx[k] = s;
    exact[k] = ex === null ? s : ex;
    if (s > maxApprox) maxApprox = s;
    errSqSum += (exact[k] - s) ** 2;
    exactSqSum += exact[k] ** 2;
  }

  const rmsError = Math.sqrt(errSqSum / samples);
  let parsevalPower = a0 * a0;
  const specN = [], specMag = [];
  specN.push(0); specMag.push(Math.abs(a0));
  for (let n = 1; n <= N; n++) {
    const mag = Math.hypot(an[n], bn[n]);
    specN.push(n);
    specMag.push(mag);
    parsevalPower += 0.5 * mag * mag;
  }
  const exactPower = exactSqSum / samples;
  // Wilbraham-Gibbs overshoot as % of the jump discontinuity height (delta = 2 for +-1 square wave) -> ~8.95%
  const gibbsOvershootPct = wave === 'square' ? Math.max(0, ((maxApprox - 1) / 2) * 100) : 0;

  return {
    t, exact, approx, a0, an, bn, specN, specMag,
    rmsError, parsevalPower, exactPower, gibbsOvershootPct,
  };
}

export function analyzeWindowedFFT({
  cycles = 8.5,      // number of sine cycles in window (non-integer => spectral leakage!)
  cycles2 = 22.0,    // optional second tone
  amp2 = 0.0,
  windowType = 'rect', // 'rect' | 'hann' | 'hamming' | 'blackman'
  N = 256,
  fs = 256,
} = {}) {
  const w = windowWeights(windowType, N);
  const cg = w.reduce((s, v) => s + v, 0) / N;
  const t = new Array(N);
  const raw = new Array(N);
  const windowed = new Array(N);
  const f1 = (cycles * fs) / N;
  const f2 = (cycles2 * fs) / N;

  for (let n = 0; n < N; n++) {
    const ti = n / fs;
    t[n] = ti;
    raw[n] = Math.sin(2 * Math.PI * f1 * ti) + amp2 * Math.sin(2 * Math.PI * f2 * ti);
    windowed[n] = raw[n] * w[n];
  }

  const spec = fft(windowed);
  const half = N / 2;
  const freqs = [], magLin = [], magDb = [];
  for (let k = 0; k < half; k++) {
    freqs.push((k * fs) / N);
    const scale = (k === 0 ? 1 : 2) / (N * Math.max(1e-6, cg));
    const m = Math.hypot(spec.re[k], spec.im[k]) * scale;
    magLin.push(m);
    magDb.push(20 * Math.log10(Math.max(1e-5, m)));
  }

  // Peak bin & leakage ratio (energy outside +-2 bins of peak)
  let peakBin = 0;
  for (let k = 1; k < half; k++) if (magLin[k] > magLin[peakBin]) peakBin = k;
  let totalE = 0, leakE = 0;
  for (let k = 0; k < half; k++) {
    const e = magLin[k] * magLin[k];
    totalE += e;
    if (Math.abs(k - peakBin) > 2) leakE += e;
  }
  const leakagePct = totalE > 1e-12 ? (leakE / totalE) * 100 : 0;

  return { t, raw, w, windowed, freqs, magLin, magDb, f1, peakFreq: freqs[peakBin], peakMag: magLin[peakBin], cg, leakagePct };
}

// =====================================================================
// 16. ÖRNEKLEME & ALIASING (Nyquist, ZOH/Sinc Recon, Quantization SQNR)
// =====================================================================

export function simulateSampling({
  f0 = 3.0,     // signal frequency (Hz)
  fs = 10.0,    // sampling frequency (Hz)
  bits = 4,     // quantization bits
  amp = 1.0,
  duration = 1.0,
} = {}) {
  const fNyq = fs / 2;
  const aliased = f0 > fNyq;
  const kFold = Math.round(f0 / fs);
  const fSigned = f0 - kFold * fs;
  const fAlias = Math.abs(fSigned);
  const phaseInverted = fSigned < 0;

  // Dense continuous timeline
  const Nc = 320;
  const tCont = [], xCont = [], xAlias = [], xZoh = [], xSinc = [];

  // Padded sample grid so sinc reconstruction is accurate throughout [0, duration]
  const nPad = 16;
  const nMax = Math.floor(duration * fs);
  const padSamples = [];
  for (let n = -nPad; n <= nMax + nPad; n++) {
    const tn = n / fs;
    padSamples.push({ n, t: tn, x: amp * Math.sin(2 * Math.PI * f0 * tn) });
  }

  // Visible samples in [0, duration]
  const tSamp = [], xSamp = [], xQuant = [], qErr = [];
  const levels = Math.pow(2, bits);
  const step = (2 * amp) / levels;
  const quantize = v => {
    const idx = Math.max(0, Math.min(levels - 1, Math.floor((v + amp) / step)));
    return -amp + (idx + 0.5) * step;
  };

  for (let n = 0; n <= nMax; n++) {
    const tn = n / fs;
    const xn = amp * Math.sin(2 * Math.PI * f0 * tn);
    const xq = quantize(xn);
    tSamp.push(tn);
    xSamp.push(xn);
    xQuant.push(xq);
    qErr.push(xq - xn);
  }

  for (let k = 0; k <= Nc; k++) {
    const ti = (duration * k) / Nc;
    tCont.push(ti);
    xCont.push(amp * Math.sin(2 * Math.PI * f0 * ti));
    xAlias.push((phaseInverted ? -amp : amp) * Math.sin(2 * Math.PI * fAlias * ti));
    const idx = Math.max(0, Math.min(nMax, Math.floor(ti * fs + 1e-12)));
    xZoh.push(xSamp[idx]);
    // Whittaker-Shannon sinc interpolation
    let acc = 0;
    for (const s of padSamples) {
      const u = fs * ti - s.n;
      const sc = Math.abs(u) < 1e-9 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
      acc += s.x * sc;
    }
    xSinc.push(acc);
  }

  // Empirical SQNR over many fine samples for reliable measurement
  let sigP = 0, errP = 0;
  const Mq = 2048;
  for (let k = 0; k < Mq; k++) {
    const v = amp * Math.sin((2 * Math.PI * 13 * k) / Mq);
    const e = quantize(v) - v;
    sigP += v * v;
    errP += e * e;
  }
  const sqnrMeasured = errP > 1e-18 ? 10 * Math.log10(sigP / errP) : 120;
  const sqnrTheory = 6.0205999 * bits + 1.7609126;

  // Spectral copies in [-2.5*fs, 2.5*fs]
  const copies = [];
  for (let m = -3; m <= 3; m++) {
    copies.push({ f: m * fs + f0, base: m === 0 });
    copies.push({ f: m * fs - f0, base: m === 0 });
  }

  // SQNR vs bits curve (2..12)
  const bitAxis = [], sqnrCurve = [];
  for (let b = 2; b <= 12; b++) {
    bitAxis.push(b);
    sqnrCurve.push(6.0205999 * b + 1.7609126);
  }

  return {
    f0, fs, fNyq, aliased, fAlias, phaseInverted, bits, levels, step,
    tCont, xCont, xAlias, xZoh, xSinc,
    tSamp, xSamp, xQuant, qErr,
    sqnrMeasured, sqnrTheory, copies, bitAxis, sqnrCurve,
  };
}

// =====================================================================
// 17. KONVOLÜSYON (Continuous & Discrete Flip-and-Slide)
// =====================================================================

export function evalContSignal(kind, t) {
  if (kind === 'rect') return t >= 0 && t <= 2 ? 1 : 0;
  if (kind === 'narrow') return t >= 0 && t <= 1 ? 1 : 0;
  if (kind === 'tri') return t >= 0 && t <= 2 ? 1 - Math.abs(t - 1) : 0;
  if (kind === 'exp') return t >= 0 ? Math.exp(-t) : 0;
  if (kind === 'step') return t >= 0 && t <= 4 ? 1 : 0;
  if (kind === 'sine') return t >= 0 && t <= 2 ? Math.sin(Math.PI * t) : 0;
  return 0;
}

export function continuousConvolution(xKind, hKind, { tMin = -2, tMax = 6, dt = 0.04, shiftT = 1.5 } = {}) {
  const tauMin = -4, tauMax = 8, dTau = 0.025;
  const nTau = Math.round((tauMax - tauMin) / dTau);
  const tau = new Array(nTau + 1);
  const xTau = new Array(nTau + 1);
  const hFlip = new Array(nTau + 1);
  const prod = new Array(nTau + 1);

  for (let i = 0; i <= nTau; i++) {
    const tv = tauMin + i * dTau;
    tau[i] = tv;
    xTau[i] = evalContSignal(xKind, tv);
    hFlip[i] = evalContSignal(hKind, shiftT - tv);
    prod[i] = xTau[i] * hFlip[i];
  }

  // Output y(t) over [tMin, tMax]
  const nT = Math.round((tMax - tMin) / dt);
  const tAxis = new Array(nT + 1);
  const yAxis = new Array(nT + 1);
  for (let k = 0; k <= nT; k++) {
    const tv = tMin + k * dt;
    tAxis[k] = tv;
    let sum = 0;
    for (let i = 0; i <= nTau; i++) {
      const w = i === 0 || i === nTau ? 0.5 : 1;
      sum += w * xTau[i] * evalContSignal(hKind, tv - tau[i]);
    }
    yAxis[k] = sum * dTau;
  }

  // Exact value at shiftT
  let yNow = 0;
  for (let i = 0; i <= nTau; i++) {
    const w = i === 0 || i === nTau ? 0.5 : 1;
    yNow += w * prod[i];
  }
  yNow *= dTau;

  return { tau, xTau, hFlip, prod, tAxis, yAxis, shiftT, yNow };
}

export function discreteSignal(kind) {
  if (kind === 'rect') return [1, 1, 1, 1];
  if (kind === 'ramp') return [0.25, 0.5, 0.75, 1];
  if (kind === 'exp') return [1, 0.65, 0.4225, 0.2746, 0.1785];
  if (kind === 'delta') return [1];
  if (kind === 'delay') return [0, 0, 1];
  if (kind === 'bipolar') return [1, 1, -1, -1];
  return [1, 1, 1];
}

export function discreteConvolution(x, h, shiftN = 2) {
  const Lx = x.length, Lh = h.length;
  const Ly = Lx + Lh - 1;
  const y = new Array(Ly).fill(0);
  for (let n = 0; n < Ly; n++) {
    let s = 0;
    for (let k = 0; k < Lx; k++) {
      const idx = n - k;
      if (idx >= 0 && idx < Lh) s += x[k] * h[idx];
    }
    y[n] = s;
  }

  // For visualization at index shiftN: k ranges from -Lh to Ly
  const kMin = -Lh + 1, kMax = Ly;
  const ks = [], xk = [], hFlip = [], prod = [];
  for (let k = kMin; k <= kMax; k++) {
    ks.push(k);
    const xv = k >= 0 && k < Lx ? x[k] : 0;
    const hi = shiftN - k;
    const hv = hi >= 0 && hi < Lh ? h[hi] : 0;
    xk.push(xv);
    hFlip.push(hv);
    prod.push(xv * hv);
  }
  const yNow = shiftN >= 0 && shiftN < Ly ? y[shiftN] : 0;
  return { x, h, y, ks, xk, hFlip, prod, shiftN, yNow };
}

// =====================================================================
// 18. DİJİTAL FİLTRE (FIR Window Method & IIR Butterworth Bilinear)
// =====================================================================

export function designFIR({
  band = 'lowpass', // 'lowpass' | 'highpass' | 'bandpass'
  fc = 0.2,         // normalized cutoff f/fs in (0.02, 0.48)
  fc2 = 0.35,       // upper cutoff for bandpass
  taps = 21,        // odd length
  windowType = 'hamming',
} = {}) {
  const N = taps % 2 === 0 ? taps + 1 : Math.max(5, taps);
  const M = (N - 1) / 2;
  const w = windowWeights(windowType, N);
  const f1 = Math.max(0.02, Math.min(0.47, fc));
  const f2 = Math.max(f1 + 0.03, Math.min(0.48, fc2));
  const sincLP = (n, fcut) => {
    const k = n - M;
    return k === 0 ? 2 * fcut : Math.sin(2 * Math.PI * fcut * k) / (Math.PI * k);
  };

  const b = new Array(N);
  for (let n = 0; n < N; n++) {
    let hi;
    if (band === 'lowpass') hi = sincLP(n, f1);
    else if (band === 'highpass') hi = (n === M ? 1 : 0) - sincLP(n, f1);
    else hi = sincLP(n, f2) - sincLP(n, f1);
    b[n] = hi * w[n];
  }

  // Normalize passband gain to 1
  const evalAt = fNorm => {
    const wRad = 2 * Math.PI * fNorm;
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      re += b[n] * Math.cos(-wRad * n);
      im += b[n] * Math.sin(-wRad * n);
    }
    return Math.hypot(re, im);
  };
  const refF = band === 'lowpass' ? 0 : band === 'highpass' ? 0.5 : 0.5 * (f1 + f2);
  const gRef = evalAt(refF);
  if (gRef > 1e-9) for (let n = 0; n < N; n++) b[n] /= gRef;

  const a = [1];
  const poles = Array.from({ length: Math.min(N - 1, 1) }, () => C(0, 0));
  const zeros = N <= 25 ? polyRoots(b) : [];

  return { kind: 'FIR', band, b, a, poles, zeros, stable: true, order: N - 1, taps: N };
}

export function designButterworthIIR({
  band = 'lowpass', // 'lowpass' | 'highpass' | 'bandpass'
  order = 2,        // 1..4 (for bandpass, prototype order 1 or 2 -> 2 or 4)
  fc = 0.2,
  fc2 = 0.35,
} = {}) {
  const Np = band === 'bandpass' ? Math.max(1, Math.min(2, Math.round(order / 2))) : Math.max(1, Math.min(4, Math.round(order)));
  const f1 = Math.max(0.02, Math.min(0.47, fc));
  const f2 = Math.max(f1 + 0.03, Math.min(0.48, fc2));

  // Analog unit-circle LHP Butterworth prototype poles
  const proto = [];
  for (let k = 0; k < Np; k++) {
    const ang = (Math.PI * (2 * k + Np + 1)) / (2 * Np);
    proto.push(C(Math.cos(ang), Math.sin(ang)));
  }

  const sPoles = [];
  const zZeros = [];
  const bilinear = s => cDiv(cAdd(C(1), s), cSub(C(1), s)); // s = (z-1)/(z+1) => z = (1+s)/(1-s)

  if (band === 'lowpass') {
    const Wc = Math.tan(Math.PI * f1);
    for (const sp of proto) {
      sPoles.push(cScale(sp, Wc));
      zZeros.push(C(-1, 0));
    }
  } else if (band === 'highpass') {
    const Wc = Math.tan(Math.PI * f1);
    for (const sp of proto) {
      sPoles.push(cDiv(C(Wc), sp));
      zZeros.push(C(1, 0));
    }
  } else {
    const W1 = Math.tan(Math.PI * f1);
    const W2 = Math.tan(Math.PI * f2);
    const W0 = Math.sqrt(W1 * W2);
    const B = W2 - W1;
    for (const sp of proto) {
      const bsp = cScale(sp, B);
      const disc = cSub(cMul(bsp, bsp), C(4 * W0 * W0, 0));
      const rootD = cSqrt(disc);
      sPoles.push(cScale(cAdd(bsp, rootD), 0.5));
      sPoles.push(cScale(cSub(bsp, rootD), 0.5));
      zZeros.push(C(1, 0), C(-1, 0));
    }
  }

  const zPoles = sPoles.map(bilinear);
  const a = polyFromRoots(zPoles);
  const bRaw = polyFromRoots(zZeros);

  // Normalize passband gain to 1
  const refF = band === 'lowpass' ? 0 : band === 'highpass' ? 0.5 : Math.atan(Math.sqrt(Math.tan(Math.PI * f1) * Math.tan(Math.PI * f2))) / Math.PI;
  const ejw = cPolar(1, 2 * Math.PI * refF);
  const Href = cAbs(cDiv(polyEvalC(bRaw, ejw), polyEvalC(a, ejw)));
  const gain = Href > 1e-12 ? 1 / Href : 1;
  const b = bRaw.map(v => v * gain);
  const maxPole = Math.max(...zPoles.map(cAbs));

  return { kind: 'IIR', band, b, a, poles: zPoles, zeros: zZeros, stable: maxPole < 1 - 1e-9, order: a.length - 1 };
}

export function digitalFreqResponse(b, a, nPts = 256) {
  const freqs = [], mag = [], magDb = [], phaseDeg = [];
  let prevPh = null, off = 0;
  for (let k = 0; k < nPts; k++) {
    const f = (0.5 * k) / (nPts - 1);
    freqs.push(f);
    const w = 2 * Math.PI * f;
    let numRe = 0, numIm = 0, denRe = 0, denIm = 0;
    for (let i = 0; i < b.length; i++) {
      numRe += b[i] * Math.cos(-w * i);
      numIm += b[i] * Math.sin(-w * i);
    }
    for (let i = 0; i < a.length; i++) {
      denRe += a[i] * Math.cos(-w * i);
      denIm += a[i] * Math.sin(-w * i);
    }
    const H = cDiv(C(numRe, numIm), C(denRe, denIm));
    const m = cAbs(H);
    mag.push(m);
    magDb.push(20 * Math.log10(Math.max(1e-5, m)));
    let ph = (cArg(H) * 180) / Math.PI;
    if (prevPh !== null) {
      while (ph + off - prevPh > 180) off -= 360;
      while (ph + off - prevPh < -180) off += 360;
    }
    prevPh = ph + off;
    phaseDeg.push(prevPh);
  }
  return { freqs, mag, magDb, phaseDeg };
}

export function applyIIR(b, a, x) {
  const N = x.length;
  const y = new Array(N).fill(0);
  const a0 = a[0] || 1;
  for (let n = 0; n < N; n++) {
    let acc = 0;
    for (let k = 0; k < b.length; k++) {
      if (n - k >= 0) acc += b[k] * x[n - k];
    }
    for (let j = 1; j < a.length; j++) {
      if (n - j >= 0) acc -= a[j] * y[n - j];
    }
    y[n] = acc / a0;
  }
  return y;
}

// =====================================================================
// 19. LAPLACE & z DÖNÜŞÜMÜ (s-plane / z-plane Poles -> Impulse Response)
// =====================================================================

export function laplacePoleResponse({
  sigma = -0.6,
  omega = 4.0,
  conjugate = true,
  hasZero = false,
  zeroRe = -2.0,
  tEnd = 6,
  nPts = 240,
} = {}) {
  const t = new Array(nPts);
  const h = new Array(nPts);
  const step = new Array(nPts);

  for (let k = 0; k < nPts; k++) {
    const ti = (tEnd * k) / (nPts - 1);
    t[k] = ti;
    const env = Math.exp(Math.max(-30, Math.min(12, sigma * ti)));
    if (!conjugate || Math.abs(omega) < 1e-4) {
      // H(s) = 1 / (s - sigma)
      h[k] = env;
      step[k] = Math.abs(sigma) < 1e-5 ? ti : (env - 1) / sigma;
    } else if (!hasZero) {
      // H(s) = omega / ((s - sigma)^2 + omega^2) -> h(t) = e^{sigma t} sin(omega t)
      h[k] = env * Math.sin(omega * ti);
      const wn2 = sigma * sigma + omega * omega;
      step[k] = (omega / wn2) * (1 - env * (Math.cos(omega * ti) - (sigma / omega) * Math.sin(omega * ti)));
    } else {
      // H(s) = (s - z0) / ((s - sigma)^2 + omega^2) -> h(t) = e^{sigma t} [cos(wt) + ((sigma-z0)/w) sin(wt)]
      const c2 = (sigma - zeroRe) / omega;
      h[k] = env * (Math.cos(omega * ti) + c2 * Math.sin(omega * ti));
      // Integral of h(t)
      const wn2 = sigma * sigma + omega * omega;
      const intCos = (env * (sigma * Math.cos(omega * ti) + omega * Math.sin(omega * ti)) - sigma) / wn2;
      const intSin = (env * (sigma * Math.sin(omega * ti) - omega * Math.cos(omega * ti)) + omega) / wn2;
      step[k] = intCos + c2 * intSin;
    }
  }

  const wn = conjugate ? Math.hypot(sigma, omega) : Math.abs(sigma);
  const zeta = wn > 1e-9 ? -sigma / wn : 0;
  const stability = sigma < -1e-4 ? 'Kararlı' : Math.abs(sigma) <= 1e-4 ? 'Sınırda Kararlı' : 'Kararsız';
  const roc = `Re(s) > ${sigma.toFixed(2)}`;
  const tau = sigma < -1e-4 ? -1 / sigma : Infinity;

  return { t, h, step, sigma, omega: conjugate ? omega : 0, wn, zeta, tau, stability, roc };
}

export function zPoleResponse({
  re = 0.72,
  im = 0.45,
  conjugate = true,
  hasZero = false,
  zeroRe = -0.5,
  nSamples = 32,
} = {}) {
  const r = conjugate ? Math.hypot(re, im) : Math.abs(re);
  const theta = conjugate ? Math.atan2(im, re) : (re < 0 ? Math.PI : 0);

  let b, a;
  if (!conjugate) {
    // H(z) = z / (z - p) = 1 / (1 - p z^-1) -> h[n] = p^n
    b = hasZero ? [1, -zeroRe] : [1];
    a = [1, -re];
  } else {
    // H(z) = (1 - r cos(theta) z^-1) / (1 - 2 r cos(theta) z^-1 + r^2 z^-2) -> h[n] = r^n cos(n theta)
    b = hasZero ? [1, -zeroRe] : [1, -re];
    a = [1, -2 * re, re * re + im * im];
  }

  const imp = new Array(nSamples).fill(0); imp[0] = 1;
  const stp = new Array(nSamples).fill(1);
  const h = applyIIR(b, a, imp);
  const step = applyIIR(b, a, stp);
  const ns = Array.from({ length: nSamples }, (_, i) => i);

  const stability = r < 1 - 1e-4 ? 'Kararlı' : Math.abs(r - 1) <= 1e-4 ? 'Sınırda Kararlı' : 'Kararsız';
  const roc = `|z| > ${r.toFixed(2)}`;

  return { ns, h, step, r, theta, thetaDeg: (theta * 180) / Math.PI, b, a, stability, roc };
}

export function sToZMap(sigma, omega, Ts = 0.1) {
  const r = Math.exp(sigma * Ts);
  const theta = omega * Ts;
  const z = cPolar(r, theta);
  const aliased = Math.abs(theta) > Math.PI;
  return { z, r, theta, thetaDeg: (theta * 180) / Math.PI, aliased };
}
