export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Short message at the bottom. Optional action button, e.g. { label: 'Geri al', run() {} }.
export function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('has-act', !!action);
  if (action) {
    const b = Object.assign(document.createElement('button'), { className: 'toast-act', textContent: action.label });
    b.onclick = () => { t.classList.remove('show'); action.run(); };
    t.append(b);
  }
  t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), action ? 7000 : 2600);
}

// Form dialog. Resolves to {field: value} on OK, null on cancel.
export function modal(title, body, { ok = 'Kaydet', cancel = 'Vazgeç', danger = false } = {}) {
  const d = $('#dlg');
  d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><div class="dlg-body">${body}</div>
    <div class="dlg-actions">${cancel ? `<button class="btn ghost" value="" formnovalidate>${cancel}</button>` : ''}
    <button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${ok}</button></div></form>`;
  d.returnValue = '';
  d.showModal();
  (d.querySelector('input:not([type=file])') || d.querySelector('select,textarea'))?.focus();
  const form = d.querySelector('form');
  return new Promise(res => {
    let done = false;
    const finish = ok => { if (!done) { done = true; res(ok ? Object.fromEntries(new FormData(form)) : null); } };
    form.addEventListener('submit', e => finish(e.submitter?.value === 'ok')); // sync; 'close' can be delayed in background windows
    d.onclose = () => finish(d.returnValue === 'ok');
  });
}
export const confirmBox = (title, text, ok = 'Sil') => modal(title, `<p class="mute">${esc(text)}</p>`, { ok, danger: true }).then(Boolean);

export function download(name, blobOrUrl) {
  const a = document.createElement('a');
  a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const loaded = {};
export const loadScript = src => loaded[src] ??= new Promise((res, rej) => {
  const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: () => rej(new Error('Yüklenemedi: ' + src)) });
  document.head.append(s);
});

// Stroke icons, 24x24 grid. Multiple paths separated by '|'.
const P = {
  home: 'M3 10.5 12 3l9 7.5|M5 9v11h14V9',
  book: 'M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14',
  review: 'M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  settings: 'M4 6h9|M17 6h3|M4 12h3|M11 12h9|M4 18h11|M19 18h1|M15 4v4|M9 10v4|M17 16v4',
  plus: 'M12 5v14|M5 12h14',
  pen: 'M4 20l4-1L19 8l-3-3L5 16z|M14 7l3 3',
  marker: 'M9 14l-5 5h6l2-2|M8 13l7-9 5 4-7 9z',
  eraser: 'M8 20l-4-4L14 6l6 6-8 8z|M10 20h10|M9 11l5 5',
  select: 'M5 3l14 7-6 2-2 6z',
  line: 'M5 19L19 5',
  arrow: 'M5 19L19 5|M10 5h9v9',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 5c5 0 9 3.1 9 7s-4 7-9 7-9-3.1-9-7 4-7 9-7z',
  text: 'M5 7V4h14v3|M12 4v16|M9 20h6',
  image: 'M3 5h18v14H3z|M3 16l5-5 4 4 3-3 6 6|M15 9h.01',
  undo: 'M9 14L4 9l5-5|M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5|M20 9H9a5 5 0 0 0 0 10h3',
  trash: 'M4 7h16|M9 7V4h6v3|M6 7l1 13h10l1-13',
  download: 'M12 4v11|M7 10l5 5 5-5|M5 20h14',
  upload: 'M12 20V9|M7 14l5-5 5 5|M5 4h14',
  fit: 'M4 9V4h5|M15 4h5v5|M20 15v5h-5|M9 20H4v-5',
  calc: 'M6 3h12v18H6z|M9 7h6|M9 12h.01|M12 12h.01|M15 12h.01|M9 16h.01|M12 16h.01|M15 16h.01',
  back: 'M15 18l-6-6 6-6',
  check: 'M5 12l5 5 9-10',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 5v14|M16 5v14',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 7v5l3 2',
  sigma: 'M18 5H6l6 7-6 7h12',
  x: 'M6 6l12 12|M18 6L6 18',
  dots: 'M5 12h.01|M12 12h.01|M19 12h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z|M20 20l-4-4',
  flame: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-6 1-8z',
  chart: 'M4 20V10|M10 20V4|M16 20v-7|M22 20H2',
  grid: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
  wave: 'M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0',
  resistor: 'M2 12h4l2-4 3 8 3-8 3 8 2-4h3',
  matrix: 'M7 4H4v16h3|M17 4h3v16h-3|M9 9h.01|M15 9h.01|M9 15h.01|M15 15h.01',
  phasor: 'M4 20L18 6|M12 6h6v6|M4 20h16',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  side: 'M3 4h18v16H3z|M15 4v16',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
  install: 'M12 3v12|M7 10l5 5 5-5|M4 21h16',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z|M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7|M20 4v5h-5',
  atom: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0|M12 3c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9z|M4 7.5c2-3.5 7-3 11.5 1.5S21 18.5 19 21|M20 7.5c-2-3.5-7-3-11.5 1.5S3 18.5 5 21',
};
// Animated logo: planet with a light running around its ring and a moon on a tilted orbit (CSS loops in app.css).
export const logo = (cls = '') => `<svg class="logo loop ${cls}" viewBox="0 0 64 64" aria-hidden="true">
  <circle class="lg-glow" cx="32" cy="32" r="17"/>
  <g transform="rotate(-22 32 32)"><ellipse class="lg-ring" cx="32" cy="32" rx="27" ry="7.5" pathLength="100"/><ellipse class="lg-ring-run" cx="32" cy="32" rx="27" ry="7.5" pathLength="100"/></g>
  <circle class="lg-planet" cx="32" cy="32" r="13"/>
  <path class="lg-sigma" d="M37 26h-10l6 6-6 6h10"/>
  <g transform="rotate(-22 32 32)"><path class="lg-ring-front" d="M5 32a27 7.5 0 0 0 54 0"/>
    <g class="orb-x" style="--rx:27px;--ry:7.5px;--d:3.2s"><g class="orb-y"><circle class="lg-moon" cx="32" cy="32" r="2.3"/></g></g></g>
</svg>`;

export const icon = (n, cls = '') =>
  `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n].split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;
