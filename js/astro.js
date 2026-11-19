// Nova — the astronaut tutor. Talks to Claude (Anthropic SDK) or Gemini (Google REST) with the student's own API key.
import Anthropic from '../vendor/anthropic.mjs';
import { esc, icon, toast } from './ui.js';
import { renderNote } from './tools.js';
import * as db from './db.js';
import { full } from './fx.js';

// Nova the astronaut, designed by Gemini 4 Neon. Loops (float, visor glint, antenna, wave) live in app.css.
export const astronaut = (cls = '') => `<svg class='astro loop ${cls}' viewBox='0 0 100 124' aria-hidden='true'><defs><clipPath id='astro-visor'><path d='M 50 27.5 C 63.5 27.5 69 32.5 69 42 C 69 51 63 55.5 50 55.5 C 37 55.5 31 51 31 42 C 31 32.5 36.5 27.5 50 27.5 Z'/></clipPath></defs><g class='astro-body'><rect class='a-pack' x='26.5' y='55.5' width='47' height='31' rx='7'/><g class='a-leg-l'><path class='a-suit' d='M 35 86 L 34.5 104.5 C 32.2 106.5 31.8 110.5 33.5 112.8 C 34.8 114.2 36.8 114.5 39.5 114.5 L 44.5 114.5 C 46.8 114.5 47.5 113 47.5 110.5 L 47.5 86 Z'/><path class='a-line' d='M 34.8 105.2 Q 41 106.6 47.2 105.2'/><rect class='a-line' x='38.2' y='94.5' width='5.6' height='4.6' rx='2'/></g><g class='a-leg-r'><path class='a-suit' d='M 65 86 L 65.5 104.5 C 67.8 106.5 68.2 110.5 66.5 112.8 C 65.2 114.2 63.2 114.5 60.5 114.5 L 55.5 114.5 C 53.2 114.5 52.5 113 52.5 110.5 L 52.5 86 Z'/><path class='a-line' d='M 52.8 105.2 Q 59 106.6 65.2 105.2'/><rect class='a-line' x='56.2' y='94.5' width='5.6' height='4.6' rx='2'/></g><g class='a-arm-l'><path class='a-suit' d='M 34 67.4 C 27.5 68 23.5 74 22.2 83.5 C 20.5 87.5 22.5 91.8 26.2 91.5 C 29.8 91.2 31.5 88.2 30.5 85 C 31.5 81 32.5 78 34 76.6 Z'/><path class='a-line' d='M 22.5 83.6 Q 26.5 85.4 30.3 85'/></g><g class='astro-wave'><path class='a-suit' d='M 66 67.4 C 71 67.4 74.5 64 77 58.5 C 75.5 56 76 52.5 79 51 C 82 48.2 87 49 88.2 52.5 C 89.2 55.5 87.5 59 84.5 61 C 82 67.5 76 76 66 76.6 A 4.6 4.6 0 0 1 66 67.4 Z'/><path class='a-line' d='M 77.2 58.6 Q 81.2 58.4 84.3 60.8'/></g><path class='a-suit' d='M 36.5 64 C 34 65 34 69 34 74 L 34.5 85 C 34.5 88.5 37 90 41 90 L 59 90 C 63 90 65.5 88.5 65.5 85 L 66 74 C 66 69 66 65 63.5 64 Z'/><path class='a-line' d='M 34.5 84.5 Q 50 86.2 65.5 84.5'/><rect class='a-fill' x='46.5' y='83.5' width='7' height='3.6' rx='1.4'/><path class='a-line' d='M 30 59.5 C 29 66.5 32.5 74.5 41 75.8'/><rect class='a-suit' x='40.5' y='71' width='19' height='9.6' rx='2.6'/><circle class='a-blink' cx='45' cy='75.8' r='1.6'/><circle class='a-blink' cx='50' cy='75.8' r='1.6'/><circle class='a-fill' cx='55' cy='75.8' r='1.7'/><path class='a-suit' d='M 36.5 58.5 L 63.5 58.5 L 63 64.5 Q 50 68.5 37 64.5 Z'/><g class='a-head'><rect class='a-suit' x='22.2' y='35' width='6' height='10' rx='3'/><rect class='a-suit' x='71.8' y='35' width='6' height='10' rx='3'/><line class='a-line' x1='50' y1='18.2' x2='50' y2='11.8'/><circle class='a-blink' cx='50' cy='9.2' r='2.6'/><ellipse class='a-suit' cx='50' cy='40' rx='24.5' ry='22'/><path class='a-visor' d='M 50 27.5 C 63.5 27.5 69 32.5 69 42 C 69 51 63 55.5 50 55.5 C 37 55.5 31 51 31 42 C 31 32.5 36.5 27.5 50 27.5 Z'/><g clip-path='url(#astro-visor)'><rect class='a-glint' x='38' y='24' width='8' height='35' transform='rotate(18 42 41.5)'/></g><path class='a-shine' d='M 36.5 39 C 36.5 35 39.5 32.5 44.5 32'/></g></g></svg>`;

