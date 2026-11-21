// MathPad Finite Group Representation Theory & Advanced Finite Groups Engine.
// Pure ES module, zero DOM dependencies. Covers Pierre Ramond Chapters 2 (extensions), 3, 9, 11.7 & Appendix 1.
import {
  gcd,
  lcm,
  primeFactors,
  divisors,
  cyclic,
  dihedral,
  symmetric,
  alternating,
  kleinFour,
  quaternion,
  unitGroup,
  directProduct,
  cubeRotations,
  dicyclic,
  binaryTetrahedral,
  binaryOctahedral,
  binaryIcosahedral,
  frobeniusT7,
  psl2_7,
  gl3_2,
  sl,
  gl,
  psl,
  delta3n2,
  delta6n2,
  hessian216,
  semiDirect,
  elemLatex,
  order,
  elementOrders,
  orders,
  isAbelian,
  isCyclic,
  exponent,
  generate,
  subgroups,
  isNormal,
  conjugacyClasses,
  center,
  centralizer,
  normalizer,
  commutatorSubgroup,
  quotient,
  subgroupAsGroup,
  identifyGroup,
  extendHomomorphism,
  isHomomorphism,
  permToCycles,
  cycleType,
} from './group.js';

const REP_CACHE = new WeakMap();
const repCacheOf = G => {
  let c = REP_CACHE.get(G);
  if (!c) { c = Object.create(null); REP_CACHE.set(G, c); }
  return c;
};

// ---------- Complex arithmetic helpers ----------

export const C = {
  of: (re, im = 0) => ({ re, im }),
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  scale: (a, s) => ({ re: a.re * s, im: a.im * s }),
  conj: a => ({ re: a.re, im: -a.im }),
  abs2: a => a.re * a.re + a.im * a.im,
  abs: a => Math.hypot(a.re, a.im),
  div: (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  },
  expI: theta => ({ re: Math.cos(theta), im: Math.sin(theta) }),
};

// ---------- Exact algebraic number recognition & KaTeX formatting ----------

const roundInt = x => {
  const r = Math.round(x);
  return r === 0 ? 0 : r;
};

const QUAD_RADS = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

function fmtSignedInt(k) { return k >= 0 ? `+${k}` : String(k); }

function fmtRootTerm(b, d, isImag) {
  const absB = Math.abs(b);
  const coeff = absB === 1 ? '' : String(absB);
  const iPart = isImag ? 'i' : '';
  const radT = d === 1 ? '' : `√${d}`;
  const radL = d === 1 ? '' : `\\sqrt{${d}}`;
  const coreT = d === 1 && !isImag ? String(absB) : (d === 1 ? `${coeff}i` : `${coeff}${iPart}${radT}`);
  const coreL = d === 1 && !isImag ? String(absB) : (d === 1 ? `${coeff}i` : `${coeff}${iPart}${radL}`);
  return { coreT, coreL };
}

export function recognizeAlgebraic(re, im, maxOrder = 24) {
  const TOL = 1e-5;
  if (Math.abs(re) < 1e-9) re = 0;
  if (Math.abs(im) < 1e-9) im = 0;

  // 1. Integers
  if (Math.abs(im) < TOL) {
    const r = roundInt(re);
    if (Math.abs(re - r) < TOL) {
      return { re: r, im: 0, exact: true, text: String(r), latex: String(r) };
    }
    // Half-integers
    const h = roundInt(re * 2);
    if (Math.abs(re - h / 2) < TOL) {
      return { re: h / 2, im: 0, exact: true, text: `${h}/2`, latex: `\\tfrac{${h}}{2}` };
    }
  }

  // 2. Pure imaginary integers / half-integers
  if (Math.abs(re) < TOL) {
    const r = roundInt(im);
    if (Math.abs(im - r) < TOL && r !== 0) {
      const s = r === 1 ? 'i' : r === -1 ? '-i' : `${r}i`;
      return { re: 0, im: r, exact: true, text: s, latex: s };
    }
  }

  // 3. Cube roots of unity ω = e^{2πi/3} and integer multiples k·ω, k·ω² (Ramond Ch. 3 convention)
  const S3 = Math.sqrt(3);
  for (let k = -6; k <= 6; k++) {
    if (k === 0) continue;
    // k * ω = k * (-1/2 + i√3/2)
    if (Math.abs(re - (-k / 2)) < TOL && Math.abs(im - (k * S3 / 2)) < TOL) {
      const pre = k === 1 ? '' : k === -1 ? '-' : String(k);
      return {
        re: -k / 2, im: k * S3 / 2, exact: true,
        text: `${pre}ω`, latex: `${pre}\\omega`,
        legend: { sym: '\\omega', def: 'e^{2\\pi i/3} = \\tfrac{-1+i\\sqrt{3}}{2}' },
      };
    }
    // k * ω² = k * (-1/2 - i√3/2)
    if (Math.abs(re - (-k / 2)) < TOL && Math.abs(im - (-k * S3 / 2)) < TOL) {
      const pre = k === 1 ? '' : k === -1 ? '-' : String(k);
      return {
        re: -k / 2, im: -k * S3 / 2, exact: true,
        text: `${pre}ω²`, latex: `${pre}\\omega^{2}`,
        legend: { sym: '\\omega', def: 'e^{2\\pi i/3} = \\tfrac{-1+i\\sqrt{3}}{2}' },
      };
    }
  }

  // 4. Real quadratic irrationals (a + b√d) / c for c ∈ {1, 2}
  if (Math.abs(im) < TOL) {
    for (const d of QUAD_RADS) {
      const sq = Math.sqrt(d);
      for (const c of [1, 2]) {
        const v = re * c;
        for (let b = -6; b <= 6; b++) {
          if (b === 0) continue;
          const a = Math.round(v - b * sq);
          if (Math.abs(a) <= 12 && Math.abs(v - (a + b * sq)) < TOL * c) {
            if (c === 2 && a % 2 === 0 && b % 2 === 0) continue;
            const exactRe = (a + b * sq) / c;
            const { coreT, coreL } = fmtRootTerm(b, d, false);
            const sign = b > 0 ? (a === 0 ? '' : '+') : '-';
            const numT = a === 0 ? `${sign}${coreT}` : `${a}${sign}${coreT}`;
            const numL = a === 0 ? `${sign}${coreL}` : `${a}${sign}${coreL}`;
            const text = c === 1 ? numT : `(${numT})/2`;
            const latex = c === 1 ? numL : `\\tfrac{${numL}}{2}`;
            return { re: exactRe, im: 0, exact: true, text, latex };
          }
        }
      }
    }
  }

  // 5. Imaginary quadratic irrationals (a + b i √d) / c for c ∈ {1, 2} (covers (-1 ± i√7)/2, ±i√2, ±i√3, 1±i, etc.)
  for (const d of [1, 2, 3, 5, 6, 7, 11, 13, 15]) {
    const sq = Math.sqrt(d);
    for (const c of [1, 2]) {
      const a = Math.round(re * c);
      if (Math.abs(re * c - a) >= TOL * c || Math.abs(a) > 12) continue;
      const b = Math.round((im * c) / sq);
      if (b === 0 || Math.abs(b) > 6) continue;
      if (Math.abs(im * c - b * sq) >= TOL * c) continue;
      if (c === 2 && a % 2 === 0 && b % 2 === 0) continue;
      const exactRe = a / c, exactIm = (b * sq) / c;
      const { coreT, coreL } = fmtRootTerm(b, d, true);
      const sign = b > 0 ? (a === 0 ? '' : '+') : '-';
      const numT = a === 0 ? `${sign}${coreT}` : `${a}${sign}${coreT}`;
      const numL = a === 0 ? `${sign}${coreL}` : `${a}${sign}${coreL}`;
      const text = c === 1 ? numT : `(${numT})/2`;
      const latex = c === 1 ? numL : `\\tfrac{${numL}}{2}`;
      return { re: exactRe, im: exactIm, exact: true, text, latex };
    }
  }

  // 6. Single roots of unity (or integer multiples k · ζ_m^r) for m | maxOrder or small m
  const mCandidates = [];
  const capM = Math.min(Math.max(maxOrder, 12), 60);
  for (let m = 4; m <= capM; m++) {
    if (maxOrder % m === 0 || m <= 12) mCandidates.push(m);
  }
  const rAbs = Math.hypot(re, im);
  const kScale = Math.round(rAbs);
  if (kScale >= 1 && kScale <= 6 && Math.abs(rAbs - kScale) < TOL) {
    let angle = Math.atan2(im, re) / (2 * Math.PI);
    if (angle < 0) angle += 1;
    for (const m of mCandidates) {
      const num = Math.round(angle * m);
      if (Math.abs(angle * m - num) < 1e-4) {
        const g = gcd(num % m, m);
        const mm = m / g;
        const rr = (num % m) / g;
        if (mm === 1) continue;
        const th = (2 * Math.PI * rr) / mm;
        const exactRe = kScale * Math.cos(th);
        const exactIm = kScale * Math.sin(th);
        const pre = kScale === 1 ? '' : String(kScale);
        if (mm === 8 && kScale === 1) {
          const sx = exactRe >= 0 ? '' : '-';
          const sy = exactIm >= 0 ? '+' : '-';
          return {
            re: exactRe, im: exactIm, exact: true,
            text: `(${sx}1${sy}i)/√2`, latex: `\\tfrac{${sx}1${sy}i}{\\sqrt{2}}`,
          };
        }
        const powL = rr === 1 ? '' : `^{${rr}}`;
        const powT = rr === 1 ? '' : `^${rr}`;
        return {
          re: exactRe, im: exactIm, exact: true,
          text: `${pre}ζ_${mm}${powT}`,
          latex: `${pre}\\zeta_{${mm}}${powL}`,
          legend: { sym: `\\zeta_{${mm}}`, def: `e^{2\\pi i/${mm}}` },
        };
      }
    }
  }

  // 7. Real cyclotomic values ±2cos(2πk/m) (for D_n, Q_{2n})
  if (Math.abs(im) < TOL) {
    for (const m of mCandidates) {
      for (let k = 1; k < m / 2; k++) {
        if (gcd(k, m) !== 1) continue;
        const val = 2 * Math.cos((2 * Math.PI * k) / m);
        if (Math.abs(re - val) < TOL) {
          const frac = k === 1 ? `\\frac{2\\pi}{${m}}` : `\\frac{${2 * k}\\pi}{${m}}`;
          const fracShort = (2 * k) % 2 === 0 && m % 2 === 0
            ? (k === 1 ? `\\frac{\\pi}{${m / 2}}` : `\\frac{${k}\\pi}{${m / 2}}`)
            : frac;
          return {
            re: val, im: 0, exact: true,
            text: `2cos(${2 * k}π/${m})`,
            latex: `2\\cos(${fracShort})`,
          };
        }
        if (Math.abs(re + val) < TOL) {
          const fracShort = m % 2 === 0
            ? (k === 1 ? `\\frac{\\pi}{${m / 2}}` : `\\frac{${k}\\pi}{${m / 2}}`)
            : (k === 1 ? `\\frac{2\\pi}{${m}}` : `\\frac{${2 * k}\\pi}{${m}}`);
          return {
            re: -val, im: 0, exact: true,
            text: `-2cos(${2 * k}π/${m})`,
            latex: `-2\\cos(${fracShort})`,
          };
        }
      }
    }
  }

  // Fallback decimal formatting
  const rStr = Math.abs(re) < 1e-4 ? '' : re.toFixed(3).replace(/\.?0+$/, '');
  const iStr = Math.abs(im) < 1e-4 ? '' : `${im >= 0 && rStr ? '+' : ''}${im.toFixed(3).replace(/\.?0+$/, '')}i`;
  const txt = (rStr + iStr) || '0';
  return { re, im, exact: false, text: txt, latex: txt };
}

// ---------- Hermitian Jacobi Eigensolver (for simultaneous diagonalization of normal class matrices) ----------

function hermitianJacobi(reMat, imMat) {
  const n = reMat.length;
  const Hre = reMat.map(r => Float64Array.from(r));
  const Him = imMat.map(r => Float64Array.from(r));
  const Vre = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n); row[i] = 1; return row;
  });
  const Vim = Array.from({ length: n }, () => new Float64Array(n));

  const maxSweeps = 120;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let maxOff = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const a = Hre[p][q], b = Him[p][q];
        const rho = Math.hypot(a, b);
        if (rho > maxOff) maxOff = rho;
        if (rho < 1e-14) continue;

        const cp = a / rho, sp = b / rho; // e^{iφ} = cp + i sp
        const hpp = Hre[p][p], hqq = Hre[q][q];
        const tau = (hqq - hpp) / (2 * rho);
        const t = tau >= 0
          ? 1 / (tau + Math.hypot(1, tau))
          : -1 / (-tau + Math.hypot(1, tau));
        const c = 1 / Math.hypot(1, t);
        const s = t * c;

        // Update diagonal and zero (p, q)
        Hre[p][p] = hpp - t * rho;
        Hre[q][q] = hqq + t * rho;
        Him[p][p] = 0;
        Him[q][q] = 0;
        Hre[p][q] = 0; Him[p][q] = 0;
        Hre[q][p] = 0; Him[q][p] = 0;

        // s * e^{-iφ} = (s*cp) + i(-s*sp);  s * e^{iφ} = (s*cp) + i(s*sp)
        const scp = s * cp, ssp = s * sp;

        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const hkpR = Hre[k][p], hkpI = Him[k][p];
          const hkqR = Hre[k][q], hkqI = Him[k][q];

          // H'[k][p] = c * H[k][p] - (s e^{-iφ}) * H[k][q]
          const nkpR = c * hkpR - (scp * hkqR + ssp * hkqI);
          const nkpI = c * hkpI - (scp * hkqI - ssp * hkqR);
          // H'[k][q] = (s e^{iφ}) * H[k][p] + c * H[k][q]
          const nkqR = (scp * hkpR - ssp * hkpI) + c * hkqR;
          const nkqI = (scp * hkpI + ssp * hkpR) + c * hkqI;

          Hre[k][p] = nkpR; Him[k][p] = nkpI;
          Hre[p][k] = nkpR; Him[p][k] = -nkpI;
          Hre[k][q] = nkqR; Him[k][q] = nkqI;
          Hre[q][k] = nkqR; Him[q][k] = -nkqI;
        }

        // Accumulate eigenvectors V <- V U
        for (let k = 0; k < n; k++) {
          const vkpR = Vre[k][p], vkpI = Vim[k][p];
          const vkqR = Vre[k][q], vkqI = Vim[k][q];
          Vre[k][p] = c * vkpR - (scp * vkqR + ssp * vkqI);
          Vim[k][p] = c * vkpI - (scp * vkqI - ssp * vkqR);
          Vre[k][q] = (scp * vkpR - ssp * vkpI) + c * vkqR;
          Vim[k][q] = (scp * vkpI + ssp * vkpR) + c * vkqI;
        }
      }
    }
    if (maxOff < 1e-13) break;
  }

  const eigenvalues = new Array(n);
  const eigenvectors = new Array(n);
  for (let col = 0; col < n; col++) {
    eigenvalues[col] = Hre[col][col];
    const vec = new Array(n);
    for (let row = 0; row < n; row++) {
      vec[row] = { re: Vre[row][col], im: Vim[row][col] };
    }
    eigenvectors[col] = vec;
  }
  return { eigenvalues, eigenvectors };
}

// ---------- Class multiplication coefficients & conjugacy structure ----------

export function conjugacyStructure(G) {
  const c = repCacheOf(G);
  if (c.conjStruct) return c.conjStruct;

  const n = G.size;
  const eo = elementOrders(G);
  const raw = conjugacyClasses(G);

  // Canonical ordering: {e} first, then by (element order, class size, min element index)
  raw.sort((a, b) => {
    const aE = a.includes(G.e) ? 0 : 1;
    const bE = b.includes(G.e) ? 0 : 1;
    if (aE !== bE) return aE - bE;
    const oa = eo[a[0]], ob = eo[b[0]];
    if (oa !== ob) return oa - ob;
    if (a.length !== b.length) return a.length - b.length;
    return a[0] - b[0];
  });

  const r = raw.length;
  const classOf = new Int32Array(n);
  const classes = raw.map((elems, ci) => {
    for (const g of elems) classOf[g] = ci;
    const rep = elems[0];
    return {
      index: ci,
      elements: elems,
      rep,
      size: elems.length,
      order: eo[rep],
      centralizerOrder: n / elems.length,
      label: G.elements[rep],
      latex: elemLatex(G, rep),
    };
  });

  const invClass = new Int32Array(r);
  const sqClass = new Int32Array(r);
  for (let i = 0; i < r; i++) {
    const g = classes[i].rep;
    invClass[i] = classOf[G.inv(g)];
    sqClass[i] = classOf[G.mul(g, g)];
  }

  // Class multiplication coefficients N[i][j][k]: K_i * K_j = sum_k N[i][j][k] K_k
  // Computed in O(r * |G|): for fixed z_k in C_k, count x in G with x in C_i and x^{-1} z_k in C_j.
  const N = Array.from({ length: r }, () =>
    Array.from({ length: r }, () => new Int32Array(r))
  );
  for (let k = 0; k < r; k++) {
    const zk = classes[k].rep;
    for (let x = 0; x < n; x++) {
      const i = classOf[x];
      const j = classOf[G.mul(G.inv(x), zk)];
      N[i][j][k]++;
    }
  }

  const out = { classes, classOf, invClass, sqClass, classMult: N };
  c.conjStruct = out;
  return out;
}

