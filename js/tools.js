// Engineering tools. math.js and KaTeX are globals loaded from CDN.
import { S, persist } from './db.js';
import { esc, icon } from './ui.js';

// ---------- shared evaluator ----------
export const scope = {};
let ready = false;
function init() {
  if (ready) return; ready = true;
  Object.assign(scope, {
    j: math.complex(0, 1),
    par: (...a) => math.divide(1, a.reduce((s, x) => math.add(s, math.divide(1, x)), 0)), // parallel: par(R1, R2, ...)
    pol: (m, deg) => math.complex({ abs: m, arg: deg * Math.PI / 180 }),                   // polar → complex, degrees
    ang: z => math.arg(math.complex(z)) * 180 / Math.PI,                                    // angle in degrees
    db: x => 20 * Math.log10(math.abs(x)),
  });
}
const SI = { T: 'e12', G: 'e9', M: 'e6', k: 'e3', m: 'e-3', u: 'e-6', 'µ': 'e-6', n: 'e-9', p: 'e-12' };
// "4.7k" → 4.7e3, "5∠30" → pol(5,30), "Ω" → ohm. "5 m" (with space) stays the unit metre.
export const prep = s => s
  .replace(/Ω/g, 'ohm')
  .replace(/(\d+(?:\.\d+)?(?:e-?\d+)?[TGMkmuµnp]?)\s*∠\s*(-?\d+(?:\.\d+)?)/g, 'pol($1,$2)')
  .replace(/(^|[^A-Za-z_\d.])(\d+(?:\.\d+)?)([TGMkmuµnp])(?![A-Za-z_(\dµ])/g, (_, a, d, p) => a + d + SI[p]);
export function evaluate(expr, extra) { init(); return math.evaluate(prep(expr), extra ? Object.assign({}, scope, extra) : scope); }

const num = x => String(+x.toPrecision(6));
const PFX = { 12: 'T', 9: 'G', 6: 'M', 3: 'k', '-3': 'm', '-6': 'µ', '-9': 'n', '-12': 'p', '-15': 'f' };
export const eng = x => {
  const a = Math.abs(x); if (!a || a >= 1e15 || a < 1e-15 || (a >= 1 && a < 1000)) return '';
  const e = Math.floor(Math.log10(a) / 3) * 3; return PFX[e] ? `${+(x / 10 ** e).toPrecision(5)}${PFX[e]}` : '';
};
export function fmt(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'function') return 'fonksiyon tanımlandı';
  if (typeof v === 'boolean') return v ? 'doğru' : 'yanlış';
  if (typeof v === 'number') { const e = eng(v); return num(v) + (e ? `   ≈ ${e}` : ''); }
  if (v.isComplex) {
    if (Math.abs(v.im) < 1e-12) return fmt(v.re);
    const rect = `${num(v.re)} ${v.im < 0 ? '−' : '+'} j${num(Math.abs(v.im))}`;
    return `${rect}   =   ${num(v.abs())} ∠ ${num(v.arg() * 180 / Math.PI)}°`;
  }
  if (Array.isArray(v.entries)) return v.entries.map(fmt).join('\n'); // ResultSet (multi-line input)
  return math.format(v, { precision: 6 }).replace(/(\d)i\b/g, '$1j');
}

// ---------- shared: one-line intro + clickable examples ----------
function intro(text, examples = []) {
  return `<div class="tool-intro"><p>${text}</p>${examples.length ? `<div class="ex-row"><span class="mute small">Örnek dene:</span>${examples.map((e, i) => `<button type="button" class="chip ex" data-ex="${i}">${esc(e[0])}</button>`).join('')}</div>` : ''}</div>`;
}
function bindExamples(el, examples, apply) {
  el.querySelector('.ex-row')?.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) apply(examples[+b.dataset.ex]); });
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const short = v => fmt(v).split('   ')[0];

// ---------- calculator ----------
const hist = [];
const BUILTIN = new Set(['j', 'par', 'pol', 'ang', 'db', 'ans']);
const KEYS = {
  Temel: ['7', '8', '9', '÷', '(', ')', '4', '5', '6', '×', '^', '√', '1', '2', '3', '−', 'π', ',', '0', '.', 'ans', '+', '⌫', 'C'],
  Mühendislik: ['j', '∠', 'par(', 'abs(', 'ang(', 'dB(', 'k', 'M', 'm', 'µ', 'n', 'p', 'Ω', 'V', 'A', 'W', 'Hz', 'F', 'H', 's', 'to', '⌫', 'C', 'e'],
  Fonksiyonlar: ['sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(', 'log10(', 'log(', 'exp(', 'sqrt(', 'x²', 'x', 're(', 'im(', 'conj(', 'deg', 'rad', '!', '⌫', 'C', '=', ';', '[', ']'],
};
const INS = { '÷': '/', '×': '*', '−': '-', '√': 'sqrt(', 'π': 'pi', 'dB(': 'db(', 'x²': '^2', 'Ω': ' ohm', V: ' V', A: ' A', W: ' W', Hz: ' Hz', F: ' F', H: ' H', s: ' s', to: ' to ', deg: ' deg', rad: ' rad', ',': ', ' };
const CALC_EX = [
  ['Paralel direnç', 'par(4.7k, 10k, 22k)'],
  ['Gerilim bölücü', '12 * 10k / (4.7k + 10k)'],
  ['Empedans (RL, 50 Hz)', 'Z = 10 + j*2*pi*50*100m'],
  ['Fazör çarpımı', '5∠30 * 2∠-45'],
  ['Rezonans frekansı', '1 / (2*pi*sqrt(10m * 100n))'],
  ['Birim çevirme', '5 kohm * 2 mA to V'],
  ['Türev', 'derivative("x^3 + 2x", "x")'],
  ['Denklem sistemi', 'lusolve([[2,1],[1,3]], [3,5])'],
];

