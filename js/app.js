import * as db from './db.js';
import { S, persist, dayKey, uid } from './db.js';
import { createBoard, renderTo, COLORS } from './board.js';
import * as T from './tools.js';
import { $, $$, esc, modal, confirmBox, toast, icon, logo, download, loadScript } from './ui.js';
import * as fx from './fx.js';
import { astronaut, mountTutor, keyCard, mountRoamer, novaReact, classify, coach, getKey } from './astro.js';
import { mountSky, galaxyCalendar, scopeChart } from './sky.js';
import { SYMBOLS, symbolSvg } from './symbols.js';
import { SHAPE_NAMES } from './shapes.js';
import * as badges from './badges.js';
import * as sync from './sync.js';
import * as upd from './update.js';
import { PLANET_THEMES, currentPlanet, setPlanetTheme, mountPlanetBackdrop } from './planets.js';

const PDFJS = 'vendor/pdf.min.js', PDFJS_WORKER = 'vendor/pdf.worker.min.js', JSPDF = 'vendor/jspdf.umd.min.js';
const view = $('#view');
const phoneQ = matchMedia('(max-width: 820px)');
let cleanup = null, installEvt = null, pendingFiles = null, update = null; // update: { state: 'downloading'|'ready', version } from the desktop shell

// ---------- helpers ----------
const STATUS = { open: 'Açık', solved: 'Çözüldü', review: 'Tekrar' };
const solarIcon = () => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-24 12 12)"/><circle cx="19.3" cy="8.7" r="1.4" fill="currentColor" stroke="none"/></svg>`;
const glyph = c => c ? `<i class="cglyph" style="--cc:${c.color || '#f4f4f5'}" aria-hidden="true">${esc(c.icon || '•')}</i>` : '';
// course card planet: size follows study time, one moon per 5 problems
const planetSvg = (c, secs, n) => { const r = 9 + Math.min(15, secs / 3600 * 3), moons = Math.min(4, Math.ceil(n / 5));
  return `<svg class="planet loop" viewBox="-50 -50 100 100" aria-hidden="true"><g transform="rotate(-18)"><ellipse rx="40" ry="11" class="pl-orbit"/>${Array.from({ length: moons }, (_, i) => `<g class="orb-x" style="--rx:40px;--ry:11px;--d:${4 + i * 2.3}s;animation-delay:-${i * 1.7}s"><g class="orb-y"><circle r="2.2" class="pl-moon"/></g></g>`).join('')}</g><circle r="${r.toFixed(1)}" class="pl-body" style="--cc:${c.color}"/><text class="pl-glyph" y="${(r * .36).toFixed(1)}" font-size="${(r * 1.05).toFixed(1)}" text-anchor="middle">${esc(c.icon)}</text></svg>`; };
const identityFields = c => `<div class="lbl">Simge<div class="pick">${db.GLYPHS.map(g => `<label class="pick-g"><input type="radio" name="icon" value="${g}" ${c.icon === g ? 'checked' : ''}><span>${g}</span></label>`).join('')}</div></div>
  <div class="lbl">Renk<div class="pick">${db.PALETTE.map(col => `<label class="pick-c" style="--cc:${col}"><input type="radio" name="color" value="${col}" ${c.color === col ? 'checked' : ''}><span></span></label>`).join('')}</div></div>`;
