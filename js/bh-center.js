// MathPad Kara Delik Bölümü (Part 4 of 4)
// 6 sekme: Gözlemevi, Simülasyonlar, Hesaplayıcı, Konu Anlatımı, Alıştırmalar, Katalog.
// Arayüz sözleşmesi: export const BH_TABS, export function mountBlackHole(host, tabId, ctx) -> cleanup.
// Saf yardımcılar DOM veya tarayıcı API'si olmadan doğrudan Node testlerinde çalışır.

import * as BH from './bh-core.js';
import { mountObservatory, resolveObservatoryOpts, OBSERVATORY_PRESETS } from './bh-observatory.js';
import { SIMS } from './bh-sims.js';
import { makeRng, checkAnswer, answerText, LEVELS } from './gtps-kit.js';
import { BH_LESSONS } from './bh-lessons.js';

const _isDomRuntime = typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && typeof matchMedia === 'function';

const [_uiMod, _fxMod, _physUiMod] = _isDomRuntime
  ? await Promise.all([import('./ui.js'), import('./fx.js'), import('./phys-ui.js')])
  : [null, null, null];

const esc = _uiMod?.esc
  ?? (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const icon = _uiMod?.icon
  ?? ((name, cls = '') => `<span class="i ${cls}" data-icon="${esc(name)}" aria-hidden="true"></span>`);
const toast = _uiMod?.toast ?? (() => {});
const full = _fxMod?.full ?? (() => false);
const constellationBurst = _fxMod?.constellationBurst ?? (() => {});
const syncSegments = _fxMod?.syncSegments ?? (() => {});
const tex = _physUiMod?.tex ?? (s => `<span class="mono">${esc(s)}</span>`);
const richTex = _physUiMod?.richTex
  ?? (s => esc(String(s ?? '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));
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

function ensureBhCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (!document.querySelector('link[href*="bh.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/bh.css';
    document.head.append(link);
  }
}

// =====================================================================
// 1. SEKME SÖZLEŞMESİ, SABİTLER VE DEPOLAMA ANAHTARLARI
// =====================================================================

/** Kara Delik bölümü sekmeleri (js/app.js #/karadelik/<tab> yönlendiricisi sözleşmesi). */
export const BH_TABS = Object.freeze([
  Object.freeze({ id: 'gozlemevi', title: 'Gözlemevi', icon: 'sparkle' }),
  Object.freeze({ id: 'simulasyonlar', title: 'Simülasyonlar', icon: 'atom' }),
  Object.freeze({ id: 'hesaplayici', title: 'Hesaplayıcı', icon: 'calc' }),
  Object.freeze({ id: 'konu', title: 'Konu Anlatımı', icon: 'book' }),
  Object.freeze({ id: 'alistirma', title: 'Alıştırmalar', icon: 'check' }),
  Object.freeze({ id: 'katalog', title: 'Katalog', icon: 'star' }),
]);

/** localStorage anahtarları (tümü mp.bh. ön ekli). */
export const BH_STORAGE_KEYS = Object.freeze({
  exerciseStats: 'mp.bh.exerciseStats',
  lessonsRead: 'mp.bh.lessonsRead',
  calcState: 'mp.bh.calcState',
});

/** Ay kütlesi [kg] (IAU standart değeri). */
export const M_MOON = 7.342e22;
/** Referans insan kütlesi [kg]. */
export const M_PERSON = 70;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const CAT_MAP = new Map(BH.BH_CATALOG.map(o => [o.id, o]));

// =====================================================================
// 2. TÜRKÇE BİÇİMLENDİRME VE BİRİM YARDIMCILARI (SAF)
// =====================================================================

/** Türkçe veya bilimsel sayı dizesini (virgül/nokta/boşluk) sayıya çevirir. */
export function parseTRNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const s = String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(',', '.');
  if (!s) return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

export const MASS_UNITS = Object.freeze([
  Object.freeze({ id: 'solar', label: 'Güneş kütlesi (M☉)', short: 'M☉', kgPerUnit: BH.M_SUN }),
  Object.freeze({ id: 'kg', label: 'Kilogram (kg)', short: 'kg', kgPerUnit: 1 }),
  Object.freeze({ id: 'earth', label: 'Dünya kütlesi (M⊕)', short: 'M⊕', kgPerUnit: BH.M_EARTH }),
]);

export const DIST_UNITS = Object.freeze([
  Object.freeze({ id: 'pc', label: 'Parsek (pc)', short: 'pc', metersPerUnit: BH.PARSEC }),
  Object.freeze({ id: 'kpc', label: 'Kiloparsek (kpc)', short: 'kpc', metersPerUnit: BH.KPC }),
  Object.freeze({ id: 'Mpc', label: 'Megaparsek (Mpc)', short: 'Mpc', metersPerUnit: BH.MPC }),
  Object.freeze({ id: 'ly', label: 'Işık yılı (ly)', short: 'ly', metersPerUnit: BH.LIGHT_YEAR }),
  Object.freeze({ id: 'au', label: 'Astronomik birim (AU)', short: 'AU', metersPerUnit: BH.AU }),
  Object.freeze({ id: 'km', label: 'Kilometre (km)', short: 'km', metersPerUnit: 1e3 }),
]);

/** Kütle değerini seçilen birimden kilograma çevirir. */
export function convertMassToKg(value, unitId = 'solar') {
  const v = parseTRNumber(value);
  if (!(v > 0)) return NaN;
  const u = MASS_UNITS.find(x => x.id === unitId) || MASS_UNITS[0];
  return v * u.kgPerUnit;
}

/** Kilogram kütleyi seçilen birime çevirir. */
export function convertKgToUnit(massKg, unitId = 'solar') {
  if (!(massKg > 0) || !Number.isFinite(massKg)) return NaN;
  const u = MASS_UNITS.find(x => x.id === unitId) || MASS_UNITS[0];
  return massKg / u.kgPerUnit;
}

/** Uzaklık değerini seçilen birimden metreye çevirir. */
export function convertDistanceToMeters(value, unitId = 'pc') {
  const v = parseTRNumber(value);
  if (!(v > 0)) return null;
  const u = DIST_UNITS.find(x => x.id === unitId) || DIST_UNITS[0];
  return v * u.metersPerUnit;
}

/** Uzunluğu (m) uygun ölçekli Türkçe metne dönüştürür (part 1 formatSciTR/formatNumTR ile). */
export function formatLengthTR(meters) {
  if (meters === Infinity) return '∞';
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters === 0) return '0 m';
  if (meters < 1e-12) return `${BH.formatSciTR(meters, 2, { forceSci: true })} m`;
  if (meters < 1e-6) return `${BH.formatSciTR(meters * 1e9, 2)} nm`;
  if (meters < 1e-3) return `${BH.formatSciTR(meters * 1e6, 2)} μm`;
  if (meters < 1) return `${BH.formatSciTR(meters * 1e3, 2)} mm`;
  if (meters < 1e3) return `${BH.formatSciTR(meters, 2)} m`;
  if (meters < 1e10) return `${BH.formatSciTR(meters * 1e-3, 2)} km`;
  const au = meters / BH.AU;
  if (au < 1e5) return `${BH.formatSciTR(meters * 1e-3, 2)} km (${BH.formatSciTR(au, 2)} AU)`;
  return `${BH.formatSciTR(meters / BH.LIGHT_YEAR, 2)} ly`;
}

/** Süreyi (s) okunaklı Türkçe birime dönüştürür. */
export function formatDurationTR(seconds) {
  if (seconds === Infinity) return '∞';
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds === 0) return '0 s';
  if (seconds < 1e-9) return `${BH.formatSciTR(seconds, 2, { forceSci: true })} s`;
  if (seconds < 1e-6) return `${BH.formatSciTR(seconds * 1e9, 2)} ns`;
  if (seconds < 1e-3) return `${BH.formatSciTR(seconds * 1e6, 2)} μs`;
  if (seconds < 1) return `${BH.formatSciTR(seconds * 1e3, 2)} ms`;
  if (seconds < 90) return `${BH.formatSciTR(seconds, 2)} s`;
  if (seconds < 5400) return `${BH.formatSciTR(seconds / 60, 2)} dk`;
  if (seconds < 172800) return `${BH.formatSciTR(seconds / 3600, 2)} sa`;
  if (seconds < 2 * BH.YEAR) return `${BH.formatSciTR(seconds / 86400, 2)} gün`;
  return `${BH.formatSciTR(BH.secToYears(seconds), 2)} yıl`;
}

/** Açısal boyutu (μas) okunaklı Türkçe dizeye çevirir. */
export function formatAngleUasTR(uas) {
  if (!Number.isFinite(uas) || !(uas > 0)) return '—';
  if (uas >= 1e6) return `${BH.formatSciTR(uas * 1e-6, 2)} arcsec`;
  if (uas >= 1e4) return `${BH.formatSciTR(uas * 1e-3, 2)} mas`;
  if (uas >= 0.01) return `${BH.formatSciTR(uas, 2)} μas`;
  return `${BH.formatSciTR(uas, 2, { forceSci: true })} μas`;
}

/** Frekansı (Hz) okunaklı Türkçe birime dönüştürür. */
export function formatFreqTR(hz) {
  if (!Number.isFinite(hz) || !(hz > 0)) return '—';
  if (hz < 1e-3) return `${BH.formatSciTR(hz, 2, { forceSci: true })} Hz`;
  if (hz < 1) return `${BH.formatSciTR(hz * 1e3, 2)} mHz`;
  if (hz < 1e4) return `${BH.formatSciTR(hz, 2)} Hz`;
  if (hz < 1e7) return `${BH.formatSciTR(hz * 1e-3, 2)} kHz`;
  return `${BH.formatSciTR(hz, 2, { forceSci: true })} Hz`;
}

// =====================================================================
// 3. GÖZLEMEVİ VE SİMÜLASYON YÖNLENDİRME YARDIMCILARI (SAF)
// =====================================================================

function parseBoolParam(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'evet') return true;
    if (s === '0' || s === 'false' || s === 'hayir' || s === 'hayır') return false;
  }
  return undefined;
}

/** ctx.params nesnesini mountObservatory(host, opts) seçeneklerine güvenle dönüştürür. */
export function buildObservatoryOpts(params = {}) {
  const opts = {};
  if (!params || typeof params !== 'object') return opts;

  if (typeof params.preset === 'string' && params.preset.trim()) {
    opts.preset = params.preset.trim();
  }
  const mass = parseTRNumber(params.mass);
  if (Number.isFinite(mass) && mass > 0) opts.mass = mass;

  const spin = parseTRNumber(params.spin);
  if (Number.isFinite(spin)) opts.spin = spin;

  const incl = parseTRNumber(params.inclination);
  if (Number.isFinite(incl)) opts.inclination = incl;

  const dist = parseTRNumber(params.distance ?? params.cameraDistance);
  if (Number.isFinite(dist) && dist > 0) opts.distance = dist;

  const distPc = parseTRNumber(params.distancePc);
  if (Number.isFinite(distPc) && distPc > 0) opts.distancePc = distPc;

  const showDisk = parseBoolParam(params.showDisk);
  if (showDisk !== undefined) opts.showDisk = showDisk;

  const lensing = parseBoolParam(params.lensing);
  if (lensing !== undefined) opts.lensing = lensing;

  const showOverlay = parseBoolParam(params.showOverlay);
  if (showOverlay !== undefined) opts.showOverlay = showOverlay;

  if (typeof params.qualityMode === 'string' && params.qualityMode.trim()) {
    opts.qualityMode = params.qualityMode.trim();
  }
  return opts;
}

/** Verilen id ile SIMS içindeki kara delik simülasyonunu bulur. */
export function findSimById(simId) {
  if (!simId) return null;
  const key = String(simId).trim().toLowerCase();
  return SIMS.find(s => s.id.toLowerCase() === key) || null;
}

// =====================================================================
// 4. HESAPLAYICI ÖNAYARLARI VE SAF TABLO OLUŞTURUCU
// =====================================================================

const CAT_SGR = CAT_MAP.get('sgr-a');
const CAT_M87 = CAT_MAP.get('m87-star');
const CAT_TON = CAT_MAP.get('ton-618');
const CAT_CYG = CAT_MAP.get('cygnus-x1');

/** Hesaplayıcı hızlı nesne seçicisi önayarları. */
export const CALC_PRESETS = Object.freeze([
  Object.freeze({ id: 'person', label: 'İnsan (70 kg)', massValue: 70, massUnit: 'kg', massKg: M_PERSON, spin: 0, distanceValue: '', distanceUnit: 'km', catalogId: null }),
  Object.freeze({ id: 'moon', label: 'Ay', massValue: M_MOON, massUnit: 'kg', massKg: M_MOON, spin: 0, distanceValue: 384400, distanceUnit: 'km', catalogId: null }),
  Object.freeze({ id: 'earth', label: 'Dünya', massValue: 1, massUnit: 'earth', massKg: BH.M_EARTH, spin: 0, distanceValue: '', distanceUnit: 'km', catalogId: null }),
  Object.freeze({ id: 'sun', label: 'Güneş', massValue: 1, massUnit: 'solar', massKg: BH.M_SUN, spin: 0, distanceValue: 1, distanceUnit: 'au', catalogId: null }),
  Object.freeze({ id: 'cygnus-x1', label: 'Cygnus X-1', massValue: CAT_CYG ? CAT_CYG.massSolar : 21.2, massUnit: 'solar', massKg: BH.solarMassToKg(CAT_CYG ? CAT_CYG.massSolar : 21.2), spin: CAT_CYG?.spin ?? 0.998, distanceValue: 2.22, distanceUnit: 'kpc', catalogId: 'cygnus-x1' }),
  Object.freeze({ id: 'sgr-a', label: 'Sgr A*', massValue: CAT_SGR ? CAT_SGR.massSolar : 4.15e6, massUnit: 'solar', massKg: BH.solarMassToKg(CAT_SGR ? CAT_SGR.massSolar : 4.15e6), spin: 0, distanceValue: 8.28, distanceUnit: 'kpc', catalogId: 'sgr-a' }),
  Object.freeze({ id: 'm87-star', label: 'M87*', massValue: CAT_M87 ? CAT_M87.massSolar : 6.5e9, massUnit: 'solar', massKg: BH.solarMassToKg(CAT_M87 ? CAT_M87.massSolar : 6.5e9), spin: 0, distanceValue: 16.8, distanceUnit: 'Mpc', catalogId: 'm87-star' }),
  Object.freeze({ id: 'ton-618', label: 'TON 618', massValue: CAT_TON ? CAT_TON.massSolar : 4.07e10, massUnit: 'solar', massKg: BH.solarMassToKg(CAT_TON ? CAT_TON.massSolar : 4.07e10), spin: 0, distanceValue: 3200, distanceUnit: 'Mpc', catalogId: 'ton-618' }),
]);

