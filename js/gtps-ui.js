// Pure UI & model-math module for Group Theory Problem Sets (FZT 203E).
// Zero DOM, zero ui.js/fx.js/phys-ui.js imports so everything runs directly in Node tests.
import {
  makeRng, gcd, lcm, mod, divisors,
  permId, permMul, permInv, permEq, permCycles, cyclesString, permOrder, permSign, cycleType,
  dEl, dMul, dInv, dEq, dOrder, dName, dAll, dPerm, dParse,
  checkAnswer, answerText, LEVELS,
} from './gtps-kit.js';
import {
  buildGroup, isAbelian, isCyclic, center,
} from './group.js';
import { TEMPLATES as PS1_TEMPLATES } from './gtps-ps1.js';
import { TEMPLATES as PS2_TEMPLATES } from './gtps-ps2.js';
import { TEMPLATES as OZGUN_TEMPLATES } from './gtps-ozgun.js';

export { LEVELS, checkAnswer, answerText };

// ---------- Template catalog & metadata ----------

export const ALL_TEMPLATES = [
  ...PS1_TEMPLATES,
  ...PS2_TEMPLATES,
  ...OZGUN_TEMPLATES,
];

export const SCOPES = [
  { id: 'PS1', title: 'PS1 Konuları', prefix: 'PS1' },
  { id: 'PS2', title: 'PS2 Konuları', prefix: 'PS2' },
  { id: 'ozgun', title: 'Özgün', prefix: 'OZGUN' },
  { id: 'karisik', title: 'Karışık', prefix: 'PS' },
];

export const SOURCE_LABELS = {
  PS1: 'PS1',
  PS2: 'PS2',
  ozgun: 'Özgün',
};

export const LEVEL_LABELS = Object.fromEntries(LEVELS.map(l => [l.id, l.title]));

export const COURSE_CONVENTIONS = [
  'Düzgün $n$-genin köşeleri saat yönünün tersine $1, 2, \\dots, n$ olarak numaralanır ($1$. köşe $+x$ ekseni üzerindedir). $r$ saat yönünün tersine $2\\pi/n$ dönmesi, $s$ ise $1$. köşeden ve merkezden geçen eksene göre yansımadır.',
  'Çarpımlar **sağdan sola** okunur: $gh$ çarpımında önce $h$, sonra $g$ uygulanır. Simetriler konum permütasyonudur ($i \\to j$: $i$ konumundaki köşe $j$ konumuna gider). Üçgende $r = (123),\\; s = (23),\\; rs = (12)$; karede $r = (1234),\\; s = (24)$.',
  '$D_n$ bağıntıları: $r^n = s^2 = e$, $srs = r^{-1}$, $s r^k = r^{-k} s$; tekil normal biçim $r^k s^m$ ($0 \\le k < n,\\; m \\in \\{0, 1\\}$).',
  '$\\mathbb{Z}_n = \\{0, \\dots, n-1\\}$ ($+ \\bmod n$); $D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ (Klein dörtlü grubu $V$); eşlenik $b = g^{-1} a g$, $\\operatorname{Cl}(a) = \\{g^{-1} a g\\}$; $N \\trianglelefteq G$ normal alt grup; $\\operatorname{sgn}(p) = \\pm 1$, $A_n = \\ker\\operatorname{sgn}$.',
];

