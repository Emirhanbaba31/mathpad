// Nova — the astronaut tutor. Talks to Claude with the student's own API key (kept only in this browser, never in backups).
import Anthropic from '../vendor/anthropic.mjs';
import { esc, icon, toast } from './ui.js';
import { renderNote } from './tools.js';
import * as db from './db.js';

const KEY = 'mp.apiKey';
export const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setKey = k => { try { k ? localStorage.setItem(KEY, k) : localStorage.removeItem(KEY); } catch { } };

// Line-art astronaut. Loops (float, visor glint, antenna, wave) live in app.css.
export const astronaut = (cls = '') => `<svg class="astro loop ${cls}" viewBox="0 0 100 124" aria-hidden="true">
  <defs><clipPath id="astro-visor"><ellipse cx="50" cy="40" rx="16" ry="12"/></clipPath></defs>
  <g class="astro-body">
    <line x1="50" y1="15" x2="50" y2="7" class="a-line"/><circle cx="50" cy="5" r="2.4" class="a-blink"/>
    <rect x="27" y="62" width="46" height="30" rx="9" class="a-pack"/>
    <path d="M34 72 q-13 7 -15 20" class="a-line"/><circle cx="19" cy="93" r="3.2" class="a-fill"/>
    <g class="astro-wave"><path d="M66 72 q13 -4 17 -17" class="a-line"/><circle cx="83" cy="54" r="3.2" class="a-fill"/></g>
    <rect x="33" y="60" width="34" height="36" rx="12" class="a-suit"/>
    <rect x="42" y="70" width="16" height="10" rx="3" class="a-line"/><circle cx="46.5" cy="75" r="1.4" class="a-blink"/><circle cx="53.5" cy="75" r="1.4" class="a-fill"/>
    <path d="M43 96 v14 h-5 M57 96 v14 h5" class="a-line"/>
    <circle cx="50" cy="38" r="24" class="a-suit"/>
    <ellipse cx="50" cy="40" rx="16" ry="12" class="a-visor"/>
    <g clip-path="url(#astro-visor)"><rect x="20" y="22" width="7" height="40" class="a-glint" transform="rotate(25 50 40)"/></g>
    <path d="M40 34 q4 -4 9 -4" class="a-shine"/>
  </g></svg>`;

const MODEL = 'claude-opus-5-5';
const SYSTEM = `Sen "Nova" adında, MathPad uygulamasının içindeki astronot ders asistanısın. Mühendislik öğrencilerine (özellikle Elektrik-Elektronik) soru çözmede yardım ediyorsun.
- Türkçe yaz; samimi ama kısa ve net ol.
- Varsayılan olarak öğret: önce yol göster ve ipucu ver. Öğrenci açıkça çözüm istemedikçe tam çözümü tek seferde verme.
- Matematiği LaTeX ile yaz: satır içinde $...$, ayrı satırda $$...$$. Başlık için "# ", madde için "- ", vurgu için **kalın** kullan; tablo veya kod bloğu kullanma.
- Gelen görsel, öğrencinin tahtasının o anki halidir: soru fotoğrafı ve el yazısıyla çözümü içerebilir. Okuyamadığın bir yer varsa bunu söyle, uydurma.
- Sayısal sonuçları birimiyle ver. Emin olmadığın yerde bunu belirt.`;
const ACTIONS = [
  ['hint', 'İpucu ver', 'Bu soru için bir sonraki adımı gösterecek kısa bir ipucu ver. Çözümü verme.'],
  ['check', 'Çözümümü kontrol et', 'Tahtadaki çözümümü kontrol et: doğru mu, hata varsa nerede? Hatayı göster ama soruyu baştan çözme.'],
  ['steps', 'Adım adım çöz', 'Bu soruyu adım adım çöz; her adımı kısaca açıkla.'],
  ['explain', 'Konuyu anlat', 'Bu sorunun konusunu kısa ve sezgisel anlat, kullanılan temel formülleri ver.'],
];

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'API anahtarı geçersiz görünüyor. Ayarlar → Astronot asistan bölümünden kontrol et.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Bu anahtarın bu modele erişimi yok.';
  if (err instanceof Anthropic.RateLimitError) return 'Çok sık soru soruldu ya da kredi limiti doldu; biraz sonra tekrar dene.';
  if (err instanceof Anthropic.APIConnectionError) return 'İnternete bağlanılamadı. Nova\'nın çalışması için internet gerekiyor.';
  if (err instanceof Anthropic.APIError) return `Sunucu hatası (${err.status}). Biraz sonra tekrar dene.`;
  return err?.message || 'Bilinmeyen bir hata oluştu.';
}