// Nova's ship, designed by Gemini 4 Neon. The tether leaves from the s-port ring at (46, 66).
export const ship = (cls = '') => `<svg class='ship ${cls}' viewBox='0 0 160 90' aria-hidden='true'> <defs> <clipPath id='ship-cockpit'> <path d='M 23.5 36 C 25.5 22.5 37.5 18 48.5 19.5 C 55.5 20.5 60 25.5 59.5 32.5 C 59 38 52.5 40.5 42 41 C 30.5 41.5 23 40.5 23.5 36 Z'/> </clipPath> </defs> <g class='s-flame'> <path d='M 118 41.5 Q 132 41.5 141 47 Q 132 52.5 118 52.5 Z'/> <path d='M 118 44.2 Q 126.5 44.2 131.5 47 Q 126.5 49.8 118 49.8 Z'/> </g> <g class='s-hull'> <line class='a-pack' x1='91' y1='60' x2='93' y2='72.5'/> <line class='a-pack' x1='85' y1='72.5' x2='100' y2='72.5'/> <path class='a-pack' d='M 78 29 C 87 20 98 14 109 14 C 113 14 113.5 18 110.5 23 C 107.5 28 106 32.5 105.5 37.5 Z'/> <path class='a-pack' d='M 93 55 C 103 57.5 111.5 60.5 112.5 63.5 C 113.5 66 108.5 67 101 65 L 90 61.5 Z'/> <line class='a-line' x1='69.5' y1='26' x2='69.5' y2='14.5'/> <path class='a-line' d='M 65 18 Q 69.5 21.5 74 18'/> <circle class='s-beacon' cx='69.5' cy='12' r='2.5'/> <line class='a-line' x1='62' y1='63.5' x2='60' y2='77'/> <line class='a-line' x1='81' y1='62' x2='83' y2='77'/> <path class='a-line' d='M 53.5 73.5 Q 56 77 61 77 L 89 77'/> <path class='a-suit' d='M 106 40.5 L 120 38.5 C 122.8 38.5 122.8 55.5 120 55.5 L 106 53.5 Z'/> <line class='a-line' x1='114.5' y1='39.3' x2='114.5' y2='54.7'/> <path class='a-suit' d='M 14 48 C 14 34 30 25 56 25 C 80 25 99 30 108 37 C 111.5 41 111.5 52 108 56 C 99 61 80 64.5 54 64.5 C 29 64.5 14 58.5 14 48 Z'/> <path class='a-line' d='M 28 40.5 C 25.5 48.5 27 56.5 31.5 62.3'/> <path class='a-line' d='M 99.4 32.2 C 95.8 41 95.8 51 99.4 59.4'/> <path class='a-visor' d='M 23.5 36 C 25.5 22.5 37.5 18 48.5 19.5 C 55.5 20.5 60 25.5 59.5 32.5 C 59 38 52.5 40.5 42 41 C 30.5 41.5 23 40.5 23.5 36 Z'/> <g clip-path='url(#ship-cockpit)'> <rect class='s-glint' x='12' y='16' width='7' height='28'/> </g> <circle class='s-window' cx='69' cy='40.5' r='4.2'/> <circle class='s-window' cx='83.5' cy='42' r='4.2'/> <path class='a-suit' d='M 61 54.5 C 71 52 82 52 90 55 C 96 57.5 98.5 61.5 96 64.5 C 93.5 67 85 66.5 74.5 63.5 C 65 61 58 58 61 54.5 Z'/> <circle class='a-blink' cx='20.5' cy='50.5' r='1.8'/> <circle class='a-blink' cx='90.5' cy='60.5' r='1.8'/> <circle class='a-fill' cx='33.5' cy='47.5' r='1.5'/> <circle class='a-fill' cx='34' cy='55.5' r='1.5'/> <circle class='a-fill' cx='93' cy='36.5' r='1.5'/> <circle class='a-fill' cx='92' cy='48' r='1.5'/> <circle class='s-port' cx='46' cy='66' r='3'/> </g> </svg>`;