export function classMultiplicationTable(G) {
  const { classes, classMult } = conjugacyStructure(G);
  const r = classes.length;
  const rows = [];
  for (let i = 0; i < r; i++) {
    for (let j = i; j < r; j++) {
      const terms = [];
      for (let k = 0; k < r; k++) {
        const coeff = classMult[i][j][k];
        if (coeff > 0) terms.push({ classIndex: k, coeff });
      }
      rows.push({ i, j, terms });
    }
  }
  return { classes, classMult, rows };
}

// ---------- Character Table Computation (Abelian Exact + Burnside-Dixon Hermitian Simultaneous Diagonalization) ----------

function abelianCharacterRows(G, cs) {
  const n = G.size;
  if (n === 1) return [[C.of(1, 0)]];

  const eo = elementOrders(G);
  const pFactors = primeFactors(n);
  const basis = []; // { gen, ord }

  for (const [p, totalExp] of pFactors) {
    const pMax = p ** totalExp;
    const sylowElems = [];
    for (let g = 0; g < n; g++) {
      if (pMax % eo[g] === 0) sylowElems.push(g);
    }
    let K = [G.e];
    let inK = new Uint8Array(n);
    inK[G.e] = 1;

    while (K.length < sylowElems.length) {
      // Find element x in sylowElems with maximum relative order p^m modulo K
      let bestX = -1, bestRelOrd = 1;
      for (const x of sylowElems) {
        if (inK[x]) continue;
        let cur = x, relOrd = 1;
        while (!inK[cur]) {
          // raise to power p
          let next = G.e;
          for (let t = 0; t < p; t++) next = G.mul(next, cur);
          cur = next;
          relOrd *= p;
        }
        if (relOrd > bestRelOrd) {
          bestRelOrd = relOrd;
          bestX = x;
        }
      }
      // Compute bestX^{bestRelOrd} ∈ K and find y ∈ K with y^{bestRelOrd} = bestX^{bestRelOrd}
      const powElem = (a, exp) => {
        let res = G.e, base = a, e = exp;
        while (e > 0) {
          if (e & 1) res = G.mul(res, base);
          base = G.mul(base, base);
          e >>= 1;
        }
        return res;
      };
      const target = powElem(bestX, bestRelOrd);
      let adjust = G.e;
      if (target !== G.e) {
        for (const y of K) {
          if (powElem(y, bestRelOrd) === target) { adjust = y; break; }
        }
      }
      const gen = G.mul(bestX, G.inv(adjust));
      basis.push({ gen, ord: bestRelOrd });
      const newK = [];
      const newInK = new Uint8Array(n);
      let gPow = G.e;
      for (let t = 0; t < bestRelOrd; t++) {
        for (const k of K) {
          const prod = G.mul(k, gPow);
          if (!newInK[prod]) { newInK[prod] = 1; newK.push(prod); }
        }
        gPow = G.mul(gPow, gen);
      }
      K = newK;
      inK = newInK;
    }
  }

  // Assign coordinates to every element in G
  const d = basis.length;
  const coords = new Array(n);
  const curCoord = new Int32Array(d);
  function fillCoords(idx, elem) {
    if (idx === d) {
      coords[elem] = Array.from(curCoord);
      return;
    }
    let cur = elem;
    const { gen, ord } = basis[idx];
    for (let t = 0; t < ord; t++) {
      curCoord[idx] = t;
      fillCoords(idx + 1, cur);
      cur = G.mul(cur, gen);
    }
  }
  fillCoords(0, G.e);

  // Enumerate all dual tuples (a_0, ..., a_{d-1})
  const rows = [];
  const aTuple = new Int32Array(d);
  function fillChars(idx) {
    if (idx === d) {
      const row = new Array(n);
      for (let ci = 0; ci < cs.classes.length; ci++) {
        const g = cs.classes[ci].rep;
        const cg = coords[g];
        let phase = 0;
        for (let k = 0; k < d; k++) phase += (aTuple[k] * cg[k]) / basis[k].ord;
        row[ci] = C.expI(2 * Math.PI * phase);
      }
      rows.push(row);
      return;
    }
    for (let a = 0; a < basis[idx].ord; a++) {
      aTuple[idx] = a;
      fillChars(idx + 1);
    }
  }
  fillChars(0);
  return rows;
}

function burnsideDixonRows(G, cs) {
  const { classes, classMult } = cs;
  const r = classes.length;
  const n = G.size;
  if (r === 1) return [[C.of(1, 0)]];

  const sqrtH = classes.map(cl => Math.sqrt(cl.size));

  // Build normalized commuting normal matrices M~_i: (M~_i)_{j, k} = (sqrt(h_k) / sqrt(h_j)) * N[i][j][k]
  const Mtilde = new Array(r);
  for (let i = 0; i < r; i++) {
    const mat = Array.from({ length: r }, () => new Float64Array(r));
    for (let j = 0; j < r; j++) {
      const invSj = 1 / sqrtH[j];
      for (let k = 0; k < r; k++) {
        const val = classMult[i][j][k];
        if (val !== 0) mat[j][k] = val * sqrtH[k] * invSj;
      }
    }
    Mtilde[i] = mat;
  }

  // Deterministic PRNG for random Hermitian linear combinations of A_i = (M_i + M_i^T)/2 and B_i = (M_i - M_i^T)/(2i)
  let seed = 0x517cc1b7 ^ (n * 2654435761);
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  // Start with full basis = identity (columns are basis vectors)
  let basis = Array.from({ length: r }, (_, col) =>
    Array.from({ length: r }, (__, row) => C.of(row === col ? 1 : 0, 0))
  );

  // Project Hermitian linear combination onto a subspace spanned by `vecs` and split it
  function splitSubspace(vecs, attempt = 0) {
    const m = vecs.length;
    if (m <= 1) return vecs;

    // Build random real weights for Hermitian parts A_i (real sym) and B_i (imag skew -> Hermitian)
    const wA = new Float64Array(r);
    const wB = new Float64Array(r);
    for (let i = 1; i < r; i++) {
      wA[i] = rand();
      wB[i] = rand();
    }
    // Construct H_full = sum_i (wA[i] * A_i + wB[i] * B_i)
    // Note: (A_i)_{jk} = 0.5*(M_i[j][k] + M_i[k][j]) (real)
    //       (B_i)_{jk} = -0.5i * (M_i[j][k] - M_i[k][j]) (purely imaginary, skew-symmetric -> Hermitian!)
    const HreFull = Array.from({ length: r }, () => new Float64Array(r));
    const HimFull = Array.from({ length: r }, () => new Float64Array(r));
    for (let i = 1; i < r; i++) {
      const Mi = Mtilde[i];
      const ca = 0.5 * wA[i], cb = -0.5 * wB[i];
      for (let j = 0; j < r; j++) {
        for (let k = j; k < r; k++) {
          const mjk = Mi[j][k], mkj = Mi[k][j];
          const reAdd = ca * (mjk + mkj);
          const imAdd = cb * (mjk - mkj);
          HreFull[j][k] += reAdd;
          HreFull[k][j] = HreFull[j][k];
          HimFull[j][k] += imAdd;
          HimFull[k][j] = -HimFull[j][k];
        }
      }
    }

    // Project H_sub = V^* H_full V (m x m Hermitian)
    // First compute HV[a][row] = (H_full * vecs[a])[row]
    const HV = vecs.map(v => {
      const out = new Array(r);
      for (let row = 0; row < r; row++) {
        let re = 0, im = 0;
        const hR = HreFull[row], hI = HimFull[row];
        for (let k = 0; k < r; k++) {
          re += hR[k] * v[k].re - hI[k] * v[k].im;
          im += hR[k] * v[k].im + hI[k] * v[k].re;
        }
        out[row] = { re, im };
      }
      return out;
    });

    const subRe = Array.from({ length: m }, () => new Float64Array(m));
    const subIm = Array.from({ length: m }, () => new Float64Array(m));
    for (let a = 0; a < m; a++) {
      for (let b = a; b < m; b++) {
        let re = 0, im = 0;
        const va = vecs[a], hvb = HV[b];
        for (let k = 0; k < r; k++) {
          re += va[k].re * hvb[k].re + va[k].im * hvb[k].im;
          im += va[k].re * hvb[k].im - va[k].im * hvb[k].re;
        }
        subRe[a][b] = re;
        subRe[b][a] = re;
        subIm[a][b] = a === b ? 0 : im;
        subIm[b][a] = a === b ? 0 : -im;
      }
    }

    const { eigenvalues, eigenvectors } = hermitianJacobi(subRe, subIm);

    // Rotate basis vectors into the new eigenbasis
    const orderIdx = Array.from({ length: m }, (_, i) => i).sort((a, b) => eigenvalues[a] - eigenvalues[b]);
    const rotated = orderIdx.map(idx => {
      const coeff = eigenvectors[idx];
      const vec = new Array(r);
      for (let row = 0; row < r; row++) {
        let re = 0, im = 0;
        for (let a = 0; a < m; a++) {
          re += vecs[a][row].re * coeff[a].re - vecs[a][row].im * coeff[a].im;
          im += vecs[a][row].re * coeff[a].im + vecs[a][row].im * coeff[a].re;
        }
        vec[row] = { re, im };
      }
      // Renormalize
      let norm2 = 0;
      for (let row = 0; row < r; row++) norm2 += vec[row].re * vec[row].re + vec[row].im * vec[row].im;
      const invNorm = 1 / Math.sqrt(norm2);
      for (let row = 0; row < r; row++) { vec[row].re *= invNorm; vec[row].im *= invNorm; }
      return { val: eigenvalues[idx], vec };
    });

    // Group near-degenerate eigenvalues and recursively split if needed
    const finalVecs = [];
    let start = 0;
    while (start < m) {
      let end = start + 1;
      while (end < m && Math.abs(rotated[end].val - rotated[end - 1].val) < 1e-4) end++;
      const cluster = rotated.slice(start, end).map(x => x.vec);
      if (cluster.length > 1 && attempt < 12) {
        finalVecs.push(...splitSubspace(cluster, attempt + 1));
      } else {
        finalVecs.push(...cluster);
      }
      start = end;
    }
    return finalVecs;
  }

  const eigenVecs = splitSubspace(basis, 0);

  // Extract character rows using Rayleigh quotient ω_i = u^* M~_i u and d = round(|u_0| * sqrt(|G|))
  const rows = eigenVecs.map(u => {
    const d = Math.max(1, Math.round(C.abs(u[0]) * Math.sqrt(n)));
    const row = new Array(r);
    row[0] = C.of(d, 0);
    for (let i = 1; i < r; i++) {
      const Mi = Mtilde[i];
      let re = 0, im = 0;
      for (let j = 0; j < r; j++) {
        // (Mi * u)_j
        let mRe = 0, mIm = 0;
        const rowM = Mi[j];
        for (let k = 0; k < r; k++) {
          const val = rowM[k];
          if (val !== 0) {
            mRe += val * u[k].re;
            mIm += val * u[k].im;
          }
        }
        re += u[j].re * mRe + u[j].im * mIm;
        im += u[j].re * mIm - u[j].im * mRe;
      }
      const scale = d / classes[i].size;
      row[i] = C.of(re * scale, im * scale);
    }
    return row;
  });

  return rows;
}

// Compute and cache the full exact character table of any finite group G (order <= 240).
export function characterTable(G) {
  const c = repCacheOf(G);
  if (c.charTable) return c.charTable;

  const cs = conjugacyStructure(G);
  const { classes, classOf, invClass, sqClass } = cs;
  const r = classes.length;
  const n = G.size;
  const expG = exponent(G);

  const rawRows = isAbelian(G) ? abelianCharacterRows(G, cs) : burnsideDixonRows(G, cs);

  // Clean & recognize exact algebraic values
  const legends = new Map();
  const parsed = rawRows.map(row => {
    const entries = row.map(v => {
      const alg = recognizeAlgebraic(v.re, v.im, expG);
      if (alg.legend && !legends.has(alg.legend.sym)) {
        legends.set(alg.legend.sym, alg.legend.def);
      }
      return alg;
    });
    const dim = roundInt(entries[0].re);
    const values = entries.map(e => C.of(e.re, e.im));

    // Frobenius-Schur indicator: (1/|G|) sum_j h_j chi(g_j^2)
    let fsRe = 0;
    for (let j = 0; j < r; j++) fsRe += classes[j].size * values[sqClass[j]].re;
    const fsIndicator = roundInt(fsRe / n);
    const fsType = fsIndicator === 1 ? 'real' : fsIndicator === -1 ? 'pseudoreal' : 'complex';
    const fsLabel = fsIndicator === 1 ? 'Gerçek (+1)' : fsIndicator === -1 ? 'Sözde-gerçek (−1)' : 'Karmaşık (0)';

    // Kernel: elements g with chi(g) == dim
    const kernelClasses = [];
    const kernelElements = [];
    for (let j = 0; j < r; j++) {
      if (Math.abs(values[j].re - dim) < 1e-4 && Math.abs(values[j].im) < 1e-4) {
        kernelClasses.push(j);
        kernelElements.push(...classes[j].elements);
      }
    }
    kernelElements.sort((a, b) => a - b);
    const isTrivial = kernelElements.length === n;
    const isFaithful = kernelElements.length === 1;
    const isReal = values.every(v => Math.abs(v.im) < 1e-5);

    return {
      dim,
      values,
      entries,
      fsIndicator,
      fsType,
      fsLabel,
      kernelClasses,
      kernelElements,
      isTrivial,
      isFaithful,
      isReal,
    };
  });

  // Sort deterministically: trivial first, then by dimension, real before complex, conjugate pairs grouped together
  const rowKey = ir => ir.values.map(v => `${Math.round(v.re * 1000)}:${Math.round(v.im * 1000)}`).join('|');
  const conjKey = ir => ir.values.map(v => `${Math.round(v.re * 1000)}:${Math.round(-v.im * 1000)}`).join('|');

  parsed.sort((a, b) => {
    if (a.isTrivial !== b.isTrivial) return a.isTrivial ? -1 : 1;
    if (a.dim !== b.dim) return a.dim - b.dim;
    if (a.isReal !== b.isReal) return a.isReal ? -1 : 1;
    for (let j = 1; j < r; j++) {
      const dr = b.values[j].re - a.values[j].re;
      if (Math.abs(dr) > 1e-4) return dr;
      const di = b.values[j].im - a.values[j].im;
      if (Math.abs(di) > 1e-4) return di;
    }
    return 0;
  });

  // Group complex conjugate pairs right next to each other
  const ordered = [];
  const used = new Uint8Array(r);
  for (let i = 0; i < r; i++) {
    if (used[i]) continue;
    used[i] = 1;
    ordered.push(parsed[i]);
    if (!parsed[i].isReal) {
      const ck = conjKey(parsed[i]);
      for (let j = i + 1; j < r; j++) {
        if (!used[j] && rowKey(parsed[j]) === ck) {
          used[j] = 1;
          ordered.push(parsed[j]);
          break;
        }
      }
    }
  }

  // Assign physicist-friendly Ramond labels (1, 1', 1'', 2, 3, 3̄, etc.) & conjugate index links
  const byDimCount = new Map();
  const keyToIdx = new Map(ordered.map((ir, idx) => [rowKey(ir), idx]));
  for (let idx = 0; idx < r; idx++) {
    const ir = ordered[idx];
    ir.index = idx;
    const cjIdx = keyToIdx.get(conjKey(ir));
    ir.conjugateIndex = cjIdx != null ? cjIdx : idx;
  }

  const dimGroups = new Map();
  for (const ir of ordered) {
    if (!dimGroups.has(ir.dim)) dimGroups.set(ir.dim, []);
    dimGroups.get(ir.dim).push(ir);
  }
  const labeled = new Uint8Array(r);
  for (const [dim, group] of dimGroups.entries()) {
    const distinctCount = group.filter(ir => ir.conjugateIndex >= ir.index).length;
    let slot = 0;
    for (const ir of group) {
      if (labeled[ir.index]) continue;
      slot++;
      const needSub = distinctCount > 1;
      const primes = slot === 1 ? '' : slot === 2 ? "'" : slot === 3 ? "''" : `_{${slot}}`;
      const primesT = slot === 1 ? '' : slot === 2 ? "'" : slot === 3 ? "''" : `_${slot}`;
      const suffixL = !needSub ? '' : (distinctCount <= 3 ? primes : `_{${slot}}`);
      const suffixT = !needSub ? '' : (distinctCount <= 3 ? primesT : `_${slot}`);
      ir.name = `${dim}${suffixT}`;
      ir.latex = `\\mathbf{${dim}}${suffixL}`;
      labeled[ir.index] = 1;
      if (ir.conjugateIndex !== ir.index && !labeled[ir.conjugateIndex]) {
        const cj = ordered[ir.conjugateIndex];
        cj.name = `${dim}̄${suffixT}`;
        cj.latex = `\\bar{\\mathbf{${dim}}}${suffixL}`;
        labeled[cj.index] = 1;
      }
    }
    byDimCount.set(dim, group.length);
  }

  // Orthogonality & dimension sum-of-squares verification
  let rowOrthoMaxErr = 0;
  for (let i = 0; i < r; i++) {
    for (let j = i; j < r; j++) {
      let re = 0, im = 0;
      for (let k = 0; k < r; k++) {
        const a = ordered[i].values[k], b = ordered[j].values[k];
        re += classes[k].size * (a.re * b.re + a.im * b.im);
        im += classes[k].size * (a.re * b.im - a.im * b.re);
      }
      re /= n; im /= n;
      const err = Math.hypot(re - (i === j ? 1 : 0), im);
      if (err > rowOrthoMaxErr) rowOrthoMaxErr = err;
    }
  }

  let colOrthoMaxErr = 0;
  for (let i = 0; i < r; i++) {
    for (let j = i; j < r; j++) {
      let re = 0, im = 0;
      for (let a = 0; a < r; a++) {
        const x = ordered[a].values[i], y = ordered[a].values[j];
        re += x.re * y.re + x.im * y.im;
        im += x.re * y.im - x.im * y.re;
      }
      const target = i === j ? classes[i].centralizerOrder : 0;
      const err = Math.hypot(re - target, im);
      if (err > colOrthoMaxErr) colOrthoMaxErr = err;
    }
  }

  const dimSquaresSum = ordered.reduce((s, ir) => s + ir.dim * ir.dim, 0);
  const allDivideOrder = ordered.every(ir => n % ir.dim === 0);

  const ct = {
    groupName: G.name,
    groupLatex: G.latex,
    order: n,
    classCount: r,
    classes,
    classOf,
    invClass,
    sqClass,
    irreps: ordered,
    legends: Array.from(legends.entries()).map(([sym, def]) => ({ sym, def })),
    checks: {
      dimSquaresSum,
      dimSquaresOk: dimSquaresSum === n,
      allDivideOrder,
      rowOrthoMaxErr,
      rowOrthoOk: rowOrthoMaxErr < 1e-4,
      colOrthoMaxErr,
      colOrthoOk: colOrthoMaxErr < 1e-4,
      ok: dimSquaresSum === n && allDivideOrder && rowOrthoMaxErr < 1e-4 && colOrthoMaxErr < 1e-4,
    },
  };
  c.charTable = ct;
  return ct;
}

