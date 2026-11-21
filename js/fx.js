// Motion & visual effects. Everything respects the user's motion setting (html[data-motion]) and prefers-reduced-motion.
const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
const phoneQ = matchMedia('(max-width: 820px)');
export const motion = () => reduceQ.matches ? 'reduced' : (document.documentElement.dataset.motion || 'full');
export const full = () => motion() === 'full';

const NS = 'http://www.w3.org/2000/svg';
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#f4f4f5';

// Pause decorative loops when the window is hidden or not focused (saves CPU/GPU and battery).
// Ambient CSS loops (planet, stars, glows) also rest 8 s after the last real action (click, key, scroll, touch,
// navigation): while any of them runs the GPU recomposites most of the screen every frame (measured ~12% GPU in
// Electron vs ~0 at rest), and plain mouse movement used to keep them alive all the time.
// JS loops (simulations, solar system, group center) keep running while visible and focused: people watch them.
const WATCH_PAGES = ['evren', 'sim', 'grup'];
let idle = false, idleT = 0;
export const asleep = () => document.hidden || !document.hasFocus() || (idle && !WATCH_PAGES.includes(document.body?.dataset.page));
const resting = () => document.hidden || !document.hasFocus() || idle;
const wake = () => { clearTimeout(idleT); idleT = setTimeout(() => { idle = true; syncVis(); }, 8000); if (idle) { idle = false; syncVis(); } };
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, wake, { passive: true, capture: true });
addEventListener('hashchange', wake);
let wasAsleep = null;
const syncVis = () => {
  document.documentElement.classList.toggle('tab-hidden', resting());
  const now = asleep();
  if (wasAsleep !== null && wasAsleep !== now) dispatchEvent(new Event('mp-vis')); // JS animation loops listen to this
  wasAsleep = now;
};
document.addEventListener('visibilitychange', syncVis);
addEventListener('blur', syncVis); addEventListener('focus', syncVis);
syncVis(); wake();

// Global particle budget across all active FX layers (smooth on mid-range Android).
const MAX_PARTICLES = 40;
let aliveParticles = 0;
const allocParticles = want => {
  const n = Math.max(0, Math.min(want, MAX_PARTICLES - aliveParticles));
  aliveParticles += n;
  return n;
};
const freeParticles = n => { aliveParticles = Math.max(0, aliveParticles - n); };

// Cards: soft light that follows the pointer (CSS reads --mx/--my); empty states get subtle star parallax.
document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const c = e.target.closest?.('.card, .pcard, .btn.primary');
  if (c) {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', e.clientX - r.left + 'px');
    c.style.setProperty('--my', e.clientY - r.top + 'px');
  }
  if (!full()) return;
  const emp = e.target.closest?.('.empty');
  if (emp) {
    const r = emp.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / Math.max(1, r.width) - .5) * 10;
    const ny = ((e.clientY - r.top) / Math.max(1, r.height) - .5) * 8;
    emp.style.setProperty('--ex', nx.toFixed(1) + 'px');
    emp.style.setProperty('--ey', ny.toFixed(1) + 'px');
  }
}, { passive: true });

