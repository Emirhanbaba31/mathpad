// Interactive visual models (18 models) for FZT 203E Group Theory Problem Sets.
// Lazily imported by js/gtps-tabs.js. Three.js is imported lazily ONLY inside cube & molecule models.
import { esc, icon } from './ui.js';
import { tex, richTex, setupCanvas, createAnimLoop, createClean, accentColor, fmtNum } from './phys-ui.js';
import { motion, asleep } from './fx.js';
import {
  dEl, dMul, dInv, dName, dParse, mod, gcd, lcm,
  permId, permOrder, permSign, cyclesString,
} from './gtps-kit.js';
import {
  polygonVertices, polygonState, tokenizeDWord,
  cyclicStarData, subgroupLatticeData, cosetsData, homData,
  torusOrbitData, wheelStrobeData, brillouinData, shuffleData,
  puzzle15Data, puzzle15Move,
  CUBE_DIAGS, CUBE_OPS, cubeAnalyze, cubeMul3,
  MOLECULE_DEFS, moleculeData, moleculePermOfMatrix, applyMat3,
  velocityData, PITCH_NAMES, musicApply, musicData,
  orbitsData, lightsSystem, pauliGroupData, cayleyModelData,
} from './gtps-ui.js';

let threePromise = null;
const loadThree = () => (threePromise ??= import('../vendor/three.mjs'));

const PALETTE = [
  '#60a5fa', '#f472b6', '#34d399', '#fbbf24',
  '#a78bfa', '#fb7185', '#22d3ee', '#f97316',
  '#4ade80', '#e879f9', '#38bdf8', '#facc15',
];

