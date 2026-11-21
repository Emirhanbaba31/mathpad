// MathPad Group Theory Problem Sets (FZT 203E) — Tabs for chapter 'problemler'.
// Exports TABS for js/groupcenter.js. Interactive models are imported lazily from ./gtps-models.js.
import { esc, icon, toast } from './ui.js';
import { richTex, createClean } from './phys-ui.js';
import { full, syncSegments } from './fx.js';
import { makeRng, checkAnswer, answerText } from './gtps-kit.js';
import {
  ALL_TEMPLATES, SCOPES, SOURCE_LABELS, LEVEL_LABELS, LEVELS,
  COURSE_CONVENTIONS, MODEL_CATALOG,
  plainText, getTemplatesForScope, groupedTemplateCatalog,
  normalizeSeed, encodeSetCode, parseSetCode, generateProblemSet,
  answerFormatHint, answerPlaceholder,
  createEmptyPartState, scorePart, scoreProblem, scoreSet,
  createEmptyStats, sanitizeStats, recordPracticeCheck, topicAccuracy,
} from './gtps-ui.js';

const KEY_CURRENT_SET = 'mp.gtps.currentSet';
const KEY_SET_PREFIX = 'mp.gtps.setState.';
const KEY_STATS = 'mp.gtps.stats';
const KEY_PRACTICE_PREF = 'mp.gtps.practicePref';

let modelsPromise = null;
const loadModels = () => (modelsPromise ??= import('./gtps-models.js'));

function ensureGtpsCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[href*="gtps.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/gtps.css';
  document.head.append(link);
}

function readJson(key, fallback) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) return JSON.parse(raw);
  } catch { }
  return fallback;
}

function writeJson(key, val) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
  } catch { }
}

function randomSeed5() {
  return 10000 + Math.floor(Math.random() * 89999);
}

function richParagraphs(str) {
  return String(str ?? '')
    .split(/\n\n+/)
    .map(p => `<p>${p.split('\n').map(line =>
      richTex(line).replace(/(^|[\s(])\*([A-Za-zÇĞİÖŞÜçğıöşü]+)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>')
    ).join('<br>')}</p>`)
    .join('');
}

function formatCanonicalAnswer(spec) {
  if (!spec) return '';
  const txt = answerText(spec);
  if (spec.type === 'choice' || spec.type === 'yesno') return richTex(txt);
  return `<span class="mono">${esc(txt)}</span>`;
}

function relatedCenterTab(problem) {
  const mid = problem?.model?.id;
  if (mid === 'polygon') return { id: 'simetri', label: 'Simetri Lab' };
  if (mid === 'cayley' || mid === 'pauli') return { id: 'cayley', label: 'Cayley Tablosu' };
  if (mid === 'sublattice' || mid === 'cosets') return { id: 'altgrup', label: 'Alt Gruplar & Kafes' };
  if (mid === 'hom') return { id: 'homomorfizma', label: 'Homomorfizma' };
  if (mid === 'shuffle' || mid === 'puzzle15' || mid === 'cube') return { id: 'permutasyon', label: 'Permütasyonlar' };
  if (problem?.topic?.includes('Eşlenik')) return { id: 'eslenik', label: 'Eşlenik & Merkez' };
  return null;
}

function loadSavedSetConfig() {
  const saved = readJson(KEY_CURRENT_SET, null);
  if (saved && typeof saved === 'object') {
    const parsed = parseSetCode(saved.code || '', { scope: saved.scope || 'karisik', level: saved.level || 'odev' });
    if (parsed.ok) return { scope: parsed.scope, level: parsed.level, seed: parsed.seed, code: parsed.code };
  }
  const def = { scope: 'karisik', level: 'odev', seed: 48213 };
  return { ...def, code: encodeSetCode(def) };
}

function saveSetConfig(cfg) {
  writeJson(KEY_CURRENT_SET, {
    scope: cfg.scope,
    level: cfg.level,
    seed: normalizeSeed(cfg.seed),
    code: encodeSetCode(cfg),
  });
}

// =====================================================================
// Shared Interactive Problem Renderer (used by Ödev Seti & Pratik)
// =====================================================================