export function mountCalc(el) {
  init();
  el.innerHTML = `${intro('Yaz, sonucu anında gör. Klavye ya da aşağıdaki tuşlarla kullan; <b>4.7k</b>, <b>5∠30</b>, <b>j</b> gibi mühendislik yazımları çalışır.', CALC_EX)}
    <div class="calc2">
      <div class="calc-main">
        <form class="calc-in"><input class="inp mono calc-field" placeholder="ör. par(4.7k, 10k)" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="İfade"><button class="btn primary calc-eq" aria-label="Hesapla">=</button></form>
        <div class="calc-live mono" aria-live="polite"></div>
        <div class="seg kp-tabs">${Object.keys(KEYS).map((k, i) => `<button type="button" data-kp="${k}" class="${i ? '' : 'on'}">${k}</button>`).join('')}</div>
        <div class="keypad" data-pad></div>
      </div>
      <div class="calc-side">
        <div class="calc-sec"><h4>Değişkenler</h4><div class="vars"></div></div>
        <div class="calc-sec grow"><h4>Geçmiş <button type="button" class="link small" data-clear>temizle</button></h4><div class="calc-out"></div></div>
      </div>
    </div>`;
  const inp = el.querySelector('input'), out = el.querySelector('.calc-out'), live = el.querySelector('.calc-live'), pad = el.querySelector('[data-pad]');
  let pi = hist.length, caret = null, touch = false;

  const drawPad = name => pad.innerHTML = KEYS[name].map(k => `<button type="button" class="key ${/^[0-9.]$/.test(k) ? 'num' : ''} ${['⌫', 'C'].includes(k) ? 'fn' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('');
  drawPad('Temel');
  const showHist = () => out.innerHTML = hist.length ? hist.slice().reverse().map((h, i) =>
    `<div class="calc-row" data-i="${hist.length - 1 - i}"><div class="q mono">${esc(h.q)}</div><div class="a mono ${h.err ? 'err' : ''}">${esc(h.a)}</div>${h.err ? '' : `<button type="button" class="copy" data-copy="${hist.length - 1 - i}" title="Sonucu kopyala" aria-label="Sonucu kopyala">${icon('download')}</button>`}</div>`).join('')
    : '<p class="mute small">Hesapladıkların burada birikir. Birine tıklarsan tekrar düzenlersin.</p>';
  const showVars = () => {
    const vs = Object.entries(scope).filter(([k]) => !BUILTIN.has(k));
    el.querySelector('.vars').innerHTML = vs.length ? vs.map(([k, v]) => `<span class="var"><button type="button" data-ins="${esc(k)}">${esc(k)}${typeof v === 'function' ? '(…)' : ` = ${esc(short(v))}`}</button><button type="button" class="x" data-del="${esc(k)}" aria-label="${esc(k)} sil">×</button></span>`).join('')
      : '<p class="mute small"><b class="mono">R = 4.7k</b> yazarsan R burada saklanır, sonra her yerde kullanırsın.</p>';
  };
  const preview = () => {
    const q = inp.value.trim();
    if (!q) { live.textContent = ''; live.className = 'calc-live mono'; return; }
    try { const v = evaluate(q, {}); live.textContent = v === undefined ? '' : '= ' + fmt(v); live.className = 'calc-live mono'; }
    catch { live.textContent = '…'; live.className = 'calc-live mono pending'; }
  };
  const insert = t => {
    const [s, e] = caret || [inp.value.length, inp.value.length];
    inp.value = inp.value.slice(0, s) + t + inp.value.slice(e);
    caret = [s + t.length, s + t.length];
    if (!touch) { inp.focus(); inp.setSelectionRange(...caret); }
    preview();
  };
  const remember = () => caret = [inp.selectionStart, inp.selectionEnd];
  ['keyup', 'click', 'blur', 'select'].forEach(ev => inp.addEventListener(ev, remember));
  inp.addEventListener('input', () => { remember(); preview(); });
  showHist(); showVars();

  el.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const q = inp.value.trim(); if (!q) return;
    try { const v = evaluate(q); if (v !== undefined && typeof v !== 'function') scope.ans = v; hist.push({ q, a: '= ' + fmt(v), v }); }
    catch (err) { hist.push({ q, a: err.message, err: 1 }); }
    if (hist.length > 200) hist.shift();
    pi = hist.length; inp.value = ''; caret = null; live.textContent = '';
    showHist(); showVars();
  };
  inp.onkeydown = e => {
    if (e.key === 'ArrowUp' && pi > 0) { inp.value = hist[--pi].q; e.preventDefault(); preview(); }
    if (e.key === 'ArrowDown') { pi = Math.min(hist.length, pi + 1); inp.value = hist[pi]?.q ?? ''; preview(); }
    if (e.key === 'Escape') { inp.value = ''; preview(); }
  };
  pad.addEventListener('pointerdown', e => { touch = e.pointerType === 'touch'; });
  pad.onclick = e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'C') { inp.value = ''; caret = null; preview(); }
    else if (k === '⌫') {
      const [s, en] = caret || [inp.value.length, inp.value.length], from = s === en ? Math.max(0, s - 1) : s;
      inp.value = inp.value.slice(0, from) + inp.value.slice(en); caret = [from, from]; preview();
    } else insert(INS[k] ?? k);
  };
  el.querySelector('.kp-tabs').onclick = e => {
    const b = e.target.closest('[data-kp]'); if (!b) return;
    el.querySelectorAll('[data-kp]').forEach(x => x.classList.toggle('on', x === b)); drawPad(b.dataset.kp);
  };
  el.querySelector('.vars').onclick = e => {
    const ins = e.target.closest('[data-ins]')?.dataset.ins, del = e.target.closest('[data-del]')?.dataset.del;
    if (ins) insert(ins);
    if (del) { delete scope[del]; showVars(); }
  };
  out.onclick = e => {
    const c = e.target.closest('[data-copy]');
    if (c) { navigator.clipboard?.writeText(short(hist[c.dataset.copy].v)); c.classList.add('done'); setTimeout(() => c.classList.remove('done'), 900); return; }
    const r = e.target.closest('.calc-row'); if (r) { inp.value = hist[r.dataset.i].q; caret = null; inp.focus(); preview(); }
  };
  el.querySelector('[data-clear]').onclick = () => { hist.length = 0; pi = 0; showHist(); };
  bindExamples(el, CALC_EX, ([, q]) => { inp.value = q; caret = null; preview(); el.querySelector('form').requestSubmit(); });
}

// ---------- plotting ----------
function ticks(a, b, n = 6) {
  const step0 = (b - a) / n, mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + step * 1e-9; v += step) out.push(+v.toPrecision(10));
  return out;
}
const fmtTick = v => { const a = Math.abs(v); return a && (a >= 1e4 || a < 1e-3) ? v.toExponential(0) : String(+v.toPrecision(4)); };
export const PLOT_COLORS = ['#f4f4f5', '#5ab0ff', '#ff6b6b', '#5be49b', '#ffd166', '#c084fc'];

export function plot(cv, series, { xlog = false, x0, x1, ylabel = '', height = 300 }) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = height;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = 54, R = 12, T = 12, Bm = 28, pw = W - L - R, ph = H - T - Bm;
  const ys = series.flatMap(s => s.ys).filter(Number.isFinite).sort((a, b) => a - b);
  let y0 = ys[Math.floor(ys.length * .01)] ?? -1, y1 = ys[Math.ceil(ys.length * .99) - 1] ?? 1;
  if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
  const padY = (y1 - y0) * .08; y0 -= padY; y1 += padY;
  const fx = xlog ? v => L + (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) * pw : v => L + (v - x0) / (x1 - x0) * pw;
  const fy = v => T + (y1 - v) / (y1 - y0) * ph;
  c.clearRect(0, 0, W, H);
  c.font = '11px "JetBrains Mono", monospace'; c.lineWidth = 1;
  const xt = xlog ? Array.from({ length: Math.floor(Math.log10(x1)) - Math.ceil(Math.log10(x0)) + 1 }, (_, i) => 10 ** (Math.ceil(Math.log10(x0)) + i)) : ticks(x0, x1);
  for (const v of xt) { const x = fx(v); c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.fillStyle = '#8b8b94'; c.textAlign = 'center'; c.fillText(fmtTick(v), x, H - 10); }
  for (const v of ticks(y0, y1, 5)) { const y = fy(v); c.strokeStyle = v === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke(); c.fillStyle = '#8b8b94'; c.textAlign = 'right'; c.fillText(fmtTick(v), L - 6, y + 4); }
  if (!xlog && x0 < 0 && x1 > 0) { c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(fx(0), T); c.lineTo(fx(0), T + ph); c.stroke(); }
  if (ylabel) { c.save(); c.translate(12, T + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillStyle = '#8b8b94'; c.fillText(ylabel, 0, 0); c.restore(); }
  c.save(); c.beginPath(); c.rect(L, T, pw, ph); c.clip();
  for (const s of series) {
    c.strokeStyle = s.color; c.lineWidth = 2; c.beginPath(); let pen = false;
    s.xs.forEach((x, i) => { const y = s.ys[i]; if (!Number.isFinite(y)) { pen = false; return; } pen ? c.lineTo(fx(x), fy(y)) : c.moveTo(fx(x), fy(y)); pen = true; });
    c.stroke();
  }
  c.restore();
  cv._map = { fx, fy, L, pw, x0, x1, xlog, series }; // for hover readout
}


const PLOT_EX = {
  f: [['Sinüs ve kosinüs', 'sin(x); cos(x)', '-10', '10'], ['Sönümlü salınım', 'exp(-x/5)*cos(2x)', '0', '30'], ['RC şarj eğrisi (τ = 1 s)', '5*(1 - exp(-x))', '0', '6'], ['Parabol ve doğru', 'x^2; 2x + 3', '-5', '5'], ['Diyot akımı', '1e-12*(exp(x/0.026) - 1)', '0', '0.7']],
  bode: [['1. derece alçak geçiren', '1 / (1 + s/1000)', '1', '1e6'], ['2. derece (ζ = 0.5)', '100 / (s^2 + 10s + 100)', '0.1', '1000'], ['Yüksek geçiren', 's / (s + 100)', '1', '1e5'], ['Bant geçiren', '100s / (s^2 + 100s + 1e6)', '10', '1e5'], ['İntegratör', '10 / s', '0.1', '1000']],
};
export function mountPlot(el) {
  init();
  el.innerHTML = `${intro('Fonksiyonu yaz, grafik <b>yazarken</b> güncellenir. Birden fazla eğri için <b>;</b> ile ayır. Bode için H(s) yaz. Grafiğin üstünde gezinerek değer oku.')}
    <div class="seg" role="tablist"><button class="on" data-m="f">y = f(x)</button><button data-m="bode">Bode (H(s))</button></div>
    <div class="ex-row" data-plot-ex></div>
    <form class="plot-form">
      <label class="grow"><span data-l>Fonksiyonlar</span><input class="inp mono" name="f" autocomplete="off" spellcheck="false"></label>
      <label><span data-l0>x min</span><input class="inp mono" name="a"></label>
      <label><span data-l1>x max</span><input class="inp mono" name="b"></label>
    </form>
    <div class="plot-legend mono small"></div>
    <div class="plot-box"><canvas class="plot"></canvas><div class="readout mono small"></div></div>
    <div class="plot-box" data-phase hidden><canvas class="plot"></canvas></div>`;
  const f = el.querySelector('form'), [cv1, cv2] = el.querySelectorAll('canvas'), leg = el.querySelector('.plot-legend'), exRow = el.querySelector('[data-plot-ex]');
  let mode = 'f';
  const saved = { f: PLOT_EX.f[0].slice(1), bode: PLOT_EX.bode[1].slice(1) };
  [f.f.value, f.a.value, f.b.value] = saved.f;
  function setMode(m) {
    saved[mode] = [f.f.value, f.a.value, f.b.value]; mode = m;
    [f.f.value, f.a.value, f.b.value] = saved[m];
    el.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    el.querySelector('[data-l]').textContent = m === 'f' ? 'Fonksiyonlar ( ; ile ayır)' : 'H(s) transfer fonksiyonu';
    el.querySelector('[data-l0]').textContent = m === 'f' ? 'x min' : 'ω min (rad/s)';
    el.querySelector('[data-l1]').textContent = m === 'f' ? 'x max' : 'ω max';
    el.querySelector('[data-phase]').hidden = m === 'f';
    exRow.innerHTML = `<span class="mute small">Örnek dene:</span>` + PLOT_EX[m].map((e, i) => `<button type="button" class="chip ex" data-ex="${i}">${esc(e[0])}</button>`).join('');
    draw();
  }
  function draw() {
    leg.textContent = '';
    try {
      const a = +evaluate(f.a.value), b = +evaluate(f.b.value);
      if (!(b > a)) throw new Error('Aralık geçersiz: max, min\'den büyük olmalı');
      if (mode === 'f') {
        const fns = f.f.value.split(';').map(s => s.trim()).filter(Boolean);
        if (!fns.length) throw new Error('Bir fonksiyon yaz, ör. sin(x)');
        const xs = Array.from({ length: 801 }, (_, i) => a + (b - a) * i / 800);
        const sc = Object.assign({}, scope);
        const series = fns.map((fn, k) => {
          const code = math.compile(prep(fn));
          return { name: fn, color: PLOT_COLORS[k % 6], xs, ys: xs.map(x => { sc.x = x; try { const v = code.evaluate(sc); return typeof v === 'number' ? v : v?.isComplex && Math.abs(v.im) < 1e-9 ? v.re : NaN; } catch { return NaN; } }) };
        });
        plot(cv1, series, { x0: a, x1: b });
        leg.innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
      } else {
        if (a <= 0) throw new Error('Bode için ω min 0\'dan büyük olmalı');
        const code = math.compile(prep(f.f.value)), sc = Object.assign({}, scope);
        const xs = Array.from({ length: 500 }, (_, i) => a * (b / a) ** (i / 499));
        const mag = [], ph = []; let prev = null, off = 0;
        for (const w of xs) {
          sc.s = math.complex(0, w);
          const h = math.complex(code.evaluate(sc));
          mag.push(20 * Math.log10(h.abs()));
          let p = h.arg() * 180 / Math.PI;
          if (prev !== null) { while (p + off - prev > 180) off -= 360; while (p + off - prev < -180) off += 360; } // unwrap
          prev = p + off; ph.push(prev);
        }
        plot(cv1, [{ name: '|H| dB', color: PLOT_COLORS[0], xs, ys: mag }], { xlog: true, x0: a, x1: b, ylabel: 'genlik dB', height: 240 });
        plot(cv2, [{ name: '∠H', color: PLOT_COLORS[1], xs, ys: ph }], { xlog: true, x0: a, x1: b, ylabel: 'faz °', height: 200 });
        const i3 = mag.findIndex(m => m < mag[0] - 3);
        leg.textContent = `Başlangıç kazancı: ${(Math.abs(mag[0]) < .005 ? 0 : mag[0]).toFixed(2)} dB` + (i3 > 0 ? ` · −3 dB kesim ≈ ${num(xs[i3])} rad/s (${num(xs[i3] / 2 / Math.PI)} Hz)` : '');
      }
    } catch (err) { leg.innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  }
  const later = debounce(draw, 250);
  f.addEventListener('input', later);
  f.onsubmit = e => { e.preventDefault(); draw(); };
  el.querySelector('.seg').onclick = e => e.target.dataset.m && setMode(e.target.dataset.m);
  exRow.onclick = e => { const b = e.target.closest('[data-ex]'); if (!b) return; [f.f.value, f.a.value, f.b.value] = PLOT_EX[mode][+b.dataset.ex].slice(1); draw(); };
  const ro = new ResizeObserver(() => draw()); ro.observe(el.querySelector('.plot-box'));
  setMode('f');
  const rd = el.querySelector('.readout');
  cv1.onpointermove = e => {
    const m = cv1._map; if (!m) return;
    const x = e.offsetX; if (x < m.L || x > m.L + m.pw) return rd.textContent = '';
    const t = (x - m.L) / m.pw, xv = m.xlog ? m.x0 * (m.x1 / m.x0) ** t : m.x0 + (m.x1 - m.x0) * t;
    const s = m.series[0], i = s.xs.reduce((bi, v, k) => Math.abs(v - xv) < Math.abs(s.xs[bi] - xv) ? k : bi, 0);
    rd.textContent = `${mode === 'f' ? 'x' : 'ω'} = ${num(s.xs[i])}   ${m.series.map(q => `${num(q.ys[i])}`).join('   ')}`;
  };
  cv1.onpointerleave = () => rd.textContent = '';
  return () => ro.disconnect();
}

// ---------- matrix / linear system (grid editor, solves as you type) ----------
const MAT_EX = [
  ['3 düğümlü devre', [['2', '-1', '0'], ['-1', '3', '-1'], ['0', '-1', '2']], ['5', '0', '-2']],
  ['2 bilinmeyenli', [['2', '1'], ['1', '3']], ['3', '5']],
  ['AC çevre analizi (kompleks)', [['10+5j', '-5'], ['-5', '8-3j']], ['10∠0', '0']],
  ['4×4 sistem', [['4', '-1', '0', '0'], ['-1', '4', '-1', '0'], ['0', '-1', '4', '-1'], ['0', '0', '-1', '3']], ['15', '10', '10', '10']],
];
export function mountMatrix(el) {
  init();
  el.innerHTML = `${intro('Katsayıları kutulara yaz, çözüm <b>anında</b> çıkar. Boş kutu 0 sayılır. Kompleks (3+4j), 4.7k ve 5∠30 yazabilirsin. Düğüm/çevre analizi için birebir.', MAT_EX)}
    <div class="row wrap mat-bar"><span class="mute small">Boyut</span><button type="button" class="icon-btn sm" data-sz="-1" aria-label="Küçült">−</button><b class="mono" data-size></b><button type="button" class="icon-btn sm" data-sz="1" aria-label="Büyüt">+</button>
      <button type="button" class="btn ghost small" data-zero>Temizle</button></div>
    <div class="mat-eq"><div class="mat-col"><span class="mute small">A (katsayılar)</span><div class="mat-grid2" data-A></div></div>
      <span class="mat-op mono">· x =</span><div class="mat-col"><span class="mute small">b (sağ taraf)</span><div class="mat-grid2" data-b></div></div></div>
    <div class="mat-res" data-res></div>
    <div class="row wrap" data-ops><span class="mute small">Ayrıca:</span><button type="button" class="chip" data-op="inv">A⁻¹ (ters)</button><button type="button" class="chip" data-op="eig">Özdeğerler</button><button type="button" class="chip" data-op="rank">Rank</button></div>
    <pre class="out mono" data-extra hidden></pre>`;
  let n = 3, A = MAT_EX[0][1].map(r => r.slice()), b = MAT_EX[0][2].slice();
  const gA = el.querySelector('[data-A]'), gb = el.querySelector('[data-b]'), res = el.querySelector('[data-res]'), extra = el.querySelector('[data-extra]');
  const cell = (v, r, c, k) => `<input class="inp mono cell" data-${k}="${r},${c}" value="${esc(v ?? '')}" inputmode="text" autocomplete="off" spellcheck="false" aria-label="${k === 'a' ? `A satır ${r + 1} sütun ${c + 1}` : `b satır ${r + 1}`}">`;
  function grid() {
    A = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => A[r]?.[c] ?? ''));
    b = Array.from({ length: n }, (_, r) => b[r] ?? '');
    el.querySelector('[data-size]').textContent = `${n} × ${n}`;
    gA.style.gridTemplateColumns = `repeat(${n}, 76px)`;
    gA.innerHTML = A.map((row, r) => row.map((v, c) => cell(v, r, c, 'a')).join('')).join('');
    gb.innerHTML = b.map((v, r) => cell(v, r, 0, 'b')).join('');
    solve();
  }
  const val = s => (String(s).trim() ? evaluate(String(s)) : 0);
  const isZero = v => math.abs(v) < 1e-12;
  function solve() {
    try {
      const M = A.map(r => r.map(val)), y = b.map(val), d = math.det(M);
      if (isZero(d)) { res.innerHTML = `<p class="warn">Matris tekil (det = 0): tek bir çözüm yok. Satırlardan biri diğerlerinin katı olabilir.</p>`; return; }
      const x = math.lusolve(M, y).map(r => r[0]);
      res.innerHTML = x.map((v, i) => `<div class="mat-x"><span class="mute small">x${i + 1}</span><b class="mono">${esc(short(v))}</b>${v.isComplex && Math.abs(v.im) > 1e-12 ? `<small class="mute mono">${esc(num(v.abs()))} ∠ ${esc(num(v.arg() * 180 / Math.PI))}°</small>` : ''}</div>`).join('')
        + `<div class="mat-x det"><span class="mute small">det(A)</span><b class="mono">${esc(short(d))}</b></div>`;
    } catch (err) { res.innerHTML = `<p class="warn">${esc(err.message.replace(/^Undefined symbol/, 'Tanımsız sembol'))}</p>`; }
  }
  const later = debounce(solve, 150);
  el.addEventListener('input', e => {
    const t = e.target, a = t.dataset.a, bb = t.dataset.b;
    if (a) { const [r, c] = a.split(',').map(Number); A[r][c] = t.value; later(); }
    if (bb) { b[+bb.split(',')[0]] = t.value; later(); }
  });
  // Enter jumps to the next box, like a spreadsheet
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.classList.contains('cell')) return;
    e.preventDefault(); const cells = [...el.querySelectorAll('.cell')]; cells[(cells.indexOf(e.target) + 1) % cells.length].focus();
  });
  el.querySelector('.mat-bar').onclick = e => {
    const sz = e.target.closest('[data-sz]')?.dataset.sz;
    if (sz) { n = Math.min(8, Math.max(2, n + +sz)); grid(); }
    if (e.target.closest('[data-zero]')) { A = []; b = []; grid(); }
  };
  el.querySelector("[data-ops]").onclick = e => {
    const op = e.target.dataset.op; if (!op) return;
    try {
      const M = A.map(r => r.map(val));
      extra.textContent = op === 'inv' ? math.inv(M).map(row => row.map(v => short(v).padStart(12)).join(' ')).join('\n')
        : op === 'rank' ? 'rank(A) = ' + math.qr(M).R.filter(row => row.some(v => math.abs(v) > 1e-10)).length
          : (() => { const ev = math.eigs(M).values; return (ev.toArray?.() ?? ev).map((v, i) => `λ${i + 1} = ${fmt(v)}`).join('\n'); })();
      extra.classList.remove('err');
    } catch (err) { extra.textContent = err.message; extra.classList.add('err'); }
    extra.hidden = false;
  };
  bindExamples(el, MAT_EX, ([, a, y]) => { n = a.length; A = a.map(r => r.slice()); b = y.slice(); extra.hidden = true; grid(); });
  grid();
}

// ---------- phasor converter ----------
const PH_EX = [['3 + 4j', { re: '3', im: '4' }], ['10∠45°', { m: '10', t: '45' }], ['Bobin: 10 Ω + 100 mH (50 Hz)', { re: '10', im: '2*pi*50*100m', f: '50' }], ['Kondansatör: 1 kΩ + 1 µF (1 kHz)', { re: '1k', im: '-1/(2*pi*1k*1u)', f: '1k' }]];
export function mountPhasor(el) {
  init();
  el.innerHTML = `${intro('Hangi kutuyu değiştirirsen diğerleri kendiliğinden güncellenir. Kutulara ifade de yazabilirsin (ör. <b>2*pi*50*0.1</b>). Frekans verirsen eşdeğer L/C ve zaman domeni ifadesi çıkar.', PH_EX)}
    <div class="ph-grid">
    <div class="card pad"><h4>Kartezyen</h4><label>Gerçel (Re)<input class="inp mono" data-k="re" value="3"></label><label>Sanal (Im)<input class="inp mono" data-k="im" value="4"></label></div>
    <div class="card pad"><h4>Kutupsal</h4><label>Genlik |Z|<input class="inp mono" data-k="m"></label><label>Açı θ (°)<input class="inp mono" data-k="t"></label></div>
    <div class="card pad"><h4>Frekans (isteğe bağlı)</h4><label>f (Hz)<input class="inp mono" data-k="f" value="50"></label><p class="mute small">Empedans olarak eşdeğeri:</p><div class="mono small" data-lc></div></div>
    <svg viewBox="-110 -110 220 220" class="ph-svg"><circle r="100" class="ph-c"/><path d="M-105 0H105M0 -105V105" class="ph-ax"/><text x="100" y="-6" class="ph-t">Re</text><text x="6" y="-98" class="ph-t">Im</text><line data-v x1="0" y1="0" class="ph-v"/><circle data-dot r="4" class="ph-d"/></svg>
  </div><p class="mono ph-time" data-time></p>`;
  const I = k => el.querySelector(`[data-k=${k}]`), num6 = v => String(+v.toPrecision(6));
  const val = k => { try { return +evaluate(I(k).value || '0'); } catch { return NaN; } };
  function sync(from) {
    let re = val('re'), im = val('im');
    if (from === 'p') { const m = val('m'), t = val('t') * Math.PI / 180; re = m * Math.cos(t); im = m * Math.sin(t); I('re').value = num6(re); I('im').value = num6(im); }
    else { I('m').value = num6(Math.hypot(re, im)); I('t').value = num6(Math.atan2(im, re) * 180 / Math.PI); }
    const m = Math.hypot(re, im) || 1, x = re / m * 95, y = -im / m * 95, v = el.querySelector('[data-v]');
    v.setAttribute('x2', x); v.setAttribute('y2', y);
    el.querySelector('[data-dot]').setAttribute('cx', x); el.querySelector('[data-dot]').setAttribute('cy', y);
    const w = 2 * Math.PI * val('f'), fmt = v => eng(v) || num6(v);
    el.querySelector('[data-lc]').textContent = !(w > 0) ? '' : im > 0 ? `R = ${fmt(re)} Ω,  L = ${fmt(im / w)} H` : im < 0 ? `R = ${fmt(re)} Ω,  C = ${fmt(-1 / (im * w))} F` : `Saf direnç: ${fmt(re)} Ω`;
    el.querySelector('[data-time]').textContent = `Zaman domeni: ${num6(Math.hypot(re, im))}·cos(${w > 0 ? num6(w) : 'ω'}t ${Math.atan2(im, re) < 0 ? '−' : '+'} ${num6(Math.abs(Math.atan2(im, re) * 180 / Math.PI))}°)`;
  }
  el.querySelectorAll('.ph-grid input').forEach(i => i.oninput = () => sync(['m', 't'].includes(i.dataset.k) ? 'p' : 'r'));
  bindExamples(el, PH_EX, ([, o]) => {
    for (const [k, v] of Object.entries(o)) I(k).value = v;
    sync(o.m ? 'p' : 'r');
  });
  sync('r');
}

// ---------- resistor color code (tap the colors) ----------
const RC = [['siyah', '#111'], ['kahverengi', '#7b4a12'], ['kırmızı', '#e53935'], ['turuncu', '#fb8c00'], ['sarı', '#fdd835'], ['yeşil', '#43a047'], ['mavi', '#1e88e5'], ['mor', '#8e24aa'], ['gri', '#9e9e9e'], ['beyaz', '#f5f5f5']];
const MULT = [...RC.map((c, i) => [...c, 10 ** i]), ['altın', '#d4af37', .1], ['gümüş', '#c0c0c0', .01]];
const TOL = [['kahverengi', '#7b4a12', 1], ['kırmızı', '#e53935', 2], ['yeşil', '#43a047', .5], ['mavi', '#1e88e5', .25], ['mor', '#8e24aa', .1], ['gri', '#9e9e9e', .05], ['altın', '#d4af37', 5], ['gümüş', '#c0c0c0', 10]];
const RES_EX = [['220 Ω', '220'], ['1 kΩ', '1k'], ['4.7 kΩ', '4.7k'], ['10 kΩ', '10k'], ['100 kΩ', '100k'], ['1 MΩ', '1M']];
export function mountResistor(el) {
  el.innerHTML = `${intro('Direncin üstündeki renklere <b>sırayla dokun</b>, değer anında çıkar. Ya da değeri yaz, renkleri göstersin.', RES_EX)}
    <div class="seg"><button class="on" data-n="4">4 bant</button><button data-n="5">5 bant</button></div>
    <div class="res-top"><svg viewBox="0 0 320 90" class="res-svg"><path d="M0 45h60M260 45h60" stroke="#888" stroke-width="4"/><rect x="60" y="18" width="200" height="54" rx="22" fill="#d9c7a3"/><g data-bands></g></svg>
      <div><p class="res-val mono"></p><p class="mute small" data-range></p></div></div>
    <div class="res-sel"></div>
    <form class="row" data-rev><input class="inp mono" placeholder="Değer yaz: 4.7k" style="max-width:220px" aria-label="Direnç değeri"><button class="btn">Renkleri göster</button></form>`;
  let n = 4, sel = [4, 7, 2, 6]; // 47 × 100 = 4.7k ±5%
  const sets = () => n === 4 ? [RC, RC, MULT, TOL] : [RC, RC, RC, MULT, TOL];
  const fmtOhm = v => (eng(v) || String(+v.toPrecision(6))) + ' Ω';
  function draw() {
    const S = sets();
    el.querySelector('.res-sel').innerHTML = S.map((set, i) => `<div class="band-row"><span class="band-l">${i < n - 2 ? `${i + 1}. hane` : i === n - 2 ? 'Çarpan' : 'Tolerans'}</span>
      <div class="swatches">${set.map((c, k) => `<button type="button" class="swatch ${sel[i] === k ? 'on' : ''}" data-i="${i}" data-k="${k}" style="--c:${c[1]}" title="${c[0]}${i === n - 2 ? ` ×${eng(c[2]) || c[2]}` : i === n - 1 ? ` ±${c[2]}%` : ` = ${k}`}" aria-label="${c[0]}"><span>${i < n - 2 ? k : ''}</span></button>`).join('')}</div>
      <span class="band-n mute small">${S[i][sel[i]][0]}</span></div>`).join('');
    const xs = n === 4 ? [85, 115, 145, 225] : [80, 105, 130, 155, 225];
    el.querySelector('[data-bands]').innerHTML = S.map((set, i) => `<rect x="${xs[i]}" y="18" width="14" height="54" fill="${set[sel[i]][1]}"/>`).join('');
    const digits = sel.slice(0, n - 2).reduce((a, d) => a * 10 + d, 0), v = digits * S[n - 2][sel[n - 2]][2], tol = S[n - 1][sel[n - 1]][2];
    el.querySelector('.res-val').textContent = `${fmtOhm(v)}  ±${tol}%`;
    el.querySelector('[data-range]').textContent = v ? `Gerçek değer ${fmtOhm(v * (1 - tol / 100))} ile ${fmtOhm(v * (1 + tol / 100))} arasında` : '';
  }
  el.querySelector('.res-sel').onclick = e => { const b = e.target.closest('.swatch'); if (b) { sel[+b.dataset.i] = +b.dataset.k; draw(); } };
  el.querySelector('.seg').onclick = e => {
    if (!e.target.dataset.n) return;
    n = +e.target.dataset.n; sel = n === 4 ? [4, 7, 2, 6] : [4, 7, 0, 1, 0];
    el.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === e.target)); draw();
  };
  const fromValue = text => {
    let v; try { v = +evaluate(text); } catch { return false; }
    if (!(v > 0)) return false;
    const d = n - 2; let exp = Math.floor(Math.log10(v)) - (d - 1), m = Math.round(v / 10 ** exp);
    if (m >= 10 ** d) { m /= 10; exp++; }
    const digits = String(m).padStart(d, '0').split('').map(Number), mi = exp === -1 ? 10 : exp === -2 ? 11 : exp;
    if (mi < 0 || mi > 11) return false;
    sel = [...digits, mi, sel[n - 1]]; draw(); return true;
  };
  el.querySelector('[data-rev]').onsubmit = e => { e.preventDefault(); if (!fromValue(e.target[0].value)) e.target[0].classList.add('bad'); };
  el.querySelector('[data-rev] input').oninput = e => e.target.classList.remove('bad');
  bindExamples(el, RES_EX, ([, v]) => { el.querySelector('[data-rev] input').value = v; fromValue(v); });
  draw();
}

// ---------- formula sheets (markdown-lite + KaTeX) ----------
export function renderNote(text) {
  const math_ = [];
  const keep = (tex, display) => { math_.push(katex.renderToString(tex, { throwOnError: false, strict: false, displayMode: display })); return `\u0000${math_.length - 1}\u0000`; };
  let s = (text || '').replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t.trim(), true)).replace(/\$([^$\n]+?)\$/g, (_, t) => keep(t, false));
  s = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let html = '', inList = false;
  for (const line of s.split('\n')) {
    const li = /^\s*[-*] (.*)/.exec(line);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${li[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    const h = /^(#{1,3}) (.*)/.exec(line);
    html += h ? `<h${h[1].length + 2}>${h[2]}</h${h[1].length + 2}>` : line.trim() ? `<p>${line}</p>` : '';
  }
  if (inList) html += '</ul>';
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => math_[i]) || '<p class="mute">Henüz formül yok. "Düzenle"ye bas ve ekle.</p>';
}


const TEX_SNIPS = [['Kesir', '\\dfrac{a}{b}'], ['Kök', '\\sqrt{x}'], ['Üs / indis', 'x_{1}^{2}'], ['İntegral', '\\int_{a}^{b} f(x)\\,dx'], ['Toplam', '\\sum_{n=0}^{N} a_n'], ['Türev', '\\dfrac{dy}{dx}'], ['Yunan', '\\alpha\\ \\beta\\ \\omega\\ \\Omega\\ \\tau\\ \\varepsilon'], ['Vektör', '\\vec{E}'], ['Matris', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'], ['Açı', '\\angle 30^\\circ']];
export function mountFormulas(el, courseId) {
  let cid = S.courses.some(c => c.id === courseId) ? courseId : S.courses[0]?.id, editing = false;
  if (!cid) { el.innerHTML = '<p class="mute">Önce bir ders ekle.</p>'; return; }
  el.innerHTML = `${intro('Her dersin kendi formül defteri. <b>Düzenle</b>\'ye bas; formül eklemek için aşağıdaki hazır kalıplara dokun, solda yazarken sağda düzgün halini görürsün.')}
    <div class="row wrap"><select class="inp" data-c style="max-width:260px" aria-label="Ders">${S.courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <button class="btn primary" data-edit>${icon('edit')} Düzenle</button></div>
    <div class="ex-row" data-snips hidden><span class="mute small">Ekle:</span>${TEX_SNIPS.map((s, i) => `<button type="button" class="chip ex" data-s="${i}">${esc(s[0])}</button>`).join('')}
      <button type="button" class="chip ex" data-raw="# ">Başlık</button><button type="button" class="chip ex" data-raw="- ">Madde</button></div>
    <div class="fx-wrap"><textarea class="inp mono fx-src" hidden spellcheck="false" aria-label="Formül metni"></textarea><div class="note card pad"></div></div>
    <details class="help"><summary>Yazım kuralları</summary><div class="small mono"><p># Başlık · - madde · **kalın**</p><p>Satır içi formül: $V = IR$ · Ayrı satırda büyük formül: $$\\int_0^T v(t)\\,dt$$</p></div></details>`;
  const ta = el.querySelector('textarea'), note = el.querySelector('.note'), sel = el.querySelector('[data-c]'), snips = el.querySelector('[data-snips]');
  const show = () => { sel.value = cid; ta.value = S.notes[cid] || ''; note.innerHTML = renderNote(ta.value); };
  const save = () => { S.notes[cid] = ta.value; note.innerHTML = renderNote(ta.value); persist(); };
  sel.onchange = () => { cid = sel.value; show(); };
  ta.oninput = save;
  snips.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const s = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? s, before = ta.value[s - 1];
    // start a new line at the end of the text, otherwise keep a space so $…$ never touches another $
    const pre = !s ? '' : s === ta.value.length && before !== '\n' ? '\n' : /\s/.test(before) ? '' : ' ';
    const t = pre + ('raw' in b.dataset ? b.dataset.raw : `$${TEX_SNIPS[+b.dataset.s][1]}$`);
    ta.value = ta.value.slice(0, s) + t + ta.value.slice(en);
    ta.focus(); ta.setSelectionRange(s + t.length, s + t.length); save();
  };
  el.querySelector('[data-edit]').onclick = e => {
    editing = !editing; ta.hidden = snips.hidden = !editing; el.querySelector('.fx-wrap').classList.toggle('split', editing);
    e.currentTarget.innerHTML = editing ? `${icon('check')} Bitti` : `${icon('edit')} Düzenle`;
    if (editing) ta.focus();
  };
  show();
}
