// MathPad Physics & Exceptional Structures (Ramond Part C) — Chapter: uzayzaman
// Covers Ramond Ch. 11: Lorentz SO(3,1), SL(2,C), Poincaré, Conformal SO(4,2),
// Color & Quarks, Gauge Theories, Standard Model & Anomalies, GUT (SU(5), SO(10), E6), Family Symmetries.
import { esc, icon } from './ui.js';
import { syncSegments } from './fx.js';
import {
  matMul4,
  apply4,
  minkowskiDot,
  lorentzBoost,
  lorentzRotation,
  verifyMetricPreservation,
  rapidityAdd,
  velocityAdd,
  sl2cBoost,
  sl2cRotation,
  sl2cToLorentz,
  sl2cDet,
  lorentzIrrep,
  LORENTZ_REPS_CATALOG,
  poincareCasimirs,
  conformalGenerators,
  conformalTransform2D,
  checkConformality2D,
  frac,
  fracStr,
  fracTex,
  QUARKS,
  COLOR_STATES,
  checkColorSinglet,
  buildHadron,
  GAUGE_GROUPS,
  SM_FAMILY,
  checkElectricCharges,
  computeAnomalies,
  electroweakBreaking,
  SU5_FIVE_BAR,
  SU5_TEN,
  SU5_GAUGE_24,
  computeSu5WeinbergAngle,
  SO10_SPINOR_16,
  E6_FUND_27,
  pmnsMatrix,
  verifyUnitary3,
  verifyTbmSymmetry,
  neutrinoOscillationProbs,
  FAMILY_SUBGROUPS,
} from './physgroups.js';
import {
  ensurePhysCss,
  tex,
  accentColor,
  createClean,
  setupCanvas,
  fmtNum,
  fmtComplex,
  renderComplexMatrix,
  renderRealMatrix,
  fmtHalfInt,
  fmtHalfIntTex,
} from './phys-ui.js';

