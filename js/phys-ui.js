// MathPad Physics & Exceptional Structures (Ramond Part C) — Shared UI Helpers
import { esc, icon, toast } from './ui.js';
import { motion, full, asleep, constellationBurst, syncSegments } from './fx.js';
import { PHYS_QUIZ_TOPICS, generatePhysQuizQuestion } from './physgroups.js';

export function ensurePhysCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[href*="phys.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/phys.css';
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
    // 60 fps is plenty for these simulations: on 120/144 Hz screens skip the in-between frames
    if (now - last < 1000 / 60 - 1.2) { raf = requestAnimationFrame(step); return; }
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

export function fmtNum(x, digits = 3) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-10) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  return Number(x.toFixed(digits)).toString();
}

export function fmtComplex(z, digits = 2) {
  const re = Math.abs(z[0]) < 1e-9 ? 0 : z[0];
  const im = Math.abs(z[1]) < 1e-9 ? 0 : z[1];
  if (re === 0 && im === 0) return '0';
  if (im === 0) return fmtNum(re, digits);
  const imAbs = Math.abs(im);
  const imPart = Math.abs(imAbs - 1) < 1e-9 ? 'i' : `${fmtNum(imAbs, digits)}i`;
  if (re === 0) return im < 0 ? `−${imPart}` : imPart;
  return `${fmtNum(re, digits)}${im < 0 ? '−' : '+'}${imPart}`;
}

export function renderComplexMatrix(M, { rowLabels = null, colLabels = null, ariaLabel = 'Matris', digits = 2 } = {}) {
  const rows = M.length;
  const cols = M[0]?.length || 0;
  const head = colLabels
    ? `<thead><tr><th scope="col"></th>${colLabels.map(l => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead>`
    : '';
  const body = M.map((row, i) => {
    const th = rowLabels ? `<th scope="row">${esc(rowLabels[i])}</th>` : '';
    const tds = row.map(z => {
      const val = Array.isArray(z) ? z : [z, 0];
      const mag = Math.hypot(val[0], val[1]);
      let cls = 'phy-zero';
      if (mag > 1e-9) {
        cls = (val[0] < -1e-9 && Math.abs(val[1]) < 1e-9) ? 'phy-neg' : 'phy-nz';
      }
      return `<td class="${cls}">${esc(fmtComplex(val, digits))}</td>`;
    }).join('');
    return `<tr>${th}${tds}</tr>`;
  }).join('');
  return `<div class="phy-mat-wrap"><table class="phy-mat" aria-label="${esc(ariaLabel)}">${head}<tbody>${body}</tbody></table></div>`;
}

export function renderRealMatrix(M, { rowLabels = null, colLabels = null, ariaLabel = 'Reel matris', digits = 3 } = {}) {
  return renderComplexMatrix(
    M.map(r => r.map(x => [x, 0])),
    { rowLabels, colLabels, ariaLabel, digits }
  );
}

export function fmtHalfInt(x) {
  const t = Math.round(2 * x);
  if (t % 2 === 0) return String(t / 2);
  return `${t}/2`;
}

export function fmtHalfIntTex(x) {
  const t = Math.round(2 * x);
  if (t % 2 === 0) return String(t / 2);
  return `${t < 0 ? '-' : ''}\\frac{${Math.abs(t)}}{2}`;
}

