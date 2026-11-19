// MathPad desktop shell. Serves the web app from app://mathpad/ so IndexedDB, modules and the service worker behave like a normal site.
const { app, BrowserWindow, protocol, net, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null, pendingFile = null;
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
const backupArg = argv => argv.slice(1).find(a => /\.mathpad$/i.test(a) && fs.existsSync(a));

function readBackup(file) {
  try { return { name: path.basename(file), text: fs.readFileSync(file, 'utf8') }; } catch { return null; }
}
function sendFile(file) {
  const f = file && readBackup(file);
  if (!f) return;
  if (win && !win.webContents.isLoading()) win.webContents.send('open-file', f); else pendingFile = f;
}

function createWindow() {
  let st = {};
  try { st = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { }
  win = new BrowserWindow({
    width: st.width || 1320, height: st.height || 860, x: st.x, y: st.y,
    minWidth: 380, minHeight: 560, show: false, title: 'MathPad', backgroundColor: '#000000',
    icon: path.join(ROOT, 'icons', 'icon-512.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#000000', symbolColor: '#f4f4f5', height: 34 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false },
  });
  if (st.max) win.maximize();
  // 'ready-to-show' alone is not reliable in the packaged app (it may never fire → invisible window); show on whichever comes first.
  const reveal = () => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); };
  win.once('ready-to-show', reveal);
  win.webContents.once('did-finish-load', reveal);
  setTimeout(reveal, 3000);
  if (process.env.MATHPAD_DEBUG) for (const ev of ['ready-to-show', 'show', 'unresponsive'])
    win.on(ev, () => console.log('[win]', ev));
  if (process.env.MATHPAD_DEBUG) for (const ev of ['did-finish-load', 'dom-ready', 'did-fail-load', 'render-process-gone'])
    win.webContents.on(ev, (...a) => console.log('[web]', ev, a.slice(1, 3).map(String).join(' ')));
  win.on('close', () => {
    try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch { }
  });
  win.webContents.on('did-finish-load', () => { if (pendingFile) { win.webContents.send('open-file', pendingFile); pendingFile = null; } });
  // external links open in the real browser; the app never navigates away from itself
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://mathpad/')) e.preventDefault(); });
  win.loadURL('app://mathpad/index.html' + (process.env.MATHPAD_SELFTEST_HASH || ''));
}

app.on('second-instance', (_e, argv) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  sendFile(backupArg(argv));
});

app.whenReady().then(() => {
  protocol.handle('app', req => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  ipcMain.handle('info', () => ({ version: app.getVersion(), dataDir: app.getPath('userData'), packaged: app.isPackaged }));
  ipcMain.handle('open-data-dir', () => shell.openPath(app.getPath('userData')));
  // Daily automatic backup: Documents\MathPad\Yedekler\mathpad-YYYY-MM-DD.mathpad, newest 7 kept.
  const backupDir = () => { const d = path.join(app.getPath('documents'), 'MathPad', 'Yedekler'); fs.mkdirSync(d, { recursive: true }); return d; };
  ipcMain.handle('auto-backup', (_e, json) => {
    if (typeof json !== 'string' || !json.startsWith('{"app":"mathpad"')) throw new Error('invalid backup');
    const dir = backupDir(), name = `mathpad-${new Date().toLocaleDateString('sv')}.mathpad`;
    fs.writeFileSync(path.join(dir, name + '.tmp'), json);
    fs.renameSync(path.join(dir, name + '.tmp'), path.join(dir, name)); // never leave a half-written backup
    const old = fs.readdirSync(dir).filter(f => /^mathpad-\d{4}-\d\d-\d\d\.mathpad$/.test(f)).sort().slice(0, -7);
    for (const f of old) fs.unlinkSync(path.join(dir, f));
    return dir;
  });
  ipcMain.handle('open-backups', () => shell.openPath(backupDir()));
  ipcMain.handle('uninstall', () => {
    const exe = path.join(path.dirname(process.execPath), 'Uninstall MathPad.exe');
    if (!app.isPackaged || !fs.existsSync(exe)) return false;
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 300);
    return true;
  });

  createWindow();
  sendFile(backupArg(process.argv));

  // Self-test for development: MATHPAD_SELFTEST=<png path> → log console errors, screenshot, quit.
  const shot = process.env.MATHPAD_SELFTEST;
  if (shot) {
    win.webContents.on('console-message', (_e, level, msg) => level >= 2 && console.log('[renderer]', msg));
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      const r = await win.webContents.executeJavaScript(`document.getElementById('kaldir')?.scrollIntoView(); JSON.stringify({ page: document.body.dataset.page, uninstallBtn: !!document.querySelector('[data-uninstall]'), desktop: document.body.classList.contains('desktop'), math: typeof math, idb: !!indexedDB, courses: document.querySelectorAll('.nav-sub:not(.add)').length })`);
      console.log('[selftest]', r);
      fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
      app.quit();
    }, 2500));
  }
});

app.on('window-all-closed', () => app.quit());