// ---------- providers & models (all kept in this browser only; never in backups) ----------
const LS = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { } },
};
export const PROVIDERS = {
  claude: { name: 'Claude', by: 'Anthropic', keyLs: 'mp.apiKey', hint: 'sk-ant-…', re: /^sk-ant-/, link: 'https://console.anthropic.com/settings/keys', site: 'console.anthropic.com', def: 'claude-opus-5-5' },
  gemini: { name: 'Gemini', by: 'Google', keyLs: 'mp.geminiKey', hint: 'AIza…', re: /^AIza/, link: 'https://aistudio.google.com/apikey', site: 'aistudio.google.com', def: 'gemini-2.5-flash' },
};
export const provider = () => PROVIDERS[LS.get('mp.aiProvider')] ? LS.get('mp.aiProvider') : 'claude';
export const getKey = (p = provider()) => LS.get(PROVIDERS[p].keyLs);
const setKey = (p, k) => LS.set(PROVIDERS[p].keyLs, k);
export const model = (p = provider()) => LS.get('mp.aiModel.' + p, PROVIDERS[p].def);
const setModel = (p, m) => LS.set('mp.aiModel.' + p, m);
const cachedModels = p => { try { return JSON.parse(LS.get('mp.aiModels.' + p, '[]')); } catch { return []; } };

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
// Fetch the models this key can use; newest first. Cached so the pickers fill instantly next time.
async function listModels(p) {
  const key = getKey(p); if (!key) return [];
  let list;
  if (p === 'claude') {
    const page = await new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }).models.list({ limit: 100 });
    list = page.data.map(m => ({ id: m.id, name: m.display_name || m.id }));
  } else {
    const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) throw await geminiError(res);
    list = ((await res.json()).models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent') && /gemini/.test(m.name) && !/tts|embed|image|audio|live/.test(m.name))
      .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name })).reverse();
  }
  LS.set('mp.aiModels.' + p, JSON.stringify(list));
  if (list.length && !list.some(m => m.id === model(p))) setModel(p, (list.find(m => /flash/.test(m.id)) || list[0]).id);
  return list;
}

async function geminiError(res) {
  const j = await res.json().catch(() => null), msg = j?.error?.message || res.statusText;
  return Object.assign(new Error(msg), { status: res.status, gemini: true, keyBad: /API key not valid|API_KEY_INVALID/i.test(msg) });
}

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
  ['similar', 'Benzer soru üret', 'Bu soruya benzeyen ama sayıları ve koşulları farklı yeni bir alıştırma sorusu yaz. Çözümünü verme, sadece soruyu yaz; en sonda tek satırda **Cevap:** ile sadece sonucu ver.'],
];