// Compute inner product <chiA, chiB> = (1/|G|) sum_k h_k conj(chiA[k]) * chiB[k]
export function characterInnerProduct(ct, chiA, chiB) {
  let re = 0, im = 0;
  for (let k = 0; k < ct.classCount; k++) {
    const h = ct.classes[k].size;
    const a = chiA[k], b = chiB[k];
    re += h * (a.re * b.re + a.im * b.im);
    im += h * (a.re * b.im - a.im * b.re);
  }
  return C.of(re / ct.order, im / ct.order);
}

// Decompose any class function (array of complex values on conjugacy classes of G) into irreps
export function decomposeCharacter(G, values) {
  const ct = characterTable(G);
  const terms = [];
  let dimSum = 0;
  for (let i = 0; i < ct.irreps.length; i++) {
    const ip = characterInnerProduct(ct, ct.irreps[i].values, values);
    const mult = roundInt(ip.re);
    if (mult > 0) {
      terms.push({ irrepIndex: i, irrep: ct.irreps[i], mult });
      dimSum += mult * ct.irreps[i].dim;
    }
  }
  const latex = terms.length
    ? terms.map(t => (t.mult > 1 ? `${t.mult}\\,${t.irrep.latex}` : t.irrep.latex)).join(' \\oplus ')
    : '0';
  const text = terms.length
    ? terms.map(t => (t.mult > 1 ? `${t.mult}·${t.irrep.name}` : t.irrep.name)).join(' ⊕ ')
    : '0';
  return { terms, dimSum, latex, text };
}

// ---------- Kronecker Products, Symmetric & Antisymmetric Squares, Tensor Powers ----------

export function kroneckerProduct(G, i, j) {
  const ct = characterTable(G);
  const a = ct.irreps[i], b = ct.irreps[j];
  const values = a.values.map((v, k) => C.mul(v, b.values[k]));
  const decomp = decomposeCharacter(G, values);
  return {
    left: a,
    right: b,
    dim: a.dim * b.dim,
    values,
    entries: values.map(v => recognizeAlgebraic(v.re, v.im, exponent(G))),
    ...decomp,
  };
}

export function symmetricAndAntisymmetricSquares(G, i) {
  const ct = characterTable(G);
  const ir = ct.irreps[i];
  const symVals = new Array(ct.classCount);
  const altVals = new Array(ct.classCount);
  for (let k = 0; k < ct.classCount; k++) {
    const chi2 = C.mul(ir.values[k], ir.values[k]);
    const chiSq = ir.values[ct.sqClass[k]];
    symVals[k] = C.scale(C.add(chi2, chiSq), 0.5);
    altVals[k] = C.scale(C.sub(chi2, chiSq), 0.5);
  }
  const sym = decomposeCharacter(G, symVals);
  const alt = decomposeCharacter(G, altVals);
  return {
    irrep: ir,
    symmetric: { dim: (ir.dim * (ir.dim + 1)) / 2, values: symVals, ...sym },
    antisymmetric: { dim: (ir.dim * (ir.dim - 1)) / 2, values: altVals, ...alt },
    invariantInSym: sym.terms.some(t => t.irrep.isTrivial),
    invariantInAlt: alt.terms.some(t => t.irrep.isTrivial),
  };
}

export function tensorPowerDecomp(G, i, power) {
  const ct = characterTable(G);
  const ir = ct.irreps[i];
  const values = ir.values.map(v => {
    let acc = C.of(1, 0);
    for (let p = 0; p < power; p++) acc = C.mul(acc, v);
    return acc;
  });
  const decomp = decomposeCharacter(G, values);
  return { irrep: ir, power, dim: ir.dim ** power, values, ...decomp };
}

// ---------- Restriction (Embeddings / Branching Rules) & Induction (Frobenius Reciprocity) ----------

export function restrictionAndInduction(G, HElements) {
  const ctG = characterTable(G);
  const H = subgroupAsGroup(G, HElements);
  const ctH = characterTable(H);
  const parentOf = H.meta.elementsInParent; // parentOf[hIdx] = gIdx in G

  // Restrict every irrep of G to H
  const restrictions = ctG.irreps.map(irG => {
    const valsH = ctH.classes.map(clH => {
      const gRep = parentOf[clH.rep];
      return irG.values[ctG.classOf[gRep]];
    });
    const decomp = decomposeCharacter(H, valsH);
    return {
      irrepG: irG,
      valuesOnH: valsH,
      ...decomp,
    };
  });

  // Induce every irrep of H to G: Ind(psi)(C_k^G) = (|G| / (|H| * |C_k^G|)) * sum_{h in H, parentOf[h] in C_k^G} psi(h)
  const indexGH = G.size / H.size;
  const inductions = ctH.irreps.map(irH => {
    const sums = Array.from({ length: ctG.classCount }, () => C.of(0, 0));
    for (let h = 0; h < H.size; h++) {
      const g = parentOf[h];
      const ckG = ctG.classOf[g];
      const valH = irH.values[ctH.classOf[h]];
      sums[ckG] = C.add(sums[ckG], valH);
    }
    const valsG = sums.map((s, k) => C.scale(s, indexGH / ctG.classes[k].size));
    const decomp = decomposeCharacter(G, valsG);
    return {
      irrepH: irH,
      dim: indexGH * irH.dim,
      valuesOnG: valsG,
      entries: valsG.map(v => recognizeAlgebraic(v.re, v.im, exponent(G))),
      ...decomp,
    };
  });

  // Frobenius reciprocity check: <Ind(psi_j), chi_i>_G == <psi_j, Res(chi_i)>_H
  const resMatrix = ctG.irreps.map((_, i) => {
    const row = new Int32Array(ctH.irreps.length);
    for (const t of restrictions[i].terms) row[t.irrepIndex] = t.mult;
    return Array.from(row);
  });
  const indMatrix = ctH.irreps.map((_, j) => {
    const row = new Int32Array(ctG.irreps.length);
    for (const t of inductions[j].terms) row[t.irrepIndex] = t.mult;
    return Array.from(row);
  });

  let reciprocityOk = true;
  for (let i = 0; i < ctG.irreps.length; i++) {
    for (let j = 0; j < ctH.irreps.length; j++) {
      if (resMatrix[i][j] !== indMatrix[j][i]) reciprocityOk = false;
    }
  }

  return {
    H,
    ctG,
    ctH,
    index: indexGH,
    restrictions,
    inductions,
    resMatrix,
    indMatrix,
    reciprocityOk,
  };
}

// ---------- Invariants & Molien Series (via Newton's Identities on Characters) ----------

export function molienSeries(G, irrepIndexOrValues, maxDeg = 14) {
  const ct = characterTable(G);
  const chi = Array.isArray(irrepIndexOrValues)
    ? irrepIndexOrValues
    : ct.irreps[irrepIndexOrValues].values;
  const d = Math.round(chi[0].re);
  const r = ct.classCount;
  const n = G.size;

  // Precompute power classes powClass[j][k] = classOf[g_j^k] for k = 1..maxDeg
  const powClass = Array.from({ length: r }, (_, j) => {
    const arr = new Int32Array(maxDeg + 1);
    let cur = G.e;
    const rep = ct.classes[j].rep;
    arr[0] = ct.classOf[G.e];
    for (let k = 1; k <= maxDeg; k++) {
      cur = G.mul(cur, rep);
      arr[k] = ct.classOf[cur];
    }
    return arr;
  });

  // For each class j, compute complete homogeneous h_k(g_j) = chi_{Sym^k}(g_j) via k*h_k = sum_{m=1}^k p_m * h_{k-m}
  // and elementary e_k(g_j) = chi_{Lambda^k}(g_j) for k = 0..d via k*e_k = sum_{m=1}^k (-1)^{m-1} e_{k-m} * p_m
  const symCoeffs = new Array(maxDeg + 1).fill(0);
  const tensorInvariants = new Array(maxDeg + 1).fill(0);
  const altInvariants = new Array(d + 1).fill(0);
  const charPolys = [];

  for (let j = 0; j < r; j++) {
    const hj = ct.classes[j].size;
    const p = new Array(maxDeg + 1);
    for (let k = 1; k <= maxDeg; k++) p[k] = chi[powClass[j][k]];

    // Complete homogeneous symmetric polynomials h_k
    const h = new Array(maxDeg + 1);
    h[0] = C.of(1, 0);
    for (let k = 1; k <= maxDeg; k++) {
      let sum = C.of(0, 0);
      for (let m = 1; m <= k; m++) {
        sum = C.add(sum, C.mul(p[m], h[k - m]));
      }
      h[k] = C.scale(sum, 1 / k);
    }

    // Elementary symmetric polynomials e_k (up to dim d)
    const e = new Array(d + 1);
    e[0] = C.of(1, 0);
    for (let k = 1; k <= d; k++) {
      let sum = C.of(0, 0);
      for (let m = 1; m <= k; m++) {
        const term = C.mul(e[k - m], p[m]);
        sum = (m % 2 === 1) ? C.add(sum, term) : C.sub(sum, term);
      }
      e[k] = C.scale(sum, 1 / k);
    }
    // det(I - t rho(g_j)) = sum_{k=0}^d (-1)^k e_k t^k
    charPolys.push({
      classIndex: j,
      classSize: hj,
      coeffs: e.map((val, k) => {
        const s = k % 2 === 0 ? val : C.scale(val, -1);
        return recognizeAlgebraic(s.re, s.im, exponent(G));
      }),
    });

    // Accumulate invariants
    let chiPow = C.of(1, 0);
    for (let k = 0; k <= maxDeg; k++) {
      symCoeffs[k] += hj * h[k].re;
      tensorInvariants[k] += hj * chiPow.re;
      chiPow = C.mul(chiPow, chi[j]);
    }
    for (let k = 0; k <= d; k++) {
      altInvariants[k] += hj * e[k].re;
    }
  }

  const molien = symCoeffs.map(v => roundInt(v / n));
  const tensor = tensorInvariants.map(v => roundInt(v / n));
  const exterior = altInvariants.map(v => roundInt(v / n));

  // Build LaTeX series M(t) = 1 + c_1 t + c_2 t^2 + ...
  const termsLatex = [];
  for (let k = 0; k <= maxDeg; k++) {
    const ck = molien[k];
    if (ck === 0) continue;
    if (k === 0) termsLatex.push(String(ck));
    else if (k === 1) termsLatex.push(ck === 1 ? 't' : `${ck}t`);
    else termsLatex.push(ck === 1 ? `t^{${k}}` : `${ck}t^{${k}}`);
  }
  const seriesLatex = (termsLatex.join(' + ') || '0') + ' + \\cdots';

  return {
    dim: d,
    maxDeg,
    molien,
    tensorInvariants: tensor,
    exteriorInvariants: exterior,
    charPolys,
    seriesLatex,
  };
}

// ---------- Young Tableaux, Hook Lengths & Murnaghan-Nakayama Rule ----------

export function partitions(n) {
  n = Math.trunc(n);
  if (n < 0) return [];
  if (n === 0) return [[]];
  const res = [];
  function bt(rem, maxPart, cur) {
    if (rem === 0) { res.push(cur.slice()); return; }
    for (let k = Math.min(rem, maxPart); k >= 1; k--) {
      cur.push(k);
      bt(rem - k, k, cur);
      cur.pop();
    }
  }
  bt(n, n, []);
  return res;
}

export function conjugatePartition(lambda) {
  if (!lambda.length) return [];
  const cols = lambda[0];
  const out = new Array(cols).fill(0);
  for (let r = 0; r < lambda.length; r++) {
    for (let c = 0; c < lambda[r]; c++) out[c]++;
  }
  return out;
}

export function hookLengths(lambda) {
  const conj = conjugatePartition(lambda);
  return lambda.map((rowLen, i) => {
    const row = new Array(rowLen);
    for (let j = 0; j < rowLen; j++) {
      row[j] = (rowLen - j) + (conj[j] - i) - 1;
    }
    return row;
  });
}

export function hookDimension(lambda) {
  const n = lambda.reduce((s, x) => s + x, 0);
  if (n === 0) return 1;
  const hooks = hookLengths(lambda);
  let num = 1n, den = 1n;
  for (let k = 2; k <= n; k++) num *= BigInt(k);
  for (const row of hooks) for (const h of row) den *= BigInt(h);
  return Number(num / den);
}

export function standardYoungTableaux(lambda, maxCount = 300) {
  const n = lambda.reduce((s, x) => s + x, 0);
  const rows = lambda.length;
  const tab = lambda.map(len => new Int32Array(len));
  const fill = new Int32Array(rows);
  const out = [];

  function bt(num) {
    if (out.length >= maxCount) return;
    if (num > n) {
      out.push(tab.map(r => Array.from(r)));
      return;
    }
    for (let r = 0; r < rows; r++) {
      const c = fill[r];
      if (c < lambda[r] && (r === 0 || c < fill[r - 1])) {
        tab[r][c] = num;
        fill[r]++;
        bt(num + 1);
        fill[r]--;
      }
    }
  }
  bt(1);
  return { tableaux: out, total: hookDimension(lambda), truncated: out.length < hookDimension(lambda) };
}

// Beta-number rim-hook removals of length r from partition lambda.
// Returns array of { next: partition, leg: integer, sign: +1 | -1, cells: [row, col][] }.
export function rimHookRemovals(lambda, r) {
  const k = lambda.length;
  if (k === 0 || r <= 0) return [];
  const beta = lambda.map((v, i) => v + k - 1 - i);
  const betaSet = new Set(beta);
  const out = [];

  for (let i = 0; i < k; i++) {
    const nb = beta[i] - r;
    if (nb < 0 || betaSet.has(nb)) continue;
    const nextBeta = beta.slice();
    nextBeta[i] = nb;
    // Bubble nb rightward to restore strictly decreasing order; swap count = leg length!
    let pos = i, swaps = 0;
    while (pos + 1 < k && nextBeta[pos] < nextBeta[pos + 1]) {
      const tmp = nextBeta[pos];
      nextBeta[pos] = nextBeta[pos + 1];
      nextBeta[pos + 1] = tmp;
      pos++;
      swaps++;
    }
    const next = [];
    for (let j = 0; j < k; j++) {
      const val = nextBeta[j] - (k - 1 - j);
      if (val > 0) next.push(val);
    }
    // Removed cells = difference between lambda and next
    const cells = [];
    for (let row = 0; row < k; row++) {
      const oldLen = lambda[row] || 0;
      const newLen = next[row] || 0;
      for (let col = newLen; col < oldLen; col++) cells.push([row, col]);
    }
    out.push({ next, leg: swaps, sign: swaps % 2 === 0 ? 1 : -1, cells });
  }
  return out;
}

// Exact S_n character χ^λ(μ) via the Murnaghan-Nakayama rule.
export function murnaghanNakayama(lambda, mu) {
  const memo = new Map();
  function rec(lam, idx) {
    if (idx === mu.length) return lam.length === 0 ? 1 : 0;
    const key = lam.join(',') + '|' + idx;
    if (memo.has(key)) return memo.get(key);
    const r = mu[idx];
    let sum = 0;
    for (const rem of rimHookRemovals(lam, r)) {
      sum += rem.sign * rec(rem.next, idx + 1);
    }
    memo.set(key, sum);
    return sum;
  }
  return rec(lambda, 0);
}

