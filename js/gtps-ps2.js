// Part 2 (PS2): FZT 203E Theory of Groups in Physics — Problem Set 2 templates.
// Pure ES module (no DOM, no ui.js/fx.js). All answers computed algorithmically in course conventions.
import {
  gcd, lcm, mod, divisors,
  permId, permMul, permInv, permEq, permCycles, cyclesString, permOrder, permSign, cycleType,
  dEl, dMul, dInv, dEq, dOrder, dName, dAll,
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

function fmtFrac(num, den) {
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(Math.abs(num), den);
  const p = num / g, q = den / g;
  if (q === 1) return String(p);
  return p < 0 ? `-\\frac{${Math.abs(p)}}{${q}}` : `\\frac{${p}}{${q}}`;
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

const dTex = x => dName(x, true);
const dSetTex = arr => `\\{${arr.map(x => dName(x, true)).join(',\\,')}\\}`;
const intSetTex = arr => `\\{${arr.join(',\\,')}\\}`;
const dKey = x => `${x.k}:${x.m}`;

function dUnique(arr) {
  const seen = new Set(), out = [];
  for (const x of arr) {
    const k = dKey(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out.sort((a, b) => a.m - b.m || a.k - b.k);
}

function dRotSub(n, d) {
  const step = n / d;
  return Array.from({ length: d }, (_, t) => dEl(n, t * step, 0));
}

function dDihSub(n, d, j) {
  const step = n / d;
  return dRotSub(n, d).concat(Array.from({ length: d }, (_, t) => dEl(n, j + t * step, 1)));
}

/** Course convention conjugation: g^{-1} a g. */
function dConj(n, g, a) {
  return dMul(n, dMul(n, dInv(n, g), a), g);
}

function dConjClass(n, a) {
  return dUnique(dAll(n).map(g => dConj(n, g, a)));
}

function dAllConjClasses(n) {
  const seen = new Set(), classes = [];
  for (const a of dAll(n)) {
    if (seen.has(dKey(a))) continue;
    const cls = dConjClass(n, a);
    for (const x of cls) seen.add(dKey(x));
    classes.push(cls);
  }
  return classes;
}

function shuffleChoice(rng, correctText, distractors) {
  const uniqueD = [...new Set(distractors)].filter(d => d !== correctText);
  const options = rng.shuffle([correctText, ...uniqueD]);
  return { type: 'choice', options, value: options.indexOf(correctText) };
}

function makeLabels(parts) {
  return parts.map((p, i) => ({ label: String.fromCharCode(97 + i), ...p }));
}

function permTex(p) {
  const cs = permCycles(p);
  if (!cs.length) return 'e';
  const sep = p.length < 10 ? '' : '\\,';
  return cs.map(c => `(${c.join(sep)})`).join('');
}

function cycleLengthOf(p, pos) {
  let cur = p[pos - 1], len = 1;
  while (cur !== pos) { cur = p[cur - 1]; len++; }
  return len;
}

// ---------- Perfect shuffle permutations (position i -> position j, 1..2m) ----------

function shufflePerm(m, kind) {
  const N = 2 * m;
  const p = new Array(N);
  for (let i = 1; i <= N; i++) {
    if (kind === 'out') {
      p[i - 1] = i <= m ? 2 * i - 1 : 2 * (i - m);
    } else {
      p[i - 1] = i <= m ? 2 * i : 2 * (i - m) - 1;
    }
  }
  return p;
}

// ---------- Landau's function g(N) and unique maximal-order cycle types ----------

function allPartitions(n, maxVal = n, cur = [], out = []) {
  if (n === 0) { out.push(cur.slice()); return out; }
  for (let k = Math.min(n, maxVal); k >= 1; k--) {
    cur.push(k);
    allPartitions(n - k, k, cur, out);
    cur.pop();
  }
  return out;
}

const LANDAU_INFO = (() => {
  const map = new Map();
  for (let N = 2; N <= 16; N++) {
    const parts = allPartitions(N);
    let bestOrd = 1;
    const bestNonTriv = new Map();
    for (const pt of parts) {
      const ord = pt.reduce((acc, x) => lcm(acc, x), 1);
      if (ord > bestOrd) {
        bestOrd = ord;
        bestNonTriv.clear();
        const nt = pt.filter(x => x > 1);
        bestNonTriv.set(nt.join(','), nt);
      } else if (ord === bestOrd) {
        const nt = pt.filter(x => x > 1);
        bestNonTriv.set(nt.join(','), nt);
      }
    }
    const list = [...bestNonTriv.values()];
    map.set(N, { maxOrd: bestOrd, uniqueNonTriv: list.length === 1 ? list[0] : null, allNonTriv: list });
  }
  return map;
})();

// ---------- Sliding puzzle (k x k: 3-puzzle, 8-puzzle, 15-puzzle) ----------

function puzzleAnalyze(board, side) {
  const total = side * side;
  const zeroIdx = board.indexOf(0);
  const blankRow = Math.floor(zeroIdx / side);
  const blankCol = zeroIdx % side;
  const blankTaxicab = (side - 1 - blankRow) + (side - 1 - blankCol);

  // Inversions among tiles 1..(total-1), ignoring blank 0
  let inversions = 0;
  for (let i = 0; i < total; i++) {
    if (board[i] === 0) continue;
    for (let j = i + 1; j < total; j++) {
      if (board[j] !== 0 && board[i] > board[j]) inversions++;
    }
  }
  // Full 1-based permutation on cells 1..total mapping cell i -> home cell of board[i-1]
  const fullPerm = board.map(v => (v === 0 ? total : v));
  const fullSign = permSign(fullPerm);
  const blankParity = blankTaxicab % 2 === 0 ? 1 : -1;
  const invariant = fullSign * blankParity;
  const solvable = invariant === 1;
  return {
    side, total, zeroIdx, blankRow, blankCol, blankTaxicab,
    inversions, fullPerm, fullSign, blankParity, invariant, solvable,
  };
}

function puzzleMatrixTex(board, side) {
  const rows = [];
  for (let r = 0; r < side; r++) {
    const cells = [];
    for (let c = 0; c < side; c++) {
      const v = board[r * side + c];
      cells.push(v === 0 ? '\\square' : String(v));
    }
    rows.push(cells.join(' & '));
  }
  return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
}

// ---------- Cube proper rotation group O ≅ S_4 (computed once from SO(3) matrices) ----------

const CUBE_DIAGS = [
  [1, 1, 1],    // d1
  [-1, 1, 1],   // d2
  [-1, -1, 1],  // d3
  [1, -1, 1],   // d4
];

function matMul3(A, B) {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return C;
}

function matTrans3(A) {
  return [
    [A[0][0], A[1][0], A[2][0]],
    [A[0][1], A[1][1], A[2][1]],
    [A[0][2], A[1][2], A[2][2]],
  ];
}

function matApply3(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function matKey3(M) { return M.flat().join(','); }

function diagPermOfMat(M) {
  const p = new Array(4);
  for (let i = 0; i < 4; i++) {
    const w = matApply3(M, CUBE_DIAGS[i]);
    for (let j = 0; j < 4; j++) {
      const d = CUBE_DIAGS[j];
      if ((w[0] === d[0] && w[1] === d[1] && w[2] === d[2]) ||
          (w[0] === -d[0] && w[1] === -d[1] && w[2] === -d[2])) {
        p[i] = j + 1;
        break;
      }
    }
  }
  return p;
}

/** Unsigned coordinate-axis permutation ψ(M) in S_3: 1 <-> X, 2 <-> Y, 3 <-> Z. */
function axisPermOfMat(M) {
  const p = new Array(3);
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      if (M[i][j] !== 0) { p[j] = i + 1; break; }
    }
  }
  return p;
}

function coordMapTex(M) {
  const vars = ['x', 'y', 'z'];
  const out = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (M[i][j] !== 0) {
        out.push(M[i][j] === -1 ? `-${vars[j]}` : vars[j]);
        break;
      }
    }
  }
  return `(x, y, z) \\mapsto (${out.join(',\\,')})`;
}

const CUBE_DATA = (() => {
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const RX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  const RY = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
  const RZ = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];

  const mats = [I];
  const byKey = new Map([[matKey3(I), 0]]);
  for (let head = 0; head < mats.length; head++) {
    const M = mats[head];
    for (const G of [RX, RY, RZ]) {
      const P = matMul3(G, M);
      const k = matKey3(P);
      if (!byKey.has(k)) {
        byKey.set(k, mats.length);
        mats.push(P);
      }
    }
  }

  const rots = mats.map((M, idx) => {
    const diagPerm = diagPermOfMat(M);
    const axisPerm = axisPermOfMat(M);
    const ct = cycleType(diagPerm);
    const tr = M[0][0] + M[1][1] + M[2][2];
    const order = permOrder(diagPerm);
    const sign = permSign(diagPerm);
    let kind, kindLabel, cycleLabel, classSize, centralizerSize;
    if (tr === 3) {
      kind = 'id';
      kindLabel = 'Birim (0°)';
      cycleLabel = '$e$ (sabit)';
      classSize = 1;
      centralizerSize = 24;
    } else if (tr === 1) {
      kind = 'face90';
      kindLabel = 'Yüz ekseni 90° (çeyrek tur)';
      cycleLabel = '$(abcd)$ — 4-döngü';
      classSize = 6;
      centralizerSize = 4;
    } else if (tr === 0) {
      kind = 'vertex120';
      kindLabel = 'Köşegen ekseni 120°';
      cycleLabel = '$(abc)$ — 3-döngü';
      classSize = 8;
      centralizerSize = 3;
    } else if (ct.length === 2 && ct[0] === 2 && ct[1] === 2) {
      kind = 'face180';
      kindLabel = 'Yüz ekseni 180° (yarım tur)';
      cycleLabel = '$(ab)(cd)$ — ayrık iki 2-döngü';
      classSize = 3;
      centralizerSize = 8;
    } else {
      kind = 'edge180';
      kindLabel = 'Kenar ortası ekseni 180°';
      cycleLabel = '$(ab)$ — tek 2-döngü (transpozisyon)';
      classSize = 6;
      centralizerSize = 4;
    }

    // For quarter-turns, extract the exact right-hand +90° axis in {+x, -x, +y, -y, +z, -z}
    let qAxis = null;
    if (kind === 'face90') {
      const ux = (M[2][1] - M[1][2]) / 2;
      const uy = (M[0][2] - M[2][0]) / 2;
      const uz = (M[1][0] - M[0][1]) / 2;
      if (ux === 1) qAxis = '+x';
      else if (ux === -1) qAxis = '-x';
      else if (uy === 1) qAxis = '+y';
      else if (uy === -1) qAxis = '-y';
      else if (uz === 1) qAxis = '+z';
      else if (uz === -1) qAxis = '-z';
    }

    return {
      idx, mat: M, key: matKey3(M),
      diagPerm, axisPerm, coordTex: coordMapTex(M),
      kind, kindLabel, cycleLabel, order, sign, classSize, centralizerSize, qAxis,
    };
  });

  const byDiag = new Map(rots.map(r => [cyclesString(r.diagPerm), r]));
  const findByMat = M => rots[byKey.get(matKey3(M))];
  return { rots, byKey, byDiag, findByMat };
})();

// =====================================================================
// 1. ps2-direkt-carpim — Direct products: element order, cyclicity, max order
// =====================================================================

const T_DIREKT_CARPIM = {
  id: 'ps2-direkt-carpim',
  topic: 'Direkt Çarpımlar',
  title: 'Direkt Çarpım $G \\times H$: Eleman Mertebesi ve Devirlilik',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const coprimePairs = [[3, 4], [3, 5], [4, 5], [3, 7], [4, 7], [5, 6], [5, 7], [4, 9], [5, 8]];
    const nonCoprimePairs = [[4, 6], [4, 8], [6, 8], [6, 9], [6, 10], [8, 12], [6, 12], [9, 12], [10, 15]];
    const wantCoprime = rng.int(0, 1) === 1;
    const [m, n] = rng.pick(wantCoprime ? coprimePairs : nonCoprimePairs);
    const a = rng.int(1, m - 1);
    const b = rng.int(1, n - 1);
    const ordA = m / gcd(a, m);
    const ordB = n / gcd(b, n);
    const ordAB = lcm(ordA, ordB);
    const gMN = gcd(m, n);
    const maxOrd = lcm(m, n);
    const isCyc = gMN === 1;

    const model = { id: 'torus', params: { m, n, a, b } };
    let rawParts;

    if (level === 'isinma') {
      rawParts = [
        {
          prompt: `Bileşen mertebelerini ayrı ayrı bulun: $\\mathbb{Z}_{${m}}$ içinde $|${a}|$ ve $\\mathbb{Z}_{${n}}$ içinde $|${b}|$ değerlerini sırasıyla yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: [ordA, ordB] },
          hints: [
            'Devirli $\\mathbb{Z}_N$ grubunda bir $x$ elemanının mertebesi $|x| = N / \\gcd(x, N)$ formülüyle bulunur.',
            `İlk bileşen: $${m} / \\gcd(${a}, ${m}) = ${m} / ${gcd(a, m)}$; ikinci bileşen: $${n} / \\gcd(${b}, ${n}) = ${n} / ${gcd(b, n)}$.`,
            `Sıralı çift: $${ordA}, ${ordB}$.`,
          ],
          solution: [
            `$\\mathbb{Z}_{${m}}$ içinde $|${a}| = \\frac{${m}}{\\gcd(${a}, ${m})} = \\frac{${m}}{${gcd(a, m)}} = ${ordA}$.`,
            `$\\mathbb{Z}_{${n}}$ içinde $|${b}| = \\frac{${n}}{\\gcd(${b}, ${n})} = \\frac{${n}}{${gcd(b, n)}} = ${ordB}$.`,
          ],
        },
        {
          prompt: `Direkt çarpım grubu $\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ içinde $(${a}, ${b})$ elemanının mertebesi $|(${a}, ${b})|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: ordAB },
          hints: [
            'Direkt çarpımda bir çiftin mertebesi bileşen mertebelerinin en küçük ortak katıdır: $|(g, k)| = \\operatorname{ekok}(|g|, |k|)$.',
            `$\\operatorname{ekok}(${ordA}, ${ordB})$ değerini hesaplayın.`,
            `$\\operatorname{ekok}(${ordA}, ${ordB}) = \\frac{${ordA} \\cdot ${ordB}}{\\gcd(${ordA}, ${ordB})} = ${ordAB}$.`,
          ],
          solution: [
            `$(${a}, ${b})$ elemanının $t$. katı $(t\\cdot ${a} \\bmod ${m},\\; t\\cdot ${b} \\bmod ${n}) = (0, 0)$ ancak ve ancak $${ordA} \\mid t$ ve $${ordB} \\mid t$ ise sağlanır.`,
            `En küçük pozitif $t$: $|(${a}, ${b})| = \\operatorname{ekok}(${ordA}, ${ordB}) = ${ordAB}$.`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ grubu devirli midir (yani $\\mathbb{Z}_{${m * n}}$ grubuna izomorfik midir)?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isCyc },
          hints: [
            '$\\mathbb{Z}_m \\times \\mathbb{Z}_n \\cong \\mathbb{Z}_{mn}$ ancak ve ancak $\\gcd(m, n) = 1$ ise doğrudur.',
            `$\\gcd(${m}, ${n}) = ${gMN}$ değerini kontrol edin.`,
            isCyc ? `$\\gcd(${m}, ${n}) = 1$ olduğundan $(1, 1)$ elemanı tüm grubu üretir.` : `$\\gcd(${m}, ${n}) = ${gMN} > 1$ olduğundan en büyük eleman mertebesi $\\operatorname{ekok}(${m}, ${n}) = ${maxOrd} < ${m * n}$ kalır.`,
          ],
          solution: [
            `$\\gcd(${m}, ${n}) = ${gMN}$ ve en büyük eleman mertebesi $\\operatorname{ekok}(${m}, ${n}) = ${maxOrd}$.`,
            isCyc
              ? `$${maxOrd} = ${m * n}$ olduğundan $(1, 1)$ bir üreteçtir: **Evet**, $\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}} \\cong \\mathbb{Z}_{${m * n}}$.`
              : `$${maxOrd} < ${m * n}$ olduğundan hiçbir eleman tüm grubu üretemez: **Hayır**, devirli değildir.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      rawParts = [
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ grubunda $(${a}, ${b})$ elemanının mertebesi kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: ordAB },
          hints: [
            `Önce bileşen mertebelerini bulun: $|${a}|_{\\mathbb{Z}_{${m}}} = ${m}/\\gcd(${a}, ${m})$ ve $|${b}|_{\\mathbb{Z}_{${n}}} = ${n}/\\gcd(${b}, ${n})$.`,
            `Ardından $|(${a}, ${b})| = \\operatorname{ekok}(|${a}|, |${b}|)$ formülünü uygulayın.`,
          ],
          solution: [
            `$|${a}| = ${m}/\\gcd(${a}, ${m}) = ${ordA}$ ve $|${b}| = ${n}/\\gcd(${b}, ${n}) = ${ordB}$.`,
            `$|(${a}, ${b})| = \\operatorname{ekok}(${ordA}, ${ordB}) = ${ordAB}$.`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ grubunda bir elemanın ulaşabileceği **en büyük mertebe** kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxOrd },
          hints: [
            'Her $(x, y)$ için $|x| \\mid m$ ve $|y| \\mid n$ olduğundan $\\operatorname{ekok}(|x|, |y|)$ en fazla $\\operatorname{ekok}(m, n)$ olabilir.',
            `Bu sınır $(1, 1)$ elemanında gerçekleşir: $|(1, 1)| = \\operatorname{ekok}(${m}, ${n})$.`,
          ],
          solution: [
            `$|x| \\mid ${m}$ ve $|y| \\mid ${n}$ olduğundan $|(x, y)| = \\operatorname{ekok}(|x|, |y|) \\mid \\operatorname{ekok}(${m}, ${n}) = ${maxOrd}$.`,
            `$(1, 1)$ elemanının mertebesi tam $\\operatorname{ekok}(${m}, ${n}) = ${maxOrd}$ olduğundan en büyük mertebe **$${maxOrd}$** olur.`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}} \\cong \\mathbb{Z}_{${m * n}}$ izomorfizması geçerli midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isCyc },
          hints: [
            `Grup mertebesi $${m * n}$ ile en büyük eleman mertebesi $${maxOrd}$ değerini karşılaştırın.`,
          ],
          solution: [
            `$\\gcd(${m}, ${n}) = ${gMN}$ ve $|(1, 1)| = ${maxOrd}$ (grup mertebesi $${m * n}$): **${isCyc ? 'Evet' : 'Hayır'}**.`,
          ],
        },
        {
          prompt: '**Kanıt:** Keyfi iki sonlu grup $G, H$ ve $(g, k) \\in G \\times H$ için $|(g, k)| = \\operatorname{ekok}(|g|, |k|)$ olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            '$(g, k)^t = (g^t, k^t) = (e_G, e_H)$ koşulunun $|g| \\mid t$ ve $|k| \\mid t$ bölünebilme koşullarına denk olduğunu gösterin.',
          ],
          solution: [
            'Direkt çarpımda bileşen bazlı çarpma yapıldığından her $t \\in \\mathbb{Z}_{>0}$ için $(g, k)^t = (g^t, k^t)$.',
            '$(g^t, k^t) = (e_G, e_H) \\iff g^t = e_G$ ve $k^t = e_H \\iff |g| \\mid t$ ve $|k| \\mid t$.',
            'Hem $|g|$ hem de $|k|$ tarafından bölünen en küçük pozitif tam sayı tam olarak $\\operatorname{ekok}(|g|, |k|)$ olduğundan $|(g, k)| = \\operatorname{ekok}(|g|, |k|)$.',
          ],
          checklist: [
            '$(g, k)^t = (g^t, k^t) = (e_G, e_H)$ denkliği kuruldu.',
            '$g^t = e_G \\iff |g| \\mid t$ ve $k^t = e_H \\iff |k| \\mid t$ bölünebilme özelliği kullanıldı.',
            'En küçük ortak pozitif katın $\\operatorname{ekok}(|g|, |k|)$ olduğu bağlandı.',
          ],
        },
      ];
    } else {
      // zorlayici: also test D_p x Z_q element order and count elements of maximal order in Z_m x Z_n
      const pD = rng.pick([4, 5, 6, 8]);
      const qZ = rng.pick([3, 4, 5, 6]);
      const dElPick = dEl(pD, rng.int(1, pD - 1), rng.int(0, 1));
      const cZ = rng.int(1, qZ - 1);
      const ordD = dOrder(pD, dElPick);
      const ordC = qZ / gcd(cZ, qZ);
      const ordDC = lcm(ordD, ordC);

      let maxOrdCount = 0;
      for (let x = 0; x < m; x++) {
        const ox = m / gcd(x, m);
        for (let y = 0; y < n; y++) {
          const oy = n / gcd(y, n);
          if (lcm(ox, oy) === maxOrd) maxOrdCount++;
        }
      }

      rawParts = [
        {
          prompt: `Değişmeli olmayan $D_{${pD}} \\times \\mathbb{Z}_{${qZ}}$ direkt çarpımında $(${dTex(dElPick)},\\, ${cZ})$ elemanının mertebesi kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: ordDC },
          hints: [
            `$D_{${pD}}$ içinde $|${dTex(dElPick)}|$ ve $\\mathbb{Z}_{${qZ}}$ içinde $|${cZ}|$ değerlerinin EKOK'unu alın.`,
          ],
          solution: [
            `$D_{${pD}}$ içinde $|${dTex(dElPick)}| = ${ordD}$ (${dElPick.m ? 'yansıma' : `${pD}/\\gcd(${dElPick.k}, ${pD})`}) ve $\\mathbb{Z}_{${qZ}}$ içinde $|${cZ}| = ${qZ}/\\gcd(${cZ}, ${qZ}) = ${ordC}$.`,
            `$|(${dTex(dElPick)},\\, ${cZ})| = \\operatorname{ekok}(${ordD}, ${ordC}) = ${ordDC}$.`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ grubunda en büyük eleman mertebesi $L = \\operatorname{ekok}(${m}, ${n})$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxOrd },
          hints: [`$L = \\frac{${m} \\cdot ${n}}{\\gcd(${m}, ${n})}$.`],
          solution: [`$L = \\operatorname{ekok}(${m}, ${n}) = \\frac{${m * n}}{${gMN}} = ${maxOrd}$.`],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ içinde mertebesi tam $L = ${maxOrd}$ olan kaç tane $(x, y)$ elemanı vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxOrdCount },
          hints: [
            isCyc
              ? `$\\gcd(${m}, ${n}) = 1$ olduğundan $\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}} \\cong \\mathbb{Z}_{${m * n}}$ ve mertebesi $${maxOrd}$ olan eleman sayısı $\\varphi(${m})\\varphi(${n})$ olur.`
              : `Her asal çarpan $p$ için $L$'deki en yüksek $p$-kuvvetinin $x$ veya $y$ bileşenlerinden en az birinin mertebesinde tutturulması gerekir.`,
          ],
          solution: [
            isCyc
              ? `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}} \\cong \\mathbb{Z}_{${m * n}}$ olduğundan üreteç sayısı $\\varphi(${m * n}) = \\varphi(${m})\\varphi(${n}) = ${eulerPhi(m)} \\cdot ${eulerPhi(n)} = ${maxOrdCount}$.`
              : `$\\operatorname{ekok}(|x|, |y|) = ${maxOrd}$ koşulunu sağlayan $(x, y) \\in \\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ çiftleri sayıldığında tam **$${maxOrdCount}$** eleman bulunur.`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\mathbb{Z}_m \\times \\mathbb{Z}_n \\cong \\mathbb{Z}_{mn}$ olmasının gerek ve yeter koşulunun $\\gcd(m, n) = 1$ olduğunu her iki yönde kanıtlayın.',
          kind: 'proof',
          hints: [
            '($\\Leftarrow$) için $(1, 1)$ elemanının mertebesini hesaplayın; ($\\Rightarrow$) için $\\gcd(m, n) > 1$ iken her elemanın mertebesinin $\\operatorname{ekok}(m, n) < mn$ kaldığını gösterin.',
          ],
          solution: [
            '**($\\Leftarrow$) $\\gcd(m, n) = 1$:** $|(1, 1)| = \\operatorname{ekok}(|1|_{\\mathbb{Z}_m}, |1|_{\\mathbb{Z}_n}) = \\operatorname{ekok}(m, n) = mn = |\\mathbb{Z}_m \\times \\mathbb{Z}_n|$. Dolayısıyla $(1, 1)$ tüm grubu üretir ve $k \\mapsto (k \\bmod m, k \\bmod n)$ bir izomorfizmadır ($\\mathbb{Z}_m \\times \\mathbb{Z}_n \\cong \\mathbb{Z}_{mn}$).',
            '**($\\Rightarrow$) $\\gcd(m, n) = d > 1$:** Her $(x, y) \\in \\mathbb{Z}_m \\times \\mathbb{Z}_n$ için $|x| \\mid m$ ve $|y| \\mid n$ olduğundan $|(x, y)| = \\operatorname{ekok}(|x|, |y|) \\le \\operatorname{ekok}(m, n) = \\frac{mn}{d} < mn$. Mertebesi $mn$ olan hiçbir eleman bulunmadığından grup devirli olamaz ve $\\mathbb{Z}_{mn}$' + "'ye izomorfik değildir.",
          ],
          checklist: [
            '$\\gcd(m, n) = 1$ durumunda $|(1, 1)| = \\operatorname{ekok}(m, n) = mn$ ile devirlilik gösterildi.',
            '$\\gcd(m, n) > 1$ durumunda her $(x, y)$ için $|(x, y)| \\le \\operatorname{ekok}(m, n) < mn$ eşitsizliği kuruldu.',
            'Devirli bir grupta mertebesi grup mertebesine eşit eleman bulunması gerektiğiyle ($\\Rightarrow$) yönü tamamlandı.',
          ],
        },
      ];
    }

    return {
      title: `Birleşik Periyodik Sistem: $\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$`,
      story: `İki bağımsız periyodik saat devresi sırasıyla $m = ${m}$ ve $n = ${n}$ durumlu halkalar olarak çalışıyor. Bileşik sistemin simetri grubu direkt çarpım $\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ olup her saat darbesinde durumlar $(+${a} \\bmod ${m},\\; +${b} \\bmod ${n})$ kadar ilerliyor.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 2. ps2-torus-kafes — Particle hopping on an m x n periodic torus lattice
// =====================================================================

const T_TORUS_KAFES = {
  id: 'ps2-torus-kafes',
  topic: 'Direkt Çarpımlar',
  title: 'Periyodik $m \\times n$ Torus Kafesinde Parçacık Sıçraması',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const coprimePool = [[3, 4], [3, 5], [4, 5], [3, 7], [4, 7], [5, 6], [5, 7], [5, 8], [4, 9], [7, 8]];
    const nonCoprimePool = [[4, 6], [6, 8], [6, 9], [4, 8], [6, 10], [8, 10], [8, 12], [6, 12], [9, 12]];
    const wantCoprime = rng.int(0, 1) === 1;
    const [m, n] = rng.pick(wantCoprime ? coprimePool : nonCoprimePool);

    // Pick step (a, b) with interesting non-trivial behavior
    const a = rng.int(1, m - 1);
    const b = rng.int(1, n - 1);
    const ga = gcd(a, m), gb = gcd(b, n);
    const tx = m / ga, ty = n / gb;
    const visited = lcm(tx, ty);
    const totalSites = m * n;
    const maxSites = lcm(m, n);
    const canVisitAll = gcd(m, n) === 1;
    const orbits = totalSites / visited;

    const model = { id: 'torus', params: { m, n, a, b } };
    let rawParts;

    if (level === 'isinma') {
      rawParts = [
        {
          prompt: `Yalnızca yatay eksene ($x \\mapsto x + ${a} \\bmod ${m}$) ve yalnızca dikey eksene ($y \\mapsto y + ${b} \\bmod ${n}$) baktığımızda parçacığın başlangıç koordinatına ilk kez dönmesi için gereken adım sayılarını $(T_x, T_y)$ sırasıyla yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: [tx, ty] },
          hints: [
            `Yatayda $T_x = m / \\gcd(a, m)$ ve dikeyde $T_y = n / \\gcd(b, n)$ adım gerekir.`,
            `$\\gcd(${a}, ${m}) = ${ga}$ ve $\\gcd(${b}, ${n}) = ${gb}$.`,
            `$T_x = ${m}/${ga} = ${tx}$, $T_y = ${n}/${gb} = ${ty}$.`,
          ],
          solution: [
            `$T_x = \\frac{${m}}{\\gcd(${a}, ${m})} = \\frac{${m}}{${ga}} = ${tx}$ ve $T_y = \\frac{${n}}{\\gcd(${b}, ${n})} = \\frac{${n}}{${gb}} = ${ty}$.`,
          ],
        },
        {
          prompt: `$(0, 0)$ noktasından başlayıp her adımda $(${a}, ${b})$ kadar sıçrayan parçacık, $(0, 0)$'a dönmeden önce kafeste toplam kaç farklı konum ziyaret eder?`,
          kind: 'answer',
          answer: { type: 'int', value: visited },
          hints: [
            'Ziyaret edilen nokta sayısı, $(0, 0)$ konumuna ilk kez geri dönülen adım sayısına eşittir; bu da $\\mathbb{Z}_m \\times \\mathbb{Z}_n$ grubundaki $|(a, b)|$ mertebesidir.',
            `Hem yatay hem dikey koordinatın aynı anda $0$'a dönmesi için adım sayısı $\\operatorname{ekok}(T_x, T_y)$ olmalıdır.`,
            `$\\operatorname{ekok}(${tx}, ${ty}) = ${visited}$.`,
          ],
          solution: [
            `Ziyaret edilen nokta sayısı $|(${a}, ${b})| = \\operatorname{ekok}(T_x, T_y) = \\operatorname{ekok}(${tx}, ${ty}) = ${visited}$.`,
          ],
        },
        {
          prompt: `Bu belirli $(${a}, ${b})$ adımıyla kafesteki **tüm** $${totalSites}$ konum ziyaret edilebilir mi?`,
          kind: 'answer',
          answer: { type: 'yesno', value: visited === totalSites },
          hints: [
            `Ziyaret edilen konum sayısı $${visited}$ ile toplam kafes noktası $${m} \\cdot ${n} = ${totalSites}$ sayısını karşılaştırın.`,
            visited === totalSites ? 'İkisi eşit olduğundan tüm kafes taranır.' : `$${visited} < ${totalSites}$ olduğundan bazı konumlar hiç ziyaret edilmez.`,
          ],
          solution: [
            `Ziyaret edilen konum sayısı $${visited}$, toplam nokta sayısı $${totalSites}$: **${visited === totalSites ? 'Evet, tüm noktalar ziyaret edilir' : 'Hayır, tüm noktalar ziyaret edilmez'}**.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      rawParts = [
        {
          prompt: `Sabit $(${a}, ${b})$ sıçrama vektörüyle $(0, 0)$'dan başlayan parçacık kaç farklı kafes noktası ziyaret eder?`,
          kind: 'answer',
          answer: { type: 'int', value: visited },
          hints: [
            `Ziyaret sayısı $\\operatorname{ekok}\\!\\left(\\frac{${m}}{\\gcd(${a}, ${m})},\\; \\frac{${n}}{\\gcd(${b}, ${n})}\\right)$ formülüyle verilir.`,
            `$T_x = ${tx}$ ve $T_y = ${ty}$ için $\\operatorname{ekok}(${tx}, ${ty})$ hesaplayın.`,
          ],
          solution: [
            `$T_x = ${m}/\\gcd(${a}, ${m}) = ${tx}$, $T_y = ${n}/\\gcd(${b}, ${n}) = ${ty}$.`,
            `Ziyaret edilen farklı nokta sayısı: $\\operatorname{ekok}(${tx}, ${ty}) = ${visited}$.`,
          ],
        },
        {
          prompt: `Bu $${m} \\times ${n}$ periyodik kafeste, uygun bir sabit $(a', b')$ adımı seçilerek ziyaret edilebilecek **en büyük** nokta sayısı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxSites },
          hints: [
            'Her $(a\', b\')$ adımı için $T_x \\mid m$ ve $T_y \\mid n$ olduğundan ziyaret sayısı en fazla $\\operatorname{ekok}(m, n)$ olabilir.',
            `Örneğin $(a', b') = (1, 1)$ adımı tam $\\operatorname{ekok}(${m}, ${n})$ nokta ziyaret eder.`,
          ],
          solution: [
            `En büyük ziyaret sayısı $\\operatorname{ekok}(${m}, ${n}) = \\frac{${m} \\cdot ${n}}{\\gcd(${m}, ${n})} = ${maxSites}$ (örneğin $(1, 1)$ adımıyla elde edilir).`,
          ],
        },
        {
          prompt: `Bu $${m} \\times ${n}$ kafeste, tek bir sabit adım vektörüyle **tüm $${totalSites}$ noktanın** ziyaret edilmesi mümkün müdür?`,
          kind: 'answer',
          answer: { type: 'yesno', value: canVisitAll },
          hints: [
            `Maksimum ziyaret sayısı $\\operatorname{ekok}(${m}, ${n}) = ${maxSites}$ değerinin $mn = ${totalSites}$ değerine eşit olup olmadığına (yani $\\gcd(${m}, ${n}) = 1$ koşuluna) bakın.`,
          ],
          solution: [
            `$\\gcd(${m}, ${n}) = ${gcd(m, n)}$ olduğundan maksimum ziyaret sayısı $${maxSites}$ ($mn = ${totalSites}$): **${canVisitAll ? 'Evet, mümkün' : 'Hayır, imkânsız'}**.`,
          ],
        },
        {
          prompt: `$(${a}, ${b})$ sıçrama kuralı tüm $${m} \\times ${n}$ kafesi kaç tane ayrık periyodik yörüngeye (yani $\\langle (${a}, ${b}) \\rangle$ kosetine) parçalar?`,
          kind: 'answer',
          answer: { type: 'int', value: orbits },
          hints: [
            'Her başlangıç noktasının yörüngesi $H = \\langle (a, b) \\rangle$ alt grubunun bir koseti olduğundan tüm yörüngeler aynı uzunluğa ($|H|$) sahiptir.',
            `Lagrange teoremiyle yörünge sayısı $[\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}} : H] = ${totalSites} / ${visited}$.`,
          ],
          solution: [
            `Her yörünge $|H| = ${visited}$ nokta içerdiğinden ayrık yörünge sayısı $\\frac{${m} \\cdot ${n}}{${visited}} = ${orbits}$.`,
          ],
        },
      ];
    } else {
      let optSteps = 0;
      for (let x = 0; x < m; x++) {
        const ox = m / gcd(x, m);
        for (let y = 0; y < n; y++) {
          const oy = n / gcd(y, n);
          if (lcm(ox, oy) === maxSites) optSteps++;
        }
      }
      rawParts = [
        {
          prompt: `$(${a}, ${b})$ adımıyla $(0, 0)$'dan başlayan parçacık kaç farklı kafes noktası ziyaret eder?`,
          kind: 'answer',
          answer: { type: 'int', value: visited },
          hints: [`$\\operatorname{ekok}(${m}/\\gcd(${a}, ${m}),\\; ${n}/\\gcd(${b}, ${n}))$ değerini hesaplayın.`],
          solution: [`$T_x = ${tx},\\; T_y = ${ty} \\implies \\operatorname{ekok}(${tx}, ${ty}) = ${visited}$.`],
        },
        {
          prompt: `Bu $${m} \\times ${n}$ torus kafesinde herhangi bir sabit adımla ulaşılabilecek en büyük nokta sayısı $M_{\\max}$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxSites },
          hints: [`$M_{\\max} = \\operatorname{ekok}(${m}, ${n})$.`],
          solution: [`$M_{\\max} = \\operatorname{ekok}(${m}, ${n}) = ${maxSites}$.`],
        },
        {
          prompt: `$\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}$ içindeki $${totalSites}$ olası sabit adım vektöründen kaç tanesi bu maksimum $M_{\\max} = ${maxSites}$ nokta sayısına ulaşır?`,
          kind: 'answer',
          answer: { type: 'int', value: optSteps },
          hints: [
            canVisitAll
              ? `$\\gcd(${m}, ${n}) = 1$ olduğundan $x$ için $\\gcd(x, ${m}) = 1$ ($\\varphi(${m})$ seçim) ve $y$ için $\\gcd(y, ${n}) = 1$ ($\\varphi(${n})$ seçim) gerekir.`
              : `$\\operatorname{ekok}(|x|, |y|) = ${maxSites}$ koşulunu sağlayan $(x, y)$ çiftlerini asal kuvvet bileşenlerine göre sayın.`,
          ],
          solution: [
            canVisitAll
              ? `$\\gcd(${m}, ${n}) = 1$ iken tam kafesi tarayan adımlar $\\gcd(a', ${m}) = 1$ ve $\\gcd(b', ${n}) = 1$ sağlayanlar olup sayıları $\\varphi(${m})\\varphi(${n}) = ${eulerPhi(m)} \\cdot ${eulerPhi(n)} = ${optSteps}$.`
              : `$\\operatorname{ekok}(${m}/\\gcd(a', ${m}), ${n}/\\gcd(b', ${n})) = ${maxSites}$ sağlayan tüm adım vektörlerinin sayısı **$${optSteps}$**.`,
          ],
        },
        {
          prompt: '**Kanıt:** Periyodik bir $m \\times n$ torus kafesinde $(a, b)$ sabit adımının ziyaret ettiği nokta sayısının $\\operatorname{ekok}(m/\\gcd(a,m),\\, n/\\gcd(b,n))$ olduğunu ve tüm $mn$ noktanın tek bir sabit adımla ziyaret edilebilmesinin gerek ve yeter koşulunun $\\gcd(m, n) = 1$ olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            'Kafes noktalarını $\\mathbb{Z}_m \\times \\mathbb{Z}_n$ grubuyla özdeşleştirin; ziyaret edilen küme $\\langle (a, b) \\rangle$ alt grubudur.',
          ],
          solution: [
            '$t$ adım sonraki konum $t(a, b) = (ta \\bmod m,\\, tb \\bmod n) \\in \\mathbb{Z}_m \\times \\mathbb{Z}_n$ olur. İki adım $t_1, t_2$ aynı noktaya düşer $\\iff (t_1 - t_2)(a, b) = (0, 0)$.',
            'Dolayısıyla ziyaret edilen farklı konumların kümesi tam olarak $H = \\langle (a, b) \\rangle$ devirli alt grubudur ve eleman sayısı $|(a, b)| = \\operatorname{ekok}(|a|_{\\mathbb{Z}_m}, |b|_{\\mathbb{Z}_n}) = \\operatorname{ekok}(m/\\gcd(a, m),\\, n/\\gcd(b, n))$.',
            'Her $(a, b)$ için $|(a, b)| \\le \\operatorname{ekok}(m, n) = mn / \\gcd(m, n)$ olup üst sınıra $(1, 1)$ adımı ulaşır. Dolayısıyla tüm $mn$ noktayı tarayan bir adım vardır $\\iff \\operatorname{ekok}(m, n) = mn \\iff \\gcd(m, n) = 1$.',
          ],
          checklist: [
            'Ziyaret edilen konumlar kümesinin $\\langle (a, b) \\rangle \\le \\mathbb{Z}_m \\times \\mathbb{Z}_n$ olduğu gösterildi.',
            'Sayı $|(a, b)| = \\operatorname{ekok}(m/\\gcd(a,m), n/\\gcd(b,n))$ olarak türetildi.',
            'Üst sınırın $\\operatorname{ekok}(m, n)$ olduğu ve $mn$' + "'ye eşitliğin $\\gcd(m, n) = 1$ ile denkliği kanıtlandı.",
          ],
        },
      ];
    }

    return {
      title: `$${m} \\times ${n}$ Periyodik Kristal Yüzeyde Sıçrama Yörüngesi`,
      story: `Periyodik sınır koşullarına sahip $${m} \\times ${n}$ düğümlü iki boyutlu bir kristal yüzeyde (bir torus kafesinde) bir eksiton her zaman adımında sabit $(${a}, ${b})$ vektörü kadar atlıyor: $(x, y) \\mapsto (x + ${a} \\bmod ${m},\\; y + ${b} \\bmod ${n})$.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 3. ps2-parite-zaman — Parity P and Time Reversal T of trajectories
