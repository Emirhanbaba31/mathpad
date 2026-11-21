// Shared kit for the group-theory problem sets (pure: no DOM, runs in node tests).
// Conventions follow FZT 203E: vertices 1..n counterclockwise, r = rotation by 2π/n, s = reflection in the axis
// through vertex 1; products right to left (in gh, h acts first); a symmetry is the permutation of POSITIONS
// i -> j when the vertex at position i is carried to position j; D_n normal form r^k s^m (0 <= k < n, m ∈ {0,1}).

// ---------- seeded randomness ----------
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next, int,
    pick: arr => arr[int(0, arr.length - 1)],
    shuffle: arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = int(0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; },
    sample: (arr, k) => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = int(0, i); [b[i], b[j]] = [b[j], b[i]]; } return b.slice(0, k); },
  };
}

// ---------- number theory ----------
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0);
export const mod = (x, n) => ((x % n) + n) % n;
export const divisors = n => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };

// ---------- permutations of positions 1..n (arrays p with p[i-1] = image of i) ----------
export const permId = n => Array.from({ length: n }, (_, i) => i + 1);
/** p∘q: q acts first (right to left), as in the course. */
export const permMul = (p, q) => q.map(x => p[x - 1]);
export const permInv = p => { const r = new Array(p.length); p.forEach((x, i) => { r[x - 1] = i + 1; }); return r; };
export const permEq = (p, q) => p.length === q.length && p.every((x, i) => x === q[i]);
export function permCycles(p) {
  const seen = new Array(p.length).fill(false), out = [];
  for (let i = 1; i <= p.length; i++) {
    if (seen[i - 1] || p[i - 1] === i) { seen[i - 1] = true; continue; }
    const c = []; let j = i;
    while (!seen[j - 1]) { seen[j - 1] = true; c.push(j); j = p[j - 1]; }
    out.push(c);
  }
  return out;
}
/** Disjoint-cycle notation; digits run together like (1234) when n < 10, otherwise space separated. */
export function cyclesString(p) {
  const cs = permCycles(p);
  if (!cs.length) return 'e';
  const sep = p.length < 10 ? '' : ' ';
  return cs.map(c => `(${c.join(sep)})`).join('');
}
export const permOrder = p => permCycles(p).reduce((acc, c) => lcm(acc, c.length), 1);
export const permSign = p => (permCycles(p).reduce((acc, c) => acc + c.length - 1, 0) % 2 ? -1 : 1);
export const cycleType = p => permCycles(p).map(c => c.length).sort((a, b) => b - a);
/** Parse "(123)(45)", "(1 2 3)(4 5)", "(12)(23)" (product, right to left), "e" or "" into a permutation of 1..n. */
export function parsePerm(str, n) {
  const s = String(str ?? '').replace(/\s+/g, ' ').trim();
  if (s === '' || /^(e|id|1|\(\))$/i.test(s)) return permId(n);
  const groups = s.match(/\(([^()]*)\)/g);
  if (!groups || groups.join('').replace(/\s/g, '') !== s.replace(/\s/g, '')) throw new Error('Döngü gösterimi bekleniyor, örn. (1 2 3)(4 5)');
  let res = permId(n);
  for (let g = 0; g < groups.length; g++) { // res·c: c acts before everything to its left, so the rightmost acts first
    const inner = groups[g].slice(1, -1).trim();
    const nums = /[\s,]/.test(inner) ? inner.split(/[\s,]+/).filter(Boolean).map(Number) : [...inner].map(Number);
    if (nums.some(x => !Number.isInteger(x) || x < 1 || x > n)) throw new Error(`Döngüdeki sayılar 1 ile ${n} arasında olmalı`);
    if (new Set(nums).size !== nums.length) throw new Error('Bir döngüde aynı sayı iki kez geçemez');
    const c = permId(n);
    nums.forEach((x, i) => { c[x - 1] = nums[(i + 1) % nums.length]; });
    res = permMul(res, c);
  }
  return res;
}