/** Yarıçap kaydırıcısı u ∈ [0, 1] -> r/r_s ∈ [1,01 .. 101] (logaritmik duyarlılık). */
export function radiusSliderToRs(u) {
  const t = clamp(Number(u) || 0, 0, 1);
  return 1 + 0.01 * Math.pow(1e4, t);
}

/** r/r_s ∈ [1,01 .. 101] -> logaritmik kaydırıcı değeri u ∈ [0, 1]. */
export function rsToRadiusSlider(rOverRs) {
  const excess = clamp((Number(rOverRs) || 2) - 1, 0.01, 100);
  return clamp(Math.log(excess / 0.01) / Math.log(1e4), 0, 1);
}

/** ctx.params'tan Hesaplayıcı başlangıç durumunu çözer. */
export function resolveCalculatorParams(params = {}) {
  const base = {
    presetId: 'sgr-a',
    objectLabel: 'Sgr A*',
    massValue: '4.15e6',
    massUnit: 'solar',
    spin: 0,
    distanceValue: '8.28',
    distanceUnit: 'kpc',
    radiusInRs: 2.0,
  };
  if (!params || typeof params !== 'object' || Object.keys(params).length === 0) return base;

  const pKey = String(params.preset || params.object || '').trim().toLowerCase();
  if (pKey) {
    const preset = CALC_PRESETS.find(p => p.id === pKey);
    if (preset) {
      Object.assign(base, {
        presetId: preset.id,
        objectLabel: preset.label,
        massValue: String(preset.massValue),
        massUnit: preset.massUnit,
        spin: preset.spin,
        distanceValue: preset.distanceValue === '' ? '' : String(preset.distanceValue),
        distanceUnit: preset.distanceUnit,
      });
    } else {
      const cat = CAT_MAP.get(pKey);
      if (cat) {
        const dChoice = pickBestDistanceUnit(cat.distancePc);
        Object.assign(base, {
          presetId: cat.id,
          objectLabel: cat.name,
          massValue: String(cat.massSolar),
          massUnit: 'solar',
          spin: cat.spin !== null ? clamp(cat.spin, -0.998, 0.998) : 0,
          distanceValue: String(dChoice.value),
          distanceUnit: dChoice.unit,
        });
      }
    }
  }

  const rawUnit = typeof params.unit === 'string' && MASS_UNITS.some(u => u.id === params.unit)
    ? params.unit
    : null;
  const rawMass = parseTRNumber(params.mass);
  const rawMassKg = parseTRNumber(params.massKg);

  if (Number.isFinite(rawMassKg) && rawMassKg > 0) {
    base.massUnit = 'kg';
    base.massValue = String(rawMassKg);
    if (!pKey) { base.presetId = 'custom'; base.objectLabel = 'Özel Değer'; base.distanceValue = ''; }
  } else if (Number.isFinite(rawMass) && rawMass > 0) {
    base.massUnit = rawUnit || 'solar';
    base.massValue = String(rawMass);
    if (!pKey) {
      base.presetId = 'custom';
      base.objectLabel = 'Özel Değer';
      base.distanceValue = '';
    }
  }

  const rawSpin = parseTRNumber(params.spin);
  if (Number.isFinite(rawSpin)) {
    base.spin = clamp(rawSpin, -0.998, 0.998);
  }

  const rawDistPc = parseTRNumber(params.distancePc);
  if (Number.isFinite(rawDistPc) && rawDistPc > 0) {
    const dChoice = pickBestDistanceUnit(rawDistPc);
    base.distanceValue = String(dChoice.value);
    base.distanceUnit = dChoice.unit;
  } else {
    const rawDist = parseTRNumber(params.distance);
    if (Number.isFinite(rawDist) && rawDist > 0) {
      base.distanceValue = String(rawDist);
      if (typeof params.distanceUnit === 'string' && DIST_UNITS.some(u => u.id === params.distanceUnit)) {
        base.distanceUnit = params.distanceUnit;
      }
    }
  }

  const rawR = parseTRNumber(params.radiusInRs);
  if (Number.isFinite(rawR) && rawR > 1) {
    base.radiusInRs = clamp(rawR, 1.005, 1000);
  }

  return base;
}

function pickBestDistanceUnit(pc) {
  if (!(pc > 0)) return { value: '', unit: 'pc' };
  if (pc >= 1e6) return { value: Number((pc / 1e6).toPrecision(4)), unit: 'Mpc' };
  if (pc >= 1e3) return { value: Number((pc / 1e3).toPrecision(4)), unit: 'kpc' };
  return { value: Number(pc.toPrecision(4)), unit: 'pc' };
}

/**
 * Verilen kütle (kg veya M☉), isteğe bağlı spin ve uzaklık için js/bh-core.js tabanlı
 * tam kara delik fizik tablosunu üreten saf hesaplayıcı fonksiyonu.
 */