// Class size of cycle type mu in S_n: n! / prod_k (m_k! * k^{m_k})
export function snClassSize(mu) {
  const n = mu.reduce((s, x) => s + x, 0);
  const counts = new Map();
  for (const x of mu) counts.set(x, (counts.get(x) || 0) + 1);
  let num = 1n, den = 1n;
  for (let k = 2; k <= n; k++) num *= BigInt(k);
  for (const [len, mult] of counts.entries()) {
    for (let k = 2; k <= mult; k++) den *= BigInt(k);
    den *= BigInt(len) ** BigInt(mult);
  }
  return Number(num / den);
}

// Complete S_n character table computed purely from Young diagrams & Murnaghan-Nakayama (works cleanly up to n = 7).
export function snCharacterTableMN(n) {
  const parts = partitions(n);
  const dims = parts.map(hookDimension);
  const classSizes = parts.map(snClassSize);
  const table = parts.map(lam => parts.map(mu => murnaghanNakayama(lam, mu)));
  let fact = 1;
  for (let k = 2; k <= n; k++) fact *= k;
  return { n, order: fact, partitions: parts, dims, classSizes, table };
}

// ---------- Fast Simplicity, Normal Subgroups, Composition Series (Jordan-Holder) & Fast Sylow ----------

// Fast simplicity test via normal closures of conjugacy classes: O(r * |G|), never enumerates all subgroups.
export function fastIsSimple(G) {
  if (G.size <= 1) return false;
  if (isAbelian(G)) {
    const pf = primeFactors(G.size);
    return pf.length === 1 && pf[0][1] === 1;
  }
  const { classes } = conjugacyStructure(G);
  for (let i = 1; i < classes.length; i++) {
    const normClosure = generate(G, classes[i].elements);
    if (normClosure.length < G.size) return false;
  }
  return true;
}

// Fast enumeration of normal subgroups (via normal closures of conjugacy classes, with cap for huge abelian groups).
export function normalSubgroupsFast(G, { maxNormals = 300 } = {}) {
  const n = G.size;
  if (isAbelian(G) && n > 60) {
    // For large abelian groups, return trivial + cyclic prime-index normals + whole group
    const out = [{ elements: [G.e], order: 1 }];
    const eo = elementOrders(G);
    for (const [p] of primeFactors(n)) {
      // Find a subgroup of index p via kernel of an element-order homomorphism or direct quotient
      const pPow = [];
      for (let g = 0; g < n; g++) {
        // g^p
        let cur = G.e;
        for (let t = 0; t < p; t++) cur = G.mul(cur, g);
        pPow.push(cur);
      }
      const sub = generate(G, pPow);
      if (sub.length < n) {
        // Expand sub until index is p
        let cur = sub;
        while (n / cur.length > p) {
          const inC = new Uint8Array(n);
          for (const x of cur) inC[x] = 1;
          for (let g = 0; g < n; g++) {
            if (!inC[g]) {
              const cand = generate(G, cur.concat(g));
              if (cand.length < n) { cur = cand; break; }
            }
          }
        }
        out.push({ elements: cur, order: cur.length });
      }
    }
    out.push({ elements: Array.from({ length: n }, (_, i) => i), order: n });
    return out;
  }

  const { classes } = conjugacyStructure(G);
  const maskOf = arr => {
    let m = 0n;
    for (const x of arr) m |= 1n << BigInt(x);
    return m;
  };
  const found = new Map();
  const addSub = (elems, preMask = null) => {
    const m = preMask != null ? preMask : maskOf(elems);
    if (!found.has(m)) {
      found.set(m, { elements: elems, order: elems.length, mask: m });
      return true;
    }
    return false;
  };
  addSub([G.e]);
  const atoms = [];
  for (let i = 1; i < classes.length; i++) {
    const nc = generate(G, classes[i].elements);
    const m = maskOf(nc);
    if (addSub(nc, m) && nc.length < n) atoms.push({ elements: nc, mask: m });
  }
  const queue = Array.from(found.values());
  for (let qi = 0; qi < queue.length && found.size < maxNormals; qi++) {
    const H = queue[qi];
    if (H.order === n) continue;
    for (const atom of atoms) {
      if ((H.mask & atom.mask) === atom.mask) continue;
      // Both H and atom are normal, so the product set H * atom IS the normal subgroup <H, atom>.
      let joinedMask = 0n;
      const inJ = new Uint8Array(n);
      const joined = [];
      for (let hi = 0; hi < H.elements.length; hi++) {
        const h = H.elements[hi];
        for (let ai = 0; ai < atom.elements.length; ai++) {
          const prod = G.mul(h, atom.elements[ai]);
          if (!inJ[prod]) {
            inJ[prod] = 1;
            joinedMask |= 1n << BigInt(prod);
            joined.push(prod);
          }
        }
      }
      if (!found.has(joinedMask)) {
        joined.sort((a, b) => a - b);
        addSub(joined, joinedMask);
        queue.push(found.get(joinedMask));
        if (found.size >= maxNormals) break;
      }
    }
  }
  addSub(Array.from({ length: n }, (_, i) => i));
  return Array.from(found.values())
    .map(({ elements, order: ord }) => ({ elements, order: ord }))
    .sort((a, b) => a.order - b.order);
}

// Safe subgroup enumerator with cap so UI never freezes on groups with huge subgroup lattices (e.g. Z_2^6).
export function safeSubgroups(G, { maxSubgroups = 400 } = {}) {
  if (G.size <= 64) {
    const all = subgroups(G);
    return { subgroups: all, truncated: false };
  }
  // For larger groups, run bounded cyclic-join BFS
  const n = G.size;
  const half = n >> 1;
  const allElems = Array.from({ length: n }, (_, i) => i);
  const allMask = (1n << BigInt(n)) - 1n;
  const found = new Map();
  const cyclicList = [];

  for (let a = 0; a < n; a++) {
    const elems = [G.e];
    let mask = 1n << BigInt(G.e);
    let cur = a;
    while (cur !== G.e) {
      elems.push(cur);
      mask |= 1n << BigInt(cur);
      cur = G.mul(cur, a);
    }
    if (!found.has(mask)) {
      elems.sort((x, y) => x - y);
      const entry = { elements: elems, mask, generators: [a], isCyclic: true };
      found.set(mask, entry);
      if (a !== G.e) cyclicList.push({ g: a, bit: 1n << BigInt(a) });
    }
  }
  let truncated = false;
  const queue = Array.from(found.values());
  outer:
  for (let qi = 0; qi < queue.length; qi++) {
    const H = queue[qi];
    if (H.elements.length === n) continue;
    for (let ci = 0; ci < cyclicList.length; ci++) {
      const cyc = cyclicList[ci];
      if ((H.mask & cyc.bit) !== 0n) continue;
      let mask = H.mask;
      const elems = H.elements.slice();
      const gens = H.generators.length === 1 && H.generators[0] === G.e ? [cyc.g] : H.generators.concat(cyc.g);
      const frontier = [];
      let hitWhole = false;
      for (let i = 0; i < H.elements.length; i++) {
        const y = G.mul(H.elements[i], cyc.g);
        const yb = 1n << BigInt(y);
        if ((mask & yb) === 0n) {
          mask |= yb; elems.push(y); frontier.push(y);
          if (elems.length > half) { hitWhole = true; break; }
        }
      }
      if (!hitWhole) {
        for (let fi = 0; fi < frontier.length; fi++) {
          const x = frontier[fi];
          for (let gi = 0; gi < gens.length; gi++) {
            const y = G.mul(x, gens[gi]);
            const yb = 1n << BigInt(y);
            if ((mask & yb) === 0n) {
              mask |= yb; elems.push(y); frontier.push(y);
              if (elems.length > half) { hitWhole = true; break; }
            }
          }
          if (hitWhole) break;
        }
      }
      if (hitWhole) {
        if (!found.has(allMask)) {
          found.set(allMask, { elements: allElems.slice(), mask: allMask, generators: gens, isCyclic: false });
        }
      } else if (!found.has(mask)) {
        elems.sort((x, y) => x - y);
        const entry = { elements: elems, mask, generators: gens, isCyclic: false };
        found.set(mask, entry);
        queue.push(entry);
        if (found.size >= maxSubgroups) {
          truncated = true;
          break outer;
        }
      }
    }
  }
  if (!found.has(allMask)) {
    found.set(allMask, { elements: allElems.slice(), mask: allMask, generators: [0], isCyclic: false });
  }
  const list = Array.from(found.values()).map(s => ({
    elements: s.elements,
    order: s.elements.length,
    generators: s.generators,
    isNormal: isNormal(G, s.elements),
    isCyclic: s.isCyclic,
    key: s.elements.join(','),
  })).sort((a, b) => a.order - b.order);
  return { subgroups: list, truncated };
}

function identifySimpleName(Q) {
  const n = Q.size;
  if (n === 1) return { label: '{e}', latex: '\\{e\\}' };
  if (isAbelian(Q)) return { label: `Z_${n}`, latex: `\\mathbb{Z}_{${n}}` };
  if (n === 60) return { label: 'A_5', latex: 'A_5' };
  if (n === 168) return { label: 'PSL(2,7)', latex: '\\mathrm{PSL}(2,7)' };
  const id = identifyGroup(Q);
  return id || { label: `Basit(${n})`, latex: `\\text{Basit}(${n})` };
}

function abelianIndexPSubgroup(G, p) {
  const n = G.size;
  const pPow = [];
  for (let g = 0; g < n; g++) {
    let cur = G.e;
    for (let t = 0; t < p; t++) cur = G.mul(cur, g);
    pPow.push(cur);
  }
  let sub = generate(G, pPow);
  while (n / sub.length > p) {
    const inS = new Uint8Array(n);
    for (const x of sub) inS[x] = 1;
    for (let g = 0; g < n; g++) {
      if (!inS[g]) {
        const cand = generate(G, sub.concat(g));
        if (cand.length < n) { sub = cand; break; }
      }
    }
  }
  return sub;
}

// Compute a complete composition series G = G_0 ▷ G_1 ▷ ... ▷ G_k = {e} with simple quotients (Jordan-Holder).
export function compositionSeries(G) {
  const c = repCacheOf(G);
  if (c.compSeries) return c.compSeries;

  const series = []; // { group, order, name, latex }
  const factors = []; // { order, label, latex, isAbelian }

  let cur = G;
  series.push({ order: cur.size, name: cur.name, latex: cur.latex });

  while (cur.size > 1) {
    if (fastIsSimple(cur)) {
      const id = identifySimpleName(cur);
      factors.push({ order: cur.size, label: id.label, latex: id.latex, isAbelian: isAbelian(cur) });
      series.push({ order: 1, name: '{e}', latex: '\\{e\\}' });
      break;
    }
    let maxNElems;
    if (isAbelian(cur)) {
      const p = primeFactors(cur.size)[0][0];
      maxNElems = abelianIndexPSubgroup(cur, p);
    } else {
      const norms = normalSubgroupsFast(cur).filter(s => s.order < cur.size);
      maxNElems = norms[norms.length - 1].elements;
    }
    let Q = quotient(cur, maxNElems);
    // Guarantee Q is truly simple (in case normalSubgroupsFast ever hit its cap)
    let guard = 0;
    while (!fastIsSimple(Q) && guard++ < 12) {
      let subQElems;
      if (isAbelian(Q)) {
        const p = primeFactors(Q.size)[0][0];
        subQElems = abelianIndexPSubgroup(Q, p);
      } else {
        const qNorms = normalSubgroupsFast(Q).filter(s => s.order > 1 && s.order < Q.size);
        subQElems = qNorms[qNorms.length - 1].elements;
      }
      const lifted = [];
      for (const ci of subQElems) lifted.push(...Q.meta.cosets[ci]);
      lifted.sort((a, b) => a - b);
      maxNElems = lifted;
      Q = quotient(cur, maxNElems);
    }
    const id = identifySimpleName(Q);
    factors.push({ order: Q.size, label: id.label, latex: id.latex, isAbelian: isAbelian(Q) });
    if (maxNElems.length === 1) {
      series.push({ order: 1, name: '{e}', latex: '\\{e\\}' });
      break;
    }
    const nextG = subgroupAsGroup(cur, maxNElems);
    const nextId = identifyGroup(nextG);
    const nextLabel = nextId ? nextId.label : `N_{${nextG.size}}`;
    const nextLatex = nextId ? nextId.latex : `N_{${nextG.size}}`;
    series.push({ order: nextG.size, name: nextLabel, latex: nextLatex });
    cur = nextG;
  }

  // Also compute derived series G = G^(0) >= G^(1) >= ...
  const derivedOrders = [G.size];
  let dCur = G;
  for (let step = 0; step < 12 && dCur.size > 1; step++) {
    const comm = commutatorSubgroup(dCur);
    if (comm.length === dCur.size) break;
    derivedOrders.push(comm.length);
    if (comm.length === 1) break;
    dCur = subgroupAsGroup(dCur, comm);
  }

  const isSolvable = factors.every(f => f.isAbelian);
  const res = {
    isSimple: fastIsSimple(G),
    isSolvable,
    series,
    factors,
    derivedOrders,
    factorOrderProduct: factors.reduce((p, f) => p * f.order, 1),
  };
  c.compSeries = res;
  return res;
}

// Fast Sylow p-subgroups finder (builds ONE Sylow p-subgroup iteratively inside normalizers, then conjugates).
export function fastSylowSubgroups(G, p) {
  p = Math.trunc(p);
  const pf = primeFactors(G.size).find(([q]) => q === p);
  if (!pf) {
    return { prime: p, power: 0, sylowOrder: 1, cofactor: G.size, allowedNp: [1], count: 0, subgroups: [], isNormal: false, modCheck: false, divCheck: false };
  }
  const [_, k] = pf;
  const sylowOrder = p ** k;
  const m = G.size / sylowOrder;
  const allowedNp = divisors(m).filter(d => d % p === 1);

  // Build one Sylow p-subgroup P of order p^k step-by-step: H_0={e} < H_1 < ... < H_k = P
  let H = [G.e];
  const powP = (g) => {
    let cur = G.e;
    for (let t = 0; t < p; t++) cur = G.mul(cur, g);
    return cur;
  };
  while (H.length < sylowOrder) {
    const inH = new Uint8Array(G.size);
    for (const x of H) inH[x] = 1;
    const N = normalizer(G, H);
    // Find g in N \ H with g^p in H (guaranteed to exist by Cauchy on N/H since p | [N:H])
    let chosen = -1;
    for (const g of N) {
      if (inH[g]) continue;
      // Check smallest r such that g^r in H; if p | r, take g^{r/p}
      let cur = g, relOrd = 1;
      while (!inH[cur]) { cur = G.mul(cur, g); relOrd++; }
      if (relOrd % p === 0) {
        const step = relOrd / p;
        let cand = G.e;
        for (let t = 0; t < step; t++) cand = G.mul(cand, g);
        if (!inH[cand] && inH[powP(cand)]) { chosen = cand; break; }
      }
    }
    if (chosen === -1) throw new Error(`Sylow ${p}-alt grubu oluşturulamadı`);
    H = generate(G, H.concat(chosen));
  }

  // All Sylow p-subgroups are distinct conjugates g H g^{-1}
  const seen = new Set();
  const allP = [];
  for (let g = 0; g < G.size; g++) {
    const gInv = G.inv(g);
    const conj = H.map(h => G.mul(G.mul(g, h), gInv)).sort((a, b) => a - b);
    const key = conj.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      allP.push(conj);
    }
  }
  const count = allP.length;
  return {
    prime: p,
    power: k,
    sylowOrder,
    cofactor: m,
    allowedNp,
    count,
    subgroups: allP,
    isNormal: count === 1,
    modCheck: count % p === 1,
    divCheck: m % count === 0,
  };
}

export function sylowAnalysis(G) {
  const c = repCacheOf(G);
  if (c.sylow) return c.sylow;
  const primes = primeFactors(G.size).map(([p]) => fastSylowSubgroups(G, p));
  c.sylow = primes;
  return primes;
}