export function plainText(str) {
  return String(str ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\$\$([\s\S]+?)\$\$/g, '$1')
    .replace(/\$([^$\n]+?)\$/g, '$1')
    .replace(/\\mathbb\{([A-Za-z])\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\cong/g, '≅')
    .replace(/\\trianglelefteq/g, '◁')
    .replace(/\\to|\\mapsto/g, '→')
    .replace(/\\oplus/g, '⊕')
    .replace(/\\cdot/g, '·')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\varphi/g, 'φ')
    .replace(/\\[,;!]/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getTemplatesForScope(scope = 'karisik', level = null) {
  let list = scope === 'karisik'
    ? ALL_TEMPLATES
    : ALL_TEMPLATES.filter(t => t.source === scope);
  if (level) list = list.filter(t => t.levels.includes(level));
  return list;
}

export function groupedTemplateCatalog() {
  const sources = ['PS1', 'PS2', 'ozgun'];
  return sources.map(src => {
    const items = ALL_TEMPLATES.filter(t => t.source === src);
    const topicMap = new Map();
    for (const t of items) {
      if (!topicMap.has(t.topic)) topicMap.set(t.topic, []);
      topicMap.get(t.topic).push(t);
    }
    return {
      source: src,
      title: SOURCE_LABELS[src],
      topics: [...topicMap.entries()].map(([topic, templates]) => ({ topic, templates })),
    };
  });
}

// ---------- Deterministic set code & problem set builder ----------

const LEVEL_CODE_MAP = { isinma: 'ISINMA', odev: 'ODEV', zorlayici: 'ZOR' };
const SCOPE_CODE_MAP = { PS1: 'PS1', PS2: 'PS2', ozgun: 'OZGUN', karisik: 'PS' };

export function normalizeSeed(seed) {
  const n = Math.abs(Math.trunc(Number(seed))) % 100000;
  return n > 0 ? n : 1;
}

export function encodeSetCode({ scope = 'karisik', level = 'odev', seed = 48213 }) {
  const sp = SCOPE_CODE_MAP[scope] || 'PS';
  const lv = LEVEL_CODE_MAP[level] || 'ODEV';
  const sd = String(normalizeSeed(seed)).padStart(5, '0');
  return `${sp}-${lv}-${sd}`;
}

export function parseSetCode(raw, fallback = { scope: 'karisik', level: 'odev' }) {
  const s = String(raw ?? '').trim().toLocaleUpperCase('tr')
    .replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ç/g, 'C');
  if (!s) return { ok: false, error: 'Bir set kodu girin (örn. PS-ODEV-48213)' };

  // Bare numeric seed keeps current scope & level
  if (/^\d{1,9}$/.test(s)) {
    const seed = normalizeSeed(Number(s));
    const scope = SCOPE_CODE_MAP[fallback.scope] ? fallback.scope : 'karisik';
    const level = LEVEL_CODE_MAP[fallback.level] ? fallback.level : 'odev';
    return { ok: true, scope, level, seed, code: encodeSetCode({ scope, level, seed }) };
  }

  const tokens = s.split(/[\s\-_/]+/).filter(Boolean);
  if (tokens.length === 2 && /^\d+$/.test(tokens[1])) {
    const lv = parseLevelToken(tokens[0]);
    if (lv) {
      const seed = normalizeSeed(Number(tokens[1]));
      const scope = SCOPE_CODE_MAP[fallback.scope] ? fallback.scope : 'karisik';
      return { ok: true, scope, level: lv, seed, code: encodeSetCode({ scope, level: lv, seed }) };
    }
  }
  if (tokens.length === 3 && /^\d+$/.test(tokens[2])) {
    const scope = parseScopeToken(tokens[0]);
    const level = parseLevelToken(tokens[1]);
    if (scope && level) {
      const seed = normalizeSeed(Number(tokens[2]));
      return { ok: true, scope, level, seed, code: encodeSetCode({ scope, level, seed }) };
    }
  }
  return { ok: false, error: 'Geçersiz set kodu. Örnek biçimler: PS-ODEV-48213, PS1-ISINMA-12045, OZGUN-ZOR-73901' };
}

function parseScopeToken(tok) {
  if (tok === 'PS' || tok === 'KARISIK' || tok === 'MIX') return 'karisik';
  if (tok === 'PS1') return 'PS1';
  if (tok === 'PS2') return 'PS2';
  if (tok === 'OZGUN' || tok === 'OZ') return 'ozgun';
  return null;
}

function parseLevelToken(tok) {
  if (tok === 'ISINMA' || tok === 'IS' || tok === 'KOLAY') return 'isinma';
  if (tok === 'ODEV' || tok === 'ORTA') return 'odev';
  if (tok === 'ZOR' || tok === 'ZORLAYICI') return 'zorlayici';
  return null;
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

export function generateProblemSet({ scope = 'karisik', level = 'odev', seed = 48213 } = {}) {
  const safeScope = SCOPE_CODE_MAP[scope] ? scope : 'karisik';
  const safeLevel = LEVEL_CODE_MAP[level] ? level : 'odev';
  const safeSeed = normalizeSeed(seed);
  const code = encodeSetCode({ scope: safeScope, level: safeLevel, seed: safeSeed });

  const pool = getTemplatesForScope(safeScope, safeLevel);
  const targetCount = safeLevel === 'isinma' ? 6 : 7;
  const count = Math.min(targetCount, pool.length);

  const masterRng = makeRng(hashString(code));

  // For 'karisik', try to ensure balanced representation across PS1, PS2, and ozgun while keeping templates distinct.
  let chosen;
  if (safeScope === 'karisik' && count >= 6) {
    const bySrc = {
      PS1: masterRng.shuffle(pool.filter(t => t.source === 'PS1')),
      PS2: masterRng.shuffle(pool.filter(t => t.source === 'PS2')),
      ozgun: masterRng.shuffle(pool.filter(t => t.source === 'ozgun')),
    };
    const picked = [];
    // Pick 2 from each source first (6 total), then 1 more for count=7
    for (let r = 0; r < 2; r++) {
      for (const s of ['PS1', 'PS2', 'ozgun']) {
        if (bySrc[s].length && picked.length < count) picked.push(bySrc[s].shift());
      }
    }
    const rest = masterRng.shuffle([...bySrc.PS1, ...bySrc.PS2, ...bySrc.ozgun]);
    while (picked.length < count && rest.length) picked.push(rest.shift());
    chosen = masterRng.shuffle(picked);
  } else {
    chosen = masterRng.sample(pool, count);
  }

  const problems = chosen.map((tpl, idx) => {
    const pSeed = hashString(`${code}#${tpl.id}#${idx}`);
    const prob = tpl.generate(makeRng(pSeed), safeLevel);
    return {
      idx,
      templateId: tpl.id,
      source: tpl.source,
      topic: tpl.topic,
      level: safeLevel,
      seed: pSeed,
      title: prob.title,
      story: prob.story,
      model: prob.model || null,
      parts: prob.parts,
    };
  });

  const scopeTitle = SCOPES.find(s => s.id === safeScope)?.title || 'Karışık';
  const levelTitle = LEVEL_LABELS[safeLevel] || 'Ödev';
  return {
    code,
    scope: safeScope,
    level: safeLevel,
    seed: safeSeed,
    title: `Grup Teorisi Problem Seti · ${levelTitle} (${scopeTitle})`,
    scopeTitle,
    levelTitle,
    problems,
  };
}

// ---------- Answer input format hints & placeholders ----------

export function answerFormatHint(spec) {
  if (!spec) return '';
  switch (spec.type) {
    case 'int': return 'Tam sayı yazın (örn. 6 veya -2).';
    case 'number': return 'Sayı, ondalık veya kesir yazın (örn. 0.8, 0,8 veya 4/5).';
    case 'yesno': return 'Evet veya Hayır seçin.';
    case 'choice': return 'Doğru seçeneğe tıklayın.';
    case 'perm': return spec.n >= 10
      ? `Ayrık döngüler, boşlukla ayrılmış (1..${spec.n}), örn. (1 2 10)(3 4) veya birim için e.`
      : `Ayrık döngü gösterimi (1..${spec.n}), örn. (123)(45) veya birim için e.`;
    case 'dihedral': return `D_${spec.n} normal biçimi (r^k s^m), örn. r^2 s, r, s veya e.`;
    case 'intset': return 'Virgülle ayrılmış sayılar (sıra önemsiz), örn. 0, 2, 4.';
    case 'intlist': return 'Virgülle ayrılmış sıralı sayılar (sıra önemli), örn. 1, 2, 3.';
    case 'dset': return `Virgülle ayrılmış D_${spec.n} elemanları, örn. e, r^2, s, r^2 s.`;
    case 'permset': return `Virgülle ayrılmış permütasyonlar, örn. e, (12), (123).`;
    case 'text': return 'Kısa metin yanıtı yazın.';
    default: return '';
  }
}

export function answerPlaceholder(spec) {
  if (!spec) return '';
  switch (spec.type) {
    case 'int': return 'örn. 6';
    case 'number': return 'örn. 0.8 veya 4/5';
    case 'perm': return spec.n >= 10 ? 'örn. (1 2 10)(3 4)' : 'örn. (123)(45) veya e';
    case 'dihedral': return 'örn. r^2 s veya e';
    case 'intset': return 'örn. 0, 2, 4';
    case 'intlist': return 'örn. 1, 2, 3';
    case 'dset': return 'örn. e, r^2, s';
    case 'permset': return 'örn. e, (12), (13)';
    case 'text': return 'Yanıtınız…';
    default: return '';
  }
}

// ---------- Scoring & State Persistence Helpers ----------

export const PART_MAX_POINTS = 10;

export function createEmptyPartState() {
  return {
    input: '',
    checked: false,
    ok: false,
    msg: '',
    hintsShown: 0,
    hintsAtSolve: null,
    answerRevealed: false,
    solutionRevealed: false,
    revealedBeforeSolve: false,
    checklist: [],
  };
}

export function scorePart(part, rawState) {
  const st = rawState || createEmptyPartState();
  const max = PART_MAX_POINTS;
  if (part.kind === 'proof') {
    const items = part.checklist || [];
    if (!items.length) return { earned: 0, max, completed: false };
    const checkedArr = Array.isArray(st.checklist) ? st.checklist : [];
    let count = 0;
    for (let i = 0; i < items.length; i++) if (checkedArr[i]) count++;
    const rawPts = Math.round((max * count) / items.length);
    const hintPenalty = Math.min(2, st.hintsShown || 0);
    const earned = count > 0 ? Math.max(0, rawPts - hintPenalty) : 0;
    return { earned, max, completed: count === items.length };
  }
  // Answer part
  if (!st.ok) return { earned: 0, max, completed: false };
  if (st.revealedBeforeSolve) {
    return { earned: 2, max, completed: true };
  }
  const usedHints = st.hintsAtSolve != null ? st.hintsAtSolve : (st.hintsShown || 0);
  const earned = Math.max(2, max - usedHints * 2);
  return { earned, max, completed: true };
}

export function scoreProblem(problem, probState = {}) {
  let earned = 0, max = 0, completed = 0;
  const total = problem.parts.length;
  for (const part of problem.parts) {
    const r = scorePart(part, probState[part.label]);
    earned += r.earned;
    max += r.max;
    if (r.completed) completed++;
  }
  return { earned, max, completed, total, pct: max ? Math.round((earned / max) * 100) : 0 };
}

export function scoreSet(set, setState = {}) {
  let earned = 0, max = 0, completed = 0, total = 0;
  const perProblem = set.problems.map((prob, i) => {
    const r = scoreProblem(prob, setState[i] || {});
    earned += r.earned;
    max += r.max;
    completed += r.completed;
    total += r.total;
    return r;
  });
  return {
    earned,
    max,
    completed,
    total,
    pct: max ? Math.round((earned / max) * 100) : 0,
    progressPct: total ? Math.round((completed / total) * 100) : 0,
    perProblem,
  };
}

// ---------- Practice Stats Helpers ----------

export function createEmptyStats() {
  return {
    correct: 0,
    total: 0,
    streak: 0,
    bestStreak: 0,
    byTopic: {},
  };
}

export function sanitizeStats(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyStats();
  const byTopic = {};
  if (raw.byTopic && typeof raw.byTopic === 'object') {
    for (const [k, v] of Object.entries(raw.byTopic)) {
      if (v && typeof v === 'object') {
        byTopic[k] = {
          correct: Math.max(0, Math.trunc(+v.correct) || 0),
          total: Math.max(0, Math.trunc(+v.total) || 0),
        };
      }
    }
  }
  return {
    correct: Math.max(0, Math.trunc(+raw.correct) || 0),
    total: Math.max(0, Math.trunc(+raw.total) || 0),
    streak: Math.max(0, Math.trunc(+raw.streak) || 0),
    bestStreak: Math.max(0, Math.trunc(+raw.bestStreak) || 0),
    byTopic,
  };
}

export function recordPracticeCheck(stats, { topic, ok, revealedBefore = false }) {
  const next = sanitizeStats(stats);
  const countedOk = Boolean(ok) && !revealedBefore;
  next.total += 1;
  if (countedOk) {
    next.correct += 1;
    next.streak += 1;
    if (next.streak > next.bestStreak) next.bestStreak = next.streak;
  } else {
    next.streak = 0;
  }
  if (topic) {
    const cur = next.byTopic[topic] || { correct: 0, total: 0 };
    next.byTopic[topic] = {
      correct: cur.correct + (countedOk ? 1 : 0),
      total: cur.total + 1,
    };
  }
  return next;
}

export function topicAccuracy(stats, topic) {
  const t = stats?.byTopic?.[topic];
  if (!t || !t.total) return { correct: 0, total: 0, pct: 0 };
  return { correct: t.correct, total: t.total, pct: Math.round((t.correct / t.total) * 100) };
}

// =====================================================================
// PURE MODEL MATH & GEOMETRY ENGINES (All 18 Models)
// =====================================================================

export const MODEL_CATALOG = [
  { id: 'polygon',    category: 'Gruplar ve Cebir', title: 'Düzgün n-gen (D_n)',           short: 'Köşe permütasyonları, r/s normal biçim ve kelime animasyonu', defaults: { n: 4, word: 's r^3 s r' } },
  { id: 'cyclic',     category: 'Gruplar ve Cebir', title: 'Devirli Grup Çemberi (Z_n)',   short: 'Yıldız çokgen, ⟨k⟩ alt grubu ve üreteçler',                    defaults: { n: 12, k: 5 } },
  { id: 'sublattice', category: 'Gruplar ve Cebir', title: 'Alt Grup Kafesi (Hasse)',       short: 'Tıklanabilir Z_n ve D_n alt grup kafesi',                      defaults: { kind: 'D', n: 4 } },
  { id: 'cosets',     category: 'Gruplar ve Cebir', title: 'Sol ve Sağ Kosetler',           short: 'Renkli koset ayrışımı ve normallik testi',                     defaults: { kind: 'D', n: 4, sub: ['e', 's'] } },
  { id: 'hom',        category: 'Gruplar ve Cebir', title: 'Homomorfizma Okları',           short: 'Çekirdek, görüntü ve lifler',                                  defaults: { from: { kind: 'Z', n: 6 }, to: { kind: 'Z', n: 9 }, images: [0, 3, 6, 0, 3, 6] } },
  { id: 'cayley',     category: 'Gruplar ve Cebir', title: 'Cayley Çarpım Tablosu',         short: 'Ders konvansiyonunda etkileşimli çarpım tablosu',              defaults: { kind: 'D', n: 4 } },
  { id: 'pauli',      category: 'Gruplar ve Cebir', title: 'Pauli Grubu P₁ (16 Eleman)',    short: '±1, ±i fazlı Pauli matrisleri çarpım tablosu ve Q₈',           defaults: {} },
  { id: 'cube',       category: 'Geometri ve 3B',   title: '3B Küp ve 4 Köşegen (O ≅ S₄)', short: 'Three.js ile döndürülebilir küp, eksenler ve S₄ etkisi',       defaults: { rot: [[0, -1, 0], [1, 0, 0], [0, 0, 1]] } },
  { id: 'molecule',   category: 'Geometri ve 3B',   title: '3B Molekül Simetrileri',        short: 'NH₃, H₂O, CH₄, C₆H₆, C₂H₄, BF₃ nokta grupları',               defaults: { name: 'NH3' } },
  { id: 'shuffle',    category: 'Permütasyonlar',   title: 'Kart Karıştırma ve Döngüler',   short: 'Konum permütasyonu animasyonu ve başlangıca dönüş sayısı',     defaults: { perm: [1, 5, 2, 6, 3, 7, 4, 8] } },
  { id: 'puzzle15',   category: 'Permütasyonlar',   title: '15 Bulmacası ve Parite',        short: 'Oynanabilir 4×4 bulmaca, dama rengi ve sgn·(-1)^d değişmezi',  defaults: { tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0] } },
  { id: 'lights',     category: 'Permütasyonlar',   title: 'Işıklar Söndü (Z₂^N)',          short: 'GF(2) rank, çekirdek ve çözülebilirlik paneli',                defaults: { rows: 3, cols: 3 } },
  { id: 'torus',      category: 'Fizik ve Uygulamalar', title: 'Torus Kafesinde Sıçrama',   short: 'Periyodik m×n kafeste yörünge ve kosetler',                    defaults: { m: 5, n: 4, a: 2, b: 1 } },
  { id: 'wheel',      category: 'Fizik ve Uygulamalar', title: 'Vagon Tekerleği Stroboskobu', short: 'Gerçek vs kamera görüntüsü ve R/(2π/n)Z örtüşmesi',         defaults: { spokes: 6, fps: 24, radius: 0.5, v: 9.42 } },
  { id: 'brillouin',  category: 'Fizik ve Uygulamalar', title: '1B Brillouin Bölgesi',      short: 'Atom zincirinde k ve indirgenmiş k\' kafes dalgaları',         defaults: { a: 2, k: (5 * Math.PI) / 4 } },
  { id: 'velocity',   category: 'Fizik ve Uygulamalar', title: 'Göreli Hız ve Rapidite',    short: 'u ⊕ v hız toplamı ve doğrusal rapidite ekseni',                defaults: { u: 0.5, v: 0.5 } },
  { id: 'music',      category: 'Fizik ve Uygulamalar', title: '12 Perde Müzik Saati (D₁₂)', short: 'Aktarım T_k, evirme I_k ve simetrik akorlar',                 defaults: { chord: [0, 4, 7] } },
  { id: 'orbits',     category: 'Fizik ve Uygulamalar', title: 'Yörünge Hizalanmaları',     short: 'Dairesel yörüngeler, EKOK periyodu ve Çin Kalanı',             defaults: { periods: [3, 4, 5] } },
];

// ---- 1. polygon (D_n course convention) ----

/** Vertices 1..n counterclockwise starting on positive x-axis (unit circle, math coords). */
export function polygonVertices(n) {
  return Array.from({ length: n }, (_, i) => {
    const theta = (2 * Math.PI * i) / n;
    return { pos: i + 1, angle: theta, x: Math.cos(theta), y: Math.sin(theta) };
  });
}

/** State of D_n element el={k,m}: position perm, where each vertex label v sits, order, reflection axis angle. */
export function polygonState(n, el) {
  const normEl = dEl(n, el.k, el.m);
  const perm = dPerm(n, normEl); // perm[i-1] = new position of vertex that started at i
  const order = dOrder(n, normEl);
  const fixed = [];
  for (let i = 1; i <= n; i++) if (perm[i - 1] === i) fixed.push(i);
  const mirrorAngle = normEl.m ? (normEl.k * Math.PI) / n : null;
  return {
    n,
    el: normEl,
    name: dName(normEl),
    tex: dName(normEl, true),
    perm,
    cycles: cyclesString(perm),
    order,
    isReflection: normEl.m === 1,
    fixed,
    mirrorAngle,
  };
}

/**
 * Parse a D_n word into right-to-left step tokens for step-by-step animation.
 * Each step is { label, tex, kind: 'r'|'s'|'e', exp, el }.
 * Applying steps in order (index 0 = rightmost token of word!) reproduces dParse(n, word).
 */
export function tokenizeDWord(n, word) {
  const s = String(word ?? '').replace(/[·*\s]/g, '').replace(/⁻/g, '-')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c));
  if (!s) return [];
  const re = /(e|r|s)(?:\^?\{?(-?\d+)\}?)?/gy;
  const leftToRight = [];
  let pos = 0, m;
  while (pos < s.length) {
    re.lastIndex = pos;
    m = re.exec(s);
    if (!m) throw new Error('Geçersiz D_n kelimesi: yalnızca r, s, e ve üsler kullanılabilir');
    const sym = m[1];
    const exp = m[2] === undefined ? 1 : Number(m[2]);
    if (sym === 'e') {
      leftToRight.push({ label: 'e', tex: 'e', kind: 'e', exp: 0, el: dEl(n, 0, 0) });
    } else if (sym === 's') {
      const p = mod(exp, 2);
      leftToRight.push({
        label: exp === 1 ? 's' : `s^${exp}`,
        tex: exp === 1 ? 's' : `s^{${exp}}`,
        kind: p ? 's' : 'e',
        exp,
        el: dEl(n, 0, p),
      });
    } else {
      leftToRight.push({
        label: exp === 1 ? 'r' : `r^${exp}`,
        tex: exp === 1 ? 'r' : `r^{${exp}}`,
        kind: 'r',
        exp,
        el: dEl(n, exp, 0),
      });
    }
    pos = re.lastIndex;
  }
  // Right-to-left: rightmost token acts FIRST!
  return leftToRight.reverse();
}

