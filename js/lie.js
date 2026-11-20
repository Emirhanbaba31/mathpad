// MathPad Lie Groups & Lie Algebras Engine — pure mathematics, zero DOM dependencies.
// Covers Pierre Ramond's "Group Theory: A Physicist's Survey" Chapters 5, 6, 7, 8, 10, Appendix 2,
// plus SU(2)/SU(3)/SU(1,1) oscillator constructions from Chapter 4.3.
//
// Conventions (used consistently everywhere):
// - Cartan matrix: A_{ij} = 2 (alpha_i, alpha_j) / (alpha_j, alpha_j). Row i of A is alpha_i in Dynkin (omega) labels.
// - Root normalization: long roots have |alpha_long|^2 = 2, so d_i = |alpha_i|^2 / 2 in {1, 1/2, 1/3}.
// - Quadratic form matrix (metric in omega-basis): G_{ij} = (omega_i, omega_j) = (A^{-1})_{ij} d_j.
// - Quadratic Casimir: C_2(Lambda) = 1/2 * (Lambda, Lambda + 2*rho).
// - Dynkin index: T(Lambda) = (dim(Lambda) / dim(g)) * C_2(Lambda).
//   In this standard physics normalization: T(fund of SU(N)) = 1/2, T(vec of SO(N)) = 1, T(adj) = C_2(adj) = h^v.

export const CASIMIR_NORMALIZATION = 'T(fund SU(N)) = 1/2, T(vec SO(N)) = 1, T(adj) = h^v, |alpha_long|^2 = 2';

// =====================================================================
// 1. EXACT BIGINT RATIONAL ARITHMETIC
// =====================================================================

export function bigAbs(a) {
  return a < 0n ? -a : a;
}