export function buildBlackHoleTable({
  massKg = null,
  massSolar = null,
  spin = 0,
  distanceM = null,
  distancePc = null,
  radiusInRs = 2.0,
  bodyLengthM = 2.0,
  limitG = 10,
  label = null,
} = {}) {
  const mKg = Number.isFinite(massKg) && massKg > 0
    ? massKg
    : (Number.isFinite(massSolar) && massSolar > 0 ? BH.solarMassToKg(massSolar) : NaN);

  if (!(mKg > 0) || !Number.isFinite(mKg)) {
    return { valid: false, error: 'Geçerli, pozitif bir kütle değeri girin.', inputs: null, values: null, sections: [], rows: [] };
  }

  const mSol = BH.kgToSolarMass(mKg);
  const aStar = clamp(Number.isFinite(spin) ? spin : 0, -0.9999, 0.9999);
  const absSpin = Math.abs(aStar);
  const hasSpin = absSpin > 1e-6;
  const distM = Number.isFinite(distanceM) && distanceM > 0
    ? distanceM
    : (Number.isFinite(distancePc) && distancePc > 0 ? BH.pcToM(distancePc) : null);
  const rFactor = Math.max(1.0001, Number.isFinite(radiusInRs) ? radiusInRs : 2.0);

  // Temel Schwarzschild büyüklükleri (js/bh-core.js)
  const schw = BH.schwarzschildSummary(mKg, distM);
  const rs = schw.schwarzschildRadius;
  const rg = schw.gravRadius;
  const rPh = schw.photonSphereRadius;
  const rIscoSchw = schw.iscoRadius;
  const bc = schw.shadowRadius;
  const shadowDiameter = 2 * bc;
  const shadowAngularRad = schw.shadowAngularRad;
  const shadowAngularUas = schw.shadowAngularUas;
  const meanDensity = schw.meanDensity;
  const surfaceGravity = schw.surfaceGravity;

  // Kerr büyüklükleri (js/bh-core.js)
  const kerr = BH.kerrSummary(mKg, aStar);
  const rPlus = kerr.rPlus;
  const rMinus = kerr.rMinus;
  const ergosphereEq = kerr.ergosphereEq;
  const iscoPrograde = kerr.iscoPrograde;
  const iscoRetrograde = kerr.iscoRetrograde;
  const iscoProgradeGeom = kerr.iscoProgradeGeom;
  const iscoRetrogradeGeom = kerr.iscoRetrogradeGeom;
  const photonPrograde = kerr.photonPrograde;
  const photonRetrograde = kerr.photonRetrograde;
  const radiativeEfficiency = kerr.efficiencyPrograde;
  const radiativeEfficiencyRetro = kerr.efficiencyRetrograde;

  // Seçilen yarıçapta (r = rFactor * r_s) saatler ve kırmızıya kayma
  const rProbeM = rFactor * rs;
  const timeDilationStatic = BH.staticTimeDilation(mKg, rProbeM);
  const timeDilationCircular = rProbeM > rPh ? BH.circularOrbitTimeDilation(mKg, rProbeM) : NaN;
  const redshiftOnePlusZ = BH.gravitationalRedshiftFactor(mKg, rProbeM);
  const redshiftZ = BH.gravitationalRedshift(mKg, rProbeM);
  const escapeVelAtProbe = BH.escapeVelocity(mKg, rProbeM);

  const referenceRadii = [1.05, 1.5, 2, 3, 10].map(k => {
    const rm = k * rs;
    return {
      rOverRs: k,
      rMeters: rm,
      dTauDt: BH.staticTimeDilation(mKg, rm),
      z: BH.gravitationalRedshift(mKg, rm),
      onePlusZ: BH.gravitationalRedshiftFactor(mKg, rm),
    };
  });

  // ISCO yörünge periyodu (Schwarzschild + Kerr prograde/retrograde)
  const schwIscoOrb = BH.circularOrbitPeriod(mKg, rIscoSchw);
  const tg = BH.gravTime(mKg);
  const kerrProOrb = BH.kerrCircularOrbitGeom(iscoProgradeGeom, absSpin, true);
  const kerrRetOrb = BH.kerrCircularOrbitGeom(iscoRetrogradeGeom, absSpin, false);
  const iscoCoordPeriodPro = Number.isFinite(kerrProOrb.omega) && Math.abs(kerrProOrb.omega) > 0
    ? ((2 * Math.PI) / Math.abs(kerrProOrb.omega)) * tg
    : schwIscoOrb.coordPeriod;
  const iscoCoordPeriodRet = Number.isFinite(kerrRetOrb.omega) && Math.abs(kerrRetOrb.omega) > 0
    ? ((2 * Math.PI) / Math.abs(kerrRetOrb.omega)) * tg
    : schwIscoOrb.coordPeriod;
  const iscoCoordPeriod = hasSpin ? iscoCoordPeriodPro : schwIscoOrb.coordPeriod;
  const iscoProperPeriod = schwIscoOrb.properPeriod;
  const maxInteriorFall = BH.maxInteriorFallTime(mKg);

  // Gelgit ve spagettileşme (2 m cisim)
  const tidal = BH.spaghettificationAnalysis(mKg, { bodyLengthM, limitG });
  const horizonTidalAccel = tidal.horizonTidalMs2;
  const horizonTidalG = tidal.horizonTidalG;
  const spaghettificationRadius = tidal.tidalRadius;

  // Hawking ışıması ve termodinamik
  const hawk = BH.hawkingSummary(mKg);
  const hawkingTemperature = hawk.temperature;
  const hawkingLuminosity = hawk.luminosity;
  const hawkingEvaporationSeconds = hawk.evaporationSeconds;
  const hawkingEvaporationYears = hawk.evaporationYears;
  const entropy = hawk.entropy;
  const entropyDimensionless = hawk.entropyDimensionless;
  const hawkingPeakWavelength = hawk.peakWavelength;

  // Yığılma (Eddington) ve Kütleçekim Dalgaları
  const eddingtonLuminosity = BH.eddingtonLuminosity(mKg);
  const eddingtonAccretionRate = BH.eddingtonAccretionRate(mKg, radiativeEfficiency);
  const eddingtonAccretionSolarYr = (eddingtonAccretionRate * BH.YEAR) / BH.M_SUN;
  const gwIscoFrequency = BH.gwIscoFrequency(mKg);

  const values = {
    massKg: mKg,
    massSolar: mSol,
    spin: aStar,
    distanceM: distM,
    radiusInRs: rFactor,
    rProbeM,
    gravRadius: rg,
    schwarzschildRadius: rs,
    rPlus,
    rMinus,
    rPlusGeom: kerr.rPlusGeom,
    rMinusGeom: kerr.rMinusGeom,
    ergosphereEq,
    photonSphereRadius: rPh,
    photonPrograde,
    photonRetrograde,
    iscoSchwarzschild: rIscoSchw,
    iscoPrograde,
    iscoRetrograde,
    iscoProgradeGeom,
    iscoRetrogradeGeom,
    shadowRadius: bc,
    shadowDiameter,
    shadowAngularRad,
    shadowAngularUas,
    meanDensity,
    surfaceGravity,
    surfaceGravityG: surfaceGravity / BH.G0,
    timeDilationStatic,
    timeDilationCircular,
    redshiftZ,
    redshiftOnePlusZ,
    escapeVelAtProbe,
    iscoCoordPeriod,
    iscoCoordPeriodSchwarzschild: schwIscoOrb.coordPeriod,
    iscoCoordPeriodPro,
    iscoCoordPeriodRet,
    iscoProperPeriod,
    radiativeEfficiency,
    radiativeEfficiencyRetro,
    maxInteriorFallTime: maxInteriorFall,
    horizonTidalAccel,
    horizonTidalG,
    spaghettificationRadius,
    spaghettificationRatioToRs: tidal.ratioToHorizon,
    spaghettificationOutsideHorizon: tidal.outsideHorizon,
    spaghettificationThresholdSolar: tidal.thresholdMassSolar,
    hawkingTemperature,
    hawkingLuminosity,
    hawkingEvaporationSeconds,
    hawkingEvaporationYears,
    entropy,
    entropyDimensionless,
    hawkingPeakWavelength,
    eddingtonLuminosity,
    eddingtonAccretionRate,
    eddingtonAccretionSolarYr,
    gwIscoFrequency,
    extractableFraction: kerr.extractableFraction,
    extractableEnergyJ: kerr.extractableEnergyJ,
    referenceRadii,
  };

  const secGeo = {
    id: 'geometri',
    title: 'Geometri, Yarıçaplar ve Gölge',
    rows: [
      {
        id: 'mass',
        section: 'geometri',
        label: 'Kara delik kütlesi',
        symbol: 'M',
        value: mKg,
        formatted: `${BH.formatSciTR(mKg, 3)} kg`,
        unit: 'kg',
        note: `${BH.formatSciTR(mSol, 3)} M☉ · ${BH.formatSciTR(mKg / BH.M_EARTH, 2)} M⊕`,
      },
      {
        id: 'rs',
        section: 'geometri',
        label: 'Schwarzschild yarıçapı (olay ufku)',
        symbol: 'rₛ = 2GM/c²',
        value: rs,
        formatted: formatLengthTR(rs),
        unit: 'm',
        note: `SI: ${BH.formatSciTR(rs, 3)} m · r_g = ${formatLengthTR(rg)}`,
      },
      ...(hasSpin ? [{
        id: 'kerr-horizon',
        section: 'geometri',
        label: `Kerr dış / iç olay ufku (a* = ${BH.formatNumTR(absSpin, 3)})`,
        symbol: 'r₊, r₋',
        value: rPlus,
        formatted: `r₊ = ${formatLengthTR(rPlus)} (${BH.formatNumTR(kerr.rPlusGeom, 3)} M)`,
        unit: 'm',
        note: `İç ufuk r₋ = ${formatLengthTR(rMinus)} (${BH.formatNumTR(kerr.rMinusGeom, 3)} M) · Ergosfer (ekv.) = ${formatLengthTR(ergosphereEq)}`,
      }] : []),
      {
        id: 'photon-sphere',
        section: 'geometri',
        label: 'Foton küresi yarıçapı',
        symbol: 'r_ph = 3GM/c²',
        value: rPh,
        formatted: formatLengthTR(rPh),
        unit: 'm',
        note: hasSpin
          ? `1,50 rₛ (Schwarzschild) · Kerr eşyönlü: ${BH.formatNumTR(kerr.photonProgradeGeom, 2)} M, ters: ${BH.formatNumTR(kerr.photonRetrogradeGeom, 2)} M`
          : `1,50 rₛ = 3,00 M (kararsız dairesel ışık yörüngesi)`,
      },
      {
        id: 'isco-pro',
        section: 'geometri',
        label: hasSpin ? 'ISCO — Eşyönlü (Prograde)' : 'ISCO (En içteki kararlı dairesel yörünge)',
        symbol: hasSpin ? 'r_ISCO,+' : 'r_ISCO = 6GM/c²',
        value: iscoPrograde,
        formatted: `${formatLengthTR(iscoPrograde)} (${BH.formatNumTR(iscoProgradeGeom, 3)} M)`,
        unit: 'm',
        note: hasSpin
          ? `Işınım verimi η₊ = %${BH.formatNumTR(radiativeEfficiency * 100, 2)}`
          : `3,00 rₛ · İnce disk ışınım verimi η = %${BH.formatNumTR(radiativeEfficiency * 100, 2)}`,
      },
      ...(hasSpin ? [{
        id: 'isco-retro',
        section: 'geometri',
        label: 'ISCO — Ters yönlü (Retrograde)',
        symbol: 'r_ISCO,−',
        value: iscoRetrograde,
        formatted: `${formatLengthTR(iscoRetrograde)} (${BH.formatNumTR(iscoRetrogradeGeom, 3)} M)`,
        unit: 'm',
        note: `Işınım verimi η₋ = %${BH.formatNumTR(radiativeEfficiencyRetro * 100, 2)}`,
      }] : []),
      {
        id: 'shadow-size',
        section: 'geometri',
        label: 'Kara delik gölge yarıçapı ve çapı',
        symbol: 'b_c = 3√3 M',
        value: bc,
        formatted: `b_c = ${formatLengthTR(bc)}`,
        unit: 'm',
        note: `Gölge çapı 2b_c = ${formatLengthTR(shadowDiameter)} (≈ 2,598 rₛ)`,
      },
      {
        id: 'shadow-angular',
        section: 'geometri',
        label: 'Gölge açısal çapı (seçilen uzaklıkta)',
        symbol: 'θ = 2b_c / D',
        value: shadowAngularUas,
        formatted: shadowAngularUas !== null ? formatAngleUasTR(shadowAngularUas) : '— (uzaklık girilmedi)',
        unit: 'μas',
        note: shadowAngularRad !== null
          ? `${BH.formatSciTR(shadowAngularRad, 2)} rad · D = ${BH.formatSciTR(distM, 2)} m`
          : 'Açısal gölge hesabı için yukarıdan uzaklık girin',
      },
      {
        id: 'mean-density',
        section: 'geometri',
        label: 'Olay ufku içi ortalama yoğunluk',
        symbol: 'ρ̄ = M / (⁴⁄₃π rₛ³)',
        value: meanDensity,
        formatted: `${BH.formatSciTR(meanDensity, 2)} kg/m³`,
        unit: 'kg/m³',
        note: meanDensity < 1.2 ? 'Deniz seviyesindeki havadan bile seyrek!' : meanDensity < 1000 ? 'Sıvı sudan (1000 kg/m³) daha seyrek' : `Suyun ${BH.formatSciTR(meanDensity / 1000, 2)} katı`,
      },
      {
        id: 'surface-gravity',
        section: 'geometri',
        label: 'Yüzey kütleçekimi',
        symbol: 'κ = c⁴ / (4GM)',
        value: surfaceGravity,
        formatted: `${BH.formatSciTR(surfaceGravity, 2)} m/s²`,
        unit: 'm/s²',
        note: `${BH.formatSciTR(surfaceGravity / BH.G0, 2)} g₀`,
      },
    ],
  };

  const secTime = {
    id: 'saatler',
    title: `Saatler, Kırmızıya Kayma (r = ${BH.formatNumTR(rFactor, 2)} rₛ) ve Yörünge`,
    rows: [
      {
        id: 'time-dilation',
        section: 'saatler',
        label: `Statik zaman genişlemesi (r = ${BH.formatNumTR(rFactor, 2)} rₛ)`,
        symbol: 'dτ / dt',
        value: timeDilationStatic,
        formatted: BH.formatNumTR(timeDilationStatic, 5),
        unit: 'boyutsuz',
        note: Number.isFinite(timeDilationCircular)
          ? `Dairesel yörüngede dτ/dt = ${BH.formatNumTR(timeDilationCircular, 5)} · v_kaç = ${BH.formatNumTR(escapeVelAtProbe / BH.C, 3)} c`
          : `Foton küresi içinde (r ≤ 1,5 rₛ) serbest dairesel yörünge yok · v_kaç = ${BH.formatNumTR(escapeVelAtProbe / BH.C, 3)} c`,
      },
      {
        id: 'redshift',
        section: 'saatler',
        label: `Kütleçekimsel kırmızıya kayma (r = ${BH.formatNumTR(rFactor, 2)} rₛ)`,
        symbol: 'z = (1 − rₛ/r)⁻¹ᐟ² − 1',
        value: redshiftZ,
        formatted: `z = ${BH.formatSciTR(redshiftZ, 3)}`,
        unit: 'boyutsuz',
        note: `1 + z = ${BH.formatSciTR(redshiftOnePlusZ, 3)} · Hα (656,3 nm) → ${BH.formatSciTR(656.3 * redshiftOnePlusZ, 3)} nm`,
      },
      {
        id: 'isco-period',
        section: 'saatler',
        label: hasSpin ? 'ISCO yörünge periyodu (eşyönlü Kerr)' : 'ISCO yörünge periyodu',
        symbol: 'T_ISCO',
        value: iscoCoordPeriod,
        formatted: formatDurationTR(iscoCoordPeriod),
        unit: 's',
        note: hasSpin
          ? `Ters yönlü: ${formatDurationTR(iscoCoordPeriodRet)} · Schwarzschild: ${formatDurationTR(schwIscoOrb.coordPeriod)}`
          : `Öz periyot T_öz = ${formatDurationTR(iscoProperPeriod)} (T_koord / √2) · f_yör = ${formatFreqTR(1 / iscoCoordPeriod)}`,
      },
      {
        id: 'interior-fall',
        section: 'saatler',
        label: 'Ufuktan tekilliğe azami öz süre',
        symbol: 'τ_maks = πGM/c³',
        value: maxInteriorFall,
        formatted: formatDurationTR(maxInteriorFall),
        unit: 's',
        note: 'Olay ufkunu geçtikten sonra tekilliğe ulaşana dek yaşanabilecek en uzun öz zaman',
      },
    ],
  };

  const secTidal = {
    id: 'gelgit',
    title: `Gelgit Kuvveti ve Spagettileşme (L = ${BH.formatNumTR(bodyLengthM, 1)} m cisim)`,
    rows: [
      {
        id: 'tidal-horizon',
        section: 'gelgit',
        label: 'Olay ufkunda radyal gelgit ivmesi (L = 2 m)',
        symbol: 'Δa(rₛ) = 2GML / rₛ³',
        value: horizonTidalAccel,
        formatted: `${BH.formatSciTR(horizonTidalAccel, 2)} m/s²`,
        unit: 'm/s²',
        note: `${BH.formatSciTR(horizonTidalG, 2)} g₀ · ${tidal.outsideHorizon ? '▲ Ufuk dışında ölümcül spagettileşme' : '✓ Olay ufkunu sağlam geçebilir'}`,
      },
      {
        id: 'spaghetti-radius',
        section: 'gelgit',
        label: `Spagettileşme yarıçapı (${limitG} g₀ sınırı)`,
        symbol: 'r_gelgit',
        value: spaghettificationRadius,
        formatted: formatLengthTR(spaghettificationRadius),
        unit: 'm',
        note: `${BH.formatSciTR(tidal.ratioToHorizon, 2)} rₛ (${tidal.outsideHorizon ? 'ufkun dışında' : 'ufkun içinde'}) · Sağlam geçiş eşiği: ${BH.formatSciTR(tidal.thresholdMassSolar, 2)} M☉`,
      },
    ],
  };

  const secHawk = {
    id: 'hawking',
    title: 'Hawking Işıması ve Kara Delik Termodinamiği',
    rows: [
      {
        id: 'hawking-temp',
        section: 'hawking',
        label: 'Hawking sıcaklığı',
        symbol: 'T_H = ħc³ / (8πGMk_B)',
        value: hawkingTemperature,
        formatted: `${BH.formatSciTR(hawkingTemperature, 3)} K`,
        unit: 'K',
        note: hawkingTemperature < 2.725
          ? 'CMB\'den (2,725 K) soğuk → bugün net enerji soğurur'
          : 'CMB\'den sıcak → bugün net kütle kaybeder',
      },
      {
        id: 'hawking-lum',
        section: 'hawking',
        label: 'Hawking ışıma gücü',
        symbol: 'P_H = ħc⁶ / (15360πG²M²)',
        value: hawkingLuminosity,
        formatted: `${BH.formatSciTR(hawkingLuminosity, 2)} W`,
        unit: 'W',
        note: `Wien tepe dalga boyu λ_tepe ≈ ${formatLengthTR(hawkingPeakWavelength)} (${BH.classifySpectralBand(hawkingPeakWavelength)})`,
      },
      {
        id: 'hawking-evap',
        section: 'hawking',
        label: 'Hawking buharlaşma süresi (yalıtılmış)',
        symbol: 't_buh = 5120πG²M³ / (ħc⁴)',
        value: hawkingEvaporationSeconds,
        formatted: formatDurationTR(hawkingEvaporationSeconds),
        unit: 's',
        note: `SI: ${BH.formatSciTR(hawkingEvaporationSeconds, 2)} s · Evren yaşının ${BH.formatSciTR(hawkingEvaporationSeconds / BH.AGE_OF_UNIVERSE, 2)} katı`,
      },
      {
        id: 'entropy',
        section: 'hawking',
        label: 'Bekenstein–Hawking entropisi',
        symbol: 'S = 4πGM²k_B / (ħc)',
        value: entropy,
        formatted: `${BH.formatSciTR(entropy, 2)} J/K`,
        unit: 'J/K',
        note: `Boyutsuz S / k_B = ${BH.formatSciTR(entropyDimensionless, 2)}`,
      },
    ],
  };

  const secAstro = {
    id: 'astro',
    title: 'Yığılma, Dönme Enerjisi ve Kütleçekim Dalgaları',
    rows: [
      {
        id: 'eddington',
        section: 'astro',
        label: 'Eddington parlaklığı',
        symbol: 'L_Edd = 4πGMm_p c / σ_T',
        value: eddingtonLuminosity,
        formatted: `${BH.formatSciTR(eddingtonLuminosity, 2)} W`,
        unit: 'W',
        note: `Ṁ_Edd (η = %${BH.formatNumTR(radiativeEfficiency * 100, 1)}) = ${BH.formatSciTR(eddingtonAccretionSolarYr, 2)} M☉/yıl`,
      },
      {
        id: 'gw-fisco',
        section: 'astro',
        label: 'Kütleçekim dalgası ISCO frekansı (toplam kütle M)',
        symbol: 'f_ISCO = c³ / (6³ᐟ²πGM)',
        value: gwIscoFrequency,
        formatted: formatFreqTR(gwIscoFrequency),
        unit: 'Hz',
        note: `SI: ${BH.formatSciTR(gwIscoFrequency, 3)} Hz (eşit/toplam kütle M ikili birleşmesi için)`,
      },
      ...(hasSpin ? [{
        id: 'kerr-rot-energy',
        section: 'astro',
        label: 'Çıkarılabilir dönme enerjisi (Penrose sınırı)',
        symbol: '(M − M_irr) c²',
        value: kerr.extractableEnergyJ,
        formatted: `${BH.formatSciTR(kerr.extractableEnergyJ, 2)} J (%${BH.formatNumTR(kerr.extractableFraction * 100, 2)})`,
        unit: 'J',
        note: `İndirgenemez kütle M_irr = ${BH.formatSciTR(BH.kgToSolarMass(kerr.irreducibleMassKg), 3)} M☉`,
      }] : []),
    ],
  };

  const sections = [secGeo, secTime, secTidal, secHawk, secAstro];
  const rows = sections.flatMap(s => s.rows);

  return {
    valid: true,
    error: null,
    inputs: {
      label: label || `${BH.formatSciTR(mSol, 2)} M☉`,
      massKg: mKg,
      massSolar: mSol,
      spin: aStar,
      distanceM: distM,
      radiusInRs: rFactor,
      bodyLengthM,
      limitG,
    },
    values,
    sections,
    rows,
  };
}