// ---- 2. cyclic (Z_n star polygon) ----

export function cyclicStarData(n, k = 1) {
  const safeN = Math.max(2, Math.trunc(n));
  const safeK = mod(Math.trunc(k ?? 1), safeN);
  const g = gcd(safeK, safeN);
  const ord = safeN / g;
  const seq = [];
  for (let t = 0; t < ord; t++) seq.push(mod(t * safeK, safeN));
  const elems = [...seq].sort((a, b) => a - b);
  const generators = [];
  for (let x = 1; x < safeN; x++) if (gcd(x, safeN) === 1) generators.push(x);
  return {
    n: safeN,
    k: safeK,
    gcd: g,
    order: ord,
    isGenerator: ord === safeN,
    sequence: seq,
    subgroup: elems,
    generators,
  };
}

// ---- 3. sublattice (Z_n or D_n in course conventions) ----

function dKey(x) { return `${x.k}:${x.m}`; }

function dIsNormalSub(n, elems) {
  const set = new Set(elems.map(dKey));
  for (const g of dAll(n)) {
    const gInv = dInv(n, g);
    for (const h of elems) {
      if (!set.has(dKey(dMul(n, dMul(n, gInv, h), g)))) return false;
    }
  }
  return true;
}

export function subgroupLatticeData(kind = 'D', n = 4) {
  const safeN = Math.max(2, Math.trunc(n));
  let nodes = [];
  let groupOrder;

  if (kind === 'Z') {
    groupOrder = safeN;
    const divs = divisors(safeN);
    nodes = divs.map((d, idx) => {
      const step = safeN / d;
      const elems = Array.from({ length: d }, (_, t) => t * step);
      const label = d === 1 ? '{0}' : d === safeN ? `Z_${safeN}` : `⟨${step}⟩`;
      const tex = d === 1 ? '\\{0\\}' : d === safeN ? `\\mathbb{Z}_{${safeN}}` : `\\langle ${step} \\rangle`;
      return {
        id: idx,
        key: elems.join(','),
        order: d,
        index: safeN / d,
        isNormal: true,
        isCyclic: true,
        label,
        tex,
        isoLabel: d === 1 ? '{0}' : `Z_${d}`,
        elements: elems,
        elementLabels: elems.map(String),
        _set: new Set(elems),
      };
    });
  } else {
    groupOrder = 2 * safeN;
    const divs = divisors(safeN);
    // Rotation subgroups <r^(n/d)> of order d
    for (const d of divs) {
      const step = safeN / d;
      const elems = Array.from({ length: d }, (_, t) => dEl(safeN, t * step, 0));
      const gen = dEl(safeN, step, 0);
      const label = d === 1 ? '{e}' : `⟨${dName(gen)}⟩`;
      const tex = d === 1 ? '\\{e\\}' : `\\langle ${dName(gen, true)} \\rangle`;
      nodes.push({
        key: elems.map(dKey).sort().join(','),
        order: d,
        index: groupOrder / d,
        isNormal: dIsNormalSub(safeN, elems),
        isCyclic: true,
        label,
        tex,
        isoLabel: d === 1 ? '{e}' : `Z_${d}`,
        elements: elems,
        elementLabels: elems.map(x => dName(x)),
        _set: new Set(elems.map(dKey)),
      });
    }
    // Dihedral subgroups <r^(n/d), r^j s> of order 2d
    for (const d of divs) {
      const step = safeN / d;
      for (let j = 0; j < step; j++) {
        const rots = Array.from({ length: d }, (_, t) => dEl(safeN, t * step, 0));
        const refs = Array.from({ length: d }, (_, t) => dEl(safeN, j + t * step, 1));
        const elems = rots.concat(refs);
        const refGen = dEl(safeN, j, 1);
        const rotGen = dEl(safeN, step, 0);
        let label, tex;
        if (d === safeN) {
          label = `D_${safeN}`;
          tex = `D_{${safeN}}`;
        } else if (d === 1) {
          label = `⟨${dName(refGen)}⟩`;
          tex = `\\langle ${dName(refGen, true)} \\rangle`;
        } else {
          label = `⟨${dName(rotGen)},${dName(refGen)}⟩`;
          tex = `\\langle ${dName(rotGen, true)},\\, ${dName(refGen, true)} \\rangle`;
        }
        nodes.push({
          key: elems.map(dKey).sort().join(','),
          order: 2 * d,
          index: groupOrder / (2 * d),
          isNormal: dIsNormalSub(safeN, elems),
          isCyclic: d === 1,
          label,
          tex,
          isoLabel: d === 1 ? 'Z_2' : d === 2 ? 'D_2 ≅ V_4' : `D_${d}`,
          elements: elems,
          elementLabels: elems.map(x => dName(x)),
          _set: new Set(elems.map(dKey)),
        });
      }
    }
    nodes.sort((a, b) => a.order - b.order || Number(b.isNormal) - Number(a.isNormal) || a.label.localeCompare(b.label));
    nodes.forEach((nd, idx) => { nd.id = idx; });
  }

  // Compute strict subset relations and Hasse cover edges
  const isSubset = (A, B) => {
    if (A.order >= B.order || B.order % A.order !== 0) return false;
    for (const x of A._set) if (!B._set.has(x)) return false;
    return true;
  };
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (!isSubset(nodes[i], nodes[j])) continue;
      let covered = true;
      for (let k = i + 1; k < j; k++) {
        if (isSubset(nodes[i], nodes[k]) && isSubset(nodes[k], nodes[j])) {
          covered = false;
          break;
        }
      }
      if (covered) edges.push([i, j]);
    }
  }

  // Group into order levels (bottom = order 1, top = |G|)
  const orderValues = [...new Set(nodes.map(nd => nd.order))].sort((a, b) => a - b);
  const levels = orderValues.map(ord => ({
    order: ord,
    nodeIds: nodes.filter(nd => nd.order === ord).map(nd => nd.id),
  }));

  // Clean internal _set before returning
  const cleanNodes = nodes.map(({ _set, ...rest }) => rest);
  return {
    kind,
    n: safeN,
    groupOrder,
    groupName: kind === 'Z' ? `Z_${safeN}` : `D_${safeN}`,
    nodes: cleanNodes,
    edges,
    levels,
  };
}