function colorAt(i) {
  return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

function easeOutCubic(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function drawRoundRect(c2d, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c2d.beginPath();
  c2d.moveTo(x + rr, y);
  c2d.arcTo(x + w, y, x + w, y + h, rr);
  c2d.arcTo(x + w, y + h, x, y + h, rr);
  c2d.arcTo(x, y + h, x, y, rr);
  c2d.arcTo(x, y, x + w, y, rr);
  c2d.closePath();
}

function kpiStrip(items) {
  return `<div class="gp-mkpis">${items.map(it => `<div class="gp-mkpi${it.acc ? ' acc' : ''}">
    <span class="gp-mkpi-lbl">${esc(it.label)}</span>
    <span class="gp-mkpi-val${it.mono ? ' mono' : ''}">${it.html ?? esc(it.val)}</span>
    ${it.sub ? `<span class="gp-mkpi-sub">${it.subHtml ?? esc(it.sub)}</span>` : ''}
  </div>`).join('')}</div>`;
}

// =====================================================================
// 1. polygon — Regular n-gon D_n explorer (course conventions)
// =====================================================================

function mountPolygon(host, params, ctx) {
  const clean = createClean(ctx);
  const n = Math.max(3, Math.min(12, Math.trunc(params.n || 4)));
  const initialWord = params.word ? String(params.word).trim() : '';

  let curEl = dEl(n, 0, 0);
  let history = [];
  let wordStr = initialWord;
  let wordSteps = [];
  let wordIdx = 0;
  let wordPlaying = false;
  let wordTimer = 0;

  // Smooth vertex animation state
  const verts = polygonVertices(n);
  let fromCoords = verts.map(v => ({ x: v.x, y: v.y }));
  let toCoords = verts.map(v => ({ x: v.x, y: v.y }));
  let animT = 1;

  const coordsOfEl = el => {
    const perm = polygonState(n, el).perm;
    // Vertex labeled v (1..n) now sits at position perm[v-1]
    return Array.from({ length: n }, (_, i) => {
      const targetPos = perm[i] - 1;
      return { x: verts[targetPos].x, y: verts[targetPos].y };
    });
  };

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Düzgün ${n}-gen · ${tex(`D_{${n}}`)} Simetri Gezgini</div>
      <div class="gp-model-sub">Konvansiyon: köşeler $1\\dots ${n}$ saat yönünün tersine; $r$ dönme, $s$ ise $1$. köşe ekseni; çarpım sağdan sola.</div>
    </div>
    <div class="gp-model-bar">
      <button type="button" class="btn small" data-op="r" aria-label="Saat yönünün tersine r dönmesi uygula">${icon('rotate')} r (+${Math.round(360 / n)}°)</button>
      <button type="button" class="btn small" data-op="rinv" aria-label="Saat yönünde ters dönme uygula">r⁻¹ (−${Math.round(360 / n)}°)</button>
      <button type="button" class="btn small" data-op="s" aria-label="1. köşe ekseninde s yansıması uygula">s (yansıt)</button>
      <button type="button" class="btn small ghost" data-op="reset" aria-label="Birim elemana sıfırla">Sıfırla (e)</button>
    </div>
    <div class="gp-model-bar">
      <label class="gp-inline-lbl" for="gp-poly-word">Kelime (sağdan sola):</label>
      <input id="gp-poly-word" type="text" class="inp gp-word-inp mono" value="${esc(wordStr)}" placeholder="örn. s r^2 s r" aria-label="Dihedral grup kelimesi">
      <button type="button" class="btn small" data-wstep aria-label="Kelimenin sonraki adımını uygula">Adım</button>
      <button type="button" class="btn small primary" data-wplay aria-label="Kelimeyi adım adım oynat">${icon('play')} Oynat</button>
      <button type="button" class="btn small ghost" data-wreset aria-label="Kelime animasyonunu başa al">Başa al</button>
    </div>
    <div class="gp-word-tokens" data-wtokens aria-live="polite"></div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="Düzgün ${n}-gen simetri çizimi"></canvas></div>
    <div data-kpis></div>
  </div>`;

  // Rich-tex subtitle
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kpiHost = host.querySelector('[data-kpis]');
  const tokHost = host.querySelector('[data-wtokens]');
  const wordInp = host.querySelector('#gp-poly-word');
  const playBtn = host.querySelector('[data-wplay]');

  const parseWordTokens = () => {
    try {
      wordSteps = tokenizeDWord(n, wordInp.value);
      return true;
    } catch (e) {
      wordSteps = [];
      tokHost.innerHTML = `<span class="gp-err">${esc(e.message)}</span>`;
      return false;
    }
  };

  const renderTokens = () => {
    if (!wordSteps.length) {
      tokHost.innerHTML = wordInp.value.trim()
        ? `<span class="gp-err">Geçersiz kelime: yalnızca r, s, e ve üsler kullanın.</span>`
        : `<span class="mute small">${richTex(`Bir $D_{${n}}$ kelimesi yazıp **Adım** veya **Oynat** ile sağdan sola uygulanışını izleyin.`)}</span>`;
      return;
    }
    // Display tokens in mathematical left-to-right order, while wordSteps[0] is the RIGHTMOST token!
    const total = wordSteps.length;
    const pills = wordSteps.slice().reverse().map((tok, dispIdx) => {
      const rtlIdx = total - 1 - dispIdx; // 0 = rightmost (applied first)
      const done = rtlIdx < wordIdx;
      const next = rtlIdx === wordIdx;
      return `<span class="gp-wtok${done ? ' done' : ''}${next ? ' next' : ''}">${tex(tok.tex)}</span>`;
    }).join('');
    tokHost.innerHTML = `<span class="mute small">Sağdan sola sıra (${wordIdx}/${total}):</span> <span class="gp-wtok-row">${pills}</span>`;
  };

  const updateInfo = () => {
    const st = polygonState(n, curEl);
    const histTxt = history.length ? history.slice(-6).reverse().join(' · ') : 'e';
    kpiHost.innerHTML = kpiStrip([
      { label: 'Normal Biçim', html: tex(st.tex), acc: true },
      { label: 'Konum Permütasyonu', val: st.cycles, mono: true },
      { label: 'Mertebe |g|', val: String(st.order), mono: true },
      { label: 'Sabit Köşeler', val: st.fixed.length ? st.fixed.join(', ') : 'Yok', mono: true },
      { label: 'Son İşlemler (sağ→sol)', val: histTxt, mono: true },
    ]);
    renderTokens();
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.34;
    const t = easeOutCubic(animT);
    const st = polygonState(n, curEl);

    // Subtle reference circle
    c2d.strokeStyle = 'rgba(255,255,255,0.08)';
    c2d.lineWidth = 1;
    c2d.beginPath();
    c2d.arc(cx, cy, R, 0, Math.PI * 2);
    c2d.stroke();

    // Base reflection axis s (through position 1, horizontal)
    c2d.save();
    c2d.setLineDash([5, 5]);
    c2d.strokeStyle = 'rgba(255,255,255,0.22)';
    c2d.lineWidth = 1.2;
    c2d.beginPath();
    c2d.moveTo(cx - R * 1.28, cy);
    c2d.lineTo(cx + R * 1.28, cy);
    c2d.stroke();
    c2d.fillStyle = 'rgba(255,255,255,0.45)';
    c2d.font = '11px ui-monospace, monospace';
    c2d.textAlign = 'right';
    c2d.fillText('s ekseni', cx + R * 1.32, cy - 6);
    c2d.restore();

    // Active reflection axis if curEl is a reflection r^k s
    if (st.isReflection && st.mirrorAngle !== null) {
      const ang = st.mirrorAngle;
      const dx = Math.cos(ang) * R * 1.26;
      const dy = -Math.sin(ang) * R * 1.26;
      c2d.save();
      c2d.setLineDash([7, 4]);
      c2d.strokeStyle = '#f472b6';
      c2d.lineWidth = 2;
      c2d.beginPath();
      c2d.moveTo(cx - dx, cy - dy);
      c2d.lineTo(cx + dx, cy + dy);
      c2d.stroke();
      c2d.restore();
    }

    // Fixed spatial position markers P1..Pn outside polygon
    c2d.save();
    c2d.font = '11px ui-monospace, monospace';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const px = cx + verts[i].x * (R + 26);
      const py = cy - verts[i].y * (R + 26);
      c2d.fillStyle = 'rgba(255,255,255,0.38)';
      c2d.fillText(`P${i + 1}`, px, py);
    }
    c2d.restore();

    // Interpolated polygon vertices
    const curPts = Array.from({ length: n }, (_, i) => ({
      x: cx + (fromCoords[i].x + (toCoords[i].x - fromCoords[i].x) * t) * R,
      y: cy - (fromCoords[i].y + (toCoords[i].y - fromCoords[i].y) * t) * R,
    }));

    // Polygon fill & stroke
    c2d.beginPath();
    curPts.forEach((pt, i) => (i === 0 ? c2d.moveTo(pt.x, pt.y) : c2d.lineTo(pt.x, pt.y)));
    c2d.closePath();
    c2d.fillStyle = st.isReflection ? 'rgba(244, 114, 182, 0.12)' : 'rgba(96, 165, 250, 0.12)';
    c2d.fill();
    c2d.strokeStyle = st.isReflection ? '#f472b6' : acc;
    c2d.lineWidth = 2.2;
    c2d.stroke();

    // Center badge
    c2d.fillStyle = 'rgba(255,255,255,0.75)';
    c2d.font = '600 13px ui-monospace, monospace';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    c2d.fillText(st.name, cx, cy);

    // Draw vertices 1..n
    for (let i = 0; i < n; i++) {
      const pt = curPts[i];
      const col = colorAt(i);
      const isFixed = st.fixed.includes(i + 1);
      c2d.beginPath();
      c2d.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
      c2d.fillStyle = '#090d16';
      c2d.fill();
      c2d.lineWidth = isFixed ? 3 : 2;
      c2d.strokeStyle = col;
      c2d.stroke();
      c2d.fillStyle = col;
      c2d.font = '700 12px ui-monospace, monospace';
      c2d.fillText(String(i + 1), pt.x, pt.y + 0.5);
    }
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(310, Math.max(230, cw * 0.62)), draw, clean);

  const animLoop = createAnimLoop((_now, dt) => {
    animT = Math.min(1, animT + dt / 0.24);
    canvasCtl.render();
    return animT < 1;
  }, clean);

  const transitionTo = (nextEl, label = null) => {
    const t = easeOutCubic(animT);
    fromCoords = fromCoords.map((p, i) => ({
      x: p.x + (toCoords[i].x - p.x) * t,
      y: p.y + (toCoords[i].y - p.y) * t,
    }));
    curEl = nextEl;
    if (label) history.push(label);
    toCoords = coordsOfEl(curEl);
    if (motion() === 'full') {
      animT = 0;
      animLoop.start();
    } else {
      animT = 1;
      canvasCtl.render();
    }
    updateInfo();
  };

  const stopWordPlay = () => {
    wordPlaying = false;
    if (wordTimer) { clearInterval(wordTimer); wordTimer = 0; }
    playBtn.innerHTML = `${icon('play')} Oynat`;
  };
  clean.add(stopWordPlay);

  const stepWord = () => {
    if (!parseWordTokens() || !wordSteps.length) { stopWordPlay(); return; }
    if (wordIdx >= wordSteps.length) {
      stopWordPlay();
      return;
    }
    const tok = wordSteps[wordIdx++];
    // Left-multiply curEl by tok.el because tok acts AFTER previously applied right-hand tokens!
    transitionTo(dMul(n, tok.el, curEl), tok.label);
    if (wordIdx >= wordSteps.length) stopWordPlay();
  };

  host.querySelectorAll('[data-op]').forEach(btn => {
    btn.onclick = () => {
      stopWordPlay();
      const op = btn.dataset.op;
      if (op === 'r') transitionTo(dMul(n, dEl(n, 1, 0), curEl), 'r');
      else if (op === 'rinv') transitionTo(dMul(n, dEl(n, -1, 0), curEl), 'r⁻¹');
      else if (op === 's') transitionTo(dMul(n, dEl(n, 0, 1), curEl), 's');
      else {
        history = [];
        wordIdx = 0;
        transitionTo(dEl(n, 0, 0), null);
      }
    };
  });

  wordInp.addEventListener('input', () => {
    stopWordPlay();
    wordIdx = 0;
    parseWordTokens();
    renderTokens();
  });

  host.querySelector('[data-wstep]').onclick = () => {
    stopWordPlay();
    if (wordIdx === 0) {
      history = [];
      transitionTo(dEl(n, 0, 0), null);
    }
    stepWord();
  };

  host.querySelector('[data-wreset]').onclick = () => {
    stopWordPlay();
    wordIdx = 0;
    history = [];
    transitionTo(dEl(n, 0, 0), null);
  };

  playBtn.onclick = () => {
    if (wordPlaying) { stopWordPlay(); return; }
    if (!parseWordTokens() || !wordSteps.length) return;
    if (wordIdx >= wordSteps.length || wordIdx === 0) {
      wordIdx = 0;
      history = [];
      transitionTo(dEl(n, 0, 0), null);
    }
    wordPlaying = true;
    playBtn.innerHTML = `${icon('pause')} Duraklat`;
    stepWord();
    if (wordPlaying) {
      wordTimer = setInterval(() => {
        if (asleep()) return;
        stepWord();
      }, motion() === 'full' ? 680 : 500);
    }
  };

  parseWordTokens();
  updateInfo();
  return clean.run;
}

// =====================================================================
// 2. cyclic — Z_n star polygon & generator explorer
// =====================================================================

function mountCyclic(host, params, ctx) {
  const clean = createClean(ctx);
  const n = Math.max(2, Math.min(36, Math.trunc(params.n || 12)));
  let k = mod(Math.trunc(params.k ?? 1), n);
  let data = cyclicStarData(n, k);
  let shownSteps = data.order;
  let playing = false;
  let playTimer = 0;

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Devirli Grup Çemberi · ${tex(`\\mathbb{Z}_{${n}}`)}</div>
      <div class="gp-model-sub">Çember üzerindeki bir noktaya tıklayarak veya kaydırıcıyla $k$ elemanını seçip $\\langle k \\rangle$ yıldız çokgenini inceleyin.</div>
    </div>
    <div class="gp-model-bar">
      <label class="gp-inline-lbl" for="gp-cyc-k">Eleman k = <b class="mono" data-kval>${k}</b></label>
      <input id="gp-cyc-k" type="range" class="gp-range" min="0" max="${n - 1}" value="${k}" aria-label="k elemanı seçici">
      <button type="button" class="btn small" data-step aria-label="Bir adım ilerlet">+k Adım</button>
      <button type="button" class="btn small primary" data-play aria-label="Oynat veya duraklat">${icon('play')} Oynat</button>
      <button type="button" class="btn small ghost" data-all aria-label="Tüm yıldızı göster">Tümü</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="Z_${n} çember ve yıldız çokgen çizimi"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kInp = host.querySelector('#gp-cyc-k');
  const kVal = host.querySelector('[data-kval]');
  const playBtn = host.querySelector('[data-play]');
  const kpiHost = host.querySelector('[data-kpis]');

  let nodePos = [];

  const updateInfo = () => {
    kVal.textContent = String(k);
    kInp.value = String(k);
    const genStr = data.generators.length <= 12
      ? data.generators.join(', ')
      : `${data.generators.slice(0, 10).join(', ')} … (${data.generators.length} adet)`;
    const subStr = data.subgroup.length <= 16
      ? `{${data.subgroup.join(', ')}}`
      : `{${data.subgroup.slice(0, 12).join(', ')}, …} (${data.order} eleman)`;
    kpiHost.innerHTML = kpiStrip([
      { label: 'Mertebe |k|', val: `${data.order}  (= ${n}/${data.gcd})`, mono: true, acc: true },
      { label: 'Üreteç mi?', val: data.isGenerator ? '★ Evet (gcd = 1)' : `Hayır (gcd = ${data.gcd})` },
      { label: `Alt Grup ⟨${k}⟩`, val: subStr, mono: true },
      { label: `Üreteçler (φ=${data.generators.length})`, val: genStr, mono: true },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.37;
    nodePos = [];

    c2d.strokeStyle = 'rgba(255,255,255,0.1)';
    c2d.lineWidth = 1.2;
    c2d.beginPath();
    c2d.arc(cx, cy, R, 0, Math.PI * 2);
    c2d.stroke();

    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      nodePos.push({ x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang });
    }

    // Draw star chords for sequence 0 -> k -> 2k -> ...
    const seq = data.sequence;
    const edgesToDraw = Math.min(shownSteps, seq.length);
    if (k !== 0 && edgesToDraw > 0) {
      c2d.save();
      c2d.strokeStyle = data.isGenerator ? '#34d399' : acc;
      c2d.lineWidth = 2.2;
      c2d.beginPath();
      for (let t = 0; t < edgesToDraw; t++) {
        const a = nodePos[seq[t]];
        const b = nodePos[seq[(t + 1) % seq.length]];
        c2d.moveTo(a.x, a.y);
        c2d.lineTo(b.x, b.y);
      }
      c2d.stroke();

      // Highlight latest arrow head
      const lastIdx = edgesToDraw - 1;
      const p0 = nodePos[seq[lastIdx]];
      const p1 = nodePos[seq[(lastIdx + 1) % seq.length]];
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const mx = p0.x + (p1.x - p0.x) * 0.58;
      const my = p0.y + (p1.y - p0.y) * 0.58;
      c2d.fillStyle = '#fbbf24';
      c2d.beginPath();
      c2d.moveTo(mx + Math.cos(ang) * 7, my + Math.sin(ang) * 7);
      c2d.lineTo(mx + Math.cos(ang + 2.5) * 6, my + Math.sin(ang + 2.5) * 6);
      c2d.lineTo(mx + Math.cos(ang - 2.5) * 6, my + Math.sin(ang - 2.5) * 6);
      c2d.closePath();
      c2d.fill();
      c2d.restore();
    }

    const inSub = new Set(seq.slice(0, Math.min(edgesToDraw + 1, seq.length)));
    const dotR = n <= 16 ? 12 : n <= 24 ? 9 : 7;

    for (let i = 0; i < n; i++) {
      const pt = nodePos[i];
      const active = inSub.has(i);
      const isK = i === k;
      const isZero = i === 0;
      c2d.beginPath();
      c2d.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
      c2d.fillStyle = isK ? acc : active ? 'rgba(96, 165, 250, 0.25)' : '#090d16';
      c2d.fill();
      c2d.lineWidth = isK || isZero ? 2.4 : 1.4;
      c2d.strokeStyle = isK ? '#fff' : isZero ? '#fbbf24' : active ? '#60a5fa' : 'rgba(255,255,255,0.22)';
      c2d.stroke();

      if (n <= 24 || i % 2 === 0 || isK || isZero) {
        c2d.fillStyle = isK ? '#000' : active ? '#f4f4f5' : 'rgba(255,255,255,0.52)';
        c2d.font = `${n <= 18 ? 11 : 9}px ui-monospace, monospace`;
        c2d.textAlign = 'center';
        c2d.textBaseline = 'middle';
        c2d.fillText(String(i), pt.x, pt.y + 0.5);
      }
    }

    c2d.fillStyle = 'rgba(255,255,255,0.75)';
    c2d.font = '600 13px ui-monospace, monospace';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    c2d.fillText(`⟨${k}⟩ · |${k}|=${data.order}`, cx, cy);
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(310, Math.max(230, cw * 0.64)), draw, clean);

  const stopPlay = () => {
    playing = false;
    if (playTimer) { clearInterval(playTimer); playTimer = 0; }
    playBtn.innerHTML = `${icon('play')} Oynat`;
  };
  clean.add(stopPlay);

  const setK = nextK => {
    stopPlay();
    k = mod(nextK, n);
    data = cyclicStarData(n, k);
    shownSteps = data.order;
    updateInfo();
    canvasCtl.render();
  };

  kInp.addEventListener('input', () => setK(Number(kInp.value)));

  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bestD = 26;
    nodePos.forEach((pt, i) => {
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) setK(best);
  });

  host.querySelector('[data-step]').onclick = () => {
    stopPlay();
    shownSteps = shownSteps >= data.order ? 1 : shownSteps + 1;
    canvasCtl.render();
  };
  host.querySelector('[data-all]').onclick = () => {
    stopPlay();
    shownSteps = data.order;
    canvasCtl.render();
  };
  playBtn.onclick = () => {
    if (playing) { stopPlay(); return; }
    playing = true;
    playBtn.innerHTML = `${icon('pause')} Duraklat`;
    shownSteps = 1;
    canvasCtl.render();
    playTimer = setInterval(() => {
      if (asleep()) return;
      if (shownSteps < data.order) {
        shownSteps++;
        canvasCtl.render();
      } else {
        stopPlay();
      }
    }, 420);
  };

  updateInfo();
  return clean.run;
}

// =====================================================================
// 3. sublattice — Clickable SVG Hasse diagram (course conventions)
// =====================================================================

function mountSublattice(host, params, ctx) {
  const clean = createClean(ctx);
  const kind = params.kind === 'Z' ? 'Z' : 'D';
  const n = Math.max(2, Math.min(kind === 'Z' ? 36 : 12, Math.trunc(params.n || 4)));
  const data = subgroupLatticeData(kind, n);
  let selectedId = data.nodes.length - 1;

  // Compute subset / superset maps for fast highlight
  const elemSets = data.nodes.map(nd => new Set(nd.elementLabels));
  const isSub = (a, b) => {
    if (data.nodes[a].order >= data.nodes[b].order) return false;
    for (const x of elemSets[a]) if (!elemSets[b].has(x)) return false;
    return true;
  };

  const render = () => {
    const numLevels = data.levels.length;
    const maxPerRow = Math.max(...data.levels.map(l => l.nodeIds.length));
    const W = Math.max(360, maxPerRow * 92 + 70);
    const rowH = 64;
    const H = Math.max(220, numLevels * rowH + 44);

    const pos = new Map();
    data.levels.forEach((lv, li) => {
      const y = H - 30 - li * rowH;
      const cnt = lv.nodeIds.length;
      const usableW = W - 84;
      lv.nodeIds.forEach((id, idx) => {
        const x = 58 + (cnt === 1 ? usableW / 2 : (usableW * idx) / (cnt - 1));
        pos.set(id, { x, y });
      });
    });

    const subIds = new Set();
    const supIds = new Set();
    for (const nd of data.nodes) {
      if (nd.id === selectedId) continue;
      if (isSub(nd.id, selectedId)) subIds.add(nd.id);
      else if (isSub(selectedId, nd.id)) supIds.add(nd.id);
    }

    const edgesSvg = data.edges.map(([u, v]) => {
      const p1 = pos.get(u), p2 = pos.get(v);
      const hi = (u === selectedId && supIds.has(v)) || (v === selectedId && subIds.has(u))
        || (subIds.has(u) && subIds.has(v)) || (supIds.has(u) && supIds.has(v));
      const col = hi ? 'var(--acc)' : 'rgba(255,255,255,0.16)';
      return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${col}" stroke-width="${hi ? 2.1 : 1.1}"/>`;
    }).join('');

    const orderTicks = data.levels.map((lv, li) => {
      const y = H - 30 - li * rowH;
      return `<text x="12" y="${y + 4}" fill="rgba(255,255,255,0.45)" font-size="11" font-family="ui-monospace, monospace">|H|=${lv.order}</text>`;
    }).join('');

    const nodesSvg = data.nodes.map(nd => {
      const { x, y } = pos.get(nd.id);
      const isSel = nd.id === selectedId;
      const isBelow = subIds.has(nd.id);
      const isAbove = supIds.has(nd.id);
      const fill = isSel ? 'var(--acc)' : isBelow ? 'rgba(52, 211, 153, 0.25)' : isAbove ? 'rgba(251, 191, 36, 0.22)' : '#101522';
      const stroke = isSel ? '#fff' : isBelow ? '#34d399' : isAbove ? '#fbbf24' : nd.isNormal ? 'var(--acc)' : 'rgba(255,255,255,0.3)';
      const txtCol = isSel ? '#000' : '#f4f4f5';
      const lbl = nd.label.length > 12 ? nd.label.slice(0, 11) + '…' : nd.label;
      return `<g class="gp-lat-node" data-nid="${nd.id}" role="button" tabindex="0" aria-label="Alt grup ${esc(nd.label)}, mertebe ${nd.order}${nd.isNormal ? ', normal' : ''}">
        ${nd.isNormal ? `<rect x="${x - 41}" y="${y - 18}" width="82" height="36" rx="11" fill="none" stroke="${stroke}" stroke-dasharray="3 2" opacity="0.65"/>` : ''}
        <rect x="${x - 37}" y="${y - 14}" width="74" height="28" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 2.2 : 1.4}"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle" fill="${txtCol}" font-size="10.5" font-weight="600" font-family="ui-monospace, monospace">${esc(lbl)}${nd.isNormal ? ' ◁' : ''}</text>
      </g>`;
    }).join('');

    const sel = data.nodes[selectedId];
    const normalCount = data.nodes.filter(nd => nd.isNormal).length;

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">Alt Grup Kafesi (Hasse) · ${tex(kind === 'Z' ? `\\mathbb{Z}_{${n}}` : `D_{${n}}`)}</div>
        <div class="gp-model-sub">Bir alt gruba tıklayın: <span class="gp-tag-sub">alt grupları</span> ve <span class="gp-tag-sup">üst grupları</span> vurgulanır. Kesikli çerçeve + <b>◁</b> normal alt grubu gösterir.</div>
      </div>
      <div class="gp-svg-scroll">
        <svg class="gp-svg" viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W, 560)}px" role="img" aria-label="${esc(data.groupName)} alt grup kafesi">
          ${orderTicks}${edgesSvg}${nodesSvg}
        </svg>
      </div>
      ${kpiStrip([
        { label: 'Seçili Alt Grup H', html: tex(sel.tex), acc: true },
        { label: 'Mertebe / İndeks', val: `|H|=${sel.order} · [G:H]=${sel.index}`, mono: true },
        { label: 'Normallik', val: sel.isNormal ? '✓ Normal (H ◁ G)' : '✗ Normal değil' },
        { label: 'İzomorfizm Tipi', val: sel.isoLabel, mono: true },
        { label: 'Toplam Alt Grup', val: `${data.nodes.length} (${normalCount} normal)`, mono: true },
      ])}
      <div class="gp-detail-box">
        <span class="mute small">Elemanlar (${sel.elementLabels.length}):</span>
        <span class="mono">${esc(sel.elementLabels.join(', '))}</span>
      </div>
    </div>`;

    host.querySelectorAll('[data-nid]').forEach(el => {
      const pick = () => { selectedId = Number(el.dataset.nid); render(); };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// 4. cosets — Coloured left & right cosets (course conventions)
// =====================================================================

function mountCosets(host, params, ctx) {
  const clean = createClean(ctx);
  const kind = params.kind === 'Z' ? 'Z' : 'D';
  const n = Math.max(2, Math.min(kind === 'Z' ? 24 : 10, Math.trunc(params.n || 4)));
  const lattice = subgroupLatticeData(kind, n);
  let activeSub = Array.isArray(params.sub) && params.sub.length
    ? params.sub
    : (kind === 'Z' ? [0] : ['e', 's']);
  let selectedG = 0;

  const render = () => {
    const data = cosetsData(kind, n, activeSub);
    const activeKey = [...data.subLabels].sort().join(',');
    const gLabel = data.elements[selectedG] ?? data.elements[0];
    const lIdx = data.leftCosetOf[selectedG] ?? 0;
    const rIdx = data.rightCosetOf[selectedG] ?? 0;
    const gH = data.leftCosets[lIdx];
    const Hg = data.rightCosets[rIdx];
    const sameForG = gH && Hg && gH.elems.join(',') === Hg.elems.join(',');

    const subOptions = lattice.nodes.map((nd, i) => {
      const ndKey = [...nd.elementLabels].sort().join(',');
      return `<option value="${i}" ${ndKey === activeKey ? 'selected' : ''}>${esc(nd.label)} (|H|=${nd.order}${nd.isNormal ? ', normal ◁' : ''})</option>`;
    }).join('');

    const renderCosetList = (list, prefix, isLeft) => list.map((c, ci) => {
      const col = colorAt(ci);
      const isHi = (isLeft ? lIdx : rIdx) === ci;
      const match = isLeft ? (c.matchesRight !== false) : (c.matchesLeft !== false);
      const cosetName = kind === 'Z'
        ? `${c.rep} + H`
        : (isLeft ? `${c.rep}·H` : `H·${c.rep}`);
      return `<div class="gp-coset-card${isHi ? ' on' : ''}" style="--c:${col}">
        <div class="gp-coset-head">
          <span class="gp-badge" style="border-color:${col};color:${col}">${prefix}${ci + 1}</span>
          <b class="mono">${esc(cosetName)}</b>
          <span class="gp-coset-st ${match ? 'ok' : 'bad'}">${match ? '✓ eşleşir' : '≠ farklı'}</span>
        </div>
        <div class="gp-coset-elems mono">{ ${c.elems.map(esc).join(', ')} }</div>
      </div>`;
    }).join('');

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">Sol ve Sağ Kosetler · ${tex(kind === 'Z' ? `\\mathbb{Z}_{${n}}` : `D_{${n}}`)}</div>
        <div class="gp-model-sub">Bir $g$ elemanı seçip $gH$ ile $Hg$ kosetlerini karşılaştırın. Tüm kosetler eşleşiyorsa $H \\trianglelefteq G$ normaldir.</div>
      </div>
      <div class="gp-model-bar">
        <label class="gp-inline-lbl" for="gp-cos-sub">Alt grup H:</label>
        <select id="gp-cos-sub" class="inp gp-sel" aria-label="Alt grup seçin">${subOptions}</select>
      </div>
      ${kpiStrip([
        { label: 'Alt Grup H', val: `{${data.subLabels.join(', ')}}`, mono: true, acc: true },
        { label: 'İndeks [G:H]', val: `${data.index}  (= ${data.groupOrder}/${data.subLabels.length})`, mono: true },
        { label: 'Normallik', val: data.isNormal ? '✓ Normal (gH = Hg)' : `✗ Normal değil (${data.matchingCount}/${data.index} eşleşir)` },
      ])}
      <div class="gp-elem-bar" role="group" aria-label="G elemanı seçin">
        <span class="mute small">Eleman g seç:</span>
        ${data.elements.map((el, i) => `<button type="button" class="gp-chip${i === selectedG ? ' on' : ''}" data-g="${i}">${esc(el)}</button>`).join('')}
      </div>
      <div class="gp-detail-box ${sameForG ? 'ok' : 'warn'}">
        <div><b>${esc(gLabel)}</b> için:
          <span class="mono">${kind === 'Z' ? `${esc(gLabel)}+H` : `${esc(gLabel)}H`} = {${esc(gH.elems.join(', '))}}</span>
          &nbsp;${sameForG ? '=' : '≠'}&nbsp;
          <span class="mono">${kind === 'Z' ? `H+${esc(gLabel)}` : `H${esc(gLabel)}`} = {${esc(Hg.elems.join(', '))}}</span>
          <span class="gp-coset-st ${sameForG ? 'ok' : 'bad'}">${sameForG ? '✓ Aynı' : '✗ Farklı'}</span>
        </div>
      </div>
      <div class="gp-coset-grid">
        <div>
          <div class="gp-col-title">Sol Kosetler (${kind === 'Z' ? 'g + H' : 'gH'})</div>
          <div class="gp-coset-list">${renderCosetList(data.leftCosets, 'S', true)}</div>
        </div>
        <div>
          <div class="gp-col-title">Sağ Kosetler (${kind === 'Z' ? 'H + g' : 'Hg'})</div>
          <div class="gp-coset-list">${renderCosetList(data.rightCosets, 'R', false)}</div>
        </div>
      </div>
    </div>`;
    const subEl = host.querySelector('.gp-model-sub');
    if (subEl) subEl.innerHTML = richTex(subEl.textContent);

    host.querySelector('#gp-cos-sub').addEventListener('change', e => {
      const nd = lattice.nodes[Number(e.target.value)];
      if (nd) {
        activeSub = kind === 'Z' ? nd.elements.slice() : nd.elementLabels.slice();
        render();
      }
    });
    host.querySelectorAll('[data-g]').forEach(btn => {
      btn.onclick = () => { selectedG = Number(btn.dataset.g); render(); };
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// 5. hom — Homomorphism arrows, kernel, image & fibers
// =====================================================================

function mountHom(host, params, ctx) {
  const clean = createClean(ctx);
  const from = params.from || { kind: 'Z', n: 6 };
  const to = params.to || { kind: 'Z', n: 9 };
  const data = homData(from, to, params.images);
  let selectedTarget = data.to.e; // default: highlight kernel fiber φ⁻¹(e_H)

  const render = () => {
    const nA = data.from.elements.length;
    const nB = data.to.elements.length;
    const maxRows = Math.max(nA, nB);
    const W = 460;
    const rowStep = maxRows <= 8 ? 34 : maxRows <= 14 ? 26 : 20;
    const H = Math.max(210, maxRows * rowStep + 56);
    const xL = 92, xR = W - 92;

    const yPos = (idx, total) => {
      const span = H - 64;
      return total <= 1 ? H / 2 : 42 + (span * idx) / (total - 1);
    };

    const kerSet = new Set(data.kernel);
    const imSet = new Set(data.image);
    const fiber = new Set(data.fibers.get(selectedTarget) || []);

    const arrowsSvg = data.images.map((y, x) => {
      const y1 = yPos(x, nA), y2 = yPos(y, nB);
      const isHi = y === selectedTarget;
      const isKer = y === data.to.e;
      const stroke = isHi ? '#fbbf24' : isKer ? 'var(--acc)' : 'rgba(148,163,184,0.36)';
      const sw = isHi ? 2.4 : isKer ? 1.6 : 1.1;
      const cx1 = xL + 95, cx2 = xR - 95;
      return `<path d="M ${xL + 22} ${y1.toFixed(1)} C ${cx1} ${y1.toFixed(1)}, ${cx2} ${y2.toFixed(1)}, ${xR - 22} ${y2.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${isHi ? 1 : 0.72}"/>`;
    }).join('');

    const leftSvg = data.from.elements.map((lbl, i) => {
      const y = yPos(i, nA);
      const inKer = kerSet.has(i);
      const inFib = fiber.has(i);
      const fill = inFib ? 'rgba(251, 191, 36, 0.25)' : inKer ? 'rgba(96, 165, 250, 0.22)' : '#101522';
      const stroke = inFib ? '#fbbf24' : inKer ? 'var(--acc)' : 'rgba(255,255,255,0.28)';
      return `<g class="gp-lat-node" data-src="${i}" role="button" tabindex="0" aria-label="Kaynak eleman ${esc(lbl)}, görüntü ${esc(data.to.elements[data.images[i]])}">
        <rect x="${xL - 36}" y="${(y - 11).toFixed(1)}" width="58" height="22" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="${inFib ? 2 : 1.3}"/>
        <text x="${xL - 7}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="#f4f4f5" font-size="10.5" font-family="ui-monospace, monospace">${esc(lbl)}</text>
        ${inKer ? `<text x="${xL - 44}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--acc)" font-size="9" font-family="ui-monospace, monospace">ker</text>` : ''}
      </g>`;
    }).join('');

    const rightSvg = data.to.elements.map((lbl, j) => {
      const y = yPos(j, nB);
      const inIm = imSet.has(j);
      const isSel = j === selectedTarget;
      const fill = isSel ? '#fbbf24' : inIm ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.02)';
      const stroke = isSel ? '#fff' : inIm ? '#34d399' : 'rgba(255,255,255,0.16)';
      return `<g class="gp-lat-node" data-dst="${j}" role="button" tabindex="0" aria-label="Hedef eleman ${esc(lbl)}">
        <rect x="${xR - 22}" y="${(y - 11).toFixed(1)}" width="58" height="22" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 2.2 : 1.3}" ${!inIm ? 'stroke-dasharray="3 2"' : ''}/>
        <text x="${xR + 7}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="${isSel ? '#000' : inIm ? '#f4f4f5' : 'rgba(255,255,255,0.4)'}" font-size="10.5" font-weight="${isSel ? 700 : 500}" font-family="ui-monospace, monospace">${esc(lbl)}</text>
        ${inIm ? `<text x="${xR + 43}" y="${(y + 3).toFixed(1)}" text-anchor="start" fill="#34d399" font-size="9" font-family="ui-monospace, monospace">im</text>` : ''}
      </g>`;
    }).join('');

    const fiberLabels = (data.fibers.get(selectedTarget) || []).map(i => data.from.elements[i]);
    const kerLabels = data.kernel.map(i => data.from.elements[i]);
    const imLabels = data.image.map(j => data.to.elements[j]);

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">Homomorfizma Okları · ${tex(`\\varphi : ${data.from.tex} \\to ${data.to.tex}`)}</div>
        <div class="gp-model-sub">Herhangi bir elemana tıklayarak lifini (çekirdeğin kosetini) vurgulayın.</div>
      </div>
      ${kpiStrip([
        { label: 'Durum', val: data.isHom ? '✓ Geçerli Homomorfizma' : '✗ Homomorfizma değil', acc: true },
        { label: '|ker φ| · |im φ|', val: `${data.kernel.length} × ${data.image.length} = ${data.kernel.length * data.image.length} (|G|=${nA})`, mono: true },
        { label: 'Özellikler', val: [data.isInjective ? '✓ Birebir' : '✗ Birebir değil', data.isSurjective ? '✓ Örten' : '✗ Örten değil'].join(' · ') },
      ])}
      <div class="gp-svg-scroll">
        <svg class="gp-svg" viewBox="0 0 ${W} ${H}" style="min-width:340px" role="img" aria-label="Homomorfizma ok diyagramı">
          <text x="${xL - 7}" y="18" text-anchor="middle" fill="var(--acc)" font-size="12" font-weight="600" font-family="ui-monospace, monospace">${esc(data.from.name)}</text>
          <text x="${xR + 7}" y="18" text-anchor="middle" fill="#34d399" font-size="12" font-weight="600" font-family="ui-monospace, monospace">${esc(data.to.name)}</text>
          ${arrowsSvg}${leftSvg}${rightSvg}
        </svg>
      </div>
      <div class="gp-detail-box">
        <div><b>Seçili lif</b> <span class="mono">φ⁻¹(${esc(data.to.elements[selectedTarget])}) = {${esc(fiberLabels.join(', ') || '∅')}}</span> (${fiberLabels.length} eleman)</div>
        <div class="small mute"><b>ker φ</b> = {${esc(kerLabels.join(', '))}} · <b>im φ</b> = {${esc(imLabels.join(', '))}}</div>
      </div>
    </div>`;

    host.querySelectorAll('[data-src]').forEach(el => {
      const pick = () => { selectedTarget = data.images[Number(el.dataset.src)]; render(); };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    host.querySelectorAll('[data-dst]').forEach(el => {
      const pick = () => { selectedTarget = Number(el.dataset.dst); render(); };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// 6. torus — Periodic m x n lattice hopping
// =====================================================================

function mountTorus(host, params, ctx) {
  const clean = createClean(ctx);
  const m = Math.max(2, Math.min(16, Math.trunc(params.m || 5)));
  const n = Math.max(2, Math.min(16, Math.trunc(params.n || 4)));
  let a = mod(Math.trunc(params.a ?? 2), m);
  let b = mod(Math.trunc(params.b ?? 1), n);
  let data = torusOrbitData(m, n, a, b);
  let stepIdx = 0;
  let playing = false;
  let timer = 0;

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Periyodik ${m}×${n} Torus Kafesi · ${tex(`\\mathbb{Z}_{${m}} \\times \\mathbb{Z}_{${n}}`)}</div>
      <div class="gp-model-sub">Parçacık $(0,0)$ noktasından başlayıp her adımda $(+${a} \\bmod ${m},\\; +${b} \\bmod ${n})$ sıçrar.</div>
    </div>
    <div class="gp-model-bar">
      <label class="gp-inline-lbl">Adım (a, b):</label>
      <input type="number" class="inp gp-num-sm" data-ta min="0" max="${m - 1}" value="${a}" aria-label="Yatay adım a">
      <input type="number" class="inp gp-num-sm" data-tb min="0" max="${n - 1}" value="${b}" aria-label="Dikey adım b">
      <button type="button" class="btn small" data-step>+1 Adım</button>
      <button type="button" class="btn small primary" data-play>${icon('play')} Oynat</button>
      <button type="button" class="btn small" data-all>Tüm yörünge</button>
      <button type="button" class="btn small ghost" data-reset>Sıfırla</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="${m} çarpı ${n} torus kafesi çizimi"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kpiHost = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const updateInfo = () => {
    const cur = data.path[Math.min(stepIdx, data.path.length - 1)];
    kpiHost.innerHTML = kpiStrip([
      { label: 'Konum (x, y)', val: `(${cur.x}, ${cur.y}) · adım ${stepIdx}`, mono: true, acc: true },
      { label: 'Ziyaret / Toplam', val: `${data.visitedCount} / ${data.totalSites}`, mono: true },
      { label: 'Bileşen Periyodu', val: `Tₓ=${data.tx}, Tᵧ=${data.ty}`, mono: true },
      { label: 'Ayrık Yörünge (Koset)', val: String(data.orbitCount), mono: true },
      { label: 'Tüm Kafes?', val: data.visitsAll ? '✓ Evet' : (data.canVisitAll ? 'Hayır (ama mümkün)' : `✗ İmkânsız (gcd=${gcd(m, n)})`) },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const padL = 34, padR = 16, padT = 16, padB = 28;
    const cell = Math.min((W - padL - padR) / m, (H - padT - padB) / n);
    const ox = padL + (W - padL - padR - cell * m) / 2;
    const oy = padT + (H - padT - padB - cell * n) / 2;

    const cellCenter = (x, y) => ({
      px: ox + (x + 0.5) * cell,
      py: oy + (n - 1 - y + 0.5) * cell,
    });

    // Grid cells
    const visitedMap = new Map();
    for (let i = 0; i <= stepIdx && i < data.path.length; i++) {
      const p = data.path[i];
      visitedMap.set(`${p.x},${p.y}`, i);
    }

    for (let x = 0; x < m; x++) {
      for (let y = 0; y < n; y++) {
        const px = ox + x * cell;
        const py = oy + (n - 1 - y) * cell;
        const vStep = visitedMap.get(`${x},${y}`);
        c2d.fillStyle = vStep !== undefined
          ? (vStep === stepIdx ? 'rgba(96, 165, 250, 0.34)' : 'rgba(52, 211, 153, 0.16)')
          : 'rgba(255,255,255,0.02)';
        c2d.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        c2d.strokeStyle = 'rgba(255,255,255,0.12)';
        c2d.lineWidth = 1;
        c2d.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);

        if (vStep !== undefined && cell >= 22) {
          c2d.fillStyle = vStep === stepIdx ? '#fff' : 'rgba(255,255,255,0.68)';
          c2d.font = '600 10px ui-monospace, monospace';
          c2d.textAlign = 'center';
          c2d.textBaseline = 'middle';
          c2d.fillText(String(vStep), px + cell / 2, py + cell / 2);
        }
      }
    }

    // Axis ticks
    c2d.fillStyle = 'rgba(255,255,255,0.48)';
    c2d.font = '10px ui-monospace, monospace';
    c2d.textAlign = 'center';
    for (let x = 0; x < m; x++) c2d.fillText(String(x), ox + (x + 0.5) * cell, oy + n * cell + 14);
    c2d.textAlign = 'right';
    c2d.textBaseline = 'middle';
    for (let y = 0; y < n; y++) c2d.fillText(String(y), ox - 8, oy + (n - 1 - y + 0.5) * cell);

    // Path lines (dashed if wrapped across boundary)
    for (let i = 0; i < stepIdx && i < data.path.length - 1; i++) {
      const p1 = data.path[i], p2 = data.path[i + 1];
      const c1 = cellCenter(p1.x, p1.y), c2 = cellCenter(p2.x, p2.y);
      const wrapped = (p1.x + a >= m) || (p1.y + b >= n);
      c2d.save();
      if (wrapped) c2d.setLineDash([4, 4]);
      c2d.strokeStyle = wrapped ? 'rgba(251, 191, 36, 0.55)' : 'rgba(96, 165, 250, 0.75)';
      c2d.lineWidth = 1.8;
      c2d.beginPath();
      c2d.moveTo(c1.px, c1.py);
      c2d.lineTo(c2.px, c2.py);
      c2d.stroke();
      c2d.restore();
    }

    // Current particle dot
    const cur = data.path[Math.min(stepIdx, data.path.length - 1)];
    const cc = cellCenter(cur.x, cur.y);
    c2d.beginPath();
    c2d.arc(cc.px, cc.py, Math.max(5, cell * 0.24), 0, Math.PI * 2);
    c2d.strokeStyle = acc;
    c2d.lineWidth = 2.5;
    c2d.stroke();
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(310, Math.max(220, cw * 0.62)), draw, clean);

  const stopPlay = () => {
    playing = false;
    if (timer) { clearInterval(timer); timer = 0; }
    playBtn.innerHTML = `${icon('play')} Oynat`;
  };
  clean.add(stopPlay);

  const rebuild = () => {
    stopPlay();
    data = torusOrbitData(m, n, a, b);
    stepIdx = 0;
    updateInfo();
    canvasCtl.render();
  };

  host.querySelector('[data-ta]').addEventListener('change', e => { a = mod(Number(e.target.value), m); rebuild(); });
  host.querySelector('[data-tb]').addEventListener('change', e => { b = mod(Number(e.target.value), n); rebuild(); });
  host.querySelector('[data-step]').onclick = () => {
    stopPlay();
    stepIdx = (stepIdx + 1) % data.path.length;
    updateInfo();
    canvasCtl.render();
  };
  host.querySelector('[data-all]').onclick = () => {
    stopPlay();
    stepIdx = data.path.length - 1;
    updateInfo();
    canvasCtl.render();
  };
  host.querySelector('[data-reset]').onclick = () => {
    stopPlay();
    stepIdx = 0;
    updateInfo();
    canvasCtl.render();
  };
  playBtn.onclick = () => {
    if (playing) { stopPlay(); return; }
    playing = true;
    playBtn.innerHTML = `${icon('pause')} Duraklat`;
    if (stepIdx >= data.path.length - 1) stepIdx = 0;
    timer = setInterval(() => {
      if (asleep()) return;
      if (stepIdx < data.path.length - 1) {
        stepIdx++;
        updateInfo();
        canvasCtl.render();
      } else {
        stopPlay();
      }
    }, 300);
  };

  updateInfo();
  return clean.run;
}

// =====================================================================
// 7. wheel — Wagon-wheel stroboscope (R / (2π/n)Z quotient)
// =====================================================================

function mountWheel(host, params, ctx) {
  const clean = createClean(ctx);
  const spokes = Math.max(2, Math.min(24, Math.trunc(params.spokes || 6)));
  const fps = Math.max(1, Number(params.fps || 24));
  const radius = Math.max(0.05, Number(params.radius || 0.5));
  const initV = Number(params.v ?? 6);
  const baseInfo = wheelStrobeData({ spokes, fps, radius, v: initV });

  let v = initV;
  let info = wheelStrobeData({ spokes, fps, radius, v });
  let thetaTrue = 0;
  let thetaCam = 0;
  let frameAccum = 0;
  let flashAlpha = 0;
  let playing = motion() === 'full';
  const maxSliderV = Math.max(initV * 1.4, baseInfo.vFrozen1 * 2.1);

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Vagon Tekerleği Stroboskobu · ${spokes} Parmaklı (${fps} kare/s)</div>
      <div class="gp-model-sub">Sol: sürekli gerçek dönüş. Sağ: yalnızca saniyede ${fps} kez çekilen kamera kareleri ($\\mathbb{R}/(2\\pi/${spokes})\\mathbb{Z}$).</div>
    </div>
    <div class="gp-model-bar">
      <label class="gp-inline-lbl" for="gp-wh-v">Hız v = <b class="mono" data-vval>${fmtNum(v, 2)}</b> m/s</label>
      <input id="gp-wh-v" type="range" class="gp-range" min="0" max="${maxSliderV.toFixed(2)}" step="0.05" value="${v.toFixed(2)}" aria-label="Tekerlek hızı">
    </div>
    <div class="gp-model-bar">
      <button type="button" class="btn small primary" data-play>${playing ? icon('pause') + ' Duraklat' : icon('play') + ' Oynat'}</button>
      <button type="button" class="btn small" data-frame>+1 Kare (1/${fps} s)</button>
      <button type="button" class="btn small ghost" data-pre="max">v_max</button>
      <button type="button" class="btn small ghost" data-pre="back">Geri yanılsama</button>
      <button type="button" class="btn small ghost" data-pre="freeze">İlk donma</button>
      <button type="button" class="btn small ghost" data-pre="orig">Sorudaki hız</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="Gerçek ve kamera görüntüsü tekerlek karşılaştırması"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const vInp = host.querySelector('#gp-wh-v');
  const vVal = host.querySelector('[data-vval]');
  const playBtn = host.querySelector('[data-play]');
  const kpiHost = host.querySelector('[data-kpis]');

  const updateInfo = () => {
    info = wheelStrobeData({ spokes, fps, radius, v });
    vVal.textContent = fmtNum(v, 2);
    vInp.value = String(v.toFixed(2));
    const degT = (info.dThetaTrue * 180) / Math.PI;
    const degA = (info.dThetaApp * 180) / Math.PI;
    const sym = info.dir === 'frozen' ? '⏸' : info.dir === 'forward' ? '↻' : '↺';
    kpiHost.innerHTML = kpiStrip([
      { label: 'Görünen Yön', val: `${sym} ${info.dirLabel}`, acc: true },
      { label: 'Gerçek Δθ / kare', val: `${fmtNum(degT, 1)}°`, mono: true },
      { label: 'Görünen Δθ\' / kare', val: `${fmtNum(degA, 1)}°`, mono: true },
      { label: 'v_max / v_don', val: `${fmtNum(info.vMaxTrue, 2)} / ${fmtNum(info.vFrozen1, 2)} m/s`, mono: true },
    ]);
  };

  const drawWheel = (c2d, cx, cy, R, angle, title, accent, showFlash, dirTag) => {
    c2d.save();
    // Outer tire
    c2d.beginPath();
    c2d.arc(cx, cy, R, 0, Math.PI * 2);
    c2d.strokeStyle = showFlash > 0.05 ? `rgba(251, 191, 36, ${0.35 + showFlash * 0.65})` : 'rgba(255,255,255,0.28)';
    c2d.lineWidth = 6;
    c2d.stroke();

    // Spokes
    for (let i = 0; i < spokes; i++) {
      const a = angle + (2 * Math.PI * i) / spokes;
      c2d.beginPath();
      c2d.moveTo(cx, cy);
      c2d.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      c2d.strokeStyle = i === 0 ? accent : 'rgba(255,255,255,0.65)';
      c2d.lineWidth = i === 0 ? 3.2 : 1.8;
      c2d.stroke();
    }

    // Hub
    c2d.beginPath();
    c2d.arc(cx, cy, 7, 0, Math.PI * 2);
    c2d.fillStyle = accent;
    c2d.fill();

    // Title & direction tag
    c2d.fillStyle = '#f4f4f5';
    c2d.font = '600 12px ui-sans-serif, system-ui';
    c2d.textAlign = 'center';
    c2d.fillText(title, cx, cy - R - 14);
    c2d.fillStyle = 'rgba(255,255,255,0.62)';
    c2d.font = '11px ui-monospace, monospace';
    c2d.fillText(dirTag, cx, cy + R + 18);
    c2d.restore();
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const R = Math.min(W * 0.19, H * 0.34, 86);
    const cy = H / 2 + 2;
    drawWheel(c2d, W * 0.27, cy, R, thetaTrue, 'Gerçek Dönüş', acc, 0, `ω = ${fmtNum(info.omegaTrue, 1)} rad/s`);
    const sym = info.dir === 'frozen' ? '⏸ Durgun' : info.dir === 'forward' ? '↻ İleri' : '↺ Geri';
    drawWheel(c2d, W * 0.73, cy, R, thetaCam, `Kamera (${fps} fps)`, info.dir === 'backward' ? '#f472b6' : '#34d399', flashAlpha, sym);
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(260, Math.max(200, cw * 0.48)), draw, clean);

  // Use a slow visual time scale (0.25x real-time) so 24 fps stroboscope is clearly legible to the eye
  const loop = createAnimLoop((_now, dt) => {
    if (!playing) return false;
    const simDt = dt * 0.25;
    thetaTrue += info.omegaTrue * simDt;
    frameAccum += simDt;
    const framePeriod = 1 / fps;
    while (frameAccum >= framePeriod) {
      frameAccum -= framePeriod;
      thetaCam += info.dThetaApp;
      flashAlpha = 1;
    }
    flashAlpha = Math.max(0, flashAlpha - dt * 4);
    canvasCtl.render();
    return true;
  }, clean);

  vInp.addEventListener('input', () => {
    v = Number(vInp.value);
    updateInfo();
    canvasCtl.render();
  });

  host.querySelector('[data-frame]').onclick = () => {
    thetaTrue += info.dThetaTrue;
    thetaCam += info.dThetaApp;
    flashAlpha = 0.85;
    canvasCtl.render();
  };

  playBtn.onclick = () => {
    playing = !playing;
    playBtn.innerHTML = playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (playing) loop.start();
    else loop.stop();
  };

  host.querySelectorAll('[data-pre]').forEach(btn => {
    btn.onclick = () => {
      const p = btn.dataset.pre;
      if (p === 'max') v = baseInfo.vMaxTrue * 0.96;
      else if (p === 'back') v = baseInfo.vFrozen1 * 0.85;
      else if (p === 'freeze') v = baseInfo.vFrozen1;
      else v = initV;
      updateInfo();
      canvasCtl.render();
    };
  });

  updateInfo();
  if (playing) loop.start();
  return clean.run;
}

// =====================================================================
// 8. brillouin — 1D atomic chain & first Brillouin zone
// =====================================================================

function mountBrillouin(host, params, ctx) {
  const clean = createClean(ctx);
  const a = Math.max(0.2, Number(params.a || 2));
  const origK = Number(params.k ?? (5 * Math.PI) / 4);
  let k = origK;
  let data = brillouinData({ a, k });

  const cFromK = kv => (kv * a) / Math.PI;
  const maxC = Math.max(3.5, Math.ceil(Math.abs(cFromK(origK)) + 1));

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">1B Atom Zinciri ve Birinci Brillouin Bölgesi</div>
      <div class="gp-model-sub">Kesikli turuncu eğri $\\cos(kx)$ ve düz mavi eğri $\\cos(k'x)$ tüm atom konumlarında $x_j = j\\,a$ tam olarak çakışır.</div>
    </div>
    <div class="gp-model-bar">
      <label class="gp-inline-lbl" for="gp-bz-k">k = <b class="mono" data-cval>${fmtNum(data.cOrig, 2)}</b> π/a</label>
      <input id="gp-bz-k" type="range" class="gp-range" min="${(-maxC).toFixed(2)}" max="${maxC.toFixed(2)}" step="0.05" value="${data.cOrig.toFixed(2)}" aria-label="Dalga sayısı k">
      <button type="button" class="btn small" data-shift="-1">−G</button>
      <button type="button" class="btn small" data-shift="1">+G</button>
      <button type="button" class="btn small ghost" data-reset>Sorudaki k</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="1B atom zinciri dalga ve Brillouin bölgesi çizimi"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kInp = host.querySelector('#gp-bz-k');
  const cVal = host.querySelector('[data-cval]');
  const kpiHost = host.querySelector('[data-kpis]');

  const updateInfo = () => {
    data = brillouinData({ a, k });
    cVal.textContent = fmtNum(data.cOrig, 2);
    kInp.value = String(Math.max(-maxC, Math.min(maxC, data.cOrig)).toFixed(2));
    const maxDiff = Math.max(...data.atoms.map(at => Math.abs(at.yOrig - at.yRed)));
    kpiHost.innerHTML = kpiStrip([
      { label: 'Orijinal k', val: `${fmtNum(data.cOrig, 3)} π/a`, mono: true },
      { label: "İndirgenmiş k' ∈ (−π/a, π/a]", val: `${fmtNum(data.cReduced, 3)} π/a`, mono: true, acc: true },
      { label: 'Ters Kafes Kayması m', val: `${data.mShift} · G  (G = 2π/${fmtNum(a, 2)})`, mono: true },
      { label: 'Atomlardaki Maks. Fark', val: maxDiff < 1e-9 ? '0 (özdeş!)' : fmtNum(maxDiff, 4), mono: true },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const padX = 28;
    const topMid = H * 0.34;
    const amp = H * 0.22;
    const xSpan = 4.4 * a;
    const mapX = x => padX + ((x + xSpan) / (2 * xSpan)) * (W - 2 * padX);

    // Axis for real-space wave
    c2d.strokeStyle = 'rgba(255,255,255,0.16)';
    c2d.lineWidth = 1;
    c2d.beginPath();
    c2d.moveTo(padX, topMid);
    c2d.lineTo(W - padX, topMid);
    c2d.stroke();

    // Original wave cos(k x) — dashed amber
    c2d.save();
    c2d.setLineDash([5, 4]);
    c2d.strokeStyle = '#fbbf24';
    c2d.lineWidth = 1.8;
    c2d.beginPath();
    const steps = 260;
    for (let i = 0; i <= steps; i++) {
      const x = -xSpan + (2 * xSpan * i) / steps;
      const px = mapX(x), py = topMid - Math.cos(k * x) * amp;
      if (i === 0) c2d.moveTo(px, py); else c2d.lineTo(px, py);
    }
    c2d.stroke();
    c2d.restore();

    // Reduced wave cos(k' x) — solid accent
    c2d.strokeStyle = acc;
    c2d.lineWidth = 2.4;
    c2d.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = -xSpan + (2 * xSpan * i) / steps;
      const px = mapX(x), py = topMid - Math.cos(data.kReduced * x) * amp;
      if (i === 0) c2d.moveTo(px, py); else c2d.lineTo(px, py);
    }
    c2d.stroke();

    // Atom sites x_j = j a
    for (const at of data.atoms) {
      const px = mapX(at.x);
      const py = topMid - at.yRed * amp;
      c2d.strokeStyle = 'rgba(255,255,255,0.14)';
      c2d.lineWidth = 1;
      c2d.beginPath();
      c2d.moveTo(px, topMid);
      c2d.lineTo(px, py);
      c2d.stroke();

      c2d.beginPath();
      c2d.arc(px, py, 5.5, 0, Math.PI * 2);
      c2d.fillStyle = '#34d399';
      c2d.fill();
      c2d.strokeStyle = '#090d16';
      c2d.lineWidth = 1.5;
      c2d.stroke();
    }

    // Legend top-left
    c2d.font = '11px ui-monospace, monospace';
    c2d.fillStyle = '#fbbf24';
    c2d.textAlign = 'left';
    c2d.fillText('--- cos(kx)', padX, 16);
    c2d.fillStyle = acc;
    c2d.fillText("─── cos(k'x)", padX + 94, 16);

    // Bottom panel: Reciprocal space k-axis and First Brillouin Zone
    const bzY = H * 0.80;
    const cRange = Math.max(3.6, Math.abs(data.cOrig) + 0.6);
    const mapC = cValNum => padX + ((cValNum + cRange) / (2 * cRange)) * (W - 2 * padX);

    // Highlight 1st BZ (-1, +1] in units of π/a
    const bzL = mapC(-1), bzR = mapC(1);
    c2d.fillStyle = 'rgba(96, 165, 250, 0.16)';
    c2d.fillRect(bzL, bzY - 16, bzR - bzL, 32);
    c2d.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    c2d.lineWidth = 1.2;
    c2d.strokeRect(bzL, bzY - 16, bzR - bzL, 32);

    // k-axis line
    c2d.strokeStyle = 'rgba(255,255,255,0.28)';
    c2d.beginPath();
    c2d.moveTo(padX, bzY);
    c2d.lineTo(W - padX, bzY);
    c2d.stroke();

    // Ticks at integers of π/a
    c2d.fillStyle = 'rgba(255,255,255,0.52)';
    c2d.font = '10px ui-monospace, monospace';
    c2d.textAlign = 'center';
    for (let t = -Math.floor(cRange); t <= Math.floor(cRange); t++) {
      const tx = mapC(t);
      c2d.beginPath();
      c2d.moveTo(tx, bzY - 5);
      c2d.lineTo(tx, bzY + 5);
      c2d.stroke();
      const lbl = t === 0 ? '0' : t === 1 ? 'π/a' : t === -1 ? '−π/a' : `${t}π/a`;
      c2d.fillText(lbl, tx, bzY + 26);
    }

    // Markers for k (amber) and k' (accent)
    const kx = mapC(data.cOrig), kpx = mapC(data.cReduced);
    if (Math.abs(kx - kpx) > 4) {
      c2d.strokeStyle = '#34d399';
      c2d.lineWidth = 1.6;
      c2d.beginPath();
      c2d.moveTo(kx, bzY - 10);
      c2d.quadraticCurveTo((kx + kpx) / 2, bzY - 36, kpx, bzY - 10);
      c2d.stroke();
    }
    c2d.beginPath(); c2d.arc(kx, bzY, 5.5, 0, Math.PI * 2); c2d.fillStyle = '#fbbf24'; c2d.fill();
    c2d.beginPath(); c2d.arc(kpx, bzY, 5.5, 0, Math.PI * 2); c2d.fillStyle = acc; c2d.fill();
    c2d.fillStyle = '#fbbf24'; c2d.fillText('k', kx, bzY - 20);
    c2d.fillStyle = acc; c2d.fillText("k'", kpx, bzY - 20);
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(300, Math.max(230, cw * 0.62)), draw, clean);

  kInp.addEventListener('input', () => {
    k = (Number(kInp.value) * Math.PI) / a;
    updateInfo();
    canvasCtl.render();
  });
  host.querySelectorAll('[data-shift]').forEach(btn => {
    btn.onclick = () => {
      k += Number(btn.dataset.shift) * ((2 * Math.PI) / a);
      updateInfo();
      canvasCtl.render();
    };
  });
  host.querySelector('[data-reset]').onclick = () => {
    k = origK;
    updateInfo();
    canvasCtl.render();
  };

  updateInfo();
  return clean.run;
}

// =====================================================================
// 9. shuffle — Animated card permutation until deck returns
// =====================================================================

function mountShuffle(host, params, ctx) {
  const clean = createClean(ctx);
  const data = shuffleData(params.perm);
  const n = data.n;

  let deck = Array.from({ length: n }, (_, i) => i + 1);
  let prevDeck = deck.slice();
  let stepCount = 0;
  let animT = 1;
  let playing = false;
  let playTimer = 0;
  let showArcs = true;

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Kart Karıştırma ve Ayrık Döngüler (${n} Kart)</div>
      <div class="gp-model-sub">Konum permütasyonu: $i$ konumundaki kart $p(i)$ konumuna taşınır. Her döngü ayrı renkle gösterilir.</div>
    </div>
    <div class="gp-model-bar">
      <button type="button" class="btn small" data-step>1 Karıştır</button>
      <button type="button" class="btn small primary" data-play>${icon('play')} Oynat</button>
      <button type="button" class="btn small ghost" data-reset>Sıfırla</button>
      <label class="gp-check-lbl"><input type="checkbox" data-arcs checked> Döngü okları</label>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="${n} kartlık permütasyon animasyonu"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kpiHost = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');

  const isRestored = () => deck.every((v, i) => v === i + 1);

  const updateInfo = () => {
    const restored = stepCount > 0 && isRestored();
    kpiHost.innerHTML = kpiStrip([
      { label: 'Adım / Mertebe', val: `${stepCount} / ${data.order}${restored ? ' ✓ Döndü!' : ''}`, mono: true, acc: true },
      { label: 'Ayrık Döngüler', val: data.cyclesStr, mono: true },
      { label: 'Döngü Tipi', val: data.cycleType.length ? `(${data.cycleType.join(', ')})` : '(1)', mono: true },
      { label: 'İşaret (sgn)', val: data.sign === 1 ? '+1 (çift)' : '−1 (tek)', mono: true },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const padX = 16;
    const gap = Math.max(4, Math.min(10, (W - 2 * padX) / (n * 5)));
    const cardW = Math.min(48, (W - 2 * padX - gap * (n - 1)) / n);
    const cardH = Math.min(68, Math.max(42, cardW * 1.45));
    const totalW = n * cardW + (n - 1) * gap;
    const ox = (W - totalW) / 2;
    const cy = H * 0.56;
    const slotX = posIdx => ox + posIdx * (cardW + gap) + cardW / 2;

    // Draw cycle permutation arcs above cards
    if (showArcs) {
      for (let i = 0; i < n; i++) {
        const j = data.perm[i] - 1;
        if (i === j) continue;
        const x1 = slotX(i), x2 = slotX(j);
        const col = colorAt(data.cycleOf[i]);
        const span = Math.abs(x2 - x1);
        const arcH = Math.min(H * 0.34, 18 + span * 0.24);
        c2d.strokeStyle = col;
        c2d.globalAlpha = 0.5;
        c2d.lineWidth = 1.5;
        c2d.beginPath();
        c2d.moveTo(x1, cy - cardH / 2 - 4);
        c2d.quadraticCurveTo((x1 + x2) / 2, cy - cardH / 2 - arcH, x2, cy - cardH / 2 - 4);
        c2d.stroke();
      }
      c2d.globalAlpha = 1;
    }

    // Slot labels below cards
    c2d.fillStyle = 'rgba(255,255,255,0.45)';
    c2d.font = '10px ui-monospace, monospace';
    c2d.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      c2d.fillText(`#${i + 1}`, slotX(i), cy + cardH / 2 + 16);
    }

    // Animated cards moving from prev pos i -> perm[i]-1
    const t = easeOutCubic(animT);
    for (let i = 0; i < n; i++) {
      const cardNum = animT < 1 ? prevDeck[i] : deck[i];
      const fromSlot = i;
      const toSlot = animT < 1 ? data.perm[i] - 1 : i;
      const x = slotX(fromSlot) + (slotX(toSlot) - slotX(fromSlot)) * t;
      const lift = animT < 1 ? Math.sin(t * Math.PI) * (toSlot > fromSlot ? -18 : 16) : 0;
      const y = cy + lift;

      const cycIdx = data.cycleOf[cardNum - 1];
      const col = cycIdx >= 0 ? colorAt(cycIdx) : '#94a3b8';

      c2d.save();
      c2d.fillStyle = '#0c1220';
      c2d.strokeStyle = col;
      c2d.lineWidth = 2;
      drawRoundRect(c2d, x - cardW / 2, y - cardH / 2, cardW, cardH, 7);
      c2d.fill();
      c2d.stroke();

      c2d.fillStyle = col;
      c2d.font = `700 ${cardW < 28 ? 11 : 14}px ui-monospace, monospace`;
      c2d.textAlign = 'center';
      c2d.textBaseline = 'middle';
      c2d.fillText(String(cardNum), x, y);
      c2d.restore();
    }
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(240, Math.max(190, cw * 0.44)), draw, clean);
  const animLoop = createAnimLoop((_now, dt) => {
    animT = Math.min(1, animT + dt / 0.34);
    canvasCtl.render();
    return animT < 1;
  }, clean);

  const stopPlay = () => {
    playing = false;
    if (playTimer) { clearInterval(playTimer); playTimer = 0; }
    playBtn.innerHTML = `${icon('play')} Oynat`;
  };
  clean.add(stopPlay);

  const doShuffle = () => {
    prevDeck = deck.slice();
    deck = data.applyDeck(deck);
    stepCount++;
    if (motion() === 'full') {
      animT = 0;
      animLoop.start();
    } else {
      animT = 1;
      canvasCtl.render();
    }
    updateInfo();
    if (playing && isRestored()) stopPlay();
  };

  host.querySelector('[data-step]').onclick = () => { stopPlay(); doShuffle(); };
  host.querySelector('[data-reset]').onclick = () => {
    stopPlay();
    deck = Array.from({ length: n }, (_, i) => i + 1);
    prevDeck = deck.slice();
    stepCount = 0;
    animT = 1;
    updateInfo();
    canvasCtl.render();
  };
  host.querySelector('[data-arcs]').addEventListener('change', e => {
    showArcs = e.target.checked;
    canvasCtl.render();
  });
  playBtn.onclick = () => {
    if (playing) { stopPlay(); return; }
    if (stepCount > 0 && isRestored()) {
      deck = Array.from({ length: n }, (_, i) => i + 1);
      stepCount = 0;
    }
    playing = true;
    playBtn.innerHTML = `${icon('pause')} Duraklat`;
    doShuffle();
    if (playing) {
      playTimer = setInterval(() => {
        if (asleep()) return;
        doShuffle();
      }, 620);
    }
  };

  updateInfo();
  return clean.run;
}

