// MathPad Lie Tabs — Spinors & Clifford, Embeddings & GUT, Verma & Weyl, Appendix 2, Kac-Moody & Superalgebras
// Covers Pierre Ramond Chapters 8 (8.5, 8.7, 8.8, 8.9), 10, and Appendix 2.
import { esc, icon } from './ui.js';
import { syncSegments } from './fx.js';
import {
  ratLatex,
  ratFormat,
  matToLatex,
  getAlgebra,
  listAlgebras,
  weylDimension,
  weylDimensionSteps,
  fundamentalReps,
  spinorInfo,
  cliffordGammas,
  fermionicOscillatorSpinor,
  extendedDynkin,
  borelDeSiebenthal,
  BRANCHING_CHAINS,
  branchingRule,
  sl2VermaModule,
  vermaRank2,
  weylCharacterFormula,
  serreRelations,
  affineAlgebra,
  sugawaraCentralCharge,
  integrableAffineWeights,
  SUPER_ALGEBRAS,
  superDynkinDiagram,
} from './lie.js';
import {
  ensureLieCss,
  tex,
  accentColor,
  createClean,
  setupCanvas,
  fmtDynkin,
  fmtBigInt,
  renderDynkinSvg,
  renderAlgebraPicker,
  bindAlgebraPicker,
} from './lie-ui.js';