// ---- 4. cosets (Z_n or D_n in course conventions) ----

export function cosetsData(kind = 'D', n = 4, sub = ['e', 's']) {
  const safeN = Math.max(2, Math.trunc(n));
  if (kind === 'Z') {
    const H = [...new Set((sub || [0]).map(x => mod(Number(x), safeN)))].sort((a, b) => a - b);
    const seen = new Set();
    const cosets = [];
    for (let g = 0; g < safeN; g++) {
      if (seen.has(g)) continue;
      const elems = H.map(h => mod(g + h, safeN)).sort((a, b) => a - b);
      elems.forEach(x => seen.add(x));
      cosets.push({ rep: String(g), repVal: g, elems: elems.map(String) });
    }
    return {
      kind: 'Z',
      n: safeN,
      groupOrder: safeN,
      subLabels: H.map(String),
      index: cosets.length,
      isNormal: true,
      matchingCount: cosets.length,
      leftCosets: cosets,
      rightCosets: cosets,
      elements: Array.from({ length: safeN }, (_, i) => String(i)),
      leftCosetOf: Array.from({ length: safeN }, (_, g) => cosets.findIndex(c => c.elems.includes(String(g)))),
      rightCosetOf: Array.from({ length: safeN }, (_, g) => cosets.findIndex(c => c.elems.includes(String(g)))),
    };
  }

  // Dihedral D_n in course conventions
  const all = dAll(safeN);
  const H = [];
  const hSeen = new Set();
  for (const tok of (sub && sub.length ? sub : ['e'])) {
    const el = typeof tok === 'string' ? dParse(safeN, tok) : dEl(safeN, tok.k, tok.m);
    const k = dKey(el);
    if (!hSeen.has(k)) { hSeen.add(k); H.push(el); }
  }
  H.sort((a, b) => a.m - b.m || a.k - b.k);

  const uniqueD = arr => {
    const m = new Map();
    for (const x of arr) m.set(dKey(x), x);
    return [...m.values()].sort((a, b) => a.m - b.m || a.k - b.k);
  };
  const setKey = arr => arr.map(dKey).join(',');

  const leftCosets = [];
  const lSeen = new Set();
  for (const g of all) {
    const elems = uniqueD(H.map(h => dMul(safeN, g, h)));
    const key = setKey(elems);
    if (!lSeen.has(key)) {
      lSeen.add(key);
      leftCosets.push({ rep: dName(g), repEl: g, key, elems: elems.map(x => dName(x)), raw: elems });
    }
  }

  const rightCosets = [];
  const rSeen = new Set();
  for (const g of all) {
    const elems = uniqueD(H.map(h => dMul(safeN, h, g)));
    const key = setKey(elems);
    if (!rSeen.has(key)) {
      rSeen.add(key);
      rightCosets.push({ rep: dName(g), repEl: g, key, elems: elems.map(x => dName(x)), raw: elems });
    }
  }

  const rightKeySet = new Set(rightCosets.map(c => c.key));
  let matchingCount = 0;
  for (const lc of leftCosets) {
    lc.matchesRight = rightKeySet.has(lc.key);
    if (lc.matchesRight) matchingCount++;
  }
  const leftKeySet = new Set(leftCosets.map(c => c.key));
  for (const rc of rightCosets) rc.matchesLeft = leftKeySet.has(rc.key);

  const elements = all.map(x => dName(x));
  const leftCosetOf = elements.map(lbl => leftCosets.findIndex(c => c.elems.includes(lbl)));
  const rightCosetOf = elements.map(lbl => rightCosets.findIndex(c => c.elems.includes(lbl)));

  return {
    kind: 'D',
    n: safeN,
    groupOrder: 2 * safeN,
    subLabels: H.map(x => dName(x)),
    index: leftCosets.length,
    isNormal: matchingCount === leftCosets.length,
    matchingCount,
    leftCosets,
    rightCosets,
    elements,
    leftCosetOf,
    rightCosetOf,
  };
}

// ---- 5. hom (Homomorphism arrows) ----

function courseElements(spec) {
  if (spec.kind === 'Z') {
    const n = spec.n;
    return {
      name: `Z_${n}`,
      tex: `\\mathbb{Z}_{${n}}`,
      elements: Array.from({ length: n }, (_, i) => String(i)),
      mul: (a, b) => (a + b) % n,
      e: 0,
    };
  }
  if (spec.kind === 'D') {
    const n = spec.n;
    // Match js/group.js index layout (0..n-1 rotations r^k; n+j reflections s r^j = r^{-j} s)
    // while displaying course-convention r^k s^m labels so G.isHomomorphism images match 1-to-1.
    const elems = Array.from({ length: 2 * n }, (_, i) =>
      i < n ? dEl(n, i, 0) : dEl(n, mod(-(i - n), n), 1)
    );
    const idxOf = x => (x.m ? n + mod(-x.k, n) : mod(x.k, n));
    return {
      name: `D_${n}`,
      tex: `D_{${n}}`,
      elements: elems.map(x => dName(x)),
      mul: (a, b) => idxOf(dMul(n, elems[a], elems[b])),
      e: 0,
    };
  }
  const G = buildGroup(spec);
  return { name: G.name, tex: G.latex, elements: G.elements, mul: (a, b) => G.mul(a, b), e: G.e };
}

export function homData(from, to, images) {
  const A = courseElements(from);
  const B = courseElements(to);
  const imgs = Array.isArray(images) && images.length === A.elements.length
    ? images.map(x => mod(Math.trunc(x), B.elements.length))
    : new Array(A.elements.length).fill(B.e);

  let isHom = true;
  for (let i = 0; i < A.elements.length && isHom; i++) {
    for (let j = 0; j < A.elements.length; j++) {
      if (imgs[A.mul(i, j)] !== B.mul(imgs[i], imgs[j])) { isHom = false; break; }
    }
  }
  const kernel = [];
  const imageSet = new Set();
  const fibers = new Map();
  for (let i = 0; i < imgs.length; i++) {
    const y = imgs[i];
    if (y === B.e) kernel.push(i);
    imageSet.add(y);
    if (!fibers.has(y)) fibers.set(y, []);
    fibers.get(y).push(i);
  }
  const image = [...imageSet].sort((a, b) => a - b);
  return {
    from: A,
    to: B,
    images: imgs,
    isHom,
    kernel,
    image,
    fibers,
    isInjective: isHom && kernel.length === 1,
    isSurjective: isHom && image.length === B.elements.length,
    isIsomorphism: isHom && kernel.length === 1 && image.length === B.elements.length,
  };
}

// ---- 6. torus (m x n periodic lattice hopping) ----

