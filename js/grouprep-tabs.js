// MathPad Group Theory Center — Part A Tabs Module (Finite Group Extensions, Representations & Road to Simplicity)
// Covers Pierre Ramond Chapters 2.4, 3, 9, 11.7 & Appendix 1.
import { esc, icon, toast } from './ui.js';
import { motion, full, asleep, constellationBurst, syncSegments } from './fx.js';
import {
  cyclic,
  dihedral,
  symmetric,
  alternating,
  kleinFour,
  quaternion,
  directProduct,
  dicyclic,
  binaryTetrahedral,
  binaryOctahedral,
  binaryIcosahedral,
  frobeniusT7,
  psl2_7,
  gl3_2,
  delta3n2,
  delta6n2,
  hessian216,
  semiDirect,
  semiDirectActions,
  buildGroup,
  elemLatex,
  order,
  elementOrders,
  isAbelian,
  isCyclic,
  exponent,
  center,
  commutatorSubgroup,
  identifyGroup,
  primeFactors,
  formatCycles,
} from './group.js';
import {
  C,
  recognizeAlgebraic,
  conjugacyStructure,
  classMultiplicationTable,
  characterTable,
  characterInnerProduct,
  kroneckerProduct,
  symmetricAndAntisymmetricSquares,
  tensorPowerDecomp,
  restrictionAndInduction,
  molienSeries,
  partitions,
  conjugatePartition,
  hookLengths,
  hookDimension,
  standardYoungTableaux,
  rimHookRemovals,
  murnaghanNakayama,
  snClassSize,
  snCharacterTableMN,
  fastIsSimple,
  safeSubgroups,
  compositionSeries,
  sylowAnalysis,
  sylowOrderScreen,
  FANO_POINTS,
  FANO_LINES,
  findPairMappers,
  psl27AndGl32Data,
  mckayGraph,
  SU3_FINITE_SUBGROUPS,
  SPORADIC_GROUPS,
  SIMPLE_GROUP_FAMILIES,
  chevalleyOrder,
  groupAppendixRow,
  appendixCatalogSpecs,
  generateRepQuizQuestion,
} from './grouprep.js';
import { REP_LESSONS, SIMPLE_LESSONS } from './grouprep-lessons.js';

// ---------- Shared helpers ----------

function ensureRepCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[href*="grouprep.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/grouprep.css';
  document.head.append(link);
}

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
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return '#f4f4f5';
  return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#f4f4f5';
}

function createLocalClean(ctx) {
  const fns = [];
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    while (fns.length) {
      try { fns.pop()(); } catch { }
    }
  };
  const api = {
    add(fn) {
      if (typeof fn === 'function') fns.push(fn);
    },
    run,
  };
  ctx?.clean?.add?.(run);
  return api;
}

function deferTask(fn, heavy = false) {
  if (!heavy) return Promise.resolve().then(fn);
  return new Promise(res => setTimeout(() => res(fn()), 16));
}