// Tactile pointer-point light ripple on buttons, chips, segments, tabs & keys (never on board canvas).
document.addEventListener('pointerdown', e => {
  if (!full() || e.button > 0 || document.hidden) return;
  const el = e.target.closest?.('.btn, .chip, .icon-btn, .tb, .dock-new, .seg button, .tab, .key');
  if (!el || el.disabled || el.closest?.('canvas')) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  if (el.classList.contains('new-btn') || el.classList.contains('dock-new')) {
    el.classList.remove('fx-pulse');
    void el.offsetWidth;
    el.classList.add('fx-pulse');
    setTimeout(() => el.classList.remove('fx-pulse'), 460);
    return;
  }
  const x = (e.clientX ? e.clientX - r.left : r.width / 2);
  const y = (e.clientY ? e.clientY - r.top : r.height / 2);
  const sz = Math.max(r.width, r.height) * 1.65;
  const rip = document.createElement('mp-rip');
  rip.className = 'fx-rip' + (el.classList.contains('primary') || el.classList.contains('on') ? ' on-light' : '');
  rip.setAttribute('aria-hidden', 'true');
  rip.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${sz.toFixed(0)}px;height:${sz.toFixed(0)}px`;
  el.classList.add('fx-rip-host');
  el.append(rip);
  setTimeout(() => rip.remove(), 460);
}, { passive: true });

// Auto-glide segmented control indicators whenever a .seg button is clicked (works across app, tools & sim).
document.addEventListener('click', e => {
  const seg = e.target.closest?.('.seg');
  if (seg) requestAnimationFrame(() => syncSeg(seg));
});

// Staggered orbital entrance for grids/lists in a freshly rendered view.
export function stagger(root) {
  const mode = motion();
  if (mode === 'off') return;
  // tab rows stay put: re-animating them on every tab switch made the tabs slide over each other
  const nodes = root.querySelectorAll('.dash > *, .pgrid > *, .cgrid > *, .set');
  nodes.forEach((el, i) => {
    const idx = Math.min(i, 14);
    el.style.setProperty('--i', idx);
    if (mode === 'full') {
      const jitter = ((i * 37) % 5) * 11;
      const delay = Math.min(i, 12) * 32 + jitter;
      const ox = ((i % 3) - 1) * 9;
      const or = (i % 2 ? 1 : -1) * 0.75;
      el.style.setProperty('--ed', delay + 'ms');
      el.style.setProperty('--ox', ox + 'px');
      el.style.setProperty('--oy', '18px');
      el.style.setProperty('--or', or + 'deg');
    }
    el.classList.add('enter');
  });
}

// Numbers roll like an observatory odometer to their target: <b data-count="12">12</b>
export function countUp(root) {
  if (!full() || document.hidden) return;
  root.querySelectorAll('[data-count]').forEach((el, n) => {
    const to = Math.round(+el.dataset.count), suffix = el.dataset.suffix || '';
    if (!(to > 0)) return;
    const digits = String(to).split('');
    const wrap = document.createElement('span');
    wrap.className = 'odo';
    wrap.setAttribute('aria-label', to + suffix);
    const baseDelay = 90 + Math.min(n, 4) * 45;
    digits.forEach((ch, i) => {
      const d = +ch;
      const idx = d === 0 ? 10 : d;
      const slot = document.createElement('span');
      slot.className = 'odo-d';
      const strip = document.createElement('span');
      strip.className = 'odo-strip';
      strip.setAttribute('aria-hidden', 'true');
      strip.style.setProperty('--idx', idx);
      strip.style.setProperty('--dly', (baseDelay + i * 65) + 'ms');
      strip.style.setProperty('--dur', (580 + i * 70) + 'ms');
      strip.innerHTML = '<i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i><i>8</i><i>9</i><i>0</i>';
      slot.append(strip);
      wrap.append(slot);
    });
    if (suffix) {
      const suf = document.createElement('span');
      suf.className = 'odo-suf';
      suf.textContent = suffix;
      wrap.append(suf);
    }
    el.textContent = '';
    el.append(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('odo-go')));
    const settleMs = baseDelay + digits.length * 135 + 680;
    setTimeout(() => { if (el.isConnected && el.contains(wrap)) el.textContent = to + suffix; }, settleMs);
  });
}

// Soft starlight warp sweep used during page transitions.
function warpSweep() {
  if (!full() || document.hidden) return;
  const s = document.createElement('div');
  s.className = 'warp-sweep';
  s.setAttribute('aria-hidden', 'true');
  document.body.append(s);
  setTimeout(() => s.remove(), 460);
}

let inVT = false, navPending = false;

// Page change with View Transitions when available, plus a warp/fade fallback.
export async function transition(update) {
  const hasView = !!document.querySelector('#view > *');
  if (!hasView || motion() === 'off') return update();
  if (!document.startViewTransition || !full() || document.hidden) {
    await update();
    const page = document.querySelector('#view > .page');
    if (page && !document.hidden) {
      const cls = full() ? 'view-arrive' : 'view-fade';
      page.classList.add(cls);
      setTimeout(() => page.classList.remove(cls), full() ? 420 : 200);
      if (full()) warpSweep();
    }
    return;
  }
  let done = false;
  const once = async () => {
    if (done) return; done = true;
    inVT = true;
    try { await update(); } finally { inVT = false; }
  };
  const vt = document.startViewTransition(once);
  vt.ready.then(() => {
    if (navPending) { navPending = false; syncNav(); }
    if (document.body.dataset.page !== 'p') warpSweep();
  }).catch(() => {
    if (navPending) { navPending = false; syncNav(true); }
  });
  vt.finished.catch(() => {});
  // a stalled/skipped transition (e.g. window hidden) must never delay or blank the page
  await Promise.race([vt.updateCallbackDone.catch(() => {}), new Promise(r => setTimeout(r, 350))]);
  if (!done) { vt.skipTransition(); await once(); }
  if (navPending) {
    requestAnimationFrame(() => { if (navPending) { navPending = false; syncNav(); } });
  }
}

// Shooting star across the screen (GPU-composited transform).
export function shootingStar(big = false) {
  if (!full() || document.hidden) return;
  const s = document.createElement('div');
  s.className = 'shoot' + (big ? ' big' : '');
  s.style.setProperty('--sy', (8 + Math.random() * 24).toFixed(1) + 'vh');
  s.setAttribute('aria-hidden', 'true');
  document.body.append(s);
  setTimeout(() => s.remove(), 1350);
}

// Helper: draw a crisp 4-point star sparkle on canvas.
function drawStar4(c, x, y, r) {
  const ir = r * .28;
  c.beginPath();
  c.moveTo(x, y - r);
  c.lineTo(x + ir, y - ir);
  c.lineTo(x + r, y);
  c.lineTo(x + ir, y + ir);
  c.lineTo(x, y + r);
  c.lineTo(x - ir, y + ir);
  c.lineTo(x - r, y);
  c.lineTo(x - ir, y - ir);
  c.closePath();
  c.fill();
}

// Short radial screen edge glow on celebration.
export function screenGlow(kind = 'solve') {
  if (!full() || document.hidden) return;
  const g = document.createElement('div');
  g.className = 'fx-glow' + (kind === 'goal' ? ' goal' : '');
  g.setAttribute('aria-hidden', 'true');
  document.body.append(g);
  setTimeout(() => g.remove(), kind === 'goal' ? 900 : 620);
}

// Shared constellation-particle burst canvas renderer (capped particles, dynamic constellation lines, shockwaves).
function runStarBurst(x, y, { count = 24, duration = 1250, speed = [2.2, 6.4], linkDist = 96, maxRScale = .42, soft = false }) {
  if (!full() || document.hidden) return;
  const n = allocParticles(count);
  if (!n) return;
  const cv = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  cv.className = 'fx-layer';
  cv.width = W * dpr;
  cv.height = H * dpr;
  document.body.append(cv);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const acc = accent();
  const [vMin, vMax] = speed;
  const ps = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (Math.random() - .5) * .45;
    const v = vMin + Math.random() * (vMax - vMin);
    return {
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      r: (soft ? .9 : 1.1) + Math.random() * (soft ? 1.8 : 2.3),
      star: i % 3 === 0,
      acc: i % 2 === 0,
      tw: Math.random() * 6.28,
    };
  });
  const t0 = performance.now();
  const maxR = Math.hypot(W, H) * maxRScale;
  let cleaned = false;
  const finish = () => {
    if (cleaned) return;
    cleaned = true;
    cv.remove();
    freeParticles(n);
  };
  (function frame(t) {
    if (document.hidden || !cv.isConnected) return finish();
    const k = Math.min(1, (t - t0) / duration);
    c.clearRect(0, 0, W, H);

    // Expanding shockwave rings + core flash
    if (k < .55) {
      const q = k / .55;
      const eq = 1 - (1 - q) ** 3;
      c.save();
      c.strokeStyle = acc;
      c.globalAlpha = (soft ? .32 : .55) * (1 - q);
      c.lineWidth = (soft ? 1.5 : 2) + (soft ? 5 : 8) * (1 - q);
      c.beginPath();
      c.arc(x, y, 8 + eq * maxR, 0, 7);
      c.stroke();

      if (!soft && q < .78) {
        const q2 = q / .78;
        c.strokeStyle = '#fff';
        c.globalAlpha = .4 * (1 - q2);
        c.lineWidth = 1.2 + 3 * (1 - q2);
        c.beginPath();
        c.arc(x, y, 4 + (1 - (1 - q2) ** 2.2) * maxR * .68, 0, 7);
        c.stroke();
      }

      const gr = (soft ? 110 : 150) * (1 - q) + 18;
      const g = c.createRadialGradient(x, y, 0, x, y, gr);
      g.addColorStop(0, soft ? acc : '#fff');
      g.addColorStop(1, 'transparent');
      c.globalAlpha = (soft ? .22 : .42) * (1 - q);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, gr, 0, 7);
      c.fill();
      c.restore();
    }

    // Update particles
    const drag = soft ? .972 : .958;
    for (const p of ps) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= drag;
      p.vy *= drag;
      if (soft) p.vy -= .015;
    }

    // Dynamic constellation lines linking nearby particles
    const lineFade = k < .12 ? k / .12 : Math.max(0, 1 - (k - .12) / .78);
    if (lineFade > .02) {
      c.save();
      c.strokeStyle = acc;
      c.lineWidth = soft ? .75 : .95;
      const maxD2 = linkDist * linkDist;
      for (let i = 0; i < ps.length; i++) {
        let links = 0;
        for (let j = i + 1; j < ps.length && links < 2; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD2) {
            const prox = 1 - Math.sqrt(d2) / linkDist;
            c.globalAlpha = lineFade * prox * (soft ? .32 : .48);
            c.beginPath();
            c.moveTo(ps[i].x, ps[i].y);
            c.lineTo(ps[j].x, ps[j].y);
            c.stroke();
            links++;
          }
        }
      }
      c.restore();
    }

    // Render stars & star dust
    const fade = k < .08 ? k / .08 : Math.max(0, 1 - (k - .08) / .92);
    for (const p of ps) {
      const tw = .62 + .38 * Math.sin(t * .016 + p.tw);
      c.globalAlpha = fade * tw;
      c.fillStyle = p.acc ? acc : '#fff';
      if (p.star) drawStar4(c, p.x, p.y, p.r * (1.35 + .4 * (1 - k)));
      else { c.beginPath(); c.arc(p.x, p.y, p.r * (.65 + .35 * (1 - k)), 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    if (k < 1) requestAnimationFrame(frame); else finish();
  })(t0);
}

// Rich constellation burst when a problem is marked solved.
export function constellationBurst(x = innerWidth / 2, y = innerHeight / 2) {
  if (!full()) return;
  runStarBurst(x, y, { count: 22, duration: 1180, speed: [2.0, 5.8], linkDist: 92, maxRScale: .28, soft: false });
  screenGlow('solve');
}

// Supernova: shockwave rings + constellation particles fading into star dust.
// Used when the daily goal is reached, or softly (opts.soft = true) when a focus timer session completes.
export function supernova(x = innerWidth / 2, y = innerHeight / 2, opts = {}) {
  if (!full()) return;
  const soft = !!opts?.soft;
  runStarBurst(x, y, {
    count: soft ? 24 : 36,
    duration: soft ? 1450 : 1500,
    speed: soft ? [1.2, 4.1] : [2.4, 7.6],
    linkDist: soft ? 105 : 118,
    maxRScale: soft ? .34 : .52,
    soft,
  });
  if (!soft) screenGlow('goal');
}

// Orbital swirl effect when a problem is marked for review ("Tekrar").
export function orbitSwirl(el) {
  if (!full() || document.hidden || !el) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const sz = Math.max(r.width, r.height) + 34;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-36 -36 72 72');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('fx-swirl');
  svg.style.cssText = `left:${(cx - sz / 2).toFixed(1)}px;top:${(cy - sz / 2).toFixed(1)}px;width:${sz.toFixed(0)}px;height:${sz.toFixed(0)}px`;
  svg.innerHTML = `<g class="sw-spin">
    <circle class="sw-arc" r="24" pathLength="100"/>
    <circle class="sw-arc sw-arc-2" r="18" pathLength="100"/>
    <circle class="sw-dot" cx="24" cy="0" r="2.6"/>
    <circle class="sw-dot sw-dot-2" cx="-18" cy="0" r="2"/>
  </g>`;
  document.body.append(svg);
  setTimeout(() => svg.remove(), 760);
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
  if (!bar) return;
  let ind = bar.querySelector('.tb-ind');
  if (!ind) { ind = document.createElement('i'); ind.className = 'tb-ind'; bar.prepend(ind); }
  if (!active) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1;
  ind.style.transform = `translate3d(${active.offsetLeft}px, 0, 0)`;
  ind.style.width = active.offsetWidth + 'px';
}

// Segmented controls (.seg): springy gliding pill indicator.
function syncSeg(seg, instant = false) {
  if (!seg) return;
  let ind = seg.querySelector(':scope > .seg-ind');
  if (!ind) {
    ind = document.createElement('mp-ind');
    ind.className = 'seg-ind';
    ind.setAttribute('aria-hidden', 'true');
    seg.prepend(ind);
  }
  const active = seg.querySelector('button.on');
  if (!active || !active.offsetWidth || !active.offsetHeight) {
    ind.style.opacity = '0';
    seg.classList.remove('has-ind');
    return;
  }
  const snap = instant || !seg.classList.contains('seg-ready') || !full();
  if (snap) seg.classList.remove('seg-ready');
  ind.style.opacity = '1';
  ind.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`;
  ind.style.width = active.offsetWidth + 'px';
  ind.style.height = active.offsetHeight + 'px';
  seg.classList.add('has-ind');
  if (snap && full()) requestAnimationFrame(() => seg.classList.add('seg-ready'));
}

export function syncSegments(root = document, instant = false) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.seg').forEach(seg => syncSeg(seg, instant));
}