export function bigGcd(a, b) {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function bigLcm(a, b) {
  a = bigAbs(a);
  b = bigAbs(b);
  if (a === 0n || b === 0n) return 0n;
  return (a / bigGcd(a, b)) * b;
}

export function rat(n, d = 1n) {
  let num = typeof n === 'bigint' ? n : BigInt(Math.trunc(n));
  let den = typeof d === 'bigint' ? d : BigInt(Math.trunc(d));
  if (den === 0n) throw new Error('Sıfıra bölme hatası');
  if (den < 0n) { num = -num; den = -den; }
  if (num === 0n) return { n: 0n, d: 1n };
  const g = bigGcd(num, den);
  return { n: num / g, d: den / g };
}

export const R0 = { n: 0n, d: 1n };
export const R1 = { n: 1n, d: 1n };

export function ratAdd(a, b) {
  if (a.n === 0n) return b;
  if (b.n === 0n) return a;
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function ratSub(a, b) {
  if (b.n === 0n) return a;
  return rat(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function ratMul(a, b) {
  if (a.n === 0n || b.n === 0n) return R0;
  return rat(a.n * b.n, a.d * b.d);
}

export function ratDiv(a, b) {
  if (b.n === 0n) throw new Error('Sıfıra bölme hatası');
  if (a.n === 0n) return R0;
  return rat(a.n * b.d, a.d * b.n);
}

export function ratNeg(a) {
  return a.n === 0n ? R0 : { n: -a.n, d: a.d };
}

export function ratEq(a, b) {
  return a.n === b.n && a.d === b.d;
}

export function ratCmp(a, b) {
  const diff = a.n * b.d - b.n * a.d;
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export function ratToNumber(a) {
  return Number(a.n) / Number(a.d);
}

export function ratFormat(a) {
  if (a.d === 1n) return String(a.n);
  return `${a.n}/${a.d}`;
}

export function ratLatex(a) {
  if (a.d === 1n) return String(a.n);
  if (a.n < 0n) return `-\\frac{${-a.n}}{${a.d}}`;
  return `\\frac{${a.n}}{${a.d}}`;
}

const FACT_CACHE = [1n, 1n];
export function factorialBig(n) {
  if (n < 0) throw new Error('Negatif faktöriyel');
  while (FACT_CACHE.length <= n) {
    FACT_CACHE.push(FACT_CACHE[FACT_CACHE.length - 1] * BigInt(FACT_CACHE.length));
  }
  return FACT_CACHE[n];
}

// Extract maximal integer k such that k^2 | m (for positive BigInt m)
function splitSquare(m) {
  let out = 1n;
  let rem = m;
  let p = 2n;
  while (p * p <= rem) {
    while (rem % (p * p) === 0n) {
      rem /= p * p;
      out *= p;
    }
    p = p === 2n ? 3n : p + 2n;
  }
  return { sq: out, free: rem };
}

// Format exact signed square root of rational: sign * sqrt(num / den)
export function sqrtRatFormat(sign, num, den) {
  const r = rat(num, den);
  if (sign === 0 || r.n === 0n) return { text: '0', latex: '0' };
  const s = sign < 0 ? '-' : '';
  const { sq: sn, free: fn } = splitSquare(r.n);
  const { sq: sd, free: fd } = splitSquare(r.d);
  // Rationalize: (sn/sd) * sqrt(fn/fd)
  if (fn === 1n && fd === 1n) {
    const q = rat(sn, sd);
    return { text: s + ratFormat(q), latex: s + ratLatex(q) };
  }
  if (fd === 1n) {
    const q = rat(sn, sd);
    const prefT = q.n === 1n && q.d === 1n ? '' : q.d === 1n ? `${q.n}` : `(${q.n}/${q.d})`;
    const text = `${s}${prefT}√${fn}`;
    const latex = q.d === 1n
      ? `${s}${q.n === 1n ? '' : q.n}\\sqrt{${fn}}`
      : `${s}\\frac{${q.n === 1n ? '' : q.n}\\sqrt{${fn}}}{${q.d}}`;
    return { text, latex };
  }
  if (fn === 1n && sn === 1n && sd === 1n) {
    return { text: `${s}1/√${fd}`, latex: `${s}\\frac{1}{\\sqrt{${fd}}}` };
  }
  const text = `${s}√(${r.n}/${r.d})`;
  const latex = `${s}\\sqrt{\\frac{${r.n}}{${r.d}}}`;
  return { text, latex };
}

// Exact rational matrix inversion (Gauss-Jordan on Rat[][])
export function invertRatMatrix(M) {
  const n = M.length;
  const aug = M.map((row, i) => [
    ...row.map(v => (typeof v === 'object' ? v : rat(v))),
    ...Array.from({ length: n }, (_, j) => (i === j ? R1 : R0)),
  ]);
  for (let col = 0; col < n; col++) {
    let piv = -1;
    for (let r = col; r < n; r++) {
      if (aug[r][col].n !== 0n) { piv = r; break; }
    }
    if (piv === -1) return null;
    if (piv !== col) [aug[col], aug[piv]] = [aug[piv], aug[col]];
    const pv = aug[col][col];
    for (let j = col; j < 2 * n; j++) aug[col][j] = ratDiv(aug[col][j], pv);
    for (let r = 0; r < n; r++) {
      if (r === col || aug[r][col].n === 0n) continue;
      const f = aug[r][col];
      for (let j = col; j < 2 * n; j++) {
        aug[r][j] = ratSub(aug[r][j], ratMul(f, aug[col][j]));
      }
    }
  }
  return aug.map(row => row.slice(n));
}

// Exact determinant of integer/rational matrix
export function detRatMatrix(M) {
  const n = M.length;
  const A = M.map(row => row.map(v => (typeof v === 'object' ? v : rat(v))));
  let det = R1;
  for (let col = 0; col < n; col++) {
    let piv = -1;
    for (let r = col; r < n; r++) {
      if (A[r][col].n !== 0n) { piv = r; break; }
    }
    if (piv === -1) return R0;
    if (piv !== col) {
      [A[col], A[piv]] = [A[piv], A[col]];
      det = ratNeg(det);
    }
    const pv = A[col][col];
    det = ratMul(det, pv);
    for (let r = col + 1; r < n; r++) {
      if (A[r][col].n === 0n) continue;
      const f = ratDiv(A[r][col], pv);
      for (let j = col; j < n; j++) {
        A[r][j] = ratSub(A[r][j], ratMul(f, A[col][j]));
      }
    }
  }
  return det;
}

// =====================================================================
// 2. COMPLEX NUMBER & MATRIX ALGEBRA
// =====================================================================

export const c = (re, im = 0) => ({ re, im });
export const cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cScale = (a, s) => ({ re: a.re * s, im: a.im * s });
export const cConj = a => ({ re: a.re, im: -a.im });
export const cAbs = a => Math.hypot(a.re, a.im);

export function matZero(n, m = n) {
  return Array.from({ length: n }, () => Array.from({ length: m }, () => c(0, 0)));
}

export function matEye(n) {
  const M = matZero(n);
  for (let i = 0; i < n; i++) M[i][i] = c(1, 0);
  return M;
}

export function matAdd(A, B) {
  return A.map((row, i) => row.map((v, j) => cAdd(v, B[i][j])));
}

export function matSub(A, B) {
  return A.map((row, i) => row.map((v, j) => cSub(v, B[i][j])));
}

export function matScale(A, z) {
  const cz = typeof z === 'number' ? c(z, 0) : z;
  return A.map(row => row.map(v => cMul(v, cz)));
}

export function matMul(A, B) {
  const n = A.length, k = B.length, m = B[0].length;
  const out = matZero(n, m);
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      const a = A[i][t];
      if (a.re === 0 && a.im === 0) continue;
      for (let j = 0; j < m; j++) {
        const b = B[t][j];
        out[i][j].re += a.re * b.re - a.im * b.im;
        out[i][j].im += a.re * b.im + a.im * b.re;
      }
    }
  }
  return out;
}

export function matDag(A) {
  const n = A.length, m = A[0].length;
  const out = matZero(m, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) out[j][i] = cConj(A[i][j]);
  }
  return out;
}

export function matTrace(A) {
  let re = 0, im = 0;
  for (let i = 0; i < A.length; i++) { re += A[i][i].re; im += A[i][i].im; }
  return c(re, im);
}

export function matComm(A, B) {
  return matSub(matMul(A, B), matMul(B, A));
}

export function matAntiComm(A, B) {
  return matAdd(matMul(A, B), matMul(B, A));
}

export function matKron(A, B) {
  const ra = A.length, ca = A[0].length, rb = B.length, cb = B[0].length;
  const out = matZero(ra * rb, ca * cb);
  for (let i = 0; i < ra; i++) {
    for (let j = 0; j < ca; j++) {
      for (let p = 0; p < rb; p++) {
        for (let q = 0; q < cb; q++) {
          out[i * rb + p][j * cb + q] = cMul(A[i][j], B[p][q]);
        }
      }
    }
  }
  return out;
}

export function matMaxAbs(A) {
  let mx = 0;
  for (const row of A) {
    for (const v of row) {
      const a = cAbs(v);
      if (a > mx) mx = a;
    }
  }
  return mx;
}

// Matrix exponential exp(A) by scaling and squaring with Taylor order 18
export function matExp(A) {
  const n = A.length;
  const norm = matMaxAbs(A) * n;
  const s = norm > 0.5 ? Math.ceil(Math.log2(norm * 2)) : 0;
  const scale = 1 / (2 ** s);
  const As = matScale(A, scale);
  let res = matEye(n);
  let term = matEye(n);
  for (let k = 1; k <= 18; k++) {
    term = matScale(matMul(term, As), 1 / k);
    res = matAdd(res, term);
    if (matMaxAbs(term) < 1e-15) break;
  }
  for (let i = 0; i < s; i++) res = matMul(res, res);
  return res;
}

export function formatComplex(z, prec = 3) {
  const eps = 1e-10;
  const r = Math.abs(z.re) < eps ? 0 : z.re;
  const im = Math.abs(z.im) < eps ? 0 : z.im;
  const fmt = x => {
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    if (Math.abs(x * 2 - Math.round(x * 2)) < 1e-9) return `${Math.round(x * 2)}/2`;
    if (Math.abs(x - 1 / Math.sqrt(3)) < 1e-9) return '1/√3';
    if (Math.abs(x + 1 / Math.sqrt(3)) < 1e-9) return '-1/√3';
    if (Math.abs(x - 2 / Math.sqrt(3)) < 1e-9) return '2/√3';
    if (Math.abs(x + 2 / Math.sqrt(3)) < 1e-9) return '-2/√3';
    if (Math.abs(x - Math.sqrt(3) / 2) < 1e-9) return '√3/2';
    if (Math.abs(x + Math.sqrt(3) / 2) < 1e-9) return '-√3/2';
    if (Math.abs(x - 1 / (2 * Math.sqrt(3))) < 1e-9) return '1/(2√3)';
    if (Math.abs(x + 1 / (2 * Math.sqrt(3))) < 1e-9) return '-1/(2√3)';
    if (Math.abs(x - Math.SQRT1_2) < 1e-9) return '1/√2';
    if (Math.abs(x + Math.SQRT1_2) < 1e-9) return '-1/√2';
    return Number(x.toFixed(prec)).toString();
  };
  if (r === 0 && im === 0) return '0';
  if (im === 0) return fmt(r);
  const imAbs = Math.abs(im);
  const imStr = Math.abs(imAbs - 1) < 1e-9 ? 'i' : `${fmt(imAbs)}i`;
  if (r === 0) return im < 0 ? `-${imStr}` : imStr;
  return `${fmt(r)}${im < 0 ? '-' : '+'}${imStr}`;
}

export function matToLatex(M, prec = 3) {
  const fmt = z => formatComplex(z, prec)
    .replace(/1\/\(2√3\)/g, '\\frac{1}{2\\sqrt{3}}')
    .replace(/√3\/2/g, '\\frac{\\sqrt{3}}{2}')
    .replace(/2\/√3/g, '\\frac{2}{\\sqrt{3}}')
    .replace(/1\/√3/g, '\\frac{1}{\\sqrt{3}}')
    .replace(/1\/√2/g, '\\frac{1}{\\sqrt{2}}')
    .replace(/(-?\d+)\/2/g, (_, a) => (a.startsWith('-') ? `-\\frac{${a.slice(1)}}{2}` : `\\frac{${a}}{2}`));
  const rows = M.map(row => row.map(fmt).join(' & ')).join(' \\\\ ');
  return `\\begin{pmatrix} ${rows} \\end{pmatrix}`;
}

// =====================================================================
// 3. SIMPLE LIE ALGEBRAS, CARTAN MATRICES, DYNKIN DIAGRAMS, ROOT SYSTEMS
// =====================================================================

const ALGEBRA_CACHE = new Map();

function buildCartanSpec(type, rank) {
  const T = String(type).toUpperCase();
  const r = Math.trunc(rank);
  const A = Array.from({ length: r }, (_, i) => Array.from({ length: r }, (_, j) => (i === j ? 2 : 0)));
  let d = Array(r).fill(R1); // d_i = |alpha_i|^2 / 2
  let nodes = [];
  let edges = [];
  let orthoSimpleRoots = [];
  let orthoLatex = [];
  let compactGroup = '';
  let compactLatex = '';
  let isomorphisms = [];
  let center = '{1}';

  const eVec = (dim, idx, val = 1) => {
    const v = Array(dim).fill(0);
    v[idx] = val;
    return v;
  };
  const addVec = (u, v) => u.map((x, i) => x + v[i]);
  const scaleVec = (u, s) => u.map(x => x * s);

  if (T === 'A') {
    if (r < 1 || r > 8) throw new Error('A_n için n = 1..8 olmalı');
    for (let i = 0; i < r - 1; i++) { A[i][i + 1] = -1; A[i + 1][i] = -1; }
    nodes = Array.from({ length: r }, (_, i) => ({ index: i, label: `α${i + 1}`, isLong: true, x: i, y: 0 }));
    edges = Array.from({ length: r - 1 }, (_, i) => ({ from: i, to: i + 1, mult: 1, dir: 0 }));
    for (let i = 0; i < r; i++) {
      orthoSimpleRoots.push(addVec(eVec(r + 1, i, 1), eVec(r + 1, i + 1, -1)));
      orthoLatex.push(`e_{${i + 1}} - e_{${i + 2}}`);
    }
    compactGroup = `SU(${r + 1})`;
    compactLatex = `\\mathfrak{su}(${r + 1})`;
    center = `Z_${r + 1}`;
    if (r === 1) isomorphisms = ['B_1', 'C_1', 'su(2) ≅ so(3) ≅ sp(2)'];
    if (r === 3) isomorphisms = ['D_3', 'su(4) ≅ so(6)'];
  } else if (T === 'B') {
    if (r < 2 || r > 8) throw new Error('B_n için n = 2..8 olmalı');
    for (let i = 0; i < r - 2; i++) { A[i][i + 1] = -1; A[i + 1][i] = -1; }
    // A_{r-2, r-1} = 2(alpha_{r-1}, alpha_r)/(alpha_r, alpha_r) = -2; A_{r-1, r-2} = -1
    A[r - 2][r - 1] = -2;
    A[r - 1][r - 2] = -1;
    d[r - 1] = rat(1, 2);
    nodes = Array.from({ length: r }, (_, i) => ({ index: i, label: `α${i + 1}`, isLong: i < r - 1, x: i, y: 0 }));
    for (let i = 0; i < r - 1; i++) {
      edges.push({ from: i, to: i + 1, mult: i === r - 2 ? 2 : 1, dir: i === r - 2 ? 1 : 0 });
    }
    for (let i = 0; i < r - 1; i++) {
      orthoSimpleRoots.push(addVec(eVec(r, i, 1), eVec(r, i + 1, -1)));
      orthoLatex.push(`e_{${i + 1}} - e_{${i + 2}}`);
    }
    orthoSimpleRoots.push(eVec(r, r - 1, 1));
    orthoLatex.push(`e_{${r}}`);
    compactGroup = `SO(${2 * r + 1})`;
    compactLatex = `\\mathfrak{so}(${2 * r + 1})`;
    center = 'Z_2';
    if (r === 2) isomorphisms = ['C_2', 'so(5) ≅ sp(4)'];
  } else if (T === 'C') {
    if (r < 2 || r > 8) throw new Error('C_n için n = 2..8 olmalı');
    for (let i = 0; i < r - 2; i++) { A[i][i + 1] = -1; A[i + 1][i] = -1; }
    // alpha_1..alpha_{r-1} short (d=1/2), alpha_r long (d=1)
    A[r - 2][r - 1] = -1;
    A[r - 1][r - 2] = -2;
    d = Array.from({ length: r }, (_, i) => (i < r - 1 ? rat(1, 2) : R1));
    nodes = Array.from({ length: r }, (_, i) => ({ index: i, label: `α${i + 1}`, isLong: i === r - 1, x: i, y: 0 }));
    for (let i = 0; i < r - 1; i++) {
      edges.push({ from: i, to: i + 1, mult: i === r - 2 ? 2 : 1, dir: i === r - 2 ? -1 : 0 });
    }
    const s = Math.SQRT1_2;
    for (let i = 0; i < r - 1; i++) {
      orthoSimpleRoots.push(scaleVec(addVec(eVec(r, i, 1), eVec(r, i + 1, -1)), s));
      orthoLatex.push(`\\tfrac{1}{\\sqrt{2}}(e_{${i + 1}} - e_{${i + 2}})`);
    }
    orthoSimpleRoots.push(eVec(r, r - 1, Math.SQRT2));
    orthoLatex.push(`\\sqrt{2}\\,e_{${r}}`);
    compactGroup = `Sp(${2 * r})`;
    compactLatex = `\\mathfrak{sp}(${2 * r})`;
    center = 'Z_2';
    if (r === 2) isomorphisms = ['B_2', 'sp(4) ≅ so(5)'];
  } else if (T === 'D') {
    if (r < 3 || r > 8) throw new Error('D_n için n = 3..8 olmalı');
    for (let i = 0; i < r - 2; i++) { A[i][i + 1] = -1; A[i + 1][i] = -1; }
    A[r - 3][r - 1] = -1;
    A[r - 1][r - 3] = -1;
    for (let i = 0; i < r - 2; i++) nodes.push({ index: i, label: `α${i + 1}`, isLong: true, x: i, y: 0 });
    nodes.push({ index: r - 2, label: `α${r - 1}`, isLong: true, x: r - 2, y: -0.75 });
    nodes.push({ index: r - 1, label: `α${r}`, isLong: true, x: r - 2, y: 0.75 });
    for (let i = 0; i < r - 3; i++) edges.push({ from: i, to: i + 1, mult: 1, dir: 0 });
    edges.push({ from: r - 3, to: r - 2, mult: 1, dir: 0 });
    edges.push({ from: r - 3, to: r - 1, mult: 1, dir: 0 });
    for (let i = 0; i < r - 1; i++) {
      orthoSimpleRoots.push(addVec(eVec(r, i, 1), eVec(r, i + 1, -1)));
      orthoLatex.push(`e_{${i + 1}} - e_{${i + 2}}`);
    }
    orthoSimpleRoots.push(addVec(eVec(r, r - 2, 1), eVec(r, r - 1, 1)));
    orthoLatex.push(`e_{${r - 1}} + e_{${r}}`);
    compactGroup = `SO(${2 * r})`;
    compactLatex = `\\mathfrak{so}(${2 * r})`;
    center = r % 2 === 0 ? 'Z_2 × Z_2' : 'Z_4';
    if (r === 3) isomorphisms = ['A_3', 'so(6) ≅ su(4)'];
  } else if (T === 'G' && r === 2) {
    // Ramond/Slansky convention: alpha_1 LONG (|alpha_1|^2 = 2), alpha_2 SHORT (|alpha_2|^2 = 2/3)
    // Fundamental 7 = (0,1), Adjoint 14 = (1,0)
    A[0][1] = -3;
    A[1][0] = -1;
    d = [R1, rat(1, 3)];
    nodes = [
      { index: 0, label: 'α1', isLong: true, x: 0, y: 0 },
      { index: 1, label: 'α2', isLong: false, x: 1, y: 0 },
    ];
    edges = [{ from: 0, to: 1, mult: 3, dir: 1 }];
    orthoSimpleRoots = [
      [Math.SQRT2, 0],
      [-Math.SQRT1_2, 1 / Math.sqrt(6)],
    ];
    orthoLatex = ['\\tfrac{1}{\\sqrt{3}}(e_1 + e_2 - 2e_3)', '\\tfrac{1}{\\sqrt{3}}(e_3 - e_2)'];
    compactGroup = 'G_2';
    compactLatex = '\\mathfrak{g}_2';
    center = '{1}';
  } else if (T === 'F' && r === 4) {
    // alpha_1, alpha_2 LONG; alpha_3, alpha_4 SHORT -> 26 = (0,0,0,1), 52 = (1,0,0,0)
    A[0][1] = -1; A[1][0] = -1;
    A[1][2] = -2; A[2][1] = -1;
    A[2][3] = -1; A[3][2] = -1;
    d = [R1, R1, rat(1, 2), rat(1, 2)];
    nodes = [
      { index: 0, label: 'α1', isLong: true, x: 0, y: 0 },
      { index: 1, label: 'α2', isLong: true, x: 1, y: 0 },
      { index: 2, label: 'α3', isLong: false, x: 2, y: 0 },
      { index: 3, label: 'α4', isLong: false, x: 3, y: 0 },
    ];
    edges = [
      { from: 0, to: 1, mult: 1, dir: 0 },
      { from: 1, to: 2, mult: 2, dir: 1 },
      { from: 2, to: 3, mult: 1, dir: 0 },
    ];
    orthoSimpleRoots = [
      [0, 1, -1, 0],
      [0, 0, 1, -1],
      [0, 0, 0, 1],
      [0.5, -0.5, -0.5, -0.5],
    ];
    orthoLatex = ['e_2 - e_3', 'e_3 - e_4', 'e_4', '\\tfrac{1}{2}(e_1 - e_2 - e_3 - e_4)'];
    compactGroup = 'F_4';
    compactLatex = '\\mathfrak{f}_4';
    center = '{1}';
  } else if (T === 'E' && (r === 6 || r === 7 || r === 8)) {
    // Ramond/Slansky spine: 1 - 2 - 3 - ... - (r-1), branch node r attached to node 3 (index 2).
    // E6: 27=(1,0,0,0,0,0), 78=(0,0,0,0,0,1)
    // E7: 56=(0,0,0,0,0,1,0), 133=(1,0,0,0,0,0,0)
    // E8: 248=(0,0,0,0,0,0,1,0)
    for (let i = 0; i < r - 2; i++) { A[i][i + 1] = -1; A[i + 1][i] = -1; }
    A[2][r - 1] = -1;
    A[r - 1][2] = -1;
    for (let i = 0; i < r - 1; i++) nodes.push({ index: i, label: `α${i + 1}`, isLong: true, x: i, y: 0 });
    nodes.push({ index: r - 1, label: `α${r}`, isLong: true, x: 2, y: 1 });
    for (let i = 0; i < r - 2; i++) edges.push({ from: i, to: i + 1, mult: 1, dir: 0 });
    edges.push({ from: 2, to: r - 1, mult: 1, dir: 0 });

    const e8Roots = [
      [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5],
      [-1, 1, 0, 0, 0, 0, 0, 0],
      [0, -1, 1, 0, 0, 0, 0, 0],
      [0, 0, -1, 1, 0, 0, 0, 0],
      [0, 0, 0, -1, 1, 0, 0, 0],
      [0, 0, 0, 0, -1, 1, 0, 0],
      [0, 0, 0, 0, 0, -1, 1, 0],
      [1, 1, 0, 0, 0, 0, 0, 0],
    ];
    const e8Latex = [
      '\\tfrac{1}{2}(e_1 - e_2 - e_3 - e_4 - e_5 - e_6 - e_7 + e_8)',
      'e_2 - e_1',
      'e_3 - e_2',
      'e_4 - e_3',
      'e_5 - e_4',
      'e_6 - e_5',
      'e_7 - e_6',
      'e_1 + e_2',
    ];
    for (let i = 0; i < r - 1; i++) {
      orthoSimpleRoots.push(e8Roots[i]);
      orthoLatex.push(e8Latex[i]);
    }
    orthoSimpleRoots.push(e8Roots[7]);
    orthoLatex.push(e8Latex[7]);

    compactGroup = `E_${r}`;
    compactLatex = `\\mathfrak{e}_{${r}}`;
    center = r === 6 ? 'Z_3' : r === 7 ? 'Z_2' : '{1}';
  } else {
    throw new Error(`Desteklenmeyen basit Lie cebiri: ${type}_${rank}`);
  }

  return {
    type: T,
    rank: r,
    cartan: A,
    d,
    dynkinNodes: nodes,
    dynkinEdges: edges,
    orthoSimpleRoots,
    orthoLatex,
    compactGroup,
    compactLatex,
    isomorphisms,
    center,
  };
}

// Root string algorithm: generates all positive roots purely from the Cartan matrix A.
function generatePositiveRoots(A, d, orthoSimpleRoots) {
  const r = A.length;
  const keyOf = coords => coords.join(',');
  const known = new Map();
  const levels = [[]];

  const makeOrtho = coords => {
    const dim = orthoSimpleRoots[0].length;
    const v = Array(dim).fill(0);
    for (let i = 0; i < r; i++) {
      if (!coords[i]) continue;
      for (let k = 0; k < dim; k++) v[k] += coords[i] * orthoSimpleRoots[i][k];
    }
    return v;
  };

  const computeNormSq = (coords, dynkin) => {
    // (beta, beta) = sum_i coords[i] * d_i * dynkin[i]  (since dynkin[i] = 2(beta, alpha_i)/|alpha_i|^2 = (beta, alpha_i)/d_i)
    let sum = R0;
    for (let i = 0; i < r; i++) {
      if (coords[i] && dynkin[i]) {
        sum = ratAdd(sum, ratMul(rat(coords[i] * dynkin[i]), d[i]));
      }
    }
    return sum;
  };

  // Level 1: simple roots
  for (let i = 0; i < r; i++) {
    const coords = Array(r).fill(0);
    coords[i] = 1;
    const dynkin = A[i].slice();
    const normSq = ratMul(d[i], rat(2));
    const root = {
      coords,
      dynkin,
      height: 1,
      normSq,
      isLong: ratEq(normSq, rat(2)),
      ortho: orthoSimpleRoots[i].slice(),
    };
    known.set(keyOf(coords), root);
    levels[0].push(root);
  }

  for (let lvl = 0; lvl < levels.length; lvl++) {
    const nextLevel = [];
    for (const beta of levels[lvl]) {
      for (let k = 0; k < r; k++) {
        // 2*alpha_k is never a root
        if (beta.height === 1 && beta.coords[k] === 1) continue;
        // Find p = max m >= 0 such that beta - m * alpha_k is a positive root
        let p = 0;
        const probe = beta.coords.slice();
        while (probe[k] > 0) {
          probe[k]--;
          if (known.has(keyOf(probe))) p++;
          else break;
        }
        // p - q = <beta, alpha_k^v> = beta.dynkin[k]
        const q = p - beta.dynkin[k];
        if (q > 0) {
          const nc = beta.coords.slice();
          nc[k]++;
          const nk = keyOf(nc);
          if (!known.has(nk)) {
            const nd = beta.dynkin.map((v, j) => v + A[k][j]);
            const normSq = computeNormSq(nc, nd);
            const root = {
              coords: nc,
              dynkin: nd,
              height: beta.height + 1,
              normSq,
              isLong: ratEq(normSq, rat(2)),
              ortho: makeOrtho(nc),
            };
            known.set(nk, root);
            nextLevel.push(root);
          }
        }
      }
    }
    if (nextLevel.length) levels.push(nextLevel);
  }

  return levels.flat();
}

export function getAlgebra(type, rank) {
  const T = String(type).toUpperCase();
  const r = Math.trunc(rank);
  const id = `${T}${r}`;
  if (ALGEBRA_CACHE.has(id)) return ALGEBRA_CACHE.get(id);

  const spec = buildCartanSpec(T, r);
  const { cartan: A, d, orthoSimpleRoots } = spec;
  const symCartan = A.map(row => row.map((v, j) => ratMul(rat(v), d[j])));
  const cartanInv = invertRatMatrix(A);
  const cartanDet = Number(detRatMatrix(A).n);
  // Quadratic form matrix G_{ij} = (omega_i, omega_j) = (A^{-1})_{ij} * d_j
  const metricG = cartanInv.map(row => row.map((v, j) => ratMul(v, d[j])));

  // Common integer denominator for fast exact Freudenthal inner products
  let metricDenom = 1n;
  for (const row of metricG) for (const v of row) metricDenom = bigLcm(metricDenom, v.d);
  const metricInt = metricG.map(row => row.map(v => Number((v.n * metricDenom) / v.d)));
  const dIntDenom = 6; // lcm(1, 2, 3) = 6
  const dInt = d.map(v => Number((v.n * 6n) / v.d));

  const positiveRoots = generatePositiveRoots(A, d, orthoSimpleRoots);
  const allRoots = [
    ...positiveRoots.map(rt => ({ ...rt, positive: true })),
    ...positiveRoots.map(rt => ({
      coords: rt.coords.map(x => -x),
      dynkin: rt.dynkin.map(x => -x),
      height: -rt.height,
      normSq: rt.normSq,
      isLong: rt.isLong,
      ortho: rt.ortho.map(x => -x),
      positive: false,
    })),
  ];

  const highestRoot = positiveRoots[positiveRoots.length - 1];
  const marks = highestRoot.coords.slice();
  const comarks = marks.map((a, i) => Number(ratMul(rat(a), d[i]).n));
  const coxeterNumber = 1 + marks.reduce((s, x) => s + x, 0);
  const dualCoxeterNumber = 1 + comarks.reduce((s, x) => s + x, 0);

  // Kostant height-partition theorem -> exact exponents m_1 <= ... <= m_r
  const heightCounts = [];
  for (const rt of positiveRoots) {
    heightCounts[rt.height - 1] = (heightCounts[rt.height - 1] || 0) + 1;
  }
  const exponents = [];
  for (let col = 1; col <= r; col++) {
    let len = 0;
    for (const cnt of heightCounts) if (cnt >= col) len++;
    exponents.push(len);
  }
  exponents.sort((a, b) => a - b);
  const casimirDegrees = exponents.map(m => m + 1);
  let weylOrder = 1n;
  for (const deg of casimirDegrees) weylOrder *= BigInt(deg);

  const dynkinNodes = spec.dynkinNodes.map((nd, i) => ({
    ...nd,
    mark: marks[i],
    comark: comarks[i],
  }));

  // Fundamental weights in orthonormal coordinates: omega_i = sum_k (A^{-1})_{ik} alpha_k
  const orthoDim = orthoSimpleRoots[0].length;
  const orthoFundWeights = Array.from({ length: r }, (_, i) => {
    const v = Array(orthoDim).fill(0);
    for (let k = 0; k < r; k++) {
      const coeff = ratToNumber(cartanInv[i][k]);
      for (let j = 0; j < orthoDim; j++) v[j] += coeff * orthoSimpleRoots[k][j];
    }
    return v;
  });

  // 2D orthonormal coordinates for rank-2 visualization (exact inner product preserving)
  let basis2D = null;
  if (r === 2) {
    if (T === 'A') {
      // alpha_1 = (sqrt(2), 0), alpha_2 = (-1/sqrt(2), sqrt(3/2)) -> standard hexagonal (I3, Y') orientation
      basis2D = {
        roots: [[Math.SQRT2, 0], [-Math.SQRT1_2, Math.sqrt(1.5)]],
        weights: [[Math.SQRT1_2, 1 / Math.sqrt(6)], [0, Math.sqrt(2 / 3)]],
      };
    } else if (T === 'B') {
      // alpha_1 = (1, -1), alpha_2 = (0, 1)
      basis2D = {
        roots: [[1, -1], [0, 1]],
        weights: [[1, 0], [0.5, 0.5]],
      };
    } else if (T === 'C') {
      // alpha_1 = (1/sqrt2, -1/sqrt2), alpha_2 = (0, sqrt2)
      basis2D = {
        roots: [[Math.SQRT1_2, -Math.SQRT1_2], [0, Math.SQRT2]],
        weights: [[Math.SQRT1_2, 0], [Math.SQRT1_2, Math.SQRT1_2]],
      };
    } else if (T === 'G') {
      // alpha_1 = (sqrt(2), 0) long, alpha_2 = (-1/sqrt(2), 1/sqrt(6)) short (angle 150 deg)
      basis2D = {
        roots: [[Math.SQRT2, 0], [-Math.SQRT1_2, 1 / Math.sqrt(6)]],
        weights: [[Math.SQRT1_2, Math.sqrt(1.5)], [0, Math.sqrt(2 / 3)]],
      };
    }
  }

  const alg = {
    id,
    type: T,
    rank: r,
    name: `${T}_${r}`,
    latex: `${T}_{${r}}`,
    compactGroup: spec.compactGroup,
    compactLatex: spec.compactLatex,
    isomorphisms: spec.isomorphisms,
    center: spec.center,
    simplyLaced: T === 'A' || T === 'D' || T === 'E',
    cartan: A,
    cartanDet,
    d,
    dInt,
    dIntDenom,
    rootLengthsSq: d.map(v => ratMul(v, rat(2))),
    symCartan,
    cartanInv,
    metricG,
    metricInt,
    metricDenom: Number(metricDenom),
    dynkinNodes,
    dynkinEdges: spec.dynkinEdges,
    orthoSimpleRoots,
    orthoLatex: spec.orthoLatex,
    orthoFundWeights,
    basis2D,
    positiveRoots,
    allRoots,
    heightCounts,
    numPositiveRoots: positiveRoots.length,
    dimension: r + 2 * positiveRoots.length,
    highestRoot,
    marks,
    comarks,
    coxeterNumber,
    dualCoxeterNumber,
    exponents,
    casimirDegrees,
    weylOrder,
    weylOrderNum: Number(weylOrder),
  };

  ALGEBRA_CACHE.set(id, alg);
  return alg;
}

export function parseAlgebra(spec) {
  if (spec && typeof spec === 'object' && spec.cartan) return spec;
  const s = String(spec ?? '').trim().replace(/\s+/g, '');
  const m = /^([ABCDEGF])_?(\d+)$/i.exec(s);
  if (m) return getAlgebra(m[1].toUpperCase(), +m[2]);
  const low = s.toLowerCase();
  let pm;
  if ((pm = /^su\(?(\d+)\)?$/.exec(low))) return getAlgebra('A', +pm[1] - 1);
  if ((pm = /^so\(?(\d+)\)?$/.exec(low))) {
    const n = +pm[1];
    if (n === 3) return getAlgebra('A', 1);
    return n % 2 === 1 ? getAlgebra('B', (n - 1) / 2) : getAlgebra('D', n / 2);
  }
  if ((pm = /^sp\(?(\d+)\)?$/.exec(low))) return getAlgebra('C', +pm[1] / 2);
  throw new Error(`Tanınmayan Lie cebiri: ${spec}`);
}

export function listAlgebras() {
  const out = [];
  for (let n = 1; n <= 8; n++) out.push(getAlgebra('A', n));
  for (let n = 2; n <= 8; n++) out.push(getAlgebra('B', n));
  for (let n = 2; n <= 8; n++) out.push(getAlgebra('C', n));
  for (let n = 3; n <= 8; n++) out.push(getAlgebra('D', n));
  out.push(getAlgebra('G', 2), getAlgebra('F', 4), getAlgebra('E', 6), getAlgebra('E', 7), getAlgebra('E', 8));
  return out;
}

// =====================================================================
// 4. INNER PRODUCTS, BASIS CONVERSIONS, REFLECTIONS & ROOT STRINGS
// =====================================================================

export function weightInnerProduct(alg, w1, w2) {
  const r = alg.rank;
  let num = 0n;
  const M = alg.metricInt;
  for (let i = 0; i < r; i++) {
    if (!w1[i]) continue;
    for (let j = 0; j < r; j++) {
      if (!w2[j] || !M[i][j]) continue;
      num += BigInt(w1[i]) * BigInt(M[i][j]) * BigInt(w2[j]);
    }
  }
  return rat(num, BigInt(alg.metricDenom));
}

export function rootInnerProduct(alg, c1, c2) {
  const r = alg.rank;
  let sum = R0;
  for (let i = 0; i < r; i++) {
    if (!c1[i]) continue;
    for (let j = 0; j < r; j++) {
      if (!c2[j] || alg.symCartan[i][j].n === 0n) continue;
      sum = ratAdd(sum, ratMul(rat(c1[i] * c2[j]), alg.symCartan[i][j]));
    }
  }
  return sum;
}

export function weightRootInnerProduct(alg, w, cCoords) {
  // (w, beta) = sum_i w_i * c_i * d_i
  let num = 0n;
  for (let i = 0; i < alg.rank; i++) {
    if (w[i] && cCoords[i]) num += BigInt(w[i]) * BigInt(cCoords[i]) * BigInt(alg.dInt[i]);
  }
  return rat(num, BigInt(alg.dIntDenom));
}

export function rootCoordsToDynkin(alg, coords) {
  const r = alg.rank;
  const out = Array(r).fill(0);
  for (let i = 0; i < r; i++) {
    if (!coords[i]) continue;
    for (let j = 0; j < r; j++) out[j] += coords[i] * alg.cartan[i][j];
  }
  return out;
}

export function dynkinToRootCoords(alg, w) {
  const r = alg.rank;
  const out = Array(r).fill(R0);
  for (let j = 0; j < r; j++) {
    let s = R0;
    for (let i = 0; i < r; i++) {
      if (w[i]) s = ratAdd(s, ratMul(rat(w[i]), alg.cartanInv[i][j]));
    }
    out[j] = s;
  }
  return out;
}

export function dynkinToOrtho(alg, w) {
  const dim = alg.orthoFundWeights[0].length;
  const v = Array(dim).fill(0);
  for (let i = 0; i < alg.rank; i++) {
    if (!w[i]) continue;
    for (let k = 0; k < dim; k++) v[k] += w[i] * alg.orthoFundWeights[i][k];
  }
  return v;
}

export function dynkinTo2D(alg, w) {
  if (!alg.basis2D) return dynkinToOrtho(alg, w).slice(0, 2);
  const [w1, w2] = alg.basis2D.weights;
  return [w[0] * w1[0] + w[1] * w2[0], w[0] * w1[1] + w[1] * w2[1]];
}

export function rootTo2D(alg, coords) {
  if (!alg.basis2D) return [0, 0];
  const [r1, r2] = alg.basis2D.roots;
  return [coords[0] * r1[0] + coords[1] * r2[0], coords[0] * r1[1] + coords[1] * r2[1]];
}

// Simple Weyl reflection s_i on Dynkin labels: s_i(w) = w - w_i * row_i(A)
export function reflectWeight(alg, w, i) {
  const wi = w[i];
  if (wi === 0) return w.slice();
  const row = alg.cartan[i];
  const out = w.slice();
  for (let j = 0; j < alg.rank; j++) out[j] -= wi * row[j];
  return out;
}

// Map any integral weight to the unique dominant representative in its Weyl orbit
export function toDominantWeight(alg, w) {
  const cur = w.slice();
  const word = [];
  const r = alg.rank;
  let flips = 0;
  let guard = 0;
  while (guard++ < 500) {
    let negIdx = -1;
    for (let i = 0; i < r; i++) {
      if (cur[i] < 0) { negIdx = i; break; }
    }
    if (negIdx === -1) break;
    const wi = cur[negIdx];
    const row = alg.cartan[negIdx];
    for (let j = 0; j < r; j++) cur[j] -= wi * row[j];
    word.push(negIdx);
    flips++;
  }
  const onWall = cur.some(x => x === 0);
  return { dominant: cur, flips, sign: flips % 2 === 0 ? 1 : -1, word, onWall };
}

export function rootString(alg, betaCoords, alphaIdx) {
  const keyOf = arr => arr.join(',');
  const rootSet = new Set(alg.allRoots.map(rt => keyOf(rt.coords)));
  const r = alg.rank;
  const step = (base, k) => {
    const out = base.slice();
    out[alphaIdx] += k;
    return out;
  };
  let p = 0;
  while (rootSet.has(keyOf(step(betaCoords, -(p + 1)))) || step(betaCoords, -(p + 1)).every(x => x === 0)) {
    p++;
    if (p > 4) break;
  }
  let q = 0;
  while (rootSet.has(keyOf(step(betaCoords, q + 1))) || step(betaCoords, q + 1).every(x => x === 0)) {
    q++;
    if (q > 4) break;
  }
  const string = [];
  for (let k = -p; k <= q; k++) {
    const coords = step(betaCoords, k);
    string.push({ k, coords, isZero: coords.every(x => x === 0) });
  }
  const dynkin = rootCoordsToDynkin(alg, betaCoords);
  return { p, q, cartanVal: dynkin[alphaIdx], string };
}

// =====================================================================
// 5. REPRESENTATIONS: WEYL DIMENSION, FREUDENTHAL, CASIMIR, INDEX, REALITY
// =====================================================================

export function weylDimensionSteps(alg, hw) {
  const r = alg.rank;
  if (hw.length !== r || hw.some(x => !Number.isInteger(x) || x < 0)) {
    throw new Error(`Baskın ağırlık ${r} negatif olmayan tam sayı içermeli`);
  }
  let numProd = 1n;
  let denProd = 1n;
  const factors = [];
  const dInt = alg.dInt;
  for (const rt of alg.positiveRoots) {
    let nVal = 0n;
    let dVal = 0n;
    for (let i = 0; i < r; i++) {
      if (!rt.coords[i]) continue;
      const cd = BigInt(rt.coords[i] * dInt[i]);
      nVal += BigInt(hw[i] + 1) * cd;
      dVal += cd;
    }
    const g = bigGcd(nVal, dVal);
    const rn = nVal / g;
    const rd = dVal / g;
    numProd *= rn;
    denProd *= rd;
    const g2 = bigGcd(numProd, denProd);
    numProd /= g2;
    denProd /= g2;
    factors.push({ root: rt.coords, num: rn, den: rd });
  }
  return { dim: numProd / denProd, factors };
}

export function weylDimension(alg, hw) {
  return weylDimensionSteps(alg, hw).dim;
}

export function casimirC2(alg, hw) {
  // C_2(Lambda) = 1/2 * (Lambda, Lambda + 2*rho)
  const lp2r = hw.map(x => x + 2);
  return ratMul(rat(1, 2), weightInnerProduct(alg, hw, lp2r));
}

export function dynkinIndex(alg, hw) {
  // T(Lambda) = (dim(Lambda) / dim(g)) * C_2(Lambda)
  const dim = weylDimension(alg, hw);
  const c2 = casimirC2(alg, hw);
  return ratMul(rat(dim, BigInt(alg.dimension)), c2);
}

export function conjugateWeight(alg, hw) {
  const r = alg.rank;
  const out = hw.slice();
  if (alg.type === 'A') return out.reverse();
  if (alg.type === 'D' && r % 2 === 1) {
    [out[r - 2], out[r - 1]] = [out[r - 1], out[r - 2]];
    return out;
  }
  if (alg.type === 'E' && r === 6) {
    // Spine 0-1-2-3-4, branch 5 on 2 -> swap 0<->4 and 1<->3
    [out[0], out[4]] = [out[4], out[0]];
    [out[1], out[3]] = [out[3], out[1]];
    return out;
  }
  return out;
}

export function congruenceClass(alg, hw) {
  const r = alg.rank;
  const mod = (a, m) => ((a % m) + m) % m;
  if (alg.type === 'A') {
    const N = r + 1;
    let s = 0;
    for (let i = 0; i < r; i++) s += (i + 1) * hw[i];
    const v = mod(s, N);
    return { group: `Z_${N}`, value: v, label: `${v} (mod ${N})` };
  }
  if (alg.type === 'B') {
    const v = mod(hw[r - 1], 2);
    return { group: 'Z_2', value: v, label: `${v} (mod 2)` };
  }
  if (alg.type === 'C') {
    let s = 0;
    for (let i = 0; i < r; i += 2) s += hw[i];
    const v = mod(s, 2);
    return { group: 'Z_2', value: v, label: `${v} (mod 2)` };
  }
  if (alg.type === 'D') {
    if (r % 2 === 1) {
      let s = 0;
      for (let i = 0; i < r - 2; i += 2) s += 2 * hw[i];
      s += (r - 2) * hw[r - 2] + r * hw[r - 1];
      const v = mod(s, 4);
      return { group: 'Z_4', value: v, label: `${v} (mod 4)` };
    }
    const c1 = mod(hw[r - 2] + hw[r - 1], 2);
    let s2 = hw[r - 2];
    for (let i = 0; i < r - 2; i += 2) s2 += hw[i];
    const c2 = mod(s2, 2);
    return { group: 'Z_2 × Z_2', value: [c1, c2], label: `(${c1}, ${c2})` };
  }
  if (alg.type === 'E' && r === 6) {
    const v = mod(hw[0] - hw[1] + hw[3] - hw[4], 3);
    return { group: 'Z_3', value: v, label: `${v} (mod 3)` };
  }
  if (alg.type === 'E' && r === 7) {
    const v = mod(hw[3] + hw[5] + hw[6], 2);
    return { group: 'Z_2', value: v, label: `${v} (mod 2)` };
  }
  return { group: '{1}', value: 0, label: '0 (aşikar)' };
}

export function repReality(alg, hw) {
  const conj = conjugateWeight(alg, hw);
  const selfConj = conj.every((v, i) => v === hw[i]);
  if (!selfConj) return { kind: 'complex', label: 'Kompleks', symbol: 'ℂ' };
  const r = alg.rank;
  let pseudo = false;
  if (alg.type === 'A') {
    if (r % 4 === 1) pseudo = (hw[(r - 1) / 2] & 1) === 1;
  } else if (alg.type === 'B') {
    if (r % 4 === 1 || r % 4 === 2) pseudo = (hw[r - 1] & 1) === 1;
  } else if (alg.type === 'C') {
    let s = 0;
    for (let i = 0; i < r; i += 2) s += hw[i];
    pseudo = (s & 1) === 1;
  } else if (alg.type === 'D') {
    if (r % 4 === 2) pseudo = ((hw[r - 2] + hw[r - 1]) & 1) === 1;
  } else if (alg.type === 'E' && r === 7) {
    pseudo = ((hw[3] + hw[5] + hw[6]) & 1) === 1;
  }
  return pseudo
    ? { kind: 'pseudoreal', label: 'Sözde-gerçel (Simplektik)', symbol: 'ℍ' }
    : { kind: 'real', label: 'Gerçel (Ortogonal)', symbol: 'ℝ' };
}

const WEIGHT_SYS_CACHE = new Map();

// Full weight system with exact Freudenthal multiplicities.
export function weightSystem(alg, hw, { maxWeights = 2500 } = {}) {
  const r = alg.rank;
  const cacheKey = `${alg.id}:${hw.join(',')}:${maxWeights}`;
  if (WEIGHT_SYS_CACHE.has(cacheKey)) return WEIGHT_SYS_CACHE.get(cacheKey);

  const dim = weylDimension(alg, hw);
  const keyOf = w => w.join(',');
  const A = alg.cartan;

  // Step 1: Layer-by-layer exact weight set generation via sl_2 string rule (q = p + mu_i)
  const byKey = new Map();
  const levels = [];
  const topKey = keyOf(hw);
  const topEntry = {
    dynkin: hw.slice(),
    depth: 0,
    mult: 1,
    isHighest: true,
    isDominant: true,
    dominantKey: topKey,
  };
  byKey.set(topKey, topEntry);
  levels.push([topEntry]);

  let truncated = false;
  for (let depth = 0; depth < levels.length; depth++) {
    const nextLvl = [];
    for (const entry of levels[depth]) {
      const mu = entry.dynkin;
      for (let i = 0; i < r; i++) {
        // Compute p = max k >= 0 with mu + k * alpha_i already in byKey
        let p = 0;
        const probe = mu.slice();
        while (true) {
          for (let j = 0; j < r; j++) probe[j] += A[i][j];
          if (byKey.has(keyOf(probe))) p++;
          else break;
        }
        const q = p + mu[i];
        if (q > 0) {
          const nw = mu.slice();
          for (let j = 0; j < r; j++) nw[j] -= A[i][j];
          const nk = keyOf(nw);
          if (!byKey.has(nk)) {
            if (byKey.size >= maxWeights) {
              truncated = true;
              break;
            }
            const dom = toDominantWeight(alg, nw).dominant;
            const item = {
              dynkin: nw,
              depth: depth + 1,
              mult: 0,
              isHighest: false,
              isDominant: nw.every(x => x >= 0),
              dominantKey: keyOf(dom),
            };
            byKey.set(nk, item);
            nextLvl.push(item);
          }
        }
      }
      if (truncated) break;
    }
    if (truncated) break;
    if (nextLvl.length) levels.push(nextLvl);
  }

  // Step 2: Exact Freudenthal multiplicity formula (scaled by metricDenom to stay pure BigInt!)
  // [ (Lambda+rho, Lambda+rho) - (mu+rho, mu+rho) ] * m(mu) = 2 * sum_{alpha > 0} sum_{k >= 1} (mu + k*alpha, alpha) m(mu + k*alpha)
  const M = alg.metricInt;
  const D = BigInt(alg.metricDenom);
  const normSqScaled = v => {
    let s = 0n;
    for (let i = 0; i < r; i++) {
      if (!v[i]) continue;
      for (let j = 0; j < r; j++) {
        if (!v[j] || !M[i][j]) continue;
        s += BigInt(v[i]) * BigInt(M[i][j]) * BigInt(v[j]);
      }
    }
    return s; // equals D * (v, v)
  };
  const lPlusRho = hw.map(x => x + 1);
  const topNormSq = normSqScaled(lPlusRho);

  // Precompute D * (w, alpha) for positive roots using (w, alpha) = sum_i w_i * coords_i * d_i
  // So D * (w, alpha) = (D * sum_i w_i * coords_i * dInt_i) / 6
  const posRoots = alg.positiveRoots;
  const dInt = alg.dInt;
  const domMults = new Map([[topKey, 1]]);

  if (!truncated) {
    for (let depth = 1; depth < levels.length; depth++) {
      for (const entry of levels[depth]) {
        if (domMults.has(entry.dominantKey)) {
          entry.mult = domMults.get(entry.dominantKey);
          continue;
        }
        const mu = entry.dynkin;
        const muPlusRho = mu.map(x => x + 1);
        const denom = topNormSq - normSqScaled(muPlusRho);
        let numer6 = 0n; // 6 * D * (2 * sum ...)
        for (const rt of posRoots) {
          const cur = mu.slice();
          while (true) {
            for (let j = 0; j < r; j++) cur[j] += rt.dynkin[j];
            const hit = byKey.get(keyOf(cur));
            if (!hit) break;
            // (cur, rt) * 6 = sum_i cur[i] * rt.coords[i] * dInt[i]
            let ip6 = 0n;
            for (let i = 0; i < r; i++) {
              if (cur[i] && rt.coords[i]) ip6 += BigInt(cur[i] * rt.coords[i] * dInt[i]);
            }
            numer6 += 2n * D * ip6 * BigInt(hit.mult);
          }
        }
        const multBig = numer6 / (6n * denom);
        const mult = Number(multBig);
        entry.mult = mult;
        domMults.set(entry.dominantKey, mult);
      }
    }
  }

  let totalMult = 0;
  const weights = [];
  const dominantWeights = [];
  for (const entry of byKey.values()) {
    totalMult += entry.mult;
    const item = {
      dynkin: entry.dynkin,
      mult: entry.mult,
      depth: entry.depth,
      isHighest: entry.isHighest,
      isDominant: entry.isDominant,
      ortho: dynkinToOrtho(alg, entry.dynkin),
      pos2D: alg.rank === 2 ? dynkinTo2D(alg, entry.dynkin) : null,
    };
    weights.push(item);
    if (item.isDominant) dominantWeights.push(item);
  }

  const res = {
    algId: alg.id,
    hw: hw.slice(),
    dim,
    totalMult,
    distinctWeights: weights.length,
    truncated,
    weights,
    dominantWeights,
    byKey,
  };
  if (WEIGHT_SYS_CACHE.size > 160) WEIGHT_SYS_CACHE.delete(WEIGHT_SYS_CACHE.keys().next().value);
  WEIGHT_SYS_CACHE.set(cacheKey, res);
  return res;
}

export function fundamentalReps(alg) {
  return Array.from({ length: alg.rank }, (_, i) => {
    const hw = Array(alg.rank).fill(0);
    hw[i] = 1;
    return {
      index: i + 1,
      hw,
      dim: weylDimension(alg, hw),
      casimir: casimirC2(alg, hw),
      indexT: dynkinIndex(alg, hw),
      reality: repReality(alg, hw),
      conjugate: conjugateWeight(alg, hw),
      congruence: congruenceClass(alg, hw),
    };
  });
}

export function repInfo(alg, hw) {
  const dim = weylDimension(alg, hw);
  return {
    algId: alg.id,
    hw: hw.slice(),
    dim,
    casimir: casimirC2(alg, hw),
    indexT: dynkinIndex(alg, hw),
    conjugate: conjugateWeight(alg, hw),
    reality: repReality(alg, hw),
    congruence: congruenceClass(alg, hw),
  };
}

// =====================================================================
// 6. WEYL GROUP (ORBITS, ELEMENTS, REDUCED WORDS, LENGTH, POINCARE POLY)
// =====================================================================

export function applyWeylWord(alg, w, word) {
  let cur = w.slice();
  for (let k = word.length - 1; k >= 0; k--) {
    cur = reflectWeight(alg, cur, word[k]);
  }
  return cur;
}

export function weylOrbit(alg, w, { maxSize = 2000 } = {}) {
  const r = alg.rank;
  const keyOf = v => v.join(',');
  const start = w.slice();
  const seen = new Map();
  const list = [{ dynkin: start, word: [], length: 0, ortho: dynkinToOrtho(alg, start), pos2D: r === 2 ? dynkinTo2D(alg, start) : null }];
  seen.set(keyOf(start), 0);
  const edges = [];
  let truncated = false;

  for (let head = 0; head < list.length; head++) {
    const cur = list[head];
    for (let i = 0; i < r; i++) {
      const next = reflectWeight(alg, cur.dynkin, i);
      const nk = keyOf(next);
      if (nk === keyOf(cur.dynkin)) continue;
      let idx = seen.get(nk);
      if (idx === undefined) {
        if (list.length >= maxSize) { truncated = true; continue; }
        idx = list.length;
        seen.set(nk, idx);
        list.push({
          dynkin: next,
          word: [i, ...cur.word],
          length: cur.length + 1,
          ortho: dynkinToOrtho(alg, next),
          pos2D: r === 2 ? dynkinTo2D(alg, next) : null,
        });
      }
      if (head < idx) edges.push({ from: head, to: idx, gen: i });
    }
  }
  return { weights: list, edges, size: list.length, truncated };
}

export function weylGroupElements(alg, { maxSize = 200 } = {}) {
  const r = alg.rank;
  const rho = Array(r).fill(1);
  const keyOf = v => v.join(',');
  const seen = new Map();
  const elements = [{ wRho: rho, word: [], length: 0, sign: 1 }];
  seen.set(keyOf(rho), 0);
  let truncated = false;

  for (let head = 0; head < elements.length; head++) {
    const cur = elements[head];
    for (let i = 0; i < r; i++) {
      const nxt = reflectWeight(alg, cur.wRho, i);
      const nk = keyOf(nxt);
      if (!seen.has(nk)) {
        if (elements.length >= maxSize) { truncated = true; break; }
        seen.set(nk, elements.length);
        const len = cur.length + 1;
        elements.push({ wRho: nxt, word: [i, ...cur.word], length: len, sign: len % 2 === 0 ? 1 : -1 });
      }
    }
    if (truncated) break;
  }

  const poincarePoly = [];
  for (const el of elements) poincarePoly[el.length] = (poincarePoly[el.length] || 0) + 1;

  return { elements, count: elements.length, expectedOrder: alg.weylOrder, poincarePoly, truncated };
}

// =====================================================================
// 7. TENSOR PRODUCTS (BRAUER-KLIMYK + SYM^2 / ALT^2 ADAMS DECOMPOSITION)
// =====================================================================

export function tensorProduct(alg, hw1, hw2, { maxWeights = 2500 } = {}) {
  const d1 = weylDimension(alg, hw1);
  const d2 = weylDimension(alg, hw2);
  // Use the smaller representation's weight system for Brauer-Klimyk speed
  const [smallHw, bigHw] = d1 <= d2 ? [hw1, hw2] : [hw2, hw1];
  const ws = weightSystem(alg, smallHw, { maxWeights });
  if (ws.truncated) {
    return { truncated: true, dim1: d1, dim2: d2, terms: [] };
  }

  const r = alg.rank;
  const bigPlusRho = bigHw.map(x => x + 1);
  const multMap = new Map();
  const hwByKey = new Map();

  for (const w of ws.weights) {
    const shifted = Array(r);
    for (let i = 0; i < r; i++) shifted[i] = w.dynkin[i] + bigPlusRho[i];
    const dom = toDominantWeight(alg, shifted);
    if (dom.onWall) continue;
    const target = dom.dominant.map(x => x - 1);
    const key = target.join(',');
    multMap.set(key, (multMap.get(key) || 0) + dom.sign * w.mult);
    hwByKey.set(key, target);
  }

  const terms = [];
  let sumDim = 0n;
  let sumIndex = R0;
  for (const [key, mult] of multMap.entries()) {
    if (mult <= 0) continue;
    const hw = hwByKey.get(key);
    const dim = weylDimension(alg, hw);
    const casimir = casimirC2(alg, hw);
    const indexT = dynkinIndex(alg, hw);
    sumDim += BigInt(mult) * dim;
    sumIndex = ratAdd(sumIndex, ratMul(rat(mult), indexT));
    terms.push({
      hw,
      mult,
      dim,
      casimir,
      indexT,
      reality: repReality(alg, hw),
      conjugate: conjugateWeight(alg, hw),
    });
  }
  terms.sort((a, b) => (b.dim > a.dim ? 1 : b.dim < a.dim ? -1 : a.hw.join(',').localeCompare(b.hw.join(','))));

  // Index sum rule: sum m_k T(R_k) = dim(R2) T(R1) + dim(R1) T(R2)
  const expectedIndex = ratAdd(
    ratMul(rat(d2), dynkinIndex(alg, hw1)),
    ratMul(rat(d1), dynkinIndex(alg, hw2)),
  );

  return {
    truncated: false,
    dim1: d1,
    dim2: d2,
    totalDim: d1 * d2,
    sumDim,
    dimCheck: sumDim === d1 * d2,
    expectedIndex,
    sumIndex,
    indexCheck: ratEq(sumIndex, expectedIndex),
    terms,
  };
}

// Decompose R x R = Sym^2(R) + Alt^2(R) using Adams operation psi^2(ch R)
export function symmetricAntisymmetricSquare(alg, hw, { maxWeights = 1500 } = {}) {
  const full = tensorProduct(alg, hw, hw, { maxWeights });
  if (full.truncated) return { truncated: true, sym: [], alt: [], full };

  const ws = weightSystem(alg, hw, { maxWeights });
  const r = alg.rank;
  const psi2 = new Map();
  for (const w of ws.weights) {
    const shifted = Array(r);
    for (let i = 0; i < r; i++) shifted[i] = 2 * w.dynkin[i] + 1;
    const dom = toDominantWeight(alg, shifted);
    if (dom.onWall) continue;
    const target = dom.dominant.map(x => x - 1);
    const key = target.join(',');
    psi2.set(key, (psi2.get(key) || 0) + dom.sign * w.mult);
  }

  const sym = [];
  const alt = [];
  for (const t of full.terms) {
    const key = t.hw.join(',');
    const p2 = psi2.get(key) || 0;
    const mSym = (t.mult + p2) / 2;
    const mAlt = (t.mult - p2) / 2;
    if (mSym > 0) sym.push({ ...t, mult: mSym });
    if (mAlt > 0) alt.push({ ...t, mult: mAlt });
  }
  const d = full.dim1;
  const symDim = sym.reduce((s, t) => s + BigInt(t.mult) * t.dim, 0n);
  const altDim = alt.reduce((s, t) => s + BigInt(t.mult) * t.dim, 0n);
  return {
    truncated: false,
    sym,
    alt,
    symDim,
    altDim,
    expectedSymDim: (d * (d + 1n)) / 2n,
    expectedAltDim: (d * (d - 1n)) / 2n,
    full,
  };
}

// =====================================================================
// 8. YOUNG TABLEAUX FOR SU(N) (HOOK-CONTENT FORMULA & DYNKIN CONVERSION)
// =====================================================================

export function dynkinToPartition(dynkin) {
  const r = dynkin.length;
  const part = Array(r).fill(0);
  let acc = 0;
  for (let i = r - 1; i >= 0; i--) {
    acc += dynkin[i];
    part[i] = acc;
  }
  return part;
}

export function partitionToDynkin(partition, N) {
  const r = N - 1;
  const pad = Array.from({ length: N }, (_, i) => partition[i] || 0);
  for (let i = 0; i < N - 1; i++) {
    if (pad[i] < pad[i + 1]) throw new Error('Young diyagramı satır uzunlukları azalan sırada olmalı');
  }
  const base = pad[N - 1];
  const reduced = pad.map(x => x - base);
  const dynkin = Array(r);
  for (let i = 0; i < r; i++) dynkin[i] = reduced[i] - reduced[i + 1];
  return dynkin;
}

export function youngConjugate(partition, N) {
  const dyn = partitionToDynkin(partition, N);
  return dynkinToPartition(dyn.slice().reverse());
}

export function youngHooksAndContents(partition, N) {
  const rows = partition.filter(x => x > 0);
  if (rows.length > N) throw new Error(`SU(${N}) için satır sayısı ${N}'i aşamaz`);
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i] < rows[i + 1]) throw new Error('Satır uzunlukları artmayan sırada olmalı');
  }
  const boxes = [];
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows[i]; j++) {
      // Arm length = rows[i] - 1 - j; Leg length = count of rows r > i with rows[r] > j
      const arm = rows[i] - 1 - j;
      let leg = 0;
      for (let rr = i + 1; rr < rows.length; rr++) if (rows[rr] > j) leg++;
      const hook = arm + leg + 1;
      const content = N + j - i;
      boxes.push({ row: i, col: j, hook, content });
      num *= BigInt(content);
      den *= BigInt(hook);
    }
  }
  const g = bigGcd(num, den);
  const dim = num / den;
  const dynkin = partitionToDynkin(partition, N);
  const totalBoxes = rows.reduce((s, x) => s + x, 0);
  return {
    N,
    partition: rows,
    dynkin,
    totalBoxes,
    nAlity: totalBoxes % N,
    boxes,
    numerator: num,
    denominator: den,
    reducedNum: num / g,
    reducedDen: den / g,
    dim,
  };
}

