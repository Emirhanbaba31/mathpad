// MathPad Lie Tabs — Chapters SU(2) and SU(3) (Ramond Ch. 4.3, 5, 6)
import { esc, icon } from './ui.js';
import { motion, syncSegments } from './fx.js';
import {
  rat,
  ratLatex,
  ratFormat,
  c,
  matEye,
  matAdd,
  matSub,
  matMul,
  matScale,
  matComm,
  matAntiComm,
  matToLatex,
  getAlgebra,
  weightSystem,
  dynkinTo2D,
  rootTo2D,
  pauliMatrices,
  su2SpinMatrices,
  su2RotationMatrix,
  so3RotationMatrix,
  wignerSmallD,
  clebschGordan,
  su2TensorDecomp,
  formatHalfInt,
  su11DefiningMatrices,
  su11GroupElement,
  su11DiscreteSeries,
  oscillatorSU2,
  bohrAtomSO4,
  oscillatorSU11,
  gellMannMatrices,
  su3StructureConstants,
  su3Bases,
  su3Dim,
  su3WeightToI3Y,
  su3OscillatorShell,
  elliottBranching,
  EIGHTFOLD_WAY_MULTIPLETS,
  gellMannOkuboCheck,
} from './lie.js';
import {
  ensureLieCss,
  tex,
  richTex,
  accentColor,
  createClean,
  setupCanvas,
  createAnimLoop,
  fmtDynkin,
} from './lie-ui.js';