// =====================================================================
// 10. puzzle15 — Playable 15 puzzle with checkerboard parity & invariant
// =====================================================================

function mountPuzzle15(host, params, ctx) {
  const clean = createClean(ctx);
  const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
  const samLoyd = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0];
  const initialTiles = puzzle15Data(params.tiles || samLoyd).tiles;

  let tiles = initialTiles.slice();
  let moves = 0;

  const shuffleSolvable = () => {
    let b = solved.slice();
    let prev = -1;
    for (let s = 0; s < 48; s++) {
      const z = b.indexOf(0);
      const r = Math.floor(z / 4), c = z % 4;
      const neigh = [];
      if (r > 0) neigh.push(z - 4);
      if (r < 3) neigh.push(z + 4);
      if (c > 0) neigh.push(z - 1);
      if (c < 3) neigh.push(z + 1);
      const opts = neigh.filter(x => x !== prev);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      prev = z;
      [b[z], b[pick]] = [b[pick], b[z]];
    }
    return b;
  };

  const render = () => {
    const info = puzzle15Data(tiles);
    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">15 Bulmacası · Parite ve Dama Değişmezi</div>
        <div class="gp-model-sub">Boşluğa komşu taşlara tıklayın (veya ok tuşlarını kullanın). Her hamle hem permütasyon işaretini hem boşluk rengini tersine çevirir.</div>
      </div>
      <div class="gp-model-bar">
        <button type="button" class="btn small" data-p15="orig">Sorudaki Dizilim</button>
        <button type="button" class="btn small" data-p15="loyd">14 ↔ 15 (Sam Loyd)</button>
        <button type="button" class="btn small" data-p15="shuf">Çözülebilir Karıştır</button>
        <button type="button" class="btn small ghost" data-p15="solved">Çözülmüş</button>
      </div>
      <div class="gp-p15-wrap">
        <div class="gp-p15-grid" tabindex="0" role="grid" aria-label="4 çarpı 4 on beş bulmacası tahtası">
          ${tiles.map((v, idx) => {
            const r = Math.floor(idx / 4), c = idx % 4;
            const light = (r + c) % 2 === 0;
            const movable = puzzle15Move(tiles, idx) !== null;
            const inPlace = v !== 0 && v === idx + 1;
            return `<button type="button" class="gp-p15-cell ${light ? 'light' : 'dark'}${v === 0 ? ' blank' : ''}${movable ? ' mov' : ''}${inPlace ? ' home' : ''}" data-idx="${idx}" ${v === 0 || !movable ? 'tabindex="-1"' : ''} aria-label="${v === 0 ? `Boş kare, ${light ? 'açık' : 'koyu'}` : `Taş ${v}${movable ? ', kaydırılabilir' : ''}`}">
              <span class="gp-p15-dot" aria-hidden="true">${light ? '▫' : '▪'}</span>
              <span>${v === 0 ? '□' : v}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="gp-p15-side">
          ${kpiStrip([
            { label: 'Durum', val: info.isSolved ? '★ Çözüldü!' : (info.solvable ? '✓ Çözülebilir' : '✗ Çözülemez'), acc: true },
            { label: 'Hamle Sayısı', val: String(moves), mono: true },
            { label: 'Boşluk Karesi', val: `${info.blankColor} (d = ${info.blankTaxicab})`, mono: true },
            { label: 'Permütasyon sgn(π)', val: info.fullSign === 1 ? '+1 (çift)' : '−1 (tek)', mono: true },
            { label: 'Terslik (Inversion)', val: String(info.inversions), mono: true },
            { label: 'Değişmez sgn·(−1)ᵈ', val: info.invariant === 1 ? '+1 ✓' : '−1 ✗', mono: true },
          ])}
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-idx]').forEach(btn => {
      btn.onclick = () => {
        const next = puzzle15Move(tiles, Number(btn.dataset.idx));
        if (next) { tiles = next; moves++; render(); }
      };
    });

    host.querySelectorAll('[data-p15]').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.p15;
        if (mode === 'orig') tiles = initialTiles.slice();
        else if (mode === 'loyd') tiles = samLoyd.slice();
        else if (mode === 'shuf') tiles = shuffleSolvable();
        else tiles = solved.slice();
        moves = 0;
        render();
      };
    });

    const grid = host.querySelector('.gp-p15-grid');
    grid?.addEventListener('keydown', e => {
      const z = tiles.indexOf(0);
      const r = Math.floor(z / 4), c = z % 4;
      let target = -1;
      if (e.key === 'ArrowUp' && r < 3) target = z + 4;
      else if (e.key === 'ArrowDown' && r > 0) target = z - 4;
      else if (e.key === 'ArrowLeft' && c < 3) target = z + 1;
      else if (e.key === 'ArrowRight' && c > 0) target = z - 1;
      if (target >= 0) {
        e.preventDefault();
        const next = puzzle15Move(tiles, target);
        if (next) { tiles = next; moves++; render(); host.querySelector('.gp-p15-grid')?.focus(); }
      }
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// 11. cube — 3D rotatable cube with 4 colored body diagonals (O ≅ S_4)
// =====================================================================

const DIAG_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24'];

function mountCube(host, params, ctx) {
  const clean = createClean(ctx);
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const initialMat = cubeAnalyze(params.rot).mat;

  let curMat = initialMat.map(r => r.slice());
  let activeAxis = null;
  let dead = false;
  clean.add(() => { dead = true; });

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">3B Küp ve 4 Cisim Köşegeni · ${tex('O \\cong S_4')}</div>
      <div class="gp-model-sub">Sürükleyerek kamerayı döndürün; dönme düğmeleriyle 4 renkli cisim köşegeninin ($d_1\\dots d_4$) nasıl permüte olduğunu izleyin.</div>
    </div>
    <div class="gp-model-bar">
      ${CUBE_OPS.map(op => `<button type="button" class="btn small" data-cop="${op.id}">${esc(op.label)}</button>`).join('')}
      <button type="button" class="btn small ghost" data-cop="orig">Sorudaki R</button>
      <button type="button" class="btn small ghost" data-cop="id">Sıfırla (I)</button>
    </div>
    <div class="gp-3d-stage" data-stage aria-label="Etkileşimli 3B küp modeli">
      <div class="gp-3d-loading mute small">3B sahne yükleniyor…</div>
    </div>
    <div class="gp-diag-legend">
      ${CUBE_DIAGS.map((d, i) => `<span class="gp-diag-pill"><i style="background:${DIAG_COLORS[i]}"></i>d${i + 1}: (${d.join(',')})</span>`).join('')}
    </div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const stage = host.querySelector('[data-stage]');
  const kpiHost = host.querySelector('[data-kpis]');

  const updateInfo = () => {
    const info = cubeAnalyze(curMat);
    kpiHost.innerHTML = kpiStrip([
      { label: 'Köşegen Perm. (S₄)', val: info.diagCycles, mono: true, acc: true },
      { label: 'Eksen Perm. (S₃)', val: info.axisCycles, mono: true },
      { label: 'Mertebe / İşaret', val: `${info.order} · ${info.sign === 1 ? '+1' : '−1'}`, mono: true },
      { label: 'Dönüş Türü', val: info.kindLabel },
      { label: 'Koordinat Etkisi', val: info.coordMap, mono: true },
    ]);
  };

  let onMatChange = () => {};

  const setup2DFallback = () => {
    stage.innerHTML = '<canvas class="gp-canvas" aria-label="3B küp izometrik çizimi"></canvas>';
    const cv = stage.querySelector('canvas');
    let yaw = 0.65, pitch = 0.45, dragging = false, lx = 0, ly = 0;

    const project = (v, W, H) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = cy * v[0] - sy * v[2];
      const z1 = sy * v[0] + cy * v[2];
      const y2 = cp * v[1] - sp * z1;
      const z2 = sp * v[1] + cp * z1;
      const sc = Math.min(W, H) * 0.25 * (3.6 / (3.6 - z2 * 0.35));
      return { x: W / 2 + x1 * sc, y: H / 2 - y2 * sc, z: z2 };
    };

    const corners = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    const draw = (c2d, W, H) => {
      c2d.clearRect(0, 0, W, H);
      const pts = corners.map(c => project(applyMat3(curMat, c), W, H));
      c2d.strokeStyle = 'rgba(255,255,255,0.34)';
      c2d.lineWidth = 1.6;
      for (const [a, b] of edges) {
        c2d.beginPath(); c2d.moveTo(pts[a].x, pts[a].y); c2d.lineTo(pts[b].x, pts[b].y); c2d.stroke();
      }
      CUBE_DIAGS.forEach((d, i) => {
        const p1 = project(applyMat3(curMat, d), W, H);
        const p2 = project(applyMat3(curMat, [-d[0], -d[1], -d[2]]), W, H);
        c2d.strokeStyle = DIAG_COLORS[i];
        c2d.lineWidth = 3;
        c2d.beginPath(); c2d.moveTo(p1.x, p1.y); c2d.lineTo(p2.x, p2.y); c2d.stroke();
        c2d.fillStyle = DIAG_COLORS[i];
        c2d.font = '700 11px ui-monospace, monospace';
        c2d.fillText(`d${i + 1}`, p1.x + 6, p1.y - 4);
      });
    };

    const ctl = setupCanvas(cv, cw => Math.min(310, Math.max(230, cw * 0.62)), draw, clean);
    cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!dragging) return;
      yaw += (e.clientX - lx) * 0.01;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - ly) * 0.01));
      lx = e.clientX; ly = e.clientY;
      ctl.render();
    });
    cv.addEventListener('pointerup', () => { dragging = false; });
    onMatChange = () => ctl.render();
  };

  loadThree().then(THREE => {
    if (dead) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setup2DFallback();
      return;
    }
    if (!renderer.getContext()) {
      renderer.dispose();
      setup2DFallback();
      return;
    }

    stage.innerHTML = '';
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'gp-3d-inner';
    const overlay = document.createElement('canvas');
    overlay.className = 'gp-3d-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    canvasWrap.append(renderer.domElement, overlay);
    stage.append(canvasWrap);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 100);
    let camTheta = 0.72, camPhi = 1.08;
    const camR = 5.0;
    const syncCam = () => {
      camera.position.set(
        camR * Math.sin(camPhi) * Math.cos(camTheta),
        camR * Math.cos(camPhi),
        camR * Math.sin(camPhi) * Math.sin(camTheta)
      );
      camera.lookAt(0, 0, 0);
    };
    syncCam();

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9);
    dl.position.set(4, 6, 5);
    scene.add(dl);

    const disposables = [];
    const track = obj => { disposables.push(obj); return obj; };

    // Static reference coordinate axes (x, y, z)
    const refMat = track(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }));
    [[1.8, 0, 0], [0, 1.8, 0], [0, 0, 1.8]].forEach(v => {
      const g = track(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-v[0], -v[1], -v[2]),
        new THREE.Vector3(v[0], v[1], v[2]),
      ]));
      scene.add(new THREE.Line(g, refMat));
    });

    // Active rotation axis rod (shown on op press)
    const axisGeo = track(new THREE.CylinderGeometry(0.025, 0.025, 3.6, 12));
    const axisMat = track(new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 }));
    const axisRod = new THREE.Mesh(axisGeo, axisMat);
    axisRod.visible = false;
    scene.add(axisRod);

    // Rotatable cube group
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const boxGeo = track(new THREE.BoxGeometry(2, 2, 2));
    const boxMat = track(new THREE.MeshPhongMaterial({
      color: 0x1e293b, transparent: true, opacity: 0.24, shininess: 40, depthWrite: false,
    }));
    cubeGroup.add(new THREE.Mesh(boxGeo, boxMat));

    const edgeGeo = track(new THREE.EdgesGeometry(boxGeo));
    const edgeMat = track(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.78 }));
    cubeGroup.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // 4 colored body diagonals + endpoint spheres
    const cylGeo = track(new THREE.CylinderGeometry(0.045, 0.045, 2 * Math.sqrt(3), 12));
    const sphGeo = track(new THREE.SphereGeometry(0.11, 16, 16));
    const diagTips = [];
    CUBE_DIAGS.forEach((d, i) => {
      const col = new THREE.Color(DIAG_COLORS[i]);
      const mat = track(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.35 }));
      const rod = new THREE.Mesh(cylGeo, mat);
      const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cubeGroup.add(rod);

      const s1 = new THREE.Mesh(sphGeo, mat); s1.position.set(d[0], d[1], d[2]);
      const s2 = new THREE.Mesh(sphGeo, mat); s2.position.set(-d[0], -d[1], -d[2]);
      cubeGroup.add(s1, s2);
      diagTips.push({ idx: i, v: new THREE.Vector3(d[0], d[1], d[2]) });
    });

    const quatOfMat3 = M => {
      const m4 = new THREE.Matrix4().set(
        M[0][0], M[0][1], M[0][2], 0,
        M[1][0], M[1][1], M[1][2], 0,
        M[2][0], M[2][1], M[2][2], 0,
        0, 0, 0, 1
      );
      return new THREE.Quaternion().setFromRotationMatrix(m4);
    };

    let qFrom = quatOfMat3(curMat);
    let qTo = qFrom.clone();
    let animT = 1;
    cubeGroup.quaternion.copy(qTo);

    let W = 320, H = 260;
    const renderScene = () => {
      if (dead) return;
      renderer.render(scene, camera);
      const c2d = overlay.getContext('2d');
      if (!c2d) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, W, H);

      const proj = vec => {
        const p = vec.clone().project(camera);
        return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
      };
      c2d.font = '700 11px ui-monospace, monospace';
      c2d.textAlign = 'center';
      c2d.textBaseline = 'middle';
      diagTips.forEach(({ idx, v }) => {
        const w = v.clone().applyQuaternion(cubeGroup.quaternion).multiplyScalar(1.18);
        const pt = proj(w);
        c2d.fillStyle = '#090d16';
        c2d.beginPath(); c2d.arc(pt.x, pt.y, 11, 0, Math.PI * 2); c2d.fill();
        c2d.strokeStyle = DIAG_COLORS[idx]; c2d.lineWidth = 1.6; c2d.stroke();
        c2d.fillStyle = DIAG_COLORS[idx];
        c2d.fillText(`d${idx + 1}`, pt.x, pt.y + 0.5);
      });
      [['+x', 1.95, 0, 0], ['+y', 0, 1.95, 0], ['+z', 0, 0, 1.95]].forEach(([lbl, x, y, z]) => {
        const pt = proj(new THREE.Vector3(x, y, z));
        c2d.fillStyle = 'rgba(255,255,255,0.45)';
        c2d.fillText(lbl, pt.x, pt.y);
      });
    };

    const resize = () => {
      if (dead) return;
      const cw = Math.max(240, Math.floor(stage.clientWidth || 320));
      const ch = Math.min(320, Math.max(230, Math.floor(cw * 0.62)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cw; H = ch;
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      renderer.domElement.style.width = `${W}px`;
      renderer.domElement.style.height = `${H}px`;
      overlay.width = Math.round(W * dpr);
      overlay.height = Math.round(H * dpr);
      overlay.style.width = `${W}px`;
      overlay.style.height = `${H}px`;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderScene();
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(stage);
    resize();

    const loop = createAnimLoop((_now, dt) => {
      animT = Math.min(1, animT + dt / 0.36);
      cubeGroup.quaternion.slerpQuaternions(qFrom, qTo, easeOutCubic(animT));
      renderScene();
      return animT < 1;
    }, clean);

    // Drag to orbit
    let dragging = false, lx = 0, ly = 0;
    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture?.(e.pointerId); });
    dom.addEventListener('pointermove', e => {
      if (!dragging) return;
      camTheta -= (e.clientX - lx) * 0.01;
      camPhi = Math.max(0.25, Math.min(Math.PI - 0.25, camPhi - (e.clientY - ly) * 0.01));
      lx = e.clientX; ly = e.clientY;
      syncCam();
      renderScene();
    });
    dom.addEventListener('pointerup', () => { dragging = false; });

    onMatChange = () => {
      if (activeAxis) {
        axisRod.visible = true;
        axisRod.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(activeAxis[0], activeAxis[1], activeAxis[2]).normalize()
        );
      } else {
        axisRod.visible = false;
      }
      qFrom = cubeGroup.quaternion.clone();
      qTo = quatOfMat3(curMat);
      if (motion() === 'full') {
        animT = 0;
        loop.start();
      } else {
        animT = 1;
        cubeGroup.quaternion.copy(qTo);
        renderScene();
      }
    };

    clean.add(() => {
      ro?.disconnect();
      disposables.forEach(d => d.dispose?.());
      renderer.dispose();
    });
  }).catch(() => {
    if (!dead) setup2DFallback();
  });

  host.querySelectorAll('[data-cop]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.cop;
      if (id === 'id') {
        curMat = I3.map(r => r.slice());
        activeAxis = null;
      } else if (id === 'orig') {
        curMat = initialMat.map(r => r.slice());
        activeAxis = null;
      } else {
        const op = CUBE_OPS.find(o => o.id === id);
        if (!op) return;
        curMat = cubeMul3(op.mat, curMat);
        activeAxis = op.axis;
      }
      updateInfo();
      onMatChange();
    };
  });

  updateInfo();
  return clean.run;
}

// =====================================================================
// 12. molecule — 3D Molecule Symmetry Explorer (NH3, H2O, CH4, C6H6, C2H4, BF3)
// =====================================================================

function mountMolecule(host, params, ctx) {
  const clean = createClean(ctx);
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let molName = MOLECULE_DEFS[params.name] ? params.name : 'NH3';
  let showAxes = true;
  let showMirrors = true;
  let lastOpLabel = 'Birim (e)';
  let lastPermStr = 'e';
  let curMat = I3.map(r => r.slice());
  let innerClean = null;
  let dead = false;
  clean.add(() => { dead = true; innerClean?.(); });

  const buildView = () => {
    innerClean?.();
    innerClean = null;
    const def = moleculeData(molName);
    lastOpLabel = 'Birim (e)';
    lastPermStr = 'e';
    curMat = I3.map(r => r.slice());

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">3B Molekül Simetrileri · ${esc(def.title)} (${esc(def.pointGroup)})</div>
        <div class="gp-model-sub">Sürükleyerek döndürün; aşağıdaki simetri işlemlerini uygulayarak dış atom permütasyonunu gözlemleyin.</div>
      </div>
      <div class="gp-model-bar">
        <div class="gp-chip-row" role="group" aria-label="Molekül seçimi">
          ${Object.keys(MOLECULE_DEFS).map(k => `<button type="button" class="gp-chip${k === molName ? ' on' : ''}" data-mol="${k}">${esc(k)}</button>`).join('')}
        </div>
        <label class="gp-check-lbl"><input type="checkbox" data-axes ${showAxes ? 'checked' : ''}> Eksenler</label>
        <label class="gp-check-lbl"><input type="checkbox" data-mirrors ${showMirrors ? 'checked' : ''}> Aynalar</label>
      </div>
      <div class="gp-model-bar">
        ${def.ops.map(op => `<button type="button" class="btn small" data-mop="${op.id}">${esc(op.label)}</button>`).join('')}
        <button type="button" class="btn small ghost" data-mop="reset">Sıfırla</button>
      </div>
      <div class="gp-3d-stage" data-stage aria-label="${esc(def.title)} 3B molekülü">
        <div class="gp-3d-loading mute small">3B molekül yükleniyor…</div>
      </div>
      <div data-kpis></div>
    </div>`;

    const stage = host.querySelector('[data-stage]');
    const kpiHost = host.querySelector('[data-kpis]');
    let triggerOp = () => {};
    let toggleOverlays = () => {};

    const updateInfo = () => {
      kpiHost.innerHTML = kpiStrip([
        { label: 'Nokta Grubu', val: def.pointGroup, acc: true },
        { label: 'Grup Mertebesi', val: String(def.groupOrder), mono: true },
        { label: 'Son İşlem', val: lastOpLabel },
        { label: 'Dış Atom Permütasyonu', val: lastPermStr, mono: true },
      ]);
    };

    const localClean = createClean(null);
    innerClean = localClean.run;

    const setup2DFallback = () => {
      stage.innerHTML = '<canvas class="gp-canvas" aria-label="Molekül 3B projeksiyon çizimi"></canvas>';
      const cv = stage.querySelector('canvas');
      let yaw = 0.55, pitch = 0.45, dragging = false, lx = 0, ly = 0;
      let atomCoords = def.atoms.map(a => a.pos.slice());

      const proj = (v, W, H) => {
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const x1 = cy * v[0] - sy * v[2];
        const z1 = sy * v[0] + cy * v[2];
        const y2 = cp * v[1] - sp * z1;
        const z2 = sp * v[1] + cp * z1;
        const sc = Math.min(W, H) * 0.25;
        return { x: W / 2 + x1 * sc, y: H / 2 - y2 * sc, z: z2 };
      };

      const draw = (c2d, W, H) => {
        c2d.clearRect(0, 0, W, H);
        const pts = atomCoords.map(p => proj(p, W, H));
        c2d.strokeStyle = 'rgba(255,255,255,0.45)';
        c2d.lineWidth = 3;
        for (const [i, j] of def.bonds) {
          c2d.beginPath(); c2d.moveTo(pts[i].x, pts[i].y); c2d.lineTo(pts[j].x, pts[j].y); c2d.stroke();
        }
        const order = def.atoms.map((_, i) => i).sort((a, b) => pts[a].z - pts[b].z);
        for (const i of order) {
          const a = def.atoms[i], pt = pts[i];
          c2d.beginPath(); c2d.arc(pt.x, pt.y, a.radius * 46, 0, Math.PI * 2);
          c2d.fillStyle = a.color; c2d.fill();
          c2d.strokeStyle = '#090d16'; c2d.lineWidth = 1.6; c2d.stroke();
          c2d.fillStyle = '#090d16'; c2d.font = '700 10px ui-monospace, monospace';
          c2d.textAlign = 'center'; c2d.textBaseline = 'middle';
          c2d.fillText(a.label, pt.x, pt.y);
        }
      };

      const ctl = setupCanvas(cv, cw => Math.min(310, Math.max(230, cw * 0.62)), draw, localClean);
      cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
      cv.addEventListener('pointermove', e => {
        if (!dragging) return;
        yaw += (e.clientX - lx) * 0.01;
        pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - ly) * 0.01));
        lx = e.clientX; ly = e.clientY;
        ctl.render();
      });
      cv.addEventListener('pointerup', () => { dragging = false; });

      triggerOp = op => {
        atomCoords = op ? atomCoords.map(p => applyMat3(op.mat, p)) : def.atoms.map(a => a.pos.slice());
        ctl.render();
      };
    };

    loadThree().then(THREE => {
      if (dead || innerClean !== localClean.run) return;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      } catch {
        setup2DFallback();
        return;
      }
      if (!renderer.getContext()) {
        renderer.dispose();
        setup2DFallback();
        return;
      }

      stage.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'gp-3d-inner';
      const overlay = document.createElement('canvas');
      overlay.className = 'gp-3d-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      wrap.append(renderer.domElement, overlay);
      stage.append(wrap);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 100);
      let camTheta = 0.65, camPhi = 1.05;
      const camR = def.name === 'C6H6' ? 5.2 : 4.2;
      const syncCam = () => {
        camera.position.set(
          camR * Math.sin(camPhi) * Math.cos(camTheta),
          camR * Math.cos(camPhi),
          camR * Math.sin(camPhi) * Math.sin(camTheta)
        );
        camera.lookAt(0, 0, 0);
      };
      syncCam();

      scene.add(new THREE.AmbientLight(0xffffff, 0.72));
      const dl1 = new THREE.DirectionalLight(0xffffff, 0.95); dl1.position.set(4, 6, 5); scene.add(dl1);
      const dl2 = new THREE.DirectionalLight(0x93c5fd, 0.35); dl2.position.set(-4, -3, -4); scene.add(dl2);

      const disposables = [];
      const track = o => { disposables.push(o); return o; };

      // Symmetry axes group
      const axesGroup = new THREE.Group();
      scene.add(axesGroup);
      const axisGeo = track(new THREE.CylinderGeometry(0.024, 0.024, 3.2, 10));
      def.axes.forEach(ax => {
        const mat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(ax.color || '#38bdf8'), transparent: true, opacity: 0.78 }));
        const m = new THREE.Mesh(axisGeo, mat);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...ax.dir).normalize());
        axesGroup.add(m);
      });

      // Mirror planes group
      const mirrorsGroup = new THREE.Group();
      scene.add(mirrorsGroup);
      const planeGeo = track(new THREE.PlaneGeometry(2.8, 2.8));
      const planeBorderGeo = track(new THREE.EdgesGeometry(planeGeo));
      def.mirrors.forEach(mr => {
        const g = new THREE.Group();
        const mat = track(new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
        const bmat = track(new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.48 }));
        g.add(new THREE.Mesh(planeGeo, mat), new THREE.LineSegments(planeBorderGeo, bmat));
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...mr.normal).normalize());
        mirrorsGroup.add(g);
      });

      // Dynamic atoms & bonds (we update positions smoothly for both rotations AND reflections!)
      const atomMeshes = def.atoms.map(a => {
        const geo = track(new THREE.SphereGeometry(a.radius, 24, 24));
        const mat = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(a.color), roughness: 0.32, metalness: 0.12 }));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(...a.pos);
        scene.add(mesh);
        return mesh;
      });
      const bondGeo = track(new THREE.CylinderGeometry(0.065, 0.065, 1, 12));
      const bondMat = track(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5 }));
      const bondMeshes = def.bonds.map(() => {
        const m = new THREE.Mesh(bondGeo, bondMat);
        scene.add(m);
        return m;
      });

      let curCoords = def.atoms.map(a => a.pos.slice());
      let startCoords = curCoords.map(p => p.slice());
      let endCoords = curCoords.map(p => p.slice());
      let activeOp = null;
      let animT = 1;

      const syncMeshes = coords => {
        coords.forEach((p, i) => atomMeshes[i].position.set(p[0], p[1], p[2]));
        def.bonds.forEach(([i, j], bi) => {
          const p1 = new THREE.Vector3(...coords[i]);
          const p2 = new THREE.Vector3(...coords[j]);
          const mid = p1.clone().add(p2).multiplyScalar(0.5);
          const dir = p2.clone().sub(p1);
          const len = dir.length();
          bondMeshes[bi].position.copy(mid);
          bondMeshes[bi].scale.set(1, len, 1);
          if (len > 1e-6) bondMeshes[bi].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        });
      };
      syncMeshes(curCoords);

      let W = 320, H = 260;
      const renderScene = () => {
        if (dead || innerClean !== localClean.run) return;
        axesGroup.visible = showAxes;
        mirrorsGroup.visible = showMirrors;
        renderer.render(scene, camera);

        const c2d = overlay.getContext('2d');
        if (!c2d) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        c2d.clearRect(0, 0, W, H);
        c2d.font = '700 10.5px ui-monospace, monospace';
        c2d.textAlign = 'center';
        c2d.textBaseline = 'middle';
        def.atoms.forEach((a, i) => {
          const v = atomMeshes[i].position.clone().project(camera);
          const px = (v.x * 0.5 + 0.5) * W;
          const py = (-v.y * 0.5 + 0.5) * H - 14;
          c2d.fillStyle = 'rgba(9,13,22,0.72)';
          c2d.fillRect(px - 14, py - 8, 28, 16);
          c2d.fillStyle = '#f4f4f5';
          c2d.fillText(a.label, px, py + 0.5);
        });
      };

      const resize = () => {
        if (dead || innerClean !== localClean.run) return;
        const cw = Math.max(240, Math.floor(stage.clientWidth || 320));
        const ch = Math.min(320, Math.max(230, Math.floor(cw * 0.62)));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = cw; H = ch;
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);
        renderer.domElement.style.width = `${W}px`;
        renderer.domElement.style.height = `${H}px`;
        overlay.width = Math.round(W * dpr);
        overlay.height = Math.round(H * dpr);
        overlay.style.width = `${W}px`;
        overlay.style.height = `${H}px`;
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderScene();
      };
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      ro?.observe(stage);
      resize();

      const loop = createAnimLoop((_now, dt) => {
        animT = Math.min(1, animT + dt / 0.42);
        const u = easeOutCubic(animT);
        if (activeOp && activeOp.kind === 'rot') {
          const ax = new THREE.Vector3(...activeOp.axis).normalize();
          const q = new THREE.Quaternion().setFromAxisAngle(ax, activeOp.angle * u);
          curCoords = startCoords.map(p => {
            const v = new THREE.Vector3(...p).applyQuaternion(q);
            return [v.x, v.y, v.z];
          });
        } else {
          curCoords = startCoords.map((p, i) => [
            p[0] + (endCoords[i][0] - p[0]) * u,
            p[1] + (endCoords[i][1] - p[1]) * u,
            p[2] + (endCoords[i][2] - p[2]) * u,
          ]);
        }
        syncMeshes(curCoords);
        renderScene();
        return animT < 1;
      }, localClean);

      let dragging = false, lx = 0, ly = 0;
      const dom = renderer.domElement;
      dom.style.touchAction = 'none';
      dom.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture?.(e.pointerId); });
      dom.addEventListener('pointermove', e => {
        if (!dragging) return;
        camTheta -= (e.clientX - lx) * 0.01;
        camPhi = Math.max(0.22, Math.min(Math.PI - 0.22, camPhi - (e.clientY - ly) * 0.01));
        lx = e.clientX; ly = e.clientY;
        syncCam();
        renderScene();
      });
      dom.addEventListener('pointerup', () => { dragging = false; });

      toggleOverlays = () => renderScene();
      triggerOp = op => {
        activeOp = op;
        startCoords = curCoords.map(p => p.slice());
        endCoords = op ? startCoords.map(p => applyMat3(op.mat, p)) : def.atoms.map(a => a.pos.slice());
        if (motion() === 'full') {
          animT = 0;
          loop.start();
        } else {
          animT = 1;
          curCoords = endCoords.map(p => p.slice());
          syncMeshes(curCoords);
          renderScene();
        }
      };

      localClean.add(() => {
        ro?.disconnect();
        disposables.forEach(d => d.dispose?.());
        renderer.dispose();
      });
    }).catch(() => {
      if (!dead && innerClean === localClean.run) setup2DFallback();
    });

    host.querySelectorAll('[data-mol]').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.mol !== molName) { molName = btn.dataset.mol; buildView(); }
      };
    });
    host.querySelector('[data-axes]').addEventListener('change', e => { showAxes = e.target.checked; toggleOverlays(); });
    host.querySelector('[data-mirrors]').addEventListener('change', e => { showMirrors = e.target.checked; toggleOverlays(); });
    host.querySelectorAll('[data-mop]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.mop;
        if (id === 'reset') {
          curMat = I3.map(r => r.slice());
          lastOpLabel = 'Birim (e)';
          lastPermStr = 'e';
          triggerOp(null);
        } else {
          const op = def.ops.find(o => o.id === id);
          if (!op) return;
          curMat = cubeMul3(op.mat, curMat);
          lastOpLabel = op.label;
          lastPermStr = cyclesString(moleculePermOfMatrix(def, curMat));
          triggerOp(op);
        }
        updateInfo();
      };
    });

    updateInfo();
  };

  buildView();
  return clean.run;
}

