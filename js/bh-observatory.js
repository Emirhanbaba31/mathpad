// MathPad Kara Delik Gözlemevi (Part 2 of 4)
// Gerçek zamanlı, fizik tabanlı WebGL 2 (WebGL 1 ve 2B Canvas yedekli) kara delik ışın izleyicisi.
// Fizik büyüklüklerinin tümü Part 1'deki js/bh-core.js modülünden içe aktarılır; formül tekrarı yapılmaz.
// Saf hesaplamalar DOM veya tarayıcı API'si olmadan doğrudan Node testlerinde çalışır.

import * as BH from './bh-core.js';
import {
  RAYTRACE_VERT_300,
  RAYTRACE_FRAG_300,
  PRESENT_VERT_300,
  PRESENT_FRAG_300,
  RAYTRACE_VERT_100,
  RAYTRACE_FRAG_100,
  PRESENT_VERT_100,
  PRESENT_FRAG_100,
  DOWNSAMPLE_FRAG_300,
  UPSAMPLE_FRAG_300,
  COMPOSITE_FRAG_300,
} from './bh-shaders.js';

const _isDomRuntime = typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && typeof matchMedia === 'function';

const [_uiMod, _fxMod, _physUiMod] = _isDomRuntime
  ? await Promise.all([import('./ui.js'), import('./fx.js'), import('./phys-ui.js')])
  : [null, null, null];

const esc = _uiMod?.esc
  ?? (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const icon = _uiMod?.icon ?? ((name, cls = '') => `<span class="i ${cls}" data-icon="${name}" aria-hidden="true"></span>`);
const toast = _uiMod?.toast ?? (() => {});
const motion = _fxMod?.motion ?? (() => 'full');
const asleep = _fxMod?.asleep ?? (() => false);
const accentColor = _physUiMod?.accentColor ?? (() => '#ffa04a');
const createClean = _physUiMod?.createClean ?? (ctx => {
  const fns = [];
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    while (fns.length) { try { fns.pop()(); } catch { } }
  };
  ctx?.clean?.add?.(run);
  return { add(fn) { if (typeof fn === 'function') fns.push(fn); }, run };
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

let _obsInstanceSeq = 0;

// =====================================================================
// 1. SABİTLER, ÖNAYARLAR VE SAF PARAMETRE EŞLEME
// =====================================================================

export const MASS_MIN_SOLAR = 5;
export const MASS_MAX_SOLAR = 1e10;
export const DIST_MIN_M = 4;
export const DIST_MAX_M = 100;
export const SPIN_MIN = -0.998;
export const SPIN_MAX = 0.998;
export const INCL_MIN_DEG = 1;
export const INCL_MAX_DEG = 89;
export const DISK_OUTER_MIN = 10;
export const DISK_OUTER_MAX = 36;
export const TEMP_SCALE_MIN = 0.3;
export const TEMP_SCALE_MAX = 3.0;
export const DEFAULT_FOV_DEG = 48;
export const B_CRIT_M = 3 * Math.sqrt(3);

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const LOG_MASS_MIN = Math.log10(MASS_MIN_SOLAR);
const LOG_MASS_MAX = Math.log10(MASS_MAX_SOLAR);

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function findCatalog(id) {
  return BH.BH_CATALOG.find(o => o.id === id) || null;
}

const CAT_SGRA = findCatalog('sgr-a');
const CAT_M87 = findCatalog('m87-star');
const CAT_CYGX1 = findCatalog('cygnus-x1');
const CAT_TON618 = findCatalog('ton-618');

/** Kara Delik Gözlemevi hazır önayarları (gerçek katalog verileri js/bh-core.js'ten alınır). */
export const OBSERVATORY_PRESETS = Object.freeze([
  Object.freeze({
    id: 'sgr-a',
    label: 'Sgr A*',
    catalogId: 'sgr-a',
    description: 'Samanyolu merkezi · EHT 2022 hedefi (~51 μas gölge)',
    massSolar: CAT_SGRA ? CAT_SGRA.massSolar : 4.15e6,
    distancePc: CAT_SGRA ? CAT_SGRA.distancePc : 8280,
    spin: 0,
    inclinationDeg: 52,
    distanceM: 46,
    yaw: 0.35,
    diskOuterM: 20,
    tempScale: 0.62,
    diskBrightness: 1.05,
    showDisk: true,
    doppler: true,
    gravRedshift: true,
    lensing: true,
    showOverlay: false,
  }),
  Object.freeze({
    id: 'm87-star',
    label: 'M87*',
    catalogId: 'm87-star',
    description: 'EHT 2019 benzeri ~17° eğimli süperkütleli halka (~40 μas)',
    massSolar: CAT_M87 ? CAT_M87.massSolar : 6.5e9,
    distancePc: CAT_M87 ? CAT_M87.distancePc : 16.8e6,
    spin: 0,
    inclinationDeg: 17,
    distanceM: 48,
    yaw: 0.6,
    diskOuterM: 18,
    tempScale: 0.58,
    diskBrightness: 1.15,
    showDisk: true,
    doppler: true,
    gravRedshift: true,
    lensing: true,
    showOverlay: false,
  }),
  Object.freeze({
    id: 'cygnus-x1',
    label: 'Cygnus X-1',
    catalogId: 'cygnus-x1',
    description: 'Hızlı dönen (a* ≈ 0,998) sıcak X-ışını ikilisi',
    massSolar: CAT_CYGX1 ? CAT_CYGX1.massSolar : 21.2,
    distancePc: CAT_CYGX1 ? CAT_CYGX1.distancePc : 2220,
    spin: CAT_CYGX1 && CAT_CYGX1.spin !== null ? CAT_CYGX1.spin : 0.998,
    inclinationDeg: 62,
    distanceM: 32,
    yaw: -0.4,
    diskOuterM: 22,
    tempScale: 1.35,
    diskBrightness: 1.15,
    showDisk: true,
    doppler: true,
    gravRedshift: true,
    lensing: true,
    showOverlay: false,
  }),
  Object.freeze({
    id: 'gargantua',
    label: 'Gargantua tarzı',
    catalogId: null,
    description: 'Kenardan (~85°), çok parlak ve güçlü merceklenmiş disk',
    massSolar: 1e8,
    distancePc: null,
    spin: 0.95,
    inclinationDeg: 85,
    distanceM: 30,
    yaw: 0.2,
    diskOuterM: 25,
    tempScale: 1.25,
    diskBrightness: 1.55,
    showDisk: true,
    doppler: true,
    gravRedshift: true,
    lensing: true,
    showOverlay: false,
  }),
  Object.freeze({
    id: 'merceklenme',
    label: 'Merceklenme',
    catalogId: null,
    description: 'Disksiz saf kütleçekimsel merceklenme ve Einstein halkası',
    massSolar: 1e7,
    distancePc: null,
    spin: 0,
    inclinationDeg: 86,
    distanceM: 14,
    yaw: -Math.PI / 2,
    diskOuterM: 20,
    tempScale: 1.0,
    diskBrightness: 1.0,
    showDisk: false,
    doppler: true,
    gravRedshift: true,
    lensing: true,
    showOverlay: true,
  }),
  Object.freeze({
    id: 'ton-618',
    label: 'Kuasar + jet',
    catalogId: 'ton-618',
    description: 'TON 618: sıcak, parlak bir kuasar diski ve dönme ekseni boyunca göreli jet',
    massSolar: CAT_TON618 ? CAT_TON618.massSolar : 4.07e10,
    distancePc: CAT_TON618 ? CAT_TON618.distancePc : null,
    spin: 0,
    inclinationDeg: 58,
    distanceM: 52,
    yaw: 0.9,
    diskOuterM: 24,
    tempScale: 1.55,
    diskBrightness: 1.1,
    jet: true,
    showDisk: true,
    doppler: true,
    gravRedshift: true,
    lensing: true,
    showOverlay: false,
  }),
]);

/** Kalite menüsü mod tanımları. */
export const QUALITY_MODES = Object.freeze({
  auto: Object.freeze({ id: 'auto', label: 'Otomatik', scale: 0.8, maxSteps: 136, stepScale: 0.056 }),
  high: Object.freeze({ id: 'high', label: 'Yüksek', scale: 1.0, maxSteps: 176, stepScale: 0.046 }),
  medium: Object.freeze({ id: 'medium', label: 'Orta', scale: 0.65, maxSteps: 120, stepScale: 0.062 }),
  low: Object.freeze({ id: 'low', label: 'Düşük', scale: 0.38, maxSteps: 82, stepScale: 0.082 }),
});

/** Varsayılan gözlemevi başlangıç durumu (Sgr A* önayarı). */
export const DEFAULT_STATE = Object.freeze({
  presetId: 'sgr-a',
  objectName: 'Sagittarius A* (Sgr A*)',
  massSolar: OBSERVATORY_PRESETS[0].massSolar,
  distancePc: OBSERVATORY_PRESETS[0].distancePc,
  spin: OBSERVATORY_PRESETS[0].spin,
  inclinationDeg: OBSERVATORY_PRESETS[0].inclinationDeg,
  distanceM: OBSERVATORY_PRESETS[0].distanceM,
  yaw: OBSERVATORY_PRESETS[0].yaw,
  fovDeg: DEFAULT_FOV_DEG,
  diskOuterM: OBSERVATORY_PRESETS[0].diskOuterM,
  tempScale: OBSERVATORY_PRESETS[0].tempScale,
  diskBrightness: OBSERVATORY_PRESETS[0].diskBrightness,
  showDisk: true,
  animateDisk: true,
  doppler: true,
  gravRedshift: true,
  lensing: true,
  showOverlay: false,
  jet: false,
  hotSpot: true,
  cinematic: true,
  qualityMode: 'auto',
});

/** Logaritmik kütle kaydırıcısı u ∈ [0, 1] -> M ∈ [5, 10¹⁰] M☉. */
export function massSliderToSolar(u) {
  const t = clamp(Number(u) || 0, 0, 1);
  return Math.pow(10, LOG_MASS_MIN + t * (LOG_MASS_MAX - LOG_MASS_MIN));
}

/** Güneş kütlesi M ∈ [5, 10¹⁰] M☉ -> logaritmik kaydırıcı değeri u ∈ [0, 1]. */
export function solarToMassSlider(massSolar) {
  const m = clamp(Number(massSolar) || MASS_MIN_SOLAR, MASS_MIN_SOLAR, MASS_MAX_SOLAR);
  return clamp((Math.log10(m) - LOG_MASS_MIN) / (LOG_MASS_MAX - LOG_MASS_MIN), 0, 1);
}

const PRESET_ALIASES = Object.freeze({
  sgra: 'sgr-a',
  'sgr-a*': 'sgr-a',
  m87: 'm87-star',
  'm87*': 'm87-star',
  cygx1: 'cygnus-x1',
  'cyg-x1': 'cygnus-x1',
  lensing: 'merceklenme',
});

/** mountObservatory(host, opts) için { mass, spin, inclination, distance, preset } seçeneklerini geçerli duruma çözer. */
export function resolveObservatoryOpts(opts = {}) {
  const base = { ...DEFAULT_STATE };
  if (!opts || typeof opts !== 'object') return base;

  if (opts.preset) {
    const rawKey = String(opts.preset).trim().toLowerCase();
    const pKey = PRESET_ALIASES[rawKey] || rawKey;
    const foundPreset = OBSERVATORY_PRESETS.find(p => p.id === pKey);
    if (foundPreset) {
      const cat = foundPreset.catalogId ? findCatalog(foundPreset.catalogId) : null;
      Object.assign(base, {
        presetId: foundPreset.id,
        objectName: cat ? cat.name : foundPreset.label,
        massSolar: foundPreset.massSolar,
        distancePc: foundPreset.distancePc,
        spin: foundPreset.spin,
        inclinationDeg: foundPreset.inclinationDeg,
        distanceM: foundPreset.distanceM,
        yaw: foundPreset.yaw,
        diskOuterM: foundPreset.diskOuterM,
        tempScale: foundPreset.tempScale,
        diskBrightness: foundPreset.diskBrightness,
        showDisk: foundPreset.showDisk,
        doppler: foundPreset.doppler,
        gravRedshift: foundPreset.gravRedshift,
        lensing: foundPreset.lensing,
        showOverlay: foundPreset.showOverlay,
        jet: !!foundPreset.jet,
      });
    } else {
      // Katalogdaki herhangi bir gerçek kara delik id'sini de kabul et (örn. 'ton-618', 'gaia-bh1')
      const cat = findCatalog(pKey);
      if (cat) {
        base.presetId = cat.id;
        base.objectName = cat.name;
        base.massSolar = cat.massSolar;
        base.distancePc = cat.distancePc;
        base.spin = cat.spin !== null ? clamp(cat.spin, SPIN_MIN, SPIN_MAX) : 0;
      }
    }
  }

  if (Number.isFinite(opts.mass) && opts.mass > 0) {
    base.massSolar = opts.mass;
    if (!opts.preset) {
      base.presetId = 'custom';
      base.objectName = 'Özel Kara Delik';
      base.distancePc = null;
    }
  }
  if (Number.isFinite(opts.spin)) {
    base.spin = clamp(opts.spin, SPIN_MIN, SPIN_MAX);
  }
  if (Number.isFinite(opts.inclination)) {
    base.inclinationDeg = clamp(opts.inclination, INCL_MIN_DEG, INCL_MAX_DEG);
  }
  if (Number.isFinite(opts.distance) && opts.distance > 0) {
    base.distanceM = clamp(opts.distance, DIST_MIN_M, DIST_MAX_M);
  }
  if (Number.isFinite(opts.cameraDistance) && opts.cameraDistance > 0) {
    base.distanceM = clamp(opts.cameraDistance, DIST_MIN_M, DIST_MAX_M);
  }
  if (Number.isFinite(opts.distancePc) && opts.distancePc > 0) {
    base.distancePc = opts.distancePc;
  }
  if (typeof opts.showDisk === 'boolean') base.showDisk = opts.showDisk;
  if (typeof opts.lensing === 'boolean') base.lensing = opts.lensing;
  if (typeof opts.showOverlay === 'boolean') base.showOverlay = opts.showOverlay;
  if (opts.qualityMode && QUALITY_MODES[opts.qualityMode]) base.qualityMode = opts.qualityMode;

  return base;
}

/** Gözlemevi durumunu shader uniform değerlerine dönüştürür (ISCO hesabı js/bh-core.js'ten gelir). */
export function mapObservatoryParams(state) {
  const spin = clamp(Number(state.spin) || 0, SPIN_MIN, SPIN_MAX);
  const iscoGeom = BH.kerrIscoGeom(spin);
  const diskInnerEffectiveM = Math.max(iscoGeom, 2.04);
  const diskOuterM = clamp(Number(state.diskOuterM) || 20, Math.max(DISK_OUTER_MIN, diskInnerEffectiveM + 2), DISK_OUTER_MAX);
  const tempScale = clamp(Number(state.tempScale) || 1, TEMP_SCALE_MIN, TEMP_SCALE_MAX);
  const diskBrightness = clamp(Number(state.diskBrightness) || 1, 0.3, 2.5);
  const isApproximateKerr = Math.abs(spin) > 1e-4;
  const iscoInsideSchwarzschildHorizon = iscoGeom < 2.04;
  return {
    spin,
    diskInnerM: iscoGeom,
    diskInnerEffectiveM,
    diskOuterM,
    tempScale,
    diskBrightness,
    showDisk: state.showDisk ? 1 : 0,
    useDoppler: state.doppler ? 1 : 0,
    useGravRedshift: state.gravRedshift ? 1 : 0,
    useLensing: state.lensing ? 1 : 0,
    jet: state.jet ? 1 : 0,
    hotSpot: state.hotSpot ? 1 : 0,
    isApproximateKerr,
    iscoInsideSchwarzschildHorizon,
  };
}

// =====================================================================
// 2. KAMERA MATEMATİĞİ VE GÖLGE PROJEKSİYONU (SAF)
// =====================================================================

function vecNorm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Küresel kamera parametrelerinden sağ-elli ortonormal baz (pos, right, up, fwd) üretir.
 * Eğim (inclinationDeg) +y dönme ekseninden ölçülür: 0° yüz yüze (üstten), 90° kenardan (ekvator düzlemi).
 */
export function computeCameraBasis({ yaw = 0, inclinationDeg = 60, distanceM = 18, fovDeg = DEFAULT_FOV_DEG } = {}) {
  const r = clamp(Number(distanceM) || 18, DIST_MIN_M, DIST_MAX_M);
  const incl = clamp(Number(inclinationDeg) || 60, INCL_MIN_DEG, INCL_MAX_DEG);
  const theta = incl * DEG;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  const pos = [r * sinT * sinY, r * cosT, r * sinT * cosY];
  const fwd = vecNorm([-pos[0], -pos[1], -pos[2]]);
  // incl ∈ [1°, 89°] olduğu için fwd hiçbir zaman [0, 1, 0] ile eşdoğrusal olmaz
  const right = vecNorm(vecCross(fwd, [0, 1, 0]));
  const up = vecNorm(vecCross(right, fwd));
  const tanHalfFov = Math.tan(clamp(fovDeg, 20, 90) * 0.5 * DEG);

  return {
    pos,
    right,
    up,
    fwd,
    tanHalfFov,
    distanceM: r,
    inclinationDeg: incl,
    yaw,
  };
}

/** Sürükleme deltası (piksel) ile kamera açılarını günceller; yeni { yaw, inclinationDeg, vYaw, vIncl } döndürür. */
export function applyCameraDrag(cam, dxPx, dyPx, sensitivity = 0.0055) {
  const dYaw = -dxPx * sensitivity;
  const dInclDeg = -dyPx * sensitivity * RAD;
  const nextIncl = clamp(cam.inclinationDeg + dInclDeg, INCL_MIN_DEG, INCL_MAX_DEG);
  const actualDIncl = nextIncl - cam.inclinationDeg;
  return {
    yaw: cam.yaw + dYaw,
    inclinationDeg: nextIncl,
    vYaw: dYaw,
    vInclDeg: actualDIncl,
  };
}

/** Atalet adımını (sönümlü açısal hız) uygular; durma eşiği altına inince still = true döner. */
export function stepCameraInertia(cam, vel, dt, dampingPerSec = 5.5) {
  const decay = Math.exp(-dampingPerSec * Math.max(0, dt));
  const stepScale = Math.min(2.5, Math.max(0, dt) * 60);
  const nextYaw = cam.yaw + vel.vYaw * stepScale;
  const nextIncl = clamp(cam.inclinationDeg + vel.vInclDeg * stepScale, INCL_MIN_DEG, INCL_MAX_DEG);
  let nextVYaw = vel.vYaw * decay;
  let nextVIncl = (nextIncl === INCL_MIN_DEG || nextIncl === INCL_MAX_DEG) ? 0 : vel.vInclDeg * decay;
  const still = Math.abs(nextVYaw) < 1e-4 && Math.abs(nextVIncl) < 1e-3;
  if (still) {
    nextVYaw = 0;
    nextVIncl = 0;
  }
  return {
    yaw: nextYaw,
    inclinationDeg: nextIncl,
    vYaw: nextVYaw,
    vInclDeg: nextVIncl,
    still,
  };
}

/** Yakınlaştırma çarpanını [4M, 100M] aralığında uygular. */
export function applyCameraZoom(distanceM, factor) {
  if (!(factor > 0) || !Number.isFinite(factor)) return clamp(distanceM, DIST_MIN_M, DIST_MAX_M);
  return clamp(distanceM * factor, DIST_MIN_M, DIST_MAX_M);
}

/**
 * Kuramsal gölge çemberi (b_c = 3√3 M), foton küresi (r_ph = 3M), olay ufku (r_s = 2M)
 * ve r_s cinsinden ölçek çubuğunun 2B ekran piksel projeksiyonlarını hesaplar.
 */
export function computeShadowProjection(distanceM, widthPx, heightPx, fovDeg = DEFAULT_FOV_DEG) {
  const r0 = Math.max(2.01, Number(distanceM) || 18);
  const H = Math.max(1, Number(heightPx) || 400);
  const W = Math.max(1, Number(widthPx) || 640);
  const tanHalf = Math.tan(clamp(fovDeg, 20, 90) * 0.5 * DEG);
  const focalPx = (H * 0.5) / tanHalf;

  // Tam Schwarzschild statik gözlemci gölge yarım açısı: sin(α_sh) = (3√3 / r0) * √(1 - 2/r0) (r0 > 3M)
  const sinShRaw = (B_CRIT_M / r0) * Math.sqrt(Math.max(0, 1 - 2 / r0));
  const sinSh = clamp(sinShRaw, 0, 0.9999);
  const alphaShadowRad = r0 >= 3 ? Math.asin(sinSh) : Math.PI - Math.asin(sinSh);
  const shadowRadiusPx = alphaShadowRad < Math.PI * 0.495
    ? focalPx * Math.tan(alphaShadowRad)
    : Math.hypot(W, H);

  // Öklid koordinat referans çemberleri (foton küresi r = 3M ve olay ufku r_s = 2M)
  const alphaPhotonRad = r0 > 3 ? Math.asin(clamp(3 / r0, 0, 0.9999)) : Math.PI / 2;
  const photonSpherePx = alphaPhotonRad < Math.PI * 0.495 ? focalPx * Math.tan(alphaPhotonRad) : Math.hypot(W, H);

  const alphaHorizonRad = Math.asin(clamp(2 / r0, 0, 0.9999));
  const horizonPx = alphaHorizonRad < Math.PI * 0.495 ? focalPx * Math.tan(alphaHorizonRad) : Math.hypot(W, H);

  // Ölçek çubuğu: 1 r_s = 2M uzunluğunun kara delik düzlemindeki piksel genişliği
  const pxPerRs = focalPx * (2 / r0);
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50];
  let rsCount = 2;
  for (const c of candidates) {
    const w = c * pxPerRs;
    if (w >= 54 && w <= 155) {
      rsCount = c;
      break;
    }
    if (w < 54) rsCount = c;
  }
  const barWidthPx = clamp(rsCount * pxPerRs, 28, Math.min(180, W * 0.42));

  return {
    alphaShadowRad,
    alphaShadowDeg: alphaShadowRad * RAD,
    shadowRadiusPx,
    photonSpherePx,
    horizonPx,
    pxPerRs,
    rsCount,
    barWidthPx,
  };
}

// =====================================================================
// 3. FİZİK OKUMALARI (TAMAMEN js/bh-core.js ÜZERİNDEN)
// =====================================================================

/** Süreyi (saniye) okunaklı Türkçe birimle biçimlendirir (ms / s / dk / sa / gün / yıl). */
export function formatDurationTR(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds === 0) return '0 s';
  if (seconds < 1e-3) return `${BH.formatSciTR(seconds, 2)} s`;
  if (seconds < 1) return `${BH.formatNumTR(seconds * 1e3, 2)} ms`;
  if (seconds < 120) return `${BH.formatNumTR(seconds, 2)} s`;
  if (seconds < 7200) return `${BH.formatNumTR(seconds / 60, 2)} dk`;
  if (seconds < 172800) return `${BH.formatNumTR(seconds / 3600, 2)} sa`;
  if (seconds < BH.YEAR * 2) return `${BH.formatNumTR(seconds / 86400, 2)} gün`;
  return `${BH.formatSciTR(BH.secToYears(seconds), 2)} yıl`;
}

