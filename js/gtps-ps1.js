// Part 1 (PS1): FZT 203E Theory of Groups in Physics — Problem Set 1 templates.
// Pure ES module (no DOM, no ui.js/fx.js). All answers computed algorithmically in course conventions.
import {
  gcd, lcm, mod, divisors,
  permId, permMul, permCycles, cyclesString, permOrder, cycleType,
  dEl, dMul, dInv, dEq, dOrder, dName, dAll, dPerm, dParse,
} from './gtps-kit.js';

// ---------- local pure helpers ----------

function eulerPhi(n) {
  let res = n, m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      res = (res / p) * (p - 1);
    }
  }
  if (m > 1) res = (res / m) * (m - 1);
  return res;
}

function distinctPrimes(n) {
  const out = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      out.push(p);
      while (m % p === 0) m /= p;
    }
  }
  if (m > 1) out.push(m);
  return out;
}

function unitsOf(n) {
  const out = [];
  for (let a = 1; a < n; a++) if (gcd(a, n) === 1) out.push(a);
  return out;
}

function modOrder(a, n) {
  let cur = mod(a, n), k = 1;
  while (cur !== 1) { cur = (cur * a) % n; k++; }
  return k;
}

function modInv(a, n) {
  a = mod(a, n);
  for (let x = 1; x < n; x++) if ((a * x) % n === 1) return x;
  throw new Error(`${a} mod ${n} tersinir değil`);
}

const dTex = x => dName(x, true);
const dSetTex = arr => `\\{${arr.map(x => dName(x, true)).join(',\\,')}\\}`;
const intSetTex = arr => `\\{${arr.join(',\\,')}\\}`;
const dKey = x => `${x.k}:${x.m}`;

function dUnique(arr) {
  const seen = new Set(), out = [];
  for (const x of arr) {
    const k = dKey(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out.sort((a, b) => a.m - b.m || a.k - b.k);
}

function dSetEq(A, B) {
  const sa = new Set(A.map(dKey)), sb = new Set(B.map(dKey));
  return sa.size === sb.size && [...sa].every(k => sb.has(k));
}

function dRotSub(n, d) {
  const step = n / d;
  return Array.from({ length: d }, (_, t) => dEl(n, t * step, 0));
}

function dDihSub(n, d, j) {
  const step = n / d;
  const rots = dRotSub(n, d);
  const refs = Array.from({ length: d }, (_, t) => dEl(n, j + t * step, 1));
  return rots.concat(refs);
}

function dCosetLeft(n, g, H) { return dUnique(H.map(h => dMul(n, g, h))); }
function dCosetRight(n, H, g) { return dUnique(H.map(h => dMul(n, h, g))); }

function dLeftCosetsAll(n, H) {
  const seen = new Set(), cosets = [];
  for (const g of dAll(n)) {
    const c = dCosetLeft(n, g, H);
    const key = c.map(dKey).join(',');
    if (!seen.has(key)) { seen.add(key); cosets.push({ rep: g, elems: c }); }
  }
  return cosets;
}

function dCosetsMatchingRight(n, H) {
  const lcs = dLeftCosetsAll(n, H);
  let count = 0;
  const matching = [];
  for (const { rep, elems } of lcs) {
    if (dSetEq(elems, dCosetRight(n, H, rep))) { count++; matching.push({ rep, elems }); }
  }
  return { count, total: lcs.length, matching };
}

function shuffleChoice(rng, correctText, distractors) {
  const options = rng.shuffle([correctText, ...distractors]);
  return { type: 'choice', options, value: options.indexOf(correctText) };
}

function fmtSignedCoeff(c, sym) {
  if (c === 1) return `+ ${sym}`;
  if (c === -1) return `- ${sym}`;
  return c > 0 ? `+ ${c}${sym}` : `- ${Math.abs(c)}${sym}`;
}

function fmtFrac(num, den) {
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(Math.abs(num), den);
  const p = num / g, q = den / g;
  if (q === 1) return String(p);
  return p < 0 ? `-\\frac{${Math.abs(p)}}{${q}}` : `\\frac{${p}}{${q}}`;
}

function roundNum(x, digits = 4) {
  const r = Number(x.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
}

// Format a word in D_n (array of {kind:'r', exp} | {kind:'s'}) and generate exact step-by-step reduction.
function evalDWord(n, tokens) {
  const ascii = tokens.map(t => t.kind === 's' ? 's' : (t.exp === 1 ? 'r' : `r^${t.exp}`)).join(' ');
  const tex = tokens.map(t => t.kind === 's' ? 's' : (t.exp === 1 ? 'r' : `r^{${t.exp}}`)).join('\\,');
  // Reduce from left to right keeping accumulated normal form r^k s^m
  let cur = dEl(n, 0, 0);
  const steps = [];
  let rem = tokens.slice();
  const fmtToks = arr => arr.map(t => t.kind === 's' ? 's' : (t.exp === 1 ? 'r' : `r^{${t.exp}}`)).join('\\,');

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = t.kind === 's' ? dEl(n, 0, 1) : dEl(n, t.exp, 0);
    const prev = cur;
    cur = dMul(n, cur, next);
    if (i > 0) {
      const rest = rem.slice(i + 1);
      const restTex = rest.length ? `\\,(${fmtToks(rest)})` : '';
      const ruleNote = prev.m === 1 && t.kind === 'r'
        ? ` ($s r^{${t.exp}} = r^{${mod(-t.exp, n)}} s$ kuralıyla)`
        : prev.m === 1 && t.kind === 's'
          ? ' ($s^2 = e$ ile)'
          : '';
      steps.push(`$${dTex(prev)} \\cdot ${t.kind === 's' ? 's' : (t.exp === 1 ? 'r' : `r^{${t.exp}}`)} = ${dTex(cur)}$${ruleNote}${restTex ? `; kalan ifade: $${dTex(cur)}${restTex}$` : ''}.`);
    }
  }
  // Cross-check with kit parser
  const parsed = dParse(n, ascii);
  if (!dEq(cur, parsed)) throw new Error('dWord iç tutarlılık hatası');
  return { ascii, tex, value: cur, steps };
}

function makeLabels(parts) {
  return parts.map((p, i) => ({ label: String.fromCharCode(97 + i), ...p }));
}

// =====================================================================
// 1. ps1-grup-aksiyomlari — Group or not, failing axiom, Abelian check
// =====================================================================

const AXIOM_OPTS = [
  'Kapalılık',
  'Birleşme',
  'Birim eleman',
  'Ters eleman',
  'Hiçbiri (tüm aksiyomlar sağlanır — bir gruptur)',
];

function buildAxiomCandidate(rng, kind) {
  switch (kind) {
    case 'z-sub': {
      const a = rng.int(2, 9), b = rng.int(1, 8), c = rng.int(2, 7);
      const lhs = (a - b) - c, rhs = a - (b - c);
      return {
        isGroup: false, isAbelian: false, failIdx: 1,
        desc: `Tam sayılar kümesi $\\mathbb{Z}$ üzerinde $a * b = a - b$ işlemi`,
        shortName: `$(\\mathbb{Z}, -)$`,
        checkPart: {
          prompt: `Bu işlemde $(${a} * ${b}) * ${c}$ ve $${a} * (${b} * ${c})$ değerlerini sırasıyla hesaplayın (virgülle ayırın).`,
          kind: 'answer',
          answer: { type: 'intlist', value: [lhs, rhs] },
          hints: [
            'Önce parantez içindeki çıkarma işlemini yapın.',
            `Soldan: $(${a} - ${b}) - ${c}$; sağdan: $${a} - (${b} - ${c})$.`,
            `$(${a}-${b}) = ${a - b}$ ve $(${b}-${c}) = ${b - c}$ adımlarından devam edin.`,
          ],
          solution: [
            `$(${a} * ${b}) * ${c} = (${a} - ${b}) - ${c} = ${a - b} - ${c} = ${lhs}$.`,
            `$${a} * (${b} * ${c}) = ${a} - (${b} - ${c}) = ${a} - (${b - c}) = ${rhs}$.`,
            `$${lhs} \\neq ${rhs}$ olduğundan birleşme aksiyomu bozulur (fark $-2c = ${-2 * c}$).`,
          ],
        },
        reason: `Kapalılık sağlanır ($a-b \\in \\mathbb{Z}$), fakat $c \\neq 0$ için $(a-b)-c \\neq a-(b-c)$ olduğundan ilk olarak **birleşme** aksiyomu bozulur.`,
      };
    }
    case 'odd-add': {
      const a = 2 * rng.int(1, 6) + 1, b = 2 * rng.int(1, 6) + 1;
      return {
        isGroup: false, isAbelian: false, failIdx: 0,
        desc: `Tek tam sayılar kümesi $2\\mathbb{Z}+1$ üzerinde olağan toplama ($+$) işlemi`,
        shortName: `$(2\\mathbb{Z}+1, +)$`,
        checkPart: {
          prompt: `İki tek tam sayı olarak $a = ${a}$ ve $b = ${b}$ alınırsa $a + b$ toplamı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: a + b },
          hints: [
            'İki tek sayının toplamının tek mi çift mi olduğuna bakın.',
            `$${a} + ${b}$ toplamını hesaplayın.`,
            `Sonuç çift bir tam sayı olduğu için $2\\mathbb{Z}+1$ kümesine düşmez.`,
          ],
          solution: [
            `$${a} + ${b} = ${a + b}$ çift bir sayıdır ve $2\\mathbb{Z}+1$ kümesinde yer almaz.`,
            `Dolayısıyla **kapalılık** aksiyomu ilk adımda bozulur.`,
          ],
        },
        reason: `İki tek sayının toplamı $(2m+1)+(2k+1)=2(m+k+1)$ her zaman çift olduğundan küme toplama altında **kapalı değildir**.`,
      };
    }
    case 'z-nz-mul': {
      const a = rng.int(2, 9);
      return {
        isGroup: false, isAbelian: false, failIdx: 3,
        desc: `Sıfırdan farklı tam sayılar kümesi $\\mathbb{Z} \\setminus \\{0\\}$ üzerinde olağan çarpma ($\\times$) işlemi`,
        shortName: `$(\\mathbb{Z}\\setminus\\{0\\}, \\times)$`,
        checkPart: {
          prompt: `Bu kümede $a = ${a}$ elemanının çarpımsal tersi kümenin bir elemanı mıdır?`,
          kind: 'answer',
          answer: { type: 'yesno', value: false },
          hints: [
            'Birim eleman $e = 1$ olduğundan $a \\cdot b = 1$ denklemini çözmelisiniz.',
            `$${a} \\cdot b = 1$ denkleminin çözümü $b = 1/${a}$ olur.`,
            `$1/${a}$ bir tam sayı mıdır?`,
          ],
          solution: [
            'Kapalılık, birleşme ve birim eleman ($e = 1$) sağlanır.',
            `Ancak $${a} \\cdot b = 1 \\implies b = \\frac{1}{${a}} \\notin \\mathbb{Z} \\setminus \\{0\\}$ olduğundan **ters eleman** aksiyomu bozulur.`,
          ],
        },
        reason: `Kapalılık, birleşme ve birim ($e=1$) sağlanır; ancak $\\pm 1$ dışındaki tam sayıların çarpımsal tersleri tam sayı olmadığından **ters eleman** aksiyomu bozulur.`,
      };
    }
    case 'zn-mul': {
      const n = rng.pick([5, 6, 7, 8, 9, 10, 12]);
      const phi = eulerPhi(n);
      return {
        isGroup: false, isAbelian: false, failIdx: 3,
        desc: `$\\mathbb{Z}_{${n}} = \\{0, 1, \\dots, ${n - 1}\\}$ kümesi üzerinde mod $${n}$ çarpma ($\\times$) işlemi`,
        shortName: `$(\\mathbb{Z}_{${n}}, \\times)$`,
        checkPart: {
          prompt: `$\\mathbb{Z}_{${n}}$ içindeki elemanlardan kaç tanesinin mod $${n}$ çarpımsal tersi vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: phi },
          hints: [
            'Bir $a \\in \\mathbb{Z}_n$ elemanının mod $n$ çarpımsal tersi ancak ve ancak $\\gcd(a, n) = 1$ ise vardır.',
            `$1 \\le a < ${n}$ aralığında $${n}$ ile aralarında asal olan sayıları sayın ($\\varphi(${n})$).`,
            `Birimler: $${intSetTex(unitsOf(n))}$.`,
          ],
          solution: [
            `Mod $${n}$ çarpımsal tersi olan elemanlar $\\gcd(a, ${n}) = 1$ koşulunu sağlayan $${intSetTex(unitsOf(n))}$ kümesidir.`,
            `Toplam $\\varphi(${n}) = ${phi}$ eleman tersinirdir; en başta $0$'ın tersi olmadığı için $(\\mathbb{Z}_{${n}}, \\times)$ grup değildir.`,
          ],
        },
        reason: `Kapalılık, birleşme ve birim eleman ($1$) sağlanır; ancak $0 \\cdot b \\equiv 0 \\not\\equiv 1 \\pmod{${n}}$ olduğundan $0$'ın (ve $\\gcd(a,${n})>1$ olan elemanların) tersi yoktur — **ters eleman** aksiyomu bozulur.`,
      };
    }
    case 'zn-nz-comp': {
      const pairs = [[6, 2, 3], [8, 2, 4], [9, 3, 3], [10, 2, 5], [12, 3, 4], [12, 2, 6]];
      const [n, d1, d2] = rng.pick(pairs);
      return {
        isGroup: false, isAbelian: false, failIdx: 0,
        desc: `Sıfırsız kalıntı sınıfları $\\mathbb{Z}_{${n}} \\setminus \\{0\\}$ üzerinde mod $${n}$ çarpma ($\\times$) işlemi`,
        shortName: `$(\\mathbb{Z}_{${n}}\\setminus\\{0\\}, \\times)$`,
        checkPart: {
          prompt: `Bu kümeden $a = ${d1}$ ve $b = ${d2}$ alınırsa $a \\cdot b \\bmod ${n}$ değeri kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: 0 },
          hints: [
            `Çarpımı alıp $${n}$ ile bölümünden kalana bakın.`,
            `$${d1} \\cdot ${d2} = ${d1 * d2}$ ve $${d1 * d2} \\equiv 0 \\pmod{${n}}$.`,
            'Sonuç $0$ olduğundan kümeden dışarı düşer.',
          ],
          solution: [
            `$${d1} \\cdot ${d2} = ${d1 * d2} \\equiv 0 \\pmod{${n}}$, fakat $0 \\notin \\mathbb{Z}_{${n}} \\setminus \\{0\\}$.`,
            `Sıfır bölenleri bulunduğu için **kapalılık** aksiyomu bozulur.`,
          ],
        },
        reason: `$${n}$ bileşik sayı olduğundan $${d1} \\cdot ${d2} \\equiv 0 \\pmod{${n}}$ çarpımı küme dışına çıkar; **kapalılık** aksiyomu bozulur.`,
      };
    }
    case 'zpos-add': {
      const a = rng.int(2, 12);
      return {
        isGroup: false, isAbelian: false, failIdx: 2,
        desc: `Pozitif tam sayılar kümesi $\\mathbb{Z}_{>0} = \\{1, 2, 3, \\dots\\}$ üzerinde toplama ($+$) işlemi`,
        shortName: `$(\\mathbb{Z}_{>0}, +)$`,
        checkPart: {
          prompt: `$\\mathbb{Z}_{>0}$ içinde $${a} + e = ${a}$ eşitliğini sağlayan bir $e$ elemanı var mıdır?`,
          kind: 'answer',
          answer: { type: 'yesno', value: false },
          hints: [
            `Denklem $e = 0$ çözümünü verir.`,
            `$0$ sayısı $\\mathbb{Z}_{>0}$ kümesinin elemanı mıdır?`,
            `Pozitif tam sayılar $1$'den başlar, $0 \\notin \\mathbb{Z}_{>0}$.`,
          ],
          solution: [
            'Toplama $\\mathbb{Z}_{>0}$ üzerinde kapalı ve birleşmelidir.',
            `Ancak $${a} + e = ${a} \\implies e = 0 \\notin \\mathbb{Z}_{>0}$ olduğundan **birim eleman** aksiyomu bozulur.`,
          ],
        },
        reason: `Kapalılık ve birleşme sağlanır, fakat toplamsal birim $0 \\notin \\mathbb{Z}_{>0}$ olduğundan **birim eleman** aksiyomu bozulur.`,
      };
    }
    case 'mat-det-neg1': {
      return {
        isGroup: false, isAbelian: false, failIdx: 0,
        desc: `Determinantı $-1$ olan $2 \\times 2$ gerçel matrisler kümesi $\\{A \\in M_2(\\mathbb{R}) : \\det A = -1\\}$ ve matris çarpımı`,
        shortName: `$\\{\\det A = -1\\}$`,
        checkPart: {
          prompt: `Bu kümeden iki matris $A, B$ seçildiğinde çarpımlarının determinantı $\\det(AB)$ kaç olur?`,
          kind: 'answer',
          answer: { type: 'int', value: 1 },
          hints: [
            'Determinantın çarpımsal özelliğini kullanın: $\\det(AB) = \\det(A)\\det(B)$.',
            `$\\det(A) = -1$ ve $\\det(B) = -1$ değerlerini çarpın.`,
            `$(-1)(-1) = +1 \\neq -1$.`,
          ],
          solution: [
            `$\\det(AB) = \\det(A)\\det(B) = (-1)(-1) = 1 \\neq -1$.`,
            `Çarpım matrisi kümenin dışında kaldığı için **kapalılık** aksiyomu bozulur (ayrıca birim matris $I_2$ de $\\det I_2 = 1$ olduğundan kümede değildir).`,
          ],
        },
        reason: `$\\det(AB) = (-1)(-1) = +1 \\neq -1$ olduğundan küme matris çarpımı altında **kapalı değildir**.`,
      };
    }
    case 'mat-upper-all': {
      const a = rng.int(1, 6), b = rng.int(1, 6);
      return {
        isGroup: false, isAbelian: false, failIdx: 3,
        desc: `Tüm $2 \\times 2$ gerçel üst üçgensel matrisler $\\left\\{\\begin{pmatrix} a & b \\\\ 0 & d \\end{pmatrix} : a, b, d \\in \\mathbb{R}\\right\\}$ ve matris çarpımı`,
        shortName: `Üst üçgensel matrisler`,
        checkPart: {
          prompt: `Bu kümedeki $M = \\begin{pmatrix} ${a} & ${b} \\\\ 0 & 0 \\end{pmatrix}$ matrisinin determinantı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: 0 },
          hints: [
            'Üst üçgensel bir matrisin determinantı köşegen elemanlarının çarpımıdır.',
            `$\\det(M) = ${a} \\cdot 0 - ${b} \\cdot 0$.`,
            'Determinantı sıfır olan bir matrisin tersi yoktur.',
          ],
          solution: [
            `Kapalılık, birleşme ve birim matris $I_2$ sağlanır.`,
            `Fakat $\\det(M) = ${a} \\cdot 0 = 0$ olduğundan $M$'nin çarpımsal tersi yoktur; **ters eleman** aksiyomu bozulur.`,
          ],
        },
        reason: `İki üst üçgensel matrisin çarpımı yine üst üçgenseldir ve $I_2$ kümededir; fakat köşegende $0$ içeren matrislerin determinantı $0$ olduğundan **ters eleman** aksiyomu bozulur.`,
      };
    }
    case 'roots-unity': {
      const m = rng.pick([4, 5, 6, 7, 8, 9, 10, 12]);
      const k = rng.int(1, m - 1);
      return {
        isGroup: true, isAbelian: true, failIdx: 4,
        desc: `Birliğin $${m}$. dereceden karmaşık kökleri $\\mu_{${m}} = \\{e^{2\\pi i j/${m}} : j = 0, 1, \\dots, ${m - 1}\\}$ ve karmaşık sayı çarpımı`,
        shortName: `$(\\mu_{${m}}, \\cdot)$`,
        checkPart: {
          prompt: `$z = e^{2\\pi i \\cdot ${k}/${m}} \\in \\mu_{${m}}$ elemanının tersi $z^{-1} = e^{2\\pi i \\cdot j/${m}}$ biçiminde yazıldığında $j \\in \\{0, \\dots, ${m - 1}\\}$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: m - k },
          hints: [
            `$e^{2\\pi i k/${m}} \\cdot e^{2\\pi i j/${m}} = e^{2\\pi i (k+j)/${m}} = 1$ olmalıdır.`,
            `$k + j \\equiv 0 \\pmod{${m}}$ denklemini çözün.`,
            `$j = ${m} - ${k}$.`,
          ],
          solution: [
            `$z \\cdot e^{2\\pi i j/${m}} = e^{2\\pi i (${k}+j)/${m}} = 1 \\iff ${k} + j \\equiv 0 \\pmod{${m}}$.`,
            `Dolayısıyla $j = ${m} - ${k} = ${m - k}$ bulunur.`,
          ],
        },
        reason: `Karmaşık çarpım altında kapalı, birleşmeli, birim $1 = e^0$ ve $(e^{2\\pi i j/${m}})^{-1} = e^{2\\pi i (${m}-j)/${m}} \\in \\mu_{${m}}$ olduğundan **değişmeli (Abelyen) bir gruptur**.`,
      };
    }
    case 'sl2': {
      return {
        isGroup: true, isAbelian: false, failIdx: 4,
        desc: `Determinantı $1$ olan $2 \\times 2$ gerçel matrisler $\\mathrm{SL}(2, \\mathbb{R}) = \\{A \\in M_2(\\mathbb{R}) : \\det A = 1\\}$ ve matris çarpımı`,
        shortName: `$\\mathrm{SL}(2,\\mathbb{R})$`,
        checkPart: {
          prompt: `$\\mathrm{SL}(2, \\mathbb{R})$ grubu değişmeli (Abelyen) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: false },
          hints: [
            'Determinantı $1$ olan iki basit kayma (shear) matrisini iki farklı sırayla çarpın.',
            `$A = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}$ ve $B = \\begin{pmatrix} 1 & 0 \\\\ 1 & 1 \\end{pmatrix}$ matrislerini deneyin.`,
            `$AB = \\begin{pmatrix} 2 & 1 \\\\ 1 & 1 \\end{pmatrix}$ ile $BA = \\begin{pmatrix} 1 & 1 \\\\ 1 & 2 \\end{pmatrix}$ eşit değildir.`,
          ],
          solution: [
            `$A = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}, B = \\begin{pmatrix} 1 & 0 \\\\ 1 & 1 \\end{pmatrix} \\in \\mathrm{SL}(2,\\mathbb{R})$ için $AB = \\begin{pmatrix} 2 & 1 \\\\ 1 & 1 \\end{pmatrix} \\neq \\begin{pmatrix} 1 & 1 \\\\ 1 & 2 \\end{pmatrix} = BA$.`,
            `Dolayısıyla $\\mathrm{SL}(2, \\mathbb{R})$ **değişmeli olmayan (non-Abelyen)** bir gruptur.`,
          ],
        },
        reason: `$\\det(AB) = 1 \\cdot 1 = 1$, $\\det I_2 = 1$, $\\det(A^{-1}) = 1$ sağlandığından tüm grup aksiyomları geçerlidir; ancak matris çarpımı değişmeli değildir.`,
      };
    }
    case 'det-pm1': {
      return {
        isGroup: true, isAbelian: false, failIdx: 4,
        desc: `Determinantı $\\pm 1$ olan $2 \\times 2$ gerçel matrisler $\\{A \\in M_2(\\mathbb{R}) : \\det A = \\pm 1\\}$ ve matris çarpımı`,
        shortName: `$\\{\\det A = \\pm 1\\}$`,
        checkPart: {
          prompt: `Bu yapı değişmeli (Abelyen) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: false },
          hints: [
            'Bu küme $\\mathrm{SL}(2, \\mathbb{R})$ grubunu içerir.',
            `$A = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}$ ($\\det = -1$) ve $B = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}$ ($\\det = 1$) çarpımlarını karşılaştırın.`,
            `$AB = \\begin{pmatrix} 1 & 1 \\\\ 0 & -1 \\end{pmatrix} \\neq \\begin{pmatrix} 1 & -1 \\\\ 0 & -1 \\end{pmatrix} = BA$.`,
          ],
          solution: [
            `$\\det(AB) = (\\pm 1)(\\pm 1) = \\pm 1$, $\\det I_2 = 1$, $\\det(A^{-1}) = 1/(\\pm 1) = \\pm 1$ olduğundan bir gruptur.`,
            `$A = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}, B = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}$ için $AB \\neq BA$ olduğundan değişmeli değildir.`,
          ],
        },
        reason: `$\\{+1, -1\\}$ çarpma altında kapalı olduğundan $\\det(AB) \\in \\{\\pm 1\\}$, $\\det I_2 = 1$ ve $\\det(A^{-1}) = \\pm 1$ sağlanır: **değişmeli olmayan bir gruptur**.`,
      };
    }
    case 'mat-upper-inv': {
      return {
        isGroup: true, isAbelian: false, failIdx: 4,
        desc: `Tersinir $2 \\times 2$ gerçel üst üçgensel matrisler $B_2 = \\left\\{\\begin{pmatrix} a & b \\\\ 0 & d \\end{pmatrix} : a, d \\neq 0,\\; b \\in \\mathbb{R}\\right\\}$ ve matris çarpımı`,
        shortName: `$B_2$`,
        checkPart: {
          prompt: `$B_2$ grubu değişmeli (Abelyen) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: false },
          hints: [
            'Bir köşegen matris ile bir üst üçgensel kayma matrisini iki sırayla çarpın.',
            `$A = \\begin{pmatrix} 2 & 0 \\\\ 0 & 1 \\end{pmatrix}$ ve $B = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}$ seçin.`,
            `$AB$ matrisinin $(1,2)$ girdisi $2$, $BA$ matrisinin $(1,2)$ girdisi $1$ olur.`,
          ],
          solution: [
            `$\\begin{pmatrix} a_1 & b_1 \\\\ 0 & d_1 \\end{pmatrix}\\begin{pmatrix} a_2 & b_2 \\\\ 0 & d_2 \\end{pmatrix} = \\begin{pmatrix} a_1 a_2 & a_1 b_2 + b_1 d_2 \\\\ 0 & d_1 d_2 \\end{pmatrix}$ ($a_1 a_2 \\neq 0, d_1 d_2 \\neq 0$) ve tersi $\\begin{pmatrix} 1/a & -b/(ad) \\\\ 0 & 1/d \\end{pmatrix} \\in B_2$.`,
            `$A = \\begin{pmatrix} 2 & 0 \\\\ 0 & 1 \\end{pmatrix}, B = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}$ için $AB = \\begin{pmatrix} 2 & 2 \\\\ 0 & 1 \\end{pmatrix} \\neq \\begin{pmatrix} 2 & 1 \\\\ 0 & 1 \\end{pmatrix} = BA$, yani değişmeli değildir.`,
          ],
        },
        reason: `Köşegen çarpımları sıfırdan farklı kalır, $I_2 \\in B_2$ ve $\\begin{pmatrix} a & b \\\\ 0 & d \\end{pmatrix}^{-1} = \\begin{pmatrix} 1/a & -b/(ad) \\\\ 0 & 1/d \\end{pmatrix} \\in B_2$ olduğundan **değişmeli olmayan bir gruptur**.`,
      };
    }
    case 'zp-nz-mul':
    default: {
      const p = rng.pick([5, 7, 11]);
      const a = rng.int(2, p - 1);
      const inv = modInv(a, p);
      return {
        isGroup: true, isAbelian: true, failIdx: 4,
        desc: `Asal $p = ${p}$ için sıfırsız kalıntı sınıfları $\\mathbb{Z}_{${p}} \\setminus \\{0\\}$ ve mod $${p}$ çarpma ($\\times$) işlemi`,
        shortName: `$(\\mathbb{Z}_{${p}}\\setminus\\{0\\}, \\times)$`,
        checkPart: {
          prompt: `Bu kümede $a = ${a}$ elemanının mod $${p}$ çarpımsal tersi kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: inv },
          hints: [
            `$${a} \\cdot x \\equiv 1 \\pmod{${p}}$ denklemini sağlayan $x \\in \\{1, \\dots, ${p - 1}\\}$ sayısını arıyoruz.`,
            `$${a}$'nın küçük katlarını mod $${p}$ olarak deneyin.`,
            `$${a} \\cdot ${inv} = ${a * inv} \\equiv 1 \\pmod{${p}}$.`,
          ],
          solution: [
            `$${p}$ asal olduğu için sıfırdan farklı her elemanın $${p}$ ile EBOB'u $1$'dir; bu yüzden tüm elemanlar tersinirdir.`,
            `$${a} \\cdot ${inv} = ${a * inv} = ${Math.floor((a * inv) / p)} \\cdot ${p} + 1 \\equiv 1 \\pmod{${p}}$, yani $${a}^{-1} = ${inv}$.`,
          ],
        },
        reason: `$${p}$ asal olduğundan sıfır böleni yoktur (kapalıdır), birleşmeli, birim $1$ ve her $a \\not\\equiv 0$ için Bézout özdeşliği gereği ters vardır: **değişmeli bir gruptur**.`,
      };
    }
  }
}

