// MathPad Physics & Exceptional Structures Group Theory Engine (Ramond Part C)
// Pure mathematical & physics engine — zero DOM dependencies.
// Covers Ramond Ch. 1 (Preface), 4 (Hilbert Spaces), 5.5 (SU(2) Applications),
// 6.7.1–6.7.3 (SU(3) in Physics), 11 (Space-Time & Standard Model), 12 (Exceptional Structures).

// =====================================================================
// 1. COMPLEX NUMBERS, MATRICES & FINITE HILBERT SPACES (Ch. 4.1)
// =====================================================================

export const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cConj = a => [a[0], -a[1]];
export const cAbs2 = a => a[0] * a[0] + a[1] * a[1];
export const cAbs = a => Math.hypot(a[0], a[1]);
export const cScale = (a, s) => [a[0] * s, a[1] * s];
export const cDiv = (a, b) => {
  const d = cAbs2(b);
  if (d === 0) throw new Error('Sıfıra bölme hatası (karmaşık sayı)');
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
export const cExp = a => {
  const r = Math.exp(a[0]);
  return [r * Math.cos(a[1]), r * Math.sin(a[1])];
};

export function matZero(rows, cols = rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [0, 0])
  );
}

export function matId(n) {
  const M = matZero(n, n);
  for (let i = 0; i < n; i++) M[i][i] = [1, 0];
  return M;
}

export function matAdd(A, B) {
  const r = A.length, c = A[0].length;
  const out = matZero(r, c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) out[i][j] = cAdd(A[i][j], B[i][j]);
  }
  return out;
}

export function matSub(A, B) {
  const r = A.length, c = A[0].length;
  const out = matZero(r, c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) out[i][j] = cSub(A[i][j], B[i][j]);
  }
  return out;
}

export function matScale(A, s) {
  const sc = Array.isArray(s) ? s : [s, 0];
  return A.map(row => row.map(z => cMul(z, sc)));
}

export function matMul(A, B) {
  const r = A.length, kLen = A[0].length, c = B[0].length;
  const out = matZero(r, c);
  for (let i = 0; i < r; i++) {
    for (let k = 0; k < kLen; k++) {
      const aik = A[i][k];
      if (aik[0] === 0 && aik[1] === 0) continue;
      for (let j = 0; j < c; j++) {
        const bkj = B[k][j];
        out[i][j][0] += aik[0] * bkj[0] - aik[1] * bkj[1];
        out[i][j][1] += aik[0] * bkj[1] + aik[1] * bkj[0];
      }
    }
  }
  return out;
}

export function matDag(A) {
  const r = A.length, c = A[0].length;
  const out = matZero(c, r);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) out[j][i] = cConj(A[i][j]);
  }
  return out;
}

export const matComm = (A, B) => matSub(matMul(A, B), matMul(B, A));
export const matAntiComm = (A, B) => matAdd(matMul(A, B), matMul(B, A));

export function matTrace(A) {
  let re = 0, im = 0;
  const n = Math.min(A.length, A[0].length);
  for (let i = 0; i < n; i++) { re += A[i][i][0]; im += A[i][i][1]; }
  return [re, im];
}

export function matNormFrob(A) {
  let sum = 0;
  for (const row of A) {
    for (const z of row) sum += cAbs2(z);
  }
  return Math.sqrt(sum);
}

export function matApproxEq(A, B, eps = 1e-9) {
  if (A.length !== B.length || A[0].length !== B[0].length) return false;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[0].length; j++) {
      if (Math.hypot(A[i][j][0] - B[i][j][0], A[i][j][1] - B[i][j][1]) > eps) return false;
    }
  }
  return true;
}

export function kron(A, B) {
  const ra = A.length, ca = A[0].length;
  const rb = B.length, cb = B[0].length;
  const out = matZero(ra * rb, ca * cb);
  for (let i = 0; i < ra; i++) {
    for (let j = 0; j < ca; j++) {
      const aij = A[i][j];
      if (aij[0] === 0 && aij[1] === 0) continue;
      for (let p = 0; p < rb; p++) {
        for (let q = 0; q < cb; q++) {
          out[i * rb + p][j * cb + q] = cMul(aij, B[p][q]);
        }
      }
    }
  }
  return out;
}

// Physicist convention: <psi|phi> = sum_k psi_k^* phi_k
export function innerProduct(psi, phi) {
  if (psi.length !== phi.length) throw new Error('Durum vektörleri aynı boyutta olmalı');
  let re = 0, im = 0;
  for (let i = 0; i < psi.length; i++) {
    const p = cMul(cConj(psi[i]), phi[i]);
    re += p[0];
    im += p[1];
  }
  return [re, im];
}

export function vecNorm(psi) {
  let s = 0;
  for (const z of psi) s += cAbs2(z);
  return Math.sqrt(s);
}

export function normalizeState(psi) {
  const n = vecNorm(psi);
  if (n === 0) return psi.map(() => [0, 0]);
  return psi.map(z => [z[0] / n, z[1] / n]);
}

export function applyOperator(U, psi) {
  return U.map(row => {
    let re = 0, im = 0;
    for (let j = 0; j < row.length; j++) {
      const p = cMul(row[j], psi[j]);
      re += p[0]; im += p[1];
    }
    return [re, im];
  });
}

export function isUnitary(U, eps = 1e-9) {
  const n = U.length;
  if (!n || U[0].length !== n) return { ok: false, maxError: Infinity };
  const prod = matMul(matDag(U), U);
  const diff = matSub(prod, matId(n));
  const err = matNormFrob(diff);
  return { ok: err <= eps, maxError: err };
}

// Fundamental SU(2) rotation U(n, theta) = exp(-i theta/2 n.sigma)
export function su2Matrix(theta, axis = [0, 0, 1]) {
  const norm = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const nx = axis[0] / norm, ny = axis[1] / norm, nz = axis[2] / norm;
  const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
  return [
    [[c, -s * nz], [-s * ny, -s * nx]],
    [[s * ny, -s * nx], [c, s * nz]],
  ];
}

export function u1PhaseMatrix(phi, dim = 2) {
  const phase = [Math.cos(phi), Math.sin(phi)];
  const M = matZero(dim, dim);
  for (let i = 0; i < dim; i++) M[i][i] = [phase[0], phase[1]];
  return M;
}

// =====================================================================
// 2. FERMI OSCILLATORS & SO(2n) SPINORS (Ch. 4.2)
// =====================================================================

const SIGMA_Z = [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]];
const I2 = matId(2);
const C_ANN = [[[0, 0], [1, 0]], [[0, 0], [0, 0]]]; // c|1> = |0>
const C_CRE = [[[0, 0], [0, 0]], [[1, 0], [0, 0]]]; // c^dag|0> = |1>

const FERMI_CACHE = new Map();

export function fermiOperators(n) {
  n = Math.trunc(n);
  if (n < 1 || n > 4) throw new Error('Fermi modu sayısı n = 1..4 aralığında olmalı');
  if (FERMI_CACHE.has(n)) return FERMI_CACHE.get(n);

  const dim = 1 << n;
  const a = [];
  const aDag = [];
  const N = [];

  for (let i = 0; i < n; i++) {
    let op = [[ [1, 0] ]];
    for (let k = 0; k < n; k++) {
      const factor = k < i ? SIGMA_Z : (k === i ? C_ANN : I2);
      op = kron(op, factor);
    }
    const opDag = matDag(op);
    a.push(op);
    aDag.push(opDag);
    N.push(matMul(opDag, op));
  }

  let NTotal = matZero(dim, dim);
  for (let i = 0; i < n; i++) NTotal = matAdd(NTotal, N[i]);

  // Fock basis states |n_1, ..., n_n>
  const basis = [];
  const parity = matZero(dim, dim);
  for (let idx = 0; idx < dim; idx++) {
    const occ = [];
    let count = 0;
    for (let i = 0; i < n; i++) {
      const bit = (idx >> (n - 1 - i)) & 1;
      occ.push(bit);
      count += bit;
    }
    const sign = count % 2 === 0 ? 1 : -1;
    parity[idx][idx] = [sign, 0];
    basis.push({
      index: idx,
      occ,
      label: `|${occ.join('')}\\rangle`,
      text: `|${occ.join('')}⟩`,
      particleCount: count,
      chirality: count % 2 === 0 ? '+' : '-',
    });
  }

  // Bilinears E_ij = a_i^dag a_j generating u(n)
  const bilinears = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => matMul(aDag[i], a[j]))
  );

  // Real Clifford (Majorana / Gamma) matrices for SO(2n):
  // gamma_{2k} = a_k + a_k^dag, gamma_{2k+1} = -i(a_k - a_k^dag)
  const gamma = [];
  for (let k = 0; k < n; k++) {
    gamma.push(matAdd(a[k], aDag[k]));
    gamma.push(matScale(matSub(a[k], aDag[k]), [0, -1]));
  }

  const res = { n, dim, a, aDag, N, NTotal, basis, bilinears, gamma, parity };
  FERMI_CACHE.set(n, res);
  return res;
}

export function verifyFermiAnticommutators(n) {
  const { dim, a, aDag } = fermiOperators(n);
  const I = matId(dim);
  const Z = matZero(dim, dim);
  let maxError = 0;
  const checks = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const target = i === j ? I : Z;
      const errADag = matNormFrob(matSub(matAntiComm(a[i], aDag[j]), target));
      const errAA = matNormFrob(matAntiComm(a[i], a[j]));
      const errDagDag = matNormFrob(matAntiComm(aDag[i], aDag[j]));
      maxError = Math.max(maxError, errADag, errAA, errDagDag);
      checks.push({ i: i + 1, j: j + 1, errADag, errAA, errDagDag });
    }
  }
  return { n, dim, ok: maxError < 1e-12, maxError, checks };
}

export function verifyUnBilinears(n) {
  const { bilinears, dim } = fermiOperators(n);
  const Z = matZero(dim, dim);
  let maxError = 0;
  let totalChecks = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        for (let l = 0; l < n; l++) {
          const lhs = matComm(bilinears[i][j], bilinears[k][l]);
          let rhs = Z;
          if (j === k) rhs = matAdd(rhs, bilinears[i][l]);
          if (i === l) rhs = matSub(rhs, bilinears[k][j]);
          const err = matNormFrob(matSub(lhs, rhs));
          if (err > maxError) maxError = err;
          totalChecks++;
        }
      }
    }
  }
  return { n, algebra: `u(${n})`, dimGenerators: n * n, totalChecks, ok: maxError < 1e-12, maxError };
}

export function fermiSpinorSplit(n) {
  const { dim, gamma, basis, parity } = fermiOperators(n);
  const I = matId(dim);
  const twoN = 2 * n;
  let maxCliffErr = 0;
  let maxParityCommErr = 0;

  for (let mu = 0; mu < twoN; mu++) {
    for (let nu = 0; nu < twoN; nu++) {
      const target = mu === nu ? matScale(I, 2) : matZero(dim, dim);
      const err = matNormFrob(matSub(matAntiComm(gamma[mu], gamma[nu]), target));
      if (err > maxCliffErr) maxCliffErr = err;
      if (mu < nu) {
        const sigma = matScale(matComm(gamma[mu], gamma[nu]), [0, -0.25]);
        const pErr = matNormFrob(matComm(parity, sigma));
        if (pErr > maxParityCommErr) maxParityCommErr = pErr;
      }
    }
  }

  const evenStates = basis.filter(b => b.chirality === '+');
  const oddStates = basis.filter(b => b.chirality === '-');
  return {
    n,
    algebra: `SO(${twoN})`,
    algebraDim: n * (2 * n - 1),
    spinorDim: dim,
    chiralDims: [evenStates.length, oddStates.length],
    evenStates,
    oddStates,
    cliffordOk: maxCliffErr < 1e-12,
    maxCliffErr,
    chiralSplitOk: maxParityCommErr < 1e-12,
    maxParityCommErr,
  };
}

// =====================================================================
// 3. INFINITE HILBERT SPACES: BOSONIC OSCILLATOR & COHERENT STATES (Ch. 4.3)
// =====================================================================

export function bosonTruncated(dim = 8) {
  dim = Math.max(2, Math.min(32, Math.trunc(dim)));
  const a = matZero(dim, dim);
  for (let n = 1; n < dim; n++) {
    a[n - 1][n] = [Math.sqrt(n), 0];
  }
  const aDag = matDag(a);
  const N = matMul(aDag, a);
  const comm = matComm(a, aDag);
  const traceComm = matTrace(comm);
  let maxBulkError = 0;
  for (let i = 0; i < dim - 1; i++) {
    maxBulkError = Math.max(maxBulkError, Math.abs(comm[i][i][0] - 1));
  }
  const defectEntry = comm[dim - 1][dim - 1][0]; // equals -(dim - 1)
  return { dim, a, aDag, N, comm, traceComm, defectEntry, maxBulkError };
}

export function coherentState(alphaRe, alphaIm = 0, dim = 20) {
  dim = Math.max(4, Math.min(48, Math.trunc(dim)));
  const alpha = [alphaRe, alphaIm];
  const r2 = cAbs2(alpha);
  const pref = Math.exp(-r2 / 2);
  const coeffs = [];
  const probs = [];
  let pow = [1, 0];
  let sqrtFact = 1;
  let norm2 = 0;

  for (let n = 0; n < dim; n++) {
    if (n > 0) {
      pow = cMul(pow, alpha);
      sqrtFact *= Math.sqrt(n);
    }
    const cn = cScale(pow, pref / sqrtFact);
    const p = cAbs2(cn);
    coeffs.push(cn);
    probs.push(p);
    norm2 += p;
  }

  // Eigenstate test a|alpha> vs alpha|alpha> in truncated space
  const { a } = bosonTruncated(dim);
  const aKet = applyOperator(a, coeffs);
  let err2 = 0;
  for (let n = 0; n < dim; n++) {
    const target = cMul(alpha, coeffs[n]);
    err2 += cAbs2(cSub(aKet[n], target));
  }
  const eigenError = Math.sqrt(err2);

  return {
    alpha,
    dim,
    coeffs,
    probs,
    norm2,
    meanN: r2,
    varN: r2,
    meanX: Math.SQRT2 * alphaRe,
    meanP: Math.SQRT2 * alphaIm,
    uncertaintyProduct: 0.5,
    eigenError,
  };
}

// =====================================================================
// 4. 3D ISOTROPIC HARMONIC OSCILLATOR & SU(3) DEGENERACY (Ch. 5.5.1, 6.7.1)
// =====================================================================

export function su3Dim(p, q) {
  p = Math.trunc(p);
  q = Math.trunc(q);
  if (p < 0 || q < 0) return 0;
  return ((p + 1) * (q + 1) * (p + q + 2)) / 2;
}

export function oscillatorShell(N) {
  N = Math.trunc(N);
  if (N < 0 || N > 20) throw new Error('Kuantum sayısı N = 0..20 olmalı');
  const states = [];
  for (let nx = N; nx >= 0; nx--) {
    for (let ny = N - nx; ny >= 0; ny--) {
      const nz = N - nx - ny;
      const t3 = (nx - ny) / 2;
      const y = (nx + ny - 2 * nz) / 3;
      states.push({ nx, ny, nz, t3, y });
    }
  }
  const degeneracy = ((N + 1) * (N + 2)) / 2;
  const lValues = [];
  for (let l = N; l >= 0; l -= 2) lValues.push(l);
  const so3Sum = lValues.reduce((acc, l) => acc + (2 * l + 1), 0);
  const su3D = su3Dim(N, 0);

  return {
    N,
    energyCoeff: N + 1.5,
    energyLatex: `\\left(${N} + \\frac{3}{2}\\right)\\hbar\\omega = \\frac{${2 * N + 3}}{2}\\hbar\\omega`,
    degeneracy,
    su3Irrep: [N, 0],
    su3Dim: su3D,
    parity: N % 2 === 0 ? 1 : -1,
    lValues,
    so3Sum,
    matchesDegeneracy: states.length === degeneracy && so3Sum === degeneracy && su3D === degeneracy,
    states,
  };
}

// =====================================================================
// 5. BOHR ATOM & HIDDEN SO(4) SYMMETRY (Ch. 5.5.2)
// =====================================================================

export const BOHR_E1_EV = 13.605693; // Hydrogen ground-state binding energy (eV)
export const HC_EV_NM = 1239.841984; // h*c in eV·nm

export function bohrEnergy(n) {
  n = Math.trunc(n);
  if (n < 1) throw new Error('Baş kuantum sayısı n >= 1 olmalı');
  return -BOHR_E1_EV / (n * n);
}

export function bohrLevel(n) {
  n = Math.trunc(n);
  if (n < 1 || n > 12) throw new Error('Baş kuantum sayısı n = 1..12 olmalı');
  const lValues = Array.from({ length: n }, (_, l) => l);
  const so3Sum = lValues.reduce((acc, l) => acc + (2 * l + 1), 0);
  const j = (n - 1) / 2;
  const degeneracy = n * n;
  return {
    n,
    energyEv: bohrEnergy(n),
    degeneracy,
    withSpinDegeneracy: 2 * degeneracy,
    so4Irrep: [j, j],
    lValues,
    so3Sum,
    matchesDegeneracy: so3Sum === degeneracy && Math.round((2 * j + 1) ** 2) === degeneracy,
    casimirC: n * n - 1,
    bohrRadiusA0: n * n,
  };
}

// Approximate RGB for visible wavelengths (380-750 nm) for spectral canvas
export function wavelengthToRgb(nm) {
  if (nm < 380) return '#a78bfa'; // UV
  if (nm > 750) return '#fb7185'; // IR
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; g = 0; b = 1; }
  else if (nm < 490) { r = 0; g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { r = 0; g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; b = 0; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; b = 0; }
  else { r = 1; g = 0; b = 0; }
  const f = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40
    : nm > 700 ? 0.35 + 0.65 * (750 - nm) / 50 : 1;
  const ch = x => Math.round(255 * Math.pow(Math.max(0, x * f), 0.8));
  return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
}

const SERIES_NAMES = {
  1: 'Lyman',
  2: 'Balmer',
  3: 'Paschen',
  4: 'Brackett',
  5: 'Pfund',
};

