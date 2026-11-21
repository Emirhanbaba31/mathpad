// MathPad Engineering Simulation Center — Part 4 Pure Core Module
// Fields: bilgisayar (8), endustri (8), biyomed (7), fizikmat (9) = 32 simulations.
// Pure ES module: NO DOM, NO browser globals, NO imports of ui.js / fx.js / phys-ui.js.

// =====================================================================
// 0. SHARED MATH, STATISTICS, LINEAR ALGEBRA & INTEGRATORS
// =====================================================================

export const G0 = 9.80665;
export const C_LIGHT = 299792458; // m/s
export const H_PLANCK = 6.62607015e-34; // J·s
export const HC_EV_NM = 1239.8419843320026; // eV·nm
export const COMPTON_PM = 2.42631023867; // pm = h / (m_e c)
export const ME_C2_KEV = 510.99895; // keV
export const MU0 = 4 * Math.PI * 1e-7; // T·m/A

/** Deterministic Mulberry32 PRNG returning [0, 1). */
export function makeRng(seed = 123456789) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Abramowitz & Stegun 7.1.26 error function (max error < 1.5e-7). */
export function erf(x) {
  const sgn = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-a * a);
  return sgn * y;
}

export function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Acklam's rational approximation for standard normal inverse CDF (error < 1.15e-9). */
export function normalInvCDF(p) {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : p >= 1 ? Infinity : NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function logFactorial(n) {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

/** Gaussian elimination with partial pivoting for small dense systems A x = b. */
export function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]];
    const diag = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= diag;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-15) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

/** Standard 4th-order Runge-Kutta step for vector ODE dy/dt = f(t, y). */
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

// =====================================================================
// FIELD 1: BİLGİSAYAR (8 SIMULATIONS)
// =====================================================================

// ---------- 1.1 Sorting Algorithms ----------

export const SORT_COMPLEXITY = [
  { id: 'bubble',    name: 'Kabarcık (Bubble)',     best: 'O(n)',        avg: 'O(n²)',      worst: 'O(n²)',      space: 'O(1)',     stable: true },
  { id: 'insertion', name: 'Eklemeli (Insertion)',  best: 'O(n)',        avg: 'O(n²)',      worst: 'O(n²)',      space: 'O(1)',     stable: true },
  { id: 'selection', name: 'Seçmeli (Selection)',   best: 'O(n²)',       avg: 'O(n²)',      worst: 'O(n²)',      space: 'O(1)',     stable: false },
  { id: 'merge',     name: 'Birleştirmeli (Merge)', best: 'O(n log n)',  avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)',     stable: true },
  { id: 'quick',     name: 'Hızlı (Quick)',         best: 'O(n log n)',  avg: 'O(n log n)', worst: 'O(n²)',      space: 'O(log n)', stable: false },
  { id: 'heap',      name: 'Yığın (Heap)',          best: 'O(n log n)',  avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)',     stable: false },
  { id: 'counting',  name: 'Sayma (Counting)',      best: 'O(n + k)',    avg: 'O(n + k)',   worst: 'O(n + k)',   space: 'O(n + k)', stable: true },
  { id: 'radix',     name: 'Taban (Radix LSD)',     best: 'O(d(n+b))',   avg: 'O(d(n+b))',  worst: 'O(d(n+b))',  space: 'O(n + b)', stable: true },
];

export function generateSortArray(n = 20, pattern = 'random', seed = 42) {
  const rng = makeRng(seed);
  const len = Math.max(4, Math.min(64, Math.round(n)));
  const arr = [];
  if (pattern === 'reversed') {
    for (let i = 0; i < len; i++) arr.push(Math.round(95 - (i / Math.max(1, len - 1)) * 87));
  } else if (pattern === 'nearly') {
    for (let i = 0; i < len; i++) arr.push(Math.round(8 + (i / Math.max(1, len - 1)) * 87));
    const swaps = Math.max(1, Math.floor(len / 5));
    for (let k = 0; k < swaps; k++) {
      const i = Math.floor(rng() * (len - 1));
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    }
  } else if (pattern === 'few') {
    const vals = [15, 35, 55, 75, 92];
    for (let i = 0; i < len; i++) arr.push(vals[Math.floor(rng() * vals.length)]);
  } else {
    for (let i = 0; i < len; i++) arr.push(5 + Math.floor(rng() * 93));
  }
  return arr;
}

export function sortTrace(algo, inputArr) {
  const a = inputArr.slice();
  const n = a.length;
  const steps = [];
  let comps = 0, swaps = 0, writes = 0;
  const sortedSet = new Set();

  const snap = (compare = [], swap = [], active = [], note = '') => {
    steps.push({
      arr: a.slice(),
      compare,
      swap,
      active,
      sortedIdx: [...sortedSet],
      comps,
      swaps,
      writes,
      note,
    });
  };

  snap([], [], [], 'Başlangıç dizisi');

  if (algo === 'bubble') {
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - 1 - i; j++) {
        comps++;
        snap([j, j + 1], [], [], `Karşılaştır: a[${j}]=${a[j]}, a[${j + 1}]=${a[j + 1]}`);
        if (a[j] > a[j + 1]) {
          [a[j], a[j + 1]] = [a[j + 1], a[j]];
          swaps++; writes += 2; swapped = true;
          snap([], [j, j + 1], [], `Takas: ${a[j]} ↔ ${a[j + 1]}`);
        }
      }
      sortedSet.add(n - 1 - i);
      if (!swapped) {
        for (let k = 0; k < n - 1 - i; k++) sortedSet.add(k);
        break;
      }
    }
    sortedSet.add(0);
  } else if (algo === 'insertion') {
    sortedSet.add(0);
    for (let i = 1; i < n; i++) {
      const key = a[i];
      let j = i - 1;
      snap([], [], [i], `Anahtar seçildi: ${key}`);
      while (j >= 0) {
        comps++;
        snap([j, j + 1], [], [i], `Karşılaştır: ${a[j]} > ${key}?`);
        if (a[j] > key) {
          a[j + 1] = a[j];
          swaps++; writes++;
          snap([], [j, j + 1], [], `Sağa kaydır: ${a[j]}`);
          j--;
        } else {
          break;
        }
      }
      a[j + 1] = key;
      writes++;
      sortedSet.add(i);
      snap([], [], [j + 1], `Yerleştirildi: a[${j + 1}] = ${key}`);
    }
  } else if (algo === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        comps++;
        snap([minIdx, j], [], [i], `Min ara: a[${minIdx}]=${a[minIdx]} vs a[${j}]=${a[j]}`);
        if (a[j] < a[minIdx]) minIdx = j;
      }
      if (minIdx !== i) {
        [a[i], a[minIdx]] = [a[minIdx], a[i]];
        swaps++; writes += 2;
        snap([], [i, minIdx], [], `Minimum takas: a[${i}] ↔ a[${minIdx}]`);
      }
      sortedSet.add(i);
    }
    sortedSet.add(n - 1);
  } else if (algo === 'merge') {
    const mergeSort = (l, r) => {
      if (l >= r) return;
      const m = (l + r) >> 1;
      mergeSort(l, m);
      mergeSort(m + 1, r);
      const left = a.slice(l, m + 1);
      const right = a.slice(m + 1, r + 1);
      let i = 0, j = 0, k = l;
      while (i < left.length && j < right.length) {
        comps++;
        snap([l + i, m + 1 + j], [], [k], `Birleştir [${l}..${r}]`);
        if (left[i] <= right[j]) {
          a[k] = left[i++];
        } else {
          a[k] = right[j++];
        }
        writes++;
        snap([], [k], [], `Yaz: a[${k}] = ${a[k]}`);
        k++;
      }
      while (i < left.length) {
        a[k] = left[i++]; writes++;
        snap([], [k], [], `Kalan sol: a[${k}] = ${a[k]}`);
        k++;
      }
      while (j < right.length) {
        a[k] = right[j++]; writes++;
        snap([], [k], [], `Kalan sağ: a[${k}] = ${a[k]}`);
        k++;
      }
    };
    mergeSort(0, n - 1);
    for (let i = 0; i < n; i++) sortedSet.add(i);
  } else if (algo === 'quick') {
    const qs = (lo, hi) => {
      if (lo >= hi) {
        if (lo >= 0 && lo < n) sortedSet.add(lo);
        return;
      }
      // Median-of-three pivot avoids pathological worst case on nearly sorted input while staying textbook
      const mid = (lo + hi) >> 1;
      if (a[mid] < a[lo]) { [a[lo], a[mid]] = [a[mid], a[lo]]; swaps++; writes += 2; }
      if (a[hi] < a[lo]) { [a[lo], a[hi]] = [a[hi], a[lo]]; swaps++; writes += 2; }
      if (a[mid] < a[hi]) { [a[mid], a[hi]] = [a[hi], a[mid]]; swaps++; writes += 2; }
      const pivot = a[hi];
      let i = lo;
      snap([], [], [hi], `Pivot = ${pivot} (indeks ${hi})`);
      for (let j = lo; j < hi; j++) {
        comps++;
        snap([j, hi], [], [hi], `Karşılaştır: ${a[j]} ≤ ${pivot}?`);
        if (a[j] <= pivot) {
          if (i !== j) {
            [a[i], a[j]] = [a[j], a[i]];
            swaps++; writes += 2;
            snap([], [i, j], [hi], `Bölüm takası: a[${i}] ↔ a[${j}]`);
          }
          i++;
        }
      }
      if (i !== hi) {
        [a[i], a[hi]] = [a[hi], a[i]];
        swaps++; writes += 2;
        snap([], [i, hi], [], `Pivot yerleşti: indeks ${i}`);
      }
      sortedSet.add(i);
      qs(lo, i - 1);
      qs(i + 1, hi);
    };
    qs(0, n - 1);
  } else if (algo === 'heap') {
    const siftDown = (size, root) => {
      let largest = root;
      while (true) {
        const l = 2 * root + 1, r = 2 * root + 2;
        if (l < size) {
          comps++;
          snap([largest, l], [], [root], `Yığın sol çocuk: a[${l}]`);
          if (a[l] > a[largest]) largest = l;
        }
        if (r < size) {
          comps++;
          snap([largest, r], [], [root], `Yığın sağ çocuk: a[${r}]`);
          if (a[r] > a[largest]) largest = r;
        }
        if (largest !== root) {
          [a[root], a[largest]] = [a[largest], a[root]];
          swaps++; writes += 2;
          snap([], [root, largest], [], `Heapify takas: ${root} ↔ ${largest}`);
          root = largest;
        } else break;
      }
    };
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(n, i);
    for (let end = n - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]];
      swaps++; writes += 2;
      sortedSet.add(end);
      snap([], [0, end], [], `Maksimum çıkarıldı → indeks ${end}`);
      siftDown(end, 0);
    }
    sortedSet.add(0);
  } else if (algo === 'counting') {
    const minV = Math.min(...a), maxV = Math.max(...a);
    const range = maxV - minV + 1;
    const count = new Array(range).fill(0);
    for (let i = 0; i < n; i++) {
      count[a[i] - minV]++;
      snap([], [], [i], `Frekans say: değer ${a[i]} → ${count[a[i] - minV]}`);
    }
    for (let k = 1; k < range; k++) count[k] += count[k - 1];
    const out = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      const pos = --count[a[i] - minV];
      out[pos] = a[i];
    }
    for (let i = 0; i < n; i++) {
      a[i] = out[i];
      writes++;
      sortedSet.add(i);
      snap([], [i], [], `Sayma çıkışı: a[${i}] = ${a[i]}`);
    }
  } else if (algo === 'radix') {
    const maxV = Math.max(...a, 0);
    for (let exp = 1; Math.floor(maxV / exp) > 0; exp *= 10) {
      const buckets = Array.from({ length: 10 }, () => []);
      for (let i = 0; i < n; i++) {
        const d = Math.floor(a[i] / exp) % 10;
        buckets[d].push(a[i]);
        snap([], [], [i], `Basamak ${exp}'ler: ${a[i]} → kova ${d}`);
      }
      let k = 0;
      for (let d = 0; d < 10; d++) {
        for (const val of buckets[d]) {
          a[k] = val;
          writes++;
          snap([], [k], [], `Kova ${d} → a[${k}] = ${val}`);
          k++;
        }
      }
    }
    for (let i = 0; i < n; i++) sortedSet.add(i);
  }

  snap([], [], [], 'Sıralama tamamlandı');
  return { sorted: a.slice(), steps, comps, swaps, writes };
}

// ---------- 1.2 Graph Algorithms & A* Grid ----------

export const GRAPH_PRESETS = {
  city: {
    label: 'Ağırlıklı Ağ (Pozitif)',
    directed: false,
    nodes: [
      { id: 0, label: 'A', x: 0.14, y: 0.50 },
      { id: 1, label: 'B', x: 0.36, y: 0.20 },
      { id: 2, label: 'C', x: 0.36, y: 0.80 },
      { id: 3, label: 'D', x: 0.62, y: 0.24 },
      { id: 4, label: 'E', x: 0.62, y: 0.76 },
      { id: 5, label: 'F', x: 0.86, y: 0.50 },
    ],
    edges: [
      { u: 0, v: 1, w: 4 }, { u: 0, v: 2, w: 2 }, { u: 1, v: 2, w: 1 },
      { u: 1, v: 3, w: 5 }, { u: 2, v: 4, w: 8 }, { u: 2, v: 3, w: 7 },
      { u: 3, v: 4, w: 2 }, { u: 3, v: 5, w: 6 }, { u: 4, v: 5, w: 3 },
    ],
  },
  neg: {
    label: 'Negatif Kenar (Bellman-Ford)',
    directed: true,
    nodes: [
      { id: 0, label: 'S', x: 0.14, y: 0.50 },
      { id: 1, label: 'A', x: 0.42, y: 0.20 },
      { id: 2, label: 'B', x: 0.42, y: 0.80 },
      { id: 3, label: 'C', x: 0.72, y: 0.25 },
      { id: 4, label: 'T', x: 0.86, y: 0.68 },
    ],
    edges: [
      { u: 0, v: 1, w: 6 }, { u: 0, v: 2, w: 7 }, { u: 1, v: 3, w: 5 },
      { u: 1, v: 2, w: 8 }, { u: 2, v: 3, w: -3 }, { u: 3, v: 1, w: -2 },
      { u: 2, v: 4, w: 9 }, { u: 3, v: 4, w: 4 },
    ],
  },
  dag: {
    label: 'Ders Önkoşulları (DAG)',
    directed: true,
    nodes: [
      { id: 0, label: 'Mat1', x: 0.14, y: 0.25 },
      { id: 1, label: 'Prg1', x: 0.14, y: 0.75 },
      { id: 2, label: 'Veri', x: 0.42, y: 0.55 },
      { id: 3, label: 'Ayrık', x: 0.42, y: 0.20 },
      { id: 4, label: 'Algo', x: 0.68, y: 0.35 },
      { id: 5, label: 'YapayZ', x: 0.88, y: 0.55 },
    ],
    edges: [
      { u: 0, v: 3, w: 1 }, { u: 1, v: 2, w: 1 }, { u: 3, v: 4, w: 1 },
      { u: 2, v: 4, w: 1 }, { u: 2, v: 5, w: 1 }, { u: 4, v: 5, w: 1 },
    ],
  },
};

export function runGraphAlgo({ algo, nodes, edges, start = 0, directed = false }) {
  const ids = nodes.map(n => n.id);
  const labelOf = id => nodes.find(n => n.id === id)?.label ?? String(id);
  const adj = new Map(ids.map(id => [id, []]));
  const isUndir = algo === 'prim' || algo === 'kruskal' || (!directed && algo !== 'topo');

  for (const e of edges) {
    if (!adj.has(e.u) || !adj.has(e.v)) continue;
    adj.get(e.u).push({ to: e.v, w: e.w });
    if (isUndir && e.u !== e.v) adj.get(e.v).push({ to: e.u, w: e.w });
  }
  for (const list of adj.values()) list.sort((a, b) => a.to - b.to);

  if (!ids.length) return { ok: false, error: 'Graf boş; en az bir düğüm ekleyin.', steps: [] };
  const s = ids.includes(start) ? start : ids[0];
  const steps = [];

  if (algo === 'bfs') {
    const visited = new Set([s]);
    const queue = [s];
    const dist = Object.fromEntries(ids.map(id => [id, id === s ? 0 : Infinity]));
    const parent = {};
    const treeEdges = [];
    const order = [];
    steps.push({ current: s, visited: [...visited], frontier: [...queue], treeEdges: [], dist: { ...dist }, note: `Kuyruğa eklendi: ${labelOf(s)}` });
    while (queue.length) {
      const u = queue.shift();
      order.push(u);
      steps.push({ current: u, visited: [...visited], frontier: [...queue], treeEdges: [...treeEdges], dist: { ...dist }, note: `Ziyaret: ${labelOf(u)} (d=${dist[u]})` });
      for (const { to } of adj.get(u)) {
        if (!visited.has(to)) {
          visited.add(to);
          dist[to] = dist[u] + 1;
          parent[to] = u;
          treeEdges.push([u, to]);
          queue.push(to);
          steps.push({ current: u, activeEdge: [u, to], visited: [...visited], frontier: [...queue], treeEdges: [...treeEdges], dist: { ...dist }, note: `Keşfedildi: ${labelOf(to)} (kuyruğa eklendi)` });
        }
      }
    }
    return { ok: true, steps, order, dist, parent, treeEdges };
  }

  if (algo === 'dfs') {
    const visited = new Set();
    const stack = [s];
    const parent = {};
    const treeEdges = [];
    const order = [];
    steps.push({ current: s, visited: [], frontier: [...stack], treeEdges: [], note: `Yığına eklendi: ${labelOf(s)}` });
    while (stack.length) {
      const u = stack.pop();
      if (visited.has(u)) continue;
      visited.add(u);
      order.push(u);
      if (parent[u] !== undefined) treeEdges.push([parent[u], u]);
      steps.push({ current: u, visited: [...visited], frontier: [...stack], treeEdges: [...treeEdges], note: `Ziyaret: ${labelOf(u)}` });
      const nbrs = adj.get(u).slice().reverse();
      for (const { to } of nbrs) {
        if (!visited.has(to)) {
          if (parent[to] === undefined) parent[to] = u;
          stack.push(to);
        }
      }
      steps.push({ current: u, visited: [...visited], frontier: [...stack], treeEdges: [...treeEdges], note: `Komşular yığına itildi` });
    }
    return { ok: true, steps, order, parent, treeEdges };
  }

  if (algo === 'dijkstra') {
    if (edges.some(e => e.w < 0)) {
      return { ok: false, error: 'Dijkstra negatif kenar ağırlıklarını desteklemez; Bellman-Ford seçin.', steps: [] };
    }
    const dist = Object.fromEntries(ids.map(id => [id, id === s ? 0 : Infinity]));
    const parent = {};
    const settled = new Set();
    const order = [];
    const pq = [{ node: s, d: 0 }];
    steps.push({ current: s, visited: [], frontier: pq.map(x => x.node), dist: { ...dist }, treeEdges: [], note: `Başlangıç ${labelOf(s)}: d=0` });

    while (pq.length) {
      pq.sort((a, b) => a.d - b.d);
      const { node: u, d } = pq.shift();
      if (settled.has(u)) continue;
      settled.add(u);
      order.push(u);
      const treeEdges = Object.entries(parent).map(([v, p]) => [p, +v]);
      steps.push({ current: u, visited: [...settled], frontier: [...new Set(pq.filter(x => !settled.has(x.node)).map(x => x.node))], dist: { ...dist }, treeEdges, note: `Kesinleşti: ${labelOf(u)} (d=${d})` });
      for (const { to, w } of adj.get(u)) {
        if (settled.has(to)) continue;
        if (dist[u] + w < dist[to]) {
          dist[to] = dist[u] + w;
          parent[to] = u;
          pq.push({ node: to, d: dist[to] });
          const te = Object.entries(parent).map(([v, p]) => [p, +v]);
          steps.push({ current: u, activeEdge: [u, to], visited: [...settled], frontier: [...new Set(pq.filter(x => !settled.has(x.node)).map(x => x.node))], dist: { ...dist }, treeEdges: te, note: `Gevşetme: ${labelOf(u)}→${labelOf(to)} yeni d=${dist[to]}` });
        }
      }
    }
    const treeEdges = Object.entries(parent).map(([v, p]) => [p, +v]);
    return { ok: true, steps, order, dist, parent, treeEdges };
  }

  if (algo === 'bellman-ford') {
    const dist = Object.fromEntries(ids.map(id => [id, id === s ? 0 : Infinity]));
    const parent = {};
    const dirEdges = [];
    for (const e of edges) {
      dirEdges.push({ u: e.u, v: e.v, w: e.w });
      if (!directed && e.u !== e.v) dirEdges.push({ u: e.v, v: e.u, w: e.w });
    }
    steps.push({ current: s, visited: [s], frontier: [], dist: { ...dist }, treeEdges: [], note: `Başlangıç ${labelOf(s)}: d=0` });
    for (let iter = 1; iter <= ids.length - 1; iter++) {
      let changed = false;
      for (const { u, v, w } of dirEdges) {
        if (dist[u] < Infinity && dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          parent[v] = u;
          changed = true;
          const te = Object.entries(parent).map(([k, p]) => [p, +k]);
          steps.push({ current: v, activeEdge: [u, v], visited: ids.filter(id => dist[id] < Infinity), frontier: [v], dist: { ...dist }, treeEdges: te, note: `Tur ${iter}: ${labelOf(u)}→${labelOf(v)} (d=${dist[v]})` });
        }
      }
      if (!changed) break;
    }
    let hasNegCycle = false;
    for (const { u, v, w } of dirEdges) {
      if (dist[u] < Infinity && dist[u] + w < dist[v]) {
        hasNegCycle = true;
        steps.push({ current: v, activeEdge: [u, v], visited: ids.filter(id => dist[id] < Infinity), frontier: [], dist: { ...dist }, treeEdges: Object.entries(parent).map(([k, p]) => [p, +k]), note: `Negatif çevrim tespit edildi (${labelOf(u)}→${labelOf(v)})!` });
        break;
      }
    }
    return { ok: true, steps, dist, parent, hasNegCycle, treeEdges: Object.entries(parent).map(([k, p]) => [p, +k]) };
  }

  if (algo === 'prim') {
    const inMst = new Set([s]);
    const mstEdges = [];
    let mstWeight = 0;
    steps.push({ current: s, visited: [s], frontier: [], treeEdges: [], note: `Prim MST başlangıcı: ${labelOf(s)}` });
    while (inMst.size < ids.length) {
      let best = null;
      for (const u of inMst) {
        for (const { to, w } of adj.get(u)) {
          if (!inMst.has(to) && (!best || w < best.w)) best = { u, v: to, w };
        }
      }
      if (!best) break;
      inMst.add(best.v);
      mstEdges.push(best);
      mstWeight += best.w;
      steps.push({ current: best.v, activeEdge: [best.u, best.v], visited: [...inMst], frontier: [], treeEdges: mstEdges.map(e => [e.u, e.v]), note: `MST kenarı: ${labelOf(best.u)}–${labelOf(best.v)} (w=${best.w}, toplam=${mstWeight})` });
    }
    return { ok: true, steps, mstEdges, mstWeight, treeEdges: mstEdges.map(e => [e.u, e.v]) };
  }

  if (algo === 'kruskal') {
    const parent = Object.fromEntries(ids.map(id => [id, id]));
    const rank = Object.fromEntries(ids.map(id => [id, 0]));
    const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (x, y) => {
      const rx = find(x), ry = find(y);
      if (rx === ry) return false;
      if (rank[rx] < rank[ry]) parent[rx] = ry;
      else if (rank[rx] > rank[ry]) parent[ry] = rx;
      else { parent[ry] = rx; rank[rx]++; }
      return true;
    };
    const sorted = edges.slice().sort((a, b) => a.w - b.w);
    const mstEdges = [];
    const visited = new Set();
    let mstWeight = 0;
    for (const e of sorted) {
      if (union(e.u, e.v)) {
        mstEdges.push(e);
        mstWeight += e.w;
        visited.add(e.u); visited.add(e.v);
        steps.push({ current: e.v, activeEdge: [e.u, e.v], visited: [...visited], frontier: [], treeEdges: mstEdges.map(x => [x.u, x.v]), note: `Kabul: ${labelOf(e.u)}–${labelOf(e.v)} (w=${e.w}, toplam=${mstWeight})` });
      } else {
        steps.push({ current: e.u, activeEdge: [e.u, e.v], visited: [...visited], frontier: [], treeEdges: mstEdges.map(x => [x.u, x.v]), note: `Reddedildi (çevrim): ${labelOf(e.u)}–${labelOf(e.v)} (w=${e.w})` });
      }
    }
    return { ok: true, steps, mstEdges, mstWeight, treeEdges: mstEdges.map(x => [x.u, x.v]) };
  }

  if (algo === 'topo') {
    const inDeg = Object.fromEntries(ids.map(id => [id, 0]));
    const dirAdj = new Map(ids.map(id => [id, []]));
    for (const e of edges) {
      if (!dirAdj.has(e.u) || !dirAdj.has(e.v)) continue;
      dirAdj.get(e.u).push(e.v);
      inDeg[e.v]++;
    }
    const queue = ids.filter(id => inDeg[id] === 0);
    const topoOrder = [];
    steps.push({ current: queue[0] ?? null, visited: [], frontier: [...queue], treeEdges: [], note: `Giriş derecesi 0 düğümler: ${queue.map(labelOf).join(', ') || 'yok'}` });
    while (queue.length) {
      const u = queue.shift();
      topoOrder.push(u);
      for (const v of dirAdj.get(u)) {
        inDeg[v]--;
        if (inDeg[v] === 0) queue.push(v);
      }
      steps.push({ current: u, visited: [...topoOrder], frontier: [...queue], treeEdges: [], note: `Sıraya alındı: ${labelOf(u)}` });
    }
    const hasCycle = topoOrder.length < ids.length;
    if (hasCycle) {
      steps.push({ current: null, visited: [...topoOrder], frontier: [], treeEdges: [], note: 'Yönlü çevrim var: topolojik sıralama mümkün değil!' });
    }
    return { ok: true, steps, topoOrder, hasCycle };
  }

  return { ok: false, error: 'Bilinmeyen graf algoritması', steps: [] };
}