export function torusOrbitData(m, n, a, b) {
  const M = Math.max(2, Math.trunc(m));
  const N = Math.max(2, Math.trunc(n));
  const A = mod(Math.trunc(a), M);
  const B = mod(Math.trunc(b), N);
  const tx = A === 0 ? 1 : M / gcd(A, M);
  const ty = B === 0 ? 1 : N / gcd(B, N);
  const visitedCount = lcm(tx, ty);
  const path = [];
  let x = 0, y = 0;
  for (let t = 0; t < visitedCount; t++) {
    path.push({ step: t, x, y });
    x = (x + A) % M;
    y = (y + B) % N;
  }
  const totalSites = M * N;
  return {
    m: M, n: N, a: A, b: B,
    tx, ty,
    visitedCount,
    totalSites,
    orbitCount: totalSites / visitedCount,
    visitsAll: visitedCount === totalSites,
    canVisitAll: gcd(M, N) === 1,
    path,
  };
}

// ---- 7. wheel (stroboscope wagon-wheel effect) ----

function wrapHalfOpen(x, P) {
  let r = ((x % P) + P) % P;
  if (r > P / 2 + 1e-12) r -= P;
  return Math.abs(r) < 1e-12 ? 0 : r;
}

export function wheelStrobeData({ spokes = 6, fps = 24, radius = 0.5, v = 6 } = {}) {
  const n = Math.max(2, Math.trunc(spokes));
  const f = Math.max(1, Number(fps));
  const R = Math.max(0.05, Number(radius));
  const vel = Number(v);
  const period = (2 * Math.PI) / n;
  const omegaTrue = vel / R;
  const dThetaTrue = omegaTrue / f;
  const dThetaApp = wrapHalfOpen(dThetaTrue, period);
  const omegaApp = f * dThetaApp;
  const vFrozen1 = (2 * Math.PI * f * R) / n;
  const vMaxTrue = vFrozen1 / 2;
  const rpmTrue = (omegaTrue * 60) / (2 * Math.PI);
  const rpmApp = (omegaApp * 60) / (2 * Math.PI);
  const dir = Math.abs(dThetaApp) < 1e-6 ? 'frozen' : dThetaApp > 0 ? 'forward' : 'backward';
  const dirLabel = dir === 'frozen' ? 'Durgun (donmuş)' : dir === 'forward' ? 'İleri' : 'Geri (ters yanılsama)';
  return {
    spokes: n, fps: f, radius: R, v: vel,
    period, omegaTrue, dThetaTrue, dThetaApp, omegaApp,
    vFrozen1, vMaxTrue, rpmTrue, rpmApp,
    dir, dirLabel,
  };
}

// ---- 8. brillouin (1D atomic chain & first Brillouin zone) ----

export function brillouinData({ a = 2, k = (5 * Math.PI) / 4 } = {}) {
  const A = Math.max(0.2, Number(a));
  const K = Number(k);
  const G = (2 * Math.PI) / A; // reciprocal lattice period
  const kReduced = wrapHalfOpen(K, G);
  const mShift = Math.round((K - kReduced) / G);
  const cOrig = (K * A) / Math.PI;
  const cReduced = (kReduced * A) / Math.PI;
  const atoms = [];
  for (let j = -4; j <= 4; j++) {
    const x = j * A;
    atoms.push({ j, x, yOrig: Math.cos(K * x), yRed: Math.cos(kReduced * x) });
  }
  return {
    a: A,
    k: K,
    G,
    kReduced,
    mShift,
    cOrig,
    cReduced,
    bzHalf: Math.PI / A,
    atoms,
  };
}

// ---- 9. shuffle (card permutation) ----

export function shuffleData(perm) {
  const p = Array.isArray(perm) && perm.length >= 2 ? perm.slice() : [1, 5, 2, 6, 3, 7, 4, 8];
  const n = p.length;
  const cycles = permCycles(p);
  const order = permOrder(p);
  const sign = permSign(p);
  const cType = cycleType(p);
  // Compute cycle color index for each position 1..n
  const cycleOf = new Array(n).fill(-1);
  cycles.forEach((cyc, ci) => cyc.forEach(pos => { cycleOf[pos - 1] = ci; }));
  // Apply p to a deck array (deck[pos-1] = card label at position pos):
  // Since position i moves to position p[i-1], nextDeck[p[i-1]-1] = deck[i-1]
  const applyDeck = deck => {
    const next = new Array(n);
    for (let i = 0; i < n; i++) next[p[i] - 1] = deck[i];
    return next;
  };
  return {
    n,
    perm: p,
    cycles,
    cyclesStr: cyclesString(p),
    cycleType: cType,
    order,
    sign,
    cycleOf,
    applyDeck,
  };
}

// ---- 10. puzzle15 (4x4 sliding puzzle) ----

export function puzzle15Data(tiles) {
  const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
  let board = solved;
  if (Array.isArray(tiles) && tiles.length === 16) {
    const seen = new Set(tiles);
    if (seen.size === 16 && tiles.every(v => Number.isInteger(v) && v >= 0 && v <= 15)) {
      board = tiles.slice();
    }
  }
  const blankIdx = board.indexOf(0);
  const blankRow = Math.floor(blankIdx / 4);
  const blankCol = blankIdx % 4;
  const blankTaxicab = (3 - blankRow) + (3 - blankCol);
  const blankColor = (blankRow + blankCol) % 2 === 0 ? 'Açık' : 'Koyu';

  let inversions = 0;
  for (let i = 0; i < 16; i++) {
    if (board[i] === 0) continue;
    for (let j = i + 1; j < 16; j++) {
      if (board[j] !== 0 && board[i] > board[j]) inversions++;
    }
  }
  const fullPerm = board.map(v => (v === 0 ? 16 : v));
  const fullSign = permSign(fullPerm);
  const blankParity = blankTaxicab % 2 === 0 ? 1 : -1;
  const invariant = fullSign * blankParity;
  const solvable = invariant === 1;
  const isSolved = board.every((v, i) => v === solved[i]);

  return {
    tiles: board,
    blankIdx,
    blankRow,
    blankCol,
    blankTaxicab,
    blankColor,
    inversions,
    fullPerm,
    fullSign,
    blankParity,
    invariant,
    solvable,
    isSolved,
  };
}

export function puzzle15Move(tiles, tileIdx) {
  const blankIdx = tiles.indexOf(0);
  if (tileIdx < 0 || tileIdx >= 16 || tileIdx === blankIdx) return null;
  const r1 = Math.floor(tileIdx / 4), c1 = tileIdx % 4;
  const r0 = Math.floor(blankIdx / 4), c0 = blankIdx % 4;
  if (Math.abs(r1 - r0) + Math.abs(c1 - c0) !== 1) return null;
  const next = tiles.slice();
  [next[tileIdx], next[blankIdx]] = [next[blankIdx], next[tileIdx]];
  return next;
}

// ---- 11. cube (O ≅ S_4 on 4 body diagonals) ----

export const CUBE_DIAGS = [
  [1, 1, 1],    // d1
  [-1, 1, 1],   // d2
  [-1, -1, 1],  // d3
  [1, -1, 1],   // d4
];

export function cubeMul3(A, B) {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return C;
}

export function applyMat3(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

export const CUBE_OPS = [
  { id: 'rx',     label: 'Rₓ (90°)',         axis: [1, 0, 0],  angle: Math.PI / 2, mat: [[1, 0, 0], [0, 0, -1], [0, 1, 0]] },
  { id: 'ry',     label: 'Rᵧ (90°)',         axis: [0, 1, 0],  angle: Math.PI / 2, mat: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] },
  { id: 'rz',     label: 'R_z (90°)',        axis: [0, 0, 1],  angle: Math.PI / 2, mat: [[0, -1, 0], [1, 0, 0], [0, 0, 1]] },
  { id: 'rx2',    label: 'Rₓ (180°)',        axis: [1, 0, 0],  angle: Math.PI,     mat: [[1, 0, 0], [0, -1, 0], [0, 0, -1]] },
  { id: 'diag1',  label: 'C₃ (d₁, 120°)',    axis: [1, 1, 1],  angle: (2 * Math.PI) / 3, mat: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] },
  { id: 'edge12', label: 'C₂ (kenar, 180°)', axis: [1, 1, 0],  angle: Math.PI,     mat: [[0, 1, 0], [1, 0, 0], [0, 0, -1]] },
];

export function cubeAnalyze(rot) {
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const M = (Array.isArray(rot) && rot.length === 3 && rot.every(r => Array.isArray(r) && r.length === 3))
    ? rot.map(r => r.map(x => Math.round(x)))
    : I;

  // 1-based diagonal permutation in S_4
  const diagPerm = new Array(4);
  for (let i = 0; i < 4; i++) {
    const w = applyMat3(M, CUBE_DIAGS[i]);
    for (let j = 0; j < 4; j++) {
      const d = CUBE_DIAGS[j];
      if ((w[0] === d[0] && w[1] === d[1] && w[2] === d[2]) ||
          (w[0] === -d[0] && w[1] === -d[1] && w[2] === -d[2])) {
        diagPerm[i] = j + 1;
        break;
      }
    }
  }
  // 1-based unsigned coordinate-axis permutation in S_3
  const axisPerm = new Array(3);
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      if (M[i][j] !== 0) { axisPerm[j] = i + 1; break; }
    }
  }
  const tr = M[0][0] + M[1][1] + M[2][2];
  const ct = cycleType(diagPerm);
  const order = permOrder(diagPerm);
  const sign = permSign(diagPerm);
  let kindLabel;
  if (tr === 3) kindLabel = 'Birim (0°)';
  else if (tr === 1) kindLabel = 'Yüz ekseni 90°';
  else if (tr === 0) kindLabel = 'Köşegen ekseni 120°';
  else if (ct.length === 2 && ct[0] === 2 && ct[1] === 2) kindLabel = 'Yüz ekseni 180°';
  else kindLabel = 'Kenar ortası ekseni 180°';

  const vars = ['x', 'y', 'z'];
  const coordOut = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (M[i][j] !== 0) { coordOut.push(M[i][j] === -1 ? `-${vars[j]}` : vars[j]); break; }
    }
  }
  return {
    mat: M,
    diagPerm,
    diagCycles: cyclesString(diagPerm),
    axisPerm,
    axisCycles: cyclesString(axisPerm),
    order,
    sign,
    kindLabel,
    coordMap: `(x, y, z) ↦ (${coordOut.join(', ')})`,
  };
}

