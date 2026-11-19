import * as db from './db.js';
import { S, persist, dayKey, uid } from './db.js';
import { createBoard, renderTo, COLORS } from './board.js';
import * as T from './tools.js';
import { $, $$, esc, modal, confirmBox, toast, icon, logo, download, loadScript } from './ui.js';
import * as fx from './fx.js';
import { astronaut, mountTutor, keyCard, mountRoamer, classify, coach, getKey } from './astro.js';
import { mountSky, galaxyCalendar, scopeChart } from './sky.js';
import { SYMBOLS, symbolSvg } from './symbols.js';
import { SHAPE_NAMES } from './shapes.js';
import * as badges from './badges.js';

const PDFJS = 'vendor/pdf.min.js', PDFJS_WORKER = 'vendor/pdf.worker.min.js', JSPDF = 'vendor/jspdf.umd.min.js';
const view = $('#view');
let cleanup = null, installEvt = null, pendingFiles = null, update = null; // update: { state: 'downloading'|'ready', version } from the desktop shell

// ---------- helpers ----------
const STATUS = { open: 'Açık', solved: 'Çözüldü', review: 'Tekrar' };
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
    <label class="filepick">${icon('image')}<span>Soru fotoğrafı veya PDF ekle <span class="mute">(isteğe bağlı)</span></span><input type="file" name="file" accept="image/*,application/pdf"></label>`, { ok: 'Oluştur' });
  if (!r) return;
  createProblem(r.course, r, r.file?.size ? [r.file] : null);
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
    const e = db.removeCourse(c);
    location.hash = '#/courses';
    toast(`"${c.name}" çöp kutusuna taşındı`, { label: 'Geri al', run: () => { db.restoreTrash(e); route(); nav(); toast('Geri alındı ✦'); } });
  };
  const r = await p;
  if (r?.name?.trim()) { c.name = r.name.trim(); c.icon = r.icon || c.icon; c.color = r.color || c.color; persist(); route(); }
}

function celebrate() {
  const n = solvedByDay()[dayKey()] || 0, goal = S.settings.goal;
  toast(n === goal ? `Günlük hedef tamam! ${n}/${goal} ✦` : `Çözüldü ✦  Bugün ${n}/${goal}`);
  if (n === goal) { fx.supernova(); fx.sound('goal'); } else { fx.shootingStar(); fx.sound('solve'); }
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
    if (r) { toast(db.restoreTrash(S.trash[+r.dataset.backI]) ? 'Geri alındı ✦' : 'Önce bir ders ekle'); nav(); renderTrash(el); }
    if (pg) {
      const e = S.trash[+pg.dataset.purgeI];
      if (!await confirmBox('Kalıcı olarak silinsin mi?', 'Bu öğe ve çizimleri tamamen silinecek. Geri alınamaz.')) return;
      await db.purgeTrash(x => x === e); renderTrash(el);
    }
    if (ev.target.closest('[data-empty]')) {
      if (!await confirmBox('Çöp kutusu boşaltılsın mı?', `${S.trash.length} öğe ve çizimleri kalıcı olarak silinecek. Geri alınamaz.`)) return;
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
    const gone = empty.map(p => db.removeProblem(p.id));
    nav(); renderStorage(el, est, persisted); renderTrash($('[data-trash]'));
    toast(`${gone.length} boş soru çöp kutusuna taşındı`, { label: 'Geri al', run: () => { gone.forEach(db.restoreTrash); nav(); route(); } });
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
function applyPrefs() {
  const h = document.documentElement;
  h.dataset.motion = S.settings.motion || 'full';
  h.dataset.sound = S.settings.sound || 'off';
  h.dataset.theme = S.settings.theme || 'space';
  h.style.setProperty('--acc', S.settings.accent || (h.dataset.theme === 'aurora' ? '#7cf5c8' : '#f4f4f5'));
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
  const link = (href, ic, label, active, extra = '') => `<a href="${href}" class="nav-link ${active ? 'on' : ''}">${icon(ic)}<span>${label}</span>${extra}</a>`;
  const rev = S.problems.filter(p => p.status === 'review').length;
  // brand is rendered once so its looping animation never restarts on navigation
  if (!$('#nav-body')) $('#nav').innerHTML = `<a href="#/" class="brand" aria-label="MathPad ana sayfa">${logo()}<span>MATH<b>PAD</b></span></a><div id="nav-body" class="nav-body"></div>`;
  $('#nav-body').innerHTML = `
    <button class="btn primary new-btn" data-act="new">${icon('plus')} Yeni soru</button>
    ${link('#/', 'home', 'Panel', here === '')}
    ${link('#/courses', 'book', 'Dersler', here === 'courses')}
    <div class="nav-courses">${S.courses.map(c => {
      const n = S.problems.filter(p => p.course === c.id).length;
      const on = (here === 'c' && b === c.id) || (here === 'p' && S.problems.find(p => p.id === b)?.course === c.id);
      return `<a href="#/c/${c.id}" class="nav-sub ${on ? 'on' : ''}"><span>${glyph(c)}${esc(c.name)}</span><i>${n || ''}</i></a>`;
    }).join('')}<button class="nav-sub add" data-act="add-course">${icon('plus')} Ders ekle</button></div>
    ${link('#/review', 'review', 'Tekrar', here === 'review', rev ? `<i class="count">${rev}</i>` : '')}
    ${link('#/tools', 'tool', 'Araçlar', here === 'tools')}
    ${link('#/sim', 'atom', 'Simülasyon', here === 'sim')}
    ${link('#/settings', 'settings', 'Ayarlar', here === 'settings')}
    <div class="nav-foot">${installEvt ? `<button class="btn ghost" data-act="install">${icon('install')} Uygulamayı yükle</button>` : ''}${update?.state === 'ready' ? `<button class="btn primary upd-btn" data-act="update">${icon('download')} ${esc(update.version)} hazır · Yeniden başlat</button>` : update?.state === 'downloading' ? `<p class="mute small upd-note"><span class="orbit-loader"></span> Güncelleme iniyor (${esc(update.version)})</p>` : ''}</div>`;
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
        <svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" style="--c:${C};stroke-dasharray:${C};stroke-dashoffset:${C * (1 - frac)}"/><circle cx="60" cy="60" r="52" class="ring-comet loop" pathLength="100"/></svg>
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
  return mountSky($('canvas.sky'), { courses: S.courses, problems: S.problems, onOpen: id => location.hash = '#/p/' + id });
}

function pcard(p) {
  return `<a class="pcard" href="#/p/${p.id}"><div class="thumb"><img data-thumb="${p.id}" alt=""></div>
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
  function render() {
    const rows = ps.filter(p => (filter === 'all' || p.status === filter) && (!topic || p.topic === topic) && (!q || (p.title + ' ' + p.topic).toLocaleLowerCase('tr').includes(q)));
    list.className = rows.length ? 'pgrid' : '';
    list.innerHTML = rows.map(pcard).join('') || `<div class="empty card pad">${astronaut('float wave')}<p>${ps.length ? 'Bu filtrede soru yok.' : 'Bu derste henüz soru yok.'}</p>${ps.length ? '' : `<button class="btn primary" data-act="new">${icon('plus')} Soru ekle</button>`}</div>`;
    loadThumbs(list);
  }
  $('[data-f]').onclick = e => { const k = e.target.dataset.k; if (!k) return; filter = k; pref('filter', k); $$('[data-f] button').forEach(b => b.classList.toggle('on', b === e.target)); render(); };
  $('[data-topic]')?.addEventListener('change', e => { topic = e.target.value; render(); });
  $('[data-q]').oninput = e => { q = e.target.value.trim().toLocaleLowerCase('tr'); render(); };
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
  view.innerHTML = `<div class="page"><header class="page-h"><div><p class="eyebrow">Tüm dersler</p><h1>Dersler</h1></div><button class="btn primary" data-act="add-course">${icon('plus')} Ders ekle</button></header>
    <div class="cgrid">${S.courses.map(c => {
      const ps = S.problems.filter(p => p.course === c.id), s = ps.filter(p => p.status === 'solved').length, r = ps.filter(p => p.status === 'review').length;
      const t = ps.reduce((a, p) => a + (p.secs || 0), 0);
      return `<a class="card pad ccard" href="#/c/${c.id}" style="--cc:${c.color}">${planetSvg(c, t, ps.length)}<h3>${esc(c.name)}</h3><div class="progress"><i style="width:${ps.length ? s / ps.length * 100 : 0}%"></i></div>
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