// =====================================================================

const SUBGROUP_V4_LABELS = [
  '$\\{e\\}$ (ne $P$, ne $T$, ne $PT$)',
  '$\\{e, P\\}$ (yalnızca parite)',
  '$\\{e, T\\}$ (yalnızca zaman tersinmesi)',
  '$\\{e, PT\\}$ (yalnızca birleşik $PT$)',
  '$\\{e, P, T, PT\\}$ (tümü)',
];

/** Algorithmically evaluate P, T, PT symmetry of a force law F(x, v). */
function analyzeForceSym(fn) {
  const pts = [
    [1.3, 0.7], [-2.1, 1.5], [0.4, -1.9], [2.7, 2.3], [-0.8, -1.1], [1.7, -0.6],
  ];
  let hasP = true, hasT = true, hasPT = true;
  for (const [x, v] of pts) {
    const f = fn(x, v);
    if (Math.abs(fn(-x, -v) + f) > 1e-8) hasP = false;
    if (Math.abs(fn(x, -v) - f) > 1e-8) hasT = false;
    if (Math.abs(fn(-x, v) + f) > 1e-8) hasPT = false;
  }
  const elems = ['e'];
  if (hasP) elems.push('P');
  if (hasT) elems.push('T');
  if (hasPT) elems.push('PT');
  let subIdx;
  if (hasP && hasT && hasPT) subIdx = 4;
  else if (hasP) subIdx = 1;
  else if (hasT) subIdx = 2;
  else if (hasPT) subIdx = 3;
  else subIdx = 0;
  return { hasP, hasT, hasPT, elems, order: elems.length, subIdx, label: SUBGROUP_V4_LABELS[subIdx] };
}

function buildForceEntry(rng, id) {
  const k = rng.int(2, 9), g = rng.int(1, 6), c = rng.int(2, 8), b = rng.int(1, 5);
  switch (id) {
    case 'hooke':
      return {
        id, tex: `-${k}x`, desc: 'Harmonik yay kuvveti',
        fn: (x) => -k * x,
        breakWhy: 'Ne tercihli bir yön ne de sürtünme vardır; dolayısıyla hem $P$ hem $T$ (ve $PT$) korunur.',
        breakChoiceIdx: 3,
      };
    case 'cubic':
      return {
        id, tex: `-${k}x^3`, desc: 'Saf kübik anharmonik yay',
        fn: (x) => -k * x * x * x,
        breakWhy: 'Kuvvet $x$' + "'te tek fonksiyondur ve hızdan bağımsızdır; hem $P$ hem $T$ korunur.",
        breakChoiceIdx: 3,
      };
    case 'damped-osc':
      return {
        id, tex: `-${k}x - ${g}\\dot{x}`, desc: 'Sönümlü harmonik osilatör',
        fn: (x, v) => -k * x - g * v,
        breakWhy: '$-\\gamma\\dot{x}$ sürtünme (sönüm) terimi hızın tek kuvveti olduğundan zaman tersinmesini ($T$) bozar; buna karşılık $x$ ve $\\dot{x}$ birlikte işaret değiştirdiğinden parite ($P$) korunur.',
        breakChoiceIdx: 1,
      };
    case 'quad-drag':
      return {
        id, tex: `-${k}x - ${g}\\dot{x}|\\dot{x}|`, desc: 'Karesel sürüklemeli osilatör',
        fn: (x, v) => -k * x - g * v * Math.abs(v),
        breakWhy: '$-\\gamma\\dot{x}|\\dot{x}|$ sürükleme terimi hareket yönüne daima zıttır: zaman tersinmesini ($T$) bozar ama $P$ altında işaret değiştirdiğinden pariteyi korur.',
        breakChoiceIdx: 1,
      };
    case 'gravity':
      return {
        id, tex: `-mg \\quad (mg = ${c})`, desc: 'Sabit yerçekimi altında serbest düşme',
        fn: () => -c,
        breakWhy: 'Aşağı doğru sabit yerçekimi tercihli bir uzay yönü seçer ve pariteyi ($P$) bozar; hız terimi olmadığı için zaman tersinmesi ($T$) korunur.',
        breakChoiceIdx: 0,
      };
    case 'efield':
      return {
        id, tex: `+qE \\quad (qE = ${c})`, desc: 'Düzgün elektrik alanda yüklü parçacık',
        fn: () => c,
        breakWhy: 'Sabit $+qE$ dış alanı uzayda tercihli bir yön belirlediği için pariteyi ($P$) bozar; sürtünme olmadığından zaman tersinmesi ($T$) korunur.',
        breakChoiceIdx: 0,
      };
    case 'v2-force':
      return {
        id, tex: `-${k}x + ${b}\\dot{x}^2`, desc: 'Karesel hız terimli yön seçici kuvvet',
        fn: (x, v) => -k * x + b * v * v,
        breakWhy: '$+\\beta\\dot{x}^2$ terimi $\\dot{x} \\mapsto -\\dot{x}$ altında değişmediği için zaman tersinmesini ($T$) korur; fakat daima $+x$ yönünde ittiği (tercihli yön oluşturduğu) için pariteyi ($P$) bozar!',
        breakChoiceIdx: 0,
      };
    case 'asym-anharm':
      return {
        id, tex: `-${k}x + ${b}x^2`, desc: 'Asimetrik kristal potansiyeli kuvveti',
        fn: (x) => -k * x + b * x * x,
        breakWhy: '$+\\beta x^2$ terimi $+x$ ile $-x$ yönlerini eşdeğer olmaktan çıkararak pariteyi ($P$) bozar; hızdan bağımsız olduğundan zaman tersinmesi ($T$) korunur.',
        breakChoiceIdx: 0,
      };
    case 'grav-drag':
      return {
        id, tex: `-mg - ${g}\\dot{x} \\quad (mg = ${c})`, desc: 'Hava direnci altında serbest düşme',
        fn: (_x, v) => -c - g * v,
        breakWhy: 'Sabit yerçekimi ($-mg$) tercihli yön oluşturup $P$' + "'yi, doğrusal sürükleme ($-\\gamma\\dot{x}$) ise enerji kaybı yaratarak $T$'yi bozar; $PT$ de korunmaz.",
        breakChoiceIdx: 2,
      };
    case 'efield-drag':
      return {
        id, tex: `+qE - ${g}\\dot{x} \\quad (qE = ${c})`, desc: 'Dirençli ortamda düzgün elektrik alan',
        fn: (_x, v) => c - g * v,
        breakWhy: 'Düzgün elektrik alanı ($+qE$) tercihli yönle $P$' + "'yi, sürtünme ($-\\gamma\\dot{x}$) ise $T$'yi bozar; yalnızca birim $e$ kalır.",
        breakChoiceIdx: 2,
      };
    case 'pt-gain-loss':
    default:
      return {
        id: 'pt-gain-loss', tex: `-${k}x - ${b}x\\dot{x}`, desc: 'Konuma bağlı kazanç-kayıp ($PT$-simetrik) osilatör',
        fn: (x, v) => -k * x - b * x * v,
        breakWhy: '$x > 0$ bölgesinde sönüm (kayıp), $x < 0$ bölgesinde ise negatif sönüm (kazanç) vardır: $P$ ve $T$ ayrı ayrı bozulur ama birlikte uygulandığında kazanç ile kayıp tam dengelenir ve $PT$ korunur!',
        breakChoiceIdx: 2,
      };
  }
}

const BREAK_OPTS = [
  'Tercihli bir uzay yönü (yerçekimi, dış alan veya yön seçici terim) yalnızca $P$' + "'yi bozar",
  'Sürtünme / hızla tek dereceden sürükleme terimi yalnızca $T$' + "'yi bozar",
  'Hem $P$ hem de $T$ ayrı ayrı bozulur',
  'Ne $P$ ne de $T$ bozulur (ikisi de simetridir)',
];