export function bohrTransition(nUpper, nLower) {
  nUpper = Math.trunc(nUpper);
  nLower = Math.trunc(nLower);
  if (nLower < 1 || nUpper <= nLower) {
    throw new Error('Geçiş için n_üst > n_alt >= 1 olmalı');
  }
  const deltaEv = bohrEnergy(nUpper) - bohrEnergy(nLower);
  const wavelengthNm = HC_EV_NM / deltaEv;
  const seriesName = SERIES_NAMES[nLower] || `n=${nLower} Serisi`;
  const region = wavelengthNm < 380 ? 'Morötesi (UV)'
    : wavelengthNm <= 750 ? 'Görünür Işık' : 'Kızılötesi (IR)';
  const greekIdx = nUpper - nLower - 1;
  const greek = ['α', 'β', 'γ', 'δ', 'ε', 'ζ'][greekIdx] || `(${nUpper}→${nLower})`;
  return {
    nUpper,
    nLower,
    label: `${seriesName}-${greek}`,
    deltaEv,
    wavelengthNm,
    seriesName,
    region,
    visibleRgb: wavelengthToRgb(wavelengthNm),
  };
}

export function bohrSeries(nLower, maxUpper = 7) {
  const lines = [];
  for (let u = nLower + 1; u <= maxUpper; u++) {
    lines.push(bohrTransition(u, nLower));
  }
  return lines;
}

// =====================================================================
// 6. ISOSPIN, CLEBSCH-GORDAN, ELLIOTT & SAKATA MODELS (Ch. 5.5.3, 6.7.2-3)
// =====================================================================

const FACT_CACHE = [1];
function fact(n) {
  if (n < 0) return 0;
  while (FACT_CACHE.length <= n) {
    FACT_CACHE.push(FACT_CACHE[FACT_CACHE.length - 1] * FACT_CACHE.length);
  }
  return FACT_CACHE[n];
}

// Exact SU(2) Clebsch-Gordan coefficient <j1 m1; j2 m2 | J M> via Racah's formula
export function clebschGordan(j1, m1, j2, m2, J, M) {
  const isHalfInt = x => Math.abs(2 * x - Math.round(2 * x)) < 1e-9;
  if (![j1, m1, j2, m2, J, M].every(isHalfInt)) return 0;
  const twice = x => Math.round(2 * x);
  const J1 = twice(j1), M1 = twice(m1), J2 = twice(j2), M2 = twice(m2), JJ = twice(J), MM = twice(M);
  if (M1 + M2 !== MM) return 0;
  if (Math.abs(M1) > J1 || Math.abs(M2) > J2 || Math.abs(MM) > JJ) return 0;
  if (JJ < Math.abs(J1 - J2) || JJ > J1 + J2) return 0;
  if ((J1 + J2 + JJ) % 2 !== 0) return 0;
  if ((J1 - M1) % 2 !== 0 || (J2 - M2) % 2 !== 0 || (JJ - MM) % 2 !== 0) return 0;

  const a = (JJ + J1 - J2) / 2;
  const b = (JJ - J1 + J2) / 2;
  const c = (J1 + J2 - JJ) / 2;
  const d = (J1 + J2 + JJ) / 2 + 1;
  const pref = Math.sqrt(
    ((JJ + 1) * fact(a) * fact(b) * fact(c) / fact(d)) *
    fact((JJ + MM) / 2) * fact((JJ - MM) / 2) *
    fact((J1 - M1) / 2) * fact((J1 + M1) / 2) *
    fact((J2 - M2) / 2) * fact((J2 + M2) / 2)
  );

  const kMin = Math.max(0, (J2 - JJ - M1) / 2, (J1 - JJ + M2) / 2);
  const kMax = Math.min(c, (J1 - M1) / 2, (J2 + M2) / 2);
  let sum = 0;
  for (let k = kMin; k <= kMax; k++) {
    const denom = fact(k) *
      fact(c - k) *
      fact((J1 - M1) / 2 - k) *
      fact((J2 + M2) / 2 - k) *
      fact((JJ - J2 + M1) / 2 + k) *
      fact((JJ - J1 - M2) / 2 + k);
    sum += (k % 2 === 0 ? 1 : -1) / denom;
  }
  const val = pref * sum;
  return Math.abs(val) < 1e-12 ? 0 : val;
}

export function coupleIsospin(I1, I2) {
  const irreps = [];
  const jMin = Math.abs(I1 - I2);
  const jMax = I1 + I2;
  for (let J = jMax; J >= jMin - 1e-9; J -= 1) {
    const states = [];
    for (let M = J; M >= -J - 1e-9; M -= 1) {
      const terms = [];
      for (let m1 = I1; m1 >= -I1 - 1e-9; m1 -= 1) {
        const m2 = M - m1;
        if (m2 >= -I2 - 1e-9 && m2 <= I2 + 1e-9) {
          const cg = clebschGordan(I1, m1, I2, m2, J, M);
          if (Math.abs(cg) > 1e-10) terms.push({ m1, m2, cg });
        }
      }
      states.push({ J, M, terms });
    }
    const sym = Math.abs(I1 - I2) < 1e-9
      ? (Math.round(2 * I1 - J) % 2 === 0 ? 'Simetrik' : 'Antisimetrik')
      : null;
    irreps.push({ J, dim: Math.round(2 * J + 1), symmetry: sym, states });
  }
  return {
    I1,
    I2,
    productDim: Math.round((2 * I1 + 1) * (2 * I2 + 1)),
    irreps,
  };
}

export const NUCLEONS = [
  { symbol: 'p', name: 'Proton', I: 0.5, I3: +0.5, Q: +1, B: 1, massMeV: 938.272, quarks: 'uud' },
  { symbol: 'n', name: 'Nötron', I: 0.5, I3: -0.5, Q: 0, B: 1, massMeV: 939.565, quarks: 'udd' },
];

export const PIONS = [
  { symbol: 'π⁺', tex: '\\pi^+', I: 1, I3: +1, Q: +1, massMeV: 139.570, quarks: 'u\\bar{d}' },
  { symbol: 'π⁰', tex: '\\pi^0', I: 1, I3: 0, Q: 0, massMeV: 134.977, quarks: '(u\\bar{u}-d\\bar{d})/\\sqrt{2}' },
  { symbol: 'π⁻', tex: '\\pi^-', I: 1, I3: -1, Q: -1, massMeV: 139.570, quarks: 'd\\bar{u}' },
];

export const TWO_NUCLEON_STATES = [
  { name: 'Döteron (²H)', I: 0, I3: 0, S: 1, L: '0 (ve %4 L=2)', isospinSym: 'Antisimetrik', spinSym: 'Simetrik', bound: true, note: 'Genelleştirilmiş Pauli ilkesi: uzay (S) × spin (S) × izospin (A) = toplam antisimetrik!' },
  { name: 'Diproton (pp)', I: 1, I3: +1, S: 0, L: '0', isospinSym: 'Simetrik', spinSym: 'Antisimetrik', bound: false, note: 'I=1 spin-tekli potansiyel yeterince çekici değildir; kararlı bağlı durum yoktur.' },
  { name: 'Dinötron (nn)', I: 1, I3: -1, S: 0, L: '0', isospinSym: 'Simetrik', spinSym: 'Antisimetrik', bound: false, note: 'Yük bağımsızlığı gereği pp (Coulomb hariç) ve pn(I=1) ile aynı I=1 üçlüsündedir.' },
  { name: 'pn (I=1, S=0)', I: 1, I3: 0, S: 0, L: '0', isospinSym: 'Simetrik', spinSym: 'Antisimetrik', bound: false, note: 'Sanal bağlı durum (~66 keV yukarıda); döterondan farklı olarak bağlı değildir.' },
];

// Elliott SU(3) nuclear model (Ch. 6.7.2)
export function elliottCasimir(lam, mu) {
  return lam * lam + mu * mu + lam * mu + 3 * (lam + mu);
}

// Exact Elliott SU(3) -> SO(3) branching rule for any irrep (lambda, mu)
export function elliottBranching(lam, mu) {
  lam = Math.trunc(lam);
  mu = Math.trunc(mu);
  if (lam < 0 || mu < 0) throw new Error('(λ, μ) negatif olamaz');
  const kMax = Math.min(lam, mu);
  const mMax = Math.max(lam, mu);
  const bands = [];
  let totalStates = 0;

  for (let K = kMax; K >= 0; K -= 2) {
    const LValues = [];
    if (K === 0) {
      for (let L = mMax; L >= 0; L -= 2) LValues.push(L);
      LValues.reverse();
    } else {
      for (let L = K; L <= K + mMax; L++) LValues.push(L);
    }
    const bandDim = LValues.reduce((s, L) => s + (2 * L + 1), 0);
    totalStates += bandDim;
    bands.push({ K, LValues, bandDim });
  }
  bands.sort((a, b) => a.K - b.K);
  const dim = su3Dim(lam, mu);
  return {
    lam,
    mu,
    dim,
    casimir: elliottCasimir(lam, mu),
    bands,
    totalStates,
    matchesDim: totalStates === dim,
  };
}

export const ELLIOTT_SD_NUCLEI = [
  { nucleus: '¹⁷O / ¹⁷F', valence: 1, lam: 2, mu: 0, shape: 'Prolate (tek parçacık)', note: 'Tek valans nükleon sd-kabuğunun (2,0) temel temsilinde (L = 0, 2).' },
  { nucleus: '¹⁸O / ¹⁸F', valence: 2, lam: 4, mu: 0, shape: 'Prolate', note: 'Sym²(2,0) = (4,0) ⊕ (0,2); öncü dönme bandı (4,0), L = 0⁺, 2⁺, 4⁺.' },
  { nucleus: '²⁰Ne', valence: 4, lam: 8, mu: 0, shape: 'Güçlü Prolate', note: '4 nükleon (α kümesi) maksimum uzay simetrisi [4] ile (8,0) verir: K=0 bandı L = 0⁺..8⁺!' },
  { nucleus: '²⁴Mg', valence: 8, lam: 8, mu: 4, shape: 'Üç Eksenli (Triaksiyel)', note: 'K=0 (taban) ve K=2 (γ-bandı) birlikte aynı (8,4) SU(3) temsilinden çıkar!' },
  { nucleus: '²⁸Si', valence: 12, lam: 0, mu: 12, shape: 'Oblate (yarı dolu kabuk)', note: 'Yarı dolu sd-kabuğu; (0,12) yassı (oblate) ile (12,0) uzamış (prolate) eşdeğer Casimir değerine sahip.' },
  { nucleus: '³⁶Ar', valence: 20, lam: 0, mu: 8, shape: 'Oblate (4 boşluk)', note: '⁴⁰Ca kapalı kabuğunda 4 nükleon boşluğu: ²⁰Ne\'nin (8,0) temsilinin eşleniği (0,8).' },
];

// Sakata model (Ch. 6.7.3)
export const SAKATA_TRIPLET = [
  { symbol: 'p', name: 'Proton', Q: +1, I3: +0.5, S: 0, B: +1, Y: +1 },
  { symbol: 'n', name: 'Nötron', Q: 0, I3: -0.5, S: 0, B: +1, Y: +1 },
  { symbol: 'Λ', name: 'Lambda', Q: 0, I3: 0, S: -1, B: +1, Y: 0 },
];

export const SAKATA_DECOMPOSITIONS = {
  mesons: {
    formula: '\\mathbf{3} \\otimes \\bar{\\mathbf{3}} = \\mathbf{8} \\oplus \\mathbf{1}',
    dims: [8, 1],
    product: 9,
    verdict: 'Başarılı',
    detail: 'Pseudoskaler mezon sekizlisi (π±, π⁰, K±, K⁰, K̄⁰, η) ve teklisi (η′) doğru üretildi.',
  },
  baryons: {
    formula: '\\mathbf{3} \\otimes \\mathbf{3} \\otimes \\bar{\\mathbf{3}} = \\mathbf{15} \\oplus \\bar{\\mathbf{6}} \\oplus \\mathbf{3} \\oplus \\mathbf{3}',
    dims: [15, 6, 3, 3],
    product: 27,
    verdict: 'Deneyle çelişti',
    detail: 'Σ ve Ξ baryonlarını 15\'liye yerleştirmek gözlenmeyen S=+1 baryonlar ve yanlış Ξ spini öngördü → Sekizli Yol (8) ve kesirli yüklü kuarklara (u,d,s) geçildi.',
  },
};

// =====================================================================
// 7. SPACE-TIME: LORENTZ SO(3,1), SL(2,C), POINCARE, CONFORMAL SO(4,2) (Ch. 11.1)
// =====================================================================

export const MINKOWSKI_METRIC = [
  [1, 0, 0, 0],
  [0, -1, 0, 0],
  [0, 0, -1, 0],
  [0, 0, 0, -1],
];

export function matMul4(A, B) {
  const C = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 4; j++) C[i][j] += A[i][k] * B[k][j];
    }
  }
  return C;
}

export function matTranspose4(A) {
  const T = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) T[i][j] = A[j][i];
  }
  return T;
}

export function apply4(M, v) {
  return [0, 1, 2, 3].map(i =>
    M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2] + M[i][3] * v[3]
  );
}

export function minkowskiDot(u, v) {
  return u[0] * v[0] - u[1] * v[1] - u[2] * v[2] - u[3] * v[3];
}

// Active Lorentz boost with rapidity eta along unit vector axis
export function lorentzBoost(rapidity, axis = [1, 0, 0]) {
  const norm = Math.hypot(axis[0], axis[1], axis[2]);
  if (norm === 0) return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const n = [axis[0] / norm, axis[1] / norm, axis[2] / norm];
  const ch = Math.cosh(rapidity);
  const sh = Math.sinh(rapidity);
  const B = [
    [ch, n[0] * sh, n[1] * sh, n[2] * sh],
    [n[0] * sh, 1 + (ch - 1) * n[0] * n[0], (ch - 1) * n[0] * n[1], (ch - 1) * n[0] * n[2]],
    [n[1] * sh, (ch - 1) * n[1] * n[0], 1 + (ch - 1) * n[1] * n[1], (ch - 1) * n[1] * n[2]],
    [n[2] * sh, (ch - 1) * n[2] * n[0], (ch - 1) * n[2] * n[1], 1 + (ch - 1) * n[2] * n[2]],
  ];
  return B;
}

// Active 3D spatial rotation by angle (rad) around axis
export function lorentzRotation(angle, axis = [0, 0, 1]) {
  const norm = Math.hypot(axis[0], axis[1], axis[2]);
  if (norm === 0) return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const [ux, uy, uz] = [axis[0] / norm, axis[1] / norm, axis[2] / norm];
  const c = Math.cos(angle), s = Math.sin(angle), omc = 1 - c;
  return [
    [1, 0, 0, 0],
    [0, c + ux * ux * omc, ux * uy * omc - uz * s, ux * uz * omc + uy * s],
    [0, uy * ux * omc + uz * s, c + uy * uy * omc, uy * uz * omc - ux * s],
    [0, uz * ux * omc - uy * s, uz * uy * omc + ux * s, c + uz * uz * omc],
  ];
}

export function verifyMetricPreservation(L, eps = 1e-9) {
  const prod = matMul4(matMul4(matTranspose4(L), MINKOWSKI_METRIC), L);
  let maxError = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      maxError = Math.max(maxError, Math.abs(prod[i][j] - MINKOWSKI_METRIC[i][j]));
    }
  }
  return { ok: maxError <= eps, maxError, product: prod };
}

export const rapidityAdd = (eta1, eta2) => eta1 + eta2;
export const velocityAdd = (beta1, beta2) => (beta1 + beta2) / (1 + beta1 * beta2);

// SL(2, C) double cover of SO^+(3,1)
export function sl2cBoost(rapidity, axis = [1, 0, 0]) {
  const norm = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const nx = axis[0] / norm, ny = axis[1] / norm, nz = axis[2] / norm;
  const ch = Math.cosh(rapidity / 2), sh = Math.sinh(rapidity / 2);
  // exp((eta/2) n.sigma) = ch I + sh (n_x s_1 + n_y s_2 + n_z s_3)
  return [
    [[ch + sh * nz, 0], [sh * nx, -sh * ny]],
    [[sh * nx, sh * ny], [ch - sh * nz, 0]],
  ];
}

export const sl2cRotation = (angle, axis = [0, 0, 1]) => su2Matrix(angle, axis);

// Convert M in SL(2,C) to its 4x4 SO^+(3,1) matrix via X' = M X M^dag, X = x_mu sigma^mu
export function sl2cToLorentz(M) {
  const SIG = [
    [[[1, 0], [0, 0]], [[0, 0], [1, 0]]],     // sigma_0 = I
    [[[0, 0], [1, 0]], [[1, 0], [0, 0]]],     // sigma_1
    [[[0, 0], [0, -1]], [[0, 1], [0, 0]]],    // sigma_2
    [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]],    // sigma_3
  ];
  const Mdag = matDag(M);
  const L = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let nu = 0; nu < 4; nu++) {
    const Xprime = matMul(matMul(M, SIG[nu]), Mdag);
    for (let mu = 0; mu < 4; mu++) {
      // x'^mu = (1/2) Tr(sigma_mu X')
      const tr = matTrace(matMul(SIG[mu], Xprime));
      L[mu][nu] = 0.5 * tr[0];
    }
  }
  return L;
}

export function sl2cDet(M) {
  return cSub(cMul(M[0][0], M[1][1]), cMul(M[0][1], M[1][0]));
}

