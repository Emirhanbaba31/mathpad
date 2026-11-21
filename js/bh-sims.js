// MathPad Kara Delik Etkileşimli Simülasyonları (Part 3 of 4)
// 10 canlı genel görelilik simülasyonu + saf hesaplama yardımcıları.
// Tüm fizik formülleri ve sabitleri Part 1'deki js/bh-core.js modülünden içe aktarılır.
// Modül sözleşmesi: export const SIMS = [{ id, field: 'karadelik', title, icon, desc, mount(host, ctx) -> cleanupFn }];

import * as BH from './bh-core.js';

const _isDomRuntime = typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && typeof matchMedia === 'function';

const [_uiMod, _fxMod, _physUiMod, _toolsMod] = _isDomRuntime
  ? await Promise.all([
      import('./ui.js'),
      import('./fx.js'),
      import('./phys-ui.js'),
      import('./tools.js'),
    ])
  : [null, null, null, null];

const esc = _uiMod?.esc
  ?? (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const icon = _uiMod?.icon
  ?? ((name, cls = '') => `<span class="i ${cls}" data-icon="${name}" aria-hidden="true"></span>`);
const motion = _fxMod?.motion ?? (() => 'full');
const asleep = _fxMod?.asleep ?? (() => false);
const syncSegments = _fxMod?.syncSegments ?? (() => {});
const tex = _physUiMod?.tex ?? (s => `<span class="mono">${esc(s)}</span>`);
const richTex = _physUiMod?.richTex ?? (s => esc(String(s ?? '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));
const accentColor = _physUiMod?.accentColor ?? (() => '#60a5fa');
const createClean = _physUiMod?.createClean ?? (ctx => {
  const fns = [];
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    while (fns.length) {
      try { fns.pop()(); } catch { }
    }
  };
  ctx?.clean?.add?.(run);
  return { add(fn) { if (typeof fn === 'function') fns.push(fn); }, run };
});
const setupCanvas = _physUiMod?.setupCanvas ?? ((cv, heightForWidth, onDraw, clean) => {
  const W = 320;
  const H = Math.max(180, Math.floor(heightForWidth(W)));
  const render = () => {
    const c2d = cv?.getContext?.('2d');
    if (c2d) onDraw(c2d, W, H);
  };
  clean?.add?.(() => {});
  render();
  return { render, resize: render, size: () => ({ W, H }) };
});
const createAnimLoop = _physUiMod?.createAnimLoop ?? ((tick, clean) => {
  let want = false;
  let dead = false;
  const start = () => {
    if (dead || want) return;
    want = true;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(now => {
        if (!dead && want && !asleep()) want = !!tick(now, 1 / 60);
      });
    } else {
      want = false;
    }
  };
  const stop = () => { want = false; };
  clean?.add?.(() => { dead = true; stop(); });
  return { start, stop, isRunning: () => want };
});
const PLOT_COLORS = _toolsMod?.PLOT_COLORS ?? ['#f4f4f5', '#5ab0ff', '#ff6b6b', '#5be49b', '#ffd166', '#c084fc'];

function ensureBhSimsCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[href*="bh-sims.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/bh-sims.css';
  document.head.append(link);
}

// =====================================================================
// 1. SABİTLER, RENK VE BİÇİMLENDİRME YARDIMCILARI (SAF)
// =====================================================================

export const B_CRIT_M = 3 * Math.sqrt(3);
export const L_ISCO_M = 2 * Math.sqrt(3);
export const PLANCK_TIME = Math.sqrt((BH.HBAR * BH.G) / Math.pow(BH.C, 5));
export const PLANCK_MASS = Math.sqrt((BH.HBAR * BH.C) / BH.G);
export const EV_J = 1.602176634e-19;
export const T_CMB = 2.725;
export const GPS_ORBIT_RADIUS_M = 2.656175e7; // GPS yarı-büyük ekseni (~20.190 km irtifa)
export const MERCURY_A_M = 5.790905e10;
export const MERCURY_E = 0.205630;
export const MERCURY_PERIOD_DAYS = 87.9691;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a, b, t) => a + (b - a) * t;

const COL_FG = '#f4f4f5';
const COL_MUTE = '#8b8b94';
const COL_GRID = 'rgba(255,255,255,.08)';
const COL_AXIS = 'rgba(255,255,255,.26)';
const COL_OK = '#5be49b';
const COL_WARN = '#ffd166';
const COL_BAD = '#ff6b6b';
const COL_BLUE = '#5ab0ff';
const COL_PURP = '#c084fc';
const COL_CYAN = '#38bdf8';

function rgbCss({ r, g, b }, alpha = 1) {
  const R = Math.round(clamp(r, 0, 1) * 255);
  const G = Math.round(clamp(g, 0, 1) * 255);
  const B = Math.round(clamp(b, 0, 1) * 255);
  return alpha >= 0.999 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${alpha.toFixed(3)})`;
}

/** Dalga boyunu (nm) görünür tayf RGB rengine ve elektromanyetik bant bilgisine eşler. */
export function wavelengthNmToRGB(nm) {
  if (!(nm > 0) || !Number.isFinite(nm)) {
    return { r: 0.2, g: 0.2, b: 0.25, css: 'rgb(51,51,64)', band: '—', visible: false };
  }
  const band = BH.classifySpectralBand(nm * 1e-9);
  let r = 0, g = 0, b = 0;
  let visible = false;
  if (nm >= 380 && nm <= 750) {
    visible = true;
    if (nm < 440) {
      r = -(nm - 440) / 60;
      g = 0;
      b = 1;
    } else if (nm < 490) {
      r = 0;
      g = (nm - 440) / 50;
      b = 1;
    } else if (nm < 510) {
      r = 0;
      g = 1;
      b = -(nm - 510) / 20;
    } else if (nm < 580) {
      r = (nm - 510) / 70;
      g = 1;
      b = 0;
    } else if (nm < 645) {
      r = 1;
      g = -(nm - 645) / 65;
      b = 0;
    } else {
      r = 1;
      g = 0;
      b = 0;
    }
    let factor = 1;
    if (nm < 420) factor = 0.35 + 0.65 * ((nm - 380) / 40);
    else if (nm > 700) factor = 0.25 + 0.75 * ((750 - nm) / 50);
    r = Math.pow(clamp(r * factor, 0, 1), 0.8);
    g = Math.pow(clamp(g * factor, 0, 1), 0.8);
    b = Math.pow(clamp(b * factor, 0, 1), 0.8);
  } else if (nm < 380) {
    const fade = clamp(Math.exp(-(380 - nm) / 260), 0.22, 0.75);
    r = 0.56 * fade;
    g = 0.28 * fade;
    b = 0.98 * fade;
  } else {
    const decades = Math.log10(nm / 750);
    const fade = clamp(Math.exp(-decades * 1.15), 0.14, 0.62);
    r = 0.88 * fade;
    g = 0.12 * fade;
    b = 0.10 * fade;
  }
  return { r, g, b, css: rgbCss({ r, g, b }), band, visible };
}

/** Süreyi (s) okunaklı Türkçe birimle biçimlendirir (Planck zamanından 10¹⁰⁰ yıla kadar). */
export function formatTimeTR(seconds) {
  if (seconds === Infinity) return '∞';
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds === 0) return '0 s';
  if (seconds < 1e-12) return `${BH.formatSciTR(seconds, 2, { forceSci: true })} s`;
  if (seconds < 1e-6) return `${BH.formatNumTR(seconds * 1e9, 2)} ns`;
  if (seconds < 1e-3) return `${BH.formatNumTR(seconds * 1e6, 2)} μs`;
  if (seconds < 1) return `${BH.formatNumTR(seconds * 1e3, 2)} ms`;
  if (seconds < 90) return `${BH.formatNumTR(seconds, 2)} s`;
  if (seconds < 5400) return `${BH.formatNumTR(seconds / 60, 2)} dk`;
  if (seconds < 1.5 * 86400) return `${BH.formatNumTR(seconds / 3600, 2)} sa`;
  if (seconds < 2 * BH.YEAR) return `${BH.formatNumTR(seconds / 86400, 1)} gün`;
  const yr = BH.secToYears(seconds);
  if (yr < 1e4) return `${BH.formatNumTR(yr, 2)} yıl`;
  if (yr < 1e6) return `${BH.formatNumTR(yr / 1e3, 2)} bin yıl`;
  if (yr < 1e9) return `${BH.formatNumTR(yr / 1e6, 2)} milyon yıl`;
  if (yr < 1e12) return `${BH.formatNumTR(yr / 1e9, 2)} milyar yıl`;
  return `${BH.formatSciTR(yr, 2, { forceSci: true })} yıl`;
}

/** Dalga boyunu (m) uygun SI önekli Türkçe dizeye çevirir. */
export function formatWavelengthTR(meters) {
  if (!Number.isFinite(meters) || !(meters > 0)) return '—';
  if (meters < 1e-13) return `${BH.formatSciTR(meters, 2, { forceSci: true })} m`;
  if (meters < 1e-10) return `${BH.formatNumTR(meters * 1e12, 2)} pm`;
  if (meters < 1e-6) return `${BH.formatNumTR(meters * 1e9, 2)} nm`;
  if (meters < 1e-3) return `${BH.formatNumTR(meters * 1e6, 2)} μm`;
  if (meters < 1) return `${BH.formatNumTR(meters * 1e3, 2)} mm`;
  if (meters < 1e4) return `${BH.formatNumTR(meters, 2)} m`;
  if (meters < 1e9) return `${BH.formatNumTR(meters * 1e-3, 2)} km`;
  return `${BH.formatSciTR(meters * 1e-3, 2, { forceSci: true })} km`;
}

/** Uzaklığı (m) km, milyon km veya AU cinsinden Türkçe biçimlendirir. */
export function formatDistanceMTR(meters) {
  if (!Number.isFinite(meters)) return '—';
  const a = Math.abs(meters);
  if (a < 1e3) return `${BH.formatNumTR(meters, 2)} m`;
  if (a < 1e9) return `${BH.formatNumTR(meters * 1e-3, 2)} km`;
  if (a < 5 * BH.AU) return `${BH.formatNumTR(meters / 1e9, 2)} × 10⁶ km`;
  if (a < 0.2 * BH.LIGHT_YEAR) return `${BH.formatNumTR(meters / BH.AU, 2)} AU`;
  return `${BH.formatSciTR(meters / BH.LIGHT_YEAR, 2)} ly`;
}

function formatMassSolarTR(massSolar) {
  if (!Number.isFinite(massSolar)) return '—';
  if (massSolar >= 1e5 || massSolar < 0.01) return `${BH.formatSciTR(massSolar, 2, { forceSci: true })} M☉`;
  if (massSolar >= 100) return `${BH.formatNumTR(massSolar, 0)} M☉`;
  return `${BH.formatNumTR(massSolar, 2)} M☉`;
}

function formatMassKgTR(massKg) {
  if (!Number.isFinite(massKg)) return '—';
  if (massKg >= 0.05 * BH.M_SUN) return formatMassSolarTR(BH.kgToSolarMass(massKg));
  return `${BH.formatSciTR(massKg, 2, { forceSci: true })} kg`;
}

// =====================================================================
// 2. SİMÜLASYON 1 SAF YARDIMCILARI: GÖRELİ YÖRÜNGELER (bh-orbits)
// =====================================================================

const _rosetteBP = BH.boundOrbitParams(14.0, 0.45);
const _zoomWhirlBP = BH.boundOrbitParams(7.20, 0.55);
const _nearIscoC = BH.circularOrbitParams(6.2);
const _mercWeakBP = BH.boundOrbitParams(90.0, MERCURY_E);

export const ORBIT_PRESETS = Object.freeze([
  {
    id: 'rosette',
    label: 'Presesyonlu rozet',
    r0: _rosetteBP.rApo,
    L: _rosetteBP.L,
    E: _rosetteBP.E,
    inward: true,
    maxPhi: 10 * Math.PI,
    viewR: 30,
    expectedStatus: 'bound',
    magnifyPrecession: false,
  },
  {
    id: 'zoom-whirl',
    label: 'Yakınlaş-dön (Zoom-Whirl)',
    r0: _zoomWhirlBP.rApo,
    L: _zoomWhirlBP.L,
    E: _zoomWhirlBP.E,
    inward: true,
    maxPhi: 14 * Math.PI,
    viewR: 20,
    expectedStatus: 'bound',
    magnifyPrecession: false,
  },
  {
    id: 'plunge',
    label: 'Ufka dalış (Plunge)',
    r0: 14.0,
    L: 3.1,
    E: 0.955,
    inward: true,
    maxPhi: 8 * Math.PI,
    viewR: 18,
    expectedStatus: 'captured',
    magnifyPrecession: false,
  },
  {
    id: 'near-isco',
    label: 'ISCO yakını dairesel',
    r0: 6.2,
    L: _nearIscoC.L,
    E: _nearIscoC.E,
    inward: false,
    maxPhi: 8 * Math.PI,
    viewR: 12,
    expectedStatus: 'bound',
    magnifyPrecession: false,
  },
  {
    id: 'mercury-weak',
    label: 'Merkür benzeri zayıf alan',
    r0: _mercWeakBP.rApo,
    L: _mercWeakBP.L,
    E: _mercWeakBP.E,
    inward: true,
    maxPhi: 10 * Math.PI,
    viewR: 130,
    expectedStatus: 'bound',
    magnifyPrecession: true,
  },
]);

/** Yerel statik çerçeve hızı (β_r, β_φ) bileşenlerinden kesin Schwarzschild (L, E, dr/dτ) parametrelerini hesaplar (M = 1). */
export function orbitParamsFromLocalVelocity(r0, betaR, betaPhi) {
  if (!(r0 > 2.02)) return { r0, L: NaN, E: NaN, drDtau0: NaN, gamma: NaN, valid: false };
  const speed = Math.hypot(betaR, betaPhi);
  const scale = speed > 0.94 ? 0.94 / speed : 1;
  const br = betaR * scale;
  const bp = betaPhi * scale;
  const b2 = br * br + bp * bp;
  const gamma = 1 / Math.sqrt(Math.max(1e-6, 1 - b2));
  const f0 = 1 - 2 / r0;
  const sqrtF = Math.sqrt(f0);
  const E = gamma * sqrtF;
  const L = Math.max(0.25, Math.abs(gamma * r0 * bp));
  const drDtau0 = E * br;
  return { r0, L, E, drDtau0, gamma, betaR: br, betaPhi: bp, valid: true };
}

/** (r0, L, E, inward) parametrelerinden yerel statik çerçeve hızı (β_r, β_φ) ve dr/dτ değerlerini türetir (M = 1). */
export function localVelocityFromOrbitParams(r0, L, E, inward = true) {
  const rSafe = Math.max(2.15, r0);
  const lSafe = Math.max(0.25, L);
  const V0 = BH.effectivePotentialMassive(rSafe, lSafe);
  const Emin = Math.sqrt(Math.max(0, V0));
  const Eeff = Math.max(Emin, E);
  const drAbs = Math.sqrt(Math.max(0, Eeff * Eeff - V0));
  const drDtau0 = drAbs < 1e-11 ? 0 : (inward ? -drAbs : drAbs);
  const f0 = 1 - 2 / rSafe;
  const betaPhi = (lSafe * Math.sqrt(f0)) / (rSafe * Eeff);
  const betaR = drDtau0 / Eeff;
  const beta = Math.hypot(betaR, betaPhi);
  return { r0: rSafe, L: lSafe, Eeff, Emin, V0, drDtau0, betaR, betaPhi, beta };
}

/** Merkür'ün Güneş çevresindeki gerçek enberi presesyonu (js/bh-core.js üzerinden SI hesabı). */
export function mercuryReferencePrecession() {
  const radPerOrbit = BH.periapsisPrecessionSI(BH.M_SUN, MERCURY_A_M, MERCURY_E);
  const arcsecPerOrbit = BH.radToArcsec(radPerOrbit);
  const orbitsPerCentury = (100 * 365.25) / MERCURY_PERIOD_DAYS;
  const arcsecPerCentury = arcsecPerOrbit * orbitsPerCentury;
  return { radPerOrbit, arcsecPerOrbit, orbitsPerCentury, arcsecPerCentury };
}

/** Schwarzschild göreli yörüngesi + aynı başlangıç verisinden Newton kıyası + öz/koordinat zamanı entegrasyonu. */
export function computeOrbitSimulation({
  r0 = 14,
  L = 4.2,
  E = 0.965,
  inward = true,
  phi0 = 0,
  dphi = 0.005,
  maxPhi = 10 * Math.PI,
  rMax = 600,
} = {}) {
  const init = localVelocityFromOrbitParams(r0, L, E, inward);
  const gr = BH.integrateTimelikeOrbit({
    r0: init.r0,
    L: init.L,
    drDtau0: init.drDtau0,
    phi0,
    dphi,
    maxPhi,
    rMax,
    sampleStride: 3,
  });

  // Öz zaman τ ve koordinat zamanı t'yi yörünge boyunca yamuk kuralıyla bütünleştir
  const pts = gr.points;
  const tauArr = new Float64Array(pts.length);
  const tArr = new Float64Array(pts.length);
  let tau = 0;
  let tCoord = 0;
  let tDiverged = false;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const dPh = p1.phi - p0.phi;
    const rA = p0.r;
    const rB = p1.r;
    const dTauA = (rA * rA) / init.L;
    const dTauB = (rB * rB) / init.L;
    tau += 0.5 * (dTauA + dTauB) * dPh;
    tauArr[i] = tau;

    const fA = 1 - 2 / rA;
    const fB = 1 - 2 / rB;
    if (!tDiverged && fA > 1e-4 && fB > 1e-4 && Number.isFinite(rA) && Number.isFinite(rB)) {
      const dtA = (gr.E0 * dTauA) / fA;
      const dtB = (gr.E0 * dTauB) / fB;
      tCoord += 0.5 * (dtA + dtB) * dPh;
      tArr[i] = tCoord;
    } else {
      tDiverged = true;
      tArr[i] = Infinity;
    }
  }

  // Aynı (r0, L, dr/dτ0) başlangıç verisinden kesin kapalı form Newton Binet çözümü:
  // u(φ) = 1/L² + A cos(φ - φ0) + B sin(φ - φ0)
  const invL2 = 1 / (init.L * init.L);
  const u0 = 1 / init.r0;
  const A = u0 - invL2;
  const B = -init.drDtau0 / init.L;
  const newtonEcc = init.L * init.L * Math.hypot(A, B);
  const newtonBound = newtonEcc < 0.9999;
  const newtonPts = [];
  const nSteps = 320;
  const nSpan = newtonBound ? 2 * Math.PI : Math.min(2 * Math.PI, Math.max(Math.PI, gr.phiFinal - phi0));
  for (let i = 0; i <= nSteps; i++) {
    const ph = phi0 + (nSpan * i) / nSteps;
    const d = ph - phi0;
    const u = invL2 + A * Math.cos(d) + B * Math.sin(d);
    if (u <= 1 / rMax) {
      if (newtonPts.length > 2) break;
      continue;
    }
    const r = 1 / u;
    newtonPts.push({ phi: ph, r, x: r * Math.cos(ph), y: r * Math.sin(ph) });
  }

  // Enberi presesyonu (periastron kayması / tur)
  let precessionRad = NaN;
  if (gr.periapses.length >= 2) {
    precessionRad = (gr.periapses[1] - gr.periapses[0]) - 2 * Math.PI;
  } else if (gr.status === 'bound' && Math.abs(gr.rMax - gr.rMin) / Math.max(gr.rMin, 1) < 0.02 && gr.rMin > 6) {
    // Neredeyse dairesel yörünge için küçük salınım presesyonu: 2π(1/√(1 - 6/r) - 1)
    precessionRad = 2 * Math.PI * (1 / Math.sqrt(1 - 6 / gr.rMin) - 1);
  }
  const precessionDeg = Number.isFinite(precessionRad) ? precessionRad * RAD : NaN;

  const isNearlyCircular = gr.status === 'bound'
    && Number.isFinite(gr.rMax)
    && Math.abs(gr.rMax - gr.rMin) / Math.max(gr.rMin, 1) < 0.03;

  const outcome = gr.status === 'captured'
    ? { code: 'captured', label: 'Ufka dalış (yakalandı)', tone: 'bad' }
    : gr.status === 'escaped'
      ? { code: 'escaped', label: 'Kaçış (hiperbolik)', tone: 'warn' }
      : isNearlyCircular
        ? { code: 'circular', label: 'Kararlı dairesel yörünge', tone: 'ok' }
        : { code: 'bound', label: 'Bağlı presesyonlu yörünge', tone: 'acc' };

  return {
    init,
    gr,
    points: pts,
    tauArr,
    tArr,
    tauTotal: tau,
    tTotal: tDiverged ? Infinity : tCoord,
    newtonPts,
    newtonEcc,
    newtonBound,
    precessionRad,
    precessionDeg,
    outcome,
  };
}

// =====================================================================
// 3. SİMÜLASYON 2 SAF YARDIMCILARI: ETKİN POTANSİYEL (bh-potential)
// =====================================================================

export const POTENTIAL_PRESETS = Object.freeze([
  { id: 'isco', label: 'ISCO sınırı (L = 2√3 M)', mode: 'massive', L: L_ISCO_M, E2: 8 / 9 },
  { id: 'bound-well', label: 'Kararlı bağlı kuyu (L = 4,3 M)', mode: 'massive', L: 4.3, E2: 0.945 },
  { id: 'marginal', label: 'Marjinal bağlı (L = 4 M, E = 1)', mode: 'massive', L: 4.0, E2: 1.0 },
  { id: 'no-barrier', label: 'Bariyersiz dalış (L = 3,0 M)', mode: 'massive', L: 3.0, E2: 0.94 },
  { id: 'light', label: 'Işık (foton küresi, r = 3 M)', mode: 'null', L: 4.0, invB2: 1 / 27 },
]);

function bisectRoot(fn, a, b, iters = 60) {
  let lo = a;
  let hi = b;
  let fLo = fn(lo);
  const fHi = fn(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return NaN;
  if (Math.abs(fLo) < 1e-13) return lo;
  if (Math.abs(fHi) < 1e-13) return hi;
  if (fLo * fHi > 0) return NaN;
  for (let i = 0; i < iters; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = fn(mid);
    if (fLo * fMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    if (hi - lo < 1e-12 * Math.max(1, mid)) break;
  }
  return 0.5 * (lo + hi);
}

/** Kütleli parçacık için Schwarzschild V_eff(r, L) ve Newton V_N(r, L) karşılaştırmalı analizi (M = 1). */
export function analyzePotentialMassive(L, E2, rMaxSearch = 400) {
  const lVal = Math.max(0.1, L);
  const disc = lVal * lVal - 12;
  const isIsco = Math.abs(lVal - L_ISCO_M) < 0.025;
  let rUnstable = NaN;
  let rStable = NaN;
  let vMax = NaN;
  let vMin = NaN;

  if (disc >= 0) {
    const s = Math.sqrt(disc);
    rUnstable = 0.5 * (lVal * lVal - lVal * s);
    rStable = 0.5 * (lVal * lVal + lVal * s);
    vMax = BH.effectivePotentialMassive(rUnstable, lVal);
    vMin = BH.effectivePotentialMassive(rStable, lVal);
  } else if (isIsco) {
    rUnstable = 6;
    rStable = 6;
    vMax = 8 / 9;
    vMin = 8 / 9;
  }

  // Dönüm noktaları: V_eff(r, L) = E² (monoton aralıklarda kesin ikiye bölme)
  const turningPoints = [];
  const f = r => BH.effectivePotentialMassive(r, lVal) - E2;
  const rHi = Math.max(rMaxSearch, Number.isFinite(rStable) ? rStable * 12 : 120, E2 < 0.9999 ? 4 / Math.max(1e-4, 1 - E2) : rMaxSearch);

  if (disc > 1e-9) {
    const intervals = [
      [2.00001, rUnstable],
      [rUnstable, rStable],
      [rStable, rHi],
    ];
    for (const [a, b] of intervals) {
      if (!(b > a)) continue;
      const fa = f(a);
      const fb = f(b);
      if (Math.abs(fb) < 1e-9) {
        if (!turningPoints.some(x => Math.abs(x - b) < 1e-4)) turningPoints.push(b);
      } else if (fa * fb <= 0) {
        const root = bisectRoot(f, a, b);
        if (Number.isFinite(root) && !turningPoints.some(x => Math.abs(x - root) < 1e-4)) {
          turningPoints.push(root);
        }
      }
    }
  } else {
    if (f(2.00001) * f(rHi) <= 0) {
      const root = bisectRoot(f, 2.00001, rHi);
      if (Number.isFinite(root)) turningPoints.push(root);
    }
  }
  turningPoints.sort((a, b) => a - b);

  // Yörünge sınıflandırması
  let regime = { label: 'Ufka dalış (bariyer yok)', tone: 'bad', kind: 'plunge' };
  if (disc > 1e-9) {
    if (E2 > vMax + 1e-5) {
      regime = { label: 'Bariyer üstü dalış (r_s\'ye düşer)', tone: 'bad', kind: 'plunge' };
    } else if (Math.abs(E2 - vMax) <= 1e-5) {
      regime = { label: 'Kararsız dairesel yörünge (r₋)', tone: 'warn', kind: 'unstable-circular' };
    } else if (E2 >= 1) {
      regime = { label: 'Saçılma / geri dönen uçuş (E ≥ 1)', tone: 'warn', kind: 'scattering' };
    } else if (E2 > vMin + 1e-5) {
      regime = { label: 'Bağlı salınımlı yörünge (r_peri ↔ r_apo)', tone: 'ok', kind: 'bound' };
    } else if (Math.abs(E2 - vMin) <= 1e-5) {
      regime = { label: 'Kararlı dairesel yörünge (r₊)', tone: 'ok', kind: 'stable-circular' };
    } else {
      regime = { label: 'Yalnız iç bölge dalışı (kuyunun altında)', tone: 'bad', kind: 'inner-plunge' };
    }
  } else if (isIsco) {
    regime = Math.abs(E2 - 8 / 9) < 0.008
      ? { label: 'ISCO birleşim noktası (r = 6 M)', tone: 'acc', kind: 'isco' }
      : { label: 'ISCO eşiği · bariyersiz düşüş', tone: 'warn', kind: 'plunge' };
  }

  // Newton etkin potansiyeli: V_N(r) = -1/r + L²/(2r²), E_tilde = (E² - 1)/2
  const eTilde = 0.5 * (E2 - 1);
  const newtonRMin = lVal * lVal;
  const newtonVMin = -1 / (2 * lVal * lVal);
  const newtonTurning = [];
  const dN = 1 + 2 * eTilde * lVal * lVal;
  if (dN >= 0) {
    const sq = Math.sqrt(dN);
    if (Math.abs(eTilde) < 1e-9) {
      newtonTurning.push(0.5 * lVal * lVal);
    } else if (eTilde < 0) {
      const r1 = (1 - sq) / (-2 * eTilde);
      const r2 = (1 + sq) / (-2 * eTilde);
      if (r1 > 0) newtonTurning.push(r1);
      if (r2 > 0 && Math.abs(r2 - r1) > 1e-6) newtonTurning.push(r2);
    } else {
      const r1 = (-1 + sq) / (2 * eTilde);
      if (r1 > 0) newtonTurning.push(r1);
    }
  }

  return {
    L: lVal,
    E2,
    E: Math.sqrt(Math.max(0, E2)),
    eTilde,
    hasBarrier: disc >= 0,
    isIsco,
    rUnstable,
    rStable,
    vMax,
    vMin,
    vTildeMax: Number.isFinite(vMax) ? 0.5 * (vMax - 1) : NaN,
    vTildeMin: Number.isFinite(vMin) ? 0.5 * (vMin - 1) : NaN,
    turningPoints,
    regime,
    newtonRMin,
    newtonVMin,
    newtonTurning,
  };
}

/** Işık (sıfır jeodezik) etkin potansiyeli V_null(r)/L² = (1 - 2/r)/r² analizi (M = 1). */
export function analyzePotentialNull(invB2) {
  const val = Math.max(1e-5, invB2);
  const peak = BH.effectivePotentialNull(3, 1); // 1/27
  const b = 1 / Math.sqrt(val);
  const turningPoints = [];
  const f = r => BH.effectivePotentialNull(r, 1) - val;

  if (val < peak - 1e-7) {
    const rIn = bisectRoot(f, 2.00001, 3);
    const rOutHi = Math.max(20, b * 3);
    const rOut = bisectRoot(f, 3, rOutHi);
    if (Number.isFinite(rIn)) turningPoints.push(rIn);
    if (Number.isFinite(rOut)) turningPoints.push(rOut);
  } else if (Math.abs(val - peak) <= 1e-7) {
    turningPoints.push(3);
  }

  const regime = val > peak + 1e-6
    ? { label: 'Foton yakalanır (b < b_c)', tone: 'bad', kind: 'captured' }
    : Math.abs(val - peak) <= 1e-6
      ? { label: 'Kararsız foton küresi (b = b_c = 3√3 M)', tone: 'acc', kind: 'photon-sphere' }
      : { label: 'Işık bükülür ve kaçar (b > b_c)', tone: 'ok', kind: 'scattered' };

  return { invB2: val, b, bCrit: B_CRIT_M, peak, rPeak: 3, turningPoints, regime };
}

// =====================================================================
// 4. SİMÜLASYON 3 SAF YARDIMCILARI: IŞIĞIN BÜKÜLMESİ (bh-light)
// =====================================================================

export const LIGHT_PRESETS = Object.freeze([
  { id: 'winding', label: 'Foton küresi sarımı (b ≈ b_c)', probeB: 5.21, fanSpan: 11, rayCount: 15, lensMode: false, betaRatio: 0 },
  { id: 'wide-fan', label: 'Geniş ışın demeti (2–14 M)', probeB: 6.5, fanSpan: 14, rayCount: 17, lensMode: false, betaRatio: 0.35 },
  { id: 'einstein-ring', label: 'Einstein halkası (β = 0)', probeB: 7.5, fanSpan: 14, rayCount: 15, lensMode: true, betaRatio: 0 },
  { id: 'double-img', label: 'Kayık kaynak (çift görüntü)', probeB: 7.5, fanSpan: 14, rayCount: 15, lensMode: true, betaRatio: 0.45 },
  { id: 'weak-field', label: 'Zayıf alan kıyası (b = 18 M)', probeB: 18.0, fanSpan: 22, rayCount: 13, lensMode: false, betaRatio: 0.2 },
]);

/** Tek bir ışık ışınını soldan yatay geliş (y = b) geometrisiyle Part 1 sıfır jeodezik integratöründen çizer. */
export function traceLightRay(b, { rClip = 26, dphi = 0.004, maxPhi = 14 * Math.PI } = {}) {
  const sign = b >= 0 ? 1 : -1;
  const absB = Math.abs(b);
  if (absB < 0.05) {
    return {
      b,
      absB,
      captured: true,
      rMin: 2,
      deflectionRad: Infinity,
      deflectionDeg: Infinity,
      weakFieldRad: Infinity,
      weakFieldDeg: Infinity,
      windingTurns: 0,
      pts: [{ x: -rClip, y: 0 }, { x: -2, y: 0 }],
    };
  }
  const nearCrit = absB > B_CRIT_M && absB < B_CRIT_M + 0.35;
  const res = BH.integrateNullGeodesic({
    b: absB,
    r0: Infinity,
    phi0: 0,
    dphi: nearCrit ? Math.min(dphi, 0.0025) : dphi,
    maxPhi,
    sampleStride: nearCrit ? 2 : 3,
  });

  const pts = [];
  // Soldan giriş noktası
  if (absB < rClip) {
    pts.push({ x: -Math.sqrt(Math.max(0, rClip * rClip - absB * absB)), y: b });
  }
  const rLim = rClip * 1.35;
  for (const pt of res.points) {
    if (!Number.isFinite(pt.r) || pt.r > rLim) continue;
    const th = sign > 0 ? Math.PI - pt.phi : Math.PI + pt.phi;
    pts.push({ x: pt.r * Math.cos(th), y: pt.r * Math.sin(th) });
  }
  // Eğer kaçtıysa çıkış doğrultusu boyunca klip çemberine uzat
  if (!res.captured && Number.isFinite(res.deflection) && pts.length > 0) {
    const last = pts[pts.length - 1];
    if (Math.hypot(last.x, last.y) < rClip * 0.98) {
      const exitAngle = sign > 0 ? -res.deflection : res.deflection;
      pts.push({
        x: last.x + Math.cos(exitAngle) * rClip,
        y: last.y + Math.sin(exitAngle) * rClip,
      });
    }
  }

  const weakFieldRad = BH.lightDeflectionWeakField(absB);
  const deflectionRad = res.captured ? Infinity : res.deflection;
  return {
    b,
    absB,
    captured: res.captured,
    rMin: res.rMin,
    deflectionRad,
    deflectionDeg: Number.isFinite(deflectionRad) ? deflectionRad * RAD : Infinity,
    weakFieldRad,
    weakFieldDeg: weakFieldRad * RAD,
    windingTurns: Number.isFinite(deflectionRad) ? deflectionRad / (2 * Math.PI) : 0,
    pts,
  };
}

/** Verilen çarpışma parametreleri listesi için ışın demeti üretir. */
export function computeLightFan(bList, opts = {}) {
  return bList.map(b => traceLightRay(b, opts));
}

/** İnce mercek yaklaşımında Einstein halkası yarıçapı, görüntü konumları ve büyütmeler. */
export function computeEinsteinLens({ massSolar = 10, dLkpc = 2, dSkpc = 4, betaRatio = 0 } = {}) {
  const mKg = BH.solarMassToKg(Math.max(0.1, massSolar));
  const dL = BH.kpcToM(Math.max(0.01, dLkpc));
  const dS = BH.kpcToM(Math.max(dLkpc + 0.05, dSkpc));
  const dLS = dS - dL;
  const thetaERad = Math.sqrt(((4 * BH.G * mKg) / (BH.C * BH.C)) * (dLS / (dL * dS)));
  const thetaEArcsec = BH.radToArcsec(thetaERad);
  const thetaEMas = thetaEArcsec * 1e3;
  const u = Math.abs(betaRatio);
  const sq = Math.sqrt(u * u + 4);
  const thetaPlusRatio = 0.5 * (u + sq);
  const thetaMinusRatio = 0.5 * (u - sq); // negatif: ters görüntü
  const isRing = u < 0.02;
  const muTotal = isRing ? Infinity : (u * u + 2) / (u * sq);
  const muPlus = isRing ? Infinity : 0.5 * (muTotal + 1);
  const muMinus = isRing ? Infinity : 0.5 * (muTotal - 1);
  return {
    massSolar,
    dLkpc,
    dSkpc,
    betaRatio: u,
    thetaERad,
    thetaEArcsec,
    thetaEMas,
    thetaPlusRatio,
    thetaMinusRatio,
    thetaPlusMas: thetaPlusRatio * thetaEMas,
    thetaMinusMas: thetaMinusRatio * thetaEMas,
    muPlus,
    muMinus,
    muTotal,
    isRing,
  };
}

// =====================================================================
// 5. SİMÜLASYON 4 SAF YARDIMCILARI: ZAMAN GENİŞLEMESİ VE KIRMIZIYA KAYMA (bh-redshift)
// =====================================================================

export const SPECTRAL_LINES = Object.freeze([
  { id: 'h-alpha', name: 'Hidrojen Hα', nm: 656.3, note: 'Kırmızı Balmer çizgisi' },
  { id: 'na-d', name: 'Sodyum D', nm: 589.0, note: 'Sarı çift çizgi' },
  { id: 'o-iii', name: 'Oksijen [O III]', nm: 500.7, note: 'Yeşil-camgöbeği bulutsu çizgisi' },
  { id: 'h-beta', name: 'Hidrojen Hβ', nm: 486.1, note: 'Mavi-camgöbeği Balmer çizgisi' },
  { id: 'ly-alpha', name: 'Lyman-α (UV)', nm: 121.6, note: 'Morötesi — yüksek z\'de görünür bölgeye kayar' },
]);

export const REDSHIFT_PRESETS = Object.freeze([
  { id: 'static-mid', label: 'Sabit sonda (r = 1,5 rₛ)', mode: 'static', rOverRs: 1.5, r0OverRs: 5, lineId: 'h-alpha', massSolar: 10 },
  { id: 'horizon-edge', label: 'Ufuk eşiği (r = 1,04 rₛ)', mode: 'static', rOverRs: 1.04, r0OverRs: 5, lineId: 'h-beta', massSolar: 10 },
  { id: 'freefall', label: 'Serbest düşüş (r₀ = 5 rₛ)', mode: 'freefall', rOverRs: 5.0, r0OverRs: 5, lineId: 'h-alpha', massSolar: 4.15e6 },
  { id: 'lyman-vis', label: 'Lyman-α → görünür ışık', mode: 'static', rOverRs: 1.05, r0OverRs: 5, lineId: 'ly-alpha', massSolar: 10 },
  { id: 'gps', label: 'Dünya GPS (+45,7 μs/gün)', mode: 'gps', rOverRs: 1.5, r0OverRs: 5, lineId: 'h-alpha', massSolar: 10 },
]);

/** Statik sondanın zaman genişlemesi, kırmızıya kayması, gözlenen dalga boyu ve parlaklık düşüşü. */
export function computeStaticProbeState(massSolar, rOverRs, lineNm = 656.3) {
  const mKg = BH.solarMassToKg(massSolar);
  const rs = BH.schwarzschildRadius(mKg);
  const rSafe = Math.max(1.0001, rOverRs);
  const rM = rSafe * rs;
  const dTauOverDt = BH.staticTimeDilation(mKg, rM);
  const onePlusZ = BH.gravitationalRedshiftFactor(mKg, rM);
  const z = onePlusZ - 1;
  const observedNm = lineNm * onePlusZ;
  const intensityRatio = Math.pow(onePlusZ, -4);
  const rgbEmit = wavelengthNmToRGB(lineNm);
  const rgbObs = wavelengthNmToRGB(observedNm);
  return {
    rOverRs: rSafe,
    rsMeters: rs,
    dTauOverDt,
    onePlusZ,
    z,
    emitNm: lineNm,
    observedNm,
    intensityRatio,
    rgbEmit,
    rgbObs,
    bandEmit: rgbEmit.band,
    bandObs: rgbObs.band,
  };
}

/** r0'dan durgun halde serbest düşen sondanın r konumundaki kesin (kütleçekim + Doppler) kırmızıya kayması ve saatleri. */
export function computeFreeFallProbeState(massSolar, r0OverRs, rOverRs, lineNm = 656.3) {
  const mKg = BH.solarMassToKg(massSolar);
  const rs = BH.schwarzschildRadius(mKg);
  const r0Safe = Math.max(1.5, r0OverRs);
  const rSafe = clamp(rOverRs, 0, r0Safe);
  const r0M = r0Safe * rs;
  const rM = rSafe * rs;
  const fall = BH.radialFreeFall(mKg, r0M, rM);
  const E = Math.sqrt(1 - 1 / r0Safe);
  const crossedHorizon = rSafe <= 1;

  let onePlusZ = Infinity;
  let beta = 1;
  let dTauOverDtCoord = 0;
  if (!crossedHorizon) {
    const f = 1 - 1 / rSafe;
    beta = Math.sqrt(Math.max(0, 1 - f / (E * E)));
    // Kesin birleşik kayma: 1 + z = (1/√f) * √((1 + β)/(1 - β)) = (E / f) * (1 + β)
    onePlusZ = (E / f) * (1 + beta);
    dTauOverDtCoord = f / E;
  }
  const z = Number.isFinite(onePlusZ) ? onePlusZ - 1 : Infinity;
  const observedNm = Number.isFinite(onePlusZ) ? lineNm * onePlusZ : Infinity;
  const intensityRatio = Number.isFinite(onePlusZ) ? Math.pow(onePlusZ, -4) : 0;
  const rgbEmit = wavelengthNmToRGB(lineNm);
  const rgbObs = Number.isFinite(observedNm)
    ? wavelengthNmToRGB(observedNm)
    : { r: 0, g: 0, b: 0, css: 'rgb(0,0,0)', band: 'Sinyal kaçamaz (ufuk içi)', visible: false };

  return {
    r0OverRs: r0Safe,
    rOverRs: rSafe,
    crossedHorizon,
    properTime: fall.properTime,
    coordTime: fall.coordTime,
    timeToHorizon: fall.timeToHorizon,
    timeToSingularity: fall.timeToSingularity,
    localSpeedOverC: beta,
    dTauOverDt: dTauOverDtCoord,
    onePlusZ,
    z,
    emitNm: lineNm,
    observedNm,
    intensityRatio,
    rgbEmit,
    rgbObs,
    bandEmit: rgbEmit.band,
    bandObs: rgbObs.band,
  };
}

/** Serbest düşen sondadan sabit öz zaman aralıklarıyla gönderilen ışık darbelerinin uzak gözlemciye varış zamanları. */
export function computeFreeFallSignalSchedule(massSolar, r0OverRs, numPulses = 14, lineNm = 656.3) {
  const mKg = BH.solarMassToKg(massSolar);
  const rs = BH.schwarzschildRadius(mKg);
  const r0M = r0OverRs * rs;
  const rObsM = Math.max(20 * rs, 2.5 * r0M);
  const scaleTau = Math.sqrt((r0M * r0M * r0M) / (8 * BH.G * mKg));
  const etaH = 2 * Math.acos(Math.sqrt(1 / r0OverRs));
  const tauH = scaleTau * (etaH + Math.sin(etaH));
  const pulses = [];
  let tArr0 = null;

  const denom = Math.max(1, numPulses - 1);
  for (let k = 0; k < numPulses; k++) {
    const frac = k / denom;
    const tauTarget = tauH * frac * 0.996;
    // τ(η) = scaleTau * (η + sin η) tersini ikiye bölme ile bul
    let lo = 0, hi = etaH - 1e-7;
    for (let it = 0; it < 50; it++) {
      const mid = 0.5 * (lo + hi);
      if (scaleTau * (mid + Math.sin(mid)) < tauTarget) lo = mid;
      else hi = mid;
    }
    const eta = 0.5 * (lo + hi);
    const rOverRs = 0.5 * r0OverRs * (1 + Math.cos(eta));
    const st = computeFreeFallProbeState(massSolar, r0OverRs, rOverRs, lineNm);
    const rM = rOverRs * rs;
    const rStarObs = rObsM + rs * Math.log(rObsM / rs - 1);
    const rStarEmit = rM + rs * Math.log(Math.max(1e-9, rM / rs - 1));
    const tArriveAbs = st.coordTime + (rStarObs - rStarEmit) / BH.C;
    if (tArr0 === null) tArr0 = tArriveAbs;
    pulses.push({
      idx: k,
      tauEmit: st.properTime,
      tArrive: tArriveAbs - tArr0,
      rOverRs,
      onePlusZ: st.onePlusZ,
      observedNm: st.observedNm,
      intensityRatio: st.intensityRatio,
      rgbObs: st.rgbObs,
    });
  }
  return { tauH, pulses };
}

/** Dünya yüzeyi ile GPS uydu yörüngesi arasındaki göreli saat kayması (sıfırlama hatasız kesin formül). */
export function computeEarthGpsRelativity() {
  const rsEarth = BH.schwarzschildRadius(BH.M_EARTH);
  const xSurf = rsEarth / BH.R_EARTH;
  const xGps = rsEarth / GPS_ORBIT_RADIUS_M;
  // 1 - √(1 - x) = x / (1 + √(1 - x)): küçük x için kayıpsız kesin hesap
  const surfGravOffset = -xSurf / (1 + Math.sqrt(1 - xSurf));
  const gpsGravOffset = -xGps / (1 + Math.sqrt(1 - xGps));
  const gravRateDiff = gpsGravOffset - surfGravOffset; // > 0 (GPS saati daha hızlı)
  const gpsTotalOffset = -(1.5 * xGps) / (1 + Math.sqrt(1 - 1.5 * xGps));
  const srRateDiff = gpsTotalOffset - gpsGravOffset; // < 0 (hız nedeniyle yavaşlama)
  const netRateDiff = gravRateDiff + srRateDiff;
  const secPerDay = 86400;
  const gravGainUsPerDay = gravRateDiff * secPerDay * 1e6;
  const srLossUsPerDay = srRateDiff * secPerDay * 1e6;
  const netGainUsPerDay = netRateDiff * secPerDay * 1e6;
  const dailyPositionErrorKm = (Math.abs(netRateDiff) * secPerDay * BH.C) * 1e-3;
  return {
    rsEarthMm: rsEarth * 1e3,
    altitudeKm: (GPS_ORBIT_RADIUS_M - BH.R_EARTH) * 1e-3,
    gravRateDiff,
    srRateDiff,
    netRateDiff,
    gravGainUsPerDay,
    srLossUsPerDay,
    netGainUsPerDay,
    dailyPositionErrorKm,
  };
}

// =====================================================================
// 6. SİMÜLASYON 5 SAF YARDIMCILARI: GELGİT VE SPAGETTİLEŞME (bh-tidal)
// =====================================================================

export const TIDAL_PRESETS = Object.freeze([
  { id: 'stellar-10', label: 'Yıldızsal (10 M☉)', massSolar: 10, rOverRs: 45, bodyLengthM: 2.0, limitG: 10 },
  { id: 'cygx1', label: 'Cygnus X-1 (21,2 M☉)', massSolar: 21.2, rOverRs: 25, bodyLengthM: 2.0, limitG: 10 },
  { id: 'threshold', label: 'Eşik kütle (1,45×10⁴ M☉)', massSolar: 14510, rOverRs: 1.5, bodyLengthM: 2.0, limitG: 10 },
  { id: 'sgr-a', label: 'Sgr A* (4,15×10⁶ M☉)', massSolar: 4.15e6, rOverRs: 1.0, bodyLengthM: 2.0, limitG: 10 },
  { id: 'm87', label: 'M87* (6,5×10⁹ M☉)', massSolar: 6.5e9, rOverRs: 1.0, bodyLengthM: 2.0, limitG: 10 },
]);

/** Verilen kütle, konum ve cisim boyu için gelgit gerilme/sıkışma ve spagettileşme durumu. */
export function computeTidalState({
  massSolar = 10,
  rOverRs = 20,
  bodyLengthM = 2.0,
  bodyWidthM = 0.45,
  limitG = 10,
} = {}) {
  const mKg = BH.solarMassToKg(Math.max(1, massSolar));
  const anal = BH.spaghettificationAnalysis(mKg, { bodyLengthM, limitG });
  const rSafe = Math.max(0.01, rOverRs);
  const rMeters = rSafe * anal.schwarzschildRadius;
  const daRadMs2 = BH.tidalAcceleration(mKg, rMeters, bodyLengthM);
  const daRadG = daRadMs2 / BH.G0;
  // Enine sıkışma: Δa_lat = -G M w / r³ (birim uzunluk başına radyal gradyanın tam -1/2'si)
  const daLatMs2 = -0.5 * BH.tidalAcceleration(mKg, rMeters, bodyWidthM);
  const daLatG = daLatMs2 / BH.G0;
  const stressRatio = daRadG / Math.max(1e-6, limitG);
  const exceededLimit = daRadG >= limitG;
  // Görsel gerilme çarpanı (1x -> 4.6x yumuşak logaritmik harita)
  const stretchFactor = 1 + 3.6 * (1 - Math.exp(-0.55 * Math.pow(Math.max(0, stressRatio), 0.55)));
  const squeezeFactor = 1 / Math.sqrt(stretchFactor);

  return {
    massSolar,
    rOverRs: rSafe,
    rMeters,
    rsMeters: anal.schwarzschildRadius,
    rTidalMeters: anal.tidalRadius,
    rTidalOverRs: anal.ratioToHorizon,
    daRadMs2,
    daRadG,
    daLatMs2,
    daLatG,
    horizonTidalG: anal.horizonTidalG,
    outsideHorizon: anal.outsideHorizon,
    survivesHorizon: anal.survivesHorizon,
    thresholdMassKg: anal.thresholdMassKg,
    thresholdMassSolar: anal.thresholdMassSolar,
    limitG,
    bodyLengthM,
    stressRatio,
    exceededLimit,
    stretchFactor,
    squeezeFactor,
  };
}

// =====================================================================
// 7. SİMÜLASYON 6 SAF YARDIMCILARI: HAWKING IŞIMASI (bh-hawking)
// =====================================================================

export const HAWKING_MASS_MIN_KG = 1e10;
export const HAWKING_MASS_MAX_KG = BH.solarMassToKg(1e10);
const _primordialMassKg = BH.evaporationMassForTime(BH.AGE_OF_UNIVERSE);
const _cmbEqMassKg = (BH.HBAR * Math.pow(BH.C, 3)) / (8 * Math.PI * BH.G * BH.K_B * T_CMB);

export const HAWKING_PRESETS = Object.freeze([
  { id: 'gamma-burst', label: 'Mini KD (10¹⁰ kg · 2,7 yıl)', massKg: 1e10 },
  { id: 'primordial', label: 'İlkel KD (1,73×10¹¹ kg · Evren yaşı)', massKg: _primordialMassKg },
  { id: 'cmb-eq', label: 'CMB dengesi (4,5×10²² kg · 2,7 K)', massKg: _cmbEqMassKg },
  { id: 'solar-1', label: '1 M☉ (61,7 nK)', massKg: BH.M_SUN },
  { id: 'sgr-a', label: 'Sgr A* (4,15×10⁶ M☉)', massKg: BH.solarMassToKg(4.15e6) },
  { id: 'm87', label: 'M87* (6,5×10⁹ M☉)', massKg: BH.solarMassToKg(6.5e9) },
]);

/** Verilen kütle (kg) için tüm Hawking termodinamiği, tayf bölgesi ve zaman ölçeği karşılaştırmaları. */
export function computeHawkingState(massKg) {
  const m = Math.max(PLANCK_MASS, massKg);
  const sum = BH.hawkingSummary(m);
  const band = BH.classifySpectralBand(sum.peakWavelength);
  const rgb = BH.blackbodyToRGB(sum.temperature);
  const evapOverUniverseAge = sum.evaporationSeconds / BH.AGE_OF_UNIVERSE;
  const evapOverPlanckTime = sum.evaporationSeconds / PLANCK_TIME;
  const absorbsCmb = sum.temperature < T_CMB;
  return {
    ...sum,
    rsMeters: BH.schwarzschildRadius(m),
    band,
    rgb,
    evapOverUniverseAge,
    evapOverPlanckTime,
    absorbsCmb,
  };
}

/** Logaritmik kalan zaman ölçeğinde Hawking buharlaşma animasyon durumu (progress ∈ [0, 1]). */
export function hawkingEvaporationState(mass0Kg, progress) {
  const p = clamp(progress, 0, 1);
  const m0 = Math.max(PLANCK_MASS * 10, mass0Kg);
  const t0 = BH.hawkingEvaporationTime(m0);
  const tMin = Math.max(PLANCK_TIME * 10, Math.min(1e-6, t0 * 1e-18));
  const logT0 = Math.log10(t0);
  const logTMin = Math.log10(tMin);
  // progress = 0 -> τ_rem = t0 (M = M0); progress = 1 -> τ_rem = tMin (final patlama)
  const logTauRem = lerp(logT0, logTMin, p);
  const tauRem = Math.pow(10, logTauRem);
  const massCur = p <= 0 ? m0 : Math.min(m0, BH.evaporationMassForTime(tauRem));
  const state = computeHawkingState(massCur);
  const massFrac = massCur / m0;
  const burstIntensity = p >= 1 ? 1 : (p > 0.9 ? clamp((p - 0.9) / 0.1, 0, 1) : 0);
  return {
    progress: p,
    mass0Kg: m0,
    tEvap0Sec: t0,
    tauRemSec: tauRem,
    logTauRem,
    logT0,
    logTMin,
    massFrac,
    burstIntensity,
    state,
  };
}

// =====================================================================
// 8. SİMÜLASYON 7 SAF YARDIMCILARI: KÜTLEÇEKİM DALGALARI (bh-gw)
// =====================================================================

export const GW_SIM_PRESETS = BH.GW_PRESETS;

/** İkili kara delik birleşme dalga biçimi ve tüm fiziksel özet değerleri (js/bh-core.js üzerinden). */
export function computeGwSimulation({
  m1Solar = 36,
  m2Solar = 29,
  distanceMpc = 410,
  fStart = 35,
  samples = 1600,
} = {}) {
  const m1Kg = BH.solarMassToKg(Math.max(1, m1Solar));
  const m2Kg = BH.solarMassToKg(Math.max(1, m2Solar));
  const distM = BH.mpcToM(Math.max(1, distanceMpc));
  const fIsco = BH.gwIscoFrequency(m1Kg + m2Kg);
  const effFStart = fStart && fStart > 0 && fStart < fIsco * 0.72
    ? fStart
    : Math.max(1, fIsco * 0.32);

  const wf = BH.generateChirpWaveform(m1Kg, m2Kg, distM, {
    fStart: effFStart,
    samples,
    ringdownFactor: 6,
  });
  const timeToMergerSec = BH.gwTimeToMerger(wf.chirpMassKg, effFStart);
  const rem = BH.gwRemnantProperties(m1Kg, m2Kg);

  return {
    m1Solar,
    m2Solar,
    distanceMpc,
    fStart: effFStart,
    wf,
    chirpMassSolar: BH.kgToSolarMass(wf.chirpMassKg),
    totalMassSolar: m1Solar + m2Solar,
    finalMassSolar: BH.kgToSolarMass(rem.finalMassKg),
    radiatedSolar: BH.kgToSolarMass(rem.radiatedMassKg),
    radiatedEnergyJ: rem.radiatedEnergyJ,
    radiatedFraction: rem.radiatedFraction,
    finalSpin: rem.finalSpin,
    fIsco: wf.fIsco,
    fQnm: wf.fQnm,
    tauQnm: wf.tauQnm,
    peakStrain: wf.peakStrain,
    timeToMergerSec,
  };
}

/** Kütleçekim dalgası frekanslarını her zaman işitilebilir [40, 2000] Hz aralığına eşler (monotonluğu korur). */
export function mapGwAudioFrequencies(wf, { minHz = 40, maxHz = 2000 } = {}) {
  const fs = wf.f;
  const N = fs.length;
  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (let i = 0; i < N; i++) {
    const v = fs[i];
    if (v > 0 && Number.isFinite(v)) {
      if (v < rawMin) rawMin = v;
      if (v > rawMax) rawMax = v;
    }
  }
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax) || rawMax <= 0) {
    rawMin = minHz;
    rawMax = maxHz;
  }

  const audioF = new Float64Array(N);
  const maxSpanRatio = (maxHz * 0.95) / (minHz * 1.05);
  const rawRatio = rawMax / Math.max(1e-6, rawMin);
  let shiftFactor = 1;
  let compressed = false;

  if (rawMin >= minHz && rawMax <= maxHz) {
    shiftFactor = 1;
    for (let i = 0; i < N; i++) audioF[i] = clamp(fs[i], minHz, maxHz);
  } else if (rawRatio <= maxSpanRatio) {
    // Sabit oranlı perde kaydırma (müzikal aralık korunur)
    if (rawMax > maxHz) {
      shiftFactor = (maxHz * 0.9) / rawMax;
      if (rawMin * shiftFactor < minHz) {
        shiftFactor = Math.sqrt((minHz * maxHz) / (rawMin * rawMax));
      }
    } else {
      shiftFactor = (minHz * 1.25) / rawMin;
      if (rawMax * shiftFactor > maxHz) {
        shiftFactor = Math.sqrt((minHz * maxHz) / (rawMin * rawMax));
      }
    }
    for (let i = 0; i < N; i++) audioF[i] = clamp(fs[i] * shiftFactor, minHz, maxHz);
  } else {
    // Çok geniş frekans aralığında logaritmik sıkıştırma
    compressed = true;
    const loOut = minHz * 1.1;
    const hiOut = maxHz * 0.95;
    const logIn0 = Math.log(rawMin);
    const logInSpan = Math.max(1e-9, Math.log(rawMax) - logIn0);
    const logOut0 = Math.log(loOut);
    const logOutSpan = Math.log(hiOut) - logOut0;
    shiftFactor = hiOut / rawMax;
    for (let i = 0; i < N; i++) {
      const u = clamp((Math.log(Math.max(rawMin, fs[i])) - logIn0) / logInSpan, 0, 1);
      audioF[i] = clamp(Math.exp(logOut0 + u * logOutSpan), minHz, maxHz);
    }
  }

  let mappedMin = Infinity;
  let mappedMax = -Infinity;
  for (let i = 0; i < N; i++) {
    if (audioF[i] < mappedMin) mappedMin = audioF[i];
    if (audioF[i] > mappedMax) mappedMax = audioF[i];
  }
  const physDur = wf.t[N - 1] - wf.t[0];
  const audioDurationSec = clamp(physDur * 3.5, 1.2, 2.6);

  return {
    audioF,
    shiftFactor,
    compressed,
    rawMin,
    rawMax,
    minFreq: mappedMin,
    maxFreq: mappedMax,
    audioDurationSec,
  };
}

// =====================================================================
// 9. SİMÜLASYON 8 SAF YARDIMCILARI: KERR ERGOSFER VE ISCO (bh-kerr)
// =====================================================================

export const KERR_PRESETS = Object.freeze([
  { id: 'schwarzschild', label: 'Schwarzschild (a* = 0)', aStar: 0, zamoR: 2.4, splitR: 1.85, penroseOn: false },
  { id: 'gw150914', label: 'GW150914 (a* = 0,68)', aStar: 0.68, zamoR: 1.85, splitR: 1.80, penroseOn: false },
  { id: 'v404', label: 'V404 Cygni (a* = 0,92)', aStar: 0.92, zamoR: 1.65, splitR: 1.55, penroseOn: false },
  { id: 'thorne', label: 'Thorne / Cyg X-1 (a* = 0,998)', aStar: 0.998, zamoR: 1.45, splitR: 1.25, penroseOn: false },
  { id: 'penrose', label: 'Penrose süreci (a* = 0,98)', aStar: 0.98, zamoR: 1.50, splitR: 1.32, penroseOn: true },
]);

/** Kerr kara deliği ekvatoral geometrisi, ZAMO çerçeve sürüklenmesi ve Penrose süreci enerji dengesi (M = 1). */
export function computeKerrState(aStar = 0.85, zamoR = 1.75, splitR = 1.5) {
  const a = clamp(aStar, 0, 0.999);
  const { rPlus, rMinus } = BH.kerrHorizonsGeom(a);
  const rErgoEq = BH.kerrErgosphereGeom(a, Math.PI / 2); // ekvatorda 2M
  const rIscoPro = BH.kerrIscoGeom(a, true);
  const rIscoRetro = BH.kerrIscoGeom(a, false);
  const rPhPro = BH.kerrPhotonOrbitGeom(a, true);
  const rPhRetro = BH.kerrPhotonOrbitGeom(a, false);
  const omegaH = BH.kerrHorizonOmegaGeom(a);
  const effPro = BH.kerrRadiativeEfficiency(a, true);
  const effRetro = BH.kerrRadiativeEfficiency(a, false);
  const irr = BH.kerrIrreducibleMass(BH.M_SUN, a);

  const zR = Math.max(rPlus + 0.04, zamoR);
  const omegaZamo = BH.kerrFrameDraggingGeom(zR, a, Math.PI / 2);
  const zamoInsideErgo = zR > rPlus && zR < rErgoEq;

  const orbPro = BH.kerrCircularOrbitGeom(rIscoPro + 1e-4, a, true);
  const orbRetro = BH.kerrCircularOrbitGeom(rIscoRetro + 1e-4, a, false);

  // Penrose süreci (ekvatorda E0 = 1 ile gelen parçacığın r_split noktasında ikiye bölünmesi):
  // Maksimum tek bölünme kazancı (Chandrasekhar/Wald): η_max(r) = (1/2)(√(2/r) - 1), yalnız r_+ < r < 2M için > 0
  const sR = Math.max(rPlus + 0.04, splitR);
  const insideErgoSplit = a > 1e-4 && sR > rPlus && sR < rErgoEq;
  const penroseGain = insideErgoSplit ? 0.5 * (Math.sqrt(2 / sR) - 1) : 0;
  const E0 = 1.0;
  const E1 = -penroseGain; // kara deliğe düşen negatif enerjili parça
  const E2 = E0 - E1;      // sonsuza kaçan yüksek enerjili parça (= 1 + penroseGain)

  return {
    aStar: a,
    rPlus,
    rMinus,
    rErgoEq,
    ergoThickness: rErgoEq - rPlus,
    rIscoPro,
    rIscoRetro,
    rPhPro,
    rPhRetro,
    omegaH,
    effPro,
    effRetro,
    extractableFraction: irr.extractableFraction,
    zamoR: zR,
    omegaZamo,
    zamoInsideErgo,
    omegaIscoPro: orbPro.omega,
    omegaIscoRetro: orbRetro.omega,
    splitR: sR,
    insideErgoSplit,
    penroseGain,
    penroseE0: E0,
    penroseE1: E1,
    penroseE2: E2,
  };
}

/** a* ∈ [-0.998, 0.998] boyunca ince disk ışınım verimi η(a*) eğrisi. */
export function kerrEfficiencyCurve(samples = 81) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < samples; i++) {
    const a = -0.998 + (1.996 * i) / (samples - 1);
    xs.push(a);
    ys.push(BH.kerrRadiativeEfficiency(a) * 100);
  }
  return { xs, ys };
}

// =====================================================================
// 10. SİMÜLASYON 9 SAF YARDIMCILARI: PENROSE DİYAGRAMI (bh-penrose)
// =====================================================================

export const PENROSE_PRESETS = Object.freeze([
  { id: 'ext-i', label: 'Dış gözlemci (Bölge I, r = 3 rₛ)', X: 0.62, T: -0.05, vCross: 0.72, showGrid: true },
  { id: 'horizon', label: 'Ufuk geçişi (r = rₛ)', X: 0.31, T: 0.31, vCross: 0.72, showGrid: true },
  { id: 'interior', label: 'Ufuk içi — tekillik gelecekte (II)', X: 0.08, T: 0.50, vCross: 0.72, showGrid: true },
  { id: 'infall', label: 'Serbest düşen sonda sinyalleri', X: 0.48, T: 0.12, vCross: 0.85, showGrid: true },
  { id: 'bridge', label: 'Einstein-Rosen köprüsü (I–III)', X: -0.52, T: 0.0, vCross: 0.72, showGrid: true },
]);

const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;

/** Schwarzschild (r/r_s, t/r_s, bölge) koordinatlarını kesin Carter-Penrose (X, T) koordinatlarına çevirir. */
export function schwarzschildToPenrose(rOverRs, tOverRs, region = 'I') {
  const x = rOverRs;
  if (!(x >= 0) || !Number.isFinite(x) || !Number.isFinite(tOverRs)) {
    return { X: NaN, T: NaN, uK: NaN, vK: NaN, valid: false };
  }
  const arg = tOverRs / 2;
  const ch = Math.cosh(arg);
  const sh = Math.sinh(arg);
  let Xk = 0;
  let Tk = 0;

  if (region === 'I' || region === 'III') {
    if (x < 1) return { X: NaN, T: NaN, uK: NaN, vK: NaN, valid: false };
    const rad = Math.sqrt((x - 1) * Math.exp(x));
    const sgn = region === 'I' ? 1 : -1;
    Xk = sgn * rad * ch;
    Tk = sgn * rad * sh;
  } else {
    if (x > 1) return { X: NaN, T: NaN, uK: NaN, vK: NaN, valid: false };
    const rad = Math.sqrt((1 - x) * Math.exp(x));
    const sgn = region === 'II' ? 1 : -1;
    Tk = sgn * rad * ch;
    Xk = sgn * rad * sh;
  }

  const uK = Tk - Xk;
  const vK = Tk + Xk;
  const uTilde = Math.atan(uK);
  const vTilde = Math.atan(vK);
  const X = 0.5 * (vTilde - uTilde);
  const T = 0.5 * (vTilde + uTilde);
  return { X, T, uK, vK, valid: true };
}

/** f(x) = (x - 1) e^x = w (w ≥ -1) denklemini x = r/r_s ≥ 0 için Newton yöntemiyle çözer. */
function invertKruskalW(w) {
  if (w <= -1) return 0;
  if (Math.abs(w) < 1e-13) return 1;
  let x = w > 0 ? Math.log(w + 1) + 1 : Math.sqrt(Math.max(0, 1 + w));
  if (x < 1e-4) x = 0.05;
  for (let i = 0; i < 32; i++) {
    const ex = Math.exp(x);
    const fx = (x - 1) * ex - w;
    const dfx = x * ex;
    if (Math.abs(dfx) < 1e-15) break;
    const step = fx / dfx;
    x = Math.max(0, x - step);
    if (Math.abs(step) < 1e-13 * Math.max(1, x)) break;
  }
  return x;
}

/** Carter-Penrose (X, T) noktasını Schwarzschild (r/r_s, t/r_s, bölge I–IV) ve kaçış olanağına çevirir. */
export function penroseToSchwarzschild(X, T) {
  const vTilde = T + X;
  const uTilde = T - X;
  const inside = Math.abs(T) < QUARTER_PI - 1e-6
    && Math.abs(vTilde) < HALF_PI - 1e-6
    && Math.abs(uTilde) < HALF_PI - 1e-6;
  if (!inside) {
    return {
      X, T, rOverRs: NaN, tOverRs: NaN, region: null,
      insideDiagram: false, canEscapeToScriPlus: false,
    };
  }
  const vK = Math.tan(vTilde);
  const uK = Math.tan(uTilde);
  const Tk = 0.5 * (vK + uK);
  const Xk = 0.5 * (vK - uK);
  const w = Xk * Xk - Tk * Tk;
  const rOverRs = invertKruskalW(w);

  let region;
  let tOverRs;
  if (Math.abs(Xk) > Math.abs(Tk)) {
    region = Xk >= 0 ? 'I' : 'III';
    tOverRs = 2 * Math.atanh(clamp(Tk / Xk, -0.9999999, 0.9999999));
  } else {
    region = Tk >= 0 ? 'II' : 'IV';
    tOverRs = 2 * Math.atanh(clamp(Xk / Tk, -0.9999999, 0.9999999));
  }
  const canEscapeToScriPlus = region === 'I' || region === 'IV';
  return {
    X, T, uK, vK, rOverRs, tOverRs, region,
    insideDiagram: true,
    canEscapeToScriPlus,
  };
}

/** (X, T) olayından çıkan gelecek 45° ışık konisinin (+45° sağa ve -45° sola) kesin son noktalarını hesaplar. */
export function penroseFutureLightCone(X, T) {
  // Sağ-yukarı (+45°): T' - T = X' - X = s >= 0 (u_tilde = T - X sabit)
  // Sınırlar: gelecek tekillik T' = π/4 VEYA Bölge I'de ℐ⁺ (T' + X' = π/2)
  const sSing = Math.max(0, QUARTER_PI - T);
  const sScriRight = Math.max(0, (HALF_PI - (T + X)) * 0.5);
  let rightEnd;
  if (T - X < -1e-6 && sScriRight < sSing) {
    // u_tilde < 0 -> Bölge I veya IV'te ℐ⁺'a (sağ gelecek ışık sonsuzuna) ulaşır
    rightEnd = { X: X + sScriRight, T: T + sScriRight, target: 'scri+' };
  } else {
    rightEnd = { X: X + sSing, T: QUARTER_PI, target: 'singularity' };
  }

  // Sol-yukarı (-45°): T' - T = -(X' - X) = s >= 0 (v_tilde = T + X sabit)
  // Sınırlar: gelecek tekillik T' = π/4 VEYA Bölge III'te sol ℐ⁺ (T' - X' = π/2)
  const sScriLeft = Math.max(0, (HALF_PI - (T - X)) * 0.5);
  let leftEnd;
  if (T + X < -1e-6 && sScriLeft < sSing) {
    leftEnd = { X: X - sScriLeft, T: T + sScriLeft, target: 'scri+III' };
  } else {
    leftEnd = { X: X - sSing, T: QUARTER_PI, target: 'singularity' };
  }

  const trapped = rightEnd.target === 'singularity' && leftEnd.target === 'singularity';
  return { origin: { X, T }, rightEnd, leftEnd, trapped };
}

/** Bölge I'den başlayıp ufku (u_K = 0, v_K = vCross) geçerek r = 0 tekilliğinde biten zaman-benzeri düşüş dünya çizgisi. */
export function penroseInfallingWorldline(vCross = 0.72, samples = 80) {
  const vc = clamp(vCross, 0.25, 2.2);
  const pts = [];
  // Zaman-benzeri parametrik eğri: s ∈ [0, 1] boyunca v_tilde artar, u_tilde artar (du_tilde > 0 ve dv_tilde > 0 => |dX/dT| < 1 kesin!)
  const vStart = Math.atan(vc * 0.14);
  const vHor = Math.atan(vc);
  const vEnd = Math.min(HALF_PI - 0.14, vHor + 0.34);
  const uStart = -HALF_PI + 0.14;
  const uEnd = HALF_PI - vEnd; // tekillik koşulu: u_tilde + v_tilde = π/2 => T = π/4

  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    const uT = lerp(uStart, uEnd, s);
    // Ufuk geçişinde (uT = 0) vT = vHor olacak biçimde monoton yumuşak eğri
    const sHor = -uStart / (uEnd - uStart);
    let vT;
    if (s <= sHor) {
      const q = s / Math.max(1e-6, sHor);
      vT = lerp(vStart, vHor, Math.pow(q, 0.85));
    } else {
      const q = (s - sHor) / Math.max(1e-6, 1 - sHor);
      vT = lerp(vHor, vEnd, q);
    }
    const X = 0.5 * (vT - uT);
    const T = 0.5 * (vT + uT);
    const info = i === samples
      ? { rOverRs: 0, region: 'II', canEscapeToScriPlus: false }
      : penroseToSchwarzschild(X, T);
    pts.push({ s, X, T, rOverRs: info.rOverRs, region: info.region || 'II' });
  }
  return pts;
}

// =====================================================================
// 11. SİMÜLASYON 10 SAF YARDIMCILARI: YIĞILMA DİSKİ VE EDDINGTON (bh-accretion)
// =====================================================================

export const ACCRETION_PRESETS = Object.freeze([
  { id: 'cygx1', label: 'X-ışını ikilisi · Cyg X-1 (21,2 M☉)', massSolar: 21.2, eddRatio: 0.08, aStar: 0.95 },
  { id: 'stellar10', label: 'Yıldızsal disk (10 M☉, a* = 0)', massSolar: 10, eddRatio: 0.15, aStar: 0.0 },
  { id: 'quasar', label: 'Kuasar (10⁸ M☉, 0,3 Ṁ_Edd)', massSolar: 1e8, eddRatio: 0.30, aStar: 0.7 },
  { id: 'ton618', label: 'TON 618 (4,1×10¹⁰ M☉)', massSolar: 4.07e10, eddRatio: 0.25, aStar: 0.5 },
  { id: 'super-edd', label: 'Süper-Eddington (10 M☉, 1,4 Ṁ_Edd)', massSolar: 10, eddRatio: 1.4, aStar: 0.0 },
]);

/** Taşma korumalı kesin Planck tayf parlaklığı B_ν(T) [W m⁻² Hz⁻¹ sr⁻¹]. */
export function planckBnu(nuHz, tempK) {
  if (!(nuHz > 0) || !(tempK > 0)) return 0;
  const x = (BH.H_PLANCK * nuHz) / (BH.K_B * tempK);
  if (x > 700) return 0;
  const pref = (2 * BH.H_PLANCK * nuHz * nuHz * nuHz) / (BH.C * BH.C);
  if (x < 1e-5) return pref / x; // Rayleigh-Jeans limiti
  return pref / (Math.expm1(x));
}

/** Shakura-Sunyaev ince yığılma diski sıcaklık profili, çok sıcaklıklı kara cisim tayfı ve Eddington analizi. */
export function computeAccretionDisk({
  massSolar = 10,
  eddRatio = 0.15,
  aStar = 0,
  rOutFactor = 250,
  radialBins = 90,
  energyBins = 150,
} = {}) {
  const mKg = BH.solarMassToKg(Math.max(1, massSolar));
  const a = clamp(aStar, 0, 0.998);
  const eta = BH.kerrRadiativeEfficiency(a, true);
  const lEddW = BH.eddingtonLuminosity(mKg);
  const mdotEddKgS = BH.eddingtonAccretionRate(mKg, eta);
  const mdotKgS = Math.max(1e-6, eddRatio) * mdotEddKgS;
  const mdotSolarPerYr = (mdotKgS * BH.YEAR) / BH.M_SUN;
  const lBolW = eddRatio * lEddW;
  const rInM = BH.kerrIsco(mKg, a, true);
  const rg = BH.gravRadius(mKg);
  const rInOverRg = rInM / rg;
  const rOutM = rInM * rOutFactor;

  const dmax = BH.diskTemperatureMax(mKg, mdotKgS, rInM);

  // Logaritmik halka ızgarası (T(r) profili + tayf entegrasyonu)
  const logMinR = Math.log(rInM * 1.002);
  const logMaxR = Math.log(rOutM);
  const dLnR = (logMaxR - logMinR) / radialBins;
  const profile = [];
  let bolometricRingW = 0;

  for (let j = 0; j < radialBins; j++) {
    const lnR = logMinR + (j + 0.5) * dLnR;
    const r = Math.exp(lnR);
    const T = BH.diskTemperature(mKg, mdotKgS, r, rInM);
    const rgb = BH.blackbodyToRGB(T);
    profile.push({ r, rOverRg: r / rg, rOverRin: r / rInM, T, rgb });
    // İki yüz için 2 * σ T⁴ * 2π r dr = 4π σ T⁴ r² d(ln r)
    bolometricRingW += 4 * Math.PI * BH.SIGMA_SB * Math.pow(T, 4) * r * r * dLnR;
  }

  // Çok sıcaklıklı kara cisim tayfı: E = hν ∈ [0.01 eV, 10⁵ eV]
  const logE0 = -2;
  const logE1 = 5;
  const energiesEv = [];
  const nuHz = [];
  const Lnu = [];
  const nuLnu = [];
  let peakNuLnu = 0;
  let peakEnergyEv = 1;
  let bolometricIntegratedW = 0;
  const dLnNu = ((logE1 - logE0) * Math.LN10) / (energyBins - 1);

  for (let i = 0; i < energyBins; i++) {
    const eEv = Math.pow(10, logE0 + ((logE1 - logE0) * i) / (energyBins - 1));
    const nu = (eEv * EV_J) / BH.H_PLANCK;
    let sumLnu = 0;
    for (let j = 0; j < radialBins; j++) {
      const ring = profile[j];
      if (ring.T > 0) {
        sumLnu += 4 * Math.PI * Math.PI * planckBnu(nu, ring.T) * ring.r * ring.r * dLnR;
      }
    }
    const nl = nu * sumLnu;
    energiesEv.push(eEv);
    nuHz.push(nu);
    Lnu.push(sumLnu);
    nuLnu.push(nl);
    if (nl > peakNuLnu) {
      peakNuLnu = nl;
      peakEnergyEv = eEv;
    }
    bolometricIntegratedW += nl * dLnNu;
  }

  const peakWavelengthSpecM = (BH.H_PLANCK * BH.C) / (peakEnergyEv * EV_J);
  const peakBand = BH.classifySpectralBand(peakWavelengthSpecM);
  const bolometricAnalyticW = (BH.G * mKg * mdotKgS) / (2 * rInM);

  return {
    massSolar,
    eddRatio,
    aStar: a,
    eta,
    rInM,
    rInOverRg,
    rOutM,
    lEddW,
    lBolW,
    mdotEddKgS,
    mdotKgS,
    mdotSolarPerYr,
    superEddington: eddRatio > 1.0,
    Tmax: dmax.Tmax,
    rPeakOverRg: dmax.rPeak / rg,
    wienPeakWavelengthM: dmax.peakWavelengthM,
    wienBand: dmax.band,
    profile,
    spectrum: {
      energiesEv,
      nuHz,
      Lnu,
      nuLnu,
      peakNuLnu,
      peakEnergyEv,
      peakBand,
      bolometricIntegratedW,
      bolometricRingW,
      bolometricAnalyticW,
    },
  };
}

// =====================================================================
// 12. ORTAK ARAYÜZ VE TUVAL YARDIMCILARI
// =====================================================================

const autoPlayAllowed = () => motion() === 'full';
const isReducedMotion = () => motion() === 'reduced';

let bhsUid = 0;

function introHtml(text, presets = []) {
  return `<div class="bhs-intro">
    <p>${richTex(text)}</p>
    ${presets.length ? `<div class="bhs-presets" role="group" aria-label="Hazır senaryolar">
      <span class="bhs-preset-lbl">Önayar:</span>
      ${presets.map((p, i) => `<button type="button" class="bhs-chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

function bindPresets(host, presets, apply, clean) {
  const box = host.querySelector('.bhs-presets');
  if (!box) return;
  const onClick = e => {
    const b = e.target.closest?.('[data-preset]');
    if (!b) return;
    host.querySelectorAll('.bhs-presets [data-preset]').forEach(x => x.classList.toggle('bhs-on', x === b));
    apply(presets[+b.dataset.preset], +b.dataset.preset);
    syncSegments(host, false);
  };
  box.addEventListener('click', onClick);
  clean.add(() => box.removeEventListener('click', onClick));
}

function markPreset(host, idx) {
  host.querySelectorAll('.bhs-presets [data-preset]').forEach((b, i) => b.classList.toggle('bhs-on', i === idx));
}

function addSlider(parent, { label, min, max, value, step, log = false, fmt, onInput, ariaLabel }) {
  const uid = `bhs-s-${++bhsUid}`;
  const wrap = document.createElement('div');
  wrap.className = 'bhs-ctrl';
  wrap.innerHTML = `<div class="bhs-ctrl-top">
      <label class="bhs-ctrl-lbl" for="${uid}">${esc(label)}</label>
      <span class="bhs-ctrl-val mono" data-v></span>
    </div>
    <input id="${uid}" type="range" class="bhs-range" aria-label="${esc(ariaLabel || label)}">`;
  parent.append(wrap);
  const rng = wrap.querySelector('input');
  const valEl = wrap.querySelector('[data-v]');
  let cur = value;
  let lo = min;
  let hi = max;

  if (log) {
    rng.min = '0';
    rng.max = '1000';
    rng.step = '1';
  } else {
    rng.min = String(lo);
    rng.max = String(hi);
    rng.step = String(step ?? (hi - lo) / 200);
  }

  const toPos = v => {
    const cl = clamp(v, lo, hi);
    return log ? Math.round((1000 * Math.log(cl / lo)) / Math.log(hi / lo)) : cl;
  };
  const fromPos = p => (log ? lo * Math.pow(hi / lo, p / 1000) : p);
  const format = v => (fmt ? fmt(v) : BH.formatNumTR(v, 2));

  const set = v => {
    cur = clamp(v, lo, hi);
    rng.value = String(toPos(cur));
    valEl.textContent = format(cur);
  };

  const setRange = (newMin, newMax, newStep) => {
    lo = newMin;
    hi = newMax;
    if (!log) {
      rng.min = String(lo);
      rng.max = String(hi);
      if (newStep !== undefined) rng.step = String(newStep);
    }
    set(cur);
  };

  rng.addEventListener('input', () => {
    const raw = fromPos(+rng.value);
    cur = log ? raw : +raw.toFixed(6);
    valEl.textContent = format(cur);
    onInput(cur);
  });

  set(value);
  return {
    el: wrap,
    set,
    setRange,
    get: () => cur,
    setVisible: show => { wrap.hidden = !show; },
  };
}

function addToggle(parent, label, checked, onChange) {
  const lbl = document.createElement('label');
  lbl.className = 'bhs-check-row';
  lbl.innerHTML = `<span>${esc(label)}</span><input type="checkbox" ${checked ? 'checked' : ''} aria-label="${esc(label)}">`;
  parent.append(lbl);
  const inp = lbl.querySelector('input');
  inp.addEventListener('change', () => onChange(inp.checked));
  return {
    el: lbl,
    set: v => { inp.checked = !!v; },
    get: () => inp.checked,
    setVisible: show => { lbl.hidden = !show; },
  };
}

function renderKpis(el, items) {
  if (!el) return;
  el.innerHTML = items.map(it => {
    const cls = it.tone ? `bhs-kpi-${it.tone}` : '';
    return `<div class="bhs-kpi ${cls}">
      <span class="bhs-kpi-lbl">${esc(it.lbl)}</span>
      <b class="bhs-kpi-val mono">${esc(it.val)}</b>
      ${it.sub ? `<span class="bhs-kpi-sub mono">${esc(it.sub)}</span>` : ''}
    </div>`;
  }).join('');
}

function theoryAndTasksHtml({ equations = [], paragraphs = [], tasks = [] }) {
  const tasksHtml = tasks.length ? `<div class="bhs-tasks" role="region" aria-label="Deney görevleri">
    <div class="bhs-tasks-head"><h4 class="bhs-title">Deney Görevleri</h4><span class="bhs-hint" data-task-prog>0 / ${tasks.length} tamamlandı</span></div>
    ${tasks.map((t, i) => `<label class="bhs-task"><input type="checkbox" data-task="${i}"><span>${richTex(t)}</span></label>`).join('')}
  </div>` : '';

  const theoryHtml = `<details class="bhs-theory">
    <summary><span>Nasıl çalışır? — Kuram ve Denklemler</span><span class="bhs-theory-tag">Kuram</span></summary>
    <div class="bhs-theory-body">
      ${equations.length ? `<div class="bhs-eq-box">${equations.map(eq => `<div>${tex(eq, true)}</div>`).join('')}</div>` : ''}
      ${paragraphs.map(p => `<p>${richTex(p)}</p>`).join('')}
    </div>
  </details>`;

  return tasksHtml + theoryHtml;
}

function bindTasks(host, clean) {
  const boxes = [...host.querySelectorAll('[data-task]')];
  const prog = host.querySelector('[data-task-prog]');
  if (!boxes.length) return;
  const sync = () => {
    let done = 0;
    boxes.forEach(b => {
      const ok = b.checked;
      if (ok) done++;
      b.closest?.('.bhs-task')?.classList.toggle('bhs-done', ok);
    });
    if (prog) prog.textContent = `${done} / ${boxes.length} tamamlandı`;
  };
  boxes.forEach(b => b.addEventListener('change', sync));
  clean.add(() => boxes.forEach(b => b.removeEventListener('change', sync)));
  sync();
}

function syncPlayBtn(btn, playing, playLabel = 'Oynat', pauseLabel = 'Duraklat') {
  if (!btn) return;
  btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  btn.innerHTML = `${icon(playing ? 'pause' : 'play')} <span>${esc(playing ? pauseLabel : playLabel)}</span>`;
}

function bindDragCanvas(cv, { onDown, onMove, onUp }, clean) {
  if (!cv) return;
  let activeId = null;
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, W: r.width || 320, H: r.height || 240 };
  };
  const down = e => {
    if (activeId !== null) return;
    const p = pt(e);
    if (onDown && onDown(p, e) === false) return;
    activeId = e.pointerId;
    cv.setPointerCapture?.(e.pointerId);
  };
  const move = e => {
    const p = pt(e);
    onMove?.(p, activeId === e.pointerId, e);
  };
  const up = e => {
    if (activeId !== e.pointerId) return;
    activeId = null;
    cv.releasePointerCapture?.(e.pointerId);
    onUp?.(pt(e), e);
  };
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  clean.add(() => {
    cv.removeEventListener('pointerdown', down);
    cv.removeEventListener('pointermove', move);
    cv.removeEventListener('pointerup', up);
    cv.removeEventListener('pointercancel', up);
  });
}