function friendlyError(err) {
  if (err?.gemini) {
    if (err.keyBad || err.status === 401) return 'Gemini API anahtarı geçersiz görünüyor. Ayarlar → Astronot asistan bölümünden kontrol et.';
    if (err.status === 403) return 'Bu anahtarın bu modele erişimi yok.';
    if (err.status === 404) return 'Bu model bulunamadı. Ayarlar\'dan başka bir model seç.';
    if (err.status === 429) return 'Kota doldu ya da çok sık soru soruldu; biraz sonra tekrar dene.';
    return `Gemini hatası (${err.status}): ${err.message}`;
  }
  if (err instanceof TypeError) return 'İnternete bağlanılamadı. Nova\'nın çalışması için internet gerekiyor.';
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API anahtarı geçersiz görünüyor. Ayarlar → Astronot asistan bölümünden kontrol et.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Bu anahtarın bu modele erişimi yok.';
  if (err instanceof Anthropic.NotFoundError) return 'Bu model bulunamadı. Ayarlar\'dan başka bir model seç.';
  if (err instanceof Anthropic.RateLimitError) return 'Çok sık soru soruldu ya da kredi limiti doldu; biraz sonra tekrar dene.';
  if (err instanceof Anthropic.APIConnectionError) return 'İnternete bağlanılamadı. Nova\'nın çalışması için internet gerekiyor.';
  if (err instanceof Anthropic.APIError) return `Sunucu hatası (${err.status}). Biraz sonra tekrar dene.`;
  return err?.message || 'Bilinmeyen bir hata oluştu.';
}

