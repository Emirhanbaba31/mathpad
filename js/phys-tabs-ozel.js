// MathPad Physics & Exceptional Structures (Ramond Part C) — Chapter: ozel
// Covers Ramond Ch. 1 (Preface: 17 Wallpaper Groups, 5 Platonic Solids, Everyday Shapes & Galois)
// and Ch. 12 (Hurwitz Algebras, Octonions & Fano Plane, Albert Algebra J3(O), Freudenthal–Tits Magic Square).
import { esc, icon } from './ui.js';
import { full, syncSegments } from './fx.js';
import {
  HURWITZ_ALGEBRAS,
  cdNorm2,
  cdNorm,
  cdMul,
  cdCommutator,
  cdAssociator,
  FANO_TRIPLES,
  FANO_LAYOUT,
  octonionMulTable,
  hermitian3Dim,
  jordan3Create,
  jordan3Product,
  jordan3IsHermitian,
  jordan3MaxDiff,
  freudenthalDet,
  MAGIC_SQUARE,
  MAGIC_SQUARE_LABELS,
  WALLPAPER_GROUPS,
  PLATONIC_SOLIDS,
  EVERYDAY_SHAPES,
} from './physgroups.js';
import {
  ensurePhysCss,
  tex,
  accentColor,
  createClean,
  setupCanvas,
  createAnimLoop,
  fmtNum,
} from './phys-ui.js';