function drawArrow2D(c, x1, y1, x2, y2, color, lw = 2, label = '') {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(10, len * 0.36);
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - ux * head - uy * head * 0.46, y2 - uy * head + ux * head * 0.46);
  c.lineTo(x2 - ux * head + uy * head * 0.46, y2 - uy * head - ux * head * 0.46);
  c.closePath();
  c.fill();
  if (label && len > 14) {
    c.font = '600 11px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x2 + ux * 13, y2 + uy * 13);
  }
  c.restore();
}

function drawBlackHoleDisk(c, cx, cy, rsPx, rPhPx = 0, rIscoPx = 0, acc = '#60a5fa') {
  c.save();
  // ISCO çemberi
  if (rIscoPx > rsPx + 2) {
    c.beginPath();
    c.setLineDash([6, 5]);
    c.strokeStyle = 'rgba(255, 209, 102, 0.58)';
    c.lineWidth = 1.3;
    c.arc(cx, cy, rIscoPx, 0, Math.PI * 2);
    c.stroke();
  }
  // Foton küresi çemberi
  if (rPhPx > rsPx + 1.5) {
    c.beginPath();
    c.setLineDash([3, 4]);
    c.strokeStyle = 'rgba(56, 189, 248, 0.68)';
    c.lineWidth = 1.3;
    c.arc(cx, cy, rPhPx, 0, Math.PI * 2);
    c.stroke();
  }
  c.setLineDash([]);
  // Olay ufku halesi
  const glowR = Math.max(rsPx * 2.2, rsPx + 14);
  const gr = c.createRadialGradient(cx, cy, rsPx * 0.85, cx, cy, glowR);
  gr.addColorStop(0, 'rgba(255,255,255,0.28)');
  gr.addColorStop(0.35, 'rgba(90,176,255,0.12)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr;
  c.beginPath();
  c.arc(cx, cy, glowR, 0, Math.PI * 2);
  c.fill();

  // Olay ufku karartısı
  c.fillStyle = '#030306';
  c.strokeStyle = acc;
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(cx, cy, Math.max(4, rsPx), 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

// =====================================================================
// SİMÜLASYON 1: GÖRELİ YÖRÜNGELER (bh-orbits)
// =====================================================================

function mountOrbits(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const p0 = ORBIT_PRESETS[0];
  const st = {
    r0: p0.r0,
    L: p0.L,
    E: p0.E,
    inward: p0.inward,
    phi0: 0,
    maxPhi: p0.maxPhi,
    viewR: p0.viewR,
    showNewton: true,
    magnifyPrecession: false,
    speed: 1.0,
    playing: autoPlayAllowed(),
    progressIdx: 0,
    presetId: p0.id,
  };

  let simData = computeOrbitSimulation(st);
  const mercRef = mercuryReferencePrecession();
  let dragKind = null; // 'pos' | 'vel'
  let lastGeo = { cx: 160, cy: 160, scale: 6 };

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Schwarzschild kara deliği çevresinde bir test parçacığı fırlat; **genel görelilik** yörüngesini aynı başlangıç koşulundaki **Newton elipsiyle** canlı kıyasla. Parçacığı veya hız okunu tuvalde doğrudan sürükleyebilirsin.', ORBIT_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel" data-ctrls>
        <div class="bhs-head">
          <h4 class="bhs-title">Başlangıç Koşulları (M = 1)</h4>
          <span class="bhs-badge bhs-badge-acc" data-outcome></span>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Yörüngeyi oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-reset aria-label="Başa sar">${icon('rotate')} Sıfırla</button>
        </div>
        <div class="bhs-divider"></div>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-divider"></div>
        <div class="bhs-alert bhs-alert-acc" data-merc hidden></div>
        <p class="bhs-hint">${richTex('İpucu: Tuvaldeki parlak parçacığı sürükleyerek başlangıç konumunu ($r_0$), ucundaki oku sürükleyerek yerel hız vektörünü değiştirebilirsin.')}</p>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Schwarzschild Ekvatoral Düzlemi (x, y / M)</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:var(--acc)"></i>GR yörünge</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${COL_BLUE}"></i>Newton</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${COL_WARN}"></i>ISCO (6M)</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${COL_CYAN}"></i>Foton (3M)</span>
            </div>
          </div>
          <div class="bhs-cv-box">
            <canvas class="bhs-cv bhs-cv-drag" data-cv aria-label="Göreli yörünge simülasyonu tuvali"></canvas>
            <div class="bhs-cv-tag" data-cvtag>Sürükle: konum / hız oku</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{d^2 u}{d\\phi^2} = \\frac{1}{L^2} - u + 3u^2 \\qquad \\left(u = \\frac{1}{r},\\; G = c = M = 1\\right)',
        'E^2 = \\left(\\frac{dr}{d\\tau}\\right)^2 + \\left(1 - \\frac{2}{r}\\right)\\left(1 + \\frac{L^2}{r^2}\\right), \\qquad \\Delta\\phi_{\\text{zayıf}} = \\frac{6\\pi GM}{c^2 a(1 - e^2)}',
        '\\frac{d\\tau}{d\\phi} = \\frac{r^2}{L}, \\qquad \\frac{dt}{d\\tau} = \\frac{E}{1 - 2/r}',
      ],
      paragraphs: [
        'Newton kütleçekiminde $d^2u/d\\phi^2 = 1/L^2 - u$ denklemi kapalı elipsler verir ve enberi hiç dönmez. Genel göreliliğin eklediği **$+3u^2$** terimi her turda yörüngeyi ileri döndürür (**enberi presesyonu**) ve $r = 6M$ (ISCO) içinde kararlı dairesel yörüngeleri ortadan kaldırır.',
        'Kararsız dairesel yörünge tepesine çok yakın enerjilerde parçacık kara deliğin etrafında birkaç kez sarılıp tekrar dışarı fırlar (**yakınlaş-dön / zoom-whirl**). Parçacık olay ufkuna ($r_s = 2M$) dalarken kendi öz saati $\\tau$ sonlu kalır; uzak gözlemcinin koordinat saati $t$ ise sonsuza gider.',
      ],
      tasks: [
        '**Presesyonlu rozet** önayarında GR yörüngesi ile kesikli Newton elipsini karşılaştır ve tur başına enberi kaymasını oku.',
        '**Yakınlaş-dön (Zoom-Whirl)** önayarını seç; parçacığın $r_{\\text{ISCO}} = 6M$ içine dalıp foton küresi yakınında nasıl dolandığını izle.',
        '$L$ sürgüsünü $2\\sqrt{3} \\approx 3,46\\,M$ altına indirerek potansiyel bariyeri yok et ve parçacığın olay ufkuna dalışını gözlemle.',
        '**Merkür benzeri zayıf alan** önayarında $43^{\\prime\\prime}/\\text{yüzyıl}$ değerini ve büyütülmüş presesyon kıyasını incele.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const outEl = host.querySelector('[data-outcome]');
  const mercEl = host.querySelector('[data-merc]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cv = host.querySelector('[data-cv]');

  const sR0 = addSlider(slBox, {
    label: 'Başlangıç yarıçapı r₀', min: 3.2, max: 120, value: st.r0, step: 0.2,
    fmt: v => `${BH.formatNumTR(v, 1)} M`,
    onInput: v => { st.r0 = v; st.presetId = 'custom'; markPreset(host, -1); recompute(true); },
  });
  const sL = addSlider(slBox, {
    label: 'Açısal momentum L', min: 1.0, max: 12.0, value: st.L, step: 0.02,
    fmt: v => `${BH.formatNumTR(v, 2)} M`,
    onInput: v => { st.L = v; st.presetId = 'custom'; markPreset(host, -1); recompute(true); },
  });
  const sE = addSlider(slBox, {
    label: 'Özgül enerji E', min: 0.88, max: 1.15, value: st.E, step: 0.002,
    fmt: v => BH.formatNumTR(v, 4),
    onInput: v => { st.E = v; st.presetId = 'custom'; markPreset(host, -1); recompute(true); },
  });
  const sSpeed = addSlider(slBox, {
    label: 'Oynatma hızı', min: 0.2, max: 3.0, value: st.speed, step: 0.1,
    fmt: v => `${BH.formatNumTR(v, 1)}×`,
    onInput: v => { st.speed = v; },
  });
  const tInward = addToggle(slBox, 'Başlangıçta içe doğru (dr/dτ < 0)', st.inward, v => {
    st.inward = v; recompute(true);
  });
  const tNewton = addToggle(slBox, 'Newton karşılaştırma elipsini göster', st.showNewton, v => {
    st.showNewton = v; canvasCtl.render();
  });
  const tMag = addToggle(slBox, 'Zayıf alan presesyonunu 4× büyüt', st.magnifyPrecession, v => {
    st.magnifyPrecession = v; canvasCtl.render();
  });

  function updateReadouts() {
    const idx = clamp(Math.floor(st.progressIdx), 0, Math.max(0, simData.points.length - 1));
    const curPt = simData.points[idx] || simData.points[0];
    const curTau = simData.tauArr[idx] || 0;
    const curT = simData.tArr[idx] ?? 0;
    const precTxt = Number.isFinite(simData.precessionDeg)
      ? `${BH.formatNumTR(simData.precessionDeg, 1)}° / tur`
      : '—';
    const precSub = Number.isFinite(simData.precessionRad)
      ? `${BH.formatNumTR(simData.precessionRad, 3)} rad`
      : (simData.outcome.code === 'captured' ? 'ufka daldı' : 'açık yörünge');

    outEl.textContent = simData.outcome.label;
    outEl.className = `bhs-badge bhs-badge-${simData.outcome.tone}`;

    renderKpis(kpisEl, [
      { lbl: 'Anlık yarıçap r', val: Number.isFinite(curPt?.r) ? `${BH.formatNumTR(curPt.r, 2)} M` : '∞', sub: `r_min = ${BH.formatNumTR(simData.gr.rMin, 2)} M`, tone: 'acc' },
      { lbl: 'Enberi presesyonu Δφ', val: precTxt, sub: precSub },
      { lbl: 'Öz zaman τ', val: `${BH.formatNumTR(curTau, 1)} M`, sub: `E = ${BH.formatNumTR(simData.gr.E0, 4)}` },
      { lbl: 'Koordinat zamanı t', val: Number.isFinite(curT) ? `${BH.formatNumTR(curT, 1)} M` : '∞ (ufuk)', sub: Number.isFinite(curT) && curT > 1e-6 ? `τ/t = ${BH.formatNumTR(curTau / curT, 3)}` : 'ufukta donar' },
    ]);

    const showMerc = st.presetId === 'mercury-weak' || st.r0 > 55;
    mercEl.hidden = !showMerc;
    if (showMerc) {
      mercEl.innerHTML = richTex(`**Merkür gerçek GR referansı** ($a = 5,79\\times 10^{10}\\,\\text{m}$, $e = 0,2056$): tur başına $${BH.formatNumTR(mercRef.arcsecPerOrbit, 4)}''$, yüzyılda **$${BH.formatNumTR(mercRef.arcsecPerCentury, 2)}''/\\text{yüzyıl}$**.`);
    }
  }

  function recompute(resetCursor = false) {
    // E minimumunu koru ama kullanıcı sürgüsünü zorlamadan etkin değeri kullan
    const V0 = BH.effectivePotentialMassive(Math.max(2.15, st.r0), Math.max(0.25, st.L));
    const Emin = Math.sqrt(Math.max(0, V0));
    if (st.E < Emin) {
      st.E = +Math.min(1.15, Emin + 0.0005).toFixed(4);
      sE.set(st.E);
    }
    simData = computeOrbitSimulation({
      r0: st.r0,
      L: st.L,
      E: st.E,
      inward: st.inward,
      phi0: st.phi0,
      maxPhi: st.maxPhi,
      rMax: Math.max(200, st.r0 * 4),
    });
    const boundR = Number.isFinite(simData.gr.rMax) ? simData.gr.rMax : st.r0 * 1.6;
    st.viewR = clamp(Math.max(st.r0 * 1.22, Math.min(boundR * 1.15, st.r0 * 2.2), 12), 10, 150);
    if (resetCursor) st.progressIdx = 0;
    updateReadouts();
    canvasCtl.render();
  }

  function drawScene(c, W, H) {
    c.clearRect(0, 0, W, H);
    const cx = W * 0.5;
    const cy = H * 0.5;
    const pad = 26;
    const maxR = Math.max(10, st.viewR);
    const scale = (Math.min(W, H) * 0.5 - pad) / maxR;
    lastGeo = { cx, cy, scale };
    const acc = accentColor();

    // Kutupsal ızgara çemberleri
    c.save();
    c.strokeStyle = COL_GRID;
    c.lineWidth = 1;
    const stepR = maxR > 60 ? 25 : maxR > 25 ? 10 : 5;
    for (let r = stepR; r <= maxR; r += stepR) {
      c.beginPath();
      c.arc(cx, cy, r * scale, 0, Math.PI * 2);
      c.stroke();
    }
    // Eksen çizgileri
    c.beginPath();
    c.moveTo(cx - maxR * scale, cy);
    c.lineTo(cx + maxR * scale, cy);
    c.moveTo(cx, cy - maxR * scale);
    c.lineTo(cx, cy + maxR * scale);
    c.stroke();
    c.restore();

    // Kara delik + foton küresi + ISCO
    drawBlackHoleDisk(c, cx, cy, 2 * scale, 3 * scale, 6 * scale, acc);

    // Newton karşılaştırma elipsi
    if (st.showNewton && simData.newtonPts.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(90, 176, 255, 0.58)';
      c.lineWidth = 1.6;
      c.setLineDash([5, 5]);
      c.beginPath();
      simData.newtonPts.forEach((p, i) => {
        const px = cx + p.x * scale;
        const py = cy - p.y * scale;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.stroke();
      c.restore();
    }

    // GR yörüngesi (büyütülmüş presesyon seçeneği destekli)
    const pts = simData.points;
    const magMult = st.magnifyPrecession && simData.outcome.code === 'bound' && Number.isFinite(simData.precessionRad) && simData.precessionRad < 0.6
      ? 4.0
      : 1.0;
    const mapPt = p => {
      if (magMult === 1.0) return { x: cx + p.x * scale, y: cy - p.y * scale };
      // Her 2π turda ekstra presesyon açısını görünür kıl
      const extraAng = (magMult - 1) * simData.precessionRad * ((p.phi - st.phi0) / (2 * Math.PI));
      const ang = p.phi + extraAng;
      return { x: cx + p.r * Math.cos(ang) * scale, y: cy - p.r * Math.sin(ang) * scale };
    };

    // Tüm yol önizlemesi (sönük)
    if (pts.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      c.lineWidth = 1.25;
      c.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const q = mapPt(pts[i]);
        if (i === 0) c.moveTo(q.x, q.y);
        else c.lineTo(q.x, q.y);
      }
      c.stroke();

      // Canlı iz (parçacığın o ana kadar çizdiği kısım)
      const headIdx = clamp(Math.floor(st.progressIdx), 0, pts.length - 1);
      c.strokeStyle = acc;
      c.lineWidth = 2.2;
      c.beginPath();
      for (let i = 0; i <= headIdx; i++) {
        const q = mapPt(pts[i]);
        if (i === 0) c.moveTo(q.x, q.y);
        else c.lineTo(q.x, q.y);
      }
      c.stroke();

      // Başlangıç noktası ve sürüklenebilir yerel hız vektörü
      const pStart = mapPt(pts[0]);
      const br = simData.init.betaR;
      const bp = simData.init.betaPhi;
      const cos0 = Math.cos(st.phi0);
      const sin0 = Math.sin(st.phi0);
      const vxWorld = br * cos0 - bp * sin0;
      const vyWorld = br * sin0 + bp * cos0;
      const vecPx = clamp(Math.min(W, H) * 0.22, 46, 92);
      const tipX = pStart.x + vxWorld * vecPx;
      const tipY = pStart.y - vyWorld * vecPx;
      drawArrow2D(c, pStart.x, pStart.y, tipX, tipY, COL_OK, 2.1, 'v₀');
      c.fillStyle = COL_OK;
      c.beginPath();
      c.arc(tipX, tipY, 5, 0, Math.PI * 2);
      c.fill();

      // Başlangıç konum tutamacı
      c.fillStyle = '#09090d';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(pStart.x, pStart.y, 5.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Hareketli parçacık başı
      const head = mapPt(pts[headIdx]);
      c.fillStyle = '#fff';
      c.shadowColor = acc;
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(head.x, head.y, 5.2, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.restore();
    }

    // Ölçek bilgisi
    c.save();
    c.font = '500 11px "JetBrains Mono", monospace';
    c.fillStyle = COL_MUTE;
    c.textAlign = 'left';
    c.fillText(`rₛ = 2M · r_ph = 3M · r_ISCO = 6M${magMult > 1 ? ' · (4× presesyon büyütme)' : ''}`, 10, H - 10);
    c.restore();
  }

  const canvasCtl = setupCanvas(cv, w => clamp(w * 0.68, 280, 440), drawScene, clean);

  // Tuval üzerinde konum veya hız vektörünü sürükleme
  bindDragCanvas(cv, {
    onDown: p => {
      const pts = simData.points;
      if (!pts.length) return false;
      const p0x = lastGeo.cx + pts[0].x * lastGeo.scale;
      const p0y = lastGeo.cy - pts[0].y * lastGeo.scale;
      const br = simData.init.betaR;
      const bp = simData.init.betaPhi;
      const cos0 = Math.cos(st.phi0);
      const sin0 = Math.sin(st.phi0);
      const vecPx = clamp(Math.min(p.W, p.H) * 0.22, 46, 92);
      const tipX = p0x + (br * cos0 - bp * sin0) * vecPx;
      const tipY = p0y - (br * sin0 + bp * cos0) * vecPx;

      if (Math.hypot(p.x - tipX, p.y - tipY) < 26) {
        dragKind = 'vel';
        return true;
      }
      if (Math.hypot(p.x - p0x, p.y - p0y) < 28) {
        dragKind = 'pos';
        return true;
      }
      // Herhangi bir yere tıkla/sürükle -> yeni başlangıç konumu
      dragKind = 'pos';
      return true;
    },
    onMove: (p, active) => {
      if (!active || !dragKind) return;
      if (dragKind === 'pos') {
        const wx = (p.x - lastGeo.cx) / lastGeo.scale;
        const wy = -(p.y - lastGeo.cy) / lastGeo.scale;
        const nr = clamp(Math.hypot(wx, wy), 3.2, 120);
        st.r0 = +nr.toFixed(2);
        st.phi0 = Math.atan2(wy, wx);
        st.presetId = 'custom';
        markPreset(host, -1);
        sR0.set(st.r0);
        recompute(true);
      } else if (dragKind === 'vel') {
        const p0x = lastGeo.cx + st.r0 * Math.cos(st.phi0) * lastGeo.scale;
        const p0y = lastGeo.cy - st.r0 * Math.sin(st.phi0) * lastGeo.scale;
        const vecPx = clamp(Math.min(p.W, p.H) * 0.22, 46, 92);
        const vx = (p.x - p0x) / vecPx;
        const vy = -(p.y - p0y) / vecPx;
        const cos0 = Math.cos(st.phi0);
        const sin0 = Math.sin(st.phi0);
        const betaR = vx * cos0 + vy * sin0;
        const betaPhi = Math.max(0.06, -vx * sin0 + vy * cos0);
        const next = orbitParamsFromLocalVelocity(st.r0, betaR, betaPhi);
        if (next.valid) {
          st.L = clamp(next.L, 1.0, 12.0);
          st.E = clamp(next.E, 0.88, 1.15);
          st.inward = next.drDtau0 < 0;
          st.presetId = 'custom';
          markPreset(host, -1);
          sL.set(st.L);
          sE.set(st.E);
          tInward.set(st.inward);
          recompute(true);
        }
      }
    },
    onUp: () => { dragKind = null; },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const total = Math.max(1, simData.points.length - 1);
    const rate = (isReducedMotion() ? 0.35 : 1.0) * st.speed * Math.max(45, total * 0.14);
    st.progressIdx += dt * rate;
    if (st.progressIdx >= total) {
      if (simData.outcome.code === 'captured' || simData.outcome.code === 'escaped') {
        st.progressIdx = total;
        updateReadouts();
        canvasCtl.render();
        st.playing = false;
        syncPlayBtn(playBtn, false);
        return false;
      }
      st.progressIdx = st.progressIdx % total;
    }
    updateReadouts();
    canvasCtl.render();
    return true;
  }, clean);

  const onPlayClick = () => {
    if (st.progressIdx >= simData.points.length - 1) st.progressIdx = 0;
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onResetClick = () => {
    st.progressIdx = 0;
    updateReadouts();
    canvasCtl.render();
    if (st.playing) loop.start();
  };
  playBtn.addEventListener('click', onPlayClick);
  resetBtn.addEventListener('click', onResetClick);
  clean.add(() => {
    playBtn.removeEventListener('click', onPlayClick);
    resetBtn.removeEventListener('click', onResetClick);
    host.innerHTML = '';
  });

  bindPresets(host, ORBIT_PRESETS, p => {
    st.presetId = p.id;
    st.r0 = p.r0;
    st.L = p.L;
    st.E = p.E;
    st.inward = p.inward;
    st.phi0 = 0;
    st.maxPhi = p.maxPhi;
    st.magnifyPrecession = !!p.magnifyPrecession;
    sR0.set(st.r0);
    sL.set(st.L);
    sE.set(st.E);
    tInward.set(st.inward);
    tMag.set(st.magnifyPrecession);
    recompute(true);
    if (autoPlayAllowed()) {
      st.playing = true;
      syncPlayBtn(playBtn, true);
      loop.start();
    }
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncPlayBtn(playBtn, st.playing);
  recompute(true);
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 2: ETKİN POTANSİYEL (bh-potential)
// =====================================================================

function mountPotential(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const st = {
    mode: 'massive', // 'massive' | 'null'
    L: 4.3,
    E2: 0.945,
    invB2: 1 / 32,
    playing: autoPlayAllowed(),
    beadPhase: 0,
  };
  let grGeo = { padL: 46, padR: 16, padT: 20, padB: 30, yMin: -0.1, yMax: 0.08, rMin: 2, rMax: 30 };

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Kütleli parçacıklar ve ışık için Schwarzschild **etkin potansiyeli** $V_{\\text{eff}}(r)$ ile Newton potansiyelini yan yana incele. Grafikteki **enerji çizgisini** yukarı-aşağı sürükleyerek dönüm noktalarını ve $L = 2\\sqrt{3}\\,M$ değerinde ISCO birleşimini gör.', POTENTIAL_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Parametreler (M = 1)</h4>
          <span class="bhs-badge bhs-badge-acc" data-regime></span>
        </div>
        <div class="seg bhs-seg-wrap" role="tablist" data-mode aria-label="Parçacık türü">
          <button type="button" data-m="massive" class="on">Kütleli parçacık</button>
          <button type="button" data-m="null">Işık (foton)</button>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Test parçacığını oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-isco-btn aria-label="ISCO değerine ayarla">ISCO (L = 2√3)</button>
        </div>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-alert bhs-alert-acc" data-note></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-grid-eq">
          <div class="bhs-plot-card">
            <div class="bhs-head">
              <h4 class="bhs-title" data-gr-title>Genel Görelilik Etkin Potansiyeli</h4>
              <span class="bhs-hint">Enerji çizgisini sürükle</span>
            </div>
            <div class="bhs-cv-box">
              <canvas class="bhs-cv bhs-cv-drag" data-cv-gr aria-label="Genel görelilik etkin potansiyel grafiği"></canvas>
              <div class="bhs-cv-tag">Dikey sürükle: enerji seviyesi</div>
            </div>
          </div>
          <div class="bhs-plot-card">
            <div class="bhs-head">
              <h4 class="bhs-title">Newton Karşılaştırması</h4>
              <span class="bhs-hint" data-nw-sub>V_N(r) = −1/r + L²/(2r²)</span>
            </div>
            <div class="bhs-cv-box">
              <canvas class="bhs-cv" data-cv-nw aria-label="Newton etkin potansiyeli karşılaştırma grafiği"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\tilde{V}_{\\text{GR}}(r) = \\frac{V_{\\text{eff}}(r) - 1}{2} = -\\frac{1}{r} + \\frac{L^2}{2r^2} - \\frac{L^2}{r^3}, \\qquad r_{\\pm} = \\frac{L^2 \\pm L\\sqrt{L^2 - 12}}{2}',
        'V_{\\text{N}}(r) = -\\frac{1}{r} + \\frac{L^2}{2r^2} \\; (\\text{sonsuz merkezkaç duvarı}), \\qquad \\frac{V_{\\text{null}}(r)}{L^2} = \\frac{1}{r^2}\\left(1 - \\frac{2}{r}\\right)',
      ],
      paragraphs: [
        'Newton potansiyelinde $L > 0$ olan her parçacık $+L^2/(2r^2)$ merkezkaç duvarı yüzünden merkeze asla düşmez. Genel görelilikte eklenen **$-L^2/r^3$** çekici terimi küçük yarıçaplarda baskın çıkar ve potansiyeli aşağı büker.',
        '$L > 2\\sqrt{3}\\,M \\approx 3,464\\,M$ iken bir **kararsız tepe** ($r_-$) ve bir **kararlı kuyu** ($r_+$) bulunur. $L$ azaltılıp tam **$2\\sqrt{3}\\,M$** değerine inince iki ekstremum **$r = 6M$ (ISCO)** noktasında birleşir ve daha küçük $L$ değerlerinde artık hiçbir dairesel yörünge kalmaz.',
        'Işık için etkin potansiyel $V_{\\text{null}}/L^2 = (1 - 2/r)/r^2$ tam **$r = 3M$** foton küresinde $1/27 = 1/b_c^2$ tepe değerine ulaşır; kararlı kuyu yoktur.',
      ],
      tasks: [
        'Kütleli modda $L$ sürgüsünü $4,5\\,M$\'den $3,46\\,M$\'ye yavaşça indirerek kararlı ($r_+$) ve kararsız ($r_-$) noktalarının **$r = 6M$** ISCO\'da birleşmesini izle.',
        'Enerji çizgisini kuyu tabanından tepeye doğru sürükleyerek bağlı dönüm noktalarının nasıl genişlediğini ve tepeyi aşınca parçacığın neden ufka daldığını gör.',
        '**Işık (foton)** sekmesine geç ve enerji çizgisini $1/b_c^2 = 1/27$ tepesinin altına ve üstüne sürükle.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const regEl = host.querySelector('[data-regime]');
  const noteEl = host.querySelector('[data-note]');
  const grTitle = host.querySelector('[data-gr-title]');
  const nwSub = host.querySelector('[data-nw-sub]');
  const playBtn = host.querySelector('[data-play]');
  const iscoBtn = host.querySelector('[data-isco-btn]');
  const cvGr = host.querySelector('[data-cv-gr]');
  const cvNw = host.querySelector('[data-cv-nw]');

  const sL = addSlider(slBox, {
    label: 'Açısal momentum L', min: 2.2, max: 6.0, value: st.L, step: 0.01,
    fmt: v => `${BH.formatNumTR(v, 2)} M`,
    onInput: v => { st.L = v; markPreset(host, -1); update(); },
  });
  const sE2 = addSlider(slBox, {
    label: 'Enerji seviyesi E²', min: 0.80, max: 1.16, value: st.E2, step: 0.002,
    fmt: v => `${BH.formatNumTR(v, 3)} (E = ${BH.formatNumTR(Math.sqrt(v), 3)})`,
    onInput: v => { st.E2 = v; markPreset(host, -1); update(); },
  });
  const sInvB2 = addSlider(slBox, {
    label: 'Işık düzeyi 1/b²', min: 0.005, max: 0.065, value: st.invB2, step: 0.0005,
    fmt: v => `${BH.formatNumTR(v, 4)} M⁻² (b = ${BH.formatNumTR(1 / Math.sqrt(v), 2)} M)`,
    onInput: v => { st.invB2 = v; markPreset(host, -1); update(); },
  });

  function syncModeUI() {
    const isNull = st.mode === 'null';
    sL.setVisible(!isNull);
    sE2.setVisible(!isNull);
    sInvB2.setVisible(isNull);
    iscoBtn.hidden = isNull;
    grTitle.textContent = isNull ? 'Işık Etkin Potansiyeli V_null / L²' : 'GR Etkin Potansiyeli (V_eff − 1)/2';
    nwSub.textContent = isNull ? 'Newton ışıkta bariyer/foton küresi üretmez' : 'V_N(r) = −1/r + L²/(2r²)';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    syncSegments(host, false);
  }

  function update() {
    if (st.mode === 'massive') {
      const a = analyzePotentialMassive(st.L, st.E2);
      regEl.textContent = a.regime.label;
      regEl.className = `bhs-badge bhs-badge-${a.regime.tone}`;
      const tpTxt = a.turningPoints.length
        ? a.turningPoints.map(x => `${BH.formatNumTR(x, 2)} M`).join(' · ')
        : 'Yok (dalış)';
      renderKpis(kpisEl, [
        { lbl: 'Kararlı yörünge r₊', val: Number.isFinite(a.rStable) ? `${BH.formatNumTR(a.rStable, 2)} M` : 'Yok', sub: Number.isFinite(a.vMin) ? `E_min = ${BH.formatNumTR(Math.sqrt(a.vMin), 4)}` : 'L < 2√3 M', tone: a.isIsco ? 'acc' : 'ok' },
        { lbl: 'Kararsız tepe r₋', val: Number.isFinite(a.rUnstable) ? `${BH.formatNumTR(a.rUnstable, 2)} M` : 'Yok', sub: Number.isFinite(a.vMax) ? `E_tepe = ${BH.formatNumTR(Math.sqrt(a.vMax), 4)}` : 'bariyer yok', tone: 'warn' },
        { lbl: 'GR dönüm noktaları', val: tpTxt, sub: `Ẽ = ${BH.formatNumTR(a.eTilde, 4)}` },
        { lbl: 'Newton minimumu r_N', val: `${BH.formatNumTR(a.newtonRMin, 2)} M`, sub: `V_N,min = ${BH.formatNumTR(a.newtonVMin, 4)}` },
      ]);
      noteEl.innerHTML = a.isIsco
        ? richTex('**ISCO birleşimi!** $L = 2\\sqrt{3}\\,M \\approx 3,464\\,M$ değerinde $r_-$ ve $r_+$ tam $r = 6M$ noktasında büküm noktası olarak birleşir ($E = \\sqrt{8/9} \\approx 0,9428$).')
        : a.hasBarrier
          ? richTex(`Bariyer yüksekliği $E_{\\text{tepe}} = ${BH.formatNumTR(Math.sqrt(a.vMax), 4)}$. Enerjiyi bu tepenin üstüne çıkarırsan parçacık merkezkaç engelini aşarak olay ufkuna ($r_s = 2M$) dalar.`)
          : richTex('$L < 2\\sqrt{3}\\,M$ olduğu için genel görelilikte hiçbir bariyer kalmaz; oysa sağdaki Newton potansiyelinde merkezkaç duvarı hâlâ sonsuza çıkar!');
    } else {
      const a = analyzePotentialNull(st.invB2);
      regEl.textContent = a.regime.label;
      regEl.className = `bhs-badge bhs-badge-${a.regime.tone}`;
      const tpTxt = a.turningPoints.length
        ? a.turningPoints.map(x => `${BH.formatNumTR(x, 2)} M`).join(' · ')
        : 'Yok (yakalanır)';
      renderKpis(kpisEl, [
        { lbl: 'Çarpışma parametresi b', val: `${BH.formatNumTR(a.b, 2)} M`, sub: `1/b² = ${BH.formatNumTR(a.invB2, 4)} M⁻²`, tone: 'acc' },
        { lbl: 'Kritik sınır b_c', val: `${BH.formatNumTR(B_CRIT_M, 3)} M`, sub: '1/b_c² = 1/27 ≈ 0,0370' },
        { lbl: 'Foton küresi r_ph', val: '3,00 M', sub: 'kararsız tepe (r = 1,5 rₛ)', tone: 'warn' },
        { lbl: 'Dönüm noktaları', val: tpTxt, sub: a.b > B_CRIT_M ? 'en yakın geçiş r_min' : 'ufka yakalanma' },
      ]);
      noteEl.innerHTML = richTex('Işık için potansiyel bariyeri yalnızca $r = 3M$ konumundaki kararsız tepeden oluşur. $1/b^2 > 1/27$ (yani $b < 3\\sqrt{3}\\,M$) olan tüm ışınlar yakalanır.');
    }
    cvGrCtl.render();
    cvNwCtl.render();
  }

  function drawGR(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 48, padR = 14, padT = 22, padB = 30;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const isNull = st.mode === 'null';
    const rMin = 2.0;
    const rMax = isNull ? 16 : Math.max(24, Math.min(48, st.L * st.L * 1.45));
    const yMin = isNull ? -0.004 : -0.14;
    const yMax = isNull ? 0.068 : 0.10;
    grGeo = { padL, padR, padT, padB, yMin, yMax, rMin, rMax, pw, ph };

    const fx = r => padL + ((r - rMin) / (rMax - rMin)) * pw;
    const fy = y => padT + ((yMax - y) / (yMax - yMin)) * ph;
    const acc = accentColor();

    // Olay ufku bölgesi
    c.save();
    c.fillStyle = 'rgba(255, 107, 107, 0.07)';
    c.fillRect(padL, padT, 2, ph);

    // Yatay ve dikey ızgara
    c.strokeStyle = COL_GRID;
    c.lineWidth = 1;
    c.font = '10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_MUTE;
    const yTicks = isNull ? [0, 0.02, 1 / 27, 0.05] : [-0.12, -0.08, -0.04, 0, 0.04, 0.08];
    for (const yv of yTicks) {
      const py = fy(yv);
      c.strokeStyle = Math.abs(yv) < 1e-6 ? COL_AXIS : COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.textAlign = 'right';
      c.fillText(isNull ? BH.formatNumTR(yv, 3) : BH.formatNumTR(yv, 2), padL - 6, py + 3.5);
    }
    const rStep = rMax > 32 ? 8 : rMax > 20 ? 5 : 2;
    for (let rv = 2; rv <= rMax; rv += rStep) {
      const px = fx(rv);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.textAlign = 'center';
      c.fillText(`${rv}M`, px, H - 10);
    }
    // r = 6M (ISCO) veya r = 3M (foton küresi) referans dikey çizgisi
    const rRef = isNull ? 3 : 6;
    const rxRef = fx(rRef);
    c.strokeStyle = isNull ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 209, 102, 0.35)';
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(rxRef, padT); c.lineTo(rxRef, padT + ph); c.stroke();
    c.setLineDash([]);
    c.fillStyle = isNull ? COL_CYAN : COL_WARN;
    c.textAlign = 'left';
    c.fillText(isNull ? 'r_ph = 3M' : 'ISCO = 6M', rxRef + 4, padT + 12);

    // Kırpma alanı içinde potansiyel eğrisi ve yasak bölge taraması
    c.save();
    c.beginPath();
    c.rect(padL, padT, pw, ph);
    c.clip();

    const yLevel = isNull ? st.invB2 : 0.5 * (st.E2 - 1);
    const evalV = r => (isNull ? BH.effectivePotentialNull(r, 1) : 0.5 * (BH.effectivePotentialMassive(r, st.L) - 1));

    // Yasak bölge dolgusu (V > enerji)
    c.fillStyle = 'rgba(255, 107, 107, 0.14)';
    c.beginPath();
    let inForb = false;
    const N = 260;
    for (let i = 0; i <= N; i++) {
      const r = rMin + ((rMax - rMin) * i) / N;
      const v = evalV(r);
      const px = fx(r);
      if (v > yLevel) {
        if (!inForb) {
          c.moveTo(px, fy(yLevel));
          inForb = true;
        }
        c.lineTo(px, fy(v));
      } else if (inForb) {
        c.lineTo(px, fy(yLevel));
        c.closePath();
        inForb = false;
      }
    }
    if (inForb) {
      c.lineTo(fx(rMax), fy(yLevel));
      c.closePath();
    }
    c.fill();

    // Potansiyel eğrisi
    c.strokeStyle = acc;
    c.lineWidth = 2.4;
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const r = rMin + ((rMax - rMin) * i) / N;
      const v = evalV(r);
      const px = fx(r);
      const py = fy(v);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.stroke();

    // Sürüklenebilir enerji çizgisi
    const pyE = fy(yLevel);
    c.strokeStyle = COL_OK;
    c.lineWidth = 1.9;
    c.setLineDash([7, 4]);
    c.beginPath();
    c.moveTo(padL, pyE);
    c.lineTo(padL + pw, pyE);
    c.stroke();
    c.setLineDash([]);

    // Tutamaç etiketi
    c.fillStyle = 'rgba(6, 8, 12, 0.88)';
    const eLbl = isNull ? `1/b² = ${BH.formatNumTR(st.invB2, 4)}` : `Ẽ = ${BH.formatNumTR(yLevel, 3)} (E = ${BH.formatNumTR(Math.sqrt(st.E2), 3)})`;
    const tw = c.measureText(eLbl).width + 12;
    c.fillRect(padL + pw - tw - 6, clamp(pyE - 18, padT + 2, padT + ph - 18), tw, 16);
    c.fillStyle = COL_OK;
    c.textAlign = 'right';
    c.fillText(eLbl, padL + pw - 10, clamp(pyE - 6, padT + 14, padT + ph - 6));

    // Ekstremum ve dönüm noktalarını işaretle
    if (!isNull) {
      const a = analyzePotentialMassive(st.L, st.E2, rMax * 2);
      if (Number.isFinite(a.rUnstable) && a.rUnstable <= rMax) {
        c.fillStyle = COL_BAD;
        c.beginPath();
        c.arc(fx(a.rUnstable), fy(a.vTildeMax), 5, 0, Math.PI * 2);
        c.fill();
      }
      if (Number.isFinite(a.rStable) && a.rStable <= rMax) {
        c.fillStyle = a.isIsco ? COL_WARN : COL_OK;
        c.beginPath();
        c.arc(fx(a.rStable), fy(a.vTildeMin), 5.5, 0, Math.PI * 2);
        c.fill();
      }
      for (const tp of a.turningPoints) {
        if (tp >= rMin && tp <= rMax) {
          c.fillStyle = '#fff';
          c.strokeStyle = COL_OK;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(fx(tp), pyE, 4.5, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      }
      // Hareketli test boncuğu
      let rBead = NaN;
      if (a.regime.kind === 'bound' && a.turningPoints.length >= 2) {
        const r1 = a.turningPoints[a.turningPoints.length - 2];
        const r2 = a.turningPoints[a.turningPoints.length - 1];
        rBead = 0.5 * (r1 + r2) + 0.5 * (r2 - r1) * Math.cos(st.beadPhase);
      } else if (a.regime.kind === 'stable-circular' || a.regime.kind === 'isco') {
        rBead = a.rStable;
      } else if (a.regime.kind === 'scattering' && a.turningPoints.length >= 1) {
        const rTurn = a.turningPoints[a.turningPoints.length - 1];
        const frac = Math.abs(Math.sin(st.beadPhase * 0.6));
        rBead = lerp(rTurn, Math.min(rMax, rTurn + 12), frac);
      } else {
        const frac = (st.beadPhase / (2 * Math.PI)) % 1;
        rBead = lerp(Math.min(rMax - 1, 18), 2.02, frac);
      }
      if (Number.isFinite(rBead) && rBead >= rMin && rBead <= rMax) {
        c.fillStyle = '#fff';
        c.shadowColor = acc;
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(fx(rBead), pyE, 5.5, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }
    } else {
      const a = analyzePotentialNull(st.invB2);
      c.fillStyle = COL_WARN;
      c.beginPath();
      c.arc(fx(3), fy(a.peak), 5.5, 0, Math.PI * 2);
      c.fill();
      for (const tp of a.turningPoints) {
        if (tp >= rMin && tp <= rMax) {
          c.fillStyle = '#fff';
          c.strokeStyle = COL_OK;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(fx(tp), pyE, 4.5, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      }
      const frac = (st.beadPhase / (2 * Math.PI)) % 1;
      let rBead;
      if (a.b > B_CRIT_M && a.turningPoints.length >= 2) {
        const rTurn = a.turningPoints[1];
        rBead = lerp(rTurn, rMax, Math.abs(Math.sin(st.beadPhase * 0.6)));
      } else {
        rBead = lerp(rMax, 2.02, frac);
      }
      c.fillStyle = COL_WARN;
      c.beginPath();
      c.arc(fx(rBead), pyE, 5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    c.restore();
  }

  function drawNewton(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 44, padR = 12, padT = 22, padB = 30;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const isNull = st.mode === 'null';
    const rMin = 2.0;
    const rMax = isNull ? 16 : Math.max(24, Math.min(48, st.L * st.L * 1.45));
    const yMin = isNull ? -0.004 : -0.14;
    const yMax = isNull ? 0.068 : 0.10;
    const fx = r => padL + ((r - rMin) / (rMax - rMin)) * pw;
    const fy = y => padT + ((yMax - y) / (yMax - yMin)) * ph;

    c.save();
    c.font = '10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_MUTE;
    const yTicks = isNull ? [0, 0.02, 0.04, 0.06] : [-0.12, -0.08, -0.04, 0, 0.04, 0.08];
    for (const yv of yTicks) {
      const py = fy(yv);
      c.strokeStyle = Math.abs(yv) < 1e-6 ? COL_AXIS : COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.textAlign = 'right';
      c.fillText(isNull ? BH.formatNumTR(yv, 2) : BH.formatNumTR(yv, 2), padL - 5, py + 3.5);
    }
    const rStep = rMax > 32 ? 10 : 6;
    for (let rv = 2; rv <= rMax; rv += rStep) {
      const px = fx(rv);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.textAlign = 'center';
      c.fillText(`${rv}M`, px, H - 10);
    }

    c.save();
    c.beginPath(); c.rect(padL, padT, pw, ph); c.clip();

    if (isNull) {
      // Newton foton potansiyeli 1/r² (bariyer yok, hep azalan)
      c.strokeStyle = COL_BLUE;
      c.lineWidth = 2.1;
      c.beginPath();
      for (let i = 0; i <= 200; i++) {
        const r = rMin + ((rMax - rMin) * i) / 200;
        const v = 1 / (r * r);
        const px = fx(r);
        const py = fy(v);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText('1/r²: Foton küresi yok', padL + pw * 0.56, padT + 20);
    } else {
      const eTilde = 0.5 * (st.E2 - 1);
      // GR referansı (sönük)
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.lineWidth = 1.3;
      c.setLineDash([4, 4]);
      c.beginPath();
      for (let i = 0; i <= 200; i++) {
        const r = rMin + ((rMax - rMin) * i) / 200;
        const vGr = 0.5 * (BH.effectivePotentialMassive(r, st.L) - 1);
        if (i === 0) c.moveTo(fx(r), fy(vGr));
        else c.lineTo(fx(r), fy(vGr));
      }
      c.stroke();
      c.setLineDash([]);

      // Newton eğrisi
      c.strokeStyle = COL_BLUE;
      c.lineWidth = 2.3;
      c.beginPath();
      for (let i = 0; i <= 200; i++) {
        const r = rMin + ((rMax - rMin) * i) / 200;
        const vN = -1 / r + (st.L * st.L) / (2 * r * r);
        if (i === 0) c.moveTo(fx(r), fy(vN));
        else c.lineTo(fx(r), fy(vN));
      }
      c.stroke();

      // Aynı enerji düzeyi
      const pyE = fy(eTilde);
      c.strokeStyle = COL_OK;
      c.lineWidth = 1.6;
      c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(padL, pyE); c.lineTo(padL + pw, pyE); c.stroke();
      c.setLineDash([]);

      const rN = st.L * st.L;
      if (rN <= rMax) {
        c.fillStyle = COL_BLUE;
        c.beginPath();
        c.arc(fx(rN), fy(-1 / (2 * rN)), 4.5, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = COL_BLUE;
      c.textAlign = 'left';
      c.fillText('↑ Merkezkaç duvarı (dalış yok)', padL + 8, padT + 14);
    }
    c.restore();
    c.restore();
  }

  const cvGrCtl = setupCanvas(cvGr, w => clamp(w * 0.72, 240, 340), drawGR, clean);
  const cvNwCtl = setupCanvas(cvNw, w => clamp(w * 0.72, 220, 340), drawNewton, clean);

  // Enerji çizgisini tuvalde sürükleme
  const setEnergyFromY = yPx => {
    const frac = clamp((yPx - grGeo.padT) / Math.max(1, grGeo.ph), 0, 1);
    const yVal = grGeo.yMax - frac * (grGeo.yMax - grGeo.yMin);
    if (st.mode === 'massive') {
      st.E2 = clamp(1 + 2 * yVal, 0.80, 1.16);
      sE2.set(st.E2);
    } else {
      st.invB2 = clamp(yVal, 0.005, 0.065);
      sInvB2.set(st.invB2);
    }
    markPreset(host, -1);
    update();
  };
  bindDragCanvas(cvGr, {
    onDown: p => { setEnergyFromY(p.y); return true; },
    onMove: (p, active) => { if (active) setEnergyFromY(p.y); },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.beadPhase = (st.beadPhase + dt * (isReducedMotion() ? 0.9 : 2.3)) % (Math.PI * 20);
    cvGrCtl.render();
    return true;
  }, clean);

  const onModeClick = e => {
    const b = e.target.closest?.('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    markPreset(host, -1);
    syncModeUI();
    update();
  };
  const onPlayClick = () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onIscoClick = () => {
    st.mode = 'massive';
    st.L = L_ISCO_M;
    st.E2 = 8 / 9;
    sL.set(st.L);
    sE2.set(st.E2);
    syncModeUI();
    markPreset(host, 0);
    update();
  };

  const modeBar = host.querySelector('[data-mode]');
  modeBar.addEventListener('click', onModeClick);
  playBtn.addEventListener('click', onPlayClick);
  iscoBtn.addEventListener('click', onIscoClick);
  clean.add(() => {
    modeBar.removeEventListener('click', onModeClick);
    playBtn.removeEventListener('click', onPlayClick);
    iscoBtn.removeEventListener('click', onIscoClick);
    host.innerHTML = '';
  });

  bindPresets(host, POTENTIAL_PRESETS, p => {
    st.mode = p.mode;
    if (p.L !== undefined) { st.L = p.L; sL.set(st.L); }
    if (p.E2 !== undefined) { st.E2 = p.E2; sE2.set(st.E2); }
    if (p.invB2 !== undefined) { st.invB2 = p.invB2; sInvB2.set(st.invB2); }
    syncModeUI();
    update();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 1);
  syncModeUI();
  syncPlayBtn(playBtn, st.playing);
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 3: IŞIĞIN BÜKÜLMESİ (bh-light)
// =====================================================================

function mountLight(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const p0 = LIGHT_PRESETS[0];
  const st = {
    probeB: p0.probeB,
    fanSpan: p0.fanSpan,
    rayCount: p0.rayCount,
    lensMode: p0.lensMode,
    betaRatio: p0.betaRatio,
    massSolar: 10,
    dLkpc: 2.0,
    dSkpc: 4.0,
    playing: autoPlayAllowed(),
    photonPhase: 0,
  };
  let fanRays = [];
  let probeRay = null;
  let rayGeo = { cx: 180, cy: 140, scale: 8, rClip: 22 };

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Kritik çarpışma parametresi $b_c = 3\\sqrt{3}\\,M \\approx 5,196\\,M$ çevresindeki ışık ışınlarını sıfır jeodeziklerle izle. Yakalanma, **foton küresi sarımı**, zayıf alan $4M/b$ sapması ve **Einstein halkası** geometrisini keşfet.', LIGHT_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Işın ve Mercek Kontrolleri</h4>
          <span class="bhs-badge bhs-badge-acc" data-status></span>
        </div>
        <div class="seg bhs-seg-wrap" role="tablist" data-view aria-label="Görünüm modu">
          <button type="button" data-v="rays" class="on">Işın demeti (GR)</button>
          <button type="button" data-v="lens">Einstein halkası</button>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Fotonları oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-bc-btn aria-label="b_c yakınını seç">b ≈ b_c + 0,01</button>
        </div>
        <div class="bhs-col" data-sliders></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title" data-cv-title>Schwarzschild Düzleminde Sıfır Jeodezikler</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_WARN}"></i>Seçili ışın (b)</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_BAD}"></i>Yakalanan (|b| &lt; b_c)</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_CYAN}"></i>Kaçan (|b| &gt; b_c)</span>
            </div>
          </div>
          <div class="bhs-cv-box">
            <canvas class="bhs-cv bhs-cv-drag" data-cv-main aria-label="Işık bükülmesi ve Einstein halkası tuvali"></canvas>
            <div class="bhs-cv-tag" data-drag-tag>Sürükle: seçili ışın b</div>
          </div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Sapma Açısı Δφ(b): Tam GR vs Zayıf Alan (4M/b)</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${PLOT_COLORS[4]}"></i>Tam GR</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${PLOT_COLORS[1]}"></i>Zayıf alan 4M/b</span>
            </div>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-curve aria-label="Sapma açısı grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{d^2 u}{d\\phi^2} = -u + 3u^2, \\qquad b_c = 3\\sqrt{3}\\,\\frac{GM}{c^2} \\approx 5,196\\,M',
        '\\Delta\\phi_{\\text{zayıf}} = \\frac{4GM}{c^2 b}, \\qquad \\theta_E = \\sqrt{\\frac{4GM}{c^2}\\frac{D_{LS}}{D_L D_S}}, \\qquad \\theta_{\\pm} = \\frac{\\beta \\pm \\sqrt{\\beta^2 + 4\\theta_E^2}}{2}',
      ],
      paragraphs: [
        'Çarpışma parametresi $b < b_c = 3\\sqrt{3}\\,M$ olan her foton foton küresini ($r_{\\text{ph}} = 3M$) aşarak olay ufkuna düşer; bu yüzden kara delik uzaktan $r_s = 2M$ değil $b_c \\approx 2,60\\,r_s$ yarıçaplı bir gölge oluşturur.',
        '$b$ değeri $b_c$\'ye üstten yaklaştıkça sapma açısı logaritmik olarak ıraksar ($\\Delta\\phi \\sim -\\ln(b - b_c)$) ve foton kaçmadan önce kara deliğin etrafında bir veya birkaç tam tur sarabilir.',
        'Uzak bir yıldız tam merceğin arkasına hizalandığında ($\\beta = 0$), tüm doğrultulardan simetrik bükülen ışık gökyüzünde $\\theta_E$ açısal yarıçaplı parlak bir **Einstein halkası** oluşturur.',
      ],
      tasks: [
        '**b ≈ b_c + 0,01** düğmesine bas ve seçili sarı ışının foton küresi çevresinde $360^\\circ$\'den fazla sarılarak geri döndüğünü gör.',
        '$b$ değerini $18\\,M$\'ye çıkararak tam GR sapmasının zayıf alan formülü $4M/b$ ile nasıl örtüştüğünü doğrula.',
        '**Einstein halkası** moduna geçip kaynak kayması $\\beta/\\theta_E$ sürgüsünü $0$\'dan $0,6$\'ya kaydırarak halkanın iki asimetrik yaya bölünmesini izle.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const statusEl = host.querySelector('[data-status]');
  const cvTitle = host.querySelector('[data-cv-title]');
  const dragTag = host.querySelector('[data-drag-tag]');
  const playBtn = host.querySelector('[data-play]');
  const bcBtn = host.querySelector('[data-bc-btn]');
  const cvMain = host.querySelector('[data-cv-main]');
  const cvCurve = host.querySelector('[data-cv-curve]');

  const sProbeB = addSlider(slBox, {
    label: 'Seçili ışın b', min: 1.5, max: 20.0, value: st.probeB, step: 0.01,
    fmt: v => `${BH.formatNumTR(v, 2)} M`,
    onInput: v => { st.probeB = v; markPreset(host, -1); recompute(); },
  });
  const sSpan = addSlider(slBox, {
    label: 'Demet genişliği b_maks', min: 8, max: 24, value: st.fanSpan, step: 1,
    fmt: v => `±${BH.formatNumTR(v, 0)} M`,
    onInput: v => { st.fanSpan = v; recompute(); },
  });
  const sBeta = addSlider(slBox, {
    label: 'Kaynak kayması β / θ_E', min: 0, max: 1.5, value: st.betaRatio, step: 0.02,
    fmt: v => BH.formatNumTR(v, 2),
    onInput: v => { st.betaRatio = v; markPreset(host, -1); recompute(); },
  });
  const sLensM = addSlider(slBox, {
    label: 'Mercek kütlesi M', min: 1, max: 1000, value: st.massSolar, log: true,
    fmt: v => formatMassSolarTR(v),
    onInput: v => { st.massSolar = v; recompute(); },
  });

  // Sabit Δφ(b) eğri verisi (b ∈ [5.21, 20])
  const curveB = [];
  const curveGR = [];
  const curveWeak = [];
  for (let i = 0; i <= 72; i++) {
    const u = i / 72;
    const b = B_CRIT_M + 0.015 + Math.pow(u, 2.2) * (20 - B_CRIT_M - 0.015);
    curveB.push(b);
    curveGR.push(BH.lightDeflectionAngle(b, { dphi: 0.005, maxPhi: 12 * Math.PI }) * RAD);
    curveWeak.push(BH.lightDeflectionWeakField(b) * RAD);
  }

  function syncViewMode() {
    sProbeB.setVisible(!st.lensMode);
    sSpan.setVisible(!st.lensMode);
    sBeta.setVisible(st.lensMode);
    sLensM.setVisible(st.lensMode);
    bcBtn.hidden = st.lensMode;
    cvTitle.textContent = st.lensMode
      ? 'Kütleçekimsel Merceklenme ve Einstein Halkası Geometrisi'
      : 'Schwarzschild Düzleminde Sıfır Jeodezikler';
    dragTag.textContent = st.lensMode
      ? 'Sürükle: kaynak konumu β'
      : 'Sürükle: seçili ışın b';
    host.querySelectorAll('[data-view] button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'lens') === st.lensMode));
    syncSegments(host, false);
  }

  function recompute() {
    const rClip = Math.max(18, st.fanSpan * 1.55);
    const bList = [];
    const half = Math.floor(st.rayCount / 2);
    for (let i = -half; i <= half; i++) {
      if (i === 0) continue;
      bList.push((i / half) * st.fanSpan);
    }
    // Foton küresi çevresine ekstra yakın ışınlar ekle
    bList.push(B_CRIT_M + 0.025, -(B_CRIT_M + 0.14));
    fanRays = computeLightFan(bList, { rClip, dphi: 0.005, maxPhi: 10 * Math.PI });
    probeRay = traceLightRay(st.probeB, { rClip, dphi: 0.003, maxPhi: 14 * Math.PI });

    if (!st.lensMode) {
      const cap = probeRay.captured;
      const pctErr = !cap && probeRay.weakFieldRad > 0
        ? ((probeRay.deflectionRad - probeRay.weakFieldRad) / probeRay.weakFieldRad) * 100
        : NaN;
      statusEl.textContent = cap ? 'Foton yakalandı (b < b_c)' : (probeRay.deflectionDeg > 180 ? 'Foton küresi sarımı!' : 'Saptı ve kaçtı');
      statusEl.className = `bhs-badge bhs-badge-${cap ? 'bad' : probeRay.deflectionDeg > 180 ? 'warn' : 'ok'}`;

      renderKpis(kpisEl, [
        { lbl: 'Tam GR sapması Δφ', val: cap ? '∞ (yakalandı)' : `${BH.formatNumTR(probeRay.deflectionDeg, 1)}°`, sub: cap ? 'olay ufkuna düştü' : `${BH.formatNumTR(probeRay.windingTurns, 2)} tur sarım`, tone: cap ? 'bad' : 'acc' },
        { lbl: 'Zayıf alan 4M/b', val: `${BH.formatNumTR(probeRay.weakFieldDeg, 1)}°`, sub: Number.isFinite(pctErr) ? `GR farkı: +%${BH.formatNumTR(pctErr, 1)}` : 'güçlü alan' },
        { lbl: 'En yakın geçiş r_min', val: `${BH.formatNumTR(probeRay.rMin, 2)} M`, sub: `b / b_c = ${BH.formatNumTR(st.probeB / B_CRIT_M, 3)}` },
        { lbl: 'Kritik sınır b_c', val: `${BH.formatNumTR(B_CRIT_M, 3)} M`, sub: '3√3 M ≈ 2,60 rₛ' },
      ]);
    } else {
      const lens = computeEinsteinLens({ massSolar: st.massSolar, dLkpc: st.dLkpc, dSkpc: st.dSkpc, betaRatio: st.betaRatio });
      statusEl.textContent = lens.isRing ? 'Tam Einstein halkası!' : 'Çift mercek görüntüsü';
      statusEl.className = `bhs-badge bhs-badge-${lens.isRing ? 'acc' : 'ok'}`;
      renderKpis(kpisEl, [
        { lbl: 'Einstein yarıçapı θ_E', val: `${BH.formatNumTR(lens.thetaEMas, 2)} mas`, sub: `D_L = ${BH.formatNumTR(st.dLkpc, 1)} kpc, D_S = ${BH.formatNumTR(st.dSkpc, 1)} kpc`, tone: 'acc' },
        { lbl: 'Birincil görüntü θ₊', val: `${BH.formatNumTR(lens.thetaPlusRatio, 2)} θ_E`, sub: `${BH.formatNumTR(lens.thetaPlusMas, 2)} mas` },
        { lbl: 'İkincil görüntü θ₋', val: `${BH.formatNumTR(lens.thetaMinusRatio, 2)} θ_E`, sub: 'terslenmiş iç yay' },
        { lbl: 'Toplam büyütme μ', val: Number.isFinite(lens.muTotal) ? `${BH.formatNumTR(lens.muTotal, 2)}×` : '∞ (halka)', sub: `β = ${BH.formatNumTR(st.betaRatio, 2)} θ_E`, tone: 'ok' },
      ]);
    }

    mainCtl.render();
    curveCtl.render();
  }

  function drawMain(c, W, H) {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (!st.lensMode) {
      const rClip = Math.max(18, st.fanSpan * 1.55);
      const cx = W * 0.54;
      const cy = H * 0.5;
      const scale = Math.min((W * 0.44) / rClip, (H * 0.46) / Math.max(10, st.fanSpan * 1.15));
      rayGeo = { cx, cy, scale, rClip };

      // Kritik çarpışma parametre bantları (±b_c)
      c.save();
      c.strokeStyle = 'rgba(255, 107, 107, 0.25)';
      c.setLineDash([4, 5]);
      c.lineWidth = 1;
      for (const sgn of [-1, 1]) {
        const ybc = cy - sgn * B_CRIT_M * scale;
        c.beginPath(); c.moveTo(8, ybc); c.lineTo(cx, ybc); c.stroke();
      }
      c.setLineDash([]);
      c.font = '10.5px "JetBrains Mono", monospace';
      c.fillStyle = COL_BAD;
      c.fillText('b = +b_c (3√3 M)', 10, cy - B_CRIT_M * scale - 5);

      // Işın demeti
      const drawRay = (ray, highlight) => {
        if (ray.pts.length < 2) return;
        c.strokeStyle = highlight
          ? COL_WARN
          : (ray.captured ? 'rgba(255, 107, 107, 0.55)' : 'rgba(56, 189, 248, 0.45)');
        c.lineWidth = highlight ? 2.6 : 1.25;
        c.beginPath();
        ray.pts.forEach((pt, idx) => {
          const px = cx + pt.x * scale;
          const py = cy - pt.y * scale;
          if (idx === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        });
        c.stroke();

        // Hareketli foton paketi
        const phase = (st.photonPhase + Math.abs(ray.b) * 0.07) % 1;
        const pIdx = Math.min(ray.pts.length - 1, Math.floor(phase * (ray.pts.length - 1)));
        const fp = ray.pts[pIdx];
        c.fillStyle = highlight ? '#fff' : (ray.captured ? COL_BAD : COL_CYAN);
        c.beginPath();
        c.arc(cx + fp.x * scale, cy - fp.y * scale, highlight ? 4.2 : 2.3, 0, Math.PI * 2);
        c.fill();
      };

      for (const r of fanRays) drawRay(r, false);
      if (probeRay) drawRay(probeRay, true);

      // Seçili ışın tutamacı (sol kenarda)
      const hY = cy - st.probeB * scale;
      c.fillStyle = COL_WARN;
      c.strokeStyle = '#000';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(24, clamp(hY, 18, H - 18), 6.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      drawBlackHoleDisk(c, cx, cy, 2 * scale, 3 * scale, 0, acc);
      c.restore();
    } else {
      // Einstein halkası: sol tarafta yandan ışın geometrisi, sağ tarafta gökyüzü görüntüsü
      const lens = computeEinsteinLens({ massSolar: st.massSolar, dLkpc: st.dLkpc, dSkpc: st.dSkpc, betaRatio: st.betaRatio });
      const splitX = W * 0.54;
      const midY = H * 0.52;
      c.save();

      // Sol: optik eksen ve bükülen 2 ışın
      const xSrc = 26;
      const xLens = splitX * 0.52;
      const xObs = splitX - 24;
      const yScale = Math.min(H * 0.22, 62);
      const ySrc = midY - st.betaRatio * yScale * 0.55;
      const yTop = midY - lens.thetaPlusRatio * yScale * 0.65;
      const yBot = midY - lens.thetaMinusRatio * yScale * 0.65;

      c.strokeStyle = COL_GRID;
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(xSrc, midY); c.lineTo(xObs, midY); c.stroke();
      c.setLineDash([]);

      // Işınlar (kaynak -> mercek -> gözlemci)
      c.strokeStyle = COL_WARN;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(xSrc, ySrc); c.lineTo(xLens, yTop); c.lineTo(xObs, midY); c.stroke();
      c.strokeStyle = COL_CYAN;
      c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(xSrc, ySrc); c.lineTo(xLens, yBot); c.lineTo(xObs, midY); c.stroke();

      // Gözlemcinin gördüğü sanal doğrultular
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(xObs, midY); c.lineTo(xSrc, midY + (yTop - midY) * 2);
      c.moveTo(xObs, midY); c.lineTo(xSrc, midY + (yBot - midY) * 2);
      c.stroke();
      c.setLineDash([]);

      // Kaynak yıldız, mercek kara delik, gözlemci
      c.fillStyle = COL_WARN;
      c.beginPath(); c.arc(xSrc, ySrc, 5.5, 0, Math.PI * 2); c.fill();
      drawBlackHoleDisk(c, xLens, midY, 10, 14, 0, acc);
      c.fillStyle = COL_OK;
      c.beginPath(); c.arc(xObs, midY, 5, 0, Math.PI * 2); c.fill();

      c.font = '10.5px "JetBrains Mono", monospace';
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText('Kaynak', xSrc + 6, H - 12);
      c.fillText('Kara Delik', xLens, H - 12);
      c.fillText('Gözlemci', xObs - 8, H - 12);

      // Ayırıcı çizgi
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(splitX, 14); c.lineTo(splitX, H - 14); c.stroke();

      // Sağ: Gökyüzünde gözlenen Einstein halkası / çift yay görüntüsü
      const skyCx = splitX + (W - splitX) * 0.5;
      const skyCy = H * 0.5;
      const rE = Math.min((W - splitX) * 0.31, H * 0.31);

      // Referans Einstein halkası çemberi
      c.strokeStyle = 'rgba(255,255,255,0.2)';
      c.setLineDash([4, 4]);
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(skyCx, skyCy, rE, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);

      // Mercek kara delik (merkez)
      c.fillStyle = '#030306';
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.arc(skyCx, skyCy, 7, 0, Math.PI * 2); c.fill(); c.stroke();

      // Gerçek kaynak konumu (kesikli çember)
      const sySrc = skyCy - st.betaRatio * rE;
      c.strokeStyle = 'rgba(255, 209, 102, 0.55)';
      c.beginPath(); c.arc(skyCx, sySrc, 4.5, 0, Math.PI * 2); c.stroke();

      if (lens.isRing) {
        c.strokeStyle = COL_WARN;
        c.lineWidth = 5;
        c.shadowColor = COL_WARN;
        c.shadowBlur = 16;
        c.beginPath(); c.arc(skyCx, skyCy, rE, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else {
        const arcSpan = clamp(0.85 / Math.max(0.18, st.betaRatio), 0.18, 1.35);
        c.lineCap = 'round';
        // Birincil dış yay (üstte)
        c.strokeStyle = COL_WARN;
        c.lineWidth = clamp(4.5 * Math.sqrt(Math.min(6, lens.muPlus)), 3, 7);
        c.beginPath();
        c.arc(skyCx, skyCy, lens.thetaPlusRatio * rE, -Math.PI / 2 - arcSpan, -Math.PI / 2 + arcSpan);
        c.stroke();
        // İkincil iç yay (altta, terslenmiş)
        c.strokeStyle = COL_CYAN;
        c.lineWidth = clamp(3.5 * Math.sqrt(Math.min(5, Math.abs(lens.muMinus))), 2.2, 5.5);
        c.beginPath();
        c.arc(skyCx, skyCy, Math.abs(lens.thetaMinusRatio) * rE, Math.PI / 2 - arcSpan * 0.78, Math.PI / 2 + arcSpan * 0.78);
        c.stroke();
      }
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText('Gökyüzü Görüntüsü (θ / θ_E)', skyCx, 20);
      c.restore();
    }
  }

  function drawCurve(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 48, padR = 14, padT = 14, padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const bMin = 4.5;
    const bMax = 20;
    const dMax = 380;
    const fx = b => padL + ((b - bMin) / (bMax - bMin)) * pw;
    const fy = d => padT + ((dMax - clamp(d, 0, dMax)) / dMax) * ph;

    c.save();
    c.font = '10.5px "JetBrains Mono", monospace';
    for (const dv of [0, 90, 180, 270, 360]) {
      const py = fy(dv);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'right';
      c.fillText(`${dv}°`, padL - 6, py + 3.5);
    }
    for (const bv of [5, 8, 12, 16, 20]) {
      const px = fx(bv);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText(`${bv}M`, px, H - 8);
    }

    // b_c asimptot çizgisi
    const xbc = fx(B_CRIT_M);
    c.strokeStyle = COL_BAD;
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(xbc, padT); c.lineTo(xbc, padT + ph); c.stroke();
    c.setLineDash([]);
    c.fillStyle = COL_BAD;
    c.textAlign = 'left';
    c.fillText('b_c = 5,20M', xbc + 4, padT + 12);

    c.save();
    c.beginPath(); c.rect(padL, padT, pw, ph); c.clip();
    // Zayıf alan 4M/b
    c.strokeStyle = PLOT_COLORS[1];
    c.setLineDash([5, 4]);
    c.lineWidth = 1.7;
    c.beginPath();
    curveB.forEach((b, i) => {
      if (i === 0) c.moveTo(fx(b), fy(curveWeak[i]));
      else c.lineTo(fx(b), fy(curveWeak[i]));
    });
    c.stroke();
    c.setLineDash([]);

    // Tam GR
    c.strokeStyle = PLOT_COLORS[4];
    c.lineWidth = 2.2;
    c.beginPath();
    curveB.forEach((b, i) => {
      if (i === 0) c.moveTo(fx(b), fy(curveGR[i]));
      else c.lineTo(fx(b), fy(curveGR[i]));
    });
    c.stroke();

    // Seçili ışın noktası
    if (probeRay && !probeRay.captured && st.probeB >= bMin && st.probeB <= bMax) {
      c.fillStyle = '#fff';
      c.strokeStyle = COL_WARN;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(fx(st.probeB), fy(probeRay.deflectionDeg), 5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.restore();
    c.restore();
  }

  const mainCtl = setupCanvas(cvMain, w => clamp(w * 0.56, 250, 360), drawMain, clean);
  const curveCtl = setupCanvas(cvCurve, w => clamp(w * 0.34, 175, 220), drawCurve, clean);

  const handleDrag = p => {
    if (!st.lensMode) {
      const bVal = clamp((rayGeo.cy - p.y) / Math.max(1, rayGeo.scale), 1.5, 20.0);
      st.probeB = +bVal.toFixed(2);
      sProbeB.set(st.probeB);
    } else {
      const rE = Math.min((p.W * 0.46) * 0.31, p.H * 0.31);
      const betaVal = clamp(Math.abs((p.H * 0.5 - p.y) / Math.max(12, rE)), 0, 1.5);
      st.betaRatio = +betaVal.toFixed(2);
      sBeta.set(st.betaRatio);
    }
    markPreset(host, -1);
    recompute();
  };
  bindDragCanvas(cvMain, {
    onDown: p => { handleDrag(p); return true; },
    onMove: (p, active) => { if (active) handleDrag(p); },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.lensMode) return false;
    st.photonPhase = (st.photonPhase + dt * (isReducedMotion() ? 0.14 : 0.36)) % 1;
    mainCtl.render();
    return true;
  }, clean);

  const viewBar = host.querySelector('[data-view]');
  const onViewClick = e => {
    const b = e.target.closest?.('[data-v]');
    if (!b) return;
    st.lensMode = b.dataset.v === 'lens';
    syncViewMode();
    recompute();
    if (!st.lensMode && st.playing) loop.start();
  };
  const onPlayClick = () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing && !st.lensMode) loop.start();
    else loop.stop();
  };
  const onBcClick = () => {
    st.lensMode = false;
    st.probeB = +(B_CRIT_M + 0.01).toFixed(3);
    sProbeB.set(st.probeB);
    syncViewMode();
    recompute();
  };

  viewBar.addEventListener('click', onViewClick);
  playBtn.addEventListener('click', onPlayClick);
  bcBtn.addEventListener('click', onBcClick);
  clean.add(() => {
    viewBar.removeEventListener('click', onViewClick);
    playBtn.removeEventListener('click', onPlayClick);
    bcBtn.removeEventListener('click', onBcClick);
    host.innerHTML = '';
  });

  bindPresets(host, LIGHT_PRESETS, p => {
    st.probeB = p.probeB;
    st.fanSpan = p.fanSpan;
    st.rayCount = p.rayCount;
    st.lensMode = p.lensMode;
    st.betaRatio = p.betaRatio;
    sProbeB.set(st.probeB);
    sSpan.set(st.fanSpan);
    sBeta.set(st.betaRatio);
    syncViewMode();
    recompute();
    if (!st.lensMode && st.playing) loop.start();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncViewMode();
  syncPlayBtn(playBtn, st.playing);
  recompute();
  if (st.playing && !st.lensMode) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 4: ZAMAN GENİŞLEMESİ VE KIRMIZIYA KAYMA (bh-redshift)
// =====================================================================

function mountRedshift(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const st = {
    mode: 'static', // 'static' | 'freefall' | 'gps'
    rOverRs: 1.5,
    r0OverRs: 5.0,
    lineId: 'h-alpha',
    massSolar: 10,
    playing: autoPlayAllowed(),
    simCoordT: 0,
    probeTau: 0,
    fallEta: 0,
  };
  const gpsInfo = computeEarthGpsRelativity();

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Olay ufkuna indirilen (**statik**) veya **serbest düşen** bir sondanın düzenli gönderdiği sinyalleri uzak gözlemci gözünden izle. Saatlerin ayrışmasını, tayf çizgisindeki **kırmızıya kaymayı**, ufukta donma-sönmeyi ve **Dünya GPS** etkisini gör.', REDSHIFT_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Sonda ve Tayf Çizgisi</h4>
          <span class="bhs-badge bhs-badge-acc" data-badge></span>
        </div>
        <div class="seg bhs-seg-wrap" role="tablist" data-mode aria-label="Sonda modu">
          <button type="button" data-m="static" class="on">Statik sonda</button>
          <button type="button" data-m="freefall">Serbest düşüş</button>
          <button type="button" data-m="gps">Dünya GPS</button>
        </div>
        <div class="bhs-act-row" data-anim-row>
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Saatleri oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-reset aria-label="Saatleri sıfırla">${icon('rotate')} Sıfırla</button>
        </div>
        <label><span>Tayf çizgisi</span>
          <select class="inp bhs-sel" data-line aria-label="Tayf çizgisi seç">
            ${SPECTRAL_LINES.map(l => `<option value="${l.id}">${esc(l.name)} (${BH.formatNumTR(l.nm, 1)} nm)</option>`).join('')}
          </select>
        </label>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-spec-pair" data-spec></div>
        <div class="bhs-alert bhs-alert-acc" data-gps-box hidden></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title" data-stage-title>Sonda Sinyalleri, Saatler ve Ufukta Donma</h4>
            <span class="bhs-hint mono" data-clock-txt></span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-stage aria-label="Zaman genişlemesi ve ışık sinyalleri animasyonu"></canvas></div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Kırmızıya Kayma Çarpanı (1 + z) vs r / rₛ</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${PLOT_COLORS[0]}"></i>Statik</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${PLOT_COLORS[2]}"></i>Serbest düşüş</span>
            </div>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-plot aria-label="1+z kırmızıya kayma grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\frac{d\\tau}{dt} = \\sqrt{1 - \\frac{r_s}{r}}, \\qquad 1 + z_{\\text{statik}} = \\frac{\\lambda_{\\text{göz}}}{\\lambda_0} = \\frac{1}{\\sqrt{1 - r_s/r}}',
        '1 + z_{\\text{düşüş}} = \\frac{E}{1 - r_s/r}\\left(1 + \\sqrt{1 - \\frac{1 - r_s/r}{E^2}}\\right), \\qquad \\frac{I_{\\text{göz}}}{I_0} = (1 + z)^{-4}',
        '\\Delta t_{\\text{GPS,GR}} \\approx +45{,}7\\,\\mu\\text{s/gün}, \\qquad \\Delta t_{\\text{GPS,SR}} \\approx -7{,}2\\,\\mu\\text{s/gün} \\implies \\text{net } +38{,}5\\,\\mu\\text{s/gün}',
      ],
      paragraphs: [
        'Kütleçekim kuyusunun derinliğindeki bir saat uzaktaki gözlemciye göre daha yavaş çalışır; aynı nedenle gönderilen fotonlar enerji kaybeder ve dalga boyları $(1 + z)$ katına uzar (**kütleçekimsel kırmızıya kayma**).',
        'Sonda serbest düşüşle olay ufkuna ($r_s$) yaklaşırken kendi saatinde sonlu bir sürede ufku geçer. Ancak uzak gözlemci için koordinat zamanı ve foton kaçış gecikmesi logaritmik olarak sonsuza gider: görüntü ufukta **donar**, ışığı kızılötesi/radyoya kayar ve parlaklığı $(1 + z)^{-4}$ ile hızla söner.',
        'Dünya\'nın zayıf alanında bile bu etki ölçülebilir: GPS uyduları Dünya yüzeyinden $20\\,190\\,\\text{km}$ yukarıda daha zayıf kütleçekimde olduğu için saatleri günde **$+45,7\\,\\mu\\text{s}$** ileri gider (yörünge hızı kaynaklı $-7,2\\,\\mu\\text{s}$ özel görelilik kaybıyla birlikte net **$+38,5\\,\\mu\\text{s/gün}$**).',
      ],
      tasks: [
        'Statik modda $r/r_s$ sürgüsünü $5$\'ten $1,05$\'e yaklaştır; **Hα (656,3 nm)** çizgisinin görünür kırmızıdan kızılötesine kaymasını ve parlaklığın $(1+z)^{-4}$ ile düşmesini izle.',
        '**Lyman-α → görünür ışık** önayarını seçerek normalde morötesi ($121,6\\,\\text{nm}$) olan ışığın güçlü kırmızıya kaymayla görünür renge girmesini gözlemle.',
        '**Serbest düşüş** modunda sondanın kendi saatinin ufku geçerken akmaya devam ettiğini, ancak uzak gözlemciye ulaşan darbelerin giderek seyrekleşip solduğunu incele.',
        '**Dünya GPS** sekmesinde düzeltme yapılmasaydı konum hatasının günde kaç kilometre büyüyeceğini oku.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const badgeEl = host.querySelector('[data-badge]');
  const specEl = host.querySelector('[data-spec]');
  const gpsBox = host.querySelector('[data-gps-box]');
  const stageTitle = host.querySelector('[data-stage-title]');
  const clockTxt = host.querySelector('[data-clock-txt]');
  const animRow = host.querySelector('[data-anim-row]');
  const lineSel = host.querySelector('[data-line]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cvStage = host.querySelector('[data-cv-stage]');
  const cvPlot = host.querySelector('[data-cv-plot]');

  const sR = addSlider(slBox, {
    label: 'Sonda konumu r / rₛ', min: 1.02, max: 10.0, value: st.rOverRs, step: 0.01,
    fmt: v => `${BH.formatNumTR(v, 2)} rₛ`,
    onInput: v => { st.rOverRs = v; markPreset(host, -1); update(); },
  });
  const sR0 = addSlider(slBox, {
    label: 'Bırakma yarıçapı r₀ / rₛ', min: 2.5, max: 10.0, value: st.r0OverRs, step: 0.1,
    fmt: v => `${BH.formatNumTR(v, 1)} rₛ`,
    onInput: v => { st.r0OverRs = v; st.fallEta = 0; st.rOverRs = v; update(); },
  });

  const currentLine = () => SPECTRAL_LINES.find(l => l.id === st.lineId) || SPECTRAL_LINES[0];

  function syncModeUI() {
    const isGps = st.mode === 'gps';
    const isFall = st.mode === 'freefall';
    sR.setVisible(st.mode === 'static');
    sR0.setVisible(isFall);
    animRow.hidden = isGps;
    if (lineSel.parentElement) lineSel.parentElement.hidden = isGps;
    specEl.hidden = isGps;
    gpsBox.hidden = !isGps;
    stageTitle.textContent = isGps
      ? 'Dünya Yüzeyi vs GPS Uydu Saati Göreli Kayması'
      : isFall
        ? 'Serbest Düşüş: Öz Saat vs Uzak Gözlemci Görüntüsü'
        : 'Statik Sonda Sinyalleri ve Zaman Genişlemesi';
    host.querySelectorAll('[data-mode] button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    syncSegments(host, false);
  }

  function currentProbeMetrics() {
    const ln = currentLine();
    if (st.mode === 'freefall') {
      const rCur = 0.5 * st.r0OverRs * (1 + Math.cos(st.fallEta));
      return computeFreeFallProbeState(st.massSolar, st.r0OverRs, rCur, ln.nm);
    }
    return computeStaticProbeState(st.massSolar, st.rOverRs, ln.nm);
  }

  function update() {
    if (st.mode === 'gps') {
      badgeEl.textContent = 'Zayıf alan GR + SR';
      badgeEl.className = 'bhs-badge bhs-badge-ok';
      clockTxt.textContent = 'Yörünge: 20 190 km';
      renderKpis(kpisEl, [
        { lbl: 'Kütleçekimsel kazanç (GR)', val: `+${BH.formatNumTR(gpsInfo.gravGainUsPerDay, 2)} μs/gün`, sub: 'uydu daha zayıf alanda', tone: 'ok' },
        { lbl: 'Hız yavaşlaması (SR)', val: `${BH.formatNumTR(gpsInfo.srLossUsPerDay, 2)} μs/gün`, sub: 'v ≈ 3,87 km/s', tone: 'warn' },
        { lbl: 'Net günlük saat farkı', val: `+${BH.formatNumTR(gpsInfo.netGainUsPerDay, 2)} μs/gün`, sub: 'uydularda fabrika ayarıyla telafi edilir', tone: 'acc' },
        { lbl: 'Düzeltilmezse konum hatası', val: `${BH.formatNumTR(gpsInfo.dailyPositionErrorKm, 2)} km/gün`, sub: `Dünya rₛ = ${BH.formatNumTR(gpsInfo.rsEarthMm, 2)} mm`, tone: 'bad' },
      ]);
      gpsBox.innerHTML = richTex(`Dünya\'nın Schwarzschild yarıçapı yalnızca **$r_{s,\\oplus} \\approx ${BH.formatNumTR(gpsInfo.rsEarthMm, 2)}\\,\\text{mm}$** olmasına karşın, $20\\,190\\,\\text{km}$ irtifadaki GPS atom saatleri genel görelilik yüzünden günde **$+${BH.formatNumTR(gpsInfo.gravGainUsPerDay, 2)}\\,\\mu\\text{s}$** ileri gider. Bu düzeltme yapılmasa konum belirleme bir günde **${BH.formatNumTR(gpsInfo.dailyPositionErrorKm, 1)} km** sapardı.`);
    } else {
      const ln = currentLine();
      const m = currentProbeMetrics();
      const zTxt = Number.isFinite(m.onePlusZ) ? BH.formatNumTR(m.onePlusZ, 3) : '∞';
      badgeEl.textContent = st.mode === 'freefall'
        ? (m.crossedHorizon ? 'Ufuk geçildi (r ≤ rₛ)' : `v = ${BH.formatNumTR(m.localSpeedOverC, 2)} c`)
        : `dτ/dt = ${BH.formatNumTR(m.dTauOverDt, 3)}`;
      badgeEl.className = `bhs-badge bhs-badge-${m.crossedHorizon || m.onePlusZ > 4 ? 'bad' : m.onePlusZ > 1.8 ? 'warn' : 'acc'}`;

      renderKpis(kpisEl, [
        { lbl: 'Kırmızıya kayma (1 + z)', val: zTxt, sub: Number.isFinite(m.z) ? `z = ${BH.formatNumTR(m.z, 3)}` : 'ufukta ıraksar', tone: 'acc' },
        { lbl: 'Gözlenen dalga boyu λ_göz', val: Number.isFinite(m.observedNm) ? formatWavelengthTR(m.observedNm * 1e-9) : '∞', sub: m.bandObs },
        { lbl: 'Saat oranı dτ / dt', val: BH.formatNumTR(m.dTauOverDt, 4), sub: st.mode === 'freefall' ? `r = ${BH.formatNumTR(m.rOverRs, 2)} rₛ` : `r = ${BH.formatNumTR(st.rOverRs, 2)} rₛ` },
        { lbl: 'Parlaklık I_göz / I₀', val: m.intensityRatio > 1e-4 ? `%${BH.formatNumTR(m.intensityRatio * 100, 2)}` : BH.formatSciTR(m.intensityRatio, 2), sub: '(1 + z)⁻⁴ sönümlenmesi', tone: m.intensityRatio < 0.05 ? 'bad' : 'ok' },
      ]);

      specEl.innerHTML = `<div class="bhs-spec-box">
        <span class="bhs-kpi-lbl">Yayılan (${esc(ln.name)})</span>
        <div class="bhs-spec-swatch" style="background:${m.rgbEmit.css}"></div>
        <span class="mono small">${BH.formatNumTR(ln.nm, 1)} nm · ${esc(m.bandEmit)}</span>
      </div>
      <div class="bhs-spec-box">
        <span class="bhs-kpi-lbl">Uzak Gözlemci (λ_göz)</span>
        <div class="bhs-spec-swatch" style="background:${m.rgbObs.css};opacity:${clamp(Math.pow(m.intensityRatio, 0.25), 0.12, 1).toFixed(2)}"></div>
        <span class="mono small">${Number.isFinite(m.observedNm) ? esc(formatWavelengthTR(m.observedNm * 1e-9)) : '∞'} · ${esc(m.bandObs)}</span>
      </div>`;

      clockTxt.textContent = `τ = ${BH.formatNumTR(st.probeTau, 1)} s · t = ${BH.formatNumTR(st.simCoordT, 1)} s`;
    }
    stageCtl.render();
    plotCtl.render();
  }

  function drawClock(c, cx, cy, R, sec, color, label, sub) {
    c.save();
    c.fillStyle = 'rgba(0, 0, 0, 0.65)';
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); c.stroke();
    // 12 kadran çentiği
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 1;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * (R - 5), cy + Math.sin(a) * (R - 5));
      c.lineTo(cx + Math.cos(a) * (R - 1.5), cy + Math.sin(a) * (R - 1.5));
      c.stroke();
    }
    // İbre (12 saniyede 1 tur)
    const ang = -Math.PI / 2 + ((sec % 12) / 12) * Math.PI * 2;
    c.strokeStyle = color;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * (R - 8), cy + Math.sin(ang) * (R - 8)); c.stroke();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(cx, cy, 2.5, 0, Math.PI * 2); c.fill();
    c.font = '600 11px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.fillStyle = COL_FG;
    c.fillText(label, cx, cy + R + 14);
    c.font = '10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_MUTE;
    c.fillText(sub, cx, cy + R + 27);
    c.restore();
  }

  function drawStage(c, W, H) {
    c.clearRect(0, 0, W, H);
    const acc = accentColor();
    if (st.mode === 'gps') {
      // Dünya + GPS uydu yörüngesi diyagramı
      const cx = W * 0.34;
      const cy = H * 0.5;
      const rEarth = Math.min(W, H) * 0.14;
      const rOrbit = Math.min(W * 0.27, H * 0.41);
      c.save();
      c.strokeStyle = 'rgba(90,176,255,0.4)';
      c.setLineDash([5, 5]);
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(cx, cy, rOrbit, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);

      const gEarth = c.createRadialGradient(cx - rEarth * 0.3, cy - rEarth * 0.3, 2, cx, cy, rEarth);
      gEarth.addColorStop(0, '#60a5fa');
      gEarth.addColorStop(0.7, '#1d4ed8');
      gEarth.addColorStop(1, '#0b1e48');
      c.fillStyle = gEarth;
      c.beginPath(); c.arc(cx, cy, rEarth, 0, Math.PI * 2); c.fill();
      c.font = '600 11px "JetBrains Mono", monospace';
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.fillText('Dünya', cx, cy + 4);

      const satX = cx + rOrbit * Math.cos(-0.6);
      const satY = cy + rOrbit * Math.sin(-0.6);
      c.fillStyle = COL_WARN;
      c.fillRect(satX - 10, satY - 3, 20, 6);
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(satX, satY, 4.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = COL_WARN;
      c.fillText('GPS Uydusu', satX, satY - 12);

      // Sağ tarafta günlük saat farkı çubuk grafiği
      const bx = W * 0.62;
      const bw = W * 0.33;
      const bars = [
        { lbl: 'GR (kütleçekim)', val: gpsInfo.gravGainUsPerDay, col: COL_OK },
        { lbl: 'SR (hız)', val: gpsInfo.srLossUsPerDay, col: COL_WARN },
        { lbl: 'Net fark', val: gpsInfo.netGainUsPerDay, col: acc },
      ];
      c.font = '11px "JetBrains Mono", monospace';
      bars.forEach((b, idx) => {
        const y = 34 + idx * 58;
        c.fillStyle = COL_MUTE;
        c.textAlign = 'left';
        c.fillText(b.lbl, bx, y);
        c.textAlign = 'right';
        c.fillStyle = b.col;
        c.fillText(`${b.val > 0 ? '+' : ''}${BH.formatNumTR(b.val, 1)} μs/gün`, bx + bw, y);
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(bx, y + 8, bw, 12);
        const wBar = (Math.abs(b.val) / 50) * bw;
        c.fillStyle = b.col;
        c.fillRect(bx, y + 8, wBar, 12);
      });
      c.restore();
      return;
    }

    const m = currentProbeMetrics();
    const midY = H * 0.38;
    const xHor = 56;
    const xObs = W - 46;
    const rMaxVis = st.mode === 'freefall' ? st.r0OverRs : 10;
    const rToX = rr => xHor + clamp((rr - 1) / (rMaxVis - 1), 0, 1) * (xObs - xHor - 24);

    // Olay ufku (sol yarıçap)
    c.save();
    c.fillStyle = '#030306';
    c.beginPath(); c.arc(xHor - 36, midY, 36, 0, Math.PI * 2); c.fill();
    c.strokeStyle = acc;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(xHor, 16); c.lineTo(xHor, H * 0.64); c.stroke();
    c.font = '600 10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_BAD;
    c.textAlign = 'left';
    c.fillText('Olay ufku (r = rₛ)', xHor + 5, 24);

    // Radyal eksen
    c.strokeStyle = COL_AXIS;
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(xHor, midY); c.lineTo(xObs, midY); c.stroke();

    // Sonda konumu
    const xProbe = m.rOverRs >= 1 ? rToX(m.rOverRs) : xHor - 14 * (1 - m.rOverRs);
    // Uzak gözlemcinin gördüğü donmuş + solmuş hayalet görüntü (serbest düşüşte ufukta takılı kalır)
    if (st.mode === 'freefall' && m.rOverRs < 1.35) {
      const ghostFade = clamp(Math.pow(m.intensityRatio, 0.25), 0.14, 0.85);
      c.fillStyle = rgbCss(m.rgbObs, ghostFade);
      c.beginPath();
      c.arc(xHor + 4, midY, 8, 0, Math.PI * 2);
      c.fill();
      c.font = '10px "JetBrains Mono", monospace';
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText('Donmuş görüntü', xHor + 36, midY - 16);
    }

    // Giden ışık dalga paketleri (sondadan uzak gözlemciye doğru rengi kayarak ilerler!)
    const pulsePeriodCoord = Number.isFinite(m.onePlusZ) ? Math.min(8, m.onePlusZ) : 12;
    if (xProbe > xHor + 1) {
      const numWaves = 6;
      for (let k = 0; k < numWaves; k++) {
        const travel = ((st.simCoordT / Math.max(0.6, pulsePeriodCoord) + k / numWaves) % 1);
        const px = lerp(xProbe, xObs, travel);
        // Foton yükseldikçe dalga boyu emit -> obs'a kırmızıya kayar
        const lamHere = Number.isFinite(m.observedNm) ? lerp(m.emitNm, m.observedNm, travel) : m.emitNm * (1 + travel * 6);
        const colHere = wavelengthNmToRGB(lamHere);
        const alphaHere = clamp(lerp(0.95, Math.max(0.18, Math.pow(m.intensityRatio, 0.22)), travel), 0.15, 0.95);
        c.strokeStyle = rgbCss(colHere, alphaHere);
        c.lineWidth = 2.2;
        c.beginPath();
        // Küçük dalga paketi çizimi (kırmızıya kaydıkça dalga boyu uzar!)
        const wLen = clamp(5 + travel * Math.min(18, (m.onePlusZ - 1) * 4), 5, 24);
        for (let s = -12; s <= 12; s += 2) {
          const wy = Math.sin((s / wLen) * Math.PI * 2) * 5.5 * Math.cos((s / 14) * Math.PI * 0.5);
          if (s === -12) c.moveTo(px + s, midY + wy);
          else c.lineTo(px + s, midY + wy);
        }
        c.stroke();
      }
    }

    // Sonda gövdesi
    c.fillStyle = m.rgbEmit.css;
    c.strokeStyle = '#fff';
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(xProbe, midY, 7, 0, Math.PI * 2); c.fill(); c.stroke();
    c.font = '600 10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_FG;
    c.textAlign = 'center';
    c.fillText('Sonda', xProbe, midY + 19);

    // Uzak gözlemci teleskop noktası
    c.fillStyle = COL_BLUE;
    c.beginPath(); c.arc(xObs, midY, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = COL_FG;
    c.fillText('Uzak', xObs, midY + 19);

    // Serbest düşüşte darbe varış şeridi: eşit Δτ ile gönderilen darbeler uzak gözlemciye giderek açılan aralıklarla ve kızararak varır
    if (st.mode === 'freefall') {
      const sched = computeFreeFallSignalSchedule(st.massSolar, st.r0OverRs, 10, currentLine().nm);
      const tMaxArr = Math.max(1e-6, sched.pulses[sched.pulses.length - 1].tArrive);
      const barX1 = 18;
      const barX2 = W - 18;
      const barY = H * 0.54;
      c.strokeStyle = COL_GRID;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(barX1, barY); c.lineTo(barX2, barY); c.stroke();
      for (const pl of sched.pulses) {
        const px = lerp(barX1, barX2, pl.tArrive / tMaxArr);
        const op = clamp(Math.pow(pl.intensityRatio, 0.25), 0.16, 1);
        c.strokeStyle = rgbCss(pl.rgbObs, op);
        c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(px, barY - 7); c.lineTo(px, barY + 7); c.stroke();
      }
      c.font = '9.5px "JetBrains Mono", monospace';
      c.fillStyle = COL_MUTE;
      c.textAlign = 'left';
      c.fillText('Alınan darbeler (t_varış → aralıklar açılır ve kızarır)', barX1, barY - 11);
    }

    // Alt kısımda yan yana iki canlı analog saat: Sonda Öz Saati vs Uzak Gözlemci Saati
    const clockY = H * 0.78;
    const clockR = Math.min(26, H * 0.11);
    drawClock(c, W * 0.30, clockY, clockR, st.probeTau, m.rgbEmit.css, 'Sonda Saati (τ)', `${BH.formatNumTR(st.probeTau, 1)} s`);
    drawClock(c, W * 0.70, clockY, clockR, st.simCoordT, COL_BLUE, 'Uzak Gözlemci (t)', `${BH.formatNumTR(st.simCoordT, 1)} s`);
    c.restore();
  }

  function drawRedshiftPlot(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 46, padR = 14, padT = 14, padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const rMin = 1.0;
    const rMax = 8.0;
    const zMax = 10.0;
    const fx = r => padL + ((r - rMin) / (rMax - rMin)) * pw;
    const fy = y => padT + ((zMax - clamp(y, 1, zMax)) / (zMax - 1)) * ph;

    c.save();
    c.font = '10.5px "JetBrains Mono", monospace';
    for (const yv of [1, 2, 4, 6, 8, 10]) {
      const py = fy(yv);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'right';
      c.fillText(`${yv}×`, padL - 6, py + 3.5);
    }
    for (const rv of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const px = fx(rv);
      c.strokeStyle = rv === 1 ? COL_BAD : COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.fillStyle = rv === 1 ? COL_BAD : COL_MUTE;
      c.textAlign = 'center';
      c.fillText(`${rv}rₛ`, px, H - 8);
    }

    c.save();
    c.beginPath(); c.rect(padL, padT, pw, ph); c.clip();
    // Statik 1 + z = 1/√(1 - 1/r)
    c.strokeStyle = PLOT_COLORS[0];
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i <= 180; i++) {
      const r = 1.008 + ((rMax - 1.008) * i) / 180;
      const val = 1 / Math.sqrt(1 - 1 / r);
      if (i === 0) c.moveTo(fx(r), fy(val));
      else c.lineTo(fx(r), fy(val));
    }
    c.stroke();

    // Serbest düşüş (r0'dan)
    c.strokeStyle = PLOT_COLORS[2];
    c.setLineDash([5, 4]);
    c.lineWidth = 1.8;
    const E0 = Math.sqrt(1 - 1 / st.r0OverRs);
    c.beginPath();
    for (let i = 0; i <= 140; i++) {
      const r = 1.02 + ((Math.min(rMax, st.r0OverRs) - 1.02) * i) / 140;
      const f = 1 - 1 / r;
      const beta = Math.sqrt(Math.max(0, 1 - f / (E0 * E0)));
      const val = (E0 / f) * (1 + beta);
      if (i === 0) c.moveTo(fx(r), fy(val));
      else c.lineTo(fx(r), fy(val));
    }
    c.stroke();
    c.setLineDash([]);

    // Canlı sonda noktası
    if (st.mode !== 'gps') {
      const m = currentProbeMetrics();
      if (m.rOverRs >= 1.01 && m.rOverRs <= rMax && Number.isFinite(m.onePlusZ)) {
        c.fillStyle = m.rgbObs.css;
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(fx(m.rOverRs), fy(m.onePlusZ), 5.5, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
    c.restore();
    c.restore();
  }

  const stageCtl = setupCanvas(cvStage, w => clamp(w * 0.56, 255, 330), drawStage, clean);
  const plotCtl = setupCanvas(cvPlot, w => clamp(w * 0.34, 175, 220), drawRedshiftPlot, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || st.mode === 'gps') return false;
    const speed = isReducedMotion() ? 0.35 : 1.0;
    if (st.mode === 'static') {
      const m = computeStaticProbeState(st.massSolar, st.rOverRs, currentLine().nm);
      st.simCoordT += dt * speed;
      st.probeTau += dt * speed * m.dTauOverDt;
    } else {
      st.fallEta += dt * speed * 0.24;
      if (st.fallEta >= Math.PI * 0.99) st.fallEta = 0;
      const rCur = 0.5 * st.r0OverRs * (1 + Math.cos(st.fallEta));
      const m = computeFreeFallProbeState(st.massSolar, st.r0OverRs, rCur, currentLine().nm);
      st.probeTau = m.properTime / Math.max(1e-6, m.timeToSingularity) * 12;
      st.simCoordT = Number.isFinite(m.coordTime) ? Math.min(999, (m.coordTime / Math.max(1e-6, m.timeToSingularity)) * 12) : 999;
    }
    update();
    return true;
  }, clean);

  const modeBar = host.querySelector('[data-mode]');
  const onModeClick = e => {
    const b = e.target.closest?.('[data-m]');
    if (!b || b.dataset.m === st.mode) return;
    st.mode = b.dataset.m;
    st.simCoordT = 0;
    st.probeTau = 0;
    st.fallEta = 0;
    markPreset(host, -1);
    syncModeUI();
    update();
    if (st.playing && st.mode !== 'gps') loop.start();
  };
  const onLineChange = () => { st.lineId = lineSel.value; update(); };
  const onPlayClick = () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing && st.mode !== 'gps') loop.start();
    else loop.stop();
  };
  const onResetClick = () => {
    st.simCoordT = 0;
    st.probeTau = 0;
    st.fallEta = 0;
    update();
  };

  modeBar.addEventListener('click', onModeClick);
  lineSel.addEventListener('change', onLineChange);
  playBtn.addEventListener('click', onPlayClick);
  resetBtn.addEventListener('click', onResetClick);
  clean.add(() => {
    modeBar.removeEventListener('click', onModeClick);
    lineSel.removeEventListener('change', onLineChange);
    playBtn.removeEventListener('click', onPlayClick);
    resetBtn.removeEventListener('click', onResetClick);
    host.innerHTML = '';
  });

  bindPresets(host, REDSHIFT_PRESETS, p => {
    st.mode = p.mode;
    st.rOverRs = p.rOverRs;
    st.r0OverRs = p.r0OverRs;
    st.lineId = p.lineId;
    st.massSolar = p.massSolar;
    st.simCoordT = 0;
    st.probeTau = 0;
    st.fallEta = 0;
    sR.set(st.rOverRs);
    sR0.set(st.r0OverRs);
    lineSel.value = st.lineId;
    syncModeUI();
    update();
    if (st.playing && st.mode !== 'gps') loop.start();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncModeUI();
  syncPlayBtn(playBtn, st.playing);
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 5: GELGİT VE SPAGETTİLEŞME (bh-tidal)
// =====================================================================

function mountTidal(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const st = {
    massSolar: 10,
    rOverRs: 45,
    bodyLengthM: 2.0,
    limitG: 10,
    shape: 'astronaut', // 'astronaut' | 'rod'
    playing: false,
  };

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Radyal olarak düşen bir astronotun (veya çubuğun) maruz kaldığı **gelgit gerilmesini** ($\\Delta a = 2GML/r^3$) ve yanlardan sıkışmasını kütle ölçeğinde incele. Yıldızsal kara deliklerin ufuk dışında parçaladığını, süperkütleli kara deliklerin ise ufku **sağlam geçirttiğini** gör.', TIDAL_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Kütle ve Cisim Ayarları</h4>
          <span class="bhs-badge" data-verdict></span>
        </div>
        <div class="seg bhs-seg-wrap" role="tablist" data-shape aria-label="Düşen cisim">
          <button type="button" data-sh="astronaut" class="on">Astronot</button>
          <button type="button" data-sh="rod">Çelik çubuk</button>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Düşüşü oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-reset aria-label="Uzak konuma dön">${icon('rotate')} Sıfırla</button>
        </div>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-alert" data-summary></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Radyal Gerilme & Enine Sıkışma (Spagettileşme)</h4>
            <span class="bhs-hint mono" data-stress-lbl></span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-astro aria-label="Astronot gelgit gerilmesi ve sıkışması tuvali"></canvas></div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Olay Ufkundaki Gelgit İvmesi Δa(rₛ) vs Kütle (Log–Log)</h4>
            <span class="bhs-hint">Δa(rₛ) ∝ M⁻²</span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-scale aria-label="Kütle eşiği log-log grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\Delta a_{\\text{rad}} = +\\frac{2GML}{r^3}, \\qquad \\Delta a_{\\text{enine}} = -\\frac{GMw}{r^3}',
        'r_{\\text{gelgit}} = \\left(\\frac{2GML}{a_{\\text{maks}}}\\right)^{1/3}, \\qquad \\Delta a(r_s) = \\frac{c^6 L}{4 G^2 M^2} \\implies M_{\\text{eşik}} = \\frac{c^3}{2G}\\sqrt{\\frac{L}{a_{\\text{maks}}}}',
      ],
      paragraphs: [
        'Kara deliğe düşen bir cismin ayakları başından daha güçlü çekilir (**radyal gerilme**), yanları ise merkeze doğru yakınsayan alan çizgileri boyunca sıkıştırılır (**enine sıkışma**). Gelgit tensörünün izi sıfır olduğundan hacim korunur ($+2 - 1 - 1 = 0$).',
        'Olay ufkunun yarıçapı $r_s \\propto M$ ile büyüdüğü için tam ufuktaki gelgit ivmesi $\\Delta a(r_s) \\propto M/r_s^3 \\propto M^{-2}$ şeklinde hızla **azalır**. $L = 2\\,\\text{m}$ ve $10\\,g_0$ dayanım sınırı için eşik kütle yaklaşık **$1,45 \\times 10^4\\,M_\\odot$** değerindedir.',
        'Bu eşikten hafif yıldızsal kara deliklerde astronot olay ufkuna ulaşmadan binlerce kilometre önce parçalanır; **Sgr A*** veya **M87*** gibi süperkütleli kara deliklerde ise olay ufkunu hiçbir acı hissetmeden sağlam geçer (ancak içerdeki tekilliğe yaklaştıkça yine spagettileşir).',
      ],
      tasks: [
        '**Yıldızsal (10 M☉)** önayarında $r_{\\text{gelgit}} / r_s \\approx 128$ olduğunu ve spagettileşmenin ufuktan çok dışarıda başladığını doğrula.',
        'Kütle sürgüsünü **$1,45 \\times 10^4\\,M_\\odot$** eşiğinin üzerine çıkar ve ufuktaki gelgit ivmesinin $10\\,g_0$ altına indiğini gör.',
        '**Sgr A*** veya **M87*** önayarında düşüşü oynat; astronotun $r = r_s$ çizgisini sağlam geçip ancak çok küçük $r/r_s$ değerlerinde gerildiğini izle.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const verdEl = host.querySelector('[data-verdict]');
  const sumEl = host.querySelector('[data-summary]');
  const stressLbl = host.querySelector('[data-stress-lbl]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cvAstro = host.querySelector('[data-cv-astro]');
  const cvScale = host.querySelector('[data-cv-scale]');

  const sMass = addSlider(slBox, {
    label: 'Kara delik kütlesi M', min: 3, max: 1e10, value: st.massSolar, log: true,
    fmt: v => formatMassSolarTR(v),
    onInput: v => { st.massSolar = v; markPreset(host, -1); update(); },
  });
  const sR = addSlider(slBox, {
    label: 'Konum r / rₛ (log)', min: 0.02, max: 300, value: st.rOverRs, log: true,
    fmt: v => `${BH.formatNumTR(v, v < 1 ? 2 : 1)} rₛ`,
    onInput: v => { st.rOverRs = v; update(); },
  });
  const sLen = addSlider(slBox, {
    label: 'Cisim uzunluğu L', min: 0.5, max: 10.0, value: st.bodyLengthM, step: 0.1,
    fmt: v => `${BH.formatNumTR(v, 1)} m`,
    onInput: v => { st.bodyLengthM = v; update(); },
  });
  const sLim = addSlider(slBox, {
    label: 'Dayanım sınırı a_maks', min: 5, max: 500, value: st.limitG, log: true,
    fmt: v => `${BH.formatNumTR(v, 0)} g₀`,
    onInput: v => { st.limitG = v; update(); },
  });

  function update() {
    const td = computeTidalState({
      massSolar: st.massSolar,
      rOverRs: st.rOverRs,
      bodyLengthM: st.bodyLengthM,
      limitG: st.limitG,
    });

    verdEl.textContent = td.survivesHorizon ? '✓ Ufku sağlam geçer' : '✕ Ufuk dışında parçalanır';
    verdEl.className = `bhs-badge bhs-badge-${td.survivesHorizon ? 'ok' : 'bad'}`;
    stressLbl.textContent = td.exceededLimit
      ? `⚠ SINIR AŞILDI (${BH.formatSciTR(td.daRadG, 2)} g₀)`
      : `Δa = ${BH.formatSciTR(td.daRadG, 2)} g₀`;

    renderKpis(kpisEl, [
      { lbl: 'Radyal gerilme Δa_rad', val: `${BH.formatSciTR(td.daRadG, 2)} g₀`, sub: `${BH.formatSciTR(td.daRadMs2, 2)} m/s²`, tone: td.exceededLimit ? 'bad' : 'ok' },
      { lbl: 'Enine sıkışma Δa_lat', val: `${BH.formatSciTR(Math.abs(td.daLatG), 2)} g₀`, sub: 'yanlardan içeri doğru' },
      { lbl: 'Spagettileşme sınırı r_g', val: `${BH.formatNumTR(td.rTidalOverRs, td.rTidalOverRs < 1 ? 3 : 1)} rₛ`, sub: formatDistanceMTR(td.rTidalMeters), tone: td.outsideHorizon ? 'bad' : 'acc' },
      { lbl: 'Sağlam geçiş eşiği M_eşik', val: formatMassSolarTR(td.thresholdMassSolar), sub: `ufukta Δa(rₛ) = ${BH.formatSciTR(td.horizonTidalG, 2)} g₀` },
    ]);

    sumEl.className = `bhs-alert bhs-alert-${td.survivesHorizon ? 'ok' : 'bad'}`;
    sumEl.innerHTML = td.survivesHorizon
      ? richTex(`**Süperkütleli rejim:** Olay ufkundaki gelgit ivmesi yalnızca $${BH.formatSciTR(td.horizonTidalG, 2)}\\,g_0$. Cisim ufku sağlam geçer; spagettileşme ancak içeride $r \\approx ${BH.formatNumTR(td.rTidalOverRs, 3)}\\,r_s$ konumunda başlar.`)
      : richTex(`**Yıldızsal rejim:** Spagettileşme yarıçapı $r_{\\text{gelgit}} \\approx ${BH.formatNumTR(td.rTidalOverRs, 1)}\\,r_s$ olay ufkunun dışındadır. Ufukta gelgit ivmesi $${BH.formatSciTR(td.horizonTidalG, 2)}\\,g_0$ olur.`);

    astroCtl.render();
    scaleCtl.render();
  }

  function drawAstro(c, W, H) {
    c.clearRect(0, 0, W, H);
    const td = computeTidalState({
      massSolar: st.massSolar,
      rOverRs: st.rOverRs,
      bodyLengthM: st.bodyLengthM,
      limitG: st.limitG,
    });
    const acc = accentColor();

    // Üst şerit: logaritmik r / r_s cetveli (0,01 r_s -> 300 r_s)
    const barL = 22, barR = W - 22, barY = 30;
    const logLo = Math.log10(0.01);
    const logHi = Math.log10(350);
    const rToBarX = rv => barL + clamp((Math.log10(Math.max(0.01, rv)) - logLo) / (logHi - logLo), 0, 1) * (barR - barL);
    const xRs = rToBarX(1);
    const xTid = rToBarX(td.rTidalOverRs);
    const xCur = rToBarX(td.rOverRs);

    c.save();
    // Ufuk içi gölge + tehlike bölgesi
    c.fillStyle = 'rgba(0, 0, 0, 0.72)';
    c.fillRect(barL, barY - 7, xRs - barL, 14);
    c.fillStyle = 'rgba(255, 107, 107, 0.28)';
    c.fillRect(barL, barY - 7, xTid - barL, 14);
    c.strokeStyle = COL_AXIS;
    c.strokeRect(barL, barY - 7, barR - barL, 14);

    // Olay ufku ve spagettileşme işaretçileri
    c.strokeStyle = acc;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(xRs, barY - 12); c.lineTo(xRs, barY + 12); c.stroke();
    c.strokeStyle = COL_BAD;
    c.setLineDash([3, 2]);
    c.beginPath(); c.moveTo(xTid, barY - 12); c.lineTo(xTid, barY + 12); c.stroke();
    c.setLineDash([]);

    // Konum noktası
    c.fillStyle = td.exceededLimit ? COL_BAD : COL_OK;
    c.strokeStyle = '#fff';
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(xCur, barY, 6, 0, Math.PI * 2); c.fill(); c.stroke();

    c.font = '10px "JetBrains Mono", monospace';
    c.fillStyle = COL_MUTE;
    c.textAlign = 'left';
    c.fillText('← Tekillik (r→0)', barL, 14);
    c.textAlign = 'center';
    c.fillStyle = acc;
    c.fillText('r = rₛ', xRs, barY + 23);
    c.fillStyle = COL_BAD;
    c.fillText('r_gelgit', clamp(xTid, barL + 28, barR - 28), 14);

    // Ana alan: gerilen ve sıkışan astronot / çubuk (kara delik solda!)
    const cy = H * 0.64;
    const cx = W * 0.56;
    const bodyCol = td.exceededLimit ? COL_BAD : td.stressRatio > 0.35 ? COL_WARN : COL_OK;

    // Solda kara delik yönü oku
    drawBlackHoleDisk(c, 34, cy, 24, 0, 0, acc);
    c.fillStyle = COL_MUTE;
    c.textAlign = 'center';
    c.fillText('Kara Delik', 34, cy + 38);

    c.save();
    c.translate(cx, cy);
    // Yatay eksen radyal (gerilme), dikey eksen enine (sıkışma)
    const sx = td.stretchFactor;
    const sy = td.squeezeFactor;
    c.scale(sx, sy);

    if (st.shape === 'rod') {
      c.fillStyle = bodyCol;
      c.strokeStyle = '#fff';
      c.lineWidth = 1.6 / Math.sqrt(sx * sy);
      c.beginPath();
      c.roundRect?.(-36, -9, 72, 18, 4) ?? c.rect(-36, -9, 72, 18);
      c.fill();
      c.stroke();
    } else {
      // Yatay düşen astronot (ayaklar sola - kara deliğe dönük, kafa sağa)
      c.fillStyle = bodyCol;
      c.strokeStyle = '#f4f4f5';
      c.lineWidth = 1.6 / Math.sqrt(sx * sy);
      // Kask (sağda)
      c.beginPath(); c.arc(24, 0, 9.5, 0, Math.PI * 2); c.fill(); c.stroke();
      // Vizör
      c.fillStyle = '#09090d';
      c.beginPath(); c.arc(26, -1.5, 4.5, 0, Math.PI * 2); c.fill();
      // Gövde
      c.fillStyle = bodyCol;
      c.beginPath(); c.rect(-8, -9, 24, 18); c.fill(); c.stroke();
      // Bacaklar (sola, kara deliğe doğru)
      c.beginPath();
      c.rect(-32, -8, 24, 6);
      c.rect(-32, 2, 24, 6);
      c.fill(); c.stroke();
      // Kollar
      c.beginPath();
      c.rect(-2, -16, 14, 5.5);
      c.rect(-2, 10.5, 14, 5.5);
      c.fill(); c.stroke();
    }
    c.restore();

    // Radyal gerilme okları (dışa doğru) ve enine sıkışma okları (içe doğru)
    const halfLen = 36 * sx;
    const halfWid = 16 * sy;
    const arrLen = clamp(18 + td.stretchFactor * 10, 20, 56);
    drawArrow2D(c, cx - halfLen - 6, cy, cx - halfLen - 6 - arrLen, cy, COL_BAD, 2.2, '+Δa_rad');
    drawArrow2D(c, cx + halfLen + 6, cy, cx + halfLen + 6 + arrLen, cy, COL_BAD, 2.2, '+Δa_rad');
    drawArrow2D(c, cx, cy - halfWid - 30, cx, cy - halfWid - 6, COL_CYAN, 2, '−Δa_lat');
    drawArrow2D(c, cx, cy + halfWid + 30, cx, cy + halfWid + 6, COL_CYAN, 2);

    c.restore();
  }

  function drawScaleChart(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 52, padR = 16, padT = 16, padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const logM0 = 0.4; // ~2.5 M☉
    const logM1 = 10.2;
    const logA0 = -12;
    const logA1 = 10;
    const fx = mSol => padL + ((Math.log10(mSol) - logM0) / (logM1 - logM0)) * pw;
    const fy = aG => padT + ((logA1 - clamp(Math.log10(Math.max(1e-13, aG)), logA0, logA1)) / (logA1 - logA0)) * ph;

    c.save();
    c.font = '10px "JetBrains Mono", monospace';
    for (let e = 1; e <= 10; e += 3) {
      const px = fx(Math.pow(10, e));
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText(`10${BH.toSuperscript(e)} M☉`, px, H - 8);
    }
    for (const ae of [-10, -5, 0, 5, 10]) {
      const py = fy(Math.pow(10, ae));
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'right';
      c.fillText(`10${BH.toSuperscript(ae)}g`, padL - 5, py + 3.5);
    }

    // Dayanım sınırı yatay çizgisi
    const pyLim = fy(st.limitG);
    c.strokeStyle = COL_BAD;
    c.setLineDash([5, 4]);
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(padL, pyLim); c.lineTo(padL + pw, pyLim); c.stroke();
    c.setLineDash([]);
    c.fillStyle = COL_BAD;
    c.textAlign = 'right';
    c.fillText(`Sınır: ${BH.formatNumTR(st.limitG, 0)} g₀`, padL + pw - 4, pyLim - 5);

    // Δa(r_s) ∝ M^-2 doğrusu (log-log)
    c.strokeStyle = accentColor();
    c.lineWidth = 2.3;
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const mSol = Math.pow(10, lerp(logM0, logM1, i / 80));
      const mKg = BH.solarMassToKg(mSol);
      const aG = BH.tidalAcceleration(mKg, BH.schwarzschildRadius(mKg), st.bodyLengthM) / BH.G0;
      const px = fx(mSol);
      const py = fy(aG);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.stroke();

    // Mevcut kütle noktası + eşik kütle noktası
    const td = computeTidalState({ massSolar: st.massSolar, rOverRs: 1, bodyLengthM: st.bodyLengthM, limitG: st.limitG });
    c.fillStyle = COL_WARN;
    c.beginPath(); c.arc(fx(td.thresholdMassSolar), pyLim, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.strokeStyle = td.survivesHorizon ? COL_OK : COL_BAD;
    c.lineWidth = 2.2;
    c.beginPath(); c.arc(fx(st.massSolar), fy(td.horizonTidalG), 6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }

  const astroCtl = setupCanvas(cvAstro, w => clamp(w * 0.5, 220, 290), drawAstro, clean);
  const scaleCtl = setupCanvas(cvScale, w => clamp(w * 0.34, 175, 215), drawScaleChart, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const factor = Math.pow(0.42, dt * (isReducedMotion() ? 0.35 : 0.85));
    st.rOverRs = st.rOverRs * factor;
    if (st.rOverRs <= 0.025) {
      st.rOverRs = 0.025;
      st.playing = false;
      syncPlayBtn(playBtn, false, 'Düşüşü başlat', 'Duraklat');
      sR.set(st.rOverRs);
      update();
      return false;
    }
    sR.set(st.rOverRs);
    update();
    return true;
  }, clean);

  const shapeBar = host.querySelector('[data-shape]');
  const onShape = e => {
    const b = e.target.closest?.('[data-sh]');
    if (!b || b.dataset.sh === st.shape) return;
    st.shape = b.dataset.sh;
    host.querySelectorAll('[data-shape] button').forEach(x => x.classList.toggle('on', x === b));
    syncSegments(host, false);
    astroCtl.render();
  };
  const onPlay = () => {
    if (st.rOverRs <= 0.05) st.rOverRs = 160;
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing, 'Düşüşü başlat', 'Duraklat');
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onReset = () => {
    st.playing = false;
    loop.stop();
    syncPlayBtn(playBtn, false, 'Düşüşü başlat', 'Duraklat');
    st.rOverRs = st.massSolar > 1e5 ? 5.0 : 120;
    sR.set(st.rOverRs);
    update();
  };

  shapeBar.addEventListener('click', onShape);
  playBtn.addEventListener('click', onPlay);
  resetBtn.addEventListener('click', onReset);
  clean.add(() => {
    shapeBar.removeEventListener('click', onShape);
    playBtn.removeEventListener('click', onPlay);
    resetBtn.removeEventListener('click', onReset);
    host.innerHTML = '';
  });

  bindPresets(host, TIDAL_PRESETS, p => {
    st.massSolar = p.massSolar;
    st.rOverRs = p.rOverRs;
    st.bodyLengthM = p.bodyLengthM;
    st.limitG = p.limitG;
    sMass.set(st.massSolar);
    sR.set(st.rOverRs);
    sLen.set(st.bodyLengthM);
    sLim.set(st.limitG);
    update();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncPlayBtn(playBtn, false, 'Düşüşü başlat', 'Duraklat');
  update();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 6: HAWKING IŞIMASI (bh-hawking)
// =====================================================================

function mountHawking(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const st = {
    massKg: _primordialMassKg, // İlkel kara delik (evren yaşı ölçeği)
    evapProgress: 0,
    playing: false,
    particlePhase: 0,
  };

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Kütle sürgüsünü **$10^{10}\\,\\text{kg}$** ile **$10^{10}\\,M_\\odot$** arasında (30 büyüklük mertebesi!) gezdirerek Hawking sıcaklığı $T_H$, ışıma gücü, tayf bölgesi ve buharlaşma süresini incele. Buharlaşma animasyonu zamanı **logaritmik kalan süre** ölçeğinde hızlandırarak son patlamayı gösterir.', HAWKING_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Kütle ve Buharlaşma Kontrolü</h4>
          <span class="bhs-badge bhs-badge-acc" data-band></span>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Buharlaşmayı oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-reset aria-label="Buharlaşmayı başa sar">${icon('rotate')} Sıfırla</button>
        </div>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-alert" data-cmb-note></div>
        <div class="bhs-table-wrap">
          <table class="bhs-tbl" aria-label="Buharlaşma süresi karşılaştırmaları">
            <thead><tr><th>Karşılaştırma Ölçeği</th><th>Oran (t_buh / t_ref)</th></tr></thead>
            <tbody data-comp-body></tbody>
          </table>
        </div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Buharlaşan Kara Delik (Kütle Küçülür · Sıcaklık Artar · Son Patlama)</h4>
            <span class="bhs-hint mono" data-rem-txt></span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-bh aria-label="Buharlaşan kara delik ve Hawking fotonları animasyonu"></canvas></div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Logaritmik Kalan Zamanda T_H ve M/M₀ Evrimi</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_BAD}"></i>log₁₀ T_H (K)</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_CYAN}"></i>M / M₀</span>
            </div>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-evo aria-label="Logaritmik zaman buharlaşma grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}, \\qquad P_H = \\frac{\\hbar c^6}{15360\\pi G^2 M^2}, \\qquad t_{\\text{buh}} = \\frac{5120\\pi G^2 M^3}{\\hbar c^4}',
        'S_{\\text{BH}} = \\frac{4\\pi G M^2 k_B}{\\hbar c}, \\qquad M(\\tau_{\\text{kalan}}) = M_0\\left(\\frac{\\tau_{\\text{kalan}}}{t_{\\text{buh}}(M_0)}\\right)^{1/3}',
      ],
      paragraphs: [
        'Olay ufku yakınındaki kuantum vakum dalgalanmaları, kara deliğin $T_H \\propto 1/M$ sıcaklığında termal kara cisim ışıması yapmasına yol açar. Küçük kara delikler **daha sıcaktır** ve kütle kaybettikçe sıcaklıkları hızlanarak artar (negatif ısı sığası!).',
        'Yıldızsal ($1\\,M_\\odot$) bir kara deliğin sıcaklığı yalnızca $61,7\\,\\text{nK}$ olup kozmik mikrodalga artalanından ($2,725\\,\\text{K}$) çok soğuktur; bugün net enerji soğurur. Buna karşılık erken evrende oluşmuş **$M \\approx 1,73\\times 10^{11}\\,\\text{kg}$** kütleli ilkel bir kara delik tam evrenin yaşında ($13,79$ milyar yıl) gama ışını patlamasıyla buharlaşır.',
      ],
      tasks: [
        '**1 M☉** önayarında $T_H \\approx 61,7\\,\\text{nK}$ ve $t_{\\text{buh}} \\approx 2,1\\times 10^{67}\\,\\text{yıl}$ değerlerinin evrenin yaşından kaç kat büyük olduğunu incele.',
        '**CMB dengesi** önayarında $T_H \\approx 2,725\\,\\text{K}$ sınırını gör; bu kütlenin altında kara delik net kütle kaybetmeye başlar.',
        '**İlkel KD** önayarında buharlaşma animasyonunu oynat; kalan zaman logaritmik olarak azalırken sıcaklığın ve son patlamanın nasıl tırmandığını izle.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const bandEl = host.querySelector('[data-band]');
  const cmbNote = host.querySelector('[data-cmb-note]');
  const compBody = host.querySelector('[data-comp-body]');
  const remTxt = host.querySelector('[data-rem-txt]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cvBh = host.querySelector('[data-cv-bh]');
  const cvEvo = host.querySelector('[data-cv-evo]');

  const sMass = addSlider(slBox, {
    label: 'Başlangıç kütlesi M₀ (log)', min: HAWKING_MASS_MIN_KG, max: HAWKING_MASS_MAX_KG, value: st.massKg, log: true,
    fmt: v => formatMassKgTR(v),
    onInput: v => { st.massKg = v; st.evapProgress = 0; sProg.set(0); markPreset(host, -1); update(); },
  });
  const sProg = addSlider(slBox, {
    label: 'Buharlaşma ilerlemesi (log τ)', min: 0, max: 1, value: st.evapProgress, step: 0.002,
    fmt: v => `%${BH.formatNumTR(v * 100, 1)}`,
    onInput: v => { st.evapProgress = v; update(); },
  });

  function update() {
    const ev = hawkingEvaporationState(st.massKg, st.evapProgress);
    const hs = ev.state;
    const toneBand = hs.band.includes('Gama') ? 'bad' : hs.band.includes('X-') ? 'warn' : hs.band.includes('Görünür') ? 'ok' : 'acc';
    bandEl.textContent = hs.band;
    bandEl.className = `bhs-badge bhs-badge-${toneBand}`;
    remTxt.textContent = `Kalan süre τ ≈ ${formatTimeTR(ev.tauRemSec)}`;

    renderKpis(kpisEl, [
      { lbl: 'Hawking sıcaklığı T_H', val: `${BH.formatSciTR(hs.temperature, 2)} K`, sub: `M = ${formatMassKgTR(hs.massKg)}`, tone: 'acc' },
      { lbl: 'Işıma gücü P_H', val: `${BH.formatSciTR(hs.luminosity, 2)} W`, sub: ev.burstIntensity > 0.2 ? 'SON PATLAMA!' : 'kara cisim gücü', tone: ev.burstIntensity > 0.2 ? 'bad' : '' },
      { lbl: 'Tepe dalga boyu λ_tepe', val: formatWavelengthTR(hs.peakWavelength), sub: hs.band },
      { lbl: 'Buharlaşma süresi t_buh', val: formatTimeTR(hs.evaporationSeconds), sub: `S/k_B = ${BH.formatSciTR(hs.entropyDimensionless, 2)}` },
    ]);

    cmbNote.className = `bhs-alert bhs-alert-${hs.absorbsCmb ? 'acc' : 'warn'}`;
    cmbNote.innerHTML = hs.absorbsCmb
      ? richTex(`**CMB soğurma rejimi:** $T_H < 2,725\\,\\text{K}$ olduğundan bu kara delik bugün evrenin mikrodalga artalanından yaydığından daha fazla enerji soğurur.`)
      : richTex(`**Net buharlaşma rejimi:** $T_H > 2,725\\,\\text{K}$ — kara delik net kütle kaybeder, ısındıkça buharlaşma hızlanır!`);

    compBody.innerHTML = `<tr><td>Evrenin yaşı (13,79 Gyr)</td><td class="mono">${esc(BH.formatSciTR(hs.evapOverUniverseAge, 2, { forceSci: true }))} ×</td></tr>
      <tr><td>Planck zamanı (5,39×10⁻⁴⁴ s)</td><td class="mono">${esc(BH.formatSciTR(hs.evapOverPlanckTime, 2, { forceSci: true }))} ×</td></tr>
      <tr><td>Olay ufku rₛ</td><td class="mono">${esc(formatWavelengthTR(hs.rsMeters))}</td></tr>`;

    bhCtl.render();
    evoCtl.render();
  }

  function drawEvapScene(c, W, H) {
    c.clearRect(0, 0, W, H);
    const ev = hawkingEvaporationState(st.massKg, st.evapProgress);
    const hs = ev.state;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const maxR = Math.min(W, H) * 0.28;
    const rBh = Math.max(4, maxR * Math.pow(clamp(ev.massFrac, 0, 1), 0.28));

    // Sıcaklık tabanlı görsel renk (çok soğukta mor-lacivert, sıcakta blackbody, gama'da parlak mavi-beyaz)
    let glowCol;
    if (hs.temperature < 500) {
      glowCol = { r: 0.32, g: 0.45, b: 0.85 };
    } else if (hs.temperature > 1e5) {
      glowCol = { r: 0.72, g: 0.86, b: 1.0 };
    } else {
      glowCol = hs.rgb;
    }

    c.save();
    // Son patlama parıltısı
    const glowScale = 2.0 + 3.2 * ev.burstIntensity + 0.6 * clamp(Math.log10(Math.max(1, hs.temperature)) / 12, 0, 1);
    const haloR = Math.min(Math.max(W, H) * 0.65, rBh * glowScale + 22 + ev.burstIntensity * 110);
    const gr = c.createRadialGradient(cx, cy, rBh * 0.6, cx, cy, haloR);
    gr.addColorStop(0, rgbCss(glowCol, clamp(0.45 + 0.55 * ev.burstIntensity, 0.25, 1)));
    gr.addColorStop(0.35, rgbCss(glowCol, 0.22 + 0.42 * ev.burstIntensity));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    c.beginPath(); c.arc(cx, cy, haloR, 0, Math.PI * 2); c.fill();

    // Yayılan Hawking parçacık çiftleri / fotonlar
    const nPart = Math.round(10 + 26 * clamp(st.evapProgress * 0.7 + (hs.temperature > 1e4 ? 0.3 : 0), 0, 1));
    for (let i = 0; i < nPart; i++) {
      const ang = (i / nPart) * Math.PI * 2 + (i % 3) * 0.21;
      const frac = (st.particlePhase + i * 0.137) % 1;
      const dist = rBh + 4 + frac * (Math.min(W, H) * 0.45 - rBh);
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist;
      const alpha = (1 - frac) * (0.45 + 0.55 * ev.burstIntensity);
      c.fillStyle = rgbCss(glowCol, alpha);
      c.beginPath();
      c.arc(px, py, 1.8 + 2.2 * ev.burstIntensity, 0, Math.PI * 2);
      c.fill();
    }

    // Kara delik olay ufku (patlamada küçülüp parlak çekirdeğe dönüşür)
    if (ev.burstIntensity < 0.92) {
      c.fillStyle = '#020205';
      c.strokeStyle = rgbCss(glowCol, 0.9);
      c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, rBh, 0, Math.PI * 2); c.fill(); c.stroke();
    } else {
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(cx, cy, 8 + ev.burstIntensity * 14, 0, Math.PI * 2); c.fill();
    }

    // Üst sol durum etiketi
    c.font = '500 11px "JetBrains Mono", monospace';
    c.fillStyle = COL_FG;
    c.textAlign = 'left';
    c.fillText(`M / M₀ = ${BH.formatSciTR(ev.massFrac, 2)} · T_H = ${BH.formatSciTR(hs.temperature, 2)} K`, 10, 18);
    c.fillStyle = COL_MUTE;
    c.fillText(`Bant: ${hs.band}`, 10, H - 10);
    c.restore();
  }

  function drawEvoChart(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 50, padR = 44, padT = 16, padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const evNow = hawkingEvaporationState(st.massKg, st.evapProgress);
    const t0 = BH.hawkingTemperature(st.massKg);
    const logTMin = Math.log10(t0) - 0.5;
    const logTMax = logTMin + 7.5;
    const fx = p => padL + p * pw;
    const fyTemp = logT => padT + ((logTMax - clamp(logT, logTMin, logTMax)) / (logTMax - logTMin)) * ph;
    const fyMass = mf => padT + (1 - clamp(mf, 0, 1)) * ph;

    c.save();
    c.font = '10px "JetBrains Mono", monospace';
    for (let k = 0; k <= 4; k++) {
      const p = k / 4;
      const px = fx(p);
      const ltau = lerp(evNow.logT0, evNow.logTMin, p);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText(`10${BH.toSuperscript(Math.round(ltau))} s`, px, H - 8);
    }
    for (let k = 0; k <= 3; k++) {
      const lt = lerp(logTMin, logTMax, k / 3);
      const py = fyTemp(lt);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_BAD;
      c.textAlign = 'right';
      c.fillText(`10${BH.toSuperscript(Math.round(lt))}K`, padL - 4, py + 3.5);
    }

    // M/M0 eğrisi (mavi)
    c.strokeStyle = COL_CYAN;
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const e = hawkingEvaporationState(st.massKg, p);
      if (i === 0) c.moveTo(fx(p), fyMass(e.massFrac));
      else c.lineTo(fx(p), fyMass(e.massFrac));
    }
    c.stroke();

    // log10(T_H) eğrisi (kırmızı)
    c.strokeStyle = COL_BAD;
    c.lineWidth = 2.2;
    c.beginPath();
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const e = hawkingEvaporationState(st.massKg, p);
      const lt = Math.log10(Math.max(1e-30, e.state.temperature));
      if (i === 0) c.moveTo(fx(p), fyTemp(lt));
      else c.lineTo(fx(p), fyTemp(lt));
    }
    c.stroke();

    // Canlı imleç çizgisi
    const xCur = fx(st.evapProgress);
    c.strokeStyle = '#fff';
    c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(xCur, padT); c.lineTo(xCur, padT + ph); c.stroke();
    c.setLineDash([]);
    c.fillStyle = COL_CYAN;
    c.beginPath(); c.arc(xCur, fyMass(evNow.massFrac), 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = COL_BAD;
    c.beginPath(); c.arc(xCur, fyTemp(Math.log10(Math.max(1e-30, evNow.state.temperature))), 4.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  const bhCtl = setupCanvas(cvBh, w => clamp(w * 0.48, 210, 270), drawEvapScene, clean);
  const evoCtl = setupCanvas(cvEvo, w => clamp(w * 0.33, 170, 210), drawEvoChart, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const spd = isReducedMotion() ? 0.06 : 0.14;
    st.evapProgress = Math.min(1, st.evapProgress + dt * spd);
    st.particlePhase = (st.particlePhase + dt * (0.45 + 1.4 * st.evapProgress)) % 1;
    sProg.set(st.evapProgress);
    update();
    if (st.evapProgress >= 1) {
      st.playing = false;
      syncPlayBtn(playBtn, false, 'Buharlaşmayı oynat', 'Duraklat');
      return false;
    }
    return true;
  }, clean);

  const onPlay = () => {
    if (st.evapProgress >= 0.999) st.evapProgress = 0;
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing, 'Buharlaşmayı oynat', 'Duraklat');
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onReset = () => {
    st.playing = false;
    loop.stop();
    st.evapProgress = 0;
    sProg.set(0);
    syncPlayBtn(playBtn, false, 'Buharlaşmayı oynat', 'Duraklat');
    update();
  };

  playBtn.addEventListener('click', onPlay);
  resetBtn.addEventListener('click', onReset);
  clean.add(() => {
    playBtn.removeEventListener('click', onPlay);
    resetBtn.removeEventListener('click', onReset);
    host.innerHTML = '';
  });

  bindPresets(host, HAWKING_PRESETS, p => {
    st.massKg = p.massKg;
    st.evapProgress = 0;
    sMass.set(st.massKg);
    sProg.set(0);
    update();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 1);
  syncPlayBtn(playBtn, false, 'Buharlaşmayı oynat', 'Duraklat');
  update();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 7: KÜTLEÇEKİM DALGALARI (bh-gw)
// =====================================================================

function mountGW(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const p0 = GW_SIM_PRESETS[0]; // GW150914
  const st = {
    m1Solar: p0.m1Solar,
    m2Solar: p0.m2Solar,
    distanceMpc: p0.distanceMpc,
    fStart: p0.fStart,
    volume: 0.35,
    playing: autoPlayAllowed(),
    playhead: 0, // [0..1]
  };
  let gwData = computeGwSimulation(st);
  let audioMap = mapGwAudioFrequencies(gwData.wf);
  let audioCtx = null;
  let activeSource = null;
  let activeGain = null;
  let audioPlaying = false;

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('İki kara deliğin **içe sarmal (inspiral)**, **birleşme** ve **yarı-normal çınlama (ringdown)** aşamalarını üstten görünüm, $h(t)$ gerinim dalgası ve abartılmış LIGO detektör kollarıyla izle. İstersen **cıvıltı (chirp)** sesini WebAudio ile dinleyebilirsin.', GW_SIM_PRESETS.map(p => ({ ...p, label: `${p.name} (${BH.formatNumTR(p.m1Solar, p.m1Solar < 5 ? 2 : 0)}+${BH.formatNumTR(p.m2Solar, p.m2Solar < 5 ? 2 : 0)} M☉)` })))}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">İkili Sistem ve Cıvıltı Sesi</h4>
          <span class="bhs-badge bhs-badge-acc" data-phase-badge>İçe sarmal</span>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Birleşmeyi oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-reset aria-label="Başa sar">${icon('rotate')} Sıfırla</button>
        </div>
        <div class="bhs-audio-bar">
          <div class="bhs-head">
            <span class="bhs-title">Cıvıltı Sesi (40–2000 Hz)</span>
            <span class="bhs-hint mono" data-audio-info></span>
          </div>
          <div class="bhs-act-row">
            <button type="button" class="btn small bhs-act-btn" data-audio-play aria-label="Cıvıltı sesini çal">${icon('play')} Cıvıltıyı çal</button>
            <button type="button" class="btn small ghost bhs-act-btn" data-audio-stop aria-label="Sesi durdur ve temizle" disabled>${icon('x')} Sesi durdur</button>
          </div>
          <div data-vol-slot></div>
        </div>
        <div class="bhs-col" data-sliders></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-grid-eq">
          <div class="bhs-plot-card">
            <div class="bhs-head">
              <h4 class="bhs-title">Üstten Görünüm: İçe Sarmal ve Birleşme</h4>
              <span class="bhs-hint mono" data-inst-f></span>
            </div>
            <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-orb aria-label="İki kara deliğin sarmal birleşmesi animasyonu"></canvas></div>
          </div>
          <div class="bhs-plot-card">
            <div class="bhs-head">
              <h4 class="bhs-title">LIGO Detektör Kolları (Abartılmış)</h4>
              <span class="bhs-hint mono" data-inst-h></span>
            </div>
            <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-det aria-label="İnterferometre kol gerinimi animasyonu"></canvas></div>
          </div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Kütleçekim Dalgası Gerinimi h(t)</h4>
            <span class="bhs-hint mono" data-wf-meta></span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-wf aria-label="Kütleçekim dalgası h(t) cıvıltı grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\mathcal{M}_c = \\frac{(m_1 m_2)^{3/5}}{(m_1 + m_2)^{1/5}}, \\qquad f_{\\text{ISCO}} = \\frac{c^3}{6^{3/2}\\pi G(m_1 + m_2)}',
        'f(\\tau) = \\frac{1}{\\pi}\\left(\\frac{5}{256\\tau}\\right)^{3/8}\\left(\\frac{G\\mathcal{M}_c}{c^3}\\right)^{-5/8}, \\qquad h(f, D) = \\frac{4c}{D}\\left(\\frac{G\\mathcal{M}_c}{c^3}\\right)^{5/3}(\\pi f)^{2/3}',
      ],
      paragraphs: [
        'Birbirinin çevresinde dönen iki kara delik dörtkutuplu kütleçekim dalgaları yayarak yörünge enerjisi kaybeder. Ayrım daraldıkça yörünge hızı, dalga frekansı ($f_{\\text{GW}} = 2 f_{\\text{yör}}$) ve gerinim genliği $h(t)$ hızla yükselerek karakteristik **cıvıltı (chirp)** sinyalini üretir.',
        'ISCO eşiği aşılınca iki olay ufku birleşir; oluşan kalıntı kara delik temel yarı-normal mod frekansında ($f_{\\text{QNM}}$) hızla sönümlenen bir **çınlama (ringdown)** yayar. **GW150914** olayında $36\\,M_\\odot + 29\\,M_\\odot$ kara delikler birleşip yaklaşık **$3\\,M_\\odot c^2$** enerjiyi bir saniyenin kesrinde uzay-zaman dalgalarına dönüştürdü.',
      ],
      tasks: [
        '**GW150914** önayarında cıvıltı kütlesi $\\mathcal{M}_c \\approx 28,1\\,M_\\odot$, $f_{\\text{ISCO}} \\approx 68\\,\\text{Hz}$ ve yayılan $\\approx 3\\,M_\\odot c^2$ enerji değerlerini oku.',
        '**GW170817** (ikili nötron yıldızı) önayarına geç; daha düşük kütlenin neden çok daha yüksek $f_{\\text{ISCO}}$ ve daha uzun birleşme süresi ürettiğini gör.',
        '**Cıvıltıyı çal** düğmesine basarak (ses otomatik başlamaz!) yükselen perdeyi dinle ve LIGO kollarının bir eksende uzarken dik eksende nasıl kısaldığını izle.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const volSlot = host.querySelector('[data-vol-slot]');
  const kpisEl = host.querySelector('[data-kpis]');
  const phaseBadge = host.querySelector('[data-phase-badge]');
  const audioInfo = host.querySelector('[data-audio-info]');
  const instFEl = host.querySelector('[data-inst-f]');
  const instHEl = host.querySelector('[data-inst-h]');
  const wfMetaEl = host.querySelector('[data-wf-meta]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const audioPlayBtn = host.querySelector('[data-audio-play]');
  const audioStopBtn = host.querySelector('[data-audio-stop]');
  const cvOrb = host.querySelector('[data-cv-orb]');
  const cvDet = host.querySelector('[data-cv-det]');
  const cvWf = host.querySelector('[data-cv-wf]');

  const sM1 = addSlider(slBox, {
    label: '1. kütle m₁', min: 1.2, max: 120, value: st.m1Solar, log: true,
    fmt: v => formatMassSolarTR(v),
    onInput: v => { st.m1Solar = v; st.fStart = 0; markPreset(host, -1); recompute(); },
  });
  const sM2 = addSlider(slBox, {
    label: '2. kütle m₂', min: 1.2, max: 120, value: st.m2Solar, log: true,
    fmt: v => formatMassSolarTR(v),
    onInput: v => { st.m2Solar = v; st.fStart = 0; markPreset(host, -1); recompute(); },
  });
  const sDist = addSlider(slBox, {
    label: 'Uzaklık D', min: 20, max: 6000, value: st.distanceMpc, log: true,
    fmt: v => `${BH.formatNumTR(v, 0)} Mpc`,
    onInput: v => { st.distanceMpc = v; markPreset(host, -1); recompute(); },
  });
  addSlider(volSlot, {
    label: 'Ses düzeyi', min: 0, max: 1, value: st.volume, step: 0.02,
    fmt: v => `%${Math.round(v * 100)}`,
    onInput: v => {
      st.volume = v;
      if (activeGain && audioCtx) {
        try { activeGain.gain.setTargetAtTime(st.volume * 0.45, audioCtx.currentTime, 0.02); } catch { }
      }
    },
  });

  function stopAudio() {
    if (activeSource) {
      try { activeSource.stop(); } catch { }
      try { activeSource.disconnect(); } catch { }
      activeSource = null;
    }
    if (activeGain) {
      try { activeGain.disconnect(); } catch { }
      activeGain = null;
    }
    audioPlaying = false;
    audioStopBtn.disabled = true;
    audioPlayBtn.innerHTML = `${icon('play')} Cıvıltıyı çal`;
  }

  function playChirpAudio() {
    stopAudio();
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      audioCtx ??= new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const sr = audioCtx.sampleRate || 44100;
      const dur = audioMap.audioDurationSec;
      const totalSamples = Math.max(2048, Math.floor(sr * dur));
      const buf = audioCtx.createBuffer(1, totalSamples, sr);
      const ch = buf.getChannelData(0);
      const wf = gwData.wf;
      const N = wf.f.length;
      const peakA = Math.max(1e-35, wf.peakStrain);
      const fadeSamples = Math.min(Math.floor(sr * 0.02), Math.floor(totalSamples * 0.1));
      let ph = 0;

      for (let i = 0; i < totalSamples; i++) {
        const u = i / (totalSamples - 1);
        const fIdx = u * (N - 1);
        const j = Math.min(N - 2, Math.floor(fIdx));
        const frac = fIdx - j;
        const fHz = lerp(audioMap.audioF[j], audioMap.audioF[j + 1], frac);
        const ampNorm = lerp(wf.amp[j], wf.amp[j + 1], frac) / peakA;
        ph += (2 * Math.PI * fHz) / sr;
        let env = Math.pow(clamp(ampNorm, 0, 1), 0.72);
        if (i < fadeSamples) env *= 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
        else if (i > totalSamples - fadeSamples) {
          const rem = totalSamples - 1 - i;
          env *= 0.5 * (1 - Math.cos((Math.PI * rem) / fadeSamples));
        }
        ch[i] = Math.sin(ph) * env * 0.85;
      }

      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const gain = audioCtx.createGain();
      gain.gain.value = st.volume * 0.45;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.onended = () => {
        if (activeSource === src) stopAudio();
      };
      activeSource = src;
      activeGain = gain;
      audioPlaying = true;
      audioStopBtn.disabled = false;
      audioPlayBtn.innerHTML = `${icon('wave')} Çalıyor…`;
      st.playhead = 0;
      st.playing = true;
      syncPlayBtn(playBtn, true);
      loop.start();
      src.start();
    } catch {
      stopAudio();
    }
  }

  function recompute() {
    stopAudio();
    gwData = computeGwSimulation({
      m1Solar: st.m1Solar,
      m2Solar: st.m2Solar,
      distanceMpc: st.distanceMpc,
      fStart: st.fStart,
      samples: 1400,
    });
    audioMap = mapGwAudioFrequencies(gwData.wf);
    st.playhead = 0;

    renderKpis(kpisEl, [
      { lbl: 'Cıvıltı kütlesi ℳ_c', val: formatMassSolarTR(gwData.chirpMassSolar), sub: `M_top = ${formatMassSolarTR(gwData.totalMassSolar)} → M_f = ${formatMassSolarTR(gwData.finalMassSolar)}`, tone: 'acc' },
      { lbl: 'ISCO / Çınlama f', val: `${BH.formatNumTR(gwData.fIsco, 1)} / ${BH.formatNumTR(gwData.fQnm, 0)} Hz`, sub: `a_f ≈ ${BH.formatNumTR(gwData.finalSpin, 2)}` },
      { lbl: 'Yayılan enerji ΔE', val: `${BH.formatNumTR(gwData.radiatedSolar, 2)} M☉c²`, sub: `%${BH.formatNumTR(gwData.radiatedFraction * 100, 2)} · ${BH.formatSciTR(gwData.radiatedEnergyJ, 2)} J`, tone: 'warn' },
      { lbl: 'Birleşme süresi τ(f₀)', val: formatTimeTR(gwData.timeToMergerSec), sub: `h_tepe = ${BH.formatSciTR(gwData.peakStrain, 2)}` },
    ]);

    const shiftTxt = Math.abs(audioMap.shiftFactor - 1) < 0.02 && !audioMap.compressed
      ? `${Math.round(audioMap.minFreq)}–${Math.round(audioMap.maxFreq)} Hz (gerçek perde)`
      : `${Math.round(audioMap.minFreq)}–${Math.round(audioMap.maxFreq)} Hz (perde kaydırıldı)`;
    audioInfo.textContent = shiftTxt;
    wfMetaEl.textContent = `f₀ = ${BH.formatNumTR(gwData.fStart, 1)} Hz → f_QNM = ${BH.formatNumTR(gwData.fQnm, 0)} Hz`;
    renderAll();
  }

  function currentSampleIndex() {
    const N = gwData.wf.t.length;
    return clamp(Math.floor(st.playhead * (N - 1)), 0, N - 1);
  }

  function renderAll() {
    const wf = gwData.wf;
    const idx = currentSampleIndex();
    const ti = wf.t[idx];
    const fi = wf.f[idx];
    const hi = wf.h[idx];
    const phaseTxt = ti < -0.002 ? 'İçe sarmal (Inspiral)' : ti <= wf.tauQnm * 0.9 ? 'Birleşme (Merger)!' : 'Çınlama (Ringdown)';
    const phaseTone = ti < -0.002 ? 'acc' : ti <= wf.tauQnm * 0.9 ? 'bad' : 'warn';
    phaseBadge.textContent = phaseTxt;
    phaseBadge.className = `bhs-badge bhs-badge-${phaseTone}`;
    instFEl.textContent = `f = ${BH.formatNumTR(fi, 1)} Hz`;
    instHEl.textContent = `h = ${BH.formatSciTR(hi, 2)}`;

    orbCtl.render();
    detCtl.render();
    wfCtl.render();
  }

  function drawBinary(c, W, H) {
    c.clearRect(0, 0, W, H);
    const wf = gwData.wf;
    const idx = currentSampleIndex();
    const ti = wf.t[idx];
    const fi = wf.f[idx];
    const phiOrb = 0.5 * wf.phase[idx];
    const cx = W * 0.5;
    const cy = H * 0.5;
    const maxR = Math.min(W, H) * 0.42;
    const acc = accentColor();

    c.save();
    // Uzay-zaman dörtkutuplu sarmal dalga halkaları
    const rings = 7;
    const hNorm = Math.abs(wf.amp[idx]) / Math.max(1e-35, wf.peakStrain);
    for (let k = 0; k < rings; k++) {
      const rr = ((k / rings + st.playhead * 3.5) % 1) * maxR * 1.15 + 14;
      const fade = (1 - rr / (maxR * 1.25)) * (0.28 + 0.42 * hNorm);
      if (fade <= 0.02) continue;
      c.strokeStyle = `rgba(90, 176, 255, ${fade.toFixed(3)})`;
      c.lineWidth = 1.4;
      c.beginPath();
      for (let s = 0; s <= 72; s++) {
        const ang = (s / 72) * Math.PI * 2;
        const wob = 1 + 0.08 * hNorm * Math.cos(2 * (ang - phiOrb) - rr * 0.09);
        const px = cx + Math.cos(ang) * rr * wob;
        const py = cy + Math.sin(ang) * rr * wob;
        if (s === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.stroke();
    }

    const mTot = st.m1Solar + st.m2Solar;
    if (ti <= 0) {
      // İçe sarmal: Kepler ayrımı a ∝ f^(-2/3)
      const sepFrac = clamp(Math.pow(wf.f[0] / Math.max(wf.f[0], fi), 2 / 3), 0.12, 1);
      const sepPx = maxR * 0.78 * sepFrac;
      const r1 = (st.m2Solar / mTot) * sepPx;
      const r2 = (st.m1Solar / mTot) * sepPx;
      const x1 = cx + Math.cos(phiOrb) * r1;
      const y1 = cy + Math.sin(phiOrb) * r1;
      const x2 = cx - Math.cos(phiOrb) * r2;
      const y2 = cy - Math.sin(phiOrb) * r2;
      const rad1 = clamp(7 + 11 * Math.pow(st.m1Solar / mTot, 0.45), 6, 17);
      const rad2 = clamp(7 + 11 * Math.pow(st.m2Solar / mTot, 0.45), 6, 17);

      // Kısa sarmal iz
      c.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      c.lineWidth = 1.2;
      c.beginPath();
      const startTrail = Math.max(0, idx - 80);
      for (let j = startTrail; j <= idx; j += 2) {
        const sf = clamp(Math.pow(wf.f[0] / Math.max(wf.f[0], wf.f[j]), 2 / 3), 0.12, 1);
        const rr = (st.m2Solar / mTot) * maxR * 0.78 * sf;
        const phj = 0.5 * wf.phase[j];
        const px = cx + Math.cos(phj) * rr;
        const py = cy + Math.sin(phj) * rr;
        if (j === startTrail) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();

      drawBlackHoleDisk(c, x1, y1, rad1, 0, 0, acc);
      drawBlackHoleDisk(c, x2, y2, rad2, 0, 0, COL_WARN);
    } else {
      // Birleşme + çınlama (dörtkutuplu titreşen kalıntı olay ufku)
      const decay = Math.exp(-ti / Math.max(1e-6, wf.tauQnm));
      const qOsc = 0.28 * decay * Math.cos(wf.phase[idx]);
      const baseR = 20;
      c.save();
      c.translate(cx, cy);
      c.rotate(wf.phase[idx] * 0.25);
      c.scale(1 + qOsc, 1 - qOsc);
      drawBlackHoleDisk(c, 0, 0, baseR, 0, 0, acc);
      c.restore();
    }
    c.restore();
  }

  function drawDetector(c, W, H) {
    c.clearRect(0, 0, W, H);
    const wf = gwData.wf;
    const idx = currentSampleIndex();
    const hNorm = wf.h[idx] / Math.max(1e-35, wf.peakStrain);
    const stretch = 0.22 * hNorm; // Abartılmış görsel kol gerinimi

    const ox = W * 0.22;
    const oy = H * 0.76;
    const baseLen = Math.min(W * 0.62, H * 0.58);
    const lx = baseLen * (1 + stretch);
    const ly = baseLen * (1 - stretch);

    c.save();
    // Referans uzunluk işaretleri
    c.strokeStyle = 'rgba(255,255,255,0.16)';
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(ox + baseLen, oy - 14); c.lineTo(ox + baseLen, oy + 14);
    c.moveTo(ox - 14, oy - baseLen); c.lineTo(ox + 14, oy - baseLen);
    c.stroke();
    c.setLineDash([]);

    // Lazer kolları
    c.strokeStyle = COL_BAD;
    c.lineWidth = 3;
    c.shadowColor = COL_BAD;
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(ox, oy); c.lineTo(ox + lx, oy);
    c.moveTo(ox, oy); c.lineTo(ox, oy - ly);
    c.stroke();
    c.shadowBlur = 0;

    // Aynalar (test kütleleri)
    c.fillStyle = '#e4e4e7';
    c.fillRect(ox + lx - 3, oy - 11, 6, 22);
    c.fillRect(ox - 11, oy - ly - 3, 22, 6);

    // Işın bölücü
    c.strokeStyle = COL_CYAN;
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(ox - 9, oy - 9); c.lineTo(ox + 9, oy + 9); c.stroke();

    // Girişim fotodiyotu
    const bright = Math.abs(hNorm);
    c.fillStyle = `rgba(91, 228, 155, ${(0.25 + 0.75 * bright).toFixed(2)})`;
    c.beginPath(); c.arc(ox, oy + 20, 6, 0, Math.PI * 2); c.fill();

    c.font = '10.5px "JetBrains Mono", monospace';
    c.fillStyle = COL_MUTE;
    c.textAlign = 'left';
    c.fillText(`ΔLₓ/L = ${hNorm >= 0 ? '+' : ''}${BH.formatNumTR(hNorm * 0.5, 2)} h_tepe`, 10, 18);
    c.fillText(`ΔLᵧ/L = ${-hNorm >= 0 ? '+' : ''}${BH.formatNumTR(-hNorm * 0.5, 2)} h_tepe`, 10, 34);
    c.restore();
  }

  function drawWaveform(c, W, H) {
    c.clearRect(0, 0, W, H);
    const wf = gwData.wf;
    const N = wf.t.length;
    const padL = 48, padR = 14, padT = 14, padB = 24;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const t0 = wf.t[0];
    const t1 = wf.t[N - 1];
    const peak = Math.max(1e-35, wf.peakStrain);
    const fx = t => padL + ((t - t0) / Math.max(1e-9, t1 - t0)) * pw;
    const fy = h => padT + (0.5 - 0.44 * (h / peak)) * ph;

    c.save();
    c.strokeStyle = COL_AXIS;
    c.beginPath(); c.moveTo(padL, padT + ph * 0.5); c.lineTo(padL + pw, padT + ph * 0.5); c.stroke();

    // t = 0 (birleşme anı) dikey çizgisi
    const xMerge = fx(0);
    c.strokeStyle = 'rgba(255, 107, 107, 0.55)';
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(xMerge, padT); c.lineTo(xMerge, padT + ph); c.stroke();
    c.setLineDash([]);
    c.font = '10px "JetBrains Mono", monospace';
    c.fillStyle = COL_BAD;
    c.textAlign = 'right';
    c.fillText('Birleşme (t = 0)', xMerge - 4, padT + 11);

    // Zarf ve dalga biçimi
    const acc = accentColor();
    c.strokeStyle = acc;
    c.lineWidth = 1.65;
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const px = fx(wf.t[i]);
      const py = fy(wf.h[i]);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.stroke();

    // Oynatma imleci
    const idx = currentSampleIndex();
    const xCur = fx(wf.t[idx]);
    c.strokeStyle = COL_WARN;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(xCur, padT); c.lineTo(xCur, padT + ph); c.stroke();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(xCur, fy(wf.h[idx]), 4.5, 0, Math.PI * 2); c.fill();

    // Eksen yazıları
    c.fillStyle = COL_MUTE;
    c.textAlign = 'right';
    c.fillText('+1', padL - 6, padT + 10);
    c.fillText('0', padL - 6, padT + ph * 0.5 + 3);
    c.fillText('−1', padL - 6, padT + ph - 2);
    c.textAlign = 'left';
    c.fillText(`t = ${BH.formatNumTR(t0, 2)} s`, padL, H - 6);
    c.textAlign = 'right';
    c.fillText(`+${BH.formatNumTR(t1 * 1e3, 1)} ms`, padL + pw, H - 6);
    c.restore();
  }

  const orbCtl = setupCanvas(cvOrb, w => clamp(w * 0.78, 210, 270), drawBinary, clean);
  const detCtl = setupCanvas(cvDet, w => clamp(w * 0.78, 200, 270), drawDetector, clean);
  const wfCtl = setupCanvas(cvWf, w => clamp(w * 0.28, 155, 200), drawWaveform, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const dur = audioPlaying ? audioMap.audioDurationSec : (isReducedMotion() ? 7.5 : 3.4);
    st.playhead += dt / dur;
    if (st.playhead >= 1) {
      st.playhead = audioPlaying ? 1 : 0;
      if (audioPlaying) {
        st.playing = false;
        syncPlayBtn(playBtn, false);
        renderAll();
        return false;
      }
    }
    renderAll();
    return true;
  }, clean);

  const onPlay = () => {
    if (st.playhead >= 0.999) st.playhead = 0;
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onReset = () => {
    stopAudio();
    st.playhead = 0;
    renderAll();
  };

  playBtn.addEventListener('click', onPlay);
  resetBtn.addEventListener('click', onReset);
  audioPlayBtn.addEventListener('click', playChirpAudio);
  audioStopBtn.addEventListener('click', stopAudio);
  clean.add(() => {
    stopAudio();
    if (audioCtx) {
      try { audioCtx.close(); } catch { }
      audioCtx = null;
    }
    playBtn.removeEventListener('click', onPlay);
    resetBtn.removeEventListener('click', onReset);
    audioPlayBtn.removeEventListener('click', playChirpAudio);
    audioStopBtn.removeEventListener('click', stopAudio);
    host.innerHTML = '';
  });

  bindPresets(host, GW_SIM_PRESETS, p => {
    st.m1Solar = p.m1Solar;
    st.m2Solar = p.m2Solar;
    st.distanceMpc = p.distanceMpc;
    st.fStart = p.fStart;
    sM1.set(st.m1Solar);
    sM2.set(st.m2Solar);
    sDist.set(st.distanceMpc);
    recompute();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncPlayBtn(playBtn, st.playing);
  recompute();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 8: KERR: ERGOSFER VE ISCO (bh-kerr)
// =====================================================================

function mountKerr(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const st = {
    aStar: 0.85,
    zamoR: 1.75,
    splitR: 1.55,
    penroseOn: false,
    playing: autoPlayAllowed(),
    angZamo: 0.4,
    angPro: 0,
    angRetro: Math.PI,
    penPhase: 0,
  };
  const effCurve = kerrEfficiencyCurve(81);

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Dönen bir **Kerr** kara deliğinde boyutsuz spin $a_* = a/M$ değiştikçe dış ufuk $r_+$, **ergosfer**, eşyönlü/ters yönlü **ISCO** ve foton yörüngelerini ekvator kesitinde izle. Sıfır açısal momentumlu parçacığın (**ZAMO**) çerçeve sürüklenmesiyle zorunlu eşdönüşünü ve **Penrose süreci** enerji kazancını gör.', KERR_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Kerr Parametreleri (M = 1)</h4>
          <span class="bhs-badge bhs-badge-acc" data-ergo-badge></span>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Dönüşü oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-pen-btn aria-label="Penrose sürecini aç veya kapat">Penrose süreci</button>
        </div>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-alert bhs-alert-acc" data-pen-box></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Ekvator Kesiti: Ufuk, Ergosfer, ZAMO ve ISCO</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_PURP}"></i>Ergosfer (2M)</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_OK}"></i>Eşyönlü ISCO</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${COL_WARN}"></i>Ters yönlü ISCO</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_CYAN}"></i>ZAMO (L = 0)</span>
            </div>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-eq aria-label="Kerr ekvator kesiti ve ergosfer animasyonu"></canvas></div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">İnce Disk Işınım Verimi η(a*) vs Spin (Nükleer Füzyon = %0,7)</h4>
            <span class="bhs-hint mono" data-eff-lbl></span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-eff aria-label="Kerr ışınım verimi grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'r_{\\pm} = M\\left(1 \\pm \\sqrt{1 - a_*^2}\\right), \\qquad r_{\\text{ergo}}(\\theta) = M\\left(1 + \\sqrt{1 - a_*^2\\cos^2\\theta}\\right)',
        '\\omega(r) = \\frac{2 a_* r}{(r^2 + a_*^2)^2 - a_*^2 \\Delta}, \\qquad \\eta = 1 - \\sqrt{1 - \\frac{2}{3 r_{\\text{ISCO}}/M}}',
        'E_0 = E_1 + E_2, \\qquad E_1 < 0 \\text{ (ergosfer içi)} \\implies E_2 = E_0 - E_1 > E_0',
      ],
      paragraphs: [
        'Dönen bir Kerr kara deliğinde dış olay ufku $r_+ = 1 + \\sqrt{1 - a_*^2}$ küçülürken ekvatordaki statik sınır (ergosfer dış sınırı) $r_{\\text{ergo}} = 2M$ konumunda kalır. İkisi arasındaki bölgede (**ergosfer**) uzay-zaman ışıktan hızlı sürüklenir: sıfır açısal momentumlu bir parçacık (**ZAMO**) bile $\\omega(r)$ hızıyla zorunlu olarak kara delikle birlikte döner.',
        'Çerçeve sürüklenmesi kara delikle aynı yönde dönen (eşyönlü / prograde) diski $r_{\\text{ISCO},+} \\to 1M$ yakınlarına kadar kararlı tutar; bu sayede ışınım verimi $a_* = 0$\'da $\\%5,72$\'den $a_* = 0,998$ Thorne sınırında **$\\%32,4$** değerine fırlar.',
        '**Penrose sürecinde** ergosfer içine giren $E_0$ enerjili bir cisim ikiye bölünür: ters yönlü parça negatif toplam enerjiyle ($E_1 < 0$) ufuktan düşerken diğer parça $E_2 > E_0$ enerjisiyle kaçarak kara deliğin dönme enerjisinden pay alır.',
      ],
      tasks: [
        'Spin sürgüsünü $a_* = 0$\'dan $0,998$\'e sürükle; eşyönlü ISCO\'nun $6M \\to 1,24M$ daraldığını, ters yönlü ISCO\'nun $6M \\to 9M$ genişlediğini izle.',
        'ZAMO konumunu ergosfer içine ($r_+ < r < 2M$) indir ve $L = 0$ olmasına rağmen parçacığın nasıl güçlü biçimde sürüklendiğini gözlemle.',
        '**Penrose süreci** düğmesini etkinleştir ve bölünme yarıçapını $r_+$ yakınına çekerek enerji kazancının nasıl arttığını, $r > 2M$ dışına çıkınca neden sıfırlandığını doğrula.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const ergoBadge = host.querySelector('[data-ergo-badge]');
  const penBox = host.querySelector('[data-pen-box]');
  const effLbl = host.querySelector('[data-eff-lbl]');
  const playBtn = host.querySelector('[data-play]');
  const penBtn = host.querySelector('[data-pen-btn]');
  const cvEq = host.querySelector('[data-cv-eq]');
  const cvEff = host.querySelector('[data-cv-eff]');

  const sSpin = addSlider(slBox, {
    label: 'Boyutsuz spin a* = a/M', min: 0, max: 0.998, value: st.aStar, step: 0.002,
    fmt: v => BH.formatNumTR(v, 3),
    onInput: v => { st.aStar = v; markPreset(host, -1); update(); },
  });
  const sZamo = addSlider(slBox, {
    label: 'ZAMO yarıçapı r (L = 0)', min: 1.15, max: 6.0, value: st.zamoR, step: 0.02,
    fmt: v => `${BH.formatNumTR(v, 2)} M`,
    onInput: v => { st.zamoR = v; update(); },
  });
  const sSplit = addSlider(slBox, {
    label: 'Penrose bölünme yarıçapı', min: 1.12, max: 2.5, value: st.splitR, step: 0.02,
    fmt: v => `${BH.formatNumTR(v, 2)} M`,
    onInput: v => { st.splitR = v; update(); },
  });

  function update() {
    const ks = computeKerrState(st.aStar, st.zamoR, st.splitR);
    sSplit.setVisible(st.penroseOn);
    penBtn.classList.toggle('primary', st.penroseOn);
    penBtn.setAttribute('aria-pressed', st.penroseOn ? 'true' : 'false');

    ergoBadge.textContent = ks.zamoInsideErgo ? 'ZAMO ergosfer içinde!' : `Ergosfer kalınlığı: ${BH.formatNumTR(ks.ergoThickness, 2)} M`;
    ergoBadge.className = `bhs-badge bhs-badge-${ks.zamoInsideErgo ? 'warn' : 'acc'}`;
    effLbl.textContent = `η₊ = %${BH.formatNumTR(ks.effPro * 100, 1)} · η₋ = %${BH.formatNumTR(ks.effRetro * 100, 2)}`;

    renderKpis(kpisEl, [
      { lbl: 'Dış ufuk r₊ / Ergosfer', val: `${BH.formatNumTR(ks.rPlus, 2)} / 2,00 M`, sub: `r₋ = ${BH.formatNumTR(ks.rMinus, 2)} M · Ω_H = ${BH.formatNumTR(ks.omegaH, 3)} M⁻¹`, tone: 'acc' },
      { lbl: 'Eşyönlü ISCO (r_ISCO,+)', val: `${BH.formatNumTR(ks.rIscoPro, 2)} M`, sub: `r_ph,+ = ${BH.formatNumTR(ks.rPhPro, 2)} M · η₊ = %${BH.formatNumTR(ks.effPro * 100, 1)}`, tone: 'ok' },
      { lbl: 'Ters yönlü ISCO (r_ISCO,−)', val: `${BH.formatNumTR(ks.rIscoRetro, 2)} M`, sub: `r_ph,− = ${BH.formatNumTR(ks.rPhRetro, 2)} M · η₋ = %${BH.formatNumTR(ks.effRetro * 100, 2)}`, tone: 'warn' },
      { lbl: 'ZAMO sürüklenmesi ω(r)', val: `${BH.formatNumTR(ks.omegaZamo, 4)} M⁻¹`, sub: `Çıkarılabilir dönme: %${BH.formatNumTR(ks.extractableFraction * 100, 1)}` },
    ]);

    if (st.penroseOn) {
      penBox.className = `bhs-alert bhs-alert-${ks.insideErgoSplit ? 'ok' : 'warn'}`;
      penBox.innerHTML = ks.insideErgoSplit
        ? richTex(`**Penrose kazancı (%${BH.formatNumTR(ks.penroseGain * 100, 1)}):** Gelen $E_0 = 1,000$ → ufka düşen $E_1 = ${BH.formatNumTR(ks.penroseE1, 3)} < 0$ ve kaçan **$E_2 = ${BH.formatNumTR(ks.penroseE2, 3)}$** ($E_1 + E_2 = E_0$).`)
        : richTex(`Bölünme yarıçapı ($r = ${BH.formatNumTR(ks.splitR, 2)}\\,M$) ergosfer dışında veya $a_* = 0$: negatif enerji durumu yok, kazanç **%0**.`);
    } else {
      penBox.className = 'bhs-alert bhs-alert-acc';
      penBox.innerHTML = richTex(`**Çerçeve sürüklenmesi:** $L = 0$ olan ZAMO parçacığı $r = ${BH.formatNumTR(ks.zamoR, 2)}\\,M$ konumunda $\\omega = ${BH.formatNumTR(ks.omegaZamo, 4)}\\,M^{-1}$ açısal hızıyla sürüklenir. En fazla **%${BH.formatNumTR(ks.extractableFraction * 100, 1)}** kütle-enerji dönmeden çıkarılabilir.`);
    }

    eqCtl.render();
    effCtl.render();
  }

  function drawEquatorial(c, W, H) {
    c.clearRect(0, 0, W, H);
    const ks = computeKerrState(st.aStar, st.zamoR, st.splitR);
    const cx = W * 0.48;
    const cy = H * 0.5;
    const maxGeomR = 10.2;
    const scale = (Math.min(W, H) * 0.45) / maxGeomR;
    const acc = accentColor();

    c.save();
    // Arka plan çerçeve sürüklenmesi akış çizgileri (spiral vektörler)
    if (ks.aStar > 0.02) {
      c.strokeStyle = 'rgba(192, 132, 252, 0.16)';
      c.lineWidth = 1.1;
      for (let k = 0; k < 12; k++) {
        const a0 = (k / 12) * Math.PI * 2 + st.angZamo * 0.25;
        c.beginPath();
        for (let s = 0; s <= 24; s++) {
          const r = lerp(ks.rPlus + 0.05, 8.5, s / 24);
          const twist = a0 + (ks.aStar * 2.4) / Math.pow(r, 1.3);
          const px = cx + Math.cos(twist) * r * scale;
          const py = cy - Math.sin(twist) * r * scale;
          if (s === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.stroke();
      }
    }

    // Ters yönlü ISCO (sarı kesikli) ve ters yönlü foton yörüngesi
    c.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    c.setLineDash([6, 5]);
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, ks.rIscoRetro * scale, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255, 209, 102, 0.25)';
    c.setLineDash([2, 4]);
    c.beginPath(); c.arc(cx, cy, ks.rPhRetro * scale, 0, Math.PI * 2); c.stroke();

    // Eşyönlü ISCO (yeşil düz) ve eşyönlü foton yörüngesi
    c.setLineDash([]);
    c.strokeStyle = 'rgba(91, 228, 155, 0.72)';
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(cx, cy, ks.rIscoPro * scale, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(91, 228, 155, 0.36)';
    c.setLineDash([2, 3]);
    c.beginPath(); c.arc(cx, cy, ks.rPhPro * scale, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);

    // Ergosfer halkası (r_+ < r < 2M)
    c.fillStyle = 'rgba(192, 132, 252, 0.22)';
    c.strokeStyle = COL_PURP;
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(cx, cy, ks.rErgoEq * scale, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Dış olay ufku r_+ ve iç Cauchy ufku r_-
    c.fillStyle = '#030306';
    c.strokeStyle = acc;
    c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, ks.rPlus * scale, 0, Math.PI * 2); c.fill(); c.stroke();
    if (ks.rMinus > 0.08) {
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.setLineDash([2, 3]);
      c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, ks.rMinus * scale, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
    }

    // Hareketli yörünge parçacıkları (eşyönlü + ters yönlü + ZAMO)
    const drawOrbDot = (r, ang, col, lbl) => {
      const px = cx + Math.cos(ang) * r * scale;
      const py = cy - Math.sin(ang) * r * scale;
      c.fillStyle = col;
      c.strokeStyle = '#000';
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      if (lbl) {
        c.font = '600 10px "JetBrains Mono", monospace';
        c.fillStyle = col;
        c.textAlign = 'left';
        c.fillText(lbl, px + 7, py - 5);
      }
    };
    drawOrbDot(ks.rIscoPro, st.angPro, COL_OK, 'ISCO+');
    drawOrbDot(ks.rIscoRetro, st.angRetro, COL_WARN, 'ISCO−');
    drawOrbDot(ks.zamoR, st.angZamo, COL_CYAN, 'ZAMO');

    // Penrose süreci şeması (aktifse)
    if (st.penroseOn) {
      const splitAng = -0.35;
      const sx = cx + Math.cos(splitAng) * ks.splitR * scale;
      const sy = cy - Math.sin(splitAng) * ks.splitR * scale;
      // Gelen E0 yolu
      c.strokeStyle = '#f4f4f5';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx + 8.5 * scale, cy + 4.5 * scale);
      c.quadraticCurveTo(cx + 4.2 * scale, cy + 2.8 * scale, sx, sy);
      c.stroke();
      // Ufka düşen negatif enerjili E1 yolu
      c.strokeStyle = COL_BAD;
      c.setLineDash([4, 3]);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(cx + Math.cos(splitAng - 0.5) * ks.rPlus * scale, cy - Math.sin(splitAng - 0.5) * ks.rPlus * scale);
      c.stroke();
      c.setLineDash([]);
      // Kaçan yüksek enerjili E2 yolu
      c.strokeStyle = COL_OK;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(sx, sy);
      c.quadraticCurveTo(cx + 3.6 * scale, cy - 3.0 * scale, cx + 8.4 * scale, cy - 5.2 * scale);
      c.stroke();

      // Bölünme noktası
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(sx, sy, 4.5, 0, Math.PI * 2); c.fill();
      c.font = '600 10.5px "JetBrains Mono", monospace';
      c.fillStyle = COL_OK;
      c.fillText(`E₂ = ${BH.formatNumTR(ks.penroseE2, 2)}`, cx + 4.5 * scale, cy - 4.4 * scale);
      c.fillStyle = COL_BAD;
      c.fillText(`E₁ = ${BH.formatNumTR(ks.penroseE1, 2)}`, sx - 58, sy + 14);
    }

    // Sağ üst köşede meridyen (yandan) ergosfer küçük kesiti: r_ergo(θ) = 1 + √(1 - a*² cos²θ)
    if (W >= 320) {
      const ix = W - 56;
      const iy = 56;
      const isc = 16;
      c.fillStyle = 'rgba(0, 0, 0, 0.72)';
      c.strokeStyle = COL_GRID;
      c.lineWidth = 1;
      c.beginPath(); c.rect(ix - 46, iy - 44, 92, 92); c.fill(); c.stroke();

      c.fillStyle = 'rgba(192, 132, 252, 0.25)';
      c.strokeStyle = COL_PURP;
      c.lineWidth = 1.3;
      c.beginPath();
      for (let k = 0; k <= 64; k++) {
        const th = (k / 64) * Math.PI * 2;
        const re = BH.kerrErgosphereGeom(ks.aStar, th);
        const px = ix + re * Math.sin(th) * isc;
        const py = iy - re * Math.cos(th) * isc;
        if (k === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.stroke();

      c.fillStyle = '#030306';
      c.strokeStyle = acc;
      c.lineWidth = 1.4;
      c.beginPath(); c.arc(ix, iy, ks.rPlus * isc, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = '9.5px "JetBrains Mono", monospace';
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText('Yandan kesit', ix, iy + 40);
    }

    c.restore();
  }

  function drawEffChart(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 46, padR = 14, padT = 14, padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const fx = a => padL + ((a + 1) / 2) * pw;
    const fy = pct => padT + ((45 - clamp(pct, 0, 45)) / 45) * ph;

    c.save();
    c.font = '10px "JetBrains Mono", monospace';
    for (const v of [0, 10, 20, 30, 40]) {
      const py = fy(v);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'right';
      c.fillText(`%${v}`, padL - 6, py + 3.5);
    }
    for (const av of [-1, -0.5, 0, 0.5, 1]) {
      const px = fx(av);
      c.strokeStyle = av === 0 ? COL_AXIS : COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText(BH.formatNumTR(av, 1), px, H - 8);
    }

    // Nükleer füzyon referansı (%0,7)
    const pyFus = fy(0.7);
    c.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    c.setLineDash([3, 3]);
    c.beginPath(); c.moveTo(padL, pyFus); c.lineTo(padL + pw, pyFus); c.stroke();
    c.setLineDash([]);
    c.fillStyle = COL_WARN;
    c.textAlign = 'left';
    c.fillText('H füzyonu (%0,7)', padL + 6, pyFus - 5);

    // η(a*) eğrisi
    c.strokeStyle = accentColor();
    c.lineWidth = 2.3;
    c.beginPath();
    effCurve.xs.forEach((a, i) => {
      if (i === 0) c.moveTo(fx(a), fy(effCurve.ys[i]));
      else c.lineTo(fx(a), fy(effCurve.ys[i]));
    });
    c.stroke();

    // Eşyönlü (+a*) ve ters yönlü (-a*) işaretçileri
    const effPro = BH.kerrRadiativeEfficiency(st.aStar, true) * 100;
    const effRet = BH.kerrRadiativeEfficiency(st.aStar, false) * 100;
    c.fillStyle = COL_OK;
    c.strokeStyle = '#fff';
    c.lineWidth = 1.8;
    c.beginPath(); c.arc(fx(st.aStar), fy(effPro), 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = COL_WARN;
    c.beginPath(); c.arc(fx(-st.aStar), fy(effRet), 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }

  const eqCtl = setupCanvas(cvEq, w => clamp(w * 0.64, 260, 380), drawEquatorial, clean);
  const effCtl = setupCanvas(cvEff, w => clamp(w * 0.34, 175, 215), drawEffChart, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    const spd = isReducedMotion() ? 0.35 : 1.0;
    const ks = computeKerrState(st.aStar, st.zamoR, st.splitR);
    st.angZamo += dt * spd * ks.omegaZamo * 7.5;
    st.angPro += dt * spd * (ks.omegaIscoPro || 0.08) * 7.5;
    st.angRetro += dt * spd * (ks.omegaIscoRetro || -0.04) * 7.5;
    st.penPhase = (st.penPhase + dt * spd * 0.45) % 1;
    eqCtl.render();
    return true;
  }, clean);

  const onPlay = () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onPen = () => {
    st.penroseOn = !st.penroseOn;
    update();
  };

  playBtn.addEventListener('click', onPlay);
  penBtn.addEventListener('click', onPen);
  clean.add(() => {
    playBtn.removeEventListener('click', onPlay);
    penBtn.removeEventListener('click', onPen);
    host.innerHTML = '';
  });

  bindPresets(host, KERR_PRESETS, p => {
    st.aStar = p.aStar;
    st.zamoR = p.zamoR;
    st.splitR = p.splitR;
    st.penroseOn = p.penroseOn;
    sSpin.set(st.aStar);
    sZamo.set(st.zamoR);
    sSplit.set(st.splitR);
    update();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 2);
  syncPlayBtn(playBtn, st.playing);
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 9: PENROSE DİYAGRAMI (bh-penrose)
// =====================================================================

function mountPenrose(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const p0 = PENROSE_PRESETS[0];
  const st = {
    X: p0.X,
    T: p0.T,
    vCross: p0.vCross,
    showGrid: true,
    showWorldline: true,
    playing: autoPlayAllowed(),
    probeS: 0.25,
  };
  let penGeo = { cx: 200, cy: 160, scale: 110 };

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Maksimal genişletilmiş **Schwarzschild Penrose (konformal) diyagramında** I–IV bölgelerini keşfet. Işık ışınları her yerde tam **$45^\\circ$** eğimlidir. Olay noktasını sürükleyip ufku ($r = r_s$) geçtiğinde tekilliğin neden **geleceğinde** kaçınılmaz bir an haline geldiğini gör.', PENROSE_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Diyagram ve Dünya Çizgisi</h4>
          <span class="bhs-badge bhs-badge-acc" data-reg-badge></span>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Düşen sondayı oynat veya duraklat"></button>
          <button type="button" class="btn small bhs-act-btn" data-reset aria-label="Sondayı sıfırla">${icon('rotate')} Sıfırla</button>
        </div>
        <div class="bhs-col" data-sliders></div>
        <div class="bhs-alert" data-causal-note></div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Carter-Penrose Konformal Diyagramı (Bölgeler I–IV)</h4>
            <div class="bhs-legend">
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_WARN}"></i>45° ışık konisi</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_OK}"></i>Düşen gözlemci</span>
              <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:${COL_BAD}"></i>Tekillik (r = 0)</span>
            </div>
          </div>
          <div class="bhs-cv-box">
            <canvas class="bhs-cv bhs-cv-drag" data-cv aria-label="Schwarzschild Penrose konformal diyagramı tuvali"></canvas>
            <div class="bhs-cv-tag">Sürükle: olay noktası (X, T)</div>
          </div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        '\\tilde{u} = \\arctan(T_K - X_K), \\qquad \\tilde{v} = \\arctan(T_K + X_K), \\qquad X = \\frac{\\tilde{v} - \\tilde{u}}{2}, \\quad T = \\frac{\\tilde{v} + \\tilde{u}}{2}',
        'X_K^2 - T_K^2 = \\left(\\frac{r}{r_s} - 1\\right)e^{r/r_s} \\implies r = 0 \\iff T = \\pm\\frac{\\pi}{4}',
      ],
      paragraphs: [
        'Konformal sıkıştırma sonsuz uzay-zamanı sonlu bir diyagrama sığdırırken **nedensel yapıyı** (ışık konilerini) korur: tüm radyal ışık ışınları her noktada kesin $\\pm 45^\\circ$ açıyla ilerler; kütleli her gözlemcinin dünya çizgisi ışık konisinin içinde ($|dX/dT| < 1$) kalmak zorundadır.',
        '**Bölge I** bizim dış evrenimizdir; dışa giden $+45^\\circ$ ışınlar gelecek ışık sonsuzuna ($\\mathscr{I}^+$) kaçar. Olay ufku $r = r_s$ ($T = X$) geçilip **Bölge II**\'ye (kara delik içi) girildiğinde ise hem $+45^\\circ$ hem $-45^\\circ$ ışık ışınları yatay $r = 0$ çizgisine çarpar. Bu, tekilliğin uzayda etrafından dolaşılabilecek bir nokta değil, **gelecekte bir zaman anı** olduğunu kanıtlar.',
      ],
      tasks: [
        'Olay noktasını **Bölge I** içinde sürükle; $+45^\\circ$ (sağ) ışık ışınının $\\mathscr{I}^+$ sınırına kaçtığını, $-45^\\circ$ ışınının ufku geçtiğini doğrula.',
        'Noktayı $45^\\circ$ olay ufkundan geçirip **Bölge II** içine bırak; her iki ışık konisi kolunun da üstteki dalgalı $r = 0$ tekilliğine çarptığını gör.',
        'Düşen sonda animasyonunu oynat; ufkun dışındayken gönderilen sinyallerin $\\mathscr{I}^+$\'a ulaştığını, ufuk geçildikten sonra hiçbir sinyalin kaçamadığını gözlemle.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const regBadge = host.querySelector('[data-reg-badge]');
  const causalNote = host.querySelector('[data-causal-note]');
  const playBtn = host.querySelector('[data-play]');
  const resetBtn = host.querySelector('[data-reset]');
  const cv = host.querySelector('[data-cv]');

  const sVCross = addSlider(slBox, {
    label: 'Ufuk geçiş konumu v_ufuk', min: 0.3, max: 2.0, value: st.vCross, step: 0.02,
    fmt: v => BH.formatNumTR(v, 2),
    onInput: v => { st.vCross = v; update(); },
  });
  const sProbe = addSlider(slBox, {
    label: 'Düşen sonda ilerlemesi', min: 0, max: 0.99, value: st.probeS, step: 0.005,
    fmt: v => `%${BH.formatNumTR(v * 100, 0)}`,
    onInput: v => {
      st.probeS = v;
      const wl = penroseInfallingWorldline(st.vCross, 80);
      const pt = wl[Math.min(wl.length - 1, Math.floor(v * (wl.length - 1)))];
      st.X = pt.X;
      st.T = clamp(pt.T, -QUARTER_PI + 0.02, QUARTER_PI - 0.02);
      update();
    },
  });
  addToggle(slBox, 'Sabit r ve sabit t ızgarasını göster', st.showGrid, v => { st.showGrid = v; cvCtl.render(); });
  addToggle(slBox, 'Düşen gözlemci dünya çizgisini göster', st.showWorldline, v => { st.showWorldline = v; cvCtl.render(); });

  const REGION_INFO = {
    I: { title: 'Bölge I · Dış Evrenimiz', tone: 'ok', desc: 'Sağ (+45°) ışık ışını gelecek ışık sonsuzuna (ℐ⁺) kaçabilir. Tekillikten kaçınmak mümkündür.' },
    II: { title: 'Bölge II · Kara Delik İçi', tone: 'bad', desc: 'Tüm gelecek ışık konisi üstteki r = 0 tekilliğine çarpar! Tekillik bir yer değil, kaçınılmaz bir gelecek anıdır.' },
    III: { title: 'Bölge III · Paralel Dış Evren', tone: 'acc', desc: 'Einstein-Rosen köprüsünün diğer tarafındaki dış bölge; Bölge I\'den nedensel (ışıktan yavaş) geçiş mümkün değildir.' },
    IV: { title: 'Bölge IV · Beyaz Delik İçi', tone: 'warn', desc: 'Zaman-ters simetrik geçmiş bölge; tüm dünya çizgileri geçmiş r = 0 tekilliğinden çıkıp ufkun dışına akar.' },
  };

  function update() {
    const info = penroseToSchwarzschild(st.X, st.T);
    const cone = penroseFutureLightCone(st.X, st.T);
    const rMeta = REGION_INFO[info.region] || REGION_INFO.I;

    regBadge.textContent = rMeta.title;
    regBadge.className = `bhs-badge bhs-badge-${rMeta.tone}`;

    renderKpis(kpisEl, [
      { lbl: 'Bölge', val: info.region ? `Bölge ${info.region}` : 'Sınır', sub: rMeta.title.split('· ')[1] || '', tone: rMeta.tone },
      { lbl: 'Yarıçap r / rₛ', val: Number.isFinite(info.rOverRs) ? `${BH.formatNumTR(info.rOverRs, 2)} rₛ` : '—', sub: info.rOverRs < 1 ? 'olay ufkunun içi' : 'olay ufkunun dışı' },
      { lbl: 'Koordinat zamanı t / rₛ', val: Number.isFinite(info.tOverRs) ? BH.formatNumTR(info.tOverRs, 2) : '±∞', sub: 'Schwarzschild zamanı' },
      { lbl: 'Işık kaçışı (ℐ⁺)', val: cone.trapped ? '✕ İmkânsız (tuzak)' : '✓ Mümkün', sub: cone.trapped ? 'her iki 45° ışın r=0\'a düşer' : 'sağ/sol 45° ışın kaçar', tone: cone.trapped ? 'bad' : 'ok' },
    ]);

    causalNote.className = `bhs-alert bhs-alert-${rMeta.tone}`;
    causalNote.textContent = rMeta.desc;
    cvCtl.render();
  }

  function drawPenrose(c, W, H) {
    c.clearRect(0, 0, W, H);
    const cx = W * 0.5;
    const cy = H * 0.5;
    // Diyagram X ∈ [-π/2, π/2], T ∈ [-π/4, π/4]
    const scale = Math.min((W - 56) / Math.PI, (H - 54) / HALF_PI);
    penGeo = { cx, cy, scale };
    const toPx = (X, T) => [cx + X * scale, cy - T * scale];
    const acc = accentColor();

    c.save();
    // Bölge dolguları
    const fillPoly = (pts, fill) => {
      c.fillStyle = fill;
      c.beginPath();
      pts.forEach(([X, T], i) => {
        const [px, py] = toPx(X, T);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.closePath();
      c.fill();
    };
    fillPoly([[0, 0], [QUARTER_PI, QUARTER_PI], [HALF_PI, 0], [QUARTER_PI, -QUARTER_PI]], 'rgba(91, 228, 155, 0.06)'); // I
    fillPoly([[0, 0], [-QUARTER_PI, QUARTER_PI], [QUARTER_PI, QUARTER_PI]], 'rgba(255, 107, 107, 0.10)'); // II
    fillPoly([[0, 0], [-QUARTER_PI, QUARTER_PI], [-HALF_PI, 0], [-QUARTER_PI, -QUARTER_PI]], 'rgba(90, 176, 255, 0.05)'); // III
    fillPoly([[0, 0], [-QUARTER_PI, -QUARTER_PI], [QUARTER_PI, -QUARTER_PI]], 'rgba(255, 209, 102, 0.06)'); // IV

    // Kesin Kruskal sabit-r ve sabit-t eğrileri
    if (st.showGrid) {
      c.lineWidth = 0.9;
      // Sabit r > 1 (Bölge I ve III)
      c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      for (const rVal of [1.25, 1.8, 3.0, 5.0]) {
        for (const reg of ['I', 'III']) {
          c.beginPath();
          for (let k = -36; k <= 36; k++) {
            const p = schwarzschildToPenrose(rVal, k * 0.28, reg);
            const [px, py] = toPx(p.X, p.T);
            if (k === -36) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
        }
      }
      // Sabit r < 1 (Bölge II ve IV)
      c.strokeStyle = 'rgba(255, 107, 107, 0.20)';
      for (const rVal of [0.25, 0.55, 0.82]) {
        for (const reg of ['II', 'IV']) {
          c.beginPath();
          for (let k = -30; k <= 30; k++) {
            const p = schwarzschildToPenrose(rVal, k * 0.26, reg);
            const [px, py] = toPx(p.X, p.T);
            if (k === -30) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
        }
      }
      // Sabit t dilimleri (Bölge I)
      c.strokeStyle = 'rgba(90, 176, 255, 0.15)';
      for (const tVal of [-3, -1.5, 0, 1.5, 3]) {
        c.beginPath();
        for (let k = 0; k <= 32; k++) {
          const rVal = 1.002 + Math.pow(k / 32, 2.2) * 14;
          const p = schwarzschildToPenrose(rVal, tVal, 'I');
          const [px, py] = toPx(p.X, p.T);
          if (k === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.stroke();
      }
    }

    // Dış ışık sonsuzu sınırları ℐ±
    c.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    c.lineWidth = 1.4;
    const drawSeg = (a, b) => {
      const [x1, y1] = toPx(a[0], a[1]);
      const [x2, y2] = toPx(b[0], b[1]);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    };
    drawSeg([QUARTER_PI, QUARTER_PI], [HALF_PI, 0]);
    drawSeg([HALF_PI, 0], [QUARTER_PI, -QUARTER_PI]);
    drawSeg([-QUARTER_PI, QUARTER_PI], [-HALF_PI, 0]);
    drawSeg([-HALF_PI, 0], [-QUARTER_PI, -QUARTER_PI]);

    // 45° olay ufukları (r = r_s)
    c.strokeStyle = acc;
    c.lineWidth = 2;
    c.setLineDash([6, 4]);
    drawSeg([-QUARTER_PI, -QUARTER_PI], [QUARTER_PI, QUARTER_PI]);
    drawSeg([-QUARTER_PI, QUARTER_PI], [QUARTER_PI, -QUARTER_PI]);
    c.setLineDash([]);

    // Dalgalı yatay tekillik çizgileri (T = ±π/4, r = 0)
    const drawWavySingularity = Tval => {
      c.strokeStyle = COL_BAD;
      c.lineWidth = 2.6;
      c.beginPath();
      const [xL, yBase] = toPx(-QUARTER_PI, Tval);
      const [xR] = toPx(QUARTER_PI, Tval);
      const steps = 44;
      for (let i = 0; i <= steps; i++) {
        const px = lerp(xL, xR, i / steps);
        const py = yBase + Math.sin(i * 1.45) * 3.2;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
    };
    drawWavySingularity(QUARTER_PI);
    drawWavySingularity(-QUARTER_PI);

    // Bölge ve sonsuzluk etiketleri
    c.font = '600 12px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(244,244,245,0.75)';
    const putTxt = (txt, X, T, col = 'rgba(244,244,245,0.72)') => {
      const [px, py] = toPx(X, T);
      c.fillStyle = col;
      c.fillText(txt, px, py);
    };
    putTxt('I', QUARTER_PI * 1.15, 0.04, COL_OK);
    putTxt('II', 0, QUARTER_PI * 0.56, COL_BAD);
    putTxt('III', -QUARTER_PI * 1.15, 0.04, COL_BLUE);
    putTxt('IV', 0, -QUARTER_PI * 0.52, COL_WARN);
    c.font = '10.5px "JetBrains Mono", monospace';
    putTxt('Tekillik r = 0 (Gelecek)', 0, QUARTER_PI + 0.11, COL_BAD);
    putTxt('Geçmiş tekillik r = 0', 0, -QUARTER_PI - 0.14, COL_MUTE);
    putTxt('ℐ⁺', QUARTER_PI * 1.62, QUARTER_PI * 0.62, COL_MUTE);
    putTxt('ℐ⁻', QUARTER_PI * 1.62, -QUARTER_PI * 0.62, COL_MUTE);
    putTxt('i⁰', HALF_PI + 0.11, 0.03, COL_MUTE);
    putTxt('i⁺', QUARTER_PI + 0.08, QUARTER_PI + 0.08, COL_MUTE);

    // Düşen gözlemci dünya çizgisi + periyodik 45° ışık sinyalleri
    if (st.showWorldline) {
      const wl = penroseInfallingWorldline(st.vCross, 80);
      c.strokeStyle = COL_OK;
      c.lineWidth = 2.2;
      c.beginPath();
      wl.forEach((pt, i) => {
        const [px, py] = toPx(pt.X, pt.T);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.stroke();

      // Dünya çizgisi boyunca örnek 45° ışık sinyalleri
      c.strokeStyle = 'rgba(255, 209, 102, 0.42)';
      c.lineWidth = 1.2;
      for (const frac of [0.22, 0.46, 0.78]) {
        const ep = wl[Math.floor(frac * (wl.length - 1))];
        const rc = penroseFutureLightCone(ep.X, ep.T);
        drawSeg([ep.X, ep.T], [rc.rightEnd.X, rc.rightEnd.T]);
      }
    }

    // Seçili olay noktasının kesin ±45° gelecek ışık konisi
    const cone = penroseFutureLightCone(st.X, st.T);
    const [ox, oy] = toPx(st.X, st.T);
    const [rx, ry] = toPx(cone.rightEnd.X, cone.rightEnd.T);
    const [lx, ly] = toPx(cone.leftEnd.X, cone.leftEnd.T);

    // Gelecek ışık konisi dolgusu
    c.fillStyle = cone.trapped ? 'rgba(255, 107, 107, 0.24)' : 'rgba(255, 209, 102, 0.18)';
    c.beginPath();
    c.moveTo(ox, oy);
    c.lineTo(lx, ly);
    c.lineTo(rx, ry);
    c.closePath();
    c.fill();

    // ±45° ışık ışınları
    c.strokeStyle = COL_WARN;
    c.lineWidth = 2.3;
    c.beginPath();
    c.moveTo(ox, oy); c.lineTo(rx, ry);
    c.moveTo(ox, oy); c.lineTo(lx, ly);
    c.stroke();

    // Çarpma / kaçış noktaları
    c.fillStyle = cone.rightEnd.target === 'singularity' ? COL_BAD : COL_OK;
    c.beginPath(); c.arc(rx, ry, 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = cone.leftEnd.target === 'singularity' ? COL_BAD : COL_OK;
    c.beginPath(); c.arc(lx, ly, 4.5, 0, Math.PI * 2); c.fill();

    // Sürüklenebilir olay noktası
    c.fillStyle = '#fff';
    c.strokeStyle = cone.trapped ? COL_BAD : COL_OK;
    c.lineWidth = 2.4;
    c.beginPath(); c.arc(ox, oy, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }

  const cvCtl = setupCanvas(cv, w => clamp(w * 0.62, 270, 390), drawPenrose, clean);

  const dragEventTo = p => {
    const X = (p.x - penGeo.cx) / Math.max(1, penGeo.scale);
    const T = -(p.y - penGeo.cy) / Math.max(1, penGeo.scale);
    // Diyagram içine kıstır
    const Tclamp = clamp(T, -QUARTER_PI + 0.03, QUARTER_PI - 0.03);
    const maxX = HALF_PI - Math.abs(Tclamp) - 0.03;
    st.X = clamp(X, -maxX, maxX);
    st.T = Tclamp;
    st.playing = false;
    loop.stop();
    syncPlayBtn(playBtn, false);
    markPreset(host, -1);
    update();
  };
  bindDragCanvas(cv, {
    onDown: p => { dragEventTo(p); return true; },
    onMove: (p, active) => { if (active) dragEventTo(p); },
  }, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing) return false;
    st.probeS = (st.probeS + dt * (isReducedMotion() ? 0.08 : 0.18)) % 0.99;
    const wl = penroseInfallingWorldline(st.vCross, 80);
    const pt = wl[Math.min(wl.length - 1, Math.floor(st.probeS * (wl.length - 1)))];
    st.X = pt.X;
    st.T = clamp(pt.T, -QUARTER_PI + 0.02, QUARTER_PI - 0.02);
    sProbe.set(st.probeS);
    update();
    return true;
  }, clean);

  const onPlay = () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start();
    else loop.stop();
  };
  const onReset = () => {
    st.probeS = 0.1;
    const wl = penroseInfallingWorldline(st.vCross, 80);
    const pt = wl[Math.floor(st.probeS * (wl.length - 1))];
    st.X = pt.X;
    st.T = pt.T;
    sProbe.set(st.probeS);
    update();
  };

  playBtn.addEventListener('click', onPlay);
  resetBtn.addEventListener('click', onReset);
  clean.add(() => {
    playBtn.removeEventListener('click', onPlay);
    resetBtn.removeEventListener('click', onReset);
    host.innerHTML = '';
  });

  bindPresets(host, PENROSE_PRESETS, p => {
    st.X = p.X;
    st.T = p.T;
    st.vCross = p.vCross;
    st.playing = p.id === 'infall' && autoPlayAllowed();
    sVCross.set(st.vCross);
    syncPlayBtn(playBtn, st.playing);
    update();
    if (st.playing) loop.start();
    else loop.stop();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncPlayBtn(playBtn, st.playing);
  update();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// SİMÜLASYON 10: YIĞILMA DİSKİ VE EDDINGTON (bh-accretion)
// =====================================================================

function mountAccretion(host, ctx) {
  ensureBhSimsCss();
  const clean = createClean(ctx);
  const p0 = ACCRETION_PRESETS[0];
  const st = {
    massSolar: p0.massSolar,
    eddRatio: p0.eddRatio,
    aStar: p0.aStar,
    showCompare: true,
    playing: autoPlayAllowed(),
    rotPhase: 0,
  };
  // Referans karşılaştırma diskleri (X-ışını ikilisi 10 M☉ vs Kuasar 10⁸ M☉)
  const refXrb = computeAccretionDisk({ massSolar: 10, eddRatio: 0.15, aStar: 0, radialBins: 64, energyBins: 140 });
  const refQso = computeAccretionDisk({ massSolar: 1e8, eddRatio: 0.25, aStar: 0.7, radialBins: 64, energyBins: 140 });
  let curDisk = computeAccretionDisk(st);

  host.innerHTML = `<div class="bhs-wrap">
    ${introHtml('Shakura-Sunyaev ince **yığılma diskinin** sıcaklık profili $T(r)$ ile halkaların toplamından doğan çok sıcaklıklı kara cisim tayfını ($\\nu L_\\nu$) incele. **Eddington sınırını** ve **X-ışını ikilisi** ile **kuasar** diskleri arasındaki kütle ölçeklemesini karşılaştır.', ACCRETION_PRESETS)}
    <div class="bhs-grid">
      <div class="bhs-panel">
        <div class="bhs-head">
          <h4 class="bhs-title">Disk ve Yığılma Ayarları</h4>
          <span class="bhs-badge bhs-badge-acc" data-edd-badge></span>
        </div>
        <div class="bhs-act-row">
          <button type="button" class="btn primary small bhs-act-btn" data-play aria-label="Disk akışını oynat veya duraklat"></button>
        </div>
        <div class="bhs-col" data-sliders></div>
        <div>
          <div class="bhs-ctrl-top"><span class="bhs-ctrl-lbl">Eddington oranı (L / L_Edd)</span><span class="bhs-ctrl-val mono" data-edd-pct></span></div>
          <div class="bhs-meter-track" aria-hidden="true"><div class="bhs-meter-fill" data-edd-bar></div></div>
        </div>
        <div class="bhs-alert" data-edd-note></div>
        <div class="bhs-table-wrap">
          <table class="bhs-tbl" aria-label="X-ışını ikilisi ve Kuasar karşılaştırma tablosu">
            <thead><tr><th>Sistem</th><th>T_maks</th><th>Tepe bant</th><th>Ṁ_Edd</th></tr></thead>
            <tbody data-cmp-body></tbody>
          </table>
        </div>
      </div>
      <div class="bhs-col">
        <div class="bhs-kpis" data-kpis aria-live="polite"></div>
        <div class="bhs-grid-eq">
          <div class="bhs-plot-card">
            <div class="bhs-head">
              <h4 class="bhs-title">Çok Sıcaklıklı Disk Tayfı νL_ν (Normalize)</h4>
              <div class="bhs-legend">
                <span class="bhs-legend-item"><i class="bhs-legend-swatch" style="background:var(--acc)"></i>Seçili disk</span>
                <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${COL_CYAN}"></i>X-ışını ikilisi</span>
                <span class="bhs-legend-item"><i class="bhs-legend-swatch bhs-legend-dash" style="border-color:${COL_WARN}"></i>Kuasar</span>
              </div>
            </div>
            <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-spec aria-label="Çok sıcaklıklı yığılma diski tayf grafiği"></canvas></div>
          </div>
          <div class="bhs-plot-card">
            <div class="bhs-head">
              <h4 class="bhs-title">Üstten Termal Disk Görünümü</h4>
              <span class="bhs-hint mono" data-rin-lbl></span>
            </div>
            <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-disk aria-label="Üstten yığılma diski sıcaklık haritası"></canvas></div>
          </div>
        </div>
        <div class="bhs-plot-card">
          <div class="bhs-head">
            <h4 class="bhs-title">Radyal Sıcaklık Profili T(r) vs r / r_g (Log–Log)</h4>
            <span class="bhs-hint">T(r) ∝ r⁻³/⁴ · tepe r = (49/36) r_ISCO</span>
          </div>
          <div class="bhs-cv-box"><canvas class="bhs-cv" data-cv-temp aria-label="Disk sıcaklık profili grafiği"></canvas></div>
        </div>
      </div>
    </div>
    ${theoryAndTasksHtml({
      equations: [
        'T(r) = \\left[\\frac{3GM\\dot{M}}{8\\pi\\sigma_{\\text{SB}} r^3}\\left(1 - \\sqrt{\\frac{r_{\\text{in}}}{r}}\\right)\\right]^{1/4}, \\qquad L_{\\text{Edd}} = \\frac{4\\pi G M m_p c}{\\sigma_T}',
        'L_\\nu = 4\\pi^2 \\int_{r_{\\text{in}}}^{r_{\\text{out}}} B_\\nu\\!\\big(T(r)\\big)\\, r\\,dr, \\qquad T_{\\text{maks}} \\propto f_{\\text{Edd}}^{1/4} M^{-1/4}',
      ],
      paragraphs: [
        'İnce yığılma diskinde her yarıçap halkası yerel sıcaklığında $T(r)$ bir kara cisim gibi ışır. Tüm halkaların üst üste binmesi tek bir Planck eğrisinden daha geniş, orta bölgede $\\nu L_\\nu \\propto \\nu^{4/3}$ eğimli **çok sıcaklıklı disk tayfını** oluşturur.',
        'Sabit Eddington oranında $T_{\\text{maks}} \\propto M^{-1/4}$ olduğu için **$10\\,M_\\odot$ yıldızsal X-ışını ikilileri** $\\sim 10^7\\,\\text{K}$ ile **X-ışınlarında** parlarken, **$10^8\\,M_\\odot$ kuasar diskleri** çok daha serin ($\\sim 10^5\\,\\text{K}$) olup **morötesi/görünür** bölgede ("Büyük Mavi Tümsek") tepe yapar.',
        'Parlaklık $L_{\\text{Edd}}$ sınırını aştığında ışınım basıncı protonlara etkiyen kütleçekimini yenerek güçlü disk rüzgârları ve kalın süper-Eddington akışı başlatır.',
      ],
      tasks: [
        '**Yıldızsal disk (10 M☉)** ile **Kuasar (10⁸ M☉)** önayarları arasında geçiş yap; kütlenin $10^7$ kat artmasının tepe sıcaklığını neden $10^{7/4} \\approx 56$ kat düşürdüğünü gör.',
        'Spin sürgüsünü $a_* = 0$\'dan $0,998$\'e çıkar; $r_{\\text{ISCO}}$ daraldıkça diskin iç kenarının nasıl daha da ısındığını ve tayfın yüksek enerjiye kaydığını izle.',
        '**Süper-Eddington** önayarını seç veya $\\dot{M}/\\dot{M}_{\\text{Edd}} > 1$ yap; Eddington sınırı uyarısını ve kütle akış hızını ($M_\\odot/\\text{yıl}$) incele.',
      ],
    })}
  </div>`;

  const slBox = host.querySelector('[data-sliders]');
  const kpisEl = host.querySelector('[data-kpis]');
  const eddBadge = host.querySelector('[data-edd-badge]');
  const eddPct = host.querySelector('[data-edd-pct]');
  const eddBar = host.querySelector('[data-edd-bar]');
  const eddNote = host.querySelector('[data-edd-note]');
  const cmpBody = host.querySelector('[data-cmp-body]');
  const rinLbl = host.querySelector('[data-rin-lbl]');
  const playBtn = host.querySelector('[data-play]');
  const cvSpec = host.querySelector('[data-cv-spec]');
  const cvDisk = host.querySelector('[data-cv-disk]');
  const cvTemp = host.querySelector('[data-cv-temp]');

  const sMass = addSlider(slBox, {
    label: 'Kara delik kütlesi M (log)', min: 3, max: 4.1e10, value: st.massSolar, log: true,
    fmt: v => formatMassSolarTR(v),
    onInput: v => { st.massSolar = v; markPreset(host, -1); recompute(); },
  });
  const sEdd = addSlider(slBox, {
    label: 'Yığılma oranı Ṁ / Ṁ_Edd', min: 0.005, max: 1.8, value: st.eddRatio, log: true,
    fmt: v => `${BH.formatNumTR(v, 2)} Ṁ_Edd`,
    onInput: v => { st.eddRatio = v; markPreset(host, -1); recompute(); },
  });
  const sSpin = addSlider(slBox, {
    label: 'Kerr spini a* (r_in = r_ISCO)', min: 0, max: 0.998, value: st.aStar, step: 0.005,
    fmt: v => BH.formatNumTR(v, 3),
    onInput: v => { st.aStar = v; markPreset(host, -1); recompute(); },
  });
  addToggle(slBox, 'X-ışını ikilisi & Kuasar kıyasını çiz', st.showCompare, v => {
    st.showCompare = v; specCtl.render();
  });

  function recompute() {
    curDisk = computeAccretionDisk({
      massSolar: st.massSolar,
      eddRatio: st.eddRatio,
      aStar: st.aStar,
      radialBins: 80,
      energyBins: 140,
    });

    eddBadge.textContent = curDisk.superEddington ? '⚠ Süper-Eddington!' : curDisk.wienBand;
    eddBadge.className = `bhs-badge bhs-badge-${curDisk.superEddington ? 'bad' : 'acc'}`;
    eddPct.textContent = `%${BH.formatNumTR(curDisk.eddRatio * 100, 1)}`;
    eddBar.style.width = `${clamp((curDisk.eddRatio / 1.5) * 100, 1, 100).toFixed(1)}%`;
    rinLbl.textContent = `r_ISCO = ${BH.formatNumTR(curDisk.rInOverRg, 2)} r_g`;

    renderKpis(kpisEl, [
      { lbl: 'Azami sıcaklık T_maks', val: `${BH.formatSciTR(curDisk.Tmax, 2)} K`, sub: `r_tepe = ${BH.formatNumTR(curDisk.rPeakOverRg, 2)} r_g`, tone: 'acc' },
      { lbl: 'Tayf tepe enerjisi', val: curDisk.spectrum.peakEnergyEv >= 1000 ? `${BH.formatNumTR(curDisk.spectrum.peakEnergyEv * 1e-3, 2)} keV` : `${BH.formatNumTR(curDisk.spectrum.peakEnergyEv, 2)} eV`, sub: curDisk.spectrum.peakBand },
      { lbl: 'Disk parlaklığı L_bol', val: `${BH.formatSciTR(curDisk.lBolW, 2)} W`, sub: `L_Edd = ${BH.formatSciTR(curDisk.lEddW, 2)} W`, tone: curDisk.superEddington ? 'bad' : 'ok' },
      { lbl: 'Yığılma hızı Ṁ', val: `${BH.formatSciTR(curDisk.mdotSolarPerYr, 2)} M☉/yıl`, sub: `verim η = %${BH.formatNumTR(curDisk.eta * 100, 1)}` },
    ]);

    eddNote.className = `bhs-alert bhs-alert-${curDisk.superEddington ? 'bad' : 'acc'}`;
    eddNote.innerHTML = curDisk.superEddington
      ? richTex('**Süper-Eddington akış ($L > L_{\\text{Edd}}$):** Işınım basıncı kütleçekimini aşıyor! İnce disk şişerek kalın huniye dönüşür ve güçlü rüzgârlar/jetler maddeyi dışarı iter.')
      : richTex(`**Eddington altı kararlı ince disk:** Parlaklık $L_{\\text{Edd}}$ sınırının **%${BH.formatNumTR(curDisk.eddRatio * 100, 1)}** düzeyinde; ışınım basıncı kütleçekimle dengede.`);

    const fmtRow = (name, d, hi) => `<tr class="${hi ? 'bhs-tbl-hi' : ''}">
      <td>${esc(name)}</td>
      <td class="mono">${esc(BH.formatSciTR(d.Tmax, 1))} K</td>
      <td>${esc(d.spectrum.peakBand)}</td>
      <td class="mono">${esc(BH.formatSciTR((d.mdotEddKgS * BH.YEAR) / BH.M_SUN, 1))} M☉/y</td>
    </tr>`;
    cmpBody.innerHTML = fmtRow('Seçili disk', curDisk, true)
      + fmtRow('X-ışını ikilisi (10 M☉)', refXrb, false)
      + fmtRow('Kuasar (10⁸ M☉)', refQso, false);

    specCtl.render();
    diskCtl.render();
    tempCtl.render();
  }

  function drawSpectrum(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 44, padR = 14, padT = 22, padB = 28;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const logE0 = -2; // 0.01 eV
    const logE1 = 5;  // 100 keV
    const logY0 = -4; // tepeye göre 4 onluk alt
    const logY1 = 0.2;
    const fx = eEv => padL + ((Math.log10(eEv) - logE0) / (logE1 - logE0)) * pw;
    const fy = rel => padT + ((logY1 - clamp(Math.log10(Math.max(1e-12, rel)), logY0, logY1)) / (logY1 - logY0)) * ph;

    c.save();
    // Görünür ışık bandı (1,65–3,26 eV) arka plan şeridi
    const xVis1 = fx(1.65);
    const xVis2 = fx(3.26);
    const gVis = c.createLinearGradient(xVis1, 0, xVis2, 0);
    gVis.addColorStop(0, 'rgba(255,60,60,0.18)');
    gVis.addColorStop(0.5, 'rgba(90,255,140,0.18)');
    gVis.addColorStop(1, 'rgba(130,90,255,0.18)');
    c.fillStyle = gVis;
    c.fillRect(xVis1, padT, xVis2 - xVis1, ph);

    c.font = '10px "JetBrains Mono", monospace';
    const bands = [[-1.1, 'IR'], [0.4, 'Gör.'], [1.5, 'UV'], [3.3, 'X-ışını']];
    c.fillStyle = COL_MUTE;
    c.textAlign = 'center';
    for (const [le, lbl] of bands) c.fillText(lbl, fx(Math.pow(10, le)), padT - 6);

    for (let e = -2; e <= 5; e += 1) {
      const px = fx(Math.pow(10, e));
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      if (e % 2 === 0 || e === 5) {
        c.fillStyle = COL_MUTE;
        c.fillText(e >= 3 ? `${Math.pow(10, e - 3)}keV` : e >= 0 ? `${Math.pow(10, e)}eV` : `10${BH.toSuperscript(e)}`, px, H - 8);
      }
    }
    for (const ly of [-4, -3, -2, -1, 0]) {
      const py = fy(Math.pow(10, ly));
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'right';
      c.fillText(`10${BH.toSuperscript(ly)}`, padL - 5, py + 3.5);
    }

    const drawCurve = (disk, color, dash = [], lw = 2) => {
      const sp = disk.spectrum;
      const pk = Math.max(1e-35, sp.peakNuLnu);
      c.strokeStyle = color;
      c.setLineDash(dash);
      c.lineWidth = lw;
      c.beginPath();
      let pen = false;
      for (let i = 0; i < sp.energiesEv.length; i++) {
        const rel = sp.nuLnu[i] / pk;
        if (rel < 1e-4) { pen = false; continue; }
        const px = fx(sp.energiesEv[i]);
        const py = fy(rel);
        if (!pen) { c.moveTo(px, py); pen = true; }
        else c.lineTo(px, py);
      }
      c.stroke();
      c.setLineDash([]);
    };

    c.save();
    c.beginPath(); c.rect(padL, padT, pw, ph); c.clip();
    if (st.showCompare) {
      drawCurve(refXrb, COL_CYAN, [5, 4], 1.6);
      drawCurve(refQso, COL_WARN, [5, 4], 1.6);
    }
    drawCurve(curDisk, accentColor(), [], 2.6);
    c.restore();
    c.restore();
  }

  function drawDiskTop(c, W, H) {
    c.clearRect(0, 0, W, H);
    const cx = W * 0.5;
    const cy = H * 0.5;
    const maxR = Math.min(W, H) * 0.44;
    const prof = curDisk.profile;
    const tMax = Math.max(1, curDisk.Tmax);
    const rHorFrac = clamp(1.5 / (curDisk.rInOverRg * 4.2), 0.08, 0.24);
    const rInPx = maxR * clamp(curDisk.rInOverRg / 22, 0.16, 0.36);

    c.save();
    // Dıştan içe sıcaklık halkaları (Shakura-Sunyaev T(r) rengi)
    const rings = 36;
    for (let i = rings - 1; i >= 0; i--) {
      const u0 = i / rings;
      const u1 = (i + 1) / rings;
      const rPx = lerp(rInPx, maxR, u1);
      const pIdx = Math.min(prof.length - 1, Math.floor(Math.pow(u0, 1.4) * (prof.length * 0.72)));
      const T = prof[pIdx]?.T || 0;
      // Görsel kontrast için T'yi 1500–25000 K görünür renk skalasına eşle (gerçek göreli profil korunur!)
      const relT = clamp(T / tMax, 0, 1);
      const visT = 1400 + relT * (curDisk.Tmax > 1e6 ? 26000 : curDisk.Tmax > 3e4 ? 14000 : 6500);
      const rgb = BH.blackbodyToRGB(visT);
      const alpha = clamp(0.18 + 0.82 * Math.pow(relT, 0.65), 0.12, 0.96);
      c.fillStyle = rgbCss(rgb, alpha);
      c.beginPath();
      c.arc(cx, cy, rPx, 0, Math.PI * 2);
      c.fill();
    }

    // Kepler kesme akış çizgileri (iç halkalar dıştan hızlı döner!)
    c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    c.lineWidth = 1.1;
    for (let k = 0; k < 5; k++) {
      const rad = lerp(rInPx + 8, maxR - 8, k / 4);
      const omegaVis = Math.pow(rInPx / rad, 1.5);
      const a0 = st.rotPhase * omegaVis * 2.2 + k * 1.1;
      c.beginPath();
      c.arc(cx, cy, rad, a0, a0 + 0.95);
      c.stroke();
    }

    // İç kara delik gölgesi (ISCO içi karanlık)
    c.fillStyle = '#030306';
    c.beginPath(); c.arc(cx, cy, rInPx, 0, Math.PI * 2); c.fill();
    drawBlackHoleDisk(c, cx, cy, Math.max(8, maxR * rHorFrac), 0, rInPx, accentColor());
    c.restore();
  }

  function drawTempProfile(c, W, H) {
    c.clearRect(0, 0, W, H);
    const padL = 52, padR = 14, padT = 14, padB = 26;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const prof = curDisk.profile;
    const logR0 = Math.log10(Math.max(1, curDisk.rInOverRg));
    const logR1 = Math.log10(curDisk.rInOverRg * 120);
    const logTMax = Math.log10(Math.max(10, curDisk.Tmax)) + 0.35;
    const logTMin = logTMax - 2.6;
    const fx = rRg => padL + ((Math.log10(Math.max(1, rRg)) - logR0) / (logR1 - logR0)) * pw;
    const fy = T => padT + ((logTMax - clamp(Math.log10(Math.max(1, T)), logTMin, logTMax)) / (logTMax - logTMin)) * ph;

    c.save();
    c.font = '10px "JetBrains Mono", monospace';
    for (let k = 0; k <= 3; k++) {
      const lt = lerp(logTMin, logTMax, k / 3);
      const py = padT + (1 - k / 3) * ph;
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(padL, py); c.lineTo(padL + pw, py); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'right';
      c.fillText(`10${BH.toSuperscript(Math.round(lt * 10) / 10)}K`, padL - 5, py + 3.5);
    }
    for (let k = 0; k <= 4; k++) {
      const rRg = Math.pow(10, lerp(logR0, logR1, k / 4));
      const px = fx(rRg);
      c.strokeStyle = COL_GRID;
      c.beginPath(); c.moveTo(px, padT); c.lineTo(px, padT + ph); c.stroke();
      c.fillStyle = COL_MUTE;
      c.textAlign = 'center';
      c.fillText(`${BH.formatNumTR(rRg, rRg < 10 ? 1 : 0)}r_g`, px, H - 8);
    }

    c.save();
    c.beginPath(); c.rect(padL, padT, pw, ph); c.clip();
    c.strokeStyle = COL_WARN;
    c.lineWidth = 2.3;
    c.beginPath();
    let started = false;
    for (const pt of prof) {
      if (!(pt.T > 0) || pt.rOverRg > curDisk.rInOverRg * 120) continue;
      const px = fx(pt.rOverRg);
      const py = fy(pt.T);
      if (!started) { c.moveTo(px, py); started = true; }
      else c.lineTo(px, py);
    }
    c.stroke();

    // Tepe sıcaklık noktası (49/36 r_ISCO)
    c.fillStyle = '#fff';
    c.strokeStyle = COL_WARN;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(fx(curDisk.rPeakOverRg), fy(curDisk.Tmax), 5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    c.restore();
  }

  const specCtl = setupCanvas(cvSpec, w => clamp(w * 0.68, 220, 290), drawSpectrum, clean);
  const diskCtl = setupCanvas(cvDisk, w => clamp(w * 0.72, 210, 290), drawDiskTop, clean);
  const tempCtl = setupCanvas(cvTemp, w => clamp(w * 0.30, 165, 205), drawTempProfile, clean);

  const loop = createAnimLoop((_now, dt) => {
    if (!st.playing || isReducedMotion()) return false;
    st.rotPhase = (st.rotPhase + dt * 1.1) % (Math.PI * 20);
    diskCtl.render();
    return true;
  }, clean);

  const onPlay = () => {
    st.playing = !st.playing;
    syncPlayBtn(playBtn, st.playing);
    if (st.playing) loop.start();
    else loop.stop();
  };
  playBtn.addEventListener('click', onPlay);
  clean.add(() => {
    playBtn.removeEventListener('click', onPlay);
    host.innerHTML = '';
  });

  bindPresets(host, ACCRETION_PRESETS, p => {
    st.massSolar = p.massSolar;
    st.eddRatio = p.eddRatio;
    st.aStar = p.aStar;
    sMass.set(st.massSolar);
    sEdd.set(st.eddRatio);
    sSpin.set(st.aStar);
    recompute();
  }, clean);

  bindTasks(host, clean);
  markPreset(host, 0);
  syncPlayBtn(playBtn, st.playing);
  recompute();
  if (st.playing) loop.start();
  return clean.run;
}

// =====================================================================
// 13. MODÜL DIŞA AKTARIM SÖZLEŞMESİ (SIMS)
// =====================================================================

export const SIMS = [
  {
    id: 'bh-orbits',
    field: 'karadelik',
    title: 'Göreli Yörüngeler',
    icon: 'rotate',
    desc: 'Schwarzschild uzay-zamanında parçacık yörüngelerini, enberi presesyonunu ve Newton kıyasını canlı bütünleştir.',
    mount: mountOrbits,
  },
  {
    id: 'bh-potential',
    field: 'karadelik',
    title: 'Etkin Potansiyel',
    icon: 'chart',
    desc: 'Kütleli parçacık ve ışık için göreli etkin potansiyel eğrisini, dönüm noktalarını ve ISCO birleşimini keşfet.',
    mount: mountPotential,
  },
  {
    id: 'bh-light',
    field: 'karadelik',
    title: 'Işığın Bükülmesi',
    icon: 'sparkle',
    desc: 'Kritik çarpışma parametresi çevresinde sıfır jeodeziklerin bükülmesini, foton küresi sarımını ve Einstein halkasını incele.',
    mount: mountLight,
  },
  {
    id: 'bh-redshift',
    field: 'karadelik',
    title: 'Zaman & Kırmızı Kayma',
    icon: 'clock',
    desc: 'Ufka inen sondanın saatini, tayf çizgisindeki kütleçekimsel kırmızıya kaymayı ve Dünya GPS etkisini karşılaştır.',
    mount: mountRedshift,
  },
  {
    id: 'bh-tidal',
    field: 'karadelik',
    title: 'Gelgit & Spagettileşme',
    icon: 'arrow',
    desc: 'Radyal düşüşte gelgit gerilmesi ile sıkışmasını, spagettileşme yarıçapını ve ufku sağlam geçme kütle eşiğini gör.',
    mount: mountTidal,
  },
  {
    id: 'bh-hawking',
    field: 'karadelik',
    title: 'Hawking Işıması',
    icon: 'flame',
    desc: 'Kütle ölçeğinde Hawking sıcaklığı, ışıma gücü, tayf bölgesi ve buharlaşma patlamasını logaritmik zamanda izle.',
    mount: mountHawking,
  },
  {
    id: 'bh-gw',
    field: 'karadelik',
    title: 'Kütleçekim Dalgaları',
    icon: 'wave',
    desc: 'İki kara deliğin içe sarmalını, birleşme ve çınlama dalga biçimini, kol gerinimini ve cıvıltı sesini deneyimle.',
    mount: mountGW,
  },
  {
    id: 'bh-kerr',
    field: 'karadelik',
    title: 'Kerr: Ergosfer & ISCO',
    icon: 'atom',
    desc: 'Dönen kara delikte ergosfer, çerçeve sürüklenmesi, eşyönlü/ters yönlü ISCO, disk verimi ve Penrose kazancını incele.',
    mount: mountKerr,
  },
  {
    id: 'bh-penrose',
    field: 'karadelik',
    title: 'Penrose Diyagramı',
    icon: 'grid',
    desc: 'Schwarzschild konformal diyagramında I–IV bölgelerini, 45° ışık konilerini ve ufuk içi geleceği sürükleyerek gör.',
    mount: mountPenrose,
  },
  {
    id: 'bh-accretion',
    field: 'karadelik',
    title: 'Yığılma Diski',
    icon: 'star',
    desc: 'İnce diskin sıcaklık profilini, çok sıcaklıklı kara cisim tayfını, Eddington sınırını ve kuasar–X-ışını ikilisi farkını kıyasla.',
    mount: mountAccretion,
  },
];