// ---- 12. molecule (NH3, H2O, CH4, C6H6, C2H4, BF3) ----

function rotZMat(theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

function reflectPlaneMat(nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz) || 1;
  const x = nx / len, y = ny / len, z = nz / len;
  return [
    [1 - 2 * x * x, -2 * x * y, -2 * x * z],
    [-2 * y * x, 1 - 2 * y * y, -2 * y * z],
    [-2 * z * x, -2 * z * y, 1 - 2 * z * z],
  ];
}

function rotAxisMat(ax, ay, az, theta) {
  const len = Math.hypot(ax, ay, az) || 1;
  const x = ax / len, y = ay / len, z = az / len;
  const c = Math.cos(theta), s = Math.sin(theta), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

export const MOLECULE_DEFS = (() => {
  const deg = a => (a * Math.PI) / 180;
  // NH3: N at (0,0,0.42), H1..H3 at R=0.94, z=-0.32, angles 0, 120, 240
  const nh3H = [0, 1, 2].map(i => [0.94 * Math.cos(deg(i * 120)), 0.94 * Math.sin(deg(i * 120)), -0.32]);
  // H2O: O at (0,0,0.32), H1=(+0.83,0,-0.32), H2=(-0.83,0,-0.32)
  const h2oX = 1.05 * Math.sin(deg(52.25)), h2oZ = 0.32 - 1.05 * Math.cos(deg(52.25));
  // CH4: C at (0,0,0), H1..H4 at T+ scaled by 0.72
  const ch4s = 0.72;
  const ch4H = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(c => c * ch4s));
  // C6H6: 6 C at R=0.95, 6 H at R=1.62, angles 0..300
  const c6C = [0, 1, 2, 3, 4, 5].map(i => [0.95 * Math.cos(deg(i * 60)), 0.95 * Math.sin(deg(i * 60)), 0]);
  const c6H = [0, 1, 2, 3, 4, 5].map(i => [1.62 * Math.cos(deg(i * 60)), 1.62 * Math.sin(deg(i * 60)), 0]);
  // BF3: B at (0,0,0), 3 F at R=1.15, angles 0, 120, 240
  const bf3F = [0, 1, 2].map(i => [1.15 * Math.cos(deg(i * 120)), 1.15 * Math.sin(deg(i * 120)), 0]);

  return {
    NH3: {
      name: 'NH3',
      title: 'Amonyak (NH₃)',
      pointGroup: 'C₃ᵥ ≅ D₃',
      groupOrder: 6,
      atoms: [
        { el: 'N', label: 'N', pos: [0, 0, 0.42], radius: 0.34, color: '#3b82f6' },
        { el: 'H', label: 'H₁', num: 1, pos: nh3H[0], radius: 0.22, color: '#e4e4e7' },
        { el: 'H', label: 'H₂', num: 2, pos: nh3H[1], radius: 0.22, color: '#e4e4e7' },
        { el: 'H', label: 'H₃', num: 3, pos: nh3H[2], radius: 0.22, color: '#e4e4e7' },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      axes: [{ label: 'C₃', dir: [0, 0, 1], color: '#38bdf8' }],
      mirrors: [
        { label: 'σᵥ (s)', normal: [0, 1, 0] },
        { label: 'σᵥ (rs)', normal: [-Math.sin(deg(60)), Math.cos(deg(60)), 0] },
        { label: 'σᵥ (r²s)', normal: [-Math.sin(deg(120)), Math.cos(deg(120)), 0] },
      ],
      ops: [
        { id: 'r',   label: 'r (C₃ +120°)', kind: 'rot', axis: [0, 0, 1], angle: deg(120), mat: rotZMat(deg(120)) },
        { id: 'r2',  label: 'r² (C₃² 240°)', kind: 'rot', axis: [0, 0, 1], angle: deg(240), mat: rotZMat(deg(240)) },
        { id: 's',   label: 's (H₁ aynası)', kind: 'refl', normal: [0, 1, 0], mat: reflectPlaneMat(0, 1, 0) },
        { id: 'rs',  label: 'rs (H₃ aynası)', kind: 'refl', normal: [-Math.sin(deg(60)), Math.cos(deg(60)), 0], mat: reflectPlaneMat(-Math.sin(deg(60)), Math.cos(deg(60)), 0) },
        { id: 'r2s', label: 'r²s (H₂ aynası)', kind: 'refl', normal: [-Math.sin(deg(120)), Math.cos(deg(120)), 0], mat: reflectPlaneMat(-Math.sin(deg(120)), Math.cos(deg(120)), 0) },
      ],
    },
    H2O: {
      name: 'H2O',
      title: 'Su (H₂O)',
      pointGroup: 'C₂ᵥ ≅ Z₂ × Z₂',
      groupOrder: 4,
      atoms: [
        { el: 'O', label: 'O', pos: [0, 0, 0.32], radius: 0.36, color: '#ef4444' },
        { el: 'H', label: 'H₁', num: 1, pos: [h2oX, 0, h2oZ], radius: 0.22, color: '#e4e4e7' },
        { el: 'H', label: 'H₂', num: 2, pos: [-h2oX, 0, h2oZ], radius: 0.22, color: '#e4e4e7' },
      ],
      bonds: [[0, 1], [0, 2]],
      axes: [{ label: 'C₂', dir: [0, 0, 1], color: '#38bdf8' }],
      mirrors: [
        { label: 'σᵥ (molekül düzlemi)', normal: [0, 1, 0] },
        { label: "σᵥ' (dik ayna)", normal: [1, 0, 0] },
      ],
      ops: [
        { id: 'c2',  label: 'C₂ (180°)', kind: 'rot', axis: [0, 0, 1], angle: Math.PI, mat: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]] },
        { id: 'sv',  label: 'σᵥ (düzlem)', kind: 'refl', normal: [0, 1, 0], mat: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] },
        { id: 'sv2', label: "σᵥ' (dik ayna)", kind: 'refl', normal: [1, 0, 0], mat: [[-1, 0, 0], [0, 1, 0], [0, 0, 1]] },
      ],
    },
    CH4: {
      name: 'CH4',
      title: 'Metan (CH₄)',
      pointGroup: 'T_d (öz dönmeler A₄)',
      groupOrder: 12,
      atoms: [
        { el: 'C', label: 'C', pos: [0, 0, 0], radius: 0.35, color: '#71717a' },
        { el: 'H', label: 'H₁', num: 1, pos: ch4H[0], radius: 0.22, color: '#e4e4e7' },
        { el: 'H', label: 'H₂', num: 2, pos: ch4H[1], radius: 0.22, color: '#e4e4e7' },
        { el: 'H', label: 'H₃', num: 3, pos: ch4H[2], radius: 0.22, color: '#e4e4e7' },
        { el: 'H', label: 'H₄', num: 4, pos: ch4H[3], radius: 0.22, color: '#e4e4e7' },
      ],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
      axes: [
        { label: 'C₃ (H₁)', dir: [1, 1, 1], color: '#38bdf8' },
        { label: 'C₂ (Z)', dir: [0, 0, 1], color: '#fbbf24' },
      ],
      mirrors: [
        { label: 'σ_d (x = y)', normal: [1, -1, 0] },
      ],
      ops: [
        { id: 'c3_1', label: 'C₃ (H₁, 120°)', kind: 'rot', axis: [1, 1, 1], angle: deg(120), mat: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] },
        { id: 'c3_2', label: 'C₃ (H₂, 120°)', kind: 'rot', axis: [1, -1, -1], angle: deg(120), mat: rotAxisMat(1, -1, -1, deg(120)) },
        { id: 'c2x',  label: 'C₂ˣ (180°)', kind: 'rot', axis: [1, 0, 0], angle: Math.PI, mat: [[1, 0, 0], [0, -1, 0], [0, 0, -1]] },
        { id: 'c2z',  label: 'C₂ᶻ (180°)', kind: 'rot', axis: [0, 0, 1], angle: Math.PI, mat: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]] },
        { id: 'sd',   label: 'σ_d (x=y aynası)', kind: 'refl', normal: [1, -1, 0], mat: [[0, 1, 0], [1, 0, 0], [0, 0, 1]] },
      ],
    },
    C6H6: {
      name: 'C6H6',
      title: 'Benzen (C₆H₆)',
      pointGroup: 'D₆ₕ (düzlem içi D₆)',
      groupOrder: 24,
      atoms: [
        ...c6C.map((p, i) => ({ el: 'C', label: `C${i + 1}`, pos: p, radius: 0.28, color: '#71717a' })),
        ...c6H.map((p, i) => ({ el: 'H', label: `H${i + 1}`, num: i + 1, pos: p, radius: 0.19, color: '#e4e4e7' })),
      ],
      bonds: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
        [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11],
      ],
      axes: [{ label: 'C₆', dir: [0, 0, 1], color: '#38bdf8' }],
      mirrors: [
        { label: 'σᵥ (s, C–H ekseni)', normal: [0, 1, 0] },
        { label: 'σ_d (rs, kenar ekseni)', normal: [-Math.sin(deg(30)), Math.cos(deg(30)), 0] },
        { label: 'σₕ (halka düzlemi)', normal: [0, 0, 1] },
      ],
      ops: [
        { id: 'r',  label: 'r (C₆ +60°)', kind: 'rot', axis: [0, 0, 1], angle: deg(60), mat: rotZMat(deg(60)) },
        { id: 'r2', label: 'r² (C₃ 120°)', kind: 'rot', axis: [0, 0, 1], angle: deg(120), mat: rotZMat(deg(120)) },
        { id: 'r3', label: 'r³ (C₂ 180°)', kind: 'rot', axis: [0, 0, 1], angle: Math.PI, mat: rotZMat(Math.PI) },
        { id: 's',  label: 's (köşe aynası)', kind: 'refl', normal: [0, 1, 0], mat: reflectPlaneMat(0, 1, 0) },
        { id: 'rs', label: 'rs (kenar aynası)', kind: 'refl', normal: [-Math.sin(deg(30)), Math.cos(deg(30)), 0], mat: reflectPlaneMat(-Math.sin(deg(30)), Math.cos(deg(30)), 0) },
        { id: 'sh', label: 'σₕ (yatay ayna)', kind: 'refl', normal: [0, 0, 1], mat: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
      ],
    },
    C2H4: {
      name: 'C2H4',
      title: 'Etilen (C₂H₄)',
      pointGroup: 'D₂ₕ (dönmeler D₂ ≅ V₄)',
      groupOrder: 8,
      atoms: [
        { el: 'C', label: 'C₁', pos: [0.58, 0, 0], radius: 0.31, color: '#71717a' },
        { el: 'C', label: 'C₂', pos: [-0.58, 0, 0], radius: 0.31, color: '#71717a' },
        { el: 'H', label: 'H₁', num: 1, pos: [1.15, 0.78, 0], radius: 0.21, color: '#e4e4e7' },
        { el: 'H', label: 'H₂', num: 2, pos: [-1.15, 0.78, 0], radius: 0.21, color: '#e4e4e7' },
        { el: 'H', label: 'H₃', num: 3, pos: [-1.15, -0.78, 0], radius: 0.21, color: '#e4e4e7' },
        { el: 'H', label: 'H₄', num: 4, pos: [1.15, -0.78, 0], radius: 0.21, color: '#e4e4e7' },
      ],
      bonds: [[0, 1], [0, 2], [0, 5], [1, 3], [1, 4]],
      axes: [
        { label: 'C₂ˣ', dir: [1, 0, 0], color: '#f472b6' },
        { label: 'C₂ʸ', dir: [0, 1, 0], color: '#34d399' },
        { label: 'C₂ᶻ', dir: [0, 0, 1], color: '#38bdf8' },
      ],
      mirrors: [
        { label: 'σₕ (xy düzlemi)', normal: [0, 0, 1] },
        { label: 'σᵥ (yz düzlemi)', normal: [1, 0, 0] },
      ],
      ops: [
        { id: 'c2x', label: 'C₂ˣ (180°)', kind: 'rot', axis: [1, 0, 0], angle: Math.PI, mat: [[1, 0, 0], [0, -1, 0], [0, 0, -1]] },
        { id: 'c2y', label: 'C₂ʸ (180°)', kind: 'rot', axis: [0, 1, 0], angle: Math.PI, mat: [[-1, 0, 0], [0, 1, 0], [0, 0, -1]] },
        { id: 'c2z', label: 'C₂ᶻ (180°)', kind: 'rot', axis: [0, 0, 1], angle: Math.PI, mat: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]] },
        { id: 'sh',  label: 'σₕ (yatay ayna)', kind: 'refl', normal: [0, 0, 1], mat: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
      ],
    },
    BF3: {
      name: 'BF3',
      title: 'Bor Triflorür (BF₃)',
      pointGroup: 'D₃ₕ ≅ D₃ × Z₂',
      groupOrder: 12,
      atoms: [
        { el: 'B', label: 'B', pos: [0, 0, 0], radius: 0.34, color: '#f59e0b' },
        { el: 'F', label: 'F₁', num: 1, pos: bf3F[0], radius: 0.27, color: '#4ade80' },
        { el: 'F', label: 'F₂', num: 2, pos: bf3F[1], radius: 0.27, color: '#4ade80' },
        { el: 'F', label: 'F₃', num: 3, pos: bf3F[2], radius: 0.27, color: '#4ade80' },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      axes: [{ label: 'C₃', dir: [0, 0, 1], color: '#38bdf8' }],
      mirrors: [
        { label: 'σᵥ (s, F₁ ekseni)', normal: [0, 1, 0] },
        { label: 'σₕ (molekül düzlemi)', normal: [0, 0, 1] },
      ],
      ops: [
        { id: 'r',   label: 'r (C₃ +120°)', kind: 'rot', axis: [0, 0, 1], angle: deg(120), mat: rotZMat(deg(120)) },
        { id: 'r2',  label: 'r² (240°)', kind: 'rot', axis: [0, 0, 1], angle: deg(240), mat: rotZMat(deg(240)) },
        { id: 's',   label: 's (F₁ aynası)', kind: 'refl', normal: [0, 1, 0], mat: reflectPlaneMat(0, 1, 0) },
        { id: 'rs',  label: 'rs (F₃ aynası)', kind: 'refl', normal: [-Math.sin(deg(60)), Math.cos(deg(60)), 0], mat: reflectPlaneMat(-Math.sin(deg(60)), Math.cos(deg(60)), 0) },
        { id: 'r2s', label: 'r²s (F₂ aynası)', kind: 'refl', normal: [-Math.sin(deg(120)), Math.cos(deg(120)), 0], mat: reflectPlaneMat(-Math.sin(deg(120)), Math.cos(deg(120)), 0) },
        { id: 'sh',  label: 'σₕ (yatay ayna)', kind: 'refl', normal: [0, 0, 1], mat: [[1, 0, 0], [0, 1, 0], [0, 0, -1]] },
      ],
    },
  };
})();

