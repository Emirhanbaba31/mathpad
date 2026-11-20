// MathPad Group Theory Engine — pure finite group theory algorithms, zero DOM dependencies.
// Permutation composition convention: RIGHT-TO-LEFT (function composition): (p ∘ q)(x) = p(q(x)).

export const PERM_CONVENTION = 'right-to-left';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const toSup = k => String(k).split('').map(d => SUP[+d]).join('');

// ---------- Number theory helpers ----------

export function gcd(a, b) {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function lcm(a, b) {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  if (a === 0 || b === 0) return 0;
  return (a / gcd(a, b)) * b;
}

export function primeFactors(n) {
  n = Math.trunc(n);
  if (n < 2) return [];
  const out = [];
  let d = 2;
  while (d * d <= n) {
    if (n % d === 0) {
      let exp = 0;
      while (n % d === 0) { n /= d; exp++; }
      out.push([d, exp]);
    }
    d = d === 2 ? 3 : d + 2;
  }
  if (n > 1) out.push([n, 1]);
  return out;
}

export function divisors(n) {
  n = Math.trunc(n);
  if (n < 1) return [];
  const small = [], large = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      small.push(d);
      if (d * d !== n) large.push(n / d);
    }
  }
  return small.concat(large.reverse());
}

export function eulerPhi(n) {
  n = Math.trunc(n);
  if (n < 1) return 0;
  let res = n;
  for (const [p] of primeFactors(n)) res = (res / p) * (p - 1);
  return res;
}

// ---------- Permutation helpers (0-indexed arrays, right-to-left composition) ----------

export function identityPerm(n) {
  const p = new Array(n);
  for (let i = 0; i < n; i++) p[i] = i;
  return p;
}

export function composePerm(p, q) {
  const n = p.length;
  if (q.length !== n) throw new Error('Permütasyon uzunlukları eşit olmalı');
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = p[q[i]];
  return out;
}

export function invertPerm(p) {
  const n = p.length;
  const inv = new Array(n);
  for (let i = 0; i < n; i++) inv[p[i]] = i;
  return inv;
}

export function permToCycles(p) {
  const n = p.length;
  const seen = new Uint8Array(n);
  const cycles = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    const cyc = [];
    let cur = i;
    while (!seen[cur]) {
      seen[cur] = 1;
      cyc.push(cur + 1);
      cur = p[cur];
    }
    if (cyc.length > 1) cycles.push(cyc);
  }
  return cycles;
}

export function formatCycles(p) {
  const cycles = permToCycles(p);
  if (!cycles.length) return 'e';
  return cycles.map(c => `(${c.join(' ')})`).join('');
}

export function formatCyclesLatex(p) {
  const cycles = permToCycles(p);
  if (!cycles.length) return 'e';
  return cycles.map(c => `(${c.join('\\,')})`).join('');
}

export function parseCycles(input, n) {
  const raw = String(input ?? '').trim();
  if (!raw || raw === 'e' || raw === 'id' || raw === '()' || raw === '(1)') {
    return identityPerm(n ?? 1);
  }
  const cycleStrings = [];
  let depth = 0, start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') {
      if (depth !== 0) throw new Error('İç içe parantez kullanılamaz');
      depth = 1;
      start = i + 1;
    } else if (ch === ')') {
      if (depth !== 1) throw new Error('Eşleşmeyen kapanış parantezi');
      depth = 0;
      cycleStrings.push(raw.slice(start, i).trim());
    } else if (depth === 0 && !/[\s·∘*]/.test(ch)) {
      throw new Error(`Beklenmeyen karakter: "${ch}"`);
    }
  }
  if (depth !== 0) throw new Error('Kapanmamış parantez');
  if (!cycleStrings.length) return identityPerm(n ?? 1);

  const parsedCycles = [];
  let maxVal = n ?? 1;
  for (const cs of cycleStrings) {
    if (!cs) continue;
    let nums;
    if (/[\s,;]+/.test(cs)) {
      nums = cs.split(/[\s,;]+/).filter(Boolean).map(tok => {
        if (!/^\d+$/.test(tok)) throw new Error(`Geçersiz eleman: "${tok}"`);
        return Number(tok);
      });
    } else if (/^\d+$/.test(cs)) {
      // Compact single-digit cycle like (123) when no separators
      nums = cs.length === 1 ? [Number(cs)] : cs.split('').map(Number);
    } else {
      throw new Error(`Geçersiz devir: "(${cs})"`);
    }
    const seen = new Set();
    for (const v of nums) {
      if (v < 1) throw new Error(`Eleman 1'den küçük olamaz: ${v}`);
      if (n != null && v > n) throw new Error(`Eleman ${n} sınırını aşıyor: ${v}`);
      if (seen.has(v)) throw new Error(`Aynı devirde tekrar eden eleman: ${v}`);
      seen.add(v);
      if (v > maxVal) maxVal = v;
    }
    if (nums.length > 1) parsedCycles.push(nums);
  }

  const size = n ?? maxVal;
  let result = identityPerm(size);
  // Right-to-left composition: (c_1)(c_2)...(c_k) = c_1 ∘ c_2 ∘ ... ∘ c_k
  for (let k = parsedCycles.length - 1; k >= 0; k--) {
    const cyc = parsedCycles[k];
    const p = identityPerm(size);
    for (let i = 0; i < cyc.length; i++) {
      p[cyc[i] - 1] = cyc[(i + 1) % cyc.length] - 1;
    }
    result = composePerm(p, result);
  }
  return result;
}

export function cycleType(p) {
  const n = p.length;
  const seen = new Uint8Array(n);
  const lens = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    let len = 0, cur = i;
    while (!seen[cur]) {
      seen[cur] = 1;
      len++;
      cur = p[cur];
    }
    lens.push(len);
  }
  lens.sort((a, b) => b - a);
  return lens;
}

export function permOrder(p) {
  let ord = 1;
  for (const len of cycleType(p)) ord = lcm(ord, len);
  return ord;
}

export function permSign(p) {
  let swaps = 0;
  for (const len of cycleType(p)) swaps += len - 1;
  return swaps % 2 === 0 ? 1 : -1;
}

// Right-to-left transposition decomposition:
// (a_1 a_2 ... a_k) = (a_1 a_k)(a_1 a_{k-1})...(a_1 a_2)
export function toTranspositions(p) {
  const cycles = permToCycles(p);
  const trans = [];
  for (const c of cycles) {
    for (let i = c.length - 1; i >= 1; i--) {
      trans.push([c[0], c[i]]);
    }
  }
  return trans;
}

export function twoLineNotation(p) {
  const top = p.map((_, i) => i + 1);
  const bottom = p.map(v => v + 1);
  const latex = `\\begin{pmatrix} ${top.join(' & ')} \\\\ ${bottom.join(' & ')} \\end{pmatrix}`;
  return { top, bottom, latex };
}

// 15-puzzle (4x4) parity solvability checker.
// board: length-16 array with values 1..15 and 0 for the empty cell.
export function puzzleSolvability(board) {
  if (!Array.isArray(board) || board.length !== 16) {
    throw new Error('15-bulmaca tahtası 16 hücreli olmalı');
  }
  const seen = new Uint8Array(16);
  let zeroIdx = -1;
  for (let i = 0; i < 16; i++) {
    const v = board[i];
    if (!Number.isInteger(v) || v < 0 || v > 15 || seen[v]) {
      throw new Error('Tahta 0..15 sayılarının bir permütasyonu olmalı');
    }
    seen[v] = 1;
    if (v === 0) zeroIdx = i;
  }
  let inversions = 0;
  for (let i = 0; i < 16; i++) {
    if (board[i] === 0) continue;
    for (let j = i + 1; j < 16; j++) {
      if (board[j] !== 0 && board[i] > board[j]) inversions++;
    }
  }
  const zeroRow = Math.floor(zeroIdx / 4);
  const zeroCol = zeroIdx % 4;
  const emptyRowFromBottom = 4 - zeroRow; // 1 (bottom) .. 4 (top)
  const blankTaxicab = (3 - zeroRow) + (3 - zeroCol);
  // Permutation of all 16 positions mapping solved index -> current value's solved index
  // (where value 1..15 belongs at index v-1, and 0 belongs at index 15).
  const fullPerm = board.map(v => (v === 0 ? 15 : v - 1));
  const sign = permSign(fullPerm);
  const invariant = sign * (blankTaxicab % 2 === 0 ? 1 : -1);
  const solvable = (inversions + emptyRowFromBottom) % 2 === 1;
  return {
    solvable,
    inversions,
    emptyRowFromBottom,
    blankTaxicab,
    permSign: sign,
    invariant,
  };
}

// ---------- Core group factory & internal cache ----------

const CACHE = new WeakMap();
const cacheOf = G => {
  let c = CACHE.get(G);
  if (!c) { c = Object.create(null); CACHE.set(G, c); }
  return c;
};

export function createGroup({ name, latex, elements, table, e = 0, meta = {} }) {
  const n = elements.length;
  const flat = table instanceof Int32Array ? table : Int32Array.from(table);
  if (flat.length !== n * n) {
    throw new Error(`Cayley tablosu boyutu uyumsuz: ${flat.length} !== ${n * n}`);
  }
  const invs = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (flat[i * n + j] === e) {
        invs[i] = j;
        break;
      }
    }
  }
  const G = {
    name,
    latex: latex || name,
    elements: elements.slice(),
    size: n,
    e,
    table: flat,
    mul(i, j) { return flat[i * n + j]; },
    inv(i) { return invs[i]; },
    meta: { ...meta },
  };
  return G;
}

export function elemLatex(G, i) {
  const lx = G.meta?.latexElements;
  if (lx && lx[i] != null) return lx[i];
  const s = G.elements[i] ?? '';
  return s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, m => {
    const digits = [...m].map(ch => SUP.indexOf(ch)).join('');
    return `^{${digits}}`;
  });
}

// ---------- Group constructors ----------

export function cyclic(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    throw new Error('Z_n için n 1 ile 200 arasında bir tam sayı olmalı');
  }
  const elements = Array.from({ length: n }, (_, i) => String(i));
  const table = new Int32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      table[i * n + j] = (i + j) % n;
    }
  }
  return createGroup({
    name: `Z_${n}`,
    latex: `\\mathbb{Z}_{${n}}`,
    elements,
    table,
    e: 0,
    meta: {
      kind: 'Z',
      n,
      spec: { kind: 'Z', n },
      turkishName: `Devirli Grup Z_${n}`,
      operation: '+',
      latexElements: elements.slice(),
      defaultGenerators: n > 1 ? [1] : [0],
    },
  });
}

export function dihedral(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error('D_n için n 1 ile 100 arasında bir tam sayı olmalı');
  }
  const size = 2 * n;
  const elements = new Array(size);
  const latexElements = new Array(size);
  const perms = new Array(size);
  for (let k = 0; k < n; k++) {
    elements[k] = k === 0 ? 'e' : k === 1 ? 'r' : `r${toSup(k)}`;
    latexElements[k] = k === 0 ? 'e' : k === 1 ? 'r' : `r^{${k}}`;
    // Rotation r^k acts on polygon vertices 0..n-1 as v -> (v + k) mod n
    const pr = new Array(n);
    for (let v = 0; v < n; v++) pr[v] = (v + k) % n;
    perms[k] = pr;

    elements[n + k] = k === 0 ? 's' : k === 1 ? 'sr' : `sr${toSup(k)}`;
    latexElements[n + k] = k === 0 ? 's' : k === 1 ? 'sr' : `sr^{${k}}`;
    // Reflection s r^k acts right-to-left: v -> -(v + k) mod n
    const ps = new Array(n);
    for (let v = 0; v < n; v++) ps[v] = ((n - ((v + k) % n)) % n);
    perms[n + k] = ps;
  }

  // Presentation: r^n = s^2 = e, r^a s = s r^{-a}
  // r^a * r^b = r^{a+b}
  // r^a * (s r^b) = s r^{b-a}
  // (s r^a) * r^b = s r^{a+b}
  // (s r^a) * (s r^b) = r^{b-a}
  const mod = x => ((x % n) + n) % n;
  const table = new Int32Array(size * size);
  for (let i = 0; i < size; i++) {
    const si = i >= n ? 1 : 0;
    const a = si ? i - n : i;
    for (let j = 0; j < size; j++) {
      const sj = j >= n ? 1 : 0;
      const b = sj ? j - n : j;
      let res;
      if (si === 0 && sj === 0) res = mod(a + b);
      else if (si === 0 && sj === 1) res = n + mod(b - a);
      else if (si === 1 && sj === 0) res = n + mod(a + b);
      else res = mod(b - a);
      table[i * size + j] = res;
    }
  }
  return createGroup({
    name: `D_${n}`,
    latex: `D_{${n}}`,
    elements,
    table,
    e: 0,
    meta: {
      kind: 'D',
      n,
      spec: { kind: 'D', n },
      turkishName: `Dihedral Grup D_${n} (${n}-gen simetrileri)`,
      perms,
      latexElements,
      defaultGenerators: n > 1 ? [1, n] : [n],
    },
  });
}

function allPermutations(n) {
  const res = [];
  const cur = identityPerm(n);
  const used = new Uint8Array(n);
  function bt(depth) {
    if (depth === n) {
      res.push(cur.slice());
      return;
    }
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      used[v] = 1;
      cur[depth] = v;
      bt(depth + 1);
      used[v] = 0;
    }
  }
  bt(0);
  return res;
}

function groupFromPermutations({ name, latex, perms, meta }) {
  const m = perms.length;
  const keyOf = p => p.join(',');
  const idxMap = new Map();
  const elements = new Array(m);
  const latexElements = new Array(m);
  for (let i = 0; i < m; i++) {
    idxMap.set(keyOf(perms[i]), i);
    elements[i] = formatCycles(perms[i]);
    latexElements[i] = formatCyclesLatex(perms[i]);
  }
  const table = new Int32Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const prod = composePerm(perms[i], perms[j]);
      table[i * m + j] = idxMap.get(keyOf(prod));
    }
  }
  return createGroup({
    name,
    latex,
    elements,
    table,
    e: 0,
    meta: { ...meta, perms, latexElements },
  });
}

export function symmetric(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error('S_n için n 1 ile 5 arasında bir tam sayı olmalı');
  }
  const perms = allPermutations(n);
  let defaultGenerators = [0];
  if (n === 2) defaultGenerators = [1];
  else if (n >= 3) {
    const t = parseCycles('(1 2)', n);
    const cyc = identityPerm(n).map((_, i) => (i + 1) % n);
    const key = p => p.join(',');
    const idxT = perms.findIndex(p => key(p) === key(t));
    const idxC = perms.findIndex(p => key(p) === key(cyc));
    defaultGenerators = [idxT, idxC];
  }
  return groupFromPermutations({
    name: `S_${n}`,
    latex: `S_{${n}}`,
    perms,
    meta: {
      kind: 'S',
      n,
      spec: { kind: 'S', n },
      turkishName: `Simetrik Grup S_${n}`,
      degree: n,
      defaultGenerators,
    },
  });
}

export function alternating(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error('A_n için n 1 ile 5 arasında bir tam sayı olmalı');
  }
  const perms = allPermutations(n).filter(p => permSign(p) === 1);
  let defaultGenerators = [0];
  if (n === 3) defaultGenerators = [1];
  else if (n === 4) {
    const a = parseCycles('(1 2 3)', 4);
    const b = parseCycles('(1 2)(3 4)', 4);
    const key = p => p.join(',');
    defaultGenerators = [
      perms.findIndex(p => key(p) === key(a)),
      perms.findIndex(p => key(p) === key(b)),
    ];
  } else if (n === 5) {
    const a = parseCycles('(1 2 3)', 5);
    const b = parseCycles('(1 2 3 4 5)', 5);
    const key = p => p.join(',');
    defaultGenerators = [
      perms.findIndex(p => key(p) === key(a)),
      perms.findIndex(p => key(p) === key(b)),
    ];
  }
  return groupFromPermutations({
    name: `A_${n}`,
    latex: `A_{${n}}`,
    perms,
    meta: {
      kind: 'A',
      n,
      spec: { kind: 'A', n },
      turkishName: `Alternatif Grup A_${n}`,
      degree: n,
      defaultGenerators,
    },
  });
}