export function lorentzIrrep(j1, j2) {
  const dim = Math.round((2 * j1 + 1) * (2 * j2 + 1));
  const spins = [];
  for (let s = Math.abs(j1 - j2); s <= j1 + j2 + 1e-9; s += 1) spins.push(s);
  const key = `${j1},${j2}`;
  const catalog = {
    '0,0': { name: 'Skaler', physics: 'Higgs bozonu, π mezonu (φ)' },
    '0.5,0': { name: 'Sol Weyl Spinörü', physics: 'Sol-elli kiral fermiyon (ψ_L)' },
    '0,0.5': { name: 'Sağ Weyl Spinörü', physics: 'Sağ-elli kiral fermiyon (ψ_R)' },
    '0.5,0.5': { name: '4-Vektör', physics: 'Ayar alanı A_μ, momentum P_μ' },
    '1,0': { name: 'Öz-düal 2-form', physics: 'Sol-elli alan şiddeti (E + iB)' },
    '0,1': { name: 'Karşıt-öz-düal 2-form', physics: 'Sağ-elli alan şiddeti (E − iB)' },
    '1,0.5': { name: 'Spin-3/2 Sol', physics: 'Rarita–Schwinger / gravitino parçası' },
    '0.5,1': { name: 'Spin-3/2 Sağ', physics: 'Rarita–Schwinger / gravitino parçası' },
    '1,1': { name: 'Simetrik İzsiz Tensör', physics: 'Kütleçekim metriği h_μν (izsiz parça)' },
    '2,0': { name: 'Weyl Eğrilik (Sol)', physics: 'Kütlesiz spin-2 helisite +2 alanı' },
    '0,2': { name: 'Weyl Eğrilik (Sağ)', physics: 'Kütlesiz spin-2 helisite −2 alanı' },
  };
  const info = catalog[key] || {
    name: `(${j1}, ${j2}) İndirgenemez Temsili`,
    physics: `SO(3) spin bileşenleri: ${spins.join(', ')}`,
  };
  return {
    j1,
    j2,
    dim,
    spins,
    parityPartner: [j2, j1],
    isParityInvariant: Math.abs(j1 - j2) < 1e-9,
    ...info,
  };
}

export const LORENTZ_REPS_CATALOG = [
  { label: '(0, 0)', parts: [[0, 0]], dim: 1, name: 'Skaler', field: 'Higgs H, φ' },
  { label: '(1/2, 0)', parts: [[0.5, 0]], dim: 2, name: 'Sol Weyl Spinörü', field: 'ν_L, e_L, q_L' },
  { label: '(0, 1/2)', parts: [[0, 0.5]], dim: 2, name: 'Sağ Weyl Spinörü', field: 'e_R, u_R, d_R' },
  { label: '(1/2, 0) ⊕ (0, 1/2)', parts: [[0.5, 0], [0, 0.5]], dim: 4, name: 'Dirac Bispinörü', field: 'Elektron ψ_D' },
  { label: '(1/2, 1/2)', parts: [[0.5, 0.5]], dim: 4, name: '4-Vektör', field: 'Foton A_μ, W_μ, Z_μ' },
  { label: '(1, 0) ⊕ (0, 1)', parts: [[1, 0], [0, 1]], dim: 6, name: 'Antisimetrik Tensör', field: 'Elektromanyetik F_μν' },
  { label: '(1, 1)', parts: [[1, 1]], dim: 9, name: 'Simetrik İzsiz Tensör', field: 'Graviton / h_μν (izsiz)' },
];

export function poincareCasimirs(p4, spinOrHelicity = 0.5) {
  const p2 = minkowskiDot(p4, p4);
  const eps = 1e-9;
  const isZeroVec = p4.every(x => Math.abs(x) <= eps);
  if (isZeroVec) {
    return {
      p2: 0,
      mass: 0,
      w2: 0,
      classification: 'Vakum (P^μ = 0)',
      littleGroup: 'SO^+(3,1)',
      dof: 1,
      note: 'Tüm Lorentz grubu P^μ = 0 vektörünü sabit bırakır (vakum durumu).',
    };
  }
  if (p2 > eps) {
    const m = Math.sqrt(p2);
    const s = Math.abs(spinOrHelicity);
    const w2 = -p2 * s * (s + 1);
    return {
      p2,
      mass: m,
      w2,
      classification: p4[0] >= 0 ? 'Kütleli (Zaman-benzeri, P² = m² > 0)' : 'Negatif enerjili zaman-benzeri',
      littleGroup: 'SO(3) (çift örtü SU(2))',
      dof: Math.round(2 * s + 1),
      note: `Durgunluk çerçevesinde P = (m,0,0,0); Pauli–Lubanski W² = -m² s(s+1) = ${w2.toFixed(4)}.`,
    };
  }
  if (Math.abs(p2) <= eps) {
    const h = spinOrHelicity;
    return {
      p2: 0,
      mass: 0,
      w2: 0,
      classification: 'Kütlesiz (Işık-benzeri, P² = 0)',
      littleGroup: 'ISO(2) = E(2) → helisite SO(2)',
      dof: Math.abs(h) < eps ? 1 : 2,
      note: `Standart çerçevede P = (E,0,0,E); sürekli spin yoksa W^μ = λ P^μ, W² = 0 ve helisite λ = ±${Math.abs(h)} Lorentz değişmezidir.`,
    };
  }
  return {
    p2,
    mass: NaN,
    w2: NaN,
    classification: 'Uzay-benzeri / Takyonik (P² < 0)',
    littleGroup: 'SO(2,1)',
    dof: Infinity,
    note: 'Fiziksel serbest parçacıklar için nedenselliği bozar; SO(2,1) üniter temsilleri sonsuz boyutludur.',
  };
}

// Conformal group SO(d, 2) (Ch. 11.1.2)
export function conformalGenerators(d = 4) {
  const translations = d;
  const lorentz = (d * (d - 1)) / 2;
  const dilatation = 1;
  const sct = d;
  const total = translations + lorentz + dilatation + sct;
  return {
    d,
    algebra: `SO(${d}, 2)`,
    total,
    formulaCheck: ((d + 2) * (d + 1)) / 2 === total,
    breakdown: [
      { sym: 'P_\\mu', name: 'Ötelemeler (Translations)', count: translations, role: 'x^\\mu \\to x^\\mu + a^\\mu' },
      { sym: 'M_{\\mu\\nu}', name: 'Lorentz (Dönme + Boost)', count: lorentz, role: 'x^\\mu \\to \\Lambda^\\mu_{\\ \\nu} x^\\nu' },
      { sym: 'D', name: 'Ölçekleme (Dilatasyon)', count: dilatation, role: 'x^\\mu \\to \\lambda x^\\mu' },
      { sym: 'K_\\mu', name: 'Özel Konformal (SCT)', count: sct, role: 'x^\\mu \\to \\frac{x^\\mu - b^\\mu x^2}{1 - 2b\\cdot x + b^2 x^2}' },
    ],
  };
}

export function specialConformal2D(x, y, bx, by) {
  const r2 = x * x + y * y;
  const b2 = bx * bx + by * by;
  const bdotx = bx * x + by * y;
  const denom = 1 - 2 * bdotx + b2 * r2;
  if (Math.abs(denom) < 1e-6) return { x: NaN, y: NaN, scale: Infinity, singular: true };
  return {
    x: (x - bx * r2) / denom,
    y: (y - by * r2) / denom,
    scale: 1 / Math.abs(denom),
    singular: false,
  };
}

export function conformalTransform2D(x, y, {
  tx = 0, ty = 0, theta = 0, lambda = 1, bx = 0, by = 0,
} = {}) {
  // Apply SCT -> Dilatation -> Rotation -> Translation
  const s = specialConformal2D(x, y, bx, by);
  if (s.singular) return s;
  const dx = s.x * lambda, dy = s.y * lambda;
  const c = Math.cos(theta), sn = Math.sin(theta);
  return {
    x: c * dx - sn * dy + tx,
    y: sn * dx + c * dy + ty,
    scale: s.scale * Math.abs(lambda),
    singular: false,
  };
}

// Verify local conformality: Jacobian J^T J = Omega^2 I (preserves angles!)
export function checkConformality2D(x, y, params) {
  const h = 1e-5;
  const px = conformalTransform2D(x + h, y, params);
  const mx = conformalTransform2D(x - h, y, params);
  const py = conformalTransform2D(x, y + h, params);
  const my = conformalTransform2D(x, y - h, params);
  if (px.singular || mx.singular || py.singular || my.singular) {
    return { ok: false, singular: true };
  }
  const ux = (px.x - mx.x) / (2 * h), uy = (px.y - mx.y) / (2 * h);
  const vx = (py.x - my.x) / (2 * h), vy = (py.y - my.y) / (2 * h);
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  const dot = ux * vx + uy * vy;
  const cosAngle = (nu > 0 && nv > 0) ? dot / (nu * nv) : 0;
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
  return {
    ok: Math.abs(angleDeg - 90) < 1e-4 && Math.abs(nu - nv) / Math.max(1e-9, nu) < 1e-4,
    angleDeg,
    scaleFactor: 0.5 * (nu + nv),
    scaleDiff: Math.abs(nu - nv),
  };
}

// =====================================================================
// 8. COLOR, QUARKS, GAUGE THEORIES & STANDARD MODEL (Ch. 11.2–11.5)
// =====================================================================

// Exact rational arithmetic helper for hypercharges & anomaly sums
function gcdInt(a, b) {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return a || 1;
}

export function frac(n, d = 1) {
  if (d === 0) throw new Error('Payda sıfır olamaz');
  if (d < 0) { n = -n; d = -d; }
  if (n === 0) return [0, 1];
  const g = gcdInt(n, d);
  return [n / g, d / g];
}

export const fracAdd = (a, b) => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const fracMul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
export const fracPow = (a, p) => frac(a[0] ** p, a[1] ** p);
export const fracVal = a => a[0] / a[1];
export const fracStr = a => (a[1] === 1 ? String(a[0]) : `${a[0]}/${a[1]}`);
export const fracTex = a => (a[1] === 1 ? String(a[0]) : `${a[0] < 0 ? '-' : ''}\\frac{${Math.abs(a[0])}}{${a[1]}}`);

export const QUARKS = [
  { symbol: 'u', name: 'Yukarı (Up)', gen: 1, Q: frac(2, 3), I3: frac(1, 2), S: 0, C: 0, Bp: 0, T: 0, B: frac(1, 3), massMeV: '2.2 MeV' },
  { symbol: 'd', name: 'Aşağı (Down)', gen: 1, Q: frac(-1, 3), I3: frac(-1, 2), S: 0, C: 0, Bp: 0, T: 0, B: frac(1, 3), massMeV: '4.7 MeV' },
  { symbol: 's', name: 'Garip (Strange)', gen: 2, Q: frac(-1, 3), I3: frac(0, 1), S: -1, C: 0, Bp: 0, T: 0, B: frac(1, 3), massMeV: '93 MeV' },
  { symbol: 'c', name: 'Tılsım (Charm)', gen: 2, Q: frac(2, 3), I3: frac(0, 1), S: 0, C: +1, Bp: 0, T: 0, B: frac(1, 3), massMeV: '1.27 GeV' },
  { symbol: 'b', name: 'Alt (Bottom)', gen: 3, Q: frac(-1, 3), I3: frac(0, 1), S: 0, C: 0, Bp: -1, T: 0, B: frac(1, 3), massMeV: '4.18 GeV' },
  { symbol: 't', name: 'Üst (Top)', gen: 3, Q: frac(2, 3), I3: frac(0, 1), S: 0, C: 0, Bp: 0, T: +1, B: frac(1, 3), massMeV: '172.7 GeV' },
];

export const COLOR_STATES = [
  { code: 'r', name: 'Kırmızı (R)', hex: '#fb7185', weight: [0.5, 1 / (2 * Math.sqrt(3))] },
  { code: 'g', name: 'Yeşil (G)', hex: '#34d399', weight: [-0.5, 1 / (2 * Math.sqrt(3))] },
  { code: 'b', name: 'Mavi (B)', hex: '#60a5fa', weight: [0, -1 / Math.sqrt(3)] },
];

export function checkColorSinglet(type, colors) {
  if (type === 'baryon') {
    if (!Array.isArray(colors) || colors.length !== 3) {
      return { singlet: false, reason: 'Baryon 3 kuark rengi gerektirir (qqq).' };
    }
    const set = new Set(colors);
    const ok = set.size === 3 && set.has('r') && set.has('g') && set.has('b');
    return {
      singlet: ok,
      tensor: '\\frac{1}{\\sqrt{6}}\\varepsilon_{abc} q^a q^b q^c',
      decomposition: '\\mathbf{3} \\otimes \\mathbf{3} \\otimes \\mathbf{3} = \\mathbf{10}_S \\oplus \\mathbf{8}_M \\oplus \\mathbf{8}_M \\oplus \\mathbf{1}_A',
      reason: ok
        ? 'R, G, B tamamen antisimetrik ε_abc tensörüyle birleşerek SU(3)_c renk teklisi (1_A) oluşturur.'
        : 'Renk teklisi için 3 kuarkın R, G, B renklerinin tamamını içermesi gerekir (net renk sıfır değil).',
    };
  }
  if (type === 'meson') {
    if (!Array.isArray(colors) || colors.length !== 2) {
      return { singlet: false, reason: 'Mezon bir kuark ve bir antikuark rengi gerektirir (q q̄).' };
    }
    const [c1, c2] = colors; // c2 expected as 'r', 'g', 'b' representing anti-color
    const ok = ['r', 'g', 'b'].includes(c1) && c1 === c2;
    return {
      singlet: ok,
      tensor: '\\frac{1}{\\sqrt{3}}\\delta^a_b q_a \\bar{q}^b = \\frac{1}{\\sqrt{3}}(r\\bar{r}+g\\bar{g}+b\\bar{b})',
      decomposition: '\\mathbf{3} \\otimes \\bar{\\mathbf{3}} = \\mathbf{8} \\oplus \\mathbf{1}',
      reason: ok
        ? `${c1.toUpperCase()} ve karşıt-${c2.toUpperCase()} renkleri birbirini nötrleyerek renk teklisi (1) içinde yer alır.`
        : `${c1.toUpperCase()} ile karşıt-${c2.toUpperCase()} farklı renkler olduğundan renk sekizlisine (8) düşer; serbest hadron oluşturamaz.`,
    };
  }
  return { singlet: false, reason: 'Bilinmeyen hadron tipi' };
}

export function buildHadron(type, flavorSymbols) {
  const bySym = Object.fromEntries(QUARKS.map(q => [q.symbol, q]));
  if (type === 'baryon' && flavorSymbols.length === 3) {
    const qs = flavorSymbols.map(s => bySym[s]);
    if (qs.some(x => !x)) throw new Error('Geçersiz kuark çeşnisi');
    const Q = qs.reduce((acc, q) => fracAdd(acc, q.Q), frac(0));
    const I3 = qs.reduce((acc, q) => fracAdd(acc, q.I3), frac(0));
    const S = qs.reduce((acc, q) => acc + q.S, 0);
    const C = qs.reduce((acc, q) => acc + q.C, 0);
    const Bp = qs.reduce((acc, q) => acc + q.Bp, 0);
    const T = qs.reduce((acc, q) => acc + q.T, 0);
    const B = frac(1, 1);
    const gmn = fracAdd(I3, frac(1 + S + C + Bp + T, 2));
    const sorted = flavorSymbols.slice().sort().join('');
    const known = {
      duu: 'Proton (p) / Δ⁺',
      ddu: 'Nötron (n) / Δ⁰',
      uuu: 'Δ⁺⁺ (renk kanıtı!)',
      ddd: 'Δ⁻',
      dsu: 'Λ⁰ / Σ⁰',
      suu: 'Σ⁺',
      dds: 'Σ⁻',
      ssu: 'Ξ⁰',
      dss: 'Ξ⁻',
      sss: 'Ω⁻ (Sekizli Yol öngörüsü!)',
    };
    return {
      type: 'baryon',
      composition: flavorSymbols.join(''),
      Q, I3, S, C, Bp, T, B,
      gmnOk: Q[0] === gmn[0] && Q[1] === gmn[1],
      knownName: known[sorted] || `Baryon (${flavorSymbols.join('')})`,
    };
  }
  if (type === 'meson' && flavorSymbols.length === 2) {
    const q = bySym[flavorSymbols[0]], qb = bySym[flavorSymbols[1]];
    if (!q || !qb) throw new Error('Geçersiz kuark çeşnisi');
    const Q = fracAdd(q.Q, frac(-qb.Q[0], qb.Q[1]));
    const I3 = fracAdd(q.I3, frac(-qb.I3[0], qb.I3[1]));
    const S = q.S - qb.S;
    const C = q.C - qb.C;
    const Bp = q.Bp - qb.Bp;
    const T = q.T - qb.T;
    const B = frac(0, 1);
    const gmn = fracAdd(I3, frac(S + C + Bp + T, 2));
    const key = `${flavorSymbols[0]}${flavorSymbols[1]}`;
    const known = {
      ud: 'π⁺ / ρ⁺', du: 'π⁻ / ρ⁻', uu: 'π⁰ / η / ρ⁰ parçası', dd: 'π⁰ / η / ρ⁰ parçası',
      us: 'K⁺', su: 'K⁻', ds: 'K⁰', sd: 'K̄⁰', cc: 'J/ψ (charmonium)', bb: 'Υ (bottomonium)',
    };
    return {
      type: 'meson',
      composition: `${flavorSymbols[0]}\\bar{${flavorSymbols[1]}}`,
      Q, I3, S, C, Bp, T, B,
      gmnOk: Q[0] === gmn[0] && Q[1] === gmn[1],
      knownName: known[key] || `Mezon (${flavorSymbols[0]} + anti-${flavorSymbols[1]})`,
    };
  }
  throw new Error('Geçersiz hadron bileşimi');
}