// =====================================================================
// TAB 5: LORENTZ & POİNCARÉ GRUPLARI (§11.1.1)
// =====================================================================
export function mountLorentzPoincare(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'boost'; // 'boost' | 'reps' | 'poincare'
  let eta1 = 0.65;
  let eta2 = 0.35;
  let rotDeg = 0;
  let evT = 2.0;
  let evX = 0.8;

  // (j1, j2) reps state
  let j1 = 0.5;
  let j2 = 0;

  // Poincare state
  let p4 = [5, 3, 0, 0];
  let spinVal = 0.5;

  let subClean = null;

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    let bodyHtml = '';

    if (mode === 'boost') {
      const etaTot = rapidityAdd(eta1, eta2);
      const b1 = Math.tanh(eta1), b2 = Math.tanh(eta2);
      const bTot = velocityAdd(b1, b2);
      const gammaTot = Math.cosh(etaTot);
      const B1 = lorentzBoost(eta1, [1, 0, 0]);
      const B2 = lorentzBoost(eta2, [1, 0, 0]);
      const Bcomp = matMul4(B1, B2);
      const Rz = lorentzRotation((rotDeg * Math.PI) / 180, [0, 0, 1]);
      const Lfull = matMul4(Rz, Bcomp);
      const mChk = verifyMetricPreservation(Lfull);

      // SL(2, C) double cover check
      const Mboost = sl2cBoost(etaTot, [1, 0, 0]);
      const Mrot = sl2cRotation((rotDeg * Math.PI) / 180, [0, 0, 1]);
      // Multiply Mrot * Mboost (2x2 complex)
      const Msl = [[0, 1], [0, 1]].map((_, r) =>
        [0, 1].map(c => {
          let re = 0, im = 0;
          for (let k = 0; k < 2; k++) {
            re += Mrot[r][k][0] * Mboost[k][c][0] - Mrot[r][k][1] * Mboost[k][c][1];
            im += Mrot[r][k][0] * Mboost[k][c][1] + Mrot[r][k][1] * Mboost[k][c][0];
          }
          return [re, im];
        })
      );
      const detM = sl2cDet(Msl);
      const LfromSl = sl2cToLorentz(Msl);
      let coverErr = 0;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) coverErr = Math.max(coverErr, Math.abs(LfromSl[i][j] - Lfull[i][j]));

      const evBoosted = apply4(lorentzBoost(-etaTot, [1, 0, 0]), [evT, evX, 0, 0]);
      const s2Before = minkowskiDot([evT, evX, 0, 0], [evT, evX, 0, 0]);
      const s2After = minkowskiDot(evBoosted, evBoosted);

      bodyHtml = `<div class="phy-stage">
        <div class="phy-side">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Minkowski Işık Konisi & Boost Diyagramı</h3>
              <span class="grp-pill acc" data-beta-pill>${tex(`\\beta = \\tanh(${etaTot.toFixed(2)}) = ${bTot.toFixed(3)}c`)}</span>
            </div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-mink-cv aria-label="Minkowski ışık konisi ve Lorentz boost diyagramı"></canvas>
              <div class="phy-cv-tag">Olay P = (ct, x) seçmek için tıkla/sürükle</div>
            </div>
            <div class="grp-callout" data-ev-info>
              <span class="small">Olay ${tex(`P = (${evT.toFixed(2)},\\,${evX.toFixed(2)})`)} → S′ çerçevesinde ${tex(`(${evBoosted[0].toFixed(2)},\\,${evBoosted[1].toFixed(2)})`)}</span>
              <span class="grp-pill ok">${tex(`s^2 = ${s2Before.toFixed(2)} = ${s2After.toFixed(2)}`)} ✓</span>
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Rapidite Toplamı & SL(2,ℂ) Çift Örtüsü</h3>
              <span class="grp-pill ${mChk.ok ? 'ok' : 'bad'}">ΛᵀηΛ = η ✓</span>
            </div>
            <div class="phy-controls">
              <div class="phy-slider-row">
                <span>Rapidite η₁</span>
                <input type="range" class="phy-range" min="-1.6" max="1.6" step="0.05" value="${eta1}" data-sl="e1" aria-label="Birinci rapidite eta1">
                <span class="mono" data-slv="e1">${eta1.toFixed(2)}</span>
              </div>
              <div class="phy-slider-row">
                <span>Rapidite η₂</span>
                <input type="range" class="phy-range" min="-1.6" max="1.6" step="0.05" value="${eta2}" data-sl="e2" aria-label="İkinci rapidite eta2">
                <span class="mono" data-slv="e2">${eta2.toFixed(2)}</span>
              </div>
              <div class="phy-slider-row">
                <span>Dönme θ_z</span>
                <input type="range" class="phy-range" min="0" max="360" step="5" value="${rotDeg}" data-sl="rot" aria-label="Uzaysal z-dönme açısı">
                <span class="mono" data-slv="rot">${rotDeg}°</span>
              </div>
              <div class="grp-elems">
                <button type="button" class="grp-chip" data-spin360>θ = 360° (SL(2,ℂ) = −I₂ dene!)</button>
                <button type="button" class="grp-chip" data-reset-b>Sıfırla</button>
              </div>
            </div>
            <div data-boost-out>
              <div class="grp-kpis">
                <div class="grp-kpi acc"><span class="grp-kpi-lbl">η₁ + η₂</span><span class="grp-kpi-val mono">${etaTot.toFixed(2)}</span><span class="grp-kpi-sub">γ = ${gammaTot.toFixed(3)}</span></div>
                <div class="grp-kpi"><span class="grp-kpi-lbl">Metrik Hatası</span><span class="grp-kpi-val mono">${mChk.maxError.toExponential(1)}</span><span class="grp-kpi-sub">SO⁺(3,1)</span></div>
                <div class="grp-kpi"><span class="grp-kpi-lbl">det(M) SL(2,ℂ)</span><span class="grp-kpi-val mono">${esc(fmtComplex(detM, 3))}</span><span class="grp-kpi-sub">örtü hata ${coverErr.toExponential(1)}</span></div>
              </div>
              <div class="small mute" style="margin:10px 0 6px">4×4 Lorentz matrisi ${tex('\\Lambda = R_z(\\theta) B_x(\\eta_1) B_x(\\eta_2)')}:</div>
              ${renderRealMatrix(Lfull, { rowLabels: ['ct', 'x', 'y', 'z'], colLabels: ['ct', 'x', 'y', 'z'], ariaLabel: '4x4 Lorentz dönüşüm matrisi', digits: 3 })}
              <div class="small mute" style="margin:10px 0 6px">2×2 ${tex('SL(2,\\mathbb{C})')} çift örtü matrisi ${tex('M')}:</div>
              ${renderComplexMatrix(Msl, { ariaLabel: 'SL(2,C) çift örtü matrisi', digits: 3 })}
            </div>
          </div>
        </div>
      </div>`;
    } else if (mode === 'reps') {
      const rep = lorentzIrrep(j1, j2);
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Lorentz (j₁, j₂) İndirgenemez Temsil Hesaplayıcısı</h3>
            <span class="grp-pill acc">${tex(`\\dim(${fmtHalfIntTex(j1)},\\,${fmtHalfIntTex(j2)}) = ${rep.dim}`)}</span>
          </div>
          <div class="grp-toolbar">
            <div class="grp-toolbar-g">
              <label class="row" style="gap:6px"><span class="small mute">j₁ =</span>
                <select class="inp grp-sel" data-j1 aria-label="Sol SU(2) spini j1">
                  ${[0, 0.5, 1, 1.5, 2].map(v => `<option value="${v}" ${v === j1 ? 'selected' : ''}>${fmtHalfInt(v)}</option>`).join('')}
                </select>
              </label>
              <label class="row" style="gap:6px"><span class="small mute">j₂ =</span>
                <select class="inp grp-sel" data-j2 aria-label="Sağ SU(2) spini j2">
                  ${[0, 0.5, 1, 1.5, 2].map(v => `<option value="${v}" ${v === j2 ? 'selected' : ''}>${fmtHalfInt(v)}</option>`).join('')}
                </select>
              </label>
            </div>
            <span class="grp-pill">${rep.isParityInvariant ? 'Parite-değişmez' : `Parite eşi: (${fmtHalfInt(rep.parityPartner[0])}, ${fmtHalfInt(rep.parityPartner[1])})`}</span>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Boyut (2j₁+1)(2j₂+1)</span><span class="grp-kpi-val mono">${rep.dim}</span><span class="grp-kpi-sub">${esc(rep.name)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">SO(3) Spinleri</span><span class="grp-kpi-val mono">${rep.spins.map(fmtHalfInt).join(', ')}</span><span class="grp-kpi-sub">|j₁−j₂| … j₁+j₂</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Fiziksel Alan</span><span class="grp-kpi-val">${esc(rep.physics)}</span><span class="grp-kpi-sub">SU(2)_L × SU(2)_R</span></div>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head"><h3 class="grp-panel-title">Temel Fizik Alanları Kataloğu</h3></div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Lorentz temsil kataloğu">
              <thead><tr><th>Temsil</th><th>Boyut</th><th>Ad</th><th>Fiziksel Örnek</th></tr></thead>
              <tbody>
                ${LORENTZ_REPS_CATALOG.map(r => `<tr data-pickrep="${r.parts[0][0]}:${r.parts[0][1]}">
                  <td class="mono"><b>${esc(r.label)}</b></td>
                  <td class="mono">${r.dim}</td>
                  <td>${esc(r.name)}</td>
                  <td class="small mute">${esc(r.field)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    } else {
      const pc = poincareCasimirs(p4, spinVal);
      const presets = [
        { lbl: 'Elektron (s=1/2)', p: [5, 3, 0, 0], s: 0.5 },
        { lbl: 'W Bozonu (s=1)', p: [10, 0, 0, 6], s: 1 },
        { lbl: 'Higgs (s=0)', p: [125, 0, 0, 0], s: 0 },
        { lbl: 'Foton (λ=±1)', p: [5, 0, 0, 5], s: 1 },
        { lbl: 'Graviton (λ=±2)', p: [4, 0, 0, 4], s: 2 },
        { lbl: 'Takyon (P²<0)', p: [2, 5, 0, 0], s: 0 },
        { lbl: 'Vakum (P=0)', p: [0, 0, 0, 0], s: 0 },
      ];
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Poincaré Casimirleri & Wigner Küçük Grupları</h3>
            <span class="grp-pill acc">${esc(pc.littleGroup)}</span>
          </div>
          <div class="grp-elems">
            ${presets.map((pr, idx) => `<button type="button" class="grp-chip" data-pp="${idx}">${esc(pr.lbl)}</button>`).join('')}
          </div>
          <div class="phy-num-grid">
            <label class="phy-num-cell">E (P⁰)<input type="number" step="0.5" data-p4="0" value="${p4[0]}" aria-label="Enerji P0"></label>
            <label class="phy-num-cell">pₓ (P¹)<input type="number" step="0.5" data-p4="1" value="${p4[1]}" aria-label="Momentum px"></label>
            <label class="phy-num-cell">pᵧ (P²)<input type="number" step="0.5" data-p4="2" value="${p4[2]}" aria-label="Momentum py"></label>
            <label class="phy-num-cell">p_z (P³)<input type="number" step="0.5" data-p4="3" value="${p4[3]}" aria-label="Momentum pz"></label>
            <label class="phy-num-cell">Spin / Helisite s<input type="number" step="0.5" min="0" max="4" data-spin value="${spinVal}" aria-label="Spin veya helisite"></label>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">1. Casimir P² = m²</span><span class="grp-kpi-val mono">${fmtNum(pc.p2, 3)}</span><span class="grp-kpi-sub">m = ${Number.isFinite(pc.mass) ? fmtNum(pc.mass, 3) : 'sanal'}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">2. Casimir W²</span><span class="grp-kpi-val mono">${Number.isFinite(pc.w2) ? fmtNum(pc.w2, 3) : '—'}</span><span class="grp-kpi-sub">−m² s(s+1)</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Wigner Küçük Grubu</span><span class="grp-kpi-val">${esc(pc.littleGroup)}</span><span class="grp-kpi-sub">Sınıflandırma</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Serbestlik Derecesi</span><span class="grp-kpi-val mono">${Number.isFinite(pc.dof) ? pc.dof : '∞'}</span><span class="grp-kpi-sub">Fiziksel polarizasyon</span></div>
          </div>
          <div class="grp-callout">
            <div><b>${esc(pc.classification)}:</b> <span class="small mute">${esc(pc.note)}</span></div>
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-lp-mode role="tablist" aria-label="Lorentz ve Poincaré bölümleri">
          <button type="button" data-m="boost" class="${mode === 'boost' ? 'on' : ''}">Boost & SL(2,ℂ)</button>
          <button type="button" data-m="reps" class="${mode === 'reps' ? 'on' : ''}">(j₁, j₂) Temsilleri</button>
          <button type="button" data-m="poincare" class="${mode === 'poincare' ? 'on' : ''}">Poincaré & Wigner</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-lp-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });

    if (mode === 'boost') {
      let minkCtrl = null;
      const updateBoostLive = () => {
        const etaTot = rapidityAdd(eta1, eta2);
        const bTot = velocityAdd(Math.tanh(eta1), Math.tanh(eta2));
        const gammaTot = Math.cosh(etaTot);
        const Bcomp = matMul4(lorentzBoost(eta1, [1, 0, 0]), lorentzBoost(eta2, [1, 0, 0]));
        const Lfull = matMul4(lorentzRotation((rotDeg * Math.PI) / 180, [0, 0, 1]), Bcomp);
        const mChk = verifyMetricPreservation(Lfull);
        const Mboost = sl2cBoost(etaTot, [1, 0, 0]);
        const Mrot = sl2cRotation((rotDeg * Math.PI) / 180, [0, 0, 1]);
        const Msl = [[0, 1], [0, 1]].map((_, r) => [0, 1].map(c => {
          let re = 0, im = 0;
          for (let k = 0; k < 2; k++) {
            re += Mrot[r][k][0] * Mboost[k][c][0] - Mrot[r][k][1] * Mboost[k][c][1];
            im += Mrot[r][k][0] * Mboost[k][c][1] + Mrot[r][k][1] * Mboost[k][c][0];
          }
          return [re, im];
        }));
        const detM = sl2cDet(Msl);
        const LfromSl = sl2cToLorentz(Msl);
        let coverErr = 0;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) coverErr = Math.max(coverErr, Math.abs(LfromSl[i][j] - Lfull[i][j]));
        const evBoosted = apply4(lorentzBoost(-etaTot, [1, 0, 0]), [evT, evX, 0, 0]);
        const s2Before = minkowskiDot([evT, evX, 0, 0], [evT, evX, 0, 0]);
        const s2After = minkowskiDot(evBoosted, evBoosted);

        const s1 = host.querySelector('[data-slv="e1"]');
        const s2 = host.querySelector('[data-slv="e2"]');
        const sr = host.querySelector('[data-slv="rot"]');
        if (s1) s1.textContent = eta1.toFixed(2);
        if (s2) s2.textContent = eta2.toFixed(2);
        if (sr) sr.textContent = `${rotDeg}°`;
        const bp = host.querySelector('[data-beta-pill]');
        if (bp) bp.innerHTML = tex(`\\beta = \\tanh(${etaTot.toFixed(2)}) = ${bTot.toFixed(3)}c`);
        const ei = host.querySelector('[data-ev-info]');
        if (ei) {
          ei.innerHTML = `<span class="small">Olay ${tex(`P = (${evT.toFixed(2)},\\,${evX.toFixed(2)})`)} → S′ çerçevesinde ${tex(`(${evBoosted[0].toFixed(2)},\\,${evBoosted[1].toFixed(2)})`)}</span>
            <span class="grp-pill ok">${tex(`s^2 = ${s2Before.toFixed(2)} = ${s2After.toFixed(2)}`)} ✓</span>`;
        }
        const bo = host.querySelector('[data-boost-out]');
        if (bo) {
          bo.innerHTML = `<div class="grp-kpis">
              <div class="grp-kpi acc"><span class="grp-kpi-lbl">η₁ + η₂</span><span class="grp-kpi-val mono">${etaTot.toFixed(2)}</span><span class="grp-kpi-sub">γ = ${gammaTot.toFixed(3)}</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Metrik Hatası</span><span class="grp-kpi-val mono">${mChk.maxError.toExponential(1)}</span><span class="grp-kpi-sub">SO⁺(3,1)</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">det(M) SL(2,ℂ)</span><span class="grp-kpi-val mono">${esc(fmtComplex(detM, 3))}</span><span class="grp-kpi-sub">örtü hata ${coverErr.toExponential(1)}</span></div>
            </div>
            <div class="small mute" style="margin:10px 0 6px">4×4 Lorentz matrisi ${tex('\\Lambda = R_z(\\theta) B_x(\\eta_1) B_x(\\eta_2)')}:</div>
            ${renderRealMatrix(Lfull, { rowLabels: ['ct', 'x', 'y', 'z'], colLabels: ['ct', 'x', 'y', 'z'], ariaLabel: '4x4 Lorentz dönüşüm matrisi', digits: 3 })}
            <div class="small mute" style="margin:10px 0 6px">2×2 ${tex('SL(2,\\mathbb{C})')} çift örtü matrisi ${tex('M')}:</div>
            ${renderComplexMatrix(Msl, { ariaLabel: 'SL(2,C) çift örtü matrisi', digits: 3 })}`;
        }
        minkCtrl?.render();
      };

      host.querySelector('[data-sl="e1"]')?.addEventListener('input', e => { eta1 = +e.target.value; updateBoostLive(); });
      host.querySelector('[data-sl="e2"]')?.addEventListener('input', e => { eta2 = +e.target.value; updateBoostLive(); });
      host.querySelector('[data-sl="rot"]')?.addEventListener('input', e => { rotDeg = +e.target.value; updateBoostLive(); });
      host.querySelector('[data-spin360]')?.addEventListener('click', () => { eta1 = 0; eta2 = 0; rotDeg = 360; render(); });
      host.querySelector('[data-reset-b]')?.addEventListener('click', () => { eta1 = 0.65; eta2 = 0.35; rotDeg = 0; evT = 2.0; evX = 0.8; render(); });

      const cv = host.querySelector('[data-mink-cv]');
      if (cv) {
        let geom = { cx: 160, cy: 160, sc: 40 };

        minkCtrl = setupCanvas(cv, cw => Math.min(340, Math.max(250, cw * 0.82)), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const beta = Math.tanh(rapidityAdd(eta1, eta2));
          const acc = accentColor();
          const cx = W / 2, cy = H / 2;
          const sc = Math.min(W, H) / 8.4;
          geom = { cx, cy, sc };
          const toS = (x, t) => [cx + x * sc, cy - t * sc];

          // Faint Cartesian grid
          c.strokeStyle = 'rgba(255,255,255,0.06)';
          c.lineWidth = 1;
          for (let k = -4; k <= 4; k++) {
            const p1 = toS(k, -4), p2 = toS(k, 4);
            c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke();
            const q1 = toS(-4, k), q2 = toS(4, k);
            c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
          }

          // Invariant hyperbolas t^2 - x^2 = +-1, +-4
          c.strokeStyle = 'rgba(167, 139, 250, 0.25)';
          c.lineWidth = 1.2;
          for (const a of [1, 2]) {
            for (const sgn of [-1, 1]) {
              c.beginPath();
              let first = true;
              for (let u = -2.2; u <= 2.2; u += 0.08) {
                const p = toS(a * Math.sinh(u), sgn * a * Math.cosh(u));
                if (first) { c.moveTo(p[0], p[1]); first = false; } else c.lineTo(p[0], p[1]);
              }
              c.stroke();
              c.beginPath();
              first = true;
              for (let u = -2.2; u <= 2.2; u += 0.08) {
                const p = toS(sgn * a * Math.cosh(u), a * Math.sinh(u));
                if (first) { c.moveTo(p[0], p[1]); first = false; } else c.lineTo(p[0], p[1]);
              }
              c.stroke();
            }
          }

          // Light cone ct = +-x
          c.strokeStyle = '#fbbf24';
          c.setLineDash([6, 4]);
          c.lineWidth = 1.6;
          let a1 = toS(-4.2, -4.2), a2 = toS(4.2, 4.2);
          c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.stroke();
          a1 = toS(-4.2, 4.2); a2 = toS(4.2, -4.2);
          c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.stroke();
          c.setLineDash([]);

          // Rest axes (x, ct)
          c.strokeStyle = 'rgba(255,255,255,0.45)';
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(16, cy); c.lineTo(W - 16, cy);
          c.moveTo(cx, H - 16); c.lineTo(cx, 16);
          c.stroke();

          // Boosted axes (x', ct'): ct'-axis is x = beta*ct; x'-axis is ct = beta*x
          c.strokeStyle = acc;
          c.lineWidth = 2.4;
          const tTop = toS(3.8 * beta, 3.8), tBot = toS(-3.8 * beta, -3.8);
          c.beginPath(); c.moveTo(tBot[0], tBot[1]); c.lineTo(tTop[0], tTop[1]); c.stroke();
          const xR = toS(3.8, 3.8 * beta), xL = toS(-3.8, -3.8 * beta);
          c.beginPath(); c.moveTo(xL[0], xL[1]); c.lineTo(xR[0], xR[1]); c.stroke();

          c.fillStyle = acc;
          c.font = '600 12px var(--mono), monospace';
          c.fillText("ct'", tTop[0] + 6, tTop[1] + 6);
          c.fillText("x'", xR[0] - 12, xR[1] - 8);
          c.fillStyle = 'rgba(255,255,255,0.65)';
          c.fillText('ct', cx + 6, 26);
          c.fillText('x', W - 24, cy - 6);

          // Event P
          const ep = toS(evX, evT);
          c.fillStyle = '#34d399';
          c.strokeStyle = '#fff';
          c.lineWidth = 2;
          c.beginPath(); c.arc(ep[0], ep[1], 6, 0, Math.PI * 2); c.fill(); c.stroke();
          c.fillStyle = '#34d399';
          c.fillText('P', ep[0] + 8, ep[1] - 6);
        }, localClean);

        let dragging = false;
        const setEv = e => {
          const r = cv.getBoundingClientRect();
          evX = Math.max(-3.6, Math.min(3.6, (e.clientX - r.left - geom.cx) / geom.sc));
          evT = Math.max(-3.6, Math.min(3.6, -(e.clientY - r.top - geom.cy) / geom.sc));
          updateBoostLive();
        };
        const onDown = e => { dragging = true; setEv(e); };
        const onMove = e => { if (dragging) setEv(e); };
        const onUp = () => { dragging = false; };
        cv.addEventListener('pointerdown', onDown);
        cv.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        localClean.add(() => {
          cv.removeEventListener('pointerdown', onDown);
          cv.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        });
      }
    } else if (mode === 'reps') {
      host.querySelector('[data-j1]')?.addEventListener('change', e => { j1 = +e.target.value; render(); });
      host.querySelector('[data-j2]')?.addEventListener('change', e => { j2 = +e.target.value; render(); });
      host.querySelectorAll('[data-pickrep]').forEach(tr => {
        tr.onclick = () => {
          const [a, b] = tr.dataset.pickrep.split(':').map(Number);
          j1 = a; j2 = b; render();
        };
      });
    } else {
      const presets = [
        [5, 3, 0, 0, 0.5], [10, 0, 0, 6, 1], [125, 0, 0, 0, 0],
        [5, 0, 0, 5, 1], [4, 0, 0, 4, 2], [2, 5, 0, 0, 0], [0, 0, 0, 0, 0],
      ];
      host.querySelectorAll('[data-pp]').forEach(b => {
        b.onclick = () => {
          const v = presets[+b.dataset.pp];
          p4 = v.slice(0, 4); spinVal = v[4]; render();
        };
      });
      host.querySelectorAll('[data-p4]').forEach(inp => {
        inp.onchange = () => { const v = Number(inp.value); if (Number.isFinite(v)) { p4[+inp.dataset.p4] = v; render(); } };
      });
      host.querySelector('[data-spin]')?.addEventListener('change', e => {
        const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) { spinVal = v; render(); }
      });
    }

    syncSegments(host, true);
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}

// =====================================================================
// TAB 6: KONFORMAL GRUP SO(4, 2) (§11.1.2)
// =====================================================================
export function mountConformal(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let dimD = 4;
  let params = { tx: 0, ty: 0, theta: 0, lambda: 1.0, bx: 0.28, by: 0.14 };
  let probe = { x: 0.4, y: -0.2 };
  let subClean = null;

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    const cg = conformalGenerators(dimD);
    const chk = checkConformality2D(probe.x, probe.y, params);

    host.innerHTML = `<div class="phy-stage">
      <div class="phy-side">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">2B Konformal Izgara Haritası (Açı Korunumu)</h3>
            <span class="grp-pill ${chk.ok ? 'ok' : 'warn'}" data-conf-ang>${chk.ok ? `Yerel açı: ${chk.angleDeg.toFixed(2)}° ✓` : 'Tekil nokta'}</span>
          </div>
          <div class="phy-cv-box">
            <canvas class="phy-cv" data-conf-cv aria-label="Konformal dönüşüm altında eğrilen dik ızgara"></canvas>
            <div class="phy-cv-tag">Soluk: Orijinal ızgara · Parlak: Konformal görüntü</div>
          </div>
          <div class="grp-callout" data-conf-probe>
            <span class="small">Ölçüm noktası ${tex(`(x_0, y_0) = (${probe.x.toFixed(2)},\\,${probe.y.toFixed(2)})`)}: yerel ölçek ${tex(`\\Omega = ${chk.ok ? chk.scaleFactor.toFixed(3) : '\\infty'}`)}</span>
            <span class="grp-pill acc">Dik kesişimler korunur!</span>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head"><h3 class="grp-panel-title">Dönüşüm Parametreleri</h3></div>
          <div class="grp-elems">
            <button type="button" class="grp-chip" data-cp="id">Birim</button>
            <button type="button" class="grp-chip" data-cp="dil">Dilatasyon</button>
            <button type="button" class="grp-chip" data-cp="sctx">Yatay SCT</button>
            <button type="button" class="grp-chip" data-cp="sctd">Çapraz SCT</button>
            <button type="button" class="grp-chip" data-cp="mix">Birleşik</button>
          </div>
          <div class="phy-controls">
            <div class="phy-slider-row"><span>Dilatasyon λ</span><input type="range" class="phy-range" min="0.45" max="1.8" step="0.05" value="${params.lambda}" data-c="lambda" aria-label="Dilatasyon katsayısı"><span class="mono" data-cv="lambda">${params.lambda.toFixed(2)}</span></div>
            <div class="phy-slider-row"><span>SCT bₓ</span><input type="range" class="phy-range" min="-0.5" max="0.5" step="0.02" value="${params.bx}" data-c="bx" aria-label="Özel konformal b_x"><span class="mono" data-cv="bx">${params.bx.toFixed(2)}</span></div>
            <div class="phy-slider-row"><span>SCT bᵧ</span><input type="range" class="phy-range" min="-0.5" max="0.5" step="0.02" value="${params.by}" data-c="by" aria-label="Özel konformal b_y"><span class="mono" data-cv="by">${params.by.toFixed(2)}</span></div>
            <div class="phy-slider-row"><span>Dönme θ</span><input type="range" class="phy-range" min="-3.14" max="3.14" step="0.05" value="${params.theta}" data-c="theta" aria-label="Konformal dönme"><span class="mono" data-cv="theta">${Math.round(params.theta * 180 / Math.PI)}°</span></div>
          </div>
          <div class="grp-math-box">${tex(`x'^{\\mu} = \\lambda\\,\\frac{x^\\mu - b^\\mu x^2}{1 - 2 b\\cdot x + b^2 x^2}`)}</div>
        </div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Konformal Grup Üreteç Sayısı: ${esc(cg.algebra)}</h3>
          <div class="grp-toolbar-g">
            ${[2, 3, 4, 6, 10].map(d => `<button type="button" class="grp-chip ${d === dimD ? 'on' : ''}" data-dim="${d}">d = ${d}</button>`).join('')}
          </div>
        </div>
        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">Toplam Üreteç</span><span class="grp-kpi-val mono">${cg.total} ${cg.formulaCheck ? '✓' : ''}</span><span class="grp-kpi-sub">${esc(cg.algebra)} = (d+2)(d+1)/2</span></div>
          ${cg.breakdown.map(b => `<div class="grp-kpi"><span class="grp-kpi-lbl">${esc(b.name)}</span><span class="grp-kpi-val">${tex(b.sym)} (${b.count})</span><span class="grp-kpi-sub">${tex(b.role)}</span></div>`).join('')}
        </div>
      </div>
    </div>`;

    const presets = {
      id: { tx: 0, ty: 0, theta: 0, lambda: 1, bx: 0, by: 0 },
      dil: { tx: 0, ty: 0, theta: 0, lambda: 1.45, bx: 0, by: 0 },
      sctx: { tx: 0, ty: 0, theta: 0, lambda: 1, bx: 0.36, by: 0 },
      sctd: { tx: 0, ty: 0, theta: 0, lambda: 1, bx: 0.28, by: 0.24 },
      mix: { tx: 0, ty: 0, theta: 0.45, lambda: 1.2, bx: 0.3, by: -0.18 },
    };
    let confCtrl = null;
    const updateConfLive = () => {
      const c2 = checkConformality2D(probe.x, probe.y, params);
      const angEl = host.querySelector('[data-conf-ang]');
      if (angEl) {
        angEl.className = `grp-pill ${c2.ok ? 'ok' : 'warn'}`;
        angEl.textContent = c2.ok ? `Yerel açı: ${c2.angleDeg.toFixed(2)}° ✓` : 'Tekil nokta';
      }
      const prEl = host.querySelector('[data-conf-probe]');
      if (prEl) {
        prEl.innerHTML = `<span class="small">Ölçüm noktası ${tex(`(x_0, y_0) = (${probe.x.toFixed(2)},\\,${probe.y.toFixed(2)})`)}: yerel ölçek ${tex(`\\Omega = ${c2.ok ? c2.scaleFactor.toFixed(3) : '\\infty'}`)}</span>
          <span class="grp-pill acc">Dik kesişimler korunur!</span>`;
      }
      const vl = host.querySelector('[data-cv="lambda"]'); if (vl) vl.textContent = params.lambda.toFixed(2);
      const vx = host.querySelector('[data-cv="bx"]'); if (vx) vx.textContent = params.bx.toFixed(2);
      const vy = host.querySelector('[data-cv="by"]'); if (vy) vy.textContent = params.by.toFixed(2);
      const vt = host.querySelector('[data-cv="theta"]'); if (vt) vt.textContent = `${Math.round(params.theta * 180 / Math.PI)}°`;
      confCtrl?.render();
    };
    host.querySelectorAll('[data-cp]').forEach(b => {
      b.onclick = () => { params = { ...presets[b.dataset.cp] }; render(); };
    });
    host.querySelectorAll('[data-c]').forEach(sl => {
      sl.oninput = () => { params[sl.dataset.c] = +sl.value; updateConfLive(); };
    });
    host.querySelectorAll('[data-dim]').forEach(b => {
      b.onclick = () => { dimD = +b.dataset.dim; render(); };
    });

    const cv = host.querySelector('[data-conf-cv]');
    if (cv) {
      let cGeom = { cx: 160, cy: 160, sc: 60 };
      confCtrl = setupCanvas(cv, cw => Math.min(340, Math.max(240, cw * 0.78)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const acc = accentColor();
        const cx = W / 2, cy = H / 2;
        const sc = Math.min(W, H) / 4.4;
        cGeom = { cx, cy, sc };
        const toS = (x, y) => [cx + x * sc, cy - y * sc];

        // Faint original orthogonal grid
        c.strokeStyle = 'rgba(255,255,255,0.1)';
        c.lineWidth = 1;
        for (let g = -1.2; g <= 1.21; g += 0.3) {
          let a = toS(g, -1.2), b = toS(g, 1.2);
          c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
          a = toS(-1.2, g); b = toS(1.2, g);
          c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        }

        // Conformal mapped grid lines
        const drawCurve = (fn, col, lw = 1.6) => {
          c.strokeStyle = col;
          c.lineWidth = lw;
          c.beginPath();
          let penDown = false;
          for (let t = -1.2; t <= 1.201; t += 0.04) {
            const [ux, uy] = fn(t);
            const m = conformalTransform2D(ux, uy, params);
            if (m.singular || Math.hypot(m.x, m.y) > 4.5) { penDown = false; continue; }
            const p = toS(m.x, m.y);
            if (!penDown) { c.moveTo(p[0], p[1]); penDown = true; } else c.lineTo(p[0], p[1]);
          }
          c.stroke();
        };

        for (let g = -1.2; g <= 1.21; g += 0.3) {
          const isAxis = Math.abs(g) < 0.01;
          drawCurve(t => [g, t], isAxis ? acc : 'rgba(96, 165, 250, 0.72)', isAxis ? 2.4 : 1.4);
          drawCurve(t => [t, g], isAxis ? '#f472b6' : 'rgba(244, 114, 182, 0.65)', isAxis ? 2.4 : 1.4);
        }

        // Mapped probe point & local orthogonal tangent frame
        const mp = conformalTransform2D(probe.x, probe.y, params);
        if (!mp.singular) {
          const sp = toS(mp.x, mp.y);
          c.fillStyle = '#5be49b';
          c.strokeStyle = '#fff';
          c.lineWidth = 2;
          c.beginPath(); c.arc(sp[0], sp[1], 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      }, localClean);

      const onPickProbe = e => {
        const r = cv.getBoundingClientRect();
        probe.x = Math.max(-1.1, Math.min(1.1, (e.clientX - r.left - cGeom.cx) / cGeom.sc));
        probe.y = Math.max(-1.1, Math.min(1.1, -(e.clientY - r.top - cGeom.cy) / cGeom.sc));
        updateConfLive();
      };
      cv.addEventListener('pointerdown', onPickProbe);
      localClean.add(() => cv.removeEventListener('pointerdown', onPickProbe));
    }
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}

// =====================================================================
// TAB 7: RENK & KUARK MODELİ (§11.2.1)
// =====================================================================
export function mountColorQuark(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let hType = 'baryon'; // 'baryon' | 'meson'
  let flavors = ['u', 'u', 'd'];
  let colors = ['r', 'g', 'b'];
  let subClean = null;

  const COLOR_MAP = Object.fromEntries(COLOR_STATES.map(c => [c.code, c]));

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    const activeFlavors = hType === 'baryon' ? flavors.slice(0, 3) : flavors.slice(0, 2);
    const activeColors = hType === 'baryon' ? colors.slice(0, 3) : colors.slice(0, 2);
    const had = buildHadron(hType, activeFlavors);
    const cChk = checkColorSinglet(hType, activeColors);

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="seg" data-htype role="tablist" aria-label="Hadron türü">
            <button type="button" data-ht="baryon" class="${hType === 'baryon' ? 'on' : ''}">Baryon (qqq)</button>
            <button type="button" data-ht="meson" class="${hType === 'meson' ? 'on' : ''}">Mezon (q q̄)</button>
          </div>
          <div class="grp-toolbar-g">
            <button type="button" class="grp-chip" data-hp="baryon:u,u,d">Proton (uud)</button>
            <button type="button" class="grp-chip" data-hp="baryon:u,d,d">Nötron (udd)</button>
            <button type="button" class="grp-chip" data-hp="baryon:u,u,u">Δ⁺⁺ (uuu)</button>
            <button type="button" class="grp-chip" data-hp="baryon:s,s,s">Ω⁻ (sss)</button>
            <button type="button" class="grp-chip" data-hp="meson:u,d">π⁺ (ud̄)</button>
            <button type="button" class="grp-chip" data-hp="meson:u,s">K⁺ (us̄)</button>
          </div>
        </div>

        <div class="phy-quark-row">
          ${activeFlavors.map((fl, idx) => {
            const isAnti = hType === 'meson' && idx === 1;
            const curCol = COLOR_MAP[activeColors[idx]];
            return `<div class="phy-quark-card" style="border-color:${curCol.hex}">
              <div class="row" style="justify-content:space-between">
                <b>${isAnti ? 'Antikuark q̄' : `Kuark ${idx + 1}`}</b>
                <span class="grp-pill" style="color:${curCol.hex};border-color:${curCol.hex}">${isAnti ? `Karşıt-${activeColors[idx].toUpperCase()}` : activeColors[idx].toUpperCase()}</span>
              </div>
              <select class="inp grp-sel" data-qfl="${idx}" aria-label="${isAnti ? 'Antikuark çeşnisi' : `Kuark ${idx + 1} çeşnisi`}">
                ${QUARKS.map(q => `<option value="${q.symbol}" ${q.symbol === fl ? 'selected' : ''}>${isAnti ? `anti-${q.symbol}` : q.symbol} (${esc(q.name)})</option>`).join('')}
              </select>
              <div class="row center" style="gap:6px">
                ${COLOR_STATES.map(cs => `<button type="button" class="phy-color-dot ${activeColors[idx] === cs.code ? 'on' : ''}" data-qcol="${idx}:${cs.code}" style="color:${cs.hex}" aria-label="${esc(cs.name)}">${isAnti ? cs.code.toUpperCase() + '̄' : cs.code.toUpperCase()}</button>`).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="grp-callout ${cChk.singlet ? 'ok' : 'bad'}">
          <div>
            <b>${cChk.singlet ? '✓ SU(3)_c Renk Teklisi (Doğada Serbest Olabilir)' : '✗ Renk Teklisi Değil (Renk Hapsi Yasaklar)'}</b>
            <div class="small mute" style="margin-top:4px">${esc(cChk.reason)}</div>
          </div>
          <span>${tex(cChk.tensor)}</span>
        </div>
      </div>

      <div class="phy-side">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Hesaplanan Hadron: ${esc(had.knownName)}</h3>
            <span class="grp-pill ${had.gmnOk ? 'ok' : 'bad'}">GMN Q = I₃ + (B+S+…)/2 ✓</span>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Bileşim</span><span class="grp-kpi-val">${tex(had.composition)}</span><span class="grp-kpi-sub">${hType === 'baryon' ? 'Baryon' : 'Mezon'}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Elektrik Yükü Q</span><span class="grp-kpi-val mono">${esc(fracStr(had.Q))}</span><span class="grp-kpi-sub">e biriminde</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">İzospin I₃</span><span class="grp-kpi-val mono">${esc(fracStr(had.I3))}</span><span class="grp-kpi-sub">Baryon B = ${esc(fracStr(had.B))}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Gariplik S</span><span class="grp-kpi-val mono">${had.S}</span><span class="grp-kpi-sub">C=${had.C}, B′=${had.Bp}, T=${had.T}</span></div>
          </div>
          <div class="grp-math-box">${tex(cChk.decomposition)}</div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Altı kuark çeşnisi kuantum sayıları">
              <thead><tr><th>Kuark</th><th>Nesil</th><th>Q</th><th>I₃</th><th>S / C / B′ / T</th><th>B</th><th>Kütle</th></tr></thead>
              <tbody>
                ${QUARKS.map(q => `<tr>
                  <td><b>${esc(q.symbol)}</b> <span class="mute small">${esc(q.name)}</span></td>
                  <td class="mono">${q.gen}</td>
                  <td class="mono">${esc(fracStr(q.Q))}</td>
                  <td class="mono">${esc(fracStr(q.I3))}</td>
                  <td class="mono">${q.S} / ${q.C} / ${q.Bp} / ${q.T}</td>
                  <td class="mono">${esc(fracStr(q.B))}</td>
                  <td class="mono small">${esc(q.massMeV)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head"><h3 class="grp-panel-title">SU(3)_c Renk Ağırlık Toplamı</h3><span class="grp-pill">${cChk.singlet ? 'Net = (0,0) ✓' : 'Net ≠ 0'}</span></div>
          <div class="phy-cv-box">
            <canvas class="phy-cv" data-col-cv aria-label="SU(3) renk ağırlık vektör toplamı diyagramı"></canvas>
            <div class="phy-cv-tag">Orijin (0,0) = Renksiz (Beyaz) Tekli</div>
          </div>
          <p class="small mute">Δ⁺⁺ = u↑u↑u↑ durumunun Pauli ilkesini bozmaması için 3 kuarkın renk dalga fonksiyonu tamamen antisimetrik (ε_abc) olmalıdır.</p>
        </div>
      </div>
    </div>`;

    host.querySelector('[data-htype]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-ht]');
      if (!b || b.dataset.ht === hType) return;
      hType = b.dataset.ht;
      if (hType === 'meson') { flavors = ['u', 'd']; colors = ['r', 'r']; }
      else { flavors = ['u', 'u', 'd']; colors = ['r', 'g', 'b']; }
      render();
    });
    host.querySelectorAll('[data-hp]').forEach(b => {
      b.onclick = () => {
        const [t, fl] = b.dataset.hp.split(':');
        hType = t;
        flavors = fl.split(',');
        colors = t === 'baryon' ? ['r', 'g', 'b'] : ['r', 'r'];
        render();
      };
    });
    host.querySelectorAll('[data-qfl]').forEach(sel => {
      sel.onchange = () => { flavors[+sel.dataset.qfl] = sel.value; render(); };
    });
    host.querySelectorAll('[data-qcol]').forEach(b => {
      b.onclick = () => {
        const [i, col] = b.dataset.qcol.split(':');
        colors[+i] = col;
        render();
      };
    });

    const cv = host.querySelector('[data-col-cv]');
    if (cv) {
      setupCanvas(cv, cw => Math.min(260, Math.max(200, cw * 0.78)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2 + 6, sc = Math.min(W, H) * 0.48;
        const toS = (wx, wy) => [cx + wx * sc, cy - wy * sc];

        // Axes & fundamental triangle
        c.strokeStyle = 'rgba(255,255,255,0.14)';
        c.beginPath(); c.moveTo(16, cy); c.lineTo(W - 16, cy); c.moveTo(cx, 16); c.lineTo(cx, H - 16); c.stroke();

        c.strokeStyle = 'rgba(255,255,255,0.22)';
        c.beginPath();
        COLOR_STATES.forEach((cs, i) => {
          const p = toS(cs.weight[0], cs.weight[1]);
          if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
        });
        c.closePath(); c.stroke();

        // Draw tip-to-tail color sum
        let sx = 0, sy = 0;
        activeColors.forEach((code, idx) => {
          const cs = COLOR_MAP[code];
          const sgn = (hType === 'meson' && idx === 1) ? -1 : 1;
          const nx = sx + sgn * cs.weight[0], ny = sy + sgn * cs.weight[1];
          const p0 = toS(sx, sy), p1 = toS(nx, ny);
          c.strokeStyle = cs.hex;
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
          c.fillStyle = cs.hex;
          c.beginPath(); c.arc(p1[0], p1[1], 4.5, 0, Math.PI * 2); c.fill();
          sx = nx; sy = ny;
        });

        // Origin & resultant marker
        const net = toS(sx, sy);
        const isZero = Math.hypot(sx, sy) < 1e-6;
        c.fillStyle = isZero ? '#5be49b' : '#ff6b6b';
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.beginPath(); c.arc(net[0], net[1], 7, 0, Math.PI * 2); c.fill(); c.stroke();
      }, localClean);
    }

    syncSegments(host, true);
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}

// =====================================================================
// TAB 8: AYAR TEORİLERİ & STANDART MODEL (§11.3, §11.4, §11.5)
// =====================================================================
export function mountGaugeSM(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'sm'; // 'sm' | 'gauge' | 'higgs'
  let includeNuR = false;
  let nc = 3;
  // Mutable hypercharge map (defaults to SM_FAMILY)
  let customY = Object.fromEntries(SM_FAMILY.map(f => [f.id, f.Y.slice()]));
  let selGauge = 'SU3';
  let customSun = 3;

  // Electroweak state
  let sin2W = 0.23122;
  let vGeV = 246.22;
  let gWeak = 0.6529;

  const Y_CHOICES = [
    frac(-1, 1), frac(-2, 3), frac(-1, 2), frac(-1, 3), frac(-1, 6),
    frac(0, 1), frac(1, 6), frac(1, 3), frac(1, 2), frac(2, 3), frac(1, 1),
  ];

  const render = () => {
    let bodyHtml = '';

    if (mode === 'sm') {
      const fields = SM_FAMILY.map(f => ({
        ...f,
        su3: f.su3 === 3 ? nc : 1,
        Y: customY[f.id],
      }));
      const qChk = checkElectricCharges(fields.filter(f => includeNuR || !f.optional));
      const anom = computeAnomalies(fields, { includeNuR });
      const cards = [
        { lbl: 'Σ Y (U(1) toplamı)', val: fracStr(anom.sumY), ok: anom.sumY[0] === 0 },
        { lbl: 'Σ Y³ ([U(1)]³)', val: fracStr(anom.sumY3), ok: anom.sumY3[0] === 0 },
        { lbl: '[SU(3)_c]² U(1)_Y', val: fracStr(anom.su3sqU1), ok: anom.su3sqU1[0] === 0 },
        { lbl: '[SU(2)_L]² U(1)_Y', val: fracStr(anom.su2sqU1), ok: anom.su2sqU1[0] === 0 },
        { lbl: '[Grav]² U(1)_Y', val: fracStr(anom.gravitational), ok: anom.gravitational[0] === 0 },
        { lbl: 'Witten SU(2)_L', val: `${anom.su2Doublets} ikili`, ok: anom.wittenOk },
      ];

      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-toolbar-g">
              <button type="button" class="chip ${includeNuR ? 'on' : ''}" data-nur aria-pressed="${includeNuR}">Sağ nötrino ν_R ${includeNuR ? 'açık' : 'kapalı'}</button>
              <span class="small mute">Renk sayısı N_c:</span>
              ${[2, 3, 4].map(k => `<button type="button" class="grp-chip ${k === nc ? 'on' : ''}" data-nc="${k}">N_c = ${k}</button>`).join('')}
            </div>
            <button type="button" class="btn small ghost" data-smreset>Standart Model’e Sıfırla</button>
          </div>

          <div class="grp-callout ${anom.allZero && qChk.allMatch ? 'ok' : 'bad'}">
            <b>${anom.allZero ? '✓ Tüm Ayar & Kütleçekim Anomalileri Tam Sıfırlandı!' : '✗ Anomali İptali Bozuldu — Kuantum Teorisi Tutarsız!'}</b>
            <span class="grp-pill ${qChk.allMatch ? 'ok' : 'bad'}">${qChk.allMatch ? 'Q = T₃ + Y tüm durumlarda ✓' : 'Yükler değişti!'}</span>
          </div>

          <div class="phy-anom-grid">
            ${cards.map(c => `<div class="phy-anom-card ${c.ok ? 'ok' : 'bad'}">
              <span class="small mute">${esc(c.lbl)}</span>
              <div class="phy-anom-val"><span>${esc(c.val)}</span><span>${c.ok ? '✓' : '✗'}</span></div>
            </div>`).join('')}
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Bir Aile Fermiyon Tablosu (Hiperyük Y Değiştirilebilir)</h3>
            <span class="grp-pill acc">${tex('SU(3)_c \\times SU(2)_L \\times U(1)_Y')}</span>
          </div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Standart Model tek aile fermiyon tablosu">
              <thead><tr><th>Alan</th><th>Kiralite</th><th>(SU(3), SU(2))</th><th>Hiperyük Y</th><th>Durumlar: Q = T₃ + Y</th></tr></thead>
              <tbody>
                ${fields.filter(f => includeNuR || !f.optional).map(f => {
                  const curStr = fracStr(f.Y);
                  const comps = f.components.map(c => {
                    const q = qChk.rows.find(r => r.fieldId === f.id && r.label === c.label);
                    return `<span class="grp-pill ${q?.ok ? 'ok' : 'bad'}">${tex(`${c.label}:\\; T_3=${fracTex(c.T3)},\\; Q=${fracTex(q.computedQ)}`)}</span>`;
                  }).join(' ');
                  return `<tr>
                    <td><b>${tex(f.symbol)}</b><div class="small mute">${esc(f.name)}</div></td>
                    <td class="mono">${f.chirality}</td>
                    <td class="mono">(${f.su3}, ${f.su2})</td>
                    <td>
                      <select class="inp grp-sel mono" data-yf="${f.id}" aria-label="${esc(f.name)} hiperyükü">
                        ${Y_CHOICES.map(y => {
                          const s = fracStr(y);
                          return `<option value="${s}" ${s === curStr ? 'selected' : ''}>${s}</option>`;
                        }).join('')}
                      </select>
                    </td>
                    <td><div class="grp-elems">${comps}</div></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    } else if (mode === 'gauge') {
      const gg = GAUGE_GROUPS.find(g => g.id === selGauge) || GAUGE_GROUPS[2];
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-toolbar-g">
              ${GAUGE_GROUPS.map(g => `<button type="button" class="grp-chip ${g.id === selGauge ? 'on' : ''}" data-gg="${g.id}">${esc(g.name)} (dim ${g.dim})</button>`).join('')}
            </div>
            <span class="grp-pill acc">Ayar bozonu sayısı = dim G = ${gg.dim}</span>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Bozon Sayısı (dim G)</span><span class="grp-kpi-val mono">${gg.dim}</span><span class="grp-kpi-sub">${esc(gg.bosons)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Rank</span><span class="grp-kpi-val mono">${gg.rank}</span><span class="grp-kpi-sub">${gg.abelian ? 'Abelyen' : 'Değişmeli değil (Yang–Mills)'}</span></div>
          </div>
          <div class="grp-math-box">
            <div class="small mute" style="margin-bottom:4px">Kovaryant Türev</div>
            ${tex(gg.covariantDeriv, true)}
          </div>
          <div class="grp-math-box">
            <div class="small mute" style="margin-bottom:4px">Alan Şiddeti Tensörü & Yapı Sabitleri</div>
            ${tex(gg.fieldStrength, true)}
            ${tex(gg.structureConst, true)}
          </div>
          <div class="grp-math-box">
            <div class="small mute" style="margin-bottom:4px">Ayar-Değişmez Lagranjiyen</div>
            ${tex(gg.lagrangian, true)}
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head"><h3 class="grp-panel-title">Genel SU(N) / SO(N) Ayar Bozonu Sayacı</h3></div>
          <div class="phy-slider-row">
            <span>Grup boyutu N</span>
            <input type="range" class="phy-range" min="2" max="10" step="1" value="${customSun}" data-sun aria-label="SU(N) N parametresi">
            <span class="mono" data-sunv>N = ${customSun}</span>
          </div>
          <div class="grp-kpis" data-sun-kpis>
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">SU(${customSun})</span><span class="grp-kpi-val mono">${customSun * customSun - 1} bozon</span><span class="grp-kpi-sub">N² − 1</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">SO(${customSun})</span><span class="grp-kpi-val mono">${(customSun * (customSun - 1)) / 2} bozon</span><span class="grp-kpi-sub">N(N−1)/2</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">U(${customSun})</span><span class="grp-kpi-val mono">${customSun * customSun} bozon</span><span class="grp-kpi-sub">N²</span></div>
          </div>
        </div>
      </div>`;
    } else {
      const ew = electroweakBreaking(sin2W, vGeV, gWeak);
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Higgs İkilisi & Elektrozayıf Kırılma: SU(2)_L × U(1)_Y → U(1)_em</h3>
            <span class="grp-pill ok" data-ew-rho>ρ = M_W² / (M_Z² cos²θ_W) = ${ew.rho.toFixed(4)}</span>
          </div>
          <div class="grp-elems">
            <button type="button" class="grp-chip" data-ew="0.23122">MS̄ (M_Z): sin²θ_W = 0.2312</button>
            <button type="button" class="grp-chip" data-ew="0.2229">On-shell: sin²θ_W = 0.2229</button>
            <button type="button" class="grp-chip" data-ew="0.375">SU(5) GUT Ölçeği: 3/8 = 0.375</button>
          </div>
          <div class="phy-controls">
            <div class="phy-slider-row"><span>sin²θ_W</span><input type="range" class="phy-range" min="0.05" max="0.50" step="0.002" value="${sin2W}" data-ewsl="s2" aria-label="Weinberg açısı sin kare"><span class="mono" data-ewv="s2">${sin2W.toFixed(4)} (${ew.thetaDeg.toFixed(1)}°)</span></div>
            <div class="phy-slider-row"><span>Higgs VEV v</span><input type="range" class="phy-range" min="100" max="360" step="1" value="${vGeV}" data-ewsl="v" aria-label="Higgs vakum beklenti değeri"><span class="mono" data-ewv="v">${vGeV.toFixed(1)} GeV</span></div>
            <div class="phy-slider-row"><span>SU(2) sabiti g</span><input type="range" class="phy-range" min="0.40" max="0.90" step="0.01" value="${gWeak}" data-ewsl="g" aria-label="Zayıf bağlanma sabiti g"><span class="mono" data-ewv="g">${gWeak.toFixed(3)}</span></div>
          </div>
          <div class="grp-kpis" data-ew-kpis>
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">M_W = ½ g v</span><span class="grp-kpi-val mono">${ew.mwGeV.toFixed(2)} GeV</span><span class="grp-kpi-sub">Deney: 80.38 GeV</span></div>
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">M_Z = M_W / cosθ_W</span><span class="grp-kpi-val mono">${ew.mzGeV.toFixed(2)} GeV</span><span class="grp-kpi-sub">Deney: 91.19 GeV</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">g′ = g tanθ_W</span><span class="grp-kpi-val mono">${ew.gPrime.toFixed(4)}</span><span class="grp-kpi-sub">e = g sinθ_W = ${ew.e.toFixed(4)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Bozon Muhasebesi</span><span class="grp-kpi-val">3 kütleli + 1 γ</span><span class="grp-kpi-sub">4 reel Higgs → 3 Goldstone + h</span></div>
          </div>
          <div class="grp-math-box">${tex(`H \\sim (1, 2)_{+1/2},\\quad \\langle H\\rangle = \\frac{1}{\\sqrt{2}}\\begin{pmatrix}0\\\\ v\\end{pmatrix},\\quad Q\\langle H\\rangle = (T_3+Y)\\langle H\\rangle = 0`)}</div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-sm-mode role="tablist" aria-label="Standart Model modülleri">
          <button type="button" data-m="sm" class="${mode === 'sm' ? 'on' : ''}">SM & Anomali İptali (§11.5)</button>
          <button type="button" data-m="gauge" class="${mode === 'gauge' ? 'on' : ''}">Ayar Teorileri (§11.3–4)</button>
          <button type="button" data-m="higgs" class="${mode === 'higgs' ? 'on' : ''}">Higgs & Kırılma (§11.5)</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-sm-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });

    if (mode === 'sm') {
      host.querySelector('[data-nur]')?.addEventListener('click', () => { includeNuR = !includeNuR; render(); });
      host.querySelectorAll('[data-nc]').forEach(b => { b.onclick = () => { nc = +b.dataset.nc; render(); }; });
      host.querySelector('[data-smreset]')?.addEventListener('click', () => {
        nc = 3;
        customY = Object.fromEntries(SM_FAMILY.map(f => [f.id, f.Y.slice()]));
        render();
      });
      host.querySelectorAll('[data-yf]').forEach(sel => {
        sel.onchange = () => {
          const [n, d = 1] = sel.value.split('/').map(Number);
          customY[sel.dataset.yf] = frac(n, d);
          render();
        };
      });
    } else if (mode === 'gauge') {
      host.querySelectorAll('[data-gg]').forEach(b => { b.onclick = () => { selGauge = b.dataset.gg; render(); }; });
      host.querySelector('[data-sun]')?.addEventListener('input', e => {
        customSun = +e.target.value;
        const sv = host.querySelector('[data-sunv]'); if (sv) sv.textContent = `N = ${customSun}`;
        const sk = host.querySelector('[data-sun-kpis]');
        if (sk) {
          sk.innerHTML = `<div class="grp-kpi acc"><span class="grp-kpi-lbl">SU(${customSun})</span><span class="grp-kpi-val mono">${customSun * customSun - 1} bozon</span><span class="grp-kpi-sub">N² − 1</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">SO(${customSun})</span><span class="grp-kpi-val mono">${(customSun * (customSun - 1)) / 2} bozon</span><span class="grp-kpi-sub">N(N−1)/2</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">U(${customSun})</span><span class="grp-kpi-val mono">${customSun * customSun} bozon</span><span class="grp-kpi-sub">N²</span></div>`;
        }
      });
    } else {
      const updateEwLive = () => {
        const ew = electroweakBreaking(sin2W, vGeV, gWeak);
        const vs2 = host.querySelector('[data-ewv="s2"]'); if (vs2) vs2.textContent = `${sin2W.toFixed(4)} (${ew.thetaDeg.toFixed(1)}°)`;
        const vv = host.querySelector('[data-ewv="v"]'); if (vv) vv.textContent = `${vGeV.toFixed(1)} GeV`;
        const vg = host.querySelector('[data-ewv="g"]'); if (vg) vg.textContent = gWeak.toFixed(3);
        const k = host.querySelector('[data-ew-kpis]');
        if (k) {
          k.innerHTML = `<div class="grp-kpi acc"><span class="grp-kpi-lbl">M_W = ½ g v</span><span class="grp-kpi-val mono">${ew.mwGeV.toFixed(2)} GeV</span><span class="grp-kpi-sub">Deney: 80.38 GeV</span></div>
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">M_Z = M_W / cosθ_W</span><span class="grp-kpi-val mono">${ew.mzGeV.toFixed(2)} GeV</span><span class="grp-kpi-sub">Deney: 91.19 GeV</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">g′ = g tanθ_W</span><span class="grp-kpi-val mono">${ew.gPrime.toFixed(4)}</span><span class="grp-kpi-sub">e = g sinθ_W = ${ew.e.toFixed(4)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Bozon Muhasebesi</span><span class="grp-kpi-val">3 kütleli + 1 γ</span><span class="grp-kpi-sub">4 reel Higgs → 3 Goldstone + h</span></div>`;
        }
      };
      host.querySelectorAll('[data-ew]').forEach(b => { b.onclick = () => { sin2W = +b.dataset.ew; render(); }; });
      host.querySelector('[data-ewsl="s2"]')?.addEventListener('input', e => { sin2W = +e.target.value; updateEwLive(); });
      host.querySelector('[data-ewsl="v"]')?.addEventListener('input', e => { vGeV = +e.target.value; updateEwLive(); });
      host.querySelector('[data-ewsl="g"]')?.addEventListener('input', e => { gWeak = +e.target.value; updateEwLive(); });
    }

    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 9: BÜYÜK BİRLEŞME — SU(5), SO(10), E₆ (§11.6)
// =====================================================================
export function mountGUT(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'su5'; // 'su5' | 'so10' | 'e6'
  let picked5 = 0;
  let picked10 = 0;

  const gutW = computeSu5WeinbergAngle();

  const render = () => {
    let bodyHtml = '';

    if (mode === 'su5') {
      const f5 = SU5_FIVE_BAR[picked5];
      const f10 = SU5_TEN[picked10];
      // Build 5x5 antisymmetric lookup for 10
      const pairMap = {};
      SU5_TEN.forEach((st, idx) => { pairMap[st.pair] = { st, idx }; });

      bodyHtml = `<div class="phy-stage">
        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">SU(5) sin²θ_W (GUT)</span><span class="grp-kpi-val">${tex('\\frac{3}{8} = 0.375')}</span><span class="grp-kpi-sub">Tr(T₃²) / Tr(Q²)</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">5̄ İzleri</span><span class="grp-kpi-val mono">Tr(T₃²)=${fracStr(gutW.fiveBar.trT3Sq)}</span><span class="grp-kpi-sub">Tr(Q²)=${fracStr(gutW.fiveBar.trQSq)} → 3/8 ✓</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">10 İzleri</span><span class="grp-kpi-val mono">Tr(T₃²)=${fracStr(gutW.ten.trT3Sq)}</span><span class="grp-kpi-sub">Tr(Q²)=${fracStr(gutW.ten.trQSq)} → 3/8 ✓</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Ayar Bozonları</span><span class="grp-kpi-val mono">24</span><span class="grp-kpi-sub">12 SM + 12 ağır X,Y</span></div>
        </div>

        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">SU(5) Temel Eşleniği 5̄ (5 Sol Weyl Alanı)</h3>
              <span class="grp-pill acc">Tr(Q) = 0</span>
            </div>
            <div class="phy-gut-vec">
              ${SU5_FIVE_BAR.map((st, idx) => `<button type="button" class="phy-gut-slot ${idx === picked5 ? 'on' : ''}" data-p5="${idx}">
                <span>#${st.slot} · ${tex(st.field)}</span>
                <span class="small mute">${tex(st.sm)}</span>
                <span class="mono small">Q = ${fracStr(st.Q)}</span>
              </button>`).join('')}
            </div>
            <div class="grp-callout">
              <span>Seçili: ${tex(`${f5.field} \\in ${f5.sm}`)}</span>
              <span class="grp-pill">${tex(`T_3=${fracTex(f5.T3)},\\; Y=${fracTex(f5.Y)},\\; Q=${fracTex(f5.Q)}`)}</span>
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Antisimetrik 10 (5×5 Matris — 10 Sol Weyl Alanı)</h3>
              <span class="grp-pill acc">Λ²(5)</span>
            </div>
            <div class="phy-scroll">
              <table class="phy-su5-mat" aria-label="SU(5) antisimetrik 10 temsili matrisi">
                <tbody>
                  ${[1, 2, 3, 4, 5].map(r => `<tr>
                    ${[1, 2, 3, 4, 5].map(c => {
                      if (r === c) return '<td class="diag">0</td>';
                      const key = r < c ? `(${r},${c})` : `(${c},${r})`;
                      const entry = pairMap[key];
                      const flippedField = r > c
                        ? (entry.st.field.startsWith('-') ? entry.st.field.slice(1) : `-${entry.st.field}`)
                        : entry.st.field;
                      return `<td class="slot-btn ${entry.idx === picked10 ? 'on' : ''}" data-p10="${entry.idx}">${tex(flippedField)}</td>`;
                    }).join('')}
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div class="grp-callout">
              <span>Seçili ${esc(f10.pair)}: ${tex(`${f10.field} \\in ${f10.sm}`)}</span>
              <span class="grp-pill">${tex(`T_3=${fracTex(f10.T3)},\\; Y=${fracTex(f10.Y)},\\; Q=${fracTex(f10.Q)}`)}</span>
            </div>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">SU(5) Eklenik 24 Ayar Bozonu & Proton Bozunması</h3>
            <span class="grp-pill warn">p → e⁺ + π⁰</span>
          </div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="SU(5) 24 ayar bozonu ayrışması">
              <thead><tr><th>SM Temsili</th><th>Boyut</th><th>Ayar Bozonları</th><th>Fiziksel Rol</th></tr></thead>
              <tbody>
                ${SU5_GAUGE_24.map(b => `<tr class="${b.baryonViolating ? 'on' : ''}">
                  <td>${tex(b.rep)}</td>
                  <td class="mono"><b>${b.dim}</b></td>
                  <td class="mono">${esc(b.bosons)}</td>
                  <td class="small">${esc(b.role)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="grp-callout">
            <span class="small"><b>Proton Bozunması Notu:</b> Ağır ${tex('X, Y')} leptokuark bozonları kuarkları leptonlara dönüştürerek ${tex('p \\to e^+ \\pi^0')} bozunmasına yol açar. Super-Kamiokande alt sınırı ${tex('\\tau_p > 2.4 \\times 10^{34}')} yıl olup ${tex('M_X \\gtrsim 10^{16}\\text{ GeV}')} gerektirir; ayrıca ${tex('\\sin^2\\theta_W')} RG akışıyla ${tex('M_{\\text{GUT}}')}’deki ${tex('3/8=0.375')}’ten ${tex('M_Z')}’deki ${tex('0.231')}’e iner.</span>
          </div>
        </div>
      </div>`;
    } else if (mode === 'so10') {
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">SO(10) Büyük Birleşmesi (dim = ${SO10_SPINOR_16.dimAlgebra}, Kiral Spinör 16)</h3>
            <button type="button" class="btn small ghost" data-jump="gomme-gut">${icon('side')} Lie Gömmeler & GUT →</button>
          </div>
          <p class="small mute">${esc(SO10_SPINOR_16.note)}</p>
          <div class="grp-math-box">${tex(SO10_SPINOR_16.gaugeBranching)}</div>
          <div class="phy-grid-2">
            <div>
              <div class="small mute" style="margin-bottom:6px">SU(5) × U(1) Dallanması (10 + 5 + 1 = 16):</div>
              <div class="phy-gut-vec">
                ${SO10_SPINOR_16.su5Branching.map(b => `<div class="phy-gut-slot">
                  <span>${tex(b.rep)} <span class="mute small">(dim ${b.dim})</span></span>
                  <span>${tex(b.fields)}</span>
                </div>`).join('')}
              </div>
            </div>
            <div>
              <div class="small mute" style="margin-bottom:6px">Pati–Salam SU(4) × SU(2)_L × SU(2)_R (8 + 8 = 16):</div>
              <div class="phy-gut-vec">
                ${SO10_SPINOR_16.patiSalamBranching.map(b => `<div class="phy-gut-slot">
                  <span>${tex(b.rep)} <span class="mute small">(dim ${b.dim})</span></span>
                  <span>${tex(b.fields)}</span>
                </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    } else {
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">E₆ İstisnai Büyük Birleşmesi (dim = ${E6_FUND_27.dimAlgebra}, Temel 27)</h3>
            <button type="button" class="btn small ghost" data-jump="sihirli-kare">${icon('chart')} Sihirli Kare →</button>
          </div>
          <p class="small mute">${esc(E6_FUND_27.note)}</p>
          <div class="phy-gut-vec">
            ${E6_FUND_27.so10Branching.map(b => `<div class="phy-gut-slot">
              <span>${tex(b.rep)} <span class="mute small">(dim ${b.dim})</span></span>
              <span class="small">${esc(b.fields)}</span>
            </div>`).join('')}
          </div>
          <div class="grp-math-box">
            <div class="small mute" style="margin-bottom:4px">Üçlü Birleşme (Trinification) SU(3)_c × SU(3)_L × SU(3)_R:</div>
            ${tex(`\\mathbf{27} = ${E6_FUND_27.trinification}`, true)}
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-gut-mode role="tablist" aria-label="Büyük Birleşme modelleri">
          <button type="button" data-m="su5" class="${mode === 'su5' ? 'on' : ''}">SU(5) · 5̄ ⊕ 10</button>
          <button type="button" data-m="so10" class="${mode === 'so10' ? 'on' : ''}">SO(10) · 16</button>
          <button type="button" data-m="e6" class="${mode === 'e6' ? 'on' : ''}">E₆ · 27</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-gut-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });
    host.querySelectorAll('[data-p5]').forEach(b => { b.onclick = () => { picked5 = +b.dataset.p5; render(); }; });
    host.querySelectorAll('[data-p10]').forEach(td => { td.onclick = () => { picked10 = +td.dataset.p10; render(); }; });
    host.querySelectorAll('[data-jump]').forEach(b => { b.onclick = () => ctx?.jumpTo?.(b.dataset.jump); });
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 10: AİLE SİMETRİLERİ & TRİBİMAKSİMAL KARIŞIM (§11.7)
// =====================================================================
export function mountFamilySym(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let th12 = 35.264; // arcsin(1/sqrt(3)) = TBM
  let th23 = 45.0;
  let th13 = 0.0;
  let deltaCp = 0;
  let initFlavor = 1; // 0: e, 1: mu, 2: tau
  let subClean = null;

  const tbm = verifyTbmSymmetry();

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    const U = pmnsMatrix(th12, th23, th13, deltaCp);
    const uChk = verifyUnitary3(U);
    const Uabs = U.map(r => r.map(z => Math.hypot(z[0], z[1])));
    const sin2_12 = Math.sin((th12 * Math.PI) / 180) ** 2;
    const sin2_23 = Math.sin((th23 * Math.PI) / 180) ** 2;
    const sin2_13 = Math.sin((th13 * Math.PI) / 180) ** 2;

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">PMNS Nötrino Karışımı & Tribimaximal (TBM) Simetrisi</h3>
          <div class="grp-toolbar-g">
            <button type="button" class="grp-chip" data-pmns="tbm">Tribimaximal (A₄/S₄)</button>
            <button type="button" class="grp-chip" data-pmns="exp">NuFIT Deneysel</button>
            <button type="button" class="grp-chip" data-pmns="gr">Altın Oran (A₅)</button>
          </div>
        </div>

        <div class="phy-side">
          <div class="phy-controls">
            <div class="phy-slider-row"><span>Güneş θ₁₂</span><input type="range" class="phy-range" min="15" max="55" step="0.2" value="${th12.toFixed(1)}" data-ang="12" aria-label="Güneş karışım açısı theta12"><span class="mono" data-av="12">${th12.toFixed(1)}° (${sin2_12.toFixed(3)})</span></div>
            <div class="phy-slider-row"><span>Atmosfer θ₂₃</span><input type="range" class="phy-range" min="25" max="65" step="0.2" value="${th23.toFixed(1)}" data-ang="23" aria-label="Atmosferik karışım açısı theta23"><span class="mono" data-av="23">${th23.toFixed(1)}° (${sin2_23.toFixed(3)})</span></div>
            <div class="phy-slider-row"><span>Reaktör θ₁₃</span><input type="range" class="phy-range" min="0" max="20" step="0.1" value="${th13.toFixed(1)}" data-ang="13" aria-label="Reaktör karışım açısı theta13"><span class="mono" data-av="13">${th13.toFixed(1)}° (${sin2_13.toFixed(4)})</span></div>
            <div class="phy-slider-row"><span>CP Fazı δ_CP</span><input type="range" class="phy-range" min="0" max="360" step="5" value="${deltaCp}" data-ang="cp" aria-label="CP ihlal fazı"><span class="mono" data-av="cp">${deltaCp}°</span></div>
            <div class="grp-callout ok">
              <span class="small"><b>TBM ${tex('V_4')} Simetrisi:</b> ${tbm.muTauInvariant && tbm.s2Invariant && tbm.commuteV4 ? `${tex('S_{\\mu\\tau}')} ve ${tex('S_2')} kütle matrisini korur ve değişir (${tex('V_4 = \\mathbb{Z}_2 \\times \\mathbb{Z}_2')}) ✓` : ''}</span>
              <span class="grp-pill ${uChk.ok ? 'ok' : 'bad'}">Üniter ✓</span>
            </div>
          </div>

          <div>
            <div class="small mute" style="margin-bottom:6px">Karışım genlikleri |U_αi| (α = e, μ, τ; i = 1, 2, 3):</div>
            <div data-pmns-mat>${renderRealMatrix(Uabs, { rowLabels: ['νₑ', 'ν_μ', 'ν_τ'], colLabels: ['ν₁', 'ν₂', 'ν₃'], ariaLabel: 'PMNS karışım matrisi modülleri', digits: 3 })}</div>
          </div>
        </div>

        <div class="grp-panel-head" style="margin-top:4px">
          <h4 class="grp-panel-title">3-Çeşni Vakum Nötrino Salınımı P(ν_α → ν_β)</h4>
          <div class="seg" data-fl role="tablist" aria-label="Başlangıç nötrino çeşnisi">
            <button type="button" data-f="0" class="${initFlavor === 0 ? 'on' : ''}">Başlangıç νₑ</button>
            <button type="button" data-f="1" class="${initFlavor === 1 ? 'on' : ''}">Başlangıç ν_μ</button>
            <button type="button" data-f="2" class="${initFlavor === 2 ? 'on' : ''}">Başlangıç ν_τ</button>
          </div>
        </div>
        <div class="phy-cv-box">
          <canvas class="phy-cv" data-osc-cv aria-label="Üç çeşni nötrino salınım olasılık grafiği"></canvas>
          <div class="phy-cv-tag">Sarı: P(νₑ) · Mavi: P(ν_μ) · Pembe: P(ν_τ) · Toplam = 1</div>
        </div>
      </div>

      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">Neden Sonlu SO(3) / SU(2) / SU(3) Alt Grupları? (§11.7)</h3>
          <div class="grp-toolbar-g">
            <button type="button" class="btn small primary" data-jump="ortuler-mckay">${icon('atom')} Örtüler & İkili Gruplar (11.7) →</button>
            <button type="button" class="btn small ghost" data-jump="galois-fano">${icon('rotate')} PSL₂(7) & Fano →</button>
            <button type="button" class="btn small ghost" data-jump="temsil-konu">${icon('book')} Temsil Dersleri →</button>
          </div>
        </div>
        <p class="small mute">Üç fermiyon ailesini tek bir indirgenemez üçlüde (<b>3</b>) birleştirip büyük nötrino karışım açılarını geometrik olarak sabitlemek için sürekli grupların ayrık alt grupları kullanılır:</p>
        <div class="phy-scroll">
          <table class="grp-tbl" aria-label="Aile simetrisi sonlu alt grupları">
            <thead><tr><th>Grup</th><th>|G|</th><th>Üst Grup</th><th>İrrepler</th><th>Fiziksel Rol</th><th>İncele</th></tr></thead>
            <tbody>
              ${FAMILY_SUBGROUPS.map((fg, idx) => `<tr>
                <td><b>${tex(fg.group)}</b></td>
                <td class="mono">${fg.order}</td>
                <td class="mono">${esc(fg.parent)}</td>
                <td class="mono small">${esc(fg.irreps)}</td>
                <td class="small mute">${esc(fg.physics)}</td>
                <td>${fg.spec
                  ? `<button type="button" class="btn small ghost" data-fg-spec="${idx}">Karakter →</button>`
                  : `<button type="button" class="btn small ghost" data-jump="${fg.group.includes('PSL') ? 'galois-fano' : 'ortuler-mckay'}">Aç →</button>`
                }</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

    let oscCtrl = null;
    const updatePmnsLive = () => {
      const Un = pmnsMatrix(th12, th23, th13, deltaCp);
      const Ua = Un.map(r => r.map(z => Math.hypot(z[0], z[1])));
      const s12 = Math.sin((th12 * Math.PI) / 180) ** 2;
      const s23 = Math.sin((th23 * Math.PI) / 180) ** 2;
      const s13 = Math.sin((th13 * Math.PI) / 180) ** 2;
      const a12 = host.querySelector('[data-av="12"]'); if (a12) a12.textContent = `${th12.toFixed(1)}° (${s12.toFixed(3)})`;
      const a23 = host.querySelector('[data-av="23"]'); if (a23) a23.textContent = `${th23.toFixed(1)}° (${s23.toFixed(3)})`;
      const a13 = host.querySelector('[data-av="13"]'); if (a13) a13.textContent = `${th13.toFixed(1)}° (${s13.toFixed(4)})`;
      const acp = host.querySelector('[data-av="cp"]'); if (acp) acp.textContent = `${deltaCp}°`;
      const matBox = host.querySelector('[data-pmns-mat]');
      if (matBox) matBox.innerHTML = renderRealMatrix(Ua, { rowLabels: ['νₑ', 'ν_μ', 'ν_τ'], colLabels: ['ν₁', 'ν₂', 'ν₃'], ariaLabel: 'PMNS karışım matrisi modülleri', digits: 3 });
      oscCtrl?.render();
    };
    host.querySelectorAll('[data-pmns]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.pmns === 'tbm') { th12 = 35.264; th23 = 45.0; th13 = 0.0; deltaCp = 0; }
        else if (b.dataset.pmns === 'exp') { th12 = 33.41; th23 = 49.0; th13 = 8.54; deltaCp = 197; }
        else { th12 = 31.717; th23 = 45.0; th13 = 0.0; deltaCp = 0; } // arctan(1/phi)
        render();
      };
    });
    host.querySelectorAll('[data-ang]').forEach(sl => {
      sl.oninput = () => {
        const k = sl.dataset.ang;
        if (k === '12') th12 = +sl.value;
        else if (k === '23') th23 = +sl.value;
        else if (k === '13') th13 = +sl.value;
        else deltaCp = +sl.value;
        updatePmnsLive();
      };
    });
    host.querySelector('[data-fl]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-f]');
      if (!b) return;
      initFlavor = +b.dataset.f;
      render();
    });
    host.querySelectorAll('[data-jump]').forEach(b => { b.onclick = () => ctx?.jumpTo?.(b.dataset.jump); });
    host.querySelectorAll('[data-fg-spec]').forEach(b => {
      b.onclick = () => {
        const fg = FAMILY_SUBGROUPS[+b.dataset.fgSpec];
        if (fg?.spec) ctx?.jumpTo?.('karakter', fg.spec);
      };
    });

    const cv = host.querySelector('[data-osc-cv]');
    if (cv) {
      oscCtrl = setupCanvas(cv, cw => Math.min(240, Math.max(185, cw * 0.42)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const padL = 36, padR = 16, padT = 32, padB = 28;
        const maxLE = 1400;
        const plotW = W - padL - padR, plotH = H - padT - padB;

        c.strokeStyle = 'rgba(255,255,255,0.14)';
        for (const p of [0, 0.5, 1]) {
          const y = padT + (1 - p) * plotH;
          c.beginPath(); c.moveTo(padL, y); c.lineTo(W - padR, y); c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.font = '10px var(--mono), monospace';
          c.textAlign = 'right';
          c.fillText(p.toFixed(1), padL - 6, y + 3);
        }

        const cols = ['#fbbf24', '#60a5fa', '#f472b6'];
        const steps = 160;
        const pts = [[], [], []];
        for (let i = 0; i <= steps; i++) {
          const le = (i / steps) * maxLE;
          const probs = neutrinoOscillationProbs(initFlavor, le, {
            th12Deg: th12, th23Deg: th23, th13Deg: th13, deltaCpDeg: deltaCp,
          });
          const x = padL + (i / steps) * plotW;
          for (let b = 0; b < 3; b++) pts[b].push([x, padT + (1 - probs[b]) * plotH]);
        }

        for (let b = 0; b < 3; b++) {
          c.strokeStyle = cols[b];
          c.lineWidth = 2.2;
          c.beginPath();
          pts[b].forEach((p, i) => { if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); });
          c.stroke();
        }

        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.font = '10.5px var(--mono), monospace';
        c.textAlign = 'center';
        c.fillText('L / E (km/GeV)  0 → 1400', padL + plotW / 2, H - 8);
      }, localClean);
    }

    syncSegments(host, true);
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}
