// Motion & visual effects. Everything respects the user's motion setting (html[data-motion]) and prefers-reduced-motion.
const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
export const motion = () => reduceQ.matches ? 'reduced' : (document.documentElement.dataset.motion || 'full');
export const full = () => motion() === 'full';

// Cards: soft light that follows the pointer (CSS reads --mx/--my).
document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const c = e.target.closest?.('.card, .pcard, .btn.primary');
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', e.clientX - r.left + 'px');
  c.style.setProperty('--my', e.clientY - r.top + 'px');
}, { passive: true });

// Staggered entrance for grids/lists in a freshly rendered view.
export function stagger(root) {
  if (motion() === 'off') return;
  root.querySelectorAll('.dash > *, .pgrid > *, .cgrid > *, .tabs > *, .set').forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 14)); el.classList.add('enter');
  });
}

// Numbers count up from 0 (or previous value) to their target: <b data-count="12">12</b>
export function countUp(root) {
  if (!full()) return;
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, suffix = el.dataset.suffix || '';
    if (!(to > 0)) return;
    const t0 = performance.now(), d = 700;
    const step = t => {
      const k = Math.min(1, (t - t0) / d), v = Math.round(to * (1 - (1 - k) ** 3));
      el.textContent = v + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// Page change with View Transitions when available. `named` = element that morphs (e.g. card thumb → board).
export async function transition(update) {
  if (!document.startViewTransition || !full() || document.hidden || !document.querySelector('#view > *')) return update();
  let done = false;
  const once = async () => { if (done) return; done = true; await update(); };
  const vt = document.startViewTransition(once);
  vt.ready.catch(() => {}); vt.finished.catch(() => {});
  // a stalled/skipped transition (e.g. window hidden) must never delay or blank the page
  await Promise.race([vt.updateCallbackDone.catch(() => {}), new Promise(r => setTimeout(r, 350))]);
  if (!done) { vt.skipTransition(); await once(); }
}

// Shooting star across the screen.
export function shootingStar(big = false) {
  if (motion() === 'off') return;
  const s = document.createElement('div');
  s.className = 'shoot' + (big ? ' big' : '');
  document.body.append(s); setTimeout(() => s.remove(), 1600);
}

// Supernova: shockwave ring + particles fading into star dust. Used when the daily goal is reached.
export function supernova(x = innerWidth / 2, y = innerHeight / 2) {
  if (!full()) return shootingStar(true);
  const cv = document.createElement('canvas'), dpr = devicePixelRatio || 1;
  cv.className = 'fx-layer'; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.append(cv);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const ps = Array.from({ length: 90 }, () => {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 2 + .6, life: 1 };
  });
  const t0 = performance.now(), D = 1400, maxR = Math.hypot(innerWidth, innerHeight);
  (function frame(t) {
    const k = (t - t0) / D;
    c.clearRect(0, 0, innerWidth, innerHeight);
    if (k < .45) { // shockwave
      const q = k / .45;
      c.beginPath(); c.arc(x, y, q * maxR * .6, 0, 7);
      c.strokeStyle = `rgba(255,255,255,${.5 * (1 - q)})`; c.lineWidth = 2 + 10 * (1 - q); c.stroke();
      const g = c.createRadialGradient(x, y, 0, x, y, 160 * (1 - q) + 20);
      g.addColorStop(0, `rgba(255,255,255,${.8 * (1 - q)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, innerWidth, innerHeight);
    }
    c.fillStyle = '#fff';
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.vx *= .965; p.vy *= .965;
      c.globalAlpha = Math.max(0, 1 - k) * (.5 + Math.random() * .5);
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    if (k < 1) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

// Short synthesized sounds (off unless enabled in settings). No audio files.
let actx;
export function sound(kind) {
  if (document.documentElement.dataset.sound !== 'on') return;
  try {
    actx ??= new AudioContext();
    const notes = { solve: [[880, 0], [1320, .09]], goal: [[660, 0], [990, .1], [1320, .2], [1760, .3]], timer: [[880, 0], [880, .25], [880, .5]] }[kind] || [];
    for (const [f, t] of notes) {
      const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime + t;
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.18, at + .01); g.gain.exponentialRampToValueAtTime(.0001, at + .35);
      o.start(at); o.stop(at + .4);
    }
  } catch { }
}

// Toolbar: a pill that slides to the active tool.
export function slideIndicator(bar, active) {
  let ind = bar.querySelector('.tb-ind');
  if (!ind) { ind = document.createElement('i'); ind.className = 'tb-ind'; bar.prepend(ind); }
  if (!active) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1;
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
  ind.style.width = active.offsetWidth + 'px';
}