// =====================================================================
// 13. velocity — Relativistic velocity addition on rapidity line
// =====================================================================

function mountVelocity(host, params, ctx) {
  const clean = createClean(ctx);
  const initU = Number(params.u ?? 0.5);
  const initV = Number(params.v ?? 0.5);
  let u = initU, v = initV;
  let data = velocityData(u, v);

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Göreli Hız Toplamı ve Rapidite İzomorfizması</div>
      <div class="gp-model-sub">$((-c,c),\\,\\oplus) \\cong (\\mathbb{R}, +)$: rapidite $\\varphi = \\operatorname{artanh}(v/c)$ ekseninde bileşke sade toplama dönüşür.</div>
    </div>
    <div class="gp-model-bar">
      <label class="gp-inline-lbl" for="gp-vel-u">u/c = <b class="mono" data-uval>${fmtNum(u, 2)}</b></label>
      <input id="gp-vel-u" type="range" class="gp-range" min="-0.95" max="0.95" step="0.05" value="${u.toFixed(2)}" aria-label="İlk hız u bölü c">
      <label class="gp-inline-lbl" for="gp-vel-v">v/c = <b class="mono" data-vval>${fmtNum(v, 2)}</b></label>
      <input id="gp-vel-v" type="range" class="gp-range" min="-0.95" max="0.95" step="0.05" value="${v.toFixed(2)}" aria-label="İkinci hız v bölü c">
    </div>
    <div class="gp-model-bar">
      <button type="button" class="btn small ghost" data-vpre="0.5,0.5">0.5 ⊕ 0.5 = 0.8</button>
      <button type="button" class="btn small ghost" data-vpre="0.8,0.8">0.8 ⊕ 0.8</button>
      <button type="button" class="btn small ghost" data-vpre="0.6,-0.6">Ters (0.6 ⊕ −0.6)</button>
      <button type="button" class="btn small ghost" data-vpre="orig">Sorudaki değerler</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="Göreli hız ve rapidite eksenleri"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const uInp = host.querySelector('#gp-vel-u');
  const vInp = host.querySelector('#gp-vel-v');
  const uVal = host.querySelector('[data-uval]');
  const vVal = host.querySelector('[data-vval]');
  const kpiHost = host.querySelector('[data-kpis]');

  const updateInfo = () => {
    data = velocityData(u, v);
    uVal.textContent = fmtNum(u, 2);
    vVal.textContent = fmtNum(v, 2);
    uInp.value = u.toFixed(2);
    vInp.value = v.toFixed(2);
    kpiHost.innerHTML = kpiStrip([
      { label: 'Göreli u ⊕ v', val: `${fmtNum(data.sumRel, 4)} c`, mono: true, acc: true },
      { label: 'Galile u + v', val: `${fmtNum(data.sumGal, 3)} c${Math.abs(data.sumGal) >= 1 ? ' (>c!)' : ''}`, mono: true },
      { label: 'φ_u + φ_v = φ_top', val: `${fmtNum(data.phiU, 3)} + ${fmtNum(data.phiV, 3)} = ${fmtNum(data.phiSum, 3)}`, mono: true },
      { label: 'Lorentz γ(u⊕v)', val: fmtNum(data.gammaSum, 3), mono: true },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const padX = 32;
    const yV = H * 0.28;
    const yP = H * 0.76;
    const mapV = x => padX + ((Math.max(-1.25, Math.min(1.25, x)) + 1.25) / 2.5) * (W - 2 * padX);
    const phiMax = Math.max(2.6, Math.abs(data.phiSum) + 0.5);
    const mapP = p => padX + ((p + phiMax) / (2 * phiMax)) * (W - 2 * padX);

    // Velocity axis (-c, c) shaded allowed zone
    const xL = mapV(-1), xR = mapV(1);
    c2d.fillStyle = 'rgba(96, 165, 250, 0.12)';
    c2d.fillRect(xL, yV - 14, xR - xL, 28);
    c2d.strokeStyle = 'rgba(255,255,255,0.28)';
    c2d.lineWidth = 1.5;
    c2d.beginPath(); c2d.moveTo(padX, yV); c2d.lineTo(W - padX, yV); c2d.stroke();
    // Light barriers at ±c
    c2d.strokeStyle = '#fb7185'; c2d.setLineDash([4, 3]);
    [xL, xR].forEach(bx => { c2d.beginPath(); c2d.moveTo(bx, yV - 20); c2d.lineTo(bx, yV + 20); c2d.stroke(); });
    c2d.setLineDash([]);

    c2d.fillStyle = 'rgba(255,255,255,0.55)';
    c2d.font = '10.5px ui-monospace, monospace';
    c2d.textAlign = 'center';
    c2d.fillText('−c', xL, yV + 30);
    c2d.fillText('0', mapV(0), yV + 30);
    c2d.fillText('+c', xR, yV + 30);
    c2d.textAlign = 'left';
    c2d.fillText('Hız ekseni (−c, c)', padX, yV - 24);

    // Rapidity axis (-∞, +∞)
    c2d.strokeStyle = 'rgba(255,255,255,0.28)';
    c2d.beginPath(); c2d.moveTo(padX, yP); c2d.lineTo(W - padX, yP); c2d.stroke();
    c2d.fillStyle = 'rgba(255,255,255,0.55)';
    c2d.textAlign = 'center';
    c2d.fillText('0', mapP(0), yP + 22);
    c2d.textAlign = 'left';
    c2d.fillText('Rapidite ekseni φ = artanh(v/c) ∈ ℝ', padX, yP - 24);

    // Connecting tanh curves from rapidity to velocity
    const drawLink = (velVal, phiVal, col, lbl) => {
      const vx = mapV(velVal), px = mapP(phiVal);
      c2d.strokeStyle = col;
      c2d.globalAlpha = 0.45;
      c2d.lineWidth = 1.4;
      c2d.beginPath();
      c2d.moveTo(px, yP - 6);
      c2d.bezierCurveTo(px, (yP + yV) / 2, vx, (yP + yV) / 2, vx, yV + 6);
      c2d.stroke();
      c2d.globalAlpha = 1;

      c2d.fillStyle = col;
      c2d.beginPath(); c2d.arc(vx, yV, 5.5, 0, Math.PI * 2); c2d.fill();
      c2d.beginPath(); c2d.arc(px, yP, 5.5, 0, Math.PI * 2); c2d.fill();
      c2d.font = '700 10.5px ui-monospace, monospace';
      c2d.textAlign = 'center';
      c2d.fillText(lbl, vx, yV - 11);
    };

    // Galilean marker on velocity axis
    const gx = mapV(data.sumGal);
    c2d.strokeStyle = '#fb7185';
    c2d.lineWidth = 2;
    c2d.beginPath(); c2d.moveTo(gx - 5, yV - 5); c2d.lineTo(gx + 5, yV + 5); c2d.moveTo(gx + 5, yV - 5); c2d.lineTo(gx - 5, yV + 5); c2d.stroke();

    // Linear vector sum arrow on rapidity line
    c2d.strokeStyle = '#34d399';
    c2d.lineWidth = 2.4;
    c2d.beginPath(); c2d.moveTo(mapP(0), yP - 10); c2d.lineTo(mapP(data.phiU), yP - 10); c2d.stroke();
    c2d.strokeStyle = '#fbbf24';
    c2d.beginPath(); c2d.moveTo(mapP(data.phiU), yP - 16); c2d.lineTo(mapP(data.phiSum), yP - 16); c2d.stroke();

    drawLink(data.u, data.phiU, '#34d399', 'u');
    drawLink(data.v, data.phiV, '#fbbf24', 'v');
    drawLink(data.sumRel, data.phiSum, acc, 'u⊕v');
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(260, Math.max(205, cw * 0.48)), draw, clean);

  uInp.addEventListener('input', () => { u = Number(uInp.value); updateInfo(); canvasCtl.render(); });
  vInp.addEventListener('input', () => { v = Number(vInp.value); updateInfo(); canvasCtl.render(); });
  host.querySelectorAll('[data-vpre]').forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.vpre === 'orig') { u = initU; v = initV; }
      else { [u, v] = btn.dataset.vpre.split(',').map(Number); }
      updateInfo();
      canvasCtl.render();
    };
  });

  updateInfo();
  return clean.run;
}