// Navigation (desktop sidebar & phone floating dock): smooth gliding highlight with directional light trail.
let prevNav = null, navTrailT = 0;
export function syncNav(instant = false) {
  if (inVT && !instant) { navPending = true; return; }
  const nav = document.getElementById('nav');
  if (!nav || !nav.offsetWidth || !nav.offsetHeight) return;
  let ind = nav.querySelector(':scope > .nav-ind');
  if (!ind) {
    ind = document.createElement('mp-ind');
    ind.className = 'nav-ind';
    ind.setAttribute('aria-hidden', 'true');
    nav.prepend(ind);
  }
  const mobile = phoneQ.matches;
  const active = mobile
    ? nav.querySelector('.nav-link.on, .nav-link.on-mob')
    : nav.querySelector('.nav-link.on, .nav-sub.on');
  if (!active || !active.offsetWidth || !active.offsetHeight) {
    ind.style.opacity = '0';
    nav.classList.remove('has-nav-ind');
    return;
  }
  const nr = nav.getBoundingClientRect();
  const ar = active.getBoundingClientRect();
  const sx = nav.offsetWidth ? (nr.width / nav.offsetWidth) || 1 : 1;
  const sy = nav.offsetHeight ? (nr.height / nav.offsetHeight) || 1 : 1;
  const x = (ar.left - nr.left) / sx - nav.clientLeft + nav.scrollLeft;
  const y = (ar.top - nr.top) / sy - nav.clientTop + nav.scrollTop;
  const w = ar.width / sx, h = ar.height / sy;
  const isSub = !mobile && active.classList.contains('nav-sub');
  const snap = instant || !prevNav || prevNav.mobile !== mobile || !full() || document.hidden;

  if (snap) nav.classList.remove('nav-ind-ready');
  else {
    const dx = x - prevNav.x, dy = y - prevNav.y;
    if (Math.hypot(dx, dy) > 4) {
      const tx = mobile ? Math.max(-100, Math.min(100, -dx * .55)) : 0;
      const ty = mobile ? 0 : Math.max(-84, Math.min(84, -dy * .55));
      ind.style.setProperty('--trail-x', tx.toFixed(1) + 'px');
      ind.style.setProperty('--trail-y', ty.toFixed(1) + 'px');
      ind.classList.remove('nav-trail');
      void ind.offsetWidth;
      ind.classList.add('nav-trail');
      clearTimeout(navTrailT);
      navTrailT = setTimeout(() => ind.classList.remove('nav-trail'), 380);
    }
  }

  ind.classList.toggle('is-sub', isSub);
  ind.style.opacity = '1';
  ind.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  ind.style.width = w.toFixed(1) + 'px';
  ind.style.height = h.toFixed(1) + 'px';
  nav.classList.add('has-nav-ind');
  prevNav = { x, y, w, h, mobile };
  if (snap && full()) requestAnimationFrame(() => nav.classList.add('nav-ind-ready'));
}