export function kleinFour() {
  const elements = ['e', 'a', 'b', 'c'];
  const table = new Int32Array([
    0, 1, 2, 3,
    1, 0, 3, 2,
    2, 3, 0, 1,
    3, 2, 1, 0,
  ]);
  return createGroup({
    name: 'V_4',
    latex: 'V_4',
    elements,
    table,
    e: 0,
    meta: {
      kind: 'V4',
      spec: { kind: 'V4' },
      turkishName: 'Klein Dörtlü Grubu V_4',
      latexElements: elements.slice(),
      defaultGenerators: [1, 2],
    },
  });
}

export function quaternion() {
  const elements = ['1', '-1', 'i', '-i', 'j', '-j', 'k', '-k'];
  const basisProd = (b1, b2) => {
    if (b1 === 0) return [1, b2];
    if (b2 === 0) return [1, b1];
    if (b1 === b2) return [-1, 0];
    if (b1 === 1 && b2 === 2) return [1, 3];
    if (b1 === 2 && b2 === 3) return [1, 1];
    if (b1 === 3 && b2 === 1) return [1, 2];
    if (b1 === 2 && b2 === 1) return [-1, 3];
    if (b1 === 3 && b2 === 2) return [-1, 1];
    return [-1, 2]; // (1, 3)
  };
  const table = new Int32Array(64);
  for (let x = 0; x < 8; x++) {
    const sx = x % 2 === 0 ? 1 : -1;
    const bx = x >> 1;
    for (let y = 0; y < 8; y++) {
      const sy = y % 2 === 0 ? 1 : -1;
      const by = y >> 1;
      const [sb, b] = basisProd(bx, by);
      const s = sx * sy * sb;
      table[x * 8 + y] = b * 2 + (s === 1 ? 0 : 1);
    }
  }
  return createGroup({
    name: 'Q_8',
    latex: 'Q_8',
    elements,
    table,
    e: 0,
    meta: {
      kind: 'Q8',
      spec: { kind: 'Q8' },
      turkishName: 'Kuaterniyon Grubu Q_8',
      latexElements: elements.slice(),
      defaultGenerators: [2, 4], // i, j
    },
  });
}

export function unitGroup(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 2 || n > 60) {
    throw new Error('U(n) için n 2 ile 60 arasında bir tam sayı olmalı');
  }
  const units = [];
  for (let a = 1; a < n; a++) {
    if (gcd(a, n) === 1) units.push(a);
  }
  const m = units.length;
  const idxOf = new Map(units.map((u, i) => [u, i]));
  const elements = units.map(String);
  const table = new Int32Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      table[i * m + j] = idxOf.get((units[i] * units[j]) % n);
    }
  }
  return createGroup({
    name: `U(${n})`,
    latex: `U(${n})`,
    elements,
    table,
    e: 0,
    meta: {
      kind: 'U',
      n,
      units,
      spec: { kind: 'U', n },
      turkishName: `Birimler Grubu U(${n}) = (Z_${n})^×`,
      latexElements: elements.slice(),
    },
  });
}

export function directProduct(G, H) {
  const n1 = G.size, n2 = H.size;
  const size = n1 * n2;
  if (size > 240) {
    throw new Error(`Direkt çarpım mertebesi çok büyük (${size} > 240)`);
  }
  const elements = new Array(size);
  const latexElements = new Array(size);
  for (let i = 0; i < n1; i++) {
    for (let j = 0; j < n2; j++) {
      const idx = i * n2 + j;
      elements[idx] = `(${G.elements[i]},${H.elements[j]})`;
      latexElements[idx] = `(${elemLatex(G, i)},\\,${elemLatex(H, j)})`;
    }
  }
  const table = new Int32Array(size * size);
  for (let i1 = 0; i1 < n1; i1++) {
    for (let j1 = 0; j1 < n2; j1++) {
      const a = i1 * n2 + j1;
      for (let i2 = 0; i2 < n1; i2++) {
        const pi = G.mul(i1, i2) * n2;
        for (let j2 = 0; j2 < n2; j2++) {
          table[a * size + (i2 * n2 + j2)] = pi + H.mul(j1, j2);
        }
      }
    }
  }
  const e = G.e * n2 + H.e;
  return createGroup({
    name: `${G.name} × ${H.name}`,
    latex: `${G.latex} \\times ${H.latex}`,
    elements,
    table,
    e,
    meta: {
      kind: 'Prod',
      left: G.meta?.spec || null,
      right: H.meta?.spec || null,
      spec: G.meta?.spec && H.meta?.spec ? { kind: 'Prod', left: G.meta.spec, right: H.meta.spec } : null,
      turkishName: `Direkt Çarpım ${G.name} × ${H.name}`,
      latexElements,
      factors: [G, H],
    },
  });
}

// Proper 3D rotation group of the cube (order 24, isomorphic to S_4 via action on the 4 space diagonals).
export function cubeRotations() {
  const mul3 = (A, B) => {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
      }
    }
    return C;
  };
  const apply3 = (M, v) => [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
  const matKey = M => M.flat().join(',');

  // 4 space diagonals (each represented by one vertex; opposite vertex is -v)
  const DIAGS = [
    [1, 1, 1],
    [-1, 1, 1],
    [-1, -1, 1],
    [1, -1, 1],
  ];
  const diagPerm = M => {
    const p = new Array(4);
    for (let d = 0; d < 4; d++) {
      const v = apply3(M, DIAGS[d]);
      for (let k = 0; k < 4; k++) {
        const D = DIAGS[k];
        if ((v[0] === D[0] && v[1] === D[1] && v[2] === D[2]) ||
            (v[0] === -D[0] && v[1] === -D[1] && v[2] === -D[2])) {
          p[d] = k;
          break;
        }
      }
    }
    return p;
  };

  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const RX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]; // +90° around x
  const RY = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]; // +90° around y
  const RZ = [[0, -1, 0], [1, 0, 0], [0, 0, 1]]; // +90° around z

  const mats = [I];
  const seen = new Map([[matKey(I), 0]]);
  const gens = [RX, RY, RZ];
  for (let head = 0; head < mats.length; head++) {
    const M = mats[head];
    for (const g of gens) {
      const P = mul3(g, M);
      const k = matKey(P);
      if (!seen.has(k)) {
        seen.set(k, mats.length);
        mats.push(P);
      }
    }
  }

  const perms = mats.map(diagPerm);
  const describeRot = (M, p) => {
    const tr = M[0][0] + M[1][1] + M[2][2];
    const ct = cycleType(p).join(',');
    if (tr === 3) return 'Birim (0°)';
    if (tr === 1) return 'Yüz ekseni 90°';
    if (tr === 0) return 'Köşegen ekseni 120°';
    if (ct === '2,2') return 'Yüz ekseni 180°';
    return 'Kenar ekseni 180°';
  };

  const rotations = mats.map((M, i) => ({
    matrix: M,
    perm: perms[i],
    desc: describeRot(M, perms[i]),
  }));

  const m = mats.length;
  const table = new Int32Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      table[i * m + j] = seen.get(matKey(mul3(mats[i], mats[j])));
    }
  }
  const elements = perms.map(formatCycles);
  const latexElements = perms.map(formatCyclesLatex);
  const idxRx = seen.get(matKey(RX));
  const idxRy = seen.get(matKey(RY));
  const idxRz = seen.get(matKey(RZ));

  return createGroup({
    name: 'Küp (SO₃)',
    latex: 'O \\cong S_4',
    elements,
    table,
    e: 0,
    meta: {
      kind: 'Cube',
      spec: { kind: 'Cube' },
      turkishName: 'Küpün Dönme Grubu (4 köşegen permütasyonu)',
      perms,
      rotations,
      diagonals: DIAGS,
      genIndices: { rx: idxRx, ry: idxRy, rz: idxRz },
      defaultGenerators: [idxRx, idxRy],
      latexElements,
    },
  });
}

export function buildGroup(spec) {
  if (!spec || typeof spec !== 'object') return dihedral(4);
  switch (spec.kind) {
    case 'Z': return cyclic(spec.n ?? 6);
    case 'D': return dihedral(spec.n ?? 4);
    case 'S': return symmetric(spec.n ?? 3);
    case 'A': return alternating(spec.n ?? 4);
    case 'V4': return kleinFour();
    case 'Q8': return quaternion();
    case 'U': return unitGroup(spec.n ?? 10);
    case 'Cube': return cubeRotations();
    case 'Prod': return directProduct(buildGroup(spec.left), buildGroup(spec.right));
    default: return buildExtendedGroup(spec);
  }
}

// ---------- Core group algorithms ----------

function toSortedIndices(H) {
  if (!H) return [];
  const raw = Array.isArray(H) ? H : (Array.isArray(H.elements) ? H.elements : Array.from(H));
  const set = new Set();
  for (const x of raw) set.add(x);
  return Array.from(set).sort((a, b) => a - b);
}

export function order(G, a) {
  if (!Number.isInteger(a) || a < 0 || a >= G.size) {
    throw new Error(`Geçersiz eleman indeksi: ${a}`);
  }
  let cur = a, k = 1;
  while (cur !== G.e) {
    cur = G.mul(cur, a);
    k++;
    if (k > G.size) throw new Error('Sonlu grup aksiyomu ihlali');
  }
  return k;
}

export function elementOrders(G) {
  const c = cacheOf(G);
  if (c.elemOrders) return c.elemOrders;
  const arr = new Int32Array(G.size);
  for (let i = 0; i < G.size; i++) arr[i] = order(G, i);
  c.elemOrders = arr;
  return arr;
}

export function orders(G) {
  const c = cacheOf(G);
  if (c.orders) return new Map(c.orders);
  const eo = elementOrders(G);
  const counts = new Map();
  for (let i = 0; i < G.size; i++) {
    const o = eo[i];
    counts.set(o, (counts.get(o) || 0) + 1);
  }
  const sorted = new Map([...counts.entries()].sort((a, b) => a[0] - b[0]));
  c.orders = sorted;
  return new Map(sorted);
}

export function isAbelian(G) {
  const c = cacheOf(G);
  if (c.isAbelian !== undefined) return c.isAbelian;
  const n = G.size;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (G.mul(i, j) !== G.mul(j, i)) {
        c.isAbelian = false;
        return false;
      }
    }
  }
  c.isAbelian = true;
  return true;
}

export function exponent(G) {
  const c = cacheOf(G);
  if (c.exponent !== undefined) return c.exponent;
  let exp = 1;
  for (const o of orders(G).keys()) exp = lcm(exp, o);
  c.exponent = exp;
  return exp;
}

export function generate(G, gens) {
  const genList = [];
  const genSeen = new Uint8Array(G.size);
  for (const g of gens || []) {
    if (!Number.isInteger(g) || g < 0 || g >= G.size) {
      throw new Error(`Geçersiz üreteç indeksi: ${g}`);
    }
    if (g !== G.e && !genSeen[g]) {
      genSeen[g] = 1;
      genList.push(g);
    }
  }
  const inSet = new Uint8Array(G.size);
  const elems = [G.e];
  inSet[G.e] = 1;
  for (let head = 0; head < elems.length; head++) {
    const x = elems[head];
    for (let k = 0; k < genList.length; k++) {
      const y = G.mul(x, genList[k]);
      if (!inSet[y]) {
        inSet[y] = 1;
        elems.push(y);
      }
    }
  }
  elems.sort((a, b) => a - b);
  return elems;
}

export function isSubgroup(G, H) {
  const arr = toSortedIndices(H);
  if (!arr.length) return false;
  const inH = new Uint8Array(G.size);
  for (const x of arr) {
    if (!Number.isInteger(x) || x < 0 || x >= G.size) return false;
    inH[x] = 1;
  }
  if (!inH[G.e]) return false;
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (!inH[G.inv(a)]) return false;
    for (let j = 0; j < arr.length; j++) {
      if (!inH[G.mul(a, arr[j])]) return false;
    }
  }
  return true;
}

export function isNormal(G, H) {
  const arr = toSortedIndices(H);
  if (!isSubgroup(G, arr)) return false;
  if (isAbelian(G)) return true;
  const inH = new Uint8Array(G.size);
  for (const x of arr) inH[x] = 1;
  const n = G.size;
  for (let g = 0; g < n; g++) {
    const gInv = G.inv(g);
    for (let i = 0; i < arr.length; i++) {
      const conj = G.mul(G.mul(g, arr[i]), gInv);
      if (!inH[conj]) return false;
    }
  }
  return true;
}

export function leftCosets(G, H) {
  const arr = toSortedIndices(H);
  if (!isSubgroup(G, arr)) throw new Error('Verilen küme alt grup değil');
  const seen = new Uint8Array(G.size);
  const cosets = [];
  // Always put identity coset H first
  const idCoset = arr.slice();
  for (const x of idCoset) seen[x] = 1;
  cosets.push(idCoset);

  for (let g = 0; g < G.size; g++) {
    if (seen[g]) continue;
    const c = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const v = G.mul(g, arr[i]);
      c[i] = v;
      seen[v] = 1;
    }
    c.sort((a, b) => a - b);
    cosets.push(c);
  }
  return cosets;
}

export function rightCosets(G, H) {
  const arr = toSortedIndices(H);
  if (!isSubgroup(G, arr)) throw new Error('Verilen küme alt grup değil');
  const seen = new Uint8Array(G.size);
  const cosets = [];
  const idCoset = arr.slice();
  for (const x of idCoset) seen[x] = 1;
  cosets.push(idCoset);

  for (let g = 0; g < G.size; g++) {
    if (seen[g]) continue;
    const c = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const v = G.mul(arr[i], g);
      c[i] = v;
      seen[v] = 1;
    }
    c.sort((a, b) => a - b);
    cosets.push(c);
  }
  return cosets;
}

export function index(G, H) {
  const arr = toSortedIndices(H);
  if (!isSubgroup(G, arr)) throw new Error('Verilen küme alt grup değil');
  return G.size / arr.length;
}

export function conjugacyClasses(G) {
  const c = cacheOf(G);
  if (c.conjClasses) return c.conjClasses.map(cls => cls.slice());
  const n = G.size;
  const seen = new Uint8Array(n);
  const classes = [];
  for (let a = 0; a < n; a++) {
    if (seen[a]) continue;
    const cls = [];
    for (let g = 0; g < n; g++) {
      const conj = G.mul(G.mul(g, a), G.inv(g));
      if (!seen[conj]) {
        seen[conj] = 1;
        cls.push(conj);
      }
    }
    cls.sort((a1, a2) => a1 - a2);
    classes.push(cls);
  }
  c.conjClasses = classes;
  return classes.map(cls => cls.slice());
}

export function center(G) {
  const c = cacheOf(G);
  if (c.center) return c.center.slice();
  const n = G.size;
  const out = [];
  for (let z = 0; z < n; z++) {
    let ok = true;
    for (let g = 0; g < n; g++) {
      if (G.mul(z, g) !== G.mul(g, z)) { ok = false; break; }
    }
    if (ok) out.push(z);
  }
  c.center = out;
  return out.slice();
}

export function centralizer(G, a) {
  if (!Number.isInteger(a) || a < 0 || a >= G.size) {
    throw new Error(`Geçersiz eleman indeksi: ${a}`);
  }
  const out = [];
  for (let g = 0; g < G.size; g++) {
    if (G.mul(g, a) === G.mul(a, g)) out.push(g);
  }
  return out;
}