// Pure number-theoretic Sylow simplicity screener for any order N >= 2.
export function sylowOrderScreen(N) {
  N = Math.trunc(N);
  const pf = primeFactors(N);
  if (pf.length === 1) {
    const [p, k] = pf[0];
    return {
      order: N,
      factors: pf,
      canBeNonAbelianSimple: false,
      verdict: k === 1
        ? `|G| = ${p} asal: tek grup Z_${p} (Abelyen basit).`
        : `|G| = ${p}^${k} (p-grup): merkezi aşikar değildir (|Z(G)| > 1), basit olamaz.`,
      details: [],
    };
  }
  if (pf.length === 2) {
    // Burnside's p^a q^b theorem
    return {
      order: N,
      factors: pf,
      canBeNonAbelianSimple: false,
      verdict: `Burnside pᵃqᵇ teoremi: |G| = ${pf[0][0]}^${pf[0][1]}·${pf[1][0]}^${pf[1][1]} yalnızca 2 asal çarpan içerdiğinden her grup çözülebilirdir; Abelyen olmayan basit grup olamaz.`,
      details: pf.map(([p, k]) => {
        const m = N / (p ** k);
        return { p, k, m, allowed: divisors(m).filter(d => d % p === 1) };
      }),
    };
  }
  const details = pf.map(([p, k]) => {
    const m = N / (p ** k);
    const allowed = divisors(m).filter(d => d % p === 1);
    return { p, k, m, allowed };
  });
  const forcedNormal = details.find(d => d.allowed.length === 1 && d.allowed[0] === 1);
  if (forcedNormal) {
    return {
      order: N,
      factors: pf,
      canBeNonAbelianSimple: false,
      verdict: `Sylow teoremi: n_${forcedNormal.p} ≡ 1 (mod ${forcedNormal.p}) ve n_${forcedNormal.p} | ${forcedNormal.m} koşullarından n_${forcedNormal.p} = 1 zorunludur → Sylow ${forcedNormal.p}-alt grubu normaldir, basit olamaz!`,
      details,
    };
  }
  if (N % 2 === 1) {
    return {
      order: N,
      factors: pf,
      canBeNonAbelianSimple: false,
      verdict: `Feit–Thompson Tek Mertebe Teoremi: tek mertebeli her sonlu grup çözülebilirdir; |G| = ${N} Abelyen olmayan basit grup olamaz.`,
      details,
    };
  }
  // Element counting obstruction: if sum of minimal non-trivial elements in Sylow subgroups > N - 1
  const minNonId = details.reduce((sum, d) => {
    if (d.k === 1) {
      const minN = d.allowed.find(x => x > 1) || 1;
      return sum + minN * (d.p - 1);
    }
    return sum;
  }, 0);
  if (minNonId >= N) {
    return {
      order: N,
      factors: pf,
      canBeNonAbelianSimple: false,
      verdict: `Eleman sayımı çelişkisi: n_p > 1 varsayımıyla yalnızca p mertebeli elemanlar en az ${minNonId} ≥ ${N} eleman gerektirir → basit olamaz!`,
      details,
    };
  }
  const KNOWN_SIMPLE = new Map([
    [60, 'A_5 ≅ PSL(2,4) ≅ PSL(2,5)'],
    [168, 'PSL(2,7) ≅ GL(3,2)'],
    [360, 'A_6 ≅ PSL(2,9)'],
    [504, 'PSL(2,8)'],
    [660, 'PSL(2,11)'],
    [1092, 'PSL(2,13)'],
  ]);
  const known = KNOWN_SIMPLE.get(N);
  return {
    order: N,
    factors: pf,
    canBeNonAbelianSimple: !!known,
    verdict: known
      ? `✦ Bu mertebede Abelyen olmayan basit grup VARDIR: ${known}!`
      : `Temel Sylow elemelerinden geçiyor; daha ince sayım/indeks argümanlarıyla mertebesi ${N} olan Abelyen olmayan basit grup bulunmaz (≤1000 için yalnızca 60, 168, 360, 504, 660).`,
    details,
  };
}

// ---------- Galois Fields, Fano Plane, Doubly Transitive Actions & PSL(2,7) ≅ GL(3,2) ----------

export const FANO_POINTS = [
  [1, 0, 0], // 0: P1
  [0, 1, 0], // 1: P2
  [0, 0, 1], // 2: P3
  [1, 1, 0], // 3: P4
  [1, 0, 1], // 4: P5
  [0, 1, 1], // 5: P6
  [1, 1, 1], // 6: P7
];

// The 7 lines of the Fano plane (each line = {u, v, u xor v})
export const FANO_LINES = [
  [0, 1, 3], // P1, P2, P4 (triangle side)
  [0, 2, 4], // P1, P3, P5 (triangle side)
  [1, 2, 5], // P2, P3, P6 (triangle side)
  [0, 5, 6], // P1, P6, P7 (median)
  [1, 4, 6], // P2, P5, P7 (median)
  [2, 3, 6], // P3, P4, P7 (median)
  [3, 4, 5], // P4, P5, P6 (inscribed circle!)
];

// Apply a 3x3 binary matrix M (length-9 array) to Fano plane points -> permutation of 0..6
export function fanoActionPerm(M) {
  const ptKey = v => (v[0] << 2) | (v[1] << 1) | v[2];
  const idxOf = new Map(FANO_POINTS.map((v, i) => [ptKey(v), i]));
  return FANO_POINTS.map(v => {
    const nv = [
      (M[0] * v[0] + M[1] * v[1] + M[2] * v[2]) & 1,
      (M[3] * v[0] + M[4] * v[1] + M[5] * v[2]) & 1,
      (M[6] * v[0] + M[7] * v[1] + M[8] * v[2]) & 1,
    ];
    return idxOf.get(ptKey(nv));
  });
}

// Apply a 2x2 matrix M over F_p to projective line P^1(F_p) = {0, 1, ..., p-1, ∞ (index p)}
export function p1ActionPerm(M, p) {
  const [a, b, c, d] = M;
  const mod = x => ((x % p) + p) % p;
  const inv = x => {
    x = mod(x);
    for (let u = 1; u < p; u++) if ((x * u) % p === 1) return u;
    return 0;
  };
  const perm = new Array(p + 1);
  for (let z = 0; z < p; z++) {
    const num = mod(a * z + b);
    const den = mod(c * z + d);
    perm[z] = den === 0 ? p : mod(num * inv(den));
  }
  // ∞ -> a/c
  perm[p] = mod(c) === 0 ? p : mod(a * inv(c));
  return perm;
}

// Check 1-, 2-, and 3-transitivity of a list of permutations of degree d
export function checkTransitivity(perms, degree) {
  const m = perms.length;
  // 1-transitivity from point 0
  const orbit0 = new Set(perms.map(p => p[0]));
  const isTransitive = orbit0.size === degree;

  // 2-transitivity: count images of (0, 1) across all ordered pairs (i, j) with i != j
  const pairCounts = new Map();
  for (const p of perms) {
    const k = `${p[0]},${p[1]}`;
    pairCounts.set(k, (pairCounts.get(k) || 0) + 1);
  }
  const totalOrderedPairs = degree * (degree - 1);
  const isDoublyTransitive = isTransitive && pairCounts.size === totalOrderedPairs;
  const pairStabilizerOrder = isDoublyTransitive ? m / totalOrderedPairs : 0;

  // 3-transitivity (for small degree <= 10)
  let isTriplyTransitive = false;
  if (isDoublyTransitive && degree >= 3 && degree <= 10) {
    const tripleSet = new Set(perms.map(p => `${p[0]},${p[1]},${p[2]}`));
    isTriplyTransitive = tripleSet.size === degree * (degree - 1) * (degree - 2);
  }

  return {
    degree,
    groupOrder: m,
    isTransitive,
    isDoublyTransitive,
    isTriplyTransitive,
    stabilizerOrder: isTransitive ? m / degree : 0,
    pairStabilizerOrder,
  };
}

// Find all element indices g in a permutation action that map ordered pair (a, b) -> (c, d)
export function findPairMappers(perms, a, b, c, d) {
  const out = [];
  for (let i = 0; i < perms.length; i++) {
    if (perms[i][a] === c && perms[i][b] === d) out.push(i);
  }
  return out;
}

let PSL_GL_ISO_CACHE = null;

// Explicit verified isomorphism PSL(2,7) -> GL(3,2) (both order 168), plus Fano & P^1(F_7) actions.
export function psl27AndGl32Data() {
  if (PSL_GL_ISO_CACHE) return PSL_GL_ISO_CACHE;
  const P = psl2_7();
  const G3 = gl3_2();
  const eoP = elementOrders(P);
  const eoG = elementOrders(G3);

  // Standard presentation of PSL(2,7): <x, y | x^2 = y^3 = (xy)^7 = [x,y]^4 = 1>
  // Pick x (order 2), y (order 3) in PSL(2,7) with ord(xy) = 7 and ord([x,y]) = 4
  let xP = -1, yP = -1;
  for (let i = 1; i < P.size && xP === -1; i++) {
    if (eoP[i] !== 2) continue;
    for (let j = 1; j < P.size; j++) {
      if (eoP[j] !== 3) continue;
      if (eoP[P.mul(i, j)] !== 7) continue;
      const comm = P.mul(P.mul(i, j), P.mul(P.inv(i), P.inv(j)));
      if (eoP[comm] === 4) { xP = i; yP = j; break; }
    }
  }
  // Find matching pair (xG, yG) in GL(3,2) with same presentation -> guaranteed unique isomorphism up to Aut
  let isoMap = null, xG = -1, yG = -1;
  for (let i = 1; i < G3.size && !isoMap; i++) {
    if (eoG[i] !== 2) continue;
    for (let j = 1; j < G3.size; j++) {
      if (eoG[j] !== 3) continue;
      if (eoG[G3.mul(i, j)] !== 7) continue;
      const comm = G3.mul(G3.mul(i, j), G3.mul(G3.inv(i), G3.inv(j)));
      if (eoG[comm] !== 4) continue;
      const ext = extendHomomorphism(P, G3, [[xP, i], [yP, j]]);
      if (ext.ok && ext.isIsomorphism) {
        isoMap = ext.map;
        xG = i; yG = j;
        break;
      }
    }
  }

  const invIsoMap = new Array(P.size);
  for (let i = 0; i < P.size; i++) invIsoMap[isoMap[i]] = i;

  const fanoPermsGL = G3.meta.matrices.map(fanoActionPerm);
  const fanoPermsPSL = isoMap.map(gi => fanoPermsGL[gi]);
  const p1PermsPSL = P.meta.matrices.map(M => p1ActionPerm(M, 7));

  PSL_GL_ISO_CACHE = {
    PSL27: P,
    GL32: G3,
    isoPslToGl: isoMap,
    isoGlToPsl: invIsoMap,
    generators: { xP, yP, xG, yG },
    fanoPermsGL,
    fanoPermsPSL,
    p1PermsPSL,
    fanoTransitivity: checkTransitivity(fanoPermsGL, 7),
    p1Transitivity: checkTransitivity(p1PermsPSL, 8),
  };
  return PSL_GL_ISO_CACHE;
}

// ---------- Coverings, Binary Polyhedral Groups, ADE McKay Correspondence & Finite SU(3) Subgroups ----------

// Compute the McKay graph for a finite subgroup G ⊂ SU(2) with respect to its faithful 2D representation.
// For cyclic Z_n, pass definingChi = chi_1 + chi_{n-1} (reducible 2D SU(2) embedding diag(ζ, ζ^{-1})).
export function mckayGraph(G, definingRepOrChi = null) {
  const ct = characterTable(G);
  const r = ct.irreps.length;

  let defChi;
  let defLabel = '\\mathbf{2}';
  if (Array.isArray(definingRepOrChi)) {
    defChi = definingRepOrChi;
  } else if (typeof definingRepOrChi === 'number') {
    defChi = ct.irreps[definingRepOrChi].values;
    defLabel = ct.irreps[definingRepOrChi].latex;
  } else if (isCyclic(G)) {
    if (G.size === 1) {
      defChi = [C.of(2, 0)];
      defLabel = '\\mathbf{1} \\oplus \\mathbf{1}';
    } else {
      // Standard 2D SU(2) embedding of Z_n: diag(e^{2πi/n}, e^{-2πi/n}) = chi_1 ⊕ chi_{n-1}
      const g1 = ct.irreps.find(ir => ir.isFaithful) || ct.irreps[Math.min(1, r - 1)];
      const gConj = ct.irreps[g1.conjugateIndex];
      defChi = g1.values.map((v, k) => C.add(v, gConj.values[k]));
      defLabel = `${g1.latex} \\oplus ${gConj.latex}`;
    }
  } else {
    // Pick the faithful pseudoreal (SU(2) det=1) 2D irrep first (for Q_{2n}, 2T, 2O, 2I)
    const f2 = ct.irreps.find(ir => ir.dim === 2 && ir.isFaithful && ir.fsIndicator === -1)
      || ct.irreps.find(ir => ir.dim === 2 && ir.isFaithful)
      || ct.irreps.find(ir => ir.dim === 2);
    if (!f2) throw new Error(`${G.name} için 2-boyutlu SU(2) tanımlayıcı temsili bulunamadı`);
    defChi = f2.values;
    defLabel = f2.latex;
  }

  // Adjacency matrix A[i][j] = <chi_i, defChi * chi_j>
  const adj = Array.from({ length: r }, () => new Int32Array(r));
  const edges = [];
  for (let i = 0; i < r; i++) {
    const prod = ct.irreps[i].values.map((v, k) => C.mul(defChi[k], v));
    for (let j = 0; j < r; j++) {
      const m = roundInt(characterInnerProduct(ct, ct.irreps[j].values, prod).re);
      adj[i][j] = m;
      if (j >= i && m > 0) edges.push({ from: i, to: j, mult: m });
    }
  }

  // Extended Cartan matrix C_ext = 2 I - A; verify (2I - A) * d = 0 (Perron-Frobenius / Coxeter marks!)
  const dims = ct.irreps.map(ir => ir.dim);
  const cartan = Array.from({ length: r }, (_, i) =>
    Array.from({ length: r }, (__, j) => (i === j ? 2 : 0) - adj[i][j])
  );
  let nullCheckOk = true;
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < r; j++) s += cartan[i][j] * dims[j];
    if (s !== 0) nullCheckOk = false;
  }

  // Classify each irrep as tensorial/bosonic (chi(-1) = +d) vs spinorial/projective (chi(-1) = -d)
  const negOne = G.meta?.centerNegOne;
  const negClass = negOne != null ? ct.classOf[negOne] : null;
  const nodes = ct.irreps.map((ir, idx) => {
    let parity = 'tensor';
    if (negClass != null) {
      parity = ir.values[negClass].re < 0 ? 'spinor' : 'tensor';
    }
    return {
      index: idx,
      name: ir.name,
      latex: ir.latex,
      dim: ir.dim,
      fsIndicator: ir.fsIndicator,
      parity,
      isTrivial: ir.isTrivial,
      degree: adj[idx].reduce((s, x) => s + x, 0),
    };
  });

  // Identify extended ADE diagram type
  let adeType = '';
  let adeLatex = '';
  if (isCyclic(G)) { adeType = `Ã_${G.size - 1}`; adeLatex = `\\widetilde{A}_{${G.size - 1}}`; }
  else if (G.meta?.kind === 'Q2n' || G.meta?.kind === 'Q8') {
    const nParam = G.meta?.kind === 'Q8' ? 2 : G.meta.n;
    adeType = `D̃_${nParam + 2}`; adeLatex = `\\widetilde{D}_{${nParam + 2}}`;
  } else if (G.meta?.kind === '2T') { adeType = 'Ẽ_6'; adeLatex = '\\widetilde{E}_6'; }
  else if (G.meta?.kind === '2O') { adeType = 'Ẽ_7'; adeLatex = '\\widetilde{E}_7'; }
  else if (G.meta?.kind === '2I') { adeType = 'Ẽ_8'; adeLatex = '\\widetilde{E}_8'; }

  return {
    groupName: G.name,
    groupLatex: G.latex,
    defLabel,
    adeType,
    adeLatex,
    nodes,
    edges,
    adj: adj.map(row => Array.from(row)),
    cartan,
    dims,
    nullCheckOk,
    hasDoubleCover: negClass != null,
  };
}

// Reference catalog of finite SU(3) subgroups (Ramond Section 11.7.2)
export const SU3_FINITE_SUBGROUPS = [
  { id: 'Delta12', name: 'Δ(12) ≅ A₄', latex: '\\Delta(3\\cdot 2^2) \\cong A_4', order: 12, series: 'Δ(3n²)', spec: { kind: 'Delta3', n: 2 }, note: 'En küçük non-Abelyen SU(3) aile simetrisi; nötrino tribimaximal karışım modelleri.' },
  { id: 'Delta24', name: 'Δ(24) ≅ S₄', latex: '\\Delta(6\\cdot 2^2) \\cong S_4', order: 24, series: 'Δ(6n²)', spec: { kind: 'Delta6', n: 2 }, note: 'Küp/sekizyüzlü grubunun SU(3) üçlü temsili.' },
  { id: 'Delta27', name: 'Δ(27)', latex: '\\Delta(27) = (\\mathbb{Z}_3\\times\\mathbb{Z}_3)\\rtimes\\mathbb{Z}_3', order: 27, series: 'Δ(3n²)', spec: { kind: 'Delta3', n: 3 }, note: 'Üç nesil fermiyon ve kendiliğinden CP kırılımı modellerinde kritik rol oynar.' },
  { id: 'Delta48', name: 'Δ(48)', latex: '\\Delta(48) = (\\mathbb{Z}_4\\times\\mathbb{Z}_4)\\rtimes\\mathbb{Z}_3', order: 48, series: 'Δ(3n²)', spec: { kind: 'Delta3', n: 4 }, note: 'Δ(3n²) ailesinin n = 4 üyesi.' },
  { id: 'Delta54', name: 'Δ(54)', latex: '\\Delta(54) = (\\mathbb{Z}_3\\times\\mathbb{Z}_3)\\rtimes S_3', order: 54, series: 'Δ(6n²)', spec: { kind: 'Delta6', n: 3 }, note: 'Heterotik sicim T²/Z₃ orbifold simetrisi; 4 adet 2B ve 4 adet 3B irrep.' },
  { id: 'Sigma60', name: 'Σ(60) ≅ A₅', latex: '\\Sigma(60) \\cong A_5', order: 60, series: 'İstisnai SU(3)', spec: { kind: 'A', n: 5 }, note: 'Yirmiyüzlü basit grup; altın oranlı nötrino karışım modelleri.' },
  { id: 'Delta96', name: 'Δ(96)', latex: '\\Delta(96) = (\\mathbb{Z}_4\\times\\mathbb{Z}_4)\\rtimes S_3', order: 96, series: 'Δ(6n²)', spec: { kind: 'Delta6', n: 4 }, note: 'Δ(6n²) ailesinin n = 4 üyesi.' },
  { id: 'Sigma168', name: 'Σ(168) ≅ PSL(2,7)', latex: '\\Sigma(168) \\cong \\mathrm{PSL}(2,7)', order: 168, series: 'İstisnai SU(3)', spec: { kind: 'PSL27' }, note: 'Klein dördüncü derece eğrisi simetri grubu; SU(3) içinde iki eşlenik 3B irrep.' },
  { id: 'Hessian', name: 'Hessian Σ(216)', latex: '\\Sigma(216) = (\\mathbb{Z}_3\\times\\mathbb{Z}_3)\\rtimes \\mathrm{SL}(2,3)', order: 216, series: 'İstisnai PSU(3) / SU(3)', spec: { kind: 'Hessian' }, note: 'PSU(3) içindeki Hessian grubu (|G| = 216); SU(3) içindeki üçlü örtüsü Σ(216×3) mertebesi 648 olan ünlü kristalografik olmayan alt gruptur.' },
  { id: 'Sigma360x3', name: 'Σ(360×3) (3·A₆)', latex: '\\Sigma(360\\times 3) \\cong 3\\cdot A_6', order: 1080, series: 'İstisnai SU(3) (bilgi)', spec: null, note: 'A₆’nın SU(3) içindeki üçlü örtüsü (Valentin grubu); 17 eşlenik sınıf, 3B ve 6B temsiller (bilgi tablosu).' },
];