export function moleculeData(name = 'NH3') {
  return MOLECULE_DEFS[name] || MOLECULE_DEFS.NH3;
}

/** Compute the induced 1-based permutation on numbered outer atoms for any 3x3 orthogonal matrix M. */
export function moleculePermOfMatrix(def, M) {
  const numbered = def.atoms.filter(a => Number.isInteger(a.num)).sort((a, b) => a.num - b.num);
  const p = new Array(numbered.length);
  for (let i = 0; i < numbered.length; i++) {
    const img = applyMat3(M, numbered[i].pos);
    let best = -1, bestD = Infinity;
    for (let j = 0; j < numbered.length; j++) {
      const q = numbered[j].pos;
      const d = Math.hypot(img[0] - q[0], img[1] - q[1], img[2] - q[2]);
      if (d < bestD) { bestD = d; best = j; }
    }
    p[i] = best + 1;
  }
  return p;
}

// ---- 13. velocity (Relativistic addition & rapidity) ----

export function velocityData(u = 0.5, v = 0.5) {
  const clampV = x => Math.max(-0.999, Math.min(0.999, Number(x) || 0));
  const U = clampV(u), V = clampV(v);
  const sumRel = (U + V) / (1 + U * V);
  const sumGal = U + V;
  const phiU = Math.atanh(U);
  const phiV = Math.atanh(V);
  const phiSum = phiU + phiV;
  const gammaU = 1 / Math.sqrt(1 - U * U);
  const gammaV = 1 / Math.sqrt(1 - V * V);
  const gammaSum = 1 / Math.sqrt(1 - sumRel * sumRel);
  return {
    u: U, v: V,
    sumRel, sumGal,
    phiU, phiV, phiSum,
    gammaU, gammaV, gammaSum,
  };
}

// ---- 14. music (12 pitch classes & D_12 T/I group) ----

export const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function musicApply(chord, el) {
  const norm = dEl(12, el.k, el.m);
  return [...new Set(chord.map(x => mod(norm.m ? -x + norm.k : x + norm.k, 12)))].sort((a, b) => a - b);
}

export function musicStabilizer(chord) {
  const clean = [...new Set(chord.map(x => mod(Math.trunc(x), 12)))].sort((a, b) => a - b);
  const key = clean.join(',');
  return dAll(12).filter(g => musicApply(clean, g).join(',') === key);
}

export function musicData(chord = [0, 4, 7], op = { k: 0, m: 0 }) {
  const base = [...new Set((chord || [0, 4, 7]).map(x => mod(Math.trunc(x), 12)))].sort((a, b) => a - b);
  const el = dEl(12, op.k || 0, op.m || 0);
  const transformed = musicApply(base, el);
  const stab = musicStabilizer(transformed);
  return {
    base,
    chord: transformed,
    noteNames: transformed.map(x => PITCH_NAMES[x]),
    el,
    opLabel: el.m ? `I_${el.k}` : `T_${el.k}`,
    dLabel: dName(el),
    stabSize: stab.length,
    orbitSize: 24 / stab.length,
    mirrorAxisAngle: el.m ? (el.k * Math.PI) / 12 : null,
  };
}

// ---- 15. orbits (circular orbits & alignments) ----

