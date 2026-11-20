// MathPad Group Theory Study Center (Grup Teorisi Merkezi) — 10 interactive simulations.
import { esc, icon, toast } from './ui.js';
import { motion, full, asleep, constellationBurst, syncSegments } from './fx.js';
import {
  PERM_CONVENTION,
  cyclic,
  dihedral,
  symmetric,
  alternating,
  kleinFour,
  quaternion,
  unitGroup,
  directProduct,
  cubeRotations,
  buildGroup,
  elemLatex,
  order,
  orders,
  elementOrders,
  isAbelian,
  exponent,
  generate,
  subgroups,
  isSubgroup,
  isNormal,
  leftCosets,
  rightCosets,
  index,
  conjugacyClasses,
  center,
  centralizer,
  normalizer,
  commutatorSubgroup,
  quotient,
  isCyclic,
  cyclicGenerators,
  minimalGeneratingSet,
  isIsomorphic,
  identifyGroup,
  parseCycles,
  composePerm,
  invertPerm,
  formatCycles,
  formatCyclesLatex,
  cycleType,
  permOrder,
  permSign,
  toTranspositions,
  twoLineNotation,
  puzzleSolvability,
  extendHomomorphism,
  subgroupAsGroup,
  isSimple,
  cayleyGraph,
  subgroupLattice,
  generateQuizQuestion,
  primeFactors,
  sylowSubgroups,
} from './group.js';

export const GROUP_TABS = [
  { id: 'kesif',        icon: 'sparkle', title: 'Keşif' },
  { id: 'cayley',       icon: 'grid',    title: 'Cayley Tablosu' },
  { id: 'simetri',      icon: 'rotate',  title: 'Simetri Lab' },
  { id: 'permutasyon',  icon: 'arrow',   title: 'Permütasyonlar' },
  { id: 'graf',         icon: 'atom',    title: 'Cayley Grafiği' },
  { id: 'altgrup',      icon: 'matrix',  title: 'Alt Gruplar & Kafes' },
  { id: 'eslenik',      icon: 'ellipse', title: 'Eşlenik & Merkez' },
  { id: 'homomorfizma', icon: 'phasor',  title: 'Homomorfizma' },
  { id: 'teoremler',    icon: 'book',    title: 'Teoremler' },
  { id: 'quiz',         icon: 'star',    title: 'Alıştırma & Quiz' },
];

const GROUP_STORE_KEY = 'mp.group';
const QUIZ_STORE_KEY = 'mp.groupQuiz';

// ---------- Shared helpers: KaTeX, colors, caching, lifecycle, canvas ----------

function tex(s, displayMode = false) {
  if (typeof window !== 'undefined' && window.katex) {
    return window.katex.renderToString(String(s ?? ''), {
      throwOnError: false,
      strict: false,
      displayMode,
    });
  }
  return `<span class="mono">${esc(s)}</span>`;
}

function richTex(str) {
  const slots = [];
  const hold = (t, disp) => {
    slots.push(tex(t.trim(), disp));
    return `\u0000${slots.length - 1}\u0000`;
  };
  let s = String(str ?? '')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => hold(t, true))
    .replace(/\$([^$\n]+?)\$/g, (_, t) => hold(t, false));
  s = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
}

function accentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#f4f4f5';
}

function elemHue(idx) {
  return Math.round(((idx - 1) * 137.508) % 360);
}

function elemColor(idx) {
  if (idx === 0) return '#f4f4f5';
  return `hsl(${elemHue(idx)} 74% 62%)`;
}

function elemBg(idx, alpha = 0.25) {
  if (idx === 0) return `rgba(244, 244, 245, ${(alpha * 0.65).toFixed(2)})`;
  return `hsla(${elemHue(idx)}, 72%, 50%, ${alpha})`;
}

const GEN_PALETTE = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee', '#f97316'];

function createCleanup() {
  const fns = [];
  return {
    add(fn) { if (typeof fn === 'function') fns.push(fn); },
    run() { while (fns.length) try { fns.pop()(); } catch { } },
  };
}

// LRU cache for built groups so group.js WeakMap caches persist across tab switches
const GROUP_CACHE = new Map();
function getGroupFromSpec(spec) {
  const key = JSON.stringify(spec);
  if (GROUP_CACHE.has(key)) return GROUP_CACHE.get(key);
  const G = buildGroup(spec);
  if (GROUP_CACHE.size > 40) {
    const firstKey = GROUP_CACHE.keys().next().value;
    GROUP_CACHE.delete(firstKey);
  }
  GROUP_CACHE.set(key, G);
  return G;
}

function loadSavedSpec() {
  try {
    const raw = localStorage.getItem(GROUP_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      getGroupFromSpec(parsed); // validate
      return parsed;
    }
  } catch { }
  return { kind: 'D', n: 4 };
}

function saveSpec(spec) {
  try { localStorage.setItem(GROUP_STORE_KEY, JSON.stringify(spec)); } catch { }
}

// Yield one frame for heavy computations (e.g. subgroups of S5) so loader renders cleanly
function deferTask(fn, heavy = false) {
  if (!heavy) return Promise.resolve().then(fn);
  return new Promise(res => setTimeout(() => res(fn()), 16));
}