// =====================================================================
// 9. SPINORS & CLIFFORD ALGEBRA GAMMA MATRICES
// =====================================================================

export function pauliMatrices() {
  const sx = [[c(0), c(1)], [c(1), c(0)]];
  const sy = [[c(0), c(0, -1)], [c(0, 1), c(0)]];
  const sz = [[c(1), c(0)], [c(0), c(-1)]];
  const sp = [[c(0), c(1)], [c(0), c(0)]];
  const sm = [[c(0), c(0)], [c(1), c(0)]];
  const I = matEye(2);
  return { sx, sy, sz, sp, sm, I };
}

export function spinorInfo(d) {
  d = Math.trunc(d);
  if (d < 2 || d > 16) throw new Error('SO(d) için d = 2..16 desteklenir');
  const isEven = d % 2 === 0;
  const n = Math.floor(d / 2);

  // Reality periodicity (Bott mod 8) for Euclidean SO(d) spinors
  const mod8 = d % 8;
  let reality, realityTr;
  if (isEven) {
    if (mod8 === 0) { reality = 'real'; realityTr = 'Gerçel (Majorana-Weyl)'; }
    else if (mod8 === 4) { reality = 'pseudoreal'; realityTr = 'Sözde-gerçel (Simplektik-Weyl)'; }
    else { reality = 'complex'; realityTr = 'Kompleks (S_+* = S_-)'; }
  } else {
    if (mod8 === 1 || mod8 === 7) { reality = 'real'; realityTr = 'Gerçel (Majorana)'; }
    else { reality = 'pseudoreal'; realityTr = 'Sözde-gerçel (Simplektik)'; }
  }

  const algId = d === 2 ? 'U(1)' : d === 3 ? 'A1' : d === 4 ? 'A1+A1' : isEven ? `D${n}` : `B${n}`;
  const spinorDim = isEven ? 2 ** (n - 1) : 2 ** n;

  // Explicit weight vectors in orthonormal basis (1/2)(+-1, ..., +-1) when n <= 6
  const weightsPlus = [];
  const weightsMinus = [];
  if (n <= 6) {
    const total = 1 << n;
    for (let mask = 0; mask < total; mask++) {
      const vec = [];
      let minusCount = 0;
      for (let i = 0; i < n; i++) {
        const neg = (mask >> (n - 1 - i)) & 1;
        if (neg) minusCount++;
        vec.push(neg ? -0.5 : 0.5);
      }
      if (!isEven || minusCount % 2 === 0) weightsPlus.push(vec);
      else weightsMinus.push(vec);
    }
  }

  const reps = isEven
    ? [
        { name: 'S_+ (sağ/pozitif kiralite)', dim: spinorDim, chirality: '+1', dynkin: n >= 3 ? Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 0)) : null, weights: weightsPlus },
        { name: 'S_- (sol/negatif kiralite)', dim: spinorDim, chirality: '-1', dynkin: n >= 3 ? Array.from({ length: n }, (_, i) => (i === n - 2 ? 1 : 0)) : null, weights: weightsMinus },
      ]
    : [
        { name: 'S (Dirac spinörü)', dim: spinorDim, chirality: 'yok (tek boyut)', dynkin: n >= 2 ? Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 0)) : [1], weights: weightsPlus },
      ];

  return {
    d,
    n,
    isEven,
    algId,
    diracDim: 2 ** n,
    spinorDim,
    reality,
    realityTr,
    reps,
  };
}

// Explicit Hermitian Euclidean Clifford algebra gamma matrices: {Gamma_mu, Gamma_nu} = 2 delta_{mu nu} I
export function cliffordGammas(d) {
  d = Math.trunc(d);
  if (d < 2 || d > 8) throw new Error('Clifford matrisleri d = 2..8 için oluşturulur (boyut ≤ 16×16)');
  const { sx, sy, sz, I } = pauliMatrices();
  const n = Math.floor(d / 2);

  // Build for even dimension 2n recursively so chirality Gamma_* = (-i)^n Gamma_1 ... Gamma_{2n} = I_{2^{n-1}} (x) sz
  let gammas = [sx, sy];
  let chirality = sz;
  for (let k = 2; k <= n; k++) {
    const prevDim = 1 << (k - 1);
    const nextGammas = gammas.map(G => matKron(G, sx));
    nextGammas.push(matKron(chirality, sx));
    nextGammas.push(matKron(matEye(prevDim), sy));
    gammas = nextGammas;
    chirality = matKron(matEye(prevDim), sz);
  }
  if (d % 2 === 1) {
    gammas.push(chirality);
  }

  // Generators of so(d): Sigma_{mu, nu} = -(i/4) [Gamma_mu, Gamma_nu]
  const generators = [];
  for (let mu = 0; mu < d; mu++) {
    for (let nu = mu + 1; nu < d; nu++) {
      const sig = matScale(matComm(gammas[mu], gammas[nu]), c(0, -0.25));
      generators.push({ mu: mu + 1, nu: nu + 1, matrix: sig });
    }
  }

  const check = verifyClifford(gammas);
  return {
    d,
    n,
    matrixSize: 1 << n,
    gammas,
    chirality: d % 2 === 0 ? chirality : null,
    generators,
    check,
  };
}

export function fermionicOscillatorSpinor(n) {
  // Ramond 8.5 & 8.8: n fermionic oscillators b_i, b_i^dag ({b_i, b_j^dag} = delta_{ij})
  // generate the 2^n-dimensional Dirac spinor of SO(2n), splitting into even (S_+) and odd (S_-) parity Weyl spinors!
  n = Math.trunc(n);
  if (n < 1 || n > 6) throw new Error('Fermiyonik salınıcı spinörü için n = 1..6 desteklenir');
  const total = 1 << n;
  const statesPlus = [];
  const statesMinus = [];
  for (let mask = 0; mask < total; mask++) {
    const occ = [];
    let count = 0;
    const weight = [];
    for (let i = 0; i < n; i++) {
      const bit = (mask >> (n - 1 - i)) & 1;
      occ.push(bit);
      count += bit;
      // Cartan eigenvalue h_i = b_i^dag b_i - 1/2 in {-1/2, +1/2}
      weight.push(bit ? 0.5 : -0.5);
    }
    const item = { occ, fermionNumber: count, weight, chirality: count % 2 === 0 ? '+1' : '-1' };
    if (count % 2 === 0) statesPlus.push(item);
    else statesMinus.push(item);
  }
  return {
    n,
    d: 2 * n,
    diracDim: total,
    weylDim: total >> 1,
    statesPlus,
    statesMinus,
  };
}

export function verifyClifford(gammas) {
  const d = gammas.length;
  const sz = gammas[0].length;
  const I2 = matScale(matEye(sz), 2);
  let maxAntiCommErr = 0;
  let maxHermErr = 0;
  for (let mu = 0; mu < d; mu++) {
    const hErr = matMaxAbs(matSub(gammas[mu], matDag(gammas[mu])));
    if (hErr > maxHermErr) maxHermErr = hErr;
    for (let nu = 0; nu < d; nu++) {
      const ac = matAntiComm(gammas[mu], gammas[nu]);
      const target = mu === nu ? I2 : matZero(sz);
      const err = matMaxAbs(matSub(ac, target));
      if (err > maxAntiCommErr) maxAntiCommErr = err;
    }
  }
  return {
    ok: maxAntiCommErr < 1e-10 && maxHermErr < 1e-10,
    maxAntiCommErr,
    maxHermErr,
  };
}

// =====================================================================
// 10. EXTENDED DYNKIN DIAGRAMS, BOREL-DE SIEBENTHAL & BRANCHING RULES
// =====================================================================