export function normalizer(G, H) {
  const arr = toSortedIndices(H);
  const inH = new Uint8Array(G.size);
  for (const x of arr) {
    if (x < 0 || x >= G.size) throw new Error(`Geçersiz eleman indeksi: ${x}`);
    inH[x] = 1;
  }
  const out = [];
  for (let g = 0; g < G.size; g++) {
    const gInv = G.inv(g);
    let ok = true;
    for (let i = 0; i < arr.length; i++) {
      if (!inH[G.mul(G.mul(g, arr[i]), gInv)]) { ok = false; break; }
    }
    if (ok) out.push(g);
  }
  return out;
}

export function commutatorSubgroup(G) {
  const c = cacheOf(G);
  if (c.commutator) return c.commutator.slice();
  if (isAbelian(G)) {
    c.commutator = [G.e];
    return [G.e];
  }
  const n = G.size;
  const seen = new Uint8Array(n);
  const comms = [];
  for (let a = 0; a < n; a++) {
    const aInv = G.inv(a);
    for (let b = 0; b < n; b++) {
      const ab = G.mul(a, b);
      const comm = G.mul(G.mul(ab, aInv), G.inv(b));
      if (!seen[comm]) {
        seen[comm] = 1;
        comms.push(comm);
      }
    }
  }
  const sub = generate(G, comms);
  c.commutator = sub;
  return sub.slice();
}

// ---------- All subgroups enumeration (fast BigInt bitmask cyclic-join) ----------

function maskOf(elems) {
  let m = 0n;
  for (let i = 0; i < elems.length; i++) m |= 1n << BigInt(elems[i]);
  return m;
}

function pruneGenerators(G, gens, targetSize) {
  if (targetSize === 1) return [G.e];
  let cur = gens.slice();
  for (let i = cur.length - 1; i >= 0 && cur.length > 1; i--) {
    const trial = cur.slice(0, i).concat(cur.slice(i + 1));
    if (generate(G, trial).length === targetSize) cur = trial;
  }
  return cur;
}

export function subgroups(G) {
  const c = cacheOf(G);
  if (c.subgroups) {
    return c.subgroups.map(s => ({
      elements: s.elements.slice(),
      order: s.order,
      generators: s.generators.slice(),
      isNormal: s.isNormal,
      isCyclic: s.isCyclic,
      key: s.key,
    }));
  }

  const n = G.size;
  const allMask = (1n << BigInt(n)) - 1n;
  const allElems = Array.from({ length: n }, (_, i) => i);
  const half = n >> 1;

  // Step 1: enumerate all distinct cyclic subgroups
  const found = new Map(); // BigInt mask -> { elements, mask, generators, isCyclic }
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
      const entry = {
        elements: elems,
        mask,
        generators: [a],
        isCyclic: true,
      };
      found.set(mask, entry);
      if (a !== G.e) cyclicList.push({ g: a, mask, bit: 1n << BigInt(a) });
    }
  }

  // Step 2: BFS closure by joining each subgroup H with each cyclic generator g not in H
  const queue = Array.from(found.values());
  for (let qi = 0; qi < queue.length; qi++) {
    const H = queue[qi];
    if (H.elements.length === n) continue;

    for (let ci = 0; ci < cyclicList.length; ci++) {
      const cyc = cyclicList[ci];
      if ((H.mask & cyc.bit) !== 0n) continue;

      // Compute <H, cyc.g> starting from H and pushing H * cyc.g into BFS frontier
      let mask = H.mask;
      const elems = H.elements.slice();
      const gens = H.generators.length === 1 && H.generators[0] === G.e
        ? [cyc.g]
        : H.generators.concat(cyc.g);
      const frontier = [];
      let hitWhole = false;

      for (let i = 0; i < H.elements.length; i++) {
        const y = G.mul(H.elements[i], cyc.g);
        const yb = 1n << BigInt(y);
        if ((mask & yb) === 0n) {
          mask |= yb;
          elems.push(y);
          frontier.push(y);
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
              mask |= yb;
              elems.push(y);
              frontier.push(y);
              if (elems.length > half) { hitWhole = true; break; }
            }
          }
          if (hitWhole) break;
        }
      }

      if (hitWhole) {
        if (!found.has(allMask)) {
          const whole = {
            elements: allElems.slice(),
            mask: allMask,
            generators: pruneGenerators(G, gens, n),
            isCyclic: false,
          };
          found.set(allMask, whole);
        }
      } else if (!found.has(mask)) {
        elems.sort((x, y) => x - y);
        const entry = {
          elements: elems,
          mask,
          generators: pruneGenerators(G, gens, elems.length),
          isCyclic: false,
        };
        found.set(mask, entry);
        queue.push(entry);
      }
    }
  }

  // Finalize metadata (normality, sorted by order then lexicographically)
  const list = Array.from(found.values()).map(s => ({
    elements: s.elements,
    order: s.elements.length,
    generators: s.generators,
    isNormal: isNormal(G, s.elements),
    isCyclic: s.isCyclic,
    key: s.elements.join(','),
  }));

  list.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const len = a.elements.length;
    for (let i = 0; i < len; i++) {
      if (a.elements[i] !== b.elements[i]) return a.elements[i] - b.elements[i];
    }
    return 0;
  });

  c.subgroups = list;
  return list.map(s => ({
    elements: s.elements.slice(),
    order: s.order,
    generators: s.generators.slice(),
    isNormal: s.isNormal,
    isCyclic: s.isCyclic,
    key: s.key,
  }));
}

// ---------- Quotient group ----------

export function quotient(G, N) {
  const arr = toSortedIndices(N);
  if (!isNormal(G, arr)) {
    throw new Error('Alt grup normal değil; bölüm grubu G/N tanımlı değil');
  }
  const cosets = leftCosets(G, arr);
  const m = cosets.length;
  const cosetOf = new Int32Array(G.size);
  for (let ci = 0; ci < m; ci++) {
    for (const x of cosets[ci]) cosetOf[x] = ci;
  }
  const table = new Int32Array(m * m);
  for (let i = 0; i < m; i++) {
    const ri = cosets[i][0];
    for (let j = 0; j < m; j++) {
      table[i * m + j] = cosetOf[G.mul(ri, cosets[j][0])];
    }
  }
  const elements = cosets.map((c, i) => (i === 0 ? 'N' : `${G.elements[c[0]]}N`));
  const latexElements = cosets.map((c, i) => (i === 0 ? 'N' : `${elemLatex(G, c[0])}N`));
  return createGroup({
    name: `${G.name}/N`,
    latex: `${G.latex}/N`,
    elements,
    table,
    e: 0,
    meta: {
      kind: 'Quotient',
      turkishName: `Bölüm Grubu ${G.name}/N`,
      parent: G.name,
      normalSubgroup: arr,
      cosets,
      cosetOf: Array.from(cosetOf),
      latexElements,
    },
  });
}

// ---------- Cyclic & generating sets ----------

export function isCyclic(G) {
  const eo = elementOrders(G);
  for (let i = 0; i < G.size; i++) {
    if (eo[i] === G.size) return true;
  }
  return false;
}

export function cyclicGenerators(G) {
  const eo = elementOrders(G);
  const out = [];
  for (let i = 0; i < G.size; i++) {
    if (eo[i] === G.size) out.push(i);
  }
  return out;
}

export function minimalGeneratingSet(G) {
  const c = cacheOf(G);
  if (c.minGens) return c.minGens.slice();

  const n = G.size;
  if (n === 1) {
    c.minGens = [G.e];
    return [G.e];
  }
  const cyc = cyclicGenerators(G);
  if (cyc.length) {
    c.minGens = [cyc[0]];
    return [cyc[0]];
  }

  // Deduplicate candidate elements by their cyclic subgroup (pick smallest rep, ordered by descending order)
  const eo = elementOrders(G);
  const seenCyc = new Set();
  const candidates = [];
  for (let a = 0; a < n; a++) {
    if (a === G.e) continue;
    const sub = generate(G, [a]);
    const m = maskOf(sub);
    if (!seenCyc.has(m)) {
      seenCyc.add(m);
      candidates.push({ g: a, ord: eo[a], mask: m });
    }
  }
  candidates.sort((x, y) => y.ord - x.ord || x.g - y.g);

  // Check size 2 first (covers D_n, S_n, A_n, Q_8, V_4, Cube, most groups)
  for (let i = 0; i < candidates.length; i++) {
    const ci = candidates[i];
    for (let j = i + 1; j < candidates.length; j++) {
      const cj = candidates[j];
      if ((ci.mask & (1n << BigInt(cj.g))) !== 0n) continue;
      if (generate(G, [ci.g, cj.g]).length === n) {
        c.minGens = [ci.g, cj.g];
        return c.minGens.slice();
      }
    }
  }

  // Iterative deepening for rank >= 3 with search budget
  let budget = 8000;
  function dfs(k, startIdx, curGens, curElems, curMask) {
    if (curElems.length === n) return curGens.slice();
    if (k === 0 || budget <= 0) return null;
    for (let i = startIdx; i < candidates.length; i++) {
      if (budget <= 0) return null;
      const cand = candidates[i];
      if ((curMask & (1n << BigInt(cand.g))) !== 0n) continue;
      budget--;
      const nextGens = curGens.concat(cand.g);
      const nextElems = generate(G, nextGens);
      if (nextElems.length === n) return nextGens;
      if (k > 1 && nextElems.length > curElems.length) {
        const res = dfs(k - 1, i + 1, nextGens, nextElems, maskOf(nextElems));
        if (res) return res;
      }
    }
    return null;
  }

  for (let k = 3; k <= 6; k++) {
    budget = 8000;
    const found = dfs(k, 0, [], [G.e], 1n << BigInt(G.e));
    if (found) {
      c.minGens = found;
      return found.slice();
    }
  }

  // Greedy fallback + prune
  let gens = [];
  let cur = [G.e];
  let curMask = 1n << BigInt(G.e);
  for (const cand of candidates) {
    if ((curMask & (1n << BigInt(cand.g))) === 0n) {
      gens.push(cand.g);
      cur = generate(G, gens);
      curMask = maskOf(cur);
      if (cur.length === n) break;
    }
  }
  gens = pruneGenerators(G, gens, n);
  c.minGens = gens;
  return gens.slice();
}

// ---------- Homomorphisms ----------

export function homomorphismFailure(G, H, map) {
  if (!map || map.length !== G.size) {
    return { reason: 'Dönüşüm tüm G elemanlarını kapsamıyor' };
  }
  for (let i = 0; i < G.size; i++) {
    const v = map[i];
    if (!Number.isInteger(v) || v < 0 || v >= H.size) {
      return { a: i, reason: 'Hedef kümede geçersiz eleman' };
    }
  }
  for (let a = 0; a < G.size; a++) {
    for (let b = 0; b < G.size; b++) {
      const lhs = map[G.mul(a, b)];
      const rhs = H.mul(map[a], map[b]);
      if (lhs !== rhs) {
        return { a, b, ab: G.mul(a, b), lhs, rhs };
      }
    }
  }
  return null;
}

export function isHomomorphism(G, H, map) {
  return homomorphismFailure(G, H, map) === null;
}

export function kernel(G, H, map) {
  if (!isHomomorphism(G, H, map)) {
    throw new Error('Verilen dönüşüm bir homomorfizma değil');
  }
  const out = [];
  for (let i = 0; i < G.size; i++) {
    if (map[i] === H.e) out.push(i);
  }
  return out;
}