// ---------- dihedral group D_n in the course convention ----------
/** Element r^k s^m as {k, m}. */
export const dEl = (n, k, m = 0) => ({ k: mod(k, n), m: m & 1 });
/** (r^a s^m)(r^b s^p) = r^(a + (-1)^m b) s^(m+p), from s r^b = r^-b s. */
export const dMul = (n, x, y) => dEl(n, x.k + (x.m ? -y.k : y.k), x.m + y.m);
export const dInv = (n, x) => (x.m ? x : dEl(n, -x.k, 0));
export const dEq = (x, y) => x.k === y.k && x.m === y.m;
export function dOrder(n, x) { if (x.m) return 2; return n / gcd(n, x.k); }
export function dName(x, tex = false) {
  const r = x.k === 0 ? '' : x.k === 1 ? 'r' : tex ? `r^{${x.k}}` : `r^${x.k}`;
  const out = r + (x.m ? 's' : '');
  return out || 'e';
}
export const dAll = n => [...Array(n).keys()].flatMap(k => [dEl(n, k, 0)]).concat([...Array(n).keys()].map(k => dEl(n, k, 1)));
/** Position permutation of r^k s^m on vertices 1..n: r: i -> i+1, s: i -> 2-i (fixes vertex 1). */
export function dPerm(n, x) {
  const p = new Array(n);
  for (let i = 1; i <= n; i++) {
    let j = x.m ? mod(2 - i - 1, n) + 1 : i; // s first (right to left)
    j = mod(j - 1 + x.k, n) + 1;            // then r^k
    p[i - 1] = j;
  }
  return p;
}
/** Parse a word in r, s, e with integer exponents ("r^3s", "s r^2 s r", "r^-1 s", "sr3") into normal form. */
export function dParse(n, str) {
  const s = String(str ?? '').replace(/[·*\s]/g, '').replace(/⁻/g, '-').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c));
  if (!s) throw new Error('Boş cevap');
  const re = /(e|r|s)(?:\^?\{?(-?\d+)\}?)?/gy;
  let x = dEl(n, 0, 0), m, pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos; m = re.exec(s);
    if (!m) throw new Error('Yalnızca r, s, e ve üsler kullan (örn. r^3 s)');
    const e = m[2] === undefined ? 1 : Number(m[2]);
    const g = m[1] === 'e' ? dEl(n, 0, 0) : m[1] === 'r' ? dEl(n, e, 0) : dEl(n, 0, mod(e, 2));
    x = dMul(n, x, g);
    pos = re.lastIndex;
  }
  return x;
}