let resizeRaf = 0;
addEventListener('resize', () => {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    syncNav(true);
    syncSegments(document, true);
  });
}, { passive: true });
phoneQ.addEventListener?.('change', () => requestAnimationFrame(() => {
  syncNav(true);
  syncSegments(document, true);
}));
addEventListener('mp-theme', () => requestAnimationFrame(() => {
  syncNav(true);
  syncSegments(document, true);
}));

// Dashboard goal ring: comet head rides the filling arc tip.
function enhanceGoalRing(root) {
  const svg = root.querySelector('svg.ring[data-frac]');
  if (!svg || !full() || document.hidden) return;
  const frac = Math.max(0, Math.min(1, parseFloat(svg.dataset.frac) || 0));
  const fg = svg.querySelector('.ring-fg');
  if (!fg || !(frac > 0)) return;
  const C = 2 * Math.PI * 52;
  svg.classList.add('ring-js');
  const head = document.createElementNS(NS, 'g');
  head.classList.add('ring-head');
  head.setAttribute('aria-hidden', 'true');
  head.innerHTML = `<circle class="rh-halo-outer" r="10.5"/><circle class="rh-halo" r="6"/><path class="rh-spark" d="M0 -6.2 L1.2 -1.2 L6.2 0 L1.2 1.2 L0 6.2 L-1.2 1.2 L-6.2 0 L-1.2 -1.2 Z"/><circle class="rh-core" r="2.8"/>`;
  svg.append(head);
  fg.style.strokeDashoffset = C.toFixed(2);
  head.style.opacity = '0';

  const start = performance.now() + 110, D = 960;
  const place = cur => {
    fg.style.strokeDashoffset = (C * (1 - cur)).toFixed(2);
    const a = cur * Math.PI * 2;
    const hx = 60 + 52 * Math.cos(a), hy = 60 + 52 * Math.sin(a);
    head.setAttribute('transform', `translate(${hx.toFixed(2)} ${hy.toFixed(2)}) rotate(${(a * 180 / Math.PI).toFixed(1)})`);
  };
  (function frame(t) {
    if (!svg.isConnected) return;
    if (document.hidden) {
      place(frac);
      head.style.opacity = '1';
      head.classList.add('settled');
      return;
    }
    if (t < start) { requestAnimationFrame(frame); return; }
    const k = Math.min(1, (t - start) / D);
    const e = 1 - (1 - k) ** 3;
    place(frac * e);
    head.style.opacity = k < .1 ? (k / .1).toFixed(2) : '1';
    if (k < 1) requestAnimationFrame(frame);
    else {
      head.classList.add('settled');
      if (frac >= 1) head.classList.add('complete');
    }
  })(performance.now());
}