const pad2 = n => String(n).padStart(2, '0');
const dur = s => { s = s || 0; const h = s / 3600 | 0, m = (s % 3600) / 60 | 0; return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`; };
const hm = s => { s = s || 0; const h = s / 3600 | 0, m = Math.round((s % 3600) / 60); return h ? `${h} sa ${m} dk` : `${m} dk`; };
const route_ = () => location.hash.slice(2).split('/'); // '#/c/id' → ['c','id']
const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('mp.' + k); localStorage.setItem('mp.' + k, v); } catch { } };

function solvedByDay() {
  const m = {};
  for (const p of S.problems) if (p.status === 'solved' && p.solvedAt) { const k = dayKey(p.solvedAt); m[k] = (m[k] || 0) + 1; }
  return m;
}
function streak(byDay) {
  let n = 0; const today = dayKey();
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) { const k = dayKey(d); if (byDay[k]) n++; else if (k !== today) return n; }
}
function currentCourse() {
  const [a, b] = route_();
  if (a === 'c') return b;
  if (a === 'p') return S.problems.find(p => p.id === b)?.course;
  return S.settings.lastCourse || S.courses[0]?.id;
}

// ---------- images & PDF ----------
function toJpeg(src, w, h, max = 1800, q = .85) {
  const s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}
const parsePages = (s, max) => [...new Set(String(s).split(',').flatMap(part => {
  const [a, b] = part.split('-').map(x => parseInt(x));
  return Number.isFinite(a) ? Array.from({ length: Math.max(0, (Number.isFinite(b) ? b : a) - a + 1) }, (_, i) => a + i) : [];
}))].filter(n => n >= 1 && n <= max);

async function fileToImages(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    toast('PDF açılıyor…');
    await loadScript(PDFJS); pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let pages = [1];
    if (pdf.numPages > 1) {
      const r = await modal('PDF\'den sayfa ekle', `<p class="mute">${esc(file.name)} · ${pdf.numPages} sayfa</p>
        <label>Hangi sayfalar?<input class="inp" name="pages" value="1" placeholder="örn. 12  ·  5-7  ·  1,4,9" required></label>`, { ok: 'Ekle' });
      if (!r) return [];
      pages = parsePages(r.pages, pdf.numPages).slice(0, 30);
    }
    const out = [];
    for (const n of pages) {
      const page = await pdf.getPage(n), vp = page.getViewport({ scale: 1600 / page.getViewport({ scale: 1 }).width });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      out.push(c.toDataURL('image/jpeg', .85));
    }
    return out;
  }
  if (!file.type.startsWith('image/')) { toast('Desteklenmeyen dosya: ' + file.name); return []; }
  const bmp = await createImageBitmap(file);
  return [toJpeg(bmp, bmp.width, bmp.height)];
}

// ---------- problems ----------
function createProblem(course, { title = '', topic = '' } = {}, files = null) {
  const n = S.problems.filter(p => p.course === course).length + 1;
  const p = { id: uid(), title: title.trim() || `Soru ${n}`, course, topic: topic.trim(), status: 'open', created: Date.now(), updated: Date.now(), secs: 0 };
  S.problems.unshift(p); S.settings.lastCourse = course; persist();
  pendingFiles = files?.length ? files : null;
  location.hash = '#/p/' + p.id;
  return p;
}

async function newProblem() {
  if (!S.courses.length) { toast('Önce bir ders ekle'); return addCourse(); }
  const def = currentCourse();
  const topics = [...new Set(S.problems.map(p => p.topic).filter(Boolean))];
  const r = await modal('Yeni soru', `
    <label>Ders<select class="inp" name="course">${S.courses.map(c => `<option value="${c.id}" ${c.id === def ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Konu<input class="inp" name="topic" list="dl-topics" placeholder="örn. Thevenin, Laplace, Türev" autocomplete="off"><datalist id="dl-topics">${topics.map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>
    <label>Başlık (isteğe bağlı)<input class="inp" name="title" placeholder="örn. Örnek 3.12" autocomplete="off"></label>
    <label class="filepick">${icon('image')}<span>Soru fotoğrafı veya PDF ekle <span class="mute">(isteğe bağlı)</span></span><input type="file" name="file" accept="image/*,application/pdf"></label>
    ${matchMedia('(pointer: coarse)').matches ? `<label class="filepick">${icon('image')}<span>Kamerayla çek <span class="mute">(kitaptaki soruyu fotoğrafla)</span></span><input type="file" name="cam" accept="image/*" capture="environment"></label>` : ''}`, { ok: 'Oluştur' });
  if (!r) return;
  const f = r.cam?.size ? r.cam : r.file;
  createProblem(r.course, r, f?.size ? [f] : null);
}

async function addCourse() {
  const r = await modal('Yeni ders', `<label>Ders adı<input class="inp" name="name" required placeholder="örn. Termodinamik, Statik, Devre Analizi II" autocomplete="off"></label>`, { ok: 'Ekle' });
  if (!r?.name.trim()) return;
  const c = db.courseDefaults({ id: uid(), name: r.name.trim() });
  S.courses.push(c); persist(); location.hash = '#/c/' + c.id;
}

async function editCourse(c) {
  const p = modal('Dersi düzenle', `<label>Ders adı<input class="inp" name="name" value="${esc(c.name)}" required></label>${identityFields(c)}
    <button type="button" class="btn" data-share>${icon('download')} Bu dersi paylaş (.mathpad dosyası)</button>
    <p class="mute small">Arkadaşın dosyayı açınca ders, soruları ve çizimleriyle birlikte onun MathPad'ine eklenir; kendi verilerine dokunulmaz.</p>
    <button type="button" class="btn danger ghost-danger" data-del>${icon('trash')} Dersi ve sorularını sil</button>`);
  $('#dlg [data-share]').onclick = async () => {
    $('#dlg').close();
    download(`${c.name.replace(/[\\/:*?"<>|]/g, '_')}.mathpad`, new Blob([await db.exportCourse(c.id)], { type: 'application/json' }));
    toast('Ders dosyası indirildi ✦');
  };
  $('#dlg [data-del]').onclick = async () => {
    $('#dlg').close();
    const n = S.problems.filter(x => x.course === c.id).length;
    if (!await confirmBox('Ders silinsin mi?', `"${c.name}" ve içindeki ${n} soru çöp kutusuna taşınacak. ${db.TRASH_DAYS} gün içinde geri alabilirsin.`)) return;
    fx.stardustBurst(view.querySelector('.page-h')?.getBoundingClientRect());
    const e = db.removeCourse(c);
    location.hash = '#/courses';
    toast(`"${c.name}" çöp kutusuna taşındı`, { label: 'Geri al', run: () => { db.restoreTrash(e); fx.markRestored(c.id); route(); nav(); toast('Geri alındı ✦'); } });
  };
  const r = await p;
  if (r?.name?.trim()) { c.name = r.name.trim(); c.icon = r.icon || c.icon; c.color = r.color || c.color; c.updated = Date.now(); persist(); route(); }
}

function celebrate(origin) {
  const n = solvedByDay()[dayKey()] || 0, goal = S.settings.goal;
  const r = origin?.getBoundingClientRect?.();
  const x = r?.width ? r.left + r.width / 2 : innerWidth / 2;
  const y = r?.height ? r.top + r.height / 2 : innerHeight / 2;
  toast(n === goal ? `Günlük hedef tamam! ${n}/${goal} ✦` : `Çözüldü ✦  Bugün ${n}/${goal}`);
  if (n === goal) { fx.supernova(x, y); fx.sound('goal'); }
  else { fx.constellationBurst(x, y); fx.shootingStar(); fx.sound('solve'); }
  navigator.vibrate?.(n === goal ? [30, 60, 30] : 20);
  const byDay = solvedByDay();
  const fresh = badges.check({
    total: S.problems.filter(p => p.status === 'solved').length, streak: streak(byDay), today: n, goal, hour: new Date().getHours(),
    courseDone: S.courses.some(c => { const ps = S.problems.filter(p => p.course === c.id); return ps.length >= 10 && ps.every(p => p.status === 'solved'); }),
  });
  // one big reveal per solve (the rarest new badge); the rest are mentioned, not paraded
  if (fresh.length) setTimeout(() => { badges.reveal(fresh.at(-1)); if (fresh.length > 1) setTimeout(() => toast(`+${fresh.length - 1} rozet daha kazandın ✦ Panelde gör`), 4400); }, 1300);
}

// Opens a .mathpad file: a shared course is merged in; a full backup replaces everything (after asking).
async function restoreBackup(name, text) {
  let o; try { o = JSON.parse(text); } catch { return toast('Bu dosya okunamadı'); }
  if (o?.app === 'mathpad' && o.kind === 'course') {
    if (!await modal('Paylaşılan ders', `<p class="mute">"${esc(o.course?.name)}" dersi ve ${o.problems?.length || 0} soru MathPad'ine <b>eklenecek</b>. Mevcut verilerine dokunulmaz.</p>`, { ok: 'Ekle' })) return;
    try { const c = await db.importCourse(o); location.hash = '#/c/' + c.id; nav(); toast('Ders eklendi ✦'); } catch (err) { toast('Hata: ' + err.message); }
    return;
  }
  if (!await confirmBox('Yedek geri yüklensin mi?', `"${name}" yüklenecek. Bu cihazdaki mevcut verilerin yerine yedekteki veriler gelecek.`, 'Geri yükle')) return;
  try { await db.importJSON(text); location.hash = '#/'; location.reload(); } catch (err) { toast('Hata: ' + err.message); }
}

// Desktop: one automatic backup per day into Documents\MathPad\Yedekler (last 7 kept).
async function autoBackup() {
  if (!window.desktop?.autoBackup || !S.problems.length || S.lastAutoBackup === dayKey()) return;
  try { await desktop.autoBackup(await db.exportJSON()); S.lastAutoBackup = dayKey(); persist(); } catch { }
}
const daysSince = t => t ? Math.floor((Date.now() - t) / 864e5) : Infinity;
async function backupNow() {
  download(`mathpad-yedek-${dayKey()}.mathpad`, new Blob([await db.exportJSON()], { type: 'application/json' }));
  S.lastBackup = Date.now(); persist();
}

function renderTrash(el) {
  const left = e => Math.max(0, db.TRASH_DAYS - daysSince(e.at));
  el.innerHTML = `<h3>Çöp kutusu <span class="mute">${S.trash.length || ''}</span></h3>
    ${S.trash.length ? `<p class="mute small">Silinenler ${db.TRASH_DAYS} gün burada bekler, sonra kendiliğinden silinir.</p>
    <div class="trash-list">${S.trash.map((e, i) => `<div class="trash-row">
      <span class="grow">${e.kind === 'course' ? `<b>${esc(e.item.name)}</b> <small class="mute">· ders, ${e.problems.length} soru</small>` : `${esc(e.item.title)} <small class="mute">· ${esc(S.courses.find(c => c.id === e.item.course)?.name || 'silinmiş ders')}</small>`}</span>
      <small class="mute mono">${left(e)} gün</small>
      <button class="btn small" data-back-i="${i}">Geri al</button>
      <button class="icon-btn" data-purge-i="${i}" title="Kalıcı sil" aria-label="Kalıcı sil">${icon('x')}</button></div>`).join('')}</div>
    <button class="btn ghost-danger small" data-empty>${icon('trash')} Çöp kutusunu boşalt</button>`
    : `<p class="mute">Çöp kutusu boş ✦ Sildiğin sorular ve dersler ${db.TRASH_DAYS} gün burada bekler.</p>`}`;
  el.onclick = async ev => {
    const r = ev.target.closest('[data-back-i]'), pg = ev.target.closest('[data-purge-i]');
    if (r) {
      const entry = S.trash[+r.dataset.backI], row = r.closest('.trash-row');
      fx.stardustBurst(row?.getBoundingClientRect(), { reverse: true });
      if (entry?.item?.id) fx.markRestored(entry.item.id);
      toast(db.restoreTrash(entry) ? 'Geri alındı ✦' : 'Önce bir ders ekle');
      nav(); renderTrash(el);
    }
    if (pg) {
      const e = S.trash[+pg.dataset.purgeI];
      if (!await confirmBox('Kalıcı olarak silinsin mi?', 'Bu öğe ve çizimleri tamamen silinecek. Geri alınamaz.')) return;
      await fx.dissolve(pg.closest('.trash-row'));
      await db.purgeTrash(x => x === e); renderTrash(el);
    }
    if (ev.target.closest('[data-empty]')) {
      if (!await confirmBox('Çöp kutusu boşaltılsın mı?', `${S.trash.length} öğe ve çizimleri kalıcı olarak silinecek. Geri alınamaz.`)) return;
      await fx.dissolve(el.querySelector('.trash-list'));
      await db.purgeTrash(); renderTrash(el);
    }
  };
}

async function renderStorage(el, est, persisted) {
  const size = {}; let total = 0;
  for (const [k, v] of await db.entries()) {
    const n = typeof v === 'string' ? v.length : JSON.stringify(v ?? null).length;
    total += n; if (/^[bt]:/.test(k)) size[k.slice(2)] = (size[k.slice(2)] || 0) + n;
  }
  if (!el.isConnected) return;
  const mb = n => (n / 1e6).toFixed(n < 1e5 ? 2 : 1) + ' MB';
  const per = S.courses.map(c => ({ c, n: S.problems.filter(p => p.course === c.id).reduce((a, p) => a + (size[p.id] || 0), 0) })).filter(x => x.n > 1e3).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...per.map(x => x.n));
  const big = [...S.problems].filter(p => size[p.id] > 100e3).sort((a, b) => size[b.id] - size[a.id]).slice(0, 5);
  const empty = S.problems.filter(p => (size[p.id] || 0) < 20 && (p.secs || 0) < 60 && p.status === 'open');
  el.innerHTML = `<h3>Depolama</h3>
    <div class="stor-total"><b class="mono">${mb(total)}</b><span class="mute small">MathPad verilerin${est ? ` · cihazda ${(est.quota / 1e9).toFixed(0)} GB'a kadar yer var` : ''}${persisted ? ' · kalıcı depolama açık' : ''}</span></div>
    ${per.map(x => `<div class="cp-row"><span>${esc(x.c.name)}</span><span class="mono mute">${mb(x.n)}</span><div class="progress"><i style="width:${x.n / max * 100}%"></i></div></div>`).join('')}
    ${big.length ? `<p class="mute small">En çok yer kaplayan sorular:</p>${big.map(p => `<a class="rec-row" href="#/p/${p.id}"><span class="grow">${esc(p.title)}</span><span class="mono mute small">${mb(size[p.id])}</span></a>`).join('')}` : ''}
    <div class="row wrap"><button class="btn" data-compress>${icon('image')} Fotoğrafları sıkıştır</button>${empty.length ? `<button class="btn" data-clean>${icon('trash')} ${empty.length} boş soruyu temizle</button>` : ''}</div>
    <p class="mute small">Sıkıştırma büyük fotoğrafları gözle fark edilmeyecek kadar küçültür. Boş soru: hiç çizim ve süre olmayan açık soru.</p>`;
  el.querySelector('[data-compress]').onclick = async e => {
    e.currentTarget.disabled = true; e.currentTarget.innerHTML = `<span class="orbit-loader"></span> Sıkıştırılıyor…`;
    const r = await compressPhotos();
    toast(r.count ? `${r.count} fotoğraf sıkıştırıldı, ${mb(r.saved)} kazanıldı ✦` : 'Sıkıştırılacak büyük fotoğraf yok ✦');
    renderStorage(el, est, persisted);
  };
  el.querySelector('[data-clean]')?.addEventListener('click', () => {
    fx.stardustBurst(el.getBoundingClientRect());
    const gone = empty.map(p => db.removeProblem(p.id));
    nav(); renderStorage(el, est, persisted); renderTrash($('[data-trash]'));
    toast(`${gone.length} boş soru çöp kutusuna taşındı`, { label: 'Geri al', run: () => { gone.forEach(db.restoreTrash); fx.stardustBurst(null, { reverse: true }); nav(); route(); } });
  });
}
async function compressPhotos() {
  let saved = 0, count = 0;
  for (const p of S.problems) {
    const els = await db.get('b:' + p.id); if (!Array.isArray(els)) continue;
    let changed = false;
    for (let i = 0; i < els.length; i++) {
      const it = els[i]; if (it.type !== 'img' || it.src.length < 300e3) continue;
      const im = new Image(); im.src = it.src;
      try { await im.decode(); } catch { continue; }
      const src = toJpeg(im, im.naturalWidth, im.naturalHeight, 1400, .72);
      if (src.length < it.src.length * .9) { saved += it.src.length - src.length; els[i] = { ...it, src }; changed = true; count++; }
    }
    if (changed) await db.set('b:' + p.id, els);
  }
  return { saved, count };
}
function planetThemeOf(id) {
  return PLANET_THEMES.find(p => p.id === id) || PLANET_THEMES.find(p => p.id === 'earth') || PLANET_THEMES[0];
}
function hasCustomAccent(pid) {
  return !!S.settings.accent && (
    S.settings.customAccentFor === pid ||
    (S.settings.customAccentFor === undefined && S.settings.planet === undefined)
  );
}
function applyPrefs() {
  const h = document.documentElement;
  h.dataset.motion = S.settings.motion || 'full';
  h.dataset.sound = S.settings.sound || 'off';
  h.dataset.theme = S.settings.theme || 'space';
  const pid = currentPlanet();
  h.dataset.planet = pid;
  h.style.setProperty('--acc', hasCustomAccent(pid) ? S.settings.accent : planetThemeOf(pid).accent);
  mountPlanetBackdrop();
  dispatchEvent(new Event('mp-theme'));
}
const THEMES = [['space', 'Derin Uzay'], ['paper', 'Kağıt'], ['night', 'Gece Gözlem'], ['aurora', 'Aurora']];
const ACCENTS = ['#f4f4f5', '#7dd3fc', '#c4b5fd', '#fde68a', '#7cf5c8', '#fca5a5'];

// ---------- pomodoro ----------
const pomo = { total: 25 * 60, left: 25 * 60, end: 0, iv: 0 };
function beep() {
  try { const a = new AudioContext(); [0, .25, .5].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.2, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .2); o.start(a.currentTime + t); o.stop(a.currentTime + t + .22); }); } catch { }
}
function pomoToggle() {
  if (pomo.iv) { clearInterval(pomo.iv); pomo.iv = 0; }
  else {
    if (window.Notification?.permission === 'default') Notification.requestPermission();
    pomo.end = Date.now() + pomo.left * 1000;
    pomo.iv = setInterval(() => {
      pomo.left = Math.max(0, Math.ceil((pomo.end - Date.now()) / 1000));
      if (!pomo.left) {
        clearInterval(pomo.iv); pomo.iv = 0; pomo.left = pomo.total;
        const k = dayKey(); S.pomos[k] = (S.pomos[k] || 0) + 1; persist(); beep();
        const pb = $('.pomo-body')?.getBoundingClientRect();
        fx.supernova(pb?.width ? pb.left + pb.width / 2 : innerWidth / 2, pb?.height ? pb.top + pb.height / 2 : innerHeight / 2, { soft: true });
        toast('Süre doldu! Kısa bir mola ver ✦');
        if (window.Notification?.permission === 'granted') new Notification('MathPad', { body: 'Çalışma süresi doldu. Mola zamanı!', icon: 'icons/icon-192.png' });
      }
      pomoUI();
    }, 500);
  }
  pomoUI();
}
function pomoSet(min) { clearInterval(pomo.iv); pomo.iv = 0; pomo.total = pomo.left = min * 60; pomoUI(); }
function pomoUI() {
  const t = dur(pomo.left);
  document.body.classList.toggle('pomo-running', !!pomo.iv);
  $$('[data-pomo-t]').forEach(e => e.textContent = t);
  $$('[data-pomo-go]').forEach(e => e.innerHTML = pomo.iv ? `${icon('pause')} Durdur` : `${icon('play')} ${pomo.left < pomo.total ? 'Devam' : 'Başlat'}`);
  $$('[data-pomo-m]').forEach(e => e.classList.toggle('on', +e.dataset.pomoM * 60 === pomo.total));
  const pill = $('#pomo-pill'); pill.hidden = !pomo.iv; pill.innerHTML = `${icon('clock')}<span class="mono">${t}</span>`;
  const ring = $('[data-pomo-ring]'); if (ring) ring.style.strokeDashoffset = 283 * pomo.left / pomo.total;
}

// ---------- navigation ----------
function nav() {
  const [a, b] = route_(), here = a || '';
  const link = (href, ic, label, active, extra = '', cls = '') =>
    `<a href="${href}" class="nav-link ${active ? 'on' : ''} ${cls}" title="${label}"${active ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${extra}</a>`;
  const rev = S.problems.filter(p => p.status === 'review').length;
  // brand is rendered once so its looping animation never restarts on navigation
  if (!$('#nav-body')) $('#nav').innerHTML = `<a href="#/" class="brand" aria-label="MathPad ana sayfa">${logo()}<span>MATH<b>PAD</b></span></a><div id="nav-body" class="nav-body"></div>`;
  $('#nav-body').innerHTML = `
    <button class="btn primary new-btn" data-act="new">${icon('plus')} Yeni soru</button>
    ${link('#/', 'home', 'Panel', here === '')}
    ${link('#/courses', 'book', 'Dersler', here === 'courses', '', here === 'c' ? 'on-mob' : '')}
    <div class="nav-courses">${S.courses.map(c => {
      const n = S.problems.filter(p => p.course === c.id).length;
      const on = (here === 'c' && b === c.id) || (here === 'p' && S.problems.find(p => p.id === b)?.course === c.id);
      return `<a href="#/c/${c.id}" class="nav-sub ${on ? 'on' : ''}"><span>${glyph(c)}${esc(c.name)}</span><i>${n || ''}</i></a>`;
    }).join('')}<button class="nav-sub add" data-act="add-course">${icon('plus')} Ders ekle</button></div>
    ${link('#/review', 'review', 'Tekrar', here === 'review', rev ? `<i class="count">${rev}</i>` : '')}
    <button type="button" class="dock-new" data-act="new" aria-label="Yeni soru">${icon('plus')}</button>
    ${link('#/tools', 'tool', 'Araçlar', here === 'tools')}
    ${link('#/sim', 'atom', 'Simülasyon', here === 'sim')}
    ${link('#/settings', 'settings', 'Ayarlar', here === 'settings')}
    <div class="nav-foot">${syncPill()}${installEvt ? `<button class="btn ghost" data-act="install">${icon('install')} Uygulamayı yükle</button>` : ''}${update?.state === 'ready' ? `<button class="btn primary upd-btn" data-act="update">${icon('download')} ${esc(update.version)} hazır · Yeniden başlat</button>` : update?.state === 'downloading' ? `<p class="mute small upd-note"><span class="orbit-loader"></span> Güncelleme iniyor (${esc(update.version)})</p>` : ''}</div>`;
  fx.syncNav();
}

// ---------- Nova's weekly coaching ----------
function coachHtml() {
  const c = S.coach, fresh = c && daysSince(c.at) < 7;
  return `<div class="card-h"><h3 class="row">${astronaut('xs')} Nova'nın haftalık notu</h3>${c ? `<span class="mute small">${new Date(c.at).toLocaleDateString('tr')}</span>` : ''}</div>
    ${c ? `<div class="note coach-note">${T.renderNote(c.text)}</div>` : `<p class="mute">Nova son haftanı inceleyip neyin iyi gittiğini, neyi ihmal ettiğini ve bu hafta ne çözmen gerektiğini söyler.</p>`}
    <button class="btn ${fresh ? 'ghost' : 'primary'} small" data-coach-go>${icon('sparkle')} ${c ? 'Yeniden analiz et' : 'Haftalık analizimi yap'}</button>`;
}
function coachSummary() {
  const week = Date.now() - 7 * 864e5, byDay = solvedByDay();
  const lines = S.courses.map(c => {
    const ps = S.problems.filter(p => p.course === c.id);
    const solvedW = ps.filter(p => p.status === 'solved' && p.solvedAt > week).length, rev = ps.filter(p => p.status === 'review');
    const secs = ps.filter(p => (p.updated || 0) > week).reduce((a, p) => a + (p.secs || 0), 0);
    const topics = [...new Set(rev.map(p => p.topic).filter(Boolean))].slice(0, 4).join(', ');
    return `- ${c.name}: toplam ${ps.length} soru, bu hafta ${solvedW} çözüldü, tekrar listesinde ${rev.length}${topics ? ` (konular: ${topics})` : ''}, bu hafta ${Math.round(secs / 60)} dk çalışıldı`;
  });
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return `${d.toLocaleDateString('tr', { weekday: 'short' })}: ${byDay[dayKey(d)] || 0}`; });
  return `Haftalık çalışma özetim (günlük hedefim ${S.settings.goal} soru, serim ${streak(byDay)} gün):\nGünlere göre çözülen: ${days.join(', ')}\nDerslere göre:\n${lines.join('\n')}`;
}
async function runCoach() {
  const card = $('[data-coach]'); if (!card) return;
  if (!getKey()) return toast('Önce Ayarlar → Astronot asistan bölümünden bir API anahtarı ekle');
  card.querySelector('[data-coach-go]').disabled = true;
  card.querySelector('[data-coach-go]').innerHTML = `<span class="orbit-loader"></span> Nova inceliyor…`;
  try {
    const text = await coach(coachSummary());
    if (text) { S.coach = { at: Date.now(), text }; persist(); }
  } catch (err) { toast('Nova şu an cevap veremedi: ' + (err?.message || 'bilinmeyen hata')); }
  if ($('[data-coach]')) $('[data-coach]').innerHTML = coachHtml();
}

// ---------- Google Drive sync ----------
const openProblemId = () => { const [a, b] = route_(); return a === 'p' ? b : null; };
async function runSync() {
  if (!sync.connected() || !navigator.onLine) return;
  try {
    const r = await sync.sync({ openProblem: openProblemId() });
    if (r.changed) { if (openProblemId()) nav(); else route(); }
  } catch { /* status pill shows the error */ }
}
function syncPill() {
  if (!sync.connected()) return '';
  const st = sync.status(), ago = st.at ? Math.round((Date.now() - st.at) / 60e3) : null;
  const txt = st.state === 'busy' ? 'Eşitleniyor…' : st.state === 'error' ? 'Eşitleme hatası' : ago == null ? 'Drive bağlı' : `Eşitlendi · ${ago ? ago + ' dk önce' : 'şimdi'}`;
  return `<a href="#/settings" class="sync-pill ${st.state || ''}" title="${esc(st.error || 'Google Drive eşitlemesi')}">${st.state === 'busy' ? '<span class="orbit-loader"></span>' : '☁'} ${txt}</a>`;
}
let gdAbort = null;
function gdCard(el) {
  const c = sync.client(), st = sync.status();
  const head = `<h3>☁ Google Drive eşitleme</h3><p class="mute">Derslerin, soruların ve çizimlerin Google Drive'ında saklanır; telefon, tablet ve bilgisayar aynı verileri görür. Veriler Drive'ın gizli uygulama klasöründe durur, başka hiçbir dosyana erişilmez.</p>`;
  if (!c.id) {
    el.innerHTML = `${head}<ol class="mute small steps">
      <li><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud</a>'da bir proje aç, <b>Google Drive API</b>'yi etkinleştir.</li>
      <li><b>OAuth izin ekranı</b>: türü <i>External</i>, kapsam olarak <code>drive.appdata</code>, test kullanıcısı olarak kendi Gmail adresin.</li>
      <li><b>Kimlik bilgileri → OAuth istemci kimliği</b>: uygulama türü <i>TV ve sınırlı giriş cihazları</i>. Çıkan kimliği ve gizli anahtarı aşağıya yapıştır.</li></ol>
      <form class="row wrap" data-gdform><input class="inp mono" name="id" placeholder="…apps.googleusercontent.com" autocomplete="off" style="max-width:340px" aria-label="İstemci kimliği"><input class="inp mono" name="secret" type="password" placeholder="GOCSPX-…" autocomplete="off" style="max-width:220px" aria-label="İstemci gizli anahtarı"><button class="btn primary">Kaydet</button></form>`;
    el.querySelector('[data-gdform]').onsubmit = e => {
      e.preventDefault(); const id = e.target.id.value.trim();
      if (!/\.apps\.googleusercontent\.com$/.test(id)) return toast('İstemci kimliği …apps.googleusercontent.com ile bitmeli');
      sync.setClient(id, e.target.secret.value); gdCard(el);
    };
    return;
  }
  if (!sync.connected()) {
    el.innerHTML = `${head}<button class="btn primary" data-gdgo>Google ile bağlan</button><div data-gdcode></div>
      <p class="mute small">${sync.BUILTIN.id ? '' : '<button type="button" class="link" data-gdreset>İstemci kimliğini değiştir</button>'}</p>`;
    el.querySelector('[data-gdreset]')?.addEventListener('click', () => { sync.setClient(''); gdCard(el); });
    el.querySelector('[data-gdgo]').onclick = async e => {
      e.currentTarget.disabled = true;
      try {
        const dc = await sync.startSignIn();
        el.querySelector('[data-gdcode]').innerHTML = `<div class="gd-code"><p class="mute small">1. Aşağıdaki adresi aç (başka bir cihazdan da olur)</p>
          <a class="btn" href="${esc(dc.verification_url)}" target="_blank" rel="noopener">${esc(dc.verification_url.replace(/^https?:\/\//, ''))} ↗</a>
          <p class="mute small">2. Bu kodu gir, Google hesabınla izin ver</p><b class="mono gd-big">${esc(dc.user_code)}</b>
          <button type="button" class="chip" data-gdcopy>Kodu kopyala</button><p class="mute small"><span class="orbit-loader"></span> Onay bekleniyor…</p></div>`;
        el.querySelector('[data-gdcopy]').onclick = () => { navigator.clipboard?.writeText(dc.user_code); toast('Kod kopyalandı'); };
        gdAbort?.abort(); gdAbort = new AbortController();
        if (await sync.finishSignIn(dc, gdAbort.signal)) { toast('Google Drive bağlandı ✦ İlk eşitleme yapılıyor…'); gdCard(el); await runSync(); gdCard(el); nav(); }
        else { toast('Kodun süresi doldu, tekrar dene'); gdCard(el); }
      } catch (err) { toast(err.message); gdCard(el); }
    };
    return;
  }
  el.innerHTML = `${head}<p class="mono small ${st.state === 'error' ? 'err' : ''}">${st.state === 'error' ? 'Hata: ' + esc(st.error) : st.at ? 'Son eşitleme: ' + new Date(st.at).toLocaleString('tr') : 'Henüz eşitlenmedi'}</p>
    <div class="row wrap"><button class="btn primary" data-gdnow>☁ Şimdi eşitle</button><button class="btn ghost" data-gdoff>Bağlantıyı kes</button></div>
    <p class="mute small">Değişiklikler birkaç saniye içinde ve uygulama her açıldığında kendiliğinden eşitlenir.</p>`;
  el.querySelector('[data-gdnow]').onclick = async e => {
    e.currentTarget.disabled = true; e.currentTarget.innerHTML = '<span class="orbit-loader"></span> Eşitleniyor…';
    try { const r = await sync.sync({ openProblem: openProblemId() }); toast(`Eşitlendi ✦ ${r.boardsIn || 0} indi, ${r.boardsOut || 0} yüklendi`); } catch (err) { toast(err.message); }
    gdCard(el); nav();
  };
  el.querySelector('[data-gdoff]').onclick = async () => {
    if (!await confirmBox('Drive bağlantısı kesilsin mi?', 'Bu cihazdaki veriler kalır; Drive\'daki kopya da silinmez. Sadece eşitleme durur.', 'Bağlantıyı kes')) return;
    await sync.disconnect(); gdCard(el); nav();
  };
}

// ---------- views ----------
function home() {
  const byDay = solvedByDay(), today = dayKey(), n = byDay[today] || 0, goal = S.settings.goal || 10;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
  const counts = days.map(d => byDay[dayKey(d)] || 0), max = Math.max(goal, ...counts);
  const week = counts.slice(-7).reduce((a, b) => a + b, 0), weekTime = days.slice(-7).reduce((a, d) => a + (S.time[dayKey(d)] || 0), 0);
  const total = S.problems.filter(p => p.status === 'solved').length, st = streak(byDay);
  const hour = new Date().getHours(), greet = hour < 6 ? 'Gece mesaisi' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi çalışmalar' : 'İyi akşamlar';
  const recent = [...S.problems].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 6);
  const C = 2 * Math.PI * 52, frac = Math.min(1, n / goal), gal = galaxyCalendar(byDay), bd = badges.row();

  view.innerHTML = `<div class="page">
    <svg class="orbit-deco loop" viewBox="-200 -200 400 400" aria-hidden="true"><g transform="rotate(-18)">
      ${[[190, 60, 17], [140, 44, 11], [92, 29, 7]].map(([rx, ry, d], i) => `<ellipse rx="${rx}" ry="${ry}"/><g class="orb-x" style="--rx:${rx}px;--ry:${ry}px;--d:${d}s;animation-delay:-${i * 2}s"><g class="orb-y"><circle r="${3 - i * .5}"/></g></g>`).join('')}
      <circle r="22" class="od-core"/></g></svg>
    <header class="page-h"><div><p class="eyebrow">${new Date().toLocaleDateString('tr', { weekday: 'long', day: 'numeric', month: 'long' })} <span class="coord">· GÜN ${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 864e5)}</span></p><h1>${greet}</h1></div>
      <button class="btn primary" data-act="new">${icon('plus')} Yeni soru</button></header>
    ${!window.desktop && S.problems.length >= 5 && daysSince(S.lastBackup) >= 7 ? `<div class="card pad reminder">${icon('download')}<div class="grow"><b>${S.lastBackup ? `Son yedeğin ${daysSince(S.lastBackup)} gün önce` : 'Henüz hiç yedek almadın'}</b><p class="mute small">${S.problems.length} sorun sadece bu tarayıcıda duruyor. Bir yedek al, içi rahat etsin.</p></div><button class="btn primary" data-act="backup">Yedek al</button></div>` : ''}
    ${S.problems.length ? '' : `<div class="card pad welcome">${logo('xl')}<h3>MathPad'e hoş geldin ✦</h3>
      <ol><li><b>Yeni soru</b>'ya bas, dersini seç.</li><li>Sorunun fotoğrafını çek ya da PDF'ten sayfa ekle.</li><li>Tahtada kalemle çöz, bitince <b>Çözüldü</b> de. İstatistiğin kendiliğinden tutulur.</li></ol>
      <button class="btn primary" data-act="new">${icon('plus')} İlk sorunu ekle</button></div>`}
    <div class="dash">
      <div class="card pad goal">
        <svg viewBox="0 0 120 120" class="ring" data-frac="${frac}"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" style="--c:${C};stroke-dasharray:${C};stroke-dashoffset:${C * (1 - frac)}"/><circle cx="60" cy="60" r="52" class="ring-comet loop" pathLength="100"/></svg>
        <div class="goal-txt"><b class="big mono"><span data-count="${n}">${n}</span><span>/${goal}</span></b><span class="mute">bugün çözülen</span></div>
        <div class="goal-side"><p>${n >= goal ? 'Hedef tamam. Harikasın ✦' : `Hedefe <b>${goal - n}</b> soru kaldı`}</p><button class="btn ghost small" data-act="goal">Hedefi değiştir</button></div>
      </div>
      <div class="kpis">
        <div class="card pad kpi">${icon('chart')}<b class="mono" data-count="${week}">${week}</b><span>bu hafta</span></div>
        <div class="card pad kpi">${icon('flame', 'flicker loop')}<b class="mono" data-count="${st}">${st}</b><span>gün seri</span></div>
        <div class="card pad kpi">${icon('clock')}<b class="mono">${hm(S.time[today])}</b><span>bugün çalışma</span></div>
        <div class="card pad kpi">${icon('check')}<b class="mono" data-count="${total}">${total}</b><span>toplam çözülen</span></div>
      </div>
      <div class="card pad chart-card"><div class="card-h"><h3>Son 14 gün</h3><span class="mute small">bu hafta ${hm(weekTime)}</span></div>
        ${scopeChart(days, counts, goal)}</div>
      <div class="card pad pomo">
        <div class="card-h"><h3>Odak sayacı</h3><span class="mute small">bugün ${S.pomos[today] || 0} seans</span></div>
        <div class="pomo-body"><svg viewBox="0 0 100 100" class="pomo-ring"><circle cx="50" cy="50" r="45" class="ring-bg"/><circle cx="50" cy="50" r="45" class="ring-fg" data-pomo-ring style="stroke-dasharray:283"/><circle cx="50" cy="50" r="45" class="ring-comet loop pomo-comet" pathLength="100"/></svg><b class="mono" data-pomo-t></b></div>
        <div class="row center"><button class="chip" data-pomo-m="25">25 dk</button><button class="chip" data-pomo-m="50">50 dk</button><button class="chip" data-pomo-m="5">5 dk mola</button></div>
        <button class="btn primary wide" data-pomo-go></button>
      </div>
      <div class="card sky-card"><div class="card-h pad-x"><h3>Senin gökyüzün</h3><span class="mute small">${S.problems.filter(p => p.status === 'solved').length} yıldız · her ders bir takımyıldız</span></div>
        <div class="sky-wrap"><canvas class="sky" aria-label="Çözdüğün sorular yıldız olarak"></canvas><div class="sky-tip" hidden></div>
        ${S.problems.some(p => p.status === 'solved' || p.status === 'review') ? '' : '<p class="sky-empty mute">İlk soruyu çözdüğünde burada ilk yıldızın doğacak ✦</p>'}</div></div>
      <div class="card solar-card"><div class="card-h pad-x"><div class="solar-card-head"><h3>Güneş Sistemi</h3><span class="mute small">8 gezegen · etkileşimli 3B gözlemevi</span></div><a class="btn small solar-go" href="#/evren">${solarIcon()} Güneş sistemine git</a></div>
        <div class="solar-preview-wrap"><div class="solar-preview-host" data-solar-preview></div><span class="solar-preview-cap" aria-hidden="true">Keşfetmek için dokun →</span></div></div>
      <div class="card pad galaxy-card"><div class="card-h"><h3>Yıllık galaksi</h3><span class="mute small">son 12 ayda ${gal.total} soru</span></div><div class="galaxy-scroll">${gal.svg}</div></div>
      <div class="card pad badges-card"><div class="card-h"><h3>Rozetler</h3><span class="mute small">${bd.n}/${badges.BADGES.length}</span></div><div class="badge-row">${bd.html}</div></div>
      <div class="card pad coach-card" data-coach>${coachHtml()}</div>
      <div class="card pad cprog"><div class="card-h"><h3>Dersler</h3><a class="mute small" href="#/courses">tümü →</a></div>
        ${S.courses.map(c => { const ps = S.problems.filter(p => p.course === c.id), s = ps.filter(p => p.status === 'solved').length;
          return `<a class="cp-row" href="#/c/${c.id}"><span>${esc(c.name)}</span><span class="mono mute">${s}/${ps.length}</span><div class="progress"><i style="width:${ps.length ? s / ps.length * 100 : 0}%"></i></div></a>`; }).join('') || '<p class="mute">Ders yok</p>'}
      </div>
      <div class="card pad recent"><div class="card-h"><h3>Son çalışılanlar</h3></div>
        ${recent.map(p => `<a class="rec-row" href="#/p/${p.id}"><span class="dot ${p.status}"></span><span class="grow">${esc(p.title)}<small class="mute"> · ${esc(db.courseOf(p)?.name || '')}</small></span><span class="mono mute small">${hm(p.secs)}</span></a>`).join('') || '<p class="mute">Henüz soru yok.</p>'}
      </div>
    </div></div>`;
  pomoUI();
  view.onclick = e => {
    const m = e.target.closest('[data-pomo-m]'); if (m) pomoSet(+m.dataset.pomoM);
    if (e.target.closest('[data-pomo-go]')) pomoToggle();
    if (e.target.closest('[data-coach-go]')) runCoach();
  };
  const stopSky = mountSky($('canvas.sky'), { courses: S.courses, problems: S.problems, onOpen: id => location.hash = '#/p/' + id });
  let dead = false, stopSolar = null;
  const solarHost = $('[data-solar-preview]');
  if (solarHost) {
    mountSolarAny(solarHost, { preview: true }).then(stop => { if (dead) stop?.(); else stopSolar = stop; }).catch(() => {});
  }
  return () => { dead = true; stopSky?.(); stopSolar?.(); };
}

function pcard(p) {
  return `<a class="pcard" data-pid="${p.id}" href="#/p/${p.id}"><div class="thumb"><img data-thumb="${p.id}" alt=""></div>
    <div class="pc-body"><b>${esc(p.title)}</b><span class="mute small">${esc(p.topic || 'konu yok')} · ${hm(p.secs)}</span></div>
    <span class="badge ${p.status}">${STATUS[p.status]}</span></a>`;
}
function loadThumbs(root) {
  $$('img[data-thumb]', root).forEach(async img => { const src = await db.get('t:' + img.dataset.thumb); img.parentNode.classList.add(src ? 'has' : 'none'); if (src) img.src = src; });
}

function course(id) {
  const c = S.courses.find(c => c.id === id);
  if (!c) return notFound();
  S.settings.lastCourse = id;
  const ps = S.problems.filter(p => p.course === id), solved = ps.filter(p => p.status === 'solved').length, rev = ps.filter(p => p.status === 'review').length;
  const topics = db.topicsOf(id);
  let filter = pref('filter') || 'all', topic = '', q = '';
  view.innerHTML = `<div class="page">
    <header class="page-h"><div><p class="eyebrow">Ders</p><h1>${glyph(c)} ${esc(c.name)}</h1><p class="mute">${solved}/${ps.length} çözüldü${rev ? ` · ${rev} tekrar` : ''}</p></div>
      <div class="row"><a class="btn" href="#/tools/formulas/${id}">${icon('sigma')}<span class="hide-s">Formüller</span></a><button class="icon-btn" data-act="edit-course" aria-label="Dersi düzenle">${icon('dots')}</button><button class="btn primary" data-act="new">${icon('plus')} Yeni soru</button></div></header>
    <div class="progress lg"><i style="width:${ps.length ? solved / ps.length * 100 : 0}%"></i></div>
    <div class="filters">
      <div class="seg" data-f>${[['all', 'Hepsi'], ['open', 'Açık'], ['solved', 'Çözüldü'], ['review', 'Tekrar']].map(([k, l]) => `<button data-k="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${topics.length ? `<select class="inp" data-topic><option value="">Tüm konular</option>${topics.map(t => `<option>${esc(t)}</option>`).join('')}</select>` : ''}
      <label class="search">${icon('search')}<input class="inp" placeholder="Ara…" data-q></label>
    </div>
    <div data-list></div>
    <p class="mute small drop-hint">İpucu: Soru fotoğraflarını/PDF'leri bu sayfaya sürükle, her biri yeni soru olsun.</p></div>`;
  const list = $('[data-list]');
  function render(anim = false) {
    const rows = ps.filter(p => (filter === 'all' || p.status === filter) && (!topic || p.topic === topic) && (!q || (p.title + ' ' + p.topic).toLocaleLowerCase('tr').includes(q)));
    list.className = rows.length ? 'pgrid' : '';
    list.innerHTML = rows.map(pcard).join('') || `<div class="empty card pad">${astronaut('float wave')}<p>${ps.length ? 'Bu filtrede soru yok.' : 'Bu derste henüz soru yok.'}</p>${ps.length ? '' : `<button class="btn primary" data-act="new">${icon('plus')} Soru ekle</button>`}</div>`;
    loadThumbs(list);
    if (anim) fx.stagger(list);
    fx.enhanceView(list);
  }
  $('[data-f]').onclick = e => { const k = e.target.dataset.k; if (!k) return; filter = k; pref('filter', k); $$('[data-f] button').forEach(b => b.classList.toggle('on', b === e.target)); render(true); };
  $('[data-topic]')?.addEventListener('change', e => { topic = e.target.value; render(true); });
  $('[data-q]').oninput = e => { q = e.target.value.trim().toLocaleLowerCase('tr'); render(false); };
  view.querySelector('[data-act=edit-course]').onclick = () => editCourse(c);
  render();
  // drag & drop files → one problem per file
  const over = e => { e.preventDefault(); view.classList.add('dragging'); };
  const leave = () => view.classList.remove('dragging');
  const drop = async e => {
    e.preventDefault(); leave();
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (!files.length) return;
    if (files.length === 1) return createProblem(id, { title: files[0].name.replace(/\.\w+$/, '') }, files);
    toast(`${files.length} soru oluşturuluyor…`);
    for (const f of files) {
      try {
        const els = await imagesToEls(await fileToImages(f)); if (!els.length) continue;
        const p = { id: uid(), title: f.name.replace(/\.\w+$/, ''), course: id, topic: '', status: 'open', created: Date.now(), updated: Date.now(), secs: 0 };
        await db.set('b:' + p.id, els);
        await db.set('t:' + p.id, (await renderTo(els, { box: [360, 230], bg: '#0b0b0e', map: null })).toDataURL('image/jpeg', .7));
        S.problems.unshift(p);
      } catch (err) { toast('Eklenemedi: ' + f.name); }
    }
    persist(); route();
  };
  view.addEventListener('dragover', over); view.addEventListener('dragleave', leave); view.addEventListener('drop', drop);
  return () => { view.removeEventListener('dragover', over); view.removeEventListener('dragleave', leave); view.removeEventListener('drop', drop); };
}
async function imagesToEls(srcs) {
  const out = []; let y = 0;
  for (const src of srcs) {
    const im = new Image(); im.src = src; await im.decode();
    const w = 900, h = w * im.naturalHeight / im.naturalWidth;
    out.push({ type: 'img', src, x: 0, y, w, h }); y += h + 30;
  }
  return out;
}

function courses() {
  view.innerHTML = `<div class="page"><header class="page-h"><div><p class="eyebrow">Tüm dersler</p><h1>Dersler</h1></div><div class="row"><a class="btn solar-entry-btn" href="#/evren" aria-label="Güneş Sistemi görünümüne git">${solarIcon()} Güneş Sistemi</a><button class="btn primary" data-act="add-course">${icon('plus')} Ders ekle</button></div></header>
    <div class="cgrid">${S.courses.map(c => {
      const ps = S.problems.filter(p => p.course === c.id), s = ps.filter(p => p.status === 'solved').length, r = ps.filter(p => p.status === 'review').length;
      const t = ps.reduce((a, p) => a + (p.secs || 0), 0);
      return `<a class="card pad ccard" data-cid="${c.id}" href="#/c/${c.id}" style="--cc:${c.color}">${planetSvg(c, t, ps.length)}<h3>${esc(c.name)}</h3><div class="progress"><i style="width:${ps.length ? s / ps.length * 100 : 0}%"></i></div>
        <div class="cc-stats mono small"><span>${s}/${ps.length} çözüldü</span>${r ? `<span>${r} tekrar</span>` : ''}<span>${hm(t)}</span></div></a>`;
    }).join('')}<button class="card pad ccard add" data-act="add-course">${icon('plus')}<span>Ders ekle</span><small class="mute">Her mühendislik dersi için</small></button></div></div>`;
}

function review() {
  const rev = S.problems.filter(p => p.status === 'review').sort((a, b) => (a.updated || 0) - (b.updated || 0));
  const open = S.problems.filter(p => p.status === 'open');
  view.innerHTML = `<div class="page"><header class="page-h"><div><p class="eyebrow">Tekrar listesi</p><h1>Tekrar</h1><p class="mute">Yanlış yaptığın ya da tekrar bakmak istediğin sorular. Bir soruyu "Tekrar" olarak işaretle, burada toplansın.</p></div></header>
    <h3 class="sec-h">${icon('review')} Tekrar edilecek <span class="mute">${rev.length}</span></h3>
    ${rev.length ? `<div class="pgrid">${rev.map(pcard).join('')}</div>` : '<p class="mute card pad">Tekrar listen boş ✦</p>'}
    <h3 class="sec-h">${icon('pen')} Yarım kalan <span class="mute">${open.length}</span></h3>
    ${open.length ? `<div class="pgrid">${open.map(pcard).join('')}</div>` : '<p class="mute card pad">Açık soru yok.</p>'}</div>`;
  loadThumbs(view);
}

const TOOLS = [['calc', 'calc', 'Hesap makinesi'], ['plot', 'wave', 'Grafik & Bode'], ['matrix', 'matrix', 'Matris / Denklem'], ['phasor', 'phasor', 'Fazör'], ['resistor', 'resistor', 'Direnç renk kodu'], ['formulas', 'sigma', 'Formül kağıdı']];
function tools(tab = 'calc', cid) {
  if (!TOOLS.some(t => t[0] === tab)) tab = 'calc';
  view.innerHTML = `<div class="page"><header class="page-h"><div><p class="eyebrow">Araçlar</p><h1>${TOOLS.find(t => t[0] === tab)[2]}</h1></div></header>
    <div class="tabs">${TOOLS.map(([k, ic, l]) => `<a href="#/tools/${k}" class="tab ${k === tab ? 'on' : ''}">${icon(ic)}<span>${l}</span></a>`).join('')}</div>
    <div class="card pad tool-body" data-tool></div></div>`;
  const el = $('[data-tool]');
  return ({ calc: T.mountCalc, plot: T.mountPlot, matrix: T.mountMatrix, phasor: T.mountPhasor, resistor: T.mountResistor, formulas: e => T.mountFormulas(e, cid || currentCourse()) })[tab](el);
}

// Simulation center (EEE): each simulation lives in js/sim.js, loaded on first visit
async function sim(id) {
  const { SIMS, mountSim } = await import('./sim.js');
  const cur = SIMS.find(x => x.id === id) || SIMS[0];
  view.innerHTML = `<div class="page"><header class="page-h"><div><p class="eyebrow">Simülasyon merkezi</p><h1>${esc(cur.title)}</h1></div></header>
    <div class="tabs">${SIMS.map(x => `<a href="#/sim/${x.id}" class="tab ${x.id === cur.id ? 'on' : ''}">${icon(x.icon)}<span>${esc(x.title)}</span></a>`).join('')}</div>
    <div class="card pad tool-body sim-body" data-sim></div></div>`;
  return mountSim($('[data-sim]'), cur.id);
}

// WebGL renderer when the device supports it, canvas 2D version otherwise; both load on demand
async function mountSolarAny(host, opts) {
  try { const stop = (await import('./solar3d.js')).mountSolar3D(host, opts); if (stop) return stop; } catch (err) { console.warn('WebGL Güneş Sistemi açılamadı', err); }
  if (!host.isConnected) return null;
  return (await import('./solar.js')).mountSolar(host, opts);
}
// Interactive 3D Solar System view (#/evren), loaded on demand so startup stays fast
async function solar() {
  view.innerHTML = `<div class="solar-page" data-solar-stage></div>`;
  const prevTitle = document.title;
  document.title = 'Güneş Sistemi · MathPad';
  const stop = await mountSolarAny($('[data-solar-stage]'), { preview: false });
  if (route_()[0] !== 'evren') { stop?.(); return; }
  return () => { document.title = prevTitle; stop?.(); };
}

async function settings() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches;
  const curP = currentPlanet(), pTheme = planetThemeOf(curP), customAcc = hasCustomAccent(curP);
  view.innerHTML = `<div class="page narrow"><header class="page-h"><div><p class="eyebrow">Ayarlar</p><h1>Ayarlar</h1></div></header>
    <div class="card pad set"><h3>Sürüm</h3><div class="row wrap"><p class="mute" style="margin:0">MathPad ${upd.VERSION} · ${{ desktop: 'Windows', android: 'Android', web: 'Web' }[upd.platform()]}</p><button class="btn" data-upcheck>${icon('rotate')} Güncellemeleri denetle</button></div></div>
    <div class="card pad set"><h3>Günlük hedef</h3><p class="mute">Panelde her gün kaç soru çözmeyi hedeflediğin.</p>
      <div class="row"><input class="inp mono" type="number" min="1" max="500" value="${S.settings.goal}" data-goal style="max-width:120px"><span class="mute">soru / gün</span></div></div>
    <div class="card pad set"><h3>Görünüm ve ses</h3>
      <div class="set-row"><span>Hareket ve animasyonlar</span><div class="seg" data-pref="motion">${[['full', 'Tam'], ['reduced', 'Azaltılmış'], ['off', 'Kapalı']].map(([k, l]) => `<button data-v="${k}" class="${(S.settings.motion || 'full') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><span>Tema</span><div class="seg" data-theme-pick>${THEMES.map(([k, l]) => `<button data-v="${k}" class="${(S.settings.theme || 'space') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row set-planets">
        <div class="pl-set-head">
          <div><span>Gezegen teması</span><small class="mute pl-tagline" data-planet-tag>${esc(pTheme.tagline)}</small></div>
          <a class="link small pl-explore" href="#/evren">${solarIcon()} Güneş Sistemi'nde keşfet</a>
        </div>
        <div class="planet-strip" data-planet-pick role="group" aria-label="Gezegen teması">${PLANET_THEMES.map(p => `<button type="button" class="planet-chip ${curP === p.id ? 'on' : ''}" data-p="${p.id}" style="--pc:${p.accent}" aria-pressed="${curP === p.id}"><span class="pl-orb pl-orb-${p.id}" aria-hidden="true"></span><span class="pl-chip-name">${esc(p.name)}</span></button>`).join('')}</div>
        <small class="mute pl-mode-note">Kağıt ve Gece Gözlem temalarında yalnızca vurgu rengi uygulanır.</small>
      </div>
      <div class="set-row"><span>Vurgu rengi <small class="mute">(halkalar, ilerleme, ışıklar)</small></span><div class="pick" data-accent><button type="button" class="pick-c pick-planet ${!customAcc ? 'on' : ''}" style="--cc:${pTheme.accent}" data-v="planet" title="Gezegen rengi (${esc(pTheme.name)})" aria-label="Gezegen rengi"><span></span></button>${ACCENTS.map(a => `<button type="button" class="pick-c ${customAcc && S.settings.accent === a ? 'on' : ''}" style="--cc:${a}" data-v="${a}" aria-label="Vurgu ${a}"><span></span></button>`).join('')}</div></div>
      <div class="set-row"><span>Efekt sesleri <small class="mute">(çözüldü, hedef)</small></span><div class="seg" data-pref="sound">${[['off', 'Kapalı'], ['on', 'Açık']].map(([k, l]) => `<button data-v="${k}" class="${(S.settings.sound || 'off') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>
    <div class="card pad set" data-gd></div>
    <div class="card pad set" data-ai></div>
    ${window.desktop ? `<div class="card pad set"><h3>Masaüstü uygulaması</h3><p class="mute" data-ver>MathPad</p>
      <div class="row wrap"><button class="btn" data-datadir>${icon('book')} Veri klasörünü aç</button></div></div>`
    : `<div class="card pad set"><h3>Uygulama olarak yükle</h3>
      ${standalone ? '<p>Zaten uygulama olarak açıksın ✦</p>' : installEvt ? `<p class="mute">Masaüstüne / ana ekrana ekle, internet olmadan da çalışsın.</p><button class="btn primary" data-act="install">${icon('install')} Yükle</button>`
      : ios ? '<p class="mute">iPad/iPhone: Safari\'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>.</p>' : '<p class="mute">Tarayıcının adres çubuğundaki <b>yükle</b> simgesine bas (Chrome/Edge). Android\'de menü → <b>Uygulamayı yükle</b>.</p>'}
      ${upd.platform() === 'web' ? '<p class="mute small">Android telefon ve tablet için uygulama: <a href="indir/">MathPad\'i indir</a></p>' : ''}</div>`}
    <div class="card pad set"><h3>Yedekleme</h3>
      ${window.desktop ? `<p class="mute"><b>Otomatik yedek açık:</b> MathPad her gün bir yedeği <b>Belgeler\\MathPad\\Yedekler</b> klasörüne kaydeder, son 7 günü saklar.${S.lastAutoBackup ? ` Son otomatik yedek: ${esc(S.lastAutoBackup)}.` : ''}</p>`
      : `<p class="mute">Verilerin sadece bu cihazda durur. Ara ara yedek al. ${S.lastBackup ? `Son yedeğin: ${daysSince(S.lastBackup) ? daysSince(S.lastBackup) + ' gün önce' : 'bugün'}.` : 'Henüz hiç yedek almadın.'}</p>`}
      <div class="row wrap"><button class="btn" data-backup>${icon('download')} Şimdi yedek al</button><label class="btn">${icon('upload')} Yedeği / ders dosyasını aç<input type="file" accept=".mathpad,.json,application/json" hidden data-restore></label>${window.desktop ? `<button class="btn ghost" data-backups>${icon('book')} Yedek klasörü</button>` : ''}</div>
      <p class="mute small">Tek bir dersi arkadaşınla paylaşmak için: ders sayfası → ⋯ → <b>Bu dersi paylaş</b>.</p></div>
    <div class="card pad set" data-storage><h3>Depolama</h3><p class="mute">Hesaplanıyor…</p></div>
    <div class="card pad set" data-trash></div>
    <div class="card pad set"><h3>Kısayollar (tahta)</h3><div class="kbd-grid small">
      <span><kbd>P</kbd> kalem</span><span><kbd>H</kbd> fosforlu</span><span><kbd>E</kbd> silgi</span><span><kbd>V</kbd> seç/taşı</span><span><kbd>T</kbd> yazı</span><span><kbd>L</kbd> çizgi</span><span><kbd>A</kbd> ok</span><span><kbd>R</kbd> dikdörtgen</span><span><kbd>O</kbd> elips</span>
      <span><kbd>Ctrl Z</kbd> geri al</span><span><kbd>Ctrl Y</kbd> yinele</span><span><kbd>Ctrl V</kbd> resim yapıştır</span><span><kbd>Boşluk</kbd>+sürükle kaydır</span><span><kbd>Ctrl</kbd>+tekerlek yakınlaştır</span><span><kbd>Del</kbd> seçileni sil</span></div>
      <p class="mute small">Tablette: kalemle yaz, parmakla kaydır; iki parmakla yakınlaştır.</p></div>
    <div class="card pad set danger-zone"><h3>Tüm verileri sil</h3><p class="mute">Bütün dersler, sorular ve istatistikler silinir. Geri alınamaz.</p><button class="btn danger" data-wipe>${icon('trash')} Her şeyi sil</button></div>
    ${window.desktop ? `<div class="card pad set danger-zone uninstall-card" id="kaldir"><h3>${icon('trash')} MathPad'i bilgisayardan kaldır</h3>
      <ol class="mute steps"><li>İstersen önce <button type="button" class="link" data-prebackup>yedek al</button>.</li><li>Aşağıdaki düğmeye bas; MathPad kapanır ve kaldırma penceresi açılır.</li><li>Verilerini de silmek isteyip istemediğin sorulur. <b>Hayır</b> dersen tekrar kurduğunda kaldığın yerden devam edersin.</li></ol>
      <button class="btn danger" data-uninstall>${icon('trash')} MathPad'i kaldır</button></div>` : ''}
    <p class="mute small pl-credit">Dokular: <a class="link" href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope (CC BY 4.0)</a></p></div>`;
  $('[data-goal]').onchange = e => { S.settings.goal = Math.max(1, +e.target.value || 10); persist(); toast('Hedef kaydedildi'); };
  $('[data-backup]').onclick = async () => { await backupNow(); toast('Yedek indirildi ✦'); };
  $('[data-backups]')?.addEventListener('click', () => desktop.openBackups());
  renderTrash($('[data-trash]'));
  keyCard($('[data-ai]'));
  gdCard($('[data-gd]'));
  const syncPlanetUI = () => {
    const pid = currentPlanet(), pt = planetThemeOf(pid), isCustom = hasCustomAccent(pid);
    $$('[data-planet-pick] [data-p]').forEach(b => {
      const on = b.dataset.p === pid;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const tag = $('[data-planet-tag]');
    if (tag) tag.textContent = pt.tagline;
    const pBtn = $('[data-accent] [data-v="planet"]');
    if (pBtn) {
      pBtn.style.setProperty('--cc', pt.accent);
      pBtn.title = `Gezegen rengi (${pt.name})`;
    }
    $$('[data-accent] button').forEach(b => {
      b.classList.toggle('on', b.dataset.v === 'planet' ? !isCustom : (isCustom && S.settings.accent === b.dataset.v));
    });
  };
  const strip = $('[data-planet-pick]'), activeChip = strip?.querySelector('.on');
  if (strip && activeChip && strip.scrollWidth > strip.clientWidth + 4) {
    const sr = strip.getBoundingClientRect(), ar = activeChip.getBoundingClientRect();
    strip.scrollLeft = Math.max(0, strip.scrollLeft + (ar.left - sr.left) - (strip.clientWidth - ar.width) / 2);
  }
  $('[data-planet-pick]').onclick = e => {
    const p = e.target.closest('[data-p]')?.dataset.p; if (!p) return;
    setPlanetTheme(p);
    syncPlanetUI();
  };
  const onPlanetEvt = () => strip?.isConnected ? syncPlanetUI() : removeEventListener('mp-planet', onPlanetEvt); // drops itself after leaving Settings
  addEventListener('mp-planet', onPlanetEvt);
  $('[data-theme-pick]').onclick = e => {
    const v = e.target.closest('[data-v]')?.dataset.v; if (!v || v === (S.settings.theme || 'space')) return;
    $$('[data-theme-pick] button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    fx.scan(() => { S.settings.theme = v; persist(); applyPrefs(); });
  };
  $('[data-accent]').onclick = e => {
    const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
    const pid = currentPlanet();
    if (v === 'planet') {
      S.settings.customAccentFor = null;
      delete S.settings.accent;
    } else {
      S.settings.planet = pid;
      S.settings.accent = v;
      S.settings.customAccentFor = pid;
    }
    persist(); applyPrefs(); syncPlanetUI();
  };
  renderStorage($('[data-storage]'), est, persisted);
  $('[data-restore]').onchange = async e => { const f = e.target.files[0]; if (f) restoreBackup(f.name, await f.text()); };
  $$('[data-pref]').forEach(seg => seg.onclick = e => {
    const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
    S.settings[seg.dataset.pref] = v; persist(); applyPrefs();
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (seg.dataset.pref === 'sound' && v === 'on') fx.sound('solve');
  });
  $('[data-upcheck]').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await upd.check(); toast(r.msg, r.action); } catch (err) { toast(err.message || 'Denetlenemedi, internetini kontrol et'); }
    b.disabled = false;
  };
  if (window.desktop) {
    desktop.info().then(i => $('[data-ver]').textContent = `Sürüm ${i.version} · Veriler: ${i.dataDir} · Güncellemeler otomatik iner`);
    $('[data-datadir]').onclick = () => desktop.openDataDir();
    $('[data-prebackup]').onclick = () => $('[data-backup]').click();
    $('[data-uninstall]').onclick = async () => {
      if (!await confirmBox('MathPad kaldırılsın mı?', 'MathPad kapanacak ve kaldırma penceresi açılacak. Verilerini silmek isteyip istemediğin orada ayrıca sorulur.', 'Evet, kaldır')) return;
      await db.flush();
      if (!await desktop.uninstall()) toast('Kaldırıcı bulunamadı. Windows Ayarlar → Uygulamalar → MathPad → Kaldır yolunu kullanabilirsin.');
    };
  }
  $('[data-wipe]').onclick = async () => {
    if (!await confirmBox('Her şey silinsin mi?', 'Tüm dersler, sorular, çizimler ve istatistikler kalıcı olarak silinecek.', 'Evet, sil')) return;
    await db.replaceAll([]); location.hash = '#/'; location.reload();
  };
  return () => removeEventListener('mp-planet', syncPlanetUI);
}

function notFound() { view.innerHTML = `<div class="page"><div class="empty card pad"><p>Bulunamadı.</p><a class="btn" href="#/">Panele dön</a></div></div>`; }

// ---------- problem / board ----------
async function problem(id) {
  const p = S.problems.find(p => p.id === id);
  if (!p) return notFound();
  const c = db.courseOf(p);
  const tools = [['select', 'select', 'Seç / taşı (V)'], ['pen', 'pen', 'Kalem (P)'], ['hl', 'marker', 'Fosforlu (H)'], ['eraser', 'eraser', 'Silgi (E)'], ['|'], ['text', 'text', 'Yazı (T)'], ['line', 'line', 'Çizgi (L)'], ['arrow', 'arrow', 'Ok (A)'], ['rect', 'rect', 'Dikdörtgen (R)'], ['ellipse', 'ellipse', 'Elips (O)']];
  view.innerHTML = `<div class="pb">
    <header class="pb-top">
      <a class="icon-btn" href="#/c/${p.course}" aria-label="Derse dön">${icon('back')}</a>
      <div class="pb-title"><input class="title-in" value="${esc(p.title)}" aria-label="Soru başlığı" maxlength="120"><button class="crumb" data-meta>${glyph(c)}${esc(c?.name || '')}${p.topic ? ' · ' + esc(p.topic) : ''} ${icon('edit')}</button></div>
      <span class="pb-time mono" title="Bu soruya harcanan süre (5 dk hareketsizlikte durur)">${icon('clock')}<span data-t>${dur(p.secs)}</span></span>
      <div class="seg status" data-status>${Object.entries(STATUS).map(([k, l]) => `<button data-s="${k}" class="${p.status === k ? 'on' : ''} s-${k}" aria-label="${l}" aria-pressed="${p.status === k}">${k === 'solved' ? icon('check') : k === 'review' ? icon('review') : icon('pen')}<span>${l}</span></button>`).join('')}</div>
      <button class="icon-btn pb-more" data-more aria-label="Diğer işlemler" aria-expanded="false">${icon('dots')}</button>
      <div class="pb-acts">
        <button class="icon-btn" data-export title="PDF / PNG olarak kaydet">${icon('download')}<span>PDF / PNG kaydet</span></button>
        <button class="icon-btn" data-side title="Hesap makinesi & formüller">${icon('calc')}<span>Hesap ve formüller</span></button>
        <button class="icon-btn" data-focus title="Odak modu (F)" aria-label="Odak modu">${icon('star')}<span>Odak modu</span></button>
        <button class="icon-btn" data-del title="Soruyu sil">${icon('trash')}<span>Soruyu sil</span></button>
      </div>
    </header>
    <div class="pb-main">
      <div class="board-wrap">
        <canvas class="board" aria-label="Çizim tahtası"></canvas>
        <div class="pins" aria-label="Nova notları"></div>
        <div class="quick"><button class="tb" data-undo aria-label="Geri al">${icon('undo')}</button><button class="tb" data-redo aria-label="Yinele">${icon('redo')}</button></div>
        <div class="board-empty" hidden>${icon('pen')}<p>Kalemle ya da fareyle yazmaya başla</p><p class="mute small">Soru resmini <b>yapıştır (Ctrl+V)</b>, buraya <b>sürükle</b> ya da ${icon('image')} ile ekle · iki parmakla kaydır/yakınlaştır</p></div>
        <div class="toolbar" role="toolbar">
          ${tools.map(([k, ic, l]) => k === '|' ? '<button class="tb tb-style" data-style aria-label="Renk ve kalınlık" aria-expanded="false"><i></i></button><span class="sep"></span>' : `<button class="tb" data-tool="${k}" title="${l}" aria-label="${l}">${icon(ic)}</button>`).join('')}
          <button class="tb" data-img title="Resim / PDF ekle" aria-label="Resim veya PDF ekle">${icon('image')}</button>
          <button class="tb" data-symbols title="Devre sembolleri" aria-label="Devre sembolleri" aria-expanded="false">${icon('resistor')}</button>
          <button class="tb tb-toggle ${pref('snap') === '0' ? '' : 'on-soft'}" data-snap title="Şekil düzeltme: çizgiyi bitirince kalemi bir an beklet" aria-label="Şekil düzeltme" aria-pressed="${pref('snap') !== '0'}">${icon('sparkle')}</button>
          <span class="tb-styles"><span class="sep"></span>
          ${COLORS.map((col, i) => `<button class="sw ${i ? '' : 'on'}" data-color="${col}" style="--c:${col}" aria-label="Renk ${i + 1}"></button>`).join('')}
          <span class="sep"></span>
          ${[2, 3, 6].map(w => `<button class="tb wd ${w === 3 ? 'on' : ''}" data-w="${w}" title="Kalınlık" aria-label="Kalınlık ${w}"><i style="width:${w + 3}px;height:${w + 3}px"></i></button>`).join('')}
          </span><span class="sep"></span>
          <button class="tb" data-undo title="Geri al (Ctrl+Z)" aria-label="Geri al">${icon('undo')}</button>
          <button class="tb" data-redo title="Yinele (Ctrl+Y)" aria-label="Yinele">${icon('redo')}</button>
          <button class="tb" data-fit title="Hepsini göster" aria-label="Hepsini göster">${icon('fit')}</button>
          <button class="tb" data-rot title="Sembolü döndür" aria-label="Seçili sembolü döndür" disabled>${icon('rotate')}</button>
          <button class="tb" data-delsel title="Seçileni sil (Del)" aria-label="Seçileni sil" disabled>${icon('trash')}</button>
        </div>
        <input type="file" accept="image/*,application/pdf" multiple hidden data-file>
        <div class="sym-pop" hidden role="dialog" aria-label="Devre sembolleri"><p class="mute small">Dokun → tahtaya eklenir. Taşı, köşeden büyüt, ${icon('rotate')} ile döndür. Bağlantıları çizgi aracıyla çiz.</p>
          <div class="sym-grid">${Object.entries(SYMBOLS).map(([k, v]) => `<button type="button" class="sym-btn" data-sym="${k}" title="${esc(v.label)}">${symbolSvg(k)}<span>${esc(v.label)}</span></button>`).join('')}</div></div>
      </div>
      <aside class="pb-side" ${pref('side') === '1' && matchMedia('(min-width: 1101px)').matches ? '' : 'hidden'}>
        <div class="row"><div class="seg"><button data-tab="nova">✦ Nova</button><button class="on" data-tab="calc">${icon('calc')} Hesap</button><button data-tab="fx">${icon('sigma')} Formül</button></div>
        <button class="icon-btn" data-close-side aria-label="Paneli kapat" style="margin-left:auto">${icon('x')}</button></div>
        <div data-pane="nova" hidden></div><div data-pane="calc"></div><div data-pane="fx" class="note" hidden></div>
      </aside>
    </div></div>`;

  const els = (await db.get('b:' + id)) || [];
  if (location.hash !== '#/p/' + id) return; // navigated away while loading
  const wrap = $('.board-wrap'), emptyHint = $('.board-empty');
  let saveT = null;
  async function save() {
    clearTimeout(saveT); saveT = null;
    await db.set('b:' + id, board.els);
    const t = await board.thumb();
    await db.set('t:' + id, t ? t.toDataURL('image/jpeg', .7) : null);
    p.updated = Date.now(); persist(); sync.markDirty(id);
  }
  const board = createBoard($('canvas.board'), els, {
    onChange(list) { emptyHint.hidden = list.length > 0; clearTimeout(saveT); saveT = setTimeout(save, 800); },
    onTool: t => { $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); fx.slideIndicator($('.toolbar'), $(`[data-tool="${t}"]`)); },
    onSelect: el => { $('[data-delsel]').disabled = !el; $('[data-rot]').disabled = el?.type !== 'sym'; },
    onSnap: type => toast(`Şekil düzeltildi: ${SHAPE_NAMES[type] || type} ✦`),
    onTap: n => { navigator.vibrate?.(12); toast(n === 2 ? 'Geri alındı' : 'Yinelendi'); },
  });
  // undo/redo live both in the toolbar and in the floating phone pair
  $$('[data-undo]').forEach(b => b.onclick = e => { e.stopPropagation(); board.undo(); });
  $$('[data-redo]').forEach(b => b.onclick = e => { e.stopPropagation(); board.redo(); });
  // phone header: the dots button opens the less used actions
  const top = $('.pb-top'), more = $('[data-more]'), side = $('.pb-side'), symPop = $('.sym-pop'), title = $('.title-in'), cv = $('canvas.board'), tbar = $('.toolbar');
  // phone immersive drawing: fade/slide board chrome away during single-pointer pen/finger drawing strokes
  const DRAW_TOOLS = new Set(['pen', 'hl', 'eraser', 'line', 'arrow', 'rect', 'ellipse']);
  const activePtrs = new Map();
  let multiTouch = false, penSeen = false, hideDelay = 0, revealTimer = 0, edgeTap = null;
  const isImmersive = () => document.body.classList.contains('board-immersive');
  const chromeBlocked = () =>
    !phoneQ.matches ||
    !!document.querySelector('dialog[open]') ||
    !!wrap.querySelector('.board-text') ||
    !symPop.hidden ||
    !side.hidden ||
    top.classList.contains('more-open') ||
    document.activeElement === title;
  const showChrome = () => {
    clearTimeout(hideDelay); hideDelay = 0;
    clearTimeout(revealTimer); revealTimer = 0;
    document.body.classList.remove('board-immersive');
  };
  const hideChrome = () => {
    clearTimeout(revealTimer); revealTimer = 0;
    if (chromeBlocked() || multiTouch || activePtrs.size !== 1) return;
    document.body.classList.add('board-immersive');
  };
  const inEdgeZone = clientY => {
    const r = wrap.getBoundingClientRect(), ry = clientY - r.top;
    const topZone = Math.max(60, top.offsetHeight + 12);
    const botZone = Math.max(84, (parseFloat(getComputedStyle(tbar).bottom) || 12) + tbar.offsetHeight + 16);
    return ry <= topZone || ry >= r.height - botZone;
  };
  const onBoardDown = e => {
    if (!phoneQ.matches) return;
    activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType });
    if (e.pointerType === 'pen') penSeen = true;
    // Never hide chrome during two-finger pinch/pan
    if (activePtrs.size >= 2) {
      multiTouch = true;
      edgeTap = null;
      showChrome();
      return;
    }
    // Track a tap near the top or bottom edge while chrome is hidden for instant reveal
    if (isImmersive() && inEdgeZone(e.clientY)) {
      edgeTap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    } else {
      edgeTap = null;
    }
    if (e.pointerType !== 'pen' && e.pointerType !== 'touch') return;
    if (chromeBlocked()) { showChrome(); return; }
    // Once a stylus is used, single-finger touch pans instead of drawing
    if (penSeen && e.pointerType === 'touch') return;
    const isDrawing = DRAW_TOOLS.has(board.tool) || (e.pointerType === 'pen' && !!(e.buttons & 34));
    if (!isDrawing) return;
    clearTimeout(revealTimer); revealTimer = 0;
    if (isImmersive()) return;
    if (e.pointerType === 'pen') hideChrome();
    else {
      clearTimeout(hideDelay);
      hideDelay = setTimeout(() => { hideDelay = 0; hideChrome(); }, 90);
    }
  };
  const onBoardMove = e => {
    const p0 = activePtrs.get(e.pointerId);
    if (!p0) return;
    const dist = Math.hypot(e.clientX - p0.x, e.clientY - p0.y);
    if (edgeTap && edgeTap.id === e.pointerId && dist > 14) edgeTap = null;
    if (hideDelay && activePtrs.size === 1 && !multiTouch && dist > 8) {
      clearTimeout(hideDelay); hideDelay = 0;
      hideChrome();
    }
  };
  const onBoardUp = e => {
    activePtrs.delete(e.pointerId);
    if (edgeTap && edgeTap.id === e.pointerId) {
      const tap = edgeTap; edgeTap = null;
      if (performance.now() - tap.t < 400 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= 14) {
        showChrome();
        if (!activePtrs.size) multiTouch = false;
        return;
      }
    }
    if (!activePtrs.size) {
      clearTimeout(hideDelay); hideDelay = 0;
      multiTouch = false;
      if (e.type === 'pointercancel') { showChrome(); return; }
      if (isImmersive()) {
        clearTimeout(revealTimer);
        revealTimer = setTimeout(showChrome, 700);
      }
    }
  };
  const onBoardFocusIn = e => {
    if (e.target.closest?.('.pb-top, .quick, .toolbar, .pb-side, .sym-pop, .board-text, dialog')) showChrome();
  };
  cv.addEventListener('pointerdown', onBoardDown, { passive: true });
  cv.addEventListener('pointermove', onBoardMove, { passive: true });
  cv.addEventListener('pointerup', onBoardUp, { passive: true });
  cv.addEventListener('pointercancel', onBoardUp, { passive: true });
  document.addEventListener('focusin', onBoardFocusIn);

  const moreOpen = on => { top.classList.toggle('more-open', on); more.setAttribute('aria-expanded', on); if (on) showChrome(); };
  more.onclick = e => { e.stopPropagation(); moreOpen(!top.classList.contains('more-open')); };
  $('.pb-acts').addEventListener('click', () => moreOpen(false));
  $('.pb').addEventListener('pointerdown', e => { if (!e.target.closest('.pb-acts, [data-more]')) moreOpen(false); });
  // tablets/phones: keep the screen on while working on a problem
  let wake = null;
  const keepAwake = () => { if (document.visibilityState === 'visible' && matchMedia('(pointer: coarse)').matches) navigator.wakeLock?.request('screen').then(w => wake = w).catch(() => { }); };
  keepAwake(); document.addEventListener('visibilitychange', keepAwake);
  emptyHint.hidden = els.length > 0;
  board.setTool(pref('tool') || 'pen');
  board.setSnap(pref('snap') !== '0');
  $('.sym-pop').onclick = e => { const k = e.target.closest('[data-sym]')?.dataset.sym; if (k) { board.addSymbol(k); $('.sym-pop').hidden = true; $('[data-symbols]').setAttribute('aria-expanded', 'false'); } };
  if (els.length) requestAnimationFrame(() => board.fit());

  async function addFiles(files) {
    const srcs = [];
    for (const f of files) { try { srcs.push(...await fileToImages(f)); } catch (err) { toast('Eklenemedi: ' + err.message); } }
    if (srcs.length) { await board.addImages(srcs); emptyHint.hidden = true; }
    return srcs;
  }
  if (pendingFiles) {
    const fresh = pendingFiles; pendingFiles = null;
    addFiles(fresh).then(srcs => autoTag(srcs[0]));
  }
  // Nova reads the new question photo and fills in course/topic/title (only fields still at their defaults)
  async function autoTag(src) {
    if (!src || !getKey() || p.topic || !/^Soru \d+$/.test(p.title)) return;
    const r = await classify(src.split(',')[1], S.courses.map(c => c.name)); if (!r) return;
    const before = { course: p.course, topic: p.topic, title: p.title };
    const c = S.courses.find(x => x.name.toLocaleLowerCase('tr') === r.course.toLocaleLowerCase('tr'));
    Object.assign(p, { course: c?.id || p.course, topic: r.topic || p.topic, title: r.title || p.title }); persist();
    if (location.hash !== '#/p/' + p.id) return;
    $('.title-in').value = p.title; $('[data-meta]').innerHTML = `${glyph(db.courseOf(p))}${esc(db.courseOf(p)?.name || '')}${p.topic ? ' · ' + esc(p.topic) : ''} ${icon('edit')}`; nav();
    toast(`Nova etiketledi: ${db.courseOf(p)?.name} · ${p.topic}`, { label: 'Geri al', run: () => { Object.assign(p, before); persist(); route(); } });
  }

  // pinned Nova notes, shown as cards on the board
  const pinsEl = $('.pins');
  const renderPins = () => {
    pinsEl.innerHTML = (p.pins || []).map((pin, i) => `<article class="pin ${pin.min ? 'min' : ''}" data-i="${i}"><header><span>📌 Nova notu</span><button class="icon-btn sm-x" data-pmin aria-label="Küçült/büyüt">${icon(pin.min ? 'plus' : 'back')}</button><button class="icon-btn sm-x" data-pdel aria-label="Notu kaldır">${icon('x')}</button></header><div class="note">${T.renderNote(pin.text)}</div></article>`).join('');
  };
  pinsEl.onclick = e => {
    const i = +e.target.closest('.pin')?.dataset.i; if (Number.isNaN(i)) return;
    if (e.target.closest('[data-pdel]')) p.pins.splice(i, 1);
    else if (e.target.closest('[data-pmin]')) p.pins[i].min = !p.pins[i].min;
    else return;
    persist(); renderPins();
  };
  renderPins();

  // toolbar
  const styling = on => { tbar.classList.toggle('styling', on); $('[data-style]').setAttribute('aria-expanded', on); if (!on) fx.slideIndicator(tbar, $('[data-tool].on')); };
  tbar.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (tbar.classList.contains('styling') && (b.dataset.color || b.dataset.w)) setTimeout(() => styling(false), 180); // phone: back to the tools after a pick
    if ('style' in b.dataset) styling(!tbar.classList.contains('styling'));
    else if (b.dataset.tool) { board.setTool(b.dataset.tool); pref('tool', b.dataset.tool); }
    else if (b.dataset.color) { board.setColor(b.dataset.color); wrap.style.setProperty('--pen', b.dataset.color); $$('.sw').forEach(s => s.classList.toggle('on', s === b)); if (['eraser', 'select'].includes(board.tool)) board.setTool('pen'); }
    else if (b.dataset.w) { board.setWidth(+b.dataset.w); $$('.wd').forEach(s => s.classList.toggle('on', s === b)); }
    else if ('fit' in b.dataset) board.fit();
    else if ('delsel' in b.dataset) board.deleteSel();
    else if ('img' in b.dataset) $('[data-file]').click();
    else if ('rot' in b.dataset) board.rotateSel();
    else if ('symbols' in b.dataset) { const pop = $('.sym-pop'); pop.hidden = !pop.hidden; b.setAttribute('aria-expanded', !pop.hidden); if (!pop.hidden) showChrome(); }
    else if ('snap' in b.dataset) { const on = !b.classList.contains('on-soft'); board.setSnap(on); pref('snap', on ? '1' : '0'); b.classList.toggle('on-soft', on); b.setAttribute('aria-pressed', on); toast(on ? 'Şekil düzeltme açık: çizimi bitirince kalemi bir an beklet' : 'Şekil düzeltme kapalı'); }
  };
  $('[data-file]').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
  const onPaste = e => {
    if (e.target.closest?.('input, textarea')) return;
    const files = [...e.clipboardData.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); addFiles(files); }
  };
  document.addEventListener('paste', onPaste);
  wrap.ondragover = e => { e.preventDefault(); wrap.classList.add('dragging'); };
  wrap.ondragleave = () => wrap.classList.remove('dragging');
  wrap.ondrop = e => { e.preventDefault(); wrap.classList.remove('dragging'); addFiles([...e.dataTransfer.files]); };

  // header
  title.onchange = () => { p.title = title.value.trim() || p.title; title.value = p.title; p.updated = Date.now(); persist(); };
  title.onkeydown = e => e.key === 'Enter' && title.blur();
  $('[data-status]').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const s = b.dataset.s, was = p.status;
    p.status = s; p.solvedAt = s === 'solved' ? (was === 'solved' ? p.solvedAt : Date.now()) : null; p.updated = Date.now();
    persist(); $$('[data-s]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    if (s === 'solved' && was !== 'solved') { celebrate(b); novaReact('celebrate'); }
    if (s === 'review' && was !== 'review') { fx.orbitSwirl(b); toast('Tekrar listesine eklendi'); novaReact('review'); }
    nav();
  };
  $('[data-meta]').onclick = async () => {
    const r = await modal('Ders ve konu', `<label>Ders<select class="inp" name="course">${S.courses.map(x => `<option value="${x.id}" ${x.id === p.course ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Konu<input class="inp" name="topic" value="${esc(p.topic)}" list="dl-t2" autocomplete="off"><datalist id="dl-t2">${db.topicsOf().map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>`);
    if (!r) return;
    p.course = r.course; p.topic = r.topic.trim(); p.updated = Date.now(); persist();
    $('[data-meta]').innerHTML = `${esc(db.courseOf(p)?.name || '')}${p.topic ? ' · ' + esc(p.topic) : ''} ${icon('edit')}`;
    $('.pb-top a').href = '#/c/' + p.course; nav();
  };
  $('[data-del]').onclick = async () => {
    if (saveT) await save(); // keep the latest drawing in the trash copy
    fx.stardustBurst($('.pb-top')?.getBoundingClientRect());
    const back = p.course, e = db.removeProblem(id);
    location.hash = '#/c/' + back;
    toast(`"${p.title}" çöp kutusuna taşındı`, { label: 'Geri al', run: () => { db.restoreTrash(e); fx.markRestored(id); fx.stardustBurst(null, { reverse: true }); location.hash = '#/p/' + id; } });
  };
  $('[data-export]').onclick = async () => {
    const r = await modal('Dışa aktar', `<label>Biçim<select class="inp" name="fmt"><option value="pdf">PDF (A4, çok sayfa)</option><option value="png">PNG resim</option></select></label>
      <label>Zemin<select class="inp" name="bg"><option value="light">Beyaz (yazdırmaya uygun)</option><option value="dark">Siyah (ekrandaki gibi)</option></select></label>`, { ok: 'İndir' });
    if (!r) return;
    const dark = r.bg === 'dark';
    const cv = await board.export({ width: 1240, header: [p.title, `${c?.name || ''}${p.topic ? ' · ' + p.topic : ''} · ${new Date().toLocaleDateString('tr')}`], ...(dark && { bg: '#0b0b0e', map: null }) });
    if (!cv) return toast('Tahta boş');
    const name = p.title.replace(/[\\/:*?"<>|]/g, '_');
    if (r.fmt === 'png') return cv.toBlob(b => download(name + '.png', b));
    toast('PDF hazırlanıyor…');
    try {
      await loadScript(JSPDF);
      const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' }), pw = 595.28, ph = 841.89, slice = Math.floor(cv.width * ph / pw);
      for (let y = 0, i = 0; y < cv.height; y += slice, i++) {
        const part = document.createElement('canvas'); part.width = cv.width; part.height = Math.min(slice, cv.height - y);
        const pc = part.getContext('2d'); pc.fillStyle = dark ? '#0b0b0e' : '#fff'; pc.fillRect(0, 0, part.width, part.height); pc.drawImage(cv, 0, -y);
        if (i) doc.addPage();
        doc.addImage(part.toDataURL('image/jpeg', .9), 'JPEG', 0, 0, pw, part.height * pw / cv.width);
      }
      download(name + '.pdf', doc.output('blob'));
    } catch (err) { toast('PDF oluşturulamadı: ' + err.message); }
  };

  // side panel (calculator + formulas)
  let calcMounted = false;
  const mountSide = () => { if (!calcMounted && !side.hidden) { T.mountCalc($('[data-pane=calc]')); $('[data-pane=fx]').innerHTML = T.renderNote(S.notes[p.course]); calcMounted = true; } };
  mountSide();
  $('[data-side]').onclick = () => { side.hidden = !side.hidden; pref('side', side.hidden ? '0' : '1'); mountSide(); if (!side.hidden) { showChrome(); refreshFades(side, true); fx.syncSegments(side, true); } };
  $('[data-close-side]').onclick = () => { side.hidden = true; pref('side', '0'); };
  let stopTutor = null;
  const tab = t => {
    side.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    side.querySelectorAll('[data-pane]').forEach(x => x.hidden = x.dataset.pane !== t);
    fx.syncSegments(side);
    if (t === 'nova' && !stopTutor) stopTutor = mountTutor($('[data-pane=nova]'), {
      problem: p, courseName: db.courseOf(p)?.name,
      onPin: text => { (p.pins ??= []).push({ text, at: Date.now() }); persist(); renderPins(); toast('Not tahtaya iğnelendi 📌'); },
      onNewProblem: text => {
        const title = text.replace(/\$[^$]*\$|[#*>`_]/g, '').trim().split('\n')[0].slice(0, 48) || 'Nova sorusu';
        const q = createProblem(p.course, { title, topic: p.topic });
        q.pins = [{ text, at: Date.now() }]; persist(); toast('Yeni soru oluşturuldu ✦');
      },
      getImage: async () => (await board.export({ width: 1100 }))?.toDataURL('image/jpeg', .85) ?? null,
    });
  };
  side.querySelector('.seg').onclick = e => { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) tab(t); };
  const openNova = () => { side.hidden = false; showChrome(); mountSide(); tab('nova'); refreshFades(side, true); $('[data-pane=nova] textarea')?.focus(); };
  const stopRoam = mountRoamer(wrap, openNova); // Nova floats on a tether from her ship across the top of the board

  // focus mode: everything but the board slips away; hyperspace jump in and out
  const focus = on => {
    if (on === document.body.classList.contains('focus')) return;
    fx.hyperspace(!on); document.body.classList.toggle('focus', on); fx.ambience(on);
    if (on) toast('Odak modu ✦ Çıkmak için Esc', null);
  };
  $('[data-focus]').onclick = () => focus(true);
  const focusKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'Escape') focus(false);
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) focus(!document.body.classList.contains('focus'));
  };
  addEventListener('keydown', focusKey);
  // soft light under the pen, in the pen's colour
  const glow = document.createElement('i'); glow.className = 'pen-glow'; wrap.append(glow);
  wrap.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = wrap.getBoundingClientRect(); glow.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    glow.classList.toggle('on', ['pen', 'hl'].includes(board.tool));
  });
  wrap.addEventListener('pointerleave', () => glow.classList.remove('on'));

  // time tracking: counts while page visible and user active in last 5 min
  let last = Date.now();
  const act = () => last = Date.now();
  view.addEventListener('pointerdown', act); addEventListener('keydown', act);
  const tEl = $('[data-t]');
  const iv = setInterval(() => {
    if (document.hidden || Date.now() - last > 5 * 60e3) return;
    p.secs = (p.secs || 0) + 1; const k = dayKey(); S.time[k] = (S.time[k] || 0) + 1;
    tEl.textContent = dur(p.secs);
    if (p.secs % 30 === 0) persist();
  }, 1000);

  return () => {
    clearInterval(iv); board.destroy(); persist(); stopTutor?.(); stopRoam();
    showChrome();
    cv.removeEventListener('pointerdown', onBoardDown); cv.removeEventListener('pointermove', onBoardMove);
    cv.removeEventListener('pointerup', onBoardUp); cv.removeEventListener('pointercancel', onBoardUp);
    document.removeEventListener('focusin', onBoardFocusIn);
    removeEventListener('keydown', focusKey); document.body.classList.remove('focus'); fx.ambience(false);
    document.removeEventListener('paste', onPaste); document.removeEventListener('visibilitychange', keepAwake); wake?.release().catch(() => { });
    view.removeEventListener('pointerdown', act); removeEventListener('keydown', act);
    if (saveT) save();
  };
}

// ---------- phone scroll-aware chrome & horizontal tab fades ----------
const slimBar = document.createElement('div');
slimBar.id = 'slim-bar';
slimBar.className = 'slim-bar';
slimBar.setAttribute('aria-hidden', 'true');
slimBar.innerHTML = `<button type="button" class="slim-btn" tabindex="-1" aria-label="Yukarı çık"><i class="slim-dot" aria-hidden="true"></i><span class="slim-title"></span><span class="slim-up" aria-hidden="true">↑</span></button>`;
document.body.append(slimBar);
const slimBtn = $('.slim-btn', slimBar), slimTitle = $('.slim-title', slimBar);

let scrollRaf = 0, lastScrollY = 0, scrollDirAcc = 0, scrollLastDir = 0;
function setSlim(on) {
  const was = document.body.classList.contains('head-slim');
  if (was === on) return;
  document.body.classList.toggle('head-slim', on);
  slimBar.setAttribute('aria-hidden', String(!on));
  slimBtn.tabIndex = on ? 0 : -1;
}
function setNavHidden(on) {
  document.body.classList.toggle('nav-hidden', on);
}
function resetScrollChrome() {
  lastScrollY = 0; scrollDirAcc = 0; scrollLastDir = 0;
  setSlim(false);
  setNavHidden(false);
  document.body.classList.remove('board-immersive');
}
function syncSlimBar() {
  const isFull = document.body.dataset.page === 'p' || document.body.dataset.page === 'evren';
  const h1 = !isFull && $('.page-h h1', view);
  if (!h1) {
    slimTitle.innerHTML = '';
    slimBtn.setAttribute('aria-label', 'Yukarı çık');
    setSlim(false);
    return;
  }
  slimTitle.innerHTML = h1.innerHTML;
  const txt = h1.textContent.trim();
  slimBtn.setAttribute('aria-label', txt ? `${txt} — yukarı çık` : 'Yukarı çık');
}
slimBtn.onclick = () => {
  setNavHidden(false);
  view.scrollTo({ top: 0, behavior: fx.full() ? 'smooth' : 'auto' });
};
function handleViewScroll() {
  scrollRaf = 0;
  if (!phoneQ.matches || document.body.dataset.page === 'p' || document.body.dataset.page === 'evren') return;
  const maxY = Math.max(0, view.scrollHeight - view.clientHeight);
  if (maxY < 48) { setSlim(false); setNavHidden(false); lastScrollY = 0; scrollDirAcc = 0; return; }
  const y = Math.max(0, Math.min(view.scrollTop, maxY));
  const dy = y - lastScrollY;
  lastScrollY = y;

  const ph = $('.page-h', view);
  const collapseAt = ph ? Math.max(40, Math.min(96, ph.offsetTop + ph.offsetHeight * 0.72)) : 56;
  const slimOn = document.body.classList.contains('head-slim');
  if (!slimOn && y > collapseAt + 6) setSlim(true);
  else if (slimOn && y < Math.max(16, collapseAt - 12)) setSlim(false);

  if (y <= 24) {
    scrollDirAcc = 0; scrollLastDir = 0;
    setNavHidden(false);
    return;
  }
  if (!dy) return;
  const dir = dy > 0 ? 1 : -1;
  if (dir !== scrollLastDir) { scrollLastDir = dir; scrollDirAcc = dy; }
  else scrollDirAcc += dy;

  if (dir === 1 && scrollDirAcc > 16 && y > 48) { setNavHidden(true); scrollDirAcc = 0; }
  else if (dir === -1 && scrollDirAcc < -12) { setNavHidden(false); scrollDirAcc = 0; }
}
view.addEventListener('scroll', () => {
  if (!scrollRaf) scrollRaf = requestAnimationFrame(handleViewScroll);
}, { passive: true });
// Keyboard focus must always reveal hidden scroll chrome
$('#nav').addEventListener('focusin', () => setNavHidden(false));
view.addEventListener('focusin', e => {
  if (e.target.closest?.('.page-h')) { setSlim(false); setNavHidden(false); }
});

// Soft edge fades + active-tab centering for horizontally scrollable tabs & segmented rows
const TAB_SEL = '.tabs, .seg:not(.status)';
function updateFade(el) {
  if (!phoneQ.matches) { el.classList.remove('can-left', 'can-right'); return; }
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 4) { el.classList.remove('can-left', 'can-right'); return; }
  el.classList.toggle('can-left', el.scrollLeft > 4);
  el.classList.toggle('can-right', el.scrollLeft < max - 4);
}
function refreshFades(root = view, centerActive = false) {
  $$(TAB_SEL, root).forEach(el => {
    if (centerActive && phoneQ.matches && el.scrollWidth > el.clientWidth + 4) {
      const on = el.querySelector('.on');
      if (on) {
        const er = el.getBoundingClientRect(), ar = on.getBoundingClientRect();
        el.scrollLeft = Math.max(0, el.scrollLeft + (ar.left - er.left) - (el.clientWidth - ar.width) / 2);
      }
    }
    updateFade(el);
  });
}
let fadeRaf = 0;
const fadeDirty = new Set();
view.addEventListener('scroll', e => {
  const t = e.target;
  if (t === view || !t?.matches?.(TAB_SEL)) return;
  fadeDirty.add(t);
  if (!fadeRaf) fadeRaf = requestAnimationFrame(() => {
    fadeRaf = 0;
    fadeDirty.forEach(updateFade);
    fadeDirty.clear();
  });
}, { capture: true, passive: true });
let resizeRaf = 0;
addEventListener('resize', () => {
  if (!resizeRaf) resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; refreshFades(view, false); });
}, { passive: true });
phoneQ.addEventListener('change', e => {
  if (!e.matches) resetScrollChrome();
  refreshFades(view, false);
});

// ---------- router & boot ----------
async function route() {
  const prev = cleanup; cleanup = null; await prev?.();
  const [a = '', b, c] = route_();
  const fn = { '': home, c: course, courses, p: problem, review, tools, sim, settings, evren: solar }[a] || notFound;
  await fx.transition(async () => {
    document.body.dataset.page = a || 'home';
    resetScrollChrome();
    view.onclick = null;
    nav();
    const r = await fn(b, c);
    if (typeof r === 'function') cleanup = r;
    if (a !== 'p') view.scrollTop = 0;
    syncSlimBar();
    refreshFades(view, true);
    requestAnimationFrame(() => refreshFades(view, false));
    fx.stagger(view); fx.countUp(view); fx.enhanceView(view);
  });
}
// Clicked problem card's thumbnail morphs into the board (View Transitions shared element).
document.addEventListener('click', e => {
  const t = e.target.closest('.pcard')?.querySelector('.thumb');
  if (t) t.style.viewTransitionName = 'board';
}, true);

function space() {
  const make = (n, max, alpha) => {
    const c = document.createElement('canvas'); c.width = c.height = 700;
    const x = c.getContext('2d'); x.fillStyle = '#fff';
    for (let i = 0; i < n; i++) { x.globalAlpha = Math.random() * alpha + .15; x.beginPath(); x.arc(Math.random() * 700, Math.random() * 700, Math.random() * max + .25, 0, 7); x.fill(); }
    return `url(${c.toDataURL()})`;
  };
  const el = $('#space');
  el.style.setProperty('--s1', make(170, .8, .45));
  el.style.setProperty('--s2', make(28, 1.4, .85));
  el.style.setProperty('--s3', make(16, 1.7, 1)); // twinkling layer
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a === 'new') newProblem();
  else if (a === 'add-course') addCourse();
  else if (a === 'install' && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; nav(); }); }
  else if (a === 'goal') location.hash = '#/settings';
  else if (a === 'update') desktop.installUpdate();
  else if (a === 'backup') backupNow().then(() => { toast('Yedek indirildi ✦'); route(); });
});
$('#pomo-pill').onclick = pomoToggle;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; nav(); });
addEventListener('hashchange', route);