// Gauge Theories (Ch. 11.3, 11.4)
export const GAUGE_GROUPS = [
  {
    id: 'U1',
    name: 'U(1) — Abelyen (QED)',
    dim: 1,
    rank: 1,
    abelian: true,
    bosons: '1 foton (γ)',
    covariantDeriv: 'D_\\mu = \\partial_\\mu + i e Q A_\\mu',
    fieldStrength: 'F_{\\mu\\nu} = \\partial_\\mu A_\\nu - \\partial_\\nu A_\\mu',
    structureConst: 'f^{abc} = 0 \\text{ (kendiyle etkileşmez)}',
    lagrangian: '\\mathcal{L} = -\\frac{1}{4} F_{\\mu\\nu} F^{\\mu\\nu} + \\bar{\\psi}(i\\gamma^\\mu D_\\mu - m)\\psi',
  },
  {
    id: 'SU2',
    name: 'SU(2)_L — Zayıf İzospin (Yang–Mills)',
    dim: 3,
    rank: 1,
    abelian: false,
    bosons: '3 zayıf bozon (W¹, W², W³ → W±, Z⁰)',
    covariantDeriv: 'D_\\mu = \\partial_\\mu - i g W_\\mu^a \\frac{\\sigma^a}{2}',
    fieldStrength: 'W_{\\mu\\nu}^a = \\partial_\\mu W_\\nu^a - \\partial_\\nu W_\\mu^a + g \\varepsilon^{abc} W_\\mu^b W_\\nu^c',
    structureConst: 'f^{abc} = \\varepsilon^{abc} \\quad (a,b,c \\in \\{1,2,3\\})',
    lagrangian: '\\mathcal{L}_{\\text{YM}} = -\\frac{1}{4} W_{\\mu\\nu}^a W^{a\\,\\mu\\nu} \\; (3\\text{- ve }4\\text{-bozon köşeleri})',
  },
  {
    id: 'SU3',
    name: 'SU(3)_c — Renk Dinamiği (QCD)',
    dim: 8,
    rank: 2,
    abelian: false,
    bosons: '8 gluon (G_μ^1 … G_μ^8)',
    covariantDeriv: 'D_\\mu = \\partial_\\mu - i g_s G_\\mu^a \\frac{\\lambda^a}{2}',
    fieldStrength: 'G_{\\mu\\nu}^a = \\partial_\\mu G_\\nu^a - \\partial_\\nu G_\\mu^a + g_s f^{abc} G_\\mu^b G_\\nu^c',
    structureConst: 'f^{123}=1,\\; f^{147}=f^{246}=f^{257}=f^{345}=\\tfrac{1}{2},\\; f^{156}=f^{367}=-\\tfrac{1}{2},\\; f^{458}=f^{678}=\\tfrac{\\sqrt{3}}{2}',
    lagrangian: '\\mathcal{L}_{\\text{QCD}} = -\\frac{1}{4} G_{\\mu\\nu}^a G^{a\\,\\mu\\nu} + \\sum_q \\bar{q}(i\\gamma^\\mu D_\\mu - m_q)q',
  },
];

// Standard Model single family (Ch. 11.5) — convention Q = T3 + Y
export const SM_FAMILY = [
  {
    id: 'QL',
    symbol: 'Q_L',
    name: 'Sol Kuark İkilisi (u_L, d_L)',
    chirality: 'L',
    su3: 3,
    su2: 2,
    Y: frac(1, 6),
    optional: false,
    components: [
      { label: 'u_L', T3: frac(1, 2), expectedQ: frac(2, 3) },
      { label: 'd_L', T3: frac(-1, 2), expectedQ: frac(-1, 3) },
    ],
  },
  {
    id: 'uR',
    symbol: 'u_R',
    name: 'Sağ Yukarı Kuark',
    chirality: 'R',
    su3: 3,
    su2: 1,
    Y: frac(2, 3),
    optional: false,
    components: [{ label: 'u_R', T3: frac(0, 1), expectedQ: frac(2, 3) }],
  },
  {
    id: 'dR',
    symbol: 'd_R',
    name: 'Sağ Aşağı Kuark',
    chirality: 'R',
    su3: 3,
    su2: 1,
    Y: frac(-1, 3),
    optional: false,
    components: [{ label: 'd_R', T3: frac(0, 1), expectedQ: frac(-1, 3) }],
  },
  {
    id: 'LL',
    symbol: 'L_L',
    name: 'Sol Lepton İkilisi (ν_L, e_L)',
    chirality: 'L',
    su3: 1,
    su2: 2,
    Y: frac(-1, 2),
    optional: false,
    components: [
      { label: '\\nu_L', T3: frac(1, 2), expectedQ: frac(0, 1) },
      { label: 'e_L', T3: frac(-1, 2), expectedQ: frac(-1, 1) },
    ],
  },
  {
    id: 'eR',
    symbol: 'e_R',
    name: 'Sağ Elektron',
    chirality: 'R',
    su3: 1,
    su2: 1,
    Y: frac(-1, 1),
    optional: false,
    components: [{ label: 'e_R', T3: frac(0, 1), expectedQ: frac(-1, 1) }],
  },
  {
    id: 'nuR',
    symbol: '\\nu_R',
    name: 'Sağ Nötrino (Opsiyonel / Steril)',
    chirality: 'R',
    su3: 1,
    su2: 1,
    Y: frac(0, 1),
    optional: true,
    components: [{ label: '\\nu_R', T3: frac(0, 1), expectedQ: frac(0, 1) }],
  },
];

export function checkElectricCharges(fields = SM_FAMILY) {
  const rows = [];
  let allMatch = true;
  for (const f of fields) {
    for (const c of f.components) {
      const computedQ = fracAdd(c.T3, f.Y);
      const ok = computedQ[0] === c.expectedQ[0] && computedQ[1] === c.expectedQ[1];
      if (!ok) allMatch = false;
      rows.push({
        fieldId: f.id,
        label: c.label,
        T3: c.T3,
        Y: f.Y,
        computedQ,
        expectedQ: c.expectedQ,
        ok,
      });
    }
  }
  return { allMatch, rows };
}

// Compute all gauge + gravitational anomalies per family (L counts +1, R counts -1)
export function computeAnomalies(fields = SM_FAMILY, { includeNuR = false } = {}) {
  const active = fields.filter(f => includeNuR || !f.optional);
  let sumY = frac(0);
  let sumY3 = frac(0);
  let su3sqU1 = frac(0);
  let su2sqU1 = frac(0);
  let su3Cube = frac(0);
  let su2Doublets = 0;

  const breakdown = [];
  for (const f of active) {
    const sgn = f.chirality === 'L' ? 1 : -1;
    const mult = f.su3 * f.su2;
    const dY = fracMul(frac(sgn * mult), f.Y);
    const dY3 = fracMul(frac(sgn * mult), fracPow(f.Y, 3));
    const tSu3 = f.su3 === 3 ? frac(1, 2) : frac(0);
    const tSu2 = f.su2 === 2 ? frac(1, 2) : frac(0);
    const dSu3U1 = fracMul(frac(sgn * f.su2), fracMul(tSu3, f.Y));
    const dSu2U1 = fracMul(frac(sgn * f.su3), fracMul(tSu2, f.Y));
    const dSu3Cube = f.su3 === 3 ? frac(sgn * f.su2) : frac(0);
    if (f.su2 === 2) su2Doublets += f.su3;

    sumY = fracAdd(sumY, dY);
    sumY3 = fracAdd(sumY3, dY3);
    su3sqU1 = fracAdd(su3sqU1, dSu3U1);
    su2sqU1 = fracAdd(su2sqU1, dSu2U1);
    su3Cube = fracAdd(su3Cube, dSu3Cube);

    breakdown.push({
      id: f.id,
      symbol: f.symbol,
      chirality: f.chirality,
      dY,
      dY3,
      dSu3U1,
      dSu2U1,
    });
  }

  // Gravitational [Grav]^2 U(1)_Y anomaly is proportional to Tr_L(Y) - Tr_R(Y) = sumY
  const gravitational = sumY;
  const wittenOk = su2Doublets % 2 === 0;
  const allZero = sumY[0] === 0 && sumY3[0] === 0 && su3sqU1[0] === 0 &&
    su2sqU1[0] === 0 && gravitational[0] === 0 && su3Cube[0] === 0 && wittenOk;

  return {
    sumY,
    sumY3,
    su3sqU1,
    su2sqU1,
    gravitational,
    su3Cube,
    su2Doublets,
    wittenOk,
    allZero,
    breakdown,
  };
}

export function electroweakBreaking(sin2ThetaW = 0.23122, vGeV = 246.22, g = 0.6529) {
  const s2 = Math.max(0.01, Math.min(0.99, sin2ThetaW));
  const c2 = 1 - s2;
  const sinT = Math.sqrt(s2);
  const cosT = Math.sqrt(c2);
  const thetaDeg = Math.asin(sinT) * (180 / Math.PI);
  const gp = g * (sinT / cosT);
  const e = g * sinT;
  const mw = 0.5 * g * vGeV;
  const mz = mw / cosT;
  const rho = (mw * mw) / (mz * mz * c2);
  return {
    sin2ThetaW: s2,
    cos2ThetaW: c2,
    sinThetaW: sinT,
    cosThetaW: cosT,
    thetaDeg,
    vGeV,
    g,
    gPrime: gp,
    e,
    mwGeV: mw,
    mzGeV: mz,
    rho,
  };
}

// =====================================================================
// 9. GRAND UNIFICATION: SU(5), SO(10), E6 (Ch. 11.6)
// =====================================================================

// Left-handed Weyl states inside SU(5) 5-bar and 10
export const SU5_FIVE_BAR = [
  { slot: 1, field: 'd^c_{L,r}', sm: '(\\bar{3}, 1)_{+1/3}', T3: frac(0), Y: frac(1, 3), Q: frac(1, 3) },
  { slot: 2, field: 'd^c_{L,g}', sm: '(\\bar{3}, 1)_{+1/3}', T3: frac(0), Y: frac(1, 3), Q: frac(1, 3) },
  { slot: 3, field: 'd^c_{L,b}', sm: '(\\bar{3}, 1)_{+1/3}', T3: frac(0), Y: frac(1, 3), Q: frac(1, 3) },
  { slot: 4, field: 'e^-_L',     sm: '(1, 2)_{-1/2}',        T3: frac(-1, 2), Y: frac(-1, 2), Q: frac(-1, 1) },
  { slot: 5, field: '-\\nu_L',   sm: '(1, 2)_{-1/2}',        T3: frac(1, 2), Y: frac(-1, 2), Q: frac(0, 1) },
];

export const SU5_TEN = [
  { pair: '(1,2)', field: 'u^c_{L,b}', sm: '(\\bar{3}, 1)_{-2/3}', T3: frac(0), Y: frac(-2, 3), Q: frac(-2, 3) },
  { pair: '(1,3)', field: '-u^c_{L,g}', sm: '(\\bar{3}, 1)_{-2/3}', T3: frac(0), Y: frac(-2, 3), Q: frac(-2, 3) },
  { pair: '(2,3)', field: 'u^c_{L,r}', sm: '(\\bar{3}, 1)_{-2/3}', T3: frac(0), Y: frac(-2, 3), Q: frac(-2, 3) },
  { pair: '(1,4)', field: 'u_{L,r}',   sm: '(3, 2)_{+1/6}',        T3: frac(1, 2), Y: frac(1, 6), Q: frac(2, 3) },
  { pair: '(2,4)', field: 'u_{L,g}',   sm: '(3, 2)_{+1/6}',        T3: frac(1, 2), Y: frac(1, 6), Q: frac(2, 3) },
  { pair: '(3,4)', field: 'u_{L,b}',   sm: '(3, 2)_{+1/6}',        T3: frac(1, 2), Y: frac(1, 6), Q: frac(2, 3) },
  { pair: '(1,5)', field: 'd_{L,r}',   sm: '(3, 2)_{+1/6}',        T3: frac(-1, 2), Y: frac(1, 6), Q: frac(-1, 3) },
  { pair: '(2,5)', field: 'd_{L,g}',   sm: '(3, 2)_{+1/6}',        T3: frac(-1, 2), Y: frac(1, 6), Q: frac(-1, 3) },
  { pair: '(3,5)', field: 'd_{L,b}',   sm: '(3, 2)_{+1/6}',        T3: frac(-1, 2), Y: frac(1, 6), Q: frac(-1, 3) },
  { pair: '(4,5)', field: 'e^+_L',     sm: '(1, 1)_{+1}',          T3: frac(0), Y: frac(1, 1), Q: frac(1, 1) },
];

export const SU5_GAUGE_24 = [
  { rep: '(8, 1)_0', dim: 8, bosons: '8 gluon G_μ^a', role: 'Güçlü kuvvet SU(3)_c', baryonViolating: false },
  { rep: '(1, 3)_0', dim: 3, bosons: 'W_μ^1, W_μ^2, W_μ^3', role: 'Zayıf izospin SU(2)_L', baryonViolating: false },
  { rep: '(1, 1)_0', dim: 1, bosons: 'B_μ', role: 'Zayıf hiperyük U(1)_Y', baryonViolating: false },
  { rep: '(3, 2)_{-5/6}', dim: 6, bosons: 'X^{-4/3}, Y^{-1/3} (3 renk)', role: 'Leptokuark bozonlar (proton bozunması)', baryonViolating: true },
  { rep: '(\\bar{3}, 2)_{+5/6}', dim: 6, bosons: 'X^{+4/3}, Y^{+1/3} (3 antirenk)', role: 'Karşıt-leptokuark bozonlar (p → e⁺ π⁰)', baryonViolating: true },
];

// Compute sin^2(theta_W) = Tr(T3^2) / Tr(Q^2) directly from explicit SU(5) representations
export function computeSu5WeinbergAngle() {
  const traceBlock = list => {
    let trT3 = frac(0), trY = frac(0), trQ = frac(0);
    let trT3Sq = frac(0), trYSq = frac(0), trQSq = frac(0);
    for (const st of list) {
      trT3 = fracAdd(trT3, st.T3);
      trY = fracAdd(trY, st.Y);
      trQ = fracAdd(trQ, st.Q);
      trT3Sq = fracAdd(trT3Sq, fracPow(st.T3, 2));
      trYSq = fracAdd(trYSq, fracPow(st.Y, 2));
      trQSq = fracAdd(trQSq, fracPow(st.Q, 2));
    }
    const sin2 = frac(trT3Sq[0] * trQSq[1], trT3Sq[1] * trQSq[0]);
    return { trT3, trY, trQ, trT3Sq, trYSq, trQSq, sin2Frac: sin2, sin2Val: fracVal(sin2) };
  };

  const fiveBar = traceBlock(SU5_FIVE_BAR);
  const ten = traceBlock(SU5_TEN);
  const family = traceBlock([...SU5_FIVE_BAR, ...SU5_TEN]);
  return {
    fiveBar,
    ten,
    family,
    sin2Frac: family.sin2Frac, // [3, 8]
    sin2Val: family.sin2Val,   // 0.375
    kNorm: frac(3, 5),         // Y_GUT = sqrt(3/5) Y
  };
}

export const SO10_SPINOR_16 = {
  algebra: 'SO(10)',
  dimAlgebra: 45,
  spinorDim: 16,
  su5Branching: [
    { rep: '\\mathbf{10}', dim: 10, fields: 'Q_L, u_L^c, e_L^c' },
    { rep: '\\bar{\\mathbf{5}}', dim: 5, fields: 'd_L^c, L_L' },
    { rep: '\\mathbf{1}', dim: 1, fields: '\\nu_L^c \\text{ (sağ nötrino!)}' },
  ],
  patiSalamBranching: [
    { rep: '(\\mathbf{4}, \\mathbf{2}, \\mathbf{1})', dim: 8, fields: '(u_r, u_g, u_b, \\nu)_L, (d_r, d_g, d_b, e)_L' },
    { rep: '(\\bar{\\mathbf{4}}, \\mathbf{1}, \\mathbf{2})', dim: 8, fields: '(u^c, \\nu^c)_L, (d^c, e^c)_L' },
  ],
  gaugeBranching: '\\mathbf{45} = \\mathbf{24} \\oplus \\mathbf{10} \\oplus \\overline{\\mathbf{10}} \\oplus \\mathbf{1}',
  note: 'SO(10) spinörü 16, tek bir indirgenemez temsilde tüm aileyi ve sağ-elli nötrinoyu (tahterevalli mekanizması için) birleştirir; otomatik olarak anomalisizdir.',
};

export const E6_FUND_27 = {
  algebra: 'E_6',
  dimAlgebra: 78,
  fundDim: 27,
  so10Branching: [
    { rep: '\\mathbf{16}', dim: 16, fields: 'Tam Standart Model ailesi + \\nu_L^c' },
    { rep: '\\mathbf{10}', dim: 10, fields: 'Egzotik vektör-benzeri kuark (D, D^c) ve Higgs/lepton ikilileri (H_u, H_d)' },
    { rep: '\\mathbf{1}', dim: 1, fields: 'SO(10) teklisi S (steril skaler/fermiyon)' },
  ],
  trinification: '(\\mathbf{3}, \\mathbf{3}, \\mathbf{1}) \\oplus (\\bar{\\mathbf{3}}, \\mathbf{1}, \\bar{\\mathbf{3}}) \\oplus (\\mathbf{1}, \\bar{\\mathbf{3}}, \\mathbf{3})',
  note: 'E₆, Freudenthal–Tits sihirli karesinin (ℂ, 𝕆) girdisidir ve 27-boyutlu istisnai Albert cebiri J₃(𝕆) üzerine etki eder.',
};

// =====================================================================
// 10. FAMILY SYMMETRIES & TRIBIMAXIMAL MIXING (Ch. 11.7 physics context)
// =====================================================================

export const TRIBIMAXIMAL_MATRIX = [
  [Math.sqrt(2 / 3), 1 / Math.sqrt(3), 0],
  [-1 / Math.sqrt(6), 1 / Math.sqrt(3), -1 / Math.sqrt(2)],
  [-1 / Math.sqrt(6), 1 / Math.sqrt(3), 1 / Math.sqrt(2)],
];