// Responsive HiDPI canvas with ResizeObserver & theme redraw
function setupCanvas(cv, heightForWidth, onDraw, clean) {
  let W = 320, H = 260, dpr = 1;
  const resize = () => {
    const host = cv.parentElement;
    if (!host) return;
    const cw = Math.max(200, Math.floor(host.clientWidth));
    const ch = Math.max(160, Math.floor(heightForWidth(cw)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cw;
    H = ch;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    render();
  };
  const render = () => {
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onDraw(ctx, W, H);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro && cv.parentElement) ro.observe(cv.parentElement);
  const onTheme = () => render();
  window.addEventListener('mp-theme', onTheme);
  clean.add(() => {
    ro?.disconnect();
    window.removeEventListener('mp-theme', onTheme);
  });
  resize();
  return {
    render,
    resize,
    size: () => ({ W, H }),
  };
}

// Power-aware single rAF loop that pauses automatically on asleep() and resumes on mp-vis
function createAnimLoop(tick, clean) {
  let raf = 0, want = false, dead = false, last = 0;
  const step = now => {
    raf = 0;
    if (dead || !want || asleep()) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const keep = tick(now, dt);
    if (keep && want && !dead && !asleep()) {
      raf = requestAnimationFrame(step);
    } else if (!keep) {
      want = false;
    }
  };
  const start = () => {
    if (dead) return;
    want = true;
    if (!raf && !asleep()) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };
  const stop = () => {
    want = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  const onVis = () => {
    if (dead) return;
    if (asleep()) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    } else if (want && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };
  window.addEventListener('mp-vis', onVis);
  clean.add(() => {
    dead = true;
    stop();
    window.removeEventListener('mp-vis', onVis);
  });
  return { start, stop, isRunning: () => want };
}

// Reusable compact colored HTML Cayley table builder (used by Tab 2, Tab 3, Tab 6, Tab 8)
function renderHtmlCayleyTable(G, {
  orderIdx = null,
  blockSize = 0,
  subSet = null,
  activeCell = null,
  latinTarget = null,
  compact = false,
  ariaLabel = 'Cayley tablosu',
} = {}) {
  const ord = orderIdx || Array.from({ length: G.size }, (_, i) => i);
  const n = ord.length;
  const op = G.meta?.operation || '·';
  const headCells = ord.map((g, ci) => {
    const cls = [];
    if (subSet?.has(g)) cls.push('grp-c-sub');
    if (blockSize > 0 && ci < n - 1 && (ci + 1) % blockSize === 0) cls.push('grp-blk-r');
    return `<th scope="col" class="${cls.join(' ')}" data-col="${g}">${esc(G.elements[g])}</th>`;
  }).join('');

  const bodyRows = ord.map((a, ri) => {
    const rowCls = [];
    if (subSet?.has(a)) rowCls.push('grp-c-sub');
    const isBlkB = blockSize > 0 && ri < n - 1 && (ri + 1) % blockSize === 0;
    if (isBlkB) rowCls.push('grp-blk-b');
    const tds = ord.map((b, ci) => {
      const c = G.mul(a, b);
      const cls = [];
      if (isBlkB) cls.push('grp-blk-b');
      if (blockSize > 0 && ci < n - 1 && (ci + 1) % blockSize === 0) cls.push('grp-blk-r');
      if (subSet && subSet.has(a) && subSet.has(b)) cls.push('grp-c-sub');
      if (activeCell) {
        if (activeCell[0] === a && activeCell[1] === b) cls.push('grp-c-active');
        else if (activeCell[0] === a || activeCell[1] === b) cls.push('grp-c-cross');
      }
      if (latinTarget != null) {
        if (c === latinTarget) cls.push('grp-c-latin');
        else cls.push('grp-c-dim');
      }
      return `<td class="${cls.join(' ')}" data-a="${a}" data-b="${b}" data-c="${c}" style="background:${elemBg(c, 0.28)}" title="${esc(`${G.elements[a]} ${op} ${G.elements[b]} = ${G.elements[c]}`)}">${esc(G.elements[c])}</td>`;
    }).join('');
    return `<tr><th scope="row" class="${rowCls.join(' ')}" data-row="${a}">${esc(G.elements[a])}</th>${tds}</tr>`;
  }).join('');

  return `<div class="grp-table-wrap"><table class="grp-cayley-tbl ${compact ? 'compact' : ''}" aria-label="${esc(ariaLabel)}">
    <thead><tr><th scope="col">${esc(op)}</th>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody></table></div>`;
}

// ---------- Shared Group Picker ----------

const QUICK_GROUPS = [
  { label: 'Z₆', spec: { kind: 'Z', n: 6 } },
  { label: 'Z₁₂', spec: { kind: 'Z', n: 12 } },
  { label: 'V₄', spec: { kind: 'V4' } },
  { label: 'D₃', spec: { kind: 'D', n: 3 } },
  { label: 'D₄', spec: { kind: 'D', n: 4 } },
  { label: 'Q₈', spec: { kind: 'Q8' } },
  { label: 'S₃', spec: { kind: 'S', n: 3 } },
  { label: 'S₄', spec: { kind: 'S', n: 4 } },
  { label: 'A₄', spec: { kind: 'A', n: 4 } },
  { label: 'A₅', spec: { kind: 'A', n: 5 } },
  { label: 'U(8)', spec: { kind: 'U', n: 8 } },
  { label: 'U(10)', spec: { kind: 'U', n: 10 } },
  { label: 'Z₂×Z₃', spec: { kind: 'Prod', left: { kind: 'Z', n: 2 }, right: { kind: 'Z', n: 3 } } },
  { label: 'Küp', spec: { kind: 'Cube' } },
];

const PROD_FACTORS = [
  { key: 'Z2', label: 'Z₂', spec: { kind: 'Z', n: 2 }, order: 2 },
  { key: 'Z3', label: 'Z₃', spec: { kind: 'Z', n: 3 }, order: 3 },
  { key: 'Z4', label: 'Z₄', spec: { kind: 'Z', n: 4 }, order: 4 },
  { key: 'Z5', label: 'Z₅', spec: { kind: 'Z', n: 5 }, order: 5 },
  { key: 'Z6', label: 'Z₆', spec: { kind: 'Z', n: 6 }, order: 6 },
  { key: 'Z8', label: 'Z₈', spec: { kind: 'Z', n: 8 }, order: 8 },
  { key: 'V4', label: 'V₄', spec: { kind: 'V4' }, order: 4 },
  { key: 'D3', label: 'D₃', spec: { kind: 'D', n: 3 }, order: 6 },
  { key: 'D4', label: 'D₄', spec: { kind: 'D', n: 4 }, order: 8 },
  { key: 'Q8', label: 'Q₈', spec: { kind: 'Q8' }, order: 8 },
  { key: 'S3', label: 'S₃', spec: { kind: 'S', n: 3 }, order: 6 },
  { key: 'A4', label: 'A₄', spec: { kind: 'A', n: 4 }, order: 12 },
];

function specKey(s) { return JSON.stringify(s); }

function factorKeyOf(spec) {
  const f = PROD_FACTORS.find(x => specKey(x.spec) === specKey(spec));
  return f ? f.key : 'Z2';
}

function renderPicker(host, curSpec, G, onPick) {
  const ab = isAbelian(G), cyc = isCyclic(G);
  const k = curSpec.kind;
  const needN = k === 'Z' || k === 'D' || k === 'S' || k === 'A' || k === 'U';
  const limits = { Z: [1, 60], D: [3, 12], S: [2, 5], A: [3, 5], U: [2, 60] }[k] || [2, 12];
  const leftKey = k === 'Prod' ? factorKeyOf(curSpec.left) : 'Z2';
  const rightKey = k === 'Prod' ? factorKeyOf(curSpec.right) : 'Z3';

  host.innerHTML = `<div class="grp-picker">
    <div class="grp-picker-top">
      <div class="grp-active-badge">
        <span class="grp-active-sym">${tex(G.latex)}</span>
        <div class="grp-active-meta">
          <b>${esc(G.meta?.turkishName || G.name)}</b>
          <span class="grp-pill acc">${tex(`|G| = ${G.size}`)}</span>
          <span class="grp-pill ${ab ? 'ok' : ''}">${ab ? 'Abelyen' : 'Değişmeli değil'}</span>
          ${cyc ? '<span class="grp-pill acc">Devirli</span>' : ''}
        </div>
      </div>
    </div>
    <div class="grp-chips" role="group" aria-label="Hızlı grup seçimi">
      ${QUICK_GROUPS.map((q, i) => `<button type="button" class="grp-chip ${specKey(q.spec) === specKey(curSpec) ? 'on' : ''}" data-q="${i}" aria-label="Grup seç: ${esc(q.label)}">${esc(q.label)}</button>`).join('')}
    </div>
    <div class="grp-builder">
      <span class="grp-builder-lbl">Özel grup:</span>
      <select class="inp grp-sel" data-fam aria-label="Grup ailesi">
        <option value="Z" ${k === 'Z' ? 'selected' : ''}>Z_n · Devirli (n ≤ 60)</option>
        <option value="D" ${k === 'D' ? 'selected' : ''}>D_n · Dihedral (n ≤ 12)</option>
        <option value="S" ${k === 'S' ? 'selected' : ''}>S_n · Simetrik (n ≤ 5)</option>
        <option value="A" ${k === 'A' ? 'selected' : ''}>A_n · Alternatif (n ≤ 5)</option>
        <option value="V4" ${k === 'V4' ? 'selected' : ''}>V₄ · Klein dörtlü</option>
        <option value="Q8" ${k === 'Q8' ? 'selected' : ''}>Q₈ · Kuaterniyon</option>
        <option value="U" ${k === 'U' ? 'selected' : ''}>U(n) · Birimler (n ≤ 60)</option>
        <option value="Cube" ${k === 'Cube' ? 'selected' : ''}>Küp (SO₃ ≅ S₄)</option>
        <option value="Prod" ${k === 'Prod' ? 'selected' : ''}>G × H · Direkt çarpım</option>
      </select>
      ${needN ? `<label class="row" style="gap:6px"><span class="mute small">n =</span><input type="number" class="inp mono grp-num" data-n min="${limits[0]}" max="${limits[1]}" value="${curSpec.n ?? limits[0]}" aria-label="Grup parametresi n"></label>` : ''}
      ${k === 'Prod' ? `
        <select class="inp grp-sel" data-pl aria-label="Sol çarpan">${PROD_FACTORS.map(f => `<option value="${f.key}" ${f.key === leftKey ? 'selected' : ''}>${esc(f.label)} (|G|=${f.order})</option>`).join('')}</select>
        <span class="mono mute">×</span>
        <select class="inp grp-sel" data-pr aria-label="Sağ çarpan">${PROD_FACTORS.map(f => `<option value="${f.key}" ${f.key === rightKey ? 'selected' : ''}>${esc(f.label)} (|H|=${f.order})</option>`).join('')}</select>` : ''}
      ${needN || k === 'Prod' ? `<button type="button" class="btn small" data-apply aria-label="Grubu uygula">Uygula</button>` : ''}
    </div>
  </div>`;

  host.querySelectorAll('[data-q]').forEach(btn => {
    btn.onclick = () => onPick(QUICK_GROUPS[+btn.dataset.q].spec);
  });

  const famSel = host.querySelector('[data-fam]');
  const applyCustom = () => {
    const fam = famSel.value;
    if (fam === 'V4' || fam === 'Q8' || fam === 'Cube') return onPick({ kind: fam });
    if (fam === 'Prod') {
      const fl = PROD_FACTORS.find(f => f.key === host.querySelector('[data-pl]')?.value) || PROD_FACTORS[0];
      const fr = PROD_FACTORS.find(f => f.key === host.querySelector('[data-pr]')?.value) || PROD_FACTORS[1];
      if (fl.order * fr.order > 120) {
        toast(`Direkt çarpım mertebesi 120'yi aşmamalı (${fl.order * fr.order})`);
        return;
      }
      return onPick({ kind: 'Prod', left: fl.spec, right: fr.spec });
    }
    const lim = { Z: [1, 60], D: [3, 12], S: [2, 5], A: [3, 5], U: [2, 60] }[fam];
    const inp = host.querySelector('[data-n]');
    let val = inp ? Math.trunc(+inp.value) : (fam === 'Z' ? 8 : fam === 'U' ? 10 : fam === 'D' ? 4 : 4);
    if (!Number.isFinite(val)) val = lim[0];
    val = Math.max(lim[0], Math.min(lim[1], val));
    onPick({ kind: fam, n: val });
  };

  famSel.onchange = () => {
    const fam = famSel.value;
    if (fam === 'V4' || fam === 'Q8' || fam === 'Cube') onPick({ kind: fam });
    else if (fam === 'Prod') onPick({ kind: 'Prod', left: { kind: 'Z', n: 2 }, right: { kind: 'Z', n: 3 } });
    else {
      const defN = { Z: 8, D: 4, S: 4, A: 4, U: 10 }[fam];
      onPick({ kind: fam, n: defN });
    }
  };
  host.querySelector('[data-apply]')?.addEventListener('click', applyCustom);
  host.querySelector('[data-n]')?.addEventListener('keydown', e => { if (e.key === 'Enter') applyCustom(); });
  host.querySelector('[data-pl]')?.addEventListener('change', applyCustom);
  host.querySelector('[data-pr]')?.addEventListener('change', applyCustom);
}

// =====================================================================
// TAB 1: KEŞİF (Overview)
// =====================================================================
function mountOverview(host, G, ctx) {
  const ab = isAbelian(G);
  const cyc = isCyclic(G);
  const expVal = exponent(G);
  const Z = center(G);
  const comm = commutatorSubgroup(G);
  const classes = conjugacyClasses(G);
  const ordMap = orders(G);
  const eo = elementOrders(G);
  const minGens = minimalGeneratingSet(G);
  const cycGens = cyc ? cyclicGenerators(G) : [];
  const ident = identifyGroup(G);

  const nonCentralSizes = classes.filter(c => c.length > 1).map(c => c.length).sort((a, b) => a - b);
  const classEqTex = nonCentralSizes.length
    ? `${G.size} = ${Z.length} + ${nonCentralSizes.join(' + ')}`
    : `${G.size} = ${Z.length} \\quad \\text{(her eleman merkezde)}`;

  const maxCount = Math.max(1, ...ordMap.values());
  let selectedOrd = null;
  let selectedElem = G.size > 1 ? 1 : 0;

  host.innerHTML = `<div class="grp-stage">
    <div class="grp-kpis">
      <div class="grp-kpi acc"><span class="grp-kpi-lbl">Mertebe</span><span class="grp-kpi-val">${tex(`|G| = ${G.size}`)}</span><span class="grp-kpi-sub">${primeFactors(G.size).map(([p, e]) => e > 1 ? `${p}^${e}` : `${p}`).join(' · ') || '1'}</span></div>
      <div class="grp-kpi"><span class="grp-kpi-lbl">Değişmeli (Abelyen)</span><span class="grp-kpi-val">${ab ? 'Evet ✓' : 'Hayır ✗'}</span><span class="grp-kpi-sub">|[G,G]| = ${comm.length}</span></div>
      <div class="grp-kpi"><span class="grp-kpi-lbl">Devirli (Cyclic)</span><span class="grp-kpi-val">${cyc ? 'Evet ✓' : 'Hayır ✗'}</span><span class="grp-kpi-sub">${cyc ? `${cycGens.length} üreteç` : `maks. mertebe ${Math.max(...ordMap.keys())}`}</span></div>
      <div class="grp-kpi"><span class="grp-kpi-lbl">Merkez |Z(G)|</span><span class="grp-kpi-val mono">${Z.length}</span><span class="grp-kpi-sub">${Z.length === G.size ? 'Z(G) = G' : Z.length === 1 ? 'Aşikar merkez' : `Z(G) ◁ G`}</span></div>
      <div class="grp-kpi"><span class="grp-kpi-lbl">Üs (Exponent)</span><span class="grp-kpi-val">${tex(`\\exp(G) = ${expVal}`)}</span><span class="grp-kpi-sub">ekok(|g|)</span></div>
      <div class="grp-kpi"><span class="grp-kpi-lbl">Eşlenik sınıf</span><span class="grp-kpi-val mono">${classes.length}</span><span class="grp-kpi-sub">sınıf sayısı k(G)</span></div>
      <div class="grp-kpi" data-sub-kpi><span class="grp-kpi-lbl">Alt grup / Basitlik</span><span class="grp-kpi-val"><span class="orbit-loader"></span></span><span class="grp-kpi-sub">hesaplanıyor…</span></div>
    </div>

    ${ident && ident.label !== G.name ? `<div class="grp-callout">
      <div>
        <div class="grp-panel-title">İzomorfizma İpucu</div>
        <div style="margin-top:4px">${tex(`${G.latex} \\cong ${ident.latex}`)}</div>
      </div>
      <span class="grp-pill acc">Yapısal eşdeğerlik</span>
    </div>` : ''}

    <div class="grp-grid-2">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Sınıf Denklemi</h3>
          <span class="grp-pill">${tex('|G| = |Z(G)| + \\sum [G:C_G(a)]')}</span>
        </div>
        <div class="grp-math-box">${tex(classEqTex, true)}</div>
        <div class="grp-panel-head"><h3 class="grp-panel-title">Üreteçler</h3><span class="mute small">Minimal boyut: ${minGens.length}</span></div>
        <div class="grp-math-box">${tex(`${G.latex} = \\langle ${minGens.map(i => elemLatex(G, i)).join(',\\, ')} \\rangle`)}</div>
        ${cyc ? `<div class="small mute">Tüm devirli üreteçler (${cycGens.length} adet, ${tex(`\\varphi(${G.size}) = ${cycGens.length}`)}):</div>
          <div class="grp-elems">${cycGens.slice(0, 32).map(i => `<button type="button" class="grp-el" data-inspect="${i}">${tex(elemLatex(G, i))}</button>`).join('')}${cycGens.length > 32 ? `<span class="mute small">+${cycGens.length - 32} daha</span>` : ''}</div>` : ''}
        <div class="grp-panel-head"><h3 class="grp-panel-title">Merkez Z(G) ve Komütatör [G, G]</h3></div>
        <div class="small mute">Merkez (${Z.length} eleman):</div>
        <div class="grp-elems">${Z.slice(0, 24).map(i => `<button type="button" class="grp-el" data-inspect="${i}">${tex(elemLatex(G, i))}</button>`).join('')}${Z.length > 24 ? `<span class="mute small">… toplam ${Z.length} eleman</span>` : ''}</div>
        <div class="small mute">Komütatör alt grubu [G,G] (${comm.length} eleman — ${ab ? 'aşikar' : `G/[G,G] mertebesi ${G.size / comm.length}`}):</div>
        <div class="grp-elems">${comm.slice(0, 20).map(i => `<button type="button" class="grp-el" data-inspect="${i}">${tex(elemLatex(G, i))}</button>`).join('')}${comm.length > 20 ? `<span class="mute small">… toplam ${comm.length} eleman</span>` : ''}</div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Eleman Mertebesi Histogramı</h3>
          <span class="mute small">Elemanları görmek için çubuğa dokun</span>
        </div>
        <div class="grp-hist" data-hist>
          ${Array.from(ordMap.entries()).map(([ord, cnt]) => {
            const pct = (cnt / maxCount) * 100;
            const share = Math.round((cnt / G.size) * 100);
            return `<button type="button" class="grp-hist-row" data-ord="${ord}" aria-label="Mertebesi ${ord} olan ${cnt} eleman">
              <span class="mono">|g| = <b>${ord}</b></span>
              <span class="grp-hist-track"><span class="grp-hist-fill" style="width:${pct.toFixed(1)}%"></span></span>
              <span class="mono small" style="text-align:right">${cnt} <span class="mute">(${share}%)</span></span>
            </button>`;
          }).join('')}
        </div>
        <div data-ord-list></div>
        <div class="grp-panel-head" style="margin-top:4px"><h3 class="grp-panel-title">Eleman İnceleyici</h3></div>
        <div data-elem-card></div>
      </div>
    </div>
  </div>`;

  const renderOrdList = () => {
    const box = host.querySelector('[data-ord-list]');
    if (selectedOrd == null) { box.innerHTML = ''; return; }
    const matching = [];
    for (let i = 0; i < G.size; i++) if (eo[i] === selectedOrd) matching.push(i);
    box.innerHTML = `<div class="small mute" style="margin-bottom:6px">Mertebesi <b>${selectedOrd}</b> olan elemanlar (${matching.length} adet):</div>
      <div class="grp-elems">${matching.slice(0, 36).map(i => `<button type="button" class="grp-el ${i === selectedElem ? 'on' : ''}" data-inspect="${i}"><i class="grp-dot" style="background:${elemColor(i)}"></i>${esc(G.elements[i])}</button>`).join('')}${matching.length > 36 ? `<span class="mute small">+${matching.length - 36} daha</span>` : ''}</div>`;
  };

  const renderElemCard = () => {
    const box = host.querySelector('[data-elem-card]');
    const a = selectedElem;
    const invA = G.inv(a);
    const ordA = eo[a];
    const cycSub = generate(G, [a]);
    const centA = centralizer(G, a);
    box.innerHTML = `<div class="grp-callout" style="display:grid;gap:8px">
      <div class="row wrap" style="justify-content:space-between">
        <span>${tex(`g = ${elemLatex(G, a)}`)}</span>
        <span class="grp-pill acc">${tex(`|g| = ${ordA}`)}</span>
        <span class="grp-pill">${tex(`g^{-1} = ${elemLatex(G, invA)}`)}</span>
        <span class="grp-pill">${tex(`|C_G(g)| = ${centA.length}`)}</span>
      </div>
      <div class="small mute">${tex(`\\langle ${elemLatex(G, a)} \\rangle`)} (${cycSub.length} eleman): ${cycSub.slice(0, 16).map(i => `<span class="mono">${esc(G.elements[i])}</span>`).join(', ')}${cycSub.length > 16 ? '…' : ''}</div>
    </div>`;
  };

  const stageEl = host.querySelector('.grp-stage');
  stageEl.addEventListener('click', e => {
    const hr = e.target.closest('[data-ord]');
    if (hr) {
      const v = +hr.dataset.ord;
      selectedOrd = selectedOrd === v ? null : v;
      host.querySelectorAll('[data-ord]').forEach(b => b.classList.toggle('on', +b.dataset.ord === selectedOrd));
      renderOrdList();
      return;
    }
    const ins = e.target.closest('[data-inspect]');
    if (ins) {
      selectedElem = +ins.dataset.inspect;
      renderOrdList();
      renderElemCard();
    }
  });

  renderElemCard();

  let dead = false;
  ctx.clean.add(() => { dead = true; });
  deferTask(() => {
    const subs = subgroups(G);
    const simp = isSimple(G);
    const norms = subs.filter(s => s.isNormal).length;
    return { count: subs.length, simp, norms };
  }, G.size > 24).then(res => {
    if (dead || !host.isConnected) return;
    const kpi = host.querySelector('[data-sub-kpi]');
    if (!kpi) return;
    kpi.innerHTML = `<span class="grp-kpi-lbl">Alt grup / Basitlik</span>
      <span class="grp-kpi-val mono">${res.count} alt grup</span>
      <span class="grp-kpi-sub">${res.norms} normal · ${res.simp ? 'Basit grup ✦' : 'Basit değil'}</span>`;
  });
}

// =====================================================================
// TAB 2: CAYLEY TABLOSU
// =====================================================================
function mountCayley(host, G, ctx) {
  const n = G.size;
  let viewMode = n <= 12 ? 'table' : 'canvas';
  let selectedSubKey = '';
  let reorderByCosets = true;
  let highlightSub = true;
  let latinTarget = null;
  let activeCell = [0, n > 1 ? 1 : 0];
  let zoom = n <= 24 ? 1 : (n <= 60 ? 0.8 : 0.6);
  let subsList = null;

  host.innerHTML = `<div class="grp-stage">
    <div class="grp-panel">
      <div class="grp-toolbar">
        <div class="grp-toolbar-g">
          <label class="row" style="gap:6px">
            <span class="mute small">Alt grup H:</span>
            <select class="inp grp-sel" data-sub-sel aria-label="Koset veya vurgu için alt grup seç">
              <option value="">— Seçilmedi —</option>
            </select>
          </label>
          <button type="button" class="chip on" data-coset-tog aria-pressed="true" aria-label="Kosetlere göre sırala">Kosetlere göre sırala</button>
          <button type="button" class="chip on" data-sub-tog aria-pressed="true" aria-label="Alt grubu vurgula">H vurgula</button>
        </div>
        <div class="grp-toolbar-g">
          ${n <= 24 ? `<div class="seg" data-vmode role="tablist" aria-label="Görünüm biçimi">
            <button type="button" data-vm="table" class="${viewMode === 'table' ? 'on' : ''}">Tablo</button>
            <button type="button" data-vm="canvas" class="${viewMode === 'canvas' ? 'on' : ''}">Tuval</button>
          </div>` : ''}
          <div class="grp-toolbar-g" data-zoom-ctrls ${viewMode === 'canvas' ? '' : 'hidden'}>
            <button type="button" class="btn small" data-z="-" aria-label="Uzaklaştır">−</button>
            <button type="button" class="btn small" data-z="1" aria-label="Varsayılan yakınlaştırma">100%</button>
            <button type="button" class="btn small" data-z="+" aria-label="Yakınlaştır">+</button>
          </div>
        </div>
      </div>

      <div class="grp-callout" data-eq aria-live="polite"></div>

      <div>
        <div class="small mute" style="margin-bottom:6px">Latin karesi testi — bir elemana dokun, her satır ve sütunda tam <b>1 kez</b> geçtiğini gör:</div>
        <div class="grp-elems" data-latin>
          <button type="button" class="grp-el on" data-lat="">Tümü</button>
          ${Array.from({ length: Math.min(n, 24) }, (_, i) => `<button type="button" class="grp-el" data-lat="${i}"><i class="grp-dot" style="background:${elemColor(i)}"></i>${esc(G.elements[i])}</button>`).join('')}
          ${n > 24 ? `<select class="inp grp-sel" data-lat-sel aria-label="Latin karesi elemanı seç"><option value="">Eleman seç…</option>${G.elements.map((el, i) => `<option value="${i}">${esc(el)}</option>`).join('')}</select>` : ''}
        </div>
      </div>

      <div data-coset-note></div>
      <div data-board></div>
    </div>
  </div>`;

  const eqEl = host.querySelector('[data-eq]');
  const boardEl = host.querySelector('[data-board]');
  const subSel = host.querySelector('[data-sub-sel]');
  const cosetNote = host.querySelector('[data-coset-note]');
  const zoomCtrls = host.querySelector('[data-zoom-ctrls]');

  const getSelectedSub = () => subsList?.find(s => s.key === selectedSubKey) || null;

  const getOrdering = () => {
    const sub = getSelectedSub();
    if (!sub || !reorderByCosets) {
      return { ord: Array.from({ length: n }, (_, i) => i), blockSize: 0, sub };
    }
    const cosets = leftCosets(G, sub.elements);
    return { ord: cosets.flat(), blockSize: sub.order, sub };
  };

  const renderEq = () => {
    const [a, b] = activeCell;
    const c = G.mul(a, b);
    const ba = G.mul(b, a);
    const op = G.meta?.operation || '\\cdot';
    const comm = c === ba;
    eqEl.innerHTML = `<div class="row wrap" style="gap:12px">
      <span>${tex(`${elemLatex(G, a)} ${op} ${elemLatex(G, b)} = ${elemLatex(G, c)}`)}</span>
      <span class="mute">|</span>
      <span class="small mute">${tex(`${elemLatex(G, b)} ${op} ${elemLatex(G, a)} = ${elemLatex(G, ba)}`)}</span>
      <span class="grp-pill ${comm ? 'ok' : 'warn'}">${comm ? 'Değişiyor (ab = ba)' : 'Değişmiyor (ab ≠ ba)'}</span>
    </div>
    <div class="row wrap small mute" style="gap:8px">
      <span>${tex(`|${elemLatex(G, a)}| = ${order(G, a)}`)}</span>
      <span>${tex(`|${elemLatex(G, b)}| = ${order(G, b)}`)}</span>
      <span>${tex(`|${elemLatex(G, c)}| = ${order(G, c)}`)}</span>
    </div>`;
  };

  let cvCleanup = null;

  const renderBoard = () => {
    cvCleanup?.run();
    cvCleanup = createCleanup();
    zoomCtrls.hidden = viewMode !== 'canvas';
    const { ord, blockSize, sub } = getOrdering();
    const subSet = sub && highlightSub ? new Set(sub.elements) : null;

    if (sub && reorderByCosets) {
      const genLabel = sub.generators.map(i => G.elements[i]).join(', ');
      cosetNote.innerHTML = `<div class="grp-callout ${sub.isNormal ? 'ok' : ''}">
        <span class="small">${sub.isNormal
          ? `<b class="mono">⟨${esc(genLabel)}⟩</b> <b>normal</b> alt grubunun (${sub.order} eleman, ${n / sub.order} koset) blok yapısı: her koset bloğu tek bir kosete karşılık gelir — bölüm grubu ${tex(`${G.latex}/H`)} doğrudan görünür!`
          : `<b class="mono">⟨${esc(genLabel)}⟩</b> alt grubu <b>normal değil</b> (${sub.order} eleman): koset bloklarındaki renkler birbirine karışır, bu yüzden bölüm çarpımı iyi tanımlı olmaz.`}</span>
      </div>`;
    } else {
      cosetNote.innerHTML = '';
    }

    if (viewMode === 'table') {
      boardEl.innerHTML = renderHtmlCayleyTable(G, {
        orderIdx: ord,
        blockSize,
        subSet,
        activeCell,
        latinTarget,
        ariaLabel: `${G.name} Cayley tablosu`,
      });
      const tbl = boardEl.querySelector('table');
      const updateHighlight = (a, b) => {
        activeCell = [a, b];
        renderEq();
        tbl.querySelectorAll('td').forEach(td => {
          const ta = +td.dataset.a, tb = +td.dataset.b;
          td.classList.toggle('grp-c-active', ta === a && tb === b);
          td.classList.toggle('grp-c-cross', (ta === a || tb === b) && !(ta === a && tb === b));
        });
      };
      tbl.addEventListener('pointerover', e => {
        const td = e.target.closest('td[data-a]');
        if (td && e.pointerType === 'mouse') updateHighlight(+td.dataset.a, +td.dataset.b);
      });
      tbl.addEventListener('click', e => {
        const td = e.target.closest('td[data-a]');
        if (td) updateHighlight(+td.dataset.a, +td.dataset.b);
      });
      return;
    }

    // Canvas Cayley matrix (for large groups or canvas mode)
    const baseCell = n <= 16 ? 38 : (n <= 32 ? 26 : (n <= 60 ? 18 : 13));
    const cell = Math.max(8, Math.round(baseCell * zoom));
    const head = n <= 32 ? Math.max(46, cell + 16) : Math.max(36, cell + 14);
    const totalW = head + n * cell + 2;
    const totalH = head + n * cell + 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    boardEl.innerHTML = `<div class="grp-cv-scroll"><canvas class="grp-cv" style="touch-action:pan-x pan-y" aria-label="${esc(G.name)} Cayley tuvali"></canvas></div>`;
    const cv = boardEl.querySelector('canvas');
    cv.width = Math.round(totalW * dpr);
    cv.height = Math.round(totalH * dpr);
    cv.style.width = `${totalW}px`;
    cv.style.height = `${totalH}px`;

    const draw = () => {
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#08080c';
      c.fillRect(0, 0, totalW, totalH);
      const acc = accentColor();
      const showText = cell >= 24;
      const showHeadText = cell >= 16;

      // Headers
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(0, 0, totalW, head);
      c.fillRect(0, 0, head, totalH);
      c.fillStyle = acc;
      c.font = `600 12px var(--mono), monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(G.meta?.operation || '·', head / 2, head / 2);

      for (let i = 0; i < n; i++) {
        const x = head + i * cell, y = head + i * cell;
        const g = ord[i];
        if (subSet?.has(g)) {
          c.fillStyle = 'rgba(255,255,255,0.12)';
          c.fillRect(x, 0, cell, head);
          c.fillRect(0, y, head, cell);
        }
        if (showHeadText) {
          c.fillStyle = subSet?.has(g) ? acc : '#d4d4d8';
          c.font = `500 ${Math.min(11, Math.max(8, cell - 7))}px monospace`;
          const lbl = G.elements[g].length > 5 ? G.elements[g].slice(0, 5) : G.elements[g];
          c.fillText(lbl, x + cell / 2, head / 2);
          c.fillText(lbl, head / 2, y + cell / 2);
        }
      }

      // Cells
      for (let ri = 0; ri < n; ri++) {
        const a = ord[ri];
        const y = head + ri * cell;
        for (let ci = 0; ci < n; ci++) {
          const b = ord[ci];
          const val = G.mul(a, b);
          const x = head + ci * cell;
          const dim = latinTarget != null && val !== latinTarget;
          c.fillStyle = dim ? elemBg(val, 0.08) : elemBg(val, 0.56);
          c.fillRect(x, y, cell - 0.5, cell - 0.5);
          if (latinTarget != null && val === latinTarget) {
            c.strokeStyle = '#fff';
            c.lineWidth = 1.5;
            c.strokeRect(x + 1, y + 1, cell - 2.5, cell - 2.5);
          }
          if (showText) {
            c.fillStyle = dim ? 'rgba(255,255,255,0.22)' : '#fff';
            c.font = `500 ${Math.min(11, Math.max(8, cell - 11))}px monospace`;
            const lbl = G.elements[val].length > 6 ? G.elements[val].slice(0, 6) : G.elements[val];
            c.fillText(lbl, x + cell / 2, y + cell / 2);
          }
        }
      }

      // Coset block gridlines
      if (blockSize > 0) {
        c.strokeStyle = acc;
        c.lineWidth = 1.8;
        for (let k = blockSize; k < n; k += blockSize) {
          const pos = head + k * cell;
          c.beginPath();
          c.moveTo(pos, 0); c.lineTo(pos, totalH);
          c.moveTo(0, pos); c.lineTo(totalW, pos);
          c.stroke();
        }
      }

      // Crosshair for activeCell
      const ar = ord.indexOf(activeCell[0]), ac = ord.indexOf(activeCell[1]);
      if (ar >= 0 && ac >= 0) {
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 1;
        c.strokeRect(head, head + ar * cell, n * cell, cell);
        c.strokeRect(head + ac * cell, head, cell, n * cell);
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.strokeRect(head + ac * cell + 1, head + ar * cell + 1, cell - 2, cell - 2);
      }
    };

    const hit = e => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left - head;
      const y = e.clientY - r.top - head;
      const ci = Math.floor(x / cell), ri = Math.floor(y / cell);
      if (ci >= 0 && ci < n && ri >= 0 && ri < n) {
        activeCell = [ord[ri], ord[ci]];
        renderEq();
        draw();
      }
    };
    const onMove = e => { if (e.pointerType === 'mouse') hit(e); };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('click', hit);
    window.addEventListener('mp-theme', draw);
    cvCleanup.add(() => {
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('click', hit);
      window.removeEventListener('mp-theme', draw);
    });
    draw();
  };

  ctx.clean.add(() => cvCleanup?.run());

  // Wire controls
  subSel.onchange = () => { selectedSubKey = subSel.value; renderBoard(); };
  host.querySelector('[data-coset-tog]').onclick = e => {
    reorderByCosets = !reorderByCosets;
    e.currentTarget.classList.toggle('on', reorderByCosets);
    e.currentTarget.setAttribute('aria-pressed', String(reorderByCosets));
    renderBoard();
  };
  host.querySelector('[data-sub-tog]').onclick = e => {
    highlightSub = !highlightSub;
    e.currentTarget.classList.toggle('on', highlightSub);
    e.currentTarget.setAttribute('aria-pressed', String(highlightSub));
    renderBoard();
  };
  host.querySelector('[data-vmode]')?.addEventListener('click', e => {
    const b = e.target.closest('[data-vm]'); if (!b) return;
    viewMode = b.dataset.vm;
    host.querySelectorAll('[data-vm]').forEach(x => x.classList.toggle('on', x === b));
    renderBoard();
  });
  host.querySelectorAll('[data-z]').forEach(b => {
    b.onclick = () => {
      const d = b.dataset.z;
      zoom = d === '1' ? 1 : Math.max(0.4, Math.min(2.4, zoom * (d === '+' ? 1.25 : 0.8)));
      renderBoard();
    };
  });
  host.querySelector('[data-latin]').addEventListener('click', e => {
    const b = e.target.closest('[data-lat]'); if (!b) return;
    latinTarget = b.dataset.lat === '' ? null : +b.dataset.lat;
    host.querySelectorAll('[data-lat]').forEach(x => x.classList.toggle('on', x === b));
    const sel = host.querySelector('[data-lat-sel]');
    if (sel) sel.value = latinTarget == null ? '' : String(latinTarget);
    renderBoard();
  });
  host.querySelector('[data-lat-sel]')?.addEventListener('change', e => {
    latinTarget = e.target.value === '' ? null : +e.target.value;
    host.querySelectorAll('[data-lat]').forEach(x => x.classList.toggle('on', latinTarget == null && x.dataset.lat === ''));
    renderBoard();
  });

  renderEq();
  renderBoard();

  // Populate subgroup list lazily
  let dead = false;
  ctx.clean.add(() => { dead = true; });
  deferTask(() => subgroups(G), n > 24).then(subs => {
    if (dead || !host.isConnected) return;
    subsList = subs.filter(s => s.order > 1 && s.order < n);
    // Keep dropdown fast for S5 (156 subgroups): prioritize normal subgroups first, then others
    const sorted = subsList.slice().sort((a, b) => Number(b.isNormal) - Number(a.isNormal) || a.order - b.order);
    const shown = sorted.slice(0, 48);
    subSel.innerHTML = `<option value="">— Seçilmedi —</option>` + shown.map(s => {
      const gens = s.generators.map(i => G.elements[i]).join(', ');
      return `<option value="${s.key}">⟨${esc(gens)}⟩ · |H|=${s.order} ${s.isNormal ? '◁ normal' : ''}</option>`;
    }).join('');
  });
}

// =====================================================================
// TAB 3: SİMETRİ LABORATUVARI (D_n / S_3 polygon + Cube 3D diagonals)
// =====================================================================
function mountSymmetry(host, G, ctx) {
  const isCubeMode = G.meta?.kind === 'Cube';
  const isPolyNative = (G.meta?.kind === 'D' && G.meta.n >= 3) || (G.meta?.kind === 'S' && G.meta.n === 3);

  const switcherHtml = `<div class="grp-toolbar">
    <div class="grp-toolbar-g">
      <span class="mute small">Simetri nesnesi:</span>
      ${[
        ['D₃ (Üçgen / S₃)', { kind: 'D', n: 3 }],
        ['D₄ (Kare)', { kind: 'D', n: 4 }],
        ['D₅ (Beşgen)', { kind: 'D', n: 5 }],
        ['D₆ (Altıgen)', { kind: 'D', n: 6 }],
        ['D₈ (Sekizgen)', { kind: 'D', n: 8 }],
        ['Küp (SO₃ ≅ S₄)', { kind: 'Cube' }],
      ].map(([lbl, sp], idx) => {
        const on = (sp.kind === 'Cube' && isCubeMode) || (sp.kind === 'D' && G.meta?.kind === 'D' && G.meta.n === sp.n) || (sp.kind === 'D' && sp.n === 3 && G.meta?.kind === 'S' && G.meta.n === 3);
        return `<button type="button" class="grp-chip ${on ? 'on' : ''}" data-sw="${idx}">${esc(lbl)}</button>`;
      }).join('')}
    </div>
    ${!isCubeMode && !isPolyNative ? `<span class="grp-pill warn">${esc(G.name)} için geometrik model yok — D₄ karesi gösteriliyor</span>` : ''}
  </div>`;

  const SW_SPECS = [
    { kind: 'D', n: 3 },
    { kind: 'D', n: 4 },
    { kind: 'D', n: 5 },
    { kind: 'D', n: 6 },
    { kind: 'D', n: 8 },
    { kind: 'Cube' },
  ];

  if (isCubeMode) {
    mountCubeSymmetry(host, G, ctx, switcherHtml, SW_SPECS);
    return;
  }

  const n = G.meta?.kind === 'D' && G.meta.n >= 3 ? G.meta.n : (G.meta?.kind === 'S' && G.meta.n === 3 ? 3 : 4);
  const D = getGroupFromSpec({ kind: 'D', n });
  const rIdx = 1, rInvIdx = n - 1, sIdx = n;

  let curElem = 0; // element index in D_n
  let word = [];   // array of move strings applied right-to-left (index 0 = latest / leftmost)
  let compHighlight = null; // [a, b]
  let anim = null; // { kind: 'rot'|'flip', fromElem, toElem, angleDelta, t0, dur, queue }
  let drag = null; // { startAngle, delta }

  host.innerHTML = `<div class="grp-stage">
    ${switcherHtml}
    <div class="grp-grid-side">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Düzgün ${n}-gen · ${esc(D.name)} ${n === 3 ? '(≅ S₃)' : ''}</h3>
          <span class="mute small">Döndürmek için sürükle</span>
        </div>
        <div class="grp-cv-box">
          <canvas class="grp-cv" data-poly-cv aria-label="Düzgün ${n}-gen simetri simülasyonu"></canvas>
          <div class="grp-cv-overlay mono" data-overlay></div>
        </div>
        <div class="grp-sym-acts">
          <button type="button" class="btn primary" data-mv="r" aria-label="Saat yönünde döndür r">${icon('rotate')} r (+${Math.round(360 / n)}°)</button>
          <button type="button" class="btn" data-mv="ri" aria-label="Ters yönde döndür r ters">${tex('r^{-1}')} (−${Math.round(360 / n)}°)</button>
          <button type="button" class="btn" data-mv="s" aria-label="Dikey eksende yansıt s">↔ s (Yansıt)</button>
          <button type="button" class="btn ghost" data-mv="reset" aria-label="Birim elemana sıfırla">Sıfırla (e)</button>
        </div>
        <div class="grp-word-bar" data-word aria-live="polite"></div>
        <div class="grp-callout" data-perm-info></div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">İki Elemanı Bileştir (a ∘ b)</h3>
          <span class="mute small">Önce b, sonra a uygulanır</span>
        </div>
        <div class="row wrap">
          <select class="inp grp-sel" data-ca aria-label="Sol eleman a">${D.elements.map((el, i) => `<option value="${i}" ${i === sIdx ? 'selected' : ''}>a = ${esc(el)}</option>`).join('')}</select>
          <span class="mono">∘</span>
          <select class="inp grp-sel" data-cb aria-label="Sağ eleman b">${D.elements.map((el, i) => `<option value="${i}" ${i === rIdx ? 'selected' : ''}>b = ${esc(el)}</option>`).join('')}</select>
          <button type="button" class="btn small primary" data-compose>${icon('play')} Bileştir</button>
        </div>
        <div class="grp-math-box" data-comp-eq></div>
        ${D.size <= 16 ? `<div class="grp-panel-head"><h3 class="grp-panel-title">${esc(D.name)} Cayley Tablosu</h3><span class="mute small">Dokunup uygula</span></div><div data-mini-tbl></div>` : `<p class="mute small">D_${n} (${D.size} eleman) için tam tabloyu "Cayley Tablosu" sekmesinde inceleyebilirsin.</p>`}
      </div>
    </div>
  </div>`;

  host.querySelectorAll('[data-sw]').forEach(b => {
    b.onclick = () => ctx.setGroup(SW_SPECS[+b.dataset.sw]);
  });

  const cv = host.querySelector('[data-poly-cv]');
  const overlayEl = host.querySelector('[data-overlay]');
  const wordEl = host.querySelector('[data-word]');
  const permInfoEl = host.querySelector('[data-perm-info]');
  const compEqEl = host.querySelector('[data-comp-eq]');
  const miniTblEl = host.querySelector('[data-mini-tbl]');
  const selA = host.querySelector('[data-ca]');
  const selB = host.querySelector('[data-cb]');

  const slotXY = (slot, cx, cy, R) => {
    const a = (2 * Math.PI * slot) / n;
    return [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  };

  const drawPoly = (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.34;
    const acc = accentColor();

    // Fixed symmetry axis (vertical line through slot 0)
    const flipActive = anim?.kind === 'flip';
    c.save();
    c.strokeStyle = flipActive ? acc : 'rgba(255,255,255,0.16)';
    c.lineWidth = flipActive ? 2 : 1.2;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(cx, cy - R - 32);
    c.lineTo(cx, cy + R + 32);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = flipActive ? acc : 'rgba(255,255,255,0.4)';
    c.font = '500 11px monospace';
    c.textAlign = 'left';
    c.fillText('s ekseni', cx + 6, cy - R - 20);
    c.restore();

    // Fixed outer slot labels (1..n)
    for (let s = 0; s < n; s++) {
      const [sx, sy] = slotXY(s, cx, cy, R + 25);
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.font = '500 11px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(`[${s + 1}]`, sx, sy);
    }

    // Determine transform state during animation or drag
    const baseElem = anim ? anim.fromElem : curElem;
    const perm = D.meta.perms[baseElem];
    const isReflected = baseElem >= n;

    let extraRot = drag ? drag.delta : 0;
    let flipScaleX = 1;
    if (anim) {
      const p = anim.progress;
      const ease = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      if (anim.kind === 'rot') extraRot = anim.angleDelta * ease;
      else if (anim.kind === 'flip') flipScaleX = Math.cos(Math.PI * ease);
    }

    // Compute transformed vertex screen coordinates
    const pts = [];
    for (let v = 0; v < n; v++) {
      const slot = perm[v];
      const baseAngle = (2 * Math.PI * slot) / n + extraRot;
      const lx = R * Math.sin(baseAngle) * flipScaleX;
      const ly = -R * Math.cos(baseAngle);
      pts.push({ v, x: cx + lx, y: cy + ly });
    }

    // Polygon fill & stroke (color tint distinguishes orientation: front vs flipped back!)
    const showingBack = flipScaleX < 0 ? !isReflected : isReflected;
    c.save();
    c.beginPath();
    for (let v = 0; v < n; v++) {
      if (v === 0) c.moveTo(pts[v].x, pts[v].y);
      else c.lineTo(pts[v].x, pts[v].y);
    }
    c.closePath();
    c.fillStyle = showingBack ? 'rgba(244, 114, 182, 0.12)' : 'rgba(255, 255, 255, 0.06)';
    c.fill();
    c.strokeStyle = showingBack ? '#f472b6' : '#f4f4f5';
    c.lineWidth = 2.2;
    c.stroke();

    // Orientation indicator inside polygon (small arrow near vertex 1 -> vertex 2)
    const p0 = pts[0], p1 = pts[1];
    const mx = cx + (p0.x - cx) * 0.45, my = cy + (p0.y - cy) * 0.45;
    const tx = cx + (p1.x - cx) * 0.45, ty = cy + (p1.y - cy) * 0.45;
    c.strokeStyle = acc;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(mx, my);
    c.lineTo(tx, ty);
    c.stroke();

    // Center badge showing front/back orientation
    c.fillStyle = showingBack ? '#f472b6' : 'rgba(255,255,255,0.65)';
    c.font = '600 12px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(showingBack ? 'ARKA (yansıma)' : 'ÖN (dönme)', cx, cy);

    // Draw numbered colored vertices
    for (let v = 0; v < n; v++) {
      const p = pts[v];
      const col = elemColor(v + 1);
      c.beginPath();
      c.arc(p.x, p.y, 14, 0, Math.PI * 2);
      c.fillStyle = '#09090d';
      c.fill();
      c.lineWidth = 2.2;
      c.strokeStyle = col;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = '700 13px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(v + 1), p.x, p.y + 0.5);
    }
    c.restore();
  };

  const cvCtrl = setupCanvas(cv, w => Math.min(340, Math.max(250, w * 0.72)), drawPoly, ctx.clean);

  const renderInfo = () => {
    const perm = D.meta.perms[curElem];
    const cycTex = formatCyclesLatex(perm);
    const two = twoLineNotation(perm);
    overlayEl.textContent = `${D.elements[curElem]}  |  ${formatCycles(perm)}`;

    wordEl.innerHTML = word.length
      ? `<span class="small mute">Kelime (sağdan sola):</span>` +
        word.slice(0, 14).map(t => `<span class="grp-word-tok ${t === 's' ? 'flip' : ''}">${esc(t)}</span>`).join('<span class="mute">·</span>') +
        (word.length > 14 ? `<span class="mute small">… (${word.length} adım)</span>` : '') +
        `<span class="mute">=</span><span class="grp-pill acc">${tex(elemLatex(D, curElem))}</span>`
      : `<span class="mute small">Birim durum: ${tex('e')} — Yukarıdaki düğmelerle <b>r</b> (döndür) veya <b>s</b> (yansıt) uygula.</span>`;

    permInfoEl.innerHTML = `<div style="display:grid;gap:6px;width:100%">
      <div class="row wrap" style="justify-content:space-between">
        <span>Mevcut eleman: ${tex(elemLatex(D, curElem))}</span>
        <span class="grp-pill">${tex(`|g| = ${order(D, curElem)}`)}</span>
        <span class="grp-pill acc">Köşe permütasyonu: ${tex(cycTex)}</span>
      </div>
      <div class="small mute" style="overflow-x:auto">${tex(two.latex)}</div>
    </div>`;

    const a = +selA.value, b = +selB.value, prod = D.mul(a, b);
    compEqEl.innerHTML = tex(`${elemLatex(D, a)} \\circ ${elemLatex(D, b)} = ${elemLatex(D, prod)}`);

    if (miniTblEl) {
      miniTblEl.innerHTML = renderHtmlCayleyTable(D, {
        activeCell: compHighlight || [a, b],
        compact: true,
        ariaLabel: `${D.name} mini Cayley tablosu`,
      });
      miniTblEl.querySelector('table').onclick = e => {
        const td = e.target.closest('td[data-a]'); if (!td) return;
        selA.value = td.dataset.a;
        selB.value = td.dataset.b;
        runCompose(+td.dataset.a, +td.dataset.b);
      };
    }
  };

  const loop = createAnimLoop(now => {
    if (!anim) return false;
    const p = Math.min(1, (now - anim.t0) / anim.dur);
    anim.progress = p;
    cvCtrl.render();
    if (p >= 1) {
      curElem = anim.toElem;
      const nextQueue = anim.queue || [];
      anim = null;
      renderInfo();
      cvCtrl.render();
      if (nextQueue.length) {
        const step = nextQueue.shift();
        triggerStep(step.kind, step.mulElem, step.tok, step.angleDelta, nextQueue);
        return true;
      }
      return false;
    }
    return true;
  }, ctx.clean);

  const triggerStep = (kind, mulElem, tok, angleDelta, queue = []) => {
    const nextElem = D.mul(mulElem, curElem);
    if (tok) word.unshift(tok);
    const m = motion();
    if (m !== 'full') {
      curElem = nextElem;
      for (const st of queue) {
        curElem = D.mul(st.mulElem, curElem);
        if (st.tok) word.unshift(st.tok);
      }
      anim = null;
      renderInfo();
      cvCtrl.render();
      return;
    }
    anim = { kind, fromElem: curElem, toElem: nextElem, angleDelta, t0: performance.now(), dur: kind === 'flip' ? 380 : 280, progress: 0, queue };
    loop.start();
  };

  const elemToSteps = elemIdx => {
    const steps = [];
    const k = elemIdx >= n ? elemIdx - n : elemIdx;
    if (k > 0) {
      const shortest = k <= n / 2 ? k : k - n;
      steps.push({ kind: 'rot', mulElem: k, tok: k === 1 ? 'r' : `r^${k}`, angleDelta: (2 * Math.PI * shortest) / n });
    }
    if (elemIdx >= n) {
      steps.push({ kind: 'flip', mulElem: sIdx, tok: 's', angleDelta: 0 });
    }
    return steps;
  };

  const runCompose = (a, b) => {
    loop.stop();
    anim = null;
    curElem = 0;
    word = [];
    compHighlight = [a, b];
    const queue = [...elemToSteps(b), ...elemToSteps(a)];
    if (!queue.length) { renderInfo(); cvCtrl.render(); return; }
    const first = queue.shift();
    triggerStep(first.kind, first.mulElem, first.tok, first.angleDelta, queue);
  };

  // Drag-to-rotate on polygon canvas
  const ptrAngle = e => {
    const r = cv.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  cv.addEventListener('pointerdown', e => {
    if (anim) return;
    cv.setPointerCapture?.(e.pointerId);
    drag = { startAngle: ptrAngle(e), delta: 0 };
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.delta = ptrAngle(e) - drag.startAngle;
    cvCtrl.render();
  });
  const endDrag = () => {
    if (!drag) return;
    const steps = Math.round(drag.delta / ((2 * Math.PI) / n));
    const modSteps = ((steps % n) + n) % n;
    drag = null;
    if (modSteps !== 0) {
      curElem = D.mul(modSteps, curElem);
      word.unshift(modSteps === 1 ? 'r' : `r^${modSteps}`);
      renderInfo();
    }
    cvCtrl.render();
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  host.querySelectorAll('[data-mv]').forEach(btn => {
    btn.onclick = () => {
      if (anim) return;
      compHighlight = null;
      const mv = btn.dataset.mv;
      if (mv === 'reset') { curElem = 0; word = []; renderInfo(); cvCtrl.render(); }
      else if (mv === 'r') triggerStep('rot', rIdx, 'r', (2 * Math.PI) / n);
      else if (mv === 'ri') triggerStep('rot', rInvIdx, 'r⁻¹', -(2 * Math.PI) / n);
      else if (mv === 's') triggerStep('flip', sIdx, 's', 0);
    };
  });
  selA.onchange = renderInfo;
  selB.onchange = renderInfo;
  host.querySelector('[data-compose]').onclick = () => runCompose(+selA.value, +selB.value);

  renderInfo();
}

// 3D Isometric Cube with 4 Numbered Space Diagonals (SO_3 cube rotations ≅ S_4)
function mountCubeSymmetry(host, Cube, ctx, switcherHtml, SW_SPECS) {
  let curElem = 0;
  let word = [];
  let yaw = 0.62, pitch = 0.44;
  let anim = null; // { axis: 'x'|'y'|'z', fromMat, toElem, t0, dur, progress }
  let drag = null;

  const { rx, ry, rz } = Cube.meta.genIndices;
  const DIAG_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24'];
  const VERTS = [
    [1, 1, 1], [-1, 1, 1], [-1, -1, 1], [1, -1, 1],
    [1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1],
  ];
  const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  // 4 main diagonals: vertex d to opposite vertex (d+2)%4 + 4
  const DIAG_PAIRS = [[0, 6], [1, 7], [2, 4], [3, 5]];

  host.innerHTML = `<div class="grp-stage">
    ${switcherHtml}
    <div class="grp-grid-side">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Küpün 24 Dönmesi · 4 Ana Köşegen (≅ S₄)</h3>
          <span class="mute small">Bakış açısı için sürükle</span>
        </div>
        <div class="grp-cv-box">
          <canvas class="grp-cv" data-cube-cv aria-label="Küpün dönme grubu simülasyonu"></canvas>
          <div class="grp-cv-overlay mono" data-cube-ov></div>
        </div>
        <div class="grp-sym-acts">
          <button type="button" class="btn primary" data-cmv="rx">Rₓ (+90°)</button>
          <button type="button" class="btn primary" data-cmv="ry">Rᵧ (+90°)</button>
          <button type="button" class="btn primary" data-cmv="rz">R_z (+90°)</button>
          <button type="button" class="btn ghost" data-cmv="reset">Sıfırla (e)</button>
        </div>
        <div class="grp-word-bar" data-cword aria-live="polite"></div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Köşegen Permütasyonu (S₄ İzomorfizması)</h3>
        </div>
        <div class="grp-callout" data-cinfo></div>
        <div class="small mute">
          Küpün her uygun 3B dönmesi 4 ana köşegeni (1, 2, 3, 4) benzersiz biçimde permüte eder.
          Toplam ${tex('24 = 4!')} dönme olduğundan ${tex('O \\cong S_4')} izomorfizması elde edilir.
        </div>
        <div class="grp-elems">
          ${DIAG_COLORS.map((col, i) => `<span class="grp-pill"><i class="grp-dot" style="background:${col}"></i>Köşegen ${i + 1}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  host.querySelectorAll('[data-sw]').forEach(b => {
    b.onclick = () => ctx.setGroup(SW_SPECS[+b.dataset.sw]);
  });

  const cv = host.querySelector('[data-cube-cv]');
  const ovEl = host.querySelector('[data-cube-ov]');
  const wordEl = host.querySelector('[data-cword]');
  const infoEl = host.querySelector('[data-cinfo]');

  const mulMatVec = (M, v) => [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];

  const axisRot = (axis, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    if (axis === 'x') return [[1, 0, 0], [0, c, -s], [0, s, c]];
    if (axis === 'y') return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  };

  const mul3 = (A, B) => [0, 1, 2].map(i => [0, 1, 2].map(j => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));

  const drawCube = (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 0.25;

    let M = Cube.meta.rotations[curElem].matrix;
    if (anim) {
      const p = anim.progress;
      const ease = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      M = mul3(axisRot(anim.axis, (Math.PI / 2) * ease), anim.fromMat);
    }

    // Camera view matrix (rotate around y by yaw, then x by pitch)
    const cam = mul3(axisRot('x', pitch), axisRot('y', yaw));
    const proj = v => {
      const w = mulMatVec(M, v);
      const q = mulMatVec(cam, w);
      const persp = 4.6 / (4.6 - q[2]);
      return { x: cx + q[0] * scale * persp, y: cy - q[1] * scale * persp, z: q[2] };
    };

    const pts = VERTS.map(proj);

    // Draw cube edges depth-sorted
    const edgeItems = EDGES.map(([i, j]) => ({ i, j, z: (pts[i].z + pts[j].z) / 2 })).sort((a, b) => a.z - b.z);
    for (const e of edgeItems) {
      c.strokeStyle = e.z > 0 ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.22)';
      c.lineWidth = e.z > 0 ? 1.8 : 1.1;
      c.beginPath();
      c.moveTo(pts[e.i].x, pts[e.i].y);
      c.lineTo(pts[e.j].x, pts[e.j].y);
      c.stroke();
    }

    // Draw the 4 colored space diagonals + numbered endpoint badges
    for (let d = 0; d < 4; d++) {
      const [a, b] = DIAG_PAIRS[d];
      const pa = pts[a], pb = pts[b];
      const col = DIAG_COLORS[d];
      c.strokeStyle = col;
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(pa.x, pa.y);
      c.lineTo(pb.x, pb.y);
      c.stroke();

      for (const p of [pa, pb]) {
        c.beginPath();
        c.arc(p.x, p.y, 11, 0, Math.PI * 2);
        c.fillStyle = '#09090d';
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = col;
        c.stroke();
        c.fillStyle = '#fff';
        c.font = '700 11px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(d + 1), p.x, p.y + 0.5);
      }
    }
  };

  const cvCtrl = setupCanvas(cv, w => Math.min(340, Math.max(250, w * 0.72)), drawCube, ctx.clean);

  const renderInfo = () => {
    const rot = Cube.meta.rotations[curElem];
    const two = twoLineNotation(rot.perm);
    ovEl.textContent = `${Cube.elements[curElem]} · ${rot.desc}`;
    wordEl.innerHTML = word.length
      ? `<span class="small mute">Dönmeler (sağdan sola):</span>` +
        word.slice(0, 12).map(t => `<span class="grp-word-tok">${esc(t)}</span>`).join('<span class="mute">·</span>') +
        `<span class="mute">=</span><span class="grp-pill acc">${tex(elemLatex(Cube, curElem))}</span>`
      : `<span class="mute small">Birim durum: ${tex('e')} — Küpü x, y veya z ekseninde 90° döndür.</span>`;

    infoEl.innerHTML = `<div style="display:grid;gap:8px;width:100%">
      <div class="row wrap" style="justify-content:space-between">
        <span>Devir: ${tex(elemLatex(Cube, curElem))}</span>
        <span class="grp-pill acc">${esc(rot.desc)}</span>
        <span class="grp-pill">${tex(`|g| = ${order(Cube, curElem)}`)}</span>
      </div>
      <div class="small mute">${tex(two.latex)}</div>
    </div>`;
  };

  const loop = createAnimLoop(now => {
    if (!anim) return false;
    const p = Math.min(1, (now - anim.t0) / anim.dur);
    anim.progress = p;
    cvCtrl.render();
    if (p >= 1) {
      curElem = anim.toElem;
      anim = null;
      renderInfo();
      cvCtrl.render();
      return false;
    }
    return true;
  }, ctx.clean);

  const doRot = (axis, genIdx, tok) => {
    if (anim) return;
    const nextElem = Cube.mul(genIdx, curElem);
    word.unshift(tok);
    if (motion() !== 'full') {
      curElem = nextElem;
      renderInfo();
      cvCtrl.render();
      return;
    }
    anim = { axis, fromMat: Cube.meta.rotations[curElem].matrix, toElem: nextElem, t0: performance.now(), dur: 360, progress: 0 };
    loop.start();
  };

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.01));
    cvCtrl.render();
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  host.querySelectorAll('[data-cmv]').forEach(b => {
    b.onclick = () => {
      const m = b.dataset.cmv;
      if (m === 'reset') { anim = null; curElem = 0; word = []; renderInfo(); cvCtrl.render(); }
      else if (m === 'rx') doRot('x', rx, 'Rₓ');
      else if (m === 'ry') doRot('y', ry, 'Rᵧ');
      else if (m === 'rz') doRot('z', rz, 'Rz');
    };
  });

  renderInfo();
}

// =====================================================================
// TAB 4: PERMÜTASYON ATÖLYESİ + 15-BULMACA PARİTE DEMOSU
// =====================================================================
function mountPermutations(host, G, ctx) {
  let n = G.meta?.degree >= 3 && G.meta.degree <= 6 ? G.meta.degree : 4;
  let sigmaStr = n >= 4 ? '(1 2 3)' : '(1 2)';
  let tauStr = n >= 4 ? '(2 4)(1 3)' : '(2 3)';
  let sigma = parseCycles(sigmaStr, n);
  let tau = parseCycles(tauStr, n);
  let focusX = -1; // -1 = all visible; 0..n-1 = tracing x
  let animState = null; // { x, phase: 0..2, t0, auto }

  // 15-puzzle state
  let board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
  let swapMode = false;
  let swapFirst = -1;

  host.innerHTML = `<div class="grp-stage">
    <div class="grp-callout">
      <div>
        <div class="grp-panel-title">Bileşke Kuralı (Sağdan Sola · ${esc(PERM_CONVENTION)})</div>
        <div class="small" style="margin-top:3px">${richTex('Bileşke fonksiyon bileşkesidir: $(\\sigma \\circ \\tau)(x) = \\sigma(\\tau(x))$. Önce sağdaki $\\tau$, sonra soldaki $\\sigma$ uygulanır.')}</div>
      </div>
      <div class="seg" data-deg role="tablist" aria-label="S_n derecesi">
        ${[3, 4, 5, 6].map(d => `<button type="button" data-d="${d}" class="${d === n ? 'on' : ''}">S${d}</button>`).join('')}
      </div>
    </div>

    <div class="grp-panel">
      <div class="grp-perm-inputs">
        <label>
          <span>Sol permütasyon ${tex('\\sigma')} (devir notasyonu)</span>
          <input type="text" class="inp mono" data-sig value="${esc(sigmaStr)}" placeholder="ör. (1 2 3)" autocomplete="off" spellcheck="false" aria-label="Sol permütasyon sigma">
        </label>
        <label>
          <span>Sağ permütasyon ${tex('\\tau')} (önce bu uygulanır)</span>
          <input type="text" class="inp mono" data-tau value="${esc(tauStr)}" placeholder="ör. (2 4)(1 3)" autocomplete="off" spellcheck="false" aria-label="Sağ permütasyon tau">
        </label>
      </div>
      <div class="grp-toolbar">
        <div class="grp-toolbar-g">
          <button type="button" class="btn small primary" data-anim-go>${icon('play')} Adım adım canlandır</button>
          <button type="button" class="btn small" data-anim-step>Sonraki sayı →</button>
          <button type="button" class="btn small" data-swap-st>σ ↔ τ değiştir</button>
          <button type="button" class="btn small" data-rand-perm>Rastgele</button>
        </div>
        <div class="small err" data-perm-err aria-live="polite"></div>
      </div>

      <div class="grp-cv-box">
        <canvas class="grp-cv" data-perm-cv aria-label="Permütasyon ok diyagramı"></canvas>
      </div>
      <div class="grp-trace-log" data-trace></div>
      <div class="grp-grid-2" data-perm-cards></div>
    </div>

    <div class="grp-panel">
      <div class="grp-panel-head">
        <h3 class="grp-panel-title">Parite Uygulaması: 15-Bulmaca Çözülebilirlik Testi</h3>
        <span class="grp-pill acc">${tex('S_{16}')} işaret değişmezi</span>
      </div>
      <div class="grp-puzzle-wrap">
        <div>
          <div class="grp-puzzle-grid" data-pgrid role="grid" aria-label="15-bulmaca tahtası"></div>
        </div>
        <div style="display:grid;gap:12px">
          <div class="grp-toolbar-g">
            <button type="button" class="btn small primary" data-pz="legal">Yasal karıştır</button>
            <button type="button" class="btn small" data-pz="loyd">14 ↔ 15 değiştir (Sam Loyd)</button>
            <button type="button" class="btn small" data-pz="swap" aria-pressed="false">İki taşı takas et</button>
            <button type="button" class="btn small ghost" data-pz="reset">Çözülmüş hal</button>
          </div>
          <div data-pz-verdict aria-live="polite"></div>
          <p class="small mute">
            ${richTex('Her yasal kaydırma boşluk ile komşu bir taşı yer değiştirir: bu $S_{16}$ içinde bir **transpozisyondur** (işareti $-1$ ile çarpar) ve boşluğun sağ alt köşeye Manhattan uzaklığı $d$ değerini $\\pm 1$ değiştirir. Dolayısıyla $\\operatorname{sgn}(\\pi)\\cdot(-1)^d$ çarpımı tüm yasal hamlelerde **değişmez** ($+1$) kalır. İki taşı yerinden söküp takas etmek ise $d$ sabitken işareti ters çevirip değişmezi $-1$ yapar — bu yüzden çözülemez!')}
          </p>
        </div>
      </div>
    </div>
  </div>`;

  const sigIn = host.querySelector('[data-sig]');
  const tauIn = host.querySelector('[data-tau]');
  const errEl = host.querySelector('[data-perm-err]');
  const cv = host.querySelector('[data-perm-cv]');
  const traceEl = host.querySelector('[data-trace]');
  const cardsEl = host.querySelector('[data-perm-cards]');
  const pzGrid = host.querySelector('[data-pgrid]');
  const pzVerdict = host.querySelector('[data-pz-verdict]');

  const drawArrow = (c, x1, y1, x2, y2, col, width, alpha, progress = 1) => {
    const mx = (x1 + x2) / 2;
    const dy = y2 - y1;
    const ctrlY = (y1 + y2) / 2 - Math.sign(dy || 1) * Math.min(28, Math.abs(dy) * 0.25 + 10);
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = col;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x1, y1);
    if (progress >= 0.999) {
      c.quadraticCurveTo(mx, ctrlY, x2, y2);
      c.stroke();
      // Arrowhead
      const ang = Math.atan2(y2 - ctrlY, x2 - mx);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x2, y2);
      c.lineTo(x2 - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4));
      c.lineTo(x2 - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4));
      c.closePath();
      c.fill();
    } else {
      // Partial quadratic curve + glowing dot at tip
      const steps = 20;
      let lx = x1, ly = y1;
      for (let s = 1; s <= steps; s++) {
        const t = (s / steps) * progress;
        const u = 1 - t;
        lx = u * u * x1 + 2 * u * t * mx + t * t * x2;
        ly = u * u * y1 + 2 * u * t * ctrlY + t * t * y2;
        c.lineTo(lx, ly);
      }
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(lx, ly, 4.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };

  const drawDiagram = (c, W, H) => {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    const padX = Math.max(38, W * 0.11);
    const padY = 44;
    const cols = [padX, W / 2, W - padX];
    const stepY = (H - padY * 2) / Math.max(1, n - 1);
    const yOf = i => (n === 1 ? H / 2 : padY + i * stepY);

    // Column titles
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '600 12px monospace';
    c.textAlign = 'center';
    c.fillText('Giriş x', cols[0], 18);
    c.fillText('τ(x)', cols[1], 18);
    c.fillText('σ(τ(x))', cols[2], 18);

    // Subtle zone labels
    c.fillStyle = 'rgba(255,255,255,0.34)';
    c.font = '500 11px monospace';
    c.fillText('1. adım: τ uygula →', (cols[0] + cols[1]) / 2, H - 12);
    c.fillText('2. adım: σ uygula →', (cols[1] + cols[2]) / 2, H - 12);

    // Arrows for every i
    for (let i = 0; i < n; i++) {
      const mid = tau[i];
      const fin = sigma[mid];
      const isFocus = focusX === i;
      const dim = focusX >= 0 && !isFocus;
      const col1 = isFocus ? acc : elemColor(i + 1);
      const col2 = isFocus ? '#f472b6' : elemColor(i + 1);
      const w = isFocus ? 2.8 : 1.5;
      const a = dim ? 0.14 : (isFocus ? 1 : 0.72);

      let p1 = 1, p2 = 1;
      if (animState && animState.x === i) {
        p1 = Math.min(1, animState.phase);
        p2 = Math.max(0, Math.min(1, animState.phase - 1));
      }
      if (p1 > 0) drawArrow(c, cols[0] + 16, yOf(i), cols[1] - 16, yOf(mid), col1, w, a, p1);
      if (p2 > 0) drawArrow(c, cols[1] + 16, yOf(mid), cols[2] - 16, yOf(fin), col2, w, a, p2);
    }

    // Nodes in all 3 columns
    for (let col = 0; col < 3; col++) {
      for (let i = 0; i < n; i++) {
        const x = cols[col], y = yOf(i);
        const hi = focusX >= 0 && (
          (col === 0 && i === focusX) ||
          (col === 1 && i === tau[focusX]) ||
          (col === 2 && i === sigma[tau[focusX]])
        );
        c.beginPath();
        c.arc(x, y, 14, 0, Math.PI * 2);
        c.fillStyle = hi ? acc : '#0d0d12';
        c.fill();
        c.lineWidth = hi ? 2.4 : 1.6;
        c.strokeStyle = hi ? '#fff' : 'rgba(255,255,255,0.45)';
        c.stroke();
        c.fillStyle = hi ? '#000' : '#f4f4f5';
        c.font = '700 13px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(i + 1), x, y + 0.5);
      }
    }
  };

  const cvCtrl = setupCanvas(cv, () => Math.max(210, 86 + n * 40), drawDiagram, ctx.clean);

  const renderAnalysis = () => {
    const prod = composePerm(sigma, tau);
    const invP = invertPerm(prod);
    const rev = composePerm(tau, sigma);
    const trans = toTranspositions(prod);
    const sgn = permSign(prod);
    const ct = cycleType(prod);
    const ord = permOrder(prod);
    const two = twoLineNotation(prod);
    const transTex = trans.length ? trans.map(([a, b]) => `(${a}\\,${b})`).join('') : 'e';

    traceEl.innerHTML = Array.from({ length: n }, (_, i) => {
      const m = tau[i], f = sigma[m];
      return `<button type="button" class="grp-trace-item ${focusX === i ? 'on' : ''}" data-tx="${i}">${i + 1} ↦ ${m + 1} ↦ <b>${f + 1}</b></button>`;
    }).join('') + `<button type="button" class="grp-trace-item ${focusX === -1 ? 'on' : ''}" data-tx="-1">Hepsi</button>`;

    cardsEl.innerHTML = `
      <div class="grp-panel" style="background:rgba(0,0,0,0.3)">
        <div class="grp-panel-head">
          <h4 class="grp-panel-title">Bileşke Sonucu ${tex('\\pi = \\sigma \\circ \\tau')}</h4>
          <span class="grp-pill ${sgn === 1 ? 'ok' : 'warn'}">${sgn === 1 ? 'Çift (+1)' : 'Tek (−1)'}</span>
        </div>
        <div class="grp-math-box">${tex(`${formatCyclesLatex(sigma)} \\circ ${formatCyclesLatex(tau)} = ${formatCyclesLatex(prod)}`, true)}</div>
        <div class="grp-math-box">${tex(two.latex)}</div>
        <div class="row wrap small mute" style="justify-content:space-between">
          <span>Ters sıra ${tex(`\\tau \\circ \\sigma = ${formatCyclesLatex(rev)}`)}</span>
          <span class="grp-pill ${formatCycles(prod) === formatCycles(rev) ? 'ok' : ''}">${formatCycles(prod) === formatCycles(rev) ? 'Değişiyor' : 'Değişmiyor!'}</span>
        </div>
      </div>

      <div class="grp-panel" style="background:rgba(0,0,0,0.3)">
        <div class="grp-panel-head"><h4 class="grp-panel-title">Cebirsel Özellikler</h4></div>
        <div class="grp-kpis">
          <div class="grp-kpi"><span class="grp-kpi-lbl">Devir tipi</span><span class="grp-kpi-val mono">[${ct.join(', ')}]</span></div>
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">Mertebe (ekok)</span><span class="grp-kpi-val">${tex(`|\\pi| = ${ord}`)}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">İşaret (Parite)</span><span class="grp-kpi-val">${tex(`\\operatorname{sgn}(\\pi) = ${sgn === 1 ? '+1' : '-1'}`)}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Ters permütasyon</span><span class="grp-kpi-val">${tex(`\\pi^{-1} = ${formatCyclesLatex(invP)}`)}</span></div>
        </div>
        <div class="small mute">Transpozisyon ayrışımı (${trans.length} transpozisyon):</div>
        <div class="grp-math-box">${tex(`${formatCyclesLatex(prod)} = ${transTex}`)}</div>
      </div>`;
  };

  const loop = createAnimLoop(now => {
    if (!animState) return false;
    const elapsed = (now - animState.t0) / 520;
    animState.phase = Math.min(2.3, elapsed);
    cvCtrl.render();
    if (elapsed >= 2.3) {
      if (animState.auto && animState.x < n - 1) {
        animState = { x: animState.x + 1, phase: 0, t0: now, auto: true };
        focusX = animState.x;
        renderAnalysis();
        return true;
      }
      animState = null;
      cvCtrl.render();
      return false;
    }
    return true;
  }, ctx.clean);

  const tryParse = () => {
    try {
      sigma = parseCycles(sigIn.value, n);
      tau = parseCycles(tauIn.value, n);
      sigmaStr = sigIn.value;
      tauStr = tauIn.value;
      errEl.textContent = '';
      sigIn.classList.remove('bad');
      tauIn.classList.remove('bad');
      renderAnalysis();
      cvCtrl.render();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };

  sigIn.oninput = tryParse;
  tauIn.oninput = tryParse;

  host.querySelector('[data-deg]').onclick = e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    n = +b.dataset.d;
    host.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b));
    focusX = -1;
    animState = null;
    sigIn.value = n === 3 ? '(1 2)' : (n === 4 ? '(1 2 3)' : '(1 2 3 4)');
    tauIn.value = n === 3 ? '(2 3)' : (n === 4 ? '(2 4)(1 3)' : '(1 5)(2 4)');
    tryParse();
    cvCtrl.resize();
  };

  host.querySelector('[data-anim-go]').onclick = () => {
    if (motion() !== 'full') {
      focusX = (focusX + 1) % n;
      animState = null;
      renderAnalysis();
      cvCtrl.render();
      return;
    }
    focusX = 0;
    animState = { x: 0, phase: 0, t0: performance.now(), auto: true };
    renderAnalysis();
    loop.start();
  };

  host.querySelector('[data-anim-step]').onclick = () => {
    focusX = focusX < 0 ? 0 : (focusX + 1) % n;
    if (motion() === 'full') {
      animState = { x: focusX, phase: 0, t0: performance.now(), auto: false };
      loop.start();
    } else {
      animState = null;
    }
    renderAnalysis();
    cvCtrl.render();
  };

  host.querySelector('[data-swap-st]').onclick = () => {
    const tmp = sigIn.value;
    sigIn.value = tauIn.value;
    tauIn.value = tmp;
    tryParse();
  };

  host.querySelector('[data-rand-perm]').onclick = () => {
    const randP = () => {
      const a = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return formatCycles(a);
    };
    sigIn.value = randP();
    tauIn.value = randP();
    focusX = -1;
    animState = null;
    tryParse();
  };

  traceEl.onclick = e => {
    const b = e.target.closest('[data-tx]'); if (!b) return;
    focusX = +b.dataset.tx;
    if (focusX >= 0 && motion() === 'full') {
      animState = { x: focusX, phase: 0, t0: performance.now(), auto: false };
      loop.start();
    } else {
      animState = null;
    }
    renderAnalysis();
    cvCtrl.render();
  };

  // --- 15-Puzzle logic ---
  const renderPuzzle = () => {
    const info = puzzleSolvability(board);
    const solved = board.every((v, i) => v === (i === 15 ? 0 : i + 1));
    pzGrid.innerHTML = board.map((v, i) => {
      const isOk = v !== 0 && v === i + 1;
      const cls = ['grp-tile', v === 0 ? 'empty' : '', swapFirst === i ? 'picked' : '', isOk ? 'ok-pos' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-ti="${i}" ${v === 0 ? 'aria-label="Boş kare"' : `aria-label="Taş ${v}"`}>${v === 0 ? '' : v}</button>`;
    }).join('');

    pzVerdict.innerHTML = `<div class="grp-callout ${info.solvable ? 'ok' : 'bad'}" style="display:grid;gap:6px">
      <div class="row wrap" style="justify-content:space-between">
        <b>${info.solvable ? (solved ? '✓ ÇÖZÜLMÜŞ DURUM' : '✓ ÇÖZÜLEBİLİR (Çift parite sınıfı)') : '✗ ÇÖZÜLEMEZ (Tek parite sınıfı!)'}</b>
        <span class="grp-pill ${info.solvable ? 'ok' : 'bad'}">${tex(`\\text{Değişmez} = ${info.invariant === 1 ? '+1' : '-1'}`)}</span>
      </div>
      <div class="small mono">
        Ters çevirme I = ${info.inversions} · Alttan boşluk satırı r = ${info.emptyRowFromBottom} · I + r = ${info.inversions + info.emptyRowFromBottom} (${(info.inversions + info.emptyRowFromBottom) % 2 === 1 ? 'tek ⇒ çözülebilir' : 'çift ⇒ çözülemez'})
      </div>
      <div class="small mute">
        ${tex(`\\operatorname{sgn}(\\pi) = ${info.permSign === 1 ? '+1' : '-1'}`)} · boşluk uzaklığı ${tex(`d = ${info.blankTaxicab}`)} · ${tex(`\\operatorname{sgn}(\\pi)\\cdot(-1)^d = ${info.invariant === 1 ? '+1' : '-1'}`)}
      </div>
    </div>`;
  };

  pzGrid.onclick = e => {
    const b = e.target.closest('[data-ti]'); if (!b) return;
    const idx = +b.dataset.ti;
    if (swapMode) {
      if (board[idx] === 0) return;
      if (swapFirst === -1) { swapFirst = idx; renderPuzzle(); return; }
      if (swapFirst === idx) { swapFirst = -1; renderPuzzle(); return; }
      [board[swapFirst], board[idx]] = [board[idx], board[swapFirst]];
      swapFirst = -1;
      renderPuzzle();
      return;
    }
    const z = board.indexOf(0);
    const dr = Math.abs(Math.floor(idx / 4) - Math.floor(z / 4));
    const dc = Math.abs((idx % 4) - (z % 4));
    if (dr + dc === 1) {
      [board[z], board[idx]] = [board[idx], board[z]];
      renderPuzzle();
    }
  };

  host.querySelectorAll('[data-pz]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.pz;
      if (act === 'reset') {
        board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
        swapFirst = -1;
      } else if (act === 'loyd') {
        board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0];
        swapFirst = -1;
      } else if (act === 'legal') {
        board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
        let z = 15, prev = -1;
        for (let s = 0; s < 30; s++) {
          const r = Math.floor(z / 4), c = z % 4;
          const nbrs = [];
          if (r > 0) nbrs.push(z - 4);
          if (r < 3) nbrs.push(z + 4);
          if (c > 0) nbrs.push(z - 1);
          if (c < 3) nbrs.push(z + 1);
          const choices = nbrs.filter(x => x !== prev);
          const nxt = choices[Math.floor(Math.random() * choices.length)];
          [board[z], board[nxt]] = [board[nxt], board[z]];
          prev = z;
          z = nxt;
        }
        swapFirst = -1;
      } else if (act === 'swap') {
        swapMode = !swapMode;
        swapFirst = -1;
        btn.classList.toggle('primary', swapMode);
        btn.setAttribute('aria-pressed', String(swapMode));
        toast(swapMode ? 'Takas modu açık: yer değiştirmek için iki taşa dokun' : 'Normal kaydırma modu');
      }
      renderPuzzle();
    };
  });

  renderAnalysis();
  renderPuzzle();
}

// =====================================================================
// TAB 5: CAYLEY GRAFİĞİ
// =====================================================================
function mountCayleyGraph(host, G, ctx) {
  const n = G.size;
  const initGens = (G.meta?.defaultGenerators || minimalGeneratingSet(G)).filter(g => g !== G.e);
  let activeGens = new Set(initGens.length ? initGens : (n > 1 ? [1] : []));
  let layoutMode = n <= 36 && motion() === 'full' ? 'force' : 'circular';
  let selectedNode = n > 1 ? Math.min(n - 1, 2) : 0;
  let walkNode = G.e;
  let walkAnim = null; // { steps, idx, progress, t0 }
  let dragNode = -1;
  let nodes = []; // [{ id, x, y, vx, vy }]
  let graph = cayleyGraph(G, [...activeGens]);

  const chipElems = Array.from({ length: Math.min(n, 16) }, (_, i) => i).filter(i => i !== G.e);

  host.innerHTML = `<div class="grp-stage">
    <div class="grp-panel">
      <div class="grp-toolbar">
        <div class="grp-toolbar-g">
          <span class="mute small">Üreteçler:</span>
          <div class="grp-elems" data-gchips></div>
          ${n > 16 ? `<select class="inp grp-sel" data-add-gen aria-label="Başka üreteç ekle"><option value="">+ Eleman ekle…</option>${G.elements.map((el, i) => i === G.e ? '' : `<option value="${i}">${esc(el)}</option>`).join('')}</select>` : ''}
        </div>
        <div class="grp-toolbar-g">
          <div class="seg" data-lay role="tablist" aria-label="Yerleşim biçimi">
            <button type="button" data-l="force" class="${layoutMode === 'force' ? 'on' : ''}">Kuvvet tabanlı</button>
            <button type="button" data-l="circular" class="${layoutMode === 'circular' ? 'on' : ''}">Dairesel / Katman</button>
          </div>
        </div>
      </div>

      <div class="grp-toolbar" data-status-bar></div>

      <div class="grp-cv-box">
        <canvas class="grp-cv" data-cg-cv aria-label="${esc(G.name)} Cayley grafiği"></canvas>
        <div class="grp-cv-overlay small">Düğüme dokun → e'den kelimeyi gör · Sürükleyerek düzenle</div>
      </div>

      <div class="grp-callout" data-path-box aria-live="polite"></div>
    </div>
  </div>`;

  const chipsEl = host.querySelector('[data-gchips]');
  const statusEl = host.querySelector('[data-status-bar]');
  const pathEl = host.querySelector('[data-path-box]');
  const cv = host.querySelector('[data-cg-cv]');

  const initPositions = (W, H) => {
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.37;
    if (layoutMode === 'circular' || n > 48) {
      // Group nodes into concentric BFS distance rings around identity
      const rings = new Map();
      for (const u of graph.reachable) {
        const d = graph.paths.get(u)?.length || 0;
        if (!rings.has(d)) rings.set(d, []);
        rings.get(d).push(u);
      }
      const maxD = Math.max(1, ...rings.keys());
      nodes = Array.from({ length: n }, (_, i) => ({ id: i, x: cx, y: cy, vx: 0, vy: 0, reach: false }));
      for (const [d, list] of rings.entries()) {
        const rad = d === 0 ? 0 : (R * d) / maxD;
        list.forEach((u, k) => {
          const a = -Math.PI / 2 + (2 * Math.PI * k) / list.length;
          nodes[u] = { id: u, x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a), vx: 0, vy: 0, reach: true };
        });
      }
      // Unreachable nodes arranged subtly on outer dashed ring
      const unreach = [];
      for (let i = 0; i < n; i++) if (!nodes[i].reach) unreach.push(i);
      unreach.forEach((u, k) => {
        const a = (2 * Math.PI * k) / unreach.length;
        nodes[u] = { id: u, x: cx + (R + 28) * Math.cos(a), y: cy + (R + 28) * Math.sin(a), vx: 0, vy: 0, reach: false };
      });
    } else {
      // Seed force-directed on a jittered circle for fast deterministic convergence
      nodes = Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const jitter = i === G.e ? 0 : R * (0.72 + ((i * 37) % 10) * 0.03);
        return { id: i, x: cx + jitter * Math.cos(a), y: cy + jitter * Math.sin(a), vx: 0, vy: 0, reach: graph.paths.has(i) };
      });
    }
  };

  const renderChips = () => {
    const genArr = [...activeGens];
    const allChipIds = [...new Set([...chipElems, ...genArr])];
    chipsEl.innerHTML = allChipIds.map(g => {
      const slot = genArr.indexOf(g);
      const on = slot >= 0;
      const col = on ? GEN_PALETTE[slot % GEN_PALETTE.length] : 'transparent';
      return `<button type="button" class="grp-el ${on ? 'on' : ''}" data-g="${g}" aria-pressed="${on}">
        ${on ? `<i class="grp-dot" style="background:${col}"></i>` : ''}${esc(G.elements[g])}
      </button>`;
    }).join('');

    statusEl.innerHTML = `<div class="grp-toolbar-g">
      <span class="grp-pill ${graph.allReached ? 'ok' : 'warn'}">${graph.allReached ? `Tüm grup bağlı (${n}/${n})` : `Alt grup (${graph.reachable.length}/${n} erişilebilir)`}</span>
      ${genArr.map((g, i) => `<span class="grp-pill"><i class="grp-dot" style="background:${GEN_PALETTE[i % GEN_PALETTE.length]}"></i>·${esc(G.elements[g])}</span>`).join('')}
    </div>
    <div class="grp-toolbar-g">
      <span class="small mute">Manuel yürüyüş (şu an <b>${esc(G.elements[walkNode])}</b>):</span>
      ${genArr.slice(0, 4).map((g, i) => `<button type="button" class="btn small" data-walk-g="${g}" style="border-color:${GEN_PALETTE[i % GEN_PALETTE.length]}">·${esc(G.elements[g])}</button>`).join('')}
      <button type="button" class="btn small ghost" data-walk-reset>e'ye dön</button>
    </div>`;
  };

  const renderPathBox = () => {
    const steps = graph.paths.get(selectedNode);
    if (!steps) {
      pathEl.innerHTML = `<span class="small mute"><b>${esc(G.elements[selectedNode])}</b> elemanı seçili üreteçlerle ${tex('e')}'den erişilemez. Başka üreteç eklemeyi dene!</span>`;
      return;
    }
    const wordTex = steps.length
      ? steps.map(s => elemLatex(G, s.gen)).join(' \\cdot ') + ` = ${elemLatex(G, selectedNode)}`
      : `${elemLatex(G, G.e)} \\text{ (birim eleman)}`;
    pathEl.innerHTML = `<div style="display:grid;gap:4px">
      <div class="small mute">En kısa kelime (${steps.length} adım · mertebe ${order(G, selectedNode)}):</div>
      <div>${tex(wordTex)}</div>
    </div>
    <button type="button" class="btn small primary" data-play-walk ${steps.length ? '' : 'disabled'}>${icon('play')} Yürüyüşü canlandır</button>`;
  };

  const drawGraph = (c, W, H) => {
    c.clearRect(0, 0, W, H);
    if (!nodes.length) return;
    const acc = accentColor();
    const nodeR = n <= 12 ? 17 : (n <= 24 ? 14 : (n <= 60 ? 10 : 7));

    // Highlighted shortest-path edge set
    const pathSteps = graph.paths.get(selectedNode) || [];
    const pathEdgeKeys = new Set(pathSteps.map(s => `${s.from}->${s.to}:${s.gen}`));

    // Detect mutual edges (u->v and v->u for same generator, i.e. order-2 generator)
    const edgeSet = new Set(graph.edges.map(e => `${e.from}->${e.to}:${e.genSlot}`));

    // Draw edges
    for (const e of graph.edges) {
      const a = nodes[e.from], b = nodes[e.to];
      if (!a || !b) continue;
      const col = GEN_PALETTE[e.genSlot % GEN_PALETTE.length];
      const isPath = pathEdgeKeys.has(`${e.from}->${e.to}:${e.gen}`);
      const mutual = edgeSet.has(`${e.to}->${e.from}:${e.genSlot}`);
      if (mutual && e.from > e.to && !isPath) continue; // draw undirected order-2 edge once

      c.save();
      c.strokeStyle = col;
      c.globalAlpha = isPath ? 1 : (n > 40 ? 0.34 : 0.62);
      c.lineWidth = isPath ? 3 : (n > 40 ? 1.1 : 1.7);

      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const sx = a.x + ux * (nodeR + 1), sy = a.y + uy * (nodeR + 1);
      const ex = b.x - ux * (nodeR + 2), ey = b.y - uy * (nodeR + 2);

      // Slight curvature when multiple generators connect same pair
      const curve = (e.genSlot - 0.5) * (mutual ? 0 : 10);
      const mx = (sx + ex) / 2 - uy * curve;
      const my = (sy + ey) / 2 + ux * curve;

      c.beginPath();
      c.moveTo(sx, sy);
      if (Math.abs(curve) > 1) c.quadraticCurveTo(mx, my, ex, ey);
      else c.lineTo(ex, ey);
      c.stroke();

      // Arrowhead (omit if mutual order-2 edge and not highlighted walk)
      if (!mutual || isPath) {
        const ang = Math.atan2(ey - (Math.abs(curve) > 1 ? my : sy), ex - (Math.abs(curve) > 1 ? mx : sx));
        const al = n > 40 ? 5 : 7.5;
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(ex, ey);
        c.lineTo(ex - al * Math.cos(ang - 0.42), ey - al * Math.sin(ang - 0.42));
        c.lineTo(ex - al * Math.cos(ang + 0.42), ey - al * Math.sin(ang + 0.42));
        c.closePath();
        c.fill();
      }
      c.restore();
    }

    // Draw nodes
    for (const nd of nodes) {
      const isId = nd.id === G.e;
      const isSel = nd.id === selectedNode;
      const isWalk = nd.id === walkNode;
      c.save();
      c.globalAlpha = nd.reach ? 1 : 0.35;
      c.beginPath();
      c.arc(nd.x, nd.y, nodeR, 0, Math.PI * 2);
      c.fillStyle = isSel ? acc : (isId ? 'rgba(255,255,255,0.16)' : '#0d0d13');
      c.fill();
      c.lineWidth = isId || isSel || isWalk ? 2.4 : 1.4;
      c.strokeStyle = isWalk ? '#5be49b' : (isSel ? '#fff' : (isId ? acc : 'rgba(255,255,255,0.45)'));
      c.stroke();
      if (isId) {
        c.beginPath();
        c.arc(nd.x, nd.y, nodeR + 4, 0, Math.PI * 2);
        c.lineWidth = 1;
        c.strokeStyle = acc;
        c.stroke();
      }
      if (n <= 30) {
        c.fillStyle = isSel ? '#000' : '#f4f4f5';
        c.font = `600 ${n <= 12 ? 11 : 9.5}px monospace`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const lbl = G.elements[nd.id].length > 7 ? G.elements[nd.id].slice(0, 6) + '…' : G.elements[nd.id];
        c.fillText(lbl, nd.x, nd.y + 0.5);
      }
      c.restore();
    }

    // Draw animated walk comet
    if (walkAnim && walkAnim.idx < walkAnim.steps.length) {
      const st = walkAnim.steps[walkAnim.idx];
      const a = nodes[st.from], b = nodes[st.to];
      const t = walkAnim.progress;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      c.save();
      c.beginPath();
      c.arc(px, py, 7, 0, Math.PI * 2);
      c.fillStyle = '#fff';
      c.shadowColor = acc;
      c.shadowBlur = 14;
      c.fill();
      c.restore();
    }
  };

  let physicsStepsLeft = 0;
  const cvCtrl = setupCanvas(cv, w => Math.min(440, Math.max(300, w * 0.62)), (c, W, H) => {
    if (!nodes.length) initPositions(W, H);
    drawGraph(c, W, H);
  }, ctx.clean);

  const loop = createAnimLoop((now, dt) => {
    let keep = false;
    const { W, H } = cvCtrl.size();

    if (layoutMode === 'force' && physicsStepsLeft > 0 && n <= 48) {
      physicsStepsLeft--;
      const cx = W / 2, cy = H / 2;
      const targetLen = Math.min(W, H) * (n <= 10 ? 0.25 : 0.16);
      const repulse = targetLen * targetLen * 0.72;
      let energy = 0;

      for (let i = 0; i < n; i++) {
        if (i === dragNode) continue;
        let fx = (cx - nodes[i].x) * 0.08;
        let fy = (cy - nodes[i].y) * 0.08;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy + 16;
          const f = repulse / d2;
          const d = Math.sqrt(d2);
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
        nodes[i].vx = (nodes[i].vx + fx * dt) * 0.84;
        nodes[i].vy = (nodes[i].vy + fy * dt) * 0.84;
      }
      for (const e of graph.edges) {
        const a = nodes[e.from], b = nodes[e.to];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const force = (d - targetLen) * 0.9;
        const fx = (dx / d) * force * dt, fy = (dy / d) * force * dt;
        if (e.from !== dragNode) { a.vx += fx; a.vy += fy; }
        if (e.to !== dragNode) { b.vx -= fx; b.vy -= fy; }
      }
      const pad = 26;
      for (let i = 0; i < n; i++) {
        if (i === dragNode) continue;
        nodes[i].x = Math.max(pad, Math.min(W - pad, nodes[i].x + nodes[i].vx));
        nodes[i].y = Math.max(pad, Math.min(H - pad, nodes[i].y + nodes[i].vy));
        energy += nodes[i].vx * nodes[i].vx + nodes[i].vy * nodes[i].vy;
      }
      if (energy > 0.08 && physicsStepsLeft > 0) keep = true;
      else physicsStepsLeft = 0;
    }

    if (walkAnim) {
      const p = (now - walkAnim.t0) / 420;
      if (p >= 1) {
        walkNode = walkAnim.steps[walkAnim.idx].to;
        walkAnim.idx++;
        walkAnim.t0 = now;
        walkAnim.progress = 0;
        renderChips();
        if (walkAnim.idx >= walkAnim.steps.length) walkAnim = null;
        else keep = true;
      } else {
        walkAnim.progress = p;
        keep = true;
      }
    }

    cvCtrl.render();
    return keep;
  }, ctx.clean);

  const rebuild = (reseed = false) => {
    graph = cayleyGraph(G, [...activeGens]);
    walkAnim = null;
    if (reseed || !nodes.length) {
      const { W, H } = cvCtrl.size();
      initPositions(W, H);
    } else {
      for (const nd of nodes) nd.reach = graph.paths.has(nd.id);
    }
    renderChips();
    renderPathBox();
    if (layoutMode === 'force' && n <= 48 && motion() === 'full') {
      physicsStepsLeft = 240;
      loop.start();
    } else {
      cvCtrl.render();
    }
  };

  // Pointer interaction: tap node or drag node
  const hitNode = (x, y) => {
    const r = Math.max(18, n <= 24 ? 20 : 14);
    let best = -1, bestD = r;
    for (const nd of nodes) {
      const d = Math.hypot(nd.x - x, nd.y - y);
      if (d < bestD) { bestD = d; best = nd.id; }
    }
    return best;
  };
  let ptrDownAt = null;
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const id = hitNode(x, y);
    if (id >= 0) {
      dragNode = id;
      ptrDownAt = { x, y, id };
      cv.setPointerCapture?.(e.pointerId);
    }
  });
  cv.addEventListener('pointermove', e => {
    if (dragNode < 0) return;
    const r = cv.getBoundingClientRect();
    const { W, H } = cvCtrl.size();
    nodes[dragNode].x = Math.max(20, Math.min(W - 20, e.clientX - r.left));
    nodes[dragNode].y = Math.max(20, Math.min(H - 20, e.clientY - r.top));
    nodes[dragNode].vx = nodes[dragNode].vy = 0;
    if (layoutMode === 'force' && n <= 48 && motion() === 'full') {
      physicsStepsLeft = Math.max(physicsStepsLeft, 80);
      loop.start();
    } else {
      cvCtrl.render();
    }
  });
  const endDrag = e => {
    if (dragNode < 0) return;
    const r = cv.getBoundingClientRect();
    const dist = ptrDownAt ? Math.hypot((e.clientX - r.left) - ptrDownAt.x, (e.clientY - r.top) - ptrDownAt.y) : 99;
    if (dist < 8 && ptrDownAt) {
      selectedNode = ptrDownAt.id;
      renderPathBox();
      cvCtrl.render();
    }
    dragNode = -1;
    ptrDownAt = null;
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  chipsEl.onclick = e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = +b.dataset.g;
    if (activeGens.has(g)) { if (activeGens.size > 1) activeGens.delete(g); }
    else activeGens.add(g);
    rebuild(false);
  };
  host.querySelector('[data-add-gen]')?.addEventListener('change', e => {
    const v = e.target.value;
    if (v !== '') { activeGens.add(+v); e.target.value = ''; rebuild(false); }
  });
  host.querySelector('[data-lay]').onclick = e => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    layoutMode = b.dataset.l;
    host.querySelectorAll('[data-l]').forEach(x => x.classList.toggle('on', x === b));
    rebuild(true);
  };
  statusEl.onclick = e => {
    const wg = e.target.closest('[data-walk-g]');
    if (wg) {
      const g = +wg.dataset.walkG;
      const next = G.mul(walkNode, g);
      if (motion() === 'full') {
        walkAnim = { steps: [{ from: walkNode, to: next, gen: g }], idx: 0, progress: 0, t0: performance.now() };
        loop.start();
      } else {
        walkNode = next;
        renderChips();
        cvCtrl.render();
      }
      return;
    }
    if (e.target.closest('[data-walk-reset]')) {
      walkNode = G.e;
      walkAnim = null;
      renderChips();
      cvCtrl.render();
    }
  };
  pathEl.onclick = e => {
    if (!e.target.closest('[data-play-walk]')) return;
    const steps = graph.paths.get(selectedNode) || [];
    if (!steps.length) return;
    walkNode = G.e;
    if (motion() !== 'full') {
      walkNode = selectedNode;
      renderChips();
      cvCtrl.render();
      return;
    }
    walkAnim = { steps, idx: 0, progress: 0, t0: performance.now() };
    renderChips();
    loop.start();
  };

  rebuild(true);
}