// =====================================================================
// 14. music — 12 pitch classes clock & D_12 T/I group
// =====================================================================

function mountMusic(host, params, ctx) {
  const clean = createClean(ctx);
  const initChord = Array.isArray(params.chord) && params.chord.length ? params.chord.slice() : [0, 4, 7];
  let baseChord = [...new Set(initChord.map(x => mod(Math.trunc(x), 12)))].sort((a, b) => a - b);
  let op = dEl(12, 0, 0);
  let nodePos = [];

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">12 Perde Müzik Saati · ${tex('D_{12}')} ($T_k$ / $I_k$)</div>
      <div class="gp-model-sub">Saat üzerindeki perdelere tıklayarak akoru düzenleyin; aktarım $T_k(x)=x+k$ ve evirme $I_k(x)=-x+k \\pmod{12}$ uygulayın.</div>
    </div>
    <div class="gp-model-bar">
      <button type="button" class="btn small" data-mop="tm">T₋₁ (−1 yarıton)</button>
      <button type="button" class="btn small" data-mop="tp">T₊₁ (+1 yarıton)</button>
      <button type="button" class="btn small" data-mop="inv">Evirme (I₀ uygula)</button>
      <button type="button" class="btn small ghost" data-mop="reset">Sıfırla</button>
    </div>
    <div class="gp-model-bar">
      <span class="mute small">Akor:</span>
      <button type="button" class="gp-chip" data-ch="0,4,7">C Majör</button>
      <button type="button" class="gp-chip" data-ch="0,3,7">C Minör</button>
      <button type="button" class="gp-chip" data-ch="0,4,8">Artık (3)</button>
      <button type="button" class="gp-chip" data-ch="0,3,6,9">Eksik 7'li (4)</button>
      <button type="button" class="gp-chip" data-ch="0,2,4,6,8,10">Tam Ton (6)</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="12 perde müzik saati"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kpiHost = host.querySelector('[data-kpis]');

  const updateInfo = () => {
    const info = musicData(baseChord, op);
    kpiHost.innerHTML = kpiStrip([
      { label: 'Aktif İşlem', val: `${info.opLabel}  (${info.dLabel} ∈ D₁₂)`, mono: true, acc: true },
      { label: 'Akor Perdeleri', val: `[${info.chord.join(', ')}] · ${info.noteNames.join('–')}`, mono: true },
      { label: 'Kararlı Kılan |Stab|', val: String(info.stabSize), mono: true },
      { label: 'Yörünge (24/|Stab|)', val: `${info.orbitSize} farklı akor`, mono: true },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const acc = accentColor();
    const info = musicData(baseChord, op);
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.37;
    nodePos = [];

    c2d.strokeStyle = 'rgba(255,255,255,0.12)';
    c2d.lineWidth = 1.2;
    c2d.beginPath(); c2d.arc(cx, cy, R, 0, Math.PI * 2); c2d.stroke();

    for (let i = 0; i < 12; i++) {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / 12;
      nodePos.push({ x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang });
    }

    // Draw mirror axis if inversion
    if (op.m === 1) {
      const ang = -Math.PI / 2 + (op.k * Math.PI) / 12;
      c2d.save();
      c2d.setLineDash([6, 4]);
      c2d.strokeStyle = '#f472b6';
      c2d.lineWidth = 2;
      c2d.beginPath();
      c2d.moveTo(cx - Math.cos(ang) * R * 1.18, cy - Math.sin(ang) * R * 1.18);
      c2d.lineTo(cx + Math.cos(ang) * R * 1.18, cy + Math.sin(ang) * R * 1.18);
      c2d.stroke();
      c2d.restore();
    }

    // Original chord dashed outline
    if (baseChord.length >= 2) {
      c2d.save();
      c2d.setLineDash([4, 4]);
      c2d.strokeStyle = 'rgba(255,255,255,0.28)';
      c2d.lineWidth = 1.4;
      c2d.beginPath();
      baseChord.forEach((p, idx) => {
        const pt = nodePos[p];
        if (idx === 0) c2d.moveTo(pt.x, pt.y); else c2d.lineTo(pt.x, pt.y);
      });
      c2d.closePath();
      c2d.stroke();
      c2d.restore();
    }

    // Transformed chord polygon
    if (info.chord.length >= 2) {
      c2d.beginPath();
      info.chord.forEach((p, idx) => {
        const pt = nodePos[p];
        if (idx === 0) c2d.moveTo(pt.x, pt.y); else c2d.lineTo(pt.x, pt.y);
      });
      c2d.closePath();
      c2d.fillStyle = op.m ? 'rgba(244, 114, 182, 0.18)' : 'rgba(96, 165, 250, 0.18)';
      c2d.fill();
      c2d.strokeStyle = op.m ? '#f472b6' : acc;
      c2d.lineWidth = 2.2;
      c2d.stroke();
    }

    const activeSet = new Set(info.chord);
    for (let i = 0; i < 12; i++) {
      const pt = nodePos[i];
      const on = activeSet.has(i);
      c2d.beginPath(); c2d.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
      c2d.fillStyle = on ? (op.m ? '#f472b6' : acc) : '#090d16';
      c2d.fill();
      c2d.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.24)';
      c2d.lineWidth = on ? 2 : 1.2;
      c2d.stroke();

      c2d.fillStyle = on ? '#000' : '#e4e4e7';
      c2d.font = '700 10px ui-monospace, monospace';
      c2d.textAlign = 'center';
      c2d.textBaseline = 'middle';
      c2d.fillText(PITCH_NAMES[i], pt.x, pt.y + 0.5);

      // Pitch number outside
      const ox = cx + (R + 24) * Math.cos(pt.ang);
      const oy = cy + (R + 24) * Math.sin(pt.ang);
      c2d.fillStyle = 'rgba(255,255,255,0.42)';
      c2d.font = '10px ui-monospace, monospace';
      c2d.fillText(String(i), ox, oy);
    }

    c2d.fillStyle = 'rgba(255,255,255,0.78)';
    c2d.font = '600 13px ui-monospace, monospace';
    c2d.fillText(info.opLabel, cx, cy);
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(310, Math.max(240, cw * 0.64)), draw, clean);

  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bestD = 24;
    nodePos.forEach((pt, i) => {
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      // Toggle pitch on currently displayed chord, resetting op to identity
      const cur = musicApply(baseChord, op);
      const set = new Set(cur);
      if (set.has(best) && set.size > 1) set.delete(best);
      else set.add(best);
      baseChord = [...set].sort((a, b) => a - b);
      op = dEl(12, 0, 0);
      updateInfo();
      canvasCtl.render();
    }
  });

  host.querySelectorAll('[data-mop]').forEach(btn => {
    btn.onclick = () => {
      const m = btn.dataset.mop;
      if (m === 'tp') op = dMul(12, dEl(12, 1, 0), op);
      else if (m === 'tm') op = dMul(12, dEl(12, -1, 0), op);
      else if (m === 'inv') op = dMul(12, dEl(12, 0, 1), op);
      else op = dEl(12, 0, 0);
      updateInfo();
      canvasCtl.render();
    };
  });

  host.querySelectorAll('[data-ch]').forEach(btn => {
    btn.onclick = () => {
      baseChord = btn.dataset.ch.split(',').map(Number);
      op = dEl(12, 0, 0);
      updateInfo();
      canvasCtl.render();
    };
  });

  updateInfo();
  return clean.run;
}