function renderPartHtml(problem, part, rawState, idPrefix) {
  const st = { ...createEmptyPartState(), ...(rawState || {}) };
  const sc = scorePart(part, st);
  const hints = part.hints || [];
  const shownCount = Math.min(hints.length, Math.max(0, st.hintsShown || 0));

  let bodyHtml = '';

  if (part.kind === 'proof') {
    const checklist = part.checklist || [];
    const checkedArr = Array.isArray(st.checklist) ? st.checklist : [];
    const checkedN = checklist.reduce((acc, _, i) => acc + (checkedArr[i] ? 1 : 0), 0);

    bodyHtml = `
      <div class="gp-proof-badge">Kanıt · Öz Değerlendirme (${checkedN}/${checklist.length} adım)</div>
      <div class="gp-part-actions">
        ${shownCount < hints.length
          ? `<button type="button" class="btn small ghost" data-act="hint" aria-label="İpucu ${shownCount + 1} göster">İpucu ${shownCount + 1}/${hints.length}</button>`
          : (hints.length ? `<span class="gp-muted-tag">Tüm ipuçları açıldı</span>` : '')}
        <button type="button" class="btn small${st.solutionRevealed ? ' primary' : ''}" data-act="solution" aria-expanded="${st.solutionRevealed}">
          ${st.solutionRevealed ? 'Çözüm yolunu gizle' : 'Çözüm yolu'}
        </button>
      </div>
      ${shownCount > 0 ? `<div class="gp-hints" aria-live="polite">
        ${hints.slice(0, shownCount).map((h, i) => `<div class="gp-hint"><b>İpucu ${i + 1}:</b> ${richTex(h)}</div>`).join('')}
      </div>` : ''}
      ${st.solutionRevealed ? `<div class="gp-solution" aria-live="polite">
        <div class="gp-sol-title">Örnek Kanıt ve Çözüm Adımları</div>
        <ol class="gp-sol-steps">${(part.solution || []).map(s => `<li>${richTex(s)}</li>`).join('')}</ol>
      </div>` : ''}
      <div class="gp-checklist">
        <div class="gp-cl-title">Öz değerlendirme kontrol listesi (kanıtında doğruladığın adımları işaretle):</div>
        ${checklist.map((item, ci) => {
          const on = Boolean(checkedArr[ci]);
          return `<label class="gp-cl-item${on ? ' on' : ''}">
            <input type="checkbox" data-cl="${ci}" ${on ? 'checked' : ''}>
            <span>${richTex(item)}</span>
          </label>`;
        }).join('')}
      </div>`;
  } else {
    const spec = part.answer;
    let inputHtml = '';

    if (spec.type === 'yesno') {
      const selYes = st.input === 'true' || st.input === true;
      const selNo = st.input === 'false' || st.input === false;
      inputHtml = `<div class="gp-yn-row" role="group" aria-label="Evet veya Hayır seçimi">
        <button type="button" class="gp-opt-btn${selYes ? ' sel' : ''}${st.checked && selYes ? (st.ok ? ' ok' : ' bad') : ''}" data-pick="true" aria-pressed="${selYes}">
          <span class="gp-opt-k">E</span><span>Evet</span>
        </button>
        <button type="button" class="gp-opt-btn${selNo ? ' sel' : ''}${st.checked && selNo ? (st.ok ? ' ok' : ' bad') : ''}" data-pick="false" aria-pressed="${selNo}">
          <span class="gp-opt-k">H</span><span>Hayır</span>
        </button>
      </div>`;
    } else if (spec.type === 'choice') {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const curIdx = st.input === '' || st.input === null || st.input === undefined ? -1 : Number(st.input);
      inputHtml = `<div class="gp-choice-list" role="group" aria-label="Çoktan seçmeli seçenekler">
        ${spec.options.map((opt, oi) => {
          const isSel = curIdx === oi;
          const isRight = st.checked && isSel && st.ok;
          const isWrong = st.checked && isSel && !st.ok;
          const isShownAns = st.answerRevealed && oi === spec.value;
          return `<button type="button" class="gp-opt-btn${isSel ? ' sel' : ''}${isRight || isShownAns ? ' ok' : ''}${isWrong ? ' bad' : ''}" data-pick="${oi}" aria-pressed="${isSel}">
            <span class="gp-opt-k">${letters[oi] || oi + 1}</span>
            <span class="gp-opt-txt">${richTex(opt)}</span>
            ${isRight || isShownAns ? '<span class="gp-mark" aria-hidden="true">✓</span>' : isWrong ? '<span class="gp-mark" aria-hidden="true">✗</span>' : ''}
          </button>`;
        }).join('')}
      </div>`;
    } else {
      const inputId = `${idPrefix}-${part.label}-inp`;
      inputHtml = `<div class="gp-inp-group">
        <input id="${esc(inputId)}" type="text" class="inp gp-ans-inp mono" data-ans-inp value="${esc(st.input ?? '')}" placeholder="${esc(answerPlaceholder(spec))}" autocomplete="off" spellcheck="false" aria-label="Şık ${esc(part.label)} yanıtı">
        <div class="gp-fmt-hint">${esc(answerFormatHint(spec))}</div>
      </div>`;
    }

    bodyHtml = `
      ${inputHtml}
      <div class="gp-part-actions">
        <button type="button" class="btn small primary" data-act="check">${icon('check')} Kontrol et</button>
        ${shownCount < hints.length
          ? `<button type="button" class="btn small ghost" data-act="hint">İpucu ${shownCount + 1}/${hints.length}</button>`
          : (hints.length ? `<span class="gp-muted-tag">Tüm ipuçları açıldı</span>` : '')}
        <button type="button" class="btn small ghost" data-act="reveal" aria-expanded="${st.answerRevealed}">
          ${st.answerRevealed ? 'Cevabı gizle' : 'Cevabı göster'}
        </button>
        <button type="button" class="btn small ghost" data-act="solution" aria-expanded="${st.solutionRevealed}">
          ${st.solutionRevealed ? 'Çözümü gizle' : 'Çözüm yolu'}
        </button>
      </div>
      ${st.checked ? `<div class="gp-feedback ${st.ok ? 'ok' : 'bad'}" role="status" aria-live="polite">
        <span class="gp-fb-ic" aria-hidden="true">${st.ok ? '✓' : '✗'}</span>
        <span>${esc(st.msg)}</span>
      </div>` : ''}
      ${st.answerRevealed ? `<div class="gp-reveal-box" aria-live="polite">
        <b>Doğru cevap:</b> ${formatCanonicalAnswer(spec)}
      </div>` : ''}
      ${shownCount > 0 ? `<div class="gp-hints" aria-live="polite">
        ${hints.slice(0, shownCount).map((h, i) => `<div class="gp-hint"><b>İpucu ${i + 1}:</b> ${richTex(h)}</div>`).join('')}
      </div>` : ''}
      ${st.solutionRevealed ? `<div class="gp-solution" aria-live="polite">
        <div class="gp-sol-title">Çözüm Yolu</div>
        <ol class="gp-sol-steps">${(part.solution || []).map(s => `<li>${richTex(s)}</li>`).join('')}</ol>
      </div>` : ''}`;
  }

  const statusTag = sc.completed
    ? `<span class="gp-part-pill ok">✓ ${sc.earned}/${sc.max}</span>`
    : (st.checked && !st.ok ? `<span class="gp-part-pill bad">✗ 0/${sc.max}</span>` : `<span class="gp-part-pill">${sc.earned}/${sc.max}</span>`);

  return `<div class="gp-part" data-part="${esc(part.label)}">
    <div class="gp-part-head">
      <span class="gp-part-lbl">(${esc(part.label)})</span>
      <div class="gp-part-prompt">${richParagraphs(part.prompt)}</div>
      ${statusTag}
    </div>
    <div class="gp-part-body">${bodyHtml}</div>
  </div>`;
}