// ---------- All 26 Sporadic Simple Groups (Ramond Section 9.3, exact BigInt orders) ----------

function orderFromFactors(pf) {
  let acc = 1n;
  for (const [p, e] of pf) acc *= BigInt(p) ** BigInt(e);
  return acc;
}

const SPORADIC_RAW = [
  { id: 'M11', name: 'Mathieu M₁₁', latex: 'M_{11}', family: 'Mathieu', happy: true, year: 1861, discoverer: 'É. Mathieu', minDeg: 11, factors: [[2,4],[3,2],[5,1],[11,1]], note: 'En küçük sporadik basit grup; keskin 4-geçişli permütasyon grubu.' },
  { id: 'M12', name: 'Mathieu M₁₂', latex: 'M_{12}', family: 'Mathieu', happy: true, year: 1861, discoverer: 'É. Mathieu', minDeg: 12, factors: [[2,6],[3,3],[5,1],[11,1]], note: 'Keskin 5-geçişli; Steiner sistemi S(5,6,12) otomorfizmaları.' },
  { id: 'M22', name: 'Mathieu M₂₂', latex: 'M_{22}', family: 'Mathieu', happy: true, year: 1873, discoverer: 'É. Mathieu', minDeg: 22, factors: [[2,7],[3,2],[5,1],[7,1],[11,1]], note: 'Steiner sistemi S(3,6,22) otomorfizmalarının 2 indeksli alt grubu.' },
  { id: 'M23', name: 'Mathieu M₂₃', latex: 'M_{23}', family: 'Mathieu', happy: true, year: 1873, discoverer: 'É. Mathieu', minDeg: 23, factors: [[2,7],[3,2],[5,1],[7,1],[11,1],[23,1]], note: '4-geçişli; ikili Golay kodu G₂₃ otomorfizma grubu.' },
  { id: 'M24', name: 'Mathieu M₂₄', latex: 'M_{24}', family: 'Mathieu', happy: true, year: 1873, discoverer: 'É. Mathieu', minDeg: 24, factors: [[2,10],[3,3],[5,1],[7,1],[11,1],[23,1]], note: '5-geçişli; genişletilmiş ikili Golay kodu G₂₄ ve K3 Mathieu Moonshine bağlantısı.' },
  { id: 'J1', name: 'Janko J₁', latex: 'J_1', family: 'Parya (Janko)', happy: false, year: 1965, discoverer: 'Z. Janko', minDeg: 266, factors: [[2,3],[3,1],[5,1],[7,1],[11,1],[19,1]], note: '100 yıl aradan sonra keşfedilen ilk sporadik grup; 6 parya gruptan biri, G₂(11) alt grubu.' },
  { id: 'J2', name: 'Hall–Janko J₂', latex: 'J_2\\;(HJ)', family: 'Conway / Leech', happy: true, year: 1968, discoverer: 'M. Hall, D. Wales', minDeg: 100, factors: [[2,7],[3,3],[5,2],[7,1]], note: 'Tek parya olmayan Janko grubu; G₂(4) ve Leech kafesi içinde gömülüdür.' },
  { id: 'J3', name: 'Higman–Janko–McKay J₃', latex: 'J_3', family: 'Parya (Janko)', happy: false, year: 1968, discoverer: 'G. Higman, J. McKay', minDeg: 6156, factors: [[2,7],[3,5],[5,1],[17,1],[19,1]], note: 'Parya grup; 3-katlı örtüsü 9B karmaşık temsile sahiptir.' },
  { id: 'J4', name: 'Janko J₄', latex: 'J_4', family: 'Parya (Janko)', happy: false, year: 1976, discoverer: 'Z. Janko', minDeg: 173067389, factors: [[2,21],[3,3],[5,1],[7,1],[11,3],[23,1],[29,1],[31,1],[37,1],[43,1]], note: 'En büyük parya grup; F₂ üzerinde 112-boyutlu matrislerle inşa edildi.' },
  { id: 'HS', name: 'Higman–Sims HS', latex: 'HS', family: 'Conway / Leech', happy: true, year: 1967, discoverer: 'D. Higman, C. Sims', minDeg: 100, factors: [[2,9],[3,2],[5,3],[7,1],[11,1]], note: '100 köşeli Higman–Sims grafının otomorfizma grubunun 2 indeksli alt grubu.' },
  { id: 'McL', name: 'McLaughlin McL', latex: 'McL', family: 'Conway / Leech', happy: true, year: 1968, discoverer: 'J. McLaughlin', minDeg: 275, factors: [[2,7],[3,6],[5,3],[7,1],[11,1]], note: '275 köşeli McLaughlin grafı üzerinden inşa; Co₃’ün maksimal alt grubu.' },
  { id: 'Suz', name: 'Suzuki Suz', latex: 'Suz', family: 'Conway / Leech', happy: true, year: 1968, discoverer: 'M. Suzuki', minDeg: 1782, factors: [[2,13],[3,7],[5,2],[7,1],[11,1],[13,1]], note: '6-katlı örtüsü karmaşık Leech kafesi üzerinde 12B etki eder.' },
  { id: 'Co3', name: 'Conway Co₃', latex: 'Co_3', family: 'Conway / Leech', happy: true, year: 1968, discoverer: 'J. H. Conway', minDeg: 276, factors: [[2,10],[3,7],[5,3],[7,1],[11,1],[23,1]], note: 'Leech kafesinde tip-3 vektörün sabitleyicisi.' },
  { id: 'Co2', name: 'Conway Co₂', latex: 'Co_2', family: 'Conway / Leech', happy: true, year: 1968, discoverer: 'J. H. Conway', minDeg: 2300, factors: [[2,18],[3,6],[5,3],[7,1],[11,1],[23,1]], note: 'Leech kafesinde tip-2 (en kısa) vektörün sabitleyicisi.' },
  { id: 'Co1', name: 'Conway Co₁', latex: 'Co_1', family: 'Conway / Leech', happy: true, year: 1968, discoverer: 'J. H. Conway', minDeg: 98280, factors: [[2,21],[3,9],[5,4],[7,2],[11,1],[13,1],[23,1]], note: '24-boyutlu Leech kafesinin otomorfizma grubu Co₀ / {±1}.' },
  { id: 'He', name: 'Held He', latex: 'He', family: 'Monster (Mutlu Aile)', happy: true, year: 1968, discoverer: 'D. Held', minDeg: 2058, factors: [[2,10],[3,3],[5,2],[7,3],[17,1]], note: 'Monster içinde 7 mertebeli elemanın merkezleyicisinde ortaya çıkar.' },
  { id: 'Ru', name: 'Rudvalis Ru', latex: 'Ru', family: 'Parya', happy: false, year: 1973, discoverer: 'A. Rudvalis', minDeg: 4060, factors: [[2,14],[3,3],[5,3],[7,1],[13,1],[29,1]], note: 'Parya grup; çift örtüsü 28-boyutlu karmaşık kafes üzerinde etki eder.' },
  { id: 'ON', name: "O'Nan O'N", latex: "O'N", family: 'Parya', happy: false, year: 1973, discoverer: "M. O'Nan", minDeg: 122760, factors: [[2,9],[3,4],[5,1],[7,3],[11,1],[19,1],[31,1]], note: 'Parya grup; 3-katlı örtüsü 45-boyutlu F₇ temsiliyle Sims tarafından inşa edildi.' },
  { id: 'Ly', name: 'Lyons Ly', latex: 'Ly', family: 'Parya', happy: false, year: 1970, discoverer: 'R. Lyons', minDeg: 8835156, factors: [[2,8],[3,7],[5,6],[7,1],[11,1],[31,1],[37,1],[67,1]], note: 'Parya grup; F₅ üzerinde 111-boyutlu temsille inşa edilir.' },
  { id: 'Fi22', name: 'Fischer Fi₂₂', latex: 'Fi_{22}', family: 'Fischer', happy: true, year: 1970, discoverer: 'B. Fischer', minDeg: 3510, factors: [[2,17],[3,9],[5,2],[7,1],[11,1],[13,1]], note: '3-transpozisyon gruplarının ilki; 2E₆(2) ile yakından ilişkili.' },
  { id: 'Fi23', name: 'Fischer Fi₂₃', latex: 'Fi_{23}', family: 'Fischer', happy: true, year: 1970, discoverer: 'B. Fischer', minDeg: 31671, factors: [[2,18],[3,13],[5,2],[7,1],[11,1],[13,1],[17,1],[23,1]], note: '3-transpozisyon grubu; Baby Monster içinde yer alır.' },
  { id: 'Fi24p', name: "Fischer Fi₂₄'", latex: "Fi_{24}'", family: 'Fischer', happy: true, year: 1970, discoverer: 'B. Fischer', minDeg: 306936, factors: [[2,21],[3,16],[5,2],[7,3],[11,1],[13,1],[17,1],[23,1],[29,1]], note: '3-transpozisyon grubu Fi₂₄’ün türev alt grubu; Monster içinde 3C merkezleyicisi.' },
  { id: 'HN', name: 'Harada–Norton HN', latex: 'HN\\;(F_5)', family: 'Monster (Mutlu Aile)', happy: true, year: 1975, discoverer: 'K. Harada, S. Norton', minDeg: 1140000, factors: [[2,14],[3,6],[5,6],[7,1],[11,1],[19,1]], note: 'Monster’da 5A elemanının merkezleyicisinden çıkar; 133B temsile sahiptir.' },
  { id: 'Th', name: 'Thompson Th', latex: 'Th\\;(F_3)', family: 'Monster (Mutlu Aile)', happy: true, year: 1975, discoverer: 'J. G. Thompson', minDeg: 143127000, factors: [[2,15],[3,10],[5,3],[7,2],[13,1],[19,1],[31,1]], note: 'Monster’da 3C merkezleyicisinden çıkar; E₈(3) içine 248B olarak gömülür!' },
  { id: 'B', name: 'Baby Monster B', latex: 'B\\;(F_2)', family: 'Monster (Mutlu Aile)', happy: true, year: 1973, discoverer: 'B. Fischer', minDeg: 13571955000, factors: [[2,41],[3,13],[5,6],[7,2],[11,1],[13,1],[17,1],[19,1],[23,1],[31,1],[47,1]], note: 'İkinci en büyük sporadik grup (~4.15×10³³); 2·B, Monster’daki 2A involüsyon merkezleyicisidir.' },
  { id: 'M', name: 'Monster M (Fischer–Griess)', latex: 'M\\;(F_1)', family: 'Monster (Mutlu Aile)', happy: true, year: 1982, discoverer: 'B. Fischer, R. Griess', minDeg: 97239461142009186000, factors: [[2,46],[3,20],[5,9],[7,6],[11,2],[13,3],[17,1],[19,1],[23,1],[29,1],[31,1],[41,1],[47,1],[59,1],[71,1]], note: 'En büyük sporadik basit grup (~8.08×10⁵³). En küçük aşikar olmayan temsili 196883B; Monstrous Moonshine: j(τ)−744 = q⁻¹ + 196884q + … ve 196884 = 1 + 196883!' },
];

export const SPORADIC_GROUPS = SPORADIC_RAW.map(g => {
  const orderBigInt = orderFromFactors(g.factors);
  const orderStr = orderBigInt.toString();
  const factorLatex = g.factors.map(([p, e]) => (e > 1 ? `${p}^{${e}}` : `${p}`)).join('\\cdot ');
  return {
    ...g,
    orderBigInt,
    orderStr,
    digits: orderStr.length,
    log10: Math.log10(Number(orderStr.slice(0, 15))) + Math.max(0, orderStr.length - 15),
    factorLatex,
  };
});

export const SIMPLE_GROUP_FAMILIES = [
  { id: 'Zp', name: 'Asal mertebeli devirli gruplar', latex: '\\mathbb{Z}_p \\; (p \\text{ asal})', orderFormula: 'p', category: 'Abelyen', note: 'Tek Abelyen sonlu basit gruplar.' },
  { id: 'An', name: 'Alternatif gruplar', latex: 'A_n \\; (n \\ge 5)', orderFormula: 'n!/2', category: 'Alternatif', note: 'n=5 için |A₅| = 60 (en küçük Abelyen olmayan basit grup).' },
  { id: 'ChevA', name: 'Chevalley A_n(q) = PSL(n+1, q)', latex: '\\mathrm{PSL}(n+1, \\mathbb{F}_q)', orderFormula: '\\frac{1}{d} q^{n(n+1)/2} \\prod_{k=2}^{n+1}(q^k-1)', category: 'Klasik Lie Tipi', note: 'n=1, q=7 için PSL(2,7) (|G|=168); d = gcd(n+1, q−1).' },
  { id: 'ChevBCD', name: 'Klasik Chevalley B_n(q), C_n(q), D_n(q)', latex: '\\Omega_{2n+1}(q),\\; \\mathrm{PSp}_{2n}(q),\\; P\\Omega^+_{2n}(q)', orderFormula: '\\text{Ortogonal / Simplektik } \\mathbb{F}_q', category: 'Klasik Lie Tipi', note: 'Sonlu cisimler üzerinde ortogonal ve simplektik basit gruplar.' },
  { id: 'ChevExc', name: 'İstisnai Chevalley grupları', latex: 'G_2(q),\\; F_4(q),\\; E_6(q),\\; E_7(q),\\; E_8(q)', orderFormula: '\\text{5 istisnai Lie cebiri}', category: 'İstisnai Lie Tipi', note: 'Bölüm 7’deki istisnai Lie cebirlerinin sonlu cisim analogları.' },
  { id: 'Twisted', name: 'Burulmuş (Steinberg / Suzuki / Ree) + Tits', latex: '{}^2A_n, {}^2D_n, {}^2E_6, {}^3D_4, {}^2B_2, {}^2G_2, {}^2F_4, {}^2F_4(2)\'', orderFormula: '\\text{Diyagram otomorfizmalı aileler}', category: 'Burulmuş Lie Tipi', note: 'Dynkin diyagramı simetrileriyle oluşturulan 7 aile + Tits basit grubu (|G|=17971200).' },
  { id: 'Sporadic', name: '26 Sporadik Basit Grup', latex: 'M_{11}, \\dots, M \\text{ (26 grup)}', orderFormula: '7920 \\text{ ile } \\approx 8.08\\times 10^{53}', category: 'Sporadik', note: 'Hiçbir sonsuz aileye girmeyen 26 eşsiz grup (20 Mutlu Aile + 6 Parya).' },
];