async function settings() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches;
  view.innerHTML = `<div class="page narrow"><header class="page-h"><div><p class="eyebrow">Ayarlar</p><h1>Ayarlar</h1></div></header>
    <div class="card pad set"><h3>Günlük hedef</h3><p class="mute">Panelde her gün kaç soru çözmeyi hedeflediğin.</p>
      <div class="row"><input class="inp mono" type="number" min="1" max="500" value="${S.settings.goal}" data-goal style="max-width:120px"><span class="mute">soru / gün</span></div></div>
    <div class="card pad set"><h3>Görünüm ve ses</h3>
      <div class="set-row"><span>Hareket ve animasyonlar</span><div class="seg" data-pref="motion">${[['full', 'Tam'], ['reduced', 'Azaltılmış'], ['off', 'Kapalı']].map(([k, l]) => `<button data-v="${k}" class="${(S.settings.motion || 'full') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><span>Tema</span><div class="seg" data-theme-pick>${THEMES.map(([k, l]) => `<button data-v="${k}" class="${(S.settings.theme || 'space') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><span>Vurgu rengi <small class="mute">(halkalar, ilerleme, ışıklar)</small></span><div class="pick" data-accent>${ACCENTS.map(a => `<button class="pick-c ${(S.settings.accent || '#f4f4f5') === a ? 'on' : ''}" style="--cc:${a}" data-v="${a}" aria-label="Vurgu ${a}"><span></span></button>`).join('')}</div></div>
      <div class="set-row"><span>Efekt sesleri <small class="mute">(çözüldü, hedef)</small></span><div class="seg" data-pref="sound">${[['off', 'Kapalı'], ['on', 'Açık']].map(([k, l]) => `<button data-v="${k}" class="${(S.settings.sound || 'off') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>
    <div class="card pad set" data-ai></div>
    ${window.desktop ? `<div class="card pad set"><h3>Masaüstü uygulaması</h3><p class="mute" data-ver>MathPad</p>
      <div class="row wrap"><button class="btn" data-datadir>${icon('book')} Veri klasörünü aç</button><button class="btn ghost" data-upcheck>${icon('review')} Güncellemeleri denetle</button></div></div>`
    : `<div class="card pad set"><h3>Uygulama olarak yükle</h3>
      ${standalone ? '<p>Zaten uygulama olarak açıksın ✦</p>' : installEvt ? `<p class="mute">Masaüstüne / ana ekrana ekle, internet olmadan da çalışsın.</p><button class="btn primary" data-act="install">${icon('install')} Yükle</button>`
      : ios ? '<p class="mute">iPad/iPhone: Safari\'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>.</p>' : '<p class="mute">Tarayıcının adres çubuğundaki <b>yükle</b> simgesine bas (Chrome/Edge). Android\'de menü → <b>Uygulamayı yükle</b>.</p>'}</div>`}
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
      <button class="btn danger" data-uninstall>${icon('trash')} MathPad'i kaldır</button></div>` : ''}</div>`;
  $('[data-goal]').onchange = e => { S.settings.goal = Math.max(1, +e.target.value || 10); persist(); toast('Hedef kaydedildi'); };
  $('[data-backup]').onclick = async () => { await backupNow(); toast('Yedek indirildi ✦'); };
  $('[data-backups]')?.addEventListener('click', () => desktop.openBackups());
  renderTrash($('[data-trash]'));
  keyCard($('[data-ai]'));
  $('[data-theme-pick]').onclick = e => {
    const v = e.target.closest('[data-v]')?.dataset.v; if (!v || v === (S.settings.theme || 'space')) return;
    $$('[data-theme-pick] button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    fx.scan(() => { S.settings.theme = v; if (v === 'aurora' && !S.settings.accent) S.settings.accent = '#7cf5c8'; persist(); applyPrefs(); });
  };
  $('[data-accent]').onclick = e => {
    const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
    S.settings.accent = v; persist(); applyPrefs();
    $$('[data-accent] button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  };
  renderStorage($('[data-storage]'), est, persisted);
  $('[data-restore]').onchange = async e => { const f = e.target.files[0]; if (f) restoreBackup(f.name, await f.text()); };
  $$('[data-pref]').forEach(seg => seg.onclick = e => {
    const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
    S.settings[seg.dataset.pref] = v; persist(); applyPrefs();
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (seg.dataset.pref === 'sound' && v === 'on') fx.sound('solve');
  });
  if (window.desktop) {
    desktop.info().then(i => $('[data-ver]').textContent = `Sürüm ${i.version} · Veriler: ${i.dataDir} · Güncellemeler otomatik gelir`);
    $('[data-upcheck]').onclick = async e => { e.currentTarget.disabled = true; const v = await desktop.checkUpdate(); toast(v && v !== (await desktop.info()).version ? `${v} bulundu, arka planda iniyor` : 'MathPad güncel ✦'); e.currentTarget.disabled = false; };
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
      <div class="seg status" data-status>${Object.entries(STATUS).map(([k, l]) => `<button data-s="${k}" class="${p.status === k ? 'on' : ''} s-${k}">${k === 'solved' ? icon('check') : k === 'review' ? icon('review') : icon('pen')}<span>${l}</span></button>`).join('')}</div>
      <button class="icon-btn" data-export title="PDF / PNG olarak kaydet">${icon('download')}</button>
      <button class="icon-btn" data-side title="Hesap makinesi & formüller">${icon('calc')}</button>
      <button class="icon-btn" data-focus title="Odak modu (F)" aria-label="Odak modu">${icon('star')}</button>
      <button class="icon-btn" data-del title="Soruyu sil">${icon('trash')}</button>
    </header>
    <div class="pb-main">
      <div class="board-wrap">
        <canvas class="board" aria-label="Çizim tahtası"></canvas>
        <div class="pins" aria-label="Nova notları"></div>
        <div class="board-empty" hidden>${icon('pen')}<p>Kalemle ya da fareyle yazmaya başla</p><p class="mute small">Soru resmini <b>yapıştır (Ctrl+V)</b>, buraya <b>sürükle</b> ya da ${icon('image')} ile ekle · iki parmakla kaydır/yakınlaştır</p></div>
        <div class="toolbar" role="toolbar">
          ${tools.map(([k, ic, l]) => k === '|' ? '<span class="sep"></span>' : `<button class="tb" data-tool="${k}" title="${l}" aria-label="${l}">${icon(ic)}</button>`).join('')}
          <button class="tb" data-img title="Resim / PDF ekle" aria-label="Resim veya PDF ekle">${icon('image')}</button>
          <button class="tb" data-symbols title="Devre sembolleri" aria-label="Devre sembolleri" aria-expanded="false">${icon('resistor')}</button>
          <button class="tb tb-toggle ${pref('snap') === '0' ? '' : 'on-soft'}" data-snap title="Şekil düzeltme: çizgiyi bitirince kalemi bir an beklet" aria-label="Şekil düzeltme" aria-pressed="${pref('snap') !== '0'}">${icon('sparkle')}</button>
          <span class="sep"></span>
          ${COLORS.map((col, i) => `<button class="sw ${i ? '' : 'on'}" data-color="${col}" style="--c:${col}" aria-label="Renk ${i + 1}"></button>`).join('')}
          <span class="sep"></span>
          ${[2, 3, 6].map(w => `<button class="tb wd ${w === 3 ? 'on' : ''}" data-w="${w}" title="Kalınlık" aria-label="Kalınlık ${w}"><i style="width:${w + 3}px;height:${w + 3}px"></i></button>`).join('')}
          <span class="sep"></span>
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
    p.updated = Date.now(); persist();
  }
  const board = createBoard($('canvas.board'), els, {
    onChange(list) { emptyHint.hidden = list.length > 0; clearTimeout(saveT); saveT = setTimeout(save, 800); },
    onTool: t => { $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); fx.slideIndicator($('.toolbar'), $(`[data-tool="${t}"]`)); },
    onSelect: el => { $('[data-delsel]').disabled = !el; $('[data-rot]').disabled = el?.type !== 'sym'; },
    onSnap: type => toast(`Şekil düzeltildi: ${SHAPE_NAMES[type] || type} ✦`),
  });
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
  $('.toolbar').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) { board.setTool(b.dataset.tool); pref('tool', b.dataset.tool); }
    else if (b.dataset.color) { board.setColor(b.dataset.color); wrap.style.setProperty('--pen', b.dataset.color); $$('.sw').forEach(s => s.classList.toggle('on', s === b)); if (['eraser', 'select'].includes(board.tool)) board.setTool('pen'); }
    else if (b.dataset.w) { board.setWidth(+b.dataset.w); $$('.wd').forEach(s => s.classList.toggle('on', s === b)); }
    else if ('undo' in b.dataset) board.undo();
    else if ('redo' in b.dataset) board.redo();
    else if ('fit' in b.dataset) board.fit();
    else if ('delsel' in b.dataset) board.deleteSel();
    else if ('img' in b.dataset) $('[data-file]').click();
    else if ('rot' in b.dataset) board.rotateSel();
    else if ('symbols' in b.dataset) { const pop = $('.sym-pop'); pop.hidden = !pop.hidden; b.setAttribute('aria-expanded', !pop.hidden); }
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
  const title = $('.title-in');
  title.onchange = () => { p.title = title.value.trim() || p.title; title.value = p.title; persist(); };
  title.onkeydown = e => e.key === 'Enter' && title.blur();
  $('[data-status]').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const s = b.dataset.s, was = p.status;
    p.status = s; p.solvedAt = s === 'solved' ? (was === 'solved' ? p.solvedAt : Date.now()) : null; p.updated = Date.now();
    persist(); $$('[data-s]').forEach(x => x.classList.toggle('on', x === b));
    if (s === 'solved' && was !== 'solved') celebrate();
    if (s === 'review' && was !== 'review') toast('Tekrar listesine eklendi');
    nav();
  };
  $('[data-meta]').onclick = async () => {
    const r = await modal('Ders ve konu', `<label>Ders<select class="inp" name="course">${S.courses.map(x => `<option value="${x.id}" ${x.id === p.course ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Konu<input class="inp" name="topic" value="${esc(p.topic)}" list="dl-t2" autocomplete="off"><datalist id="dl-t2">${db.topicsOf().map(t => `<option value="${esc(t)}">`).join('')}</datalist></label>`);
    if (!r) return;
    p.course = r.course; p.topic = r.topic.trim(); persist();
    $('[data-meta]').innerHTML = `${esc(db.courseOf(p)?.name || '')}${p.topic ? ' · ' + esc(p.topic) : ''} ${icon('edit')}`;
    $('.pb-top a').href = '#/c/' + p.course; nav();
  };
  $('[data-del]').onclick = async () => {
    if (saveT) await save(); // keep the latest drawing in the trash copy
    const back = p.course, e = db.removeProblem(id);
    location.hash = '#/c/' + back;
    toast(`"${p.title}" çöp kutusuna taşındı`, { label: 'Geri al', run: () => { db.restoreTrash(e); location.hash = '#/p/' + id; } });
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
      doc.save(name + '.pdf');
    } catch (err) { toast('PDF oluşturulamadı: ' + err.message); }
  };

  // side panel (calculator + formulas)
  const side = $('.pb-side');
  let calcMounted = false;
  const mountSide = () => { if (!calcMounted && !side.hidden) { T.mountCalc($('[data-pane=calc]')); $('[data-pane=fx]').innerHTML = T.renderNote(S.notes[p.course]); calcMounted = true; } };
  mountSide();
  $('[data-side]').onclick = () => { side.hidden = !side.hidden; pref('side', side.hidden ? '0' : '1'); mountSide(); };
  $('[data-close-side]').onclick = () => { side.hidden = true; pref('side', '0'); };
  let stopTutor = null;
  const tab = t => {
    side.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    side.querySelectorAll('[data-pane]').forEach(x => x.hidden = x.dataset.pane !== t);
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
  const openNova = () => { side.hidden = false; mountSide(); tab('nova'); $('[data-pane=nova] textarea')?.focus(); };
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
    removeEventListener('keydown', focusKey); document.body.classList.remove('focus'); fx.ambience(false);
    document.removeEventListener('paste', onPaste);
    view.removeEventListener('pointerdown', act); removeEventListener('keydown', act);
    if (saveT) save();
  };
}