/** Kilometre uzunluğunu Türkçe bilimsel / sade biçimde döndürür. */
export function formatDistanceKmTR(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1e4 && km >= 1) return `${BH.formatNumTR(km, 1)} km`;
  return `${BH.formatSciTR(km, 2)} km`;
}

/** Mevcut gözlemevi durumu için tüm fiziksel okumaları js/bh-core.js formülleriyle hesaplar. */
export function computeObservatoryReadouts(state) {
  const massSolar = Math.max(1e-6, Number(state.massSolar) || MASS_MIN_SOLAR);
  const massKg = BH.solarMassToKg(massSolar);
  const spin = clamp(Number(state.spin) || 0, SPIN_MIN, SPIN_MAX);
  const distanceM = clamp(Number(state.distanceM) || 18, DIST_MIN_M, DIST_MAX_M);

  const rsMeters = BH.schwarzschildRadius(massKg);
  const rsKm = BH.mToKm(rsMeters);
  const shadowRadiusM = BH.shadowRadius(massKg);
  const shadowRadiusKm = BH.mToKm(shadowRadiusM);
  const photonSphereKm = BH.mToKm(BH.photonSphereRadius(massKg));

  const distancePc = Number.isFinite(state.distancePc) && state.distancePc > 0 ? state.distancePc : null;
  const shadowAngularUas = distancePc !== null
    ? BH.radToUas(BH.shadowAngularDiameter(massKg, BH.pcToM(distancePc)))
    : null;

  const iscoGeom = BH.kerrIscoGeom(spin);
  const iscoMeters = BH.kerrIsco(massKg, spin);
  const iscoKm = BH.mToKm(iscoMeters);
  const { rPlus: rPlusGeom } = BH.kerrHorizonsGeom(spin);

  let iscoPeriodSec;
  if (Math.abs(spin) < 1e-6) {
    iscoPeriodSec = BH.circularOrbitPeriod(massKg, BH.schwarzschildIsco(massKg)).coordPeriod;
  } else {
    const orb = BH.kerrCircularOrbitGeom(iscoGeom, spin);
    iscoPeriodSec = Number.isFinite(orb.omega) && Math.abs(orb.omega) > 0
      ? ((2 * Math.PI) / Math.abs(orb.omega)) * BH.gravTime(massKg)
      : NaN;
  }

  const camRadiusMeters = BH.geomToMeters(distanceM, massKg);
  const camTimeDilation = BH.staticTimeDilation(massKg, camRadiusMeters);
  const camRedshift = BH.gravitationalRedshift(massKg, camRadiusMeters);
  const camOrbitTimeDilation = distanceM > 3 ? BH.circularOrbitTimeDilation(massKg, camRadiusMeters) : NaN;
  const camOrbitBeta = distanceM > 3 ? BH.circularOrbitSpeed(massKg, camRadiusMeters) / BH.C : NaN;

  const hawkingTempK = BH.hawkingTemperature(massKg);
  const radEff = BH.kerrRadiativeEfficiency(spin);
  const mdotRef = 0.1 * BH.eddingtonAccretionRate(massKg, radEff);
  const diskMax = BH.diskTemperatureMax(massKg, mdotRef, iscoMeters);

  return {
    massSolar,
    massKg,
    spin,
    rsMeters,
    rsKm,
    rsText: formatDistanceKmTR(rsKm),
    shadowRadiusKm,
    shadowAngularUas,
    shadowAngularText: shadowAngularUas !== null
      ? `${shadowAngularUas >= 0.1 && shadowAngularUas < 1e4 ? BH.formatNumTR(shadowAngularUas, 1) : BH.formatSciTR(shadowAngularUas, 2)} μas`
      : '— (özel kütle)',
    photonSphereKm,
    iscoGeom,
    iscoKm,
    iscoText: `${BH.formatNumTR(iscoGeom, 2)} M`,
    iscoKmText: formatDistanceKmTR(iscoKm),
    rPlusGeom,
    iscoPeriodSec,
    iscoPeriodText: formatDurationTR(iscoPeriodSec),
    camTimeDilation,
    camRedshift,
    camOrbitTimeDilation,
    camOrbitBeta,
    hawkingTempK,
    hawkingTempText: `${BH.formatSciTR(hawkingTempK, 2)} K`,
    diskTmaxK: diskMax.Tmax,
    diskBand: diskMax.band,
  };
}

// =====================================================================
// 4. UYARLANABİLİR KALİTE DENETLEYİCİSİ (SAF)
// =====================================================================

/**
 * Kare süresini izleyerek çözünürlük ölçeğini [0,25 .. 1,0] ve adım bütçesini uyarlayan denetleyici.
 * Masaüstünde ~50-60 fps, telefonlarda en az 30 fps akıcılık hedefler; salınımı histerezisle önler.
 */