// Dashboard 14-day scope chart: glowing pen tip draws the trace and pops each day's point as a star.
function enhanceScope(root) {
  const svg = root.querySelector('svg.scope');
  if (!svg || !full() || document.hidden) return;
  const trace = svg.querySelector('.scope-trace');
  if (!trace || typeof trace.getTotalLength !== 'function') return;
  const L = trace.getTotalLength();
  if (!(L > 0)) return;
  const fill = svg.querySelector('path[fill*="scope-fill"]');
  const pts = [...svg.querySelectorAll('.scope-pt')].map(el => ({
    el,
    x: parseFloat(el.getAttribute('cx')) || 0,
    y: parseFloat(el.getAttribute('cy')) || 0,
    popped: false,
    lbl: null,
  }));
  const vals = [...svg.querySelectorAll('.scope-v')];
  for (const v of vals) {
    const vx = parseFloat(v.getAttribute('x')) || 0;
    const match = pts.find(p => Math.abs(p.x - vx) < 1.5);
    if (match) match.lbl = v;
  }

  svg.classList.add('scope-js');
  const pl = parseFloat(trace.getAttribute('pathLength')) || L;
  trace.style.strokeDasharray = String(pl);
  trace.style.strokeDashoffset = String(pl);
  if (fill) fill.style.opacity = '0';
  pts.forEach(p => { p.el.classList.add('scope-pt-wait'); p.lbl?.classList.add('scope-v-wait'); });

  const pen = document.createElementNS(NS, 'g');
  pen.classList.add('scope-pen');
  pen.setAttribute('aria-hidden', 'true');
  pen.innerHTML = `<circle class="sp-halo-outer" r="11"/><circle class="sp-halo" r="6.2"/><path class="sp-star" d="M0 -6.5 L1.4 -1.4 L6.5 0 L1.4 1.4 L0 6.5 L-1.4 1.4 L-6.5 0 L-1.4 -1.4 Z"/><circle class="sp-core" r="2.5"/>`;
  pen.style.opacity = '0';
  svg.append(pen);

  const popPoint = (p, glint) => {
    if (p.popped) return;
    p.popped = true;
    p.el.classList.remove('scope-pt-wait');
    p.el.classList.add('scope-pt-pop');
    if (p.lbl) { p.lbl.classList.remove('scope-v-wait'); p.lbl.classList.add('scope-v-pop'); }
    if (glint && svg.isConnected) {
      const g = document.createElementNS(NS, 'path');
      g.setAttribute('d', 'M0 -8 L1.5 -1.5 L8 0 L1.5 1.5 L0 8 L-1.5 1.5 L-8 0 L-1.5 -1.5 Z');
      g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      g.classList.add('scope-glint');
      g.setAttribute('aria-hidden', 'true');
      svg.append(g);
      setTimeout(() => g.remove(), 460);
    }
  };

  const start = performance.now() + 140, D = 1150;
  const finish = () => {
    pts.forEach(p => popPoint(p, false));
    trace.style.strokeDasharray = '';
    trace.style.strokeDashoffset = '';
    if (fill) fill.style.opacity = '1';
    pen.remove();
  };

  (function frame(t) {
    if (!svg.isConnected) return;
    if (document.hidden) return finish();
    if (t < start) { requestAnimationFrame(frame); return; }
    const k = Math.min(1, (t - start) / D);
    const p = 1 - (1 - k) ** 2.35;
    trace.style.strokeDashoffset = (pl * (1 - p)).toFixed(2);
    const q = trace.getPointAtLength(L * p);
    pen.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
    pen.style.opacity = k < .06 ? (k / .06).toFixed(2) : k > .86 ? ((1 - k) / .14).toFixed(2) : '1';
    if (fill) fill.style.opacity = Math.max(0, Math.min(1, (p - .22) / .74)).toFixed(2);
    for (const pt of pts) {
      if (!pt.popped && pt.x <= q.x + 2) popPoint(pt, true);
    }
    if (k < 1) requestAnimationFrame(frame);
    else finish();
  })(performance.now());
}