export function orbitsData(periods = [3, 5], t = 0) {
  const ps = (Array.isArray(periods) && periods.length >= 2 ? periods : [3, 5])
    .map(x => Math.max(2, Math.trunc(Number(x) || 2)));
  const alignPeriod = ps.reduce((acc, p) => lcm(acc, p), 1);
  const prod = ps.reduce((acc, p) => acc * p, 1);
  const time = Number(t) || 0;
  const bodies = ps.map((p, i) => {
    const phase = ((time % p) + p) % p;
    const angle = (2 * Math.PI * phase) / p;
    return { idx: i, period: p, phase, intPhase: mod(Math.round(time), p), angle };
  });
  let allCoprime = true;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) if (gcd(ps[i], ps[j]) !== 1) allCoprime = false;
  }
  return {
    periods: ps,
    alignPeriod,
    groupOrder: prod,
    isCyclic: allCoprime,
    index: prod / alignPeriod,
    t: time,
    bodies,
    alignedNow: bodies.every(b => Math.abs(Math.sin(b.angle / 2)) < 1e-3),
  };
}

// ---- 16. lights (Lights Out over GF(2)) ----

export function lightsSystem(rows = 3, cols = 3) {
  const R = Math.max(1, Math.min(5, Math.trunc(rows)));
  const C = Math.max(1, Math.min(5, Math.trunc(cols)));
  const N = R * C;
  const colMasks = new Array(N).fill(0);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const idx = r * C + c;
      let m = 1 << idx;
      if (r > 0) m |= 1 << ((r - 1) * C + c);
      if (r + 1 < R) m |= 1 << ((r + 1) * C + c);
      if (c > 0) m |= 1 << (r * C + (c - 1));
      if (c + 1 < C) m |= 1 << (r * C + (c + 1));
      colMasks[idx] = m;
    }
  }
  const aug = colMasks.map((m, i) => ({ row: m, comb: 1 << i }));
  let rIdx = 0;
  for (let col = 0; col < N && rIdx < N; col++) {
    let piv = -1;
    for (let i = rIdx; i < N; i++) if ((aug[i].row >> col) & 1) { piv = i; break; }
    if (piv === -1) continue;
    [aug[rIdx], aug[piv]] = [aug[piv], aug[rIdx]];
    for (let i = 0; i < N; i++) {
      if (i !== rIdx && ((aug[i].row >> col) & 1)) {
        aug[i].row ^= aug[rIdx].row;
        aug[i].comb ^= aug[rIdx].comb;
      }
    }
    rIdx++;
  }
  const rank = rIdx;
  const nullity = N - rank;
  const kernelBasis = [];
  for (let i = rank; i < N; i++) kernelBasis.push(aug[i].comb);

  const popcnt = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  const isSolvable = mask => kernelBasis.every(q => (popcnt(q & mask) & 1) === 0);
  const applyButtons = btnMask => {
    let st = 0;
    for (let i = 0; i < N; i++) if ((btnMask >> i) & 1) st ^= colMasks[i];
    return st;
  };
  const solve = targetMask => {
    if (!isSolvable(targetMask)) return null;
    const mat = colMasks.map((row, i) => ({ row, rhs: (targetMask >> i) & 1 }));
    const pCols = [];
    let rr = 0;
    for (let col = 0; col < N && rr < N; col++) {
      let piv = -1;
      for (let i = rr; i < N; i++) if ((mat[i].row >> col) & 1) { piv = i; break; }
      if (piv === -1) continue;
      [mat[rr], mat[piv]] = [mat[piv], mat[rr]];
      for (let i = 0; i < N; i++) {
        if (i !== rr && ((mat[i].row >> col) & 1)) {
          mat[i].row ^= mat[rr].row;
          mat[i].rhs ^= mat[rr].rhs;
        }
      }
      pCols.push(col);
      rr++;
    }
    let sol = 0;
    for (let i = 0; i < pCols.length; i++) if (mat[i].rhs) sol |= 1 << pCols[i];
    return sol;
  };
  return {
    rows: R, cols: C, N, colMasks, rank, nullity,
    groupOrder: 1 << N,
    imageOrder: 1 << rank,
    kernelOrder: 1 << nullity,
    kernelBasis,
    isSolvable,
    applyButtons,
    solve,
  };
}

// ---- 17. pauli (16-element Pauli group P_1) ----

let PAULI_CACHE = null;
export function pauliGroupData() {
  if (PAULI_CACHE) return PAULI_CACHE;
  const cAdd = (u, v) => [u[0] + v[0], u[1] + v[1]];
  const cMul = (u, v) => [u[0] * v[0] - u[1] * v[1], u[0] * v[1] + u[1] * v[0]];
  const mScale = (s, M) => M.map(row => row.map(z => cMul(s, z)));
  const mMul = (A, B) => [0, 1].map(i => [0, 1].map(j =>
    cAdd(cMul(A[i][0], B[0][j]), cMul(A[i][1], B[1][j]))
  ));
  const mKey = M => M.flat().map(z => `${z[0]},${z[1]}`).join(';');

  const BASE = [
    { sym: 'I', group: 0, mat: [[[1, 0], [0, 0]], [[0, 0], [1, 0]]] },
    { sym: 'X', group: 1, mat: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]] },
    { sym: 'Y', group: 2, mat: [[[0, 0], [0, -1]], [[0, 1], [0, 0]]] },
    { sym: 'Z', group: 3, mat: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]] },
  ];
  const PHASES = [
    { pre: '', s: [1, 0] },
    { pre: '-', s: [-1, 0] },
    { pre: 'i', s: [0, 1] },
    { pre: '-i', s: [0, -1] },
  ];
  const elems = [];
  const byKey = new Map();
  for (const b of BASE) {
    for (const ph of PHASES) {
      const mat = mScale(ph.s, b.mat);
      const idx = elems.length;
      elems.push({ idx, label: `${ph.pre}${b.sym}`, base: b.sym, baseIdx: b.group, phase: ph.pre || '+', mat });
      byKey.set(mKey(mat), idx);
    }
  }
  const N = elems.length;
  const table = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => byKey.get(mKey(mMul(elems[i].mat, elems[j].mat))))
  );
  const inv = Array.from({ length: N }, (_, i) => table[i].indexOf(0));
  const ord = Array.from({ length: N }, (_, i) => {
    let cur = i, k = 1;
    while (cur !== 0) { cur = table[cur][i]; k++; }
    return k;
  });
  const mul = (i, j) => table[i][j];
  const conj = (g, a) => mul(mul(inv[g], a), g);
  const comm = (a, b) => mul(mul(mul(a, b), inv[a]), inv[b]);
  const centerIdx = elems.filter((_, i) => elems.every((_, g) => mul(i, g) === mul(g, i))).map(e => e.idx);
  const seen = new Set();
  const conjClasses = [];
  for (let a = 0; a < N; a++) {
    if (seen.has(a)) continue;
    const cls = [...new Set(elems.map((_, g) => conj(g, a)))].sort((x, y) => x - y);
    cls.forEach(x => seen.add(x));
    conjClasses.push(cls);
  }
  const q8Indices = ['I', '-I', 'iX', '-iX', 'iY', '-iY', 'iZ', '-iZ']
    .map(lbl => elems.find(e => e.label === lbl).idx);

  PAULI_CACHE = { elems, table, mul, inv, ord, conj, comm, center: centerIdx, conjClasses, q8Indices };
  return PAULI_CACHE;
}

// ---- 18. cayley (Course-convention Cayley table for Z, D, S, A, U, V4, Q8) ----

export function cayleyModelData(spec = { kind: 'D', n: 4 }) {
  const kind = spec?.kind || 'D';
  const n = spec?.n ?? 4;

  if (kind === 'D') {
    const safeN = Math.max(2, Math.min(10, Math.trunc(n)));
    const all = dAll(safeN);
    const sz = all.length;
    const idxOf = x => x.m * safeN + x.k;
    const elements = all.map(x => dName(x));
    const latexElements = all.map(x => dName(x, true));
    const table = Array.from({ length: sz }, (_, i) =>
      Array.from({ length: sz }, (_, j) => idxOf(dMul(safeN, all[i], all[j])))
    );
    const invs = all.map(x => idxOf(dInv(safeN, x)));
    const ords = all.map(x => dOrder(safeN, x));
    const ab = safeN <= 2;
    const zSize = safeN % 2 === 0 ? (safeN === 2 ? 4 : 2) : 1;
    return {
      name: `D_${safeN}`,
      latex: `D_{${safeN}}`,
      op: '·',
      size: sz,
      elements,
      latexElements,
      table,
      inv: i => invs[i],
      ord: i => ords[i],
      isAbelian: ab,
      isCyclic: false,
      centerSize: zSize,
    };
  }

  const G = buildGroup(spec);
  const sz = G.size;
  const table = Array.from({ length: sz }, (_, i) =>
    Array.from({ length: sz }, (_, j) => G.mul(i, j))
  );
  const ords = Array.from({ length: sz }, (_, i) => {
    let cur = i, k = 1;
    while (cur !== G.e) { cur = G.mul(cur, i); k++; }
    return k;
  });
  return {
    name: G.name,
    latex: G.latex,
    op: G.meta?.operation || '·',
    size: sz,
    elements: G.elements.slice(),
    latexElements: G.meta?.latexElements ? G.meta.latexElements.slice() : G.elements.slice(),
    table,
    inv: i => G.inv(i),
    ord: i => ords[i],
    isAbelian: isAbelian(G),
    isCyclic: isCyclic(G),
    centerSize: center(G).length,
  };
}