export const PMNS_SYMMETRY_GENERATORS = {
  // mu-tau exchange
  S_mutau: [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  // Magic / A4 generator S2 (fixes (1,1,1)/sqrt(3))
  S_2: [
    [-1 / 3, 2 / 3, 2 / 3],
    [2 / 3, -1 / 3, 2 / 3],
    [2 / 3, 2 / 3, -1 / 3],
  ],
};

export function pmnsMatrix(th12Deg, th23Deg, th13Deg, deltaCpDeg = 0) {
  const rad = d => (d * Math.PI) / 180;
  const s12 = Math.sin(rad(th12Deg)), c12 = Math.cos(rad(th12Deg));
  const s23 = Math.sin(rad(th23Deg)), c23 = Math.cos(rad(th23Deg));
  const s13 = Math.sin(rad(th13Deg)), c13 = Math.cos(rad(th13Deg));
  const eid = [Math.cos(rad(deltaCpDeg)), Math.sin(rad(deltaCpDeg))];
  const emid = [eid[0], -eid[1]];

  // Standard PDG parameterization U = R23 * U13(delta) * R12
  return [
    [[c12 * c13, 0], [s12 * c13, 0], cScale(emid, s13)],
    [
      cSub([-s12 * c23, 0], cScale(eid, c12 * s23 * s13)),
      cSub([c12 * c23, 0], cScale(eid, s12 * s23 * s13)),
      [s23 * c13, 0],
    ],
    [
      cSub([s12 * s23, 0], cScale(eid, c12 * c23 * s13)),
      cSub([-c12 * s23, 0], cScale(eid, s12 * c23 * s13)),
      [c23 * c13, 0],
    ],
  ];
}

export function verifyUnitary3(U, eps = 1e-9) {
  // Accepts either real 3x3 or complex 3x3
  const M = typeof U[0][0] === 'number'
    ? U.map(r => r.map(x => [x, 0]))
    : U;
  return isUnitary(M, eps);
}

export function verifyTbmSymmetry() {
  const U = TRIBIMAXIMAL_MATRIX;
  const mul3 = (A, B) => Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j])
  );
  const tr3 = A => Array.from({ length: 3 }, (_, i) => [A[0][i], A[1][i], A[2][i]]);
  const maxDiff = (A, B) => {
    let m = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m = Math.max(m, Math.abs(A[i][j] - B[i][j]));
    return m;
  };
  // Mass matrix M_nu = U diag(m1, m2, m3) U^T for generic masses
  const diag = [[0.01, 0, 0], [0, 0.02, 0], [0, 0, 0.05]];
  const Mnu = mul3(mul3(U, diag), tr3(U));
  const { S_mutau, S_2 } = PMNS_SYMMETRY_GENERATORS;
  const errMuTau = maxDiff(mul3(mul3(S_mutau, Mnu), tr3(S_mutau)), Mnu);
  const errS2 = maxDiff(mul3(mul3(S_2, Mnu), tr3(S_2)), Mnu);
  const errComm = maxDiff(mul3(S_mutau, S_2), mul3(S_2, S_mutau));
  return {
    unitary: verifyUnitary3(U).ok,
    muTauInvariant: errMuTau < 1e-12,
    s2Invariant: errS2 < 1e-12,
    commuteV4: errComm < 1e-12,
    sin2_12: U[0][1] ** 2,
    sin2_23: U[1][2] ** 2,
    sin2_13: U[0][2] ** 2,
  };
}

// 3-flavor vacuum neutrino oscillation probability P(nu_alpha -> nu_beta) at given L/E (km/GeV)
export function neutrinoOscillationProbs(alphaIdx, LOverE, {
  th12Deg = 33.41, th23Deg = 49.0, th13Deg = 8.54, deltaCpDeg = 197,
  dm21 = 7.41e-5, dm31 = 2.511e-3,
} = {}) {
  const U = pmnsMatrix(th12Deg, th23Deg, th13Deg, deltaCpDeg);
  const m2 = [0, dm21, dm31];
  // Phase factor exp(-i * 2.534 * dm^2[eV^2] * L/E[km/GeV])
  const K = 2.533865;
  const probs = [0, 1, 2].map(beta => {
    let amp = [0, 0];
    for (let i = 0; i < 3; i++) {
      const phase = -K * m2[i] * LOverE;
      const ePhase = [Math.cos(phase), Math.sin(phase)];
      const term = cMul(cMul(U[beta][i], cConj(U[alphaIdx][i])), ePhase);
      amp = cAdd(amp, term);
    }
    return cAbs2(amp);
  });
  return probs;
}

export const FAMILY_SUBGROUPS = [
  { group: 'A_4', order: 12, parent: 'SO(3)', irreps: '1, 1′, 1″, 3', physics: 'En küçük 3\'lü temsilli grup; Tribimaximal nötrino karışımının klasik modeli (Altarelli–Feruglio).', spec: { kind: 'A', n: 4 } },
  { group: 'S_4', order: 24, parent: 'SO(3)', irreps: '1, 1′, 2, 3, 3′', physics: 'Küp dönme grubu; TBM\'nin tam V₄ × Z₃ artık simetrisini doğal olarak barındırır.', spec: { kind: 'S', n: 4 } },
  { group: 'A_5', order: 60, parent: 'SO(3)', irreps: '1, 3, 3′, 4, 5', physics: 'İkosahedron grubu; altın oran güneş karışım açısı tan θ₁₂ = 1/φ öngörüsü.', spec: { kind: 'A', n: 5 } },
  { group: 'T′', order: 24, parent: 'SU(2)', irreps: '1, 1′, 1″, 2, 2′, 2″, 3', physics: 'A₄\'ün çift örtüsü (SL₂(3)); ikili temsillerle kuark CKM karışımını da kapsar.', spec: null },
  { group: 'Δ(27)', order: 27, parent: 'SU(3)', irreps: '9×1, 3, 3̄', physics: '(Z₃ × Z₃) ⋊ Z₃; geometrik CP bozunması ve 3 aile kompleks üçlüsü.', spec: null },
  { group: 'PSL₂(7) = Σ(168)', order: 168, parent: 'SU(3)', irreps: '1, 3, 3̄, 6, 7, 8', physics: 'Fano düzleminin otomorfizma grubu; kompleks 3\'lü temsilli basit sonlu grup.', spec: null },
];

// =====================================================================
// 11. HURWITZ ALGEBRAS, CAYLEY-DICKSON, ALBERT ALGEBRA & MAGIC SQUARE (Ch. 12)
// =====================================================================

export const HURWITZ_ALGEBRAS = [
  { key: 'R', sym: 'ℝ', name: 'Reel Sayılar', dim: 1, ordered: true, commutative: true, associative: true, alternative: true, der: '0', derDim: 0, tri: '0', triDim: 0, j3Dim: 6, j3Der: 'A₁ = so(3)', j3DerDim: 3 },
  { key: 'C', sym: 'ℂ', name: 'Karmaşık Sayılar', dim: 2, ordered: false, commutative: true, associative: true, alternative: true, der: '0', derDim: 0, tri: 'u(1)²', triDim: 2, j3Dim: 9, j3Der: 'A₂ = su(3)', j3DerDim: 8 },
  { key: 'H', sym: 'ℍ', name: 'Kuaterniyonlar', dim: 4, ordered: false, commutative: false, associative: true, alternative: true, der: 'so(3)', derDim: 3, tri: 'sp(1)³', triDim: 9, j3Dim: 15, j3Der: 'C₃ = sp(3)', j3DerDim: 21 },
  { key: 'O', sym: '𝕆', name: 'Oktoniyonlar', dim: 8, ordered: false, commutative: false, associative: false, alternative: true, der: 'G₂', derDim: 14, tri: 'so(8)', triDim: 28, j3Dim: 27, j3Der: 'F₄', j3DerDim: 52 },
];

// Recursive Cayley-Dickson construction: (p, q)(r, s) = (p r - conj(s) q, s p + q conj(r))
// Works for dim = 1 (R), 2 (C), 4 (H), 8 (O), 16 (Sedenions)
export function cdConj(x) {
  const out = x.slice();
  for (let i = 1; i < out.length; i++) out[i] = -out[i];
  return out;
}

export function cdNorm2(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return s;
}

export const cdNorm = x => Math.sqrt(cdNorm2(x));
export const cdAdd = (x, y) => x.map((v, i) => v + y[i]);
export const cdSub = (x, y) => x.map((v, i) => v - y[i]);
export const cdScale = (x, s) => x.map(v => v * s);

export function cdMul(x, y) {
  const n = x.length;
  if (y.length !== n) throw new Error('Cayley–Dickson çarpımı için boyutlar eşit olmalı');
  if (n === 1) return [x[0] * y[0]];
  const h = n >> 1;
  const p = x.slice(0, h), q = x.slice(h);
  const r = y.slice(0, h), s = y.slice(h);
  const left = cdSub(cdMul(p, r), cdMul(cdConj(s), q));
  const right = cdAdd(cdMul(s, p), cdMul(q, cdConj(r)));
  return left.concat(right);
}

export function cdInv(x) {
  const n2 = cdNorm2(x);
  if (n2 === 0) throw new Error('Sıfır elemanın tersi yoktur');
  return cdScale(cdConj(x), 1 / n2);
}

export const cdCommutator = (x, y) => cdSub(cdMul(x, y), cdMul(y, x));
export const cdAssociator = (x, y, z) => cdSub(cdMul(cdMul(x, y), z), cdMul(x, cdMul(y, z)));

// Exact oriented Fano plane triples matching our Cayley-Dickson multiplication: e_a * e_b = +e_c
export const FANO_TRIPLES = [
  [1, 2, 3], // Incircle (clockwise: 1 -> 2 -> 3)
  [1, 4, 5], // Median: left-mid (1) -> center (4) -> bottom-right (5)
  [2, 4, 6], // Median: right-mid (2) -> center (4) -> bottom-left (6)
  [3, 4, 7], // Median: bottom-mid (3) -> center (4) -> top (7)
  [6, 1, 7], // Left edge (clockwise: 6 -> 1 -> 7)
  [7, 2, 5], // Right edge (clockwise: 7 -> 2 -> 5)
  [5, 3, 6], // Bottom edge (clockwise: 5 -> 3 -> 6)
];

// Symmetric equilateral triangle layout for Fano plane SVG/Canvas (normalized to unit radius around (0,0))
export const FANO_LAYOUT = {
  7: { x: 0, y: -1, role: 'Tepe' },
  6: { x: -Math.sqrt(3) / 2, y: 0.5, role: 'Sol Alt Köşe' },
  5: { x: Math.sqrt(3) / 2, y: 0.5, role: 'Sağ Alt Köşe' },
  1: { x: -Math.sqrt(3) / 4, y: -0.25, role: 'Sol Kenar Ortası' },
  2: { x: Math.sqrt(3) / 4, y: -0.25, role: 'Sağ Kenar Ortası' },
  3: { x: 0, y: 0.5, role: 'Alt Kenar Ortası' },
  4: { x: 0, y: 0, role: 'Merkez' },
};

let OCT_TABLE_CACHE = null;
export function octonionMulTable() {
  if (OCT_TABLE_CACHE) return OCT_TABLE_CACHE;
  const basis = Array.from({ length: 8 }, (_, i) => {
    const v = new Array(8).fill(0);
    v[i] = 1;
    return v;
  });
  const table = Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 8 }, (_, j) => {
      const p = cdMul(basis[i], basis[j]);
      let idx = 0, sign = 1;
      for (let k = 0; k < 8; k++) {
        if (Math.abs(p[k]) > 0.5) { idx = k; sign = p[k] > 0 ? 1 : -1; break; }
      }
      return { sign, index: idx, label: idx === 0 ? (sign > 0 ? '1' : '-1') : `${sign > 0 ? '' : '-'}e_${idx}` };
    })
  );
  OCT_TABLE_CACHE = table;
  return table;
}

// 3x3 Hermitian matrices over Hurwitz algebras H_3(K) and Albert algebra J_3(O) (Ch. 12.2)
export const hermitian3Dim = kDim => 3 + 3 * kDim;

export function jordan3Create(d1, d2, d3, x1, x2, x3) {
  const k = x1.length;
  const realElem = r => { const v = new Array(k).fill(0); v[0] = r; return v; };
  // Standard Albert form:
  // [ d1,    x3,    bar(x2) ]
  // [ bar(x3), d2,  x1      ]
  // [ x2,    bar(x1), d3    ]
  return [
    [realElem(d1), x3.slice(), cdConj(x2)],
    [cdConj(x3), realElem(d2), x1.slice()],
    [x2.slice(), cdConj(x1), realElem(d3)],
  ];
}

export function jordan3Mul(A, B) {
  const k = A[0][0].length;
  const zero = () => new Array(k).fill(0);
  const C = Array.from({ length: 3 }, () => [zero(), zero(), zero()]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let acc = zero();
      for (let m = 0; m < 3; m++) acc = cdAdd(acc, cdMul(A[i][m], B[m][j]));
      C[i][j] = acc;
    }
  }
  return C;
}

export function jordan3Product(A, B) {
  const AB = jordan3Mul(A, B);
  const BA = jordan3Mul(B, A);
  return Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => cdScale(cdAdd(AB[i][j], BA[i][j]), 0.5))
  );
}

export function jordan3IsHermitian(A, eps = 1e-9) {
  for (let i = 0; i < 3; i++) {
    // Diagonal entries must be purely real
    for (let c = 1; c < A[i][i].length; c++) {
      if (Math.abs(A[i][i][c]) > eps) return false;
    }
    for (let j = i + 1; j < 3; j++) {
      const diff = cdSub(A[i][j], cdConj(A[j][i]));
      if (cdNorm(diff) > eps) return false;
    }
  }
  return true;
}

export function jordan3MaxDiff(A, B) {
  let m = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) m = Math.max(m, cdNorm(cdSub(A[i][j], B[i][j])));
  }
  return m;
}

// Freudenthal cubic determinant det(A) = d1 d2 d3 + 2 Re(x1 x2 x3) - d1|x1|^2 - d2|x2|^2 - d3|x3|^2
export function freudenthalDet(A) {
  const d1 = A[0][0][0], d2 = A[1][1][0], d3 = A[2][2][0];
  const x3 = A[0][1], x1 = A[1][2], x2 = A[2][0];
  const triple = cdMul(cdMul(x1, x2), x3);
  return d1 * d2 * d3 + 2 * triple[0] - d1 * cdNorm2(x1) - d2 * cdNorm2(x2) - d3 * cdNorm2(x3);
}

// Freudenthal–Tits Magic Square (Ch. 12.3)
export const MAGIC_SQUARE_LABELS = ['R', 'C', 'H', 'O'];

const HURWITZ_BY_KEY = Object.fromEntries(HURWITZ_ALGEBRAS.map(h => [h.key, h]));

// Compute dimension via BOTH Barton-Sudbery triality formula and Tits Jordan-derivation formula
export function magicSquareDim(keyA, keyB) {
  const A = HURWITZ_BY_KEY[keyA];
  const B = HURWITZ_BY_KEY[keyB];
  if (!A || !B) throw new Error('Geçersiz Hurwitz cebiri anahtarı (R, C, H, O)');
  // Barton–Sudbery: dim m(A,B) = dim tri(A) + dim tri(B) + 3 * dim(A) * dim(B)
  const bartonSudbery = A.triDim + B.triDim + 3 * A.dim * B.dim;
  // Tits: dim L(A, J3(B)) = dim Der(A) + (dim A - 1)*(3 dim B + 2) + dim Der(J3(B))
  const tits = A.derDim + (A.dim - 1) * (3 * B.dim + 2) + B.j3DerDim;
  return {
    dim: bartonSudbery,
    bartonSudbery,
    tits,
    formulasMatch: bartonSudbery === tits,
    triTerms: [A.triDim, B.triDim, 3 * A.dim * B.dim],
    titsTerms: [A.derDim, (A.dim - 1) * (3 * B.dim + 2), B.j3DerDim],
  };
}

const MAGIC_SQUARE_SPEC = [
  // Row R
  [
    { cartan: 'A_1', classical: 'so(3)', rank: 1, roots: 2, exceptional: false, role: '3B dönmeler, J₃(ℝ) otomorfizmaları' },
    { cartan: 'A_2', classical: 'su(3)', rank: 2, roots: 6, exceptional: false, role: 'Renk simetrisi QCD, J₃(ℂ) otomorfizmaları' },
    { cartan: 'C_3', classical: 'sp(3)', rank: 3, roots: 18, exceptional: false, role: 'Simplektik cebir, J₃(ℍ) otomorfizmaları' },
    { cartan: 'F_4', classical: 'F_4',   rank: 4, roots: 48, exceptional: true,  role: 'İstisnai Albert cebiri J₃(𝕆) otomorfizma grubu' },
  ],
  // Row C
  [
    { cartan: 'A_2', classical: 'su(3)', rank: 2, roots: 6, exceptional: false, role: 'Kompleks projektif düzlem ℂP² izometrisi' },
    { cartan: 'A_2 \\oplus A_2', classical: 'su(3) ⊕ su(3)', rank: 4, roots: 12, exceptional: false, role: 'Yarı-basit (tek basit olmayan girdi!)' },
    { cartan: 'A_5', classical: 'su(6)', rank: 5, roots: 30, exceptional: false, role: 'SU(6) birleşik spin-çeşni cebiri' },
    { cartan: 'E_6', classical: 'E_6',   rank: 6, roots: 72, exceptional: true,  role: 'J₃(𝕆) determinant koruyan grup; GUT adayı (27)' },
  ],
  // Row H
  [
    { cartan: 'C_3', classical: 'sp(3)', rank: 3, roots: 18, exceptional: false, role: 'Kuaterniyonik projektif düzlem ℍP² izometrisi' },
    { cartan: 'A_5', classical: 'su(6)', rank: 5, roots: 30, exceptional: false, role: 'Sihirli karenin simetrisini sergiler' },
    { cartan: 'D_6', classical: 'so(12)', rank: 6, roots: 60, exceptional: false, role: '12B ortogonal cebir' },
    { cartan: 'E_7', classical: 'E_7',   rank: 7, roots: 126, exceptional: true, role: 'Freudenthal üçlü sistemi (dim 56); N=8 süperkütleçekim' },
  ],
  // Row O
  [
    { cartan: 'F_4', classical: 'F_4',   rank: 4, roots: 48, exceptional: true,  role: 'Oktoniyonik projektif düzlem 𝕆P² (Cayley düzlemi) izometrisi' },
    { cartan: 'E_6', classical: 'E_6',   rank: 6, roots: 72, exceptional: true,  role: 'Kompleksleştirilmiş oktoniyon düzlemi (ℂ⊗𝕆)P²' },
    { cartan: 'E_7', classical: 'E_7',   rank: 7, roots: 126, exceptional: true, role: 'Kuaterniyonik oktoniyon düzlemi (ℍ⊗𝕆)P²' },
    { cartan: 'E_8', classical: 'E_8',   rank: 8, roots: 240, exceptional: true, role: 'En büyük istisnai basit Lie cebiri; heterotik sicim E₈×E₈' },
  ],
];

export const MAGIC_SQUARE = MAGIC_SQUARE_LABELS.map((rowKey, r) =>
  MAGIC_SQUARE_LABELS.map((colKey, c) => {
    const spec = MAGIC_SQUARE_SPEC[r][c];
    const calc = magicSquareDim(rowKey, colKey);
    return {
      rowKey,
      colKey,
      rowSym: HURWITZ_BY_KEY[rowKey].sym,
      colSym: HURWITZ_BY_KEY[colKey].sym,
      ...spec,
      dim: calc.dim,
      dimFormula: calc,
      dimCheck: spec.rank + spec.roots === calc.dim,
    };
  })
);