// One streamed answer. hist: [{role:'user'|'assistant', text}], last entry is the new question.
// Returns { text, refused }. onText(snapshot) is called as text arrives.
async function ask({ hist, img, onText = () => { }, signal, system = SYSTEM }) {
  const p = provider(), m = model(p), key = getKey(p);
  const lastText = hist.at(-1).text;
  if (p === 'gemini') {
    const contents = hist.map((h, i) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [...(i === hist.length - 1 && img ? [{ inline_data: { mime_type: 'image/jpeg', data: img } }] : []), { text: h.text }],
    }));
    const res = await fetch(`${GEMINI}/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 8192 } }),
    });
    if (!res.ok) throw await geminiError(res);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', finish = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const j = JSON.parse(line.slice(5)), c = j.candidates?.[0];
        for (const part of c?.content?.parts || []) if (part.text && !part.thought) text += part.text;
        finish = c?.finishReason || finish;
        if (j.promptFeedback?.blockReason) finish = 'SAFETY';
        onText(text);
      }
    }
    return { text, refused: !text && /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish) };
  }
  // Claude
  const messages = hist.map((h, i) => ({
    role: h.role,
    content: i === hist.length - 1 && img ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: lastText }] : h.text,
  }));
  const modern = /claude-(opus|sonnet|haiku)-5|fable|mythos/.test(m); // effort + server-side fallbacks only on these
  const stream = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }).beta.messages.stream({
    model: m, max_tokens: 16000, system, messages,
    ...(modern && { output_config: { effort: 'medium' } }),
    ...(/^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-[12])$/.test(m) && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
  }, { signal });
  stream.on('text', (_d, snap) => onText(snap));
  const msg = await stream.finalMessage();
  return { text: msg.content.filter(b => b.type === 'text').map(b => b.text).join(''), refused: msg.stop_reason === 'refusal' };
}

// ---------- settings card: provider, key, model ----------
export function keyCard(el) {
  const p = provider(), P = PROVIDERS[p], has = !!getKey(p), models = cachedModels(p);
  el.innerHTML = `<h3 class="row">${astronaut('xs')} Astronot asistan Nova</h3>
    <p class="mute">Nova, soru sayfasında tahtana bakıp ipucu verir, çözümünü kontrol eder ya da adım adım anlatır. Kendi API anahtarınla çalışır.</p>
    <div class="set-row"><span>Yapay zeka</span><div class="seg" data-prov>${Object.entries(PROVIDERS).map(([k, v]) => `<button data-v="${k}" class="${k === p ? 'on' : ''}">${v.name} <small class="mute">${v.by}</small></button>`).join('')}</div></div>
    <ol class="mute small steps"><li><a href="${P.link}" target="_blank" rel="noopener">${P.site}</a> adresinde bir ${P.name} API anahtarı oluştur.</li><li>Aşağıya yapıştırıp <b>Kaydet</b>'e bas.</li></ol>
    <form class="row wrap" data-keyform><input class="inp mono" type="password" name="k" placeholder="${has ? '•••••••• (kayıtlı)' : P.hint}" autocomplete="off" style="max-width:340px" aria-label="${P.name} API anahtarı">
      <button class="btn primary">Kaydet</button>${has ? '<button type="button" class="btn ghost" data-keydel>Anahtarı sil</button>' : ''}</form>
    ${has ? `<div class="set-row"><span>Model</span><div class="row"><select class="inp" data-model style="max-width:320px" aria-label="Model">${modelOptions(p, models)}</select><button type="button" class="btn ghost small" data-refresh>Listeyi yenile</button></div></div>` : ''}
    <p class="mute small" data-note>Anahtarlar sadece bu cihazda saklanır; yedeklere ve paylaşılan ders dosyalarına girmez. Nova'ya sorduğunda tahtanın görüntüsü seçtiğin şirkete gönderilir.</p>`;
  el.querySelector('[data-prov]').onclick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (v && v !== p) { LS.set('mp.aiProvider', v); keyCard(el); } };
  const note = el.querySelector('[data-note]');
  const status = (msg, bad) => { note.textContent = msg; note.classList.toggle('err', !!bad); };
  el.querySelector('[data-keyform]').onsubmit = async e => {
    e.preventDefault();
    const k = e.target.k.value.replace(/\s+/g, '').replace(/^['"]+|['"]+$/g, ''); // pasted keys often carry spaces/quotes
    if (k.length < 20) return status('Anahtar çok kısa görünüyor; tamamını kopyaladığından emin ol.', true);
    // the key itself tells which company it belongs to: switch if the other tab was selected
    const q = Object.keys(PROVIDERS).find(x => PROVIDERS[x].re.test(k)) || p;
    if (q !== p) LS.set('mp.aiProvider', q);
    const old = getKey(q); setKey(q, k);
    e.target.querySelector('button').disabled = true;
    status(`${PROVIDERS[q].name} anahtarı kontrol ediliyor…`);
    try { await listModels(q); keyCard(el); toast(`${PROVIDERS[q].name} anahtarı doğrulandı, Nova hazır ✦`); }
    catch (err) {
      const rejected = err?.keyBad || err?.status === 400 || err?.status === 401 || err instanceof Anthropic.AuthenticationError;
      if (rejected) setKey(q, old); // keep a wrong key out; network trouble keeps it
      if (q !== p) keyCard(el);
      el.querySelector('[data-note]').textContent = `${friendlyError(err)}${err?.message ? ` — sunucunun cevabı: ${err.message}` : ''}`;
      el.querySelector('[data-note]').classList.add('err');
      el.querySelector('[data-keyform] button').disabled = false;
    }
  };
  el.querySelector('[data-keydel]')?.addEventListener('click', () => { setKey(p, ''); toast('Anahtar silindi'); keyCard(el); });
  el.querySelector('[data-model]')?.addEventListener('change', e => { setModel(p, e.target.value); toast(`Nova artık ${e.target.selectedOptions[0].text} kullanıyor ✦`); });
  el.querySelector('[data-refresh]')?.addEventListener('click', () => refresh(false));
  async function refresh(fresh) {
    try { await listModels(p); keyCard(el); toast(fresh ? 'Anahtar doğrulandı, Nova hazır ✦' : 'Model listesi yenilendi'); }
    catch (err) { toast(friendlyError(err)); }
  }
  if (has && !models.length) refresh(false);
}
const modelOptions = (p, models) => {
  const cur = model(p), list = models.some(m => m.id === cur) ? models : [{ id: cur, name: cur }, ...models];
  return list.map(m => `<option value="${esc(m.id)}" ${m.id === cur ? 'selected' : ''}>${esc(m.name)}${m.name !== m.id ? ` · ${esc(m.id)}` : ''}</option>`).join('');
};

// ---------- chat panel for one problem. getImage() → JPEG data URL of the board (or null) ----------
export function mountTutor(el, { problem, courseName, getImage, onPin, onNewProblem }) {
  let hist = [], ctrl = null;
  el.innerHTML = `<div class="astro-chat">
    <div class="astro-head">${astronaut('sm wave')}<div><b>Nova</b><span class="mute small">astronot asistanın</span></div>
      <select class="inp astro-model" data-amodel aria-label="Nova'nın modeli"></select></div>
    <div class="astro-log" aria-live="polite"></div>
    <div class="ex-row astro-quick">${ACTIONS.map(([k, l]) => `<button type="button" class="chip ex" data-q="${k}">${l}</button>`).join('')}</div>
    <form class="astro-in"><textarea class="inp" rows="2" placeholder="Nova'ya sor… (Enter gönderir)" aria-label="Nova'ya mesaj"></textarea><button class="btn primary" aria-label="Gönder">${icon('arrow')}</button></form>
    <label class="astro-att small mute"><input type="checkbox" checked data-img> Tahtanın görüntüsünü de gönder</label></div>`;
  const log = el.querySelector('.astro-log'), ta = el.querySelector('textarea'), form = el.querySelector('form'), sel = el.querySelector('[data-amodel]');
  // quick model switch: models of every provider that has a key
  const fillModels = () => {
    const ps = Object.keys(PROVIDERS).filter(k => getKey(k));
    sel.hidden = !ps.length;
    sel.innerHTML = ps.map(k => `<optgroup label="${PROVIDERS[k].name}">${modelOptions(k, cachedModels(k)).replaceAll('value="', `value="${k}|`)}</optgroup>`).join('');
    sel.value = `${provider()}|${model()}`;
  };
  sel.onchange = () => { const [k, m] = sel.value.split('|'); LS.set('mp.aiProvider', k); setModel(k, m); };
  fillModels();
  const actions = text => `<div class="msg-acts"><button type="button" class="chip" data-pin>📌 Tahtaya iğnele</button><button type="button" class="chip" data-newq>${icon('plus')} Yeni soru yap</button></div>`;
  log.onclick = e => {
    const msg = e.target.closest('.msg'); if (!msg?.dataset.i) return;
    const text = hist[+msg.dataset.i]?.text; if (!text) return;
    if (e.target.closest('[data-pin]')) onPin?.(text);
    if (e.target.closest('[data-newq]')) onNewProblem?.(text);
  };
  const bubble = (role, html) => {
    const d = document.createElement('div'); d.className = `msg ${role}`; d.innerHTML = html;
    log.append(d); log.scrollTop = log.scrollHeight; return d;
  };
  const showAll = () => {
    log.innerHTML = '';
    if (!hist.length) bubble('assistant', `<p>Merhaba! Ben Nova ✦ Tahtana bakıp yardım edebilirim. Aşağıdan bir şey seç ya da sorunu yaz.</p>`);
    hist.forEach((m, i) => { const b = bubble(m.role, m.role === 'user' ? `<p>${esc(m.label || m.text)}</p>` : renderNote(m.text) + actions()); b.dataset.i = i; });
  };
  db.get('ai:' + problem.id).then(h => { hist = Array.isArray(h) ? h : []; showAll(); });

  async function send(text, label) {
    if (ctrl || !text.trim()) return;
    if (!getKey()) { bubble('assistant', `<p>Önce bana bir API anahtarı vermen gerekiyor: <a href="#/settings">Ayarlar → Astronot asistan</a>.</p>`); return; }
    bubble('user', `<p>${esc(label || text)}</p>`);
    const out = bubble('assistant thinking', `<p class="dots"><i></i><i></i><i></i> Nova düşünüyor</p>`);
    el.querySelector('.astro').classList.add('talking'); document.body.classList.add('nova-talking');
    let img = null;
    if (el.querySelector('[data-img]').checked) { try { img = (await getImage())?.split(',')[1] || null; } catch { /* board snapshot is optional */ } }
    const q = { role: 'user', text: `[Ders: ${courseName || '-'} · Konu: ${problem.topic || '-'} · Soru: ${problem.title}]\n${text}`, ...(label && { label }) };
    const turn = [...hist.slice(-20), q];
    ctrl = new AbortController();
    try {
      const r = await ask({ hist: turn, img, signal: ctrl.signal, onText: snap => { out.className = 'msg assistant'; out.innerHTML = renderNote(snap); log.scrollTop = log.scrollHeight; } });
      const reply = r.refused ? 'Bu isteğe yardımcı olamıyorum. Soruyu farklı şekilde sormayı dener misin?' : r.text || '…';
      out.className = 'msg assistant'; out.innerHTML = renderNote(reply) + actions(); out.dataset.i = hist.length + 1;
      hist.push(q, { role: 'assistant', text: reply, by: model() });
      await db.set('ai:' + problem.id, hist.slice(-40));
    } catch (err) {
      if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return;
      out.className = 'msg assistant err'; out.innerHTML = `<p>${esc(friendlyError(err))}</p>`;
    } finally {
      ctrl = null; el.querySelector('.astro')?.classList.remove('talking'); document.body.classList.remove('nova-talking');
    }
  }
  form.onsubmit = e => { e.preventDefault(); const t = ta.value; ta.value = ''; send(t); };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } e.stopPropagation(); };
  el.querySelector('.astro-quick').onclick = e => { const k = e.target.closest('[data-q]')?.dataset.q; if (k) { const a = ACTIONS.find(a => a[0] === k); send(a[2], a[1]); } };
  return () => ctrl?.abort();
}