export function image(G, H, map) {
  if (!isHomomorphism(G, H, map)) {
    throw new Error('Verilen dönüşüm bir homomorfizma değil');
  }
  const seen = new Uint8Array(H.size);
  const out = [];
  for (let i = 0; i < G.size; i++) {
    const v = map[i];
    if (!seen[v]) {
      seen[v] = 1;
      out.push(v);
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

// Extends a partial assignment on generators (Map or array of [gIdx, hIdx]) to a homomorphism G -> H.
export function extendHomomorphism(G, H, genImages) {
  const pairs = genImages instanceof Map ? Array.from(genImages.entries()) : Array.from(genImages || []);
  const map = new Int32Array(G.size).fill(-1);
  map[G.e] = H.e;

  for (const [g, h] of pairs) {
    if (!Number.isInteger(g) || g < 0 || g >= G.size || !Number.isInteger(h) || h < 0 || h >= H.size) {
      return { ok: false, reason: 'Geçersiz eleman indeksi' };
    }
    if (map[g] !== -1 && map[g] !== h) {
      return {
        ok: false,
        reason: g === G.e ? 'Birim eleman birim elemana gitmeli: φ(e) = e_H' : 'Aynı üretece çelişkili görüntüler verildi',
        conflict: { a: G.e, b: g, ab: g, lhs: map[g], rhs: h },
      };
    }
    map[g] = h;
  }

  const queue = [G.e];
  const inQueue = new Uint8Array(G.size);
  inQueue[G.e] = 1;
  for (const [g] of pairs) {
    if (!inQueue[g]) { inQueue[g] = 1; queue.push(g); }
  }

  for (let head = 0; head < queue.length; head++) {
    const x = queue[head];
    const hx = map[x];
    for (let k = 0; k < pairs.length; k++) {
      const [g, hg] = pairs[k];
      const y = G.mul(x, g);
      const hy = H.mul(hx, hg);
      if (map[y] === -1) {
        map[y] = hy;
        if (!inQueue[y]) { inQueue[y] = 1; queue.push(y); }
      } else if (map[y] !== hy) {
        return {
          ok: false,
          reason: `İyi tanımlı değil: φ(${G.elements[x]}·${G.elements[g]}) = ${H.elements[map[y]]} ≠ ${H.elements[hy]}`,
          conflict: { a: x, b: g, ab: y, lhs: map[y], rhs: hy },
        };
      }
    }
  }

  if (queue.length < G.size) {
    return {
      ok: false,
      partial: true,
      covered: queue.length,
      reason: `Seçilen üreteçler tüm ${G.name} grubunu üretmiyor (${queue.length}/${G.size} eleman kapsandı)`,
    };
  }

  const arr = Array.from(map);
  const fail = homomorphismFailure(G, H, arr);
  if (fail) {
    return {
      ok: false,
      reason: `Homomorfizma koşulu bozuluyor: φ(${G.elements[fail.a]}·${G.elements[fail.b]}) ≠ φ(${G.elements[fail.a]})·φ(${G.elements[fail.b]})`,
      conflict: fail,
    };
  }

  const ker = [];
  const imSeen = new Uint8Array(H.size);
  const im = [];
  for (let i = 0; i < G.size; i++) {
    if (arr[i] === H.e) ker.push(i);
    if (!imSeen[arr[i]]) { imSeen[arr[i]] = 1; im.push(arr[i]); }
  }
  im.sort((a, b) => a - b);

  return {
    ok: true,
    map: arr,
    kernel: ker,
    image: im,
    isInjective: ker.length === 1,
    isSurjective: im.length === H.size,
    isIsomorphism: ker.length === 1 && im.length === H.size,
  };
}

// Build induced subgroup as a concrete group object (useful for im(φ) Cayley table!)
export function subgroupAsGroup(G, H, name, latex) {
  const arr = toSortedIndices(H);
  if (!isSubgroup(G, arr)) throw new Error('Alt grup geçersiz');
  const m = arr.length;
  const idxOf = new Map(arr.map((g, i) => [g, i]));
  const table = new Int32Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      table[i * m + j] = idxOf.get(G.mul(arr[i], arr[j]));
    }
  }
  const elements = arr.map(g => G.elements[g]);
  const latexElements = arr.map(g => elemLatex(G, g));
  return createGroup({
    name: name || `H ≤ ${G.name}`,
    latex: latex || `H \\le ${G.latex}`,
    elements,
    table,
    e: idxOf.get(G.e),
    meta: {
      kind: 'Subgroup',
      parent: G.name,
      elementsInParent: arr,
      latexElements,
    },
  });
}

// ---------- Isomorphism invariants & exact backtracking search ----------

export function isomorphismInvariants(G, { withSubgroups = true } = {}) {
  const ordMap = orders(G);
  const orderStats = Array.from(ordMap.entries());
  const classes = conjugacyClasses(G);
  const classSizes = classes.map(cls => cls.length).sort((a, b) => a - b);
  const z = center(G);
  const comm = commutatorSubgroup(G);
  const inv = {
    order: G.size,
    isAbelian: isAbelian(G),
    isCyclic: isCyclic(G),
    exponent: exponent(G),
    orderStats,
    centerSize: z.length,
    commutatorSize: comm.length,
    classSizes,
  };
  if (withSubgroups) {
    const subs = subgroups(G);
    inv.subgroupCount = subs.length;
    inv.normalSubgroupCount = subs.filter(s => s.isNormal).length;
  }
  return inv;
}

function sameNumberArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameOrderStats(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

export function findIsomorphism(G, H) {
  if (G.size !== H.size) return null;
  if (G.size === 1) return [H.e];
  if (isAbelian(G) !== isAbelian(H)) return null;

  const invG = isomorphismInvariants(G, { withSubgroups: false });
  const invH = isomorphismInvariants(H, { withSubgroups: false });
  if (!sameOrderStats(invG.orderStats, invH.orderStats)) return null;
  if (invG.centerSize !== invH.centerSize) return null;
  if (invG.commutatorSize !== invH.commutatorSize) return null;
  if (!sameNumberArray(invG.classSizes, invH.classSizes)) return null;

  // Cyclic fast path: map any generator of G to any generator of H
  if (invG.isCyclic) {
    const g = cyclicGenerators(G)[0];
    const h = cyclicGenerators(H)[0];
    const ext = extendHomomorphism(G, H, [[g, h]]);
    return ext.ok && ext.isIsomorphism ? ext.map : null;
  }

  // Exact backtracking over minimal generating set images
  const gens = minimalGeneratingSet(G);
  const eoG = elementOrders(G);
  const eoH = elementOrders(H);

  // Precompute conjugacy class size per element for stronger pruning
  const clsSizeG = new Int32Array(G.size);
  for (const cls of conjugacyClasses(G)) for (const x of cls) clsSizeG[x] = cls.length;
  const clsSizeH = new Int32Array(H.size);
  for (const cls of conjugacyClasses(H)) for (const x of cls) clsSizeH[x] = cls.length;

  const candLists = gens.map(g => {
    const list = [];
    for (let h = 0; h < H.size; h++) {
      if (eoH[h] === eoG[g] && clsSizeH[h] === clsSizeG[g]) list.push(h);
    }
    return list;
  });
  if (candLists.some(l => l.length === 0)) return null;

  // Partial homomorphism check on subgroup generated by gens[0..depth]
  const partialMap = new Int32Array(G.size);
  const usedImg = new Uint8Array(H.size);
  const chosen = new Array(gens.length);

  function checkPartial(depth) {
    partialMap.fill(-1);
    usedImg.fill(0);
    partialMap[G.e] = H.e;
    usedImg[H.e] = 1;
    const queue = [G.e];
    for (let k = 0; k <= depth; k++) {
      const g = gens[k], h = chosen[k];
      if (partialMap[g] !== -1) {
        if (partialMap[g] !== h) return null;
      } else {
        if (usedImg[h]) return null;
        partialMap[g] = h;
        usedImg[h] = 1;
        queue.push(g);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const x = queue[head];
      const hx = partialMap[x];
      for (let k = 0; k <= depth; k++) {
        const y = G.mul(x, gens[k]);
        const hy = H.mul(hx, chosen[k]);
        if (partialMap[y] === -1) {
          if (usedImg[hy]) return null;
          partialMap[y] = hy;
          usedImg[hy] = 1;
          queue.push(y);
        } else if (partialMap[y] !== hy) {
          return null;
        }
      }
    }
    return queue.length;
  }

  function bt(depth) {
    const cands = candLists[depth];
    for (let i = 0; i < cands.length; i++) {
      chosen[depth] = cands[i];
      const covered = checkPartial(depth);
      if (covered === null) continue;
      if (depth === gens.length - 1) {
        if (covered === G.size) {
          const arr = Array.from(partialMap);
          if (isHomomorphism(G, H, arr)) return arr;
        }
      } else {
        const res = bt(depth + 1);
        if (res) return res;
      }
    }
    return null;
  }

  return bt(0);
}

export function isIsomorphic(G, H) {
  if (G.size !== H.size) return false;
  if (G.size === 1) return true;
  if (isAbelian(G) !== isAbelian(H)) return false;

  const invG = isomorphismInvariants(G, { withSubgroups: false });
  const invH = isomorphismInvariants(H, { withSubgroups: false });
  if (!sameOrderStats(invG.orderStats, invH.orderStats)) return false;

  // Fundamental Theorem of Finite Abelian Groups: order statistics uniquely determine finite abelian groups.
  if (invG.isAbelian) return true;

  if (invG.centerSize !== invH.centerSize) return false;
  if (invG.commutatorSize !== invH.commutatorSize) return false;
  if (!sameNumberArray(invG.classSizes, invH.classSizes)) return false;

  if (G.size <= 24) {
    return findIsomorphism(G, H) !== null;
  }

  // Beyond order 24: compare full invariants including subgroup counts
  const fullG = isomorphismInvariants(G, { withSubgroups: true });
  const fullH = isomorphismInvariants(H, { withSubgroups: true });
  return fullG.subgroupCount === fullH.subgroupCount &&
    fullG.normalSubgroupCount === fullH.normalSubgroupCount;
}

// Compute elementary divisor / invariant factor decomposition of any finite abelian group from its order statistics.
export function abelianDecomposition(G) {
  if (!isAbelian(G)) return null;
  const n = G.size;
  if (n === 1) return [1];
  const eo = elementOrders(G);
  const pFactors = primeFactors(n);
  const perPrime = [];

  for (const [p, totalExp] of pFactors) {
    // Count elements whose order divides p^k for k = 1..totalExp
    const pkCounts = [1]; // k = 0 -> 1 element (identity)
    let pk = 1;
    for (let k = 1; k <= totalExp; k++) {
      pk *= p;
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        if (pk % eo[i] === 0) cnt++;
      }
      pkCounts.push(cnt);
    }
    // log_p(pkCounts[k]) - log_p(pkCounts[k-1]) = number of cyclic summands of order >= p^k
    const logP = x => Math.round(Math.log(x) / Math.log(p));
    const ge = [];
    for (let k = 1; k <= totalExp; k++) {
      ge.push(logP(pkCounts[k]) - logP(pkCounts[k - 1]));
    }
    const exps = [];
    for (let k = 1; k <= totalExp; k++) {
      const exact = ge[k - 1] - (k < totalExp ? ge[k] : 0);
      for (let c = 0; c < exact; c++) exps.push(k);
    }
    exps.sort((a, b) => b - a);
    perPrime.push({ p, exps });
  }

  // Combine prime powers into invariant factors d_1 | d_2 | ... | d_r
  const maxRank = Math.max(...perPrime.map(x => x.exps.length));
  const factors = new Array(maxRank).fill(1);
  for (const { p, exps } of perPrime) {
    for (let i = 0; i < exps.length; i++) {
      factors[maxRank - 1 - i] *= p ** exps[i];
    }
  }
  return factors;
}

let CATALOG_CACHE = null;
function smallGroupCatalog() {
  if (CATALOG_CACHE) return CATALOG_CACHE;
  const list = [
    { label: 'S_3', latex: 'S_3', g: symmetric(3) },
    { label: 'D_4', latex: 'D_4', g: dihedral(4) },
    { label: 'Q_8', latex: 'Q_8', g: quaternion() },
    { label: 'D_5', latex: 'D_5', g: dihedral(5) },
    { label: 'A_4', latex: 'A_4', g: alternating(4) },
    { label: 'D_6', latex: 'D_6', g: dihedral(6) },
    { label: 'D_7', latex: 'D_7', g: dihedral(7) },
    { label: 'D_8', latex: 'D_8', g: dihedral(8) },
    { label: 'D_4 × Z_2', latex: 'D_4 \\times \\mathbb{Z}_2', g: directProduct(dihedral(4), cyclic(2)) },
    { label: 'Q_8 × Z_2', latex: 'Q_8 \\times \\mathbb{Z}_2', g: directProduct(quaternion(), cyclic(2)) },
    { label: 'D_9', latex: 'D_9', g: dihedral(9) },
    { label: 'S_3 × Z_3', latex: 'S_3 \\times \\mathbb{Z}_3', g: directProduct(symmetric(3), cyclic(3)) },
    { label: 'D_10', latex: 'D_{10}', g: dihedral(10) },
    { label: 'D_11', latex: 'D_{11}', g: dihedral(11) },
    { label: 'S_4', latex: 'S_4', g: symmetric(4) },
    { label: 'D_12', latex: 'D_{12}', g: dihedral(12) },
    { label: 'A_4 × Z_2', latex: 'A_4 \\times \\mathbb{Z}_2', g: directProduct(alternating(4), cyclic(2)) },
    { label: 'S_3 × Z_4', latex: 'S_3 \\times \\mathbb{Z}_4', g: directProduct(symmetric(3), cyclic(4)) },
    { label: 'D_4 × Z_3', latex: 'D_4 \\times \\mathbb{Z}_3', g: directProduct(dihedral(4), cyclic(3)) },
    { label: 'Q_8 × Z_3', latex: 'Q_8 \\times \\mathbb{Z}_3', g: directProduct(quaternion(), cyclic(3)) },
  ];
  CATALOG_CACHE = list;
  return list;
}

// Identify a standard isomorphic group name/LaTeX (for overview hints and First Isomorphism Theorem).
export function identifyGroup(G) {
  const n = G.size;
  if (n === 1) return { label: 'Z_1', latex: '\\{e\\}' };
  if (isCyclic(G)) return { label: `Z_${n}`, latex: `\\mathbb{Z}_{${n}}` };
  if (isAbelian(G)) {
    const factors = abelianDecomposition(G);
    if (factors.length === 2 && factors[0] === 2 && factors[1] === 2) {
      return { label: 'V_4', latex: 'V_4 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2' };
    }
    return {
      label: factors.map(d => `Z_${d}`).join(' × '),
      latex: factors.map(d => `\\mathbb{Z}_{${d}}`).join(' \\times '),
    };
  }
  if (n <= 24) {
    for (const entry of smallGroupCatalog()) {
      if (entry.g.size === n && isIsomorphic(G, entry.g)) {
        return { label: entry.label, latex: entry.latex };
      }
    }
  }
  if (n === 60 && isSimple(G)) return { label: 'A_5', latex: 'A_5' };
  if (n === 120 && center(G).length === 1 && commutatorSubgroup(G).length === 60) {
    return { label: 'S_5', latex: 'S_5' };
  }
  return null;
}

// ---------- Lagrange, Cauchy, Sylow, Simplicity checks ----------

export function lagrangeCheck(G, H) {
  const arr = toSortedIndices(H);
  const sub = isSubgroup(G, arr);
  const divides = sub && G.size % arr.length === 0;
  return {
    isSubgroup: sub,
    divides,
    groupOrder: G.size,
    subgroupOrder: arr.length,
    index: divides ? G.size / arr.length : null,
  };
}

export function cauchyCheck(G, p) {
  p = Math.trunc(p);
  const pf = primeFactors(p);
  const isPrime = pf.length === 1 && pf[0][1] === 1;
  if (!isPrime) return { valid: false, reason: `${p} asal değil`, elements: [] };
  if (G.size % p !== 0) return { valid: false, reason: `${p}, |G|=${G.size} değerini bölmez`, elements: [] };
  const eo = elementOrders(G);
  const elements = [];
  for (let i = 0; i < G.size; i++) {
    if (eo[i] === p) elements.push(i);
  }
  return { valid: elements.length > 0, prime: p, elements };
}

export function sylowSubgroups(G, p) {
  p = Math.trunc(p);
  const pf = primeFactors(G.size).find(([q]) => q === p);
  if (!pf) return { prime: p, sylowOrder: 1, subgroups: [], count: 0, modCheck: false, divCheck: false };
  const sylowOrder = p ** pf[1];
  const m = G.size / sylowOrder;
  const subs = subgroups(G).filter(s => s.order === sylowOrder);
  const count = subs.length;
  return {
    prime: p,
    sylowOrder,
    subgroups: subs,
    count,
    modCheck: count % p === 1,
    divCheck: m % count === 0,
  };
}

export function isSimple(G) {
  if (G.size <= 1) return false;
  const subs = subgroups(G);
  return !subs.some(s => s.isNormal && s.order > 1 && s.order < G.size);
}

// ---------- Axiom verifier (for tests and sanity checks) ----------

export function verifyGroupAxioms(G, { fullAssociativityLimit = 24 } = {}) {
  const n = G.size;
  if (n < 1) return { ok: false, error: 'Grup boş olamaz' };
  if (G.e < 0 || G.e >= n) return { ok: false, error: 'Geçersiz birim eleman' };

  // Closure & identity
  for (let a = 0; a < n; a++) {
    if (G.mul(G.e, a) !== a || G.mul(a, G.e) !== a) {
      return { ok: false, error: `Birim eleman aksiyomu bozuk: ${a}` };
    }
    const invA = G.inv(a);
    if (invA < 0 || invA >= n || G.mul(a, invA) !== G.e || G.mul(invA, a) !== G.e) {
      return { ok: false, error: `Ters eleman aksiyomu bozuk: ${a}` };
    }
    for (let b = 0; b < n; b++) {
      const p = G.mul(a, b);
      if (!Number.isInteger(p) || p < 0 || p >= n) {
        return { ok: false, error: `Kapalılık aksiyomu bozuk: (${a},${b}) -> ${p}` };
      }
    }
  }

  // Associativity: exhaustive up to fullAssociativityLimit, Light's test (all pairs with generators) beyond
  if (n <= fullAssociativityLimit) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const ab = G.mul(a, b);
        for (let c = 0; c < n; c++) {
          if (G.mul(ab, c) !== G.mul(a, G.mul(b, c))) {
            return { ok: false, error: `Birleşme aksiyomu bozuk: (${a},${b},${c})` };
          }
        }
      }
    }
  } else {
    // Light's associativity theorem: if (a*g)*c = a*(g*c) for all a,c in G and all g in a generating set,
    // then the operation is associative on all of G!
    const gens = minimalGeneratingSet(G);
    for (const g of gens) {
      for (let a = 0; a < n; a++) {
        const ag = G.mul(a, g);
        for (let c = 0; c < n; c++) {
          if (G.mul(ag, c) !== G.mul(a, G.mul(g, c))) {
            return { ok: false, error: `Birleşme aksiyomu bozuk: (${a},${g},${c})` };
          }
        }
      }
    }
  }
  return { ok: true };
}

// ---------- Cayley graph & subgroup lattice (Hasse diagram) ----------

export function cayleyGraph(G, gens) {
  const genList = [];
  const seenGen = new Set();
  for (const g of gens || []) {
    if (Number.isInteger(g) && g >= 0 && g < G.size && g !== G.e && !seenGen.has(g)) {
      seenGen.add(g);
      genList.push(g);
    }
  }
  const n = G.size;
  const dist = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const parentGen = new Int32Array(n).fill(-1);
  dist[G.e] = 0;
  const queue = [G.e];
  const edges = [];

  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    for (let gi = 0; gi < genList.length; gi++) {
      const g = genList[gi];
      const v = G.mul(u, g);
      edges.push({ from: u, to: v, gen: g, genSlot: gi });
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1;
        parent[v] = u;
        parentGen[v] = gi;
        queue.push(v);
      }
    }
  }

  // Reconstruct shortest generator word from e to each reachable node
  const paths = new Map();
  for (const u of queue) {
    const steps = [];
    let cur = u;
    while (cur !== G.e && parent[cur] !== -1) {
      const gi = parentGen[cur];
      steps.push({ from: parent[cur], to: cur, gen: genList[gi], genSlot: gi });
      cur = parent[cur];
    }
    steps.reverse();
    paths.set(u, steps);
  }

  return {
    generators: genList,
    reachable: queue,
    allReached: queue.length === n,
    edges,
    paths,
  };
}