/** Hesaplayıcı tablosunu kopyalamaya uygun sade Türkçe düz metne biçimlendirir. */
export function formatBlackHoleTableAsText(table) {
  if (!table || !table.valid) return '';
  const lines = [
    `MathPad Kara Delik Hesaplayıcısı — ${table.inputs.label}`,
    `Kütle: ${BH.formatSciTR(table.inputs.massKg, 3)} kg (${BH.formatSciTR(table.inputs.massSolar, 3)} M☉) | Spin a*: ${BH.formatNumTR(table.inputs.spin, 3)} | Sondaj yarıçapı: ${BH.formatNumTR(table.inputs.radiusInRs, 2)} rₛ`,
    '',
  ];
  for (const sec of table.sections) {
    lines.push(`=== ${sec.title} ===`);
    for (const r of sec.rows) {
      lines.push(`- ${r.label} (${r.symbol}): ${r.formatted}${r.note ? `  [${r.note}]` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

// =====================================================================
// 5. KONU ANLATIMI İLERLEME YARDIMCILARI (SAF)
// =====================================================================

/** Okunan ders id listesinde ilgili dersi ekler veya çıkarır (saf). */
export function toggleLessonProgress(readIds, lessonId) {
  const set = new Set(Array.isArray(readIds) ? readIds.filter(Boolean) : []);
  if (set.has(lessonId)) set.delete(lessonId);
  else if (lessonId) set.add(lessonId);
  return [...set];
}

/** Ders ilerleme özetini hesaplar (yalnızca geçerli ders id'leri sayılır). */
export function computeLessonProgress(readIds, lessons = BH_LESSONS) {
  const validIds = new Set(lessons.map(l => l.id));
  const doneSet = new Set((Array.isArray(readIds) ? readIds : []).filter(id => validIds.has(id)));
  const total = lessons.length;
  const done = doneSet.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, doneIds: [...doneSet] };
}

// =====================================================================
// 6. ALIŞTIRMALAR PUANLAMA, BİRİM VE SORU SEÇİMİ YARDIMCILARI (SAF)
// =====================================================================

/** BH_EXERCISES içindeki benzersiz konu listesini sırayla döndürür. */
export function getExerciseTopics(templates = BH.BH_EXERCISES) {
  const out = [];
  for (const t of templates) {
    if (t?.topic && !out.includes(t.topic)) out.push(t.topic);
  }
  return out;
}

/** Alıştırma şıkkının soru metninden (veya part.unit alanından) girdi birimini çıkarır. */
export function extractPartUnit(part) {
  if (!part) return '';
  if (typeof part.unit === 'string' && part.unit.trim()) return part.unit.trim();
  const type = part.answer?.type;
  if (type === 'yesno' || type === 'choice') return '';
  const p = String(part.prompt ?? '');

  // Ölçekli bilimsel birimler (önce özel bileşik kalıplar)
  if (/10\^\{-25\}/.test(p)) return '10⁻²⁵ m';
  if (/10\^\{-21\}/.test(p)) return '10⁻²¹';
  if (/10\^\{67\}/.test(p)) return '10⁶⁷ yıl';
  if (/10\^\{31\}/.test(p)) return '10³¹ W';
  if (/10\^\{11\}[^a-zA-Z]*\\text\{kg\}/.test(p)) return '10¹¹ kg';
  if (/10\^\{11\}[^a-zA-Z]*\\text\{K\}/.test(p)) return '10¹¹ K';
  if (/milyar\s+Güneş\s+kütlesi|10\^9\\,M_\\odot/.test(p)) return '10⁹ M☉';
  if (/10\^8\\,M_\\odot/.test(p)) return '10⁸ M☉';
  if (/milyon\s+kilometre|10\^6\\,\\text\{km\}/.test(p)) return '10⁶ km';
  if (/milyon\s+kelvin|10\^6\\,\\text\{K\}/.test(p)) return '10⁶ K';
  if (/M_\\odot\s*c\^2/.test(p)) return 'M☉ c²';
  if (/M_\\odot\s*\/\s*\\text\{yıl\}|yılda\s+kaç\s+\*\*Güneş\s+kütlesi\*\*/.test(p)) return 'M☉/yıl';
  if (/\\text\{rad\/s\}/.test(p)) return 'rad/s';
  if (/\\text\{m\/s\}\^2/.test(p)) return 'm/s²';
  if (/g_0/.test(p)) return 'g₀';
  if (/mikroyay\s+saniyesi|\\mu\\text\{as\}/.test(p)) return 'μas';
  if (/miliyay\s+saniyesi|\\text\{mas\}/.test(p)) return 'mas';
  if (/yay\s+saniyesi|arcsec/.test(p)) return 'arcsec';
  if (/nanokelvin|\\text\{nK\}/.test(p)) return 'nK';
  if (/nanometre|\\text\{nm\}|\*\*nm\*\*/.test(p)) return 'nm';
  if (/milimetre|\\text\{mm\}/.test(p)) return 'mm';
  if (/kilometre|\\text\{km\}/.test(p)) return 'km';
  if (/milisaniye|\\text\{ms\}/.test(p)) return 'ms';
  if (/saniye/.test(p)) return 's';
  if (/dakika/.test(p)) return 'dk';
  if (/saat/.test(p)) return 'saat';
  if (/Hz/.test(p)) return 'Hz';
  if (/derece/.test(p)) return '°';
  if (/yüzde|\*\*%\*\*/.test(p)) return '%';
  if (/Güneş\s+kütlesi|M_\\odot/.test(p)) return 'M☉';
  if (/r\s*\/\s*r_s|r_s['’]?nin\s+kaç\s+katı/.test(p)) return 'rₛ';
  if (/\/\s*M\b/.test(p)) return 'M';
  return 'boyutsuz';
}

const LEVEL_POINTS = Object.freeze({ isinma: 10, odev: 15, zorlayici: 25 });

/** Boş alıştırma istatistik nesnesi üretir. */
export function createDefaultExerciseStats() {
  return {
    solved: 0,
    attempts: 0,
    points: 0,
    streak: 0,
    bestStreak: 0,
    byLevel: { isinma: 0, odev: 0, zorlayici: 0 },
    byTopic: {},
  };
}

/** Tek bir alıştırma şıkkının puanını hesaplar (saf). */
export function scoreExercisePart({ ok, hintsShown = 0, revealedBeforeSolve = false, level = 'odev' } = {}) {
  if (!ok || revealedBeforeSolve) return 0;
  const base = LEVEL_POINTS[level] ?? 15;
  const h = clamp(Math.trunc(Number(hintsShown) || 0), 0, 3);
  const floor = Math.ceil(base * 0.4);
  return Math.max(floor, base - h * 2);
}

/** Bir denemeyi mevcut istatistiklere işleyip yeni istatistik nesnesi döndürür (saf). */
export function applyExerciseAttempt(stats, {
  ok = false,
  hintsShown = 0,
  revealedBeforeSolve = false,
  level = 'odev',
  topic = '',
  alreadyScored = false,
} = {}) {
  const prev = stats || createDefaultExerciseStats();
  const next = {
    solved: Number(prev.solved) || 0,
    attempts: Number(prev.attempts) || 0,
    points: Number(prev.points) || 0,
    streak: Number(prev.streak) || 0,
    bestStreak: Number(prev.bestStreak) || 0,
    byLevel: {
      isinma: Number(prev.byLevel?.isinma) || 0,
      odev: Number(prev.byLevel?.odev) || 0,
      zorlayici: Number(prev.byLevel?.zorlayici) || 0,
    },
    byTopic: { ...(prev.byTopic || {}) },
  };
  if (alreadyScored) return { stats: next, earned: 0 };

  next.attempts += 1;
  if (ok && !revealedBeforeSolve) {
    const earned = scoreExercisePart({ ok: true, hintsShown, revealedBeforeSolve: false, level });
    next.solved += 1;
    next.points += earned;
    next.streak += 1;
    if (next.streak > next.bestStreak) next.bestStreak = next.streak;
    if (level in next.byLevel) next.byLevel[level] += 1;
    if (topic) next.byTopic[topic] = (Number(next.byTopic[topic]) || 0) + 1;
    return { stats: next, earned };
  }

  next.streak = 0;
  return { stats: next, earned: 0 };
}

/** Verilen seviye, konu ve tohumla BH_EXERCISES içinden deterministik yeni soru üretir. */
export function pickNextExercise({
  templates = BH.BH_EXERCISES,
  level = 'isinma',
  topic = '',
  seed = 1,
  avoidTemplateId = null,
} = {}) {
  const safeLevel = LEVELS.some(l => l.id === level) ? level : 'isinma';
  let pool = templates.filter(t => Array.isArray(t.levels) && t.levels.includes(safeLevel));
  if (topic) {
    const filtered = pool.filter(t => t.topic === topic);
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) pool = templates;
  const nonRepeat = avoidTemplateId && pool.length > 1
    ? pool.filter(t => t.id !== avoidTemplateId)
    : pool;
  const rng = makeRng(seed);
  const tpl = rng.pick(nonRepeat);
  const problem = tpl.generate(rng, safeLevel);
  return {
    templateId: tpl.id,
    topic: tpl.topic,
    level: safeLevel,
    seed,
    problem,
  };
}

// =====================================================================
// 7. KATALOG SIRALAMA, ÖLÇEK GRUPLARI VE GEZİNME PARAMETRELERİ (SAF)
// =====================================================================

export const CATALOG_SORTS = Object.freeze([
  Object.freeze({ id: 'mass-desc', label: 'Kütle (büyük → küçük)' }),
  Object.freeze({ id: 'mass-asc', label: 'Kütle (küçük → büyük)' }),
  Object.freeze({ id: 'dist-asc', label: 'Uzaklık (yakın → uzak)' }),
  Object.freeze({ id: 'year-desc', label: 'Keşif yılı (yeni → eski)' }),
  Object.freeze({ id: 'year-asc', label: 'Keşif yılı (eski → yeni)' }),
  Object.freeze({ id: 'spin-desc', label: 'Spin a* (yüksek → düşük)' }),
]);

export const CATALOG_TYPE_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'Tümü' }),
  Object.freeze({ id: 'stellar', label: 'Yıldızsal' }),
  Object.freeze({ id: 'intermediate', label: 'Orta Kütleli' }),
  Object.freeze({ id: 'supermassive', label: 'Süperkütleli' }),
]);

/** Katalog öğesini js/bh-core.js fiziksel büyüklükleriyle zenginleştirir. */
export function enrichCatalogEntry(entry) {
  const massKg = BH.solarMassToKg(entry.massSolar);
  const rsMeters = BH.schwarzschildRadius(massKg);
  const rsKm = BH.mToKm(rsMeters);
  const distM = entry.distancePc > 0 ? BH.pcToM(entry.distancePc) : null;
  const shadowAngularUas = distM ? BH.radToUas(BH.shadowAngularDiameter(massKg, distM)) : null;
  const iscoGeom = BH.kerrIscoGeom(entry.spin ?? 0, true);
  return {
    ...entry,
    massKg,
    rsMeters,
    rsKm,
    shadowAngularUas,
    iscoGeom,
  };
}

/** Katalog öğelerini türe göre filtreler ve seçilen ölçüte göre sıralar. */
export function sortAndFilterCatalog(catalog = BH.BH_CATALOG, { sortBy = 'mass-desc', typeFilter = 'all' } = {}) {
  const enriched = catalog.map(enrichCatalogEntry);
  const filtered = typeFilter && typeFilter !== 'all'
    ? enriched.filter(o => o.type === typeFilter)
    : enriched;

  const cmp = {
    'mass-desc': (a, b) => b.massSolar - a.massSolar,
    'mass-asc': (a, b) => a.massSolar - b.massSolar,
    'dist-asc': (a, b) => a.distancePc - b.distancePc,
    'year-desc': (a, b) => b.discoveryYear - a.discoveryYear || b.massSolar - a.massSolar,
    'year-asc': (a, b) => a.discoveryYear - b.discoveryYear || b.massSolar - a.massSolar,
    'spin-desc': (a, b) => {
      const sa = a.spin ?? -1;
      const sb = b.spin ?? -1;
      return sb - sa || b.massSolar - a.massSolar;
    },
  }[sortBy] || ((a, b) => b.massSolar - a.massSolar);

  return filtered.slice().sort(cmp);
}

/**
 * Gerçek kara delikleri r_s büyüklüğüne göre logaritmik gruplara ayırır;
 * her grup içinde r_s doğrusal olarak ölçekli (ratio = rs / groupMaxRs) çizilir.
 */
export function buildSizeComparisonGroups(catalog = BH.BH_CATALOG) {
  const items = catalog.map(enrichCatalogEntry).sort((a, b) => a.rsMeters - b.rsMeters);
  const defs = [
    {
      id: 'stellar-imbh',
      title: 'Yıldızsal ve Orta Kütleli Ölçek',
      rangeLabel: 'rₛ ≈ 10¹–10³ km',
      scaleNote: 'Grup içi doğrusal ölçek · Referans: 100 km (yaklaşık büyükşehir çapı)',
      refLabel: '100 km',
      refMeters: 1e5,
      match: o => o.rsKm < 1e4,
    },
    {
      id: 'galactic-core',
      title: 'Galaksi Merkezi Ölçeği',
      rangeLabel: 'rₛ ≈ 10⁷ km (×10⁵ büyük)',
      scaleNote: 'Grup içi doğrusal ölçek · Referans: Güneş yarıçapı (6,96 × 10⁵ km) ve Merkür yörüngesi',
      refLabel: 'Güneş çapı (1,39 × 10⁶ km)',
      refMeters: 2 * BH.R_SUN,
      match: o => o.rsKm >= 1e4 && o.rsKm < 1e9,
    },
    {
      id: 'ultramassive',
      title: 'Dev Galaksi ve Kuasar Ölçeği',
      rangeLabel: 'rₛ ≈ 10¹⁰–10¹¹ km (×10⁴ daha büyük)',
      scaleNote: 'Grup içi doğrusal ölçek · Referans: Neptün yörüngesi (30 AU ≈ 4,5 × 10⁹ km)',
      refLabel: 'Neptün yörüngesi (30 AU)',
      refMeters: 30 * BH.AU,
      match: o => o.rsKm >= 1e9,
    },
  ];

  return defs.map(def => {
    const members = items.filter(def.match);
    const maxRs = members.reduce((m, x) => Math.max(m, x.rsMeters), def.refMeters);
    return {
      id: def.id,
      title: def.title,
      rangeLabel: def.rangeLabel,
      scaleNote: def.scaleNote,
      refLabel: def.refLabel,
      refMeters: def.refMeters,
      refRatio: maxRs > 0 ? def.refMeters / maxRs : 0,
      maxRsMeters: maxRs,
      items: members.map(o => ({
        ...o,
        scaleRatio: maxRs > 0 ? o.rsMeters / maxRs : 0,
      })),
    };
  }).filter(g => g.items.length > 0);
}

/** Katalog kartındaki 'Gözlemevi'nde aç' düğmesinin ctx.go('gozlemevi', params) parametrelerini üretir. */
export function catalogObservatoryParams(entry) {
  if (!entry || !entry.id) return {};
  return { preset: entry.id };
}

/** Katalog kartındaki 'Hesapla' düğmesinin ctx.go('hesaplayici', params) parametrelerini üretir. */
export function catalogCalculatorParams(entry) {
  if (!entry) return {};
  const params = {
    mass: entry.massSolar,
    unit: 'solar',
  };
  if (Number.isFinite(entry.distancePc) && entry.distancePc > 0) {
    params.distancePc = entry.distancePc;
  }
  if (entry.spin !== null && entry.spin !== undefined && Number.isFinite(entry.spin)) {
    params.spin = entry.spin;
  }
  if (entry.id) params.object = entry.id;
  return params;
}

// =====================================================================
// 8. LOCALSTORAGE YARDIMCILARI (mp.bh. ÖN EKLİ)
// =====================================================================

function loadJson(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch { }
}

async function copyText(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { }
  try {
    if (typeof document !== 'undefined' && document.body) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand?.('copy');
      ta.remove();
      return !!ok;
    }
  } catch { }
  return false;
}

// =====================================================================
// 9. SEKME 1: GÖZLEMEVİ
// =====================================================================

function mountObservatoryTab(host, ctx) {
  const opts = buildObservatoryOpts(ctx?.params);
  const stop = mountObservatory(host, opts);
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    try { stop?.(); } catch { }
  };
}

// =====================================================================
// 10. SEKME 2: SİMÜLASYONLAR
// =====================================================================

function mountSimulationsTab(host, ctx) {
  const clean = createClean(ctx);
  let activeSim = findSimById(ctx?.params?.sim);
  let activeCleanup = null;

  function unmountActiveSim() {
    if (activeCleanup) {
      const fn = activeCleanup;
      activeCleanup = null;
      try { fn(); } catch { }
    }
  }

  function renderGallery() {
    unmountActiveSim();
    activeSim = null;
    host.innerHTML = `<div class="bh-center-wrap">
      <div class="bh-sim-banner">
        <div>
          <h2 class="bh-section-h">Etkileşimli Genel Görelilik Simülasyonları</h2>
          <p class="bh-section-sub">Her simülasyon gerçek Schwarzschild ve Kerr denklemlerini canlı çözer. Bir kart seçerek burada açabilirsin.</p>
        </div>
        <span class="bh-count-pill">${SIMS.length} simülasyon</span>
      </div>

      <div class="bh-sim-grid" role="list" aria-label="Kara delik simülasyonları">
        ${SIMS.map((s, idx) => `<button type="button" class="bh-sim-card" data-bh-open-sim="${esc(s.id)}" role="listitem" aria-label="${esc(s.title)} simülasyonunu aç">
          <div class="bh-sim-card-top">
            <span class="bh-sim-ic" aria-hidden="true">${icon(s.icon)}</span>
            <span class="bh-sim-idx">${String(idx + 1).padStart(2, '0')}</span>
          </div>
          <h3 class="bh-sim-card-title">${esc(s.title)}</h3>
          <p class="bh-sim-card-desc">${esc(s.desc)}</p>
          <span class="bh-sim-card-go">Simülasyonu aç →</span>
        </button>`).join('')}
      </div>
    </div>`;
  }

  function openSim(sim) {
    if (!sim) { renderGallery(); return; }
    unmountActiveSim();
    activeSim = sim;

    host.innerHTML = `<div class="bh-center-wrap">
      <div class="bh-sim-bar">
        <button type="button" class="btn small bh-back-btn" data-bh-sim-back aria-label="Simülasyon listesine dön">
          ${icon('back')}<span>Simülasyonlara dön</span>
        </button>
        <div class="bh-sim-active-meta">
          <span class="bh-sim-ic bh-sim-ic-sm" aria-hidden="true">${icon(sim.icon)}</span>
          <strong class="bh-sim-active-title">${esc(sim.title)}</strong>
        </div>
      </div>

      <div class="bh-sim-switcher" role="navigation" aria-label="Diğer kara delik simülasyonları">
        ${SIMS.map(s => `<button type="button" class="bh-sim-pill ${s.id === sim.id ? 'bh-on' : ''}" data-bh-open-sim="${esc(s.id)}" aria-pressed="${s.id === sim.id ? 'true' : 'false'}">
          ${icon(s.icon)}<span>${esc(s.title)}</span>
        </button>`).join('')}
      </div>

      <div class="bh-sim-stage" data-bh-sim-host></div>
    </div>`;

    const simHost = host.querySelector('[data-bh-sim-host]');
    const fns = [];
    const simCtx = { clean: { add(fn) { if (typeof fn === 'function') fns.push(fn); } } };
    try {
      const ret = sim.mount(simHost, simCtx);
      if (typeof ret === 'function') fns.push(ret);
    } catch (err) {
      if (simHost) {
        simHost.innerHTML = `<div class="bh-err-box" role="alert">Simülasyon yüklenemedi: ${esc(err?.message || String(err))}</div>`;
      }
    }
    activeCleanup = () => {
      while (fns.length) {
        try { fns.pop()(); } catch { }
      }
    };
  }

  const onClick = e => {
    if (e.target.closest?.('[data-bh-sim-back]')) {
      renderGallery();
      return;
    }
    const openBtn = e.target.closest?.('[data-bh-open-sim]');
    if (openBtn) {
      const target = findSimById(openBtn.dataset.bhOpenSim);
      if (target && target.id !== activeSim?.id) {
        openSim(target);
      }
    }
  };

  host.addEventListener('click', onClick);
  clean.add(() => {
    host.removeEventListener('click', onClick);
    unmountActiveSim();
    host.innerHTML = '';
  });

  if (activeSim) openSim(activeSim);
  else renderGallery();

  return clean.run;
}

// =====================================================================
// 11. SEKME 3: HESAPLAYICI
// =====================================================================

let _calcSeq = 0;

function mountCalculatorTab(host, ctx) {
  const clean = createClean(ctx);
  const inst = ++_calcSeq;
  const fid = k => `bh-calc-${k}-${inst}`;

  const state = resolveCalculatorParams(ctx?.params);
  let lastTable = null;

  host.innerHTML = `<div class="bh-center-wrap">
    <section class="bh-panel bh-calc-controls" aria-label="Kara delik hesaplayıcı girdileri">
      <div class="bh-panel-head">
        <h2 class="bh-panel-title">Nesne Seçimi ve Parametreler</h2>
        <div class="bh-calc-head-acts">
          <button type="button" class="btn small ghost bh-obs-jump-btn" data-bh-calc-obs aria-label="Bu kara deliği Gözlemevi'nde aç">
            ${icon('sparkle')}<span>Gözlemevi'nde gör</span>
          </button>
          <button type="button" class="btn small primary bh-copy-btn" data-bh-calc-copy aria-label="Hesaplama tablosunu metin olarak kopyala">
            ${icon('edit')}<span>Metin olarak kopyala</span>
          </button>
        </div>
      </div>

      <div class="bh-calc-presets" role="group" aria-label="Hazır gök cismi ve nesne önayarları">
        ${CALC_PRESETS.map(p => `<button type="button" class="bh-preset-btn ${state.presetId === p.id ? 'bh-on' : ''}" data-bh-cp="${esc(p.id)}" aria-pressed="${state.presetId === p.id ? 'true' : 'false'}">
          <span class="bh-preset-dot" aria-hidden="true"></span><span>${esc(p.label)}</span>
        </button>`).join('')}
        <button type="button" class="bh-preset-btn ${state.presetId === 'custom' ? 'bh-on' : ''}" data-bh-cp="custom" aria-pressed="${state.presetId === 'custom' ? 'true' : 'false'}">
          <span class="bh-preset-dot" aria-hidden="true"></span><span>Özel değer</span>
        </button>
      </div>

      <div class="bh-calc-form">
        <div class="bh-field">
          <label class="bh-field-lbl" for="${fid('mass')}">Kütle (M)</label>
          <div class="bh-input-pair">
            <input id="${fid('mass')}" class="inp mono bh-inp-grow" type="text" inputmode="decimal" value="${esc(state.massValue)}" placeholder="örn. 4.15e6 veya 70" data-bh-in="mass" aria-label="Kara delik kütlesi sayısal değeri">
            <select id="${fid('munit')}" class="inp bh-unit-sel" data-bh-in="massUnit" aria-label="Kütle birimi">
              ${MASS_UNITS.map(u => `<option value="${esc(u.id)}" ${state.massUnit === u.id ? 'selected' : ''}>${esc(u.short)}</option>`).join('')}
            </select>
          </div>
          <span class="bh-field-hint">Bilimsel gösterim desteklenir (örn. 6,5e9 veya 5.97e24).</span>
        </div>

        <div class="bh-field">
          <label class="bh-field-lbl" for="${fid('dist')}">Uzaklık D <span class="mute">(isteğe bağlı — açısal gölge için)</span></label>
          <div class="bh-input-pair">
            <input id="${fid('dist')}" class="inp mono bh-inp-grow" type="text" inputmode="decimal" value="${esc(state.distanceValue)}" placeholder="Boş bırakılabilir" data-bh-in="dist" aria-label="Gözlemci uzaklığı sayısal değeri">
            <select id="${fid('dunit')}" class="inp bh-unit-sel" data-bh-in="distUnit" aria-label="Uzaklık birimi">
              ${DIST_UNITS.map(u => `<option value="${esc(u.id)}" ${state.distanceUnit === u.id ? 'selected' : ''}>${esc(u.short)}</option>`).join('')}
            </select>
          </div>
          <span class="bh-field-hint">Uzaklık girildiğinde EHT gölge açısal çapı (θ = 2b_c/D) hesaplanır.</span>
        </div>

        <div class="bh-field">
          <div class="bh-slider-top">
            <label class="bh-field-lbl" for="${fid('spin')}">Boyutsuz Kerr spini (a* = a/M)</label>
            <span class="bh-slider-val" data-bh-calc-spin-val>${BH.formatNumTR(state.spin, 3)}</span>
          </div>
          <input id="${fid('spin')}" class="bh-range" type="range" min="0" max="0.998" step="0.002" value="${Math.abs(state.spin)}" data-bh-in="spin" aria-label="Boyutsuz Kerr dönme spini a yıldız">
          <span class="bh-field-hint">a* = 0: Schwarzschild · a* = 0,998: Thorne sınırı (eşyönlü ve ters yönlü ISCO ayrılır).</span>
        </div>

        <div class="bh-field">
          <div class="bh-slider-top">
            <label class="bh-field-lbl" for="${fid('rad')}">Saat &amp; kırmızıya kayma yarıçapı (r / rₛ)</label>
            <span class="bh-slider-val" data-bh-calc-rad-val>${BH.formatNumTR(state.radiusInRs, 2)} rₛ</span>
          </div>
          <input id="${fid('rad')}" class="bh-range" type="range" min="0" max="1" step="0.002" value="${rsToRadiusSlider(state.radiusInRs).toFixed(4)}" data-bh-in="rad" aria-label="Zaman genişlemesi ve kırmızıya kayma için r bölü r_s yarıçapı">
          <div class="bh-rad-chips" role="group" aria-label="Hızlı yarıçap seçimleri">
            ${[1.02, 1.5, 2, 3, 10, 50].map(k => `<button type="button" class="bh-mini-chip" data-bh-rad-set="${k}">${BH.formatNumTR(k, k < 2 ? 2 : 0)} rₛ${k === 1.5 ? ' (foton)' : k === 3 ? ' (ISCO)' : ''}</button>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <div class="bh-calc-out" data-bh-calc-out aria-live="polite"></div>
  </div>`;

  const massEl = host.querySelector('[data-bh-in="mass"]');
  const mUnitEl = host.querySelector('[data-bh-in="massUnit"]');
  const distEl = host.querySelector('[data-bh-in="dist"]');
  const dUnitEl = host.querySelector('[data-bh-in="distUnit"]');
  const spinEl = host.querySelector('[data-bh-in="spin"]');
  const spinValEl = host.querySelector('[data-bh-calc-spin-val]');
  const radEl = host.querySelector('[data-bh-in="rad"]');
  const radValEl = host.querySelector('[data-bh-calc-rad-val]');
  const outEl = host.querySelector('[data-bh-calc-out]');

  function syncPresetButtons() {
    host.querySelectorAll('[data-bh-cp]').forEach(btn => {
      const on = btn.dataset.bhCp === state.presetId;
      btn.classList.toggle('bh-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderOutput() {
    const massKg = convertMassToKg(state.massValue, state.massUnit);
    const distanceM = convertDistanceToMeters(state.distanceValue, state.distanceUnit);
    const tbl = buildBlackHoleTable({
      massKg,
      spin: state.spin,
      distanceM,
      radiusInRs: state.radiusInRs,
      label: state.objectLabel,
    });
    lastTable = tbl;

    if (!outEl) return;
    if (!tbl.valid) {
      outEl.innerHTML = `<div class="bh-err-box" role="alert">${esc(tbl.error)}</div>`;
      return;
    }

    const v = tbl.values;
    outEl.innerHTML = `<div class="bh-calc-results">
      <div class="bh-calc-kpis" aria-label="Öne çıkan kara delik ölçümleri">
        <div class="bh-readout bh-readout-acc">
          <span class="bh-readout-lbl">Schwarzschild yarıçapı (rₛ)</span>
          <span class="bh-readout-val">${esc(formatLengthTR(v.schwarzschildRadius))}</span>
          <span class="bh-readout-sub">b_c = ${esc(formatLengthTR(v.shadowRadius))}</span>
        </div>
        <div class="bh-readout">
          <span class="bh-readout-lbl">ISCO (${Math.abs(v.spin) > 1e-6 ? 'eşyönlü' : 'Schwarzschild'})</span>
          <span class="bh-readout-val">${esc(BH.formatNumTR(v.iscoProgradeGeom, 2))} M</span>
          <span class="bh-readout-sub">${esc(formatLengthTR(v.iscoPrograde))} · T = ${esc(formatDurationTR(v.iscoCoordPeriod))}</span>
        </div>
        <div class="bh-readout">
          <span class="bh-readout-lbl">Hawking sıcaklığı (T_H)</span>
          <span class="bh-readout-val">${esc(BH.formatSciTR(v.hawkingTemperature, 2))} K</span>
          <span class="bh-readout-sub">t_buh = ${esc(formatDurationTR(v.hawkingEvaporationSeconds))}</span>
        </div>
        <div class="bh-readout">
          <span class="bh-readout-lbl">Ufuk gelgit ivmesi (L = 2 m)</span>
          <span class="bh-readout-val">${esc(BH.formatSciTR(v.horizonTidalG, 2))} g₀</span>
          <span class="bh-readout-sub">${v.spaghettificationOutsideHorizon ? '▲ Ufuk dışında parçalar' : '✓ Ufku sağlam geçer'}</span>
        </div>
      </div>

      ${tbl.sections.map(sec => `<section class="bh-panel bh-calc-sec">
        <div class="bh-panel-head">
          <h3 class="bh-panel-title">${esc(sec.title)}</h3>
        </div>
        <div class="bh-tbl-wrap">
          <table class="bh-calc-tbl" aria-label="${esc(sec.title)}">
            <thead>
              <tr>
                <th scope="col">Fiziksel Büyüklük</th>
                <th scope="col">Sembol / Formül</th>
                <th scope="col">Değer</th>
                <th scope="col">Ek Bilgi / Karşılaştırma</th>
              </tr>
            </thead>
            <tbody>
              ${sec.rows.map(r => `<tr>
                <th scope="row" class="bh-tbl-lbl">${esc(r.label)}</th>
                <td class="bh-tbl-sym mono">${esc(r.symbol)}</td>
                <td class="bh-tbl-val mono">${esc(r.formatted)}</td>
                <td class="bh-tbl-note">${esc(r.note)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`).join('')}

      <section class="bh-panel bh-calc-sec">
        <div class="bh-panel-head">
          <h3 class="bh-panel-title">Referans Yarıçaplarda Zaman Genişlemesi ve Kırmızıya Kayma</h3>
        </div>
        <div class="bh-tbl-wrap">
          <table class="bh-calc-tbl" aria-label="Referans yarıçaplarda zaman genişlemesi ve kırmızıya kayma">
            <thead>
              <tr>
                <th scope="col">Yarıçap (r / rₛ)</th>
                <th scope="col">Fiziksel Uzaklık (r)</th>
                <th scope="col">Statik dτ / dt</th>
                <th scope="col">Kırmızıya Kayma (z)</th>
                <th scope="col">Dalga Boyu Çarpanı (1 + z)</th>
              </tr>
            </thead>
            <tbody>
              ${v.referenceRadii.map(rr => `<tr>
                <th scope="row" class="bh-tbl-lbl mono">${esc(BH.formatNumTR(rr.rOverRs, 2))} rₛ${rr.rOverRs === 1.5 ? ' (foton)' : rr.rOverRs === 3 ? ' (ISCO)' : ''}</th>
                <td class="bh-tbl-val mono">${esc(formatLengthTR(rr.rMeters))}</td>
                <td class="bh-tbl-val mono">${esc(BH.formatNumTR(rr.dTauDt, 4))}</td>
                <td class="bh-tbl-val mono">${esc(BH.formatSciTR(rr.z, 3))}</td>
                <td class="bh-tbl-note mono">${esc(BH.formatSciTR(rr.onePlusZ, 3))}×</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  const onInput = e => {
    const k = e.target?.dataset?.bhIn;
    if (!k) return;
    if (k === 'mass') {
      state.massValue = e.target.value;
      state.presetId = 'custom';
      state.objectLabel = 'Özel Değer';
      syncPresetButtons();
    } else if (k === 'massUnit') {
      state.massUnit = e.target.value;
      state.presetId = 'custom';
      state.objectLabel = 'Özel Değer';
      syncPresetButtons();
    } else if (k === 'dist') {
      state.distanceValue = e.target.value;
    } else if (k === 'distUnit') {
      state.distanceUnit = e.target.value;
    } else if (k === 'spin') {
      const v = parseFloat(e.target.value);
      state.spin = Number.isFinite(v) ? (Math.abs(v) < 0.004 ? 0 : clamp(v, 0, 0.998)) : 0;
      if (spinValEl) spinValEl.textContent = BH.formatNumTR(state.spin, 3);
    } else if (k === 'rad') {
      state.radiusInRs = radiusSliderToRs(parseFloat(e.target.value));
      if (radValEl) radValEl.textContent = `${BH.formatNumTR(state.radiusInRs, 2)} rₛ`;
    }
    renderOutput();
  };

  const onClick = async e => {
    const cp = e.target.closest?.('[data-bh-cp]');
    if (cp) {
      const id = cp.dataset.bhCp;
      if (id === 'custom') {
        state.presetId = 'custom';
        state.objectLabel = 'Özel Değer';
        syncPresetButtons();
        massEl?.focus?.();
        massEl?.select?.();
        return;
      }
      const p = CALC_PRESETS.find(x => x.id === id);
      if (p) {
        state.presetId = p.id;
        state.objectLabel = p.label;
        state.massValue = String(p.massValue);
        state.massUnit = p.massUnit;
        state.spin = p.spin;
        state.distanceValue = p.distanceValue === '' ? '' : String(p.distanceValue);
        state.distanceUnit = p.distanceUnit;
        if (massEl) massEl.value = state.massValue;
        if (mUnitEl) mUnitEl.value = state.massUnit;
        if (distEl) distEl.value = state.distanceValue;
        if (dUnitEl) dUnitEl.value = state.distanceUnit;
        if (spinEl) spinEl.value = String(Math.abs(state.spin));
        if (spinValEl) spinValEl.textContent = BH.formatNumTR(state.spin, 3);
        syncPresetButtons();
        renderOutput();
      }
      return;
    }

    const rChip = e.target.closest?.('[data-bh-rad-set]');
    if (rChip) {
      const k = parseFloat(rChip.dataset.bhRadSet);
      if (Number.isFinite(k) && k > 1) {
        state.radiusInRs = k;
        if (radEl) radEl.value = rsToRadiusSlider(k).toFixed(4);
        if (radValEl) radValEl.textContent = `${BH.formatNumTR(k, k < 2 ? 2 : 0)} rₛ`;
        renderOutput();
      }
      return;
    }

    if (e.target.closest?.('[data-bh-calc-copy]')) {
      const txt = formatBlackHoleTableAsText(lastTable);
      if (!txt) { toast('Kopyalanacak geçerli hesaplama yok'); return; }
      const ok = await copyText(txt);
      toast(ok ? 'Hesaplama tablosu kopyalandı ✦' : 'Panoya kopyalanamadı');
      return;
    }

    if (e.target.closest?.('[data-bh-calc-obs]')) {
      const curPreset = CALC_PRESETS.find(p => p.id === state.presetId);
      if (curPreset?.catalogId) {
        ctx?.go?.('gozlemevi', { preset: curPreset.catalogId });
      } else if (lastTable?.valid) {
        ctx?.go?.('gozlemevi', {
          mass: clamp(lastTable.values.massSolar, 5, 1e10),
          spin: state.spin,
        });
      } else {
        ctx?.go?.('gozlemevi', {});
      }
    }
  };

  host.addEventListener('input', onInput);
  host.addEventListener('change', onInput);
  host.addEventListener('click', onClick);
  clean.add(() => {
    host.removeEventListener('input', onInput);
    host.removeEventListener('change', onInput);
    host.removeEventListener('click', onClick);
    host.innerHTML = '';
  });

  renderOutput();
  return clean.run;
}

// =====================================================================
// 12. SEKME 4: KONU ANLATIMI
// =====================================================================

function mountLessonsTab(host, ctx) {
  const clean = createClean(ctx);
  let readIds = loadJson(BH_STORAGE_KEYS.lessonsRead, []);
  if (!Array.isArray(readIds)) readIds = [];
  const openSet = new Set([BH_LESSONS[0]?.id]);
  if (ctx?.params?.lesson && BH_LESSONS.some(l => l.id === ctx.params.lesson)) {
    openSet.clear();
    openSet.add(ctx.params.lesson);
  }

  function render() {
    const prog = computeLessonProgress(readIds, BH_LESSONS);
    const doneSet = new Set(prog.doneIds);

    host.innerHTML = `<div class="bh-center-wrap">
      <section class="bh-panel bh-toc-panel" aria-label="Konu anlatımı içindekiler ve ilerleme">
        <div class="bh-panel-head">
          <div>
            <h2 class="bh-panel-title">İçindekiler ve Ders İlerlemesi</h2>
            <p class="bh-prog-text"><b>${prog.done} / ${prog.total}</b> ders tamamlandı <span class="mono mute">(%${prog.pct})</span></p>
          </div>
          <div class="bh-toc-acts">
            <button type="button" class="btn small ghost" data-bh-l-all="open">Tümünü aç</button>
            <button type="button" class="btn small ghost" data-bh-l-all="close">Tümünü kapat</button>
          </div>
        </div>

        <div class="bh-prog-track" role="progressbar" aria-valuenow="${prog.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Kara delik dersi okuma ilerlemesi yüzde ${prog.pct}">
          <div class="bh-prog-fill" style="width:${prog.pct}%"></div>
        </div>

        <nav class="bh-toc-grid" aria-label="Ders başlıkları">
          ${BH_LESSONS.map(l => {
            const isDone = doneSet.has(l.id);
            return `<button type="button" class="bh-toc-chip ${isDone ? 'bh-done' : ''}" data-bh-l-jump="${esc(l.id)}" aria-label="${l.number}. ders: ${esc(l.title)}${isDone ? ' (tamamlandı)' : ''}">
              <span class="bh-toc-num">${isDone ? '✓' : l.number}</span>
              <span class="bh-toc-lbl">${esc(l.shortTitle)}</span>
            </button>`;
          }).join('')}
        </nav>
      </section>

      <div class="bh-lessons-list">
        ${BH_LESSONS.map(l => {
          const isDone = doneSet.has(l.id);
          const isOpen = openSet.has(l.id);
          return `<details class="bh-lesson ${isDone ? 'bh-done' : ''}" data-bh-lesson="${esc(l.id)}" ${isOpen ? 'open' : ''}>
            <summary class="bh-lesson-sum">
              <span class="bh-lesson-sum-l">
                <span class="bh-lesson-num">${isDone ? '✓' : l.number}</span>
                <span class="bh-lesson-title">${esc(l.title)}</span>
              </span>
              <span class="bh-lesson-meta">
                <span class="bh-lesson-time">${l.readingMinutes} dk</span>
                ${isDone ? '<span class="bh-done-badge">✓ Tamamlandı</span>' : ''}
              </span>
            </summary>

            <div class="bh-lesson-body">
              <div class="bh-lesson-prose">
                ${l.body.map(p => `<p>${richTex(p)}</p>`).join('')}
              </div>

              ${l.equations?.length ? `<div class="grp-theorem-box bh-eq-box" aria-label="Temel denklemler">
                <div class="bh-box-tag">Temel Denklemler</div>
                ${l.equations.map(eq => `<div class="bh-eq-item">
                  <div class="bh-eq-lbl">${esc(eq.label)}</div>
                  <div class="bh-eq-tex">${tex(eq.tex, true)}</div>
                </div>`).join('')}
              </div>` : ''}

              ${l.example ? `<div class="bh-example-box" aria-label="Çözümlü örnek">
                <div class="bh-box-tag bh-tag-ex">${esc(l.example.title)}</div>
                <p class="bh-ex-prob">${richTex(l.example.problem)}</p>
                <ol class="bh-ex-steps">
                  ${l.example.steps.map(st => `<li>${richTex(st)}</li>`).join('')}
                </ol>
                <div class="bh-ex-res"><b>Sonuç:</b> ${richTex(l.example.result)}</div>
              </div>` : ''}

              <div class="bh-summary-box" aria-label="Ders özeti">
                <div class="bh-box-tag bh-tag-sum">Kısa Özet</div>
                <p>${richTex(l.summary)}</p>
              </div>

              <div class="bh-lesson-foot">
                <button type="button" class="btn small ${isDone ? 'bh-btn-done' : 'ghost'}" data-bh-l-toggle="${esc(l.id)}" aria-pressed="${isDone ? 'true' : 'false'}">
                  ${icon('check')}<span>${isDone ? 'Tamamlandı (geri al)' : 'Okudum olarak işaretle'}</span>
                </button>
                <div class="bh-lesson-acts">
                  ${(l.actions || []).map((a, ai) => `<button type="button" class="btn small ${ai === 0 ? 'primary' : ''}" data-bh-l-act="${esc(l.id)}:${ai}">
                    ${icon(a.tab === 'gozlemevi' ? 'sparkle' : a.tab === 'simulasyonlar' ? 'play' : a.tab === 'hesaplayici' ? 'calc' : 'star')}
                    <span>${esc(a.label)} →</span>
                  </button>`).join('')}
                </div>
              </div>
            </div>
          </details>`;
        }).join('')}
      </div>
    </div>`;
  }

  const onClick = e => {
    const allBtn = e.target.closest?.('[data-bh-l-all]');
    if (allBtn) {
      const open = allBtn.dataset.bhLAll === 'open';
      openSet.clear();
      if (open) BH_LESSONS.forEach(l => openSet.add(l.id));
      host.querySelectorAll('.bh-lesson').forEach(d => { d.open = open; });
      return;
    }

    const jumpBtn = e.target.closest?.('[data-bh-l-jump]');
    if (jumpBtn) {
      const id = jumpBtn.dataset.bhLJump;
      openSet.add(id);
      const det = host.querySelector(`.bh-lesson[data-bh-lesson="${id}"]`);
      if (det) {
        det.open = true;
        det.scrollIntoView?.({ behavior: full() ? 'smooth' : 'auto', block: 'start' });
      }
      return;
    }

    const togBtn = e.target.closest?.('[data-bh-l-toggle]');
    if (togBtn) {
      const id = togBtn.dataset.bhLToggle;
      // Mevcut açık ders durumlarını koru
      host.querySelectorAll('.bh-lesson').forEach(d => {
        if (d.open) openSet.add(d.dataset.bhLesson);
        else openSet.delete(d.dataset.bhLesson);
      });
      readIds = toggleLessonProgress(readIds, id);
      saveJson(BH_STORAGE_KEYS.lessonsRead, readIds);
      render();
      return;
    }

    const actBtn = e.target.closest?.('[data-bh-l-act]');
    if (actBtn) {
      const [lId, idxStr] = actBtn.dataset.bhLAct.split(':');
      const lesson = BH_LESSONS.find(l => l.id === lId);
      const act = lesson?.actions?.[Number(idxStr)];
      if (act?.tab) ctx?.go?.(act.tab, act.params || {});
    }
  };

  const onToggle = e => {
    const det = e.target;
    if (det?.classList?.contains?.('bh-lesson') && det.dataset?.bhLesson) {
      if (det.open) openSet.add(det.dataset.bhLesson);
      else openSet.delete(det.dataset.bhLesson);
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('toggle', onToggle, true);
  clean.add(() => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('toggle', onToggle, true);
    host.innerHTML = '';
  });

  render();
  return clean.run;
}

// =====================================================================
// 13. SEKME 5: ALIŞTIRMALAR
// =====================================================================

function mountExercisesTab(host, ctx) {
  const clean = createClean(ctx);
  const topics = getExerciseTopics(BH.BH_EXERCISES);

  let stats = loadJson(BH_STORAGE_KEYS.exerciseStats, null) || createDefaultExerciseStats();
  let level = LEVELS.some(l => l.id === ctx?.params?.level) ? ctx.params.level : 'isinma';
  let topic = topics.includes(ctx?.params?.topic) ? ctx.params.topic : '';
  let seedCounter = (Date.now() & 0xfffff) || 1337;
  let current = null;
  let partStates = [];

  function initPartStates(parts) {
    return parts.map(() => ({
      input: '',
      checked: false,
      ok: false,
      msg: '',
      earned: 0,
      alreadyScored: false,
      hintsShown: 0,
      solutionOpen: false,
      revealedBeforeSolve: false,
    }));
  }

  function loadNewExercise(avoidPrev = true) {
    seedCounter = ((seedCounter * 1664525 + 1013904223) >>> 0) || 1;
    current = pickNextExercise({
      templates: BH.BH_EXERCISES,
      level,
      topic,
      seed: seedCounter,
      avoidTemplateId: avoidPrev ? current?.templateId : null,
    });
    partStates = initPartStates(current.problem.parts);
    render();
  }

  function render() {
    const accPct = stats.attempts > 0 ? Math.round((stats.solved / stats.attempts) * 100) : 0;
    const allSolved = current.problem.parts.every((_, i) => partStates[i]?.ok);
    const levelTitle = LEVELS.find(l => l.id === level)?.title || 'Isınma';
    const choiceLetters = ['A', 'B', 'C', 'D'];

    host.innerHTML = `<div class="bh-center-wrap">
      <div class="grp-toolbar bh-ex-toolbar">
        <div class="bh-ex-filters">
          <div class="seg" data-bh-ex-lvl role="tablist" aria-label="Zorluk seviyesi">
            ${LEVELS.map(lv => `<button type="button" data-bh-lvl="${esc(lv.id)}" class="${level === lv.id ? 'on' : ''}" role="tab" aria-selected="${level === lv.id ? 'true' : 'false'}">${esc(lv.title)}</button>`).join('')}
          </div>
          <select class="inp bh-ex-topic-sel" data-bh-ex-topic aria-label="Alıştırma konusu filtresi">
            <option value="">Tüm konular (${BH.BH_EXERCISES.length} şablon)</option>
            ${topics.map(tp => `<option value="${esc(tp)}" ${topic === tp ? 'selected' : ''}>${esc(tp)}</option>`).join('')}
          </select>
        </div>
        <div class="bh-ex-bar-acts">
          <button type="button" class="btn small primary" data-bh-ex-next aria-label="Yeni alıştırma sorusu üret">
            ${icon('rotate')}<span>Yeni soru</span>
          </button>
          <button type="button" class="btn small ghost" data-bh-ex-reset aria-label="Alıştırma skorunu sıfırla">
            Skoru sıfırla
          </button>
        </div>
      </div>

      <div class="bh-ex-kpis" aria-label="Alıştırma puan ve seri özeti">
        <div class="bh-readout bh-readout-acc">
          <span class="bh-readout-lbl">Toplam Puan</span>
          <span class="bh-readout-val">${stats.points}</span>
          <span class="bh-readout-sub">Isınma: 10 · Ödev: 15 · Zor: 25</span>
        </div>
        <div class="bh-readout">
          <span class="bh-readout-lbl">Doğru / Deneme</span>
          <span class="bh-readout-val">${stats.solved} / ${stats.attempts}</span>
          <span class="bh-readout-sub">%${accPct} doğruluk</span>
        </div>
        <div class="bh-readout">
          <span class="bh-readout-lbl">Aktif Seri</span>
          <span class="bh-readout-val">${stats.streak}</span>
          <span class="bh-readout-sub">üst üste doğru</span>
        </div>
        <div class="bh-readout">
          <span class="bh-readout-lbl">En İyi Seri</span>
          <span class="bh-readout-val">${stats.bestStreak}</span>
          <span class="bh-readout-sub">kişisel rekorun</span>
        </div>
      </div>

      <article class="bh-panel bh-ex-card" aria-label="Aktif kara delik alıştırması">
        <header class="bh-ex-head">
          <div class="bh-ex-badges">
            <span class="bh-pill bh-pill-acc">${esc(current.topic)}</span>
            <span class="bh-pill">${esc(levelTitle)}</span>
            <span class="bh-pill mono">#${current.seed % 100000}</span>
          </div>
          <h2 class="bh-ex-title">${esc(current.problem.title)}</h2>
          <p class="bh-ex-story">${richTex(current.problem.story)}</p>
        </header>

        <div class="bh-ex-parts">
          ${current.problem.parts.map((part, idx) => {
            const ps = partStates[idx];
            const spec = part.answer;
            const unit = extractPartUnit(part);
            const maxHints = Math.min(3, (part.hints || []).length);
            const shownHints = (part.hints || []).slice(0, ps.hintsShown);

            let inputHtml = '';
            if (spec.type === 'yesno') {
              inputHtml = `<div class="bh-yn-row" role="group" aria-label="Evet veya Hayır seçimi">
                ${[['Evet', 'Evet'], ['Hayır', 'Hayır']].map(([val, lbl]) => {
                  const sel = ps.input === val;
                  return `<button type="button" class="btn small bh-yn-btn ${sel ? 'bh-on' : ''}" data-bh-yn="${idx}:${val}" aria-pressed="${sel ? 'true' : 'false'}">${lbl}</button>`;
                }).join('')}
              </div>`;
            } else if (spec.type === 'choice') {
              inputHtml = `<div class="bh-choice-list" role="radiogroup" aria-label="Çoktan seçmeli şıklar">
                ${(spec.options || []).map((opt, oi) => {
                  const sel = ps.input === String(oi);
                  const cls = ['bh-choice-btn'];
                  let mark = '';
                  if (ps.checked) {
                    if (oi === spec.value && (ps.ok || ps.solutionOpen)) { cls.push('bh-ok'); mark = ' ✓'; }
                    else if (sel && !ps.ok) { cls.push('bh-bad'); mark = ' ✗'; }
                  } else if (sel) {
                    cls.push('bh-sel');
                  }
                  return `<button type="button" class="${cls.join(' ')}" data-bh-ch="${idx}:${oi}" role="radio" aria-checked="${sel ? 'true' : 'false'}">
                    <span class="bh-choice-k">${choiceLetters[oi] || (oi + 1)}</span>
                    <span class="bh-choice-txt">${richTex(opt)}${mark}</span>
                  </button>`;
                }).join('')}
              </div>`;
            } else {
              inputHtml = `<div class="bh-ans-inp-wrap">
                <input class="inp mono bh-ans-inp" type="text" inputmode="decimal" value="${esc(ps.input)}" placeholder="Yanıtını yaz (örn. 12,4 veya 3.2e4)" data-bh-ans-in="${idx}" aria-label="${esc(part.label)} şıkkı cevabı${unit ? ' (' + unit + ')' : ''}">
                ${unit ? `<span class="bh-unit-badge" aria-label="Beklenen birim: ${esc(unit)}">${esc(unit)}</span>` : ''}
              </div>
              <span class="bh-field-hint">Ondalık için nokta veya virgül (ör. 2,95), bilimsel gösterim için 1.2e3 kullanabilirsin.</span>`;
            }

            return `<div class="bh-ex-part ${ps.checked ? (ps.ok ? 'bh-part-ok' : 'bh-part-bad') : ''}" data-bh-part="${idx}">
              <div class="bh-ex-part-head">
                <span class="bh-part-lbl">${esc(part.label)})</span>
                <div class="bh-part-prompt">${richTex(part.prompt)}</div>
                ${ps.checked ? `<span class="bh-status-pill ${ps.ok ? 'bh-ok' : 'bh-bad'}">${ps.ok ? '✓ Doğru' : '✗ Yanlış'}</span>` : ''}
              </div>

              <div class="bh-ex-part-body">
                ${inputHtml}

                <div class="bh-part-acts">
                  <button type="button" class="btn small primary" data-bh-check="${idx}" aria-label="${esc(part.label)} şıkkını kontrol et">
                    ${icon('check')}<span>Kontrol et</span>
                  </button>
                  ${maxHints > 0 ? `<button type="button" class="btn small ghost" data-bh-hint="${idx}" ${ps.hintsShown >= maxHints ? 'disabled' : ''} aria-label="İpucu göster (${ps.hintsShown}/${maxHints})">
                    İpucu (${ps.hintsShown}/${maxHints})
                  </button>` : ''}
                  <button type="button" class="btn small ghost" data-bh-sol="${idx}" aria-expanded="${ps.solutionOpen ? 'true' : 'false'}">
                    ${ps.solutionOpen ? 'Çözümü gizle' : 'Çözüm yolu'}
                  </button>
                </div>

                ${ps.checked ? `<div class="bh-feedback ${ps.ok ? 'bh-ok' : 'bh-bad'}" role="status" aria-live="polite">
                  <span class="bh-fb-mark" aria-hidden="true">${ps.ok ? '✓' : '✗'}</span>
                  <span>${esc(ps.msg)}${ps.ok && ps.earned > 0 ? ` · +${ps.earned} puan` : ''}${ps.ok && ps.revealedBeforeSolve ? ' (çözüm önceden açıldığı için puan eklenmedi)' : ''}</span>
                </div>` : ''}

                ${shownHints.length > 0 ? `<div class="bh-hints-box" aria-label="İpuçları">
                  ${shownHints.map((h, hi) => `<div class="bh-hint-item"><b>İpucu ${hi + 1}:</b> ${richTex(h)}</div>`).join('')}
                </div>` : ''}

                ${ps.solutionOpen ? `<div class="bh-solution-box" aria-label="Çözüm yolu">
                  <div class="bh-box-tag bh-tag-sol">Çözüm Yolu</div>
                  <ol class="bh-sol-steps">
                    ${(part.solution || []).map(st => `<li>${richTex(st)}</li>`).join('')}
                  </ol>
                  <div class="bh-sol-ans"><b>Doğru cevap:</b> ${spec.type === 'choice'
                    ? `<span>${richTex(answerText(spec))}</span>`
                    : `<span class="mono">${esc(answerText(spec))}${unit && unit !== 'boyutsuz' ? ' ' + esc(unit) : ''}</span>`}</div>
                </div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>

        ${allSolved ? `<div class="bh-complete-bar" role="status" aria-live="polite">
          <span><b>✓ Tüm şıklar tamamlandı!</b> Yeni rastgele değerlerle bir sonraki soruya geçebilirsin.</span>
          <button type="button" class="btn small primary" data-bh-ex-next>Sonraki soru →</button>
        </div>` : ''}
      </article>
    </div>`;

    syncSegments(host, true);
  }

  function handleCheck(idx, btnEl = null) {
    const part = current?.problem?.parts?.[idx];
    const ps = partStates[idx];
    if (!part || !ps) return;

    const result = checkAnswer(part.answer, ps.input);
    ps.checked = true;
    ps.ok = result.ok;
    ps.msg = result.msg;

    if (!result.parseError && !ps.alreadyScored) {
      const applied = applyExerciseAttempt(stats, {
        ok: result.ok,
        hintsShown: ps.hintsShown,
        revealedBeforeSolve: ps.revealedBeforeSolve,
        level,
        topic: current.topic,
        alreadyScored: false,
      });
      stats = applied.stats;
      ps.earned = applied.earned;
      if (result.ok) {
        ps.alreadyScored = true;
        if (stats.streak > 0 && stats.streak % 3 === 0 && full()) {
          const r = btnEl?.getBoundingClientRect?.();
          const cx = r ? r.left + r.width / 2 : (typeof innerWidth !== 'undefined' ? innerWidth / 2 : 300);
          const cy = r ? r.top + r.height / 2 : (typeof innerHeight !== 'undefined' ? innerHeight / 2 : 300);
          constellationBurst(cx, cy);
          toast(`${stats.streak} doğru seri! Harika ✦`);
        }
      }
      saveJson(BH_STORAGE_KEYS.exerciseStats, stats);
    }

    render();
  }

  const onClick = e => {
    const lvlBtn = e.target.closest?.('[data-bh-lvl]');
    if (lvlBtn) {
      const nextLvl = lvlBtn.dataset.bhLvl;
      if (nextLvl && nextLvl !== level) {
        level = nextLvl;
        loadNewExercise(false);
      }
      return;
    }

    if (e.target.closest?.('[data-bh-ex-next]')) {
      loadNewExercise(true);
      return;
    }

    if (e.target.closest?.('[data-bh-ex-reset]')) {
      stats = createDefaultExerciseStats();
      saveJson(BH_STORAGE_KEYS.exerciseStats, stats);
      render();
      toast('Alıştırma skoru sıfırlandı');
      return;
    }

    const ynBtn = e.target.closest?.('[data-bh-yn]');
    if (ynBtn) {
      const [idxStr, val] = ynBtn.dataset.bhYn.split(':');
      const idx = Number(idxStr);
      if (partStates[idx]) {
        partStates[idx].input = val;
        render();
      }
      return;
    }

    const chBtn = e.target.closest?.('[data-bh-ch]');
    if (chBtn) {
      const [idxStr, oiStr] = chBtn.dataset.bhCh.split(':');
      const idx = Number(idxStr);
      if (partStates[idx]) {
        partStates[idx].input = oiStr;
        render();
      }
      return;
    }

    const chkBtn = e.target.closest?.('[data-bh-check]');
    if (chkBtn) {
      handleCheck(Number(chkBtn.dataset.bhCheck), chkBtn);
      return;
    }

    const hBtn = e.target.closest?.('[data-bh-hint]');
    if (hBtn) {
      const idx = Number(hBtn.dataset.bhHint);
      const part = current?.problem?.parts?.[idx];
      const ps = partStates[idx];
      if (part && ps) {
        const maxH = Math.min(3, (part.hints || []).length);
        if (ps.hintsShown < maxH) {
          ps.hintsShown += 1;
          render();
        }
      }
      return;
    }

    const solBtn = e.target.closest?.('[data-bh-sol]');
    if (solBtn) {
      const idx = Number(solBtn.dataset.bhSol);
      const ps = partStates[idx];
      if (ps) {
        ps.solutionOpen = !ps.solutionOpen;
        if (ps.solutionOpen && !ps.ok) ps.revealedBeforeSolve = true;
        render();
      }
    }
  };

  const onInput = e => {
    const inp = e.target.closest?.('[data-bh-ans-in]');
    if (inp) {
      const idx = Number(inp.dataset.bhAnsIn);
      if (partStates[idx]) partStates[idx].input = inp.value;
    }
  };

  const onChange = e => {
    const sel = e.target.closest?.('[data-bh-ex-topic]');
    if (sel) {
      topic = sel.value;
      loadNewExercise(false);
    }
  };

  const onKeyDown = e => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest?.('[data-bh-ans-in]');
    if (inp) {
      e.preventDefault();
      handleCheck(Number(inp.dataset.bhAnsIn), inp);
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('input', onInput);
  host.addEventListener('change', onChange);
  host.addEventListener('keydown', onKeyDown);
  clean.add(() => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('input', onInput);
    host.removeEventListener('change', onChange);
    host.removeEventListener('keydown', onKeyDown);
    host.innerHTML = '';
  });

  loadNewExercise(false);
  return clean.run;
}

// =====================================================================
// 14. SEKME 6: KATALOG
// =====================================================================

function mountCatalogTab(host, ctx) {
  const clean = createClean(ctx);
  let sortBy = 'mass-desc';
  let typeFilter = 'all';

  const groups = buildSizeComparisonGroups(BH.BH_CATALOG);
  const typeCounts = {
    all: BH.BH_CATALOG.length,
    stellar: BH.BH_CATALOG.filter(o => o.type === 'stellar').length,
    intermediate: BH.BH_CATALOG.filter(o => o.type === 'intermediate').length,
    supermassive: BH.BH_CATALOG.filter(o => o.type === 'supermassive').length,
  };

  function render() {
    const list = sortAndFilterCatalog(BH.BH_CATALOG, { sortBy, typeFilter });

    host.innerHTML = `<div class="bh-center-wrap">
      <section class="bh-panel bh-scale-panel" aria-label="Olay ufku boyut karşılaştırma şeridi">
        <div class="bh-panel-head">
          <div>
            <h2 class="bh-panel-title">Olay Ufku (rₛ) Boyut Karşılaştırması — Logaritmik Gruplar</h2>
            <p class="bh-section-sub">Kara delik yarıçapları 10 onluk mertebeye yayıldığı için 3 logaritmik banda ayrılmıştır; her bandın içinde daire çapları tam olarak rₛ ile orantılıdır.</p>
          </div>
        </div>

        <div class="bh-scale-groups">
          ${groups.map(g => {
            const maxDiamPx = 76;
            const refPx = Math.max(8, Math.round(g.refRatio * maxDiamPx));
            return `<div class="bh-scale-group">
              <div class="bh-scale-g-head">
                <strong class="bh-scale-g-title">${esc(g.title)}</strong>
                <span class="bh-pill bh-pill-acc mono">${esc(g.rangeLabel)}</span>
              </div>
              <div class="bh-scale-strip" role="list" aria-label="${esc(g.title)} ölçekli karşılaştırma">
                <div class="bh-scale-item bh-scale-ref" role="listitem" aria-label="Referans ölçek: ${esc(g.refLabel)}">
                  <div class="bh-scale-orb-box">
                    <span class="bh-scale-ref-ring" style="width:${refPx}px;height:${refPx}px" aria-hidden="true"></span>
                  </div>
                  <span class="bh-scale-name">Referans</span>
                  <span class="bh-scale-val mono">${esc(g.refLabel)}</span>
                </div>
                ${g.items.map(item => {
                  const diamPx = Math.max(5, Math.round(item.scaleRatio * maxDiamPx));
                  return `<button type="button" class="bh-scale-item" data-bh-scale-jump="${esc(item.id)}" role="listitem" aria-label="${esc(item.name)}, Schwarzschild yarıçapı ${esc(formatLengthTR(item.rsMeters))}">
                    <div class="bh-scale-orb-box">
                      <span class="bh-scale-orb bh-orb-${esc(item.type)}" style="width:${diamPx}px;height:${diamPx}px" aria-hidden="true"></span>
                    </div>
                    <span class="bh-scale-name">${esc(item.name.split(' (')[0])}</span>
                    <span class="bh-scale-val mono">${esc(formatLengthTR(item.rsMeters))}</span>
                  </button>`;
                }).join('')}
              </div>
              <div class="bh-scale-note">${esc(g.scaleNote)}</div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <div class="grp-toolbar bh-cat-toolbar">
        <div class="bh-cat-filters" role="group" aria-label="Kara delik türü filtresi">
          ${CATALOG_TYPE_FILTERS.map(f => `<button type="button" class="bh-preset-btn ${typeFilter === f.id ? 'bh-on' : ''}" data-bh-cat-type="${esc(f.id)}" aria-pressed="${typeFilter === f.id ? 'true' : 'false'}">
            <span>${esc(f.label)}</span>
            <span class="bh-cat-cnt mono">${typeCounts[f.id] ?? 0}</span>
          </button>`).join('')}
        </div>

        <label class="bh-cat-sort-lbl">
          <span>Sırala</span>
          <select class="inp bh-cat-sort" data-bh-cat-sort aria-label="Katalog sıralama ölçütü">
            ${CATALOG_SORTS.map(s => `<option value="${esc(s.id)}" ${sortBy === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="bh-cat-grid" role="list" aria-label="Gözlemlenmiş gerçek kara delikler kataloğu">
        ${list.map(entry => `<article class="bh-cat-card" data-bh-cat-card="${esc(entry.id)}" role="listitem">
          <header class="bh-cat-head">
            <div class="bh-cat-badges">
              <span class="bh-type-badge bh-type-${esc(entry.type)}">${esc(entry.typeLabel)}</span>
              <span class="bh-pill mono">${entry.discoveryYear}</span>
            </div>
            <h3 class="bh-cat-name">${esc(entry.name)}</h3>
            <span class="bh-cat-const">${esc(entry.constellation)}</span>
          </header>

          <dl class="bh-cat-specs">
            <div class="bh-cat-spec">
              <dt>Kütle</dt>
              <dd class="mono">${esc(entry.massText)}</dd>
            </div>
            <div class="bh-cat-spec">
              <dt>Olay ufku (rₛ)</dt>
              <dd class="mono">${esc(formatLengthTR(entry.rsMeters))}</dd>
            </div>
            <div class="bh-cat-spec">
              <dt>Uzaklık</dt>
              <dd>${esc(entry.distanceText)}</dd>
            </div>
            <div class="bh-cat-spec">
              <dt>Spin (a*)</dt>
              <dd>${esc(entry.spinText)}</dd>
            </div>
            ${entry.shadowAngularUas !== null ? `<div class="bh-cat-spec bh-cat-spec-wide">
              <dt>Gölge açısal çapı (Dünya'dan)</dt>
              <dd class="mono">${esc(formatAngleUasTR(entry.shadowAngularUas))}</dd>
            </div>` : ''}
          </dl>

          <p class="bh-cat-note">${esc(entry.note)}</p>

          <div class="bh-cat-acts">
            <button type="button" class="btn small primary" data-bh-cat-obs="${esc(entry.id)}" aria-label="${esc(entry.name)} kara deliğini Gözlemevi'nde aç">
              ${icon('sparkle')}<span>Gözlemevi'nde aç</span>
            </button>
            <button type="button" class="btn small" data-bh-cat-calc="${esc(entry.id)}" aria-label="${esc(entry.name)} için Hesaplayıcı'yı aç">
              ${icon('calc')}<span>Hesapla</span>
            </button>
          </div>
        </article>`).join('')}
      </div>
    </div>`;
  }

  const onClick = e => {
    const typeBtn = e.target.closest?.('[data-bh-cat-type]');
    if (typeBtn) {
      typeFilter = typeBtn.dataset.bhCatType;
      render();
      return;
    }

    const jumpBtn = e.target.closest?.('[data-bh-scale-jump]');
    if (jumpBtn) {
      const id = jumpBtn.dataset.bhScaleJump;
      if (typeFilter !== 'all') {
        typeFilter = 'all';
        render();
      }
      const card = host.querySelector(`[data-bh-cat-card="${id}"]`);
      if (card) {
        card.scrollIntoView?.({ behavior: full() ? 'smooth' : 'auto', block: 'center' });
        card.classList?.add?.('bh-cat-flash');
        setTimeout(() => card.classList?.remove?.('bh-cat-flash'), 900);
      }
      return;
    }

    const obsBtn = e.target.closest?.('[data-bh-cat-obs]');
    if (obsBtn) {
      const entry = CAT_MAP.get(obsBtn.dataset.bhCatObs);
      if (entry) ctx?.go?.('gozlemevi', catalogObservatoryParams(entry));
      return;
    }

    const calcBtn = e.target.closest?.('[data-bh-cat-calc]');
    if (calcBtn) {
      const entry = CAT_MAP.get(calcBtn.dataset.bhCatCalc);
      if (entry) ctx?.go?.('hesaplayici', catalogCalculatorParams(entry));
    }
  };

  const onChange = e => {
    const sel = e.target.closest?.('[data-bh-cat-sort]');
    if (sel) {
      sortBy = sel.value;
      render();
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('change', onChange);
  clean.add(() => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('change', onChange);
    host.innerHTML = '';
  });

  render();
  return clean.run;
}

// =====================================================================
// 15. ANA BÖLÜM BAĞLAYICISI: mountBlackHole(host, tabId, ctx) -> cleanup
// =====================================================================

const TAB_MOUNT_MAP = Object.freeze({
  gozlemevi: mountObservatoryTab,
  simulasyonlar: mountSimulationsTab,
  hesaplayici: mountCalculatorTab,
  konu: mountLessonsTab,
  alistirma: mountExercisesTab,
  katalog: mountCatalogTab,
});

/**
 * Kara Delik bölümünün istenen sekmesini verilen DOM konteynerine bağlar ve
 * kaynakları (WebGL, rAF, dinleyiciler, alt simülasyon) bırakan temizleme fonksiyonunu döndürür.
 * @param {HTMLElement} host
 * @param {string} tabId - BH_TABS id'lerinden biri
 * @param {{ params?: Record<string, any>, go?: (tabId: string, params?: Record<string, any>) => void }} [ctx]
 * @returns {() => void}
 */
export function mountBlackHole(host, tabId = 'gozlemevi', ctx = {}) {
  ensureBhCss();
  const safeId = Object.prototype.hasOwnProperty.call(TAB_MOUNT_MAP, tabId) ? tabId : BH_TABS[0].id;
  const safeCtx = {
    params: (ctx && typeof ctx.params === 'object' && ctx.params) ? ctx.params : {},
    go: typeof ctx?.go === 'function'
      ? ctx.go
      : (to, p) => {
          if (typeof location !== 'undefined') {
            const q = p && Object.keys(p).length ? '?' + new URLSearchParams(p) : '';
            location.hash = `#/karadelik/${to}${q}`;
          }
        },
  };

  const mountFn = TAB_MOUNT_MAP[safeId];
  const stop = mountFn(host, safeCtx);
  let dead = false;
  return () => {
    if (dead) return;
    dead = true;
    try { stop?.(); } catch { }
  };
}

export { OBSERVATORY_PRESETS, resolveObservatoryOpts, BH_LESSONS };