// ---------- Nova roaming the top of the board on a tether from her ship ----------
// Returns a cleanup function. onOpen() is called when Nova or the ship is clicked.
export function mountRoamer(wrap, onOpen) {
  const layer = document.createElement('div');
  layer.className = 'nova-orbit';
  layer.innerHTML = `<svg class="tether" aria-hidden="true"><path class="tether-line"/><path class="tether-pulse" pathLength="100"/><g class="trail"></g></svg>
    <button class="nova-ship" aria-label="Nova'nın gemisi — Nova'ya sor" title="Nova'ya sor">${ship()}</button>
    <button class="nova-roam" aria-label="Nova'ya sor" title="Nova'ya sor">${astronaut('swim')}</button>`;
  wrap.append(layer);
  const svg = layer.querySelector('.tether'), line = svg.querySelector('.tether-line'), pulse = svg.querySelector('.tether-pulse'), trailG = svg.querySelector('.trail');
  const shipBtn = layer.querySelector('.nova-ship'), nova = layer.querySelector('.nova-roam');
  for (const b of [shipBtn, nova]) b.onclick = () => { nova.classList.remove('hop'); void nova.offsetWidth; nova.classList.add('hop'); onOpen(); };
  // never get in the way of a stroke that starts on the board
  // (a press on Nova/the ship itself must stay clickable, so only presses elsewhere make the layer passive)
  const down = e => { if (!layer.contains(e.target)) layer.classList.add('passive'); }, up = () => layer.classList.remove('passive');
  wrap.addEventListener('pointerdown', down); addEventListener('pointerup', up);

  const trail = Array.from({ length: 7 }, () => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '1.4'); trailG.append(c); return { c, x: 0, y: 0, a: 0 }; });
  let raf = 0, last = performance.now(), px = null, py = null, spin = 0, nextFlip = 14, tTrail = 0, ti = 0;
  const seed = Math.random() * 100;

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = now / 1000 + seed, W = layer.clientWidth, H = layer.clientHeight;
    const sr = shipBtn.getBoundingClientRect(), lr = layer.getBoundingClientRect();
    const port = [sr.left - lr.left + sr.width * 46 / 160, sr.top - lr.top + sr.height * 66 / 90];
    const nw = nova.offsetWidth, nh = nova.offsetHeight;
    let x, y;
    if (!full()) { x = port[0] - nw - 50; y = port[1] - nh / 2 + 10; }
    else {
      // wander the band between the left edge and the ship: two slow sines per axis feel organic
      const left = 24, right = Math.max(left + 60, sr.left - lr.left - nw - 20), cx = (left + right) / 2, ax = (right - left) / 2;
      x = cx + ax * (.78 * Math.sin(t * .075) + .22 * Math.sin(t * .23 + 1.3));
      y = Math.max(8, Math.min(H - nh - 8, H * .42 + (H * .3) * (.7 * Math.sin(t * .17 + .6) + .3 * Math.sin(t * .41))));
    }
    const vx = px == null ? 0 : (x - px) / dt; px = x; py = y;
    if (full()) { nextFlip -= dt; if (nextFlip < 0) { spin = 360; nextFlip = 22 + Math.random() * 18; } }
    spin = Math.max(0, spin - dt * 260);
    const tilt = Math.max(-16, Math.min(16, vx * .25)) + Math.sin(t * .9) * 4;
    nova.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(tilt + (360 - spin) % 360).toFixed(1)}deg)`;

    // tether: from the ship's port to Nova's backpack, sagging and swaying a little
    const bx = x + nw * .5, by = y + nh * .56, dist = Math.hypot(bx - port[0], by - port[1]);
    const mx = (bx + port[0]) / 2 + Math.sin(t * .7) * 12, my = Math.max(by, port[1]) + 16 + dist * .12 + Math.sin(t * 1.1) * 6;
    const d = `M${port[0].toFixed(1)},${port[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
    line.setAttribute('d', d); pulse.setAttribute('d', d);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // stardust from Nova's jetpack
    if (full() && (tTrail += dt) > .35) { tTrail = 0; const p = trail[ti++ % trail.length]; Object.assign(p, { x: bx - Math.sign(vx || 1) * 8, y: by + 6, a: 1 }); }
    for (const p of trail) { p.a = Math.max(0, p.a - dt * .7); p.y += dt * 6; p.c.setAttribute('cx', p.x.toFixed(1)); p.c.setAttribute('cy', p.y.toFixed(1)); p.c.setAttribute('opacity', p.a.toFixed(2)); }
    raf = full() ? requestAnimationFrame(frame) : 0;
  }
  const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
  start(); addEventListener('mp-theme', start); addEventListener('resize', start);
  return () => {
    cancelAnimationFrame(raf); layer.remove();
    wrap.removeEventListener('pointerdown', down); removeEventListener('pointerup', up);
    removeEventListener('mp-theme', start); removeEventListener('resize', start);
  };
}


