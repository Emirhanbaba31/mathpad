// MathPad Physics & Exceptional Structures (Ramond Part C) — Chapter: fizik
// Covers Ramond Ch. 4 (Hilbert Spaces, Fermi & Boson Oscillators),
// Ch. 5.5 (3D Harmonic Oscillator, Bohr Atom, Isospin), Ch. 6.7.1–6.7.3 (SU(3) in Physics).
import { esc, icon } from './ui.js';
import { full, syncSegments } from './fx.js';
import {
  cAbs2,
  innerProduct,
  vecNorm,
  normalizeState,
  applyOperator,
  isUnitary,
  su2Matrix,
  u1PhaseMatrix,
  fermiOperators,
  verifyFermiAnticommutators,
  verifyUnBilinears,
  fermiSpinorSplit,
  bosonTruncated,
  coherentState,
  oscillatorShell,
  BOHR_E1_EV,
  bohrLevel,
  bohrTransition,
  bohrSeries,
  coupleIsospin,
  NUCLEONS,
  PIONS,
  TWO_NUCLEON_STATES,
  elliottBranching,
  ELLIOTT_SD_NUCLEI,
  SAKATA_TRIPLET,
  SAKATA_DECOMPOSITIONS,
} from './physgroups.js';
import {
  ensurePhysCss,
  tex,
  accentColor,
  createClean,
  setupCanvas,
  createAnimLoop,
  fmtNum,
  fmtComplex,
  renderComplexMatrix,
  fmtHalfInt,
  fmtHalfIntTex,
} from './phys-ui.js';