export function runAStarGrid({ rows = 12, cols = 16, walls = [], start = [1, 1], goal = [10, 14], heuristic = 'manhattan' }) {
  const wallSet = new Set(walls.map(w => (Array.isArray(w) ? `${w[0]},${w[1]}` : String(w))));
  const key = (r, c) => `${r},${c}`;
  const hFn = (r, c) => {
    const dr = Math.abs(r - goal[0]), dc = Math.abs(c - goal[1]);
    if (heuristic === 'euclidean') return Math.hypot(dr, dc);
    if (heuristic === 'dijkstra') return 0;
    return dr + dc;
  };
  const sKey = key(start[0], start[1]);
  const gKey = key(goal[0], goal[1]);
  const gScore = new Map([[sKey, 0]]);
  const fScore = new Map([[sKey, hFn(start[0], start[1])]]);
  const cameFrom = new Map();
  const openSet = new Set([sKey]);
  const closedSet = new Set();
  const steps = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (openSet.size) {
    let curKey = null, bestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) { bestF = f; curKey = k; }
    }
    const [cr, cc] = curKey.split(',').map(Number);
    if (curKey === gKey) {
      const path = [];
      let p = gKey;
      while (p) {
        path.push(p.split(',').map(Number));
        p = cameFrom.get(p);
      }
      path.reverse();
      steps.push({ current: [cr, cc], open: [...openSet], closed: [...closedSet], path });
      return { found: true, path, cost: gScore.get(gKey), visitedCount: closedSet.size + 1, steps };
    }
    openSet.delete(curKey);
    closedSet.add(curKey);

    for (const [dr, dc] of dirs) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nk = key(nr, nc);
      if (wallSet.has(nk) || closedSet.has(nk)) continue;
      const tentG = (gScore.get(curKey) ?? Infinity) + 1;
      if (tentG < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, curKey);
        gScore.set(nk, tentG);
        fScore.set(nk, tentG + hFn(nr, nc));
        openSet.add(nk);
      }
    }
    steps.push({ current: [cr, cc], open: [...openSet], closed: [...closedSet], path: [] });
  }
  return { found: false, path: [], cost: Infinity, visitedCount: closedSet.size, steps };
}

// ---------- 1.3 Data Structures (BST / AVL, Heap, Hash Table) ----------

const nodeH = n => (n ? n.h : 0);
const updH = n => { if (n) n.h = 1 + Math.max(nodeH(n.left), nodeH(n.right)); return n; };
export const avlBalance = n => (n ? nodeH(n.left) - nodeH(n.right) : 0);

function cloneTree(n) {
  return n ? { val: n.val, h: n.h, left: cloneTree(n.left), right: cloneTree(n.right) } : null;
}

function rotRight(y) {
  const x = y.left;
  y.left = x.right;
  x.right = y;
  updH(y); updH(x);
  return x;
}

function rotLeft(x) {
  const y = x.right;
  x.right = y.left;
  y.left = x;
  updH(x); updH(y);
  return y;
}

function rebalanceAVL(node, rotations) {
  updH(node);
  const bf = avlBalance(node);
  if (bf > 1) {
    if (avlBalance(node.left) < 0) {
      rotations.push({ type: 'LR', pivot: node.val });
      node.left = rotLeft(node.left);
      return rotRight(node);
    }
    rotations.push({ type: 'LL', pivot: node.val });
    return rotRight(node);
  }
  if (bf < -1) {
    if (avlBalance(node.right) > 0) {
      rotations.push({ type: 'RL', pivot: node.val });
      node.right = rotRight(node.right);
      return rotLeft(node);
    }
    rotations.push({ type: 'RR', pivot: node.val });
    return rotLeft(node);
  }
  return node;
}

export function bstInsert(root, val, { avl = false } = {}) {
  const path = [];
  const rotations = [];
  let foundDup = false;
  const ins = n => {
    if (!n) return { val, h: 1, left: null, right: null };
    path.push(n.val);
    if (val < n.val) n.left = ins(n.left);
    else if (val > n.val) n.right = ins(n.right);
    else { foundDup = true; return n; }
    return avl ? rebalanceAVL(n, rotations) : updH(n);
  };
  const nextRoot = ins(cloneTree(root));
  return { root: nextRoot, path, rotations, foundDup };
}

export function bstDelete(root, val, { avl = false } = {}) {
  const path = [];
  const rotations = [];
  let removed = false;
  const del = n => {
    if (!n) return null;
    path.push(n.val);
    if (val < n.val) n.left = del(n.left);
    else if (val > n.val) n.right = del(n.right);
    else {
      removed = true;
      if (!n.left) return n.right;
      if (!n.right) return n.left;
      let succ = n.right;
      while (succ.left) succ = succ.left;
      n.val = succ.val;
      n.right = del(n.right);
    }
    return avl ? rebalanceAVL(n, rotations) : updH(n);
  };
  const nextRoot = del(cloneTree(root));
  return { root: nextRoot, path, rotations, removed };
}

export function bstSearch(root, val) {
  const path = [];
  let cur = root;
  while (cur) {
    path.push(cur.val);
    if (val === cur.val) return { found: true, path };
    cur = val < cur.val ? cur.left : cur.right;
  }
  return { found: false, path };
}

export function bstTraversals(root) {
  const inorder = [], preorder = [], postorder = [];
  let isBalanced = true;
  const walk = n => {
    if (!n) return 0;
    preorder.push(n.val);
    const lh = walk(n.left);
    inorder.push(n.val);
    const rh = walk(n.right);
    postorder.push(n.val);
    if (Math.abs(lh - rh) > 1) isBalanced = false;
    return 1 + Math.max(lh, rh);
  };
  const height = walk(root);
  return { inorder, preorder, postorder, height, size: inorder.length, isBalanced };
}

export function heapPush(arr, val, isMin = true) {
  const a = arr.slice();
  const steps = [];
  a.push(val);
  let i = a.length - 1;
  const better = (x, y) => (isMin ? x < y : x > y);
  steps.push({ arr: a.slice(), hi: [i] });
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (better(a[i], a[p])) {
      [a[i], a[p]] = [a[p], a[i]];
      steps.push({ arr: a.slice(), hi: [p, i] });
      i = p;
    } else break;
  }
  return { arr: a, steps };
}

export function heapPop(arr, isMin = true) {
  if (!arr.length) return { arr: [], popped: null, steps: [] };
  const a = arr.slice();
  const popped = a[0];
  const last = a.pop();
  const steps = [];
  if (a.length) {
    a[0] = last;
    steps.push({ arr: a.slice(), hi: [0] });
    const better = (x, y) => (isMin ? x < y : x > y);
    let i = 0;
    while (true) {
      const l = 2 * i + 1, r = 2 * i + 2;
      let best = i;
      if (l < a.length && better(a[l], a[best])) best = l;
      if (r < a.length && better(a[r], a[best])) best = r;
      if (best !== i) {
        [a[i], a[best]] = [a[best], a[i]];
        steps.push({ arr: a.slice(), hi: [i, best] });
        i = best;
      } else break;
    }
  }
  return { arr: a, popped, steps };
}

export function hashCreate(size = 11, mode = 'chaining') {
  return {
    size,
    mode,
    buckets: mode === 'chaining' ? Array.from({ length: size }, () => []) : new Array(size).fill(null),
    collisions: 0,
    count: 0,
  };
}

const hashKey = (key, size) => ((Math.trunc(Number(key)) % size) + size) % size;

export function hashInsert(tbl, key) {
  const k = Math.trunc(Number(key));
  const idx0 = hashKey(k, tbl.size);
  const probes = [idx0];
  if (tbl.mode === 'chaining') {
    const buckets = tbl.buckets.map(b => b.slice());
    if (buckets[idx0].includes(k)) return { tbl, idx: idx0, probes, collision: false, dup: true, full: false };
    const collision = buckets[idx0].length > 0;
    buckets[idx0].push(k);
    return {
      tbl: { ...tbl, buckets, collisions: tbl.collisions + (collision ? 1 : 0), count: tbl.count + 1 },
      idx: idx0, probes, collision, dup: false, full: false,
    };
  }
  // Linear probing
  const buckets = tbl.buckets.slice();
  let firstTomb = -1;
  for (let step = 0; step < tbl.size; step++) {
    const idx = (idx0 + step) % tbl.size;
    if (step > 0) probes.push(idx);
    const slot = buckets[idx];
    if (slot === k) return { tbl, idx, probes, collision: false, dup: true, full: false };
    if (slot === 'DEL' && firstTomb < 0) firstTomb = idx;
    if (slot === null) {
      const target = firstTomb >= 0 ? firstTomb : idx;
      buckets[target] = k;
      const collision = step > 0;
      return {
        tbl: { ...tbl, buckets, collisions: tbl.collisions + (collision ? 1 : 0), count: tbl.count + 1 },
        idx: target, probes, collision, dup: false, full: false,
      };
    }
  }
  if (firstTomb >= 0) {
    buckets[firstTomb] = k;
    return {
      tbl: { ...tbl, buckets, collisions: tbl.collisions + 1, count: tbl.count + 1 },
      idx: firstTomb, probes, collision: true, dup: false, full: false,
    };
  }
  return { tbl, idx: -1, probes, collision: true, dup: false, full: true };
}

export function hashSearch(tbl, key) {
  const k = Math.trunc(Number(key));
  const idx0 = hashKey(k, tbl.size);
  const probes = [idx0];
  if (tbl.mode === 'chaining') {
    const found = tbl.buckets[idx0].includes(k);
    return { found, idx: found ? idx0 : -1, probes };
  }
  for (let step = 0; step < tbl.size; step++) {
    const idx = (idx0 + step) % tbl.size;
    if (step > 0) probes.push(idx);
    if (tbl.buckets[idx] === k) return { found: true, idx, probes };
    if (tbl.buckets[idx] === null) return { found: false, idx: -1, probes };
  }
  return { found: false, idx: -1, probes };
}

export function hashDelete(tbl, key) {
  const k = Math.trunc(Number(key));
  const idx0 = hashKey(k, tbl.size);
  const probes = [idx0];
  if (tbl.mode === 'chaining') {
    const buckets = tbl.buckets.map(b => b.slice());
    const pos = buckets[idx0].indexOf(k);
    if (pos < 0) return { tbl, removed: false, probes };
    buckets[idx0].splice(pos, 1);
    return { tbl: { ...tbl, buckets, count: tbl.count - 1 }, removed: true, probes };
  }
  const buckets = tbl.buckets.slice();
  for (let step = 0; step < tbl.size; step++) {
    const idx = (idx0 + step) % tbl.size;
    if (step > 0) probes.push(idx);
    if (buckets[idx] === k) {
      buckets[idx] = 'DEL';
      return { tbl: { ...tbl, buckets, count: tbl.count - 1 }, removed: true, probes };
    }
    if (buckets[idx] === null) break;
  }
  return { tbl, removed: false, probes };
}

// ---------- 1.4 Operating Systems (CPU, Page Replacement, Banker's) ----------

export function scheduleCPU(processes, { algo = 'FCFS', quantum = 2 } = {}) {
  const procs = processes.map((p, i) => ({
    pid: p.pid || `P${i + 1}`,
    arrival: Math.max(0, Math.round(p.arrival)),
    burst: Math.max(1, Math.round(p.burst)),
    priority: Math.round(p.priority ?? 1),
    rem: Math.max(1, Math.round(p.burst)),
    firstStart: -1,
    ct: 0,
    order: i,
  }));
  if (!procs.length) return { gantt: [], metrics: [], avgWT: 0, avgTAT: 0, avgRT: 0, cpuUtil: 0, makespan: 0 };

  const gantt = [];
  const pushSlice = (pid, start, end) => {
    if (end <= start) return;
    const prev = gantt[gantt.length - 1];
    if (prev && prev.pid === pid && prev.end === start) prev.end = end;
    else gantt.push({ pid, start, end });
  };

  let t = 0;
  let done = 0;
  const n = procs.length;

  if (algo === 'FCFS' || algo === 'SJF' || algo === 'PRIORITY') {
    while (done < n) {
      const ready = procs.filter(p => p.rem > 0 && p.arrival <= t);
      if (!ready.length) {
        const nextArr = Math.min(...procs.filter(p => p.rem > 0).map(p => p.arrival));
        pushSlice('IDLE', t, nextArr);
        t = nextArr;
        continue;
      }
      ready.sort((a, b) => {
        if (algo === 'SJF') return (a.burst - b.burst) || (a.arrival - b.arrival) || (a.order - b.order);
        if (algo === 'PRIORITY') return (a.priority - b.priority) || (a.arrival - b.arrival) || (a.order - b.order);
        return (a.arrival - b.arrival) || (a.order - b.order);
      });
      const cur = ready[0];
      cur.firstStart = t;
      pushSlice(cur.pid, t, t + cur.rem);
      t += cur.rem;
      cur.rem = 0;
      cur.ct = t;
      done++;
    }
  } else if (algo === 'SRTF' || algo === 'PRIORITY_P') {
    while (done < n) {
      const ready = procs.filter(p => p.rem > 0 && p.arrival <= t);
      if (!ready.length) {
        const nextArr = Math.min(...procs.filter(p => p.rem > 0).map(p => p.arrival));
        pushSlice('IDLE', t, nextArr);
        t = nextArr;
        continue;
      }
      ready.sort((a, b) => {
        if (algo === 'SRTF') return (a.rem - b.rem) || (a.arrival - b.arrival) || (a.order - b.order);
        return (a.priority - b.priority) || (a.arrival - b.arrival) || (a.order - b.order);
      });
      const cur = ready[0];
      if (cur.firstStart < 0) cur.firstStart = t;
      pushSlice(cur.pid, t, t + 1);
      t++;
      cur.rem--;
      if (cur.rem === 0) { cur.ct = t; done++; }
    }
  } else if (algo === 'RR') {
    const q = Math.max(1, Math.round(quantum));
    const sorted = procs.slice().sort((a, b) => (a.arrival - b.arrival) || (a.order - b.order));
    const queue = [];
    let idx = 0;
    const enqueueArrivals = upTo => {
      while (idx < n && sorted[idx].arrival <= upTo) {
        queue.push(sorted[idx++]);
      }
    };
    enqueueArrivals(0);
    while (done < n) {
      if (!queue.length) {
        const nextArr = sorted[idx].arrival;
        pushSlice('IDLE', t, nextArr);
        t = nextArr;
        enqueueArrivals(t);
      }
      const cur = queue.shift();
      if (cur.firstStart < 0) cur.firstStart = t;
      const run = Math.min(q, cur.rem);
      pushSlice(cur.pid, t, t + run);
      t += run;
      cur.rem -= run;
      enqueueArrivals(t);
      if (cur.rem > 0) queue.push(cur);
      else { cur.ct = t; done++; }
    }
  }

  const metrics = procs.map(p => {
    const tat = p.ct - p.arrival;
    const wt = tat - p.burst;
    const rt = p.firstStart - p.arrival;
    return { pid: p.pid, arrival: p.arrival, burst: p.burst, priority: p.priority, ct: p.ct, tat, wt, rt };
  });
  const totalBurst = metrics.reduce((s, m) => s + m.burst, 0);
  const avgWT = metrics.reduce((s, m) => s + m.wt, 0) / n;
  const avgTAT = metrics.reduce((s, m) => s + m.tat, 0) / n;
  const avgRT = metrics.reduce((s, m) => s + m.rt, 0) / n;
  const makespan = t;
  const cpuUtil = makespan > 0 ? (totalBurst / makespan) * 100 : 0;
  return { gantt, metrics, avgWT, avgTAT, avgRT, cpuUtil, makespan };
}

export function simulatePageReplacement(refs, frameCount = 3, algo = 'LRU') {
  const cap = Math.max(1, Math.min(10, Math.round(frameCount)));
  const frames = [];
  const lastUsed = new Map();
  let fifoPtr = 0;
  let faults = 0, hits = 0;
  const steps = [];

  for (let i = 0; i < refs.length; i++) {
    const page = refs[i];
    const hitIdx = frames.indexOf(page);
    let victim = null;
    if (hitIdx >= 0) {
      hits++;
      lastUsed.set(page, i);
      steps.push({ step: i + 1, page, frames: frames.slice(), hit: true, victim });
    } else {
      faults++;
      if (frames.length < cap) {
        frames.push(page);
      } else if (algo === 'FIFO') {
        victim = frames[fifoPtr];
        frames[fifoPtr] = page;
        fifoPtr = (fifoPtr + 1) % cap;
      } else if (algo === 'LRU') {
        let lruSlot = 0, oldest = Infinity;
        for (let s = 0; s < frames.length; s++) {
          const u = lastUsed.get(frames[s]) ?? -1;
          if (u < oldest) { oldest = u; lruSlot = s; }
        }
        victim = frames[lruSlot];
        frames[lruSlot] = page;
      } else if (algo === 'OPT') {
        let optSlot = 0, farthest = -1;
        for (let s = 0; s < frames.length; s++) {
          const nxt = refs.indexOf(frames[s], i + 1);
          const dist = nxt < 0 ? Infinity : nxt;
          if (dist > farthest) { farthest = dist; optSlot = s; }
        }
        victim = frames[optSlot];
        frames[optSlot] = page;
      }
      lastUsed.set(page, i);
      steps.push({ step: i + 1, page, frames: frames.slice(), hit: false, victim });
    }
  }
  const total = refs.length || 1;
  return { steps, faults, hits, hitRate: hits / total, faultRate: faults / total };
}

export function bankersSafety({ available, max, allocation }) {
  const n = allocation.length;
  const m = available.length;
  const need = Array.from({ length: n }, (_, i) => Array.from({ length: m }, (__, j) => max[i][j] - allocation[i][j]));
  const work = available.slice();
  const finish = new Array(n).fill(false);
  const sequence = [];
  const steps = [];

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let i = 0; i < n; i++) {
      if (finish[i]) continue;
      if (need[i].every((val, j) => val <= work[j])) {
        const workBefore = work.slice();
        for (let j = 0; j < m; j++) work[j] += allocation[i][j];
        finish[i] = true;
        sequence.push(i);
        steps.push({ pid: i, workBefore, need: need[i].slice(), workAfter: work.slice() });
        progressed = true;
      }
    }
  }
  return { safe: sequence.length === n, sequence, need, steps };
}

export function bankersRequest({ available, max, allocation, pid, request }) {
  const m = available.length;
  const needI = Array.from({ length: m }, (_, j) => max[pid][j] - allocation[pid][j]);
  for (let j = 0; j < m; j++) {
    if (request[j] > needI[j]) return { granted: false, reason: `İstek P${pid} için kalan Need[${j}] = ${needI[j]} değerini aşıyor.`, safety: null };
    if (request[j] > available[j]) return { granted: false, reason: `Yetersiz kaynak: Available[${j}] = ${available[j]} < ${request[j]}.`, safety: null };
  }
  const newAvail = available.map((v, j) => v - request[j]);
  const newAlloc = allocation.map((row, i) => (i === pid ? row.map((v, j) => v + request[j]) : row.slice()));
  const safety = bankersSafety({ available: newAvail, max, allocation: newAlloc });
  return {
    granted: safety.safe,
    reason: safety.safe
      ? `Güvenli durum korundu (sıra: ${safety.sequence.map(i => `P${i}`).join(' → ')}).`
      : 'Bu istek güvenli olmayan (deadlock riskli) duruma yol açar; reddedildi!',
    safety,
    newAvailable: newAvail,
    newAllocation: newAlloc,
  };
}

// ---------- 1.5 Computer Architecture (Cache, Pipeline, IEEE 754, Bases) ----------

export function simulateCache({ trace, cacheBytes = 256, blockBytes = 16, associativity = 1 }) {
  const numBlocks = Math.max(1, Math.floor(cacheBytes / blockBytes));
  const ways = associativity <= 0 ? numBlocks : Math.min(numBlocks, associativity);
  const numSets = Math.max(1, Math.floor(numBlocks / ways));
  const offsetBits = Math.round(Math.log2(blockBytes));
  const indexBits = Math.round(Math.log2(numSets));
  const tagBits = Math.max(0, 32 - offsetBits - indexBits);

  const sets = Array.from({ length: numSets }, () =>
    Array.from({ length: ways }, () => ({ valid: false, tag: 0, lastUsed: -1 }))
  );

  let hits = 0, misses = 0;
  const log = [];
  for (let t = 0; t < trace.length; t++) {
    const addr = (trace[t] >>> 0);
    const offset = addr & (blockBytes - 1);
    const blockAddr = addr >>> offsetBits;
    const setIdx = numSets > 1 ? (blockAddr & (numSets - 1)) : 0;
    const tag = blockAddr >>> indexBits;
    const set = sets[setIdx];
    const hitWay = set.findIndex(w => w.valid && w.tag === tag);
    if (hitWay >= 0) {
      hits++;
      set[hitWay].lastUsed = t;
      log.push({ step: t + 1, addr, tag, setIdx, offset, hit: true, way: hitWay, evictedTag: null });
    } else {
      misses++;
      let victimWay = set.findIndex(w => !w.valid);
      let evictedTag = null;
      if (victimWay < 0) {
        victimWay = 0;
        for (let w = 1; w < ways; w++) {
          if (set[w].lastUsed < set[victimWay].lastUsed) victimWay = w;
        }
        evictedTag = set[victimWay].tag;
      }
      set[victimWay] = { valid: true, tag, lastUsed: t };
      log.push({ step: t + 1, addr, tag, setIdx, offset, hit: false, way: victimWay, evictedTag });
    }
  }
  const total = trace.length || 1;
  return { hits, misses, hitRate: hits / total, offsetBits, indexBits, tagBits, numSets, ways, log, sets };
}

export function simulatePipeline(instructions, { forwarding = true } = {}) {
  const n = instructions.length;
  const diagram = [];
  const hazards = [];
  let prevIF = 0;
  let totalStalls = 0;
  // Track when each register's value becomes available (forwarding: EX for ALU, MEM for LW; no forwarding: WB)
  const regReadyAt = new Map();
  const regProducer = new Map();

  for (let i = 0; i < n; i++) {
    const ins = instructions[i];
    const isBranchPrev = i > 0 && instructions[i - 1].op === 'BEQ';
    const ifCycle = Math.max(i === 0 ? 1 : prevIF + 1, isBranchPrev ? prevIF + 2 : 1);
    if (isBranchPrev && ifCycle > prevIF + 1) {
      totalStalls += ifCycle - (prevIF + 1);
      hazards.push({ type: 'Kontrol (Dallanma)', fromIdx: i - 1, toIdx: i, reg: 'PC', forwarded: false, stalls: 1 });
    }
    let idCycle = ifCycle + 1;
    const sources = [ins.rs1, ins.rs2].filter(r => r && r !== '$0');
    let stall = 0;
    for (const r of sources) {
      const prod = regProducer.get(r);
      const ready = regReadyAt.get(r);
      if (ready !== undefined) {
        if (forwarding) {
          // EX needs value at start of exCycle = idCycle + 1; forwarding delivers at end of producer's ready cycle
          const needBy = idCycle + 1;
          if (ready >= needBy) {
            const s = ready - needBy + 1;
            if (s > stall) stall = s;
            hazards.push({ type: 'Load-Use (RAW)', fromIdx: prod.idx, toIdx: i, reg: r, forwarded: true, stalls: s });
          } else if (prod && prod.idx >= i - 2) {
            hazards.push({ type: 'RAW İletme (Forwarding)', fromIdx: prod.idx, toIdx: i, reg: r, forwarded: true, stalls: 0 });
          }
        } else {
          // Without forwarding, ID reads register file at end of producer's WB (assuming WB-first/ID-second split cycle)
          if (ready > idCycle) {
            const s = ready - idCycle;
            if (s > stall) stall = s;
            hazards.push({ type: 'Veri (RAW)', fromIdx: prod.idx, toIdx: i, reg: r, forwarded: false, stalls: s });
          }
        }
      }
    }
    totalStalls += stall;
    const exCycle = idCycle + 1 + stall;
    const memCycle = exCycle + 1;
    const wbCycle = memCycle + 1;
    prevIF = ifCycle + stall;

    const stages = {};
    stages[ifCycle] = 'IF';
    stages[idCycle] = 'ID';
    for (let s = 1; s <= stall; s++) stages[idCycle + s] = 'STALL';
    stages[exCycle] = 'EX';
    stages[memCycle] = 'MEM';
    stages[wbCycle] = 'WB';
    diagram.push({ text: ins.text || `${ins.op} ${ins.rd || ''}`, stages, ifCycle, wbCycle, stall });

    if (ins.rd && ins.rd !== '$0' && ins.op !== 'SW' && ins.op !== 'BEQ') {
      const availCycle = forwarding ? (ins.op === 'LW' ? memCycle : exCycle) : wbCycle;
      regReadyAt.set(ins.rd, availCycle);
      regProducer.set(ins.rd, { idx: i, op: ins.op });
    }
  }
  const totalCycles = diagram.length ? Math.max(...diagram.map(d => d.wbCycle)) : 0;
  const cpi = n > 0 ? totalCycles / n : 0;
  return { totalCycles, stalls: totalStalls, cpi, diagram, hazards };
}

export function floatToIEEE754(num) {
  const buf = new ArrayBuffer(4);
  const dv = new DataView(buf);
  dv.setFloat32(0, Number(num), false);
  const u32 = dv.getUint32(0, false);
  const bits = u32.toString(2).padStart(32, '0');
  return ieee754BitsToFloat(bits);
}