// =====================================================================
// TAB 11: SİMETRİ GALERİSİ (Önsöz: 17 Duvar Kağıdı, 5 Platon Katısı, Galois)
// =====================================================================
export function mountSymmetryGallery(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'wallpaper'; // 'wallpaper' | 'platonic' | 'everyday'
  let wallIdx = 16; // default p6m (richest!)
  let motif = 'flag'; // 'flag' | 'comet' | 'tri'
  let showLattice = true;
  let colorByDet = true;

  // Platonic 3D state
  let solidIdx = 4; // Icosahedron A_5
  let rotX = 0.45;
  let rotY = 0.65;
  let autoSpin = true;

  // Everyday shape state
  let shapeIdx = 1; // Square D_4
  let shapeRotStep = 0;
  let shapeFlipped = false;

  let subClean = null;

  const render = () => {
    subClean?.();
    const localFns = [];
    const localClean = { add(fn) { if (typeof fn === 'function') localFns.push(fn); } };
    subClean = () => { while (localFns.length) try { localFns.pop()(); } catch { } };

    let bodyHtml = '';

    if (mode === 'wallpaper') {
      const wg = WALLPAPER_GROUPS[wallIdx];
      bodyHtml = `<div class="phy-stage">
        <div class="phy-side-l">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">17 Duvar Kağıdı Grubu (IUC)</h3>
              <span class="grp-pill acc">17 / 17</span>
            </div>
            <div class="phy-wall-grid" role="group" aria-label="17 duvar kağıdı grubu seçici">
              ${WALLPAPER_GROUPS.map((w, idx) => `<button type="button" class="phy-wall-btn ${idx === wallIdx ? 'on' : ''}" data-wg="${idx}" aria-label="${esc(w.iuc)} duvar kağıdı grubu">
                <span>${esc(w.iuc)}</span>
                <small>${esc(w.orbifold)}</small>
              </button>`).join('')}
            </div>
            <div class="grp-toolbar">
              <select class="inp grp-sel" data-motif aria-label="Döşeme motifi">
                <option value="flag" ${motif === 'flag' ? 'selected' : ''}>Asimetrik F-Bayrağı</option>
                <option value="comet" ${motif === 'comet' ? 'selected' : ''}>Kuyrukluyıldız Oku</option>
                <option value="tri" ${motif === 'tri' ? 'selected' : ''}>Kiral Üçgen</option>
              </select>
              <button type="button" class="chip ${showLattice ? 'on' : ''}" data-lat-tog>Kafes</button>
              <button type="button" class="chip ${colorByDet ? 'on' : ''}" data-det-tog>Ayna Rengi</button>
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Üretilen Periyodik Döşeme: ${esc(wg.iuc)}</h3>
              <span class="grp-pill acc">Orbifold: ${esc(wg.orbifold)}</span>
            </div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-wall-cv aria-label="${esc(wg.iuc)} duvar kağıdı grubu canlı döşemesi"></canvas>
              <div class="phy-cv-tag">${esc(wg.iuc)} · ${esc(wg.lattice)} · ${wg.ops.length} kopya/hücre</div>
            </div>
            <div class="grp-kpis">
              <div class="grp-kpi acc"><span class="grp-kpi-lbl">Nokta Grubu</span><span class="grp-kpi-val mono">${esc(wg.pointGroup)}</span><span class="grp-kpi-sub">Maks. dönme: ${wg.maxRot}-katlı</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Kafes Türü</span><span class="grp-kpi-val">${esc(wg.lattice)}</span><span class="grp-kpi-sub">Bravais</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Ayna / Kayma</span><span class="grp-kpi-val">${wg.mirror ? 'Ayna ✓' : 'Ayna ✗'}</span><span class="grp-kpi-sub">${wg.glide ? 'Kayma yansıması ✓' : 'Kayma yok'}</span></div>
            </div>
            <p class="small mute">${esc(wg.desc)} (Kristalografik kısıtlama: yalnızca 1, 2, 3, 4 ve 6 katlı dönmeler periyodik olabilir.)</p>
          </div>
        </div>
      </div>`;
    } else if (mode === 'platonic') {
      const solid = PLATONIC_SOLIDS[solidIdx];
      bodyHtml = `<div class="phy-stage">
        <div class="phy-side">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">${esc(solid.name)} · Schläfli ${esc(solid.schlafli)}</h3>
              <button type="button" class="btn small ghost" data-pspin aria-label="Dönmeyi oynat veya duraklat">${icon(autoSpin ? 'pause' : 'play')} ${autoSpin ? 'Duraklat' : 'Döndür'}</button>
            </div>
            <div class="grp-elems">
              ${PLATONIC_SOLIDS.map((s, idx) => `<button type="button" class="grp-chip ${idx === solidIdx ? 'on' : ''}" data-ps="${idx}">${esc(s.name.split(' ')[0])} (${s.rotGroup.replace('_', '')})</button>`).join('')}
            </div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-plat-cv aria-label="${esc(solid.name)} 3B etkileşimli tel kafes"></canvas>
              <div class="phy-cv-tag">3B döndürmek için sürükle · ${tex(solid.rotGroup)} (|G|=${solid.rotOrder})</div>
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Geometrik & Grup Özellikleri</h3>
              <span class="grp-pill ok">V − E + F = ${solid.V - solid.E + solid.F} ✓</span>
            </div>
            <div class="grp-kpis">
              <div class="grp-kpi acc"><span class="grp-kpi-lbl">Dönme Grubu</span><span class="grp-kpi-val">${tex(solid.rotGroup)}</span><span class="grp-kpi-sub">Mertebe ${solid.rotOrder}</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Tam Grup (Yansımalı)</span><span class="grp-kpi-val">${tex(solid.fullGroup)}</span><span class="grp-kpi-sub">Mertebe ${solid.fullOrder}</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Köşe / Kenar / Yüz</span><span class="grp-kpi-val mono">${solid.V} / ${solid.E} / ${solid.F}</span><span class="grp-kpi-sub">Euler = 2</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Düal Katı</span><span class="grp-kpi-val">${esc(solid.dual)}</span><span class="grp-kpi-sub">Aynı simetri grubu</span></div>
            </div>
            <p class="small mute">${esc(solid.note)}</p>
            <div class="grp-toolbar-g">
              <button type="button" class="btn small primary" data-jump-solid>${icon('sparkle')} ${tex(solid.rotGroup)} Grubunu Keşfet →</button>
              <button type="button" class="btn small ghost" data-jump-mckay>${icon('atom')} İkili Örtüler (2T, 2O, 2I) →</button>
            </div>
          </div>
        </div>
      </div>`;
    } else {
      const sh = EVERYDAY_SHAPES[shapeIdx];
      bodyHtml = `<div class="phy-stage">
        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Günlük Şekillerde Dönme & Yansıma</h3>
              <span class="grp-pill acc">${tex(sh.group)}</span>
            </div>
            <div class="grp-elems">
              ${EVERYDAY_SHAPES.map((s, idx) => `<button type="button" class="grp-chip ${idx === shapeIdx ? 'on' : ''}" data-es="${idx}">${esc(s.name)}</button>`).join('')}
            </div>
            <div class="phy-cv-box">
              <canvas class="phy-cv" data-day-cv aria-label="${esc(sh.name)} simetri dönüşümleri"></canvas>
              <div class="phy-cv-tag">${esc(sh.name)} · ${shapeFlipped ? 'Yansıtılmış (det=−1)' : 'Doğrudan (det=+1)'}</div>
            </div>
            <div class="grp-toolbar">
              <div class="grp-toolbar-g">
                <button type="button" class="btn small primary" data-dact="rot">${icon('rotate')} Döndür (+r)</button>
                <button type="button" class="btn small" data-dact="flip" ${sh.reflections === 0 ? 'disabled' : ''}>Yansıt (s)</button>
                <button type="button" class="btn small ghost" data-dact="reset">Sıfırla (e)</button>
              </div>
              ${sh.spec ? `<button type="button" class="btn small ghost" data-jump-sh>Simetri Lab →</button>` : ''}
            </div>
            <div class="grp-kpis">
              <div class="grp-kpi acc"><span class="grp-kpi-lbl">Simetri Grubu</span><span class="grp-kpi-val">${tex(sh.group)}</span><span class="grp-kpi-sub">|G| = ${Number.isFinite(sh.order) ? sh.order : '∞'}</span></div>
              <div class="grp-kpi"><span class="grp-kpi-lbl">Dönme / Yansıma</span><span class="grp-kpi-val mono">${Number.isFinite(sh.rotations) ? sh.rotations : '∞'} / ${Number.isFinite(sh.reflections) ? sh.reflections : '∞'}</span><span class="grp-kpi-sub">${sh.chiral ? 'Kiral (ayna yok!)' : 'Aynalı'}</span></div>
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Galois & Polinom Köklerinin Simetrisi (Önsöz)</h3>
              <span class="grp-pill warn">Abel–Ruffini</span>
            </div>
            <p class="small">Grup teorisi yalnızca geometriyle değil, Évariste Galois’nın <b>polinom köklerinin permütasyon simetrilerini</b> incelemesiyle doğdu:</p>
            <div class="grp-math-box">${tex('n \\le 4:\\; S_n \\text{ çözülebilir} \\quad\\Big|\\quad n \\ge 5:\\; A_n \\triangleleft S_n \\text{ basit ve Abelyen değil}')}</div>
            <div class="phy-scroll">
              <table class="grp-tbl" aria-label="Polinom dereceleri ve Galois grupları">
                <thead><tr><th>Derece n</th><th>Genel Galois Grubu</th><th>Çözülebilir?</th><th>Kök Formülü</th></tr></thead>
                <tbody>
                  <tr><td class="mono">2</td><td>${tex('S_2 \\cong \\mathbb{Z}_2')}</td><td><span class="grp-pill ok">Evet ✓</span></td><td class="small">İkinci derece formülü</td></tr>
                  <tr><td class="mono">3</td><td>${tex('S_3 \\triangleright A_3 \\triangleright 1')}</td><td><span class="grp-pill ok">Evet ✓</span></td><td class="small">Cardano formülü</td></tr>
                  <tr><td class="mono">4</td><td>${tex('S_4 \\triangleright A_4 \\triangleright V_4 \\triangleright 1')}</td><td><span class="grp-pill ok">Evet ✓</span></td><td class="small">Ferrari formülü</td></tr>
                  <tr class="on"><td class="mono"><b>5</b></td><td>${tex('S_5 \\triangleright A_5 \\triangleright 1')}</td><td><span class="grp-pill bad">Hayır ✗</span></td><td class="small"><b>Genel kök formülü yok!</b></td></tr>
                </tbody>
              </table>
            </div>
            <button type="button" class="btn small ghost" data-jump-a5>${icon('flame')} Basit Grup A₅ ve Sylow Analizi →</button>
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-sg-mode role="tablist" aria-label="Simetri galerisi bölümleri">
          <button type="button" data-m="wallpaper" class="${mode === 'wallpaper' ? 'on' : ''}">17 Duvar Kağıdı</button>
          <button type="button" data-m="platonic" class="${mode === 'platonic' ? 'on' : ''}">5 Platon Katısı (3B)</button>
          <button type="button" data-m="everyday" class="${mode === 'everyday' ? 'on' : ''}">Günlük Şekiller & Galois</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-sg-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });

    if (mode === 'wallpaper') {
      host.querySelectorAll('[data-wg]').forEach(b => { b.onclick = () => { wallIdx = +b.dataset.wg; render(); }; });
      host.querySelector('[data-motif]')?.addEventListener('change', e => { motif = e.target.value; render(); });
      host.querySelector('[data-lat-tog]')?.addEventListener('click', () => { showLattice = !showLattice; render(); });
      host.querySelector('[data-det-tog]')?.addEventListener('click', () => { colorByDet = !colorByDet; render(); });

      const cv = host.querySelector('[data-wall-cv]');
      if (cv) {
        const wg = WALLPAPER_GROUPS[wallIdx];
        const [[a1x, a1y], [a2x, a2y]] = wg.basis;
        // Asymmetric motif points in fractional coords near (0.14, 0.16)
        const motifPts = motif === 'flag'
          ? [[0.06, 0.05], [0.06, 0.28], [0.22, 0.28], [0.22, 0.22], [0.12, 0.22], [0.12, 0.17], [0.19, 0.17], [0.19, 0.12], [0.12, 0.12], [0.12, 0.05]]
          : motif === 'comet'
          ? [[0.06, 0.08], [0.26, 0.14], [0.16, 0.18], [0.21, 0.29], [0.11, 0.20]]
          : [[0.07, 0.06], [0.26, 0.11], [0.12, 0.27]];

        setupCanvas(cv, cw => Math.min(360, Math.max(250, cw * 0.68)), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const acc = accentColor();
          const cellPx = Math.max(54, Math.min(88, W / 4.8));
          const cx = W / 2, cy = H / 2;
          const fracToPx = (u, v) => [cx + (u * a1x + v * a2x) * cellPx, cy - (u * a1y + v * a2y) * cellPx];

          // Tile across integer lattice offsets (i, j)
          const range = 5;
          for (let i = -range; i <= range; i++) {
            for (let j = -range; j <= range; j++) {
              const center = fracToPx(i + 0.5, j + 0.5);
              if (center[0] < -cellPx * 1.6 || center[0] > W + cellPx * 1.6 || center[1] < -cellPx * 1.6 || center[1] > H + cellPx * 1.6) continue;

              for (const op of wg.ops) {
                const det = op[0] * op[4] - op[1] * op[3];
                const col = (colorByDet && det < 0) ? '#38bdf8' : acc;
                c.fillStyle = col;
                c.globalAlpha = det < 0 ? 0.68 : 0.85;
                c.strokeStyle = 'rgba(255,255,255,0.6)';
                c.lineWidth = 1;
                c.beginPath();
                motifPts.forEach(([u, v], idx) => {
                  const u2 = op[0] * u + op[1] * v + op[2] + i;
                  const v2 = op[3] * u + op[4] * v + op[5] + j;
                  const [px, py] = fracToPx(u2, v2);
                  if (idx === 0) c.moveTo(px, py); else c.lineTo(px, py);
                });
                c.closePath();
                c.fill();
                c.stroke();
              }
            }
          }
          c.globalAlpha = 1;

          // Unit cell lattice grid overlay
          if (showLattice) {
            c.strokeStyle = 'rgba(255,255,255,0.16)';
            c.lineWidth = 1;
            for (let i = -range; i <= range; i++) {
              const p1 = fracToPx(i, -range), p2 = fracToPx(i, range);
              c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke();
              const q1 = fracToPx(-range, i), q2 = fracToPx(range, i);
              c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
            }
            // Highlight fundamental unit cell (0,0)-(1,1)
            const c00 = fracToPx(0, 0), c10 = fracToPx(1, 0), c11 = fracToPx(1, 1), c01 = fracToPx(0, 1);
            c.strokeStyle = '#fbbf24';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(c00[0], c00[1]); c.lineTo(c10[0], c10[1]); c.lineTo(c11[0], c11[1]); c.lineTo(c01[0], c01[1]);
            c.closePath(); c.stroke();
          }
        }, localClean);
      }
    } else if (mode === 'platonic') {
      host.querySelectorAll('[data-ps]').forEach(b => { b.onclick = () => { solidIdx = +b.dataset.ps; render(); }; });
      host.querySelector('[data-jump-solid]')?.addEventListener('click', () => {
        ctx?.jumpTo?.('kesif', PLATONIC_SOLIDS[solidIdx].spec);
      });
      host.querySelector('[data-jump-mckay]')?.addEventListener('click', () => ctx?.jumpTo?.('ortuler-mckay'));

      const cv = host.querySelector('[data-plat-cv]');
      let loop = null;
      if (cv) {
        const solid = PLATONIC_SOLIDS[solidIdx];
        const rot3 = v => {
          const cy = Math.cos(rotY), sy = Math.sin(rotY);
          const cx = Math.cos(rotX), sx = Math.sin(rotX);
          const x1 = v[0] * cy + v[2] * sy;
          const z1 = -v[0] * sy + v[2] * cy;
          const y2 = v[1] * cx - z1 * sx;
          const z2 = v[1] * sx + z1 * cx;
          return [x1, y2, z2];
        };

        const cvCtrl = setupCanvas(cv, cw => Math.min(340, Math.max(240, cw * 0.78)), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const acc = accentColor();
          const cx = W / 2, cy = H / 2, scale = Math.min(W, H) * 0.36;
          const rVerts = solid.vertices.map(rot3);
          const proj = rVerts.map(([x, y, z]) => {
            const p = 3.2 / (3.2 - z);
            return { x: cx + x * scale * p, y: cy - y * scale * p, z };
          });

          // Depth-sort edges back to front
          const sortedEdges = solid.edges
            .map(([i, j]) => ({ i, j, z: (proj[i].z + proj[j].z) / 2 }))
            .sort((a, b) => a.z - b.z);

          for (const e of sortedEdges) {
            const p1 = proj[e.i], p2 = proj[e.j];
            const depth = Math.max(0, Math.min(1, (e.z + 1.1) / 2.2));
            c.strokeStyle = depth > 0.55 ? '#ffffff' : acc;
            c.globalAlpha = 0.25 + 0.72 * depth;
            c.lineWidth = 1.2 + 1.6 * depth;
            c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
          }
          c.globalAlpha = 1;

          for (const p of proj) {
            const depth = Math.max(0, Math.min(1, (p.z + 1.1) / 2.2));
            c.fillStyle = depth > 0.5 ? '#fff' : acc;
            c.beginPath(); c.arc(p.x, p.y, 2.5 + 2.5 * depth, 0, Math.PI * 2); c.fill();
          }
        }, localClean);

        loop = createAnimLoop((_now, dt) => {
          if (!autoSpin || !full()) return false;
          rotY += dt * 0.65;
          rotX += dt * 0.25;
          cvCtrl.render();
          return true;
        }, localClean);
        if (autoSpin && full()) loop.start();

        let drag = null;
        const onDown = e => { drag = { x: e.clientX, y: e.clientY }; };
        const onMove = e => {
          if (!drag) return;
          rotY += (e.clientX - drag.x) * 0.012;
          rotX += (e.clientY - drag.y) * 0.012;
          drag = { x: e.clientX, y: e.clientY };
          cvCtrl.render();
        };
        const onUp = () => { drag = null; };
        cv.addEventListener('pointerdown', onDown);
        cv.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        localClean.add(() => {
          cv.removeEventListener('pointerdown', onDown);
          cv.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        });
      }

      host.querySelector('[data-pspin]')?.addEventListener('click', () => {
        autoSpin = !autoSpin;
        if (autoSpin && full()) loop?.start(); else loop?.stop();
        render();
      });
    } else {
      host.querySelectorAll('[data-es]').forEach(b => {
        b.onclick = () => { shapeIdx = +b.dataset.es; shapeRotStep = 0; shapeFlipped = false; render(); };
      });
      host.querySelectorAll('[data-dact]').forEach(b => {
        b.onclick = () => {
          const sh = EVERYDAY_SHAPES[shapeIdx];
          const n = Number.isFinite(sh.rotations) ? sh.rotations : 12;
          if (b.dataset.dact === 'rot') shapeRotStep = (shapeRotStep + 1) % n;
          else if (b.dataset.dact === 'flip') shapeFlipped = !shapeFlipped;
          else { shapeRotStep = 0; shapeFlipped = false; }
          render();
        };
      });
      host.querySelector('[data-jump-sh]')?.addEventListener('click', () => {
        const sp = EVERYDAY_SHAPES[shapeIdx].spec;
        if (sp) ctx?.jumpTo?.('simetri', sp);
      });
      host.querySelector('[data-jump-a5]')?.addEventListener('click', () => {
        ctx?.jumpTo?.('basit-sylow', { kind: 'A', n: 5 });
      });

      const cv = host.querySelector('[data-day-cv]');
      if (cv) {
        const sh = EVERYDAY_SHAPES[shapeIdx];
        setupCanvas(cv, cw => Math.min(250, Math.max(195, cw * 0.65)), (c, W, H) => {
          c.clearRect(0, 0, W, H);
          const acc = accentColor();
          const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.34;
          const nRot = Number.isFinite(sh.rotations) ? sh.rotations : 12;
          const ang = (shapeRotStep / nRot) * Math.PI * 2;

          c.save();
          c.translate(cx, cy);
          c.rotate(-ang);
          if (shapeFlipped) c.scale(-1, 1);

          c.strokeStyle = '#fff';
          c.fillStyle = 'rgba(255,255,255,0.06)';
          c.lineWidth = 2.2;

          if (sh.id === 'circle') {
            c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill(); c.stroke();
            c.strokeStyle = acc; c.beginPath(); c.moveTo(0, 0); c.lineTo(R, 0); c.stroke();
          } else if (sh.id === 'rect') {
            const rx = R * 1.1, ry = R * 0.65;
            c.beginPath(); c.rect(-rx, -ry, 2 * rx, 2 * ry); c.fill(); c.stroke();
            const pts = [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]];
            pts.forEach((p, i) => {
              c.fillStyle = i === 0 ? acc : '#fff';
              c.beginPath(); c.arc(p[0], p[1], 5, 0, Math.PI * 2); c.fill();
            });
          } else if (sh.id === 'pinwheel') {
            for (let k = 0; k < 4; k++) {
              const a0 = (k * Math.PI) / 2;
              c.save(); c.rotate(a0);
              c.fillStyle = k === 0 ? acc : 'rgba(96,165,250,0.65)';
              c.beginPath(); c.moveTo(0, 0); c.lineTo(R, 0); c.lineTo(R * 0.55, -R * 0.42); c.closePath();
              c.fill(); c.stroke();
              c.restore();
            }
          } else {
            const sides = sh.id === 'tri' ? 3 : sh.id === 'sq' ? 4 : 5;
            const pts = Array.from({ length: sides }, (_, k) => {
              const a = -Math.PI / 2 + (k * 2 * Math.PI) / sides;
              return [Math.cos(a) * R, Math.sin(a) * R];
            });
            c.beginPath();
            pts.forEach((p, i) => { if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); });
            c.closePath(); c.fill(); c.stroke();
            pts.forEach((p, i) => {
              c.fillStyle = i === 0 ? acc : '#f4f4f5';
              c.beginPath(); c.arc(p[0], p[1], 5.5, 0, Math.PI * 2); c.fill();
            });
          }
          c.restore();
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
// TAB 12: HURWİTZ CEBİRLERİ, OKTONİYONLAR & ALBERT CEBİRİ (§12.1, §12.2)
// =====================================================================
export function mountHurwitz(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let mode = 'fano'; // 'fano' | 'calc' | 'albert'
  let pickA = 1;
  let pickB = 2;

  // Associator calculator state
  let algDim = 8; // 2 (C), 4 (H), 8 (O)
  let vecX = [0, 1, 0, 0, 0, 0, 0, 0]; // e_1
  let vecY = [0, 0, 1, 0, 0, 0, 0, 0]; // e_2
  let vecZ = [0, 0, 0, 0, 1, 0, 0, 0]; // e_4 (non-associative with e1, e2!)

  // Albert algebra J3(O) state
  let albSeed = 1;
  const makeAlbertPair = seed => {
    let s = (seed * 2654435761) >>> 0;
    const rnd = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return Math.round(((s / 4294967296) * 4 - 2) * 2) / 2;
    };
    const rO = () => Array.from({ length: 8 }, rnd);
    return {
      A: jordan3Create(1.5, -0.5, 1.0, rO(), rO(), rO()),
      B: jordan3Create(-1.0, 2.0, 0.5, rO(), rO(), rO()),
    };
  };
  let albertPair = makeAlbertPair(albSeed);

  const octTbl = octonionMulTable();

  const fmtCdVec = v => {
    const names = v.length === 2 ? ['1', 'i']
      : v.length === 4 ? ['1', 'i', 'j', 'k']
      : ['1', 'e₁', 'e₂', 'e₃', 'e₄', 'e₅', 'e₆', 'e₇'];
    const parts = [];
    v.forEach((x, idx) => {
      if (Math.abs(x) < 1e-9) return;
      const sgn = x < 0 ? '−' : (parts.length ? '+' : '');
      const mag = Math.abs(x);
      const num = (idx === 0 || Math.abs(mag - 1) > 1e-9) ? fmtNum(mag, 2) : '';
      parts.push(`${sgn}${num}${idx === 0 ? '' : names[idx]}`);
    });
    return parts.length ? parts.join(' ') : '0';
  };

  const renderFanoSvg = () => {
    const S = 132, cx = 180, cy = 190;
    const pt = k => ({ x: cx + FANO_LAYOUT[k].x * S, y: cy + FANO_LAYOUT[k].y * S });
    const prod = octTbl[pickA][pickB];
    const activeTriple = pickA !== pickB ? FANO_TRIPLES.find(t => t.includes(pickA) && t.includes(pickB)) : null;

    // 6 straight lines (indices 1..6 in FANO_TRIPLES) + 1 incircle (index 0: [1,2,3])
    const linesSvg = FANO_TRIPLES.slice(1).map(tr => {
      const p0 = pt(tr[0]), p2 = pt(tr[2]);
      const hi = activeTriple === tr;
      return `<line class="phy-fano-line ${hi ? 'hi' : ''}" x1="${p0.x.toFixed(1)}" y1="${p0.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`;
    }).join('');
    const incircleHi = activeTriple === FANO_TRIPLES[0];
    const incircleSvg = `<circle class="phy-fano-line ${incircleHi ? 'hi' : ''}" cx="${cx}" cy="${cy}" r="${(S * 0.5).toFixed(1)}"/>`;

    // Orientation arrows along each of the 6 straight triples and incircle
    const arrowsSvg = FANO_TRIPLES.slice(1).map(tr => {
      const p0 = pt(tr[0]), p1 = pt(tr[1]);
      const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
      const hi = activeTriple === tr;
      return `<path d="M-5,-4 L5,0 L-5,4 Z" fill="${hi ? 'var(--acc)' : 'rgba(255,255,255,0.45)'}" transform="translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${ang.toFixed(1)})"/>`;
    }).join('');
    // Clockwise arrow on top of incircle (between 1 and 2, angle -90 deg -> pointing right +x)
    const circleArrow = `<path d="M-5,-4 L5,0 L-5,4 Z" fill="${incircleHi ? 'var(--acc)' : 'rgba(255,255,255,0.45)'}" transform="translate(${cx},${(cy - S * 0.5).toFixed(1)})"/>`;

    const nodesSvg = [1, 2, 3, 4, 5, 6, 7].map(k => {
      const p = pt(k);
      const cls = ['phy-fano-node'];
      if (k === pickA) cls.push('pick-a');
      else if (k === pickB) cls.push('pick-b');
      else if (pickA !== pickB && k === prod.index) cls.push('pick-c');
      return `<g class="${cls.join(' ')}" data-fano="${k}" role="button" tabindex="0" aria-label="Oktoniyon birimi e${k}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="20"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4.5).toFixed(1)}" text-anchor="middle">e${k}</text>
      </g>`;
    }).join('');

    return `<svg class="phy-fano-svg" viewBox="0 0 360 320" role="img" aria-label="Oktoniyon çarpımı için Fano düzlemi">
      ${incircleSvg}
      ${linesSvg}
      ${arrowsSvg}
      ${circleArrow}
      ${nodesSvg}
    </svg>`;
  };

  const render = () => {
    let bodyHtml = '';

    if (mode === 'fano') {
      const prod = octTbl[pickA][pickB];
      const rev = octTbl[pickB][pickA];
      // Live sedenion zero-divisor check (dim 16)
      const s1 = new Array(16).fill(0); s1[3] = 1; s1[10] = 1;
      const s2 = new Array(16).fill(0); s2[6] = 1; s2[15] = -1;
      const sedNorm = cdNorm(cdMul(s1, s2));

      bodyHtml = `<div class="phy-stage">
        <div class="phy-grid-2">
          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">Fano Düzlemi & Oktoniyon Çarpımı</h3>
              <span class="grp-pill acc">Aut(𝕆) = G₂ (dim 14)</span>
            </div>
            <div class="phy-fano-wrap">${renderFanoSvg()}</div>
            <div class="grp-callout ok">
              <span>${tex(`e_${pickA} \\cdot e_${pickB} = ${prod.label}`)} &nbsp;·&nbsp; ${tex(`e_${pickB} \\cdot e_${pickA} = ${rev.label}`)}</span>
              <span class="grp-pill">1. seç: e${pickA} · 2. seç: e${pickB}</span>
            </div>
            <div class="grp-elems">
              <span class="small mute">1. çarpan:</span>
              ${[1, 2, 3, 4, 5, 6, 7].map(k => `<button type="button" class="grp-el ${k === pickA ? 'on' : ''}" data-pa="${k}">e${k}</button>`).join('')}
            </div>
            <div class="grp-elems">
              <span class="small mute">2. çarpan:</span>
              ${[1, 2, 3, 4, 5, 6, 7].map(k => `<button type="button" class="grp-el ${k === pickB ? 'on' : ''}" data-pb="${k}">e${k}</button>`).join('')}
            </div>
          </div>

          <div class="grp-panel">
            <div class="grp-panel-head">
              <h3 class="grp-panel-title">8×8 Cayley–Dickson Oktoniyon Tablosu</h3>
              <span class="grp-pill">e₁,e₂,e₃ ≅ ℍ (i·j=k)</span>
            </div>
            <div class="phy-mat-wrap">
              <table class="phy-mat" aria-label="Oktoniyon birim çarpım tablosu">
                <thead><tr><th>·</th>${[0, 1, 2, 3, 4, 5, 6, 7].map(j => `<th>${j === 0 ? '1' : `e${j}`}</th>`).join('')}</tr></thead>
                <tbody>
                  ${octTbl.map((row, i) => `<tr>
                    <th>${i === 0 ? '1' : `e${i}`}</th>
                    ${row.map((cell, j) => {
                      const active = i === pickA && j === pickB;
                      const cls = active ? 'phy-nz' : cell.sign < 0 ? 'phy-neg' : '';
                      return `<td class="${cls}" ${i > 0 && j > 0 ? `data-oct="${i}:${j}" style="cursor:pointer"` : ''}>${esc(cell.label.replace('_', ''))}</td>`;
                    }).join('')}
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div class="grp-callout">
              <span class="small"><b>Hurwitz Teoremi (1898):</b> Normlu bölme cebirleri yalnızca <b>1, 2, 4, 8</b> boyutlarında vardır. 16 boyutlu sedeniyonlarda sıfır bölenler doğar: ${tex('\\|(e_3+e_{10})(e_6-e_{15})\\| = ' + sedNorm.toFixed(1))}!</span>
            </div>
          </div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head"><h3 class="grp-panel-title">Cayley–Dickson Merdiveni (ℝ → ℂ → ℍ → 𝕆)</h3></div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Dört Hurwitz bölme cebiri karşılaştırması">
              <thead><tr><th>Cebir</th><th>dim</th><th>Sıralı</th><th>Değişmeli</th><th>Birleşmeli</th><th>Alternatif</th><th>Der(𝕂)</th><th>dim J₃(𝕂)</th><th>Aut(J₃(𝕂))</th></tr></thead>
              <tbody>
                ${HURWITZ_ALGEBRAS.map(h => `<tr>
                  <td><b>${esc(h.sym)}</b> ${esc(h.name)}</td>
                  <td class="mono">${h.dim}</td>
                  <td>${h.ordered ? '✓' : '✗'}</td>
                  <td>${h.commutative ? '✓' : '✗'}</td>
                  <td>${h.associative ? '✓' : '✗'}</td>
                  <td>${h.alternative ? '✓' : '✗'}</td>
                  <td class="mono">${esc(h.der)} (${h.derDim})</td>
                  <td class="mono"><b>${h.j3Dim}</b></td>
                  <td class="mono">${esc(h.j3Der)} (${h.j3DerDim})</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    } else if (mode === 'calc') {
      const x = vecX.slice(0, algDim);
      const y = vecY.slice(0, algDim);
      const z = vecZ.slice(0, algDim);
      const xy = cdMul(x, y);
      const comm = cdCommutator(x, y);
      const assoc = cdAssociator(x, y, z);
      const altL = cdAssociator(x, x, y);
      const altR = cdAssociator(y, x, x);
      const normProd = cdNorm(xy);
      const prodNorm = cdNorm(x) * cdNorm(y);
      const normErr = Math.abs(normProd - prodNorm);
      const basisNames = algDim === 2 ? ['1', 'i'] : algDim === 4 ? ['1', 'i', 'j', 'k'] : ['1', 'e₁', 'e₂', 'e₃', 'e₄', 'e₅', 'e₆', 'e₇'];

      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-toolbar">
            <div class="grp-toolbar-g">
              ${[[2, 'ℂ (dim 2)'], [4, 'ℍ Kuaterniyon (dim 4)'], [8, '𝕆 Oktoniyon (dim 8)']].map(([d, l]) =>
                `<button type="button" class="grp-chip ${d === algDim ? 'on' : ''}" data-adim="${d}">${esc(l)}</button>`
              ).join('')}
            </div>
            <div class="grp-toolbar-g">
              <button type="button" class="btn small" data-cd-pre="ijk">Kuaterniyon i, j, k</button>
              <button type="button" class="btn small" data-cd-pre="nonassoc">Birleşmesiz e₁, e₂, e₄</button>
              <button type="button" class="btn small ghost" data-cd-pre="rand">Rastgele</button>
            </div>
          </div>

          <div class="phy-stage">
            <div>
              <div class="small mute" style="margin-bottom:4px">x = ${esc(fmtCdVec(x))}</div>
              <div class="phy-num-grid">${x.map((v, i) => `<label class="phy-num-cell">${basisNames[i]}<input type="number" step="1" data-cd="x:${i}" value="${v}" aria-label="x ${basisNames[i]} bileşeni"></label>`).join('')}</div>
            </div>
            <div>
              <div class="small mute" style="margin-bottom:4px">y = ${esc(fmtCdVec(y))}</div>
              <div class="phy-num-grid">${y.map((v, i) => `<label class="phy-num-cell">${basisNames[i]}<input type="number" step="1" data-cd="y:${i}" value="${v}" aria-label="y ${basisNames[i]} bileşeni"></label>`).join('')}</div>
            </div>
            <div>
              <div class="small mute" style="margin-bottom:4px">z = ${esc(fmtCdVec(z))}</div>
              <div class="phy-num-grid">${z.map((v, i) => `<label class="phy-num-cell">${basisNames[i]}<input type="number" step="1" data-cd="z:${i}" value="${v}" aria-label="z ${basisNames[i]} bileşeni"></label>`).join('')}</div>
            </div>
          </div>

          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Çarpım x · y</span><span class="grp-kpi-val mono">${esc(fmtCdVec(xy))}</span><span class="grp-kpi-sub">||xy|| = ${normProd.toFixed(3)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Norm Çarpımsallığı</span><span class="grp-kpi-val mono">${normErr < 1e-10 ? 'Sağlandı ✓' : 'Bozuk'}</span><span class="grp-kpi-sub">||x||·||y|| = ${prodNorm.toFixed(3)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Komütatör [x, y]</span><span class="grp-kpi-val mono">${esc(fmtCdVec(comm))}</span><span class="grp-kpi-sub">${cdNorm(comm) < 1e-9 ? 'Değişiyor (= 0)' : 'Değişmiyor (≠ 0)'}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Birleştirici [x, y, z]</span><span class="grp-kpi-val mono">${esc(fmtCdVec(assoc))}</span><span class="grp-kpi-sub">${cdNorm(assoc) < 1e-9 ? 'Birleşmeli (= 0)' : 'Birleşmesiz! (≠ 0)'}</span></div>
          </div>

          <div class="grp-callout ok">
            <span class="small"><b>Alternatifsellik Kontrolü:</b> ${tex('\\|[x,x,y]\\| = ' + cdNorm(altL).toExponential(1))}, ${tex('\\|[y,x,x]\\| = ' + cdNorm(altR).toExponential(1))} — her iki ifade de tam sıfır ✓ (Oktoniyonlar birleşmeli olmasa da alternatiftir!)</span>
          </div>
        </div>
      </div>`;
    } else {
      const { A, B } = albertPair;
      const AoB = jordan3Product(A, B);
      const BoA = jordan3Product(B, A);
      const A2 = jordan3Product(A, A);
      const lhs = jordan3Product(AoB, A2);
      const rhs = jordan3Product(A, jordan3Product(B, A2));
      const commDiff = jordan3MaxDiff(AoB, BoA);
      const jordDiff = jordan3MaxDiff(lhs, rhs);
      const detA = freudenthalDet(A);
      const detB = freudenthalDet(B);

      bodyHtml = `<div class="phy-stage">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">İstisnai Albert Cebiri J₃(𝕆) = H₃(𝕆) (Boyut 27, §12.2)</h3>
            <button type="button" class="btn small primary" data-alb-rnd>${icon('rotate')} Yeni Rastgele A, B ∈ J₃(𝕆)</button>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">dim J₃(𝕆)</span><span class="grp-kpi-val mono">${hermitian3Dim(8)}</span><span class="grp-kpi-sub">3 reel + 3×8 oktoniyon</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Hermisyenlik A∘B</span><span class="grp-kpi-val">${jordan3IsHermitian(AoB) ? 'Doğrulandı ✓' : 'Hata'}</span><span class="grp-kpi-sub">(A∘B)† = A∘B</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Değişmelilik</span><span class="grp-kpi-val">${commDiff < 1e-10 ? 'A∘B = B∘A ✓' : 'Hata'}</span><span class="grp-kpi-sub">hata ${commDiff.toExponential(1)}</span></div>
            <div class="grp-kpi"><span class="grp-kpi-lbl">Jordan Özdeşliği</span><span class="grp-kpi-val">${jordDiff < 1e-9 ? 'Sağlandı ✓' : 'Hata'}</span><span class="grp-kpi-sub">||(A∘B)∘A² − A∘(B∘A²)|| = ${jordDiff.toExponential(1)}</span></div>
          </div>
          <div class="grp-math-box">${tex('A = \\begin{pmatrix} d_1 & x_3 & \\bar{x}_2 \\\\ \\bar{x}_3 & d_2 & x_1 \\\\ x_2 & \\bar{x}_1 & d_3 \\end{pmatrix},\\quad A\\circ B = \\frac{1}{2}(AB + BA),\\quad \\det(A) = d_1 d_2 d_3 + 2\\operatorname{Re}(x_1 x_2 x_3) - \\sum_{i=1}^3 d_i|x_i|^2')}</div>
          <div class="phy-scroll">
            <table class="grp-tbl" aria-label="Hurwitz 3x3 Hermisyen matris cebirleri">
              <thead><tr><th>Cebir H₃(𝕂)</th><th>dim 𝕂</th><th>dim H₃(𝕂) = 3 + 3 dim 𝕂</th><th>Otomorfizma Grubu Aut</th></tr></thead>
              <tbody>
                ${HURWITZ_ALGEBRAS.map(h => `<tr class="${h.key === 'O' ? 'on' : ''}">
                  <td><b>H₃(${esc(h.sym)})</b> — ${esc(h.name)}</td>
                  <td class="mono">${h.dim}</td>
                  <td class="mono"><b>${hermitian3Dim(h.dim)}</b></td>
                  <td class="mono">${esc(h.j3Der)} (dim ${h.j3DerDim})</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="grp-callout">
            <span class="small">Mevcut matrisler için Freudenthal kübik determinantı (${tex('E_6')} değişmezi): <b>det(A) = ${detA.toFixed(3)}</b> · <b>det(B) = ${detB.toFixed(3)}</b></span>
            <button type="button" class="btn small ghost" data-jump-ms>${icon('chart')} Sihirli Karede F₄ & E₆ →</button>
          </div>
        </div>
      </div>`;
    }

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-toolbar">
        <div class="seg" data-hw-mode role="tablist" aria-label="Hurwitz cebirleri modülleri">
          <button type="button" data-m="fano" class="${mode === 'fano' ? 'on' : ''}">Fano & Oktoniyon (§12.1)</button>
          <button type="button" data-m="calc" class="${mode === 'calc' ? 'on' : ''}">Birleştirici Hesaplayıcı</button>
          <button type="button" data-m="albert" class="${mode === 'albert' ? 'on' : ''}">Albert Cebiri J₃(𝕆) (§12.2)</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;

    host.querySelector('[data-hw-mode]')?.addEventListener('click', e => {
      const b = e.target.closest?.('[data-m]');
      if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m;
      render();
    });

    if (mode === 'fano') {
      host.querySelectorAll('[data-fano]').forEach(el => {
        const selectUnit = () => {
          const u = +el.dataset.fano;
          pickA = pickB;
          pickB = u;
          render();
        };
        el.onclick = selectUnit;
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectUnit(); } };
      });
      host.querySelectorAll('[data-pa]').forEach(b => { b.onclick = () => { pickA = +b.dataset.pa; render(); }; });
      host.querySelectorAll('[data-pb]').forEach(b => { b.onclick = () => { pickB = +b.dataset.pb; render(); }; });
      host.querySelectorAll('[data-oct]').forEach(td => {
        td.onclick = () => {
          const [a, b] = td.dataset.oct.split(':').map(Number);
          pickA = a; pickB = b; render();
        };
      });
    } else if (mode === 'calc') {
      host.querySelectorAll('[data-adim]').forEach(b => { b.onclick = () => { algDim = +b.dataset.adim; render(); }; });
      host.querySelectorAll('[data-cd]').forEach(inp => {
        inp.onchange = () => {
          const [which, idx] = inp.dataset.cd.split(':');
          const v = Number(inp.value);
          if (!Number.isFinite(v)) return;
          if (which === 'x') vecX[+idx] = v;
          else if (which === 'y') vecY[+idx] = v;
          else vecZ[+idx] = v;
          render();
        };
      });
      host.querySelectorAll('[data-cd-pre]').forEach(b => {
        b.onclick = () => {
          const p = b.dataset.cdPre;
          if (p === 'ijk') {
            algDim = 4;
            vecX = [0, 1, 0, 0, 0, 0, 0, 0];
            vecY = [0, 0, 1, 0, 0, 0, 0, 0];
            vecZ = [0, 0, 0, 1, 0, 0, 0, 0];
          } else if (p === 'nonassoc') {
            algDim = 8;
            vecX = [0, 1, 0, 0, 0, 0, 0, 0];
            vecY = [0, 0, 1, 0, 0, 0, 0, 0];
            vecZ = [0, 0, 0, 0, 1, 0, 0, 0];
          } else {
            const r = () => Math.floor(Math.random() * 5) - 2;
            vecX = Array.from({ length: 8 }, r);
            vecY = Array.from({ length: 8 }, r);
            vecZ = Array.from({ length: 8 }, r);
            if (cdNorm2(vecX.slice(0, algDim)) === 0) vecX[1] = 1;
          }
          render();
        };
      });
    } else {
      host.querySelector('[data-alb-rnd]')?.addEventListener('click', () => {
        albSeed++;
        albertPair = makeAlbertPair(albSeed);
        render();
      });
      host.querySelector('[data-jump-ms]')?.addEventListener('click', () => ctx?.jumpTo?.('sihirli-kare'));
    }

    syncSegments(host, true);
  };

  render();
  return clean.run;
}

// =====================================================================
// TAB 13: FREUDENTHAL–TİTS SİHİRLİ KARESİ (§12.3)
// =====================================================================
export function mountMagicSquare(host, _G, ctx) {
  ensurePhysCss();
  const clean = createClean(ctx);

  let selR = 3; // O
  let selC = 3; // O -> E_8 (dim 248)

  const BB = { R: '\\mathbb{R}', C: '\\mathbb{C}', H: '\\mathbb{H}', O: '\\mathbb{O}' };

  const render = () => {
    const cell = MAGIC_SQUARE[selR][selC];
    const df = cell.dimFormula;
    const rowTex = BB[cell.rowKey];
    const colTex = BB[cell.colKey];

    host.innerHTML = `<div class="phy-stage">
      <div class="phy-side">
        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Freudenthal–Tits Sihirli Karesi (ℝ, ℂ, ℍ, 𝕆)</h3>
            <span class="grp-pill acc">Simetrik: m(A,B) ≅ m(B,A)</span>
          </div>
          <div class="phy-scroll">
            <div class="phy-magic-grid" role="grid" aria-label="Freudenthal-Tits Sihirli Karesi">
              <div class="phy-magic-head"><span>m(A,B)</span><small>A ╲ B</small></div>
              ${HURWITZ_ALGEBRAS.map(h => `<div class="phy-magic-head"><span>${esc(h.sym)}</span><small>dim ${h.dim}</small></div>`).join('')}

              ${MAGIC_SQUARE.map((row, r) => {
                const h = HURWITZ_ALGEBRAS[r];
                return `<div class="phy-magic-head"><span>${esc(h.sym)}</span><small>dim ${h.dim}</small></div>` +
                  row.map((c, col) => {
                    const cls = ['phy-magic-cell'];
                    if (c.exceptional) cls.push('exc');
                    if (r === selR && col === selC) cls.push('on');
                    else if (r === selC && col === selR) cls.push('sym');
                    return `<button type="button" class="${cls.join(' ')}" data-ms="${r}:${col}" aria-label="${esc(`${c.rowSym}, ${c.colSym}: ${c.classical}, boyut ${c.dim}`)}">
                      <span class="phy-magic-sym">${tex(c.cartan)}</span>
                      <span class="phy-magic-dim">dim ${c.dim}</span>
                    </button>`;
                  }).join('');
              }).join('')}
            </div>
          </div>
          <div class="small mute">Parlak çerçeve: istisnai cebirler (<b>F₄, E₆, E₇, E₈</b>). Kesikli çerçeve: simetrik eşlenik (${esc(MAGIC_SQUARE_LABELS[selC])}, ${esc(MAGIC_SQUARE_LABELS[selR])}).</div>
        </div>

        <div class="grp-panel">
          <div class="grp-panel-head">
            <h3 class="grp-panel-title">Seçili Girdi: (${esc(cell.rowSym)}, ${esc(cell.colSym)})</h3>
            <span class="grp-pill ${cell.exceptional ? 'acc' : ''}">${cell.exceptional ? 'İstisnai Lie Cebiri ✦' : 'Klasik Lie Cebiri'}</span>
          </div>
          <div class="grp-kpis">
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Cartan / Klasik</span><span class="grp-kpi-val">${tex(cell.cartan)}</span><span class="grp-kpi-sub">${esc(cell.classical)}</span></div>
            <div class="grp-kpi acc"><span class="grp-kpi-lbl">Boyut</span><span class="grp-kpi-val mono">${cell.dim} ${cell.dimCheck ? '✓' : ''}</span><span class="grp-kpi-sub">rank ${cell.rank} + ${cell.roots} kök</span></div>
          </div>

          <div class="grp-math-box">
            <div class="small mute" style="margin-bottom:4px">1. Barton–Sudbery Üçlülük (Triality) Formülü</div>
            ${tex(`\\dim\\mathfrak{m}(${rowTex},${colTex}) = \\dim\\mathfrak{tri}(${rowTex}) + \\dim\\mathfrak{tri}(${colTex}) + 3\\dim(${rowTex})\\dim(${colTex})`)}
            <div class="mono" style="margin-top:6px"><b>${df.triTerms[0]} + ${df.triTerms[1]} + ${df.triTerms[2]} = ${df.bartonSudbery}</b></div>
          </div>

          <div class="grp-math-box">
            <div class="small mute" style="margin-bottom:4px">2. Tits Jordan–Türev Kurulumu</div>
            ${tex(`\\dim\\mathcal{L}(${rowTex}, J_3(${colTex})) = \\dim\\operatorname{Der}(${rowTex}) + (\\dim ${rowTex}-1)(3\\dim ${colTex}+2) + \\dim\\operatorname{Der}(J_3(${colTex}))`)}
            <div class="mono" style="margin-top:6px"><b>${df.titsTerms[0]} + ${df.titsTerms[1]} + ${df.titsTerms[2]} = ${df.tits}</b> ${df.formulasMatch ? '✓' : '✗'}</div>
          </div>

          <div class="grp-callout">
            <span class="small"><b>Fizik & Geometri:</b> ${esc(cell.role)}</span>
          </div>

          <div class="grp-toolbar-g">
            <button type="button" class="btn small ghost" data-jump="hurwitz-cebirleri">${icon('flame')} Hurwitz & J₃(𝕆) →</button>
            <button type="button" class="btn small ghost" data-jump="dynkin-sinif">${icon('grid')} Dynkin Diyagramları →</button>
            <button type="button" class="btn small ghost" data-jump="buyuk-birlesme">${icon('side')} E₆ Büyük Birleşme →</button>
          </div>
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-ms]').forEach(b => {
      b.onclick = () => {
        const [r, c] = b.dataset.ms.split(':').map(Number);
        selR = r; selC = c; render();
      };
    });
    host.querySelectorAll('[data-jump]').forEach(b => { b.onclick = () => ctx?.jumpTo?.(b.dataset.jump); });
  };

  render();
  return clean.run;
}