function intMatToLatex(M) {
  return `\\begin{pmatrix} ${M.map(row => row.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
}

// =====================================================================
// TAB: SPİNÖRLER & CLİFFORD CEBİRİ (Ramond §8.5, §8.8)
// =====================================================================
export function mountSpinorClifford(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let dimD = 6;
  let cliffD = 4;
  let genPairIdx = 0;

  const render = () => {
    const sp = spinorInfo(dimD);
    const cl = cliffordGammas(cliffD);
    if (genPairIdx >= cl.generators.length) genPairIdx = 0;
    const fermN = Math.min(4, Math.max(1, Math.floor(dimD / 2)));
    const ferm = fermionicOscillatorSpinor(fermN);

    const bottRows = Array.from({ length: 15 }, (_, i) => spinorInfo(i + 2));

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">SO(d) Spinör Temsilleri & Bott Mod-8 Periyodikliği (d = 2..16)</h3>
          <span class="lie-pill acc">${sp.algId} · ${sp.isEven ? 'Çift (Weyl S₊ ⊕ S₋)' : 'Tek (Dirac S)'}</span>
        </div>
        <div class="lie-chips" role="group" aria-label="SO(d) boyutu d seç">
          ${Array.from({ length: 15 }, (_, i) => i + 2).map(d => `<button type="button" class="lie-chip ${d === dimD ? 'on' : ''}" data-sd="${d}">SO(${d})</button>`).join('')}
        </div>
        <div class="lie-kpis">
          <div class="lie-kpi acc"><span class="lie-kpi-lbl">Dirac Boyutu 2ⁿ</span><span class="lie-kpi-val mono">${sp.diracDim}</span><span class="lie-kpi-sub">n = ⌊d/2⌋ = ${sp.n}</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">İndirgenemez Spinör</span><span class="lie-kpi-val mono">${sp.spinorDim}</span><span class="lie-kpi-sub">${sp.isEven ? 'S₊ ve S₋ ayrı' : 'Tek S temsili'}</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Gerçellik (d mod 8 = ${dimD % 8})</span><span class="lie-kpi-val">${esc(sp.realityTr)}</span></div>
        </div>

        <div class="lie-grid-2">
          ${sp.reps.map(rep => `<div class="lie-callout">
            <div class="row wrap" style="justify-content:space-between">
              <b>${esc(rep.name)}</b>
              <span class="lie-pill acc">dim = ${rep.dim}${rep.dynkin ? ` · ${fmtDynkin(rep.dynkin)}` : ''}</span>
            </div>
            <div class="small mute">Kiralite: ${esc(rep.chirality)}</div>
            ${rep.weights.length ? `<div class="small mono" style="max-height:110px;overflow-y:auto">${rep.weights.slice(0, 16).map(w => `(${w.map(v => (v > 0 ? '+½' : '−½')).join(',')})`).join(' · ')}${rep.weights.length > 16 ? ` … (${rep.weights.length} ağırlık)` : ''}</div>` : `<div class="small mute">n > 6 için ağırlık sayısı ${rep.dim} olup liste kısaltıldı.</div>`}
          </div>`).join('')}
        </div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§8.5.3 Açık Clifford Cebiri Γ_μ (d = 2..8)</h3>
            <span class="lie-pill ${cl.check.ok ? 'ok' : 'bad'}">${cl.check.ok ? '✓ {Γ_μ, Γ_ν} = 2δ_μν I' : '✗ Hata'}</span>
          </div>
          <div class="lie-chips" role="group" aria-label="Clifford boyutu seç">
            ${[2, 3, 4, 5, 6, 7, 8].map(d => `<button type="button" class="lie-chip ${d === cliffD ? 'on' : ''}" data-cd="${d}">d = ${d} (${1 << Math.floor(d / 2)}×${1 << Math.floor(d / 2)})</button>`).join('')}
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi"><span class="lie-kpi-lbl">Matris Boyutu</span><span class="lie-kpi-val mono">${cl.matrixSize} × ${cl.matrixSize}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Anti-komütatör Hata</span><span class="lie-kpi-val mono">${cl.check.maxAntiCommErr.toExponential(1)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Hermitlilik Hata</span><span class="lie-kpi-val mono">${cl.check.maxHermErr.toExponential(1)}</span></div>
          </div>
          ${cl.matrixSize <= 8 ? `<div class="lie-mat-grid">
            ${cl.gammas.map((G, i) => `<div class="lie-mat-card"><div class="small mute">${tex(`\\Gamma_${i + 1}`)}</div><div class="lie-math-box">${tex(matToLatex(G, 2))}</div></div>`).join('')}
            ${cl.chirality ? `<div class="lie-mat-card on"><div class="small">${tex('\\Gamma_* = (-i)^n \\Gamma_1\\cdots\\Gamma_{2n}')}</div><div class="lie-math-box">${tex(matToLatex(cl.chirality, 2))}</div></div>` : ''}
          </div>` : `<p class="small mute">16×16 boyutlu ${cl.gammas.length} adet Γ matrisi motor tarafından kurulup {Γ_μ, Γ_ν} = 2δ_μν I ve Hermitlilik tam doğrulandı.</p>`}
          <div class="lie-toolbar-g">
            <label class="row" style="gap:6px"><span class="small mute">so(${cliffD}) üreteci Σ_{μν}:</span>
              <select class="inp lie-sel" data-gpair aria-label="so(d) spinör üreteci seç">
                ${cl.generators.map((g, i) => `<option value="${i}" ${i === genPairIdx ? 'selected' : ''}>Σ_{${g.mu},${g.nu}}</option>`).join('')}
              </select>
            </label>
          </div>
          ${cl.matrixSize <= 8 ? `<div class="lie-math-box">${tex(`\\Sigma_{${cl.generators[genPairIdx].mu},${cl.generators[genPairIdx].nu}} = -\\frac{i}{4}[\\Gamma_{${cl.generators[genPairIdx].mu}}, \\Gamma_{${cl.generators[genPairIdx].nu}}] = ${matToLatex(cl.generators[genPairIdx].matrix, 3)}`, true)}</div>` : ''}
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§8.8 Fermiyonik Salınıcı İnşası SO(${2 * fermN}) & Bott Tablosu</h3>
            <span class="lie-pill acc">{bᵢ, bⱼ†} = δᵢⱼ</span>
          </div>
          <div class="small mute">n = ${fermN} fermiyonik salınıcı ile ${ferm.diracDim} durum → çift parite S₊ (${ferm.weylDim}) ve tek parite S₋ (${ferm.weylDim}):</div>
          <div class="lie-table-wrap" style="max-height:210px;overflow-y:auto">
            <table class="lie-tbl" aria-label="Fermiyonik salınıcı spinör durumları">
              <thead><tr><th scope="col">|n₁…n_${fermN}⟩</th><th scope="col">N_F</th><th scope="col">Kiralite</th><th scope="col">Ağırlık (nᵢ − ½)</th></tr></thead>
              <tbody>${[...ferm.statesPlus, ...ferm.statesMinus].slice(0, 16).map(st => `<tr>
                <td class="mono">|${st.occ.join('')}⟩</td>
                <td class="mono">${st.fermionNumber}</td>
                <td><span class="lie-pill ${st.chirality === '+1' ? 'ok' : 'acc'}">${st.chirality === '+1' ? 'S₊ (+1)' : 'S₋ (−1)'}</span></td>
                <td class="mono small">(${st.weight.map(v => (v > 0 ? '+½' : '−½')).join(', ')})</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
          <div class="lie-table-wrap" style="max-height:210px;overflow-y:auto">
            <table class="lie-tbl" aria-label="Bott mod-8 spinör periyodiklik tablosu">
              <thead><tr><th scope="col">SO(d)</th><th scope="col">Cebir</th><th scope="col">dim(S)</th><th scope="col">Gerçellik</th></tr></thead>
              <tbody>${bottRows.map(r => `<tr class="clickable ${r.d === dimD ? 'on' : ''}" data-pickd="${r.d}">
                <td class="mono">SO(${r.d})</td><td class="mono">${esc(r.algId)}</td><td class="mono"><b>${r.spinorDim}</b></td><td class="small">${esc(r.realityTr)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-sd]').forEach(b => { b.onclick = () => { dimD = +b.dataset.sd; render(); }; });
    host.querySelectorAll('[data-pickd]').forEach(tr => { tr.onclick = () => { dimD = +tr.dataset.pickd; render(); }; });
    host.querySelectorAll('[data-cd]').forEach(b => { b.onclick = () => { cliffD = +b.dataset.cd; genPairIdx = 0; render(); }; });
    host.querySelector('[data-gpair]').onchange = e => { genPairIdx = +e.target.value; render(); };
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: GÖMMELER & DALLANMA KURALLARI (GUT Chain + Borel-de Siebenthal)
// =====================================================================
export function mountEmbeddingsGUT(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let mode = 'branch'; // 'branch' | 'bds'
  let chainId = 'so10_su5';
  let hw = [0, 0, 0, 0, 1]; // SO(10) 16

  // Borel-de Siebenthal state
  let bdsType = 'E';
  let bdsRank = 8;
  let delNode = 2; // E8 deleting mark-3/4 etc.

  const render = () => {
    let body = '';
    if (mode === 'branch') {
      const chain = BRANCHING_CHAINS.find(c => c.id === chainId) || BRANCHING_CHAINS[0];
      const P = getAlgebra(chain.parent[0], +chain.parent.slice(1));
      if (hw.length !== P.rank) hw = chain.presets[0].hw.slice();
      const br = branchingRule(chainId, hw);

      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Büyük Birleşme (GUT) & Klasik Gömme Zinciri</h3>
          <span class="lie-pill acc">${esc(chain.kind)}</span>
        </div>
        <div class="lie-gut-chain" aria-label="GUT simetri kırılım zinciri">
          <button type="button" class="lie-gut-step ${chainId === 'e6_so10' ? 'on' : ''}" data-gut="e6_so10">E₆ (27)</button>
          <span class="mute">⊃</span>
          <button type="button" class="lie-gut-step ${chainId === 'so10_su5' ? 'on' : ''}" data-gut="so10_su5">SO(10) (16)</button>
          <span class="mute">⊃</span>
          <button type="button" class="lie-gut-step ${chainId === 'su5_sm' ? 'on' : ''}" data-gut="su5_sm">SU(5) (5̄ + 10)</button>
          <span class="mute">⊃</span>
          <span class="lie-pill ok">SU(3)_C × SU(2)_L × U(1)_Y</span>
        </div>
        <div class="lie-chips" role="group" aria-label="Dallanma zinciri seç">
          ${BRANCHING_CHAINS.map(c => `<button type="button" class="lie-chip ${c.id === chainId ? 'on' : ''}" data-ch="${c.id}">${esc(c.title.split(' (')[0])}</button>`).join('')}
        </div>
        <div class="lie-callout">
          <b>${esc(chain.title)}</b>
          <span class="small mute">${esc(chain.desc)}</span>
        </div>
        <div class="lie-toolbar">
          <div class="lie-chips">
            ${chain.presets.map(p => `<button type="button" class="lie-chip ${p.hw.join(',') === hw.join(',') ? 'on' : ''}" data-bp="${p.hw.join(',')}">${esc(p.label)}</button>`).join('')}
          </div>
          <div class="lie-dynkin-inputs">
            <span class="small mute">Özel Λ:</span>
            ${hw.map((v, i) => `<div class="lie-dynkin-in"><span>a${i + 1}</span><input type="number" class="inp mono lie-num" data-bhw="${i}" min="0" max="4" value="${v}" aria-label="Üst cebir ağırlığı ${i + 1}"></div>`).join('')}
          </div>
        </div>
      </div>

      ${br.truncated ? `<div class="lie-callout bad">Temsil çok büyük — daha küçük bir ağırlık seçin.</div>` : `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Dallanma Sonucu: ${fmtBigInt(br.parentDim)} (${fmtDynkin(hw)}) → ${esc(chain.subLabel)}</h3>
          <span class="lie-pill ${br.dimCheck ? 'ok' : 'bad'}">∑ Boyut = ${fmtBigInt(br.sumDim)} ${br.dimCheck ? '✓' : '✗'}</span>
        </div>
        <div class="lie-decomp">
          ${br.terms.map(t => {
            const dimLbl = t.factorDims.length > 1 ? `(${t.factorDims.map(fmtBigInt).join(', ')})` : `${fmtBigInt(t.dim)}`;
            return `<span class="lie-term">${t.mult > 1 ? `${t.mult}·` : ''}<b>${dimLbl}</b>${t.chargeLabel ? ` <span class="small" style="color:var(--acc)">${esc(t.chargeLabel)}</span>` : ''}</span>`;
          }).join('<span class="mute">⊕</span>')}
        </div>
        <div class="lie-table-wrap">
          <table class="lie-tbl" aria-label="Dallanma alt-temsilleri tablosu">
            <thead><tr><th scope="col">Katlılık</th><th scope="col">Alt-Temsil Boyutu</th><th scope="col">Alt-Cebir Dynkin</th><th scope="col">U(1) Yükü</th></tr></thead>
            <tbody>${br.terms.map(t => `<tr>
              <td class="mono">${t.mult}×</td>
              <td class="mono"><b>${t.factorDims.length > 1 ? `(${t.factorDims.join(', ')}) = ${t.dim}` : `${t.dim}`}</b></td>
              <td class="mono">${t.subHws.map(fmtDynkin).join(' × ')}</td>
              <td class="mono" style="color:var(--acc)">${esc(t.chargeLabel || '—')}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`}`;
    } else {
      const alg = getAlgebra(bdsType, bdsRank);
      const ext = extendedDynkin(alg);
      if (delNode > alg.rank) delNode = 0;
      const res = borelDeSiebenthal(alg, delNode);
      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Borel–de Siebenthal: Genişletilmiş Dynkin Diyagramından Düğüm Sil</h3>
          <span class="lie-pill acc">${tex(ext.affineLatex)}</span>
        </div>
        ${renderAlgebraPicker(bdsType, bdsRank, { allowA1: false })}
        <div class="small mute">Diyagramda herhangi bir düğüme dokunup silin; kalan düzenli alt cebir otomatik tanınır (işaret a = 1 ise u(1) eklenir, asal a ise maksimal yarı-basit alt cebir çıkar!).</div>
        ${renderDynkinSvg(ext.nodes, ext.edges, {
          deletedIdx: delNode,
          showMarks: true,
          ariaLabel: `${alg.name} genişletilmiş Dynkin diyagramı`,
        })}
        <div class="lie-callout ${res.isMaximalRegular ? 'ok' : ''}">
          <div class="row wrap" style="justify-content:space-between">
            <b>Silinen düğüm: ${esc(res.deletedLabel)} (işaret a = ${res.deletedMark})</b>
            <span class="lie-pill ${res.isMaximalRegular ? 'ok' : 'warn'}">${esc(res.kind)}</span>
          </div>
          <div class="lie-math-box">${tex(`${alg.compactLatex} \\;\\supset\\; ${res.latex}`, true)}</div>
          <div class="small mute">Rank korunumu: ${res.subRank} = ${alg.rank} · Boyut: ${res.subDim} / ${alg.dimension} · Kalan çarpanlar: ${esc(res.label)}</div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-toolbar">
        <div class="seg" data-embm role="tablist" aria-label="Gömme ve dallanma modları">
          <button type="button" data-m="branch" class="${mode === 'branch' ? 'on' : ''}">GUT & Dallanma Kuralları</button>
          <button type="button" data-m="bds" class="${mode === 'bds' ? 'on' : ''}">Borel–de Siebenthal (Düzenli Gömmeler)</button>
        </div>
        <button type="button" class="btn small ghost" data-doc>${icon('book')} Konu Anlatımı</button>
      </div>
      ${body}
    </div>`;

    host.querySelector('[data-embm]').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; render(); } };
    host.querySelector('[data-doc]').onclick = () => ctx?.jumpTo?.('lie-konu');

    if (mode === 'branch') {
      const pickChain = id => {
        chainId = id;
        const c = BRANCHING_CHAINS.find(x => x.id === id);
        hw = (id === 'so10_su5' ? c.presets[1] : id === 'su5_sm' ? c.presets[2] : c.presets[0]).hw.slice();
        render();
      };
      host.querySelectorAll('[data-ch]').forEach(b => { b.onclick = () => pickChain(b.dataset.ch); });
      host.querySelectorAll('[data-gut]').forEach(b => { b.onclick = () => pickChain(b.dataset.gut); });
      host.querySelectorAll('[data-bp]').forEach(b => { b.onclick = () => { hw = b.dataset.bp.split(',').map(Number); render(); }; });
      host.querySelectorAll('[data-bhw]').forEach(inp => {
        inp.onchange = () => { hw[+inp.dataset.bhw] = Math.max(0, Math.min(4, Math.trunc(+inp.value) || 0)); render(); };
      });
    } else {
      bindAlgebraPicker(host, bdsType, bdsRank, (t, r) => { bdsType = t; bdsRank = r; delNode = 1; render(); }, { allowA1: false });
      host.querySelectorAll('[data-node]').forEach(g => {
        const pick = () => { delNode = +g.dataset.node; render(); };
        g.onclick = pick;
        g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
      });
    }
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: VERMA MODÜLLERİ & WEYL BOYUT / KARAKTER FORMÜLÜ (Ramond §8.9)
// =====================================================================
export function mountVermaWeyl(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let mode = 'sl2'; // 'sl2' | 'rank2' | 'weyl'
  let sl2Lam = 3;
  let r2Type = 'A';
  let r2Hw = [1, 1];
  let wType = 'A';
  let wRank = 2;
  let wHw = [1, 1];
  let subClean = null;

  const render = () => {
    subClean?.run();
    subClean = createClean();
    let body = '';

    if (mode === 'sl2') {
      const vm = sl2VermaModule(sl2Lam, 9);
      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">§8.9.2 sl(2) Verma Modülü M(λ) ve Tekil Vektör</h3>
          <span class="lie-pill ${vm.isFiniteQuotient ? 'ok' : 'warn'}">${vm.isFiniteQuotient ? `Sonlu bölüm L(${sl2Lam}), dim = ${vm.quotientDim}` : 'Tekil vektör yok → M(λ) indirgenemez (∞ boyut)'}</span>
        </div>
        <div class="lie-toolbar">
          <div class="lie-chips">
            ${[0, 1, 2, 3, 4, 5, 1.5, -1, -2].map(v => `<button type="button" class="lie-chip ${sl2Lam === v ? 'on' : ''}" data-slam="${v}">λ = ${v}</button>`).join('')}
          </div>
          <label class="row" style="gap:6px"><span class="small mute">Özel λ:</span><input type="number" class="inp mono lie-num" data-slin step="0.5" min="-4" max="8" value="${sl2Lam}" aria-label="sl(2) en yüksek ağırlık lambda"></label>
        </div>
        <div class="lie-math-box">${tex('e \\cdot f^k v_\\lambda = k(\\lambda - k + 1)\\, f^{k-1} v_\\lambda, \\qquad h \\cdot f^k v_\\lambda = (\\lambda - 2k)\\, f^k v_\\lambda', true)}</div>
        <div class="lie-ladder">
          ${vm.levels.map(lv => `<div class="lie-ladder-row ${lv.isSingular ? 'singular' : !lv.inQuotient ? 'quotient-out' : ''}">
            <span class="mono">f^${lv.k} v</span>
            <span class="mono">ağırlık: <b>${lv.weight}</b></span>
            <span class="small">${tex(`e\\cdot f^{${lv.k}}v = ${lv.eCoeff}\\, f^{${Math.max(0, lv.k - 1)}}v`)}</span>
            ${lv.isSingular ? '<span class="lie-pill warn">Tekil Vektör!</span>' : lv.inQuotient ? '<span class="lie-pill ok">L(λ)</span>' : '<span class="lie-pill">Bölümde 0</span>'}
          </div>`).join('')}
        </div>
      </div>`;
    } else if (mode === 'rank2') {
      const alg = getAlgebra(r2Type, 2);
      const vr = vermaRank2(alg, r2Hw, 5);
      body = `<div class="lie-panel">
        <div class="lie-toolbar">
          <div class="lie-chips">
            ${[['A', 'A₂ · SU(3)'], ['B', 'B₂ · SO(5)'], ['G', 'G₂']].map(([t, l]) => `<button type="button" class="lie-chip ${r2Type === t ? 'on' : ''}" data-r2t="${t}">${l}</button>`).join('')}
          </div>
          <div class="lie-toolbar-g">
            <label class="row" style="gap:5px"><span class="small mute">a₁:</span><input type="number" class="inp mono lie-num" data-v1 min="0" max="3" value="${r2Hw[0]}" aria-label="Rank 2 a1"></label>
            <label class="row" style="gap:5px"><span class="small mute">a₂:</span><input type="number" class="inp mono lie-num" data-v2 min="0" max="3" value="${r2Hw[1]}" aria-label="Rank 2 a2"></label>
          </div>
        </div>
        <div class="lie-cv-box">
          <canvas class="lie-cv" data-vr2-cv aria-label="Rank-2 Verma modülü ve Kostant parçalanış kafesi"></canvas>
          <div class="lie-cv-badge">Sayılar: Kostant P(n₁,n₂) / L(Λ) katlılığı · Sarı yıldızlar: tekil vektörler sᵢ·Λ</div>
        </div>
        <div class="lie-callout">
          <div class="small"><b>Bölüm İndirgemesi:</b> Maksimal alt modülü üreten kaydırılmış Weyl tekil vektörleri: ${vr.singulars.map(s => `${tex(`s_${s.gen}\\cdot\\Lambda = ${fmtDynkin(s.dynkin)}`)} (adım ${s.step})`).join(' ve ')}. Sonlu indirgenemez temsil boyutu: <b>dim L(${r2Hw.join(',')}) = ${vr.dim}</b>.</div>
        </div>
      </div>`;
    } else {
      const alg = getAlgebra(wType, wRank);
      if (wHw.length !== alg.rank) { wHw = Array(alg.rank).fill(0); wHw[0] = 1; }
      const steps = weylDimensionSteps(alg, wHw);
      const canChar = alg.weylOrderNum <= 24;
      const wcf = canChar ? weylCharacterFormula(alg, wHw) : null;
      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">§8.9.1 Weyl Boyut Formülü & Weyl Karakter Formülü</h3>
          <span class="lie-pill ok">dim = ${fmtBigInt(steps.dim)}</span>
        </div>
        ${renderAlgebraPicker(wType, wRank, { maxRank: 4 })}
        <div class="lie-dynkin-inputs">
          <span class="small mute">Λ =</span>
          ${wHw.map((v, i) => `<div class="lie-dynkin-in"><span>a${i + 1}</span><input type="number" class="inp mono lie-num" data-whw="${i}" min="0" max="4" value="${v}" aria-label="Weyl ağırlık bileşeni ${i + 1}"></div>`).join('')}
        </div>
        <div class="lie-math-box">${tex(`\\dim(\\Lambda) = \\prod_{\\alpha \\in \\Delta^+} \\frac{(\\Lambda+\\rho,\\alpha)}{(\\rho,\\alpha)} = ${steps.factors.map(f => `\\frac{${f.num}}{${f.den}}`).join(' \\cdot ')} = ${steps.dim}`, true)}</div>
        ${wcf ? `<div class="lie-callout ok">
          <b>Weyl Karakter Özdeşliği Doğrulaması (|W| = ${alg.weylOrder}): ${wcf.verified ? '✓ ch(Λ)·Δ = ∑ det(w) e^{w(Λ+ρ)} birebir tuttu!' : '✗'}</b>
          <div class="lie-math-box">${tex(`\\sum_{w\\in W} \\det(w)\\, e^{w(\\Lambda+\\rho)} = ${wcf.numTerms.map((t, i) => `${t.sign < 0 ? '-' : i ? '+' : ''}e^{(${t.weight.join(',')})}`).join('\\,')}`, true)}</div>
        </div>` : `<div class="small mute">Weyl karakter açılımı |W| ≤ 24 için (A₁, A₂, B₂, C₂, G₂, A₃) açık terimlerle doğrulanır.</div>`}
      </div>`;
    }

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-toolbar">
        <div class="seg" data-vm role="tablist" aria-label="Verma ve Weyl modları">
          <button type="button" data-m="sl2" class="${mode === 'sl2' ? 'on' : ''}">sl(2) Verma Bazı</button>
          <button type="button" data-m="rank2" class="${mode === 'rank2' ? 'on' : ''}">Rank-2 Verma & Kostant</button>
          <button type="button" data-m="weyl" class="${mode === 'weyl' ? 'on' : ''}">Weyl Boyut & Karakter</button>
        </div>
        <button type="button" class="btn small ghost" data-doc>${icon('book')} Konu Anlatımı</button>
      </div>
      ${body}
    </div>`;

    host.querySelector('[data-vm]').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; render(); } };
    host.querySelector('[data-doc]').onclick = () => ctx?.jumpTo?.('lie-konu');

    if (mode === 'sl2') {
      host.querySelectorAll('[data-slam]').forEach(b => { b.onclick = () => { sl2Lam = +b.dataset.slam; render(); }; });
      host.querySelector('[data-slin]').onchange = e => { sl2Lam = +e.target.value; render(); };
    } else if (mode === 'rank2') {
      const alg = getAlgebra(r2Type, 2);
      const vr = vermaRank2(alg, r2Hw, 5);
      const cv = host.querySelector('[data-vr2-cv]');
      setupCanvas(cv, w => Math.min(390, Math.max(280, Math.round(w * 0.68))), (c2d, W, H) => {
        c2d.clearRect(0, 0, W, H);
        const acc = accentColor();
        const xs = vr.points.map(p => p.pos2D[0]), ys = vr.points.map(p => p.pos2D[1]);
        const minX = Math.min(...xs) - 0.6, maxX = Math.max(...xs) + 0.6;
        const minY = Math.min(...ys) - 0.6, maxY = Math.max(...ys) + 0.6;
        const scale = Math.min((W - 60) / (maxX - minX || 1), (H - 60) / (maxY - minY || 1));
        const ox = W / 2 - ((minX + maxX) / 2) * scale;
        const oy = H / 2 + ((minY + maxY) / 2) * scale;
        const toXY = ([x, y]) => [ox + x * scale, oy - y * scale];

        for (const p of vr.points) {
          const [px, py] = toXY(p.pos2D);
          c2d.fillStyle = p.inIrrep ? acc : 'rgba(255,255,255,0.22)';
          c2d.beginPath(); c2d.arc(px, py, p.inIrrep ? 6 : 3.8, 0, Math.PI * 2); c2d.fill();
          c2d.fillStyle = p.inIrrep ? '#f4f4f5' : '#8b8b94';
          c2d.font = '600 10px monospace';
          c2d.textAlign = 'center';
          c2d.fillText(p.inIrrep ? `${p.vermaMult}/${p.irrepMult}` : `${p.vermaMult}`, px, py - 9);
        }
        // Singular vectors s_i . Lambda
        for (const s of vr.singulars) {
          const [sx, sy] = toXY(s.pos2D);
          c2d.strokeStyle = '#ffd166';
          c2d.lineWidth = 2.2;
          c2d.beginPath(); c2d.arc(sx, sy, 11, 0, Math.PI * 2); c2d.stroke();
          c2d.fillStyle = '#ffd166';
          c2d.font = '700 10.5px monospace';
          c2d.fillText(`s${s.gen}·Λ`, sx, sy + 21);
        }
      }, subClean);

      host.querySelectorAll('[data-r2t]').forEach(b => { b.onclick = () => { r2Type = b.dataset.r2t; render(); }; });
      host.querySelector('[data-v1]').onchange = e => { r2Hw[0] = Math.max(0, Math.min(3, Math.trunc(+e.target.value) || 0)); render(); };
      host.querySelector('[data-v2]').onchange = e => { r2Hw[1] = Math.max(0, Math.min(3, Math.trunc(+e.target.value) || 0)); render(); };
    } else {
      bindAlgebraPicker(host, wType, wRank, (t, r) => {
        wType = t; wRank = r; wHw = Array(r).fill(0); wHw[0] = 1; render();
      }, { maxRank: 4 });
      host.querySelectorAll('[data-whw]').forEach(inp => {
        inp.onchange = () => { wHw[+inp.dataset.whw] = Math.max(0, Math.min(4, Math.trunc(+inp.value) || 0)); render(); };
      });
    }
    syncSegments(host, true);
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}

// =====================================================================
// TAB: LİE CEBİRİ EKLERİ (Appendix 2 — Engine-Generated Catalog)
// =====================================================================
export function mountLieAppendix(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let famFilter = 'ALL';
  let query = '';
  const allAlgs = listAlgebras();

  const render = () => {
    const q = query.trim().toLowerCase();
    const rows = allAlgs.filter(a => {
      if (famFilter === 'EXC' && !['G', 'F', 'E'].includes(a.type)) return false;
      if (['A', 'B', 'C', 'D'].includes(famFilter) && a.type !== famFilter) return false;
      if (q && !`${a.id} ${a.name} ${a.compactGroup}`.toLowerCase().includes(q)) return false;
      return true;
    });

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Ek 2: Seçilmiş Basit Lie Cebirlerinin Özellikleri (Motor Hesaplı, ${rows.length} Cebir)</h3>
          <span class="lie-pill acc">Ramond Ek 2</span>
        </div>
        <div class="lie-toolbar">
          <div class="lie-chips" role="group" aria-label="Cebir ailesi filtresi">
            ${[['ALL', 'Tümü (33)'], ['A', 'A_n'], ['B', 'B_n'], ['C', 'C_n'], ['D', 'D_n'], ['EXC', 'İstisnai (G₂,F₄,E₆,E₇,E₈)']].map(([k, l]) => `<button type="button" class="lie-chip ${famFilter === k ? 'on' : ''}" data-af="${k}">${l}</button>`).join('')}
          </div>
          <input type="search" class="inp lie-sel" data-aq placeholder="Ara: E8, SO(10), su..." value="${esc(query)}" aria-label="Lie cebiri ara">
        </div>
        <div class="lie-table-wrap">
          <table class="lie-tbl" aria-label="Ramond Ek 2 basit Lie cebirleri tablosu">
            <thead>
              <tr>
                <th scope="col">Cebir</th>
                <th scope="col">Grup</th>
                <th scope="col">r</th>
                <th scope="col">dim</th>
                <th scope="col">|Δ⁺|</th>
                <th scope="col">h / h∨</th>
                <th scope="col">det(A)</th>
                <th scope="col">Merkez</th>
                <th scope="col">|W|</th>
                <th scope="col">Üsler</th>
                <th scope="col">En Küçük Temel</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(a => {
                const funds = fundamentalReps(a);
                let minF = funds[0];
                for (const f of funds) if (f.dim < minF.dim) minF = f;
                return `<tr>
                  <td><b>${tex(a.latex)}</b></td>
                  <td class="mono">${esc(a.compactGroup)}</td>
                  <td class="mono">${a.rank}</td>
                  <td class="mono"><b>${a.dimension}</b></td>
                  <td class="mono">${a.numPositiveRoots}</td>
                  <td class="mono">${a.coxeterNumber} / ${a.dualCoxeterNumber}</td>
                  <td class="mono">${a.cartanDet}</td>
                  <td class="mono small">${esc(a.center)}</td>
                  <td class="mono small">${fmtBigInt(a.weylOrder)}</td>
                  <td class="mono small mute">${a.exponents.join(', ')}</td>
                  <td class="mono small"><b>${fmtBigInt(minF.dim)}</b> (T=${ratFormat(minF.indexT)})</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-af]').forEach(b => { b.onclick = () => { famFilter = b.dataset.af; render(); }; });
    const inp = host.querySelector('[data-aq]');
    inp.oninput = () => { query = inp.value; render(); };
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: KAC-MOODY & SÜPER CEBİRLER (Ramond Ch. 10)
// =====================================================================
export function mountKacMoodySuper(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let mode = 'affine'; // 'serre' | 'affine' | 'super'
  let algType = 'E';
  let algRank = 8;
  let levelK = 1;

  // Superalgebra state
  let supFam = 'sl'; // 'sl' | 'osp'
  let supM = 3;
  let supN = 2;
  let slMode = 'distinguished';

  const render = () => {
    let body = '';
    if (mode === 'serre') {
      const alg = getAlgebra(algType, algRank);
      const ser = serreRelations(alg);
      const conn = ser.relations.filter(r => r.connected);
      const comm = ser.relations.filter(r => !r.connected);
      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">§10.1 Serre Sunumu: Chevalley Üreteçleri & (ad eᵢ)^{1−A_ji}(eⱼ) = 0</h3>
          <span class="lie-pill acc">${alg.name} (rank ${alg.rank})</span>
        </div>
        ${renderAlgebraPicker(algType, algRank, { maxRank: 6, allowA1: false })}
        <div class="lie-math-box">${tex('[h_i, h_j]=0,\\quad [e_i, f_j]=\\delta_{ij}h_i,\\quad [h_i, e_j]=A_{ji}e_j,\\quad (\\operatorname{ad} e_i)^{1-A_{ji}}(e_j)=0', true)}</div>
        <div class="small mute">Bağlı çiftler (A_{ji} &lt; 0, <b>${conn.length}</b> bağıntı):</div>
        <div class="lie-serre-grid">
          ${conn.map(r => `<div class="lie-serre-item conn">
            <div class="row" style="justify-content:space-between"><span class="mono small mute">A_{${r.j},${r.i}} = ${r.cartanEntry}</span><span class="lie-pill acc">üs = ${r.power}</span></div>
            <div>${tex(r.latexE)}</div>
            <div class="small mute">${tex(r.latexF)}</div>
          </div>`).join('')}
        </div>
        ${comm.length ? `<div class="small mute">Komşuluğu olmayan çiftler (${comm.length} adet): [eᵢ, eⱼ] = 0, [fᵢ, fⱼ] = 0.</div>` : ''}
      </div>`;
    } else if (mode === 'affine') {
      const aff = affineAlgebra(algType, algRank);
      const sug = sugawaraCentralCharge(algType, algRank, levelK);
      const integ = integrableAffineWeights(algType, algRank, levelK, { maxCount: 40 });
      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">§10.2 Bükülmemiş Afin Kac-Moody Cebiri ${tex(aff.affineLatex)}</h3>
          <span class="lie-pill ${aff.detIsZero && aff.leftNullOk && aff.rightNullOk ? 'ok' : 'bad'}">✓ det(Ã)=0 · a·Ã=0 · Ã·a∨=0</span>
        </div>
        ${renderAlgebraPicker(algType, algRank)}
        ${renderDynkinSvg(aff.nodes, aff.edges, {
          showMarks: true,
          showComarks: true,
          ariaLabel: `${aff.affineName} afin Dynkin diyagramı`,
        })}
        <div class="lie-slider-row">
          <label class="grow">Kac-Moody Düzeyi k = <b class="mono">${levelK}</b>
            <input type="range" class="lie-range grow" data-kmk min="1" max="10" value="${levelK}" aria-label="Afin düzey k">
          </label>
          <span class="lie-pill acc">Sugawara c = ${tex(sug.cLatex)} ≈ ${sug.cFloat.toFixed(4)}</span>
        </div>
        <div class="lie-kpis">
          <div class="lie-kpi acc"><span class="lie-kpi-lbl">Sugawara Merkezi Yük c</span><span class="lie-kpi-val">${tex(sug.cLatex)}</span><span class="lie-kpi-sub">k·dim/(k+h∨) = ${levelK}·${sug.dimG}/(${levelK}+${sug.dualCoxeter})</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Coxeter h / İkili h∨</span><span class="lie-kpi-val mono">${aff.coxeterNumber} / ${aff.dualCoxeterNumber}</span><span class="lie-kpi-sub">∑aᵢ / ∑aᵢ∨</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">İşaretler (marks a)</span><span class="lie-kpi-val mono">(${aff.marks.join(',')})</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Eş-işaretler (a∨)</span><span class="lie-kpi-val mono">(${aff.comarks.join(',')})</span></div>
        </div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Genişletilmiş Cartan Matrisi Ã (${algRank + 1}×${algRank + 1})</h3></div>
          <div class="lie-math-box">${tex(`\\tilde{A} = ${intMatToLatex(aff.extCartan)}`, true)}</div>
        </div>
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Düzey k=${levelK} İntegral Alınabilir Ağırlıklar (∑ aᵢ∨ λᵢ = ${levelK})</h3>
            <span class="lie-pill acc">${integ.count}${integ.truncated ? '+' : ''} adet</span>
          </div>
          <div class="lie-table-wrap" style="max-height:280px;overflow-y:auto">
            <table class="lie-tbl" aria-label="İntegral alınabilir afin ağırlıklar">
              <thead><tr><th scope="col">[λ₀; λ₁…λ_r]</th><th scope="col">Sonlu Λ</th><th scope="col">dim(Λ)</th></tr></thead>
              <tbody>${integ.weights.map(w => `<tr>
                <td class="mono">[${w.lambda0}; ${w.finiteHw.join(',')}]</td>
                <td class="mono">${fmtDynkin(w.finiteHw)}</td>
                <td class="mono"><b>${fmtBigInt(w.finiteDim)}</b></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    } else {
      const sd = superDynkinDiagram(supFam, supM, supN, slMode);
      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">§10.3 Süper-Dynkin Diyagramı Oluşturucu: ${esc(sd.title)}</h3>
          <div class="lie-super-legend">
            <span class="lie-swatch"><i class="long"></i> Bozonik ○</span>
            <span class="lie-swatch"><i class="iso"></i> İzotropik Fermiyonik ⊗</span>
            <span class="lie-swatch"><i class="blk"></i> İzotropik Olmayan ●</span>
          </div>
        </div>
        <div class="lie-toolbar">
          <div class="seg" data-sfam role="tablist" aria-label="Süper cebir ailesi">
            <button type="button" data-sf="sl" class="${supFam === 'sl' ? 'on' : ''}">sl(m|n)</button>
            <button type="button" data-sf="osp" class="${supFam === 'osp' ? 'on' : ''}">osp(M|2n)</button>
          </div>
          <div class="lie-toolbar-g">
            <label class="row" style="gap:5px"><span class="small mute">${supFam === 'sl' ? 'm:' : 'M:'}</span><input type="number" class="inp mono lie-num" data-sm min="1" max="6" value="${supM}" aria-label="Süper cebir m parametresi"></label>
            <label class="row" style="gap:5px"><span class="small mute">n:</span><input type="number" class="inp mono lie-num" data-sn min="1" max="4" value="${supN}" aria-label="Süper cebir n parametresi"></label>
            ${supFam === 'sl' ? `<div class="seg" data-slm role="tablist" aria-label="Süper-Dynkin tabanı">
              <button type="button" data-smode="distinguished" class="${slMode === 'distinguished' ? 'on' : ''}">Ayırt Edilmiş</button>
              <button type="button" data-smode="alternating" class="${slMode === 'alternating' ? 'on' : ''}">Almaşık (Tek Weyl)</button>
            </div>` : ''}
          </div>
        </div>
        ${renderDynkinSvg(sd.nodes, sd.edges, {
          isSuper: true,
          showMarks: false,
          ariaLabel: `${sd.title} süper-Dynkin diyagramı`,
        })}
        <div class="lie-kpis">
          <div class="lie-kpi acc"><span class="lie-kpi-lbl">Bozonik Kök Düğümü</span><span class="lie-kpi-val mono">${sd.bosCount}</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Fermiyonik (Tek) Düğüm</span><span class="lie-kpi-val mono">${sd.oddCount}</span></div>
          ${sd.signature ? `<div class="lie-kpi"><span class="lie-kpi-lbl">İmza Dizisi</span><span class="lie-kpi-val mono">${esc(sd.signature)}</span></div>` : ''}
        </div>
        ${sd.cartan ? `<div class="lie-math-box">${tex(`A_{\\text{süper}} = ${intMatToLatex(sd.cartan)}`, true)}</div>` : ''}
      </div>

      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Kac Basit Lie Süper Cebirleri Sınıflandırması (m=${supM}, n=${supN} için)</h3>
        </div>
        <div class="lie-table-wrap">
          <table class="lie-tbl" aria-label="Basit Lie süper cebirleri sınıflandırması">
            <thead><tr><th scope="col">Aile</th><th scope="col">Tür</th><th scope="col">Bozonik Alt Cebir g₀</th><th scope="col">dim(g₀ | g₁)</th><th scope="col">Süperboyut</th><th scope="col">Notlar</th></tr></thead>
            <tbody>${SUPER_ALGEBRAS.map(s => {
              const effM = s.id === 'D(m,n)' ? Math.max(2, supM) : supM;
              const effN = ['C(n)', 'P(n)', 'Q(n)'].includes(s.id) ? Math.max(2, supN) : supN;
              const d = s.dimFormula(effM, effN);
              return `<tr>
                <td><b>${tex(s.latex)}</b></td>
                <td><span class="lie-pill">${esc(s.kind)}</span></td>
                <td>${tex(s.bosonicLatex)}</td>
                <td class="mono">${d.bosonic} | ${d.fermionic} <span class="mute">(${d.total})</span></td>
                <td class="mono">${d.superDim}</td>
                <td class="small mute">${esc(s.notes)}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-toolbar">
        <div class="seg" data-kmm role="tablist" aria-label="Lie ötesi modları">
          <button type="button" data-m="affine" class="${mode === 'affine' ? 'on' : ''}">10.2 Afin Kac-Moody & Sugawara</button>
          <button type="button" data-m="serre" class="${mode === 'serre' ? 'on' : ''}">10.1 Serre Sunumu</button>
          <button type="button" data-m="super" class="${mode === 'super' ? 'on' : ''}">10.3 Lie Süper Cebirleri</button>
        </div>
        <button type="button" class="btn small ghost" data-doc>${icon('book')} Konu Anlatımı</button>
      </div>
      ${body}
    </div>`;

    host.querySelector('[data-kmm]').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; render(); } };
    host.querySelector('[data-doc]').onclick = () => ctx?.jumpTo?.('otesi-konu');

    if (mode === 'serre') {
      bindAlgebraPicker(host, algType, algRank, (t, r) => { algType = t; algRank = r; render(); }, { maxRank: 6, allowA1: false });
    } else if (mode === 'affine') {
      bindAlgebraPicker(host, algType, algRank, (t, r) => { algType = t; algRank = r; render(); });
      host.querySelector('[data-kmk]').oninput = e => { levelK = +e.target.value; render(); };
    } else {
      host.querySelector('[data-sfam]').onclick = e => { const b = e.target.closest('[data-sf]'); if (b) { supFam = b.dataset.sf; render(); } };
      host.querySelector('[data-sm]').onchange = e => { supM = Math.max(1, Math.min(6, Math.trunc(+e.target.value) || 1)); render(); };
      host.querySelector('[data-sn]').onchange = e => { supN = Math.max(1, Math.min(4, Math.trunc(+e.target.value) || 1)); render(); };
      host.querySelector('[data-slm]')?.addEventListener('click', e => {
        const b = e.target.closest('[data-smode]'); if (b) { slMode = b.dataset.smode; render(); }
      });
    }
    syncSegments(host, true);
  };

  render();
  return clean.run;
}