export function ieee754BitsToFloat(bitsInput) {
  const bits = String(bitsInput).replace(/[^01]/g, '').padEnd(32, '0').slice(0, 32);
  const u32 = parseInt(bits, 2) >>> 0;
  const buf = new ArrayBuffer(4);
  const dv = new DataView(buf);
  dv.setUint32(0, u32, false);
  const value = dv.getFloat32(0, false);
  const sign = bits[0] === '1' ? 1 : 0;
  const expBits = bits.slice(1, 9);
  const fracBits = bits.slice(9, 32);
  const expRaw = parseInt(expBits, 2);
  const fracRaw = parseInt(fracBits, 2);
  let kind = 'normal';
  let expUnbiased = expRaw - 127;
  let mantissa = 1 + fracRaw / Math.pow(2, 23);
  if (expRaw === 0 && fracRaw === 0) {
    kind = 'zero'; expUnbiased = 0; mantissa = 0;
  } else if (expRaw === 0) {
    kind = 'subnormal'; expUnbiased = -126; mantissa = fracRaw / Math.pow(2, 23);
  } else if (expRaw === 255 && fracRaw === 0) {
    kind = 'infinity'; expUnbiased = 128; mantissa = 1;
  } else if (expRaw === 255) {
    kind = 'nan'; expUnbiased = 128; mantissa = NaN;
  }
  const hex = '0x' + u32.toString(16).toUpperCase().padStart(8, '0');
  return { bits, sign, expBits, fracBits, expRaw, expUnbiased, fracRaw, mantissa, kind, value, hex };
}

export function convertNumberBase(rawStr, fromBase = 10, bits = 8) {
  const s = String(rawStr ?? '').trim().replace(/\s+/g, '');
  if (!s) return { ok: false, error: 'Sayı giriniz.' };
  const neg = s.startsWith('-');
  const clean = s.replace(/^[+-]/, '');
  const validRe = fromBase === 2 ? /^[01]+$/ : fromBase === 8 ? /^[0-7]+$/ : fromBase === 10 ? /^[0-9]+$/ : /^[0-9a-fA-F]+$/;
  if (!validRe.test(clean)) return { ok: false, error: `Taban ${fromBase} için geçersiz rakam.` };
  let val = parseInt(clean, fromBase);
  if (neg) val = -val;
  if (!Number.isSafeInteger(val)) return { ok: false, error: 'Sayı taşma sınırında.' };

  const mask = (1 << bits) - 1;
  const minS = -(1 << (bits - 1));
  const maxS = (1 << (bits - 1)) - 1;
  const maxU = (1 << bits) - 1;
  const overflowSigned = val < minS || val > maxS;
  const wrapped = val & mask;
  const twosBin = wrapped.toString(2).padStart(bits, '0');
  const signedVal = (wrapped & (1 << (bits - 1))) ? wrapped - (1 << bits) : wrapped;
  const absClamped = Math.min((1 << (bits - 1)) - 1, Math.abs(val));
  const signMagBin = (val < 0 ? '1' : '0') + absClamped.toString(2).padStart(bits - 1, '0');
  const onesBin = val >= 0
    ? (val & mask).toString(2).padStart(bits, '0')
    : ((~Math.abs(val)) & mask).toString(2).padStart(bits, '0');

  return {
    ok: true,
    value: val,
    bin: (val < 0 ? '-' : '') + Math.abs(val).toString(2),
    oct: (val < 0 ? '-' : '') + Math.abs(val).toString(8),
    dec: String(val),
    hex: (val < 0 ? '-' : '') + Math.abs(val).toString(16).toUpperCase(),
    bits,
    twosBin,
    onesBin,
    signMagBin,
    signedVal,
    unsignedVal: wrapped,
    minS,
    maxS,
    maxU,
    overflowSigned,
  };
}

// ---------- 1.6 Automata & Turing Machine ----------

export function epsilonClosure(aut, stateSet) {
  const closed = new Set(stateSet);
  const stack = [...closed];
  while (stack.length) {
    const s = stack.pop();
    for (const tr of aut.transitions) {
      if (tr.from === s && (tr.sym === '' || tr.sym === 'ε')) {
        if (!closed.has(tr.to)) { closed.add(tr.to); stack.push(tr.to); }
      }
    }
  }
  return closed;
}

export function runAutomaton(aut, input) {
  const str = String(input ?? '');
  let cur = epsilonClosure(aut, [aut.start]);
  const trace = [{ index: 0, char: 'ε', states: [...cur].sort() }];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = new Set();
    for (const s of cur) {
      for (const tr of aut.transitions) {
        if (tr.from === s && tr.sym === ch) next.add(tr.to);
      }
    }
    cur = epsilonClosure(aut, next);
    trace.push({ index: i + 1, char: ch, states: [...cur].sort() });
  }
  const acceptSet = new Set(aut.accepts);
  const accepted = [...cur].some(s => acceptSet.has(s));
  return { accepted, trace, finalStates: [...cur].sort() };
}

export function nfaToDfa(nfa) {
  const alpha = nfa.alphabet.filter(s => s && s !== 'ε');
  const startSet = [...epsilonClosure(nfa, [nfa.start])].sort();
  const keyOf = arr => (arr.length ? `{${arr.join(',')}}` : '∅');
  const startKey = keyOf(startSet);
  const acceptSet = new Set(nfa.accepts);

  const states = [startKey];
  const subsetMap = { [startKey]: startSet };
  const transitions = [];
  const accepts = [];
  const queue = [startKey];
  const seen = new Set([startKey]);

  while (queue.length && states.length < 32) {
    const k = queue.shift();
    const subset = subsetMap[k];
    if (subset.some(s => acceptSet.has(s))) accepts.push(k);
    for (const sym of alpha) {
      const move = new Set();
      for (const s of subset) {
        for (const tr of nfa.transitions) {
          if (tr.from === s && tr.sym === sym) move.add(tr.to);
        }
      }
      const nextSet = [...epsilonClosure(nfa, move)].sort();
      const nk = keyOf(nextSet);
      if (!seen.has(nk)) {
        seen.add(nk);
        states.push(nk);
        subsetMap[nk] = nextSet;
        queue.push(nk);
      }
      transitions.push({ from: k, sym, to: nk });
    }
  }
  return { states, alphabet: alpha, start: startKey, accepts, transitions, subsetMap };
}

export function regexToNfa(pattern) {
  const raw = String(pattern ?? '').replace(/\s+/g, '');
  if (!raw) return { ok: false, error: 'Düzenli ifade boş.' };
  const isLit = ch => /[a-zA-Z0-9ε]/.test(ch);
  // Insert explicit concatenation operator '.'
  let explicit = '';
  for (let i = 0; i < raw.length; i++) {
    const c1 = raw[i], c2 = raw[i + 1];
    explicit += c1;
    if (!c2) continue;
    const leftEnds = isLit(c1) || c1 === ')' || c1 === '*' || c1 === '+' || c1 === '?';
    const rightStarts = isLit(c2) || c2 === '(';
    if (leftEnds && rightStarts) explicit += '.';
  }
  // Shunting-yard to postfix
  const prec = { '|': 1, '.': 2, '?': 3, '*': 3, '+': 3 };
  const out = [], ops = [];
  for (const ch of explicit) {
    if (isLit(ch)) out.push(ch);
    else if (ch === '(') ops.push(ch);
    else if (ch === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      if (!ops.length) return { ok: false, error: 'Eşleşmeyen parantez.' };
      ops.pop();
    } else if (ch in prec) {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[ch]) {
        out.push(ops.pop());
      }
      ops.push(ch);
    } else {
      return { ok: false, error: `Desteklenmeyen karakter: "${ch}"` };
    }
  }
  while (ops.length) {
    const top = ops.pop();
    if (top === '(') return { ok: false, error: 'Kapanmamış parantez.' };
    out.push(top);
  }

  let sid = 0;
  const newState = () => `q${sid++}`;
  const transitions = [];
  const alphaSet = new Set();
  const stack = [];

  for (const tok of out) {
    if (isLit(tok)) {
      const s = newState(), e = newState();
      const sym = tok === 'ε' ? '' : tok;
      if (sym) alphaSet.add(sym);
      transitions.push({ from: s, sym, to: e });
      stack.push({ start: s, end: e });
    } else if (tok === '.') {
      if (stack.length < 2) return { ok: false, error: 'Geçersiz birleştirme.' };
      const b = stack.pop(), a = stack.pop();
      transitions.push({ from: a.end, sym: '', to: b.start });
      stack.push({ start: a.start, end: b.end });
    } else if (tok === '|') {
      if (stack.length < 2) return { ok: false, error: 'Geçersiz | işlemi.' };
      const b = stack.pop(), a = stack.pop();
      const s = newState(), e = newState();
      transitions.push({ from: s, sym: '', to: a.start }, { from: s, sym: '', to: b.start });
      transitions.push({ from: a.end, sym: '', to: e }, { from: b.end, sym: '', to: e });
      stack.push({ start: s, end: e });
    } else if (tok === '*' || tok === '+' || tok === '?') {
      if (!stack.length) return { ok: false, error: `Geçersiz ${tok} işlemi.` };
      const a = stack.pop();
      const s = newState(), e = newState();
      transitions.push({ from: s, sym: '', to: a.start }, { from: a.end, sym: '', to: e });
      if (tok === '*' || tok === '?') transitions.push({ from: s, sym: '', to: e });
      if (tok === '*' || tok === '+') transitions.push({ from: a.end, sym: '', to: a.start });
      stack.push({ start: s, end: e });
    }
  }
  if (stack.length !== 1) return { ok: false, error: 'İfade ayrıştırılamadı.' };
  const frag = stack[0];
  const states = Array.from({ length: sid }, (_, i) => `q${i}`);
  return {
    ok: true,
    postfix: out.join(''),
    nfa: { states, alphabet: [...alphaSet].sort(), start: frag.start, accepts: [frag.end], transitions },
  };
}

export const TM_PRESETS = {
  'bin-inc': {
    label: 'İkili Artırma (+1)',
    desc: 'İkili sayıyı 1 artırır (ör. 1011 → 1100).',
    defaultInput: '1011',
    blank: '_',
    start: 'right',
    accept: 'HALT',
    rules: {
      'right,0': ['right', '0', 'R'],
      'right,1': ['right', '1', 'R'],
      'right,_': ['carry', '_', 'L'],
      'carry,1': ['carry', '0', 'L'],
      'carry,0': ['HALT', '1', 'S'],
      'carry,_': ['HALT', '1', 'S'],
    },
  },
  anbn: {
    label: '0ⁿ1ⁿ Tanıyıcı',
    desc: 'Eşit sayıda 0 ardından aynı sayıda 1 içeren dizileri kabul eder.',
    defaultInput: '0011',
    blank: '_',
    start: 'q0',
    accept: 'ACCEPT',
    rules: {
      'q0,0': ['q1', 'X', 'R'],
      'q0,Y': ['q3', 'Y', 'R'],
      'q0,_': ['ACCEPT', '_', 'S'],
      'q1,0': ['q1', '0', 'R'],
      'q1,Y': ['q1', 'Y', 'R'],
      'q1,1': ['q2', 'Y', 'L'],
      'q2,0': ['q2', '0', 'L'],
      'q2,Y': ['q2', 'Y', 'L'],
      'q2,X': ['q0', 'X', 'R'],
      'q3,Y': ['q3', 'Y', 'R'],
      'q3,_': ['ACCEPT', '_', 'S'],
    },
  },
  palindrome: {
    label: 'Palindrom ({a,b}*)',
    desc: 'Baştan ve sondan okunuşu aynı dizileri (ör. abba) kabul eder.',
    defaultInput: 'abba',
    blank: '_',
    start: 'q0',
    accept: 'ACCEPT',
    rules: {
      'q0,a': ['findA', '_', 'R'],
      'q0,b': ['findB', '_', 'R'],
      'q0,_': ['ACCEPT', '_', 'S'],
      'findA,a': ['findA', 'a', 'R'],
      'findA,b': ['findA', 'b', 'R'],
      'findA,_': ['checkA', '_', 'L'],
      'checkA,a': ['back', '_', 'L'],
      'checkA,_': ['ACCEPT', '_', 'S'],
      'findB,a': ['findB', 'a', 'R'],
      'findB,b': ['findB', 'b', 'R'],
      'findB,_': ['checkB', '_', 'L'],
      'checkB,b': ['back', '_', 'L'],
      'checkB,_': ['ACCEPT', '_', 'S'],
      'back,a': ['back', 'a', 'L'],
      'back,b': ['back', 'b', 'L'],
      'back,_': ['q0', '_', 'R'],
    },
  },
  parity: {
    label: 'Çift Eşlik (Even Parity)',
    desc: 'İkili dizide çift sayıda 1 varsa kabul eder.',
    defaultInput: '101101',
    blank: '_',
    start: 'even',
    accept: 'ACCEPT',
    rules: {
      'even,0': ['even', '0', 'R'],
      'even,1': ['odd', '1', 'R'],
      'even,_': ['ACCEPT', '_', 'S'],
      'odd,0': ['odd', '0', 'R'],
      'odd,1': ['even', '1', 'R'],
    },
  },
};

export function createTMState(tm, input) {
  const tape = new Map();
  const s = String(input ?? '');
  for (let i = 0; i < s.length; i++) tape.set(i, s[i]);
  return { state: tm.start, head: 0, tape, steps: 0, status: 'running', lastRule: '' };
}

export function stepTM(tm, st) {
  if (st.status !== 'running') return st;
  const sym = st.tape.get(st.head) ?? tm.blank;
  const rule = tm.rules[`${st.state},${sym}`];
  if (!rule) {
    return { ...st, status: st.state === tm.accept ? 'accept' : 'reject', lastRule: `(${st.state}, ${sym}) → KURAL YOK` };
  }
  const [nextState, writeSym, dir] = rule;
  const tape = new Map(st.tape);
  if (writeSym === tm.blank) tape.delete(st.head);
  else tape.set(st.head, writeSym);
  const nextHead = st.head + (dir === 'R' ? 1 : dir === 'L' ? -1 : 0);
  const status = nextState === tm.accept ? 'accept' : 'running';
  return {
    state: nextState,
    head: nextHead,
    tape,
    steps: st.steps + 1,
    status,
    lastRule: `(${st.state}, ${sym}) → (${nextState}, ${writeSym}, ${dir})`,
  };
}

export function tmTapeString(tm, st) {
  if (!st.tape.size) return '';
  const keys = [...st.tape.keys()];
  const lo = Math.min(...keys), hi = Math.max(...keys);
  let out = '';
  for (let i = lo; i <= hi; i++) out += st.tape.get(i) ?? tm.blank;
  return out;
}

export function runTM(tm, input, maxSteps = 500) {
  let st = createTMState(tm, input);
  while (st.status === 'running' && st.steps < maxSteps) st = stepTM(tm, st);
  if (st.status === 'running') st = { ...st, status: 'timeout' };
  return { ...st, output: tmTapeString(tm, st) };
}

// ---------- 1.7 Neural Network (MLP), K-Means & Regression ----------

export function generate2DDataset(kind = 'xor', n = 120, seed = 42) {
  const rng = makeRng(seed);
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
  const pts = [];
  const half = Math.floor(n / 2);

  if (kind === 'xor') {
    for (let i = 0; i < n; i++) {
      const q = i % 4;
      const sx = (q === 0 || q === 3) ? 0.55 : -0.55;
      const sy = (q === 0 || q === 1) ? 0.55 : -0.55;
      const label = (sx * sy > 0) ? 1 : 0;
      pts.push({ x: sx + randn() * 0.22, y: sy + randn() * 0.22, label });
    }
  } else if (kind === 'circles') {
    for (let i = 0; i < n; i++) {
      const inner = i < half;
      const r = inner ? (0.1 + rng() * 0.35) : (0.68 + rng() * 0.25);
      const a = rng() * 2 * Math.PI;
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), label: inner ? 1 : 0 });
    }
  } else if (kind === 'spirals') {
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < half; i++) {
        const u = i / half;
        const r = 0.12 + 0.82 * u;
        const t = 1.75 * u * 2 * Math.PI + c * Math.PI;
        pts.push({
          x: r * Math.cos(t) + randn() * 0.055,
          y: r * Math.sin(t) + randn() * 0.055,
          label: c,
        });
      }
    }
  } else {
    // Gaussians (linearly separable)
    for (let i = 0; i < n; i++) {
      const c = i < half ? 1 : 0;
      const cx = c ? 0.48 : -0.48, cy = c ? 0.42 : -0.42;
      pts.push({ x: cx + randn() * 0.28, y: cy + randn() * 0.28, label: c });
    }
  }
  return pts;
}

const actFn = (kind, z) => (kind === 'relu' ? (z > 0 ? z : 0) : kind === 'sigmoid' ? 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z)))) : Math.tanh(z));
const actDeriv = (kind, z, a) => (kind === 'relu' ? (z > 0 ? 1 : 0) : kind === 'sigmoid' ? a * (1 - a) : 1 - a * a);
const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

export function createMLP(layerSizes = [2, 8, 6, 1], activation = 'tanh', seed = 7) {
  const rng = makeRng(seed);
  const layers = [];
  for (let l = 0; l < layerSizes.length - 1; l++) {
    const fanIn = layerSizes[l], fanOut = layerSizes[l + 1];
    const scale = Math.sqrt(2 / (fanIn + fanOut)) * (activation === 'relu' ? 1.25 : 1.0);
    const W = Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => (rng() * 2 - 1) * scale));
    const b = new Array(fanOut).fill(0);
    layers.push({ W, b });
  }
  return { layerSizes, activation, layers, epoch: 0 };
}

export function mlpForward(net, input) {
  let a = input;
  const zs = [], as = [a];
  const L = net.layers.length;
  for (let l = 0; l < L; l++) {
    const { W, b } = net.layers[l];
    const z = new Array(W.length);
    const nextA = new Array(W.length);
    const isOut = l === L - 1;
    for (let i = 0; i < W.length; i++) {
      let s = b[i];
      const row = W[i];
      for (let j = 0; j < row.length; j++) s += row[j] * a[j];
      z[i] = s;
      nextA[i] = isOut ? sigmoid(s) : actFn(net.activation, s);
    }
    zs.push(z);
    as.push(nextA);
    a = nextA;
  }
  return { prob: a[0], zs, as };
}

export function mlpTrainEpoch(net, data, lr = 0.2, l2 = 1e-4) {
  const L = net.layers.length;
  const gW = net.layers.map(lay => lay.W.map(r => new Array(r.length).fill(0)));
  const gb = net.layers.map(lay => new Array(lay.b.length).fill(0));
  let lossSum = 0, correct = 0;

  for (const pt of data) {
    const { prob, zs, as } = mlpForward(net, [pt.x, pt.y]);
    const p = Math.max(1e-7, Math.min(1 - 1e-7, prob));
    lossSum += -(pt.label * Math.log(p) + (1 - pt.label) * Math.log(1 - p));
    if ((prob >= 0.5 ? 1 : 0) === pt.label) correct++;

    // Binary cross-entropy + sigmoid output layer derivative: dL/dz = prob - label
    let delta = [prob - pt.label];
    for (let l = L - 1; l >= 0; l--) {
      const aPrev = as[l];
      const lay = net.layers[l];
      for (let i = 0; i < lay.W.length; i++) {
        gb[l][i] += delta[i];
        for (let j = 0; j < aPrev.length; j++) gW[l][i][j] += delta[i] * aPrev[j];
      }
      if (l > 0) {
        const nextDelta = new Array(aPrev.length).fill(0);
        for (let j = 0; j < aPrev.length; j++) {
          let s = 0;
          for (let i = 0; i < lay.W.length; i++) s += lay.W[i][j] * delta[i];
          nextDelta[j] = s * actDeriv(net.activation, zs[l - 1][j], as[l][j]);
        }
        delta = nextDelta;
      }
    }
  }

  const invN = 1 / Math.max(1, data.length);
  for (let l = 0; l < L; l++) {
    const lay = net.layers[l];
    for (let i = 0; i < lay.W.length; i++) {
      lay.b[i] -= lr * gb[l][i] * invN;
      for (let j = 0; j < lay.W[i].length; j++) {
        lay.W[i][j] -= lr * (gW[l][i][j] * invN + l2 * lay.W[i][j]);
      }
    }
  }
  net.epoch++;
  return { loss: lossSum * invN, acc: correct * invN, epoch: net.epoch };
}

export function kmeansInit(points, k = 3, seed = 13) {
  const rng = makeRng(seed);
  if (!points.length) return [];
  const centroids = [];
  // k-means++ initialization
  const first = points[Math.floor(rng() * points.length)];
  centroids.push({ x: first.x, y: first.y });
  while (centroids.length < Math.min(k, points.length)) {
    const dists = points.map(p => {
      let best = Infinity;
      for (const c of centroids) {
        const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (d2 < best) best = d2;
      }
      return best;
    });
    const sum = dists.reduce((s, v) => s + v, 0);
    if (sum <= 1e-12) {
      const p = points[centroids.length % points.length];
      centroids.push({ x: p.x, y: p.y });
      continue;
    }
    let r = rng() * sum, pick = points.length - 1;
    for (let i = 0; i < dists.length; i++) { r -= dists[i]; if (r <= 0) { pick = i; break; } }
    centroids.push({ x: points[pick].x, y: points[pick].y });
  }
  return centroids;
}