export function extendedDynkin(alg) {
  const r = alg.rank;
  const thetaDyn = alg.highestRoot.dynkin;
  const extA = Array.from({ length: r + 1 }, () => Array(r + 1).fill(0));
  extA[0][0] = 2;
  for (let i = 0; i < r; i++) {
    // alpha_0 = -theta (mod delta); A_{0, j+1} = -theta_j; A_{i+1, 0} = -theta_i * d_i
    extA[0][i + 1] = -thetaDyn[i];
    extA[i + 1][0] = -Number(ratMul(rat(thetaDyn[i]), alg.d[i]).n);
    for (let j = 0; j < r; j++) extA[i + 1][j + 1] = alg.cartan[i][j];
  }

  const marks = [1, ...alg.marks];
  const comarks = [1, ...alg.comarks];

  // Position affine node 0 nicely for SVG rendering
  const nodes = alg.dynkinNodes.map(nd => ({
    index: nd.index + 1,
    label: nd.label,
    isLong: nd.isLong,
    isAffine: false,
    x: nd.x,
    y: nd.y,
    mark: nd.mark,
    comark: nd.comark,
  }));

  let ax = -1, ay = 0;
  if (alg.type === 'A' && r >= 2) { ax = (r - 1) / 2; ay = -1.1; }
  else if (alg.type === 'A' && r === 1) { ax = 1; ay = 0; }
  else if (alg.type === 'B' && r >= 3) { ax = 0; ay = -0.75; nodes[0].y = 0.75; }
  else if (alg.type === 'B' && r === 2) { ax = 2; ay = 0; }
  else if (alg.type === 'C') { ax = -1; ay = 0; }
  else if (alg.type === 'D' && r === 3) { ax = 2; ay = 0; }
  else if (alg.type === 'D') { ax = 0; ay = -0.75; nodes[0].y = 0.75; }
  else if (alg.type === 'G') { ax = -1; ay = 0; }
  else if (alg.type === 'F') { ax = -1; ay = 0; }
  else if (alg.type === 'E' && r === 6) { ax = 2; ay = 2; }
  else if (alg.type === 'E' && r === 7) { ax = -1; ay = 0; }
  else if (alg.type === 'E' && r === 8) { ax = 7; ay = 0; }

  const allNodes = [
    { index: 0, label: 'α0', isLong: true, isAffine: true, x: ax, y: ay, mark: 1, comark: 1 },
    ...nodes,
  ];

  const edges = [];
  for (let i = 0; i <= r; i++) {
    for (let j = i + 1; j <= r; j++) {
      if (extA[i][j] !== 0) {
        const prod = extA[i][j] * extA[j][i];
        const mult = prod === 4 ? 2 : prod; // A_1^{(1)} has 2x2 double-headed bond
        let dir = 0;
        if (prod === 4) dir = 2; // bidirectional double arrow for A_1^(1)
        else if (Math.abs(extA[i][j]) > Math.abs(extA[j][i])) dir = 1; // i long -> j short
        else if (Math.abs(extA[j][i]) > Math.abs(extA[i][j])) dir = -1; // j long -> i short
        edges.push({ from: i, to: j, mult, dir });
      }
    }
  }

  // Verify det(extA) === 0 and marks * extA === 0 and extA * comarks === 0
  const det = detRatMatrix(extA);
  let leftNullOk = true, rightNullOk = true;
  for (let j = 0; j <= r; j++) {
    let sL = 0, sR = 0;
    for (let i = 0; i <= r; i++) {
      sL += marks[i] * extA[i][j];
      sR += extA[j][i] * comarks[i];
    }
    if (sL !== 0) leftNullOk = false;
    if (sR !== 0) rightNullOk = false;
  }

  return {
    algId: alg.id,
    affineName: `${alg.type}_${r}^{(1)}`,
    affineLatex: `${alg.type}_{${r}}^{(1)}`,
    extCartan: extA,
    marks,
    comarks,
    coxeterNumber: alg.coxeterNumber,
    dualCoxeterNumber: alg.dualCoxeterNumber,
    nodes: allNodes,
    edges,
    detIsZero: det.n === 0n,
    leftNullOk,
    rightNullOk,
  };
}

// Identify a connected finite simple Dynkin diagram from its Cartan submatrix
function identifyDynkinComponent(subA) {
  const k = subA.length;
  if (k === 1) return { id: 'A1', label: 'A_1 (SU(2))', latex: '\\mathfrak{su}(2)', dim: 3, rank: 1 };
  const deg = Array(k).fill(0);
  let triple = false;
  let doublePair = null;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const p = subA[i][j] * subA[j][i];
      if (p > 0) {
        deg[i]++; deg[j]++;
        if (p === 3) triple = true;
        if (p === 2) doublePair = [i, j];
      }
    }
  }
  if (triple) return { id: 'G2', label: 'G_2', latex: '\\mathfrak{g}_2', dim: 14, rank: 2 };
  if (doublePair) {
    if (k === 2) return { id: 'B2', label: 'B_2 ≅ C_2 (SO(5))', latex: '\\mathfrak{so}(5)', dim: 10, rank: 2 };
    const [u, v] = doublePair;
    if (k === 4 && deg[u] === 2 && deg[v] === 2) return { id: 'F4', label: 'F_4', latex: '\\mathfrak{f}_4', dim: 52, rank: 4 };
    // Leaf node of double edge
    const leaf = deg[u] === 1 ? u : v;
    const inner = leaf === u ? v : u;
    // A_{inner, leaf} == -2 means leaf is SHORT -> B_k; A_{leaf, inner} == -2 means leaf is LONG -> C_k
    if (subA[inner][leaf] === -2) {
      return { id: `B${k}`, label: `B_${k} (SO(${2 * k + 1}))`, latex: `\\mathfrak{so}(${2 * k + 1})`, dim: k * (2 * k + 1), rank: k };
    }
    return { id: `C${k}`, label: `C_${k} (Sp(${2 * k}))`, latex: `\\mathfrak{sp}(${2 * k})`, dim: k * (2 * k + 1), rank: k };
  }
  const branch = deg.findIndex(d => d === 3);
  if (branch === -1) {
    return { id: `A${k}`, label: `A_${k} (SU(${k + 1}))`, latex: `\\mathfrak{su}(${k + 1})`, dim: k * (k + 2), rank: k };
  }
  // Compute 3 arm lengths from branch node
  const arms = [];
  for (let nb = 0; nb < k; nb++) {
    if (nb !== branch && subA[branch][nb] !== 0) {
      let len = 1, prev = branch, cur = nb;
      while (true) {
        let nxt = -1;
        for (let t = 0; t < k; t++) if (t !== prev && t !== cur && subA[cur][t] !== 0) { nxt = t; break; }
        if (nxt === -1) break;
        prev = cur; cur = nxt; len++;
      }
      arms.push(len);
    }
  }
  arms.sort((a, b) => a - b);
  if (arms[0] === 1 && arms[1] === 1) {
    return { id: `D${k}`, label: `D_${k} (SO(${2 * k}))`, latex: `\\mathfrak{so}(${2 * k})`, dim: k * (2 * k - 1), rank: k };
  }
  if (k === 6) return { id: 'E6', label: 'E_6', latex: '\\mathfrak{e}_6', dim: 78, rank: 6 };
  if (k === 7) return { id: 'E7', label: 'E_7', latex: '\\mathfrak{e}_7', dim: 133, rank: 7 };
  return { id: 'E8', label: 'E_8', latex: '\\mathfrak{e}_8', dim: 248, rank: 8 };
}

function isPrimeSmall(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

export function borelDeSiebenthal(alg, deleteNodeIdx) {
  const ext = extendedDynkin(alg);
  const N = alg.rank + 1;
  if (deleteNodeIdx < 0 || deleteNodeIdx >= N) throw new Error('Geçersiz düğüm indeksi');
  const mark = ext.marks[deleteNodeIdx];
  const kept = [];
  for (let i = 0; i < N; i++) if (i !== deleteNodeIdx) kept.push(i);

  // Connected components among kept nodes
  const visited = new Set();
  const factors = [];
  for (const start of kept) {
    if (visited.has(start)) continue;
    const comp = [];
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      const u = stack.pop();
      comp.push(u);
      for (const v of kept) {
        if (!visited.has(v) && ext.extCartan[u][v] !== 0) {
          visited.add(v);
          stack.push(v);
        }
      }
    }
    comp.sort((a, b) => a - b);
    const subA = comp.map(i => comp.map(j => ext.extCartan[i][j]));
    factors.push({ ...identifyDynkinComponent(subA), nodes: comp });
  }

  const hasU1 = deleteNodeIdx !== 0 && mark === 1;
  const isOriginal = deleteNodeIdx === 0;
  const isMaximalRegular = !isOriginal && (mark === 1 || isPrimeSmall(mark));
  const subRank = factors.reduce((s, f) => s + f.rank, 0) + (hasU1 ? 1 : 0);
  const subDim = factors.reduce((s, f) => s + f.dim, 0) + (hasU1 ? 1 : 0);

  const labelParts = factors.map(f => f.label);
  const latexParts = factors.map(f => f.latex);
  if (hasU1) { labelParts.push('U(1)'); latexParts.push('\\mathfrak{u}(1)'); }

  return {
    deletedNode: deleteNodeIdx,
    deletedLabel: ext.nodes[deleteNodeIdx].label,
    deletedMark: mark,
    isOriginal,
    hasU1,
    isMaximalRegular,
    kind: isOriginal
      ? 'Asıl cebir (α₀ silindi)'
      : hasU1
        ? 'Maksimal düzenli alt cebir (R-alt cebir + u(1))'
        : isPrimeSmall(mark)
          ? `Maksimal düzenli yarı-basit alt cebir (asal işaret a = ${mark})`
          : `Düzenli alt cebir (bileşik işaret a = ${mark}, maksimal değil)`,
    factors,
    subRank,
    subDim,
    label: labelParts.join(' ⊕ '),
    latex: latexParts.join(' \\oplus '),
  };
}

// Generic projection-matrix branching engine: peels projected parent weights into exact subalgebra irreps!
function peelBranching(parentAlg, hw, subAlgs, projectFn, maxWeights = 2500) {
  const ws = weightSystem(parentAlg, hw, { maxWeights });
  if (ws.truncated) return { truncated: true, terms: [], parentDim: ws.dim };

  // Group weights by U(1) charge signature
  const sectors = new Map();
  for (const w of ws.weights) {
    const { subWeights, chargeKey, chargeLabel, chargeRat } = projectFn(w.dynkin);
    if (!sectors.has(chargeKey)) sectors.set(chargeKey, { chargeLabel, chargeRat, map: new Map(), weights: new Map() });
    const sec = sectors.get(chargeKey);
    const wk = subWeights.map(sw => sw.join(',')).join('|');
    sec.map.set(wk, (sec.map.get(wk) || 0) + w.mult);
    sec.weights.set(wk, subWeights);
  }

  // Height score = sum_k (w_k, 2 rho_k) so a maximal remaining weight is guaranteed to be a dominant highest weight
  const scoreSub = subWeights => {
    let s = 0;
    for (let k = 0; k < subAlgs.length; k++) {
      const alg = subAlgs[k];
      const w = subWeights[k];
      for (let i = 0; i < alg.rank; i++) {
        for (let j = 0; j < alg.rank; j++) s += (w[i] * alg.metricInt[i][j]) / alg.metricDenom;
      }
    }
    return s;
  };

  const terms = [];
  for (const sec of sectors.values()) {
    const pool = new Map(sec.map);
    let guard = 0;
    while (pool.size > 0 && guard++ < 500) {
      let bestKey = null, bestScore = -Infinity, bestSub = null;
      for (const [k, m] of pool.entries()) {
        if (m <= 0) { pool.delete(k); continue; }
        const sw = sec.weights.get(k);
        const sc = scoreSub(sw);
        if (sc > bestScore) { bestScore = sc; bestKey = k; bestSub = sw; }
      }
      if (!bestKey) break;
      const mult = pool.get(bestKey);
      // Compute tensor product of weight systems of each factor S_k(bestSub[k])
      const factorWS = subAlgs.map((sa, idx) => weightSystem(sa, bestSub[idx], { maxWeights: 1200 }));
      let prodDim = 1n;
      const factorDims = factorWS.map(f => { prodDim *= f.dim; return f.dim; });

      // Cartesian iteration to subtract mult * prod(m_k)
      const recurse = (idx, keyAcc, multAcc) => {
        if (idx === subAlgs.length) {
          const prev = pool.get(keyAcc) || 0;
          const next = prev - multAcc;
          if (next === 0) pool.delete(keyAcc);
          else pool.set(keyAcc, next);
          return;
        }
        const fws = factorWS[idx];
        for (const fw of fws.weights) {
          const part = fw.dynkin.join(',');
          recurse(idx + 1, idx === 0 ? part : `${keyAcc}|${part}`, multAcc * fw.mult);
        }
      };
      recurse(0, '', mult);

      terms.push({
        subHws: bestSub,
        factorDims,
        dim: prodDim,
        mult,
        chargeLabel: sec.chargeLabel,
        chargeRat: sec.chargeRat,
      });
    }
  }

  terms.sort((a, b) => (b.dim > a.dim ? 1 : b.dim < a.dim ? -1 : (a.chargeLabel || '').localeCompare(b.chargeLabel || '')));
  const sumDim = terms.reduce((s, t) => s + BigInt(t.mult) * t.dim, 0n);

  return {
    truncated: false,
    parentAlgId: parentAlg.id,
    parentHw: hw,
    parentDim: ws.dim,
    sumDim,
    dimCheck: sumDim === ws.dim,
    terms,
  };
}

export const BRANCHING_CHAINS = [
  {
    id: 'su3_su2u1',
    title: 'SU(3) ⊃ SU(2)_I × U(1)_Y',
    kind: 'Düzenli (Regular)',
    parent: 'A2',
    subLabel: 'SU(2) × U(1)_Y',
    desc: 'İzospin ve hiperyük gömmesi (kuark ve hadron çokluları).',
    presets: [
      { label: '3 = (1,0)', hw: [1, 0] },
      { label: '3̄ = (0,1)', hw: [0, 1] },
      { label: '6 = (2,0)', hw: [2, 0] },
      { label: '8 = (1,1)', hw: [1, 1] },
      { label: '10 = (3,0)', hw: [3, 0] },
      { label: '27 = (2,2)', hw: [2, 2] },
    ],
  },
  {
    id: 'su5_sm',
    title: 'SU(5) ⊃ SU(3)_C × SU(2)_L × U(1)_Y',
    kind: 'Düzenli (Regular · Georgi-Glashow GUT)',
    parent: 'A4',
    subLabel: 'SU(3)_C × SU(2)_L × U(1)_Y',
    desc: 'Standart Model ayar grubunun SU(5) içine gömülmesi (5̄ + 10 = bir fermiyon nesli).',
    presets: [
      { label: '5 = (1,0,0,0)', hw: [1, 0, 0, 0] },
      { label: '5̄ = (0,0,0,1)', hw: [0, 0, 0, 1] },
      { label: '10 = (0,1,0,0)', hw: [0, 1, 0, 0] },
      { label: '15 = (2,0,0,0)', hw: [2, 0, 0, 0] },
      { label: '24 = (1,0,0,1)', hw: [1, 0, 0, 1] },
    ],
  },
  {
    id: 'so10_su5',
    title: 'SO(10) ⊃ SU(5) × U(1)_X',
    kind: 'Düzenli (Regular · SO(10) GUT)',
    parent: 'D5',
    subLabel: 'SU(5) × U(1)_X',
    desc: '16 spinör temsili tüm bir Standart Model neslini + sağ-elli nötrinoyu tek temsilde birleştirir.',
    presets: [
      { label: '10 = (1,0,0,0,0)', hw: [1, 0, 0, 0, 0] },
      { label: '16 = (0,0,0,0,1)', hw: [0, 0, 0, 0, 1] },
      { label: '16̄ = (0,0,0,1,0)', hw: [0, 0, 0, 1, 0] },
      { label: '45 = (0,1,0,0,0)', hw: [0, 1, 0, 0, 0] },
      { label: '54 = (2,0,0,0,0)', hw: [2, 0, 0, 0, 0] },
      { label: '126 = (0,0,0,0,2)', hw: [0, 0, 0, 0, 2] },
    ],
  },
  {
    id: 'e6_so10',
    title: 'E_6 ⊃ SO(10) × U(1)_ψ',
    kind: 'Düzenli (Regular · E₆ GUT)',
    parent: 'E6',
    subLabel: 'SO(10) × U(1)_ψ',
    desc: 'İstisnai E₆ birleşmesi: temel 27 temsili 16 + 10 + 1 olarak dallanır.',
    presets: [
      { label: '27 = (1,0,0,0,0,0)', hw: [1, 0, 0, 0, 0, 0] },
      { label: '27̄ = (0,0,0,0,1,0)', hw: [0, 0, 0, 0, 1, 0] },
      { label: '78 = (0,0,0,0,0,1)', hw: [0, 0, 0, 0, 0, 1] },
    ],
  },
  {
    id: 'g2_su3',
    title: 'G_2 ⊃ SU(3)',
    kind: 'Düzenli (Regular · kısa düğüm silme)',
    parent: 'G2',
    subLabel: 'SU(3)',
    desc: 'G₂ genişletilmiş diyagramından kısa kök α₂ silinerek elde edilen maksimal SU(3) alt cebiri.',
    presets: [
      { label: '7 = (0,1)', hw: [0, 1] },
      { label: '14 = (1,0)', hw: [1, 0] },
      { label: '27 = (0,2)', hw: [0, 2] },
      { label: '64 = (1,1)', hw: [1, 1] },
    ],
  },
  {
    id: 'su3_so3',
    title: 'SU(3) ⊃ SO(3) (Özel / S-alt cebir)',
    kind: 'Özel (Special · Elliott / 3B HO)',
    parent: 'A2',
    subLabel: 'SO(3) ≅ SU(2)',
    desc: 'Düzenli olmayan (özel) gömme: gömme indeksi j = 4, 3B harmonik salınıcı ve Elliott nükleer modeli.',
    presets: [
      { label: '3 = (1,0)', hw: [1, 0] },
      { label: '6 = (2,0)', hw: [2, 0] },
      { label: '8 = (1,1)', hw: [1, 1] },
      { label: '10 = (3,0)', hw: [3, 0] },
      { label: '15 = (2,1)', hw: [2, 1] },
    ],
  },
  {
    id: 'su4_so4',
    title: 'SU(4) ⊃ SO(4) ≅ SU(2) × SU(2)',
    kind: 'Özel (Special · so(n) ⊂ su(n))',
    parent: 'A3',
    subLabel: 'SU(2) × SU(2)',
    desc: 'so(4) ⊂ su(4) özel gömmesi: temel 4 vektör (2,2), 6 antisimetrik (3,1)+(1,3), 15 eklenik.',
    presets: [
      { label: '4 = (1,0,0)', hw: [1, 0, 0] },
      { label: '6 = (0,1,0)', hw: [0, 1, 0] },
      { label: '10 = (2,0,0)', hw: [2, 0, 0] },
      { label: '15 = (1,0,1)', hw: [1, 0, 1] },
    ],
  },
  {
    id: 'su5_so5',
    title: 'SU(5) ⊃ SO(5)',
    kind: 'Özel (Special · so(n) ⊂ su(n))',
    parent: 'A4',
    subLabel: 'SO(5) (B₂)',
    desc: 'so(5) ⊂ su(5) özel gömmesi: 5 → 5, 10 → 10, 15 → 14 + 1, 24 → 14 + 10.',
    presets: [
      { label: '5 = (1,0,0,0)', hw: [1, 0, 0, 0] },
      { label: '10 = (0,1,0,0)', hw: [0, 1, 0, 0] },
      { label: '15 = (2,0,0,0)', hw: [2, 0, 0, 0] },
      { label: '24 = (1,0,0,1)', hw: [1, 0, 0, 1] },
    ],
  },
];

export function branchingRule(chainId, hw) {
  if (chainId === 'su3_su2u1') {
    const P = getAlgebra('A', 2), S1 = getAlgebra('A', 1);
    return peelBranching(P, hw, [S1], w => {
      const Y = rat(w[0] + 2 * w[1], 3);
      return { subWeights: [[w[0]]], chargeKey: ratFormat(Y), chargeLabel: `Y = ${ratFormat(Y)}`, chargeRat: Y };
    });
  }
  if (chainId === 'su5_sm') {
    const P = getAlgebra('A', 4), S1 = getAlgebra('A', 2), S2 = getAlgebra('A', 1);
    return peelBranching(P, hw, [S1, S2], w => {
      const Y = rat(-(2 * w[0] + 4 * w[1] + 6 * w[2] + 3 * w[3]), 6);
      return { subWeights: [[w[0], w[1]], [w[3]]], chargeKey: ratFormat(Y), chargeLabel: `Y = ${ratFormat(Y)}`, chargeRat: Y };
    });
  }
  if (chainId === 'so10_su5') {
    const P = getAlgebra('D', 5), S1 = getAlgebra('A', 4);
    // D5 nodes (0,1,2,4) form A4; U(1)_X = -4 * (omega_4, w)
    const row4 = P.metricG[3]; // 0-indexed node 3 is alpha_4
    return peelBranching(P, hw, [S1], w => {
      let q = R0;
      for (let j = 0; j < 5; j++) q = ratAdd(q, ratMul(rat(w[j]), row4[j]));
      const X = ratMul(rat(-4), q);
      return { subWeights: [[w[0], w[1], w[2], w[4]]], chargeKey: ratFormat(X), chargeLabel: `X = ${ratFormat(X)}`, chargeRat: X };
    });
  }
  if (chainId === 'e6_so10') {
    const P = getAlgebra('E', 6), S1 = getAlgebra('D', 5);
    // Delete node 0 of E6; map D5 nodes (0..4) <- E6 nodes (4, 3, 2, 5, 1) so 16=(0,0,0,0,1)
    // Q_psi = 4 a1 + 5 a2 + 6 a3 + 4 a4 + 2 a5 + 3 a6
    return peelBranching(P, hw, [S1], w => {
      const psi = rat(4 * w[0] + 5 * w[1] + 6 * w[2] + 4 * w[3] + 2 * w[4] + 3 * w[5], 1);
      return { subWeights: [[w[4], w[3], w[2], w[5], w[1]]], chargeKey: ratFormat(psi), chargeLabel: `ψ = ${ratFormat(psi)}`, chargeRat: psi };
    });
  }
  if (chainId === 'g2_su3') {
    const P = getAlgebra('G', 2), S1 = getAlgebra('A', 2);
    // Delete short root alpha_2; remaining simple roots are alpha_1 and alpha_0 = -theta
    return peelBranching(P, hw, [S1], w => ({
      subWeights: [[w[0], -(2 * w[0] + w[1])]],
      chargeKey: '',
      chargeLabel: '',
      chargeRat: R0,
    }));
  }
  if (chainId === 'su3_so3') {
    const P = getAlgebra('A', 2), S1 = getAlgebra('A', 1);
    return peelBranching(P, hw, [S1], w => ({
      subWeights: [[2 * (w[0] + w[1])]],
      chargeKey: '',
      chargeLabel: '',
      chargeRat: R0,
    }));
  }
  if (chainId === 'su4_so4') {
    const P = getAlgebra('A', 3), S1 = getAlgebra('A', 1), S2 = getAlgebra('A', 1);
    return peelBranching(P, hw, [S1, S2], w => ({
      subWeights: [[w[0] + 2 * w[1] + w[2]], [w[0] + w[2]]],
      chargeKey: '',
      chargeLabel: '',
      chargeRat: R0,
    }));
  }
  if (chainId === 'su5_so5') {
    const P = getAlgebra('A', 4), S1 = getAlgebra('B', 2);
    return peelBranching(P, hw, [S1], w => ({
      subWeights: [[w[0] + w[3], 2 * (w[1] + w[2])]],
      chargeKey: '',
      chargeLabel: '',
      chargeRat: R0,
    }));
  }
  throw new Error(`Bilinmeyen dallanma zinciri: ${chainId}`);
}

// =====================================================================
// 11. SU(2) & SU(1,1) ENGINE (SPIN MATRICES, EXP MAP, WIGNER d, CG, PHYSICS)
// =====================================================================