function mountProblemCard(container, {
  problem,
  number = null,
  probState,
  onStateChange,
  onAnswerChecked = null,
  ctx,
  clean,
  idPrefix = 'gp-p',
}) {
  let modelCleanup = null;
  let modelOpen = false;

  const closeModel = () => {
    if (modelCleanup) {
      try { modelCleanup(); } catch { }
      modelCleanup = null;
    }
    modelOpen = false;
  };
  clean.add(closeModel);

  const renderCard = () => {
    const pScore = scoreProblem(problem, probState);
    const srcLbl = SOURCE_LABELS[problem.source] || problem.source || '';
    const lvLbl = LEVEL_LABELS[problem.level] || '';
    const centerLink = relatedCenterTab(problem);

    container.innerHTML = `<article class="gp-card" id="${esc(idPrefix)}">
      <header class="gp-card-head">
        <div class="gp-card-title-row">
          ${number !== null ? `<span class="gp-pnum">Soru ${number}</span>` : ''}
          <h3 class="gp-card-title">${richTex(problem.title)}</h3>
        </div>
        <div class="gp-card-meta">
          ${srcLbl ? `<span class="gp-meta-pill src">${esc(srcLbl)}</span>` : ''}
          ${problem.topic ? `<span class="gp-meta-pill">${richTex(problem.topic)}</span>` : ''}
          ${lvLbl ? `<span class="gp-meta-pill">${esc(lvLbl)}</span>` : ''}
          <span class="gp-meta-pill score${pScore.completed === pScore.total ? ' done' : ''}" data-pscore>${pScore.earned}/${pScore.max} puan (${pScore.completed}/${pScore.total})</span>
        </div>
      </header>
      <div class="gp-story">${richParagraphs(problem.story)}</div>
      <div class="gp-card-tools">
        ${problem.model ? `<button type="button" class="btn small${modelOpen ? ' primary' : ''}" data-model-toggle aria-expanded="${modelOpen}">
          ${icon('atom')} ${modelOpen ? 'Modeli kapat' : 'Modeli aç'}
        </button>` : ''}
        ${centerLink ? `<button type="button" class="btn small ghost" data-jump="${esc(centerLink.id)}">
          ${esc(centerLink.label)} →
        </button>` : ''}
      </div>
      <div class="gp-model-slot" data-model-slot ${modelOpen ? '' : 'hidden'}></div>
      <div class="gp-parts" data-parts>
        ${problem.parts.map(pt => renderPartHtml(problem, pt, probState[pt.label], idPrefix)).join('')}
      </div>
    </article>`;

    const updateHeaderScore = () => {
      const s = scoreProblem(problem, probState);
      const badge = container.querySelector('[data-pscore]');
      if (badge) {
        badge.textContent = `${s.earned}/${s.max} puan (${s.completed}/${s.total})`;
        badge.classList.toggle('done', s.completed === s.total);
      }
    };

    const wirePartEl = (partEl, part) => {
      const getSt = () => {
        if (!probState[part.label]) probState[part.label] = createEmptyPartState();
        return probState[part.label];
      };

      const rerenderPart = (focusInput = false) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = renderPartHtml(problem, part, probState[part.label], idPrefix);
        const fresh = tmp.firstElementChild;
        partEl.replaceWith(fresh);
        wirePartEl(fresh, part);
        updateHeaderScore();
        onStateChange?.();
        if (focusInput) fresh.querySelector('[data-ans-inp]')?.focus();
      };

      const doCheck = () => {
        if (part.kind !== 'answer') return;
        const st = getSt();
        const inpEl = partEl.querySelector('[data-ans-inp]');
        if (inpEl) st.input = inpEl.value;
        if (part.answer.type === 'choice' && (st.input === '' || st.input === null || st.input === undefined)) {
          st.checked = true;
          st.ok = false;
          st.msg = 'Önce bir seçenek seçin.';
          rerenderPart();
          return;
        }
        if (part.answer.type === 'yesno' && st.input !== 'true' && st.input !== 'false') {
          st.checked = true;
          st.ok = false;
          st.msg = 'Önce Evet veya Hayır seçin.';
          rerenderPart();
          return;
        }
        const wasSolved = st.ok;
        const res = checkAnswer(part.answer, st.input);
        st.checked = true;
        st.ok = res.ok;
        st.msg = res.msg;
        if (res.ok && !wasSolved) {
          st.hintsAtSolve = st.hintsShown || 0;
        }
        onAnswerChecked?.({ part, ok: res.ok, revealedBefore: st.revealedBeforeSolve, wasSolved });
        rerenderPart();
      };

      partEl.querySelectorAll('[data-pick]').forEach(btn => {
        btn.onclick = () => {
          const st = getSt();
          st.input = btn.dataset.pick;
          st.checked = false;
          rerenderPart();
        };
      });

      const ansInp = partEl.querySelector('[data-ans-inp]');
      if (ansInp) {
        ansInp.addEventListener('input', () => {
          const st = getSt();
          st.input = ansInp.value;
        });
        ansInp.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); doCheck(); }
        });
      }

      partEl.querySelectorAll('[data-cl]').forEach(cb => {
        cb.addEventListener('change', () => {
          const st = getSt();
          if (!Array.isArray(st.checklist)) st.checklist = [];
          st.checklist[Number(cb.dataset.cl)] = cb.checked;
          rerenderPart();
        });
      });

      partEl.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = () => {
          const act = btn.dataset.act;
          const st = getSt();
          if (act === 'check') {
            doCheck();
          } else if (act === 'hint') {
            st.hintsShown = Math.min((part.hints || []).length, (st.hintsShown || 0) + 1);
            rerenderPart();
          } else if (act === 'reveal') {
            st.answerRevealed = !st.answerRevealed;
            if (st.answerRevealed && !st.ok) st.revealedBeforeSolve = true;
            rerenderPart();
          } else if (act === 'solution') {
            st.solutionRevealed = !st.solutionRevealed;
            rerenderPart();
          }
        };
      });
    };

    const partsHost = container.querySelector('[data-parts]');
    problem.parts.forEach(pt => {
      const el = partsHost.querySelector(`[data-part="${pt.label}"]`);
      if (el) wirePartEl(el, pt);
    });

    const jumpBtn = container.querySelector('[data-jump]');
    if (jumpBtn) {
      jumpBtn.onclick = () => ctx?.jumpTo?.(jumpBtn.dataset.jump);
    }

    const toggleBtn = container.querySelector('[data-model-toggle]');
    const modelSlot = container.querySelector('[data-model-slot]');
    if (toggleBtn && modelSlot && problem.model) {
      const openModelNow = async () => {
        modelSlot.hidden = false;
        modelSlot.innerHTML = `<div class="gp-model-loading mute small">Etkileşimli model yükleniyor…</div>`;
        toggleBtn.classList.add('primary');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.innerHTML = `${icon('atom')} Modeli kapat`;
        modelOpen = true;
        try {
          const mod = await loadModels();
          if (!modelOpen || !modelSlot.isConnected) return;
          modelSlot.innerHTML = '';
          modelCleanup = mod.mountModel(modelSlot, problem.model.id, problem.model.params, {});
        } catch (err) {
          modelSlot.innerHTML = `<div class="gp-err">Model yüklenemedi: ${esc(err?.message || err)}</div>`;
        }
      };

      toggleBtn.onclick = () => {
        if (modelOpen) {
          closeModel();
          modelSlot.hidden = true;
          modelSlot.innerHTML = '';
          toggleBtn.classList.remove('primary');
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.innerHTML = `${icon('atom')} Modeli aç`;
        } else {
          openModelNow();
        }
      };
    }
  };

  renderCard();
}

// =====================================================================
// Tab 1: Ödev Seti (id: 'ps-odev')
// =====================================================================