export function kmeansStep(points, centroids) {
  const k = centroids.length;
  const assignments = new Array(points.length).fill(0);
  let inertia = 0;
  for (let i = 0; i < points.length; i++) {
    let best = 0, bestD = Infinity;
    for (let c = 0; c < k; c++) {
      const d = (points[i].x - centroids[c].x) ** 2 + (points[i].y - centroids[c].y) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    assignments[i] = best;
    inertia += bestD;
  }
  const sumX = new Array(k).fill(0), sumY = new Array(k).fill(0), cnt = new Array(k).fill(0);
  for (let i = 0; i < points.length; i++) {
    const c = assignments[i];
    sumX[c] += points[i].x; sumY[c] += points[i].y; cnt[c]++;
  }
  let shift = 0;
  const next = centroids.map((c, j) => {
    if (!cnt[j]) return { ...c };
    const nx = sumX[j] / cnt[j], ny = sumY[j] / cnt[j];
    shift += Math.hypot(nx - c.x, ny - c.y);
    return { x: nx, y: ny };
  });
  return { assignments, centroids: next, inertia, converged: shift < 1e-6 };
}

export function linRegClosedForm(points) {
  const n = points.length;
  if (n < 2) return { w: 0, b: 0, mse: 0, r2: 0 };
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const w = den > 1e-12 ? num / den : 0;
  const b = my - w * mx;
  let sse = 0, sst = 0;
  for (const p of points) { sse += (p.y - (w * p.x + b)) ** 2; sst += (p.y - my) ** 2; }
  return { w, b, mse: sse / n, r2: sst > 1e-12 ? 1 - sse / sst : 1 };
}

export function linRegGradStep(points, { w, b }, lr = 0.08) {
  const n = Math.max(1, points.length);
  let gw = 0, gb = 0, mse = 0;
  for (const p of points) {
    const err = (w * p.x + b) - p.y;
    gw += (2 / n) * err * p.x;
    gb += (2 / n) * err;
    mse += (err * err) / n;
  }
  return { w: w - lr * gw, b: b - lr * gb, loss: mse };
}

export function logRegGradStep(points, { w1, w2, b }, lr = 0.25) {
  const n = Math.max(1, points.length);
  let g1 = 0, g2 = 0, gb = 0, loss = 0, ok = 0;
  for (const p of points) {
    const pr = sigmoid(w1 * p.x + w2 * p.y + b);
    const err = pr - p.label;
    g1 += err * p.x / n; g2 += err * p.y / n; gb += err / n;
    const pc = Math.max(1e-7, Math.min(1 - 1e-7, pr));
    loss += -(p.label * Math.log(pc) + (1 - p.label) * Math.log(1 - pc)) / n;
    if ((pr >= 0.5 ? 1 : 0) === p.label) ok++;
  }
  return { w1: w1 - lr * g1, w2: w2 - lr * g2, b: b - lr * gb, loss, acc: ok / n };
}

// ---------- 1.8 Cryptography & Sliding Window Protocol ----------

export function isPrime(n) {
  const v = Math.trunc(Number(n));
  if (v < 2) return false;
  if (v % 2 === 0) return v === 2;
  for (let d = 3; d * d <= v; d += 2) if (v % d === 0) return false;
  return true;
}

export function gcd(a, b) {
  let x = Math.abs(Math.trunc(a)), y = Math.abs(Math.trunc(b));
  while (y) { const t = x % y; x = y; y = t; }
  return x;
}

export function extendedGcd(a, b) {
  let oldR = a, r = b, oldS = 1, s = 0, oldT = 0, t = 1;
  while (r !== 0) {
    const q = Math.trunc(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { g: oldR, x: oldS, y: oldT };
}

export function modPow(base, exp, mod) {
  if (mod === 1) return 0;
  let b = BigInt(((base % mod) + mod) % mod);
  let e = BigInt(exp);
  const m = BigInt(mod);
  let res = 1n;
  while (e > 0n) {
    if (e & 1n) res = (res * b) % m;
    e >>= 1n;
    b = (b * b) % m;
  }
  return Number(res);
}

export function rsaKeygen(p, q, ePref = 17) {
  p = Math.trunc(p); q = Math.trunc(q);
  if (!isPrime(p) || !isPrime(q)) return { ok: false, error: 'p ve q asal sayı olmalıdır.' };
  if (p === q) return { ok: false, error: 'p ve q birbirinden farklı olmalıdır.' };
  const n = p * q;
  const phi = (p - 1) * (q - 1);
  let e = Math.trunc(ePref);
  if (!(e > 1 && e < phi && gcd(e, phi) === 1)) {
    e = 3;
    while (e < phi && gcd(e, phi) !== 1) e += 2;
  }
  if (e >= phi) return { ok: false, error: 'Uygun e bulunamadı.' };
  const { x } = extendedGcd(e, phi);
  const d = ((x % phi) + phi) % phi;
  return { ok: true, p, q, n, phi, e, d };
}

export function rsaEncryptNum(m, e, n) { return modPow(m, e, n); }
export function rsaDecryptNum(c, d, n) { return modPow(c, d, n); }

export function caesarCipher(text, shift = 3, decrypt = false) {
  const s = (((decrypt ? -shift : shift) % 26) + 26) % 26;
  return String(text ?? '').replace(/[A-Za-z]/g, ch => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + ((ch.charCodeAt(0) - base + s) % 26));
  });
}

export function vigenereCipher(text, key = 'MATHPAD', decrypt = false) {
  const k = String(key ?? '').toUpperCase().replace(/[^A-Z]/g, '') || 'A';
  let ki = 0;
  return String(text ?? '').replace(/[A-Za-z]/g, ch => {
    const base = ch <= 'Z' ? 65 : 97;
    const sh = k.charCodeAt(ki++ % k.length) - 65;
    const delta = decrypt ? (26 - sh) : sh;
    return String.fromCharCode(base + ((ch.charCodeAt(0) - base + delta) % 26));
  });
}

export function letterFrequencies(text) {
  const counts = new Array(26).fill(0);
  let total = 0;
  for (const ch of String(text ?? '').toUpperCase()) {
    const code = ch.charCodeAt(0) - 65;
    if (code >= 0 && code < 26) { counts[code]++; total++; }
  }
  return { counts, total };
}

export function createSlidingWindow({ protocol = 'gbn', windowSize = 4, totalPackets = 12, oneWayTime = 1.2, timeout = 3.2, lossProb = 0, seed = 9 }) {
  return {
    protocol,
    windowSize,
    totalPackets,
    oneWayTime,
    timeout,
    lossProb,
    rng: makeRng(seed),
    time: 0,
    base: 0,
    nextSeq: 0,
    rcvExpected: 0,
    rcvBuf: new Set(),
    ackedSet: new Set(),
    pktTimers: new Map(),
    gbnTimer: null,
    flights: [], // { id, seq, kind: 'DATA'|'ACK', progress, lost }
    nextFlightId: 1,
    sendCooldown: 0,
    sentCount: 0,
    retransCount: 0,
    lostCount: 0,
    log: [],
    done: false,
  };
}

export function dropInFlight(sim, flightId) {
  const f = sim.flights.find(x => x.id === flightId && !x.lost);
  if (!f) return false;
  f.lost = true;
  sim.lostCount++;
  sim.log.unshift(`t=${sim.time.toFixed(1)}s · ${f.kind} #${f.seq} manuel düşürüldü!`);
  if (sim.log.length > 14) sim.log.pop();
  return true;
}

export function stepSlidingWindow(sim, dt) {
  if (sim.done) return sim;
  sim.time += dt;
  sim.sendCooldown = Math.max(0, sim.sendCooldown - dt);

  const emitData = (seq, isRetrans = false) => {
    const lost = sim.lossProb > 0 && sim.rng() < sim.lossProb;
    if (lost) sim.lostCount++;
    sim.flights.push({ id: sim.nextFlightId++, seq, kind: 'DATA', progress: 0, lost });
    sim.sentCount++;
    if (isRetrans) sim.retransCount++;
    if (sim.protocol === 'gbn') {
      if (sim.gbnTimer === null) sim.gbnTimer = sim.time;
    } else {
      sim.pktTimers.set(seq, sim.time);
    }
    sim.log.unshift(`t=${sim.time.toFixed(1)}s · ${isRetrans ? 'Tekrar' : 'Gönder'} DATA #${seq}${lost ? ' (KAYIP)' : ''}`);
    if (sim.log.length > 14) sim.log.pop();
  };

  // Send new packets inside window
  if (sim.sendCooldown <= 0 && sim.nextSeq < sim.base + sim.windowSize && sim.nextSeq < sim.totalPackets) {
    emitData(sim.nextSeq, false);
    sim.nextSeq++;
    sim.sendCooldown = 0.42;
  }

  // Advance flights
  const remaining = [];
  for (const f of sim.flights) {
    f.progress += dt / sim.oneWayTime;
    if (f.lost && f.progress >= 0.5) continue; // disappears mid-channel
    if (f.progress < 1) { remaining.push(f); continue; }
    // Delivered!
    if (f.kind === 'DATA') {
      if (sim.protocol === 'gbn') {
        if (f.seq === sim.rcvExpected) {
          sim.rcvExpected++;
          sim.flights.push({ id: sim.nextFlightId++, seq: f.seq, kind: 'ACK', progress: 0, lost: false });
        } else if (sim.rcvExpected > 0) {
          // Cumulative duplicate ACK
          sim.flights.push({ id: sim.nextFlightId++, seq: sim.rcvExpected - 1, kind: 'ACK', progress: 0, lost: false });
        }
      } else {
        // Selective Repeat
        if (f.seq >= sim.rcvExpected && f.seq < sim.rcvExpected + sim.windowSize) {
          sim.rcvBuf.add(f.seq);
          while (sim.rcvBuf.has(sim.rcvExpected)) { sim.rcvBuf.delete(sim.rcvExpected); sim.rcvExpected++; }
        }
        sim.flights.push({ id: sim.nextFlightId++, seq: f.seq, kind: 'ACK', progress: 0, lost: false });
      }
    } else {
      // ACK arrived at sender
      if (sim.protocol === 'gbn') {
        if (f.seq >= sim.base) {
          for (let k = sim.base; k <= f.seq; k++) sim.ackedSet.add(k);
          sim.base = f.seq + 1;
          sim.gbnTimer = sim.base === sim.nextSeq ? null : sim.time;
        }
      } else {
        sim.ackedSet.add(f.seq);
        sim.pktTimers.delete(f.seq);
        while (sim.ackedSet.has(sim.base) && sim.base < sim.totalPackets) sim.base++;
      }
    }
  }
  sim.flights = remaining;

  // Check timeouts
  if (sim.protocol === 'gbn') {
    if (sim.gbnTimer !== null && sim.time - sim.gbnTimer >= sim.timeout) {
      sim.log.unshift(`t=${sim.time.toFixed(1)}s · ZAMAN AŞIMI! GBN #${sim.base}..#${sim.nextSeq - 1} tekrar`);
      if (sim.log.length > 14) sim.log.pop();
      sim.gbnTimer = sim.time;
      for (let k = sim.base; k < sim.nextSeq; k++) emitData(k, true);
    }
  } else {
    for (const [seq, t0] of [...sim.pktTimers.entries()]) {
      if (sim.time - t0 >= sim.timeout && !sim.ackedSet.has(seq)) {
        emitData(seq, true);
      }
    }
  }

  if (sim.base >= sim.totalPackets) sim.done = true;
  return sim;
}

// =====================================================================
// FIELD 2: ENDÜSTRİ & YÖNEYLEM (8 SIMULATIONS)
// =====================================================================

// ---------- 2.1 Queueing Theory (M/M/1, M/M/c, M/M/1/K) ----------

export function solveMM1(lambda, mu) {
  const rho = lambda / mu;
  if (!(rho < 1)) return { stable: false, rho, P0: 0, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, lambdaEff: mu };
  const P0 = 1 - rho;
  const L = rho / (1 - rho);
  const Lq = (rho * rho) / (1 - rho);
  const W = 1 / (mu - lambda);
  const Wq = lambda / (mu * (mu - lambda));
  return { stable: true, rho, P0, L, Lq, W, Wq, Pwait: rho, Pblock: 0, lambdaEff: lambda };
}

export function solveMMc(lambda, mu, c = 2) {
  const C = Math.max(1, Math.round(c));
  const a = lambda / mu;
  const rho = a / C;
  if (!(rho < 1)) return { stable: false, rho, P0: 0, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, Pwait: 1, Pblock: 0, lambdaEff: C * mu };
  let sum = 0;
  for (let n = 0; n < C; n++) sum += Math.pow(a, n) / factorial(n);
  const last = Math.pow(a, C) / (factorial(C) * (1 - rho));
  const P0 = 1 / (sum + last);
  const Pwait = last * P0; // Erlang-C
  const Lq = Pwait * (rho / (1 - rho));
  const Wq = Lq / lambda;
  const W = Wq + 1 / mu;
  const L = lambda * W;
  return { stable: true, rho, P0, L, Lq, W, Wq, Pwait, Pblock: 0, lambdaEff: lambda };
}

export function solveMM1K(lambda, mu, K = 6) {
  const cap = Math.max(1, Math.round(K));
  const rho = lambda / mu;
  let P0, PK, L;
  if (Math.abs(rho - 1) < 1e-8) {
    P0 = 1 / (cap + 1);
    PK = P0;
    L = cap / 2;
  } else {
    const rK1 = Math.pow(rho, cap + 1);
    P0 = (1 - rho) / (1 - rK1);
    PK = P0 * Math.pow(rho, cap);
    L = rho / (1 - rho) - ((cap + 1) * rK1) / (1 - rK1);
  }
  const lambdaEff = lambda * (1 - PK);
  const Lq = Math.max(0, L - (1 - P0));
  const W = lambdaEff > 0 ? L / lambdaEff : 0;
  const Wq = lambdaEff > 0 ? Lq / lambdaEff : 0;
  return { stable: true, rho, P0, L, Lq, W, Wq, Pwait: 1 - P0, Pblock: PK, lambdaEff };
}

export function createQueueSim({ model = 'mm1', lambda = 3, mu = 4, c = 1, K = 8, seed = 31 }) {
  const rng = makeRng(seed);
  const expSample = rate => -Math.log(Math.max(1e-12, rng())) / rate;
  const servers = model === 'mmc' ? Math.max(1, Math.round(c)) : 1;
  const cap = model === 'mm1k' ? Math.max(1, Math.round(K)) : Infinity;
  return {
    model, lambda, mu, c: servers, K: cap, rng, expSample,
    time: 0,
    nextArrival: expSample(lambda),
    serverFreeAt: new Array(servers).fill(Infinity),
    serverCust: new Array(servers).fill(null),
    queue: [],
    nextCustId: 1,
    arrivals: 0,
    admitted: 0,
    blocked: 0,
    departed: 0,
    areaL: 0,
    areaLq: 0,
    sumW: 0,
    sumWq: 0,
    recentEvents: [],
  };
}

export function advanceQueueSim(sim, dt) {
  const targetT = sim.time + dt;
  const recordArea = nextT => {
    const d = nextT - sim.time;
    if (d <= 0) return;
    const inSvc = sim.serverCust.filter(Boolean).length;
    sim.areaL += (sim.queue.length + inSvc) * d;
    sim.areaLq += sim.queue.length * d;
    sim.time = nextT;
  };

  let guard = 0;
  while (sim.time < targetT && guard++ < 5000) {
    let nextDep = Infinity, depIdx = -1;
    for (let i = 0; i < sim.c; i++) {
      if (sim.serverFreeAt[i] < nextDep) { nextDep = sim.serverFreeAt[i]; depIdx = i; }
    }
    const nextEv = Math.min(sim.nextArrival, nextDep);
    if (nextEv > targetT) { recordArea(targetT); break; }
    recordArea(nextEv);

    if (sim.nextArrival <= nextDep) {
      sim.arrivals++;
      const inSys = sim.queue.length + sim.serverCust.filter(Boolean).length;
      if (inSys >= sim.K) {
        sim.blocked++;
      } else {
        sim.admitted++;
        const cust = { id: sim.nextCustId++, arrT: sim.time, startT: sim.time };
        const freeSlot = sim.serverCust.findIndex(x => x === null);
        if (freeSlot >= 0) {
          sim.serverCust[freeSlot] = cust;
          sim.serverFreeAt[freeSlot] = sim.time + sim.expSample(sim.mu);
        } else {
          sim.queue.push(cust);
        }
      }
      sim.nextArrival = sim.time + sim.expSample(sim.lambda);
    } else {
      const done = sim.serverCust[depIdx];
      sim.departed++;
      sim.sumW += sim.time - done.arrT;
      sim.sumWq += done.startT - done.arrT;
      if (sim.queue.length) {
        const nxt = sim.queue.shift();
        nxt.startT = sim.time;
        sim.serverCust[depIdx] = nxt;
        sim.serverFreeAt[depIdx] = sim.time + sim.expSample(sim.mu);
      } else {
        sim.serverCust[depIdx] = null;
        sim.serverFreeAt[depIdx] = Infinity;
      }
    }
  }
  const T = Math.max(1e-9, sim.time);
  return {
    L: sim.areaL / T,
    Lq: sim.areaLq / T,
    W: sim.departed ? sim.sumW / sim.departed : 0,
    Wq: sim.departed ? sim.sumWq / sim.departed : 0,
    lambdaEff: sim.admitted / T,
    Pblock: sim.arrivals ? sim.blocked / sim.arrivals : 0,
    departed: sim.departed,
  };
}

// ---------- 2.2 Linear Programming (2D Graphical + Simplex) ----------

export function solveLP2D({ sense = 'max', c1 = 3, c2 = 5, constraints = [] }) {
  // Include non-negativity x1 >= 0, x2 >= 0
  const all = [
    ...constraints.map((con, idx) => ({ ...con, id: idx })),
    { a: -1, b: 0, rhs: 0, op: '<=', name: 'x1>=0', nonneg: true },
    { a: 0, b: -1, rhs: 0, op: '<=', name: 'x2>=0', nonneg: true },
  ];
  const satisfies = (x, y) => {
    for (const c of all) {
      const lhs = c.a * x + c.b * y;
      if (c.op === '<=' && lhs > c.rhs + 1e-7) return false;
      if (c.op === '>=' && lhs < c.rhs - 1e-7) return false;
      if (c.op === '=' && Math.abs(lhs - c.rhs) > 1e-7) return false;
    }
    return true;
  };

  // Add bounding box to detect unbounded regions cleanly
  const BOUND = 1e4;
  const withBox = [
    ...all,
    { a: 1, b: 0, rhs: BOUND, op: '<=', box: true },
    { a: 0, b: 1, rhs: BOUND, op: '<=', box: true },
  ];

  const pts = [];
  for (let i = 0; i < withBox.length; i++) {
    for (let j = i + 1; j < withBox.length; j++) {
      const cA = withBox[i], cB = withBox[j];
      const det = cA.a * cB.b - cA.b * cB.a;
      if (Math.abs(det) < 1e-11) continue;
      const x = (cA.rhs * cB.b - cA.b * cB.rhs) / det;
      const y = (cA.a * cB.rhs - cA.rhs * cB.a) / det;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < -1e-7 || y < -1e-7 || x > BOUND + 1e-5 || y > BOUND + 1e-5) continue;
      if (!satisfies(x, y)) continue;
      if (!pts.some(p => Math.hypot(p.x - x, p.y - y) < 1e-6)) {
        pts.push({ x: Math.abs(x) < 1e-9 ? 0 : x, y: Math.abs(y) < 1e-9 ? 0 : y, onBox: x > BOUND - 1 || y > BOUND - 1 });
      }
    }
  }

  if (!pts.length) return { status: 'infeasible', feasiblePoly: [], vertices: [], optimalPoint: null, optimalValue: NaN, shadowPrices: [] };

  // Sort polygon vertices CCW around centroid
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  pts.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));

  const objVal = p => c1 * p.x + c2 * p.y;
  let best = pts[0], bestZ = objVal(pts[0]);
  for (const p of pts) {
    const z = objVal(p);
    if ((sense === 'max' && z > bestZ) || (sense === 'min' && z < bestZ)) {
      best = p; bestZ = z;
    }
  }
  if (best.onBox) {
    return { status: 'unbounded', feasiblePoly: pts.filter(p => !p.onBox), vertices: pts.filter(p => !p.onBox), optimalPoint: null, optimalValue: sense === 'max' ? Infinity : -Infinity, shadowPrices: [] };
  }

  // Compute slack & exact numerical shadow prices via small RHS perturbation
  const eps = 1e-4;
  const shadowPrices = constraints.map((con, idx) => {
    const lhs = con.a * best.x + con.b * best.y;
    const slack = con.op === '<=' ? con.rhs - lhs : con.op === '>=' ? lhs - con.rhs : 0;
    const binding = Math.abs(slack) < 1e-5;
    let shadow = 0;
    if (binding) {
      const mod = constraints.map((c, j) => (j === idx ? { ...c, rhs: c.rhs + eps } : c));
      // Solve perturbed quickly without recursion overflow using vertices directly
      const pPts = [];
      const modAll = [...mod, { a: -1, b: 0, rhs: 0, op: '<=' }, { a: 0, b: -1, rhs: 0, op: '<=' }];
      const okP = (x, y) => modAll.every(c => (c.op === '<=' ? c.a * x + c.b * y <= c.rhs + 1e-8 : c.op === '>=' ? c.a * x + c.b * y >= c.rhs - 1e-8 : Math.abs(c.a * x + c.b * y - c.rhs) <= 1e-8));
      for (let i = 0; i < modAll.length; i++) {
        for (let j = i + 1; j < modAll.length; j++) {
          const d = modAll[i].a * modAll[j].b - modAll[i].b * modAll[j].a;
          if (Math.abs(d) < 1e-11) continue;
          const x = (modAll[i].rhs * modAll[j].b - modAll[i].b * modAll[j].rhs) / d;
          const y = (modAll[i].a * modAll[j].rhs - modAll[i].rhs * modAll[j].a) / d;
          if (okP(x, y)) pPts.push({ x, y });
        }
      }
      if (pPts.length) {
        const z2 = sense === 'max' ? Math.max(...pPts.map(objVal)) : Math.min(...pPts.map(objVal));
        shadow = (z2 - bestZ) / eps;
      }
    }
    return { name: con.name || `Kısıt ${idx + 1}`, slack: Math.abs(slack) < 1e-8 ? 0 : slack, binding, shadowPrice: Math.abs(shadow) < 1e-6 ? 0 : shadow };
  });

  const cleanVerts = pts.filter(p => !p.onBox).map(p => ({ ...p, z: objVal(p) }));
  return { status: 'optimal', feasiblePoly: cleanVerts, vertices: cleanVerts, optimalPoint: best, optimalValue: bestZ, shadowPrices };
}

/** Standard form Simplex stepper: max c^T x subject to A x <= b, x >= 0, b >= 0. */
export function simplexSolve({ c, A, b }) {
  const m = A.length;
  const n = c.length;
  const cols = n + m + 1;
  const varNames = [
    ...Array.from({ length: n }, (_, i) => `x${i + 1}`),
    ...Array.from({ length: m }, (_, i) => `s${i + 1}`),
  ];
  // Build tableau: m constraint rows + 1 objective row (row m: [-c, 0..0, 0])
  const T = Array.from({ length: m + 1 }, () => new Array(cols).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) T[i][j] = A[i][j];
    T[i][n + i] = 1;
    T[i][cols - 1] = b[i];
  }
  for (let j = 0; j < n; j++) T[m][j] = -c[j];

  const basis = Array.from({ length: m }, (_, i) => n + i);
  const steps = [];
  const snap = (iter, pivotRow, pivotCol, ratios, status) => {
    steps.push({
      iter,
      tableau: T.map(r => r.slice()),
      basis: basis.slice(),
      pivotRow,
      pivotCol,
      ratios,
      varNames,
      status,
    });
  };

  let status = 'optimal';
  for (let iter = 0; iter < 30; iter++) {
    // Most negative reduced cost (entering column)
    let pCol = -1, minVal = -1e-9;
    for (let j = 0; j < n + m; j++) {
      if (T[m][j] < minVal) { minVal = T[m][j]; pCol = j; }
    }
    if (pCol < 0) {
      snap(iter, -1, -1, null, 'optimal');
      status = 'optimal';
      break;
    }
    // Minimum ratio test
    const ratios = [];
    let pRow = -1, minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      const a = T[i][pCol];
      if (a > 1e-9) {
        const r = T[i][cols - 1] / a;
        ratios.push(r);
        if (r < minRatio - 1e-12) { minRatio = r; pRow = i; }
      } else {
        ratios.push(null);
      }
    }
    if (pRow < 0) {
      snap(iter, -1, pCol, ratios, 'unbounded');
      status = 'unbounded';
      break;
    }
    snap(iter, pRow, pCol, ratios, 'pivot');
    // Pivot operation
    const piv = T[pRow][pCol];
    for (let j = 0; j < cols; j++) T[pRow][j] /= piv;
    for (let i = 0; i <= m; i++) {
      if (i === pRow) continue;
      const f = T[i][pCol];
      if (Math.abs(f) < 1e-15) continue;
      for (let j = 0; j < cols; j++) T[i][j] -= f * T[pRow][j];
    }
    basis[pRow] = pCol;
  }

  const solution = new Array(n).fill(0);
  for (let i = 0; i < m; i++) {
    if (basis[i] < n) solution[basis[i]] = T[i][cols - 1];
  }
  const shadowPrices = Array.from({ length: m }, (_, i) => T[m][n + i]);
  return { status, steps, solution, optimalValue: T[m][cols - 1], shadowPrices, varNames };
}

// ---------- 2.3 Inventory & EOQ ----------

export function solveEOQ({ D = 12000, S = 150, H = 4, Q = null }) {
  const Qopt = Math.sqrt((2 * D * S) / H);
  const qUse = Q && Q > 0 ? Q : Qopt;
  const holdOpt = (Qopt / 2) * H;
  const orderOpt = (D / Qopt) * S;
  const tcOpt = holdOpt + orderOpt;
  const holdCur = (qUse / 2) * H;
  const orderCur = (D / qUse) * S;
  const tcCur = holdCur + orderCur;
  const ordersPerYear = D / qUse;
  const cycleDays = 365 / ordersPerYear;
  return { Qopt, tcOpt, tcCur, holdCur, orderCur, ordersPerYear, cycleDays };
}

export function solveROP({ dailyMean = 35, dailyStd = 8, leadTime = 5, serviceLevel = 0.95 }) {
  const z = normalInvCDF(Math.max(0.5, Math.min(0.999, serviceLevel)));
  const sigmaL = dailyStd * Math.sqrt(Math.max(0, leadTime));
  const safetyStock = z * sigmaL;
  const rop = dailyMean * leadTime + safetyStock;
  return { z, sigmaL, safetyStock, rop };
}

export function simulateInventory({ days = 120, dailyMean = 35, dailyStd = 8, leadTime = 5, Q = 900, rop = 205, seed = 17 }) {
  const rng = makeRng(seed);
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
  let onHand = Math.round(rop + Q * 0.7);
  const pipeline = []; // { arriveDay, qty }
  const series = [];
  let stockoutDays = 0, totalDemand = 0, totalFulfilled = 0, sumInv = 0, orderCount = 0;

  for (let d = 0; d <= days; d++) {
    let arrived = 0;
    for (let i = pipeline.length - 1; i >= 0; i--) {
      if (pipeline[i].arriveDay <= d) {
        arrived += pipeline[i].qty;
        pipeline.splice(i, 1);
      }
    }
    onHand += arrived;
    const dem = d === 0 ? 0 : Math.max(0, dailyMean + dailyStd * randn());
    totalDemand += dem;
    const fulfilled = Math.min(onHand, dem);
    totalFulfilled += fulfilled;
    onHand = Math.max(0, onHand - dem);
    const stockout = dem > fulfilled + 1e-6;
    if (stockout) stockoutDays++;
    sumInv += onHand;

    const onOrder = pipeline.reduce((s, o) => s + o.qty, 0);
    const invPos = onHand + onOrder;
    let ordered = false;
    if (invPos <= rop) {
      pipeline.push({ arriveDay: d + Math.max(1, Math.round(leadTime)), qty: Q });
      orderCount++;
      ordered = true;
    }
    series.push({ day: d, onHand, invPos: onHand + pipeline.reduce((s, o) => s + o.qty, 0), demand: dem, stockout, ordered, arrived });
  }
  return {
    series,
    stockoutDays,
    fillRate: totalDemand > 0 ? totalFulfilled / totalDemand : 1,
    avgInv: sumInv / (days + 1),
    orderCount,
  };
}

// ---------- 2.4 Project Management (CPM / PERT) ----------

export function solveCPMPERT(activities, targetDeadline = null) {
  const map = new Map();
  for (const act of activities) {
    const a = Number(act.a), m = Number(act.m), b = Number(act.b);
    const te = (a + 4 * m + b) / 6;
    const variance = Math.pow((b - a) / 6, 2);
    map.set(act.id, {
      id: act.id,
      name: act.name || act.id,
      preds: (act.preds || []).filter(Boolean),
      succs: [],
      a, m, b, te, variance,
      es: 0, ef: 0, ls: 0, lf: 0, totalSlack: 0, freeSlack: 0, critical: false,
    });
  }
  const inDeg = new Map();
  for (const [id, node] of map) {
    inDeg.set(id, 0);
    for (const p of node.preds) {
      if (!map.has(p)) return { ok: false, error: `Bilinmeyen öncül faaliyet: ${p}` };
      map.get(p).succs.push(id);
      inDeg.set(id, inDeg.get(id) + 1);
    }
  }
  // Kahn topological sort
  const queue = [...map.keys()].filter(id => inDeg.get(id) === 0);
  const topoOrder = [];
  while (queue.length) {
    const u = queue.shift();
    topoOrder.push(u);
    for (const v of map.get(u).succs) {
      inDeg.set(v, inDeg.get(v) - 1);
      if (inDeg.get(v) === 0) queue.push(v);
    }
  }
  if (topoOrder.length < map.size) return { ok: false, error: 'Faaliyet ağında döngü (çevrim) var!' };

  // Forward pass
  for (const id of topoOrder) {
    const n = map.get(id);
    n.es = n.preds.length ? Math.max(...n.preds.map(p => map.get(p).ef)) : 0;
    n.ef = n.es + n.te;
  }
  const projectDuration = Math.max(...[...map.values()].map(n => n.ef), 0);

  // Backward pass
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const n = map.get(topoOrder[i]);
    n.lf = n.succs.length ? Math.min(...n.succs.map(s => map.get(s).ls)) : projectDuration;
    n.ls = n.lf - n.te;
    n.totalSlack = Math.abs(n.ls - n.es) < 1e-9 ? 0 : n.ls - n.es;
    const minSuccES = n.succs.length ? Math.min(...n.succs.map(s => map.get(s).es)) : projectDuration;
    n.freeSlack = Math.abs(minSuccES - n.ef) < 1e-9 ? 0 : minSuccES - n.ef;
    n.critical = n.totalSlack < 1e-7;
  }

  // Extract one primary critical path from start to end
  const critNodes = topoOrder.filter(id => map.get(id).critical);
  const criticalPath = [];
  let cur = critNodes.find(id => map.get(id).preds.length === 0) || critNodes[0];
  while (cur) {
    criticalPath.push(cur);
    const nxt = map.get(cur).succs.find(s => map.get(s).critical && Math.abs(map.get(s).es - map.get(cur).ef) < 1e-6);
    cur = nxt;
  }
  const projectVar = criticalPath.reduce((s, id) => s + map.get(id).variance, 0);
  const projectStd = Math.sqrt(projectVar);
  const deadline = targetDeadline ?? projectDuration;
  const zScore = projectStd > 1e-9 ? (deadline - projectDuration) / projectStd : (deadline >= projectDuration ? 6 : -6);
  const completionProb = normalCDF(zScore);

  return {
    ok: true,
    nodes: topoOrder.map(id => map.get(id)),
    criticalPath,
    projectDuration,
    projectVar,
    projectStd,
    zScore,
    completionProb,
    topoOrder,
  };
}