export function su2SpinMatrices(j) {
  const twoJ = Math.round(2 * j);
  if (twoJ < 0 || Math.abs(2 * j - twoJ) > 1e-9 || twoJ > 10) {
    throw new Error('j, 0 ile 5 arasında tam veya yarı-tam sayı olmalı');
  }
  const dim = twoJ + 1;
  const mValues = Array.from({ length: dim }, (_, idx) => j - idx);
  const Jz = matZero(dim);
  const Jp = matZero(dim);
  const Jm = matZero(dim);

  for (let idx = 0; idx < dim; idx++) {
    const m = mValues[idx];
    Jz[idx][idx] = c(m, 0);
    if (idx > 0) {
      // J+ |j, m> = sqrt(j(j+1) - m(m+1)) |j, m+1> (row idx-1, col idx)
      const val = Math.sqrt(j * (j + 1) - m * (m + 1));
      Jp[idx - 1][idx] = c(val, 0);
    }
    if (idx < dim - 1) {
      const val = Math.sqrt(j * (j + 1) - m * (m - 1));
      Jm[idx + 1][idx] = c(val, 0);
    }
  }
  const Jx = matScale(matAdd(Jp, Jm), 0.5);
  const Jy = matScale(matSub(Jp, Jm), c(0, -0.5));
  const J2 = matAdd(matAdd(matMul(Jx, Jx), matMul(Jy, Jy)), matMul(Jz, Jz));

  const commXY = matMaxAbs(matSub(matComm(Jx, Jy), matScale(Jz, c(0, 1))));
  const commYZ = matMaxAbs(matSub(matComm(Jy, Jz), matScale(Jx, c(0, 1))));
  const commZX = matMaxAbs(matSub(matComm(Jz, Jx), matScale(Jy, c(0, 1))));
  const casimirTarget = matScale(matEye(dim), j * (j + 1));
  const casimirErr = matMaxAbs(matSub(J2, casimirTarget));

  return {
    j,
    dim,
    mValues,
    Jx,
    Jy,
    Jz,
    Jp,
    Jm,
    J2,
    casimir: j * (j + 1),
    checks: {
      ok: Math.max(commXY, commYZ, commZX, casimirErr) < 1e-10,
      commXY,
      commYZ,
      commZX,
      casimirErr,
    },
  };
}

export function su2RotationMatrix(j, axis, angle) {
  const [ax, ay, az] = axis;
  const norm = Math.hypot(ax, ay, az) || 1;
  const nx = ax / norm, ny = ay / norm, nz = az / norm;
  if (Math.abs(j - 0.5) < 1e-9) {
    // Exact closed form: exp(-i theta/2 n.sigma) = cos(theta/2) I - i sin(theta/2) (n.sigma)
    const ch = Math.cos(angle / 2);
    const sh = Math.sin(angle / 2);
    return [
      [c(ch, -sh * nz), c(-sh * ny, -sh * nx)],
      [c(sh * ny, -sh * nx), c(ch, sh * nz)],
    ];
  }
  const { Jx, Jy, Jz } = su2SpinMatrices(j);
  const nDotJ = matAdd(matAdd(matScale(Jx, nx), matScale(Jy, ny)), matScale(Jz, nz));
  return matExp(matScale(nDotJ, c(0, -angle)));
}

export function so3RotationMatrix(axis, angle) {
  const [ax, ay, az] = axis;
  const norm = Math.hypot(ax, ay, az) || 1;
  const x = ax / norm, y = ay / norm, z = az / norm;
  const co = Math.cos(angle), si = Math.sin(angle), t = 1 - co;
  return [
    [co + x * x * t, x * y * t - z * si, x * z * t + y * si],
    [y * x * t + z * si, co + y * y * t, y * z * t - x * si],
    [z * x * t - y * si, z * y * t + x * si, co + z * z * t],
  ];
}

// Wigner small d-matrix d^j_{m', m}(beta) = <j, m'| exp(-i beta J_y) |j, m>
export function wignerSmallD(j, beta) {
  const twoJ = Math.round(2 * j);
  const dim = twoJ + 1;
  const mValues = Array.from({ length: dim }, (_, i) => j - i);
  const cb = Math.cos(beta / 2);
  const sb = Math.sin(beta / 2);
  const M = Array.from({ length: dim }, () => Array(dim).fill(0));

  for (let r = 0; r < dim; r++) {
    const mp = mValues[r];
    for (let k = 0; k < dim; k++) {
      const m = mValues[k];
      const a = Math.round(j + mp), b = Math.round(j - mp);
      const cc = Math.round(j + m), dd = Math.round(j - m);
      const pref = Math.sqrt(Number(factorialBig(a) * factorialBig(b) * factorialBig(cc) * factorialBig(dd)));
      const diff = Math.round(mp - m);
      const sMin = Math.max(0, -diff);
      const sMax = Math.min(cc, b);
      let sum = 0;
      for (let s = sMin; s <= sMax; s++) {
        const denom = Number(factorialBig(cc - s) * factorialBig(s) * factorialBig(diff + s) * factorialBig(b - s));
        const sign = ((diff + s) % 2 === 0) ? 1 : -1;
        const pCos = twoJ + Math.round(m - mp) - 2 * s;
        const pSin = diff + 2 * s;
        sum += (sign * Math.pow(cb, pCos) * Math.pow(sb, pSin)) / denom;
      }
      M[r][k] = pref * sum;
    }
  }
  return { j, beta, mValues, matrix: M };
}

// Exact SU(2) Clebsch-Gordan coefficient <j1 m1; j2 m2 | J M> using BigInt Racah formula
export function clebschGordan(j1, m1, j2, m2, J, M) {
  const J1 = Math.round(2 * j1), M1 = Math.round(2 * m1);
  const J2 = Math.round(2 * j2), M2 = Math.round(2 * m2);
  const JJ = Math.round(2 * J), MM = Math.round(2 * M);

  const zero = { sign: 0, num: 0n, den: 1n, value: 0, text: '0', latex: '0' };
  if (M1 + M2 !== MM) return zero;
  if (JJ < Math.abs(J1 - J2) || JJ > J1 + J2 || ((J1 + J2 - JJ) & 1) !== 0) return zero;
  if (Math.abs(M1) > J1 || Math.abs(M2) > J2 || Math.abs(MM) > JJ) return zero;
  if (((J1 - M1) & 1) !== 0 || ((J2 - M2) & 1) !== 0 || ((JJ - MM) & 1) !== 0) return zero;

  const t1 = (J1 + J2 - JJ) / 2;
  const t2 = (J1 - J2 + JJ) / 2;
  const t3 = (-J1 + J2 + JJ) / 2;
  const t4 = (J1 + J2 + JJ) / 2 + 1;

  const p1 = (J1 + M1) / 2, p2 = (J1 - M1) / 2;
  const p3 = (J2 + M2) / 2, p4 = (J2 - M2) / 2;
  const p5 = (JJ + MM) / 2, p6 = (JJ - MM) / 2;

  const radicand = rat(
    BigInt(JJ + 1) * factorialBig(t1) * factorialBig(t2) * factorialBig(t3)
      * factorialBig(p1) * factorialBig(p2) * factorialBig(p3)
      * factorialBig(p4) * factorialBig(p5) * factorialBig(p6),
    factorialBig(t4),
  );

  const c1 = (JJ - J2 + M1) / 2;
  const c2 = (JJ - J1 - M2) / 2;
  const kMin = Math.max(0, -c1, -c2);
  const kMax = Math.min(t1, p2, p3);

  let sum = R0;
  for (let k = kMin; k <= kMax; k++) {
    const den = factorialBig(k) * factorialBig(t1 - k) * factorialBig(p2 - k)
      * factorialBig(p3 - k) * factorialBig(c1 + k) * factorialBig(c2 + k);
    const term = rat(k % 2 === 0 ? 1n : -1n, den);
    sum = ratAdd(sum, term);
  }
  if (sum.n === 0n) return zero;

  const sign = sum.n < 0n ? -1 : 1;
  const sq = ratMul(radicand, ratMul(sum, sum));
  const fmt = sqrtRatFormat(sign, sq.n, sq.d);
  return {
    sign,
    num: sq.n,
    den: sq.d,
    value: sign * Math.sqrt(ratToNumber(sq)),
    text: fmt.text,
    latex: fmt.latex,
  };
}

export function su2TensorDecomp(j1, j2) {
  const JMin = Math.abs(j1 - j2);
  const JMax = j1 + j2;
  const JValues = [];
  for (let J = JMax; J >= JMin - 1e-9; J -= 1) JValues.push(Math.round(J * 2) / 2);

  const states = [];
  for (const J of JValues) {
    for (let M = J; M >= -J - 1e-9; M -= 1) {
      const mr = Math.round(M * 2) / 2;
      const terms = [];
      for (let m1 = j1; m1 >= -j1 - 1e-9; m1 -= 1) {
        const m1r = Math.round(m1 * 2) / 2;
        const m2r = Math.round((mr - m1r) * 2) / 2;
        if (Math.abs(m2r) <= j2 + 1e-9) {
          const cg = clebschGordan(j1, m1r, j2, m2r, J, mr);
          if (cg.sign !== 0) terms.push({ m1: m1r, m2: m2r, cg });
        }
      }
      states.push({ J, M: mr, terms });
    }
  }
  return { j1, j2, JValues, states };
}

export function formatHalfInt(x) {
  const t = Math.round(2 * x);
  if (t % 2 === 0) return String(t / 2);
  return `${t}/2`;
}

// SU(1,1) non-compact real form (Weyl unitary trick: K1 = i J1, K2 = i J2, K3 = J3)
export function su11DefiningMatrices() {
  const { sx, sy, sz } = pauliMatrices();
  const K1 = matScale(sx, c(0, 0.5));
  const K2 = matScale(sy, c(0, 0.5));
  const K3 = matScale(sz, c(0.5, 0));
  const Kp = matAdd(K1, matScale(K2, c(0, 1))); // K1 + i K2
  const Km = matSub(K1, matScale(K2, c(0, 1))); // K1 - i K2
  const eta = [[c(1), c(0)], [c(0), c(-1)]];
  // Check [K1, K2] = -i K3, [K2, K3] = i K1, [K3, K1] = i K2, [K+, K-] = -2 K3
  const e12 = matMaxAbs(matSub(matComm(K1, K2), matScale(K3, c(0, -1))));
  const e23 = matMaxAbs(matSub(matComm(K2, K3), matScale(K1, c(0, 1))));
  const e31 = matMaxAbs(matSub(matComm(K3, K1), matScale(K2, c(0, 1))));
  const epm = matMaxAbs(matSub(matComm(Kp, Km), matScale(K3, c(-2, 0))));
  return {
    K1, K2, K3, Kp, Km, eta,
    checks: { ok: Math.max(e12, e23, e31, epm) < 1e-10, e12, e23, e31, epm },
  };
}

export function su11GroupElement(boostEta, rotPhi = 0) {
  // U = exp(-i rotPhi K3) exp(-i boostEta K2) = [[e^{-i phi/2} cosh(eta/2), e^{-i phi/2} sinh(eta/2)], [e^{i phi/2} sinh(eta/2), e^{i phi/2} cosh(eta/2)]]
  const { K2, K3, eta } = su11DefiningMatrices();
  const U = matMul(matExp(matScale(K3, c(0, -rotPhi))), matExp(matScale(K2, c(0, -boostEta))));
  const metricErr = matMaxAbs(matSub(matMul(matMul(matDag(U), eta), U), eta));
  const det = cSub(cMul(U[0][0], U[1][1]), cMul(U[0][1], U[1][0]));
  return { U, metricErr, det, preservesMetric: metricErr < 1e-10 };
}

export function su11DiscreteSeries(k, kind = '+', nLevels = 8) {
  // Positive discrete series D^+_k: m = k, k+1, k+2, ... ; Casimir Q = K3^2 - K1^2 - K2^2 = k(k-1)
  // Negative discrete series D^-_k: m = -k, -k-1, -k-2, ...
  const casimir = k * (k - 1);
  const levels = [];
  for (let n = 0; n < nLevels; n++) {
    const m = kind === '+' ? k + n : -k - n;
    // K+ |k, m> = sqrt(m(m+1) - k(k-1)) |k, m+1>
    // K- |k, m> = sqrt(m(m-1) - k(k-1)) |k, m-1>
    const upSq = m * (m + 1) - casimir;
    const dnSq = m * (m - 1) - casimir;
    levels.push({
      n,
      m,
      upCoeff: upSq > 1e-12 ? Math.sqrt(upSq) : 0,
      downCoeff: dnSq > 1e-12 ? Math.sqrt(dnSq) : 0,
    });
  }
  return { k, kind, casimir, label: `D^{${kind}}_{${formatHalfInt(k)}}`, levels };
}

export function oscillatorSU2(N) {
  const j = N / 2;
  const states = [];
  for (let n1 = N; n1 >= 0; n1--) {
    const n2 = N - n1;
    const m = (n1 - n2) / 2;
    states.push({ n1, n2, j, m });
  }
  return { N, j, degeneracy: N + 1, states };
}

export function bohrAtomSO4(n) {
  const j = (n - 1) / 2;
  const lValues = Array.from({ length: n }, (_, l) => l);
  const degeneracy = lValues.reduce((s, l) => s + (2 * l + 1), 0);
  return { n, jPlus: j, jMinus: j, lValues, degeneracy, energyRel: -1 / (n * n) };
}

export function oscillatorSU11(parity = 'even', nLevels = 6) {
  // Single-mode boson realization: K+ = 1/2 (a^dag)^2, K- = 1/2 a^2, K0 = 1/2 (a^dag a + 1/2)
  // Even Fock states |2n> -> D^+_{1/4}; Odd Fock states |2n+1> -> D^+_{3/4}; both have Q = -3/16
  const k = parity === 'even' ? 0.25 : 0.75;
  const ds = su11DiscreteSeries(k, '+', nLevels);
  const fockLevels = ds.levels.map(lv => ({
    ...lv,
    fockN: parity === 'even' ? 2 * lv.n : 2 * lv.n + 1,
  }));
  return { parity, k, casimir: -3 / 16, levels: fockLevels };
}

// =====================================================================
// 12. SU(3): GELL-MANN, f_abc, d_abc, BASES, ELLIOTT, EIGHTFOLD WAY & GMO
// =====================================================================

let GELL_MANN_CACHE = null;
export function gellMannMatrices() {
  if (GELL_MANN_CACHE) return GELL_MANN_CACHE;
  const s3 = 1 / Math.sqrt(3);
  const lambdas = [
    [[c(0), c(1), c(0)], [c(1), c(0), c(0)], [c(0), c(0), c(0)]],
    [[c(0), c(0, -1), c(0)], [c(0, 1), c(0), c(0)], [c(0), c(0), c(0)]],
    [[c(1), c(0), c(0)], [c(0), c(-1), c(0)], [c(0), c(0), c(0)]],
    [[c(0), c(0), c(1)], [c(0), c(0), c(0)], [c(1), c(0), c(0)]],
    [[c(0), c(0), c(0, -1)], [c(0), c(0), c(0)], [c(0, 1), c(0), c(0)]],
    [[c(0), c(0), c(0)], [c(0), c(0), c(1)], [c(0), c(1), c(0)]],
    [[c(0), c(0), c(0)], [c(0), c(0), c(0, -1)], [c(0), c(0, 1), c(0)]],
    [[c(s3), c(0), c(0)], [c(0), c(s3), c(0)], [c(0), c(0), c(-2 * s3)]],
  ];
  const T = lambdas.map(L => matScale(L, 0.5));
  GELL_MANN_CACHE = { lambdas, T };
  return GELL_MANN_CACHE;
}

let SU3_STRUCT_CACHE = null;
export function su3StructureConstants() {
  if (SU3_STRUCT_CACHE) return SU3_STRUCT_CACHE;
  const { lambdas } = gellMannMatrices();
  const f = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Array(8).fill(0)));
  const d = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Array(8).fill(0)));

  for (let a = 0; a < 8; a++) {
    for (let b = 0; b < 8; b++) {
      const comm = matComm(lambdas[a], lambdas[b]);
      const anti = matAntiComm(lambdas[a], lambdas[b]);
      for (let k = 0; k < 8; k++) {
        // f_abc = (-i/4) Tr([lambda_a, lambda_b] lambda_c)
        const trF = matTrace(matMul(comm, lambdas[k]));
        const fv = trF.im / 4; // since (-i) * (re + i im) = im - i re
        f[a][b][k] = Math.abs(fv) < 1e-10 ? 0 : fv;
        // d_abc = (1/4) Tr({lambda_a, lambda_b} lambda_c)
        const trD = matTrace(matMul(anti, lambdas[k]));
        const dv = trD.re / 4;
        d[a][b][k] = Math.abs(dv) < 1e-10 ? 0 : dv;
      }
    }
  }

  const symStr = v => {
    if (Math.abs(v - 1) < 1e-9) return { text: '1', latex: '1' };
    if (Math.abs(v + 1) < 1e-9) return { text: '-1', latex: '-1' };
    if (Math.abs(v - 0.5) < 1e-9) return { text: '1/2', latex: '\\frac{1}{2}' };
    if (Math.abs(v + 0.5) < 1e-9) return { text: '-1/2', latex: '-\\frac{1}{2}' };
    if (Math.abs(v - Math.sqrt(3) / 2) < 1e-9) return { text: '√3/2', latex: '\\frac{\\sqrt{3}}{2}' };
    if (Math.abs(v + Math.sqrt(3) / 2) < 1e-9) return { text: '-√3/2', latex: '-\\frac{\\sqrt{3}}{2}' };
    if (Math.abs(v - 1 / Math.sqrt(3)) < 1e-9) return { text: '1/√3', latex: '\\frac{1}{\\sqrt{3}}' };
    if (Math.abs(v + 1 / Math.sqrt(3)) < 1e-9) return { text: '-1/√3', latex: '-\\frac{1}{\\sqrt{3}}' };
    if (Math.abs(v - 1 / (2 * Math.sqrt(3))) < 1e-9) return { text: '1/(2√3)', latex: '\\frac{1}{2\\sqrt{3}}' };
    if (Math.abs(v + 1 / (2 * Math.sqrt(3))) < 1e-9) return { text: '-1/(2√3)', latex: '-\\frac{1}{2\\sqrt{3}}' };
    return { text: v.toFixed(4), latex: v.toFixed(4) };
  };

  const uniqueF = [];
  const uniqueD = [];
  for (let a = 0; a < 8; a++) {
    for (let b = a + 1; b < 8; b++) {
      for (let k = b + 1; k < 8; k++) {
        if (Math.abs(f[a][b][k]) > 1e-9) {
          uniqueF.push({ idx: [a + 1, b + 1, k + 1], value: f[a][b][k], ...symStr(f[a][b][k]) });
        }
      }
    }
    for (let b = a; b < 8; b++) {
      for (let k = b; k < 8; k++) {
        if (Math.abs(d[a][b][k]) > 1e-9) {
          uniqueD.push({ idx: [a + 1, b + 1, k + 1], value: d[a][b][k], ...symStr(d[a][b][k]) });
        }
      }
    }
  }

  SU3_STRUCT_CACHE = { f, d, uniqueF, uniqueD };
  return SU3_STRUCT_CACHE;
}

export function su3Bases() {
  const { T } = gellMannMatrices();
  const E = (i, j) => {
    const M = matZero(3);
    M[i][j] = c(1);
    return M;
  };
  // Chevalley basis: h1 = diag(1,-1,0), h2 = diag(0,1,-1), e1=E12, e2=E23, e3=[e1,e2]=E13, f1=E21, f2=E32, f3=E31
  const h1 = [[c(1), c(0), c(0)], [c(0), c(-1), c(0)], [c(0), c(0), c(0)]];
  const h2 = [[c(0), c(0), c(0)], [c(0), c(1), c(0)], [c(0), c(0), c(-1)]];
  const e1 = E(0, 1), e2 = E(1, 2), e3 = E(0, 2);
  const f1 = E(1, 0), f2 = E(2, 1), f3 = E(2, 0);

  // Physics I/U/V-spin + Hypercharge
  const I3 = T[2];
  const Y = matScale(T[7], 2 / Math.sqrt(3));
  const Ip = e1, Im = f1, Vp = e3, Vm = f3, Up = e2, Um = f2;

  // Fundamental weights in Cartan diag: w1 = 1/3(2 h1 + h2) = diag(2/3, -1/3, -1/3), w2 = 1/3(h1 + 2 h2) = diag(1/3, 1/3, -2/3)
  const Hw1 = matScale(matAdd(matScale(h1, 2), h2), 1 / 3);
  const Hw2 = matScale(matAdd(h1, matScale(h2, 2)), 1 / 3);

  // Ramond alpha'-basis: orthogonalizes the two Cartan directions -> H'_1 = I_3 = (1/2)h1, H'_2 = T_8 = (1/(2 sqrt(3)))(h1 + 2 h2) = (sqrt(3)/2) Y
  const Hap1 = I3;
  const Hap2 = T[7];

  return {
    tripletWeights: [
      { name: 'u (yukarı)', dynkin: [1, 0], rootCoords: [rat(2, 3), rat(1, 3)], I3: rat(1, 2), Y: rat(1, 3), Q: rat(2, 3) },
      { name: 'd (aşağı)', dynkin: [-1, 1], rootCoords: [rat(-1, 3), rat(1, 3)], I3: rat(-1, 2), Y: rat(1, 3), Q: rat(-1, 3) },
      { name: 's (acayip)', dynkin: [0, -1], rootCoords: [rat(-1, 3), rat(-2, 3)], I3: R0, Y: rat(-2, 3), Q: rat(-1, 3) },
    ],
    changeOfBasis: {
      alphaToOmega: [[2, -1], [-1, 2]],
      omegaToAlpha: [[rat(2, 3), rat(1, 3)], [rat(1, 3), rat(2, 3)]],
      omegaToI3Y: 'I_3 = \\frac{1}{2} a_1, \\quad Y = \\frac{1}{3}(a_1 + 2a_2), \\quad T_8 = \\frac{\\sqrt{3}}{2} Y = \\frac{a_1 + 2a_2}{2\\sqrt{3}}',
      alphaToAlphaPrime: "\\alpha'_1 = \\alpha_1, \\quad \\alpha'_2 = \\frac{1}{\\sqrt{3}}(\\alpha_1 + 2\\alpha_2) = \\sqrt{3}\\,\\omega_2 \\; (\\alpha'_1 \\perp \\alpha'_2)",
    },
    bases: {
      physics: {
        title: 'Fizik (Gell-Mann / I-U-V Spin) Bazı',
        desc: 'T_a = λ_a / 2 ve I±, U±, V± merdiven operatörleri; hadron çoklularında doğrudan izospin ve hiperyük okunur.',
        generators: [
          { name: 'I₃ = T₃', latex: 'I_3 = \\frac{\\lambda_3}{2}', matrix: I3 },
          { name: 'Y = (2/√3)T₈', latex: 'Y = \\frac{2}{\\sqrt{3}}T_8', matrix: Y },
          { name: 'I₊ = T₁+iT₂', latex: 'I_+ = E_{12}', matrix: Ip },
          { name: 'I₋ = T₁-iT₂', latex: 'I_- = E_{21}', matrix: Im },
          { name: 'U₊ = T₆+iT₇', latex: 'U_+ = E_{23}', matrix: Up },
          { name: 'U₋ = T₆-iT₇', latex: 'U_- = E_{32}', matrix: Um },
          { name: 'V₊ = T₄+iT₅', latex: 'V_+ = E_{13}', matrix: Vp },
          { name: 'V₋ = T₄-iT₅', latex: 'V_- = E_{31}', matrix: Vm },
        ],
      },
      alpha: {
        title: 'α-Bazı (Basit Kök Bazı)',
        desc: 'Vektörler basit kökler α₁, α₂ cinsinden yazılır; metrik tensör Cartan matrisi A = [[2,-1],[-1,2]] olur.',
        generators: [
          { name: 'H_{α₁}', latex: 'H_{\\alpha_1} = \\operatorname{diag}(1,-1,0)', matrix: h1 },
          { name: 'H_{α₂}', latex: 'H_{\\alpha_2} = \\operatorname{diag}(0,1,-1)', matrix: h2 },
          { name: 'E_{α₁}', latex: 'E_{\\alpha_1}', matrix: e1 },
          { name: 'E_{α₂}', latex: 'E_{\\alpha_2}', matrix: e2 },
          { name: 'E_{α₁+α₂}', latex: 'E_{\\alpha_1+\\alpha_2}', matrix: e3 },
          { name: 'E_{-α₁}', latex: 'E_{-\\alpha_1}', matrix: f1 },
          { name: 'E_{-α₂}', latex: 'E_{-\\alpha_2}', matrix: f2 },
          { name: 'E_{-α₁-α₂}', latex: 'E_{-\\alpha_1-\\alpha_2}', matrix: f3 },
        ],
      },
      omega: {
        title: 'ω-Bazı (Temel Ağırlık / Dynkin Bazı)',
        desc: 'Temel ağırlıklar ω₁, ω₂ ile 2(ωᵢ, αⱼ)/|αⱼ|² = δᵢⱼ. Her ağırlığın Dynkin etiketleri (a₁, a₂) tam sayıdır; metrik G = A⁻¹.',
        generators: [
          { name: 'H_{ω₁}', latex: 'H_{\\omega_1} = \\frac{1}{3}(2h_1+h_2)', matrix: Hw1 },
          { name: 'H_{ω₂}', latex: 'H_{\\omega_2} = \\frac{1}{3}(h_1+2h_2)', matrix: Hw2 },
          { name: 'E_{α₁}', latex: 'E_{\\alpha_1}', matrix: e1 },
          { name: 'E_{α₂}', latex: 'E_{\\alpha_2}', matrix: e2 },
          { name: 'E_{α₁+α₂}', latex: 'E_{\\alpha_1+\\alpha_2}', matrix: e3 },
          { name: 'E_{-α₁}', latex: 'E_{-\\alpha_1}', matrix: f1 },
          { name: 'E_{-α₂}', latex: 'E_{-\\alpha_2}', matrix: f2 },
          { name: 'E_{-α₁-α₂}', latex: 'E_{-\\alpha_1-\\alpha_2}', matrix: f3 },
        ],
      },
      alphaPrime: {
        title: "α'-Bazı (Dikleştirilmiş Cartan Bazı)",
        desc: "Ramond Bölüm 6.4: α'₁ = α₁ ve α'₂ = (α₁ + 2α₂)/√3 birbirine diktir; Cartan üreteçleri doğrudan dik (I₃, T₈) çiftine ayrışır.",
        generators: [
          { name: "H'₁ = T₃", latex: "H'_1 = T_3 = I_3", matrix: Hap1 },
          { name: "H'₂ = T₈", latex: "H'_2 = T_8 = \\frac{\\sqrt{3}}{2}Y", matrix: Hap2 },
          { name: 'E_{α₁}', latex: 'E_{\\alpha_1}', matrix: e1 },
          { name: 'E_{α₂}', latex: 'E_{\\alpha_2}', matrix: e2 },
          { name: 'E_{α₁+α₂}', latex: 'E_{\\alpha_1+\\alpha_2}', matrix: e3 },
          { name: 'E_{-α₁}', latex: 'E_{-\\alpha_1}', matrix: f1 },
          { name: 'E_{-α₂}', latex: 'E_{-\\alpha_2}', matrix: f2 },
          { name: 'E_{-α₁-α₂}', latex: 'E_{-\\alpha_1-\\alpha_2}', matrix: f3 },
        ],
      },
      chevalley: {
        title: 'Chevalley Bazı (Tam Sayı Yapı Sabitleri)',
        desc: 'Tüm komütatör yapı sabitleri tam sayıdır: [hᵢ, eⱼ] = Aⱼᵢ eⱼ, [eᵢ, fⱼ] = δᵢⱼ hᵢ, e₃ = [e₁, e₂], f₃ = [f₂, f₁].',
        generators: [
          { name: 'h₁', latex: 'h_1', matrix: h1 },
          { name: 'h₂', latex: 'h_2', matrix: h2 },
          { name: 'e₁', latex: 'e_1', matrix: e1 },
          { name: 'e₂', latex: 'e_2', matrix: e2 },
          { name: 'e₃ = [e₁,e₂]', latex: 'e_3 = [e_1,e_2]', matrix: e3 },
          { name: 'f₁', latex: 'f_1', matrix: f1 },
          { name: 'f₂', latex: 'f_2', matrix: f2 },
          { name: 'f₃ = [f₂,f₁]', latex: 'f_3 = [f_2,f_1]', matrix: f3 },
        ],
      },
    },
  };
}