export function makeLessonsTab(lessons, heading) {
  return function mountPhysLessons(host, _G, ctx) {
    ensurePhysCss();
    const clean = createClean(ctx);

    host.innerHTML = `<div class="phy-stage">
      <div class="grp-panel">
        <div class="grp-panel-head">
          <h3 class="grp-panel-title">${esc(heading)}</h3>
          <div class="grp-toolbar-g">
            <button type="button" class="btn small ghost" data-all-open>Tümünü aç</button>
            <button type="button" class="btn small ghost" data-all-close>Tümünü kapat</button>
          </div>
        </div>
        <div class="grp-toc">
          ${lessons.map((l, i) => `<button type="button" class="grp-chip" data-jump-l="${i}">${esc(l.sec)} · ${esc(l.shortTitle || l.title.split(' ')[0])}</button>`).join('')}
        </div>
      </div>

      ${lessons.map((l, i) => `<details class="grp-lesson" data-lidx="${i}" ${i < 2 ? 'open' : ''}>
        <summary>
          <span class="row" style="gap:10px">
            <span class="grp-lesson-num">${i + 1}</span>
            <span>${esc(l.title)}</span>
          </span>
          <span class="phy-sec-tag">${esc(l.sec)}</span>
        </summary>
        <div class="grp-lesson-body">
          ${l.body.map(p => `<p>${richTex(p)}</p>`).join('')}
          ${l.theorem ? `<div class="grp-theorem-box">${l.theorem.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>` : ''}
          ${l.example ? `<div class="grp-example-box">${l.example.split('\n').map(line => `<p>${richTex(line)}</p>`).join('')}</div>` : ''}
          <div class="grp-lesson-foot">
            <span class="mute small">Etkileşimli simülasyonda canlı olarak incele</span>
            <button type="button" class="btn small primary" data-apply-l="${i}">${icon('play')} Uygula: ${esc(l.apply.label)} →</button>
          </div>
        </div>
      </details>`).join('')}
    </div>`;

    host.querySelector('[data-all-open]')?.addEventListener('click', () => {
      host.querySelectorAll('.grp-lesson').forEach(d => { d.open = true; });
    });
    host.querySelector('[data-all-close]')?.addEventListener('click', () => {
      host.querySelectorAll('.grp-lesson').forEach(d => { d.open = false; });
    });
    host.querySelectorAll('[data-jump-l]').forEach(b => {
      b.onclick = () => {
        const det = host.querySelector(`.grp-lesson[data-lidx="${b.dataset.jumpL}"]`);
        if (!det) return;
        det.open = true;
        det.scrollIntoView?.({ behavior: full() ? 'smooth' : 'auto', block: 'start' });
      };
    });
    host.querySelectorAll('[data-apply-l]').forEach(b => {
      b.onclick = () => {
        const l = lessons[+b.dataset.applyL];
        if (l?.apply?.tab) ctx?.jumpTo?.(l.apply.tab, l.apply.spec);
      };
    });

    return clean.run;
  };
}

export function makeQuizTab({ chapter, storeKey, chapterLabel }) {
  const chapterTopics = PHYS_QUIZ_TOPICS[chapter] || [];
  const topicOptions = [
    ['', `Karışık (tüm ${chapterLabel} konuları)`],
    ...chapterTopics,
    ['ALL', 'Tüm Fizik & Özel Yapılar karışık'],
  ];

  function loadStats() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storeKey) : null;
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

  function saveStats(st) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(storeKey, JSON.stringify(st));
    } catch { }
  }

  return function mountPhysQuiz(host, _G, ctx) {
    ensurePhysCss();
    const clean = createClean(ctx);
    const stats = loadStats();
    let topicFilter = '';
    let currentQ = null;
    let pickedIdx = null;

    const nextQ = () => {
      pickedIdx = null;
      const chArg = topicFilter === 'ALL' ? 'all' : chapter;
      const tpArg = (!topicFilter || topicFilter === 'ALL') ? null : topicFilter;
      currentQ = generatePhysQuizQuestion(chArg, stats.difficulty, Math.random, tpArg);
      render();
    };

    const render = () => {
      const accPct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      const keys = ['A', 'B', 'C', 'D'];

      host.innerHTML = `<div class="phy-stage">
        <div class="grp-toolbar">
          <div class="grp-toolbar-g">
            <div class="seg" data-diff role="tablist" aria-label="Zorluk seviyesi">
              ${[['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']].map(([k, l]) =>
                `<button type="button" data-df="${k}" class="${stats.difficulty === k ? 'on' : ''}">${l}</button>`
              ).join('')}
            </div>
            <select class="inp grp-sel" data-qtopic aria-label="Soru konusu">
              ${topicOptions.map(([k, l]) => `<option value="${esc(k)}" ${k === topicFilter ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn small ghost" data-qreset aria-label="Skoru sıfırla">Skoru sıfırla</button>
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
          </div>` : `<div class="small mute">Kısayol: klavyede <b>1–${currentQ.options.length}</b> tuşlarıyla yanıtlayabilir, <b>Enter</b> ile sonraki soruya geçebilirsin.</div>`}
        </div>
      </div>`;

      host.querySelector('[data-diff]')?.addEventListener('click', e => {
        const b = e.target.closest?.('[data-df]');
        if (!b) return;
        stats.difficulty = b.dataset.df;
        saveStats(stats);
        nextQ();
      });
      host.querySelector('[data-qtopic]')?.addEventListener('change', e => {
        topicFilter = e.target.value;
        nextQ();
      });
      host.querySelector('[data-qreset]')?.addEventListener('click', () => {
        stats.correct = 0; stats.total = 0; stats.streak = 0; stats.bestStreak = 0;
        saveStats(stats);
        render();
        toast('Alıştırma skoru sıfırlandı');
      });
      host.querySelectorAll('[data-qi]').forEach(btn => {
        btn.onclick = () => answer(+btn.dataset.qi, btn);
      });
      host.querySelector('[data-qnext]')?.addEventListener('click', nextQ);
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
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    clean.add(() => {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
    });

    nextQ();
    return clean.run;
  };
}