// ---------- 2.5 Statistical Quality Control (SPC) ----------

export const SPC_CONSTANTS = {
  2:  { A2: 1.880, D3: 0.000, D4: 3.267, d2: 1.128 },
  3:  { A2: 1.023, D3: 0.000, D4: 2.574, d2: 1.693 },
  4:  { A2: 0.729, D3: 0.000, D4: 2.282, d2: 2.059 },
  5:  { A2: 0.577, D3: 0.000, D4: 2.114, d2: 2.326 },
  6:  { A2: 0.483, D3: 0.000, D4: 2.004, d2: 2.534 },
  7:  { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
  8:  { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
  9:  { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.970 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
};

export function generateSPCData({ mu = 50, sigma = 1.0, n = 5, k = 25, shiftAt = 99, shiftSigma = 0, driftPerSub = 0, seed = 23 }) {
  const rng = makeRng(seed);
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
  const subgroups = [];
  for (let i = 0; i < k; i++) {
    const meanI = mu + (i >= shiftAt ? shiftSigma * sigma : 0) + driftPerSub * i;
    const vals = [];
    for (let j = 0; j < n; j++) vals.push(meanI + sigma * randn());
    subgroups.push(vals);
  }
  return subgroups;
}

export function analyzeSPC({ subgroups, USL = 54, LSL = 46 }) {
  const k = subgroups.length;
  const n = Math.max(2, Math.min(10, subgroups[0]?.length || 5));
  const c = SPC_CONSTANTS[n];
  const xBars = [], ranges = [];
  for (const sg of subgroups) {
    const mean = sg.reduce((s, v) => s + v, 0) / sg.length;
    const rng = Math.max(...sg) - Math.min(...sg);
    xBars.push(mean);
    ranges.push(rng);
  }
  const xBarBar = xBars.reduce((s, v) => s + v, 0) / k;
  const rBar = ranges.reduce((s, v) => s + v, 0) / k;
  const xUCL = xBarBar + c.A2 * rBar;
  const xLCL = xBarBar - c.A2 * rBar;
  const rUCL = c.D4 * rBar;
  const rLCL = c.D3 * rBar;
  const sigmaHat = Math.max(1e-9, rBar / c.d2);
  const Cp = (USL - LSL) / (6 * sigmaHat);
  const Cpu = (USL - xBarBar) / (3 * sigmaHat);
  const Cpl = (xBarBar - LSL) / (3 * sigmaHat);
  const Cpk = Math.min(Cpu, Cpl);
  const pLow = normalCDF((LSL - xBarBar) / sigmaHat);
  const pHigh = 1 - normalCDF((USL - xBarBar) / sigmaHat);
  const ppm = (pLow + pHigh) * 1e6;

  // Out-of-control Western Electric / Nelson rules
  const violations = [];
  const xFlags = new Array(k).fill(false);
  const rFlags = new Array(k).fill(false);
  for (let i = 0; i < k; i++) {
    if (xBars[i] > xUCL || xBars[i] < xLCL) {
      xFlags[i] = true;
      violations.push({ index: i, rule: 'Kural 1 (X̄)', desc: `Örnek #${i + 1} kontrol sınırı dışında (X̄=${xBars[i].toFixed(2)})` });
    }
    if (ranges[i] > rUCL || ranges[i] < rLCL) {
      rFlags[i] = true;
      violations.push({ index: i, rule: 'Kural 1 (R)', desc: `Örnek #${i + 1} R sınırı dışında (R=${ranges[i].toFixed(2)})` });
    }
  }
  // Rule 2: 7 consecutive points on one side of centerline
  let runSide = 0, runLen = 0;
  for (let i = 0; i < k; i++) {
    const side = xBars[i] > xBarBar ? 1 : xBars[i] < xBarBar ? -1 : 0;
    if (side !== 0 && side === runSide) runLen++;
    else { runSide = side; runLen = side === 0 ? 0 : 1; }
    if (runLen === 7) {
      xFlags[i] = true;
      violations.push({ index: i, rule: 'Kural 2 (Seri)', desc: `Örnek #${i - 5}–#${i + 1}: merkez çizgisinin aynı yanında 7 ardışık nokta` });
    }
  }
  // Rule 3: 6 consecutive points strictly increasing or decreasing
  let inc = 1, dec = 1;
  for (let i = 1; i < k; i++) {
    if (xBars[i] > xBars[i - 1]) { inc++; dec = 1; }
    else if (xBars[i] < xBars[i - 1]) { dec++; inc = 1; }
    else { inc = 1; dec = 1; }
    if (inc === 6 || dec === 6) {
      xFlags[i] = true;
      violations.push({ index: i, rule: 'Kural 3 (Eğilim)', desc: `Örnek #${i - 4}–#${i + 1}: 6 ardışık ${inc === 6 ? 'artan' : 'azalan'} eğilim` });
    }
  }
  return { xBars, ranges, xBarBar, rBar, xUCL, xLCL, rUCL, rLCL, sigmaHat, Cp, Cpk, Cpu, Cpl, ppm, violations, xFlags, rFlags, constants: c };
}

// ---------- 2.6 Monte Carlo & Probability Distributions ----------

export function distStats(kind, p = {}) {
  if (kind === 'normal') {
    const mu = p.mu ?? 0, sig = Math.max(0.05, p.sigma ?? 1);
    return { mean: mu, variance: sig * sig, std: sig, discrete: false, xMin: mu - 4 * sig, xMax: mu + 4 * sig };
  }
  if (kind === 'binomial') {
    const n = Math.max(1, Math.round(p.n ?? 12)), pr = Math.max(0.01, Math.min(0.99, p.p ?? 0.4));
    const v = n * pr * (1 - pr);
    return { mean: n * pr, variance: v, std: Math.sqrt(v), discrete: true, xMin: 0, xMax: n };
  }
  if (kind === 'poisson') {
    const lam = Math.max(0.2, p.lambda ?? 4);
    return { mean: lam, variance: lam, std: Math.sqrt(lam), discrete: true, xMin: 0, xMax: Math.max(12, Math.ceil(lam + 4.5 * Math.sqrt(lam))) };
  }
  if (kind === 'exponential') {
    const lam = Math.max(0.1, p.lambda ?? 1);
    return { mean: 1 / lam, variance: 1 / (lam * lam), std: 1 / lam, discrete: false, xMin: 0, xMax: 6 / lam };
  }
  if (kind === 'uniform') {
    const a = p.a ?? 0, b = Math.max(a + 0.2, p.b ?? 10);
    const v = ((b - a) ** 2) / 12;
    return { mean: 0.5 * (a + b), variance: v, std: Math.sqrt(v), discrete: false, xMin: a - 0.1 * (b - a), xMax: b + 0.1 * (b - a) };
  }
  // Bimodal (for CLT): 50% N(-2, 0.5^2) + 50% N(2, 0.5^2)
  return { mean: 0, variance: 4.25, std: Math.sqrt(4.25), discrete: false, xMin: -4.5, xMax: 4.5 };
}

export function distPDF(kind, p = {}, x = 0) {
  if (kind === 'normal') {
    const mu = p.mu ?? 0, sig = Math.max(0.05, p.sigma ?? 1);
    return Math.exp(-0.5 * ((x - mu) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI));
  }
  if (kind === 'binomial') {
    const n = Math.max(1, Math.round(p.n ?? 12)), pr = Math.max(0.01, Math.min(0.99, p.p ?? 0.4));
    const k = Math.round(x);
    if (k < 0 || k > n) return 0;
    return Math.exp(logFactorial(n) - logFactorial(k) - logFactorial(n - k) + k * Math.log(pr) + (n - k) * Math.log(1 - pr));
  }
  if (kind === 'poisson') {
    const lam = Math.max(0.2, p.lambda ?? 4);
    const k = Math.round(x);
    if (k < 0) return 0;
    return Math.exp(k * Math.log(lam) - lam - logFactorial(k));
  }
  if (kind === 'exponential') {
    const lam = Math.max(0.1, p.lambda ?? 1);
    return x < 0 ? 0 : lam * Math.exp(-lam * x);
  }
  if (kind === 'uniform') {
    const a = p.a ?? 0, b = Math.max(a + 0.2, p.b ?? 10);
    return (x >= a && x <= b) ? 1 / (b - a) : 0;
  }
  return 0.5 * distPDF('normal', { mu: -2, sigma: 0.5 }, x) + 0.5 * distPDF('normal', { mu: 2, sigma: 0.5 }, x);
}

export function sampleOneDist(kind, p = {}, rng = Math.random) {
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
  if (kind === 'normal') return (p.mu ?? 0) + Math.max(0.05, p.sigma ?? 1) * randn();
  if (kind === 'binomial') {
    const n = Math.max(1, Math.round(p.n ?? 12)), pr = Math.max(0.01, Math.min(0.99, p.p ?? 0.4));
    let s = 0;
    for (let i = 0; i < n; i++) if (rng() < pr) s++;
    return s;
  }
  if (kind === 'poisson') {
    const lam = Math.max(0.2, p.lambda ?? 4);
    const L = Math.exp(-lam);
    let k = 0, prod = 1;
    do { k++; prod *= rng(); } while (prod > L && k < 200);
    return k - 1;
  }
  if (kind === 'exponential') return -Math.log(Math.max(1e-12, rng())) / Math.max(0.1, p.lambda ?? 1);
  if (kind === 'uniform') {
    const a = p.a ?? 0, b = Math.max(a + 0.2, p.b ?? 10);
    return a + (b - a) * rng();
  }
  return (rng() < 0.5 ? -2 : 2) + 0.5 * randn();
}

export function cltSampleMeans({ parent = 'exponential', n = 10, count = 400, seed = 51 }) {
  const rng = makeRng(seed);
  const params = parent === 'uniform' ? { a: 0, b: 10 } : parent === 'exponential' ? { lambda: 1 } : {};
  const st = distStats(parent, params);
  const means = new Array(count);
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += sampleOneDist(parent, params, rng);
    means[i] = s / n;
  }
  const empMean = means.reduce((s, v) => s + v, 0) / count;
  const empVar = means.reduce((s, v) => s + (v - empMean) ** 2, 0) / Math.max(1, count - 1);
  return { means, theoMean: st.mean, theoStd: st.std / Math.sqrt(n), empMean, empStd: Math.sqrt(empVar) };
}

export function monteCarloPiBatch(count = 500, seed = 77) {
  const rng = typeof seed === 'function' ? seed : makeRng(seed);
  let inside = 0;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const x = rng(), y = rng();
    const hit = x * x + y * y <= 1;
    if (hit) inside++;
    pts.push({ x, y, hit });
  }
  return { pts, inside, total: count, piEst: (4 * inside) / Math.max(1, count) };
}

// ---------- 2.7 Markov Chains ----------

export function normalizeTransitionMatrix(P) {
  return P.map(row => {
    const clamped = row.map(v => Math.max(0, Number(v) || 0));
    const s = clamped.reduce((a, b) => a + b, 0);
    if (s <= 1e-12) return clamped.map((_, j) => (j === 0 ? 1 : 0));
    return clamped.map(v => v / s);
  });
}

export function markovStep(pi, P) {
  const n = P.length;
  const out = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += pi[i] * P[i][j];
    out[j] = s;
  }
  return out;
}

export function markovPower(P, k) {
  const n = P.length;
  const matMul = (A, B) => Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      let s = 0;
      for (let t = 0; t < n; t++) s += A[i][t] * B[t][j];
      return s;
    })
  );
  let res = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
  let base = P.map(r => r.slice());
  let exp = Math.max(0, Math.round(k));
  while (exp > 0) {
    if (exp & 1) res = matMul(res, base);
    base = matMul(base, base);
    exp >>= 1;
  }
  return res;
}

export function markovSteadyState(P) {
  const n = P.length;
  // Solve (P^T - I) pi = 0 with last row sum(pi) = 1
  const A = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === n - 1 ? 1 : P[j][i] - (i === j ? 1 : 0)))
  );
  const b = Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 0));
  const sol = solveLinearSystem(A, b);
  if (sol && sol.every(v => Number.isFinite(v) && v >= -1e-7)) {
    const clean = sol.map(v => Math.max(0, v));
    const s = clean.reduce((a, c) => a + c, 0) || 1;
    return { unique: true, pi: clean.map(v => v / s) };
  }
  // Non-unique steady state (e.g., multiple absorbing classes): return Cesaro average from uniform
  let pi = new Array(n).fill(1 / n);
  const acc = new Array(n).fill(0);
  for (let t = 0; t < 200; t++) {
    pi = markovStep(pi, P);
    if (t >= 100) for (let i = 0; i < n; i++) acc[i] += pi[i] / 100;
  }
  return { unique: false, pi: acc };
}

export function classifyMarkov(P) {
  const n = P.length;
  const absorbing = [];
  for (let i = 0; i < n; i++) if (Math.abs(P[i][i] - 1) < 1e-9) absorbing.push(i);
  const Pk = markovPower(P, n * n + 2);
  const isRegular = Pk.every(row => row.every(v => v > 1e-9));
  return { absorbing, isRegular };
}

// ---------- 2.8 Transportation Problem (NW Corner, Vogel VAM, MODI) ----------

export function balanceTransportation({ costs, supply, demand }) {
  const C = costs.map(r => r.slice());
  const S = supply.slice();
  const D = demand.slice();
  const sumS = S.reduce((a, b) => a + b, 0);
  const sumD = D.reduce((a, b) => a + b, 0);
  let dummy = null;
  if (sumS > sumD + 1e-9) {
    D.push(sumS - sumD);
    C.forEach(r => r.push(0));
    dummy = 'col';
  } else if (sumD > sumS + 1e-9) {
    S.push(sumD - sumS);
    C.push(new Array(D.length).fill(0));
    dummy = 'row';
  }
  return { costs: C, supply: S, demand: D, dummy };
}

function transportCost(C, alloc) {
  let s = 0;
  for (let i = 0; i < C.length; i++)
    for (let j = 0; j < C[0].length; j++) s += C[i][j] * alloc[i][j];
  return s;
}

export function solveNorthwestCorner(prob) {
  const { costs: C, supply, demand, dummy } = balanceTransportation(prob);
  const m = supply.length, n = demand.length;
  const S = supply.slice(), D = demand.slice();
  const alloc = Array.from({ length: m }, () => new Array(n).fill(0));
  const basis = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    const qty = Math.min(S[i], D[j]);
    alloc[i][j] = qty;
    basis.push([i, j]);
    S[i] -= qty; D[j] -= qty;
    if (Math.abs(S[i]) < 1e-9 && Math.abs(D[j]) < 1e-9) {
      if (i + 1 < m) i++;
      else j++;
    } else if (Math.abs(S[i]) < 1e-9) i++;
    else j++;
  }
  return { costs: C, supply, demand, dummy, allocation: alloc, basis, cost: transportCost(C, alloc) };
}

export function solveVogel(prob) {
  const { costs: C, supply, demand, dummy } = balanceTransportation(prob);
  const m = supply.length, n = demand.length;
  const S = supply.slice(), D = demand.slice();
  const rowActive = new Array(m).fill(true);
  const colActive = new Array(n).fill(true);
  const alloc = Array.from({ length: m }, () => new Array(n).fill(0));
  const basis = [];
  let remRows = m, remCols = n;

  while (remRows > 0 && remCols > 0) {
    let bestPen = -1, pickRow = -1, pickCol = -1;
    // Row penalties
    for (let i = 0; i < m; i++) {
      if (!rowActive[i]) continue;
      const cs = [];
      for (let j = 0; j < n; j++) if (colActive[j]) cs.push({ c: C[i][j], j });
      cs.sort((a, b) => a.c - b.c);
      const pen = cs.length >= 2 ? cs[1].c - cs[0].c : cs[0].c;
      if (pen > bestPen) { bestPen = pen; pickRow = i; pickCol = cs[0].j; }
    }
    // Col penalties
    for (let j = 0; j < n; j++) {
      if (!colActive[j]) continue;
      const cs = [];
      for (let i = 0; i < m; i++) if (rowActive[i]) cs.push({ c: C[i][j], i });
      cs.sort((a, b) => a.c - b.c);
      const pen = cs.length >= 2 ? cs[1].c - cs[0].c : cs[0].c;
      if (pen > bestPen) { bestPen = pen; pickRow = cs[0].i; pickCol = j; }
    }
    const qty = Math.min(S[pickRow], D[pickCol]);
    alloc[pickRow][pickCol] = qty;
    basis.push([pickRow, pickCol]);
    S[pickRow] -= qty; D[pickCol] -= qty;
    if (remRows === 1 && remCols === 1) {
      rowActive[pickRow] = false; colActive[pickCol] = false; remRows = 0; remCols = 0;
    } else if (Math.abs(S[pickRow]) < 1e-9 && (remRows > 1 || remCols === 1)) {
      rowActive[pickRow] = false; remRows--;
    } else {
      colActive[pickCol] = false; remCols--;
    }
  }
  return { costs: C, supply, demand, dummy, allocation: alloc, basis, cost: transportCost(C, alloc) };
}

function findClosedLoop(m, n, basisSet, enterR, enterC) {
  // Alternating horizontal / vertical DFS from (enterR, enterC) through basic cells
  const cells = [[enterR, enterC]];
  for (const k of basisSet) {
    const [r, c] = k.split(',').map(Number);
    if (r !== enterR || c !== enterC) cells.push([r, c]);
  }
  const path = [[enterR, enterC]];
  const dfs = (r, c, needRow) => {
    for (const [nr, nc] of cells) {
      if (nr === r && nc === c) continue;
      if (needRow ? (nr !== r) : (nc !== c)) continue;
      if (nr === enterR && nc === enterC && path.length >= 4) return true;
      if (path.some(([pr, pc]) => pr === nr && pc === nc)) continue;
      path.push([nr, nc]);
      if (dfs(nr, nc, !needRow)) return true;
      path.pop();
    }
    return false;
  };
  if (dfs(enterR, enterC, true)) return path;
  path.length = 1;
  if (dfs(enterR, enterC, false)) return path;
  return null;
}

export function optimizeMODI(prob, initialMethod = 'nw') {
  const init = initialMethod === 'vogel' ? solveVogel(prob) : solveNorthwestCorner(prob);
  const { costs: C, supply, demand, dummy } = init;
  const m = supply.length, n = demand.length;
  const alloc = init.allocation.map(r => r.slice());
  const basisSet = new Set(init.basis.map(([r, c]) => `${r},${c}`));

  // Ensure non-degenerate tree basis of size m + n - 1
  const repairBasis = () => {
    while (basisSet.size < m + n - 1) {
      let added = false;
      for (let i = 0; i < m && !added; i++) {
        for (let j = 0; j < n && !added; j++) {
          const k = `${i},${j}`;
          if (basisSet.has(k)) continue;
          if (!findClosedLoop(m, n, basisSet, i, j)) {
            basisSet.add(k);
            added = true;
          }
        }
      }
      if (!added) break;
    }
  };
  repairBasis();

  const iterations = [];
  let lastU = [], lastV = [], lastRed = [];
  let optimal = false;

  for (let iter = 0; iter < 60; iter++) {
    repairBasis();
    const u = new Array(m).fill(null);
    const v = new Array(n).fill(null);
    u[0] = 0;
    const bCells = [...basisSet].map(k => k.split(',').map(Number));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [i, j] of bCells) {
        if (u[i] !== null && v[j] === null) { v[j] = C[i][j] - u[i]; changed = true; }
        else if (v[j] !== null && u[i] === null) { u[i] = C[i][j] - v[j]; changed = true; }
      }
      if (!changed) {
        const un = u.findIndex(x => x === null);
        if (un >= 0) { u[un] = 0; changed = true; }
      }
    }
    const reduced = Array.from({ length: m }, (_, i) =>
      Array.from({ length: n }, (__, j) => (basisSet.has(`${i},${j}`) ? 0 : C[i][j] - u[i] - v[j]))
    );
    lastU = u; lastV = v; lastRed = reduced;

    let minDelta = -1e-9, enterR = -1, enterC = -1;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (!basisSet.has(`${i},${j}`) && reduced[i][j] < minDelta) {
          minDelta = reduced[i][j]; enterR = i; enterC = j;
        }
      }
    }
    if (enterR < 0) {
      optimal = true;
      iterations.push({ iter, cost: transportCost(C, alloc), u: u.slice(), v: v.slice(), entering: null, loop: null, theta: 0, allocation: alloc.map(r => r.slice()) });
      break;
    }
    const loop = findClosedLoop(m, n, basisSet, enterR, enterC);
    if (!loop) break;
    let theta = Infinity, leaveIdx = -1;
    for (let k = 1; k < loop.length; k += 2) {
      const [r, c] = loop[k];
      if (alloc[r][c] < theta) { theta = alloc[r][c]; leaveIdx = k; }
    }
    iterations.push({
      iter,
      cost: transportCost(C, alloc),
      u: u.slice(),
      v: v.slice(),
      entering: [enterR, enterC],
      delta: minDelta,
      loop: loop.slice(),
      theta,
      allocation: alloc.map(r => r.slice()),
    });
    for (let k = 0; k < loop.length; k++) {
      const [r, c] = loop[k];
      alloc[r][c] += (k % 2 === 0 ? theta : -theta);
      if (Math.abs(alloc[r][c]) < 1e-9) alloc[r][c] = 0;
    }
    basisSet.add(`${enterR},${enterC}`);
    const [lr, lc] = loop[leaveIdx];
    basisSet.delete(`${lr},${lc}`);
  }

  const optCost = transportCost(C, alloc);
  return {
    costs: C, supply, demand, dummy,
    initialMethod,
    initialCost: init.cost,
    optimalCost: optCost,
    savings: init.cost - optCost,
    allocation: alloc,
    u: lastU, v: lastV, reducedCosts: lastRed,
    iterations,
    optimal,
  };
}

// =====================================================================
// FIELD 3: BİYOMEDİKAL (7 SIMULATIONS)
// =====================================================================

// ---------- 3.1 ECG & Heart Vector (Einthoven Triangle) ----------

export const ECG_PRESETS = {
  normal: { label: 'Normal Sinüs (72 BPM)', hr: 72, axisDeg: 60, pAmp: 0.16, qrsWidth: 1.0, stElev: 0, tAmp: 0.30, afib: false, pvcEvery: 0 },
  brady:  { label: 'Bradikardi (48 BPM)',   hr: 48, axisDeg: 55, pAmp: 0.16, qrsWidth: 1.0, stElev: 0, tAmp: 0.28, afib: false, pvcEvery: 0 },
  tachy:  { label: 'Taşikardi (125 BPM)',   hr: 125, axisDeg: 65, pAmp: 0.15, qrsWidth: 0.95, stElev: 0, tAmp: 0.26, afib: false, pvcEvery: 0 },
  afib:   { label: 'Atriyal Fibrilasyon',   hr: 108, axisDeg: 60, pAmp: 0, qrsWidth: 1.0, stElev: 0, tAmp: 0.25, afib: true, pvcEvery: 0 },
  pvc:    { label: 'PVC (Geniş QRS)',       hr: 76, axisDeg: 60, pAmp: 0.16, qrsWidth: 1.0, stElev: 0, tAmp: 0.28, afib: false, pvcEvery: 3 },
  stemi:  { label: 'ST Yükselmeli MI',      hr: 88, axisDeg: 45, pAmp: 0.15, qrsWidth: 1.05, stElev: 0.32, tAmp: 0.42, afib: false, pvcEvery: 0 },
};

/**
 * Computes instantaneous 2D cardiac dipole vector (vx, vy) in mV and Einthoven limb leads I, II, III.
 * Lead axes: I = 0 deg, II = +60 deg, III = +120 deg => V_II = V_I + V_III identically!
 */