function mountOdevSeti(host, _G, ctx) {
  ensureGtpsCss();
  const clean = createClean(ctx);
  let cfg = loadSavedSetConfig();
  let currentSet = null;
  let setState = {};
  let cardCleans = [];

  const clearCards = () => {
    while (cardCleans.length) {
      try { cardCleans.pop()(); } catch { }
    }
  };
  clean.add(clearCards);

  const loadSetAndState = nextCfg => {
    cfg = {
      scope: nextCfg.scope,
      level: nextCfg.level,
      seed: normalizeSeed(nextCfg.seed),
      code: encodeSetCode(nextCfg),
    };
    saveSetConfig(cfg);
    currentSet = generateProblemSet(cfg);
    setState = readJson(KEY_SET_PREFIX + currentSet.code, {});
    if (!setState || typeof setState !== 'object') setState = {};
  };

  const saveState = () => {
    if (currentSet) writeJson(KEY_SET_PREFIX + currentSet.code, setState);
  };

  const render = () => {
    clearCards();
    const sc = scoreSet(currentSet, setState);

    host.innerHTML = `<div class="gp-wrap">
      <div class="gp-toolbar">
        <div class="gp-toolbar-row">
          <div class="seg" data-lv role="tablist" aria-label="Zorluk seviyesi">
            ${LEVELS.map(lv => `<button type="button" data-level="${lv.id}" class="${cfg.level === lv.id ? 'on' : ''}">${esc(lv.title)}</button>`).join('')}
          </div>
          <select class="inp gp-sel" data-scope aria-label="Problem seti kapsamı">
            ${SCOPES.map(s => `<option value="${s.id}" ${s.id === cfg.scope ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}
          </select>
          <button type="button" class="btn small primary" data-newset>${icon('sparkle')} Yeni set</button>
        </div>
        <div class="gp-toolbar-row gp-code-row">
          <label class="gp-inline-lbl" for="gp-set-code">Set kodu:</label>
          <input id="gp-set-code" type="text" class="inp gp-code-inp mono" value="${esc(currentSet.code)}" aria-label="Paylaşılabilir problem seti kodu">
          <button type="button" class="btn small" data-loadcode>Yükle</button>
          <button type="button" class="btn small ghost" data-copycode>Kopyala</button>
          <button type="button" class="btn small ghost" data-goprint>${icon('text')} Yazdır →</button>
          <button type="button" class="btn small ghost" data-resetset>Sıfırla</button>
        </div>
        <div class="gp-err" data-codeerr hidden role="alert"></div>
      </div>

      <section class="gp-sheet-head">
        <div class="gp-course-tag">MathPad · FZT 203E konularına uygun alıştırma seti</div>
        <h2 class="gp-sheet-title">${esc(currentSet.title)}</h2>
        <div class="gp-sheet-sub">
          <span class="gp-meta-pill src mono">${esc(currentSet.code)}</span>
          <span class="gp-meta-pill">${esc(currentSet.levelTitle)}</span>
          <span class="gp-meta-pill">${esc(currentSet.scopeTitle)}</span>
          <span class="gp-meta-pill">${currentSet.problems.length} Problem · ${sc.total} Şık</span>
        </div>
        <p class="gp-instructions">
          <b>Yönerge:</b> Tüm hesaplamalarda ders konvansiyonlarını kullanın; çarpımlar <b>sağdan sola</b> okunur.
          Her şıkta yanıtınızı kontrol edebilir, kademeli ipuçları açabilir veya ilgili etkileşimli modeli çalıştırabilirsiniz.
          Aynı seti arkadaşlarınızla çözmek için yukarıdaki set kodunu paylaşın.
        </p>
        <details class="gp-conv-box" open>
          <summary>Konvansiyonlar (FZT 203E)</summary>
          <ul class="gp-conv-list">
            ${COURSE_CONVENTIONS.map(c => `<li>${richTex(c)}</li>`).join('')}
          </ul>
        </details>
      </section>

      <div class="gp-progress-panel" data-progress>
        <div class="gp-prog-top">
          <span class="gp-prog-lbl">Set İlerlemesi: <b class="mono" data-prog-txt>${sc.completed}/${sc.total} şık (%${sc.progressPct})</b></span>
          <span class="gp-prog-score">Toplam Puan: <b class="mono" data-score-txt>${sc.earned}/${sc.max} (%${sc.pct})</b></span>
        </div>
        <div class="gp-prog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${sc.progressPct}" aria-label="Problem seti tamamlama oranı">
          <div class="gp-prog-fill" data-prog-fill style="width:${sc.progressPct}%"></div>
        </div>
        <div class="gp-jump-strip" data-jump-strip aria-label="Sorulara hızlı geçiş">
          ${currentSet.problems.map((p, i) => {
            const ps = sc.perProblem[i];
            const done = ps.completed === ps.total;
            return `<button type="button" class="gp-jump-btn${done ? ' done' : ''}" data-jprob="${i}" aria-label="Soru ${i + 1}: ${esc(plainText(p.title))}">
              <span>${i + 1}</span>
              <span class="gp-jump-st">${done ? '✓' : `${ps.completed}/${ps.total}`}</span>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="gp-prob-list" data-plist></div>

      <div class="gp-center-links">
        <span class="mute small">Grup Teorisi Merkezi araçları:</span>
        ${[
          ['simetri', 'Simetri Lab'],
          ['cayley', 'Cayley Tablosu'],
          ['altgrup', 'Alt Gruplar & Kafes'],
          ['eslenik', 'Eşlenik & Merkez'],
          ['homomorfizma', 'Homomorfizma'],
          ['permutasyon', 'Permütasyonlar'],
        ].map(([tid, lbl]) => `<button type="button" class="gp-chip" data-cjump="${tid}">${esc(lbl)} →</button>`).join('')}
      </div>
    </div>`;

    const updateProgress = () => {
      const s = scoreSet(currentSet, setState);
      const pTxt = host.querySelector('[data-prog-txt]');
      const sTxt = host.querySelector('[data-score-txt]');
      const pFill = host.querySelector('[data-prog-fill]');
      const pBar = host.querySelector('.gp-prog-bar');
      if (pTxt) pTxt.textContent = `${s.completed}/${s.total} şık (%${s.progressPct})`;
      if (sTxt) sTxt.textContent = `${s.earned}/${s.max} (%${s.pct})`;
      if (pFill) pFill.style.width = `${s.progressPct}%`;
      if (pBar) pBar.setAttribute('aria-valuenow', String(s.progressPct));
      host.querySelectorAll('[data-jprob]').forEach((btn, i) => {
        const ps = s.perProblem[i];
        const done = ps.completed === ps.total;
        btn.classList.toggle('done', done);
        const stEl = btn.querySelector('.gp-jump-st');
        if (stEl) stEl.textContent = done ? '✓' : `${ps.completed}/${ps.total}`;
      });
    };

    const plist = host.querySelector('[data-plist]');
    currentSet.problems.forEach((prob, idx) => {
      if (!setState[idx]) setState[idx] = {};
      const slot = document.createElement('div');
      plist.append(slot);
      const localClean = createClean(null);
      cardCleans.push(localClean.run);
      mountProblemCard(slot, {
        problem: prob,
        number: idx + 1,
        probState: setState[idx],
        onStateChange: () => { saveState(); updateProgress(); },
        ctx,
        clean: localClean,
        idPrefix: `gp-set-p${idx + 1}`,
      });
    });

    // Wire toolbar controls
    host.querySelector('[data-lv]')?.addEventListener('click', e => {
      const btn = e.target.closest?.('[data-level]');
      if (!btn || btn.dataset.level === cfg.level) return;
      loadSetAndState({ ...cfg, level: btn.dataset.level });
      render();
    });
    host.querySelector('[data-scope]')?.addEventListener('change', e => {
      loadSetAndState({ ...cfg, scope: e.target.value });
      render();
    });
    host.querySelector('[data-newset]')?.addEventListener('click', () => {
      loadSetAndState({ ...cfg, seed: randomSeed5() });
      render();
      toast(`Yeni set oluşturuldu: ${currentSet.code}`);
    });

    const codeInp = host.querySelector('#gp-set-code');
    const codeErr = host.querySelector('[data-codeerr]');
    const applyCode = () => {
      const parsed = parseSetCode(codeInp.value, { scope: cfg.scope, level: cfg.level });
      if (!parsed.ok) {
        codeErr.textContent = parsed.error;
        codeErr.hidden = false;
        return;
      }
      codeErr.hidden = true;
      loadSetAndState(parsed);
      render();
      toast(`Set yüklendi: ${currentSet.code}`);
    };
    host.querySelector('[data-loadcode]')?.addEventListener('click', applyCode);
    codeInp?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } });

    host.querySelector('[data-copycode]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard?.writeText(currentSet.code);
        toast(`Set kodu kopyalandı: ${currentSet.code}`);
      } catch {
        codeInp?.select?.();
        toast(`Set kodu: ${currentSet.code}`);
      }
    });
    host.querySelector('[data-goprint]')?.addEventListener('click', () => ctx?.jumpTo?.('ps-yazdir'));
    host.querySelector('[data-resetset]')?.addEventListener('click', () => {
      setState = {};
      saveState();
      render();
      toast('Bu setteki yanıtlar temizlendi');
    });
    host.querySelectorAll('[data-jprob]').forEach(btn => {
      btn.onclick = () => {
        const el = host.querySelector(`#gp-set-p${Number(btn.dataset.jprob) + 1}`);
        el?.scrollIntoView?.({ behavior: full() ? 'smooth' : 'auto', block: 'start' });
      };
    });
    host.querySelectorAll('[data-cjump]').forEach(btn => {
      btn.onclick = () => ctx?.jumpTo?.(btn.dataset.cjump);
    });

    syncSegments(host, true);
  };

  loadSetAndState(cfg);
  render();
  return clean.run;
}