// ---------- one-shot helpers: auto-tagging a new problem, weekly coaching ----------
const firstJson = t => { const m = /\{[\s\S]*\}/.exec(t || ''); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

// Reads the question photo and suggests { course, topic, title }. Returns null without a key or on any failure.
export async function classify(imgB64, courseNames) {
  if (!getKey() || !imgB64) return null;
  const system = 'Mühendislik sorularını sınıflandıran bir asistansın. Sadece JSON döndür, başka hiçbir şey yazma.';
  const text = `Fotoğraftaki soruyu incele. Şu derslerden en uygun olanı seç (yoksa en yakınını): ${courseNames.join(', ')}.\n`
    + 'JSON biçimi: {"course": "ders adı listeden aynen", "topic": "2-4 kelimelik konu, örn. Thevenin eşdeğeri", "title": "en fazla 6 kelimelik kısa soru başlığı"}';
  try {
    const r = await ask({ hist: [{ role: 'user', text }], img: imgB64, system });
    const j = firstJson(r.text);
    return j && typeof j.course === 'string' ? { course: j.course.trim(), topic: String(j.topic || '').trim().slice(0, 60), title: String(j.title || '').trim().slice(0, 80) } : null;
  } catch { return null; }
}

// Weekly coaching note from study statistics (text only, no images).
export async function coach(summary) {
  const system = `${SYSTEM}\n- Şimdi öğrencinin haftalık çalışma koçusun. Verilen istatistiklere bakarak 4-6 maddelik kısa, somut ve cesaretlendirici bir değerlendirme yaz: neler iyi gidiyor, hangi ders/konu ihmal ediliyor, bu hafta için 3 net öneri (ders + konu + kaç soru). Başlık kullanma.`;
  const r = await ask({ hist: [{ role: 'user', text: summary }], system });
  return r.refused ? null : r.text;
}