// =====================================================================
// TAB: SU(2) LABORATUVARI
// =====================================================================
export function mountSU2Lab(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let mode = 'bloch'; // 'bloch' | 'matrices' | 'cg' | 'apps'
  let jVal = 0.5;
  let wignerBetaDeg = 60;

  // Bloch / 4pi state
  let axisKey = 'z';
  let thetaDeg = 360;
  let playing = false;

  // CG state
  let j1 = 0.5, j2 = 0.5;
  let cgM1 = 0.5, cgM2 = -0.5, cgJ = 1;

  // Physics apps state
  let hoN = 3;
  let bohrN = 3;

  const AXES = {
    z: { label: 'ẑ = (0,0,1)', v: [0, 0, 1] },
    x: { label: 'x̂ = (1,0,0)', v: [1, 0, 0] },
    y: { label: 'ŷ = (0,1,0)', v: [0, 1, 0] },
    diag: { label: '(1,1,1)/√3', v: [1, 1, 1] },
  };

  let subClean = null;

  const render = () => {
    subClean?.run();
    subClean = createClean();

    let body = '';
    if (mode === 'bloch') {
      const ax = AXES[axisKey];
      const rad = (thetaDeg * Math.PI) / 180;
      const U = su2RotationMatrix(0.5, ax.v, rad);
      const R = so3RotationMatrix(ax.v, rad);
      const RMat = R.map(row => row.map(v => c(v, 0)));
      const near2pi = Math.abs(thetaDeg - 360) < 10;
      const near4pi = Math.abs(thetaDeg - 720) < 10 || thetaDeg < 10;
      const phaseSign = Math.cos(rad / 2);

      body = `<div class="lie-grid-side">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Bloch Küresi & Spin-½ 4π İşaret Dönüşümü</h3>
            <span class="lie-pill ${near2pi ? 'warn' : near4pi ? 'ok' : 'acc'}" data-theta-pill>θ = ${Math.round(thetaDeg)}° (${(thetaDeg / 180).toFixed(2)}π)</span>
          </div>
          <div class="lie-cv-box">
            <canvas class="lie-cv" data-bloch-cv aria-label="Bloch küresi ve spinör 4 pi faz animasyonu"></canvas>
            <div class="lie-cv-badge">SO(3) vektörü 2π'de · SU(2) spinörü 4π'de döner</div>
            <div class="lie-cv-phase" data-phase-badge>cos(θ/2) = ${phaseSign.toFixed(2)}</div>
          </div>
          <div class="lie-toolbar">
            <div class="lie-chips" role="group" aria-label="Dönme ekseni">
              ${Object.entries(AXES).map(([k, a]) => `<button type="button" class="lie-chip ${axisKey === k ? 'on' : ''}" data-ax="${k}">${esc(a.label)}</button>`).join('')}
            </div>
            <div class="lie-toolbar-g">
              <button type="button" class="btn small primary" data-play aria-label="Animasyonu oynat veya duraklat">${icon(playing ? 'pause' : 'play')} ${playing ? 'Duraklat' : '4π Oynat'}</button>
              ${[0, 180, 360, 540, 720].map(deg => `<button type="button" class="lie-chip ${Math.round(thetaDeg) === deg ? 'on' : ''}" data-deg="${deg}">${deg === 0 ? '0' : deg === 180 ? 'π' : deg === 360 ? '2π (−I)' : deg === 540 ? '3π' : '4π (+I)'}</button>`).join('')}
            </div>
          </div>
          <div class="lie-slider-row">
            <label class="grow">Dönme açısı θ: <input type="range" class="lie-range grow" data-theta min="0" max="720" step="1" value="${Math.round(thetaDeg)}" aria-label="Dönme açısı derece"></label>
            <span class="mono small" data-theta-lbl>${Math.round(thetaDeg)}°</span>
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Üstel Gönderim: Lie Cebiri → Lie Grubu</h3>
            <span class="lie-pill acc">SU(2) → SO(3)</span>
          </div>
          <div class="lie-callout ${near2pi ? 'bad' : near4pi ? 'ok' : ''}" data-sign-box aria-live="polite">
            <b>${near2pi ? '⚡ θ = 2π: SO(3) = +I, ancak SU(2) spinörü U = −I!' : near4pi ? '✓ θ = 0 veya 4π: Hem SO(3) hem spinör +I özdeşliğinde!' : 'U(n̂, θ) = exp(−i θ n̂·σ / 2) = cos(θ/2) I − i sin(θ/2) n̂·σ'}</b>
            <span class="small mute">Çift örtü çekirdeği ker(SU(2) → SO(3)) = {+I, −I} ≅ Z₂.</span>
          </div>
          <div class="small mute">Spin-½ matrisi ${tex('U(\\hat{n},\\theta) \\in SU(2)')}:</div>
          <div class="lie-math-box" data-u-box>${tex(`U = ${matToLatex(U, 3)}`, true)}</div>
          <div class="small mute">Eşleşen 3B dönme ${tex('R(\\hat{n},\\theta) \\in SO(3)')}:</div>
          <div class="lie-math-box" data-r-box>${tex(`R = ${matToLatex(RMat, 3)}`, true)}</div>
        </div>
      </div>`;
    } else if (mode === 'matrices') {
      const sp = su2SpinMatrices(jVal);
      const wd = wignerSmallD(jVal, (wignerBetaDeg * Math.PI) / 180);
      const wdC = wd.matrix.map(row => row.map(v => c(v, 0)));
      const { sx, sy, sz } = pauliMatrices();
      body = `<div class="lie-panel">
        <div class="lie-toolbar">
          <div class="lie-chips" role="group" aria-label="Spin j seçimi">
            ${[0.5, 1, 1.5, 2, 2.5, 3].map(j => `<button type="button" class="lie-chip ${j === jVal ? 'on' : ''}" data-j="${j}">j = ${formatHalfInt(j)} (dim ${Math.round(2 * j + 1)})</button>`).join('')}
          </div>
          <span class="lie-pill ${sp.checks.ok ? 'ok' : 'bad'}">${sp.checks.ok ? '✓ [Jx,Jy]=iJz & J²=j(j+1)I' : '✗ Hata'}</span>
        </div>

        <div class="lie-kpis">
          <div class="lie-kpi acc"><span class="lie-kpi-lbl">Boyut (2j+1)</span><span class="lie-kpi-val mono">${sp.dim}</span><span class="lie-kpi-sub">m = ${sp.mValues.map(formatHalfInt).join(', ')}</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Casimir J² = j(j+1)</span><span class="lie-kpi-val">${tex(ratLatex(rat(Math.round(2 * jVal) * (Math.round(2 * jVal) + 2), 4)))}</span><span class="lie-kpi-sub">${sp.casimir.toFixed(3)}</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Dynkin İndeksi T(j)</span><span class="lie-kpi-val">${tex(ratLatex(rat(Math.round(2 * jVal) * (Math.round(2 * jVal) + 1) * (Math.round(2 * jVal) + 2), 12)))}</span><span class="lie-kpi-sub">j(j+1)(2j+1)/3</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Komütatör Hata Maks.</span><span class="lie-kpi-val mono">${Math.max(sp.checks.commXY, sp.checks.commYZ, sp.checks.commZX).toExponential(1)}</span><span class="lie-kpi-sub">sayısal doğrulama</span></div>
        </div>

        <div class="lie-mat-grid">
          <div class="lie-mat-card"><div class="small mute">${tex('J_x = \\frac{1}{2}(J_+ + J_-)')}</div><div class="lie-math-box">${tex(matToLatex(sp.Jx, 3))}</div></div>
          <div class="lie-mat-card"><div class="small mute">${tex('J_y = \\frac{1}{2i}(J_+ - J_-)')}</div><div class="lie-math-box">${tex(matToLatex(sp.Jy, 3))}</div></div>
          <div class="lie-mat-card"><div class="small mute">${tex('J_z')} (köşegen)</div><div class="lie-math-box">${tex(matToLatex(sp.Jz, 3))}</div></div>
          <div class="lie-mat-card"><div class="small mute">${tex('J_+')} (yükseltici)</div><div class="lie-math-box">${tex(matToLatex(sp.Jp, 3))}</div></div>
          <div class="lie-mat-card"><div class="small mute">${tex('J_-')} (alçaltıcı)</div><div class="lie-math-box">${tex(matToLatex(sp.Jm, 3))}</div></div>
          <div class="lie-mat-card"><div class="small mute">${tex('J^2 = j(j+1)I')}</div><div class="lie-math-box">${tex(matToLatex(sp.J2, 3))}</div></div>
        </div>

        ${jVal === 0.5 ? `<div class="lie-callout"><div class="small"><b>Pauli Matrisleri (σ_a = 2 J_a):</b> ${tex(`\\sigma_x = ${matToLatex(sx)},\\; \\sigma_y = ${matToLatex(sy)},\\; \\sigma_z = ${matToLatex(sz)}`)}</div></div>` : ''}
      </div>

      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Wigner Küçük d-Matrisi ${tex(`d^{${formatHalfInt(jVal)}}_{m'm}(\\beta) = \\langle m'|e^{-i\\beta J_y}|m\\rangle`)}</h3>
          <span class="lie-pill acc">β = ${wignerBetaDeg}°</span>
        </div>
        <div class="lie-slider-row">
          <label class="grow">Euler açısı β: <input type="range" class="lie-range grow" data-wbeta min="0" max="360" step="5" value="${wignerBetaDeg}" aria-label="Wigner beta açısı"></label>
          ${[0, 45, 90, 180, 360].map(a => `<button type="button" class="lie-chip ${wignerBetaDeg === a ? 'on' : ''}" data-wbp="${a}">${a}°</button>`).join('')}
        </div>
        <div class="lie-math-box">${tex(`d^{${formatHalfInt(jVal)}}(${wignerBetaDeg}^\\circ) = ${matToLatex(wdC, 3)}`, true)}</div>
      </div>`;
    } else if (mode === 'cg') {
      const dec = su2TensorDecomp(j1, j2);
      const m1List = Array.from({ length: Math.round(2 * j1 + 1) }, (_, i) => j1 - i);
      const m2List = Array.from({ length: Math.round(2 * j2 + 1) }, (_, i) => j2 - i);
      if (!m1List.some(x => Math.abs(x - cgM1) < 1e-9)) cgM1 = m1List[0];
      if (!m2List.some(x => Math.abs(x - cgM2) < 1e-9)) cgM2 = m2List[0];
      if (!dec.JValues.some(x => Math.abs(x - cgJ) < 1e-9)) cgJ = dec.JValues[0];
      const cgM = Math.round((cgM1 + cgM2) * 2) / 2;
      const single = clebschGordan(j1, cgM1, j2, cgM2, cgJ, cgM);
      const d1 = Math.round(2 * j1 + 1), d2 = Math.round(2 * j2 + 1);

      body = `<div class="lie-panel">
        <div class="lie-toolbar">
          <div class="lie-toolbar-g">
            <label class="row" style="gap:6px"><span class="small mute">j₁ =</span>
              <select class="inp lie-sel" data-j1 aria-label="Birinci spin j1">
                ${[0.5, 1, 1.5, 2, 2.5].map(v => `<option value="${v}" ${v === j1 ? 'selected' : ''}>${formatHalfInt(v)}</option>`).join('')}
              </select>
            </label>
            <span class="mono mute">⊗</span>
            <label class="row" style="gap:6px"><span class="small mute">j₂ =</span>
              <select class="inp lie-sel" data-j2 aria-label="İkinci spin j2">
                ${[0.5, 1, 1.5, 2, 2.5].map(v => `<option value="${v}" ${v === j2 ? 'selected' : ''}>${formatHalfInt(v)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="lie-chips">
            ${[[0.5, 0.5, '½ ⊗ ½'], [1, 0.5, '1 ⊗ ½'], [1, 1, '1 ⊗ 1'], [1.5, 0.5, '³⁄₂ ⊗ ½'], [1.5, 1, '³⁄₂ ⊗ 1']].map(([a, b, lbl]) => `<button type="button" class="lie-chip ${j1 === a && j2 === b ? 'on' : ''}" data-cgp="${a},${b}">${lbl}</button>`).join('')}
          </div>
        </div>

        <div class="lie-decomp">
          <span class="small mute">Ayrışım:</span>
          <span>${tex(`j_1\\otimes j_2 = ${formatHalfInt(j1)}\\otimes ${formatHalfInt(j2)} = ${dec.JValues.map(formatHalfInt).join(' \\oplus ')}`)}</span>
          <span class="lie-pill ok">Boyut: ${d1} × ${d2} = ${d1 * d2} ✓</span>
        </div>

        <div class="lie-callout">
          <div class="lie-toolbar">
            <div class="lie-toolbar-g">
              <label class="row" style="gap:5px"><span class="small mute">m₁:</span><select class="inp lie-sel" data-m1 aria-label="m1">${m1List.map(v => `<option value="${v}" ${Math.abs(v - cgM1) < 1e-9 ? 'selected' : ''}>${formatHalfInt(v)}</option>`).join('')}</select></label>
              <label class="row" style="gap:5px"><span class="small mute">m₂:</span><select class="inp lie-sel" data-m2 aria-label="m2">${m2List.map(v => `<option value="${v}" ${Math.abs(v - cgM2) < 1e-9 ? 'selected' : ''}>${formatHalfInt(v)}</option>`).join('')}</select></label>
              <label class="row" style="gap:5px"><span class="small mute">J:</span><select class="inp lie-sel" data-cgj aria-label="Toplam J">${dec.JValues.map(v => `<option value="${v}" ${Math.abs(v - cgJ) < 1e-9 ? 'selected' : ''}>${formatHalfInt(v)}</option>`).join('')}</select></label>
            </div>
            <div>${tex(`\\langle ${formatHalfInt(j1)},\\,${formatHalfInt(cgM1)};\\; ${formatHalfInt(j2)},\\,${formatHalfInt(cgM2)} \\mid ${formatHalfInt(cgJ)},\\,${formatHalfInt(cgM)} \\rangle = ${single.latex}`)} <span class="mono small mute">(${single.value.toFixed(4)})</span></div>
          </div>
        </div>

        <div class="lie-table-wrap">
          <table class="lie-tbl" aria-label="Clebsch-Gordan bileşik durumlar tablosu">
            <thead><tr><th scope="col">|J, M⟩</th><th scope="col">Tam Clebsch-Gordan Açılımı (Condon–Shortley)</th><th scope="col">Norm²</th></tr></thead>
            <tbody>
              ${dec.states.map(st => {
                const expr = st.terms.map((t, i) => {
                  const pref = i === 0 ? t.cg.latex : (t.cg.sign < 0 ? ` ${t.cg.latex}` : ` + ${t.cg.latex}`);
                  return `${pref}\\,|${formatHalfInt(t.m1)},\\,${formatHalfInt(t.m2)}\\rangle`;
                }).join('');
                const norm2 = st.terms.reduce((s, t) => s + t.cg.value * t.cg.value, 0);
                return `<tr>
                  <td class="mono">${tex(`|${formatHalfInt(st.J)},\\,${formatHalfInt(st.M)}\\rangle`)}</td>
                  <td>${tex(expr)}</td>
                  <td class="mono small">${norm2.toFixed(3)} ✓</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    } else {
      const ho = oscillatorSU2(hoN);
      const bohr = bohrAtomSO4(bohrN);
      body = `<div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§5.5.1 · 2B İzotropik Harmonik Salınıcı (Schwinger)</h3>
            <span class="lie-pill acc">N = ${hoN} → j = ${formatHalfInt(ho.j)}</span>
          </div>
          <div class="lie-slider-row">
            <label class="grow">Kabuk N: <input type="range" class="lie-range grow" data-hon min="0" max="7" value="${hoN}" aria-label="2B salınıcı kabuk sayısı"></label>
            <span class="mono small">Dejenerelik: ${ho.degeneracy}</span>
          </div>
          <div class="lie-math-box">${tex('J_+ = a_1^\\dagger a_2,\\; J_- = a_2^\\dagger a_1,\\; J_3 = \\frac{1}{2}(a_1^\\dagger a_1 - a_2^\\dagger a_2)')}</div>
          <div class="lie-table-wrap">
            <table class="lie-tbl" aria-label="2B salınıcı Fock durumları">
              <thead><tr><th scope="col">Fock |n₁, n₂⟩</th><th scope="col">|j, m⟩</th><th scope="col">E / ħω</th></tr></thead>
              <tbody>${ho.states.map(s => `<tr><td class="mono">|${s.n1}, ${s.n2}⟩</td><td>${tex(`|${formatHalfInt(s.j)},\\,${formatHalfInt(s.m)}\\rangle`)}</td><td class="mono">${hoN + 1}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§5.5.2 · Bohr Atomu SO(4) ≅ SU(2)₊ × SU(2)₋</h3>
            <span class="lie-pill acc">n = ${bohrN}</span>
          </div>
          <div class="lie-slider-row">
            <label class="grow">Baş kuantum n: <input type="range" class="lie-range grow" data-bohrn min="1" max="6" value="${bohrN}" aria-label="Bohr baş kuantum sayısı"></label>
            <span class="mono small">n² = ${bohr.degeneracy}</span>
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi acc"><span class="lie-kpi-lbl">j₊ = j₋ = (n-1)/2</span><span class="lie-kpi-val">${tex(formatHalfInt(bohr.jPlus))}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Dejenerelik n²</span><span class="lie-kpi-val mono">${bohr.degeneracy}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Enerji E_n</span><span class="lie-kpi-val">${tex(`-\\frac{13.6}{${bohrN * bohrN}}\\,\\text{eV}`)}</span></div>
          </div>
          <div class="small mute">Yörünge ayrışımı (${tex('j_+ \\otimes j_- = \\bigoplus_{\\ell=0}^{n-1} \\ell')}):</div>
          <div class="lie-decomp">
            ${bohr.lValues.map(l => `<span class="lie-term">${bohrN}${['s', 'p', 'd', 'f', 'g', 'h'][l] || `ℓ=${l}`} <span class="mute small">(${2 * l + 1})</span></span>`).join('')}
          </div>
          <div class="lie-callout">
            <div class="small">${richTex('**§5.5.3 İzotopik Spin:** Nükleonlar $I=\\tfrac{1}{2}$ ($p: I_3=+\\tfrac{1}{2}$, $n: I_3=-\\tfrac{1}{2}$), piyonlar $I=1$ ($\\pi^+,\\pi^0,\\pi^-$). Döteron ($pn$) bağlı durumu $I=0$ izospin teklisindedir: $|0,0\\rangle = \\frac{1}{\\sqrt{2}}(|pn\\rangle - |np\\rangle)$.')}</div>
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-toolbar">
        <div class="seg" data-su2m role="tablist" aria-label="SU(2) laboratuvarı modları">
          <button type="button" data-m="bloch" class="${mode === 'bloch' ? 'on' : ''}">Bloch & 4π Faz</button>
          <button type="button" data-m="matrices" class="${mode === 'matrices' ? 'on' : ''}">Spin Matrisleri & Wigner d</button>
          <button type="button" data-m="cg" class="${mode === 'cg' ? 'on' : ''}">Clebsch-Gordan</button>
          <button type="button" data-m="apps" class="${mode === 'apps' ? 'on' : ''}">Salınıcı, Bohr & İzospin</button>
        </div>
        <button type="button" class="btn small ghost" data-doc>${icon('book')} Konu Anlatımı</button>
      </div>
      ${body}
    </div>`;

    host.querySelector('[data-su2m]').onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      playing = false;
      mode = b.dataset.m;
      render();
    };
    host.querySelector('[data-doc]').onclick = () => ctx?.jumpTo?.('su2-konu');

    if (mode === 'bloch') {
      const cv = host.querySelector('[data-bloch-cv]');
      const thetaInp = host.querySelector('[data-theta]');
      const thetaLbl = host.querySelector('[data-theta-lbl]');
      const thetaPill = host.querySelector('[data-theta-pill]');
      const phaseBadge = host.querySelector('[data-phase-badge]');
      const uBox = host.querySelector('[data-u-box]');
      const rBox = host.querySelector('[data-r-box]');
      const signBox = host.querySelector('[data-sign-box]');

      const drawBloch = (c2d, W, H) => {
        c2d.clearRect(0, 0, W, H);
        const acc = accentColor();
        const rad = (thetaDeg * Math.PI) / 180;
        const ax = AXES[axisKey].v;
        const R = so3RotationMatrix(ax, rad);

        // Left: 3D Bloch sphere; Right: 4pi Spinor Phase Dial
        const split = W > 440;
        const cx = split ? W * 0.34 : W * 0.5;
        const cy = split ? H * 0.52 : H * 0.36;
        const radS = Math.min(split ? W * 0.25 : W * 0.32, split ? H * 0.38 : H * 0.26);

        // Orthographic 3D projection (camera tilted nicely)
        const proj = ([x, y, z]) => {
          const px = (y * 0.92 - x * 0.42);
          const py = (-z * 0.92 + x * 0.28 + y * 0.16);
          return [cx + px * radS, cy + py * radS];
        };
        const applyR = v => [
          R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
          R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
          R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
        ];

        // Sphere outline & equator
        c2d.strokeStyle = 'rgba(255,255,255,0.22)';
        c2d.lineWidth = 1.4;
        c2d.beginPath();
        c2d.arc(cx, cy, radS, 0, Math.PI * 2);
        c2d.stroke();

        c2d.strokeStyle = 'rgba(255,255,255,0.12)';
        c2d.beginPath();
        for (let k = 0; k <= 48; k++) {
          const a = (k / 48) * Math.PI * 2;
          const [px, py] = proj([Math.cos(a), Math.sin(a), 0]);
          if (k === 0) c2d.moveTo(px, py); else c2d.lineTo(px, py);
        }
        c2d.stroke();

        // Coordinate axes
        for (const [vec, lbl] of [[[1.18, 0, 0], 'x'], [[0, 1.18, 0], 'y'], [[0, 0, 1.18], 'z']]) {
          const [p0x, p0y] = proj([0, 0, 0]);
          const [p1x, p1y] = proj(vec);
          c2d.strokeStyle = 'rgba(255,255,255,0.2)';
          c2d.beginPath(); c2d.moveTo(p0x, p0y); c2d.lineTo(p1x, p1y); c2d.stroke();
          c2d.fillStyle = '#a1a1aa';
          c2d.font = '600 11px monospace';
          c2d.fillText(lbl, p1x + 4, p1y + 4);
        }

        // Rotation axis (dashed)
        const an = Math.hypot(...ax) || 1;
        const unitAx = ax.map(v => v / an);
        const [a1x, a1y] = proj(unitAx.map(v => -1.25 * v));
        const [a2x, a2y] = proj(unitAx.map(v => 1.25 * v));
        c2d.save();
        c2d.setLineDash([4, 4]);
        c2d.strokeStyle = '#ffd166';
        c2d.lineWidth = 1.6;
        c2d.beginPath(); c2d.moveTo(a1x, a1y); c2d.lineTo(a2x, a2y); c2d.stroke();
        c2d.restore();

        // Initial reference vector perpendicular-ish to axis
        const v0 = axisKey === 'x' ? [0, 0.72, 0.69] : [0.76, 0.25, 0.6];
        const vn = Math.hypot(...v0);
        const baseV = v0.map(v => v / vn);

        // Orbit trail up to current angle
        c2d.strokeStyle = acc;
        c2d.lineWidth = 2;
        c2d.globalAlpha = 0.5;
        c2d.beginPath();
        const steps = Math.max(12, Math.round(thetaDeg / 4));
        for (let k = 0; k <= steps; k++) {
          const tk = (k / steps) * rad;
          const Rk = so3RotationMatrix(ax, tk);
          const vk = [
            Rk[0][0] * baseV[0] + Rk[0][1] * baseV[1] + Rk[0][2] * baseV[2],
            Rk[1][0] * baseV[0] + Rk[1][1] * baseV[1] + Rk[1][2] * baseV[2],
            Rk[2][0] * baseV[0] + Rk[2][1] * baseV[1] + Rk[2][2] * baseV[2],
          ];
          const [tx, ty] = proj(vk);
          if (k === 0) c2d.moveTo(tx, ty); else c2d.lineTo(tx, ty);
        }
        c2d.stroke();
        c2d.globalAlpha = 1;

        // Current rotated Bloch vector
        const curV = applyR(baseV);
        const [ox, oy] = proj([0, 0, 0]);
        const [vx, vy] = proj(curV);
        c2d.strokeStyle = '#ffffff';
        c2d.lineWidth = 2.6;
        c2d.beginPath(); c2d.moveTo(ox, oy); c2d.lineTo(vx, vy); c2d.stroke();
        c2d.fillStyle = acc;
        c2d.beginPath(); c2d.arc(vx, vy, 5.5, 0, Math.PI * 2); c2d.fill();

        // Spinor 4pi phase dial (shows theta/2 angle!)
        const dx = split ? W * 0.77 : W * 0.5;
        const dy = split ? H * 0.52 : H * 0.77;
        const dr = Math.min(split ? W * 0.16 : W * 0.24, split ? H * 0.30 : H * 0.18);

        c2d.strokeStyle = 'rgba(255,255,255,0.22)';
        c2d.lineWidth = 1.5;
        c2d.beginPath(); c2d.arc(dx, dy, dr, 0, Math.PI * 2); c2d.stroke();

        // +1 and -1 markers on phase dial
        c2d.fillStyle = '#5be49b';
        c2d.font = '600 11px monospace';
        c2d.textAlign = 'left';
        c2d.fillText('+|ψ⟩ (0, 4π)', dx + dr + 6, dy + 4);
        c2d.fillStyle = '#ff6b6b';
        c2d.textAlign = 'right';
        c2d.fillText('−|ψ⟩ (2π)', dx - dr - 6, dy + 4);
        c2d.textAlign = 'center';
        c2d.fillStyle = '#a1a1aa';
        c2d.fillText('Spinör Fazı (θ/2)', dx, dy - dr - 10);

        // Phase arrow at angle theta/2
        const halfRad = rad / 2;
        const px2 = dx + Math.cos(halfRad) * dr;
        const py2 = dy - Math.sin(halfRad) * dr;
        const negSide = Math.cos(halfRad) < 0;
        c2d.strokeStyle = negSide ? '#ff6b6b' : '#5be49b';
        c2d.lineWidth = 3;
        c2d.beginPath(); c2d.moveTo(dx, dy); c2d.lineTo(px2, py2); c2d.stroke();
        c2d.fillStyle = negSide ? '#ff6b6b' : '#5be49b';
        c2d.beginPath(); c2d.arc(px2, py2, 5.5, 0, Math.PI * 2); c2d.fill();
      };

      const canvasCtrl = setupCanvas(cv, w => (w > 440 ? 300 : 420), drawBloch, subClean);

      const syncMatricesLive = () => {
        const ax = AXES[axisKey];
        const rad = (thetaDeg * Math.PI) / 180;
        const U = su2RotationMatrix(0.5, ax.v, rad);
        const R = so3RotationMatrix(ax.v, rad).map(row => row.map(v => c(v, 0)));
        const near2 = Math.abs(thetaDeg - 360) < 10;
        const near4 = Math.abs(thetaDeg - 720) < 10 || thetaDeg < 10;
        if (thetaLbl) thetaLbl.textContent = `${Math.round(thetaDeg)}°`;
        if (thetaPill) {
          thetaPill.className = `lie-pill ${near2 ? 'warn' : near4 ? 'ok' : 'acc'}`;
          thetaPill.textContent = `θ = ${Math.round(thetaDeg)}° (${(thetaDeg / 180).toFixed(2)}π)`;
        }
        if (phaseBadge) phaseBadge.textContent = `cos(θ/2) = ${Math.cos(rad / 2).toFixed(2)}`;
        if (uBox) uBox.innerHTML = tex(`U = ${matToLatex(U, 3)}`, true);
        if (rBox) rBox.innerHTML = tex(`R = ${matToLatex(R, 3)}`, true);
        if (signBox) {
          signBox.className = `lie-callout ${near2 ? 'bad' : near4 ? 'ok' : ''}`;
          signBox.innerHTML = `<b>${near2 ? '⚡ θ = 2π: SO(3) = +I, ancak SU(2) spinörü U = −I!' : near4 ? '✓ θ = 0 veya 4π: Hem SO(3) hem spinör +I özdeşliğinde!' : 'U(n̂, θ) = exp(−i θ n̂·σ / 2)'}</b><span class="small mute">Çift örtü çekirdeği ker(SU(2) → SO(3)) = {+I, −I} ≅ Z₂.</span>`;
        }
      };

      let lastMatUpdate = 0;
      const loop = createAnimLoop((now, dt) => {
        if (!playing) return false;
        const speed = motion() === 'reduced' ? 40 : 95;
        thetaDeg = (thetaDeg + speed * dt) % 720;
        if (thetaInp) thetaInp.value = String(Math.round(thetaDeg));
        canvasCtrl.render();
        if (now - lastMatUpdate > 90) {
          lastMatUpdate = now;
          syncMatricesLive();
        }
        return true;
      }, subClean);

      if (playing && motion() !== 'off') loop.start();

      thetaInp.oninput = () => {
        thetaDeg = +thetaInp.value;
        canvasCtrl.render();
        syncMatricesLive();
      };
      host.querySelector('[data-play]').onclick = () => {
        if (motion() === 'off') {
          thetaDeg = (thetaDeg + 180) % 720;
          render();
          return;
        }
        playing = !playing;
        if (playing) loop.start(); else loop.stop();
        const btn = host.querySelector('[data-play]');
        btn.innerHTML = `${icon(playing ? 'pause' : 'play')} ${playing ? 'Duraklat' : '4π Oynat'}`;
      };
      host.querySelectorAll('[data-ax]').forEach(b => {
        b.onclick = () => { axisKey = b.dataset.ax; render(); };
      });
      host.querySelectorAll('[data-deg]').forEach(b => {
        b.onclick = () => { playing = false; thetaDeg = +b.dataset.deg; render(); };
      });
    } else if (mode === 'matrices') {
      host.querySelectorAll('[data-j]').forEach(b => { b.onclick = () => { jVal = +b.dataset.j; render(); }; });
      host.querySelector('[data-wbeta]').oninput = e => { wignerBetaDeg = +e.target.value; render(); };
      host.querySelectorAll('[data-wbp]').forEach(b => { b.onclick = () => { wignerBetaDeg = +b.dataset.wbp; render(); }; });
    } else if (mode === 'cg') {
      host.querySelector('[data-j1]').onchange = e => { j1 = +e.target.value; render(); };
      host.querySelector('[data-j2]').onchange = e => { j2 = +e.target.value; render(); };
      host.querySelectorAll('[data-cgp]').forEach(b => {
        b.onclick = () => { const [a, bb] = b.dataset.cgp.split(',').map(Number); j1 = a; j2 = bb; render(); };
      });
      host.querySelector('[data-m1]').onchange = e => { cgM1 = +e.target.value; render(); };
      host.querySelector('[data-m2]').onchange = e => { cgM2 = +e.target.value; render(); };
      host.querySelector('[data-cgj]').onchange = e => { cgJ = +e.target.value; render(); };
    } else {
      host.querySelector('[data-hon]').oninput = e => { hoN = +e.target.value; render(); };
      host.querySelector('[data-bohrn]').oninput = e => { bohrN = +e.target.value; render(); };
    }
    syncSegments(host, true);
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}

// =====================================================================
// TAB: SU(2) → SU(1,1)
// =====================================================================
export function mountSU2toSU11(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let boostEta = 1.0;
  let rotPhiDeg = 40;
  let kVal = 1;
  let seriesKind = '+';
  let oscParity = 'even';

  let subClean = null;

  const render = () => {
    subClean?.run();
    subClean = createClean();
    const def = su11DefiningMatrices();
    const phiRad = (rotPhiDeg * Math.PI) / 180;
    const grp = su11GroupElement(boostEta, phiRad);
    const ds = su11DiscreteSeries(kVal, seriesKind, 8);
    const osc = oscillatorSU11(oscParity, 6);

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-grid-side">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Kompakt Küre S² (SU(2)) vs Hiperboloid H² (SU(1,1))</h3>
            <span class="lie-pill acc">Weyl Üniter Hilesi</span>
          </div>
          <div class="lie-cv-box">
            <canvas class="lie-cv" data-su11-cv aria-label="SU(2) küresi ile SU(1,1) hiperboloidi karşılaştırması"></canvas>
            <div class="lie-cv-badge">x²+y²+z² = 1 (kompakt) · z²−x²−y² = 1 (kompakt değil)</div>
          </div>
          <div class="lie-slider-row">
            <label class="grow">İvmelenme (rapidity) η = <span class="mono">${boostEta.toFixed(2)}</span>
              <input type="range" class="lie-range grow" data-eta min="-2.2" max="2.2" step="0.05" value="${boostEta}" aria-label="Hiperbolik ivmelenme rapidity">
            </label>
            <label class="grow">Dönme φ = <span class="mono">${rotPhiDeg}°</span>
              <input type="range" class="lie-range grow" data-phi min="0" max="360" step="5" value="${rotPhiDeg}" aria-label="SU(1,1) dönme açısı">
            </label>
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">2×2 Tanımlayıcı Temsil & Üstel Gönderim</h3>
            <span class="lie-pill ${grp.preservesMetric && def.checks.ok ? 'ok' : 'bad'}">${grp.preservesMetric ? '✓ U†ηU = η, det U = 1' : '✗ Hata'}</span>
          </div>
          <div class="lie-math-box">${tex('K_1 = i J_1,\\; K_2 = i J_2,\\; K_3 = J_3 \\implies [K_1, K_2] = -i K_3', true)}</div>
          <div class="lie-math-box">${tex(`U(\\eta,\\varphi) = e^{-i\\varphi K_3}e^{-i\\eta K_2} = ${matToLatex(grp.U, 3)}`, true)}</div>
          <div class="lie-kpis">
            <div class="lie-kpi"><span class="lie-kpi-lbl">det(U)</span><span class="lie-kpi-val mono">${grp.det.re.toFixed(4)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">‖U†ηU − η‖</span><span class="lie-kpi-val mono">${grp.metricErr.toExponential(1)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">cosh(η)</span><span class="lie-kpi-val mono">${Math.cosh(boostEta).toFixed(3)}</span></div>
          </div>
        </div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Sonsuz Boyutlu Üniter Ayrık Seri ${tex(ds.label)}</h3>
            <span class="lie-pill acc">${tex(`Q = k(k-1) = ${ds.casimir.toFixed(3)}`)}</span>
          </div>
          <div class="lie-toolbar">
            <div class="lie-chips" role="group" aria-label="Ayrık seri parametresi k">
              ${[0.25, 0.5, 0.75, 1, 1.5, 2, 2.5].map(k => `<button type="button" class="lie-chip ${kVal === k ? 'on' : ''}" data-k="${k}">k = ${k === 0.25 ? '¼' : k === 0.75 ? '¾' : formatHalfInt(k)}</button>`).join('')}
            </div>
            <div class="seg" data-sk role="tablist" aria-label="Pozitif veya negatif ayrık seri">
              <button type="button" data-s="+" class="${seriesKind === '+' ? 'on' : ''}">D⁺_k (alttan sınırlı)</button>
              <button type="button" data-s="-" class="${seriesKind === '-' ? 'on' : ''}">D⁻_k (üstten sınırlı)</button>
            </div>
          </div>
          <div class="lie-ladder">
            ${ds.levels.map(lv => `<div class="lie-ladder-row ${lv.n === 0 ? 'singular' : ''}">
              <span class="mono mute">n = ${lv.n}</span>
              <span class="mono"><b>m = ${lv.m.toFixed(2).replace(/\.00$/, '')}</b></span>
              <span class="small mute">K₊ → ${lv.upCoeff.toFixed(3)} · K₋ → ${lv.downCoeff.toFixed(3)}</span>
              ${lv.n === 0 ? '<span class="lie-pill warn">Taban</span>' : '<span class="small mono mute">∞</span>'}
            </div>`).join('')}
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§4.3 Tek Kipli Bozonik Salınıcı & SU(1,1)</h3>
            <span class="lie-pill acc">Q = −3/16</span>
          </div>
          <div class="lie-math-box">${tex('K_+ = \\tfrac{1}{2}(a^\\dagger)^2,\\quad K_- = \\tfrac{1}{2}a^2,\\quad K_3 = \\tfrac{1}{2}(a^\\dagger a + \\tfrac{1}{2})')}</div>
          <div class="seg" data-op role="tablist" aria-label="Fock uzayı paritesi">
            <button type="button" data-p="even" class="${oscParity === 'even' ? 'on' : ''}">Çift |2n⟩ → D⁺_{1/4}</button>
            <button type="button" data-p="odd" class="${oscParity === 'odd' ? 'on' : ''}">Tek |2n+1⟩ → D⁺_{3/4}</button>
          </div>
          <div class="lie-table-wrap">
            <table class="lie-tbl" aria-label="Tek kipli salınıcı SU(1,1) merdiveni">
              <thead><tr><th scope="col">Fock |N⟩</th><th scope="col">K₃ özdeğeri m</th><th scope="col">K₊ katsayısı</th><th scope="col">K₋ katsayısı</th></tr></thead>
              <tbody>${osc.levels.map(lv => `<tr><td class="mono">|${lv.fockN}⟩</td><td class="mono">${lv.m.toFixed(2)}</td><td class="mono">${lv.upCoeff.toFixed(3)}</td><td class="mono">${lv.downCoeff.toFixed(3)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    const cv = host.querySelector('[data-su11-cv]');
    setupCanvas(cv, w => (w > 460 ? 255 : 225), (c2d, W, H) => {
      c2d.clearRect(0, 0, W, H);
      const acc = accentColor();
      const mid = W / 2;

      // Left: S^2 (compact)
      const cx1 = mid * 0.5, cy1 = H * 0.54, r1 = Math.min(mid * 0.34, H * 0.34);
      c2d.strokeStyle = 'rgba(255,255,255,0.26)';
      c2d.lineWidth = 1.4;
      c2d.beginPath(); c2d.arc(cx1, cy1, r1, 0, Math.PI * 2); c2d.stroke();
      c2d.strokeStyle = 'rgba(255,255,255,0.12)';
      c2d.beginPath(); c2d.ellipse(cx1, cy1, r1, r1 * 0.34, 0, 0, Math.PI * 2); c2d.stroke();
      const sx = cx1 + r1 * Math.sin(boostEta) * Math.cos(phiRad);
      const sy = cy1 - r1 * Math.cos(boostEta);
      c2d.fillStyle = '#5be49b';
      c2d.beginPath(); c2d.arc(sx, sy, 5, 0, Math.PI * 2); c2d.fill();
      c2d.fillStyle = '#d4d4d8';
      c2d.font = '600 11.5px monospace';
      c2d.textAlign = 'center';
      c2d.fillText('SU(2): S² (sınırlı)', cx1, 22);

      // Divider
      c2d.strokeStyle = 'rgba(255,255,255,0.08)';
      c2d.beginPath(); c2d.moveTo(mid, 14); c2d.lineTo(mid, H - 14); c2d.stroke();

      // Right: Hyperboloid H^2 (non-compact)
      const cx2 = mid + mid * 0.5, cy2 = H * 0.86;
      const scaleX = Math.min(mid * 0.14, 48), scaleY = Math.min(H * 0.17, 42);

      // Light cone asymptotes z = |x|
      c2d.save();
      c2d.setLineDash([4, 4]);
      c2d.strokeStyle = 'rgba(255,255,255,0.16)';
      c2d.beginPath();
      c2d.moveTo(cx2 - scaleX * 3.8, cy2 - scaleY * 3.8);
      c2d.lineTo(cx2, cy2);
      c2d.lineTo(cx2 + scaleX * 3.8, cy2 - scaleY * 3.8);
      c2d.stroke();
      c2d.restore();

      // Upper sheet z = cosh(t), x = sinh(t)
      c2d.strokeStyle = acc;
      c2d.lineWidth = 2;
      c2d.beginPath();
      for (let i = -30; i <= 30; i++) {
        const t = (i / 30) * 2.15;
        const px = cx2 + Math.sinh(t) * scaleX;
        const py = cy2 - Math.cosh(t) * scaleY;
        if (i === -30) c2d.moveTo(px, py); else c2d.lineTo(px, py);
      }
      c2d.stroke();

      // Current boosted point projected
      const hx = cx2 + Math.sinh(boostEta) * Math.cos(phiRad) * scaleX;
      const hy = cy2 - Math.cosh(boostEta) * scaleY;
      // Constant rapidity ellipse
      const rx = Math.abs(Math.sinh(boostEta)) * scaleX;
      if (rx > 2) {
        c2d.strokeStyle = 'rgba(255,209,102,0.45)';
        c2d.lineWidth = 1.2;
        c2d.beginPath(); c2d.ellipse(cx2, hy, rx, rx * 0.24, 0, 0, Math.PI * 2); c2d.stroke();
      }
      c2d.fillStyle = '#ffd166';
      c2d.beginPath(); c2d.arc(hx, hy, 5.5, 0, Math.PI * 2); c2d.fill();
      c2d.fillStyle = '#d4d4d8';
      c2d.fillText('SU(1,1): H² (sınırsız)', cx2, 22);
    }, subClean);

    host.querySelector('[data-eta]').oninput = e => { boostEta = +e.target.value; render(); };
    host.querySelector('[data-phi]').oninput = e => { rotPhiDeg = +e.target.value; render(); };
    host.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { kVal = +b.dataset.k; render(); }; });
    host.querySelector('[data-sk]').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { seriesKind = b.dataset.s; render(); } };
    host.querySelector('[data-op]').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { oscParity = b.dataset.p; render(); } };
    syncSegments(host, true);
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}

// =====================================================================
// TAB: SU(3) LABORATUVARI
// =====================================================================
export function mountSU3Lab(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let mode = 'gellmann'; // 'gellmann' | 'bases' | 'physics'
  let pairA = 0, pairB = 1;
  let basisKey = 'alpha';
  let pqP = 1, pqQ = 1;
  let hoN = 3;

  const { lambdas } = gellMannMatrices();
  const { f, d, uniqueF, uniqueD } = su3StructureConstants();
  const basesData = su3Bases();

  const render = () => {
    let body = '';
    if (mode === 'gellmann') {
      const comm = matComm(lambdas[pairA], lambdas[pairB]);
      const anti = matAntiComm(lambdas[pairA], lambdas[pairB]);
      const fTerms = [];
      const dTerms = [];
      for (let k = 0; k < 8; k++) {
        if (Math.abs(f[pairA][pairB][k]) > 1e-9) {
          const v = f[pairA][pairB][k];
          fTerms.push(`${v < 0 ? '-' : fTerms.length ? '+' : ''} 2i(${Math.abs(v).toFixed(4).replace(/0\.8660/, '\\frac{\\sqrt{3}}{2}').replace(/0\.5000/, '\\frac{1}{2}').replace(/1\.0000/, '1')})\\lambda_${k + 1}`);
        }
        if (Math.abs(d[pairA][pairB][k]) > 1e-9) {
          const v = d[pairA][pairB][k];
          dTerms.push(`${v < 0 ? '-' : dTerms.length ? '+' : ''} 2(${Math.abs(v).toFixed(4).replace(/0\.5774/, '\\frac{1}{\\sqrt{3}}').replace(/0\.2887/, '\\frac{1}{2\\sqrt{3}}').replace(/0\.5000/, '\\frac{1}{2}')})\\lambda_${k + 1}`);
        }
      }
      const fExpr = fTerms.length ? fTerms.join(' ') : '0';
      const dExpr = (pairA === pairB ? '\\frac{4}{3}I_3' : '') + (dTerms.length ? (pairA === pairB && !dTerms[0].startsWith('-') ? ' + ' : ' ') + dTerms.join(' ') : (pairA === pairB ? '' : '0'));

      body = `<div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">8 Gell-Mann Matrisi (T_a = λ_a / 2)</h3>
          <span class="lie-pill acc">${tex('\\operatorname{Tr}(\\lambda_a \\lambda_b) = 2\\delta_{ab}')}</span>
        </div>
        <div class="lie-mat-grid">
          ${lambdas.map((L, idx) => `<div class="lie-mat-card ${idx === pairA || idx === pairB ? 'on' : ''}">
            <div class="lie-panel-head">
              <b>${tex(`\\lambda_${idx + 1}`)}</b>
              <div class="row" style="gap:4px">
                <button type="button" class="lie-chip ${idx === pairA ? 'on' : ''}" data-pa="${idx}" aria-label="a için lambda ${idx + 1}">a</button>
                <button type="button" class="lie-chip ${idx === pairB ? 'on' : ''}" data-pb="${idx}" aria-label="b için lambda ${idx + 1}">b</button>
              </div>
            </div>
            <div class="lie-math-box">${tex(matToLatex(L, 3))}</div>
          </div>`).join('')}
        </div>
      </div>

      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">Canlı Komütatör & Anti-komütatör: (a, b) = (${pairA + 1}, ${pairB + 1})</h3>
          <span class="lie-pill ok">✓ Motor doğrulaması</span>
        </div>
        <div class="lie-grid-2">
          <div class="lie-math-box">${tex(`[\\lambda_${pairA + 1}, \\lambda_${pairB + 1}] = ${fExpr} = ${matToLatex(comm, 3)}`, true)}</div>
          <div class="lie-math-box">${tex(`\\{\\lambda_${pairA + 1}, \\lambda_${pairB + 1}\\} = ${dExpr} = ${matToLatex(anti, 3)}`, true)}</div>
        </div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Tam Antisimetrik f_abc (${uniqueF.length} bağımsız üçlü)</h3></div>
          <div class="lie-table-wrap">
            <table class="lie-tbl" aria-label="SU(3) antisimetrik yapı sabitleri f_abc">
              <thead><tr><th scope="col">(a, b, c)</th><th scope="col">Tam Değer</th><th scope="col">Sayısal</th></tr></thead>
              <tbody>${uniqueF.map(x => `<tr><td class="mono">f_{${x.idx.join('')}}</td><td>${tex(x.latex)}</td><td class="mono mute">${x.value.toFixed(4)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
        <div class="lie-panel">
          <div class="lie-panel-head"><h3 class="lie-panel-title">Tam Simetrik d_abc (${uniqueD.length} bağımsız üçlü)</h3></div>
          <div class="lie-table-wrap">
            <table class="lie-tbl" aria-label="SU(3) simetrik sabitler d_abc">
              <thead><tr><th scope="col">(a, b, c)</th><th scope="col">Tam Değer</th><th scope="col">Sayısal</th></tr></thead>
              <tbody>${uniqueD.map(x => `<tr><td class="mono">d_{${x.idx.join('')}}</td><td>${tex(x.latex)}</td><td class="mono mute">${x.value.toFixed(4)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    } else if (mode === 'bases') {
      const cur = basesData.bases[basisKey];
      body = `<div class="lie-panel">
        <div class="lie-chips" role="group" aria-label="SU(3) baz seçimi">
          ${[
            ['alpha', '§6.2 α-Bazı'],
            ['omega', '§6.3 ω-Bazı (Dynkin)'],
            ['alphaPrime', "§6.4 α′-Bazı"],
            ['chevalley', '§6.6 Chevalley Bazı'],
            ['physics', 'Fizik (I/U/V-Spin)'],
          ].map(([k, l]) => `<button type="button" class="lie-chip ${basisKey === k ? 'on' : ''}" data-bk="${k}">${esc(l)}</button>`).join('')}
        </div>
        <div class="lie-callout">
          <b>${esc(cur.title)}</b>
          <span class="small mute">${esc(cur.desc)}</span>
        </div>
        <div class="lie-grid-2">
          <div class="lie-math-box">${tex(`A = \\begin{pmatrix}2 & -1\\\\ -1 & 2\\end{pmatrix}, \\quad A^{-1} = \\frac{1}{3}\\begin{pmatrix}2 & 1\\\\ 1 & 2\\end{pmatrix}`, true)}</div>
          <div class="lie-math-box">${tex(basesData.changeOfBasis.omegaToI3Y, true)}</div>
        </div>
        <div class="lie-math-box">${tex(basesData.changeOfBasis.alphaToAlphaPrime, true)}</div>
        <div class="lie-mat-grid">
          ${cur.generators.map(g => `<div class="lie-mat-card">
            <div class="small">${tex(g.latex)}</div>
            <div class="lie-math-box">${tex(matToLatex(g.matrix, 3))}</div>
          </div>`).join('')}
        </div>
      </div>`;
    } else {
      const dimPQ = su3Dim(pqP, pqQ);
      const triality = (((pqP - pqQ) % 3) + 3) % 3;
      const c2PQ = rat(pqP * pqP + pqP * pqQ + pqQ * pqQ + 3 * pqP + 3 * pqQ, 3);
      const ell = elliottBranching(pqP, pqQ);
      const sh = su3OscillatorShell(hoN);
      body = `<div class="lie-panel">
        <div class="lie-panel-head"><h3 class="lie-panel-title">§6.5 Üçlü Temsili 3 = (1, 0) Kuark Ağırlıkları</h3></div>
        <div class="lie-table-wrap">
          <table class="lie-tbl" aria-label="SU(3) üçlü temsili ağırlıkları">
            <thead><tr><th scope="col">Kuark</th><th scope="col">ω-Bazı (Dynkin)</th><th scope="col">α-Bazı</th><th scope="col">I₃</th><th scope="col">Y</th><th scope="col">Q = I₃ + Y/2</th></tr></thead>
            <tbody>${basesData.tripletWeights.map(w => `<tr>
              <td><b>${esc(w.name)}</b></td>
              <td class="mono">${fmtDynkin(w.dynkin)}</td>
              <td>${tex(`(${ratLatex(w.rootCoords[0])},\\; ${ratLatex(w.rootCoords[1])})`)}</td>
              <td>${tex(ratLatex(w.I3))}</td>
              <td>${tex(ratLatex(w.Y))}</td>
              <td>${tex(ratLatex(w.Q))}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>

      <div class="lie-grid-2">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§6.7.2 (p, q) Temsili & Elliott Modeli SU(3) ⊃ SO(3)</h3>
            <span class="lie-pill acc">dim(${pqP},${pqQ}) = ${dimPQ}</span>
          </div>
          <div class="lie-toolbar-g">
            <label class="row" style="gap:6px"><span class="small mute">p:</span><input type="number" class="inp mono lie-num" data-pqp min="0" max="6" value="${pqP}" aria-label="SU(3) p etiketi"></label>
            <label class="row" style="gap:6px"><span class="small mute">q:</span><input type="number" class="inp mono lie-num" data-pqq min="0" max="6" value="${pqQ}" aria-label="SU(3) q etiketi"></label>
            <button type="button" class="btn small ghost" data-goto-wd>Ağırlık diyagramında çiz →</button>
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi acc"><span class="lie-kpi-lbl">Boyut</span><span class="lie-kpi-val mono">${dimPQ}</span><span class="lie-kpi-sub">(p+1)(q+1)(p+q+2)/2</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Casimir C₂</span><span class="lie-kpi-val">${tex(ratLatex(c2PQ))}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Üçlülük (Triality)</span><span class="lie-kpi-val mono">${triality} (mod 3)</span></div>
          </div>
          <div class="small mute">Elliott dönme bantları (${tex(`\\sum (2L+1) = ${ell.totalDim}`)} ✓):</div>
          <div class="lie-decomp">
            ${ell.bands.map(b => `<span class="lie-term">K=${b.K}: L = ${b.Ls.join(', ')}</span>`).join('')}
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">§6.7.1 3B İzotropik Harmonik Salınıcı</h3>
            <span class="lie-pill acc">N = ${hoN} · (${hoN}, 0)</span>
          </div>
          <div class="lie-slider-row">
            <label class="grow">Kabuk N: <input type="range" class="lie-range grow" data-ho3 min="0" max="6" value="${hoN}" aria-label="3B harmonik salınıcı kabuğu"></label>
            <span class="mono small">deg = ${sh.degeneracy}</span>
          </div>
          <div class="lie-math-box">${tex(`E_${hoN} = \\left(${sh.energy}\\right)\\hbar\\omega, \\qquad \\dim(${hoN},0) = \\frac{(N+1)(N+2)}{2} = ${sh.degeneracy}`)}</div>
          <div class="lie-decomp">
            <span class="small mute">SO(3) açısal momentumları:</span>
            ${sh.lList.map(L => `<span class="lie-term">L = ${L} <span class="mute small">(${2 * L + 1})</span></span>`).join('')}
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-toolbar">
        <div class="seg" data-su3m role="tablist" aria-label="SU(3) laboratuvarı modları">
          <button type="button" data-m="gellmann" class="${mode === 'gellmann' ? 'on' : ''}">Gell-Mann & f/d</button>
          <button type="button" data-m="bases" class="${mode === 'bases' ? 'on' : ''}">5 Baz (α, ω, α′, Chevalley)</button>
          <button type="button" data-m="physics" class="${mode === 'physics' ? 'on' : ''}">Üçlü, Elliott & 3B HO</button>
        </div>
        <button type="button" class="btn small ghost" data-doc>${icon('book')} Konu Anlatımı</button>
      </div>
      ${body}
    </div>`;

    host.querySelector('[data-su3m]').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; render(); } };
    host.querySelector('[data-doc]').onclick = () => ctx?.jumpTo?.('su3-konu');

    if (mode === 'gellmann') {
      host.querySelectorAll('[data-pa]').forEach(b => { b.onclick = () => { pairA = +b.dataset.pa; render(); }; });
      host.querySelectorAll('[data-pb]').forEach(b => { b.onclick = () => { pairB = +b.dataset.pb; render(); }; });
    } else if (mode === 'bases') {
      host.querySelectorAll('[data-bk]').forEach(b => { b.onclick = () => { basisKey = b.dataset.bk; render(); }; });
    } else {
      host.querySelector('[data-pqp]').onchange = e => { pqP = Math.max(0, Math.min(6, Math.trunc(+e.target.value) || 0)); render(); };
      host.querySelector('[data-pqq]').onchange = e => { pqQ = Math.max(0, Math.min(6, Math.trunc(+e.target.value) || 0)); render(); };
      host.querySelector('[data-ho3]').oninput = e => { hoN = +e.target.value; render(); };
      host.querySelector('[data-goto-wd]').onclick = () => ctx?.jumpTo?.('agirlik-diyagram');
    }
    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB: AĞIRLIK DİYAGRAMLARI (Rank 2: A2, B2, C2, G2)
// =====================================================================
export function mountWeightDiagrams(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let algType = 'A';
  let hw = [1, 1];
  let showRoots = true;
  let selectedIdx = 0;

  const PRESETS = {
    A: [
      { lbl: '3 (1,0)', hw: [1, 0] },
      { lbl: '3̄ (0,1)', hw: [0, 1] },
      { lbl: '6 (2,0)', hw: [2, 0] },
      { lbl: '8 (1,1)', hw: [1, 1] },
      { lbl: '10 (3,0)', hw: [3, 0] },
      { lbl: '15 (2,1)', hw: [2, 1] },
      { lbl: '27 (2,2)', hw: [2, 2] },
    ],
    B: [
      { lbl: '4 spinör (0,1)', hw: [0, 1] },
      { lbl: '5 vektör (1,0)', hw: [1, 0] },
      { lbl: '10 adj (0,2)', hw: [0, 2] },
      { lbl: '14 (2,0)', hw: [2, 0] },
      { lbl: '16 (1,1)', hw: [1, 1] },
    ],
    C: [
      { lbl: '4 temel (1,0)', hw: [1, 0] },
      { lbl: '5 (0,1)', hw: [0, 1] },
      { lbl: '10 adj (2,0)', hw: [2, 0] },
      { lbl: '14 (0,2)', hw: [0, 2] },
      { lbl: '16 (1,1)', hw: [1, 1] },
    ],
    G: [
      { lbl: '7 temel (0,1)', hw: [0, 1] },
      { lbl: '14 adj (1,0)', hw: [1, 0] },
      { lbl: '27 (0,2)', hw: [0, 2] },
      { lbl: '64 (1,1)', hw: [1, 1] },
    ],
  };

  let subClean = null;

  const render = () => {
    subClean?.run();
    subClean = createClean();
    const alg = getAlgebra(algType, 2);
    const ws = weightSystem(alg, hw, { maxWeights: 600 });
    if (selectedIdx >= ws.weights.length) selectedIdx = 0;
    const sel = ws.weights[selectedIdx];
    const maxMult = Math.max(1, ...ws.weights.map(w => w.mult));

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-toolbar">
          <div class="lie-chips" role="group" aria-label="Rank-2 Lie cebiri seç">
            ${[['A', 'A₂ · SU(3)'], ['B', 'B₂ · SO(5)'], ['C', 'C₂ · Sp(4)'], ['G', 'G₂']].map(([t, l]) => `<button type="button" class="lie-chip ${algType === t ? 'on' : ''}" data-wt="${t}">${l}</button>`).join('')}
          </div>
          <div class="lie-toolbar-g">
            <label class="row" style="gap:5px"><span class="small mute">a₁:</span><input type="number" class="inp mono lie-num" data-a1 min="0" max="5" value="${hw[0]}" aria-label="Birinci Dynkin etiketi"></label>
            <label class="row" style="gap:5px"><span class="small mute">a₂:</span><input type="number" class="inp mono lie-num" data-a2 min="0" max="5" value="${hw[1]}" aria-label="İkinci Dynkin etiketi"></label>
            <button type="button" class="chip ${showRoots ? 'on' : ''}" data-sroots aria-pressed="${showRoots}">Basit kökler α₁, α₂</button>
          </div>
        </div>
        <div class="lie-chips">
          ${PRESETS[algType].map(p => `<button type="button" class="lie-chip ${p.hw[0] === hw[0] && p.hw[1] === hw[1] ? 'on' : ''}" data-wp="${p.hw.join(',')}">${esc(p.lbl)}</button>`).join('')}
        </div>
      </div>

      <div class="lie-grid-side">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">${tex(`${alg.latex} (${alg.compactLatex}) \\; \\Lambda = ${fmtDynkin(hw)}`)}</h3>
            <span class="lie-pill acc">dim = ${ws.dim} · ${ws.distinctWeights} farklı ağırlık</span>
          </div>
          <div class="lie-cv-box">
            <canvas class="lie-cv" data-wd-cv aria-label="${esc(alg.name)} ağırlık diyagramı"></canvas>
            <div class="lie-cv-badge">Eş-merkezli halkalar + rakam = Freudenthal katlılığı (dokunup incele)</div>
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Seçili Ağırlık Detayı</h3>
            <span class="lie-pill ${sel.isHighest ? 'acc' : sel.isDominant ? 'ok' : ''}">${sel.isHighest ? 'En Yüksek Λ' : sel.isDominant ? 'Baskın' : 'Ağırlık'}</span>
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi acc"><span class="lie-kpi-lbl">Dynkin (a₁, a₂)</span><span class="lie-kpi-val mono">${fmtDynkin(sel.dynkin)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Katlılık m(μ)</span><span class="lie-kpi-val mono">${sel.mult}</span><span class="lie-kpi-sub">maks. ${maxMult}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Derinlik</span><span class="lie-kpi-val mono">${sel.depth}</span><span class="lie-kpi-sub">kök adımı</span></div>
            ${algType === 'A' ? (() => {
              const iy = su3WeightToI3Y(sel.dynkin);
              return `<div class="lie-kpi"><span class="lie-kpi-lbl">(I₃, Y)</span><span class="lie-kpi-val">${tex(`(${ratLatex(iy.I3)},\\,${ratLatex(iy.Y)})`)}</span></div>`;
            })() : `<div class="lie-kpi"><span class="lie-kpi-lbl">2B Koordinat</span><span class="lie-kpi-val mono">(${sel.pos2D[0].toFixed(2)}, ${sel.pos2D[1].toFixed(2)})</span></div>`}
          </div>
          <div class="small mute">Baskın ağırlıklar (${ws.dominantWeights.length} adet):</div>
          <div class="lie-table-wrap">
            <table class="lie-tbl" aria-label="Baskın ağırlıklar tablosu">
              <thead><tr><th scope="col">Dynkin</th><th scope="col">Katlılık</th><th scope="col">Derinlik</th></tr></thead>
              <tbody>${ws.dominantWeights.map(dw => {
                const wi = ws.weights.indexOf(dw);
                return `<tr class="clickable ${wi === selectedIdx ? 'on' : ''}" data-pickw="${wi}"><td class="mono">${fmtDynkin(dw.dynkin)}</td><td class="mono"><b>${dw.mult}</b></td><td class="mono mute">${dw.depth}</td></tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    const cv = host.querySelector('[data-wd-cv]');
    let screenPts = [];

    const draw = (c2d, W, H) => {
      c2d.clearRect(0, 0, W, H);
      const acc = accentColor();
      const cx = W / 2, cy = H / 2;
      let maxR = 1.2;
      for (const w of ws.weights) {
        const r = Math.hypot(w.pos2D[0], w.pos2D[1]);
        if (r > maxR) maxR = r;
      }
      const scale = (Math.min(W, H) * 0.39) / maxR;
      const toXY = ([x, y]) => [cx + x * scale, cy - y * scale];

      // Axes & origin
      c2d.strokeStyle = 'rgba(255,255,255,0.09)';
      c2d.lineWidth = 1;
      c2d.beginPath();
      c2d.moveTo(16, cy); c2d.lineTo(W - 16, cy);
      c2d.moveTo(cx, 16); c2d.lineTo(cx, H - 16);
      c2d.stroke();

      // Connect weights differing by a simple root
      const byKey = new Map(ws.weights.map((w, i) => [w.dynkin.join(','), i]));
      c2d.strokeStyle = 'rgba(255,255,255,0.14)';
      c2d.lineWidth = 1;
      for (const w of ws.weights) {
        const [x1, y1] = toXY(w.pos2D);
        for (let ri = 0; ri < 2; ri++) {
          const nw = [w.dynkin[0] - alg.cartan[ri][0], w.dynkin[1] - alg.cartan[ri][1]];
          const hit = byKey.get(nw.join(','));
          if (hit !== undefined) {
            const [x2, y2] = toXY(ws.weights[hit].pos2D);
            c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke();
          }
        }
      }

      // Simple root vectors from origin
      if (showRoots) {
        const colors = ['#60a5fa', '#f472b6'];
        for (let i = 0; i < 2; i++) {
          const rv = rootTo2D(alg, i === 0 ? [1, 0] : [0, 1]);
          const [rx, ry] = toXY(rv.map(v => v * 0.65));
          c2d.strokeStyle = colors[i];
          c2d.lineWidth = 2.2;
          c2d.beginPath(); c2d.moveTo(cx, cy); c2d.lineTo(rx, ry); c2d.stroke();
          c2d.fillStyle = colors[i];
          c2d.font = '600 11.5px monospace';
          c2d.fillText(`α${i + 1}`, rx + 6, ry - 4);
        }
      }

      // Draw every weight dot + concentric multiplicity rings + number badge
      screenPts = [];
      for (let i = 0; i < ws.weights.length; i++) {
        const w = ws.weights[i];
        const [px, py] = toXY(w.pos2D);
        screenPts.push({ i, px, py });
        const isSel = i === selectedIdx;
        const baseR = isSel ? 7 : 5.2;

        // Concentric rings for multiplicity >= 2 (up to 4 visible rings + exact number)
        const rings = Math.min(w.mult - 1, 4);
        for (let r = 1; r <= rings; r++) {
          c2d.strokeStyle = isSel ? '#ffd166' : acc;
          c2d.lineWidth = 1.5;
          c2d.beginPath(); c2d.arc(px, py, baseR + r * 4.5, 0, Math.PI * 2); c2d.stroke();
        }

        c2d.fillStyle = isSel ? '#ffd166' : w.isHighest ? acc : w.isDominant ? '#5be49b' : '#f4f4f5';
        c2d.beginPath(); c2d.arc(px, py, baseR, 0, Math.PI * 2); c2d.fill();

        if (w.mult > 1) {
          c2d.fillStyle = '#ffd166';
          c2d.font = '700 10.5px monospace';
          c2d.fillText(`×${w.mult}`, px + baseR + rings * 4.5 + 3, py - 5);
        }
        if (ws.weights.length <= 18 || isSel || w.isHighest) {
          c2d.fillStyle = isSel ? '#ffd166' : '#d4d4d8';
          c2d.font = '500 10px monospace';
          c2d.fillText(fmtDynkin(w.dynkin), px + 8, py + 13);
        }
      }
    };

    setupCanvas(cv, w => Math.min(400, Math.max(300, Math.round(w * 0.72))), draw, subClean);

    cv.addEventListener('pointerdown', e => {
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let best = -1, bestD = 26;
      for (const p of screenPts) {
        const d = Math.hypot(p.px - x, p.py - y);
        if (d < bestD) { bestD = d; best = p.i; }
      }
      if (best >= 0) { selectedIdx = best; render(); }
    });

    host.querySelectorAll('[data-wt]').forEach(b => {
      b.onclick = () => {
        algType = b.dataset.wt;
        hw = PRESETS[algType][0].hw.slice();
        selectedIdx = 0;
        render();
      };
    });
    host.querySelectorAll('[data-wp]').forEach(b => {
      b.onclick = () => { hw = b.dataset.wp.split(',').map(Number); selectedIdx = 0; render(); };
    });
    host.querySelector('[data-a1]').onchange = e => { hw[0] = Math.max(0, Math.min(5, Math.trunc(+e.target.value) || 0)); selectedIdx = 0; render(); };
    host.querySelector('[data-a2]').onchange = e => { hw[1] = Math.max(0, Math.min(5, Math.trunc(+e.target.value) || 0)); selectedIdx = 0; render(); };
    host.querySelector('[data-sroots]').onclick = () => { showRoots = !showRoots; render(); };
    host.querySelectorAll('[data-pickw]').forEach(tr => { tr.onclick = () => { selectedIdx = +tr.dataset.pickw; render(); }; });
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}

// =====================================================================
// TAB: SEKİZLİ YOL (Eightfold Way, Ω⁻ Prediction & GMO Mass Formula)
// =====================================================================
export function mountEightfoldWay(host, _G, ctx) {
  ensureLieCss();
  const clean = createClean(ctx);
  let multId = 'baryonDecuplet';
  let selIdx = 9; // Omega- initially highlighted!
  let subClean = null;

  const render = () => {
    subClean?.run();
    subClean = createClean();
    const mp = EIGHTFOLD_WAY_MULTIPLETS[multId];
    if (selIdx >= mp.particles.length) selIdx = 0;
    const p = mp.particles[selIdx];
    const gmo = gellMannOkuboCheck(multId);

    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-chips" role="group" aria-label="Hadron çoklusu seçimi">
          ${Object.values(EIGHTFOLD_WAY_MULTIPLETS).map(m => `<button type="button" class="lie-chip ${m.id === multId ? 'on' : ''}" data-mp="${m.id}">${esc(m.title.split(' (')[0])}</button>`).join('')}
        </div>
      </div>

      <div class="lie-grid-side">
        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">${esc(mp.title)}</h3>
            <span class="lie-pill acc">${esc(mp.rep)}</span>
          </div>
          <div class="lie-cv-box">
            <canvas class="lie-cv" data-ew-cv aria-label="${esc(mp.title)} ağırlık diyagramı"></canvas>
            <div class="lie-cv-badge">Yatay: İzospin I₃ · Dikey: Hiperyük Y = B + S · Eğik çizgiler: sabit Q</div>
          </div>
          <div class="lie-hadron-grid">
            ${mp.particles.map((it, idx) => `<button type="button" class="lie-hadron-btn ${idx === selIdx ? 'on' : ''} ${it.highlight ? 'omega' : ''}" data-hp="${idx}">
              <div class="row" style="justify-content:space-between"><b>${tex(it.latex)}</b><span class="mono small mute">Q = ${it.Q > 0 ? `+${Number(it.Q.toFixed(2))}` : Number(it.Q.toFixed(2))}</span></div>
              <div class="small mute">${esc(it.quarks)} · ${it.mass} MeV</div>
            </button>`).join('')}
          </div>
        </div>

        <div class="lie-panel">
          <div class="lie-panel-head">
            <h3 class="lie-panel-title">Seçili Parçacık: ${esc(p.name)}</h3>
            <span class="lie-pill ${p.highlight ? 'warn' : 'acc'}">${tex(p.latex)}</span>
          </div>
          <div class="lie-kpis">
            <div class="lie-kpi acc"><span class="lie-kpi-lbl">Kuark İçeriği</span><span class="lie-kpi-val mono">${esc(p.quarks)}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">İzospin (I, I₃)</span><span class="lie-kpi-val mono">(${formatHalfInt(p.I)}, ${formatHalfInt(p.I3)})</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Hiperyük Y / S</span><span class="lie-kpi-val mono">Y=${Number(p.Y.toFixed(2))}, S=${p.S}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Yük Q = I₃+Y/2</span><span class="lie-kpi-val mono">${p.Q > 0 ? '+' : ''}${Number(p.Q.toFixed(2))}</span></div>
            <div class="lie-kpi"><span class="lie-kpi-lbl">Deneysel Kütle</span><span class="lie-kpi-val mono">${p.mass} MeV</span></div>
          </div>

          ${gmo ? `<div class="lie-callout ok">
            <div class="lie-panel-title">Gell-Mann–Okubo Kütle Formülü Kontrolü</div>
            <div class="lie-math-box">${tex(gmo.formulaLatex, true)}</div>
            <div class="small">${esc(gmo.summary)}</div>
          </div>` : `<div class="lie-callout"><div class="small"><b>Gell-Mann–Nishijima:</b> ${tex('Q = I_3 + \\frac{Y}{2} = I_3 + \\frac{B + S}{2}')}. Kuarklar kesirli elektrik yükü (+2/3, −1/3) taşır ve 3⊗3⊗3 = 10 + 8 + 8 + 1 ile tüm baryonları üretir.</div></div>`}

          <div class="lie-callout">
            <div class="small">${richTex("**§6.7.3 Sakata vs Kuark Modeli:** Sakata modeli $(p, n, \\Lambda)$ üçlüsünü temel aldı; mezonlar için $\\mathbf{3}\\otimes\\bar{\\mathbf{3}}=\\mathbf{8}\\oplus\\mathbf{1}$ doğru çalıştı, ancak baryonları $(3\\otimes 3\\otimes\\bar{3})$ içine yerleştiremedi. Gell-Mann ve Zweig'ın kuark üçlüsü $(u, d, s)$ hem sekizliyi hem de $\\Omega^-$ ($sss$) içeren onluyu kusursuz açıkladı.")}</div>
          </div>
        </div>
      </div>
    </div>`;

    const cv = host.querySelector('[data-ew-cv]');
    let hitPts = [];

    const draw = (c2d, W, H) => {
      c2d.clearRect(0, 0, W, H);
      const acc = accentColor();
      const cx = W / 2, cy = H * 0.48;
      const sx = Math.min(W * 0.22, 110);
      const sy = Math.min(H * 0.24, 92);
      const toXY = (i3, y) => [cx + i3 * sx, cy - y * sy];

      // Grid axes
      c2d.strokeStyle = 'rgba(255,255,255,0.12)';
      c2d.lineWidth = 1;
      c2d.beginPath();
      c2d.moveTo(24, cy); c2d.lineTo(W - 24, cy);
      c2d.moveTo(cx, 20); c2d.lineTo(cx, H - 20);
      c2d.stroke();
      c2d.fillStyle = '#a1a1aa';
      c2d.font = '600 11px monospace';
      c2d.fillText('I₃ →', W - 46, cy - 8);
      c2d.fillText('Y ↑', cx + 8, 28);

      // Diagonal constant Q lines (Q = I3 + Y/2 => Y = 2Q - 2 I3)
      c2d.save();
      c2d.setLineDash([3, 4]);
      c2d.strokeStyle = 'rgba(255,255,255,0.09)';
      for (const q of [-1, 0, 1, 2]) {
        const [x1, y1] = toXY(-1.8, 2 * q + 3.6);
        const [x2, y2] = toXY(1.8, 2 * q - 3.6);
        c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke();
      }
      c2d.restore();

      // Convex hull outline (hexagon for octet, triangle for decuplet/quarks)
      const hullPts = multId === 'baryonDecuplet'
        ? [[-1.5, 1], [1.5, 1], [0, -2]]
        : multId === 'quarks'
          ? [[-0.5, 1 / 3], [0.5, 1 / 3], [0, -2 / 3]]
          : [[-0.5, 1], [0.5, 1], [1, 0], [0.5, -1], [-0.5, -1], [-1, 0]];
      c2d.strokeStyle = 'rgba(255,255,255,0.25)';
      c2d.lineWidth = 1.6;
      c2d.beginPath();
      hullPts.forEach(([i3, y], k) => {
        const [px, py] = toXY(i3, y);
        if (k === 0) c2d.moveTo(px, py); else c2d.lineTo(px, py);
      });
      c2d.closePath();
      c2d.stroke();

      // Plot particles (handle double-occupied (0,0) center cleanly with ring + slight offset)
      hitPts = [];
      const centerSeen = [];
      mp.particles.forEach((it, idx) => {
        let [px, py] = toXY(it.I3, it.Y);
        const isCenter = Math.abs(it.I3) < 1e-6 && Math.abs(it.Y) < 1e-6;
        let offsetX = 0;
        if (isCenter) {
          offsetX = centerSeen.length === 0 ? -16 : 16;
          centerSeen.push(idx);
          // Draw outer multiplicity-2 ring at true origin
          if (centerSeen.length === 1) {
            c2d.strokeStyle = 'rgba(255,255,255,0.22)';
            c2d.lineWidth = 1.2;
            c2d.beginPath(); c2d.arc(px, py, 24, 0, Math.PI * 2); c2d.stroke();
          }
        }
        px += offsetX;
        hitPts.push({ idx, px, py });
        const on = idx === selIdx;
        c2d.fillStyle = on ? '#ffd166' : it.highlight ? '#f59e0b' : acc;
        c2d.beginPath(); c2d.arc(px, py, on ? 9 : 7, 0, Math.PI * 2); c2d.fill();
        c2d.strokeStyle = '#09090d';
        c2d.lineWidth = 2;
        c2d.stroke();

        c2d.fillStyle = on ? '#ffd166' : '#f4f4f5';
        c2d.font = `${on ? '700' : '600'} 12px var(--font), sans-serif`;
        c2d.textAlign = 'center';
        c2d.fillText(it.sym, px, py - 12);
      });
    };

    setupCanvas(cv, w => Math.min(360, Math.max(270, Math.round(w * 0.65))), draw, subClean);

    cv.addEventListener('pointerdown', e => {
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let best = -1, bestD = 28;
      for (const h of hitPts) {
        const d = Math.hypot(h.px - x, h.py - y);
        if (d < bestD) { bestD = d; best = h.idx; }
      }
      if (best >= 0) { selIdx = best; render(); }
    });

    host.querySelectorAll('[data-mp]').forEach(b => {
      b.onclick = () => {
        multId = b.dataset.mp;
        selIdx = multId === 'baryonDecuplet' ? 9 : 0;
        render();
      };
    });
    host.querySelectorAll('[data-hp]').forEach(b => { b.onclick = () => { selIdx = +b.dataset.hp; render(); }; });
  };

  clean.add(() => subClean?.run());
  render();
  return clean.run;
}
