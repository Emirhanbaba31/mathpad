// MathPad Lie Tabs — Classification, Root Systems, Weyl Group, Representations, Tensor Products & Young Tableaux
// Covers Pierre Ramond Chapters 7 & 8 (8.1–8.4, 8.6).
import { esc, icon } from './ui.js';
import { motion, syncSegments } from './fx.js';
import {
  CASIMIR_NORMALIZATION,
  ratLatex,
  ratFormat,
  ratToNumber,
  getAlgebra,
  rootInnerProduct,
  reflectWeight,
  toDominantWeight,
  rootString,
  weylDimension,
  casimirC2,
  dynkinIndex,
  conjugateWeight,
  congruenceClass,
  repReality,
  weightSystem,
  fundamentalReps,
  applyWeylWord,
  weylOrbit,
  weylGroupElements,
  tensorProduct,
  symmetricAntisymmetricSquare,
  dynkinToPartition,
  youngConjugate,
  youngHooksAndContents,
  dynkinTo2D,
  rootTo2D,
} from './lie.js';
import {
  ensureLieCss,
  tex,
  accentColor,
  createClean,
  setupCanvas,
  createAnimLoop,
  fmtDynkin,
  fmtBigInt,
  renderDynkinSvg,
  renderAlgebraPicker,
  bindAlgebraPicker,
} from './lie-ui.js';