// =====================================================================
// 12. PREFACE: 17 WALLPAPER GROUPS, 5 PLATONIC SOLIDS, EVERYDAY SHAPES (Ch. 1)
// =====================================================================

// Fractional affine transform [a, b, tx, c, d, ty]: u' = a*u + b*v + tx, v' = c*u + d*v + ty
// Determinant det = a*d - b*c (+1 orientation preserving, -1 reversing)
function generateFractionalGroup(gens) {
  const wrap = x => {
    let r = x - Math.floor(x);
    if (r >= 1 - 1e-9 || r < 1e-9) r = 0;
    return Math.round(r * 12) / 12; // exact on 1/12 grid (handles 1/2, 1/3, 1/4, 1/6)
  };
  const compose = (g1, g2) => [
    g1[0] * g2[0] + g1[1] * g2[3],
    g1[0] * g2[1] + g1[1] * g2[4],
    wrap(g1[0] * g2[2] + g1[1] * g2[5] + g1[2]),
    g1[3] * g2[0] + g1[4] * g2[3],
    g1[3] * g2[1] + g1[4] * g2[4],
    wrap(g1[3] * g2[2] + g1[4] * g2[5] + g1[5]),
  ];
  const key = g => g.map(v => Math.round(v * 12)).join(',');
  const id = [1, 0, 0, 0, 1, 0];
  const list = [id];
  const seen = new Set([key(id)]);
  for (let i = 0; i < list.length; i++) {
    for (const gen of gens) {
      const nxt = compose(gen, list[i]);
      const k = key(nxt);
      if (!seen.has(k)) {
        seen.add(k);
        list.push(nxt);
        if (list.length > 24) break;
      }
    }
  }
  return list;
}

const SQRT3_2 = Math.sqrt(3) / 2;

export const WALLPAPER_GROUPS = [
  {
    iuc: 'p1', orbifold: 'o', lattice: 'Eğik (Oblique)', pointGroup: 'C₁', maxRot: 1, mirror: false, glide: false,
    basis: [[1, 0], [0.32, 0.92]],
    ops: generateFractionalGroup([]),
    desc: 'Yalnızca iki bağımsız öteleme simetrisi; dönme veya yansıma yoktur.',
  },
  {
    iuc: 'p2', orbifold: '2222', lattice: 'Eğik (Oblique)', pointGroup: 'C₂', maxRot: 2, mirror: false, glide: false,
    basis: [[1, 0], [0.32, 0.92]],
    ops: generateFractionalGroup([[-1, 0, 0, 0, -1, 0]]),
    desc: 'Birim hücrede 4 adet 180° (2-katlı) dönme merkezi; yansıma yoktur.',
  },
  {
    iuc: 'pm', orbifold: '**', lattice: 'Dikdörtgen', pointGroup: 'D₁', maxRot: 1, mirror: true, glide: false,
    basis: [[1.18, 0], [0, 0.88]],
    ops: generateFractionalGroup([[-1, 0, 0, 0, 1, 0]]),
    desc: 'Paralel yansıma eksenleri; dönme ve kayma yansıması yoktur.',
  },
  {
    iuc: 'pg', orbifold: '××', lattice: 'Dikdörtgen', pointGroup: 'D₁', maxRot: 1, mirror: false, glide: true,
    basis: [[1.18, 0], [0, 0.88]],
    ops: generateFractionalGroup([[-1, 0, 0, 0, 1, 0.5]]),
    desc: 'Yalnızca paralel kayma yansıması (glide reflection) eksenleri; ayna yoktur.',
  },
  {
    iuc: 'cm', orbifold: '*×', lattice: 'Merkezli Dikdörtgen (Eşkenar)', pointGroup: 'D₁', maxRot: 1, mirror: true, glide: true,
    basis: [[1.22, 0], [0, 0.86]],
    ops: generateFractionalGroup([[-1, 0, 0, 0, 1, 0], [1, 0, 0.5, 0, 1, 0.5]]),
    desc: 'Alternatif paralel ayna ve kayma yansıması eksenleri (merkezlenmiş kafes).',
  },
  {
    iuc: 'pmm', orbifold: '*2222', lattice: 'Dikdörtgen', pointGroup: 'D₂', maxRot: 2, mirror: true, glide: false,
    basis: [[1.18, 0], [0, 0.88]],
    ops: generateFractionalGroup([[-1, 0, 0, 0, 1, 0], [1, 0, 0, 0, -1, 0]]),
    desc: 'Birbirine dik iki yansıma ekseni ailesi ve kesişimlerinde 180° dönmeler.',
  },
  {
    iuc: 'pmg', orbifold: '22*', lattice: 'Dikdörtgen', pointGroup: 'D₂', maxRot: 2, mirror: true, glide: true,
    basis: [[1.18, 0], [0, 0.88]],
    ops: generateFractionalGroup([[-1, 0, 0.5, 0, 1, 0], [-1, 0, 0, 0, -1, 0]]),
    desc: 'Dikey ayna eksenleri ile bunlara dik kayma yansıması eksenleri; dönme merkezleri aynaların dışında.',
  },
  {
    iuc: 'pgg', orbifold: '22×', lattice: 'Dikdörtgen', pointGroup: 'D₂', maxRot: 2, mirror: false, glide: true,
    basis: [[1.18, 0], [0, 0.88]],
    ops: generateFractionalGroup([[1, 0, 0.5, 0, -1, 0.5], [-1, 0, 0.5, 0, 1, 0.5]]),
    desc: 'Birbirine dik iki kayma yansıması ekseni ve 180° dönmeler; hiç ayna yoktur.',
  },
  {
    iuc: 'cmm', orbifold: '2*22', lattice: 'Merkezli Dikdörtgen (Eşkenar)', pointGroup: 'D₂', maxRot: 2, mirror: true, glide: true,
    basis: [[1.22, 0], [0, 0.86]],
    ops: generateFractionalGroup([[-1, 0, 0, 0, 1, 0], [1, 0, 0, 0, -1, 0], [1, 0, 0.5, 0, 1, 0.5]]),
    desc: 'Dik aynalar ve merkezleme nedeniyle aynalar dışında ekstra 180° dönme merkezleri.',
  },
  {
    iuc: 'p4', orbifold: '442', lattice: 'Kare', pointGroup: 'C₄', maxRot: 4, mirror: false, glide: false,
    basis: [[1, 0], [0, 1]],
    ops: generateFractionalGroup([[0, -1, 0, 1, 0, 0]]),
    desc: '90° (4-katlı) ve 180° (2-katlı) dönme merkezleri; kiral desen, ayna yoktur.',
  },
  {
    iuc: 'p4m', orbifold: '*442', lattice: 'Kare', pointGroup: 'D₄', maxRot: 4, mirror: true, glide: true,
    basis: [[1, 0], [0, 1]],
    ops: generateFractionalGroup([[0, -1, 0, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    desc: 'Tam kare kafes simetrisi: 45° aralıklarla 4 ayna yönü ve 90° dönmeler.',
  },
  {
    iuc: 'p4g', orbifold: '4*2', lattice: 'Kare', pointGroup: 'D₄', maxRot: 4, mirror: true, glide: true,
    basis: [[1, 0], [0, 1]],
    ops: generateFractionalGroup([[0, -1, 0, 1, 0, 0], [0, -1, 0.5, -1, 0, 0.5]]),
    desc: '90° dönme merkezleri aynaların üzerinde değil; çapraz aynalar ve eksenel kayma yansımaları.',
  },
  {
    iuc: 'p3', orbifold: '333', lattice: 'Altıgen (Heksagonal)', pointGroup: 'C₃', maxRot: 3, mirror: false, glide: false,
    basis: [[1, 0], [-0.5, SQRT3_2]],
    ops: generateFractionalGroup([[0, -1, 0, 1, -1, 0]]),
    desc: 'Yalnızca 120° (3-katlı) dönmeler (3 eşdeğer olmayan merkez); ayna yoktur.',
  },
  {
    iuc: 'p3m1', orbifold: '*333', lattice: 'Altıgen (Heksagonal)', pointGroup: 'D₃', maxRot: 3, mirror: true, glide: true,
    basis: [[1, 0], [-0.5, SQRT3_2]],
    ops: generateFractionalGroup([[0, -1, 0, 1, -1, 0], [0, -1, 0, -1, 0, 0]]),
    desc: '120° dönme merkezlerinin TAMAMI yansıma eksenlerinin üzerinde yer alır.',
  },
  {
    iuc: 'p31m', orbifold: '3*3', lattice: 'Altıgen (Heksagonal)', pointGroup: 'D₃', maxRot: 3, mirror: true, glide: true,
    basis: [[1, 0], [-0.5, SQRT3_2]],
    ops: generateFractionalGroup([[0, -1, 0, 1, -1, 0], [0, 1, 0, 1, 0, 0]]),
    desc: '120° dönme merkezlerinin bir kısmı aynalar üzerindedir, (1/3, 2/3) merkezleri ayna dışındadır.',
  },
  {
    iuc: 'p6', orbifold: '632', lattice: 'Altıgen (Heksagonal)', pointGroup: 'C₆', maxRot: 6, mirror: false, glide: false,
    basis: [[1, 0], [-0.5, SQRT3_2]],
    ops: generateFractionalGroup([[1, -1, 0, 1, 0, 0]]),
    desc: '60°, 120° ve 180° dönme merkezleri; kiral altıgen örüntü, ayna yoktur.',
  },
  {
    iuc: 'p6m', orbifold: '*632', lattice: 'Altıgen (Heksagonal)', pointGroup: 'D₆', maxRot: 6, mirror: true, glide: true,
    basis: [[1, 0], [-0.5, SQRT3_2]],
    ops: generateFractionalGroup([[1, -1, 0, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    desc: 'En zengin düzlemsel simetri (bal peteği/Elhamra): 60° dönmeler ve 30° aralıklarla 6 ayna yönü.',
  },
];

// 5 Platonic Solids with exact unit-sphere vertices and edge pairs
function norm3(v) {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}

function buildEdgesByMinDist(verts) {
  let minD = Infinity;
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]);
      if (d < minD) minD = d;
    }
  }
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]);
      if (Math.abs(d - minD) < 1e-4) edges.push([i, j]);
    }
  }
  return edges;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

const TET_V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm3);
const CUBE_V = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CUBE_V.push(norm3([x, y, z]));
const OCT_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const ICO_V = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
].map(norm3);
const DOD_V = [
  ...CUBE_V.map(v => v.map(x => x * Math.sqrt(3))), // unnormalized (+-1,+-1,+-1)
  [0, INV_PHI, PHI], [0, -INV_PHI, PHI], [0, INV_PHI, -PHI], [0, -INV_PHI, -PHI],
  [INV_PHI, PHI, 0], [-INV_PHI, PHI, 0], [INV_PHI, -PHI, 0], [-INV_PHI, -PHI, 0],
  [PHI, 0, INV_PHI], [-PHI, 0, INV_PHI], [PHI, 0, -INV_PHI], [-PHI, 0, -INV_PHI],
].map(norm3);

export const PLATONIC_SOLIDS = [
  {
    id: 'tetrahedron', name: 'Dörtyüzlü (Tetrahedron)', schlafli: '{3, 3}',
    V: 4, E: 6, F: 4, rotGroup: 'A_4', rotOrder: 12, fullGroup: 'S_4', fullOrder: 24,
    dual: 'Kendisi (Dörtyüzlü)', spec: { kind: 'A', n: 4 },
    vertices: TET_V, edges: buildEdgesByMinDist(TET_V),
    note: '4 köşenin çift permütasyonları A₄ dönme grubunu (12 eleman) oluşturur.',
  },
  {
    id: 'cube', name: 'Küp (Altıyüzlü)', schlafli: '{4, 3}',
    V: 8, E: 12, F: 6, rotGroup: 'S_4', rotOrder: 24, fullGroup: 'S_4 × Z_2', fullOrder: 48,
    dual: 'Sekizyüzlü (Octahedron)', spec: { kind: 'S', n: 4 },
    vertices: CUBE_V, edges: buildEdgesByMinDist(CUBE_V),
    note: '4 cisim köşegeninin tüm permütasyonları S₄ dönme grubunu (24 eleman) verir.',
  },
  {
    id: 'octahedron', name: 'Sekizyüzlü (Octahedron)', schlafli: '{3, 4}',
    V: 6, E: 12, F: 8, rotGroup: 'S_4', rotOrder: 24, fullGroup: 'S_4 × Z_2', fullOrder: 48,
    dual: 'Küp (Hexahedron)', spec: { kind: 'S', n: 4 },
    vertices: OCT_V, edges: buildEdgesByMinDist(OCT_V),
    note: 'Küpün yüz merkezleriyle elde edilen düal katı; küple aynı S₄ dönme grubuna sahiptir.',
  },
  {
    id: 'dodecahedron', name: 'Onikiyüzlü (Dodecahedron)', schlafli: '{5, 3}',
    V: 20, E: 30, F: 12, rotGroup: 'A_5', rotOrder: 60, fullGroup: 'A_5 × Z_2', fullOrder: 120,
    dual: 'Yirmiyüzlü (Icosahedron)', spec: { kind: 'A', n: 5 },
    vertices: DOD_V, edges: buildEdgesByMinDist(DOD_V),
    note: 'İçine yerleştirilen 5 küpün çift permütasyonları basit grup A₅\'i (60 eleman) verir.',
  },
  {
    id: 'icosahedron', name: 'Yirmiyüzlü (Icosahedron)', schlafli: '{3, 5}',
    V: 12, E: 30, F: 20, rotGroup: 'A_5', rotOrder: 60, fullGroup: 'A_5 × Z_2', fullOrder: 120,
    dual: 'Onikiyüzlü (Dodecahedron)', spec: { kind: 'A', n: 5 },
    vertices: ICO_V, edges: buildEdgesByMinDist(ICO_V),
    note: 'Onikiyüzlünün düali; 5-katlı dönmeler ve basit grup A₅ (SO(3)\'ün en büyük sonlu alt grubu).',
  },
];

export const EVERYDAY_SHAPES = [
  { id: 'tri', name: 'Eşkenar Üçgen', group: 'D_3', order: 6, rotations: 3, reflections: 3, chiral: false, spec: { kind: 'D', n: 3 } },
  { id: 'sq', name: 'Kare', group: 'D_4', order: 8, rotations: 4, reflections: 4, chiral: false, spec: { kind: 'D', n: 4 } },
  { id: 'pent', name: 'Düzgün Beşgen', group: 'D_5', order: 10, rotations: 5, reflections: 5, chiral: false, spec: { kind: 'D', n: 5 } },
  { id: 'rect', name: 'Dikdörtgen', group: 'D_2 \\cong V_4', order: 4, rotations: 2, reflections: 2, chiral: false, spec: { kind: 'V4' } },
  { id: 'pinwheel', name: '4-Kanatlı Rüzgar Gülü', group: 'C_4 \\cong \\mathbb{Z}_4', order: 4, rotations: 4, reflections: 0, chiral: true, spec: { kind: 'Z', n: 4 } },
  { id: 'circle', name: 'Çember (Sürekli)', group: 'O(2)', order: Infinity, rotations: Infinity, reflections: Infinity, chiral: false, spec: null },
];

// =====================================================================
// 13. ENDLESS EXERCISE GENERATOR (ALL 3 CHAPTERS)
// =====================================================================

export const PHYS_QUIZ_TOPICS = {
  fizik: [
    ['fermi', 'Fermi Osilatörleri & SO(2n)'],
    ['boson', 'Bozon & Uyumlu Durumlar'],
    ['osc3d', '3B Harmonik Osilatör & SU(3)'],
    ['bohr', 'Bohr Atomu & SO(4)'],
    ['isospin', 'İzospin & Elliott / Sakata'],
  ],
  uzayzaman: [
    ['lorentz', 'Lorentz (j₁,j₂) & Rapidity'],
    ['poincare', 'Poincaré & Konformal Grup'],
    ['quark', 'Kuarklar & Renk Teklisi'],
    ['sm', 'Standart Model & Anomaliler'],
    ['gut', 'Büyük Birleşme & Aile Simetrileri'],
  ],
  ozel: [
    ['symmetry', 'Duvar Kağıdı & Platon Katıları'],
    ['hurwitz', 'Hurwitz Cebirleri & Kuaterniyonlar'],
    ['octonion', 'Oktoniyonlar & Fano Düzlemi'],
    ['jordan', 'Albert Cebiri J₃(𝕆)'],
    ['magic', 'Freudenthal–Tits Sihirli Karesi'],
  ],
};

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeUniqueOptions(correct, distractors, rng) {
  const set = new Set([String(correct)]);
  const pool = [String(correct)];
  for (const d of distractors) {
    const s = String(d);
    if (!set.has(s)) {
      set.add(s);
      pool.push(s);
      if (pool.length === 4) break;
    }
  }
  // Shuffle Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { options: pool, answerIndex: pool.indexOf(String(correct)) };
}