// =====================================================================
// TAB 6: ALT GRUPLAR & KAFES (Subgroups, Hasse Lattice, Cosets, G/N)
// =====================================================================
function mountSubgroups(host, G, ctx) {
  host.innerHTML = `<div class="grp-loader"><span class="orbit-loader"></span><span>${esc(G.name)} alt grupları ve Hasse kafesi hesaplanıyor…</span></div>`;

  let dead = false;
  ctx.clean.add(() => { dead = true; });

  deferTask(() => subgroupLattice(G), G.size > 24).then(lat => {
    if (dead || !host.isConnected) return;
    const subs = lat.subgroups;
    let selectedIdx = subs.length > 2 ? Math.min(subs.length - 2, Math.max(1, subs.findIndex(s => s.order > 1 && s.order < G.size))) : 0;
    if (selectedIdx < 0) selectedIdx = 0;
    let filterMode = subs.length > 40 ? 'normal' : 'all'; // keep S5/A5 lattice uncluttered initially
    let orderFilter = '';

    const normalsCount = subs.filter(s => s.isNormal).length;
    const cyclicCount = subs.filter(s => s.isCyclic).length;

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-toolbar">
        <div class="grp-toolbar-g">
          <span class="grp-pill acc">Toplam ${subs.length} alt grup</span>
          <span class="grp-pill ok">${normalsCount} normal (◁)</span>
          <span class="grp-pill">${cyclicCount} devirli</span>
          <span class="grp-pill">Lagrange ✓ (her |H| | ${G.size})</span>
        </div>
        <div class="grp-toolbar-g">
          <div class="seg" data-lfilt role="tablist" aria-label="Kafes filtresi">
            <button type="button" data-lf="all" class="${filterMode === 'all' ? 'on' : ''}">Tümü (${subs.length})</button>
            <button type="button" data-lf="normal" class="${filterMode === 'normal' ? 'on' : ''}">Normal (${normalsCount})</button>
            <button type="button" data-lf="cyclic" class="${filterMode === 'cyclic' ? 'on' : ''}">Devirli (${cyclicCount})</button>
          </div>
        </div>
      </div>

      <div class="grp-grid-side">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Alt Grup Kafesi (Hasse Diyagramı)</h3>
            <span class="mute small">Çift/vurgulu halka = normal (◁) · İncelemek için dokun</span>
          </div>
          <div class="grp-lattice-scroll" data-lat-box></div>
        </div>

        <div class="grp-panel" data-inspector aria-live="polite"></div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Tüm Alt Gruplar Listesi</h3>
          <select class="inp grp-sel" data-ofilt aria-label="Mertebeye göre filtrele">
            <option value="">Tüm mertebeler</option>
            ${lat.levelOrders.map(o => `<option value="${o}">|H| = ${o} (${lat.levels.get(o).length} adet)</option>`).join('')}
          </select>
        </div>
        <div class="grp-table-wrap" data-sub-tbl></div>
      </div>
    </div>`;

    const latBox = host.querySelector('[data-lat-box]');
    const inspEl = host.querySelector('[data-inspector]');
    const tblBox = host.querySelector('[data-sub-tbl]');
    const oFiltSel = host.querySelector('[data-ofilt]');

    const renderLattice = () => {
      const visible = new Set();
      subs.forEach((s, i) => {
        if (filterMode === 'all' || (filterMode === 'normal' && s.isNormal) || (filterMode === 'cyclic' && (s.isCyclic || i === subs.length - 1))) {
          visible.add(i);
        }
      });
      visible.add(selectedIdx);

      const visLevels = new Map();
      for (const o of lat.levelOrders) {
        const arr = lat.levels.get(o).filter(i => visible.has(i));
        if (arr.length) visLevels.set(o, arr);
      }
      const ordersArr = Array.from(visLevels.keys());
      const maxRow = Math.max(1, ...Array.from(visLevels.values(), a => a.length));
      const padL = 62, padR = 26, padY = 28;
      const gapX = maxRow > 14 ? 52 : 76;
      const gapY = ordersArr.length > 7 ? 56 : 68;
      const W = Math.max(360, padL + padR + maxRow * gapX);
      const H = Math.max(220, padY * 2 + Math.max(1, ordersArr.length - 1) * gapY);

      const pos = new Map();
      ordersArr.forEach((o, li) => {
        const y = H - padY - li * gapY;
        const row = visLevels.get(o);
        const usable = W - padL - padR;
        row.forEach((idx, ri) => {
          const x = padL + usable * ((ri + 0.5) / row.length);
          pos.set(idx, { x, y });
        });
      });

      // Compute subset relation with selectedIdx for highlighting chain
      const selSet = new Set(subs[selectedIdx].elements);
      const isRelated = idx => {
        if (idx === selectedIdx) return true;
        const a = subs[idx].elements, b = subs[selectedIdx].elements;
        if (a.length < b.length) return a.every(x => selSet.has(x));
        if (a.length > b.length) { const big = new Set(a); return b.every(x => big.has(x)); }
        return false;
      };

      const guides = ordersArr.map((o, li) => {
        const y = H - padY - li * gapY;
        return `<line class="grp-lat-guide" x1="${padL - 8}" y1="${y}" x2="${W - 10}" y2="${y}"/>
          <text class="grp-lat-lvl" x="10" y="${y + 4}">|H|=${o}</text>`;
      }).join('');

      const visIdx = Array.from(pos.keys()).sort((a, b) => a - b);
      let edgesPairs = lat.edges.filter(([a, b]) => pos.has(a) && pos.has(b)).map(([a, b]) => [a, b, false]);
      if (filterMode !== 'all') {
        // Recompute Hasse covering edges within the filtered subposet so chains like {e} ◁ A5 ◁ S5 stay connected
        const visSets = new Map(visIdx.map(i => [i, new Set(subs[i].elements)]));
        const directSet = new Set(edgesPairs.map(([a, b]) => `${a}-${b}`));
        edgesPairs = [];
        for (let ai = 0; ai < visIdx.length; ai++) {
          const i = visIdx[ai], oi = subs[i].order;
          const above = [];
          for (let bi = ai + 1; bi < visIdx.length; bi++) {
            const j = visIdx[bi];
            if (subs[j].order % oi === 0 && subs[i].elements.every(x => visSets.get(j).has(x))) above.push(j);
          }
          for (let p = 0; p < above.length; p++) {
            const j = above[p], oj = subs[j].order;
            let cov = true;
            for (let q = 0; q < p; q++) {
              const k = above[q];
              if (oj % subs[k].order === 0 && subs[k].elements.every(x => visSets.get(j).has(x))) { cov = false; break; }
            }
            if (cov) edgesPairs.push([i, j, !directSet.has(`${i}-${j}`)]);
          }
        }
      }
      const edgesHtml = edgesPairs
        .map(([a, b, dashed]) => {
          const pa = pos.get(a), pb = pos.get(b);
          const hi = (a === selectedIdx || b === selectedIdx);
          const rel = hi || (isRelated(a) && isRelated(b));
          return `<line class="grp-lat-edge ${hi ? 'hi' : (rel ? '' : 'dim')}" ${dashed ? 'stroke-dasharray="4 3"' : ''} x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}"/>`;
        }).join('');

      const r = maxRow > 18 ? 14 : 17;
      const nodesHtml = Array.from(pos.entries()).map(([idx, p]) => {
        const s = subs[idx];
        const on = idx === selectedIdx;
        const lbl = s.order === 1 ? 'e' : (s.order === G.size ? G.name : (s.isNormal ? `${s.order}◁` : String(s.order)));
        return `<g class="grp-lat-node ${s.isNormal ? 'normal' : ''} ${on ? 'on' : ''}" data-sidx="${idx}" tabindex="0" role="button" aria-label="Alt grup mertebe ${s.order}, ${s.isNormal ? 'normal' : 'normal değil'}">
          ${s.isNormal ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r + 3.5}" style="fill:none;stroke:var(--acc);stroke-width:1;opacity:0.55"/>` : ''}
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"/>
          <text x="${p.x.toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}" text-anchor="middle">${esc(lbl.length > 5 ? String(s.order) : lbl)}</text>
        </g>`;
      }).join('');

      latBox.innerHTML = `<svg class="grp-lattice-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-label="${esc(G.name)} alt grup kafesi">${guides}${edgesHtml}${nodesHtml}</svg>`;
    };

    const renderInspector = () => {
      const s = subs[selectedIdx];
      const lc = leftCosets(G, s.elements);
      const rc = rightCosets(G, s.elements);
      const normG = normalizer(G, s.elements);
      const lcKeys = new Set(lc.map(c => c.join(',')));
      const rcKeys = new Set(rc.map(c => c.join(',')));

      let quotHtml = '';
      if (s.isNormal) {
        const Q = quotient(G, s.elements);
        const qIdent = identifyGroup(Q);
        quotHtml = `<div style="display:grid;gap:8px;padding-top:8px;border-top:1px solid var(--line)">
          <div class="grp-panel-head">
            <h4 class="grp-panel-title">Bölüm Grubu ${tex(`${G.latex}/N`)}</h4>
            <span class="grp-pill acc">${tex(`|G/N| = ${Q.size}`)}${qIdent ? ` · ${tex(`\\cong ${qIdent.latex}`)}` : ''}</span>
          </div>
          ${Q.size <= 12
            ? renderHtmlCayleyTable(Q, { compact: true, ariaLabel: `${Q.name} bölüm grubu Cayley tablosu` })
            : `<p class="small mute">Bölüm grubu ${Q.size} elemanlıdır (${qIdent ? tex(`G/N \\cong ${qIdent.latex}`) : ''}).</p>`}
        </div>`;
      }

      const fmtCosets = (list, otherSet, side) => list.slice(0, 12).map(c => {
        const key = c.join(',');
        const diff = !otherSet.has(key);
        const rep = G.elements[c[0]];
        const lbl = c[0] === G.e ? 'H' : (side === 'L' ? `${rep}H` : `H${rep}`);
        return `<div class="grp-coset-row ${diff ? 'diff' : ''}">
          <b class="mono">${esc(lbl)}</b>
          <span class="mute">=</span>
          <span class="mono small">{${c.slice(0, 10).map(x => esc(G.elements[x])).join(', ')}${c.length > 10 ? '…' : ''}}</span>
        </div>`;
      }).join('') + (list.length > 12 ? `<div class="small mute">+${list.length - 12} koset daha…</div>` : '');

      inspEl.innerHTML = `
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Seçili Alt Grup H</h3>
          <span class="grp-pill ${s.isNormal ? 'ok' : 'warn'}">${s.isNormal ? 'Normal (H ◁ G)' : 'Normal değil'}</span>
        </div>
        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">Mertebe |H|</span><span class="grp-kpi-val mono">${s.order}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">İndeks [G:H]</span><span class="grp-kpi-val mono">${index(G, s.elements)}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Devirli mi?</span><span class="grp-kpi-val">${s.isCyclic ? 'Evet' : 'Hayır'}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">|N_G(H)|</span><span class="grp-kpi-val mono">${normG.length}</span></div>
        </div>
        <div class="small">Üreteçler: ${tex(`H = \\langle ${s.generators.map(i => elemLatex(G, i)).join(',\\, ')} \\rangle`)}</div>
        <div class="small mute">Elemanlar: <span class="mono">{${s.elements.slice(0, 20).map(i => esc(G.elements[i])).join(', ')}${s.elements.length > 20 ? `… (${s.order})` : ''}}</span></div>
        <div class="grp-panel-head" style="padding-top:6px;border-top:1px solid var(--line)">
          <h4 class="grp-panel-title">Sol ve Sağ Kosetler (${s.isNormal ? 'Eşit ✓' : 'Farklı ✗'})</h4>
        </div>
        <div class="grp-coset-cols">
          <div><div class="small mute" style="margin-bottom:5px">Sol kosetler (gH)</div><div class="grp-coset-list">${fmtCosets(lc, rcKeys, 'L')}</div></div>
          <div><div class="small mute" style="margin-bottom:5px">Sağ kosetler (Hg)</div><div class="grp-coset-list">${fmtCosets(rc, lcKeys, 'R')}</div></div>
        </div>
        ${quotHtml}`;
    };

    const renderTable = () => {
      const rows = subs
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !orderFilter || s.order === +orderFilter);
      tblBox.innerHTML = `<table class="grp-tbl" aria-label="${esc(G.name)} alt gruplar tablosu">
        <thead><tr><th>Mertebe</th><th>İndeks</th><th>Üreteçler</th><th>Normal?</th><th>Devirli?</th></tr></thead>
        <tbody>${rows.map(({ s, i }) => `<tr class="${i === selectedIdx ? 'on' : ''}" data-sidx="${i}">
          <td class="mono"><b>${s.order}</b></td>
          <td class="mono mute">${G.size / s.order}</td>
          <td class="mono">${esc(`⟨${s.generators.map(g => G.elements[g]).join(', ')}⟩`)}</td>
          <td>${s.isNormal ? '<span class="grp-pill ok">◁ Normal</span>' : '<span class="mute small">Hayır</span>'}</td>
          <td>${s.isCyclic ? 'Evet' : '<span class="mute">Hayır</span>'}</td>
        </tr>`).join('')}</tbody></table>`;
    };

    const selectSub = idx => {
      selectedIdx = idx;
      renderLattice();
      renderInspector();
      renderTable();
    };

    latBox.onclick = e => {
      const nd = e.target.closest('[data-sidx]');
      if (nd) selectSub(+nd.dataset.sidx);
    };
    latBox.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const nd = e.target.closest('[data-sidx]');
        if (nd) { e.preventDefault(); selectSub(+nd.dataset.sidx); }
      }
    };
    tblBox.onclick = e => {
      const tr = e.target.closest('tr[data-sidx]');
      if (tr) selectSub(+tr.dataset.sidx);
    };
    host.querySelector('[data-lfilt]').onclick = e => {
      const b = e.target.closest('[data-lf]'); if (!b) return;
      filterMode = b.dataset.lf;
      host.querySelectorAll('[data-lf]').forEach(x => x.classList.toggle('on', x === b));
      renderLattice();
    };
    oFiltSel.onchange = () => { orderFilter = oFiltSel.value; renderTable(); };

    renderLattice();
    renderInspector();
    renderTable();
    syncSegments(host, true);
  });
}