export function subgroupLattice(G) {
  const c = cacheOf(G);
  if (c.lattice) return c.lattice;
  const subs = subgroups(G);
  const m = subs.length;
  const masks = subs.map(s => maskOf(s.elements));

  // Precompute strict inclusions
  const covers = [];
  for (let i = 0; i < m; i++) {
    const mi = masks[i];
    const oi = subs[i].order;
    const above = [];
    for (let j = i + 1; j < m; j++) {
      if (subs[j].order % oi === 0 && (mi & masks[j]) === mi) {
        above.push(j);
      }
    }
    for (let ai = 0; ai < above.length; ai++) {
      const j = above[ai];
      const mj = masks[j];
      const oj = subs[j].order;
      let direct = true;
      for (let bi = 0; bi < ai; bi++) {
        const k = above[bi];
        if (oj % subs[k].order === 0 && (masks[k] & mj) === masks[k]) {
          direct = false;
          break;
        }
      }
      if (direct) covers.push([i, j]);
    }
  }

  const levelOrders = [...new Set(subs.map(s => s.order))].sort((a, b) => a - b);
  const levels = new Map(levelOrders.map(o => [o, []]));
  for (let i = 0; i < m; i++) levels.get(subs[i].order).push(i);

  const res = { subgroups: subs, edges: covers, levelOrders, levels };
  c.lattice = res;
  return res;
}

// ---------- Quiz generator (100% engine-backed, 11 types, 3 difficulties) ----------

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function uniqueNumberChoices(correct, candidates, rng, count = 4) {
  const set = new Set([correct]);
  for (const c of shuffle(candidates, rng)) {
    if (set.size >= count) break;
    if (Number.isInteger(c) && c >= 0 && !set.has(c)) set.add(c);
  }
  let bump = 1;
  while (set.size < count) {
    if (!set.has(correct + bump)) set.add(correct + bump);
    else if (correct - bump >= 0 && !set.has(correct - bump)) set.add(correct - bump);
    bump++;
  }
  return shuffle(Array.from(set), rng);
}

const QUIZ_POOLS = {
  kolay: [
    () => cyclic(4), () => cyclic(6), () => cyclic(8), () => cyclic(9),
    () => dihedral(3), () => dihedral(4), () => kleinFour(),
    () => symmetric(3), () => unitGroup(8), () => unitGroup(10),
  ],
  orta: [
    () => cyclic(12), () => dihedral(4), () => dihedral(5), () => dihedral(6),
    () => quaternion(), () => symmetric(3), () => alternating(4),
    () => unitGroup(12), () => unitGroup(15),
    () => directProduct(cyclic(2), cyclic(3)), () => directProduct(cyclic(2), cyclic(4)),
  ],
  zor: [
    () => symmetric(4), () => alternating(4), () => dihedral(6), () => dihedral(8),
    () => quaternion(), () => unitGroup(15), () => unitGroup(20), () => unitGroup(24),
    () => directProduct(cyclic(2), cyclic(6)), () => cubeRotations(),
  ],
};