export function su3Dim(p, q) {
  return ((p + 1) * (q + 1) * (p + q + 2)) / 2;
}

export function su3WeightToI3Y(dynkin) {
  return { I3: rat(dynkin[0], 2), Y: rat(dynkin[0] + 2 * dynkin[1], 3) };
}

export function su3OscillatorShell(N) {
  // 3D isotropic harmonic oscillator: irrep (N, 0), deg = (N+1)(N+2)/2, SO(3) L = N, N-2, ..., 1 or 0
  const lList = [];
  for (let L = N; L >= 0; L -= 2) lList.push(L);
  const sumCheck = lList.reduce((s, L) => s + (2 * L + 1), 0);
  const deg = su3Dim(N, 0);
  return { N, hw: [N, 0], degeneracy: deg, energy: `${N} + 3/2`, lList, sumCheck, ok: sumCheck === deg };
}

export function elliottBranching(p, q) {
  // Exact Elliott SU(3) -> SO(3) rule (Ramond 6.7.2):
  // K = min(p,q), min(p,q)-2, ..., 1 or 0; for K=0: L = max(p,q), max(p,q)-2, ..., 1 or 0;
  // for K > 0: L = K, K+1, ..., K + max(p,q).
  const lo = Math.min(p, q), hi = Math.max(p, q);
  const bands = [];
  const lMult = new Map();
  for (let K = lo; K >= 0; K -= 2) {
    const Ls = [];
    if (K === 0) {
      for (let L = hi; L >= 0; L -= 2) Ls.push(L);
      Ls.reverse();
    } else {
      for (let L = K; L <= K + hi; L++) Ls.push(L);
    }
    bands.push({ K, Ls });
    for (const L of Ls) lMult.set(L, (lMult.get(L) || 0) + 1);
  }
  const totalDim = Array.from(lMult.entries()).reduce((s, [L, m]) => s + m * (2 * L + 1), 0);
  return { p, q, dim: su3Dim(p, q), bands, lMult, totalDim, ok: totalDim === su3Dim(p, q) };
}

export const EIGHTFOLD_WAY_MULTIPLETS = {
  baryonOctet: {
    id: 'baryonOctet',
    title: 'Baryon Sekizlisi (Jᴾ = ½⁺)',
    rep: '8 = (1, 1)',
    hw: [1, 1],
    baryonNumber: 1,
    particles: [
      { sym: 'p', latex: 'p', name: 'Proton', quarks: 'uud', I: 0.5, I3: 0.5, Y: 1, S: 0, Q: 1, mass: 938.27 },
      { sym: 'n', latex: 'n', name: 'Nötron', quarks: 'udd', I: 0.5, I3: -0.5, Y: 1, S: 0, Q: 0, mass: 939.57 },
      { sym: 'Σ⁺', latex: '\\Sigma^+', name: 'Sigma artı', quarks: 'uus', I: 1, I3: 1, Y: 0, S: -1, Q: 1, mass: 1189.37 },
      { sym: 'Σ⁰', latex: '\\Sigma^0', name: 'Sigma sıfır', quarks: 'uds (I=1)', I: 1, I3: 0, Y: 0, S: -1, Q: 0, mass: 1192.64 },
      { sym: 'Λ', latex: '\\Lambda', name: 'Lambda', quarks: 'uds (I=0)', I: 0, I3: 0, Y: 0, S: -1, Q: 0, mass: 1115.68 },
      { sym: 'Σ⁻', latex: '\\Sigma^-', name: 'Sigma eksi', quarks: 'dds', I: 1, I3: -1, Y: 0, S: -1, Q: -1, mass: 1197.45 },
      { sym: 'Ξ⁰', latex: '\\Xi^0', name: 'Ksi sıfır', quarks: 'uss', I: 0.5, I3: 0.5, Y: -1, S: -2, Q: 0, mass: 1314.86 },
      { sym: 'Ξ⁻', latex: '\\Xi^-', name: 'Ksi eksi', quarks: 'dss', I: 0.5, I3: -0.5, Y: -1, S: -2, Q: -1, mass: 1321.71 },
    ],
  },
  baryonDecuplet: {
    id: 'baryonDecuplet',
    title: 'Baryon Onlusu (Jᴾ = ³⁄₂⁺ · Ω⁻ Tahmini)',
    rep: '10 = (3, 0)',
    hw: [3, 0],
    baryonNumber: 1,
    particles: [
      { sym: 'Δ⁺⁺', latex: '\\Delta^{++}', name: 'Delta ++', quarks: 'uuu', I: 1.5, I3: 1.5, Y: 1, S: 0, Q: 2, mass: 1232 },
      { sym: 'Δ⁺', latex: '\\Delta^+', name: 'Delta +', quarks: 'uud', I: 1.5, I3: 0.5, Y: 1, S: 0, Q: 1, mass: 1232 },
      { sym: 'Δ⁰', latex: '\\Delta^0', name: 'Delta 0', quarks: 'udd', I: 1.5, I3: -0.5, Y: 1, S: 0, Q: 0, mass: 1232 },
      { sym: 'Δ⁻', latex: '\\Delta^-', name: 'Delta -', quarks: 'ddd', I: 1.5, I3: -1.5, Y: 1, S: 0, Q: -1, mass: 1232 },
      { sym: 'Σ*⁺', latex: '\\Sigma^{*+}', name: 'Sigma* +', quarks: 'uus', I: 1, I3: 1, Y: 0, S: -1, Q: 1, mass: 1382.8 },
      { sym: 'Σ*⁰', latex: '\\Sigma^{*0}', name: 'Sigma* 0', quarks: 'uds', I: 1, I3: 0, Y: 0, S: -1, Q: 0, mass: 1383.7 },
      { sym: 'Σ*⁻', latex: '\\Sigma^{*-}', name: 'Sigma* -', quarks: 'dds', I: 1, I3: -1, Y: 0, S: -1, Q: -1, mass: 1387.2 },
      { sym: 'Ξ*⁰', latex: '\\Xi^{*0}', name: 'Ksi* 0', quarks: 'uss', I: 0.5, I3: 0.5, Y: -1, S: -2, Q: 0, mass: 1531.8 },
      { sym: 'Ξ*⁻', latex: '\\Xi^{*-}', name: 'Ksi* -', quarks: 'dss', I: 0.5, I3: -0.5, Y: -1, S: -2, Q: -1, mass: 1535.0 },
      { sym: 'Ω⁻', latex: '\\Omega^-', name: 'Omega eksi (1964 keşfi)', quarks: 'sss', I: 0, I3: 0, Y: -2, S: -3, Q: -1, mass: 1672.45, highlight: true },
    ],
  },
  pseudoscalarMesons: {
    id: 'pseudoscalarMesons',
    title: 'Psödoskaler Mezon Sekizlisi (Jᴾ = 0⁻)',
    rep: '8 = (1, 1) (+ tekli η′)',
    hw: [1, 1],
    baryonNumber: 0,
    particles: [
      { sym: 'K⁺', latex: 'K^+', name: 'Kaon artı', quarks: 'u s̄', I: 0.5, I3: 0.5, Y: 1, S: 1, Q: 1, mass: 493.68 },
      { sym: 'K⁰', latex: 'K^0', name: 'Kaon sıfır', quarks: 'd s̄', I: 0.5, I3: -0.5, Y: 1, S: 1, Q: 0, mass: 497.61 },
      { sym: 'π⁺', latex: '\\pi^+', name: 'Piyon artı', quarks: 'u d̄', I: 1, I3: 1, Y: 0, S: 0, Q: 1, mass: 139.57 },
      { sym: 'π⁰', latex: '\\pi^0', name: 'Piyon sıfır', quarks: '(uū−dd̄)/√2', I: 1, I3: 0, Y: 0, S: 0, Q: 0, mass: 134.98 },
      { sym: 'η', latex: '\\eta', name: 'Eta (sekizli)', quarks: '(uū+dd̄−2ss̄)/√6', I: 0, I3: 0, Y: 0, S: 0, Q: 0, mass: 547.86 },
      { sym: 'π⁻', latex: '\\pi^-', name: 'Piyon eksi', quarks: 'd ū', I: 1, I3: -1, Y: 0, S: 0, Q: -1, mass: 139.57 },
      { sym: 'K̄⁰', latex: '\\bar{K}^0', name: 'Karşıt-Kaon sıfır', quarks: 's d̄', I: 0.5, I3: 0.5, Y: -1, S: -1, Q: 0, mass: 497.61 },
      { sym: 'K⁻', latex: 'K^-', name: 'Kaon eksi', quarks: 's ū', I: 0.5, I3: -0.5, Y: -1, S: -1, Q: -1, mass: 493.68 },
    ],
  },
  vectorMesons: {
    id: 'vectorMesons',
    title: 'Vektör Mezon Sekizlisi (Jᴾ = 1⁻)',
    rep: '8 = (1, 1) (+ tekli ω/φ karışımı)',
    hw: [1, 1],
    baryonNumber: 0,
    particles: [
      { sym: 'K*⁺', latex: 'K^{*+}', name: 'K* artı', quarks: 'u s̄', I: 0.5, I3: 0.5, Y: 1, S: 1, Q: 1, mass: 891.67 },
      { sym: 'K*⁰', latex: 'K^{*0}', name: 'K* sıfır', quarks: 'd s̄', I: 0.5, I3: -0.5, Y: 1, S: 1, Q: 0, mass: 895.55 },
      { sym: 'ρ⁺', latex: '\\rho^+', name: 'Ro artı', quarks: 'u d̄', I: 1, I3: 1, Y: 0, S: 0, Q: 1, mass: 775.26 },
      { sym: 'ρ⁰', latex: '\\rho^0', name: 'Ro sıfır', quarks: '(uū−dd̄)/√2', I: 1, I3: 0, Y: 0, S: 0, Q: 0, mass: 775.26 },
      { sym: 'φ/ω', latex: '\\phi', name: 'Fi (ağırlıklı ss̄)', quarks: 's s̄', I: 0, I3: 0, Y: 0, S: 0, Q: 0, mass: 1019.46 },
      { sym: 'ρ⁻', latex: '\\rho^-', name: 'Ro eksi', quarks: 'd ū', I: 1, I3: -1, Y: 0, S: 0, Q: -1, mass: 775.26 },
      { sym: 'K̄*⁰', latex: '\\bar{K}^{*0}', name: 'Karşıt-K* sıfır', quarks: 's d̄', I: 0.5, I3: 0.5, Y: -1, S: -1, Q: 0, mass: 895.55 },
      { sym: 'K*⁻', latex: 'K^{*-}', name: 'K* eksi', quarks: 's ū', I: 0.5, I3: -0.5, Y: -1, S: -1, Q: -1, mass: 891.67 },
    ],
  },
  quarks: {
    id: 'quarks',
    title: 'Kuark Üçlüsü 3 ve Karşıt-Üçlü 3̄',
    rep: '3 = (1, 0) & 3̄ = (0, 1)',
    hw: [1, 0],
    baryonNumber: 1 / 3,
    particles: [
      { sym: 'u', latex: 'u', name: 'Yukarı kuark', quarks: 'u', I: 0.5, I3: 0.5, Y: 1 / 3, S: 0, Q: 2 / 3, mass: 2.2 },
      { sym: 'd', latex: 'd', name: 'Aşağı kuark', quarks: 'd', I: 0.5, I3: -0.5, Y: 1 / 3, S: 0, Q: -1 / 3, mass: 4.7 },
      { sym: 's', latex: 's', name: 'Acayip kuark', quarks: 's', I: 0, I3: 0, Y: -2 / 3, S: -1, Q: -1 / 3, mass: 96 },
    ],
  },
};

export function gellMannOkuboCheck(multipletId) {
  if (multipletId === 'baryonOctet') {
    const mN = (938.27 + 939.57) / 2;
    const mXi = (1314.86 + 1321.71) / 2;
    const mLam = 1115.68;
    const mSig = (1189.37 + 1192.64 + 1197.45) / 3;
    const lhs = 2 * (mN + mXi);
    const rhs = 3 * mLam + mSig;
    const relErr = Math.abs(lhs - rhs) / rhs;
    return {
      formulaLatex: '2(m_N + m_\\Xi) = 3 m_\\Lambda + m_\\Sigma',
      lhs,
      rhs,
      unit: 'MeV',
      relErrPct: relErr * 100,
      summary: `Sol taraf = ${lhs.toFixed(1)} MeV, Sağ taraf = ${rhs.toFixed(1)} MeV (fark %${(relErr * 100).toFixed(2)})`,
    };
  }
  if (multipletId === 'baryonDecuplet') {
    const mD = 1232.0;
    const mS = (1382.8 + 1383.7 + 1387.2) / 3;
    const mX = (1531.8 + 1535.0) / 2;
    const mO = 1672.45;
    const d1 = mS - mD;
    const d2 = mX - mS;
    const d3 = mO - mX;
    const avgStep = (d1 + d2) / 2;
    const predictedOmega = mX + avgStep;
    const relErr = Math.abs(predictedOmega - mO) / mO;
    return {
      formulaLatex: 'm_{\\Sigma^*} - m_\\Delta = m_{\\Xi^*} - m_{\\Sigma^*} = m_{\\Omega^-} - m_{\\Xi^*}',
      steps: [d1, d2, d3],
      predictedOmega,
      actualOmega: mO,
      unit: 'MeV',
      relErrPct: relErr * 100,
      summary: `Adımlar: Δ→Σ* (+${d1.toFixed(1)}), Σ*→Ξ* (+${d2.toFixed(1)}), Ξ*→Ω⁻ (+${d3.toFixed(1)} MeV). Eşit aralık tahmini: ${predictedOmega.toFixed(1)} MeV (deney: ${mO} MeV, hata %${(relErr * 100).toFixed(2)}).`,
    };
  }
  if (multipletId === 'pseudoscalarMesons') {
    const mK = (493.68 + 497.61) / 2;
    const mPi = (139.57 * 2 + 134.98) / 3;
    const mEta = 547.86;
    const lhs = 4 * mK * mK;
    const rhs = 3 * mEta * mEta + mPi * mPi;
    const predictedEta = Math.sqrt((4 * mK * mK - mPi * mPi) / 3);
    const relErr = Math.abs(predictedEta - mEta) / mEta;
    return {
      formulaLatex: '4 m_K^2 = 3 m_\\eta^2 + m_\\pi^2',
      lhs,
      rhs,
      predictedEta,
      actualEta: mEta,
      unit: 'MeV²',
      relErrPct: relErr * 100,
      summary: `Tahmin m_η = ${predictedEta.toFixed(1)} MeV vs deneysel ${mEta} MeV (hata %${(relErr * 100).toFixed(2)} — η–η′ karışımı küçük sapmayı açıklar).`,
    };
  }
  return null;
}

// =====================================================================
// 13. VERMA MODULES, KOSTANT PARTITION FUNCTION & WEYL CHARACTER FORMULA
// =====================================================================

export function sl2VermaModule(lambda, maxDepth = 10) {
  const isIntDom = Number.isInteger(lambda) && lambda >= 0;
  const singularAt = isIntDom ? lambda + 1 : null;
  const levels = [];
  for (let k = 0; k <= maxDepth; k++) {
    // e * f^k v_lambda = k(lambda - k + 1) f^{k-1} v_lambda
    const eCoeff = k === 0 ? 0 : k * (lambda - k + 1);
    levels.push({
      k,
      weight: lambda - 2 * k,
      eCoeff,
      isSingular: k > 0 && Math.abs(eCoeff) < 1e-12,
      inQuotient: !isIntDom || k <= lambda,
    });
  }
  return {
    lambda,
    isFiniteQuotient: isIntDom,
    quotientDim: isIntDom ? lambda + 1 : Infinity,
    singularAt,
    singularWeight: isIntDom ? -lambda - 2 : null,
    levels,
  };
}

// Exact Kostant partition function P(n1, n2) for rank-2 algebras (counts nonnegative integer combos of positive roots)
export function kostantPartitionRank2(alg, maxN = 10) {
  if (alg.rank !== 2) throw new Error('kostantPartitionRank2 yalnızca rank 2 içindir');
  // DP over positive roots
  const table = Array.from({ length: maxN + 1 }, () => Array(maxN + 1).fill(0));
  table[0][0] = 1;
  for (const rt of alg.positiveRoots) {
    const [a, b] = rt.coords;
    for (let i = a; i <= maxN; i++) {
      for (let j = b; j <= maxN; j++) {
        table[i][j] += table[i - a][j - b];
      }
    }
  }
  return table;
}

export function vermaRank2(alg, hw, maxSteps = 5) {
  if (alg.rank !== 2) throw new Error('vermaRank2 yalnızca rank 2 içindir');
  const P = kostantPartitionRank2(alg, maxSteps);
  const ws = weightSystem(alg, hw, { maxWeights: 1200 });
  const finiteMap = new Map(ws.weights.map(w => [w.dynkin.join(','), w.mult]));
  const A = alg.cartan;

  const points = [];
  for (let n1 = 0; n1 <= maxSteps; n1++) {
    for (let n2 = 0; n2 <= maxSteps; n2++) {
      const kMult = P[n1][n2];
      if (kMult === 0) continue;
      const dynkin = [
        hw[0] - n1 * A[0][0] - n2 * A[1][0],
        hw[1] - n1 * A[0][1] - n2 * A[1][1],
      ];
      const fMult = finiteMap.get(dynkin.join(',')) || 0;
      points.push({
        n1,
        n2,
        depth: n1 + n2,
        dynkin,
        pos2D: dynkinTo2D(alg, dynkin),
        vermaMult: kMult,
        irrepMult: fMult,
        inIrrep: fMult > 0,
      });
    }
  }

  // Shifted Weyl reflections s_i . Lambda = s_i(Lambda + rho) - rho (singular vectors generating maximal submodule!)
  const lpr = [hw[0] + 1, hw[1] + 1];
  const singulars = [0, 1].map(i => {
    const ref = reflectWeight(alg, lpr, i).map(x => x - 1);
    return { gen: i + 1, dynkin: ref, pos2D: dynkinTo2D(alg, ref), step: hw[i] + 1 };
  });

  return { algId: alg.id, hw, dim: ws.dim, points, singulars };
}

export function weylCharacterFormula(alg, hw) {
  if (alg.weylOrderNum > 24) throw new Error('Weyl karakter açılımı |W| ≤ 24 için gösterilir');
  const W = weylGroupElements(alg, { maxSize: 30 });
  const rho = Array(alg.rank).fill(1);
  const lpr = hw.map(x => x + 1);
  const numTerms = W.elements.map(el => ({
    word: el.word,
    length: el.length,
    sign: el.sign,
    weight: applyWeylWord(alg, lpr, el.word),
  }));
  const denTerms = W.elements.map(el => ({
    word: el.word,
    length: el.length,
    sign: el.sign,
    weight: applyWeylWord(alg, rho, el.word),
  }));
  // Check identity: (sum_{mu in V} m(mu) e^mu) * (sum_w det(w) e^{w(rho)}) == sum_w det(w) e^{w(Lambda+rho)}
  const ws = weightSystem(alg, hw, { maxWeights: 1000 });
  const prod = new Map();
  for (const wt of ws.weights) {
    for (const dt of denTerms) {
      const s = wt.dynkin.map((v, i) => v + dt.weight[i]);
      const k = s.join(',');
      prod.set(k, (prod.get(k) || 0) + wt.mult * dt.sign);
    }
  }
  const expected = new Map(numTerms.map(t => [t.weight.join(','), t.sign]));
  let verified = true;
  for (const [k, v] of prod.entries()) {
    if ((expected.get(k) || 0) !== v) { verified = false; break; }
  }
  for (const [k, v] of expected.entries()) {
    if ((prod.get(k) || 0) !== v) { verified = false; break; }
  }
  return { algId: alg.id, hw, numTerms, denTerms, verified };
}

// =====================================================================
// 14. SERRE PRESENTATION, AFFINE KAC-MOODY & LIE SUPERALGEBRAS (CH. 10)
// =====================================================================

export function serreRelations(alg) {
  const r = alg.rank;
  const A = alg.cartan;
  const relations = [];
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < r; j++) {
      if (i === j) continue;
      // [h_i, e_j] = A_{j,i} e_j (since A_{ji} = <alpha_j, alpha_i^v>)
      // Serre relation: (ad e_i)^{1 - A_{j,i}} (e_j) = 0
      const power = 1 - A[j][i];
      relations.push({
        i: i + 1,
        j: j + 1,
        cartanEntry: A[j][i],
        power,
        connected: A[j][i] !== 0,
        latexE: power === 1
          ? `[e_{${i + 1}}, e_{${j + 1}}] = 0`
          : `(\\operatorname{ad} e_{${i + 1}})^{${power}}(e_{${j + 1}}) = 0`,
        latexF: power === 1
          ? `[f_{${i + 1}}, f_{${j + 1}}] = 0`
          : `(\\operatorname{ad} f_{${i + 1}})^{${power}}(f_{${j + 1}}) = 0`,
      });
    }
  }
  return { algId: alg.id, rank: r, relations };
}

export function affineAlgebra(type, rank) {
  const alg = getAlgebra(type, rank);
  const ext = extendedDynkin(alg);
  return { ...ext, baseAlg: alg };
}