// Exact BigInt order calculator for untwisted Chevalley groups over F_q (Ramond Section 9.2).
// family ∈ {'A', 'B', 'C', 'D', 'G2', 'F4', 'E6', 'E7', 'E8'}
export function chevalleyOrder(family, n, q) {
  q = BigInt(Math.trunc(q));
  const qNum = Number(q);
  const pf = primeFactors(qNum);
  if (pf.length !== 1) throw new Error('q bir asal kuvvet p^k olmalı');
  let order = 1n, d = 1n, latex = '', simple = true, note = '';

  const prod = (exps) => {
    let p = 1n;
    for (const e of exps) p *= (q ** BigInt(e) - 1n);
    return p;
  };

  if (family === 'A') {
    n = Math.trunc(n);
    d = BigInt(gcd(n + 1, qNum - 1));
    const exps = Array.from({ length: n }, (_, i) => i + 2);
    order = (q ** BigInt((n * (n + 1)) / 2) * prod(exps)) / d;
    latex = `A_{${n}}(${qNum}) = \\mathrm{PSL}(${n + 1},\\,\\mathbb{F}_{${qNum}})`;
    simple = !(n === 1 && (qNum === 2 || qNum === 3));
    note = !simple ? 'A₁(2) ≅ S₃ ve A₁(3) ≅ A₄ basit değildir.' : `d = gcd(${n + 1}, ${qNum - 1}) = ${d}`;
  } else if (family === 'B' || family === 'C') {
    n = Math.trunc(n);
    d = BigInt(gcd(2, qNum - 1));
    const exps = Array.from({ length: n }, (_, i) => 2 * (i + 1));
    order = (q ** BigInt(n * n) * prod(exps)) / d;
    latex = `${family}_{${n}}(${qNum})`;
    simple = !(n === 2 && qNum === 2);
    note = !simple ? 'B₂(2) ≅ C₂(2) ≅ S₆ basit değildir (türev alt grubu A₆ basittir).' : `d = gcd(2, ${qNum - 1}) = ${d}`;
  } else if (family === 'D') {
    n = Math.trunc(n);
    d = BigInt(gcd(4, Number((q ** BigInt(n)) - 1n)));
    const exps = Array.from({ length: n - 1 }, (_, i) => 2 * (i + 1));
    order = (q ** BigInt(n * (n - 1)) * (q ** BigInt(n) - 1n) * prod(exps)) / d;
    latex = `D_{${n}}(${qNum})`;
    simple = n >= 4;
    note = `d = gcd(4, q^n - 1) = ${d}`;
  } else if (family === 'G2') {
    order = (q ** 6n) * prod([2, 6]);
    latex = `G_2(${qNum})`;
    simple = qNum > 2;
    note = !simple ? 'G₂(2) basit değildir; 2 indeksli türev alt grubu G₂(2)\' ≅ PSU(3,3) basittir.' : 'İstisnai Chevalley grubu G₂(q).';
  } else if (family === 'F4') {
    order = (q ** 24n) * prod([2, 6, 8, 12]);
    latex = `F_4(${qNum})`;
    note = 'İstisnai Chevalley grubu F₄(q), tüm asal kuvvet q için basittir.';
  } else if (family === 'E6') {
    d = BigInt(gcd(3, qNum - 1));
    order = ((q ** 36n) * prod([2, 5, 6, 8, 9, 12])) / d;
    latex = `E_6(${qNum})`;
    note = `d = gcd(3, ${qNum - 1}) = ${d}`;
  } else if (family === 'E7') {
    d = BigInt(gcd(2, qNum - 1));
    order = ((q ** 63n) * prod([2, 6, 8, 10, 12, 14, 18])) / d;
    latex = `E_7(${qNum})`;
    note = `d = gcd(2, ${qNum - 1}) = ${d}`;
  } else if (family === 'E8') {
    order = (q ** 120n) * prod([2, 8, 12, 14, 18, 20, 24, 30]);
    latex = `E_8(${qNum})`;
    note = 'İstisnai Chevalley grubu E₈(q); d = 1, her q için basittir.';
  } else {
    throw new Error(`Bilinmeyen Chevalley ailesi: ${family}`);
  }
  return { family, n, q: qNum, order, orderStr: order.toString(), digits: order.toString().length, d: Number(d), latex, simple, note };
}

// ---------- Appendix 1: Properties Summary Helper ----------

export function groupAppendixRow(G) {
  const ct = characterTable(G);
  const z = center(G);
  const comm = commutatorSubgroup(G);
  const simp = fastIsSimple(G);
  const cs = compositionSeries(G);
  const dims = ct.irreps.map(ir => ir.dim);
  const fsCounts = { real: 0, complex: 0, pseudoreal: 0 };
  for (const ir of ct.irreps) fsCounts[ir.fsType]++;
  return {
    name: G.name,
    latex: G.latex,
    spec: G.meta?.spec || null,
    order: G.size,
    isAbelian: isAbelian(G),
    isCyclic: isCyclic(G),
    isSimple: simp,
    isSolvable: cs.isSolvable,
    exponent: exponent(G),
    centerOrder: z.length,
    commutatorOrder: comm.length,
    abelianizationOrder: G.size / comm.length,
    classCount: ct.classCount,
    irrepDims: dims,
    fsCounts,
  };
}

export function appendixCatalogSpecs() {
  return [
    { kind: 'Z', n: 3 }, { kind: 'Z', n: 4 }, { kind: 'Z', n: 5 }, { kind: 'Z', n: 6 }, { kind: 'Z', n: 8 }, { kind: 'Z', n: 12 },
    { kind: 'V4' },
    { kind: 'Prod', left: { kind: 'Z', n: 2 }, right: { kind: 'Z', n: 3 } },
    { kind: 'D', n: 3 }, { kind: 'D', n: 4 }, { kind: 'D', n: 5 }, { kind: 'D', n: 6 }, { kind: 'D', n: 8 },
    { kind: 'Q8' }, { kind: 'Q2n', n: 3 }, { kind: 'Q2n', n: 4 },
    { kind: 'S', n: 3 }, { kind: 'S', n: 4 }, { kind: 'S', n: 5 },
    { kind: 'A', n: 4 }, { kind: 'A', n: 5 },
    { kind: 'Cube' },
    { kind: 'U', n: 8 }, { kind: 'U', n: 10 }, { kind: 'U', n: 15 },
    { kind: 'T7' },
    { kind: '2T' }, { kind: '2O' }, { kind: '2I' },
    { kind: 'Delta3', n: 3 }, { kind: 'Delta6', n: 3 },
    { kind: 'GL', dim: 2, p: 3 },
    { kind: 'PSL27' }, { kind: 'GL32' },
    { kind: 'Hessian' },
  ];
}

// ---------- Endless Exercise Generator (100% engine-backed, covering Chapters sonlu / temsil / basitlik) ----------

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function numOpts(correct, pool, rng, count = 4) {
  const set = new Set([correct]);
  for (const x of shuffle(pool, rng)) {
    if (set.size >= count) break;
    if (Number.isInteger(x) && x >= 0 && !set.has(x)) set.add(x);
  }
  let bump = 1;
  while (set.size < count) {
    if (!set.has(correct + bump)) set.add(correct + bump);
    else if (correct - bump >= 0 && !set.has(correct - bump)) set.add(correct - bump);
    bump++;
  }
  return shuffle(Array.from(set), rng);
}

const REP_GROUP_POOLS = {
  kolay: [() => dihedral(3), () => dihedral(4), () => quaternion(), () => alternating(4), () => cyclic(6), () => kleinFour()],
  orta: [() => symmetric(4), () => dihedral(5), () => dihedral(6), () => dicyclic(3), () => frobeniusT7(), () => binaryTetrahedral()],
  zor: [() => alternating(5), () => symmetric(5), () => binaryOctahedral(), () => delta3n2(3), () => psl2_7(), () => binaryIcosahedral()],
};

function qCharDim(diff, rng) {
  const G = pick(REP_GROUP_POOLS[diff], rng)();
  const ct = characterTable(G);
  const nonTriv = ct.irreps.filter(ir => !ir.isTrivial);
  const hidden = pick(nonTriv, rng);
  const shown = ct.irreps.filter(ir => ir.index !== hidden.index).map(ir => ir.dim);
  const ans = hidden.dim;
  const opts = numOpts(ans, [1, 2, 3, 4, 5, 6, 7, 8, ans + 1, Math.max(1, ans - 1)], rng);
  const sumRest = shown.reduce((s, d) => s + d * d, 0);
  return {
    chapter: 'temsil', type: 'charDim', difficulty: diff, topic: 'İrrep boyut karesi toplamı',
    prompt: `Mertebesi $|G| = ${G.size}$ olan $${G.latex}$ grubunun $${ct.classCount}$ indirgenemez temsilinden $${ct.classCount - 1}$ tanesinin boyutları $${shown.join(',\\, ')}$ ise eksik temsilin boyutu $d$ kaçtır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `Büyük Diklik Teoremi gereği $\\sum d_i^2 = |G| = ${G.size}$. Verilen boyutların kareleri toplamı $${sumRest}$ olduğundan $d^2 = ${G.size} - ${sumRest} = ${ans * ans} \\implies d = ${ans}$.`,
  };
}

function qAbelian1D(diff, rng) {
  const G = pick(REP_GROUP_POOLS[diff], rng)();
  const ct = characterTable(G);
  const ans = ct.irreps.filter(ir => ir.dim === 1).length;
  const comm = commutatorSubgroup(G).length;
  const opts = numOpts(ans, divisors(G.size).concat([1, 2, 3, 4, 6]), rng);
  return {
    chapter: 'temsil', type: 'abelian1D', difficulty: diff, topic: '1-boyutlu temsil sayısı',
    prompt: `$${G.latex}$ grubunun kaç tane $1$-boyutlu indirgenemez temsili vardır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `$1$-boyutlu temsillerin sayısı Abelyenleştirme mertebesine eşittir: $|G/[G,G]| = ${G.size}/${comm} = ${ans}$.`,
  };
}

function qFSIndicator(diff, rng) {
  const pool = diff === 'kolay'
    ? [quaternion(), alternating(4), dihedral(4), cyclic(3)]
    : diff === 'orta'
      ? [dicyclic(3), frobeniusT7(), binaryTetrahedral(), symmetric(4)]
      : [binaryOctahedral(), binaryIcosahedral(), psl2_7(), delta3n2(3)];
  const G = pick(pool, rng);
  const ct = characterTable(G);
  const interesting = ct.irreps.filter(ir => !ir.isTrivial);
  const ir = pick(interesting, rng);
  const idxMap = { real: 0, complex: 1, pseudoreal: 2 };
  return {
    chapter: 'temsil', type: 'fsIndicator', difficulty: diff, topic: 'Frobenius–Schur göstergesi',
    prompt: `$${G.latex}$ grubunun $${ir.latex}$ (boyut $${ir.dim}$) indirgenemez temsilinin Frobenius–Schur göstergesi $\\iota(\\chi) = \\frac{1}{|G|}\\sum_{g\\in G}\\chi(g^2)$ hangi türdedir?`,
    options: ['Gerçek ($\\iota = +1$)', 'Karmaşık ($\\iota = 0$)', 'Sözde-gerçek / Kuaterniyonik ($\\iota = -1$)'],
    answerIndex: idxMap[ir.fsType],
    explanation: `Motor karakter tablosundan $\\iota(${ir.latex}) = ${ir.fsIndicator}$ hesaplar: **${ir.fsLabel}**. ${ir.fsIndicator === -1 ? 'Bu temsil kendisinin eşleniği olmasına rağmen gerçek matrislerle yazılamaz (spinörel/antisimetrik değişmez).' : ir.fsIndicator === 0 ? 'Karakter karmaşık değerler alır ve $\\chi \\neq \\bar\\chi$.' : 'Gerçek matris tabanında yazılabilir (simetrik bilineer değişmez vardır).'}`,
  };
}

function qKronecker(diff, rng) {
  const pool = diff === 'kolay'
    ? [dihedral(3), dihedral(4), alternating(4), quaternion()]
    : diff === 'orta'
      ? [symmetric(4), frobeniusT7(), binaryTetrahedral(), dihedral(5)]
      : [alternating(5), binaryOctahedral(), psl2_7(), delta3n2(3)];
  const G = pick(pool, rng);
  const ct = characterTable(G);
  const high = ct.irreps.filter(ir => ir.dim >= 2);
  const irA = pick(high, rng);
  const irB = pick(high, rng);
  const kp = kroneckerProduct(G, irA.index, irB.index);
  const correct = kp.latex;
  // Build plausible wrong decompositions of same dimension
  const wrongs = new Set();
  for (const altA of ct.irreps) {
    for (const altB of ct.irreps) {
      if (wrongs.size >= 3) break;
      const kp2 = kroneckerProduct(G, altA.index, altB.index);
      if (kp2.dim === kp.dim && kp2.latex !== correct) wrongs.add(kp2.latex);
    }
  }
  // Fallback distractors by adjusting copies of trivial rep
  let extra = 0;
  while (wrongs.size < 3 && extra < 10) {
    extra++;
    const cand = `${kp.dim}\\,\\mathbf{1}` + (extra > 1 ? `\\;(${extra})` : '');
    const fake1 = `\\mathbf{1} \\oplus ${kp.dim - 1}\\,\\mathbf{1}'`;
    if (extra === 1 && kp.dim >= 2 && fake1 !== correct) wrongs.add(fake1);
    else if (extra === 2 && `${kp.dim}\\,\\mathbf{1}` !== correct) wrongs.add(`${kp.dim}\\,\\mathbf{1}`);
    else {
      const some = ct.irreps.find(x => x.dim === kp.dim - 1);
      const s = some ? `\\mathbf{1} \\oplus ${some.latex}` : `${irA.latex} \\oplus ${irB.latex}`;
      if (s !== correct) wrongs.add(s);
      else wrongs.add(`${extra}\\,\\mathbf{1} \\oplus ${irA.latex}`);
    }
  }
  const opts = shuffle([correct, ...Array.from(wrongs).slice(0, 3)], rng);
  return {
    chapter: 'temsil', type: 'kronecker', difficulty: diff, topic: 'Kronecker (tensör) çarpımı',
    prompt: `$${G.latex}$ grubunda $${irA.latex} \\otimes ${irB.latex}$ Kronecker çarpımının indirgenemez ayrışımı hangisidir?`,
    options: opts.map(x => `$${x}$`),
    answerIndex: opts.indexOf(correct),
    explanation: `Boyut $${irA.dim} \\times ${irB.dim} = ${kp.dim}$. Karakter çarpımının iç çarpımlarıyla $${irA.latex} \\otimes ${irB.latex} = ${kp.latex}$ elde edilir.`,
  };
}

function qMolien(diff, rng) {
  const cases = diff === 'kolay'
    ? [[dihedral(3), 2], [dihedral(4), 2], [alternating(4), 2], [alternating(4), 3]]
    : diff === 'orta'
      ? [[symmetric(4), 2], [symmetric(4), 3], [alternating(4), 4], [dihedral(5), 2]]
      : [[alternating(5), 2], [alternating(5), 3], [binaryTetrahedral(), 4], [psl2_7(), 3]];
  const [G, deg] = pick(cases, rng);
  const ct = characterTable(G);
  const ir = ct.irreps.find(x => x.dim >= 2 && x.isFaithful) || ct.irreps.find(x => x.dim >= 2);
  const m = molienSeries(G, ir.index, Math.max(deg, 6));
  const ans = m.molien[deg];
  const opts = numOpts(ans, [0, 1, 2, 3, 4], rng);
  return {
    chapter: 'temsil', type: 'molien', difficulty: diff, topic: 'Değişmezler & Molien serisi',
    prompt: `$${G.latex}$ grubunun $${ir.latex}$ (boyut $${ir.dim}$) temsilinde derece $${deg}$ homojen simetrik değişmez polinomların sayısı $c_{${deg}} = [t^{${deg}}]M(t)$ kaçtır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `Molien serisi $M(t) = ${m.seriesLatex}$ olarak hesaplanır; $t^{${deg}}$ katsayısı $c_{${deg}} = ${ans}$ bulunur.`,
  };
}

function qBranchingInd(diff, rng) {
  const pairs = diff === 'kolay'
    ? [[dihedral(3), 3], [alternating(4), 4], [dihedral(4), 4]]
    : diff === 'orta'
      ? [[symmetric(4), 12], [frobeniusT7(), 7], [binaryTetrahedral(), 8]]
      : [[alternating(5), 12], [binaryOctahedral(), 24], [symmetric(4), 8]];
  const [G, subOrd] = pick(pairs, rng);
  const sub = subgroups(G).find(s => s.order === subOrd);
  const ri = restrictionAndInduction(G, sub.elements);
  const psi = pick(ri.ctH.irreps, rng);
  const ind = ri.inductions[psi.index];
  const ans = ind.dim;
  const opts = numOpts(ans, [ans / 2, ans * 2, psi.dim, ri.index, ans + psi.dim].map(Math.round).filter(x => x > 0), rng);
  return {
    chapter: 'temsil', type: 'branchingInd', difficulty: diff, topic: 'İndüklenmiş temsil boyutu',
    prompt: `$${G.latex}$ ($|G|=${G.size}$) grubunun $|H|=${subOrd}$ mertebeli bir $H$ alt grubundan, boyutu $${psi.dim}$ olan $${psi.latex}$ temsili $G$’ye indüklenirse $\\dim(\\operatorname{Ind}_H^G ${psi.latex})$ kaç olur?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `İndüklenmiş temsilin boyutu daima indeksle çarpılır: $\\dim(\\operatorname{Ind}_H^G \\psi) = [G:H]\\cdot \\dim(\\psi) = ${ri.index} \\times ${psi.dim} = ${ans}$. Ayrışımı: $${ind.latex}$.`,
  };
}