export function ecgVectorAt(phase, params = {}) {
  const {
    axisDeg = 60,
    pAmp = 0.16,
    qrsWidth = 1.0,
    stElev = 0,
    tAmp = 0.30,
    afib = false,
    isPVC = false,
    timeSec = 0,
  } = params;

  const gauss = (x, mu, sig) => Math.exp(-0.5 * ((x - mu) / sig) ** 2);
  const w = Math.max(0.6, Math.min(2.2, isPVC ? qrsWidth * 1.9 : qrsWidth));
  const rad = (isPVC ? axisDeg - 135 : axisDeg) * (Math.PI / 180);
  const pRad = (axisDeg - 5) * (Math.PI / 180);
  const tRad = (isPVC ? axisDeg + 45 : axisDeg - 10) * (Math.PI / 180);

  let vx = 0, vy = 0;
  // P wave (absent in AFib and PVC)
  if (!afib && !isPVC && pAmp > 0) {
    const p = pAmp * gauss(phase, 0.16, 0.026);
    const pLoop = 0.25 * p * Math.sin((phase - 0.16) / 0.026);
    vx += p * Math.cos(pRad) - pLoop * Math.sin(pRad);
    vy += p * Math.sin(pRad) + pLoop * Math.cos(pRad);
  }
  if (afib) {
    // Baseline fibrillatory f-waves (~350-450/min)
    const fWave = 0.045 * Math.sin(2 * Math.PI * 6.3 * timeSec) + 0.03 * Math.sin(2 * Math.PI * 8.7 * timeSec + 1.2);
    vx += fWave * 0.7;
    vy += fWave * 0.7;
  }
  // Q wave (septal depolarization, opposite axis)
  const q = -0.16 * gauss(phase, 0.30 - 0.014 * w, 0.009 * w);
  // R wave (main ventricular depolarization loop)
  const rMag = (isPVC ? 1.35 : 1.15) * gauss(phase, 0.32, 0.013 * w);
  const rOrth = 0.28 * rMag * Math.sin((phase - 0.32) / (0.014 * w));
  // S wave (basal ventricular depolarization)
  const s = -(isPVC ? 0.55 : 0.28) * gauss(phase, 0.34 + 0.016 * w, 0.012 * w);
  const qrsMain = q + rMag + s;
  vx += qrsMain * Math.cos(rad) - rOrth * Math.sin(rad);
  vy += qrsMain * Math.sin(rad) + rOrth * Math.cos(rad);

  // ST elevation/depression segment
  if (Math.abs(stElev) > 1e-4) {
    const st = stElev * gauss(phase, 0.43, 0.055);
    vx += st * Math.cos(rad);
    vy += st * Math.sin(rad);
  }
  // T wave (ventricular repolarization)
  const tSign = isPVC ? -1 : 1;
  const tVal = tSign * tAmp * gauss(phase, 0.56, 0.052);
  const tOrth = 0.18 * tVal * Math.sin((phase - 0.56) / 0.052);
  vx += tVal * Math.cos(tRad) - tOrth * Math.sin(tRad);
  vy += tVal * Math.sin(tRad) + tOrth * Math.cos(tRad);

  const leadI = vx;
  const leadII = 0.5 * vx + (Math.sqrt(3) / 2) * vy;
  const leadIII = -0.5 * vx + (Math.sqrt(3) / 2) * vy;
  return { vx, vy, leadI, leadII, leadIII };
}

export function generateECGTrace(params = {}, durationSec = 4.0, fs = 250) {
  const p = { ...ECG_PRESETS.normal, ...params };
  const n = Math.max(100, Math.round(durationSec * fs));
  const t = new Array(n), leadI = new Array(n), leadII = new Array(n), leadIII = new Array(n);
  const baseRR = 60 / Math.max(30, Math.min(200, p.hr));
  // Deterministic beat schedule (irregular if AFib)
  const rng = makeRng(109);
  const beats = [];
  let bt = 0, bIdx = 0;
  while (bt < durationSec + baseRR) {
    const rr = p.afib ? baseRR * (0.68 + rng() * 0.68) : baseRR;
    const isPVC = p.pvcEvery > 0 && bIdx > 0 && (bIdx % p.pvcEvery === 0);
    beats.push({ start: bt, dur: rr, isPVC });
    bt += rr;
    bIdx++;
  }

  let bi = 0;
  for (let i = 0; i < n; i++) {
    const ts = i / fs;
    t[i] = ts;
    while (bi + 1 < beats.length && ts >= beats[bi + 1].start) bi++;
    const b = beats[bi];
    const phase = Math.max(0, Math.min(0.9999, (ts - b.start) / b.dur));
    const v = ecgVectorAt(phase, { ...p, isPVC: b.isPVC, timeSec: ts });
    leadI[i] = v.leadI;
    leadII[i] = v.leadII;
    leadIII[i] = v.leadIII;
  }
  const rrMs = baseRR * 1000;
  const prMs = p.afib ? NaN : 160;
  const qrsMs = Math.round(90 * p.qrsWidth);
  const qtMs = Math.round(Math.min(0.52 * rrMs, 380 * Math.pow(baseRR, 0.35)));
  const qtcMs = Math.round(qtMs / Math.sqrt(baseRR));
  return { t, leadI, leadII, leadIII, hr: p.hr, rrMs, prMs, qrsMs, qtMs, qtcMs, axisDeg: p.axisDeg };
}

// ---------- 3.2 Pharmacokinetics (1-Comp & 2-Comp, Multi-dose) ----------

export function pkOneCompSingle({ route = 'oral', dose = 500, Vd = 40, ke = 0.15, ka = 1.2, F = 0.85, tEnd = 36, n = 300 }) {
  const halfLife = Math.LN2 / ke;
  const CL = ke * Vd;
  const t = [], C = [];
  const fEff = route === 'iv' ? 1 : F;
  const auc = (fEff * dose) / CL;
  let tmax = 0, cmax = 0;
  if (route === 'iv') {
    tmax = 0; cmax = dose / Vd;
  } else {
    tmax = Math.abs(ka - ke) < 1e-6 ? 1 / ke : Math.log(ka / ke) / (ka - ke);
    cmax = Math.abs(ka - ke) < 1e-6
      ? (F * dose * ke / Vd) * tmax * Math.exp(-ke * tmax)
      : (F * dose * ka / (Vd * (ka - ke))) * (Math.exp(-ke * tmax) - Math.exp(-ka * tmax));
  }
  for (let i = 0; i <= n; i++) {
    const ti = (tEnd * i) / n;
    t.push(ti);
    let ci;
    if (route === 'iv') {
      ci = (dose / Vd) * Math.exp(-ke * ti);
    } else if (Math.abs(ka - ke) < 1e-6) {
      ci = (F * dose * ke / Vd) * ti * Math.exp(-ke * ti);
    } else {
      ci = (F * dose * ka / (Vd * (ka - ke))) * (Math.exp(-ke * ti) - Math.exp(-ka * ti));
    }
    C.push(Math.max(0, ci));
  }
  return { t, C, halfLife, CL, auc, tmax, cmax };
}

export function pkOneCompMulti({ route = 'oral', dose = 500, loadingDose = 500, tau = 8, nDoses = 8, Vd = 40, ke = 0.15, ka = 1.2, F = 0.85, mec = 5, mtc = 20, nPerDose = 40 }) {
  const tEnd = tau * nDoses;
  const totalPts = Math.max(80, nDoses * nPerDose);
  const t = [], C = [];
  const evalSingle = (d, dt) => {
    if (dt < 0) return 0;
    if (route === 'iv') return (d / Vd) * Math.exp(-ke * dt);
    if (Math.abs(ka - ke) < 1e-6) return (F * d * ke / Vd) * dt * Math.exp(-ke * dt);
    return Math.max(0, (F * d * ka / (Vd * (ka - ke))) * (Math.exp(-ke * dt) - Math.exp(-ka * dt)));
  };
  let inWin = 0;
  for (let i = 0; i <= totalPts; i++) {
    const ti = (tEnd * i) / totalPts;
    let c = 0;
    for (let k = 0; k < nDoses; k++) {
      const dt = ti - k * tau;
      if (dt < 0) break;
      c += evalSingle(k === 0 ? loadingDose : dose, dt);
    }
    t.push(ti); C.push(c);
    if (c >= mec && c <= mtc) inWin++;
  }
  const halfLife = Math.LN2 / ke;
  const CL = ke * Vd;
  const fEff = route === 'iv' ? 1 : F;
  const cssAvg = (fEff * dose) / (CL * tau);
  const rac = 1 / (1 - Math.exp(-ke * tau));
  const lastSlice = C.slice(Math.max(0, C.length - nPerDose - 1));
  const cssMax = Math.max(...lastSlice);
  const cssMin = Math.min(...lastSlice);
  return { t, C, halfLife, CL, cssAvg, cssMax, cssMin, rac, timeInWindowPct: (inWin / (totalPts + 1)) * 100 };
}

export function pkTwoComp({ dose = 500, V1 = 15, k10 = 0.18, k12 = 0.45, k21 = 0.25, tau = 12, nDoses = 1, tEnd = 36, n = 360 }) {
  const sumK = k10 + k12 + k21;
  const disc = Math.sqrt(Math.max(0, sumK * sumK - 4 * k10 * k21));
  const alpha = 0.5 * (sumK + disc);
  const beta = 0.5 * (sumK - disc);
  const halfAlpha = Math.LN2 / alpha;
  const halfBeta = Math.LN2 / beta;
  const V2 = V1 * (k12 / Math.max(1e-6, k21));

  const effEnd = nDoses > 1 ? tau * nDoses : tEnd;
  const dt = effEnd / n;
  let y = [dose, 0]; // [A1, A2]
  let nextDoseIdx = 1;
  const t = [0], C1 = [y[0] / V1], C2 = [0];
  const deriv = (_tt, [a1, a2]) => [-(k10 + k12) * a1 + k21 * a2, k12 * a1 - k21 * a2];

  for (let i = 1; i <= n; i++) {
    const ti = i * dt;
    // Substep RK4
    y = rk4Step(deriv, ti - dt, y, dt * 0.5);
    y = rk4Step(deriv, ti - dt * 0.5, y, dt * 0.5);
    while (nextDoseIdx < nDoses && ti >= nextDoseIdx * tau - 1e-9) {
      y[0] += dose;
      nextDoseIdx++;
    }
    t.push(ti);
    C1.push(y[0] / V1);
    C2.push(y[1] / V2);
  }
  return { t, C1, C2, alpha, beta, halfAlpha, halfBeta, CL: k10 * V1, V2 };
}

// ---------- 3.3 Neuron Models (Hodgkin-Huxley & FitzHugh-Nagumo) ----------

function hhAlphaM(V) { const d = V + 40; return Math.abs(d) < 1e-5 ? 1.0 : (0.1 * d) / (1 - Math.exp(-d / 10)); }
function hhBetaM(V)  { return 4.0 * Math.exp(-(V + 65) / 18); }
function hhAlphaH(V) { return 0.07 * Math.exp(-(V + 65) / 20); }
function hhBetaH(V)  { return 1.0 / (1 + Math.exp(-(V + 35) / 10)); }
function hhAlphaN(V) { const d = V + 55; return Math.abs(d) < 1e-5 ? 0.1 : (0.01 * d) / (1 - Math.exp(-d / 10)); }
function hhBetaN(V)  { return 0.125 * Math.exp(-(V + 65) / 80); }

export function simulateHodgkinHuxley({
  Iinj = 10,
  tPulseStart = 5,
  tPulseDur = 35,
  pulse2Delay = 0,
  pulse2Amp = 0,
  pulse2Dur = 2,
  gNaScale = 1.0,
  gKScale = 1.0,
  tEnd = 50,
  dt = 0.025,
} = {}) {
  const Cm = 1.0;
  const gNa = 120.0 * gNaScale, gK = 36.0 * gKScale, gL = 0.3;
  const ENa = 50.0, EK = -77.0, EL = -54.387;

  const V0 = -65.0;
  const m0 = hhAlphaM(V0) / (hhAlphaM(V0) + hhBetaM(V0));
  const h0 = hhAlphaH(V0) / (hhAlphaH(V0) + hhBetaH(V0));
  const n0 = hhAlphaN(V0) / (hhAlphaN(V0) + hhBetaN(V0));

  const currentAt = ts => {
    let I = 0;
    if (ts >= tPulseStart && ts <= tPulseStart + tPulseDur) I += Iinj;
    if (pulse2Delay > 0 && pulse2Amp !== 0) {
      const s2 = tPulseStart + pulse2Delay;
      if (ts >= s2 && ts <= s2 + pulse2Dur) I += pulse2Amp;
    }
    return I;
  };

  const deriv = (ts, [V, m, h, n]) => {
    const INa = gNa * m * m * m * h * (V - ENa);
    const IK = gK * n * n * n * n * (V - EK);
    const IL = gL * (V - EL);
    const dV = (currentAt(ts) - INa - IK - IL) / Cm;
    const dm = hhAlphaM(V) * (1 - m) - hhBetaM(V) * m;
    const dh = hhAlphaH(V) * (1 - h) - hhBetaH(V) * h;
    const dn = hhAlphaN(V) * (1 - n) - hhBetaN(V) * n;
    return [dV, dm, dh, dn];
  };

  const steps = Math.round(tEnd / dt);
  const stride = Math.max(1, Math.floor(steps / 500));
  let y = [V0, m0, h0, n0];
  const t = [], V = [], m = [], h = [], n = [], INa = [], IK = [], Iext = [];
  const spikeTimes = [];
  let prevV = V0, prevPrevV = V0, peakV = V0, minV = V0;

  for (let i = 0; i <= steps; i++) {
    const ts = i * dt;
    const [vi, mi, hi, ni] = y;
    if (vi > peakV) peakV = vi;
    if (vi < minV) minV = vi;
    if (i >= 2 && prevV > 0 && prevV > prevPrevV && prevV >= vi) {
      if (!spikeTimes.length || (ts - dt) - spikeTimes[spikeTimes.length - 1] > 3.0) {
        spikeTimes.push(ts - dt);
      }
    }
    prevPrevV = prevV;
    prevV = vi;

    if (i % stride === 0 || i === steps) {
      t.push(ts); V.push(vi); m.push(mi); h.push(hi); n.push(ni);
      INa.push(gNa * mi * mi * mi * hi * (vi - ENa));
      IK.push(gK * ni * ni * ni * ni * (vi - EK));
      Iext.push(currentAt(ts));
    }
    if (i < steps) y = rk4Step(deriv, ts, y, dt);
  }
  const firingHz = spikeTimes.length >= 2
    ? (1000 * (spikeTimes.length - 1)) / (spikeTimes[spikeTimes.length - 1] - spikeTimes[0])
    : 0;
  return { t, V, m, h, n, INa, IK, Iext, spikeTimes, spikeCount: spikeTimes.length, peakV, minV, firingHz };
}

export function fhnNullclines({ a = 0.7, b = 0.8, I = 0.5, vMin = -2.4, vMax = 2.4, samples = 120 } = {}) {
  const vs = [], wV = [], wW = [];
  for (let i = 0; i <= samples; i++) {
    const v = vMin + ((vMax - vMin) * i) / samples;
    vs.push(v);
    wV.push(v - (v * v * v) / 3 + I);
    wW.push((v + a) / Math.max(0.05, b));
  }
  return { vs, wV, wW };
}

export function simulateFHN({ v0 = -1.1, w0 = -0.5, a = 0.7, b = 0.8, tau = 12.5, I = 0.5, tEnd = 100, dt = 0.1 } = {}) {
  const deriv = (_t, [v, w]) => [v - (v * v * v) / 3 - w + I, (v + a - b * w) / tau];
  const steps = Math.round(tEnd / dt);
  let y = [v0, w0];
  const t = [0], v = [v0], w = [w0];
  for (let i = 1; i <= steps; i++) {
    y = rk4Step(deriv, (i - 1) * dt, y, dt);
    if (i % 2 === 0 || i === steps) { t.push(i * dt); v.push(y[0]); w.push(y[1]); }
  }
  return { t, v, w };
}

// ---------- 3.4 Epidemic Models (SIR / SEIR) ----------

export function simulateEpidemic({
  model = 'SIR',
  beta = 0.35,
  gamma = 0.1,
  sigma = 0.2,
  vaccFrac = 0,
  I0 = 0.01,
  tEnd = 160,
  dt = 0.25,
  intervDay = 999,
  intervFactor = 1.0,
} = {}) {
  const p = Math.max(0, Math.min(0.99, vaccFrac));
  const i0 = Math.min(I0, Math.max(0, 1 - p));
  const s0 = Math.max(0, 1 - p - i0);
  const R0 = beta / Math.max(1e-6, gamma);
  const herdThreshold = R0 > 1 ? 1 - 1 / R0 : 0;

  const effBeta = ts => (ts >= intervDay ? beta * intervFactor : beta);
  const deriv = (ts, [S, E, I, R]) => {
    const b = effBeta(ts);
    if (model === 'SEIR') {
      return [-b * S * I, b * S * I - sigma * E, sigma * E - gamma * I, gamma * I];
    }
    return [-b * S * I, 0, b * S * I - gamma * I, gamma * I];
  };

  const steps = Math.round(tEnd / dt);
  let y = [s0, 0, i0, p];
  const t = [], S = [], E = [], I = [], R = [], Reff = [];
  let peakI = i0, peakDay = 0;

  for (let k = 0; k <= steps; k++) {
    const ts = k * dt;
    if (y[2] > peakI) { peakI = y[2]; peakDay = ts; }
    if (k % 2 === 0 || k === steps) {
      t.push(ts); S.push(y[0]); E.push(y[1]); I.push(y[2]); R.push(y[3]);
      Reff.push((effBeta(ts) / gamma) * y[0]);
    }
    if (k < steps) y = rk4Step(deriv, ts, y, dt);
  }
  const finalAttackRate = Math.max(0, y[3] - p);
  return { t, S, E, I, R, Reff, R0, herdThreshold, peakI, peakDay, finalAttackRate, finalS: y[0] };
}

// ---------- 3.5 Cardiovascular (Windkessel & Poiseuille Stenosis) ----------

export function simulateWindkessel({
  elements = 3,
  R = 1.0,        // mmHg·s/mL
  C = 1.5,        // mL/mmHg
  Zc = 0.06,      // mmHg·s/mL
  hr = 72,        // bpm
  strokeVolMl = 70,
  systoleFrac = 0.35,
  cycles = 5,
} = {}) {
  const T = 60 / Math.max(35, hr);
  const Ts = T * systoleFrac;
  const Qpeak = (Math.PI * strokeVolMl) / (2 * Ts);
  const flowAt = ts => {
    const ph = ts % T;
    return ph <= Ts ? Qpeak * Math.sin((Math.PI * ph) / Ts) : 0;
  };
  const dt = 0.004;
  const totalSteps = Math.round((cycles * T) / dt);
  const zEff = elements === 3 ? Zc : 0;
  let Pw = 85; // initial aortic Windkessel pressure (mmHg)
  const keepFrom = (cycles - 2) * T;
  const t = [], P = [], Q = [];

  for (let i = 0; i <= totalSteps; i++) {
    const ts = i * dt;
    const q = flowAt(ts);
    const pa = Pw + zEff * q;
    if (ts >= keepFrom - 1e-9) {
      t.push(ts - keepFrom);
      P.push(pa);
      Q.push(q);
    }
    // RK4 on dPw/dt = (Q(t) - Pw/R) / C
    const f = (tt, [p]) => [(flowAt(tt) - p / R) / C];
    Pw = rk4Step(f, ts, [Pw], dt)[0];
  }
  // Metrics from last cycle
  const half = Math.floor(P.length / 2);
  const lastP = P.slice(half);
  const Psystolic = Math.max(...lastP);
  const Pdiastolic = Math.min(...lastP);
  const MAP = lastP.reduce((s, v) => s + v, 0) / Math.max(1, lastP.length);
  const pulsePressure = Psystolic - Pdiastolic;
  const cardiacOutputLMin = (strokeVolMl * hr) / 1000;
  return { t, P, Q, Psystolic, Pdiastolic, MAP, pulsePressure, cardiacOutputLMin, T };
}

export function solvePoiseuilleStenosis({
  radiusMm = 2.0,
  lengthCm = 5.0,
  dP_mmHg = 10,
  viscosityCP = 3.5,
  stenosisPct = 0,
  stenLenFrac = 0.3,
} = {}) {
  const r0 = radiusMm * 1e-3; // m
  const L = lengthCm * 1e-2;  // m
  const dP = dP_mmHg * 133.322387415; // Pa
  const mu = viscosityCP * 1e-3; // Pa·s
  const rho = 1060; // kg/m^3 blood density
  const s = Math.max(0, Math.min(0.85, stenosisPct / 100));
  const rs = r0 * (1 - s);

  const R0 = (8 * mu * L) / (Math.PI * Math.pow(r0, 4)); // Pa·s/m^3
  const fL = Math.max(0.05, Math.min(1, stenLenFrac));
  const Rtot = R0 * (1 - fL) + R0 * fL / Math.pow(1 - s, 4);

  const Q0 = dP / R0; // m^3/s
  const Q = dP / Rtot;
  const flowRatio = Q / Q0;
  const Q0_mlMin = Q0 * 60e6;
  const Q_mlMin = Q * 60e6;

  const vMean0 = Q / (Math.PI * r0 * r0);
  const vMax = 2 * vMean0;
  const vStenMean = Q / (Math.PI * rs * rs);
  const vStenMax = 2 * vStenMean;
  const Re = (rho * vStenMean * (2 * rs)) / mu;
  const wallShearPa = (4 * mu * Q) / (Math.PI * Math.pow(rs, 3));

  const profile = [];
  for (let i = -20; i <= 20; i++) {
    const u = i / 20;
    profile.push({ rNorm: u, vNorm: vMax * (1 - u * u), vSten: vStenMax * (1 - u * u) });
  }
  return { Q_mlMin, Q0_mlMin, flowRatio, R_ratio: Rtot / R0, vMax, vStenMax, Re, wallShearPa, rsMm: rs * 1e3, profile };
}

// ---------- 3.6 Biomechanics (Muscle Force-Length, Hill, Elbow Statics) ----------

export function muscleForceLength(lNorm) {
  // Active sarcomere actin-myosin overlap (Gordon-Huxley plateau near 1.0)
  let active = 0;
  if (lNorm >= 0.45 && lNorm < 0.90) active = Math.pow((lNorm - 0.45) / 0.45, 0.85);
  else if (lNorm >= 0.90 && lNorm <= 1.08) active = 1.0;
  else if (lNorm > 1.08 && lNorm <= 1.65) active = Math.max(0, 1 - (lNorm - 1.08) / 0.57);
  // Passive elastic titin/connective tissue force for L > L0
  const passive = lNorm > 1.0 ? 0.045 * (Math.exp(5.6 * (lNorm - 1.0)) - 1) : 0;
  return { active, passive, total: active + passive };
}

export function hillForceVelocity({ F0 = 1000, vmax = 3.0, aRatio = 0.25, v = 0 }) {
  let F;
  if (v >= vmax) F = 0;
  else if (v >= 0) {
    const vn = v / vmax;
    F = F0 * ((aRatio * (1 - vn)) / (aRatio + vn));
  } else {
    // Eccentric lengthening plateau toward 1.5 F0
    const vn = -v / vmax;
    F = F0 * (1 + 0.5 * (1 - Math.exp(-4 * vn)));
  }
  return { F, P: F * v };
}

export function hillCurve({ F0 = 1000, vmax = 3.0, aRatio = 0.25, samples = 120 }) {
  const vs = [], Fs = [], Ps = [];
  let vOpt = 0, pMax = 0;
  for (let i = 0; i <= samples; i++) {
    const v = (vmax * i) / samples;
    const { F, P } = hillForceVelocity({ F0, vmax, aRatio, v });
    vs.push(v); Fs.push(F); Ps.push(P);
    if (P > pMax) { pMax = P; vOpt = v; }
  }
  return { vs, Fs, Ps, vOpt, pMax };
}

export function solveElbowBiomechanics({
  thetaDeg = 90,   // forearm angle from downward vertical (90 deg = horizontal)
  loadKg = 5.0,
  forearmKg = 1.8,
  L_m = 0.34,
  dBiceps_m = 0.045,
  dCom_m = 0.15,
} = {}) {
  const rad = thetaDeg * (Math.PI / 180);
  // Biceps origin roughly 0.30 m above elbow on humerus
  const hOrigin = 0.30;
  const ix = dBiceps_m * Math.sin(rad);
  const iy = -dBiceps_m * Math.cos(rad);
  const bx = -ix, by = hOrigin - iy;
  const bLen = Math.hypot(bx, by);
  const ux = bx / bLen, uy = by / bLen; // unit pull vector from insertion toward origin
  // Moment arm of biceps about elbow (0,0): r x u = ix * uy - iy * ux
  const momentArm = Math.abs(ix * uy - iy * ux);
  const torqueLoad = loadKg * G0 * L_m * Math.sin(rad);
  const torqueArm = forearmKg * G0 * dCom_m * Math.sin(rad);
  const totalTorque = torqueLoad + torqueArm;
  const Fbiceps = momentArm > 1e-4 ? totalTorque / momentArm : 0;
  // Static force equilibrium: R + F_biceps + W_arm + W_load = 0
  const Rx = -(Fbiceps * ux);
  const Ry = (loadKg + forearmKg) * G0 - Fbiceps * uy;
  const Rmag = Math.hypot(Rx, Ry);
  const mechAdv = momentArm / L_m;
  return { torqueLoad, torqueArm, totalTorque, Fbiceps, Rx, Ry, Rmag, momentArm, mechAdv, pullDir: [ux, uy] };
}

// ---------- 3.7 Medical Imaging (CT Sinogram / FBP & Ultrasound) ----------

export function createPhantom(presetId = 'brain', size = 48) {
  const img = new Float32Array(size * size);
  const ellipses = presetId === 'tumor'
    ? [
        { cx: 0, cy: 0, rx: 0.78, ry: 0.68, rot: 0, val: 0.35 },
        { cx: -0.28, cy: 0.08, rx: 0.18, ry: 0.24, rot: 0.2, val: 0.55 },
        { cx: 0.30, cy: -0.15, rx: 0.11, ry: 0.11, rot: 0, val: 0.65 },
        { cx: 0.05, cy: 0.35, rx: 0.22, ry: 0.12, rot: 0, val: -0.25 },
      ]
    : presetId === 'dots'
      ? [
          { cx: 0, cy: 0, rx: 0.80, ry: 0.80, rot: 0, val: 0.12 },
          { cx: -0.32, cy: -0.22, rx: 0.11, ry: 0.11, rot: 0, val: 0.85 },
          { cx: 0.34, cy: 0.18, rx: 0.14, ry: 0.14, rot: 0, val: 0.75 },
          { cx: -0.05, cy: 0.42, rx: 0.08, ry: 0.08, rot: 0, val: 0.90 },
        ]
      : [
          // Mini Shepp-Logan brain phantom
          { cx: 0, cy: 0, rx: 0.69, ry: 0.92, rot: 0, val: 1.0 },
          { cx: 0, cy: -0.018, rx: 0.662, ry: 0.874, rot: 0, val: -0.78 },
          { cx: 0.22, cy: 0, rx: 0.11, ry: 0.31, rot: -0.31, val: -0.18 },
          { cx: -0.22, cy: 0, rx: 0.16, ry: 0.41, rot: 0.31, val: -0.18 },
          { cx: 0, cy: 0.35, rx: 0.21, ry: 0.25, rot: 0, val: 0.22 },
          { cx: 0, cy: -0.35, rx: 0.09, ry: 0.09, rot: 0, val: 0.42 },
          { cx: 0.14, cy: -0.48, rx: 0.06, ry: 0.08, rot: 0, val: 0.35 },
        ];

  for (let r = 0; r < size; r++) {
    const y = 1 - (2 * (r + 0.5)) / size;
    for (let c = 0; c < size; c++) {
      const x = (2 * (c + 0.5)) / size - 1;
      let v = 0;
      for (const e of ellipses) {
        const dx = x - e.cx, dy = y - e.cy;
        const co = Math.cos(e.rot), si = Math.sin(e.rot);
        const xr = dx * co + dy * si;
        const yr = -dx * si + dy * co;
        if ((xr * xr) / (e.rx * e.rx) + (yr * yr) / (e.ry * e.ry) <= 1) v += e.val;
      }
      img[r * size + c] = Math.max(0, Math.min(1, v));
    }
  }
  return img;
}