export function sugawaraCentralCharge(type, rank, level) {
  const alg = getAlgebra(type, rank);
  const k = Math.trunc(level);
  if (k <= 0) throw new Error('Düzey k pozitif tam sayı olmalı');
  // c = k * dim(g) / (k + h^v)
  const cRat = rat(k * alg.dimension, k + alg.dualCoxeterNumber);
  return {
    algId: alg.id,
    affineLatex: `${alg.type}_{${alg.rank}}^{(1)}`,
    level: k,
    dimG: alg.dimension,
    dualCoxeter: alg.dualCoxeterNumber,
    cRat,
    cFloat: ratToNumber(cRat),
    cText: ratFormat(cRat),
    cLatex: ratLatex(cRat),
  };
}

export function integrableAffineWeights(type, rank, level, { maxCount = 60 } = {}) {
  const alg = getAlgebra(type, rank);
  const ext = extendedDynkin(alg);
  const comarks = ext.comarks; // [1, a_1^v, ..., a_r^v]
  const out = [];
  let truncated = false;
  const cur = Array(comarks.length).fill(0);

  function bt(idx, rem) {
    if (out.length >= maxCount) { truncated = true; return; }
    if (idx === comarks.length - 1) {
      if (rem % comarks[idx] === 0) {
        cur[idx] = rem / comarks[idx];
        const finiteHw = cur.slice(1);
        out.push({
          affineLabels: cur.slice(),
          lambda0: cur[0],
          finiteHw,
          finiteDim: weylDimension(alg, finiteHw),
        });
      }
      return;
    }
    const maxV = Math.floor(rem / comarks[idx]);
    for (let v = 0; v <= maxV; v++) {
      cur[idx] = v;
      bt(idx + 1, rem - v * comarks[idx]);
      if (truncated) return;
    }
  }
  bt(0, Math.trunc(level));
  return { algId: alg.id, level, count: out.length, truncated, weights: out };
}

export const SUPER_ALGEBRAS = [
  {
    id: 'A(m,n)',
    name: 'sl(m|n) / psl(n|n)',
    latex: 'A(m-1, n-1) = \\mathfrak{sl}(m|n)',
    kind: 'Temel Klasik (Tip I)',
    bosonicLatex: '\\mathfrak{sl}(m) \\oplus \\mathfrak{sl}(n) \\oplus \\mathfrak{u}(1) \\; (m\\neq n)',
    dimFormula: (m, n) => {
      const b = m === n ? 2 * (m * m - 1) : m * m + n * n - 1;
      const f = 2 * m * n;
      return { bosonic: b, fermionic: f, total: b + f, superDim: b - f };
    },
    notes: 'm = n durumunda birim matris merkezde olduğundan bölüm cebiri psl(n|n) basittir (örn. AdS₅×S⁵ için psu(2,2|4)).',
  },
  {
    id: 'B(m,n)',
    name: 'osp(2m+1|2n)',
    latex: 'B(m, n) = \\mathfrak{osp}(2m+1|2n)',
    kind: 'Temel Klasik (Tip II)',
    bosonicLatex: '\\mathfrak{so}(2m+1) \\oplus \\mathfrak{sp}(2n)',
    dimFormula: (m, n) => {
      const b = m * (2 * m + 1) + n * (2 * n + 1);
      const f = 2 * (2 * m + 1) * n;
      return { bosonic: b, fermionic: f, total: b + f, superDim: b - f };
    },
    notes: 'Ortosimplektik aile: tek boyutlu ortogonal ve simplektik bozonik kesimler; tek bir siyah (izotropik olmayan) fermiyonik köke sahiptir.',
  },
  {
    id: 'C(n)',
    name: 'osp(2|2n-2)',
    latex: 'C(n) = \\mathfrak{osp}(2|2n-2)',
    kind: 'Temel Klasik (Tip I)',
    bosonicLatex: '\\mathfrak{so}(2) \\oplus \\mathfrak{sp}(2n-2)',
    dimFormula: (m, n) => {
      const k = Math.max(1, n - 1);
      const b = 1 + k * (2 * k + 1);
      const f = 4 * k;
      return { bosonic: b, fermionic: f, total: b + f, superDim: b - f };
    },
    notes: 'n ≥ 2 için basit; bozonik parçası u(1) ⊕ sp(2n-2).',
  },
  {
    id: 'D(m,n)',
    name: 'osp(2m|2n)',
    latex: 'D(m, n) = \\mathfrak{osp}(2m|2n)',
    kind: 'Temel Klasik (Tip II)',
    bosonicLatex: '\\mathfrak{so}(2m) \\oplus \\mathfrak{sp}(2n)',
    dimFormula: (m, n) => {
      const b = m * (2 * m - 1) + n * (2 * n + 1);
      const f = 4 * m * n;
      return { bosonic: b, fermionic: f, total: b + f, superDim: b - f };
    },
    notes: 'm ≥ 2, n ≥ 1 için basit; çift boyutlu ortogonal ve simplektik alt cebirler.',
  },
  {
    id: 'D(2,1;a)',
    name: 'D(2,1; α)',
    latex: 'D(2,1;\\alpha) \\; (\\alpha \\notin \\{0,-1\\})',
    kind: 'İstisnai Süper Cebir',
    bosonicLatex: '\\mathfrak{sl}(2) \\oplus \\mathfrak{sl}(2) \\oplus \\mathfrak{sl}(2)',
    dimFormula: () => ({ bosonic: 9, fermionic: 8, total: 17, superDim: 1 }),
    notes: 'Sürekli α parametreli 1-aileli istisnai süper cebir! α = 1 için D(2,1) = osp(4|2) elde edilir.',
  },
  {
    id: 'G(3)',
    name: 'G(3)',
    latex: 'G(3)',
    kind: 'İstisnai Süper Cebir',
    bosonicLatex: 'G_2 \\oplus \\mathfrak{sl}(2)',
    dimFormula: () => ({ bosonic: 17, fermionic: 14, total: 31, superDim: 3 }),
    notes: 'Fermiyonik kesim G₂ × SL(2) altında (7, 2) olarak dönüşür (14 boyut).',
  },
  {
    id: 'F(4)',
    name: 'F(4)',
    latex: 'F(4)',
    kind: 'İstisnai Süper Cebir',
    bosonicLatex: '\\mathfrak{so}(7) \\oplus \\mathfrak{sl}(2)',
    dimFormula: () => ({ bosonic: 24, fermionic: 16, total: 40, superDim: 8 }),
    notes: 'Fermiyonik kesim SO(7) × SL(2) altında (8_s, 2) spinör çifti olarak dönüşür (16 boyut). 5B süperkonformal cebirdir.',
  },
  {
    id: 'P(n)',
    name: 'P(n) (Periplektik)',
    latex: 'P(n) \\; (n \\ge 2)',
    kind: 'Garip (Strange) Süper Cebir',
    bosonicLatex: '\\mathfrak{sl}(n+1)',
    dimFormula: (m, n) => {
      const k = Math.max(2, n);
      const b = (k + 1) * (k + 1) - 1;
      const f = (k + 1) * (k + 1);
      return { bosonic: b, fermionic: f, total: b + f, superDim: -1 };
    },
    notes: 'Killing formu özdeş sıfırdır; fermiyonik kısım Sym² ⊕ Alt²(C^{n+1}) olarak ayrışır.',
  },
  {
    id: 'Q(n)',
    name: 'Q(n) (Garip / Queer)',
    latex: 'Q(n) \\; (n \\ge 2)',
    kind: 'Garip (Strange) Süper Cebir',
    bosonicLatex: '\\mathfrak{sl}(n+1)',
    dimFormula: (m, n) => {
      const k = Math.max(2, n);
      const b = (k + 1) * (k + 1) - 1;
      return { bosonic: b, fermionic: b, total: 2 * b, superDim: 0 };
    },
    notes: 'Bozonik ve fermiyonik kısımlar eşit boyutlu (ikisi de eklenik sl(n+1)); süperboyut daima 0.',
  },
];

// Super-Dynkin diagrams for sl(m|n) and osp(M|2n) with white (bosonic), grey (isotropic odd), black (non-isotropic odd) nodes
export function superDynkinDiagram(family, m, n, mode = 'distinguished') {
  if (family === 'sl') {
    // sl(m|n) has rank m + n - 1, basis vectors eps_1..eps_m (bosonic +) and delta_1..delta_n (fermionic -)
    // Distinguished ordering: +++++...----- (one grey node at position m)
    // Alternating ordering: +-+-+-... (maximally fermionic!)
    const seq = [];
    if (mode === 'alternating') {
      let a = m, b = n;
      while (a > 0 || b > 0) {
        if (a > 0) { seq.push('+'); a--; }
        if (b > 0) { seq.push('-'); b--; }
      }
    } else {
      for (let i = 0; i < m; i++) seq.push('+');
      for (let j = 0; j < n; j++) seq.push('-');
    }
    const r = m + n - 1;
    const nodes = [];
    const edges = [];
    for (let i = 0; i < r; i++) {
      const odd = seq[i] !== seq[i + 1];
      nodes.push({
        index: i,
        label: `α${i + 1}`,
        kind: odd ? 'isotropic' : 'bosonic',
        x: i,
        y: 0,
      });
      if (i < r - 1) edges.push({ from: i, to: i + 1, mult: 1, dir: 0 });
    }
    const cartan = Array.from({ length: r }, (_, i) => Array.from({ length: r }, (_, j) => {
      if (i === j) return nodes[i].kind === 'isotropic' ? 0 : 2;
      if (Math.abs(i - j) === 1) return nodes[i].kind === 'isotropic' && j > i ? 1 : -1;
      return 0;
    }));
    const bosCount = nodes.filter(nd => nd.kind === 'bosonic').length;
    const oddCount = r - bosCount;
    return {
      title: `sl(${m}|${n}) · ${mode === 'alternating' ? 'Almaşık (tek Weyl yansıması)' : 'Ayırt Edilmiş (Distinguished)'}`,
      latex: `\\mathfrak{sl}(${m}|${n})`,
      signature: seq.join(''),
      nodes,
      edges,
      cartan,
      bosCount,
      oddCount,
    };
  }

  // osp(M|2n) distinguished super-Dynkin diagram:
  // For osp(2m+1|2n) = B(m,n): sp(2n) chain (n-1 nodes) -> grey node -> so(2m+1) tail with double arrow to short node (or black node if m=0!)
  // For osp(2m|2n) = D(m,n): sp(2n) chain (n-1 nodes) -> grey node -> so(2m) fork at the right end!
  const isOddM = m % 2 === 1;
  const k = Math.floor(m / 2); // B(k,n) or D(k,n)
  const nodes = [];
  const edges = [];
  if (isOddM) {
    // osp(2k+1 | 2n): total rank k + n
    const r = k + n;
    for (let i = 0; i < n - 1; i++) nodes.push({ index: i, label: `δ${i + 1}-δ${i + 2}`, kind: 'bosonic', x: i, y: 0 });
    if (k === 0) {
      // B(0, n) = osp(1|2n): last node is BLACK (non-isotropic fermionic root delta_n) with double arrow
      nodes.push({ index: n - 1, label: `δ${n}`, kind: 'non-isotropic', x: n - 1, y: 0 });
      for (let i = 0; i < n - 1; i++) edges.push({ from: i, to: i + 1, mult: i === n - 2 ? 2 : 1, dir: i === n - 2 ? 1 : 0 });
    } else {
      // Grey node delta_n - eps_1 at index n-1
      nodes.push({ index: n - 1, label: `δ${n}-ε1`, kind: 'isotropic', x: n - 1, y: 0 });
      for (let i = 0; i < k - 1; i++) nodes.push({ index: n + i, label: `ε${i + 1}-ε${i + 2}`, kind: 'bosonic', x: n + i, y: 0 });
      nodes.push({ index: r - 1, label: `ε${k}`, kind: 'bosonic', x: r - 1, y: 0 });
      for (let i = 0; i < r - 1; i++) {
        edges.push({ from: i, to: i + 1, mult: i === r - 2 ? 2 : 1, dir: i === r - 2 ? 1 : 0 });
      }
    }
    return {
      title: `osp(${m}|${2 * n}) = B(${k},${n})`,
      latex: `\\mathfrak{osp}(${m}|${2 * n})`,
      nodes,
      edges,
      bosCount: nodes.filter(nd => nd.kind === 'bosonic').length,
      oddCount: nodes.filter(nd => nd.kind !== 'bosonic').length,
    };
  }

  // Even M = 2k >= 2: osp(2k | 2n)
  if (k === 1) {
    // C(n+1) = osp(2|2n): grey node on left (eps_1 - delta_1), then sp(2n) chain ending with double arrow <- to long 2 delta_n
    // Special case n = 1: osp(2|2) = C(2) ~= sl(2|1) has a single bond between (eps_1 - delta_1) and 2 delta_1.
    nodes.push({ index: 0, label: 'ε1-δ1', kind: 'isotropic', x: 0, y: 0 });
    for (let i = 0; i < n - 1; i++) nodes.push({ index: i + 1, label: `δ${i + 1}-δ${i + 2}`, kind: 'bosonic', x: i + 1, y: 0 });
    if (n >= 1) nodes.push({ index: n, label: `2δ${n}`, kind: 'bosonic', x: n, y: 0 });
    for (let i = 0; i < nodes.length - 1; i++) {
      const isDouble = n >= 2 && i === nodes.length - 2;
      edges.push({ from: i, to: i + 1, mult: isDouble ? 2 : 1, dir: isDouble ? -1 : 0 });
    }
    return {
      title: `osp(2|${2 * n}) = C(${n + 1})`,
      latex: `\\mathfrak{osp}(2|${2 * n})`,
      nodes,
      edges,
      bosCount: nodes.filter(nd => nd.kind === 'bosonic').length,
      oddCount: 1,
    };
  }
  // D(k, n) with k >= 2: sp(2n) chain (n-1) -> grey (n-1) -> D_k fork
  for (let i = 0; i < n - 1; i++) nodes.push({ index: i, label: `δ${i + 1}-δ${i + 2}`, kind: 'bosonic', x: i, y: 0 });
  nodes.push({ index: n - 1, label: `δ${n}-ε1`, kind: 'isotropic', x: n - 1, y: 0 });
  for (let i = 0; i < k - 2; i++) nodes.push({ index: n + i, label: `ε${i + 1}-ε${i + 2}`, kind: 'bosonic', x: n + i, y: 0 });
  const forkBase = n + k - 2; // connects to last two nodes
  nodes.push({ index: forkBase, label: `ε${k - 1}-ε${k}`, kind: 'bosonic', x: forkBase, y: -0.75 });
  nodes.push({ index: forkBase + 1, label: `ε${k - 1}+ε${k}`, kind: 'bosonic', x: forkBase, y: 0.75 });
  for (let i = 0; i < forkBase - 1; i++) edges.push({ from: i, to: i + 1, mult: 1, dir: 0 });
  edges.push({ from: forkBase - 1, to: forkBase, mult: 1, dir: 0 });
  edges.push({ from: forkBase - 1, to: forkBase + 1, mult: 1, dir: 0 });
  return {
    title: `osp(${m}|${2 * n}) = D(${k},${n})`,
    latex: `\\mathfrak{osp}(${m}|${2 * n})`,
    nodes,
    edges,
    bosCount: nodes.filter(nd => nd.kind === 'bosonic').length,
    oddCount: 1,
  };
}

// =====================================================================
// 15. ENDLESS ENGINE-COMPUTED EXERCISE GENERATOR (ALL 4 CHAPTERS)
// =====================================================================

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeNumericOptions(correct, candidates, rng, fmt = String) {
  const seen = new Set([fmt(correct)]);
  const opts = [fmt(correct)];
  for (const cand of shuffle(candidates, rng)) {
    const s = fmt(cand);
    if (!seen.has(s)) {
      seen.add(s);
      opts.push(s);
      if (opts.length === 4) break;
    }
  }
  let bump = 1;
  while (opts.length < 4) {
    const s = fmt(typeof correct === 'bigint' ? correct + BigInt(bump++) : correct + bump++);
    if (!seen.has(s)) { seen.add(s); opts.push(s); }
  }
  const shuffled = shuffle(opts, rng);
  return { options: shuffled, answerIndex: shuffled.indexOf(fmt(correct)) };
}

export const LIE_QUIZ_TOPICS = {
  su2: ['su2_dim_casimir', 'su2_tensor', 'su2_cg', 'su11_casimir', 'bohr_so4'],
  su3: ['su3_dim', 'su3_i3y', 'su3_tensor', 'su3_eightfold', 'su3_ho'],
  lie: ['lie_alg_dim', 'lie_weyl_order', 'lie_pos_roots', 'lie_rep_dim', 'lie_young_hook', 'lie_spinor', 'lie_branching'],
  otesi: ['otesi_serre', 'otesi_sugawara', 'otesi_affine_h', 'otesi_super'],
};