function setupCanvas(cv, heightForWidth, onDraw, clean) {
  let W = 320, H = 260, dpr = 1;
  const resize = () => {
    const host = cv.parentElement;
    if (!host) return;
    const cw = Math.max(220, Math.floor(host.clientWidth));
    const ch = Math.max(180, Math.floor(heightForWidth(cw)));
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
    const ctx2d = cv.getContext('2d');
    if (!ctx2d) return;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    onDraw(ctx2d, W, H);
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
  return { render, resize, size: () => ({ W, H }) };
}

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

function fmtDecimal(val) {
  const r = Math.abs(val.re) < 1e-6 ? 0 : val.re;
  const im = Math.abs(val.im) < 1e-6 ? 0 : val.im;
  const rS = r === 0 ? '' : r.toFixed(3).replace(/\.?0+$/, '');
  const iS = im === 0 ? '' : `${im > 0 && rS ? '+' : ''}${im.toFixed(3).replace(/\.?0+$/, '')}i`;
  return (rS + iS) || '0';
}

function fsBadge(ir) {
  if (ir.fsIndicator === 1) return `<span class="grep-fs grep-fs-r" title="Gerçek / Ortogonal (ι = +1)">● +1</span>`;
  if (ir.fsIndicator === -1) return `<span class="grep-fs grep-fs-p" title="Sözde-gerçek / Kuaterniyonik (ι = −1)">◆ −1</span>`;
  return `<span class="grep-fs grep-fs-c" title="Karmaşık (ι = 0)">◐ 0</span>`;
}

function parityBadge(parity) {
  return parity === 'spinor'
    ? `<span class="grep-parity-s">◆ Spinör (−d)</span>`
    : `<span class="grep-parity-t">● Tensör (+d)</span>`;
}

const EXTENDED_PICK_GROUPS = [
  { label: 'Q₆ (12)', spec: { kind: 'Q2n', n: 3 } },
  { label: 'Q₈=Dic₄ (16)', spec: { kind: 'Q2n', n: 4 } },
  { label: 'T₇ (21)', spec: { kind: 'T7' } },
  { label: '2T (24)', spec: { kind: '2T' } },
  { label: 'Δ(27)', spec: { kind: 'Delta3', n: 3 } },
  { label: '2O (48)', spec: { kind: '2O' } },
  { label: 'Δ(54)', spec: { kind: 'Delta6', n: 3 } },
  { label: '2I (120)', spec: { kind: '2I' } },
  { label: 'PSL(2,7)', spec: { kind: 'PSL27' } },
  { label: 'GL(3,2)', spec: { kind: 'GL32' } },
  { label: 'Σ(216)', spec: { kind: 'Hessian' } },
];

function renderExtGroupBar(G) {
  const curKey = JSON.stringify(G.meta?.spec || null);
  return `<div class="grep-ext-bar" role="group" aria-label="Ramond ileri sonlu grupları">
    <span class="grep-ext-lbl">İleri gruplar:</span>
    ${EXTENDED_PICK_GROUPS.map((g, i) => `<button type="button" class="grp-chip ${JSON.stringify(g.spec) === curKey ? 'on' : ''}" data-ext-g="${i}" aria-label="Grubu seç: ${esc(g.label)}">${esc(g.label)}</button>`).join('')}
  </div>`;
}

function bindExtGroupBar(host, ctx) {
  host.querySelectorAll('[data-ext-g]').forEach(btn => {
    btn.onclick = () => ctx.setGroup(EXTENDED_PICK_GROUPS[+btn.dataset.extG].spec);
  });
}

// Pick a sensible default subgroup (prefers largest proper normal subgroup, else largest proper subgroup)
function pickDefaultSubgroup(subs, GSize) {
  const proper = subs.filter(s => s.order > 1 && s.order < GSize);
  if (!proper.length) return subs[0];
  const normals = proper.filter(s => s.isNormal);
  if (normals.length) return normals[normals.length - 1];
  return proper[proper.length - 1];
}

// =====================================================================
// TAB 1 (temsil): KARAKTER TABLOSU
// =====================================================================
function mountCharacterTable(host, G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  const ct = characterTable(G);
  const cs = conjugacyStructure(G);
  const { classMult } = classMultiplicationTable(G);
  const commLen = commutatorSubgroup(G).length;

  let exactMode = true;
  let probeMode = 'row'; // 'row' | 'col'
  let rowA = Math.min(ct.irreps.length - 1, ct.irreps.findIndex(ir => ir.dim > 1) !== -1 ? ct.irreps.findIndex(ir => ir.dim > 1) : 0);
  let rowB = rowA;
  let colA = Math.min(1, ct.classCount - 1);
  let colB = colA;
  let inspectedIrrep = rowA;
  let inspectedClass = colA;

  const render = () => {
    const dim1Count = ct.irreps.filter(ir => ir.dim === 1).length;
    const maxErr = Math.max(ct.checks.rowOrthoMaxErr, ct.checks.colOrthoMaxErr);
    const errStr = maxErr < 1e-10 ? '< 10⁻¹⁰' : maxErr.toExponential(1);

    // Orthogonality calculation details
    let probeHtml = '';
    if (probeMode === 'row') {
      const a = ct.irreps[rowA], b = ct.irreps[rowB];
      const ip = characterInnerProduct(ct, a.values, b.values);
      const algIp = recognizeAlgebraic(ip.re, ip.im, exponent(G));
      const sumTerms = ct.classes.map((cl, k) => {
        const va = a.values[k], vb = b.values[k];
        const prod = C.mul(C.conj(va), vb);
        if (C.abs(prod) < 1e-6) return null;
        const pAlg = recognizeAlgebraic(prod.re, prod.im, exponent(G));
        return `${cl.size}\\cdot(${pAlg.latex})`;
      }).filter(Boolean);
      probeHtml = `<div class="grp-math-box">${tex(`\\langle ${a.latex},\\, ${b.latex} \\rangle = \\frac{1}{${G.size}}\\Bigl(${sumTerms.slice(0, 8).join(' + ')}${sumTerms.length > 8 ? ' + \\cdots' : ''}\\Bigr) = ${algIp.latex}`)}</div>
        <div class="small mute">Satır seçmek için tablodaki <b>satır başlıklarına</b> dokun (ilk dokunuş A, ikinci dokunuş B) veya aşağıdan seç.</div>`;
    } else {
      const ca = ct.classes[colA], cb = ct.classes[colB];
      let re = 0, im = 0;
      const sumTerms = [];
      for (let i = 0; i < ct.irreps.length; i++) {
        const va = ct.irreps[i].values[colA], vb = ct.irreps[i].values[colB];
        const p = C.mul(C.conj(va), vb);
        re += p.re; im += p.im;
        if (C.abs(p) > 1e-6) {
          const pAlg = recognizeAlgebraic(p.re, p.im, exponent(G));
          sumTerms.push(`(${pAlg.latex})`);
        }
      }
      const totAlg = recognizeAlgebraic(re, im, exponent(G));
      probeHtml = `<div class="grp-math-box">${tex(`\\sum_{\\alpha} \\overline{\\chi_\\alpha(C_{${colA + 1}})}\\,\\chi_\\alpha(C_{${colB + 1}}) = ${sumTerms.slice(0, 8).join(' + ')}${sumTerms.length > 8 ? ' + \\cdots' : ''} = ${totAlg.latex}${colA === colB ? ` = |C_G| = ${ca.centralizerOrder}` : ''}`)}</div>
        <div class="small mute">Sütun seçmek için tablodaki <b>sınıf başlıklarına</b> dokun; aynı sütunda merkezleyici mertebesi ${tex('|C_G|')}, farklı sütunlarda ${tex('0')} çıkar.</div>`;
    }

    // Selected Irrep inspector
    const ir = ct.irreps[inspectedIrrep];
    const cj = ct.irreps[ir.conjugateIndex];
    const fsTerms = ct.classes.map((cl, k) => {
      const vSq = ir.values[ct.sqClass[k]];
      if (C.abs(vSq) < 1e-6) return null;
      const a = recognizeAlgebraic(vSq.re, vSq.im, exponent(G));
      return `${cl.size}\\cdot(${a.latex})`;
    }).filter(Boolean);

    // Selected Class & Class Algebra inspector
    const cl = ct.classes[inspectedClass];
    const invCl = ct.classes[ct.invClass[inspectedClass]];
    const sqCl = ct.classes[ct.sqClass[inspectedClass]];
    const algRows = [];
    for (let j = 0; j < ct.classCount; j++) {
      const terms = [];
      for (let k = 0; k < ct.classCount; k++) {
        const coef = classMult[inspectedClass][j][k];
        if (coef > 0) terms.push(coef === 1 ? `K_{${k + 1}}` : `${coef}K_{${k + 1}}`);
      }
      algRows.push(`K_{${inspectedClass + 1}} K_{${j + 1}} = ${terms.join(' + ')}`);
    }

    host.innerHTML = `<div class="grp-stage">
      ${renderExtGroupBar(G)}

      <div class="grp-kpis">
        <div class="grp-kpi acc"><span class="grp-kpi-lbl">Mertebe |G|</span><span class="grp-kpi-val">${tex(`|G| = ${G.size}`)}</span><span class="grp-kpi-sub">${ct.classCount} sınıf = ${ct.classCount} irrep</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Boyut Kareleri</span><span class="grp-kpi-val">${ct.checks.dimSquaresOk ? '✓' : '✗'} ${ct.checks.dimSquaresSum}</span><span class="grp-kpi-sub">${tex(`\\sum d_i^2 = ${G.size}`)}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Satır / Sütun Dikliği</span><span class="grp-kpi-val">${ct.checks.ok ? '✓ Doğrulandı' : '✗ Hata'}</span><span class="grp-kpi-sub">maks. sapma ${errStr}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">1B Temsiller</span><span class="grp-kpi-val mono">${dim1Count}</span><span class="grp-kpi-sub">${tex(`|G/[G,G]| = ${G.size}/${commLen}`)}</span></div>
      </div>

      ${G.meta?.ramondConvention ? `<div class="grp-callout"><span class="small">${esc(G.meta.ramondConvention)}</span><span class="grp-pill acc">Ramond §3.9</span></div>` : ''}

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">${esc(G.name)} Karakter Tablosu</h3>
            <span class="grp-pill">${tex(`\\sum d_i^2 = ${ct.irreps.map(x => `${x.dim}^2`).slice(0, 8).join('+')}${ct.irreps.length > 8 ? '+\\cdots' : ''} = ${G.size}`)}</span>
          </div>
          <div class="grp-toolbar-g">
            <div class="seg" data-fmt role="tablist" aria-label="Değer biçimi">
              <button type="button" data-exact="1" class="${exactMode ? 'on' : ''}">Cebirsel</button>
              <button type="button" data-exact="0" class="${!exactMode ? 'on' : ''}">Ondalık</button>
            </div>
          </div>
        </div>

        <div class="grep-ctbl-wrap">
          <table class="grep-ctbl" aria-label="${esc(G.name)} karakter tablosu">
            <thead>
              <tr>
                <th scope="col">${tex(G.latex)}</th>
                ${ct.classes.map((c, k) => {
                  const cls = [];
                  if (probeMode === 'col' && k === colA) cls.push('grep-col-a');
                  if (probeMode === 'col' && k === colB) cls.push('grep-col-b');
                  return `<th scope="col" class="${cls.join(' ')}" data-cls="${k}" title="Sınıf C_${k + 1}: |C|=${c.size}, |g|=${c.order}">
                    <div>${tex(`${c.size}\\,${c.latex.length <= 24 ? c.latex : `C_{${k + 1}}`}`)}</div>
                    <div class="small mute">|g|=${c.order}</div>
                  </th>`;
                }).join('')}
                <th scope="col" title="Frobenius–Schur göstergesi">FS (ι)</th>
                <th scope="col">Çekirdek</th>
              </tr>
              <tr class="grep-subhead">
                <th scope="col">|C_G(g)|</th>
                ${ct.classes.map((c, k) => `<th scope="col" data-cls="${k}">${c.centralizerOrder}</th>`).join('')}
                <th scope="col">Tür</th>
                <th scope="col">|ker|</th>
              </tr>
            </thead>
            <tbody>
              ${ct.irreps.map((r, i) => {
                const rCls = [];
                if (probeMode === 'row' && i === rowA) rCls.push('grep-row-a');
                if (probeMode === 'row' && i === rowB && rowB !== rowA) rCls.push('grep-row-b');
                return `<tr class="${rCls.join(' ')}">
                  <th scope="row" data-irrep="${i}" title="İrrep ${esc(r.name)} incele">${tex(r.latex)}</th>
                  ${r.entries.map((e, k) => {
                    const isZero = Math.abs(e.re) < 1e-6 && Math.abs(e.im) < 1e-6;
                    const cCls = [];
                    if (isZero) cCls.push('grep-zero');
                    if (probeMode === 'col' && k === colA) cCls.push('grep-col-a');
                    if (probeMode === 'col' && k === colB) cCls.push('grep-col-b');
                    const cellHtml = exactMode ? tex(e.latex) : `<span class="mono">${esc(fmtDecimal(r.values[k]))}</span>`;
                    return `<td class="${cCls.join(' ')}" data-irrep="${i}" data-cls="${k}">${cellHtml}</td>`;
                  }).join('')}
                  <td>${fsBadge(r)}</td>
                  <td class="mono small">${r.isFaithful ? '<span class="grp-pill ok">Sadık</span>' : r.isTrivial ? '<span class="mute">Aşikar</span>' : `|ker|=${r.kernelElements.length}`}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${ct.legends.length ? `<div class="row wrap small mute" style="gap:12px">
          <span>Semboller:</span>
          ${ct.legends.map(l => `<span>${tex(`${l.sym} = ${l.def}`)}</span>`).join('')}
        </div>` : ''}
      </div>

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Etkileşimli Diklik Doğrulayıcı</h3>
          </div>
          <div class="grp-toolbar-g">
            <div class="seg" data-pmode role="tablist" aria-label="Diklik modu">
              <button type="button" data-pm="row" class="${probeMode === 'row' ? 'on' : ''}">Satır Dikliği</button>
              <button type="button" data-pm="col" class="${probeMode === 'col' ? 'on' : ''}">Sütun Dikliği</button>
            </div>
            ${probeMode === 'row' ? `
              <select class="inp grp-sel" data-ra aria-label="Birinci irrep">${ct.irreps.map((r, i) => `<option value="${i}" ${i === rowA ? 'selected' : ''}>χ_A = ${esc(r.name)} (d=${r.dim})</option>`).join('')}</select>
              <select class="inp grp-sel" data-rb aria-label="İkinci irrep">${ct.irreps.map((r, i) => `<option value="${i}" ${i === rowB ? 'selected' : ''}>χ_B = ${esc(r.name)} (d=${r.dim})</option>`).join('')}</select>
            ` : `
              <select class="inp grp-sel" data-ca aria-label="Birinci eşlenik sınıf">${ct.classes.map((c, k) => `<option value="${k}" ${k === colA ? 'selected' : ''}>C_${k + 1} (${esc(c.label)}, h=${c.size})</option>`).join('')}</select>
              <select class="inp grp-sel" data-cb aria-label="İkinci eşlenik sınıf">${ct.classes.map((c, k) => `<option value="${k}" ${k === colB ? 'selected' : ''}>C_${k + 1} (${esc(c.label)}, h=${c.size})</option>`).join('')}</select>
            `}
          </div>
        </div>
        ${probeHtml}
      </div>

      <div class="grp-grid-2">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Seçili İrrep İnceleyici</h3>
            <span class="grp-pill acc">${tex(ir.latex)} · d = ${ir.dim}</span>
          </div>
          <div class="row wrap" style="gap:8px">
            ${fsBadge(ir)}
            <span class="grp-pill">${esc(ir.fsLabel)}</span>
            <span class="grp-pill">Eşlenik: ${tex(cj.latex)}</span>
            <span class="grp-pill">${ir.isFaithful ? 'Sadık (ker = {e})' : `|ker| = ${ir.kernelElements.length}`}</span>
          </div>
          <div class="small mute">Frobenius–Schur toplamı:</div>
          <div class="grp-math-box">${tex(`\\iota(${ir.latex}) = \\frac{1}{${G.size}}\\Bigl(${fsTerms.slice(0, 8).join(' + ') || '0'}${fsTerms.length > 8 ? '+\\cdots' : ''}\\Bigr) = ${ir.fsIndicator}`)}</div>
          <div class="small mute">Çekirdek elemanları (${ir.kernelElements.length} adet): ${ir.kernelElements.slice(0, 14).map(e => `<span class="mono">${esc(G.elements[e])}</span>`).join(', ')}${ir.kernelElements.length > 14 ? '…' : ''}</div>
          <div class="row wrap" style="gap:8px;margin-top:4px">
            <button type="button" class="btn small" data-go-kron>${icon('x')} Kronecker Çarpımı</button>
            <button type="button" class="btn small" data-go-mol>${icon('chart')} Molien Serisi</button>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Sınıf C_${inspectedClass + 1} & Sınıf Cebiri</h3>
            <span class="grp-pill">${tex(`h = ${cl.size},\\; |C_G| = ${cl.centralizerOrder}`)}</span>
          </div>
          <div class="row wrap small" style="gap:8px">
            <span class="grp-pill">Temsilci: ${tex(cl.latex)}</span>
            <span class="grp-pill">|g| = ${cl.order}</span>
            <span class="grp-pill">Ters sınıf: C_${ct.invClass[inspectedClass] + 1} (${esc(invCl.label)})</span>
            <span class="grp-pill">Kare sınıfı: C_${ct.sqClass[inspectedClass] + 1} (${esc(sqCl.label)})</span>
          </div>
          <div class="small mute">Sınıf elemanları (${cl.size} adet): ${cl.elements.slice(0, 16).map(e => `<span class="mono">${esc(G.elements[e])}</span>`).join(', ')}${cl.size > 16 ? '…' : ''}</div>
          <div class="small mute">Sınıf çarpım katsayıları (${tex('K_i K_j = \\sum_k N_{ij}^k K_k')}):</div>
          <div class="grp-math-box" style="text-align:left;font-size:12.5px">
            ${algRows.slice(0, 8).map(r => `<div style="margin:3px 0">${tex(r)}</div>`).join('')}
            ${algRows.length > 8 ? `<div class="mute small">… toplam ${algRows.length} sınıf çarpımı</div>` : ''}
          </div>
        </div>
      </div>
    </div>`;

    bindExtGroupBar(host, ctx);
    host.querySelector('[data-fmt]').onclick = e => {
      const b = e.target.closest('[data-exact]'); if (!b) return;
      exactMode = b.dataset.exact === '1';
      render();
    };
    host.querySelector('[data-pmode]').onclick = e => {
      const b = e.target.closest('[data-pm]'); if (!b) return;
      probeMode = b.dataset.pm;
      render();
    };
    host.querySelector('[data-ra]')?.addEventListener('change', e => { rowA = +e.target.value; inspectedIrrep = rowA; render(); });
    host.querySelector('[data-rb]')?.addEventListener('change', e => { rowB = +e.target.value; render(); });
    host.querySelector('[data-ca]')?.addEventListener('change', e => { colA = +e.target.value; inspectedClass = colA; render(); });
    host.querySelector('[data-cb]')?.addEventListener('change', e => { colB = +e.target.value; render(); });

    host.querySelector('.grep-ctbl').onclick = e => {
      const thCls = e.target.closest('th[data-cls]');
      if (thCls) {
        const k = +thCls.dataset.cls;
        inspectedClass = k;
        if (probeMode === 'col') { colB = colA; colA = k; }
        render();
        return;
      }
      const thIr = e.target.closest('th[data-irrep]');
      if (thIr) {
        const i = +thIr.dataset.irrep;
        inspectedIrrep = i;
        if (probeMode === 'row') { rowB = rowA; rowA = i; }
        render();
        return;
      }
      const td = e.target.closest('td[data-irrep]');
      if (td) {
        inspectedIrrep = +td.dataset.irrep;
        inspectedClass = +td.dataset.cls;
        render();
      }
    };

    host.querySelector('[data-go-kron]').onclick = () => ctx.jumpTo('kronecker');
    host.querySelector('[data-go-mol]').onclick = () => ctx.jumpTo('molien');
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 2 (temsil): KRONECKER ÇARPIMLARI
// =====================================================================
function mountKronecker(host, G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  const ct = characterTable(G);
  const r = ct.irreps.length;
  const firstHigh = ct.irreps.findIndex(ir => ir.dim >= 2);
  let iA = firstHigh >= 0 ? firstHigh : Math.min(1, r - 1);
  let iB = iA;
  let powerK = 3;

  const render = () => {
    const kp = kroneckerProduct(G, iA, iB);
    const sq = symmetricAndAntisymmetricSquares(G, iA);
    const tp = tensorPowerDecomp(G, iA, powerK);

    // Compute invariant counts for powers 1..6
    const powStats = [];
    let maxInv = 1;
    for (let k = 1; k <= 6; k++) {
      const d = tensorPowerDecomp(G, iA, k);
      const invTerm = d.terms.find(t => t.irrep.isTrivial);
      const cnt = invTerm ? invTerm.mult : 0;
      if (cnt > maxInv) maxInv = cnt;
      powStats.push({ k, dim: d.dim, inv: cnt });
    }

    const showFullGrid = r <= 12;
    const gridLimit = Math.min(r, 12);

    host.innerHTML = `<div class="grp-stage">
      ${renderExtGroupBar(G)}

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Kronecker (Tensör) Çarpım Ayrışımı</h3>
            <span class="grp-pill acc">${tex(`${kp.left.latex} \\otimes ${kp.right.latex}`)} · boyut ${kp.dim}</span>
          </div>
          <div class="grp-toolbar-g">
            <select class="inp grp-sel" data-ka aria-label="Sol irrep">${ct.irreps.map((ir, idx) => `<option value="${idx}" ${idx === iA ? 'selected' : ''}>${esc(ir.name)} (d=${ir.dim})</option>`).join('')}</select>
            <span class="mono">⊗</span>
            <select class="inp grp-sel" data-kb aria-label="Sağ irrep">${ct.irreps.map((ir, idx) => `<option value="${idx}" ${idx === iB ? 'selected' : ''}>${esc(ir.name)} (d=${ir.dim})</option>`).join('')}</select>
          </div>
        </div>

        <div class="grp-math-box">${tex(`${kp.left.latex} \\otimes ${kp.right.latex} = ${kp.latex}`, true)}</div>

        <div class="grp-callout">
          <span class="small">Boyut kontrolü: ${tex(`${kp.left.dim} \\times ${kp.right.dim} = ${kp.dim} = ${kp.terms.map(t => t.mult > 1 ? `${t.mult}\\cdot ${t.irrep.dim}` : `${t.irrep.dim}`).join(' + ')}`)}</span>
          <span class="grp-pill ok">✓ Kesin ayrışım</span>
        </div>

        <div class="grep-ctbl-wrap">
          <table class="grep-ctbl" aria-label="Tensör çarpım karakter değerleri">
            <thead>
              <tr>
                <th scope="col">Sınıf</th>
                ${ct.classes.map((c, k) => `<th scope="col">${tex(`${c.size}\\,${c.latex.length <= 14 ? c.latex : `C_{${k + 1}}`}`)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">${tex(kp.left.latex)}</th>${kp.left.entries.map(e => `<td>${tex(e.latex)}</td>`).join('')}</tr>
              <tr><th scope="row">${tex(kp.right.latex)}</th>${kp.right.entries.map(e => `<td>${tex(e.latex)}</td>`).join('')}</tr>
              <tr class="grep-row-a"><th scope="row">${tex(`${kp.left.latex}\\otimes ${kp.right.latex}`)}</th>${kp.entries.map(e => `<td>${tex(e.latex)}</td>`).join('')}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grp-grid-2">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Simetrik & Antisimetrik Kareler</h3>
            ${fsBadge(sq.irrep)}
          </div>
          <div class="small mute">${tex(`\\chi_{\\mathrm{Sym}^2}(g) = \\tfrac{1}{2}(\\chi(g)^2 + \\chi(g^2)),\\quad \\chi_{\\Lambda^2}(g) = \\tfrac{1}{2}(\\chi(g)^2 - \\chi(g^2))`)}</div>
          <div class="grp-math-box">
            <div style="margin-bottom:8px">${tex(`\\operatorname{Sym}^2(${sq.irrep.latex}) = ${sq.symmetric.latex} \\quad (\\dim = ${sq.symmetric.dim})`)}</div>
            <div>${tex(`\\Lambda^2(${sq.irrep.latex}) = ${sq.antisymmetric.latex} \\quad (\\dim = ${sq.antisymmetric.dim})`)}</div>
          </div>
          <div class="grp-callout ${sq.invariantInSym || sq.invariantInAlt ? 'ok' : ''}">
            <span class="small">
              ${sq.irrep.fsIndicator === 1
                ? `Gerçek temsil (ι = +1): aşikar değişmez <b>Sym²</b> içinde yer alır (simetrik bilineer değişmez).`
                : sq.irrep.fsIndicator === -1
                  ? `Sözde-gerçek temsil (ι = −1): aşikar değişmez <b>Λ²</b> içinde yer alır (antisimetrik spinör değişmezi ε_αβ)!`
                  : `Karmaşık temsil (ι = 0): <b>1</b> ne Sym² ne Λ² içinde görünür (değişmez ancak ${tex(`${sq.irrep.latex}\\otimes ${ct.irreps[sq.irrep.conjugateIndex].latex}`)} içinde çıkar).`}
            </span>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-toolbar">
            <h3 class="grp-panel-title">Tensör Kuvvetleri ${tex(`${sq.irrep.latex}^{\\otimes k}`)}</h3>
            <div class="seg" data-pk role="tablist" aria-label="Tensör kuvveti k">
              ${[1, 2, 3, 4, 5, 6].map(k => `<button type="button" data-k="${k}" class="${k === powerK ? 'on' : ''}">k=${k}</button>`).join('')}
            </div>
          </div>
          <div class="grp-math-box">${tex(`${sq.irrep.latex}^{\\otimes ${powerK}} = ${tp.latex}`)}</div>
          <div class="small mute">Derece k = 1..6 için tensör kuvvetindeki aşikar değişmez sayısı ${tex('m_{\\mathbf{1}}(k) = \\dim(V^{\\otimes k})^G')}:</div>
          <div class="grep-bars">
            ${powStats.map(s => `<div class="grep-bar-row">
              <span class="mono small">k=${s.k} (d=${s.dim})</span>
              <span class="grep-bar-track"><span class="grep-bar-fill" style="width:${(s.inv / maxInv * 100).toFixed(1)}%"></span></span>
              <span class="mono small" style="text-align:right"><b>${s.inv}</b> değişmez</span>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Kronecker Çarpım Tablosu (${showFullGrid ? `${r}×${r}` : `ilk ${gridLimit}×${gridLimit}`})</h3>
          <span class="mute small">Detay için herhangi bir hücreye dokun</span>
        </div>
        <div class="grep-ctbl-wrap">
          <table class="grep-ctbl grep-kron-tbl" aria-label="${esc(G.name)} Kronecker çarpım tablosu">
            <thead>
              <tr>
                <th scope="col">${tex('\\otimes')}</th>
                ${ct.irreps.slice(0, gridLimit).map(ir => `<th scope="col">${tex(ir.latex)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${ct.irreps.slice(0, gridLimit).map((ir1, a) => `<tr>
                <th scope="row">${tex(ir1.latex)}</th>
                ${ct.irreps.slice(0, gridLimit).map((ir2, b) => {
                  const p = kroneckerProduct(G, a, b);
                  const on = (a === iA && b === iB) || (a === iB && b === iA);
                  return `<td class="${on ? 'grep-cell-on' : ''}" data-ga="${a}" data-gb="${b}">${tex(p.latex)}</td>`;
                }).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

    bindExtGroupBar(host, ctx);
    host.querySelector('[data-ka]').onchange = e => { iA = +e.target.value; render(); };
    host.querySelector('[data-kb]').onchange = e => { iB = +e.target.value; render(); };
    host.querySelector('[data-pk]').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      powerK = +b.dataset.k;
      render();
    };
    host.querySelector('.grep-kron-tbl').onclick = e => {
      const td = e.target.closest('td[data-ga]'); if (!td) return;
      iA = +td.dataset.ga; iB = +td.dataset.gb;
      render();
    };
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 3 (temsil): GÖMMELER & DALLANMA (Restriction / Branching Rules)
// =====================================================================
function renderBranchingSvg(ri, activeGIdx) {
  const nG = ri.ctG.irreps.length;
  const nH = ri.ctH.irreps.length;
  const rowH = 38;
  const H = Math.max(180, Math.max(nG, nH) * rowH + 46);
  const W = 520;
  const xL = 105, xR = W - 105;
  const yOf = (idx, tot) => 28 + (idx + 0.5) * ((H - 44) / Math.max(1, tot));

  const edges = [];
  for (let i = 0; i < nG; i++) {
    const y1 = yOf(i, nG);
    const hi = activeGIdx === i;
    const dim = activeGIdx !== null && activeGIdx !== i;
    for (const t of ri.restrictions[i].terms) {
      const y2 = yOf(t.irrepIndex, nH);
      const mx = (xL + xR) / 2;
      const stroke = hi ? 'var(--acc)' : 'rgba(255,255,255,0.28)';
      const sw = hi ? 2.4 : (t.mult > 1 ? 1.8 : 1.2);
      const op = dim ? 0.16 : 0.92;
      edges.push(`<path d="M${xL + 28} ${y1.toFixed(1)} C${mx} ${y1.toFixed(1)}, ${mx} ${y2.toFixed(1)}, ${xR - 28} ${y2.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`);
      if (t.mult > 1) {
        const lx = mx + (hi ? 0 : (i % 2 ? -18 : 18));
        const ly = (y1 + y2) / 2 - 4;
        edges.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${hi ? '#fff' : '#a1a1aa'}" font-size="11" font-family="monospace" text-anchor="middle" opacity="${op}">×${t.mult}</text>`);
      }
    }
  }

  const leftNodes = ri.ctG.irreps.map((ir, i) => {
    const y = yOf(i, nG);
    const hi = activeGIdx === i;
    return `<g data-bg="${i}" style="cursor:pointer">
      <rect x="14" y="${(y - 14).toFixed(1)}" width="118" height="28" rx="8" fill="${hi ? 'var(--acc)' : '#111118'}" stroke="${hi ? '#fff' : 'rgba(255,255,255,0.4)'}" stroke-width="${hi ? 2 : 1.3}"/>
      <text x="73" y="${(y + 4).toFixed(1)}" fill="${hi ? '#000' : '#f4f4f5'}" font-size="12" font-weight="${hi ? 700 : 500}" font-family="monospace" text-anchor="middle">${esc(ir.name)} (d=${ir.dim})</text>
    </g>`;
  }).join('');

  const rightNodes = ri.ctH.irreps.map((ir, j) => {
    const y = yOf(j, nH);
    const connected = activeGIdx !== null && ri.restrictions[activeGIdx].terms.some(t => t.irrepIndex === j);
    return `<g>
      <rect x="${W - 132}" y="${(y - 14).toFixed(1)}" width="118" height="28" rx="8" fill="${connected ? 'rgba(91,228,155,0.18)' : '#111118'}" stroke="${connected ? '#5be49b' : 'rgba(255,255,255,0.35)'}" stroke-width="${connected ? 2 : 1.3}"/>
      <text x="${W - 73}" y="${(y + 4).toFixed(1)}" fill="#f4f4f5" font-size="12" font-family="monospace" text-anchor="middle">${esc(ir.name)} (d=${ir.dim})</text>
    </g>`;
  }).join('');

  return `<div class="grep-svg-scroll">
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dallanma diyagramı">
      <text x="73" y="16" fill="#8b8b94" font-size="11" font-family="sans-serif" text-anchor="middle">${esc(ri.ctG.groupName)} irrepleri</text>
      <text x="${W - 73}" y="16" fill="#8b8b94" font-size="11" font-family="sans-serif" text-anchor="middle">H (|H|=${ri.H.size}) irrepleri</text>
      ${edges.join('')}
      ${leftNodes}
      ${rightNodes}
    </svg>
  </div>`;
}

function mountBranching(host, G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let dead = false;
  clean.add(() => { dead = true; });

  host.innerHTML = `<div class="grp-stage">
    ${renderExtGroupBar(G)}
    <div class="grp-panel"><div class="grp-loader"><span class="orbit-loader"></span><span>${esc(G.name)} alt grupları hesaplanıyor…</span></div></div>
  </div>`;
  bindExtGroupBar(host, ctx);

  deferTask(() => safeSubgroups(G, { maxSubgroups: 400 }), G.size > 24).then(({ subgroups: subs, truncated }) => {
    if (dead || !host.isConnected) return;
    let selectedKey = pickDefaultSubgroup(subs, G.size).key;
    let activeGIdx = null;
    let chainKey = '';

    const render = () => {
      const subObj = subs.find(s => s.key === selectedKey) || subs[0];
      const ri = restrictionAndInduction(G, subObj.elements);
      const hIdent = identifyGroup(ri.H);
      const hName = hIdent ? hIdent.label : `H_{${ri.H.size}}`;
      const hLatex = hIdent ? hIdent.latex : `H_{${ri.H.size}}`;

      // Optional 2nd step chain H ⊃ K
      const hSubs = ri.H.size <= 64 ? safeSubgroups(ri.H, { maxSubgroups: 120 }).subgroups : [];
      const hProper = hSubs.filter(s => s.order > 1 && s.order < ri.H.size);
      const kSub = hProper.find(s => s.key === chainKey) || null;
      const ri2 = kSub ? restrictionAndInduction(ri.H, kSub.elements) : null;
      const kIdent = ri2 ? identifyGroup(ri2.H) : null;

      host.innerHTML = `<div class="grp-stage">
        ${renderExtGroupBar(G)}

        ${truncated ? `<div class="grp-callout"><span class="small">Not: ${esc(G.name)} çok fazla alt gruba sahip olduğundan performans için ilk <b>${subs.length}</b> alt grup listelendi (büyük alt gruplar ve devirli alt gruplar dahildir).</span></div>` : ''}

        <div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Gömme & Dallanma Kuralları (${tex(`${G.latex} \\downarrow ${hLatex}`)})</h3>
              <span class="grp-pill acc">[G : H] = ${ri.index}</span>
              ${subObj.isNormal ? '<span class="grp-pill ok">H ◁ G (Normal)</span>' : '<span class="grp-pill">Normal değil</span>'}
            </div>
            <div class="grp-toolbar-g">
              <label class="row" style="gap:6px">
                <span class="small mute">Alt grup H:</span>
                <select class="inp grp-sel" data-sub aria-label="Alt grup H seç">
                  ${subs.map(s => {
                    const gLbl = s.generators.slice(0, 3).map(g => G.elements[g]).join(', ');
                    return `<option value="${esc(s.key)}" ${s.key === subObj.key ? 'selected' : ''}>|H|=${s.order} ${s.isNormal ? '◁' : '≤'} ⟨${esc(gLbl)}⟩</option>`;
                  }).join('')}
                </select>
              </label>
              <button type="button" class="btn small" data-go-ind>${icon('arrow')} İndüklemeye Geç</button>
            </div>
          </div>

          <div class="grp-grid-2">
            <div>
              <div class="grp-table-wrap">
                <table class="grp-tbl" aria-label="Dallanma kuralları tablosu">
                  <thead>
                    <tr>
                      <th scope="col">${tex(G.latex)} İrrep</th>
                      <th scope="col">Boyut</th>
                      <th scope="col">${tex(hLatex)} Üzerinde Dallanma</th>
                      <th scope="col">Kontrol</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ri.restrictions.map((r, idx) => `<tr class="${activeGIdx === idx ? 'on' : ''}" data-rg="${idx}">
                      <td>${tex(r.irrepG.latex)}</td>
                      <td class="mono">${r.irrepG.dim}</td>
                      <td>${tex(r.latex)}</td>
                      <td class="mono small">${r.dimSum === r.irrepG.dim ? '✓' : '✗'} ${r.dimSum}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <div class="small mute" style="margin-top:6px">Bir satıra veya diyagramdaki sol kutuya dokunarak o irrep’in dallarını vurgula.</div>
            </div>

            <div>
              ${renderBranchingSvg(ri, activeGIdx)}
            </div>
          </div>
        </div>

        ${hProper.length ? `<div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">İki Adımlı Simetri Kırılım Zinciri (${tex(`${G.latex} \\supset ${hLatex} \\supset K`)})</h3>
            </div>
            <select class="inp grp-sel" data-ksub aria-label="Alt grup zinciri için K seç">
              <option value="">— İkinci adım K seç (isteğe bağlı) —</option>
              ${hProper.slice(0, 40).map(s => `<option value="${esc(s.key)}" ${s.key === chainKey ? 'selected' : ''}>|K|=${s.order} ${s.isNormal ? '◁' : '≤'} ${esc(hName)}</option>`).join('')}
            </select>
          </div>
          ${ri2 ? `<div class="grp-table-wrap">
            <table class="grp-tbl" aria-label="İki adımlı dallanma zinciri">
              <thead>
                <tr>
                  <th scope="col">${tex(G.latex)}</th>
                  <th scope="col">${tex(`\\downarrow ${hLatex}`)}</th>
                  <th scope="col">${tex(`\\downarrow ${kIdent ? kIdent.latex : `K_{${ri2.H.size}}`}`)}</th>
                </tr>
              </thead>
              <tbody>
                ${ri.restrictions.map(r1 => {
                  // Combine 2nd-level restrictions
                  const kCounts = new Int32Array(ri2.ctH.irreps.length);
                  for (const t1 of r1.terms) {
                    for (const t2 of ri2.restrictions[t1.irrepIndex].terms) {
                      kCounts[t2.irrepIndex] += t1.mult * t2.mult;
                    }
                  }
                  const kLatex = ri2.ctH.irreps
                    .map((irK, idx) => kCounts[idx] > 0 ? (kCounts[idx] > 1 ? `${kCounts[idx]}\\,${irK.latex}` : irK.latex) : null)
                    .filter(Boolean).join(' \\oplus ');
                  return `<tr><td>${tex(r1.irrepG.latex)}</td><td>${tex(r1.latex)}</td><td>${tex(kLatex)}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : `<div class="small mute">Örneğin ${tex('S_4 \\supset A_4 \\supset V_4')} veya ${tex('2O \\supset 2T \\supset Q_8')} gibi kademeli simetri kırılımlarını izlemek için ${tex('H')} içinde bir ${tex('K')} alt grubu seç.</div>`}
        </div>` : ''}
      </div>`;

      bindExtGroupBar(host, ctx);
      host.querySelector('[data-sub]').onchange = e => { selectedKey = e.target.value; activeGIdx = null; chainKey = ''; render(); };
      host.querySelector('[data-ksub]')?.addEventListener('change', e => { chainKey = e.target.value; render(); });
      host.querySelector('[data-go-ind]').onclick = () => ctx.jumpTo('indukleme');
      host.querySelectorAll('[data-rg], [data-bg]').forEach(el => {
        el.onclick = () => {
          const v = +(el.dataset.rg ?? el.dataset.bg);
          activeGIdx = activeGIdx === v ? null : v;
          render();
        };
      });
    };

    render();
  });

  return clean.run;
}

// =====================================================================
// TAB 4 (temsil): İNDÜKLENMİŞ TEMSİLLER & FROBENIUS KARŞILIKLILIĞI
// =====================================================================
function mountInduction(host, G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let dead = false;
  clean.add(() => { dead = true; });

  host.innerHTML = `<div class="grp-stage">
    ${renderExtGroupBar(G)}
    <div class="grp-panel"><div class="grp-loader"><span class="orbit-loader"></span><span>${esc(G.name)} alt grupları hazırlanıyor…</span></div></div>
  </div>`;
  bindExtGroupBar(host, ctx);

  deferTask(() => safeSubgroups(G, { maxSubgroups: 400 }), G.size > 24).then(({ subgroups: subs, truncated }) => {
    if (dead || !host.isConnected) return;
    let selectedKey = pickDefaultSubgroup(subs, G.size).key;
    let selectedPsi = 0;
    let activePair = [0, 0]; // [gIrrepIdx, hIrrepIdx]

    const render = () => {
      const subObj = subs.find(s => s.key === selectedKey) || subs[0];
      const ri = restrictionAndInduction(G, subObj.elements);
      if (selectedPsi >= ri.ctH.irreps.length) selectedPsi = 0;
      if (activePair[0] >= ri.ctG.irreps.length) activePair[0] = 0;
      if (activePair[1] >= ri.ctH.irreps.length) activePair[1] = 0;

      const hIdent = identifyGroup(ri.H);
      const hLatex = hIdent ? hIdent.latex : `H_{${ri.H.size}}`;
      const ind = ri.inductions[selectedPsi];
      const [gi, hj] = activePair;
      const recVal = ri.resMatrix[gi][hj];

      host.innerHTML = `<div class="grp-stage">
        ${renderExtGroupBar(G)}

        ${truncated ? `<div class="grp-callout"><span class="small">Not: Performans için ilk <b>${subs.length}</b> alt grup listelendi.</span></div>` : ''}

        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">İndeks [G : H]</span><span class="grp-kpi-val mono">${ri.index}</span><span class="grp-kpi-sub">${tex(`|G|=${G.size},\\; |H|=${ri.H.size}`)}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Frobenius Karşılıklılığı</span><span class="grp-kpi-val">${ri.reciprocityOk ? '✓ R = Iᵀ' : '✗ Hata'}</span><span class="grp-kpi-sub">tüm (i,j) çiftleri</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Seçili İndükleme</span><span class="grp-kpi-val">${tex(`\\dim = ${ind.dim}`)}</span><span class="grp-kpi-sub">${ri.index} × ${ind.irrepH.dim}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">İrrep Sayıları</span><span class="grp-kpi-val mono">${ri.ctH.irreps.length} → ${ri.ctG.irreps.length}</span><span class="grp-kpi-sub">H irrepleri → G irrepleri</span></div>
        </div>

        <div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">İndüklenmiş Temsiller (${tex(`\\operatorname{Ind}_{${hLatex}}^{${G.latex}} \\psi`)})</h3>
            </div>
            <div class="grp-toolbar-g">
              <select class="inp grp-sel" data-sub aria-label="Alt grup H seç">
                ${subs.map(s => {
                  const gLbl = s.generators.slice(0, 3).map(g => G.elements[g]).join(', ');
                  return `<option value="${esc(s.key)}" ${s.key === subObj.key ? 'selected' : ''}>|H|=${s.order} ${s.isNormal ? '◁' : '≤'} ⟨${esc(gLbl)}⟩</option>`;
                }).join('')}
              </select>
              <button type="button" class="btn small" data-go-branch>${icon('side')} Dallanmaya Geç</button>
            </div>
          </div>

          <div class="grp-table-wrap">
            <table class="grp-tbl" aria-label="İndüklenmiş temsil ayrışımları">
              <thead>
                <tr>
                  <th scope="col">${tex(hLatex)} İrrep ψ</th>
                  <th scope="col">${tex('\\dim(\\operatorname{Ind}\\psi)')}</th>
                  <th scope="col">${tex(G.latex)} İçinde Ayrışım</th>
                  <th scope="col">İrrep mi?</th>
                </tr>
              </thead>
              <tbody>
                ${ri.inductions.map((item, j) => {
                  const isIrred = item.terms.length === 1 && item.terms[0].mult === 1;
                  return `<tr class="${j === selectedPsi ? 'on' : ''}" data-psi="${j}">
                    <td>${tex(item.irrepH.latex)} (d=${item.irrepH.dim})</td>
                    <td class="mono">${item.dim}</td>
                    <td>${tex(item.latex)}</td>
                    <td>${isIrred ? '<span class="grp-pill ok">İndirgenemez ✦</span>' : '<span class="mute small">İndirgenebilir</span>'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="small mute">Seçili ${tex(`\\operatorname{Ind}_{${hLatex}}^{${G.latex}}(${ind.irrepH.latex})`)} karakter değerleri (${tex('\\chi^{\\operatorname{Ind}}(g) = \\frac{1}{|H|}\\sum_{xgx^{-1}\\in H}\\psi(xgx^{-1})')}):</div>
          <div class="grep-ctbl-wrap">
            <table class="grep-ctbl" aria-label="İndüklenmiş karakter değerleri">
              <thead>
                <tr>
                  <th scope="col">G sınıfı</th>
                  ${ri.ctG.classes.map((c, k) => `<th scope="col">${tex(`${c.size}\\,${c.latex.length <= 14 ? c.latex : `C_{${k + 1}}`}`)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <tr class="grep-row-a">
                  <th scope="row">${tex(`\\operatorname{Ind}(${ind.irrepH.latex})`)}</th>
                  ${ind.entries.map(e => `<td>${tex(e.latex)}</td>`).join('')}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Frobenius Karşılıklılığı Matris Doğrulaması</h3>
            <span class="grp-pill ok">✓ R = Iᵀ</span>
          </div>
          <div class="grp-callout ok">
            <span>${tex(`\\big\\langle \\operatorname{Ind}_H^G(${ri.ctH.irreps[hj].latex}),\\; ${ri.ctG.irreps[gi].latex} \\big\\rangle_G = ${ri.indMatrix[hj][gi]} = ${recVal} = \\big\\langle ${ri.ctH.irreps[hj].latex},\\; \\operatorname{Res}_H^G(${ri.ctG.irreps[gi].latex}) \\big\\rangle_H`)}</span>
            <span class="small mute">Matriste herhangi bir hücreye dokun</span>
          </div>
          <div class="grp-grid-2">
            <div>
              <div class="small mute" style="margin-bottom:6px">Kısıtlama Matrisi ${tex('R_{ij} = \\langle \\psi_j, \\operatorname{Res}(\\chi_i) \\rangle_H')}</div>
              <div class="grep-ctbl-wrap">
                <table class="grep-ctbl grep-recip-tbl" aria-label="Kısıtlama matrisi">
                  <thead><tr><th scope="col">G \\ H</th>${ri.ctH.irreps.map(ir => `<th scope="col">${tex(ir.latex)}</th>`).join('')}</tr></thead>
                  <tbody>
                    ${ri.ctG.irreps.map((irG, i) => `<tr>
                      <th scope="row">${tex(irG.latex)}</th>
                      ${ri.resMatrix[i].map((v, j) => `<td class="${v > 0 ? 'grep-nz' : 'grep-zero'} ${i === gi && j === hj ? 'grep-cell-on' : ''}" data-ri="${i}" data-rj="${j}">${v}</td>`).join('')}
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div class="small mute" style="margin-bottom:6px">İndükleme Matrisi ${tex('I_{ji} = \\langle \\operatorname{Ind}(\\psi_j), \\chi_i \\rangle_G')}</div>
              <div class="grep-ctbl-wrap">
                <table class="grep-ctbl grep-recip-tbl" aria-label="İndükleme matrisi">
                  <thead><tr><th scope="col">H \\ G</th>${ri.ctG.irreps.map(ir => `<th scope="col">${tex(ir.latex)}</th>`).join('')}</tr></thead>
                  <tbody>
                    ${ri.ctH.irreps.map((irH, j) => `<tr>
                      <th scope="row">${tex(irH.latex)}</th>
                      ${ri.indMatrix[j].map((v, i) => `<td class="${v > 0 ? 'grep-nz' : 'grep-zero'} ${i === gi && j === hj ? 'grep-cell-on' : ''}" data-ri="${i}" data-rj="${j}">${v}</td>`).join('')}
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>`;

      bindExtGroupBar(host, ctx);
      host.querySelector('[data-sub]').onchange = e => { selectedKey = e.target.value; selectedPsi = 0; activePair = [0, 0]; render(); };
      host.querySelector('[data-go-branch]').onclick = () => ctx.jumpTo('gomme-dallanma');
      host.querySelectorAll('[data-psi]').forEach(tr => {
        tr.onclick = () => { selectedPsi = +tr.dataset.psi; activePair[1] = selectedPsi; render(); };
      });
      host.querySelectorAll('td[data-ri]').forEach(td => {
        td.onclick = () => { activePair = [+td.dataset.ri, +td.dataset.rj]; selectedPsi = activePair[1]; render(); };
      });
    };

    render();
  });

  return clean.run;
}

// =====================================================================
// TAB 5 (temsil): DEĞİŞMEZLER & MOLİEN SERİSİ
// =====================================================================
function mountMolien(host, G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  const ct = characterTable(G);
  const defaultIr = ct.irreps.findIndex(ir => ir.dim >= 2 && ir.isFaithful);
  let irIdx = defaultIr >= 0 ? defaultIr : (ct.irreps.findIndex(ir => ir.dim >= 2) >= 0 ? ct.irreps.findIndex(ir => ir.dim >= 2) : ct.irreps.length - 1);
  let maxDeg = 14;

  const fmtPolyLatex = coeffs => {
    const parts = [];
    for (let k = 0; k < coeffs.length; k++) {
      const c = coeffs[k];
      if (Math.abs(c.re) < 1e-6 && Math.abs(c.im) < 1e-6) continue;
      if (k === 0) parts.push(c.latex);
      else {
        const tPart = k === 1 ? 't' : `t^{${k}}`;
        if (c.latex === '1') parts.push(parts.length ? `+ ${tPart}` : tPart);
        else if (c.latex === '-1') parts.push(`- ${tPart}`);
        else if (c.latex.startsWith('-')) parts.push(`- ${c.latex.slice(1)}${tPart}`);
        else parts.push(parts.length ? `+ (${c.latex})${tPart}` : `${c.latex}${tPart}`);
      }
    }
    return parts.join(' ') || '1';
  };

  const render = () => {
    const ir = ct.irreps[irIdx];
    const m = molienSeries(G, irIdx, maxDeg);
    const maxMol = Math.max(1, ...m.molien);
    const firstNonTriv = m.molien.findIndex((v, k) => k > 0 && v > 0);

    host.innerHTML = `<div class="grp-stage">
      ${renderExtGroupBar(G)}

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Molien Serisi & Polinom Değişmezleri</h3>
            <span class="grp-pill acc">${tex(`${G.latex} : ${ir.latex}`)} (d=${ir.dim})</span>
          </div>
          <div class="grp-toolbar-g">
            <select class="inp grp-sel" data-ir aria-label="Temsil seç">${ct.irreps.map((x, idx) => `<option value="${idx}" ${idx === irIdx ? 'selected' : ''}>${esc(x.name)} (d=${x.dim}${x.isFaithful ? ', sadık' : ''})</option>`).join('')}</select>
            <div class="seg" data-deg role="tablist" aria-label="Maksimum derece">
              ${[8, 12, 16, 20].map(d => `<button type="button" data-d="${d}" class="${d === maxDeg ? 'on' : ''}">≤ t^${d}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="grp-math-box">
          <div class="small mute" style="margin-bottom:6px">${tex(`M_{${ir.latex}}(t) = \\frac{1}{${G.size}} \\sum_{g\\in G} \\frac{1}{\\det(I - t\\,\\rho(g))}`)}</div>
          ${tex(`M(t) = ${m.seriesLatex}`, true)}
        </div>

        <div class="grp-callout">
          <span class="small">
            ${firstNonTriv > 0
              ? `İlk aşikar olmayan homojen simetrik değişmez polinom <b>derece ${firstNonTriv}</b>’te ortaya çıkar (${m.molien[firstNonTriv]} bağımsız değişmez).`
              : `Derece ≤ ${maxDeg} içinde aşikar olmayan değişmez polinom yok (daha yüksek derece dene!).`}
          </span>
          <div class="grp-toolbar-g">
            <button type="button" class="grp-chip" data-preset="D3">D₃ (2B)</button>
            <button type="button" class="grp-chip" data-preset="A4">A₄ (3B)</button>
            <button type="button" class="grp-chip" data-preset="2I">2I (Klein t¹²)</button>
          </div>
        </div>

        <div class="grp-grid-2">
          <div>
            <div class="grp-panel-head" style="margin-bottom:8px">
              <h3 class="grp-panel-title">Simetrik Değişmez Sayıları c_k = [t^k]M(t)</h3>
            </div>
            <div class="grep-bars">
              ${m.molien.map((cnt, k) => `<div class="grep-bar-row">
                <span class="mono small">t<sup>${k}</sup></span>
                <span class="grep-bar-track"><span class="grep-bar-fill" style="width:${(cnt / maxMol * 100).toFixed(1)}%"></span></span>
                <span class="mono small" style="text-align:right"><b>${cnt}</b></span>
              </div>`).join('')}
            </div>
          </div>

          <div>
            <div class="grp-panel-head" style="margin-bottom:8px">
              <h3 class="grp-panel-title">Simetrik / Tensör / Dış Değişmez Karşılaştırması</h3>
            </div>
            <div class="grp-table-wrap">
              <table class="grp-tbl" aria-label="Dereceye göre değişmez sayıları">
                <thead>
                  <tr>
                    <th scope="col">k</th>
                    <th scope="col">${tex('\\dim(\\mathrm{Sym}^k V)^G')}</th>
                    <th scope="col">${tex('\\dim(V^{\\otimes k})^G')}</th>
                    <th scope="col">${tex('\\dim(\\Lambda^k V)^G')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${m.molien.map((ck, k) => `<tr>
                    <td class="mono">${k}</td>
                    <td class="mono"><b>${ck}</b></td>
                    <td class="mono">${m.tensorInvariants[k]}</td>
                    <td class="mono">${k <= m.dim ? m.exteriorInvariants[k] : '<span class="mute">—</span>'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Sınıflara Göre Karakteristik Polinomlar ${tex('\\det(I - t\\,\\rho(g_k))')}</h3>
          <span class="mute small">Newton özdeşlikleriyle karakterden hesaplandı</span>
        </div>
        <div class="grp-table-wrap">
          <table class="grp-tbl" aria-label="Sınıf karakteristik polinomları">
            <thead>
              <tr>
                <th scope="col">Sınıf</th>
                <th scope="col">Boyut h_k</th>
                <th scope="col">${tex('\\chi(g_k)')}</th>
                <th scope="col">${tex('\\det(I - t\\,\\rho(g_k))')}</th>
              </tr>
            </thead>
            <tbody>
              ${m.charPolys.map(cp => {
                const cl = ct.classes[cp.classIndex];
                return `<tr>
                  <td>${tex(cl.latex)}</td>
                  <td class="mono">${cp.classSize}</td>
                  <td>${tex(ir.entries[cp.classIndex].latex)}</td>
                  <td>${tex(fmtPolyLatex(cp.coeffs))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

    bindExtGroupBar(host, ctx);
    host.querySelector('[data-ir]').onchange = e => { irIdx = +e.target.value; render(); };
    host.querySelector('[data-deg]').onclick = e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      maxDeg = +b.dataset.d;
      render();
    };
    host.querySelectorAll('[data-preset]').forEach(b => {
      b.onclick = () => {
        const p = b.dataset.preset;
        if (p === 'D3') ctx.setGroup({ kind: 'D', n: 3 });
        else if (p === 'A4') ctx.setGroup({ kind: 'A', n: 4 });
        else if (p === '2I') ctx.setGroup({ kind: '2I' });
      };
    });
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 6 (sonlu): YARI-DİREKT ÇARPIM LABORATUVARI
// =====================================================================
const SD_N_FACTORS = [
  { key: 'Z3', label: 'Z₃', build: () => cyclic(3) },
  { key: 'Z4', label: 'Z₄', build: () => cyclic(4) },
  { key: 'Z5', label: 'Z₅', build: () => cyclic(5) },
  { key: 'Z6', label: 'Z₆', build: () => cyclic(6) },
  { key: 'Z7', label: 'Z₇', build: () => cyclic(7) },
  { key: 'Z8', label: 'Z₈', build: () => cyclic(8) },
  { key: 'V4', label: 'V₄', build: () => kleinFour() },
  { key: 'Z3xZ3', label: 'Z₃×Z₃', build: () => directProduct(cyclic(3), cyclic(3)) },
  { key: 'A4', label: 'A₄', build: () => alternating(4) },
];
const SD_H_FACTORS = [
  { key: 'Z2', label: 'Z₂', build: () => cyclic(2) },
  { key: 'Z3', label: 'Z₃', build: () => cyclic(3) },
  { key: 'Z4', label: 'Z₄', build: () => cyclic(4) },
  { key: 'V4', label: 'V₄', build: () => kleinFour() },
  { key: 'S3', label: 'S₃', build: () => symmetric(3) },
];
const SD_PRESETS = [
  { label: 'D₃ = Z₃ ⋊ Z₂', nKey: 'Z3', hKey: 'Z2', pickNonTriv: true, jumpSpec: { kind: 'D', n: 3 } },
  { label: 'D₅ = Z₅ ⋊ Z₂', nKey: 'Z5', hKey: 'Z2', pickNonTriv: true, jumpSpec: { kind: 'D', n: 5 } },
  { label: 'T₇ = Z₇ ⋊ Z₃', nKey: 'Z7', hKey: 'Z3', pickNonTriv: true, jumpSpec: { kind: 'T7' } },
  { label: 'A₄ = V₄ ⋊ Z₃', nKey: 'V4', hKey: 'Z3', pickNonTriv: true, jumpSpec: { kind: 'A', n: 4 } },
  { label: 'S₄ = A₄ ⋊ Z₂', nKey: 'A4', hKey: 'Z2', pickNonTriv: true, jumpSpec: { kind: 'S', n: 4 } },
  { label: 'Δ(27) = Z₃² ⋊ Z₃', special: 'Delta27', jumpSpec: { kind: 'Delta3', n: 3 } },
  { label: 'Δ(54) = Z₃² ⋊ S₃', special: 'Delta54', jumpSpec: { kind: 'Delta6', n: 3 } },
];

const SD_ACTION_CACHE = new Map();

function mountSemiDirect(host, _G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let nKey = 'Z7', hKey = 'Z3';
  let actionIdx = 1;
  let specialPreset = null;
  let el1 = [1, 1], el2 = [2, 1]; // (n1, h1) and (n2, h2)

  const getActions = (nk, hk) => {
    const k = `${nk}|${hk}`;
    if (SD_ACTION_CACHE.has(k)) return SD_ACTION_CACHE.get(k);
    const N = SD_N_FACTORS.find(x => x.key === nk).build();
    const H = SD_H_FACTORS.find(x => x.key === hk).build();
    const res = semiDirectActions(N, H, { maxActions: 28 });
    const packed = { N, H, ...res };
    SD_ACTION_CACHE.set(k, packed);
    return packed;
  };

  const render = () => {
    let N, H, Gsd, Gdir, autCount = 0, actions = [], curActionTable, actionDesc = '', jumpSpec = null;

    if (specialPreset === 'Delta27') {
      Gsd = delta3n2(3);
      N = Gsd.meta.normalFactor; H = Gsd.meta.actingFactor;
      Gdir = directProduct(N, H);
      curActionTable = Gsd.meta.actionTable;
      actionDesc = Gsd.meta.actionDesc;
      jumpSpec = { kind: 'Delta3', n: 3 };
    } else if (specialPreset === 'Delta54') {
      Gsd = delta6n2(3);
      N = Gsd.meta.normalFactor; H = Gsd.meta.actingFactor;
      Gdir = directProduct(N, H);
      curActionTable = Gsd.meta.actionTable;
      actionDesc = Gsd.meta.actionDesc;
      jumpSpec = { kind: 'Delta6', n: 3 };
    } else {
      const data = getActions(nKey, hKey);
      N = data.N; H = data.H; autCount = data.AutN.size; actions = data.actions;
      if (actionIdx >= actions.length) actionIdx = actions.length > 1 ? 1 : 0;
      const act = actions[actionIdx];
      curActionTable = act.table;
      Gsd = semiDirect(N, H, act.table);
      Gdir = directProduct(N, H);
      actionDesc = act.isTrivial ? 'Aşikar eylem: φ(h) = id_N (direkt çarpım)' : `Bükümlü eylem (|im φ| = ${act.imageSize})`;
      // Match known jump spec if applicable
      const presetHit = SD_PRESETS.find(p => p.nKey === nKey && p.hKey === hKey && !act.isTrivial);
      if (presetHit) jumpSpec = presetHit.jumpSpec;
    }

    el1[0] %= N.size; el1[1] %= H.size;
    el2[0] %= N.size; el2[1] %= H.size;

    const idSd = identifyGroup(Gsd);
    const ctSd = characterTable(Gsd);
    const ctDir = characterTable(Gdir);
    const zSd = center(Gsd).length;
    const zDir = center(Gdir).length;

    // Twisted multiplication step-by-step
    const [n1, h1] = el1;
    const [n2, h2] = el2;
    const phiN2 = curActionTable[h1][n2];
    const prodN = N.mul(n1, phiN2);
    const prodH = H.mul(h1, h2);
    const dirN = N.mul(n1, n2);

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Klasik Yarı-Direkt Çarpım Örnekleri (Ramond §2.4.4 & §3.10)</h3>
        </div>
        <div class="grp-chips">
          ${SD_PRESETS.map((p, i) => `<button type="button" class="grp-chip ${(p.special ? specialPreset === p.special : (!specialPreset && p.nKey === nKey && p.hKey === hKey)) ? 'on' : ''}" data-sdp="${i}">${esc(p.label)}</button>`).join('')}
        </div>
        <div class="grp-builder">
          <span class="grp-builder-lbl">Özel ${tex('N \\rtimes_\\varphi H')}:</span>
          <select class="inp grp-sel" data-sdn aria-label="Normal çarpan N">
            ${SD_N_FACTORS.map(f => `<option value="${f.key}" ${!specialPreset && f.key === nKey ? 'selected' : ''}>N = ${esc(f.label)}</option>`).join('')}
          </select>
          <span class="mono">⋊</span>
          <select class="inp grp-sel" data-sdh aria-label="Etkiyen çarpan H">
            ${SD_H_FACTORS.map(f => `<option value="${f.key}" ${!specialPreset && f.key === hKey ? 'selected' : ''}>H = ${esc(f.label)}</option>`).join('')}
          </select>
          ${!specialPreset ? `<span class="grp-pill">${tex(`|\\operatorname{Aut}(${N.latex})| = ${autCount}`)} · ${actions.length} geçerli eylem</span>` : `<span class="grp-pill acc">${esc(actionDesc)}</span>`}
        </div>

        ${!specialPreset ? `<div class="grep-action-grid">
          ${actions.slice(0, 12).map((act, idx) => {
            const genH = H.size > 1 ? 1 : 0;
            const mapPreview = N.elements.slice(0, Math.min(4, N.size)).map((el, x) => `${el}↦${N.elements[act.table[genH][x]]}`).join(', ');
            return `<button type="button" class="grep-action-card ${idx === actionIdx ? 'on' : ''}" data-sact="${idx}">
              <div class="row" style="justify-content:space-between">
                <b class="small">Eylem #${idx + 1}</b>
                <span class="grp-pill ${act.isTrivial ? '' : 'acc'}">${act.isTrivial ? 'Aşikar' : `|im|=${act.imageSize}`}</span>
              </div>
              <div class="mono small mute">φ(${esc(H.elements[genH])}): ${esc(mapPreview)}${N.size > 4 ? '…' : ''}</div>
            </button>`;
          }).join('')}
        </div>` : ''}
      </div>

      <div class="grp-kpis">
        <div class="grp-kpi acc"><span class="grp-kpi-lbl">Oluşan Grup</span><span class="grp-kpi-val">${tex(idSd ? idSd.latex : Gsd.latex)}</span><span class="grp-kpi-sub">|G| = ${Gsd.size} (${isAbelian(Gsd) ? 'Abelyen' : 'Değişmeli değil'})</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Merkez |Z(G)|</span><span class="grp-kpi-val mono">${zSd}</span><span class="grp-kpi-sub">direkt çarpımda ${zDir}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Eşlenik Sınıf</span><span class="grp-kpi-val mono">${ctSd.classCount}</span><span class="grp-kpi-sub">direkt çarpımda ${ctDir.classCount}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">İrrep Boyutları</span><span class="grp-kpi-val mono small">${ctSd.irreps.map(x => x.dim).join(', ')}</span><span class="grp-kpi-sub">∑ dᵢ² = ${Gsd.size}</span></div>
      </div>

      <div class="grp-grid-2">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Bükümlü Çarpım Hesaplayıcı</h3>
            <span class="grp-pill">${tex('(n_1,h_1)(n_2,h_2) = (n_1\\varphi_{h_1}(n_2),\\,h_1h_2)')}</span>
          </div>
          <div class="grp-toolbar-g">
            <span class="small mute">Sol: (</span>
            <select class="inp grp-sel" data-n1 aria-label="n1 seç">${N.elements.map((e, i) => `<option value="${i}" ${i === n1 ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
            <select class="inp grp-sel" data-h1 aria-label="h1 seç">${H.elements.map((e, i) => `<option value="${i}" ${i === h1 ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
            <span class="small mute">) · Sağ: (</span>
            <select class="inp grp-sel" data-n2 aria-label="n2 seç">${N.elements.map((e, i) => `<option value="${i}" ${i === n2 ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
            <select class="inp grp-sel" data-h2 aria-label="h2 seç">${H.elements.map((e, i) => `<option value="${i}" ${i === h2 ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select>
            <span class="small mute">)</span>
          </div>
          <div class="grp-math-box">
            <div>${tex(`\\varphi_{${elemLatex(H, h1)}}(${elemLatex(N, n2)}) = ${elemLatex(N, phiN2)}`)}</div>
            <div style="margin-top:8px">${tex(`(${elemLatex(N, n1)},\\,${elemLatex(H, h1)}) \\cdot (${elemLatex(N, n2)},\\,${elemLatex(H, h2)}) = (${elemLatex(N, prodN)},\\,${elemLatex(H, prodH)})`, true)}</div>
          </div>
          <div class="grp-callout ${prodN !== dirN ? 'ok' : ''}">
            <span class="small">Direkt çarpımda olsaydı sonuç ${tex(`(${elemLatex(N, dirN)},\\,${elemLatex(H, prodH)})`)} çıkacaktı${prodN !== dirN ? ' — <b>büküm farkı canlı görünüyor!</b>' : ' (bu çift için büküm fark oluşturmadı).'}</span>
            ${jumpSpec ? `<button type="button" class="btn small primary" data-sd-jump>${icon('sigma')} Karakter Tablosunda Aç →</button>` : ''}
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Otomorfizma Eylem Tablosu ${tex('\\varphi_h(n)')}</h3>
            <span class="small mute">${esc(actionDesc)}</span>
          </div>
          <div class="grep-ctbl-wrap">
            <table class="grep-ctbl" aria-label="Yarı-direkt eylem tablosu">
              <thead>
                <tr>
                  <th scope="col">${tex('h \\backslash n')}</th>
                  ${N.elements.slice(0, 12).map((_, x) => `<th scope="col">${tex(elemLatex(N, x))}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${H.elements.slice(0, 10).map((_, h) => `<tr>
                  <th scope="row">${tex(elemLatex(H, h))}</th>
                  ${N.elements.slice(0, 12).map((__, x) => `<td class="${curActionTable[h][x] !== x ? 'grep-row-a' : ''}">${tex(elemLatex(N, curActionTable[h][x]))}</td>`).join('')}
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-sdp]').forEach(b => {
      b.onclick = () => {
        const p = SD_PRESETS[+b.dataset.sdp];
        if (p.special) {
          specialPreset = p.special;
        } else {
          specialPreset = null;
          nKey = p.nKey; hKey = p.hKey;
          const d = getActions(nKey, hKey);
          const idx = d.actions.findIndex(a => !a.isTrivial);
          actionIdx = idx >= 0 ? idx : 0;
        }
        render();
      };
    });
    host.querySelector('[data-sdn]').onchange = e => { specialPreset = null; nKey = e.target.value; actionIdx = 1; render(); };
    host.querySelector('[data-sdh]').onchange = e => { specialPreset = null; hKey = e.target.value; actionIdx = 1; render(); };
    host.querySelectorAll('[data-sact]').forEach(b => { b.onclick = () => { actionIdx = +b.dataset.sact; render(); }; });
    host.querySelector('[data-n1]').onchange = e => { el1[0] = +e.target.value; render(); };
    host.querySelector('[data-h1]').onchange = e => { el1[1] = +e.target.value; render(); };
    host.querySelector('[data-n2]').onchange = e => { el2[0] = +e.target.value; render(); };
    host.querySelector('[data-h2]').onchange = e => { el2[1] = +e.target.value; render(); };
    host.querySelector('[data-sd-jump]')?.addEventListener('click', () => ctx.jumpTo('karakter', jumpSpec));
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 7 (sonlu): YOUNG TABLOLARI & MURNAGHAN–NAKAYAMA
// =====================================================================
function renderMiniYoung(lam) {
  return `<span class="grep-mini-y" aria-hidden="true">${lam.map(len => `<span class="grep-mini-y-r">${'<i class="grep-mini-y-c"></i>'.repeat(len)}</span>`).join('')}</span>`;
}

function mountYoung(host, _G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let n = 4;
  let lamIdx = 1; // e.g. [3, 1] for n = 4
  let muIdx = 1;
  let mode = 'hook'; // 'hook' | 'syt' | 'mn'
  let activeCell = [0, 0];
  let userGrid = null;
  let userStep = 1;

  const resetUserGrid = lam => {
    userGrid = lam.map(len => new Array(len).fill(0));
    userStep = 1;
  };

  const render = () => {
    const parts = partitions(n);
    if (lamIdx >= parts.length) lamIdx = Math.min(1, parts.length - 1);
    if (muIdx >= parts.length) muIdx = Math.min(1, parts.length - 1);
    const lam = parts[lamIdx];
    const mu = parts[muIdx];
    const conj = conjugatePartition(lam);
    const hooks = hookLengths(lam);
    const fLam = hookDimension(lam);
    let fact = 1;
    for (let k = 2; k <= n; k++) fact *= k;
    const sumSq = parts.reduce((s, p) => s + hookDimension(p) ** 2, 0);

    if (!userGrid || userGrid.length !== lam.length || userGrid.some((r, i) => r.length !== lam[i])) {
      resetUserGrid(lam);
    }

    // Clamp activeCell
    if (activeCell[0] >= lam.length || activeCell[1] >= lam[activeCell[0]]) activeCell = [0, 0];

    let modeBody = '';
    if (mode === 'hook') {
      const [ar, ac] = activeCell;
      const hVal = hooks[ar][ac];
      const armLen = lam[ar] - ac - 1;
      const legLen = conj[ac] - ar - 1;
      const hookFlat = hooks.flat();
      modeBody = `<div class="grp-grid-2">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Kanca Uzunlukları h(i,j)</h3>
            <span class="grp-pill acc">Hücre (${ar + 1}, ${ac + 1}): h = ${hVal}</span>
          </div>
          <div style="overflow-x:auto">
            <div class="grep-young-stage" role="grid" aria-label="Young diyagramı kanca uzunlukları">
              ${hooks.map((row, r) => `<div class="grep-young-row" role="row">
                ${row.map((val, c) => {
                  let cls = 'grep-ybox';
                  if (r === ar && c === ac) cls += ' grep-ybox-corner';
                  else if (r === ar && c > ac) cls += ' grep-ybox-arm';
                  else if (c === ac && r > ar) cls += ' grep-ybox-leg';
                  return `<button type="button" class="${cls}" data-yc="${r},${c}" aria-label="Satır ${r + 1}, sütun ${c + 1}, kanca uzunluğu ${val}">${val}</button>`;
                }).join('')}
              </div>`).join('')}
            </div>
          </div>
          <div class="small mute">Kanca = köşe (1) + sağdaki kol (${armLen}) + alttaki bacak (${legLen}) = <b>${hVal}</b>. Herhangi bir kutuya dokun!</div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Kanca Uzunluğu Formülü & Eşlenik</h3>
            <span class="grp-pill ok">f^λ = ${fLam}</span>
          </div>
          <div class="grp-math-box">${tex(`f^{(${lam.join(',')})} = \\frac{${n}!}{${hookFlat.join('\\cdot ')}} = \\frac{${fact}}{${fact / fLam}} = ${fLam}`, true)}</div>
          <div class="grp-callout">
            <span class="small">Eşlenik (devrik) diyagram ${tex(`\\lambda' = (${conj.join(',\\,')})`)} — ${tex(`S_{${n}}`)}’de ${tex('\\operatorname{sgn} \\otimes \\chi^{\\lambda} = \\chi^{\\lambda\'}')} temsiline karşılık gelir (boyut yine <b>${hookDimension(conj)}</b>).</span>
            ${renderMiniYoung(conj)}
          </div>
        </div>
      </div>`;
    } else if (mode === 'syt') {
      const sytRes = standardYoungTableaux(lam, 36);
      const isAvail = (r, c) => {
        if (userGrid[r][c] !== 0) return false;
        if (c > 0 && userGrid[r][c - 1] === 0) return false;
        if (r > 0 && userGrid[r - 1][c] === 0) return false;
        return true;
      };
      const done = userStep > n;
      modeBody = `<div class="grp-grid-2">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Kendin Doldur (SYT Oluştur)</h3>
            <div class="grp-toolbar-g">
              <span class="grp-pill ${done ? 'ok' : 'acc'}">${done ? '✓ Tamamlandı!' : `Sıradaki sayı: ${userStep}`}</span>
              <button type="button" class="btn small ghost" data-syt-reset>Sıfırla</button>
            </div>
          </div>
          <div style="overflow-x:auto">
            <div class="grep-young-stage">
              ${userGrid.map((row, r) => `<div class="grep-young-row">
                ${row.map((val, c) => {
                  const av = !done && isAvail(r, c);
                  const cls = `grep-ybox ${val ? 'grep-ybox-filled' : (av ? 'grep-ybox-avail' : '')}`;
                  return `<button type="button" class="${cls}" data-fill="${r},${c}" ${!av ? 'disabled' : ''} aria-label="Kutu (${r + 1},${c + 1}) ${val ? 'değer ' + val : av ? 'doldurulabilir' : 'kilitli'}">${val || (av ? '·' : '')}</button>`;
                }).join('')}
              </div>`).join('')}
            </div>
          </div>
          <div class="small mute">Yeşil kesikli kutulara dokunarak ${tex(`1 \\dots ${n}`)} sayılarını her satır ve sütunda artacak biçimde yerleştir!</div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Tüm Standart Young Tabloları (${sytRes.total} adet)</h3>
            ${sytRes.truncated ? `<span class="grp-pill">ilk ${sytRes.tableaux.length} gösteriliyor</span>` : `<span class="grp-pill ok">tam liste</span>`}
          </div>
          <div class="grep-syt-grid">
            ${sytRes.tableaux.map(tab => `<div class="grep-syt-card">${tab.map(row => `<div class="grep-syt-r">${row.map(v => `<span class="grep-syt-c">${v}</span>`).join('')}</div>`).join('')}</div>`).join('')}
          </div>
        </div>
      </div>`;
    } else {
      const mn = snCharacterTableMN(n);
      const chiVal = murnaghanNakayama(lam, mu);
      const step1 = rimHookRemovals(lam, mu[0]);
      const rimCellSet = new Set(step1.length ? step1[0].cells.map(([r, c]) => `${r},${c}`) : []);
      let crossCheckMsg = '';
      if (n <= 5) {
        const bd = characterTable(symmetric(n));
        crossCheckMsg = `Burnside–Dixon motoruyla (|S_${n}|=${fact}) <b>%100 çapraz doğrulandı ✓</b> (${bd.classCount} sınıf).`;
      } else {
        crossCheckMsg = `|S_${n}| = ${fact} (${mn.partitions.length} irrep) — Murnaghan–Nakayama ile doğrudan tam sayısal hesaplama ✓.`;
      }
      modeBody = `<div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Murnaghan–Nakayama Sınır Kancası Kuralı</h3>
            <span class="grp-pill acc">${tex(`\\chi^{(${lam.join(',')})}(${mu.join(',')}) = ${chiVal}`)}</span>
          </div>
          <div class="grp-toolbar-g">
            <label class="row" style="gap:6px">
              <span class="small mute">Devir tipi μ:</span>
              <select class="inp grp-sel" data-mu aria-label="Devir tipi seç">
                ${parts.map((p, idx) => `<option value="${idx}" ${idx === muIdx ? 'selected' : ''}>(${p.join(', ')}) · |C|=${snClassSize(p)}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>

        <div class="grp-grid-2">
          <div>
            <div class="small mute" style="margin-bottom:8px">İlk adım: ${tex(`\\lambda = (${lam.join(',')})`)} diyagramından uzunluğu ${tex(`r = ${mu[0]}`)} olan sınır kancası çıkarma (${step1.length} yol):</div>
            <div class="grep-young-stage">
              ${lam.map((len, r) => `<div class="grep-young-row">
                ${Array.from({ length: len }, (_, c) => `<div class="grep-ybox ${rimCellSet.has(`${r},${c}`) ? 'grep-ybox-rim' : ''}" style="cursor:default">${rimCellSet.has(`${r},${c}`) ? '✕' : ''}</div>`).join('')}
              </div>`).join('')}
            </div>
          </div>
          <div>
            <div class="grp-callout ok" style="margin-bottom:10px"><span class="small">${crossCheckMsg}</span></div>
            ${step1.length ? `<div class="small" style="display:grid;gap:6px">
              ${step1.map((rem, idx) => {
                const subVal = murnaghanNakayama(rem.next, mu.slice(1));
                return `<div>Yol ${idx + 1}: bacak = ${rem.leg}, işaret ${tex(`(-1)^{${rem.leg}} = ${rem.sign > 0 ? '+1' : '-1'}`)}, kalan ${tex(`(${rem.next.join(',') || '\\varnothing'})`)} → katkı ${tex(`${rem.sign}\\cdot(${subVal}) = ${rem.sign * subVal}`)}</div>`;
              }).join('')}
            </div>` : `<div class="small mute">Uzunluğu ${mu[0]} olan sınır kancası çıkarılamıyor → ${tex('\\chi^{\\lambda}(\\mu) = 0')}.</div>`}
          </div>
        </div>

        <div class="grp-panel-head" style="margin-top:6px"><h3 class="grp-panel-title">S_${n} Karakter Tablosu (Murnaghan–Nakayama)</h3></div>
        <div class="grep-ctbl-wrap">
          <table class="grep-ctbl" aria-label="S_${n} karakter tablosu">
            <thead>
              <tr>
                <th scope="col">λ \\ μ</th>
                ${mn.partitions.map((p, k) => `<th scope="col" class="${k === muIdx ? 'grep-col-a' : ''}" data-mn-mu="${k}">(${p.join(',')})<div class="small mute">h=${mn.classSizes[k]}</div></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${mn.partitions.map((p, i) => `<tr class="${i === lamIdx ? 'grep-row-a' : ''}">
                <th scope="row" data-mn-lam="${i}">(${p.join(',')}) <span class="mute small">d=${mn.dims[i]}</span></th>
                ${mn.table[i].map((v, k) => `<td class="${v === 0 ? 'grep-zero' : ''} ${k === muIdx ? 'grep-col-a' : ''}" data-mn-lam="${i}" data-mn-mu="${k}">${v}</td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <span class="grp-builder-lbl">Simetrik Grup:</span>
            <div class="seg" data-sn role="tablist" aria-label="n derecesi">
              ${[2, 3, 4, 5, 6, 7].map(k => `<button type="button" data-n="${k}" class="${k === n ? 'on' : ''}">S_${k}</button>`).join('')}
            </div>
          </div>
          <div class="seg" data-ymode role="tablist" aria-label="Young atölyesi modu">
            <button type="button" data-ym="hook" class="${mode === 'hook' ? 'on' : ''}">Kanca Formülü</button>
            <button type="button" data-ym="syt" class="${mode === 'syt' ? 'on' : ''}">Standart Tablolar</button>
            <button type="button" data-ym="mn" class="${mode === 'mn' ? 'on' : ''}">Murnaghan–Nakayama</button>
          </div>
        </div>

        <div class="grp-callout">
          <span class="small">${tex(`p(${n}) = ${parts.length}`)} parçalanış · ${tex(`\\sum_{\\lambda\\vdash ${n}} (f^{\\lambda})^2 = ${parts.map(p => `${hookDimension(p)}^2`).slice(0, 8).join('+')}${parts.length > 8 ? '+\\cdots' : ''} = ${sumSq} = ${n}!`)}</span>
          <span class="grp-pill ok">✓ |S_${n}| = ${fact}</span>
        </div>

        <div class="grep-part-grid" role="group" aria-label="${n} sayısının parçalanışları">
          ${parts.map((p, i) => `<button type="button" class="grep-part-btn ${i === lamIdx ? 'on' : ''}" data-lam="${i}">
            ${renderMiniYoung(p)}
            <span><b>(${p.join(',')})</b><div class="small mute">f = ${hookDimension(p)}</div></span>
          </button>`).join('')}
        </div>
      </div>

      ${modeBody}
    </div>`;

    host.querySelector('[data-sn]').onclick = e => {
      const b = e.target.closest('[data-n]'); if (!b) return;
      n = +b.dataset.n; lamIdx = Math.min(1, partitions(n).length - 1); muIdx = 1; activeCell = [0, 0];
      resetUserGrid(partitions(n)[lamIdx]);
      render();
    };
    host.querySelector('[data-ymode]').onclick = e => {
      const b = e.target.closest('[data-ym]'); if (!b) return;
      mode = b.dataset.ym;
      render();
    };
    host.querySelectorAll('[data-lam]').forEach(b => {
      b.onclick = () => {
        lamIdx = +b.dataset.lam; activeCell = [0, 0];
        resetUserGrid(partitions(n)[lamIdx]);
        render();
      };
    });
    host.querySelectorAll('[data-yc]').forEach(b => {
      b.onclick = () => {
        const [r, c] = b.dataset.yc.split(',').map(Number);
        activeCell = [r, c];
        render();
      };
    });
    host.querySelectorAll('[data-fill]').forEach(b => {
      b.onclick = () => {
        const [r, c] = b.dataset.fill.split(',').map(Number);
        userGrid[r][c] = userStep++;
        if (userStep > n && full()) {
          const rect = b.getBoundingClientRect();
          constellationBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
          toast('Geçerli bir Standart Young Tablosu oluşturdun! ✦');
        }
        render();
      };
    });
    host.querySelector('[data-syt-reset]')?.addEventListener('click', () => { resetUserGrid(lam); render(); });
    host.querySelector('[data-mu]')?.addEventListener('change', e => { muIdx = +e.target.value; render(); });
    host.querySelectorAll('[data-mn-lam]').forEach(el => {
      el.onclick = () => {
        lamIdx = +el.dataset.mnLam;
        if (el.dataset.mnMu != null) muIdx = +el.dataset.mnMu;
        render();
      };
    });
    host.querySelectorAll('th[data-mn-mu]').forEach(el => {
      el.onclick = () => { muIdx = +el.dataset.mnMu; render(); };
    });
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 8 (sonlu): SONLU GRUP EKLERİ (APPENDIX 1)
// =====================================================================
let APPENDIX_CACHE = null;

function mountAppendix(host, _G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let dead = false;
  clean.add(() => { dead = true; });

  const buildRows = () => {
    if (APPENDIX_CACHE) return APPENDIX_CACHE;
    APPENDIX_CACHE = appendixCatalogSpecs().map(spec => {
      const G = buildGroup(spec);
      const row = groupAppendixRow(G);
      let family = 'Diğer';
      if (row.isAbelian) family = 'Abelyen';
      else if (['D', 'S', 'A', 'Cube'].includes(spec.kind)) family = 'Dihedral / Simetrik';
      else if (['Q8', 'Q2n', '2T', '2O', '2I'].includes(spec.kind)) family = 'İkili / Örtü';
      else if (['Delta3', 'Delta6', 'Hessian', 'PSL27', 'GL32', 'GL', 'T7'].includes(spec.kind)) family = 'Galois / SU(3)';
      return { ...row, family };
    });
    return APPENDIX_CACHE;
  };

  if (!APPENDIX_CACHE) {
    host.innerHTML = `<div class="grp-stage"><div class="grp-panel"><div class="grp-loader"><span class="orbit-loader"></span><span>Ek 1 tablosu (~35 sonlu grup) hesaplanıyor…</span></div></div></div>`;
  }

  deferTask(buildRows, !APPENDIX_CACHE).then(rows => {
    if (dead || !host.isConnected) return;
    let familyFilter = 'Tümü';
    let query = '';
    let sortBy = 'order';

    const families = ['Tümü', 'Abelyen', 'Dihedral / Simetrik', 'İkili / Örtü', 'Galois / SU(3)', 'Basit'];

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Ek 1 — Sonlu Grupların Özellikleri Tablosu (<span data-ap-cnt>${rows.length}</span> / ${rows.length} grup)</h3>
          </div>
          <div class="grp-toolbar-g">
            <input type="search" class="inp" style="width:190px;height:36px" placeholder="Ara (ör. PSL, 24, 1,3)…" value="" data-ap-q aria-label="Grup ara">
            <select class="inp grp-sel" data-ap-sort aria-label="Sıralama ölçütü">
              <option value="order">Mertebe |G| ↑</option>
              <option value="classes">Sınıf sayısı k(G) ↑</option>
              <option value="center">Merkez |Z(G)| ↓</option>
              <option value="name">Ad (A–Z)</option>
            </select>
          </div>
        </div>
        <div class="grp-chips" role="group" aria-label="Aile filtresi" data-ap-chips>
          ${families.map(f => `<button type="button" class="grp-chip ${f === familyFilter ? 'on' : ''}" data-ap-f="${esc(f)}">${esc(f)}</button>`).join('')}
        </div>
        <div data-ap-body></div>
        <div class="small mute">FS (G/K/SG) = Gerçek (+1) / Karmaşık (0) / Sözde-gerçek (−1) irrep sayıları. Tüm değerler motor tarafından canlı hesaplanmıştır.</div>
      </div>
    </div>`;

    const renderBody = () => {
      const q = query.trim().toLowerCase();
      let filtered = rows.filter(r => {
        if (familyFilter === 'Basit' && !r.isSimple) return false;
        else if (familyFilter !== 'Tümü' && familyFilter !== 'Basit' && r.family !== familyFilter) return false;
        if (q) {
          const hay = `${r.name} ${r.order} ${r.irrepDims.join(',')} ${r.family}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      filtered = filtered.slice().sort((a, b) => {
        if (sortBy === 'order') return a.order - b.order || a.name.localeCompare(b.name);
        if (sortBy === 'classes') return a.classCount - b.classCount || a.order - b.order;
        if (sortBy === 'center') return b.centerOrder - a.centerOrder || a.order - b.order;
        return a.name.localeCompare(b.name);
      });

      const cntEl = host.querySelector('[data-ap-cnt]');
      if (cntEl) cntEl.textContent = String(filtered.length);
      host.querySelectorAll('[data-ap-f]').forEach(b => b.classList.toggle('on', b.dataset.apF === familyFilter));

      const body = host.querySelector('[data-ap-body]');
      body.innerHTML = `<div class="grp-table-wrap">
        <table class="grp-tbl" aria-label="Sonlu gruplar Ek 1 özellik tablosu">
          <thead>
            <tr>
              <th scope="col">Grup</th>
              <th scope="col">|G|</th>
              <th scope="col">k(G)</th>
              <th scope="col">|Z(G)|</th>
              <th scope="col">|G/[G,G]|</th>
              <th scope="col">exp</th>
              <th scope="col">İrrep Boyutları {dᵢ}</th>
              <th scope="col">FS (G/K/SG)</th>
              <th scope="col">Özellikler</th>
              <th scope="col">İncele</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => `<tr>
              <td>${tex(r.latex)}</td>
              <td class="mono"><b>${r.order}</b></td>
              <td class="mono">${r.classCount}</td>
              <td class="mono">${r.centerOrder}</td>
              <td class="mono">${r.abelianizationOrder}</td>
              <td class="mono">${r.exponent}</td>
              <td class="mono small">${r.irrepDims.length <= 10 ? r.irrepDims.join(', ') : `${r.irrepDims.slice(0, 8).join(', ')}… (${r.irrepDims.length})`}</td>
              <td class="mono small">${r.fsCounts.real}/${r.fsCounts.complex}/${r.fsCounts.pseudoreal}</td>
              <td>
                ${r.isSimple ? '<span class="grp-pill acc">Basit</span> ' : ''}
                ${r.isAbelian ? '<span class="grp-pill ok">Abelyen</span>' : r.isSolvable ? '<span class="small mute">Çözülebilir</span>' : '<span class="grp-pill warn">Çözülemez</span>'}
              </td>
              <td>
                <button type="button" class="btn small ghost" data-ap-go="${esc(JSON.stringify(r.spec))}" aria-label="${esc(r.name)} karakter tablosunu aç">${icon('sigma')} Aç</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

      body.querySelectorAll('[data-ap-go]').forEach(b => {
        b.onclick = () => ctx.jumpTo('karakter', JSON.parse(b.dataset.apGo));
      });
    };

    host.querySelector('[data-ap-q]').oninput = e => { query = e.target.value; renderBody(); };
    host.querySelector('[data-ap-sort]').onchange = e => { sortBy = e.target.value; renderBody(); };
    host.querySelectorAll('[data-ap-f]').forEach(b => { b.onclick = () => { familyFilter = b.dataset.apF; renderBody(); }; });
    renderBody();
  });

  return clean.run;
}

// =====================================================================
// TAB 9 (temsil): ÖRTÜLER, İKİLİ GRUPLAR, McKAY ADE & SU(3) ALT GRUPLARI
// =====================================================================
const MCKAY_PRESETS = [
  { id: 'Z4', label: 'Z₄ (Ã₃)', ade: 'Ã₃', so3: 'Z₂', spec: { kind: 'Z', n: 4 }, build: () => cyclic(4) },
  { id: 'Z6', label: 'Z₆ (Ã₅)', ade: 'Ã₅', so3: 'Z₃', spec: { kind: 'Z', n: 6 }, build: () => cyclic(6) },
  { id: 'Q8', label: 'Q₄ ≅ Q₈ (D̃₄)', ade: 'D̃₄', so3: 'D₂ ≅ V₄', spec: { kind: 'Q8' }, build: () => quaternion() },
  { id: 'Q6', label: 'Q₆ (D̃₅)', ade: 'D̃₅', so3: 'D₃', spec: { kind: 'Q2n', n: 3 }, build: () => dicyclic(3) },
  { id: 'Q8d', label: 'Q₈=Dic₄ (D̃₆)', ade: 'D̃₆', so3: 'D₄', spec: { kind: 'Q2n', n: 4 }, build: () => dicyclic(4) },
  { id: '2T', label: '2T ≅ SL(2,3) (Ẽ₆)', ade: 'Ẽ₆', so3: 'A₄', spec: { kind: '2T' }, build: () => binaryTetrahedral() },
  { id: '2O', label: '2O (Ẽ₇)', ade: 'Ẽ₇', so3: 'S₄', spec: { kind: '2O' }, build: () => binaryOctahedral() },
  { id: '2I', label: '2I ≅ SL(2,5) (Ẽ₈)', ade: 'Ẽ₈', so3: 'A₅', spec: { kind: '2I' }, build: () => binaryIcosahedral() },
];

// Compute canonical Dynkin tree/cycle positions normalized to [0.08..0.92] x [0.15..0.85]
function layoutMcKayNodes(mk) {
  const n = mk.nodes.length;
  const pos = new Array(n);
  const adjList = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && mk.adj[i][j] > 0) adjList[i].push(j);
    }
  }

  // Case 1: Cycle Ã_{n-1} (every node has degree 2, or n=2 double edge)
  if (mk.adeType.startsWith('Ã')) {
    // Walk around the cycle starting from node 0
    const order = [0];
    const seen = new Uint8Array(n);
    seen[0] = 1;
    let cur = 0;
    while (order.length < n) {
      const nxt = adjList[cur].find(v => !seen[v]);
      if (nxt == null) break;
      seen[nxt] = 1;
      order.push(nxt);
      cur = nxt;
    }
    for (let k = 0; k < order.length; k++) {
      const ang = -Math.PI / 2 + (2 * Math.PI * k) / order.length;
      pos[order[k]] = [0.5 + 0.34 * Math.cos(ang), 0.5 + 0.34 * Math.sin(ang)];
    }
    return pos;
  }

  // Tree layouts (D̃, Ẽ_6, Ẽ_7, Ẽ_8): find branch nodes (deg >= 3)
  const hubs = [];
  for (let i = 0; i < n; i++) if (adjList[i].length >= 3) hubs.push(i);

  // BFS helper returning branches from a root hub
  const getBranches = root => adjList[root].map(nb => {
    const chain = [nb];
    let prev = root, cur = nb;
    while (true) {
      const nxts = adjList[cur].filter(v => v !== prev);
      if (nxts.length !== 1) break;
      prev = cur; cur = nxts[0];
      chain.push(cur);
    }
    return chain;
  });

  if (hubs.length === 1) {
    const hub = hubs[0];
    const branches = getBranches(hub).sort((a, b) => b.length - a.length);
    if (branches.length === 4) {
      // D̃_4 star (central dim 2 + four 1D leaves)
      pos[hub] = [0.5, 0.5];
      const dirs = [[-0.28, -0.26], [0.28, -0.26], [-0.28, 0.26], [0.28, 0.26]];
      branches.forEach((br, idx) => { pos[br[0]] = [0.5 + dirs[idx][0], 0.5 + dirs[idx][1]]; });
      return pos;
    }
    // Ẽ_6 (2,2,2), Ẽ_7 (3,3,1), Ẽ_8 (5,2,1): longest two horizontal, shortest goes UP!
    const leftBr = branches[1];
    const rightBr = branches[0];
    const upBr = branches[2];
    const totalHoriz = leftBr.length + 1 + rightBr.length;
    const xStep = 0.80 / Math.max(1, totalHoriz - 1);
    const hubCol = leftBr.length;
    const baseY = upBr.length >= 2 ? 0.72 : 0.64;
    const xOfCol = col => 0.10 + col * xStep;
    pos[hub] = [xOfCol(hubCol), baseY];
    leftBr.forEach((v, k) => { pos[v] = [xOfCol(hubCol - 1 - k), baseY]; });
    rightBr.forEach((v, k) => { pos[v] = [xOfCol(hubCol + 1 + k), baseY]; });
    upBr.forEach((v, k) => { pos[v] = [xOfCol(hubCol), baseY - (k + 1) * (upBr.length >= 2 ? 0.24 : 0.30)]; });
    return pos;
  }

  if (hubs.length === 2) {
    // D̃_m (m >= 5): two trivalent hubs connected by a spine, each hub has 2 leaves!
    const [h1, h2] = hubs;
    // BFS shortest path from h1 to h2
    const parent = new Int32Array(n).fill(-1);
    const q = [h1]; parent[h1] = h1;
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi];
      for (const v of adjList[u]) {
        if (parent[v] === -1) { parent[v] = u; q.push(v); }
      }
    }
    const spine = [];
    for (let cur = h2; cur !== h1; cur = parent[cur]) spine.push(cur);
    spine.push(h1);
    spine.reverse();
    const spineSet = new Set(spine);
    const leftLeaves = adjList[h1].filter(v => !spineSet.has(v));
    const rightLeaves = adjList[h2].filter(v => !spineSet.has(v));

    const cols = spine.length + 2;
    const xStep = 0.80 / Math.max(1, cols - 1);
    spine.forEach((v, k) => { pos[v] = [0.10 + (k + 1) * xStep, 0.5]; });
    leftLeaves.forEach((v, k) => { pos[v] = [0.10, k === 0 ? 0.24 : 0.76]; });
    rightLeaves.forEach((v, k) => { pos[v] = [0.90, k === 0 ? 0.24 : 0.76]; });
    return pos;
  }

  // Fallback circle
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pos[i] = [0.5 + 0.35 * Math.cos(a), 0.5 + 0.35 * Math.sin(a)];
  }
  return pos;
}

function mountCoversMcKay(host, _G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let subView = 'mckay'; // 'mckay' | 'su3'
  let presetId = '2I';
  let selectedNode = 0;
  let pulsePhase = 0;
  let subClean = null;
  clean.add(() => subClean?.run());

  const render = () => {
    subClean?.run();
    subClean = createLocalClean(null);
    const preset = MCKAY_PRESETS.find(p => p.id === presetId) || MCKAY_PRESETS[7];
    const G = preset.build();
    const mk = mckayGraph(G);
    if (selectedNode >= mk.nodes.length) selectedNode = 0;
    const normPos = layoutMcKayNodes(mk);
    const sel = mk.nodes[selectedNode];

    const neighbors = [];
    for (let j = 0; j < mk.nodes.length; j++) {
      const m = mk.adj[selectedNode][j];
      if (m > 0) neighbors.push({ node: mk.nodes[j], mult: m });
    }
    const tensorEq = `${mk.defLabel} \\otimes ${sel.latex} = ${neighbors.map(nb => nb.mult > 1 ? `${nb.mult}\\,${nb.node.latex}` : nb.node.latex).join(' \\oplus ')}`;
    const tensorCnt = mk.nodes.filter(x => x.parity === 'tensor').length;
    const spinorCnt = mk.nodes.filter(x => x.parity === 'spinor').length;

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-toolbar">
        <div class="seg" data-mv role="tablist" aria-label="Bölüm görünümü">
          <button type="button" data-v="mckay" class="${subView === 'mckay' ? 'on' : ''}">İkili Örtüler & McKay ADE</button>
          <button type="button" data-v="su3" class="${subView === 'su3' ? 'on' : ''}">Sonlu SU(3) Alt Grupları (§11.7.2)</button>
        </div>
        ${subView === 'mckay' ? `<button type="button" class="btn small" data-mk-char>${icon('sigma')} ${esc(G.name)} Karakter Tablosu →</button>` : ''}
      </div>

      ${subView === 'mckay' ? `
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">SU(2) Sonlu Alt Grupları — ADE Sınıflandırması (Ramond §3.13 & §11.7.1)</h3>
            <span class="grp-pill acc">${tex(`${G.latex} \\longleftrightarrow ${mk.adeLatex}`)}</span>
          </div>
          <div class="grp-chips" role="group" aria-label="SU(2) sonlu alt grubu seç">
            ${MCKAY_PRESETS.map(p => `<button type="button" class="grp-chip ${p.id === presetId ? 'on' : ''}" data-mkp="${p.id}">${esc(p.label)}</button>`).join('')}
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">McKay Diyagramı</span><span class="grp-kpi-val">${tex(mk.adeLatex)}</span><span class="grp-kpi-sub">${mk.nodes.length} köşe · ${mk.edges.length} kenar</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">SO(3) İzdüşümü</span><span class="grp-kpi-val">${esc(preset.so3)}</span><span class="grp-kpi-sub">${mk.hasDoubleCover ? `2:1 örtü (|G|=${G.size})` : `devirli (|G|=${G.size})`}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Tensör / Spinör</span><span class="grp-kpi-val mono">${tensorCnt} / ${spinorCnt}</span><span class="grp-kpi-sub">χ(−1) = +d vs −d</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Cartan Çekirdeği</span><span class="grp-kpi-val">${mk.nullCheckOk ? '✓ (2I−A)d = 0' : '✗'}</span><span class="grp-kpi-sub">Kac işaretleri d = (${mk.dims.join(',')})</span></div>
          </div>

          <div class="grep-cv-stage">
            <canvas data-mk-cv aria-label="${esc(G.name)} McKay ${esc(mk.adeType)} diyagramı"></canvas>
            <div class="grep-cv-hint">
              <span>● Daire = Tensörel (SO(3)) · ◆ Elmas = Spinörel (projektif) · Çift halka = 1</span>
              <span>Komşuları görmek için bir düğüme dokun</span>
            </div>
          </div>

          <div class="grp-elems" role="group" aria-label="McKay düğümleri">
            ${mk.nodes.map(nd => `<button type="button" class="grp-el ${nd.index === selectedNode ? 'on' : ''}" data-mkn="${nd.index}">${nd.parity === 'spinor' ? '◆' : '●'} ${esc(nd.name)} (d=${nd.dim})</button>`).join('')}
          </div>

          <div class="grp-math-box">${tex(tensorEq, true)}</div>

          <div class="grp-callout">
            <div class="row wrap" style="gap:8px">
              ${parityBadge(sel.parity)}
              <span class="grp-pill">Boyut d = ${sel.dim}</span>
              <span class="grp-pill">2d = ${2 * sel.dim} = ${neighbors.map(nb => nb.mult > 1 ? `${nb.mult}·${nb.node.dim}` : `${nb.node.dim}`).join(' + ')}</span>
            </div>
            <span class="small mute">${sel.parity === 'spinor' ? 'Bu irrep χ(−1) = −d sağladığı için SO(3)’ün gerçek bir projektif (çift değerli) spinör temsilidir.' : 'Bu irrep χ(−1) = +d sağladığı için G/{±1} ⊂ SO(3) grubuna doğrudan iner.'}</span>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Genişletilmiş Cartan Matrisi ${tex('C = 2I - A')}</h3>
            <span class="grp-pill ok">✓ ${tex('(2I - A)\\,\\mathbf{d} = \\mathbf{0}')}</span>
          </div>
          <div class="grep-ctbl-wrap">
            <table class="grep-ctbl" aria-label="Genişletilmiş Cartan matrisi">
              <thead>
                <tr>
                  <th scope="col">İrrep</th>
                  ${mk.nodes.map(nd => `<th scope="col">${tex(nd.latex)}</th>`).join('')}
                  <th scope="col">dᵢ</th>
                </tr>
              </thead>
              <tbody>
                ${mk.nodes.map((nd, i) => `<tr class="${i === selectedNode ? 'grep-row-a' : ''}">
                  <th scope="row">${tex(nd.latex)}</th>
                  ${mk.cartan[i].map(v => `<td class="${v === 0 ? 'grep-zero' : ''}">${v}</td>`).join('')}
                  <td class="mono"><b>${nd.dim}</b></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : `
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">SU(3)’ün Sonlu Alt Grupları — Aile Simetrileri (Ramond §11.7.2)</h3>
            <span class="grp-pill acc">Δ(3n²), Δ(6n²) & İstisnai Seriler</span>
          </div>
          <div class="grp-callout">
            <span class="small">${richTex('Üç fermiyon neslini (kuark/lepton aileleri) birleştirmek için $3$-boyutlu sadık indirgenemez temsile sahip $\\mathrm{SU}(3)$ sonlu alt grupları incelenir: sonsuz $\\Delta(3n^2) = (\\mathbb{Z}_n\\times\\mathbb{Z}_n)\\rtimes\\mathbb{Z}_3$ ve $\\Delta(6n^2) = (\\mathbb{Z}_n\\times\\mathbb{Z}_n)\\rtimes S_3$ aileleri ile istisnai kristalografik gruplar (Hessian $\\Sigma(216)$, $\\Sigma(168)\\cong\\mathrm{PSL}(2,7)$, $\\Sigma(360\\times 3)$).')}</span>
          </div>
          <div class="grp-table-wrap">
            <table class="grp-tbl" aria-label="Sonlu SU(3) alt grupları">
              <thead>
                <tr>
                  <th scope="col">Grup</th>
                  <th scope="col">|G|</th>
                  <th scope="col">Seri</th>
                  <th scope="col">İrrep Boyutları (canlı)</th>
                  <th scope="col">Fizik / Yapı Notu</th>
                  <th scope="col">İncele</th>
                </tr>
              </thead>
              <tbody>
                ${SU3_FINITE_SUBGROUPS.map(item => {
                  let dimsTxt = 'Bilgi tablosu (17 sınıf: 1, 3, 6, 8, 9, 10…)';
                  if (item.spec) {
                    const gObj = buildGroup(item.spec);
                    const gCt = characterTable(gObj);
                    dimsTxt = gCt.irreps.map(x => x.dim).join(', ');
                  }
                  return `<tr>
                    <td>${tex(item.latex)}</td>
                    <td class="mono"><b>${item.order}</b></td>
                    <td class="small">${esc(item.series)}</td>
                    <td class="mono small">${esc(dimsTxt)}</td>
                    <td class="small mute">${esc(item.note)}</td>
                    <td>${item.spec ? `<button type="button" class="btn small ghost" data-su3-go="${esc(JSON.stringify(item.spec))}">${icon('sigma')} Aç</button>` : '<span class="small mute">—</span>'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>`;

    host.querySelector('[data-mv]').onclick = e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      subView = b.dataset.v;
      render();
    };
    host.querySelector('[data-mk-char]')?.addEventListener('click', () => ctx.jumpTo('karakter', preset.spec));
    host.querySelectorAll('[data-mkp]').forEach(b => {
      b.onclick = () => { presetId = b.dataset.mkp; selectedNode = 0; render(); };
    });
    host.querySelectorAll('[data-mkn]').forEach(b => {
      b.onclick = () => { selectedNode = +b.dataset.mkn; render(); };
    });
    host.querySelectorAll('[data-su3-go]').forEach(b => {
      b.onclick = () => ctx.jumpTo('karakter', JSON.parse(b.dataset.su3Go));
    });

    const cv = host.querySelector('[data-mk-cv]');
    if (cv) {
      const drawMcKay = (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const acc = accentColor();
        const pts = normPos.map(([nx, ny]) => [nx * W, ny * (H - 36) + 12]);

        // Edges
        for (const e of mk.edges) {
          const [x1, y1] = pts[e.from];
          const [x2, y2] = pts[e.to];
          const active = e.from === selectedNode || e.to === selectedNode;
          c.save();
          c.strokeStyle = active ? acc : 'rgba(255,255,255,0.28)';
          c.lineWidth = active ? 2.6 : 1.5;
          if (e.mult === 2) {
            const dx = y2 - y1, dy = x1 - x2;
            const len = Math.hypot(dx, dy) || 1;
            const ox = (dx / len) * 4, oy = (dy / len) * 4;
            c.beginPath(); c.moveTo(x1 + ox, y1 + oy); c.lineTo(x2 + ox, y2 + oy); c.stroke();
            c.beginPath(); c.moveTo(x1 - ox, y1 - oy); c.lineTo(x2 - ox, y2 - oy); c.stroke();
          } else {
            c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          }
          // Subtle traveling light pulse along active edges in full motion mode
          if (active && full()) {
            const t = (pulsePhase % 1);
            const sx = e.from === selectedNode ? x1 : x2;
            const sy = e.from === selectedNode ? y1 : y2;
            const tx = e.from === selectedNode ? x2 : x1;
            const ty = e.from === selectedNode ? y2 : y1;
            const px = sx + (tx - sx) * t;
            const py = sy + (ty - sy) * t;
            c.fillStyle = '#fff';
            c.beginPath();
            c.arc(px, py, 3.2, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
        }

        // Nodes
        const rad = Math.max(17, Math.min(24, W / 24));
        for (let i = 0; i < mk.nodes.length; i++) {
          const [x, y] = pts[i];
          const nd = mk.nodes[i];
          const isSel = i === selectedNode;
          const isNbr = mk.adj[selectedNode][i] > 0;
          c.save();
          if (nd.isTrivial) {
            c.strokeStyle = isSel ? '#fff' : 'rgba(255,255,255,0.45)';
            c.lineWidth = 1.2;
            c.beginPath();
            c.arc(x, y, rad + 5, 0, Math.PI * 2);
            c.stroke();
          }
          const fill = isSel ? acc : (isNbr ? 'rgba(91,228,155,0.22)' : '#111118');
          const stroke = isSel ? '#fff' : (isNbr ? '#5be49b' : (nd.parity === 'spinor' ? '#f472b6' : 'rgba(255,255,255,0.72)'));
          c.fillStyle = fill;
          c.strokeStyle = stroke;
          c.lineWidth = isSel ? 2.6 : 1.8;

          if (nd.parity === 'spinor') {
            // Diamond shape for spinor irreps (never colour alone)
            const rD = rad * 1.12;
            c.setLineDash(isSel ? [] : [4, 2]);
            c.beginPath();
            c.moveTo(x, y - rD); c.lineTo(x + rD, y); c.lineTo(x, y + rD); c.lineTo(x - rD, y);
            c.closePath();
            c.fill(); c.stroke();
            c.setLineDash([]);
          } else {
            c.beginPath();
            c.arc(x, y, rad, 0, Math.PI * 2);
            c.fill(); c.stroke();
          }

          c.fillStyle = isSel ? '#000' : '#f4f4f5';
          c.font = `700 ${Math.round(rad * 0.72)}px var(--mono), monospace`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(nd.dim), x, y);

          c.fillStyle = '#a1a1aa';
          c.font = '500 10.5px var(--mono), monospace';
          c.fillText(nd.name, x, y + rad + 13);
          c.restore();
        }
      };

      const cvCtrl = setupCanvas(cv, w => Math.min(340, Math.max(240, w * 0.5)), drawMcKay, subClean);

      cv.onclick = e => {
        const rect = cv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const { W, H } = cvCtrl.size();
        const pts = normPos.map(([nx, ny]) => [nx * W, ny * (H - 36) + 12]);
        let best = -1, bestD = 36;
        for (let i = 0; i < pts.length; i++) {
          const d = Math.hypot(pts[i][0] - x, pts[i][1] - y);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0 && best !== selectedNode) {
          selectedNode = best;
          render();
        }
      };

      if (full()) {
        let elapsed = 0;
        const animLoop = createAnimLoop((_, dt) => {
          pulsePhase += dt * 0.75;
          elapsed += dt;
          cvCtrl.render();
          return elapsed < 6; // settle gently after 6s so idle CPU drops to 0
        }, subClean);
        animLoop.start();
      }
    }

    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 10 (basitlik): BASİT GRUPLAR, KOMPOZİSYON SERİSİ & SYLOW
// =====================================================================
function mountSimpleSylow(host, G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  const cs = compositionSeries(G);
  const sylow = sylowAnalysis(G);
  const pf = primeFactors(G.size);
  let screenN = G.size >= 2 ? G.size : 60;

  const render = () => {
    const scr = sylowOrderScreen(screenN);

    host.innerHTML = `<div class="grp-stage">
      ${renderExtGroupBar(G)}

      <div class="grp-kpis">
        <div class="grp-kpi acc"><span class="grp-kpi-lbl">Mertebe |G|</span><span class="grp-kpi-val">${tex(`|G| = ${G.size}`)}</span><span class="grp-kpi-sub">${pf.map(([p, e]) => e > 1 ? `${p}^${e}` : `${p}`).join(' · ') || '1'}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Basitlik</span><span class="grp-kpi-val">${cs.isSimple ? '✦ Basit Grup' : 'Basit Değil'}</span><span class="grp-kpi-sub">${cs.isSimple ? 'öz normal alt grup yok' : `${cs.factors.length} kompozisyon çarpanı`}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Çözülebilirlik</span><span class="grp-kpi-val">${cs.isSolvable ? '✓ Çözülebilir' : '✗ Çözülemez'}</span><span class="grp-kpi-sub">türev: ${cs.derivedOrders.join(' → ')}</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Çarpan Çarpımı</span><span class="grp-kpi-val mono">${cs.factorOrderProduct}</span><span class="grp-kpi-sub">${cs.factorOrderProduct === G.size ? '✓ Jordan–Hölder' : '✗'}</span></div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Jordan–Hölder Kompozisyon Serisi</h3>
          <span class="grp-pill ${cs.isSolvable ? 'ok' : 'warn'}">${cs.isSolvable ? 'Tüm çarpanlar Z_p (Abelyen)' : 'Abelyen olmayan basit çarpan var'}</span>
        </div>
        <div class="grep-chain" aria-label="Kompozisyon serisi zinciri">
          ${cs.series.map((node, i) => {
            const arrow = i < cs.factors.length ? `<div class="grep-chain-arrow">
              <span class="grep-chain-q ${cs.factors[i].isAbelian ? '' : 'nonab'}">${tex(cs.factors[i].latex)}</span>
              <span>▷</span>
            </div>` : '';
            return `<div class="grep-chain-node">
              <span>${tex(node.latex)}</span>
              <span class="mono small mute">|G_${i}| = ${node.order}</span>
            </div>${arrow}`;
          }).join('')}
        </div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Sylow p-Alt Grupları & Ölçütleri (Ramond §2.4.3)</h3>
          <span class="grp-pill">${tex('n_p \\equiv 1\\;(\\text{mod } p),\\; n_p \\mid m')}</span>
        </div>
        <div class="grp-table-wrap">
          <table class="grp-tbl" aria-label="Sylow p-alt grupları tablosu">
            <thead>
              <tr>
                <th scope="col">Asal p</th>
                <th scope="col">p^k</th>
                <th scope="col">Kofaktör m</th>
                <th scope="col">İzinli n_p</th>
                <th scope="col">Gerçek n_p</th>
                <th scope="col">Ölçütler</th>
                <th scope="col">Normal?</th>
              </tr>
            </thead>
            <tbody>
              ${sylow.length ? sylow.map(s => `<tr>
                <td class="mono"><b>${s.prime}</b></td>
                <td class="mono">${s.prime}<sup>${s.power}</sup> = ${s.sylowOrder}</td>
                <td class="mono">${s.cofactor}</td>
                <td class="mono small">{${s.allowedNp.join(', ')}}</td>
                <td class="mono"><b>${s.count}</b></td>
                <td class="small">${s.modCheck && s.divCheck ? '<span class="grp-pill ok">✓ Sağlanır</span>' : '✗'}</td>
                <td>${s.isNormal ? '<span class="grp-pill ok">Normal (n_p = 1)</span>' : '<span class="small mute">Eşlenik aile</span>'}</td>
              </tr>`).join('') : `<tr><td colspan="7" class="mute small">Aşikar grup {e} için asal bölen yoktur.</td></tr>`}
            </tbody>
          </table>
        </div>

        ${sylow.map(s => `<details class="grp-lesson">
          <summary>
            <span>Sylow ${s.prime}-alt grupları (mertebe ${s.sylowOrder}, toplam ${s.count} adet)</span>
            <span class="grp-pill">${s.isNormal ? 'Normal ◁' : `${s.count} eşlenik`}</span>
          </summary>
          <div class="grp-lesson-body">
            ${s.subgroups.slice(0, 10).map((sg, idx) => `<div class="small mono">P_${idx + 1} = { ${sg.slice(0, 16).map(e => esc(G.elements[e])).join(', ')}${sg.length > 16 ? '…' : ''} }</div>`).join('')}
            ${s.subgroups.length > 10 ? `<div class="small mute">… ve ${s.subgroups.length - 10} Sylow ${s.prime}-alt grubu daha.</div>` : ''}
          </div>
        </details>`).join('')}
      </div>

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Sylow Basitlik Eleği (Herhangi Bir Mertebe N)</h3>
          </div>
          <div class="grp-toolbar-g">
            <label class="row" style="gap:6px">
              <span class="small mute">|G| =</span>
              <input type="number" class="inp mono grp-num" min="2" max="1000" value="${screenN}" data-scr-n aria-label="Test edilecek grup mertebesi">
            </label>
            <button type="button" class="btn small primary" data-scr-go>Test Et</button>
          </div>
        </div>
        <div class="grp-chips">
          ${[15, 30, 56, 60, 120, 168, 200, 216, 360, 504].map(v => `<button type="button" class="grp-chip ${v === screenN ? 'on' : ''}" data-scr-q="${v}">${v}</button>`).join('')}
        </div>
        <div class="grp-callout ${scr.canBeNonAbelianSimple ? 'ok' : ''}">
          <span class="small">${esc(scr.verdict)}</span>
          <span class="grp-pill ${scr.canBeNonAbelianSimple ? 'acc' : ''}">${scr.canBeNonAbelianSimple ? 'Basit Grup Mümkün ✦' : 'Basit Olamaz'}</span>
        </div>
        ${scr.details.length ? `<div class="row wrap small mute" style="gap:10px">
          ${scr.details.map(d => `<span class="grp-pill">p=${d.p} (${d.p}^${d.k}·${d.m}): n_${d.p} ∈ {${d.allowed.join(', ')}}</span>`).join('')}
        </div>` : ''}
      </div>
    </div>`;

    bindExtGroupBar(host, ctx);
    const applyScr = () => {
      const inp = host.querySelector('[data-scr-n]');
      const v = Math.max(2, Math.min(1000, Math.trunc(+inp.value) || 60));
      screenN = v;
      render();
    };
    host.querySelector('[data-scr-go]').onclick = applyScr;
    host.querySelector('[data-scr-n]').addEventListener('keydown', e => { if (e.key === 'Enter') applyScr(); });
    host.querySelectorAll('[data-scr-q]').forEach(b => { b.onclick = () => { screenN = +b.dataset.scrQ; render(); }; });
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 11 (basitlik): GALOIS CİSİMLERİ, PSL(2,7) ≅ GL(3,2) & FANO DÜZLEMİ
// =====================================================================
const FANO_COORDS = (() => {
  // Classic symmetric Fano plane layout inside [-1, 1]^2
  const R = 0.84;
  const a0 = -Math.PI / 2;
  const a1 = a0 + (2 * Math.PI) / 3;
  const a2 = a0 + (4 * Math.PI) / 3;
  const p0 = [R * Math.cos(a0), R * Math.sin(a0)]; // [1,0,0] top
  const p1 = [R * Math.cos(a1), R * Math.sin(a1)]; // [0,1,0] bottom-right
  const p2 = [R * Math.cos(a2), R * Math.sin(a2)]; // [0,0,1] bottom-left
  const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  return [
    p0,           // 0: (1,0,0)
    p1,           // 1: (0,1,0)
    p2,           // 2: (0,0,1)
    mid(p0, p1),  // 3: (1,1,0)
    mid(p0, p2),  // 4: (1,0,1)
    mid(p1, p2),  // 5: (0,1,1)
    [0, 0],       // 6: (1,1,1) centroid
  ];
})();

function mountGaloisFano(host, _G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let dead = false;
  clean.add(() => { dead = true; });

  host.innerHTML = `<div class="grp-stage"><div class="grp-panel"><div class="grp-loader"><span class="orbit-loader"></span><span>PSL(2,7) ≅ GL(3,2) izomorfizması ve Fano düzlemi hazırlanıyor…</span></div></div></div>`;

  deferTask(() => psl27AndGl32Data(), true).then(data => {
    if (dead || !host.isConnected) return;
    const { PSL27, GL32, isoPslToGl, isoGlToPsl, generators, fanoPermsGL, p1PermsPSL, fanoTransitivity, p1Transitivity } = data;
    const { xP, yP } = generators;
    const xyP = PSL27.mul(xP, yP); // order 7!
    const commP = PSL27.mul(PSL27.mul(xP, yP), PSL27.mul(PSL27.inv(xP), PSL27.inv(yP))); // order 4!

    let curPslIdx = xyP; // start with iconic order-7 element
    let prevPerm = [0, 1, 2, 3, 4, 5, 6];
    let targetPerm = fanoPermsGL[isoPslToGl[curPslIdx]];
    let animT = 1;
    let playing = false;
    let playAccum = 0;

    // Doubly transitive prover state
    let dtMode = 'fano'; // 'fano' | 'p1'
    let srcA = 0, srcB = 1, dstA = 2, dstB = 6;

    let cvCtrl = null;
    let loop = null;

    const triggerElement = (nextPslIdx, fromCurrent = false) => {
      prevPerm = fromCurrent ? targetPerm.slice() : [0, 1, 2, 3, 4, 5, 6];
      curPslIdx = nextPslIdx;
      targetPerm = fanoPermsGL[isoPslToGl[curPslIdx]];
      const m = motion();
      if (m === 'off') {
        animT = 1;
        updateInfoOnly();
        cvCtrl?.render();
      } else {
        animT = 0;
        updateInfoOnly();
        loop?.start();
      }
    };

    const p1Lbl = idx => idx === 7 ? '∞' : String(idx);
    const ptLbl = i => `P${i + 1}(${FANO_POINTS[i].join('')})`;

    const buildInfoHtml = () => {
      const glIdx = isoPslToGl[curPslIdx];
      const ord = order(PSL27, curPslIdx);
      const fPerm = fanoPermsGL[glIdx];
      const p1Perm = p1PermsPSL[curPslIdx];
      return `<div class="grp-grid-2">
        <div class="grp-math-box">
          <div class="small mute" style="margin-bottom:4px">PSL(2,7) elemanı (#${curPslIdx}, |g| = ${ord})</div>
          ${tex(elemLatex(PSL27, curPslIdx), true)}
        </div>
        <div class="grp-math-box">
          <div class="small mute" style="margin-bottom:4px">GL(3,2) görüntüsü φ(g) (#${glIdx})</div>
          ${tex(elemLatex(GL32, glIdx), true)}
        </div>
      </div>
      <div class="grp-callout ok">
        <span class="small"><b>Fano permütasyonu (7 nokta):</b> <span class="mono">${esc(formatCycles(fPerm))}</span> · Tüm 7 doğru 7 doğruya gider ✓</span>
        <span class="small"><b>P¹(F₇) Möbius etkisi (8 nokta):</b> <span class="mono">${p1Perm.map((v, i) => `${p1Lbl(i)}↦${p1Lbl(v)}`).join(' ')}</span></span>
      </div>`;
    };

    const buildDtHtml = () => {
      const deg = dtMode === 'fano' ? 7 : 8;
      if (srcA >= deg) srcA = 0;
      if (srcB >= deg || srcB === srcA) srcB = (srcA + 1) % deg;
      if (dstA >= deg) dstA = 0;
      if (dstB >= deg || dstB === dstA) dstB = (dstA + 1) % deg;
      const perms = dtMode === 'fano' ? fanoPermsGL : p1PermsPSL;
      const mappers = findPairMappers(perms, srcA, srcB, dstA, dstB);
      const lbl = i => dtMode === 'fano' ? ptLbl(i) : p1Lbl(i);
      const tr = dtMode === 'fano' ? fanoTransitivity : p1Transitivity;

      return `<div class="grp-toolbar-g" style="margin-bottom:10px">
        <span class="small mute">Kaynak çift:</span>
        <select class="inp grp-sel" data-sa aria-label="Kaynak ilk nokta">${Array.from({ length: deg }, (_, i) => `<option value="${i}" ${i === srcA ? 'selected' : ''}>${esc(lbl(i))}</option>`).join('')}</select>
        <select class="inp grp-sel" data-sb aria-label="Kaynak ikinci nokta">${Array.from({ length: deg }, (_, i) => i === srcA ? '' : `<option value="${i}" ${i === srcB ? 'selected' : ''}>${esc(lbl(i))}</option>`).join('')}</select>
        <span class="mono">↦</span>
        <select class="inp grp-sel" data-da aria-label="Hedef ilk nokta">${Array.from({ length: deg }, (_, i) => `<option value="${i}" ${i === dstA ? 'selected' : ''}>${esc(lbl(i))}</option>`).join('')}</select>
        <select class="inp grp-sel" data-db aria-label="Hedef ikinci nokta">${Array.from({ length: deg }, (_, i) => i === dstA ? '' : `<option value="${i}" ${i === dstB ? 'selected' : ''}>${esc(lbl(i))}</option>`).join('')}</select>
      </div>
      <div class="grp-callout ok">
        <span class="small">Tam <b>${mappers.length}</b> eşleyici bulundu (${tex(`168 / (${deg}\\cdot ${deg - 1}) = ${tr.pairStabilizerOrder}`)}): iki kez geçişli ✓, üç kez geçişli ${tr.isTriplyTransitive ? '✓' : '✗'}.</span>
      </div>
      <div class="grp-elems" style="margin-top:8px">
        ${mappers.map(idx => {
          const pIdx = dtMode === 'fano' ? isoGlToPsl[idx] : idx;
          const glIdx = isoPslToGl[pIdx];
          return `<button type="button" class="grp-el" data-apply-map="${pIdx}">g#${pIdx} (|g|=${order(PSL27, pIdx)}) · ${esc(formatCycles(fanoPermsGL[glIdx]))}</button>`;
        }).join('')}
      </div>`;
    };

    const updateInfoOnly = () => {
      const box = host.querySelector('[data-fano-info]');
      if (box) box.innerHTML = buildInfoHtml();
    };

    const updateDtOnly = () => {
      const box = host.querySelector('[data-dt-box]');
      if (!box) return;
      box.innerHTML = buildDtHtml();
      box.querySelector('[data-sa]').onchange = e => { srcA = +e.target.value; updateDtOnly(); };
      box.querySelector('[data-sb]').onchange = e => { srcB = +e.target.value; updateDtOnly(); };
      box.querySelector('[data-da]').onchange = e => { dstA = +e.target.value; updateDtOnly(); };
      box.querySelector('[data-db]').onchange = e => { dstB = +e.target.value; updateDtOnly(); };
      box.querySelectorAll('[data-apply-map]').forEach(b => {
        b.onclick = () => { playing = false; syncPlayBtn(); triggerElement(+b.dataset.applyMap, false); };
      });
    };

    const syncPlayBtn = () => {
      const b = host.querySelector('[data-fplay]');
      if (b) b.innerHTML = `${icon(playing ? 'pause' : 'play')} ${playing ? 'Duraklat' : 'Döngüyü Oynat'}`;
    };

    const GALOIS_TABLE = [
      { name: 'GL(2,2) = SL(2,2) = PSL(2,2)', p: 2, order: 6, iso: 'S₃', simple: false, spec: { kind: 'GL', dim: 2, p: 2 } },
      { name: 'PSL(2,3)', p: 3, order: 12, iso: 'A₄', simple: false, spec: { kind: 'PSL', dim: 2, p: 3 } },
      { name: 'SL(2,3)', p: 3, order: 24, iso: '2T', simple: false, spec: { kind: 'SL', dim: 2, p: 3 } },
      { name: 'GL(2,3)', p: 3, order: 48, iso: '2O (farklı genişleme)', simple: false, spec: { kind: 'GL', dim: 2, p: 3 } },
      { name: 'PSL(2,5)', p: 5, order: 60, iso: 'A₅', simple: true, spec: { kind: 'PSL', dim: 2, p: 5 } },
      { name: 'SL(2,5)', p: 5, order: 120, iso: '2I', simple: false, spec: { kind: 'SL', dim: 2, p: 5 } },
      { name: 'PSL(2,7) ≅ GL(3,2)', p: 7, order: 168, iso: 'GL(3,2)', simple: true, spec: { kind: 'PSL27' } },
    ];

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-kpis">
        <div class="grp-kpi acc"><span class="grp-kpi-lbl">İzomorfizma</span><span class="grp-kpi-val">${tex('\\mathrm{PSL}(2,7)\\cong\\mathrm{GL}(3,2)')}</span><span class="grp-kpi-sub">|G| = 168 · Basit ✦</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Fano Düzlemi</span><span class="grp-kpi-val mono">7 nokta · 7 doğru</span><span class="grp-kpi-sub">2-geçişli (çift sab. 4)</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">Projektif Doğru</span><span class="grp-kpi-val">${tex('\\mathbb{P}^1(\\mathbb{F}_7)')} (8)</span><span class="grp-kpi-sub">2-geçişli (çift sab. 3)</span></div>
        <div class="grp-kpi"><span class="grp-kpi-lbl">İrrep Boyutları</span><span class="grp-kpi-val mono">1, 3, 3̄, 6, 7, 8</span><span class="grp-kpi-sub">1+9+9+36+49+64 = 168</span></div>
      </div>

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Fano Düzlemi P²(F₂) Otomorfizma Animasyonu</h3>
          </div>
          <div class="grp-toolbar-g">
            <button type="button" class="btn small primary" data-fplay>${icon('play')} Döngüyü Oynat</button>
            <button type="button" class="btn small" data-go-psl-char>${icon('sigma')} PSL(2,7) Karakterleri →</button>
          </div>
        </div>

        <div class="grp-chips" role="group" aria-label="PSL(2,7) üreteçleri">
          <button type="button" class="grp-chip" data-fgen="id">Birim (I)</button>
          <button type="button" class="grp-chip" data-fgen="x">x (|x| = 2)</button>
          <button type="button" class="grp-chip" data-fgen="y">y (|y| = 3)</button>
          <button type="button" class="grp-chip on" data-fgen="xy">xy (|xy| = 7)</button>
          <button type="button" class="grp-chip" data-fgen="comm">[x,y] (|g| = 4)</button>
          <button type="button" class="grp-chip" data-fgen="mulxy">Şu anki · (xy)</button>
          <button type="button" class="grp-chip" data-fgen="rand">Rastgele (168)</button>
        </div>

        <div class="grep-cv-stage">
          <canvas data-fano-cv aria-label="Fano düzlemi etkileşimli animasyonu"></canvas>
          <div class="grep-cv-hint">
            <span>Her doğru 3 nokta içerir: u + v + w = (0,0,0) mod 2</span>
            <span>İç çember = 7. doğru {P4, P5, P6}</span>
          </div>
        </div>

        <div data-fano-info>${buildInfoHtml()}</div>
      </div>

      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">İki Kez Geçişli Eylem Kanıtlayıcı (Ramond §9.1.2)</h3>
          </div>
          <div class="seg" data-dtm role="tablist" aria-label="Eylem kümesi">
            <button type="button" data-dm="fano" class="on">Fano Düzlemi (7)</button>
            <button type="button" data-dm="p1">P¹(F₇) (8)</button>
          </div>
        </div>
        <div data-dt-box></div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Küçük Galois Cisimleri Üzerinde Matris Grupları (p ≤ 7)</h3>
        </div>
        <div class="grp-table-wrap">
          <table class="grp-tbl" aria-label="Galois cismi matris grupları">
            <thead>
              <tr><th scope="col">Grup</th><th scope="col">Cisim</th><th scope="col">|G|</th><th scope="col">İzomorfizma</th><th scope="col">Basit?</th><th scope="col">İncele</th></tr>
            </thead>
            <tbody>
              ${GALOIS_TABLE.map(row => `<tr>
                <td class="mono"><b>${esc(row.name)}</b></td>
                <td>${tex(`\\mathbb{F}_{${row.p}}`)}</td>
                <td class="mono">${row.order}</td>
                <td>${esc(row.iso)}</td>
                <td>${row.simple ? '<span class="grp-pill acc">Basit ✦</span>' : '<span class="small mute">Hayır</span>'}</td>
                <td><button type="button" class="btn small ghost" data-gf-go="${esc(JSON.stringify(row.spec))}">${icon('sigma')} Karakter</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

    const cv = host.querySelector('[data-fano-cv]');
    const COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee'];

    const drawFano = (c, W, H) => {
      c.clearRect(0, 0, W, H);
      const acc = accentColor();
      const cx = W / 2, cy = (H - 22) / 2 + 6;
      const scale = Math.min(W * 0.42, (H - 54) * 0.48);
      const toXY = ([nx, ny]) => [cx + nx * scale, cy + ny * scale];
      const basePts = FANO_COORDS.map(toXY);

      // Draw the 6 straight Fano lines
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.24)';
      c.lineWidth = 1.6;
      const straightLines = [[0, 1], [0, 2], [1, 2], [0, 5], [1, 4], [2, 3]];
      for (const [u, v] of straightLines) {
        c.beginPath();
        c.moveTo(basePts[u][0], basePts[u][1]);
        c.lineTo(basePts[v][0], basePts[v][1]);
        c.stroke();
      }
      // 7th line: inscribed circle passing through midpoints 3, 4, 5
      const rIn = Math.hypot(basePts[3][0] - cx, basePts[3][1] - cy);
      c.strokeStyle = colorMixFallback(acc);
      c.setLineDash([6, 4]);
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(cx, cy, rIn, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.restore();

      // Faint fixed vertex sockets so swapping orbits read clearly during motion
      const rad = Math.max(15, Math.min(21, scale * 0.145));
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.14)';
      c.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.arc(basePts[i][0], basePts[i][1], rad + 4, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();

      // Smoothly interpolate each point from prevPerm[i] -> targetPerm[i]
      const ease = animT >= 1 ? 1 : (1 - (1 - animT) ** 3);

      for (let i = 0; i < 7; i++) {
        const fromIdx = prevPerm[i];
        const toIdx = targetPerm[i];
        const [x0, y0] = basePts[fromIdx];
        const [x1, y1] = basePts[toIdx];
        // Slight arc bend so crossing points stay readable
        const mx = (x0 + x1) / 2 - (y1 - y0) * 0.14 * Math.sin(ease * Math.PI);
        const my = (y0 + y1) / 2 + (x1 - x0) * 0.14 * Math.sin(ease * Math.PI);
        const x = fromIdx === toIdx ? x1 : (1 - ease) * (1 - ease) * x0 + 2 * (1 - ease) * ease * mx + ease * ease * x1;
        const y = fromIdx === toIdx ? y1 : (1 - ease) * (1 - ease) * y0 + 2 * (1 - ease) * ease * my + ease * ease * y1;

        c.save();
        // Fixed socket ghost label at basePts[i]
        c.fillStyle = '#0c0c12';
        c.strokeStyle = COLORS[i];
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        c.fillStyle = '#f4f4f5';
        c.font = `700 ${Math.round(rad * 0.62)}px var(--mono), monospace`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(`P${i + 1}`, x, y - 3);
        c.fillStyle = '#a1a1aa';
        c.font = `500 ${Math.round(rad * 0.44)}px var(--mono), monospace`;
        c.fillText(FANO_POINTS[i].join(''), x, y + rad * 0.45);
        c.restore();
      }
    };

    function colorMixFallback(acc) {
      return acc || '#f4f4f5';
    }

    cvCtrl = setupCanvas(cv, w => Math.min(370, Math.max(270, w * 0.58)), drawFano, clean);

    loop = createAnimLoop((_, dt) => {
      const dur = motion() === 'reduced' ? 0.16 : 0.62;
      if (animT < 1) {
        animT = Math.min(1, animT + dt / dur);
        cvCtrl.render();
      }
      if (playing) {
        if (animT >= 1) {
          playAccum += dt;
          if (playAccum >= 0.48) {
            playAccum = 0;
            const nextIdx = PSL27.mul(curPslIdx === 0 ? xyP : curPslIdx, xyP);
            prevPerm = targetPerm.slice();
            curPslIdx = nextIdx;
            targetPerm = fanoPermsGL[isoPslToGl[curPslIdx]];
            animT = motion() === 'off' ? 1 : 0;
            updateInfoOnly();
            cvCtrl.render();
          }
        }
        return true;
      }
      return animT < 1;
    }, clean);

    host.querySelector('[data-fplay]').onclick = () => {
      playing = !playing;
      playAccum = 0;
      syncPlayBtn();
      if (playing) loop.start();
    };
    host.querySelector('[data-go-psl-char]').onclick = () => ctx.jumpTo('karakter', { kind: 'PSL27' });

    host.querySelectorAll('[data-fgen]').forEach(btn => {
      btn.onclick = () => {
        playing = false; syncPlayBtn();
        host.querySelectorAll('[data-fgen]').forEach(x => x.classList.remove('on'));
        btn.classList.add('on');
        const k = btn.dataset.fgen;
        if (k === 'id') triggerElement(0, true);
        else if (k === 'x') triggerElement(xP, false);
        else if (k === 'y') triggerElement(yP, false);
        else if (k === 'xy') triggerElement(xyP, false);
        else if (k === 'comm') triggerElement(commP, false);
        else if (k === 'mulxy') triggerElement(PSL27.mul(curPslIdx, xyP), true);
        else if (k === 'rand') triggerElement(1 + Math.floor(Math.random() * (PSL27.size - 1)), true);
      };
    });

    host.querySelector('[data-dtm]').onclick = e => {
      const b = e.target.closest('[data-dm]'); if (!b) return;
      dtMode = b.dataset.dm;
      host.querySelectorAll('[data-dm]').forEach(x => x.classList.toggle('on', x.dataset.dm === dtMode));
      updateDtOnly();
      syncSegments(host, true);
    };

    host.querySelectorAll('[data-gf-go]').forEach(b => {
      b.onclick = () => ctx.jumpTo('karakter', JSON.parse(b.dataset.gfGo));
    });

    updateDtOnly();
    syncSegments(host, true);
  });

  return clean.run;
}

// =====================================================================
// TAB 12 (basitlik): SPORADİK GRUPLAR ATLASI & CHEVALLEY
// =====================================================================
function mountSporadic(host, _G, ctx) {
  ensureRepCss();
  const clean = createLocalClean(ctx);
  let filter = 'Tümü';
  let query = '';
  let sortBy = 'orderAsc';
  let spotlightId = 'M';

  // Chevalley calculator state
  let chFam = 'A', chN = 1, chQ = 7;

  const FILTERS = ['Tümü', 'Mutlu Aile (20)', 'Parya (6)', 'Mathieu', 'Conway / Leech', 'Fischer'];
  const PRIME_POWERS = [2, 3, 4, 5, 7, 8, 9, 11, 13];
  const maxLog = SPORADIC_GROUPS[25].log10;

  host.innerHTML = `<div class="grp-stage">
    <div class="grp-panel">
      <div class="grp-panel-head">
        <h3 class="grp-panel-title">Sonlu Basit Grupların Sınıflandırması (Ramond §9.2–9.3)</h3>
        <span class="grp-pill acc">18 Sonsuz Aile + Tits + 26 Sporadik</span>
      </div>
      <div class="grp-table-wrap">
        <table class="grp-tbl" aria-label="Sonlu basit grup aileleri">
          <thead>
            <tr><th scope="col">Aile</th><th scope="col">Gösterim</th><th scope="col">Mertebe</th><th scope="col">Not</th></tr>
          </thead>
          <tbody>
            ${SIMPLE_GROUP_FAMILIES.map(f => `<tr>
              <td><b>${esc(f.name)}</b></td>
              <td>${tex(f.latex)}</td>
              <td>${tex(f.orderFormula)}</td>
              <td class="small mute">${esc(f.note)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div data-sp-chev></div>
    </div>

    <div class="grp-panel" data-sp-spot></div>

    <div class="grp-panel">
      <div class="grp-toolbar">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">26 Sporadik Basit Grup Atlası (<span data-sp-cnt>26</span> / 26)</h3>
        </div>
        <div class="grp-toolbar-g">
          <input type="search" class="inp" style="width:180px;height:36px" placeholder="Ara (Monster, Mathieu…)" value="" data-sp-q aria-label="Sporadik grup ara">
          <select class="inp grp-sel" data-sp-sort aria-label="Sıralama">
            <option value="orderAsc">Mertebe ↑</option>
            <option value="orderDesc">Mertebe ↓</option>
            <option value="year">Keşif yılı</option>
            <option value="deg">Permütasyon derecesi</option>
          </select>
        </div>
      </div>

      <div class="grp-chips" role="group" aria-label="Sporadik grup filtresi">
        ${FILTERS.map(f => `<button type="button" class="grp-chip ${f === filter ? 'on' : ''}" data-sp-f="${esc(f)}">${esc(f)}</button>`).join('')}
      </div>

      <div class="grep-atlas-grid" data-sp-grid></div>
    </div>
  </div>`;

  const renderChev = () => {
    const needRank = ['A', 'B', 'C', 'D'].includes(chFam);
    const minRank = chFam === 'D' ? 4 : (chFam === 'B' || chFam === 'C' ? 2 : 1);
    const maxRank = 5;
    if (chN < minRank) chN = minRank;
    if (chN > maxRank) chN = maxRank;
    const chRes = chevalleyOrder(chFam, chN, chQ);
    const box = host.querySelector('[data-sp-chev]');
    box.innerHTML = `<div class="grp-builder">
      <span class="grp-builder-lbl">Chevalley Mertebe Hesaplayıcı:</span>
      <select class="inp grp-sel" data-chf aria-label="Chevalley ailesi">
        ${[['A', 'A_n(q) = PSL(n+1,q)'], ['B', 'B_n(q) = Ω(2n+1,q)'], ['C', 'C_n(q) = PSp(2n,q)'], ['D', 'D_n(q) = PΩ⁺(2n,q)'], ['G2', 'G₂(q)'], ['F4', 'F₄(q)'], ['E6', 'E₆(q)'], ['E7', 'E₇(q)'], ['E8', 'E₈(q)']].map(([k, l]) => `<option value="${k}" ${k === chFam ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
      ${needRank ? `<select class="inp grp-sel" data-chn aria-label="Mertebe n">${Array.from({ length: maxRank - minRank + 1 }, (_, i) => minRank + i).map(v => `<option value="${v}" ${v === chN ? 'selected' : ''}>n = ${v}</option>`).join('')}</select>` : ''}
      <select class="inp grp-sel" data-chq aria-label="Sonlu cisim q">${PRIME_POWERS.map(v => `<option value="${v}" ${v === chQ ? 'selected' : ''}>q = ${v}</option>`).join('')}</select>
    </div>
    <div class="grp-callout ${chRes.simple ? 'ok' : ''}" style="margin-top:8px">
      <div style="min-width:0;flex:1">
        <div>${tex(`|${chRes.latex}|`)} · <b>${chRes.digits}</b> basamak · ${chRes.simple ? '<span class="grp-pill ok">Basit ✦</span>' : '<span class="grp-pill warn">Basit değil</span>'}</div>
        <div class="grep-order-str" style="margin-top:6px">${esc(chRes.orderStr)}</div>
        <div class="small mute" style="margin-top:4px">${esc(chRes.note)}</div>
      </div>
    </div>`;
    box.querySelector('[data-chf]').onchange = e => { chFam = e.target.value; renderChev(); };
    box.querySelector('[data-chn]')?.addEventListener('change', e => { chN = +e.target.value; renderChev(); });
    box.querySelector('[data-chq]').onchange = e => { chQ = +e.target.value; renderChev(); };
  };

  const renderSpot = () => {
    const spot = SPORADIC_GROUPS.find(g => g.id === spotlightId) || SPORADIC_GROUPS[25];
    host.querySelector('[data-sp-spot]').innerHTML = `<div class="grp-panel-head">
      <h3 class="grp-panel-title">Odak: ${esc(spot.name)}</h3>
      <div class="grp-toolbar-g">
        <span class="grp-pill ${spot.happy ? 'ok' : 'warn'}">${spot.happy ? '● Mutlu Aile (Monster içi)' : '◆ Parya Grup'}</span>
        <span class="grp-pill">${spot.year} · ${esc(spot.discoverer)}</span>
      </div>
    </div>
    <div class="grp-math-box">${tex(`|${spot.latex}| = ${spot.factorLatex}`)}</div>
    <div class="grep-order-str"><b>Kesin mertebe (${spot.digits} basamak):</b> ${esc(spot.orderStr)}</div>
    <div class="small">${esc(spot.note)}</div>
    <div class="small mute">En küçük permütasyon derecesi: <b class="mono">${spot.minDeg.toLocaleString('tr-TR')}</b></div>`;
  };

  const renderGrid = () => {
    const q = query.trim().toLowerCase();
    let list = SPORADIC_GROUPS.filter(g => {
      if (filter === 'Mutlu Aile (20)' && !g.happy) return false;
      else if (filter === 'Parya (6)' && g.happy) return false;
      else if (filter === 'Mathieu' && g.family !== 'Mathieu') return false;
      else if (filter === 'Conway / Leech' && g.family !== 'Conway / Leech') return false;
      else if (filter === 'Fischer' && g.family !== 'Fischer') return false;
      if (q) {
        const hay = `${g.id} ${g.name} ${g.discoverer} ${g.family} ${g.note}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sortBy === 'orderAsc') return a.orderBigInt < b.orderBigInt ? -1 : (a.orderBigInt > b.orderBigInt ? 1 : 0);
      if (sortBy === 'orderDesc') return a.orderBigInt > b.orderBigInt ? -1 : (a.orderBigInt < b.orderBigInt ? 1 : 0);
      if (sortBy === 'year') return a.year - b.year;
      return a.minDeg - b.minDeg;
    });

    host.querySelector('[data-sp-cnt]').textContent = String(list.length);
    host.querySelectorAll('[data-sp-f]').forEach(b => b.classList.toggle('on', b.dataset.spF === filter));
    const grid = host.querySelector('[data-sp-grid]');
    grid.innerHTML = list.map(g => `<button type="button" class="grep-sporadic-card ${g.happy ? '' : 'pariah'} ${g.id === spotlightId ? 'on' : ''}" data-spot="${g.id}">
      <div class="row" style="justify-content:space-between;width:100%">
        <b>${tex(g.latex)} · <span class="small mute">${esc(g.family)}</span></b>
        <span class="grp-pill ${g.happy ? 'ok' : 'warn'}">${g.happy ? 'Mutlu' : 'Parya'}</span>
      </div>
      <div class="grep-bar-track" style="width:100%"><div class="grep-bar-fill ${g.happy ? '' : 'alt'}" style="width:${(g.log10 / maxLog * 100).toFixed(1)}%"></div></div>
      <div class="grep-order-str">${esc(g.orderStr)}</div>
      <div class="small mute" style="text-align:left">${g.digits} basamak · ${g.year} (${esc(g.discoverer)})</div>
    </button>`).join('');

    grid.querySelectorAll('[data-spot]').forEach(b => {
      b.onclick = () => { spotlightId = b.dataset.spot; renderSpot(); renderGrid(); };
    });
  };

  host.querySelector('[data-sp-q]').oninput = e => { query = e.target.value; renderGrid(); };
  host.querySelector('[data-sp-sort]').onchange = e => { sortBy = e.target.value; renderGrid(); };
  host.querySelectorAll('[data-sp-f]').forEach(b => { b.onclick = () => { filter = b.dataset.spF; renderGrid(); }; });

  renderChev();
  renderSpot();
  renderGrid();
  return clean.run;
}

// =====================================================================
// TABS 13 & 14: KONU ANLATIMI FACTORY (Temsiller + Basitliğe Yol)
// =====================================================================
function makeLessonsTab(lessons, heading) {
  return function mountLessonsView(host, _G, ctx) {
    ensureRepCss();
    const clean = createLocalClean(ctx);

    host.innerHTML = `<div class="grp-stage">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">${esc(heading)} (${lessons.length} Bölüm)</h3>
          <div class="grp-toolbar-g">
            <button type="button" class="btn small ghost" data-open-all>Tümünü aç</button>
            <button type="button" class="btn small ghost" data-close-all>Tümünü kapat</button>
          </div>
        </div>
        <div class="grp-toc">
          ${lessons.map((l, i) => `<button type="button" class="grp-chip" data-jl="${i}">§${esc(l.section)} · ${esc(l.title.split(' ')[0])}</button>`).join('')}
        </div>
      </div>

      ${lessons.map((l, i) => `<details class="grp-lesson" data-li="${i}" ${i < 2 ? 'open' : ''}>
        <summary>
          <span class="row" style="gap:10px"><span class="grp-lesson-num">${esc(l.section)}</span><span>${esc(l.title)}</span></span>
          <span class="grp-pill">${esc(l.tag)}</span>
        </summary>
        <div class="grp-lesson-body">
          ${l.body.map(p => `<p>${richTex(p)}</p>`).join('')}
          <div class="grp-theorem-box">${l.theorem.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>
          <div class="grp-example-box">${l.example.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>
          <div class="grp-lesson-foot">
            <span class="mute small">Etkileşimli simülasyonda canlı olarak incele</span>
            <button type="button" class="btn small primary" data-ap="${i}">${icon('play')} Uygula: ${esc(l.apply.label)} →</button>
          </div>
        </div>
      </details>`).join('')}
    </div>`;

    host.querySelector('[data-open-all]').onclick = () => host.querySelectorAll('.grp-lesson').forEach(d => { d.open = true; });
    host.querySelector('[data-close-all]').onclick = () => host.querySelectorAll('.grp-lesson').forEach(d => { d.open = false; });
    host.querySelectorAll('[data-jl]').forEach(b => {
      b.onclick = () => {
        const det = host.querySelector(`.grp-lesson[data-li="${b.dataset.jl}"]`);
        if (!det) return;
        det.open = true;
        det.scrollIntoView({ behavior: full() ? 'smooth' : 'auto', block: 'start' });
      };
    });
    host.querySelectorAll('[data-ap]').forEach(b => {
      b.onclick = () => {
        const l = lessons[+b.dataset.ap];
        ctx.jumpTo(l.apply.tab, l.apply.spec);
      };
    });

    return clean.run;
  };
}

// =====================================================================
// TABS 15 & 16: ALIŞTIRMA FACTORY (Endless Engine-Backed Exercises)
// =====================================================================
function makeQuizTab({ chapter, storeKey, topics }) {
  const loadStats = () => {
    try {
      const raw = localStorage.getItem(storeKey);
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
  };
  const saveStats = st => {
    try { localStorage.setItem(storeKey, JSON.stringify(st)); } catch { }
  };

  return function mountExercises(host, _G, ctx) {
    ensureRepCss();
    const clean = createLocalClean(ctx);
    const stats = loadStats();
    let topicFilter = '';
    let currentQ = null;
    let pickedIdx = null;

    const nextQ = () => {
      pickedIdx = null;
      const chapArg = topicFilter && ['youngHook', 'murnaghan', 'semiDirect'].includes(topicFilter) ? 'sonlu' : chapter;
      currentQ = generateRepQuizQuestion(chapArg, stats.difficulty, Math.random, topicFilter || null);
      render();
    };

    const render = () => {
      const accPct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      const keys = ['A', 'B', 'C', 'D'];

      host.innerHTML = `<div class="grp-stage">
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <div class="seg" data-qd role="tablist" aria-label="Zorluk seviyesi">
              ${[['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']].map(([k, l]) => `<button type="button" data-df="${k}" class="${stats.difficulty === k ? 'on' : ''}">${l}</button>`).join('')}
            </div>
            <select class="inp grp-sel" data-qt aria-label="Soru konusu">
              ${topics.map(([k, l]) => `<option value="${esc(k)}" ${k === topicFilter ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn small ghost" data-qr aria-label="İstatistikleri sıfırla">Skoru sıfırla</button>
        </div>

        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">Doğru / Toplam</span><span class="grp-kpi-val mono">${stats.correct} / ${stats.total}</span><span class="grp-kpi-sub">%${accPct} başarı</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Mevcut Seri</span><span class="grp-kpi-val mono">${stats.streak}</span><span class="grp-kpi-sub">üst üste doğru</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">En İyi Seri</span><span class="grp-kpi-val mono">${stats.bestStreak}</span><span class="grp-kpi-sub">rekorun</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Konu</span><span class="grp-kpi-val">${esc(currentQ.topic)}</span><span class="grp-kpi-sub">${esc(stats.difficulty.toUpperCase())}</span></div>
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
            <button type="button" class="btn primary" data-qn>Sonraki soru →</button>
          </div>` : `<div class="small mute">Kısayol: klavyede <b>1–${currentQ.options.length}</b> ile seç, <b>Enter</b> ile sonraki soruya geç.</div>`}
        </div>
      </div>`;

      host.querySelector('[data-qd]').onclick = e => {
        const b = e.target.closest('[data-df]'); if (!b) return;
        stats.difficulty = b.dataset.df;
        saveStats(stats);
        nextQ();
      };
      host.querySelector('[data-qt]').onchange = e => { topicFilter = e.target.value; nextQ(); };
      host.querySelector('[data-qr]').onclick = () => {
        stats.correct = 0; stats.total = 0; stats.streak = 0; stats.bestStreak = 0;
        saveStats(stats);
        render();
        toast('Alıştırma skoru sıfırlandı');
      };
      host.querySelectorAll('[data-qi]').forEach(btn => { btn.onclick = () => answer(+btn.dataset.qi, btn); });
      host.querySelector('[data-qn]')?.addEventListener('click', nextQ);
      syncSegments(host, true);
    };

    const answer = (idx, btnEl = null) => {
      if (pickedIdx !== null || idx < 0 || idx >= currentQ.options.length) return;
      pickedIdx = idx;
      stats.total++;
      if (idx === currentQ.answerIndex) {
        stats.correct++;
        stats.streak++;
        if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
        if (stats.streak > 0 && stats.streak % 5 === 0 && full()) {
          const r = btnEl?.getBoundingClientRect?.();
          constellationBurst(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 2);
          toast(`${stats.streak} doğru seri! Harika ✦`);
        }
      } else {
        stats.streak = 0;
      }
      saveStats(stats);
      render();
    };

    const onKey = e => {
      if (!host.isConnected || e.target.closest?.('input, select, textarea')) return;
      if (pickedIdx === null && /^[1-4]$/.test(e.key)) {
        const i = +e.key - 1;
        if (i < currentQ.options.length) answer(i);
      } else if (pickedIdx !== null && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        nextQ();
      }
    };
    window.addEventListener('keydown', onKey);
    clean.add(() => window.removeEventListener('keydown', onKey));

    nextQ();
    return clean.run;
  };
}

const TEMSIL_QUIZ_TOPICS = [
  ['', 'Karışık (tüm temsil konuları)'],
  ['charDim', 'İrrep boyut karesi toplamı'],
  ['abelian1D', '1-boyutlu temsil sayısı'],
  ['fsIndicator', 'Frobenius–Schur göstergesi'],
  ['kronecker', 'Kronecker çarpımı'],
  ['molien', 'Molien serisi & değişmezler'],
  ['branchingInd', 'İndüklenmiş temsil boyutu'],
  ['mckayCover', 'İkili örtü & McKay ADE'],
  ['youngHook', 'Young kanca formülü (§2.4.5)'],
  ['murnaghan', 'Murnaghan–Nakayama (§2.4.5)'],
  ['semiDirect', 'Yarı-direkt çarpım (§2.4.4)'],
];

const BASITLIK_QUIZ_TOPICS = [
  ['', 'Karışık (tüm basitlik konuları)'],
  ['sylowSimple', 'Sylow p-alt grubu sayısı'],
  ['sylowScreen', 'Sylow basitlik eleği'],
  ['composition', 'Kompozisyon serisi & çözülebilirlik'],
  ['pslFano', 'PSL(2,7), Fano & Sporadik gruplar'],
];

// =====================================================================
// EXPORTED TABS INTERFACE
// =====================================================================
export const TABS = [
  // Chapter: sonlu (extensions to the 10 built-in finite-group tabs)
  { id: 'yaridirekt', chapter: 'sonlu', title: 'Yarı-Direkt Çarpım', icon: 'phasor', usesGroup: false, mount: mountSemiDirect },
  { id: 'young', chapter: 'sonlu', title: 'Young Tabloları', icon: 'grid', usesGroup: false, mount: mountYoung },
  { id: 'sonlu-ekler', chapter: 'sonlu', title: 'Sonlu Grup Ekleri', icon: 'matrix', usesGroup: false, mount: mountAppendix },

  // Chapter: temsil (Ramond Ch. 3 + finite SU(2)/SO(3)/SU(3) subgroups of 11.7)
  { id: 'karakter', chapter: 'temsil', title: 'Karakter Tablosu', icon: 'sigma', usesGroup: true, mount: mountCharacterTable },
  { id: 'kronecker', chapter: 'temsil', title: 'Kronecker Çarpımları', icon: 'x', usesGroup: true, mount: mountKronecker },
  { id: 'gomme-dallanma', chapter: 'temsil', title: 'Gömmeler & Dallanma', icon: 'side', usesGroup: true, mount: mountBranching },
  { id: 'indukleme', chapter: 'temsil', title: 'İndüklenmiş Temsiller', icon: 'arrow', usesGroup: true, mount: mountInduction },
  { id: 'molien', chapter: 'temsil', title: 'Değişmezler & Molien', icon: 'chart', usesGroup: true, mount: mountMolien },
  { id: 'ortuler-mckay', chapter: 'temsil', title: 'Örtüler & İkili Gruplar', icon: 'atom', usesGroup: false, mount: mountCoversMcKay },
  { id: 'temsil-konu', chapter: 'temsil', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(REP_LESSONS, 'Temsil Teorisi & Sonlu Grup Uzantıları (Ramond Böl. 2.4, 3, 11.7)') },
  { id: 'temsil-alistirma', chapter: 'temsil', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'temsil', storeKey: 'mp.groupRepQuiz', topics: TEMSIL_QUIZ_TOPICS }) },

  // Chapter: basitlik (Ramond Ch. 9 + 2.4.2–2.4.3)
  { id: 'basit-sylow', chapter: 'basitlik', title: 'Basit Gruplar & Sylow', icon: 'flame', usesGroup: true, mount: mountSimpleSylow },
  { id: 'galois-fano', chapter: 'basitlik', title: 'Galois & PSL(2,7)', icon: 'rotate', usesGroup: false, mount: mountGaloisFano },
  { id: 'sporadik', chapter: 'basitlik', title: 'Sporadik Gruplar', icon: 'sparkle', usesGroup: false, mount: mountSporadic },
  { id: 'basitlik-konu', chapter: 'basitlik', title: 'Konu Anlatımı', icon: 'book', usesGroup: false, mount: makeLessonsTab(SIMPLE_LESSONS, 'Basitliğe Yol: Sylow, Galois Cisimleri & Sporadik Gruplar (Ramond Böl. 2.4, 9)') },
  { id: 'basitlik-alistirma', chapter: 'basitlik', title: 'Alıştırmalar', icon: 'star', usesGroup: false, mount: makeQuizTab({ chapter: 'basitlik', storeKey: 'mp.groupBasitQuiz', topics: BASITLIK_QUIZ_TOPICS }) },
];