// Empty states (.empty): subtle constellation & starfield drawing in behind the message.
function enhanceEmpty(root) {
  root.querySelectorAll('.empty').forEach(el => {
    if (el.querySelector('.empty-sky')) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('empty-sky');
    svg.setAttribute('viewBox', '0 0 420 180');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<g class="es-parallax">
      <path class="es-line" d="M24 134 L58 84 L104 102 L132 48" pathLength="100"/>
      <path class="es-line es-l2" d="M286 44 L322 86 L364 66 L392 124" pathLength="100"/>
      <circle class="es-star" cx="24" cy="134" r="2" style="--d:0"/>
      <circle class="es-star" cx="58" cy="84" r="2.5" style="--d:1"/>
      <circle class="es-star" cx="104" cy="102" r="1.9" style="--d:2"/>
      <circle class="es-star" cx="132" cy="48" r="2.6" style="--d:3"/>
      <circle class="es-star" cx="286" cy="44" r="2.2" style="--d:1"/>
      <circle class="es-star" cx="322" cy="86" r="2.6" style="--d:2"/>
      <circle class="es-star" cx="364" cy="66" r="1.9" style="--d:3"/>
      <circle class="es-star" cx="392" cy="124" r="2.3" style="--d:4"/>
      <circle class="es-speck loop" cx="76" cy="36" r="1.1" style="--td:0s"/>
      <circle class="es-speck loop" cx="174" cy="24" r="1.2" style="--td:1.2s"/>
      <circle class="es-speck loop" cx="246" cy="148" r="1.1" style="--td:2.1s"/>
      <circle class="es-speck loop" cx="348" cy="28" r="1.2" style="--td:.7s"/>
      <circle class="es-speck loop" cx="152" cy="154" r="1" style="--td:1.7s"/>
      <circle class="es-speck loop" cx="302" cy="146" r="1.1" style="--td:2.8s"/>
    </g>`;
    el.prepend(svg);
  });
}

// Delete / trash stardust dissolve & undo reverse materialize.
export function stardustBurst(rect, { reverse = false, color = null } = {}) {
  if (!full() || document.hidden) return;
  const n = allocParticles(24);
  if (!n) return;
  const W = innerWidth, H = innerHeight;
  const r = rect && rect.width > 0 ? rect : { left: W * .38, top: H * .38, width: W * .24, height: H * .2 };
  const cv = document.createElement('canvas');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.className = 'fx-layer';
  cv.width = W * dpr;
  cv.height = H * dpr;
  document.body.append(cv);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const col = color || accent();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  const ps = Array.from({ length: n }, (_, i) => {
    const tx = r.left + Math.random() * r.width;
    const ty = r.top + Math.random() * r.height;
    const a = Math.atan2(ty - cy, tx - cx) + (Math.random() - .5) * 1.1;
    const dist = 38 + Math.random() * 88;
    const ox = Math.cos(a) * dist, oy = Math.sin(a) * dist - (reverse ? 0 : 28);
    return {
      tx, ty,
      sx: reverse ? tx + ox : tx,
      sy: reverse ? ty + oy : ty,
      ex: reverse ? tx : tx + ox,
      ey: reverse ? ty : ty + oy,
      rad: 1.0 + Math.random() * 1.8,
      star: i % 4 === 0,
      acc: i % 2 === 0,
      swirl: (Math.random() - .5) * 26,
      delay: Math.random() * .16,
    };
  });

  const t0 = performance.now(), D = reverse ? 480 : 620;
  let cleaned = false;
  const finish = () => { if (cleaned) return; cleaned = true; cv.remove(); freeParticles(n); };

  (function frame(t) {
    if (document.hidden || !cv.isConnected) return finish();
    const gk = Math.min(1, (t - t0) / D);
    c.clearRect(0, 0, W, H);
    for (const p of ps) {
      const k = Math.max(0, Math.min(1, (gk - p.delay) / (1 - p.delay)));
      if (k <= 0) continue;
      const e = reverse ? 1 - (1 - k) ** 2.6 : 1 - (1 - k) ** 2;
      const arc = Math.sin(k * Math.PI) * p.swirl;
      const x = p.sx + (p.ex - p.sx) * e + arc * .45;
      const y = p.sy + (p.ey - p.sy) * e - Math.abs(arc) * .35;
      const alpha = reverse
        ? (k < .25 ? k / .25 : Math.max(0, 1 - (k - .65) / .35))
        : (k < .12 ? k / .12 : Math.max(0, 1 - k));
      c.globalAlpha = alpha * .92;
      c.fillStyle = p.acc ? col : '#fff';
      if (p.star) drawStar4(c, x, y, p.rad * (reverse ? .8 + .8 * k : 1.4 - .6 * k));
      else { c.beginPath(); c.arc(x, y, p.rad * (reverse ? .6 + .5 * k : 1.1 - .5 * k), 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    if (gk < 1) requestAnimationFrame(frame); else finish();
  })(t0);
}

export function dissolve(el) {
  if (!el || !full() || document.hidden) return Promise.resolve();
  const r = el.getBoundingClientRect();
  el.classList.add('dissolving');
  stardustBurst(r, { reverse: false });
  return new Promise(res => setTimeout(res, 260));
}

export function materialize(el) {
  if (!el || !full() || document.hidden) return;
  const r = el.getBoundingClientRect();
  el.classList.remove('enter');
  el.classList.add('materializing');
  stardustBurst(r, { reverse: true });
  setTimeout(() => el.classList.remove('materializing'), 480);
}

let pendingRestore = null;
export function markRestored(id) {
  if (id) pendingRestore = { id: String(id), at: Date.now() };
}

// Run all view-level motion enhancements after rendering a route or list.
export function enhanceView(root) {
  if (!root) return;
  syncSegments(root, true);
  enhanceGoalRing(root);
  enhanceScope(root);
  enhanceEmpty(root);
  if (pendingRestore && Date.now() - pendingRestore.at < 3500) {
    const id = pendingRestore.id;
    const escId = typeof CSS?.escape === 'function' ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
    const card = root.querySelector(`[data-pid="${escId}"], [data-cid="${escId}"]`);
    if (card) {
      pendingRestore = null;
      requestAnimationFrame(() => materialize(card));
    }
  }
}

// Hyperspace jump: stars stretch into streaks from the centre (focus mode entry/exit).
export function hyperspace(reverse = false) {
  if (!full() || document.hidden) return;
  const cv = document.createElement('canvas'), dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  cv.className = 'fx-layer'; cv.width = W * dpr; cv.height = H * dpr; document.body.append(cv);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const st = Array.from({ length: 160 }, () => ({ a: Math.random() * 6.283, d: Math.random() * .9 + .05, s: Math.random() * .8 + .4 }));
  const t0 = performance.now(), D = 820, cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
  (function frame(t) {
    if (document.hidden || !cv.isConnected) { cv.remove(); return; }
    let k = Math.min(1, (t - t0) / D); if (reverse) k = 1 - k;
    const e = k * k * (3 - 2 * k), fade = Math.sin(Math.PI * Math.min(1, (t - t0) / D));
    c.clearRect(0, 0, W, H); c.strokeStyle = '#fff'; c.lineCap = 'round';
    for (const s of st) {
      const r0 = s.d * R, len = e * R * .6 * s.s, x = Math.cos(s.a), y = Math.sin(s.a);
      c.globalAlpha = fade * (.3 + .7 * s.s); c.lineWidth = .6 + s.s;
      c.beginPath(); c.moveTo(cx + x * r0, cy + y * r0); c.lineTo(cx + x * (r0 + len), cy + y * (r0 + len)); c.stroke();
    }
    if (t - t0 < D) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

// Theme change: a thin scan line sweeps down and the theme flips as it passes the middle.
export function scan(apply) {
  if (!full() || document.hidden) return apply();
  const s = document.createElement('div'); s.className = 'scanline'; s.setAttribute('aria-hidden', 'true'); document.body.append(s);
  setTimeout(apply, 360); setTimeout(() => s.remove(), 860);
}

// Space ambience for focus mode: soft brown noise through a low-pass filter. Only when sounds are on.
let amb = null;
export function ambience(on) {
  if (!on || document.documentElement.dataset.sound !== 'on') { amb?.stop(); amb = null; return; }
  if (amb) return;
  try {
    const ctx = new AudioContext(), len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 420;
    g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(.18, ctx.currentTime + 2);
    src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start();
    amb = { stop() { g.gain.linearRampToValueAtTime(0, ctx.currentTime + .8); setTimeout(() => ctx.close(), 900); } };
  } catch { amb = null; }
}