const T_PARITE_ZAMAN = {
  id: 'ps2-parite-zaman',
  topic: 'Parite ve Zaman Tersinmesi',
  title: 'Yörünge Simetrileri: Parite $P$, Zaman Tersinmesi $T$ ve $\\mathbb{Z}_2 \\times \\mathbb{Z}_2$',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const pool = level === 'isinma'
      ? ['hooke', 'cubic', 'damped-osc', 'gravity', 'efield', 'grav-drag']
      : level === 'odev'
        ? ['hooke', 'cubic', 'damped-osc', 'quad-drag', 'gravity', 'efield', 'v2-force', 'grav-drag', 'pt-gain-loss']
        : ['damped-osc', 'quad-drag', 'v2-force', 'asym-anharm', 'grav-drag', 'efield-drag', 'pt-gain-loss'];

    const force = buildForceEntry(rng, rng.pick(pool));
    const sym = analyzeForceSym(force.fn);
    const model = { id: 'cayley', params: { kind: 'D', n: 2 } };

    let rawParts;
    if (level === 'isinma') {
      const breakChoice = shuffleChoice(rng, BREAK_OPTS[force.breakChoiceIdx], BREAK_OPTS.filter((_, i) => i !== force.breakChoiceIdx));
      rawParts = [
        {
          prompt: `Parite dönüşümü $(Px)(t) = -x(t)$ bu hareket denkleminin ($m\\ddot{x} = ${force.tex}$) bir simetrisi midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: sym.hasP },
          hints: [
            '$P$ altında $x \\mapsto -x$, $\\dot{x} \\mapsto -\\dot{x}$ ve $\\ddot{x} \\mapsto -\\ddot{x}$ olur.',
            'Simetri koşulu: her $(x, v)$ için $F(-x, -v) = -F(x, v)$ sağlanmalıdır.',
            sym.hasP ? `$F(-x, -v) = -F(x, v)$ özdeşliği sağlanır.` : `$F(-x, -v) \\neq -F(x, v)$ olduğundan parite bozulur.`,
          ],
          solution: [
            `$P$ simetri koşulu $F(-x, -v) = -F(x, v)$ test edilir.`,
            `${force.breakWhy} Dolayısıyla $P$ için cevap: **${sym.hasP ? 'Evet' : 'Hayır'}**.`,
          ],
        },
        {
          prompt: `Zaman tersinmesi $(Tx)(t) = x(-t)$ bu hareket denkleminin bir simetrisi midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: sym.hasT },
          hints: [
            '$T$ altında $t \\mapsto -t$ olduğunda konum aynı kalır ($x \\mapsto x$), hız işaret değiştirir ($\\dot{x} \\mapsto -\\dot{x}$) ve ivme değişmez ($\\ddot{x} \\mapsto +\\ddot{x}$).',
            'Simetri koşulu: her $(x, v)$ için $F(x, -v) = F(x, v)$ sağlanmalıdır.',
            sym.hasT ? 'Kuvvet hızın çift (veya sıfırıncı) fonksiyonu olduğundan $T$ korunur.' : 'Hızın tek kuvveti (sürtünme) $T$' + "'yi bozar.",
          ],
          solution: [
            `$T$ simetri koşulu $F(x, -v) = F(x, v)$ test edilir: **${sym.hasT ? 'Evet' : 'Hayır'}**.`,
          ],
        },
        {
          prompt: `Bu hareket denkleminin $\\{e, P, T, PT\\}$ içindeki simetri alt grubu kaç elemanlıdır?`,
          kind: 'answer',
          answer: { type: 'int', value: sym.order },
          hints: [
            'Simetri alt grubu daima $e$ birim elemanını içerir ve mertebesi $|V_4| = 4$ sayısını bölmelidir ($1, 2$ veya $4$).',
            'Hem $P$ hem $T$ sağlanıyorsa $PT$ de sağlanır ($4$ eleman); yalnızca biri sağlanıyorsa $2$ eleman; hiçbiri sağlanmıyorsa $1$ (veya $PT$ sağlanıyorsa $2$) eleman.',
            `Bu kuvvet için alt grup ${sym.label} olup mertebesi $${sym.order}$ olur.`,
          ],
          solution: [
            `Simetri alt grubu: ${sym.label}, eleman sayısı **$${sym.order}$**.`,
          ],
        },
        {
          prompt: `Bu sistemde $P$ ve $T$ simetrilerinin kırılma nedeni aşağıdakilerden hangisidir?`,
          kind: 'answer',
          answer: breakChoice,
          hints: [
            'Fiziksel olarak uzayda seçilmiş sabit bir yön (yerçekimi, düzgün alan) $P$' + "'yi; sürtünme/sönüm ise $T$'yi kırar.",
            force.breakWhy,
          ],
          solution: [force.breakWhy],
        },
      ];
    } else if (level === 'odev') {
      const subChoice = shuffleChoice(rng, sym.label, SUBGROUP_V4_LABELS.filter((_, i) => i !== sym.subIdx));
      const xPos = rng.int(2, 9);
      const xNeg = rng.pick([-8, -7, -6, -5, -4, -3, -2, 3, 4, 5, 6].filter(v => Math.abs(v) !== xPos));
      const t0 = rng.int(1, 5);
      const breakChoice = shuffleChoice(rng, BREAK_OPTS[force.breakChoiceIdx], BREAK_OPTS.filter((_, i) => i !== force.breakChoiceIdx));

      rawParts = [
        {
          prompt: `Bir $x(t)$ yörüngesi $t = ${t0}$ anında $x(${t0}) = ${xPos}$ ve $t = -${t0}$ anında $x(-${t0}) = ${xNeg}$ değerlerini alıyor. Dönüştürülmüş yörüngelerin $t = ${t0}$ anındaki değerlerini $(Px)(${t0}),\\; (Tx)(${t0}),\\; (PTx)(${t0})$ sırasıyla yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: [-xPos, xNeg, -xNeg] },
          hints: [
            'Tanımları doğrudan yerine yazın: $(Px)(t) = -x(t)$, $(Tx)(t) = x(-t)$, $(PTx)(t) = -x(-t)$.',
            `$t = ${t0}$ için $-x(${t0}) = ${-xPos}$ ve $x(-${t0}) = ${xNeg}$.`,
          ],
          solution: [
            `$(Px)(${t0}) = -x(${t0}) = ${-xPos}$, $(Tx)(${t0}) = x(-${t0}) = ${xNeg}$, $(PTx)(${t0}) = -x(-${t0}) = ${-xNeg}$.`,
          ],
        },
        {
          prompt: `$m\\ddot{x} = ${force.tex}$ (${force.desc}) hareket denkleminin $\\{e, P, T, PT\\}$ içindeki tam simetri alt grubu hangisidir?`,
          kind: 'answer',
          answer: subChoice,
          hints: [
            'Üç testi sırayla uygulayın: $P$: $F(-x,-v)=-F(x,v)$, $T$: $F(x,-v)=F(x,v)$, $PT$: $F(-x,v)=-F(x,v)$.',
            force.breakWhy,
          ],
          solution: [
            `$P$ testi ($F(-x,-v)=-F(x,v)$): ${sym.hasP ? 'sağlanır' : 'bozulur'}.`,
            `$T$ testi ($F(x,-v)=F(x,v)$): ${sym.hasT ? 'sağlanır' : 'bozulur'}.`,
            `$PT$ testi ($F(-x,v)=-F(x,v)$): ${sym.hasPT ? 'sağlanır' : 'bozulur'}.`,
            `Simetri alt grubu: **${sym.label}**.`,
          ],
        },
        {
          prompt: `Bu kuvvet yasasında hangi fiziksel özellik $P$ veya $T$ simetrisini kırar?`,
          kind: 'answer',
          answer: breakChoice,
          hints: [
            'Tercihli yönler $P$' + "'yi, enerji tüketen tek-hızlı sürtünme terimleri $T$'yi kırar.",
          ],
          solution: [force.breakWhy],
        },
        {
          prompt: '**Kanıt:** $m\\ddot{x}(t) = F(x(t), \\dot{x}(t))$ denkleminin $P$, $T$ ve $PT$ altında değişmez kalma koşullarının sırasıyla $F(-x, -v) = -F(x, v)$, $F(x, -v) = F(x, v)$ ve $F(-x, v) = -F(x, v)$ olduğunu türev ve zincir kuralıyla kanıtlayın.',
          kind: 'proof',
          hints: [
            '$y(t) = -x(t)$, $z(t) = x(-t)$ ve $w(t) = -x(-t)$ fonksiyonlarının birinci ve ikinci türevlerini hesaplayıp $m\\ddot{q} = F(q, \\dot{q})$ denklemine yerleştirin.',
          ],
          solution: [
            '**Parite ($P$):** $y(t) = -x(t) \\implies \\dot{y} = -\\dot{x},\\; \\ddot{y} = -\\ddot{x}$. $m\\ddot{y} = -m\\ddot{x} = -F(x, \\dot{x})$ ifadesinin $F(y, \\dot{y}) = F(-x, -\\dot{x})$ ile özdeş olması için $F(-x, -v) = -F(x, v)$.',
            '**Zaman tersinmesi ($T$):** $z(t) = x(-t)$ ve $s = -t$ ile zincir kuralından $\\dot{z}(t) = -\\dot{x}(s)$ ve $\\ddot{z}(t) = +\\ddot{x}(s)$. $m\\ddot{z}(t) = m\\ddot{x}(s) = F(x(s), \\dot{x}(s))$ ifadesi $F(z(t), \\dot{z}(t)) = F(x(s), -\\dot{x}(s))$ olmalıdır: $F(x, -v) = F(x, v)$.',
            '**Birleşik $PT$:** $w(t) = -x(-t)$ için $\\dot{w}(t) = +\\dot{x}(s)$ ve $\\ddot{w}(t) = -\\ddot{x}(s)$. $m\\ddot{w}(t) = -F(x(s), \\dot{x}(s)) = F(-x(s), \\dot{x}(s))$, yani $F(-x, v) = -F(x, v)$.',
          ],
          checklist: [
            '$(Px)\'\' = -x\'\'$ ile $F(-x, -v) = -F(x, v)$ türetildi.',
            'Zincir kuralıyla $(Tx)\'(t) = -x\'(-t)$ ve $(Tx)\'\'(t) = +x\'\'(-t)$ bulunarak $F(x, -v) = F(x, v)$ türetildi.',
            '$(PTx)\'(t) = +x\'(-t)$ ve $(PTx)\'\'(t) = -x\'\'(-t)$ üzerinden $F(-x, v) = -F(x, v)$ türetildi.',
          ],
        },
      ];
    } else {
      // zorlayici: single force + superposition of two forces
      const subChoice = shuffleChoice(rng, sym.label, SUBGROUP_V4_LABELS.filter((_, i) => i !== sym.subIdx));
      const partnerPool = ['damped-osc', 'gravity', 'v2-force', 'pt-gain-loss', 'hooke'].filter(id => id !== force.id);
      const force2 = buildForceEntry(rng, rng.pick(partnerPool));
      const sym2 = analyzeForceSym(force2.fn);
      const combSym = analyzeForceSym((x, v) => force.fn(x, v) + force2.fn(x, v));

      const physBreakChoice = shuffleChoice(
        rng,
        'Uzayda tercihli bir yön (sabit yerçekimi, dış elektrik alan) $P$' + "'yi; tek dereceli sürtünme/sönüm kuvvetleri $T$'yi kırar",
        [
          'Sürtünme kuvveti $P$' + "'yi kırar, sabit yerçekimi $T$'yi kırar",
          'Karesel hız terimi $\\beta\\dot{x}^2$ hem $P$' + "'yi hem $T$'yi kırar",
          'Doğrusal yay kuvveti $-kx$ pariteyi kırar ama zaman tersinmesini korur',
        ]
      );

      rawParts = [
        {
          prompt: `$F_1(x, \\dot{x}) = ${force.tex}$ (${force.desc}) için $m\\ddot{x} = F_1(x, \\dot{x})$ denkleminin tam simetri alt grubu $S_1 \\le \\{e, P, T, PT\\}$ hangisidir?`,
          kind: 'answer',
          answer: subChoice,
          hints: [
            '$P: F(-x,-v)=-F(x,v)$, $T: F(x,-v)=F(x,v)$, $PT: F(-x,v)=-F(x,v)$ koşullarını ayrı ayrı test edin.',
          ],
          solution: [
            `${force.breakWhy} Simetri alt grubu: **${sym.label}**.`,
          ],
        },
        {
          prompt: `Sisteme ikinci bir etkileşim $F_2(x, \\dot{x}) = ${force2.tex}$ (${force2.desc}) eklendiğinde, toplam kuvvet $F_{\\text{top}} = F_1 + F_2$ için hareket denkleminin simetri alt grubu $S_{\\text{top}}$ kaç elemanlı olur?`,
          kind: 'answer',
          answer: { type: 'int', value: combSym.order },
          hints: [
            'Terimler birbirini sadeleştirmediğinde $F_1 + F_2$ toplamının simetrileri, her iki terimin ortak simetrileri ($S_1 \\cap S_2$) olur.',
          ],
          solution: [
            `$S_1 = ${sym.label}$ ve $S_2 = ${sym2.label}$.`,
            `$F_{\\text{top}} = F_1 + F_2$ için $P, T, PT$ test edildiğinde simetri alt grubu ${combSym.label} çıkar: eleman sayısı **$${combSym.order}$**.`,
          ],
        },
        {
          prompt: `Klasik mekanikte $P$ ve $T$ simetrilerinin kırılmasına ilişkin aşağıdaki genellemelerden hangisi doğrudur?`,
          kind: 'answer',
          answer: physBreakChoice,
          hints: [
            'Sabit dış alan/yerçekimi $+x$ ile $-x$ arasında ayrım yapar; sürtünme ise zamanı ileri-geri yönünde asimetrik kılar.',
          ],
          solution: [
            'Sabit yerçekimi veya elektrik alanı tercihli yön seçerek pariteyi ($P$) kırar; sürtünme/sönüm ise hızın tek kuvvetini içerdiğinden zaman tersinmesini ($T$) kırar.',
          ],
        },
        {
          prompt: '**Kanıt:** (i) $\\{e, P, T, PT\\}$ kümesinin fonksiyon bileşkesi altında $\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ grubuna izomorfik olduğunu ($P^2 = T^2 = e$, $PT = TP$) kanıtlayın; (ii) $P$ ve $T$' + "'yi ayrı ayrı bozup $PT$'yi koruyan $F(x, \\dot{x}) = -kx - \\alpha x\\dot{x}$ kuvvetinde $PT$ simetrisinin fiziksel anlamını (kazanç-kayıp dengesi) gösterin.",
          kind: 'proof',
          hints: [
            'Her $x(t)$ fonksiyonu üzerinde $(P(Tx))(t) = -x(-t) = (T(Px))(t)$ olduğunu doğrulayın; sonra $F(-x, v) = -F(x, v)$ koşulunu $-kx - \\alpha x\\dot{x}$ için kontrol edin.',
          ],
          solution: [
            '**(i) Grup yapısı:** $(P^2 x)(t) = -(-x(t)) = x(t)$ ve $(T^2 x)(t) = x(-(-t)) = x(t)$ olduğundan $P^2 = T^2 = e$. Ayrıca $(P(Tx))(t) = -(Tx)(t) = -x(-t)$ ve $(T(Px))(t) = (Px)(-t) = -x(-t)$ olduğundan $PT = TP$. Dört eleman farklı ve birim dışı üç elemanın mertebesi $2$ olduğundan $\\{e, P, T, PT\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.',
            '**(ii) $PT$-simetrik kuvvet:** $F(x, v) = -kx - \\alpha xv$ için $F(-x, -v) = kx - \\alpha xv \\neq -F$ ($P$ bozuk), $F(x, -v) = -kx + \\alpha xv \\neq F$ ($T$ bozuk), ama $F(-x, v) = kx + \\alpha xv = -F(x, v)$ ($PT$ korunur). $x > 0$ yarı-uzayında $-\\alpha x\\dot{x}$ sönüm (enerji kaybı), $x < 0$ yarı-uzayında ise itki (enerji kazancı) oluşturur; ayna yansıması ($P$) kayıp ile kazancı takas eder, zaman tersinmesi ($T$) ise bunu geri çevirir.',
          ],
          checklist: [
            '$P^2 = e$, $T^2 = e$ ve $PT = TP$ doğrudan yörünge tanımıyla kanıtlandı.',
            '$\\{e, P, T, PT\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ izomorfizması kuruldu.',
            '$-kx - \\alpha x\\dot{x}$ kuvvetinin $P$ ve $T$' + "'yi bozup $PT$'yi koruduğu (kazanç-kayıp dengesi) gösterildi.",
          ],
        },
      ];
    }

    return {
      title: `Yörünge Simetrileri ($P, T, PT$): ${force.desc}`,
      story: `Tek boyutta $m\\ddot{x}(t) = F(x(t), \\dot{x}(t))$ hareket denkleminin çözümlerine etki eden parite $(Px)(t) = -x(t)$ ve zaman tersinmesi $(Tx)(t) = x(-t)$ dönüşümleri $V_4 = \\{e, P, T, PT\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ grubunu oluşturur. İncelenen fiziksel sistemde kuvvet yasası $F(x, \\dot{x}) = ${force.tex}$ (${force.desc}) olarak veriliyor.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 4. ps2-dn-eslenik-siniflar — Conjugacy classes of D_n (benzene & ring molecules)
// =====================================================================

const REFL_CLASS_OPTS = [
  'Yalnızca iki karşılıklı köşeden (atom/C–H bağından) geçen yansımalar ($r^{\\text{çift}} s$)',
  'Yalnızca iki karşılıklı kenar orta noktasından (C–C bağ ortasından) geçen yansımalar ($r^{\\text{tek}} s$)',
  'Düzgün çokgendeki tüm $n$ yansıma tek bir eşlenik sınıfında toplanır',
  'Yalnızca tek bir yansıma (sınıf boyutu $1$)',
];

const T_DN_ESLENIK_SINIFLAR = {
  id: 'ps2-dn-eslenik-siniflar',
  topic: '$D_n$ Eşlenik Sınıfları',
  title: '$D_n$ Eşlenik Sınıfları ve Halka Moleküllerin Ayna Düzlemleri',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [3, 4, 5, 6, 6]
      : level === 'odev' ? [4, 5, 6, 6, 7, 8]
      : [6, 7, 8, 9, 10, 12];
    const n = rng.pick(nPool);
    const isEven = n % 2 === 0;

    // Molecule story tailored to n
    let molStory, model;
    if (n === 6) {
      molStory = `Benzen molekülünün ($\\mathrm{C_6H_6}$) düzlemsel altıgen halkası $D_6$ simetri grubuna sahiptir: $1..6$ karbon atomları köşelerde yer alır, çift indisli $r^{2t}s$ yansımaları karşılıklı iki $\\mathrm{C{-}H}$ bağından (köşelerden), tek indisli $r^{2t+1}s$ yansımaları ise karşılıklı iki $\\mathrm{C{-}C}$ bağının orta noktasından (kenarlardan) geçer.`;
      model = { id: 'molecule', params: { name: 'C6H6' } };
    } else if (n === 3) {
      molStory = `Bor triflorür ($\\mathrm{BF_3}$) molekülü düzlemsel eşkenar üçgen geometrisiyle $D_3$ simetri grubuna sahiptir; üç $\\mathrm{B{-}F}$ bağının her birinden bir ayna ekseni geçer.`;
      model = { id: 'molecule', params: { name: 'BF3' } };
    } else {
      molStory = `Düzgün $${n}$-gen halka biçimli bir düzlemsel molekülün simetri grubu $D_{${n}}$ ($|D_{${n}}| = ${2 * n}$) olup ders konvansiyonuna göre eşlenik alma $g^{-1} a g$ ve eşlenik sınıfı $\\operatorname{Cl}(a) = \\{g^{-1} a g : g \\in D_{${n}}\\}$ biçiminde tanımlanır.`;
      model = { id: 'polygon', params: { n } };
    }

    const classes = dAllConjClasses(n);
    const classSizes = classes.map(c => c.length).sort((a, b) => a - b);
    const numClasses = classes.length;

    const kRef = rng.int(0, n - 1);
    const aRef = dEl(n, kRef, 1);
    const jConj = rng.int(1, n - 1);
    const gIsRefl = level !== 'isinma' && rng.int(0, 2) === 0;
    const gConj = gIsRefl ? dEl(n, 0, 1) : dEl(n, jConj, 0);
    const conjVal = dConj(n, gConj, aRef);
    const clRef = dConjClass(n, aRef);

    let rawParts;
    if (level === 'isinma') {
      rawParts = [
        {
          prompt: `$D_{${n}}$ grubunda $a = ${dTex(aRef)}$ yansımasının $g = ${dTex(gConj)}$ ile eşleniğini ($g^{-1} a g$) normal biçimde ($r^k s^m$) hesaplayın.`,
          kind: 'answer',
          answer: { type: 'dihedral', n, value: conjVal },
          hints: [
            `Ders formülünü kullanın: $r^{-j} (r^k s) r^j = r^{k - 2j} s$ ($s r^j = r^{-j} s$ kuralından).`,
            `$k = ${kRef}$ ve $j = ${jConj}$ için $k - 2j = ${kRef} - ${2 * jConj} = ${kRef - 2 * jConj} \\equiv ${conjVal.k} \\pmod{${n}}$.`,
            `Sonuç: $${dTex(conjVal)}$.`,
          ],
          solution: [
            `$r^{-${jConj}} (${dTex(aRef)}) r^{${jConj}} = r^{${kRef} - ${jConj}} (s r^{${jConj}}) = r^{${kRef} - ${2 * jConj}} s = ${dTex(conjVal)}$ (mod $${n}$).`,
          ],
        },
        {
          prompt: `$D_{${n}}$ içinde $a = ${dTex(aRef)}$ elemanının tüm eşlenik sınıfı $\\operatorname{Cl}(${dTex(aRef)})$ kümesini normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: clRef },
          hints: [
            `$r^{-j}(r^k s)r^j = r^{k - 2j} s$ formülünde $j = 0, 1, \\dots, ${n - 1}$ değerlerini deneyin.`,
            isEven
              ? `$n = ${n}$ çift olduğundan $k - 2j$ üssü daima $k = ${kRef}$ ile aynı tek/çift paritede kalır (toplam $${n / 2}$ yansıma).`
              : `$n = ${n}$ tek olduğundan $2j$ mod $${n}$ tüm kalıntıları tarar ve tüm $${n}$ yansıma aynı sınıfa girer.`,
            `Küme: $${dSetTex(clRef)}$.`,
          ],
          solution: [
            `$r^{-j}(${dTex(aRef)})r^j = r^{${kRef} - 2j} s$ ve $s^{-1}(${dTex(aRef)})s = r^{${mod(-kRef, n)}} s$ aynı kümede kalır.`,
            `$\\operatorname{Cl}(${dTex(aRef)}) = ${dSetTex(clRef)}$ (boyut $${clRef.length}$).`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun toplam kaç tane **eşlenik sınıfı** vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: numClasses },
          hints: [
            `Dönmelerin sınıfları $\\operatorname{Cl}(r^k) = \\{r^k, r^{-k}\\}$ biçimindedir ($\\{e\\}$ ve $n$ çiftse $\\{r^{n/2}\\}$ tek elemanlıdır).`,
            isEven
              ? `$n = ${n}$ çift olduğundan dönmeler $${n / 2 + 1}$ sınıf ($1 + 1 + ${n / 2 - 1}$), yansımalar ise $2$ ayrı sınıf oluşturur.`
              : `$n = ${n}$ tek olduğundan dönmeler $${(n + 1) / 2}$ sınıf ($1 + ${(n - 1) / 2}$), yansımalar ise $1$ sınıf oluşturur.`,
            `Toplam: $${numClasses}$ sınıf (boyutları toplamı $${classSizes.join(' + ')} = ${2 * n}$).`,
          ],
          solution: [
            `Eşlenik sınıf boyutları (küçükten büyüğe): $${classSizes.join(', ')}$ (toplam $${2 * n}$).`,
            `Toplam eşlenik sınıfı sayısı: **$${numClasses}$**.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      const geomIdx = !isEven ? 2 : (kRef % 2 === 0 ? 0 : 1);
      const geomChoice = shuffleChoice(rng, REFL_CLASS_OPTS[geomIdx], REFL_CLASS_OPTS.filter((_, i) => i !== geomIdx));
      rawParts = [
        {
          prompt: `$D_{${n}}$ içinde $a = ${dTex(aRef)}$ yansımasının $g = ${dTex(gConj)}$ ile eşleniğini ($g^{-1} a g$) normal biçimde bulun.`,
          kind: 'answer',
          answer: { type: 'dihedral', n, value: conjVal },
          hints: [
            gIsRefl
              ? '$s^{-1} (r^k s) s = s r^k s^2 = s r^k = r^{-k} s$ formülünü uygulayın.'
              : `$r^{-j}(r^k s)r^j = r^{k - 2j} s$ formülünde $k = ${kRef},\\; j = ${jConj}$ koyun.`,
            `Mod $${n}$ indirgeme sonucu $${dTex(conjVal)}$.`,
          ],
          solution: [
            gIsRefl
              ? `$s^{-1}(${dTex(aRef)})s = s r^{${kRef}} s^2 = r^{-${kRef}} s = ${dTex(conjVal)}$.`
              : `$r^{-${jConj}}(${dTex(aRef)})r^{${jConj}} = r^{${kRef} - 2\\cdot ${jConj}} s = ${dTex(conjVal)}$.`,
          ],
        },
        {
          prompt: `$\\operatorname{Cl}(${dTex(aRef)})$ eşlenik sınıfının tüm elemanlarını normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: clRef },
          hints: [
            `$r^{-j}(r^k s)r^j = r^{k-2j} s$ bağıntısının $j$ değiştikçe hangi üsleri ürettiğine bakın.`,
            isEven ? `$n = ${n}$ çift olduğundan parite korunur: $${n / 2}$ eleman.` : `$n = ${n}$ tek olduğundan tüm $${n}$ yansıma elde edilir.`,
          ],
          solution: [
            `$\\operatorname{Cl}(${dTex(aRef)}) = ${dSetTex(clRef)}$ (boyut $${clRef.length}$).`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun tüm eşlenik sınıflarının boyutlarını **küçükten büyüğe sıralı** olarak yazın (virgülle ayırın; toplamları $|D_{${n}}| = ${2 * n}$ etmelidir).`,
          kind: 'answer',
          answer: { type: 'intlist', value: classSizes },
          hints: [
            `Her dönme $r^k$ için $\\operatorname{Cl}(r^k) = \\{r^k, r^{-k}\\}$ ($r^k = r^{-k}$ ise boyut $1$, değilse $2$).`,
            isEven
              ? `$n = ${n}$ çift: iki adet $1$'lik sınıf ($e$ ve $r^{${n / 2}}$), $${n / 2 - 1}$ adet $2$'lik dönme sınıfı ve iki adet $${n / 2}$'lik yansıma sınıfı.`
              : `$n = ${n}$ tek: bir adet $1$'lik sınıf ($e$), $${(n - 1) / 2}$ adet $2$'lik dönme sınıfı ve bir adet $${n}$'lik yansıma sınıfı.`,
          ],
          solution: [
            `Sınıf denklemi: $${2 * n} = ${classSizes.join(' + ')}$.`,
            `Küçükten büyüğe sıralı boyutlar: **$${classSizes.join(', ')}$** (toplam $${numClasses}$ sınıf).`,
          ],
        },
        {
          prompt: `Geometrik olarak $\\operatorname{Cl}(${dTex(aRef)})$ eşlenik sınıfı hangi ayna düzlemlerini bir araya getirir?`,
          kind: 'answer',
          answer: geomChoice,
          hints: [
            isEven
              ? `Çift $n$'de köşelerden geçen eksenler ($r^{\\text{çift}} s$) ile kenar orta noktalarından geçen eksenler ($r^{\\text{tek}} s$) herhangi bir simetriyle birbirine dönüştürülemez.`
              : `Tek $n$'de her yansıma ekseni $1$ köşe ve karşı kenar ortasından geçer; tümü dönmelerle birbirine taşınır.`,
          ],
          solution: [
            `Doğru geometrik sınıf: **${REFL_CLASS_OPTS[geomIdx]}**.`,
          ],
        },
      ];
    } else {
      // zorlayici: larger n, class counts, class equation, centralizer size, full proof
      const pickRot = rng.int(0, 1) === 1;
      const sampleEl = pickRot ? dEl(n, rng.int(1, Math.floor((n - 1) / 2)), 0) : aRef;
      const sampleCls = dConjClass(n, sampleEl);
      const centSize = (2 * n) / sampleCls.length;

      rawParts = [
        {
          prompt: `$D_{${n}}$ ($|D_{${n}}| = ${2 * n}$) grubunun toplam kaç tane eşlenik sınıfı vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: numClasses },
          hints: [
            isEven ? 'Çift $n$ için sınıf sayısı $n/2 + 3$ olur.' : 'Tek $n$ için sınıf sayısı $(n + 3)/2$ olur.',
          ],
          solution: [
            isEven
              ? `$n = ${n}$ çift: $1$ ($e$) + $1$ ($r^{${n / 2}}$) + $${n / 2 - 1}$ (dönme çiftleri) + $2$ (yansıma sınıfları) = **$${numClasses}$** sınıf.`
              : `$n = ${n}$ tek: $1$ ($e$) + $${(n - 1) / 2}$ (dönme çiftleri) + $1$ (tüm yansımalar) = **$${numClasses}$** sınıf.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun sınıf denklemini veren eşlenik sınıfı boyutlarını **küçükten büyüğe sıralı** yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: classSizes },
          hints: [
            'Merkez elemanları boyut $1$, diğer dönmeler $\\{r^k, r^{-k}\\}$ boyut $2$, yansımalar ise $n$ çiftken $n/2, n/2$, tekken $n$ verir.',
          ],
          solution: [
            `Sınıf boyutları: **$${classSizes.join(', ')}$** (toplam $${classSizes.join(' + ')} = ${2 * n}$).`,
          ],
        },
        {
          prompt: `Yörünge-sabitleyici (merkezleyici) bağıntısını kullanarak $a = ${dTex(sampleEl)} \\in D_{${n}}$ elemanının merkezleyicisinin mertebesini $|C_{D_{${n}}}(${dTex(sampleEl)})|$ bulun.`,
          kind: 'answer',
          answer: { type: 'int', value: centSize },
          hints: [
            '$|\\operatorname{Cl}(a)| = |G| / |C_G(a)|$ olduğundan $|C_G(a)| = |D_n| / |\\operatorname{Cl}(a)|$.',
          ],
          solution: [
            `$|\\operatorname{Cl}(${dTex(sampleEl)})| = ${sampleCls.length}$ olduğundan $|C_{D_{${n}}}(${dTex(sampleEl)})| = \\frac{${2 * n}}{${sampleCls.length}} = ${centSize}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $D_n$ grubunda $r^{-j}(r^k s)r^j = r^{k - 2j} s$ ve $s^{-1}(r^k s)s = r^{-k} s$ eşlenik formüllerini türetin; buradan $n$ çiftken yansımaların neden $n/2$ elemanlı iki ayrı sınıfa (köşe-köşe ve kenar-kenar eksenleri), $n$ tekken tek bir $n$ elemanlı sınıfa ayrıldığını ve tüm sınıf boyutları toplamının $2n$ ettiğini kanıtlayın.',
          kind: 'proof',
          hints: [
            '$s r^j = r^{-j} s$ bağıntısını uygulayın; $k - 2j \\bmod n$ değerlerinin $n$ tek/çift durumundaki görüntü kümesini inceleyin.',
          ],
          solution: [
            '**Formüller:** $r^{-j}(r^k s)r^j = r^{k-j}(s r^j) = r^{k-j}(r^{-j}s) = r^{k-2j}s$. Yansıma için $s^{-1}(r^k s)s = s r^k s^2 = s r^k = r^{-k} s$. (Genel $g = r^j s$ için $(r^j s)^{-1}(r^k s)(r^j s) = s r^{-j} r^k s r^j s = s r^{k-2j} s = r^{2j-k} s$, aynı pariteyi korur.)',
            '**Tek $n$:** $\\gcd(2, n) = 1$ olduğundan $j = 0, \\dots, n-1$ için $k - 2j \\bmod n$ tüm $n$ kalıntıyı üretir: tek bir $n$-elemanlı yansıma sınıfı. Toplam boyut: $1 + 2 \\cdot \\frac{n-1}{2} + n = 2n$.',
            '**Çift $n$:** $k - 2j \\equiv k \\pmod 2$ olduğundan çift $k$ (iki köşeden geçen $n/2$ yansıma) ile tek $k$ (iki kenar ortasından geçen $n/2$ yansıma) asla birbirine eşlenik değildir. Toplam boyut: $1 + 1 + 2(\\frac{n}{2} - 1) + \\frac{n}{2} + \\frac{n}{2} = 2n$.',
          ],
          checklist: [
            '$r^{-j}(r^k s)r^j = r^{k - 2j} s$ ve $s^{-1}(r^k s)s = r^{-k} s$ bağıntıları $s r^j = r^{-j} s$ kullanılarak türetildi.',
            '$n$ çift iken $k \\bmod 2$ değişmezliğinden iki ayrı $n/2$-elemanlı yansıma sınıfı, $n$ tek iken tek $n$-elemanlı sınıf olduğu kanıtlandı.',
            'Dönme sınıflarıyla birlikte sınıf boyutları toplamının her iki durumda da $2n$ olduğu doğrulandı.',
          ],
        },
      ];
    }

    return {
      title: `$D_{${n}}$ Eşlenik Sınıfları${n === 6 ? ' (Benzen $\\mathrm{C_6H_6}$)' : n === 3 ? ' ($\\mathrm{BF_3}$)' : ''}`,
      story: molStory,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 5. ps2-dn-normal-ve-carpim — Normal subgroups of D_n & D_n ≅ D_(n/2) × Z_2
// =====================================================================

const T_DN_NORMAL_CARPIM = {
  id: 'ps2-dn-normal-ve-carpim',
  topic: 'Normal Alt Gruplar',
  title: '$D_n$ Normal Alt Grupları ve $D_n \\cong D_{n/2} \\times \\mathbb{Z}_2$ Ayrışımı',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const n = rng.pick([3, 4, 5, 6, 8]);
      const isEven = n % 2 === 0;
      const witness = dConj(n, dEl(n, 1, 0), dEl(n, 0, 1)); // r^-1 s r = r^-2 s
      const normSubTex = isEven ? `Z = \\langle r^{${n / 2}} \\rangle = \\{e, r^{${n / 2}}\\} ` : `R = \\langle r \\rangle`;
      const model = { id: 'sublattice', params: { kind: 'D', n } };

      return {
        title: `$D_{${n}}$ Grubunda Normal ve Normal Olmayan Alt Gruplar`,
        story: `Bir $D_{${n}}$ simetri grubunda bir $N$ alt grubunun normal ($N \\trianglelefteq D_{${n}}$) olması, her $g \\in D_{${n}}$ ve $h \\in N$ için $g^{-1} h g \\in N$ koşuluna — yani $N$'nin tam eşlenik sınıflarının birleşimi olmasına — denktir.`,
        model,
        parts: makeLabels([
          {
            prompt: `$D_{${n}}$ içinde $${normSubTex}$ alt grubu **normal** midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: true },
            hints: [
              isEven
                ? `$r^{${n / 2}}$ elemanı $D_{${n}}$'nin tüm elemanlarıyla değişmelidir (merkezdedir), bu yüzden her eşleniği kendisine eşittir.`
                : '$\\langle r \\rangle$ alt grubunun indeksi $[D_n : \\langle r \\rangle] = 2$ olup her dönmenin eşleniği yine bir dönmedir.',
              'Her $g \\in D_n$ için $g^{-1} N g = N$ sağlanır.',
            ],
            solution: [
              isEven
                ? `$r^{${n / 2}} \\in Z(D_{${n}})$ olduğundan her $g$ için $g^{-1} r^{${n / 2}} g = r^{${n / 2}} \\in Z$, dolayısıyla $Z \\trianglelefteq D_{${n}}$ (**Evet**).`
                : `$\\langle r \\rangle$ tüm dönmeleri içerir ($[D_{${n}}:\\langle r \\rangle] = 2$); $g^{-1} r^k g = r^{\\pm k} \\in \\langle r \\rangle$ olduğundan normaldir (**Evet**).`,
            ],
          },
          {
            prompt: `$H = \\langle s \\rangle = \\{e, s\\}$ yansıma alt grubu $D_{${n}}$ içinde **normal** midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: false },
            hints: [
              '$s$ yansımasının $r$ ile eşleniğini ($r^{-1} s r$) hesaplayıp $\\{e, s\\}$ içinde kalıp kalmadığına bakın.',
              `$r^{-1} s r = r^{-2} s = ${dTex(witness)}$.`,
              `$n = ${n} \\ge 3$ olduğundan $${dTex(witness)} \\neq s$, yani kümeden dışarı çıkar!`,
            ],
            solution: [
              `$r^{-1} s r = ${dTex(witness)} \\notin \\{e, s\\}$ ($n = ${n} \\ge 3$) olduğundan $\\langle s \\rangle$ normal değildir (**Hayır**).`,
            ],
          },
          {
            prompt: `$\\langle s \\rangle$ alt grubunun normal olmadığını gösteren $r^{-1} s r$ eşleniğini normal biçimde ($r^k s^m$) yazın.`,
            kind: 'answer',
            answer: { type: 'dihedral', n, value: witness },
            hints: [
              '$r^{-1} s r = r^{-1}(s r) = r^{-1}(r^{-1} s) = r^{-2} s$.',
              `$-2 \\equiv ${mod(-2, n)} \\pmod{${n}}$ olduğundan cevap $${dTex(witness)}$.`,
            ],
            solution: [
              `$r^{-1} s r = r^{-1} r^{-1} s = r^{-2} s = ${dTex(witness)}$ (mod $${n}$).`,
            ],
          },
        ]),
      };
    }

    // odev & zorlayici: focus on normal subgroup classification and D_n ≅ D_(n/2) × Z_2 when n/2 is odd (n = 6, 10, 14) vs even (4, 8, 12)
    const evenPool = level === 'odev' ? [4, 6, 6, 8, 10, 10, 12, 14] : [6, 8, 10, 12, 14];
    const n = rng.pick(evenPool);
    const half = n / 2;
    const halfOdd = half % 2 === 1;
    const normalCount = divisors(n).length + 3; // tau(n) rotation subgroups + 2 D_{n/2} subgroups + D_n
    const interOrder = halfOdd ? 1 : 2;
    const maxProdOrd = lcm(half, 2); // n if halfOdd, n/2 if half even
    const model = { id: 'sublattice', params: { kind: 'D', n } };

    if (level === 'odev') {
      return {
        title: `$D_{${n}}$ Normal Alt Grupları ve $D_{${half}} \\times \\mathbb{Z}_2$ Testi`,
        story: `Çift $n = ${n}$ için $D_{${n}}$ grubunda dönme alt grupları $\\langle r^d \\rangle$ ($d \\mid ${n}$), merkezi alt grup $Z = \\langle r^{${half}} \\rangle \\cong \\mathbb{Z}_2$ ve iki indeks-$2$ alt grubu $H_{\\text{çift}} = \\langle r^2, s \\rangle \\cong D_{${half}}$, $H_{\\text{tek}} = \\langle r^2, rs \\rangle \\cong D_{${half}}$ normaldir. Bu ayrışımın $D_{${n}}$'yi bir direkt çarpıma bölüp bölmediğini inceleyelim.`,
        model,
        parts: makeLabels([
          {
            prompt: `$D_{${n}}$ grubunun toplam kaç tane **normal** alt grubu vardır? ($\\{e\\}$ ve $D_{${n}}$ dahil.)`,
            kind: 'answer',
            answer: { type: 'int', value: normalCount },
            hints: [
              `Tüm saf dönme alt grupları ($\\tau(${n}) = ${divisors(n).length}$ adet) normaldir.`,
              `Çift $n$'de yansıma içeren öz normal alt gruplar yalnızca iki $D_{${half}}$ tipindeki alt grup ($\\langle r^2, s \\rangle$ ve $\\langle r^2, rs \\rangle$) ile $D_{${n}}$'nin kendisidir (+3).`,
            ],
            solution: [
              `Dönme alt grupları: $${n}$ bölenleri $${intSetTex(divisors(n))}$ için $\\tau(${n}) = ${divisors(n).length}$ normal alt grup.`,
              `Yansıma içeren normal alt gruplar: $\\langle r^2, s \\rangle$, $\\langle r^2, rs \\rangle$ ve $D_{${n}}$ ($3$ adet).`,
              `Toplam normal alt grup sayısı: $${divisors(n).length} + 3 = ${normalCount}$.`,
            ],
          },
          {
            prompt: `$H = \\langle r^2, s \\rangle \\cong D_{${half}}$ ve merkez $Z = \\langle r^{${half}} \\rangle = \\{e, r^{${half}}\\}$ alt gruplarının kesişiminin mertebesi $|H \\cap Z|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: interOrder },
            hints: [
              `$H$ içindeki dönmeler $r$'nin yalnızca **çift** kuvvetleridir ($r^0, r^2, r^4, \\dots$).`,
              `$r^{${half}}$ elemanının üssü $n/2 = ${half}$ tek mi yoksa çift mi?`,
            ],
            solution: [
              halfOdd
                ? `$n/2 = ${half}$ **tek** olduğundan $r^{${half}} \\notin \\langle r^2 \\rangle$, dolayısıyla $H \\cap Z = \\{e\\}$ ve $|H \\cap Z| = 1$.`
                : `$n/2 = ${half}$ **çift** olduğundan $r^{${half}} \\in \\langle r^2 \\rangle \\subset H$, dolayısıyla $H \\cap Z = Z = \\{e, r^{${half}}\\}$ ve $|H \\cap Z| = 2$.`,
            ],
          },
          {
            prompt: `$D_{${n}} \\cong D_{${half}} \\times \\mathbb{Z}_2$ izomorfizması doğru mudur?`,
            kind: 'answer',
            answer: { type: 'yesno', value: halfOdd },
            hints: [
              halfOdd
                ? `$H, Z \\trianglelefteq D_{${n}}$, $H \\cap Z = \\{e\\}$ ve $|H|\\cdot|Z| = ${n} \\cdot 2 = ${2 * n} = |D_{${n}}|$ iç direkt çarpım teoremini sağlar!`
                : `$D_{${n}}$ içinde $r$ elemanının mertebesi $${n}$'dir; oysa $D_{${half}} \\times \\mathbb{Z}_2$ içinde en büyük eleman mertebesi $\\operatorname{ekok}(${half}, 2) = ${maxProdOrd} < ${n}$ kalır!`,
            ],
            solution: [
              halfOdd
                ? `$n/2 = ${half}$ tek olduğundan $H \\cap Z = \\{e\\}$ ve $HZ = D_{${n}}$: **Evet**, $D_{${n}} \\cong D_{${half}} \\times \\mathbb{Z}_2$.`
                : `$n/2 = ${half}$ çift olduğundan $D_{${half}} \\times \\mathbb{Z}_2$ grubunda en büyük eleman mertebesi $\\operatorname{ekok}(${half}, 2) = ${half} < ${n}$ iken $D_{${n}}$ içinde $|r| = ${n}$ vardır: **Hayır**, izomorfik değildir.`,
            ],
          },
          {
            prompt: '**Kanıt:** $n$ çift ve $n/2$ **tek** olduğunda ($n = 6, 10, 14, \\dots$) $H = \\langle r^2, s \\rangle \\cong D_{n/2}$ ve $Z = \\langle r^{n/2} \\rangle \\cong \\mathbb{Z}_2$ alt gruplarını kullanarak $D_n \\cong D_{n/2} \\times \\mathbb{Z}_2$ olduğunu kanıtlayın.',
            kind: 'proof',
            hints: [
              'İç direkt çarpım ölçütünü doğrulayın: $H \\trianglelefteq D_n$, $Z \\trianglelefteq D_n$, $H \\cap Z = \\{e\\}$ ve $|H||Z| = |D_n|$ (veya açık $\\varphi(h, z) = hz$ izomorfizmasını kurun).',
            ],
            solution: [
              '**Normallik:** $[D_n : H] = 2$ olduğundan $H \\trianglelefteq D_n$. $r^{n/2} \\in Z(D_n)$ (merkezde) olduğundan $Z = \\langle r^{n/2} \\rangle \\trianglelefteq D_n$ ve her $h \\in H, z \\in Z$ için $hz = zh$.',
              '**Ayrıklık:** $H$ içindeki dönmeler $r^{2t}$ (çift üs) biçimindedir; $n/2$ tek olduğundan $r^{n/2} \\notin H$, yani $H \\cap Z = \\{e\\}$.',
              '**İzomorfizma:** $\\varphi: H \\times Z \\to D_n$, $\\varphi(h, z) = hz$ tanımlayalım. $hz = zh$ olduğundan $\\varphi((h_1, z_1)(h_2, z_2)) = h_1 h_2 z_1 z_2 = (h_1 z_1)(h_2 z_2)$ homomorfizmadır. $hz = e \\implies h = z^{-1} \\in H \\cap Z = \\{e\\}$ (birebir) ve $|H \\times Z| = n \\cdot 2 = 2n = |D_n|$ (örten). Dolayısıyla $D_n \\cong H \\times Z \\cong D_{n/2} \\times \\mathbb{Z}_2$.',
            ],
            checklist: [
              '$H = \\langle r^2, s \\rangle \\trianglelefteq D_n$ (indeks $2$) ve $Z = \\langle r^{n/2} \\rangle \\le Z(D_n)$ (merkezde) gösterildi.',
              '$n/2$ tek olduğundan $H \\cap Z = \\{e\\}$ olduğu kanıtlandı.',
              '$\\varphi(h, z) = hz$ homomorfizmasının bijektifliği (veya iç direkt çarpım teoremi) ile $D_n \\cong D_{n/2} \\times \\mathbb{Z}_2$ tamamlandı.',
            ],
          },
        ]),
      };
    }

    // zorlayici
    return {
      title: `$D_{${n}}$ Normal Alt Grup Yapısı ve Direkt Çarpım Ayrışımı`,
      story: `Düzgün $${n}$-genin $D_{${n}}$ simetri grubunda normal alt grupların tamamını eşlenik sınıfları üzerinden sayalım ve $D_{${n}}$'nin $D_{${half}} \\times \\mathbb{Z}_2$ biçiminde ayrışıp ayrışmadığını cebirsel değişmezlerle sınayalım.`,
      model,
      parts: makeLabels([
        {
          prompt: `$D_{${n}}$ grubunun toplam kaç tane normal alt grubu vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: normalCount },
          hints: [`Çift $n$ için normal alt grup sayısı $\\tau(n) + 3$ olur.`],
          solution: [`$\\tau(${n}) + 3 = ${divisors(n).length} + 3 = ${normalCount}$.`],
        },
        {
          prompt: `$D_{${half}} \\times \\mathbb{Z}_2$ direkt çarpım grubunda bir elemanın ulaşabileceği **en büyük mertebe** kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxProdOrd },
          hints: [
            `$D_{${half}}$ içindeki elemanların mertebeleri $${half}$'in bölenleri ve $2$'dir; $\\mathbb{Z}_2$'de mertebeler $1, 2$ olduğundan en büyük EKOK $\\operatorname{ekok}(${half}, 2)$ olur.`,
          ],
          solution: [
            `$D_{${half}}$ içinde en büyük eleman mertebesi $${half}$ ($r$ dönmesi), $\\mathbb{Z}_2$ içinde $2$ olduğundan en büyük eleman mertebesi $\\operatorname{ekok}(${half}, 2) = ${maxProdOrd}$.`,
          ],
        },
        {
          prompt: `$D_{${n}} \\cong D_{${half}} \\times \\mathbb{Z}_2$ izomorfizması geçerli midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: halfOdd },
          hints: [
            `En büyük eleman mertebesi ($${maxProdOrd}$ ile $${n}$) ve $n/2 = ${half}$ sayısının tek/çiftliğini karşılaştırın.`,
          ],
          solution: [
            halfOdd
              ? `$n/2 = ${half}$ tek olduğundan $\\operatorname{ekok}(${half}, 2) = ${n}$ ve $\\langle r^2, s \\rangle \\times \\langle r^{${half}} \\rangle \\cong D_{${n}}$: **Evet**.`
              : `$n/2 = ${half}$ çift olduğundan $D_{${half}} \\times \\mathbb{Z}_2$ içinde mertebesi $${n}$ olan hiçbir eleman yoktur (en çok $${maxProdOrd}$): **Hayır**.`,
          ],
        },
        {
          prompt: '**Kanıt:** (i) Bir alt grubun normal olmasının eşlenik sınıflarının birleşimi olmasına denk olduğunu kullanarak çift $n$ için $D_n$' + "'nin yansıma içeren öz normal alt gruplarının yalnızca $\\langle r^2, s \\rangle$ ve $\\langle r^2, rs \\rangle$ olduğunu kanıtlayın; (ii) $4 \\mid n$ iken $D_n \\not\\cong D_{n/2} \\times \\mathbb{Z}_2$ olduğunu kanıtlayın.",
          kind: 'proof',
          hints: [
            '(i) için bir yansıma içeren normal alt grubun o yansımanın tüm eşlenik sınıfını (çift veya tek indisli tüm yansımaları) ve dolayısıyla onların çarpımları olan $\\langle r^2 \\rangle$ dönmelerini içermesi gerektiğini gösterin; (ii) için maksimum eleman mertebesini karşılaştırın.',
          ],
          solution: [
            '**(i) Normal alt gruplar:** $N \\trianglelefteq D_n$ bir $r^k s$ yansıması içeriyorsa tüm $\\operatorname{Cl}(r^k s) = \\{r^{k+2t}s\\}$ sınıfını içermelidir. Bu sınıftan iki yansımanın çarpımı $(r^{k+2a}s)(r^{k+2b}s) = r^{2(a-b)}$ tüm $\\langle r^2 \\rangle$ dönmelerini üretir. Dolayısıyla $N$ en azından $\\langle r^2, r^k s \\rangle$ ($n$ elemanlı) alt grubunu içerir. $[D_n : \\langle r^2, r^k s \\rangle] = 2$ olduğundan arada başka alt grup yoktur: ya $N = \\langle r^2, s \\rangle$ (çift $k$), ya $N = \\langle r^2, rs \\rangle$ (tek $k$), ya da ikisini birden içerip $N = D_n$ olur.',
            '**(ii) $4 \\mid n$ için izomorfik olmama:** $n = 4m$ olsun ($n/2 = 2m$ çift). $D_n$ içinde $|r| = 4m = n$ vardır. Buna karşılık $D_{2m} \\times \\mathbb{Z}_2$ içinde her $(g, a)$ elemanı için $|g| \\mid 2m$ (veya $|g| = 2 \\mid 2m$) ve $|a| \\mid 2 \\mid 2m$ olduğundan $|(g, a)| = \\operatorname{ekok}(|g|, |a|) \\mid 2m$, yani hiçbir elemanın mertebesi $2m = n/2$' + "'yi geçemez. Mertebesi $n$ olan eleman bulunmadığından $D_n \\not\\cong D_{n/2} \\times \\mathbb{Z}_2$.",
          ],
          checklist: [
            'Yansıma içeren normal alt grubun $\\operatorname{Cl}(r^k s)$ sınıfını ve yansıma çarpımlarıyla $\\langle r^2 \\rangle$' + "'yi içermesi gerektiği gösterildi.",
            'İndeks $2$ argümanıyla tek yansıma-içeren öz normal alt grupların $\\langle r^2, s \\rangle$ ve $\\langle r^2, rs \\rangle$ olduğu kanıtlandı.',
            '$4 \\mid n$ iken $D_{n/2} \\times \\mathbb{Z}_2$' + "'de en büyük eleman mertebesinin $n/2 < n$ olduğu gösterilerek izomorfik olmadığı ispatlandı.",
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 6. ps2-dn-bolum-gruplari — Quotients D_n/<r^d> ≅ D_d and D_n/<r^2>
// =====================================================================

const COSET_Q_OPTS = [
  'İki evet/hayır sorusu: (1) Dönme mi, yansıma mı? (2) $r$ kuvveti çift mi, tek mi?',
  'Tek evet/hayır sorusu: Yalnızca "Dönme mi, yansıma mı?" ($r$ üssünün tekliği/çiftliği iyi tanımlı değildir)',
  'Tek evet/hayır sorusu: Yalnızca "$r$ kuvveti çift mi, tek mi?"',
  'Hiçbir soru gerekmez (tüm elemanlar tek bir kosette toplanır)',
];

const T_DN_BOLUM_GRUPLARI = {
  id: 'ps2-dn-bolum-gruplari',
  topic: 'Bölüm Grupları',
  title: '$D_n / N$ Bölüm Grupları ve Kosetleri Ayıran Sorular',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const n = rng.pick([4, 5, 6, 7, 8]);
      const isEven = n % 2 === 0;
      const N = isEven ? dRotSub(n, n / 2) : dRotSub(n, n);
      const qOrd = (2 * n) / N.length; // 4 if even, 2 if odd
      const groupCorrect = isEven ? '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ (Klein dörtlü grubu)' : '$\\mathbb{Z}_2$';
      const groupChoice = shuffleChoice(rng, groupCorrect, [
        '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ (Klein dörtlü grubu)',
        '$\\mathbb{Z}_2$',
        '$\\mathbb{Z}_4$',
        '$D_3$',
      ]);
      const qIdx = isEven ? 0 : 1;
      const qChoice = shuffleChoice(rng, COSET_Q_OPTS[qIdx], COSET_Q_OPTS.filter((_, i) => i !== qIdx));

      return {
        title: `Bölüm Grubu $D_{${n}} / \\langle r^2 \\rangle$ ve Kosetleri Ayıran Sorular`,
        story: `Bir $D_{${n}}$ simetri grubunda iki adımlık dönmelerden üretilen $N = \\langle r^2 \\rangle$ normal alt grubuna göre bölüm grubu $D_{${n}} / N$'yi kuralım. $n = ${n}$ sayısının çift veya tek olması, $N$ alt grubunun boyutunu ve kosetleri ayıran bilgiyi kökten değiştirir!`,
        model: { id: 'cosets', params: { kind: 'D', n, sub: N.map(x => dName(x)) } },
        parts: makeLabels([
          {
            prompt: `$D_{${n}}$ içinde $N = \\langle r^2 \\rangle$ alt grubunun mertebesi $|N|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: N.length },
            hints: [
              `$|\\langle r^2 \\rangle| = |r^2| = ${n} / \\gcd(2, ${n})$.`,
              isEven ? `$${n}$ çift olduğundan $\\gcd(2, ${n}) = 2$ ve $|N| = ${n / 2}$.` : `$${n}$ tek olduğundan $\\gcd(2, ${n}) = 1$ ve $\\langle r^2 \\rangle = \\langle r \\rangle$ ($|N| = ${n}$).`,
            ],
            solution: [
              `$\\gcd(2, ${n}) = ${gcd(2, n)}$ olduğundan $|N| = |r^2| = \\frac{${n}}{${gcd(2, n)}} = ${N.length}$ ($N = ${dSetTex(N)}$).`,
            ],
          },
          {
            prompt: `Bölüm grubu $D_{${n}} / N$'nin mertebesi (farklı koset sayısı) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: qOrd },
            hints: [
              `$|D_{${n}} / N| = |D_{${n}}| / |N| = ${2 * n} / ${N.length}$.`,
            ],
            solution: [
              `$|D_{${n}} / N| = \\frac{${2 * n}}{${N.length}} = ${qOrd}$.`,
            ],
          },
          {
            prompt: `$D_{${n}} / \\langle r^2 \\rangle$ bölüm grubu aşağıdaki gruplardan hangisine izomorfiktir?`,
            kind: 'answer',
            answer: groupChoice,
            hints: [
              isEven
                ? 'Dört koset $N, rN, sN, rsN$ bulunur ve hepsinin karesi $N$' + "'dir ($(rN)^2 = r^2N = N$, $(sN)^2 = N$, $(rsN)^2 = N$)."
                : 'Yalnızca $2$ koset vardır ($N = \\langle r \\rangle$ ve $sN$); mertebesi $2$ olan tek grup hangisidir?',
            ],
            solution: [
              isEven
                ? `Dört koset $N, rN, sN, rsN$'nin her birinin karesi $N$ (birim) olduğundan $D_{${n}} / \\langle r^2 \\rangle \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.`
                : `Yalnızca $2$ koset ($\\langle r \\rangle$ ve $s\\langle r \\rangle$) olduğundan $D_{${n}} / \\langle r^2 \\rangle \\cong \\mathbb{Z}_2$.`,
            ],
          },
          {
            prompt: `Bir $g = r^k s^m \\in D_{${n}}$ elemanının hangi $N$ kosetine düştüğünü belirlemek için hangi evet/hayır sorusu (veya soruları) gerekir ve yeterlidir?`,
            kind: 'answer',
            answer: qChoice,
            hints: [
              isEven
                ? '$r^2$ ile çarpmak $m$ değerini ve $k \\bmod 2$ paritesini değiştirmez.'
                : `$n = ${n}$ tek olduğundan $r^{${n}} = e$ tek üssü çift üsse çevirir ($r = r^{${n + 1}} \\in \\langle r^2 \\rangle$); geriye yalnızca dönme/yansıma ayrımı kalır!`,
            ],
            solution: [
              isEven
                ? 'İki bağımsız ikili bilgi korunur: dönme/yansıma ($m \\in \\{0, 1\\}$) ve $r$ üssünün çift/tekliği ($k \\bmod 2 \\in \\{0, 1\\}$); bu da $\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ yapısını verir.'
                : `$${n}$ tek olduğundan $r = (r^2)^{${(n + 1) / 2}} \\in N$, yani $r$ kuvvetlerinin tekliği/çiftliği anlamını yitirir; kosetleri yalnızca "Dönme mi, yansıma mı?" sorusu ayırır.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const useRd = rng.int(0, 1) === 1;
      if (!useRd) {
        const n = rng.pick([5, 6, 7, 8, 9, 10]);
        const isEven = n % 2 === 0;
        const N = isEven ? dRotSub(n, n / 2) : dRotSub(n, n);
        const qOrd = (2 * n) / N.length;
        const groupCorrect = isEven ? '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$' : '$\\mathbb{Z}_2$';
        const groupChoice = shuffleChoice(rng, groupCorrect, ['$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$', '$\\mathbb{Z}_2$', '$\\mathbb{Z}_4$', '$D_3$']);

        const g1 = dEl(n, rng.int(1, n - 1), rng.int(0, 1));
        const g2 = dEl(n, rng.int(1, n - 1), rng.int(0, 1));
        const prod = dMul(n, g1, g2);
        const cosetName = isEven
          ? (prod.m === 0 ? (prod.k % 2 === 0 ? '$N$' : '$rN$') : (prod.k % 2 === 0 ? '$sN$' : '$rsN$'))
          : (prod.m === 0 ? '$N$' : '$sN$');
        const cosetChoice = isEven
          ? shuffleChoice(rng, cosetName, ['$N$', '$rN$', '$sN$', '$rsN$'])
          : shuffleChoice(rng, cosetName, ['$N$', '$sN$']);
        const qIdx = isEven ? 0 : 1;
        const qChoice = shuffleChoice(rng, COSET_Q_OPTS[qIdx], COSET_Q_OPTS.filter((_, i) => i !== qIdx));

        return {
          title: `Bölüm Grubu $D_{${n}} / \\langle r^2 \\rangle$ ve Koset Çarpımı`,
          story: `$D_{${n}}$ grubunda $N = \\langle r^2 \\rangle \\trianglelefteq D_{${n}}$ normal alt grubuna göre bölüm grubu $D_{${n}} / N$'nin yapısını ve kosetleri birbirinden ayıran evet/hayır sorularını belirleyelim.`,
          model: { id: 'cosets', params: { kind: 'D', n, sub: N.map(x => dName(x)) } },
          parts: makeLabels([
            {
              prompt: `Bölüm grubu $D_{${n}} / \\langle r^2 \\rangle$'nin mertebesi kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: qOrd },
              hints: [`$|N| = ${n} / \\gcd(2, ${n}) = ${N.length}$ ve $|D_{${n}}/N| = ${2 * n} / |N|$.`],
              solution: [`$|N| = ${N.length} \\implies |D_{${n}}/N| = ${2 * n}/${N.length} = ${qOrd}$.`],
            },
            {
              prompt: `$D_{${n}} / \\langle r^2 \\rangle$ bölümü hangi standart gruba izomorfiktir?`,
              kind: 'answer',
              answer: groupChoice,
              hints: [
                isEven ? 'Dört kosetin her biri kendi tersidir (mertebe $\\le 2$).' : 'İki kosetli tek grup $\\mathbb{Z}_2$' + "'dir.",
              ],
              solution: [
                isEven
                  ? `Her kosetin karesi $N$ olduğundan $D_{${n}} / \\langle r^2 \\rangle \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.`
                  : `$N = \\langle r^2 \\rangle = \\langle r \\rangle$ olduğundan $D_{${n}} / N \\cong \\mathbb{Z}_2$.`,
              ],
            },
            {
              prompt: `Koset çarpımı $(${dTex(g1)} N)(${dTex(g2)} N)$ hangi kosete eşittir?`,
              kind: 'answer',
              answer: cosetChoice,
              hints: [
                `Koset çarpım kuralı: $(g_1 N)(g_2 N) = (g_1 g_2) N$. Önce $${dTex(g1)} \\cdot ${dTex(g2)}$ çarpımını normal biçime getirin.`,
                `$${dTex(g1)} \\cdot ${dTex(g2)} = ${dTex(prod)}$.`,
              ],
              solution: [
                `$${dTex(g1)} \\cdot ${dTex(g2)} = ${dTex(prod)}$ olup temsilci koset **${cosetName}** olur.`,
              ],
            },
            {
              prompt: `Bu bölüm grubunda bir elemanın hangi kosette olduğunu ayırt eden evet/hayır soruları nelerdir?`,
              kind: 'answer',
              answer: qChoice,
              hints: [
                isEven ? 'Hem dönme/yansıma hem de $r$ kuvvetinin çift/tekliği mod $2$ korunur.' : `$n = ${n}$ tek olduğundan $r$ üssünün tekliği/çiftliği korunmaz!`,
              ],
              solution: [`Doğru yanıt: **${COSET_Q_OPTS[qIdx]}**.`],
            },
          ]),
        };
      } else {
        const pairs = [[6, 3], [8, 4], [9, 3], [10, 5], [12, 3], [12, 4], [12, 6]];
        const [n, d] = rng.pick(pairs);
        const N = dRotSub(n, n / d); // <r^d> has order n/d
        const qOrd = 2 * d;
        const gPick = dEl(n, rng.int(d, n - 1), rng.int(0, 1));
        const gImg = dEl(d, gPick.k, gPick.m);
        const isoChoice = shuffleChoice(rng, `$D_{${d}}$`, [`$\\mathbb{Z}_{${2 * d}}$`, `$D_{${n / d}}$`, `$\\mathbb{Z}_{${d}} \\times \\mathbb{Z}_2$`].filter(x => x !== `$D_{${d}}$`));

        return {
          title: `Bölüm Grubu $D_{${n}} / \\langle r^{${d}} \\rangle \\cong D_{${d}}$`,
          story: `Düzgün $${n}$-genin simetri grubu $D_{${n}}$ içinde $d = ${d} \\mid ${n}$ için $N = \\langle r^{${d}} \\rangle$ normal dönme alt grubuna göre kaba tanelendirme yapıldığında, $${n}$-genin köşeleri mod $${d}$ birleşerek daha küçük bir çokgenin simetri grubunu oluşturur.`,
          model: { id: 'cosets', params: { kind: 'D', n, sub: N.map(x => dName(x)) } },
          parts: makeLabels([
            {
              prompt: `$N = \\langle r^{${d}} \\rangle$ normal alt grubunun mertebesi $|N|$ kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: N.length },
              hints: [`$|\\langle r^{${d}} \\rangle| = ${n} / \\gcd(${d}, ${n}) = ${n} / ${d}$.`],
              solution: [`$|N| = ${n} / ${d} = ${N.length}$ ($N = ${dSetTex(N)}$).`],
            },
            {
              prompt: `Bölüm grubu $D_{${n}} / \\langle r^{${d}} \\rangle$'nin mertebesi kaçtır?`,
              kind: 'answer',
              answer: { type: 'int', value: qOrd },
              hints: [`$|D_{${n}}/N| = |D_{${n}}| / |N| = ${2 * n} / ${N.length}$.`],
              solution: [`$|D_{${n}}/N| = \\frac{${2 * n}}{${N.length}} = ${qOrd}$.`],
            },
            {
              prompt: `$D_{${n}} / \\langle r^{${d}} \\rangle$ bölümü aşağıdaki gruplardan hangisine izomorfiktir?`,
              kind: 'answer',
              answer: isoChoice,
              hints: [
                `$\\bar{r} = rN$ ve $\\bar{s} = sN$ kosetleri $\\bar{r}^{${d}} = N$, $\\bar{s}^2 = N$ ve $\\bar{s}\\bar{r}\\bar{s} = \\bar{r}^{-1}$ bağıntılarını sağlar.`,
              ],
              solution: [
                `$\\varphi(r^k s^m) = \\tilde{r}^{k \\bmod ${d}} \\tilde{s}^m$ örten homomorfizmasının çekirdeği $\\langle r^{${d}} \\rangle$ olduğundan $D_{${n}} / \\langle r^{${d}} \\rangle \\cong D_{${d}}$.`,
              ],
            },
            {
              prompt: `Doğal $\\varphi: D_{${n}} \\to D_{${d}}$ bölüm homomorfizması altında $g = ${dTex(gPick)} \\in D_{${n}}$ elemanının $D_{${d}}$ içindeki görüntüsünü normal biçimde ($r^k s^m$, $0 \\le k < ${d}$) yazın.`,
              kind: 'answer',
              answer: { type: 'dihedral', n: d, value: gImg },
              hints: [
                `$r$ üssünü mod $${d}$ indirgeyin, $s$ üssünü koruyun: $r^{${gPick.k}} s^{${gPick.m}} \\mapsto r^{${gPick.k} \\bmod ${d}} s^{${gPick.m}}$.`,
              ],
              solution: [
                `$${gPick.k} \\equiv ${gImg.k} \\pmod{${d}}$ olduğundan $\\varphi(${dTex(gPick)}) = ${dTex(gImg)} \\in D_{${d}}$.`,
              ],
            },
          ]),
        };
      }
    }

    // zorlayici: combine D_n/<r^d> ≅ D_d with D_{n2}/<r^2> and First Isomorphism Theorem proof
    const pairs = [[8, 4], [9, 3], [10, 5], [12, 3], [12, 4], [12, 6]];
    const [n, d] = rng.pick(pairs);
    const N = dRotSub(n, n / d);
    const n2 = rng.pick([5, 6, 7, 8, 9, 10]);
    const n2Even = n2 % 2 === 0;
    const iso1 = shuffleChoice(rng, `$D_{${d}}$`, [`$\\mathbb{Z}_{${2 * d}}$`, `$D_{${n / d}}$`, `$\\mathbb{Z}_{${d}} \\times \\mathbb{Z}_2$`].filter(x => x !== `$D_{${d}}$`));
    const iso2Correct = n2Even ? '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$' : '$\\mathbb{Z}_2$';
    const iso2 = shuffleChoice(rng, iso2Correct, ['$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$', '$\\mathbb{Z}_2$', '$\\mathbb{Z}_4$', '$D_3$']);

    return {
      title: `Bölüm Grupları Zinciri: $D_{${n}} / \\langle r^{${d}} \\rangle$ ve $D_{${n2}} / \\langle r^2 \\rangle$`,
      story: `Dihedral gruplarda dönme alt gruplarına göre bölüm almak çokgenin simetri mertebesini küçültür. Birinci İzomorfizma Teoremini kullanarak hem genel $D_n / \\langle r^d \\rangle$ ($d \\mid n$) yapısını hem de $N = \\langle r^2 \\rangle$ özel durumunu çözelim.`,
      model: { id: 'cosets', params: { kind: 'D', n, sub: N.map(x => dName(x)) } },
      parts: makeLabels([
        {
          prompt: `$D_{${n}} / \\langle r^{${d}} \\rangle$ bölüm grubunun mertebesi kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: 2 * d },
          hints: [`$|\\langle r^{${d}} \\rangle| = ${n}/${d} = ${n / d}$.`],
          solution: [`$|D_{${n}}/\\langle r^{${d}} \\rangle| = \\frac{${2 * n}}{${n / d}} = ${2 * d}$.`],
        },
        {
          prompt: `$D_{${n}} / \\langle r^{${d}} \\rangle$ hangi standart gruba izomorfiktir?`,
          kind: 'answer',
          answer: iso1,
          hints: [`$\\varphi(r^k s^m) = \\tilde{r}^{k \\bmod ${d}} \\tilde{s}^m$ homomorfizmasının çekirdeği ve görüntüsüne bakın.`],
          solution: [`Birinci İzomorfizma Teoremiyle $D_{${n}} / \\langle r^{${d}} \\rangle \\cong D_{${d}}$.`],
        },
        {
          prompt: `Ayrı olarak, $D_{${n2}}$ grubunda $N_2 = \\langle r^2 \\rangle$ alındığında $D_{${n2}} / \\langle r^2 \\rangle$ bölüm grubu hangisine izomorfiktir?`,
          kind: 'answer',
          answer: iso2,
          hints: [
            n2Even ? `$n_2 = ${n2}$ çift olduğundan $2 \\mid ${n2}$ ve $D_{${n2}}/\\langle r^2 \\rangle \\cong D_2$.` : `$n_2 = ${n2}$ tek olduğundan $\\langle r^2 \\rangle = \\langle r \\rangle$!`,
          ],
          solution: [
            n2Even
              ? `$n_2 = ${n2}$ çift olduğu için $D_{${n2}} / \\langle r^2 \\rangle \\cong D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.`
              : `$n_2 = ${n2}$ tek olduğu için $\\gcd(2, ${n2}) = 1 \\implies \\langle r^2 \\rangle = \\langle r \\rangle$ ve $D_{${n2}} / \\langle r^2 \\rangle \\cong \\mathbb{Z}_2$.`,
          ],
        },
        {
          prompt: '**Kanıt:** Her $d \\mid n$ ($d \\ge 2$) için $\\varphi: D_n \\to D_d$, $\\varphi(r^k s^m) = \\tilde{r}^{k \\bmod d} \\tilde{s}^m$ dönüşümünün iyi tanımlı, örten bir grup homomorfizması olduğunu ve $\\ker\\varphi = \\langle r^d \\rangle$ olduğunu göstererek $D_n / \\langle r^d \\rangle \\cong D_d$ teoremini kanıtlayın; $d = 2$ (çift $n$) ile tek $n$ için $D_n / \\langle r^2 \\rangle$ farkını açıklayın.',
          kind: 'proof',
          hints: [
            'Çarpım kuralını $(r^a s^u)(r^b s^v) = r^{a + (-1)^u b} s^{u+v}$ üzerinden doğrulayın ve $d \\mid n$ koşulunun neden $r^n = e$' + "'yi koruduğunu belirtin.",
          ],
          solution: [
            '**İyi tanımlılık:** $d \\mid n$ olduğundan $k \\equiv k\' \\pmod n \\implies k \\equiv k\' \\pmod d$, yani $\\varphi$ tekil normal biçimde iyi tanımlıdır.',
            '**Homomorfizma:** $\\varphi((r^a s^u)(r^b s^v)) = \\varphi(r^{a + (-1)^u b} s^{u+v}) = \\tilde{r}^{(a + (-1)^u b) \\bmod d} \\tilde{s}^{(u+v) \\bmod 2} = (\\tilde{r}^{a \\bmod d} \\tilde{s}^u)(\\tilde{r}^{b \\bmod d} \\tilde{s}^v) = \\varphi(r^a s^u)\\varphi(r^b s^v)$.',
            '**Örtenlik ve çekirdek:** Her $\\tilde{r}^j \\tilde{s}^m \\in D_d$ ($0 \\le j < d$) için $\\varphi(r^j s^m) = \\tilde{r}^j \\tilde{s}^m$ (örten). $\\varphi(r^k s^m) = \\tilde{e} \\iff m = 0$ ve $d \\mid k \\iff r^k s^m \\in \\langle r^d \\rangle$. Birinci İzomorfizma Teoremiyle $D_n / \\langle r^d \\rangle \\cong D_d$.',
            '**Özel durum $N = \\langle r^2 \\rangle$:** $n$ çiftken $2 \\mid n$ olduğundan $D_n / \\langle r^2 \\rangle \\cong D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$; $n$ tekken $\\gcd(2, n) = 1 \\implies \\langle r^2 \\rangle = \\langle r \\rangle$ ve $D_n / \\langle r^2 \\rangle \\cong \\mathbb{Z}_2$.',
          ],
          checklist: [
            '$d \\mid n$ nedeniyle $\\varphi(r^k s^m) = \\tilde{r}^{k \\bmod d}\\tilde{s}^m$ dönüşümünün iyi tanımlı olduğu gösterildi.',
            'Çarpım formülüyle $\\varphi$' + "'nin homomorfizma ve örten olduğu doğrulandı.",
            '$\\ker\\varphi = \\langle r^d \\rangle$ bulunup Birinci İzomorfizma Teoremiyle $D_n/\\langle r^d \\rangle \\cong D_d$ elde edildi.',
            'Çift $n$ ($\\mathbb{Z}_2 \\times \\mathbb{Z}_2$) ve tek $n$ ($\\mathbb{Z}_2$) için $\\langle r^2 \\rangle$ farkı açıklandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 7. ps2-tekerlek-stroboskop — R/cZ and the film wagon-wheel effect
// =====================================================================

const WHEEL_DIR_OPTS = [
  'İleri (gerçek dönme yönünde)',
  'Geri (ters yönde dönüyormuş gibi)',
  'Durgun (donmuş gibi sabit)',
];

const T_TEKERLEK_STROBOSKOP = {
  id: 'ps2-tekerlek-stroboskop',
  topic: 'Bölüm Grupları: $\\mathbb{R}/c\\mathbb{Z}$',
  title: 'Vagon Tekerleği Etkisi ve $\\mathbb{R} / \\frac{2\\pi}{n}\\mathbb{Z}$ Bölümü',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      // Pick spokes n dividing 360 and clean fps so f/n and f/(2n) are clean decimals/integers
      const combos = [
        [4, 24], [6, 24], [8, 24], [12, 24],
        [5, 30], [6, 30], [10, 30],
        [4, 48], [6, 48], [8, 48], [12, 48],
        [5, 60], [6, 60], [10, 60], [12, 60],
      ];
      const [spokes, fps] = rng.pick(combos);
      const radius = rng.pick([0.4, 0.5]);
      const degStep = 360 / spokes;
      const nuFrozen = fps / spokes;
      const nuMaxTrue = fps / (2 * spokes);

      // Pick a clean regime: forward-true (0.3), backward (0.75), frozen (1.0), forward-alias (1.25)
      const regime = rng.pick([
        { frac: 0.3, fracTex: '\\frac{3}{10}', dirIdx: 0 },
        { frac: 0.75, fracTex: '\\frac{3}{4}', dirIdx: 1 },
        { frac: 1.0, fracTex: '1', dirIdx: 2 },
        { frac: 1.25, fracTex: '\\frac{5}{4}', dirIdx: 0 },
      ]);
      const nuTest = roundNum(regime.frac * nuFrozen, 4);
      const omegaTest = 2 * Math.PI * nuTest;
      const vTest = roundNum(omegaTest * radius, 8);
      const dTheta = omegaTest / fps;
      const dThetaApp = wrapHalfOpen(dTheta, (2 * Math.PI) / spokes);
      const dirIdx = Math.abs(dThetaApp) < 1e-9 ? 2 : (dThetaApp > 0 ? 0 : 1);
      const dirChoice = shuffleChoice(rng, WHEEL_DIR_OPTS[dirIdx], WHEEL_DIR_OPTS.filter((_, i) => i !== dirIdx));

      return {
        title: `Vagon Tekerleği Etkisi ($n = ${spokes}$ tel, $f = ${fps}$ kare/sn)`,
        story: `Saniyede $f = ${fps}$ kare çeken bir sinema kamerası, yarıçapı $R = ${radius}\\text{ m}$ ve $n = ${spokes}$ özdeş teli (parmaklığı) olan bir tekerleği filme alıyor. Tekerlek her $\\frac{2\\pi}{${spokes}}$ radyan ($${degStep}^\\circ$) döndüğünde görünümü kendisiyle özdeş olduğundan, görsel durumlar $\\theta \\mapsto e^{i\\cdot ${spokes}\\theta}$ homomorfizmasının çekirdeği $\\frac{2\\pi}{${spokes}}\\mathbb{Z}$ modülo $\\mathbb{R} / \\frac{2\\pi}{${spokes}}\\mathbb{Z}$ bölüm grubunda yaşar.`,
        model: { id: 'wheel', params: { spokes, fps, radius, v: vTest } },
        parts: makeLabels([
          {
            prompt: `$\\phi_{${spokes}}(\\theta) = e^{i\\cdot ${spokes}\\theta}$ homomorfizmasının çekirdeğindeki en küçük pozitif dönme açısı kaç **derecedir**?`,
            kind: 'answer',
            answer: { type: 'int', value: degStep },
            hints: [
              '$\\ker(\\phi_n) = \\frac{2\\pi}{n}\\mathbb{Z}$ olup en küçük pozitif eleman $2\\pi/n$ radyandır.',
              `Derece cinsinden $360^\\circ / n = 360^\\circ / ${spokes}$.`,
              `$360 / ${spokes} = ${degStep}$ derece.`,
            ],
            solution: [
              `$e^{i\\cdot ${spokes}\\theta} = 1 \\iff ${spokes}\\theta = 2\\pi m \\iff \\theta = \\frac{360^\\circ}{${spokes}} m = ${degStep}^\\circ m$. En küçük pozitif açı **$${degStep}^\\circ$**.`,
            ],
          },
          {
            prompt: `Tekerleğin filmde tamamen **donmuş (durgun)** görünmesini sağlayan en küçük pozitif dönme frekansı $\\nu_1$ kaç **devir/saniye**'dir?`,
            kind: 'answer',
            answer: { type: 'number', value: roundNum(nuFrozen, 4), tol: 1e-3 },
            hints: [
              'Kare başına dönme açısı $\\Delta\\theta = \\omega / f = 2\\pi\\nu / f$ tam olarak $2\\pi / n$ olduğunda her tel bir sonraki telin yerine oturur.',
              `$\\frac{2\\pi\\nu_1}{f} = \\frac{2\\pi}{n} \\implies \\nu_1 = \\frac{f}{n}$.`,
              `$\\nu_1 = ${fps} / ${spokes} = ${roundNum(nuFrozen, 4)}$ devir/sn.`,
            ],
            solution: [
              `$\\Delta\\theta = \\frac{2\\pi\\nu_1}{${fps}} = \\frac{2\\pi}{${spokes}} \\implies \\nu_1 = \\frac{${fps}}{${spokes}} = ${roundNum(nuFrozen, 4)}\\text{ devir/sn}$.`,
            ],
          },
          {
            prompt: `Filmin tekerleğin **gerçek dönme yönünü ve hızını** yanılsama olmadan gösterebildiği en büyük dönme frekansı $\\nu_{\\max}$ kaç **devir/saniye**'dir?`,
            kind: 'answer',
            answer: { type: 'number', value: roundNum(nuMaxTrue, 4), tol: 1e-3 },
            hints: [
              'Göz her teli bir sonraki karede en yakın tel konumuna bağlar: görünür açı $\\Delta\\theta_{\\text{gör}} \\in (-\\pi/n, \\pi/n]$ aralığında kalır.',
              `Gerçek dönme $\\Delta\\theta \\le \\pi/n$ koşulunda korunur: $\\nu_{\\max} = \\frac{f}{2n}$.`,
              `$\\nu_{\\max} = ${fps} / (2 \\cdot ${spokes}) = ${roundNum(nuMaxTrue, 4)}$ devir/sn.`,
            ],
            solution: [
              `$\\Delta\\theta = \\frac{2\\pi\\nu}{${fps}} \\le \\frac{\\pi}{${spokes}} \\implies \\nu \\le \\frac{${fps}}{2 \\cdot ${spokes}} = ${roundNum(nuMaxTrue, 4)}\\text{ devir/sn}$.`,
            ],
          },
          {
            prompt: `Tekerlek $\\nu = ${nuTest}\\text{ devir/sn}$ hızıyla ileri dönerken filmde hangi yönde dönüyor gibi görünür?`,
            kind: 'answer',
            answer: dirChoice,
            hints: [
              `$\\nu / \\nu_1 = ${nuTest} / ${roundNum(nuFrozen, 4)} = ${regime.frac}$ oranının kesirli kısmına (en yakın tam sayıya uzaklığına) bakın.`,
              'Kare başına dönme $\\Delta\\theta$ değerini $(-\\pi/n, \\pi/n]$ aralığına indirgeyin: pozitifse ileri, negatifse geri, sıfırsa donmuş.',
              `İndirgenmiş açı işareti: **${WHEEL_DIR_OPTS[dirIdx]}**.`,
            ],
            solution: [
              `Kare başına dönme $\\Delta\\theta = \\frac{2\\pi \\cdot ${nuTest}}{${fps}} = ${regime.frac} \\cdot \\frac{2\\pi}{${spokes}}$.`,
              `$(-\\pi/${spokes}, \\pi/${spokes}]$ aralığındaki temsilcisi $${roundNum(dThetaApp, 4)}\\text{ rad}$ olduğundan görünüm: **${WHEEL_DIR_OPTS[dirIdx]}**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const spokes = rng.pick([4, 5, 6, 8, 10, 12]);
      const fps = rng.pick([24, 30, 48, 60]);
      const radius = rng.pick([0.3, 0.4, 0.5, 0.6]);
      const period = (2 * Math.PI) / spokes;
      const vMaxTrue = (Math.PI * fps * radius) / spokes;
      const vFrozen1 = (2 * Math.PI * fps * radius) / spokes;

      // Pick a linear speed v cleanly away from the ±π/n Nyquist jump
      const mult = rng.pick([0.65, 0.75, 0.85, 1.15, 1.25, 1.35, 1.75]);
      const v = roundNum(mult * vFrozen1, 2);
      const omegaTrue = v / radius;
      const dTheta = omegaTrue / fps;
      const dThetaApp = wrapHalfOpen(dTheta, period);
      const omegaApp = roundNum(fps * dThetaApp, 3);
      const dirIdx = Math.abs(dThetaApp) < 1e-9 ? 2 : (dThetaApp > 0 ? 0 : 1);
      const dirChoice = shuffleChoice(rng, WHEEL_DIR_OPTS[dirIdx], WHEEL_DIR_OPTS.filter((_, i) => i !== dirIdx));
      const mNearest = Math.round(dTheta / period);

      return {
        title: `Yuvarlanan Tekerlekte Stroboskopik Yanılsama ($n = ${spokes}$ tel)`,
        story: `Yarıçapı $R = ${radius}\\text{ m}$ ve $n = ${spokes}$ özdeş teli olan bir araba tekerleği kaymadan $v = ${v}\\text{ m/s}$ doğrusal hızıyla (gerçek açısal hız $\\omega = v/R$) yuvarlanıyor ve $f = ${fps}\\text{ kare/sn}$ hızında filme alınıyor. Kare başına görünür dönme açısı $\\omega / f$'nin $(-\\pi/${spokes}, \\pi/${spokes}]$ aralığındaki $\\bmod\\,(2\\pi/${spokes})$ temsilcisidir.`,
        model: { id: 'wheel', params: { spokes, fps, radius, v } },
        parts: makeLabels([
          {
            prompt: `Filmin tekerleğin gerçek dönüşünü doğru gösterebildiği en büyük doğrusal hız $v_{\\max}$ kaç **m/s**'dir? (En az 2 ondalık basamakla yazın.)`,
            kind: 'answer',
            answer: { type: 'number', value: roundNum(vMaxTrue, 3), tol: Math.max(0.02, vMaxTrue * 0.005) },
            hints: [
              'Gerçek dönüş koşulu $\\Delta\\theta = \\frac{v}{R f} \\le \\frac{\\pi}{n}$ olduğundan $v_{\\max} = \\frac{\\pi f R}{n}$.',
              `$v_{\\max} = \\frac{\\pi \\cdot ${fps} \\cdot ${radius}}{${spokes}}$.`,
            ],
            solution: [
              `$\\Delta\\theta = \\frac{v}{R f} \\le \\frac{\\pi}{n} \\implies v_{\\max} = \\frac{\\pi \\cdot ${fps} \\cdot ${radius}}{${spokes}} \\approx ${roundNum(vMaxTrue, 3)}\\text{ m/s}$.`,
            ],
          },
          {
            prompt: `Tekerleğin filmde tamamen **donmuş** göründüğü en küçük pozitif doğrusal hız $v_{\\text{don}}$ kaç **m/s**'dir? (En az 2 ondalık basamakla.)`,
            kind: 'answer',
            answer: { type: 'number', value: roundNum(vFrozen1, 3), tol: Math.max(0.02, vFrozen1 * 0.005) },
            hints: [
              'Donma koşulu $\\Delta\\theta = \\frac{v}{R f} = \\frac{2\\pi}{n}$, yani $v_{\\text{don}} = 2 v_{\\max} = \\frac{2\\pi f R}{n}$.',
            ],
            solution: [
              `$v_{\\text{don}} = \\frac{2\\pi \\cdot ${fps} \\cdot ${radius}}{${spokes}} \\approx ${roundNum(vFrozen1, 3)}\\text{ m/s}$.`,
            ],
          },
          {
            prompt: `$v = ${v}\\text{ m/s}$ hızında yuvarlanırken filmdeki **görünür açısal hız** $\\omega_{\\text{gör}}$ kaç **rad/s**'dir? (İleri için pozitif, geri için negatif işaret kullanın; en az 2 ondalık basamakla.)`,
            kind: 'answer',
            answer: { type: 'number', value: omegaApp, tol: Math.max(0.05, Math.abs(omegaApp) * 0.01) },
            hints: [
              `Önce gerçek açısal hızı $\\omega = v / R = ${v} / ${radius} = ${roundNum(omegaTrue, 3)}\\text{ rad/s}$ ve kare başına açıyı $\\Delta\\theta = \\omega / ${fps} \\approx ${roundNum(dTheta, 4)}\\text{ rad}$ olarak bulun.`,
              `$\\Delta\\theta$'dan $${mNearest} \\cdot \\frac{2\\pi}{${spokes}}$ çıkarıp $(-\\pi/${spokes}, \\pi/${spokes}]$ aralığına indirgeyin ve $f = ${fps}$ ile çarpın.`,
            ],
            solution: [
              `$\\omega = \\frac{${v}}{${radius}} = ${roundNum(omegaTrue, 4)}\\text{ rad/s}$ ve $\\Delta\\theta = \\frac{\\omega}{${fps}} \\approx ${roundNum(dTheta, 4)}\\text{ rad}$.`,
              `Tel aralığı $P = \\frac{2\\pi}{${spokes}} \\approx ${roundNum(period, 4)}\\text{ rad}$ olduğundan en yakın kat $m = ${mNearest}$: $\\Delta\\theta_{\\text{gör}} = \\Delta\\theta - ${mNearest} P \\approx ${roundNum(dThetaApp, 4)}\\text{ rad}$.`,
              `$\\omega_{\\text{gör}} = ${fps} \\cdot \\Delta\\theta_{\\text{gör}} \\approx ${omegaApp}\\text{ rad/s}$.`,
            ],
          },
          {
            prompt: `Buna göre tekerlek $v = ${v}\\text{ m/s}$ hızında filmde hangi yönde dönüyor gibi algılanır?`,
            kind: 'answer',
            answer: dirChoice,
            hints: [
              '$\\omega_{\\text{gör}} > 0$ ise ileri, $\\omega_{\\text{gör}} < 0$ ise geri, $0$ ise donmuş görünür.',
            ],
            solution: [
              `$\\omega_{\\text{gör}} \\approx ${omegaApp}\\text{ rad/s}$ olduğundan görünür yön: **${WHEEL_DIR_OPTS[dirIdx]}**.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: higher alias bands, 2nd frozen speed, inverse problem, and R/(2π/n)Z proof
    const spokes = rng.pick([5, 6, 7, 8, 9, 10, 12]);
    const fps = rng.pick([24, 30, 48, 60]);
    const radius = rng.pick([0.3, 0.4, 0.5, 0.6]);
    const period = (2 * Math.PI) / spokes;
    const omegaFrozen1 = (2 * Math.PI * fps) / spokes;
    const vFrozen1 = omegaFrozen1 * radius;
    const vFrozen2 = 2 * vFrozen1;

    const mult = rng.pick([1.7, 1.8, 2.2, 2.3, 2.75, 2.85]);
    const v = roundNum(mult * vFrozen1, 2);
    const omegaTrue = v / radius;
    const dTheta = omegaTrue / fps;
    const dThetaApp = wrapHalfOpen(dTheta, period);
    const omegaApp = roundNum(fps * dThetaApp, 3);

    // Inverse question: given apparent backward angular speed -alpha rad/s, find smallest positive true omega
    const alphaFrac = rng.pick([0.15, 0.2, 0.25, 0.3]);
    const alphaApp = roundNum(alphaFrac * omegaFrozen1, 2); // positive magnitude, apparent is -alphaApp
    const smallestTrueOmega = roundNum(omegaFrozen1 - alphaApp, 3);

    return {
      title: `Yüksek Hızlı Stroboskopik Örtüşme ($n = ${spokes}$ tel, $f = ${fps}$ kare/sn)`,
      story: `Yarıçapı $R = ${radius}\\text{ m}$, $n = ${spokes}$ özdeş telli bir yarış tekerleği $v = ${v}\\text{ m/s}$ yüksek hızında kaymadan yuvarlanırken $f = ${fps}\\text{ kare/sn}$ kamerayla kaydediliyor. $\\mathbb{R} / \\frac{2\\pi}{${spokes}}\\mathbb{Z}$ bölüm yapısını kullanarak hem ileri örtüşme hızını hem de ters problemi çözelim.`,
      model: { id: 'wheel', params: { spokes, fps, radius, v } },
      parts: makeLabels([
        {
          prompt: `$v = ${v}\\text{ m/s}$ hızında filmdeki görünür açısal hız $\\omega_{\\text{gör}}$ kaç **rad/s**'dir? (İşaretli, en az 2 ondalık basamakla.)`,
          kind: 'answer',
          answer: { type: 'number', value: omegaApp, tol: Math.max(0.06, Math.abs(omegaApp) * 0.01) },
          hints: [
            `$\\omega = v/R$ değerinden $m \\cdot \\frac{2\\pi f}{n}$ ($m \\in \\mathbb{Z}$) çıkararak $(-\\frac{\\pi f}{n}, \\frac{\\pi f}{n}]$ aralığına indirgeyin.`,
          ],
          solution: [
            `$\\omega = ${v}/${radius} = ${roundNum(omegaTrue, 4)}\\text{ rad/s}$, donma basamağı $\\omega_1 = \\frac{2\\pi\\cdot ${fps}}{${spokes}} \\approx ${roundNum(omegaFrozen1, 4)}\\text{ rad/s}$.`,
            `En yakın kat $m = ${Math.round(omegaTrue / omegaFrozen1)}$ çıkarılınca $\\omega_{\\text{gör}} = \\omega - ${Math.round(omegaTrue / omegaFrozen1)}\\omega_1 \\approx ${omegaApp}\\text{ rad/s}$.`,
          ],
        },
        {
          prompt: `Tekerleğin filmde tamamen donmuş göründüğü **ikinci** pozitif doğrusal hız $v_2$ kaç **m/s**'dir?`,
          kind: 'answer',
          answer: { type: 'number', value: roundNum(vFrozen2, 3), tol: Math.max(0.03, vFrozen2 * 0.005) },
          hints: [
            'Donma hızları $v_m = m \\cdot \\frac{2\\pi f R}{n}$ ($m = 1, 2, 3, \\dots$) biçimindedir.',
          ],
          solution: [
            `$v_2 = 2 \\cdot \\frac{2\\pi \\cdot ${fps} \\cdot ${radius}}{${spokes}} \\approx ${roundNum(vFrozen2, 3)}\\text{ m/s}$.`,
          ],
        },
        {
          prompt: `Kamerada tekerlek **geriye doğru** $|\\omega_{\\text{gör}}| = ${alphaApp}\\text{ rad/s}$ (yani $\\omega_{\\text{gör}} = -${alphaApp}\\text{ rad/s}$) hızıyla dönüyor gibi görünüyor. Bu yanılsamayı üretebilecek en küçük **pozitif** gerçek açısal hız $\\omega > 0$ kaç **rad/s**'dir?`,
          kind: 'answer',
          answer: { type: 'number', value: smallestTrueOmega, tol: Math.max(0.05, smallestTrueOmega * 0.01) },
          hints: [
            `$\\omega \\equiv \\omega_{\\text{gör}} \\pmod{\\frac{2\\pi f}{n}}$ denkliğinin en küçük pozitif çözümü $\\omega = \\frac{2\\pi f}{n} - ${alphaApp}$ olur.`,
          ],
          solution: [
            `$\\omega = m \\cdot \\frac{2\\pi f}{n} + \\omega_{\\text{gör}}$; $m = 0$ negatif verir, en küçük pozitif çözüm $m = 1$ içindir: $\\omega = \\frac{2\\pi\\cdot ${fps}}{${spokes}} - ${alphaApp} \\approx ${roundNum(omegaFrozen1, 3)} - ${alphaApp} = ${smallestTrueOmega}\\text{ rad/s}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\phi_n: (\\mathbb{R}, +) \\to U(1)$, $\\phi_n(\\theta) = e^{in\\theta}$ dönüşümünün örten bir homomorfizma olduğunu, $\\ker(\\phi_n) = \\frac{2\\pi}{n}\\mathbb{Z}$ olduğunu ve $\\mathbb{R} / \\frac{2\\pi}{n}\\mathbb{Z} \\cong U(1)$ olduğunu kanıtlayın; ayrıca bu bölüm yapısının neden donma ve geriye dönme yanılsamasını ürettiğini açıklayın.',
          kind: 'proof',
          hints: [
            '$e^{in(\\theta_1+\\theta_2)} = e^{in\\theta_1}e^{in\\theta_2}$ ile homomorfizma, $w = e^{i\\alpha} \\mapsto \\alpha/n$ ile örtenlik, $e^{in\\theta}=1 \\iff n\\theta \\in 2\\pi\\mathbb{Z}$ ile çekirdek bulunur.',
          ],
          solution: [
            '**Homomorfizma ve örtenlik:** $\\phi_n(\\theta_1 + \\theta_2) = e^{in(\\theta_1+\\theta_2)} = e^{in\\theta_1}e^{in\\theta_2} = \\phi_n(\\theta_1)\\phi_n(\\theta_2)$. Her $w = e^{i\\alpha} \\in U(1)$ için $\\theta = \\alpha/n \\in \\mathbb{R}$ seçilirse $\\phi_n(\\theta) = w$ (örten).',
            '**Çekirdek ve bölüm:** $\\theta \\in \\ker(\\phi_n) \\iff e^{in\\theta} = 1 \\iff n\\theta \\in 2\\pi\\mathbb{Z} \\iff \\theta \\in \\frac{2\\pi}{n}\\mathbb{Z}$. Birinci İzomorfizma Teoremiyle $\\mathbb{R} / \\frac{2\\pi}{n}\\mathbb{Z} \\cong U(1)$.',
            '**Stroboskopik yanılsama:** Kare başına $\\Delta\\theta = \\omega/f$ açısı yalnızca $\\frac{2\\pi}{n}\\mathbb{Z}$ kosetiyle gözlemlenebilir. $\\Delta\\theta \\in \\frac{2\\pi}{n}\\mathbb{Z}$ ise sıfır kosetinde (donmuş) görünür; her koset $(-\\pi/n, \\pi/n]$ aralığında tek bir temsilciye sahip olduğundan $\\Delta\\theta \\in (\\pi/n, 2\\pi/n)$ iken en yakın temsilci $\\Delta\\theta - 2\\pi/n < 0$ çıkar ve tekerlek geriye dönüyormuş gibi algılanır.',
          ],
          checklist: [
            '$\\phi_n(\\theta_1+\\theta_2) = \\phi_n(\\theta_1)\\phi_n(\\theta_2)$ ve örtenlik kanıtlandı.',
            '$\\ker(\\phi_n) = \\frac{2\\pi}{n}\\mathbb{Z}$ ve Birinci İzomorfizma Teoremiyle $\\mathbb{R}/\\frac{2\\pi}{n}\\mathbb{Z} \\cong U(1)$ kuruldu.',
            'Koset temsilcisinin $(-\\pi/n, \\pi/n]$ aralığına seçilmesinin donma ve ters dönme etkilerini nasıl doğurduğu açıklandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 8. ps2-brillouin-bolgesi — 1D atomic chain & first Brillouin zone R/(2π/a)Z
// =====================================================================

const T_BRILLOUIN_BOLGESI = {
  id: 'ps2-brillouin-bolgesi',
  topic: 'Bölüm Grupları: $\\mathbb{R}/c\\mathbb{Z}$',
  title: '1B Atom Zincirinde Kafes Dalgaları ve Birinci Brillouin Bölgesi',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const a = rng.pick(level === 'isinma' ? [1, 2, 3] : [2, 3, 4, 5]);

    // Build clean rational c = p/q outside (-1, 1] with reduced c' in (-1, 1] and c' != 0
    const qPool = level === 'isinma' ? [2, 3, 4] : level === 'odev' ? [3, 4, 5, 6] : [4, 5, 6, 8];
    const q = rng.pick(qPool);
    // Pick numerator p' in (-q, q] nonzero and coprime to q (or clean)
    const pPrimePool = [];
    for (let pp = -q + 1; pp <= q; pp++) {
      if (pp === 0) continue;
      if (level === 'isinma' && pp === q) continue; // keep strictly interior for warm-up
      if (gcd(Math.abs(pp), q) === 1) pPrimePool.push(pp);
    }
    const pPrime = rng.pick(pPrimePool);
    const mShift = rng.pick(level === 'isinma' ? [-1, 1, 2] : level === 'odev' ? [-2, -1, 1, 2, 3] : [-4, -3, -2, 2, 3, 4]);
    const p = pPrime + 2 * mShift * q; // so c = p/q = p'/q + 2*mShift
    const cVal = p / q;
    const cPrimeVal = pPrime / q;
    const kNumeric = roundNum((cVal * Math.PI) / a, 8);

    // Pair (k1, k2) for equivalence test: k1 ~ k2 iff (c1 - c2) is an even integer
    const makeEquiv = rng.int(0, 1) === 1;
    const p1 = pPrime + 2 * rng.pick([-1, 1]) * q;
    const delta2 = makeEquiv ? 2 * rng.pick([-2, -1, 1, 2]) : rng.pick([-3, -1, 1, 3]);
    const p2 = p1 + delta2 * q;
    const k1Tex = `${fmtFrac(p1, q)}\\frac{\\pi}{a}`;
    const k2Tex = `${fmtFrac(p2, q)}\\frac{\\pi}{a}`;

    const cFracTex = fmtFrac(p, q);
    const cPrimeFracTex = fmtFrac(pPrime, q);
    // Lattice periodicity L: smallest positive integer L with e^(i (p/q) pi L) = 1
    // (p/q) pi L = 2 pi t => p L = 2 q t. Since gcd(|p|, q) = gcd(|pPrime|, q) = 1, L = 2q / gcd(|p|, 2).
    const wavePeriod = (2 * q) / gcd(Math.abs(p), 2);
    // Physical reduced wavelength lambda' = 2 pi / |k'| = 2 a / |c'| = 2 a q / |p'|
    const lambdaRed = roundNum((2 * a * q) / Math.abs(pPrime), 4);
    const lambdaRedFrac = fmtFrac(2 * a * q, Math.abs(pPrime));

    const model = { id: 'brillouin', params: { a, k: kNumeric } };
    let rawParts;

    if (level === 'isinma') {
      rawParts = [
        {
          prompt: `Dalga sayısı $k = ${cFracTex}\\frac{\\pi}{a}$ olarak veriliyor. İndirgenmiş dalga sayısı $k' = k - \\frac{2\\pi m}{a}$ değerini birinci Brillouin bölgesi $(-\\frac{\\pi}{a}, \\frac{\\pi}{a}]$ içine taşıyan benzersiz $m \\in \\mathbb{Z}$ tam sayısı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: mShift },
          hints: [
            `$k = c\\frac{\\pi}{a}$ yazıldığında $k' = (c - 2m)\\frac{\\pi}{a}$ olur; $-1 < c - 2m \\le 1$ koşulunu sağlayan tek $m$ tam sayısını arıyoruz.`,
            `$c = ${cFracTex} = ${roundNum(cVal, 3)}$ sayısından hangi çift tam sayıyı ($2m$) çıkarırsanız $(-1, 1]$ aralığına düşer?`,
            `$2m = ${2 * mShift} \\implies m = ${mShift}$.`,
          ],
          solution: [
            `$c = ${cFracTex}$ için $c - 2(${mShift}) = ${cPrimeFracTex} \\in (-1, 1]$ olduğundan benzersiz tam sayı **$m = ${mShift}$**.`,
          ],
        },
        {
          prompt: `Birinci Brillouin bölgesindeki indirgenmiş dalga sayısını $k' = c' \\frac{\\pi}{a}$ biçiminde yazdığınızda $c' \\in (-1, 1]$ katsayısı kaçtır? (Kesir veya ondalık olarak yazın.)`,
          kind: 'answer',
          answer: { type: 'number', value: roundNum(cPrimeVal, 4), tol: 1e-3 },
          hints: [
            `$c' = c - 2m = ${cFracTex} - ${2 * mShift}$.`,
            `Payda eşitleyin: $\\frac{${p} - ${2 * mShift * q}}{${q}} = ${cPrimeFracTex}$.`,
          ],
          solution: [
            `$c' = ${cFracTex} - 2(${mShift}) = ${cPrimeFracTex} = ${roundNum(cPrimeVal, 4)}$, yani $k' = ${cPrimeFracTex}\\frac{\\pi}{a}$.`,
          ],
        },
        {
          prompt: `$k_1 = ${k1Tex}$ ve $k_2 = ${k2Tex}$ dalga sayıları $x_j = j a$ ($j \\in \\mathbb{Z}$) atom zincirinde fiziksel olarak **eşdeğer** kafes dalgaları üretir mi?`,
          kind: 'answer',
          answer: { type: 'yesno', value: makeEquiv },
          hints: [
            'İki dalga sayısı ancak ve ancak $k_1 - k_2 \\in \\frac{2\\pi}{a}\\mathbb{Z}$ (yani katsayı farkı $c_1 - c_2$ bir **çift tam sayı**) ise eşdeğerdir.',
            `$c_2 - c_1 = ${delta2}$ sayısının çift tam sayı olup olmadığına bakın.`,
          ],
          solution: [
            `$k_2 - k_1 = ${delta2}\\frac{\\pi}{a} = ${fmtFrac(delta2, 2)} \\cdot \\frac{2\\pi}{a}$.`,
            makeEquiv
              ? `$${delta2}$ çift olduğundan fark $\\frac{2\\pi}{a}\\mathbb{Z}$ içindedir: **Evet, eşdeğerdir**.`
              : `$${delta2}$ tek olduğundan fark $\\frac{2\\pi}{a}\\mathbb{Z}$ içinde değildir (örneğin $j=1$'de faz $-1$ çarpanıyla ayrılır): **Hayır, eşdeğer değildir**.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      rawParts = [
        {
          prompt: `$k = ${cFracTex}\\frac{\\pi}{a}$ dalga sayısının birinci Brillouin bölgesi $(-\\frac{\\pi}{a}, \\frac{\\pi}{a}]$ içindeki eşdeğer temsilcisi $k' = c'\\frac{\\pi}{a}$ için $c'$ kaçtır? (Kesir veya ondalık.)`,
          kind: 'answer',
          answer: { type: 'number', value: roundNum(cPrimeVal, 4), tol: 1e-3 },
          hints: [
            `$c' \\equiv ${cFracTex} \\pmod 2$ ve $-1 < c' \\le 1$ koşulunu sağlayan sayıyı bulun.`,
            `$m = ${mShift}$ için $c' = ${cFracTex} - 2(${mShift})$.`,
          ],
          solution: [
            `$k' = k - ${mShift}\\cdot\\frac{2\\pi}{a} = ${cPrimeFracTex}\\frac{\\pi}{a}$, yani $c' = ${cPrimeFracTex} = ${roundNum(cPrimeVal, 4)}$.`,
          ],
        },
        {
          prompt: `$k = k' + m \\frac{2\\pi}{a}$ eşitliğini sağlayan ters kafes kaydırma tam sayısı $m$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: mShift },
          hints: [
            `$2m = c - c' = ${cFracTex} - (${cPrimeFracTex})$.`,
          ],
          solution: [
            `$2m = ${cFracTex} - (${cPrimeFracTex}) = ${2 * mShift} \\implies m = ${mShift}$.`,
          ],
        },
        {
          prompt: `Kafes sabiti $a = ${a}\\text{ Å}$ alındığında, bu kafes titreşimini birinci Brillouin bölgesinde temsil eden en büyük fiziksel dalga boyu $\\lambda' = \\frac{2\\pi}{|k'|}$ kaç **Å**'dur? (Kesir veya en az 2 ondalık basamakla.)`,
          kind: 'answer',
          answer: { type: 'number', value: lambdaRed, tol: Math.max(0.01, lambdaRed * 0.003) },
          hints: [
            `$k' = c'\\frac{\\pi}{a}$ olduğundan $\\lambda' = \\frac{2\\pi}{|c'|\\pi/a} = \\frac{2a}{|c'|}$.`,
            `$a = ${a}$ ve $|c'| = ${fmtFrac(Math.abs(pPrime), q)}$ değerlerini yerine koyun.`,
          ],
          solution: [
            `$\\lambda' = \\frac{2a}{|c'|} = \\frac{2 \\cdot ${a}}{${fmtFrac(Math.abs(pPrime), q)}} = ${lambdaRedFrac} \\approx ${lambdaRed}\\text{ Å}$.`,
          ],
        },
        {
          prompt: `Bu dalganın atom zincirindeki uzaysal periyodu — yani tüm atomlarda $e^{i k x_{j+L}} = e^{i k x_j}$ sağlayan en küçük pozitif $L$ tam sayısı (bölüm grubu $\\mathbb{R} / \\frac{2\\pi}{a}\\mathbb{Z}$ içindeki mertebesi) — kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: wavePeriod },
          hints: [
            `$e^{i k (L a)} = e^{i (${cFracTex})\\pi L} = 1 \\iff \\frac{${Math.abs(p)}\\,L}{${2 * q}} \\in \\mathbb{Z}$.`,
            `Pay ve paydayı sadeleştirerek en küçük pozitif $L$ tam sayısını bulun.`,
          ],
          solution: [
            `$e^{i k L a} = e^{i \\pi (${p}/${q}) L} = 1 \\iff ${2 * q} \\mid ${Math.abs(p)} L$.`,
            `$\\gcd(${Math.abs(p)}, ${2 * q}) = ${gcd(Math.abs(p), 2 * q)}$ olduğundan en küçük pozitif çözüm $L = \\frac{${2 * q}}{${gcd(Math.abs(p), 2 * q)}} = ${wavePeriod}$.`,
          ],
        },
      ];
    } else {
      rawParts = [
        {
          prompt: `$k = ${cFracTex}\\frac{\\pi}{a}$ dalga sayısının birinci Brillouin bölgesindeki temsilcisi $k' = c'\\frac{\\pi}{a}$ için $c' \\in (-1, 1]$ değerini bulun.`,
          kind: 'answer',
          answer: { type: 'number', value: roundNum(cPrimeVal, 4), tol: 1e-3 },
          hints: [`$c' = c - 2m \\in (-1, 1]$ olacak şekilde tek $m \\in \\mathbb{Z}$ seçin.`],
          solution: [`$c' = ${cFracTex} - 2(${mShift}) = ${cPrimeFracTex} = ${roundNum(cPrimeVal, 4)}$.`],
        },
        {
          prompt: `Bu dalganın $\\mathbb{R} / \\frac{2\\pi}{a}\\mathbb{Z}$ bölüm grubundaki mertebesi (yani tüm atomlar için $e^{i k x_{j+L}} = e^{i k x_j}$ sağlayan en küçük pozitif $L$ atom sayısı) kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: wavePeriod },
          hints: [`$L k \\in \\frac{2\\pi}{a}\\mathbb{Z} \\iff L \\cdot \\frac{|p|}{2q} \\in \\mathbb{Z}$.`],
          solution: [
            `$L k \\in \\frac{2\\pi}{a}\\mathbb{Z} \\iff L \\cdot ${fmtFrac(Math.abs(p), 2 * q)} \\in \\mathbb{Z} \\implies L = ${wavePeriod}$.`,
          ],
        },
        {
          prompt: `$k_1 = ${k1Tex}$ ve $k_2 = ${k2Tex}$ dalga sayıları $x_j = ja$ zincirinde aynı kafes dalgasını mı tanımlar?`,
          kind: 'answer',
          answer: { type: 'yesno', value: makeEquiv },
          hints: [`$k_2 - k_1$ farkının $\\frac{2\\pi}{a}$ sayısının tam katı olup olmadığını kontrol edin.`],
          solution: [
            `$k_2 - k_1 = ${delta2}\\frac{\\pi}{a}$: $${delta2}$ ${makeEquiv ? 'çift olduğundan **Evet**' : 'tek olduğundan **Hayır**'}.`,
          ],
        },
        {
          prompt: '**Kanıt:** 1B atom zincirinde ($x_j = ja$, $j \\in \\mathbb{Z}$) her dalga sayısı $k \\in \\mathbb{R}$ için atomlar üzerindeki faz dizisini veren $\\Phi(k) = (e^{i k j a})_{j \\in \\mathbb{Z}}$ dönüşümünün $(\\mathbb{R}, +)$ grubundan bir homomorfizma olduğunu, çekirdeğinin $\\ker\\Phi = \\frac{2\\pi}{a}\\mathbb{Z}$ (ters kafes) olduğunu ve her $k \\in \\mathbb{R}$' + "'nin $(-\\pi/a, \\pi/a]$ birinci Brillouin bölgesinde benzersiz bir temsilcisi bulunduğunu kanıtlayın.",
          kind: 'proof',
          hints: [
            'Bileşen bazlı çarpma altında $e^{i(k_1+k_2)ja} = e^{ik_1ja} e^{ik_2ja}$ yazın; $j = 1$ için $e^{ika} = 1$ koşulundan çekirdeği bulun.',
          ],
          solution: [
            '**Homomorfizma:** Her $j \\in \\mathbb{Z}$ için $e^{i(k_1+k_2)ja} = e^{ik_1 ja}\\cdot e^{ik_2 ja}$ olduğundan $\\Phi(k_1 + k_2) = \\Phi(k_1)\\Phi(k_2)$.',
            '**Çekirdek:** $k \\in \\ker\\Phi \\iff \\forall j \\in \\mathbb{Z},\\; e^{ikja} = 1$. Özel olarak $j = 1$ için $e^{ika} = 1 \\iff ka \\in 2\\pi\\mathbb{Z} \\iff k \\in \\frac{2\\pi}{a}\\mathbb{Z}$. Tersine $k = \\frac{2\\pi m}{a}$ ise her $j$ için $e^{i 2\\pi m j} = 1$. Yani $\\ker\\Phi = \\frac{2\\pi}{a}\\mathbb{Z}$ ve $k \\sim k\' \\iff k - k\' \\in \\frac{2\\pi}{a}\\mathbb{Z}$.',
            '**Benzersiz temsilci:** Uzunluğu $G = \\frac{2\\pi}{a}$ olan $(-\\pi/a, \\pi/a]$ yarı-açık aralığında her $k \\in \\mathbb{R}$ için $m = \\lceil \\frac{ka}{2\\pi} - \\frac{1}{2} \\rceil$ tam sayısı $k\' = k - \\frac{2\\pi m}{a} \\in (-\\pi/a, \\pi/a]$ verir; aynı aralıktaki iki noktanın farkı $< \\frac{2\\pi}{a}$ olduğundan bu temsilci benzersizdir.',
          ],
          checklist: [
            '$\\Phi(k_1+k_2) = \\Phi(k_1)\\Phi(k_2)$ homomorfizma özelliği doğrulandı.',
            '$e^{ika} = 1 \\iff k \\in \\frac{2\\pi}{a}\\mathbb{Z}$ ile $\\ker\\Phi = \\frac{2\\pi}{a}\\mathbb{Z}$ kanıtlandı.',
            '$(-\\pi/a, \\pi/a]$ birinci Brillouin bölgesinde temsilcinin varlığı ve benzersizliği gösterildi.',
          ],
        },
      ];
    }

    return {
      title: `1B Kristal Kafes Dalgaları ve Birinci Brillouin Bölgesi ($a = ${a}\\text{ Å}$)`,
      story: `Aralarında $a = ${a}\\text{ Å}$ uzaklık bulunan tek boyutlu sonsuz bir atom zincirinde atomlar $x_j = j a$ ($j \\in \\mathbb{Z}$) noktalarındadır. $e^{i k x_j}$ düzlem dalgaları yalnızca ayrık atom konumlarında tanımlı olduğundan $k \\sim k + \\frac{2\\pi m}{a}$ ($m \\in \\mathbb{Z}$) eşdeğerliği doğar ve fiziksel olarak farklı tüm dalgalar $\\mathbb{R} / \\frac{2\\pi}{a}\\mathbb{Z}$ bölümünün $(-\\frac{\\pi}{a}, \\frac{\\pi}{a}]$ birinci Brillouin bölgesinde yaşar.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 9. ps2-kart-karistirma — Perfect out-shuffle & in-shuffle of 2m cards (m = 3..13)
// =====================================================================

const SIGN_OPTS = [
  '$+1$ (çift permütasyon)',
  '$-1$ (tek permütasyon)',
];

const T_KART_KARISTIRMA = {
  id: 'ps2-kart-karistirma',
  topic: 'Permütasyonlar ve Karıştırma',
  title: 'Kusursuz Kart Karıştırma (Out-Shuffle ve In-Shuffle)',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const mPool = level === 'isinma' ? [3, 4, 4]
      : level === 'odev' ? [4, 5, 6]
      : [6, 7, 8, 9, 10, 11, 12, 13];
    const m = rng.pick(mPool);
    const N = 2 * m;
    const kind = rng.pick(['out', 'in']);
    const isOut = kind === 'out';
    const otherKind = isOut ? 'in' : 'out';

    const perm = shufflePerm(m, kind);
    const otherPerm = shufflePerm(m, otherKind);
    const ord = permOrder(perm);
    const otherOrd = permOrder(otherPerm);
    const sgn = permSign(perm);
    const sgnChoice = shuffleChoice(rng, SIGN_OPTS[sgn === 1 ? 0 : 1], [SIGN_OPTS[sgn === 1 ? 1 : 0]]);
    const kindTr = isOut ? 'dış karıştırma (out-shuffle)' : 'iç karıştırma (in-shuffle)';
    const otherTr = isOut ? 'iç karıştırma (in-shuffle)' : 'dış karıştırma (out-shuffle)';
    const ruleTex = isOut
      ? `i \\le ${m} \\mapsto 2i - 1,\\quad i > ${m} \\mapsto 2(i - ${m})`
      : `i \\le ${m} \\mapsto 2i,\\quad i > ${m} \\mapsto 2(i - ${m}) - 1`;
    const modBase = isOut ? N - 1 : N + 1;
    const spaceNote = N >= 10 ? ' ($10$ ve üstü konumlar için sayıları boşlukla ayırın, örn. `(2 4 8)`)' : '';

    const model = { id: 'shuffle', params: { perm } };
    let rawParts;

    if (level === 'isinma') {
      rawParts = [
        {
          prompt: `$${N}$ kartlık desteye uygulanan tek bir **${kindTr}** işlemini konum permütasyonu olarak ayrık döngü gösteriminde yazın (konvansiyon: $i$ konumundaki kart $j$ konumuna gidiyorsa $i \\mapsto j$).`,
          kind: 'answer',
          answer: { type: 'perm', n: N, value: perm },
          hints: [
            `Her konumun yeni yerini kuralla hesaplayın: $${ruleTex}$.`,
            `İlk dört konum: ${[1, 2, 3, 4].map(i => `$${i} \\mapsto ${perm[i - 1]}$`).join(', ')}.`,
            `Ayrık döngü gösterimi: $${permTex(perm)}$.`,
          ],
          solution: [
            `Konum geçişleri: ${perm.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')}.`,
            `Ayrık döngü gösterimi: **$${permTex(perm)}$**.`,
          ],
        },
        {
          prompt: `Bu **${kindTr}** işlemi kaç kez arka arkaya uygulanırsa $${N}$ kartlık deste ilk kez başlangıç sırasına tamamen geri döner (permütasyonun mertebesi)?`,
          kind: 'answer',
          answer: { type: 'int', value: ord },
          hints: [
            'Bir permütasyonun mertebesi, ayrık döngülerinin uzunluklarının en küçük ortak katıdır (EKOK).',
            `Döngü uzunlukları: $${cycleType(perm).join(', ') || '1'}$.`,
            `$\\operatorname{ekok}(${cycleType(perm).join(', ') || '1'}) = ${ord}$.`,
          ],
          solution: [
            `$\\sigma = ${permTex(perm)}$ permütasyonunun ayrık döngü uzunlukları $${cycleType(perm).join(', ')}$.`,
            `Mertebe: $|\\sigma| = \\operatorname{ekok}(${cycleType(perm).join(', ')}) = ${ord}$ karıştırma.`,
          ],
        },
        {
          prompt: `Bu karıştırma permütasyonunun işareti $\\operatorname{sgn}(\\sigma)$ nedir?`,
          kind: 'answer',
          answer: sgnChoice,
          hints: [
            'Uzunluğu $L$ olan bir ayrık döngünün işareti $(-1)^{L-1}$ olup tüm permütasyonun işareti ayrık döngülerin işaretlerinin çarpımıdır.',
            `Toplam transpozisyon sayısı $\\sum (L_j - 1) = ${permCycles(perm).reduce((acc, c) => acc + c.length - 1, 0)}$.`,
            `Sonuç: **${SIGN_OPTS[sgn === 1 ? 0 : 1]}**.`,
          ],
          solution: [
            `Transpozisyon sayısı: ${permCycles(perm).map(c => `(${c.length}-1)`).join(' + ')} $= ${permCycles(perm).reduce((acc, c) => acc + c.length - 1, 0)}$ (${sgn === 1 ? 'çift' : 'tek'}).`,
            `Dolayısıyla $\\operatorname{sgn}(\\sigma) = ${sgn === 1 ? '+1' : '-1'}$.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      rawParts = [
        {
          prompt: `$${N}$ kartlık destede **${kindTr}** permütasyonunu ayrık döngü gösteriminde yazın${spaceNote}.`,
          kind: 'answer',
          answer: { type: 'perm', n: N, value: perm },
          hints: [
            `Kural ($i$ konumundaki kart $j$'ye gider): $${ruleTex}$.`,
            `İlk üç geçiş: $1 \\mapsto ${perm[0]}$, $2 \\mapsto ${perm[1]}$, $3 \\mapsto ${perm[2]}$.`,
          ],
          solution: [
            `Geçişler: ${perm.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')}.`,
            `Ayrık döngü gösterimi: **$${permTex(perm)}$**.`,
          ],
        },
        {
          prompt: `Deste kaç tane **${kindTr}** sonrasında ilk kez tamamen başlangıç sırasına döner?`,
          kind: 'answer',
          answer: { type: 'int', value: ord },
          hints: [
            `Ayrık döngü uzunluklarının EKOK'unu alın (ayrıca mod $${modBase}$ içinde $2$'nin çarpımsal mertebesi!).`,
          ],
          solution: [
            `Döngü uzunlukları $${cycleType(perm).join(', ')}$ olup $|\\sigma| = \\operatorname{ekok}(${cycleType(perm).join(', ')}) = ${ord}$ ($2^{${ord}} \\equiv 1 \\pmod{${modBase}}$).`,
          ],
        },
        {
          prompt: `Bu **${kindTr}** permütasyonunun işareti $\\operatorname{sgn}(\\sigma)$ nedir?`,
          kind: 'answer',
          answer: sgnChoice,
          hints: [
            'Her $L$-döngü $L - 1$ transpozisyona eşittir; toplamın tek/çiftliğine bakın.',
          ],
          solution: [
            `Toplam transpozisyon sayısı $\\sum(L_j - 1) = ${permCycles(perm).reduce((acc, c) => acc + c.length - 1, 0)} \\implies$ **${SIGN_OPTS[sgn === 1 ? 0 : 1]}**.`,
          ],
        },
        {
          prompt: `Aynı $${N}$ kartlık desteye bunun yerine **${otherTr}** uygulanırsa deste kaç karıştırmada başlangıç sırasına geri döner?`,
          kind: 'answer',
          answer: { type: 'int', value: otherOrd },
          hints: [
            `${isOut ? `İç karıştırmada mod $${N + 1}$ içinde $2^k \\equiv 1 \\pmod{${N + 1}}$` : `Dış karıştırmada mod $${N - 1}$ içinde $2^k \\equiv 1 \\pmod{${N - 1}}$`} sağlayan en küçük $k \\ge 1$'i bulun.`,
          ],
          solution: [
            `${otherTr} permütasyonu: $${permTex(otherPerm)}$; döngü uzunluklarının EKOK'u **$${otherOrd}$** ($2^{${otherOrd}} \\equiv 1 \\pmod{${isOut ? N + 1 : N - 1}}$).`,
          ],
        },
      ];
    } else {
      // zorlayici: m in 6..13 (up to 26 cards!), order via modular doubling, single card cycle length, sign, proof
      const movingPos = Array.from({ length: N }, (_, i) => i + 1).filter(i => perm[i - 1] !== i);
      const trackPos = rng.pick(movingPos);
      const trackLen = cycleLengthOf(perm, trackPos);
      const totalSwaps = permCycles(perm).reduce((acc, c) => acc + c.length - 1, 0);

      rawParts = [
        {
          prompt: `$${N}$ kartlık ($m = ${m}$) destede **${kindTr}** işlemi kaç kez uygulanırsa tüm deste ilk kez başlangıç sırasına döner?`,
          kind: 'answer',
          answer: { type: 'int', value: ord },
          hints: [
            isOut
              ? `Dış karıştırmada $i - 1 \\mapsto 2(i - 1) \\pmod{${N - 1}}$ ($1 \\le i \\le ${N - 1}$); bu nedenle deste $2^k \\equiv 1 \\pmod{${N - 1}}$ sağlayan en küçük $k \\ge 1$ adımda geri döner.`
              : `İç karıştırmada $i \\mapsto 2i \\pmod{${N + 1}}$; deste $2^k \\equiv 1 \\pmod{${N + 1}}$ sağlayan en küçük $k \\ge 1$ adımda geri döner.`,
          ],
          solution: [
            `Mod $${modBase}$ içinde $2$'nin kuvvetleri hesaplandığında $2^{${ord}} \\equiv 1 \\pmod{${modBase}}$ en küçük pozitif üssü verir.`,
            `Ayrık döngü uzunlukları $${cycleType(perm).join(', ')}$ olup EKOK = **$${ord}$**.`,
          ],
        },
        {
          prompt: `Başlangıçta **$${trackPos}$. konumda** duran tek bir kart, kaç tane **${kindTr}** sonrasında ilk kez yeniden $${trackPos}$. konuma geri döner?`,
          kind: 'answer',
          answer: { type: 'int', value: trackLen },
          hints: [
            `Yalnızca $${trackPos}$ konumunun yörüngesini ($${trackPos} \\mapsto ${perm[trackPos - 1]} \\mapsto \\dots$) takip edin.`,
          ],
          solution: [
            `Yörünge: ${(() => { const seq = [trackPos]; let c = perm[trackPos - 1]; while (c !== trackPos) { seq.push(c); c = perm[c - 1]; } seq.push(trackPos); return seq.map(String).join(' \\to '); })()}.`,
            `Döngü uzunluğu: **$${trackLen}$** karıştırma.`,
          ],
        },
        {
          prompt: `$${N}$ kartlık destede bu **${kindTr}** permütasyonunun işareti $\\operatorname{sgn}(\\sigma)$ nedir?`,
          kind: 'answer',
          answer: sgnChoice,
          hints: [
            `Her $L$-döngü $L - 1$ transpozisyon verir (veya tek bir ${kindTr}'da ters sırada kalan kart çiftlerini — yani alt yarının $k$. kartının üst yarının kaç kartını geçtiğini — sayın!).`,
          ],
          solution: [
            isOut
              ? `Dış karıştırmada tersine çevrilen çift (inversion) sayısı $1 + 2 + \\dots + (${m}-1) = \\frac{${m}(${m}-1)}{2} = ${(m * (m - 1)) / 2}$ (ayrıca $\\sum(L_j-1) = ${totalSwaps}$, aynı parite!).`
              : `İç karıştırmada tersine çevrilen çift (inversion) sayısı $1 + 2 + \\dots + ${m} = \\frac{${m}(${m}+1)}{2} = ${(m * (m + 1)) / 2}$ (ayrıca $\\sum(L_j-1) = ${totalSwaps}$, aynı parite!).`,
            `Dolayısıyla $\\operatorname{sgn}(\\sigma) = ${sgn === 1 ? '+1$ (çift)' : '-1$ (tek)'}.`,
          ],
        },
        {
          prompt: '**Kanıt:** $2m$ kartlık bir destede (i) dış karıştırmanın $1 \\le i \\le 2m - 1$ için $(i - 1) \\mapsto 2(i - 1) \\pmod{2m - 1}$ (ve $2m \\mapsto 2m$) ile, iç karıştırmanın ise $1 \\le i \\le 2m$ için $i \\mapsto 2i \\pmod{2m + 1}$ ile verildiğini kanıtlayın; (ii) buradan desteyi başlangıca döndüren karıştırma sayısının sırasıyla $\\operatorname{ord}_{2m-1}(2)$ ve $\\operatorname{ord}_{2m+1}(2)$ olduğunu çıkarın.',
          kind: 'proof',
          hints: [
            '$i \\le m$ ve $i > m$ iki durumunu ayrı ayrı $2(i-1) \\bmod (2m-1)$ (ve $2i \\bmod (2m+1)$) ile karşılaştırın; $k$ kez tekrarlanınca $2^k$ ile çarpıldığını kullanın.',
          ],
          solution: [
            '**(i) Dış karıştırma:** $x = i - 1 \\in \\{0, \\dots, 2m-2\\}$ olsun. $i \\le m$ için yeni konum $2i - 1$, yani $x\' = 2i - 2 = 2x \\in [0, 2m-2]$. $m+1 \\le i \\le 2m-1$ için yeni konum $2(i - m)$, yani $x\' = 2i - 2m - 1 = 2(i-1) - (2m - 1) \\equiv 2x \\pmod{2m-1}$. Son kart $2m \\mapsto 2m$ sabit kalır.',
            '**İç karıştırma:** $i \\le m$ için yeni konum $2i \\in [2, 2m]$; $m+1 \\le i \\le 2m$ için yeni konum $2(i - m) - 1 = 2i - (2m + 1) \\equiv 2i \\pmod{2m+1}$.',
            '**(ii) Mertebe:** $k$ kez uygulama $x \\mapsto 2^k x \\pmod{M}$ ($M = 2m \\mp 1$) üretir. Tüm kartların başlangıca dönmesi $2^k x \\equiv x \\pmod M$ ($\\forall x$) $\\iff 2^k \\equiv 1 \\pmod M$ (çünkü $x = 1$ konumu test etmek yeterlidir!). Dolayısıyla en küçük pozitif $k$, $2$' + "'nin mod $M$ çarpımsal mertebesi $\\operatorname{ord}_{2m \\mp 1}(2)$ olur.",
          ],
          checklist: [
            'Hem üst yarı ($i \\le m$) hem alt yarı ($i > m$) için mod $2m-1$ (dış) ve mod $2m+1$ (iç) ikiyle çarpma kuralı kanıtlandı.',
            '$k$ kez karıştırmanın $2^k$ çarpanı verdiği gösterildi.',
            '$x = 1$ üzerinden tüm destenin geri dönme koşulunun $2^k \\equiv 1 \\pmod{2m \\mp 1}$ olduğu sonuçlandırıldı.',
          ],
        },
      ];
    }

    return {
      title: `$${N}$ Kartlık Destede Kusursuz ${isOut ? 'Dış' : 'İç'} Karıştırma`,
      story: `$${N}$ kartlık ($m = ${m}$) bir deste tam ortadan ikiye ayrılıp kusursuz **${kindTr}** ile iç içe geçiriliyor. **Konvansiyon:** $i$ konumundaki kart yeni $j$ konumuna taşındığında bunu $i \\mapsto j$ konum permütasyonu olarak yazıyoruz ($${ruleTex}$).`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 10. ps2-tekrarlama-landau — Reversible dynamics recurrence & Landau's function g(N)
// =====================================================================

function buildReversiblePerm(rng, N, cycleLens) {
  const labels = rng.shuffle(Array.from({ length: N }, (_, i) => i + 1));
  const p = permId(N);
  let offset = 0;
  for (const len of cycleLens) {
    for (let i = 0; i < len; i++) {
      p[labels[offset + i] - 1] = labels[offset + ((i + 1) % len)];
    }
    offset += len;
  }
  return p;
}

const T_TEKRARLAMA_LANDAU = {
  id: 'ps2-tekrarlama-landau',
  topic: 'Permütasyonlar ve Karıştırma',
  title: 'Tersinir Dinamikte Tekrarlama Süresi ve $S_N$\'de En Büyük Mertebe',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const configs = [
        { N: 6, lens: [4, 2] },
        { N: 6, lens: [3, 2, 1] },
        { N: 7, lens: [4, 3] },
        { N: 7, lens: [5, 2] },
        { N: 8, lens: [5, 3] },
        { N: 8, lens: [4, 3, 1] },
        { N: 8, lens: [6, 2] },
      ];
      const { N, lens } = rng.pick(configs);
      const p = buildReversiblePerm(rng, N, lens);
      const ord = permOrder(p);
      const moving = Array.from({ length: N }, (_, i) => i + 1).filter(i => p[i - 1] !== i);
      const particle = rng.pick(moving);
      const partRet = cycleLengthOf(p, particle);
      const mapList = p.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ');

      return {
        title: `Tersinir Hücre Dinamiği ve Tekrarlama Periyodu ($N = ${N}$)`,
        story: `$N = ${N}$ ayrık bölmeli kapalı bir sistemde her bölmede etiketli bir parçacık bulunuyor. Deterministik ve tersinir bir güncelleme adımı bölmeleri şu kurala göre permüte ediyor: ${mapList}.`,
        model: { id: 'shuffle', params: { perm: p } },
        parts: makeLabels([
          {
            prompt: `Bu güncelleme kuralını $S_{${N}}$ içinde ayrık döngü gösterimiyle yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: N, value: p },
            hints: [
              '$1$ konumundan başlayıp $1 \\mapsto p(1) \\mapsto p(p(1)) \\mapsto \\dots$ zincirini $1$' + "'e dönene kadar izleyin.",
              'Henüz kullanılmamış en küçük konumdan yeni bir döngü açın; sabit kalan noktaları (1-döngüleri) yazmayın.',
              `Sonuç: $${permTex(p)}$.`,
            ],
            solution: [
              `Geçişler izlendiğinde ayrık döngü ayrışımı: **$\\sigma = ${permTex(p)}$**.`,
            ],
          },
          {
            prompt: `Başlangıçta **$${particle}$. bölmede** bulunan tek bir parçacık kaç adım sonra ilk kez kendi başlangıç bölmesine geri döner?`,
            kind: 'answer',
            answer: { type: 'int', value: partRet },
            hints: [
              'Tek bir parçacığın dönüş süresi, içinde yer aldığı ayrık döngünün uzunluğudur.',
              `$${particle}$ sayısının bulunduğu döngüyü $\\sigma = ${permTex(p)}$ içinde bulun ve eleman sayısını sayın.`,
              `Döngü uzunluğu $${partRet}$.`,
            ],
            solution: [
              `$${particle}$ konumunun yörüngesi uzunluğu **$${partRet}$** olan bir ayrık döngüdür; parçacık $${partRet}$ adımda başlangıca döner.`,
            ],
          },
          {
            prompt: `**Tüm $${N}$ parçacığın** aynı anda ilk kez başlangıç bölmelerine dönmesi (sistemin ilk Poincaré tekrarlaması) kaç adım sürer?`,
            kind: 'answer',
            answer: { type: 'int', value: ord },
            hints: [
              'Tüm döngülerin aynı anda tamamlanması için adım sayısı her bir döngü uzunluğunun ortak katı olmalıdır.',
              `İlk tekrarlama süresi $|\\sigma| = \\operatorname{ekok}(${cycleType(p).join(', ')})$.`,
              `Sonuç: $${ord}$ adım.`,
            ],
            solution: [
              `Ayrık döngü uzunlukları $${cycleType(p).join(', ')}$ olduğundan ilk tam tekrarlama süresi $|\\sigma| = \\operatorname{ekok}(${cycleType(p).join(', ')}) = ${ord}$ adımdır.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const N = rng.pick([7, 8, 9]);
      // Compose two disjoint-or-overlapping simple steps alpha o beta (right-to-left)
      let alpha, beta, sigma;
      for (let tries = 0; tries < 30; tries++) {
        alpha = buildReversiblePerm(rng, N, N === 7 ? [3, 2, 2] : N === 8 ? [4, 2, 2] : [4, 3, 2]);
        beta = buildReversiblePerm(rng, N, N === 7 ? [2, 2, 3] : N === 8 ? [3, 3, 2] : [3, 3, 3]);
        sigma = permMul(alpha, beta);
        if (permOrder(sigma) >= 6 && permCycles(sigma).length >= 2) break;
      }
      const ord = permOrder(sigma);
      const moving = Array.from({ length: N }, (_, i) => i + 1).filter(i => sigma[i - 1] !== i);
      const particle = rng.pick(moving);
      const partRet = cycleLengthOf(sigma, particle);

      // Landau N with strictly unique non-trivial optimal cycle type
      const landauN = rng.pick([5, 7, 8, 9, 10]);
      const landau = LANDAU_INFO.get(landauN);

      return {
        title: `Bileşik Tersinir Dinamik ($N = ${N}$) ve $S_{${landauN}}$'de En Büyük Mertebe`,
        story: `$N = ${N}$ bölmeli bir sistemde tek bir zaman adımı önce $\\beta = ${permTex(beta)}$, ardından $\\alpha = ${permTex(alpha)}$ işleminin uygulanmasından oluşuyor (sağdan sola kuralıyla $\\sigma = \\alpha \\circ \\beta$). Hem bu sistemin tekrarlama süresini hem de $S_{${landauN}}$ grubunda ulaşılabilecek en büyük periyodu (Landau fonksiyonu $g(${landauN})$) inceleyelim.`,
        model: { id: 'shuffle', params: { perm: sigma } },
        parts: makeLabels([
          {
            prompt: `Bileşik adım $\\sigma = \\alpha \\circ \\beta$ (önce $\\beta$, sonra $\\alpha$) için tüm sistemin ilk tekrarlama süresi $|\\sigma|$ kaç adımdır?`,
            kind: 'answer',
            answer: { type: 'int', value: ord },
            hints: [
              `Her $i \\in \\{1, \\dots, ${N}\\}$ için $\\sigma(i) = \\alpha(\\beta(i))$ değerini hesaplayıp $\\sigma$'yı ayrık döngülere ayırın.`,
              `$\\sigma = ${permTex(sigma)}$ olup döngü uzunlukları $${cycleType(sigma).join(', ')}$.`,
            ],
            solution: [
              `Sağdan sola bileşke: $\\sigma = \\alpha \\circ \\beta = ${permTex(sigma)}$.`,
              `Döngü uzunlukları $${cycleType(sigma).join(', ')}$ olduğundan ilk tam tekrarlama $|\\sigma| = \\operatorname{ekok}(${cycleType(sigma).join(', ')}) = ${ord}$ adımdır.`,
            ],
          },
          {
            prompt: `Bu $\\sigma$ dinamiği altında **$${particle}$. bölmedeki** parçacığın ilk dönüş süresi kaç adımdır?`,
            kind: 'answer',
            answer: { type: 'int', value: partRet },
            hints: [
              `$\\sigma = ${permTex(sigma)}$ içinde $${particle}$ sayısının bulunduğu ayrık döngünün uzunluğunu okuyun.`,
            ],
            solution: [
              `$${particle}$ sayısı uzunluğu **$${partRet}$** olan döngüde yer alır; dönüş süresi $${partRet}$ adımdır.`,
            ],
          },
          {
            prompt: `$N' = ${landauN}$ bölmeli bir sistemde herhangi bir tersinir kuralın ($\\tau \\in S_{${landauN}}$) ulaşabileceği **en büyük** tekrarlama periyodu (Landau fonksiyonu $g(${landauN})$) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: landau.maxOrd },
            hints: [
              `Toplamları $\\le ${landauN}$ olan ve aralarında asal asal-kuvvetlerden oluşan döngü uzunluklarının en büyük EKOK'unu arayın.`,
              `En iyi bölünüş: $${landau.uniqueNonTriv.join(' + ')} = ${landau.uniqueNonTriv.reduce((a, b) => a + b, 0)} \\le ${landauN}$.`,
            ],
            solution: [
              `$${landauN}$ sayısının pozitif tam sayı bölünüşleri içinde en büyük EKOK, $${landau.uniqueNonTriv.join(', ')}$ döngü uzunluklarıyla elde edilir: $g(${landauN}) = \\operatorname{ekok}(${landau.uniqueNonTriv.join(', ')}) = ${landau.maxOrd}$.`,
            ],
          },
          {
            prompt: `$S_{${landauN}}$ içinde mertebesi $g(${landauN}) = ${landau.maxOrd}$ olan bir permütasyon kurmak için seçilmesi gereken ($1$'den büyük) ayrık döngü uzunluklarını **büyükten küçüğe sıralı** olarak yazın (virgülle ayırın).`,
            kind: 'answer',
            answer: { type: 'intlist', value: landau.uniqueNonTriv },
            hints: [
              `Çarpımı (ve EKOK'u) $${landau.maxOrd}$ olan, toplamı $${landauN}$'yi aşmayan aralarında asal döngü uzunluklarını büyükten küçüğe sıralayın.`,
            ],
            solution: [
              `Ayrık döngü uzunlukları **$${landau.uniqueNonTriv.join(', ')}$** (örneğin bu uzunluklarda ardışık ayrık döngüler yazılarak $S_{${landauN}}$ içinde mertebesi $${landau.maxOrd}$ olan bir eleman kurulur).`,
            ],
          },
        ]),
      };
    }

    // zorlayici: composition + Landau up to N=16 + constructing given order + proof
    const N = rng.pick([7, 8, 9]);
    let alpha, beta, sigma;
    for (let tries = 0; tries < 30; tries++) {
      alpha = buildReversiblePerm(rng, N, N === 7 ? [4, 3] : N === 8 ? [5, 3] : [5, 4]);
      beta = buildReversiblePerm(rng, N, N === 7 ? [3, 2, 2] : N === 8 ? [4, 2, 2] : [4, 3, 2]);
      sigma = permMul(alpha, beta);
      if (permOrder(sigma) >= 6) break;
    }
    const ord = permOrder(sigma);

    // Strictly unique optimal cycle types for Landau N in {8, 9, 10, 12, 14, 15, 16}
    const landauN = rng.pick([8, 9, 10, 12, 14, 15, 16]);
    const landau = LANDAU_INFO.get(landauN);

    return {
      title: `Tekrarlama Süresi ve Landau Fonksiyonu $g(${landauN})$`,
      story: `$N = ${N}$ bölmeli tersinir bir mikroskobik dinamiğin bir adımı $\\sigma = \\alpha \\circ \\beta$ (önce $\\beta = ${permTex(beta)}$, sonra $\\alpha = ${permTex(alpha)}$) permütasyonuyla veriliyor. Ayrıca daha büyük $S_{${landauN}}$ grubunda ulaşılabilecek maksimum tekrarlama süresini ($g(${landauN})$) ve bunu gerçekleştiren döngü yapısını belirleyelim.`,
      model: { id: 'shuffle', params: { perm: sigma } },
      parts: makeLabels([
        {
          prompt: `Bileşik tersinir adım $\\sigma = \\alpha \\circ \\beta \\in S_{${N}}$ için ilk tam tekrarlama süresi $|\\sigma|$ kaç adımdır?`,
          kind: 'answer',
          answer: { type: 'int', value: ord },
          hints: [`Sağdan sola $\\sigma(i) = \\alpha(\\beta(i))$ hesaplayıp ayrık döngü uzunluklarının EKOK'unu alın.`],
          solution: [`$\\sigma = ${permTex(sigma)}$, döngü uzunlukları $${cycleType(sigma).join(', ')} \\implies |\\sigma| = ${ord}$.`],
        },
        {
          prompt: `$S_{${landauN}}$ simetrik grubundaki bir elemanın sahip olabileceği **en büyük mertebe** (Landau fonksiyonu $g(${landauN})$) kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: landau.maxOrd },
          hints: [
            `Toplamları $\\le ${landauN}$ olan farklı asal sayıların kuvvetlerini seçip çarpımlarını en büyük yapın.`,
          ],
          solution: [
            `Asal kuvvet seçimi $${landau.uniqueNonTriv.join(', ')}$ (toplam $${landau.uniqueNonTriv.reduce((a, b) => a + b, 0)} \\le ${landauN}$) en büyük EKOK'u verir: $g(${landauN}) = ${landau.maxOrd}$.`,
          ],
        },
        {
          prompt: `$S_{${landauN}}$ içinde mertebesi $g(${landauN}) = ${landau.maxOrd}$ olan elemanı kurmak için gereken ($1$'den büyük) ayrık döngü uzunluklarını **büyükten küçüğe sıralı** yazın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: landau.uniqueNonTriv },
          hints: [
            `$${landau.maxOrd}$ sayısını aralarında asal asal-kuvvet çarpanlarına ayırıp toplamlarının $${landauN}$'yi aşmadığını doğrulayın.`,
          ],
          solution: [
            `Benzersiz optimal döngü uzunlukları: **$${landau.uniqueNonTriv.join(', ')}$**.`,
          ],
        },
        {
          prompt: '**Kanıt:** (i) Ayrık döngülerin kendi aralarında değişmeli olmasından hareketle $\\sigma = c_1 c_2 \\cdots c_r$ ayrık döngü ayrışımı için $|\\sigma| = \\operatorname{ekok}(|c_1|, \\dots, |c_r|)$ olduğunu kanıtlayın; (ii) $a, b \\ge 2$ ve $\\gcd(a, b) = 1$ için $a + b \\le ab$ eşitsizliğini kullanarak $S_N$\'de maksimum mertebeye her zaman asal-kuvvet uzunluklu ayrık döngülerle ulaşılabileceğini gösterin.',
          kind: 'proof',
          hints: [
            '(i) için $\\sigma^k = c_1^k \\cdots c_r^k = e \\iff \\forall j,\\, c_j^k = e$ yazın; (ii) için $(a-1)(b-1) \\ge 1 \\implies a + b \\le ab$ kullanarak $ab$-döngüsünü $a$- ve $b$-döngüsüne ayırın.',
          ],
          solution: [
            '**(i) EKOK formülü:** Ayrık döngüler farklı elemanlara etki ettiğinden $c_i c_j = c_j c_i$, dolayısıyla $\\sigma^k = c_1^k c_2^k \\cdots c_r^k$. Yine ayrık desteklerden ötürü $\\sigma^k = e \\iff \\forall j,\\; c_j^k = e \\iff \\forall j,\\; |c_j| \\mid k$. En küçük pozitif ortak kat $\\operatorname{ekok}(|c_1|, \\dots, |c_r|)$ olur.',
            '**(ii) Asal-kuvvet ilkesi:** Bir döngü uzunluğu $L = ab$ ($a, b \\ge 2$, $\\gcd(a, b) = 1$) bileşik olsun. $(a - 1)(b - 1) \\ge 1 \\implies ab - a - b \\ge 0 \\implies a + b \\le ab$. Dolayısıyla uzunluğu $ab$ olan tek döngüyü uzunlukları $a$ ve $b$ olan iki ayrık döngüyle (ve $ab - a - b$ sabit noktayla) değiştirmek EKOK\'u ($\\operatorname{ekok}(a, b) = ab$) hiç azaltmadan daha az veya eşit yer harcar. Tekrarlandığında tüm uzunluklar asal kuvvetlere indirgenir.',
          ],
          checklist: [
            'Ayrık döngülerin değişmeliliğiyle $\\sigma^k = c_1^k \\cdots c_r^k$ ve ayrık destek nedeniyle $\\forall j,\\, |c_j| \\mid k$ kanıtlandı.',
            '$(a - 1)(b - 1) \\ge 1 \\implies a + b \\le ab$ eşitsizliği kuruldu.',
            'Aralarında asal $a, b$ için $ab$-döngüsünü $a$ ve $b$ döngülerine bölmenin EKOK\'u koruyup toplam uzunluğu azalttığı gösterildi.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 11. ps2-onbes-bulmacasi — 15-puzzle (and 8 / 3 puzzles): parity & solvability
// =====================================================================

const T_ONBES_BULMACASI = {
  id: 'ps2-onbes-bulmacasi',
  topic: '15 Bulmacası ve Parite',
  title: '15 Bulmacası (ve 8 / 3 Bulmacaları): Permütasyon Paritesi ve Çözülebilirlik',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      // Classic blank-home cases on 15-puzzle (including Sam Loyd 14<->15!)
      const caseType = rng.pick(['loyd', 'swap', '3cycle', '2swaps', '4cycle']);
      const tiles = Array.from({ length: 15 }, (_, i) => i + 1).concat([0]);
      let desc;
      if (caseType === 'loyd') {
        [tiles[13], tiles[14]] = [tiles[14], tiles[13]];
        desc = 'çözülmüş 15-bulmacasında yalnızca **$14$ ve $15$** taşları yer değiştirmiştir (Sam Loyd bulmacası; boş kare sağ alt köşededir)';
      } else if (caseType === 'swap') {
        const [a, b] = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 2).sort((x, y) => x - y);
        [tiles[a - 1], tiles[b - 1]] = [tiles[b - 1], tiles[a - 1]];
        desc = `çözülmüş 15-bulmacasında yalnızca **$${a}$ ve $${b}$** taşları yer değiştirmiştir (boş kare sağ alt köşededir)`;
      } else if (caseType === '3cycle') {
        const [a, b, c] = rng.sample([10, 11, 12, 13, 14, 15], 3).sort((x, y) => x - y);
        tiles[a - 1] = b; tiles[b - 1] = c; tiles[c - 1] = a;
        desc = `çözülmüş 15-bulmacasında yalnızca **$${a}, ${b}, ${c}$** taşları bir $3$-döngü oluşturacak biçimde ($${a} \\to ${b} \\to ${c} \\to ${a}$) kaydırılmıştır (boş kare sağ alt köşededir)`;
      } else if (caseType === '2swaps') {
        const picked = rng.sample([9, 10, 11, 12, 13, 14, 15], 4).sort((x, y) => x - y);
        const [a, b, c, d] = picked;
        [tiles[a - 1], tiles[b - 1]] = [tiles[b - 1], tiles[a - 1]];
        [tiles[c - 1], tiles[d - 1]] = [tiles[d - 1], tiles[c - 1]];
        desc = `çözülmüş 15-bulmacasında **$${a} \\leftrightarrow ${b}$** ve **$${c} \\leftrightarrow ${d}$** olmak üzere ayrık iki taş çifti yer değiştirmiştir (boş kare sağ alt köşededir)`;
      } else {
        const [a, b, c, d] = rng.sample([11, 12, 13, 14, 15], 4).sort((x, y) => x - y);
        tiles[a - 1] = b; tiles[b - 1] = c; tiles[c - 1] = d; tiles[d - 1] = a;
        desc = `çözülmüş 15-bulmacasında **$${a}, ${b}, ${c}, ${d}$** taşları bir $4$-döngü ($${a} \\to ${b} \\to ${c} \\to ${d} \\to ${a}$) oluşturacak biçimde yerleştirilmiştir (boş kare sağ alt köşededir)`;
      }

      const info = puzzleAnalyze(tiles, 4);
      const sgnChoice = shuffleChoice(rng, SIGN_OPTS[info.fullSign === 1 ? 0 : 1], [SIGN_OPTS[info.fullSign === 1 ? 1 : 0]]);

      // Contrast with reversed k x k puzzle (blank home)
      const revSide = rng.pick([2, 3, 4]);
      const revN = revSide * revSide - 1;
      const revBoard = Array.from({ length: revN }, (_, i) => revN - i).concat([0]);
      const revInfo = puzzleAnalyze(revBoard, revSide);
      const revSwaps = Math.floor(revN / 2);

      return {
        title: '15 Bulmacasında Parite ve Çözülebilirlik',
        story: `Klasik $4 \\times 4$ 15-bulmacasında her yasal hamle, boş kareyi komşu bir taşla yer değiştiren bir transpozisyondur. Dama tahtası renklendirmesi gereği boş kare başlangıçtaki sağ alt köşeye yalnızca **çift** sayıda hamlede dönebilir. İncelenen dizilimde ${desc}:\n\n$$${puzzleMatrixTex(tiles, 4)}$$`,
        model: { id: 'puzzle15', params: { tiles } },
        parts: makeLabels([
          {
            prompt: `Boş kare sağ alt köşedeyken bu taş diziliminin permütasyon işareti $\\operatorname{sgn}(\\pi)$ nedir?`,
            kind: 'answer',
            answer: sgnChoice,
            hints: [
              'Uzunluğu $L$ olan bir ayrık döngünün işareti $(-1)^{L-1}$ olur: tek bir takas ($2$-döngü) $-1$, $3$-döngü $+1$, iki takas $+1$, $4$-döngü $-1$.',
              `Bu dizilimin ayrık döngü gösterimi: $${permTex(info.fullPerm)}$.`,
              `İşaret: **${SIGN_OPTS[info.fullSign === 1 ? 0 : 1]}**.`,
            ],
            solution: [
              `Permütasyon $\\pi = ${permTex(info.fullPerm)}$ olup $\\operatorname{sgn}(\\pi) = ${info.fullSign === 1 ? '+1$ (çift permütasyon)' : '-1$ (tek permütasyon)'}.`,
            ],
          },
          {
            prompt: `Bu 15-bulmaca dizilimi yasal hamlelerle **çözülebilir** (başlangıç dizilimine getirilebilir) midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: info.solvable },
            hints: [
              'Boş kare başlangıç köşesindeyken yalnızca **çift** permütasyonlar ($\\operatorname{sgn}(\\pi) = +1$, yani $A_{15}$ elemanları) çözülebilir.',
              `Önceki şıkta $\\operatorname{sgn}(\\pi) = ${info.fullSign === 1 ? '+1' : '-1'}$ buldunuz.`,
            ],
            solution: [
              `Boş kare köşede olduğundan çözülebilirlik $\\iff \\operatorname{sgn}(\\pi) = +1$. Burada $\\operatorname{sgn}(\\pi) = ${info.fullSign === 1 ? '+1$' : '-1$'} olduğundan cevap **${info.solvable ? 'Evet, çözülebilir' : 'Hayır, çözülemez'}**.`,
            ],
          },
          {
            prompt: `Şimdi $${revSide} \\times ${revSide}$ boyutlu **${revN}-bulmacasında** boş kare sağ alt köşede kalmak üzere tüm taşların tamamen **ters sırada** ($${revN}, ${revN - 1}, \\dots, 2, 1, \\square$) dizildiğini düşünün. Bu ters dizilim çözülebilir midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: revInfo.solvable },
            hints: [
              `Ters sıralama $(1\\,${revN})(2\\,${revN - 1})\\cdots$ biçiminde tam $\\lfloor ${revN}/2 \\rfloor = ${revSwaps}$ ayrık transpozisyondan (ve $\\binom{${revN}}{2} = ${revInfo.inversions}$ terslenmeden) oluşur.`,
              `$${revSwaps}$ sayısı ${revSwaps % 2 === 0 ? 'çift' : 'tek'} olduğundan işaret $(-1)^{${revSwaps}} = ${revInfo.fullSign === 1 ? '+1' : '-1'}$.`,
            ],
            solution: [
              `$${revN}, \\dots, 1$ dizilimi $${revSwaps}$ ayrık transpozisyondan oluşur ($${revInfo.inversions}$ terslenme).`,
              `$\\operatorname{sgn} = (-1)^{${revSwaps}} = ${revInfo.fullSign === 1 ? '+1$' : '-1$'} olduğundan **${revInfo.solvable ? 'Evet, çözülebilir' : 'Hayır, çözülemez'}**!`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      // Board 1: 15-puzzle with tiles 1..9 solved and 10..15 randomly permuted (blank home) — hand-checkable!
      const tail = rng.shuffle([10, 11, 12, 13, 14, 15]);
      // Ensure non-identity
      if (tail.every((v, i) => v === 10 + i)) [tail[4], tail[5]] = [tail[5], tail[4]];
      const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, ...tail, 0];
      const info1 = puzzleAnalyze(tiles, 4);

      // Board 2: 8-puzzle (3x3) with blank NOT at home (displaced by 1, 2, or 3 cells)
      const perm8 = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      // Make sure blank is not at bottom-right (index 8)
      if (perm8[8] === 0) {
        const swapPos = rng.int(0, 7);
        [perm8[8], perm8[swapPos]] = [perm8[swapPos], perm8[8]];
      }
      const info2 = puzzleAnalyze(perm8, 3);

      return {
        title: '15 Bulmacası ve 8 Bulmacasında Terslenme ile Parite Değişmezi',
        story: `Aşağıdaki $4 \\times 4$ 15-bulmacasında ilk $9$ taş yerindedir, son $6$ taş karıştırılmış ve boş kare sağ alt köşede bırakılmıştır:\n\n$$A = ${puzzleMatrixTex(tiles, 4)}$$\n\nİkinci olarak, boş karenin köşeden ayrıldığı bir $3 \\times 3$ 8-bulmacası veriliyor:\n\n$$B = ${puzzleMatrixTex(perm8, 3)}$$`,
        model: { id: 'puzzle15', params: { tiles } },
        parts: makeLabels([
          {
            prompt: `$A$ (15-bulmacası) dizilimindeki toplam **terslenme (inversion)** sayısı — yani $i < j$ iken $A_i > A_j$ sağlayan taş çiftlerinin sayısı — kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: info1.inversions },
            hints: [
              'İlk $9$ taş ($1..9$) sıralı olduğu için terslenmeler yalnızca son $6$ taş ($' + tail.join(', ') + '$) arasında ortaya çıkar.',
              'Her taşın sağında kendisinden küçük kaç taş olduğunu sayıp toplayın.',
            ],
            solution: [
              `Son $6$ taş dizisi $(${tail.join(',\\,')})$ içindeki terslenmeler sayıldığında toplam **$${info1.inversions}$** terslenme bulunur (işaret $(-1)^{${info1.inversions}} = ${info1.fullSign === 1 ? '+1' : '-1'}$).`,
            ],
          },
          {
            prompt: `$A$ (15-bulmacası) dizilimi çözülebilir midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: info1.solvable },
            hints: [
              'Boş kare sağ alt köşedeyken terslenme sayısı çift ($\\operatorname{sgn} = +1$) ise çözülebilir, tekse çözülemez.',
            ],
            solution: [
              `Terslenme sayısı $${info1.inversions}$ (${info1.inversions % 2 === 0 ? 'çift' : 'tek'}) ve boş kare köşede olduğundan **${info1.solvable ? 'Evet, çözülebilir' : 'Hayır, çözülemez'}**.`,
            ],
          },
          {
            prompt: `$B$ ($3 \\times 3$ 8-bulmacası) diziliminde boş karenin ($\\square$) sağ alt hedef köşeye olan **Manhattan (taksi) uzaklığı** $d = |3 - r| + |3 - c|$ kaçtır? ($r, c \\in \\{1, 2, 3\\}$.)`,
            kind: 'answer',
            answer: { type: 'int', value: info2.blankTaxicab },
            hints: [
              `Boş kare $${info2.blankRow + 1}$. satır ve $${info2.blankCol + 1}$. sütundadır.`,
              `$d = (3 - ${info2.blankRow + 1}) + (3 - ${info2.blankCol + 1})$.`,
            ],
            solution: [
              `Boş kare $(${info2.blankRow + 1}, ${info2.blankCol + 1})$ konumunda: $d = (3 - ${info2.blankRow + 1}) + (3 - ${info2.blankCol + 1}) = ${info2.blankTaxicab}$.`,
            ],
          },
          {
            prompt: `$B$ ($3 \\times 3$ 8-bulmacası) dizilimi yasal hamlelerle çözülebilir midir?`,
            kind: 'answer',
            answer: { type: 'yesno', value: info2.solvable },
            hints: [
              'Genel kural (tüm $k \\times k$ tahtalar için!): boş kareyi de $k^2$. eleman sayarak oluşturulan tüm hücre permütasyonu $\\pi_{\\text{tüm}}$ için $\\operatorname{sgn}(\\pi_{\\text{tüm}}) = (-1)^d$ sağlanmalıdır (tek genişlikli $3 \\times 3$ tahtada bu, boş kare hariç taş terslenmelerinin çift olmasına denktir!).',
              `$B$ içindeki taş terslenme sayısı $${info2.inversions}$ (ve $\\operatorname{sgn}(\\pi_{\\text{tüm}}) = ${info2.fullSign === 1 ? '+1' : '-1'}$, $(-1)^d = ${info2.blankParity === 1 ? '+1' : '-1'}$).`,
            ],
            solution: [
              `$\\pi_{\\text{tüm}} = ${permTex(info2.fullPerm)}$ ($\\operatorname{sgn} = ${info2.fullSign === 1 ? '+1' : '-1'}$) ve $(-1)^d = (-1)^{${info2.blankTaxicab}} = ${info2.blankParity === 1 ? '+1' : '-1'}$.`,
              `Değişmez $\\operatorname{sgn}(\\pi_{\\text{tüm}})\\cdot(-1)^d = ${info2.invariant === 1 ? '+1$' : '-1$'} (ayrıca $3 \\times 3$ tahtada terslenme sayısı $${info2.inversions}$ ${info2.inversions % 2 === 0 ? 'çift' : 'tek'}): **${info2.solvable ? 'Evet, çözülebilir' : 'Hayır, çözülemez'}**.`,
            ],
          },
        ]),
      };
    }

    // zorlayici: 15-puzzle with blank NOT at home (full 16-cell permSign * (-1)^d invariant) + full proof
    const sub6 = rng.shuffle([11, 12, 13, 14, 15, 0]);
    if (sub6[5] === 0) {
      const idx = rng.int(0, 4);
      [sub6[5], sub6[idx]] = [sub6[idx], sub6[5]];
    }
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...sub6];
    const info = puzzleAnalyze(tiles, 4);
    const sgnChoice = shuffleChoice(rng, SIGN_OPTS[info.fullSign === 1 ? 0 : 1], [SIGN_OPTS[info.fullSign === 1 ? 1 : 0]]);

    return {
      title: '15 Bulmacasında Genel Parite Değişmezi ($\\operatorname{sgn}(\\pi_{\\text{tüm}}) \\cdot (-1)^{d}$)',
      story: `Aşağıdaki $4 \\times 4$ 15-bulmacasında ilk $10$ taş yerindedir, fakat son $6$ hücre (boş kare $\\square$ dahil, hedef hücresi $16$) karıştırılmıştır:\n\n$$${puzzleMatrixTex(tiles, 4)}$$\n\nBoş kare başlangıç köşesinde olmadığında çözülebilirlik testi, tüm $16$ hücrenin permütasyon işareti $\\operatorname{sgn}(\\pi_{\\text{tüm}})$ ile boş karenin sağ alt köşeye Manhattan uzaklığı $d$'nin paritesini birleştirir.`,
      model: { id: 'puzzle15', params: { tiles } },
      parts: makeLabels([
        {
          prompt: `Boş kareyi $16$ numarasıyla etiketleyerek $1..16$ hücrelerinin tam permütasyonu $\\pi_{\\text{tüm}} \\in S_{16}$ için $\\operatorname{sgn}(\\pi_{\\text{tüm}})$ işareti nedir?`,
          kind: 'answer',
          answer: sgnChoice,
          hints: [
            `İlk $10$ hücre sabittir; yalnızca $11..16$ hücreleri arasındaki ayrık döngüleri yazın: $\\pi_{\\text{tüm}} = ${permTex(info.fullPerm)}$.`,
          ],
          solution: [
            `$11..16$ konumlarındaki değerler $(${sub6.map(v => (v === 0 ? 16 : v)).join(',\\,')})$ olup $\\pi_{\\text{tüm}} = ${permTex(info.fullPerm)}$ ve $\\operatorname{sgn}(\\pi_{\\text{tüm}}) = ${info.fullSign === 1 ? '+1' : '-1'}$.`,
          ],
        },
        {
          prompt: `Boş karenin $(4, 4)$ hedef köşesine olan Manhattan (taksi) uzaklığı $d = (4 - r) + (4 - c)$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: info.blankTaxicab },
          hints: [`Boş kare $${info.blankRow + 1}$. satır ve $${info.blankCol + 1}$. sütundadır.`],
          solution: [`$d = (4 - ${info.blankRow + 1}) + (4 - ${info.blankCol + 1}) = ${info.blankTaxicab}$.`],
        },
        {
          prompt: `Bu 15-bulmaca dizilimi çözülebilir midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: info.solvable },
          hints: [
            'Her hamle hem $\\operatorname{sgn}(\\pi_{\\text{tüm}})$ işaretini hem de $(-1)^d$ işaretini tersine çevirir; çözülmüş durumda çarpım $+1$' + "'dir.",
          ],
          solution: [
            `$\\operatorname{sgn}(\\pi_{\\text{tüm}}) \\cdot (-1)^d = (${info.fullSign === 1 ? '+1' : '-1'}) \\cdot (-1)^{${info.blankTaxicab}} = ${info.invariant === 1 ? '+1' : '-1'} \\implies$ **${info.solvable ? 'Evet, çözülebilir' : 'Hayır, çözülemez'}**.`,
          ],
        },
        {
          prompt: '**Kanıt:** $4 \\times 4$ 15-bulmacasında (i) her yasal hamlenin $I = \\operatorname{sgn}(\\pi_{\\text{tüm}}) \\cdot (-1)^d$ niceliğini değişmez bıraktığını, (ii) boş kare sağ alt köşeye döndüğünde toplam hamle sayısının çift olmak zorunda olduğunu ve ulaşılabilen tüm taş dizilimlerinin $A_{15}$ içinde (çift permütasyon) kaldığını, (iii) yalnızca $14$ ve $15$ taşlarının yer değiştirdiği Sam Loyd diziliminin çözülemez olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            'Her hamlede boş kare ile komşu taş takas olur (bir transpozisyon $\\implies \\operatorname{sgn}$ işaret değiştirir) ve boş kare dama tahtasında renk değiştirir ($d$ tam $1$ artar veya azalır $\\implies (-1)^d$ de işaret değiştirir).',
          ],
          solution: [
            '**(i) Değişmezlik:** Tek bir hamlede boş kare (hücre $16$) komşu bir taşla yer değiştirir; bu $S_{16}$ içinde tek bir transpozisyonla çarpma demek olduğundan $\\operatorname{sgn}(\\pi_{\\text{tüm}})$ işaret değiştirir ($\\times(-1)$). Aynı anda boş karenin $(r + c)$ toplamı $\\pm 1$ değiştiğinden Manhattan uzaklığı $d = (4 - r) + (4 - c)$ parite değiştirir, yani $(-1)^d$ de $\\times(-1)$ ile çarpılır. Çarpım $I = \\operatorname{sgn}(\\pi_{\\text{tüm}})\\cdot(-1)^d$ her hamlede sabit kalır.',
            '**(ii) Köşeye dönüş:** Çözülmüş durumda $\\pi_{\\text{tüm}} = e$ ve $d = 0$ olduğundan $I = (+1)(+1) = +1$. Boş kare $(4, 4)$ köşesine $M$ hamlede geri döndüğünde her hamle dama tahtası rengini değiştirdiği için $M$ çift olmak zorundadır; $\\pi_{\\text{tüm}}$ $M$ transpozisyonun çarpımı ve $16$' + "'yı sabit bıraktığından taş permütasyonu $\\pi \\in A_{15}$ (çift) olur.",
            '**(iii) $14 \\leftrightarrow 15$:** Yalnızca $14$ ve $15$ yer değiştirdiğinde $d = 0$ ve $\\pi = (14\\,15)$ tek bir transpozisyondur: $I = (-1)(+1) = -1 \\neq +1$, dolayısıyla hiçbir yasal hamle dizisiyle ulaşılamaz.',
          ],
          checklist: [
            'Her hamlenin $S_{16}$ içinde bir transpozisyon olduğu ($\\operatorname{sgn}$ ters döner) gösterildi.',
            'Dama tahtası / Manhattan uzaklığı paritesinin her hamlede değiştiği ve $I = \\operatorname{sgn}(\\pi_{\\text{tüm}})\\cdot(-1)^d$' + "'nin değişmez olduğu kanıtlandı.",
            'Boş kare köşedeyken ($d = 0$) yalnızca çift permütasyonlara ulaşılabildiği ve $(14\\,15)$ diziliminin $I = -1$ ile çözülemez olduğu bağlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 12. ps2-kup-kosegenleri — Cube rotations ≅ S_4 via 4 body diagonals
// =====================================================================

const CUBE_KIND_OPTS = [
  'Yüz ekseni 90° (çeyrek tur)',
  'Yüz ekseni 180° (yarım tur)',
  'Köşegen ekseni 120°',
  'Kenar ortası ekseni 180°',
];

const T_KUP_KOSEGENLERI = {
  id: 'ps2-kup-kosegenleri',
  topic: 'Küp Dönmeleri ve $S_4$',
  title: 'Küpün Dönme Grubu ve Cisim Köşegenleri Üzerindeki $S_4$ Etkisi',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nonId = CUBE_DATA.rots.filter(r => r.kind !== 'id');

    if (level === 'isinma') {
      const r = rng.pick(nonId);
      const kindChoice = shuffleChoice(rng, r.kindLabel, CUBE_KIND_OPTS.filter(x => x !== r.kindLabel));
      const diagSteps = CUBE_DIAGS.map((v, i) => {
        const w = matApply3(r.mat, v);
        const target = r.diagPerm[i];
        const td = CUBE_DIAGS[target - 1];
        const flipped = w[0] === -td[0] && w[1] === -td[1] && w[2] === -td[2];
        return `$d_${i + 1}=(${v.join(',')}) \\mapsto (${w.join(',')}) = ${flipped ? '-' : ''}d_${target}$`;
      });

      return {
        title: `Küp Dönmesi ve 4 Cisim Köşegeni Permütasyonu`,
        story: `Köşeleri $(\\pm 1, \\pm 1, \\pm 1)$ olan küpün dört cisim köşegeni $d_1: (1,1,1)$, $d_2: (-1,1,1)$, $d_3: (-1,-1,1)$, $d_4: (1,-1,1)$ olarak numaralanmıştır (her $d_i$ doğrusu hem $+v$ hem $-v$ köşesini temsil eder). İncelenen küp dönmesi koordinat dönüşümü $g: ${r.coordTex}$ ile veriliyor.`,
        model: { id: 'cube', params: { rot: r.mat } },
        parts: makeLabels([
          {
            prompt: `Bu $g: ${r.coordTex}$ dönmesinin dört cisim köşegeni $\\{1, 2, 3, 4\\}$ üzerinde ürettiği permütasyonu $\\Phi(g) \\in S_4$ ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: r.diagPerm },
            hints: [
              'Her $d_i$ vektörüne koordinat dönüşümünü uygulayın; çıkan vektör hangi $\\pm d_j$ köşegenine eşitse $i \\mapsto j$ olur.',
              `İlk iki köşegen: ${diagSteps[0]}; ${diagSteps[1]}.`,
              `Ayrık döngü gösterimi: $${permTex(r.diagPerm)}$.`,
            ],
            solution: [
              `Köşegen görüntüleri: ${diagSteps.join('; ')}.`,
              `Ayrık döngü gösterimi: **$\\Phi(g) = ${permTex(r.diagPerm)}$**.`,
            ],
          },
          {
            prompt: `Bu $g$ dönmesi küpün hangi geometrik eksen ve açı türündendir?`,
            kind: 'answer',
            answer: kindChoice,
            hints: [
              'Köşegen permütasyonunun döngü tipine bakın: $4$-döngü $\\leftrightarrow$ yüz $90^\\circ$, $(ab)(cd)$ $\\leftrightarrow$ yüz $180^\\circ$, $3$-döngü $\\leftrightarrow$ köşegen $120^\\circ$, tek $(ab)$ $\\leftrightarrow$ kenar $180^\\circ$.',
              `$\\Phi(g) = ${permTex(r.diagPerm)}$ permütasyonu **${r.kindLabel}** sınıfına aittir.`,
            ],
            solution: [
              `$\\Phi(g) = ${permTex(r.diagPerm)}$ (${r.cycleLabel}) olduğundan dönme türü: **${r.kindLabel}**.`,
            ],
          },
          {
            prompt: `Bu $g$ dönmesinin mertebesi $|g|$ (yani $g^k = I$ sağlayan en küçük pozitif $k$) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: r.order },
            hints: [
              '$\\Phi: O \\to S_4$ izomorfizma olduğundan $|g| = |\\Phi(g)|$ (ayrık döngü uzunluklarının EKOK değeri).',
              `$\\Phi(g) = ${permTex(r.diagPerm)}$ için mertebe $${r.order}$.`,
            ],
            solution: [
              `$|g| = |${permTex(r.diagPerm)}| = ${r.order}$.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const r1 = rng.pick(nonId);
      const r2 = rng.pick(nonId.filter(x => x.idx !== r1.idx && x.kind !== r1.kind));
      const prodMat = matMul3(r1.mat, r2.mat);
      const prodRot = CUBE_DATA.findByMat(prodMat);

      return {
        title: `Küp Dönmelerinin Bileşkesi ve $O \\cong S_4$ Sayımı`,
        story: `Küpün dört cisim köşegeni $d_1=(1,1,1)$, $d_2=(-1,1,1)$, $d_3=(-1,-1,1)$, $d_4=(1,-1,1)$ olarak etiketlidir. İki küp dönmesi $g_1: ${r1.coordTex}$ ve $g_2: ${r2.coordTex}$ veriliyor.`,
        model: { id: 'cube', params: { rot: r1.mat } },
        parts: makeLabels([
          {
            prompt: `$g_1: ${r1.coordTex}$ dönmesinin köşegen permütasyonu $\\Phi(g_1) \\in S_4$'ü ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: r1.diagPerm },
            hints: [
              `Her $d_i$ vektörünü $g_1$ ile dönüştürüp $\\pm d_j$ olarak eşleştirin: $d_1 \\mapsto ${r1.diagPerm[0]}$, $d_2 \\mapsto ${r1.diagPerm[1]}$.`,
            ],
            solution: [
              `$\\Phi(g_1) = ${permTex(r1.diagPerm)}$ (${r1.kindLabel}).`,
            ],
          },
          {
            prompt: `$g_2: ${r2.coordTex}$ dönmesinin köşegen permütasyonu $\\Phi(g_2) \\in S_4$'ü ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: r2.diagPerm },
            hints: [
              `$g_2$ altında $d_1 \\mapsto d_${r2.diagPerm[0]}$, $d_2 \\mapsto d_${r2.diagPerm[1]}$.`,
            ],
            solution: [
              `$\\Phi(g_2) = ${permTex(r2.diagPerm)}$ (${r2.kindLabel}).`,
            ],
          },
          {
            prompt: `Sağdan sola bileşke $g_1 \\circ g_2$ (önce $g_2$, sonra $g_1$) dönmesinin köşegen permütasyonu $\\Phi(g_1 \\circ g_2) \\in S_4$'ü yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: prodRot.diagPerm },
            hints: [
              '$\\Phi$ homomorfizma olduğundan $\\Phi(g_1 \\circ g_2) = \\Phi(g_1) \\circ \\Phi(g_2)$ (önce sağdaki $\\Phi(g_2)$, sonra soldaki $\\Phi(g_1)$).',
              `$${permTex(r1.diagPerm)} \\circ ${permTex(r2.diagPerm)}$ bileşkesini hesaplayın.`,
            ],
            solution: [
              `$\\Phi(g_1 \\circ g_2) = ${permTex(r1.diagPerm)} \\circ ${permTex(r2.diagPerm)} = ${permTex(prodRot.diagPerm)}$ (koordinat haritası: $${prodRot.coordTex}$, türü: ${prodRot.kindLabel}).`,
            ],
          },
          {
            prompt: `Küpün birim dışındaki $23$ dönmesi eksen türlerine göre sınıflandırıldığında **(yüz ekseni dönmeleri, köşegen ekseni dönmeleri, kenar ortası ekseni dönmeleri)** sayılarını sırasıyla yazın (virgülle ayırın; birim $+1$ ile toplamları $24$ eder).`,
            kind: 'answer',
            answer: { type: 'intlist', value: [9, 8, 6] },
            hints: [
              'Küpün $3$ karşılıklı yüz ekseni (her biri $90^\\circ, 180^\\circ, 270^\\circ$), $4$ cisim köşegeni ekseni (her biri $120^\\circ, 240^\\circ$) ve $6$ karşılıklı kenar ortası ekseni (her biri $180^\\circ$) vardır.',
            ],
            solution: [
              'Yüz eksenleri: $3 \\times 3 = 9$; köşegen eksenleri: $4 \\times 2 = 8$; kenar eksenleri: $6 \\times 1 = 6$. Birimle birlikte $9 + 8 + 6 + 1 = 24$. Sıralı liste: **9, 8, 6**.',
            ],
          },
        ]),
      };
    }

    // zorlayici: coordinate map -> diagPerm, composition, diagonal stabilizer order, and kernel-trivial proof of O ≅ S_4
    const r1 = rng.pick(nonId);
    const r2 = rng.pick(nonId.filter(x => x.idx !== r1.idx));
    const prodRot = CUBE_DATA.findByMat(matMul3(r1.mat, r2.mat));
    const fixedDiag = rng.int(1, 4);

    return {
      title: `Küp Dönmeleri $O \\cong S_4$: Köşegen Etkisi ve Çekirdek Kanıtı`,
      story: `Küpün dört cisim köşegeni $d_1=(1,1,1)$, $d_2=(-1,1,1)$, $d_3=(-1,-1,1)$, $d_4=(1,-1,1)$ üzerindeki dönme etkisi $\\Phi: O \\to S_4$ homomorfizmasını tanımlar. İki dönme $g_1: ${r1.coordTex}$ ve $g_2: ${r2.coordTex}$ veriliyor.`,
      model: { id: 'cube', params: { rot: r1.mat } },
      parts: makeLabels([
        {
          prompt: `$g_1: ${r1.coordTex}$ dönmesinin köşegen permütasyonu $\\Phi(g_1) \\in S_4$'ü ayrık döngü gösteriminde yazın.`,
          kind: 'answer',
          answer: { type: 'perm', n: 4, value: r1.diagPerm },
          hints: [`$d_1, d_2, d_3, d_4$ vektörlerine $g_1$ uygulayıp $\\pm d_j$ ile eşleştirin.`],
          solution: [`$\\Phi(g_1) = ${permTex(r1.diagPerm)}$ (${r1.kindLabel}).`],
        },
        {
          prompt: `Bileşke $g_1 \\circ g_2$ dönmesinin köşegen permütasyonu $\\Phi(g_1 \\circ g_2)$ nedir?`,
          kind: 'answer',
          answer: { type: 'perm', n: 4, value: prodRot.diagPerm },
          hints: [`$\\Phi(g_2) = ${permTex(r2.diagPerm)}$ olup sağdan sola $\\Phi(g_1) \\circ \\Phi(g_2)$ hesaplanır.`],
          solution: [`$\\Phi(g_1) \\circ \\Phi(g_2) = ${permTex(r1.diagPerm)} \\circ ${permTex(r2.diagPerm)} = ${permTex(prodRot.diagPerm)}$.`],
        },
        {
          prompt: `Küpün $24$ dönmesinden kaç tanesi $d_{${fixedDiag}}$ cisim köşegenini (yönsüz doğru olarak, yani $d_{${fixedDiag}} \\mapsto \\pm d_{${fixedDiag}}$) sabit bırakır?`,
          kind: 'answer',
          answer: { type: 'int', value: 6 },
          hints: [
            `Yörünge-sabitleyici teoremiyle $|O_{d_${fixedDiag}}| = |O| / 4$ (ayrıca $S_4$ içinde tek bir noktayı sabit bırakan alt grup $S_3$'tür).`,
          ],
          solution: [
            `$O \\cong S_4$ içinde $d_{${fixedDiag}}$ köşegenini sabitleyen alt grup $S_3 \\cong D_3$ (birim + $d_{${fixedDiag}}$ etrafında iki $120^\\circ$ dönme + $d_{${fixedDiag}}$'ye dik üç $180^\\circ$ kenar dönmesi) olup mertebesi $24 / 4 = 6$'dır.`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\Phi: O \\to S_4$ homomorfizmasının çekirdeğinin aşikar ($\\ker\\Phi = \\{I\\}$) olduğunu kanıtlayın ve $|O| = 1 + 9 + 8 + 6 = 24 = |S_4|$ sayımını kullanarak $O \\cong S_4$ izomorfizmasını ispatlayın.',
          kind: 'proof',
          hints: [
            'Bir $g \\in \\ker\\Phi$ dönmesi her $d_i$ köşegenini $\\pm d_i$' + "'ye taşır; $d_1 = (1,1,1)$ ile $d_2, d_3, d_4$ arasındaki açılar ($\\cos\\theta = \\pm 1/3$) ve $g(d_1) \\cdot g(d_j) = d_1 \\cdot d_j$ iç çarpım korunumu üzerinden dört işaretin hepsinin eşit olması gerektiğini gösterip $\\det(g) = +1$ ile $g = I$ çıkarın.",
          ],
          solution: [
            '**Çekirdek:** $g \\in \\ker\\Phi$ olsun; her $i \\in \\{1,2,3,4\\}$ için $g(d_i) = \\varepsilon_i d_i$ ($\\varepsilon_i \\in \\{\\pm 1\\}$).',
            'Dönmeler iç çarpımı korur. Her $i \\neq j$ için $d_i \\cdot d_j \\in \\{+1, -1\\} \\neq 0$ (örneğin $d_1 \\cdot d_2 = 1$, $d_1 \\cdot d_3 = -1$, $d_1 \\cdot d_4 = 1$). Dolayısıyla $\\varepsilon_i \\varepsilon_j (d_i \\cdot d_j) = g(d_i)\\cdot g(d_j) = d_i \\cdot d_j \\implies \\varepsilon_i \\varepsilon_j = +1$, yani $\\varepsilon_1 = \\varepsilon_2 = \\varepsilon_3 = \\varepsilon_4 = \\varepsilon \\in \\{\\pm 1\\}$.',
            '$d_1, d_2, d_3$ vektörleri $\\mathbb{R}^3$\'ü gerdiğinden $g = \\varepsilon I$. Ancak $g$ bir öz dönme ($\\det(g) = +1$) ve $\\det(-I) = -1$ olduğundan $\\varepsilon = +1$, yani $g = I$ ve $\\ker\\Phi = \\{I\\}$ (birebir).',
            '**İzomorfizma:** $|O| = 1 + 3\\cdot 3 + 4\\cdot 2 + 6\\cdot 1 = 24 = |S_4|$. Aynı sonlu boyuttaki iki küme arasındaki birebir homomorfizma otomatik olarak örtendir: $O \\cong S_4$.',
          ],
          checklist: [
            '$g(d_i) = \\varepsilon_i d_i$ yazıldı ve iç çarpım korunumuyla (veya $d_1+d_2+d_3+d_4$ / eksen analiziyle) tüm $\\varepsilon_i$' + "'lerin eşit olduğu gösterildi.",
            '$\\det(-I) = -1 \\neq +1$ kullanılarak $g = -I$ elendi ve $\\ker\\Phi = \\{I\\}$ kanıtlandı.',
            '$|O| = 24 = |S_4|$ ve birebirlikten $O \\cong S_4$ izomorfizması tamamlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 13. ps2-kup-sinif-eslenik — Cube conjugacy classes & conjugate of a quarter-turn
// =====================================================================

const CYCLE_TYPE_OPTS = [
  '$(abcd)$ — 4-döngü',
  '$(ab)(cd)$ — ayrık iki 2-döngü',
  '$(abc)$ — 3-döngü',
  '$(ab)$ — tek 2-döngü (transpozisyon)',
];

const SIGNED_AXIS_OPTS = [
  '$+x$ ekseni',
  '$-x$ ekseni',
  '$+y$ ekseni',
  '$-y$ ekseni',
  '$+z$ ekseni',
  '$-z$ ekseni',
];

const T_KUP_SINIF_ESLENIK = {
  id: 'ps2-kup-sinif-eslenik',
  topic: 'Küp Dönmeleri ve $S_4$',
  title: 'Küp Dönmelerinin Eşlenik Sınıfları ve Çeyrek Turun Eşleniği',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const quarterTurns = CUBE_DATA.rots.filter(r => r.kind === 'face90');
    const q = rng.pick(quarterTurns);
    // Pick a conjugating rotation g that actually changes q (so g^-1 q g != q)
    const nonCommGs = CUBE_DATA.rots.filter(g => {
      if (g.kind === 'id') return false;
      const conjM = matMul3(matMul3(matTrans3(g.mat), q.mat), g.mat);
      return matKey3(conjM) !== q.key;
    });
    const g = rng.pick(level === 'zorlayici'
      ? nonCommGs.filter(x => x.kind === 'edge180' || x.kind === 'vertex120')
      : nonCommGs.filter(x => x.kind === 'face90' || x.kind === 'vertex120'));
    const conjMat = matMul3(matMul3(matTrans3(g.mat), q.mat), g.mat);
    const conjRot = CUBE_DATA.findByMat(conjMat);

    // Also pick a featured rotation class for matching
    const classSample = rng.pick([
      CUBE_DATA.rots.find(r => r.kind === 'face90'),
      CUBE_DATA.rots.find(r => r.kind === 'face180'),
      CUBE_DATA.rots.find(r => r.kind === 'vertex120'),
      CUBE_DATA.rots.find(r => r.kind === 'edge180'),
    ]);

    const axisLabel = ax => `$${ax}$ ekseni`;
    const axisChoice = shuffleChoice(rng, axisLabel(conjRot.qAxis), SIGNED_AXIS_OPTS.filter(o => o !== axisLabel(conjRot.qAxis)));

    if (level === 'isinma') {
      const cycleChoice = shuffleChoice(rng, classSample.cycleLabel, CYCLE_TYPE_OPTS.filter(o => o !== classSample.cycleLabel));
      return {
        title: `Küp Dönme Sınıfları ve $S_4$ Döngü Tipleri`,
        story: `Küpün dönme grubu $O \\cong S_4$ izomorfizmasında geometrik dönme türleri $S_4$ içindeki ayrık döngü tiplerine (eşlenik sınıflarına) birebir karşılık gelir. Çeyrek tur $q: ${q.coordTex}$ ($${q.qAxis}$ ekseni etrafında $+90^\\circ$, $\\Phi(q) = ${permTex(q.diagPerm)}$) ve $g: ${g.coordTex}$ ($\\Phi(g) = ${permTex(g.diagPerm)}$) dönmelerini inceleyelim.`,
        model: { id: 'cube', params: { rot: q.mat } },
        parts: makeLabels([
          {
            prompt: `**${classSample.kindLabel}** türündeki küp dönmeleri $S_4$ içinde hangi ayrık döngü tipine karşılık gelir?`,
            kind: 'answer',
            answer: cycleChoice,
            hints: [
              'Dönmenin mertebesine ve kaç köşegeni sabit bıraktığına bakın.',
              `Bu türün mertebesi $${classSample.order}$ ve örnek permütasyonu $${permTex(classSample.diagPerm)}$.`,
              `Döngü tipi: ${classSample.cycleLabel}.`,
            ],
            solution: [
              `**${classSample.kindLabel}** dönmeleri $S_4$ içinde **${classSample.cycleLabel}** sınıfına karşılık gelir.`,
            ],
          },
          {
            prompt: `Küpün $24$ dönmesinden kaç tanesi **${classSample.kindLabel}** eşlenik sınıfında yer alır?`,
            kind: 'answer',
            answer: { type: 'int', value: classSample.classSize },
            hints: [
              'Sınıf dağılımı: birim $1$, yüz $90^\\circ$ $\\to 6$, yüz $180^\\circ$ $\\to 3$, köşegen $120^\\circ$ $\\to 8$, kenar $180^\\circ$ $\\to 6$.',
              `Bu sınıfın boyutu: $${classSample.classSize}$.`,
            ],
            solution: [
              `**${classSample.kindLabel}** eşlenik sınıfı tam **$${classSample.classSize}$** dönme içerir.`,
            ],
          },
          {
            prompt: `Çeyrek tur $q$ ($\\Phi(q) = ${permTex(q.diagPerm)}$) dönmesinin $g$ ($\\Phi(g) = ${permTex(g.diagPerm)}$) ile eşleniğini ($g^{-1} q g$) köşegen permütasyonu olarak $S_4$ içinde ayrık döngü gösterimiyle yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: conjRot.diagPerm },
            hints: [
              'Sağdan sola $\\Phi(g)^{-1} \\circ \\Phi(q) \\circ \\Phi(g)$ çarpımını hesaplayın (veya $S_4$ kuralıyla $\\Phi(q)$ döngüsündeki her $i$ sayısını $\\Phi(g)^{-1}(i)$ ile değiştirin!).',
              `$\\Phi(g)^{-1} = ${permTex(permInv(g.diagPerm))}$.`,
              `Eşlenik yine bir $4$-döngüdür: $${permTex(conjRot.diagPerm)}$.`,
            ],
            solution: [
              `$\\Phi(g)^{-1} \\circ \\Phi(q) \\circ \\Phi(g) = ${permTex(permInv(g.diagPerm))} \\circ ${permTex(q.diagPerm)} \\circ ${permTex(g.diagPerm)} = ${permTex(conjRot.diagPerm)}$.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const why180Choice = shuffleChoice(
        rng,
        'Farklı döngü tiplerine ($(ab)(cd)$ ve $(ab)$) ve zıt işaretlere ($+1$ ve $-1$) sahiptirler; hiçbir küp dönmesi bir yüz eksenini bir kenar eksenine taşıyamaz',
        [
          'Mertebeleri farklıdır (biri mertebe $2$, diğeri mertebe $4$)',
          'Yalnızca biri küpün öz dönmesidir, diğeri yansımadır',
          'Aslında aynı eşlenik sınıfındadırlar ($3 + 6 = 9$ elemanlı tek sınıf)',
        ]
      );

      return {
        title: `Çeyrek Turun Eşleniği ve $O \\cong S_4$ Sınıf Denklemi`,
        story: `Küpün çeyrek tur dönmesi $q: ${q.coordTex}$ ($${q.qAxis}$ ekseni etrafında $+90^\\circ$, $\\Phi(q) = ${permTex(q.diagPerm)}$) bir başka küp dönmesi $g: ${g.coordTex}$ ($\\Phi(g) = ${permTex(g.diagPerm)}$) ile eşleniğe alınıyor: $q' = g^{-1} q g$.`,
        model: { id: 'cube', params: { rot: q.mat } },
        parts: makeLabels([
          {
            prompt: `$q' = g^{-1} q g$ eşlenik dönmesinin köşegen permütasyonu $\\Phi(q') \\in S_4$'ü ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: 4, value: conjRot.diagPerm },
            hints: [
              `$\\Phi(g)^{-1} = ${permTex(permInv(g.diagPerm))}$ olmak üzere sağdan sola $\\Phi(g)^{-1} \\circ \\Phi(q) \\circ \\Phi(g)$ hesaplayın.`,
            ],
            solution: [
              `$\\Phi(g^{-1} q g) = ${permTex(permInv(g.diagPerm))} \\circ ${permTex(q.diagPerm)} \\circ ${permTex(g.diagPerm)} = ${permTex(conjRot.diagPerm)}$ (koordinat haritası: $${conjRot.coordTex}$).`,
            ],
          },
          {
            prompt: `Elde edilen $q' = g^{-1} q g$ çeyrek turu hangi işaretli koordinat ekseni etrafında sağ-el kuralıyla $+90^\\circ$ dönmedir?`,
            kind: 'answer',
            answer: axisChoice,
            hints: [
              'Geometrik kural: $g^{-1} R_{\\hat{u}}(\\theta) g = R_{g^{-1}(\\hat{u})}(\\theta)$.',
              `$q$'nun ekseni $\\hat{u} = ${q.qAxis}$ vektörüne $g^{-1}$ uygulayın.`,
            ],
            solution: [
              `$q$'nun dönme ekseni $${q.qAxis}$ olup $g^{-1}(${q.qAxis}) = ${conjRot.qAxis}$. Dolayısıyla $g^{-1} q g$, **$${conjRot.qAxis}$ ekseni** etrafında $+90^\\circ$ dönmedir (koordinat haritası $${conjRot.coordTex}$).`,
            ],
          },
          {
            prompt: `Küp dönme grubu $O \\cong S_4$'ün beş eşlenik sınıfının boyutlarını **küçükten büyüğe sıralı** olarak yazın (virgülle ayırın; toplamları $24$ etmelidir).`,
            kind: 'answer',
            answer: { type: 'intlist', value: [1, 3, 6, 6, 8] },
            hints: [
              'Beş döngü tipi: $e$ ($1$), $(ab)(cd)$ ($3$), $(ab)$ ($6$), $(abcd)$ ($6$), $(abc)$ ($8$).',
            ],
            solution: [
              'Sınıf denklemi $24 = 1 + 3 + 6 + 6 + 8$ olup sıralı boyutlar: **1, 3, 6, 6, 8**.',
            ],
          },
          {
            prompt: `Yüz ekseni $180^\\circ$ dönmeleri ($3$ adet) ile kenar ortası $180^\\circ$ dönmeleri ($6$ adet) aynı mertebeye ($2$) ve aynı $180^\\circ$ açısına sahip oldukları hâlde neden **farklı** eşlenik sınıflarında yer alırlar?`,
            kind: 'answer',
            answer: why180Choice,
            hints: [
              'İki grubun $S_4$' + "'teki döngü tiplerini ($(ab)(cd)$ vs $(ab)$) ve permütasyon işaretlerini karşılaştırın.",
            ],
            solution: [
              'Yüz $180^\\circ$ dönmeleri $(ab)(cd)$ (çift, $\\operatorname{sgn}=+1$), kenar $180^\\circ$ dönmeleri ise $(ab)$ (tek, $\\operatorname{sgn}=-1$) döngü tipindedir; eşlenik alma döngü tipini ve eksen türünü korur.',
            ],
          },
        ]),
      };
    }

    // zorlayici
    return {
      title: `Küp Dönmelerinde Eşlenik Geometrisi ve Merkezleyiciler`,
      story: `$O \\cong S_4$ küp dönme grubunda çeyrek tur $q: ${q.coordTex}$ ($${q.qAxis}$ ekseni etrafında $+90^\\circ$) dönmesinin $g: ${g.coordTex}$ (${g.kindLabel}) ile eşleniğini $q' = g^{-1} q g$ hesaplayıp geometrik eksen dönüşümü ve sınıf yapısını inceleyelim.`,
      model: { id: 'cube', params: { rot: q.mat } },
      parts: makeLabels([
        {
          prompt: `$q' = g^{-1} q g$ eşleniğinin köşegen permütasyonunu $\\Phi(q') \\in S_4$ ayrık döngü gösteriminde bulun.`,
          kind: 'answer',
          answer: { type: 'perm', n: 4, value: conjRot.diagPerm },
          hints: [`$\\Phi(q) = ${permTex(q.diagPerm)}$ ve $\\Phi(g) = ${permTex(g.diagPerm)}$ üzerinden $\\Phi(g)^{-1} \\circ \\Phi(q) \\circ \\Phi(g)$ hesaplayın.`],
          solution: [
            `$\\Phi(q) = ${permTex(q.diagPerm)}$, $\\Phi(g) = ${permTex(g.diagPerm)}$, $\\Phi(g)^{-1} = ${permTex(permInv(g.diagPerm))}$.`,
            `$\\Phi(g^{-1} q g) = ${permTex(conjRot.diagPerm)}$ ($${conjRot.coordTex}$).`,
          ],
        },
        {
          prompt: `$q' = g^{-1} q g$ hangi işaretli koordinat ekseni etrafında $+90^\\circ$ (sağ-el kuralıyla) dönmedir?`,
          kind: 'answer',
          answer: axisChoice,
          hints: [`$g^{-1}$ dönüşümünü $q$'nun ekseni $${q.qAxis}$ üzerine uygulayın.`],
          solution: [`$g^{-1}(${q.qAxis}) = ${conjRot.qAxis}$ olduğundan **$${conjRot.qAxis}$ ekseni** etrafında $+90^\\circ$ dönmedir.`],
        },
        {
          prompt: `**${classSample.kindLabel}** sınıfından bir $h$ dönmesinin $O$ içindeki merkezleyicisinin mertebesi $|C_O(h)|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: classSample.centralizerSize },
          hints: [`$|C_O(h)| = |O| / |\\operatorname{Cl}(h)| = 24 / ${classSample.classSize}$.`],
          solution: [`$|\\operatorname{Cl}(h)| = ${classSample.classSize} \\implies |C_O(h)| = 24 / ${classSample.classSize} = ${classSample.centralizerSize}$.`],
        },
        {
          prompt: '**Kanıt:** (i) Herhangi bir $g, R_{\\hat{u}}(\\theta) \\in \\mathrm{SO}(3)$ dönmesi için $g^{-1} R_{\\hat{u}}(\\theta) g = R_{g^{-1}\\hat{u}}(\\theta)$ olduğunu (yani eşlenik almanın dönme eksenini $g^{-1}$ ile taşıyıp açıyı koruduğunu) kanıtlayın; (ii) buna dayanarak $O \\cong S_4$ grubunda $180^\\circ$ yüz dönmeleri ile $180^\\circ$ kenar dönmelerinin neden ayrı eşlenik sınıfları oluşturduğunu açıklayın.',
          kind: 'proof',
          hints: [
            '(i) için $w = g^{-1}\\hat{u}$ vektörünün $g^{-1} R_{\\hat{u}}(\\theta) g$ altında sabit kaldığını, iz ($\\operatorname{tr} = 1 + 2\\cos\\theta$) ve $\\det(g) = +1$ yönelim korunumuyla açının $+\\theta$ kaldığını gösterin.',
          ],
          solution: [
            '**(i) Eksen dönüşümü:** $w = g^{-1}\\hat{u}$ birim vektörüne etki: $(g^{-1} R_{\\hat{u}}(\\theta) g)(g^{-1}\\hat{u}) = g^{-1} R_{\\hat{u}}(\\theta)\\hat{u} = g^{-1}\\hat{u} = w$, yani yeni dönme ekseni $g^{-1}\\hat{u}$ olur. $w$' + "'ye dik düzlemde $g$ ortogonal ve yönelim koruyan ($\\det g = +1$) olduğundan $g^{-1} R_{\\hat{u}}(\\theta) g$ aynı $+\\theta$ açısıyla sağ-el dönmesi yapar (ayrıca $\\operatorname{tr}(g^{-1}Rg) = \\operatorname{tr}(R) = 1 + 2\\cos\\theta$).",
            '**(ii) İki $180^\\circ$ sınıfı:** Bir küp dönmesi $g \\in O$ daima yüz merkezlerini yüz merkezlerine, kenar orta noktalarını kenar orta noktalarına taşır; hiçbir $g \\in O$ bir yüz eksenini bir kenar eksenine götüremez. Cebirsel karşılığı: $S_4$' + "'te yüz $180^\\circ$ dönmeleri $(ab)(cd)$ (iki $2$-döngü, $\\operatorname{sgn}=+1$), kenar $180^\\circ$ dönmeleri ise $(ab)$ (tek $2$-döngü, $\\operatorname{sgn}=-1$) olup eşlenik alma döngü tipini korur.",
          ],
          checklist: [
            '$(g^{-1} R_{\\hat{u}}(\\theta) g)(g^{-1}\\hat{u}) = g^{-1}\\hat{u}$ ile yeni eksenin $g^{-1}\\hat{u}$ olduğu kanıtlandı.',
            'Ortogonallik ve $\\det(g) = +1$ ile dönme açısının ($+\\theta$) korunduğu gösterildi.',
            'Yüz $180^\\circ$ ($(ab)(cd)$) ve kenar $180^\\circ$ ($(ab)$) sınıflarının hem geometrik eksen hem $S_4$ döngü tipi bakımından ayrı olduğu kanıtlandı.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 14. ps2-metan-bolum-s3 — Methane CH4 (A_4), sign χ, axes ψ: O -> S_3, S_4/V ≅ S_3
// =====================================================================

const METHANE_SIGN_OPTS = [
  '$+1$ ($T_+$ dörtyüzlüsü korunur — $\\mathrm{CH_4}$ simetrisidir)',
  '$-1$ ($T_+$ ve $T_-$ dörtyüzlüleri takas olur — $\\mathrm{CH_4}$ simetrisi değildir)',
];

const KER_PSI_OPTS = [
  '$\\{e,\\, (12)(34),\\, (13)(24),\\, (14)(23)\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$',
  '$\\{e,\\, (1234),\\, (13)(24),\\, (1432)\\} \\cong \\mathbb{Z}_4$',
  '$\\{e,\\, (12),\\, (34),\\, (12)(34)\\}$ (normal değil)',
  '$\\{e,\\, (123),\\, (132)\\} \\cong \\mathbb{Z}_3$',
];

const T_METAN_BOLUM_S3 = {
  id: 'ps2-metan-bolum-s3',
  topic: 'Küp Dönmeleri ve $S_4$',
  title: 'Metan ($\\mathrm{CH_4}$) Simetrisi $A_4$ ve Eksen Homomorfizması $S_4 / V \\cong S_3$',
  source: 'PS2',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nonId = CUBE_DATA.rots.filter(r => r.kind !== 'id');
    const model = { id: 'molecule', params: { name: 'CH4' } };

    if (level === 'isinma') {
      const r = rng.pick(nonId);
      const chiChoice = shuffleChoice(rng, METHANE_SIGN_OPTS[r.sign === 1 ? 0 : 1], [METHANE_SIGN_OPTS[r.sign === 1 ? 1 : 0]]);

      return {
        title: `Metan ($\\mathrm{CH_4}$) Simetrisi ve Koordinat Ekseni Permütasyonu`,
        story: `Metan molekülünde ($\\mathrm{CH_4}$) karbon atomu küpün merkezinde, dört hidrojen atomu ise küpün içine gömülü düzgün dörtyüzlünün $T_+ = \\{(1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1)\\}$ köşelerindedir. Her $g \\in O \\cong S_4$ küp dönmesi $T_+$'yi ya korur ($\\chi(g) = \\operatorname{sgn}(\\Phi(g)) = +1$) ya da tümleyen $T_-$ ile takas eder ($\\chi(g) = -1$). Ayrıca her dönme üç koordinat ekseni ($1 \\leftrightarrow X,\\; 2 \\leftrightarrow Y,\\; 3 \\leftrightarrow Z$) üzerinde $\\psi: O \\to S_3$ permütasyonunu üretir. İncelenen dönme: $g: ${r.coordTex}$ ($\\Phi(g) = ${permTex(r.diagPerm)}$).`,
        model,
        parts: makeLabels([
          {
            prompt: `Bu $g$ dönmesi için $\\chi(g) = \\operatorname{sgn}(\\Phi(g))$ değeri ve metan dörtyüzlüsü $T_+$ üzerindeki etkisi nedir?`,
            kind: 'answer',
            answer: chiChoice,
            hints: [
              `Köşegen permütasyonu $\\Phi(g) = ${permTex(r.diagPerm)}$ çift mi tek mi kontrol edin (veya $(1,1,1)$ köşesinin görüntüsündeki koordinat çarpımı $+1$ mi $-1$ mi bakın!).`,
              `$g(1, 1, 1) = (${matApply3(r.mat, [1, 1, 1]).join(', ')}) \\in ${r.sign === 1 ? 'T_+' : 'T_-'}$.`,
              `Sonuç: ${METHANE_SIGN_OPTS[r.sign === 1 ? 0 : 1]}.`,
            ],
            solution: [
              `$\\Phi(g) = ${permTex(r.diagPerm)}$ için $\\chi(g) = \\operatorname{sgn}(${permTex(r.diagPerm)}) = ${r.sign === 1 ? '+1' : '-1'}$.`,
              `Doğrulama: $g(1,1,1) = (${matApply3(r.mat, [1, 1, 1]).join(', ')})$, koordinat çarpımı $${r.sign === 1 ? '+1' : '-1'}$ olduğundan **${METHANE_SIGN_OPTS[r.sign === 1 ? 0 : 1]}**.`,
            ],
          },
          {
            prompt: `Üç koordinat eksenini $1 \\leftrightarrow X,\\; 2 \\leftrightarrow Y,\\; 3 \\leftrightarrow Z$ olarak etiketlediğimizde $g: ${r.coordTex}$ dönmesinin eksen permütasyonu $\\psi(g) \\in S_3$ nedir? (Ayrık döngü gösteriminde yazın; sabit bırakıyorsa \`e\`.)`,
            kind: 'answer',
            answer: { type: 'perm', n: 3, value: r.axisPerm },
            hints: [
              'Koordinat haritasında eski $x$ ($1$. eksen) hangi yeni bileşene ($1, 2$ veya $3$), $y$ ($2$. eksen) hangisine, $z$ ($3$. eksen) hangisine gidiyor işaretlere bakmadan izleyin!',
              `Eksen geçişleri: $1 \\mapsto ${r.axisPerm[0]}$, $2 \\mapsto ${r.axisPerm[1]}$, $3 \\mapsto ${r.axisPerm[2]}$.`,
              `Ayrık döngü gösterimi: $${permTex(r.axisPerm)}$.`,
            ],
            solution: [
              `Birim eksen vektörlerinin yönleri (işaretsiz): $e_1 \\mapsto \\pm e_${r.axisPerm[0]}$, $e_2 \\mapsto \\pm e_${r.axisPerm[1]}$, $e_3 \\mapsto \\pm e_${r.axisPerm[2]}$.`,
              `$\\psi(g) = ${permTex(r.axisPerm)} \\in S_3$.`,
            ],
          },
          {
            prompt: `Metan molekülünün ($T_+$ dörtyüzlüsünün) öz dönme simetri grubu $A_4 = \\ker\\chi$ toplam kaç elemandan oluşur?`,
            kind: 'answer',
            answer: { type: 'int', value: 12 },
            hints: [
              '$\\chi: S_4 \\to \\{\\pm 1\\}$ örten homomorfizma olduğundan $|\\ker\\chi| = |S_4| / 2$.',
              '$24 / 2 = 12$ (birim + $8$ adet $\\mathrm{C{-}H}$ bağı $120^\\circ$ dönmesi + $3$ adet $180^\\circ$ yüz dönmesi).',
            ],
            solution: [
              '$|A_4| = |S_4| / 2 = 24 / 2 = 12$ (1 birim + 8 adet $120^\\circ$ + 3 adet $180^\\circ$).',
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const r = rng.pick(nonId);
      const kerChoice = shuffleChoice(rng, KER_PSI_OPTS[0], KER_PSI_OPTS.slice(1));
      const quotChoice = shuffleChoice(rng, '$S_3$', ['$\\mathbb{Z}_6$', '$A_4$', '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$']);

      return {
        title: `Metan Grubu $A_4$ ve Koordinat Ekseni Bölümü $S_4 / V \\cong S_3$`,
        story: `Küpün $O \\cong S_4$ dönme grubunda iki doğal homomorfizma vardır: metan dörtyüzlüsü $T_+$ üzerinde işaret homomorfizması $\\chi: O \\to \\{\\pm 1\\}$ ve üç koordinat ekseni $\\{1\\leftrightarrow X,\\; 2\\leftrightarrow Y,\\; 3\\leftrightarrow Z\\}$ üzerinde eksen permütasyonu $\\psi: O \\to S_3$. Örnek olarak $g: ${r.coordTex}$ dönmesini inceleyelim.`,
        model,
        parts: makeLabels([
          {
            prompt: `$g: ${r.coordTex}$ dönmesi metan molekülünün $T_+ = \\{(1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1)\\}$ dörtyüzlüsünü korur mu?`,
            kind: 'answer',
            answer: { type: 'yesno', value: r.sign === 1 },
            hints: [
              `Köşegen permütasyonunun işaretini ($\\Phi(g) = ${permTex(r.diagPerm)}$) veya $g(1, 1, 1)$ görüntüsünün koordinat çarpımını ($\\pm 1$) kontrol edin.`,
            ],
            solution: [
              `$\\Phi(g) = ${permTex(r.diagPerm)}$, $\\chi(g) = ${r.sign === 1 ? '+1' : '-1'}$ ve $g(1,1,1) = (${matApply3(r.mat, [1, 1, 1]).join(', ')})$: **${r.sign === 1 ? 'Evet, korur' : 'Hayır, T_- ile takas eder'}**.`,
            ],
          },
          {
            prompt: `Aynı $g: ${r.coordTex}$ dönmesinin eksen permütasyonu $\\psi(g) \\in S_3$'ü ayrık döngü gösteriminde yazın ($1 \\leftrightarrow X,\\; 2 \\leftrightarrow Y,\\; 3 \\leftrightarrow Z$).`,
            kind: 'answer',
            answer: { type: 'perm', n: 3, value: r.axisPerm },
            hints: [
              `Eksen geçişlerini işaretlere bakmadan okuyun: $1 \\mapsto ${r.axisPerm[0]},\\; 2 \\mapsto ${r.axisPerm[1]},\\; 3 \\mapsto ${r.axisPerm[2]}$.`,
            ],
            solution: [
              `$\\psi(g) = ${permTex(r.axisPerm)}$.`,
            ],
          },
          {
            prompt: `$\\psi: O \\to S_3$ eksen homomorfizmasının çekirdeği $V = \\ker\\psi$, $S_4$ köşegen permütasyonları cinsinden hangi normal alt gruptur?`,
            kind: 'answer',
            answer: kerChoice,
            hints: [
              'Üç koordinat ekseninin üçünü de kendi üzerine (en fazla işaret değiştirerek) götüren öz dönmeler hangileridir?',
              'Köşegen matrisler $\\operatorname{diag}(\\pm 1, \\pm 1, \\pm 1)$ ($\\det = +1$): birim + üç $180^\\circ$ yüz dönmesi!',
            ],
            solution: [
              '$\\ker\\psi$, köşegen matrislerden ($I$ ve $x, y, z$ etrafında $180^\\circ$ yüz dönmeleri) oluşur; $S_4$ içindeki karşılığı Klein dörtlü alt grubu $V = \\{e, (12)(34), (13)(24), (14)(23)\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.',
            ],
          },
          {
            prompt: `Birinci İzomorfizma Teoremine göre bölüm grubu $O / \\ker\\psi \\cong S_4 / V$ aşağıdaki gruplardan hangisine izomorfiktir?`,
            kind: 'answer',
            answer: quotChoice,
            hints: [
              '$\\psi: O \\to S_3$ homomorfizmasının örten olduğunu ($90^\\circ$ yüz dönmesi transpozisyon, $120^\\circ$ köşegen dönmesi $3$-döngü üretir) hatırlayın.',
            ],
            solution: [
              '$\\psi: O \\to S_3$ örten ve $\\ker\\psi = V$ olduğundan Birinci İzomorfizma Teoremiyle $O / V \\cong S_4 / V \\cong S_3$.',
            ],
          },
        ]),
      };
    }

    // zorlayici: fiber of psi over a non-trivial element, A4 / V ≅ Z3, full proof
    const r = rng.pick(nonId.filter(x => x.kind !== 'face180')); // outside V
    // Pick a concrete non-identity element v in V and ask for the product r * v (same coset / fiber of psi!)
    const vList = CUBE_DATA.rots.filter(x => x.kind === 'face180');
    const vEl = rng.pick(vList);
    const cosetPartner = CUBE_DATA.findByMat(matMul3(r.mat, vEl.mat));
    const a4vChoice = shuffleChoice(rng, '$\\mathbb{Z}_3$', ['$S_3$', '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$', '$\\mathbb{Z}_4$']);

    return {
      title: `Metan Simetrisi $A_4$, $V$ Lifleri ve $S_4 / V \\cong S_3$ İzomorfizması`,
      story: `$O \\cong S_4$ küp dönme grubunda $\\chi: O \\to \\{\\pm 1\\}$ metan işareti ve $\\psi: O \\to S_3$ koordinat ekseni homomorfizması iki temel normal alt grubu ortaya çıkarır: $\\ker\\chi = A_4$ ve $\\ker\\psi = V \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$. Verilen dönme: $g: ${r.coordTex}$ ($\\Phi(g) = ${permTex(r.diagPerm)}$).`,
      model,
      parts: makeLabels([
        {
          prompt: `$g: ${r.coordTex}$ dönmesinin koordinat eksenleri ($1 \\leftrightarrow X, 2 \\leftrightarrow Y, 3 \\leftrightarrow Z$) üzerindeki görüntüsü $\\psi(g) \\in S_3$ nedir?`,
          kind: 'answer',
          answer: { type: 'perm', n: 3, value: r.axisPerm },
          hints: [`Eksenlerin işaretsiz yer değişimini okuyun: $1 \\mapsto ${r.axisPerm[0]},\\; 2 \\mapsto ${r.axisPerm[1]},\\; 3 \\mapsto ${r.axisPerm[2]}$.`],
          solution: [`$\\psi(g) = ${permTex(r.axisPerm)}$.`],
        },
        {
          prompt: `$v \\in V = \\ker\\psi$ olarak $v: ${vEl.coordTex}$ ($\\Phi(v) = ${permTex(vEl.diagPerm)}$) alındığında, $g$ ile aynı $\\psi$-lifinde ($\\psi(gv) = \\psi(g)$) bulunan $gv$ dönmesinin köşegen permütasyonu $\\Phi(gv) \\in S_4$ nedir?`,
          kind: 'answer',
          answer: { type: 'perm', n: 4, value: cosetPartner.diagPerm },
          hints: [
            `Sağdan sola $\\Phi(g) \\circ \\Phi(v) = ${permTex(r.diagPerm)} \\circ ${permTex(vEl.diagPerm)}$ çarpımını hesaplayın.`,
          ],
          solution: [
            `$\\Phi(gv) = ${permTex(r.diagPerm)} \\circ ${permTex(vEl.diagPerm)} = ${permTex(cosetPartner.diagPerm)}$ (kontrol: $\\psi(gv) = ${permTex(cosetPartner.axisPerm)} = \\psi(g)$).`,
          ],
        },
        {
          prompt: `$V \\trianglelefteq A_4$ olduğundan $\\psi$ homomorfizmasını metan dönme grubu $A_4$'e kısıtladığımızda elde edilen bölüm grubu $A_4 / V$ aşağıdaki gruplardan hangisine izomorfiktir?`,
          kind: 'answer',
          answer: a4vChoice,
          hints: [
            '$|A_4| = 12$ ve $|V| = 4$ olduğundan $|A_4 / V| = 12 / 4 = 3$ (ve $\\psi(A_4) = A_3 \\cong \\mathbb{Z}_3$).',
          ],
          solution: [
            '$V \\subset A_4$ ve $|A_4 / V| = 12 / 4 = 3$. Mertebesi asal $3$ olan tek grup **$\\mathbb{Z}_3$** olur (eksenler üzerinde yalnızca çift $3$-döngüler, yani $A_3 \\cong \\mathbb{Z}_3$ üretilir).',
          ],
        },
        {
          prompt: '**Kanıt:** (i) Küp dönmelerinin metan dörtyüzlüsü $T_+$' + "'yi koruyan alt grubunun $\\ker\\chi = A_4$ ($12$ eleman) olduğunu; (ii) üç koordinat ekseni üzerindeki $\\psi: O \\to S_3$ homomorfizmasının örten olduğunu, $\\ker\\psi = V = \\{e, (12)(34), (13)(24), (14)(23)\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ olduğunu ve Birinci İzomorfizma Teoremiyle $S_4 / V \\cong S_3$ olduğunu kanıtlayın.",
          kind: 'proof',
          hints: [
            '(i) için $T_+$ ve $T_-$ iki elemanlı kümesi üzerindeki eylemden $\\chi: O \\to \\{\\pm 1\\}$ tanımlayıp üreteçler (örneğin yüz $90^\\circ$ $\\to -1$, köşegen $120^\\circ$ $\\to +1$) üzerinde $\\chi = \\operatorname{sgn} \\circ \\Phi$ olduğunu gösterin; (ii) için köşegen $\\mathrm{SO}(3)$ matrislerini sayıp $\\psi$ görüntüsünde bir transpozisyon ve bir $3$-döngü gösterin.',
          ],
          solution: [
            '**(i) Metan grubu $A_4$:** Küpün $8$ köşesi $T_+ = \\{xyz = +1\\}$ ve $T_- = \\{xyz = -1\\}$ olmak üzere iki düzgün dörtyüzlüye ayrılır; her $g \\in O$ bu ikili kümeyi permüte ederek $\\chi: O \\to \\{\\pm 1\\}$ homomorfizmasını tanımlar. Bir yüz $90^\\circ$ dönmesi ($4$-döngü, $\\operatorname{sgn} = -1$) $T_+ \\leftrightarrow T_-$ takas eder ($\\chi = -1$); köşegen $120^\\circ$ ($3$-döngü, $\\operatorname{sgn} = +1$) ve yüz $180^\\circ$ ($(ab)(cd)$, $\\operatorname{sgn} = +1$) $T_+$' + "'yi korur ($\\chi = +1$). $S_4$'ün tek indeks-$2$ alt grubu $A_4$ olduğundan $\\ker\\chi = A_4$ ($12$ eleman).",
            '**(ii) Eksen homomorfizması ve $S_4 / V \\cong S_3$:** Her $g \\in O$ üç yönsüz koordinat doğrusunu $\\{X, Y, Z\\}$ permüte eder ve matris çarpımı bileşkeye karşılık geldiğinden $\\psi: O \\to S_3$ bir homomorfizmadır. $g \\in \\ker\\psi \\iff M_g$ köşegen matris ($\\operatorname{diag}(\\pm 1, \\pm 1, \\pm 1)$, $\\det = +1$): tam $4$ matris ($I$ ve $x, y, z$ etrafında $180^\\circ$), $S_4$ içinde $V = \\{e, (12)(34), (13)(24), (14)(23)\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$. Ayrıca $R_z(90^\\circ)$ eksenlerde $(12)$ transpozisyonunu, $120^\\circ$ köşegen dönmesi $(123)$ döngüsünü ürettiğinden $\\psi$ örtendir. Birinci İzomorfizma Teoremiyle $O / V \\cong S_4 / V \\cong S_3$.',
          ],
          checklist: [
            '$T_+$ ve $T_-$ üzerindeki $\\chi: O \\to \\{\\pm 1\\}$ homomorfizması kuruldu ve $\\ker\\chi = A_4$ ($12$ eleman) gösterildi.',
            '$\\ker\\psi$' + "'nin köşegen $\\mathrm{SO}(3)$ matrisleri ($I$ ve üç $180^\\circ$ yüz dönmesi), yani $V = \\{e,(12)(34),(13)(24),(14)(23)\\} \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ olduğu kanıtlandı.",
            '$\\psi$' + "'nin örtenliği gösterilip Birinci İzomorfizma Teoremiyle $S_4 / V \\cong S_3$ elde edildi.",
          ],
        },
      ]),
    };
  },
};

// ---------- export ----------

export const TEMPLATES = [
  T_DIREKT_CARPIM,
  T_TORUS_KAFES,
  T_PARITE_ZAMAN,
  T_DN_ESLENIK_SINIFLAR,
  T_DN_NORMAL_CARPIM,
  T_DN_BOLUM_GRUPLARI,
  T_TEKERLEK_STROBOSKOP,
  T_BRILLOUIN_BOLGESI,
  T_KART_KARISTIRMA,
  T_TEKRARLAMA_LANDAU,
  T_ONBES_BULMACASI,
  T_KUP_KOSEGENLERI,
  T_KUP_SINIF_ESLENIK,
  T_METAN_BOLUM_S3,
];