// ---------- router & boot ----------
async function route() {
  const prev = cleanup; cleanup = null; await prev?.();
  const [a = '', b, c] = route_();
  const fn = { '': home, c: course, courses, p: problem, review, tools, sim, settings }[a] || notFound;
  await fx.transition(async () => {
    document.body.dataset.page = a || 'home';
    view.onclick = null;
    nav();
    const r = await fn(b, c);
    if (typeof r === 'function') cleanup = r;
    if (a !== 'p') view.scrollTop = 0;
    fx.stagger(view); fx.countUp(view);
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
  document.body.insertAdjacentHTML('beforeend', `<div id="splash" aria-hidden="true">${logo('xl')}<span>MATH<b>PAD</b></span></div>`);
  const hideSplash = () => { const s = $('#splash'); if (!s) return; s.classList.add('out'); setTimeout(() => s.remove(), 600); };
  try { await db.load(); applyPrefs(); }
  catch (err) { hideSplash(); view.innerHTML = `<div class="page"><div class="card pad"><h3>Depolama açılamadı</h3><p class="mute">${esc(err.message)}. Gizli pencere kullanıyorsan normal pencerede aç.</p></div></div>`; return; }
  if (!fx.full()) $('#splash')?.remove();
  route(); autoBackup();
  setTimeout(hideSplash, Math.max(0, 1100 - (Date.now() - t0))); // let the intro play once, never longer
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