// =====================================================================
// TAB 1: HİLBERT UZAYLARI & FERMİ OSİLATÖRLERİ (Ramond Ch. 4)
// =====================================================================
export function mountHilbertFermi(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'fermi'; // 'fermi' | 'finite' | 'boson'

  // Fermi state
  let fermiN = 3;
  let fockIdx = 0; // index in 0..2^n-1
  let fockSign = 1; // +1, -1, or 0 (annihilated)
  let lastFermiAction = 'Vakum durumu |000⟩ hazır';
  let opKind = 'aDag'; // 'a' | 'aDag' | 'N' | 'NTotal' | 'E' | 'gamma'
  let opI = 0;
  let opJ = 1;

  // Finite Hilbert state (2D qubit)
  let psiRaw = [[1, 0], [1, 0]];
  let phiRaw = [[1, 0], [0, 0]];
  let su2Theta = Math.PI / 2;
  let su2AxisKey = 'y';
  let u1Phi = 0;

  // Boson state
  let bosonDim = 8;
  let alphaRe = 1.6;
  let alphaIm = 0.6;

  let subClean = null;

  const AXES = {
    x: { label: 'x̂ = (1,0,0)', vec: [1, 0, 0] },
    y: { label: 'ŷ = (0,1,0)', vec: [0, 1, 0] },
    z: { label: 'ẑ = (0,0,1)', vec: [0, 0, 1] },
    d: { label: '(1,1,1)/√3', vec: [1, 1, 1] },
  };

  const resetFock = () => {
    fockIdx = 0;
    fockSign = 1;
    lastFermiAction = `Vakum durumu |${'0'.repeat(fermiN)}⟩`;
  };

  const applyFermiStep = (type, modeIdx) => {
    const f = fermiOperators(fermiN);
    if (fockSign === 0) {
      lastFermiAction = 'Durum sıfır (0) — önce vakuma sıfırla.';
      return;
    }
    const vec = Array.from({ length: f.dim }, (_, k) => k === fockIdx ? [fockSign, 0] : [0, 0]);
    const op = type === 'cre' ? f.aDag[modeIdx] : f.a[modeIdx];
    const out = applyOperator(op, vec);
    let found = -1, sgn = 0;
    for (let k = 0; k < f.dim; k++) {
      if (Math.abs(out[k][0]) > 0.5) {
        found = k;
        sgn = out[k][0] > 0 ? 1 : -1;
        break;
      }
    }
    const sym = type === 'cre' ? `a_${modeIdx + 1}†` : `a_${modeIdx + 1}`;
    const prevTxt = `${fockSign < 0 ? '−' : ''}${f.basis[fockIdx].text}`;
    if (found < 0) {
      fockSign = 0;
      lastFermiAction = type === 'cre'
        ? `${sym} ${prevTxt} = 0  (Pauli dışarlama ilkesi: mod ${modeIdx + 1} zaten dolu!)`
        : `${sym} ${prevTxt} = 0  (Mod ${modeIdx + 1} zaten boş!)`;
    } else {
      const flipped = sgn !== fockSign;
      fockIdx = found;
      fockSign = sgn;
      const nextTxt = `${fockSign < 0 ? '−' : ''}${f.basis[fockIdx].text}`;
      lastFermiAction = `${sym} ${prevTxt} = ${nextTxt}${flipped ? '  (Jordan–Wigner işareti −1!)' : ''}`;
    }
  };

  const render = () => {
    subClean?.();
    subClean = null;
    const localFns = [];
    const localClean = {
      add(fn) { if (typeof fn === 'function') localFns.push(fn); },
    };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    let bodyHtml = '';

    if (mode === 'fermi') {
      const f = fermiOperators(fermiN);
      const car = verifyFermiAnticommutators(fermiN);
      const un = verifyUnBilinears(fermiN);
      const sp = fermiSpinorSplit(fermiN);
      if (opI >= fermiN) opI = 0;
      if (opJ >= fermiN) opJ = Math.min(1, fermiN - 1);

      let mat = f.aDag[opI];
      let matTitle = `a_${opI + 1}^\\dagger`;
      if (opKind === 'a') { mat = f.a[opI]; matTitle = `a_${opI + 1}`; }
      else if (opKind === 'N') { mat = f.N[opI]; matTitle = `N_${opI + 1} = a_${opI + 1}^\\dagger a_${opI + 1}`; }
      else if (opKind === 'NTotal') { mat = f.NTotal; matTitle = `N_{\\text{top}} = \\sum_{i=1}^{${fermiN}} N_i`; }
      else if (opKind === 'E') { mat = f.bilinears[opI][opJ]; matTitle = `E_{${opI + 1}${opJ + 1}} = a_${opI + 1}^\\dagger a_${opJ + 1}`; }
      else if (opKind === 'gamma') {
        const gIdx = Math.min(2 * fermiN - 1, opI);
        mat = f.gamma[gIdx];
        matTitle = `\\gamma_${gIdx + 1}`;
      }

      const curState = fockSign === 0
        ? '0'
        : `${fockSign < 0 ? '−' : '+'}${f.basis[fockIdx].text}`;
      const curBasis = f.basis[fockIdx];

      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-toolbar-g">
              <span class="small mute">Fermi mod sayısı:</span>
              ${[1, 2, 3, 4].map(n => `<button type="button" class="grp-chip ${n === fermiN ? 'on' : ''}" data-fn="${n}">n = ${n} (${1 << n}×${1 << n})</button>`).join('')}
            </div>
            <button type="button" class="btn small ghost" data-jump-spinor>${icon('ellipse')} Spinörler & Clifford →</button>
          </div>

          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Fock Boyutu</span><span class="grp-kpi-val">${tex(`2^{${fermiN}} = ${f.dim}`)}</span><span class="grp-kpi-sub">SO(${2 * fermiN}) Dirac spinörü</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">CAR Antikomütatör</span><span class="grp-kpi-val">${car.ok ? 'Doğrulandı ✓' : 'Hata ✗'}</span><span class="grp-kpi-sub">maks hata: ${car.maxError.toExponential(1)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">u(${fermiN}) İkilileri</span><span class="grp-kpi-val">${un.ok ? `${un.dimGenerators} üreteç ✓` : 'Hata ✗'}</span><span class="grp-kpi-sub">${un.totalChecks} komütatör kontrolü</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Kiral Ayrışma</span><span class="grp-kpi-val">${tex(`${sp.chiralDims[0]}_+ \\oplus ${sp.chiralDims[1]}_-`)}</span><span class="grp-kpi-sub">SO(${2 * fermiN}) dim = ${sp.algebraDim}</span></div>
          </div>

          <div class="phy-fock-bar">
            <span class="small mute">Fock Durumu:</span>
            <span class="phy-fock-state" aria-live="polite">${esc(curState)}</span>
            ${fockSign !== 0 ? `<span class="grp-pill acc">N = ${curBasis.particleCount}</span><span class="grp-pill">Kiralite: ${curBasis.chirality}</span>` : '<span class="grp-pill bad">Yok edildi (0)</span>'}
            <button type="button" class="btn small ghost" data-freset>Vakuma sıfırla |${'0'.repeat(fermiN)}⟩</button>
          </div>
          <div class="small mute mono">${esc(lastFermiAction)}</div>

          <div class="phy-mode-row">
            ${Array.from({ length: fermiN }, (_, i) => `
              <button type="button" class="btn small" data-fact="cre:${i}" aria-label="Mod ${i + 1} yaratma operatörü">${tex(`a_${i + 1}^\\dagger`)} Yarat</button>
              <button type="button" class="btn small ghost" data-fact="ann:${i}" aria-label="Mod ${i + 1} yok etme operatörü">${tex(`a_${i + 1}`)} Yok et</button>
            `).join('')}
          </div>
        </div>

        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Açık Jordan–Wigner Matrisi</h3>
              <span class="grp-pill acc">${tex(matTitle)}</span>
            </div>
            <div class="grp-toolbar">
              <select class="inp grp-sel" data-opkind aria-label="Operatör türü">
                <option value="aDag" ${opKind === 'aDag' ? 'selected' : ''}>Yaratma aᵢ†</option>
                <option value="a" ${opKind === 'a' ? 'selected' : ''}>Yok etme aᵢ</option>
                <option value="N" ${opKind === 'N' ? 'selected' : ''}>Mod sayısı Nᵢ = aᵢ†aᵢ</option>
                <option value="NTotal" ${opKind === 'NTotal' ? 'selected' : ''}>Toplam sayı N_top</option>
                <option value="E" ${opKind === 'E' ? 'selected' : ''}>u(n) ikilisi Eᵢⱼ = aᵢ†aⱼ</option>
                <option value="gamma" ${opKind === 'gamma' ? 'selected' : ''}>Clifford matrisi γ_μ</option>
              </select>
              ${opKind !== 'NTotal' ? `<select class="inp grp-sel" data-opi aria-label="Birinci indeks i">
                ${Array.from({ length: opKind === 'gamma' ? 2 * fermiN : fermiN }, (_, i) => `<option value="${i}" ${i === opI ? 'selected' : ''}>${opKind === 'gamma' ? `μ = ${i + 1}` : `i = ${i + 1}`}</option>`).join('')}
              </select>` : ''}
              ${opKind === 'E' ? `<select class="inp grp-sel" data-opj aria-label="İkinci indeks j">
                ${Array.from({ length: fermiN }, (_, j) => `<option value="${j}" ${j === opJ ? 'selected' : ''}>j = ${j + 1}</option>`).join('')}
              </select>` : ''}
            </div>
            ${renderComplexMatrix(mat, {
              rowLabels: f.basis.map(b => b.text),
              colLabels: f.basis.map(b => b.text),
              ariaLabel: `Fermi operatörü matrisi ${matTitle}`,
              digits: 2,
            })}
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">SO(${2 * fermiN}) Kiral Spinör Ayrışması</h3>
              <span class="grp-pill ok">Clifford ✓ · Parite ✓</span>
            </div>
            <div class="grp-math-box">${tex(`\\{\\gamma_\\mu, \\gamma_\\nu\\} = 2\\delta_{\\mu\\nu},\\quad \\Sigma_{\\mu\\nu} = -\\frac{i}{4}[\\gamma_\\mu, \\gamma_\\nu],\\quad [P, \\Sigma_{\\mu\\nu}] = 0`)}</div>
            <div class="small mute">Çift pariteli kiral spinör ${tex(`S_+\\;(\\dim = ${sp.evenStates.length})`)} — tıklayarak duruma geç:</div>
            <div class="grp-elems">
              ${sp.evenStates.map(b => `<button type="button" class="grp-el ${fockSign !== 0 && fockIdx === b.index ? 'on' : ''}" data-pick-fock="${b.index}">${esc(b.text)} <span class="mute">N=${b.particleCount}</span></button>`).join('')}
            </div>
            <div class="small mute">Tek pariteli kiral spinör ${tex(`S_-\\;(\\dim = ${sp.oddStates.length})`)}:</div>
            <div class="grp-elems">
              ${sp.oddStates.map(b => `<button type="button" class="grp-el ${fockSign !== 0 && fockIdx === b.index ? 'on' : ''}" data-pick-fock="${b.index}">${esc(b.text)} <span class="mute">N=${b.particleCount}</span></button>`).join('')}
            </div>
            <div class="grp-callout">
              <span class="small">${tex(`E_{ij} = a_i^\\dagger a_j`)} ikilileri ${tex(`[E_{ij}, E_{kl}] = \\delta_{jk}E_{il} - \\delta_{il}E_{kj}`)} komütatörleriyle ${tex(`\\mathfrak{u}(${fermiN})`)} cebirini üretir (${un.totalChecks} kontrolün tamamı sıfır hatayla geçti).</span>
            </div>
          </div>
        </div>
      </div>`;
    } else if (mode === 'finite') {
      const psi = normalizeState(psiRaw);
      const phi = normalizeState(phiRaw);
      const axisObj = AXES[su2AxisKey] || AXES.y;
      const Urot = su2Matrix(su2Theta, axisObj.vec);
      const Uph = u1PhaseMatrix(u1Phi, 2);
      const U = [
        [
          [Uph[0][0][0] * Urot[0][0][0] - Uph[0][0][1] * Urot[0][0][1], Uph[0][0][0] * Urot[0][0][1] + Uph[0][0][1] * Urot[0][0][0]],
          [Uph[0][0][0] * Urot[0][1][0] - Uph[0][0][1] * Urot[0][1][1], Uph[0][0][0] * Urot[0][1][1] + Uph[0][0][1] * Urot[0][1][0]],
        ],
        [
          [Uph[1][1][0] * Urot[1][0][0] - Uph[1][1][1] * Urot[1][0][1], Uph[1][1][0] * Urot[1][0][1] + Uph[1][1][1] * Urot[1][0][0]],
          [Uph[1][1][0] * Urot[1][1][0] - Uph[1][1][1] * Urot[1][1][1], Uph[1][1][0] * Urot[1][1][1] + Uph[1][1][1] * Urot[1][1][0]],
        ],
      ];
      const uChk = isUnitary(U);
      const uPsi = applyOperator(U, psi);
      const uPhi = applyOperator(U, phi);
      const ip0 = innerProduct(psi, phi);
      const ip1 = innerProduct(uPsi, uPhi);
      const ipDiff = Math.hypot(ip0[0] - ip1[0], ip0[1] - ip1[1]);

      bodyHtml = `<div class="phy-stage">
        <div class="phy-side">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Sonlu Hilbert Uzayı ℂ² & Üniter SU(2) × U(1) Etkisi</h3>
              <span class="grp-pill ${uChk.ok ? 'ok' : 'bad'}" data-fin-ubadge>${uChk.ok ? 'U†U = I ✓' : 'Üniter değil'}</span>
            </div>
            <div class="phy-controls">
              <div class="small mute">Hazır durumlar ${tex('|\\psi\\rangle')} ve ${tex('|\\phi\\rangle')}:</div>
              <div class="grp-elems">
                <button type="button" class="grp-chip" data-preset="psi:1,0,0,0">|ψ⟩=|0⟩</button>
                <button type="button" class="grp-chip" data-preset="psi:0,0,1,0">|ψ⟩=|1⟩</button>
                <button type="button" class="grp-chip" data-preset="psi:1,0,1,0">|ψ⟩=|+⟩</button>
                <button type="button" class="grp-chip" data-preset="psi:1,0,0,1">|ψ⟩=|+i⟩</button>
                <button type="button" class="grp-chip" data-preset="phi:1,0,0,0">|φ⟩=|0⟩</button>
                <button type="button" class="grp-chip" data-preset="phi:1,0,1,0">|φ⟩=|+⟩</button>
                <button type="button" class="grp-chip" data-preset="phi:1,0,-1,0">|φ⟩=|−⟩</button>
              </div>
              <div class="phy-num-grid">
                <label class="phy-num-cell">Re(ψ₀)<input type="number" step="0.2" data-vec="psi:0:0" value="${psiRaw[0][0]}" aria-label="psi0 gerçel"></label>
                <label class="phy-num-cell">Im(ψ₀)<input type="number" step="0.2" data-vec="psi:0:1" value="${psiRaw[0][1]}" aria-label="psi0 sanal"></label>
                <label class="phy-num-cell">Re(ψ₁)<input type="number" step="0.2" data-vec="psi:1:0" value="${psiRaw[1][0]}" aria-label="psi1 gerçel"></label>
                <label class="phy-num-cell">Im(ψ₁)<input type="number" step="0.2" data-vec="psi:1:1" value="${psiRaw[1][1]}" aria-label="psi1 sanal"></label>
              </div>
              <div class="grp-elems">
                <span class="small mute">Eksen:</span>
                ${Object.entries(AXES).map(([k, a]) => `<button type="button" class="grp-chip ${k === su2AxisKey ? 'on' : ''}" data-axis="${k}">${esc(a.label)}</button>`).join('')}
              </div>
              <div class="phy-slider-row">
                <span>Dönme ${tex('\\theta')}</span>
                <input type="range" class="phy-range" min="0" max="${(4 * Math.PI).toFixed(4)}" step="0.05" value="${su2Theta.toFixed(3)}" data-sl="theta" aria-label="SU(2) dönme açısı">
                <span class="mono" data-slv="theta">${Math.round(su2Theta * 180 / Math.PI)}°</span>
              </div>
              <div class="phy-slider-row">
                <span>Faz ${tex('U(1)\\;\\phi')}</span>
                <input type="range" class="phy-range" min="0" max="${(2 * Math.PI).toFixed(4)}" step="0.05" value="${u1Phi.toFixed(3)}" data-sl="phi" aria-label="U(1) global faz">
                <span class="mono" data-slv="phi">${Math.round(u1Phi * 180 / Math.PI)}°</span>
              </div>
            </div>
            <div data-fin-out>
              <div class="grp-kpis">
                <div class="grp-kpi acc"><span class="grp-kpi-lbl">İç Çarpım ⟨ψ|φ⟩</span><span class="grp-kpi-val mono">${esc(fmtComplex(ip0, 3))}</span><span class="grp-kpi-sub">|⟨ψ|φ⟩|² = ${cAbs2(ip0).toFixed(3)}</span></div>
                <div class="grp-kpi"><span class="grp-kpi-lbl">⟨Uψ|Uφ⟩ (Sonra)</span><span class="grp-kpi-val mono">${esc(fmtComplex(ip1, 3))}</span><span class="grp-kpi-sub">fark = ${ipDiff.toExponential(1)}</span></div>
                <div class="grp-kpi"><span class="grp-kpi-lbl">Norm ||Uψ||</span><span class="grp-kpi-val mono">${vecNorm(uPsi).toFixed(6)}</span><span class="grp-kpi-sub">Wigner korunumu ✓</span></div>
              </div>
              <div class="small mute" style="margin:10px 0 6px">Üniter operatör matrisi ${tex('U = e^{i\\phi} e^{-i\\frac{\\theta}{2}\\hat{n}\\cdot\\vec{\\sigma}}')}:</div>
              ${renderComplexMatrix(U, { rowLabels: ['⟨0|', '⟨1|'], colLabels: ['|0⟩', '|1⟩'], ariaLabel: 'Üniter SU(2) matrisi', digits: 3 })}
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head"><h3 class="grp-panel-title">Bloch Küresi İzdüşümü</h3><span class="grp-pill">θ = 360° → −I</span></div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-bloch-cv aria-label="Bloch küresi üzerinde üniter dönüşüm"></canvas>
              <div class="phy-cv-tag">Mavi: |ψ⟩ · Vurgu: U|ψ⟩</div>
            </div>
            <div class="small mute">Normalleştirilmiş durumlar:</div>
            <div class="grp-math-box" data-fin-ket>${tex(`|\\psi\\rangle = \\begin{pmatrix}${fmtComplex(psi[0], 2)}\\\\ ${fmtComplex(psi[1], 2)}\\end{pmatrix},\\quad U|\\psi\\rangle = \\begin{pmatrix}${fmtComplex(uPsi[0], 2)}\\\\ ${fmtComplex(uPsi[1], 2)}\\end{pmatrix}`)}</div>
          </div>
        </div>
      </div>`;
    } else {
      const b = bosonTruncated(bosonDim);
      const coh = coherentState(alphaRe, alphaIm, 28);
      bodyHtml = `<div class="phy-stage">
        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Sonlu Kesilmiş Bozon [a, a†] Matrisi</h3>
              <span class="grp-pill warn">Tr[a, a†] = 0 Uyarısı!</span>
            </div>
            <div class="phy-slider-row">
              <span>Kesme boyutu D</span>
              <input type="range" class="phy-range" min="4" max="12" step="1" value="${bosonDim}" data-sl="bdim" aria-label="Bozon kesme boyutu">
              <span class="mono" data-slv="bdim">D = ${bosonDim}</span>
            </div>
            <div data-boson-out>
              <div class="grp-callout" style="margin-bottom:10px">
                <span class="small">İlk ${bosonDim - 1} köşegen elemanı <b>+1</b> iken son eleman <b>${b.defectEntry}</b> çıkar: ${tex('\\operatorname{Tr}[a,a^\\dagger]=0')}. Bu yüzden ${tex('[a,a^\\dagger]=I')} yalnızca <b>sonsuz boyutlu</b> Hilbert uzayında sağlanır!</span>
              </div>
              ${renderComplexMatrix(b.comm, {
                rowLabels: Array.from({ length: bosonDim }, (_, i) => `|${i}⟩`),
                colLabels: Array.from({ length: bosonDim }, (_, i) => `|${i}⟩`),
                ariaLabel: 'Kesilmiş bozon komütatörü',
                digits: 1,
              })}
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Uyumlu Durum |α⟩ (Coherent State)</h3>
              <span class="grp-pill acc" data-coh-tag>${tex(`\\alpha = ${fmtComplex([alphaRe, alphaIm], 2)}`)}</span>
            </div>
            <div class="phy-controls">
              <div class="phy-slider-row">
                <span>Re(α)</span>
                <input type="range" class="phy-range" min="-2.8" max="2.8" step="0.1" value="${alphaRe}" data-sl="are" aria-label="Alpha gerçel kısım">
                <span class="mono" data-slv="are">${alphaRe.toFixed(1)}</span>
              </div>
              <div class="phy-slider-row">
                <span>Im(α)</span>
                <input type="range" class="phy-range" min="-2.8" max="2.8" step="0.1" value="${alphaIm}" data-sl="aim" aria-label="Alpha sanal kısım">
                <span class="mono" data-slv="aim">${alphaIm.toFixed(1)}</span>
              </div>
            </div>
            <div class="grp-kpis" data-coh-kpis>
              <div class="grp-kpi acc"><span class="grp-kpi-lbl">Ortalama ⟨N⟩</span><span class="grp-kpi-val mono">${coh.meanN.toFixed(2)}</span><span class="grp-kpi-sub">|α|² (Poisson)</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Varyans ΔN²</span><span class="grp-kpi-val mono">${coh.varN.toFixed(2)}</span><span class="grp-kpi-sub">ΔN = √⟨N⟩</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Belirsizlik ΔxΔp</span><span class="grp-kpi-val mono">0.500 ℏ</span><span class="grp-kpi-sub">Minimum sınır ✓</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Özdeğer Hatası</span><span class="grp-kpi-val mono">${coh.eigenError.toExponential(1)}</span><span class="grp-kpi-sub">D=28 kesmede</span></div>
            </div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-coh-cv aria-label="Uyumlu durum Poisson Fock dağılımı ve faz uzayı"></canvas>
              <div class="phy-cv-tag">Sol: Poisson P(n) · Sağ: Faz uzayı (x, p)</div>
            </div>
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-hf-mode role="tablist" aria-label="Hilbert uzayı modülleri">
          <button type="button" data-m="fermi" class="${mode === 'fermi' ? 'on' : ''}">Fermi & SO(2n) (§4.2)</button>
          <button type="button" data-m="finite" class="${mode === 'finite' ? 'on' : ''}">Sonlu Hilbert (§4.1)</button>
          <button type="button" data-m="boson" class="${mode === 'boson' ? 'on' : ''}">Bozon & Uyumlu (§4.3)</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-hf-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });

    if (mode === 'fermi') {
      host.querySelectorAll('[data-fn]').forEach(b => {
        b.onclick = () => { fermiN = +b.dataset.fn; resetFock(); render(); };
      });
      host.querySelector('[data-freset]')?.addEventListener('click', () => { resetFock(); render(); });
      host.querySelectorAll('[data-fact]').forEach(b => {
        b.onclick = () => {
          const [t, i] = b.dataset.fact.split(':');
          applyFermiStep(t, +i);
          render();
        };
      });
      host.querySelectorAll('[data-pick-fock]').forEach(b => {
        b.onclick = () => {
          fockIdx = +b.dataset.pickFock;
          fockSign = 1;
          const f = fermiOperators(fermiN);
          lastFermiAction = `Doğrudan seçilen Fock durumu: ${f.basis[fockIdx].text}`;
          render();
        };
      });
      host.querySelector('[data-opkind]')?.addEventListener('change', e => { opKind = e.target.value; opI = 0; render(); });
      host.querySelector('[data-opi]')?.addEventListener('change', e => { opI = +e.target.value; render(); });
      host.querySelector('[data-opj]')?.addEventListener('change', e => { opJ = +e.target.value; render(); });
      host.querySelector('[data-jump-spinor]')?.addEventListener('click', () => ctx?.jumpTo?.('spinor-clifford'));
    } else if (mode === 'finite') {
      host.querySelectorAll('[data-preset]').forEach(b => {
        b.onclick = () => {
          const [which, vals] = b.dataset.preset.split(':');
          const [a, c, d, f] = vals.split(',').map(Number);
          if (which === 'phi') phiRaw = [[a, c], [d, f]];
          else psiRaw = [[a, c], [d, f]];
          render();
        };
      });
      host.querySelectorAll('[data-vec]').forEach(inp => {
        inp.onchange = () => {
          const [, i, j] = inp.dataset.vec.split(':');
          const v = Number(inp.value);
          if (Number.isFinite(v)) psiRaw[+i][+j] = v;
          render();
        };
      });
      host.querySelectorAll('[data-axis]').forEach(b => {
        b.onclick = () => { su2AxisKey = b.dataset.axis; render(); };
      });
      const cv = host.querySelector('[data-bloch-cv]');
      let blochCtrl = null;
      const blochVec = st => {
        const a = st[0], b = st[1];
        const ab = [a[0] * b[0] + a[1] * b[1], a[0] * b[1] - a[1] * b[0]];
        return [2 * ab[0], 2 * ab[1], cAbs2(a) - cAbs2(b)];
      };
      const updateFiniteLive = () => {
        const psi = normalizeState(psiRaw);
        const phi = normalizeState(phiRaw);
        const uRot = su2Matrix(su2Theta, (AXES[su2AxisKey] || AXES.y).vec);
        const uPh = u1PhaseMatrix(u1Phi, 2);
        const U = [[0, 1], [0, 1]].map((_, r) => [0, 1].map(c => [
          uPh[r][r][0] * uRot[r][c][0] - uPh[r][r][1] * uRot[r][c][1],
          uPh[r][r][0] * uRot[r][c][1] + uPh[r][r][1] * uRot[r][c][0],
        ]));
        const uPsi = applyOperator(U, psi);
        const uPhi = applyOperator(U, phi);
        const ip0 = innerProduct(psi, phi);
        const ip1 = innerProduct(uPsi, uPhi);
        const ipDiff = Math.hypot(ip0[0] - ip1[0], ip0[1] - ip1[1]);
        const vTh = host.querySelector('[data-slv="theta"]');
        const vPh = host.querySelector('[data-slv="phi"]');
        if (vTh) vTh.textContent = `${Math.round(su2Theta * 180 / Math.PI)}°`;
        if (vPh) vPh.textContent = `${Math.round(u1Phi * 180 / Math.PI)}°`;
        const out = host.querySelector('[data-fin-out]');
        if (out) {
          out.innerHTML = `<div class="grp-kpis">
              <div class="grp-kpi acc"><span class="grp-kpi-lbl">İç Çarpım ⟨ψ|φ⟩</span><span class="grp-kpi-val mono">${esc(fmtComplex(ip0, 3))}</span><span class="grp-kpi-sub">|⟨ψ|φ⟩|² = ${cAbs2(ip0).toFixed(3)}</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">⟨Uψ|Uφ⟩ (Sonra)</span><span class="grp-kpi-val mono">${esc(fmtComplex(ip1, 3))}</span><span class="grp-kpi-sub">fark = ${ipDiff.toExponential(1)}</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Norm ||Uψ||</span><span class="grp-kpi-val mono">${vecNorm(uPsi).toFixed(6)}</span><span class="grp-kpi-sub">Wigner korunumu ✓</span></div>
            </div>
            <div class="small mute" style="margin:10px 0 6px">Üniter operatör matrisi ${tex('U = e^{i\\phi} e^{-i\\frac{\\theta}{2}\\hat{n}\\cdot\\vec{\\sigma}}')}:</div>
            ${renderComplexMatrix(U, { rowLabels: ['⟨0|', '⟨1|'], colLabels: ['|0⟩', '|1⟩'], ariaLabel: 'Üniter SU(2) matrisi', digits: 3 })}`;
        }
        const ket = host.querySelector('[data-fin-ket]');
        if (ket) {
          ket.innerHTML = tex(`|\\psi\\rangle = \\begin{pmatrix}${fmtComplex(psi[0], 2)}\\\\ ${fmtComplex(psi[1], 2)}\\end{pmatrix},\\quad U|\\psi\\rangle = \\begin{pmatrix}${fmtComplex(uPsi[0], 2)}\\\\ ${fmtComplex(uPsi[1], 2)}\\end{pmatrix}`);
        }
        blochCtrl?.render();
      };
      host.querySelector('[data-sl="theta"]')?.addEventListener('input', e => { su2Theta = +e.target.value; updateFiniteLive(); });
      host.querySelector('[data-sl="phi"]')?.addEventListener('input', e => { u1Phi = +e.target.value; updateFiniteLive(); });

      if (cv) {
        blochCtrl = setupCanvas(cv, cw => Math.min(300, cw * 0.82), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const psiN = normalizeState(psiRaw);
          const uRot = su2Matrix(su2Theta, (AXES[su2AxisKey] || AXES.y).vec);
          const b0 = blochVec(psiN);
          const b1 = blochVec(applyOperator(uRot, psiN));
          const cx = W / 2, cy = H / 2 + 8, R = Math.min(W, H) * 0.36;
          const acc = accentColor();
          const proj = v => [cx + (v[1] - 0.42 * v[0]) * R, cy - (v[2] - 0.28 * v[0]) * R];

          c.strokeStyle = 'rgba(255,255,255,0.22)';
          c.lineWidth = 1.4;
          c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
          c.setLineDash([4, 4]);
          c.beginPath(); c.ellipse(cx, cy, R, R * 0.3, 0, 0, Math.PI * 2); c.stroke();
          c.setLineDash([]);

          const axes3 = [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], '|0⟩ (+z)'], [[0, 0, -1], '|1⟩ (−z)']];
          c.font = '11px var(--mono), monospace';
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.strokeStyle = 'rgba(255,255,255,0.16)';
          for (const [v, lbl] of axes3) {
            const p = proj(v);
            c.beginPath(); c.moveTo(cx, cy); c.lineTo(p[0], p[1]); c.stroke();
            c.fillText(lbl, p[0] + 4, p[1] + 4);
          }

          const drawVec = (v, col, lbl) => {
            const p = proj(v);
            c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6;
            c.beginPath(); c.moveTo(cx, cy); c.lineTo(p[0], p[1]); c.stroke();
            c.beginPath(); c.arc(p[0], p[1], 5, 0, Math.PI * 2); c.fill();
            c.font = '600 12px var(--mono), monospace';
            c.fillText(lbl, p[0] + 8, p[1] - 6);
          };
          drawVec(b0, '#60a5fa', '|ψ⟩');
          drawVec(b1, acc, 'U|ψ⟩');
        }, localClean);
      }
    } else {
      let cohCtrl = null;
      host.querySelector('[data-sl="bdim"]')?.addEventListener('input', e => {
        bosonDim = +e.target.value;
        const v = host.querySelector('[data-slv="bdim"]');
        if (v) v.textContent = `D = ${bosonDim}`;
        const out = host.querySelector('[data-boson-out]');
        if (out) {
          const b = bosonTruncated(bosonDim);
          out.innerHTML = `<div class="grp-callout" style="margin-bottom:10px">
              <span class="small">İlk ${bosonDim - 1} köşegen elemanı <b>+1</b> iken son eleman <b>${b.defectEntry}</b> çıkar: ${tex('\\operatorname{Tr}[a,a^\\dagger]=0')}. Bu yüzden ${tex('[a,a^\\dagger]=I')} yalnızca <b>sonsuz boyutlu</b> Hilbert uzayında sağlanır!</span>
            </div>
            ${renderComplexMatrix(b.comm, {
              rowLabels: Array.from({ length: bosonDim }, (_, i) => `|${i}⟩`),
              colLabels: Array.from({ length: bosonDim }, (_, i) => `|${i}⟩`),
              ariaLabel: 'Kesilmiş bozon komütatörü',
              digits: 1,
            })}`;
        }
      });
      const updateCohLive = () => {
        const coh = coherentState(alphaRe, alphaIm, 28);
        const vre = host.querySelector('[data-slv="are"]');
        const vim = host.querySelector('[data-slv="aim"]');
        if (vre) vre.textContent = alphaRe.toFixed(1);
        if (vim) vim.textContent = alphaIm.toFixed(1);
        const tag = host.querySelector('[data-coh-tag]');
        if (tag) tag.innerHTML = tex(`\\alpha = ${fmtComplex([alphaRe, alphaIm], 2)}`);
        const kpis = host.querySelector('[data-coh-kpis]');
        if (kpis) {
          kpis.innerHTML = `<div class="grp-kpi acc"><span class="grp-kpi-lbl">Ortalama ⟨N⟩</span><span class="grp-kpi-val mono">${coh.meanN.toFixed(2)}</span><span class="grp-kpi-sub">|α|² (Poisson)</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Varyans ΔN²</span><span class="grp-kpi-val mono">${coh.varN.toFixed(2)}</span><span class="grp-kpi-sub">ΔN = √⟨N⟩</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Belirsizlik ΔxΔp</span><span class="grp-kpi-val mono">0.500 ℏ</span><span class="grp-kpi-sub">Minimum sınır ✓</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Özdeğer Hatası</span><span class="grp-kpi-val mono">${coh.eigenError.toExponential(1)}</span><span class="grp-kpi-sub">D=28 kesmede</span></div>`;
        }
        cohCtrl?.render();
      };
      host.querySelector('[data-sl="are"]')?.addEventListener('input', e => { alphaRe = +e.target.value; updateCohLive(); });
      host.querySelector('[data-sl="aim"]')?.addEventListener('input', e => { alphaIm = +e.target.value; updateCohLive(); });

      const cv = host.querySelector('[data-coh-cv]');
      if (cv) {
        cohCtrl = setupCanvas(cv, cw => Math.min(260, Math.max(200, cw * 0.56)), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const coh = coherentState(alphaRe, alphaIm, 28);
          const acc = accentColor();
          const splitX = Math.floor(W * 0.58);

          // Left: Poisson bar chart
          const padL = 24, padB = 26, padT = 34, chartW = splitX - padL - 12, chartH = H - padT - padB;
          const nShow = 16;
          const maxP = Math.max(0.25, ...coh.probs.slice(0, nShow));
          const bw = chartW / nShow;

          c.strokeStyle = 'rgba(255,255,255,0.2)';
          c.beginPath(); c.moveTo(padL, padT + chartH); c.lineTo(splitX - 8, padT + chartH); c.stroke();

          for (let n = 0; n < nShow; n++) {
            const p = coh.probs[n] || 0;
            const bh = (p / maxP) * chartH;
            const x = padL + n * bw + 2;
            const y = padT + chartH - bh;
            c.fillStyle = acc;
            c.globalAlpha = 0.82;
            c.fillRect(x, y, Math.max(3, bw - 4), bh);
            c.globalAlpha = 1;
            if (n % 2 === 0 || nShow <= 10) {
              c.fillStyle = 'rgba(255,255,255,0.6)';
              c.font = '10px var(--mono), monospace';
              c.textAlign = 'center';
              c.fillText(String(n), x + (bw - 4) / 2, padT + chartH + 13);
            }
          }

          // Divider
          c.strokeStyle = 'rgba(255,255,255,0.12)';
          c.beginPath(); c.moveTo(splitX, 20); c.lineTo(splitX, H - 14); c.stroke();

          // Right: Phase space (x, p)
          const px0 = splitX + (W - splitX) / 2;
          const py0 = padT + chartH / 2;
          const sc = Math.min((W - splitX) * 0.4, chartH * 0.45) / 4.2;
          c.strokeStyle = 'rgba(255,255,255,0.2)';
          c.beginPath();
          c.moveTo(splitX + 12, py0); c.lineTo(W - 10, py0);
          c.moveTo(px0, padT); c.lineTo(px0, padT + chartH);
          c.stroke();

          const xPos = px0 + coh.meanX * sc;
          const pPos = py0 - coh.meanP * sc;
          const rad = Math.SQRT1_2 * sc; // Delta x = Delta p = 1/sqrt(2)

          // Uncertainty disk
          c.fillStyle = 'rgba(96, 165, 250, 0.24)';
          c.strokeStyle = '#60a5fa';
          c.lineWidth = 1.6;
          c.beginPath(); c.arc(xPos, pPos, Math.max(7, rad), 0, Math.PI * 2); c.fill(); c.stroke();

          // Vector from origin
          c.strokeStyle = acc; c.lineWidth = 2;
          c.beginPath(); c.moveTo(px0, py0); c.lineTo(xPos, pPos); c.stroke();
          c.fillStyle = '#fff';
          c.beginPath(); c.arc(xPos, pPos, 3.5, 0, Math.PI * 2); c.fill();

          c.fillStyle = 'rgba(255,255,255,0.65)';
          c.font = '10.5px var(--mono), monospace';
          c.textAlign = 'right';
          c.fillText('x', W - 12, py0 - 5);
          c.textAlign = 'left';
          c.fillText('p', px0 + 5, padT + 10);
        }, localClean);
      }
    }

    syncSegments(host, true);
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}