// =====================================================================
// 15. orbits — Circular orbits & LCM alignment times
// =====================================================================

function mountOrbits(host, params, ctx) {
  const clean = createClean(ctx);
  const periods = (Array.isArray(params.periods) && params.periods.length >= 2 ? params.periods : [3, 4, 5])
    .map(x => Math.max(2, Math.trunc(x)));
  let t = 0;
  let playing = false;
  let speed = 1;

  host.innerHTML = `<div class="gp-model">
    <div class="gp-model-head">
      <div class="gp-model-title">Dairesel Yörüngeler ve Hizalanma Periyodu</div>
      <div class="gp-model-sub">Periyotlar $T = (${periods.join(', ')})$ gün; faz uzayı $\\prod \\mathbb{Z}_{T_i}$ ve ortak hizalanma periyodu $\\operatorname{ekok}(T_i)$.</div>
    </div>
    <div class="gp-model-bar">
      <button type="button" class="btn small primary" data-play>${icon('play')} Oynat</button>
      <button type="button" class="btn small" data-day>+1 Gün</button>
      <button type="button" class="btn small" data-align>Sonraki Hizalanma</button>
      <button type="button" class="btn small ghost" data-spd>Hız: 1×</button>
      <button type="button" class="btn small ghost" data-reset>Sıfırla (t=0)</button>
    </div>
    <div class="gp-canvas-wrap"><canvas class="gp-canvas" aria-label="Dairesel gezegen yörüngeleri çizimi"></canvas></div>
    <div data-kpis></div>
  </div>`;
  const subEl = host.querySelector('.gp-model-sub');
  if (subEl) subEl.innerHTML = richTex(subEl.textContent);

  const cv = host.querySelector('canvas');
  const kpiHost = host.querySelector('[data-kpis]');
  const playBtn = host.querySelector('[data-play]');
  const spdBtn = host.querySelector('[data-spd]');

  const updateInfo = () => {
    const data = orbitsData(periods, t);
    const phases = data.bodies.map(b => b.intPhase).join(', ');
    kpiHost.innerHTML = kpiStrip([
      { label: 'Zaman t', val: `${fmtNum(t, 2)} gün${data.alignedNow ? ' ★ HİZALI!' : ''}`, mono: true, acc: true },
      { label: 'Hizalanma (EKOK)', val: `${data.alignPeriod} gün`, mono: true },
      { label: 'Faz Demeti (t mod Tᵢ)', val: `(${phases})`, mono: true },
      { label: 'Grup Devirli mi?', val: data.isCyclic ? '✓ Evet (Çin Kalanı)' : `✗ Hayır (indeks ${data.index})` },
    ]);
  };

  const draw = (c2d, W, H) => {
    c2d.clearRect(0, 0, W, H);
    const data = orbitsData(periods, t);
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.41;
    const minR = Math.max(28, maxR * 0.3);
    const cnt = data.bodies.length;

    // Alignment reference ray (angle = 0, +x)
    c2d.save();
    c2d.strokeStyle = data.alignedNow ? '#fbbf24' : 'rgba(255,255,255,0.16)';
    c2d.lineWidth = data.alignedNow ? 2.6 : 1.2;
    if (!data.alignedNow) c2d.setLineDash([4, 4]);
    c2d.beginPath(); c2d.moveTo(cx, cy); c2d.lineTo(cx + maxR + 18, cy); c2d.stroke();
    c2d.restore();

    // Central star
    const grd = c2d.createRadialGradient(cx, cy, 2, cx, cy, 14);
    grd.addColorStop(0, '#fef08a');
    grd.addColorStop(1, 'rgba(251,191,36,0)');
    c2d.fillStyle = grd;
    c2d.beginPath(); c2d.arc(cx, cy, 14, 0, Math.PI * 2); c2d.fill();
    c2d.fillStyle = '#fbbf24';
    c2d.beginPath(); c2d.arc(cx, cy, 6, 0, Math.PI * 2); c2d.fill();

    data.bodies.forEach((b, i) => {
      const r = cnt === 1 ? maxR : minR + ((maxR - minR) * i) / (cnt - 1);
      const col = colorAt(i);
      c2d.strokeStyle = 'rgba(255,255,255,0.14)';
      c2d.lineWidth = 1.2;
      c2d.beginPath(); c2d.arc(cx, cy, r, 0, Math.PI * 2); c2d.stroke();

      const px = cx + r * Math.cos(-b.angle);
      const py = cy + r * Math.sin(-b.angle);
      c2d.beginPath(); c2d.arc(px, py, 7.5, 0, Math.PI * 2);
      c2d.fillStyle = col; c2d.fill();
      c2d.strokeStyle = '#090d16'; c2d.lineWidth = 1.5; c2d.stroke();

      c2d.fillStyle = col;
      c2d.font = '600 10.5px ui-monospace, monospace';
      c2d.textAlign = 'left';
      c2d.fillText(`T=${b.period}`, px + 10, py - 6);
    });
  };

  const canvasCtl = setupCanvas(cv, cw => Math.min(300, Math.max(220, cw * 0.6)), draw, clean);
  const loop = createAnimLoop((_now, dt) => {
    if (!playing) return false;
    t += dt * 1.4 * speed;
    updateInfo();
    canvasCtl.render();
    return true;
  }, clean);

  playBtn.onclick = () => {
    playing = !playing;
    playBtn.innerHTML = playing ? `${icon('pause')} Duraklat` : `${icon('play')} Oynat`;
    if (playing) loop.start();
    else loop.stop();
  };
  host.querySelector('[data-day]').onclick = () => {
    playing = false; loop.stop();
    playBtn.innerHTML = `${icon('play')} Oynat`;
    t = Math.floor(t + 1e-6) + 1;
    updateInfo();
    canvasCtl.render();
  };
  host.querySelector('[data-align]').onclick = () => {
    playing = false; loop.stop();
    playBtn.innerHTML = `${icon('play')} Oynat`;
    const L = orbitsData(periods, t).alignPeriod;
    t = (Math.floor(t / L + 1e-6) + 1) * L;
    updateInfo();
    canvasCtl.render();
  };
  spdBtn.onclick = () => {
    speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
    spdBtn.textContent = `Hız: ${speed}×`;
  };
  host.querySelector('[data-reset]').onclick = () => {
    playing = false; loop.stop();
    playBtn.innerHTML = `${icon('play')} Oynat`;
    t = 0;
    updateInfo();
    canvasCtl.render();
  };

  updateInfo();
  return clean.run;
}