// ---------- answers ----------
// Answer specs carried by each problem part (the correct value is computed by the template):
//   { type: 'int', value }                    { type: 'number', value, tol }  (tol absolute, default 1e-6 relative-ish)
//   { type: 'yesno', value: true|false }      { type: 'choice', options: [..], value: index }
//   { type: 'perm', n, value: perm }          { type: 'dihedral', n, value: {k, m} }
//   { type: 'intset', value: [..] }           { type: 'dset', n, value: [{k,m}..] }   (order does not matter)
//   { type: 'permset', n, value: [perm..] }   { type: 'intlist', value: [..] }        (order matters)
//   { type: 'text', value, accept: [..] }     (case/space-insensitive match against value or accept)
export function parseIntList(str) {
  const parts = String(str ?? '').replace(/[{}\[\]]/g, ' ').split(/[\s,;]+/).filter(Boolean);
  const nums = parts.map(Number);
  if (nums.some(x => !Number.isFinite(x) || !Number.isInteger(x))) throw new Error('Virgülle ayrılmış tam sayılar bekleniyor');
  return nums;
}
export function parseNumber(str) {
  const t = String(str ?? '').trim().replace(',', '.').replace(/\s/g, '');
  if (!t) throw new Error('Bir sayı gir');
  if (/^-?\d+\/\d+$/.test(t)) { const [a, b] = t.split('/').map(Number); return a / b; }
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error('Sayı anlaşılamadı');
  return v;
}
const splitTop = str => String(str ?? '').replace(/[{}]/g, '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const norm = s => String(s ?? '').toLocaleLowerCase('tr').replace(/\s+/g, '');

/** Check a user's input against an answer spec. Returns { ok, msg }. Never throws. */
export function checkAnswer(spec, input) {
  try {
    switch (spec.type) {
      case 'int': { const v = parseNumber(input); return res(Number.isInteger(v) && v === spec.value); }
      case 'number': { const v = parseNumber(input); const tol = spec.tol ?? Math.max(1e-6, Math.abs(spec.value) * 1e-3); return res(Math.abs(v - spec.value) <= tol); }
      case 'yesno': { const v = /^(e|evet|yes|y|true|1|var|olur)$/i.test(String(input).trim()) ? true : /^(h|hayır|hayir|no|n|false|0|yok|olmaz)$/i.test(String(input).trim()) ? false : null; if (v === null) return { ok: false, msg: 'Evet ya da Hayır seç' }; return res(v === spec.value); }
      case 'choice': return res(Number(input) === spec.value);
      case 'perm': return res(permEq(parsePerm(input, spec.n), spec.value));
      case 'dihedral': return res(dEq(dParse(spec.n, input), spec.value));
      case 'intset': { const a = [...new Set(parseIntList(input))].sort((x, y) => x - y), b = [...new Set(spec.value)].sort((x, y) => x - y); return setRes(a.length === b.length && a.every((x, i) => x === b[i]), a.length, b.length); }
      case 'intlist': { const a = parseIntList(input); return res(a.length === spec.value.length && a.every((x, i) => x === spec.value[i])); }
      case 'dset': { const a = splitTop(input).map(t => dParse(spec.n, t)); const key = x => x.k + ':' + x.m; const A = new Set(a.map(key)), B = new Set(spec.value.map(key)); return setRes(A.size === B.size && [...B].every(k => A.has(k)), A.size, B.size); }
      case 'permset': { const a = String(input).split(/[,;]/).map(t => t.trim()).filter(Boolean).map(t => cyclesString(parsePerm(t, spec.n))); const A = new Set(a), B = new Set(spec.value.map(cyclesString)); return setRes(A.size === B.size && [...B].every(k => A.has(k)), A.size, B.size); }
      case 'text': return res([spec.value, ...(spec.accept || [])].some(v => norm(v) === norm(input)));
      default: return { ok: false, msg: 'Bilinmeyen cevap türü' };
    }
  } catch (err) { return { ok: false, msg: err.message, parseError: true }; }
}
const res = ok => ({ ok, msg: ok ? 'Doğru' : 'Yanlış' });
const setRes = (ok, got, want) => ({ ok, msg: ok ? 'Doğru' : got !== want ? `Yanlış: ${got} eleman yazdın, ${want} olmalı` : 'Yanlış: eleman sayısı doğru ama elemanlar farklı' });

/** The canonical display of an answer spec's correct value (for "show answer"). */
export function answerText(spec) {
  switch (spec.type) {
    case 'int': case 'number': return String(spec.value);
    case 'yesno': return spec.value ? 'Evet' : 'Hayır';
    case 'choice': return spec.options[spec.value];
    case 'perm': return cyclesString(spec.value);
    case 'dihedral': return dName(spec.value);
    case 'intset': return `{${[...spec.value].sort((a, b) => a - b).join(', ')}}`;
    case 'intlist': return spec.value.join(', ');
    case 'dset': return `{${spec.value.map(x => dName(x)).join(', ')}}`;
    case 'permset': return `{${spec.value.map(cyclesString).join(', ')}}`;
    case 'text': return spec.value;
    default: return '';
  }
}

// Problem template contract (every template module exports TEMPLATES = [template, ...]):
// template = { id, topic, title, source: 'PS1' | 'PS2' | 'ozgun', levels: ['isinma','odev','zorlayici'] (subset),
//              generate(rng, level) -> problem }
// problem  = { title, story, model?: { id, params }, parts: [part, ...] }
// part     = { label: 'a', prompt, kind: 'answer' | 'proof', answer?: spec, hints: [string x 1-3],
//              solution: [string, ...] (worked steps using THIS problem's numbers), checklist?: [string, ...] (proof parts) }
// Text fields are Turkish rich text: $...$ inline TeX, $$...$$ display TeX, **bold**.
export const LEVELS = [
  { id: 'isinma', title: 'Isınma' },
  { id: 'odev', title: 'Ödev' },
  { id: 'zorlayici', title: 'Zorlayıcı' },
];