// =====================================================================
// Tab 2: Pratik (id: 'ps-pratik')
// =====================================================================

function mountPratik(host, _G, ctx) {
  ensureGtpsCss();
  const clean = createClean(ctx);

  let stats = sanitizeStats(readJson(KEY_STATS, createEmptyStats()));
  const pref = readJson(KEY_PRACTICE_PREF, {});
  let sourceFilter = ['karisik', 'PS1', 'PS2', 'ozgun'].includes(pref.sourceFilter) ? pref.sourceFilter : 'karisik';
  let templateId = pref.templateId || '';
  let level = ['isinma', 'odev', 'zorlayici'].includes(pref.level) ? pref.level : 'odev';

  let currentProb = null;
  let probState = {};
  let recordedParts = new Set();
  let cardClean = null;
  let currentSeed = randomSeed5();

  const clearCard = () => {
    if (cardClean) { try { cardClean(); } catch { } cardClean = null; }
  };
  clean.add(clearCard);

  const savePref = () => writeJson(KEY_PRACTICE_PREF, { sourceFilter, templateId, level });
  const saveStats = () => writeJson(KEY_STATS, stats);

  const pickTemplateAndGenerate = () => {
    let tpl = templateId ? ALL_TEMPLATES.find(t => t.id === templateId) : null;
    if (tpl && !tpl.levels.includes(level)) {
      level = tpl.levels[tpl.levels.length - 1];
    }
    if (!tpl) {
      const pool = getTemplatesForScope(sourceFilter, level);
      const safePool = pool.length ? pool : getTemplatesForScope('karisik', level);
      tpl = safePool[Math.floor(Math.random() * safePool.length)];
    }
    currentSeed = randomSeed5();
    const raw = tpl.generate(makeRng(currentSeed), level);
    currentProb = {
      templateId: tpl.id,
      source: tpl.source,
      topic: tpl.topic,
      level,
      seed: currentSeed,
      title: raw.title,
      story: raw.story,
      model: raw.model || null,
      parts: raw.parts,
    };
    probState = {};
    recordedParts = new Set();
    savePref();
  };

  const render = () => {
    clearCard();
    const accPct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    const curTopicAcc = topicAccuracy(stats, currentProb.topic);
    const activeTpl = templateId ? ALL_TEMPLATES.find(t => t.id === templateId) : null;

    const catalog = groupedTemplateCatalog().filter(g => sourceFilter === 'karisik' || g.source === sourceFilter);
    const optgroups = catalog.map(g => g.topics.map(tp => `
      <optgroup label="${esc(g.title)} · ${esc(plainText(tp.topic))}">
        ${tp.templates.map(t => `<option value="${esc(t.id)}" ${t.id === templateId ? 'selected' : ''}>${esc(plainText(t.title))}</option>`).join('')}
      </optgroup>
    `).join('')).join('');

    const topicEntries = Object.entries(stats.byTopic)
      .filter(([, v]) => v.total > 0)
      .sort((a, b) => b[1].total - a[1].total);

    host.innerHTML = `<div class="gp-wrap">
      <div class="gp-toolbar">
        <div class="gp-toolbar-row">
          <div class="gp-chip-row" role="group" aria-label="Kaynak filtresi">
            ${[
              ['karisik', 'Tümü (43)'],
              ['PS1', 'PS1'],
              ['PS2', 'PS2'],
              ['ozgun', 'Özgün'],
            ].map(([k, lbl]) => `<button type="button" class="gp-chip${sourceFilter === k ? ' on' : ''}" data-src="${k}">${esc(lbl)}</button>`).join('')}
          </div>
          <div class="seg" data-plv role="tablist" aria-label="Pratik zorluk seviyesi">
            ${LEVELS.map(lv => {
              const disabled = activeTpl && !activeTpl.levels.includes(lv.id);
              return `<button type="button" data-level="${lv.id}" class="${level === lv.id ? 'on' : ''}" ${disabled ? 'disabled title="Bu şablon yalnızca Zorlayıcı seviyesini destekler"' : ''}>${esc(lv.title)}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="gp-toolbar-row">
          <label class="gp-inline-lbl" for="gp-tpl-sel">Şablon:</label>
          <select id="gp-tpl-sel" class="inp gp-sel gp-sel-wide" aria-label="Problem şablonu seçin">
            <option value="" ${!templateId ? 'selected' : ''}>Karışık (seçili kapsamdaki tüm şablonlar)</option>
            ${optgroups}
          </select>
          <button type="button" class="btn small primary" data-nextq>${icon('sparkle')} Yeni soru</button>
        </div>
      </div>

      <div class="gp-kpis" data-stats-kpis>
        <div class="gp-kpi acc">
          <span class="gp-kpi-lbl">Doğru / Toplam</span>
          <span class="gp-kpi-val mono" data-k-acc>${stats.correct} / ${stats.total}</span>
          <span class="gp-kpi-sub" data-k-pct>%${accPct} doğruluk</span>
        </div>
        <div class="gp-kpi">
          <span class="gp-kpi-lbl">Mevcut Seri</span>
          <span class="gp-kpi-val mono" data-k-str>${stats.streak}</span>
          <span class="gp-kpi-sub">üst üste doğru</span>
        </div>
        <div class="gp-kpi">
          <span class="gp-kpi-lbl">En İyi Seri</span>
          <span class="gp-kpi-val mono" data-k-best>${stats.bestStreak}</span>
          <span class="gp-kpi-sub">rekorun</span>
        </div>
        <div class="gp-kpi">
          <span class="gp-kpi-lbl">Bu Konu</span>
          <span class="gp-kpi-val mono" data-k-top>${curTopicAcc.correct}/${curTopicAcc.total}</span>
          <span class="gp-kpi-sub">${esc(plainText(currentProb.topic))} (%${curTopicAcc.pct})</span>
        </div>
      </div>

      <div data-card-slot></div>

      <details class="gp-stats-box">
        <summary>Konu Bazlı Başarı İstatistikleri (${topicEntries.length} konu)</summary>
        <div class="gp-stats-body">
          ${topicEntries.length ? `<div class="gp-topic-list">
            ${topicEntries.map(([tp, v]) => {
              const pct = Math.round((v.correct / v.total) * 100);
              return `<div class="gp-topic-row">
                <span class="gp-topic-name">${richTex(tp)}</span>
                <div class="gp-topic-bar"><div style="width:${pct}%"></div></div>
                <span class="gp-topic-val mono">${v.correct}/${v.total} (%${pct})</span>
              </div>`;
            }).join('')}
          </div>` : `<div class="mute small">Henüz kontrol edilmiş pratik yanıtı yok. İlk yanıtını kontrol ettiğinde konu istatistikleri burada birikecek.</div>`}
          <div class="gp-stats-foot">
            <span class="mute small mono">Soru tohumu: #${currentSeed}</span>
            <button type="button" class="btn small ghost" data-resetstats>İstatistikleri sıfırla</button>
          </div>
        </div>
      </details>
    </div>`;

    const updateStatsUi = () => {
      const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
      const tAcc = topicAccuracy(stats, currentProb.topic);
      const elA = host.querySelector('[data-k-acc]');
      const elP = host.querySelector('[data-k-pct]');
      const elS = host.querySelector('[data-k-str]');
      const elB = host.querySelector('[data-k-best]');
      const elT = host.querySelector('[data-k-top]');
      if (elA) elA.textContent = `${stats.correct} / ${stats.total}`;
      if (elP) elP.textContent = `%${pct} doğruluk`;
      if (elS) elS.textContent = String(stats.streak);
      if (elB) elB.textContent = String(stats.bestStreak);
      if (elT) elT.textContent = `${tAcc.correct}/${tAcc.total}`;
    };

    const slot = host.querySelector('[data-card-slot]');
    const localClean = createClean(null);
    cardClean = localClean.run;
    mountProblemCard(slot, {
      problem: currentProb,
      number: null,
      probState,
      onAnswerChecked: ({ part, ok, revealedBefore }) => {
        if (recordedParts.has(part.label)) return;
        recordedParts.add(part.label);
        stats = recordPracticeCheck(stats, {
          topic: currentProb.topic,
          ok,
          revealedBefore,
        });
        saveStats();
        updateStatsUi();
      },
      ctx,
      clean: localClean,
      idPrefix: 'gp-pratik-card',
    });

    host.querySelectorAll('[data-src]').forEach(btn => {
      btn.onclick = () => {
        sourceFilter = btn.dataset.src;
        if (templateId) {
          const cur = ALL_TEMPLATES.find(t => t.id === templateId);
          if (cur && sourceFilter !== 'karisik' && cur.source !== sourceFilter) templateId = '';
        }
        pickTemplateAndGenerate();
        render();
      };
    });

    host.querySelector('[data-plv]')?.addEventListener('click', e => {
      const btn = e.target.closest?.('[data-level]');
      if (!btn || btn.disabled || btn.dataset.level === level) return;
      level = btn.dataset.level;
      pickTemplateAndGenerate();
      render();
    });

    host.querySelector('#gp-tpl-sel')?.addEventListener('change', e => {
      templateId = e.target.value;
      pickTemplateAndGenerate();
      render();
    });

    host.querySelector('[data-nextq]')?.addEventListener('click', () => {
      pickTemplateAndGenerate();
      render();
    });

    host.querySelector('[data-resetstats]')?.addEventListener('click', () => {
      stats = createEmptyStats();
      saveStats();
      render();
      toast('Pratik istatistikleri sıfırlandı');
    });

    syncSegments(host, true);
  };

  pickTemplateAndGenerate();
  render();
  return clean.run;
}

// =====================================================================
// Tab 3: Yazdır (id: 'ps-yazdir')
// =====================================================================

function mountYazdir(host, _G, ctx) {
  ensureGtpsCss();
  const clean = createClean(ctx);

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.add('gp-print-root');
    clean.add(() => document.documentElement.classList.remove('gp-print-root'));
  }

  let cfg = loadSavedSetConfig();
  let set = generateProblemSet(cfg);
  let showConventions = true;
  let showSolutions = true;

  const render = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    host.innerHTML = `<div class="gp-wrap">
      <div class="gp-toolbar gp-no-print">
        <div class="gp-toolbar-row">
          <label class="gp-inline-lbl" for="gp-pr-code">Set kodu:</label>
          <input id="gp-pr-code" type="text" class="inp gp-code-inp mono" value="${esc(set.code)}" aria-label="Yazdırılacak problem seti kodu">
          <button type="button" class="btn small" data-pload>Yükle</button>
          <button type="button" class="btn small ghost" data-backodev>← Ödev Seti</button>
        </div>
        <div class="gp-toolbar-row">
          <label class="gp-check-lbl"><input type="checkbox" data-pconv ${showConventions ? 'checked' : ''}> Konvansiyonları dahil et</label>
          <label class="gp-check-lbl"><input type="checkbox" data-psol ${showSolutions ? 'checked' : ''}> Çözümler bölümünü dahil et</label>
          <button type="button" class="btn small primary" data-doprint>${icon('text')} Yazdır / PDF Kaydet</button>
        </div>
        <div class="gp-err" data-perr hidden role="alert"></div>
      </div>

      <article class="gp-print-sheet">
        <header class="gp-print-head">
          <div class="gp-print-inst">MATHPAD · GRUP TEORİSİ ALIŞTIRMA SETİ (FZT 203E KONULARI)</div>
          <h1 class="gp-print-title">${esc(set.title)}</h1>
          <div class="gp-print-meta">
            <span><b>Set Kodu:</b> <span class="mono">${esc(set.code)}</span></span>
            <span><b>Seviye:</b> ${esc(set.levelTitle)}</span>
            <span><b>Kapsam:</b> ${esc(set.scopeTitle)}</span>
            <span><b>Soru Sayısı:</b> ${set.problems.length}</span>
          </div>
          <div class="gp-print-student">
            <span>Ad Soyad: ________________________________</span>
            <span>Öğrenci No: ________________</span>
            <span>Tarih: ____ / ____ / 20__</span>
          </div>
        </header>

        ${showConventions ? `<section class="gp-print-conv">
          <h2>Konvansiyonlar</h2>
          <ul>${COURSE_CONVENTIONS.map(c => `<li>${richTex(c)}</li>`).join('')}</ul>
        </section>` : ''}

        <section class="gp-print-problems">
          ${set.problems.map((prob, i) => `<div class="gp-print-prob">
            <h2 class="gp-print-ptitle">Problem ${i + 1}. ${richTex(prob.title)} <span class="gp-print-tag">[${esc(SOURCE_LABELS[prob.source] || prob.source)} · ${richTex(prob.topic)}]</span></h2>
            <div class="gp-print-story">${richParagraphs(prob.story)}</div>
            <ol class="gp-print-parts">
              ${prob.parts.map(pt => `<li data-lbl="(${esc(pt.label)})">
                <div class="gp-print-prompt">${richParagraphs(pt.prompt)}</div>
                ${pt.kind === 'answer' && pt.answer?.type === 'choice' ? `<ul class="gp-print-opts">
                  ${pt.answer.options.map((o, oi) => `<li><b>${letters[oi] || oi + 1})</b> ${richTex(o)}</li>`).join('')}
                </ul>` : ''}
                ${pt.kind === 'answer' && pt.answer?.type === 'yesno' ? `<div class="gp-print-yn">☐ Evet &nbsp;&nbsp;&nbsp; ☐ Hayır</div>` : ''}
                ${pt.kind === 'proof' ? `<div class="gp-print-proof-space"></div>` : ''}
              </li>`).join('')}
            </ol>
          </div>`).join('')}
        </section>

        ${showSolutions ? `<section class="gp-print-solutions gp-print-break">
          <h1 class="gp-print-sol-h">Çözümler ve Cevap Anahtarı · <span class="mono">${esc(set.code)}</span></h1>
          ${set.problems.map((prob, i) => `<div class="gp-print-sol-prob">
            <h2>Problem ${i + 1}. ${richTex(prob.title)}</h2>
            ${prob.parts.map(pt => `<div class="gp-print-sol-part">
              <div class="gp-print-sol-head">
                <b>(${esc(pt.label)})</b>
                ${pt.kind === 'answer' ? `<span class="gp-print-ans">Cevap: ${formatCanonicalAnswer(pt.answer)}</span>` : `<span class="gp-print-ans">Kanıt</span>`}
              </div>
              <ol class="gp-print-sol-steps">${(pt.solution || []).map(s => `<li>${richTex(s)}</li>`).join('')}</ol>
              ${pt.kind === 'proof' && pt.checklist?.length ? `<div class="gp-print-cl"><b>Değerlendirme adımları:</b> ${pt.checklist.map(c => richTex(c)).join(' · ')}</div>` : ''}
            </div>`).join('')}
          </div>`).join('')}
        </section>` : ''}
      </article>
    </div>`;

    const codeInp = host.querySelector('#gp-pr-code');
    const errEl = host.querySelector('[data-perr]');
    const loadCode = () => {
      const parsed = parseSetCode(codeInp.value, { scope: cfg.scope, level: cfg.level });
      if (!parsed.ok) {
        errEl.textContent = parsed.error;
        errEl.hidden = false;
        return;
      }
      errEl.hidden = true;
      cfg = parsed;
      saveSetConfig(cfg);
      set = generateProblemSet(cfg);
      render();
    };
    host.querySelector('[data-pload]')?.addEventListener('click', loadCode);
    codeInp?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); loadCode(); } });
    host.querySelector('[data-backodev]')?.addEventListener('click', () => ctx?.jumpTo?.('ps-odev'));
    host.querySelector('[data-pconv]')?.addEventListener('change', e => { showConventions = e.target.checked; render(); });
    host.querySelector('[data-psol]')?.addEventListener('change', e => { showSolutions = e.target.checked; render(); });
    host.querySelector('[data-doprint]')?.addEventListener('click', () => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
    });
  };

  render();
  return clean.run;
}

// =====================================================================
// Tab 4: Modeller (id: 'ps-modeller') — Gallery of all 18 interactive models
// =====================================================================

const HOM_PRESETS = [
  { label: 'Z₆ → Z₉ (k ↦ 3k)', from: { kind: 'Z', n: 6 }, to: { kind: 'Z', n: 9 }, images: [0, 3, 6, 0, 3, 6] },
  { label: 'Z₈ → Z₄ (k ↦ k mod 4)', from: { kind: 'Z', n: 8 }, to: { kind: 'Z', n: 4 }, images: [0, 1, 2, 3, 0, 1, 2, 3] },
  { label: 'D₃ → Z₂ (det / işaret)', from: { kind: 'D', n: 3 }, to: { kind: 'Z', n: 2 }, images: [0, 0, 0, 1, 1, 1] },
  { label: 'D₄ → Z₂ (det / işaret)', from: { kind: 'D', n: 4 }, to: { kind: 'Z', n: 2 }, images: [0, 0, 0, 0, 1, 1, 1, 1] },
];

const SHUFFLE_PRESETS = [
  { label: '8 kart Out-Shuffle (mertebe 3)', perm: [1, 3, 5, 7, 2, 4, 6, 8] },
  { label: '8 kart In-Shuffle (mertebe 6)', perm: [2, 4, 6, 8, 1, 3, 5, 7] },
  { label: '6 kart Out-Shuffle (mertebe 4)', perm: [1, 3, 5, 2, 4, 6] },
  { label: '10 kart Out-Shuffle (mertebe 6)', perm: [1, 3, 5, 7, 9, 2, 4, 6, 8, 10] },
  { label: '7 kart (123)(4567) (mertebe 12)', perm: [2, 3, 1, 5, 6, 7, 4] },
];

const CAYLEY_PRESETS = [
  { label: 'D₃ (6)', spec: { kind: 'D', n: 3 } },
  { label: 'D₄ (8)', spec: { kind: 'D', n: 4 } },
  { label: 'D₅ (10)', spec: { kind: 'D', n: 5 } },
  { label: 'D₂ ≅ V₄ (4)', spec: { kind: 'D', n: 2 } },
  { label: 'Z₆ (6)', spec: { kind: 'Z', n: 6 } },
  { label: 'Z₈ (8)', spec: { kind: 'Z', n: 8 } },
  { label: 'Q₈ (8)', spec: { kind: 'Q8' } },
  { label: 'S₃ (6)', spec: { kind: 'S', n: 3 } },
  { label: 'U(12) (4)', spec: { kind: 'U', n: 12 } },
];

function mountModeller(host, _G, ctx) {
  ensureGtpsCss();
  const clean = createClean(ctx);
  let activeId = 'polygon';
  let activeParams = { ...MODEL_CATALOG[0].defaults };
  let modelCleanup = null;
  let mountSeq = 0;

  const unmountActive = () => {
    if (modelCleanup) { try { modelCleanup(); } catch { } modelCleanup = null; }
  };
  clean.add(unmountActive);

  const categories = [...new Set(MODEL_CATALOG.map(m => m.category))];

  const renderParamBar = () => {
    const p = activeParams;
    switch (activeId) {
      case 'polygon':
        return `<label class="gp-inline-lbl">n = <input type="number" class="inp gp-num-sm" data-p="n" min="3" max="12" value="${p.n || 4}"></label>
          <label class="gp-inline-lbl">Kelime: <input type="text" class="inp gp-word-inp mono" data-p="word" value="${esc(p.word || '')}" placeholder="s r^2 s r"></label>`;
      case 'cyclic':
        return `<label class="gp-inline-lbl">n = <input type="number" class="inp gp-num-sm" data-p="n" min="2" max="30" value="${p.n || 12}"></label>
          <label class="gp-inline-lbl">k = <input type="number" class="inp gp-num-sm" data-p="k" min="0" max="29" value="${p.k ?? 5}"></label>`;
      case 'sublattice':
        return `<select class="inp gp-sel" data-p="kind"><option value="D" ${p.kind !== 'Z' ? 'selected' : ''}>Dihedral D_n</option><option value="Z" ${p.kind === 'Z' ? 'selected' : ''}>Devirli Z_n</option></select>
          <label class="gp-inline-lbl">n = <input type="number" class="inp gp-num-sm" data-p="n" min="2" max="${p.kind === 'Z' ? 24 : 8}" value="${p.n || 4}"></label>`;
      case 'cosets':
        return `<select class="inp gp-sel" data-p="kind"><option value="D" ${p.kind !== 'Z' ? 'selected' : ''}>Dihedral D_n</option><option value="Z" ${p.kind === 'Z' ? 'selected' : ''}>Devirli Z_n</option></select>
          <label class="gp-inline-lbl">n = <input type="number" class="inp gp-num-sm" data-p="n" min="2" max="${p.kind === 'Z' ? 16 : 8}" value="${p.n || 4}"></label>`;
      case 'hom':
        return `<span class="mute small">Örnek homomorfizma:</span>
          ${HOM_PRESETS.map((hp, i) => `<button type="button" class="gp-chip" data-hompre="${i}">${esc(hp.label)}</button>`).join('')}`;
      case 'torus':
        return `<label class="gp-inline-lbl">m = <input type="number" class="inp gp-num-sm" data-p="m" min="2" max="12" value="${p.m || 5}"></label>
          <label class="gp-inline-lbl">n = <input type="number" class="inp gp-num-sm" data-p="n" min="2" max="12" value="${p.n || 4}"></label>
          <label class="gp-inline-lbl">a = <input type="number" class="inp gp-num-sm" data-p="a" min="0" max="11" value="${p.a ?? 2}"></label>
          <label class="gp-inline-lbl">b = <input type="number" class="inp gp-num-sm" data-p="b" min="0" max="11" value="${p.b ?? 1}"></label>`;
      case 'wheel':
        return `<label class="gp-inline-lbl">Parmak = <input type="number" class="inp gp-num-sm" data-p="spokes" min="3" max="16" value="${p.spokes || 6}"></label>
          <label class="gp-inline-lbl">FPS = <input type="number" class="inp gp-num-sm" data-p="fps" min="6" max="60" value="${p.fps || 24}"></label>
          <label class="gp-inline-lbl">R (m) = <input type="number" class="inp gp-num-sm" data-p="radius" min="0.1" max="2" step="0.1" value="${p.radius || 0.5}"></label>`;
      case 'brillouin':
        return `<label class="gp-inline-lbl">Kafes a = <input type="number" class="inp gp-num-sm" data-p="a" min="0.5" max="6" step="0.5" value="${p.a || 2}"></label>`;
      case 'shuffle':
        return `<span class="mute small">Deste karıştırma:</span>
          ${SHUFFLE_PRESETS.map((sp, i) => `<button type="button" class="gp-chip" data-shufpre="${i}">${esc(sp.label)}</button>`).join('')}`;
      case 'orbits':
        return `<span class="mute small">Periyotlar:</span>
          ${['3,4,5', '4,6', '2,3,5', '6,9,15'].map(ps => `<button type="button" class="gp-chip" data-orbpre="${ps}">(${ps})</button>`).join('')}`;
      case 'lights':
        return `<label class="gp-inline-lbl">Satır = <input type="number" class="inp gp-num-sm" data-p="rows" min="1" max="4" value="${p.rows || 3}"></label>
          <label class="gp-inline-lbl">Sütun = <input type="number" class="inp gp-num-sm" data-p="cols" min="1" max="4" value="${p.cols || 3}"></label>`;
      case 'cayley':
        return `<span class="mute small">Grup:</span>
          ${CAYLEY_PRESETS.map((cp, i) => `<button type="button" class="gp-chip" data-caypre="${i}">${esc(cp.label)}</button>`).join('')}`;
      default:
        return `<span class="mute small">Parametreleri doğrudan modelin kendi arayüzünden ayarlayabilirsiniz.</span>`;
    }
  };

  const mountStage = async () => {
    const seq = ++mountSeq;
    unmountActive();
    const stage = host.querySelector('[data-mstage]');
    if (!stage) return;
    stage.innerHTML = `<div class="gp-model-loading mute small">Model yükleniyor…</div>`;
    try {
      const mod = await loadModels();
      if (seq !== mountSeq || !stage.isConnected) return;
      stage.innerHTML = '';
      modelCleanup = mod.mountModel(stage, activeId, activeParams, {});
    } catch (err) {
      stage.innerHTML = `<div class="gp-err">Model yüklenemedi: ${esc(err?.message || err)}</div>`;
    }
  };

  const render = () => {
    const activeMeta = MODEL_CATALOG.find(m => m.id === activeId) || MODEL_CATALOG[0];
    host.innerHTML = `<div class="gp-wrap">
      <div class="gp-gallery-head">
        <h2 class="gp-sheet-title">Etkileşimli Modeller Galerisi (${MODEL_CATALOG.length} Model)</h2>
        <p class="mute small">Problem setlerindeki tüm 2B ve 3B fiziksel/cebirsel simülasyonları parametrelerini değiştirerek özgürce keşfedin.</p>
      </div>

      <div class="gp-gallery">
        ${categories.map(cat => `<div class="gp-cat-group">
          <div class="gp-cat-title">${esc(cat)}</div>
          <div class="gp-cat-grid">
            ${MODEL_CATALOG.filter(m => m.category === cat).map(m => `<button type="button" class="gp-mcard${m.id === activeId ? ' on' : ''}" data-mid="${m.id}" aria-pressed="${m.id === activeId}">
              <b>${esc(m.title)}</b>
              <span>${esc(m.short)}</span>
            </button>`).join('')}
          </div>
        </div>`).join('')}
      </div>

      <div class="gp-stage-card">
        <div class="gp-toolbar-row gp-param-bar" data-pbar>
          <span class="gp-meta-pill src">${esc(activeMeta.title)}</span>
          ${renderParamBar()}
        </div>
        <div data-mstage></div>
      </div>
    </div>`;

    host.querySelectorAll('[data-mid]').forEach(btn => {
      btn.onclick = () => {
        const meta = MODEL_CATALOG.find(m => m.id === btn.dataset.mid);
        if (!meta) return;
        activeId = meta.id;
        activeParams = structuredClone ? structuredClone(meta.defaults) : JSON.parse(JSON.stringify(meta.defaults));
        render();
      };
    });

    const pbar = host.querySelector('[data-pbar]');
    pbar?.querySelectorAll('[data-p]').forEach(inp => {
      inp.addEventListener('change', () => {
        const key = inp.dataset.p;
        if (inp.type === 'number') activeParams[key] = Number(inp.value);
        else activeParams[key] = inp.value;
        if (activeId === 'cosets') {
          activeParams.sub = activeParams.kind === 'Z' ? [0] : ['e', 's'];
        }
        if (key === 'kind') {
          const maxN = activeParams.kind === 'Z' ? (activeId === 'cosets' ? 16 : 24) : 8;
          if ((activeParams.n || 4) > maxN) activeParams.n = maxN;
          render();
          return;
        }
        mountStage();
      });
    });
    pbar?.querySelectorAll('[data-hompre]').forEach(btn => {
      btn.onclick = () => {
        const p = HOM_PRESETS[Number(btn.dataset.hompre)];
        activeParams = { from: p.from, to: p.to, images: p.images.slice() };
        mountStage();
      };
    });
    pbar?.querySelectorAll('[data-shufpre]').forEach(btn => {
      btn.onclick = () => {
        const p = SHUFFLE_PRESETS[Number(btn.dataset.shufpre)];
        activeParams = { perm: p.perm.slice() };
        mountStage();
      };
    });
    pbar?.querySelectorAll('[data-orbpre]').forEach(btn => {
      btn.onclick = () => {
        activeParams = { periods: btn.dataset.orbpre.split(',').map(Number) };
        mountStage();
      };
    });
    pbar?.querySelectorAll('[data-caypre]').forEach(btn => {
      btn.onclick = () => {
        activeParams = { ...CAYLEY_PRESETS[Number(btn.dataset.caypre)].spec };
        mountStage();
      };
    });

    mountStage();
  };

  render();
  return clean.run;
}

// =====================================================================
// Exported TABS for js/groupcenter.js (chapter: 'problemler')
// =====================================================================

export const TABS = [
  { id: 'ps-odev',     chapter: 'problemler', title: 'Ödev Seti', icon: 'book',  usesGroup: false, mount: mountOdevSeti },
  { id: 'ps-pratik',   chapter: 'problemler', title: 'Pratik',    icon: 'flame', usesGroup: false, mount: mountPratik },
  { id: 'ps-yazdir',   chapter: 'problemler', title: 'Yazdır',    icon: 'text',  usesGroup: false, mount: mountYazdir },
  { id: 'ps-modeller', chapter: 'problemler', title: 'Modeller',  icon: 'atom',  usesGroup: false, mount: mountModeller },
];