// =====================================================================
// 16. lights — Lights Out over Z_2^N with GF(2) rank/kernel/solver
// =====================================================================

function mountLights(host, params, ctx) {
  const clean = createClean(ctx);
  const sys = lightsSystem(params.rows || 3, params.cols || 3);
  let state = (1 << sys.N) - 1; // start all ON
  let editMode = false;
  let hintMask = 0;

  const render = () => {
    const solvable = sys.isSolvable(state);
    const allOff = state === 0;

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">Işıklar Söndü · ${sys.rows}×${sys.cols} (${tex(`\\mathbb{Z}_2^{${sys.N}}`)})</div>
        <div class="gp-model-sub">${editMode ? 'Düzenleme modu: tek tek lambaları açıp kapatarak hedef desen kurun.' : 'Oyun modu: bir hücreye basınca kendisi ve dik komşuları tersine döner.'}</div>
      </div>
      <div class="gp-model-bar">
        <button type="button" class="btn small${!editMode ? ' primary' : ''}" data-mode="play">Oyna</button>
        <button type="button" class="btn small${editMode ? ' primary' : ''}" data-mode="edit">Desen Düzenle</button>
        <button type="button" class="btn small" data-act="hint">Çözüm ipucu</button>
        <button type="button" class="btn small ghost" data-act="rand">Rastgele Çözülebilir</button>
        <button type="button" class="btn small ghost" data-act="all">Tümü Açık</button>
        <button type="button" class="btn small ghost" data-act="zero">Sıfırla</button>
      </div>
      <div class="gp-lights-wrap">
        <div class="gp-lights-grid" style="--cols:${sys.cols}" role="grid" aria-label="${sys.rows} çarpı ${sys.cols} ışıklar söndü tahtası">
          ${Array.from({ length: sys.N }, (_, i) => {
            const on = Boolean((state >> i) & 1);
            const hinted = Boolean((hintMask >> i) & 1);
            return `<button type="button" class="gp-light-btn${on ? ' on' : ''}${hinted ? ' hint' : ''}" data-li="${i}" aria-pressed="${on}" aria-label="Hücre ${i + 1}: ${on ? 'açık (1)' : 'kapalı (0)'}${hinted ? ', çözüm düğmesi' : ''}">
              <span class="gp-light-idx">${i + 1}</span>
              <span class="gp-light-val mono">${on ? '1' : '0'}</span>
              ${hinted ? '<span class="gp-light-star" aria-hidden="true">★</span>' : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="gp-p15-side">
          ${kpiStrip([
            { label: 'Durum', val: allOff ? '★ Tümü Söndü!' : (solvable ? '✓ Çözülebilir (∈ im A)' : '✗ Çözülemez (∉ im A)'), acc: true },
            { label: 'GF(2) Rank r', val: `${sys.rank} / ${sys.N}`, mono: true },
            { label: '|im A| = 2ʳ', val: `${sys.imageOrder} / ${sys.groupOrder}`, mono: true },
            { label: '|ker A| = 2^(N−r)', val: String(sys.kernelOrder), mono: true },
          ])}
        </div>
      </div>
    </div>`;

    host.querySelectorAll('[data-li]').forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.li);
        if (editMode) {
          state ^= 1 << i;
        } else {
          state ^= sys.colMasks[i];
        }
        hintMask = 0;
        render();
      };
    });
    host.querySelectorAll('[data-mode]').forEach(btn => {
      btn.onclick = () => { editMode = btn.dataset.mode === 'edit'; render(); };
    });
    host.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = () => {
        const a = btn.dataset.act;
        if (a === 'hint') {
          const sol = sys.solve(state);
          hintMask = sol === null ? 0 : sol;
        } else if (a === 'rand') {
          const rBtn = 1 + Math.floor(Math.random() * ((1 << sys.N) - 1));
          state = sys.applyButtons(rBtn);
          hintMask = 0;
        } else if (a === 'all') {
          state = (1 << sys.N) - 1;
          hintMask = 0;
        } else {
          state = 0;
          hintMask = 0;
        }
        render();
      };
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// 17. pauli — 16-element Pauli group P_1 multiplication table
// =====================================================================

function mountPauli(host, _params, ctx) {
  const clean = createClean(ctx);
  const P = pauliGroupData();
  let filter = 'all';
  let selA = 4, selB = 8; // X and Y by default -> X·Y = iZ!

  const q8Set = new Set(P.q8Indices);
  const zSet = new Set(P.center);

  const render = () => {
    const prod = P.mul(selA, selB);
    const rev = P.mul(selB, selA);
    const comm = P.comm(selA, selB);
    const conj = P.conj(selB, selA);
    const commutes = prod === rev;

    const hiElem = idx => {
      if (filter === 'center') return zSet.has(idx);
      if (filter === 'q8') return q8Set.has(idx);
      if (filter === 'ord4') return P.ord[idx] === 4;
      return true;
    };

    const classOf = new Map();
    P.conjClasses.forEach((cls, ci) => cls.forEach(x => classOf.set(x, ci)));

    const rowsHtml = P.elems.map((ea, i) => {
      const cells = P.elems.map((eb, j) => {
        const p = P.table[i][j];
        const eP = P.elems[p];
        const isSel = i === selA && j === selB;
        const dim = filter !== 'all' && filter !== 'conj' && !(hiElem(i) && hiElem(j));
        const bg = filter === 'conj'
          ? colorAt(classOf.get(p)) + '2a'
          : colorAt(eP.baseIdx) + (eP.idx === 0 ? '38' : '1d');
        return `<td class="${isSel ? 'sel' : ''}${dim ? ' dim' : ''}${j % 4 === 3 && j < 15 ? ' blk-r' : ''}" style="background:${bg}" data-pa="${i}" data-pb="${j}">${esc(eP.label)}</td>`;
      }).join('');
      return `<tr class="${i % 4 === 3 && i < 15 ? 'blk-b' : ''}"><th scope="row">${esc(ea.label)}</th>${cells}</tr>`;
    }).join('');

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">Tek-Kübit Pauli Grubu · ${tex('P_1 = \\{\\pm 1, \\pm i\\} \\times \\{I, X, Y, Z\\}')} (|P₁| = 16)</div>
        <div class="gp-model-sub">Hücrelere tıklayarak çarpım, komütatör ve eşlenik özelliklerini inceleyin.</div>
      </div>
      <div class="gp-model-bar">
        ${[
          ['all', 'Tümü'],
          ['center', 'Merkez Z(P₁) = ⟨iI⟩'],
          ['q8', 'Kuaterniyon Q₈'],
          ['ord4', 'Mertebe 4'],
          ['conj', 'Eşlenik Sınıfları (10)'],
        ].map(([k, lbl]) => `<button type="button" class="gp-chip${filter === k ? ' on' : ''}" data-pf="${k}">${esc(lbl)}</button>`).join('')}
      </div>
      <div class="gp-detail-box">
        <div class="mono">
          <b>${esc(P.elems[selA].label)} · ${esc(P.elems[selB].label)} = ${esc(P.elems[prod].label)}</b>
          &nbsp;|&nbsp; ters sıra: ${esc(P.elems[selB].label)} · ${esc(P.elems[selA].label)} = ${esc(P.elems[rev].label)}
          &nbsp;(${commutes ? '✓ değişmeli' : '✗ ters-değişmeli'})
        </div>
        <div class="small mute mono">
          [a,b] = ${esc(P.elems[comm].label)} · b⁻¹ab = ${esc(P.elems[conj].label)} · mertebeler: |a|=${P.ord[selA]}, |b|=${P.ord[selB]}, |ab|=${P.ord[prod]}
        </div>
      </div>
      <div class="gp-table-wrap">
        <table class="gp-cayley gp-pauli-tbl" aria-label="16 elemanlı Pauli grubu çarpım tablosu">
          <thead><tr><th scope="col">·</th>${P.elems.map((e, j) => `<th scope="col" class="${j % 4 === 3 && j < 15 ? 'blk-r' : ''}">${esc(e.label)}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

    host.querySelectorAll('[data-pf]').forEach(btn => {
      btn.onclick = () => { filter = btn.dataset.pf; render(); };
    });
    host.querySelectorAll('[data-pa]').forEach(td => {
      td.onclick = () => { selA = Number(td.dataset.pa); selB = Number(td.dataset.pb); render(); };
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// 18. cayley — Course-convention Cayley multiplication table
// =====================================================================

function mountCayley(host, params, ctx) {
  const clean = createClean(ctx);
  const data = cayleyModelData(params || { kind: 'D', n: 4 });
  let selA = data.size > 1 ? 1 : 0;
  let selB = data.size > 2 ? 2 : 0;
  let focusElem = -1;

  const render = () => {
    const prod = data.table[selA][selB];
    const rev = data.table[selB][selA];
    const invA = data.inv(selA);
    const invB = data.inv(selB);

    const rowsHtml = data.elements.map((ea, i) => {
      const tds = data.elements.map((_, j) => {
        const p = data.table[i][j];
        const isSel = i === selA && j === selB;
        const isMatch = focusElem >= 0 && p === focusElem;
        const dim = focusElem >= 0 && p !== focusElem;
        const bg = p === 0 ? 'rgba(244,244,245,0.14)' : `${colorAt(p - 1)}24`;
        return `<td class="${isSel ? 'sel' : ''}${isMatch ? ' match' : ''}${dim ? ' dim' : ''}" style="background:${bg}" data-ca="${i}" data-cb="${j}">${esc(data.elements[p])}</td>`;
      }).join('');
      return `<tr><th scope="row">${esc(ea)}</th>${tds}</tr>`;
    }).join('');

    host.innerHTML = `<div class="gp-model">
      <div class="gp-model-head">
        <div class="gp-model-title">Cayley Çarpım Tablosu · ${tex(data.latex)} (|G| = ${data.size})</div>
        <div class="gp-model-sub">Satır elemanı solda, sütun elemanı sağda çarpılır (sağdan sola konvansiyon). Bir elemanı filtreleyerek Latin karesi özelliğini görün.</div>
      </div>
      ${kpiStrip([
        { label: 'Mertebe |G|', val: String(data.size), mono: true, acc: true },
        { label: 'Abelyen mi?', val: data.isAbelian ? '✓ Evet' : '✗ Hayır' },
        { label: 'Devirli mi?', val: data.isCyclic ? '✓ Evet' : '✗ Hayır' },
        { label: 'Merkez |Z(G)|', val: String(data.centerSize), mono: true },
      ])}
      <div class="gp-elem-bar">
        <span class="mute small">Eleman vurgula:</span>
        <button type="button" class="gp-chip${focusElem === -1 ? ' on' : ''}" data-cf="-1">Tümü</button>
        ${data.elements.slice(0, 16).map((el, i) => `<button type="button" class="gp-chip${focusElem === i ? ' on' : ''}" data-cf="${i}">${esc(el)}</button>`).join('')}
      </div>
      <div class="gp-detail-box">
        <div class="mono">
          <b>${esc(data.elements[selA])} ${esc(data.op)} ${esc(data.elements[selB])} = ${esc(data.elements[prod])}</b>
          &nbsp;|&nbsp; ters sıra: ${esc(data.elements[selB])} ${esc(data.op)} ${esc(data.elements[selA])} = ${esc(data.elements[rev])}
          &nbsp;(${prod === rev ? '✓ değişmeli' : '≠ değişmeli değil'})
        </div>
        <div class="small mute mono">
          a⁻¹ = ${esc(data.elements[invA])}, b⁻¹ = ${esc(data.elements[invB])} · |a|=${data.ord(selA)}, |b|=${data.ord(selB)}, |ab|=${data.ord(prod)}
        </div>
      </div>
      <div class="gp-table-wrap">
        <table class="gp-cayley" aria-label="${esc(data.name)} Cayley çarpım tablosu">
          <thead><tr><th scope="col">${esc(data.op)}</th>${data.elements.map(el => `<th scope="col">${esc(el)}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

    host.querySelectorAll('[data-cf]').forEach(btn => {
      btn.onclick = () => { focusElem = Number(btn.dataset.cf); render(); };
    });
    host.querySelectorAll('[data-ca]').forEach(td => {
      td.onclick = () => { selA = Number(td.dataset.ca); selB = Number(td.dataset.cb); render(); };
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// Model Dispatcher
// =====================================================================

const MODEL_MOUNTS = {
  polygon: mountPolygon,
  cyclic: mountCyclic,
  sublattice: mountSublattice,
  cosets: mountCosets,
  hom: mountHom,
  torus: mountTorus,
  wheel: mountWheel,
  brillouin: mountBrillouin,
  shuffle: mountShuffle,
  puzzle15: mountPuzzle15,
  cube: mountCube,
  molecule: mountMolecule,
  velocity: mountVelocity,
  music: mountMusic,
  orbits: mountOrbits,
  lights: mountLights,
  pauli: mountPauli,
  cayley: mountCayley,
};

export const MODEL_IDS = Object.keys(MODEL_MOUNTS);

export function mountModel(host, id, params = {}, ctx = {}) {
  const fn = MODEL_MOUNTS[id];
  if (!fn) {
    host.innerHTML = `<div class="gp-model"><div class="gp-err">Bilinmeyen etkileşimli model: ${esc(id)}</div></div>`;
    return () => {};
  }
  return fn(host, params || {}, ctx || {});
}