function intMatToLatex(M) {
  return `\\begin{pmatrix} ${M.map(row => row.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
}

function ratMatToLatex(M) {
  return `\\begin{pmatrix} ${M.map(row => row.map(ratLatex).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
}

// =====================================================================
// TAB: DYNKİN DİYAGRAMLARI & SINIFLANDIRMA (Ramond Ch. 7)
// =====================================================================
export function mountDynkinClassification(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let algType = 'E';
  let algRank = 6;
  let selNode = 0;
  let subClean = null;

  const render = () => {
    subClean?.run();
    subClean = createClean();
    const alg = getAlgebra(algType, algRank);
    if (selNode >= alg.rank) selNode = 0;
    const nd = alg.dynkinNodes[selNode];
    const maxHC = Math.max(1, ...alg.heightCounts);

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Cartan–Killing Sınıflandırması (A_n, B_n, C_n, D_n, G₂, F₄, E₆, E₇, E₈)</h3>
          <button type="button" class="btn small ghost" data-doc>${icon('book')} Konu Anlatımı</button>
        </div>
        ${renderAlgebraPicker(algType, algRank)}
      </div>

      <div class="lie-kpis">
        <div class="lie-kpi acc"><span class="lie-kpi-lbl">Cebir</span><span class="lie-kpi-val">${tex(`${alg.latex} = ${alg.compactLatex}`)}</span><span class="lie-kpi-sub">Merkez: ${esc(alg.center)}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Rank / Boyut</span><span class="lie-kpi-val mono">r=${alg.rank} · dim=${alg.dimension}</span><span class="lie-kpi-sub">r + 2|Δ⁺| = ${alg.dimension}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Pozitif Kök |Δ⁺|</span><span class="lie-kpi-val mono">${alg.numPositiveRoots}</span><span class="lie-kpi-sub">toplam ${2 * alg.numPositiveRoots} kök</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Coxeter h / h∨</span><span class="lie-kpi-val mono">${alg.coxeterNumber} / ${alg.dualCoxeterNumber}</span><span class="lie-kpi-sub">${alg.simplyLaced ? 'eşit uzunluklu' : 'iki kök uzunluğu'}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Weyl Mertebesi |W|</span><span class="lie-kpi-val mono">${fmtBigInt(alg.weylOrder)}</span><span class="lie-kpi-sub">det(A) = ${alg.cartanDet}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Üsler (Exponents)</span><span class="lie-kpi-val mono">${alg.exponents.join(', ')}</span><span class="lie-kpi-sub">Casimir dereceleri: ${alg.casimirDegrees.join(', ')}</span></div>
      </div>

      ${alg.isomorphisms.length ? `<div class="lie-callout"><div class="small"><b>Düşük Rank İzomorfizması:</b> ${esc(alg.isomorphisms.join(' · '))}</div></div>` : ''}

      <div class="lie-grid-side">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Dynkin Diyagramı (Düğüme dokun → basit kökü incele)</h3>
            <div class="lie-super-legend">
              <span class="lie-swatch"><i class="long"></i> Uzun (|α|²=2)</span>
              <span class="lie-swatch"><i class="short"></i> Kısa</span>
            </div>
          </div>
          ${renderDynkinSvg(alg.dynkinNodes, alg.dynkinEdges, {
            selectedIdx: selNode,
            showMarks: true,
            showComarks: !alg.simplyLaced,
            ariaLabel: `${alg.name} Dynkin diyagramı`,
          })}
          <div class="lie-callout">
            <div class="row wrap" style="justify-content:space-between">
              <span><b>Seçili basit kök ${tex(`\\alpha_{${selNode + 1}}`)}:</b> ${nd.isLong ? 'Uzun kök' : 'Kısa kök'} (${tex(`|\\alpha_{${selNode + 1}}|^2 = ${ratLatex(alg.rootLengthsSq[selNode])}`)})</span>
              <span class="lie-pill acc">İşaret a = ${nd.mark}${nd.comark !== nd.mark ? ` · a∨ = ${nd.comark}` : ''}</span>
            </div>
            <div class="small">Ortonormal bazda: ${tex(`\\alpha_{${selNode + 1}} = ${alg.orthoLatex[selNode]}`)} · ω-etiketleri: <span class="mono">${fmtDynkin(alg.cartan[selNode])}</span></div>
          </div>
          <div class="small mute">En yüksek kök ${tex(`\\theta = ${alg.marks.map((m, i) => `${m === 1 ? '' : m}\\alpha_{${i + 1}}`).join(' + ')}`)} (yükseklik ${alg.highestRoot.height}, Dynkin: <span class="mono">${fmtDynkin(alg.highestRoot.dynkin)}</span>)</div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Kostant Kök Yükseklik Dağılımı → Üsler</h3></div>
          <div class="lie-bars" aria-label="Pozitif kök yükseklik histogramı">
            ${alg.heightCounts.map((cnt, idx) => `<div class="lie-bar-col">
              <span class="lie-bar-num">${cnt}</span>
              <div class="lie-bar-fill" style="height:${Math.max(8, Math.round((cnt / maxHC) * 76))}px"></div>
              <span class="lie-bar-h">h=${idx + 1}</span>
            </div>`).join('')}
          </div>
          <div class="small mute">Eşlenik parçalanış sütun uzunlukları tam olarak üsleri verir: <span class="mono">m = (${alg.exponents.join(', ')})</span>.</div>
        </div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Cartan Matrisi A (${alg.rank}×${alg.rank})</h3></div>
          <div class="lie-math-box">${tex(`A = ${intMatToLatex(alg.cartan)}`, true)}</div>
        </div>
        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Kuadratik Form Metriği G = (ωᵢ, ωⱼ)</h3></div>
          <div class="lie-math-box">${tex(`G = ${ratMatToLatex(alg.metricG)}`, true)}</div>
        </div>
      </div>

      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">§7.3 Rank-2 Kök Sistemleri Galerisi (A₂ · B₂ · C₂ · G₂)</h3>
          <span class="small mute">İzin verilen basit kök açıları: 120°, 135°, 150°</span>
        </div>
        <div class="lie-cv-box">
          <canvas class="lie-cv" data-r2-cv aria-label="Rank-2 kök sistemleri A2, B2, C2 ve G2 çizimi"></canvas>
        </div>
      </div>
    </div>`;

    bindAlgebraPicker(host, algType, algRank, (t, r) => { algType = t; algRank = r; selNode = 0; render(); });
    host.querySelector('[data-doc]').onclick = () => ctx?.jumpTo?.('lie-konu');
    host.querySelectorAll('[data-node]').forEach(g => {
      const pick = () => { selNode = +g.dataset.node; render(); };
      g.onclick = pick;
      g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });

    const cv = host.querySelector('[data-r2-cv]');
    setupCanvas(cv, w => (w > 640 ? 220 : 390), (c2d, W, H) => {
      c2d.clearRect(0, 0, W, H);
      const acc = accentColor();
      const list = [
        { alg: getAlgebra('A', 2), title: 'A₂ (120°, 6 kök)' },
        { alg: getAlgebra('B', 2), title: 'B₂ (135°, 8 kök)' },
        { alg: getAlgebra('C', 2), title: 'C₂ (135°, 8 kök)' },
        { alg: getAlgebra('G', 2), title: 'G₂ (150°, 12 kök)' },
      ];
      const cols = W > 640 ? 4 : 2;
      const rows = Math.ceil(4 / cols);
      const cw = W / cols, ch = H / rows;

      list.forEach((item, idx) => {
        const col = idx % cols, row = Math.floor(idx / cols);
        const cx = col * cw + cw / 2, cy = row * ch + ch * 0.56;
        const rad = Math.min(cw, ch) * 0.34;
        const scale = rad / Math.SQRT2;

        c2d.fillStyle = '#d4d4d8';
        c2d.font = '600 11.5px monospace';
        c2d.textAlign = 'center';
        c2d.fillText(item.title, cx, row * ch + 18);

        // Circle guide
        c2d.strokeStyle = 'rgba(255,255,255,0.08)';
        c2d.lineWidth = 1;
        c2d.beginPath(); c2d.arc(cx, cy, rad, 0, Math.PI * 2); c2d.stroke();

        for (const rt of item.alg.allRoots) {
          const [rx, ry] = rootTo2D(item.alg, rt.coords);
          const x2 = cx + rx * scale, y2 = cy - ry * scale;
          const isSimple = rt.positive && rt.height === 1;
          c2d.strokeStyle = isSimple ? (rt.coords[0] === 1 ? '#60a5fa' : '#f472b6') : rt.isLong ? acc : 'rgba(255,255,255,0.48)';
          c2d.lineWidth = isSimple ? 2.4 : 1.3;
          c2d.beginPath(); c2d.moveTo(cx, cy); c2d.lineTo(x2, y2); c2d.stroke();
          c2d.fillStyle = c2d.strokeStyle;
          c2d.beginPath(); c2d.arc(x2, y2, isSimple ? 3.5 : 2.3, 0, Math.PI * 2); c2d.fill();
        }
      });
    }, subClean);
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}

// =====================================================================
// TAB: KÖK SİSTEMİ GEZGİNİ
// =====================================================================
export function mountRootExplorer(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let algType = 'G';
  let algRank = 2;
  let betaIdx = 2;
  let alphaIdx = 1;
  let secondIdx = 0;

  const render = () => {
    const alg = getAlgebra(algType, algRank);
    if (betaIdx >= alg.positiveRoots.length) betaIdx = alg.positiveRoots.length - 1;
    if (secondIdx >= alg.positiveRoots.length) secondIdx = 0;
    if (alphaIdx >= alg.rank) alphaIdx = 0;

    const beta = alg.positiveRoots[betaIdx];
    const r2 = alg.positiveRoots[secondIdx];
    const str = rootString(alg, beta.coords, alphaIdx);
    const ip = rootInnerProduct(alg, beta.coords, r2.coords);
    const cosT = ratToNumber(ip) / Math.sqrt(ratToNumber(beta.normSq) * ratToNumber(r2.normSq));
    const angDeg = Math.round((Math.acos(Math.max(-1, Math.min(1, cosT))) * 180) / Math.PI);

    const fmtRoot = coords => {
      const parts = [];
      coords.forEach((v, i) => {
        if (!v) return;
        const abs = Math.abs(v);
        const sgn = v < 0 ? '-' : parts.length ? '+' : '';
        parts.push(`${sgn}${abs === 1 ? '' : abs}\\alpha_{${i + 1}}`);
      });
      return parts.length ? parts.join('') : '0';
    };

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Kök Sistemi Gezgini & Kök Dizisi Algoritması</h3>
          <span class="lie-pill acc">|Δ⁺| = ${alg.numPositiveRoots} pozitif kök</span>
        </div>
        ${renderAlgebraPicker(algType, algRank)}
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">α-Kök Dizisi (Root String) Doğrulayıcı</h3>
            <span class="lie-pill ok">p − q = ${str.p} − ${str.q} = ${str.cartanVal} ✓</span>
          </div>
          <div class="lie-toolbar-g">
            <label class="row" style="gap:6px"><span class="small mute">Kök β:</span>
              <select class="inp lie-sel" data-beta aria-label="Kök beta seç">
                ${alg.positiveRoots.map((rt, i) => `<option value="${i}" ${i === betaIdx ? 'selected' : ''}>#${i + 1} (h=${rt.height}) [${rt.coords.join(',')}]</option>`).join('')}
              </select>
            </label>
            <label class="row" style="gap:6px"><span class="small mute">Basit kök α_k:</span>
              <select class="inp lie-sel" data-ak aria-label="Basit kök seç">
                ${Array.from({ length: alg.rank }, (_, i) => `<option value="${i}" ${i === alphaIdx ? 'selected' : ''}>α${i + 1}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="lie-decomp">
            ${str.string.map(st => `<span class="lie-term" style="${st.k === 0 ? 'border-color:var(--acc)' : ''}">${tex(fmtRoot(st.coords))} <span class="mute small">(${st.k >= 0 ? `+${st.k}` : st.k})</span></span>`).join('<span class="mute">→</span>')}
          </div>
          <div class="small mute">Kural: ${tex(`p - q = \\frac{2(\\beta, \\alpha_{${alphaIdx + 1}})}{|\\alpha_{${alphaIdx + 1}}|^2} = ${str.cartanVal}`)} · ${tex(`\\beta = ${fmtRoot(beta.coords)}`)}.</div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">İç Çarpım & Açı Hesaplayıcı</h3>
            <span class="lie-pill acc">θ = ${angDeg}°</span>
          </div>
          <div class="lie-toolbar-g">
            <label class="row" style="gap:6px"><span class="small mute">İkinci kök γ:</span>
              <select class="inp lie-sel" data-r2 aria-label="İkinci kök gamma seç">
                ${alg.positiveRoots.map((rt, i) => `<option value="${i}" ${i === secondIdx ? 'selected' : ''}>#${i + 1} (h=${rt.height}) [${rt.coords.join(',')}]</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="lie-math-box">${tex(`(\\beta, \\gamma) = ${ratLatex(ip)}, \\quad |\\beta|^2 = ${ratLatex(beta.normSq)}, \\quad |\\gamma|^2 = ${ratLatex(r2.normSq)}, \\quad \\theta = ${angDeg}^\\circ`, true)}</div>
          <div class="small mute">En yüksek kök: ${tex(`\\theta = ${fmtRoot(alg.highestRoot.coords)}`)} (yükseklik ${alg.highestRoot.height}, ${tex('|\\theta|^2 = 2')}).</div>
        </div>
      </div>

      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Tüm Pozitif Kökler (${alg.positiveRoots.length} adet — satıra dokunup β yap)</h3>
        </div>
        <div class="lie-table-wrap" style="max-height:400px;overflow-y:auto">
          <table class="lie-tbl" aria-label="${esc(alg.name)} pozitif kökler tablosu">
            <thead><tr><th scope="col">#</th><th scope="col">Yükseklik</th><th scope="col">α-Bazı</th><th scope="col">ω-Bazı (Dynkin)</th><th scope="col">|β|²</th><th scope="col">Tür</th></tr></thead>
            <tbody>${alg.positiveRoots.map((rt, i) => `<tr class="clickable ${i === betaIdx ? 'on' : ''}" data-pickr="${i}">
              <td class="mono mute">${i + 1}</td>
              <td class="mono">${rt.height}</td>
              <td>${tex(fmtRoot(rt.coords))}</td>
              <td class="mono">${fmtDynkin(rt.dynkin)}</td>
              <td>${tex(ratLatex(rt.normSq))}</td>
              <td><span class="lie-pill ${rt.isLong ? 'acc' : ''}">${rt.isLong ? 'Uzun' : 'Kısa'}</span></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>`;

    bindAlgebraPicker(host, algType, algRank, (t, r) => { algType = t; algRank = r; betaIdx = 0; alphaIdx = 0; secondIdx = 0; render(); });
    host.querySelector('[data-beta]').onchange = e => { betaIdx = +e.target.value; render(); };
    host.querySelector('[data-ak]').onchange = e => { alphaIdx = +e.target.value; render(); };
    host.querySelector('[data-r2]').onchange = e => { secondIdx = +e.target.value; render(); };
    host.querySelectorAll('[data-pickr]').forEach(tr => { tr.onclick = () => { betaIdx = +tr.dataset.pickr; render(); }; });
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: WEYL GRUBU (Animated Rank-2 Orbit + Higher-Rank Length & Words)
// =====================================================================
export function mountWeylGroup(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let algType = 'A';
  let algRank = 2;
  let startW = [2, 1];
  let curW = [2, 1];
  let wordHist = [];
  let playingOrbit = false;
  let animStep = 0;
  let animT = 0;
  let subClean = null;

  const ensureWLen = r => {
    while (startW.length < r) startW.push(0);
    if (startW.length > r) startW = startW.slice(0, r);
    curW = startW.slice();
    wordHist = [];
  };

  const render = () => {
    subClean?.run();
    subClean = createClean();
    const alg = getAlgebra(algType, algRank);
    if (startW.length !== alg.rank) ensureWLen(alg.rank);
    const orbit = weylOrbit(alg, startW, { maxSize: 200 });
    const domRes = toDominantWeight(alg, curW);
    const smallW = alg.weylOrderNum <= 120 ? weylGroupElements(alg, { maxSize: 125 }) : null;

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Weyl Grubu, Yansımalar & Uzunluk Fonksiyonu</h3>
          <span class="lie-pill acc">|W(${alg.name})| = ${fmtBigInt(alg.weylOrder)}</span>
        </div>
        ${renderAlgebraPicker(algType, algRank, { maxRank: 4 })}
        <div class="lie-toolbar">
          <div class="lie-dynkin-inputs">
            <span class="small mute">Başlangıç ağırlığı λ:</span>
            ${startW.map((v, i) => `<div class="lie-dynkin-in"><span>a${i + 1}</span><input type="number" class="inp mono lie-num" data-sw="${i}" min="-4" max="4" value="${v}" aria-label="Ağırlık bileşeni ${i + 1}"></div>`).join('')}
          </div>
          <div class="lie-toolbar-g">
            ${Array.from({ length: alg.rank }, (_, i) => `<button type="button" class="btn small" data-ref="${i}" aria-label="s_${i + 1} yansımasını uygula">s_${i + 1} uygula</button>`).join('')}
            <button type="button" class="btn small ghost" data-wreset>Sıfırla</button>
          </div>
        </div>
      </div>

      <div class="lie-grid-side">
        ${alg.rank === 2 ? `<div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Canlı Rank-2 Weyl Yörüngesi & Yansıma Hiperdüzlemleri</h3>
            <button type="button" class="btn small primary" data-play-orb>${icon(playingOrbit ? 'pause' : 'play')} ${playingOrbit ? 'Duraklat' : 'Yörüngeyi Canlandır'}</button>
          </div>
          <div class="lie-cv-box">
            <canvas class="lie-cv" data-weyl-cv aria-label="${esc(alg.name)} Weyl yörüngesi tuvali"></canvas>
            <div class="lie-cv-badge">Kesikli çizgiler: kök hiperdüzlemleri · Gölgeli dilim: baskın Weyl odası</div>
          </div>
        </div>` : `<div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Weyl Yörüngesi W · λ (${orbit.size} ağırlık)</h3>
          </div>
          <div class="lie-table-wrap" style="max-height:340px;overflow-y:auto">
            <table class="lie-tbl" aria-label="Weyl yörüngesi ağırlıkları">
              <thead><tr><th scope="col">Ağırlık</th><th scope="col">Uzunluk ℓ</th><th scope="col">İndirgenmiş Kelime</th></tr></thead>
              <tbody>${orbit.weights.slice(0, 60).map(item => `<tr>
                <td class="mono">${fmtDynkin(item.dynkin)}</td>
                <td class="mono">${item.length}</td>
                <td class="mono mute">${item.word.length ? item.word.map(x => `s${x + 1}`).join('·') : 'e'}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>`}

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Güncel Ağırlık & Baskın Odaya İndirgeme</h3>
            <span class="lie-pill acc">|W·λ| = ${orbit.size}</span>
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi acc"><span class="lie-kpi-lbl">Mevcut w(λ)</span><span class="lie-kpi-val mono">${fmtDynkin(curW)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Uygulanan Kelime</span><span class="lie-kpi-val mono">${wordHist.length ? wordHist.map(i => `s${i + 1}`).join('·') : 'e'}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Baskın Temsilci</span><span class="lie-kpi-val mono">${fmtDynkin(domRes.dominant)}</span><span class="lie-kpi-sub">${domRes.flips} yansıma, det = ${domRes.sign > 0 ? '+1' : '−1'}</span></div>
          </div>
          ${smallW ? `<div class="small mute">Poincaré Polinomu ${tex(`P_W(t) = ${smallW.poincarePoly.map((c, l) => (l === 0 ? `${c}` : `${c === 1 ? '' : c}t${l === 1 ? '' : `^{${l}}`}`)).join(' + ')}`)}</div>
          <div class="lie-table-wrap" style="max-height:240px;overflow-y:auto">
            <table class="lie-tbl" aria-label="Weyl grubu elemanları">
              <thead><tr><th scope="col">w</th><th scope="col">ℓ(w)</th><th scope="col">det(w)</th><th scope="col">w(ρ)</th></tr></thead>
              <tbody>${smallW.elements.slice(0, 48).map(el => `<tr>
                <td class="mono">${el.word.length ? el.word.map(x => `s${x + 1}`).join('') : 'e'}</td>
                <td class="mono">${el.length}</td>
                <td class="mono">${el.sign > 0 ? '+1' : '−1'}</td>
                <td class="mono mute">${fmtDynkin(el.wRho)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>` : `<p class="small mute">|W| = ${fmtBigInt(alg.weylOrder)} > 120 olduğu için tam grup listesi yerine yörünge ve indirgeme gösterilir.</p>`}
        </div>
      </div>
    </div>`;

    if (alg.rank === 2) {
      const cv = host.querySelector('[data-weyl-cv]');
      const drawWeyl = (c2d, W, H) => {
        c2d.clearRect(0, 0, W, H);
        const acc = accentColor();
        const cx = W / 2, cy = H / 2;
        let maxR = 1.4;
        for (const w of orbit.weights) {
          const r = Math.hypot(w.pos2D[0], w.pos2D[1]);
          if (r > maxR) maxR = r;
        }
        const scale = (Math.min(W, H) * 0.39) / maxR;
        const toXY = ([x, y]) => [cx + x * scale, cy - y * scale];

        // Shaded dominant Weyl chamber (cone spanned by omega_1, omega_2)
        const [w1x, w1y] = alg.basis2D.weights[0];
        const [w2x, w2y] = alg.basis2D.weights[1];
        const far = maxR * 1.4;
        c2d.fillStyle = 'rgba(91, 228, 155, 0.09)';
        c2d.beginPath();
        c2d.moveTo(cx, cy);
        c2d.lineTo(...toXY([w1x * far, w1y * far]));
        c2d.lineTo(...toXY([w2x * far, w2y * far]));
        c2d.closePath();
        c2d.fill();

        // Reflection hyperplanes perpendicular to every positive root
        c2d.save();
        c2d.setLineDash([4, 4]);
        c2d.strokeStyle = 'rgba(255,255,255,0.18)';
        c2d.lineWidth = 1.1;
        for (const rt of alg.positiveRoots) {
          const [rx, ry] = rootTo2D(alg, rt.coords);
          const rn = Math.hypot(rx, ry) || 1;
          const px = (-ry / rn) * maxR * 1.25, py = (rx / rn) * maxR * 1.25;
          const [x1, y1] = toXY([-px, -py]);
          const [x2, y2] = toXY([px, py]);
          c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke();
        }
        c2d.restore();

        // Orbit reflection edges
        for (const ed of orbit.edges) {
          const [x1, y1] = toXY(orbit.weights[ed.from].pos2D);
          const [x2, y2] = toXY(orbit.weights[ed.to].pos2D);
          c2d.strokeStyle = ed.gen === 0 ? 'rgba(96,165,250,0.45)' : 'rgba(244,114,182,0.45)';
          c2d.lineWidth = 1.6;
          c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke();
        }

        // Orbit points
        for (const item of orbit.weights) {
          const [px, py] = toXY(item.pos2D);
          const isCur = item.dynkin[0] === curW[0] && item.dynkin[1] === curW[1];
          c2d.fillStyle = isCur ? '#ffd166' : acc;
          c2d.beginPath(); c2d.arc(px, py, isCur ? 7.5 : 5, 0, Math.PI * 2); c2d.fill();
          c2d.fillStyle = isCur ? '#ffd166' : '#d4d4d8';
          c2d.font = '500 10px monospace';
          c2d.fillText(fmtDynkin(item.dynkin), px + 8, py - 4);
        }

        // Animated moving tracer along orbit when playing
        if (playingOrbit && orbit.weights.length > 1) {
          const a = orbit.weights[animStep % orbit.weights.length];
          const b = orbit.weights[(animStep + 1) % orbit.weights.length];
          const ease = animT * animT * (3 - 2 * animT);
          const tx = a.pos2D[0] + (b.pos2D[0] - a.pos2D[0]) * ease;
          const ty = a.pos2D[1] + (b.pos2D[1] - a.pos2D[1]) * ease;
          const [px, py] = toXY([tx, ty]);
          c2d.strokeStyle = '#ffd166';
          c2d.lineWidth = 2.4;
          c2d.beginPath(); c2d.arc(px, py, 11, 0, Math.PI * 2); c2d.stroke();
        }
      };

      const cvCtrl = setupCanvas(cv, w => Math.min(370, Math.max(270, Math.round(w * 0.72))), drawWeyl, subClean);
      const loop = createAnimLoop((_now, dt) => {
        if (!playingOrbit) return false;
        const speed = motion() === 'reduced' ? 0.6 : 1.3;
        animT += dt * speed;
        if (animT >= 1) {
          animT = 0;
          animStep = (animStep + 1) % Math.max(1, orbit.weights.length);
          curW = orbit.weights[animStep].dynkin.slice();
          wordHist = orbit.weights[animStep].word.slice();
        }
        cvCtrl.render();
        return true;
      }, subClean);

      if (playingOrbit && motion() !== 'off') loop.start();

      host.querySelector('[data-play-orb]').onclick = () => {
        if (motion() === 'off') {
          animStep = (animStep + 1) % Math.max(1, orbit.weights.length);
          curW = orbit.weights[animStep].dynkin.slice();
          wordHist = orbit.weights[animStep].word.slice();
          render();
          return;
        }
        playingOrbit = !playingOrbit;
        if (playingOrbit) loop.start(); else loop.stop();
        render();
      };
    }

    bindAlgebraPicker(host, algType, algRank, (t, r) => {
      playingOrbit = false;
      algType = t; algRank = r;
      startW = Array(r).fill(0); startW[0] = 1; if (r > 1) startW[1] = 1;
      curW = startW.slice(); wordHist = [];
      render();
    }, { maxRank: 4 });

    host.querySelectorAll('[data-sw]').forEach(inp => {
      inp.onchange = () => {
        startW[+inp.dataset.sw] = Math.max(-4, Math.min(4, Math.trunc(+inp.value) || 0));
        curW = startW.slice(); wordHist = [];
        render();
      };
    });
    host.querySelectorAll('[data-ref]').forEach(btn => {
      btn.onclick = () => {
        playingOrbit = false;
        const idx = +btn.dataset.ref;
        curW = reflectWeight(alg, curW, idx);
        wordHist = [idx, ...wordHist];
        render();
      };
    });
    host.querySelector('[data-wreset]').onclick = () => {
      playingOrbit = false; curW = startW.slice(); wordHist = []; render();
    };
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}

// =====================================================================
// TAB: TEMSİL HESAPLAYICISI (Up to Rank 8: Weyl dim, Casimir, Index, Weights)
// =====================================================================
export function mountRepCalculator(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let algType = 'D';
  let algRank = 5;
  let hw = [0, 0, 0, 0, 1]; // SO(10) spinor 16!
  let showWeights = true;

  const FAMOUS = [
    { lbl: 'SO(10) 16 spinör', t: 'D', r: 5, hw: [0, 0, 0, 0, 1] },
    { lbl: 'SO(10) 10 vektör', t: 'D', r: 5, hw: [1, 0, 0, 0, 0] },
    { lbl: 'E₆ 27 temel', t: 'E', r: 6, hw: [1, 0, 0, 0, 0, 0] },
    { lbl: 'E₇ 56 temel', t: 'E', r: 7, hw: [0, 0, 0, 0, 0, 1, 0] },
    { lbl: 'E₈ 248 eklenik', t: 'E', r: 8, hw: [0, 0, 0, 0, 0, 0, 1, 0] },
    { lbl: 'G₂ 7 temel', t: 'G', r: 2, hw: [0, 1] },
    { lbl: 'F₄ 26 temel', t: 'F', r: 4, hw: [0, 0, 0, 1] },
    { lbl: 'SU(5) 10', t: 'A', r: 4, hw: [0, 1, 0, 0] },
  ];

  const render = () => {
    const alg = getAlgebra(algType, algRank);
    if (hw.length !== alg.rank) {
      hw = Array(alg.rank).fill(0);
      hw[0] = 1;
    }
    const dim = weylDimension(alg, hw);
    const c2 = casimirC2(alg, hw);
    const idxT = dynkinIndex(alg, hw);
    const conj = conjugateWeight(alg, hw);
    const real = repReality(alg, hw);
    const cong = congruenceClass(alg, hw);
    const funds = fundamentalReps(alg);
    const canComputeWS = dim <= 600n;
    const ws = showWeights && canComputeWS ? weightSystem(alg, hw, { maxWeights: 600 }) : null;

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">İndirgenemez Temsil Hesaplayıcısı (Rank 1–8)</h3>
          <span class="lie-pill acc">${esc(CASIMIR_NORMALIZATION)}</span>
        </div>
        ${renderAlgebraPicker(algType, algRank)}
        <div class="lie-chips" aria-label="Ünlü fizik temsilleri">
          ${FAMOUS.map((f, i) => `<button type="button" class="lie-chip" data-famr="${i}">${esc(f.lbl)}</button>`).join('')}
        </div>
        <div class="lie-dynkin-inputs">
          <span class="small mute">En yüksek ağırlık Λ =</span>
          ${hw.map((v, i) => `<div class="lie-dynkin-in"><span>a${i + 1}</span><input type="number" class="inp mono lie-num" data-rhw="${i}" min="0" max="6" value="${v}" aria-label="Dynkin etiketi ${i + 1}"></div>`).join('')}
        </div>
      </div>

      <div class="lie-kpis">
        <div class="lie-kpi acc"><span class="lie-kpi-lbl">Boyut dim(Λ)</span><span class="lie-kpi-val mono">${fmtBigInt(dim)}</span><span class="lie-kpi-sub">${tex(`${alg.latex},\\; \\Lambda=${fmtDynkin(hw)}`)}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Kuadratik Casimir C₂</span><span class="lie-kpi-val">${tex(ratLatex(c2))}</span><span class="lie-kpi-sub">${ratToNumber(c2).toFixed(4)}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Dynkin İndeksi T(Λ)</span><span class="lie-kpi-val">${tex(ratLatex(idxT))}</span><span class="lie-kpi-sub">${ratToNumber(idxT).toFixed(4)}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Gerçellik</span><span class="lie-kpi-val">${esc(real.symbol)} ${esc(real.label.split(' ')[0])}</span><span class="lie-kpi-sub">Eşlenik: ${fmtDynkin(conj)}</span></div>
        <div class="lie-kpi"><span class="lie-kpi-lbl">Denklik / N-lik</span><span class="lie-kpi-val mono">${esc(cong.label)}</span><span class="lie-kpi-sub">Merkez: ${esc(cong.group)}</span></div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">${alg.name} Temel Temsilleri (Dokunup Yükle)</h3></div>
          <div class="lie-table-wrap">
            <table class="lie-tbl" aria-label="${esc(alg.name)} temel temsilleri">
              <thead><tr><th scope="col">ωᵢ</th><th scope="col">Boyut</th><th scope="col">C₂</th><th scope="col">T(ωᵢ)</th><th scope="col">Tür</th></tr></thead>
              <tbody>${funds.map((f, i) => `<tr class="clickable" data-pickf="${i}">
                <td class="mono">ω${f.index} ${fmtDynkin(f.hw)}</td>
                <td class="mono"><b>${fmtBigInt(f.dim)}</b></td>
                <td>${tex(ratLatex(f.casimir))}</td>
                <td>${tex(ratLatex(f.indexT))}</td>
                <td class="small">${esc(f.reality.symbol)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Freudenthal Ağırlık Sistemi</h3>
            ${canComputeWS ? `<span class="lie-pill ok">∑ m(μ) = ${ws?.totalMult ?? dim} ✓</span>` : `<span class="lie-pill warn">dim > 600 (kapalı)</span>`}
          </div>
          ${ws ? `<div class="small mute">Farklı ağırlık: <b>${ws.distinctWeights}</b> · Baskın ağırlık: <b>${ws.dominantWeights.length}</b></div>
          <div class="lie-table-wrap" style="max-height:320px;overflow-y:auto">
            <table class="lie-tbl" aria-label="Freudenthal baskın ağırlıklar ve katlılıklar">
              <thead><tr><th scope="col">Ağırlık (Dynkin)</th><th scope="col">Katlılık m(μ)</th><th scope="col">Derinlik</th><th scope="col">Baskın</th></tr></thead>
              <tbody>${ws.weights.slice(0, 80).map(w => `<tr class="${w.isDominant ? 'on' : ''}">
                <td class="mono">${fmtDynkin(w.dynkin)}</td>
                <td class="mono"><b>${w.mult}</b></td>
                <td class="mono mute">${w.depth}</td>
                <td>${w.isDominant ? '<span class="lie-pill ok">Baskın</span>' : ''}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>${ws.weights.length > 80 ? `<div class="small mute">İlk 80 ağırlık gösteriliyor (toplam ${ws.weights.length}).</div>` : ''}` : `<p class="small mute">Boyut ${fmtBigInt(dim)} olduğu için tam ağırlık listesi bellek koruması gereği atlandı; Weyl boyut, Casimir ve Dynkin indeksi tam BigInt kesirle hesaplandı.</p>`}
        </div>
      </div>
    </div>`;

    bindAlgebraPicker(host, algType, algRank, (t, r) => {
      algType = t; algRank = r; hw = Array(r).fill(0); hw[0] = 1; render();
    });
    host.querySelectorAll('[data-famr]').forEach(b => {
      b.onclick = () => {
        const f = FAMOUS[+b.dataset.famr];
        algType = f.t; algRank = f.r; hw = f.hw.slice(); render();
      };
    });
    host.querySelectorAll('[data-rhw]').forEach(inp => {
      inp.onchange = () => {
        hw[+inp.dataset.rhw] = Math.max(0, Math.min(6, Math.trunc(+inp.value) || 0));
        render();
      };
    });
    host.querySelectorAll('[data-pickf]').forEach(tr => {
      tr.onclick = () => {
        hw = Array(alg.rank).fill(0);
        hw[+tr.dataset.pickf] = 1;
        render();
      };
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: TENSÖR ÇARPIMLARI (Brauer-Klimyk + Sym²/Alt² Adams)
// =====================================================================
export function mountTensorProducts(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let algType = 'A';
  let algRank = 2;
  let hw1 = [1, 1];
  let hw2 = [1, 1];

  const PRESETS = [
    { lbl: 'SU(3): 3 ⊗ 3', t: 'A', r: 2, a: [1, 0], b: [1, 0] },
    { lbl: 'SU(3): 3 ⊗ 3̄', t: 'A', r: 2, a: [1, 0], b: [0, 1] },
    { lbl: 'SU(3): 8 ⊗ 8', t: 'A', r: 2, a: [1, 1], b: [1, 1] },
    { lbl: 'SU(3): 6 ⊗ 3̄', t: 'A', r: 2, a: [2, 0], b: [0, 1] },
    { lbl: 'SU(4): 4 ⊗ 4', t: 'A', r: 3, a: [1, 0, 0], b: [1, 0, 0] },
    { lbl: 'SO(5): 4 ⊗ 4', t: 'B', r: 2, a: [0, 1], b: [0, 1] },
    { lbl: 'G₂: 7 ⊗ 7', t: 'G', r: 2, a: [0, 1], b: [0, 1] },
    { lbl: 'SU(5): 5 ⊗ 10', t: 'A', r: 4, a: [1, 0, 0, 0], b: [0, 1, 0, 0] },
    { lbl: 'SO(10): 16 ⊗ 16', t: 'D', r: 5, a: [0, 0, 0, 0, 1], b: [0, 0, 0, 0, 1] },
  ];

  const render = () => {
    const alg = getAlgebra(algType, algRank);
    if (hw1.length !== alg.rank) { hw1 = Array(alg.rank).fill(0); hw1[0] = 1; }
    if (hw2.length !== alg.rank) { hw2 = Array(alg.rank).fill(0); hw2[0] = 1; }
    const tp = tensorProduct(alg, hw1, hw2, { maxWeights: 1500 });
    const same = hw1.every((v, i) => v === hw2[i]);
    const sq = same && !tp.truncated ? symmetricAntisymmetricSquare(alg, hw1, { maxWeights: 1000 }) : null;

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Tensör Çarpımı Ayrıştırıcısı (Brauer–Klimyk & Adams Sym²/Alt²)</h3>
          <span class="lie-pill acc">${alg.name} (${alg.compactGroup})</span>
        </div>
        ${renderAlgebraPicker(algType, algRank, { maxRank: 5 })}
        <div class="lie-chips">
          ${PRESETS.map((p, i) => `<button type="button" class="lie-chip" data-tpp="${i}">${esc(p.lbl)}</button>`).join('')}
        </div>
        <div class="lie-grid-2">
          <div class="lie-dynkin-inputs">
            <span class="small mute">R₁ (dim ${fmtBigInt(tp.dim1)}):</span>
            ${hw1.map((v, i) => `<div class="lie-dynkin-in"><span>a${i + 1}</span><input type="number" class="inp mono lie-num" data-h1="${i}" min="0" max="4" value="${v}" aria-label="R1 bileşen ${i + 1}"></div>`).join('')}
          </div>
          <div class="lie-dynkin-inputs">
            <span class="small mute">R₂ (dim ${fmtBigInt(tp.dim2)}):</span>
            ${hw2.map((v, i) => `<div class="lie-dynkin-in"><span>b${i + 1}</span><input type="number" class="inp mono lie-num" data-h2="${i}" min="0" max="4" value="${v}" aria-label="R2 bileşen ${i + 1}"></div>`).join('')}
          </div>
        </div>
      </div>

      ${tp.truncated ? `<div class="lie-callout bad"><b>Temsil çok büyük:</b> Daha küçük ağırlıklar seçin (ağırlık sayısı 1500 sınırını aştı).</div>` : `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">İndirgenemez Ayrışım</h3>
          <div class="lie-toolbar-g">
            <span class="lie-pill ${tp.dimCheck ? 'ok' : 'bad'}">Boyut: ${fmtBigInt(tp.dim1)} × ${fmtBigInt(tp.dim2)} = ${fmtBigInt(tp.sumDim)} ${tp.dimCheck ? '✓' : '✗'}</span>
            <span class="lie-pill ${tp.indexCheck ? 'ok' : 'bad'}">İndeks kuralı: T = ${ratFormat(tp.sumIndex)} ${tp.indexCheck ? '✓' : '✗'}</span>
          </div>
        </div>
        <div class="lie-decomp">
          ${tp.terms.map(t => `<span class="lie-term">${t.mult > 1 ? `${t.mult}·` : ''}<b>${fmtBigInt(t.dim)}</b> <span class="small mute">${fmtDynkin(t.hw)}</span></span>`).join('<span class="mute">⊕</span>')}
        </div>

        ${sq && !sq.truncated ? `<div class="lie-grid-2">
          <div class="lie-callout">
            <div class="lie-panel-title">Simetrik Kare Sym²(R) — Boyut ${fmtBigInt(sq.symDim)}</div>
            <div class="lie-chips">${sq.sym.map(t => `<span class="lie-pill acc">${t.mult > 1 ? `${t.mult}·` : ''}${fmtBigInt(t.dim)} ${fmtDynkin(t.hw)}</span>`).join('')}</div>
          </div>
          <div class="lie-callout">
            <div class="lie-panel-title">Antisimetrik Kare Alt²(R) — Boyut ${fmtBigInt(sq.altDim)}</div>
            <div class="lie-chips">${sq.alt.map(t => `<span class="lie-pill warn">${t.mult > 1 ? `${t.mult}·` : ''}${fmtBigInt(t.dim)} ${fmtDynkin(t.hw)}</span>`).join('')}</div>
          </div>
        </div>` : ''}

        <div class="lie-table-wrap">
          <table class="lie-tbl" aria-label="Tensör çarpımı terimleri tablosu">
            <thead><tr><th scope="col">Katlılık</th><th scope="col">Boyut</th><th scope="col">Dynkin Etiketleri</th><th scope="col">Casimir C₂</th><th scope="col">Dynkin İndeksi T</th><th scope="col">Gerçellik</th></tr></thead>
            <tbody>${tp.terms.map(t => `<tr>
              <td class="mono">${t.mult}×</td>
              <td class="mono"><b>${fmtBigInt(t.dim)}</b></td>
              <td class="mono">${fmtDynkin(t.hw)}</td>
              <td>${tex(ratLatex(t.casimir))}</td>
              <td>${tex(ratLatex(t.indexT))}</td>
              <td>${esc(t.reality.symbol)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`}
    </div>`;

    bindAlgebraPicker(host, algType, algRank, (t, r) => {
      algType = t; algRank = r;
      hw1 = Array(r).fill(0); hw1[0] = 1;
      hw2 = Array(r).fill(0); hw2[0] = 1;
      render();
    }, { maxRank: 5 });

    host.querySelectorAll('[data-tpp]').forEach(b => {
      b.onclick = () => {
        const p = PRESETS[+b.dataset.tpp];
        algType = p.t; algRank = p.r; hw1 = p.a.slice(); hw2 = p.b.slice();
        render();
      };
    });
    host.querySelectorAll('[data-h1]').forEach(inp => {
      inp.onchange = () => { hw1[+inp.dataset.h1] = Math.max(0, Math.min(4, Math.trunc(+inp.value) || 0)); render(); };
    });
    host.querySelectorAll('[data-h2]').forEach(inp => {
      inp.onchange = () => { hw2[+inp.dataset.h2] = Math.max(0, Math.min(4, Math.trunc(+inp.value) || 0)); render(); };
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: YOUNG TABLOLARI (SU(N) Hook-Content & Dynkin Conversion)
// =====================================================================
export function mountYoungSUN(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let N = 4;
  let rows = [2, 1, 0];
  let selBox = null;

  const ensureRows = () => {
    const target = N - 1;
    while (rows.length < target) rows.push(0);
    if (rows.length > target) rows = rows.slice(0, target);
    for (let i = 1; i < rows.length; i++) if (rows[i] > rows[i - 1]) rows[i] = rows[i - 1];
  };

  const render = () => {
    ensureRows();
    const y = youngHooksAndContents(rows, N);
    const alg = getAlgebra('A', N - 1);
    const wDim = weylDimension(alg, y.dynkin);
    const c2 = casimirC2(alg, y.dynkin);
    const idxT = dynkinIndex(alg, y.dynkin);
    const conjPart = youngConjugate(rows, N);

    const cell = 46;
    const maxCol = Math.max(1, ...rows);
    const visRows = Math.max(1, y.partition.length);
    const svgW = maxCol * cell + 28;
    const svgH = visRows * cell + 28;

    const inHook = b => selBox && ((b.row === selBox.row && b.col >= selBox.col) || (b.col === selBox.col && b.row >= selBox.row));

    const boxesSvg = y.boxes.map(b => {
      const x = 14 + b.col * cell, yy = 14 + b.row * cell;
      const hi = inHook(b);
      return `<g data-ybox="${b.row},${b.col}" style="cursor:pointer" role="button" tabindex="0" aria-label="Satır ${b.row + 1} sütun ${b.col + 1}, içerik ${b.content}, kanca ${b.hook}">
        <rect class="lie-young-box" x="${x}" y="${yy}" width="${cell - 3}" height="${cell - 3}" rx="6" style="${hi ? 'fill:color-mix(in srgb, var(--acc) 26%, rgba(0,0,0,0.4));stroke:var(--acc);stroke-width:2.2' : ''}"/>
        <text x="${x + (cell - 3) / 2}" y="${yy + 16}" fill="#5be49b" font-family="var(--mono),monospace" font-size="11.5" font-weight="600" text-anchor="middle">${b.content}</text>
        <text x="${x + (cell - 3) / 2}" y="${yy + 34}" fill="#ffd166" font-family="var(--mono),monospace" font-size="11.5" font-weight="600" text-anchor="middle">h=${b.hook}</text>
      </g>`;
    }).join('');

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-toolbar">
          <div class="lie-chips" role="group" aria-label="SU(N) için N seçimi">
            ${[2, 3, 4, 5, 6, 7, 8].map(k => `<button type="button" class="lie-chip ${k === N ? 'on' : ''}" data-yn="${k}">SU(${k})</button>`).join('')}
          </div>
          <div class="lie-chips">
            <button type="button" class="lie-chip" data-yp="fund">Temel</button>
            <button type="button" class="lie-chip" data-yp="adj">Eklenik</button>
            <button type="button" class="lie-chip" data-yp="sym2">Sym²</button>
            <button type="button" class="lie-chip" data-yp="alt2">Alt²</button>
            <button type="button" class="lie-chip" data-yp="conj">Eşlenik ⇄</button>
          </div>
        </div>
      </div>

      <div class="lie-grid-side">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">SU(${N}) Young Diyagramı (Üst yeşil: içerik N+j−i · Alt sarı: kanca h)</h3>
            <span class="lie-pill ${y.dim === wDim ? 'ok' : 'bad'}">dim = ${fmtBigInt(y.dim)} (Weyl: ${fmtBigInt(wDim)} ✓)</span>
          </div>
          <div class="lie-svg-scroll">
            ${y.boxes.length
              ? `<svg class="lie-dynkin-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="SU(${N}) Young diyagramı">${boxesSvg}</svg>`
              : `<div class="small mute" style="padding:20px">Aşikar tekli temsil <b>1</b> (0 kutu)</div>`}
          </div>
          <div class="lie-math-box">${tex(`\\dim_{SU(${N})} = \\frac{\\prod (N+j-i)}{\\prod h_{ij}} = \\frac{${y.numerator}}{${y.denominator}} = ${y.dim}`, true)}</div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Satır Uzunlukları & Dynkin Dönüşümü</h3></div>
          <div class="lie-young-rows">
            ${rows.map((len, i) => `<div class="lie-young-row">
              <span class="mono small mute" style="width:52px">λ_${i + 1} = <b>${len}</b></span>
              <button type="button" class="btn small" data-rdec="${i}" aria-label="${i + 1}. satırı azalt">−</button>
              <button type="button" class="btn small" data-rinc="${i}" aria-label="${i + 1}. satırı artır">+</button>
              <span class="small mute">a_${i + 1} = λ_${i + 1} − λ_${i + 2} = <b>${y.dynkin[i]}</b></span>
            </div>`).join('')}
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi acc"><span class="lie-kpi-lbl">Dynkin Etiketleri</span><span class="lie-kpi-val mono">${fmtDynkin(y.dynkin)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">${N}-lik (N-ality)</span><span class="lie-kpi-val mono">${y.nAlity} (mod ${N})</span><span class="lie-kpi-sub">${y.totalBoxes} kutu</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Casimir C₂ / İndeks T</span><span class="lie-kpi-val">${tex(`${ratLatex(c2)}\\; / \\; ${ratLatex(idxT)}`)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Eşlenik Parçalanış</span><span class="lie-kpi-val mono">[${conjPart.filter(Boolean).join(', ') || '0'}]</span></div>
          </div>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-yn]').forEach(b => {
      b.onclick = () => { N = +b.dataset.yn; selBox = null; ensureRows(); render(); };
    });
    host.querySelectorAll('[data-yp]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.yp;
        selBox = null;
        rows = Array(N - 1).fill(0);
        if (k === 'fund') rows[0] = 1;
        else if (k === 'sym2') rows[0] = 2;
        else if (k === 'alt2') { rows[0] = 1; if (N >= 3) rows[1] = 1; }
        else if (k === 'adj') { rows[0] = 2; for (let i = 1; i < N - 1; i++) rows[i] = 1; }
        else if (k === 'conj') { rows = conjPart.slice(); }
        render();
      };
    });
    host.querySelectorAll('[data-rinc]').forEach(b => {
      b.onclick = () => {
        const i = +b.dataset.rinc;
        const cap = i === 0 ? 7 : rows[i - 1];
        if (rows[i] < cap) rows[i]++;
        selBox = null; render();
      };
    });
    host.querySelectorAll('[data-rdec]').forEach(b => {
      b.onclick = () => {
        const i = +b.dataset.rdec;
        const floor = i === rows.length - 1 ? 0 : rows[i + 1];
        if (rows[i] > floor) rows[i]--;
        selBox = null; render();
      };
    });
    host.querySelectorAll('[data-ybox]').forEach(g => {
      g.onclick = () => {
        const [r, col] = g.dataset.ybox.split(',').map(Number);
        selBox = selBox && selBox.row === r && selBox.col === col ? null : { row: r, col };
        render();
      };
    });
  };

  render();
  return clean.run;
}
