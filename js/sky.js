// Dashboard visuals: personal sky (canvas), yearly "galaxy" calendar and oscilloscope chart (SVG strings).
import { esc } from './ui.js';
import { dayKey } from './db.js';
import { full } from './fx.js';

// deterministic pseudo-random so a star never moves between visits
const rng = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };

export function mountSky(cv, { courses, problems, onOpen }) {
  const tip = cv.parentElement.querySelector('.sky-tip');
  const solvedOrReview = problems.filter(p => p.status === 'solved' || p.status === 'review');
  const today = dayKey();
  let stars = [], labels = [], dpr = 1, W = 0, H = 0, rot = 0, raf = 0, hover = null, t0 = performance.now();

  function layout() {
    dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const used = courses.filter(c => solvedOrReview.some(p => p.course === c.id));
    const n = used.length, rx = W * .36, ry = H * .3;
    stars = []; labels = [];
    used.forEach((c, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2, cx = n > 1 ? Math.cos(a) * rx : 0, cy = n > 1 ? Math.sin(a) * ry : 0;
      const spread = n > 1 ? Math.min(H * .16, W / (n * 2.6)) : Math.min(W, H) * .3;
      const mine = solvedOrReview.filter(p => p.course === c.id).sort((x, y) => (x.solvedAt || x.updated || 0) - (y.solvedAt || y.updated || 0));
      const pts = mine.map(p => { const r = rng(p.id); return { p, c, x: cx + (r() - .5) * 2 * spread, y: cy + (r() - .5) * 2 * spread * .7, r: 1.3 + Math.min(2.6, (p.secs || 0) / 600), tw: r() * 6.28, fresh: p.solvedAt && dayKey(p.solvedAt) === today }; });
      stars.push(...pts);
      labels.push({ name: c.name, color: c.color || '#f4f4f5', x: cx, y: cy - spread * .7 - 14, pts });
    });
  }
  const ro = new ResizeObserver(() => { layout(); draw(performance.now()); }); ro.observe(cv);

  function toScreen(s) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    return [W / 2 + s.x * cos - s.y * sin, H / 2 + s.x * sin + s.y * cos];
  }
  function draw(t) {
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const time = (t - t0) / 1000;
    for (const L of labels) { // constellation lines in solve order
      c.strokeStyle = L.color; c.globalAlpha = .25; c.lineWidth = 1; c.beginPath();
      const done = L.pts.filter(s => s.p.status === 'solved');
      done.forEach((s, i) => {
        if (!i) return;
        let near = done[0], nd = Infinity;
        for (let j = 0; j < i; j++) { const d = (done[j].x - s.x) ** 2 + (done[j].y - s.y) ** 2; if (d < nd) { nd = d; near = done[j]; } }
        const [x1, y1] = toScreen(near), [x2, y2] = toScreen(s); c.moveTo(x1, y1); c.lineTo(x2, y2);
      });
      c.stroke();
    }
    for (const s of stars) {
      const [x, y] = toScreen(s), review = s.p.status === 'review';
      const pulse = review ? .45 + .55 * Math.abs(Math.sin(time * 2 + s.tw)) : s.fresh ? .7 + .3 * Math.sin(time * 3) : .8 + .2 * Math.sin(time * .8 + s.tw);
      const r = s.r * (s === hover ? 1.8 : 1);
      const g = c.createRadialGradient(x, y, 0, x, y, r * 5);
      g.addColorStop(0, s.c.color || '#fff'); g.addColorStop(1, 'transparent');
      c.globalAlpha = .35 * pulse; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 5, 0, 7); c.fill();
      c.globalAlpha = pulse; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    c.globalAlpha = .6; c.font = '500 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
    for (const L of labels) { const [x, y] = toScreen(L); c.fillStyle = L.color; c.fillText(L.name.toLocaleUpperCase('tr'), x, y); }
    c.globalAlpha = 1;
  }
  function loop(t) { if (document.hidden || !full()) { raf = 0; return; } rot += .00004 * 16; draw(t); raf = requestAnimationFrame(loop); }
  const start = () => { if (!raf && full() && !document.hidden) raf = requestAnimationFrame(loop); else if (!full() || document.hidden) { cancelAnimationFrame(raf); raf = 0; } };
  const onVis = () => start();
  layout();
  if (full() && !document.hidden) raf = requestAnimationFrame(loop); else draw(performance.now());
  document.addEventListener('visibilitychange', onVis);
  addEventListener('mp-theme', onVis);

  const pick = e => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 14;
    for (const s of stars) { const [x, y] = toScreen(s), d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = s; } }
    return [best, mx, my];
  };
  cv.onpointermove = e => {
    const [s, x, y] = pick(e); hover = s; cv.style.cursor = s ? 'pointer' : 'default';
    tip.hidden = !s;
    if (s) { tip.innerHTML = `<b>${esc(s.p.title)}</b><span>${esc(s.c.name)}${s.p.status === 'review' ? ' · tekrar' : ''}</span>`; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
    if (!raf) draw(performance.now());
  };
  cv.onpointerleave = () => { hover = null; tip.hidden = true; };
  cv.onclick = e => { const [s] = pick(e); if (s) onOpen(s.p.id); };
  return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('mp-theme', onVis); };
}