export function generateLieQuizQuestion(difficulty = 'orta', rng = Math.random, chapterOrTopic = '') {
  let topic = chapterOrTopic;
  if (!topic) {
    const all = Object.values(LIE_QUIZ_TOPICS).flat();
    topic = pick(all, rng);
  } else if (LIE_QUIZ_TOPICS[topic]) {
    topic = pick(LIE_QUIZ_TOPICS[topic], rng);
  }

  if (topic === 'su2_dim_casimir') {
    const jPool = difficulty === 'kolay' ? [0.5, 1, 1.5, 2] : [0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    const j = pick(jPool, rng);
    const askCasimir = rng() > 0.45;
    if (!askCasimir) {
      const dim = Math.round(2 * j + 1);
      const { options, answerIndex } = makeNumericOptions(dim, [dim - 1, dim + 1, dim + 2, 2 * dim, Math.max(1, dim - 2)], rng);
      return {
        chapter: 'su2', type: topic, topic: 'SU(2) Spin Boyutu',
        prompt: `$SU(2)$ grubunun spin-$j = ${formatHalfInt(j)}$ indirgenemez temsilinin boyutu ($\\dim V_j$) kaçtır?`,
        options, answerIndex,
        explanation: `Spin-$j$ temsilinin $J_z$ özdeğerleri $m = -j, \\dots, +j$ olup boyutu $2j + 1 = ${dim}$'dir.`,
      };
    }
    const c2 = rat(Math.round(2 * j) * (Math.round(2 * j) + 2), 4);
    const cands = [
      rat(Math.round(2 * j) * Math.round(2 * j), 4),
      rat(Math.round(2 * j) * (Math.round(2 * j) + 4), 4),
      rat((Math.round(2 * j) + 1) * (Math.round(2 * j) + 1), 4),
      rat(Math.round(2 * j) + 2, 2),
    ];
    const { options, answerIndex } = makeNumericOptions(c2, cands, rng, x => `$${ratLatex(x)}$`);
    return {
      chapter: 'su2', type: topic, topic: 'SU(2) Casimir Özdeğeri',
      prompt: `Spin-$j = ${formatHalfInt(j)}$ temsilinde kuadratik Casimir operatörü $J^2 = J_x^2 + J_y^2 + J_z^2$'nin özdeğeri nedir?`,
      options, answerIndex,
      explanation: `$J^2 |j, m\\rangle = j(j+1)|j,m\\rangle = (${formatHalfInt(j)})(${formatHalfInt(j + 1)}) = ${ratLatex(c2)}$.`,
    };
  }

  if (topic === 'su2_tensor') {
    const pool = difficulty === 'kolay' ? [[0.5, 0.5], [1, 0.5], [1, 1]] : [[1.5, 0.5], [1.5, 1], [2, 1], [1.5, 1.5], [2, 1.5]];
    const [j1, j2] = pick(pool, rng);
    const dec = su2TensorDecomp(j1, j2);
    const correct = dec.JValues.map(formatHalfInt).join(' \\oplus ');
    const d1 = Math.round(2 * j1 + 1), d2 = Math.round(2 * j2 + 1);
    const wrong1 = dec.JValues.slice(0, -1).concat([dec.JValues[dec.JValues.length - 1] + 0.5]).map(formatHalfInt).join(' \\oplus ');
    const wrong2 = [j1 + j2, Math.abs(j1 - j2)].map(formatHalfInt).join(' \\oplus ');
    const wrong3 = dec.JValues.map(x => formatHalfInt(x + 0.5)).join(' \\oplus ');
    const raw = [correct, wrong1, wrong2, wrong3].map(s => `$${s}$`);
    const uniq = Array.from(new Set(raw));
    while (uniq.length < 4) uniq.push(`$${formatHalfInt(j1 + j2 + uniq.length)}$`);
    const opts = shuffle(uniq.slice(0, 4), rng);
    return {
      chapter: 'su2', type: topic, topic: 'SU(2) Açısal Momentum Toplamı',
      prompt: `$SU(2)$'de $j_1 = ${formatHalfInt(j1)}$ ve $j_2 = ${formatHalfInt(j2)}$ temsillerinin tensör çarpımı $j_1 \\otimes j_2$ hangi spinlere ayrışır?`,
      options: opts, answerIndex: opts.indexOf(`$${correct}$`),
      explanation: `Clebsch-Gordan serisi $|j_1 - j_2|$'den $j_1 + j_2$'ye $1$'er adımla gider: $${correct}$ (boyut kontrolü: $${d1}\\times ${d2} = ${d1 * d2}$).`,
    };
  }

  if (topic === 'su2_cg') {
    const cases = [
      [0.5, 0.5, 0.5, -0.5, 1, 0],
      [0.5, -0.5, 0.5, 0.5, 0, 0],
      [1, 1, 0.5, -0.5, 1.5, 0.5],
      [1, 0, 0.5, 0.5, 1.5, 0.5],
      [1, 1, 0.5, -0.5, 0.5, 0.5],
      [1, 0, 0.5, 0.5, 0.5, 0.5],
      [1, 1, 1, -1, 1, 0],
      [1, 1, 1, -1, 0, 0],
    ];
    const [j1, m1, j2, m2, J, M] = pick(cases, rng);
    const cg = clebschGordan(j1, m1, j2, m2, J, M);
    const pool = ['\\frac{1}{\\sqrt{2}}', '-\\frac{1}{\\sqrt{2}}', '\\frac{1}{\\sqrt{3}}', '-\\frac{1}{\\sqrt{3}}', '\\sqrt{\\frac{2}{3}}', '-\\sqrt{\\frac{2}{3}}', '\\frac{1}{2}', '0'];
    const cands = pool.filter(s => s !== cg.latex).map(s => `$${s}$`);
    const opts = shuffle([`$${cg.latex}$`, ...shuffle(cands, rng).slice(0, 3)], rng);
    return {
      chapter: 'su2', type: topic, topic: 'Clebsch-Gordan Katsayısı',
      prompt: `Condon-Shortley uzlaşımında $\\langle ${formatHalfInt(j1)},\\,${formatHalfInt(m1)};\\; ${formatHalfInt(j2)},\\,${formatHalfInt(m2)} \\mid ${formatHalfInt(J)},\\,${formatHalfInt(M)} \\rangle$ Clebsch-Gordan katsayısı nedir?`,
      options: opts, answerIndex: opts.indexOf(`$${cg.latex}$`),
      explanation: `Racah formülüyle tam hesap: $\\langle j_1 m_1; j_2 m_2 | J M \\rangle = ${cg.latex} \\approx ${cg.value.toFixed(4)}$.`,
    };
  }

  if (topic === 'su11_casimir') {
    const k = pick([0.5, 1, 1.5, 2, 2.5, 3], rng);
    const qRat = rat(Math.round(2 * k) * (Math.round(2 * k) - 2), 4);
    const cands = [
      rat(Math.round(2 * k) * (Math.round(2 * k) + 2), 4),
      rat(Math.round(2 * k) * Math.round(2 * k), 4),
      rat(-Math.round(2 * k), 2),
      rat(Math.round(2 * k) + 1, 2),
    ];
    const { options, answerIndex } = makeNumericOptions(qRat, cands, rng, x => `$${ratLatex(x)}$`);
    return {
      chapter: 'su2', type: topic, topic: 'SU(1,1) Ayrık Seri Casimir',
      prompt: `$SU(1,1)$ ayrık serisi $D^+_{k}$ ($k = ${formatHalfInt(k)}$) için kuadratik Casimir $Q = K_3^2 - K_1^2 - K_2^2$ özdeğeri kaçtır?`,
      options, answerIndex,
      explanation: `Ayrık seride $Q = k(k - 1) = (${formatHalfInt(k)})(${formatHalfInt(k - 1)}) = ${ratLatex(qRat)}$ (kompakt $SU(2)$'deki $+j(j+1)$ yerine eksi işaretine dikkat!).`,
    };
  }

  if (topic === 'bohr_so4') {
    const n = pick([2, 3, 4, 5, 6], rng);
    const b = bohrAtomSO4(n);
    const { options, answerIndex } = makeNumericOptions(b.degeneracy, [2 * n, n * (n + 1), n * (n - 1), 2 * n * n, n * n + 1], rng);
    return {
      chapter: 'su2', type: topic, topic: 'Bohr Atomu SO(4) Simetrisi',
      prompt: `Hidrojen atomunun $n = ${n}$ baş kuantum düzeyinde $SO(4) \\cong SU(2)_+ \\times SU(2)_-$ gizli simetrisinin öngördüğü yörünge dejenereliği (spinsiz) kaçtır?`,
      options, answerIndex,
      explanation: `$j_+ = j_- = (n-1)/2 = ${formatHalfInt(b.jPlus)}$ için temsil boyutu $(2j_+ + 1)(2j_- + 1) = n^2 = ${b.degeneracy}$ ($\\ell = ${b.lValues.join(', ')}$).`,
    };
  }

  if (topic === 'su3_dim') {
    const pool = difficulty === 'kolay' ? [[1, 0], [0, 1], [2, 0], [1, 1], [3, 0]] : [[2, 1], [2, 2], [4, 0], [3, 1], [3, 2], [4, 1]];
    const [p, q] = pick(pool, rng);
    const dim = su3Dim(p, q);
    const { options, answerIndex } = makeNumericOptions(dim, [dim + 3, dim - 2, (p + 1) * (q + 1), dim + p + q + 1, Math.max(1, dim - 4)], rng);
    return {
      chapter: 'su3', type: topic, topic: 'SU(3) Temsil Boyutu',
      prompt: `$SU(3)$'te Dynkin etiketleri $(p, q) = (${p}, ${q})$ olan indirgenemez temsilin boyutu kaçtır?`,
      options, answerIndex,
      explanation: `$\\dim(p, q) = \\frac{1}{2}(p+1)(q+1)(p+q+2) = \\frac{1}{2}(${p + 1})(${q + 1})(${p + q + 2}) = ${dim}$.`,
    };
  }

  if (topic === 'su3_i3y') {
    const weights = [[1, 0], [-1, 1], [0, -1], [2, -1], [-1, 2], [1, 1], [3, 0], [0, 2]];
    const w = pick(weights, rng);
    const { I3, Y } = su3WeightToI3Y(w);
    const ans = `$(I_3, Y) = (${ratLatex(I3)},\\; ${ratLatex(Y)})$`;
    const cands = [
      `$(I_3, Y) = (${ratLatex(ratNeg(I3))},\\; ${ratLatex(Y)})$`,
      `$(I_3, Y) = (${ratLatex(I3)},\\; ${ratLatex(ratNeg(Y))})$`,
      `$(I_3, Y) = (${ratLatex(rat(w[1], 2))},\\; ${ratLatex(rat(2 * w[0] + w[1], 3))})$`,
      `$(I_3, Y) = (${ratLatex(rat(w[0] + w[1], 2))},\\; ${ratLatex(rat(w[0] - w[1], 3))})$`,
    ];
    const uniq = [ans, ...cands.filter(x => x !== ans)];
    const opts = shuffle(uniq.slice(0, 4), rng);
    return {
      chapter: 'su3', type: topic, topic: 'SU(3) Ağırlık → (I₃, Y)',
      prompt: `$SU(3)$'te Dynkin etiketleri $(a_1, a_2) = (${w[0]}, ${w[1]})$ olan bir ağırlığın izospin $I_3$ ve hiperyük $Y$ değerleri nedir?`,
      options: opts, answerIndex: opts.indexOf(ans),
      explanation: `$I_3 = \\frac{a_1}{2} = ${ratLatex(I3)}$ ve $Y = \\frac{a_1 + 2a_2}{3} = ${ratLatex(Y)}$.`,
    };
  }

  if (topic === 'su3_tensor') {
    const pairs = [
      { a: [1, 0], b: [1, 0], la: '\\mathbf{3}', lb: '\\mathbf{3}' },
      { a: [1, 0], b: [0, 1], la: '\\mathbf{3}', lb: '\\bar{\\mathbf{3}}' },
      { a: [1, 0], b: [1, 1], la: '\\mathbf{3}', lb: '\\mathbf{8}' },
      { a: [2, 0], b: [0, 1], la: '\\mathbf{6}', lb: '\\bar{\\mathbf{3}}' },
      { a: [1, 1], b: [1, 1], la: '\\mathbf{8}', lb: '\\mathbf{8}' },
    ];
    const item = pick(pairs, rng);
    const A2 = getAlgebra('A', 2);
    const tp = tensorProduct(A2, item.a, item.b);
    const fmtTerms = terms => terms.map(t => (t.mult > 1 ? `${t.mult}\\cdot ${t.dim}` : `${t.dim}`)).join(' \\oplus ');
    const ans = `$${fmtTerms(tp.terms)}$`;
    const distractors = [
      '$6 \\oplus 3 \\oplus 1$',
      '$8 \\oplus 6 \\oplus 3$',
      '$10 \\oplus 8 \\oplus 1$',
      '$27 \\oplus 10 \\oplus 8 \\oplus 1$',
      '$15 \\oplus 6 \\oplus 3$',
      '$15 \\oplus 3$',
      '$8 \\oplus 1$',
      '$6 \\oplus 3$',
    ].filter(s => s !== ans);
    const opts = shuffle([ans, ...shuffle(distractors, rng).slice(0, 3)], rng);
    return {
      chapter: 'su3', type: topic, topic: 'SU(3) Tensör Çarpımı',
      prompt: `$SU(3)$'te $${item.la} \\otimes ${item.lb}$ tensör çarpımının boyut cinsinden ayrışımı hangisidir?`,
      options: opts, answerIndex: opts.indexOf(ans),
      explanation: `Brauer-Klimyk ayrışımı: $${item.la} \\otimes ${item.lb} = ${fmtTerms(tp.terms)}$ (toplam boyut: $${tp.totalDim}$).`,
    };
  }

  if (topic === 'su3_eightfold') {
    const allP = [...EIGHTFOLD_WAY_MULTIPLETS.baryonOctet.particles, ...EIGHTFOLD_WAY_MULTIPLETS.baryonDecuplet.particles];
    const p = pick(allP, rng);
    const qStr = p.Q > 0 ? `+${p.Q}` : String(p.Q);
    const { options, answerIndex } = makeNumericOptions(p.Q, [-2, -1, 0, 1, 2], rng, v => (v > 0 ? `+${v}` : String(v)));
    return {
      chapter: 'su3', type: topic, topic: 'Sekizli Yol & Gell-Mann-Nishijima',
      prompt: `Kuark içeriği **${p.quarks}**, izospini $I_3 = ${formatHalfInt(p.I3)}$ ve hiperyükü $Y = ${p.Y}$ olan $${p.latex}$ (${p.name}) hadronunun elektrik yükü $Q$ kaçtır?`,
      options, answerIndex,
      explanation: `Gell-Mann-Nishijima formülü: $Q = I_3 + \\frac{Y}{2} = ${formatHalfInt(p.I3)} + \\frac{${p.Y}}{2} = ${qStr}$.`,
    };
  }

  if (topic === 'su3_ho') {
    const N = pick([1, 2, 3, 4, 5], rng);
    const sh = su3OscillatorShell(N);
    const { options, answerIndex } = makeNumericOptions(sh.degeneracy, [N + 1, N * N, (N + 1) * (N + 1), sh.degeneracy + 2, sh.degeneracy - 1], rng);
    return {
      chapter: 'su3', type: topic, topic: '3B İzotropik Harmonik Salınıcı',
      prompt: `3B izotropik harmonik salınıcının $N = ${N}$ kuantum kabuğu $SU(3)$'ün $(${N}, 0)$ temsilinde yer alır. Bu düzeyin dejenereliği kaçtır?`,
      options, answerIndex,
      explanation: `$\\dim(${N}, 0) = \\frac{(N+1)(N+2)}{2} = ${sh.degeneracy}$; açısal momentum içeriği $L = ${sh.lList.join(', ')}$.`,
    };
  }

  if (topic === 'lie_alg_dim') {
    const pool = difficulty === 'kolay'
      ? [['A', 2], ['A', 3], ['A', 4], ['B', 2], ['B', 3], ['D', 4], ['G', 2]]
      : [['B', 4], ['C', 4], ['D', 5], ['F', 4], ['E', 6], ['E', 7], ['E', 8]];
    const [T, r] = pick(pool, rng);
    const alg = getAlgebra(T, r);
    const { options, answerIndex } = makeNumericOptions(alg.dimension, [alg.dimension + r, alg.dimension - r, alg.dimension + 2, alg.numPositiveRoots * 2, alg.dimension + 6], rng);
    return {
      chapter: 'lie', type: topic, topic: 'Lie Cebiri Boyutu',
      prompt: `$${alg.latex}$ ($${alg.compactLatex}$) basit Lie cebirinin boyutu $\\dim(${alg.latex})$ kaçtır?`,
      options, answerIndex,
      explanation: `$\\dim(${alg.latex}) = r + 2|\\Delta^+| = ${alg.rank} + 2\\cdot ${alg.numPositiveRoots} = ${alg.dimension}$.`,
    };
  }

  if (topic === 'lie_weyl_order') {
    const pool = difficulty === 'kolay'
      ? [['A', 2], ['A', 3], ['B', 2], ['B', 3], ['G', 2]]
      : [['A', 4], ['D', 4], ['F', 4], ['E', 6], ['E', 7], ['E', 8]];
    const [T, r] = pick(pool, rng);
    const alg = getAlgebra(T, r);
    const w = alg.weylOrderNum;
    const { options, answerIndex } = makeNumericOptions(w, [w * 2, Math.max(2, Math.round(w / 2)), w + alg.dimension, Math.round(w * 1.5), w * 3], rng, v => v.toLocaleString('tr-TR'));
    return {
      chapter: 'lie', type: topic, topic: 'Weyl Grubu Mertebesi',
      prompt: `$${alg.latex}$ basit Lie cebirinin Weyl grubunun mertebesi $|W(${alg.latex})|$ kaçtır?`,
      options, answerIndex,
      explanation: `Üsler $m = (${alg.exponents.join(', ')})$ olduğundan $|W| = \\prod (m_i + 1) = ${w.toLocaleString('tr-TR')}$.`,
    };
  }

  if (topic === 'lie_pos_roots') {
    const pool = [['A', 3], ['A', 4], ['B', 3], ['C', 3], ['D', 4], ['D', 5], ['G', 2], ['F', 4], ['E', 6], ['E', 7], ['E', 8]];
    const [T, r] = pick(pool, rng);
    const alg = getAlgebra(T, r);
    const p = alg.numPositiveRoots;
    const { options, answerIndex } = makeNumericOptions(p, [p * 2, p + r, Math.max(1, p - r), p + 4, Math.max(1, p - 2)], rng);
    return {
      chapter: 'lie', type: topic, topic: 'Pozitif Kök Sayısı',
      prompt: `$${alg.latex}$ kök sisteminde kaç tane pozitif kök ($|\\Delta^+|$) vardır?`,
      options, answerIndex,
      explanation: `$|\\Delta^+| = \\frac{\\dim(${alg.latex}) - r}{2} = \\frac{${alg.dimension} - ${alg.rank}}{2} = ${p}$ (ve üslerin toplamı $\\sum m_i = ${p}$).`,
    };
  }

  if (topic === 'lie_rep_dim') {
    const cases = [
      ['A', 3, [0, 1, 0], 'A_3'],
      ['B', 2, [0, 1], 'B_2'],
      ['B', 2, [1, 0], 'B_2'],
      ['D', 5, [0, 0, 0, 0, 1], 'D_5 = \\mathfrak{so}(10)'],
      ['D', 5, [1, 0, 0, 0, 0], 'D_5 = \\mathfrak{so}(10)'],
      ['G', 2, [0, 1], 'G_2'],
      ['F', 4, [0, 0, 0, 1], 'F_4'],
      ['E', 6, [1, 0, 0, 0, 0, 0], 'E_6'],
      ['E', 7, [0, 0, 0, 0, 0, 1, 0], 'E_7'],
      ['E', 8, [0, 0, 0, 0, 0, 0, 1, 0], 'E_8'],
    ];
    const [T, r, hw, lbl] = pick(cases, rng);
    const alg = getAlgebra(T, r);
    const dim = Number(weylDimension(alg, hw));
    const { options, answerIndex } = makeNumericOptions(dim, [dim + r, Math.max(2, dim - r), dim * 2, alg.dimension, dim + 10], rng);
    return {
      chapter: 'lie', type: topic, topic: 'Weyl Boyut Formülü',
      prompt: `$${lbl}$ cebirinde en yüksek ağırlığı $\\Lambda = (${hw.join(',')})$ olan indirgenemez temsilin boyutu kaçtır?`,
      options, answerIndex,
      explanation: `Weyl boyut formülü $\\prod_{\\alpha>0} \\frac{(\\Lambda+\\rho,\\alpha)}{(\\rho,\\alpha)} = ${dim}$ verir.`,
    };
  }

  if (topic === 'lie_young_hook') {
    const cases = [
      [3, [2, 0]], [3, [2, 1]], [4, [1, 1]], [4, [2, 0]], [4, [2, 1]], [5, [1, 1]], [5, [2, 0]],
    ];
    const [N, part] = pick(cases, rng);
    const y = youngHooksAndContents(part, N);
    const dim = Number(y.dim);
    const { options, answerIndex } = makeNumericOptions(dim, [dim + N, Math.max(2, dim - 2), dim * 2, N * (N - 1), dim + 3], rng);
    return {
      chapter: 'lie', type: topic, topic: 'Young Tablosu Kanca-İçerik',
      prompt: `$SU(${N})$ için satır uzunlukları $[${part.filter(Boolean).join(', ')}]$ olan Young diyagramının temsil boyutu kaçtır?`,
      options, answerIndex,
      explanation: `Kanca-içerik formülü: $\\dim = \\frac{${y.numerator}}{${y.denominator}} = ${dim}$ (Dynkin etiketleri $(${y.dynkin.join(',')})$).`,
    };
  }

  if (topic === 'lie_spinor') {
    const d = pick([6, 7, 8, 9, 10, 11, 12], rng);
    const sp = spinorInfo(d);
    const { options, answerIndex } = makeNumericOptions(sp.spinorDim, [sp.spinorDim * 2, Math.max(2, sp.spinorDim / 2), d, d * 2, sp.spinorDim + 4], rng);
    return {
      chapter: 'lie', type: topic, topic: 'SO(d) Spinör Boyutu',
      prompt: `$SO(${d})$ grubunun temel indirgenemez ${sp.isEven ? 'kiral Weyl' : 'Dirac'} spinör temsilinin boyutu kaçtır?`,
      options, answerIndex,
      explanation: sp.isEven
        ? `$SO(2n)$ ($n=${sp.n}$) için iki kiral Weyl spinörü $S_+, S_-$ vardır; her birinin boyutu $2^{n-1} = ${sp.spinorDim}$ (${sp.realityTr}).`
        : `$SO(2n+1)$ ($n=${sp.n}$) için tek indirgenemez spinör temsilinin boyutu $2^n = ${sp.spinorDim}$ (${sp.realityTr}).`,
    };
  }

  if (topic === 'lie_branching') {
    const items = [
      { q: '$SO(10) \\supset SU(5)$ altında $\\mathbf{16}$ spinör temsili nasıl dallanır?', a: '$\\mathbf{10} \\oplus \\bar{\\mathbf{5}} \\oplus \\mathbf{1}$', w: ['$\\mathbf{15} \\oplus \\mathbf{1}$', '$\\mathbf{10} \\oplus \\mathbf{5} \\oplus \\mathbf{1}$', '$\\mathbf{8} \\oplus \\mathbf{5} \\oplus \\mathbf{3}$'], e: '$SO(10) \\supset SU(5) \\times U(1)_X$: $\\mathbf{16} = \\mathbf{10}_{+1} \\oplus \\bar{\\mathbf{5}}_{-3} \\oplus \\mathbf{1}_{+5}$ (boyut: $10+5+1=16$).' },
      { q: '$E_6 \\supset SO(10)$ altında temel $\\mathbf{27}$ temsili nasıl dallanır?', a: '$\\mathbf{16} \\oplus \\mathbf{10} \\oplus \\mathbf{1}$', w: ['$\\mathbf{16} \\oplus \\mathbf{11}$', '$\\mathbf{24} \\oplus \\mathbf{3}$', '$\\mathbf{15} \\oplus \\mathbf{10} \\oplus \\mathbf{2}$'], e: '$E_6 \\supset SO(10) \\times U(1)_\\psi$: $\\mathbf{27} = \\mathbf{16}_{+1} \\oplus \\mathbf{10}_{-2} \\oplus \\mathbf{1}_{+4}$ ($16+10+1=27$).' },
      { q: '$G_2 \\supset SU(3)$ altında temel $\\mathbf{7}$ temsili nasıl dallanır?', a: '$\\mathbf{3} \\oplus \\bar{\\mathbf{3}} \\oplus \\mathbf{1}$', w: ['$\\mathbf{6} \\oplus \\mathbf{1}$', '$\\mathbf{3} \\oplus \\mathbf{3} \\oplus \\mathbf{1}$', '$\\mathbf{4} \\oplus \\mathbf{3}$'], e: '$G_2$ kısa kök $\\alpha_2$ silinerek $SU(3)$ elde edilir; $\\mathbf{7} = \\mathbf{3} \\oplus \\bar{\\mathbf{3}} \\oplus \\mathbf{1}$.' },
      { q: '$SU(5) \\supset SU(3)_C \\times SU(2)_L \\times U(1)_Y$ altında $\\mathbf{10}$ nasıl dallanır?', a: '$(\\mathbf{3},\\mathbf{2}) \\oplus (\\bar{\\mathbf{3}},\\mathbf{1}) \\oplus (\\mathbf{1},\\mathbf{1})$', w: ['$\\mathbf{(3,2)} \\oplus \\mathbf{(1,4)}$', '$(\\mathbf{3},\\mathbf{1}) \\oplus (\\mathbf{1},\\mathbf{2})$', '$(\\mathbf{8},\\mathbf{1}) \\oplus (\\mathbf{1},\\mathbf{2})$'], e: 'Antisimetrik $\\mathbf{10} = \\Lambda^2(\\mathbf{5})$: $(3,2)_{+1/6} \\oplus (\\bar{3},1)_{-2/3} \\oplus (1,1)_{+1}$ ($6+3+1=10$).' },
    ];
    const it = pick(items, rng);
    const opts = shuffle([it.a, ...it.w], rng);
    return { chapter: 'lie', type: topic, topic: 'GUT Dallanma Kuralları', prompt: it.q, options: opts, answerIndex: opts.indexOf(it.a), explanation: it.e };
  }

  if (topic === 'otesi_serre') {
    const cases = [
      ['A', 2, 0, 1], ['B', 2, 0, 1], ['B', 2, 1, 0], ['G', 2, 0, 1], ['G', 2, 1, 0],
    ];
    const [T, r, i, j] = pick(cases, rng);
    const alg = getAlgebra(T, r);
    const pow = 1 - alg.cartan[j][i];
    const { options, answerIndex } = makeNumericOptions(pow, [1, 2, 3, 4, 5], rng);
    return {
      chapter: 'otesi', type: topic, topic: 'Serre Bağıntısı Üssü',
      prompt: `$${alg.latex}$ cebirinde $(\\operatorname{ad} e_{${i + 1}})^{m}(e_{${j + 1}}) = 0$ Serre bağıntısındaki en küçük $m = 1 - A_{${j + 1},${i + 1}}$ tam sayısı kaçtır?`,
      options, answerIndex,
      explanation: `Cartan matrisi öğesi $A_{${j + 1},${i + 1}} = ${alg.cartan[j][i]}$ olduğundan $m = 1 - (${alg.cartan[j][i]}) = ${pow}$.`,
    };
  }

  if (topic === 'otesi_sugawara') {
    const cases = [['A', 1, 1], ['A', 1, 2], ['A', 2, 1], ['A', 2, 2], ['G', 2, 1], ['F', 4, 1], ['E', 8, 1], ['E', 6, 1]];
    const [T, r, k] = pick(cases, rng);
    const sc = sugawaraCentralCharge(T, r, k);
    const cands = [
      rat(k * sc.dimG, k + sc.dualCoxeter + 1),
      rat(k * sc.dimG, k + getAlgebra(T, r).coxeterNumber + 2),
      rat((k + 1) * sc.dimG, k + sc.dualCoxeter),
      rat(sc.dimG, sc.dualCoxeter),
    ];
    const { options, answerIndex } = makeNumericOptions(sc.cRat, cands, rng, x => `$${ratLatex(x)}$`);
    return {
      chapter: 'otesi', type: topic, topic: 'Sugawara Merkezi Yükü',
      prompt: `$${sc.affineLatex}$ afin Kac-Moody cebirinin $k = ${k}$ düzeyindeki Sugawara Virasoro merkezi yükü $c = \\frac{k\\dim\\mathfrak{g}}{k + h^\\vee}$ nedir?`,
      options, answerIndex,
      explanation: `$\\dim(${T}_${r}) = ${sc.dimG}$ ve $h^\\vee = ${sc.dualCoxeter}$ olduğundan $c = \\frac{${k}\\cdot ${sc.dimG}}{${k} + ${sc.dualCoxeter}} = ${sc.cLatex}$.`,
    };
  }

  if (topic === 'otesi_affine_h') {
    const pool = [['A', 3], ['B', 3], ['C', 3], ['D', 4], ['G', 2], ['F', 4], ['E', 6], ['E', 7], ['E', 8]];
    const [T, r] = pick(pool, rng);
    const alg = getAlgebra(T, r);
    const hv = alg.dualCoxeterNumber;
    const { options, answerIndex } = makeNumericOptions(hv, [alg.coxeterNumber + 1, hv + 2, Math.max(2, hv - 1), hv + 4, r + 2], rng);
    return {
      chapter: 'otesi', type: topic, topic: 'İkili Coxeter Sayısı h^∨',
      prompt: `$${alg.type}_{${alg.rank}}^{(1)}$ afin Kac-Moody cebirinin ikili Coxeter sayısı $h^\\vee = \\sum_{i=0}^r a_i^\\vee$ kaçtır?`,
      options, answerIndex,
      explanation: `Eş-işaretler (comarks) $(1, ${alg.comarks.join(', ')})$ olup toplamları $h^\\vee = ${hv}$ (Coxeter sayısı $h = ${alg.coxeterNumber}$).`,
    };
  }

  // otesi_super
  const scases = [
    { name: '\\mathfrak{sl}(2|1)', m: 2, n: 1, s: SUPER_ALGEBRAS[0] },
    { name: '\\mathfrak{sl}(3|2)', m: 3, n: 2, s: SUPER_ALGEBRAS[0] },
    { name: '\\mathfrak{osp}(3|2)', m: 1, n: 1, s: SUPER_ALGEBRAS[1] },
    { name: 'G(3)', m: 0, n: 0, s: SUPER_ALGEBRAS[5] },
    { name: 'F(4)', m: 0, n: 0, s: SUPER_ALGEBRAS[6] },
    { name: 'D(2,1;\\alpha)', m: 0, n: 0, s: SUPER_ALGEBRAS[4] },
  ];
  const pickS = pick(scases, rng);
  const dims = pickS.s.dimFormula(pickS.m, pickS.n);
  const { options, answerIndex } = makeNumericOptions(dims.fermionic, [dims.bosonic, dims.total, dims.fermionic + 2, Math.max(2, dims.fermionic - 2)], rng);
  return {
    chapter: 'otesi', type: 'otesi_super', topic: 'Lie Süper Cebiri Boyutu',
    prompt: `$${pickS.name}$ basit Lie süper cebirinin fermiyonik (tek) kesiminin boyutu $\\dim \\mathfrak{g}_{\\bar{1}}$ kaçtır?`,
    options, answerIndex,
    explanation: `Bozonik alt cebir $${pickS.s.bosonicLatex}$ boyut $${dims.bosonic}$, fermiyonik kesim boyut $${dims.fermionic}$ (toplam $${dims.total}$, süperboyut $${dims.superDim}$).`,
  };
}