if (window.desktop) {
  document.body.classList.add('desktop');
  document.body.insertAdjacentHTML('afterbegin', `<div class="titlebar">${logo()}<span>MATH<b>PAD</b></span></div>`);
  desktop.onOpenFile(f => restoreBackup(f.name, f.text));
  desktop.onUpdate(u => {
    update = u; nav();
    if (u.state === 'ready') toast(`MathPad ${u.version} hazır ✦`, { label: 'Yeniden başlat', run: () => desktop.installUpdate() });
  });
}

(async () => {
  space();
  const t0 = Date.now();
  document.body.insertAdjacentHTML('beforeend', `<div id="splash" aria-hidden="true"><svg class="splash-sky" viewBox="0 0 480 300" aria-hidden="true"><path class="sp-const" d="M36 226 L92 162 L152 184 L198 122 M282 126 L332 82 L386 112 L442 64 M110 74 L164 56 L214 82" pathLength="100"/><circle class="sp-st" cx="36" cy="226" r="2" style="--d:0"/><circle class="sp-st" cx="92" cy="162" r="2.4" style="--d:1"/><circle class="sp-st" cx="152" cy="184" r="1.8" style="--d:2"/><circle class="sp-st" cx="198" cy="122" r="2.2" style="--d:3"/><circle class="sp-st" cx="282" cy="126" r="2.2" style="--d:1"/><circle class="sp-st" cx="332" cy="82" r="2.6" style="--d:2"/><circle class="sp-st" cx="386" cy="112" r="1.9" style="--d:3"/><circle class="sp-st" cx="442" cy="64" r="2.3" style="--d:4"/><circle class="sp-st" cx="110" cy="74" r="1.8" style="--d:1"/><circle class="sp-st" cx="164" cy="56" r="2.1" style="--d:2"/><circle class="sp-st" cx="214" cy="82" r="1.7" style="--d:3"/></svg>${logo('xl')}<span>MATH<b>PAD</b></span></div>`);
  const hideSplash = () => { const s = $('#splash'); if (!s) return; s.classList.add('out'); setTimeout(() => s.remove(), 600); };
  try { await db.load(); applyPrefs(); }
  catch (err) { hideSplash(); view.innerHTML = `<div class="page"><div class="card pad"><h3>Depolama açılamadı</h3><p class="mute">${esc(err.message)}. Gizli pencere kullanıyorsan normal pencerede aç.</p></div></div>`; return; }
  if (!fx.full()) $('#splash')?.remove();
  route(); autoBackup();
  runSync();
  addEventListener('mp-changed', () => sync.later());
  addEventListener('mp-sync', () => { const f = $('.nav-foot'); if (f) nav(); });
  addEventListener('online', () => runSync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) runSync(); });
  setInterval(() => runSync(), 3 * 60e3);
  setTimeout(hideSplash, Math.max(0, 1100 - (Date.now() - t0))); // let the intro play once, never longer
  // the Android app ships its files inside the APK, so it needs no offline cache
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
