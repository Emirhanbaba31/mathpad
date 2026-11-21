// Part 3 (ozgun): Original FZT 203E-style group-theory problem templates through fresh physics & real-world stories.
// Pure ES module (no DOM, no ui.js/fx.js). All answers computed algorithmically in course conventions.
import {
  gcd, lcm, mod, divisors,
  permId, permMul, permInv, permEq, permCycles, cyclesString, permOrder, permSign, cycleType,
  dEl, dMul, dInv, dEq, dOrder, dName, dAll, dPerm,
} from './gtps-kit.js';

// ---------- local pure helpers ----------

function eulerPhi(n) {
  let res = n, m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      res = (res / p) * (p - 1);
    }
  }
  if (m > 1) res = (res / m) * (m - 1);
  return res;
}

function roundNum(x, digits = 4) {
  const r = Number(x.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
}

/** Unique representative of x mod P in (-P/2, P/2]. */
function wrapHalfOpen(x, P) {
  let r = ((x % P) + P) % P;
  if (r > P / 2 + 1e-12) r -= P;
  return Math.abs(r) < 1e-12 ? 0 : r;
}

function shuffleChoice(rng, correctText, distractors) {
  const uniqueD = [...new Set(distractors)].filter(d => d !== correctText);
  const options = rng.shuffle([correctText, ...uniqueD]);
  return { type: 'choice', options, value: options.indexOf(correctText) };
}

function makeLabels(parts) {
  return parts.map((p, i) => ({ label: String.fromCharCode(97 + i), ...p }));
}

const dTex = x => dName(x, true);
const dSetTex = arr => `\\{${arr.map(x => dName(x, true)).join(',\\,')}\\}`;
const intSetTex = arr => `\\{${[...arr].sort((a, b) => a - b).join(',\\,')}\\}`;
const dKey = x => `${x.k}:${x.m}`;

function dUnique(arr) {
  const seen = new Set(), out = [];
  for (const x of arr) {
    const k = dKey(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out.sort((a, b) => a.m - b.m || a.k - b.k);
}

function dSetEq(A, B) {
  const sa = new Set(A.map(dKey)), sb = new Set(B.map(dKey));
  return sa.size === sb.size && [...sa].every(k => sb.has(k));
}

function dConj(n, g, a) {
  return dMul(n, dMul(n, dInv(n, g), a), g);
}

function dConjClass(n, a) {
  return dUnique(dAll(n).map(g => dConj(n, g, a)));
}

function dIsNormal(n, sub) {
  const set = new Set(sub.map(dKey));
  for (const g of dAll(n)) {
    for (const h of sub) {
      if (!set.has(dKey(dConj(n, g, h)))) return false;
    }
  }
  return true;
}

function dNormalCore(n, sub) {
  const set = new Set(sub.map(dKey));
  return dUnique(sub.filter(h => dAll(n).every(g => set.has(dKey(dConj(n, g, h))))));
}

function dNormalizer(n, sub) {
  const set = new Set(sub.map(dKey));
  return dUnique(dAll(n).filter(g => sub.every(h => set.has(dKey(dConj(n, g, h))))));
}

function dLeftCoset(n, g, sub) {
  return dUnique(sub.map(h => dMul(n, g, h)));
}

function dFixedPoints(n, x) {
  const p = dPerm(n, x);
  const out = [];
  for (let i = 1; i <= n; i++) if (p[i - 1] === i) out.push(i);
  return out;
}

function dApplyToSet(n, g, subset) {
  const p = dPerm(n, g);
  return subset.map(v => p[v - 1]).sort((a, b) => a - b);
}

function dStabOfSet(n, subset) {
  const want = [...subset].sort((a, b) => a - b).join(',');
  return dUnique(dAll(n).filter(g => dApplyToSet(n, g, subset).join(',') === want));
}

function dCosetMappingSet(n, src, dst) {
  const want = [...dst].sort((a, b) => a - b).join(',');
  return dUnique(dAll(n).filter(g => dApplyToSet(n, g, src).join(',') === want));
}

function dApplyToMatching(n, g, pairs) {
  const p = dPerm(n, g);
  return pairs
    .map(([u, v]) => {
      const a = p[u - 1], b = p[v - 1];
      return a < b ? `${a}-${b}` : `${b}-${a}`;
    })
    .sort()
    .join(',');
}

function dStabOfMatching(n, pairs) {
  const want = pairs.map(([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`)).sort().join(',');
  return dUnique(dAll(n).filter(g => dApplyToMatching(n, g, pairs) === want));
}

function dCosetMappingMatching(n, srcPairs, dstPairs) {
  const want = dstPairs.map(([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`)).sort().join(',');
  return dUnique(dAll(n).filter(g => dApplyToMatching(n, g, srcPairs) === want));
}

function permTex(p) {
  const cs = permCycles(p);
  if (!cs.length) return 'e';
  const sep = p.length < 10 ? '' : '\\,';
  return cs.map(c => `(${c.join(sep)})`).join('');
}

function permFromCycles(n, cycs) {
  let res = permId(n);
  for (let i = cycs.length - 1; i >= 0; i--) {
    const cyc = cycs[i];
    const c = permId(n);
    for (let j = 0; j < cyc.length; j++) c[cyc[j] - 1] = cyc[(j + 1) % cyc.length];
    res = permMul(c, res);
  }
  return res;
}

const SIGN_OPTS = [
  '$+1$ (çift permütasyon)',
  '$-1$ (tek permütasyon)',
];

// ---------- Exact CRT solver (coprime or non-coprime) ----------

function crtPair(a, p, b, q) {
  const g = gcd(p, q);
  if (mod(b - a, g) !== 0) return null;
  const L = lcm(p, q);
  const a0 = mod(a, p), b0 = mod(b, q);
  for (let k = 0; k < q / g; k++) {
    const cand = a0 + k * p;
    if (mod(cand, q) === b0) return { rem: mod(cand, L), mod: L };
  }
  return null;
}

function crtSystem(pairs) {
  let cur = { rem: mod(pairs[0][0], pairs[0][1]), mod: pairs[0][1] };
  for (let i = 1; i < pairs.length; i++) {
    cur = crtPair(cur.rem, cur.mod, pairs[i][0], pairs[i][1]);
    if (!cur) return null;
  }
  return cur;
}

// ---------- Exact 16-element Pauli group P_1 via 2x2 complex matrix multiplication ----------

const PAULI_DATA = (() => {
  const cAdd = (u, v) => [u[0] + v[0], u[1] + v[1]];
  const cMul = (u, v) => [u[0] * v[0] - u[1] * v[1], u[0] * v[1] + u[1] * v[0]];
  const mScale = (s, M) => M.map(row => row.map(z => cMul(s, z)));
  const mMul = (A, B) => [0, 1].map(i => [0, 1].map(j =>
    cAdd(cMul(A[i][0], B[0][j]), cMul(A[i][1], B[1][j]))
  ));
  const mKey = M => M.flat().map(z => `${z[0]},${z[1]}`).join(';');

  const BASE = [
    { sym: 'I', mat: [[[1, 0], [0, 0]], [[0, 0], [1, 0]]] },
    { sym: 'X', mat: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]] },
    { sym: 'Y', mat: [[[0, 0], [0, -1]], [[0, 1], [0, 0]]] },
    { sym: 'Z', mat: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]] },
  ];
  const PHASES = [
    { pre: '', s: [1, 0] },
    { pre: '-', s: [-1, 0] },
    { pre: 'i', s: [0, 1] },
    { pre: '-i', s: [0, -1] },
  ];

  const elems = [];
  const byKey = new Map();
  for (const b of BASE) {
    for (const ph of PHASES) {
      const mat = mScale(ph.s, b.mat);
      const label = `${ph.pre}${b.sym}`;
      const idx = elems.length;
      elems.push({ idx, label, tex: `$${label}$`, base: b.sym, phase: ph.pre || '+', mat });
      byKey.set(mKey(mat), idx);
    }
  }

  const N = elems.length; // 16
  const mulTable = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => byKey.get(mKey(mMul(elems[i].mat, elems[j].mat))))
  );
  const invTable = Array.from({ length: N }, (_, i) => mulTable[i].indexOf(0));
  const ordTable = Array.from({ length: N }, (_, i) => {
    let cur = i, k = 1;
    while (cur !== 0) { cur = mulTable[cur][i]; k++; }
    return k;
  });

  const mul = (i, j) => mulTable[i][j];
  const inv = i => invTable[i];
  const ord = i => ordTable[i];
  const conj = (g, a) => mul(mul(inv(g), a), g);
  const comm = (a, b) => mul(mul(mul(a, b), inv(a)), inv(b));
  const center = elems.filter((_, i) => elems.every((_, g) => mul(i, g) === mul(g, i))).map(e => e.idx);
  const conjClasses = (() => {
    const seen = new Set(), out = [];
    for (let a = 0; a < N; a++) {
      if (seen.has(a)) continue;
      const cls = [...new Set(elems.map((_, g) => conj(g, a)))].sort((x, y) => x - y);
      cls.forEach(x => seen.add(x));
      out.push(cls);
    }
    return out;
  })();

  const byLabel = new Map(elems.map(e => [e.label, e.idx]));
  return { elems, mul, inv, ord, conj, comm, center, conjClasses, byLabel };
})();

// ---------- Exact GF(2) Lights Out engine (cached per rows x cols) ----------

const LIGHTS_CACHE = new Map();

function popcount(mask) {
  let c = 0, x = mask;
  while (x) { x &= x - 1; c++; }
  return c;
}

function maskToCells(mask, N) {
  const out = [];
  for (let i = 0; i < N; i++) if ((mask >> i) & 1) out.push(i + 1);
  return out;
}

function cellsToMask(cells) {
  let m = 0;
  for (const c of cells) m |= 1 << (c - 1);
  return m;
}

function gridMatrixTex(mask, rows, cols) {
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push((mask >> (r * cols + c)) & 1 ? '1' : '0');
    }
    lines.push(row.join(' & '));
  }
  return `\\begin{pmatrix} ${lines.join(' \\\\ ')} \\end{pmatrix}`;
}

function getLightsSystem(rows, cols) {
  const key = `${rows}x${cols}`;
  if (LIGHTS_CACHE.has(key)) return LIGHTS_CACHE.get(key);
  const N = rows * cols;
  // Build symmetric toggle columns (bitmask of affected cells for each button 0..N-1)
  const colMasks = new Array(N).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      let m = 1 << idx;
      if (r > 0) m |= 1 << ((r - 1) * cols + c);
      if (r + 1 < rows) m |= 1 << ((r + 1) * cols + c);
      if (c > 0) m |= 1 << (r * cols + (c - 1));
      if (c + 1 < cols) m |= 1 << (r * cols + (c + 1));
      colMasks[idx] = m;
    }
  }

  // Row-reduce A (symmetric, so row i equals colMasks[i]) tracking combinations for kernel/solver
  const aug = colMasks.map((m, i) => ({ row: m, comb: 1 << i }));
  const pivotCols = [];
  let rIdx = 0;
  for (let col = 0; col < N && rIdx < N; col++) {
    let piv = -1;
    for (let i = rIdx; i < N; i++) if ((aug[i].row >> col) & 1) { piv = i; break; }
    if (piv === -1) continue;
    [aug[rIdx], aug[piv]] = [aug[piv], aug[rIdx]];
    for (let i = 0; i < N; i++) {
      if (i !== rIdx && ((aug[i].row >> col) & 1)) {
        aug[i].row ^= aug[rIdx].row;
        aug[i].comb ^= aug[rIdx].comb;
      }
    }
    pivotCols.push(col);
    rIdx++;
  }

  const rank = pivotCols.length;
  const nullity = N - rank;
  const kernelBasis = [];
  for (let i = rank; i < N; i++) kernelBasis.push(aug[i].comb);

  // Apply button mask to starting zero state
  const applyButtons = btnMask => {
    let state = 0;
    for (let i = 0; i < N; i++) if ((btnMask >> i) & 1) state ^= colMasks[i];
    return state;
  };

  // A is symmetric, so target is in im(A) iff orthogonal to every kernel basis vector!
  const isSolvable = targetMask => kernelBasis.every(q => (popcount(q & targetMask) & 1) === 0);

  // Solve A x = targetMask (returns one solution mask or null)
  const solve = targetMask => {
    if (!isSolvable(targetMask)) return null;
    // Direct elimination on copy of A | target
    const mat = colMasks.map((row, i) => ({ row, rhs: (targetMask >> i) & 1 }));
    const pCols = [];
    let rr = 0;
    for (let col = 0; col < N && rr < N; col++) {
      let piv = -1;
      for (let i = rr; i < N; i++) if ((mat[i].row >> col) & 1) { piv = i; break; }
      if (piv === -1) continue;
      [mat[rr], mat[piv]] = [mat[piv], mat[rr]];
      for (let i = 0; i < N; i++) {
        if (i !== rr && ((mat[i].row >> col) & 1)) {
          mat[i].row ^= mat[rr].row;
          mat[i].rhs ^= mat[rr].rhs;
        }
      }
      pCols.push(col);
      rr++;
    }
    let sol = 0;
    for (let i = 0; i < pCols.length; i++) if (mat[i].rhs) sol |= 1 << pCols[i];
    return sol;
  };

  const info = {
    rows, cols, N, colMasks, rank, nullity,
    groupOrder: 1 << N,
    imageOrder: 1 << rank,
    kernelOrder: 1 << nullity,
    index: 1 << nullity,
    kernelBasis,
    applyButtons,
    isSolvable,
    solve,
  };
  LIGHTS_CACHE.set(key, info);
  return info;
}