// =====================================================================
// TAB 7: EŞLENİK SINIFLAR & MERKEZ
// =====================================================================
function mountConjugacy(host, G, ctx) {
  const classes = conjugacyClasses(G);
  const Z = center(G);
  const nonCentral = classes.filter(c => c.length > 1);
  let selectedElem = nonCentral.length ? nonCentral[0][0] : 0;
  let subsList = null;
  let selectedSubKey = '';

  const termDetails = nonCentral.map(cls => {
    const rep = cls[0];
    const centSize = centralizer(G, rep).length;
    return `\\underbrace{${cls.length}}_{[G:C_G(${elemLatex(G, rep)})]=${G.size}/${centSize}}`;
  });
  const eqTex = nonCentral.length
    ? `${G.size} = \\underbrace{${Z.length}}_{|Z(G)|} + ${termDetails.join(' + ')}`
    : `${G.size} = |Z(${G.latex})| = ${Z.length} \\quad \\text{(Abelyen grup)}`;

  host.innerHTML = `<div class="grp-stage">
    <div class="grp-panel">
      <div class="grp-panel-head">
        <h3 class="grp-panel-title">Sınıf Denklemi Kontrolü</h3>
        <span class="grp-pill ok">Doğrulandı ✓ (${Z.length + nonCentral.reduce((s, c) => s + c.length, 0)} = ${G.size})</span>
      </div>
      <div class="grp-math-box">${tex(eqTex, true)}</div>
      <div class="small mute">${classes.length} eşlenik sınıfı · Merkezde ${Z.length} tekil sınıf · Eşlenik elemanlar her zaman aynı mertebededir.</div>
    </div>

    <div class="grp-panel">
      <div class="grp-panel-head">
        <h3 class="grp-panel-title">Eşlenik Sınıflar (Renkli Kümeler)</h3>
        <span class="mute small">Merkezleyici ve eşlenik tanığı için bir elemana dokun</span>
      </div>
      <div class="grp-clusters" data-clusters>
        ${classes.map((cls, ci) => {
          const isCenter = cls.length === 1;
          const col = elemColor(ci + 1);
          const ord = order(G, cls[0]);
          return `<div class="grp-cluster" style="border-color:${isCenter ? 'var(--acc)' : col}">
            <div class="grp-cluster-h">
              <span><i class="grp-dot" style="background:${isCenter ? 'var(--acc)' : col};margin-right:6px"></i>${isCenter ? 'Merkez Z(G)' : `Sınıf #${ci + 1}`}</span>
              <span class="mono">|Cl|=${cls.length} · |g|=${ord}</span>
            </div>
            <div class="grp-elems">
              ${cls.slice(0, 20).map(a => `<button type="button" class="grp-el ${a === selectedElem ? 'on' : ''}" data-cel="${a}">${esc(G.elements[a])}</button>`).join('')}
              ${cls.length > 20 ? `<span class="mute small">+${cls.length - 20} daha</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="grp-grid-2">
      <div class="grp-panel" data-cent-panel aria-live="polite"></div>
      <div class="grp-panel" data-norm-panel>
        <div class="grp-panel-head"><h3 class="grp-panel-title">Normalleyici Gezgini N_G(H)</h3></div>
        <label>
          <span>Alt grup H seç:</span>
          <select class="inp grp-sel" data-norm-sel aria-label="Normalleyici için alt grup seç"><option value="">Yükleniyor…</option></select>
        </label>
        <div data-norm-out></div>
      </div>
    </div>
  </div>`;

  const centPanel = host.querySelector('[data-cent-panel]');
  const normSel = host.querySelector('[data-norm-sel]');
  const normOut = host.querySelector('[data-norm-out]');

  const renderCentralizer = () => {
    const a = selectedElem;
    const cent = centralizer(G, a);
    const cls = classes.find(c => c.includes(a)) || [a];
    // Find one explicit conjugator g for each b in Cl(a): g * a * g^{-1} = b
    const witnesses = cls.slice(0, 12).map(b => {
      let w = 0;
      for (let g = 0; g < G.size; g++) {
        if (G.mul(G.mul(g, a), G.inv(g)) === b) { w = g; break; }
      }
      return { b, w };
    });

    centPanel.innerHTML = `
      <div class="grp-panel-head">
        <h3 class="grp-panel-title">Merkezleyici Gezgini ${tex(`C_G(${elemLatex(G, a)})`)}</h3>
        <span class="grp-pill acc">${tex(`|Cl| \\cdot |C_G| = ${cls.length} \\cdot ${cent.length} = ${G.size}`)}</span>
      </div>
      <div class="small">Seçili eleman: ${tex(`a = ${elemLatex(G, a)}`)} (mertebe ${order(G, a)})</div>
      <div class="small mute">Merkezleyici (${cent.length} eleman — a ile değişen tüm elemanlar):</div>
      <div class="grp-elems">${cent.slice(0, 24).map(x => `<span class="grp-pill mono">${esc(G.elements[x])}</span>`).join('')}${cent.length > 24 ? `<span class="mute small">… (${cent.length})</span>` : ''}</div>
      <div class="small mute">Eşlenik tanıkları (${tex('g a g^{-1} = b')}):</div>
      <div class="grp-elems">${witnesses.map(({ b, w }) => `<span class="grp-pill">${tex(`${elemLatex(G, w)} \\cdot ${elemLatex(G, a)} \\cdot ${elemLatex(G, G.inv(w))} = ${elemLatex(G, b)}`)}</span>`).join('')}</div>`;
  };

  const renderNormalizer = () => {
    const s = subsList?.find(x => x.key === selectedSubKey);
    if (!s) {
      normOut.innerHTML = `<p class="small mute">Alt grup seçerek normalleyicisini incele.</p>`;
      return;
    }
    const N = normalizer(G, s.elements);
    const conjCount = G.size / N.length;
    normOut.innerHTML = `<div style="display:grid;gap:8px">
      <div class="grp-kpis">
        <div class="grp-kpi"><span class="grp-kpi-lbl">|H|</span><span class="grp-kpi-val mono">${s.order}</span></div>
        <div class="grp-kpi acc"><span class="grp-kpi-lbl">|N_G(H)|</span><span class="grp-kpi-val mono">${N.length}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Eşlenik alt grup sayısı</span><span class="grp-kpi-val mono">${conjCount}</span></div>
      </div>
      <div class="grp-callout ${s.isNormal ? 'ok' : ''}">
        <span class="small">${s.isNormal
          ? `${tex(`N_G(H) = ${G.latex}`)} olduğundan ${tex('H')} tüm grupta <b>normaldir</b> (tek eşleniği kendisidir).`
          : `${tex(`H \\trianglelefteq N_G(H) < ${G.latex}`)}; ${tex('H')} alt grubunun ${tex('G')} içinde tam <b>${conjCount}</b> eşleniği vardır (${tex(`[G:N_G(H)] = ${conjCount}`)}).`}</span>
      </div>
      <div class="small mute">Normalleyici elemanları (${N.length}):</div>
      <div class="grp-elems">${N.slice(0, 24).map(x => `<span class="grp-pill mono">${esc(G.elements[x])}</span>`).join('')}${N.length > 24 ? `<span class="mute small">… (${N.length})</span>` : ''}</div>
    </div>`;
  };

  host.querySelector('[data-clusters]').onclick = e => {
    const b = e.target.closest('[data-cel]'); if (!b) return;
    selectedElem = +b.dataset.cel;
    host.querySelectorAll('[data-cel]').forEach(x => x.classList.toggle('on', +x.dataset.cel === selectedElem));
    renderCentralizer();
  };

  normSel.onchange = () => { selectedSubKey = normSel.value; renderNormalizer(); };

  renderCentralizer();

  let dead = false;
  ctx.clean.add(() => { dead = true; });
  deferTask(() => subgroups(G), G.size > 24).then(subs => {
    if (dead || !host.isConnected) return;
    subsList = subs;
    const shown = subs.slice(0, 48);
    const defaultSub = shown.find(s => !s.isNormal) || shown[Math.min(1, shown.length - 1)] || shown[0];
    selectedSubKey = defaultSub?.key || '';
    normSel.innerHTML = shown.map(s => `<option value="${s.key}" ${s.key === selectedSubKey ? 'selected' : ''}>⟨${esc(s.generators.map(i => G.elements[i]).join(', '))}⟩ · |H|=${s.order} ${s.isNormal ? '◁' : ''}</option>`).join('');
    renderNormalizer();
  });
}

// =====================================================================
// TAB 8: HOMOMORFİZMA LABORATUVARI & 1. İZOMORFİZMA TEOREMİ
// =====================================================================
const HOMO_GROUPS = [
  { key: 'Z2', label: 'Z₂ (|G|=2)', spec: { kind: 'Z', n: 2 } },
  { key: 'Z3', label: 'Z₃ (|G|=3)', spec: { kind: 'Z', n: 3 } },
  { key: 'Z4', label: 'Z₄ (|G|=4)', spec: { kind: 'Z', n: 4 } },
  { key: 'V4', label: 'V₄ (|G|=4)', spec: { kind: 'V4' } },
  { key: 'Z6', label: 'Z₆ (|G|=6)', spec: { kind: 'Z', n: 6 } },
  { key: 'D3', label: 'D₃ (|G|=6)', spec: { kind: 'D', n: 3 } },
  { key: 'S3', label: 'S₃ (|G|=6)', spec: { kind: 'S', n: 3 } },
  { key: 'Z8', label: 'Z₈ (|G|=8)', spec: { kind: 'Z', n: 8 } },
  { key: 'D4', label: 'D₄ (|G|=8)', spec: { kind: 'D', n: 4 } },
  { key: 'Q8', label: 'Q₈ (|G|=8)', spec: { kind: 'Q8' } },
  { key: 'U8', label: 'U(8) (|G|=4)', spec: { kind: 'U', n: 8 } },
  { key: 'U10', label: 'U(10) (|G|=4)', spec: { kind: 'U', n: 10 } },
  { key: 'Z12', label: 'Z₁₂ (|G|=12)', spec: { kind: 'Z', n: 12 } },
  { key: 'A4', label: 'A₄ (|G|=12)', spec: { kind: 'A', n: 4 } },
  { key: 'S4', label: 'S₄ (|G|=24)', spec: { kind: 'S', n: 4 } },
];

const HOMO_PRESETS = [
  { label: 'sgn: S₄ → Z₂', src: { kind: 'S', n: 4 }, dst: { kind: 'Z', n: 2 }, assignFn: (G) => {
    const gens = minimalGeneratingSet(G);
    return gens.map(g => [g, permSign(G.meta.perms[g]) === 1 ? 0 : 1]);
  }},
  { label: 'mod 3: Z₆ → Z₃', src: { kind: 'Z', n: 6 }, dst: { kind: 'Z', n: 3 }, assignFn: () => [[1, 1]] },
  { label: 'D₄ → V₄ (ker=Z)', src: { kind: 'D', n: 4 }, dst: { kind: 'V4' }, assignFn: () => [[1, 1], [4, 2]] },
  { label: 'Q₈ → V₄', src: { kind: 'Q8' }, dst: { kind: 'V4' }, assignFn: () => [[2, 1], [4, 2]] },
  { label: 'U(10) ≅ Z₄', src: { kind: 'U', n: 10 }, dst: { kind: 'Z', n: 4 }, assignFn: (G) => [[minimalGeneratingSet(G)[0], 1]] },
  { label: 'Çelişki: Z₄ → Z₃', src: { kind: 'Z', n: 4 }, dst: { kind: 'Z', n: 3 }, assignFn: () => [[1, 1]] },
];

function mountHomomorphism(host, activeG, ctx) {
  let srcG = activeG.size <= 24 ? activeG : getGroupFromSpec({ kind: 'D', n: 4 });
  let dstG = srcG.size === 24 ? getGroupFromSpec({ kind: 'Z', n: 2 }) : getGroupFromSpec({ kind: 'V4' });
  let gens = [];
  let genImg = new Map();

  const initGens = (customAssign = null) => {
    gens = srcG.meta?.defaultGenerators?.length && generate(srcG, srcG.meta.defaultGenerators).length === srcG.size
      ? srcG.meta.defaultGenerators.slice()
      : minimalGeneratingSet(srcG);
    genImg = new Map();
    if (customAssign) {
      gens = customAssign.map(([g]) => g);
      for (const [g, h] of customAssign) genImg.set(g, h);
      return;
    }
    // Smart non-trivial default if possible
    for (const g of gens) {
      const og = order(srcG, g);
      let pickH = dstG.e;
      for (let h = 1; h < dstG.size; h++) {
        if (og % order(dstG, h) === 0) { pickH = h; break; }
      }
      genImg.set(g, pickH);
    }
  };
  initGens();

  const matchKey = G => HOMO_GROUPS.find(x => specKey(x.spec) === specKey(G.meta?.spec))?.key || '';

  const renderAll = () => {
    const sk = matchKey(srcG), dk = matchKey(dstG);
    const ext = extendHomomorphism(srcG, dstG, gens.map(g => [g, genImg.get(g) ?? dstG.e]));

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <span class="mute small">Hazır örnekler:</span>
            ${HOMO_PRESETS.map((p, i) => `<button type="button" class="chip ex" data-hp="${i}">${esc(p.label)}</button>`).join('')}
          </div>
        </div>
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <label class="row" style="gap:6px"><span class="mute small">Kaynak G:</span>
              <select class="inp grp-sel" data-src aria-label="Kaynak grup G">
                ${!sk ? `<option value="" selected>${esc(srcG.name)} (|G|=${srcG.size})</option>` : ''}
                ${HOMO_GROUPS.map(x => `<option value="${x.key}" ${x.key === sk ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}
              </select>
            </label>
            <span class="mono">→</span>
            <label class="row" style="gap:6px"><span class="mute small">Hedef H:</span>
              <select class="inp grp-sel" data-dst aria-label="Hedef grup H">
                ${HOMO_GROUPS.map(x => `<option value="${x.key}" ${x.key === dk ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}
              </select>
            </label>
          </div>
          <span class="grp-pill acc">${tex(`\\varphi: ${srcG.latex} \\to ${dstG.latex}`)}</span>
        </div>

        <div class="grp-panel-head"><h3 class="grp-panel-title">Üreteç Görüntülerini Tanımla</h3><span class="mute small">Gerekli koşul: ${tex('|\\varphi(g)| \\mid |g|')}</span></div>
        <div class="grp-gen-map">
          ${gens.map(g => {
            const og = order(srcG, g);
            const curH = genImg.get(g) ?? dstG.e;
            return `<div class="grp-gen-card">
              <div class="row" style="justify-content:space-between">
                <span>${tex(`\\varphi(${elemLatex(srcG, g)})`)}</span>
                <span class="small mute">${tex(`|g| = ${og}`)}</span>
              </div>
              <select class="inp grp-sel" data-gmap="${g}" aria-label="${esc(srcG.elements[g])} görüntüsü">
                ${dstG.elements.map((el, h) => {
                  const oh = order(dstG, h);
                  const okDiv = og % oh === 0;
                  return `<option value="${h}" ${h === curH ? 'selected' : ''}>${esc(el)}  (|h|=${oh}${okDiv ? '' : ' ⚠'})</option>`;
                }).join('')}
              </select>
            </div>`;
          }).join('')}
        </div>

        <div data-hres aria-live="polite"></div>
      </div>
      <div data-iso-panel></div>
    </div>`;

    const resEl = host.querySelector('[data-hres]');
    const isoPanel = host.querySelector('[data-iso-panel]');

    if (!ext.ok) {
      const c = ext.conflict;
      resEl.innerHTML = `<div class="grp-callout bad" style="display:grid;gap:6px">
        <b>✗ Homomorfizma Oluşturulamıyor</b>
        <div class="small">${esc(ext.reason)}</div>
        ${c && c.a != null && c.b != null ? `<div class="small mono">${tex(`\\varphi(${elemLatex(srcG, c.a)} \\cdot ${elemLatex(srcG, c.b)}) = ${elemLatex(dstG, c.lhs)} \\neq ${elemLatex(dstG, c.rhs)}`)}</div>` : ''}
      </div>`;
      isoPanel.innerHTML = '';
    } else {
      const ker = ext.kernel, im = ext.image;
      const Q = quotient(srcG, ker);
      const ImG = subgroupAsGroup(dstG, im, `im(φ)`, `\\operatorname{im}(\\varphi)`);
      const isoVerified = isIsomorphic(Q, ImG);

      // Build canonical coset ordering aligned with ImG order so side-by-side Cayley tables match cell-for-cell!
      const cosets = Q.meta.cosets;
      const imOrderAligned = cosets.map(c => im.indexOf(ext.map[c[0]]));

      resEl.innerHTML = `<div style="display:grid;gap:12px">
        <div class="grp-callout ok">
          <div class="row wrap" style="gap:8px">
            <b>✓ Geçerli Grup Homomorfizması</b>
            ${ext.isInjective ? '<span class="grp-pill ok">Birebir (Monomorfizma)</span>' : ''}
            ${ext.isSurjective ? '<span class="grp-pill ok">Örten (Epimorfizma)</span>' : ''}
            ${ext.isIsomorphism ? '<span class="grp-pill acc">İzomorfizma ✦</span>' : ''}
          </div>
          <span class="mono small">${tex(`|G| = |\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)| \\implies ${srcG.size} = ${ker.length} \\cdot ${im.length}`)}</span>
        </div>

        <div class="grp-grid-2">
          <div class="grp-panel" style="background:rgba(0,0,0,0.3)">
            <div class="grp-panel-head"><h4 class="grp-panel-title">Çekirdek ${tex('\\ker(\\varphi) \\trianglelefteq G')}</h4><span class="grp-pill">${ker.length} eleman</span></div>
            <div class="grp-elems">${ker.map(i => `<span class="grp-pill mono">${esc(srcG.elements[i])}</span>`).join('')}</div>
          </div>
          <div class="grp-panel" style="background:rgba(0,0,0,0.3)">
            <div class="grp-panel-head"><h4 class="grp-panel-title">Görüntü ${tex('\\operatorname{im}(\\varphi) \\le H')}</h4><span class="grp-pill acc">${im.length} eleman</span></div>
            <div class="grp-elems">${im.map(i => `<span class="grp-pill mono"><i class="grp-dot" style="background:${elemColor(i)}"></i>${esc(dstG.elements[i])}</span>`).join('')}</div>
          </div>
        </div>

        <div class="grp-table-wrap">
          <table class="grp-tbl" aria-label="Homomorfizma eşleme tablosu">
            <thead><tr><th>g ∈ G</th><th>φ(g) ∈ H</th><th>Çekirdek koseti (lif)</th></tr></thead>
            <tbody>${srcG.elements.map((el, i) => {
              const img = ext.map[i];
              const ci = Q.meta.cosetOf[i];
              return `<tr><td class="mono">${esc(el)}</td><td class="mono"><i class="grp-dot" style="background:${elemColor(img)};margin-right:6px"></i><b>${esc(dstG.elements[img])}</b></td><td class="mono mute">${esc(Q.elements[ci])}</td></tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;

      // First Isomorphism Theorem side-by-side Cayley tables!
      isoPanel.innerHTML = `<div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Birinci İzomorfizma Teoremi</h3>
          <span class="grp-pill ok">${tex(`${srcG.latex}/\\ker(\\varphi) \\cong \\operatorname{im}(\\varphi)`)} ${isoVerified ? '✓' : ''}</span>
        </div>
        <div class="grp-elems">
          <span class="small mute">Kanonik izomorfizma ${tex('\\Psi(g\\ker\\varphi) = \\varphi(g)')}:</span>
          ${cosets.map((c, ci) => `<span class="grp-pill">${tex(`${elemLatex(Q, ci)} \\mapsto ${elemLatex(dstG, ext.map[c[0]])}`)}</span>`).join('')}
        </div>
        ${Q.size <= 12 ? `<div class="grp-grid-2">
          <div>
            <div class="small mute" style="margin-bottom:6px">Bölüm Grubu ${tex(`${srcG.latex}/\\ker(\\varphi)`)} (${Q.size} koset)</div>
            ${renderHtmlCayleyTable(Q, { compact: true, ariaLabel: 'Bölüm grubu Cayley tablosu' })}
          </div>
          <div>
            <div class="small mute" style="margin-bottom:6px">Görüntü Grubu ${tex('\\operatorname{im}(\\varphi)')} (eşleşen sırada)</div>
            ${renderHtmlCayleyTable(ImG, { orderIdx: imOrderAligned, compact: true, ariaLabel: 'Görüntü grubu Cayley tablosu' })}
          </div>
        </div>` : `<p class="small mute">Bölüm ve görüntü grupları ${Q.size} elemanlı olup motor tarafından izomorf doğrulandı.</p>`}
      </div>`;
    }

    // Bind events
    host.querySelectorAll('[data-hp]').forEach(b => {
      b.onclick = () => {
        const p = HOMO_PRESETS[+b.dataset.hp];
        srcG = getGroupFromSpec(p.src);
        dstG = getGroupFromSpec(p.dst);
        initGens(p.assignFn(srcG, dstG));
        renderAll();
      };
    });
    host.querySelector('[data-src]').onchange = e => {
      const f = HOMO_GROUPS.find(x => x.key === e.target.value);
      if (f) { srcG = getGroupFromSpec(f.spec); initGens(); renderAll(); }
    };
    host.querySelector('[data-dst]').onchange = e => {
      const f = HOMO_GROUPS.find(x => x.key === e.target.value);
      if (f) { dstG = getGroupFromSpec(f.spec); initGens(); renderAll(); }
    };
    host.querySelectorAll('[data-gmap]').forEach(sel => {
      sel.onchange = () => {
        genImg.set(+sel.dataset.gmap, +sel.value);
        renderAll();
      };
    });
  };

  renderAll();
}

// =====================================================================
// TAB 9: TEOREMLER & KONU ANLATIMI (12 university-level KaTeX lessons)
// =====================================================================
const LESSONS = [
  {
    id: 'aksiyom',
    title: 'Grup Tanımı ve Aksiyomlar',
    tag: 'Temel',
    body: [
      'Boş olmayan bir $G$ kümesi ve $\\cdot : G \\times G \\to G$ ikili işlemi aşağıdaki dört koşulu sağlıyorsa $(G, \\cdot)$ bir **grup**tur:',
    ],
    theorem: '1. **Kapalılık:** $\\forall a,b \\in G,\\; a\\cdot b \\in G$.\n2. **Birleşme:** $\\forall a,b,c \\in G,\\; (a\\cdot b)\\cdot c = a\\cdot(b\\cdot c)$.\n3. **Birim eleman:** $\\exists e \\in G,\\; \\forall a \\in G,\\; e\\cdot a = a\\cdot e = a$.\n4. **Ters eleman:** $\\forall a \\in G,\\; \\exists a^{-1} \\in G,\\; a\\cdot a^{-1} = a^{-1}\\cdot a = e$.',
    example: 'Ek olarak $\\forall a,b \\in G,\\; ab = ba$ sağlanıyorsa grup **Abelyen (değişmeli)**dir. Örneğin $(\\mathbb{Z}_n, +)$ Abelyen, $D_4$ ve $S_3$ değişmeli değildir. Bir sonlu grubun Cayley tablosu her zaman bir **Latin karesi**dir (her satır ve sütunda her eleman tam bir kez görünür).',
    apply: { label: 'D₄ Cayley tablosunda gör', spec: { kind: 'D', n: 4 }, tab: 'cayley' },
  },
  {
    id: 'altgrup',
    title: 'Alt Grup Testi',
    tag: 'Temel',
    body: [
      'Bir $G$ grubunun boş olmayan $H \\subseteq G$ alt kümesi, aynı işlem altında kendi başına bir grup oluşturuyorsa $H \\le G$ yazılır.',
    ],
    theorem: '**Tek Adımlı Alt Grup Testi:** Boş olmayan $H \\subseteq G$ kümesi, ancak ve ancak $\\forall a,b \\in H$ için $a b^{-1} \\in H$ ise alt gruptur.\n**Sonlu Alt Grup Testi:** $H$ sonlu ve boş değilse, yalnızca **kapalılık** ($\\forall a,b \\in H,\\; ab \\in H$) yeterlidir.',
    example: '$D_4$ içinde dönmeler kümesi $\\langle r \\rangle = \\{e, r, r^2, r^3\\}$ çarpma altında kapalıdır; dolayısıyla $4$ mertebeli bir alt gruptur. Yansımalar kümesi $\\{s, sr, sr^2, sr^3\\}$ ise $e$ içermediğinden ve $s\\cdot s = e$ dışarı çıktığından alt grup değildir.',
    apply: { label: 'D₄ alt grup kafesini aç', spec: { kind: 'D', n: 4 }, tab: 'altgrup' },
  },
  {
    id: 'lagrange',
    title: 'Lagrange Teoremi (ve Tersinin Bozulması)',
    tag: 'Klasik',
    body: [
      'Sonlu gruplar teorisinin temel taşı olan Lagrange teoremi, bir alt grubun mertebesi ile grubun mertebesi arasında kesin bölünebilirlik bağı kurar.',
    ],
    theorem: '**Lagrange Teoremi:** $G$ sonlu bir grup ve $H \\le G$ ise $|H|$ sayısı $|G|$ sayısını tam böler ve $|G| = |H|\\cdot [G:H]$ eşitliği geçerlidir. Sonuç olarak her $a \\in G$ için $|a| \\mid |G|$ ve $a^{|G|} = e$ olur.',
    example: '**Önemli uyarı (Lagrange’ın tersi genel olarak yanlıştır!):** $|A_4| = 12$ ve $6 \\mid 12$ olmasına rağmen $A_4$ grubunun mertebesi $6$ olan **hiçbir alt grubu yoktur**. Alt gruplar sekmesinde $A_4$ kafesine bakarak bunu doğrudan doğrulayabilirsin.',
    apply: { label: 'A₄ kafesinde doğrula', spec: { kind: 'A', n: 4 }, tab: 'altgrup' },
  },
  {
    id: 'euler',
    title: 'Euler ve Fermat Teoremleri — U(n) Sonucu Olarak',
    tag: 'Sayılar Teorisi',
    body: [
      'Mod $n$’de $n$ ile aralarında asal kalan sınıfları çarpma altında $U(n) = (\\mathbb{Z}_n)^\\times$ grubunu oluşturur ve mertebesi Euler totient fonksiyonu $|U(n)| = \\varphi(n)$’dir.',
    ],
    theorem: '**Euler Teoremi:** $\\gcd(a, n) = 1$ ise Lagrange teoremi $U(n)$ üzerinde doğrudan $a^{\\varphi(n)} \\equiv 1 \\pmod n$ verir.\n**Fermat’nın Küçük Teoremi:** $n = p$ asal ise $\\varphi(p) = p - 1$ olduğundan $p \\nmid a \\implies a^{p-1} \\equiv 1 \\pmod p$.',
    example: '$U(10) = \\{1, 3, 7, 9\\}$ grubunun mertebesi $\\varphi(10) = 4$’tür. Gerçekten $3^4 = 81 \\equiv 1 \\pmod{10}$ ve $U(10) \\cong \\mathbb{Z}_4$ devirlidir; oysa $U(8) = \\{1, 3, 5, 7\\} \\cong V_4$ devirli değildir ($\\exp = 2$).',
    apply: { label: 'U(10) yapısını incele', spec: { kind: 'U', n: 10 }, tab: 'kesif' },
  },
  {
    id: 'devirli',
    title: 'Devirli Gruplar (Cyclic Groups)',
    tag: 'Yapı',
    body: [
      'Tek bir elemanın kuvvetleriyle üretilebilen $G = \\langle g \\rangle$ gruplarına **devirli grup** denir. Mertebesi $n$ olan her devirli grup $\\mathbb{Z}_n$ ile izomorftur.',
    ],
    theorem: '**Devirli Grupların Temel Teoremi:** $G = \\langle g \\rangle$ sonlu devirli ve $|G| = n$ olsun.\n1. $G$’nin her alt grubu devirlidir.\n2. $n$’yi bölen her $d \\mid n$ pozitif tam sayısı için mertebesi $d$ olan **bir ve yalnız bir** alt grup vardır: $\\langle g^{n/d} \\rangle$.\n3. $g^k$ elemanının mertebesi $n / \\gcd(n, k)$’dır; dolayısıyla tam $\\varphi(n)$ üreteç vardır.',
    example: '$\\mathbb{Z}_{12}$ grubunun $12$’nin bölenleri olan $1, 2, 3, 4, 6, 12$ mertebelerinde tam $6$ alt grubu ve $\\varphi(12) = 4$ üreteci ($1, 5, 7, 11$) vardır.',
    apply: { label: 'Z₁₂ Cayley grafiğini aç', spec: { kind: 'Z', n: 12 }, tab: 'graf' },
  },
  {
    id: 'permutasyon',
    title: 'Permütasyon Grupları ve Cayley Teoremi',
    tag: 'Simetri',
    body: [
      '$\\{1, \\dots, n\\}$ kümesinin tüm birebir-örten dönüşümleri bileşke altında $S_n$ simetrik grubunu ($|S_n| = n!$) oluşturur. Her permütasyon ayrık devirlerin çarpımı olarak (sıra hariç) tek biçimde yazılır.',
    ],
    theorem: '**İşaret ve $A_n$:** Her $k$-devir $k-1$ transpozisyonun çarpımıdır. Çift permütasyonlar $A_n \\trianglelefteq S_n$ alternatif grubunu ($|A_n| = n!/2$) oluşturur.\n**Cayley Teoremi:** Her sonlu $G$ grubu, kendi sol çarpım etkisi $L_g(x) = gx$ aracılığıyla $S_{|G|}$ simetrik grubunun bir alt grubuna izomorftur.',
    example: 'Sağdan sola bileşkede $(1\\,2)\\circ(2\\,3) = (1\\,2\\,3)$ çift permütasyondur ($\\operatorname{sgn} = +1$). $15$-bulmacanın çözülebilirliği doğrudan $S_{16}$ paritesine dayanır.',
    apply: { label: 'S₄ Permütasyon Atölyesi', spec: { kind: 'S', n: 4 }, tab: 'permutasyon' },
  },
  {
    id: 'koset',
    title: 'Kosetler ve Normal Alt Gruplar',
    tag: 'Temel',
    body: [
      '$H \\le G$ için $gH = \\{gh : h \\in H\\}$ kümelerine **sol koset**, $Hg = \\{hg : h \\in H\\}$ kümelerine **sağ koset** denir. Sol kosetler $G$’yi eşit boyutlu ($|H|$ elemanlı) ayrık parçalara ayırır.',
    ],
    theorem: '**Normal Alt Grup ($N \\trianglelefteq G$):** Aşağıdakiler denktir:\n1. $\\forall g \\in G,\\; gN = Ng$ (sol ve sağ kosetler çakışır).\n2. $\\forall g \\in G,\\; gNg^{-1} = N$ (eşlenik altında kapalıdır).\n3. $N$, bir grup homomorfizmasının çekirdeğidir.\n**Pratik kural:** İndeksi $[G:H] = 2$ olan her alt grup otomatik olarak normaldir.',
    example: '$S_3$ içinde $A_3 = \\langle (1\\,2\\,3) \\rangle$ indeksi $2$ olduğu için normaldir; ancak $H = \\{e, (1\\,2)\\}$ için $(1\\,3)H \\neq H(1\\,3)$ olduğundan normal değildir.',
    apply: { label: 'S₃ sol/sağ kosetlerini karşılaştır', spec: { kind: 'S', n: 3 }, tab: 'altgrup' },
  },
  {
    id: 'bolum',
    title: 'Bölüm Grupları (Quotient Groups)',
    tag: 'Yapı',
    body: [
      '$N \\trianglelefteq G$ normal alt grup olduğunda, kosetler kümesi $G/N = \\{gN : g \\in G\\}$ üzerinde $(aN)(bN) = (ab)N$ çarpımı **iyi tanımlı** (temsilciden bağımsız) olur ve mertebesi $|G/N| = |G|/|N|$ olan bir grup oluşturur.',
    ],
    theorem: '**Cayley Tablosunda Blok Yapısı:** $G$’nin Cayley tablosu $N$’nin kosetlerine göre sıralandığında, ancak ve ancak $N \\trianglelefteq G$ ise her $|N|\\times |N|$ blok tek bir kosete düşer ve blokların kendisi $G/N$’nin Cayley tablosunu verir.',
    example: '$D_4$’ün merkezi $Z(D_4) = \\{e, r^2\\}$ normaldir. Bölüm grubu $D_4 / Z(D_4)$ mertebesi $4$ olan ve her birim dışı elemanının mertebesi $2$ olan $V_4$ Klein dörtlü grubuna izomorftur!',
    apply: { label: 'D₄ koset bloklarını gör', spec: { kind: 'D', n: 4 }, tab: 'cayley' },
  },
  {
    id: 'homo',
    title: 'Homomorfizmalar ve İzomorfizma Teoremleri',
    tag: 'Morfizma',
    body: [
      '$\\varphi: G \\to H$ dönüşümü her $a,b \\in G$ için $\\varphi(ab) = \\varphi(a)\\varphi(b)$ sağlıyorsa **homomorfizma**dır. Çekirdek $\\ker(\\varphi) = \\{g \\in G : \\varphi(g) = e_H\\} \\trianglelefteq G$ daima normal, görüntü $\\operatorname{im}(\\varphi) \\le H$ alt gruptur.',
    ],
    theorem: '**Birinci İzomorfizma Teoremi:** Her $\\varphi: G \\to H$ homomorfizması için\n$$G / \\ker(\\varphi) \\cong \\operatorname{im}(\\varphi)$$\n**İkinci ve Üçüncü Teoremler:** $H \\le G, N \\trianglelefteq G \\implies HN/N \\cong H/(H\\cap N)$; ve $K \\le N \\trianglelefteq G, K \\trianglelefteq G \\implies (G/K)/(N/K) \\cong G/N$.',
    example: 'İşaret homomorfizması $\\operatorname{sgn}: S_4 \\to \\mathbb{Z}_2$ için $\\ker(\\operatorname{sgn}) = A_4$ ve $\\operatorname{im}(\\operatorname{sgn}) = \\mathbb{Z}_2$ olduğundan $S_4 / A_4 \\cong \\mathbb{Z}_2$ bulunur.',
    apply: { label: 'Homomorfizma Laboratuvarı', spec: { kind: 'S', n: 4 }, tab: 'homomorfizma' },
  },
  {
    id: 'sinif',
    title: 'Eşlenik Sınıflar ve Sınıf Denklemi',
    tag: 'Etkiler',
    body: [
      '$G$ kendisi üzerine eşlenik alma ($g \\cdot a = gag^{-1}$) ile etki eder. Yörüngeler **eşlenik sınıflar** $\\operatorname{Cl}(a)$, sabitleyici ise **merkezleyici** $C_G(a)$’dır. Yörünge-Sabitleyici Teoremi $|\\operatorname{Cl}(a)| = [G : C_G(a)]$ verir.',
    ],
    theorem: '**Sınıf Denklemi:** $Z(G)$ tek elemanlı sınıfların birleşimi ve $a_1, \\dots, a_k$ merkez dışındaki sınıfların temsilcileri olmak üzere\n$$|G| = |Z(G)| + \\sum_{i=1}^{k} [G : C_G(a_i)]$$\n**Sonuç:** Mertebesi $p^n$ ($p$ asal) olan her $p$-grubun merkezi aşikar değildir ($|Z(G)| > 1$).',
    example: '$S_4$’te iki permütasyon ancak ve ancak **devir tipleri aynıysa** eşleniktir. $4$’ün $5$ parçalanışı ($[1,1,1,1], [2,1,1], [2,2], [3,1], [4]$) tam olarak $24 = 1 + 6 + 3 + 8 + 6$ sınıf denklemini verir.',
    apply: { label: 'S₄ eşlenik kümelerini aç', spec: { kind: 'S', n: 4 }, tab: 'eslenik' },
  },
  {
    id: 'sylow',
    title: 'Cauchy ve Sylow Teoremleri',
    tag: 'İleri',
    body: [
      'Lagrange teoreminin tam tersi geçerli olmasa da, asal kuvvetler için varlık ve sayım garantisini Cauchy ve Sylow teoremleri verir.',
    ],
    theorem: '**Cauchy Teoremi:** $p$ asal ve $p \\mid |G|$ ise $G$ içinde mertebesi $p$ olan en az bir eleman vardır.\n**Sylow Teoremleri:** $|G| = p^k m$ ($p \\nmid m$) olsun:\n1. Mertebesi $p^k$ olan **Sylow $p$-alt grubu** mutlaka vardır.\n2. Tüm Sylow $p$-alt grupları birbirine eşleniktir.\n3. Sylow $p$-alt gruplarının sayısı $n_p$ için $n_p \\equiv 1 \\pmod p$ ve $n_p \\mid m$ sağlanır. Özellikle $n_p = 1 \\iff$ tek Sylow $p$-alt grubu normaldir!',
    example: '**Çözümlü Örnek 1 (Cauchy):** $|D_5| = 10 = 2 \\cdot 5$; $2$ ve $5$ asal bölen olduğundan $D_5$ mutlaka $2$ mertebeli (yansımalar $sr^k$) ve $5$ mertebeli (dönmeler $r, r^2, r^3, r^4$) elemanlar içerir.\n**Çözümlü Örnek 2 (Sylow):** $|G| = 15 = 3 \\cdot 5$ olsun. $n_3 \\equiv 1 \\pmod 3$ ve $n_3 \\mid 5 \\implies n_3 = 1$; $n_5 \\equiv 1 \\pmod 5$ ve $n_5 \\mid 3 \\implies n_5 = 1$. Hem $P_3$ hem $P_5$ normaldir, $P_3 \\cap P_5 = \\{e\\}$, dolayısıyla $G \\cong \\mathbb{Z}_3 \\times \\mathbb{Z}_5 \\cong \\mathbb{Z}_{15}$ zorunlu olarak devirlidir!\n**Çözümlü Örnek 3 ($A_5$):** $|A_5| = 60 = 2^2 \\cdot 3 \\cdot 5$ için motor $n_2 = 5$ ($5 \\equiv 1\\;(\\text{mod }2),\\; 5\\mid 15$), $n_3 = 10$ ($10 \\equiv 1\\;(\\text{mod }3),\\; 10\\mid 20$) ve $n_5 = 6$ ($6 \\equiv 1\\;(\\text{mod }5),\\; 6\\mid 12$) bulur; hiçbiri $1$ değildir ve $A_5$ **basittir**!',
    apply: { label: 'A₅ alt gruplarını ve basitliğini gör', spec: { kind: 'A', n: 5 }, tab: 'altgrup' },
  },
  {
    id: 'abelyen',
    title: 'Direkt Çarpımlar ve Sonlu Abelyen Grupların Sınıflandırılması',
    tag: 'Sınıflandırma',
    body: [
      '$G \\times H$ direkt çarpımında işlem bileşen bazındadır: $(g_1, h_1)(g_2, h_2) = (g_1g_2, h_1h_2)$ ve $|(g, h)| = \\operatorname{ekok}(|g|, |h|)$.',
    ],
    theorem: '**Çarpımın Devirliliği:** $\\mathbb{Z}_m \\times \\mathbb{Z}_n \\cong \\mathbb{Z}_{mn} \\iff \\gcd(m, n) = 1$.\n**Sonlu Abelyen Grupların Temel Teoremi:** Her sonlu Abelyen grup, asal kuvvet mertebeli devirli grupların direkt çarpımına (sıra hariç) tek biçimde izomorftur:\n$$G \\cong \\mathbb{Z}_{p_1^{a_1}} \\times \\mathbb{Z}_{p_2^{a_2}} \\times \\cdots \\times \\mathbb{Z}_{p_r^{a_r}}$$',
    example: 'Örneğin $\\gcd(2, 3) = 1$ olduğundan $\\mathbb{Z}_2 \\times \\mathbb{Z}_3 \\cong \\mathbb{Z}_6$ devirlidir; ancak $\\gcd(2, 2) = 2 \\neq 1$ olduğundan $\\mathbb{Z}_2 \\times \\mathbb{Z}_2 \\cong V_4 \\not\\cong \\mathbb{Z}_4$. Mertebesi $8$ olan tam $3$ Abelyen grup vardır: $\\mathbb{Z}_8$, $\\mathbb{Z}_4 \\times \\mathbb{Z}_2$ ve $\\mathbb{Z}_2 \\times \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.',
    apply: { label: 'Z₂ × Z₃ ≅ Z₆ incele', spec: { kind: 'Prod', left: { kind: 'Z', n: 2 }, right: { kind: 'Z', n: 3 } }, tab: 'kesif' },
  },
];

function mountLessons(host, G, ctx) {
  host.innerHTML = `<div class="grp-stage">
    <div class="grp-panel">
      <div class="grp-panel-head">
        <h3 class="grp-panel-title">Üniversite Soyut Cebir Özeti (12 Konu)</h3>
        <div class="grp-toolbar-g">
          <button type="button" class="btn small ghost" data-all-open>Tümünü aç</button>
          <button type="button" class="btn small ghost" data-all-close>Tümünü kapat</button>
        </div>
      </div>
      <div class="grp-toc">
        ${LESSONS.map((l, i) => `<button type="button" class="grp-chip" data-jump-l="${i}">${i + 1}. ${esc(l.title.split(' ')[0])}</button>`).join('')}
      </div>
    </div>

    ${LESSONS.map((l, i) => `<details class="grp-lesson" data-lidx="${i}" ${i < 2 ? 'open' : ''}>
      <summary>
        <span class="row" style="gap:10px"><span class="grp-lesson-num">${i + 1}</span><span>${esc(l.title)}</span></span>
        <span class="grp-pill">${esc(l.tag)}</span>
      </summary>
      <div class="grp-lesson-body">
        ${l.body.map(p => `<p>${richTex(p)}</p>`).join('')}
        <div class="grp-theorem-box">${l.theorem.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>
        <div class="grp-example-box">${l.example.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>
        <div class="grp-lesson-foot">
          <span class="mute small">Etkileşimli simülasyonda canlı olarak dene</span>
          <button type="button" class="btn small primary" data-apply-l="${i}">${icon('play')} Uygula: ${esc(l.apply.label)} →</button>
        </div>
      </div>
    </details>`).join('')}
  </div>`;

  host.querySelector('[data-all-open]').onclick = () => host.querySelectorAll('.grp-lesson').forEach(d => { d.open = true; });
  host.querySelector('[data-all-close]').onclick = () => host.querySelectorAll('.grp-lesson').forEach(d => { d.open = false; });

  host.querySelectorAll('[data-jump-l]').forEach(b => {
    b.onclick = () => {
      const det = host.querySelector(`.grp-lesson[data-lidx="${b.dataset.jumpL}"]`);
      if (!det) return;
      det.open = true;
      det.scrollIntoView({ behavior: full() ? 'smooth' : 'auto', block: 'start' });
    };
  });

  host.querySelectorAll('[data-apply-l]').forEach(b => {
    b.onclick = () => {
      const l = LESSONS[+b.dataset.applyL];
      ctx.jumpTo(l.apply.tab, l.apply.spec);
    };
  });
}

// =====================================================================
// TAB 10: ALIŞTIRMA & QUİZ (Endless engine-computed exercise generator)
// =====================================================================
const QUIZ_TOPICS = [
  ['', 'Karışık (tüm 11 konu)'],
  ['order', 'Eleman mertebesi'],
  ['subgroup', 'Alt grup testi'],
  ['normal', 'Normal alt grup'],
  ['subgroupCount', 'Alt grup sayısı'],
  ['classEquation', 'Sınıf denklemi'],
  ['permSign', 'Permütasyon işareti'],
  ['permCompose', 'Permütasyon bileşkesi'],
  ['cyclic', 'Devirli grup testi'],
  ['center', 'Grubun merkezi'],
  ['homomorphism', 'Homomorfizma kontrolü'],
  ['lagrange', 'Lagrange teoremi'],
];

function loadQuizStats() {
  try {
    const raw = localStorage.getItem(QUIZ_STORE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        correct: +o.correct || 0,
        total: +o.total || 0,
        streak: +o.streak || 0,
        bestStreak: +o.bestStreak || 0,
        difficulty: ['kolay', 'orta', 'zor'].includes(o.difficulty) ? o.difficulty : 'orta',
      };
    }
  } catch { }
  return { correct: 0, total: 0, streak: 0, bestStreak: 0, difficulty: 'orta' };
}

function saveQuizStats(st) {
  try { localStorage.setItem(QUIZ_STORE_KEY, JSON.stringify(st)); } catch { }
}

function mountQuiz(host, G, ctx) {
  const stats = loadQuizStats();
  let topicFilter = '';
  let currentQ = null;
  let pickedIdx = null;

  const nextQuestion = () => {
    pickedIdx = null;
    currentQ = generateQuizQuestion(stats.difficulty, Math.random, topicFilter || null);
    render();
  };

  const render = () => {
    const accPct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    const keys = ['A', 'B', 'C', 'D'];

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-toolbar">
        <div class="grp-toolbar-g">
          <div class="seg" data-diff role="tablist" aria-label="Zorluk seviyesi">
            ${[['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']].map(([k, l]) => `<button type="button" data-df="${k}" class="${stats.difficulty === k ? 'on' : ''}">${l}</button>`).join('')}
          </div>
          <select class="inp grp-sel" data-qtopic aria-label="Soru konusu">
            ${QUIZ_TOPICS.map(([k, l]) => `<option value="${k}" ${k === topicFilter ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <button type="button" class="btn small ghost" data-qreset aria-label="İstatistikleri sıfırla">Skoru sıfırla</button>
      </div>

      <div class="grp-kpis">
        <div class="grp-kpi acc"><span class="grp-kpi-lbl">Doğru / Toplam</span><span class="grp-kpi-val mono">${stats.correct} / ${stats.total}</span><span class="grp-kpi-sub">%${accPct} başarı</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Mevcut Seri</span><span class="grp-kpi-val mono">${stats.streak}</span><span class="grp-kpi-sub">üst üste doğru</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">En İyi Seri</span><span class="grp-kpi-val mono">${stats.bestStreak}</span><span class="grp-kpi-sub">rekorun</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Soru Konusu</span><span class="grp-kpi-val">${esc(currentQ.topic)}</span><span class="grp-kpi-sub">${esc(stats.difficulty.toUpperCase())}</span></div>
      </div>

      <div class="grp-quiz-card">
        <div class="grp-quiz-prompt">${richTex(currentQ.prompt)}</div>
        <div class="grp-quiz-opts">
          ${currentQ.options.map((opt, idx) => {
            const cls = ['grp-qopt'];
            let mark = '';
            if (pickedIdx !== null) {
              if (idx === currentQ.answerIndex) { cls.push('correct'); mark = ' ✓'; }
              else if (idx === pickedIdx) { cls.push('wrong'); mark = ' ✗'; }
            }
            return `<button type="button" class="${cls.join(' ')}" data-qi="${idx}" ${pickedIdx !== null ? 'disabled' : ''} aria-label="Seçenek ${keys[idx]}">
              <span class="grp-qopt-k">${keys[idx]}</span>
              <span class="grow">${richTex(opt)}${mark}</span>
            </button>`;
          }).join('')}
        </div>

        ${pickedIdx !== null ? `<div class="grp-callout ${pickedIdx === currentQ.answerIndex ? 'ok' : 'bad'}" style="display:grid;gap:8px" aria-live="polite">
          <b>${pickedIdx === currentQ.answerIndex ? '✓ Doğru!' : '✗ Yanlış cevap'}</b>
          <div>${richTex(currentQ.explanation)}</div>
        </div>
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn primary" data-qnext>Sonraki soru →</button>
        </div>` : `<div class="small mute">Kısayol: klavyede <b>1–${currentQ.options.length}</b> tuşlarıyla yanıtlayabilir, ardından <b>Enter</b> ile sonraki soruya geçebilirsin.</div>`}
      </div>
    </div>`;

    host.querySelector('[data-diff]').onclick = e => {
      const b = e.target.closest('[data-df]'); if (!b) return;
      stats.difficulty = b.dataset.df;
      saveQuizStats(stats);
      nextQuestion();
    };
    host.querySelector('[data-qtopic]').onchange = e => {
      topicFilter = e.target.value;
      nextQuestion();
    };
    host.querySelector('[data-qreset]').onclick = () => {
      stats.correct = 0; stats.total = 0; stats.streak = 0; stats.bestStreak = 0;
      saveQuizStats(stats);
      render();
      toast('Quiz istatistikleri sıfırlandı');
    };
    host.querySelectorAll('[data-qi]').forEach(btn => {
      btn.onclick = () => answer(+btn.dataset.qi, btn);
    });
    host.querySelector('[data-qnext]')?.addEventListener('click', nextQuestion);
    syncSegments(host, true);
  };

  const answer = (idx, btnEl = null) => {
    if (pickedIdx !== null || idx < 0 || idx >= currentQ.options.length) return;
    pickedIdx = idx;
    stats.total++;
    const right = idx === currentQ.answerIndex;
    if (right) {
      stats.correct++;
      stats.streak++;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
      if (stats.streak > 0 && stats.streak % 5 === 0 && full()) {
        const r = btnEl?.getBoundingClientRect?.();
        constellationBurst(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2);
        toast(`${stats.streak} doğru seri! Harika gidiyorsun ✦`);
      }
    } else {
      stats.streak = 0;
    }
    saveQuizStats(stats);
    render();
  };

  const onKey = e => {
    if (!host.isConnected || e.target.closest?.('input, select, textarea')) return;
    if (pickedIdx === null && /^[1-4]$/.test(e.key)) {
      const i = +e.key - 1;
      if (i < currentQ.options.length) answer(i);
    } else if (pickedIdx !== null && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      nextQuestion();
    }
  };
  window.addEventListener('keydown', onKey);
  ctx.clean.add(() => window.removeEventListener('keydown', onKey));

  nextQuestion();
}

// =====================================================================
// MAIN MOUNT ENTRYPOINT
// =====================================================================
const TAB_MOUNTS = {
  kesif: mountOverview,
  cayley: mountCayley,
  simetri: mountSymmetry,
  permutasyon: mountPermutations,
  graf: mountCayleyGraph,
  altgrup: mountSubgroups,
  eslenik: mountConjugacy,
  homomorfizma: mountHomomorphism,
  teoremler: mountLessons,
  quiz: mountQuiz,
};

export function mountGroupCenter(el, tabId) {
  const activeTab = TAB_MOUNTS[tabId] ? tabId : 'kesif';
  let curSpec = loadSavedSpec();
  let tabClean = createCleanup();

  el.innerHTML = `<div class="grp-wrap">
    <div data-picker-host></div>
    <div data-tab-host></div>
  </div>`;

  const pickerHost = el.querySelector('[data-picker-host]');
  const tabHost = el.querySelector('[data-tab-host]');

  const ctx = {
    clean: tabClean,
    setGroup(nextSpec) {
      try {
        getGroupFromSpec(nextSpec); // validate first
        curSpec = nextSpec;
        saveSpec(curSpec);
        renderCurrent();
      } catch (err) {
        toast(err.message || 'Grup oluşturulamadı');
      }
    },
    jumpTo(nextTab, nextSpec) {
      if (nextSpec) {
        try {
          getGroupFromSpec(nextSpec);
          curSpec = nextSpec;
          saveSpec(curSpec);
        } catch { }
      }
      const targetHash = `#/grup/${nextTab}`;
      if (location.hash === targetHash) renderCurrent();
      else location.hash = targetHash;
    },
  };

  function renderCurrent() {
    tabClean.run();
    tabClean = createCleanup();
    ctx.clean = tabClean;

    let G;
    try {
      G = getGroupFromSpec(curSpec);
    } catch {
      curSpec = { kind: 'D', n: 4 };
      saveSpec(curSpec);
      G = getGroupFromSpec(curSpec);
    }

    renderPicker(pickerHost, curSpec, G, nextSpec => ctx.setGroup(nextSpec));
    tabHost.innerHTML = '';
    TAB_MOUNTS[activeTab](tabHost, G, ctx);
    syncSegments(el, true);
  }

  renderCurrent();

  return () => {
    tabClean.run();
  };
}