const T_GRUP_AKSIYOMLARI = {
  id: 'ps1-grup-aksiyomlari',
  topic: 'Grup Aksiyomları',
  title: 'Grup Aksiyomları Sınavı: Küme ve İşlem Analizi',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nonGroupKinds = ['z-sub', 'odd-add', 'z-nz-mul', 'zn-mul', 'zn-nz-comp', 'zpos-add', 'mat-det-neg1', 'mat-upper-all'];
    const groupKinds = ['roots-unity', 'sl2', 'det-pm1', 'mat-upper-inv', 'zp-nz-mul'];

    if (level === 'isinma') {
      const wantGroup = rng.int(0, 1) === 1;
      const cand = buildAxiomCandidate(rng, rng.pick(wantGroup ? groupKinds : nonGroupKinds));
      const parts = makeLabels([
        {
          prompt: `Aşağıdaki cebirsel yapı bir grup oluşturur mu? (${cand.desc})`,
          kind: 'answer',
          answer: { type: 'yesno', value: cand.isGroup },
          hints: [
            'Dört temel grup aksiyomunu sırayla kontrol edin: Kapalılık, Birleşme, Birim eleman, Ters eleman.',
            'Herhangi bir aksiyomu bozan tek bir karşı örnek bile yapının grup olmasını engeller.',
            cand.isGroup ? 'Dört aksiyomun hepsi bu küme ve işlemde sağlanır.' : `Özellikle **${AXIOM_OPTS[cand.failIdx]}** aksiyomuna dikkat edin.`,
          ],
          solution: [cand.reason, `Sonuç: **${cand.isGroup ? 'Evet, bir gruptur' : 'Hayır, grup değildir'}**.`],
        },
        {
          prompt: 'Aksiyomları standart sırayla (**Kapalılık $\\to$ Birleşme $\\to$ Birim eleman $\\to$ Ters eleman**) sınadığınızda bozulan **ilk** aksiyom hangisidir?',
          kind: 'answer',
          answer: { type: 'choice', options: AXIOM_OPTS, value: cand.failIdx },
          hints: [
            'Önce iki elemanın işlem sonucunun mutlaka aynı kümede kalıp kalmadığına (kapalılık) bakın.',
            'Ardından $(a*b)*c = a*(b*c)$, birim eleman $e$ ve her elemanın tersi $a^{-1}$ koşullarını sırayla inceleyin.',
            cand.isGroup ? 'Dört aksiyom da geçerliyse son seçeneği işaretleyin.' : `İlk başarısız olan adım: ${AXIOM_OPTS[cand.failIdx]}.`,
          ],
          solution: [cand.reason, `Doğru seçenek: **${AXIOM_OPTS[cand.failIdx]}**.`],
        },
        cand.checkPart,
      ]);
      return {
        title: 'Bir Küme ve İşlem Ne Zaman Grup Olur?',
        story: `Fiziksel bir dönüşüm kümesini modellemeden önce önerilen cebirsel yapının dört grup aksiyomunu (kapalılık, birleşme, birim eleman, ters eleman) sağlayıp sağlamadığını sınamamız gerekir. İncelenen aday yapı: ${cand.desc}.`,
        parts,
      };
    }

    // odev & zorlayici: pick one non-group and one group in random order
    const ng = buildAxiomCandidate(rng, rng.pick(level === 'zorlayici'
      ? ['z-sub', 'zn-mul', 'zn-nz-comp', 'mat-det-neg1', 'mat-upper-all']
      : nonGroupKinds));
    const gr = buildAxiomCandidate(rng, rng.pick(level === 'zorlayici'
      ? ['sl2', 'det-pm1', 'mat-upper-inv', 'roots-unity', 'zp-nz-mul']
      : groupKinds));
    const swap = rng.int(0, 1) === 1;
    const [c1, c2] = swap ? [gr, ng] : [ng, gr];

    const rawParts = [
      {
        prompt: `**I. Yapı** (${c1.shortName}) bir grup mudur?`,
        kind: 'answer',
        answer: { type: 'yesno', value: c1.isGroup },
        hints: level === 'zorlayici'
          ? ['Dört grup aksiyomunu (kapalılık, birleşme, birim, ters) sistematik olarak kontrol edin.']
          : ['Kapalılık, birleşme, birim eleman ve ters eleman koşullarını sırayla yoklayın.', 'Bir istisna bile yapının grup olmasını engeller.'],
        solution: [c1.reason, `Sonuç: **${c1.isGroup ? 'Evet' : 'Hayır'}**.`],
      },
      {
        prompt: `**I. Yapı** için standart aksiyom sırasında (Kapalılık $\\to$ Birleşme $\\to$ Birim $\\to$ Ters) bozulan ilk aksiyom hangisidir?`,
        kind: 'answer',
        answer: { type: 'choice', options: AXIOM_OPTS, value: c1.failIdx },
        hints: level === 'zorlayici'
          ? ['Aksiyomları sırayla test edin; tümü sağlanıyorsa son şıkkı seçin.']
          : ['Önce kapalılığı, sonra birleşme, birim ve ters aksiyomlarını kontrol edin.', 'Eğer yapı bir grupsa hiçbiri bozulmaz.'],
        solution: [c1.reason],
      },
      {
        prompt: `**II. Yapı** (${c2.shortName}) için standart aksiyom sırasında bozulan ilk aksiyom hangisidir?`,
        kind: 'answer',
        answer: { type: 'choice', options: AXIOM_OPTS, value: c2.failIdx },
        hints: level === 'zorlayici'
          ? ['İkinci adayda özellikle tersinirlik ve kapalılık koşullarını kontrol edin.']
          : ['İkinci yapıda her elemanın işlem altında kümede kalıp kalmadığını ve tersinin varlığını test edin.'],
        solution: [c2.reason],
      },
      {
        prompt: `Bu iki aday arasından **grup olan** yapı (${gr.shortName}) değişmeli (Abelyen) midir?`,
        kind: 'answer',
        answer: { type: 'yesno', value: gr.isAbelian },
        hints: level === 'zorlayici'
          ? ['Genel $a, b$ elemanları için $ab = ba$ özdeşliğini sınayın; değilse iki somut matrisle karşı örnek kurun.']
          : ['Değişmelilik her $a, b$ için $ab = ba$ demektir.', 'Matris çarpımında genellikle $AB \\neq BA$ olur; sayı çarpımı ise değişmelidir.'],
        solution: [
          `Grup olan yapı: ${gr.desc}.`,
          gr.isAbelian
            ? 'Sayısal çarpma değişmeli olduğundan her $a, b$ için $ab = ba$ sağlanır: **Evet, Abelyendir**.'
            : 'Matris çarpımı değişmeli değildir; örneğin iki basit $2 \\times 2$ matris için $AB \\neq BA$ çıkar: **Hayır, Abelyen değildir**.',
        ],
      },
    ];

    if (level === 'odev') {
      rawParts.push(ng.checkPart);
    } else {
      rawParts.push({
        prompt: `**Kanıt:** ${gr.shortName} yapısının tüm grup aksiyomlarını sağladığını ve ${ng.shortName} yapısında **${AXIOM_OPTS[ng.failIdx]}** aksiyomunun bozulduğunu somut bir karşı örnekle gösterin.`,
        kind: 'proof',
        hints: [
          `${gr.shortName} için kapalılık, birim eleman ve genel bir elemanın tersinin kümede kaldığını açıkça yazın.`,
          `${ng.shortName} için bozulan aksiyomu tek bir sayısal/matris örneğiyle çürütün.`,
        ],
        solution: [
          `**${gr.shortName}:** ${gr.reason}`,
          `**${ng.shortName}:** ${ng.reason}`,
        ],
        checklist: [
          `${gr.shortName} için kapalılık, birleşme, birim eleman ve ters elemanın varlığı açıkça doğrulandı.`,
          `${ng.shortName} için bozulan ilk aksiyom (**${AXIOM_OPTS[ng.failIdx]}**) doğru adlandırıldı.`,
          'Bozulan aksiyom için somut bir karşı örnek (eleman veya çift/üçlü) hesaplanarak gösterildi.',
        ],
      });
    }

    return {
      title: 'Aday Yapıları Ayırt Etme: Grup mu, Değil mi?',
      story: `Bir teorik fizik modelinde iki farklı dönüşüm adayı karşılaştırılıyor:\n\n**I. Yapı:** ${c1.desc}.\n\n**II. Yapı:** ${c2.desc}.`,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 2. ps1-deforme-islem — R \ {-1/c} with a * b = a + b + c a b
// =====================================================================

const T_DEFORME_ISLEM = {
  id: 'ps1-deforme-islem',
  topic: 'Grup Aksiyomları',
  title: 'Deforme Toplama İşlemi $a * b = a + b + cab$',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const cPool = level === 'isinma' ? [1, 2, -1, -2] : [-5, -4, -2, -1, 1, 2, 4, 5];
    const c = rng.pick(cPool);
    const x0 = -1 / c;
    const cTerm = fmtSignedCoeff(c, 'ab');
    const opTex = `a * b = a + b ${cTerm}`;

    // Pick clean nonzero integers u, v not equal to x0
    const intPool = [-4, -3, -2, -1, 1, 2, 3, 4, 5].filter(x => 1 + c * x !== 0);
    const u = rng.pick(intPool);
    const v = rng.pick(intPool.filter(x => x !== u));
    const uv = u + v + c * u * v;

    // Pick integer a whose inverse -a / (1 + ca) is a clean terminating decimal
    const cleanDenoms = new Set([1, 2, 4, 5, 8, 10, 16, 20, 25]);
    const aCandidates = [];
    for (let a = -6; a <= 6; a++) {
      if (a === 0) continue;
      const d = Math.abs(1 + c * a);
      if (d > 0 && cleanDenoms.has(d)) aCandidates.push(a);
    }
    const aVal = rng.pick(aCandidates);
    const aInv = roundNum(-aVal / (1 + c * aVal), 4);
    const denomA = 1 + c * aVal;

    const uStr = u < 0 ? `(${u})` : `${u}`;
    const vStr = v < 0 ? `(${v})` : `${v}`;
    const x0Frac = fmtFrac(-1, c);
    const aInvFrac = fmtFrac(-aVal, denomA);
    const phiTex = `\\varphi(x) = 1 ${fmtSignedCoeff(c, 'x')}`;

    const rawParts = [
      {
        prompt: `Verilen işlem altında $${uStr} * ${vStr}$ değerini hesaplayın.`,
        kind: 'answer',
        answer: { type: 'int', value: uv },
        hints: level === 'zorlayici'
          ? [`Tanımdaki $${opTex}$ formülünde $a=${u}$ ve $b=${v}$ yerine koyun.`]
          : [
            `Tanımı doğrudan uygulayın: $${opTex}$.`,
            `$a = ${u}$, $b = ${v}$ ve $ab = ${u * v}$ değerlerini yerine yazın.`,
            `$${u} + (${v}) + (${c})(${u * v}) = ${u + v} + (${c * u * v})$.`,
          ],
        solution: [
          `$${uStr} * ${vStr} = ${u} + (${v}) + (${c})(${u})(${v}) = ${u + v} + (${c * u * v}) = ${uv}$.`,
        ],
      },
      {
        prompt: `Bu işlemin gerçel sayılarda bir grup tanımlayabilmesi için $\\mathbb{R}$ kümesinden çıkarılması gereken tek $x_0$ noktası nedir? (Kesir veya ondalık olarak yazabilirsiniz.)`,
        kind: 'answer',
        answer: { type: 'number', value: roundNum(x0, 4), tol: 1e-3 },
        hints: level === 'zorlayici'
          ? ['Önce birim eleman $e$' + "'yi bulun, sonra $a * b = e$ denkleminin hangi $a$ değeri için çözümsüz kaldığına bakın."]
          : [
            'Önce $a * e = a$ denkleminden birim elemanı bulun ($e = 0$).',
            'Ters eleman için $a + b + cab = 0 \\implies b(1 + ca) = -a$ yazın.',
            `Bölmenin tanımsız olduğu $1 ${fmtSignedCoeff(c, 'a')} = 0$ kökünü bulun.`,
          ],
        solution: [
          `Birim eleman $a + e + cae = a \\implies e(1 + ca) = 0$ olduğundan $e = 0$'dır.`,
          `Ters denklem $a + b + cab = 0 \\implies b(1 + ca) = -a$, dolayısıyla $1 ${fmtSignedCoeff(c, 'a')} = 0$ olduğunda ters yoktur.`,
          `Çıkarılması gereken nokta $x_0 = ${x0Frac} = ${roundNum(x0, 4)}$ olur.`,
        ],
      },
      {
        prompt: `$S = \\mathbb{R} \\setminus \\{${x0Frac}\\}$ grubunda $a = ${aVal}$ elemanının tersi $a^{-1}$ nedir? (Kesir veya ondalık olarak yazın.)`,
        kind: 'answer',
        answer: { type: 'number', value: aInv, tol: 1e-3 },
        hints: level === 'zorlayici'
          ? ['$a * a^{-1} = 0$ denkleminden $a^{-1} = -a/(1 + ca)$ formülünü çıkarın.']
          : [
            'Ters eleman $a * b = e = 0$ eşitliğini sağlamalıdır.',
            `$${aVal} + b + (${c})(${aVal})b = 0$ denklemini $b$ için çözün.`,
            `$b = \\frac{-a}{1 + ca} = \\frac{${-aVal}}{${denomA}}$.`,
          ],
        solution: [
          `$a * b = 0 \\implies ${aVal} + b(1 + (${c})(${aVal})) = 0 \\implies ${denomA}\\,b = ${-aVal}$.`,
          `$a^{-1} = ${aInvFrac} = ${aInv}$ (kontrol: $${aVal} * (${aInv}) = 0$).`,
        ],
      },
    ];

    if (level === 'isinma') {
      rawParts.push({
        prompt: `$(S, *)$ grubunun birim elemanı $e$ kaçtır?`,
        kind: 'answer',
        answer: { type: 'int', value: 0 },
        hints: [
          'Her $a \\in S$ için $a * e = a$ olmalıdır.',
          `$a + e + cae = a \\implies e(1 + ca) = 0$.`,
          `$1 + ca \\neq 0$ olduğu için $e = 0$ çıkar.`,
        ],
        solution: [
          `$a * 0 = a + 0 + c \\cdot a \\cdot 0 = a$ ve $0 * a = a$ olduğundan birim eleman $e = 0$'dır.`,
        ],
      });
    } else if (level === 'odev') {
      rawParts.push({
        prompt: `**Kanıt:** $S = \\mathbb{R} \\setminus \\{${x0Frac}\\}$ kümesinin $*$ işlemi altında **kapalı** olduğunu ve işlemin **birleşmeli** olduğunu gösterin.`,
        kind: 'proof',
        hints: [
          `Kapalılık için $1 + c(a * b)$ ifadesini çarpanlarına ayırın.`,
          `Birleşme için $(a * b) * d$ ve $a * (b * d)$ ifadelerini açıp karşılaştırın.`,
        ],
        solution: [
          `**Çarpanlama özdeşliği:** $1 + c(a * b) = 1 + ca + cb + c^2 ab = (1 + ca)(1 + cb)$.`,
          `**Kapalılık:** $a, b \\in S \\implies 1 + ca \\neq 0$ ve $1 + cb \\neq 0 \\implies 1 + c(a*b) \\neq 0 \\implies a*b \\neq ${x0Frac}$, yani $a*b \\in S$.`,
          `**Birleşme:** $(a*b)*d = a + b + d + c(ab + ad + bd) + c^2 abd$, ifade $a, b, d$ arasında tamamen simetrik olduğundan $a*(b*d)$ ile özdeştir.`,
        ],
        checklist: [
          '$1 + c(a * b) = (1 + ca)(1 + cb)$ özdeşliği kuruldu (veya $a * b = -1/c$ varsayımından çelişki elde edildi).',
          '$a, b \\neq -1/c$ iken $a * b \\neq -1/c$ olduğu (kapalılık) gösterildi.',
          '$(a * b) * d$ ve $a * (b * d)$ açıkça eşitlenerek birleşme kanıtlandı.',
        ],
      });
    } else {
      rawParts.push({
        prompt: `**Kanıt:** $${phiTex}$ dönüşümünün $(S, *)$ grubundan $(\\mathbb{R} \\setminus \\{0\\}, \\cdot)$ çarpımsal grubuna bir **grup izomorfizması** olduğunu kanıtlayın ve bu sayede $(S, *)$'nin Abelyen bir grup olduğunu çıkarın.`,
        kind: 'proof',
        hints: [
          `$\\varphi(a * b) = \\varphi(a)\\varphi(b)$ eşitliğini doğrudan hesaplayın.`,
          `$\\varphi$'nin birebir ve örten olduğunu ters dönüşümü $\\varphi^{-1}(y) = (y-1)/c$ yazarak gösterin.`,
        ],
        solution: [
          `**İyi tanımlılık ve bijeksiyon:** $x \\in S \\iff x \\neq ${x0Frac} \\iff 1 + cx \\neq 0$, yani $\\varphi(x) \\in \\mathbb{R}\\setminus\\{0\\}$. Tersi $\\varphi^{-1}(y) = \\frac{y-1}{c}$ her $y \\neq 0$ için tanımlı ve $S$'ye düşer; dolayısıyla $\\varphi$ bijektiftir.`,
          `**Homomorfizma:** $\\varphi(a * b) = 1 + c(a + b + cab) = (1 + ca)(1 + cb) = \\varphi(a)\\varphi(b)$.`,
          `**Sonuç:** $(\\mathbb{R}\\setminus\\{0\\}, \\cdot)$ Abelyen bir grup olduğundan izomorfik kopyası $(S, *)$ de otomatik olarak kapalılık, birleşme, birim ($\\varphi^{-1}(1) = 0$), ters ($\\varphi^{-1}(1/(1+ca)) = -a/(1+ca)$) ve değişmelilik özelliklerini taşır.`,
        ],
        checklist: [
          '$\\varphi(S) = \\mathbb{R} \\setminus \\{0\\}$ olduğu ve ters fonksiyon $\\varphi^{-1}(y) = (y-1)/c$ ile bijektiflik gösterildi.',
          '$\\varphi(a * b) = \\varphi(a)\\varphi(b)$ homomorfizma koşulu doğrulandı.',
          'İzomorfizmadan kapalılık, birleşme, birim eleman, ters ve değişmelilik sonuçları çıkarıldı.',
        ],
      });
    }

    return {
      title: `Deforme Birleşim Yasası: $a * b = a + b ${cTerm}$`,
      story: `Doğrusal olmayan bir sensör zincirinde iki gerçel parametre $a$ ve $b$, doğrusal toplamanın bozulmuş bir biçimi olan $${opTex}$ kuralıyla birleşiyor. Bu kuralın hangi küme üzerinde bir grup oluşturduğunu inceleyelim.`,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 3. ps1-esleme-mertebe2 — Self-inverse pairing, g^2 = e => Abelian
// =====================================================================

const T_ESLEME_MERTEBE2 = {
  id: 'ps1-esleme-mertebe2',
  topic: 'Grup Aksiyomları',
  title: 'Ters Eleman Eşlemesi ve Mertebesi 2 Olan Elemanlar',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const useDihedral = level === 'zorlayici' ? true : rng.int(0, 1) === 1;
    let groupTex, orderG, ord2Count, pairCount, model, ord2ListSpec, ord2ListTex, concreteExplain;

    if (useDihedral) {
      const n = rng.pick(level === 'isinma' ? [3, 4, 5, 6] : [3, 4, 5, 6, 7, 8]);
      orderG = 2 * n;
      groupTex = `D_{${n}}`;
      model = { id: 'polygon', params: { n } };
      const ord2Elems = dAll(n).filter(x => dOrder(n, x) === 2);
      ord2Count = ord2Elems.length;
      pairCount = (orderG - 1 - ord2Count) / 2;
      ord2ListSpec = { type: 'dset', n, value: ord2Elems };
      ord2ListTex = dSetTex(ord2Elems);
      concreteExplain = n % 2 === 0
        ? `$D_{${n}}$ içinde tüm $${n}$ yansıma ($r^k s$) ve yarım tur dönme $r^{${n / 2}}$ mertebe $2$'ye sahiptir; toplam $${ord2Count}$ eleman (tek sayı!). Kalan $${2 * pairCount}$ dönme $\\{r^k, r^{${n}-k}\\}$ biçiminde $${pairCount}$ çift oluşturur.`
        : `$D_{${n}}$ içinde yalnızca $${n}$ yansıma ($r^k s$) mertebe $2$'ye sahiptir (dönmelerden hiçbirinin mertebesi $2$ değildir, çünkü $${n}$ tektir). Kalan $${2 * pairCount}$ dönme $\\{r^k, r^{${n}-k}\\}$ biçiminde $${pairCount}$ çift oluşturur.`;
    } else {
      const m = rng.pick(level === 'isinma' ? [3, 4, 5, 6] : [4, 5, 6, 7, 8, 9, 10, 12]);
      const N = 2 * m;
      orderG = N;
      groupTex = `\\mathbb{Z}_{${N}}`;
      model = { id: 'cyclic', params: { n: N, k: m } };
      ord2Count = 1;
      pairCount = m - 1;
      ord2ListSpec = { type: 'intset', value: [m] };
      ord2ListTex = `\\{${m}\\}`;
      concreteExplain = `$\\mathbb{Z}_{${N}}$ içinde $g + g \\equiv 0 \\pmod{${N}}$ denkleminin sıfır dışındaki tek çözümü $g = ${m}$ elemanıdır ($1$ adet). Kalan $${N - 2}$ eleman $\\{k, ${N}-k\\}$ ($1 \\le k \\le ${m - 1}$) biçiminde $${pairCount}$ çift oluşturur.`;
    }

    const rawParts = [
      {
        prompt: `Mertebesi $|${groupTex}| = ${orderG}$ (çift) olan $${groupTex}$ grubunda mertebesi tam $2$ olan (yani $g \\neq e$ ve $g^2 = e$ sağlayan) kaç eleman vardır?`,
        kind: 'answer',
        answer: { type: 'int', value: ord2Count },
        hints: level === 'zorlayici'
          ? [useDihedral ? 'Yansımaların hepsi mertebe 2 taşır; dönmelerin içinde $r^{n/2}$ var mı kontrol edin.' : 'Toplamsal grupta $2g \\equiv 0 \\pmod{2m}$ denklemini çözün.']
          : [
            'Bir $g \\neq e$ elemanının mertebesi $2$ olması $g = g^{-1}$ olması demektir.',
            useDihedral ? 'Düzgün $n$-gende her yansıma kendi tersidir; $n$ çiftse $180^\\circ$ dönme ($r^{n/2}$) de kendi tersidir.' : `Toplamsal $\\mathbb{Z}_{${orderG}}$ grubunda $g \\equiv -g \\pmod{${orderG}}$ denklemini sağlayan sıfır dışı elemanı arayın.`,
            `Sonuç her zaman tek bir pozitif tam sayı çıkmalıdır.`,
          ],
        solution: [concreteExplain, `Mertebesi $2$ olan eleman sayısı: **$${ord2Count}$**.`],
      },
      {
        prompt: `$${groupTex}$ içinde $g \\neq g^{-1}$ olan elemanlar $\\{g, g^{-1}\\}$ biçiminde kaç adet sırasız çift oluşturur?`,
        kind: 'answer',
        answer: { type: 'int', value: pairCount },
        hints: level === 'zorlayici'
          ? ['$|G| = 1 + |\\{g : |g|=2\\}| + 2 \\cdot (\\text{çift sayısı})$ sayma eşitliğini kullanın.']
          : [
            'Birim eleman $e$ ve mertebesi $2$ olan elemanlar kendi terslerine eşittir ($g = g^{-1}$).',
            `Geriye kalan $${orderG} - 1 - ${ord2Count} = ${2 * pairCount}$ eleman ikişerli $\\{g, g^{-1}\\}$ çiftlerine ayrılır.`,
            `Toplam eleman sayısını $2$'ye bölün: $${2 * pairCount} / 2 = ${pairCount}$.`,
          ],
        solution: [
          `Kendi tersi olan eleman sayısı $1 + ${ord2Count} = ${1 + ord2Count}$ (birim + mertebe $2$ elemanlar).`,
          `Kalan $${orderG} - ${1 + ord2Count} = ${2 * pairCount}$ eleman ikişer ikişer eşleşir: $${2 * pairCount}/2 = ${pairCount}$ çift.`,
        ],
      },
    ];

    if (level === 'isinma') {
      rawParts.push(
        {
          prompt: `$${groupTex}$ grubundaki mertebesi $2$ olan tüm elemanları küme olarak yazın.`,
          kind: 'answer',
          answer: ord2ListSpec,
          hints: [
            useDihedral ? 'Normal biçimde $r^k s$ yansımalarını ve (varsa) $r^{n/2}$ dönmesini listeleyin.' : `$g + g \\equiv 0 \\pmod{${orderG}}$ sağlayan tek sıfır dışı sayı ${orderG / 2}'dir.`,
            `Toplam $${ord2Count}$ eleman yazmalısınız.`,
            `Küme: $${ord2ListTex}$.`,
          ],
          solution: [`Mertebesi $2$ olan elemanlar kümesi: $${ord2ListTex}$.`],
        },
        {
          prompt: `$${groupTex}$ grubunda **her** $g$ elemanı $g^2 = e$ koşulunu sağlar mı?`,
          kind: 'answer',
          answer: { type: 'yesno', value: false },
          hints: [
            `Eğer her eleman $g^2 = e$ sağlasaydı $g \\neq g^{-1}$ çiftlerinin sayısı $0$ olurdu.`,
            `Bir önceki şıkta $${pairCount} > 0$ çift buldunuz.`,
            'Örneğin dönme $r$ (veya $1 \\in \\mathbb{Z}_{2m}$) için $g^2 \\neq e$.',
          ],
          solution: [`$${pairCount} > 0$ tane $g \\neq g^{-1}$ çifti olduğundan her eleman $g^2 = e$ sağlamaz: **Hayır**.`],
        }
      );
    } else if (level === 'odev') {
      rawParts.push({
        prompt: '**Kanıt:** Mertebesi $|G|$ **çift** olan her sonlu $G$ grubunda mertebesi $2$ olan en az bir (hatta tek sayıda) eleman bulunduğunu ters eleman eşlemesiyle kanıtlayın.',
        kind: 'proof',
        hints: [
          '$G$ elemanlarını iki gruba ayırın: $S = \\{g \\in G : g = g^{-1}\\}$ ve $G \\setminus S = \\{g \\in G : g \\neq g^{-1}\\}$.',
          '$G \\setminus S$ kümesindeki elemanların $\\{g, g^{-1}\\}$ şeklinde ayrık çiftlere bölündüğünü ve $|G \\setminus S|$ sayısının çift olduğunu gösterin.',
        ],
        solution: [
          'Her $g \\in G$ için $(g^{-1})^{-1} = g$ olduğundan $g \\neq g^{-1}$ olan elemanlar ayrık $\\{g, g^{-1}\\}$ ikililerine ayrılır; dolayısıyla $|\\{g : g \\neq g^{-1}\\}|$ **çift** bir sayıdır.',
          '$|G|$ çift olduğuna göre $S = \\{g \\in G : g = g^{-1}\\}$ kümesinin eleman sayısı $|S| = |G| - |G \\setminus S|$ de **çift** olmalıdır.',
          '$e \\in S$ olduğundan $|S| \\ge 1$ ve $|S|$ çift olduğu için $|S| \\ge 2$ ve $|S \\setminus \\{e\\}| = |S| - 1$ **tek** bir pozitif tam sayıdır.',
          '$g \\in S \\setminus \\{e\\} \\iff g \\neq e$ ve $g^2 = e \\iff |g| = 2$, dolayısıyla $G$ tek sayıda (en az bir) mertebe-$2$ elemana sahiptir.',
        ],
        checklist: [
          '$g \\neq g^{-1}$ elemanlarının ayrık $\\{g, g^{-1}\\}$ çiftleri oluşturduğu ve sayılarının çift olduğu belirtildi.',
          '$|G|$ çift olduğundan $S = \\{g : g = g^{-1}\\}$ kümesinin eleman sayısının çift olduğu çıkarıldı.',
          '$e \\in S$ çıkarılınca geriye tek sayıda ($\\ge 1$) mertebesi $2$ olan eleman kaldığı gösterildi.',
        ],
      });
    } else {
      rawParts.push(
        {
          prompt: '**Kanıt 1:** Bir $G$ grubunda **her** $g \\in G$ için $g^2 = e$ sağlanıyorsa $G$ grubunun mutlaka **değişmeli (Abelyen)** olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            '$g^2 = e$ koşulundan $g = g^{-1}$ çıkarımını yapın ve bunu $ab$ çarpımına uygulayın.',
          ],
          solution: [
            'Her $x \\in G$ için $x^2 = e \\implies x = x^{-1}$.',
            'Keyfi $a, b \\in G$ alalım. Çarpım $ab \\in G$ de bu koşulu sağladığından $ab = (ab)^{-1}$.',
            'Grup tersinin sıra değiştirme kuralı $(ab)^{-1} = b^{-1} a^{-1}$ ile $a^{-1} = a$, $b^{-1} = b$ birleştirilirse: $ab = (ab)^{-1} = b^{-1}a^{-1} = ba$.',
            'Her $a, b \\in G$ için $ab = ba$ olduğundan $G$ Abelyendir.',
          ],
          checklist: [
            '$x^2 = e \\implies x = x^{-1}$ her eleman için kuruldu.',
            'Koşul $ab$ çarpımına uygulandı: $ab = (ab)^{-1}$.',
            '$(ab)^{-1} = b^{-1}a^{-1} = ba$ adımıyla değişmelilik tamamlandı.',
          ],
        },
        {
          prompt: '**Kanıt 2:** Mertebesi çift olan herhangi bir sonlu $G$ grubunda mertebesi $2$ olan eleman sayısının **tek** (dolayısıyla $\\ge 1$) olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            'Elemanları $g = g^{-1}$ olanlar ve $\\{g, g^{-1}\\}$ çiftleri olarak parçalayıp parite (tek/çift) hesabı yapın.',
          ],
          solution: [
            '$|G| = 1 + N_2 + 2P$, burada $N_2$ mertebesi $2$ olan eleman sayısı, $P$ ise $g \\neq g^{-1}$ çiftlerinin sayısıdır.',
            '$|G|$ ve $2P$ çift olduğundan $1 + N_2$ çift, yani $N_2$ **tek** olmak zorundadır; $N_2 \\ge 1$.',
          ],
          checklist: [
            'Ayrıştırma $|G| = 1 + N_2 + 2P$ açıkça gerekçelendirildi.',
            'Parite argümanıyla $N_2$ sayısının tek ve en az $1$ olduğu sonuçlandırıldı.',
          ],
        }
      );
    }

    return {
      title: `İnvolüsyonlar ve Ters Eşlemesi ($${groupTex}$)`,
      story: `Fizikte parite veya zaman tersinmesi gibi iki kez uygulandığında sistemi başlangıç durumuna döndüren ($g^2 = e$) simetrilere **involüsyon** denir. Çift mertebeli $${groupTex}$ grubunda ($|${groupTex}| = ${orderG}$) elemanları tersleriyle eşleştirerek bu involüsyonların sayısını inceleyelim.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 4. ps1-dn-kelime-permutasyon — Working in D_n: words, normal form, perms
// =====================================================================

const T_DN_KELIME_PERM = {
  id: 'ps1-dn-kelime-permutasyon',
  topic: 'Dihedral Gruplar',
  title: '$D_n$ Normal Biçim, Kelime İndirgeme ve Konum Permütasyonları',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [3, 4, 5, 6] : level === 'odev' ? [4, 5, 6, 7, 8] : [5, 6, 7, 8];
    const n = rng.pick(nPool);

    // Build a non-trivial word starting with s so s r^k = r^-k s is genuinely exercised
    let tokens, evalRes;
    for (let tries = 0; tries < 30; tries++) {
      if (level === 'isinma') {
        const a = rng.int(1, n - 1);
        if (rng.int(0, 1) === 0) {
          tokens = [{ kind: 's' }, { kind: 'r', exp: a }];
        } else {
          const b = rng.int(1, n - 1);
          tokens = [{ kind: 'r', exp: b }, { kind: 's' }, { kind: 'r', exp: a }];
        }
      } else if (level === 'odev') {
        const a = rng.int(1, n - 1), b = rng.int(1, n - 1), c = rng.int(1, n - 1);
        tokens = [
          { kind: 's' }, { kind: 'r', exp: a },
          { kind: 's' }, { kind: 'r', exp: b },
          { kind: 's' }, { kind: 'r', exp: c },
        ];
      } else {
        const a = rng.int(1, n - 1), b = rng.int(1, n - 1), c = rng.int(1, n - 1), d = rng.int(1, n - 1);
        tokens = [
          { kind: 's' }, { kind: 'r', exp: -a },
          { kind: 's' }, { kind: 'r', exp: b },
          { kind: 's' }, { kind: 'r', exp: c },
          { kind: 's' }, { kind: 'r', exp: d },
        ];
      }
      evalRes = evalDWord(n, tokens);
      if (!(evalRes.value.k === 0 && evalRes.value.m === 0)) break;
    }

    const wEl = evalRes.value;
    const wPerm = dPerm(n, wEl);
    const wPermStr = cyclesString(wPerm);
    const wOrd = dOrder(n, wEl);

    // Build factor-by-factor right-to-left permutation check for solution
    const factorPerms = tokens.map(t => {
      const el = t.kind === 's' ? dEl(n, 0, 1) : dEl(n, t.exp, 0);
      return `${t.kind === 's' ? 's' : (t.exp === 1 ? 'r' : `r^{${t.exp}}`)} = ${cyclesString(dPerm(n, el))}`;
    });

    const rawParts = [
      {
        prompt: `$w = ${evalRes.tex}$ ifadesini $s r^k = r^{-k} s$ ve $s^2 = e$ bağıntılarını kullanarak tekil normal biçime ($r^k s^m$, $0 \\le k < ${n}$, $m \\in \\{0, 1\\}$) getirin.`,
        kind: 'answer',
        answer: { type: 'dihedral', n, value: wEl },
        hints: level === 'zorlayici'
          ? ['Soldan sağa veya sağdan sola her $s$ sembolünü $r$ kuvvetlerinin sağına geçirin: $s r^k = r^{-k} s$ ve $r^n = e$.']
          : [
            `Temel kural: $s r^k = r^{-k} s = r^{${n}-k} s$ ve $s^2 = e$.`,
            'Soldaki $s$ sembollerini $r$ kuvvetlerinin üzerinden geçirip tüm $r$ üslerini mod $n$ toplayın.',
            `İlk indirgeme adımı: ${evalRes.steps[0]}`,
          ],
        solution: [
          ...evalRes.steps,
          `Normal biçim sonucu: **$w = ${dTex(wEl)}$**.`,
        ],
      },
      {
        prompt: `Bulduğunuz $w = ${dTex(wEl)}$ simetrisini konum permütasyonu olarak ayrık döngü gösteriminde yazın (sağdan sola kuralıyla, $i \\to j$: $i$ konumundaki köşe $j$ konumuna gider).`,
        kind: 'answer',
        answer: { type: 'perm', n, value: wPerm },
        hints: level === 'zorlayici'
          ? [`$r = ${cyclesString(dPerm(n, dEl(n, 1)))}$ ve $s = ${cyclesString(dPerm(n, dEl(n, 0, 1)))}$ permütasyonlarını sağdan sola bileştirin.`]
          : [
            `Ders konvansiyonuna göre $r = ${cyclesString(dPerm(n, dEl(n, 1)))}$ (köşeleri $i \\mapsto i+1$) ve $s = ${cyclesString(dPerm(n, dEl(n, 0, 1)))}$ ($1$. köşeyi sabit bırakır).`,
            wEl.m ? `Önce $s$ uygulanır ($i \\mapsto 2 - i \\bmod ${n}$), ardından $r^{${wEl.k}}$ ($+ ${wEl.k} \\bmod ${n}$).` : `Saf dönme $r^{${wEl.k}}$ her konumu $+${wEl.k} \\pmod{${n}}$ kaydırır.`,
            `1. konumun görüntüsü: $1 \\mapsto ${wPerm[0]}$.`,
          ],
        solution: [
          `Temel üreteçler: $r = ${cyclesString(dPerm(n, dEl(n, 1)))}$, $s = ${cyclesString(dPerm(n, dEl(n, 0, 1)))}$.`,
          `Çarpanların permütasyonları (sağdan sola çarpıldığında): ${factorPerms.map(f => `$${f}$`).join(', ')}.`,
          `Her konumun görüntüsü: ${wPerm.map((img, idx) => `$${idx + 1} \\mapsto ${img}$`).join(', ')} $\\implies$ **$w = ${wPermStr}$**.`,
        ],
      },
    ];

    if (level === 'isinma') {
      rawParts.push({
        prompt: `Elde edilen $w$ elemanının $D_{${n}}$ içindeki mertebesi $|w|$ kaçtır?`,
        kind: 'answer',
        answer: { type: 'int', value: wOrd },
        hints: [
          `Her yansımanın ($r^k s$) mertebesi $2$'dir; bir dönmenin ($r^k$) mertebesi $n / \\gcd(k, n)$ olur.`,
          'Permütasyonun ayrık döngü uzunluklarının EKOK değeri de aynı mertebeyi verir.',
          wEl.m ? '$w$ bir yansıma olduğundan $w^2 = e$.' : `$|r^{${wEl.k}}| = ${n} / \\gcd(${wEl.k}, ${n})$.`,
        ],
        solution: [
          wEl.m
            ? `$w = ${dTex(wEl)}$ bir yansıma olduğu için $w^2 = e$ ve $|w| = 2$.`
            : `$w = ${dTex(wEl)}$ bir dönmedir: $|r^{${wEl.k}}| = \\frac{${n}}{\\gcd(${wEl.k}, ${n})} = ${wOrd}$.`,
        ],
      });
    } else if (level === 'odev') {
      const wInv = dInv(n, wEl);
      const dRot = rng.int(1, n - 1);
      const rotOrd = n / gcd(n, dRot);
      rawParts.push(
        {
          prompt: `$w$ elemanının tersi $w^{-1}$ elemanını normal biçimde ($r^k s^m$) yazın.`,
          kind: 'answer',
          answer: { type: 'dihedral', n, value: wInv },
          hints: [
            'Yansımalar kendi tersleridir: $(r^k s)^{-1} = r^k s$.',
            `Dönmeler için $(r^k)^{-1} = r^{${n} - k}$.`,
          ],
          solution: [
            wEl.m
              ? `$w = ${dTex(wEl)}$ bir yansıma olduğundan $(${dTex(wEl)})^2 = e$, yani $w^{-1} = ${dTex(wInv)}$.`
              : `$w = ${dTex(wEl)}$ bir dönme olduğundan $w^{-1} = r^{${n} - ${wEl.k}} = ${dTex(wInv)}$.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ içindeki $r^{${dRot}}$ dönmesinin mertebesi kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: rotOrd },
          hints: [
            `$|r^d| = n / \\gcd(d, n)$ formülünü kullanın.`,
            `$\\gcd(${dRot}, ${n}) = ${gcd(dRot, n)}$.`,
          ],
          solution: [
            `$|r^{${dRot}}| = \\frac{${n}}{\\gcd(${dRot}, ${n})} = \\frac{${n}}{${gcd(dRot, n)}} = ${rotOrd}$.`,
          ],
        }
      );
    } else {
      // Solve w * x = target
      const target = dEl(n, rng.int(1, n - 1), rng.int(0, 1));
      const xSol = dMul(n, dInv(n, wEl), target);
      rawParts.push(
        {
          prompt: `$D_{${n}}$ içinde $w \\cdot x = ${dTex(target)}$ denklemini sağlayan $x$ elemanını normal biçimde bulun.`,
          kind: 'answer',
          answer: { type: 'dihedral', n, value: xSol },
          hints: [
            'Eşitliğin her iki yanını soldan $w^{-1}$ ile çarpın: $x = w^{-1} \\cdot ' + dTex(target) + '$.',
          ],
          solution: [
            `$w = ${dTex(wEl)}$ olduğundan $w^{-1} = ${dTex(dInv(n, wEl))}$.`,
            `$x = w^{-1} \\cdot ${dTex(target)} = ${dTex(dInv(n, wEl))} \\cdot ${dTex(target)} = ${dTex(xSol)}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $s r s = r^{-1}$ ve $s^2 = e$ bağıntılarından hareketle tüm $k \\in \\mathbb{Z}$ için $s r^k = r^{-k} s$ olduğunu tümevarımla kanıtlayın ve bundan her $r^k s$ yansımasının mertebesinin $2$ olduğunu çıkarın.',
          kind: 'proof',
          hints: [
            'Önce $s r s = r^{-1}$ eşitliğini sağdan $s$ ile çarparak $s r = r^{-1} s$ elde edin, sonra $k \\ge 0$ için tümevarım yapın ve $k < 0$ için ters alın.',
          ],
          solution: [
            '$s r s = r^{-1}$ eşitliğini sağdan $s$ ile çarparsak ($s^2 = e$): $s r = r^{-1} s$ (taban $k = 1$; $k = 0$ aşikar).',
            'Tümevarım adımı: $s r^k = r^{-k} s$ varsayımıyla $s r^{k+1} = (s r^k) r = r^{-k} (s r) = r^{-k} r^{-1} s = r^{-(k+1)} s$.',
            'Negatif $k = -m$ ($m > 0$) için: $s r^m = r^{-m} s$ eşitliğini soldan $r^m$, sağdan $r^{-m}$ ile çarparsak $r^m s = s r^{-m}$, yani $s r^{-m} = r^m s$.',
            'Yansıma mertebesi: $(r^k s)^2 = r^k (s r^k) s = r^k (r^{-k} s) s = e \\cdot s^2 = e$, ve $r^k s \\neq e$ olduğundan $|r^k s| = 2$.',
          ],
          checklist: [
            '$s r = r^{-1} s$ temel adımı $s r s = r^{-1}$ ve $s^2 = e$ kullanılarak elde edildi.',
            'Pozitif $k$ için tümevarım adımı ve negatif $k$ için uzatma gösterildi.',
            '$(r^k s)^2 = r^k r^{-k} s^2 = e$ ile her yansımanın mertebesi $2$ olduğu kanıtlandı.',
          ],
        }
      );
    }

    return {
      title: `Düzgün $${n}$-gen Simetrileri ($D_{${n}}$)`,
      story: `Düzgün bir $${n}$-gen kesitli optik prizmanın köşeleri saat yönünün tersine $1, 2, \\dots, ${n}$ olarak numaralanmıştır. Ders konvansiyonumuzla $r$ saat yönünün tersine $2\\pi/${n}$ dönmesi, $s$ ise $1$. köşeden ve merkezden geçen eksene göre yansımadır; çarpımlar **sağdan sola** ($gh$ içinde önce $h$) okunur.`,
      model: { id: 'polygon', params: { n, word: evalRes.ascii } },
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 5. ps1-dn-yansima-ekseni — Reflection axes & fixed vertices in D_n
// =====================================================================

const AXIS_LABELS = [
  'İki karşılıklı köşeden geçer (2 sabit köşe)',
  'Bir köşeden ve karşı kenarın orta noktasından geçer (1 sabit köşe)',
  'İki karşılıklı kenarın orta noktalarından geçer (0 sabit köşe)',
];

const T_DN_YANSIMA_EKSENI = {
  id: 'ps1-dn-yansima-ekseni',
  topic: 'Dihedral Gruplar',
  title: '$D_n$ Yansıma Eksenleri ve Sabit Köşeler',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [3, 4, 5, 6] : [3, 4, 5, 6, 7, 8];
    const n = rng.pick(nPool);
    const k = rng.int(1, n - 1);
    const refl = dEl(n, k, 1);
    const perm = dPerm(n, refl);
    const fixed = [];
    for (let i = 1; i <= n; i++) if (perm[i - 1] === i) fixed.push(i);

    const axisIdx = fixed.length === 2 ? 0 : fixed.length === 1 ? 1 : 2;
    const axisChoice = shuffleChoice(rng, AXIS_LABELS[axisIdx], AXIS_LABELS.filter((_, i) => i !== axisIdx));
    const sameTypeCount = n % 2 === 1 ? n : n / 2;

    // Describe geometric axis explicitly for worked solution
    let geomDetail;
    if (fixed.length === 2) {
      geomDetail = `Sabit kalan köşeler $${fixed[0]}$ ve $${fixed[1]}$ olduğundan ayna ekseni bu iki karşılıklı köşeden geçer.`;
    } else if (fixed.length === 1) {
      const v = fixed[0];
      const u1 = mod(v - 1 + (n - 1) / 2, n) + 1;
      const u2 = (u1 % n) + 1;
      geomDetail = `Yalnızca $${v}$. köşe sabit kalır; karşıdaki $(${u1}, ${u2})$ kenarının uçları yer değiştirir ($${u1} \\leftrightarrow ${u2}$).`;
    } else {
      const e1 = (k + 1) / 2;
      const e1b = (e1 % n) + 1;
      const e2 = e1 + n / 2;
      const e2b = (e2 % n) + 1;
      geomDetail = `Hiçbir köşe sabit kalmaz; $(${e1}, ${e1b})$ ve $(${e2}, ${e2b})$ karşılıklı kenarlarının uçları kendi aralarında yer değiştirir, dolayısıyla eksen bu iki kenarın orta noktalarından geçer.`;
    }

    const rawParts = [
      {
        prompt: `$D_{${n}}$ içindeki $${dTex(refl)}$ yansımasını konum permütasyonu olarak ayrık döngü gösteriminde yazın.`,
        kind: 'answer',
        answer: { type: 'perm', n, value: perm },
        hints: level === 'zorlayici'
          ? [`Her $i \\in \\{1, \\dots, ${n}\\}$ için önce $s(i) \\equiv 2 - i \\pmod{${n}}$, ardından $r^{${k}}$ uygulayın.`]
          : [
            `Sağdan sola kuralıyla önce $s$ ($1$. köşeyi sabitler: $i \\mapsto 2 - i \\bmod ${n}$), sonra $r^{${k}}$ ($+${k} \\bmod ${n}$) uygulanır.`,
            `Yansıma mertebesi $2$ olduğu için ayrık döngüler yalnızca $2$-döngüler (yer değiştirmeler) ve sabit noktalardan oluşur.`,
            `İlk konum: $1 \\xrightarrow{s} 1 \\xrightarrow{r^{${k}}} ${perm[0]}$.`,
          ],
        solution: [
          `Her köşenin görüntüsü ($i \\mapsto (2 - i + ${k}) \\bmod ${n}$, $1..${n}$ aralığında): ${perm.map((v, i) => `$${i + 1} \\mapsto ${v}$`).join(', ')}.`,
          `Ayrık döngü gösterimi: **$${cyclesString(perm)}$**.`,
        ],
      },
      {
        prompt: `$${dTex(refl)}$ yansımasının ayna ekseni geometrik olarak düzgün $${n}$-genden nasıl geçer?`,
        kind: 'answer',
        answer: axisChoice,
        hints: level === 'zorlayici'
          ? ['Permütasyonun sabit bıraktığı köşe sayısına (1-döngü adedine) bakın.']
          : [
            'Bir köşenin eksen üzerinde kalması, permütasyonda sabit nokta olması ($p(i) = i$) demektir.',
            `Bulduğunuz $${cyclesString(perm)}$ permütasyonunda döngülerde görünmeyen (sabit kalan) köşeleri sayın.`,
            `Sabit köşe sayısı $${fixed.length}$ olduğundan doğru eksen türünü seçin.`,
          ],
        solution: [geomDetail, `Doğru sınıflandırma: **${AXIS_LABELS[axisIdx]}**.`],
      },
    ];

    if (level === 'isinma') {
      rawParts.push({
        prompt: `$${dTex(refl)}$ yansıması düzgün $${n}$-genin kaç köşesini sabit bırakır?`,
        kind: 'answer',
        answer: { type: 'int', value: fixed.length },
        hints: [
          'Ayrık döngü gösteriminde yer almayan sayılar sabit köşelerdir.',
          `$1, \\dots, ${n}$ sayılarından kaç tanesi $p(i) = i$ sağlar?`,
          fixed.length ? `Sabit köşeler: $${intSetTex(fixed)}$.` : 'Tüm köşeler ikili döngülerde yer değiştirir (0 sabit köşe).',
        ],
        solution: [
          fixed.length
            ? `Sabit kalan köşeler $${intSetTex(fixed)}$ olup toplam **$${fixed.length}$** sabit köşe vardır.`
            : `Hiçbir köşe $p(i) = i$ sağlamadığından **0** sabit köşe vardır.`,
        ],
      });
    } else {
      const k2 = rng.pick(Array.from({ length: n }, (_, j) => j).filter(j => j !== k));
      const refl2 = dEl(n, k2, 1);
      const prod = dMul(n, refl, refl2);
      rawParts.push(
        {
          prompt: `$D_{${n}}$ içinde $${dTex(refl)}$ ile **aynı geometrik eksen türüne** sahip toplam kaç yansıma vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: sameTypeCount },
          hints: level === 'zorlayici'
            ? [`$n = ${n}$ sayısının tek veya çift olmasına göre $r^j s$ yansımalarında $j$'nin paritesini inceleyin.`]
            : [
              `$D_{${n}}$ toplam $${n}$ yansıma içerir.`,
              n % 2 === 1
                ? `$${n}$ tek olduğu için her yansıma ekseni bir köşeden ve karşı kenar orta noktasından geçer.`
                : `$${n}$ çift olduğu için yansımalar iki eşit sınıfa ayrılır: çift $j$'ler köşelerden, tek $j$'ler kenar orta noktalarından geçer.`,
            ],
          solution: [
            n % 2 === 1
              ? `$n = ${n}$ tek olduğundan tüm $${n}$ yansıma aynı türdedir (her biri $1$ köşeden ve karşı kenar orta noktasından geçer).`
              : `$n = ${n}$ çift olduğundan $r^j s$ yansımalarının yarısı (çift $j$, $${n / 2}$ adet) iki köşeden, diğer yarısı (tek $j$, $${n / 2}$ adet) iki kenar orta noktasından geçer. Dolayısıyla cevap **$${sameTypeCount}$**.`,
          ],
        },
        {
          prompt: `İki yansımanın bileşkesi $${dTex(refl)} \\cdot ${dTex(refl2)}$ elemanını normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dihedral', n, value: prod },
          hints: level === 'zorlayici'
            ? ['$s r^{k_2} = r^{-k_2} s$ ve $s^2 = e$ ile sadeleştirin; iki yansımanın çarpımı daima saf bir dönmedir.']
            : [
              `$(r^a s)(r^b s) = r^a (s r^b) s = r^a r^{-b} s^2 = r^{a - b}$ kuralını kullanın.`,
              `$a = ${k}$, $b = ${k2}$ için $a - b \\equiv ${prod.k} \\pmod{${n}}$.`,
            ],
          solution: [
            `$(${dTex(refl)})(${dTex(refl2)}) = r^{${k}} (s r^{${k2}}) s = r^{${k}} r^{-${k2}} s^2 = r^{${k - k2}} = ${dTex(prod)}$.`,
            'Geometrik olarak iki eksen arasındaki açının iki katı kadar bir dönme elde edilir.',
          ],
        }
      );

      if (level === 'zorlayici') {
        rawParts.push({
          prompt: `**Kanıt:** $D_n$ grubunda $r^k s$ yansımasının $i$ konumundaki köşeyi sabit bırakması için gerek ve yeter koşulun $2(i - 1) \\equiv k \\pmod n$ olduğunu kanıtlayın; buradan $n$ ve $k$'nın tek/çift olma durumlarına göre sabit köşe sayısının neden $1$, $2$ veya $0$ olduğunu çıkarın.`,
          kind: 'proof',
          hints: [
            '$s(i) \\equiv 2 - i \\pmod n$ ve $r^k(j) \\equiv j + k \\pmod n$ konum formüllerini birleştirip $i \\equiv 2 - i + k \\pmod n$ denkliğini çözün.',
          ],
          solution: [
            'Sağdan sola etkiyle $(r^k s)(i) \\equiv (2 - i) + k \\pmod n$.',
            'Sabit nokta koşulu: $i \\equiv 2 - i + k \\pmod n \\iff 2i \\equiv k + 2 \\pmod n \\iff 2(i - 1) \\equiv k \\pmod n$.',
            `**$n$ tek:** $\\gcd(2, n) = 1$ olduğundan $2$'nin mod $n$ tersi vardır ve denklemin $i \\in \\{1, \\dots, n\\}$ içinde **tek** çözümü bulunur ($1$ sabit köşe).`,
            '**$n$ çift, $k$ çift:** $2(i-1) \\equiv k \\pmod n \\iff i - 1 \\equiv k/2 \\pmod{n/2}$, bu da $i_1 = 1 + k/2$ ve $i_2 = 1 + k/2 + n/2$ olmak üzere **2** çözüm verir.',
            '**$n$ çift, $k$ tek:** $2(i-1)$ çift, $k$ tek olduğundan $\\gcd(2, n) = 2 \\nmid k$ ve **hiç çözüm yoktur** ($0$ sabit köşe; eksen iki karşı kenar orta noktasından geçer).',
          ],
          checklist: [
            '$(r^k s)(i) \\equiv 2 - i + k \\pmod n$ formülünden $2(i - 1) \\equiv k \\pmod n$ denkliği çıkarıldı.',
            '$n$ tek iken $\\gcd(2, n) = 1$ nedeniyle benzersiz $1$ çözüm olduğu gösterildi.',
            '$n$ çift iken $k$ çift için $2$ çözüm, $k$ tek için $0$ çözüm olduğu parite/bölünebilme ile kanıtlandı.',
          ],
        });
      }
    }

    return {
      title: `Düzgün $${n}$-gende Yansıma Eksenleri ($${dTex(refl)}$)`,
      story: `Düzgün $${n}$-gen biçimli bir kristal levhanın ayna düzlemlerini sınıflandırıyoruz. Ders konvansiyonuna göre $r$ saat yönünün tersine $2\\pi/${n}$ dönmesi, $s$ ise $1$. köşeden geçen eksene göre yansımadır.`,
      model: { id: 'polygon', params: { n, word: dName(refl) } },
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 6. ps1-dn-altgruplar — Subgroups & subgroup lattice of D_n
// =====================================================================

const T_DN_ALTGRUPLAR = {
  id: 'ps1-dn-altgruplar',
  topic: 'Dihedral Gruplar',
  title: '$D_n$ Alt Grupları ve Alt Grup Kafesi',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [3, 4, 5, 6] : [4, 6, 8];
    const n = rng.pick(nPool);
    const divs = divisors(n);
    const tau = divs.length;
    const sigma = divs.reduce((a, b) => a + b, 0);
    const totalSubs = tau + sigma;
    const cyclicSubs = tau + n;
    const ord2Subs = n + (n % 2 === 0 ? 1 : 0);

    let rawParts;
    if (level === 'isinma') {
      const rotDivs = divs.filter(d => d >= 2 && d <= 5);
      const d = rng.pick(rotDivs);
      const step = n / d;
      const rotH = dRotSub(n, d);
      const genName = dTex(dEl(n, step, 0));
      rawParts = [
        {
          prompt: `$D_{${n}}$ içinde $${genName}$ dönmesinin ürettiği $\\langle ${genName} \\rangle$ devirli alt grubunun tüm elemanlarını yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: rotH },
          hints: [
            `$${genName}$ elemanının kuvvetlerini birim $e$'ye dönene kadar hesaplayın.`,
            `Mertebe $|${genName}| = ${n} / \\gcd(${step}, ${n}) = ${d}$ olduğundan alt grupta tam $${d}$ eleman bulunur.`,
            `Elemanlar: $${dSetTex(rotH)}$.`,
          ],
          solution: [
            `$|${genName}| = ${d}$ olduğundan $\\langle ${genName} \\rangle = ${dSetTex(rotH)}$.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun mertebesi $2$ olan toplam kaç alt grubu vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: ord2Subs },
          hints: [
            'Mertebesi $2$ olan her alt grup $\\{e, g\\}$ biçimindedir ve $g$ mertebesi $2$ olan bir elemandır.',
            `Her yansıma $r^k s$ ($${n}$ adet) ayrı bir $\\{e, r^k s\\}$ alt grubu üretir.`,
            n % 2 === 0 ? `$n = ${n}$ çift olduğu için yarım tur $r^{${n / 2}}$ de mertebe $2$ taşır (+1 alt grup).` : `$n = ${n}$ tek olduğundan dönmelerin hiçbiri mertebe $2$ taşımaz.`,
          ],
          solution: [
            `$${n}$ yansıma $\\{e, r^k s\\}$ alt gruplarını üretir` + (n % 2 === 0 ? `; ayrıca $r^{${n / 2}}$ dönmesi $\\{e, r^{${n / 2}}\\}$ alt grubunu verir: toplam **$${ord2Subs}$**.` : `; dönmelerde mertebe-$2$ eleman olmadığından toplam **$${ord2Subs}$**.`),
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun toplam kaç alt grubu vardır? ($\\{e\\}$ ve $D_{${n}}$ dahil.)`,
          kind: 'answer',
          answer: { type: 'int', value: totalSubs },
          hints: [
            'Alt grupları iki türe ayırın: saf dönme alt grupları ($\\tau(n)$ adet) ve yansıma içeren dihedral alt gruplar ($\\sigma(n)$ adet).',
            `$${n}$ sayısının bölenleri: $${intSetTex(divs)}$, dolayısıyla $\\tau(${n}) = ${tau}$ ve $\\sigma(${n}) = ${sigma}$.`,
            `Toplam alt grup sayısı $\\tau(${n}) + \\sigma(${n}) = ${tau} + ${sigma}$.`,
          ],
          solution: [
            `Bölenler $${intSetTex(divs)}$: dönme alt grupları $\\tau(${n}) = ${tau}$ adet.`,
            `Her $d \\mid ${n}$ için $D_d$ tipinde $${n}/d$ adet yansıma içeren alt grup vardır; toplam $\\sum_{d \\mid ${n}} ${n}/d = \\sigma(${n}) = ${sigma}$.`,
            `Toplam alt grup sayısı: $${tau} + ${sigma} = ${totalSubs}$.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      const half = n / 2;
      const j = rng.int(0, half - 1);
      const v4Sub = dDihSub(n, 2, j);
      const genRefl = dTex(dEl(n, j, 1));
      rawParts = [
        {
          prompt: `$D_{${n}}$ içinde $H = \\langle r^{${half}}, ${genRefl} \\rangle$ alt grubunun tüm elemanlarını normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: v4Sub },
          hints: [
            `$r^{${half}}$ ve $${genRefl}$ elemanlarının mertebesi $2$'dir ve $r^{${half}}$ merkezdedir ($r^{${half}} s = s r^{${half}}$).`,
            'Kapalılık için iki üretecin çarpımını ekleyin: toplam $4$ eleman ($\\cong D_2 \\cong V_4$).',
          ],
          solution: [
            `$r^{${half}}$ ve $${genRefl}$ değişmeli olup çarpımları $${dTex(dEl(n, j + half, 1))}$ olur.`,
            `$H = ${dSetTex(v4Sub)} \\cong D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun Klein dörtlü grubuna ($D_2 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$) izomorfik kaç alt grubu vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: half },
          hints: [
            `Her $D_2$ alt grubu $\\{e, r^{${half}}\\}$ ile iki yansımayı ($r^j s$ ve $r^{j+${half}} s$) içerir.`,
            `$j \\in \\{0, 1, \\dots, ${half - 1}\\}$ için kaç ayrık yansıma çifti oluşur?`,
          ],
          solution: [
            `$d = 2 \\mid ${n}$ için $\\langle r^{${half}}, r^j s \\rangle$ alt grupları $j = 0, \\dots, ${half - 1}$ değerlerinde birbirinden farklıdır.`,
            `Toplam $${n}/2 = ${half}$ adet $D_2$ alt grubu vardır.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun toplam kaç tane **devirli** alt grubu vardır? ($\\{e\\}$ ve mertebesi $2$ olan yansıma alt grupları dahil.)`,
          kind: 'answer',
          answer: { type: 'int', value: cyclicSubs },
          hints: [
            'Dönme alt gruplarının hepsi devirlidir ($\\tau(n)$ adet).',
            'Ayrıca her $r^k s$ yansıması $2$ elemanlı devirli bir alt grup $\\{e, r^k s\\}$ üretir ($n$ adet). İkiden fazla elemana sahip ve yansıma içeren hiçbir alt grup devirli olamaz.',
          ],
          solution: [
            `Saf dönme alt grupları: $\\tau(${n}) = ${tau}$ adet (tümü devirli).`,
            `Mertebe-$2$ yansıma alt grupları $\\langle r^k s \\rangle$: $${n}$ adet (tümü $\\cong \\mathbb{Z}_2$, devirli).`,
            `Mertebesi $\\ge 4$ olan yansıma içeren alt gruplar ($D_d$, $d \\ge 2$) devirli değildir. Toplam: $${tau} + ${n} = ${cyclicSubs}$.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun alt grup kafesinde toplam kaç alt grup yer alır?`,
          kind: 'answer',
          answer: { type: 'int', value: totalSubs },
          hints: [
            `$\\tau(n) + \\sigma(n)$ formülünü uygulayın: $\\tau(${n}) = ${tau}$, $\\sigma(${n}) = ${sigma}$.`,
          ],
          solution: [
            `$${n}$ bölenleri $${intSetTex(divs)}$ için $\\tau(${n}) = ${tau}$ ve $\\sigma(${n}) = ${sigma}$.`,
            `Toplam alt grup sayısı: $${tau} + ${sigma} = ${totalSubs}$.`,
          ],
        },
      ];
    } else {
      const mPool = divs.filter(d => d >= 2 && d < n);
      const m = rng.pick(mPool);
      const step = n / m;
      const j = rng.int(0, step - 1);
      const dmSub = dDihSub(n, m, j);
      const dmCount = step;
      const genRot = dTex(dEl(n, step, 0));
      const genRef = dTex(dEl(n, j, 1));
      rawParts = [
        {
          prompt: `$D_{${n}}$ grubunun $D_{${m}}$ grubuna izomorfik toplam kaç alt grubu vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: dmCount },
          hints: [
            `Her $D_{${m}}$ alt grubu, benzersiz $m$-mertebeli dönme alt grubu $\\langle r^{${step}} \\rangle$ ile bir yansıma kosetinin birleşimidir.`,
          ],
          solution: [
            `Mertebesi $${m}$ olan tek dönme alt grubu $\\langle ${genRot} \\rangle$'dir. Yansıma indeksi $j \\bmod ${step}$ sınıfına göre ayrık $${step}$ farklı alt grup $\\langle ${genRot}, r^j s \\rangle \\cong D_{${m}}$ oluşur.`,
          ],
        },
        {
          prompt: `Bu ailedeki $H = \\langle ${genRot}, ${genRef} \\rangle \\cong D_{${m}}$ alt grubunun tüm $${2 * m}$ elemanını normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: dmSub },
          hints: [
            `$\\langle ${genRot} \\rangle$ dönme alt grubunu ve her dönmenin $${genRef}$ ile soldan çarpımlarını yazın.`,
          ],
          solution: [
            `Dönmeler: $${dSetTex(dRotSub(n, m))}$.`,
            `Yansımalar ($r^{t\\cdot ${step}} \\cdot ${genRef}$): $${dSetTex(dmSub.slice(m))}$.`,
            `Birleşim: $H = ${dSetTex(dmSub)}$.`,
          ],
        },
        {
          prompt: `$D_{${n}}$ grubunun toplam alt grup sayısı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: totalSubs },
          hints: [
            'Her bölen $d \\mid n$ için $1$ dönme alt grubu ve $n/d$ adet yansıma içeren alt grup toplanır.',
          ],
          solution: [
            `$\\tau(${n}) + \\sigma(${n}) = ${tau} + ${sigma} = ${totalSubs}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $D_n$ grubunda en az bir yansıma içeren her $H \\le D_n$ alt grubunun bir $d \\mid n$ böleni ve $0 \\le j < n/d$ için $H = \\langle r^{n/d}, r^j s \\rangle$ biçiminde olduğunu kanıtlayın; buradan $D_n$ alt grup sayısının $\\tau(n) + \\sigma(n)$ olduğunu çıkarın.',
          kind: 'proof',
          hints: [
            '$H \\cap \\langle r \\rangle$ dönme alt grubunun devirli olduğunu ($\\langle r^{n/d} \\rangle$) kullanın ve $H$ içindeki herhangi bir $r^j s$ yansımasıyla diğer tüm yansımaların çarpımına bakın.',
          ],
          solution: [
            '$R = H \\cap \\langle r \\rangle$, devirli $\\langle r \\rangle \\cong \\mathbb{Z}_n$ grubunun bir alt grubudur; dolayısıyla tek bir $d \\mid n$ için $R = \\langle r^{n/d} \\rangle$ ($|R| = d$).',
            '$H$ içinde en az bir yansıma $r^j s$ vardır. $H$ içindeki başka herhangi bir $r^k s$ yansıması için $(r^k s)(r^j s) = r^{k - j} \\in H \\cap \\langle r \\rangle = R$, yani $k \\equiv j \\pmod{n/d}$.',
            'Tersine her $r^{t(n/d)} \\in R$ için $r^{t(n/d)} (r^j s) = r^{j + t(n/d)} s \\in H$, dolayısıyla $H = R \\cup R(r^j s) = \\langle r^{n/d}, r^j s \\rangle$.',
            '$j$ yalnızca mod $n/d$ değerine bağlı olduğundan her $d \\mid n$ için $n/d$ farklı yansıma-içeren alt grup vardır; tüm $d \\mid n$ üzerinden toplam $\\sum (1 + n/d) = \\tau(n) + \\sigma(n)$ olur.',
          ],
          checklist: [
            '$H \\cap \\langle r \\rangle = \\langle r^{n/d} \\rangle$ biçimi devirli alt grup teoremiyle kuruldu.',
            'İki yansımanın çarpımı $(r^k s)(r^j s) = r^{k-j} \\in H \\cap \\langle r \\rangle$ üzerinden $k \\equiv j \\pmod{n/d}$ gösterildi.',
            '$j \\bmod (n/d)$ sayımı ile toplam $\\tau(n) + \\sigma(n)$ formülü elde edildi.',
          ],
        },
      ];
    }

    return {
      title: `Kristal Simetri Kırılması ve $D_{${n}}$ Alt Grup Kafesi`,
      story: `İki boyutlu bir kristalin $D_{${n}}$ nokta simetrisi dış bir alan veya gerinim altında kırıldığında kalan simetri grubu $D_{${n}}$'nin bir alt grubu olmak zorundadır. Alt grup kafesini kullanarak izinli simetri kırılmalarını sayalım.`,
      model: { id: 'sublattice', params: { kind: 'D', n } },
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 7. ps1-zn-mertebe-uretec — Cyclic groups Z_n: orders, generators, same-gcd
// =====================================================================

const T_ZN_MERTEBE_URETEC = {
  id: 'ps1-zn-mertebe-uretec',
  topic: 'Devirli Gruplar',
  title: 'Devirli Grup $\\mathbb{Z}_n$: Eleman Mertebeleri ve Üreteçler',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [6, 8, 9, 10, 12]
      : level === 'odev' ? [12, 14, 15, 16, 18, 20, 24]
      : [18, 20, 24, 28, 30];
    const n = rng.pick(nPool);
    const nonTrivKs = [];
    for (let x = 2; x < n; x++) {
      const g = gcd(x, n);
      if (level === 'isinma' ? true : (g > 1 && g < n)) nonTrivKs.push(x);
    }
    const k = rng.pick(nonTrivKs);
    const g = gcd(k, n);
    const ordK = n / g;
    const subK = Array.from({ length: ordK }, (_, i) => (i * g) % n).sort((a, b) => a - b);
    const gens = unitsOf(n);
    const sameSub = [];
    for (let x = 0; x < n; x++) if (gcd(x, n) === g) sameSub.push(x);

    const rawParts = [
      {
        prompt: `$\\mathbb{Z}_{${n}}$ grubunda $k = ${k}$ elemanının mertebesi $|${k}|$ kaçtır?`,
        kind: 'answer',
        answer: { type: 'int', value: ordK },
        hints: level === 'zorlayici'
          ? [`$|k| = n / \\gcd(k, n)$ formülünü uygulayın.`]
          : [
            `$\\mathbb{Z}_n$ toplamsal grubunda $|k|$, $m \\cdot k \\equiv 0 \\pmod{${n}}$ sağlayan en küçük pozitif $m$ tam sayısıdır.`,
            `Formül: $|k| = \\frac{n}{\\gcd(k, n)}$.`,
            `$\\gcd(${k}, ${n}) = ${g}$ olduğundan $|${k}| = ${n} / ${g}$.`,
          ],
        solution: [
          `$\\gcd(${k}, ${n}) = ${g}$.`,
          `$|${k}| = \\frac{${n}}{\\gcd(${k}, ${n})} = \\frac{${n}}{${g}} = ${ordK}$.`,
        ],
      },
    ];

    if (level === 'isinma') {
      rawParts.push(
        {
          prompt: `$k = ${k}$ elemanının ürettiği $\\langle ${k} \\rangle$ alt grubunun tüm elemanlarını yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: subK },
          hints: [
            `$0, ${k}, ${mod(2 * k, n)}, \\dots$ şeklinde mod $${n}$ eklemeye devam edin.`,
            `Toplam $|${k}| = ${ordK}$ eleman çıkacaktır; bunlar $\\gcd(${k}, ${n}) = ${g}$ sayısının mod $${n}$ katlarıdır.`,
            `Küme: $${intSetTex(subK)}$.`,
          ],
          solution: [
            `$\\langle ${k} \\rangle = \\langle \\gcd(${k}, ${n}) \\rangle = \\langle ${g} \\rangle = ${intSetTex(subK)}$.`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${n}}$ grubunun tüm **üreteçlerini** (tüm grubu üreten elemanları) listeleyin.`,
          kind: 'answer',
          answer: { type: 'intset', value: gens },
          hints: [
            'Bir $a \\in \\mathbb{Z}_n$ elemanı ancak ve ancak $|a| = n$, yani $\\gcd(a, n) = 1$ ise üreteçtir.',
            `$1$ ile $${n - 1}$ arasında $${n}$ ile aralarında asal olan tam sayıları seçin.`,
            `Toplam $\\varphi(${n}) = ${gens.length}$ üreteç vardır.`,
          ],
          solution: [
            `$\\gcd(a, ${n}) = 1$ koşulunu sağlayan elemanlar: $${intSetTex(gens)}$ (toplam $\\varphi(${n}) = ${gens.length}$ üreteç).`,
          ],
        }
      );
    } else if (level === 'odev') {
      rawParts.push(
        {
          prompt: `$\\mathbb{Z}_{${n}}$ içinde $k = ${k}$ ile **tam olarak aynı alt grubu** üreten ($\\langle x \\rangle = \\langle ${k} \\rangle$) tüm $x$ elemanlarını listeleyin.`,
          kind: 'answer',
          answer: { type: 'intset', value: sameSub },
          hints: [
            '$\\langle x \\rangle = \\langle k \\rangle \\iff \\gcd(x, n) = \\gcd(k, n)$ teoremini kullanın.',
            `$\\gcd(${k}, ${n}) = ${g}$ olduğundan $x = ${g} \\cdot t$ ($1 \\le t < ${ordK}$ ve $\\gcd(t, ${ordK}) = 1$) biçimindeki elemanları bulun.`,
          ],
          solution: [
            `$\\gcd(x, ${n}) = \\gcd(${k}, ${n}) = ${g}$ koşulunu sağlayan elemanlar $${g}$'nin katları arasından bölümün $${ordK}$ ile aralarında asal olduklarıdır.`,
            `Aynı alt grubu üreten elemanlar: $${intSetTex(sameSub)}$ (toplam $\\varphi(${ordK}) = ${sameSub.length}$ adet).`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${n}}$ grubunun toplam kaç üreteci vardır ($\\varphi(${n})$)?`,
          kind: 'answer',
          answer: { type: 'int', value: gens.length },
          hints: [
            `Euler totient fonksiyonu $\\varphi(n) = n \\prod_{p \\mid n} (1 - 1/p)$ formülünü uygulayın.`,
            `$${n}$ sayısının asal çarpanları: $${intSetTex(distinctPrimes(n))}$.`,
          ],
          solution: [
            `$${n}$ asal çarpanları $${intSetTex(distinctPrimes(n))}$ olup $\\varphi(${n}) = ${gens.length}$.`,
            `Üreteçler: $${intSetTex(gens)}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\mathbb{Z}_n$ grubunda her $k$ için $|k| = n / \\gcd(k, n)$ olduğunu ve $\\langle a \\rangle = \\langle b \\rangle \\iff \\gcd(a, n) = \\gcd(b, n)$ denkliğini kanıtlayın.',
          kind: 'proof',
          hints: [
            '$m k \\equiv 0 \\pmod n$ denkliğini $g = \\gcd(k, n)$ ile sadeleştirip $(n/g) \\mid m$ elde edin.',
            'İkinci kısım için Bézout özdeşliğinden $\\langle a \\rangle = \\langle \\gcd(a, n) \\rangle$ olduğunu gösterin.',
          ],
          solution: [
            '$g = \\gcd(k, n)$ olsun; $k = g k_1$ ve $n = g n_1$ ($\\gcd(k_1, n_1) = 1$). $mk \\equiv 0 \\pmod n \\iff n_1 \\mid m k_1 \\iff n_1 \\mid m$. En küçük pozitif çözüm $m = n_1 = n/g$.',
            'Bézout özdeşliğine göre $g = ua + vn$ olduğundan $g \\equiv ua \\pmod n \\in \\langle a \\rangle$, yani $\\langle g \\rangle \\subseteq \\langle a \\rangle$. Öte yandan $g \\mid a$ olduğundan $a \\in \\langle g \\rangle$, yani $\\langle a \\rangle = \\langle g \\rangle$.',
            'Her $d \\mid n$ için $|\\langle d \\rangle| = n/d$ farklı olduğundan $\\langle a \\rangle = \\langle b \\rangle \\iff \\langle \\gcd(a,n) \\rangle = \\langle \\gcd(b,n) \\rangle \\iff \\gcd(a, n) = \\gcd(b, n)$.',
          ],
          checklist: [
            '$g = \\gcd(k, n)$ ile bölerek $m \\cdot (k/g) \\equiv 0 \\pmod{n/g}$ üzerinden $|k| = n/g$ kanıtlandı.',
            'Bézout özdeşliğiyle $\\langle a \\rangle = \\langle \\gcd(a, n) \\rangle$ gösterildi.',
            'Alt grup mertebelerinin tekliğinden $\\langle a \\rangle = \\langle b \\rangle \\iff \\gcd(a,n) = \\gcd(b,n)$ sonuçlandırıldı.',
          ],
        }
      );
    } else {
      const targetDivs = divisors(n).filter(d => d > 2 && d < n && eulerPhi(d) <= 8);
      const d = rng.pick(targetDivs);
      const exactD = [];
      for (let x = 0; x < n; x++) if (n / gcd(x, n) === d) exactD.push(x);
      const phiTerms = divisors(n).map(dv => `\\varphi(${dv}) = ${eulerPhi(dv)}`);
      rawParts.push(
        {
          prompt: `$\\mathbb{Z}_{${n}}$ içinde mertebesi tam $${d}$ olan tüm elemanları küme olarak yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: exactD },
          hints: [
            `$|x| = ${d} \\iff \\gcd(x, ${n}) = ${n} / ${d} = ${n / d}$ koşulunu sağlayan $x \\in \\{0, \\dots, ${n - 1}\\}$ elemanlarını bulun.`,
          ],
          solution: [
            `$|x| = ${d} \\iff \\gcd(x, ${n}) = ${n / d}$.`,
            `Bu koşulu sağlayan elemanlar: $${intSetTex(exactD)}$ (toplam $\\varphi(${d}) = ${exactD.length}$ adet).`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${n}}$ grubunun toplam kaç üreteci vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: gens.length },
          hints: [
            `$\\varphi(${n})$ değerini asal çarpan ayrışımından hesaplayın.`,
          ],
          solution: [
            `$\\varphi(${n}) = ${gens.length}$.`,
          ],
        },
        {
          prompt: `**Kanıt:** $\\mathbb{Z}_n$ elemanlarını mertebelerine göre ayrık sınıflara bölerek $\\sum_{d \\mid n} \\varphi(d) = n$ özdeşliğini kanıtlayın ve $n = ${n}$ için sayısal olarak doğrulayın.`,
          kind: 'proof',
          hints: [
            'Her $d \\mid n$ için mertebesi $d$ olan elemanların tek bir $d$-mertebeli alt grubun üreteçleri olduğunu ve sayılarının $\\varphi(d)$ olduğunu gösterin.',
          ],
          solution: [
            'Her $x \\in \\mathbb{Z}_n$ elemanının mertebesi $d = n/\\gcd(x, n)$ bir $n$ bölenidir; dolayısıyla $\\mathbb{Z}_n = \\bigsqcup_{d \\mid n} \\{x : |x| = d\\}$.',
            'Her $d \\mid n$ için $|x| = d \\iff \\gcd(x, n) = n/d \\iff x = (n/d)\\cdot t$ ($1 \\le t \\le d$, $\\gcd(t, d) = 1$), yani tam $\\varphi(d)$ eleman vardır.',
            `Sınıfların boyutları toplamı: $\\sum_{d \\mid n} \\varphi(d) = n$. $n = ${n}$ için: ${phiTerms.map(s => `$${s}$`).join(', ')} ve toplamları $${divisors(n).map(eulerPhi).join(' + ')} = ${n}$.`,
          ],
          checklist: [
            '$\\mathbb{Z}_n$ elemanlarının mertebeye göre ayrık sınıflara bölündüğü yazıldı.',
            'Mertebesi $d$ olan eleman sayısının $\\varphi(d)$ olduğu kanıtlandı.',
            `$n = ${n}$ için bölenlerin $\\varphi(d)$ toplamının $${n}$ ettiği sayısal olarak doğrulandı.`,
          ],
        }
      );
    }

    return {
      title: `Halka Kafeste Periyodik Sıçramalar ($\\mathbb{Z}_{${n}}$)`,
      story: `Bir çember üzerine eşit aralıklarla dizilmiş $${n}$ özdeş kuantum noktasında bir uyarım her adımda saat yönünün tersine $+${k} \\pmod{${n}}$ konum ileri atlıyor. Sistemin ziyaret ettiği alt kafes ve tam tur üreteçleri $\\mathbb{Z}_{${n}}$ devirli grubunun yapısıyla belirlenir.`,
      model: { id: 'cyclic', params: { n, k } },
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 8. ps1-zn-altgrup-kafesi — Subgroup lattice of Z_n (divisors, meet/join)
// =====================================================================

const T_ZN_ALTGRUP_KAFESI = {
  id: 'ps1-zn-altgrup-kafesi',
  topic: 'Devirli Gruplar',
  title: '$\\mathbb{Z}_n$ Alt Grup Kafesi, Kesişim ve Birleşim',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [6, 8, 9, 10, 12]
      : level === 'odev' ? [12, 16, 18, 20, 24, 30]
      : [12, 18, 20, 24, 28, 30];
    const n = rng.pick(nPool);
    const divs = divisors(n);
    const tau = divs.length;

    const rawParts = [
      {
        prompt: `$\\mathbb{Z}_{${n}}$ devirli grubunun toplam kaç alt grubu vardır? ($\\{0\\}$ ve $\\mathbb{Z}_{${n}}$ dahil.)`,
        kind: 'answer',
        answer: { type: 'int', value: tau },
        hints: level === 'zorlayici'
          ? [`Devirli grupların temel teoremine göre her pozitif $d \\mid ${n}$ böleni için tam bir alt grup vardır.`]
          : [
            'Devirli $\\mathbb{Z}_n$ grubunda her $d \\mid n$ bölenine karşılık **benzersiz** bir $d$ mertebeli alt grup bulunur.',
            `$${n}$ sayısının pozitif bölenlerini listeleyin.`,
            `Bölenler: $${intSetTex(divs)}$, toplam $${tau}$ adet.`,
          ],
        solution: [
          `$${n}$ sayısının pozitif bölenleri $${intSetTex(divs)}$ olduğundan $\\mathbb{Z}_{${n}}$ grubunun tam **$${tau}$** alt grubu vardır.`,
        ],
      },
    ];

    if (level === 'isinma') {
      const smallDivs = divs.filter(d => d >= 2 && d <= 6 && d < n);
      const d = rng.pick(smallDivs);
      const step = n / d;
      const subD = Array.from({ length: d }, (_, i) => i * step);
      rawParts.push(
        {
          prompt: `$\\mathbb{Z}_{${n}}$ alt gruplarının alabileceği tüm olası mertebeleri küme olarak yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: divs },
          hints: [
            `Lagrange teoremi ve devirli grup yapısı gereği bu küme tam olarak $${n}$ sayısının pozitif bölenleridir.`,
            `1'den $${n}$'ye kadar $${n}$'yi kalansız bölen tüm tam sayıları yazın.`,
            `Toplam $${tau}$ sayı olacak.`,
          ],
          solution: [
            `Her $d \\mid ${n}$ için $\\langle ${n}/d \\rangle$ mertebesi $d$ olan tek alt gruptur; olası mertebeler $${intSetTex(divs)}$.`,
          ],
        },
        {
          prompt: `$\\mathbb{Z}_{${n}}$ grubunun mertebesi $${d}$ olan tek alt grubunun tüm elemanlarını yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: subD },
          hints: [
            `Mertebesi $d$ olan tek alt grup $\\langle n/d \\rangle$ alt grubudur.`,
            `$n / d = ${n} / ${d} = ${step}$ sayısının mod $${n}$ katlarını yazın.`,
            `Elemanlar: $${intSetTex(subD)}$.`,
          ],
          solution: [
            `Mertebesi $${d}$ olan tek alt grup $\\langle ${step} \\rangle = ${intSetTex(subD)}$.`,
          ],
        }
      );
    } else {
      // Pick two distinct proper non-trivial generators a, b generating distinct subgroups
      const properDivs = divs.filter(d => d > 1 && d < n);
      const g1 = rng.pick(properDivs);
      const g2 = rng.pick(properDivs.filter(x => x !== g1));
      // Pick representative multiples with exact gcd g1, g2
      const aCands = Array.from({ length: n - 1 }, (_, i) => i + 1).filter(x => gcd(x, n) === g1);
      const bCands = Array.from({ length: n - 1 }, (_, i) => i + 1).filter(x => gcd(x, n) === g2);
      const a = rng.pick(aCands), b = rng.pick(bCands);
      const ordA = n / g1, ordB = n / g2;
      const interOrd = gcd(ordA, ordB);
      const joinOrd = lcm(ordA, ordB);

      if (level === 'odev') {
        const smallDivs = divs.filter(d => d >= 2 && d <= 6 && d < n);
        const d = rng.pick(smallDivs);
        const step = n / d;
        const subD = Array.from({ length: d }, (_, i) => i * step);
        rawParts.push(
          {
            prompt: `$\\mathbb{Z}_{${n}}$ içinde mertebesi $${d}$ olan tek alt grubun elemanlarını yazın.`,
            kind: 'answer',
            answer: { type: 'intset', value: subD },
            hints: [
              `Mertebesi $${d}$ olan alt grup $\\langle ${n}/${d} \\rangle = \\langle ${step} \\rangle$ alt grubudur.`,
              `$${step}$'nin $${n}$'den küçük negatif olmayan tüm katlarını listeleyin.`,
            ],
            solution: [
              `$\\langle ${n}/${d} \\rangle = \\langle ${step} \\rangle = ${intSetTex(subD)}$.`,
            ],
          },
          {
            prompt: `$\\langle ${a} \\rangle \\cap \\langle ${b} \\rangle$ kesişim alt grubunun mertebesi kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: interOrd },
            hints: [
              `Önce $|\\langle ${a} \\rangle| = ${ordA}$ ve $|\\langle ${b} \\rangle| = ${ordB}$ mertebelerini bulun.`,
              '$\\mathbb{Z}_n$ içinde iki alt grubun kesişiminin mertebesi, mertebelerinin EBOB değeridir: $|H \\cap K| = \\gcd(|H|, |K|)$.',
            ],
            solution: [
              `$\\langle ${a} \\rangle = \\langle ${g1} \\rangle$ (mertebe $${ordA}$) ve $\\langle ${b} \\rangle = \\langle ${g2} \\rangle$ (mertebe $${ordB}$).`,
              `Kesişim hem $${g1}$'in hem $${g2}$'nin katlarından oluşur: $\\langle \\operatorname{ekok}(${g1}, ${g2}) \\rangle = \\langle ${lcm(g1, g2)} \\rangle$, mertebesi $${n}/${lcm(g1, g2)} = \\gcd(${ordA}, ${ordB}) = ${interOrd}$.`,
            ],
          },
          {
            prompt: `$\\langle ${a} \\rangle$ ve $\\langle ${b} \\rangle$ alt gruplarının ikisini birden içeren en küçük alt grup $\\langle ${a}, ${b} \\rangle$'nin mertebesi kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: joinOrd },
            hints: [
              '$\\langle a, b \\rangle = \\langle \\gcd(a, b, n) \\rangle$ olur.',
              `Mertebesi $\\operatorname{ekok}(|\\langle ${a} \\rangle|, |\\langle ${b} \\rangle|) = \\operatorname{ekok}(${ordA}, ${ordB})$.`,
            ],
            solution: [
              `$\\langle ${a}, ${b} \\rangle = \\langle \\gcd(${g1}, ${g2}) \\rangle = \\langle ${gcd(g1, g2)} \\rangle$.`,
              `Mertebesi $${n} / ${gcd(g1, g2)} = \\operatorname{ekok}(${ordA}, ${ordB}) = ${joinOrd}$.`,
            ],
          }
        );
      } else {
        const primes = distinctPrimes(n);
        rawParts.push(
          {
            prompt: `$\\langle ${a} \\rangle \\cap \\langle ${b} \\rangle$ kesişim alt grubunun mertebesi kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: interOrd },
            hints: [
              `$|\\langle a \\rangle \\cap \\langle b \\rangle| = \\gcd(|\\langle a \\rangle|, |\\langle b \\rangle|)$.`,
            ],
            solution: [
              `$|\\langle ${a} \\rangle| = ${ordA}$, $|\\langle ${b} \\rangle| = ${ordB} \\implies |\\langle ${a} \\rangle \\cap \\langle ${b} \\rangle| = \\gcd(${ordA}, ${ordB}) = ${interOrd}$.`,
            ],
          },
          {
            prompt: `$\\mathbb{Z}_{${n}}$ grubunun kaç tane **maksimal öz alt grubu** vardır? (Kendisi hariç, arada başka öz alt grup olmadan $\\mathbb{Z}_{${n}}$'nin hemen altında yer alan alt gruplar.)`,
            kind: 'answer',
            answer: { type: 'int', value: primes.length },
            hints: [
              'Kafeste $\\mathbb{Z}_n$' + "'nin hemen altındaki mertebeler $n/p$ ($p$ asal, $p \\mid n$) biçimindedir.",
            ],
            solution: [
              `$\\langle d \\rangle \\subsetneq \\mathbb{Z}_{${n}}$ maksimaldir $\\iff d$ bir asal sayıdır ($d \\mid ${n}$).`,
              `$${n}$ sayısının farklı asal bölenleri $${intSetTex(primes)}$ olduğundan tam **$${primes.length}$** maksimal öz alt grup vardır (${primes.map(p => `$\\langle ${p} \\rangle$`).join(', ')}).`,
            ],
          },
          {
            prompt: '**Kanıt:** Devirli grupların temel teoremini kanıtlayın: $\\mathbb{Z}_n$ grubunun her $H$ alt grubu devirlidir, her $d \\mid n$ böleni için mertebesi $d$ olan benzersiz bir alt grup ($\\langle n/d \\rangle$) vardır ve $\\langle d_1 \\rangle \\subseteq \\langle d_2 \\rangle \\iff d_2 \\mid d_1$ ($d_1, d_2 \\mid n$).',
            kind: 'proof',
            hints: [
              'Öklid bölme algoritmasıyla $H \\setminus \\{0\\}$ içindeki en küçük pozitif $m$ elemanının tüm $H$' + "'yi ürettiğini gösterin.",
            ],
            solution: [
              '$H = \\{0\\}$ aşikar devirlidir. $H \\neq \\{0\\}$ ise $H \\cap \\{1, \\dots, n-1\\}$ içindeki en küçük $m$ elemanını alalım. Her $x \\in H$ için $x = qm + r$ ($0 \\le r < m$) yazıldığında $r = x - qm \\in H$; minimallikten $r = 0$, yani $H = \\langle m \\rangle$.',
              'Benzer biçimde $n = qm + r$ ($0 \\le r < m$) yazıldığında $r \\equiv -qm \\in H \\implies r = 0$, yani $m \\mid n$ ve $|H| = n/m$.',
              'Dolayısıyla $d \\mid n$ mertebesine sahip tek olası $m$ değeri $m = n/d$ olup $\\langle n/d \\rangle$ benzersizdir.',
              '$d_1, d_2 \\mid n$ için $\\langle d_1 \\rangle \\subseteq \\langle d_2 \\rangle \\iff d_1 \\in \\langle d_2 \\rangle \\iff d_2 \\mid d_1$.',
            ],
            checklist: [
              '$H \\neq \\{0\\}$ içindeki en küçük pozitif $m$ elemanı ve Öklid bölme algoritmasıyla $H = \\langle m \\rangle$ gösterildi.',
              '$m \\mid n$ olduğu ve $d \\mid n$ için $m = n/d$ benzersizliği kanıtlandı.',
              '$\\langle d_1 \\rangle \\subseteq \\langle d_2 \\rangle \\iff d_2 \\mid d_1$ kapsam tersliği gösterildi.',
            ],
          }
        );
      }
    }

    return {
      title: `Ortak Periyotlu Üst Kafesler ve $\\mathbb{Z}_{${n}}$ Alt Grup Kafesi`,
      story: `$${n}$ atomluk periyodik bir halka kristalinde eş-periyotlu (commensurate) alt kafesler $\\mathbb{Z}_{${n}}$ grubunun alt gruplarına karşılık gelir. Bölen kafesi üzerinden bu alt kafeslerin hiyerarşisini analiz edelim.`,
      model: { id: 'sublattice', params: { kind: 'Z', n } },
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 9. ps1-dn-kosetler — Left & right cosets in D_n, normality, central r^(n/2)
// =====================================================================

const T_DN_KOSETLER = {
  id: 'ps1-dn-kosetler',
  topic: 'Kosetler ve Lagrange',
  title: '$D_n$ İçinde Sol ve Sağ Kosetler, Normallik',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    let n, H, Hdesc, Hkind;
    if (level === 'isinma') {
      const choices = [
        () => ({ n: 3, H: [dEl(3, 0, 0), dEl(3, 0, 1)], Hdesc: '\\langle s \\rangle = \\{e, s\\}', Hkind: 'refl' }),
        () => ({ n: 4, H: [dEl(4, 0, 0), dEl(4, 0, 1)], Hdesc: '\\langle s \\rangle = \\{e, s\\}', Hkind: 'refl' }),
        () => ({ n: 5, H: [dEl(5, 0, 0), dEl(5, 0, 1)], Hdesc: '\\langle s \\rangle = \\{e, s\\}', Hkind: 'refl' }),
        () => ({ n: 4, H: dRotSub(4, 2), Hdesc: '\\langle r^2 \\rangle = \\{e, r^2\\}', Hkind: 'rot' }),
        () => ({ n: 6, H: dRotSub(6, 3), Hdesc: '\\langle r^2 \\rangle = \\{e, r^2, r^4\\}', Hkind: 'rot' }),
        () => ({ n: 3, H: dRotSub(3, 3), Hdesc: '\\langle r \\rangle = \\{e, r, r^2\\}', Hkind: 'rotAll' }),
        () => ({ n: 4, H: dRotSub(4, 4), Hdesc: '\\langle r \\rangle = \\{e, r, r^2, r^3\\}', Hkind: 'rotAll' }),
      ];
      ({ n, H, Hdesc, Hkind } = rng.pick(choices)());
    } else if (level === 'odev') {
      const choices = [
        () => { const m = rng.pick([4, 6, 8]); const j = rng.int(0, m - 1); const sEl = dEl(m, j, 1); return { n: m, H: [dEl(m, 0, 0), sEl], Hdesc: `\\langle ${dTex(sEl)} \\rangle = \\{e, ${dTex(sEl)}\\}`, Hkind: 'reflEven' }; },
        () => { const m = rng.pick([3, 5]); const j = rng.int(0, m - 1); const sEl = dEl(m, j, 1); return { n: m, H: [dEl(m, 0, 0), sEl], Hdesc: `\\langle ${dTex(sEl)} \\rangle = \\{e, ${dTex(sEl)}\\}`, Hkind: 'reflOdd' }; },
        () => { const m = rng.pick([4, 6, 8]); return { n: m, H: dRotSub(m, m / 2), Hdesc: `\\langle r^2 \\rangle = ${dSetTex(dRotSub(m, m / 2))}`, Hkind: 'rot' }; },
        () => { const m = rng.pick([3, 4]); return { n: m, H: dRotSub(m, m), Hdesc: `\\langle r \\rangle = ${dSetTex(dRotSub(m, m))}`, Hkind: 'rotAll' }; },
      ];
      ({ n, H, Hdesc, Hkind } = rng.pick(choices)());
    } else {
      const choices = [
        () => { const m = rng.pick([4, 6, 8]); const j = rng.int(0, m - 1); const sEl = dEl(m, j, 1); return { n: m, H: [dEl(m, 0, 0), sEl], Hdesc: `\\langle ${dTex(sEl)} \\rangle = \\{e, ${dTex(sEl)}\\}`, Hkind: 'reflEven' }; },
        () => { const m = rng.pick([6, 8]); const j = rng.int(0, m / 2 - 1); const sEl = dEl(m, j, 1); const sub = dDihSub(m, 2, j); return { n: m, H: sub, Hdesc: `\\langle r^{${m / 2}}, ${dTex(sEl)} \\rangle = ${dSetTex(sub)}`, Hkind: 'd2' }; },
        () => { const m = rng.pick([6, 8]); return { n: m, H: dRotSub(m, m / 2), Hdesc: `\\langle r^2 \\rangle = ${dSetTex(dRotSub(m, m / 2))}`, Hkind: 'rot' }; },
      ];
      ({ n, H, Hdesc, Hkind } = rng.pick(choices)());
    }

    const Hkeys = new Set(H.map(dKey));
    const outside = dAll(n).filter(x => !Hkeys.has(dKey(x)));
    // For non-normal subgroups, prefer picking a g where gH != Hg on ~70% of seeds, and occasionally r^(n/2)
    const diffGs = outside.filter(g => !dSetEq(dCosetLeft(n, g, H), dCosetRight(n, H, g)));
    const sameGs = outside.filter(g => dSetEq(dCosetLeft(n, g, H), dCosetRight(n, H, g)));
    const g = (diffGs.length && (sameGs.length === 0 || rng.int(0, 2) > 0)) ? rng.pick(diffGs) : rng.pick(outside);

    const gH = dCosetLeft(n, g, H);
    const Hg = dCosetRight(n, H, g);
    const eqThis = dSetEq(gH, Hg);
    const matchInfo = dCosetsMatchingRight(n, H);
    const normal = matchInfo.count === matchInfo.total;
    const indexVal = (2 * n) / H.length;

    const rawParts = [
      {
        prompt: `$H = ${Hdesc}$ alt grubunun $D_{${n}}$ içindeki indeksi $[D_{${n}} : H]$ (farklı sol koset sayısı) kaçtır?`,
        kind: 'answer',
        answer: { type: 'int', value: indexVal },
        hints: level === 'zorlayici'
          ? ['Lagrange teoremini uygulayın: $[G : H] = |G| / |H|$.']
          : [
            `Lagrange teoremine göre $[D_{${n}} : H] = |D_{${n}}| / |H|$.`,
            `$|D_{${n}}| = ${2 * n}$ ve $|H| = ${H.length}$.`,
            `$${2 * n} / ${H.length} = ${indexVal}$.`,
          ],
        solution: [
          `$[D_{${n}} : H] = \\frac{|D_{${n}}|}{|H|} = \\frac{${2 * n}}{${H.length}} = ${indexVal}$.`,
        ],
      },
      {
        prompt: `$g = ${dTex(g)}$ elemanı için **sol koset** $gH = ${dTex(g)} H$ kümesini normal biçimde yazın.`,
        kind: 'answer',
        answer: { type: 'dset', n, value: gH },
        hints: level === 'zorlayici'
          ? [`Her $h \\in H$ için soldan $${dTex(g)} \\cdot h$ çarpımlarını normal biçime getirin.`]
          : [
            `Sol koset tanımı: $gH = \\{ g \\cdot h : h \\in H \\}$ (sağdan sola çarpım!).`,
            `$H$ içindeki her elemanı soldan $${dTex(g)}$ ile çarpın.`,
            `İlk iki çarpım: ${H.slice(0, 2).map(h => `$${dTex(g)} \\cdot ${dTex(h)} = ${dTex(dMul(n, g, h))}$`).join(', ')}.`,
          ],
        solution: [
          `Çarpımlar: ${H.map(h => `$${dTex(g)} \\cdot ${dTex(h)} = ${dTex(dMul(n, g, h))}$`).join(', ')}.`,
          `Sol koset: $${dTex(g)} H = ${dSetTex(gH)}$.`,
        ],
      },
    ];

    if (level === 'isinma') {
      rawParts.push(
        {
          prompt: `Aynı $g = ${dTex(g)}$ için **sağ koset** $Hg = H ${dTex(g)}$ kümesini normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: Hg },
          hints: [
            `Sağ koset tanımı: $Hg = \\{ h \\cdot g : h \\in H \\}$.`,
            `$H$ elemanlarını sağdan $${dTex(g)}$ ile çarpın ($s r^k = r^{-k} s$ kuralına dikkat!).`,
            `İlk iki çarpım: ${H.slice(0, 2).map(h => `$${dTex(h)} \\cdot ${dTex(g)} = ${dTex(dMul(n, h, g))}$`).join(', ')}.`,
          ],
          solution: [
            `Çarpımlar: ${H.map(h => `$${dTex(h)} \\cdot ${dTex(g)} = ${dTex(dMul(n, h, g))}$`).join(', ')}.`,
            `Sağ koset: $H ${dTex(g)} = ${dSetTex(Hg)}$.`,
          ],
        },
        {
          prompt: `Bu $g = ${dTex(g)}$ elemanı için $gH = Hg$ eşitliği sağlanır mı?`,
          kind: 'answer',
          answer: { type: 'yesno', value: eqThis },
          hints: [
            'Bir önceki iki şıkta bulduğunuz kümeleri eleman eleman karşılaştırın.',
            `$gH = ${dSetTex(gH)}$ ile $Hg = ${dSetTex(Hg)}$ aynı elemanları mı içeriyor?`,
            eqThis ? 'İki küme tıpatıp aynı elemanlardan oluşuyor.' : 'En az bir eleman iki kümede farklıdır.',
          ],
          solution: [
            `$${dTex(g)} H = ${dSetTex(gH)}$ ve $H ${dTex(g)} = ${dSetTex(Hg)}$ olduğundan cevap **${eqThis ? 'Evet' : 'Hayır'}**.`,
          ],
        }
      );
    } else {
      const matchingTex = matchInfo.matching.map(m => `$${dSetTex(m.elems)}$`).join(', ');
      rawParts.push(
        {
          prompt: `$H$ alt grubunun $D_{${n}}$ içindeki $${indexVal}$ adet sol kosetinden kaç tanesi **aynı zamanda bir sağ kosettir**?`,
          kind: 'answer',
          answer: { type: 'int', value: matchInfo.count },
          hints: level === 'zorlayici'
            ? ['Bir sol koset $gH$ ancak ve ancak $gH = Hg$ (yani $g \\in N_{D_n}(H)$) ise bir sağ kosettir.']
            : [
              'Bir $gH$ sol kosetinin bir $Hx$ sağ kosetine eşit olması için $g \\in Hx \\implies Hx = Hg$, yani $gH = Hg$ gerekir.',
              normal
                ? '$H$ normal bir alt grup olduğundan her $g \\in D_n$ için $gH = Hg$ sağlanır.'
                : n % 2 === 0
                  ? `$n = ${n}$ çift olduğundan $r^{${n / 2}}$ elemanı $D_{${n}}$'nin merkezindedir (her elemanla değişmelidir); bu yüzden $r^{${n / 2}} H = H r^{${n / 2}}$ olur!`
                  : `$n = ${n}$ tek olduğundan $D_{${n}}$ merkezi aşikardır ($\\{e\\}$); yalnızca $H$ kendisiyle çakışır mı kontrol edin.`,
            ],
          solution: [
            `Bir sol koset $gH$ aynı zamanda sağ kosettir $\\iff gH = Hg$.`,
            `Bu koşulu sağlayan kosetler (${matchInfo.count} adet): ${matchingTex}.`,
          ],
        },
        {
          prompt: `$H = ${Hdesc}$ alt grubu $D_{${n}}$ içinde **normal** ($H \\trianglelefteq D_{${n}}$) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: normal },
          hints: [
            '$H \\trianglelefteq G \\iff$ tüm sol kosetler sağ kosetlerle çakışır ($[G:H]$ sayısının tamamı).',
          ],
          solution: [
            normal
              ? `Tüm $${indexVal}$ sol koset aynı zamanda sağ koset olduğundan $H \\trianglelefteq D_{${n}}$ (**Evet**).`
              : `$${indexVal}$ sol kosetten yalnızca $${matchInfo.count}$ tanesi sağ koset olduğundan (örneğin $${dTex(g)} H = ${dSetTex(gH)} \\neq ${dSetTex(Hg)} = H ${dTex(g)}$) normal değildir (**Hayır**).`,
          ],
        }
      );

      if (level === 'odev') {
        rawParts.push({
          prompt: normal
            ? `**Kanıt:** Her $d \\mid n$ için saf dönme alt grubu $R = \\langle r^d \\rangle$'nin $D_n$ içinde normal ($R \\trianglelefteq D_n$) olduğunu eşlenik alma ($g R g^{-1} = R$) yoluyla kanıtlayın.`
            : `**Kanıt:** $n$ çift olduğunda $r^{n/2}$ elemanının $D_n$'nin merkezinde yer aldığını ($g r^{n/2} = r^{n/2} g$, $\\forall g \\in D_n$) ve bu yüzden $H = \\langle s \\rangle$ için $r^{n/2} H = H r^{n/2}$ olduğunu (fakat $n \\ge 3$ için $H \\ntrianglelefteq D_n$ olduğunu) gösterin.`,
          kind: 'proof',
          hints: [
            normal
              ? 'Üreteç $r^d$' + "'nin $r$ ve $s$ ile eşleniklerini hesaplayın: $r r^d r^{-1}$ ve $s r^d s^{-1}$."
              : '$s r^{n/2} = r^{-n/2} s$ eşitliğinde $-n/2 \\equiv n/2 \\pmod n$ özdeşliğini kullanın; sonra $r H$ ve $H r$ kosetlerini karşılaştırın.',
          ],
          solution: normal
            ? [
              '$r$ kuvvetleri kendi aralarında değişmeli olduğundan her $r^k$ için $r^k r^m r^{-k} = r^m \\in R$.',
              'Yansıma için $(r^k s) r^m (r^k s)^{-1} = r^k (s r^m s) r^{-k} = r^k r^{-m} r^{-k} = r^{-m} \\in R$.',
              'Dolayısıyla her $g \\in D_n$ için $g R g^{-1} = R$, yani $R \\trianglelefteq D_n$.',
            ]
            : [
              '$r^{n/2}$ tüm dönmelerle değişmelidir. Yansımalarla: $s r^{n/2} = r^{-n/2} s = r^{n/2} s$ (çünkü $-n/2 \\equiv n/2 \\pmod n$).',
              'Dolayısıyla $r^{n/2} \\in Z(D_n)$ ve herhangi bir $H \\le D_n$ için $r^{n/2} H = H r^{n/2}$ sağlanır.',
              'Ancak $n \\ge 3$ için $r H = \\{r, rs\\}$ iken $H r = \\{r, sr\\} = \\{r, r^{n-1}s\\}$; $n \\ge 3 \\implies 1 \\not\\equiv n-1 \\pmod n$ olduğundan $rH \\neq Hr$, yani $H$ normal değildir.',
            ],
          checklist: normal
            ? [
              'Dönmelerle eşlenik altında $R$' + "'nin sabit kaldığı gösterildi.",
              'Yansımalarla eşlenik altında $s r^m s = r^{-m} \\in R$ gösterildi.',
              'Her $g \\in D_n$ için $g R g^{-1} = R$ sonucu bağlandı.',
            ]
            : [
              '$-n/2 \\equiv n/2 \\pmod n$ ile $s r^{n/2} = r^{n/2} s$ ve $r^{n/2} \\in Z(D_n)$ kanıtlandı.',
              'Merkezdeki eleman için $r^{n/2} H = H r^{n/2}$ çıkarıldı.',
              '$rH \\neq Hr$ ($n \\ge 3$) gösterilerek $H$' + "'nin normal olmadığı ispatlandı.",
            ],
        });
      } else {
        rawParts.push({
          prompt: '**Kanıt:** Herhangi bir $G$ grubunda $H \\le G$ için bir $gH$ sol kosetinin aynı zamanda bir sağ koset olmasının $g H g^{-1} = H$ ($g \\in N_G(H)$) koşuluna denk olduğunu kanıtlayın; ayrıca $D_n$ merkezinin $n$ çiftken $\\{e, r^{n/2}\\}$, $n$ tekken $\\{e\\}$ olduğunu ispatlayın.',
          kind: 'proof',
          hints: [
            '$gH = Hx$ ise $g = ge \\in Hx$ olduğundan $Hx = Hg$ olmak zorundadır.',
            'Merkez için $z \\in Z(D_n)$ elemanının hem $r$ hem $s$ ile değişmeli olma koşullarını çözün.',
          ],
          solution: [
            `**Koset denkliği:** $gH = Hx$ varsayalım. $g = ge \\in gH = Hx$ ve sağ kosetler ayrık olduğundan $g$'yi içeren tek sağ koset $Hg$'dir; yani $Hx = Hg$ ve $gH = Hg \\iff gHg^{-1} = H$.`,
            '**Merkez $Z(D_n)$:** Bir yansıma $r^k s$ için $(r^k s) r = r^{k-1} s$ iken $r(r^k s) = r^{k+1} s$; $n \\ge 3$ için $k-1 \\not\\equiv k+1 \\pmod n$ olduğundan hiçbir yansıma merkezde değildir.',
            'Dönme $r^k$ için $s r^k = r^k s \\iff r^{-k} s = r^k s \\iff 2k \\equiv 0 \\pmod n$. $n$ tekse tek çözüm $k = 0$ ($Z = \\{e\\}$); $n$ çiftse çözümler $k = 0, n/2$ ($Z = \\{e, r^{n/2}\\}$).',
          ],
          checklist: [
            '$g \\in gH = Hx \\implies Hx = Hg \\iff gHg^{-1} = H$ kanıtlandı.',
            'Hiçbir yansımanın $n \\ge 3$ için $r$ ile değişmeli olmadığı gösterildi.',
            '$2k \\equiv 0 \\pmod n$ denkliğinden $n$ çift/tek durumları için $Z(D_n)$ bulundu.',
          ],
        });
      }
    }

    return {
      title: `$D_{${n}}$ Grubunda Koset Ayrışımı ve Normallik`,
      story: `Düzgün $${n}$-gen simetrisine sahip bir molekülde belirli bir bağı sabit tutan simetriler $H = ${Hdesc} \\le D_{${n}}$ alt grubunu oluşturuyor. Tüm simetrileri $H$ modülo sol ve sağ kosetlere ayırıp normalliği inceleyelim.`,
      model: { id: 'cosets', params: { kind: 'D', n, sub: H.map(x => dName(x)) } },
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 10. ps1-lagrange-sonuclari — Lagrange theorem, order pq, coprime H∩K, A4/V4
// =====================================================================

const T_LAGRANGE_SONUCLARI = {
  id: 'ps1-lagrange-sonuclari',
  topic: 'Kosetler ve Lagrange',
  title: 'Lagrange Teoremi, Mertebe Kısıtları ve Tersinin İstisnaları',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const N = rng.pick([12, 15, 18, 20, 21, 24, 28, 30]);
      const divs = divisors(N);
      const nonDivs = [];
      for (let m = 2; m < N; m++) if (N % m !== 0 && m <= 16) nonDivs.push(m);
      const impossible = rng.pick(nonDivs);
      const validPick = rng.sample(divs.filter(d => d > 1 && d < N), 3);
      const impChoice = shuffleChoice(rng, `$${impossible}$`, validPick.map(d => `$${d}$`));
      const coprimePairs = [[3, 4], [3, 5], [4, 5], [3, 7], [5, 6], [4, 7], [5, 8], [7, 9]];
      const [ha, kb] = rng.pick(coprimePairs);

      return {
        title: `Lagrange Teoremiyle Mertebe Kısıtları ($|G| = ${N}$)`,
        story: `Mertebesi $|G| = ${N}$ olan sonlu bir fiziksel simetri grubunun alt grupları ve eleman periyotları Lagrange teoremiyle sıkı biçimde kısıtlanır.`,
        model: { id: 'cyclic', params: { n: N } },
        parts: makeLabels([
          {
            prompt: `Lagrange teoremine göre $|G| = ${N}$ mertebeli bir grubun alt gruplarının alabileceği tüm olası mertebeleri küme olarak yazın.`,
            kind: 'answer',
            answer: { type: 'intset', value: divs },
            hints: [
              'Lagrange teoremi: her $H \\le G$ için $|H| \\mid |G|$ olmak zorundadır.',
              `$${N}$ sayısının $1$ ve $${N}$ dahil tüm pozitif bölenlerini listeleyin.`,
              `Toplam $${divs.length}$ bölen vardır.`,
            ],
            solution: [
              `$|H| \\mid ${N}$ koşulunu sağlayan sayılar: $${intSetTex(divs)}$.`,
            ],
          },
          {
            prompt: `Aşağıdaki sayılardan hangisi $|G| = ${N}$ mertebeli bir grupta bir elemanın mertebesi **kesinlikle olamaz**?`,
            kind: 'answer',
            answer: impChoice,
            hints: [
              'Her $g \\in G$ için $\\langle g \\rangle \\le G$ olduğundan $|g| \\mid |G|$ gerekir.',
              `Seçeneklerden hangisi $${N}$ sayısını tam bölmez?`,
              `$${impossible} \\nmid ${N}$ olduğundan bu mertebede eleman olamaz.`,
            ],
            solution: [
              `$|g| = |\\langle g \\rangle| \\mid ${N}$ olmalıdır. $${impossible} \\nmid ${N}$ olduğundan **$${impossible}$** olası değildir.`,
            ],
          },
          {
            prompt: `Bir grubun iki alt grubu $|H| = ${ha}$ ve $|K| = ${kb}$ mertebelerine sahipse ($\\gcd(${ha}, ${kb}) = 1$), kesişimlerinin mertebesi $|H \\cap K|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: 1 },
            hints: [
              '$H \\cap K$ hem $H$' + "'nin hem $K$'nin bir alt grubudur.",
              `Lagrange teoremi gereği $|H \\cap K|$ hem $${ha}$'yı hem $${kb}$'yi bölmelidir.`,
              `$\\gcd(${ha}, ${kb}) = 1$ olduğundan tek ortak pozitif bölen $1$'dir.`,
            ],
            solution: [
              `$H \\cap K \\le H$ ve $H \\cap K \\le K$ olduğundan $|H \\cap K| \\mid \\gcd(${ha}, ${kb}) = 1$, yani $|H \\cap K| = 1$ ($H \\cap K = \\{e\\}$).`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const pqPairs = [[2, 3], [2, 5], [2, 7], [3, 5], [3, 7], [5, 7]];
      const [p, q] = rng.pick(pqPairs);
      const pq = p * q;
      const useA4 = rng.int(0, 1) === 1;
      const exName = useA4 ? 'A_4' : 'V_4 \\cong D_2';
      const exOrd = useA4 ? 12 : 4;
      const maxOrd = useA4 ? 3 : 2;
      const missingDiv = useA4 ? 6 : 4;

      return {
        title: `Mertebesi $pq = ${pq}$ Olan Gruplar ve Lagrange Sınırları`,
        story: `İki farklı asal sayının çarpımı $|G| = ${p} \\cdot ${q} = ${pq}$ mertebeli bir simetri grubunun olası eleman mertebelerini inceleyelim ve Lagrange teoreminin tersinin neden her zaman geçerli olmadığını $${exName}$ örneğinde görelim.`,
        model: { id: 'sublattice', params: { kind: 'D', n: 2 } },
        parts: makeLabels([
          {
            prompt: `Mertebesi $|G| = ${pq}$ ($${p} \\cdot ${q}$) olan bir grupta birim dışındaki bir $g \\neq e$ elemanının mertebesi hangi değerleri alabilir? (Küme olarak yazın.)`,
            kind: 'answer',
            answer: { type: 'intset', value: [p, q, pq] },
            hints: [
              `$g \\neq e$ olduğundan $|g| > 1$ ve Lagrange teoremiyle $|g| \\mid ${pq}$.`,
              `$${p}$ ve $${q}$ asal olduğundan $${pq}$'nun $1$'den büyük bölenleri $${p}, ${q}$ ve $${pq}$'dur.`,
            ],
            solution: [
              `$|g| \\mid ${pq}$ ve $|g| > 1$ olduğundan olası mertebeler $${intSetTex([p, q, pq])}$.`,
            ],
          },
          {
            prompt: `Mertebesi $|${exName}| = ${exOrd}$ olan $${exName}$ grubunda bir elemanın sahip olabileceği **en büyük** mertebe kaçtır? (Bu örnek, $${missingDiv} \\mid ${exOrd}$ olmasına rağmen $${missingDiv}$ mertebeli eleman bulunmadığını gösterir.)`,
            kind: 'answer',
            answer: { type: 'int', value: maxOrd },
            hints: [
              useA4
                ? '$A_4$ çift permütasyonlardan oluşur: $e$, $(ab)(cd)$ (mertebe $2$) ve $(abc)$ (mertebe $3$).'
                : '$V_4 = \\{e, a, b, c\\}$ grubunda birim dışındaki her elemanın karesi $e$ olur.',
            ],
            solution: [
              useA4
                ? '$A_4$ elemanlarının mertebeleri yalnızca $1, 2, 3$ olur ($4$-döngü tek permütasyondur ve $A_4$ içinde yer almaz). En büyük eleman mertebesi **3**.'
                : '$V_4 \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_2$ grubunda $a^2 = b^2 = c^2 = e$ olduğundan en büyük eleman mertebesi **2**.',
            ],
          },
          {
            prompt: `$|H| = ${p}$ ve $|K| = ${q}$ mertebeli iki alt grubun kesişiminin mertebesi $|H \\cap K|$ kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: 1 },
            hints: [
              `$|H \\cap K|$ hem $${p}$'yi hem $${q}$'yu böler; iki farklı asalın EBOB'u $1$'dir.`,
            ],
            solution: [
              `$H \\cap K \\le H, K \\implies |H \\cap K| \\mid \\gcd(${p}, ${q}) = 1 \\implies |H \\cap K| = 1$.`,
            ],
          },
          {
            prompt: `**Kanıt:** Mertebesi $|G| = pq$ ($p, q$ farklı asallar) olan bir $G$ grubunda mertebesi ne $p$ ne de $q$ olan bir $g \\neq e$ elemanı varsa $G$'nin mutlaka devirli ($G \\cong \\mathbb{Z}_{pq}$) olduğunu kanıtlayın.`,
            kind: 'proof',
            hints: [
              'Lagrange teoremini $g$' + "'nin ürettiği $\\langle g \\rangle$ alt grubuna uygulayın.",
            ],
            solution: [
              'Lagrange teoremi gereği $|g| = |\\langle g \\rangle|$ sayısı $|G| = pq$' + "'yi bölmelidir.",
              '$pq$ sayısının pozitif bölenleri yalnızca $1, p, q, pq$ değerleridir.',
              '$g \\neq e \\implies |g| \\neq 1$; varsayım gereği $|g| \\neq p$ ve $|g| \\neq q$.',
              'Tek olası değer $|g| = pq = |G|$ olduğundan $\\langle g \\rangle = G$, yani $G$ devirlidir ($G \\cong \\mathbb{Z}_{pq}$).',
            ],
            checklist: [
              'Lagrange teoremiyle $|g| \\mid pq$ yazıldı.',
              '$pq$ bölenlerinin yalnızca $\\{1, p, q, pq\\}$ olduğu belirtildi.',
              '$1, p, q$ elenerek $|g| = pq \\implies G = \\langle g \\rangle$ sonucuna ulaşıldı.',
            ],
          },
        ]),
      };
    }

    // zorlayici
    const pOdd = rng.pick([3, 5, 7, 11, 13]);
    return {
      title: `Lagrange Teoreminin Sınırları: $A_4$, $D_{${pOdd}}$ ve Aralarında Asal Alt Gruplar`,
      story: `Lagrange teoremi her alt grup ve eleman mertebesinin $|G|$ sayısını böldüğünü söyler; ancak tersi doğru değildir: her $d \\mid |G|$ bölenine karşılık gelen bir eleman, hatta bir alt grup bile bulunmayabilir.`,
      model: { id: 'sublattice', params: { kind: 'D', n: 2 } },
      parts: makeLabels([
        {
          prompt: `Alternatif grup $A_4$'te ($|A_4| = 12$) grubun mertebesini böldüğü hâlde **o mertebede hiçbir elemanın bulunmadığı** tüm bölenleri küme olarak yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: [4, 6, 12] },
          hints: [
            '$A_4$ yalnızca çift permütasyonları ($e$, üç tane $(ab)(cd)$ ve sekiz tane $(abc)$) içerir.',
          ],
          solution: [
            '$12$' + "'nin bölenleri $\\{1, 2, 3, 4, 6, 12\\}$. $A_4$ içinde bulunan eleman mertebeleri yalnızca $1, 2, 3$ olduğundan eleman bulunmayan bölenler **$\\{4, 6, 12\\}$**.",
          ],
        },
        {
          prompt: `Mertebesi $|D_{${pOdd}}| = ${2 * pOdd}$ olan dihedral $D_{${pOdd}}$ grubunda, $|D_{${pOdd}}|$'yi bölen fakat o mertebede hiçbir elemanın bulunmadığı tek bölen kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: 2 * pOdd },
          hints: [
            `$D_{${pOdd}}$ içinde dönmelerin mertebeleri $1$ veya $${pOdd}$, yansımaların mertebesi $2$'dir.`,
          ],
          solution: [
            `$${2 * pOdd}$ bölenleri $\\{1, 2, ${pOdd}, ${2 * pOdd}\\}$. $D_{${pOdd}}$ değişmeli olmadığı için devirli olamaz; mertebesi **$${2 * pOdd}$** olan eleman yoktur.`,
          ],
        },
        {
          prompt: '**Kanıt 1:** Herhangi bir $G$ grubunun iki alt grubu $H, K \\le G$ için $\\gcd(|H|, |K|) = 1$ ise $H \\cap K = \\{e\\}$ olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            'Önce $H \\cap K$' + "'nin hem $H$'nin hem $K$'nin alt grubu olduğunu gösterin, ardından Lagrange teoremini uygulayın.",
          ],
          solution: [
            'İki alt grubun kesişimi $H \\cap K$ yine bir alt gruptur ($e \\in H \\cap K$, çarpma ve ters altında kapalı).',
            '$H \\cap K \\le H$ ve $H \\cap K \\le K$ olduğundan Lagrange teoremiyle $|H \\cap K| \\mid |H|$ ve $|H \\cap K| \\mid |K|$.',
            'Dolayısıyla $|H \\cap K| \\mid \\gcd(|H|, |K|) = 1$, yani $|H \\cap K| = 1$. $e \\in H \\cap K$ olduğundan $H \\cap K = \\{e\\}$.',
          ],
          checklist: [
            '$H \\cap K$' + "'nin $H$ ve $K$'nin ortak alt grubu olduğu belirtildi.",
            'Lagrange teoremiyle $|H \\cap K| \\mid \\gcd(|H|, |K|) = 1$ çıkarıldı.',
            '$e \\in H \\cap K$ ve $|H \\cap K| = 1$ üzerinden $H \\cap K = \\{e\\}$ bağlandı.',
          ],
        },
        {
          prompt: '**Kanıt 2:** $|G| = pq$ ($p, q$ farklı asallar) iken mertebesi $p$ ve $q$ dışındaki bir $g \\neq e$ elemanı varsa $G$' + "'nin devirli olduğunu kanıtlayın; ayrıca $A_4$'ün $6$ mertebeli bir alt gruba sahip olmadığını açıklayın.",
          kind: 'proof',
          hints: [
            'İlk kısım için $|g| \\mid pq$ kullanın. İkinci kısım için $6$ mertebeli bir $H \\le A_4$ alt grubunun indeks $2$ olacağından normal olduğunu ve her $g \\in A_4$ için $g^2 \\in H$ gerekeceğini kullanın.',
          ],
          solution: [
            '$|g| \\mid pq$ ve $|g| \\notin \\{1, p, q\\} \\implies |g| = pq \\implies G = \\langle g \\rangle$ devirlidir.',
            '$H \\le A_4$ ve $|H| = 6$ olsaydı $[A_4 : H] = 2$ olacağından $H \\trianglelefteq A_4$ olurdu; $A_4/H \\cong \\mathbb{Z}_2$ gereği her $g \\in A_4$ için $g^2 \\in H$ sağlanmalıydı.',
            'Her $3$-döngü $\\sigma \\in A_4$ için $\\sigma = \\sigma^4 = (\\sigma^2)^2 \\in H$ olurdu; ancak $A_4$ içinde $8$ adet $3$-döngü vardır ($8 > 6 = |H|$), çelişki!',
          ],
          checklist: [
            '$|g| \\mid pq$ ile $G$ devirliliği kanıtlandı.',
            '$|H| = 6 \\implies [A_4:H] = 2 \\implies g^2 \\in H$ (veya $3$-döngülerin $H$' + "'de kalması) gösterildi.",
            '$A_4$ içindeki $8$ adet $3$-döngü ile $|H| = 6$ çelişkisi kuruldu.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 11. ps1-hom-zm-zn — Homomorphisms Z_m -> Z_n, kernel, image, |ker|*|im|=|G|
// =====================================================================

const T_HOM_ZM_ZN = {
  id: 'ps1-hom-zm-zn',
  topic: 'Homomorfizmalar',
  title: '$\\mathbb{Z}_m \\to \\mathbb{Z}_n$ Homomorfizmaları, Çekirdek ve Görüntü',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const pairs = level === 'isinma'
      ? [[6, 6], [6, 9], [6, 12], [8, 4], [8, 12], [9, 6], [10, 5], [10, 15], [12, 6], [12, 8], [12, 9]]
      : level === 'odev'
        ? [[6, 9], [8, 12], [9, 12], [10, 15], [12, 8], [12, 9], [12, 16], [14, 21], [15, 10], [16, 12], [18, 12]]
        : [[12, 6], [12, 8], [14, 7], [15, 5], [15, 10], [16, 8], [16, 12], [18, 6], [18, 12], [20, 10], [20, 15], [24, 16]];

    const [m, n] = rng.pick(pairs);
    const g = gcd(m, n);
    const step = n / g;
    const validImgs = Array.from({ length: g }, (_, t) => t * step);
    // Pick a non-zero valid a = phi(1) whose kernel has <= 8 elements (nice to list!)
    const nonZeroValid = validImgs.filter(a => a > 0);
    const goodAs = nonZeroValid.filter(a => (m / (n / gcd(a, n))) <= 8);
    const a = rng.pick(goodAs.length ? goodAs : nonZeroValid);

    const images = Array.from({ length: m }, (_, x) => (a * x) % n);
    const ker = [];
    const imSet = new Set();
    for (let x = 0; x < m; x++) {
      if (images[x] === 0) ker.push(x);
      imSet.add(images[x]);
    }
    const im = [...imSet].sort((x, y) => x - y);
    const surjCount = m % n === 0 ? eulerPhi(n) : 0;

    const model = { id: 'hom', params: { from: { kind: 'Z', n: m }, to: { kind: 'Z', n }, images } };
    let rawParts;

    if (level === 'isinma') {
      const x0 = rng.int(2, m - 1);
      const fx0 = (a * x0) % n;
      rawParts = [
        {
          prompt: `$\\varphi: \\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$ homomorfizması $\\varphi(x) = ${a}x \\bmod ${n}$ kuralıyla veriliyor. $\\varphi(${x0})$ değerini hesaplayın.`,
          kind: 'answer',
          answer: { type: 'int', value: fx0 },
          hints: [
            `$x = ${x0}$ değerini $${a}x$ ifadesinde yerine koyun ve mod $${n}$ alın.`,
            `$${a} \\cdot ${x0} = ${a * x0}$.`,
            `$${a * x0} \\bmod ${n} = ${fx0}$.`,
          ],
          solution: [
            `$\\varphi(${x0}) = (${a} \\cdot ${x0}) \\bmod ${n} = ${a * x0} \\bmod ${n} = ${fx0}$.`,
          ],
        },
        {
          prompt: `Bu $\\varphi$ homomorfizmasının çekirdeği $\\ker(\\varphi)$ kümesini listeleyin.`,
          kind: 'answer',
          answer: { type: 'intset', value: ker },
          hints: [
            `$\\ker(\\varphi) = \\{ x \\in \\mathbb{Z}_{${m}} : ${a}x \\equiv 0 \\pmod{${n}} \\}$.`,
            `$\\varphi(1) = ${a}$ elemanının $\\mathbb{Z}_{${n}}$ içindeki mertebesi $d = ${im.length}$ olduğundan $\\ker(\\varphi)$ tam olarak $d$'nin $\\mathbb{Z}_{${m}}$ içindeki katlarıdır.`,
            `Çekirdekte toplam $${ker.length}$ eleman bulunur.`,
          ],
          solution: [
            `$${a}x \\equiv 0 \\pmod{${n}} \\iff ${im.length} \\mid x$.`,
            `$\\ker(\\varphi) = ${intSetTex(ker)}$ ($|\\ker(\\varphi)| = ${ker.length}$).`,
          ],
        },
        {
          prompt: `Bu $\\varphi$ homomorfizmasının görüntüsü $\\operatorname{im}(\\varphi)$ kümesini listeleyin.`,
          kind: 'answer',
          answer: { type: 'intset', value: im },
          hints: [
            `$\\operatorname{im}(\\varphi) = \\langle \\varphi(1) \\rangle = \\langle ${a} \\rangle \\le \\mathbb{Z}_{${n}}$.`,
            `$\\gcd(${a}, ${n}) = ${gcd(a, n)}$ sayısının mod $${n}$ katlarını yazın.`,
            `Görüntüde toplam $${im.length}$ eleman vardır.`,
          ],
          solution: [
            `$\\operatorname{im}(\\varphi) = \\langle ${a} \\rangle = \\langle ${gcd(a, n)} \\rangle = ${intSetTex(im)}$ ($|\\operatorname{im}(\\varphi)| = ${im.length}$).`,
          ],
        },
        {
          prompt: `$|\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)|$ çarpımını hesaplayın.`,
          kind: 'answer',
          answer: { type: 'int', value: m },
          hints: [
            'Birinci İzomorfizma Teoremine göre $|\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)| = |G|$.',
            `$${ker.length} \\cdot ${im.length}$ çarpımını hesaplayın.`,
            `Sonuç tanım kümesi $\\mathbb{Z}_{${m}}$'nin mertebesi $${m}$ olmalıdır.`,
          ],
          solution: [
            `$|\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)| = ${ker.length} \\cdot ${im.length} = ${m} = |\\mathbb{Z}_{${m}}|$.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      rawParts = [
        {
          prompt: `$\\mathbb{Z}_{${m}}$ grubundan $\\mathbb{Z}_{${n}}$ grubuna toplam kaç farklı grup homomorfizması tanımlanabilir?`,
          kind: 'answer',
          answer: { type: 'int', value: g },
          hints: [
            'Bir $\\varphi: \\mathbb{Z}_m \\to \\mathbb{Z}_n$ homomorfizması $\\varphi(1) = a$ seçimiyle tekil olarak belirlenir.',
            `$m \\cdot 1 \\equiv 0 \\pmod{${m}}$ olduğundan $|a|_{\\mathbb{Z}_{${n}}} \\mid ${m}$, yani $${m}a \\equiv 0 \\pmod{${n}}$ gerekir.`,
            `Toplam sayı $\\gcd(${m}, ${n}) = ${g}$.`,
          ],
          solution: [
            `$\\varphi(1) = a$ için gerek ve yeter koşul $${n} \\mid ${m}a \\iff ${step} \\mid a$.`,
            `$\\{0, 1, \\dots, ${n - 1}\\}$ içinde $${step}$'nin tam $\\gcd(${m}, ${n}) = ${g}$ katı vardır.`,
          ],
        },
        {
          prompt: `$\\varphi(1) \\in \\mathbb{Z}_{${n}}$ görüntüsünün alabileceği tüm geçerli değerleri küme olarak yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: validImgs },
          hints: [
            `$${step}$ sayısının $0$ dahil $${n}$'den küçük tüm katlarını yazın.`,
            `Toplam $${g}$ değer olacak.`,
          ],
          solution: [
            `Geçerli $\\varphi(1)$ değerleri $${step}$'nin mod $${n}$ katlarıdır: $${intSetTex(validImgs)}$.`,
          ],
        },
        {
          prompt: `Bu geçerli seçimlerden $\\varphi(1) = ${a}$ (yani $\\varphi(x) = ${a}x \\bmod ${n}$) alındığında $\\ker(\\varphi)$ çekirdeğini listeleyin.`,
          kind: 'answer',
          answer: { type: 'intset', value: ker },
          hints: [
            `$${a}x \\equiv 0 \\pmod{${n}}$ denklemini $\\gcd(${a}, ${n}) = ${gcd(a, n)}$ ile sadeleştirin.`,
            `Çözüm $${im.length}$ sayısının $\\mathbb{Z}_{${m}}$ içindeki katlarıdır.`,
          ],
          solution: [
            `$${a}x \\equiv 0 \\pmod{${n}} \\iff ${im.length} \\mid x \\implies \\ker(\\varphi) = ${intSetTex(ker)}$.`,
          ],
        },
        {
          prompt: `Aynı $\\varphi(x) = ${a}x \\bmod ${n}$ homomorfizmasının görüntü büyüklüğü $|\\operatorname{im}(\\varphi)|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: im.length },
          hints: [
            `$|\\operatorname{im}(\\varphi)| = |\\varphi(1)|_{\\mathbb{Z}_{${n}}} = ${n} / \\gcd(${a}, ${n}) = ${m} / |\\ker(\\varphi)|$.`,
          ],
          solution: [
            `$|\\operatorname{im}(\\varphi)| = \\frac{${n}}{\\gcd(${a}, ${n})} = ${im.length}$ (ve $|\\ker| \\cdot |\\operatorname{im}| = ${ker.length} \\cdot ${im.length} = ${m}$).`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\varphi: \\mathbb{Z}_m \\to \\mathbb{Z}_n$ homomorfizmalarının tam olarak $\\varphi(x) = ax \\bmod n$ ($n \\mid ma$) biçiminde olduğunu, dolayısıyla toplam sayılarının $\\gcd(m, n)$ olduğunu ve $|\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)| = m$ sağlandığını kanıtlayın.',
          kind: 'proof',
          hints: [
            '$\\varphi(x) = x \\cdot \\varphi(1)$ eşitliğini homomorfizma özelliğinden çıkarın ve $x \\equiv x\' \\pmod m$ altında iyi tanımlılık koşulunu inceleyin.',
          ],
          solution: [
            '$\\varphi(x) = \\varphi(1 + \\dots + 1) = x \\varphi(1) = ax \\pmod n$. İyi tanımlılık: $x \\equiv y \\pmod m \\implies m \\mid (x-y)$, dolayısıyla $a(x-y) \\equiv 0 \\pmod n$ tüm $x, y$ için sağlanır $\\iff n \\mid ma$.',
            '$g = \\gcd(m, n)$ için $n \\mid ma \\iff (n/g) \\mid (m/g)a \\iff (n/g) \\mid a$. $0 \\le a < n$ aralığında tam $g = \\gcd(m, n)$ çözüm vardır.',
            '$|\\operatorname{im}(\\varphi)| = |\\langle a \\rangle| = n/\\gcd(a, n) = d$, ve $ax \\equiv 0 \\pmod n \\iff d \\mid x$ olduğundan $|\\ker(\\varphi)| = m/d$; çarpımları $(m/d) \\cdot d = m$.',
          ],
          checklist: [
            '$\\varphi(x) = ax \\bmod n$ biçimi ve iyi tanımlılık koşulu $n \\mid ma$ kanıtlandı.',
            '$n \\mid ma \\iff (n/\\gcd(m,n)) \\mid a$ indirgemesiyle toplam $\\gcd(m, n)$ sayısı elde edildi.',
            '$|\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)| = m$ eşitliği doğrulandı.',
          ],
        },
      ];
    } else {
      rawParts = [
        {
          prompt: `$\\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$ arasında toplam kaç farklı grup homomorfizması vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: g },
          hints: [
            'Üreteç $1$' + "'in görüntüsü $a = \\varphi(1)$ için $|a| \\mid m$ koşulunu sayın.",
          ],
          solution: [
            `Toplam homomorfizma sayısı $\\gcd(${m}, ${n}) = ${g}$.`,
          ],
        },
        {
          prompt: `Bu homomorfizmalardan kaç tanesi **örten** (surjective, yani $\\operatorname{im}(\\varphi) = \\mathbb{Z}_{${n}}$) olur?`,
          kind: 'answer',
          answer: { type: 'int', value: surjCount },
          hints: [
            'Örtenlik için $\\varphi(1) = a$ bir $\\mathbb{Z}_n$ üreteci olmalı ($\\gcd(a, n) = 1$) ve aynı zamanda $n \\mid ma$ sağlanmalıdır.',
          ],
          solution: m % n === 0
            ? [
              `$${n} \\mid ${m}$ sağlandığından her $a \\in \\mathbb{Z}_{${n}}$ geçerli bir homomorfizma tanımlar.`,
              `Örtenlik koşulu $\\gcd(a, ${n}) = 1$ olup tam $\\varphi(${n}) = ${surjCount}$ örten homomorfizma vardır.`,
            ]
            : [
              `Geçerli her $a = \\varphi(1)$ değeri $${step} = ${n}/\\gcd(${m}, ${n}) > 1$ sayısının katı olmak zorundadır; bu yüzden $\\gcd(a, ${n}) \\ge ${step} > 1$ olur ve hiçbir homomorfizma örten olamaz: **0**.`,
            ],
        },
        {
          prompt: `$\\varphi(1) = ${a}$ ile tanımlanan homomorfizmanın çekirdeği $\\ker(\\varphi)$ kümesini yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: ker },
          hints: [
            `$${a}x \\equiv 0 \\pmod{${n}}$ denklemini $\\mathbb{Z}_{${m}}$ içinde çözün.`,
          ],
          solution: [
            `$|\\operatorname{im}(\\varphi)| = ${n}/\\gcd(${a}, ${n}) = ${im.length}$ olduğundan $\\ker(\\varphi) = \\langle ${im.length} \\rangle = ${intSetTex(ker)}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** Herhangi bir sonlu grup homomorfizması $\\varphi: G \\to H$ için her $y \\in \\operatorname{im}(\\varphi)$ lifinin ($\\varphi^{-1}(y)$) $\\ker(\\varphi)$ çekirdeğinin bir sol koseti olduğunu göstererek $|\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)| = |G|$ teoremini kanıtlayın.',
          kind: 'proof',
          hints: [
            '$\\varphi(g_0) = y$ olan bir $g_0$ seçip $\\varphi^{-1}(y) = g_0 \\ker(\\varphi)$ eşitliğini çift yönlü kapsama ile gösterin.',
          ],
          solution: [
            '$K = \\ker(\\varphi)$ olsun. Her $y \\in \\operatorname{im}(\\varphi)$ için $\\varphi(g_0) = y$ olan bir $g_0 \\in G$ vardır.',
            '$x \\in \\varphi^{-1}(y) \\iff \\varphi(x) = \\varphi(g_0) \\iff \\varphi(g_0^{-1} x) = e_H \\iff g_0^{-1} x \\in K \\iff x \\in g_0 K$.',
            'Dolayısıyla her lif tam $|K|$ elemanlıdır. $G = \\bigsqcup_{y \\in \\operatorname{im}(\\varphi)} \\varphi^{-1}(y)$ ayrık birleşimi olduğundan $|G| = |\\operatorname{im}(\\varphi)| \\cdot |K| = |\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)|$.',
          ],
          checklist: [
            '$\\varphi^{-1}(\\varphi(g_0)) = g_0 \\ker(\\varphi)$ eşitliği kanıtlandı.',
            'Her kosetin/lifin $|\\ker(\\varphi)|$ elemanlı olduğu belirtildi.',
            '$G$' + "'nin liflere ayrık bölünmesinden $|G| = |\\ker(\\varphi)| \\cdot |\\operatorname{im}(\\varphi)|$ çıkarıldı.",
          ],
        },
      ];
    }

    return {
      title: `Frekans Eşleme Homomorfizmaları ($\\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$)`,
      story: `$${m}$ ve $${n}$ düğümlü iki periyodik faz halkası arasında grup yapısını koruyan $\\varphi: \\mathbb{Z}_{${m}} \\to \\mathbb{Z}_{${n}}$ eşlemelerini (homomorfizmalarını) sınıflandırıyoruz. Görsel modelde $\\varphi(x) = ${a}x \\bmod ${n}$ örneği gösterilmektedir.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 12. ps1-hom-det-u1 — det: D_n -> {±1} and z -> z^k on U(1)
// =====================================================================

const T_HOM_DET_U1 = {
  id: 'ps1-hom-det-u1',
  topic: 'Homomorfizmalar',
  title: 'Determinant ($D_n \\to \\{\\pm 1\\}$) ve $U(1)$ Üzerinde $z \\mapsto z^k$',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const n = rng.pick(level === 'odev' ? [3, 4, 5, 6] : [3, 4, 5, 6, 7, 8]);
    const k = rng.pick(level === 'isinma' ? [2, 3, 4, 5, 6, 8] : [3, 4, 5, 6, 7, 8, 9, 10, 12]);
    // det homomorphism D_n -> Z_2 (0 for +1, 1 for -1); matches both dAll(n) and group.dihedral(n) ordering!
    const detImages = Array.from({ length: n }, () => 0).concat(Array.from({ length: n }, () => 1));
    const model = { id: 'hom', params: { from: { kind: 'D', n }, to: { kind: 'Z', n: 2 }, images: detImages } };

    let rawParts;
    if (level === 'isinma') {
      const w = dEl(n, rng.int(1, n - 1), rng.int(0, 1));
      const detVal = w.m ? -1 : 1;
      rawParts = [
        {
          prompt: `$D_{${n}}$ elemanlarının düzlemdeki $2 \\times 2$ ortogonal matris temsilinde $w = ${dTex(w)}$ elemanının determinantı $\\det M(w)$ kaçtır? ($1$ veya $-1$ yazın.)`,
          kind: 'answer',
          answer: { type: 'int', value: detVal },
          hints: [
            'Dönmeler yönelimi korur ($\\det = +1$), yansımalar yönelimi ters çevirir ($\\det = -1$).',
            `$w = ${dTex(w)}$ bir ${w.m ? 'yansıma' : 'dönme'} elemanıdır.`,
            `Sonuç: $${detVal}$.`,
          ],
          solution: [
            `$M(r) = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}$ ($\\det = +1$) ve $M(s) = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}$ ($\\det = -1$).`,
            `$\\det M(${dTex(w)}) = (+1)^{${w.k}}(-1)^{${w.m}} = ${detVal}$.`,
          ],
        },
        {
          prompt: `$\\det: D_{${n}} \\to \\{+1, -1\\}$ homomorfizmasının çekirdeği $\\ker(\\det)$ kaç elemanlıdır?`,
          kind: 'answer',
          answer: { type: 'int', value: n },
          hints: [
            'Çekirdek, determinantı $+1$ (hedef grubun birim elemanı) olan tüm $D_n$ elemanlarından oluşur.',
            'Determinantı $+1$ olan elemanlar tam olarak saf dönmelerdir: $e, r, \\dots, r^{n-1}$.',
            `Toplam $${n}$ dönme vardır.`,
          ],
          solution: [
            `$\\ker(\\det) = \\langle r \\rangle = \\{e, r, \\dots, r^{${n - 1}}\\}$, dolayısıyla $|\\ker(\\det)| = ${n}$.`,
          ],
        },
        {
          prompt: `Birim çember grubu $U(1) = \\{z \\in \\mathbb{C} : |z| = 1\\}$ üzerinde $\\psi_{${k}}(z) = z^{${k}}$ homomorfizmasının çekirdeği $\\ker(\\psi_{${k}})$ kaç elemanlıdır?`,
          kind: 'answer',
          answer: { type: 'int', value: k },
          hints: [
            `$\\ker(\\psi_{${k}}) = \\{z \\in U(1) : z^{${k}} = 1\\}$ kümesi birliğin $${k}$. dereceden kökleridir.`,
            `$z = e^{2\\pi i j / ${k}}$ ($j = 0, 1, \\dots, ${k - 1}$).`,
            `Toplam $${k}$ eleman vardır.`,
          ],
          solution: [
            `$z^{${k}} = 1$ denkleminin birim çember üzerinde tam $${k}$ çözümü ($e^{2\\pi i j/${k}}$, $0 \\le j < ${k}$) vardır; $|\\ker(\\psi_{${k}})| = ${k}$.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      const rots = dRotSub(n, n);
      const targets = [
        { tex: '1', arg: '0' },
        { tex: '-1', arg: '\\pi' },
        { tex: 'i', arg: '\\pi/2' },
        { tex: '-i', arg: '3\\pi/2' },
      ];
      const tgt = rng.pick(targets);
      const isoChoice = shuffleChoice(rng, `$\\mathbb{Z}_{${k}}$`, [`$D_{${k}}$`, `$\\mathbb{Z}_2$`, `$S_{${k}}$`]);
      rawParts = [
        {
          prompt: `$\\det: D_{${n}} \\to \\{+1, -1\\}$ homomorfizmasının çekirdeği $\\ker(\\det)$ kümesinin tüm elemanlarını normal biçimde yazın.`,
          kind: 'answer',
          answer: { type: 'dset', n, value: rots },
          hints: [
            '$\\det(M(r^k s^m)) = (-1)^m$ olduğundan $\\ker(\\det)$ tam olarak $m = 0$ (saf dönme) elemanlarıdır.',
            `$e, r, \\dots, r^{${n - 1}}$ elemanlarını listeleyin.`,
          ],
          solution: [
            `$\\ker(\\det) = \\langle r \\rangle = ${dSetTex(rots)}$.`,
          ],
        },
        {
          prompt: `$\\det: D_{${n}} \\to \\{+1, -1\\}$ için $|\\ker(\\det)| \\cdot |\\operatorname{im}(\\det)|$ çarpımı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: 2 * n },
          hints: [
            `$|\\ker(\\det)| = ${n}$ ve $\\operatorname{im}(\\det) = \\{+1, -1\\}$ ($2$ elemanlı).`,
          ],
          solution: [
            `$|\\ker(\\det)| \\cdot |\\operatorname{im}(\\det)| = ${n} \\cdot 2 = ${2 * n} = |D_{${n}}|$.`,
          ],
        },
        {
          prompt: `$\\psi_{${k}}: U(1) \\to U(1)$, $\\psi_{${k}}(z) = z^{${k}}$ homomorfizması altında $w_0 = ${tgt.tex}$ elemanının kaç tane ön görüntüsü (yani $z^{${k}} = ${tgt.tex}$ denklemini sağlayan kaç $z \\in U(1)$) vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: k },
          hints: [
            'Homomorfizma lifleri çekirdeğin kosetleridir: her $w_0 \\in U(1)$ için $|\\psi_k^{-1}(w_0)| = |\\ker(\\psi_k)|$.',
            `$w_0 = e^{i(${tgt.arg})}$ için $z_j = e^{i(${tgt.arg} + 2\\pi j)/${k}}$ ($j = 0, \\dots, ${k - 1}$).`,
          ],
          solution: [
            `$z^{${k}} = e^{i(${tgt.arg})} \\implies z_j = e^{i(${tgt.arg} + 2\\pi j)/${k}}$ ($j = 0, 1, \\dots, ${k - 1}$): tam **$${k}$** ön görüntü (bir $\\ker(\\psi_{${k}})$ koseti).`,
          ],
        },
        {
          prompt: `$\\ker(\\psi_{${k}})$ çekirdeği aşağıdaki sonlu gruplardan hangisine izomorfiktir?`,
          kind: 'answer',
          answer: isoChoice,
          hints: [
            `$\\omega = e^{2\\pi i/${k}}$ elemanı $\\ker(\\psi_{${k}})$ çekirdeğini tek başına üretir ($\\omega^j$, $j = 0, \\dots, ${k - 1}$).`,
          ],
          solution: [
            `$j \\mapsto e^{2\\pi i j/${k}}$ dönüşümü $\\mathbb{Z}_{${k}} \\xrightarrow{\\sim} \\ker(\\psi_{${k}})$ izomorfizmasıdır: **$\\mathbb{Z}_{${k}}$**.`,
          ],
        },
        {
          prompt: `**Kanıt:** $\\psi_k: U(1) \\to U(1)$, $\\psi_k(z) = z^k$ ($k \\ge 1$) dönüşümünün örten bir grup homomorfizması olduğunu, $\\ker(\\psi_k) \\cong \\mathbb{Z}_k$ olduğunu ve her $w \\in U(1)$ için $\\psi_k^{-1}(w)$ lifinin tam $k$ eleman içerdiğini kanıtlayın.`,
          kind: 'proof',
          hints: [
            'Homomorfizma için $(z_1 z_2)^k = z_1^k z_2^k$; örtenlik için $w = e^{i\\alpha}$ verildiğinde $z_0 = e^{i\\alpha/k}$ seçin; lifler için $z_0 \\ker(\\psi_k)$ kosetini yazın.',
          ],
          solution: [
            '**Homomorfizma:** $|z^k| = |z|^k = 1$ (iyi tanımlı) ve $\\psi_k(z_1 z_2) = (z_1 z_2)^k = z_1^k z_2^k = \\psi_k(z_1)\\psi_k(z_2)$.',
            '**Örtenlik:** Her $w = e^{i\\alpha} \\in U(1)$ için $z_0 = e^{i\\alpha/k} \\in U(1)$ alındığında $\\psi_k(z_0) = w$.',
            '**Çekirdek ve lifler:** $\\ker(\\psi_k) = \\{e^{2\\pi i j/k} : 0 \\le j < k\\} \\cong \\mathbb{Z}_k$ ($j \\mapsto e^{2\\pi i j/k}$ izomorfizma). $\\psi_k(z) = w = \\psi_k(z_0) \\iff (z/z_0)^k = 1 \\iff z \\in z_0 \\ker(\\psi_k)$, dolayısıyla her lif tam $k$ elemanlıdır.',
          ],
          checklist: [
            '$\\psi_k(z_1 z_2) = \\psi_k(z_1)\\psi_k(z_2)$ ve $U(1)$ içine kapalılık gösterildi.',
            'Her $e^{i\\alpha}$ için $z_0 = e^{i\\alpha/k}$ ile örtenlik kanıtlandı.',
            '$\\ker(\\psi_k) \\cong \\mathbb{Z}_k$ ve $\\psi_k^{-1}(w) = z_0 \\ker(\\psi_k)$ ($k$ eleman) gösterildi.',
          ],
        },
      ];
    } else {
      const sCount = rng.pick([2, 3, 4, 5]);
      const toks = [];
      for (let i = 0; i < sCount; i++) {
        toks.push({ kind: 's' });
        toks.push({ kind: 'r', exp: rng.int(1, n - 1) });
      }
      const wInfo = evalDWord(n, toks);
      const detWord = sCount % 2 === 0 ? 1 : -1;
      const k1 = rng.pick([2, 3, 4, 5]), k2 = rng.pick([2, 3, 4, 5, 6]);
      rawParts = [
        {
          prompt: `$D_{${n}}$ grubunda $w = ${wInfo.tex}$ çarpımının $2 \\times 2$ matris determinantı $\\det M(w)$ kaçtır? ($1$ veya $-1$ yazın.)`,
          kind: 'answer',
          answer: { type: 'int', value: detWord },
          hints: [
            '$\\det$ homomorfizma olduğundan kelimeyi normal biçime indirgemeden sadece içindeki $s$ sayısını saymanız yeterlidir!',
          ],
          solution: [
            `Determinant homomorfizma olduğundan $\\det M(w) = (\\det M(s))^{${sCount}} (\\det M(r))^{\\text{üsler}} = (-1)^{${sCount}} = ${detWord}$.`,
          ],
        },
        {
          prompt: `$\\psi_{${k}}: U(1) \\to U(1)$, $z \\mapsto z^{${k}}$ çekirdeğinin ($\\ker(\\psi_{${k}}) \\cong \\mathbb{Z}_{${k}}$) kaç tane üreteci (ilkel $${k}$. birlik kökü) vardır?`,
          kind: 'answer',
          answer: { type: 'int', value: eulerPhi(k) },
          hints: [
            `$\\ker(\\psi_{${k}}) \\cong \\mathbb{Z}_{${k}}$ grubunun üreteç sayısı $\\varphi(${k})$ olur.`,
          ],
          solution: [
            `İlkel $${k}$. birlik kökleri $e^{2\\pi i j/${k}}$ ($\\gcd(j, ${k}) = 1$) olup toplam $\\varphi(${k}) = ${eulerPhi(k)}$ adettir.`,
          ],
        },
        {
          prompt: `İki faz sarma homomorfizmasının bileşkesi $(\\psi_{${k1}} \\circ \\psi_{${k2}})(z) = (z^{${k2}})^{${k1}}$ dönüşümünün çekirdeği kaç elemanlıdır?`,
          kind: 'answer',
          answer: { type: 'int', value: k1 * k2 },
          hints: [
            `$(\\psi_{${k1}} \\circ \\psi_{${k2}})(z) = z^{${k1 * k2}} = \\psi_{${k1 * k2}}(z)$.`,
          ],
          solution: [
            `$(\\psi_{${k1}} \\circ \\psi_{${k2}})(z) = z^{${k1 * k2}}$ olduğundan çekirdekte tam $${k1} \\cdot ${k2} = ${k1 * k2}$ eleman vardır.`,
          ],
        },
        {
          prompt: '**Kanıt:** Birinci İzomorfizma Teoremini kullanarak hem $D_n / \\langle r \\rangle \\cong \\mathbb{Z}_2$ hem de her $k \\ge 1$ için $U(1) / \\mathbb{Z}_k \\cong U(1)$ izomorfizmalarını kanıtlayın.',
          kind: 'proof',
          hints: [
            'Sırasıyla $\\det: D_n \\to \\{\\pm 1\\}$ ve $\\psi_k: U(1) \\to U(1)$ örten homomorfizmalarını ve çekirdeklerini kullanın.',
          ],
          solution: [
            '$\\det: D_n \\to \\{\\pm 1\\} \\cong \\mathbb{Z}_2$ homomorfizmasında $\\det(M(r)) = +1$, $\\det(M(s)) = -1$ olduğundan $\\operatorname{im}(\\det) = \\{\\pm 1\\}$ (örten) ve $\\ker(\\det) = \\langle r \\rangle$. Birinci İzomorfizma Teoremiyle $D_n / \\langle r \\rangle \\cong \\{\\pm 1\\} \\cong \\mathbb{Z}_2$.',
            '$\\psi_k(z) = z^k$ homomorfizması $U(1) \\to U(1)$ örten olup $\\ker(\\psi_k) = \\mu_k \\cong \\mathbb{Z}_k$. Birinci İzomorfizma Teoremiyle $U(1) / \\mu_k \\cong U(1)$ (sonsuz grupta öz bir alt gruba bölünce grubun kendisine izomorfik bir bölüm elde edilir!).',
          ],
          checklist: [
            '$\\det: D_n \\to \\{\\pm 1\\}$ için örtenlik ve $\\ker(\\det) = \\langle r \\rangle$ gösterildi.',
            '$\\psi_k: U(1) \\to U(1)$ için örtenlik ve $\\ker(\\psi_k) \\cong \\mathbb{Z}_k$ gösterildi.',
            'Her iki durum için Birinci İzomorfizma Teoremi ($G/\\ker\\varphi \\cong \\operatorname{im}\\varphi$) doğru biçimde uygulandı.',
          ],
        },
      ];
    }

    return {
      title: `Yönelim Determinantı ($D_{${n}}$) ve Kuantum Faz Sarması ($U(1)$)`,
      story: `İki boyutlu kristal simetrilerinin yönelim koruyup korumadığını ölçen $\\det: D_{${n}} \\to \\{+1, -1\\}$ matris determinantı ile kuantum faz çemberi $U(1)$ üzerindeki $\\psi_{${k}}(z) = z^{${k}}$ sarma dönüşümü, fizikte en sık karşılaşılan grup homomorfizmalarındandır.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 13. ps1-birimler-grubu — Unit groups (Z_n)^x: order, inverses, cyclicity
// =====================================================================

const T_BIRIMLER_GRUBU = {
  id: 'ps1-birimler-grubu',
  topic: 'İzomorfizma ve Birimler',
  title: 'Birimler Grubu $(\\mathbb{Z}_n)^\\times$: Mertebe, Ters ve Devirlilik',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const nPool = level === 'isinma' ? [5, 7, 8, 9, 10, 12]
      : level === 'odev' ? [7, 8, 9, 10, 12, 14, 15, 16, 18]
      : [8, 12, 14, 15, 16, 18, 20, 24];
    const n = rng.pick(nPool);
    const units = unitsOf(n);
    const phi = units.length;
    const uOrds = units.map(u => modOrder(u, n));
    const maxOrd = Math.max(...uOrds);
    const isCyc = maxOrd === phi;
    const gens = units.filter((_, i) => uOrds[i] === phi);
    const nonOne = units.filter(u => u > 1);
    const u = rng.pick(nonOne);
    const uInv = modInv(u, n);
    const uOrd = modOrder(u, n);

    const model = { id: 'cayley', params: { kind: 'U', n } };
    let rawParts;

    if (level === 'isinma') {
      rawParts = [
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ birimler grubunun tüm elemanlarını küme olarak yazın.`,
          kind: 'answer',
          answer: { type: 'intset', value: units },
          hints: [
            `$(\\mathbb{Z}_{${n}})^\\times = \\{a \\in \\{1, \\dots, ${n - 1}\\} : \\gcd(a, ${n}) = 1\\}$.`,
            `$${n}$ ile ortak asal çarpanı olmayan sayıları seçin.`,
            `Toplam $\\varphi(${n}) = ${phi}$ eleman vardır.`,
          ],
          solution: [
            `$${n}$ ile aralarında asal elemanlar: $(\\mathbb{Z}_{${n}})^\\times = ${intSetTex(units)}$ (mertebe $${phi}$).`,
          ],
        },
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ grubunda $u = ${u}$ elemanının çarpımsal tersi $u^{-1} \\bmod ${n}$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: uInv },
          hints: [
            `$${u} \\cdot x \\equiv 1 \\pmod{${n}}$ sağlayan $x \\in (\\mathbb{Z}_{${n}})^\\times$ elemanını arıyoruz.`,
            `$${u}$ sayısını listedeki birimlerle çarpıp mod $${n}$ alın.`,
            `$${u} \\cdot ${uInv} = ${u * uInv} \\equiv 1 \\pmod{${n}}$.`,
          ],
          solution: [
            `$${u} \\cdot ${uInv} = ${u * uInv} \\equiv 1 \\pmod{${n}}$ olduğundan $${u}^{-1} = ${uInv}$.`,
          ],
        },
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ grubu **devirli** (yani $\\mathbb{Z}_{${phi}}$ grubuna izomorfik) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isCyc },
          hints: [
            `Grup mertebesi $|(\\mathbb{Z}_{${n}})^\\times| = ${phi}$; devirli olması için mertebesi tam $${phi}$ olan en az bir eleman bulunmalıdır.`,
            `Birimlerin mod $${n}$ kuvvetlerini alarak en büyük eleman mertebesini kontrol edin.`,
            isCyc ? `Örneğin $${gens[0]}$ elemanının mertebesi $${phi}$ olur.` : `En büyük eleman mertebesi yalnızca $${maxOrd} < ${phi}$ olur.`,
          ],
          solution: [
            `Eleman mertebeleri: ${units.map((x, i) => `$|${x}| = ${uOrds[i]}$`).join(', ')}.`,
            isCyc
              ? `Mertebesi $${phi}$ olan eleman (${gens[0]}) bulunduğundan **Evet, devirlidir** ($\\cong \\mathbb{Z}_{${phi}}$).`
              : `En büyük eleman mertebesi $${maxOrd} < ${phi}$ olduğundan **Hayır, devirli değildir**.`,
          ],
        },
      ];
    } else if (level === 'odev') {
      rawParts = [
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ birimler grubunun mertebesi $\\varphi(${n})$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: phi },
          hints: [
            `$${n}$ ile aralarında asal $1 \\le a < ${n}$ tam sayılarını sayın.`,
            `Asal bölenler $${intSetTex(distinctPrimes(n))}$ üzerinden $\\varphi(${n})$ hesaplayın.`,
          ],
          solution: [
            `$(\\mathbb{Z}_{${n}})^\\times = ${intSetTex(units)}$ olup $|(\\mathbb{Z}_{${n}})^\\times| = \\varphi(${n}) = ${phi}$.`,
          ],
        },
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ içinde $u = ${u}$ elemanının çarpımsal mertebesi $|${u}|$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: uOrd },
          hints: [
            `$${u}^k \\equiv 1 \\pmod{${n}}$ sağlayan en küçük pozitif $k$ üssünü bulun ($k \\mid ${phi}$).`,
            `Kuvvetler: $${Array.from({ length: uOrd }, (_, i) => { let p = 1; for (let t = 0; t <= i; t++) p = (p * u) % n; return `${u}^{${i + 1}} \\equiv ${p}`; }).join(',\\, ')}\\pmod{${n}}$.`,
          ],
          solution: [
            `$${u}^{${uOrd}} \\equiv 1 \\pmod{${n}}$ en küçük pozitif kuvvet olduğundan $|${u}| = ${uOrd}$.`,
          ],
        },
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ grubu devirli midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isCyc },
          hints: [
            `Mertebesi $${phi}$ olan bir üreteç (ilkel kök) var mı kontrol edin.`,
          ],
          solution: [
            `En büyük eleman mertebesi $${maxOrd}$ (grup mertebesi $${phi}$): **${isCyc ? 'Evet, devirlidir' : 'Hayır, devirli değildir'}**.`,
          ],
        },
        isCyc
          ? {
            prompt: `$(\\mathbb{Z}_{${n}})^\\times$ devirli olduğundan $\\mathbb{Z}_{${phi}} \\xrightarrow{\\sim} (\\mathbb{Z}_{${n}})^\\times$ izomorfizmasında $1 \\in \\mathbb{Z}_{${phi}}$ üretecinin gidebileceği tüm geçerli $\\varphi(1)$ değerlerini (yani tüm ilkel kökleri) küme olarak yazın.`,
            kind: 'answer',
            answer: { type: 'intset', value: gens },
            hints: [
              `Bir izomorfizma üreteci üretece taşır: mertebesi tam $${phi}$ olan tüm $a \\in (\\mathbb{Z}_{${n}})^\\times$ elemanlarını bulun.`,
            ],
            solution: [
              `Mertebesi $${phi}$ olan elemanlar (ilkel kökler): $${intSetTex(gens)}$. Bunların her biri $\\varphi(k) = g^k \\bmod ${n}$ biçiminde bir izomorfizma verir.`,
            ],
          }
          : {
            prompt: `$(\\mathbb{Z}_{${n}})^\\times$ devirli olmadığına göre bu gruptaki bir elemanın ulaşabileceği **en büyük** mertebe (grubun üssü) kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: maxOrd },
            hints: [
              `Grup mertebesi $${phi}$'nin öz bölenlerini ($< ${phi}$) elemanlar üzerinde test edin.`,
            ],
            solution: [
              `Eleman mertebeleri: ${units.map((x, i) => `$|${x}| = ${uOrds[i]}$`).join(', ')}. En büyük mertebe **$${maxOrd}$**.`,
            ],
          },
      ];
    } else {
      rawParts = [
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ grubunun mertebesi kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: phi },
          hints: [`$\\varphi(${n})$ değerini hesaplayın.`],
          solution: [`$|(\\mathbb{Z}_{${n}})^\\times| = \\varphi(${n}) = ${phi}$.`],
        },
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ grubunda bir elemanın alabileceği **en büyük** mertebe kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: maxOrd },
          hints: ['Çin Kalan Teoremiyle $n$ asal kuvvet çarpanlarına ayrılırsa maksimum mertebe bileşenlerin üslerinin EKOK değeridir.'],
          solution: [
            `Eleman mertebeleri: ${units.map((x, i) => `$|${x}| = ${uOrds[i]}$`).join(', ')}. En büyük mertebe: **$${maxOrd}$**.`,
          ],
        },
        {
          prompt: `$(\\mathbb{Z}_{${n}})^\\times$ grubu $\\mathbb{Z}_{${phi}}$ ile izomorfik (devirli) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: isCyc },
          hints: [`En büyük eleman mertebesi ($${maxOrd}$) ile grup mertebesini ($${phi}$) karşılaştırın.`],
          solution: [
            isCyc
              ? `En büyük mertebe $${maxOrd} = ${phi}$ olduğundan $(\\mathbb{Z}_{${n}})^\\times \\cong \\mathbb{Z}_{${phi}}$ (**Evet**).`
              : `En büyük mertebe $${maxOrd} < ${phi}$ olduğundan $\\mathbb{Z}_{${phi}}$'ye izomorfik değildir (**Hayır**).`,
          ],
        },
        {
          prompt: '**Kanıt:** Her $n \\ge 2$ için $(\\mathbb{Z}_n)^\\times = \\{a \\in \\mathbb{Z}_n : \\gcd(a, n) = 1\\}$ kümesinin mod $n$ çarpma altında sonlu bir Abelyen grup oluşturduğunu (özellikle kapalılık ve Bézout özdeşliğiyle tersinirlik) kanıtlayın.',
          kind: 'proof',
          hints: [
            'Kapalılık için $\\gcd(a, n) = \\gcd(b, n) = 1 \\implies \\gcd(ab, n) = 1$ (asal bölen kontrolü) ve ters için $ax + ny = 1$ Bézout eşitliğini kullanın.',
          ],
          solution: [
            '**Kapalılık:** $\\gcd(a, n) = 1$ ve $\\gcd(b, n) = 1$ ise $n$' + "'nin hiçbir asal böleni $a$'yı veya $b$'yi bölmez; dolayısıyla $ab$'yi de bölmez, yani $\\gcd(ab, n) = 1$ ve $(ab \\bmod n) \\in (\\mathbb{Z}_n)^\\times$.",
            '**Birleşme, değişmelilik ve birim:** Tam sayı çarpmasından miras alınır; $\\gcd(1, n) = 1$ olduğundan $1 \\in (\\mathbb{Z}_n)^\\times$ birim elemandır.',
            `**Ters eleman:** $\\gcd(a, n) = 1$ için Bézout özdeşliği $ax + ny = 1$ sağlayan $x, y \\in \\mathbb{Z}$ verir; $ax \\equiv 1 \\pmod n$ ve $\\gcd(x, n) = 1$ olduğundan $(x \\bmod n) \\in (\\mathbb{Z}_n)^\\times$ elemanı $a$'nın tersidir.`,
          ],
          checklist: [
            '$\\gcd(a,n)=\\gcd(b,n)=1 \\implies \\gcd(ab,n)=1$ ile kapalılık kanıtlandı.',
            'Birleşme, değişmelilik ve birim eleman $1$ doğrulandı.',
            'Bézout özdeşliği $ax + ny = 1$ kullanılarak tersin varlığı ve $(\\mathbb{Z}_n)^\\times$ içinde kaldığı gösterildi.',
          ],
        },
      ];
    }

    return {
      title: `Modüler Çarpma Simetrisi: $(\\mathbb{Z}_{${n}})^\\times$`,
      story: `$(\\mathbb{Z}_{${n}}, \\times)$ yapısı sıfır ve sıfır bölenleri nedeniyle grup olmasa da yalnızca $${n}$ ile aralarında asal elemanlara (birimlere) kısıtlandığında şifreleme ve ayrık Fourier simetrilerinde temel rol oynayan $(\\mathbb{Z}_{${n}})^\\times$ grubu elde edilir.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// =====================================================================
// 14. ps1-izomorfizma-testi — Isomorphic or not (classic finite + R pairs)
// =====================================================================

const ISO_PAIRS = [
  // Finite pairs
  {
    id: 'z6-s3', levels: ['isinma', 'odev'],
    gTex: '\\mathbb{Z}_6', hTex: 'S_3', iso: false, order: 6,
    model: { id: 'cayley', params: { kind: 'S', n: 3 } },
    invOpt: 'Değişmelilik (Abelyen olma) farkı',
    invDistractors: ['Eleman sayısı (mertebe) farkı', 'Birim eleman sayısı farkı', 'Her ikisinde de 2 mertebeli eleman olmaması'],
    q2Prompt: '$S_3$ grubunda mertebesi $2$ olan kaç eleman vardır? (Oysa $\\mathbb{Z}_6$ içinde yalnızca $1$ tane vardır.)',
    q2Spec: { type: 'int', value: 3 },
    q2Sol: '$S_3$ içinde $(12), (13), (23)$ olmak üzere **3** adet mertebe-$2$ eleman (transpozisyon) vardır; $\\mathbb{Z}_6$' + "'da yalnızca $3$ elemanı mertebe $2$ taşır.",
    why: '$\\mathbb{Z}_6$ değişmelidir (ve devirlidir, mertebesi $6$ olan eleman içerir), oysa $S_3$ değişmeli değildir ($(12)(23)=(123) \\neq (132)=(23)(12)$) ve en büyük eleman mertebesi $3$' + "'tür.",
  },
  {
    id: 'z4-u5', levels: ['isinma', 'odev'],
    gTex: '\\mathbb{Z}_4', hTex: '(\\mathbb{Z}_5)^\\times', iso: true, order: 4,
    model: { id: 'cayley', params: { kind: 'U', n: 5 } },
    genImages: [2, 3],
    q2Prompt: '$(\\mathbb{Z}_5)^\\times$ grubunda mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 1 },
    q2Sol: '$(\\mathbb{Z}_5)^\\times = \\{1, 2, 3, 4\\}$ içinde yalnızca $4 \\equiv -1$ elemanı mertebe $2$ taşır (**1** adet).',
    why: '$(\\mathbb{Z}_5)^\\times = \\{1, 2, 3, 4\\}$ grubunda $2^1=2, 2^2=4, 2^3=3, 2^4=1$ olduğundan $2$ (ve $3$) üreteçtir: $\\varphi(k) = 2^k \\bmod 5$ bir izomorfizmadır.',
  },
  {
    id: 'z4-u8', levels: ['isinma', 'odev'],
    gTex: '\\mathbb{Z}_4', hTex: '(\\mathbb{Z}_8)^\\times', iso: false, order: 4,
    model: { id: 'cayley', params: { kind: 'U', n: 8 } },
    invOpt: 'Eleman mertebeleri dağılımı (devirli olma) farkı',
    invDistractors: ['Değişmelilik (Abelyen olma) farkı', 'Grup mertebesi (eleman sayısı) farkı', 'Birim elemanın varlığı'],
    q2Prompt: '$(\\mathbb{Z}_8)^\\times = \\{1, 3, 5, 7\\}$ grubunda mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 3 },
    q2Sol: '$3^2 = 9 \\equiv 1$, $5^2 = 25 \\equiv 1$, $7^2 = 49 \\equiv 1 \\pmod 8$: birim dışı tüm **3** elemanın mertebesi $2$' + "'dir ($\\cong V_4$).",
    why: 'Her iki grup da $4$ elemanlı ve Abelyendir; ancak $\\mathbb{Z}_4$ devirlidir (mertebesi $4$ olan eleman vardır), oysa $(\\mathbb{Z}_8)^\\times$ içinde $x^2 \\equiv 1 \\pmod 8$ tüm elemanlar için sağlanır (en büyük mertebe $2$).',
  },
  {
    id: 'v4-z4', levels: ['isinma', 'odev'],
    gTex: '\\mathbb{Z}_2 \\times \\mathbb{Z}_2', hTex: '\\mathbb{Z}_4', iso: false, order: 4,
    model: { id: 'cayley', params: { kind: 'D', n: 2 } },
    invOpt: 'Eleman mertebeleri dağılımı (devirli olma) farkı',
    invDistractors: ['Değişmelilik (Abelyen olma) farkı', 'Grup mertebesi farkı', 'Normal alt grup olmaması'],
    q2Prompt: '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ grubunda mertebesi $4$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 0 },
    q2Sol: '$\\mathbb{Z}_2 \\times \\mathbb{Z}_2$ içinde her $(a, b)$ için $(a, b) + (a, b) = (0, 0)$ olduğundan mertebesi $4$ olan **0** eleman vardır.',
    why: 'İkisi de $4$ elemanlı Abelyen gruplardır; ancak $\\mathbb{Z}_4$' + "'te $1$ ve $3$ mertebe $4$ taşırken $\\mathbb{Z}_2 \\times \\mathbb{Z}_2$'de birim dışındaki her elemanın mertebesi $2$'dir.",
  },
  {
    id: 'z4-u10', levels: ['isinma', 'odev'],
    gTex: '\\mathbb{Z}_4', hTex: '(\\mathbb{Z}_{10})^\\times', iso: true, order: 4,
    model: { id: 'cayley', params: { kind: 'U', n: 10 } },
    genImages: [3, 7],
    q2Prompt: '$(\\mathbb{Z}_{10})^\\times = \\{1, 3, 7, 9\\}$ grubunda mertebesi $4$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 2 },
    q2Sol: '$3^2 = 9, 3^3 = 7, 3^4 = 1$ ve $7^2 = 9, 7^3 = 3, 7^4 = 1 \\pmod{10}$: mertebesi $4$ olan **2** eleman ($3$ ve $7$) vardır.',
    why: '$(\\mathbb{Z}_{10})^\\times$ mertebesi $4$ olan devirli bir gruptur; $\\varphi(k) = 3^k \\bmod 10$ (veya $7^k \\bmod 10$) açık izomorfizmadır.',
  },
  {
    id: 'v4-u8', levels: ['isinma'],
    gTex: '\\mathbb{Z}_2 \\times \\mathbb{Z}_2', hTex: '(\\mathbb{Z}_8)^\\times', iso: true, order: 4,
    model: { id: 'cayley', params: { kind: 'U', n: 8 } },
    nonCycIso: true,
    q2Prompt: 'Her iki grupta da mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 3 },
    q2Sol: 'Her iki grupta da birim dışındaki **3** elemanın hepsi mertebe $2$ taşır; örneğin $(1,0) \\mapsto 3$, $(0,1) \\mapsto 5$, $(1,1) \\mapsto 7$ bir izomorfizmadır.',
    why: 'İki grup da $4$ elemanlı Abelyen olup birim dışındaki tüm elemanları mertebe $2$ taşır ($\\cong V_4$); $(a, b) \\mapsto 3^a 5^b \\bmod 8$ açık izomorfizmadır.',
  },
  {
    id: 'z6-u7', levels: ['odev'],
    gTex: '\\mathbb{Z}_6', hTex: '(\\mathbb{Z}_7)^\\times', iso: true, order: 6,
    model: { id: 'cayley', params: { kind: 'U', n: 7 } },
    genImages: [3, 5],
    q2Prompt: '$(\\mathbb{Z}_7)^\\times$ grubunda mertebesi $3$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 2 },
    q2Sol: '$2^3 = 8 \\equiv 1$ ve $4^3 = 64 \\equiv 1 \\pmod 7$: mertebesi $3$ olan **2** eleman ($2$ ve $4$) vardır ($\\mathbb{Z}_6$' + "'daki $2$ ve $4$ gibi).",
    why: '$3$ ve $5$ elemanlarının mod $7$ mertebesi $6$ olduğundan $(\\mathbb{Z}_7)^\\times$ devirlidir ve $\\varphi(k) = 3^k \\bmod 7$ bir izomorfizmadır.',
  },
  {
    id: 'z6-u9', levels: ['odev', 'zorlayici'],
    gTex: '\\mathbb{Z}_6', hTex: '(\\mathbb{Z}_9)^\\times', iso: true, order: 6,
    model: { id: 'cayley', params: { kind: 'U', n: 9 } },
    genImages: [2, 5],
    q2Prompt: '$(\\mathbb{Z}_9)^\\times = \\{1, 2, 4, 5, 7, 8\\}$ grubunda mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 1 },
    q2Sol: 'Yalnızca $8 \\equiv -1 \\pmod 9$ elemanı mertebe $2$ taşır (**1** adet).',
    why: '$2^1=2, 2^2=4, 2^3=8, 2^4=7, 2^5=5, 2^6=1 \\pmod 9$ olduğundan $(\\mathbb{Z}_9)^\\times = \\langle 2 \\rangle \\cong \\mathbb{Z}_6$.',
  },
  {
    id: 'd4-z8', levels: ['odev'],
    gTex: 'D_4', hTex: '\\mathbb{Z}_8', iso: false, order: 8,
    model: { id: 'cayley', params: { kind: 'D', n: 4 } },
    invOpt: 'Değişmelilik (Abelyen olma) farkı',
    invDistractors: ['Grup mertebesi farkı', 'Birim eleman sayısı farkı', 'Alt grup bulunmaması'],
    q2Prompt: '$D_4$ grubunda mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 5 },
    q2Sol: '$D_4$ içinde dört yansıma ($s, rs, r^2s, r^3s$) ve $r^2$ olmak üzere **5** adet mertebe-$2$ eleman vardır (oysa $\\mathbb{Z}_8$' + "'de yalnızca $1$ tane).",
    why: 'İkisi de $8$ elemanlıdır; fakat $\\mathbb{Z}_8$ Abelyen iken $D_4$ değişmeli değildir ($rs \\neq sr = r^3s$).',
  },
  {
    id: 'u15-u16', levels: ['zorlayici'],
    gTex: '(\\mathbb{Z}_{15})^\\times', hTex: '(\\mathbb{Z}_{16})^\\times', iso: true, order: 8,
    model: { id: 'cayley', params: { kind: 'U', n: 15 } },
    nonCycIso: true,
    q2Prompt: 'Her iki grupta da mertebesi $4$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 4 },
    q2Sol: 'İki grup da $\\mathbb{Z}_2 \\times \\mathbb{Z}_4$' + "'e izomorfiktir: $1$ eleman mertebe $1$, $3$ eleman mertebe $2$ ve **4** eleman mertebe $4$ taşır.",
    why: '$(\\mathbb{Z}_{15})^\\times \\cong (\\mathbb{Z}_3)^\\times \\times (\\mathbb{Z}_5)^\\times \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_4$; $(\\mathbb{Z}_{16})^\\times = \\langle -1 \\rangle \\times \\langle 3 \\rangle \\cong \\mathbb{Z}_2 \\times \\mathbb{Z}_4$. Aynı mertebe dağılımlı sonlu Abelyen gruplar izomorfiktir!',
  },
  {
    id: 'u15-u24', levels: ['zorlayici'],
    gTex: '(\\mathbb{Z}_{15})^\\times', hTex: '(\\mathbb{Z}_{24})^\\times', iso: false, order: 8,
    model: { id: 'cayley', params: { kind: 'U', n: 24 } },
    invOpt: 'Eleman mertebeleri dağılımı (en büyük mertebe $4$ vs $2$)',
    invDistractors: ['Değişmelilik (Abelyen olma) farkı', 'Grup mertebesi farkı', 'Alt grupların normal olmaması'],
    q2Prompt: '$(\\mathbb{Z}_{24})^\\times = \\{1, 5, 7, 11, 13, 17, 19, 23\\}$ grubunda mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 7 },
    q2Sol: '$5^2=25\\equiv 1, 7^2=49\\equiv 1, \\dots$: birim dışı tüm **7** elemanın karesi $1 \\pmod{24}$ olur ($\\cong \\mathbb{Z}_2^3$).',
    why: 'İkisi de $8$ elemanlı Abelyen gruplardır; ancak $(\\mathbb{Z}_{15})^\\times$ içinde $2$ elemanının mertebesi $4$ iken $(\\mathbb{Z}_{24})^\\times$ içinde her $a$ için $a^2 \\equiv 1 \\pmod{24}$ sağlanır.',
  },
  {
    id: 'd6-s3z2', levels: ['zorlayici'],
    gTex: 'D_6', hTex: 'S_3 \\times \\mathbb{Z}_2', iso: true, order: 12,
    model: { id: 'cayley', params: { kind: 'D', n: 6 } },
    nonCycIso: true,
    q2Prompt: 'Her iki grupta da mertebesi $2$ olan toplam kaç eleman vardır?',
    q2Spec: { type: 'int', value: 7 },
    q2Sol: '$D_6$' + "'da $6$ yansıma ve $r^3$ olmak üzere **7** eleman; $S_3 \\times \\mathbb{Z}_2$'de $(e, 1)$ ve $(\\tau, 0), (\\tau, 1)$ ($3$ transpozisyon $\\times 2$) = $1 + 6 = 7$ eleman.",
    why: '$D_6$ içinde $N = \\langle r^2, s \\rangle \\cong D_3 \\cong S_3$ ve merkez $Z = \\langle r^3 \\rangle \\cong \\mathbb{Z}_2$ normal alt gruplardır; $N \\cap Z = \\{e\\}$ ve $NZ = D_6$ olduğundan $D_6 \\cong S_3 \\times \\mathbb{Z}_2$.',
  },
  // Infinite R pairs explicitly required by prompt
  {
    id: 'r-add-rpos-mul', levels: ['odev', 'zorlayici'],
    gTex: '(\\mathbb{R}, +)', hTex: '(\\mathbb{R}_{>0}, \\cdot)', iso: true, infinite: true,
    expIso: true,
    q2Prompt: 'Bu izomorfizmada toplamsal birim $0 \\in (\\mathbb{R}, +)$ elemanı $(\\mathbb{R}_{>0}, \\cdot)$ grubunda hangi sayıya gider?',
    q2Spec: { type: 'int', value: 1 },
    q2Sol: 'Her grup homomorfizması birimi birime taşır: $\\varphi(0) = e^0 = 1$.',
    why: '$\\varphi(x) = e^x$ dönüşümü $\\mathbb{R} \\to \\mathbb{R}_{>0}$ bijektiftir (tersi $\\ln y$) ve $\\varphi(x + y) = e^{x+y} = e^x e^y = \\varphi(x)\\varphi(y)$ homomorfizma koşulunu sağlar.',
  },
  {
    id: 'r-add-rnz-mul', levels: ['odev', 'zorlayici'],
    gTex: '(\\mathbb{R}, +)', hTex: '(\\mathbb{R} \\setminus \\{0\\}, \\cdot)', iso: false, infinite: true,
    rnzNonIso: true,
    q2Prompt: '$(\\mathbb{R}, +)$ toplamsal grubunda mertebesi $2$ olan kaç eleman vardır?',
    q2Spec: { type: 'int', value: 0 },
    q2Sol: '$x + x = 0 \\implies 2x = 0 \\implies x = 0$ (birim eleman). Dolayısıyla mertebesi $2$ olan **0** eleman vardır.',
    why: '$(\\mathbb{R} \\setminus \\{0\\}, \\cdot)$ grubunda $-1 \\neq 1$ elemanı $(-1)^2 = 1$ sağladığı için mertebe $2$ taşır; oysa $(\\mathbb{R}, +)$ grubunda $2x = 0 \\implies x = 0$ olduğundan mertebesi $2$ olan hiçbir eleman yoktur.',
  },
];

const T_IZOMORFIZMA_TESTI = {
  id: 'ps1-izomorfizma-testi',
  topic: 'İzomorfizma ve Birimler',
  title: 'İzomorfik mi, Değil mi? Değişmezler ve Açık Eşlemeler',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    const pool = ISO_PAIRS.filter(p => p.levels.includes(level));
    const pair = rng.pick(pool);

    const rawParts = [
      {
        prompt: `$${pair.gTex}$ ve $${pair.hTex}$ grupları birbirine **izomorfik** ($${pair.gTex} \\cong ${pair.hTex}$) midir?`,
        kind: 'answer',
        answer: { type: 'yesno', value: pair.iso },
        hints: level === 'zorlayici'
          ? ['Değişmelilik, eleman mertebeleri dağılımı ve üreteç varlığı gibi izomorfizma değişmezlerini karşılaştırın.']
          : [
            'İki grup izomorfikse mertebeleri, değişmelilik durumları ve her mertebedeki eleman sayıları birebir aynı olmalıdır.',
            pair.iso ? 'İki grup aynı temel cebirsel yapıya sahiptir; açık bir bijektif homomorfizma kurulabilir.' : 'İki grup arasında değişmezlerden en az biri (Abelyenlik veya eleman mertebeleri) uyuşmuyor.',
            pair.why,
          ],
        solution: [pair.why, `Sonuç: **${pair.iso ? 'Evet, izomorfiktir' : 'Hayır, izomorfik değildir'}**.`],
      },
    ];

    // Part (b): explicit isomorphism or distinguishing invariant
    if (pair.genImages) {
      rawParts.push({
        prompt: `$${pair.gTex} \\xrightarrow{\\sim} ${pair.hTex}$ izomorfizmasında üreteç $1 \\in ${pair.gTex}$ elemanının gidebileceği tüm geçerli $\\varphi(1) \\in ${pair.hTex}$ değerlerini küme olarak yazın.`,
        kind: 'answer',
        answer: { type: 'intset', value: pair.genImages },
        hints: [
          `Bir izomorfizma $${pair.gTex}$ üretecini $${pair.hTex}$ üretecine (mertebesi $${pair.order}$ olan bir elemana) göndermelidir.`,
          `$${pair.hTex}$ içinde mertebesi tam $${pair.order}$ olan elemanları bulun.`,
        ],
        solution: [
          `$${pair.hTex}$ içindeki tüm üreteçler: $${intSetTex(pair.genImages)}$. Her biri $\\varphi(k) = g^k$ formülüyle bir izomorfizma tanımlar.`,
        ],
      });
    } else if (pair.expIso) {
      const expChoice = shuffleChoice(
        rng,
        '$\\varphi(x) = e^x$ (tersi $\\varphi^{-1}(y) = \\ln y$)',
        ['$\\varphi(x) = x^2$', '$\\varphi(x) = |x| + 1$', '$\\varphi(x) = x + 1$']
      );
      rawParts.push({
        prompt: `Aşağıdaki dönüşümlerden hangisi $(\\mathbb{R}, +) \\xrightarrow{\\sim} (\\mathbb{R}_{>0}, \\cdot)$ için açık bir grup izomorfizmasıdır?`,
        kind: 'answer',
        answer: expChoice,
        hints: [
          '$\\varphi(x + y) = \\varphi(x) \\cdot \\varphi(y)$ üstel yasasını sağlayan ve tüm $(0, \\infty)$ aralığını birebir örten fonksiyonu seçin.',
        ],
        solution: [
          '$e^{x+y} = e^x e^y$ eşitliği homomorfizma koşulunu, $\\ln: \\mathbb{R}_{>0} \\to \\mathbb{R}$ ters fonksiyonu da bijektifliği garanti eder: **$\\varphi(x) = e^x$**.',
        ],
      });
    } else if (pair.rnzNonIso) {
      rawParts.push({
        prompt: `$(\\mathbb{R} \\setminus \\{0\\}, \\cdot)$ çarpımsal grubunda mertebesi tam $2$ olan (yani $a \\neq 1$ ve $a^2 = 1$ sağlayan) tek gerçel sayı hangisidir?`,
        kind: 'answer',
        answer: { type: 'int', value: -1 },
        hints: [
          '$a^2 = 1$ denkleminin $a = 1$ dışındaki gerçel kökünü yazın.',
        ],
        solution: [
          '$a^2 = 1 \\implies a = \\pm 1$. Birim eleman $1$ dışında mertebesi $2$ olan tek eleman **$-1$** olur.',
        ],
      });
    } else if (!pair.iso) {
      const invChoice = shuffleChoice(rng, pair.invOpt, pair.invDistractors);
      rawParts.push({
        prompt: `$${pair.gTex}$ ile $${pair.hTex}$ gruplarının izomorfik olmadığını en doğrudan gösteren **değişmez farkı** aşağıdakilerden hangisidir?`,
        kind: 'answer',
        answer: invChoice,
        hints: [
          'Önce iki grubun mertebelerinin eşit olduğuna dikkat edin; sonra Abelyenlik ve eleman mertebelerini karşılaştırın.',
        ],
        solution: [pair.why, `Ayırt edici değişmez: **${pair.invOpt}**.`],
      });
    } else {
      // nonCycIso finite isomorphic pair: ask group order or max order
      const maxOrdVal = pair.id === 'v4-u8' ? 2 : pair.id === 'u15-u16' ? 4 : 6;
      rawParts.push({
        prompt: `Hem $${pair.gTex}$ hem de $${pair.hTex}$ grubunda bir elemanın sahip olabileceği **en büyük** mertebe kaçtır?`,
        kind: 'answer',
        answer: { type: 'int', value: maxOrdVal },
        hints: [
          'İzomorfik gruplar aynı maksimum eleman mertebesini paylaşır.',
          pair.id === 'd6-s3z2' ? '$D_6$ içindeki $r$ dönmesinin (ve $S_3 \\times \\mathbb{Z}_2$ içindeki $((123), 1)$ elemanının) mertebesine bakın.' : 'Elemanların kuvvetlerini kontrol edin.',
        ],
        solution: [pair.why, `Her iki grupta da maksimum eleman mertebesi **$${maxOrdVal}$**.`],
      });
    }

    // Part (c): quantitative invariant check
    rawParts.push({
      prompt: pair.q2Prompt,
      kind: 'answer',
      answer: pair.q2Spec,
      hints: level === 'zorlayici'
        ? ['Elemanların mertebe denklemini ($g^k = e$) doğrudan çözerek sayın.']
        : ['Grup elemanlarını tek tek kontrol ederek verilen mertebedeki elemanları sayın.'],
      solution: [pair.q2Sol],
    });

    // Part (d) for odev / zorlayici: proof
    if (level !== 'isinma') {
      rawParts.push({
        prompt: pair.iso
          ? `**Kanıt:** $${pair.gTex} \\cong ${pair.hTex}$ izomorfizmasını açık bir $\\varphi$ dönüşümü yazarak (hem homomorfizma koşulunu hem de bijektifliği göstererek) kanıtlayın.`
          : `**Kanıt:** Bir grup izomorfizmasının değişmeliliği ve eleman mertebelerini koruduğunu kanıtlayın; ardından bu sonucu kullanarak $${pair.gTex} \\not\\cong ${pair.hTex}$ olduğunu ispatlayın.`,
        kind: 'proof',
        hints: pair.iso
          ? ['Açık $\\varphi$ formülünü verin, $\\varphi(a \\star b) = \\varphi(a) \\diamond \\varphi(b)$ eşitliğini doğrulayın ve birebir + örten olduğunu (ters dönüşümle veya sonlu eşit mertebede enjektiflikle) gösterin.']
          : ['$\\varphi(g^k) = \\varphi(g)^k$ ve $\\varphi(x) = e_H \\iff x = e_G$ özelliklerinden $|\\varphi(g)| = |g|$ olduğunu çıkarın, sonra iki gruptaki farkı belirtin.'],
        solution: pair.iso
          ? [pair.why, 'Hem işlem korunumu ($\\varphi(ab)=\\varphi(a)\\varphi(b)$) hem de birebir-örtenlik sağlandığından iki grup izomorfiktir.']
          : [
            'Bir $\\varphi: G \\xrightarrow{\\sim} H$ izomorfizması için $ab = ba \\implies \\varphi(a)\\varphi(b) = \\varphi(ab) = \\varphi(ba) = \\varphi(b)\\varphi(a)$ (değişmelilik korunur).',
            'Ayrıca $\\varphi(g)^k = e_H \\iff \\varphi(g^k) = \\varphi(e_G) \\iff g^k = e_G$ (birebirlikten), dolayısıyla $|\\varphi(g)| = |g|$ (her mertebedeki eleman sayısı korunur).',
            pair.why,
          ],
        checklist: pair.iso
          ? [
            'Açık bir $\\varphi$ eşlemesi tanımlandı.',
            'Homomorfizma özelliği $\\varphi(a \\star b) = \\varphi(a) \\diamond \\varphi(b)$ doğrulandı.',
            'Birebir ve örten olduğu (bijeksiyon) kanıtlandı.',
          ]
          : [
            'İzomorfizmanın değişmeliliği ve/veya eleman mertebelerini koruduğu ($|\\varphi(g)| = |g|$) kanıtlandı.',
            `$${pair.gTex}$ ve $${pair.hTex}$ arasındaki somut değişmez farkı açıkça gösterildi.`,
            'Çelişkiyle izomorfizma bulunamayacağı sonuçlandırıldı.',
          ],
      });
    }

    const prob = {
      title: `İzomorfizma Analizi: $${pair.gTex}$ ve $${pair.hTex}$`,
      story: `Farklı fiziksel veya cebirsel bağlamlarda ortaya çıkan iki grup, görünüşte farklı sembollerle yazılsa da aynı soyut yapıya sahip olabilir. $${pair.gTex}$ ile $${pair.hTex}$ gruplarının izomorfik olup olmadığını test edelim.`,
      parts: makeLabels(rawParts),
    };
    if (pair.model) prob.model = pair.model;
    return prob;
  },
};

// =====================================================================
// 15. ps1-cayley-teoremi — Cayley's theorem: left multiplication perms
// =====================================================================

function leftMulPermZ(n, g) {
  // Position i (1..n) corresponds to element i-1 in Z_n
  return Array.from({ length: n }, (_, idx) => mod(g + idx, n) + 1);
}

function leftMulPermD(n, g) {
  // Elements numbered 1..2n: dAll(n) = [e, r, ..., r^{n-1}, s, rs, ..., r^{n-1}s]
  const all = dAll(n);
  const idxOf = x => x.m * n + x.k + 1;
  return all.map(x => idxOf(dMul(n, g, x)));
}

const T_CAYLEY_TEOREMI = {
  id: 'ps1-cayley-teoremi',
  topic: 'Cayley Teoremi',
  title: 'Cayley Teoremi: Sol Çarpım Permütasyonları',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    if (level === 'isinma') {
      const n = rng.pick([4, 5, 6]);
      const g = rng.int(1, n - 1);
      const Lg = leftMulPermZ(n, g);
      const ordG = n / gcd(g, n);
      const mapStr = Array.from({ length: n }, (_, i) => `$${i + 1} \\leftrightarrow ${i}$`).join(', ');

      return {
        title: `Cayley Gömmesi: $\\mathbb{Z}_{${n}} \\hookrightarrow S_{${n}}$`,
        story: `Cayley teoremine göre her sonlu $G$ grubu, elemanlarını $1, \\dots, |G|$ şeklinde numaralayıp her $g \\in G$ elemanını $L_g(x) = g \\cdot x$ sol çarpım permütasyonuyla eşleyerek $S_{|G|}$ içine gömülebilir. $\\mathbb{Z}_{${n}}$ elemanlarını ${mapStr} olarak numaralayalım.`,
        model: { id: 'cayley', params: { kind: 'Z', n } },
        parts: makeLabels([
          {
            prompt: `$g = ${g} \\in \\mathbb{Z}_{${n}}$ için sol toplama permütasyonu $L_{${g}}(x) = ${g} + x \\pmod{${n}}$ dönüşümünü $1..${n}$ konumları üzerinde ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n, value: Lg },
            hints: [
              `Her $i$ konumu $(i - 1) \\in \\mathbb{Z}_{${n}}$ elemanını temsil eder; $+${g} \\pmod{${n}}$ eklenince hangi konuma gider?`,
              `İlk iki konum: $1 \\leftrightarrow 0 \\mapsto ${g} \\leftrightarrow ${Lg[0]}$, $2 \\leftrightarrow 1 \\mapsto ${mod(g + 1, n)} \\leftrightarrow ${Lg[1]}$.`,
              `Döngü gösterimi: $${cyclesString(Lg)}$.`,
            ],
            solution: [
              `Konum geçişleri: ${Lg.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')}.`,
              `Ayrık döngü gösterimi: **$L_{${g}} = ${cyclesString(Lg)}$**.`,
            ],
          },
          {
            prompt: `$L_{${g}}$ permütasyonunun kaç tane **sabit noktası** ($L_{${g}}(i) = i$) vardır?`,
            kind: 'answer',
            answer: { type: 'int', value: 0 },
            hints: [
              `$g + x \\equiv x \\pmod{${n}} \\implies g \\equiv 0 \\pmod{${n}}$.`,
              `$g = ${g} \\neq 0$ olduğu için hiçbir eleman sabit kalabilir mi?`,
              'Birim dışındaki her sol çarpım permütasyonu sabit noktasızdır ($0$).',
            ],
            solution: [
              `$g = ${g} \\neq 0$ olduğundan $g + x = x$ hiçbir $x$ için sağlanmaz; sabit nokta sayısı **0** (düzenli / sabit noktasız permütasyon).`,
            ],
          },
          {
            prompt: `$L_{${g}}$ permütasyonundaki her bir ayrık döngünün uzunluğu kaçtır?`,
            kind: 'answer',
            answer: { type: 'int', value: ordG },
            hints: [
              'Sol çarpım permütasyonu $L_g$' + "'nin tüm ayrık döngüleri aynı uzunluğa, yani $|g|$ mertebesine sahiptir.",
              `$\\mathbb{Z}_{${n}}$ içinde $|${g}| = ${n} / \\gcd(${g}, ${n})$.`,
              `Her döngü uzunluğu $${ordG}$ (toplam $${n / ordG}$ ayrık döngü).`,
            ],
            solution: [
              `$|${g}| = ${n}/\\gcd(${g}, ${n}) = ${ordG}$ olduğundan $L_{${g}} = ${cyclesString(Lg)}$ tam $${n / ordG}$ adet $${ordG}$-döngüsüne ayrılır; her döngünün uzunluğu **$${ordG}$**.`,
            ],
          },
        ]),
      };
    }

    if (level === 'odev') {
      const grpChoice = rng.pick(['D2', 'D3', 'Z6']);
      let titleG, storyList, model, N, g1Tex, g2Tex, g12Tex, p1, p2, p12;
      if (grpChoice === 'D2') {
        const n = 2; N = 4; titleG = 'D_2 \\cong V_4';
        model = { id: 'cayley', params: { kind: 'D', n: 2 } };
        const all = dAll(2);
        storyList = all.map((x, i) => `$${i + 1}: ${dTex(x)}$`).join(', ');
        const pair = rng.sample([dEl(2, 1, 0), dEl(2, 0, 1), dEl(2, 1, 1)], 2);
        const [g1, g2] = pair, g12 = dMul(2, g1, g2);
        g1Tex = dTex(g1); g2Tex = dTex(g2); g12Tex = dTex(g12);
        p1 = leftMulPermD(2, g1); p2 = leftMulPermD(2, g2); p12 = leftMulPermD(2, g12);
      } else if (grpChoice === 'D3') {
        const n = 3; N = 6; titleG = 'D_3';
        model = { id: 'cayley', params: { kind: 'D', n: 3 } };
        const all = dAll(3);
        storyList = all.map((x, i) => `$${i + 1}: ${dTex(x)}$`).join(', ');
        const g1 = dEl(3, rng.pick([1, 2]), 0);
        const g2 = dEl(3, rng.pick([0, 1, 2]), 1);
        const g12 = dMul(3, g1, g2);
        g1Tex = dTex(g1); g2Tex = dTex(g2); g12Tex = dTex(g12);
        p1 = leftMulPermD(3, g1); p2 = leftMulPermD(3, g2); p12 = leftMulPermD(3, g12);
      } else {
        const n = 6; N = 6; titleG = '\\mathbb{Z}_6';
        model = { id: 'cayley', params: { kind: 'Z', n: 6 } };
        storyList = Array.from({ length: 6 }, (_, i) => `$${i + 1}: ${i}$`).join(', ');
        const g1 = rng.pick([1, 2, 3, 4]);
        const g2 = rng.pick([1, 2, 3, 4, 5].filter(x => (g1 + x) % 6 !== 0 && x !== g1));
        const g12 = (g1 + g2) % 6;
        g1Tex = `${g1}`; g2Tex = `${g2}`; g12Tex = `${g12}`;
        p1 = leftMulPermZ(6, g1); p2 = leftMulPermZ(6, g2); p12 = leftMulPermZ(6, g12);
      }

      const propChoice = shuffleChoice(
        rng,
        'Sabit noktaları yoktur ve ayrık döngülerinin tümü eşit uzunluktadır (düzenli permütasyon)',
        [
          'Her biri yalnızca tek bir tam uzunluklu döngüden oluşur',
          'En az bir konumu mutlaka sabit bırakırlar',
          'Hepsi çift permütasyondur ($\\operatorname{sgn} = +1$)',
        ]
      );

      return {
        title: `Cayley Temsili ve Bileşke Kontrolü ($${titleG} \\hookrightarrow S_{${N}}$)`,
        story: `$${titleG}$ grubunun elemanlarını şu sırayla $1..${N}$ konumlarına yerleştirelim: ${storyList}. Her $g$ için sol çarpım permütasyonu $L_g(x) = g \\cdot x$ tanımlanır (bileşke sağdan sola okunur).`,
        model,
        parts: makeLabels([
          {
            prompt: `$g_1 = ${g1Tex}$ için $L_{g_1} \\in S_{${N}}$ permütasyonunu ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: N, value: p1 },
            hints: [
              `Her $i$ konumundaki elemanı soldan $${g1Tex}$ ile çarpıp yeni konum numarasını bulun.`,
              `Konum $1$ (birim $e$) doğrudan $${g1Tex}$ elemanının konumuna ($${p1[0]}$) gider.`,
            ],
            solution: [
              `Geçişler: ${p1.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')} $\\implies$ **$L_{g_1} = ${cyclesString(p1)}$**.`,
            ],
          },
          {
            prompt: `$g_2 = ${g2Tex}$ için $L_{g_2} \\in S_{${N}}$ permütasyonunu ayrık döngü gösteriminde yazın.`,
            kind: 'answer',
            answer: { type: 'perm', n: N, value: p2 },
            hints: [
              `Her $i$ konumundaki elemanı soldan $${g2Tex}$ ile çarpın ($1 \\mapsto ${p2[0]}$).`,
            ],
            solution: [
              `Geçişler: ${p2.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')} $\\implies$ **$L_{g_2} = ${cyclesString(p2)}$**.`,
            ],
          },
          {
            prompt: `Sağdan sola bileşkeyle $L_{g_1} \\circ L_{g_2}$ permütasyonunu hesaplayın (bu aynı zamanda $L_{g_1 g_2} = L_{${g12Tex}}$ olmalıdır).`,
            kind: 'answer',
            answer: { type: 'perm', n: N, value: p12 },
            hints: [
              `Önce $L_{g_2} = ${cyclesString(p2)}$, sonra $L_{g_1} = ${cyclesString(p1)}$ uygulayın.`,
              `Homomorfizma özelliği gereği sonuç $L_{${g12Tex}}$ ile aynı çıkmalıdır.`,
            ],
            solution: [
              `$L_{g_1} \\circ L_{g_2} = ${cyclesString(p1)} \\circ ${cyclesString(p2)} = ${cyclesString(p12)} = L_{${g12Tex}}$.`,
            ],
          },
          {
            prompt: `Cayley gömmesinde birim dışındaki ($g \\neq e$) tüm sol çarpım permütasyonları $L_g$ hangi ortak yapısal özelliği paylaşır?`,
            kind: 'answer',
            answer: propChoice,
            hints: [
              '$g x = x \\implies g = e$ eşitliğinden sabit nokta olup olmayacağına ve $g^k x = x \\iff g^k = e$ eşitliğinden döngü uzunluklarına bakın.',
            ],
            solution: [
              '$g \\neq e$ iken $g x = x$ imkânsızdır (sabit nokta yok) ve her $x$ için en küçük $g^k x = x$ üssü $x$' + "'ten bağımsız olarak $|g|$'ye eşittir; yani tüm döngüler $|g|$ uzunluğunda (düzenli permütasyon) olur.",
            ],
          },
        ]),
      };
    }

    // zorlayici: D_3 or D_4
    const n = rng.pick([3, 4]);
    const N = 2 * n;
    const all = dAll(n);
    const storyList = all.map((x, i) => `$${i + 1}: ${dTex(x)}$`).join(', ');
    const g1 = dEl(n, rng.int(1, n - 1), 0);
    const g2 = dEl(n, rng.int(0, n - 1), 1);
    const prod = dMul(n, g1, g2);
    const p1 = leftMulPermD(n, g1);
    const p2 = leftMulPermD(n, g2);
    const p12 = leftMulPermD(n, prod);

    return {
      title: `Cayley Teoremi: $D_{${n}} \\hookrightarrow S_{${N}}$ Düzenli Temsili`,
      story: `$D_{${n}}$ elemanlarını ${storyList} olarak numaralayıp her $g \\in D_{${n}}$ için sol çarpım permütasyonu $L_g(x) = g \\cdot x$ tanımlayalım.`,
      model: { id: 'cayley', params: { kind: 'D', n } },
      parts: makeLabels([
        {
          prompt: `Dönme $g_1 = ${dTex(g1)}$ için $L_{g_1} \\in S_{${N}}$ permütasyonunu ayrık döngü gösteriminde yazın.`,
          kind: 'answer',
          answer: { type: 'perm', n: N, value: p1 },
          hints: [
            `Her elemanı soldan $${dTex(g1)}$ ile çarpın; dönmeler dönmelere, yansımalar yansımalara gider.`,
          ],
          solution: [
            `Geçişler: ${p1.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')} $\\implies$ **$L_{${dTex(g1)}} = ${cyclesString(p1)}$** (döngü tipi: $${cycleType(p1).join(', ')}$).`,
          ],
        },
        {
          prompt: `Yansıma $g_2 = ${dTex(g2)}$ için $L_{g_2} \\in S_{${N}}$ permütasyonunu ayrık döngü gösteriminde yazın.`,
          kind: 'answer',
          answer: { type: 'perm', n: N, value: p2 },
          hints: [
            `Soldan $${dTex(g2)}$ ile çarpım dönme bloğunu ($1..${n}$) yansıma bloğuyla ($${n + 1}..${N}$) takas eder; tüm döngüler $2$-döngüdür.`,
          ],
          solution: [
            `Geçişler: ${p2.map((to, i) => `$${i + 1} \\mapsto ${to}$`).join(', ')} $\\implies$ **$L_{${dTex(g2)}} = ${cyclesString(p2)}$**.`,
          ],
        },
        {
          prompt: `$L_{g_1} \\circ L_{g_2} = L_w$ eşitliğini sağlayan $w \\in D_{${n}}$ elemanını normal biçimde ($r^k s^m$) bulun.`,
          kind: 'answer',
          answer: { type: 'dihedral', n, value: prod },
          hints: [
            'Cayley gömmesi bir homomorfizma olduğundan $L_{g_1} \\circ L_{g_2} = L_{g_1 g_2}$ (sağdan sola bileşkeyle $1$ konumunun görüntüsü $w$ olur).',
          ],
          solution: [
            `$L_{g_1} \\circ L_{g_2} = ${cyclesString(p12)}$, burada $1 \\mapsto ${p12[0]}$ yani $w = ${dTex(g1)} \\cdot ${dTex(g2)} = ${dTex(prod)}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** Cayley teoremini tam olarak kanıtlayın: (i) her $g \\in G$ için $L_g: G \\to G$ bir bijeksiyondur, (ii) $\\Phi(g) = L_g$ dönüşümü $G \\to S_{|G|}$ birebir bir grup homomorfizmasıdır, (iii) $g \\neq e$ için $L_g$ sabit noktasızdır ve her ayrık döngüsü $|g|$ uzunluğundadır.',
          kind: 'proof',
          hints: [
            '(i) için tersi $L_{g^{-1}}$; (ii) için $L_g(L_h(x)) = g(hx) = (gh)x$ ve $L_g = \\operatorname{id} \\implies g = L_g(e) = e$; (iii) için $L_g^k(x) = g^k x = x \\iff g^k = e$.',
          ],
          solution: [
            '**(i) Bijeksiyon:** $L_{g^{-1}}(L_g(x)) = g^{-1}(gx) = x$ ve $L_g(L_{g^{-1}}(x)) = x$ olduğundan $L_g$ tersinir, yani $G$ üzerinde bir permütasyondur.',
            '**(ii) Birebir homomorfizma:** Birleşme aksiyomundan $(L_g \\circ L_h)(x) = g(hx) = (gh)x = L_{gh}(x)$, dolayısıyla $\\Phi(gh) = \\Phi(g) \\circ \\Phi(h)$. Ayrıca $L_g = L_h \\implies L_g(e) = L_h(e) \\implies g = h$, yani $\\ker(\\Phi) = \\{e\\}$ (birebir).',
            '**(iii) Düzenlilik:** Herhangi bir $x \\in G$ için $L_g^k(x) = x \\iff g^k x = x \\iff g^k = e$ (sağdan kısaltma). Dolayısıyla $g \\neq e$ için $k=1$ olamaz (sabit noktasız) ve $x$' + "'in bulunduğu döngünün uzunluğu $x$'ten bağımsız olarak tam $|g|$ olur (toplam $|G|/|g|$ ayrık döngü).",
          ],
          checklist: [
            '$L_{g^{-1}}$ ile $L_g$' + "'nin bijektif olduğu gösterildi.",
            '$(L_g \\circ L_h)(x) = L_{gh}(x)$ homomorfizma özelliği ve $L_g(e) = g$ üzerinden birebirlik kanıtlandı.',
            '$g^k x = x \\iff g^k = e$ ile sabit noktasızlık ve tüm döngülerin $|g|$ uzunluğunda olduğu gösterildi.',
          ],
        },
      ]),
    };
  },
};

// =====================================================================
// 16. ps1-goreli-hiz — Relativistic velocity addition, rapidity, Galilean limit
// =====================================================================

function vAdd(u, v) { return (u + v) / (1 + u * v); }

const T_GORELI_HIZ = {
  id: 'ps1-goreli-hiz',
  topic: 'Fizikte Grup Yapısı',
  title: 'Göreli Hız Toplamı, Rapidite ve Galilei Limiti',
  source: 'PS1',
  levels: ['isinma', 'odev', 'zorlayici'],
  generate(rng, level) {
    // Use integer tenths so exact rational fractions are crisp and include classic pairs like (0.5, 0.5) -> 0.8 and (0.6, 0.7) -> 65/71
    let u10, v10;
    if (level === 'isinma') {
      const pairs = [[5, 5], [6, 7], [4, 5], [2, 5], [6, 8], [5, 8], [3, 6], [4, 7], [2, 8], [5, 6], [3, 5], [4, 6]];
      [u10, v10] = rng.pick(pairs);
    } else {
      const pool = [-8, -6, -5, -4, -3, 2, 3, 4, 5, 6, 7, 8];
      u10 = rng.pick(pool);
      v10 = rng.pick(pool.filter(x => x !== -u10 && (level === 'zorlayici' ? x !== u10 : true)));
    }
    const u = u10 / 10, v = v10 / 10;
    const sumNum = 10 * (u10 + v10);
    const sumDen = 100 + u10 * v10;
    const uvExact = vAdd(u, v);
    const uvVal = roundNum(uvExact, 4);
    const uvFrac = fmtFrac(sumNum, sumDen);

    const model = { id: 'velocity', params: { u, v } };
    const uStr = u < 0 ? `(${u})` : `${u}`;
    const vStr = v < 0 ? `(${v})` : `${v}`;

    const rawParts = [
      {
        prompt: `Doğal birimlerde ($c = 1$) $u = ${u}$ ve $v = ${v}$ hızlarının göreli toplamı $u \\oplus v = \\frac{u + v}{1 + uv}$ değerini hesaplayın (kesir veya en az 3 ondalık basamakla yazın).`,
        kind: 'answer',
        answer: { type: 'number', value: uvVal, tol: 0.002 },
        hints: level === 'zorlayici'
          ? ['$u \\oplus v = (u + v) / (1 + uv)$ formülünü doğrudan uygulayın.']
          : [
            `Pay: $u + v = ${u} + ${vStr} = ${roundNum(u + v, 2)}$.`,
            `Payda: $1 + uv = 1 + (${u})(${v}) = ${roundNum(1 + u * v, 4)}$.`,
            `Oran: $${uvFrac} \\approx ${uvVal}$.`,
          ],
        solution: [
          `$u \\oplus v = \\frac{${u} + ${vStr}}{1 + (${u})(${v})} = \\frac{${roundNum(u + v, 2)}}{${roundNum(1 + u * v, 4)}} = ${uvFrac} \\approx ${uvVal}$.`,
        ],
      },
    ];

    if (level === 'isinma') {
      rawParts.push(
        {
          prompt: `$((-1, 1), \\oplus)$ grubunda $u = ${u}$ hızının tersi $u^{-1}$ kaçtır?`,
          kind: 'answer',
          answer: { type: 'number', value: -u, tol: 1e-4 },
          hints: [
            '$u \\oplus x = 0$ denklemini çözmelisiniz.',
            `$\\frac{${u} + x}{1 + ${u}x} = 0 \\implies ${u} + x = 0$.`,
            `Fiziksel olarak aynı büyüklükte fakat ters yönde hız: $x = ${-u}$.`,
          ],
          solution: [
            `$u \\oplus (-u) = \\frac{${u} + (${-u})}{1 - (${u})^2} = 0$ olduğundan $u^{-1} = ${-u}$.`,
          ],
        },
        {
          prompt: `$((-1, 1), \\oplus)$ grubunun birim elemanı kaçtır?`,
          kind: 'answer',
          answer: { type: 'int', value: 0 },
          hints: [
            'Her $u \\in (-1, 1)$ için $u \\oplus e = u$ olmalıdır.',
            'Duran gözlemcinin hızı $e = 0$ hızları değiştirmez.',
            `$u \\oplus 0 = (u + 0)/(1 + 0) = u$.`,
          ],
          solution: [
            `$u \\oplus 0 = \\frac{u + 0}{1 + u \\cdot 0} = u$ olduğundan birim eleman **0** olur.`,
          ],
        },
        {
          prompt: `Aynı doğrultudaki göreli hız toplamı $\\oplus$ değişmeli (Abelyen) midir?`,
          kind: 'answer',
          answer: { type: 'yesno', value: true },
          hints: [
            '$u \\oplus v$ formülünde $u$ ve $v$' + "'nin yerlerini değiştirin.",
            '$u + v = v + u$ ve $uv = vu$.',
            'Formül $u$ ile $v$ arasında tamamen simetriktir.',
          ],
          solution: [
            '$u \\oplus v = \\frac{u + v}{1 + uv} = \\frac{v + u}{1 + vu} = v \\oplus u$ olduğundan **Evet, değişmelidir**.',
          ],
        }
      );
    } else if (level === 'odev') {
      const phiU = roundNum(Math.atanh(u), 4);
      const phiV = roundNum(Math.atanh(v), 4);
      const phiSum = roundNum(Math.atanh(u) + Math.atanh(v), 4);
      const galChoice = shuffleChoice(
        rng,
        '$(\\mathbb{R}, +)$ — Galilei toplamsal hız grubu',
        [
          '$(\\mathbb{R}_{>0}, \\cdot)$ — pozitif ölçekleme grubu',
          '$\\mathbb{Z}_2$ — parite grubu',
          '$U(1)$ — düzlem dönme grubu',
        ]
      );
      rawParts.push(
        {
          prompt: `$u = ${u}$ hızına karşılık gelen **rapidite** (çabukluk) parametresi $\\phi_u = \\operatorname{arctanh}(u) = \\frac{1}{2}\\ln\\frac{1+u}{1-u}$ değerini en az 3 ondalık basamakla hesaplayın.`,
          kind: 'answer',
          answer: { type: 'number', value: phiU, tol: 0.003 },
          hints: [
            `$\\frac{1 + u}{1 - u} = \\frac{${roundNum(1 + u, 2)}}{${roundNum(1 - u, 2)}}$ oranının doğal logaritmasının yarısını alın.`,
            `$\\phi_u = \\frac{1}{2}\\ln\\left(${roundNum((1 + u) / (1 - u), 4)}\\right)$.`,
          ],
          solution: [
            `$\\phi_u = \\operatorname{arctanh}(${u}) = \\frac{1}{2}\\ln\\frac{${roundNum(1 + u, 2)}}{${roundNum(1 - u, 2)}} \\approx ${phiU}$.`,
          ],
        },
        {
          prompt: `Bileşik hız $u \\oplus v$ için rapidite $\\phi_{u \\oplus v} = \\operatorname{arctanh}(u \\oplus v) = \\phi_u + \\phi_v$ değerini en az 3 ondalık basamakla bulun.`,
          kind: 'answer',
          answer: { type: 'number', value: phiSum, tol: 0.003 },
          hints: [
            'Rapiditeler doğrusal olarak toplanır: $\\phi_{u \\oplus v} = \\phi_u + \\phi_v$.',
            `$\\phi_v = \\operatorname{arctanh}(${v}) \\approx ${phiV}$ değerini $\\phi_u \\approx ${phiU}$ ile toplayın.`,
          ],
          solution: [
            `$\\phi_v = \\operatorname{arctanh}(${v}) \\approx ${phiV}$.`,
            `$\\phi_{u \\oplus v} = \\phi_u + \\phi_v \\approx ${phiU} + (${phiV}) = ${phiSum}$ (kontrol: $\\tanh(${phiSum}) \\approx ${uvVal} = u \\oplus v$).`,
          ],
        },
        {
          prompt: `Işık hızı $c$'yi geri yazıp $u \\oplus_c v = \\frac{u + v}{1 + uv/c^2}$ ifadesinde $c \\to \\infty$ (göreli olmayan) limiti alındığında hangi grup elde edilir?`,
          kind: 'answer',
          answer: galChoice,
          hints: [
            '$c \\to \\infty$ iken $uv/c^2 \\to 0$ ve izinli hız aralığı $(-c, c) \\to (-\\infty, \\infty) = \\mathbb{R}$ olur.',
          ],
          solution: [
            '$\\lim_{c \\to \\infty} \\frac{u+v}{1 + uv/c^2} = u + v$ ve $(-c, c) \\to \\mathbb{R}$ olduğundan **$(\\mathbb{R}, +)$ — Galilei toplamsal hız grubu** geri kazanılır.',
          ],
        },
        {
          prompt: '**Kanıt:** (i) Her $u, v \\in (-1, 1)$ için $u \\oplus v \\in (-1, 1)$ (kapalılık) olduğunu gösterin, (ii) $\\tanh: (\\mathbb{R}, +) \\to ((-1, 1), \\oplus)$ dönüşümünün bir **grup izomorfizması** olduğunu kanıtlayın.',
          kind: 'proof',
          hints: [
            '(i) için $1 - (u \\oplus v)$ ve $1 + (u \\oplus v)$ ifadelerini çarpanlarına ayırın.',
            '(ii) için $\\tanh(\\phi_1 + \\phi_2)$ toplam formülünü ve $\\tanh$' + "'ın artan/sürekli bijeksiyon olduğunu kullanın.",
          ],
          solution: [
            '**(i) Kapalılık:** $|u|, |v| < 1 \\implies 1 + uv > 0$ ve $1 - u, 1 - v, 1 + u, 1 + v > 0$.',
            '$1 - (u \\oplus v) = \\frac{(1 - u)(1 - v)}{1 + uv} > 0$ ve $1 + (u \\oplus v) = \\frac{(1 + u)(1 + v)}{1 + uv} > 0$, dolayısıyla $-1 < u \\oplus v < 1$.',
            '**(ii) İzomorfizma:** $\\tanh: \\mathbb{R} \\to (-1, 1)$ kesin artan ve sürekli olup $\\lim_{\\phi \\to \\pm\\infty} \\tanh\\phi = \\pm 1$ olduğundan bijektiftir (tersi $\\operatorname{arctanh}$).',
            'Hiperbolik toplam özdeşliği: $\\tanh(\\phi_1 + \\phi_2) = \\frac{\\tanh\\phi_1 + \\tanh\\phi_2}{1 + \\tanh\\phi_1 \\tanh\\phi_2} = \\tanh(\\phi_1) \\oplus \\tanh(\\phi_2)$.',
          ],
          checklist: [
            '$1 \\pm (u \\oplus v) = \\frac{(1 \\pm u)(1 \\pm v)}{1 + uv} > 0$ ile kapalılık ($|u \\oplus v| < 1$) gösterildi.',
            '$\\tanh: \\mathbb{R} \\to (-1, 1)$ dönüşümünün bijeksiyon olduğu (tersi $\\operatorname{arctanh}$) belirtildi.',
            '$\\tanh(\\phi_1 + \\phi_2) = \\tanh\\phi_1 \\oplus \\tanh\\phi_2$ homomorfizma eşitliği doğrulandı.',
          ],
        }
      );
    } else {
      // zorlayici: 3-frame chain u ⊕ v ⊕ w and solve u ⊕ x = v
      const wPool = [-7, -5, -3, 3, 4, 5, 6, 7].filter(w10 => Math.abs(sumNum + w10 * sumDen / 10) > 1);
      const w10 = rng.pick(wPool);
      const w = w10 / 10;
      const uvwExact = vAdd(uvExact, w);
      const uvwVal = roundNum(uvwExact, 4);
      // Solve u ⊕ x = v  =>  x = v ⊕ (-u) = (v - u) / (1 - uv)
      const xNum = 10 * (v10 - u10);
      const xDen = 100 - u10 * v10;
      const xExact = vAdd(v, -u);
      const xVal = roundNum(xExact, 4);
      const xFrac = fmtFrac(xNum, xDen);

      rawParts.push(
        {
          prompt: `Üçüncü bir gözlem çerçevesi $w = ${w}$ hızıyla eklendiğinde üçlü bileşim $(u \\oplus v) \\oplus w$ hızını bulun (en az 3 ondalık basamakla).`,
          kind: 'answer',
          answer: { type: 'number', value: uvwVal, tol: 0.002 },
          hints: [
            'Birleşme yasası (veya rapidite toplamı $\\tanh(\\phi_u + \\phi_v + \\phi_w)$) ile $(u \\oplus v)$ sonucunu $w$ ile yeniden $\\oplus$ işlemine sokun.',
          ],
          solution: [
            `$(u \\oplus v) \\oplus w = \\frac{${uvFrac} + (${w})}{1 + (${uvFrac})(${w})} \\approx ${uvwVal}$ (rapidite kontrolü: $\\tanh(\\operatorname{arctanh}(${u}) + \\operatorname{arctanh}(${v}) + \\operatorname{arctanh}(${w})) \\approx ${uvwVal}$).`,
          ],
        },
        {
          prompt: `$((-1, 1), \\oplus)$ grubunda $u \\oplus x = v$ denklemini sağlayan $x$ hızını bulun (kesir veya en az 3 ondalık basamakla).`,
          kind: 'answer',
          answer: { type: 'number', value: xVal, tol: 0.002 },
          hints: [
            'Her iki yanı $u$' + "'nun tersi $(-u)$ ile $\\oplus$ işlemine sokun: $x = v \\oplus (-u) = \\frac{v - u}{1 - uv}$.",
          ],
          solution: [
            `$x = (-u) \\oplus v = \\frac{${v} - ${uStr}}{1 - (${u})(${v})} = ${xFrac} \\approx ${xVal}$.`,
          ],
        },
        {
          prompt: '**Kanıt:** $\\tanh: (\\mathbb{R}, +) \\xrightarrow{\\sim} ((-1, 1), \\oplus)$ bijektif eşlemesini kullanarak $((-1, 1), \\oplus)$ yapısının **birleşme dahil tüm grup aksiyomlarını** sağladığını kısa yoldan kanıtlayın ve $c \\to \\infty$ limitinde rapiditenin $\\phi \\approx v/c$ ile Galilei toplamsal grubuna indirgendiğini gösterin.',
          kind: 'proof',
          hints: [
            '$u = \\tanh\\phi_1, v = \\tanh\\phi_2, w = \\tanh\\phi_3$ yazıp $(u \\oplus v) \\oplus w = \\tanh((\\phi_1 + \\phi_2) + \\phi_3)$ üzerinden birleşmeyi tek satırda çıkarın.',
          ],
          solution: [
            'Her $u, v, w \\in (-1, 1)$ için benzersiz $\\phi_1, \\phi_2, \\phi_3 \\in \\mathbb{R}$ rapiditeleri ($u = \\tanh\\phi_1$, vb.) vardır.',
            '**Kapalılık ve birleşme:** $(u \\oplus v) \\oplus w = \\tanh(\\phi_1 + \\phi_2) \\oplus \\tanh\\phi_3 = \\tanh((\\phi_1 + \\phi_2) + \\phi_3) = \\tanh(\\phi_1 + (\\phi_2 + \\phi_3)) = u \\oplus (v \\oplus w) \\in (-1, 1)$.',
            '**Birim, ters, değişmelilik:** $\\tanh(0) = 0$ birim, $\\tanh(-\\phi) = -\\tanh\\phi = -u$ ters ve $\\phi_1 + \\phi_2 = \\phi_2 + \\phi_1$ değişmeliliktir.',
            '**Galilei limiti:** $v/c \\ll 1$ iken $\\phi = \\operatorname{arctanh}(v/c) = \\frac{v}{c} + \\mathcal{O}((v/c)^3)$, dolayısıyla $c\\,\\phi \\to v$ ve $u \\oplus_c v = \\frac{u+v}{1 + uv/c^2} \\xrightarrow{c \\to \\infty} u + v$, yani $(\\mathbb{R}, +)$ elde edilir.',
          ],
          checklist: [
            '$u = \\tanh\\phi$ dönüşümü üzerinden kapalılık ve birleşmenin $(\\mathbb{R}, +)$' + "'dan doğrudan aktarıldığı gösterildi.",
            'Birim ($0$), ters ($-u$) ve değişmelilik kanıtlandı.',
            '$c \\to \\infty$ limitinde $u \\oplus_c v \\to u + v$ ve $\\phi \\approx v/c$ ile $(\\mathbb{R}, +)$ Galilei grubu elde edildi.',
          ],
        }
      );
    }

    return {
      title: `Özel Görelilikte Eşdoğrusal Hız Toplamı ($${u} \\oplus ${v}$)`,
      story: `Tek boyutlu bir parçacık hızlandırıcısında $S'$ gözlem çerçevesi laboratuvara göre $u = ${u}\\,c$ hızıyla, bir parçacık ise $S'$ çerçevesine göre $v = ${v}\\,c$ hızıyla hareket ediyor. Özel görelilikte hızlar $u \\oplus v = \\frac{u+v}{1+uv}$ ($c = 1$) kuralıyla birleşir ve $(-1, 1)$ aralığında bir Abelyen grup oluşturur.`,
      model,
      parts: makeLabels(rawParts),
    };
  },
};

// ---------- export ----------

export const TEMPLATES = [
  T_GRUP_AKSIYOMLARI,
  T_DEFORME_ISLEM,
  T_ESLEME_MERTEBE2,
  T_DN_KELIME_PERM,
  T_DN_YANSIMA_EKSENI,
  T_DN_ALTGRUPLAR,
  T_ZN_MERTEBE_URETEC,
  T_ZN_ALTGRUP_KAFESI,
  T_DN_KOSETLER,
  T_LAGRANGE_SONUCLARI,
  T_HOM_ZM_ZN,
  T_HOM_DET_U1,
  T_BIRIMLER_GRUBU,
  T_IZOMORFIZMA_TESTI,
  T_CAYLEY_TEOREMI,
  T_GORELI_HIZ,
];