export function createQualityController({ isMobile = false, mode = 'auto' } = {}) {
  let curMode = QUALITY_MODES[mode] ? mode : 'auto';
  // Frames are capped at 30 fps (~33 ms apart), so the targets sit just above the cap: a GPU that keeps up
  // shows ~33 ms and may raise quality; only frames clearly slower than the cap lower it.
  const targetMs = isMobile ? 36.0 : 35.0;
  const upperMs = isMobile ? 45.0 : 41.0;  // eşik üstü (mobilde <22 fps, masaüstünde <24 fps) -> düşür
  const lowerMs = isMobile ? 35.0 : 34.8;  // 30 fps sınırına yetişiyor -> yükselt
  const minScale = 0.25;
  const maxScale = 1.0;

  let scale = isMobile ? 0.58 : 0.84;
  let emaMs = targetMs;
  let framesSinceAdjust = 0;
  let goodStreak = 0;

  function stepsForScale(s) {
    const t = clamp((s - minScale) / (maxScale - minScale), 0, 1);
    const maxSteps = Math.round(lerp(76, 172, t));
    const stepScale = lerp(0.082, 0.048, t);
    return { maxSteps, stepScale };
  }

  return {
    setMode(nextMode) {
      if (QUALITY_MODES[nextMode]) {
        curMode = nextMode;
        framesSinceAdjust = 0;
        goodStreak = 0;
      }
      return curMode;
    },
    getMode() {
      return curMode;
    },
    getParams(isInteracting = false) {
      if (curMode !== 'auto') {
        const m = QUALITY_MODES[curMode];
        return {
          mode: curMode,
          scale: m.scale,
          maxSteps: m.maxSteps,
          stepScale: m.stepScale,
          emaMs,
          fps: emaMs > 0 ? 1000 / emaMs : 60,
        };
      }
      // Sürükleme sırasında akıcılık için hafif ölçek indirimi, durunca tam yerleşim kalitesi
      const effScale = isInteracting ? clamp(scale * 0.88, minScale, maxScale) : scale;
      const { maxSteps, stepScale } = stepsForScale(effScale);
      return {
        mode: 'auto',
        scale: effScale,
        maxSteps,
        stepScale,
        emaMs,
        fps: emaMs > 0 ? 1000 / emaMs : 60,
      };
    },
    recordFrame(frameMs, isInteracting = false) {
      // Sekme uyandığında / tekil duraklamada oluşan uç süreleri (> 300 ms) yoksay
      if (!Number.isFinite(frameMs) || frameMs <= 0.5 || frameMs > 300) {
        return { changed: false, ...this.getParams(isInteracting) };
      }
      emaMs = emaMs * 0.82 + frameMs * 0.18;
      if (curMode !== 'auto') {
        return { changed: false, ...this.getParams(isInteracting) };
      }
      framesSinceAdjust++;
      let changed = false;

      if (emaMs > upperMs && framesSinceAdjust >= 6) {
        const pressure = clamp((emaMs - targetMs) / targetMs, 0.12, 0.55);
        const next = clamp(scale * (1 - 0.22 * pressure - 0.06), minScale, maxScale);
        if (Math.abs(next - scale) > 0.005) {
          scale = next;
          changed = true;
        }
        framesSinceAdjust = 0;
        goodStreak = 0;
      } else if (emaMs < lowerMs) {
        goodStreak++;
        if (goodStreak >= 14 && framesSinceAdjust >= 12) {
          const next = clamp(scale + 0.065, minScale, maxScale);
          if (Math.abs(next - scale) > 0.005) {
            scale = next;
            changed = true;
          }
          framesSinceAdjust = 0;
          goodStreak = 0;
        }
      } else {
        goodStreak = Math.max(0, goodStreak - 1);
      }

      return { changed, ...this.getParams(isInteracting) };
    },
    reset() {
      scale = isMobile ? 0.58 : 0.84;
      emaMs = targetMs;
      framesSinceAdjust = 0;
      goodStreak = 0;
    },
  };
}

// =====================================================================
// 5. 'GEMİYLE YAKLAŞ' SİNEMATİK YOLCULUK MODELİ (SAF)
// =====================================================================

/** Mevcut kamera konumundan ISCO yakınında kararlı bir yörüngeye sarmal yaklaşma yolculuğu oluşturur. */
export function createShipJourney(startState, { targetDistanceM = null } = {}) {
  const isco = BH.kerrIscoGeom(clamp(Number(startState.spin) || 0, SPIN_MIN, SPIN_MAX));
  const defaultTarget = clamp(Math.max(6.5, isco + 0.5), 6.2, 12.0);
  const targetDist = targetDistanceM !== null
    ? clamp(targetDistanceM, 4.5, 25)
    : defaultTarget;
  const startDist = clamp(Number(startState.distanceM) || 18, DIST_MIN_M, DIST_MAX_M);
  const startIncl = clamp(Number(startState.inclinationDeg) || 55, INCL_MIN_DEG, INCL_MAX_DEG);
  const targetIncl = clamp(startIncl < 55 ? 74 : startIncl, 62, 82);

  return {
    phase: 'approach', // 'approach' | 'orbit' | 'return' | 'done'
    elapsedSec: 0,
    approachDurSec: 7.0,
    returnDurSec: 3.6,
    returnStartSec: 0,
    startDist,
    startIncl,
    startYaw: Number(startState.yaw) || 0,
    targetDist,
    targetIncl,
    returnFromDist: targetDist,
    returnFromIncl: targetIncl,
    returnFromYaw: Number(startState.yaw) || 0,
    distanceM: startDist,
    inclinationDeg: startIncl,
    yaw: Number(startState.yaw) || 0,
    properTimeSec: 0,
    coordTimeSec: 0,
    timeDilation: 1,
    betaMag: 0,
    shipBeta: [0, 0, 0],
    forwardBlueshift: 1,
    blueshiftWarning: false,
  };
}

/** Yaklaşma veya yörünge fazındaki gemiyi başlangıç konumuna geri döndürür. */
export function beginShipReturn(journey) {
  if (!journey || journey.phase === 'done' || journey.phase === 'return') return journey;
  journey.phase = 'return';
  journey.returnStartSec = journey.elapsedSec;
  journey.returnFromDist = journey.distanceM;
  journey.returnFromIncl = journey.inclinationDeg;
  journey.returnFromYaw = journey.yaw;
  return journey;
}

/**
 * Gemi yolculuğunu dt saniye ilerletir; js/bh-core.js zaman genişlemesi ile gemi öz zamanı (τ)
 * ve uzak gözlemci zamanını (t) günceller, göreli sapma hız vektörünü hesaplar.
 */
export function stepShipJourney(journey, dt, massSolar) {
  if (!journey || journey.phase === 'done') return journey;
  const stepDt = Math.max(0, Number(dt) || 0);
  journey.elapsedSec += stepDt;

  const massKg = BH.solarMassToKg(Math.max(1, Number(massSolar) || 10));
  let radialBeta = 0;
  let tangFrac = 0;

  if (journey.phase === 'approach') {
    const u = clamp(journey.elapsedSec / journey.approachDurSec, 0, 1);
    const e = smoothstep(0, 1, u);
    journey.distanceM = lerp(journey.startDist, journey.targetDist, e);
    journey.inclinationDeg = lerp(journey.startIncl, journey.targetIncl, e);
    journey.yaw = journey.startYaw + e * 1.45;
    // Yaklaşma boyunca ortada tepe yapan radyal hız + hedef eşyönlü yörünge hızına yumuşak geçiş
    const radialDir = journey.targetDist <= journey.startDist ? 1 : -1;
    radialBeta = radialDir * Math.sin(Math.PI * u) * 0.36;
    tangFrac = smoothstep(0.22, 1.0, u);
    if (u >= 1) {
      journey.phase = 'orbit';
    }
  } else if (journey.phase === 'orbit') {
    journey.distanceM = journey.targetDist;
    journey.inclinationDeg = journey.targetIncl;
    // Diskle eşyönlü (+y ekseninden saat yönünün tersine, d(yaw)/dt > 0) dairesel yörünge dönüşü
    const omegaVis = 0.28 * Math.pow(6.5 / journey.distanceM, 1.5);
    journey.yaw += omegaVis * stepDt;
    radialBeta = 0;
    tangFrac = 1.0;
  } else if (journey.phase === 'return') {
    const u = clamp((journey.elapsedSec - journey.returnStartSec) / journey.returnDurSec, 0, 1);
    const e = smoothstep(0, 1, u);
    journey.distanceM = lerp(journey.returnFromDist, journey.startDist, e);
    journey.inclinationDeg = lerp(journey.returnFromIncl, journey.startIncl, e);
    journey.yaw = lerp(journey.returnFromYaw, journey.startYaw, e);
    const retDir = journey.startDist <= journey.returnFromDist ? 1 : -1;
    radialBeta = retDir * Math.sin(Math.PI * u) * 0.25;
    tangFrac = 1 - smoothstep(0, 0.75, u);
    if (u >= 1) {
      journey.phase = 'done';
      journey.betaMag = 0;
      journey.shipBeta = [0, 0, 0];
    }
  }

  const rMeters = BH.geomToMeters(journey.distanceM, massKg);
  const staticDil = BH.staticTimeDilation(massKg, rMeters);
  const orbBetaFull = journey.distanceM > 3.05
    ? BH.circularOrbitSpeed(massKg, rMeters) / BH.C
    : 0.6;
  const tangBeta = tangFrac * orbBetaFull;

  // Toplam yerel 3-hız (ışık hızının güvenli alt sınırında)
  const rawBeta = Math.hypot(radialBeta, tangBeta);
  const betaMag = journey.phase === 'done' ? 0 : Math.min(rawBeta, 0.72);
  const scaleB = rawBeta > 1e-6 ? betaMag / rawBeta : 0;
  const bRad = radialBeta * scaleB;
  const bTang = tangBeta * scaleB;

  const basis = computeCameraBasis({
    yaw: journey.yaw,
    inclinationDeg: journey.inclinationDeg,
    distanceM: journey.distanceM,
  });
  // Yörünge teğet yönü (+y ekseninden saat yönünün tersine: (+z, 0, -x))
  const hLen = Math.hypot(basis.pos[0], basis.pos[2]) || 1;
  const tangDir = [basis.pos[2] / hLen, 0, -basis.pos[0] / hLen];

  journey.betaMag = betaMag;
  journey.shipBeta = [
    basis.fwd[0] * bRad + tangDir[0] * bTang,
    basis.fwd[1] * bRad + tangDir[1] * bTang,
    basis.fwd[2] * bRad + tangDir[2] * bTang,
  ];

  // Tam GR zaman genişlemesi: dτ/dt = √(1 - r_s/r) √(1 - β²); dairesel yörüngede circularOrbitTimeDilation ile özdeş!
  const dilation = journey.phase === 'orbit'
    ? BH.circularOrbitTimeDilation(massKg, rMeters)
    : staticDil * Math.sqrt(Math.max(1e-4, 1 - betaMag * betaMag));
  journey.timeDilation = dilation;
  journey.coordTimeSec += stepDt;
  journey.properTimeSec += stepDt * dilation;

  const gravBlue = 1 / Math.max(staticDil, 0.05);
  const dopplerBlue = Math.sqrt((1 + betaMag) / Math.max(1 - betaMag, 1e-4));
  journey.forwardBlueshift = gravBlue * dopplerBlue;
  journey.blueshiftWarning = journey.phase !== 'done' && (journey.forwardBlueshift > 1.25 || betaMag > 0.14);

  return journey;
}

// =====================================================================
// 6. SHADER İLE BİREBİR CPU REFERANS JEODEZİK VE DISK KAYMASI (TESTLER İÇİN SAF)
// =====================================================================

/**
 * Fragment shader'daki 3B Schwarzschild RK4 sıfır jeodezik bütünleştiricisinin birebir JS ikizi.
 * Node testlerinde gölge yarıçapını (b_c = 3√3 M), sapma açısını ve h korunumunu js/bh-core.js ile çapraz doğrular.
 */
export function traceSchwarzschildRayCPU(pos0, dLoc, { maxSteps = 176, stepScale = 0.048, rFar = null } = {}) {
  const pos = [pos0[0], pos0[1], pos0[2]];
  const r0 = Math.hypot(pos[0], pos[1], pos[2]);
  const rHat0 = [pos[0] / r0, pos[1] / r0, pos[2] / r0];
  const dUnit = vecNorm(dLoc);
  const invSqrtF0 = 1 / Math.sqrt(Math.max(1 - 2 / r0, 1e-6));
  const dRad = vecDot(dUnit, rHat0);
  const vel = [
    dRad * rHat0[0] + (dUnit[0] - dRad * rHat0[0]) * invSqrtF0,
    dRad * rHat0[1] + (dUnit[1] - dRad * rHat0[1]) * invSqrtF0,
    dRad * rHat0[2] + (dUnit[2] - dRad * rHat0[2]) * invSqrtF0,
  ];
  const hVec0 = vecCross(pos, vel);
  const h0 = Math.hypot(hVec0[0], hVec0[1], hVec0[2]);
  const h2 = h0 * h0;
  const farLimit = rFar ?? Math.max(145, r0 * 2.3 + 45);

  const accel = p => {
    const r2 = Math.max(p[0] * p[0] + p[1] * p[1] + p[2] * p[2], 0.25);
    const r = Math.sqrt(r2);
    const k = (-3 * h2) / (r2 * r2 * r);
    return [k * p[0], k * p[1], k * p[2]];
  };

  let captured = false;
  let maxHDrift = 0;
  let steps = 0;

  for (let i = 0; i < maxSteps; i++) {
    steps = i + 1;
    const r = Math.hypot(pos[0], pos[1], pos[2]);
    if (r <= 2.008) {
      captured = true;
      break;
    }
    if (r > farLimit && vecDot(pos, vel) > 0) break;

    const rSafe = Math.max(r, 2.01);
    const nearFactor = clamp((rSafe - 1.82) * 0.45, 0.11, 1.0);
    let hStep = stepScale * rSafe * nearFactor;
    if (rSafe > 28) {
      if (vecDot(pos, vel) > 0) {
        hStep = Math.max(hStep, 0.22 * rSafe);
      } else {
        const farMargin = rSafe - 28;
        hStep = Math.max(hStep, Math.min(0.14 * rSafe, farMargin * 0.55 + hStep));
      }
    }
    hStep = clamp(hStep, 0.022, 22.0);

    const k1x = [vel[0], vel[1], vel[2]];
    const k1v = accel(pos);
    const p2 = [pos[0] + 0.5 * hStep * k1x[0], pos[1] + 0.5 * hStep * k1x[1], pos[2] + 0.5 * hStep * k1x[2]];
    const v2 = [vel[0] + 0.5 * hStep * k1v[0], vel[1] + 0.5 * hStep * k1v[1], vel[2] + 0.5 * hStep * k1v[2]];
    const k2x = v2;
    const k2v = accel(p2);
    const p3 = [pos[0] + 0.5 * hStep * k2x[0], pos[1] + 0.5 * hStep * k2x[1], pos[2] + 0.5 * hStep * k2x[2]];
    const v3 = [vel[0] + 0.5 * hStep * k2v[0], vel[1] + 0.5 * hStep * k2v[1], vel[2] + 0.5 * hStep * k2v[2]];
    const k3x = v3;
    const k3v = accel(p3);
    const p4 = [pos[0] + hStep * k3x[0], pos[1] + hStep * k3x[1], pos[2] + hStep * k3x[2]];
    const v4 = [vel[0] + hStep * k3v[0], vel[1] + hStep * k3v[1], vel[2] + hStep * k3v[2]];
    const k4x = v4;
    const k4v = accel(p4);

    for (let j = 0; j < 3; j++) {
      pos[j] += (hStep / 6) * (k1x[j] + 2 * k2x[j] + 2 * k3x[j] + k4x[j]);
      vel[j] += (hStep / 6) * (k1v[j] + 2 * k2v[j] + 2 * k3v[j] + k4v[j]);
    }
    const hc = vecCross(pos, vel);
    const hCur = Math.hypot(hc[0], hc[1], hc[2]);
    const drift = Math.abs(hCur - h0);
    if (drift > maxHDrift) maxHDrift = drift;
  }

  const rEnd = Math.hypot(pos[0], pos[1], pos[2]);
  if (!captured && rEnd < 3.15 && (rEnd < 2.6 || vecDot(pos, vel) < 0)) {
    captured = true;
  }
  return {
    captured,
    impactParam: h0,
    maxHDrift,
    escapeDir: vecNorm(vel),
    finalR: rEnd,
    steps,
  };
}