export function computeSinogram(phantom, size, numAngles = 48) {
  const numDet = size;
  const sinogram = new Float32Array(numAngles * numDet);
  const half = (size - 1) / 2;
  const nStep = size;
  const ds = 2 / nStep;

  for (let ai = 0; ai < numAngles; ai++) {
    const theta = (Math.PI * ai) / numAngles;
    const ct = Math.cos(theta), st = Math.sin(theta);
    for (let di = 0; di < numDet; di++) {
      const s = (2 * (di + 0.5)) / numDet - 1; // detector coordinate [-1, 1]
      let sum = 0;
      for (let ti = 0; ti < nStep; ti++) {
        const u = (2 * (ti + 0.5)) / nStep - 1;
        const x = s * ct - u * st;
        const y = s * st + u * ct;
        const col = (x + 1) * half;
        const row = (1 - y) * half;
        if (col >= 0 && col < size - 1 && row >= 0 && row < size - 1) {
          const c0 = Math.floor(col), r0 = Math.floor(row);
          const fc = col - c0, fr = row - r0;
          const v00 = phantom[r0 * size + c0];
          const v10 = phantom[r0 * size + c0 + 1];
          const v01 = phantom[(r0 + 1) * size + c0];
          const v11 = phantom[(r0 + 1) * size + c0 + 1];
          sum += ((v00 * (1 - fc) + v10 * fc) * (1 - fr) + (v01 * (1 - fc) + v11 * fc) * fr);
        }
      }
      sinogram[ai * numDet + di] = sum * ds;
    }
  }
  return { sinogram, numAngles, numDet };
}

export function reconstructFBP(sinogram, numAngles, numDet, size, { filtered = true, reference = null } = {}) {
  // Spatial-domain Ram-Lak ramp kernel h[0] = 1/4, h[odd k] = -1/(pi^2 k^2)
  const proc = new Float32Array(numAngles * numDet);
  if (filtered) {
    for (let ai = 0; ai < numAngles; ai++) {
      const off = ai * numDet;
      for (let i = 0; i < numDet; i++) {
        let acc = 0.25 * sinogram[off + i];
        for (let j = 0; j < numDet; j++) {
          const d = Math.abs(i - j);
          if (d > 0 && (d & 1) === 1) {
            acc -= sinogram[off + j] / (Math.PI * Math.PI * d * d);
          }
        }
        proc[off + i] = acc;
      }
    }
  } else {
    proc.set(sinogram);
  }

  const recon = new Float32Array(size * size);
  const scale = (Math.PI / numAngles) * (filtered ? numDet * 0.5 : 0.5);
  for (let ai = 0; ai < numAngles; ai++) {
    const theta = (Math.PI * ai) / numAngles;
    const ct = Math.cos(theta), st = Math.sin(theta);
    const off = ai * numDet;
    for (let r = 0; r < size; r++) {
      const y = 1 - (2 * (r + 0.5)) / size;
      for (let c = 0; c < size; c++) {
        const x = (2 * (c + 0.5)) / size - 1;
        const s = x * ct + y * st;
        const detF = ((s + 1) * 0.5) * numDet - 0.5;
        const d0 = Math.floor(detF);
        if (d0 >= 0 && d0 < numDet - 1) {
          const f = detF - d0;
          recon[r * size + c] += (proc[off + d0] * (1 - f) + proc[off + d0 + 1] * f) * scale;
        }
      }
    }
  }
  // Normalize cleanly for display while keeping non-negative attenuation
  let mx = 0;
  for (let i = 0; i < recon.length; i++) {
    if (recon[i] < 0) recon[i] = 0;
    if (recon[i] > mx) mx = recon[i];
  }
  if (mx > 1e-9) {
    for (let i = 0; i < recon.length; i++) recon[i] /= mx;
  }

  let rmse = 0, psnr = 0;
  if (reference && reference.length === recon.length) {
    let mse = 0;
    for (let i = 0; i < recon.length; i++) mse += (recon[i] - reference[i]) ** 2;
    mse /= recon.length;
    rmse = Math.sqrt(mse);
    psnr = mse > 1e-12 ? 10 * Math.log10(1 / mse) : 99;
  }
  return { recon, rmse, psnr };
}

export function simulateUltrasound(layers, freqMHz = 3.5) {
  // layers: [{ name, thicknessMm, c_ms, rho_kgm3, atten_dBcmMHz }]
  const echoes = [];
  let cumTimeUs = 0;
  let cumDepthMm = 0;
  let cumAttenDb = 0;
  let transProd = 1.0;

  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const Z1 = (L.rho_kgm3 * L.c_ms) / 1e6; // MRayl
    const dtUs = (2 * (L.thicknessMm * 1e-3) / L.c_ms) * 1e6; // round-trip µs
    const attenLayerDb = 2 * (L.thicknessMm / 10) * L.atten_dBcmMHz * freqMHz;
    cumTimeUs += dtUs;
    cumDepthMm += L.thicknessMm;
    cumAttenDb += attenLayerDb;

    if (i + 1 < layers.length) {
      const nxt = layers[i + 1];
      const Z2 = (nxt.rho_kgm3 * nxt.c_ms) / 1e6;
      const R = Math.pow((Z2 - Z1) / (Z2 + Z1), 2);
      const amp = transProd * Math.sqrt(R) * Math.pow(10, -cumAttenDb / 20);
      echoes.push({
        boundary: `${L.name} / ${nxt.name}`,
        depthMm: cumDepthMm,
        timeUs: cumTimeUs,
        Z1, Z2,
        reflCoeff: R,
        amp,
        attenDb: cumAttenDb,
      });
      transProd *= (1 - R);
    }
  }
  const totalTimeUs = Math.max(20, cumTimeUs * 1.15);
  const nPts = 320;
  const tSeries = [], aMode = [];
  for (let i = 0; i <= nPts; i++) {
    const ts = (totalTimeUs * i) / nPts;
    let sig = Math.exp(-0.5 * (ts / 0.8) ** 2); // initial transducer bang
    for (const e of echoes) {
      sig += e.amp * Math.exp(-0.5 * ((ts - e.timeUs) / 0.9) ** 2);
    }
    tSeries.push(ts);
    aMode.push(sig);
  }
  return { echoes, totalTimeUs, totalDepthMm: cumDepthMm, tSeries, aMode };
}

// =====================================================================
// FIELD 4: FİZİK & MATEMATİK (9 SIMULATIONS)
// =====================================================================

// ---------- 4.1 Waves & Interference ----------

export function rippleAmplitude({ s1 = [-1.5, 0], s2 = [1.5, 0], lambda = 1.0, dphi = 0, phaseT = 0, x = 0, y = 0 }) {
  const k = (2 * Math.PI) / Math.max(0.1, lambda);
  const r1 = Math.hypot(x - s1[0], y - s1[1]);
  const r2 = Math.hypot(x - s2[0], y - s2[1]);
  const a1 = Math.cos(k * r1 - phaseT) / Math.sqrt(r1 + 0.35);
  const a2 = Math.cos(k * r2 - phaseT + dphi) / Math.sqrt(r2 + 0.35);
  const dr = Math.abs(r1 - r2);
  return { amp: a1 + a2, r1, r2, pathDiff: dr, order: dr / lambda };
}

export function dopplerMetrics({ f0 = 440, c = 343, vs = 80, vo = 0 }) {
  const mach = vs / c;
  const fApproach = vs < c ? f0 * ((c + vo) / (c - vs)) : Infinity;
  const fRecede = f0 * ((c - vo) / (c + vs));
  const machAngleDeg = mach > 1 ? (Math.asin(1 / mach) * 180) / Math.PI : null;
  return { fApproach, fRecede, mach, machAngleDeg, lambdaFront: Math.max(0, (c - vs) / f0), lambdaBack: (c + vs) / f0 };
}

export function standingWaveMetrics({ n = 3, L = 1.2, T = 40, mu = 0.004 }) {
  const v = Math.sqrt(T / Math.max(1e-7, mu));
  const lambda = (2 * L) / n;
  const freq = (n * v) / (2 * L);
  const nodes = Array.from({ length: n + 1 }, (_, k) => (k * L) / n);
  const antinodes = Array.from({ length: n }, (_, k) => ((k + 0.5) * L) / n);
  return { v, lambda, freq, nodes, antinodes };
}

export function beatsTrace({ f1 = 12, f2 = 13.5, tEnd = 2.0, n = 400 }) {
  const t = [], y1 = [], y2 = [], sum = [], env = [];
  for (let i = 0; i <= n; i++) {
    const ti = (tEnd * i) / n;
    const v1 = Math.cos(2 * Math.PI * f1 * ti);
    const v2 = Math.cos(2 * Math.PI * f2 * ti);
    t.push(ti); y1.push(v1); y2.push(v2); sum.push(v1 + v2);
    env.push(2 * Math.abs(Math.cos(Math.PI * (f1 - f2) * ti)));
  }
  return { t, y1, y2, sum, env, fBeat: Math.abs(f1 - f2), fCarrier: 0.5 * (f1 + f2) };
}

// ---------- 4.2 Optics (Thin Lens/Mirror, Snell/TIR, Prism, Diffraction) ----------

export function solveThinOptics({ kind = 'convex-lens', fAbs = 15, do_ = 30, ho = 8 }) {
  const f = (kind === 'convex-lens' || kind === 'concave-mirror') ? Math.abs(fAbs) : -Math.abs(fAbs);
  const invDi = 1 / f - 1 / do_;
  if (Math.abs(invDi) < 1e-9) {
    return { f, di: Infinity, hi: Infinity, m: Infinity, real: false, inverted: false, atInfinity: true };
  }
  const di = 1 / invDi;
  const m = -di / do_;
  const hi = m * ho;
  return { f, di, hi, m, real: di > 0, inverted: m < 0, atInfinity: false };
}

export function solveSnell({ n1 = 1.5, n2 = 1.0, thetaDeg = 30 }) {
  const rad1 = (thetaDeg * Math.PI) / 180;
  const sin2 = (n1 / n2) * Math.sin(rad1);
  const criticalDeg = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;
  if (Math.abs(sin2) > 1 + 1e-12) {
    return { tir: true, thetaRefDeg: null, criticalDeg, fresnelR: 1.0, fresnelT: 0.0 };
  }
  const rad2 = Math.asin(Math.max(-1, Math.min(1, sin2)));
  const c1 = Math.cos(rad1), c2 = Math.cos(rad2);
  const rs = (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2);
  const rp = (n1 * c2 - n2 * c1) / (n1 * c2 + n2 * c1);
  const fresnelR = 0.5 * (rs * rs + rp * rp);
  return { tir: false, thetaRefDeg: (rad2 * 180) / Math.PI, criticalDeg, fresnelR, fresnelT: 1 - fresnelR };
}

export function cauchyIndex(lambdaNm, glass = 'flint') {
  const lamUm = lambdaNm / 1000;
  if (glass === 'crown') return 1.5046 + 0.00420 / (lamUm * lamUm);
  return 1.6014 + 0.00920 / (lamUm * lamUm); // F2 flint glass
}

export function solvePrismRay({ apexDeg = 60, thetaInDeg = 48, lambdaNm = 550, glass = 'flint' }) {
  const n = cauchyIndex(lambdaNm, glass);
  const A = (apexDeg * Math.PI) / 180;
  const i1 = (thetaInDeg * Math.PI) / 180;
  const r1 = Math.asin(Math.sin(i1) / n);
  const r2 = A - r1;
  const sinI2 = n * Math.sin(r2);
  if (Math.abs(sinI2) > 1) return { n, tir: true, r1Deg: (r1 * 180) / Math.PI, r2Deg: (r2 * 180) / Math.PI, thetaOutDeg: null, deviationDeg: null };
  const i2 = Math.asin(sinI2);
  const dev = i1 + i2 - A;
  return {
    n, tir: false,
    r1Deg: (r1 * 180) / Math.PI,
    r2Deg: (r2 * 180) / Math.PI,
    thetaOutDeg: (i2 * 180) / Math.PI,
    deviationDeg: (dev * 180) / Math.PI,
  };
}

export function diffractionPattern({ mode = 'double', aUm = 6, dUm = 24, N = 5, lambdaNm = 550, maxAngleDeg = 8, samples = 401 }) {
  const lamUm = lambdaNm / 1000;
  const slits = mode === 'single' ? 1 : mode === 'double' ? 2 : Math.max(2, Math.round(N));
  const angles = [], intensity = [], envelope = [];
  for (let i = 0; i < samples; i++) {
    const deg = -maxAngleDeg + (2 * maxAngleDeg * i) / (samples - 1);
    const sinT = Math.sin((deg * Math.PI) / 180);
    const beta = (Math.PI * aUm * sinT) / lamUm;
    const env = Math.abs(beta) < 1e-8 ? 1 : Math.pow(Math.sin(beta) / beta, 2);
    let interf = 1;
    if (slits > 1) {
      const alpha = (Math.PI * dUm * sinT) / lamUm;
      const sA = Math.sin(alpha);
      interf = Math.abs(sA) < 1e-8 ? 1 : Math.pow(Math.sin(slits * alpha) / (slits * sA), 2);
    }
    angles.push(deg);
    envelope.push(env);
    intensity.push(env * interf);
  }
  const firstMinDeg = lamUm / aUm <= 1 ? (Math.asin(lamUm / aUm) * 180) / Math.PI : null;
  const firstMaxDeg = slits > 1 && lamUm / dUm <= 1 ? (Math.asin(lamUm / dUm) * 180) / Math.PI : null;
  return { angles, intensity, envelope, firstMinDeg, firstMaxDeg };
}

export function wavelengthToRGB(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 750) { r = 1; }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

// ---------- 4.3 Chaos & Dynamical Systems ----------

export function doublePendulumDeriv([th1, w1, th2, w2], { m1 = 1, m2 = 1, L1 = 1, L2 = 1, g = 9.81 } = {}) {
  const d = th1 - th2;
  const sd = Math.sin(d), cd = Math.cos(d);
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
  const dw1 = (-g * (2 * m1 + m2) * Math.sin(th1) - m2 * g * Math.sin(th1 - 2 * th2) - 2 * sd * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) / (L1 * den);
  const dw2 = (2 * sd * (w1 * w1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(th1) + w2 * w2 * L2 * m2 * cd)) / (L2 * den);
  return [w1, dw1, w2, dw2];
}

export function doublePendulumStep(state, params = {}, dt = 0.01) {
  return rk4Step((_t, y) => doublePendulumDeriv(y, params), 0, state, dt);
}

export function doublePendulumEnergy([th1, w1, th2, w2], { m1 = 1, m2 = 1, L1 = 1, L2 = 1, g = 9.81 } = {}) {
  const T = 0.5 * (m1 + m2) * L1 * L1 * w1 * w1 + 0.5 * m2 * L2 * L2 * w2 * w2 + m2 * L1 * L2 * w1 * w2 * Math.cos(th1 - th2);
  const V = -(m1 + m2) * g * L1 * Math.cos(th1) - m2 * g * L2 * Math.cos(th2);
  return { T, V, E: T + V };
}

export function lorenzStep(state, { sigma = 10, rho = 28, beta = 8 / 3 } = {}, dt = 0.008) {
  return rk4Step((_t, [x, y, z]) => [sigma * (y - x), x * (rho - z) - y, x * y - beta * z], 0, state, dt);
}

export function logisticLyapunov(r, n = 1200) {
  let x = 0.4;
  for (let i = 0; i < 300; i++) x = r * x * (1 - x);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const deriv = Math.abs(r * (1 - 2 * x));
    sum += Math.log(Math.max(1e-12, deriv));
    x = r * x * (1 - x);
  }
  return sum / n;
}

export function logisticBifurcation({ rMin = 2.5, rMax = 4.0, rSteps = 260, burn = 200, keep = 56 } = {}) {
  const points = [];
  for (let i = 0; i <= rSteps; i++) {
    const r = rMin + ((rMax - rMin) * i) / rSteps;
    let x = 0.41;
    for (let k = 0; k < burn; k++) x = r * x * (1 - x);
    const vals = [];
    for (let k = 0; k < keep; k++) {
      x = r * x * (1 - x);
      vals.push(x);
    }
    points.push({ r, vals });
  }
  return points;
}

export function classifyLinear2D(a, b, c, d) {
  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;
  let eigenvalues, eigenvectors = [], type;

  if (disc >= 0) {
    const s = Math.sqrt(disc);
    const l1 = 0.5 * (trace + s), l2 = 0.5 * (trace - s);
    eigenvalues = [{ re: l1, im: 0 }, { re: l2, im: 0 }];
    for (const lam of [l1, l2]) {
      let vx, vy;
      if (Math.abs(b) > 1e-8) { vx = b; vy = lam - a; }
      else if (Math.abs(c) > 1e-8) { vx = lam - d; vy = c; }
      else { vx = Math.abs(lam - a) < 1e-8 ? 1 : 0; vy = vx ? 0 : 1; }
      const nrm = Math.hypot(vx, vy) || 1;
      eigenvectors.push([vx / nrm, vy / nrm]);
    }
    if (det < -1e-9) type = 'Eyer Noktası (Saddle)';
    else if (Math.abs(det) <= 1e-9) type = 'Dejenere (Sıfır Özdeğer)';
    else if (Math.abs(disc) <= 1e-9) type = trace < 0 ? 'Kararlı Dejenere Düğüm' : 'Kararsız Dejenere Düğüm';
    else type = trace < 0 ? 'Kararlı Düğüm (Stable Node)' : 'Kararsız Düğüm (Unstable Node)';
  } else {
    const re = 0.5 * trace, im = 0.5 * Math.sqrt(-disc);
    eigenvalues = [{ re, im }, { re, im: -im }];
    if (Math.abs(trace) < 1e-6) type = 'Merkez (Center)';
    else type = trace < 0 ? 'Kararlı Sarmal (Stable Spiral)' : 'Kararsız Sarmal (Unstable Spiral)';
  }
  return { trace, det, disc, eigenvalues, eigenvectors, type };
}

export function integrateLinear2D(a, b, c, d, x0, y0, tEnd = 5, steps = 160) {
  const dt = tEnd / steps;
  const f = (_t, [x, y]) => [a * x + b * y, c * x + d * y];
  let y = [x0, y0];
  const pts = [[x0, y0]];
  for (let i = 0; i < steps; i++) {
    y = rk4Step(f, 0, y, dt);
    if (!Number.isFinite(y[0]) || !Number.isFinite(y[1]) || Math.hypot(y[0], y[1]) > 50) break;
    pts.push([y[0], y[1]]);
  }
  return pts;
}

// ---------- 4.4 Numerical Methods ----------

export const ROOT_PRESETS = {
  cubic: { label: 'x³ − x − 2 = 0', f: x => x * x * x - x - 2, df: x => 3 * x * x - 1, a: 1, b: 2, x0: 1.8, exact: 1.5213797068045676 },
  cosx:  { label: 'cos(x) − x = 0', f: x => Math.cos(x) - x, df: x => -Math.sin(x) - 1, a: 0, b: 1.5, x0: 1.2, exact: 0.7390851332151607 },
  exp:   { label: 'e⁻ˣ − x = 0',    f: x => Math.exp(-x) - x, df: x => -Math.exp(-x) - 1, a: 0, b: 1.5, x0: 1.0, exact: 0.5671432904097838 },
  sqrt2: { label: 'x² − 2 = 0',     f: x => x * x - 2, df: x => 2 * x, a: 1, b: 2, x0: 2.0, exact: Math.SQRT2 },
};

export function findRootBisection(f, a, b, tol = 1e-8, maxIter = 40) {
  let lo = a, hi = b, flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) return { ok: false, error: 'f(a) ve f(b) zıt işaretli olmalı.', iters: [] };
  const iters = [];
  let mid = lo;
  for (let k = 1; k <= maxIter; k++) {
    mid = 0.5 * (lo + hi);
    const fmid = f(mid);
    const err = 0.5 * Math.abs(hi - lo);
    iters.push({ k, a: lo, b: hi, x: mid, fx: fmid, err });
    if (Math.abs(fmid) < tol || err < tol) return { ok: true, root: mid, iters, converged: true };
    if (flo * fmid <= 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return { ok: true, root: mid, iters, converged: false };
}

export function findRootNewton(f, df, x0, tol = 1e-10, maxIter = 30) {
  let x = x0;
  const iters = [];
  for (let k = 1; k <= maxIter; k++) {
    const fx = f(x), dfx = df(x);
    if (Math.abs(dfx) < 1e-13) return { ok: false, error: 'Türev sıfıra çok yakın!', iters };
    const xNext = x - fx / dfx;
    const err = Math.abs(xNext - x);
    iters.push({ k, x, xNext, fx, dfx, err });
    x = xNext;
    if (err < tol || Math.abs(f(x)) < tol) return { ok: true, root: x, iters, converged: true };
  }
  return { ok: true, root: x, iters, converged: false };
}

export function findRootSecant(f, x0, x1, tol = 1e-10, maxIter = 35) {
  let a = x0, b = x1;
  const iters = [];
  for (let k = 1; k <= maxIter; k++) {
    const fa = f(a), fb = f(b);
    if (Math.abs(fb - fa) < 1e-14) return { ok: false, error: 'Bölen sıfıra yakın!', iters };
    const c = b - fb * (b - a) / (fb - fa);
    const err = Math.abs(c - b);
    iters.push({ k, x: c, xPrev: b, fx: f(c), err });
    a = b; b = c;
    if (err < tol || Math.abs(f(c)) < tol) return { ok: true, root: c, iters, converged: true };
  }
  return { ok: true, root: b, iters, converged: false };
}

export function integrateTrapezoid(f, a, b, n = 10) {
  const N = Math.max(1, Math.round(n));
  const h = (b - a) / N;
  let sum = 0.5 * (f(a) + f(b));
  for (let i = 1; i < N; i++) sum += f(a + i * h);
  return sum * h;
}

export function integrateSimpson(f, a, b, n = 10) {
  const N = Math.max(2, Math.round(n) + (Math.round(n) % 2));
  const h = (b - a) / N;
  let sum = f(a) + f(b);
  for (let i = 1; i < N; i++) sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  return (sum * h) / 3;
}

const GL_TABLES = {
  2: { x: [-0.5773502691896257, 0.5773502691896257], w: [1, 1] },
  3: { x: [-0.7745966692414834, 0, 0.7745966692414834], w: [0.5555555555555556, 0.8888888888888888, 0.5555555555555556] },
  5: {
    x: [-0.906179845938664, -0.5384693101056831, 0, 0.5384693101056831, 0.906179845938664],
    w: [0.23692688505618908, 0.47862867049936647, 0.5688888888888889, 0.47862867049936647, 0.23692688505618908],
  },
};

export function integrateGaussLegendre(f, a, b, order = 5, panels = 1) {
  const tab = GL_TABLES[order] || GL_TABLES[5];
  const P = Math.max(1, Math.round(panels));
  const dp = (b - a) / P;
  let total = 0;
  for (let p = 0; p < P; p++) {
    const x0 = a + p * dp, x1 = x0 + dp;
    const mid = 0.5 * (x0 + x1), half = 0.5 * (x1 - x0);
    let s = 0;
    for (let i = 0; i < tab.x.length; i++) s += tab.w[i] * f(mid + half * tab.x[i]);
    total += half * s;
  }
  return total;
}

export const ODE_PRESETS = {
  decay: {
    label: "y' = −2y, y(0) = 1",
    f: (_t, y) => -2 * y,
    exact: t => Math.exp(-2 * t),
    y0: 1, tEnd: 3,
  },
  forced: {
    label: "y' = −y + sin(2t), y(0) = 1",
    f: (t, y) => -y + Math.sin(2 * t),
    exact: t => 1.4 * Math.exp(-t) + 0.2 * Math.sin(2 * t) - 0.4 * Math.cos(2 * t),
    y0: 1, tEnd: 5,
  },
  logistic: {
    label: "y' = y(1 − y), y(0) = 0.1",
    f: (_t, y) => y * (1 - y),
    exact: t => 1 / (1 + 9 * Math.exp(-t)),
    y0: 0.1, tEnd: 6,
  },
};

export function solveODECompare({ presetId = 'decay', h = 0.25 } = {}) {
  const p = ODE_PRESETS[presetId] || ODE_PRESETS.decay;
  const steps = Math.max(1, Math.round(p.tEnd / h));
  const dh = p.tEnd / steps;
  const t = [0], euler = [p.y0], heun = [p.y0], rk4 = [p.y0], exact = [p.y0];
  let ye = p.y0, yh = p.y0, yr = p.y0;
  let errE = 0, errH = 0, errR = 0;

  for (let i = 0; i < steps; i++) {
    const ti = i * dh, tNext = (i + 1) * dh;
    // Euler
    ye = ye + dh * p.f(ti, ye);
    // Heun (RK2)
    const k1h = p.f(ti, yh);
    const k2h = p.f(tNext, yh + dh * k1h);
    yh = yh + 0.5 * dh * (k1h + k2h);
    // RK4
    const k1 = p.f(ti, yr);
    const k2 = p.f(ti + 0.5 * dh, yr + 0.5 * dh * k1);
    const k3 = p.f(ti + 0.5 * dh, yr + 0.5 * dh * k2);
    const k4 = p.f(tNext, yr + dh * k3);
    yr = yr + (dh / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    const ex = p.exact(tNext);
    errE = Math.max(errE, Math.abs(ye - ex));
    errH = Math.max(errH, Math.abs(yh - ex));
    errR = Math.max(errR, Math.abs(yr - ex));
    t.push(tNext); euler.push(ye); heun.push(yh); rk4.push(yr); exact.push(ex);
  }
  return { t, euler, heun, rk4, exact, maxErr: { euler: errE, heun: errH, rk4: errR }, h: dh };
}

export function evalLagrange(xs, ys, x) {
  let sum = 0;
  const n = xs.length;
  for (let i = 0; i < n; i++) {
    let term = ys[i];
    for (let j = 0; j < n; j++) {
      if (i !== j) term *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    sum += term;
  }
  return sum;
}

export function chebyshevNodes(n, a = -1, b = 1) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const u = Math.cos(((2 * k + 1) * Math.PI) / (2 * n));
    out.push(0.5 * (a + b) + 0.5 * (b - a) * u);
  }
  return out.sort((x, y) => x - y);
}

/** Natural cubic spline interpolation on sorted xs. */
export function buildCubicSpline(xs, ys) {
  const n = xs.length - 1;
  const h = Array.from({ length: n }, (_, i) => xs[i + 1] - xs[i]);
  const alpha = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }
  const l = new Array(n + 1).fill(1), mu = new Array(n + 1).fill(0), z = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const c = new Array(n + 1).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return { xs: xs.slice(), a: ys.slice(), b, c, d };
}