// 53 weeks × 7 days; each day a star whose size/brightness follows solved count.
export function galaxyCalendar(byDay) {
  const end = new Date(), start = new Date(end); start.setDate(start.getDate() - 364 - start.getDay());
  let dots = '', months = '', x = 0, lastM = -1, total = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const col = Math.floor((d - start) / 864e5 / 7), row = d.getDay(), n = byDay[dayKey(d)] || 0; total += n;
    const cx = 8 + col * 13, cy = 16 + row * 13, today = dayKey(d) === dayKey();
    dots += n ? `<circle cx="${cx}" cy="${cy}" r="${(1.6 + Math.min(3.4, n * .5)).toFixed(1)}" class="gd on${today ? ' today' : ''}" style="opacity:${Math.min(1, .35 + n * .13).toFixed(2)}"><title>${d.toLocaleDateString('tr')} · ${n} soru</title></circle>`
      : `<circle cx="${cx}" cy="${cy}" r=".9" class="gd${today ? ' today' : ''}"><title>${d.toLocaleDateString('tr')}</title></circle>`;
    if (d.getMonth() !== lastM && d.getDate() <= 7) { lastM = d.getMonth(); months += `<text x="${cx - 4}" y="8">${d.toLocaleDateString('tr', { month: 'short' })}</text>`; }
    x = cx;
  }
  return { total, svg: `<svg class="galaxy" viewBox="0 0 ${x + 10} 110" role="img" aria-label="Son bir yılda çözülen sorular">${months}${dots}</svg>` };
}

// 14-day oscilloscope: smooth trace over a phosphor grid, a sweep beam loops across.
export function scopeChart(days, counts, goal) {
  const W = 560, H = 190, P = 18, max = Math.max(goal, ...counts, 1);
  const X = i => P + i * (W - 2 * P) / (counts.length - 1), Y = v => H - 26 - v / max * (H - 50);
  const pts = counts.map((v, i) => [X(i), Y(v)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`; }
  const grid = Array.from({ length: 11 }, (_, i) => `<line x1="${P + i * (W - 2 * P) / 10}" y1="10" x2="${P + i * (W - 2 * P) / 10}" y2="${H - 26}"/>`).join('')
    + Array.from({ length: 5 }, (_, i) => `<line x1="${P}" y1="${10 + i * (H - 36) / 4}" x2="${W - P}" y2="${10 + i * (H - 36) / 4}"/>`).join('');
  return `<svg class="scope" viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 14 günde çözülen sorular">
    <defs><linearGradient id="scope-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".22"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient>
      <linearGradient id="scope-beam" x1="0" x2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity="0"/><stop offset="1" stop-color="var(--acc)" stop-opacity=".35"/></linearGradient></defs>
    <g class="scope-grid">${grid}</g>
    <line class="scope-goal" x1="${P}" x2="${W - P}" y1="${Y(goal)}" y2="${Y(goal)}"/><text class="scope-lbl" x="${W - P}" y="${Y(goal) - 5}" text-anchor="end">hedef ${goal}</text>
    <path d="${d} L${X(counts.length - 1)},${H - 26} L${P},${H - 26}Z" fill="url(#scope-fill)"/>
    <path d="${d}" class="scope-trace" pathLength="100"/>
    ${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 ? 4 : 2.4}" class="scope-pt${i === pts.length - 1 ? ' now' : ''}"><title>${days[i].toLocaleDateString('tr')}: ${counts[i]} soru</title></circle>${counts[i] ? `<text class="scope-v" x="${x}" y="${y - 9}" text-anchor="middle">${counts[i]}</text>` : ''}`).join('')}
    ${days.map((dd, i) => `<text class="scope-lbl${i === days.length - 1 ? ' now' : ''}" x="${X(i)}" y="${H - 8}" text-anchor="middle">${dd.getDate()}</text>`).join('')}
    <rect class="scope-beam loop" x="${P - 40}" y="10" width="40" height="${H - 36}" fill="url(#scope-beam)"/>
  </svg>`;
}