/** Shader'daki disk Doppler + kütleçekimsel kayma çarpanı g = 1/(1+z) ve g⁴ bolometrik parlaklık hesabı. */
export function computeDiskRedshiftFactor(rHit, bz, { spin = 0, useDoppler = true, useGravRedshift = true } = {}) {
  const r32 = rHit * Math.sqrt(rHit);
  const omega = 1 / Math.max(r32 + spin, 0.5);
  const gGrav = Math.sqrt(Math.max(1 - 2 / rHit, 0.025));
  const denomUt2 = Math.max(rHit * rHit * rHit - 3 * rHit * rHit + 2 * spin * r32, 0.06 * rHit * rHit);
  const ut = (r32 + spin) / Math.sqrt(denomUt2);
  const oneMinusOmegaB = clamp(1 - omega * bz, 0.22, 4.5);
  const gFull = 1 / (ut * oneMinusOmegaB);
  const gDoppler = clamp(gFull / Math.max(gGrav, 0.05), 0.25, 3.2);
  let g = 1;
  if (useGravRedshift) g *= gGrav;
  if (useDoppler) g *= gDoppler;
  g = clamp(g, 0.14, 3.6);
  return { g, gGrav, gDoppler, beamingIntensity: g * g * g * g };
}

// =====================================================================
// 7. WEBGL YARDIMCILARI VE 2B KURAMSAL KATMAN / YEDEK ÇİZİCİ
// =====================================================================

function ensureBhCss() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[href*="bh.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/bh.css';
  document.head.append(link);
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || 'Derleme hatası';
    gl.deleteShader(sh);
    console.warn('Kara Delik shader hatası:', log);
    return null;
  }
  return sh;
}

function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) || 'Bağlama hatası';
    gl.deleteProgram(prog);
    console.warn('Kara Delik program hatası:', log);
    return null;
  }
  return prog;
}