function makeOrderQuestion(diff, rng) {
  const G = pick(QUIZ_POOLS[diff], rng)();
  const nonId = Array.from({ length: G.size - 1 }, (_, i) => i + 1);
  const a = pick(nonId, rng);
  const ans = order(G, a);
  const divs = divisors(G.size).filter(d => d !== ans);
  const extra = [ans + 1, ans + 2, Math.max(1, ans - 1), G.size];
  const opts = uniqueNumberChoices(ans, divs.concat(extra), rng, 4);
  return {
    type: 'order',
    difficulty: diff,
    topic: 'Eleman mertebesi',
    prompt: `$${G.latex}$ grubunda $${elemLatex(G, a)}$ elemanının mertebesi kaçtır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `$${elemLatex(G, a)}^{${ans}} = ${elemLatex(G, G.e)}$ en küçük pozitif kuvvettir; dolayısıyla $|${elemLatex(G, a)}| = ${ans}$ ve Lagrange teoremi gereği $${ans} \\mid ${G.size}$.`,
  };
}

function makeSubgroupQuestion(diff, rng) {
  const pool = diff === 'kolay'
    ? [() => cyclic(6), () => cyclic(8), () => dihedral(3), () => kleinFour()]
    : diff === 'orta'
      ? [() => dihedral(4), () => quaternion(), () => symmetric(3), () => cyclic(12)]
      : [() => alternating(4), () => dihedral(6), () => symmetric(4), () => unitGroup(15)];
  const G = pick(pool, rng)();
  const subs = subgroups(G).filter(s => s.order > 1 && s.order < G.size);
  const wantYes = rng() < 0.5 && subs.length > 0;
  let H;
  if (wantYes) {
    H = pick(subs, rng).elements;
  } else {
    // Construct a definite non-subgroup
    const mode = Math.floor(rng() * 3);
    if (mode === 0 && subs.length) {
      // Drop identity from a real subgroup
      const s = pick(subs, rng).elements;
      H = s.filter(x => x !== G.e);
    } else {
      // Pick e + 1 or 2 random elements until not closed
      for (let tries = 0; tries < 25; tries++) {
        const k = Math.min(G.size - 1, 2 + Math.floor(rng() * 2));
        const picked = [G.e];
        const rest = shuffle(Array.from({ length: G.size - 1 }, (_, i) => i + 1), rng);
        for (let i = 0; i < k - 1; i++) picked.push(rest[i]);
        picked.sort((a, b) => a - b);
        if (!isSubgroup(G, picked)) { H = picked; break; }
      }
      if (!H) H = [1]; // missing identity -> definitely not a subgroup
    }
  }
  const ok = isSubgroup(G, H);
  const setTex = `\\{${H.map(i => elemLatex(G, i)).join(',\\,')}\\}`;
  let why;
  if (ok) {
    why = `$H$ boş olmayan, birim elemanı ($${elemLatex(G, G.e)}$) içeren, işlem ve ters altında kapalı bir alt kümedir; $|H| = ${H.length} \\mid ${G.size}$.`;
  } else if (!H.includes(G.e)) {
    why = `Birim eleman $${elemLatex(G, G.e)}$ kümede bulunmadığı için alt grup olamaz.`;
  } else {
    let pair = null;
    for (const a of H) {
      for (const b of H) {
        const p = G.mul(a, b);
        if (!H.includes(p)) { pair = [a, b, p]; break; }
      }
      if (pair) break;
    }
    why = pair
      ? `Kapalılık bozulur: $${elemLatex(G, pair[0])} \\cdot ${elemLatex(G, pair[1])} = ${elemLatex(G, pair[2])} \\notin H$.`
      : `Alt grup aksiyomlarından biri sağlanmaz.`;
  }
  return {
    type: 'isSubgroup',
    difficulty: diff,
    topic: 'Alt grup testi',
    prompt: `$${G.latex}$ grubunda $H = ${setTex}$ alt kümesi bir alt grup mudur?`,
    options: ['Evet, alt gruptur', 'Hayır, alt grup değildir'],
    answerIndex: ok ? 0 : 1,
    explanation: why,
  };
}

function makeNormalQuestion(diff, rng) {
  const pool = diff === 'kolay'
    ? [() => symmetric(3), () => dihedral(4), () => cyclic(6)]
    : diff === 'orta'
      ? [() => dihedral(4), () => quaternion(), () => symmetric(3), () => alternating(4)]
      : [() => symmetric(4), () => alternating(4), () => dihedral(6), () => quaternion()];
  const G = pick(pool, rng)();
  const proper = subgroups(G).filter(s => s.order > 1 && s.order < G.size);
  const normals = proper.filter(s => s.isNormal);
  const nonNormals = proper.filter(s => !s.isNormal);
  const sub = (nonNormals.length && rng() < 0.5) ? pick(nonNormals, rng) : (normals.length ? pick(normals, rng) : pick(proper, rng));
  const H = sub.elements;
  const norm = sub.isNormal;
  const label = H.length <= 6
    ? `\\{${H.map(i => elemLatex(G, i)).join(',\\,')}\\}`
    : `\\langle ${sub.generators.map(i => elemLatex(G, i)).join(',\\,')} \\rangle`;

  let why;
  if (norm) {
    if (isAbelian(G)) why = `$${G.latex}$ değişmeli (Abelyen) olduğundan her alt grubu normaldir.`;
    else if (G.size / H.length === 2) why = `$[G:H] = 2$ indeksli her alt grup otomatik olarak normaldir.`;
    else why = `Her $g \\in ${G.latex}$ için $gHg^{-1} = H$ sağlandığından sol ve sağ kosetler çakışır; $H \\trianglelefteq ${G.latex}$.`;
  } else {
    let witness = null;
    for (let g = 0; g < G.size && !witness; g++) {
      const gi = G.inv(g);
      for (const h of H) {
        const conj = G.mul(G.mul(g, h), gi);
        if (!H.includes(conj)) { witness = [g, h, conj]; break; }
      }
    }
    why = witness
      ? `Eşlenik altında kapalı değil: $g = ${elemLatex(G, witness[0])},\\; h = ${elemLatex(G, witness[1])}$ için $ghg^{-1} = ${elemLatex(G, witness[2])} \\notin H$.`
      : `Sol ve sağ kosetler eşit olmadığı için normal değildir.`;
  }
  return {
    type: 'isNormal',
    difficulty: diff,
    topic: 'Normal alt grup',
    prompt: `$${G.latex}$ grubunda $H = ${label}$ ($|H|=${H.length}$) normal bir alt grup mudur?`,
    options: ['Evet, normaldir ($H \\trianglelefteq G$)', 'Hayır, normal değildir'],
    answerIndex: norm ? 0 : 1,
    explanation: why,
  };
}

function makeSubgroupCountQuestion(diff, rng) {
  const specs = diff === 'kolay'
    ? [[cyclic(12), 4], [cyclic(8), 2], [kleinFour(), 2], [symmetric(3), 2], [symmetric(3), 3], [dihedral(4), 4]]
    : diff === 'orta'
      ? [[dihedral(4), 2], [quaternion(), 4], [quaternion(), 2], [alternating(4), 3], [alternating(4), 6], [dihedral(5), 2]]
      : [[symmetric(4), 4], [symmetric(4), 8], [alternating(4), 6], [alternating(4), 4], [symmetric(4), 3], [dihedral(6), 2]];
  const [G, k] = pick(specs, rng);
  const subs = subgroups(G).filter(s => s.order === k);
  const ans = subs.length;
  const cands = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ans + 1, ans + 2, Math.max(0, ans - 1)];
  const opts = uniqueNumberChoices(ans, cands, rng, 4);
  const extra = ans === 0
    ? `Lagrange'ın tersi her zaman doğru değildir: $${k} \\mid ${G.size}$ olmasına rağmen $${G.latex}$ grubunun $${k}$ mertebeli alt grubu yoktur!`
    : `Motor tüm alt grupları saydığında $|H|=${k}$ olan tam $${ans}$ alt grup bulunur.`;
  return {
    type: 'subgroupCount',
    difficulty: diff,
    topic: 'Belirli mertebede alt grup sayısı',
    prompt: `$${G.latex}$ grubunun mertebesi $${k}$ olan kaç tane alt grubu vardır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: extra,
  };
}

function makeClassEquationQuestion(diff, rng) {
  const pool = diff === 'kolay'
    ? [() => symmetric(3), () => dihedral(4), () => kleinFour()]
    : diff === 'orta'
      ? [() => dihedral(4), () => dihedral(5), () => quaternion(), () => alternating(4)]
      : [() => symmetric(4), () => dihedral(6), () => alternating(4), () => alternating(5)];
  const G = pick(pool, rng)();
  const classes = conjugacyClasses(G);
  const sizes = classes.map(c => c.length).sort((a, b) => a - b);
  const formatEq = arr => `${G.size} = ${arr.join(' + ')}`;
  const correct = formatEq(sizes);

  // Build plausible wrong class equations summing to |G|
  const wrongs = new Set();
  const tryPush = arr => {
    const s = arr.slice().sort((a, b) => a - b);
    if (s.reduce((a, b) => a + b, 0) === G.size && s.every(x => x >= 1)) {
      const str = formatEq(s);
      if (str !== correct) wrongs.add(str);
    }
  };
  // All 1s (abelian guess)
  if (G.size <= 12) tryPush(Array(G.size).fill(1));
  // Split or merge terms
  if (sizes.length >= 2) {
    const a = sizes.slice();
    const last = a.pop();
    if (last > 2) tryPush(a.concat([1, last - 1]));
    if (last > 3) tryPush(a.concat([2, last - 2]));
  }
  if (sizes.length >= 3) {
    const b = sizes.slice();
    const x = b.pop(), y = b.pop();
    tryPush(b.concat([x + y]));
  }
  // Divisors-based plausible partitions
  const divs = divisors(G.size).filter(d => d < G.size);
  for (let tries = 0; tries < 40 && wrongs.size < 3; tries++) {
    let rem = G.size - 1;
    const part = [1];
    while (rem > 0) {
      const avail = divs.filter(d => d <= rem);
      const d = pick(avail, rng);
      part.push(d);
      rem -= d;
    }
    tryPush(part);
  }
  const opts = shuffle([correct, ...Array.from(wrongs).slice(0, 3)], rng);
  return {
    type: 'classEquation',
    difficulty: diff,
    topic: 'Sınıf denklemi',
    prompt: `$${G.latex}$ grubunun sınıf denklemi ($|G| = |Z(G)| + \\sum [G:C_G(a)]$) aşağıdakilerden hangisidir?`,
    options: opts.map(eq => `$${eq}$`),
    answerIndex: opts.indexOf(correct),
    explanation: `$${G.latex}$ grubunun $${classes.length}$ eşlenik sınıfı vardır ve boyutları küçükten büyüğe $${sizes.join(', ')}$ olup $|Z(G)|=${center(G).length}$ merkez elemanına karşılık $${center(G).length}$ adet $1$ bulunur.`,
  };
}

function makePermSignQuestion(diff, rng) {
  const n = diff === 'kolay' ? 4 : 5;
  const S = symmetric(n);
  const perms = S.meta.perms.filter(p => permOrder(p) > 1);
  const p = pick(perms, rng);
  const sgn = permSign(p);
  const trans = toTranspositions(p);
  const tex = formatCyclesLatex(p);
  const transTex = trans.map(([a, b]) => `(${a}\\,${b})`).join('');
  return {
    type: 'permSign',
    difficulty: diff,
    topic: 'Permütasyon işareti (parite)',
    prompt: `$S_{${n}}$ içindeki $\\sigma = ${tex}$ permütasyonunun işareti $\\operatorname{sgn}(\\sigma)$ nedir?`,
    options: ['$+1$ (çift permütasyon)', '$-1$ (tek permütasyon)'],
    answerIndex: sgn === 1 ? 0 : 1,
    explanation: `$${tex} = ${transTex}$ biçiminde $${trans.length}$ transpozisyonun çarpımıdır; $${trans.length}$ ${trans.length % 2 === 0 ? 'çift' : 'tek'} olduğu için $\\operatorname{sgn}(\\sigma) = ${sgn === 1 ? '+1' : '-1'}$.`,
  };
}

function makePermComposeQuestion(diff, rng) {
  const n = diff === 'kolay' ? 3 : 4;
  const S = symmetric(n);
  const nonId = Array.from({ length: S.size - 1 }, (_, i) => i + 1);
  const i = pick(nonId, rng);
  let j = pick(nonId, rng);
  if (i === j && nonId.length > 1) j = nonId[(nonId.indexOf(i) + 1) % nonId.length];
  const prod = S.mul(i, j);
  const distractors = shuffle(
    Array.from({ length: S.size }, (_, idx) => idx).filter(idx => idx !== prod),
    rng
  ).slice(0, 3);
  // Make sure the reverse order j*i is included as a distractor when distinct!
  const rev = S.mul(j, i);
  if (rev !== prod && !distractors.includes(rev)) distractors[0] = rev;
  const opts = shuffle([prod, ...distractors], rng);
  return {
    type: 'permCompose',
    difficulty: diff,
    topic: 'Permütasyon bileşkesi (sağdan sola)',
    prompt: `Sağdan sola bileşke kuralıyla ($(\\sigma \\circ \\tau)(x) = \\sigma(\\tau(x))$) $S_{${n}}$ içinde $${elemLatex(S, i)} \\circ ${elemLatex(S, j)}$ sonucu nedir?`,
    options: opts.map(idx => `$${elemLatex(S, idx)}$`),
    answerIndex: opts.indexOf(prod),
    explanation: `Önce sağdaki $${elemLatex(S, j)}$, ardından soldaki $${elemLatex(S, i)}$ uygulanır ve sonuç $${elemLatex(S, prod)}$ bulunur.`,
  };
}

function makeCyclicQuestion(diff, rng) {
  const pool = diff === 'kolay'
    ? [() => cyclic(6), () => kleinFour(), () => symmetric(3), () => unitGroup(10), () => unitGroup(8)]
    : diff === 'orta'
      ? [() => directProduct(cyclic(2), cyclic(3)), () => directProduct(cyclic(2), cyclic(2)), () => unitGroup(9), () => unitGroup(12), () => quaternion(), () => dihedral(4)]
      : [() => unitGroup(14), () => unitGroup(15), () => unitGroup(18), () => directProduct(cyclic(3), cyclic(4)), () => directProduct(cyclic(2), cyclic(6)), () => alternating(4)];
  const G = pick(pool, rng)();
  const cyc = isCyclic(G);
  const gens = cyclicGenerators(G);
  const why = cyc
    ? `Evet: örneğin $${elemLatex(G, gens[0])}$ elemanının mertebesi $${G.size} = |G|$ olduğundan $G = \\langle ${elemLatex(G, gens[0])} \\rangle$ devirlidir.`
    : `Hayır: hiçbir elemanın mertebesi $|G| = ${G.size}$ değildir (maksimum eleman mertebesi $${Math.max(...orders(G).keys())}$).`;
  return {
    type: 'isCyclic',
    difficulty: diff,
    topic: 'Devirli grup testi',
    prompt: `$${G.latex}$ grubu devirli (cyclic) midir?`,
    options: ['Evet, devirlidir', 'Hayır, devirli değildir'],
    answerIndex: cyc ? 0 : 1,
    explanation: why,
  };
}

function makeCenterQuestion(diff, rng) {
  const pool = diff === 'kolay'
    ? [() => dihedral(3), () => dihedral(4), () => cyclic(6), () => symmetric(3)]
    : diff === 'orta'
      ? [() => dihedral(4), () => dihedral(5), () => dihedral(6), () => quaternion(), () => alternating(4)]
      : [() => symmetric(4), () => dihedral(8), () => dihedral(7), () => quaternion(), () => cubeRotations()];
  const G = pick(pool, rng)();
  const z = center(G);
  const ans = z.length;
  const opts = uniqueNumberChoices(ans, divisors(G.size).concat([1, 2, 3, 4]), rng, 4);
  const elemsTex = z.length <= 6
    ? `\\{${z.map(i => elemLatex(G, i)).join(',\\,')}\\}`
    : `${G.latex}`;
  return {
    type: 'center',
    difficulty: diff,
    topic: 'Grubun merkezi',
    prompt: `$${G.latex}$ grubunun merkezi $Z(${G.latex})$ kaç elemanlıdır?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(ans),
    explanation: `$Z(${G.latex}) = ${elemsTex}$ olduğundan $|Z(${G.latex})| = ${ans}$.`,
  };
}

function makeHomomorphismQuestion(diff, rng) {
  const pairs = diff === 'kolay'
    ? [[cyclic(6), cyclic(3)], [cyclic(4), cyclic(2)], [cyclic(6), cyclic(4)], [cyclic(5), cyclic(3)]]
    : diff === 'orta'
      ? [[cyclic(8), cyclic(4)], [cyclic(12), cyclic(8)], [cyclic(6), cyclic(9)], [dihedral(3), cyclic(2)], [dihedral(4), cyclic(2)]]
      : [[dihedral(4), cyclic(4)], [symmetric(3), cyclic(3)], [symmetric(4), cyclic(2)], [cyclic(12), cyclic(9)], [quaternion(), cyclic(2)]];
  const [G, H] = pick(pairs, rng);
  const gens = minimalGeneratingSet(G);
  const wantValid = rng() < 0.55;

  let chosen = null;
  // Enumerate small valid/invalid assignments on generators
  const validList = [], invalidList = [];
  if (gens.length === 1) {
    const g = gens[0];
    for (let h = 0; h < H.size; h++) {
      const ext = extendHomomorphism(G, H, [[g, h]]);
      if (ext.ok) validList.push([[g, h], ext]);
      else invalidList.push([[g, h], ext]);
    }
  } else {
    const [g1, g2] = gens;
    for (let h1 = 0; h1 < H.size; h1++) {
      for (let h2 = 0; h2 < H.size; h2++) {
        const ext = extendHomomorphism(G, H, [[g1, h1], [g2, h2]]);
        if (ext.ok) validList.push([[g1, h1], [g2, h2], ext]);
        else invalidList.push([[g1, h1], [g2, h2], ext]);
      }
    }
  }
  const nonTrivialValid = validList.filter(v => v.slice(0, -1).some(([, h]) => h !== H.e));
  if (wantValid && (nonTrivialValid.length || validList.length)) {
    chosen = pick(nonTrivialValid.length ? nonTrivialValid : validList, rng);
  } else if (invalidList.length) {
    chosen = pick(invalidList, rng);
  } else {
    chosen = pick(validList, rng);
  }
  const assign = chosen.slice(0, -1);
  const ext = chosen[chosen.length - 1];
  const assignTex = assign.map(([g, h]) => `\\varphi(${elemLatex(G, g)}) = ${elemLatex(H, h)}`).join(',\\; ');
  const why = ext.ok
    ? `Evet: tüm grup bağıntıları korunur; $|\\ker(\\varphi)| = ${ext.kernel.length}$, $|\\operatorname{im}(\\varphi)| = ${ext.image.length}$ ve $G/\\ker(\\varphi) \\cong \\operatorname{im}(\\varphi)$.`
    : `Hayır: ${ext.reason}. (Not: her üreteç için $|\\varphi(g)| \\mid |g|$ ve grup bağıntıları korunmalıdır.)`;
  return {
    type: 'homomorphism',
    difficulty: diff,
    topic: 'Homomorfizma kontrolü',
    prompt: `$${G.latex} \\to ${H.latex}$ dönüşümü üreteçlerde $${assignTex}$ şeklinde tanımlanırsa bu atama bir grup homomorfizmasına genişler mi?`,
    options: ['Evet, homomorfizma tanımlar', 'Hayır, çelişki oluşur'],
    answerIndex: ext.ok ? 0 : 1,
    explanation: why,
  };
}

function makeLagrangeQuestion(diff, rng) {
  const candidates = diff === 'kolay'
    ? [12, 15, 16, 18, 20]
    : diff === 'orta'
      ? [24, 28, 30, 35, 36, 42]
      : [48, 54, 56, 60, 72, 120];
  const n = pick(candidates, rng);
  const divs = divisors(n).filter(d => d > 1 && d < n);
  const nonDivs = [];
  for (let k = 2; k < n; k++) {
    if (n % k !== 0 && k <= Math.min(n - 1, 24)) nonDivs.push(k);
  }
  const impossible = pick(nonDivs, rng);
  const validDivs = shuffle(divs, rng).slice(0, 3);
  const opts = shuffle([impossible, ...validDivs], rng);
  return {
    type: 'lagrange',
    difficulty: diff,
    topic: 'Lagrange teoremi',
    prompt: `Mertebesi $|G| = ${n}$ olan bir sonlu grubun Lagrange teoremine göre **kesinlikle sahip olamayacağı** alt grup mertebesi hangisidir?`,
    options: opts.map(v => `$${v}$`),
    answerIndex: opts.indexOf(impossible),
    explanation: `Lagrange teoremine göre her alt grubun mertebesi $|G|=${n}$ sayısını tam bölmelidir. $${impossible} \\nmid ${n}$ olduğundan mertebesi $${impossible}$ olan bir alt grup olamaz.`,
  };
}

const QUESTION_MAKERS = [
  ['order', makeOrderQuestion],
  ['subgroup', makeSubgroupQuestion],
  ['normal', makeNormalQuestion],
  ['subgroupCount', makeSubgroupCountQuestion],
  ['classEquation', makeClassEquationQuestion],
  ['permSign', makePermSignQuestion],
  ['permCompose', makePermComposeQuestion],
  ['cyclic', makeCyclicQuestion],
  ['center', makeCenterQuestion],
  ['homomorphism', makeHomomorphismQuestion],
  ['lagrange', makeLagrangeQuestion],
];

const QUESTION_BY_TYPE = new Map(QUESTION_MAKERS);

export function generateQuizQuestion(difficulty = 'orta', rng = Math.random, forceType = null) {
  const diff = QUIZ_POOLS[difficulty] ? difficulty : 'orta';
  if (forceType != null && forceType !== '') {
    if (typeof forceType === 'number') {
      const idx = ((forceType % QUESTION_MAKERS.length) + QUESTION_MAKERS.length) % QUESTION_MAKERS.length;
      return QUESTION_MAKERS[idx][1](diff, rng);
    }
    const exact = QUESTION_BY_TYPE.get(String(forceType));
    if (exact) return exact(diff, rng);
    const low = String(forceType).toLowerCase();
    const match = QUESTION_MAKERS.find(([k]) => k.toLowerCase() === low);
    return (match ? match[1] : QUESTION_MAKERS[0][1])(diff, rng);
  }
  return pick(QUESTION_MAKERS, rng)[1](diff, rng);
}

// =====================================================================
// EXTENDED CONSTRUCTORS (Ramond Ch. 2, 3, 9, 11.7 & Appendix 1)
// =====================================================================

function modPos(x, m) {
  return ((x % m) + m) % m;
}

function modInv(a, p) {
  a = modPos(a, p);
  if (a === 0) throw new Error('Sıfırın modüler tersi yok');
  for (let x = 1; x < p; x++) {
    if ((a * x) % p === 1) return x;
  }
  throw new Error(`${a} mod ${p} tersinir değil`);
}

function isSmallPrime(p) {
  return p === 2 || p === 3 || p === 5 || p === 7;
}

// Compute all automorphisms of a small finite group N (each returned as an array map of length |N|).
export function automorphisms(N, { maxCount = 240 } = {}) {
  const c = cacheOf(N);
  if (c.automorphisms && c.automorphismsMax >= maxCount) {
    return c.automorphisms.map(a => a.slice());
  }
  const n = N.size;
  if (n === 1) return [[0]];
  const gens = minimalGeneratingSet(N);
  const eo = elementOrders(N);
  const clsSize = new Int32Array(n);
  for (const cls of conjugacyClasses(N)) for (const x of cls) clsSize[x] = cls.length;

  const candLists = gens.map(g => {
    const out = [];
    for (let y = 0; y < n; y++) {
      if (eo[y] === eo[g] && clsSize[y] === clsSize[g]) out.push(y);
    }
    return out;
  });

  const results = [];
  const chosen = new Array(gens.length);
  const partialMap = new Int32Array(n);
  const used = new Uint8Array(n);

  function checkPartial(depth) {
    partialMap.fill(-1);
    used.fill(0);
    partialMap[N.e] = N.e;
    used[N.e] = 1;
    const queue = [N.e];
    for (let k = 0; k <= depth; k++) {
      const g = gens[k], h = chosen[k];
      if (partialMap[g] !== -1) {
        if (partialMap[g] !== h) return null;
      } else {
        if (used[h]) return null;
        partialMap[g] = h;
        used[h] = 1;
        queue.push(g);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const x = queue[head];
      const hx = partialMap[x];
      for (let k = 0; k <= depth; k++) {
        const y = N.mul(x, gens[k]);
        const hy = N.mul(hx, chosen[k]);
        if (partialMap[y] === -1) {
          if (used[hy]) return null;
          partialMap[y] = hy;
          used[hy] = 1;
          queue.push(y);
        } else if (partialMap[y] !== hy) {
          return null;
        }
      }
    }
    return queue.length;
  }

  function bt(depth) {
    if (results.length >= maxCount) return;
    const cands = candLists[depth];
    for (let i = 0; i < cands.length; i++) {
      if (results.length >= maxCount) return;
      chosen[depth] = cands[i];
      const covered = checkPartial(depth);
      if (covered === null) continue;
      if (depth === gens.length - 1) {
        if (covered === n) {
          const arr = Array.from(partialMap);
          if (isHomomorphism(N, N, arr)) results.push(arr);
        }
      } else {
        bt(depth + 1);
      }
    }
  }

  bt(0);
  c.automorphisms = results;
  c.automorphismsMax = maxCount;
  return results.map(a => a.slice());
}

// Enumerate valid action homomorphisms H -> Aut(N) for small groups (used in Semi-Direct Product Lab).
export function semiDirectActions(N, H, { maxActions = 48 } = {}) {
  const auts = automorphisms(N, { maxCount: 240 });
  const m = auts.length;
  const keyOf = a => a.join(',');
  const idxMap = new Map(auts.map((a, i) => [keyOf(a), i]));
  const autTable = new Int32Array(m * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const comp = new Array(N.size);
      for (let x = 0; x < N.size; x++) comp[x] = auts[i][auts[j][x]];
      autTable[i * m + j] = idxMap.get(keyOf(comp));
    }
  }
  const idIdx = idxMap.get(Array.from({ length: N.size }, (_, i) => i).join(','));
  const AutN = createGroup({
    name: `Aut(${N.name})`,
    latex: `\\operatorname{Aut}(${N.latex})`,
    elements: auts.map((_, i) => `φ_${i}`),
    table: autTable,
    e: idIdx,
  });

  const hGens = minimalGeneratingSet(H);
  const eoH = elementOrders(H);
  const eoA = elementOrders(AutN);
  const candLists = hGens.map(g => {
    const o = eoH[g];
    const out = [];
    for (let a = 0; a < AutN.size; a++) {
      if (o % eoA[a] === 0) out.push(a);
    }
    return out;
  });

  const actions = [];
  const chosen = new Array(hGens.length);

  function bt(depth) {
    if (actions.length >= maxActions) return;
    const cands = candLists[depth];
    for (let i = 0; i < cands.length; i++) {
      if (actions.length >= maxActions) return;
      chosen[depth] = cands[i];
      if (depth === hGens.length - 1) {
        const ext = extendHomomorphism(H, AutN, hGens.map((g, k) => [g, chosen[k]]));
        if (ext.ok) {
          const table = ext.map.map(ai => auts[ai]);
          const isTrivial = ext.map.every(ai => ai === idIdx);
          actions.push({
            autMap: ext.map,
            table,
            isTrivial,
            imageSize: ext.image.length,
          });
        }
      } else {
        bt(depth + 1);
      }
    }
  }
  bt(0);
  return { AutN, auts, actions };
}

// Generic semi-direct product N ⋊_φ H with a given action homomorphism φ: H -> Aut(N).
// action can be a function (hIdx, nIdx) => nIdx' or a 2D array action[hIdx][nIdx].
export function semiDirect(N, H, action, opts = {}) {
  const n1 = N.size, n2 = H.size;
  const size = n1 * n2;
  if (size > 240) {
    throw new Error(`Yarı-direkt çarpım mertebesi çok büyük (${size} > 240)`);
  }
  const actionTable = new Array(n2);
  for (let h = 0; h < n2; h++) {
    const row = new Int32Array(n1);
    const seen = new Uint8Array(n1);
    for (let x = 0; x < n1; x++) {
      const y = typeof action === 'function' ? action(h, x) : action[h][x];
      if (!Number.isInteger(y) || y < 0 || y >= n1 || seen[y]) {
        throw new Error(`Geçersiz otomorfizma eylemi: φ(${H.elements[h]}) bijektif değil`);
      }
      seen[y] = 1;
      row[x] = y;
    }
    actionTable[h] = row;
  }
  // Verify homomorphism property for each φ_h ∈ Aut(N) and φ_{h1 h2} = φ_{h1} ∘ φ_{h2}
  for (let h = 0; h < n2; h++) {
    const phi = actionTable[h];
    for (let x = 0; x < n1; x++) {
      for (let y = 0; y < n1; y++) {
        if (phi[N.mul(x, y)] !== N.mul(phi[x], phi[y])) {
          throw new Error(`φ(${H.elements[h]}) bir ${N.name} otomorfizması değil`);
        }
      }
    }
  }
  for (let h1 = 0; h1 < n2; h1++) {
    for (let h2 = 0; h2 < n2; h2++) {
      const h12 = H.mul(h1, h2);
      for (let x = 0; x < n1; x++) {
        if (actionTable[h12][x] !== actionTable[h1][actionTable[h2][x]]) {
          throw new Error(`Eylem homomorfizma koşulunu sağlamıyor: φ(${H.elements[h1]}·${H.elements[h2]}) ≠ φ(${H.elements[h1]})∘φ(${H.elements[h2]})`);
        }
      }
    }
  }

  const elements = new Array(size);
  const latexElements = new Array(size);
  for (let i = 0; i < n1; i++) {
    for (let j = 0; j < n2; j++) {
      const idx = i * n2 + j;
      elements[idx] = `(${N.elements[i]},${H.elements[j]})`;
      latexElements[idx] = `(${elemLatex(N, i)},\\,${elemLatex(H, j)})`;
    }
  }
  const table = new Int32Array(size * size);
  for (let i1 = 0; i1 < n1; i1++) {
    for (let j1 = 0; j1 < n2; j1++) {
      const a = i1 * n2 + j1;
      const phi = actionTable[j1];
      for (let i2 = 0; i2 < n1; i2++) {
        const ni = N.mul(i1, phi[i2]) * n2;
        for (let j2 = 0; j2 < n2; j2++) {
          table[a * size + (i2 * n2 + j2)] = ni + H.mul(j1, j2);
        }
      }
    }
  }
  const e = N.e * n2 + H.e;
  const name = opts.name || `${N.name} ⋊ ${H.name}`;
  const latex = opts.latex || `${N.latex} \\rtimes ${H.latex}`;
  return createGroup({
    name,
    latex,
    elements,
    table,
    e,
    meta: {
      kind: opts.kind || 'SemiDirect',
      spec: opts.spec || null,
      turkishName: opts.turkishName || `Yarı-Direkt Çarpım ${name}`,
      latexElements,
      normalFactor: N,
      actingFactor: H,
      actionTable: actionTable.map(r => Array.from(r)),
      actionDesc: opts.actionDesc || '',
      ...(opts.extraMeta || {}),
    },
  });
}

// Dicyclic / Binary Dihedral group Q_{2n} of order 4n.
// Ramond's convention (Section 3.9): Q_{2n} has order 4n (so n=2 gives Q_4 ≅ Q_8, the quaternion group of order 8).
// Presentation: <a, b | a^{2n} = 1, b^2 = a^n, b a b^{-1} = a^{-1}>.
export function dicyclic(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 2 || n > 50) {
    throw new Error('Q_{2n} için n 2 ile 50 arasında bir tam sayı olmalı (mertebe 4n ≤ 200)');
  }
  const m = 2 * n;
  const size = 4 * n;
  const elements = new Array(size);
  const latexElements = new Array(size);
  for (let k = 0; k < m; k++) {
    elements[k] = k === 0 ? '1' : k === n ? '-1' : (k === 1 ? 'a' : `a${toSup(k)}`);
    latexElements[k] = k === 0 ? '1' : k === n ? '-1' : (k === 1 ? 'a' : `a^{${k}}`);
    elements[m + k] = k === 0 ? 'b' : (k === 1 ? 'ab' : `a${toSup(k)}b`);
    latexElements[m + k] = k === 0 ? 'b' : (k === 1 ? 'ab' : `a^{${k}}b`);
  }
  const table = new Int32Array(size * size);
  for (let i = 0; i < size; i++) {
    const bi = i >= m ? 1 : 0;
    const j = bi ? i - m : i;
    for (let u = 0; u < size; u++) {
      const bu = u >= m ? 1 : 0;
      const k = bu ? u - m : u;
      let res;
      if (bi === 0 && bu === 0) res = (j + k) % m;
      else if (bi === 0 && bu === 1) res = m + ((j + k) % m);
      else if (bi === 1 && bu === 0) res = m + modPos(j - k, m);
      else res = modPos(j - k + n, m);
      table[i * size + u] = res;
    }
  }
  const sub = 2 * n;
  return createGroup({
    name: `Q_${sub}`,
    latex: `Q_{${sub}}`,
    elements,
    table,
    e: 0,
    meta: {
      kind: 'Q2n',
      n,
      spec: { kind: 'Q2n', n },
      turkishName: `İkili Dihedral (Disiklik) Grup Q_${sub} (|G| = ${size}${n === 2 ? ', Q_4 ≅ Q_8' : ''})`,
      ramondConvention: `Ramond notasyonu: Q_{2n} mertebesi 4n olan ikili dihedral gruptur (n=2 için Q_4 ≅ Q_8).`,
      latexElements,
      centerNegOne: n,
      doubleCoverOf: `D_${n}`,
      defaultGenerators: [1, m],
    },
  });
}
export const binaryDihedral = dicyclic;

