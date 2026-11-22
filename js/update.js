// "Check for updates" for every platform: desktop (electron-updater), Android (GitHub release APK), web (service worker).
export const VERSION = '1.14.1'; // keep equal to package.json (tests/update.test.mjs checks)
const REPO = 'Emirhanbaba31/mathpad';

// true when version string a is newer than b ('v1.10.0' > '1.9.2')
export const newer = (a, b) => {
  const p = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

export const platform = () => window.desktop ? 'desktop' : window.Capacitor?.isNativePlatform?.() ? 'android' : 'web';

// Returns { msg, action? } for a toast.
export async function check() {
  const where = platform();
  if (where === 'desktop') {
    const v = await window.desktop.checkUpdate();
    return v && newer(v, VERSION) ? { msg: `${v} bulundu, arka planda iniyor. Hazır olunca yeniden başlat düğmesi çıkar.` } : { msg: 'MathPad güncel ✦' };
  }
  if (where === 'android') {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!r.ok) throw new Error('GitHub\'a ulaşılamadı, internetini kontrol et');
    const rel = await r.json();
    const apk = rel.assets?.find(a => a.name.endsWith('.apk'));
    if (!apk || !newer(rel.tag_name, VERSION)) return { msg: 'MathPad güncel ✦' };
    // the Android shell hands non-app URLs to the system browser, which downloads the APK
    return { msg: `${rel.tag_name.replace(/^v/, '')} çıktı`, action: { label: 'APK\'yı indir', run: () => { location.href = apk.browser_download_url; } } };
  }
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg) return { msg: 'Sayfayı yenileyince en son sürüm gelir' };
  await reg.update();
  if (!reg.installing && !reg.waiting) return { msg: 'MathPad güncel ✦' };
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  return { msg: 'Yeni sürüm yükleniyor, sayfa birazdan yenilenecek…' };
}
