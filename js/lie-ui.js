// MathPad Lie Module Shared UI Helpers (KaTeX, Canvas, Power-Aware rAF, Dynkin SVG, Lessons & Quiz)
import { esc, icon, toast } from './ui.js';
import { motion, full, asleep, constellationBurst, syncSegments } from './fx.js';
import { generateLieQuizQuestion } from './lie.js';

export function ensureLieCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[href*="lie.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/lie.css';
  document.head.append(link);
}

export function tex(s, displayMode = false) {
  if (typeof window !== 'undefined' && window.katex) {
    return window.katex.renderToString(String(s ?? ''), {
      throwOnError: false,
      strict: false,
      displayMode,
    });
  }
  return `<span class="mono">${esc(s)}</span>`;
}

export function richTex(str) {
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

export function accentColor() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '#60a5fa';
  return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#f4f4f5';
}

export function createClean(ctx) {
  const fns = [];
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    while (fns.length) {
      try { fns.pop()(); } catch { }
    }
  };
  ctx?.clean?.add?.(run);
  return {
    add(fn) { if (typeof fn === 'function') fns.push(fn); },
    run,
  };
}

export function setupCanvas(cv, heightForWidth, onDraw, clean) {
  let W = 320, H = 260, dpr = 1;
  const render = () => {
    const c2d = cv.getContext?.('2d');
    if (!c2d) return;
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    onDraw(c2d, W, H);
  };
  const resize = () => {
    const parent = cv.parentElement;
    if (!parent) return;
    const cw = Math.max(220, Math.floor(parent.clientWidth || 320));
    const ch = Math.max(180, Math.floor(heightForWidth(cw)));
    dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    W = cw;
    H = ch;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    render();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro && cv.parentElement) ro.observe(cv.parentElement);
  const onTheme = () => render();
  if (typeof window !== 'undefined') window.addEventListener('mp-theme', onTheme);
  clean.add(() => {
    ro?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('mp-theme', onTheme);
  });
  resize();
  return { render, resize, size: () => ({ W, H }) };
}

export function createAnimLoop(tick, clean) {
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
  if (typeof window !== 'undefined') window.addEventListener('mp-vis', onVis);
  clean.add(() => {
    dead = true;
    stop();
    if (typeof window !== 'undefined') window.removeEventListener('mp-vis', onVis);
  });
  return { start, stop, isRunning: () => want };
}

export function fmtDynkin(w) {
  return `(${w.join(', ')})`;
}