// Exact quaternion helper for binary polyhedral groups 2T (24), 2O (48), 2I (120).
function fmtQuatLabel(coords, mode) {
  const basis = ['', 'i', 'j', 'k'];
  if (mode === '2T') {
    const [a, b, c, d] = coords;
    const nz = coords.filter(v => v !== 0).length;
    if (nz === 1) {
      const idx = coords.findIndex(v => v !== 0);
      const s = coords[idx] > 0 ? '' : '-';
      return { text: idx === 0 ? (coords[0] > 0 ? '1' : '-1') : `${s}${basis[idx]}`, latex: idx === 0 ? (coords[0] > 0 ? '1' : '-1') : `${s}${basis[idx]}` };
    }
    const terms = coords.map((v, idx) => {
      const sign = v > 0 ? (idx === 0 ? '' : '+') : '-';
      return `${sign}${idx === 0 ? '1' : basis[idx]}`;
    }).join('');
    return { text: `(${terms})/2`, latex: `\\tfrac{1}{2}(${terms})` };
  }
  if (mode === '2O') {
    const isSqrt2 = coords.some(([, v]) => v !== 0);
    if (!isSqrt2) return fmtQuatLabel(coords.map(([u]) => u), '2T');
    const parts = [];
    for (let idx = 0; idx < 4; idx++) {
      const v = coords[idx][1];
      if (!v) continue;
      const sign = v > 0 ? (parts.length ? '+' : '') : '-';
      parts.push(`${sign}${idx === 0 ? '1' : basis[idx]}`);
    }
    return { text: `(${parts.join('')})/√2`, latex: `\\tfrac{1}{\\sqrt{2}}(${parts.join('')})` };
  }
  // 2I: coords are [u, v] representing (u + v φ)/2
  const hasPhi = coords.some(([, v]) => v !== 0);
  if (!hasPhi) return fmtQuatLabel(coords.map(([u]) => u), '2T');
  const partsT = [], partsL = [];
  for (let idx = 0; idx < 4; idx++) {
    const [u, v] = coords[idx];
    if (u === 0 && v === 0) continue;
    let coeffT, coeffL, neg = false;
    if (v === 0) {
      neg = u < 0; coeffT = Math.abs(u) === 1 ? '' : String(Math.abs(u)); coeffL = coeffT;
    } else if (u === 0) {
      neg = v < 0; coeffT = 'φ'; coeffL = '\\phi';
    } else if (u === -v) {
      // (-1 + φ) = φ^{-1}
      neg = v < 0; coeffT = 'φ⁻¹'; coeffL = '\\phi^{-1}';
    } else {
      coeffT = `(${u}+${v}φ)`; coeffL = `(${u}+${v}\\phi)`;
    }
    const s = neg ? '-' : (partsT.length ? '+' : '');
    const b = idx === 0 ? (coeffT === '' ? '1' : '') : basis[idx];
    partsT.push(`${s}${coeffT}${b}`);
    partsL.push(`${s}${coeffL}${b}`);
  }
  return { text: `(${partsT.join('')})/2`, latex: `\\tfrac{1}{2}(${partsL.join('')})` };
}

// Binary Tetrahedral group 2T ≅ SL(2,3) of order 24 (exact Hurwitz unit quaternions).
export function binaryTetrahedral() {
  const elems = [
    [2, 0, 0, 0], [-2, 0, 0, 0],
    [0, 2, 0, 0], [0, -2, 0, 0],
    [0, 0, 2, 0], [0, 0, -2, 0],
    [0, 0, 0, 2], [0, 0, 0, -2],
  ];
  for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) for (const d of [1, -1]) {
    elems.push([a, b, c, d]);
  }
  const keyOf = q => q.join(',');
  const idxMap = new Map(elems.map((q, i) => [keyOf(q), i]));
  const mulQ = (p, q) => [
    (p[0] * q[0] - p[1] * q[1] - p[2] * q[2] - p[3] * q[3]) / 2,
    (p[0] * q[1] + p[1] * q[0] + p[2] * q[3] - p[3] * q[2]) / 2,
    (p[0] * q[2] - p[1] * q[3] + p[2] * q[0] + p[3] * q[1]) / 2,
    (p[0] * q[3] + p[1] * q[2] - p[2] * q[1] + p[3] * q[0]) / 2,
  ];
  const n = elems.length;
  const table = new Int32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      table[i * n + j] = idxMap.get(keyOf(mulQ(elems[i], elems[j])));
    }
  }
  const labels = elems.map(q => fmtQuatLabel(q, '2T'));
  return createGroup({
    name: '2T',
    latex: '2T \\cong \\mathrm{SL}(2,3)',
    elements: labels.map(l => l.text),
    table,
    e: 0,
    meta: {
      kind: '2T',
      spec: { kind: '2T' },
      turkishName: 'İkili Dörtyüzlü Grup 2T ≅ SL(2,3) (|G| = 24)',
      latexElements: labels.map(l => l.latex),
      quaternions: elems.map(q => q.map(v => v / 2)),
      centerNegOne: 1,
      doubleCoverOf: 'A_4',
      defaultGenerators: [2, 8], // i and (1+i+j+k)/2
    },
  });
}

// Binary Octahedral group 2O of order 48 (exact unit quaternions over Z[√2]/2).
export function binaryOctahedral() {
  const elems = [
    [[2, 0], [0, 0], [0, 0], [0, 0]],
    [[-2, 0], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [2, 0], [0, 0], [0, 0]],
    [[0, 0], [-2, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [2, 0], [0, 0]],
    [[0, 0], [0, 0], [-2, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [2, 0]],
    [[0, 0], [0, 0], [0, 0], [-2, 0]],
  ];
  for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) for (const d of [1, -1]) {
    elems.push([[a, 0], [b, 0], [c, 0], [d, 0]]);
  }
  for (let p = 0; p < 4; p++) {
    for (let q = p + 1; q < 4; q++) {
      for (const s1 of [1, -1]) {
        for (const s2 of [1, -1]) {
          const v = [[0, 0], [0, 0], [0, 0], [0, 0]];
          v[p] = [0, s1];
          v[q] = [0, s2];
          elems.push(v);
        }
      }
    }
  }
  const mulS = (a, b) => [a[0] * b[0] + 2 * a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const lin4 = (p, q, signs, idxs) => {
    let u = 0, v = 0;
    for (let k = 0; k < 4; k++) {
      const pr = mulS(p[idxs[k][0]], q[idxs[k][1]]);
      u += signs[k] * pr[0];
      v += signs[k] * pr[1];
    }
    return [u / 2, v / 2];
  };
  const mulQ = (p, q) => [
    lin4(p, q, [1, -1, -1, -1], [[0, 0], [1, 1], [2, 2], [3, 3]]),
    lin4(p, q, [1, 1, 1, -1], [[0, 1], [1, 0], [2, 3], [3, 2]]),
    lin4(p, q, [1, -1, 1, 1], [[0, 2], [1, 3], [2, 0], [3, 1]]),
    lin4(p, q, [1, 1, -1, 1], [[0, 3], [1, 2], [2, 1], [3, 0]]),
  ];
  const keyOf = q => q.map(c => `${c[0]}:${c[1]}`).join(',');
  const idxMap = new Map(elems.map((q, i) => [keyOf(q), i]));
  const n = elems.length;
  const table = new Int32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      table[i * n + j] = idxMap.get(keyOf(mulQ(elems[i], elems[j])));
    }
  }
  const labels = elems.map(q => fmtQuatLabel(q, '2O'));
  const SQ2 = Math.SQRT2;
  return createGroup({
    name: '2O',
    latex: '2O',
    elements: labels.map(l => l.text),
    table,
    e: 0,
    meta: {
      kind: '2O',
      spec: { kind: '2O' },
      turkishName: 'İkili Sekizyüzlü Grup 2O (|G| = 48)',
      latexElements: labels.map(l => l.latex),
      quaternions: elems.map(q => q.map(([u, v]) => (u + v * SQ2) / 2)),
      centerNegOne: 1,
      doubleCoverOf: 'S_4',
      defaultGenerators: [8, 24], // (1+i+j+k)/2 and (1+i)/√2
    },
  });
}

