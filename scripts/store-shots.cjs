// Google Play screenshots: fills a throwaway profile with demo data and captures phone and tablet screens into store\.
// Needs the local web server (npm run web) on :5173. Run: npx electron scripts/store-shots.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const URL = 'http://localhost:5173/', OUT = path.join(__dirname, '..', 'store');
const SIZES = { phone: [1080, 1920, 2.625, true], tablet: [2560, 1600, 2, false] }; // px width, px height, pixel ratio, mobile
const SCREENS = [['1-panel', '#/'], ['2-tahta', 'BOARD'], ['3-ders', '#/c/c0'], ['4-simulasyon', '#/sim'], ['5-araclar', '#/tools']];
process.on('unhandledRejection', e => { console.error('FAILED:', e); app.exit(1); });
const wait = ms => new Promise(r => setTimeout(r, ms));
// python's dev server sometimes drops a connection: retry a few times
const load = async (win, url) => { for (let i = 0; ; i++) try { return await win.loadURL(url); } catch (e) { if (i > 4) throw e; await wait(1000); } };

// Runs inside the page: demo courses, problems, study time and one worked circuit problem on the board.
const SEED = async () => {
  const db = await import('/js/db.js'), { renderTo } = await import('/js/board.js'), S = db.S, day = 864e5, now = Date.now();
  const topics = { c0: ['Thevenin', 'Düğüm analizi', 'RC devreleri', 'Fazörler'], c1: ['Diyot', 'BJT', 'Op-amp'], c2: ['Fourier', 'Laplace', 'Konvolüsyon'], c3: ['Gauss yasası', 'Manyetik alan'], c4: ['Kök yer eğrisi', 'Bode'], c5: ['Diferansiyel denklem', 'Matris'] };
  S.problems = []; let n = 0;
  for (const [course, ts] of Object.entries(topics)) for (let i = 0; i < ts.length * 3; i++) {
    const solved = (n * 7) % 10 < 7, at = now - ((n * 5) % 13) * day - 3600e3;
    S.problems.push({ id: 'd' + n, title: `Örnek ${1 + (n % 9)}.${10 + n}`, course, topic: ts[i % ts.length], status: solved ? 'solved' : n % 4 ? 'open' : 'review', created: at - day, updated: at, secs: 300 + (n * 137) % 1500, ...(solved ? { solvedAt: at } : {}) });
    n++;
  }
  const P = S.problems[0]; Object.assign(P, { id: 'demo', title: 'RC devresi: zaman sabiti', topic: 'RC devreleri', status: 'solved', solvedAt: now - 1800e3 });
  for (let d = 0; d < 21; d++) S.time[db.dayKey(now - d * day)] = 1800 + ((d * 977) % 5400);
  S.settings.goal = 6; S.lastBackup = now; // no 'take a backup' banner on the panel
  const W = '#f4f4f5', G = '#5be49b', B = '#5ab0ff', Y = '#ffd166', L = (x1, y1, x2, y2, color = W) => ({ type: 'line', x1, y1, x2, y2, w: 2.5, color });
  const curve = []; for (let t = 0; t <= 60; t++) curve.push(60 + t * 5, 640 - 130 * (1 - Math.exp(-t / 12)), 1);
  const els = [
    { type: 'text', text: 'RC devresi: τ = ?', x: 40, y: 20, size: 30, color: W },
    L(60, 120, 160, 120), { type: 'sym', name: 'resistor', x: 160, y: 105, s: 1, w: 2.5, color: B }, L(220, 120, 360, 120),
    L(360, 120, 360, 185), { type: 'sym', name: 'capacitor', x: 330, y: 200, s: 1, w: 2.5, color: B, rot: 90 }, L(360, 245, 360, 300),
    L(60, 300, 360, 300), L(60, 120, 60, 185), { type: 'sym', name: 'vsource', x: 30, y: 200, s: 1, w: 2.5, color: Y, rot: 90 }, L(60, 245, 60, 300),
    { type: 'text', text: 'R = 2 kΩ', x: 150, y: 70, size: 20, color: B }, { type: 'text', text: 'C = 10 µF', x: 385, y: 205, size: 20, color: B },
    { type: 'text', text: 'Vs = 5 V', x: 85, y: 205, size: 20, color: Y },
    { type: 'text', text: 'τ = R · C = 2 kΩ · 10 µF\nτ = 20 ms', x: 40, y: 340, size: 24, color: W },
    { type: 'rect', x1: 30, y1: 366, x2: 170, y2: 402, w: 2, color: G },
    L(60, 660, 380, 660, '#9ca3af'), L(60, 660, 60, 490, '#9ca3af'), { type: 'stroke', pts: curve, w: 3, color: G },
    { type: 'text', text: 'v_C(t) = 5(1 − e^(−t/τ))', x: 120, y: 470, size: 20, color: G },
  ];
  await db.set('b:demo', els);
  await db.set('t:demo', (await renderTo(els, { box: [360, 230], bg: '#0b0b0e', map: null })).toDataURL('image/jpeg', .7));
  await db.flush();
};

app.on('window-all-closed', () => { }); // the script quits on its own after the last size
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [kind, [w, h, dpr, mobile]] of Object.entries(SIZES)) {
    // Device emulation renders at exact pixel sizes regardless of the real screen size and Windows scaling
    const win = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: { partition: 'store-' + kind } });
    await load(win, URL);
    const cdp = win.webContents.debugger; cdp.attach('1.3');
    await cdp.sendCommand('Emulation.setDeviceMetricsOverride', { width: Math.round(w / dpr), height: Math.round(h / dpr), deviceScaleFactor: dpr, mobile });
    await load(win, URL); await wait(2500);
    await win.webContents.executeJavaScript(`(${SEED})()`);
    for (const [name, hash] of SCREENS) {
      await load(win, URL + (hash === 'BOARD' ? '#/p/demo' : hash)); await wait(3500);
      const { data } = await cdp.sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `${kind}-${name}.png`), Buffer.from(data, 'base64'));
      console.log('ok', kind, name);
    }
    win.destroy();
  }
  // Play feature graphic, 1024x500
  const fw = new BrowserWindow({ width: 800, height: 600, show: false });
  await load(fw, URL + 'store/feature.html');
  const fcdp = fw.webContents.debugger; fcdp.attach('1.3');
  await fcdp.sendCommand('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });
  await wait(2000);
  const { data } = await fcdp.sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'feature-1024x500.png'), Buffer.from(data, 'base64'));
  console.log('ok feature');
  app.quit();
});
