// Google Drive sync. Data lives in the app's hidden Drive folder (appDataFolder): one meta.json plus one file per problem board.
// Sign-in uses Google's device flow (a short code typed at google.com/device), which works the same in the browser,
// the Windows app and the Android app. Tokens stay on this device (localStorage), never in backups.
import * as db from './db.js';
import { mergeMeta } from './merge.js';

const { S } = db;
// The MathPad Google client ("TVs and limited input devices"). For installed apps Google treats the secret as public.
export const BUILTIN = { id: '', secret: '' };
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
export const client = () => { const c = LS.get('mp.gd.client'); return c?.id ? c : BUILTIN; };
export const setClient = (id, secret) => LS.set('mp.gd.client', id ? { id: id.trim(), secret: (secret || '').trim() } : null);
export const connected = () => !!LS.get('mp.gd.tok')?.refresh;
export const status = () => LS.get('mp.gd.status') || {};
const setStatus = s => { LS.set('mp.gd.status', { ...status(), ...s }); dispatchEvent(new Event('mp-sync')); };

async function form(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, j };
}

// ---------- sign-in (device flow) ----------
export async function startSignIn() {
  const c = client(); if (!c.id) throw new Error('Önce Google istemci kimliğini gir.');
  const { ok, j } = await form('https://oauth2.googleapis.com/device/code', { client_id: c.id, scope: SCOPE });
  if (!ok) throw new Error(j.error_description || j.error || 'Google bağlantısı başlatılamadı');
  return j; // { device_code, user_code, verification_url, interval, expires_in }
}
// Polls until the user approves on google.com/device. Resolves true on success, false when cancelled/expired.
export async function finishSignIn(dc, signal) {
  const c = client(); let wait = (dc.interval || 5) * 1000;
  const until = Date.now() + dc.expires_in * 1000;
  while (Date.now() < until && !signal?.aborted) {
    await new Promise(r => setTimeout(r, wait));
    const { ok, j } = await form('https://oauth2.googleapis.com/token', { client_id: c.id, client_secret: c.secret, device_code: dc.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
    if (ok) { LS.set('mp.gd.tok', { access: j.access_token, exp: Date.now() + j.expires_in * 1000, refresh: j.refresh_token }); return true; }
    if (j.error === 'slow_down') wait += 5000;
    else if (j.error !== 'authorization_pending') throw new Error(j.error === 'access_denied' ? 'Google girişi reddedildi.' : j.error_description || j.error);
  }
  return false;
}
export async function disconnect() {
  const t = LS.get('mp.gd.tok');
  if (t?.refresh) form('https://oauth2.googleapis.com/revoke', { token: t.refresh }).catch(() => { });
  LS.set('mp.gd.tok', null); LS.set('mp.gd.status', null);
  await db.del('sync:base'); await db.del('sync:boards');
}

async function token() {
  const t = LS.get('mp.gd.tok'); if (!t?.refresh) throw new Error('Google Drive bağlı değil');
  if (t.access && t.exp > Date.now() + 60e3) return t.access;
  const c = client();
  const { ok, j } = await form('https://oauth2.googleapis.com/token', { client_id: c.id, client_secret: c.secret, refresh_token: t.refresh, grant_type: 'refresh_token' });
  if (!ok) { if (j.error === 'invalid_grant') LS.set('mp.gd.tok', null); throw new Error(j.error === 'invalid_grant' ? 'Google oturumu sona erdi, yeniden bağlan.' : j.error_description || j.error); }
  LS.set('mp.gd.tok', { ...t, access: j.access_token, exp: Date.now() + j.expires_in * 1000 });
  return j.access_token;
}

// ---------- Drive REST ----------
const DRIVE = 'https://www.googleapis.com';
async function api(path, opts = {}, retry = true) {
  const res = await fetch(DRIVE + path, { ...opts, headers: { ...opts.headers, authorization: 'Bearer ' + await token() } });
  if (res.status === 401 && retry) { const t = LS.get('mp.gd.tok'); if (t) LS.set('mp.gd.tok', { ...t, exp: 0 }); return api(path, opts, false); }
  if (!res.ok) throw new Error(`Drive hatası ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res;
}
async function listFiles() {
  const files = []; let page = '';
  do {
    const r = await (await api(`/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,appProperties)${page ? '&pageToken=' + page : ''}`)).json();
    files.push(...r.files); page = r.nextPageToken;
  } while (page);
  return new Map(files.map(f => [f.name, f]));
}
async function upload(name, data, props, existing) {
  const meta = existing ? { appProperties: props } : { name, parents: ['appDataFolder'], appProperties: props };
  const b = 'mathpad' + Math.random().toString(36).slice(2);
  const body = `--${b}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\ncontent-type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${b}--`;
  const r = await api(existing ? `/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,appProperties` : '/upload/drive/v3/files?uploadType=multipart&fields=id,name,appProperties',
    { method: existing ? 'PATCH' : 'POST', headers: { 'content-type': `multipart/related; boundary=${b}` }, body });
  return r.json();
}
const download = async f => (await api(`/drive/v3/files/${f.id}?alt=media`)).json();
const remove = f => api(`/drive/v3/files/${f.id}`, { method: 'DELETE' }).catch(() => { });

// ---------- local change tracking ----------
const DIRTY = 'mp.gd.dirty';
export function markDirty(id) { const d = new Set(LS.get(DIRTY) || []); d.add(id); LS.set(DIRTY, [...d]); later(); }
let timer = 0;
export function later(ms = 20e3) { if (!connected()) return; clearTimeout(timer); timer = setTimeout(() => sync().catch(() => { }), ms); }

const META_KEYS = ['version', 'courses', 'problems', 'time', 'pomos', 'notes', 'settings', 'trash', 'badges', 'coach', 'gone'];
const pickMeta = o => Object.fromEntries(META_KEYS.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

// ---------- the sync ----------
let running = null;
export function sync(opts) { return running ??= run(opts).finally(() => { running = null; }); }

async function run({ openProblem } = {}) {
  if (!connected()) return { changed: false };
  setStatus({ state: 'busy' });
  try {
    await db.flush();
    const files = await listFiles();
    const base = await db.get('sync:base');
    const remoteMeta = files.has('meta.json') ? await download(files.get('meta.json')) : null;
    const merged = mergeMeta(base, pickMeta(S), remoteMeta && pickMeta(remoteMeta));
    const localChanged = JSON.stringify(pickMeta(S)) !== JSON.stringify(merged);
    Object.assign(S, merged);
    if (localChanged) await db.flush();

    // boards: version = problem.updated when the board was last uploaded/downloaded
    const known = (await db.get('sync:boards')) || {};
    const dirty = new Set(LS.get(DIRTY) || []);
    const alive = new Set(S.problems.map(p => p.id).concat(S.trash.flatMap(e => e.kind === 'course' ? e.problems.map(p => p.id) : [e.item.id])));
    let boardsIn = 0, boardsOut = 0;
    for (const id of alive) {
      const f = files.get(`p-${id}.json`), rv = +(f?.appProperties?.v || 0), kv = known[id] || 0;
      const p = S.problems.find(x => x.id === id), lv = p?.updated || kv;
      const remoteNewer = f && rv > kv, localNewer = dirty.has(id) || (!f && (await db.get('b:' + id)) != null);
      if (remoteNewer && (!localNewer || rv >= lv) && id !== openProblem) {
        const d = await download(f);
        await db.set('b:' + id, d.board ?? null); await db.set('t:' + id, d.thumb ?? null); if (d.ai) await db.set('ai:' + id, d.ai);
        known[id] = rv; dirty.delete(id); boardsIn++;
      } else if (localNewer) {
        const v = Math.max(lv, rv + 1, Date.now());
        await upload(`p-${id}.json`, { board: await db.get('b:' + id), thumb: await db.get('t:' + id), ai: await db.get('ai:' + id) }, { v: String(v) }, f);
        known[id] = v; dirty.delete(id); boardsOut++;
      }
    }
    // drop boards of problems deleted for good (here or on another device)
    for (const [name, f] of files) {
      const id = name.match(/^p-(.+)\.json$/)?.[1];
      if (id && !alive.has(id)) { await remove(f); delete known[id]; await db.del('b:' + id); await db.del('t:' + id); await db.del('ai:' + id); }
    }
    await upload('meta.json', pickMeta(S), { v: String(Date.now()) }, files.get('meta.json'));
    await db.set('sync:base', JSON.parse(JSON.stringify(pickMeta(S))));
    await db.set('sync:boards', known);
    LS.set(DIRTY, [...dirty]);
    setStatus({ state: 'ok', at: Date.now(), error: null });
    return { changed: localChanged || boardsIn > 0, boardsIn, boardsOut };
  } catch (err) {
    setStatus({ state: 'error', error: err.message });
    throw err;
  }
}