// =====================================================================
// TAB 2: 3B HARMONİK OSİLATÖR & SU(3) DEJENERELİĞİ (§5.5.1, §6.7.1)
// =====================================================================
export function mountHarmonicSU3(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let N = 3;
  let pickedStateIdx = 0;
  let subClean = null;

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    const sh = oscillatorShell(N);
    if (pickedStateIdx >= sh.states.length) pickedStateIdx = 0;
    const st = sh.states[pickedStateIdx];

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <span class="small mute">Kabuk kuantum sayısı N:</span>
            ${[0, 1, 2, 3, 4, 5, 6].map(k => `<button type="button" class="grp-chip ${k === N ? 'on' : ''}" data-n="${k}">N = ${k}</button>`).join('')}
          </div>
          <div class="grp-toolbar-g">
            <button type="button" class="btn small ghost" data-jump="su3-lab">${icon('matrix')} SU(3) Lab →</button>
            <button type="button" class="btn small ghost" data-jump="agirlik-diyagram">${icon('atom')} Ağırlık Diyagramları →</button>
          </div>
        </div>

        <div class="phy-slider-row">
          <span>Kabuk N (0..8)</span>
          <input type="range" class="phy-range" min="0" max="8" step="1" value="${N}" data-nsl aria-label="Harmonik osilatör kabuk sayısı N">
          <span class="mono">N = ${N}</span>
        </div>

        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">Enerji E_N</span><span class="grp-kpi-val">${tex(`\\frac{${2 * N + 3}}{2}\\hbar\\omega`)}</span><span class="grp-kpi-sub">(${(N + 1.5).toFixed(1)} ℏω)</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">SU(3) Temsili</span><span class="grp-kpi-val">${tex(`(${N}, 0)`)}</span><span class="grp-kpi-sub">boyut = ${sh.su3Dim}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Dejenerelik</span><span class="grp-kpi-val mono">${sh.degeneracy}</span><span class="grp-kpi-sub">(N+1)(N+2)/2</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">SO(3) Toplamı</span><span class="grp-kpi-val mono">${sh.so3Sum} ${sh.matchesDegeneracy ? '✓' : '✗'}</span><span class="grp-kpi-sub">Parite: ${sh.parity > 0 ? '+1 (çift)' : '−1 (tek)'}</span></div>
        </div>

        <div class="grp-callout">
          <div>
            <b>${tex(`SU(3) \\supset SO(3)`)} Dallanması:</b>
            ${tex(`(${N}, 0) \\longrightarrow ${sh.lValues.map(l => `\\mathbf{${2 * l + 1}}_{(l=${l})}`).join(' \\oplus ')}`)}
          </div>
          <span class="grp-pill ok">${sh.lValues.map(l => 2 * l + 1).join(' + ')} = ${sh.degeneracy} ✓</span>
        </div>
      </div>

      <div class="phy-grid-2">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">SU(3) (${N}, 0) Ağırlık Üçgeni (T₃, Y)</h3>
            <span class="mute small">Durumu incelemek için düğüme dokun</span>
          </div>
          <div class="phy-cv-box">
            <canvas class="phy-cv" data-tri-cv aria-label="SU(3) harmonik osilatör ağırlık üçgeni"></canvas>
            <div class="phy-cv-tag">${sh.states.length} durum · |nₓ, nᵧ, n_z⟩</div>
          </div>
          <div class="grp-callout" data-st-info>
            <span>Seçili durum: ${tex(`|${st.nx}, ${st.ny}, ${st.nz}\\rangle`)}</span>
            <span class="grp-pill acc">${tex(`T_3 = ${fmtHalfIntTex(st.t3)},\\; Y = ${fmtNum(st.y, 3)}`)}</span>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Enerji Merdiveni & SO(3) l-İçeriği (N = 0..6)</h3>
            <span class="grp-pill">E = (N + 3/2)ℏω</span>
          </div>
          <div class="phy-cv-box">
            <canvas class="phy-cv" data-lad-cv aria-label="3B harmonik osilatör enerji merdiveni"></canvas>
            <div class="phy-cv-tag">Yatay: l değeri · Dikey: E_N</div>
          </div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="N=0..6 harmonik osilatör dejenerelik tablosu">
              <thead><tr><th>N</th><th>E_N</th><th>SU(3)</th><th>l içeriği</th><th>Σ(2l+1)</th></tr></thead>
              <tbody>
                ${Array.from({ length: 7 }, (_, k) => {
                  const row = oscillatorShell(k);
                  return `<tr class="${k === N ? 'on' : ''}" data-n="${k}">
                    <td class="mono"><b>${k}</b></td>
                    <td class="mono">${2 * k + 3}/2 ℏω</td>
                    <td class="mono">(${k},0) = <b>${row.degeneracy}</b></td>
                    <td class="mono">${row.lValues.join(', ')}</td>
                    <td class="mono">${row.so3Sum} ✓</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-n]').forEach(el => {
      el.onclick = () => { N = +el.dataset.n; pickedStateIdx = 0; render(); };
    });
    const nSl = host.querySelector('[data-nsl]');
    if (nSl) {
      nSl.addEventListener('input', e => {
        const lbl = nSl.parentElement?.querySelector('.mono');
        if (lbl) lbl.textContent = `N = ${+e.target.value}`;
      });
      nSl.addEventListener('change', e => {
        N = +e.target.value;
        pickedStateIdx = 0;
        render();
      });
    }
    host.querySelectorAll('[data-jump]').forEach(b => {
      b.onclick = () => ctx?.jumpTo?.(b.dataset.jump);
    });

    // Weight triangle canvas with hit-testing
    const triCv = host.querySelector('[data-tri-cv]');
    if (triCv) {
      let pts = [];
      const cvCtrl = setupCanvas(triCv, cw => Math.min(340, Math.max(240, cw * 0.82)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const acc = accentColor();
        const cx = W / 2, cy = H / 2 + 16;
        const span = Math.max(1, N);
        const scale = Math.min(W * 0.72, H * 0.72) / (span + 0.8);

        // Axes
        c.strokeStyle = 'rgba(255,255,255,0.12)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(20, cy); c.lineTo(W - 20, cy);
        c.moveTo(cx, 26); c.lineTo(cx, H - 16);
        c.stroke();

        // Compute screen positions
        pts = sh.states.map((s, idx) => {
          const sx = cx + s.t3 * scale;
          const sy = cy - s.y * (Math.sqrt(3) / 2) * scale;
          return { sx, sy, s, idx };
        });

        // Triangle outline for N >= 1
        if (N >= 1) {
          const topLeft = pts.find(p => p.s.nx === 0 && p.s.ny === N);
          const topRight = pts.find(p => p.s.nx === N && p.s.ny === 0);
          const bot = pts.find(p => p.s.nz === N);
          if (topLeft && topRight && bot) {
            c.strokeStyle = 'rgba(255,255,255,0.22)';
            c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(topLeft.sx, topLeft.sy);
            c.lineTo(topRight.sx, topRight.sy);
            c.lineTo(bot.sx, bot.sy);
            c.closePath();
            c.stroke();
          }
        }

        // Draw weight dots
        const rDot = N <= 3 ? 11 : N <= 5 ? 8 : 6;
        for (const p of pts) {
          const active = p.idx === pickedStateIdx;
          c.fillStyle = active ? acc : '#12121a';
          c.strokeStyle = active ? '#fff' : 'rgba(255,255,255,0.75)';
          c.lineWidth = active ? 2.4 : 1.5;
          c.beginPath(); c.arc(p.sx, p.sy, active ? rDot + 2 : rDot, 0, Math.PI * 2); c.fill(); c.stroke();
          if (N <= 4) {
            c.fillStyle = active ? '#000' : '#f4f4f5';
            c.font = `600 ${N <= 2 ? 10 : 8.5}px var(--mono), monospace`;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(`${p.s.nx}${p.s.ny}${p.s.nz}`, p.sx, p.sy);
          }
        }
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.font = '11px var(--mono), monospace';
        c.textAlign = 'right';
        c.fillText('T₃ →', W - 14, cy - 6);
        c.textAlign = 'left';
        c.fillText('Y ↑', cx + 6, 36);
      }, localClean);

      const onPick = e => {
        const rect = triCv.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        let best = -1, bestD = 26;
        for (const p of pts) {
          const d = Math.hypot(p.sx - x, p.sy - y);
          if (d < bestD) { bestD = d; best = p.idx; }
        }
        if (best >= 0) {
          pickedStateIdx = best;
          const s = sh.states[best];
          const box = host.querySelector('[data-st-info]');
          if (box) {
            box.innerHTML = `<span>Seçili durum: ${tex(`|${s.nx}, ${s.ny}, ${s.nz}\\rangle`)}</span>
              <span class="grp-pill acc">${tex(`T_3 = ${fmtHalfIntTex(s.t3)},\\; Y = ${fmtNum(s.y, 3)}`)}</span>`;
          }
          cvCtrl.render();
        }
      };
      triCv.addEventListener('pointerdown', onPick);
      localClean.add(() => triCv.removeEventListener('pointerdown', onPick));
    }

    // Energy ladder canvas
    const ladCv = host.querySelector('[data-lad-cv]');
    if (ladCv) {
      setupCanvas(ladCv, cw => Math.min(250, Math.max(195, cw * 0.56)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const acc = accentColor();
        const padL = 48, padR = 16, padT = 32, padB = 26;
        const maxN = 6;
        const colW = (W - padL - padR) / (maxN + 1);
        const rowH = (H - padT - padB) / (maxN + 1);
        const lLabels = ['s', 'p', 'd', 'f', 'g', 'h', 'i'];

        for (let k = 0; k <= maxN; k++) {
          const y = H - padB - k * rowH;
          const isCur = k === N;
          c.fillStyle = isCur ? acc : 'rgba(255,255,255,0.55)';
          c.font = `${isCur ? '700 ' : ''}11px var(--mono), monospace`;
          c.textAlign = 'right';
          c.textBaseline = 'middle';
          c.fillText(`N=${k}`, padL - 8, y);

          const row = oscillatorShell(k);
          for (const l of row.lValues) {
            const x = padL + l * colW + 4;
            const bw = Math.max(18, colW - 10);
            c.strokeStyle = isCur ? acc : 'rgba(255,255,255,0.45)';
            c.lineWidth = isCur ? 3.2 : 2;
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + bw, y); c.stroke();
            c.fillStyle = isCur ? '#fff' : 'rgba(255,255,255,0.55)';
            c.font = '9.5px var(--mono), monospace';
            c.textAlign = 'center';
            c.fillText(`${2 * l + 1}`, x + bw / 2, y - 9);
          }
        }
        for (let l = 0; l <= maxN; l++) {
          const x = padL + l * colW + colW / 2;
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.font = '10.5px var(--mono), monospace';
          c.textAlign = 'center';
          c.fillText(`l=${l}(${lLabels[l]})`, x, H - 10);
        }
      }, localClean);
    }
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}

// =====================================================================
// TAB 3: BOHR ATOMU & GİZLİ SO(4) SİMETRİSİ (§5.5.2)
// =====================================================================
export function mountBohrSO4(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let selN = 3;
  let nUpper = 3;
  let nLower = 2;
  let ecc = 0.62;
  let playing = true;
  let phase = 0;
  let subClean = null;

  const allSpectralLines = [
    ...bohrSeries(1, 6),
    ...bohrSeries(2, 6),
    ...bohrSeries(3, 6),
  ];

  const wlToPct = nm => {
    // Log scale from 85 nm (Lyman limit) to 2100 nm (Paschen)
    const lo = Math.log(85), hi = Math.log(2100);
    return Math.max(2, Math.min(98, ((Math.log(nm) - lo) / (hi - lo)) * 100));
  };

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    const lvl = bohrLevel(selN);
    const tr = bohrTransition(nUpper, nLower);
    const jStr = fmtHalfIntTex(lvl.so4Irrep[0]);
    const subLetters = ['s', 'p', 'd', 'f', 'g', 'h', 'i'];

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-panel">
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <span class="small mute">Baş kuantum sayısı n:</span>
            ${[1, 2, 3, 4, 5, 6, 7].map(k => `<button type="button" class="grp-chip ${k === selN ? 'on' : ''}" data-bn="${k}">n = ${k}</button>`).join('')}
          </div>
          <div class="grp-toolbar-g">
            <button type="button" class="grp-chip ${nLower === 1 ? 'on' : ''}" data-ser="2:1">Lyman-α</button>
            <button type="button" class="grp-chip ${nLower === 2 && nUpper === 3 ? 'on' : ''}" data-ser="3:2">Balmer-α</button>
            <button type="button" class="grp-chip ${nLower === 2 && nUpper === 4 ? 'on' : ''}" data-ser="4:2">Balmer-β</button>
            <button type="button" class="grp-chip ${nLower === 3 ? 'on' : ''}" data-ser="4:3">Paschen-α</button>
          </div>
        </div>

        <div class="grp-kpis">
          <div class="grp-kpi acc"><span class="grp-kpi-lbl">Enerji E_${selN}</span><span class="grp-kpi-val mono">${lvl.energyEv.toFixed(3)} eV</span><span class="grp-kpi-sub">−${BOHR_E1_EV.toFixed(2)} / ${selN}²</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">SO(4) Temsili</span><span class="grp-kpi-val">${tex(`(${jStr},\\, ${jStr})`)}</span><span class="grp-kpi-sub">SU(2)_+ × SU(2)_−</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Dejenerelik n²</span><span class="grp-kpi-val mono">${lvl.degeneracy} ${lvl.matchesDegeneracy ? '✓' : ''}</span><span class="grp-kpi-sub">Spin dahil: ${lvl.withSpinDegeneracy}</span></div>
          <div class="grp-kpi"><span class="grp-kpi-lbl">Geçiş ${tr.label}</span><span class="grp-kpi-val mono">${tr.wavelengthNm.toFixed(1)} nm</span><span class="grp-kpi-sub">${tr.deltaEv.toFixed(3)} eV · ${tr.region}</span></div>
        </div>

        <div>
          <div class="small mute" style="margin-bottom:6px">Hidrojen Spektrum Çubuğu (Lyman UV · Balmer Görünür · Paschen IR) — çizgiye dokun:</div>
          <div class="phy-spec-bar" role="group" aria-label="Hidrojen spektral çizgileri">
            ${allSpectralLines.map(line => {
              const on = line.nUpper === nUpper && line.nLower === nLower;
              return `<button type="button" class="phy-spec-line ${on ? 'on' : ''}" data-ser="${line.nUpper}:${line.nLower}" style="left:${wlToPct(line.wavelengthNm).toFixed(1)}%;background:${line.visibleRgb};color:${line.visibleRgb}" title="${esc(`${line.label}: ${line.wavelengthNm.toFixed(1)} nm (${line.deltaEv.toFixed(2)} eV)`)}" aria-label="${esc(`${line.label}, ${line.wavelengthNm.toFixed(0)} nanometre`)}"></button>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="phy-side">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Enerji Düzeyleri & Foton Geçişi</h3>
            <div class="grp-toolbar-g">
              <select class="inp grp-sel" data-nu aria-label="Üst enerji seviyesi">
                ${[2, 3, 4, 5, 6, 7].map(u => `<option value="${u}" ${u === nUpper ? 'selected' : ''}>n_üst = ${u}</option>`).join('')}
              </select>
              <span class="mono mute">→</span>
              <select class="inp grp-sel" data-nl aria-label="Alt enerji seviyesi">
                ${[1, 2, 3, 4, 5].filter(l => l < nUpper).map(l => `<option value="${l}" ${l === nLower ? 'selected' : ''}>n_alt = ${l}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="phy-cv-box">
            <canvas class="phy-cv" data-bohr-cv aria-label="Bohr atomu enerji seviyeleri ve geçiş diyagramı"></canvas>
            <div class="phy-cv-tag">${esc(tr.label)} · ${tr.wavelengthNm.toFixed(1)} nm</div>
          </div>
          <div class="grp-callout">
            <span class="small">${tex(`n=${selN}`)} alt kabukları: ${lvl.lValues.map(l => `${selN}${subLetters[l] || l} (${2 * l + 1})`).join(' + ')} = <b>${lvl.so3Sum} = ${selN}²</b> ✓</span>
            <span class="grp-pill acc">${tex(`\\vec{L}^2 + \\vec{K}^2 = ${lvl.casimirC}`)}</span>
          </div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Bohr atomu n=1..6 SO(4) dejenerelik tablosu">
              <thead><tr><th>n</th><th>E_n (eV)</th><th>SO(4) (j, j)</th><th>l = 0..n−1</th><th>n² (2n²)</th></tr></thead>
              <tbody>
                ${[1, 2, 3, 4, 5, 6].map(k => {
                  const lv = bohrLevel(k);
                  const jt = fmtHalfIntTex(lv.so4Irrep[0]);
                  return `<tr class="${k === selN ? 'on' : ''}" data-bn="${k}">
                    <td class="mono"><b>${k}</b></td>
                    <td class="mono">${lv.energyEv.toFixed(3)}</td>
                    <td>${tex(`(${jt},\\,${jt})`)}</td>
                    <td class="mono">${lv.lValues.join(', ')}</td>
                    <td class="mono"><b>${lv.degeneracy}</b> (${lv.withSpinDegeneracy})</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Runge–Lenz Vektörü & Kepler Yörüngesi</h3>
            <button type="button" class="btn small ghost" data-play aria-label="Yörünge animasyonunu oynat veya duraklat">${icon(playing ? 'pause' : 'play')} ${playing ? 'Duraklat' : 'Oynat'}</button>
          </div>
          <div class="phy-cv-box">
            <canvas class="phy-cv" data-rl-cv aria-label="Runge-Lenz vektörü ve kapalı Kepler elipsi"></canvas>
            <div class="phy-cv-tag">Kırmızı ok: Korunan Runge–Lenz Ā</div>
          </div>
          <div class="phy-slider-row">
            <span>Dışmerkezlik e</span>
            <input type="range" class="phy-range" min="0" max="0.82" step="0.02" value="${ecc}" data-ecc aria-label="Kepler yörünge dışmerkezliği">
            <span class="mono">e = ${ecc.toFixed(2)}</span>
          </div>
          <div class="grp-math-box">${tex(`\\vec{J}_\\pm = \\frac{1}{2}(\\vec{L} \\pm \\vec{K}),\\quad \\vec{L}\\cdot\\vec{K} = 0`)}</div>
          <p class="small mute">1/r potansiyelinde elipsin dönmemesi Runge–Lenz vektörü ${tex('\\vec{A}')}’nın korunumudur; kuantumda bu gizli ${tex('SO(4)')} simetrisini ve ${tex('n^2')} dejenereliğini doğurur.</p>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-bn]').forEach(b => {
      b.onclick = () => { selN = +b.dataset.bn; render(); };
    });
    host.querySelectorAll('[data-ser]').forEach(b => {
      b.onclick = () => {
        const [u, l] = b.dataset.ser.split(':').map(Number);
        nUpper = u; nLower = l; selN = u;
        render();
      };
    });
    host.querySelector('[data-nu]')?.addEventListener('change', e => {
      nUpper = +e.target.value;
      if (nLower >= nUpper) nLower = nUpper - 1;
      selN = nUpper;
      render();
    });
    host.querySelector('[data-nl]')?.addEventListener('change', e => {
      nLower = +e.target.value;
      render();
    });
    host.querySelector('[data-ecc]')?.addEventListener('input', e => {
      ecc = +e.target.value;
      rlCtrl?.render();
      const lbl = host.querySelector('[data-ecc]')?.parentElement?.querySelector('.mono');
      if (lbl) lbl.textContent = `e = ${ecc.toFixed(2)}`;
    });
    host.querySelector('[data-play]')?.addEventListener('click', () => {
      playing = !playing;
      if (playing && full()) loop?.start(); else loop?.stop();
      render();
    });

    // Energy levels canvas
    const bohrCv = host.querySelector('[data-bohr-cv]');
    if (bohrCv) {
      setupCanvas(bohrCv, cw => Math.min(280, Math.max(210, cw * 0.62)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const acc = accentColor();
        const padL = 56, padR = 78, padT = 30, padB = 22;
        const mapY = ev => {
          // Non-linear compressed energy axis so n=1..6 are all legible
          const frac = Math.pow(Math.abs(ev) / BOHR_E1_EV, 0.48);
          return padT + frac * (H - padT - padB);
        };
        // Ionization limit E = 0
        c.strokeStyle = 'rgba(255,255,255,0.22)';
        c.setLineDash([4, 4]);
        c.beginPath(); c.moveTo(padL, padT); c.lineTo(W - padR, padT); c.stroke();
        c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.font = '10.5px var(--mono), monospace';
        c.textAlign = 'left';
        c.fillText('E = 0 eV (iyonizasyon)', padL + 4, padT - 8);

        for (let k = 1; k <= 6; k++) {
          const lv = bohrLevel(k);
          const y = mapY(lv.energyEv);
          const hi = k === selN || k === nUpper || k === nLower;
          c.strokeStyle = k === selN ? acc : hi ? '#fff' : 'rgba(255,255,255,0.34)';
          c.lineWidth = k === selN ? 2.6 : 1.5;
          c.beginPath(); c.moveTo(padL, y); c.lineTo(W - padR, y); c.stroke();

          c.fillStyle = hi ? '#f4f4f5' : 'rgba(255,255,255,0.55)';
          c.font = `${hi ? '600 ' : ''}11px var(--mono), monospace`;
          c.textAlign = 'right';
          c.textBaseline = 'middle';
          c.fillText(`n=${k}`, padL - 8, y);
          c.textAlign = 'left';
          c.fillText(`${lv.energyEv.toFixed(2)} eV (${k * k})`, W - padR + 6, y);
        }

        // Transition arrow
        const yU = mapY(bohrLevel(nUpper).energyEv);
        const yL = mapY(bohrLevel(nLower).energyEv);
        const ax = padL + (W - padL - padR) * 0.45;
        c.strokeStyle = tr.visibleRgb;
        c.fillStyle = tr.visibleRgb;
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(ax, yU); c.lineTo(ax, yL - 6); c.stroke();
        c.beginPath();
        c.moveTo(ax, yL); c.lineTo(ax - 6, yL - 10); c.lineTo(ax + 6, yL - 10); c.closePath();
        c.fill();

        // Wavy photon arrow
        const ym = (yU + yL) / 2;
        c.lineWidth = 1.8;
        c.beginPath();
        for (let dx = 0; dx <= 46; dx += 2) {
          const wx = ax + 10 + dx;
          const wy = ym + Math.sin(dx * 0.45) * 4;
          if (dx === 0) c.moveTo(wx, wy); else c.lineTo(wx, wy);
        }
        c.stroke();
        c.font = '600 11px var(--mono), monospace';
        c.textAlign = 'left';
        c.fillText(`γ ${tr.wavelengthNm.toFixed(0)} nm`, ax + 60, ym + 3);
      }, localClean);
    }

    // Runge-Lenz Kepler ellipse canvas
    let rlCtrl = null;
    let loop = null;
    const rlCv = host.querySelector('[data-rl-cv]');
    if (rlCv) {
      rlCtrl = setupCanvas(rlCv, cw => Math.min(230, Math.max(185, cw * 0.65)), (c, W, H) => {
        c.clearRect(0, 0, W, H);
        const acc = accentColor();
        const a = Math.min(W, H) * 0.36;
        const b = a * Math.sqrt(Math.max(0.05, 1 - ecc * ecc));
        const f = a * ecc;
        const cx = W / 2 - f * 0.35;
        const cy = H / 2 + 8;
        const fx = cx + f; // focus (nucleus)

        // Ellipse
        c.strokeStyle = 'rgba(255,255,255,0.34)';
        c.lineWidth = 1.6;
        c.beginPath(); c.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2); c.stroke();

        // Nucleus at focus
        c.fillStyle = '#fbbf24';
        c.beginPath(); c.arc(fx, cy, 5.5, 0, Math.PI * 2); c.fill();

        // Conserved Runge-Lenz vector from focus toward perihelion (+x)
        const rlLen = Math.max(16, a * ecc * 1.15);
        c.strokeStyle = '#fb7185';
        c.fillStyle = '#fb7185';
        c.lineWidth = 2.6;
        c.beginPath(); c.moveTo(fx, cy); c.lineTo(fx + rlLen, cy); c.stroke();
        c.beginPath();
        c.moveTo(fx + rlLen + 7, cy); c.lineTo(fx + rlLen - 3, cy - 4.5); c.lineTo(fx + rlLen - 3, cy + 4.5);
        c.closePath(); c.fill();

        // Orbiting electron (Kepler-ish speed: faster near perihelion)
        const ex = cx + a * Math.cos(phase);
        const ey = cy + b * Math.sin(phase);
        c.strokeStyle = 'rgba(96,165,250,0.4)';
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(fx, cy); c.lineTo(ex, ey); c.stroke();
        c.fillStyle = acc;
        c.beginPath(); c.arc(ex, ey, 5, 0, Math.PI * 2); c.fill();
      }, localClean);

      loop = createAnimLoop((_now, dt) => {
        if (!playing || !full()) return false;
        // Faster near perihelion (cos(phase) ~ +1)
        const speed = 1.4 / Math.max(0.25, 1 - ecc * Math.cos(phase));
        phase = (phase + dt * speed * 0.75) % (Math.PI * 2);
        rlCtrl.render();
        return true;
      }, localClean);
      if (playing && full()) loop.start();
    }
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}

// =====================================================================
// TAB 4: İZOSPİN & ÇEKİRDEK MODELLERİ (ELLIOTT, SAKATA) (§5.5.3, §6.7.2–3)
// =====================================================================
export function mountIsospinModels(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'isospin'; // 'isospin' | 'elliott' | 'sakata'
  let I1 = 0.5;
  let I2 = 0.5;
  let lam = 8;
  let mu = 4;
  let subClean = null;

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    let bodyHtml = '';

    if (mode === 'isospin') {
      const cpl = coupleIsospin(I1, I2);
      bodyHtml = `<div class="phy-stage">
        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head"><h3 class="grp-panel-title">Nükleon İkilisi (I = 1/2)</h3><span class="grp-pill acc">SU(2)_I</span></div>
            <div class="phy-scroll">
              <table class="grp-tbl" aria-label="Nükleon izospin ikilisi">
                <thead><tr><th>Parçacık</th><th>I₃</th><th>Q</th><th>Kütle (MeV)</th><th>Kuark</th></tr></thead>
                <tbody>${NUCLEONS.map(n => `<tr><td><b>${esc(n.symbol)}</b> (${esc(n.name)})</td><td class="mono">${fmtHalfInt(n.I3)}</td><td class="mono">${n.Q}</td><td class="mono">${n.massMeV}</td><td class="mono">${esc(n.quarks)}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head"><h3 class="grp-panel-title">Pion Üçlüsü (I = 1)</h3><span class="grp-pill acc">Eklenik 3</span></div>
            <div class="phy-scroll">
              <table class="grp-tbl" aria-label="Pion izospin üçlüsü">
                <thead><tr><th>Mezon</th><th>I₃</th><th>Q</th><th>Kütle (MeV)</th><th>Kuark</th></tr></thead>
                <tbody>${PIONS.map(p => `<tr><td>${tex(p.tex)}</td><td class="mono">${p.I3 > 0 ? '+1' : p.I3}</td><td class="mono">${p.Q > 0 ? '+1' : p.Q}</td><td class="mono">${p.massMeV}</td><td>${tex(p.quarks)}</td></tr>`).join('')}</tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">İzospin Bileşimi & Clebsch–Gordan Katsayıları</h3>
            <div class="grp-toolbar-g">
              <select class="inp grp-sel" data-i1 aria-label="Birinci izospin I1">
                ${[0.5, 1, 1.5].map(v => `<option value="${v}" ${v === I1 ? 'selected' : ''}>I₁ = ${fmtHalfInt(v)}</option>`).join('')}
              </select>
              <span class="mono">⊗</span>
              <select class="inp grp-sel" data-i2 aria-label="İkinci izospin I2">
                ${[0.5, 1, 1.5].map(v => `<option value="${v}" ${v === I2 ? 'selected' : ''}>I₂ = ${fmtHalfInt(v)}</option>`).join('')}
              </select>
              <button type="button" class="btn small ghost" data-jump="su2-lab">${icon('rotate')} SU(2) CG Lab →</button>
            </div>
          </div>
          <div class="grp-math-box">${tex(`\\mathbf{${Math.round(2 * I1 + 1)}} \\otimes \\mathbf{${Math.round(2 * I2 + 1)}} = ${cpl.irreps.map(ir => `\\mathbf{${ir.dim}}_{(I=${fmtHalfIntTex(ir.J)})}`).join(' \\oplus ')}`)}</div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Clebsch-Gordan izospin açılımı">
              <thead><tr><th>|I, I₃⟩</th><th>Simetri</th><th>Clebsch–Gordan Açılımı</th></tr></thead>
              <tbody>
                ${cpl.irreps.flatMap(ir => ir.states.map(st => {
                  const expr = st.terms.map((t, k) => {
                    const sgn = t.cg < 0 ? ' - ' : (k > 0 ? ' + ' : '');
                    const mag = Math.abs(t.cg);
                    const coef = Math.abs(mag - 1) < 1e-6 ? ''
                      : Math.abs(mag - Math.SQRT1_2) < 1e-6 ? '\\frac{1}{\\sqrt{2}}'
                      : Math.abs(mag - Math.sqrt(1 / 3)) < 1e-6 ? '\\frac{1}{\\sqrt{3}}'
                      : Math.abs(mag - Math.sqrt(2 / 3)) < 1e-6 ? '\\sqrt{\\frac{2}{3}}'
                      : mag.toFixed(3);
                    return `${sgn}${coef}|${fmtHalfIntTex(t.m1)},\\,${fmtHalfIntTex(t.m2)}\\rangle`;
                  }).join('');
                  return `<tr>
                    <td class="mono">${tex(`|${fmtHalfIntTex(st.J)},\\,${fmtHalfIntTex(st.M)}\\rangle`)}</td>
                    <td>${ir.symmetry ? `<span class="grp-pill ${ir.symmetry === 'Antisimetrik' ? 'acc' : ''}">${esc(ir.symmetry)}</span>` : '—'}</td>
                    <td>${tex(expr)}</td>
                  </tr>`;
                })).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head"><h3 class="grp-panel-title">İki Nükleon Sistemi & Döteron (I = 0)</h3><span class="grp-pill ok">Genelleştirilmiş Pauli İlkesi</span></div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="İki nükleon bağlanma durumları">
              <thead><tr><th>Sistem</th><th>I (I₃)</th><th>Spin S</th><th>L</th><th>Bağlı?</th><th>Açıklama</th></tr></thead>
              <tbody>
                ${TWO_NUCLEON_STATES.map(s => `<tr class="${s.bound ? 'on' : ''}">
                  <td><b>${esc(s.name)}</b></td>
                  <td class="mono">${s.I} (${s.I3 > 0 ? '+1' : s.I3}) · ${esc(s.isospinSym)}</td>
                  <td class="mono">${s.S} · ${esc(s.spinSym)}</td>
                  <td class="mono">${esc(s.L)}</td>
                  <td><span class="grp-pill ${s.bound ? 'ok' : 'bad'}">${s.bound ? 'Bağlı ✓' : 'Bağsız ✗'}</span></td>
                  <td class="small mute">${esc(s.note)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    } else if (mode === 'elliott') {
      const eb = elliottBranching(lam, mu);
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Elliott SU(3) Çekirdek Modeli (sd-Kabuğu, §6.7.2)</h3>
            <span class="grp-pill acc">${tex(`(\\lambda,\\mu)=(${lam},${mu})`)}</span>
          </div>
          <div class="grp-elems">
            ${ELLIOTT_SD_NUCLEI.map(nuc => `<button type="button" class="grp-chip ${nuc.lam === lam && nuc.mu === mu ? 'on' : ''}" data-nuc="${nuc.lam}:${nuc.mu}">${esc(nuc.nucleus)} (${nuc.lam},${nuc.mu})</button>`).join('')}
          </div>
          <div class="phy-grid-2">
            <div class="phy-slider-row">
              <span>${tex('\\lambda')}</span>
              <input type="range" class="phy-range" min="0" max="12" step="1" value="${lam}" data-el="lam" aria-label="Elliott lambda parametresi">
              <span class="mono">${lam}</span>
            </div>
            <div class="phy-slider-row">
              <span>${tex('\\mu')}</span>
              <input type="range" class="phy-range" min="0" max="12" step="1" value="${mu}" data-el="mu" aria-label="Elliott mu parametresi">
              <span class="mono">${mu}</span>
            </div>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">SU(3) Boyutu</span><span class="grp-kpi-val mono">${eb.dim}</span><span class="grp-kpi-sub">½(λ+1)(μ+1)(λ+μ+2)</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Casimir C₂</span><span class="grp-kpi-val mono">${eb.casimir}</span><span class="grp-kpi-sub">λ²+μ²+λμ+3(λ+μ)</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Dönme Bantları</span><span class="grp-kpi-val mono">${eb.bands.length}</span><span class="grp-kpi-sub">K = ${eb.bands.map(b => b.K).join(', ')}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">SO(3) Kontrol</span><span class="grp-kpi-val mono">${eb.totalStates} ${eb.matchesDim ? '✓' : '✗'}</span><span class="grp-kpi-sub">Σ(2L+1) = dim</span></div>
          </div>
        </div>

        <div class="phy-side">
          <div class="grp-panel">
            <div class="grp-panel-head"><h3 class="grp-panel-title">Dönme Bantları Spektrumu E(L) ∝ L(L+1)</h3><span class="grp-pill">K-Bantları</span></div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-ell-cv aria-label="Elliott SU(3) çekirdek dönme bantları grafiği"></canvas>
              <div class="phy-cv-tag">Her sütun bir K-bandı · Yükseklik ∝ L(L+1)</div>
            </div>
            <div class="grp-elems">
              ${eb.bands.map(b => `<span class="grp-pill"><b>K=${b.K}</b>: L = ${b.LValues.join(', ')} (${b.bandDim})</span>`).join('')}
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head"><h3 class="grp-panel-title">sd-Kabuğu Çekirdekleri</h3></div>
            <div class="phy-scroll">
              <table class="grp-tbl" aria-label="sd-kabuğu Elliott çekirdekleri">
                <thead><tr><th>Çekirdek</th><th>(λ,μ)</th><th>Biçim</th></tr></thead>
                <tbody>
                  ${ELLIOTT_SD_NUCLEI.map(nuc => `<tr class="${nuc.lam === lam && nuc.mu === mu ? 'on' : ''}" data-nuc="${nuc.lam}:${nuc.mu}">
                    <td><b>${esc(nuc.nucleus)}</b></td>
                    <td class="mono">(${nuc.lam}, ${nuc.mu})</td>
                    <td class="small mute">${esc(nuc.shape)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            ${(() => {
              const hit = ELLIOTT_SD_NUCLEI.find(x => x.lam === lam && x.mu === mu);
              return hit ? `<div class="grp-callout"><span class="small">${esc(hit.note)}</span></div>` : '';
            })()}
          </div>
        </div>
      </div>`;
    } else {
      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Sakata Modeli Temel Üçlüsü (p, n, Λ) — §6.7.3</h3>
            <div class="grp-toolbar-g">
              <button type="button" class="btn small ghost" data-jump="sekizli-yol">${icon('sparkle')} Sekizli Yol →</button>
              <button type="button" class="btn small ghost" data-jump="renk-kuark">${icon('atom')} Renk & Kuark →</button>
            </div>
          </div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Sakata modeli temel üçlüsü">
              <thead><tr><th>Parçacık</th><th>Ad</th><th>Q</th><th>I₃</th><th>Gariplik S</th><th>Baryon B</th><th>Hiperyük Y</th></tr></thead>
              <tbody>
                ${SAKATA_TRIPLET.map(s => `<tr>
                  <td class="mono"><b>${esc(s.symbol)}</b></td>
                  <td>${esc(s.name)}</td>
                  <td class="mono">${s.Q > 0 ? '+1' : s.Q}</td>
                  <td class="mono">${fmtHalfInt(s.I3)}</td>
                  <td class="mono">${s.S}</td>
                  <td class="mono">+${s.B}</td>
                  <td class="mono">${s.Y}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Mezonlar (Sakata = Başarılı)</h3>
              <span class="grp-pill ok">${esc(SAKATA_DECOMPOSITIONS.mesons.verdict)} ✓</span>
            </div>
            <div class="grp-math-box">${tex(SAKATA_DECOMPOSITIONS.mesons.formula, true)}</div>
            <p class="small mute">${esc(SAKATA_DECOMPOSITIONS.mesons.detail)}</p>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Baryonlar (Sakata = Başarısız)</h3>
              <span class="grp-pill bad">${esc(SAKATA_DECOMPOSITIONS.baryons.verdict)} ✗</span>
            </div>
            <div class="grp-math-box">${tex(SAKATA_DECOMPOSITIONS.baryons.formula, true)}</div>
            <p class="small mute">${esc(SAKATA_DECOMPOSITIONS.baryons.detail)}</p>
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-iso-mode role="tablist" aria-label="İzospin ve çekirdek modeli seçimi">
          <button type="button" data-m="isospin" class="${mode === 'isospin' ? 'on' : ''}">İzospin & CG (§5.5.3)</button>
          <button type="button" data-m="elliott" class="${mode === 'elliott' ? 'on' : ''}">Elliott SU(3) (§6.7.2)</button>
          <button type="button" data-m="sakata" class="${mode === 'sakata' ? 'on' : ''}">Sakata Modeli (§6.7.3)</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-iso-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });
    host.querySelectorAll('[data-jump]').forEach(b => { b.onclick = () => ctx?.jumpTo?.(b.dataset.jump); });

    if (mode === 'isospin') {
      host.querySelector('[data-i1]')?.addEventListener('change', e => { I1 = +e.target.value; render(); });
      host.querySelector('[data-i2]')?.addEventListener('change', e => { I2 = +e.target.value; render(); });
    } else if (mode === 'elliott') {
      host.querySelectorAll('[data-nuc]').forEach(el => {
        el.onclick = () => {
          const [a, b] = el.dataset.nuc.split(':').map(Number);
          lam = a; mu = b; render();
        };
      });
      const lamSl = host.querySelector('[data-el="lam"]');
      const muSl = host.querySelector('[data-el="mu"]');
      if (lamSl) {
        lamSl.addEventListener('input', e => {
          const lbl = lamSl.parentElement?.querySelector('.mono');
          if (lbl) lbl.textContent = String(+e.target.value);
        });
        lamSl.addEventListener('change', e => { lam = +e.target.value; render(); });
      }
      if (muSl) {
        muSl.addEventListener('input', e => {
          const lbl = muSl.parentElement?.querySelector('.mono');
          if (lbl) lbl.textContent = String(+e.target.value);
        });
        muSl.addEventListener('change', e => { mu = +e.target.value; render(); });
      }

      const ellCv = host.querySelector('[data-ell-cv]');
      if (ellCv) {
        const eb = elliottBranching(lam, mu);
        setupCanvas(ellCv, cw => Math.min(280, Math.max(210, cw * 0.62)), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const acc = accentColor();
          const cols = Math.min(eb.bands.length, 5);
          const padL = 32, padR = 16, padT = 36, padB = 28;
          const colW = (W - padL - padR) / Math.max(1, cols);
          const maxL = Math.max(2, ...eb.bands.slice(0, cols).flatMap(b => b.LValues));
          const maxE = maxL * (maxL + 1);
          const palette = [acc, '#60a5fa', '#34d399', '#fbbf24', '#f472b6'];

          for (let ci = 0; ci < cols; ci++) {
            const band = eb.bands[ci];
            const x0 = padL + ci * colW + 10;
            const bw = Math.max(26, colW - 24);
            const col = palette[ci % palette.length];
            c.fillStyle = col;
            c.font = '600 11px var(--mono), monospace';
            c.textAlign = 'center';
            c.fillText(`K=${band.K}`, x0 + bw / 2, H - 10);

            const shown = band.LValues.slice(0, 9);
            for (const L of shown) {
              const frac = (L * (L + 1)) / maxE;
              const y = H - padB - frac * (H - padT - padB);
              c.strokeStyle = col;
              c.lineWidth = 2.4;
              c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + bw, y); c.stroke();
              c.fillStyle = '#f4f4f5';
              c.font = '10px var(--mono), monospace';
              c.textAlign = 'left';
              c.fillText(`${L}⁺`, x0 + bw + 4, y + 3);
            }
          }
        }, localClean);
      }
    }

    syncSegments(host, true);
  };

  clean.add(() => subClean?.());
  render();
  return clean.run;
}