// ---------- Exact Gregorian calendar helpers ----------

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS_TR = [
  '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const MONTH_LEN = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

function daysSince2000(y, m, d) {
  let total = 0;
  if (y >= 2000) {
    for (let yr = 2000; yr < y; yr++) total += isLeapYear(yr) ? 366 : 365;
  } else {
    for (let yr = y; yr < 2000; yr++) total -= isLeapYear(yr) ? 366 : 365;
  }
  for (let mo = 1; mo < m; mo++) {
    total += mo === 2 && isLeapYear(y) ? 29 : MONTH_LEN[mo];
  }
  return total + (d - 1);
}

// 2000-01-01 was Saturday (6 in 0=Pazar..6=Cumartesi)
function weekdayOf(y, m, d) {
  return mod(6 + daysSince2000(y, m, d), 7);
}

function weekdayLabel(w) {
  return `${WEEKDAYS[w]} ($${w}$)`;
}

function weekdayChoice(rng, w) {
  const correct = weekdayLabel(w);
  const others = rng.shuffle([0, 1, 2, 3, 4, 5, 6].filter(x => x !== w)).slice(0, 3).map(weekdayLabel);
  return shuffleChoice(rng, correct, others);
}

function countLeapFeb29Between(y1, m, d, y2) {
  // Number of Feb 29 dates strictly between (y1, m, d) and (y2, m, d) for y2 > y1 (assume (m,d) != (2,29))
  let cnt = 0;
  for (let y = y1; y <= y2; y++) {
    if (!isLeapYear(y)) continue;
    const afterStart = y > y1 || m <= 2;
    const beforeEnd = y < y2 || m >= 3;
    if (afterStart && beforeEnd) cnt++;
  }
  return cnt;
}

// =====================================================================
// 1. ozgun-molekul-simetri — Molecules & point groups: NH3, BF3, H2O, C2H4, C6H6 vs naphthalene
// =====================================================================

const T_MOLEKUL_SIMETRI = {
  id: 'ozgun-molekul-simetri',
  topic: 'Molekül Simetrileri',
  title: 'Molekül Nokta Grupları ve İzotop Yerdeğişimi ($\\text{H} \\to \\text{D}$)',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const mol = rng.pick(['NH3', 'H2O', 'C2H4', 'BF3']);
      if (mol === 'NH3') {
        const v = rng.int(1, 3);
        const mirrorEl = dAll(3).find(x => x.m === 1 && dFixedPoints(3, x).includes(v));
        const mirrorPerm = dPerm(3, mirrorEl);
        const rotPick = dEl(3, rng.pick([1, 2]), 0);
        const rotPerm = dPerm(3, rotPick);
        return {
          title: `Amonyak ($\\text{NH}_3$) Simetri Grubu $D_3$ ve Hidrojen Permütasyonları`,
          story: `Üçgen piramit biçimindeki amonyak ($\\text{NH}_3$) molekülünde üç hidrojen atomu taban eşkenar üçgeninin saat yönünün tersine $1, 2, 3$ köşelerinde, azot atomu (N) tepe noktasındadır. Nokta simetri grubu $C_{3v} \\cong D_3$ ($r = (123)$ saat yönünün tersine $120^\\circ$ dönme, $s = (23)$ ise $1$. hidrojen ile azottan geçen ayna yansıması) hidrojen konumlarını permüte eder.`,
          model: { id: 'molecule', params: { name: 'NH3' } },
          parts: makeLabels([
            {
              prompt: `$${dTex(rotPick)}$ dönme simetrisinin üç hidrojen konumuna ($1, 2, 3$) uyguladığı permütasyonu ayrık döngü gösteriminde yazın.`,
              kind: 'answer',
              answer: { type: 'perm', n: 3, value: rotPerm },
              hints: [
                '$r = (123)$ her hidrojeni saat yönünün tersine bir sonraki konuma taşır.',
                rotPick.k === 1 ? '$1 \\mapsto 2 \\mapsto 3 \\mapsto 1$ döngüsünü yazın.' : '$r^2$ iki adım ilerletir: $1 \\mapsto 3 \\mapsto 2 \\mapsto 1$.',
                `Permütasyon: $${permTex(rotPerm)}$.`,
              ],
              solution: [
                `Konum geçişleri: $1 \\mapsto ${rotPerm[0]},\\; 2 \\mapsto ${rotPerm[1]},\\; 3 \\mapsto ${rotPerm[2]}$, yani **$${permTex(rotPerm)}$**.`,
              ],
            },
            {
              prompt: `Tam olarak **$${v}$. hidrojen atomundan** ve azot atomundan geçen düşey ayna yansımasını $D_3$ normal biçiminde ($r^k s$) yazın.`,
              kind: 'answer',
              answer: { type: 'dihedral', n: 3, value: mirrorEl },
              hints: [
                `Bu yansıma $${v}$. konumu sabit tutup diğer iki hidrojeni takas eder: permütasyonu $${permTex(mirrorPerm)}$ olur.`,
                'Ders konvansiyonunda $s = (23)$ ($1$ sabit), $rs = (12)$ ($3$ sabit), $r^2 s = (13)$ ($2$ sabit) yansımalarıdır.',
                `Aranan eleman: $${dTex(mirrorEl)}$.`,
              ],
              solution: [
                `$${v}$. köşeyi sabitleyen yansıma permütasyonu $${permTex(mirrorPerm)}$ olup $D_3$ normal biçiminde **$${dTex(mirrorEl)}$** olur.`,
              ],
            },
            {
              prompt: `$${v}$. konumdaki hidrojen atomu döteryum izotopu ile değiştirilerek $\\text{NH}_2\\text{D}$ elde edilirse molekülün korunan simetri alt grubunun mertebesi kaç olur?`,
              kind: 'answer',
              answer: { type: 'int', value: 2 },
              hints: [
                `Döteryum (D) diğer iki hidrojenle özdeş olmadığından yalnızca $${v}$. konumu sabit bırakan simetriler korunur.`,
                `Korunan simetriler: birim eleman $e$ ve $${v}$. atomdan geçen ayna $${dTex(mirrorEl)}$.`,
              ],
              solution: [
                `$${v}$. konumu sabitleyen alt grup $H = \\{e, ${dTex(mirrorEl)}\\} \\cong \\mathbb{Z}_2$ olup mertebesi **$|H| = 2$**.`,
              ],
            },
          ]),
        };
      }
      if (mol === 'H2O') {
        const opPick = rng.pick([
          { name: '$C_2$ (oksijenden geçen açıortay etrafında $180^\\circ$ dönme)', perm: [2, 1], swaps: true },
          { name: '$\\sigma_v$ (molekül düzleminin kendisindeki ayna)', perm: [1, 2], swaps: false },
          { name: "$\\sigma_v'$ (molekül düzlemine dik, oksijenden geçen ayna)", perm: [2, 1], swaps: true },
        ]);
        return {
          title: `Su Molekülü ($\\text{H}_2\\text{O}$): $C_{2v} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$`,
          story: `Bükülmüş düzlemsel su molekülü $\\text{H}_2\\text{O}$'nun 3B nokta grubu $C_{2v} = \\{e, C_2, \\sigma_v, \\sigma_v'\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ dört elemandan oluşur ($1$ ve $2$ hidrojen konumlarını gösterir). Her elemanın karesi birimdir ve tüm elemanlar birbiriyle değişmelidir.`,
          model: { id: 'molecule', params: { name: 'H2O' } },
          parts: makeLabels([
            {
              prompt: `${opPick.name} simetrisinin iki hidrojen konumuna ($1, 2$) uyguladığı permütasyon nedir?`,
              kind: 'answer',
              answer: { type: 'perm', n: 2, value: opPick.perm },
              hints: [
                'İki hidrojen yer değiştiriyorsa $(12)$, yerlerinde kalıyorsa birim permütasyon $e$ yazılır.',
                opPick.swaps ? 'Bu simetri iki hidrojeni birbirinin yerine taşır.' : 'Molekül düzlemi tüm atomları kendi yerinde bırakır.',
              ],
              solution: [
                opPick.swaps
                  ? `${opPick.name} iki hidrojeni takas ettiğinden konum permütasyonu **$(12)$** olur.`
                  : `${opPick.name} molekül düzlemindeki tüm atomları sabit bıraktığından permütasyonu **$e$** olur.`,
              ],
            },
            {
              prompt: `$\\text{H}_2\\text{O}$ molekülünün $C_{2v}$ simetri grubunda kaç tane eşlenik sınıfı vardır?`,
              kind: 'answer',
              answer: { type: 'int', value: 4 },
              hints: [
                '$C_{2v} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ değişmeli (Abelyen) bir gruptur.',
                'Abelyen bir grupta her eleman kendi başına $1$ elemanlı bir eşlenik sınıfı oluşturur.',
              ],
              solution: [
                '$C_{2v}$ Abelyen ve $|C_{2v}| = 4$ olduğundan her eleman tekil eşlenik sınıfıdır: toplam **$4$ eşlenik sınıfı** ($4 = 1+1+1+1$).',
              ],
            },
            {
              prompt: `Yalnızca $1$. hidrojen döteryumla değiştirilerek yarı-ağır su ($\\text{HDO}$) elde edilirse, kalan simetri alt grubu $H \\le C_{2v}$'nin mertebesi kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: 2 },
              hints: [
                'H ve D atomlarını takas eden $C_2$ ve $\\sigma_v\'$ kaybolur; hangi iki simetri atomların yerini değiştirmez?',
                '$e$ ve molekül düzlemi $\\sigma_v$ korunur.',
              ],
              solution: [
                'Korunan alt grup $H = \\{e, \\sigma_v\\} \\cong \\mathbb{Z}_2$ olup mertebesi **$|H| = 2$**.',
              ],
            },
            {
              prompt: `$\\text{HDO}$ molekülünün korunan $H = \\{e, \\sigma_v\\}$ alt grubu $C_{2v}$ içinde **normal** midir?`,
              kind: 'answer',
              answer: { type: 'yesno', value: true },
              hints: [
                '$C_{2v} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ değişmeli (Abelyen) bir gruptur; ayrıca $[C_{2v} : H] = 2$.',
                'Abelyen bir grubun her alt grubu normaldir.',
              ],
              solution: [
                '$C_{2v}$ Abelyen (ve $[C_{2v}:H] = 2$) olduğundan $H \\trianglelefteq C_{2v}$: **Evet, normaldir**.',
              ],
            },
          ]),
        };
      }
      if (mol === 'C2H4') {
        const ops = [
          { desc: 'molekül düzlemine dik $z$ ekseni etrafında $180^\\circ$ dönme ($C_2^z$)', perm: [3, 4, 1, 2] },
          { desc: '$\\text{C}=\\text{C}$ bağı boyunca uzanan $x$ ekseni etrafında $180^\\circ$ dönme ($C_2^x$)', perm: [4, 3, 2, 1] },
          { desc: '$\\text{C}=\\text{C}$ bağını ortadan kesen $y$ ekseni etrafında $180^\\circ$ dönme ($C_2^y$)', perm: [2, 1, 4, 3] },
        ];
        const op = rng.pick(ops);
        return {
          title: `Etilen ($\\text{C}_2\\text{H}_4$) Düzlem İçi Dönme Simetrisi ($D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$)`,
          story: `Düzlemsel etilen ($\\text{C}_2\\text{H}_4$) molekülünde $\\text{C}=\\text{C}$ çift bağı $x$ ekseni üzerindedir ve dört hidrojen atomu kare olmayan bir dikdörtgenin köşelerinde saat yönünün tersine $1=(+a,+b)$, $2=(-a,+b)$, $3=(-a,-b)$, $4=(+a,-b)$ biçiminde sıralanmıştır. Üç dik koordinat ekseni etrafındaki $180^\\circ$ dönmeler $D_2 = \\{e, C_2^x, C_2^y, C_2^z\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ grubunu oluşturur.`,
          model: { id: 'molecule', params: { name: 'C2H4' } },
          parts: makeLabels([
            {
              prompt: `${op.desc} simetrisinin dört hidrojen konumuna ($1, 2, 3, 4$) uyguladığı permütasyonu ayrık döngü gösteriminde yazın.`,
              kind: 'answer',
              answer: { type: 'perm', n: 4, value: op.perm },
              hints: [
                'Koordinat işaretlerinin nasıl değiştiğine bakın: $C_2^x: (x,y)\\mapsto(x,-y)$, $C_2^y: (x,y)\\mapsto(-x,y)$, $C_2^z: (x,y)\\mapsto(-x,-y)$.',
                `Dört köşenin görüntülerini takip edin: $1 \\mapsto ${op.perm[0]},\\; 2 \\mapsto ${op.perm[1]},\\; 3 \\mapsto ${op.perm[2]},\\; 4 \\mapsto ${op.perm[3]}$.`,
              ],
              solution: [
                `${op.desc} altında $1 \\mapsto ${op.perm[0]},\\; 2 \\mapsto ${op.perm[1]},\\; 3 \\mapsto ${op.perm[2]},\\; 4 \\mapsto ${op.perm[3]}$, yani permütasyon **$${permTex(op.perm)}$**.`,
              ],
            },
            {
              prompt: `Bu $D_2$ dönme grubuna molekül düzleminin kendisi olan yatay ayna $\\sigma_h$ eklendiğinde tam 3B nokta grubu $D_{2h} \\cong D_2 \\times \\{e, \\sigma_h\\} \\cong \\mathbb{Z}_2^3$'ün mertebesi kaç olur?`,
              kind: 'answer',
              answer: { type: 'int', value: 8 },
              hints: [
                '$\\sigma_h$ her $g \\in D_2$ ile değişmeli ve $\\sigma_h^2 = e$ olduğundan grup direkt çarpım $D_2 \\times \\mathbb{Z}_2$ olur.',
                '$|D_2 \\times \\mathbb{Z}_2| = 4 \\cdot 2$.',
              ],
              solution: [
                '$|D_{2h}| = |D_2| \\cdot |\\{e, \\sigma_h\\}| = 4 \\cdot 2 = 8$.',
              ],
            },
            {
              prompt: `Yalnızca $1$. hidrojen döteryumla değiştirilirse ($\\text{C}_2\\text{H}_3\\text{D}$), 3B nokta grubu $D_{2h}$'den geriye kaç simetri elemanı kalır?`,
              kind: 'answer',
              answer: { type: 'int', value: 2 },
              hints: [
                'Dört hidrojenin konumunu değiştirmeyen $D_{2h}$ elemanlarını sayın.',
                'Birim $e$ ve molekül düzlemi $\\sigma_h$ tüm atomları yerinde bırakır; diğer $6$ eleman hidrojenleri yer değiştirir.',
              ],
              solution: [
                '$1$. hidrojeni sabit bırakan tek simetriler $\\{e, \\sigma_h\\} \\cong \\mathbb{Z}_2$ olup geriye **$2$** simetri elemanı kalır.',
              ],
            },
          ]),
        };
      }
      // BF3
      const v = rng.int(1, 3);
      const mirrorEl = dAll(3).find(x => x.m === 1 && dFixedPoints(3, x).includes(v));
      return {
        title: `Bor Triflorür ($\\text{BF}_3$): $D_3$ ve Yatay Ayna $\\sigma_h$`,
        story: `Düzlemsel eşkenar üçgen biçimindeki bor triflorür ($\\text{BF}_3$) molekülünde üç flor (F) atomu saat yönünün tersine $1, 2, 3$ köşelerinde, bor (B) merkezdedir. Düzlemdeki $D_3$ simetrilerine ek olarak molekül düzleminin kendisi bir yatay ayna $\\sigma_h$ olduğundan tam 3B nokta grubu $D_{3h} \\cong D_3 \\times \\{e, \\sigma_h\\} \\cong D_3 \\times \\mathbb{Z}_2$'dir.`,
        model: { id: 'molecule', params: { name: 'BF3' } },
        parts: makeLabels([
          {
            prompt: `$\\text{BF}_3$ molekülünün tam 3B nokta grubu $D_{3h}$'nin mertebesi kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: 12 },
            hints: [
              '$|D_3| = 6$ ve yatay ayna $\\sigma_h$ mertebesi $2$ olan bir direkt çarpım çarpanı ekler.',
              '$|D_{3h}| = |D_3 \\times \\mathbb{Z}_2| = 6 \\cdot 2$.',
            ],
            solution: [
              '$|D_{3h}| = |D_3| \\cdot 2 = 6 \\cdot 2 = 12$.',
            ],
          },
          {
            prompt: `$D_3$ içinde **$${v}$. flor atomundan** geçen yansıma elemanı normal biçimde ($r^k s$) hangisidir?`,
            kind: 'answer',
            answer: { type: 'dihedral', n: 3, value: mirrorEl },
            hints: [
              '$s$ köşe $1$' + "'i, $rs$ köşe $3$'ü, $r^2s$ köşe $2$'yi sabit bırakır.",
              `$${v}$. köşeyi sabitleyen yansıma: $${dTex(mirrorEl)}$.`,
            ],
            solution: [
              `Konum permütasyonu $${permTex(dPerm(3, mirrorEl))}$ olan yansıma $D_3$ içinde **$${dTex(mirrorEl)}$** olur.`,
            ],
          },
          {
            prompt: `$\\text{BF}_3$ molekülünde yatay ayna $\\sigma_h$ üç flor atomunun konumlarını hangi permütasyonla değiştirir?`,
            kind: 'answer',
            answer: { type: 'perm', n: 3, value: permId(3) },
            hints: [
              'Tüm atomlar molekül düzleminin içinde yer alır.',
              'Bir ayna kendi düzlemindeki tüm noktaları sabit bırakır (birim permütasyon $e$).',
            ],
            solution: [
              'Tüm flor atomları ayna düzlemi üzerinde olduğundan $\\sigma_h$ her atomu kendi konumunda bırakır: **$e$**.',
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const variant = rng.pick(['NH3', 'BF3', 'C6H6', 'C2H4']);
      if (variant === 'NH3') {
        const v = rng.int(1, 3);
        const stab = dStabOfSet(3, [v]);
        const mirrorEl = stab.find(x => x.m === 1);
        const normal = dIsNormal(3, stab);
        const conjEl = dEl(3, rng.pick([1, 2]), 0);
        const conjRes = dConj(3, conjEl, mirrorEl);
        return {
          title: `Amonyakta İzotop Yerdeğişimi ($\\text{NH}_3 \\to \\text{NH}_2\\text{D}$) ve Normallik`,
          story: `Amonyak ($\\text{NH}_3$) molekülünün hidrojen atomları taban üçgeninde saat yönünün tersine $1, 2, 3$ olarak numaralandırılmıştır ve nokta grubu $D_3$ ($r = (123)$, $s = (23)$) şeklindedir. Şimdi **$${v}$. konumdaki** hidrojen atomu döteryum (D) izotopu ile değiştirilerek $\\text{NH}_2\\text{D}$ oluşturuluyor.`,
          model: { id: 'molecule', params: { name: 'NH3' } },
          parts: makeLabels([
            {
              prompt: `$\\text{NH}_2\\text{D}$ molekülünün korunan simetri alt grubu $H = \\operatorname{Stab}_{D_3}(${v})$ elemanlarını $D_3$ normal biçiminde yazın (virgülle ayırın).`,
              kind: 'answer',
              answer: { type: 'dset', n: 3, value: stab },
              hints: [
                `$${v}$. konumu sabit bırakan elemanlar $e$ ve $${v}$. köşeden geçen düşey aynadır.`,
                `$D_3$ içinde bu ayna $${dTex(mirrorEl)}$ elemanına karşılık gelir.`,
              ],
              solution: [
                `$${v}$. köşeyi sabitleyen elemanlar $H = ${dSetTex(stab)} \\cong \\mathbb{Z}_2$ alt grubunu oluşturur.`,
              ],
            },
            {
              prompt: `Bu yansıma $a = ${dTex(mirrorEl)}$ elemanının $g = ${dTex(conjEl)}$ ile eşleniği $g^{-1} a g$ nedir?`,
              kind: 'answer',
              answer: { type: 'dihedral', n: 3, value: conjRes },
              hints: [
                `$D_3$'te $g^{-1} = ${dTex(dInv(3, conjEl))}$ ve $s r^k = r^{-k} s$ kuralını kullanarak $g^{-1} a g$ çarpımını indirgeyin.`,
              ],
              solution: [
                `$g^{-1} a g = (${dTex(dInv(3, conjEl))})(${dTex(mirrorEl)})(${dTex(conjEl)}) = ${dTex(conjRes)}$.`,
              ],
            },
            {
              prompt: `$H = ${dSetTex(stab)}$ alt grubu $D_3$ içinde **normal** midir?`,
              kind: 'answer',
              answer: { type: 'yesno', value: normal },
              hints: [
                `$g^{-1} a g = ${dTex(conjRes)}$ sonucunun $H$ içinde kalıp kalmadığına bakın.`,
              ],
              solution: [
                `$${dTex(conjRes)} \\notin H$ olduğundan $g^{-1} H g \\neq H$; dolayısıyla $H$ $D_3$ içinde **normal değildir** (3 yansıma tek bir eşlenik sınıfı oluşturur).`,
              ],
            },
            {
              prompt: `$D_3$ grubunun eşlenik sınıf boyutlarını küçükten büyüğe sırayla yazın (virgülle ayırın).`,
              kind: 'answer',
              answer: { type: 'intlist', value: [1, 2, 3] },
              hints: [
                '$D_3$' + "'te birim $\\{e\\}$, iki dönme $\\{r, r^2\\}$ ve üç yansıma $\\{s, rs, r^2s\\}$ ayrı eşlenik sınıflarıdır.",
              ],
              solution: [
                'Sınıf denklemi $6 = 1 + 2 + 3$ olup eşlenik sınıf boyutları **$1, 2, 3$** olur.',
              ],
            },
          ]),
        };
      }
      if (variant === 'BF3') {
        const v = rng.int(1, 3);
        const mirrorEl = dAll(3).find(x => x.m === 1 && dFixedPoints(3, x).includes(v));
        const isoChoice = shuffleChoice(rng, '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$', ['$\\mathbb{Z}_4$', '$D_3$', '$\\mathbb{Z}_2$']);
        return {
          title: `$\\text{BF}_3$ Nokta Grubu $D_{3h} \\cong D_3 \\times \\mathbb{Z}_2$ ve $\\text{BF}_2\\text{Cl}$`,
          story: `Düzlemsel bor triflorür ($\\text{BF}_3$) molekülünün 3B nokta grubu $D_{3h} \\cong D_3 \\times \\{e, \\sigma_h\\}$ ($|D_{3h}| = 12$) şeklindedir. Şimdi **$${v}$. konumdaki** flor atomu klor (Cl) ile değiştirilerek düzlemsel $\\text{BF}_2\\text{Cl}$ molekülü elde ediliyor.`,
          model: { id: 'molecule', params: { name: 'BF3' } },
          parts: makeLabels([
            {
              prompt: `$D_{3h} \\cong D_3 \\times \\mathbb{Z}_2$ grubunun toplam kaç tane eşlenik sınıfı vardır?`,
              kind: 'answer',
              answer: { type: 'int', value: 6 },
              hints: [
                'Direkt çarpımda eşlenik sınıfı sayısı çarpanların eşlenik sınıfı sayılarının çarpımıdır.',
                '$D_3$' + "'ün $3$ ($\\{e\\}, \\{r,r^2\\}, \\{s,rs,r^2s\\}$), $\\mathbb{Z}_2$'nin $2$ eşlenik sınıfı vardır.",
              ],
              solution: [
                '$3 \\times 2 = 6$ eşlenik sınıfı vardır (sınıf boyutları $1, 1, 2, 2, 3, 3$).',
              ],
            },
            {
              prompt: `$\\text{BF}_2\\text{Cl}$ molekülünün korunan 3B simetri alt grubu $H \\le D_{3h}$'nin mertebesi kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: 4 },
              hints: [
                `Düzlem içi $D_3$'te $${v}$. köşeyi sabitleyen $\\{e, ${dTex(mirrorEl)}\\}$ korunur; yatay ayna $\\sigma_h$ de molekül düzlemini koruduğu için çarpımla $2 \\times 2$ eleman oluşur.`,
              ],
              solution: [
                `$H = \\{e, ${dTex(mirrorEl)}\\} \\times \\{e, \\sigma_h\\}$ ($C_{2v}$ grubu) olup mertebesi **$|H| = 4$** (indeks $[D_{3h}:H] = 12/4 = 3$, yani Cl atomu $3$ eşdeğer konum alabilir).`,
              ],
            },
            {
              prompt: `$\\text{BF}_2\\text{Cl}$ molekülünün korunan simetri alt grubu $H$ hangi gruba izomorfiktir?`,
              kind: 'answer',
              answer: isoChoice,
              hints: [
                '$H$' + "'deki her birim-dışı elemanın karesi birimdir ve $\\sigma_h$ her elemanla değişmelidir.",
              ],
              solution: [
                `$H = \\{e, ${dTex(mirrorEl)}\\} \\times \\{e, \\sigma_h\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.`,
              ],
            },
            {
              prompt: `$\\text{BF}_2\\text{Cl}$ molekülünün $H$ alt grubu $D_{3h}$ içinde **normal** midir?`,
              kind: 'answer',
              answer: { type: 'yesno', value: false },
              hints: [
                `Düzlem içi $D_3$ bileşeninde $\\{e, ${dTex(mirrorEl)}\\}$ normal midir? $120^\\circ$ dönme $r$ ile eşlenik alınırsa ne olur?`,
              ],
              solution: [
                `$r^{-1}(${dTex(mirrorEl)})r \\notin \\{e, ${dTex(mirrorEl)}\\}$ olduğundan $H$, $D_{3h}$ içinde **normal değildir** (3 eşlenik kopyası vardır).`,
              ],
            },
          ]),
        };
      }
      if (variant === 'C6H6') {
        const v = rng.int(1, 6);
        const stab = dStabOfSet(6, [v]);
        const mirrorEl = stab.find(x => x.m === 1);
        return {
          title: `Benzen ($\\text{C}_6\\text{H}_6$) vs Naftalin ve Döterobenzen ($\\text{C}_6\\text{H}_5\\text{D}$)`,
          story: `Benzen ($\\text{C}_6\\text{H}_6$) halkasında altı hidrojen atomu düzgün altıgenin köşelerinde saat yönünün tersine $1, 2, 3, 4, 5, 6$ olarak dizilir (düzlem içi simetri grubu $D_6$, mertebe $12$; yatay ayna $\\sigma_h$ ile 3B $D_{6h}$ mertebe $24$). İki kaynaşmış halkadan oluşan düzlemsel **naftalin** ($\\text{C}_{10}\\text{H}_8$) ise dikdörtgen çerçeveli olduğundan düzlem içi simetri grubu yalnızca $D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$'dir.`,
          model: { id: 'molecule', params: { name: 'C6H6' } },
          parts: makeLabels([
            {
              prompt: `Benzende **$${v}$. konumdaki** hidrojen döteryumla değiştirilirse ($\\text{C}_6\\text{H}_5\\text{D}$), $D_6$ düzlem içi simetri grubundan geriye kalan alt grup $H = \\operatorname{Stab}_{D_6}(${v})$ elemanlarını yazın (virgülle ayırın).`,
              kind: 'answer',
              answer: { type: 'dset', n: 6, value: stab },
              hints: [
                `$D_6$'da $${v}$. köşeden geçen tek yansıma $r^k s$ biçiminde $2-i+k \\equiv i \\pmod 6$, yani $k \\equiv 2(${v}-1) \\pmod 6$ sağlar.`,
                `Bu yansıma $${dTex(mirrorEl)}$ olup $H = \\{e, ${dTex(mirrorEl)}\\}$ elde edilir.`,
              ],
              solution: [
                `$${v}$. köşeyi sabitleyen $D_6$ yansıması $${dTex(mirrorEl)}$ ($${permTex(dPerm(6, mirrorEl))}$) olduğundan $H = ${dSetTex(stab)}$.`,
              ],
            },
            {
              prompt: `$\\text{C}_6\\text{H}_5\\text{D}$ molekülünün bu $H$ alt grubunun $D_6$ içindeki indeksi $[D_6 : H]$ (döteryumun yerleşebileceği eşdeğer konum sayısı) kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: 6 },
              hints: [
                '$[D_6 : H] = |D_6| / |H| = 12 / 2$ (döteryumun yerleşebileceği $6$ eşdeğer konum).',
              ],
              solution: [
                '$[D_6 : H] = 12 / 2 = 6$.',
              ],
            },
            {
              prompt: `Bu $H = ${dSetTex(stab)}$ alt grubu $D_6$ içinde normal midir?`,
              kind: 'answer',
              answer: { type: 'yesno', value: false },
              hints: [
                `$r^{-1}(${dTex(mirrorEl)})r = ${dTex(dConj(6, dEl(6, 1, 0), mirrorEl))}$ elemanı $H$'de midir?`,
              ],
              solution: [
                `$r^{-1}(${dTex(mirrorEl)})r = ${dTex(dConj(6, dEl(6, 1, 0), mirrorEl))} \\notin H$ olduğundan $H$ **normal değildir**.`,
              ],
            },
            {
              prompt: `Benzen ($D_{6h}$) ile naftalinin ($D_{2h} \\cong D_2 \\times \\mathbb{Z}_2$) 3B nokta grubu mertebelerinin oranı $|D_{6h}| / |D_{2h}|$ kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: 3 },
              hints: [
                '$|D_{6h}| = 2 \\cdot |D_6| = 24$ ve $|D_{2h}| = 2 \\cdot |D_2| = 8$.',
              ],
              solution: [
                '$|D_{6h}| = 24$ ve $|D_{2h}| = 8$ olduğundan oran $24 / 8 = 3$ olur (naftalinde $6$-katlı dönme ekseni $2$-katlıya iner).',
              ],
            },
          ]),
        };
      }
      // C2H4 disubstituted: cis, trans, geminal
      const isomers = [
        { name: 'cis-dideuteroetilen', pair: [1, 2], keptPerm: [2, 1, 4, 3], opName: '$C_2^y$' },
        { name: 'trans-dideuteroetilen', pair: [1, 3], keptPerm: [3, 4, 1, 2], opName: '$C_2^z$' },
        { name: 'geminal (1,1)-dideuteroetilen', pair: [1, 4], keptPerm: [4, 3, 2, 1], opName: '$C_2^x$' },
      ];
      const iso = rng.pick(isomers);
      return {
        title: `Etilende İki İzotop Yerdeğişimi (${iso.name}) ve $V_4$ Alt Grupları`,
        story: `Düzlemsel etilen ($\\text{C}_2\\text{H}_4$) molekülünün dört hidrojeni dikdörtgen köşelerinde $1=(+a,+b)$, $2=(-a,+b)$, $3=(-a,-b)$, $4=(+a,-b)$ olarak numaralanmıştır. Düzlem içi (veya 3B öz) dönme grubu $D_2 = \\{e, (14)(23), (12)(34), (13)(24)\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$'dir. Şimdi **$${iso.pair[0]}$ ve $${iso.pair[1]}$. konumlardaki** iki hidrojen döteryum (D) ile değiştirilerek **${iso.name}** elde ediliyor.`,
        model: { id: 'molecule', params: { name: 'C2H4' } },
        parts: makeLabels([
          {
            prompt: `Birim eleman $e$ dışında, bu $\\text{C}_2\\text{H}_2\\text{D}_2$ izomerini (yani $\\{${iso.pair[0]}, ${iso.pair[1]}\\}$ döteryum çiftini) koruyan **tek** $180^\\circ$ dönme simetrisinin dört hidrojen üzerindeki permütasyonunu yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: iso.keptPerm },
            hints: [
              `$D_2$'deki üç $180^\\circ$ dönmeden hangisi $\\{${iso.pair[0]}, ${iso.pair[1]}\\}$ çiftini birbirine takas eder?`,
              `${iso.opName} dönmesi $${permTex(iso.keptPerm)}$ permütasyonunu uygular.`,
            ],
            solution: [
              `$\\{${iso.pair[0]}, ${iso.pair[1]}\\}$ çiftini koruyan birim-dışı dönme **$${permTex(iso.keptPerm)}$** (${iso.opName}) olup korunan alt grup $H = \\{e, ${permTex(iso.keptPerm)}\\} \\cong \\mathbb{Z}_2$'dir.`,
            ],
          },
          {
            prompt: `Bu $H$ alt grubunun $D_2$ içindeki indeksi $[D_2 : H]$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: 2 },
            hints: ['$|D_2| = 4$ ve $|H| = 2$.'],
            solution: ['$[D_2 : H] = 4 / 2 = 2$ (iki eşdeğer yönelim).'],
          },
          {
            prompt: `$H$ alt grubu $D_2$ içinde **normal** midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: true },
            hints: ['$D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ Abelyen bir gruptur (ve ayrıca $[D_2:H] = 2$).'],
            solution: ['$D_2$ Abelyen (ve $[D_2:H]=2$) olduğundan her alt grubu normaldir: **Evet**.'],
          },
          {
            prompt: `Yatay ayna $\\sigma_h$ de dahil edildiğinde bu izomerin tam 3B nokta grubunun ($D_{2h}$ alt grubu) mertebesi kaç olur?`,
            kind: 'answer',
            answer: { type: 'int', value: 4 },
            hints: ['Molekül düzlemsel kaldığı için $\\sigma_h$ her zaman korunur: $H \\times \\{e, \\sigma_h\\}$.'],
            solution: ['$|H \\times \\{e, \\sigma_h\\}| = 2 \\cdot 2 = 4$ (izomer tipine göre $C_{2v}$ veya $C_{2h}$).'],
          },
        ]),
      };
    }

    // zorlayici: BF3 (D_3h -> S_3 kernel & classes) or C6H6 (para-dideuterobenzene D_2 in D_6 vs D_6 classes)
    const useBenzene = rng.int(0, 1) === 1;
    if (useBenzene) {
      const v = rng.int(1, 3);
      const pair = [v, v + 3];
      const stab = dStabOfSet(6, pair);
      const normal = dIsNormal(6, stab);
      return {
        title: `Para-Dideuterobenzen ($\\text{C}_6\\text{H}_4\\text{D}_2$): Kararlı Kılan, Eşleniklik ve Normallik`,
        story: `Benzen ($\\text{C}_6\\text{H}_6$) halkasının düzlem içi simetri grubu $D_6$'dır ($|D_6| = 12$). Karşılıklı **$${pair[0]}$ ve $${pair[1]}$. köşelerdeki** iki hidrojen döteryumla değiştirilerek para-dideuterobenzen elde ediliyor.`,
        model: { id: 'molecule', params: { name: 'C6H6' } },
        parts: makeLabels([
          {
            prompt: `Para-dideuterobenzenin $D_6$ içindeki korunan simetri alt grubu $H = \\operatorname{Stab}_{D_6}(\\{${pair[0]}, ${pair[1]}\\})$ elemanlarını normal biçimde yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'dset', n: 6, value: stab },
            hints: [
              `$e$, $180^\\circ$ dönme $r^3$, $\\{${pair[0]}, ${pair[1]}\\}$ köşelerinden geçen ayna ve ona dik kenar-ortası aynası korunur.`,
            ],
            solution: [
              `Karşılıklı $\\{${pair[0]}, ${pair[1]}\\}$ çiftini koruyan elemanlar $H = ${dSetTex(stab)} \\cong D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ ($|H| = 4$).`,
            ],
          },
          {
            prompt: `$D_6$ grubunun toplam eşlenik sınıfı sayısı kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: 6 },
            hints: [
              'Çift $n$ için $D_n$' + "'in eşlenik sınıfı sayısı $n/2 + 3$ olur: $\\{e\\}, \\{r^3\\}, \\{r,r^5\\}, \\{r^2,r^4\\}$ ve iki yansıma sınıfı.",
            ],
            solution: [
              '$D_6$ eşlenik sınıfları: $\\{e\\}, \\{r^3\\}, \\{r,r^5\\}, \\{r^2,r^4\\}, \\{s, r^2s, r^4s\\}, \\{rs, r^3s, r^5s\\}$ — toplam **$6$** sınıf ($12 = 1+1+2+2+3+3$).',
            ],
          },
          {
            prompt: `Para-dideuterobenzenin kararlı kılanı $H = ${dSetTex(stab)}$ alt grubu $D_6$ içinde normal midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: normal },
            hints: [
              'Normal bir alt grup eşlenik sınıflarının tam birleşimi olmalıdır; $H$ içindeki tekil yansımaların tüm $3$-elemanlı eşlenik sınıfları $H$' + "'de bulunuyor mu?",
            ],
            solution: [
              `$H$ her iki yansıma eşlenik sınıfından yalnızca $1$'er eleman içerdiği için (örneğin $r^{-1} H r \\neq H$) **normal değildir** ($3$ eşlenik para yönelimi vardır).`,
            ],
          },
          {
            prompt: '**Kanıt:** $n \\ge 3$ için bir düzgün $n$-gen molekülünde tek bir hidrojen atomunun izotopla değiştirilmesiyle (örneğin $\\text{NH}_3 \\to \\text{NH}_2\\text{D}$ veya $\\text{C}_6\\text{H}_6 \\to \\text{C}_6\\text{H}_5\\text{D}$) oluşan kararlı kılan alt grubu $H = \\operatorname{Stab}_{D_n}(v)$\'nin mertebesinin her zaman $2$ olduğunu ve $D_n$ içinde **asla normal olamayacağını** kanıtlayın.',
            kind: 'proof',
            hints: [
              '$v$ köşesini sabitleyen dönme yalnızca $e$, yansıma ise yalnızca $v$\'den geçen tek bir $\\sigma_v$ aynasıdır; ardından $r^{-1} \\sigma_v r \\notin H$ olduğunu gösterin.',
            ],
            solution: [
              '**Mertebe $2$:** Bir $r^k$ dönmesi ($0 \\le k < n$) $v$ köşesini $v + k \\pmod n$ konumuna götürür; $v$ sabit kalır $\\iff k = 0$ ($e$). Bir $r^k s$ yansıması $v$' + "'yi sabit bırakır $\\iff 2 - v + k \\equiv v \\pmod n \\iff k \\equiv 2(v-1) \\pmod n$, ki mod $n$ benzersizdir ($\\sigma_v$). Dolayısıyla $H = \\{e, \\sigma_v\\}$, $|H| = 2$.",
              '**Normal olmama:** $r^{-1} \\sigma_v r = r^{-1} (r^k s) r = r^{k-2} s$. Bu elemanın $H$' + "'de kalması için $k - 2 \\equiv k \\pmod n \\iff n \\mid 2$ gerekir. $n \\ge 3$ olduğundan $n \\nmid 2$, yani $r^{-1} \\sigma_v r \\notin H$. Dolayısıyla $H$ hiçbir $n \\ge 3$ için normal değildir.",
            ],
            checklist: [
              '$v$' + "'yi sabitleyen tek dönmenin $e$ ve tek yansımanın $k \\equiv 2(v-1) \\pmod n$ ile verilen $\\sigma_v$ olduğu gösterildi.",
              '$r^{-1} \\sigma_v r = r^{k-2} s$ eşleniği hesaplandı.',
              '$n \\ge 3$ için $2 \\not\\equiv 0 \\pmod n$ olduğundan $r^{-1} \\sigma_v r \\notin H$ sonucuyla normalliğin bozulduğu kanıtlandı.',
            ],
          },
        ]),
      };
    } else {
      // BF3: homomorphism Phi: D_3h -> S_3
      const v = rng.int(1, 3);
      const mirrorEl = dAll(3).find(x => x.m === 1 && dFixedPoints(3, x).includes(v));
      const pEl = dPerm(3, mirrorEl);
      const quotChoice = shuffleChoice(rng, '$D_3 \\cong S_3$', ['$\\mathbb{Z}_6$', '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$', '$D_6$']);
      return {
        title: `$\\text{BF}_3$ Molekülünde $\\Phi: D_{3h} \\to S_3$ Eylemi, Çekirdek ve İzomorfizma`,
        story: `Bor triflorür ($\\text{BF}_3$) molekülünün $12$ elemanlı 3B nokta grubu $D_{3h} = D_3 \\times \\{e, \\sigma_h\\}$ üç flor atomu ($1, 2, 3$) üzerinde permütasyon eylemi $\\Phi: D_{3h} \\to S_3$ tanımlar.`,
        model: { id: 'molecule', params: { name: 'BF3' } },
        parts: makeLabels([
          {
            prompt: `$\\Phi: D_{3h} \\to S_3$ homomorfizmasının çekirdeğinin mertebesi $|\\ker\\Phi|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: 2 },
            hints: [
              'Üç flor atomunu da yerinde bırakan 3B simetriler $e$ ve molekül düzlemi $\\sigma_h$' + "'dir.",
            ],
            solution: [
              '$\\ker\\Phi = \\{e, \\sigma_h\\} \\cong \\mathbb{Z}_2$ olup $|\\ker\\Phi| = 2$.',
            ],
          },
          {
            prompt: `$\\sigma_h \\cdot (${dTex(mirrorEl)})$ elemanı üç flor atomu üzerinde hangi $S_3$ permütasyonunu uygular?`,
            kind: 'answer',
            answer: { type: 'perm', n: 3, value: pEl },
            hints: [
              '$\\Phi(\\sigma_h \\cdot g) = \\Phi(\\sigma_h)\\Phi(g) = e \\cdot \\Phi(g) = \\Phi(g)$.',
            ],
            solution: [
              `$\\sigma_h \\in \\ker\\Phi$ olduğundan $\\Phi(\\sigma_h \\cdot ${dTex(mirrorEl)}) = \\Phi(${dTex(mirrorEl)}) = ${permTex(pEl)}$.`,
            ],
          },
          {
            prompt: `Bölüm grubu $D_{3h} / \\ker\\Phi$ hangi gruba izomorfiktir?`,
            kind: 'answer',
            answer: quotChoice,
            hints: ['Birinci İzomorfizma Teoremiyle $D_{3h} / \\ker\\Phi \\cong \\operatorname{im}\\Phi = S_3$.'],
            solution: ['$\\Phi$ örten olduğundan $D_{3h} / \\{e, \\sigma_h\\} \\cong S_3 \\cong D_3$.'],
          },
          {
            prompt: '**Kanıt:** Düzlemsel $\\text{BF}_3$ molekülünde yatay ayna $\\sigma_h$' + "'nin $D_3$'teki her simetriyle değişmeli olduğunu (böylece $D_{3h} \\cong D_3 \\times \\mathbb{Z}_2$), $\\ker\\Phi = \\{e, \\sigma_h\\} \\trianglelefteq D_{3h}$ olduğunu ve $\\text{BF}_3$'ten $\\text{BF}_2\\text{Cl}$'ye geçildiğinde kalan alt grubun $D_{3h}$ içinde normal olmadığını kanıtlayın.",
            kind: 'proof',
            hints: [
              '$\\sigma_h: (x,y,z) \\mapsto (x,y,-z)$ ile düzlem içi $(x,y)$ dönüşümlerinin blok-köşegen olarak değiştiğini gösterin; normallik bozulması için $r^{-1} \\sigma_v r \\notin H$ kullanın.',
            ],
            solution: [
              '**Değişmelilik ve direkt çarpım:** Molekül $xy$-düzleminde iken $\\sigma_h = \\operatorname{diag}(1, 1, -1)$ ve her $g \\in D_3$ bloğu $\\operatorname{diag}(R_g, 1)$ biçimindedir; dolayısıyla $\\sigma_h g = g \\sigma_h$. Ayrıca $D_3 \\cap \\{e, \\sigma_h\\} = \\{e\\}$ ($\\sigma_h$ $z$-eksenini çevirir, $D_3$ çevirmez) olduğundan $D_{3h} = D_3 \\times \\{e, \\sigma_h\\} \\cong D_3 \\times \\mathbb{Z}_2$.',
              '**Çekirdek ve bölüm:** $\\Phi(g, \\sigma_h^a) = \\Phi(g)$ olduğundan $\\ker\\Phi = \\{e, \\sigma_h\\} \\trianglelefteq D_{3h}$ ve $D_{3h} / \\ker\\Phi \\cong D_3 \\cong S_3$.',
              '**$\\text{BF}_2\\text{Cl}$ normallik testi:** Bir F atomunun Cl ile değiştirilmesiyle kalan $H = \\{e, \\sigma_v\\} \\times \\{e, \\sigma_h\\}$ alt grubunda $r^{-1} \\sigma_v r \\notin \\{e, \\sigma_v\\}$ olduğundan $r^{-1} H r \\neq H$; $H$ normal değildir.',
            ],
            checklist: [
              '$\\sigma_h = \\operatorname{diag}(1,1,-1)$ ile $D_3$' + "'ün değişmeli olduğu ve $D_{3h} \\cong D_3 \\times \\mathbb{Z}_2$ gösterildi.",
              '$\\ker\\Phi = \\{e, \\sigma_h\\}$ ve Birinci İzomorfizma Teoremiyle $D_{3h} / \\ker\\Phi \\cong D_3$ kanıtlandı.',
              '$\\text{BF}_2\\text{Cl}$ kararlı kılanı $H$' + "'nin $r$ ile eşlenik altında korunmadığı (normal olmadığı) gösterildi.",
            ],
          },
        ]),
      };
    }
  },
};

// =====================================================================
// 2. ozgun-muzik-ti-grubu — 12 pitch classes Z_12 and the TI group D_12
// =====================================================================

const NOTE_NAMES = ['C', 'C\\sharp', 'D', 'D\\sharp', 'E', 'F', 'F\\sharp', 'G', 'G\\sharp', 'A', 'A\\sharp', 'B'];

function applyTI(el, chord) {
  // el = { k, m } in D_12: m=0 => T_k(x) = x + k mod 12; m=1 => I_k(x) = -x + k mod 12
  return [...new Set(chord.map(x => mod(el.m ? -x + el.k : x + el.k, 12)))].sort((a, b) => a - b);
}

function tiTex(el) {
  return el.m ? `I_{${el.k}}` : `T_{${el.k}}`;
}

function tiStab(chord) {
  const key = [...chord].sort((a, b) => a - b).join(',');
  return dAll(12).filter(g => applyTI(g, chord).join(',') === key);
}

const T_MUZIK_TI_GRUBU = {
  id: 'ozgun-muzik-ti-grubu',
  topic: 'Dihedral Gruplar: Müzik Teorisi',
  title: '12 Perde Sınıfı ($\\mathbb{Z}_{12}$) ve Müzikal $T/I$ Grubu ($D_{12}$)',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const rootA = rng.int(0, 11);
    const majorA = [rootA, mod(rootA + 4, 12), mod(rootA + 7, 12)].sort((a, b) => a - b);

    if (level === 'isinma') {
      const kTrans = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const kInv = rng.int(0, 11);
      const tEl = dEl(12, kTrans, 0);
      const iEl = dEl(12, kInv, 1);
      const shifted = applyTI(tEl, majorA);
      const inverted = applyTI(iEl, majorA);
      const ordT = dOrder(12, tEl);

      return {
        title: `Müzik Saatinde Aktarım $T_{${kTrans}}$ ve Evirme $I_{${kInv}}$`,
        story: `Batı müziğindeki $12$ yarım tonluk perde sınıfı $\\mathbb{Z}_{12} = \\{0, 1, \\dots, 11\\}$ ($0 = \\text{C},\\; 1 = \\text{C}\\sharp,\\; \\dots,\\; 11 = \\text{B}$) saat çemberi üzerine yerleştirilir. **Aktarım** $T_k(x) = x + k \\pmod{12}$ ve **evirme** $I_k(x) = -x + k \\pmod{12}$ işlemleri bileşke altında $24$ elemanlı $T/I \\cong D_{12}$ grubunu oluşturur ($r = T_1$, $s = I_0$, yani $T_k = r^k$ ve $I_k = r^k s$). Başlangıç akorumuz $${NOTE_NAMES[rootA]}$ majör üçlüsü $M = ${intSetTex(majorA)}$ olsun.`,
        model: { id: 'music', params: { chord: majorA } },
        parts: makeLabels([
          {
            prompt: `$M = ${intSetTex(majorA)}$ akoruna $T_{${kTrans}}$ aktarımı uygulandığında elde edilen yeni perde kümesi nedir? (Sayıları virgülle ayırın.)`,
            kind: 'answer',
            answer: { type: 'intset', value: shifted },
            hints: [
              `Her perdeye $${kTrans}$ ekleyip mod $12$ alın: $x \\mapsto (x + ${kTrans}) \\bmod 12$.`,
              `${majorA.map(x => `$${x} + ${kTrans} \\equiv ${mod(x + kTrans, 12)}$`).join(', ')}.`,
              `Küme: $${intSetTex(shifted)}$.`,
            ],
            solution: [
              `$T_{${kTrans}}(${intSetTex(majorA)}) = ${intSetTex(shifted)}$ ($${NOTE_NAMES[mod(rootA + kTrans, 12)]}$ majör).`,
            ],
          },
          {
            prompt: `$T_{${kTrans}}$ aktarımının $T/I \\cong D_{12}$ grubundaki mertebesi kaçtır (kaç kez arka arkaya uygulanırsa her akor ilk yerine döner)?`,
            kind: 'answer',
            answer: { type: 'int', value: ordT },
            hints: [
              '$T_k$ aktarımı $\\mathbb{Z}_{12}$ içinde $+k$ işlemine karşılık gelir: $|T_k| = 12 / \\gcd(k, 12)$.',
              `$\\gcd(${kTrans}, 12) = ${gcd(kTrans, 12)}$.`,
              `$|T_{${kTrans}}| = 12 / ${gcd(kTrans, 12)} = ${ordT}$.`,
            ],
            solution: [
              `$|T_{${kTrans}}| = \\frac{12}{\\gcd(${kTrans}, 12)} = \\frac{12}{${gcd(kTrans, 12)}} = ${ordT}$.`,
            ],
          },
          {
            prompt: `$M = ${intSetTex(majorA)}$ akoruna $I_{${kInv}}$ evirmesi ($x \\mapsto ${kInv} - x \\bmod 12$) uygulandığında elde edilen perde kümesi nedir?`,
            kind: 'answer',
            answer: { type: 'intset', value: inverted },
            hints: [
              `Her $x \\in M$ için $(${kInv} - x) \\bmod 12$ değerini hesaplayın.`,
              `${majorA.map(x => `$${kInv} - ${x} \\equiv ${mod(kInv - x, 12)}$`).join(', ')}.`,
              `Evirme majör üçlüyü minör üçlüye çevirir: $${intSetTex(inverted)}$.`,
            ],
            solution: [
              `$I_{${kInv}}(${intSetTex(majorA)}) = ${intSetTex(inverted)}$ ($${NOTE_NAMES[mod(kInv - rootA - 7, 12)]}$ minör üçlüsü).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const rootB = rng.int(0, 11);
      const minorB = [rootB, mod(rootB + 3, 12), mod(rootB + 7, 12)].sort((a, b) => a - b);
      // Unique inversion I_k mapping majorA to minorB: k = rootA + rootB + 7 mod 12
      const invMapK = mod(rootA + rootB + 7, 12);
      const invMapEl = dEl(12, invMapK, 1);

      // Composition in D_12 (right to left)
      const u = rng.int(1, 11), v = rng.int(1, 11);
      const firstInv = rng.int(0, 1) === 1;
      const g1 = dEl(12, u, 1); // I_u
      const g2 = dEl(12, v, firstInv ? 1 : 0); // I_v or T_v
      const comp = dMul(12, g1, g2);

      // Symmetric chord stabilizer
      const symChords = [
        { name: 'artırılmış üçlü (augmented triad)', chord: [rootA, mod(rootA + 4, 12), mod(rootA + 8, 12)].sort((a, b) => a - b) },
        { name: 'eksiltilmiş yedili (diminished 7th)', chord: [rootA, mod(rootA + 3, 12), mod(rootA + 6, 12), mod(rootA + 9, 12)].sort((a, b) => a - b) },
        { name: 'üç ton (tritone)', chord: [rootA, mod(rootA + 6, 12)].sort((a, b) => a - b) },
        { name: 'askılı dörtlü (sus4)', chord: [rootA, mod(rootA + 5, 12), mod(rootA + 7, 12)].sort((a, b) => a - b) },
      ];
      const symC = rng.pick(symChords);
      const stab = tiStab(symC.chord);
      const orbitSize = 24 / stab.length;

      return {
        title: `Majör-Minör Dönüşümleri ve Simetrik Akorların Kararlı Kılanları ($D_{12}$)`,
        story: `Müzik teorisinde $12$ perde sınıfı üzerindeki $T_k(x) = x + k$ ve $I_k(x) = -x + k \\pmod{12}$ işlemleri, $r = T_1$ ve $s = I_0$ eşlemesiyle $D_{12}$ grubunu oluşturur ($T_k = r^k$, $I_k = r^k s$; bileşke sağdan sola okunur).`,
        model: { id: 'music', params: { chord: symC.chord } },
        parts: makeLabels([
          {
            prompt: `$${NOTE_NAMES[rootA]}$ majör akorunu $M = ${intSetTex(majorA)}$ alıp $${NOTE_NAMES[rootB]}$ minör akoruna $m = ${intSetTex(minorB)}$ taşıyan **benzersiz** $I_k$ evirmesinin $k \\in \\{0, \\dots, 11\\}$ indisi kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: invMapK },
            hints: [
              'Evirme aralığı tersine çevirdiğinden majörün kökü ($a$) minörün beşlisine ($b+7$), majörün beşlisi ($a+7$) minörün köküne ($b$) gider.',
              `$k \\equiv a + (b + 7) = ${rootA} + ${rootB} + 7 \\pmod{12}$.`,
            ],
            solution: [
              `$I_k(\\{${rootA}, ${mod(rootA + 4, 12)}, ${mod(rootA + 7, 12)}\\}) = \\{${rootB}, ${mod(rootB + 3, 12)}, ${mod(rootB + 7, 12)}\\}$ için $k \\equiv ${rootA} + ${rootB} + 7 \\equiv ${invMapK} \\pmod{12}$ ($${tiTex(invMapEl)}$).`,
            ],
          },
          {
            prompt: `Sağdan sola bileşke $${tiTex(g1)} \\circ ${tiTex(g2)}$ işlemini $D_{12}$ normal biçiminde ($r^k s^m$, burada $T_k = r^k$ ve $I_k = r^k s$) yazın.`,
            kind: 'answer',
            answer: { type: 'dihedral', n: 12, value: comp },
            hints: [
              firstInv
                ? '$I_u(I_v(x)) = -( -x + v ) + u = x + (u - v) = T_{u-v}$ (yani $(r^u s)(r^v s) = r^{u-v}$).'
                : '$I_u(T_v(x)) = -(x + v) + u = -x + (u - v) = I_{u-v}$ (yani $(r^u s) r^v = r^{u-v} s$).',
            ],
            solution: [
              `$${tiTex(g1)} \\circ ${tiTex(g2)} = (${dTex(g1)})(${dTex(g2)}) = ${dTex(comp)}$ ($${tiTex(comp)}$).`,
            ],
          },
          {
            prompt: `Simetrik **${symC.name}** akoru $S = ${intSetTex(symC.chord)}$ için $S$ akorunu küme olarak sabit bırakan $T/I$ işlemlerinin (kararlı kılan alt grubu $\\operatorname{Stab}_{D_{12}}(S)$) sayısı kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: stab.length },
            hints: [
              `Hem $T_k(S) = S$ sağlayan aktarımları hem de $I_k(S) = S$ sağlayan evirmeleri sayın.`,
              `Kararlı kılan elemanları: $${dSetTex(stab)}$.`,
            ],
            solution: [
              `$\\operatorname{Stab}_{D_{12}}(S) = \\{${stab.map(tiTex).join(',\\,')}\\}$ olup mertebesi **$${stab.length}$** olur.`,
            ],
          },
          {
            prompt: `Yörünge-kararlı kılan teoremine göre $12$-perdeli müzik sisteminde $S$ akoruyla $T/I$-eşdeğer kaç tane **farklı** ${symC.name} akoru vardır?`,
            kind: 'answer',
            answer: { type: 'int', value: orbitSize },
            hints: [
              'Yörünge boyutu $= |D_{12}| / |\\operatorname{Stab}_{D_{12}}(S)| = 24 / ' + stab.length + '$.',
            ],
            solution: [
              `$24 / ${stab.length} = ${orbitSize}$ farklı akor vardır.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: conjugacy in D_12, stabilizer of symmetric chord as dset, proof
    const symChords = [
      { name: 'artırılmış üçlü', chord: [rootA, mod(rootA + 4, 12), mod(rootA + 8, 12)].sort((a, b) => a - b) },
      { name: 'üç ton (tritone)', chord: [rootA, mod(rootA + 6, 12)].sort((a, b) => a - b) },
      { name: 'eksiltilmiş yedili', chord: [rootA, mod(rootA + 3, 12), mod(rootA + 6, 12), mod(rootA + 9, 12)].sort((a, b) => a - b) },
    ];
    const symC = rng.pick(symChords);
    const stab = tiStab(symC.chord);

    const k1 = rng.int(0, 11);
    const gShift = rng.int(1, 5);
    const i1 = dEl(12, k1, 1);
    const tg = dEl(12, gShift, 0);
    const conjRes = dConj(12, tg, i1); // T_g^{-1} I_{k1} T_g = I_{k1 - 2g}

    const sameParity = rng.int(0, 1) === 1;
    const k2 = mod(k1 + (sameParity ? 2 * rng.int(1, 5) : 2 * rng.int(0, 5) + 1), 12);

    return {
      title: `$T/I \\cong D_{12}$ Grubunda Eşlenik Evirmeler ve Simetrik Akorlar`,
      story: `12-ton müzik teorisinde $T_k = r^k$ ve $I_k = r^k s$ işlemleri $D_{12}$ grubunu oluşturur. Evirmelerin eşlenik sınıfları müzikal olarak hangi eksenlerin birbirine aktarılabileceğini, kararlı kılan alt grupları ise simetrik akorların (artırılmış üçlü, eksiltilmiş yedili, üç ton) neden $24$'ten az farklı kopyaya sahip olduğunu belirler.`,
      model: { id: 'music', params: { chord: symC.chord } },
      parts: makeLabels([
        {
          prompt: `$I_{${k1}}$ evirmesinin $T_{${gShift}}$ aktarımı altındaki eşleniği $T_{${gShift}}^{-1} I_{${k1}} T_{${gShift}}$ işlemini $D_{12}$ normal biçiminde ($r^k s$) yazın.`,
          kind: 'answer',
          answer: { type: 'dihedral', n: 12, value: conjRes },
          hints: [
            `$T_g^{-1} I_k T_g = r^{-g} (r^k s) r^g = r^{k - 2g} s = I_{k - 2g \\bmod 12}$.`,
          ],
          solution: [
            `$T_{${gShift}}^{-1} I_{${k1}} T_{${gShift}} = r^{-${gShift}} (r^{${k1}} s) r^{${gShift}} = r^{${k1} - ${2 * gShift}} s = ${dTex(conjRes)}$ ($${tiTex(conjRes)}$).`,
          ],
        },
        {
          prompt: `$I_{${k1}}$ ve $I_{${k2}}$ evirmeleri $D_{12}$ grubunda birbirine **eşlenik** midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: sameParity },
          hints: [
            'Her eşlenik alma $I_k$' + "'nın indisini çift bir sayı ($-2g$) kadar kaydırır; dolayısıyla $k$'nın tekliği/çiftliği değişmez!",
          ],
          solution: [
            `$k_1 = ${k1}$ (${k1 % 2 === 0 ? 'çift' : 'tek'}) ve $k_2 = ${k2}$ (${k2 % 2 === 0 ? 'çift' : 'tek'}): **${sameParity ? 'Evet, aynı eşlenik sınıfındadır' : 'Hayır, farklı eşlenik sınıflarındadır'}**.`,
          ],
        },
        {
          prompt: `Simetrik **${symC.name}** akoru $S = ${intSetTex(symC.chord)}$'nin kararlı kılanı $\\operatorname{Stab}_{D_{12}}(S)$ alt grubunu $D_{12}$ normal biçiminde ($r^k s^m$) yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'dset', n: 12, value: stab },
          hints: [
            `$S$'yi sabit bırakan $T_k = r^k$ aktarımları ve $I_k = r^k s$ evirmelerinin tamamı $|\\operatorname{Stab}| = ${stab.length}$ elemanlı bir dihedral alt grup oluşturur.`,
          ],
          solution: [
            `$\\operatorname{Stab}_{D_{12}}(S) = ${dSetTex(stab)}$ ($|\\operatorname{Stab}| = ${stab.length}$, farklı akor sayısı $24/${stab.length} = ${24 / stab.length}$).`,
          ],
        },
        {
          prompt: '**Kanıt:** (i) $r = T_1$ ve $s = I_0$ üreteçleriyle $T/I$ grubunun $D_{12}$' + "'ye izomorfik olduğunu ($r^{12}=s^2=e$, $srs=r^{-1}$); (ii) $D_{12}$'deki $12$ evirmenin neden iki $6$-elemanlı eşlenik sınıfına ayrıldığını; ve (iii) majör/minör üçlülerin kararlı kılanının neden $\\{e\\}$ olup tüm $24$ üçlünün tek bir yörünge oluşturduğunu kanıtlayın.",
          kind: 'proof',
          hints: [
            'Her $x \\in \\mathbb{Z}_{12}$ için $(s r s)(x) = -((-x) + 1) = x - 1 = r^{-1}(x)$ doğrulayın; $I_k$' + "'nın $T_g$ ve $I_g$ ile eşleniklerini hesaplayın.",
          ],
          solution: [
            '**(i) İzomorfizma:** $T_1^{12}(x) = x + 12 \\equiv x$, $I_0^2(x) = -(-x) = x$ ve $(I_0 T_1 I_0)(x) = -(-x + 1) = x - 1 = T_1^{-1}(x)$. Ayrıca $T_k = r^k$ ve $I_k = r^k s$ tüm $24$ farklı işlemi verir: $T/I \\cong D_{12}$.',
            '**(ii) Evirme sınıfları:** $T_g^{-1} I_k T_g = I_{k-2g}$ ve $I_g^{-1} I_k I_g = I_{2g - k}$; her iki durumda da yeni indis $k$ ile aynı paritededir ($k \\bmod 2$ değişmez). Böylece $I_{\\text{çift}}$ (bir perde çiftinden geçen eksenler) ve $I_{\\text{tek}}$ (iki perde arasından geçen eksenler) olmak üzere $6$' + "'şar elemanlı iki sınıf doğar.",
            '**(iii) Majör/minör yörüngesi:** Majör üçlü $\\{0, 4, 7\\}$ aralığı $(4, 3, 5)$ olarak üç farklı adımdan oluştuğundan hiçbir $T_k$ ($k \\neq 0$) ve hiçbir evirme ($I_k$ aralığı $(3, 4, 5)$ minöre çevirir) akoru sabit bırakmaz: $\\operatorname{Stab} = \\{e\\}$. Yörünge-kararlı kılan teoremiyle yörünge boyutu $24 / 1 = 24$ ($12$ majör $+ 12$ minör) olur.',
          ],
          checklist: [
            '$T_1^{12}=e$, $I_0^2=e$ ve $I_0 T_1 I_0 = T_1^{-1}$ ile $T/I \\cong D_{12}$ kuruldu.',
            '$T_g^{-1} I_k T_g = I_{k-2g}$ ve $I_g^{-1} I_k I_g = I_{2g-k}$ üzerinden paritenin korunduğu ve iki $6$-elemanlı sınıf çıktığı gösterildi.',
            'Majör/minör üçlünün kararlı kılanının $\\{e\\}$ olduğu ve yörünge boyutunun $24/1 = 24$ çıktığı bağlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 3. ozgun-gezegen-hizalanma — Planet/satellite alignments, Z_p x Z_q & CRT
// =====================================================================

const T_GEZEGEN_HIZALANMA = {
  id: 'ozgun-gezegen-hizalanma',
  topic: 'Direkt Çarpımlar ve Çin Kalanı',
  title: 'Uydu Hizalanmaları, $\\mathbb{Z}_p \\times \\mathbb{Z}_q$ ve Çin Kalan Teoremi',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const coprime = [[3, 5], [4, 5], [3, 7], [4, 7], [5, 6], [5, 7], [4, 9], [5, 8]];
      const nonCoprime = [[4, 6], [6, 8], [6, 9], [6, 10], [8, 12], [9, 12], [10, 15]];
      const wantCoprime = rng.int(0, 1) === 1;
      const [p, q] = rng.pick(wantCoprime ? coprime : nonCoprime);
      const L = lcm(p, q);
      const g = gcd(p, q);
      const dayT = rng.int(Math.max(p, q) + 2, L + Math.min(p, q) + 5);
      const ph = [mod(dayT, p), mod(dayT, q)];

      return {
        title: `İki Uydunun Hizalanma Periyodu ($p = ${p}$, $q = ${q}$ gün)`,
        story: `Bir ötegezegenin etrafındaki iki doğal uydu, tam sayı yörünge periyotları sırasıyla $p = ${p}$ gün ve $q = ${q}$ gün olacak biçimde dairesel yörüngelerde dolanıyor. $t = 0$. günde aynı hizada olan uyduların $t$. gündeki ayrık faz çifti $(t \\bmod ${p},\\; t \\bmod ${q}) \\in \\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}}$ olarak modellenir.`,
        model: { id: 'orbits', params: { periods: [p, q] } },
        parts: makeLabels([
          {
            prompt: `İki uydu $t = 0$'dan sonra ilk kez kaçıncı günde tekrar aynı hizaya ($(0, 0)$ fazına) gelir?`,
            kind: 'answer',
            answer: { type: 'int', value: L },
            hints: [
              `Hem $${p}$ hem de $${q}$ günün tam katı olan en küçük pozitif gün sayısı $\\operatorname{ekok}(${p}, ${q})$ değeridir.`,
              `$\\gcd(${p}, ${q}) = ${g}$ olduğundan $\\operatorname{ekok}(${p}, ${q}) = (${p} \\cdot ${q}) / ${g}$.`,
              `$L = ${L}$ gün.`,
            ],
            solution: [
              `Hizalanma periyodu $\\operatorname{ekok}(${p}, ${q}) = \\frac{${p} \\cdot ${q}}{\\gcd(${p}, ${q})} = \\frac{${p * q}}{${g}} = ${L}$ gündür.`,
            ],
          },
          {
            prompt: `$t = ${dayT}$. günde iki uydunun $(t \\bmod ${p},\\; t \\bmod ${q})$ faz çifti sırasıyla nedir? (Virgülle ayırın.)`,
            kind: 'answer',
            answer: { type: 'intlist', value: ph },
            hints: [
              `$${dayT}$ sayısının $${p}$ ve $${q}$ ile bölümünden kalanları ayrı ayrı hesaplayın.`,
              `$${dayT} \\bmod ${p} = ${ph[0]}$ ve $${dayT} \\bmod ${q} = ${ph[1]}$.`,
            ],
            solution: [
              `$${dayT} \\equiv ${ph[0]} \\pmod{${p}}$ ve $${dayT} \\equiv ${ph[1]} \\pmod{${q}}$, yani faz çifti **$(${ph[0]}, ${ph[1]})$** olur.`,
            ],
          },
          {
            prompt: `Zaman ilerledikçe $\\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}}$ grubundaki **tüm** $${p * q}$ olası faz çifti gerçekleşir mi (yani $\\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}}$ devirli midir)?`,
            kind: 'answer',
            answer: { type: 'yesno', value: g === 1 },
            hints: [
              `Ziyaret edilen farklı faz çifti sayısı $|(1, 1)| = \\operatorname{ekok}(${p}, ${q}) = ${L}$ olup toplam çift sayısı $pq = ${p * q}$ değeridir.`,
              `$\\gcd(${p}, ${q}) = 1$ ise tüm çiftler ziyaret edilir, aksi hâlde yalnızca $${L} < ${p * q}$ çift ziyaret edilir.`,
            ],
            solution: [
              `$\\gcd(${p}, ${q}) = ${g}$ ve $\\operatorname{ekok}(${p}, ${q}) = ${L}$ ($pq = ${p * q}$): **${g === 1 ? 'Evet, devirlidir ve tüm çiftler gerçekleşir' : 'Hayır, devirli değildir'}**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      // Three bodies: first two coprime (for clean CRT), third may or may not share factor
      const triples = [
        [3, 4, 5], [3, 5, 7], [4, 5, 7], [3, 4, 6], [4, 5, 6],
        [3, 5, 6], [3, 7, 6], [4, 7, 6], [5, 6, 8], [5, 7, 10],
      ];
      const [p, q, r] = rng.pick(triples);
      const L3 = lcm(lcm(p, q), r);
      const allPairwiseCoprime = gcd(p, q) === 1 && gcd(p, r) === 1 && gcd(q, r) === 1;
      const cosetIdx = (p * q * r) / L3;

      // CRT target for first two bodies (guaranteed gcd(p,q)=1)
      const a = rng.int(1, p - 1);
      const b = rng.int(1, q - 1);
      const sol = crtPair(a, p, b, q);
      const dayAns = sol.rem === 0 ? sol.mod : sol.rem;

      return {
        title: `Üç Uydulu Sistem ($${p}, ${q}, ${r}$ gün) ve Çin Kalanı`,
        story: `Bir gaz devinin üç uydusu sırasıyla $p = ${p}$, $q = ${q}$ ve $r = ${r}$ günlük tam sayı periyotlarla dönüyor ve $t = 0$. günde üçü birden hizalanmış durumda. Sistemin faz uzayı $\\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}} \\times \\mathbb{Z}_{${r}}$ olup her gün $(+1, +1, +1)$ kadar ilerler.`,
        model: { id: 'orbits', params: { periods: [p, q, r] } },
        parts: makeLabels([
          {
            prompt: `Üç uydu birden $t = 0$'dan sonra ilk kez kaçıncı günde tekrar tam hizaya gelir?`,
            kind: 'answer',
            answer: { type: 'int', value: L3 },
            hints: [
              `Üçlü hizalanma periyodu $\\operatorname{ekok}(${p}, ${q}, ${r}) = \\operatorname{ekok}(\\operatorname{ekok}(${p}, ${q}), ${r})$.`,
              `$\\operatorname{ekok}(${p}, ${q}) = ${lcm(p, q)}$ olduğundan $\\operatorname{ekok}(${lcm(p, q)}, ${r})$ değerini hesaplayın.`,
            ],
            solution: [
              `$\\operatorname{ekok}(${p}, ${q}) = ${lcm(p, q)}$ ve $\\operatorname{ekok}(${lcm(p, q)}, ${r}) = ${L3}$ gün.`,
            ],
          },
          {
            prompt: `İlk iki uydunun ($p = ${p}$ ve $q = ${q}$) sırasıyla $t \\equiv ${a} \\pmod{${p}}$ ve $t \\equiv ${b} \\pmod{${q}}$ fazlarına ulaştığı **en küçük pozitif** gün $t$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: dayAns },
            hints: [
              `$t = ${a} + ${p}k$ biçimindeki sayılardan hangisi mod $${q}$ için $${b}$ kalanını verir?`,
              `$k = 0, 1, \\dots, ${q - 1}$ değerlerini deneyin ($\\gcd(${p}, ${q}) = 1$ olduğundan $[0, ${p * q - 1}]$ aralığında tek çözüm vardır).`,
            ],
            solution: [
              `$t = ${a} + ${p}k \\equiv ${b} \\pmod{${q}}$ denklemini sağlayan en küçük pozitif çözüm **$t = ${dayAns}$** ($${dayAns} \\bmod ${p} = ${a}$, $${dayAns} \\bmod ${q} = ${b}$).`,
            ],
          },
          {
            prompt: `Üçlü sistemin $\\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}} \\times \\mathbb{Z}_{${r}}$ grubu devirli midir (yani tüm $${p * q * r}$ faz üçlüsü gerçekleşir mi)?`,
            kind: 'answer',
            answer: { type: 'yesno', value: allPairwiseCoprime },
            hints: [
              `Gerçekleşen farklı üçlü sayısı $\\operatorname{ekok}(${p}, ${q}, ${r}) = ${L3}$ ile toplam durum sayısı $pqr = ${p * q * r}$ değerini karşılaştırın.`,
            ],
            solution: [
              `$\\operatorname{ekok}(${p}, ${q}, ${r}) = ${L3}$ ve $pqr = ${p * q * r}$: **${allPairwiseCoprime ? 'Evet, ikişer ikişer aralarında asal olduklarından devirlidir' : 'Hayır, ortak bölen bulunduğu için devirli değildir'}**.`,
            ],
          },
          {
            prompt: `Ulaşılabilen yörünge alt grubu $H = \\langle (1, 1, 1) \\rangle$'nin $\\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}} \\times \\mathbb{Z}_{${r}}$ içindeki indeksi (ayrık faz yörüngesi sayısı) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: cosetIdx },
            hints: [
              `$|H| = \\operatorname{ekok}(${p}, ${q}, ${r}) = ${L3}$ olduğundan indeks $pqr / |H| = ${p * q * r} / ${L3}$.`,
            ],
            solution: [
              `İndeks $[G : H] = \\frac{${p * q * r}}{${L3}} = ${cosetIdx}$.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: non-coprime 3-body system, reachability criterion, 3-body CRT, proof
    const nonCopTriples = [
      [4, 6, 5], [6, 9, 5], [4, 6, 7], [6, 8, 5], [6, 10, 7], [4, 8, 5], [6, 9, 4], [8, 12, 5],
    ];
    const [p, q, r] = rng.pick(nonCopTriples);
    const L3 = lcm(lcm(p, q), r);
    const gPQ = gcd(p, q);

    // Part b: test whether a target (aTest, bTest, cTest) is reachable (50% yes, 50% no)
    const wantReach = rng.int(0, 1) === 1;
    let aT, bT, cT;
    if (wantReach) {
      const secretDay = rng.int(1, L3 - 1);
      aT = mod(secretDay, p);
      bT = mod(secretDay, q);
      cT = mod(secretDay, r);
    } else {
      // Break compatibility mod gPQ (> 1)
      aT = rng.int(0, p - 1);
      bT = mod(aT + 1, q);
      cT = rng.int(0, r - 1);
    }
    const isReach = crtSystem([[aT, p], [bT, q], [cT, r]]) !== null;

    // Part c: guaranteed-reachable 3-body target, find smallest positive day
    const hiddenDay = rng.int(1, L3 - 1);
    const ta = mod(hiddenDay, p), tb = mod(hiddenDay, q), tc = mod(hiddenDay, r);
    const sol3 = crtSystem([[ta, p], [tb, q], [tc, r]]);
    const minDay3 = sol3.rem === 0 ? sol3.mod : sol3.rem;

    return {
      title: `Ortak Bölenli Üçlü Yörünge Sistemi ($${p}, ${q}, ${r}$ gün) ve Genelleştirilmiş Çin Kalanı`,
      story: `Üç gözlem uydusu sırasıyla $p = ${p}$, $q = ${q}$ ve $r = ${r}$ günlük periyotlarla dönüyor ($t = 0$'da hizalılar). İlk iki periyot $\\gcd(${p}, ${q}) = ${gPQ} > 1$ ortak bölenine sahip olduğundan tüm faz üçlülerine ulaşılamaz; ulaşılabilen fazlar $\\varphi(t) = (t \\bmod ${p},\\, t \\bmod ${q},\\, t \\bmod ${r})$ homomorfizmasının görüntüsüdür.`,
      model: { id: 'orbits', params: { periods: [p, q, r] } },
      parts: makeLabels([
        {
          prompt: `Üç uydunun tam hizalanma periyodu $\\operatorname{ekok}(${p}, ${q}, ${r})$ kaç gündür?`,
          kind: 'answer',
          answer: { type: 'int', value: L3 },
          hints: [`$\\operatorname{ekok}(${p}, ${q}) = ${lcm(p, q)}$ ve $\\operatorname{ekok}(${lcm(p, q)}, ${r}) = ${L3}$.`],
          solution: [`$\\operatorname{ekok}(${p}, ${q}, ${r}) = ${L3}$ gün.`],
        },
        {
          prompt: `Hedef faz üçlüsü $(${aT},\\, ${bT},\\, ${cT}) \\in \\mathbb{Z}_{${p}} \\times \\mathbb{Z}_{${q}} \\times \\mathbb{Z}_{${r}}$ herhangi bir tam sayı günde **ulaşılabilir** midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isReach },
          hints: [
            `Genelleştirilmiş Çin Kalanı koşulu: her çift için $r_i \\equiv r_j \\pmod{\\gcd(m_i, m_j)}$ sağlanmalıdır.`,
          ],
          solution: [
            `Çiftler arası uyumluluk: $(${aT} - ${bT}) \\bmod ${gPQ} = ${mod(aT - bT, gPQ)}$ (diğer çiftler için $\\gcd(${p},${r})=${gcd(p, r)}$, $\\gcd(${q},${r})=${gcd(q, r)}$): **${isReach ? 'Evet, ulaşılabilir' : 'Hayır, çelişki nedeniyle ulaşılamaz'}**.`,
          ],
        },
        {
          prompt: `Ulaşılabilir olan $(${ta},\\, ${tb},\\, ${tc})$ faz üçlüsüne ilk kez kaçıncı **pozitif** günde ($1 \\le t \\le ${L3}$) ulaşılır?`,
          kind: 'answer',
          answer: { type: 'int', value: minDay3 },
          hints: [
            `Önce $t \\equiv ${ta} \\pmod{${p}}$ ve $t \\equiv ${tb} \\pmod{${q}}$ sistemini $\\bmod ${lcm(p, q)}$ olarak çözün ($t \\equiv ${crtPair(ta, p, tb, q).rem} \\pmod{${lcm(p, q)}}$), ardından $t \\equiv ${tc} \\pmod{${r}}$ ile birleştirin.`,
          ],
          solution: [
            `İlk iki denklikten $t \\equiv ${crtPair(ta, p, tb, q).rem} \\pmod{${lcm(p, q)}}$ bulunur; $t \\equiv ${tc} \\pmod{${r}}$ ile birleştirilince en küçük pozitif çözüm **$t = ${minDay3}$** elde edilir.`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\varphi: (\\mathbb{Z}, +) \\to \\mathbb{Z}_p \\times \\mathbb{Z}_q$, $\\varphi(t) = (t \\bmod p,\\; t \\bmod q)$ dönüşümünün bir grup homomorfizması olduğunu, $\\ker\\varphi = \\operatorname{ekok}(p, q)\\mathbb{Z}$ olduğunu ve Birinci İzomorfizma Teoremiyle $\\mathbb{Z}_p \\times \\mathbb{Z}_q$ grubunun tüm elemanlarına ulaşılmasının ($\\varphi$ örten) gerek ve yeter koşulunun $\\gcd(p, q) = 1$ olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            'Modüler toplamadan homomorfizmayı, $p \\mid t$ ve $q \\mid t \\iff \\operatorname{ekok}(p,q) \\mid t$ denkliğinden çekirdeği, $|\\operatorname{im}\\varphi| = |\\mathbb{Z}/\\operatorname{ekok}(p,q)\\mathbb{Z}| = \\operatorname{ekok}(p,q)$ eşitliğinden örtenlik koşulunu çıkarın.',
          ],
          solution: [
            '**Homomorfizma:** $((t_1 + t_2) \\bmod p,\\, (t_1 + t_2) \\bmod q) = (t_1 \\bmod p,\\, t_1 \\bmod q) + (t_2 \\bmod p,\\, t_2 \\bmod q)$, yani $\\varphi(t_1 + t_2) = \\varphi(t_1) + \\varphi(t_2)$.',
            '**Çekirdek:** $t \\in \\ker\\varphi \\iff p \\mid t$ ve $q \\mid t \\iff \\operatorname{ekok}(p, q) \\mid t$, yani $\\ker\\varphi = \\operatorname{ekok}(p, q)\\mathbb{Z}$.',
            '**Birinci İzomorfizma Teoremi:** $\\operatorname{im}\\varphi \\cong \\mathbb{Z} / \\operatorname{ekok}(p, q)\\mathbb{Z} \\cong \\mathbb{Z}_{\\operatorname{ekok}(p, q)}$, dolayısıyla $|\\operatorname{im}\\varphi| = \\operatorname{ekok}(p, q) = \\frac{pq}{\\gcd(p, q)}$.',
            '**Örtenlik:** $\\varphi$ örten $\\iff |\\operatorname{im}\\varphi| = |\\mathbb{Z}_p \\times \\mathbb{Z}_q| = pq \\iff \\frac{pq}{\\gcd(p, q)} = pq \\iff \\gcd(p, q) = 1$ (Çin Kalan Teoremi!).',
          ],
          checklist: [
            '$\\varphi(t_1+t_2) = \\varphi(t_1) + \\varphi(t_2)$ homomorfizma özelliği doğrulandı.',
            '$\\ker\\varphi = \\operatorname{ekok}(p, q)\\mathbb{Z}$ olduğu kanıtlandı.',
            'Birinci İzomorfizma Teoremiyle $|\\operatorname{im}\\varphi| = \\operatorname{ekok}(p, q) = pq / \\gcd(p, q)$ bulundu.',
            'Örtenliğin $\\gcd(p, q) = 1$ ile denkliği kuruldu.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 4. ozgun-pauli-grubu — Pauli matrices & the 16-element Pauli group P_1
// =====================================================================

function pauliChoice(rng, correctIdx) {
  const correct = PAULI_DATA.elems[correctIdx];
  const sameBase = PAULI_DATA.elems
    .filter(e => e.base === correct.base && e.idx !== correctIdx)
    .map(e => e.tex);
  return shuffleChoice(rng, correct.tex, sameBase);
}

const T_PAULI_GRUBU = {
  id: 'ozgun-pauli-grubu',
  topic: 'Matris Grupları ve Bölüm',
  title: 'Pauli Matrisleri ve $16$ Elemanlı Pauli Grubu $P_1$',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const P = PAULI_DATA;
    const model = { id: 'pauli', params: {} };
    const nonCentral = P.elems.filter(e => e.base !== 'I').map(e => e.idx);

    if (level === 'isinma') {
      const aIdx = rng.pick(nonCentral);
      // 50% commuting pair (same base or central), 50% anticommuting pair (different non-I bases)
      const wantComm = rng.int(0, 1) === 1;
      const bPool = wantComm
        ? P.elems.filter(e => e.idx !== 0 && P.mul(aIdx, e.idx) === P.mul(e.idx, aIdx)).map(e => e.idx)
        : nonCentral.filter(j => P.elems[j].base !== P.elems[aIdx].base);
      const bIdx = rng.pick(bPool);
      const prodIdx = P.mul(aIdx, bIdx);
      const commutes = P.mul(aIdx, bIdx) === P.mul(bIdx, aIdx);
      const ordTarget = rng.pick(P.elems.filter(e => e.idx !== 0).map(e => e.idx));
      const ordVal = P.ord(ordTarget);

      return {
        title: `Tek Kübit Pauli Grubu $P_1$: Çarpma, Değişme ve Mertebe`,
        story: `Kuantum mekaniğinde spin-$1/2$ gözlenebilirlerini temsil eden Pauli matrisleri $X^2 = Y^2 = Z^2 = I$, $XY = iZ$, $YZ = iX$, $ZX = iY$ ve $BA = -AB$ (farklı $A, B \\in \\{X, Y, Z\\}$ için) bağıntılarını sağlar. Faz çarpanları $\\{\\pm 1, \\pm i\\}$ ile birlikte oluşan $16$ elemanlı $P_1 = \\{\\pm I, \\pm iI, \\pm X, \\pm iX, \\pm Y, \\pm iY, \\pm Z, \\pm iZ\\}$ kümesi matris çarpımı altında bir gruptur.`,
        model,
        parts: makeLabels([
          {
            prompt: `$P_1$ grubunda $(${P.elems[aIdx].label})(${P.elems[bIdx].label})$ çarpımının sonucu nedir?`,
            kind: 'answer',
            answer: pauliChoice(rng, prodIdx),
            hints: [
              'Önce önlerindeki skaler fazları ($\\pm 1, \\pm i$) çarpın, sonra Pauli matrislerini ($X, Y, Z$) döngüsel kurala göre çarpın.',
              'Döngüsel sıra $X \\to Y \\to Z \\to X$ için $+i$, ters sıra için $-i$ gelir; aynı matrisin karesi $I$ olur.',
              `Sonuç: ${P.elems[prodIdx].tex}.`,
            ],
            solution: [
              `$(${P.elems[aIdx].label})(${P.elems[bIdx].label}) = ${P.elems[prodIdx].label}$.`,
            ],
          },
          {
            prompt: `${P.elems[aIdx].tex} ve ${P.elems[bIdx].tex} elemanları birbiriyle **değişmeli** midir (komüte eder mi)?`,
            kind: 'answer',
            answer: { type: 'yesno', value: commutes },
            hints: [
              `$(${P.elems[bIdx].label})(${P.elems[aIdx].label}) = ${P.elems[P.mul(bIdx, aIdx)].label}$ sonucunu önceki şıkla karşılaştırın.`,
              'İki farklı Pauli matrisi ($X, Y, Z$) ters-değişmelidir ($AB = -BA$), aynı tabanlı veya $I$ katlı olanlar değişmelidir.',
            ],
            solution: [
              `$(${P.elems[aIdx].label})(${P.elems[bIdx].label}) = ${P.elems[prodIdx].label}$ ve $(${P.elems[bIdx].label})(${P.elems[aIdx].label}) = ${P.elems[P.mul(bIdx, aIdx)].label}$: **${commutes ? 'Evet, değişmelidir' : 'Hayır, ters-değişmelidir'}**.`,
            ],
          },
          {
            prompt: `${P.elems[ordTarget].tex} elemanının $P_1$ grubundaki mertebesi kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: ordVal },
            hints: [
              `$(${P.elems[ordTarget].label})^2 = ${P.elems[P.mul(ordTarget, ordTarget)].label}$ değerini hesaplayın.`,
              'Karesi $I$ ise mertebe $2$, karesi $-I$ ise dördüncü kuvveti $I$ olduğundan mertebe $4$' + "'tür.",
            ],
            solution: [
              `$(${P.elems[ordTarget].label})^2 = ${P.elems[P.mul(ordTarget, ordTarget)].label}$ olduğundan $|${P.elems[ordTarget].label}| = ${ordVal}$.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const a = rng.pick(nonCentral);
      const b = rng.pick(nonCentral.filter(j => P.elems[j].base !== P.elems[a].base));
      const c = rng.pick(nonCentral);
      const prod3 = P.mul(P.mul(a, b), c);

      // Conjugate g^{-1} a g
      const g = rng.pick(nonCentral);
      const conjRes = P.conj(g, a);
      const quotChoice = shuffleChoice(rng, '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$', ['$\\mathbb{Z}_4$', '$D_4$', '$Q_8$']);

      return {
        title: `Pauli Grubu $P_1$: Eşleniklik, Merkez ve Faz Bölümü`,
        story: `Kuantum hata düzeltme kodlarının temel taşı olan tek kübitlik Pauli grubu $P_1 = \\{\\pm 1, \\pm i\\} \\cdot \\{I, X, Y, Z\\}$ ($|P_1| = 16$) skaler fazlardan oluşan merkezi $Z(P_1)$ ve fazları göz ardı eden projektif bölümü $P_1 / Z(P_1)$ üzerinden incelenir.`,
        model,
        parts: makeLabels([
          {
            prompt: `Üçlü çarpım $(${P.elems[a].label})(${P.elems[b].label})(${P.elems[c].label})$ sonucu hangi $P_1$ elemanıdır?`,
            kind: 'answer',
            answer: pauliChoice(rng, prod3),
            hints: [
              `Önce ilk ikisini çarpın: $(${P.elems[a].label})(${P.elems[b].label}) = ${P.elems[P.mul(a, b)].label}$.`,
              `Ardından sağdan ${P.elems[c].tex} ile çarpın.`,
            ],
            solution: [
              `$(${P.elems[a].label})(${P.elems[b].label}) = ${P.elems[P.mul(a, b)].label}$ ve $(${P.elems[P.mul(a, b)].label})(${P.elems[c].label}) = ${P.elems[prod3].label}$.`,
            ],
          },
          {
            prompt: `$a = ${P.elems[a].label}$ elemanının $g = ${P.elems[g].label}$ ile eşleniği $g^{-1} a g$ nedir?`,
            kind: 'answer',
            answer: pauliChoice(rng, conjRes),
            hints: [
              `$g$ ile $a$ değişiyorsa $g^{-1} a g = a$, ters-değişiyorsa $g^{-1} a g = -a$ çıkar!`,
            ],
            solution: [
              `$g^{-1} = ${P.elems[P.inv(g)].label}$ olup $g^{-1} a g = (${P.elems[P.inv(g)].label})(${P.elems[a].label})(${P.elems[g].label}) = ${P.elems[conjRes].label}$.`,
            ],
          },
          {
            prompt: `$P_1$ grubunun merkezinin mertebesi $|Z(P_1)|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: P.center.length },
            hints: [
              'Hangi $P_1$ elemanları $X, Y, Z$' + "'nin hepsiyle değişmelidir? Yalnızca $I$'nın skaler katları!",
            ],
            solution: [
              `$Z(P_1) = \\{I, -I, iI, -iI\\} \\cong \\mathbb{Z}_4$ olup mertebesi **$|Z(P_1)| = ${P.center.length}$**.`,
            ],
          },
          {
            prompt: `Global kuantum fazlarını göz ardı eden bölüm grubu $P_1 / Z(P_1)$ hangi gruba izomorfiktir?`,
            kind: 'answer',
            answer: quotChoice,
            hints: [
              '$|P_1 / Z(P_1)| = 16 / 4 = 4$ ve her kosetin ($[X], [Y], [Z]$) karesi birim koset $[I]$ olur.',
            ],
            solution: [
              'Dört koset $[I], [X], [Y], [Z]$ için $[X]^2 = [Y]^2 = [Z]^2 = [I]$ ve $[X][Y] = [Z] = [Y][X]$ olduğundan $P_1 / Z(P_1) \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.',
            ],
          },
        ]),
      };
    }

    // zorlayici: commutator, conjugacy classes / order counts, Q_8 subgroup inside P_1, proof
    const a = rng.pick(nonCentral);
    const b = rng.pick(nonCentral.filter(j => P.elems[j].base !== P.elems[a].base));
    const commIdx = P.comm(a, b); // always -I!
    const askOrder4 = rng.int(0, 1) === 1;
    const ord4Count = P.elems.filter(e => P.ord(e.idx) === 4).length; // 8
    const subChoice = shuffleChoice(rng, '$Q_8$ (Kuaterniyon grubu)', ['$D_4$', '$\\mathbb{Z}_8$', '$\\mathbb{Z}_4 \\times \\mathbb{Z}_2$']);

    return {
      title: `Pauli Grubu $P_1$'in Yapısı: Sınıf Denklemi, $Q_8$ Alt Grubu ve Bölüm`,
      story: `$16$ elemanlı Pauli grubu $P_1 = \\{\\pm 1, \\pm i\\} \\cdot \\{I, X, Y, Z\\}$ içinde komütatörler, eşlenik sınıfları ve $\\mathbf{i} = -iX,\\; \\mathbf{j} = -iY,\\; \\mathbf{k} = -iZ$ anti-Hermisyen üreteçlerinin oluşturduğu $8$ elemanlı alt grup $H = \\langle -iX, -iY \\rangle$ kuantum spin-$1/2$ dönüşlerinin ($\\mathrm{SU}(2)$) ayrık çekirdeğini verir.`,
      model,
      parts: makeLabels([
        {
          prompt: `Ters-değişmeli $a = ${P.elems[a].label}$ ve $b = ${P.elems[b].label}$ elemanlarının komütatörü $[a, b] = a b a^{-1} b^{-1}$ nedir?`,
          kind: 'answer',
          answer: pauliChoice(rng, commIdx),
          hints: [
            '$ab = -ba$ olduğundan $aba^{-1}b^{-1} = (-ba)a^{-1}b^{-1} = -I$.',
          ],
          solution: [
            `$a$ ve $b$ ters-değişmeli olduğundan $ab = -ba \\implies a b a^{-1} b^{-1} = -I$.`,
          ],
        },
        askOrder4
          ? {
            prompt: `$P_1$ grubundaki $16$ elemandan kaç tanesinin mertebesi tam **$4$**'tür?`,
            kind: 'answer',
            answer: { type: 'int', value: ord4Count },
            hints: [
              'Hangi faz-matris çiftlerinin karesi $-I$ çıkar? $(\\pm i M)^2 = -M^2 = -I$!',
            ],
            solution: [
              '$\\pm i I, \\pm i X, \\pm i Y, \\pm i Z$ elemanlarının her birinin karesi $-I$ ve dördüncü kuvveti $I$ olduğundan tam **$8$** elemanın mertebesi $4$' + "'tür (geriye $1$ adet mertebe-$1$ ve $7$ adet mertebe-$2$ eleman kalır).",
            ],
          }
          : {
            prompt: `$P_1$ grubunun toplam kaç tane **eşlenik sınıfı** vardır?`,
            kind: 'answer',
            answer: { type: 'int', value: P.conjClasses.length },
            hints: [
              '$Z(P_1)$ içindeki $4$ eleman tekil ($1$-elemanlı) sınıf oluşturur; kalan $12$ elemanın her birinin eşlenik sınıfı $\\{\\alpha M, -\\alpha M\\}$ ($2$-elemanlı) biçimindedir.',
            ],
            solution: [
              `Merkezden $4$ tekil sınıf ve kalan $12$ elemandan $12/2 = 6$ ikili sınıf olmak üzere toplam **$${P.conjClasses.length}$** eşlenik sınıfı vardır ($16 = 1+1+1+1+2+2+2+2+2+2$).`,
            ],
          },
        {
          prompt: `$H = \\langle -iX, -iY \\rangle = \\{\\pm I, \\pm iX, \\pm iY, \\pm iZ\\} \\le P_1$ ($|H| = 8$) alt grubu aşağıdaki gruplardan hangisine izomorfiktir?`,
          kind: 'answer',
          answer: subChoice,
          hints: [
            '$\\mathbf{i} = -iX, \\mathbf{j} = -iY, \\mathbf{k} = -iZ$ için $\\mathbf{i}^2 = \\mathbf{j}^2 = \\mathbf{k}^2 = \\mathbf{i}\\mathbf{j}\\mathbf{k} = -I$ bağıntısını kontrol edin.',
          ],
          solution: [
            '$(-iX)^2 = (-iY)^2 = (-iZ)^2 = -I$ ve $(-iX)(-iY) = -XY = -iZ$ olduğundan $H \\cong Q_8$ (Kuaterniyon grubu; ayrıca $[P_1 : H] = 2$ olduğu için $H \\trianglelefteq P_1$).',
          ],
        },
        {
          prompt: '**Kanıt:** $P_1$ Pauli grubunun merkezinin $Z(P_1) = \\{\\pm I, \\pm iI\\} \\cong \\mathbb{Z}_4$ olduğunu ve bölüm grubunun $P_1 / Z(P_1) \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ olduğunu kanıtlayın; fiziksel olarak bir kuantum durumu $\\psi$ ile $e^{i\\phi}\\psi$ eşdeğer olduğundan ölçüm operatörlerinin neden faz modülo $\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ gibi davrandığını açıklayın.',
          kind: 'proof',
          hints: [
            'Her $\\alpha I$ elemanının her matrisle değiştiğini, buna karşın $M \\in \\{X, Y, Z\\}$ için $M$ ile ters-değişen başka bir Pauli matrisi bulunduğunu gösterin; ardından $Z(P_1)$ kosetlerinin çarpım tablosunu yazın.',
          ],
          solution: [
            '**Merkez:** $cI$ ($c \\in \\{\\pm 1, \\pm i\\}$) skaler matrisleri her matrisle değişmelidir, yani $\\{\\pm I, \\pm iI\\} \\subseteq Z(P_1)$. Öte yandan $M \\in \\{X, Y, Z\\}$ için farklı bir $N \\in \\{X, Y, Z\\}$ seçilirse $(\\alpha M)N = -N(\\alpha M) \\neq N(\\alpha M)$, dolayısıyla $\\alpha M \\notin Z(P_1)$. Böylece $Z(P_1) = \\langle iI \\rangle \\cong \\mathbb{Z}_4$.',
            '**Bölüm grubu:** $Z(P_1) \\trianglelefteq P_1$ olduğundan $P_1 / Z(P_1)$ dört kosetten oluşur: $Z_0 = Z(P_1)$, $XZ_0$, $YZ_0$, $ZZ_0$. $X^2 = Y^2 = Z^2 = I \\in Z_0$ olduğundan her birim-dışı kosetin mertebesi $2$' + "'dir; $XY = iZ \\in ZZ_0$ ve $YX = -iZ \\in ZZ_0$ olduğundan koset çarpımı değişmelidir. Dolayısıyla $P_1 / Z(P_1) \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.",
            '**Fiziksel yorum:** Kuantum mekaniğinde global faz $c \\in \\{\\pm 1, \\pm i\\}$ fiziksel durumu (ışını) değiştirmez; dolayısıyla $P_1$ içindeki $X$ ve $Y$ ters-değişmeli olsa da ışın uzayı üzerinde $[X][Y] = [Y][X] = [Z]$ (projektif temsil) olarak değişmeli $V_4$ grubu gibi etki ederler.',
          ],
          checklist: [
            'Skaler fazların $Z(P_1)$ içinde olduğu ve $X, Y, Z$ katlarının ters-değişme yüzünden merkezde olmadığı gösterilerek $Z(P_1) = \\{\\pm I, \\pm iI\\} \\cong \\mathbb{Z}_4$ kanıtlandı.',
            'Dört koset $Z_0, XZ_0, YZ_0, ZZ_0$ yazılarak her birinin karesinin $Z_0$ olduğu ve $XY, YX$' + "'in aynı $ZZ_0$ kosetine düştüğü gösterildi.",
            '$P_1 / Z(P_1) \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ sonucu ve global faz eşdeğerliğinin fiziksel yorumu verildi.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 5. ozgun-kristal-kusuru — Crystal lattice defects: D_4 (square) & D_6 (hexagonal)
// =====================================================================

function buildCrystalDefect(rng, n, allowedKinds) {
  const kind = rng.pick(allowedKinds);
  if (kind === 'single') {
    const v = rng.int(1, n);
    return {
      kind, n, subset: [v],
      desc: `yalnızca **$${v}$. komşu bağ yönünde** yer alan tek bir boşluk/yabancı atom kusuru ($M = \\{${v}\\}$)`,
      shortDesc: `$\\{${v}\\}$ tek bağ kusuru`,
    };
  }
  if (kind === 'opposite') {
    const half = n / 2;
    const v = rng.int(1, half);
    const pair = [v, v + half];
    return {
      kind, n, subset: pair,
      desc: `karşılıklı **$${pair[0]}$ ve $${pair[1]}$. bağ yönleri boyunca** uzanan çift eksenli (bölünmüş ara-yer) kusuru ($M = \\{${pair[0]}, ${pair[1]}\\}$)`,
      shortDesc: `$\\{${pair[0]}, ${pair[1]}\\}$ eksenel kusuru`,
    };
  }
  if (kind === 'edge') {
    const v = rng.int(1, n);
    const w = (v % n) + 1;
    const pair = [v, w].sort((a, b) => a - b);
    return {
      kind, n, subset: pair,
      desc: `komşu **$${pair[0]}$ ve $${pair[1]}$. bağları** birleştiren ikili dimer kusuru ($M = \\{${pair[0]}, ${pair[1]}\\}$)`,
      shortDesc: `$\\{${pair[0]}, ${pair[1]}\\}$ dimer kusuru`,
    };
  }
  if (kind === 'trimer') {
    // Only for n = 6
    const set = rng.int(0, 1) === 0 ? [1, 3, 5] : [2, 4, 6];
    return {
      kind, n, subset: set,
      desc: `birer atlayarak **$${set.join(', ')}$ yönlerindeki** üç komşuyu etkileyen üçgen alt-örgü kusuru ($M = \\{${set.join(', ')}\\}$)`,
      shortDesc: `$\\{${set.join(', ')}\\}$ üçgen kusuru`,
    };
  }
  // 'vpair' (next-nearest in n = 6, 120° angle)
  const v = rng.int(1, 6);
  const w = ((v + 1) % 6) + 1;
  const pair = [v, w].sort((a, b) => a - b);
  return {
    kind, n, subset: pair,
    desc: `aralarında $120^\\circ$ açı bulunan **$${pair[0]}$ ve $${pair[1]}$. bağ yönlerindeki** açılı V-kusuru ($M = \\{${pair[0]}, ${pair[1]}\\}$)`,
    shortDesc: `$\\{${pair[0]}, ${pair[1]}\\}$ açılı kusuru`,
  };
}

const T_KRISTAL_KUSURU = {
  id: 'ozgun-kristal-kusuru',
  topic: 'Grup Eylemi ve Kristal Simetrisi',
  title: 'Kristal Örgü Kusurları ($D_4$ ve $D_6$): Kararlı Kılan ve Yörünge',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const n = rng.pick([4, 6]);
    const latticeName = n === 4 ? 'kare örgü' : 'altıgen (grafen) örgü';
    const model = { id: 'polygon', params: { n } };

    const kinds = level === 'isinma'
      ? ['single', 'opposite', 'edge']
      : level === 'odev'
        ? (n === 6 ? ['single', 'opposite', 'edge', 'trimer', 'vpair'] : ['single', 'opposite', 'edge'])
        : (n === 6 ? ['opposite', 'trimer', 'vpair', 'single'] : ['opposite', 'single', 'edge']);

    const defect = buildCrystalDefect(rng, n, kinds);
    const stab = dStabOfSet(n, defect.subset);
    const orbitSize = (2 * n) / stab.length;
    const isNorm = dIsNormal(n, stab);

    // Distinct rotated target orientation for coset question
    const allOrbs = (() => {
      const seen = new Map();
      for (const g of dAll(n)) {
        const img = dApplyToSet(n, g, defect.subset);
        const k = img.join(',');
        if (!seen.has(k)) seen.set(k, img);
      }
      return [...seen.values()];
    })();
    const otherOrient = rng.pick(allOrbs.filter(o => o.join(',') !== defect.subset.join(',')));
    const cosetToOther = dCosetMappingSet(n, defect.subset, otherOrient);

    if (level === 'isinma') {
      return {
        title: `${n === 4 ? 'Kare' : 'Altıgen'} Örgüde Nokta Kusuru ve $D_{${n}}$ Kararlı Kılanı`,
        story: `İki boyutlu bir **${latticeName}** düğümünün nokta simetri grubu $D_{${n}}$ ($|D_{${n}}| = ${2 * n}$) olup düğüm etrafındaki $${n}$ en yakın komşu bağ yönü saat yönünün tersine $1, \\dots, ${n}$ diye numaralanmıştır ($r$: $2\\pi/${n}$ dönme, $s$: $1$. yönden geçen yansıma). Bu düğümde ${defect.desc} oluşuyor.`,
        model,
        parts: makeLabels([
          {
            prompt: `Kusurlu düğümün $D_{${n}}$ içindeki korunan simetri alt grubu $H = \\operatorname{Stab}_{D_{${n}}}(M)$ elemanlarını normal biçimde ($r^k s^m$) yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'dset', n, value: stab },
            hints: [
              `$M = ${intSetTex(defect.subset)}$ kümesini (küme olarak) kendi üzerine götüren tüm $g \\in D_{${n}}$ elemanlarını bulun.`,
              `Birim $e$ her zaman $H$'dedir; dönmelerden hangileri $M$'yi korur, yansımalardan hangileri $M$'yi korur?`,
              `Kararlı kılan alt grup $${stab.length}$ elemanlıdır: $${dSetTex(stab)}$.`,
            ],
            solution: [
              `$D_{${n}}$ içindeki $${2 * n}$ elemanı $M = ${intSetTex(defect.subset)}$ üzerine uyguladığımızda $M$'yi koruyanlar: **$H = ${dSetTex(stab)}$**.`,
            ],
          },
          {
            prompt: `Korunan simetri alt grubunun mertebesi $|H|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: stab.length },
            hints: [
              'Önceki şıkta bulduğunuz $H$ kümesinin eleman sayısını sayın.',
            ],
            solution: [
              `$|H| = ${stab.length}$ ($|H|$ mutlaka $|D_{${n}}| = ${2 * n}$ sayısını böler).`,
            ],
          },
          {
            prompt: `Yörünge-kararlı kılan teoremine göre bu kristal düğümünde aynı kusurun kaç tane **simetrik olarak eşdeğer yönelimi** (yörünge boyutu $[D_{${n}} : H]$) vardır?`,
            kind: 'answer',
            answer: { type: 'int', value: orbitSize },
            hints: [
              'Eşdeğer yönelim sayısı $H$' + "'nin $D_n$ içindeki indeksine eşittir: $|\\text{Yörünge}| = |D_n| / |H|$.",
              `$${2 * n} / ${stab.length} = ${orbitSize}$.`,
            ],
            solution: [
              `Eşdeğer yönelim sayısı $[D_{${n}} : H] = \\frac{${2 * n}}{${stab.length}} = ${orbitSize}$ (örneğin ${allOrbs.map(o => `$${intSetTex(o)}$`).join(', ')}).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      return {
        title: `${n === 4 ? 'Kare ($D_4$)' : 'Altıgen ($D_6$)'} Kristal Kusuru: İndeks, Normallik ve Koset`,
        story: `Bir **${latticeName}** düğümünün $D_{${n}}$ ($|D_{${n}}| = ${2 * n}$) nokta simetrisi, düğüm çevresindeki $${n}$ bağ yönü ($1, \\dots, ${n}$) üzerinde etki eder. Düğümde ${defect.desc} meydana geldiğinde kırılan simetriyi inceleyelim.`,
        model,
        parts: makeLabels([
          {
            prompt: `Kusurun kararlı kılan alt grubu $H = \\operatorname{Stab}_{D_{${n}}}(M)$ elemanlarını $D_{${n}}$ normal biçiminde yazın.`,
            kind: 'answer',
            answer: { type: 'dset', n, value: stab },
            hints: [
              `$g(M) = M$ koşulunu sağlayan dönmeleri ve yansımaları $D_{${n}}$ içinde tarayın.`,
              `$|H| = ${stab.length}$ eleman bulunur.`,
            ],
            solution: [
              `$M = ${intSetTex(defect.subset)}$ kümesini koruyan alt grup: **$H = ${dSetTex(stab)}$** ($|H| = ${stab.length}$).`,
            ],
          },
          {
            prompt: `Bu kusurun kristal içinde kaç tane eşdeğer yönelimi ($[D_{${n}} : H]$ indeksi) vardır?`,
            kind: 'answer',
            answer: { type: 'int', value: orbitSize },
            hints: [`$|D_{${n}}| / |H| = ${2 * n} / ${stab.length}$.`],
            solution: [`$[D_{${n}} : H] = ${2 * n} / ${stab.length} = ${orbitSize}$.`],
          },
          {
            prompt: `$H = ${dSetTex(stab)}$ alt grubu $D_{${n}}$ içinde **normal** midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: isNorm },
            hints: [
              isNorm
                ? `$[D_{${n}} : H] = ${orbitSize}$ olduğuna dikkat edin — indeksi $2$ olan her alt grup normaldir!`
                : `$H$'deki bir yansımayı $r$ ile eşlenik aldığınızda ($r^{-1} h r$) sonuç $H$'de kalıyor mu?`,
            ],
            solution: [
              isNorm
                ? `$[D_{${n}} : H] = 2$ olduğundan tüm $g \\in D_{${n}}$ için $g^{-1} H g = H$: **Evet, normaldir**.`
                : `Örneğin $r^{-1} H r \\neq H$ (farklı yönelimlerin farklı kararlı kılanları vardır): **Hayır, normal değildir**.`,
            ],
          },
          {
            prompt: `Başlangıç yönelimi $M = ${intSetTex(defect.subset)}$ kusurunu eşdeğer $M' = ${intSetTex(otherOrient)}$ yönelimine taşıyan tüm $g \\in D_{${n}}$ simetrilerini (ilgili sol koseti) yazın.`,
            kind: 'answer',
            answer: { type: 'dset', n, value: cosetToOther },
            hints: [
              `$g_0(M) = M'$ sağlayan tek bir $g_0 \\in D_{${n}}$ bulun; aranan küme tam olarak $g_0 H$ sol kosetidir ($|H| = ${stab.length}$ eleman).`,
            ],
            solution: [
              `$g(M) = ${intSetTex(otherOrient)}$ sağlayan tüm simetriler $g_0 H = ${dSetTex(cosetToOther)}$ sol kosetini oluşturur.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: stabilizer, coset, normality + normalizer/conjugate subgroup count + Orbit-Stabilizer proof
    const normSub = dNormalizer(n, stab);
    const numConjSubs = (2 * n) / normSub.length;
    return {
      title: `${n === 4 ? 'Kare ($D_4$)' : 'Altıgen ($D_6$)'} Kristal Kusuru: Kosetler, Eşlenik Kararlı Kılanlar ve Kanıt`,
      story: `Bir **${latticeName}** düğümünde $D_{${n}}$ ($|D_{${n}}| = ${2 * n}$) nokta simetrisi ${defect.desc} nedeniyle $H = \\operatorname{Stab}_{D_{${n}}}(M)$ alt grubuna indirgeniyor.`,
      model,
      parts: makeLabels([
        {
          prompt: `Kusurun kararlı kılan alt grubu $H = \\operatorname{Stab}_{D_{${n}}}(M)$ elemanlarını $D_{${n}}$ normal biçiminde yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'dset', n, value: stab },
          hints: [`$M = ${intSetTex(defect.subset)}$ kümesini koruyan $D_{${n}}$ elemanları $${stab.length}$ tanedir.`],
          solution: [`$H = ${dSetTex(stab)}$ ($|H| = ${stab.length}$, yörünge boyutu $[D_{${n}}:H] = ${orbitSize}$).`],
        },
        {
          prompt: `$M = ${intSetTex(defect.subset)}$ yönelimini $M' = ${intSetTex(otherOrient)}$ yönelimine taşıyan tüm $D_{${n}}$ elemanlarını ($gH$ sol kosetini) yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: cosetToOther },
          hints: [`$g_0(M) = M'$ sağlayan bir $g_0$ seçip $g_0 H$ sol kosetini oluşturun.`],
          solution: [`$g_0 H = ${dSetTex(cosetToOther)}$.`],
        },
        {
          prompt: `Eşdeğer kusur yönelimlerinin kararlı kılanları $g H g^{-1}$ biçimindedir. $H$'nin $D_{${n}}$ içinde kendisi dahil toplam kaç tane **farklı eşlenik alt grubu** vardır (not: normal ise $1$)?`,
          kind: 'answer',
          answer: { type: 'int', value: numConjSubs },
          hints: [
            `Farklı eşlenik alt grup sayısı normalleştirici indeksidir: $[D_{${n}} : N_{D_{${n}}}(H)]$. Normal alt gruplar için bu sayı $1$ olur.`,
          ],
          solution: [
            `Normalleştirici $N_{D_{${n}}}(H) = ${dSetTex(normSub)}$ ($|N| = ${normSub.length}$) olduğundan farklı eşlenik alt grup sayısı $\\frac{${2 * n}}{${normSub.length}} = ${numConjSubs}$ ($H$ ${isNorm ? '**normaldir**' : '**normal değildir**'}).`,
          ],
        },
        {
          prompt: '**Kanıt:** Bir sonlu $G$ grubunun bir $X$ kümesi üzerindeki eylemi için $x \\in X$ noktasının yörüngesi $\\mathcal{O}_x = \\{g \\cdot x : g \\in G\\}$ ile kararlı kılanı $H = \\operatorname{Stab}_G(x)$ arasındaki $gH \\mapsto g \\cdot x$ eşlemesinin iyi tanımlı bir bijeksiyon olduğunu (Yörünge-Kararlı Kılan Teoremi: $|\\mathcal{O}_x| = [G : H]$) kanıtlayın ve $H \\trianglelefteq G$ olmasının "tüm eşdeğer kusur yönelimlerinin aynı kararlı kılana sahip olması" ile denk olduğunu gösterin.',
          kind: 'proof',
          hints: [
            '$g_1 \\cdot x = g_2 \\cdot x \\iff g_2^{-1} g_1 \\in H \\iff g_1 H = g_2 H$ denkliğini kurun; ayrıca $\\operatorname{Stab}_G(g \\cdot x) = g H g^{-1}$ özdeşliğini kanıtlayın.',
          ],
          solution: [
            '**İyi tanımlılık ve birebirlik:** $g_1 H = g_2 H \\iff g_2^{-1} g_1 \\in H = \\operatorname{Stab}_G(x) \\iff (g_2^{-1} g_1) \\cdot x = x \\iff g_1 \\cdot x = g_2 \\cdot x$. Soldan sağa yön iyi tanımlılığı, sağdan sola yön birebirliği verir.',
            '**Örtenlik ve boyut:** Her $y = g \\cdot x \\in \\mathcal{O}_x$ elemanı $gH$ kosetinin görüntüsüdür (örten). Dolayısıyla $|\\mathcal{O}_x| = [G : H] = |G| / |H|$.',
            '**Normallik yorumu:** $k \\in \\operatorname{Stab}_G(g \\cdot x) \\iff k(g \\cdot x) = g \\cdot x \\iff (g^{-1} k g) \\cdot x = x \\iff g^{-1} k g \\in H \\iff k \\in g H g^{-1}$. Yani $\\operatorname{Stab}_G(g \\cdot x) = g H g^{-1}$. Dolayısıyla tüm eşdeğer yönelimler aynı kararlı kılana sahiptir $\\iff \\forall g \\in G,\\; g H g^{-1} = H \\iff H \\trianglelefteq G$.',
          ],
          checklist: [
            '$g_1 H = g_2 H \\iff g_1 \\cdot x = g_2 \\cdot x$ denkliğiyle hem iyi tanımlılık hem birebirlik gösterildi.',
            'Örtenlik kurularak $|\\mathcal{O}_x| = [G : \\operatorname{Stab}_G(x)]$ elde edildi.',
            '$\\operatorname{Stab}_G(g \\cdot x) = g H g^{-1}$ kanıtlanarak normalliğin tüm eşdeğer yönelimlerin aynı kararlı kılana sahip olmasına denkliği gösterildi.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 6. ozgun-can-calma — Change ringing: plain changes, order, sign & parity
// =====================================================================

const BELL_PAIRS = {
  4: [
    { a: [[1, 2], [3, 4]], b: [[2, 3]], desc: 'Düz Avlanma (Plain Hunt on 4)' },
    { a: [[1, 2]], b: [[2, 3]], desc: 'Üç Çan Geçişi (1-2-3)' },
    { a: [[2, 3]], b: [[3, 4]], desc: 'Alt Üçlü Geçiş (2-3-4)' },
    { a: [[1, 2], [3, 4]], b: [[1, 2]], desc: 'Çift-Tek Karışık Geçiş' },
  ],
  5: [
    { a: [[1, 2], [3, 4]], b: [[2, 3], [4, 5]], desc: 'Düz Avlanma (Plain Hunt on 5)' },
    { a: [[1, 2], [4, 5]], b: [[2, 3]], desc: 'Kenar Çifti ve Orta Geçiş' },
    { a: [[1, 2], [3, 4]], b: [[2, 3]], desc: 'Dörtlü Çift ve Orta Geçiş' },
    { a: [[2, 3], [4, 5]], b: [[1, 2], [4, 5]], desc: 'İki Çift Takaslı Yöntem' },
    { a: [[1, 2], [4, 5]], b: [[3, 4]], desc: 'Dış Çift ve Alt Orta Geçiş' },
  ],
  6: [
    { a: [[1, 2], [3, 4], [5, 6]], b: [[2, 3], [4, 5]], desc: 'Düz Avlanma (Plain Hunt on 6)' },
    { a: [[1, 2], [3, 4]], b: [[2, 3], [5, 6]], desc: 'İkili Kaydırma Yöntemi' },
    { a: [[1, 2], [5, 6]], b: [[2, 3], [4, 5]], desc: 'Kenar-Orta Çift Yöntemi' },
    { a: [[1, 2], [3, 4], [5, 6]], b: [[2, 3]], desc: 'Üçlü Takas ve Tek Orta Geçiş' },
  ],
};

function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

const T_CAN_CALMA = {
  id: 'ozgun-can-calma',
  topic: 'Permütasyon Grupları: Çan Çalma',
  title: 'Çan Çalma Sanatı (Change Ringing): $S_n$ ve $A_n$ Parite Kısıtı',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const n = rng.pick([4, 5]);
      const pair = rng.pick(BELL_PAIRS[n]);
      const aP = permFromCycles(n, pair.a);
      const bP = permFromCycles(n, pair.b);
      const prod = permMul(bP, aP); // a first, then b (right to left: b ∘ a)
      const ord = permOrder(prod);
      const sgn = permSign(prod);
      const sgnChoice = shuffleChoice(rng, SIGN_OPTS[sgn === 1 ? 0 : 1], [SIGN_OPTS[sgn === 1 ? 1 : 0]]);
      const rows = 2 * ord;

      return {
        title: `$${n}$ Çanlı Yöntem: ${pair.desc}`,
        story: `Geleneksel kule çan çalma (change ringing) sanatında $${n}$ çan $1, 2, \\dots, ${n}$ konumlarında başlar; her adımda (değişimde) yalnızca komşu çan çiftleri yer değiştirebilir. İki temel değişim $a = ${permTex(aP)}$ ve $b = ${permTex(bP)}$ sırayla uygulanarak (**önce $a$, sonra $b$**) bir yöntem kuruluyor. Konvansiyon: $i$ konumundaki çan $j$ konumuna geçiyorsa $i \\mapsto j$ ve "önce $a$, sonra $b$" bileşkesi sağdan sola $b \\circ a$ yazılır.`,
        model: { id: 'shuffle', params: { perm: prod } },
        parts: makeLabels([
          {
            prompt: `Önce $a = ${permTex(aP)}$, ardından $b = ${permTex(bP)}$ uygulandığında oluşan $p = b \\circ a$ bileşke permütasyonunu ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n, value: prod },
            hints: [
              'Sağdan sola okuyun: her $i$ konumunu önce $a$ ile, sonra çıkan sonucu $b$ ile eşleyin.',
              `İlk geçişler: $1 \\xrightarrow{a} ${aP[0]} \\xrightarrow{b} ${prod[0]}$, $2 \\xrightarrow{a} ${aP[1]} \\xrightarrow{b} ${prod[1]}$.`,
              `Ayrık döngü gösterimi: $${permTex(prod)}$.`,
            ],
            solution: [
              `Konum geçişleri: ${prod.map((to, i) => `$${i + 1} \\xrightarrow{a} ${aP[i]} \\xrightarrow{b} ${to}$`).join(', ')}.`,
              `Dolayısıyla **$p = b \\circ a = ${permTex(prod)}$**.`,
            ],
          },
          {
            prompt: `$p = b \\circ a$ bileşkesinin mertebesi $|p|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: ord },
            hints: [
              'Ayrık döngü uzunluklarının en küçük ortak katını (EKOK) alın.',
              `Döngü uzunlukları: $${cycleType(prod).join(', ') || '1'}$.`,
            ],
            solution: [
              `Döngü uzunlukları $${cycleType(prod).join(', ')}$ olduğundan $|p| = \\operatorname{ekok}(${cycleType(prod).join(', ')}) = ${ord}$.`,
            ],
          },
          {
            prompt: `$p = b \\circ a$ permütasyonunun işareti $\\operatorname{sgn}(p)$ nedir?`,
            kind: 'answer',
            answer: sgnChoice,
            hints: [
              '$\\operatorname{sgn}(b \\circ a) = \\operatorname{sgn}(b)\\operatorname{sgn}(a)$ (her transpozisyon $-1$ çarpanı verir).',
              `$a$ için $${pair.a.length}$, $b$ için $${pair.b.length}$ transpozisyon olduğundan toplam $${pair.a.length + pair.b.length}$ transpozisyon (${(pair.a.length + pair.b.length) % 2 === 0 ? 'çift' : 'tek'}).`,
            ],
            solution: [
              `$\\operatorname{sgn}(a) = ${permSign(aP) === 1 ? '+1' : '-1'}$, $\\operatorname{sgn}(b) = ${permSign(bP) === 1 ? '+1' : '-1'}$ olduğundan $\\operatorname{sgn}(b \\circ a) = ${sgn === 1 ? '+1' : '-1'}$.`,
            ],
          },
          {
            prompt: `$a, b, a, b, \\dots$ değişimleri dönüşümlü uygulanarak başlangıç sırasına ($e$) ilk kez dönülene kadar kaç tane farklı çan dizilimi çalınır?`,
            kind: 'answer',
            answer: { type: 'int', value: rows },
            hints: [
              'Her iki adımda bir $p = b \\circ a$ uygulanır ve $a^2 = b^2 = e$ ($a \\neq b$) olduğundan $\\langle a, b \\rangle \\cong D_{|p|}$ grubunun tüm $2|p|$ elemanı tek tek gezilir.',
              `$2 \\cdot |p| = 2 \\cdot ${ord} = ${rows}$.`,
            ],
            solution: [
              `Dönüşümlü dizi $e, a, ba, aba, (ba)^2, \\dots$ tam $2|ba| = 2 \\cdot ${ord} = ${rows}$ farklı dizilimden sonra $e$'ye geri döner.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const n = rng.pick([4, 5, 6]);
      const pair = rng.pick(BELL_PAIRS[n]);
      const aP = permFromCycles(n, pair.a);
      const bP = permFromCycles(n, pair.b);
      const prod = permMul(bP, aP);
      const ord = permOrder(prod);
      const subOrder = 2 * ord;
      const totalRows = fact(n);
      const idx = totalRows / subOrder;
      // Parity question: if a ringer ONLY uses changes consisting of an even number of swaps (e.g. 2 swaps), can all n! rows be rung?
      const bothEven = permSign(aP) === 1 && permSign(bP) === 1;

      return {
        title: `$${n}$ Çanlı Yöntemde Alt Grup İndeksi ve $A_{${n}}$ Parite Engeli`,
        story: `$${n}$ çanlı bir kulede $a = ${permTex(aP)}$ ve $b = ${permTex(bP)}$ değişimleri dönüşümlü çalınıyor (**${pair.desc}**). Çan çalıcılar tüm $${n}! = ${totalRows}$ farklı dizilimi (tam *extent*) tekrar etmeden çalıp başa dönmek istiyor.`,
        model: { id: 'shuffle', params: { perm: prod } },
        parts: makeLabels([
          {
            prompt: `$p = b \\circ a$ (önce $a$, sonra $b$) bileşkesini ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n, value: prod },
            hints: [
              `Sağdan sola: $i \\mapsto b(a(i))$. Örneğin $1 \\mapsto ${prod[0]}$, $2 \\mapsto ${prod[1]}$.`,
            ],
            solution: [
              `$p = b \\circ a = ${permTex(prod)}$ (mertebe $|p| = ${ord}$, işaret $\\operatorname{sgn}(p) = ${permSign(prod) === 1 ? '+1' : '-1'}$).`,
            ],
          },
          {
            prompt: `$a$ ve $b$ değişimlerinin ürettiği $H = \\langle a, b \\rangle \\le S_{${n}}$ alt grubunun mertebesi ($a, b, a, b, \\dots$ döngüsündeki dizilim sayısı) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: subOrder },
            hints: [
              '$a^2 = b^2 = e$ ($a \\neq b$) olduğundan $\\langle a, b \\rangle \\cong D_{|ba|}$ ve mertebesi $2|ba|$ olur.',
            ],
            solution: [
              `$|ba| = ${ord}$ olduğundan $|\\langle a, b \\rangle| = 2 \\cdot ${ord} = ${subOrder}$.`,
            ],
          },
          {
            prompt: `Lagrange teoremine göre $H = \\langle a, b \\rangle$ alt grubunun $S_{${n}}$ içindeki indeksi $[S_{${n}} : H]$ (tüm $${totalRows}$ dizilimin kaç adet ayrık $H$-kosetine bölündüğü) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: idx },
            hints: [
              `$[S_{${n}} : H] = ${n}! / |H| = ${totalRows} / ${subOrder}$.`,
            ],
            solution: [
              `$[S_{${n}} : H] = \\frac{${totalRows}}{${subOrder}} = ${idx}$.`,
            ],
          },
          {
            prompt: bothEven
              ? `Bu yöntemdeki $a$ ve $b$ değişimlerinin ikisi de çift permütasyondur. Yalnızca çift permütasyon olan (çift sayıda takas içeren) değişimler kullanılarak $${n}$ çanın **tüm $${totalRows}$ dizilimi** çalınabilir mi?`
              : `Bir besteci kuralı değiştirip her adımda yalnızca **tam olarak $2$ ayrık komşu çiftin** yer değiştirmesine (çift permütasyonlara) izin verirse, $${n}$ çanın **tüm $${totalRows}$ dizilimi** çalınabilir mi?`,
            kind: 'answer',
            answer: { type: 'yesno', value: false },
            hints: [
              `Çift permütasyonların çarpımı daima çift kalır ($A_{${n}} = \\ker\\operatorname{sgn}$ bir alt gruptur ve $|A_{${n}}| = ${totalRows / 2}$).`,
            ],
            solution: [
              `Yalnızca çift permütasyonlar kullanıldığında tüm ulaşılabilir dizilimler $A_{${n}}$ alt grubunda ($${totalRows / 2}$ dizilim) hapsolur; tek permütasyonlara asla geçilemez: **Hayır**.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: 3-change sequence on n=5 or n=6, sign, max even-only rows n!/2, proof
    const n = rng.pick([5, 6]);
    const threePool = n === 5
      ? [
        { a: [[1, 2], [3, 4]], b: [[2, 3], [4, 5]], c: [[1, 2], [4, 5]] },
        { a: [[1, 2], [3, 4]], b: [[2, 3]], c: [[3, 4]] },
        { a: [[1, 2], [4, 5]], b: [[2, 3], [4, 5]], c: [[1, 2]] },
      ]
      : [
        { a: [[1, 2], [3, 4], [5, 6]], b: [[2, 3], [4, 5]], c: [[1, 2], [5, 6]] },
        { a: [[1, 2], [3, 4]], b: [[2, 3], [5, 6]], c: [[3, 4], [5, 6]] },
        { a: [[1, 2], [3, 4], [5, 6]], b: [[2, 3]], c: [[4, 5]] },
      ];
    const ch = rng.pick(threePool);
    const aP = permFromCycles(n, ch.a);
    const bP = permFromCycles(n, ch.b);
    const cP = permFromCycles(n, ch.c);
    const prod = permMul(cP, permMul(bP, aP)); // a first, then b, then c: c ∘ b ∘ a
    const ord = permOrder(prod);
    const sgn = permSign(prod);
    const sgnChoice = shuffleChoice(rng, SIGN_OPTS[sgn === 1 ? 0 : 1], [SIGN_OPTS[sgn === 1 ? 1 : 0]]);
    const halfFact = fact(n) / 2;

    return {
      title: `$${n}$ Çanda Üçlü Değişim Zinciri, $A_{${n}}$ Parite Engeli ve Dihedral Kanıt`,
      story: `$${n}$ çanlı bir kompozisyonda üç temel değişim sırasıyla (**önce $a$, sonra $b$, en son $c$**) uygulanıyor: $a = ${permTex(aP)}$, $b = ${permTex(bP)}$ ve $c = ${permTex(cP)}$. Bileşke sağdan sola $q = c \\circ b \\circ a$ biçiminde hesaplanır.`,
      model: { id: 'shuffle', params: { perm: prod } },
      parts: makeLabels([
        {
          prompt: `Üçlü bileşke $q = c \\circ b \\circ a$ permütasyonunu ayrık döngü gösteriminde yazın.`,
          kind: 'answer',
          answer: { type: 'perm', n, value: prod },
          hints: [
            `Her $i \\in \\{1, \\dots, ${n}\\}$ için sırayla $i \\xrightarrow{a} a(i) \\xrightarrow{b} b(a(i)) \\xrightarrow{c} c(b(a(i)))$ izleyin.`,
          ],
          solution: [
            `Geçişler: ${prod.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')} $\\implies q = ${permTex(prod)}$.`,
          ],
        },
        {
          prompt: `$q = c \\circ b \\circ a$ permütasyonunun mertebesi $|q|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: ord },
          hints: [`Döngü uzunluklarının ($${cycleType(prod).join(', ') || '1'}$) EKOK'unu alın.`],
          solution: [`$|q| = \\operatorname{ekok}(${cycleType(prod).join(', ') || '1'}) = ${ord}$.`],
        },
        {
          prompt: `$q = c \\circ b \\circ a$ permütasyonunun işareti $\\operatorname{sgn}(q)$ nedir?`,
          kind: 'answer',
          answer: sgnChoice,
          hints: [`Toplam transpozisyon sayısı $${ch.a.length} + ${ch.b.length} + ${ch.c.length} = ${ch.a.length + ch.b.length + ch.c.length}$.`],
          solution: [`$\\operatorname{sgn}(q) = (-1)^{${ch.a.length + ch.b.length + ch.c.length}} = ${sgn === 1 ? '+1' : '-1'}$.`],
        },
        {
          prompt: `Eğer kuledeki her adımda yalnızca **çift** permütasyonlar (örneğin tam $2$ ayrık komşu takas) kullanılırsa, $${n}$ çanın tüm $${fact(n)}$ diziliminden en fazla kaç tanesi çalınabilir?`,
          kind: 'answer',
          answer: { type: 'int', value: halfFact },
          hints: [`$A_{${n}}$ alternatif grubunun mertebesi $|A_{${n}}| = ${n}! / 2$.`],
          solution: [`$|A_{${n}}| = ${fact(n)} / 2 = ${halfFact}$ dizilim.`],
        },
        {
          prompt: '**Kanıt:** (i) İşaret homomorfizması $\\operatorname{sgn}: S_n \\to \\{\\pm 1\\}$ yardımıyla, her değişimin çift sayıda takastan oluştuğu bir çan yönteminin hiçbir zaman tüm $n!$ dizilimi çalamayacağını ($n \\ge 2$); (ii) farklı iki involüsyon $a, b \\in S_n$ ($a^2 = b^2 = e$, $a, b \\neq e$, $a \\neq b$) için dönüşümlü $a, b, a, b, \\dots$ yönteminin $e$' + "'ye ilk kez tam $2|ba|$ adımda döndüğünü kanıtlayın.",
          kind: 'proof',
          hints: [
            '(i) için $\\operatorname{sgn}(g_k \\cdots g_1) = \\prod \\operatorname{sgn}(g_i) = +1$ olduğundan tüm ürünlerin $A_n = \\ker\\operatorname{sgn}$ içinde kaldığını gösterin; (ii) için $a(ba)^t = (ba)^s$ varsayımından çelişki çıkarın.',
          ],
          solution: [
            '**(i) Parite engeli:** Başlangıç durumu $e \\in A_n$ ($\\operatorname{sgn}(e) = +1$). Her izinli değişim $g_i$ çift sayıda transpozisyon içerdiğinden $\\operatorname{sgn}(g_i) = +1$. $\\operatorname{sgn}: S_n \\to \\{\\pm 1\\}$ homomorfizma olduğundan her adım sonunda ulaşılan $g_k \\cdots g_1$ permütasyonu $\\operatorname{sgn} = +1$ sağlar, yani $A_n = \\ker\\operatorname{sgn}$ içinde kalır. $|A_n| = n!/2 < n!$ olduğundan en az $n!/2$ tek dizilim asla çalınamaz.',
            '**(ii) Dönüşümlü involüsyon dizisi:** $m = |ba|$ olsun. Çift adımlarda $(ba)^0, (ba)^1, \\dots, (ba)^{m-1}$ olmak üzere $m$ farklı eleman, tek adımlarda $a(ba)^0, \\dots, a(ba)^{m-1}$ olmak üzere $m$ farklı eleman oluşur. Eğer bir çift ve tek adım çakışırsa $a(ba)^t = (ba)^s \\implies a = (ba)^{s-t}$. Bu durumda $a$ ile $ba$ değişmelidir; oysa $a(ba)a = ab = (ba)^{-1}$ olduğundan $(ba)^2 = e$, yani $m = 2$ ve $s - t \\in \\{0, 1\\}$ çıkar. $s-t=0 \\implies a=e$, $s-t=1 \\implies a=ba \\implies b=e$, her ikisi de varsayımla çelişir. Dolayısıyla ilk $2m = 2|ba|$ dizilim tamamen farklıdır ve $2m$. adımda $(ba)^m = e$ elde edilir.',
          ],
          checklist: [
            '$\\operatorname{sgn}: S_n \\to \\{\\pm 1\\}$ homomorfizmasıyla çift değişimlerin $A_n$ ($|A_n| = n!/2$) dışına çıkamayacağı kanıtlandı.',
            'Çift adımlar $(ba)^s$ ve tek adımlar $a(ba)^t$ olarak ayrıldı.',
            '$a(ba)^t = (ba)^s$ varsayımının $a = e$ veya $b = e$ çelişkisine yol açtığı gösterilerek $2|ba|$ farklı dizilim kanıtlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 7. ozgun-bulmaca-permutasyon — Small twisty puzzles: order, commutators & parity
// =====================================================================

const TWISTY_PUZZLES = [
  {
    id: 'double-tri',
    n: 5,
    name: '5-Boncuklu Çift Üçgen Çark',
    story: `Birbirine $3$. boncukta kenetlenen iki üçgen dişli çarkta $1, 2, 3, 4, 5$ numaralı beş boncuk bulunuyor. Sol çarkın tek tık dönüşü $L = (123)$ ve sağ çarkın tek tık dönüşü $R = (345)$ konum permütasyonlarını uygular.`,
    A: permFromCycles(5, [[1, 2, 3]]),
    B: permFromCycles(5, [[3, 4, 5]]),
    aName: 'L', bName: 'R',
    allEven: true,
    swapPair: [1, 2],
  },
  {
    id: 'double-pent',
    n: 7,
    name: '7-Boncuklu Kesişen Beşli Halkalar',
    story: `Üç boncuğu ($3, 4, 5$) ortak kullanan iki beşli döner halkada $1, \\dots, 7$ numaralı yedi boncuk bulunuyor. Sol halka bir adım döndüğünde $L = (12345)$, sağ halka bir adım döndüğünde $R = (34567)$ permütasyonu gerçekleşir.`,
    A: permFromCycles(7, [[1, 2, 3, 4, 5]]),
    B: permFromCycles(7, [[3, 4, 5, 6, 7]]),
    aName: 'L', bName: 'R',
    allEven: true,
    swapPair: [1, 7],
  },
  {
    id: 'corner-edge-cube',
    n: 8,
    name: '8-Parçalı Köşe-Kenar Mini Küpü',
    story: `Dört köşe ($1, 2, 3, 4$) ve dört kenar ($5, 6, 7, 8$) parçasına sahip bir mini çevirmeli küpte iki temel hamle vardır: üst katman çeyrek dönüşü $U = (1234)(5678)$ (dört köşeyi ve dört kenarı birlikte döndürür) ve kenar-köşe takas hamlesi $F = (12)(56)$ (iki köşeyi iki kenarla birlikte takas eder).`,
    A: permFromCycles(8, [[1, 2, 3, 4], [5, 6, 7, 8]]),
    B: permFromCycles(8, [[1, 2], [5, 6]]),
    aName: 'U', bName: 'F',
    allEven: true,
    swapPair: [1, 2],
  },
  {
    id: 'double-quad',
    n: 6,
    name: '6-Boncuklu Kesişen Dörtlü Çarklar',
    story: `$3$ ve $4$ numaralı iki boncuğu paylaşan iki dörtlü dişli çarkta $1, \\dots, 6$ numaralı altı boncuk bulunuyor. Sol çarkın bir tık dönüşü $L = (1234)$, sağ çarkın bir tık dönüşü $R = (3456)$ permütasyonunu uygular.`,
    A: permFromCycles(6, [[1, 2, 3, 4]]),
    B: permFromCycles(6, [[3, 4, 5, 6]]),
    aName: 'L', bName: 'R',
    allEven: false,
    swapPair: [1, 2],
  },
];

const T_BULMACA_PERMUTASYON = {
  id: 'ozgun-bulmaca-permutasyon',
  topic: 'Permütasyonlar ve Parite: Bulmacalar',
  title: 'Çevirmeli Bulmacalar: Hamle Mertebesi, Komütatör ve Parite Kısıtı',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const puz = rng.pick(TWISTY_PUZZLES);
      const revOrder = rng.int(0, 1) === 1;
      const macro = revOrder ? permMul(puz.A, puz.B) : permMul(puz.B, puz.A);
      const macroTex = revOrder ? `${puz.aName} \\circ ${puz.bName}` : `${puz.bName} \\circ ${puz.aName}`;
      const orderNote = revOrder ? `önce $${puz.bName}$, sonra $${puz.aName}$` : `önce $${puz.aName}$, sonra $${puz.bName}$`;
      const ord = permOrder(macro);
      const sgn = permSign(macro);
      const sgnChoice = shuffleChoice(rng, SIGN_OPTS[sgn === 1 ? 0 : 1], [SIGN_OPTS[sgn === 1 ? 1 : 0]]);

      return {
        title: `${puz.name}: $${macroTex}$ Hamle Dizisi`,
        story: `${puz.story} Konvansiyon gereği bileşke sağdan sola okunur: $${macroTex}$ hamlesi ${orderNote} uygulanması demektir.`,
        model: { id: 'shuffle', params: { perm: macro } },
        parts: makeLabels([
          {
            prompt: `$M = ${macroTex}$ bileşke hamlesini ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: puz.n, value: macro },
            hints: [
              `Her $i \\in \\{1, \\dots, ${puz.n}\\}$ için ${orderNote} uygulayın.`,
              `İlk iki parça: $1 \\mapsto ${macro[0]}$, $2 \\mapsto ${macro[1]}$.`,
              `Ayrık döngü gösterimi: $${permTex(macro)}$.`,
            ],
            solution: [
              `Konum geçişleri: ${macro.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')} $\\implies M = ${permTex(macro)}$.`,
            ],
          },
          {
            prompt: `Çözülü durumdaki bulmacaya $M = ${macroTex}$ hamlesi arka arkaya kaç kez uygulanırsa bulmaca ilk kez yeniden çözülü hâle gelir (hamlenin mertebesi)?`,
            kind: 'answer',
            answer: { type: 'int', value: ord },
            hints: [
              'Hamlenin mertebesi, ayrık döngülerinin uzunluklarının EKOK değeridir.',
              `Döngü uzunlukları: $${cycleType(macro).join(', ') || '1'}$.`,
            ],
            solution: [
              `$|M| = \\operatorname{ekok}(${cycleType(macro).join(', ') || '1'}) = ${ord}$ tekrar.`,
            ],
          },
          {
            prompt: `$M = ${macroTex}$ permütasyonunun işareti $\\operatorname{sgn}(M)$ nedir?`,
            kind: 'answer',
            answer: sgnChoice,
            hints: [
              `Her $L$-döngünün işareti $(-1)^{L-1}$ olup tüm ayrık döngülerin işaretleri çarpılır.`,
            ],
            solution: [
              `$\\operatorname{sgn}(M) = ${sgn === 1 ? '+1' : '-1'}$ (${sgn === 1 ? 'çift' : 'tek'} permütasyon).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const puz = rng.pick(TWISTY_PUZZLES);
      const A = puz.A, B = puz.B, Ainv = permInv(A), Binv = permInv(B);
      // Choose a 3-move or 4-move macro with guaranteed non-trivial result
      const macroSpecs = [
        { name: `${puz.bName} ${puz.aName} ${puz.bName}^{-1}`, perm: permMul(B, permMul(A, Binv)), note: `önce $${puz.bName}^{-1}$, sonra $${puz.aName}$, en son $${puz.bName}$` },
        { name: `${puz.aName} ${puz.bName} ${puz.aName}^{-1} ${puz.bName}^{-1}`, perm: permMul(permMul(A, B), permMul(Ainv, Binv)), note: `komütatör $[${puz.aName}, ${puz.bName}]$ (sağdan sola)` },
        { name: `${puz.bName} ${puz.aName}^2`, perm: permMul(B, permMul(A, A)), note: `önce iki kez $${puz.aName}$, sonra $${puz.bName}$` },
      ];
      const spec = rng.pick(macroSpecs);
      const ord = permOrder(spec.perm);
      const sgn = permSign(spec.perm);
      const sgnChoice = shuffleChoice(rng, SIGN_OPTS[sgn === 1 ? 0 : 1], [SIGN_OPTS[sgn === 1 ? 1 : 0]]);

      return {
        title: `${puz.name}: $${spec.name}$ ve Tek Takas İmkânsızlığı`,
        story: `${puz.story} Bulmacada yeni bir hamle dizisi $M = ${spec.name}$ (${spec.note}) tanımlanıyor.`,
        model: { id: 'shuffle', params: { perm: spec.perm } },
        parts: makeLabels([
          {
            prompt: `$M = ${spec.name}$ permütasyonunu ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: puz.n, value: spec.perm },
            hints: [
              `Temel tersler: $${puz.aName}^{-1} = ${permTex(Ainv)}$, $${puz.bName}^{-1} = ${permTex(Binv)}$.`,
              `Sağdan sola adım adım izleyin: $1 \\mapsto ${spec.perm[0]},\\; 2 \\mapsto ${spec.perm[1]},\\; 3 \\mapsto ${spec.perm[2]}$.`,
            ],
            solution: [
              `Adım adım uygulandığında $M = ${permTex(spec.perm)}$ bulunur.`,
            ],
          },
          {
            prompt: `$M$ hamlesi arka arkaya kaç kez uygulanırsa bulmaca yeniden çözülür?`,
            kind: 'answer',
            answer: { type: 'int', value: ord },
            hints: [`Döngü uzunlukları $${cycleType(spec.perm).join(', ') || '1'}$ olup EKOK değeri mertebeyi verir.`],
            solution: [`$|M| = \\operatorname{ekok}(${cycleType(spec.perm).join(', ') || '1'}) = ${ord}$.`],
          },
          {
            prompt: `$M$ permütasyonunun işareti $\\operatorname{sgn}(M)$ nedir?`,
            kind: 'answer',
            answer: sgnChoice,
            hints: [`$\\operatorname{sgn}(${puz.aName}) = ${permSign(A) === 1 ? '+1' : '-1'}$ ve $\\operatorname{sgn}(${puz.bName}) = ${permSign(B) === 1 ? '+1' : '-1'}$.`],
            solution: [`$\\operatorname{sgn}(M) = ${sgn === 1 ? '+1' : '-1'}$.`],
          },
          {
            prompt: `Bir arkadaşınız bulmacayı söküp yalnızca **$${puz.swapPair[0]}$ ve $${puz.swapPair[1]}$. parçaları** yer değiştirerek $(${puz.swapPair[0]}${puz.swapPair[1]})$ tek transpozisyonunu oluşturuyor (diğer tüm parçalar yerinde). Bu durum yalnızca $${puz.aName}$ ve $${puz.bName}$ hamleleriyle (ve tersleriyle) çözülebilir mi?`,
            kind: 'answer',
            answer: { type: 'yesno', value: !puz.allEven },
            hints: [
              `Temel hamlelerin işaretlerine bakın: $\\operatorname{sgn}(${puz.aName}) = ${permSign(A) === 1 ? '+1' : '-1'}$, $\\operatorname{sgn}(${puz.bName}) = ${permSign(B) === 1 ? '+1' : '-1'}$.`,
              puz.allEven
                ? `Her iki temel hamle de çift olduğundan her bileşke $A_{${puz.n}}$ içindedir; oysa tek bir takasın işareti $-1$'dir!`
                : `Temel hamlelerin işareti $-1$ (tek) olup $L$ ve $R$ tüm $S_6$ grubunu üretir!`,
            ],
            solution: [
              puz.allEven
                ? `$\\operatorname{sgn}(${puz.aName}) = \\operatorname{sgn}(${puz.bName}) = +1$ olduğundan her yasal hamle dizisi çift permütasyondur ($\\in A_{${puz.n}}$). Oysa $(${puz.swapPair[0]}${puz.swapPair[1]})$ tek permütasyon ($\\operatorname{sgn} = -1$) olduğundan **Hayır, çözülemez**!`
                : `$\\operatorname{sgn}(L) = \\operatorname{sgn}(R) = -1$ olduğundan tek permütasyonlara ulaşılabilir ve $\\langle L, R \\rangle = S_6$ olduğu için $(12)$ tek takası **Evet, çözülebilir**!`,
            ],
          },
        ]),
      };
    }

    // zorlayici: even-generator puzzles (5-bead, 7-bead, or 8-piece corner-edge cube) + commutator + reachability + proof
    const evenPuzzles = TWISTY_PUZZLES.filter(p => p.allEven);
    const puz = rng.pick(evenPuzzles);
    const A = puz.A, B = puz.B, Ainv = permInv(A), Binv = permInv(B);
    const comm = permMul(permMul(A, B), permMul(Ainv, Binv));
    const kExp = rng.pick([2, 3]);
    const powA = Array.from({ length: kExp }).reduce(acc => permMul(A, acc), permId(puz.n));
    const combo = permMul(powA, B);
    const comboOrd = permOrder(combo);

    // Build a test permutation: 50% single swap (impossible, odd), 50% double swap (possible or check if in <A,B>!)
    // For double-tri (<A,B> = A_5), double-pent (<A,B> = A_7), every even perm is reachable;
    // For corner-edge-cube, <U, F> preserves {1..4} and {5..8} separately with equal sign on both!
    // So for reachable test on corner-edge-cube, pick (12)(56) or (13)(57) or comm; for impossible pick (12) (single swap)!
    const wantImpossible = rng.int(0, 1) === 1;
    let testPerm, testDesc, testReachable;
    if (wantImpossible) {
      testPerm = permFromCycles(puz.n, [puz.swapPair]);
      testDesc = `yalnızca $${puz.swapPair[0]}$ ve $${puz.swapPair[1]}$. parçaların yer değiştirdiği $(${puz.swapPair[0]}${puz.swapPair[1]})$ durumu`;
      testReachable = false;
    } else if (puz.id === 'corner-edge-cube') {
      // (12)(34) on corners is even, identity on edges is even => both halves have sgn = +1; check if U^2 = (13)(24)(57)(68) is in <U,F>!
      testPerm = permMul(A, A);
      testDesc = `$${permTex(testPerm)}$ durumu (iki köşe çifti ve iki kenar çifti takaslı)`;
      testReachable = true;
    } else {
      testPerm = comm;
      testDesc = `komütatörün ürettiği $${permTex(comm)}$ üç-döngü durumu`;
      testReachable = true;
    }

    return {
      title: `${puz.name}: Komütatör, Mertebe ve $A_{${puz.n}}$ Parite Kanıtı`,
      story: `${puz.story} Çevirmeli bulmaca çözümlerinde yalnızca birkaç parçayı hareket ettiren **komütatör** $[${puz.aName}, ${puz.bName}] = ${puz.aName} ${puz.bName} ${puz.aName}^{-1} ${puz.bName}^{-1}$ hamleleri ve işaret değişmezi kilit rol oynar.`,
      model: { id: 'shuffle', params: { perm: comm } },
      parts: makeLabels([
        {
          prompt: `Komütatör hamlesi $C = ${puz.aName} ${puz.bName} ${puz.aName}^{-1} ${puz.bName}^{-1}$ permütasyonunu (sağdan sola) ayrık döngü gösteriminde yazın.`,
          kind: 'answer',
          answer: { type: 'perm', n: puz.n, value: comm },
          hints: [
            `Önce $${puz.bName}^{-1} = ${permTex(Binv)}$ ve $${puz.aName}^{-1} = ${permTex(Ainv)}$ uygulayın, ardından $${puz.bName}$ ve $${puz.aName}$ uygulayın.`,
          ],
          solution: [
            `$C = ${puz.aName} ${puz.bName} ${puz.aName}^{-1} ${puz.bName}^{-1} = ${permTex(comm)}$ (mertebe $|C| = ${permOrder(comm)}$).`,
          ],
        },
        {
          prompt: `$M = ${puz.aName}^{${kExp}} ${puz.bName}$ (önce $${puz.bName}$, sonra $${kExp}$ kez $${puz.aName}$) bileşkesi arka arkaya kaç kez uygulanırsa bulmaca başlangıç durumuna geri döner?`,
          kind: 'answer',
          answer: { type: 'int', value: comboOrd },
          hints: [
            `$${puz.aName}^{${kExp}} = ${permTex(powA)}$ hesaplayıp $M = ${puz.aName}^{${kExp}} ${puz.bName}$ permütasyonunun ayrık döngü uzunluklarının EKOK değerini alın.`,
          ],
          solution: [
            `$M = ${permTex(combo)}$ (döngü uzunlukları $${cycleType(combo).join(', ') || '1'}$) olduğundan mertebe $|M| = ${comboOrd}$.`,
          ],
        },
        {
          prompt: `Bulmacada ${testDesc} yasal hamlelerle ulaşılabilir midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: testReachable },
          hints: [
            `Her temel hamlenin işareti $+1$ olduğundan tüm ulaşılabilir durumlar $A_{${puz.n}}$ içindedir; verilen durumun işaretini kontrol edin.`,
          ],
          solution: [
            testReachable
              ? `Bu durum yasal hamlelerle doğrudan elde edilebilir ($\\operatorname{sgn} = +1$): **Evet**.`
              : `$\\operatorname{sgn}(${permTex(testPerm)}) = -1$ (tek), oysa her yasal hamle çift ($\\operatorname{sgn} = +1$) olduğundan **Hayır, ulaşılamaz**.`,
          ],
        },
        {
          prompt: '**Kanıt:** (i) Tüm temel hamleleri çift permütasyon ($\\operatorname{sgn} = +1$) olan bir çevirmeli bulmacada yalnızca iki parçanın yer değiştirdiği tek bir transpozisyonun $(ij)$ asla çözülemeyeceğini; (ii) sonlu $N$ parçalı herhangi bir bulmacada herhangi bir sabit $M$ hamle dizisinin sonlu sayıda tekrarla bulmacayı mutlaka çözeceğini ve en küçük tekrar sayısının $M$' + "'nin ayrık döngü uzunluklarının EKOK'u olduğunu kanıtlayın.",
          kind: 'proof',
          hints: [
            '(i) için $\\operatorname{sgn}: S_N \\to \\{\\pm 1\\}$ homomorfizmasını ve $\\operatorname{sgn}((ij)) = -1$ olgusunu kullanın; (ii) için ayrık döngülerin birbiriyle değişmeli olmasından $(c_1 \\cdots c_r)^k = c_1^k \\cdots c_r^k = e$ koşulunu çıkarın.',
          ],
          solution: [
            '**(i) Tek takas imkânsızlığı:** Temel hamleler $g_1, \\dots, g_s \\in A_N = \\ker\\operatorname{sgn}$ olsun. $A_N$ bir alt grup (kapalı ve tersleri içeren) olduğundan $g_i$ ve $g_i^{-1}$ elemanlarının her sonlu çarpımı $w$ yine $A_N$ içindedir ($\\operatorname{sgn}(w) = +1$). Oysa tek bir iki-parça takası $(ij)$ için $\\operatorname{sgn}((ij)) = -1 \\neq +1$, dolayısıyla $(ij) \\notin \\langle g_1, \\dots, g_s \\rangle$.',
            '**(ii) Tekrarlama ve EKOK:** $M = c_1 c_2 \\cdots c_r$ ayrık döngü ayrışımı (uzunluklar $L_1, \\dots, L_r$) olsun. Ayrık döngüler farklı parçalar üzerinde etki ettiğinden birbiriyle değişmelidir: $M^k = c_1^k c_2^k \\cdots c_r^k$. Yine ayrık olduklarından $M^k = e \\iff \\forall t,\\; c_t^k = e \\iff \\forall t,\\; L_t \\mid k$. En küçük pozitif ortak kat $k = \\operatorname{ekok}(L_1, \\dots, L_r) < \\infty$ olduğundan bulmaca tam $\\operatorname{ekok}(L_1, \\dots, L_r)$ tekrarda ilk kez çözülür.',
          ],
          checklist: [
            'Temel hamlelerin $A_N = \\ker\\operatorname{sgn}$ içinde kaldığı ve $\\operatorname{sgn}((ij)) = -1$ olduğundan tek takasın imkânsız olduğu kanıtlandı.',
            'Ayrık döngülerin değişmeli olduğu kullanılarak $M^k = c_1^k \\cdots c_r^k$ yazıldı.',
            '$M^k = e \\iff \\forall t,\\; L_t \\mid k$ denkliğinden en küçük tekrar sayısının $\\operatorname{ekok}(L_1, \\dots, L_r)$ olduğu kanıtlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 8. ozgun-pervane-stroboskop — Stroboscope & fan blades: RPM, multiple frozen speeds, tachometer
// =====================================================================

const FAN_DIR_OPTS = [
  'İleri (gerçek dönme yönünde)',
  'Geri (ters yönde dönüyormuş gibi)',
  'Durgun (donmuş gibi sabit)',
];

const T_PERVANE_STROBOSKOP = {
  id: 'ozgun-pervane-stroboskop',
  topic: 'Bölüm Grupları: Stroboskop ve RPM',
  title: 'Stroboskop Altında Pervane: Donma Hızları (RPM) ve Takometre',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    // Choose (b, f) so R1 = 60*f/b is an exact clean integer divisible by 20 or 10
    const combos = [
      [3, 15], [3, 20], [3, 25], [3, 30],
      [4, 16], [4, 20], [4, 24], [4, 30], [4, 40],
      [5, 20], [5, 25], [5, 30], [5, 40], [5, 50],
      [6, 18], [6, 24], [6, 30], [6, 36], [6, 48],
      [8, 20], [8, 24], [8, 32], [8, 40],
    ];
    const [b, f] = rng.pick(combos);
    const R1 = (60 * f) / b; // exact integer RPM for first frozen speed!
    const radius = 0.5;
    const toWheelV = rpm => roundNum(2 * Math.PI * (rpm / 60) * radius, 8);

    if (level === 'isinma') {
      // Pick an integer fan speed R cleanly inside one of the regimes (avoid exact R1/2 tie)
      const fracPick = rng.pick([
        { num: 1, den: 4 }, // forward true
        { num: 3, den: 4 }, // backward!
        { num: 1, den: 1 }, // frozen!
        { num: 5, den: 4 }, // forward aliased!
        { num: 7, den: 4 }, // backward band 2!
      ]);
      // Ensure R is integer
      const stepUnit = Math.max(10, Math.round(R1 / 10) * 2); // clean offset
      let rpmTest;
      if (fracPick.num === 1 && fracPick.den === 1) rpmTest = R1;
      else if (fracPick.num === 1) rpmTest = Math.round(R1 * 0.25);
      else if (fracPick.num === 3) rpmTest = Math.round(R1 * 0.75);
      else if (fracPick.num === 5) rpmTest = Math.round(R1 * 1.25);
      else rpmTest = Math.round(R1 * 1.75);
      // Adjust if R1 * 0.25 not integer (ensure exact integer apparent RPM)
      if ((R1 * 3) % 4 !== 0) {
        const offsets = [stepUnit, -stepUnit, 0, Math.round(R1 * 0.2), -Math.round(R1 * 0.2)];
        const off = rng.pick(offsets);
        rpmTest = off === 0 ? R1 : (off > 0 ? R1 + off : R1 + off);
      }
      const appRpm = Math.round(wrapHalfOpen(rpmTest, R1));
      const dirIdx = appRpm === 0 ? 2 : (appRpm > 0 ? 0 : 1);
      const dirChoice = shuffleChoice(rng, FAN_DIR_OPTS[dirIdx], FAN_DIR_OPTS.filter((_, i) => i !== dirIdx));

      return {
        title: `$${b}$ Kanatlı Pervane ve $${f}\\text{ Hz}$ Stroboskop Lambası`,
        story: `Bir aerodinamik laboratuvarında **$b = ${b}$ özdeş kanatlı** bir soğutma pervanesi, saniyede **$f = ${f}\\text{ Hz}$** frekansla çakan bir stroboskop lambasıyla aydınlatılıyor. Pervane her $\\frac{1}{${b}}$ tur ($\\frac{2\\pi}{${b}}$ rad) döndüğünde kendi üzerine bindiğinden görsel açı $\\mathbb{R} / \\frac{2\\pi}{${b}}\\mathbb{Z}$ bölüm grubunda algılanır. Dönme hızlarını **RPM (devir/dakika)** cinsinden inceleyelim.`,
        model: { id: 'wheel', params: { spokes: b, fps: f, radius, v: toWheelV(rpmTest) } },
        parts: makeLabels([
          {
            prompt: `Pervanenin stroboskop ışığında tamamen **donmuş** görünmesini sağlayan en küçük pozitif dönme hızı $R_1$ kaç **RPM**'dir?`,
            kind: 'answer',
            answer: { type: 'int', value: R1 },
            hints: [
              'İki çakma arasında ($\\Delta t = 1/f$ sn) pervane tam $1/b$ tur atmalıdır.',
              'Saniyede $f/b$ devir $= 60f/b$ devir/dakika (RPM).',
              `$R_1 = \\frac{60 \\cdot ${f}}{${b}} = ${R1}\\text{ RPM}$.`,
            ],
            solution: [
              `$\\Delta t = \\frac{1}{${f}}\\text{ sn}$ sürede $\\frac{1}{${b}}$ tur için $R_1 = \\frac{60 \\cdot ${f}}{${b}} = ${R1}\\text{ RPM}$.`,
            ],
          },
          {
            prompt: `Pervanenin donmuş göründüğü **ilk üç pozitif** dönme hızını ($R_1, R_2, R_3$) küçükten büyüğe RPM cinsinden yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'intlist', value: [R1, 2 * R1, 3 * R1] },
            hints: [
              'İki çakma arasında pervane $m = 1, 2, 3, \\dots$ kanat aralığı kadar döndüğünde yine donmuş görünür.',
              `$R_m = m \\cdot R_1$ formülünde $m = 1, 2, 3$ koyun.`,
              `$${R1},\\; ${2 * R1},\\; ${3 * R1}$.`,
            ],
            solution: [
              `Donma hızları $R_m = m R_1$ olduğundan ilk üç hız **$${R1},\\; ${2 * R1},\\; ${3 * R1}\\text{ RPM}$**.`,
            ],
          },
          {
            prompt: `Pervane gerçekte $R = ${rpmTest}\\text{ RPM}$ ile ileri dönerken stroboskop altında hangi **görünür hızla** ($R_{\\text{gör}}$, ileri için pozitif, geri için negatif, donmuşsa $0$) dönüyor gibi görünür?`,
            kind: 'answer',
            answer: { type: 'int', value: appRpm },
            hints: [
              `$R = ${rpmTest}$ sayısından $R_1 = ${R1}$'in en yakın tam katını çıkararak $(-R_1/2,\\, R_1/2]$ aralığına indirgeyin.`,
              `$R_{\\text{gör}} = ${rpmTest} - ${Math.round(rpmTest / R1)} \\cdot ${R1} = ${appRpm}\\text{ RPM}$.`,
            ],
            solution: [
              `$R_1 = ${R1}$ için en yakın tam kat $m = ${Math.round(rpmTest / R1)}$: $R_{\\text{gör}} = ${rpmTest} - ${Math.round(rpmTest / R1)} \\cdot ${R1} = ${appRpm}\\text{ RPM}$ (**${FAN_DIR_OPTS[dirIdx]}**).`,
            ],
          },
          {
            prompt: `Bu $R = ${rpmTest}\\text{ RPM}$ hızında gözlemci pervaneyi hangi yönde dönüyor gibi algılar?`,
            kind: 'answer',
            answer: dirChoice,
            hints: [
              '$R_{\\text{gör}} > 0$ ise ileri, $R_{\\text{gör}} < 0$ ise geri, $R_{\\text{gör}} = 0$ ise durgun.',
            ],
            solution: [
              `$R_{\\text{gör}} = ${appRpm}\\text{ RPM}$ olduğundan görünür yön: **${FAN_DIR_OPTS[dirIdx]}**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      // Operating range containing 3 or 4 frozen speeds
      const mStart = rng.pick([1, 2]);
      const mEnd = mStart + rng.pick([2, 3]);
      const rangeLo = mStart * R1 - Math.floor(R1 * 0.3);
      const rangeHi = mEnd * R1 + Math.floor(R1 * 0.3);
      const frozenInRange = [];
      for (let m = mStart; m <= mEnd; m++) frozenInRange.push(m * R1);

      // High-band apparent RPM
      const bandM = rng.pick([2, 3]);
      const deltaSign = rng.pick([-1, 1]);
      const deltaMag = Math.max(10, Math.round(R1 * rng.pick([0.15, 0.2, 0.25, 0.3]) / 5) * 5);
      const rpmHigh = bandM * R1 + deltaSign * deltaMag;
      const appHigh = Math.round(wrapHalfOpen(rpmHigh, R1));

      // Inverse backward illusion: apparent -A RPM -> two smallest positive true speeds R1 - A, 2*R1 - A
      const backA = Math.max(10, Math.round(R1 * rng.pick([0.1, 0.2, 0.25, 0.3]) / 5) * 5);
      const invTwo = [R1 - backA, 2 * R1 - backA];

      // Paint one blade red -> symmetry breaks to 1-fold, lowest frozen speed becomes 60*f!
      const paintedR1 = 60 * f;

      return {
        title: `Endüstriyel Fan Stroboskobu ($b = ${b}$ kanat, $f = ${f}\\text{ Hz}$): Çoklu Donma ve Simetri Kırılması`,
        story: `$b = ${b}$ özdeş kanatlı bir endüstriyel fan, $f = ${f}\\text{ Hz}$ frekanslı bir stroboskop altında test ediliyor. Temel donma basamağı $R_1 = 60f/b = ${R1}\\text{ RPM}$ olup $\\mathbb{R} / \\frac{2\\pi}{${b}}\\mathbb{Z}$ bölüm yapısı nedeniyle $R \\equiv R' \\pmod{R_1}$ sağlayan tüm hızlar stroboskop altında ayırt edilemez.`,
        model: { id: 'wheel', params: { spokes: b, fps: f, radius, v: toWheelV(rpmHigh) } },
        parts: makeLabels([
          {
            prompt: `Motorun $[${rangeLo},\\; ${rangeHi}]\\text{ RPM}$ çalışma aralığında fanın tamamen **donmuş** göründüğü tüm dönme hızlarını yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'intset', value: frozenInRange },
            hints: [
              `Donma hızları $R_m = m \\cdot \\frac{60 \\cdot ${f}}{${b}} = m \\cdot ${R1}\\text{ RPM}$ ($m \\in \\mathbb{Z}_{>0}$) biçimindedir.`,
              `$${rangeLo} \\le m \\cdot ${R1} \\le ${rangeHi}$ aralığına düşen $m$ tam sayılarını bulun ($m = ${mStart}, \\dots, ${mEnd}$).`,
            ],
            solution: [
              `$R_1 = ${R1}\\text{ RPM}$ için $[${rangeLo}, ${rangeHi}]$ aralığındaki katlar: **$${intSetTex(frozenInRange)}\\text{ RPM}$**.`,
            ],
          },
          {
            prompt: `Fan gerçekte $R = ${rpmHigh}\\text{ RPM}$ hızıyla dönerken stroboskop altındaki işaretli görünür hızı $R_{\\text{gör}}$ kaç **RPM**'dir?`,
            kind: 'answer',
            answer: { type: 'int', value: appHigh },
            hints: [
              `$${rpmHigh}$ değerinden $R_1 = ${R1}$'in en yakın katını ($${bandM} \\cdot ${R1} = ${bandM * R1}$) çıkarın.`,
            ],
            solution: [
              `$R_{\\text{gör}} = ${rpmHigh} - ${bandM} \\cdot ${R1} = ${appHigh}\\text{ RPM}$.`,
            ],
          },
          {
            prompt: `Fan stroboskop altında **geriye doğru** $|R_{\\text{gör}}| = ${backA}\\text{ RPM}$ (yani $R_{\\text{gör}} = -${backA}\\text{ RPM}$) hızıyla dönüyor gibi görünüyor. Bu görüntüyü oluşturabilecek **en küçük iki pozitif** gerçek fan hızını küçükten büyüğe RPM cinsinden yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'intlist', value: invTwo },
            hints: [
              `$R \\equiv -${backA} \\pmod{${R1}}$, yani $R = m \\cdot ${R1} - ${backA}$ ($m = 1, 2, \\dots$).`,
            ],
            solution: [
              `$m = 1$ için $${R1} - ${backA} = ${invTwo[0]}\\text{ RPM}$ ve $m = 2$ için $${2 * R1} - ${backA} = ${invTwo[1]}\\text{ RPM}$.`,
            ],
          },
          {
            prompt: `Bir mühendis simetriyi kırmak için **yalnızca bir kanadı kırmızıya boyuyor**. Artık fanın donmuş görünmesi için gereken en küçük pozitif hız kaç **RPM** olur?`,
            kind: 'answer',
            answer: { type: 'int', value: paintedR1 },
            hints: [
              'Kırmızı kanat her çakmada yine kendi yerine gelmelidir: bölüm grubu $\\mathbb{R} / \\frac{2\\pi}{b}\\mathbb{Z}$ yerine $\\mathbb{R} / 2\\pi\\mathbb{Z}$ olur ($1$ tam tur/çakma).',
            ],
            solution: [
              `Kırmızı kanadın aynı konumda kalması için çakma başına $1$ tam tur gerekir: $R_{\\text{kırmızı}} = 60 \\cdot ${f} = ${paintedR1}\\text{ RPM}$ (eskisinin $${b}$ katı!).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: dual-frequency stroboscope tachometer inverse problem + band aliasing + proof
    const bandM = rng.pick([2, 3]);
    const deltaMag = Math.max(10, Math.round(R1 * rng.pick([0.15, 0.2, 0.3]) / 5) * 5);
    const rpmTest = bandM * R1 - deltaMag; // backward apparent -deltaMag
    const appTest = Math.round(wrapHalfOpen(rpmTest, R1));
    const backTwo = [R1 - deltaMag, 2 * R1 - deltaMag];

    // Dual-frequency tachometer: pick true blade-pass frequency nu_b divisible by k and k+1!
    const kTach = rng.pick([2, 3, 4]);
    const multBase = rng.pick([10, 12, 15, 20]);
    const nuBlade = kTach * (kTach + 1) * multBase; // Hz, divisible by both kTach and kTach+1!
    const f1 = nuBlade / kTach;         // exact integer Hz
    const f2 = nuBlade / (kTach + 1);   // exact integer Hz (strictly lower adjacent frozen strobe frequency)
    // Make sure trueRpm = (60 / b) * nuBlade is integer (60 * nuBlade divisible by b)
    const bTach = rng.pick([3, 4, 5, 6]); // all divide 60!
    const trueTachRpm = (60 / bTach) * nuBlade;

    return {
      title: `Stroboskopik Takometre: Ters Ölçüm ve $\\mathbb{R} / \\frac{2\\pi}{b}\\mathbb{Z}$ Kuramı`,
      story: `Optik takometrelerde bilinmeyen sabit bir dönme hızının örtüşme hatası olmadan ölçülmesi, $\\mathbb{R} / \\frac{2\\pi}{b}\\mathbb{Z}$ bölüm grubundaki birden fazla donma noktasını birleştirerek yapılır. Önce $b = ${b}$ kanatlı ve $f = ${f}\\text{ Hz}$ stroboskoplu düzenekte ters problemi, ardından çift frekanslı takometre ölçümünü çözelim.`,
      model: { id: 'wheel', params: { spokes: b, fps: f, radius, v: toWheelV(rpmTest) } },
      parts: makeLabels([
        {
          prompt: `$b = ${b}$ kanatlı fan $f = ${f}\\text{ Hz}$ stroboskop altında gerçekte $R = ${rpmTest}\\text{ RPM}$ hızla dönerken görünür hızı $R_{\\text{gör}}$ kaç **RPM**'dir?`,
          kind: 'answer',
          answer: { type: 'int', value: appTest },
          hints: [`$R_1 = 60\\cdot ${f}/${b} = ${R1}\\text{ RPM}$ katlarını çıkararak $(-R_1/2, R_1/2]$ aralığına indirgeyin.`],
          solution: [`$R_{\\text{gör}} = ${rpmTest} - ${bandM} \\cdot ${R1} = ${appTest}\\text{ RPM}$.`],
        },
        {
          prompt: `Aynı düzenekte ($b = ${b},\\; f = ${f}\\text{ Hz}$) görünür hızı $R_{\\text{gör}} = -${deltaMag}\\text{ RPM}$ olan **en küçük iki pozitif** gerçek fan hızını sırayla yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: backTwo },
          hints: [`$R = m R_1 - ${deltaMag}$ ($m = 1, 2$).`],
          solution: [`$m = 1 \\implies ${backTwo[0]}\\text{ RPM}$, $m = 2 \\implies ${backTwo[1]}\\text{ RPM}$.`],
        },
        {
          prompt: `**Takometre ters ölçümü:** Sabit ama bilinmeyen $R_{\\text{gerçek}}$ hızında dönen **$b' = ${bTach}$ kanatlı** bir türbini inceleyen mühendis, stroboskop frekansını yavaşça düşürürken **ardışık iki** donma frekansını $f_1 = ${f1}\\text{ Hz}$ ve $f_2 = ${f2}\\text{ Hz}$ olarak okuyor (aralarında başka donma frekansı yok). Türbinin gerçek dönme hızı $R_{\\text{gerçek}}$ kaç **RPM**'dir?`,
          kind: 'answer',
          answer: { type: 'int', value: trueTachRpm },
          hints: [
            `Kanat geçiş frekansı $\\nu_b = b' R_{\\text{gerçek}} / 60$ için donma koşulu $\\nu_b / f = m \\in \\mathbb{Z}_{>0}$ olur.`,
            `Ardışık iki donma frekansı $f_1 > f_2$ için $\\frac{\\nu_b}{f_2} - \\frac{\\nu_b}{f_1} = 1 \\implies \\nu_b = \\frac{f_1 f_2}{f_1 - f_2}$.`,
          ],
          solution: [
            `Ardışık donmalar $m = ${kTach}$ ve $m + 1 = ${kTach + 1}$ için $\\nu_b = \\frac{f_1 f_2}{f_1 - f_2} = \\frac{${f1} \\cdot ${f2}}{${f1 - f2}} = ${nuBlade}\\text{ Hz}$.`,
            `Gerçek hız: $R_{\\text{gerçek}} = \\frac{60 \\cdot \\nu_b}{b'} = \\frac{60 \\cdot ${nuBlade}}{${bTach}} = ${trueTachRpm}\\text{ RPM}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $b$ özdeş kanatlı bir pervanenin stroboskop altında gözlenen açısal ilerlemesini $\\mathbb{R} / \\frac{2\\pi}{b}\\mathbb{Z}$ bölüm grubuyla modelleyerek (i) sabit $f$ Hz stroboskop için tüm donma hızlarının $R_m = m \\frac{60f}{b}$ ($m \\in \\mathbb{Z}_{>0}$) olduğunu, (ii) sabit $R$ hızındaki bir türbinde ardışık iki donma stroboskop frekansı $f_1 > f_2$ için gerçek hızın $R = \\frac{60}{b}\\frac{f_1 f_2}{f_1 - f_2}$ olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            'Çakma başına açısal ilerleme $\\Delta\\theta = 2\\pi \\frac{R}{60f}$ değerinin $\\frac{2\\pi}{b}\\mathbb{Z}$ çekirdeğine düşme koşulunu yazın; ardışık $f_1, f_2$ için tam sayı katların $m$ ve $m+1$ olduğunu kullanın.',
          ],
          solution: [
            '**(i) Donma hızları:** $b$ özdeş kanat nedeniyle $\\theta \\sim \\theta + \\frac{2\\pi}{b}$ özdeştir; bu $\\mathbb{R} / \\frac{2\\pi}{b}\\mathbb{Z}$ bölüm grubudur. İki çakma arasında ($\\Delta t = 1/f$) ilerleme $\\Delta\\theta = 2\\pi \\frac{R}{60f}$. Pervane donmuş görünür $\\iff \\Delta\\theta \\in \\frac{2\\pi}{b}\\mathbb{Z} \\iff \\frac{bR}{60f} = m \\in \\mathbb{Z}_{>0} \\iff R_m = m\\frac{60f}{b}$.',
            '**(ii) Çift frekans formülü:** Sabit $R$ hızında kanat geçiş frekansı $\\nu_b = \\frac{bR}{60}$ olsun; donma koşulu $\\frac{\\nu_b}{f} = m \\in \\mathbb{Z}_{>0}$, yani $f = \\nu_b / m$. İki ardışık donma frekansı $f_1 > f_2$ (aralarında başka donma yok) ardışık $m$ ve $m+1$ tam sayılarına karşılık gelir: $\\frac{\\nu_b}{f_1} = m$ ve $\\frac{\\nu_b}{f_2} = m + 1$. Taraf tarafa çıkarınca $\\nu_b\\left(\\frac{1}{f_2} - \\frac{1}{f_1}\\right) = 1 \\implies \\nu_b = \\frac{f_1 f_2}{f_1 - f_2}$, buradan $R = \\frac{60}{b}\\frac{f_1 f_2}{f_1 - f_2}$.',
          ],
          checklist: [
            'Özdeş $b$ kanadın $\\mathbb{R} / \\frac{2\\pi}{b}\\mathbb{Z}$ bölüm grubunu doğurduğu ve $\\Delta\\theta = 2\\pi R / (60f) \\in \\frac{2\\pi}{b}\\mathbb{Z}$ koşulunun $R_m = m \\frac{60f}{b}$ verdiği kanıtlandı.',
            'Ardışık donma frekansları $f_1 > f_2$ için $\\nu_b / f_1 = m$ ve $\\nu_b / f_2 = m + 1$ denklemleri kuruldu.',
            'Fark alınarak $R = \\frac{60}{b}\\frac{f_1 f_2}{f_1 - f_2}$ türetildi.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 9. ozgun-takvim-z7 — Calendar arithmetic over Z_7, leap years, 28 & 400 yr cycles
// =====================================================================

const T_TAKVIM_Z7 = {
  id: 'ozgun-takvim-z7',
  topic: 'Devirli Gruplar: Takvim Aritmetiği',
  title: 'Takvim Aritmetiği ($\\mathbb{Z}_7$), Artık Yıllar ve Periyodik Etkinlikler',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const mapNote = 'Haftanın günlerini $\\mathbb{Z}_7$ grubuyla kodlayalım: $0 = \\text{Pazar},\\; 1 = \\text{Pazartesi},\\; 2 = \\text{Salı},\\; 3 = \\text{Çarşamba},\\; 4 = \\text{Perşembe},\\; 5 = \\text{Cuma},\\; 6 = \\text{Cumartesi}$.';

    if (level === 'isinma') {
      const y1 = rng.pick([2025, 2026, 2027, 2029, 2030]);
      const m = rng.pick([1, 3, 4, 5, 6, 9, 10]);
      const d = rng.int(1, 25);
      const w1 = weekdayOf(y1, m, d);
      const deltaDays = rng.int(18, 120);
      const wAfter = mod(w1 + deltaDays, 7);

      const stepK = rng.pick([3, 4, 5, 6, 7, 9, 10, 14, 15, 17]);
      const visitedWeekdays = 7 / gcd(stepK, 7);
      const addYears = rng.pick([2, 3, 4, 5]);
      const y2 = y1 + addYears;
      const leaps = countLeapFeb29Between(y1, m, d, y2);
      const w2 = weekdayOf(y2, m, d);

      return {
        title: `Hafta Günleri ($\\mathbb{Z}_7$) ve Artık Yıl Kayması (${d} ${MONTHS_TR[m]} ${y1})`,
        story: `${mapNote} Bir gözlemevinde kayıtlar **${d} ${MONTHS_TR[m]} ${y1} ${WEEKDAYS[w1]} ($${w1}$)** günü başlıyor. Sıradan bir yıl $365 \\equiv 1 \\pmod 7$, 29 Şubat'ı içeren artık bir yıl ise $366 \\equiv 2 \\pmod 7$ gün kaydırır.`,
        model: { id: 'cyclic', params: { n: 7, k: mod(stepK, 7) } },
        parts: makeLabels([
          {
            prompt: `Başlangıç tarihinden tam **$${deltaDays}$ gün sonra** haftanın hangi günü olur?`,
            kind: 'answer',
            answer: weekdayChoice(rng, wAfter),
            hints: [
              `Toplama $\\mathbb{Z}_7$ içinde yapılır: $w = (${w1} + ${deltaDays}) \\bmod 7$.`,
              `$${deltaDays} \\equiv ${mod(deltaDays, 7)} \\pmod 7$.`,
              `$(${w1} + ${mod(deltaDays, 7)}) \\bmod 7 = ${wAfter}$ (${WEEKDAYS[wAfter]}).`,
            ],
            solution: [
              `$${deltaDays} = ${Math.floor(deltaDays / 7)} \\cdot 7 + ${mod(deltaDays, 7)}$ olduğundan $(${w1} + ${mod(deltaDays, 7)}) \\bmod 7 = ${wAfter}$ (**${WEEKDAYS[wAfter]}**).`,
            ],
          },
          {
            prompt: `Her **$${stepK}$ günde bir** tekrarlanan periyodik bir kalibrasyon, uzun vadede haftanın toplam kaç farklı gününe denk gelir?`,
            kind: 'answer',
            answer: { type: 'int', value: visitedWeekdays },
            hints: [
              `Ziyaret edilen gün sayısı $\\mathbb{Z}_7$ içindeki $|${stepK} \\bmod 7| = 7 / \\gcd(${stepK}, 7)$ mertebesidir.`,
              `$7$ asal sayı olduğu için $7 \\mid ${stepK}$ ise $1$, aksi hâlde $7$ çıkar.`,
            ],
            solution: [
              `$\\gcd(${stepK}, 7) = ${gcd(stepK, 7)}$ olduğundan ziyaret edilen gün sayısı $7 / ${gcd(stepK, 7)} = ${visitedWeekdays}$.`,
            ],
          },
          {
            prompt: `Aynı takvim tarihi **${d} ${MONTHS_TR[m]} ${y2}** (${addYears} yıl sonra) haftanın hangi gününe düşer?`,
            kind: 'answer',
            answer: weekdayChoice(rng, w2),
            hints: [
              `${y1} ile ${y2} arasındaki her yıl $+1$, ayrıca aradan geçen her 29 Şubat (artık yıl) ek $+1$ gün kaydırır.`,
              `Bu iki tarih arasında tam **$${leaps}$** adet 29 Şubat vardır; toplam kayma $${addYears} + ${leaps} = ${addYears + leaps}$ gün.`,
              `$(${w1} + ${addYears + leaps}) \\bmod 7 = ${w2}$ (${WEEKDAYS[w2]}).`,
            ],
            solution: [
              `${addYears} yılda ${leaps} adet 29 Şubat geçer; toplam kayma $${addYears} + ${leaps} = ${addYears + leaps} \\equiv ${mod(addYears + leaps, 7)} \\pmod 7$.`,
              `$(${w1} + ${addYears + leaps}) \\bmod 7 = ${w2}$ (**${WEEKDAYS[w2]}**).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const y1 = rng.pick([2024, 2025, 2026, 2027, 2028]);
      const m = rng.pick([1, 3, 4, 5, 7, 10, 11]);
      const d = rng.int(1, 24);
      const w1 = weekdayOf(y1, m, d);
      const span = rng.int(7, 14);
      const y2 = y1 + span;
      const leaps = countLeapFeb29Between(y1, m, d, y2);
      const w2 = weekdayOf(y2, m, d);

      // Periodic step in Z_7 vs Z_12
      const kDay = rng.pick([3, 4, 5, 9, 10, 11, 14, 15, 18]);
      const kMon = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const ordDay = 7 / gcd(kDay, 7);
      const ordMon = 12 / gcd(kMon, 12);

      // Solve kSolve * t ≡ wTarget - w1 (mod 7) for smallest positive t
      const kSolve = rng.pick([2, 3, 4, 5, 6, 9, 10, 11, 12]); // coprime to 7
      const wTarget = mod(w1 + rng.int(1, 6), 7);
      let tFirst = 1;
      while (mod(w1 + kSolve * tFirst, 7) !== wTarget) tFirst++;

      return {
        title: `Artık Yıl Zinciri, $\\mathbb{Z}_7$ ile $\\mathbb{Z}_{12}$ Karşılaştırması`,
        story: `${mapNote} Bir fizik laboratuvarının referans tarihi **${d} ${MONTHS_TR[m]} ${y1} ${WEEKDAYS[w1]} ($${w1}$)** olarak alınıyor (21. yüzyılda $2001$–$2099$ arası her $4$'ün katı yıl artık yıldır).`,
        model: { id: 'cyclic', params: { n: 7, k: mod(kSolve, 7) } },
        parts: makeLabels([
          {
            prompt: `**${d} ${MONTHS_TR[m]} ${y2}** (${span} yıl sonra) haftanın hangi gününe denk gelir?`,
            kind: 'answer',
            answer: weekdayChoice(rng, w2),
            hints: [
              `${y1} ile ${y2} arasında kaç adet 29 Şubat geçtiğini sayın ($${leaps}$ adet).`,
              `Toplam kayma $(${span} + ${leaps}) \\bmod 7 = ${mod(span + leaps, 7)}$.`,
            ],
            solution: [
              `${span} yılda $${leaps}$ adet 29 Şubat geçer; toplam kayma $${span} + ${leaps} = ${span + leaps} \\equiv ${mod(span + leaps, 7)} \\pmod 7$.`,
              `$(${w1} + ${span + leaps}) \\bmod 7 = ${w2}$ (**${WEEKDAYS[w2]}**).`,
            ],
          },
          {
            prompt: `Bir ölçüm her **$${kDay}$ günde bir** ($\\mathbb{Z}_7$ hafta günleri), başka bir bakım ise her **$${kMon}$ ayda bir** ($\\mathbb{Z}_{12}$ aylar) yapılıyor. Sırasıyla kaç farklı **hafta günü** ve kaç farklı **takvim ayı** ziyaret edilir? (Virgülle ayırın.)`,
            kind: 'answer',
            answer: { type: 'intlist', value: [ordDay, ordMon] },
            hints: [
              `Hafta günleri: $7 / \\gcd(${kDay}, 7)$; aylar: $12 / \\gcd(${kMon}, 12)$.`,
            ],
            solution: [
              `$7 / \\gcd(${kDay}, 7) = ${ordDay}$ hafta günü ve $12 / \\gcd(${kMon}, 12) = ${ordMon}$ ay.`,
            ],
          },
          {
            prompt: `**${WEEKDAYS[w1]} ($${w1}$)** günü başlayan ve her **$${kSolve}$ günde bir** tekrarlanan bir deney, en erken kaçıncı tekrarda ($t \\ge 1$) bir **${WEEKDAYS[wTarget]} ($${wTarget}$)** gününe düşer?`,
            kind: 'answer',
            answer: { type: 'int', value: tFirst },
            hints: [
              `$${w1} + ${kSolve} t \\equiv ${wTarget} \\pmod 7 \\iff ${mod(kSolve, 7)} t \\equiv ${mod(wTarget - w1, 7)} \\pmod 7$ denklemini çözün.`,
            ],
            solution: [
              `$${mod(kSolve, 7)} t \\equiv ${mod(wTarget - w1, 7)} \\pmod 7$ denkleminin $t \\in \\{1, \\dots, 6\\}$ içindeki tek çözümü **$t = ${tFirst}$** olur.`,
            ],
          },
          {
            prompt: `21. yüzyılda ($2001$–$2099$) her $4$ yıllık blok (3 sıradan + 1 artık yıl) takvimi mod $7$ ileri kaydırır. Aynı hafta-günü ve artık-yıl düzeni bu yüzyılda kaç yılda bir kendini tekrarlar?`,
            kind: 'answer',
            answer: { type: 'int', value: 28 },
            hints: [
              'Her $4$ yılda kayma $3 \\cdot 1 + 2 = 5 \\pmod 7$ olur; $|5|_{\\mathbb{Z}_7} = 7$ olduğundan $7$ blok $= 7 \\cdot 4$ yıl!',
            ],
            solution: [
              '$4$ yılda kayma $5 \\pmod 7$ ve $\\gcd(5, 7) = 1 \\implies |5|_{\\mathbb{Z}_7} = 7$. Dolayısıyla $7 \\cdot 4 = 28$ yılda bir takvim aynı gün ve artık-yıl düzenine döner.',
            ],
          },
        ]),
      };
    }

    // zorlayici: century jump crossing 2100 (NOT leap!), linear congruence, 100-yr & 400-yr shift, proof
    const y1 = rng.pick([2026, 2027, 2028, 2029, 2030]);
    const m = rng.pick([3, 4, 5, 6, 9, 10]); // after Feb so leap year counting is super clean
    const d = rng.int(1, 25);
    const w1 = weekdayOf(y1, m, d);
    const jumpYears = rng.pick([80, 84, 88, 92]); // crosses 2100!
    const y2 = y1 + jumpYears;
    const leapsAcross = countLeapFeb29Between(y1, m, d, y2);
    const w2 = weekdayOf(y2, m, d);

    // Solve combined event: every kDay days starting at (w1, month0=0) hits wTarget in Z_7
    const kDay = rng.pick([3, 5, 9, 10, 11, 13, 17]);
    const wTarget = mod(w1 + rng.int(1, 6), 7);
    let tHit = 1;
    while (mod(w1 + kDay * tHit, 7) !== wTarget) tHit++;

    // Century shift (2001..2100): 100 years, 24 leap years => 124 ≡ 5 (mod 7)
    const centuryShift = mod(100 + 24, 7); // 5

    return {
      title: `Gregoryen Takvimi, 2100 İstisnası ve 400 Yıllık $\\mathbb{Z}_7$ Periyodu`,
      story: `${mapNote} Gregoryen takviminde $4$'e bölünen yıllar artık yıldır; **ancak** $100$'e bölünüp $400$'e bölünmeyen yüzyıl başları (örneğin **$2100$**) artık yıl değildir. Referans tarihimiz **${d} ${MONTHS_TR[m]} ${y1} ${WEEKDAYS[w1]} ($${w1}$)** olsun.`,
      model: { id: 'cyclic', params: { n: 7, k: mod(kDay, 7) } },
      parts: makeLabels([
        {
          prompt: `**${d} ${MONTHS_TR[m]} ${y2}** (${jumpYears} yıl sonra, $2100$ yılını aşarak) haftanın hangi gününe denk gelir?`,
          kind: 'answer',
          answer: weekdayChoice(rng, w2),
          hints: [
            `$${y1}$ ile $${y2}$ arasında $4$'e bölünen yıl sayısından $2100$ artık yıl olmadığı için $1$ çıkarın: tam $${leapsAcross}$ adet 29 Şubat geçer.`,
          ],
          solution: [
            `$${jumpYears}$ yılda $2100$ hariç tam $${leapsAcross}$ artık yıl vardır; toplam kayma $${jumpYears} + ${leapsAcross} = ${jumpYears + leapsAcross} \\equiv ${mod(jumpYears + leapsAcross, 7)} \\pmod 7$.`,
            `$(${w1} + ${jumpYears + leapsAcross}) \\bmod 7 = ${w2}$ (**${WEEKDAYS[w2]}**).`,
          ],
        },
        {
          prompt: `**${WEEKDAYS[w1]} ($${w1}$)** başlayan ve her **$${kDay}$ günde bir** tekrarlanan bir uydu geçişi ilk kez kaçıncı tekrarda ($t \\ge 1$) **${WEEKDAYS[wTarget]} ($${wTarget}$)** gününe düşer?`,
          kind: 'answer',
          answer: { type: 'int', value: tHit },
          hints: [`$${mod(kDay, 7)} t \\equiv ${mod(wTarget - w1, 7)} \\pmod 7$ denklemini çözün.`],
          solution: [`$${mod(kDay, 7)} t \\equiv ${mod(wTarget - w1, 7)} \\pmod 7 \\implies t = ${tHit}$ (toplam $${kDay * tHit}$ gün sonra).`],
        },
        {
          prompt: `Artık yıl olmayan bir yüzyıl başını içeren $100$ yıllık bir blok ($2001$–$2100$, tam $24$ artık yıl) haftanın gününü mod $7$ kaç gün ileri kaydırır ($0 \\dots 6$)?`,
          kind: 'answer',
          answer: { type: 'int', value: centuryShift },
          hints: ['Toplam kayma $(100 + 24) \\bmod 7 = 124 \\bmod 7$.'],
          solution: ['$100 \\cdot 365 + 24 \\equiv 100 + 24 = 124 \\equiv 5 \\pmod 7$.'],
        },
        {
          prompt: '**Kanıt:** (i) $\\mathbb{Z}_n$ grubunda her $k$ adımda bir tekrarlanan periyodik bir sürecin tüm $n$ durumu ziyaret etmesinin gerek ve yeter koşulunun $\\gcd(k, n) = 1$ olduğunu ve $7$ asal olduğu için $\\mathbb{Z}_7$' + "'de $7 \\nmid k$ olan her adımın tüm hafta günlerini taradığını kanıtlayın; (ii) Gregoryen takvimindeki $400$ yıllık bir döngüde toplam gün sayısının $7$'ye tam bölündüğünü göstererek takvimin tam $400$ yılda bir birebir tekrarlandığını kanıtlayın.",
          kind: 'proof',
          hints: [
            '(i) için $\\langle k \\rangle$ mertebesinin $n / \\gcd(k, n)$ olduğunu kullanın; (ii) için $400$ yıldaki artık yıl sayısının $100 - 4 + 1 = 97$ olduğunu hesaplayıp $(400 \\cdot 365 + 97) \\bmod 7$ bulun.',
          ],
          solution: [
            '**(i) $\\mathbb{Z}_n$ üreteç ölçütü:** $t$ adımda ulaşılan konumlar $\\langle k \\rangle \\le \\mathbb{Z}_n$ alt grubunu oluşturur ve $|\\langle k \\rangle| = |k|_{\\mathbb{Z}_n} = \\frac{n}{\\gcd(k, n)}$. Tüm $n$ durum ziyaret edilir $\\iff \\frac{n}{\\gcd(k, n)} = n \\iff \\gcd(k, n) = 1$. $n = 7$ asal olduğundan $7 \\nmid k$ olan her $k$ için $\\gcd(k, 7) = 1$ sağlanır (oysa $\\mathbb{Z}_{12}$' + "'de yalnızca $\\gcd(k, 12)=1$ olanlar tüm ayları tarar).",
            '**(ii) $400$ yıllık Gregoryen döngüsü:** $400$ ardışık yılda $4$' + "'e bölünen $100$ yıl vardır; bunlardan $100$'e bölünen $4$ yüzyıl başından yalnızca $400$'e bölünen $1$'i artık yıl kalır. Dolayısıyla artık yıl sayısı $100 - 4 + 1 = 97$ olur. Toplam gün sayısı $400 \\cdot 365 + 97 = 146\\,097 = 20\\,871 \\cdot 7 \\equiv 0 \\pmod 7$ (kısa yol: $400 + 97 = 497 = 71 \\cdot 7 \\equiv 0 \\pmod 7$). Böylece hem artık-yıl kuralı hem de haftanın günleri her $400$ yılda bir birebir tekrarlanır.",
          ],
          checklist: [
            '$|\\langle k \\rangle| = n / \\gcd(k, n)$ kullanılarak tüm durumların taranmasının $\\gcd(k, n) = 1$ ile denkliği kanıtlandı.',
            '$7$ asal olduğundan $7 \\nmid k$ olan her $k$' + "'nın $\\mathbb{Z}_7$'yi ürettiği açıklandı.",
            '$400$ yılda $100 - 4 + 1 = 97$ artık yıl bulunduğu ve $(400 \\cdot 365 + 97) \\equiv 497 \\equiv 0 \\pmod 7$ olduğu kanıtlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 10. ozgun-isiklar-sondu — Lights Out over Z_2^(rows*cols): GF(2) rank, kernel, solving
// =====================================================================

const T_ISIKLAR_SONDU = {
  id: 'ozgun-isiklar-sondu',
  topic: 'Abelyen 2-Grupları: Işıklar Söndü',
  title: 'Işıklar Söndü (Lights Out): $\\mathbb{Z}_2^{rc}$ Alt Grubu ve $\\mathbb{F}_2$ Rankı',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      // Full-rank small grids so the button solution is UNIQUE!
      const [rows, cols] = rng.pick([[2, 2], [1, 3], [1, 4]]);
      const sys = getLightsSystem(rows, cols);
      const N = sys.N;
      const model = { id: 'lights', params: { rows, cols } };

      // Part b: press a sequence with one repeated press to test self-inverse (v + v = 0)
      const [b1, b2, b3] = rng.sample(Array.from({ length: N }, (_, i) => i + 1), Math.min(3, N));
      const seq = [b1, b2, b1]; // b1 cancels itself!
      const seqResult = maskToCells(sys.applyButtons(cellsToMask([b2])), N);

      // Part c: unique solution from pressing 2 distinct buttons
      const solBtns = rng.sample(Array.from({ length: N }, (_, i) => i + 1), 2).sort((a, b) => a - b);
      const targetMask = sys.applyButtons(cellsToMask(solBtns));
      const targetCells = maskToCells(targetMask, N);

      return {
        title: `$${rows} \\times ${cols}$ Işıklar Söndü Paneli ($\\mathbb{Z}_2^{${N}}$)`,
        story: `$${rows} \\times ${cols}$ boyutlu ($N = ${N}$ lambalı) bir kontrol panelinde lambalar satır satır $1, \\dots, ${N}$ olarak numaralanmıştır. Her lambanın durumu $\\mathbb{Z}_2 = \\{0, 1\\}$ ($0$: sönük, $1$: yanık) olduğundan tüm panel durumları $G = \\mathbb{Z}_2^{${N}}$ Abelyen $2$-grubunu oluşturur. Bir düğmeye basmak kendisinin ve yatay/dikey komşularının durumunu mod $2$ tersine çevirir.`,
        model,
        parts: makeLabels([
          {
            prompt: `Bu $${rows} \\times ${cols}$ panelin olası tüm lamba durumlarını içeren $G = \\mathbb{Z}_2^{${N}}$ grubunun mertebesi $|G|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: sys.groupOrder },
            hints: [
              `Her lamba $2$ durum ($0$ veya $1$) alabilir ve toplam $N = ${N}$ lamba vardır.`,
              `$|\\mathbb{Z}_2^{${N}}| = 2^{${N}} = ${sys.groupOrder}$.`,
            ],
            solution: [
              `$|\\mathbb{Z}_2^{${N}}| = 2^{${N}} = ${sys.groupOrder}$.`,
            ],
          },
          {
            prompt: `Tüm lambalar sönükken sırasıyla **$${seq.join(', ')}$** düğmelerine basılıyor. İşlem sonunda hangi numaralı lambalar **yanık ($1$)** kalır? (Virgülle ayırın.)`,
            kind: 'answer',
            answer: { type: 'intset', value: seqResult },
            hints: [
              'Düğme basışları değişmeli ve kendi tersidir ($v_i + v_i = 0$ mod $2$).',
              `$${b1}$ numaralı düğmeye iki kez basıldığından etkisi tamamen iptal olur; geriye yalnızca **$${b2}$** düğmesinin etkisi kalır!`,
              `Yanık lambalar: $${intSetTex(seqResult)}$.`,
            ],
            solution: [
              `$v_{${b1}} + v_{${b2}} + v_{${b1}} = v_{${b2}} \\pmod 2$ olduğundan yalnızca $${b2}$ düğmesi ve komşuları yanar: **$${intSetTex(seqResult)}$**.`,
            ],
          },
          {
            prompt: `Şimdi panelde yalnızca **$${intSetTex(targetCells)}$** numaralı lambalar yanık durumda ($${gridMatrixTex(targetMask, rows, cols)}$). Bu $${rows} \\times ${cols}$ panelde tüm lambaları söndüren **benzersiz** düğme kümesi hangisidir? (Virgülle ayırın.)`,
            kind: 'answer',
            answer: { type: 'intset', value: solBtns },
            hints: [
              'Aynı düğme kümesi sönük panelden hedef deseni yakar ($v + v = 0$).',
              `İki düğme basışının toplamı mod $2$ olarak $${intSetTex(targetCells)}$ verir.`,
              `Çözüm düğmelerinden biri **$${solBtns[0]}$** olup diğerini ekleyin.`,
            ],
            solution: [
              `Düğmeler $${intSetTex(solBtns)}$ basıldığında $v_{${solBtns[0]}} + v_{${solBtns[1]}} \\pmod 2$ tam olarak $${intSetTex(targetCells)}$ desenini verir ($\\operatorname{rank} = ${N}$ olduğundan çözüm benzersizdir).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const useRankDeficient = rng.int(0, 1) === 1;
      if (!useRankDeficient) {
        // 3x3 grid (full rank 9, unique solution!)
        const rows = 3, cols = 3;
        const sys = getLightsSystem(rows, cols);
        const N = 9;
        const pressed = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 3).sort((a, b) => a - b);
        const targetMask = sys.applyButtons(cellsToMask(pressed));
        const targetCells = maskToCells(targetMask, N);
        // Pick 2 buttons for forward calc
        const fwdBtns = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 2).sort((a, b) => a - b);
        const fwdMask = sys.applyButtons(cellsToMask(fwdBtns));
        const fwdCells = maskToCells(fwdMask, N);

        return {
          title: `$3 \\times 3$ Işıklar Söndü Paneli: $\\mathbb{Z}_2^9$ İçinde Benzersiz Çözüm`,
          story: `$3 \\times 3$ boyutlu bir Işıklar Söndü panelinde hücreler satır satır $1, 2, 3$ (üst), $4, 5, 6$ (orta), $7, 8, 9$ (alt) şeklinde numaralanmıştır. Durum grubu $G = \\mathbb{Z}_2^9$ ($|G| = 512$) olup $3 \\times 3$ geçiş matrisi $\\mathbb{F}_2$ üzerinde tam ranklıdır ($\\operatorname{rank}(A) = 9$).`,
          model: { id: 'lights', params: { rows, cols } },
          parts: makeLabels([
            {
              prompt: `Sönük panelde **$${fwdBtns[0]}$ ve $${fwdBtns[1]}$** düğmelerine basıldığında (hangi sırayla basıldığı önemli midir?) hangi lambalar yanık kalır? (Yanık lamba numaralarını virgülle ayırın.)`,
              kind: 'answer',
              answer: { type: 'intset', value: fwdCells },
              hints: [
                `$${fwdBtns[0]}$ düğmesinin etkilediği lambalar $${intSetTex(maskToCells(sys.colMasks[fwdBtns[0] - 1], N))}$ ve $${fwdBtns[1]}$ düğmesinin etkilediği lambalar $${intSetTex(maskToCells(sys.colMasks[fwdBtns[1] - 1], N))}$ olup kesişimdeki lambalar mod $2$ söner!`,
              ],
              solution: [
                `$v_{${fwdBtns[0]}} \\oplus v_{${fwdBtns[1]}} = ${intSetTex(fwdCells)}$ (simetrik fark; basma sırası değişmeli olduğundan sonucu değiştirmez).`,
              ],
            },
            {
              prompt: `$3 \\times 3$ panelin ulaşılabilir desen alt grubu $H = \\operatorname{im}(T) \\le \\mathbb{Z}_2^9$'nin mertebesi $|H|$ kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: sys.imageOrder },
              hints: [
                '$\\operatorname{rank}(A) = 9$ olduğundan $|H| = 2^9 = 512$, yani her desen çözülebilir!',
              ],
              solution: [
                '$|H| = 2^{\\operatorname{rank}(A)} = 2^9 = 512$ ($H = \\mathbb{Z}_2^9$, $\\ker(T) = \\{0\\}$).',
              ],
            },
            {
              prompt: `Panelde şu an yalnızca **$${intSetTex(targetCells)}$** numaralı lambalar yanık ($${gridMatrixTex(targetMask, 3, 3)}$). Bu desenin tam $3$ düğmeye basılarak üretildiği biliniyor; tüm lambaları söndüren **benzersiz** düğme kümesini bulun (virgülle ayırın).`,
              kind: 'answer',
              answer: { type: 'intset', value: pressed },
              hints: [
                `Üç düğmeden biri **$${pressed[0]}$** düğmesidir; önce $${pressed[0]}$ düğmesine basıp kalan deseni $${intSetTex(maskToCells(targetMask ^ sys.colMasks[pressed[0] - 1], N))}$ elde edin.`,
                `Kalan desen iki düğmenin ($${pressed[1]}$ ve $${pressed[2]}$) simetrik farkıdır.`,
              ],
              solution: [
                `$v_{${pressed[0]}} + v_{${pressed[1]}} + v_{${pressed[2]}} \\pmod 2$ tam olarak $${intSetTex(targetCells)}$ desenini verir; çözüm **$${intSetTex(pressed)}$**.`,
              ],
            },
            {
              prompt: `$\\mathbb{Z}_2^9$ grubunda birim eleman ($0$) dışındaki her elemanın mertebesi kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: 2 },
              hints: ['Her $x \\in \\mathbb{Z}_2^9$ için $x + x = 0 \\pmod 2$.'],
              solution: ['Her $x \\neq 0$ için $2x = 0 \\pmod 2$ olduğundan mertebe **$2$** olur.'],
            },
          ]),
        };
      } else {
        // Non-trivial kernel grid: 2x3, 3x2, or 1x5!
        const [rows, cols] = rng.pick([[2, 3], [3, 2], [1, 5]]);
        const sys = getLightsSystem(rows, cols);
        const N = sys.N;
        const wantSolvable = rng.int(0, 1) === 1;
        let testMask;
        if (wantSolvable) {
          const btns = rng.sample(Array.from({ length: N }, (_, i) => i + 1), 2);
          testMask = sys.applyButtons(cellsToMask(btns));
          if (testMask === 0) testMask = sys.colMasks[0];
        } else {
          // Pick a single lit cell or 2-cell pattern guaranteed NOT orthogonal to kernelBasis[0]
          const q0 = sys.kernelBasis[0];
          const qCells = maskToCells(q0, N);
          testMask = 1 << (qCells[rng.int(0, qCells.length - 1)] - 1); // weight 1 inside q0 => q0·test = 1 != 0!
        }
        const testCells = maskToCells(testMask, N);
        const testSolv = sys.isSolvable(testMask);
        const quiet0 = maskToCells(sys.kernelBasis[0], N);

        return {
          title: `$${rows} \\times ${cols}$ Işıklar Söndü: Çekirdek ($\\ker T$), Alt Grup Boyutu ve Çözülebilirlik`,
          story: `$${rows} \\times ${cols}$ boyutlu ($N = ${N}$ hücreli, satır satır $1, \\dots, ${N}$) bir Işıklar Söndü panelinde düğme basışları $T: \\mathbb{Z}_2^{${N}} \\to \\mathbb{Z}_2^{${N}}$ grup homomorfizmasını tanımlar. Bu boyutta bazı boş-olmayan düğme bileşimleri tüm lambaları değişmeden bırakır (sessiz desenler $\\in \\ker T$)! Örneğin **$${intSetTex(quiet0)}$** düğmelerine birlikte basıldığında her lamba çift sayıda değişir ve ekran değişmez.`,
          model: { id: 'lights', params: { rows, cols } },
          parts: makeLabels([
            {
              prompt: `Bu $${rows} \\times ${cols}$ panelde $T: \\mathbb{Z}_2^{${N}} \\to \\mathbb{Z}_2^{${N}}$ matrisinin $\\mathbb{F}_2$ üzerindeki çekirdeğinin mertebesi $|\\ker T|$ (sessiz basış kombinasyonu sayısı, sıfır dahil) kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: sys.kernelOrder },
              hints: [
                `Çekirdek taban vektörü sayısı $\\operatorname{nullity}(A) = ${sys.nullity}$ (örneğin taban: ${sys.kernelBasis.map(q => `$${intSetTex(maskToCells(q, N))}$`).join(', ')}).`,
                `$|\\ker T| = 2^{${sys.nullity}} = ${sys.kernelOrder}$.`,
              ],
              solution: [
                `$\\mathbb{F}_2$ üzerinde $\\operatorname{rank}(A) = ${sys.rank}$ ve $\\operatorname{nullity}(A) = ${N} - ${sys.rank} = ${sys.nullity}$ olduğundan $|\\ker T| = 2^{${sys.nullity}} = ${sys.kernelOrder}$.`,
              ],
            },
            {
              prompt: `Sönük panelden başlanarak ulaşılabilen tüm desenlerin oluşturduğu $H = \\operatorname{im}(T) \\le \\mathbb{Z}_2^{${N}}$ alt grubunun mertebesi $|H|$ kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: sys.imageOrder },
              hints: [
                `Birinci İzomorfizma Teoremiyle $|H| = |\\mathbb{Z}_2^{${N}}| / |\\ker T| = 2^{${N}} / ${sys.kernelOrder} = 2^{${sys.rank}}$.`,
              ],
              solution: [
                `$|H| = 2^{\\operatorname{rank}(A)} = 2^{${sys.rank}} = ${sys.imageOrder}$.`,
              ],
            },
            {
              prompt: `$H$ alt grubunun $G = \\mathbb{Z}_2^{${N}}$ içindeki indeksi $[G : H]$ (farklı koset / denklik sınıfı sayısı) kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: sys.index },
              hints: [`$[G : H] = |G| / |H| = ${sys.groupOrder} / ${sys.imageOrder} = |\\ker T|$.`],
              solution: [`$[G : H] = ${sys.groupOrder} / ${sys.imageOrder} = ${sys.index}$.`],
            },
            {
              prompt: `Panelde yalnızca **$${intSetTex(testCells)}$** lambalarının yanık olduğu $${gridMatrixTex(testMask, rows, cols)}$ deseni tamamen söndürülebilir (çözülebilir) mi?`,
              kind: 'answer',
              answer: { type: 'yesno', value: testSolv },
              hints: [
                'Geçiş matrisi simetrik ($A^T = A$) olduğundan bir $p$ deseni çözülebilirdir $\\iff$ her sessiz desen $q \\in \\ker T$ ile mod $2$ iç çarpımı $q \\cdot p = 0$ olur!',
                `Sessiz desen tabanı: ${sys.kernelBasis.map(q => `$${intSetTex(maskToCells(q, N))}$`).join(', ')} ile $${intSetTex(testCells)}$ kesişimlerinin boyutunu mod $2$ kontrol edin.`,
              ],
              solution: [
                testSolv
                  ? `Her sessiz desen tabanıyla kesişim boyutu çift ($q \\cdot p \\equiv 0 \\pmod 2$) olduğundan desen $H = \\operatorname{im}(T)$ içindedir: **Evet, çözülebilir**.`
                  : `$q = ${intSetTex(quiet0)} \\in \\ker T$ ile $p = ${intSetTex(testCells)}$ kesişimi tek sayıda ($1$) eleman içerir ($q \\cdot p \\equiv 1 \\pmod 2$), dolayısıyla $p \\notin \\operatorname{im}(T)$: **Hayır, çözülemez**.`,
              ],
            },
          ]),
        };
      }
    }

    // zorlayici: strictly rank-deficient grids (2x3, 3x2, 1x5, 5x1; all have nullity >= 1!) + orthogonality criterion + proof
    const [rows, cols] = rng.pick([[2, 3], [3, 2], [1, 5], [5, 1]]);
    const sys = getLightsSystem(rows, cols);
    const N = sys.N;
    const wantSolvable = rng.int(0, 1) === 1;
    let testMask;
    if (wantSolvable) {
      const kB = rng.pick([2, 3]);
      const btns = rng.sample(Array.from({ length: N }, (_, i) => i + 1), kB);
      testMask = sys.applyButtons(cellsToMask(btns));
      if (testMask === 0) testMask = sys.colMasks[0];
    } else {
      const q0 = sys.kernelBasis[0];
      const qCells = maskToCells(q0, N);
      const chosen = qCells[rng.int(0, qCells.length - 1)];
      // Optionally add a solvable toggle to make it look less trivial!
      const extraBtn = rng.int(0, N - 1);
      testMask = (1 << (chosen - 1)) ^ sys.colMasks[extraBtn];
    }
    const testCells = maskToCells(testMask, N);
    const testSolv = sys.isSolvable(testMask);
    const quietBasisTex = sys.kernelBasis.map(q => `$${intSetTex(maskToCells(q, N))}$`).join(', ');

    return {
      title: `$${rows} \\times ${cols}$ Işıklar Söndü: Homomorfizma, $\\mathbb{F}_2$ Diklik Ölçütü ve Kanıt`,
      story: `$${rows} \\times ${cols}$ ($N = ${N}$) Işıklar Söndü panelinde düğme etkileri $T: \\mathbb{Z}_2^{${N}} \\to \\mathbb{Z}_2^{${N}}$, $T(x) = Ax \\pmod 2$ simetrik ($A^T = A$) homomorfizmasıyla verilir. Bu panel için $\\ker T$ sessiz desen alt grubunun tabanı ${quietBasisTex} olarak verilmiştir.`,
      model: { id: 'lights', params: { rows, cols } },
      parts: makeLabels([
        {
          prompt: `$\\ker T$ alt grubunun mertebesi $|\\ker T|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: sys.kernelOrder },
          hints: [`Taban $${sys.nullity}$ bağımsız vektörden oluştuğundan $|\\ker T| = 2^{${sys.nullity}}$.`],
          solution: [`$|\\ker T| = 2^{${sys.nullity}} = ${sys.kernelOrder}$.`],
        },
        {
          prompt: `Ulaşılabilir desen alt grubu $H = \\operatorname{im}(T) \\le \\mathbb{Z}_2^{${N}}$'nin mertebesi $|H|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: sys.imageOrder },
          hints: [`$|H| = 2^{${N}} / |\\ker T| = 2^{${sys.rank}}$.`],
          solution: [`$|H| = 2^{${N}} / ${sys.kernelOrder} = ${sys.imageOrder}$ ($\\operatorname{rank} = ${sys.rank}$).`],
        },
        {
          prompt: `Yalnızca **$${intSetTex(testCells)}$** lambalarının yanık olduğu $${gridMatrixTex(testMask, rows, cols)}$ deseni çözülebilir midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: testSolv },
          hints: [
            `Her taban vektörü $q \\in \\{${sys.kernelBasis.map(q => intSetTex(maskToCells(q, N))).join(',\\,')}\\}$ için $|q \\cap p| \\bmod 2$ değerini kontrol edin.`,
          ],
          solution: [
            `Taban vektörleriyle iç çarpımlar mod $2$: ${sys.kernelBasis.map(q => `${popcount(q & testMask) & 1}`).join(', ')} $\\implies$ **${testSolv ? 'Hepsi $0$, çözülebilir' : 'En az biri $1$, çözülemez'}**.`,
          ],
        },
        {
          prompt: '**Kanıt:** $r \\times c$ Işıklar Söndü oyununda ($N = rc$) (i) $T(x) = Ax \\pmod 2$ dönüşümünün $\\mathbb{Z}_2^N \\to \\mathbb{Z}_2^N$ grup homomorfizması olduğunu ve $|\\operatorname{im} T| \\cdot |\\ker T| = 2^N$ sağlandığını; (ii) $A^T = A$ simetrisini kullanarak bir $p \\in \\mathbb{Z}_2^N$ deseninin çözülebilir olmasının ($p \\in \\operatorname{im} T$) her sessiz desen $q \\in \\ker T$ için $q^T p = 0 \\pmod 2$ koşulunu gerektirdiğini (ve sonlu boyutta bunun gerek-yeter olduğunu) kanıtlayın.',
          kind: 'proof',
          hints: [
            '(i) için $A(x + y) = Ax + Ay \\pmod 2$ ve Birinci İzomorfizma Teoremini kullanın; (ii) için $p = Ax$ ise $q^T p = q^T A x = (A^T q)^T x = (Aq)^T x = 0$ yazıp boyut sayımıyla ($\\dim \\operatorname{im} A = N - \\dim \\ker A = \\dim (\\ker A)^\\perp$) yeterliliği tamamlayın.',
          ],
          solution: [
            '**(i) Homomorfizma ve mertebe:** $\\mathbb{F}_2$ doğrusallığından $T(x + y) = A(x + y) = Ax + Ay = T(x) + T(y) \\pmod 2$. Dolayısıyla $T$ bir grup homomorfizmasıdır, $\\ker T \\le \\mathbb{Z}_2^N$ ve $\\operatorname{im} T \\le \\mathbb{Z}_2^N$ alt gruplardır. Birinci İzomorfizma Teoremiyle $\\mathbb{Z}_2^N / \\ker T \\cong \\operatorname{im} T$, dolayısıyla $|\\operatorname{im} T| \\cdot |\\ker T| = |\\mathbb{Z}_2^N| = 2^N$.',
            '**(ii) Simetri ve diklik ölçütü:** Hücre $i$, hücre $j$' + "'nin komşusu $\\iff j$, $i$'nin komşusudur ve her hücre kendini değiştirir ($A_{ii}=1$); dolayısıyla $A^T = A$. Eğer $p = Ax \\in \\operatorname{im} T$ ve $q \\in \\ker T$ ($Aq = 0$) ise $q^T p = q^T A x = (A^T q)^T x = (Aq)^T x = 0^T x = 0 \\pmod 2$. Yani $\\operatorname{im} T \\subseteq (\\ker T)^\\perp$. Boyut sayımıyla $\\dim_{\\mathbb{F}_2}(\\operatorname{im} T) = N - \\dim(\\ker T) = \\dim((\\ker T)^\\perp)$ olduğundan iki alt uzay eşittir: $p$ çözülebilirdir $\\iff \\forall q \\in \\ker T,\\; q^T p = 0 \\pmod 2$.",
          ],
          checklist: [
            '$T(x+y) = T(x) + T(y) \\pmod 2$ ve $|\\operatorname{im} T| \\cdot |\\ker T| = 2^N$ kanıtlandı.',
            '$A^T = A$ simetrisi gerekçelendirildi ve $q^T (Ax) = (Aq)^T x = 0$ hesaplandı.',
            '$\\dim(\\operatorname{im} T) = N - \\dim(\\ker T) = \\dim((\\ker T)^\\perp)$ ile $\\operatorname{im} T = (\\ker T)^\\perp$ eşitliği tamamlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 11. ozgun-saat-spin-homomorfizma — Clock gears & spin chain phases: Z_m -> Z_n and U(1)
// =====================================================================

const T_SAAT_SPIN_HOM = {
  id: 'ozgun-saat-spin-homomorfizma',
  topic: 'Homomorfizmalar ve $U(1)$ Alt Grupları',
  title: 'Saat Dişlileri ve Spin Zinciri Fazları: $\\mathbb{Z}_m \\to \\mathbb{Z}_n$ ve $U(1)$',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const pairPool = level === 'isinma'
      ? [[6, 12], [8, 12], [6, 9], [12, 8], [10, 15], [12, 18], [9, 12]]
      : [[12, 18], [12, 16], [15, 10], [18, 12], [16, 12], [20, 12], [12, 15], [18, 24], [14, 21]];
    const [m, n] = rng.pick(pairPool);
    const g = gcd(m, n);
    const step = n / g; // valid multipliers a are multiples of step = n / gcd(m, n)

    // Pick a non-trivial valid a (not 0)
    const validAs = [];
    for (let t = 1; t < g; t++) validAs.push(t * step);
    const a = rng.pick(validAs);
    const images = Array.from({ length: m }, (_, k) => mod(a * k, n));
    const ker = [];
    const imSet = new Set();
    for (let k = 0; k < m; k++) {
      if (images[k] === 0) ker.push(k);
      imSet.add(images[k]);
    }
    const im = [...imSet].sort((x, y) => x - y);
    const dImg = im.length; // = n / gcd(a, n) = m / |ker|
    const model = { id: 'hom', params: { from: { kind: 'Z', n: m }, to: { kind: 'Z', n }, images } };

    if (level === 'isinma') {
      const xTick = rng.int(2, m - 1);
      const yImg = images[xTick];
      return {
        title: `Dişli Saat ve Spin Fazı Eşlemesi ($\\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$)`,
        story: `Bir saat mekanizmasında $${m}$ bölmeli ana kadran ($\\mathbb{Z}_{${m}}$), bir kuantum spin halkasındaki $${n}$ ayrık fazı $\\mu_{${n}} = \\{e^{2\\pi i j/${n}} : j \\in \\mathbb{Z}_{${n}}\\} \\le U(1)$ sürüyor. Ana kadranın her $+1$ tikinde spin faz indisi $+${a} \\pmod{${n}}$ ilerlediğinden $\\varphi: \\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$, $\\varphi(k) = ${a}k \\bmod ${n}$ (eşdeğer olarak $k \\mapsto e^{2\\pi i \\cdot ${a}k/${n}} \\in U(1)$) iyi tanımlı bir grup homomorfizmasıdır.`,
        model,
        parts: makeLabels([
          {
            prompt: `Ana kadran $k = ${xTick}$ tik ilerlediğinde spin faz indisi $\\varphi(${xTick}) \\in \\mathbb{Z}_{${n}}$ kaç olur?`,
            kind: 'answer',
            answer: { type: 'int', value: yImg },
            hints: [
              `$\\varphi(${xTick}) = (${a} \\cdot ${xTick}) \\bmod ${n}$ değerini hesaplayın.`,
              `$${a} \\cdot ${xTick} = ${a * xTick}$ ve $${a * xTick} \\bmod ${n} = ${yImg}$.`,
            ],
            solution: [
              `$\\varphi(${xTick}) = (${a} \\cdot ${xTick}) \\bmod ${n} = ${a * xTick} \\bmod ${n} = ${yImg}$ (faz $e^{2\\pi i \\cdot ${yImg}/${n}}$).`,
            ],
          },
          {
            prompt: `Spin fazını başlangıçtaki $+1 = e^0$ değerinde bırakan tüm ana kadran konumlarını — yani çekirdek $\\ker\\varphi \\le \\mathbb{Z}_{${m}}$ kümesini — yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'intset', value: ker },
            hints: [
              `$\\ker\\varphi = \\{k \\in \\mathbb{Z}_{${m}} : ${a}k \\equiv 0 \\pmod{${n}}\\}$.`,
              `En küçük pozitif çekirdek elemanı $d = ${n} / \\gcd(${a}, ${n}) = ${dImg}$ olup $\\ker\\varphi$, $${dImg}$'in $${m}$'den küçük tüm katlarıdır.`,
              `$\\ker\\varphi = ${intSetTex(ker)}$.`,
            ],
            solution: [
              `$${a}k \\equiv 0 \\pmod{${n}} \\iff ${dImg} \\mid k$ olduğundan $\\ker\\varphi = ${intSetTex(ker)}$ ($|\\ker\\varphi| = ${ker.length}$).`,
            ],
          },
          {
            prompt: `Bu eşleme $U(1)$ çemberi üzerinde toplam kaç tane **farklı** kuantum fazı ($|\\operatorname{im}\\varphi|$) üretir?`,
            kind: 'answer',
            answer: { type: 'int', value: dImg },
            hints: [
              `Birinci İzomorfizma Teoremiyle $|\\operatorname{im}\\varphi| = |\\mathbb{Z}_{${m}}| / |\\ker\\varphi| = ${m} / ${ker.length}$.`,
            ],
            solution: [
              `$|\\operatorname{im}\\varphi| = ${m} / ${ker.length} = ${dImg}$ farklı faz ($\\mu_{${dImg}} = \\{e^{2\\pi i j/${dImg}}\\} \\le U(1)$).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      // Test whether a proposed coupling step aTest is well-defined (50% valid, 50% invalid)
      const wantValid = rng.int(0, 1) === 1;
      const invalidAs = [];
      for (let t = 1; t < n; t++) if ((m * t) % n !== 0) invalidAs.push(t);
      const aTest = wantValid ? rng.pick(validAs) : rng.pick(invalidAs);
      const isValidTest = (m * aTest) % n === 0;

      const u1Choice = shuffleChoice(
        rng,
        `$\\mu_{${dImg}} \\cong \\mathbb{Z}_{${dImg}}$`,
        [`$\\mu_{${m}} \\cong \\mathbb{Z}_{${m}}$`, `$\\mu_{${n}} \\cong \\mathbb{Z}_{${n}}$`, `$\\mu_{${ker.length}} \\cong \\mathbb{Z}_{${ker.length}}$`, `$\\mu_{${g}} \\cong \\mathbb{Z}_{${g}}$`]
          .filter(x => x !== `$\\mu_{${dImg}} \\cong \\mathbb{Z}_{${dImg}}$`)
          .slice(0, 3)
      );

      return {
        title: `Spin Fazı Homomorfizması: İyi Tanımlılık ve $U(1)$ Görüntüsü`,
        story: `$${m}$ tikli bir periyodik saat kadranı ($\\mathbb{Z}_{${m}}$) ile $${n}$ durumlu bir spin faz halkası ($\\mu_{${n}} \\cong \\mathbb{Z}_{${n}} \\le U(1)$) birbirine bağlanıyor. Bir $k \\mapsto e^{2\\pi i c k / ${n}}$ ($k \\mapsto c k \\bmod ${n}$) eşlemesinin çelişkisiz (iyi tanımlı) bir grup homomorfizması olması için ana kadran $m = ${m}$ tik sonunda $0$'a döndüğünde fazın da $+1$'e dönmesi ($${m} c \\equiv 0 \\pmod{${n}}$) gerekir.`,
        model,
        parts: makeLabels([
          {
            prompt: `Önerilen $c = ${aTest}$ bağlanma adımı ($k \\mapsto ${aTest}k \\bmod ${n}$) $\\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$ için **iyi tanımlı bir grup homomorfizması** oluşturur mu?`,
            kind: 'answer',
            answer: { type: 'yesno', value: isValidTest },
            hints: [
              `Koşul: $${m} \\cdot ${aTest} \\equiv 0 \\pmod{${n}}$ (eşdeğer olarak $\\frac{${n}}{\\gcd(${m}, ${n})} = ${step}$ sayısı $${aTest}$ değerini bölmelidir).`,
            ],
            solution: [
              `$${m} \\cdot ${aTest} = ${m * aTest} \\equiv ${mod(m * aTest, n)} \\pmod{${n}}$: **${isValidTest ? 'Evet, iyi tanımlı homomorfizmadır' : 'Hayır, çelişkilidir'}**.`,
            ],
          },
          {
            prompt: `Geçerli olan $\\varphi(k) = ${a}k \\bmod ${n}$ homomorfizmasında spin fazının $k = 0$'dan sonra $+1$'e ilk kez geri döndüğü en küçük pozitif tik $k_0 > 0$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: dImg },
            hints: [
              `$${a} k_0 \\equiv 0 \\pmod{${n}}$ sağlayan en küçük pozitif $k_0$, aynı zamanda $\\mathbb{Z}_{${n}}$ içindeki $|${a}| = ${n} / \\gcd(${a}, ${n})$ mertebesidir.`,
            ],
            solution: [
              `$k_0 = \\frac{${n}}{\\gcd(${a}, ${n})} = \\frac{${n}}{${gcd(a, n)}} = ${dImg}$.`,
            ],
          },
          {
            prompt: `$\\varphi(k) = ${a}k \\bmod ${n}$ homomorfizmasının görüntü kümesi $\\operatorname{im}\\varphi \\le \\mathbb{Z}_{${n}}$ elemanlarını yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'intset', value: im },
            hints: [
              `$\\operatorname{im}\\varphi = \\langle ${a} \\rangle = \\langle \\gcd(${a}, ${n}) \\rangle = \\langle ${gcd(a, n)} \\rangle \\le \\mathbb{Z}_{${n}}$.`,
            ],
            solution: [
              `$\\operatorname{im}\\varphi = ${intSetTex(im)}$ ($${dImg}$ eleman).`,
            ],
          },
          {
            prompt: `$U(1)$ çemberi üzerinde $\\operatorname{im}\\varphi$ görüntüsü (ve dolayısıyla $\\mathbb{Z}_{${m}} / \\ker\\varphi$ bölümü) hangi sonlu $U(1)$ alt grubuna izomorfiktir?`,
            kind: 'answer',
            answer: u1Choice,
            hints: [`$|\\operatorname{im}\\varphi| = ${dImg}$ ve $U(1)$'in her sonlu alt grubu devirlidir.`],
            solution: [`Birinci İzomorfizma Teoremiyle $\\mathbb{Z}_{${m}} / \\ker\\varphi \\cong \\operatorname{im}\\varphi \\cong \\mu_{${dImg}} \\cong \\mathbb{Z}_{${dImg}}$.`],
          },
        ]),
      };
    }

    // zorlayici: count homomorphisms Z_m -> Z_n with exact image size d, faithful reps Z_m -> U(1), proof
    const divsG = divisors(g).filter(d => d > 1);
    const targetD = rng.pick(divsG);
    const countExactD = eulerPhi(targetD);
    const faithfulU1 = eulerPhi(m);

    return {
      title: `Spin Fazı Temsilleri: $\\mathbb{Z}_{${m}} \\to \\mu_{${n}} \\le U(1)$ ve Sadık Karakterler`,
      story: `$${m}$ durumlu bir saat/spin çevrimi $\\mathbb{Z}_{${m}}$'nin $U(1) = \\{e^{i\\theta}\\}$ birim çemberine olan homomorfizmaları kuantum mekaniğinde $1$-boyutlu faz temsillerini (karakterleri) oluşturur. Önce somut $\\varphi(k) = ${a}k \\bmod ${n}$ eşlemesini analiz edip ardından genel sayım ve $U(1)$ teoremini kanıtlayalım.`,
      model,
      parts: makeLabels([
        {
          prompt: `$\\varphi: \\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$, $\\varphi(k) = ${a}k \\bmod ${n}$ homomorfizması için $(|\\ker\\varphi|,\\; |\\operatorname{im}\\varphi|)$ çiftini sırasıyla yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: [ker.length, dImg] },
          hints: [`$|\\operatorname{im}\\varphi| = ${n}/\\gcd(${a}, ${n}) = ${dImg}$ ve $|\\ker\\varphi| = ${m}/|\\operatorname{im}\\varphi|$.`],
          solution: [`$|\\operatorname{im}\\varphi| = ${dImg}$ ve $|\\ker\\varphi| = ${m}/${dImg} = ${ker.length}$, yani **$(${ker.length}, ${dImg})$**.`],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$ arasındaki toplam $\\gcd(${m}, ${n}) = ${g}$ homomorfizmadan kaç tanesinin görüntüsü tam olarak **$d = ${targetD}$** farklı faz içerir ($|\\operatorname{im}\\psi| = ${targetD}$)?`,
          kind: 'answer',
          answer: { type: 'int', value: countExactD },
          hints: [
            `$|\\operatorname{im}\\psi| = |\\psi(1)|_{\\mathbb{Z}_{${n}}} = ${targetD}$ koşulu $\\mathbb{Z}_{${n}}$ içinde mertebesi tam $${targetD}$ olan elemanların sayısını verir: $\\varphi_{\\text{Euler}}(${targetD})$.`,
          ],
          solution: [
            `$|\\psi(1)| = ${targetD} \\mid \\gcd(${m}, ${n})$ sağlayan elemanlar $\\mathbb{Z}_{${n}}$ içindeki benzersiz mertebe-$${targetD}$ alt grubunun üreteçleridir; sayıları $\\varphi_{\\text{Euler}}(${targetD}) = ${countExactD}$.`,
          ],
        },
        {
          prompt: `Tüm birim çember $U(1)$ hedef alındığında $\\mathbb{Z}_{${m}} \\to U(1)$ arasındaki **birebir (sadık / faithful)** homomorfizmaların sayısı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: faithfulU1 },
          hints: [
            `Her $\\chi: \\mathbb{Z}_{${m}} \\to U(1)$ homomorfizması $\\chi(1)^m = 1$ (yani $\\chi(1) = e^{2\\pi i r/${m}}$) koşulunu sağlar; birebirlik $\\gcd(r, ${m}) = 1$ gerektirir.`,
          ],
          solution: [
            `$\\chi(1) = e^{2\\pi i r/${m}}$ ilkel $${m}$. birlik kökü olmalıdır ($\\gcd(r, ${m}) = 1$); sayı $\\varphi_{\\text{Euler}}(${m}) = ${faithfulU1}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** Bir $\\chi: (\\mathbb{Z}_m, +) \\to (U(1), \\cdot)$ dönüşümünün grup homomorfizması olmasının gerek ve yeter koşulunun $\\chi(k) = e^{2\\pi i r k / m}$ ($r \\in \\{0, 1, \\dots, m-1\\}$) biçiminde yazılması olduğunu kanıtlayın; ayrıca $\\chi$' + "'nin birebir olmasının $\\gcd(r, m) = 1$ ile denk olduğunu ve $U(1)$'in her sonlu $d$-elemanlı alt grubunun $\\mu_d = \\{e^{2\\pi i j/d}\\} \\cong \\mathbb{Z}_d$ olduğunu gösterin.",
          kind: 'proof',
          hints: [
            '$w = \\chi(1)$ seçip $\\chi(k) = w^k$ ve $w^m = \\chi(m) = \\chi(0) = 1$ koşulundan $w = e^{2\\pi i r/m}$ çıkarın; sonlu $H \\le U(1)$ ($|H|=d$) için Lagrange teoremiyle her $z \\in H$' + "'nin $z^d - 1 = 0$ kökü olduğunu kullanın.",
          ],
          solution: [
            '**Homomorfizmaların sınıflandırılması:** $\\chi$ homomorfizma ise $w = \\chi(1) \\in U(1)$ tüm eşlemeyi belirler: $\\chi(k) = \\chi(1)^k = w^k$. Ayrıca $w^m = \\chi(m \\bmod m) = \\chi(0) = 1$, dolayısıyla $w = e^{2\\pi i r/m}$ ($r \\in \\{0, \\dots, m-1\\}$) olmalıdır. Tersine her $r$ için $\\chi(k) = e^{2\\pi i r k / m}$ iyi tanımlıdır ($k \\equiv k\' \\pmod m \\implies e^{2\\pi i r(k-k\')/m} = 1$) ve $\\chi(k_1 + k_2) = \\chi(k_1)\\chi(k_2)$ sağlar.',
            '**Birebirlik:** $\\ker\\chi = \\{k \\in \\mathbb{Z}_m : m \\mid rk\\}$. Birebirlik $\\ker\\chi = \\{0\\} \\iff |w| = m \\iff \\gcd(r, m) = 1$ (toplam $\\varphi(m)$ adet).',
            '**$U(1)$ sonlu alt grupları:** $|H| = d$ ise Lagrange teoremiyle her $z \\in H$ için $z^d = 1$. Karmaşık sayılarda $z^d - 1 = 0$ polinomunun en fazla $d$ kökü ($\\mu_d = \\{e^{2\\pi i j/d}\\}$) vardır; $H \\subseteq \\mu_d$ ve $|H| = |\\mu_d| = d$ olduğundan $H = \\mu_d \\cong \\mathbb{Z}_d$.',
          ],
          checklist: [
            '$w = \\chi(1)$ için $w^m = 1 \\iff w = e^{2\\pi i r/m}$ gösterildi ve ters yönde iyi tanımlılık/homomorfizma doğrulandı.',
            'Birebirliğin $\\ker\\chi = \\{0\\} \\iff \\gcd(r, m) = 1$ ile denkliği kanıtlandı.',
            'Lagrange teoremi ve $z^d - 1 = 0$ kök sayısıyla $U(1)$' + "'in tek $d$-elemanlı alt grubunun $\\mu_d \\cong \\mathbb{Z}_d$ olduğu kanıtlandı.",
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 12. ozgun-kaleydoskop-yansima — Optical kaleidoscope: two mirrors generating D_m <= D_n
// =====================================================================

const T_KALEYDOSKOP_YANSIMA = {
  id: 'ozgun-kaleydoskop-yansima',
  topic: 'Dihedral Gruplar: Optik Kaleydoskop',
  title: 'Aynalı Kaleydoskop: İki Yansımanın Bileşkesi ve $D_n$ Üreteçleri',
  source: 'ozgun',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const n = rng.pick([4, 5, 6, 8]);
      const degMirror = 180 / n; // angle between adjacent mirrors in D_n
      const a = 0;
      const b = rng.int(1, n - 1);
      const m1 = dEl(n, a, 1); // s (angle 0)
      const m2 = dEl(n, b, 1); // r^b s (angle b * 180/n)
      const prod = dMul(n, m2, m1); // m1 first, then m2 => r^b
      const rev = dMul(n, m1, m2);  // m2 first, then m1 => r^-b
      const rotOrder = dOrder(n, prod);
      const numImages = 2 * rotOrder;

      return {
        title: `İki Aynalı Kaleydoskop ($D_{${n}}$, $\\theta = ${roundNum(b * degMirror, 2)}^\\circ$)`,
        story: `Optik bir kaleydoskopta merkezde kesişen iki düz ayna $M_1$ ve $M_2$ kullanılıyor. Düzgün $${n}$-genin $D_{${n}}$ simetri grubunda $r^k s$ yansıması, yatay eksenle $\\frac{k \\cdot 180^\\circ}{${n}} = ${roundNum(degMirror, 2)}^\\circ k$ açı yapan aynaya karşılık gelir ($M_1 = s$ yatay ayna, $M_2 = ${dTex(m2)}$ ise $${roundNum(b * degMirror, 2)}^\\circ$ açılı ikinci ayna). Konvansiyon: $M_2 M_1$ önce $M_1$, sonra $M_2$ yansıması demektir.`,
        model: { id: 'polygon', params: { n, word: `${dName(m2)} ${dName(m1)}` } },
        parts: makeLabels([
          {
            prompt: `Önce $M_1 = s$, ardından $M_2 = ${dTex(m2)}$ aynasında yansıyan bir ışının uğradığı toplam dönüşüm $M_2 M_1$ elemanını $D_{${n}}$ normal biçiminde yazın.`,
            kind: 'answer',
            answer: { type: 'dihedral', n, value: prod },
            hints: [
              '$(r^b s) \\cdot s = r^b s^2$ ifadesinde $s^2 = e$ kullanın.',
              'İki aynadaki ardışık yansıma, aralarındaki açının **iki katı** kadar saf bir dönme verir!',
              `Sonuç: $${dTex(prod)}$.`,
            ],
            solution: [
              `$M_2 M_1 = (${dTex(m2)})(s) = r^{${b}} s^2 = ${dTex(prod)}$ (saat yönünün tersine $${roundNum(2 * b * degMirror, 2)}^\\circ$ dönme).`,
            ],
          },
          {
            prompt: `Sıra tersine çevrilirse — önce $M_2 = ${dTex(m2)}$, sonra $M_1 = s$ — elde edilen $M_1 M_2$ dönüşümü $D_{${n}}$ normal biçiminde nedir?`,
            kind: 'answer',
            answer: { type: 'dihedral', n, value: rev },
            hints: [
              `$s (r^{${b}} s) = r^{-${b}} s^2 = r^{-${b}}$ ($s r^k = r^{-k} s$ kuralı).`,
              `$-${b} \\equiv ${mod(-b, n)} \\pmod{${n}}$.`,
            ],
            solution: [
              `$M_1 M_2 = s(${dTex(m2)}) = r^{-${b}} s^2 = ${dTex(rev)}$ (ters yönde dönme!).`,
            ],
          },
          {
            prompt: `Bu iki aynanın ürettiği $\\langle M_1, M_2 \\rangle \\le D_{${n}}$ grubunun mertebesi — yani kaleydoskopta cismin kendisi dahil görülen toplam görüntü sayısı — kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: numImages },
            hints: [
              `Üretilen saf dönme $M_2 M_1 = ${dTex(prod)}$ elemanının mertebesi $m = ${n} / \\gcd(${b}, ${n}) = ${rotOrder}$ olur.`,
              `Yansımalarla birlikte $\\langle M_1, M_2 \\rangle \\cong D_{${rotOrder}}$ grubunun $2m = ${numImages}$ elemanı vardır.`,
            ],
            solution: [
              `$|${dTex(prod)}| = ${n} / \\gcd(${b}, ${n}) = ${rotOrder}$ olduğundan $|\\langle M_1, M_2 \\rangle| = 2 \\cdot ${rotOrder} = ${numImages}$ görüntü oluşur.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const n = rng.pick([6, 8, 9, 10, 12]);
      const a = rng.int(0, n - 1);
      // 50% coprime diff (generates all of D_n), 50% shared factor (proper D_m)
      const wantFull = rng.int(0, 1) === 1;
      const diffPool = [];
      for (let d = 1; d < n; d++) {
        if ((gcd(d, n) === 1) === wantFull) diffPool.push(d);
      }
      const diff = rng.pick(diffPool);
      const b = mod(a + diff, n);
      const m1 = dEl(n, a, 1);
      const m2 = dEl(n, b, 1);
      const rot = dMul(n, m2, m1); // r^{b-a}
      const rotOrd = dOrder(n, rot);
      const subOrd = 2 * rotOrd;
      const generatesAll = subOrd === 2 * n;
      // Reflection of mirror m1 across mirror m2: m2 m1 m2 = m2^{-1} m1 m2
      const reflectedMirror = dConj(n, m2, m1);

      return {
        title: `Kaleydoskop Aynaları $M_1 = ${dTex(m1)}$ ve $M_2 = ${dTex(m2)}$ ($D_{${n}}$)`,
        story: `$D_{${n}}$ simetri kafesinde iki düz ayna $M_1 = ${dTex(m1)}$ ve $M_2 = ${dTex(m2)}$ konumlandırılmıştır. Bu iki aynadan ardışık yansımalarla üretilen $H = \\langle M_1, M_2 \\rangle \\le D_{${n}}$ görüntü grubunu inceleyelim.`,
        model: { id: 'polygon', params: { n, word: `${dName(m2)} ${dName(m1)}` } },
        parts: makeLabels([
          {
            prompt: `Önce $M_1 = ${dTex(m1)}$, sonra $M_2 = ${dTex(m2)}$ aynalarında yansıma bileşkesi $M_2 M_1$'i $D_{${n}}$ normal biçiminde yazın.`,
            kind: 'answer',
            answer: { type: 'dihedral', n, value: rot },
            hints: [
              `$(r^b s)(r^a s) = r^{b - a} s^2 = r^{b - a \\bmod ${n}}$.`,
              `$b - a = ${b} - ${a} \\equiv ${rot.k} \\pmod{${n}}$.`,
            ],
            solution: [
              `$M_2 M_1 = (${dTex(m2)})(${dTex(m1)}) = r^{${b} - ${a}} s^2 = ${dTex(rot)}$.`,
            ],
          },
          {
            prompt: `$M_1$ aynasının $M_2$ aynasındaki sanal görüntüsü olan eşlenik ayna $M_2^{-1} M_1 M_2$ ($= M_2 M_1 M_2$) elemanını $D_{${n}}$ normal biçiminde yazın.`,
            kind: 'answer',
            answer: { type: 'dihedral', n, value: reflectedMirror },
            hints: [
              `$(r^b s)(r^a s)(r^b s) = r^{b - a}(r^b s) = r^{2b - a} s$.`,
            ],
            solution: [
              `$M_2 M_1 M_2 = (${dTex(rot)})(${dTex(m2)}) = ${dTex(reflectedMirror)}$.`,
            ],
          },
          {
            prompt: `İki aynanın ürettiği görüntü grubu $H = \\langle M_1, M_2 \\rangle$'nin mertebesi $|H|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: subOrd },
            hints: [
              `Dönme mertebesi $m = |M_2 M_1| = ${n} / \\gcd(${diff}, ${n}) = ${rotOrd}$ olup $|H| = 2m$.`,
            ],
            solution: [
              `$|${dTex(rot)}| = ${n} / \\gcd(${diff}, ${n}) = ${rotOrd}$ olduğundan $H \\cong D_{${rotOrd}}$ ve $|H| = 2 \\cdot ${rotOrd} = ${subOrd}$.`,
            ],
          },
          {
            prompt: `Bu iki ayna tüm $D_{${n}}$ grubunu ($2n = ${2 * n}$ görüntü) tek başına üretir mi?`,
            kind: 'answer',
            answer: { type: 'yesno', value: generatesAll },
            hints: [
              `$\\langle r^a s, r^b s \\rangle = D_{${n}} \\iff \\gcd(b - a, ${n}) = 1$.`,
            ],
            solution: [
              `$\\gcd(${diff}, ${n}) = ${gcd(diff, n)}$ olduğundan $|H| = ${subOrd}$ ($|D_{${n}}| = ${2 * n}$): **${generatesAll ? 'Evet, tüm grubu üretir' : 'Hayır, öz alt grup üretir'}**.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: subgroup generated by two reflections, normality of H = <m1, m2> in D_n, count of generating pairs, proof
    const n = rng.pick([6, 8, 10, 12]);
    const a = rng.int(0, n - 1);
    const diff = rng.pick(divisors(n).filter(d => d > 1 && d < n)); // proper divisor d > 1 so H = D_{n/d}
    const b = mod(a + diff, n);
    const m1 = dEl(n, a, 1);
    const m2 = dEl(n, b, 1);
    const rot = dMul(n, m2, m1);
    const rotOrd = n / diff;
    const subOrd = 2 * rotOrd;
    // Build exact subgroup H = <m1, m2>
    const H = [];
    for (let t = 0; t < rotOrd; t++) {
      H.push(dEl(n, t * diff, 0));
      H.push(dEl(n, a + t * diff, 1));
    }
    const isNorm = dIsNormal(n, H); // True iff diff === 2 (index 2)!
    // How many choices of second mirror M_2 = r^b s (with fixed M_1 = r^a s) generate ALL of D_n? phi(n)!
    const genChoices = eulerPhi(n);

    return {
      title: `Kaleydoskop Alt Grupları ($D_{${n}}$): Normallik, Üreteç Sayımı ve Kanıt`,
      story: `$D_{${n}}$ simetri grubunda $M_1 = ${dTex(m1)}$ ve $M_2 = ${dTex(m2)}$ yansımalarının ürettiği $H = \\langle M_1, M_2 \\rangle$ kaleydoskop alt grubunun yapısını ve tüm $D_{${n}}$ grubunu üreten ayna açılarını belirleyelim.`,
      model: { id: 'sublattice', params: { kind: 'D', n } },
      parts: makeLabels([
        {
          prompt: `$H = \\langle ${dTex(m1)},\\, ${dTex(m2)} \\rangle \\le D_{${n}}$ alt grubunun mertebesi $|H|$ ve indeksi $[D_{${n}} : H]$ değerlerini sırasıyla yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: [subOrd, diff] },
          hints: [`$M_2 M_1 = ${dTex(rot)}$ mertebesi $n / \\gcd(${diff}, ${n}) = ${rotOrd}$, dolayısıyla $|H| = 2 \\cdot ${rotOrd}$ ve indeks $= ${diff}$.`],
          solution: [`$|H| = 2 \\cdot (${n}/${diff}) = ${subOrd}$ ve $[D_{${n}} : H] = ${2 * n}/${subOrd} = ${diff}$.`],
        },
        {
          prompt: `$H = \\langle ${dTex(m1)},\\, ${dTex(m2)} \\rangle$ alt grubu $D_{${n}}$ içinde **normal** midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isNorm },
          hints: [
            `Yansıma içeren bir öz alt grup $D_{${n}}$ içinde ancak ve ancak indeksi $2$ ($\\gcd(b-a, ${n}) = 2$) ise normaldir!`,
          ],
          solution: [
            `İndeks $[D_{${n}} : H] = ${diff}$: ${isNorm ? 'indeks $2$ olduğundan **Evet, normaldir**' : `indeks $${diff} > 2$ ve yansıma içerdiğinden $r^{-1}(${dTex(m1)})r = ${dTex(dConj(n, dEl(n, 1, 0), m1))} \\notin H$, **Hayır, normal değildir**`}.`,
          ],
        },
        {
          prompt: `İlk ayna $M_1 = ${dTex(m1)}$ sabit tutulduğunda, $D_{${n}}$ içindeki $${n}$ yansımadan kaç farklı $M_2 = r^b s$ seçimi $D_{${n}}$'nin **tamamını** üretir ($\\langle M_1, M_2 \\rangle = D_{${n}}$)?`,
          kind: 'answer',
          answer: { type: 'int', value: genChoices },
          hints: [`$\\langle r^a s, r^b s \\rangle = D_{${n}} \\iff \\gcd(b - a, ${n}) = 1$; bu koşulu sağlayan $b \\in \\{0, \\dots, ${n - 1}\\}$ sayısı $\\varphi(${n})$ olur.`],
          solution: [`$\\gcd(b - ${a}, ${n}) = 1$ koşulunu sağlayan $\\varphi(${n}) = ${genChoices}$ farklı $M_2$ aynası vardır.`],
        },
        {
          prompt: '**Kanıt:** $D_n$ grubunda iki yansıma $M_1 = r^a s$ ve $M_2 = r^b s$ ($a \\not\\equiv b \\pmod n$) verildiğinde $d = \\gcd(b - a, n)$ olmak üzere $\\langle M_1, M_2 \\rangle = \\langle r^d, r^a s \\rangle \\cong D_{n/d}$ olduğunu ve bu iki yansımanın tüm $D_n$' + "'yi üretmesinin gerek ve yeter koşulunun $\\gcd(b - a, n) = 1$ olduğunu kanıtlayın.",
          kind: 'proof',
          hints: [
            '$M_2 M_1 = r^{b-a}$ olduğundan $\\langle M_2 M_1 \\rangle = \\langle r^d \\rangle$ olduğunu gösterin; ardından $M_2 = (r^{b-a}) M_1 \\in \\langle r^d, r^a s \\rangle$ ile çift yönlü kapsama kurun.',
          ],
          solution: [
            '**Üretilen dönmeler:** $M_2 M_1 = (r^b s)(r^a s) = r^{b-a} s^2 = r^{b-a} \\in \\langle M_1, M_2 \\rangle$. Devirli $\\langle r \\rangle \\cong \\mathbb{Z}_n$ grubunda $\\langle r^{b-a} \\rangle = \\langle r^d \\rangle$ ($d = \\gcd(b-a, n)$) olup mertebesi $m = n/d$.',
            '**Çift yönlü kapsama:** $r^d \\in \\langle M_1, M_2 \\rangle$ ve $r^a s = M_1 \\in \\langle M_1, M_2 \\rangle$ olduğundan $\\langle r^d, r^a s \\rangle \\subseteq \\langle M_1, M_2 \\rangle$. Tersine $d \\mid (b-a)$ olduğundan $r^{b-a} \\in \\langle r^d \\rangle$ ve $M_2 = r^{b-a} (r^a s) \\in \\langle r^d, r^a s \\rangle$; dolayısıyla $\\langle M_1, M_2 \\rangle = \\langle r^d, r^a s \\rangle$.',
            '**Yapı ve tam üretim:** $R = r^d$ ($|R| = m = n/d$) ve $S = r^a s$ ($S^2 = e$, $SRS = R^{-1}$) olduğundan $\\langle M_1, M_2 \\rangle \\cong D_{n/d}$ ve mertebesi $2n/d$. Dolayısıyla $\\langle M_1, M_2 \\rangle = D_n \\iff 2n/d = 2n \\iff d = \\gcd(b-a, n) = 1$.',
          ],
          checklist: [
            '$M_2 M_1 = r^{b-a}$ hesaplanarak $\\langle r^{b-a} \\rangle = \\langle r^d \\rangle$ ($d = \\gcd(b-a, n)$) gösterildi.',
            '$\\langle M_1, M_2 \\rangle = \\langle r^d, r^a s \\rangle$ çift yönlü kapsama ile kanıtlandı.',
            '$|\\langle M_1, M_2 \\rangle| = 2n/d$ bulunarak tam üretim koşulunun $\\gcd(b-a, n) = 1$ olduğu sonuçlandırıldı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 13. ozgun-benzen-sentez — Open-ended zorlayici synthesis: substituted benzene
//     (stabilizer, left coset, normality, normal core, quotient group, full proof)
// =====================================================================

const T_BENZEN_SENTEZ = {
  id: 'ozgun-benzen-sentez',
  topic: 'Sentez: Kararlı Kılan, Koset ve Bölüm',
  title: 'Sübstitüe Benzen İzomerleri: Kararlı Kılan, Normal Çekirdek ve Bölüm Grubu',
  source: 'ozgun',
  levels: ['zorlayici'],
  generate(rng) {
    const substName = rng.pick(['klor ($-\\text{Cl}$)', 'metil ($-\\text{CH}_3$)', 'flor ($-\\text{F}$)', 'nitro ($-\\text{NO}_2$)']);
    const family = rng.pick(['trisub', 'para', 'ortho', 'meta', 'kekule']);

    let storyDesc, stab, orbitSize, isNorm, core, targetDesc, cosetToTarget, quotLabel, quotOptions;

    if (family === 'trisub') {
      const set = rng.int(0, 1) === 0 ? [1, 3, 5] : [2, 4, 6];
      const other = set[0] === 1 ? [2, 4, 6] : [1, 3, 5];
      storyDesc = `halkanın **$${set.join(', ')}$** konumlarına üç özdeş ${substName} grubu bağlanarak simetrik $1,3,5$-trisübstitüe türev ($M = ${intSetTex(set)}$) oluşturuluyor`;
      stab = dStabOfSet(6, set);
      orbitSize = 12 / stab.length; // 2
      isNorm = dIsNormal(6, stab); // true
      core = dNormalCore(6, stab); // = stab, order 6
      targetDesc = `$M' = ${intSetTex(other)}$`;
      cosetToTarget = dCosetMappingSet(6, set, other);
      quotLabel = '$\\mathbb{Z}_2$';
      quotOptions = ['$\\mathbb{Z}_2$', '$D_3 \\cong S_3$', '$D_6$', '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$'];
    } else if (family === 'para') {
      const v = rng.int(1, 3);
      const set = [v, v + 3];
      const v2 = (v % 3) + 1;
      const other = [v2, v2 + 3];
      storyDesc = `halkanın karşılıklı **$${set[0]}$ ve $${set[1]}$** konumlarına iki özdeş ${substName} grubu bağlanarak *para*-disübstitüe izomer ($M = ${intSetTex(set)}$) oluşturuluyor`;
      stab = dStabOfSet(6, set);
      orbitSize = 12 / stab.length; // 3
      isNorm = dIsNormal(6, stab); // false
      core = dNormalCore(6, stab); // {e, r^3}, order 2
      targetDesc = `$M' = ${intSetTex(other)}$`;
      cosetToTarget = dCosetMappingSet(6, set, other);
      quotLabel = '$D_3 \\cong S_3$';
      quotOptions = ['$\\mathbb{Z}_2$', '$D_3 \\cong S_3$', '$D_6$', '$\\mathbb{Z}_6$'];
    } else if (family === 'ortho') {
      const v = rng.int(1, 6);
      const w = (v % 6) + 1;
      const set = [v, w].sort((a, b) => a - b);
      const shift = rng.pick([1, 2, 3]);
      const other = dApplyToSet(6, dEl(6, shift, 0), set);
      storyDesc = `halkanın komşu **$${set[0]}$ ve $${set[1]}$** konumlarına iki özdeş ${substName} grubu bağlanarak *orto*-disübstitüe izomer ($M = ${intSetTex(set)}$) oluşturuluyor`;
      stab = dStabOfSet(6, set);
      orbitSize = 12 / stab.length; // 6
      isNorm = dIsNormal(6, stab); // false
      core = dNormalCore(6, stab); // {e}, order 1
      targetDesc = `$M' = ${intSetTex(other)}$`;
      cosetToTarget = dCosetMappingSet(6, set, other);
      quotLabel = '$D_6$';
      quotOptions = ['$\\mathbb{Z}_2$', '$D_3 \\cong S_3$', '$D_6$', '$\\mathbb{Z}_6$'];
    } else if (family === 'meta') {
      const v = rng.int(1, 6);
      const w = ((v + 1) % 6) + 1;
      const set = [v, w].sort((a, b) => a - b);
      const shift = rng.pick([1, 2, 3]);
      const other = dApplyToSet(6, dEl(6, shift, 0), set);
      storyDesc = `aralarında bir karbon bulunan **$${set[0]}$ ve $${set[1]}$** konumlarına iki özdeş ${substName} grubu bağlanarak *meta*-disübstitüe izomer ($M = ${intSetTex(set)}$) oluşturuluyor`;
      stab = dStabOfSet(6, set);
      orbitSize = 12 / stab.length; // 6
      isNorm = dIsNormal(6, stab); // false
      core = dNormalCore(6, stab); // {e}, order 1
      targetDesc = `$M' = ${intSetTex(other)}$`;
      cosetToTarget = dCosetMappingSet(6, set, other);
      quotLabel = '$D_6$';
      quotOptions = ['$\\mathbb{Z}_2$', '$D_3 \\cong S_3$', '$D_6$', '$\\mathbb{Z}_6$'];
    } else {
      // Kekule resonance matching
      const m1 = [[1, 2], [3, 4], [5, 6]];
      const m2 = [[2, 3], [4, 5], [6, 1]];
      const flip = rng.int(0, 1) === 1;
      const src = flip ? m2 : m1;
      const dst = flip ? m1 : m2;
      const fmtM = ps => `\\{${ps.map(([a, b]) => `(${a}${b})`).join(',\\,')}\\}`;
      storyDesc = `çift bağların lokalize olduğu Kekulé rezonans yapısı $M = ${fmtM(src)}$ (çift bağ kenarları kümesi) inceleniyor`;
      stab = dStabOfMatching(6, src);
      orbitSize = 12 / stab.length; // 2
      isNorm = dIsNormal(6, stab); // true
      core = dNormalCore(6, stab); // = stab, order 6
      targetDesc = `diğer Kekulé yapısı $M' = ${fmtM(dst)}$`;
      cosetToTarget = dCosetMappingMatching(6, src, dst);
      quotLabel = '$\\mathbb{Z}_2$';
      quotOptions = ['$\\mathbb{Z}_2$', '$D_3 \\cong S_3$', '$D_6$', '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$'];
    }

    const quotChoice = shuffleChoice(rng, quotLabel, quotOptions.filter(x => x !== quotLabel));

    return {
      title: `Benzen Sentez Problemi ($D_6$): Kararlı Kılan, Kosetler ve Etkili Bölüm Grubu`,
      story: `Benzen halkasının ($\\text{C}_6\\text{H}_6$) altı karbonu saat yönünün tersine $1, 2, 3, 4, 5, 6$ olarak numaralanmıştır ve düzlem içi simetri grubu $D_6$ ($|D_6| = 12$) şeklindedir. Bu problemde ${storyDesc}. Kararlı kılan $H = \\operatorname{Stab}_{D_6}(M)$, eşdeğer yönelimler yörüngesi $\\mathcal{O}_M$, sol kosetler ve eylemin çekirdeği (normal çekirdek) $K = \\bigcap_{g \\in D_6} g^{-1} H g$ üzerinden tüm cebirsel resmi birleştirelim.`,
      model: { id: 'molecule', params: { name: 'C6H6' } },
      parts: makeLabels([
        {
          prompt: `Bu molekül yapısının kararlı kılan alt grubu $H = \\operatorname{Stab}_{D_6}(M)$ elemanlarını $D_6$ normal biçiminde yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'dset', n: 6, value: stab },
          hints: [
            `$|H| = ${stab.length}$ olup $M$ yapısını koruyan dönmeleri ve yansımaları $D_6$ içinde belirleyin.`,
          ],
          solution: [
            `$H = \\operatorname{Stab}_{D_6}(M) = ${dSetTex(stab)}$ ($|H| = ${stab.length}$, eşdeğer yönelim sayısı $|\\mathcal{O}_M| = 12/${stab.length} = ${orbitSize}$).`,
          ],
        },
        {
          prompt: `$M$ yapısını eşdeğer ${targetDesc} yönelimine taşıyan tüm $D_6$ simetrilerinin oluşturduğu sol koseti ($gH$) normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n: 6, value: cosetToTarget },
          hints: [
            `$g_0(M) = M'$ sağlayan tek bir $g_0 \\in D_6$ bulup $g_0 H$ sol kosetini hesaplayın ($${stab.length}$ eleman).`,
          ],
          solution: [
            `Aranan sol koset: $g_0 H = ${dSetTex(cosetToTarget)}$.`,
          ],
        },
        {
          prompt: `$H$ alt grubu $D_6$ içinde **normal** midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isNorm },
          hints: [
            isNorm
              ? `$[D_6 : H] = 2$ indeksli her alt grup normaldir.`
              : `Diğer yönelimlerin kararlı kılanları $g H g^{-1}$, $H$ ile aynı mı yoksa farklı mı?`,
          ],
          solution: [
            isNorm
              ? `$[D_6 : H] = 2$ olduğundan $H \\trianglelefteq D_6$: **Evet, normaldir**.`
              : `Örneğin $r^{-1} H r \\neq H$ olduğundan **Hayır, normal değildir**.`,
          ],
        },
        {
          prompt: `$D_6$'nın eşdeğer $${orbitSize}$ yönelim üzerindeki permütasyon eylemi $\\Phi: D_6 \\to S_{${orbitSize}}$ tanımlanıyor. Bu eylemin çekirdeği $K = \\ker\\Phi = \\bigcap_{g \\in D_6} g^{-1} H g$ (normal çekirdek) için mertebe $|K|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: core.length },
          hints: [
            `$K$, **tüm** eşdeğer yönelimleri aynı anda sabit bırakan $D_6$ elemanlarından oluşur: $K = ${dSetTex(core)}$.`,
          ],
          solution: [
            `Tüm $${orbitSize}$ eşdeğer yönelimi birden sabit bırakan normal çekirdek $K = ${dSetTex(core)}$ olup mertebesi **$|K| = ${core.length}$**.`,
          ],
        },
        {
          prompt: `Etkili permütasyon grubu $D_6 / K \\cong \\operatorname{im}\\Phi$ aşağıdaki standart gruplardan hangisine izomorfiktir?`,
          kind: 'answer',
          answer: quotChoice,
          hints: [
            `$|D_6 / K| = 12 / ${core.length} = ${12 / core.length}$ ve $K = ${dSetTex(core)}$ elemanlarına göre $D_6 / K$ bölüm yapısını belirleyin.`,
          ],
          solution: [
            `$K = ${dSetTex(core)}$ ($|K| = ${core.length}$) olduğundan $|D_6 / K| = ${12 / core.length}$ ve **$D_6 / K \\cong ${quotLabel.replace(/\$/g, '')}$**.`,
          ],
        },
        {
          prompt: '**Kanıt:** Bir sonlu $G$ grubunun $H = \\operatorname{Stab}_G(M)$ kararlı kılanına sahip yörüngesi $\\mathcal{O}_M$ ($|\\mathcal{O}_M| = m$) üzerindeki eylemi $\\Phi: G \\to S_m$ ele alınsın. (i) $\\ker\\Phi = \\bigcap_{g \\in G} g H g^{-1}$ olduğunu ve $K = \\ker\\Phi$' + "'nin $H$ içinde kalan en büyük normal alt grup ($K \\trianglelefteq G$) olduğunu; (ii) Birinci İzomorfizma Teoremiyle $G / K \\cong \\operatorname{im}\\Phi \\le S_m$ olduğunu kanıtlayın; (iii) benzen örneğinde neden para-izomerde $K = \\{e, r^3\\}$ ($D_6/K \\cong D_3$) çıkarken trisübstitüe/Kekulé yapısında $K = H$ ($D_6/K \\cong \\mathbb{Z}_2$) ve orto/meta izomerlerinde $K = \\{e\\}$ ($D_6/K \\cong D_6$) çıktığını açıklayın.",
          kind: 'proof',
          hints: [
            '$k \\in \\ker\\Phi \\iff \\forall g \\in G,\\; k(g \\cdot M) = g \\cdot M \\iff \\forall g \\in G,\\; g^{-1} k g \\in H \\iff k \\in \\bigcap_{g \\in G} g H g^{-1}$ zincirini kurun.',
          ],
          solution: [
            '**(i) Çekirdek = normal çekirdek:** $k \\in \\ker\\Phi \\iff \\forall y = g \\cdot M \\in \\mathcal{O}_M,\\; k \\cdot (g \\cdot M) = g \\cdot M \\iff \\forall g \\in G,\\; (g^{-1} k g) \\cdot M = M \\iff \\forall g \\in G,\\; g^{-1} k g \\in H \\iff k \\in \\bigcap_{g \\in G} g H g^{-1}$. Bir homomorfizmanın çekirdeği olduğundan $K \\trianglelefteq G$ ve $g = e$ seçimiyle $K \\subseteq H$. Ayrıca $N \\trianglelefteq G$ ve $N \\subseteq H$ ise her $g$ için $N = g N g^{-1} \\subseteq g H g^{-1}$, yani $N \\subseteq K$: $K$, $H$ içindeki en büyük normal alt gruptur.',
            '**(ii) Bölüm grubu:** $\\Phi: G \\to S_m$ grup homomorfizması olduğundan Birinci İzomorfizma Teoremi $G / K = G / \\ker\\Phi \\cong \\operatorname{im}\\Phi \\le S_m$ verir.',
            '**(iii) Benzen izomerlerinin karşılaştırması:** Trisübstitüe/Kekulé yapısında $|H| = 6$, indeks $2$ olduğundan $H \\trianglelefteq D_6 \\implies K = H$ ve $D_6 / H \\cong \\mathbb{Z}_2$. Para-izomerde üç yönelimin her biri $180^\\circ$ dönme $r^3$ altında sabit kalır (çünkü $r^3 \\in Z(D_6)$), ama hiçbir yansıma üç yönelimi birden korumaz: $K = \\{e, r^3\\}$ ve $D_6 / \\langle r^3 \\rangle \\cong D_3 \\cong S_3$. Orto/meta izomerlerinde $r^3$ yönelimi ters tarafa taşır ve hiçbir yansıma tüm $6$ yönelimi korumaz: $K = \\{e\\}$ (sadık eylem) ve $D_6 / \\{e\\} \\cong D_6$.',
          ],
          checklist: [
            '$k \\in \\ker\\Phi \\iff \\forall g,\\; g^{-1} k g \\in H$ denkliğiyle $\\ker\\Phi = \\bigcap_{g \\in G} g H g^{-1}$ kanıtlandı.',
            '$K$' + "'nin $H$ içindeki en büyük normal alt grup olduğu ve $G / K \\cong \\operatorname{im}\\Phi$ elde edildi.",
            'Para ($K = \\{e, r^3\\}, D_3$), trisübstitüe/Kekulé ($K = H, \\mathbb{Z}_2$) ve orto/meta ($K = \\{e\\}, D_6$) durumları geometrik olarak karşılaştırıldı.',
          ],
        },
      ]),
    };
  },
};

// ---------- export ----------

export const TEMPLATES = [
  T_MOLEKUL_SIMETRI,
  T_MUZIK_TI_GRUBU,
  T_GEZEGEN_HIZALANMA,
  T_PAULI_GRUBU,
  T_KRISTAL_KUSURU,
  T_CAN_CALMA,
  T_BULMACA_PERMUTASYON,
  T_PERVANE_STROBOSKOP,
  T_TAKVIM_Z7,
  T_ISIKLAR_SONDU,
  T_SAAT_SPIN_HOM,
  T_KALEYDOSKOP_YANSIMA,
  T_BENZEN_SENTEZ,
];