// Binary Icosahedral group 2I ≅ SL(2,5) of order 120 (exact icosians over Z[φ]/2).
export function binaryIcosahedral() {
  const mulP = (a, b) => [a[0] * b[0] + a[1] * b[1], a[0] * b[1] + a[1] * b[0] + a[1] * b[1]];
  const lin4 = (p, q, signs, idxs) => {
    let u = 0, v = 0;
    for (let k = 0; k < 4; k++) {
      const pr = mulP(p[idxs[k][0]], q[idxs[k][1]]);
      u += signs[k] * pr[0];
      v += signs[k] * pr[1];
    }
    return [u / 2, v / 2];
  };
  const mulQ = (p, q) => [
    lin4(p, q, [1, -1, -1, -1], [[0, 0], [1, 1], [2, 2], [3, 3]]),
    lin4(p, q, [1, 1, 1, -1], [[0, 1], [1, 0], [2, 3], [3, 2]]),
    lin4(p, q, [1, -1, 1, 1], [[0, 2], [1, 3], [2, 0], [3, 1]]),
    lin4(p, q, [1, 1, -1, 1], [[0, 3], [1, 2], [2, 1], [3, 0]]),
  ];
  const keyOf = q => q.map(c => `${c[0]}:${c[1]}`).join(',');
  const id = [[2, 0], [0, 0], [0, 0], [0, 0]];
  const negId = [[-2, 0], [0, 0], [0, 0], [0, 0]];
  // Generators: g1 = (1+i+j+k)/2 (order 6), g2 = (φ + i + φ⁻¹ j)/2 (order 10); g1*g2 has order 4
  const g1 = [[1, 0], [1, 0], [1, 0], [1, 0]];
  const g2 = [[0, 1], [1, 0], [-1, 1], [0, 0]];
  const elems = [id, negId];
  const idxMap = new Map([[keyOf(id), 0], [keyOf(negId), 1]]);
  const gens = [g1, g2];
  for (const g of gens) {
    const k = keyOf(g);
    if (!idxMap.has(k)) { idxMap.set(k, elems.length); elems.push(g); }
  }
  for (let head = 0; head < elems.length; head++) {
    const cur = elems[head];
    for (const g of gens) {
      const prod = mulQ(cur, g);
      const k = keyOf(prod);
      if (!idxMap.has(k)) {
        idxMap.set(k, elems.length);
        elems.push(prod);
      }
    }
  }
  const n = elems.length;
  const table = new Int32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      table[i * n + j] = idxMap.get(keyOf(mulQ(elems[i], elems[j])));
    }
  }
  const labels = elems.map(q => fmtQuatLabel(q, '2I'));
  const PHI = (1 + Math.sqrt(5)) / 2;
  return createGroup({
    name: '2I',
    latex: '2I \\cong \\mathrm{SL}(2,5)',
    elements: labels.map(l => l.text),
    table,
    e: 0,
    meta: {
      kind: '2I',
      spec: { kind: '2I' },
      turkishName: 'İkili Yirmiyüzlü Grup 2I ≅ SL(2,5) (|G| = 120)',
      latexElements: labels.map(l => l.latex),
      quaternions: elems.map(q => q.map(([u, v]) => (u + v * PHI) / 2)),
      centerNegOne: 1,
      doubleCoverOf: 'A_5',
      defaultGenerators: [2, 3],
    },
  });
}

// Frobenius group T_7 = Z_7 ⋊ Z_3 of order 21 (Ramond Section 2.4.4 & 3.10).
export function frobeniusT7() {
  const Z7 = cyclic(7);
  const Z3 = cyclic(3);
  const mults = [1, 2, 4]; // 2^0, 2^1, 2^2 mod 7
  return semiDirect(Z7, Z3, (h, n) => (n * mults[h]) % 7, {
    name: 'T_7',
    latex: 'T_7 = \\mathbb{Z}_7 \\rtimes \\mathbb{Z}_3',
    kind: 'T7',
    spec: { kind: 'T7' },
    turkishName: 'Frobenius Grubu T_7 = Z_7 ⋊ Z_3 (|G| = 21)',
    actionDesc: 'φ(h)(n) = 2^h · n (mod 7)',
    extraMeta: { defaultGenerators: [3, 1] }, // (1,0) order 7 and (0,1) order 3
  });
}

// ---------- Matrix groups over small Galois fields F_p (p prime <= 7) ----------

function mulMatMod(A, B, dim, p) {
  const C = new Array(dim * dim);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      let s = 0;
      for (let k = 0; k < dim; k++) s += A[i * dim + k] * B[k * dim + j];
      C[i * dim + j] = modPos(s, p);
    }
  }
  return C;
}

function detMatMod(M, dim, p) {
  if (dim === 2) return modPos(M[0] * M[3] - M[1] * M[2], p);
  const [a, b, c, d, e, f, g, h, i] = M;
  return modPos(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g), p);
}

function canonPsl2(M, p) {
  if (p === 2) return M;
  const half = (p - 1) >> 1;
  for (let i = 0; i < 4; i++) {
    if (M[i] !== 0) {
      if (M[i] <= half) return M;
      return M.map(v => modPos(-v, p));
    }
  }
  return M;
}

function fmtMatLabel(M, dim, projective = false) {
  if (dim === 2) {
    const t = `[${M[0]} ${M[1]}; ${M[2]} ${M[3]}]`;
    const lx = `\\begin{pmatrix}${M[0]}&${M[1]}\\\\${M[2]}&${M[3]}\\end{pmatrix}`;
    return { text: projective ? `±${t}` : t, latex: projective ? `\\pm${lx}` : lx };
  }
  const t = `[${M[0]}${M[1]}${M[2]};${M[3]}${M[4]}${M[5]};${M[6]}${M[7]}${M[8]}]`;
  const lx = `\\begin{pmatrix}${M[0]}&${M[1]}&${M[2]}\\\\${M[3]}&${M[4]}&${M[5]}\\\\${M[6]}&${M[7]}&${M[8]}\\end{pmatrix}`;
  return { text: t, latex: lx };
}

function buildMatrixGroup({ name, latex, turkishName, dim, p, mats, projective = false, kind, spec }) {
  const idMat = new Array(dim * dim).fill(0);
  for (let i = 0; i < dim; i++) idMat[i * dim + i] = 1;
  const keyOf = M => M.join(',');
  const idKey = keyOf(idMat);
  // Ensure identity is at index 0
  const idPos = mats.findIndex(m => keyOf(m) === idKey);
  if (idPos > 0) {
    const tmp = mats[0]; mats[0] = mats[idPos]; mats[idPos] = tmp;
  }
  const n = mats.length;
  const idxMap = new Map(mats.map((m, i) => [keyOf(m), i]));
  const table = new Int32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let prod = mulMatMod(mats[i], mats[j], dim, p);
      if (projective) prod = canonPsl2(prod, p);
      table[i * n + j] = idxMap.get(keyOf(prod));
    }
  }
  const labels = mats.map((m, i) => i === 0 ? { text: 'I', latex: 'I' } : fmtMatLabel(m, dim, projective));
  return createGroup({
    name,
    latex,
    elements: labels.map(l => l.text),
    table,
    e: 0,
    meta: {
      kind,
      spec,
      turkishName,
      latexElements: labels.map(l => l.latex),
      matrices: mats,
      dim,
      prime: p,
      isProjective: projective,
    },
  });
}

// General Linear Group GL(dim, F_p) for orders <= 240: GL(2,2) (6), GL(2,3) (48), GL(3,2) (168).
export function gl(dim, p) {
  dim = Math.trunc(dim);
  p = Math.trunc(p);
  if (!isSmallPrime(p)) throw new Error('Galois cismi için p ∈ {2, 3, 5, 7} asal olmalı');
  if (dim === 2 && p <= 3) {
    const mats = [];
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++)
      for (let c = 0; c < p; c++) for (let d = 0; d < p; d++) {
        const M = [a, b, c, d];
        if (detMatMod(M, 2, p) !== 0) mats.push(M);
      }
    return buildMatrixGroup({
      name: `GL(2,${p})`,
      latex: `\\mathrm{GL}(2,\\mathbb{F}_{${p}})`,
      turkishName: `Genel Lineer Grup GL(2, F_${p}) (|G| = ${mats.length})`,
      dim: 2, p, mats, kind: 'GL', spec: { kind: 'GL', dim: 2, p },
    });
  }
  if (dim === 3 && p === 2) {
    const mats = [];
    for (let mask = 0; mask < 512; mask++) {
      const M = new Array(9);
      for (let k = 0; k < 9; k++) M[k] = (mask >> k) & 1;
      if (detMatMod(M, 3, 2) === 1) mats.push(M);
    }
    return buildMatrixGroup({
      name: 'GL(3,2)',
      latex: '\\mathrm{GL}(3,\\mathbb{F}_2)',
      turkishName: 'Fano Düzlemi Otomorfizma Grubu GL(3,2) (|G| = 168)',
      dim: 3, p: 2, mats, kind: 'GL32', spec: { kind: 'GL32' },
    });
  }
  throw new Error(`GL(${dim}, F_${p}) mertebesi 240 sınırını aşıyor`);
}

// Special Linear Group SL(dim, F_p) for orders <= 240: SL(2,2) (6), SL(2,3) (24), SL(2,5) (120), SL(3,2) (168).
export function sl(dim, p) {
  dim = Math.trunc(dim);
  p = Math.trunc(p);
  if (!isSmallPrime(p)) throw new Error('Galois cismi için p ∈ {2, 3, 5, 7} asal olmalı');
  if (dim === 3 && p === 2) return gl(3, 2);
  if (dim === 2 && p <= 5) {
    const mats = [];
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) {
        if (a !== 0) {
          const invA = modInv(a, p);
          for (let c = 0; c < p; c++) {
            const d = modPos((1 + b * c) * invA, p);
            mats.push([a, b, c, d]);
          }
        } else if (b !== 0) {
          const c = modPos(-modInv(b, p), p);
          for (let d = 0; d < p; d++) mats.push([0, b, c, d]);
        }
      }
    }
    return buildMatrixGroup({
      name: `SL(2,${p})`,
      latex: `\\mathrm{SL}(2,\\mathbb{F}_{${p}})`,
      turkishName: `Özel Lineer Grup SL(2, F_${p}) (|G| = ${mats.length})`,
      dim: 2, p, mats, kind: 'SL', spec: { kind: 'SL', dim: 2, p },
    });
  }
  throw new Error(`SL(${dim}, F_${p}) mertebesi 240 sınırını aşıyor`);
}

// Projective Special Linear Group PSL(2, F_p) for p ∈ {2, 3, 5, 7} (orders 6, 12, 60, 168).
export function psl(dim, p) {
  dim = Math.trunc(dim);
  p = Math.trunc(p);
  if (dim !== 2 || !isSmallPrime(p)) {
    throw new Error('PSL(2, p) için p ∈ {2, 3, 5, 7} asal olmalı');
  }
  const seen = new Set();
  const mats = [];
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      if (a !== 0) {
        const invA = modInv(a, p);
        for (let c = 0; c < p; c++) {
          const d = modPos((1 + b * c) * invA, p);
          const M = canonPsl2([a, b, c, d], p);
          const k = M.join(',');
          if (!seen.has(k)) { seen.add(k); mats.push(M); }
        }
      } else if (b !== 0) {
        const c = modPos(-modInv(b, p), p);
        for (let d = 0; d < p; d++) {
          const M = canonPsl2([0, b, c, d], p);
          const k = M.join(',');
          if (!seen.has(k)) { seen.add(k); mats.push(M); }
        }
      }
    }
  }
  return buildMatrixGroup({
    name: `PSL(2,${p})`,
    latex: `\\mathrm{PSL}(2,${p})`,
    turkishName: `Projektif Özel Lineer Grup PSL(2, ${p}) (|G| = ${mats.length})`,
    dim: 2,
    p,
    mats,
    projective: true,
    kind: p === 7 ? 'PSL27' : 'PSL',
    spec: p === 7 ? { kind: 'PSL27' } : { kind: 'PSL', dim: 2, p },
  });
}

export function psl2_7() { return psl(2, 7); }
export function gl3_2() { return gl(3, 2); }
export function sl2_3() { return sl(2, 3); }

// Finite SU(3) subgroups Δ(3n²) = (Z_n × Z_n) ⋊ Z_3 (order 3n², n = 2..8).
export function delta3n2(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error('Δ(3n²) için n 2 ile 8 arasında olmalı (3n² ≤ 192)');
  }
  const N = directProduct(cyclic(n), cyclic(n));
  const H = cyclic(3);
  const action = (h, idx) => {
    let j = Math.floor(idx / n), k = idx % n;
    for (let step = 0; step < h; step++) {
      const nj = k;
      const nk = modPos(-j - k, n);
      j = nj; k = nk;
    }
    return j * n + k;
  };
  const ord = 3 * n * n;
  return semiDirect(N, H, action, {
    name: `Δ(${ord})`,
    latex: `\\Delta(${ord})`,
    kind: 'Delta3',
    spec: { kind: 'Delta3', n },
    turkishName: `SU(3) Alt Grubu Δ(3·${n}²) = Δ(${ord})`,
    actionDesc: `c:(j,k) ↦ (k, -j-k) mod ${n}`,
    extraMeta: { n, su3Series: 'Delta(3n^2)' },
  });
}

// Finite SU(3) subgroups Δ(6n²) = (Z_n × Z_n) ⋊ S_3 (order 6n², n = 2..6).
export function delta6n2(n) {
  n = Math.trunc(n);
  if (!Number.isInteger(n) || n < 2 || n > 6) {
    throw new Error('Δ(6n²) için n 2 ile 6 arasında olmalı (6n² ≤ 216)');
  }
  const N = directProduct(cyclic(n), cyclic(n));
  const H = symmetric(3);
  // Each σ ∈ S_3 permutes the 3 diagonal phases (j, k, -j-k) via v[i] -> v[σ^{-1}(i)]
  // Wait: left action requires (σ τ) · v = σ · (τ · v), so (σ · v)_i = v_{σ^{-1}(i)}.
  const action = (hIdx, idx) => {
    const p = H.meta.perms[hIdx];
    const pInv = invertPerm(p);
    const j = Math.floor(idx / n), k = idx % n;
    const v = [j, k, modPos(-j - k, n)];
    const nj = v[pInv[0]];
    const nk = v[pInv[1]];
    return nj * n + nk;
  };
  const ord = 6 * n * n;
  return semiDirect(N, H, action, {
    name: `Δ(${ord})`,
    latex: `\\Delta(${ord})`,
    kind: 'Delta6',
    spec: { kind: 'Delta6', n },
    turkishName: `SU(3) Alt Grubu Δ(6·${n}²) = Δ(${ord})`,
    actionDesc: `S₃, (j, k, -j-k) faz üçlüsünü permüte eder (mod ${n})`,
    extraMeta: { n, su3Series: 'Delta(6n^2)' },
  });
}

// Hessian group Σ(216) = (Z_3 × Z_3) ⋊ SL(2,3) of order 216 (projective PSU(3) subgroup; triple cover in SU(3) has order 648).
export function hessian216() {
  const N = directProduct(cyclic(3), cyclic(3));
  const H = sl(2, 3);
  const mats = H.meta.matrices;
  const action = (hIdx, idx) => {
    const [a, b, c, d] = mats[hIdx];
    const x = Math.floor(idx / 3), y = idx % 3;
    const nx = (a * x + b * y) % 3;
    const ny = (c * x + d * y) % 3;
    return nx * 3 + ny;
  };
  return semiDirect(N, H, action, {
    name: 'Σ(216)',
    latex: '\\Sigma(216)',
    kind: 'Hessian',
    spec: { kind: 'Hessian' },
    turkishName: 'Hessian Grubu Σ(216) = (Z₃×Z₃) ⋊ SL(2,3) (|G| = 216)',
    actionDesc: 'SL(2,3) matrisleri F₃² üzerine doğrusal etki eder',
    extraMeta: { su3CoverOrder: 648 },
  });
}

function buildExtendedGroup(spec) {
  switch (spec.kind) {
    case 'cube': return cubeRotations();
    case 'Q2n':
    case 'Dic': return dicyclic(spec.n ?? 3);
    case '2T': return binaryTetrahedral();
    case 'SL23': return sl(2, 3);
    case '2O': return binaryOctahedral();
    case '2I': return binaryIcosahedral();
    case 'T7':
    case 'Frob': return frobeniusT7();
    case 'PSL27': return psl2_7();
    case 'GL32': return gl3_2();
    case 'GL': return gl(spec.dim ?? 2, spec.p ?? 3);
    case 'SL': return sl(spec.dim ?? 2, spec.p ?? 3);
    case 'PSL': return psl(spec.dim ?? 2, spec.p ?? 5);
    case 'Delta3': return delta3n2(spec.n ?? 3);
    case 'Delta6': return delta6n2(spec.n ?? 3);
    case 'Hessian': return hessian216();
    default: throw new Error(`Bilinmeyen grup türü: ${spec.kind}`);
  }
}


