// Storage: IndexedDB key-value. 'meta' = courses/problems/stats, 'b:<id>' = board, 't:<id>' = thumbnail.
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
let dbp;
const db = () => dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open('mathpad', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const store = async mode => (await db()).transaction('kv', mode).objectStore('kv');
export const get = async k => req((await store('readonly')).get(k));
export const set = async (k, v) => req((await store('readwrite')).put(v, k));
export const del = async k => req((await store('readwrite')).delete(k));
export async function entries() {
  const s = await store('readonly');
  const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
  return keys.map((k, i) => [k, vals[i]]);
}
export async function replaceAll(list) {
  const s = await store('readwrite');
  await req(s.clear());
  await Promise.all(list.map(([k, v]) => req(s.put(v, k))));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('sv'); // YYYY-MM-DD, local time

// ---------- app state ----------
export const S = { version: 2, courses: [], problems: [], time: {}, pomos: {}, notes: {}, settings: { goal: 10 }, trash: [], lastBackup: 0, lastAutoBackup: '' };

export async function load() {
  const m = await get('meta');
  if (m) Object.assign(S, m); else seed();
  migrate();
  await purgeTrash(e => Date.now() - e.at > TRASH_DAYS * 864e5);
  navigator.storage?.persist?.(); // ask browser not to evict data
}
// Upgrade older saved data in place. Add a step here whenever the data shape changes.
export const GLYPHS = ['Σ', '∫', '∂', '∇', 'Ω', '∿', 'λ', 'π', 'μ', 'θ', '⚡', '∞'];
export const PALETTE = ['#f4f4f5', '#7dd3fc', '#c4b5fd', '#fca5a5', '#86efac', '#fde68a', '#f9a8d4', '#5eead4'];
// every course gets a glyph and a colour (its identity in menus, cards and the sky)
export const courseDefaults = (c, i = S.courses.indexOf(c)) => { c.icon ??= GLYPHS[(i < 0 ? S.courses.length : i) % GLYPHS.length]; c.color ??= PALETTE[(i < 0 ? S.courses.length : i) % PALETTE.length]; return c; };
function migrate() {
  S.trash ??= []; S.settings ??= { goal: 10 }; S.badges ??= {};
  S.courses.forEach((c, i) => courseDefaults(c, i));
  S.version = 2;
}
let timer;
export const flush = () => { clearTimeout(timer); return set('meta', S); };
export const persist = () => { clearTimeout(timer); timer = setTimeout(flush, 400); dispatchEvent(new Event('mp-changed')); };
addEventListener('visibilitychange', () => document.hidden && flush());

export const courseOf = p => S.courses.find(c => c.id === p.course);
export const topicsOf = cid => [...new Set(S.problems.filter(p => !cid || p.course === cid).map(p => p.topic).filter(Boolean))];

// ---------- trash: deletes are reversible for 30 days; drawings stay stored until purge ----------
export const TRASH_DAYS = 30;
export function removeProblem(id) {
  const p = S.problems.find(p => p.id === id); if (!p) return null;
  S.problems = S.problems.filter(x => x !== p);
  const e = { kind: 'problem', at: Date.now(), item: p };
  S.trash.unshift(e); persist(); return e;
}
export function removeCourse(c) {
  const ps = S.problems.filter(p => p.course === c.id);
  S.problems = S.problems.filter(p => p.course !== c.id);
  S.courses = S.courses.filter(x => x.id !== c.id);
  const e = { kind: 'course', at: Date.now(), item: c, problems: ps, note: S.notes[c.id] };
  delete S.notes[c.id];
  S.trash.unshift(e); persist(); return e;
}
export function restoreTrash(e) {
  S.trash = S.trash.filter(x => x !== e);
  if (e.kind === 'course') {
    const now = Date.now(); // a restore is a newer edit than the deletion (matters for sync)
    S.courses.push({ ...e.item, updated: now }); S.problems.unshift(...e.problems.map(p => ({ ...p, updated: now })));
    if (e.note) S.notes[e.item.id] = e.note;
  } else {
    // its course may have been deleted meanwhile → put it in the first course
    const p = { ...e.item, updated: Date.now(), course: S.courses.some(c => c.id === e.item.course) ? e.item.course : S.courses[0]?.id };
    if (!p.course) { S.trash.unshift(e); return null; }
    S.problems.unshift(p);
  }
  persist(); return e;
}
export async function purgeTrash(which = () => true) {
  const gone = S.trash.filter(which);
  if (!gone.length) return 0;
  S.trash = S.trash.filter(e => !which(e));
  S.gone ??= {};
  for (const e of gone) {
    S.gone[e.item.id] = Date.now(); // tombstone so other synced devices delete it too
    for (const p of e.kind === 'course' ? e.problems : [e.item]) { S.gone[p.id] = Date.now(); await del('b:' + p.id); await del('t:' + p.id); }
  }
  persist(); return gone.length;
}

// ---------- share one course as a .mathpad file; import merges, never overwrites ----------
export async function exportCourse(cid) {
  await flush();
  const c = S.courses.find(x => x.id === cid), ps = S.problems.filter(p => p.course === cid), data = [];
  for (const p of ps) data.push(['b:' + p.id, await get('b:' + p.id)], ['t:' + p.id, await get('t:' + p.id)]);
  return JSON.stringify({ app: 'mathpad', v: 1, kind: 'course', at: Date.now(), course: c, problems: ps, note: S.notes[cid] || '', data });
}
export async function importCourse(o) {
  const names = new Set(S.courses.map(c => c.name));
  let name = o.course.name; for (let i = 2; names.has(name); i++) name = `${o.course.name} (${i})`;
  const nc = { id: uid(), name }, ids = {};
  for (const p of o.problems) ids[p.id] = uid() + Math.random().toString(36).slice(2, 5);
  for (const [k, v] of o.data || []) { const id = ids[k.slice(2)]; if (id && v != null) await set(k[0] + ':' + id, v); }
  S.courses.push(nc);
  if (o.note) S.notes[nc.id] = o.note;
  S.problems.unshift(...o.problems.map(p => ({ ...p, id: ids[p.id], course: nc.id })));
  persist(); return nc;
}

function seed() {
  const names = ['Devre Analizi', 'Elektronik', 'Sinyaller ve Sistemler', 'Elektromanyetik', 'Kontrol Sistemleri', 'Mühendislik Matematiği'];
  S.courses = names.map((name, i) => ({ id: 'c' + i, name }));
  S.notes = {
    c0: String.raw`# Temel
- Ohm: $V = IR$, güç: $P = VI = I^2R = \dfrac{V^2}{R}$
- Seri: $R_{eş} = R_1 + R_2$, paralel: $R_{eş} = \dfrac{R_1R_2}{R_1+R_2}$
- Gerilim bölücü: $V_2 = V\dfrac{R_2}{R_1+R_2}$
# AC
- Empedans: $Z_R = R$, $Z_L = j\omega L$, $Z_C = \dfrac{1}{j\omega C}$
- Kompleks güç: $S = V_{rms} I_{rms}^* = P + jQ$
# Geçici durum
$$x(t) = x(\infty) + [x(0^+) - x(\infty)]e^{-t/\tau}, \quad \tau_{RC} = RC,\ \tau_{RL} = L/R$$`,
    c1: String.raw`# Diyot
- $I_D = I_S\left(e^{V_D/(nV_T)} - 1\right)$, $V_T \approx 25.9\,mV$
# BJT
- $I_C = \beta I_B$, $I_E = (\beta+1) I_B$, $g_m = I_C/V_T$, $r_\pi = \beta/g_m$
# Op-amp
- Evirmeyen: $A = 1 + \dfrac{R_f}{R_1}$, eviren: $A = -\dfrac{R_f}{R_1}$`,
    c2: String.raw`# Fourier
$$X(j\omega) = \int_{-\infty}^{\infty} x(t)e^{-j\omega t}\,dt$$
# Laplace
- $\mathcal{L}\{e^{-at}u(t)\} = \dfrac{1}{s+a}$, $\mathcal{L}\{\sin\omega t\} = \dfrac{\omega}{s^2+\omega^2}$
# Konvolüsyon
$$y(t) = x(t) * h(t) = \int x(\tau)h(t-\tau)\,d\tau$$`,
    c3: String.raw`# Maxwell
- $\nabla\cdot\mathbf{D} = \rho_v$, $\nabla\cdot\mathbf{B} = 0$
- $\nabla\times\mathbf{E} = -\dfrac{\partial\mathbf{B}}{\partial t}$, $\nabla\times\mathbf{H} = \mathbf{J} + \dfrac{\partial\mathbf{D}}{\partial t}$
# Coulomb
$$\mathbf{F} = \frac{Q_1Q_2}{4\pi\varepsilon_0 R^2}\hat{a}_R$$`,
    c4: String.raw`# 2. derece sistem
$$G(s) = \frac{\omega_n^2}{s^2 + 2\zeta\omega_n s + \omega_n^2}$$
- Aşım: $M_p = e^{-\zeta\pi/\sqrt{1-\zeta^2}}$, yerleşme: $t_s \approx \dfrac{4}{\zeta\omega_n}$
- Kapalı çevrim: $T(s) = \dfrac{G}{1+GH}$`,
    c5: String.raw`# Euler
- $e^{j\theta} = \cos\theta + j\sin\theta$
# Türev / integral
- $(uv)' = u'v + uv'$, $\int u\,dv = uv - \int v\,du$
# Lineer cebir
- $A\mathbf{x} = \mathbf{b}$, $\det(A - \lambda I) = 0$`,
  };
}

// ---------- backup ----------
export async function exportJSON() {
  await flush();
  return JSON.stringify({ app: 'mathpad', v: 1, at: Date.now(), data: await entries() });
}
export async function importJSON(text) {
  const o = JSON.parse(text);
  if (o?.app !== 'mathpad' || !Array.isArray(o.data) || o.kind) throw new Error('Bu bir MathPad yedeği değil');
  await replaceAll(o.data);
}