export function fmtBigInt(v) {
  const s = typeof v === 'bigint' ? v.toString() : String(v);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function renderDynkinSvg(nodes, edges, {
  selectedIdx = -1,
  deletedIdx = -1,
  showMarks = true,
  showComarks = false,
  isSuper = false,
  ariaLabel = 'Dynkin diyagramı',
  stepX = 76,
  stepY = 62,
  padX = 48,
  padY = 44,
} = {}) {
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = Math.max(180, Math.round((maxX - minX) * stepX + 2 * padX));
  const H = Math.max(112, Math.round((maxY - minY) * stepY + 2 * padY));
  const px = x => padX + (x - minX) * stepX;
  const py = y => padY + (y - minY) * stepY;

  const nodeMap = new Map(nodes.map(n => [n.index, n]));
  const edgeSvg = [];

  for (const e of edges) {
    const a = nodeMap.get(e.from);
    const b = nodeMap.get(e.to);
    if (!a || !b) continue;
    const x1 = px(a.x), y1 = py(a.y);
    const x2 = px(b.x), y2 = py(b.y);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const rPad = 14;
    const sx = x1 + ux * rPad, sy = y1 + uy * rPad;
    const ex = x2 - ux * rPad, ey = y2 - uy * rPad;
    const isDel = e.from === deletedIdx || e.to === deletedIdx;
    const isAff = !!a.isAffine || !!b.isAffine;
    const cls = `lie-dyn-edge${isAff ? ' affine' : ''}`;
    const op = isDel ? ' opacity="0.16"' : '';

    const offsets = e.mult === 3 ? [-5, 0, 5] : e.mult === 2 ? [-3.5, 3.5] : [0];
    for (const off of offsets) {
      edgeSvg.push(`<line class="${cls}"${op} x1="${(sx + nx * off).toFixed(1)}" y1="${(sy + ny * off).toFixed(1)}" x2="${(ex + nx * off).toFixed(1)}" y2="${(ey + ny * off).toFixed(1)}"/>`);
    }

    const drawArrow = (mx, my, dirSign) => {
      const tipX = mx + ux * 6 * dirSign;
      const tipY = my + uy * 6 * dirSign;
      const baseX = mx - ux * 5 * dirSign;
      const baseY = my - uy * 5 * dirSign;
      const p1x = baseX + nx * 7, p1y = baseY + ny * 7;
      const p2x = baseX - nx * 7, p2y = baseY - ny * 7;
      edgeSvg.push(`<polygon class="lie-dyn-arrow"${op} points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}"/>`);
    };

    if (e.dir === 1 || e.dir === -1) {
      drawArrow((x1 + x2) / 2, (y1 + y2) / 2, e.dir);
    } else if (e.dir === 2) {
      drawArrow(x1 + dx * 0.34, y1 + dy * 0.34, -1);
      drawArrow(x1 + dx * 0.66, y1 + dy * 0.66, 1);
    }
  }

  const nodeSvg = nodes.map(nd => {
    const cx = px(nd.x), cy = py(nd.y);
    const on = nd.index === selectedIdx ? ' on' : '';
    const del = nd.index === deletedIdx ? ' deleted' : '';
    let cCls = 'long';
    if (isSuper) {
      cCls = nd.kind === 'isotropic' ? 'super-iso' : nd.kind === 'non-isotropic' ? 'super-black' : 'long';
    } else if (nd.isAffine) {
      cCls = 'affine';
    } else if (nd.isLong === false) {
      cCls = 'short';
    }
    const cross = isSuper && nd.kind === 'isotropic'
      ? `<line x1="${(cx - 7.5).toFixed(1)}" y1="${(cy - 7.5).toFixed(1)}" x2="${(cx + 7.5).toFixed(1)}" y2="${(cy + 7.5).toFixed(1)}" stroke="#ffd166" stroke-width="2"/><line x1="${(cx - 7.5).toFixed(1)}" y1="${(cy + 7.5).toFixed(1)}" x2="${(cx + 7.5).toFixed(1)}" y2="${(cy - 7.5).toFixed(1)}" stroke="#ffd166" stroke-width="2"/>`
      : '';
    const markTxt = showMarks && nd.mark != null
      ? (showComarks && nd.comark != null && nd.comark !== nd.mark ? `a=${nd.mark} (a∨=${nd.comark})` : `a=${nd.mark}`)
      : '';
    const lblBelow = nd.y > 0.2 ? cy + 28 : cy + 27;
    const markAbove = nd.y < -0.2 ? cy - 20 : cy - 19;
    return `<g class="lie-dyn-node${on}${del}" data-node="${nd.index}" role="button" tabindex="0" aria-label="Düğüm ${esc(nd.label)}">
      <circle class="${cCls}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="12.5"/>
      ${cross}
      <text class="lie-dyn-lbl" x="${cx.toFixed(1)}" y="${lblBelow.toFixed(1)}">${esc(nd.label)}</text>
      ${markTxt ? `<text class="lie-dyn-mark" x="${cx.toFixed(1)}" y="${markAbove.toFixed(1)}">${esc(markTxt)}</text>` : ''}
    </g>`;
  }).join('');

  return `<div class="lie-svg-scroll"><svg class="lie-dynkin-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${edgeSvg.join('')}${nodeSvg}</svg></div>`;
}

export const ALGEBRA_FAMILIES = [
  { id: 'A', label: 'A_n · SU(n+1)', min: 1, max: 8, def: 2 },
  { id: 'B', label: 'B_n · SO(2n+1)', min: 2, max: 8, def: 2 },
  { id: 'C', label: 'C_n · Sp(2n)', min: 2, max: 8, def: 2 },
  { id: 'D', label: 'D_n · SO(2n)', min: 3, max: 8, def: 4 },
  { id: 'G', label: 'G₂', min: 2, max: 2, def: 2 },
  { id: 'F', label: 'F₄', min: 4, max: 4, def: 4 },
  { id: 'E6', label: 'E₆', type: 'E', min: 6, max: 6, def: 6 },
  { id: 'E7', label: 'E₇', type: 'E', min: 7, max: 7, def: 7 },
  { id: 'E8', label: 'E₈', type: 'E', min: 8, max: 8, def: 8 },
];

export function renderAlgebraPicker(type, rank, { maxRank = 8, allowA1 = true } = {}) {
  const curKey = type === 'E' ? `E${rank}` : type;
  const fam = ALGEBRA_FAMILIES.find(f => f.id === curKey) || ALGEBRA_FAMILIES[0];
  const minR = fam.id === 'A' && !allowA1 ? 2 : fam.min;
  const maxR = Math.min(fam.max, maxRank);
  const showRank = minR < maxR;

  return `<div class="lie-toolbar">
    <div class="lie-chips" role="group" aria-label="Basit Lie cebiri ailesi">
      ${ALGEBRA_FAMILIES.filter(f => f.min <= maxRank).map(f => `<button type="button" class="lie-chip ${f.id === curKey ? 'on' : ''}" data-afam="${f.id}">${esc(f.label.split(' ')[0])}</button>`).join('')}
    </div>
    ${showRank ? `<div class="lie-toolbar-g">
      <label class="row" style="gap:6px"><span class="small mute">Rank n:</span>
        <select class="inp lie-sel" data-arank aria-label="Cebir rankı">
          ${Array.from({ length: maxR - minR + 1 }, (_, i) => minR + i).map(r => `<option value="${r}" ${r === rank ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </label>
    </div>` : ''}
  </div>`;
}

export function bindAlgebraPicker(host, curType, curRank, onChange, { maxRank = 8, allowA1 = true } = {}) {
  host.querySelectorAll('[data-afam]').forEach(btn => {
    btn.onclick = () => {
      const f = ALGEBRA_FAMILIES.find(x => x.id === btn.dataset.afam);
      if (!f) return;
      const nextT = f.type || f.id;
      const minR = f.id === 'A' && !allowA1 ? 2 : f.min;
      const maxR = Math.min(f.max, maxRank);
      const nextR = f.min === f.max ? f.min : Math.max(minR, Math.min(maxR, curType === nextT ? curRank : f.def));
      onChange(nextT, nextR);
    };
  });
  const sel = host.querySelector('[data-arank]');
  if (sel) {
    sel.onchange = () => onChange(curType, Math.trunc(+sel.value));
  }
}

export function makeLessonsTab(lessons, heading) {
  return function mountLieLessons(host, _G, ctx) {
    ensureLieCss();
    host.innerHTML = `<div class="lie-stage">
      <div class="lie-panel">
        <div class="lie-panel-head">
          <h3 class="lie-panel-title">${esc(heading)} (${lessons.length} Bölüm)</h3>
          <div class="lie-toolbar-g">
            <button type="button" class="btn small ghost" data-all-open>Tümünü aç</button>
            <button type="button" class="btn small ghost" data-all-close>Tümünü kapat</button>
          </div>
        </div>
        <div class="grp-toc">
          ${lessons.map((l, i) => `<button type="button" class="lie-chip" data-jump-l="${i}">${esc(l.section)} · ${esc(l.tag)}</button>`).join('')}
        </div>
      </div>

      ${lessons.map((l, i) => `<details class="grp-lesson" data-lidx="${i}" ${i < 2 ? 'open' : ''}>
        <summary>
          <span class="row" style="gap:10px"><span class="grp-lesson-num">${esc(l.section)}</span><span>${esc(l.title)}</span></span>
          <span class="lie-pill">${esc(l.tag)}</span>
        </summary>
        <div class="grp-lesson-body">
          ${l.body.map(p => `<p>${richTex(p)}</p>`).join('')}
          <div class="grp-theorem-box">${l.theorem.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>
          <div class="grp-example-box">${l.example.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>
          <div class="grp-lesson-foot">
            <span class="mute small">Etkileşimli laboratuvarda canlı hesapla ve görselleştir</span>
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
        const l = lessons[+b.dataset.applyL];
        ctx?.jumpTo?.(l.apply.tab);
      };
    });
    return () => {};
  };
}

function loadStats(storeKey) {
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
}

function saveStats(storeKey, st) {
  try { localStorage.setItem(storeKey, JSON.stringify(st)); } catch { }
}

export function makeQuizTab({ chapter, storeKey, topics }) {
  return function mountLieQuiz(host, _G, ctx) {
    ensureLieCss();
    const clean = createClean(ctx);
    const stats = loadStats(storeKey);
    let topicFilter = chapter;
    let currentQ = null;
    let pickedIdx = null;

    const nextQuestion = () => {
      pickedIdx = null;
      currentQ = generateLieQuizQuestion(stats.difficulty, Math.random, topicFilter === 'ALL' ? '' : topicFilter);
      render();
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
          toast(`${stats.streak} doğru seri! Harika gidiyorsun ✦`);
        }
      } else {
        stats.streak = 0;
      }
      saveStats(storeKey, stats);
      render();
    };

    const render = () => {
      const accPct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      const keys = ['A', 'B', 'C', 'D'];

      host.innerHTML = `<div class="lie-stage">
        <div class="lie-toolbar">
          <div class="lie-toolbar-g">
            <div class="seg" data-diff role="tablist" aria-label="Zorluk seviyesi">
              ${[['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']].map(([k, l]) => `<button type="button" data-df="${k}" class="${stats.difficulty === k ? 'on' : ''}">${l}</button>`).join('')}
            </div>
            <select class="inp lie-sel" data-qtopic aria-label="Alıştırma konusu">
              ${topics.map(([k, l]) => `<option value="${esc(k)}" ${k === topicFilter ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn small ghost" data-qreset aria-label="İstatistikleri sıfırla">Skoru sıfırla</button>
        </div>

        <div class="lie-kpis">
          <div class="lie-kpi acc"><span class="lie-kpi-lbl">Doğru / Toplam</span><span class="lie-kpi-val mono">${stats.correct} / ${stats.total}</span><span class="lie-kpi-sub">%${accPct} başarı</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Mevcut Seri</span><span class="lie-kpi-val mono">${stats.streak}</span><span class="lie-kpi-sub">üst üste doğru</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">En İyi Seri</span><span class="lie-kpi-val mono">${stats.bestStreak}</span><span class="lie-kpi-sub">rekorun</span></div>
          <div class="lie-kpi"><span class="lie-kpi-lbl">Konu</span><span class="lie-kpi-val">${esc(currentQ.topic)}</span><span class="lie-kpi-sub">${esc(stats.difficulty.toUpperCase())}</span></div>
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

          ${pickedIdx !== null ? `<div class="lie-callout ${pickedIdx === currentQ.answerIndex ? 'ok' : 'bad'}" aria-live="polite">
            <b>${pickedIdx === currentQ.answerIndex ? '✓ Doğru!' : '✗ Yanlış cevap'}</b>
            <div>${richTex(currentQ.explanation)}</div>
          </div>
          <div class="row" style="justify-content:flex-end">
            <button type="button" class="btn primary" data-qnext>Sonraki soru →</button>
          </div>` : `<div class="small mute">Kısayol: klavyede <b>1–4</b> tuşlarıyla yanıtlayabilir, <b>Enter</b> ile sonraki soruya geçebilirsin.</div>`}
        </div>
      </div>`;

      host.querySelector('[data-diff]').onclick = e => {
        const b = e.target.closest('[data-df]'); if (!b) return;
        stats.difficulty = b.dataset.df;
        saveStats(storeKey, stats);
        nextQuestion();
      };
      host.querySelector('[data-qtopic]').onchange = e => {
        topicFilter = e.target.value;
        nextQuestion();
      };
      host.querySelector('[data-qreset]').onclick = () => {
        stats.correct = 0; stats.total = 0; stats.streak = 0; stats.bestStreak = 0;
        saveStats(storeKey, stats);
        render();
        toast('Alıştırma skoru sıfırlandı');
      };
      host.querySelectorAll('[data-qi]').forEach(btn => {
        btn.onclick = () => answer(+btn.dataset.qi, btn);
      });
      host.querySelector('[data-qnext]')?.addEventListener('click', nextQuestion);
      syncSegments(host, true);
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
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      clean.add(() => window.removeEventListener('keydown', onKey));
    }

    nextQuestion();
    return clean.run;
  };
}