function qMcKayCover(diff, rng) {
  const entries = [
    { G: binaryTetrahedral(), so3: 'A_4', ade: '\\widetilde{E}_6', nodes: 7, spinors: 3 },
    { G: binaryOctahedral(), so3: 'S_4', ade: '\\widetilde{E}_7', nodes: 8, spinors: 3 },
    { G: binaryIcosahedral(), so3: 'A_5', ade: '\\widetilde{E}_8', nodes: 9, spinors: 4 },
    { G: dicyclic(3), so3: 'D_3', ade: '\\widetilde{D}_5', nodes: 6, spinors: 2 },
    { G: dicyclic(4), so3: 'D_4', ade: '\\widetilde{D}_6', nodes: 7, spinors: 3 },
  ];
  const item = pick(entries, rng);
  const mk = mckayGraph(item.G);
  const askAde = rng() < 0.55;
  if (askAde) {
    const allAde = ['\\widetilde{E}_6', '\\widetilde{E}_7', '\\widetilde{E}_8', '\\widetilde{D}_5', '\\widetilde{D}_6'];
    const wrongs = shuffle(allAde.filter(x => x !== item.ade), rng).slice(0, 3);
    const opts = shuffle([item.ade, ...wrongs], rng);
    return {
      chapter: 'temsil', type: 'mckayCover', difficulty: diff, topic: 'McKay karşılığı (ADE)',
      prompt: `$${item.so3} \\subset \\mathrm{SO}(3)$ grubunun $\\mathrm{SU}(2)$ içindeki ikili örtüsü $${item.G.latex}$ ($|G|=${item.G.size}$) için McKay grafı hangi genişletilmiş Dynkin diyagramını verir?`,
      options: opts.map(x => `$${x}$`),
      answerIndex: opts.indexOf(item.ade),
      explanation: `$${item.G.latex}$ grubunun $${mk.nodes.length}$ irrep’i ($d_i = ${mk.dims.join(',\\,')}$) 2-boyutlu spinör temsille tensörlendiğinde tam olarak $${mk.adeLatex}$ genişletilmiş Dynkin diyagramı oluşur!`,
    };
  }
  const spinorCount = mk.nodes.filter(n => n.parity === 'spinor').length;
  const opts = numOpts(spinorCount, [1, 2, 3, 4, 5, 6], rng);
  return {
    chapter: 'temsil', type: 'mckayCover', difficulty: diff, topic: 'İkili örtü & spinör temsilleri',
    prompt: `$${item.G.latex}$ ikili örtü grubunun ($\\chi(-1) = -d$ sağlayan) kaç tane **spinörsel (projektif)** indirgenemez temsili vardır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(spinorCount),
    explanation: `$${item.G.latex}$ toplam $${mk.nodes.length}$ irrep’e sahiptir; bunların $${mk.nodes.length - spinorCount}$ tanesi $${item.so3}$’e iner ($\\chi(-1)=+d$), kalan $${spinorCount}$ tanesi spinörseldir ($\\chi(-1)=-d$).`,
  };
}

function qYoungHook(diff, rng) {
  const n = diff === 'kolay' ? pick([3, 4], rng) : diff === 'orta' ? pick([4, 5], rng) : pick([5, 6], rng);
  const parts = partitions(n).filter(p => p.length > 1 && p[0] > 1);
  const lam = pick(parts, rng);
  const ans = hookDimension(lam);
  const hooks = hookLengths(lam);
  const hookList = hooks.flat().join('\\cdot ');
  const allDims = partitions(n).map(hookDimension);
  const opts = numOpts(ans, allDims.concat([ans + 1, ans + 2, Math.max(1, ans - 1)]), rng);
  return {
    chapter: 'sonlu', type: 'youngHook', difficulty: diff, topic: 'Young diyagramı kanca formülü',
    prompt: `$S_{${n}}$ için $\\lambda = (${lam.join(',\\,')})$ Young diyagramına karşılık gelen indirgenemez temsilin boyutu $f^{\\lambda}$ kaçtır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `Kanca uzunlukları formülü: $f^{(${lam.join(',')})} = \\frac{${n}!}{${hookList}} = ${ans}$.`,
  };
}

function qSemiDirect(diff, rng) {
  const cases = [
    { q: '$\\mathbb{Z}_7 \\rtimes \\mathbb{Z}_3$ ($\\varphi(1)(n)=2n$) Frobenius grubunun mertebesi ve değişmeliliği nedir?', a: 'Mertebe $21$, değişmeli değil', w: ['Mertebe $21$, Abelyen', 'Mertebe $10$, değişmeli değil', 'Mertebe $42$, değişmeli değil'], exp: '$|\\mathbb{Z}_7 \\rtimes \\mathbb{Z}_3| = 7\\cdot 3 = 21$; eylem aşikar olmadığından ($2\\not\\equiv 1 \\pmod 7$) en küçük tek mertebeli Abelyen olmayan gruptur.' },
    { q: '$V_4 \\rtimes \\mathbb{Z}_3$ ($\\mathbb{Z}_3$, $V_4$’ün 3 birim dışı elemanını devirsel permüte eder) hangi gruba izomorftur?', a: '$A_4$', w: ['$D_6$', '$\\mathbb{Z}_{12}$', '$Q_6$'], exp: '$V_4 \\triangleleft A_4$ normal alt grup ve $A_4/V_4 \\cong \\mathbb{Z}_3$ olduğundan $A_4 \\cong V_4 \\rtimes \\mathbb{Z}_3$ ($|G|=12$).' },
    { q: 'Ramond notasyonunda ikili dihedral grup $Q_{2n}$’in mertebesi kaçtır (ör. $Q_4 \\cong Q_8$)?', a: '$4n$', w: ['$2n$', '$2n^2$', '$8n$'], exp: 'Ramond (Bölüm 3.9) konvansiyonunda $Q_{2n}$, $D_n$ ($|D_n|=2n$) grubunun ikili örtüsü olduğundan $|Q_{2n}| = 4n$ ve $n=2$ için $Q_4 \\cong Q_8$ olur.' },
    { q: '$A_4 \\rtimes \\mathbb{Z}_2$ (bir transpozisyonun eşlenik eylemiyle) hangi gruba izomorftur?', a: '$S_4$', w: ['$2T$', '$A_4 \\times \\mathbb{Z}_2$', '$D_{12}$'], exp: '$A_4 \\triangleleft S_4$ ve herhangi bir transpozisyon $t$ ile $S_4 = A_4 \\rtimes \\langle t \\rangle$ ayrışır.' },
    { q: '$\\Delta(27) = (\\mathbb{Z}_3 \\times \\mathbb{Z}_3) \\rtimes \\mathbb{Z}_3$ grubunun mertebesi ve irrep boyutları nedir?', a: '$27$; dokuz $1$B + iki $3$B', w: ['$27$; yirmi yedi $1$B', '$27$; üç $1$B + altı $2$B', '$54$; iki $1$B + dört $2$B + dört $3$B'], exp: '$9\\cdot 1^2 + 2\\cdot 3^2 = 9 + 18 = 27$. $\\Delta(27)$ Abelyen değildir ve $SU(3)$’ün ünlü sonlu alt grubudur.' },
  ];
  const c = pick(cases, rng);
  const opts = shuffle([c.a, ...c.w], rng);
  return {
    chapter: 'sonlu', type: 'semiDirect', difficulty: diff, topic: 'Yarı-direkt çarpım ve sonlu gruplar',
    prompt: c.q, options: opts, answerIndex: opts.indexOf(c.a), explanation: c.exp,
  };
}

function qSylowSimple(diff, rng) {
  const pool = diff === 'kolay'
    ? [alternating(4), symmetric(3), dihedral(5), frobeniusT7()]
    : diff === 'orta'
      ? [symmetric(4), alternating(5), binaryTetrahedral(), dihedral(6)]
      : [psl2_7(), symmetric(5), binaryOctahedral(), binaryIcosahedral()];
  const G = pick(pool, rng);
  const sa = sylowAnalysis(G);
  const entry = pick(sa, rng);
  const ans = entry.count;
  const opts = numOpts(ans, entry.allowedNp.concat([1, entry.prime + 1, ans + entry.prime]), rng);
  return {
    chapter: 'basitlik', type: 'sylowSimple', difficulty: diff, topic: 'Sylow p-alt grubu sayısı',
    prompt: `$${G.latex}$ ($|G|=${G.size}$) grubunun kaç tane Sylow $${entry.prime}$-alt grubu ($n_{${entry.prime}}$) vardır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `$|G| = ${entry.prime}^{${entry.power}} \\cdot ${entry.cofactor}$. Sylow ölçütleri $n_{${entry.prime}} \\equiv 1 \\pmod{${entry.prime}}$ ve $n_{${entry.prime}} \\mid ${entry.cofactor}$ izinli değerleri $\\{${entry.allowedNp.join(',\\,')}\\}$ verir; $${G.latex}$ için gerçek sayı $n_{${entry.prime}} = ${ans}$ (${entry.isNormal ? 'normal alt grup!' : 'normal değil'}).`,
  };
}

function qPslFanoSporadic(diff, rng) {
  const data = psl27AndGl32Data();
  const M = SPORADIC_GROUPS.find(g => g.id === 'M');
  const M11 = SPORADIC_GROUPS.find(g => g.id === 'M11');
  const bank = [
    {
      q: '$\\mathrm{PSL}(2,7) \\cong \\mathrm{GL}(3,2)$ basit grubunun mertebesi ve Fano düzlemindeki noktaların sayısı kaçtır?',
      a: '$|G| = 168$, $7$ nokta (ve $7$ doğru)',
      w: ['$|G| = 336$, $7$ nokta', '$|G| = 168$, $8$ nokta (Fano)', '$|G| = 60$, $7$ nokta'],
      exp: '$|\\mathrm{SL}(2,7)| = 336$, $\\{\\pm I\\}$ bölümünden $|\\mathrm{PSL}(2,7)| = 168 = (2^3-1)(2^3-2)(2^3-4) = |\\mathrm{GL}(3,2)|$. Fano düzlemi $\\mathbb{P}^2(\\mathbb{F}_2)$ tam $7$ nokta ve $7$ doğru içerir.',
    },
    {
      q: '$\\mathrm{GL}(3,2)$ Fano düzleminin $7$ noktası üzerinde **iki kez geçişli** (doubly transitive) etki eder. İki farklı noktayı sabitleyen alt grubun mertebesi kaçtır?',
      a: `$${data.fanoTransitivity.pairStabilizerOrder}$`,
      w: ['$3$', '$6$', '$24$'],
      exp: `İki kez geçişli etkide $7\\times 6 = 42$ sıralı çift tek bir yörüngededir; dolayısıyla çift sabitleyici mertebesi $168 / 42 = ${data.fanoTransitivity.pairStabilizerOrder}$ olur.`,
    },
    {
      q: '$\\mathrm{PSL}(2,7)$ projektif doğrusu $\\mathbb{P}^1(\\mathbb{F}_7)$ üzerindeki $8$ noktada iki kez geçişli etki eder. İki farklı noktayı sabitleyen alt grubun mertebesi kaçtır?',
      a: `$${data.p1Transitivity.pairStabilizerOrder}$`,
      w: ['$4$', '$7$', '$21$'],
      exp: `$8\\times 7 = 56$ sıralı çift için sabitleyici mertebesi $168 / 56 = ${data.p1Transitivity.pairStabilizerOrder}$ bulunur.`,
    },
    {
      q: 'Sonlu basit grupların sınıflandırmasında kaç tane **sporadik** basit grup vardır ve bunların kaç tanesi Monster grubunun alt-bölümü ("Mutlu Aile") içindedir?',
      a: '$26$ sporadik ($20$ Mutlu Aile + $6$ Parya)',
      w: ['$26$ sporadik ($26$’sı da Monster içinde)', '$24$ sporadik ($18$ Mutlu Aile + $6$ Parya)', '$20$ sporadik ($14$ Mutlu Aile + $6$ Parya)'],
      exp: 'Toplam $26$ sporadik basit grup vardır: $20$ tanesi Monster $M$ içinde subquotient olarak yer alır (Mutlu Aile); kalan $6$ tanesi ($J_1, J_3, J_4, O\'N, Ru, Ly$) **Parya** gruplardır.',
    },
    {
      q: 'En küçük sporadik basit grup $M_{11}$’in mertebesi ve Monster $M$’in basamak sayısı nedir?',
      a: `$|M_{11}| = ${M11.orderStr}$, Monster $${M.digits}$ basamaklı`,
      w: ['$|M_{11}| = 95040$, Monster $54$ basamaklı', '$|M_{11}| = 7920$, Monster $34$ basamaklı', '$|M_{11}| = 168$, Monster $54$ basamaklı'],
      exp: `$|M_{11}| = 2^4\\cdot 3^2\\cdot 5\\cdot 11 = ${M11.orderStr}$. Monster $|M| \\approx 8.08\\times 10^{53}$ olup tam $${M.digits}$ basamaklıdır.`,
    },
  ];
  const item = pick(bank, rng);
  const opts = shuffle([item.a, ...item.w], rng);
  return {
    chapter: 'basitlik', type: 'pslFano', difficulty: diff, topic: 'Galois cisimleri, PSL(2,7) & Sporadik gruplar',
    prompt: item.q, options: opts, answerIndex: opts.indexOf(item.a), explanation: item.exp,
  };
}

function qComposition(diff, rng) {
  const pool = diff === 'kolay'
    ? [symmetric(3), alternating(4), dihedral(4)]
    : diff === 'orta'
      ? [symmetric(4), frobeniusT7(), binaryTetrahedral()]
      : [symmetric(5), alternating(5), binaryIcosahedral(), psl2_7()];
  const G = pick(pool, rng);
  const cs = compositionSeries(G);
  const ans = cs.isSolvable ? 0 : 1;
  const fTex = cs.factors.map(f => f.latex).join(',\\; ');
  return {
    chapter: 'basitlik', type: 'composition', difficulty: diff, topic: 'Kompozisyon serisi & çözülebilirlik',
    prompt: `$${G.latex}$ ($|G|=${G.size}$) grubu Jordan–Hölder kompozisyon çarpanlarına göre **çözülebilir (solvable)** midir?`,
    options: ['Evet, tüm kompozisyon çarpanları Abelyendir ($\\mathbb{Z}_p$)', 'Hayır, Abelyen olmayan basit bir kompozisyon çarpanı içerir'],
    answerIndex: ans,
    explanation: `$${G.latex}$ grubunun kompozisyon çarpanları: $${fTex}$. ${cs.isSolvable ? 'Hepsi asal mertebeli devirli grup olduğundan çözülebilirdir.' : 'En az bir çarpan Abelyen olmayan basit grup olduğundan çözülebilir değildir.'}`,
  };
}

function qMurnaghan(diff, rng) {
  const n = diff === 'kolay' ? 3 : diff === 'orta' ? 4 : 5;
  const parts = partitions(n);
  const lam = pick(parts.filter(p => p.length > 1 && p[0] > 1), rng);
  const mu = pick(parts.filter(p => p.length < n), rng);
  const ans = murnaghanNakayama(lam, mu);
  const pool = [-3, -2, -1, 0, 1, 2, 3, 4].filter(x => x !== ans);
  const opts = shuffle([ans, ...shuffle(pool, rng).slice(0, 3)], rng);
  return {
    chapter: 'sonlu', type: 'murnaghan', difficulty: diff, topic: 'Murnaghan–Nakayama kuralı',
    prompt: `$S_{${n}}$ simetrik grubunda $\\lambda = (${lam.join(',\\,')})$ Young diyagramının devir tipi $\\mu = (${mu.join(',\\,')})$ olan eşlenik sınıftaki karakter değeri $\\chi^{\\lambda}(\\mu)$ kaçtır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `Murnaghan–Nakayama kuralına göre $\\lambda = (${lam.join(',')})$ diyagramından sırayla $\\mu = (${mu.join(',')})$ uzunluklu sınır kancaları (rim hooks) $(-1)^{\\text{bacak}}$ işaretiyle çıkarılınca $\\chi^{(${lam.join(',')})}(${mu.join(',')}) = ${ans}$ elde edilir.`,
  };
}

function qSylowScreen(diff, rng) {
  const candidates = diff === 'kolay'
    ? [15, 21, 30, 45, 60]
    : diff === 'orta'
      ? [36, 48, 56, 60, 168, 200]
      : [60, 112, 168, 255, 360, 504];
  const N = pick(candidates, rng);
  const scr = sylowOrderScreen(N);
  const ans = scr.canBeNonAbelianSimple ? 0 : 1;
  return {
    chapter: 'basitlik', type: 'sylowScreen', difficulty: diff, topic: 'Sylow basitlik eleği',
    prompt: `Mertebesi $|G| = ${N}$ olan **Abelyen olmayan basit** bir sonlu grup var mıdır?`,
    options: ['Evet, bu mertebede Abelyen olmayan basit grup vardır', 'Hayır, Sylow / Burnside / Tek Mertebe ölçütleri bunu yasaklar'],
    answerIndex: ans,
    explanation: scr.verdict,
  };
}

const REP_QUESTION_MAKERS = {
  sonlu: [
    ['youngHook', qYoungHook],
    ['murnaghan', qMurnaghan],
    ['semiDirect', qSemiDirect],
  ],
  temsil: [
    ['charDim', qCharDim],
    ['abelian1D', qAbelian1D],
    ['fsIndicator', qFSIndicator],
    ['kronecker', qKronecker],
    ['molien', qMolien],
    ['branchingInd', qBranchingInd],
    ['mckayCover', qMcKayCover],
  ],
  basitlik: [
    ['sylowSimple', qSylowSimple],
    ['sylowScreen', qSylowScreen],
    ['composition', qComposition],
    ['pslFano', qPslFanoSporadic],
  ],
};

export function generateRepQuizQuestion(chapter = 'temsil', difficulty = 'orta', rng = Math.random, forceType = null) {
  const diff = ['kolay', 'orta', 'zor'].includes(difficulty) ? difficulty : 'orta';
  const allMakers = chapter === 'all'
    ? [...REP_QUESTION_MAKERS.sonlu, ...REP_QUESTION_MAKERS.temsil, ...REP_QUESTION_MAKERS.basitlik]
    : (REP_QUESTION_MAKERS[chapter] || REP_QUESTION_MAKERS.temsil);
  if (forceType) {
    const found = allMakers.find(([k]) => k === forceType);
    if (found) return found[1](diff, rng);
  }
  return pick(allMakers, rng)[1](diff, rng);
}

export {
  cyclic, dihedral, symmetric, alternating, kleinFour, quaternion, unitGroup, directProduct, cubeRotations,
  dicyclic, binaryTetrahedral, binaryOctahedral, binaryIcosahedral, frobeniusT7,
  psl2_7, gl3_2, sl, gl, psl, delta3n2, delta6n2, hessian216, semiDirect,
};