export function generatePhysQuizQuestion(chapter = 'all', difficulty = 'orta', rng = Math.random, topicKey = null) {
  const allByChapter = chapter === 'all'
    ? [...PHYS_QUIZ_TOPICS.fizik, ...PHYS_QUIZ_TOPICS.uzayzaman, ...PHYS_QUIZ_TOPICS.ozel]
    : (PHYS_QUIZ_TOPICS[chapter] || PHYS_QUIZ_TOPICS.fizik);

  const chosen = topicKey && allByChapter.some(t => t[0] === topicKey)
    ? topicKey
    : pick(allByChapter, rng)[0];

  // --- CHAPTER: FIZIK ---
  if (chosen === 'fermi') {
    const n = difficulty === 'kolay' ? pick([2, 3], rng) : pick([3, 4, 5], rng);
    const variant = Math.floor(rng() * 3);
    if (variant === 0) {
      const dim = 1 << n;
      const { options, answerIndex } = makeUniqueOptions(
        `$${dim}$`,
        [`$${2 * n}$`, `$${n * n}$`, `$${1 << (n - 1)}$`, `$${dim * 2}$`, `$${dim + 2}$`, `$${dim + 4}$`],
        rng
      );
      return {
        chapter: 'fizik', type: 'fermi', topic: 'Fermi Osilatörleri',
        prompt: `$n = ${n}$ fermiyonik osilatör modunun ($\\{a_i, a_j^\\dagger\\} = \\delta_{ij}$) oluşturduğu Fock uzayının boyutu kaçtır?`,
        options, answerIndex,
        explanation: `Pauli dışarlama ilkesi gereği her mod $0$ veya $1$ parçacık alabilir: $\\dim\\mathcal{F}_F = 2^n = 2^{${n}} = ${dim}$. Bu uzay aynı zamanda $SO(${2 * n})$ grubunun Dirac spinör temsilidir.`,
      };
    }
    if (variant === 1) {
      const soDim = n * (2 * n - 1);
      const { options, answerIndex } = makeUniqueOptions(
        `$${soDim}$`,
        [`$${n * n}$`, `$${2 * n * n}$`, `$${n * (n - 1)}$`, `$${(2 * n) * (2 * n + 1) / 2}$`, `$${soDim + 2}$`],
        rng
      );
      return {
        chapter: 'fizik', type: 'fermi', topic: 'Fermi & SO(2n)',
        prompt: `$n = ${n}$ fermiyonik moddan kurulan $\\Sigma_{\\mu\\nu} = -\\frac{i}{4}[\\gamma_\\mu, \\gamma_\\nu]$ üreteçlerinin oluşturduğu $SO(${2 * n})$ Lie cebirinin boyutu kaçtır?`,
        options, answerIndex,
        explanation: `$\\dim SO(2n) = \\binom{2n}{2} = n(2n-1) = ${n}\\cdot ${2 * n - 1} = ${soDim}$. Bu üreteçler $a_i^\\dagger a_j - \\tfrac{1}{2}\\delta_{ij}$ ($${n * n}$), $a_i^\\dagger a_j^\\dagger$ ($${n * (n - 1) / 2}$) ve $a_i a_j$ ($${n * (n - 1) / 2}$) çiftlerinden gelir.`,
      };
    }
    const chiralDim = 1 << (n - 1);
    const { options, answerIndex } = makeUniqueOptions(
      `$${chiralDim} \\oplus ${chiralDim}$`,
      [
        `$${1 << n} \\oplus ${1 << n}$`,
        `$${chiralDim - 1} \\oplus ${chiralDim + 1}$`,
        `$${n} \\oplus ${n}$`,
        `$${2 * n} \\oplus ${2 * n}$`,
        `$${chiralDim + 2} \\oplus ${chiralDim + 2}$`,
      ],
      rng
    );
    return {
      chapter: 'fizik', type: 'fermi', topic: 'Kiral Spinör Ayrışması',
      prompt: `$n = ${n}$ için $2^n = ${1 << n}$ boyutlu Fock uzayı, fermiyon paritesi $P = (-1)^N$ altında $SO(${2 * n})$'in hangi iki kiral (Weyl) spinörüne ayrılır?`,
      options, answerIndex,
      explanation: `Çift ve tek parçacık sayılı Fock durumlarının her biri $2^{n-1} = 2^{${n - 1}} = ${chiralDim}$ boyutludur ve $SO(${2 * n})$ altında birbirine karışmaz: $${1 << n} = ${chiralDim} \\oplus ${chiralDim}$.`,
    };
  }

  if (chosen === 'boson') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const D = pick([5, 6, 8, 10, 12], rng);
      const { defectEntry } = bosonTruncated(D);
      const { options, answerIndex } = makeUniqueOptions(
        `$${defectEntry}$`,
        [`$+1$`, `$0$`, `$${-(D)}$`, `$${D - 1}$`],
        rng
      );
      return {
        chapter: 'fizik', type: 'boson', topic: 'Sonlu Kesilmiş Bozon',
        prompt: `$D = ${D}$ boyutuna kesilmiş bozonik $[a, a^\\dagger]$ matrisinin son köşegen elemanı $[a, a^\\dagger]_{${D - 1},${D - 1}}$ kaçtır?`,
        options, answerIndex,
        explanation: `Sonlu boyutlu her matris çifti için $\\operatorname{Tr}[a,a^\\dagger] = 0$ olmak zorundadır. İlk $D-1 = ${D - 1}$ köşegen elemanı $+1$ olduğundan son eleman $-(D-1) = ${defectEntry}$ çıkar; bu $[a,a^\\dagger]=I$'nın yalnızca sonsuz boyutta sağlanabileceğini kanıtlar.`,
      };
    }
    const r = pick([1, 2, 3, 4], rng);
    const meanN = r * r;
    const { options, answerIndex } = makeUniqueOptions(
      `$${meanN}$`,
      [`$${r}$`, `$${2 * r}$`, `$${meanN + 1}$`, `$${meanN + 2}$`, `$${meanN + 3}$`],
      rng
    );
    return {
      chapter: 'fizik', type: 'boson', topic: 'Uyumlu Durumlar',
      prompt: `$|\\alpha| = ${r}$ parametreleri ile tanımlanan bozonik uyumlu durum $|\\alpha\\rangle$'de ortalama parçacık sayısı $\\langle N \\rangle$ kaçtır?`,
      options, answerIndex,
      explanation: `Uyumlu durum $a|\\alpha\\rangle = \\alpha|\\alpha\\rangle$ özvektörüdür; dolayısıyla $\\langle \\alpha | a^\\dagger a | \\alpha \\rangle = |\\alpha|^2 = ${r}^2 = ${meanN}$ ve dağılım Poisson ($\\Delta N^2 = |\\alpha|^2 = ${meanN}$) biçimindedir.`,
    };
  }

  if (chosen === 'osc3d') {
    const N = difficulty === 'kolay' ? pick([1, 2, 3], rng) : pick([3, 4, 5, 6], rng);
    const sh = oscillatorShell(N);
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const { options, answerIndex } = makeUniqueOptions(
        `$${sh.degeneracy}$`,
        [`$${(N + 1) ** 2}$`, `$${2 * N + 1}$`, `$${((N + 2) * (N + 3)) / 2}$`, `$${sh.degeneracy + 2}$`, `$${Math.max(1, sh.degeneracy - 1)}$`],
        rng
      );
      return {
        chapter: 'fizik', type: 'osc3d', topic: '3B Harmonik Osilatör',
        prompt: `3B izotropik harmonik osilatörde $N = ${N}$ ($E_${N} = \\frac{${2 * N + 3}}{2}\\hbar\\omega$) enerji düzeyinin $SU(3)$ kaynaklı dejenereliği kaçtır?`,
        options, answerIndex,
        explanation: `Dejenerelik $SU(3)$'ün simetrik $(${N}, 0)$ indirgenemez temsilinin boyutudur: $\\frac{(N+1)(N+2)}{2} = \\frac{${N + 1}\\cdot ${N + 2}}{2} = ${sh.degeneracy}$.`,
      };
    }
    const ans = sh.lValues.map(l => `l=${l}`).join(', ');
    const wrong1 = Array.from({ length: N + 1 }, (_, i) => `l=${i}`).reverse().join(', ');
    const wrong2 = sh.lValues.map(l => `l=${l + 1}`).join(', ');
    const wrong3 = `l=${N}`;
    const wrong4 = `l=${N + 1}, l=${N}`;
    const wrong5 = `l=${N}, l=0`;
    const { options, answerIndex } = makeUniqueOptions(
      `$${ans}$`,
      [`$${wrong1}$`, `$${wrong2}$`, `$${wrong3}$`, `$${wrong4}$`, `$${wrong5}$`],
      rng
    );
    return {
      chapter: 'fizik', type: 'osc3d', topic: 'SU(3) ⊃ SO(3) Dallanması',
      prompt: `3B harmonik osilatörün $N = ${N}$ kabuğundaki $(${N}, 0)$ $SU(3)$ temsili, $SO(3)$ altında hangi yörüngesel açısal momentum $l$ değerlerine ayrılır?`,
      options, answerIndex,
      explanation: `Parite $(-1)^N$ sabit kaldığından $l = N, N-2, \\dots$: $${ans}$. Toplam boyut $\\sum (2l+1) = ${sh.lValues.map(l => 2 * l + 1).join(' + ')} = ${sh.degeneracy}$.`,
    };
  }

  if (chosen === 'bohr') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const n = difficulty === 'kolay' ? pick([2, 3, 4], rng) : pick([4, 5, 6], rng);
      const lvl = bohrLevel(n);
      const j = (n - 1) / 2;
      const jStr = Number.isInteger(j) ? String(j) : `\\frac{${n - 1}}{2}`;
      const { options, answerIndex } = makeUniqueOptions(
        `$(${jStr}, ${jStr})$ — boyut $${lvl.degeneracy}$`,
        [
          `$(${n}, 0)$ — boyut $${(n + 1) * (n + 2) / 2}$`,
          `$(${jStr}, 0)$ — boyut $${n}$`,
          `$(${n - 1}, ${n - 1})$ — boyut $${(2 * n - 1) ** 2}$`,
        ],
        rng
      );
      return {
        chapter: 'fizik', type: 'bohr', topic: 'Bohr Atomu & SO(4)',
        prompt: `Hidrojen (Bohr) atomunun $n = ${n}$ kabuğu, gizli $SO(4) \\cong (SU(2)_+ \\times SU(2)_-)/\\mathbb{Z}_2$ simetrisinin hangi $(j_+, j_-)$ temsilini oluşturur (spin hariç)?`,
        options, answerIndex,
        explanation: `$\\vec{L}\\cdot\\vec{K}=0$ olduğundan $j_+ = j_- = \\frac{n-1}{2} = ${jStr}$ olur. Boyut $(2j+1)^2 = n^2 = ${lvl.degeneracy} = \\sum_{l=0}^{${n - 1}}(2l+1)$ olarak bulunur.`,
      };
    }
    const pair = pick([[2, 1], [3, 2], [4, 2], [4, 3]], rng);
    const tr = bohrTransition(pair[0], pair[1]);
    const ans = `${tr.seriesName} (${tr.wavelengthNm.toFixed(0)} nm)`;
    const { options, answerIndex } = makeUniqueOptions(
      ans,
      [
        `Lyman (${(tr.wavelengthNm * 0.45).toFixed(0)} nm)`,
        `Balmer (${(tr.wavelengthNm * 1.65).toFixed(0)} nm)`,
        `Paschen (${(tr.wavelengthNm * 2.4).toFixed(0)} nm)`,
        `Brackett (${(tr.wavelengthNm * 0.72).toFixed(0)} nm)`,
      ],
      rng
    );
    return {
      chapter: 'fizik', type: 'bohr', topic: 'Hidrojen Spektrumu',
      prompt: `Hidrojen atomunda $n = ${pair[0]} \\to n = ${pair[1]}$ geçişi hangi spektral seriye aittir ve yaklaşık dalga boyu nedir?`,
      options, answerIndex,
      explanation: `$\\Delta E = 13.606\\left(\\frac{1}{${pair[1]}^2} - \\frac{1}{${pair[0]}^2}\\right) = ${tr.deltaEv.toFixed(3)}\\text{ eV} \\implies \\lambda = \\frac{hc}{\\Delta E} \\approx ${tr.wavelengthNm.toFixed(1)}\\text{ nm}$ (${tr.label}, ${tr.region}).`,
    };
  }

  if (chosen === 'isospin') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const pair = pick([[2, 0], [4, 0], [2, 1], [1, 1], [8, 0]], rng);
      const eb = elliottBranching(pair[0], pair[1]);
      const { options, answerIndex } = makeUniqueOptions(
        `$${eb.dim}$`,
        [`$${(pair[0] + 1) * (pair[1] + 1)}$`, `$${eb.dim + 3}$`, `$${eb.dim - 2 > 0 ? eb.dim - 2 : eb.dim + 6}$`, `$${(pair[0] + pair[1] + 1) ** 2}$`],
        rng
      );
      return {
        chapter: 'fizik', type: 'isospin', topic: 'Elliott SU(3) Modeli',
        prompt: `Elliott çekirdek modelinde $SU(3)$'ün $(\\lambda, \\mu) = (${pair[0]}, ${pair[1]})$ indirgenemez temsilinin boyutu kaçtır?`,
        options, answerIndex,
        explanation: `$\\dim(\\lambda,\\mu) = \\frac{1}{2}(\\lambda+1)(\\mu+1)(\\lambda+\\mu+2) = \\frac{1}{2}(${pair[0] + 1})(${pair[1] + 1})(${pair[0] + pair[1] + 2}) = ${eb.dim}$.`,
      };
    }
    const { options, answerIndex } = makeUniqueOptions(
      '$I = 0$ (antisimetrik izospin teklisi)',
      [
        '$I = 1$ (simetrik izospin üçlüsü)',
        '$I = 1/2$ (izospin ikilisi)',
        '$I = 2$ (izospin beşlisi)',
      ],
      rng
    );
    return {
      chapter: 'fizik', type: 'isospin', topic: 'İzospin & Döteron',
      prompt: 'Taban durumdaki döteron ($^2\\text{H}$) $L=0$ (simetrik uzay) ve $S=1$ (simetrik spin) taşıdığına göre genelleştirilmiş Pauli ilkesi hangi toplam izospin $I$ değerini zorunlu kılar?',
      options, answerIndex,
      explanation: 'İki özdeş fermiyonun (nükleonun) toplam dalga fonksiyonu antisimetrik olmalıdır. Uzay ($S$) $\\times$ Spin ($S$) simetrik olduğundan izospin antisimetrik tekli $I=0$: $\\frac{1}{\\sqrt{2}}(|pn\\rangle - |np\\rangle)$ zorunludur.',
    };
  }

  // --- CHAPTER: UZAYZAMAN ---
  if (chosen === 'lorentz') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const pair = pick([[0.5, 0], [0.5, 0.5], [1, 0], [1, 0.5], [1, 1], [1.5, 0.5]], rng);
      const rep = lorentzIrrep(pair[0], pair[1]);
      const fmt = x => Number.isInteger(x) ? String(x) : `\\frac{${Math.round(2 * x)}}{2}`;
      const { options, answerIndex } = makeUniqueOptions(
        `$${rep.dim}$`,
        [`$${Math.round(2 * (pair[0] + pair[1]) + 1)}$`, `$${rep.dim + 2}$`, `$${Math.max(1, rep.dim - 1)}$`, `$${rep.dim * 2}$`, `$${rep.dim + 3}$`, `$${rep.dim + 4}$`],
        rng
      );
      return {
        chapter: 'uzayzaman', type: 'lorentz', topic: 'Lorentz (j₁, j₂) Temsilleri',
        prompt: `Lorentz grubu $SO(3,1)$'in $(j_1, j_2) = (${fmt(pair[0])}, ${fmt(pair[1])})$ indirgenemez temsilinin boyutu kaçtır?`,
        options, answerIndex,
        explanation: `$\\dim(j_1, j_2) = (2j_1+1)(2j_2+1) = (${Math.round(2 * pair[0] + 1)})(${Math.round(2 * pair[1] + 1)}) = ${rep.dim}$ (${rep.name}).`,
      };
    }
    const e1 = pick([0.4, 0.6, 0.8, 1.0], rng);
    const e2 = pick([0.3, 0.5, 0.7], rng);
    const sum = +(e1 + e2).toFixed(2);
    const beta = Math.tanh(sum).toFixed(3);
    const { options, answerIndex } = makeUniqueOptions(
      `$\\eta = ${sum}$ ($\\beta = \\tanh ${sum} \\approx ${beta}$)`,
      [
        `$\\eta = ${(e1 * e2).toFixed(2)}$`,
        `$\\eta = ${(Math.hypot(e1, e2)).toFixed(2)}$`,
        `$\\eta = ${((e1 + e2) / (1 + e1 * e2)).toFixed(2)}$`,
      ],
      rng
    );
    return {
      chapter: 'uzayzaman', type: 'lorentz', topic: 'Lorentz Boost & Rapidity',
      prompt: `Aynı $+x$ ekseni boyunca ardışık iki Lorentz boost'unun rapiditeleri $\\eta_1 = ${e1}$ ve $\\eta_2 = ${e2}$ ise bileşke boost'un rapiditesi nedir?`,
      options, answerIndex,
      explanation: `Aynı eksendeki boost'lar değişmeli $SO(1,1)$ alt grubunu oluşturur ve rapiditeler doğrudan toplanır: $B_x(\\eta_1)B_x(\\eta_2) = B_x(\\eta_1+\\eta_2) = B_x(${sum})$, $\\beta_{12} = \\tanh(${sum}) \\approx ${beta}$.`,
    };
  }

  if (chosen === 'poincare') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const d = pick([2, 3, 4, 6], rng);
      const cg = conformalGenerators(d);
      const { options, answerIndex } = makeUniqueOptions(
        `$${cg.total}$ ($SO(${d}, 2)$)`,
        [
          `$${d * (d + 1) / 2}$ (Poincaré)`,
          `$${cg.total - d}$ (SCT hariç)`,
          `$${cg.total + d}$`,
        ],
        rng
      );
      return {
        chapter: 'uzayzaman', type: 'poincare', topic: 'Konformal Grup',
        prompt: `$d = ${d}$ boyutlu uzay-zamanda konformal grubun toplam üreteç sayısı kaçtır?`,
        options, answerIndex,
        explanation: `Üreteçler: $${d}$ öteleme + $${d * (d - 1) / 2}$ Lorentz + $1$ dilatasyon + $${d}$ özel konformal = $${cg.total} = \\binom{${d + 2}}{2} = \\dim SO(${d}, 2)$.`,
      };
    }
    const massive = rng() < 0.5;
    if (massive) {
      const { options, answerIndex } = makeUniqueOptions(
        '$SO(3)$ (çift örtü $SU(2)$ — spin $s$)',
        ['$ISO(2) = E(2)$ (helisite)', '$SO(2,1)$', '$SO(4,2)$'],
        rng
      );
      return {
        chapter: 'uzayzaman', type: 'poincare', topic: 'Wigner Küçük Grubu',
        prompt: 'Kütleli bir parçacık ($P^2 = m^2 > 0, P^0 > 0$) için Poincaré grubunun Wigner küçük grubu (little group) hangisidir?',
        options, answerIndex,
        explanation: 'Durgunluk çerçevesinde $P^\\mu = (m,0,0,0)$ vektörünü sabit bırakan Lorentz alt grubu 3B dönme grubu $SO(3)$\'tür (spinörler için çift örtüsü $SU(2)$); $W^2 = -m^2 s(s+1)$.',
      };
    }
    const { options, answerIndex } = makeUniqueOptions(
      '$ISO(2) = E(2)$ (sonlu bileşenlerde helisite $SO(2)$)',
      ['$SO(3)$ (spin $2s+1$ durum)', '$SU(3)$', '$SO(3,1)$'],
      rng
    );
    return {
      chapter: 'uzayzaman', type: 'poincare', topic: 'Wigner Küçük Grubu',
      prompt: 'Foton gibi kütlesiz bir parçacık ($P^2 = 0, P^0 > 0$) için Wigner küçük grubu hangisidir?',
      options, answerIndex,
      explanation: '$P^\\mu = (E,0,0,E)$ vektörünü koruyan küçük grup 2B Öklid grubu $ISO(2)$\'dir; fiziksel sonlu durumlar için ötelemeler önemsiz etki eder ve geriye helisite $\\lambda = \\pm s$ veren $SO(2)$ kalır.',
    };
  }

  if (chosen === 'quark') {
    const combos = [
      { type: 'baryon', flavors: ['u', 'u', 'u'] },
      { type: 'baryon', flavors: ['u', 'u', 'd'] },
      { type: 'baryon', flavors: ['u', 'd', 'd'] },
      { type: 'baryon', flavors: ['s', 's', 's'] },
      { type: 'meson', flavors: ['u', 'd'] },
      { type: 'meson', flavors: ['u', 's'] },
    ];
    const c = pick(combos, rng);
    const h = buildHadron(c.type, c.flavors);
    const qStr = fracTex(h.Q);
    const { options, answerIndex } = makeUniqueOptions(
      `$Q = ${qStr}$`,
      ['$Q = +2$', '$Q = +1$', '$Q = 0$', '$Q = -1$', '$Q = -2$'].filter(x => x !== `$Q = ${qStr}$`),
      rng
    );
    return {
      chapter: 'uzayzaman', type: 'quark', topic: 'Kuark Modeli',
      prompt: `Bileşimi $${h.composition}$ (${h.knownName}) olan hadronun elektrik yükü $Q$ nedir?`,
      options, answerIndex,
      explanation: `Kuark yükleri $Q_u = +\\frac{2}{3}, Q_d = Q_s = -\\frac{1}{3}$ (antikuarklar zıt işaretli) toplanarak $Q = ${qStr}$ elde edilir ve Gell-Mann–Nishijima $Q = I_3 + \\frac{B+S}{2}$ doğrulanır.`,
    };
  }

  if (chosen === 'sm') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const f = pick(SM_FAMILY.slice(0, 5), rng);
      const comp = pick(f.components, rng);
      const expectedQ = fracAdd(comp.T3, f.Y);
      const ans = `$Y = ${fracTex(f.Y)}$`;
      const { options, answerIndex } = makeUniqueOptions(
        ans,
        ['$Y = \\frac{1}{6}$', '$Y = \\frac{2}{3}$', '$Y = -\\frac{1}{3}$', '$Y = -\\frac{1}{2}$', '$Y = -1$'].filter(x => x !== ans),
        rng
      );
      return {
        chapter: 'uzayzaman', type: 'sm', topic: 'Standart Model Hiperyükü',
        prompt: `$Q = T_3 + Y$ kuralına göre $${comp.label}$ fermiyonunun ($T_3 = ${fracTex(comp.T3)}$, $Q = ${fracTex(expectedQ)}$) zayıf hiperyükü $Y$ nedir?`,
        options, answerIndex,
        explanation: `$Y = Q - T_3 = ${fracTex(expectedQ)} - \\left(${fracTex(comp.T3)}\\right) = ${fracTex(f.Y)}$.`,
      };
    }
    const { options, answerIndex } = makeUniqueOptions(
      '$N_c Y_{Q_L} + Y_{L_L} = 3(\\frac{1}{6}) + (-\\frac{1}{2}) = 0$',
      [
        '$Y_{Q_L} + Y_{L_L} = 0$',
        '$Y_{u_R} + Y_{d_R} = 0$',
        '$2 Y_{e_R} + Y_{L_L} = 0$',
      ],
      rng
    );
    return {
      chapter: 'uzayzaman', type: 'sm', topic: 'Anomali İptali',
      prompt: 'Standart Modelde tek bir aile için $[SU(2)_L]^2 U(1)_Y$ karma ayar anomalisinin sıfırlanması hangi kuark–lepton bağlantısını gerektirir?',
      options, answerIndex,
      explanation: 'Yalnızca $SU(2)_L$ ikilileri ($Q_L$, 3 renk ve $L_L$, 1 renk) katkı verir: $\\mathcal{A} = \\frac{1}{2}(N_c Y_{Q_L} + Y_{L_L}) = \\frac{1}{2}(3\\cdot\\frac{1}{6} - \\frac{1}{2}) = 0$. Renk sayısı $N_c=3$ olmasaydı teori tutarsız olurdu!',
    };
  }

  if (chosen === 'gut') {
    const variant = Math.floor(rng() * 3);
    if (variant === 0) {
      const { options, answerIndex } = makeUniqueOptions(
        '$\\sin^2\\theta_W = \\frac{3}{8} = 0.375$',
        ['$\\sin^2\\theta_W = \\frac{1}{4} = 0.25$', '$\\sin^2\\theta_W = \\frac{1}{2} = 0.50$', '$\\sin^2\\theta_W = \\frac{3}{5} = 0.60$'],
        rng
      );
      return {
        chapter: 'uzayzaman', type: 'gut', topic: 'SU(5) Büyük Birleşme',
        prompt: '$SU(5)$ büyük birleşme ölçeğinde $\\sin^2\\theta_W = \\frac{\\operatorname{Tr}(T_3^2)}{\\operatorname{Tr}(Q^2)}$ iz oranının tam değeri kaçtır?',
        options, answerIndex,
        explanation: '$\\bar{\\mathbf{5}}$ temsilinde $\\operatorname{Tr}(T_3^2) = \\frac{1}{2}$ ve $\\operatorname{Tr}(Q^2) = 3(\\frac{1}{3})^2 + (-1)^2 = \\frac{4}{3}$ olduğundan $\\sin^2\\theta_W = \\frac{1/2}{4/3} = \\frac{3}{8} = 0.375$.',
      };
    }
    if (variant === 1) {
      const { options, answerIndex } = makeUniqueOptions(
        '$\\mathbf{16} \\to \\mathbf{10} \\oplus \\bar{\\mathbf{5}} \\oplus \\mathbf{1}$ (sağ nötrino dahil)',
        ['$\\mathbf{10} \\to \\mathbf{5} \\oplus \\bar{\\mathbf{5}}$', '$\\mathbf{24} \\to \\mathbf{15} \\oplus \\mathbf{8} \\oplus \\mathbf{1}$', '$\\mathbf{15} \\to \\mathbf{10} \\oplus \\mathbf{5}$'],
        rng
      );
      return {
        chapter: 'uzayzaman', type: 'gut', topic: 'SO(10) Birleşmesi',
        prompt: '$SO(10)$ büyük birleşme teorisinde bir Standart Model fermiyon ailesi hangi indirgenemez temsilde birleşir ve $SU(5)$ altında nasıl ayrışır?',
        options, answerIndex,
        explanation: '$SO(10)$\'un $16$ boyutlu kiral spinörü tek bir temsilde tüm $15$ SM Weyl fermiyonu artı sağ-elli nötrino $\\nu_L^c$ teklisini barındırır: $\\mathbf{16} = \\mathbf{10} \\oplus \\bar{\\mathbf{5}} \\oplus \\mathbf{1}$.',
      };
    }
    const { options, answerIndex } = makeUniqueOptions(
      '$\\sin^2\\theta_{12}=\\frac{1}{3},\\; \\sin^2\\theta_{23}=\\frac{1}{2},\\; \\theta_{13}=0$',
      [
        '$\\sin^2\\theta_{12}=\\frac{1}{2},\\; \\sin^2\\theta_{23}=\\frac{1}{3},\\; \\theta_{13}=\\frac{\\pi}{4}$',
        '$\\theta_{12}=\\theta_{23}=\\theta_{13}=0$',
        '$\\sin^2\\theta_{12}=\\frac{1}{4},\\; \\sin^2\\theta_{23}=\\frac{1}{4},\\; \\sin^2\\theta_{13}=\\frac{1}{2}$',
      ],
      rng
    );
    return {
      chapter: 'uzayzaman', type: 'gut', topic: 'Aile Simetrileri (TBM)',
      prompt: '$A_4$ ve $S_4$ gibi sonlu çeşni simetrilerinden elde edilen Tribimaximal (TBM) nötrino karışım matrisi hangi karışım açılarını öngörür?',
      options, answerIndex,
      explanation: 'TBM matrisi $\\sin^2\\theta_{12} = 1/3$ (trimaksimal 2. sütun), $\\sin^2\\theta_{23} = 1/2$ (maksimal atmosferik) ve $\\theta_{13} = 0$ verir; deneysel $\\theta_{13} \\approx 8.5^\\circ$ bu simetrinin küçük bir bozunumuna işaret eder.',
    };
  }

  // --- CHAPTER: OZEL ---
  if (chosen === 'symmetry') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const solid = pick(PLATONIC_SOLIDS, rng);
      const ans = `$${solid.rotGroup}$ (mertebe $${solid.rotOrder}$)`;
      const { options, answerIndex } = makeUniqueOptions(
        ans,
        ['$A_4$ (mertebe $12$)', '$S_4$ (mertebe $24$)', '$A_5$ (mertebe $60$)', '$D_6$ (mertebe $12$)', '$S_5$ (mertebe $120$)'].filter(x => x !== ans),
        rng
      );
      return {
        chapter: 'ozel', type: 'symmetry', topic: 'Platon Katıları',
        prompt: `${solid.name} ($V=${solid.V}, E=${solid.E}, F=${solid.F}$) katısının öz (yönelim koruyan) 3B dönme simetri grubu hangisidir?`,
        options, answerIndex,
        explanation: `${solid.note} Ayrıca Euler formülü: $V - E + F = ${solid.V} - ${solid.E} + ${solid.F} = 2$.`,
      };
    }
    const { options, answerIndex } = makeUniqueOptions(
      '$17$ duvar kağıdı grubu (dönme mertebeleri $1, 2, 3, 4, 6$)',
      [
        '$14$ duvar kağıdı grubu (dönme mertebeleri $1, 2, 3, 4, 5, 6$)',
        '$230$ duvar kağıdı grubu',
        '$7$ duvar kağıdı grubu (yalnızca $1, 2, 4$)',
      ],
      rng
    );
    return {
      chapter: 'ozel', type: 'symmetry', topic: 'Duvar Kağıdı Grupları',
      prompt: '2 boyutlu Öklid düzleminde periyodik desenleri sınıflandıran kaç farklı duvar kağıdı grubu vardır ve kristalografik kısıtlama teoremi hangi dönme mertebelerine izin verir?',
      options, answerIndex,
      explanation: '2B periyodik kafesle uyumlu dönme açıları yalnızca $2\\cos\\theta \\in \\mathbb{Z}$ koşulunu sağlayan $n \\in \\{1, 2, 3, 4, 6\\}$ değerleridir (5-katlı dönme periyodik olamaz) ve toplamda tam $17$ duvar kağıdı grubu vardır.',
    };
  }

  if (chosen === 'hurwitz') {
    const variant = Math.floor(rng() * 2);
    if (variant === 0) {
      const { options, answerIndex } = makeUniqueOptions(
        '$1, 2, 4, 8$ ($\\mathbb{R}, \\mathbb{C}, \\mathbb{H}, \\mathbb{O}$)',
        ['$1, 2, 4, 8, 16$ (sedeniyonlar dahil)', '$1, 2, 3, 4$', '$2, 4, 6, 8$'],
        rng
      );
      return {
        chapter: 'ozel', type: 'hurwitz', topic: 'Hurwitz Teoremi',
        prompt: 'Hurwitz teoremine göre normlu bölme cebirleri ($\\|xy\\| = \\|x\\|\\|y\\|$) yalnızca hangi boyutlarda var olabilir?',
        options, answerIndex,
        explanation: 'Hurwitz (1898) teoremi normlu bölme cebirlerinin yalnızca $1$ ($\\mathbb{R}$), $2$ ($\\mathbb{C}$), $4$ ($\\mathbb{H}$) ve $8$ ($\\mathbb{O}$) boyutlarında mevcut olduğunu kanıtlar. $16$ boyutlu sedeniyonlarda sıfır bölenler ortaya çıkar.',
      };
    }
    const pairs = [
      { expr: 'i \\cdot j', ans: '+k', why: 'Kuaterniyonlarda döngüsel çarpım $i \\to j \\to k$: $ij = +k$.' },
      { expr: 'j \\cdot i', ans: '-k', why: 'Kuaterniyon çarpımı değişmeli değildir: $ji = -ij = -k$.' },
      { expr: 'j \\cdot k', ans: '+i', why: 'Döngüsel sıra $j \\to k \\to i$ gereği $jk = +i$.' },
      { expr: 'k \\cdot j', ans: '-i', why: 'Ters döngüsel sıra: $kj = -jk = -i$.' },
      { expr: 'k \\cdot i', ans: '+j', why: 'Döngüsel sıra $k \\to i \\to j$ gereği $ki = +j$.' },
    ];
    const p = pick(pairs, rng);
    const { options, answerIndex } = makeUniqueOptions(
      `$${p.ans}$`,
      ['$+1$', '$-1$', '$+i$', '$-i$', '$+j$', '$-j$', '$+k$', '$-k$'].filter(x => x !== `$${p.ans}$`),
      rng
    );
    return {
      chapter: 'ozel', type: 'hurwitz', topic: 'Kuaterniyon Çarpımı',
      prompt: 'Hamilton kuaterniyonları $\\mathbb{H}$ içinde $' + p.expr + '$ çarpımının sonucu nedir?',
      options, answerIndex,
      explanation: p.why,
    };
  }

  if (chosen === 'octonion') {
    const tbl = octonionMulTable();
    const a = 1 + Math.floor(rng() * 7);
    let b = 1 + Math.floor(rng() * 7);
    if (b === a) b = (a % 7) + 1;
    const prod = tbl[a][b];
    const ans = `$${prod.sign > 0 ? '+' : '-'}e_{${prod.index}}$`;
    const altIdx1 = (prod.index % 7) + 1;
    const altIdx2 = ((prod.index + 2) % 7) + 1;
    const { options, answerIndex } = makeUniqueOptions(
      ans,
      [`$${prod.sign > 0 ? '-' : '+'}e_{${prod.index}}$`, `$+e_{${altIdx1}}$`, `$-e_{${altIdx2}}$`, '$-1$'],
      rng
    );
    const triple = FANO_TRIPLES.find(t => t.includes(a) && t.includes(b));
    return {
      chapter: 'ozel', type: 'octonion', topic: 'Oktoniyon & Fano Düzlemi',
      prompt: `Cayley–Dickson oktoniyon cebiri $\\mathbb{O}$ içinde (Fano doğrusu $(${triple.join('\\to ')})$) $e_${a} \\cdot e_${b}$ çarpımının sonucu nedir?`,
      options, answerIndex,
      explanation: `Fano düzleminde $e_${a}$ ve $e_${b}$ birimleri yönlü $(${triple.join(' \\to ')})$ doğrusunda yer alır; ok yönünü izleyerek $e_${a}\\cdot e_${b} = ${prod.sign > 0 ? '+' : '-'}e_{${prod.index}}$ bulunur.`,
    };
  }

  if (chosen === 'jordan') {
    const h = pick(HURWITZ_ALGEBRAS, rng);
    const dim = hermitian3Dim(h.dim);
    const { options, answerIndex } = makeUniqueOptions(
      `$${dim}$`,
      [`$${9 * h.dim}$`, `$${3 * h.dim}$`, `$${dim - 1}$`, `$${dim + 3}$`],
      rng
    );
    return {
      chapter: 'ozel', type: 'jordan', topic: 'Hermisyen 3×3 Matrisler & Albert Cebiri',
      prompt: `$${h.sym}$ (${h.name}, $\\dim = ${h.dim}$) üzerindeki $3\\times 3$ Hermisyen matrislerin Jordan cebiri $H_3(${h.sym})$'nin reel boyutu kaçtır?`,
      options, answerIndex,
      explanation: `Köşegende $3$ reel eleman ve köşegen dışında $3$ bağımsız $${h.sym}$ elemanı vardır: $\\dim H_3(${h.sym}) = 3 + 3\\cdot ${h.dim} = ${dim}$. Özellikle $H_3(\\mathbb{O})$ $27$-boyutlu istisnai Albert cebiridir ($\\operatorname{Aut} = F_4$).`,
    };
  }

  // Default: 'magic'
  const r = Math.floor(rng() * 4);
  const c = Math.floor(rng() * 4);
  const cell = MAGIC_SQUARE[r][c];
  const ans = `$${cell.cartan}$ ($\\dim = ${cell.dim}$)`;
  const flat = MAGIC_SQUARE.flat().filter(x => x.cartan !== cell.cartan);
  const distractors = [];
  while (distractors.length < 3) {
    const d = pick(flat, rng);
    const s = `$${d.cartan}$ ($\\dim = ${d.dim}$)`;
    if (!distractors.includes(s)) distractors.push(s);
  }
  const { options, answerIndex } = makeUniqueOptions(ans, distractors, rng);
  return {
    chapter: 'ozel', type: 'magic', topic: 'Freudenthal–Tits Sihirli Karesi',
    prompt: `Freudenthal–Tits sihirli karesinin $(${cell.rowSym}, ${cell.colSym})$ girdisindeki Lie cebiri ve boyutu hangisidir?`,
    options, answerIndex,
    explanation: `Barton–Sudbery formülüyle $\\dim\\mathfrak{m}(${cell.rowSym},${cell.colSym}) = ${cell.dimFormula.triTerms.join(' + ')} = ${cell.dim}$, yani $${cell.cartan}$ (${cell.classical}): ${cell.role}.`,
  };
}
