// Nova — the astronaut tutor. Talks to Claude (Anthropic SDK) or Gemini (Google REST) with the student's own API key.
import Anthropic from '../vendor/anthropic.mjs';
import { esc, icon, toast } from './ui.js';
import { renderNote } from './tools.js';
import * as db from './db.js';

// Nova the astronaut, designed by Gemini 4 Neon. Loops (float, visor glint, antenna, wave) live in app.css.
export const astronaut = (cls = '') => `<svg class='astro loop ${cls}' viewBox='0 0 100 124' aria-hidden='true'><defs><clipPath id='astro-visor'><path d='M 50 27.5 C 63.5 27.5 69 32.5 69 42 C 69 51 63 55.5 50 55.5 C 37 55.5 31 51 31 42 C 31 32.5 36.5 27.5 50 27.5 Z'/></clipPath></defs><g class='astro-body'><rect class='a-pack' x='26.5' y='55.5' width='47' height='31' rx='7'/><path class='a-suit' d='M 35 86 L 34.5 104.5 C 32.2 106.5 31.8 110.5 33.5 112.8 C 34.8 114.2 36.8 114.5 39.5 114.5 L 44.5 114.5 C 46.8 114.5 47.5 113 47.5 110.5 L 47.5 86 Z'/><path class='a-line' d='M 34.8 105.2 Q 41 106.6 47.2 105.2'/><rect class='a-line' x='38.2' y='94.5' width='5.6' height='4.6' rx='2'/><path class='a-suit' d='M 65 86 L 65.5 104.5 C 67.8 106.5 68.2 110.5 66.5 112.8 C 65.2 114.2 63.2 114.5 60.5 114.5 L 55.5 114.5 C 53.2 114.5 52.5 113 52.5 110.5 L 52.5 86 Z'/><path class='a-line' d='M 52.8 105.2 Q 59 106.6 65.2 105.2'/><rect class='a-line' x='56.2' y='94.5' width='5.6' height='4.6' rx='2'/><path class='a-suit' d='M 34 67.4 C 27.5 68 23.5 74 22.2 83.5 C 20.5 87.5 22.5 91.8 26.2 91.5 C 29.8 91.2 31.5 88.2 30.5 85 C 31.5 81 32.5 78 34 76.6 Z'/><path class='a-line' d='M 22.5 83.6 Q 26.5 85.4 30.3 85'/><g class='astro-wave'><path class='a-suit' d='M 66 67.4 C 71 67.4 74.5 64 77 58.5 C 75.5 56 76 52.5 79 51 C 82 48.2 87 49 88.2 52.5 C 89.2 55.5 87.5 59 84.5 61 C 82 67.5 76 76 66 76.6 A 4.6 4.6 0 0 1 66 67.4 Z'/><path class='a-line' d='M 77.2 58.6 Q 81.2 58.4 84.3 60.8'/></g><path class='a-suit' d='M 36.5 64 C 34 65 34 69 34 74 L 34.5 85 C 34.5 88.5 37 90 41 90 L 59 90 C 63 90 65.5 88.5 65.5 85 L 66 74 C 66 69 66 65 63.5 64 Z'/><path class='a-line' d='M 34.5 84.5 Q 50 86.2 65.5 84.5'/><rect class='a-fill' x='46.5' y='83.5' width='7' height='3.6' rx='1.4'/><path class='a-line' d='M 30 59.5 C 29 66.5 32.5 74.5 41 75.8'/><rect class='a-suit' x='40.5' y='71' width='19' height='9.6' rx='2.6'/><circle class='a-blink' cx='45' cy='75.8' r='1.6'/><circle class='a-blink' cx='50' cy='75.8' r='1.6'/><circle class='a-fill' cx='55' cy='75.8' r='1.7'/><path class='a-suit' d='M 36.5 58.5 L 63.5 58.5 L 63 64.5 Q 50 68.5 37 64.5 Z'/><rect class='a-suit' x='22.2' y='35' width='6' height='10' rx='3'/><rect class='a-suit' x='71.8' y='35' width='6' height='10' rx='3'/><line class='a-line' x1='50' y1='18.2' x2='50' y2='11.8'/><circle class='a-blink' cx='50' cy='9.2' r='2.6'/><ellipse class='a-suit' cx='50' cy='40' rx='24.5' ry='22'/><path class='a-visor' d='M 50 27.5 C 63.5 27.5 69 32.5 69 42 C 69 51 63 55.5 50 55.5 C 37 55.5 31 51 31 42 C 31 32.5 36.5 27.5 50 27.5 Z'/><g clip-path='url(#astro-visor)'><rect class='a-glint' x='38' y='24' width='8' height='35' transform='rotate(18 42 41.5)'/></g><path class='a-shine' d='M 36.5 39 C 36.5 35 39.5 32.5 44.5 32'/></g></svg>`;

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
async function ask({ hist, img, onText, signal }) {
  const p = provider(), m = model(p), key = getKey(p);
  const lastText = hist.at(-1).text;
  if (p === 'gemini') {
    const contents = hist.map((h, i) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [...(i === hist.length - 1 && img ? [{ inline_data: { mime_type: 'image/jpeg', data: img } }] : []), { text: h.text }],
    }));
    const res = await fetch(`${GEMINI}/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { maxOutputTokens: 8192 } }),
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
    model: m, max_tokens: 16000, system: SYSTEM, messages,
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
export function mountTutor(el, { problem, courseName, getImage }) {
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
  const bubble = (role, html) => {
    const d = document.createElement('div'); d.className = `msg ${role}`; d.innerHTML = html;
    log.append(d); log.scrollTop = log.scrollHeight; return d;
  };
  const showAll = () => {
    log.innerHTML = '';
    if (!hist.length) bubble('assistant', `<p>Merhaba! Ben Nova ✦ Tahtana bakıp yardım edebilirim. Aşağıdan bir şey seç ya da sorunu yaz.</p>`);
    for (const m of hist) bubble(m.role, m.role === 'user' ? `<p>${esc(m.label || m.text)}</p>` : renderNote(m.text));
  };
  db.get('ai:' + problem.id).then(h => { hist = Array.isArray(h) ? h : []; showAll(); });

  async function send(text, label) {
    if (ctrl || !text.trim()) return;
    if (!getKey()) { bubble('assistant', `<p>Önce bana bir API anahtarı vermen gerekiyor: <a href="#/settings">Ayarlar → Astronot asistan</a>.</p>`); return; }
    bubble('user', `<p>${esc(label || text)}</p>`);
    const out = bubble('assistant thinking', `<p class="dots"><i></i><i></i><i></i> Nova düşünüyor</p>`);
    el.querySelector('.astro').classList.add('talking');
    let img = null;
    if (el.querySelector('[data-img]').checked) { try { img = (await getImage())?.split(',')[1] || null; } catch { /* board snapshot is optional */ } }
    const q = { role: 'user', text: `[Ders: ${courseName || '-'} · Konu: ${problem.topic || '-'} · Soru: ${problem.title}]\n${text}`, ...(label && { label }) };
    const turn = [...hist.slice(-20), q];
    ctrl = new AbortController();
    try {
      const r = await ask({ hist: turn, img, signal: ctrl.signal, onText: snap => { out.className = 'msg assistant'; out.innerHTML = renderNote(snap); log.scrollTop = log.scrollHeight; } });
      const reply = r.refused ? 'Bu isteğe yardımcı olamıyorum. Soruyu farklı şekilde sormayı dener misin?' : r.text || '…';
      out.className = 'msg assistant'; out.innerHTML = renderNote(reply);
      hist.push(q, { role: 'assistant', text: reply, by: model() });
      await db.set('ai:' + problem.id, hist.slice(-40));
    } catch (err) {
      if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return;
      out.className = 'msg assistant err'; out.innerHTML = `<p>${esc(friendlyError(err))}</p>`;
    } finally {
      ctrl = null; el.querySelector('.astro')?.classList.remove('talking');
    }
  }
  form.onsubmit = e => { e.preventDefault(); const t = ta.value; ta.value = ''; send(t); };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } e.stopPropagation(); };
  el.querySelector('.astro-quick').onclick = e => { const k = e.target.closest('[data-q]')?.dataset.q; if (k) { const a = ACTIONS.find(a => a[0] === k); send(a[2], a[1]); } };
  return () => ctrl?.abort();
}