// Settings card markup + wiring (used on the Settings page).
export function keyCard(el) {
  const has = !!getKey();
  el.innerHTML = `<h3 class="row">${astronaut('xs')} Astronot asistan Nova</h3>
    <p class="mute">Nova, soru sayfasında tahtana bakıp ipucu verir, çözümünü kontrol eder ya da adım adım anlatır. Çalışması için bir <b>Claude API anahtarı</b> gerekiyor.</p>
    <ol class="mute small steps"><li><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> adresinde hesap aç ve kredi yükle.</li><li><b>Create Key</b> ile bir anahtar oluştur, aşağıya yapıştır.</li></ol>
    <form class="row wrap" data-keyform><input class="inp mono" type="password" name="k" placeholder="${has ? '•••••••• (kayıtlı)' : 'sk-ant-…'}" autocomplete="off" style="max-width:340px" aria-label="API anahtarı">
      <button class="btn primary">Kaydet</button>${has ? '<button type="button" class="btn ghost" data-keydel>Anahtarı sil</button>' : ''}</form>
    <p class="mute small">Anahtar sadece bu cihazda saklanır; yedeklere ve paylaşılan ders dosyalarına girmez. Her soru birkaç kuruş tutar (model: Claude Opus 5.5).</p>`;
  el.querySelector('[data-keyform]').onsubmit = e => {
    e.preventDefault();
    const k = e.target.k.value.trim();
    if (!/^sk-ant-/.test(k)) return toast('Bu bir Claude API anahtarına benzemiyor (sk-ant- ile başlamalı)');
    setKey(k); toast('Nova hazır ✦'); keyCard(el);
  };
  el.querySelector('[data-keydel]')?.addEventListener('click', () => { setKey(''); toast('Anahtar silindi'); keyCard(el); });
}

// Chat panel for one problem. getImage() → JPEG data URL of the board (or null when empty).
export function mountTutor(el, { problem, courseName, getImage }) {
  let hist = [], busy = null;
  el.innerHTML = `<div class="astro-chat">
    <div class="astro-head">${astronaut('sm wave')}<div><b>Nova</b><span class="mute small">astronot asistanın</span></div></div>
    <div class="astro-log" aria-live="polite"></div>
    <div class="ex-row astro-quick">${ACTIONS.map(([k, l]) => `<button type="button" class="chip ex" data-q="${k}">${l}</button>`).join('')}</div>
    <form class="astro-in"><textarea class="inp" rows="2" placeholder="Nova'ya sor… (Enter gönderir)" aria-label="Nova'ya mesaj"></textarea><button class="btn primary" aria-label="Gönder">${icon('arrow')}</button></form>
    <label class="astro-att small mute"><input type="checkbox" checked data-img> Tahtanın görüntüsünü de gönder</label></div>`;
  const log = el.querySelector('.astro-log'), ta = el.querySelector('textarea'), form = el.querySelector('form');
  const bubble = (role, html) => {
    const d = document.createElement('div'); d.className = `msg ${role}`; d.innerHTML = html;
    log.append(d); log.scrollTop = log.scrollHeight; return d;
  };
  const showAll = () => {
    log.innerHTML = '';
    if (!hist.length) bubble('assistant', `<p>Merhaba! Ben Nova ✦ Tahtana bakıp yardım edebilirim. Aşağıdan bir şey seç ya da sorunu yaz.</p>`);
    for (const m of hist) bubble(m.role, m.role === 'user' ? `<p>${esc(m.text)}</p>` : renderNote(m.text));
  };
  db.get('ai:' + problem.id).then(h => { hist = Array.isArray(h) ? h : []; showAll(); });

  async function send(text, shown = text) {
    if (busy || !text.trim()) return;
    const apiKey = getKey();
    if (!apiKey) { bubble('assistant', `<p>Önce bana bir API anahtarı vermen gerekiyor: <a href="#/settings">Ayarlar → Astronot asistan</a>.</p>`); return; }
    const attach = el.querySelector('[data-img]').checked;
    bubble('user', `<p>${esc(shown)}</p>`);
    const out = bubble('assistant thinking', '<p class="dots"><i></i><i></i><i></i> Nova düşünüyor</p>');
    el.querySelector('.astro').classList.add('talking');
    const messages = hist.slice(-20).map(m => ({ role: m.role, content: m.text }));
    const content = [];
    try {
      const img = attach ? await getImage() : null;
      if (img) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.split(',')[1] } });
    } catch { /* board snapshot is optional */ }
    content.push({ type: 'text', text: `[Ders: ${courseName || '-'} · Konu: ${problem.topic || '-'} · Soru: ${problem.title}]\n${text}` });
    messages.push({ role: 'user', content });
    hist.push({ role: 'user', text: shown === text ? text : `${shown}: ${text}` });
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      busy = client.beta.messages.stream({
        model: MODEL, max_tokens: 16000, system: SYSTEM, messages,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      });
      busy.on('text', (_d, snap) => { out.className = 'msg assistant'; out.innerHTML = renderNote(snap); log.scrollTop = log.scrollHeight; });
      const msg = await busy.finalMessage();
      const reply = msg.stop_reason === 'refusal' ? 'Bu isteğe yardımcı olamıyorum. Soruyu farklı şekilde sormayı dener misin?'
        : msg.content.filter(b => b.type === 'text').map(b => b.text).join('') || '…';
      out.className = 'msg assistant'; out.innerHTML = renderNote(reply);
      hist.push({ role: 'assistant', text: reply });
      await db.set('ai:' + problem.id, hist.slice(-40));
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError) return;
      hist.pop(); // keep history consistent: the question had no answer
      out.className = 'msg assistant err'; out.innerHTML = `<p>${esc(friendlyError(err))}</p>`;
    } finally {
      busy = null; el.querySelector('.astro')?.classList.remove('talking');
    }
  }
  form.onsubmit = e => { e.preventDefault(); const t = ta.value; ta.value = ''; send(t); };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } e.stopPropagation(); };
  el.querySelector('.astro-quick').onclick = e => { const k = e.target.closest('[data-q]')?.dataset.q; if (k) { const a = ACTIONS.find(a => a[0] === k); send(a[2], a[1]); } };
  return () => busy?.abort();
}