export function evalCubicSpline(sp, x) {
  const n = sp.xs.length - 1;
  let i = 0;
  if (x >= sp.xs[n]) i = n - 1;
  else if (x > sp.xs[0]) {
    while (i < n - 1 && x > sp.xs[i + 1]) i++;
  }
  const dx = x - sp.xs[i];
  return sp.a[i] + sp.b[i] * dx + sp.c[i] * dx * dx + sp.d[i] * dx * dx * dx;
}

export function polyLeastSquares(xs, ys, deg = 2) {
  const m = Math.min(deg, xs.length - 1) + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const B = new Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < xs.length; k++) s += Math.pow(xs[k], i + j);
      A[i][j] = s;
    }
    let sb = 0;
    for (let k = 0; k < xs.length; k++) sb += ys[k] * Math.pow(xs[k], i);
    B[i] = sb;
  }
  const coeffs = solveLinearSystem(A, B) || new Array(m).fill(0);
  const evalFn = x => coeffs.reduce((s, c, p) => s + c * Math.pow(x, p), 0);
  const meanY = ys.reduce((s, v) => s + v, 0) / Math.max(1, ys.length);
  let sse = 0, sst = 0;
  for (let k = 0; k < xs.length; k++) {
    sse += (ys[k] - evalFn(xs[k])) ** 2;
    sst += (ys[k] - meanY) ** 2;
  }
  return { coeffs, eval: evalFn, rmse: Math.sqrt(sse / Math.max(1, xs.length)), r2: sst > 1e-12 ? 1 - sse / sst : 1 };
}

// ---------- 4.5 Quantum Mechanics ----------

export function boxEigen(n, L, x) {
  if (x < 0 || x > L) return 0;
  return Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);
}

export function hermitePoly(n, u) {
  if (n === 0) return 1;
  if (n === 1) return 2 * u;
  let h0 = 1, h1 = 2 * u;
  for (let k = 2; k <= n; k++) {
    const h2 = 2 * u * h1 - 2 * (k - 1) * h0;
    h0 = h1; h1 = h2;
  }
  return h1;
}

export function qhoEigen(n, x) {
  const norm = 1 / Math.sqrt(Math.pow(2, n) * factorial(n) * Math.sqrt(Math.PI));
  return norm * hermitePoly(n, x) * Math.exp(-0.5 * x * x);
}

export function superpositionWave({ system = 'box', n1 = 1, n2 = 2, mix = 0.5, t = 0, L = 1, samples = 240 }) {
  const c1 = Math.sqrt(1 - mix), c2 = Math.sqrt(mix);
  const E1 = system === 'box' ? n1 * n1 : (n1 + 0.5);
  const E2 = system === 'box' ? n2 * n2 : (n2 + 0.5);
  const xMin = system === 'box' ? 0 : -5;
  const xMax = system === 'box' ? L : 5;
  const xs = [], re = [], im = [], prob = [];
  let expX = 0, normAcc = 0;
  const dx = (xMax - xMin) / (samples - 1);

  for (let i = 0; i < samples; i++) {
    const x = xMin + i * dx;
    const p1 = system === 'box' ? boxEigen(n1, L, x) : qhoEigen(n1, x);
    const p2 = system === 'box' ? boxEigen(n2, L, x) : qhoEigen(n2, x);
    const r = c1 * p1 * Math.cos(E1 * t) + c2 * p2 * Math.cos(E2 * t);
    const imv = -(c1 * p1 * Math.sin(E1 * t) + c2 * p2 * Math.sin(E2 * t));
    const pr = r * r + imv * imv;
    xs.push(x); re.push(r); im.push(imv); prob.push(pr);
    const w = (i === 0 || i === samples - 1) ? 0.5 * dx : dx;
    expX += x * pr * w;
    normAcc += pr * w;
  }
  return { xs, re, im, prob, E1, E2, expX: expX / Math.max(1e-9, normAcc), norm: normAcc };
}

/** Exact quantum tunnelling through a rectangular barrier (units: hbar^2 / (2m) = 1). */
export function tunnelTransmission({ E = 4, V0 = 6, a = 1.2 }) {
  const e = Math.max(1e-5, E), v = Math.max(0, V0), w = Math.max(0, a);
  if (v <= 1e-9 || w <= 1e-9) return { T: 1, R: 0, k1: Math.sqrt(e), kappa: 0 };
  let T;
  if (Math.abs(e - v) < 1e-7) {
    T = 1 / (1 + (v * w * w) / 4);
  } else if (e < v) {
    const kappa = Math.sqrt(v - e);
    const sh = Math.sinh(kappa * w);
    T = 1 / (1 + (v * v * sh * sh) / (4 * e * (v - e)));
    return { T, R: 1 - T, k1: Math.sqrt(e), kappa };
  } else {
    const k2 = Math.sqrt(e - v);
    const s = Math.sin(k2 * w);
    T = 1 / (1 + (v * v * s * s) / (4 * e * (e - v)));
    return { T, R: 1 - T, k1: Math.sqrt(e), kappa: 0, k2 };
  }
  return { T, R: 1 - T, k1: Math.sqrt(e), kappa: 0 };
}

/** Generalized Laguerre polynomial L_p^(k)(x). */
export function assocLaguerre(p, k, x) {
  if (p <= 0) return 1;
  if (p === 1) return 1 + k - x;
  let L0 = 1, L1 = 1 + k - x;
  for (let i = 2; i <= p; i++) {
    const L2 = ((2 * i - 1 + k - x) * L1 - (i - 1 + k) * L0) / i;
    L0 = L1; L1 = L2;
  }
  return L1;
}

/** Associated Legendre polynomial P_l^m(x) for m >= 0 (without Condon-Shortley sign, squared in |Y_lm|^2). */
export function assocLegendre(l, m, x) {
  const mm = Math.abs(m);
  let pmm = 1;
  if (mm > 0) {
    const somx2 = Math.sqrt(Math.max(0, (1 - x) * (1 + x)));
    let fact = 1;
    for (let i = 1; i <= mm; i++) { pmm *= fact * somx2; fact += 2; }
  }
  if (l === mm) return pmm;
  let pmmp1 = x * (2 * mm + 1) * pmm;
  if (l === mm + 1) return pmmp1;
  let pll = 0;
  for (let ll = mm + 2; ll <= l; ll++) {
    pll = ((2 * ll - 1) * x * pmmp1 - (ll + mm - 1) * pmm) / (ll - mm);
    pmm = pmmp1; pmmp1 = pll;
  }
  return pll;
}

export function hydrogenRadialR(n, l, r) {
  const rho = (2 * r) / n;
  const norm = Math.sqrt(Math.pow(2 / n, 3) * (factorial(n - l - 1) / (2 * n * factorial(n + l))));
  return norm * Math.exp(-0.5 * rho) * Math.pow(rho, l) * assocLaguerre(n - l - 1, 2 * l + 1, rho);
}

export function hydrogenRadialProb(n, l, r) {
  const R = hydrogenRadialR(n, l, r);
  return r * r * R * R;
}

export function hydrogenWaveDensity(n, l, m, x, z) {
  const r = Math.hypot(x, z);
  const cosT = r > 1e-9 ? z / r : 1;
  const R = hydrogenRadialR(n, l, r);
  const mm = Math.abs(m);
  const yNormSq = ((2 * l + 1) / (4 * Math.PI)) * (factorial(l - mm) / factorial(l + mm));
  const P = assocLegendre(l, mm, cosT);
  return R * R * yNormSq * P * P;
}

// ---------- 4.6 Electromagnetism (Faraday Induction & LC Oscillation) ----------

export function magnetCoilFlux(x, { m = 2.0, coilR = 0.05 } = {}) {
  return (MU0 * m * coilR * coilR) / (2 * Math.pow(coilR * coilR + x * x, 1.5));
}

export function magnetCoilEmf(x, v, { N = 120, m = 2.0, coilR = 0.05 } = {}) {
  // E = -N dPhi/dt = -N (dPhi/dx) v = N * 3 * mu0 * m * R^2 * x * v / (2 (R^2 + x^2)^(5/2))
  return (N * 3 * MU0 * m * coilR * coilR * x * v) / (2 * Math.pow(coilR * coilR + x * x, 2.5));
}

export function simulateFaradayPass({ N = 120, R_ohm = 10, speed = 0.6, m = 2.0, coilR = 0.05, span = 0.25, n = 300 } = {}) {
  const tEnd = (2 * span) / Math.max(0.05, speed);
  const t = [], x = [], flux = [], emf = [], current = [];
  let maxEmf = 0, maxFlux = 0;
  for (let i = 0; i <= n; i++) {
    const ti = (tEnd * i) / n;
    const xi = -span + speed * ti;
    const ph = magnetCoilFlux(xi, { m, coilR });
    const em = magnetCoilEmf(xi, speed, { N, m, coilR });
    if (Math.abs(em) > maxEmf) maxEmf = Math.abs(em);
    if (ph > maxFlux) maxFlux = ph;
    t.push(ti); x.push(xi); flux.push(ph); emf.push(em); current.push(em / Math.max(0.1, R_ohm));
  }
  return { t, x, flux, emf, current, maxEmf, maxFlux, tEnd };
}

export function simulateLCEnergy({ L = 0.01, C = 100e-6, R = 0, V0 = 10, cycles = 3, n = 400 } = {}) {
  const omega0 = 1 / Math.sqrt(L * C);
  const f0 = omega0 / (2 * Math.PI);
  const T0 = 1 / f0;
  const tEnd = cycles * T0;
  const dt = tEnd / n;
  const deriv = (_t, [v, i]) => [-i / C, (v - R * i) / L];
  let y = [V0, 0];
  const t = [], V = [], I = [], UE = [], UB = [], Utot = [];
  for (let k = 0; k <= n; k++) {
    const ue = 0.5 * C * y[0] * y[0];
    const ub = 0.5 * L * y[1] * y[1];
    t.push(k * dt); V.push(y[0]); I.push(y[1]); UE.push(ue); UB.push(ub); Utot.push(ue + ub);
    if (k < n) y = rk4Step(deriv, k * dt, y, dt);
  }
  const Q = R > 1e-9 ? (1 / R) * Math.sqrt(L / C) : Infinity;
  return { t, V, I, UE, UB, Utot, f0, omega0, T0, Q, U0: 0.5 * C * V0 * V0 };
}

// ---------- 4.7 Relativity & Modern Physics ----------

export function lorentzMetrics(beta, L0 = 100, dt0 = 1.0) {
  const b = Math.max(0, Math.min(0.9995, beta));
  const gamma = 1 / Math.sqrt(1 - b * b);
  return {
    beta: b,
    gamma,
    L: L0 / gamma,
    dt: dt0 * gamma,
    momentumFactor: gamma * b,
    kineticFactor: gamma - 1,
    speedKmS: (b * C_LIGHT) / 1000,
  };
}

export const PHOTO_METALS = {
  Cs: { name: 'Sezyum (Cs)', phiEv: 2.14 },
  Na: { name: 'Sodyum (Na)', phiEv: 2.36 },
  Zn: { name: 'Çinko (Zn)',  phiEv: 4.30 },
  Cu: { name: 'Bakır (Cu)',  phiEv: 4.65 },
  Pt: { name: 'Platin (Pt)', phiEv: 5.65 },
};

export function solvePhotoelectric({ lambdaNm = 350, phiEv = 2.36, intensity = 1.0 }) {
  const photonEv = HC_EV_NM / Math.max(50, lambdaNm);
  const emitted = photonEv > phiEv;
  const kMaxEv = emitted ? photonEv - phiEv : 0;
  const vStop = kMaxEv; // in Volts (eV / e)
  const lambda0Nm = HC_EV_NM / phiEv;
  const fTHz = (C_LIGHT / (lambdaNm * 1e-9)) / 1e12;
  const f0THz = (C_LIGHT / (lambda0Nm * 1e-9)) / 1e12;
  const currentRel = emitted ? intensity : 0;
  return { emitted, photonEv, kMaxEv, vStop, lambda0Nm, fTHz, f0THz, currentRel };
}

export function solveCompton({ lambdaPm = 5.0, thetaDeg = 90 }) {
  const rad = (thetaDeg * Math.PI) / 180;
  const deltaLambdaPm = COMPTON_PM * (1 - Math.cos(rad));
  const lambdaOutPm = lambdaPm + deltaLambdaPm;
  const E_keV = HC_EV_NM / lambdaPm; // note: 1 eV·nm = 1 keV·pm!
  const Eout_keV = HC_EV_NM / lambdaOutPm;
  const Te_keV = Math.max(0, E_keV - Eout_keV);
  const alpha = E_keV / ME_C2_KEV;
  const tanHalf = Math.tan(rad / 2);
  const phiDeg = thetaDeg <= 1e-6 ? 90 : (Math.atan(1 / ((1 + alpha) * tanHalf)) * 180) / Math.PI;
  return { deltaLambdaPm, lambdaOutPm, E_keV, Eout_keV, Te_keV, phiDeg };
}

// ---------- 4.8 Vector Calculus & 3D Surfaces (Safe Expression Parser) ----------

const EXPR_FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, log: Math.log, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs,
  pow: Math.pow, min: Math.min, max: Math.max,
};

/** Safe pure-JS recursive descent compiler for 2D math expressions f(x, y). NO eval/Function. */
export function compileExpr2D(src) {
  const raw = String(src ?? '').trim();
  if (!raw) return { ok: false, error: 'İfade boş.' };
  const tokens = [];
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < raw.length && /[0-9.]/.test(raw[j])) j++;
      if (j < raw.length && (raw[j] === 'e' || raw[j] === 'E')) {
        j++;
        if (raw[j] === '+' || raw[j] === '-') j++;
        while (j < raw.length && /[0-9]/.test(raw[j])) j++;
      }
      const val = Number(raw.slice(i, j));
      if (!Number.isFinite(val)) return { ok: false, error: `Geçersiz sayı: ${raw.slice(i, j)}` };
      tokens.push({ t: 'num', v: val });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < raw.length && /[a-zA-Z0-9_]/.test(raw[j])) j++;
      tokens.push({ t: 'id', v: raw.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    if ('+-*/^(),'.includes(ch)) { tokens.push({ t: ch, v: ch }); i++; continue; }
    return { ok: false, error: `Geçersiz karakter: "${ch}"` };
  }
  // Insert implicit '*' between num/id/')' and id/'(' (when id is not a function call)
  const toks = [];
  for (let k = 0; k < tokens.length; k++) {
    const cur = tokens[k], nxt = tokens[k + 1];
    toks.push(cur);
    if (!nxt) continue;
    const isFuncCall = cur.t === 'id' && (cur.v in EXPR_FUNCS) && nxt.t === '(';
    if (!isFuncCall && (cur.t === 'num' || cur.t === 'id' || cur.t === ')') && (nxt.t === 'id' || nxt.t === '(')) {
      toks.push({ t: '*', v: '*' });
    }
  }

  let pos = 0;
  const peek = () => toks[pos];
  const consume = () => toks[pos++];

  function parseAdd() {
    let left = parseMul();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = consume().t, right = parseMul();
      const l = left, r = right;
      left = op === '+' ? (x, y) => l(x, y) + r(x, y) : (x, y) => l(x, y) - r(x, y);
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = consume().t, right = parseUnary();
      const l = left, r = right;
      left = op === '*' ? (x, y) => l(x, y) * r(x, y) : (x, y) => l(x, y) / r(x, y);
    }
    return left;
  }
  function parseUnary() {
    if (peek()?.t === '+') { consume(); return parseUnary(); }
    if (peek()?.t === '-') { consume(); const inner = parseUnary(); return (x, y) => -inner(x, y); }
    return parsePow();
  }
  function parsePow() {
    const base = parsePrimary();
    if (peek()?.t === '^') {
      consume();
      const exp = parseUnary();
      return (x, y) => Math.pow(base(x, y), exp(x, y));
    }
    return base;
  }
  function parsePrimary() {
    const tk = peek();
    if (!tk) throw new Error('Beklenmeyen ifade sonu.');
    if (tk.t === 'num') { consume(); const v = tk.v; return () => v; }
    if (tk.t === 'id') {
      consume();
      if (tk.v === 'x') return (x) => x;
      if (tk.v === 'y') return (_x, y) => y;
      if (tk.v === 'pi') return () => Math.PI;
      if (tk.v === 'e') return () => Math.E;
      if (tk.v in EXPR_FUNCS) {
        if (peek()?.t !== '(') throw new Error(`${tk.v} fonksiyonu '(' bekler.`);
        consume();
        const args = [parseAdd()];
        while (peek()?.t === ',') { consume(); args.push(parseAdd()); }
        if (peek()?.t !== ')') throw new Error(`Kapanmamış parantez (${tk.v}).`);
        consume();
        const fn = EXPR_FUNCS[tk.v];
        return args.length === 1 ? (x, y) => fn(args[0](x, y)) : (x, y) => fn(...args.map(a => a(x, y)));
      }
      throw new Error(`Tanımsız değişken/fonksiyon: ${tk.v}`);
    }
    if (tk.t === '(') {
      consume();
      const inner = parseAdd();
      if (peek()?.t !== ')') throw new Error('Kapanmamış parantez.');
      consume();
      return inner;
    }
    throw new Error(`Beklenmeyen simge: ${tk.v}`);
  }

  try {
    const fn = parseAdd();
    if (pos < toks.length) return { ok: false, error: `Fazla simge: "${toks[pos].v}"` };
    return { ok: true, fn };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function evalVectorField2D(fx, fy, x, y, eps = 1e-4) {
  const u = fx(x, y), v = fy(x, y);
  const dfx_dx = (fx(x + eps, y) - fx(x - eps, y)) / (2 * eps);
  const dfy_dy = (fy(x, y + eps) - fy(x, y - eps)) / (2 * eps);
  const dfy_dx = (fy(x + eps, y) - fy(x - eps, y)) / (2 * eps);
  const dfx_dy = (fx(x, y + eps) - fx(x, y - eps)) / (2 * eps);
  return { u, v, mag: Math.hypot(u, v), div: dfx_dx + dfy_dy, curl: dfy_dx - dfx_dy };
}

export function traceStreamline2D(fx, fy, x0, y0, { step = 0.08, maxSteps = 55, bound = 3.2 } = {}) {
  const traceDir = sign => {
    const pts = [];
    let x = x0, y = y0;
    for (let k = 0; k < maxSteps; k++) {
      const u1 = fx(x, y), v1 = fy(x, y);
      const m1 = Math.hypot(u1, v1);
      if (!Number.isFinite(m1) || m1 < 1e-5) break;
      const dx1 = (sign * step * u1) / m1, dy1 = (sign * step * v1) / m1;
      const u2 = fx(x + 0.5 * dx1, y + 0.5 * dy1), v2 = fy(x + 0.5 * dx1, y + 0.5 * dy1);
      const m2 = Math.hypot(u2, v2);
      if (!Number.isFinite(m2) || m2 < 1e-5) break;
      x += (sign * step * u2) / m2;
      y += (sign * step * v2) / m2;
      if (Math.abs(x) > bound || Math.abs(y) > bound) break;
      pts.push([x, y]);
    }
    return pts;
  };
  const back = traceDir(-1).reverse();
  const fwd = traceDir(1);
  return [...back, [x0, y0], ...fwd];
}

export function computeLineIntegral2D(fx, fy, pts) {
  if (!pts || pts.length < 2) return { work: 0, flux: 0, length: 0 };
  let work = 0, flux = 0, length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const dx = x1 - x0, dy = y1 - y0;
    const xm = 0.5 * (x0 + x1), ym = 0.5 * (y0 + y1);
    const u = fx(xm, ym), v = fy(xm, ym);
    if (Number.isFinite(u) && Number.isFinite(v)) {
      work += u * dx + v * dy;
      flux += u * dy - v * dx;
    }
    length += Math.hypot(dx, dy);
  }
  return { work, flux, length };
}

export function sampleSurfaceGrid(fz, range = 2.4, N = 22) {
  const xs = [], ys = [], Z = [];
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i <= N; i++) {
    const v = -range + (2 * range * i) / N;
    xs.push(v); ys.push(v);
  }
  for (let j = 0; j <= N; j++) {
    const row = [];
    for (let i = 0; i <= N; i++) {
      const z = fz(xs[i], ys[j]);
      const zv = Number.isFinite(z) ? Math.max(-10, Math.min(10, z)) : 0;
      if (zv < zMin) zMin = zv;
      if (zv > zMax) zMax = zv;
      row.push(zv);
    }
    Z.push(row);
  }
  return { xs, ys, Z, zMin, zMax };
}

export function surfaceGradient(fz, x, y, eps = 1e-4) {
  const gx = (fz(x + eps, y) - fz(x - eps, y)) / (2 * eps);
  const gy = (fz(x, y + eps) - fz(x, y - eps)) / (2 * eps);
  return { gx, gy, mag: Math.hypot(gx, gy) };
}

// ---------- 4.9 Probability Geometry (Buffon, Random Walk, Galton Board) ----------

export function buffonExactProb(L, d) {
  if (L <= 0 || d <= 0) return 0;
  if (L <= d) return (2 * L) / (Math.PI * d);
  // Exact long-needle (L > d) Buffon probability
  const r = d / L;
  return (2 / Math.PI) * ((L / d) * (1 - Math.sqrt(1 - r * r)) + Math.acos(r));
}

export function buffonDropBatch({ L = 0.8, d = 1.0, count = 200, seed = 61 }) {
  const rng = typeof seed === 'function' ? seed : makeRng(seed);
  let crossings = 0;
  const needles = [];
  for (let i = 0; i < count; i++) {
    const yc = rng() * d; // center distance in [0, d)
    const xc = rng();
    const angle = rng() * Math.PI;
    const halfY = 0.5 * L * Math.sin(angle);
    const crosses = (yc - halfY <= 0) || (yc + halfY >= d);
    if (crosses) crossings++;
    needles.push({ xc, yc, angle, crosses });
  }
  const piEst = (L <= d && crossings > 0) ? (2 * L * count) / (d * crossings) : NaN;
  return { needles, crossings, total: count, piEst, exactProb: buffonExactProb(L, d) };
}

export function createRandomWalkEnsemble({ dim = 2, count = 240, stepLen = 1, seed = 83 }) {
  const rng = makeRng(seed);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  return { dim, count, stepLen, rng, xs, ys, steps: 0, msdHistory: [0] };
}

export function stepRandomWalkEnsemble(ens) {
  const { dim, count, stepLen, rng, xs, ys } = ens;
  let sqSum = 0;
  for (let i = 0; i < count; i++) {
    if (dim === 1) {
      xs[i] += rng() < 0.5 ? stepLen : -stepLen;
      sqSum += xs[i] * xs[i];
    } else {
      const a = rng() * 2 * Math.PI;
      xs[i] += stepLen * Math.cos(a);
      ys[i] += stepLen * Math.sin(a);
      sqSum += xs[i] * xs[i] + ys[i] * ys[i];
    }
  }
  ens.steps++;
  const msd = sqSum / Math.max(1, count);
  ens.msdHistory.push(msd);
  return { steps: ens.steps, msd, theoMsd: ens.steps * stepLen * stepLen };
}

export function galtonBinomialPMF(rows = 12, p = 0.5) {
  const N = Math.max(1, Math.round(rows));
  const pr = Math.max(0.01, Math.min(0.99, p));
  const pmf = [];
  for (let k = 0; k <= N; k++) {
    pmf.push(Math.exp(logFactorial(N) - logFactorial(k) - logFactorial(N - k) + k * Math.log(pr) + (N - k) * Math.log(1 - pr)));
  }
  return pmf;
}

export function galtonDropBatch({ rows = 12, p = 0.5, count = 500, seed = 97 }) {
  const rng = typeof seed === 'function' ? seed : makeRng(seed);
  const bins = new Array(rows + 1).fill(0);
  let sum = 0, sumSq = 0;
  for (let i = 0; i < count; i++) {
    let k = 0;
    for (let r = 0; r < rows; r++) if (rng() < p) k++;
    bins[k]++;
    sum += k; sumSq += k * k;
  }
  const mean = sum / Math.max(1, count);
  const std = Math.sqrt(Math.max(0, sumSq / Math.max(1, count) - mean * mean));
  return { bins, total: count, mean, std, theoMean: rows * p, theoStd: Math.sqrt(rows * p * (1 - p)), pmf: galtonBinomialPMF(rows, p) };
}
