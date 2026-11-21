// Badges: each one is a small constellation that draws itself when earned.
import { S, persist } from './db.js';
import { esc } from './ui.js';
import { full } from './fx.js';

export const BADGES = [
  { id: 'first', name: 'İlk Işık', desc: 'İlk sorunu çözdün.', path: 'M50 16 L50 84 M16 50 L84 50 M28 28 L72 72', ok: s => s.total >= 1 },
  { id: 'ten', name: 'Takımyıldız', desc: '10 soru çözdün.', path: 'M12 70 L30 40 L50 54 L68 24 L88 38', ok: s => s.total >= 10 },
  { id: 'fifty', name: 'Galaksi', desc: '50 soru çözdün.', path: 'M20 50 Q50 20 80 50 Q50 80 20 50 M50 30 L50 70', ok: s => s.total >= 50 },
  { id: 'hundred', name: 'Süpernova', desc: '100 soru çözdün.', path: 'M50 10 L58 42 L90 50 L58 58 L50 90 L42 58 L10 50 L42 42 L50 10', ok: s => s.total >= 100 },
  { id: 'streak3', name: 'Yörüngede', desc: '3 gün üst üste çalıştın.', path: 'M14 72 Q50 4 86 72 M30 72 L70 72', ok: s => s.streak >= 3 },
  { id: 'streak7', name: 'Uzun Görev', desc: '7 gün üst üste çalıştın.', path: 'M10 78 L26 48 L42 62 L58 30 L74 50 L90 18', ok: s => s.streak >= 7 },
  { id: 'night', name: 'Gece Kuşu', desc: 'Gece yarısından sonra soru çözdün.', path: 'M62 16 Q20 22 24 60 Q32 92 76 80 Q44 74 42 48 Q42 26 62 16', ok: s => s.hour < 5 },
  { id: 'goal', name: 'Hedef Avcısı', desc: 'Günlük hedefini tamamladın.', path: 'M50 14 L86 50 L50 86 L14 50 L50 14 M50 36 L64 50 L50 64 L36 50 L50 36', ok: s => s.today >= s.goal },
  { id: 'course', name: 'Gezegen Fethi', desc: 'En az 10 sorusu olan bir dersin hepsini çözdün.', path: 'M30 50 Q30 28 50 28 Q70 28 70 50 Q70 72 50 72 Q30 72 30 50 M12 60 L88 40', ok: s => s.courseDone },
];
const dots = path => [...path.matchAll(/[MLQ]\s*(-?[\d.]+)\s+(-?[\d.]+)(?:\s+(-?[\d.]+)\s+(-?[\d.]+))?/g)].map(m => m[3] ? [m[3], m[4]] : [m[1], m[2]]);
const svg = (b, cls = '') => `<svg viewBox="0 0 100 100" class="badge-svg ${cls}"><path d="${b.path}" pathLength="100"/>${dots(b.path).map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3" style="--d:${i}"/>`).join('')}</svg>`;

// Returns newly earned badges (and records them).
export function check(stats) {
  S.badges ??= {};
  const fresh = BADGES.filter(b => !S.badges[b.id] && b.ok(stats));
  for (const b of fresh) S.badges[b.id] = Date.now();
  if (fresh.length) persist();
  return fresh;
}

export function reveal(b) {
  const el = document.createElement('div');
  el.className = 'badge-reveal' + (full() ? '' : ' still');
  el.innerHTML = `<div class="br-card">${svg(b, 'big')}<p class="eyebrow">Yeni rozet</p><h2>${esc(b.name)}</h2><p class="mute">${esc(b.desc)}</p></div>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 400); };
  el.onclick = close; document.body.append(el); setTimeout(close, 4200);
}

export function row() {
  S.badges ??= {};
  const n = BADGES.filter(b => S.badges[b.id]).length;
  return { n, html: BADGES.map(b => `<div class="bdg ${S.badges[b.id] ? 'got' : ''}" title="${esc(b.name)} — ${esc(b.desc)}${S.badges[b.id] ? ' (' + new Date(S.badges[b.id]).toLocaleDateString('tr') + ')' : ' (kilitli)'}">${svg(b)}<span>${esc(b.name)}</span></div>`).join('') };
}