function rgbStr(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/** Kuramsal gölge (b_c = 3√3 M), foton küresi (3M) çemberleri ve r_s ölçek çubuğunu 2B katmana çizer. */
function drawOverlay2D(ctx, W, H, state, readouts, { fallbackMode = false, accCol = '#ffa04a' } = {}) {
  ctx.clearRect(0, 0, W, H);
  const proj = computeShadowProjection(state.distanceM, W, H, state.fovDeg);
  const cx = W * 0.5;
  const cy = H * 0.5;

  if (fallbackMode) {
    drawFallbackBlackHole(ctx, W, H, cx, cy, proj, state, readouts);
  }

  if (!state.showOverlay) return;

  ctx.save();
  ctx.textBaseline = 'middle';

  // 0. Düz uzay karşılaştırmasında Öklid olay ufku (r_s = 2M) referansı
  if (!state.lensing && proj.horizonPx > 6 && proj.horizonPx < Math.max(W, H) * 0.92) {
    ctx.beginPath();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = 1.2;
    ctx.arc(cx, cy, proj.horizonPx, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 1. Foton küresi referans çemberi (r_ph = 3M = 1,5 r_s)
  if (proj.photonSpherePx > 6 && proj.photonSpherePx < Math.max(W, H) * 0.95) {
    ctx.beginPath();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(130, 200, 255, 0.72)';
    ctx.lineWidth = 1.4;
    ctx.arc(cx, cy, proj.photonSpherePx, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2. Kuramsal kara delik gölgesi (b_c = 3√3 M ≈ 2,60 r_s)
  if (proj.shadowRadiusPx > 10 && proj.shadowRadiusPx < Math.max(W, H) * 0.98) {
    ctx.beginPath();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = accCol;
    ctx.lineWidth = 1.8;
    ctx.arc(cx, cy, proj.shadowRadiusPx, 0, Math.PI * 2);
    ctx.stroke();

    // Etiketler (sağ üst ve sağ alt yay)
    ctx.setLineDash([]);
    ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    const shLbl = `Gölge b_c = 3√3 M (${BH.formatNumTR(proj.alphaShadowDeg, 1)}°)`;
    const lx = clamp(cx + proj.shadowRadiusPx * 0.72 + 8, 12, W - 210);
    const ly = clamp(cy - proj.shadowRadiusPx * 0.72 - 6, 48, H - 56);
    ctx.fillStyle = 'rgba(6, 7, 11, 0.78)';
    const tw = ctx.measureText(shLbl).width + 12;
    ctx.fillRect(lx - 6, ly - 10, tw, 20);
    ctx.fillStyle = accCol;
    ctx.fillText(shLbl, lx, ly);

    if (proj.photonSpherePx > 14 && proj.shadowRadiusPx - proj.photonSpherePx > 16) {
      const phLbl = 'Foton küresi r_ph = 3M';
      const px = clamp(cx + proj.photonSpherePx * 0.7 + 6, 12, W - 180);
      const py = clamp(cy + proj.photonSpherePx * 0.7 + 10, 68, H - 40);
      ctx.fillStyle = 'rgba(6, 7, 11, 0.78)';
      ctx.fillRect(px - 6, py - 10, ctx.measureText(phLbl).width + 12, 20);
      ctx.fillStyle = '#9bd4ff';
      ctx.fillText(phLbl, px, py);
    }
  }

  // 3. r_s ölçek çubuğu (sağ alt köşe)
  ctx.setLineDash([]);
  const barW = proj.barWidthPx;
  const bx2 = W - 16;
  const bx1 = bx2 - barW;
  const by = H - 22;
  ctx.fillStyle = 'rgba(6, 7, 11, 0.74)';
  ctx.fillRect(bx1 - 10, by - 24, barW + 20, 34);
  ctx.strokeStyle = 'rgba(244, 244, 245, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx1, by);
  ctx.lineTo(bx2, by);
  ctx.moveTo(bx1, by - 5);
  ctx.lineTo(bx1, by + 4);
  ctx.moveTo(bx2, by - 5);
  ctx.lineTo(bx2, by + 4);
  ctx.stroke();

  const barKm = proj.rsCount * readouts.rsKm;
  const rsLabel = `${BH.formatNumTR(proj.rsCount, proj.rsCount < 1 ? 2 : 0)} rₛ (${formatDistanceKmTR(barKm)})`;
  ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f4f4f5';
  ctx.fillText(rsLabel, bx2, by - 13);
  ctx.restore();
}

/** WebGL olmadığında veya bağlam kaybında Part 1 sayılarıyla 2B kuramsal kara delik görünümü çizer. */
function drawFallbackBlackHole(ctx, W, H, cx, cy, proj, state, readouts) {
  // Derin uzay arka planı ve deterministik yıldızlar
  const bg = ctx.createRadialGradient(cx, cy, proj.shadowRadiusPx * 0.4, cx, cy, Math.max(W, H) * 0.8);
  bg.addColorStop(0, '#090b12');
  bg.addColorStop(0.6, '#030408');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Yıldız alanı (merceklenme açıksa gölge çevresinde dışa itilir)
  let s = 1337;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 150; i++) {
    let sx = rnd() * W;
    let sy = rnd() * H;
    const dx = sx - cx;
    const dy = sy - cy;
    const d = Math.hypot(dx, dy);
    if (state.lensing && d > 1) {
      const push = (proj.shadowRadiusPx * proj.shadowRadiusPx) / Math.max(d * 1.4, proj.shadowRadiusPx * 0.6);
      sx = cx + (dx / d) * (d + push * 0.55);
      sy = cy + (dy / d) * (d + push * 0.55);
    }
    if (Math.hypot(sx - cx, sy - cy) < proj.shadowRadiusPx * 1.03) continue;
    const br = 0.25 + rnd() * 0.7;
    const rad = 0.6 + rnd() * 1.25;
    ctx.fillStyle = `rgba(225, 236, 255, ${br.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const rSh = clamp(proj.shadowRadiusPx, 18, Math.min(W, H) * 0.36);
  const cosI = Math.cos(clamp(state.inclinationDeg, INCL_MIN_DEG, INCL_MAX_DEG) * DEG);
  const params = mapObservatoryParams(state);
  const outerPx = rSh * clamp(params.diskOuterM / B_CRIT_M, 1.5, 4.8);
  const innerPx = rSh * clamp(params.diskInnerEffectiveM / B_CRIT_M, 0.52, 1.8);

  if (state.showDisk) {
    const tPeak = 5800 * params.tempScale;
    const cApp = BH.blackbodyToRGB(state.doppler ? tPeak * 1.32 : tPeak);
    const cRec = BH.blackbodyToRGB(state.doppler ? tPeak * 0.62 : tPeak);
    const cMid = BH.blackbodyToRGB(tPeak * (state.gravRedshift ? 0.85 : 1.0));

    // Merceklenmiş arka disk halkaları (üst ve alt yay)
    if (state.lensing) {
      const halo = ctx.createRadialGradient(cx, cy, rSh * 0.96, cx, cy, rSh * 1.65);
      halo.addColorStop(0, rgbStr(cMid, 0.85));
      halo.addColorStop(0.28, rgbStr(cMid, 0.38));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, rSh * 1.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ekvatoral disk (solda yaklaşan parlak mavi-beyaz, sağda uzaklaşan sönük kırmızı-turuncu)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, Math.max(0.14, cosI));
    const dg = ctx.createLinearGradient(-outerPx, 0, outerPx, 0);
    dg.addColorStop(0, rgbStr(cApp, 0.12));
    dg.addColorStop(0.28, rgbStr(cApp, state.doppler ? 0.92 : 0.72));
    dg.addColorStop(0.5, rgbStr(cMid, 0.65));
    dg.addColorStop(0.75, rgbStr(cRec, state.doppler ? 0.36 : 0.72));
    dg.addColorStop(1, rgbStr(cRec, 0.08));
    ctx.strokeStyle = dg;
    ctx.lineWidth = Math.max(10, (outerPx - innerPx) * 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, (innerPx + outerPx) * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Kara delik gölgesi (b_c = 3√3 M) ve ince foton halkası
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, state.lensing ? rSh : proj.horizonPx, 0, Math.PI * 2);
  ctx.fill();

  if (state.lensing) {
    const ringCol = state.showDisk ? BH.blackbodyToRGB(5800 * params.tempScale) : { r: 0.78, g: 0.88, b: 1 };
    ctx.strokeStyle = rgbStr(ringCol, state.showDisk ? 0.85 : 0.45);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(cx, cy, rSh + 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// =====================================================================
// 8. ANA GÖZLEMEVİ BAĞLAMA FONKSİYONU: mountObservatory(host, opts)
// =====================================================================

/**
 * Kara Delik Gözlemevini verilen DOM konteynerine bağlar ve temizleme fonksiyonunu döndürür.
 * @param {HTMLElement} host
 * @param {object} [opts] - İsteğe bağlı { mass, spin, inclination, distance, preset } önayarları
 * @returns {() => void} cleanup fonksiyonu
 */
export function mountObservatory(host, opts = {}) {
  ensureBhCss();
  const clean = createClean(opts?.ctx || opts);
  const state = resolveObservatoryOpts(opts);
  const isMobile = typeof matchMedia === 'function' ? matchMedia('(max-width: 820px), (pointer: coarse)').matches : false;
  const quality = createQualityController({ isMobile, mode: state.qualityMode });

  let dead = false;
  let dirty = true;
  let simTime = 0;
  let dragging = false;
  let interacted = false;
  let inertia = { vYaw: 0, vInclDeg: 0 };
  let journey = null;
  let prevFrameNow = 0;
  let lastReadoutSync = 0;
  let lastBadgeSync = 0;
  let stageW = 640;
  let stageH = 400;
  let dpr = 1;

  // WebGL durumu
  let gl = null;
  let isWebGL2 = false;
  let fallbackReason = null; // null | 'no-webgl' | 'context-lost'
  let rtProg = null;
  let prProg = null;
  let rtLoc = {};
  let prLoc = {};
  let quadVbo = null;
  let fbo = null;
  let fboTex = null;
  let fboW = 0;
  let fboH = 0;
  let skyTex = null;
  let hasSkyTex = false;
  let cachedSkyImg = null;
  // HDR + bloom pipeline (WebGL 2 with float render targets); falls back to the LDR path when unavailable
  let hdr = false;
  let dsProg = null, usProg = null, cpProg = null;
  let dsLoc = {}, usLoc = {}, cpLoc = {};
  let hdrScene = null; // { tex, fbo, w, h }
  let bloomLevels = []; // [{ tex, fbo, w, h }]

  const instId = ++_obsInstanceSeq;
  const slId = k => `bh-sl-${k}-${instId}`;

  // ---------- DOM İskeleti ----------
  host.innerHTML = `<div class="bh-obs">
    <div class="bh-obs-presets" role="group" aria-label="Kara delik hazır önayarları">
      <span class="bh-obs-preset-lbl">Önayar:</span>
      ${OBSERVATORY_PRESETS.map(p => `<button type="button" class="bh-preset-btn ${state.presetId === p.id ? 'bh-on' : ''}" data-bh-preset="${esc(p.id)}" aria-pressed="${state.presetId === p.id ? 'true' : 'false'}" title="${esc(p.description)}">
        <span class="bh-preset-dot" aria-hidden="true"></span><span>${esc(p.label)}</span>
      </button>`).join('')}
    </div>

    <div class="bh-obs-grid">
      <div class="bh-obs-main">
        <div class="bh-stage" data-bh-stage tabindex="0" role="application" aria-label="Etkileşimli kara delik ışın izleme gözlemevi. Yörünge için sürükleyin, yakınlaştırmak için kaydırın.">
          <canvas class="bh-gl-canvas" data-bh-gl aria-hidden="true"></canvas>
          <canvas class="bh-overlay-canvas" data-bh-ov aria-hidden="true"></canvas>

          <div class="bh-hud-top">
            <div class="bh-hud-badges">
              <span class="bh-badge bh-badge-exact" data-bh-metric-badge aria-live="polite"></span>
              <span class="bh-badge" data-bh-qual-badge></span>
            </div>
            <div class="bh-hud-acts" role="group" aria-label="Kamera hızlı kontrolleri">
              <button type="button" class="bh-hud-btn" data-bh-zoom="in" aria-label="Yakınlaştır" title="Yakınlaştır">+</button>
              <button type="button" class="bh-hud-btn" data-bh-zoom="out" aria-label="Uzaklaştır" title="Uzaklaştır">−</button>
              <button type="button" class="bh-hud-btn" data-bh-reset aria-label="Kamerayı sıfırla" title="Görünümü sıfırla">${icon('rotate')}</button>
            </div>
          </div>

          <div class="bh-hint" data-bh-hint>Sürükle: yörünge · Tekerlek / iki parmak: yakınlaştır</div>

          <div class="bh-fallback-banner" data-bh-fallback hidden role="status" aria-live="polite"></div>
        </div>

        <div class="bh-ship-hud" data-bh-ship-hud hidden aria-live="polite">
          <div class="bh-ship-head">
            <span class="bh-ship-title">${icon('sparkle')} <span data-bh-ship-phase>ISCO yörüngesine yaklaşılıyor</span></span>
            <span class="mono small" data-bh-ship-speed></span>
          </div>
          <div class="bh-ship-clocks">
            <div class="bh-ship-clock">
              <span class="bh-ship-clock-lbl">Gemi öz zamanı (τ)</span>
              <span class="bh-ship-clock-val" data-bh-ship-tau>0,00 s</span>
            </div>
            <div class="bh-ship-clock">
              <span class="bh-ship-clock-lbl">Uzak gözlemci (t)</span>
              <span class="bh-ship-clock-val" data-bh-ship-t>0,00 s</span>
            </div>
            <div class="bh-ship-clock">
              <span class="bh-ship-clock-lbl">Zaman genişlemesi (dτ/dt)</span>
              <span class="bh-ship-clock-val" data-bh-ship-dil>1,000</span>
            </div>
          </div>
          <div class="bh-ship-note" data-bh-ship-note hidden></div>
        </div>

        <div class="bh-action-bar">
          <div class="bh-action-group">
            <button type="button" class="bh-ship-btn" data-bh-ship aria-pressed="false" aria-label="Gemiyle kara deliğe yaklaş">${icon('sparkle')} <span data-bh-ship-lbl>Gemiyle yaklaş</span></button>
            <button type="button" class="bh-anim-btn" data-bh-anim aria-pressed="${state.animateDisk ? 'true' : 'false'}" aria-label="Yığılma diski dönüşünü oynat veya duraklat">${icon(state.animateDisk ? 'pause' : 'play')} <span data-bh-anim-lbl>${state.animateDisk ? 'Diski duraklat' : 'Diski oynat'}</span></button>
          </div>
          <div class="bh-quality-wrap">
            <span class="bh-quality-lbl">Kalite</span>
            <div class="bh-quality-seg" role="group" aria-label="Görüntü kalitesi">
              ${Object.values(QUALITY_MODES).map(m => `<button type="button" class="bh-q-btn ${state.qualityMode === m.id ? 'bh-on' : ''}" data-bh-q="${m.id}" aria-pressed="${state.qualityMode === m.id ? 'true' : 'false'}">${esc(m.label)}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="bh-readouts" data-bh-readouts aria-label="Canlı kara delik fiziksel ölçümleri">
          <div class="bh-readout bh-readout-acc">
            <span class="bh-readout-lbl">Schwarzschild yarıçapı (r<sub>s</sub>)</span>
            <span class="bh-readout-val" data-ro="rs">—</span>
            <span class="bh-readout-sub" data-ro="rsSub">—</span>
          </div>
          <div class="bh-readout">
            <span class="bh-readout-lbl">Gölge açısal çapı (Dünya'dan)</span>
            <span class="bh-readout-val" data-ro="shadowAng">—</span>
            <span class="bh-readout-sub" data-ro="shadowSub">b<sub>c</sub> = 3√3 M ≈ 2,60 r<sub>s</sub></span>
          </div>
          <div class="bh-readout">
            <span class="bh-readout-lbl">ISCO yarıçapı (r<sub>ISCO</sub>)</span>
            <span class="bh-readout-val" data-ro="isco">—</span>
            <span class="bh-readout-sub" data-ro="iscoSub">—</span>
          </div>
          <div class="bh-readout">
            <span class="bh-readout-lbl">ISCO yörünge periyodu</span>
            <span class="bh-readout-val" data-ro="period">—</span>
            <span class="bh-readout-sub" data-ro="periodSub">Koordinat periyodu</span>
          </div>
          <div class="bh-readout">
            <span class="bh-readout-lbl">Kamera zaman genişlemesi &amp; z</span>
            <span class="bh-readout-val" data-ro="camDil">—</span>
            <span class="bh-readout-sub" data-ro="camZ">—</span>
          </div>
          <div class="bh-readout">
            <span class="bh-readout-lbl">Hawking sıcaklığı (T<sub>H</sub>)</span>
            <span class="bh-readout-val" data-ro="hawking">—</span>
            <span class="bh-readout-sub" data-ro="diskPeak">—</span>
          </div>
        </div>
      </div>

      <aside class="bh-controls" aria-label="Gözlemevi parametre kontrolleri">
        <section class="bh-panel">
          <div class="bh-panel-head">
            <h3 class="bh-panel-title">Fizik ve Kamera</h3>
            <span class="small mono mute" data-bh-obj-name>${esc(state.objectName)}</span>
          </div>
          <div class="bh-sliders">
            <div class="bh-slider-item">
              <div class="bh-slider-top">
                <label class="bh-slider-lbl" for="${slId('mass')}">Kütle (M<sub>☉</sub>, logaritmik)</label>
                <span class="bh-slider-val" data-val="mass">—</span>
              </div>
              <input id="${slId('mass')}" class="bh-range" type="range" min="0" max="1" step="0.002" value="${solarToMassSlider(state.massSolar).toFixed(4)}" data-bh-sl="mass" aria-label="Kara delik kütlesi güneş kütlesi cinsinden">
              <span class="bh-slider-note">Boyutsuz görüntüyü değiştirmez; r<sub>s</sub>, periyot ve T<sub>H</sub> ölçeklenir.</span>
            </div>

            <div class="bh-slider-item">
              <div class="bh-slider-top">
                <label class="bh-slider-lbl" for="${slId('spin')}">Dönme spini (a*)</label>
                <span class="bh-slider-val" data-val="spin">—</span>
              </div>
              <input id="${slId('spin')}" class="bh-range" type="range" min="${SPIN_MIN}" max="${SPIN_MAX}" step="0.002" value="${state.spin}" data-bh-sl="spin" aria-label="Boyutsuz kara delik spini a yıldız">
              <span class="bh-slider-note" data-bh-spin-note></span>
            </div>

            <div class="bh-slider-item">
              <div class="bh-slider-top">
                <label class="bh-slider-lbl" for="${slId('incl')}">Eğim açısı (i)</label>
                <span class="bh-slider-val" data-val="incl">—</span>
              </div>
              <input id="${slId('incl')}" class="bh-range" type="range" min="${INCL_MIN_DEG}" max="${INCL_MAX_DEG}" step="0.5" value="${state.inclinationDeg}" data-bh-sl="incl" aria-label="Bakış eğim açısı derece cinsinden">
            </div>

            <div class="bh-slider-item">
              <div class="bh-slider-top">
                <label class="bh-slider-lbl" for="${slId('dist')}">Kamera uzaklığı (r)</label>
                <span class="bh-slider-val" data-val="dist">—</span>
              </div>
              <input id="${slId('dist')}" class="bh-range" type="range" min="${DIST_MIN_M}" max="${DIST_MAX_M}" step="0.5" value="${state.distanceM}" data-bh-sl="dist" aria-label="Kamera uzaklığı M biriminde">
            </div>

            <div class="bh-slider-item">
              <div class="bh-slider-top">
                <label class="bh-slider-lbl" for="${slId('outer')}">Disk dış yarıçapı (r<sub>dış</sub>)</label>
                <span class="bh-slider-val" data-val="outer">—</span>
              </div>
              <input id="${slId('outer')}" class="bh-range" type="range" min="${DISK_OUTER_MIN}" max="${DISK_OUTER_MAX}" step="0.5" value="${state.diskOuterM}" data-bh-sl="outer" aria-label="Yığılma diski dış yarıçapı">
            </div>

            <div class="bh-slider-item">
              <div class="bh-slider-top">
                <label class="bh-slider-lbl" for="${slId('temp')}">Disk sıcaklık ölçeği</label>
                <span class="bh-slider-val" data-val="temp">—</span>
              </div>
              <input id="${slId('temp')}" class="bh-range" type="range" min="${TEMP_SCALE_MIN}" max="${TEMP_SCALE_MAX}" step="0.05" value="${state.tempScale}" data-bh-sl="temp" aria-label="Disk sıcaklık ölçeği">
            </div>
          </div>
        </section>

        <section class="bh-panel">
          <div class="bh-panel-head">
            <h3 class="bh-panel-title">Fiziksel Etkiler ve Katmanlar</h3>
          </div>
          <div class="bh-toggles" role="group" aria-label="Görsel ve fiziksel anahtarlar">
            ${[
              ['showDisk', 'Yığılma diski', 'Shakura-Sunyaev ince diski'],
              ['doppler', 'Doppler ışınlaması (g⁴)', 'Yaklaşan kenar parlak/mavi, uzaklaşan sönük/kırmızı'],
              ['gravRedshift', 'Kütleçekimsel kırmızıya kayma', 'İç disk ışığı derin kuyuda kırmızıya kayar'],
              ['lensing', 'Gökyüzü merceklenmesi', 'Kapatıldığında düz Minkowski uzayı ile karşılaştır'],
              ['showOverlay', 'Kuramsal gölge ve ölçek', 'b_c = 3√3 M, r_ph = 3M çemberleri ve r_s çubuğu'],
              ['hotSpot', 'Sıcak gaz topağı (parlama)', 'ISCO dışında Kepler periyoduyla dolanan parlak gaz; merceklenmiş görüntüsü de görünür'],
              ['jet', 'Göreli jet', 'Dönme ekseni boyunca ~0,92c jet: yaklaşan kol Doppler ile parlar, karşı jet söner'],
              ['cinematic', 'Sinematik parıltı', 'HDR parıltı (bloom), vinyet, kromatik sapma ve film greni'],
            ].map(([key, title, tip]) => `<button type="button" class="bh-toggle ${state[key] ? 'bh-on' : ''}" data-bh-toggle="${key}" role="switch" aria-checked="${state[key] ? 'true' : 'false'}" title="${esc(tip)}">
              <span>${esc(title)}</span>
              <span class="bh-toggle-state" data-bh-ts="${key}">${state[key] ? '✓ Açık' : '○ Kapalı'}</span>
            </button>`).join('')}
          </div>
          <div class="bh-info-note">
            <b>Model notu:</b> Işık ışınları Schwarzschild metriğinde (G = c = M = 1) uyarlanabilir adımlı 4. mertebe Runge-Kutta ile tam izlenir. Spin a* ≠ 0 olduğunda Kerr ISCO iç kenarı kullanılır ve arayüzde <b>yaklaşık</b> olarak işaretlenir.
          </div>
        </section>
      </aside>
    </div>
  </div>`;

  // ---------- DOM Referansları ----------
  const stageEl = host.querySelector('[data-bh-stage]');
  const glCanvas = host.querySelector('[data-bh-gl]');
  const ovCanvas = host.querySelector('[data-bh-ov]');
  const metricBadgeEl = host.querySelector('[data-bh-metric-badge]');
  const qualBadgeEl = host.querySelector('[data-bh-qual-badge]');
  const hintEl = host.querySelector('[data-bh-hint]');
  const fallbackEl = host.querySelector('[data-bh-fallback]');
  const objNameEl = host.querySelector('[data-bh-obj-name]');
  const spinNoteEl = host.querySelector('[data-bh-spin-note]');
  const shipBtn = host.querySelector('[data-bh-ship]');
  const shipLbl = host.querySelector('[data-bh-ship-lbl]');
  const animBtn = host.querySelector('[data-bh-anim]');
  const animLbl = host.querySelector('[data-bh-anim-lbl]');
  const shipHud = host.querySelector('[data-bh-ship-hud]');
  const shipPhaseEl = host.querySelector('[data-bh-ship-phase]');
  const shipSpeedEl = host.querySelector('[data-bh-ship-speed]');
  const shipTauEl = host.querySelector('[data-bh-ship-tau]');
  const shipTEl = host.querySelector('[data-bh-ship-t]');
  const shipDilEl = host.querySelector('[data-bh-ship-dil]');
  const shipNoteEl = host.querySelector('[data-bh-ship-note]');

  const slEls = {
    mass: host.querySelector('[data-bh-sl="mass"]'),
    spin: host.querySelector('[data-bh-sl="spin"]'),
    incl: host.querySelector('[data-bh-sl="incl"]'),
    dist: host.querySelector('[data-bh-sl="dist"]'),
    outer: host.querySelector('[data-bh-sl="outer"]'),
    temp: host.querySelector('[data-bh-sl="temp"]'),
  };
  const valEls = {
    mass: host.querySelector('[data-val="mass"]'),
    spin: host.querySelector('[data-val="spin"]'),
    incl: host.querySelector('[data-val="incl"]'),
    dist: host.querySelector('[data-val="dist"]'),
    outer: host.querySelector('[data-val="outer"]'),
    temp: host.querySelector('[data-val="temp"]'),
  };
  const roEls = {
    rs: host.querySelector('[data-ro="rs"]'),
    rsSub: host.querySelector('[data-ro="rsSub"]'),
    shadowAng: host.querySelector('[data-ro="shadowAng"]'),
    shadowSub: host.querySelector('[data-ro="shadowSub"]'),
    isco: host.querySelector('[data-ro="isco"]'),
    iscoSub: host.querySelector('[data-ro="iscoSub"]'),
    period: host.querySelector('[data-ro="period"]'),
    periodSub: host.querySelector('[data-ro="periodSub"]'),
    camDil: host.querySelector('[data-ro="camDil"]'),
    camZ: host.querySelector('[data-ro="camZ"]'),
    hawking: host.querySelector('[data-ro="hawking"]'),
    diskPeak: host.querySelector('[data-ro="diskPeak"]'),
  };

  // ---------- WebGL Kurulum ve Kaynak Yönetimi ----------
  function showFallback(reason) {
    fallbackReason = reason;
    if (!fallbackEl) return;
    if (reason === 'no-webgl') {
      fallbackEl.hidden = false;
      fallbackEl.textContent = 'Bu cihazda veya tarayıcıda WebGL kullanılamıyor. Kara delik gölgesi (b_c = 3√3 M) ve merceklenmiş halka 2B kuramsal yedek görünümle çiziliyor.';
    } else if (reason === 'context-lost') {
      fallbackEl.hidden = false;
      fallbackEl.textContent = 'WebGL grafik bağlamı geçici olarak kesildi — 2B kuramsal yedek görünüm etkin. Bağlam geri geldiğinde ışın izleme otomatik sürecek.';
    } else {
      fallbackEl.hidden = true;
      fallbackEl.textContent = '';
    }
  }

  function isPow2(n) {
    return n > 0 && (n & (n - 1)) === 0;
  }

  function uploadSkyTexture(img) {
    if (!gl || dead || gl.isContextLost?.() || !img) return;
    if (!skyTex) skyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const canMipAndRepeat = isWebGL2 || (isPow2(img.naturalWidth || img.width) && isPow2(img.naturalHeight || img.height));
    if (canMipAndRepeat) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
        || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      if (aniso) {
        const maxA = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
        gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, maxA));
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    hasSkyTex = true;
    dirty = true;
    loop.start();
  }

  function loadSkyImage() {
    if (cachedSkyImg) {
      uploadSkyTexture(cachedSkyImg);
      return;
    }
    if (typeof Image === 'undefined') return;
    const primarySrc = 'textures/2k_stars_milky_way.jpg';
    const fallbackSrc = 'textures/1k/1k_stars_milky_way.jpg';
    const img = new Image();
    img.decoding = 'async';
    let triedFallback = false;
    img.onload = () => {
      if (dead) return;
      cachedSkyImg = img;
      uploadSkyTexture(img);
    };
    img.onerror = () => {
      if (dead || triedFallback) return;
      triedFallback = true;
      img.src = fallbackSrc;
    };
    img.src = primarySrc;
  }

  function ensureFbo(targetW, targetH) {
    if (!gl) return false;
    const w = Math.max(64, Math.round(targetW));
    const h = Math.max(48, Math.round(targetH));
    if (fbo && fboTex && w === fboW && h === fboH) return true;
    if (fboTex) gl.deleteTexture(fboTex);
    if (fbo) gl.deleteFramebuffer(fbo);

    fboTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!complete) {
      gl.deleteTexture(fboTex);
      gl.deleteFramebuffer(fbo);
      fboTex = null;
      fbo = null;
      fboW = 0;
      fboH = 0;
      return false;
    }
    fboW = w;
    fboH = h;
    return true;
  }

  function initHdr() {
    if (!hdr) return;
    dsProg = linkProgram(gl, PRESENT_VERT_300, DOWNSAMPLE_FRAG_300);
    usProg = linkProgram(gl, PRESENT_VERT_300, UPSAMPLE_FRAG_300);
    cpProg = linkProgram(gl, PRESENT_VERT_300, COMPOSITE_FRAG_300);
    if (!dsProg || !usProg || !cpProg) { destroyHdr(); hdr = false; return; }
    const locs = (prog, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(prog, n)]));
    dsLoc = locs(dsProg, ['uSrc', 'uTexel', 'uFirst', 'uThreshold']);
    usLoc = locs(usProg, ['uSrc', 'uTexel', 'uRadius']);
    cpLoc = locs(cpProg, ['uScene', 'uBloom', 'uExposure', 'uBloomStrength', 'uTime', 'uCinematic']);
  }

  function makeHdrTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); return null; }
    return { tex, fbo: fb, w, h };
  }

  function freeHdrTargets() {
    for (const t of [hdrScene, ...bloomLevels]) {
      if (!t) continue;
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    hdrScene = null;
    bloomLevels = [];
  }

  function destroyHdr() {
    if (!gl) return;
    freeHdrTargets();
    for (const pr of [dsProg, usProg, cpProg]) if (pr) gl.deleteProgram(pr);
    dsProg = usProg = cpProg = null;
  }

  // Scene target at the ray-tracing resolution plus a 5-level bloom chain starting at half of it
  function ensureHdrTargets(w, h) {
    w = Math.max(64, Math.round(w));
    h = Math.max(48, Math.round(h));
    if (hdrScene && hdrScene.w === w && hdrScene.h === h) return true;
    freeHdrTargets();
    hdrScene = makeHdrTarget(w, h);
    if (!hdrScene) return false;
    let lw = w, lh = h;
    for (let i = 0; i < 5; i++) {
      lw = Math.max(2, lw >> 1);
      lh = Math.max(2, lh >> 1);
      const t = makeHdrTarget(lw, lh);
      if (!t) { freeHdrTargets(); return false; }
      bloomLevels.push(t);
    }
    return true;
  }

  function drawPass(target, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Bloom chain + cinematic composite onto the visible canvas
  function postProcess(fullW, fullH) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(dsProg);
    gl.uniform1i(dsLoc.uSrc, 2);
    gl.uniform1f(dsLoc.uThreshold, 3.2);
    let src = hdrScene;
    bloomLevels.forEach((lvl, i) => {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(dsLoc.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform1f(dsLoc.uFirst, i === 0 ? 1 : 0);
      drawPass(lvl.fbo, lvl.w, lvl.h);
      src = lvl;
    });
    gl.useProgram(usProg);
    gl.uniform1i(usLoc.uSrc, 2);
    gl.uniform1f(usLoc.uRadius, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = bloomLevels.length - 1; i > 0; i--) {
      const from = bloomLevels[i], to = bloomLevels[i - 1];
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform2f(usLoc.uTexel, 1 / from.w, 1 / from.h);
      drawPass(to.fbo, to.w, to.h);
    }
    gl.disable(gl.BLEND);
    gl.useProgram(cpProg);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, hdrScene.tex);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, bloomLevels[0].tex);
    gl.uniform1i(cpLoc.uScene, 3);
    gl.uniform1i(cpLoc.uBloom, 4);
    gl.uniform1f(cpLoc.uExposure, 0.32);
    gl.uniform1f(cpLoc.uBloomStrength, state.cinematic ? 0.34 : 0.0);
    gl.uniform1f(cpLoc.uTime, simTime);
    gl.uniform1f(cpLoc.uCinematic, state.cinematic ? 1 : 0);
    drawPass(null, fullW, fullH);
  }

  function destroyWebGL(loseCtx = false) {
    if (!gl) return;
    try {
      if (fboTex) gl.deleteTexture(fboTex);
      if (fbo) gl.deleteFramebuffer(fbo);
      if (skyTex) gl.deleteTexture(skyTex);
      if (quadVbo) gl.deleteBuffer(quadVbo);
      if (rtProg) gl.deleteProgram(rtProg);
      if (prProg) gl.deleteProgram(prProg);
      destroyHdr();
      if (loseCtx) gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { }
    fboTex = null;
    fbo = null;
    skyTex = null;
    quadVbo = null;
    rtProg = null;
    prProg = null;
    fboW = 0;
    fboH = 0;
    hasSkyTex = false;
  }

  function initWebGL() {
    if (!glCanvas || typeof glCanvas.getContext !== 'function') {
      showFallback('no-webgl');
      return false;
    }
    const ctxOpts = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    try {
      gl = glCanvas.getContext('webgl2', ctxOpts);
      if (gl) {
        isWebGL2 = true;
      } else {
        gl = glCanvas.getContext('webgl', ctxOpts) || glCanvas.getContext('experimental-webgl', ctxOpts);
        isWebGL2 = false;
      }
    } catch {
      gl = null;
    }
    if (!gl) {
      showFallback('no-webgl');
      return false;
    }

    const canHdr = isWebGL2 && !!gl.getExtension('EXT_color_buffer_float');
    const rtFrag = canHdr ? RAYTRACE_FRAG_300.replace('precision highp float;', 'precision highp float;\n#define HDR_OUT 1') : (isWebGL2 ? RAYTRACE_FRAG_300 : RAYTRACE_FRAG_100);
    rtProg = linkProgram(gl, isWebGL2 ? RAYTRACE_VERT_300 : RAYTRACE_VERT_100, rtFrag);
    hdr = canHdr;
    prProg = linkProgram(gl, isWebGL2 ? PRESENT_VERT_300 : PRESENT_VERT_100, isWebGL2 ? PRESENT_FRAG_300 : PRESENT_FRAG_100);
    if (!rtProg || !prProg) {
      destroyWebGL(false);
      gl = null;
      showFallback('no-webgl');
      return false;
    }

    const uNames = [
      'uResolution', 'uCamPos', 'uCamRight', 'uCamUp', 'uCamFwd', 'uTanHalfFov', 'uAspect',
      'uSpin', 'uDiskInner', 'uDiskOuter', 'uTempScale', 'uDiskBrightness', 'uTime',
      'uShowDisk', 'uUseDoppler', 'uUseGravRedshift', 'uUseLensing', 'uMaxSteps', 'uStepScale',
      'uShipBeta', 'uSkyGravBlue', 'uSkyTex', 'uHasSkyTex', 'uJet', 'uHotSpot',
    ];
    rtLoc = {};
    for (const n of uNames) rtLoc[n] = gl.getUniformLocation(rtProg, n);
    initHdr();
    prLoc = { uFrameTex: gl.getUniformLocation(prProg, 'uFrameTex') };

    // Tek tam-ekran üçgen (dörtgenden daha hızlı, köşegen ek yeri yok)
    quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // Doku gelene kadar 1x1 siyah yer tutucu
    skyTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    showFallback(null);
    loadSkyImage();
    return true;
  }

  // ---------- UI Senkronizasyonu ----------
  function syncControlsUI() {
    const params = mapObservatoryParams(state);
    if (objNameEl) objNameEl.textContent = state.objectName;

    if (slEls.mass) slEls.mass.value = solarToMassSlider(state.massSolar).toFixed(4);
    if (slEls.spin) slEls.spin.value = String(state.spin);
    if (slEls.incl) slEls.incl.value = String(state.inclinationDeg);
    if (slEls.dist) slEls.dist.value = String(state.distanceM);
    if (slEls.outer) slEls.outer.value = String(params.diskOuterM);
    if (slEls.temp) slEls.temp.value = String(state.tempScale);

    if (valEls.mass) valEls.mass.textContent = `${BH.formatSciTR(state.massSolar, 2)} M☉`;
    if (valEls.spin) valEls.spin.textContent = BH.formatNumTR(state.spin, 3);
    if (valEls.incl) valEls.incl.textContent = `${BH.formatNumTR(state.inclinationDeg, 1)}°`;
    if (valEls.dist) valEls.dist.textContent = `${BH.formatNumTR(state.distanceM, 1)} M`;
    if (valEls.outer) valEls.outer.textContent = `${BH.formatNumTR(params.diskOuterM, 1)} M`;
    if (valEls.temp) valEls.temp.textContent = `${BH.formatNumTR(state.tempScale, 2)}×`;

    if (spinNoteEl) {
      if (!params.isApproximateKerr) {
        spinNoteEl.className = 'bh-slider-note';
        spinNoteEl.textContent = 'a* = 0: Tam Schwarzschild ışın izleme (ISCO = 6,00 M).';
      } else if (params.iscoInsideSchwarzschildHorizon) {
        spinNoteEl.className = 'bh-slider-note bh-warn-note';
        spinNoteEl.textContent = `Yaklaşık: Kerr ISCO = ${BH.formatNumTR(params.diskInnerM, 2)} M; ışın izleyicide Schwarzschild ufku (2M) sınır alınır.`;
      } else {
        spinNoteEl.className = 'bh-slider-note bh-warn-note';
        spinNoteEl.textContent = `Yaklaşık: Işın yolu Schwarzschild, disk iç kenarı Kerr ISCO (${BH.formatNumTR(params.diskInnerM, 2)} M).`;
      }
    }

    if (metricBadgeEl) {
      if (!state.lensing) {
        metricBadgeEl.className = 'bh-badge bh-badge-approx';
        metricBadgeEl.innerHTML = `<span class="bh-badge-mark">◇</span> Düz uzay (merceklenme kapalı)`;
      } else if (params.isApproximateKerr) {
        metricBadgeEl.className = 'bh-badge bh-badge-approx';
        metricBadgeEl.innerHTML = `<span class="bh-badge-mark">≈</span> Yaklaşık Kerr (ISCO: ${BH.formatNumTR(params.diskInnerM, 2)} M)`;
      } else {
        metricBadgeEl.className = 'bh-badge bh-badge-exact';
        metricBadgeEl.innerHTML = `<span class="bh-badge-mark">●</span> Tam Schwarzschild GR`;
      }
    }

    host.querySelectorAll('[data-bh-preset]').forEach(btn => {
      const on = btn.dataset.bhPreset === state.presetId;
      btn.classList.toggle('bh-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    host.querySelectorAll('[data-bh-toggle]').forEach(btn => {
      const key = btn.dataset.bhToggle;
      const on = !!state[key];
      btn.classList.toggle('bh-on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      const st = btn.querySelector(`[data-bh-ts="${key}"]`);
      if (st) st.textContent = on ? '✓ Açık' : '○ Kapalı';
    });

    host.querySelectorAll('[data-bh-q]').forEach(btn => {
      const on = btn.dataset.bhQ === state.qualityMode;
      btn.classList.toggle('bh-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    if (animBtn) {
      const on = !!state.animateDisk;
      animBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      animBtn.innerHTML = `${icon(on ? 'pause' : 'play')} <span data-bh-anim-lbl>${on ? 'Diski duraklat' : 'Diski oynat'}</span>`;
    }
  }

  function syncReadoutsUI() {
    const ro = computeObservatoryReadouts(state);
    if (roEls.rs) roEls.rs.textContent = ro.rsText;
    if (roEls.rsSub) roEls.rsSub.textContent = `r_g = ${formatDistanceKmTR(ro.rsKm * 0.5)} · M = ${BH.formatSciTR(ro.massSolar, 2)} M☉`;
    if (roEls.shadowAng) roEls.shadowAng.textContent = ro.shadowAngularText;
    if (roEls.shadowSub) roEls.shadowSub.textContent = `b_c = ${formatDistanceKmTR(ro.shadowRadiusKm)} (3√3 M)`;
    if (roEls.isco) roEls.isco.textContent = ro.iscoText;
    if (roEls.iscoSub) roEls.iscoSub.textContent = `${ro.iscoKmText} · r₊ = ${BH.formatNumTR(ro.rPlusGeom, 2)} M`;
    if (roEls.period) roEls.period.textContent = ro.iscoPeriodText;
    if (roEls.periodSub) roEls.periodSub.textContent = Math.abs(ro.spin) > 1e-4 ? 'Kerr ekvatoral yörünge' : 'Schwarzschild ISCO (6M)';
    if (roEls.camDil) roEls.camDil.textContent = `dτ/dt = ${BH.formatNumTR(ro.camTimeDilation, 4)}`;
    if (roEls.camZ) roEls.camZ.textContent = `z = ${BH.formatNumTR(ro.camRedshift, 4)} (r = ${BH.formatNumTR(state.distanceM, 1)} M)`;
    if (roEls.hawking) roEls.hawking.textContent = ro.hawkingTempText;
    if (roEls.diskPeak) roEls.diskPeak.textContent = `0,1 L_Edd disk: ${BH.formatSciTR(ro.diskTmaxK, 2)} K (${ro.diskBand})`;
    return ro;
  }

  function syncQualityBadge(qParams) {
    if (!qualBadgeEl) return;
    if (fallbackReason) {
      qualBadgeEl.textContent = '2B Yedek';
      return;
    }
    const modeLbl = QUALITY_MODES[qParams.mode]?.label || 'Oto';
    const pct = Math.round(qParams.scale * 100);
    const fps = Math.round(clamp(qParams.fps, 1, 144));
    const apiTag = isWebGL2 ? 'GL2' : 'GL1';
    qualBadgeEl.textContent = `${modeLbl} · %${pct} · ${fps} fps · ${apiTag}`;
  }

  function syncShipUI() {
    if (!shipHud || !shipBtn) return;
    const active = !!journey && journey.phase !== 'done';
    shipHud.hidden = !active;
    shipBtn.classList.toggle('bh-active', active);
    shipBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (shipLbl) {
      shipLbl.textContent = active
        ? (journey.phase === 'return' ? 'Dönülüyor…' : 'Geri dön')
        : 'Gemiyle yaklaş';
    }
    if (!active) return;

    const phaseText = journey.phase === 'approach'
      ? `ISCO yörüngesine yaklaşılıyor (r = ${BH.formatNumTR(journey.distanceM, 1)} M)`
      : journey.phase === 'orbit'
        ? `ISCO yakınında kararlı yörüngede (r = ${BH.formatNumTR(journey.distanceM, 1)} M)`
        : `Güvenli gözlem uzaklığına dönülüyor (r = ${BH.formatNumTR(journey.distanceM, 1)} M)`;
    if (shipPhaseEl) shipPhaseEl.textContent = phaseText;
    if (shipSpeedEl) shipSpeedEl.textContent = `v = ${BH.formatNumTR(journey.betaMag, 2)} c`;
    if (shipTauEl) shipTauEl.textContent = `${BH.formatNumTR(journey.properTimeSec, 2)} s`;
    if (shipTEl) shipTEl.textContent = `${BH.formatNumTR(journey.coordTimeSec, 2)} s`;
    if (shipDilEl) shipDilEl.textContent = BH.formatNumTR(journey.timeDilation, 4);
    if (shipNoteEl) {
      shipNoteEl.hidden = !journey.blueshiftWarning;
      if (journey.blueshiftWarning) {
        shipNoteEl.textContent = `Göreli sapma ve maviye kayma: Arka plan gökyüzü ilerleme yönünde öne doğru sıkışıyor ve maviye kayıyor (tepe frekans oranı ≈ ${BH.formatNumTR(journey.forwardBlueshift, 2)}×).`;
      }
    }
  }

  // ---------- Çizim ve Boyutlandırma ----------
  function resizeCanvases() {
    if (!stageEl || !glCanvas || !ovCanvas) return;
    const rect = stageEl.getBoundingClientRect();
    stageW = Math.max(240, Math.round(rect.width || 640));
    stageH = Math.max(180, Math.round(rect.height || 400));
    dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, isMobile ? 1.5 : 2);

    glCanvas.width = Math.round(stageW * dpr);
    glCanvas.height = Math.round(stageH * dpr);
    ovCanvas.width = Math.round(stageW * dpr);
    ovCanvas.height = Math.round(stageH * dpr);

    dirty = true;
    loop.start();
  }

  function renderWebGL(qParams) {
    if (!gl || fallbackReason || gl.isContextLost?.()) return false;
    const fullW = glCanvas.width;
    const fullH = glCanvas.height;
    const targetFbW = Math.max(64, Math.round(fullW * qParams.scale));
    const targetFbH = Math.max(48, Math.round(fullH * qParams.scale));
    const useHdr = hdr && ensureHdrTargets(targetFbW, targetFbH);
    const useFbo = !useHdr && qParams.scale < 0.995 ? ensureFbo(targetFbW, targetFbH) : false;

    const basis = computeCameraBasis(state);
    const params = mapObservatoryParams(state);
    const shipBeta = journey && journey.phase !== 'done' ? journey.shipBeta : [0, 0, 0];
    const skyGravBlue = journey && journey.phase !== 'done' ? 1.0 : 0.0;

    // Geçiş 1: Ekran-dışı FBO (veya tam ölçekte doğrudan tuval) üzerine ışın izleme
    gl.bindFramebuffer(gl.FRAMEBUFFER, useHdr ? hdrScene.fbo : useFbo ? fbo : null);
    const drawW = useHdr ? hdrScene.w : useFbo ? fboW : fullW;
    const drawH = useHdr ? hdrScene.h : useFbo ? fboH : fullH;
    gl.viewport(0, 0, drawW, drawH);

    gl.useProgram(rtProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyTex);

    gl.uniform2f(rtLoc.uResolution, drawW, drawH);
    gl.uniform3f(rtLoc.uCamPos, basis.pos[0], basis.pos[1], basis.pos[2]);
    gl.uniform3f(rtLoc.uCamRight, basis.right[0], basis.right[1], basis.right[2]);
    gl.uniform3f(rtLoc.uCamUp, basis.up[0], basis.up[1], basis.up[2]);
    gl.uniform3f(rtLoc.uCamFwd, basis.fwd[0], basis.fwd[1], basis.fwd[2]);
    gl.uniform1f(rtLoc.uTanHalfFov, basis.tanHalfFov);
    gl.uniform1f(rtLoc.uAspect, stageW / Math.max(1, stageH));
    gl.uniform1f(rtLoc.uSpin, params.spin);
    gl.uniform1f(rtLoc.uDiskInner, params.diskInnerEffectiveM);
    gl.uniform1f(rtLoc.uDiskOuter, params.diskOuterM);
    gl.uniform1f(rtLoc.uTempScale, params.tempScale);
    gl.uniform1f(rtLoc.uDiskBrightness, params.diskBrightness);
    gl.uniform1f(rtLoc.uTime, simTime);
    gl.uniform1f(rtLoc.uShowDisk, params.showDisk);
    gl.uniform1f(rtLoc.uUseDoppler, params.useDoppler);
    gl.uniform1f(rtLoc.uUseGravRedshift, params.useGravRedshift);
    gl.uniform1f(rtLoc.uUseLensing, params.useLensing);
    gl.uniform1f(rtLoc.uMaxSteps, qParams.maxSteps);
    gl.uniform1f(rtLoc.uStepScale, qParams.stepScale);
    gl.uniform3f(rtLoc.uShipBeta, shipBeta[0], shipBeta[1], shipBeta[2]);
    gl.uniform1f(rtLoc.uSkyGravBlue, skyGravBlue);
    gl.uniform1i(rtLoc.uSkyTex, 0);
    gl.uniform1f(rtLoc.uHasSkyTex, hasSkyTex ? 1.0 : 0.0);
    gl.uniform1f(rtLoc.uJet, params.jet);
    gl.uniform1f(rtLoc.uHotSpot, params.hotSpot);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (useHdr) {
      postProcess(fullW, fullH);
      return true;
    }

    // Geçiş 2: FBO -> tam tuvale doğrusal filtreli büyütme
    if (useFbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, fullW, fullH);
      gl.useProgram(prProg);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fboTex);
      gl.uniform1i(prLoc.uFrameTex, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return true;
  }

  function drawOverlay(ro) {
    const ovCtx = ovCanvas?.getContext?.('2d');
    if (!ovCtx) return;
    ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOverlay2D(ovCtx, stageW, stageH, state, ro, {
      fallbackMode: !!fallbackReason || !gl,
      accCol: accentColor(),
    });
  }

  function isAnimating() {
    const m = motion();
    if (m === 'off') return false;
    const diskMoving = state.showDisk && state.animateDisk && !fallbackReason;
    const hasInertia = Math.abs(inertia.vYaw) > 1e-4 || Math.abs(inertia.vInclDeg) > 1e-3;
    const inJourney = !!journey && journey.phase !== 'done';
    return diskMoving || dragging || hasInertia || inJourney;
  }

  // ---------- Tek rAF Döngüsü (createAnimLoop: asleep() ve mp-vis tam uyumlu) ----------
  const loop = createAnimLoop((now, dtRaw) => {
    if (dead) return false;
    // 30 fps cap: in-between display frames are skipped; time steps span the drawn frames
    if (prevFrameNow > 0 && now - prevFrameNow < 1000 / 30 - 2) return isAnimating();
    const dt = prevFrameNow > 0 ? Math.min(0.05, (now - prevFrameNow) / 1000) : dtRaw;

    const rawFrameMs = prevFrameNow > 0 ? (now - prevFrameNow) : 16.7;
    prevFrameNow = now;
    const mm = motion();
    const isMoving = dragging || (!!journey && journey.phase !== 'done') || Math.abs(inertia.vYaw) > 1e-4;

    if (state.showDisk && state.animateDisk && mm !== 'off') {
      simTime += dt * (mm === 'reduced' ? 0.35 : 1.0);
      dirty = true;
    }

    if (journey && journey.phase !== 'done') {
      stepShipJourney(journey, dt, state.massSolar);
      state.distanceM = journey.distanceM;
      state.inclinationDeg = journey.inclinationDeg;
      state.yaw = journey.yaw;
      dirty = true;
      syncShipUI();
      if (slEls.dist) slEls.dist.value = String(state.distanceM);
      if (slEls.incl) slEls.incl.value = String(state.inclinationDeg);
      if (valEls.dist) valEls.dist.textContent = `${BH.formatNumTR(state.distanceM, 1)} M`;
      if (valEls.incl) valEls.incl.textContent = `${BH.formatNumTR(state.inclinationDeg, 1)}°`;
      if (journey.phase === 'done') {
        journey = null;
        syncShipUI();
      }
    } else if (!dragging && mm === 'full' && (Math.abs(inertia.vYaw) > 1e-4 || Math.abs(inertia.vInclDeg) > 1e-3)) {
      const next = stepCameraInertia(state, inertia, dt);
      state.yaw = next.yaw;
      state.inclinationDeg = next.inclinationDeg;
      inertia.vYaw = next.vYaw;
      inertia.vInclDeg = next.vInclDeg;
      dirty = true;
      if (slEls.incl) slEls.incl.value = String(state.inclinationDeg);
      if (valEls.incl) valEls.incl.textContent = `${BH.formatNumTR(state.inclinationDeg, 1)}°`;
    }

    const qParams = quality.getParams(dragging);
    if (dirty) {
      if (!fallbackReason && gl) {
        renderWebGL(qParams);
      }
      const needRo = now - lastReadoutSync > 90 || !isMoving;
      const ro = needRo ? syncReadoutsUI() : computeObservatoryReadouts(state);
      if (needRo) lastReadoutSync = now;
      drawOverlay(ro);
      dirty = false;
    }

    const keep = isAnimating();
    if (keep && !fallbackReason) {
      const qRec = quality.recordFrame(rawFrameMs, dragging);
      if (now - lastBadgeSync > 240 || qRec.changed) {
        syncQualityBadge(qRec);
        lastBadgeSync = now;
      }
    } else {
      prevFrameNow = 0;
      syncQualityBadge(qParams);
    }
    return keep;
  }, clean);

  function requestRender() {
    dirty = true;
    loop.start();
  }

  // ---------- Önayar, Kaydırıcı, Anahtar ve Sinematik Etkileşimleri ----------
  function applyPreset(presetId) {
    const p = OBSERVATORY_PRESETS.find(x => x.id === presetId);
    if (!p) return;
    journey = null;
    inertia.vYaw = 0;
    inertia.vInclDeg = 0;
    const cat = p.catalogId ? findCatalog(p.catalogId) : null;
    Object.assign(state, {
      presetId: p.id,
      objectName: cat ? cat.name : p.label,
      massSolar: p.massSolar,
      distancePc: p.distancePc,
      spin: p.spin,
      inclinationDeg: p.inclinationDeg,
      distanceM: p.distanceM,
      yaw: p.yaw,
      diskOuterM: p.diskOuterM,
      tempScale: p.tempScale,
      diskBrightness: p.diskBrightness,
      showDisk: p.showDisk,
      doppler: p.doppler,
      gravRedshift: p.gravRedshift,
      lensing: p.lensing,
      showOverlay: p.showOverlay,
      jet: !!p.jet,
    });
    syncControlsUI();
    syncShipUI();
    syncReadoutsUI();
    requestRender();
  }

  function resetCamera() {
    journey = null;
    inertia.vYaw = 0;
    inertia.vInclDeg = 0;
    const p = OBSERVATORY_PRESETS.find(x => x.id === state.presetId) || OBSERVATORY_PRESETS[0];
    state.inclinationDeg = p.inclinationDeg;
    state.distanceM = p.distanceM;
    state.yaw = p.yaw;
    syncControlsUI();
    syncShipUI();
    syncReadoutsUI();
    requestRender();
  }

  function toggleShipCinematic() {
    if (journey && journey.phase !== 'done') {
      if (motion() === 'off') {
        state.distanceM = journey.startDist;
        state.inclinationDeg = journey.startIncl;
        state.yaw = journey.startYaw;
        journey = null;
        syncControlsUI();
        syncShipUI();
        syncReadoutsUI();
        requestRender();
      } else {
        beginShipReturn(journey);
        syncShipUI();
        requestRender();
      }
      return;
    }

    journey = createShipJourney(state);
    inertia.vYaw = 0;
    inertia.vInclDeg = 0;
    if (motion() === 'off') {
      // Hareket kapalıysa doğrudan ISCO yakınındaki yörüngeye atla
      stepShipJourney(journey, journey.approachDurSec + 0.1, state.massSolar);
      state.distanceM = journey.distanceM;
      state.inclinationDeg = journey.inclinationDeg;
      state.yaw = journey.yaw;
      syncControlsUI();
      syncReadoutsUI();
    }
    syncShipUI();
    requestRender();
  }

  // ---------- Pointer (Sürükleme + İki Parmak Kıstırma) ve Tekerlek ----------
  const activePtrs = new Map();
  let pinchDist0 = 0;
  let camDist0 = state.distanceM;
  let lastTapAt = 0;
  let lastMoveAt = 0;

  function markInteracted() {
    if (!interacted) {
      interacted = true;
      hintEl?.classList.add('bh-hidden');
    }
  }

  const onPointerDown = e => {
    if (e.target.closest?.('button')) return;
    markInteracted();
    if (journey && journey.phase !== 'done') {
      journey = null;
      syncShipUI();
    }
    stageEl.setPointerCapture?.(e.pointerId);
    activePtrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (activePtrs.size === 2) {
      const [a, b] = [...activePtrs.values()];
      pinchDist0 = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
      camDist0 = state.distanceM;
    }
    dragging = true;
    lastMoveAt = 0;
    stageEl.classList.add('bh-dragging');
    inertia.vYaw = 0;
    inertia.vInclDeg = 0;
    requestRender();
  };

  const onPointerMove = e => {
    if (!activePtrs.has(e.pointerId)) return;
    const prev = activePtrs.get(e.pointerId);
    activePtrs.set(e.pointerId, [e.clientX, e.clientY]);

    if (activePtrs.size === 2) {
      const [a, b] = [...activePtrs.values()];
      const cur = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]));
      state.distanceM = applyCameraZoom(camDist0, pinchDist0 / cur);
      inertia.vYaw = 0;
      inertia.vInclDeg = 0;
      if (slEls.dist) slEls.dist.value = String(state.distanceM);
      if (valEls.dist) valEls.dist.textContent = `${BH.formatNumTR(state.distanceM, 1)} M`;
      requestRender();
      return;
    }

    const dx = e.clientX - prev[0];
    const dy = e.clientY - prev[1];
    const next = applyCameraDrag(state, dx, dy);
    state.yaw = next.yaw;
    state.inclinationDeg = next.inclinationDeg;
    inertia.vYaw = inertia.vYaw * 0.4 + next.vYaw * 0.6;
    inertia.vInclDeg = inertia.vInclDeg * 0.4 + next.vInclDeg * 0.6;
    lastMoveAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (slEls.incl) slEls.incl.value = String(state.inclinationDeg);
    if (valEls.incl) valEls.incl.textContent = `${BH.formatNumTR(state.inclinationDeg, 1)}°`;
    requestRender();
  };

  const onPointerUp = e => {
    if (!activePtrs.has(e.pointerId)) return;
    activePtrs.delete(e.pointerId);
    if (activePtrs.size > 0) return;
    dragging = false;
    stageEl.classList.remove('bh-dragging');
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (lastMoveAt > 0 && now - lastMoveAt > 80) {
      inertia.vYaw = 0;
      inertia.vInclDeg = 0;
    }
    if (Math.abs(inertia.vYaw) < 1e-4 && Math.abs(inertia.vInclDeg) < 1e-3 && now - lastTapAt < 300) {
      resetCamera();
    }
    lastTapAt = now;
    requestRender();
  };

  const onWheel = e => {
    e.preventDefault();
    markInteracted();
    if (journey && journey.phase !== 'done') {
      journey = null;
      syncShipUI();
    }
    state.distanceM = applyCameraZoom(state.distanceM, Math.exp(e.deltaY * 0.0011));
    if (slEls.dist) slEls.dist.value = String(state.distanceM);
    if (valEls.dist) valEls.dist.textContent = `${BH.formatNumTR(state.distanceM, 1)} M`;
    syncReadoutsUI();
    requestRender();
  };

  const onStageKey = e => {
    if (e.target.closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); state.yaw -= 0.1; requestRender(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); state.yaw += 0.1; requestRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); state.inclinationDeg = clamp(state.inclinationDeg - 3, INCL_MIN_DEG, INCL_MAX_DEG); syncControlsUI(); requestRender(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); state.inclinationDeg = clamp(state.inclinationDeg + 3, INCL_MIN_DEG, INCL_MAX_DEG); syncControlsUI(); requestRender(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); state.distanceM = applyCameraZoom(state.distanceM, 0.85); syncControlsUI(); syncReadoutsUI(); requestRender(); }
    else if (e.key === '-') { e.preventDefault(); state.distanceM = applyCameraZoom(state.distanceM, 1.18); syncControlsUI(); syncReadoutsUI(); requestRender(); }
    else if (e.key === 'r' || e.key === 'R') { resetCamera(); }
    else if (e.key === 'Escape' && journey && journey.phase !== 'done') { beginShipReturn(journey); syncShipUI(); requestRender(); }
  };

  // ---------- Konteyner Olay Delegasyonu ----------
  const onHostClick = e => {
    const presetBtn = e.target.closest?.('[data-bh-preset]');
    if (presetBtn) {
      applyPreset(presetBtn.dataset.bhPreset);
      return;
    }
    const toggleBtn = e.target.closest?.('[data-bh-toggle]');
    if (toggleBtn) {
      const k = toggleBtn.dataset.bhToggle;
      if (k in state) {
        state[k] = !state[k];
        syncControlsUI();
        requestRender();
      }
      return;
    }
    const qBtn = e.target.closest?.('[data-bh-q]');
    if (qBtn) {
      const m = qBtn.dataset.bhQ;
      state.qualityMode = quality.setMode(m);
      syncControlsUI();
      syncQualityBadge(quality.getParams(false));
      requestRender();
      return;
    }
    const zBtn = e.target.closest?.('[data-bh-zoom]');
    if (zBtn) {
      if (journey && journey.phase !== 'done') { journey = null; syncShipUI(); }
      state.distanceM = applyCameraZoom(state.distanceM, zBtn.dataset.bhZoom === 'in' ? 0.8 : 1.25);
      syncControlsUI();
      syncReadoutsUI();
      requestRender();
      return;
    }
    if (e.target.closest?.('[data-bh-reset]')) {
      resetCamera();
      return;
    }
    if (e.target.closest?.('[data-bh-ship]')) {
      toggleShipCinematic();
      return;
    }
    if (e.target.closest?.('[data-bh-anim]')) {
      state.animateDisk = !state.animateDisk;
      syncControlsUI();
      requestRender();
    }
  };

  const onHostInput = e => {
    const sl = e.target.closest?.('[data-bh-sl]');
    if (!sl) return;
    const kind = sl.dataset.bhSl;
    const v = parseFloat(sl.value);
    if (!Number.isFinite(v)) return;

    if (kind === 'mass') {
      state.massSolar = massSliderToSolar(v);
      state.presetId = 'custom';
      state.objectName = 'Özel Kara Delik';
      state.distancePc = null;
      syncControlsUI();
      syncReadoutsUI();
      // Kütle değişikliği boyutsuz ışın izlemeyi değiştirmez; yalnızca r_s ölçek çubuğunu günceller
      if (state.showOverlay || fallbackReason) drawOverlay(computeObservatoryReadouts(state));
      return;
    }
    if (kind === 'spin') {
      state.spin = Math.abs(v) < 0.004 ? 0 : clamp(v, SPIN_MIN, SPIN_MAX);
    } else if (kind === 'incl') {
      if (journey && journey.phase !== 'done') { journey = null; syncShipUI(); }
      state.inclinationDeg = clamp(v, INCL_MIN_DEG, INCL_MAX_DEG);
    } else if (kind === 'dist') {
      if (journey && journey.phase !== 'done') { journey = null; syncShipUI(); }
      state.distanceM = clamp(v, DIST_MIN_M, DIST_MAX_M);
    } else if (kind === 'outer') {
      state.diskOuterM = clamp(v, DISK_OUTER_MIN, DISK_OUTER_MAX);
    } else if (kind === 'temp') {
      state.tempScale = clamp(v, TEMP_SCALE_MIN, TEMP_SCALE_MAX);
    }
    syncControlsUI();
    syncReadoutsUI();
    requestRender();
  };

  // ---------- WebGL Bağlam Kaybı ve Kurtarma ----------
  const onContextLost = e => {
    e.preventDefault();
    loop.stop();
    showFallback('context-lost');
    syncQualityBadge(quality.getParams(false));
    drawOverlay(computeObservatoryReadouts(state));
  };

  const onContextRestored = () => {
    if (dead) return;
    if (initWebGL()) {
      toast('Gözlemevi WebGL bağlamı yenilendi');
      syncQualityBadge(quality.getParams(false));
      requestRender();
    }
  };

  const onTheme = () => {
    drawOverlay(computeObservatoryReadouts(state));
  };

  const onVisResetTimer = () => {
    prevFrameNow = 0;
  };

  // ---------- Dinleyicileri ve Gözlemcileri Bağla ----------
  host.addEventListener('click', onHostClick);
  host.addEventListener('input', onHostInput);
  stageEl?.addEventListener('pointerdown', onPointerDown);
  stageEl?.addEventListener('pointermove', onPointerMove);
  stageEl?.addEventListener('pointerup', onPointerUp);
  stageEl?.addEventListener('pointercancel', onPointerUp);
  stageEl?.addEventListener('wheel', onWheel, { passive: false });
  stageEl?.addEventListener('keydown', onStageKey);
  glCanvas?.addEventListener('webglcontextlost', onContextLost);
  glCanvas?.addEventListener('webglcontextrestored', onContextRestored);
  if (typeof window !== 'undefined') {
    window.addEventListener('mp-theme', onTheme);
    window.addEventListener('mp-vis', onVisResetTimer);
  }

  const ro = typeof ResizeObserver !== 'undefined' && stageEl ? new ResizeObserver(resizeCanvases) : null;
  ro?.observe(stageEl);

  clean.add(() => {
    dead = true;
    loop.stop();
    ro?.disconnect();
    host.removeEventListener('click', onHostClick);
    host.removeEventListener('input', onHostInput);
    stageEl?.removeEventListener('pointerdown', onPointerDown);
    stageEl?.removeEventListener('pointermove', onPointerMove);
    stageEl?.removeEventListener('pointerup', onPointerUp);
    stageEl?.removeEventListener('pointercancel', onPointerUp);
    stageEl?.removeEventListener('wheel', onWheel);
    stageEl?.removeEventListener('keydown', onStageKey);
    glCanvas?.removeEventListener('webglcontextlost', onContextLost);
    glCanvas?.removeEventListener('webglcontextrestored', onContextRestored);
    if (typeof window !== 'undefined') {
      window.removeEventListener('mp-theme', onTheme);
      window.removeEventListener('mp-vis', onVisResetTimer);
    }
    destroyWebGL(true);
    gl = null;
    cachedSkyImg = null;
    host.innerHTML = '';
  });

  // Başlangıç kurulumu
  initWebGL();
  syncControlsUI();
  syncShipUI();
  const initRo = syncReadoutsUI();
  syncQualityBadge(quality.getParams(false));
  resizeCanvases();
  // Asleep durumunda bile 2B yedek / katman anında çizili olsun
  if (fallbackReason || asleep()) {
    drawOverlay(initRo);
  }
  requestRender();

  return clean.run;
}
